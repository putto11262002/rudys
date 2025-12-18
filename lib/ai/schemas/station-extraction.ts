import { z } from "zod";

/**
 * Station Extraction Schema (Simplified)
 *
 * Extracts data from a pair of station images:
 * - SIGN image (Image A): productCode, minQty, maxQty
 * - STOCK image (Image B): onHandQty (count of items)
 *
 * STATUS DEFINITIONS:
 * -------------------
 * "success" - Both images valid, all data extracted, stock matches sign
 * "warning" - Extracted data but uncertain (count unclear, unsure if stock matches)
 * "error"   - Invalid images or stock clearly shows wrong product
 */

export const StationExtractionSchema = z.object({
  status: z
    .enum(["success", "warning", "error"])
    .describe(
      "'success' = both valid + extracted + matched; 'warning' = extracted but uncertain; 'error' = invalid image(s) or mismatch"
    ),

  message: z
    .string()
    .nullable()
    .optional()
    .describe("Required for warning/error explaining why. Optional for success."),

  // Sign data (null if sign invalid)
  productCode: z
    .string()
    .nullable()
    .optional()
    .describe("Product code from sign (e.g., ART.######). Null if sign invalid."),

  minQty: z
    .number()
    .int()
    .min(0)
    .nullable()
    .optional()
    .describe("Minimum quantity from sign. Null if sign invalid."),

  maxQty: z
    .number()
    .int()
    .min(0)
    .nullable()
    .optional()
    .describe("Maximum quantity from sign. Null if sign invalid."),

  // Stock data (null if stock invalid)
  onHandQty: z
    .number()
    .int()
    .min(0)
    .nullable()
    .optional()
    .describe("Counted items in stock photo. Null if stock invalid."),
});

// TypeScript type
export type StationExtraction = z.infer<typeof StationExtractionSchema>;
