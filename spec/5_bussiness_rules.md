## Constraints & Templates (V1)

### 1) Upload constraints (client-side gate)

Applies to **all** image uploads (loading lists, station sign, station stock).

**Allowed MIME types**

* `image/jpeg`, `image/png`, `image/webp`

**Max file size**

* `MAX_FILE_SIZE_MB = 10`

**Orientation**

* `REQUIRE_PORTRAIT = true`
* Portrait rule: `height > width`
* If not portrait: **reject upload** (no Blob upload, no DB write) and show reason.

**Failure behavior (authoritative)**

* On validation fail: show a single-line reason (e.g., `Not portrait`, `File too large`, `Too low resolution`, `Unsupported type`) and do not upload/store.

---

### 2) Extraction constraints (authoritative behaviors)

These govern what counts and what is ignored.

**Loading list image classification**

* If the extractor returns `isLoadingList=false`:

  * Treat the image as **ignored**
  * It contributes **zero** activities/items
  * Surface warning text: `Ignored image: not a loading list`

**Partial item rule**

* If an extracted line item is `isPartial=true`:

  * It is **not counted** unless `reconciled=true`
  * If not reconciled by subsequent screenshot(s): warning text `Partial item not reconciled; not counted`

**Quantity default**

* If no explicit quantity is extractable:

  * `quantity = 1`

**Station matching**

* Station extraction must output `matchStatus ∈ {matched, mismatch, uncertain}`
* Only `matched` is valid for progressing to order review.

---

### 3) Order calculation constraints

**Demand-first formula**

* `recommendedOrderQty = max(0, demandQty - onHandQty)`

**Max warning (non-blocking)**

* If `maxQty != null` and `(onHandQty + recommendedOrderQty) > maxQty`:

  * Do **not** change the recommendation
  * Add warning string: `Exceeds station max (onHand + order > max)`

**Coverage blocking rule**

* You cannot proceed to order review unless, for every demanded product:

  * there is a station capture with `matchStatus="matched"`
  * `onHandQty` is present
  * `maxQty` is present

---

### 4) Copy/paste order text template (authoritative)

**Template**

* Header:

  * `Order Request – Session: {sessionCreatedAtISO}`
  * `Stock location: EB5`
* Body (one line per product, sorted by `productCode` ascending):

  * `{productCode} | Demand={demandQty} | OnHand={onHandQty} | Max={maxQty} | Order={recommendedOrderQty}{warningSuffix}`
* Warning suffix:

  * If warnings exist: ` | WARN: {warnings.join("; ")}`

**Example**

* `Order Request – Session: 2025-12-18T07:32:00Z`
* `Stock location: EB5`
* `GHA.000009 | Demand=3 | OnHand=1 | Max=5 | Order=2`
* `JOE.002150 | Demand=2 | OnHand=2 | Max=2 | Order=0`
* `ART.100011 | Demand=1 | OnHand=0 | Max=0 | Order=1 | WARN: Exceeds station max (onHand + order > max)`

---

### 5) Vercel Blob path conventions + retention

**Path conventions**

* Loading list images:

  * `sessions/{sessionId}/loading-lists/{groupId}/{imageId}.{ext}`
* Station images:

  * `sessions/{sessionId}/stations/{stationCaptureId}/sign.{ext}`
  * `sessions/{sessionId}/stations/{stationCaptureId}/stock.{ext}`

**Retention**

* On `session.completed`: delete all blobs under `sessions/{sessionId}/...`
* On `session.deleted`: delete all blobs under `sessions/{sessionId}/...`
* Deletion is **best-effort**:

  * If blob delete fails, log and continue; DB state still transitions.

---

### 6) Server Action + route contracts (minimal, authoritative)

**Server Actions**

* `createSession() -> { sessionId }`
* `deleteSession(sessionId) -> void`
* `createEmployeeGroup(sessionId) -> { groupId }`
* `reorderImages(groupId, orderedImageIds[]) -> void`
* `deleteImage(imageId) -> void`
* `runLoadingListExtraction(sessionId, groupIds?) -> void` (persists extraction results)
* `approveDemand(sessionId) -> void` (persists demand snapshot; moves status)
* `createStationCapture(sessionId) -> { stationCaptureId }`
* `runStationExtraction(stationCaptureId) -> void` (persists station fields)
* `markCompleted(sessionId) -> void` (moves status; triggers blob cleanup)

**Route Handler**

* `/api/blob/upload`

  * Issues client-upload token and handles upload completion callback
  * On completion: writes/updates DB record with `blobUrl` + metadata

---

