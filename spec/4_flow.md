## Flow 0: Session lifecycle

### 0.1 Create session

* UI: User taps **Start new session**
* Server Action: `createSession()`
* DB: insert `Session { createdAt, status='capturing_loading_lists' }`
* UI result (server-rendered): navigates to `/sessions/:id/loading-lists` showing empty session

### 0.2 Resume session

* UI: user taps a session row
* Server (RSC): query Session + related records
* UI result: renders at the correct step based on `status`

### 0.3 Delete session

* UI: user taps **Delete**
* Server Action: `deleteSession(sessionId)`
* DB: delete session + children (images, extractions, stations, order rows)
* Blob: best-effort delete associated blob keys
* UI result: session removed from list

---

## Flow 1: Loading list capture (employee groups + images)

### 1.1 Create an employee capture group

* UI: **Add employee group**
* Server Action: `createEmployeeGroup(sessionId)`
* DB: insert `EmployeeCaptureGroup { sessionId, status='pending' }`
* UI result: group appears in the list

### 1.2 Add loading list images (client upload to Blob)

This is the key vertical slice.

* UI: user chooses **Camera** or **Upload**
* Client:

  * Validates image constraints (orientation/size/type)
  * If fail: show error and **do not upload**
  * If pass: request an upload token
* Route Handler (NOT server action): `/api/blob/upload`

  * returns token + target pathname/metadata
* Client:

  * uploads file **directly to Vercel Blob**
* Blob callback (same route handler):

  * receives `onUploadCompleted`
* DB (in callback handler):

  * insert `LoadingListImage { groupId, blobUrl, width, height, captureType, orderIndex }`
* UI result (server-rendered refresh/navigation):

  * image list updates with the new image

Alternate paths:

* Upload fails mid-way → client shows retry; no DB record created until callback.
* Callback fails → file exists in Blob but no DB row; mark as “orphan cleanup” (optional) or retry callback logic.

### 1.3 Reorder / remove loading list images

* UI: drag reorder / delete
* Server Action: `reorderImages(groupId, orderedImageIds)` or `deleteImage(imageId)`
* DB: update `orderIndex` or delete row
* Blob: delete on `deleteImage`
* UI result: list updates on next server render

---

## Flow 2: Loading list extraction + demand review

### 2.1 Run extraction (all or subset)

* UI: user taps **Run extraction**
* Server Action: `runLoadingListExtraction(sessionId, groupIds?)`
* Server:

  * reads ordered image URLs from DB
  * calls multimodal extractor
* DB:

  * write `LoadingListExtractionResult` per group
  * update group `status = extracted | needs_attention`
* UI result: server-render shows extraction output + warnings

Alternate paths:

* Extractor fails for a group → group marked `needs_attention`, warnings show error message, other groups can still succeed.
* User edits images then reruns extraction for one group only.

### 2.2 Handling “not loading list” images

* During extraction:

  * if `isLoadingList=false`, that image is **ignored**
* DB: mark image as ignored (either `classification.isLoadingList=false` or store in extraction result’s ignored list)
* UI: show warning “Ignored non-loading-list image(s)”
* Demand aggregation: those images contribute **zero**

### 2.3 Partial reconciliation rule

* During extraction:

  * if a line item is partial and not reconciled by next image(s), mark it unreconciled
* UI: show warning “Partial item not reconciled; not counted”
* Demand aggregation: unreconciled partials contribute **zero**

### 2.4 Approve demand

* UI: user taps **Approve demand**
* Server Action: `approveDemand(sessionId)`
* DB:

  * write `DemandItem[]` snapshot for session
  * set session `status='capturing_inventory'`
* UI result: route to inventory capture

Blocking:

* Cannot approve if demand summary is empty.

---

## Flow 3: Inventory station capture (sign + stock) + station extraction

### 3.1 Create a station capture record

* UI: **Add station**
* Server Action: `createStationCapture(sessionId)`
* DB: insert `StationCapture { sessionId, status='pending' }`
* UI result: station card appears

### 3.2 Upload sign and stock images (client upload to Blob)

Run twice per station: sign then stock.

* UI: user uploads sign photo
* Client: validate constraints → upload to Blob via `/api/blob/upload`
* DB (callback): update station record with `signImageUrl` (or create `StationImage` row)

Repeat for stock photo.

### 3.3 Run station extraction

* UI: user taps **Extract station**
* Server Action: `runStationExtraction(stationCaptureId)`
* Server:

  * calls multimodal extractor with sign+stock URLs
* DB:

  * update `StationCapture` with:

    * `productCode, minQty, maxQty, onHandQty, matchStatus, confidences`
    * `status = valid | needs_attention`
* UI result: station card shows extracted fields and match state

Blocking behavior:

* If `matchStatus != matched` → station is `needs_attention` and blocks moving to order step.

Alternate paths:

* User replaces sign/stock image → reupload → rerun extraction.
* Max missing/unreadable → treat as invalid and block until fixed (per your rule: max required).

---

## Flow 4: Order calculation + completion

### 4.1 Compute order (server-side)

* UI: user navigates to **Review order**
* Server (RSC):

  * loads `DemandItem[]` + `StationCapture[]`
  * computes `OrderItem[]` using formula:

    * `order = max(0, demand - onHand)`
* DB (optional):

  * either compute on read (no storage) or store snapshot `OrderItem[]` on an action

Blocking:

* Cannot enter this screen unless every demanded product has a valid station capture:

  * `matchStatus=matched`
  * `onHandQty != null`
  * `maxQty != null`

Warnings:

* If `onHand + order > max` → warning only, don’t change recommendation.

### 4.2 Mark completed

* UI: user taps **Mark completed**
* Server Action: `markCompleted(sessionId)`
* DB: set `status='completed'`
* Blob: delete images for this session (best effort, can be async later)
* UI result: session shows completed in list

---

## The “different paths” explicitly (quick list)

* Happy path: create session → upload groups → extract → approve → capture stations → extract stations → review order → complete
* Path A: upload wrong photo type → rejected client-side (never stored)
* Path B: non-loading-list images → ignored during extraction, warnings shown
* Path C: partial item never reconciled → not counted + warning
* Path D: station mismatch/uncertain → blocks order step until recapture
* Path E: extraction failure for one group/station → only that unit becomes `needs_attention`, others proceed
* Path F: user resumes later → server render reads DB and continues from `status`

