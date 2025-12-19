import { streamObject } from "ai";
import { db } from "@/lib/db";
import {
  employeeCaptureGroups,
  loadingListExtractions,
  loadingListItems,
} from "@/lib/db/schema";
import { eq } from "drizzle-orm";
import {
  LoadingListExtractionSchema,
  type LoadingListExtraction,
} from "@/lib/ai/schemas/loading-list-extraction";
import {
  LOADING_LIST_SYSTEM_PROMPT,
  LOADING_LIST_USER_PROMPT,
} from "@/lib/ai/prompts";
import { validateSessionFromCookie } from "@/lib/auth";

export const maxDuration = 60;

/**
 * Safely parse JSON that may be truncated/malformed.
 * Returns null if parsing fails completely.
 */
function safeParseExtraction(jsonString: string): LoadingListExtraction | null {
  try {
    const parsed = JSON.parse(jsonString);
    // Validate with zod schema
    const result = LoadingListExtractionSchema.safeParse(parsed);
    if (result.success) {
      return result.data;
    }
    console.warn("Extraction validation failed:", result.error.message);
    return null;
  } catch {
    console.warn("Failed to parse extraction JSON");
    return null;
  }
}

// Default model if none specified
const DEFAULT_MODEL = "openai/gpt-4o-mini";

// Model pricing (per 1M tokens) - approximate costs
const MODEL_PRICING: Record<string, { input: number; output: number }> = {
  "openai/gpt-4.1-nano": { input: 0.1, output: 0.4 },
  "openai/gpt-5-nano": { input: 0.1, output: 0.4 },
  "openai/gpt-4o-mini": { input: 0.15, output: 0.6 },
  "google/gemini-2.5-flash-lite": { input: 0.075, output: 0.3 },
  "google/gemini-2.0-flash": { input: 0.1, output: 0.4 },
};

// Valid models that can be selected
const VALID_MODELS = Object.keys(MODEL_PRICING);

/**
 * Calculate cost based on token usage and model
 */
function calculateCost(
  model: string,
  inputTokens: number,
  outputTokens: number,
): number {
  const pricing = MODEL_PRICING[model] ?? MODEL_PRICING[DEFAULT_MODEL];
  const inputCost = (inputTokens / 1_000_000) * pricing.input;
  const outputCost = (outputTokens / 1_000_000) * pricing.output;
  return inputCost + outputCost;
}

interface ExtractionMetadata {
  model: string;
  inputTokens?: number;
  outputTokens?: number;
  totalCost?: number;
}

/**
 * Save extraction result and all items to database (no catalog validation)
 */
async function saveExtraction(
  groupId: string,
  extraction: LoadingListExtraction,
  metadata: ExtractionMetadata,
): Promise<{ extractionId: string; itemCount: number }> {
  // Delete existing extraction and items for this group (for re-extraction)
  await db
    .delete(loadingListItems)
    .where(eq(loadingListItems.groupId, groupId));
  await db
    .delete(loadingListExtractions)
    .where(eq(loadingListExtractions.groupId, groupId));

  // Insert extraction record (raw AI output for audit)
  const [insertedExtraction] = await db
    .insert(loadingListExtractions)
    .values({
      groupId,
      status: extraction.status,
      message: extraction.message,
      rawActivities: extraction.activities,
      rawLineItems: extraction.lineItems,
      summary: extraction.summary,
      model: metadata.model,
      inputTokens: metadata.inputTokens,
      outputTokens: metadata.outputTokens,
      totalCost: metadata.totalCost,
    })
    .returning({ id: loadingListExtractions.id });

  const extractionId = insertedExtraction.id;

  // Insert ALL items (no catalog validation)
  if (extraction.lineItems.length > 0) {
    await db.insert(loadingListItems).values(
      extraction.lineItems.map((item) => ({
        groupId,
        extractionId,
        activityCode: item.activityCode,
        productCode: item.primaryCode,
        description: item.description,
        quantity: item.quantity,
        source: "extraction" as const,
      })),
    );
  }

  return {
    extractionId,
    itemCount: extraction.lineItems.length,
  };
}

