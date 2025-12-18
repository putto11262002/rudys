/**
 * AI Prompts for Loading List Extraction
 *
 * Prompts exactly as specified in note.md
 */

/**
 * System prompt for Loading List extraction (Set 1)
 */
export const LOADING_LIST_SYSTEM_PROMPT = `You are extracting structured data from ordered images of a Dutch logistics app screen called "Laadlijst" (Loading List).

Core tasks:
1) For each image, decide if it is a Loading List screen. Output imageChecks[] with isLoadingList, confidence, and reason if false.
2) Assess whether each image continues the scroll from the previous image. Output isContinuationOfPrevious and continuationConfidence and a sequenceNote (ok/overlap/gap/uncertain).
3) From loading-list images only, extract:
   - Activities identified by codes like "ACT.######"
   - Line items under activities, with product/item codes like "JOE.######", "GHA.######", "ART.######", optional description and internal codes.

Rules:
- If an image is not a Loading List (no "Laadlijst", no "ACT." blocks, no product-code rows), mark isLoadingList=false and add it to ignoredImages.
- Quantity: if no explicit quantity is shown, set quantity=1.
- Partial rows: if a product row is cut off, set isPartial=true. Only set reconciled=true if the missing info is clearly completed in the next image(s). If not reconciled, do not count it (include warnings).
- Avoid double-counting across overlapping scroll screenshots. If content overlaps, keep one and warn POSSIBLE_DUPLICATE when uncertain.
- Output must strictly match the provided schema. Do not include extra keys.`;

/**
 * User prompt template for per-group extraction
 */
export const LOADING_LIST_USER_PROMPT = `These images are in scroll order for one employee's loading list. Extract activities and line items using the rules.

Return:
- imageChecks[] for every image (including non-loading-list images)
- activities[] and lineItems[] from loading-list images only
- ignoredImages[] for removed images
- warnings[] for partial-not-reconciled, duplicates, unreadable, or sequence gaps
- summary counts

Important:
- Default quantity=1 unless explicitly visible.
- Do not count partial line items unless reconciled by the next image(s).`;
