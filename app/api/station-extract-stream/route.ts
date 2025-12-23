import { db } from "@/lib/db";
import { stationCaptures } from "@/lib/db/schema";
import { eq } from "drizzle-orm";
import { type StationExtraction } from "@/lib/ai/schemas/station-extraction";
import { extractStationDetailed } from "@/lib/ai/extract-station";
import { validateSessionFromCookie } from "@/lib/auth";
import {
  DEFAULT_SIGN_MODEL,
  DEFAULT_COUNTING_MODEL,
  VALID_MODEL_IDS,
  calculateCost,
} from "@/lib/ai/models";

export const maxDuration = 60;

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

/**
 * Station extraction endpoint using two separate AI calls:
 * 1. Sign extraction (GPT-4o Mini) - reads product code, min, max
 * 2. Stock counting (Gemini 2.5 Flash) - counts items in stock photo
 *
 * Both calls run in parallel for speed. Results are combined and persisted.
 * Returns JSON response (not streaming) since we're running parallel calls.
 */
export async function POST(request: Request) {
  const isValid = validateSessionFromCookie(request.headers.get("cookie"));
  if (!isValid) {
    return new Response("Unauthorized", { status: 401 });
  }

  const body = await request.json();
  const {
    stationId,
    signModel,
    stockModel,
    signImageUrl: providedSignUrl,
    stockImageUrl: providedStockUrl,
  } = body;

  // Validate UUID
  const uuidRegex =
    /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
  if (!stationId || !uuidRegex.test(stationId)) {
    return Response.json({ error: "Invalid station ID" }, { status: 400 });
  }

  // Validate models (use defaults if not provided or invalid)
  const selectedSignModel =
    signModel && VALID_MODEL_IDS.includes(signModel) ? signModel : DEFAULT_SIGN_MODEL;
  const selectedStockModel =
    stockModel && VALID_MODEL_IDS.includes(stockModel) ? stockModel : DEFAULT_COUNTING_MODEL;

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

    // Run both extractions in parallel
    const { combined, sign, stock } = await extractStationDetailed(
      signBlobUrl,
      stockBlobUrl,
      selectedSignModel,
      selectedStockModel
    );

    // Map extraction status to station status
    const newStatus = mapExtractionStatusToStationStatus(combined);

    // Calculate approximate cost (we don't have exact token counts from parallel calls)
    // This is a rough estimate based on typical image + text tokens
    const estimatedInputTokens = 2000; // ~1000 per image
    const estimatedOutputTokens = 200; // ~100 per extraction
    const signCost = calculateCost(selectedSignModel, estimatedInputTokens / 2, estimatedOutputTokens / 2);
    const stockCost = calculateCost(selectedStockModel, estimatedInputTokens / 2, estimatedOutputTokens / 2);
    const totalCost = signCost + stockCost;

    // Update station with extraction results and metadata
    // Also persist blob URLs if they were provided (ensures URLs are saved even if webhook is slow)
    const now = new Date().toISOString();
    await db
      .update(stationCaptures)
      .set({
        status: newStatus,
        productCode: combined.productCode,
        minQty: combined.minQty,
        maxQty: combined.maxQty,
        onHandQty: combined.onHandQty,
        errorMessage: combined.status !== "success" ? combined.message : null,
        // Store both models used (sign model in 'model' field for backward compatibility)
        model: `${selectedSignModel} + ${selectedStockModel}`,
        // Estimated tokens (we don't have exact counts from parallel calls)
        inputTokens: estimatedInputTokens,
        outputTokens: estimatedOutputTokens,
        totalCost,
        extractedAt: now,
        // Persist blob URLs if provided (handles race condition with webhook)
        ...(providedSignUrl ? { signBlobUrl: providedSignUrl, signUploadedAt: now } : {}),
        ...(providedStockUrl ? { stockBlobUrl: providedStockUrl, stockUploadedAt: now } : {}),
      })
      .where(eq(stationCaptures.id, stationId));

    console.log(
      `Station extraction persisted for station ${stationId} (sign: ${sign.status}, stock: ${stock.status}, combined: ${combined.status})`
    );

    // Return the combined extraction result as JSON
    // Include detailed results for debugging/transparency
    return Response.json({
      extraction: combined,
      details: {
        sign: {
          status: sign.status,
          message: sign.message,
          productCode: sign.productCode,
          minQty: sign.minQty,
          maxQty: sign.maxQty,
          model: selectedSignModel,
        },
        stock: {
          status: stock.status,
          message: stock.message,
          onHandQty: stock.onHandQty,
          confidence: stock.confidence,
          countingMethod: stock.countingMethod,
          model: selectedStockModel,
        },
      },
    });
  } catch (error) {
    console.error("Failed to extract station:", error);

    // Update station status on error
    try {
      await db
        .update(stationCaptures)
        .set({ status: "needs_attention", errorMessage: "Extraction failed" })
        .where(eq(stationCaptures.id, stationId));
    } catch {
      // Ignore DB error
    }

    return Response.json({ error: "Failed to extract station" }, { status: 500 });
  }
}
