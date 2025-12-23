import { generateObject } from "ai";
import {
  StockCountingSchema,
  type StockCounting,
} from "./schemas/stock-counting";
import { STOCK_COUNTING_SYSTEM_PROMPT, STOCK_COUNTING_USER_PROMPT } from "./prompts";
import { DEFAULT_COUNTING_MODEL } from "./models";

/**
 * Single stock count extraction (internal use).
 */
async function singleExtractStockCount(
  stockUrl: string,
  modelId: string
): Promise<StockCounting> {
  const { object } = await generateObject({
    model: modelId,
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
 * Find consensus from multiple counting results.
 * Returns the count that appears most frequently, or null if no consensus.
 */
function findConsensus(results: StockCounting[]): {
  hasConsensus: boolean;
  consensusCount: number | null;
  result: StockCounting | null;
  allCounts: (number | null)[];
} {
  // Extract valid counts (non-null, non-error)
  const validResults = results.filter(
    (r) => r.status !== "error" && r.onHandQty !== null
  );
  const allCounts = results.map((r) => r.onHandQty);

  if (validResults.length === 0) {
    return { hasConsensus: false, consensusCount: null, result: null, allCounts };
  }

  // Count frequency of each value
  const countFrequency = new Map<number, number>();
  for (const r of validResults) {
    const qty = r.onHandQty!;
    countFrequency.set(qty, (countFrequency.get(qty) || 0) + 1);
  }

  // Find the most common count
  let maxFreq = 0;
  let consensusCount: number | null = null;
  for (const [count, freq] of countFrequency) {
    if (freq > maxFreq) {
      maxFreq = freq;
      consensusCount = count;
    }
  }

  // Need at least 2 agreeing for consensus (majority of 3)
  const hasConsensus = maxFreq >= 2;

  // Find the result with the consensus count (prefer higher confidence)
  let consensusResult: StockCounting | null = null;
  if (hasConsensus && consensusCount !== null) {
    const matchingResults = validResults.filter((r) => r.onHandQty === consensusCount);
    // Sort by confidence: high > medium > low
    const confidenceOrder = { high: 3, medium: 2, low: 1 };
    matchingResults.sort(
      (a, b) =>
        (confidenceOrder[b.confidence] || 0) - (confidenceOrder[a.confidence] || 0)
    );
    consensusResult = matchingResults[0];
  }

  return { hasConsensus, consensusCount, result: consensusResult, allCounts };
}

/**
 * Counts items in a stock photo using consensus voting.
 * Runs 3 parallel extractions and takes majority vote.
 * If no consensus, retries once. If still no consensus, returns best guess with warning.
 *
 * @param stockUrl - Blob URL for the stock photo
 * @param modelId - Optional model ID (defaults to GPT-4o)
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

  // First attempt: 3 parallel calls
  const firstAttempt = await Promise.all([
    singleExtractStockCount(stockUrl, selectedModel).catch(() => null),
    singleExtractStockCount(stockUrl, selectedModel).catch(() => null),
    singleExtractStockCount(stockUrl, selectedModel).catch(() => null),
  ]);

  const validFirstResults = firstAttempt.filter((r): r is StockCounting => r !== null);
  const firstConsensus = findConsensus(validFirstResults);

  console.log(
    `[Stock Count] First attempt: counts=[${firstConsensus.allCounts.join(", ")}], consensus=${firstConsensus.hasConsensus ? firstConsensus.consensusCount : "none"}`
  );

  if (firstConsensus.hasConsensus && firstConsensus.result) {
    return {
      ...firstConsensus.result,
      message: `Consensus count (${firstConsensus.allCounts.join(", ")})${firstConsensus.result.message ? `. ${firstConsensus.result.message}` : ""}`,
    };
  }

  // No consensus - retry with 3 more calls
  console.log("[Stock Count] No consensus, retrying...");

  const secondAttempt = await Promise.all([
    singleExtractStockCount(stockUrl, selectedModel).catch(() => null),
    singleExtractStockCount(stockUrl, selectedModel).catch(() => null),
    singleExtractStockCount(stockUrl, selectedModel).catch(() => null),
  ]);

  const validSecondResults = secondAttempt.filter((r): r is StockCounting => r !== null);
  const allResults = [...validFirstResults, ...validSecondResults];
  const finalConsensus = findConsensus(allResults);

  console.log(
    `[Stock Count] Second attempt: all counts=[${finalConsensus.allCounts.join(", ")}], consensus=${finalConsensus.hasConsensus ? finalConsensus.consensusCount : "none"}`
  );

  if (finalConsensus.hasConsensus && finalConsensus.result) {
    return {
      ...finalConsensus.result,
      message: `Consensus count after retry (${finalConsensus.allCounts.join(", ")})${finalConsensus.result.message ? `. ${finalConsensus.result.message}` : ""}`,
    };
  }

  // Still no consensus after retry - return error or best guess
  if (allResults.length === 0) {
    return {
      status: "error",
      message: "All counting attempts failed",
      onHandQty: null,
      confidence: "low",
      countingMethod: "Failed to count",
    };
  }

  // Return the median count with warning
  const validCounts = allResults
    .map((r) => r.onHandQty)
    .filter((c): c is number => c !== null)
    .sort((a, b) => a - b);

  if (validCounts.length === 0) {
    return {
      status: "error",
      message: "Could not determine count",
      onHandQty: null,
      confidence: "low",
      countingMethod: "No valid counts",
    };
  }

  const medianCount = validCounts[Math.floor(validCounts.length / 2)];
  const medianResult = allResults.find((r) => r.onHandQty === medianCount) || allResults[0];

  return {
    ...medianResult,
    status: "warning",
    confidence: "low",
    message: `No consensus reached. Counts varied: [${finalConsensus.allCounts.join(", ")}]. Using median: ${medianCount}`,
  };
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
