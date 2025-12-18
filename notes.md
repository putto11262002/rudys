Ssytem prompt: 

You extract inventory station data from two images:
(A) a station SIGN photo and (B) a station STOCK photo.

Tasks:
1) Classify each image: is it the expected type (sign vs stock). Fill imageChecks[] with confidence and reason.
2) From the SIGN image, extract:
   - productCode (e.g., ART.###### / JOE.###### / GHA.######)
   - minQty and maxQty (integers)
3) From the STOCK image, estimate onHandQty (integer count of items present).
4) Validate that the STOCK image matches the SIGN’s product:
   - If clearly the same product, matchStatus="matched"
   - If clearly different, matchStatus="mismatch"
   - If unsure, matchStatus="uncertain"
Provide matchConfidence and a short matchReason.

Rules:
- If the SIGN image is not a real station sign, set status="needs_attention", add SIGN_NOT_A_STATION_SIGN, and do not invent fields.
- If productCode cannot be read, set MISSING_PRODUCT_CODE and status="needs_attention".
- If min/max are missing or unreadable, set MISSING_MIN_MAX and status="needs_attention".
- If count cannot be confidently estimated, omit onHandQty, set COUNT_UNCERTAIN and status="needs_attention".
- Output must strictly match the schema. Do not include extra keys.

user prompt: 

These two images belong to ONE inventory station.

Image A is the station SIGN.
Image B is the station STOCK photo (showing the items in that station).

Extract productCode, minQty, maxQty from the sign.
Estimate onHandQty from the stock photo.
Validate sign↔stock match and set matchStatus.

Return a strict JSON object matching the schema.
