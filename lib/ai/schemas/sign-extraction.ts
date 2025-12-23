import { z } from "zod";

/**
 * Sign Extraction Schema
 *
 * Extracts data from station sign labels (simple OCR task):
 * - Product code (ART.######, JOE.######, GHA.######)
 * - Min quantity
 * - Max quantity
 */

export const SignExtractionSchema = z.object({
  status: z
    .enum(["success", "warning", "error"])
    .describe(
      "'success' = valid label with all data; 'warning' = partial data; 'error' = not a label or unreadable"
    ),

  message: z
    .string()
    .nullable()
    .describe("Explanation for warning/error. Null for success."),

  productCode: z
    .string()
    .nullable()
    .describe("Product code from sign (e.g., ART.100013). Null if unreadable."),

  minQty: z
    .number()
    .int()
    .min(0)
    .nullable()
    .describe("Minimum quantity from sign. Null if unreadable."),

  maxQty: z
    .number()
    .int()
    .min(0)
    .nullable()
    .describe("Maximum quantity from sign. Null if unreadable."),
});

export type SignExtraction = z.infer<typeof SignExtractionSchema>;
