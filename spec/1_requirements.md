## Requirements

### Guiding principle for v1

* v1 computes **what to order to fulfill current delivery demand** from collected Loading List photos, using current dock inventory (station sign min/max + on-hand count).
* **Quantity rule:** if no explicit quantity is present, treat each extracted line item as **qty = 1**.
* **Station max rule:** prioritize fulfilling demand; **warn** if the recommended order would cause `on_hand + order > max`.

---

## Functional requirements

### Session management

* **FR-1 Create session (MUST):** User can start a new session; session is automatically identified/named by **created-at datetime**.
* **FR-2 Resume session (MUST):** User can see incomplete sessions and continue one.
* **FR-3 Session status (MUST):** Session has statuses: `draft` → `capturing_loading_lists` → `review_demand` → `capturing_inventory` → `review_order` → `completed`.
* **FR-4 Delete session (SHOULD):** User can delete a session and associated uploads.

### Storage

* **FR-5 Image storage (MUST):** All uploaded/captured images are stored in **Vercel Blob** for the session lifecycle.
* **FR-6 Retention (SHOULD):** Images are deleted from Blob when a session is `completed` or `deleted` (unless explicitly configured otherwise).

### Loading list capture

* **FR-7 Add employee capture group (MUST):** User can create a capture group for one employee’s loading list.
* **FR-8 Add images (MUST):** User can add multiple images via camera capture or bulk upload.
* **FR-9 Order management (MUST):** Images are stored in scroll order; user can reorder and remove images.
* **FR-10 Upload validation (MUST):** On upload, validate basic constraints (e.g., required orientation/size). If invalid: **reject and do not store**, show failure reason.

### Loading list extraction

* **FR-11 Trigger extraction (MUST):** User can run AI extraction for all employee groups (or a selected subset).
* **FR-12 Loading-list detection (MUST):** AI determines whether an image is a loading-list screen. Non-loading-list images are **ignored and removed** from the dataset with a warning.
* **FR-13 Structured output (MUST):** Extraction outputs activities (`ACT.*`) and line items with product codes + optional metadata (room/end user/notes) and confidence.
* **FR-14 Quantity rule (MUST):** If quantity is not explicitly extractable, default each line item to **qty = 1**.
* **FR-15 Partial reconciliation (MUST):** Ignore partial items. If a partial item cannot be reconciled/confirmed by the next screenshot(s), flag a warning and **do not count** it.

### Demand review

* **FR-16 Demand summary view (MUST):** Show aggregated required quantity per product code for the session.
* **FR-17 Drill-down (MUST):** Show extracted details grouped by employee → activity → line items, matching source order.
* **FR-18 Re-run extraction (SHOULD):** User can replace/remove images in a subset and re-run extraction for only that subset.

### Inventory station capture

* **FR-19 Add station entry (MUST):** User captures inventory per station as a pair: (A) sign photo, (B) stock photo.
* **FR-20 Sign extraction (MUST):** Extract `product_code`, `min`, `max` (and optional label text) from sign photo.
* **FR-21 Stock counting (MUST):** Estimate `on_hand_count` from stock photo with confidence scoring.
* **FR-22 Matching validation (MUST):** Validate sign photo and stock photo refer to the same product; if mismatch/uncertain, station entry is blocked until corrected.
* **FR-23 Coverage guidance (MUST):** App indicates which demanded products are missing a valid station entry.
* **FR-24 Completion condition (MUST):** By default, block moving to order review until all demanded products have valid station entries (override is optional later).

### Order calculation

* **FR-25 Compute order quantities (MUST):** For each product code with demand and a station entry, compute recommended order.
* **FR-26 Demand-first rule (MUST):** Base recommendation on fulfilling demand: `order = max(0, demand - on_hand)`.
* **FR-27 Max warning (MUST):** If `on_hand + order > max`, still recommend demand-first order but show a **warning** (“Exceeds station max”).
* **FR-28 Missing data handling (MUST):** If a demanded product lacks a valid station entry, block order review by default (per FR-24).

### Output

* **FR-29 Order summary table (MUST):** Show per product: `product_code`, `demand`, `on_hand`, `min`, `max`, `recommended_order`, `warnings/notes`.
* **FR-30 Copy/paste order text (MUST):** Generate a formatted message/email body for ordering from the primary warehouse.
* **FR-31 Export (COULD):** CSV export.

---

## Non-functional requirements

### Usability

* **NFR-1:** Mobile-first flow; minimal taps for capture and review.
* **NFR-2:** Errors/warnings are specific to the image/station causing them and describe required corrective action.

### Performance & reliability

* **NFR-3:** Extraction is scoped (per employee group / per station) so partial failures don’t block all progress.
* **NFR-4:** Session state persists across refresh (images in Blob; state stored server-side or in durable store).

### Data handling

* **NFR-5:** Images are treated as sensitive; delete on session completion/deletion (FR-6).
* **NFR-6:** Only the configured AI provider(s) and Blob storage handle image data.

### Observability

* **NFR-7:** Log extraction requests/results (including confidence and failure reasons) sufficient to debug misreads and validation failures.
---
