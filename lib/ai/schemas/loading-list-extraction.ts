import { z } from "zod";

/**
 * Simplified Loading List Extraction Schema
 *
 * Atomic operation: either succeeds, warns, or fails entirely.
 * The AI handles deduplication internally.
 *
 * STATUS DEFINITIONS:
 * -------------------
 * "success" - Clean extraction, all data extracted
 * "warning" - Extraction completed but with caveats (some images skipped, low confidence)
 * "error"   - Cannot extract meaningful data (not loading lists, unreadable)
 *
 * WHAT MAKES AN ITEM "COMPLETE":
 * ------------------------------
 * If we can read the product code (primaryCode), we have a complete item.
 * Quantity defaults to 1 if not visible. Everything else is optional metadata.
 */

export const ActivitySchema = z.object({
  /** Activity code, e.g., "ACT.1642535" */
  activityCode: z.string(),
});

export const LineItemSchema = z.object({
  /** Parent activity code */
  activityCode: z.string(),

  /** Primary product code (JOE.*, GHA.*, ART.*) - REQUIRED for aggregation */
  primaryCode: z.string(),

  /** Secondary code if present on the same row (optional) */
  secondaryCode: z.string().optional(),

  /** Product description (optional) */
  description: z.string().optional(),

  /** Internal/SKU code e.g., THU-BED-HA (optional) */
  internalCode: z.string().optional(),

  /** Quantity - default 1 if not shown */
  quantity: z.number().int().min(1),

  /** Room assignment (optional) */
  room: z.string().optional(),

  /** End user (optional) */
  endUser: z.string().optional(),
});

export const LoadingListExtractionSchema = z.object({
  /** Extraction status */
  status: z.enum(["success", "warning", "error"]),

  /** Message explaining warning/error (optional for success) */
  message: z.string().optional(),

  /** Extracted activities */
  activities: z.array(ActivitySchema),

  /** Extracted line items (deduplicated) */
  lineItems: z.array(LineItemSchema),

  /** Summary statistics */
  summary: z.object({
    totalImages: z.number().int().min(0),
    validImages: z.number().int().min(0),
    totalActivities: z.number().int().min(0),
    totalLineItems: z.number().int().min(0),
  }),
});

// TypeScript types
export type Activity = z.infer<typeof ActivitySchema>;
export type LineItem = z.infer<typeof LineItemSchema>;
export type LoadingListExtraction = z.infer<typeof LoadingListExtractionSchema>;
