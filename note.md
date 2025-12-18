## 1) Loading List extraction schema (Zod) for `generateObject`

```ts
import { z } from "zod";

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
  sequenceNote: z
    .enum(["ok", "overlap", "gap", "uncertain"])
    .optional(),
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
```

Use it in `generateObject({ schema: LoadingListExtractionSchema, ... })`.

---

## 2) System prompt (Set 1: Loading List extraction)

```text
You are extracting structured data from ordered images of a Dutch logistics app screen called “Laadlijst” (Loading List).

Core tasks:
1) For each image, decide if it is a Loading List screen. Output imageChecks[] with isLoadingList, confidence, and reason if false.
2) Assess whether each image continues the scroll from the previous image. Output isContinuationOfPrevious and continuationConfidence and a sequenceNote (ok/overlap/gap/uncertain).
3) From loading-list images only, extract:
   - Activities identified by codes like “ACT.######”
   - Line items under activities, with product/item codes like “JOE.######”, “GHA.######”, “ART.######”, optional description and internal codes.

Rules:
- If an image is not a Loading List (no “Laadlijst”, no “ACT.” blocks, no product-code rows), mark isLoadingList=false and add it to ignoredImages.
- Quantity: if no explicit quantity is shown, set quantity=1.
- Partial rows: if a product row is cut off, set isPartial=true. Only set reconciled=true if the missing info is clearly completed in the next image(s). If not reconciled, do not count it (include warnings).
- Avoid double-counting across overlapping scroll screenshots. If content overlaps, keep one and warn POSSIBLE_DUPLICATE when uncertain.
- Output must strictly match the provided schema. Do not include extra keys.
```

---

## 3) User prompt template (per employee group)

```text
These images are in scroll order for one employee’s loading list. Extract activities and line items using the rules.

Return:
- imageChecks[] for every image (including non-loading-list images)
- activities[] and lineItems[] from loading-list images only
- ignoredImages[] for removed images
- warnings[] for partial-not-reconciled, duplicates, unreadable, or sequence gaps
- summary counts

Important:
- Default quantity=1 unless explicitly visible.
- Do not count partial line items unless reconciled by the next image(s).
```

And pass images as message parts in order.

On the frontend please use the aisdk react for the frontend hook.

read thses beofre proceed: 
- https://ai-sdk.dev/docs/ai-sdk-core/generating-structured-data
- https://ai-sdk.dev/docs/ai-sdk-ui/object-generation
