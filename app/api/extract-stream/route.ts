import { streamObject } from "ai";
import { db } from "@/lib/db";
import {
  employeeCaptureGroups,
  loadingListExtractionResults,
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

export const maxDuration = 60;

// Default model if none specified
const DEFAULT_MODEL = "google/gemini-2.5-flash-lite";

// Model pricing (per 1M tokens) - approximate costs
const MODEL_PRICING: Record<string, { input: number; output: number }> = {
  "openai/gpt-4.1-nano": { input: 0.10, output: 0.40 },
  "openai/gpt-5-nano": { input: 0.10, output: 0.40 },
  "openai/gpt-4o-mini": { input: 0.15, output: 0.60 },
  "google/gemini-2.5-flash-lite": { input: 0.075, output: 0.30 },
  "google/gemini-2.0-flash": { input: 0.10, output: 0.40 },
};

// Valid models that can be selected
const VALID_MODELS = Object.keys(MODEL_PRICING);

/**
 * Calculate cost based on token usage and model
 */
function calculateCost(
  model: string,
  inputTokens: number,
  outputTokens: number
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
 * Save extraction result to database with metadata
 */
async function saveExtractionResult(
  groupId: string,
  extraction: LoadingListExtraction,
  metadata: ExtractionMetadata
): Promise<void> {
  await db
    .delete(loadingListExtractionResults)
    .where(eq(loadingListExtractionResults.groupId, groupId));

  await db.insert(loadingListExtractionResults).values({
    groupId,
    status: extraction.status,
    message: extraction.message,
    activities: extraction.activities,
    lineItems: extraction.lineItems,
    summary: extraction.summary,
    model: metadata.model,
    inputTokens: metadata.inputTokens,
    outputTokens: metadata.outputTokens,
    totalCost: metadata.totalCost,
  });
}

export async function POST(request: Request) {
  const body = await request.json();
  const { groupId, model } = body;

  // Validate UUID
  const uuidRegex =
    /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
  if (!groupId || !uuidRegex.test(groupId)) {
    return Response.json({ error: "Invalid group ID" }, { status: 400 });
  }

  // Validate model (use default if not provided or invalid)
  const selectedModel = model && VALID_MODELS.includes(model) ? model : DEFAULT_MODEL;

  try {
    // Get group with images
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

    if (group.images.length === 0) {
      return Response.json({ error: "No images in group" }, { status: 400 });
    }

    // Get ordered image URLs
    const imageUrls = group.images.map((img) => img.blobUrl);

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
      schemaDescription: "Extracted activities and line items from loading list screenshots",
      messages: [
        { role: "system", content: LOADING_LIST_SYSTEM_PROMPT },
        { role: "user", content },
      ],
    });

    // Use result.object promise for reliable persistence (not onFinish which may not complete)
    // This runs in parallel with the streaming response
    result.object
      .then(async (finalObject) => {
        // Get usage from the result after stream completes
        const usage = await result.usage;
        const inputTokens = usage?.inputTokens;
        const outputTokens = usage?.outputTokens;
        const totalCost =
          inputTokens !== undefined && outputTokens !== undefined
            ? calculateCost(selectedModel, inputTokens, outputTokens)
            : undefined;

        // Persist extraction result with metadata
        await saveExtractionResult(groupId, finalObject, {
          model: selectedModel,
          inputTokens,
          outputTokens,
          totalCost,
        });

        // Update group status
        const newStatus = finalObject.status === "error" ? "needs_attention" : "extracted";
        await db
          .update(employeeCaptureGroups)
          .set({ status: newStatus })
          .where(eq(employeeCaptureGroups.id, groupId));

        console.log(`Extraction persisted for group ${groupId}`);
      })
      .catch(async (error) => {
        // Handle validation failures or stream errors
        console.error(`Extraction failed for group ${groupId}:`, error);
        await db
          .update(employeeCaptureGroups)
          .set({ status: "needs_attention" })
          .where(eq(employeeCaptureGroups.id, groupId));
      });

    return result.toTextStreamResponse();
  } catch (error) {
    console.error("Failed to extract group:", error);
    return Response.json({ error: "Failed to extract group" }, { status: 500 });
  }
}
