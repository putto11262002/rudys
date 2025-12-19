import { streamObject } from "ai";
import { db } from "@/lib/db";
import { stationCaptures } from "@/lib/db/schema";
import { eq } from "drizzle-orm";
import {
  StationExtractionSchema,
  type StationExtraction,
} from "@/lib/ai/schemas/station-extraction";
import { STATION_SYSTEM_PROMPT, STATION_USER_PROMPT } from "@/lib/ai/prompts";
import { validateSessionFromCookie } from "@/lib/auth";

export const maxDuration = 60;

/**
 * Safely parse JSON that may be truncated/malformed.
 * Returns null if parsing fails completely.
 */
function safeParseExtraction(jsonString: string): StationExtraction | null {
  try {
    const parsed = JSON.parse(jsonString);
    // Validate with zod schema
    const result = StationExtractionSchema.safeParse(parsed);
    if (result.success) {
      return result.data;
    }
    console.warn("Station extraction validation failed:", result.error.message);
    return null;
  } catch {
    console.warn("Failed to parse station extraction JSON");
    return null;
  }
}

// Default model if none specified
const DEFAULT_MODEL = "google/gemini-2.5-flash-lite";

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
  outputTokens: number
): number {
  const pricing = MODEL_PRICING[model] ?? MODEL_PRICING[DEFAULT_MODEL];
  const inputCost = (inputTokens / 1_000_000) * pricing.input;
  const outputCost = (outputTokens / 1_000_000) * pricing.output;
  return inputCost + outputCost;
}

/**
 * Maps extraction status to station capture status
 */
function mapExtractionStatusToStationStatus(
  extraction: StationExtraction
): "valid" | "needs_attention" | "failed" {
  if (extraction.status === "success") {
    return "valid";
  }
  if (extraction.status === "error") {
    return "failed";
  }
  return "needs_attention"; // warning
}

export async function POST(request: Request) {
  const isValid = validateSessionFromCookie(request.headers.get("cookie"));
  if (!isValid) {
    return new Response("Unauthorized", { status: 401 });
  }

  const body = await request.json();
  const { stationId, model, signImageUrl: providedSignUrl, stockImageUrl: providedStockUrl } = body;

  // Validate UUID
  const uuidRegex =
    /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
  if (!stationId || !uuidRegex.test(stationId)) {
    return Response.json({ error: "Invalid station ID" }, { status: 400 });
  }

  // Validate model (use default if not provided or invalid)
  const selectedModel =
    model && VALID_MODELS.includes(model) ? model : DEFAULT_MODEL;

  try {
    // Verify station exists
    const station = await db.query.stationCaptures.findFirst({
      where: eq(stationCaptures.id, stationId),
    });

    if (!station) {
      return Response.json({ error: "Station not found" }, { status: 404 });
    }

    // Use provided image URLs (from client upload) or fallback to DB lookup (for re-extraction)
    let signBlobUrl: string;
    let stockBlobUrl: string;

    if (providedSignUrl && providedStockUrl) {
      signBlobUrl = providedSignUrl;
      stockBlobUrl = providedStockUrl;
    } else if (station.signBlobUrl && station.stockBlobUrl) {
      signBlobUrl = station.signBlobUrl;
      stockBlobUrl = station.stockBlobUrl;
    } else {
      return Response.json(
        { error: "Station must have both sign and stock images" },
        { status: 400 }
      );
    }

    // Build content array with text prompt + images
    const content: Array<
      { type: "text"; text: string } | { type: "image"; image: string }
    > = [
      { type: "text", text: STATION_USER_PROMPT },
      { type: "text", text: "Image A (SIGN):" },
      { type: "image", image: signBlobUrl },
      { type: "text", text: "Image B (STOCK):" },
      { type: "image", image: stockBlobUrl },
    ];

    // Stream the object generation
    const result = streamObject({
      model: selectedModel,
      schema: StationExtractionSchema,
      schemaName: "StationExtraction",
      schemaDescription:
        "Extracted station data from sign and stock images with match validation",
      messages: [
        { role: "system", content: STATION_SYSTEM_PROMPT },
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

            // Map extraction status to station status
            const newStatus = mapExtractionStatusToStationStatus(extraction);

            // Update station with extraction results and metadata
            await db
              .update(stationCaptures)
              .set({
                status: newStatus,
                productCode: extraction.productCode,
                minQty: extraction.minQty,
                maxQty: extraction.maxQty,
                onHandQty: extraction.onHandQty,
                errorMessage:
                  extraction.status !== "success" ? extraction.message : null,
                model: selectedModel,
                inputTokens,
                outputTokens,
                totalCost,
                extractedAt: new Date().toISOString(),
              })
              .where(eq(stationCaptures.id, stationId));

            console.log(
              `Station extraction persisted for station ${stationId}`,
            );
          } else {
            // Parsing failed - mark as needs attention
            console.error(
              `Failed to parse station extraction for ${stationId}. Raw length: ${accumulatedJson.length}`,
            );
            await db
              .update(stationCaptures)
              .set({ status: "needs_attention" })
              .where(eq(stationCaptures.id, stationId));
          }

          controller.close();
        } catch (error) {
          console.error(`Stream error for station ${stationId}:`, error);
          // Still try to update status on error
          await db
            .update(stationCaptures)
            .set({ status: "needs_attention" })
            .where(eq(stationCaptures.id, stationId));
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
    console.error("Failed to extract station:", error);
    return Response.json({ error: "Failed to extract station" }, { status: 500 });
  }
}
