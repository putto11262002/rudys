import { z } from "zod";

/**
 * Stock Counting Schema
 *
 * Counts physical items in warehouse stock photos.
 * Uses specialized counting strategies for accurate inventory.
 */

export const StockCountingSchema = z.object({
  status: z
    .enum(["success", "warning", "error"])
    .describe(
      "'success' = counted items; 'warning' = counted but uncertain; 'error' = cannot count"
    ),

  message: z
    .string()
    .nullable()
    .describe("Note any uncertainty or issues. Null if none."),

  onHandQty: z
    .number()
    .int()
    .min(0)
    .nullable()
    .describe("Count of items visible in the stock photo. Null if cannot count."),

  confidence: z
    .enum(["high", "medium", "low"])
    .describe("Confidence in the count: high = clear, medium = some overlap, low = estimate"),

  countingMethod: z
    .string()
    .describe("Brief description of how items were counted (e.g., 'Counted 3 rows of 2 beds')"),
});

export type StockCounting = z.infer<typeof StockCountingSchema>;
