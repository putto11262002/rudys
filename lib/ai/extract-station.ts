import { type StationExtraction } from "./schemas/station-extraction";
import { type SignExtraction } from "./schemas/sign-extraction";
import { type StockCounting } from "./schemas/stock-counting";
import { extractSign } from "./extract-sign";
import { extractStockCount } from "./extract-stock-count";

/**
 * Combines sign extraction and stock counting results into a single station extraction.
 */
function combineExtractionResults(
  sign: SignExtraction,
  stock: StockCounting
): StationExtraction {
  // Determine overall status based on both extractions
  let status: "success" | "warning" | "error";
  let message: string | null = null;

  if (sign.status === "error" && stock.status === "error") {
    // Both failed
    status = "error";
    const messages = [
      sign.message ? `Sign: ${sign.message}` : null,
      stock.message ? `Stock: ${stock.message}` : null,
    ].filter(Boolean);
    message = messages.join(". ") || "Both sign and stock extraction failed";
  } else if (sign.status === "error") {
    // Sign failed, stock OK
    status = "warning";
    message = sign.message || "Could not read sign label";
  } else if (stock.status === "error") {
    // Stock failed, sign OK
    status = "warning";
    message = stock.message || "Could not count stock";
  } else if (sign.status === "warning" || stock.status === "warning") {
    // One or both have warnings
    status = "warning";
    const messages = [sign.message, stock.message].filter(Boolean);
    message = messages.join(". ") || null;
  } else {
    // Both succeeded
    status = "success";
    // Include counting method in success message for transparency
    if (stock.countingMethod) {
      message = stock.countingMethod;
    }
  }

  return {
    status,
    message,
    productCode: sign.productCode,
    minQty: sign.minQty,
    maxQty: sign.maxQty,
    onHandQty: stock.onHandQty,
  };
}

/**
 * Extracts station data from sign and stock images using two separate AI calls.
 *
 * - Sign extraction: Simple OCR to read product code, min, max (GPT-4o Mini)
 * - Stock counting: Specialized counting with Gemini 2.5 Flash for accuracy
 *
 * @param signUrl - Blob URL for the station sign image
 * @param stockUrl - Blob URL for the station stock image
 * @param signModelId - Optional model ID for sign extraction
 * @param stockModelId - Optional model ID for stock counting
 * @returns Combined extraction result with productCode, min/max, onHand
 */
export async function extractStation(
  signUrl: string,
  stockUrl: string,
  signModelId?: string,
  stockModelId?: string
): Promise<StationExtraction> {
  if (!signUrl || !stockUrl) {
    throw new Error("Both sign and stock images are required");
  }

  // Run both extractions in parallel for speed
  const [signResult, stockResult] = await Promise.all([
    extractSign(signUrl, signModelId),
    extractStockCount(stockUrl, stockModelId),
  ]);

  // Combine results into single station extraction
  return combineExtractionResults(signResult, stockResult);
}

/**
 * Extracts station data and returns individual results for both sign and stock.
 * Useful when you need access to confidence levels and counting methods.
 */
export async function extractStationDetailed(
  signUrl: string,
  stockUrl: string,
  signModelId?: string,
  stockModelId?: string
): Promise<{
  combined: StationExtraction;
  sign: SignExtraction;
  stock: StockCounting;
}> {
  if (!signUrl || !stockUrl) {
    throw new Error("Both sign and stock images are required");
  }

  const [sign, stock] = await Promise.all([
    extractSign(signUrl, signModelId),
    extractStockCount(stockUrl, stockModelId),
  ]);

  return {
    combined: combineExtractionResults(sign, stock),
    sign,
    stock,
  };
}

/**
 * Safely extracts station data with error handling
 */
export async function safeExtractStation(
  signUrl: string,
  stockUrl: string,
  signModelId?: string,
  stockModelId?: string
): Promise<
  | { success: true; data: StationExtraction }
  | { success: false; error: string }
> {
  try {
    const data = await extractStation(signUrl, stockUrl, signModelId, stockModelId);
    return { success: true, data };
  } catch (error) {
    console.error("Station extraction failed:", error);
    return {
      success: false,
      error:
        error instanceof Error ? error.message : "Unknown extraction error",
    };
  }
}
