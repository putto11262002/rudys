### Scope

#### Goal

Compute an order from the **primary warehouse** that covers the **current session’s delivery demand**, given the **current on-hand loading dock inventory** and **station min/max constraints**.
#### In scope (v1)

* **Session management**
  * Create a new session
  * Resume an incomplete session
  * Move session through states: draft → in-progress → ready-for-order → archived (names can vary)
* **Capture/import Loading List images (per employee)**
  * Take photos of a delivery employee’s phone screen (not screenshots)
  * Bulk upload screenshots (optional input path)
  * Maintain image order as a scroll continuation
* **AI extraction: Loading List → structured demand**
  * Extract **Activities** (`ACT.*`)
  * Extract **Line Items** (product codes like `JOE.*`, `GHA.*`, `ART.*`)
  * Capture optional metadata when present (room/end user/notes)
* **Review extracted demand**
  * Aggregated view: required quantity per canonical product
  * Drill-down view: grouped by employee → activity → line items
  * Ability to mark images invalid and re-capture/re-upload (lightweight correction)
* **Capture/import Loading Dock Inventory Station images**
  * Station **sign photo**: extract product id and min/max
  * Station **stock photo**: estimate current quantity on hand
  * Validate sign ↔ stock photo match (fail if mismatch / low confidence)
* **Calculation**
  * Compute **order quantity per product** required to fulfil **current session demand**
  * Respect station **min/max** constraints
* **Output**
  * Summary table of what to order
  * Copy/paste order text for sending to warehouse (no automated sending in v1)
#### Out of scope (v1)
* “Minimising travels” / route or transport optimization beyond min/max enforcement
* Warehouse/WMS integrations (APIs, syncing inventory, auto-confirmation)
* Automated email sending (output is copy/paste)
* Long-term analytics, forecasting, or replenishment planning beyond the current session
* Ownership/consignment enforcement (captured as info only)

#### Assumptions / constraints
* Inputs include **photos of screens**, so extraction must handle blur/glare/angle/cropping.
* Product identity is driven by codes; the app normalizes codes via a catalog.
* Station signs are readable and include min/max.

---
### Actors
#### Primary actor
* **Coordinator (Order Planner)**
  * Creates/runs sessions
  * Captures/uploads images
  * Reviews extracted results
  * Produces final order summary
#### Secondary actors
* **Delivery Employee**
  * Provides access to their Loading List on phone (for photo capture) or exports screenshots (optional)
#### Downstream actor
* **Warehouse Staff**
  * Receives the order summary and fulfils shipment to the loading dock
#### System “actors” (components)
* **Web App (Next.js, mobile-first)**
* **AI Extraction Service (multimodal LLM)**
* **Temporary Storage**
  * Holds uploaded images during processing/session (implementation decision later)

---
### Glossary

* **Session**: One end-to-end run that produces one order summary.
* **Loading List (Laadlijst)**: Screen listing multiple activities and required products.
* **Activity (`ACT.xxxxxx`)**: Delivery job/group containing multiple product line items.
* **Line Item**: A product entry under an activity (code + description + optional metadata).
* **Product Code**: Identifier like `JOE.002150`, `GHA.000009`, `ART.100013`.
* **Internal Code**: Handling/type code like `THU-BED-HA`, `JOE-TOILETVERH-5`.
* **Room (Kamer)**: Optional destination/room metadata.
* **End User (Eindgebruiker)**: Optional end-user identifier.
* **Ownership / External Party Note**: Informational text such as “Property of Joerns” (not used in v1 calculations).
* **Loading Dock**: Local staging/storage area used before deliveries.
* **Inventory Station**: A physical location/bin/shelf dedicated to one product type.
* **Station Sign**: Label showing product id and min/max limits (and often a reference image).
* **Min/Max**: Lower/upper bounds for the desired dock stock level at that station.
* **On-hand Quantity**: Estimated quantity currently present at a station.
* **Demand**: Aggregated required quantities across all employees’ loading lists in the session.
* **Order Quantity**: Computed quantity to request from the primary warehouse for each product.
* **Primary Warehouse**: Central warehouse supplying the loading dock.
* **Product Catalog**: Your master mapping from all known product codes (`JOE/GHA/ART/...`) to a **Canonical Product ID** plus optional metadata.
* **Canonical Product ID**: Single normalized identifier used for aggregation and ordering regardless of code prefix.
---


