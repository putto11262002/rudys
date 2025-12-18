## Data model (v1) 

### 1) Session **(PERSISTED)**

Represents one end-to-end run that produces one order summary.

* `id` (uuid)
* `createdAt` (datetime)
* `status` (enum)
  `draft | capturing_loading_lists | review_demand | capturing_inventory | review_order | completed`
* `issueLog` (array of simple objects) *(optional)*
  `[{ severity: "info|warn|block", code: string, message: string, refType?: string, refId?: string }]`

---

### 2) EmployeeCaptureGroup **(PERSISTED)**

One delivery employee’s loading list capture set.

* `id` (uuid)
* `sessionId` (uuid)
* `employeeLabel` (string, optional)  *(e.g., “Driver 1”)*
* `status` (enum)
  `pending | extracted | needs_attention`
* `images` (array of `LoadingListImage`) *(stored as rows or embedded references)*
* `extraction` (`LoadingListExtractionResult` | null)

---

### 3) LoadingListImage **(PERSISTED)**

A single uploaded/captured image for a loading list.

* `id` (uuid)
* `groupId` (uuid)
* `blobUrl` (string) *(Vercel Blob)*
* `captureType` (enum) `camera_photo | uploaded_file`
* `orderIndex` (int) *(scroll order)*
* `width` (int)
* `height` (int)
* `uploadedAt` (datetime)
* `uploadValidation`

  * `passed` (bool)
  * `reason` (string | null)
* `aiClassification` *(filled after extraction)*

  * `isLoadingList` (bool)
  * `confidence` (0..1)
  * `reason` (string | null)
* `issues` (array of inline issue objects, optional)

---

### 4) LoadingListExtractionResult **(PERSISTED)**

AI output for one employee capture group.

* `groupId` (uuid)
* `activities` (array of `Activity`)
* `lineItems` (array of `LineItem`)
* `ignoredImages` (array of `{ imageId: uuid, reason: string }`)
* `issues` (array of inline issue objects)
* `extractedAt` (datetime)

---

### 5) Activity **(PERSISTED as part of extraction result)**

Represents one `ACT.*` banner and metadata.

* `id` (uuid)
* `activityCode` (string) *(e.g., `ACT.1642589`)*
* `meta` (optional)

  * `room` (string | null)
  * `endUser` (string | null)
  * `notes` (string | null) *(ownership notes informational only)*
* `issues` (array of inline issue objects, optional)

---

### 6) LineItem **(PERSISTED as part of extraction result)**

A required product under an activity.

* `id` (uuid)
* `activityCode` (string)
* `productCode` (string) *(e.g., `JOE.002150`, `GHA.000009`, `ART.100011`)*
* `description` (string | null)
* `internalCode` (string | null)
* `quantity` (int) *(default 1 when not explicit)*
* `confidence` (0..1)
* `isPartial` (bool)
* `reconciled` (bool) *(true only if partial was confirmed by next screenshot(s))*
* `sourceImageIds` (uuid[]) *(enough to trace back without a separate Evidence model)*
* `issues` (array of inline issue objects, optional)

---

### 7) DemandItem (session-level demand aggregation) **(APPLICATION-LEVEL / DERIVED)**

Computed from all groups’ extracted `LineItem`s.

* `productCode` (string)
* `demandQty` (int) *(sum of reconciled line items; qty defaults to 1)*
* `sources` (array of `{ groupId: uuid, activityCode: string, lineItemId: uuid }`)
* `warnings` (string[], optional)

> Persist only if you later support manual edits that must survive recompute.

---

### 8) StationCapture **(PERSISTED)**

Inventory capture for one dock station (sign + stock photo + extraction result).

* `id` (uuid)
* `sessionId` (uuid)
* `signImage` (`StationImage`)
* `stockImage` (`StationImage`)
* `productCode` (string | null)
* `minQty` (int | null)
* `maxQty` (int | null)
* `onHandQty` (int | null)
* `confidence`

  * `sign` (0..1)
  * `stockCount` (0..1)
  * `match` (0..1)
* `matchStatus` (enum) `matched | mismatch | uncertain`
* `status` (enum) `pending | valid | needs_attention`
* `issues` (array of inline issue objects)

---

### 9) StationImage **(PERSISTED)**

Shared structure for station sign/stock images.

* `id` (uuid)
* `blobUrl` (string)
* `captureType` (enum) `camera_photo | uploaded_file`
* `width` (int)
* `height` (int)
* `uploadedAt` (datetime)
* `uploadValidation` *(optional; same pattern as loading list images)*

---

### 10) OrderItem (final output row) **(APPLICATION-LEVEL / DERIVED; optional snapshot persistence)**

Computed from `DemandItem[]` + `StationCapture[]`.

* `productCode` (string)
* `demandQty` (int)
* `onHandQty` (int)
* `minQty` (int | null)
* `maxQty` (int | null)
* `recommendedOrderQty` (int)
  `max(0, demandQty - onHandQty)`
* `warnings` (string[]) *(include “exceeds max” if `onHandQty + recommendedOrderQty > maxQty`)*

> If you want an immutable “final record,” persist an `OrderSnapshot` (array of `OrderItem`s) on session completion; otherwise recompute each time.

---

### Inline “Issue object” format (used everywhere, not a standalone model)

`{ severity: "info|warn|block", code: string, message: string, refType?: string, refId?: string }`