export async function POST(request: Request) {
  const isValid = validateSessionFromCookie(request.headers.get("cookie"));
  if (!isValid) {
    return new Response("Unauthorized", { status: 401 });
  }

  const body = await request.json();
  const { groupId, model, imageUrls: providedImageUrls } = body;

  // Validate UUID
  const uuidRegex =
    /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
  if (!groupId || !uuidRegex.test(groupId)) {
    return Response.json({ error: "Invalid group ID" }, { status: 400 });
  }

  // Validate model (use default if not provided or invalid)
  const selectedModel =
    model && VALID_MODELS.includes(model) ? model : DEFAULT_MODEL;

  try {
    // Verify group exists
    const group = await db.query.employeeCaptureGroups.findFirst({
      where: eq(employeeCaptureGroups.id, groupId),
      with: {
        images: {
          orderBy: (images, { asc }) => [asc(images.orderIndex)],
        },
      },
    });

    if (!group) {
      return Response.json({ error: "Group not found" }, { status: 404 });
    }

    // Use provided imageUrls (from client upload) or fallback to DB lookup (for re-extraction)
    let imageUrls: string[];
    if (providedImageUrls && Array.isArray(providedImageUrls) && providedImageUrls.length > 0) {
      imageUrls = providedImageUrls;
    } else if (group.images.length > 0) {
      imageUrls = group.images.map((img) => img.blobUrl);
    } else {
      return Response.json({ error: "No images provided or found in group" }, { status: 400 });
    }

    // Build content array with text prompt + images
    const content: Array<
      { type: "text"; text: string } | { type: "image"; image: string }
    > = [
      { type: "text", text: LOADING_LIST_USER_PROMPT },
      ...imageUrls.map((url) => ({
        type: "image" as const,
        image: url,
      })),
    ];

    // Stream the object generation
    const result = streamObject({
      model: selectedModel,
      schema: LoadingListExtractionSchema,
      schemaName: "LoadingListExtraction",
      schemaDescription:
        "Extracted activities and line items from loading list screenshots",
      messages: [
        { role: "system", content: LOADING_LIST_SYSTEM_PROMPT },
        { role: "user", content },
      ],
    });

    // Create a custom streaming response that:
    // 1. Streams chunks to client in real-time
    // 2. Accumulates the full JSON string
    // 3. Persists to database BEFORE the response ends (critical for serverless)
    const encoder = new TextEncoder();

    const stream = new ReadableStream({
      async start(controller) {
        let accumulatedJson = "";

        try {
          // Iterate through textStream - this gives us raw JSON string chunks
          for await (const chunk of result.textStream) {
            accumulatedJson += chunk;
            // Stream chunk to client immediately
            controller.enqueue(encoder.encode(chunk));
          }

          // Stream finished - now persist to database BEFORE closing
          const extraction = safeParseExtraction(accumulatedJson);

          if (extraction) {
            // Get usage stats
            const usage = await result.usage;
            const inputTokens = usage?.inputTokens;
            const outputTokens = usage?.outputTokens;
            const totalCost =
              inputTokens !== undefined && outputTokens !== undefined
                ? calculateCost(selectedModel, inputTokens, outputTokens)
                : undefined;

            // Save to database
            const { itemCount } = await saveExtraction(groupId, extraction, {
              model: selectedModel,
              inputTokens,
              outputTokens,
              totalCost,
            });

            // Update group status
            const newStatus =
              extraction.status === "error" ? "needs_attention" : "extracted";

            await db
              .update(employeeCaptureGroups)
              .set({ status: newStatus })
              .where(eq(employeeCaptureGroups.id, groupId));

            console.log(
              `Extraction persisted for group ${groupId}: ${itemCount} items`,
            );
          } else {
            // Parsing failed - mark as needs attention
            console.error(
              `Failed to parse extraction for group ${groupId}. Raw length: ${accumulatedJson.length}`,
            );
            await db
              .update(employeeCaptureGroups)
              .set({ status: "needs_attention" })
              .where(eq(employeeCaptureGroups.id, groupId));
          }

          controller.close();
        } catch (error) {
          console.error(`Stream error for group ${groupId}:`, error);
          // Still try to update status on error
          await db
            .update(employeeCaptureGroups)
            .set({ status: "needs_attention" })
            .where(eq(employeeCaptureGroups.id, groupId));
          controller.error(error);
        }
      },
    });

    return new Response(stream, {
      headers: {
        "Content-Type": "text/plain; charset=utf-8",
        "Transfer-Encoding": "chunked",
      },
    });
  } catch (error) {
    console.error("Failed to extract group:", error);
    return Response.json({ error: "Failed to extract group" }, { status: 500 });
  }
}
