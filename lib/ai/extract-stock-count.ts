import { generateObject } from "ai";
import {
  StockCountingSchema,
  type StockCounting,
} from "./schemas/stock-counting";
import { STOCK_COUNTING_SYSTEM_PROMPT, STOCK_COUNTING_USER_PROMPT } from "./prompts";
import { DEFAULT_COUNTING_MODEL } from "./models";

/**
 * Counts items in a stock photo using specialized counting strategies.
 * Uses Gemini 2.5 Flash for best counting accuracy.
 *
 * @param stockUrl - Blob URL for the stock photo
 * @param modelId - Optional model ID (defaults to Gemini 2.5 Flash)
 * @returns Stock counting result with onHandQty, confidence, countingMethod
 */
export async function extractStockCount(
  stockUrl: string,
  modelId?: string
): Promise<StockCounting> {
  if (!stockUrl) {
    throw new Error("Stock image URL is required");
  }

  const selectedModel = modelId || DEFAULT_COUNTING_MODEL;

  const { object } = await generateObject({
    model: selectedModel,
    schema: StockCountingSchema,
    schemaName: "StockCounting",
    schemaDescription: "Counted items from warehouse stock photo",
    messages: [
      { role: "system", content: STOCK_COUNTING_SYSTEM_PROMPT },
      {
        role: "user",
        content: [
          { type: "text", text: STOCK_COUNTING_USER_PROMPT },
          { type: "image", image: stockUrl },
        ],
      },
    ],
  });

  return object;
}

/**
 * Safely counts stock with error handling
 */
export async function safeExtractStockCount(
  stockUrl: string,
  modelId?: string
): Promise<
  | { success: true; data: StockCounting }
  | { success: false; error: string }
> {
  try {
    const data = await extractStockCount(stockUrl, modelId);
    return { success: true, data };
  } catch (error) {
    console.error("Stock counting failed:", error);
    return {
      success: false,
      error: error instanceof Error ? error.message : "Unknown counting error",
    };
  }
}
