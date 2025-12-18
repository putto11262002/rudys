
### T1 — Sessions list + create/resume/delete

**Refs:** Flow0.1–0.3, FR-1..FR-4, NFR-4

* UI (RSC): `/` shows sessions (createdAt + status), actions Open/Delete, CTA Start new session
* Server Actions: `createSession`, `deleteSession`
* DB: Session table + basic status transitions
* Done when: can create a session (named by datetime), open it, delete it, list updates server-rendered

---

### T2 — Vercel Blob client upload plumbing (token + callback) + DB write ✅

**Refs:** Constraints §1 (Upload constraints), Constraints §5 (Blob paths), Constraints §6 (/api/blob/upload), Flow1.2

* ~~Route Handler: `/api/blob/upload` (token generation + `onUploadCompleted`)~~ → Changed to server-side upload via `put()` for cache revalidation support
* DB: store blobUrl + metadata on upload
* Blob pathing: implement conventions under `sessions/{sessionId}/loading-lists/{groupId}/...`
* Done when: ~~client can upload a test image directly to Blob and callback creates a DB row~~ → server action uploads images to Blob and creates DB rows

---

### T3 — Screen 2 loading-list capture (groups + images) end-to-end ✅

**Refs:** Flow1.1–1.3, FR-7..FR-10, FR-5..FR-6, Constraints §1, Constraints §5, NFR-1

* UI (RSC): `/sessions/:id/loading-lists` shows groups with image thumbnails
* Client: `CaptureCard` validates files (5MB max, jpeg/png/webp) before upload
* Server Actions: `createEmployeeGroup`, `uploadGroupImage`, `finalizeGroup`, `deleteEmployeeGroup`
* Blob cleanup: delete blobs on group/session deletion
* Done when: can add groups, upload multiple images (parallel), delete groups, all persisted via server-render

---

### T4 — Loading-list extraction Server Action + persistence

**Refs:** Flow2.1–2.3, FR-11..FR-15, Constraints §2

* Endpoint: '/extract/loading-list'
* Server: fetch blob URLs in scroll order; call multimodal; store `LoadingListExtractionResult` + group status
* Enforce: ignore non-loading-list images, partial reconciliation behavior per **Constraints §2**
* Done when: extraction produces activities/lineItems + ignored images + warnings persisted in DB

---

### T5 — Screen 3 demand review + approve (snapshot)

**Refs:** Flow2.4, FR-16..FR-18, FR-14, Constraints §2 (qty=1), NFR-2

* UI (RSC): `/sessions/:id/demand` shows aggregated demand + drilldown per group/activity
* Server: compute `DemandItem[]` from reconciled items (qty=1 default)
* Server Action: `approveDemand(sessionId)` persists demand snapshot + status transition
* Done when: approve is blocked on empty demand; approved demand is stored and stable

---

### T6 — Screen 4 station capture (sign+stock) upload + station records

**Refs:** Flow3.1–3.2, FR-19, Constraints §1, §5

* UI (RSC): `/sessions/:id/inventory` list demanded products + coverage state; create station capture
* Client upload: sign + stock images via Blob client upload route
* Server Action: `createStationCapture(sessionId)`
* Done when: stations exist, each can hold two images with blob URLs persisted

---

### T7 — Station extraction Server Action + blocking match state

**Refs:** Flow3.3, FR-20..FR-24, Constraints §2 (matchStatus), Constraints §3 (coverage blocking), NFR-2

* Server Action: `runStationExtraction(stationCaptureId)`
* Persist: productCode, min, max, onHand, matchStatus, confidence, warnings
* UI: surface mismatch/uncertain and require recapture to reach valid
* Done when: invalid stations block progress; valid stations satisfy coverage rules

---

### T8 — Screen 5 order review (compute) + max warnings + order text

**Refs:** Flow4.1, FR-25..FR-30, Constraints §3 (formula + max warn), Constraints §4 (template)

* UI (RSC): `/sessions/:id/order` shows table computed from demand snapshot + station values
* Enforce gate: cannot enter unless coverage blocking rule is satisfied
* Generate copy/paste text exactly per **Constraints §4**
* Done when: demand-first order computed, max warning shown, order text matches template

---

### T9 — Completion + Blob cleanup (best-effort)

**Refs:** Flow4.2, FR-6, Constraints §5 (retention), NFR-5

* Server Action: `markCompleted(sessionId)` sets status completed
* Cleanup: delete blobs under `sessions/{sessionId}/...` best-effort; log failures
* Done when: session completes, blobs are attempted-deleted, UI shows completed

---

### T10 — Error handling + observability pass (thin but explicit)

**Refs:** NFR-2, NFR-3, NFR-7, Flow2/Flow3 failure paths

* Add consistent error surfaces: extraction failure per group/station → `needs_attention`
* Logging: store extraction request/response metadata (timings, warnings, counts)
* Done when: partial failures don’t block whole session; logs exist to debug

---

### T11 — Minimal test harness (golden flows)

**Refs:** FR-11..FR-15, FR-20..FR-24, Constraints §2–§4

* Unit tests: aggregation (qty=1 + partial unreconciled ignored), order calc, max warning
* Smoke test: end-to-end “happy path” and one “station mismatch blocks” scenario
* Done when: tests prevent regressions in the rules agents will implement literally

