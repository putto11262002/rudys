import { streamObject } from "ai";
import { db } from "@/lib/db";
import { stationCaptures } from "@/lib/db/schema";
import { eq } from "drizzle-orm";
import {
  StationExtractionSchema,
  type StationExtraction,
} from "@/lib/ai/schemas/station-extraction";
import { STATION_SYSTEM_PROMPT, STATION_USER_PROMPT } from "@/lib/ai/prompts";

export const maxDuration = 60;

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
  const body = await request.json();
  const { stationId, model } = body;

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
    // Get station with image URLs
    const station = await db.query.stationCaptures.findFirst({
      where: eq(stationCaptures.id, stationId),
    });

    if (!station) {
      return Response.json({ error: "Station not found" }, { status: 404 });
    }

    if (!station.signBlobUrl || !station.stockBlobUrl) {
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
      { type: "image", image: station.signBlobUrl },
      { type: "text", text: "Image B (STOCK):" },
      { type: "image", image: station.stockBlobUrl },
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

        // Map extraction status to station status
        const newStatus = mapExtractionStatusToStationStatus(finalObject);

        // Update station with extraction results and metadata
        await db
          .update(stationCaptures)
          .set({
            status: newStatus,
            productCode: finalObject.productCode,
            minQty: finalObject.minQty,
            maxQty: finalObject.maxQty,
            onHandQty: finalObject.onHandQty,
            errorMessage:
              finalObject.status !== "success" ? finalObject.message : null,
            model: selectedModel,
            inputTokens,
            outputTokens,
            totalCost,
            extractedAt: new Date().toISOString(),
          })
          .where(eq(stationCaptures.id, stationId));

        console.log(`Station extraction persisted for station ${stationId}`);
      })
      .catch(async (error) => {
        // Handle validation failures or stream errors
        console.error(`Station extraction failed for station ${stationId}:`, error);
        await db
          .update(stationCaptures)
          .set({ status: "needs_attention" })
          .where(eq(stationCaptures.id, stationId));
      });

    return result.toTextStreamResponse();
  } catch (error) {
    console.error("Failed to extract station:", error);
    return Response.json({ error: "Failed to extract station" }, { status: 500 });
  }
}
