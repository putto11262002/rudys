import { z } from "zod";

/**
 * Loading List Extraction Schema
 *
 * Used with AI SDK generateObject for extracting structured data
 * from Dutch logistics "Laadlijst" (Loading List) screenshots.
 *
 * Schema exactly as specified in note.md
 */

export const WarningSchema = z.object({
  code: z.enum([
    "NOT_LOADING_LIST",
    "LOW_CONFIDENCE",
    "PARTIAL_ITEM_IGNORED",
    "PARTIAL_NOT_RECONCILED",
    "POSSIBLE_DUPLICATE",
    "SEQUENCE_GAP_OR_REORDER",
    "UNREADABLE",
  ]),
  severity: z.enum(["info", "warn", "block"]),
  message: z.string(),
  imageIndex: z.number().int().min(0).optional(),
  lineItemId: z.string().optional(),
});

export const ImageCheckSchema = z.object({
  imageIndex: z.number().int().min(0),
  isLoadingList: z.boolean(),
  loadingListConfidence: z.number().min(0).max(1),
  notLoadingListReason: z.string().optional(),

  // scroll/continuation assessment relative to previous image
  isContinuationOfPrevious: z.boolean().optional(), // omit for imageIndex=0
  continuationConfidence: z.number().min(0).max(1).optional(),
  sequenceNote: z.enum(["ok", "overlap", "gap", "uncertain"]).optional(),
});

export const ActivitySchema = z.object({
  activityCode: z.string(), // e.g., "ACT.1642589"
  room: z.string().optional(),
  endUser: z.string().optional(),
  notes: z.string().optional(), // informational only (e.g., ownership text)
  confidence: z.number().min(0).max(1),
  evidence: z.object({
    firstSeenImageIndex: z.number().int().min(0),
  }),
});

export const LineItemSchema = z.object({
  lineItemId: z.string(), // stable id for referencing warnings/UI
  activityCode: z.string(),

  // capture all codes seen on the row (e.g., JOE.* + GHA.* / ART.*)
  codes: z.array(z.string()).min(1),

  // choose one code as the primary code to aggregate/order by (best guess)
  primaryCode: z.string(),
  primaryCodeConfidence: z.number().min(0).max(1),

  description: z.string().optional(),
  internalCode: z.string().optional(),

  // v1 policy: default 1 unless explicitly shown
  quantity: z.number().int().min(1),

  // partial-row policy
  isPartial: z.boolean(),
  reconciled: z.boolean(), // if isPartial=true and reconciled=false => should be ignored in aggregation

  confidence: z.number().min(0).max(1),

  evidence: z.object({
    imageIndex: z.number().int().min(0),
  }),
});

export const LoadingListExtractionSchema = z.object({
  // one entry per input image, same ordering
  imageChecks: z.array(ImageCheckSchema).min(1),

  // extracted content from loading-list images only
  activities: z.array(ActivitySchema),
  lineItems: z.array(LineItemSchema),

  // indices the model decided to ignore/remove (non-loading list, unreadable, etc.)
  ignoredImages: z.array(
    z.object({
      imageIndex: z.number().int().min(0),
      reason: z.string(),
    })
  ),

  warnings: z.array(WarningSchema),

  // simple rollups useful for UI
  summary: z.object({
    totalLoadingListImages: z.number().int().min(0),
    totalActivities: z.number().int().min(0),
    totalLineItemsCounted: z.number().int().min(0), // count only reconciled items
    totalLineItemsIgnored: z.number().int().min(0), // partial-not-reconciled, unreadable, etc.
  }),
});

// Export TypeScript types inferred from schemas
export type Warning = z.infer<typeof WarningSchema>;
export type ImageCheck = z.infer<typeof ImageCheckSchema>;
export type Activity = z.infer<typeof ActivitySchema>;
export type LineItem = z.infer<typeof LineItemSchema>;
export type LoadingListExtraction = z.infer<typeof LoadingListExtractionSchema>;
