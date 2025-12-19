# Implementation Checklist

## Architecture Migration - Hono + React Query

### Status: Complete

### Migration Summary

Migrated from Next.js Server Actions + `unstable_cache` to:
- **Hono** for API routes with RPC for end-to-end type safety
- **React Query** for client-side state management, caching, and data fetching
- **All client components** (UI unchanged)

### Directory Structure

```
app/
  api/
    [...route]/
      route.ts      # Main Hono router, exports AppType
      _sessions.ts  # Session API routes
      _groups.ts    # Group API routes
      _extraction.ts# Extraction API routes
  providers.tsx     # QueryClientProvider wrapper

hooks/
  sessions/
    use-sessions.ts # useSessions, useSession, useCreateSession, useDeleteSession, useUpdateSessionStatus
    query-keys.ts   # sessionKeys factory
    index.ts        # Re-exports
  groups/
    use-groups.ts   # useGroups, useCreateGroupWithImages, useDeleteGroup
    query-keys.ts   # groupKeys factory
    types.ts        # GroupWithImages type
    index.ts        # Re-exports
  extraction/
    use-extraction.ts # useExtractionResult, useExtractGroup
    query-keys.ts     # extractionKeys factory
    index.ts          # Re-exports

lib/
  api/
    client.ts       # Hono RPC client
```

### Key Patterns

**Hono RPC:**
- Routes MUST be chained (`.get().post().delete()`) for type inference
- Export type from chained result: `export type AppType = typeof routes`
- Route aggregation: `app.route('/path', subRoutes)`

**React Query:**
- Query key factories for consistent cache keys
- `useQuery` for data fetching
- `useMutation` for mutations with cache invalidation in `onSuccess`

**Separation of Concerns:**
- Hooks ONLY handle cache invalidation - NO UI concerns (toasts, navigation)
- UI side effects handled in components via `mutate(..., { onSuccess: () => toast(...) })`

### Removed Files

- `lib/actions/` - Server actions (sessions.ts, groups.ts, extraction.ts, types.ts)
- `lib/data/` - Data loaders (sessions.ts, groups.ts, extraction.ts)

---

## T1 - Sessions list + create/resume/delete

### Status: Complete

### Implementation Summary

**Database:**
- Schema: `lib/db/schema.ts` - Session table with status enum
- Connection: `lib/db/index.ts` - Neon serverless + Drizzle ORM
- Config: `drizzle.config.ts` - Drizzle Kit configuration

**API Routes:** `app/api/[...route]/_sessions.ts`
- GET `/api/sessions` - List all sessions
- GET `/api/sessions/:id` - Get single session
- POST `/api/sessions` - Create session
- DELETE `/api/sessions/:id` - Delete session + cleanup blobs
- PATCH `/api/sessions/:id/status` - Update session status

**React Query Hooks:** `hooks/sessions/`
- `useSessions()` - List sessions query
- `useSession(id)` - Single session query
- `useCreateSession()` - Create mutation
- `useDeleteSession()` - Delete mutation with cache invalidation
- `useUpdateSessionStatus()` - Status update mutation

**UI:**
- Home page: `app/page.tsx` - Client component with React Query
- Delete button: `app/delete-session-button.tsx` - AlertDialog confirmation + toast
- Session route: `app/sessions/[id]/page.tsx` - Client component with redirect
- Loading lists stub: `app/sessions/[id]/loading-lists/page.tsx` - Client component

**Dependencies added:**
- `drizzle-orm`, `@neondatabase/serverless` - DB
- `zod` - Validation
- `sonner` - Toasts
- `hono`, `@hono/zod-validator` - API routes
- `@tanstack/react-query`, `@tanstack/react-query-devtools` - State management

### Setup Required
1. Create `.env.local` with `DATABASE_URL` (see `.env.example`)
2. Run `bun run db:push` to sync schema to Neon

### Key Patterns
- API routes return JSON with error field on failure
- Cache invalidation via React Query `invalidateQueries`
- Empty state: `Empty` component from shadcn
- Loading state: Skeleton cards matching actual UI structure

---

## T2 - Vercel Blob upload plumbing
### Status: Complete

### Implementation Summary

**Refs:** Constraints §1, §5, Flow1.2

**Note:** Server-side upload via Hono API route using `put()` from `@vercel/blob`. Images sent as base64 in JSON body.

**Database:** `lib/db/schema.ts`
- `employeeCaptureGroups` - Table (id, sessionId, employeeLabel, status, createdAt)
- `loadingListImages` - Table (id, groupId, blobUrl, captureType, orderIndex, width, height, uploadedAt, validation fields, AI classification fields)
- Drizzle relations for relational queries

**Dependencies:**
- `@vercel/blob` - Server-side `put()` and `del()` functions

### Environment Variables
- `BLOB_READ_WRITE_TOKEN` - Vercel Blob token (required)

### Key Patterns
- Server-side upload via `put()` in Hono API route
- Images sent as base64 in JSON body from client
- Blob paths: `sessions/{sessionId}/loading-lists/{groupId}/{uuid}.{ext}`
- Cache invalidation via React Query after uploads

---

## T3 - Loading list capture
### Status: Complete

### Implementation Summary

**Refs:** Flow1.1–1.3, FR-7..FR-10, FR-5..FR-6, Constraints §1, §5, NFR-1

**Database:** `lib/db/schema.ts`
- Drizzle relations for `sessions`, `employeeCaptureGroups`, `loadingListImages`
- Enables relational queries with `with: { images: ... }`

**API Routes:** `app/api/[...route]/_groups.ts`
- GET `/api/sessions/:sessionId/groups` - List groups with images
- POST `/api/sessions/:sessionId/groups` - Create group with base64 images (batch upload)
- DELETE `/api/groups/:id` - Delete group + cleanup blobs

**React Query Hooks:** `hooks/groups/`
- `useGroups(sessionId)` - List groups query
- `useCreateGroupWithImages()` - Create group with images mutation
- `useDeleteGroup()` - Delete mutation with cache invalidation

**Types:** `hooks/groups/types.ts`
- `GroupWithImages` - Group with images and extraction result

**UI Components:** `app/sessions/[id]/loading-lists/_components/`
- `capture-card.tsx` - Local image capture with camera/upload, client-side validation (5MB max, jpeg/png/webp), batch upload on "Confirm"
- `group-card.tsx` - Read-only display of completed groups with image thumbnails
- `group-list-client.tsx` - Client wrapper managing capture state, dynamic import of CaptureCard
- `delete-group-button.tsx` - Deletes group with AlertDialog confirmation

**Config:** `next.config.ts`
- `images.remotePatterns` - Allows Vercel Blob images

### Key Patterns
- **Batch upload** - All images sent in single API request as base64
- **Local state until "Confirm"** - Images stored as File objects with preview URLs, uploaded on submit
- **Client-side validation** - 5MB max, jpeg/png/webp only, validated before adding to local state
- **Blob cleanup on delete** - Both group and session deletion clean up associated blobs
- **Cache invalidation** - React Query `invalidateQueries` after mutations
- **Dynamic import** - `CaptureCard` loaded with `ssr: false` to avoid hydration issues

### User Flow
1. User clicks "Add Loading List" → shows CaptureCard
2. User captures/uploads images → stored locally with preview, validated (5MB, jpeg/png/webp)
3. User clicks "Confirm" → creates group → uploads images → shows success toast
4. User can add more groups or "Continue to Review"
5. User can delete groups → confirmation dialog → deletes group + all blobs

---

## T4 - Loading-list extraction API + persistence
### Status: Complete (Simplified)

### Implementation Summary

**Refs:** Flow2.1–2.3, FR-11..FR-15, Constraints §2

**Dependencies added:**
- `ai@5.0.115` - Vercel AI SDK core
- `@ai-sdk/react` - React hooks for streaming

### Environment Variables
- `AI_GATEWAY_API_KEY` - Required for Vercel AI Gateway

### Simplified Schema Design

**Core Principle:** If we can read the product code, we have a complete item.

Required fields for demand:
- `primaryCode` (product ID like JOE.023596)
- `quantity` (default 1)
- `activityCode` (parent ACT.*)

Everything else is optional metadata.

**Database:** `lib/db/schema.ts`
- `loadingListExtractionResults` - Simplified table:
  - `id`, `groupId` (FK), `extractedAt`
  - `status` (text) - "success" | "warning" | "error"
  - `message` (text) - Explanation for warning/error
  - `activities` (jsonb) - Array of { activityCode }
  - `lineItems` (jsonb) - Array of line items
  - `summary` (jsonb) - { totalImages, validImages, totalActivities, totalLineItems }

**Zod Schemas:** `lib/ai/schemas/loading-list-extraction.ts`
- `ActivitySchema` - Just { activityCode }
- `LineItemSchema` - { activityCode, primaryCode, quantity, + optional fields }
- `LoadingListExtractionSchema` - { status, message?, activities, lineItems, summary }

**AI Prompts:** `lib/ai/prompts.ts`
- Simplified prompts focusing on:
  - Product code extraction (required)
  - Quantity (default 1)
  - Deduplication (handled internally)

**API Routes:**
- `app/api/[...route]/_extraction.ts` - Hono route for sync extraction
- `app/api/extract-stream/route.ts` - Next.js route for streaming extraction

**React Query Hooks:** `hooks/extraction/`
- `useExtractionResult(groupId)` - Get extraction result
- `useExtractGroup()` - Sync extraction mutation
- `useStreamingExtraction()` - Streaming extraction with partial results

**UI Components:**
- `group-list-client.tsx` - Manages streaming extraction state, passes partial results to GroupCard
- `capture-card.tsx` - Handles image capture/upload only, triggers extraction via parent
- `group-card.tsx` - Collapsible shows streaming partial results in real-time during extraction
- `demand/page.tsx` - Aggregates demand, skips error groups

### Atomic Status Model

| Status | Meaning | Data Included |
|--------|---------|---------------|
| **success** | All images valid, extracted cleanly | Yes |
| **warning** | Extracted with issues | Yes (review recommended) |
| **error** | Cannot extract meaningful data | No |

### Demand Calculation
1. Skip groups with `status === "error"`
2. Count all line items from success/warning groups
3. Aggregate by `primaryCode` across all groups

### User Flow
1. User adds loading list images → clicks "Confirm"
2. Images upload → group appears in list → streaming extraction starts
3. Group card collapsible opens with live partial results (activities, items appear in real-time)
4. On complete → final status badge (green/yellow/red)
5. Demand page aggregates all successful extractions

---

## T5 - Demand review + approve (snapshot)
### Status: Complete

### Implementation Summary

**Refs:** Flow2.4, FR-16..FR-18, FR-14, Constraints §2 (qty=1), NFR-2

**Design Decision:** Irreversible workflow - once demand is approved, loading lists become read-only. No going back.

**Database:** `lib/db/schema.ts`
- `demandSnapshots` - Table for frozen demand at approval time:
  - `id`, `sessionId` (FK, unique), `approvedAt`
  - `items` (jsonb) - Array of `DemandItemJson`
  - `totalProducts`, `totalQuantity` - Summary stats
- `DemandItemJson` type: `{ productCode, demandQty, description?, sources[] }`

**API Routes:** `app/api/[...route]/_demand.ts`
- GET `/api/sessions/:sessionId/demand` - Get demand (computed or snapshot)
- POST `/api/sessions/:sessionId/demand/approve` - Approve demand

**React Query Hooks:** `hooks/demand/`
- `useDemand(sessionId)` - Query for demand data
- `useApproveDemand()` - Mutation for approval

**UI:** `app/sessions/[id]/demand/page.tsx`
- Summary stats (activities, line items, unique products, extraction cost)
- Aggregated demand table with collapsible drilldown per product
- Drilldown shows sources (group label + activity code)
- Approve button (disabled when empty)
- Approved state shows badge + "Continue to Inventory" button
- Back button hidden when approved (irreversible)

### Key Patterns
- **Computed vs Snapshot:** Before approval, demand is computed from groups. After approval, uses frozen snapshot.
- **Blocking rules:** Cannot approve empty demand. Cannot approve if already approved.
- **Status transition:** `capturing_loading_lists` → `capturing_inventory` on approval
- **Drilldown:** Collapsible per product shows sources (group + activity)

### User Flow
1. User navigates to demand page from loading lists
2. Reviews aggregated demand with drilldown for verification
3. Clicks "Approve Demand" (blocked if empty)
4. Snapshot saved to DB, session status updated
5. Redirected to inventory page (T6)
6. If returning to demand page, shows approved state (read-only)

---

## T6 & T7 - Station capture + extraction
### Status: Complete

### Implementation Summary

**Refs:** Flow3.1–3.3, FR-19..FR-24, Constraints §1, §2, §3, §5

**Database:** `lib/db/schema.ts`
- `stationCaptures` - Table for station sign+stock image pairs:
  - `id`, `sessionId` (FK), `status` (pending|valid|needs_attention|failed)
  - Sign image: `signBlobUrl`, `signWidth`, `signHeight`, `signUploadedAt`
  - Stock image: `stockBlobUrl`, `stockWidth`, `stockHeight`, `stockUploadedAt`
  - Extraction: `productCode`, `minQty`, `maxQty`, `onHandQty`
  - `errorMessage` - Error/warning message from extraction
  - `extractedAt`, `createdAt`

**Shared Utilities:** `lib/utils/image.ts`
- `validateImageFile(file)` - MIME type + size validation
- `fileToBase64(file)` - Convert File to base64
- `getImageDimensions(file)` - Get width/height

**AI Extraction:** `lib/ai/`
- `schemas/station-extraction.ts` - Simplified Zod schema:
  - `status` (success|warning|error)
  - `message` (explains warning/error)
  - `productCode`, `minQty`, `maxQty` (from sign)
  - `onHandQty` (from stock)
- `extract-station.ts` - `extractStation()`, `safeExtractStation()`
- `prompts.ts` - `STATION_SYSTEM_PROMPT`, `STATION_USER_PROMPT`

**API Routes:** `app/api/[...route]/_stations.ts`
- GET `/api/sessions/:sessionId/stations` - List stations
- POST `/api/sessions/:sessionId/stations` - Create station with sign+stock images
- DELETE `/api/stations/:id` - Delete station + cleanup blobs
- POST `/api/stations/:id/extract` - Run AI extraction (accepts modelId)
- GET `/api/sessions/:sessionId/coverage` - Get coverage status

**React Query Hooks:** `hooks/stations/`
- `useStations(sessionId)` - List stations query
- `useCoverage(sessionId)` - Get coverage status
- `useCreateStation()` - Create station mutation
- `useDeleteStation()` - Delete mutation
- `useExtractStation()` - Run extraction mutation

**UI Components:** `app/sessions/[id]/inventory/`
- `page.tsx` - Main inventory page with capture form, coverage summary, station list
- `_components/station-capture-card.tsx` - Two stacked capture boxes (sign + stock) with Take Photo / Upload split buttons
- `_components/station-card.tsx` - Display station with extracted data, status badges, error/warning alerts
- `_components/coverage-summary.tsx` - Show coverage status for demanded products

**Shared Components:**
- `components/ai/model-selector.tsx` - Model selector dropdown (shared with loading list extraction)
- `components/ui/badge.tsx` - Added semantic variants: `success`, `warning`, `error`, `info`

### Simplified Extraction Schema

| Field | Type | Description |
|-------|------|-------------|
| `status` | success/warning/error | Overall result |
| `message` | string? | Explains warning/error |
| `productCode` | string? | From sign (null if invalid) |
| `minQty` | number? | From sign (null if invalid) |
| `maxQty` | number? | From sign (null if invalid) |
| `onHandQty` | number? | From stock (null if invalid) |

### Status Model

| Status | Condition | Message |
|--------|-----------|---------|
| **success** | Both images valid, all data extracted, stock matches sign | Optional |
| **warning** | Extracted but uncertain (count unclear, unsure if match) | Required |
| **error** | Invalid sign/stock image, or stock shows wrong product | Required |

### Station Status Mapping

| Extraction Status | Station Status |
|-------------------|----------------|
| success | valid |
| warning | needs_attention |
| error | failed |

### Coverage Blocking Rule (Constraints §3)
- For every demanded product, must have a station with:
  - `status === "valid"`
  - `onHandQty !== null`
  - `maxQty !== null`

### User Flow
1. User navigates from demand page to `/sessions/:id/inventory`
2. Coverage summary shows which demanded products need stations
3. User captures sign photo, then stock photo (via camera or upload)
4. User clicks "Upload Station" → creates station → extraction runs async
5. Form clears immediately, ready for next station
6. Station card shows extracted data + status badge
7. If warning/failed → user can re-extract or delete and retry
8. Once all demanded products have valid stations → "Continue to Order" enabled

### Scripts
- `scripts/seed-stations.ts` - Seeds valid stations for testing (on-hand below max to require ordering)

---

## T8 - Order Review Page
### Status: Complete

### Implementation Summary

**Refs:** Flow4.1, FR-25..FR-30, Constraints §3 (formula + max warn), Constraints §4 (template)

**Design Decision:** Order data is computed on request, not stored. Keeps data fresh and simplifies implementation.

**API Routes:** `app/api/[...route]/_order.ts`
- GET `/api/sessions/:sessionId/order` - Compute order from demand snapshot + stations

**React Query Hooks:** `hooks/order/`
- `useOrder(sessionId)` - Query for computed order data

**UI:** `app/sessions/[id]/order/page.tsx`
- Warning banner (if any products exceed max)
- Order items table (Product, Demand, On Hand, Max, Order)
- Order text card with copy-to-clipboard
- "Mark Completed" button (disabled, T9 stub)

### Order Calculation (Constraints §3)

| Formula | Description |
|---------|-------------|
| `recommendedOrderQty = max(0, demandQty - onHandQty)` | Demand-first formula |
| `exceedsMax = (onHandQty + recommendedOrderQty) > maxQty` | Warning flag (non-blocking) |

### Order Text Template (Simplified)
```
Order Request – Session: {sessionCreatedAtISO}
Stock location: EB5

{productCode} | Order={recommendedOrderQty}
```
- Generated client-side from `orderItems`
- Only includes products where `recommendedOrderQty > 0`
- Products sorted by `productCode` ascending

### Coverage Blocking
- API returns 400 if any demanded product lacks a valid station
- Must have `status === "valid"`, `onHandQty !== null`, `maxQty !== null`

### Session Status Transition
- Automatically marks session as `completed` when order page is accessed

### User Flow
1. User navigates from inventory page to `/sessions/:id/order`
2. Session auto-completes
3. Warning banner shows if any products exceed max capacity
4. Order items table shows all products with computed order quantities (order qty is bold)
5. User copies order text to clipboard

---

## Session Flow Refactoring - Free Navigation + Computed State
### Status: Complete

### Overview

**IMPORTANT: This refactoring diverges from the original specs.**

Refactored from a **gate-based workflow** to a **free-navigation workflow**:

| Aspect | Before (Spec) | After (Implementation) |
|--------|---------------|------------------------|
| Session status | Gates navigation, requires specific transitions | Tracks "last visited phase" for resume only |
| Demand | Stored as snapshot after "Approve" action | Always computed from extractions |
| Order | Requires approved demand snapshot | Computed from extractions + stations |
| Navigation | Restricted based on status | Free navigation between all phases |
| Invalid data | Blocks progression | Filtered out, shows partial results |

### Rationale

The original spec treated the workflow as a validation/audit pipeline with approval gates. In practice:
- Users need to freely navigate between phases to review/edit data
- Approval checkpoints add friction without adding value (this is a helper tool, not an audit system)
- Computed state is always fresh and reflects current data
- Partial data should be shown "as-is", not blocked

### Database Changes

**Removed:**
- `demandSnapshots` table - No longer needed (demand always computed)
- `sessionsRelations.demandSnapshot` - Removed relation

**Changed:**
- `sessionState` → `sessionPhase` enum: `["loading-lists", "demand", "inventory", "order"]`
- `sessions.status` → `sessions.lastPhase` - Semantic rename, tracks last visited phase

**Migration:** `drizzle/0001_session_flow_refactor.sql`

### API Route Changes

**Removed:**
- `POST /sessions/:sessionId/demand/approve` - No approval step

**Changed:**
- `PATCH /sessions/:id/status` → `PATCH /sessions/:id/phase` - Updates last phase
- `GET /sessions/:sessionId/demand` - Always computes from groups (no snapshot logic)
- `GET /sessions/:sessionId/order` - Computes from groups + stations, returns `skippedItems` for partial data

### New: Computation Utilities

**File:** `lib/workflow/compute.ts`

Pure functions for computing derived state from raw data:

| Function | Input | Output |
|----------|-------|--------|
| `computeDemandFromGroups()` | Groups with extractions | `ComputedDemandItem[]` |
| `computeOrderItems()` | Demand + Stations | `{ computed, skipped }` |
| `computeCoverage()` | Demand + Stations | `CoverageInfo` |
| `computeExtractionStats()` | Groups | `ExtractionStats` |

**Key behavior:** Gracefully filters invalid data:
- Groups without extraction → skipped
- Groups with error status → skipped
- Line items without primaryCode → skipped
- Stations without valid status → skipped (returned in `skippedItems`)

### Hook Changes

**Removed:**
- `useApproveDemand()` - No approval step
- `useUpdateSessionStatus()` - Renamed

**Added/Changed:**
- `useUpdatePhase()` - Updates `lastPhase` (fire-and-forget on navigation)
- `useDemand()` - Simplified, returns computed data with stats
- `useOrder()` - Returns `orderItems`, `skippedItems`, `coverage`

### UI Navigation Refactoring

**New Component:** `components/workflow-navigation.tsx`

Shared floating bottom banner with prev/next navigation:

```tsx
<WorkflowNavigation
  prev={{ href: "/", label: "Sessions" }}
  next={{ href: `/sessions/${id}/demand`, label: "Demand" }}
/>
```

**Navigation Flow:**

| Page | Prev | Next |
|------|------|------|
| Loading Lists | Sessions (/) | Demand |
| Demand | Loading Lists | Inventory |
| Inventory | Demand | Order |
| Order | Inventory | Done (/) |

**Page Changes:**
- All pages: Removed header back navigation, added `pb-24` for banner clearance
- Loading Lists: Removed floating banner from `group-list-client.tsx` (moved to page level)
- Demand: Removed approve button, approved badge, all approval conditional logic
- Inventory: Removed coverage blocking (coverage is informational only)
- Order: Shows `skippedItems` warning for products without valid stations

### Session Router Changes

**File:** `app/sessions/[id]/page.tsx`

```typescript
const phaseToRoute: Record<Session["lastPhase"], string> = {
  "loading-lists": "loading-lists",
  demand: "demand",
  inventory: "inventory",
  order: "order",
};
```

Uses `session.lastPhase` to redirect to appropriate page on resume.

### Files Modified

| File | Change |
|------|--------|
| `lib/workflow/compute.ts` | **Created** - Pure computation functions |
| `lib/db/schema.ts` | Removed demandSnapshots, changed status→lastPhase |
| `app/api/[...route]/_sessions.ts` | Changed status→phase endpoint |
| `app/api/[...route]/_demand.ts` | Removed approve, always compute |
| `app/api/[...route]/_order.ts` | Compute from raw data, return skipped |
| `hooks/demand/use-demand.ts` | Removed useApproveDemand |
| `hooks/sessions/use-sessions.ts` | Changed to useUpdatePhase |
| `hooks/order/types.ts` | Added SkippedOrderItem, CoverageInfo |
| `components/workflow-navigation.tsx` | **Created** - Shared nav component |
| `app/page.tsx` | Uses lastPhase |
| `app/sessions/[id]/page.tsx` | Uses lastPhase for routing |
| `app/sessions/[id]/loading-lists/page.tsx` | WorkflowNavigation |
| `app/sessions/[id]/loading-lists/_components/group-list-client.tsx` | Removed floating banner |
| `app/sessions/[id]/demand/page.tsx` | Removed approve logic, WorkflowNavigation |
| `app/sessions/[id]/inventory/page.tsx` | Removed blocking, WorkflowNavigation |
| `app/sessions/[id]/order/page.tsx` | Shows skipped items, WorkflowNavigation |
| `scripts/seed-stations.ts` | Uses computed demand instead of snapshot |
| `drizzle/0001_session_flow_refactor.sql` | **Created** - Migration |

### To Apply Migration

```bash
# Option 1: Push schema directly (development)
npm run db:push

# Option 2: Run migration (production)
npm run db:migrate
```

---

## Product Catalog + Coverage Defaults Refactoring
### Status: Complete

### Overview

**IMPORTANT: This refactoring diverges from the original specs.**

Added a static product catalog and changed coverage/order calculation to use catalog defaults when stations are not captured.

| Aspect | Before (Spec) | After (Implementation) |
|--------|---------------|------------------------|
| Product data source | Extracted from sign images only | Static catalog + sign extraction |
| Min/Max values | Required from station capture | Falls back to catalog if not captured |
| On-hand quantity | Required from station capture | Defaults to 0 if not captured |
| Coverage blocking | All demanded products need valid stations | Products in catalog can proceed without capture |
| Station images | Required (sign + stock) | Optional (can use catalog defaults) |

### Rationale

The original spec required capturing every demanded product's station sign and stock photos. In practice:
- Many products have known min/max values in a catalog
- Station capture is time-consuming for large orders
- Default to on-hand = 0 is conservative (orders full demand)
- Users can still capture stations for accurate on-hand counts

### New Files

**Product Catalog:** `lib/products/catalog.ts`
- `Product` type: `{ articleNumber, description, minQty, maxQty }`
- `PRODUCT_CATALOG` - Static array of 112 products (from products_en.csv)
- `PRODUCT_BY_CODE` - Map for O(1) lookup by article number
- `getProduct(articleNumber)` - Helper function

**Product Catalog Page:** `app/products/page.tsx`
- Table view of all products with Article Number, Description, Min, Max
- Accessible from home page via "Catalog" button

### Type Changes

**Coverage Item:** `hooks/stations/types.ts`
```typescript
export type CoverageItem = {
  productCode: string;
  productDescription?: string;  // NEW: from catalog
  demandQty: number;
  isCaptured: boolean;          // RENAMED: from hasValidStation
  stationId?: string;
  onHandQty: number;            // CHANGED: always a number (0 for uncaptured)
  minQty: number | null;        // From station OR catalog
  maxQty: number | null;        // From station OR catalog
};
```

**Order Item:** `hooks/order/types.ts`
```typescript
export type OrderItem = {
  productCode: string;
  productDescription?: string;  // NEW: from catalog
  demandQty: number;
  onHandQty: number;
  minQty: number | null;
  maxQty: number | null;
  recommendedOrderQty: number;
  exceedsMax: boolean;
  isCaptured: boolean;          // NEW: derived field
};
```

### `isCaptured` Derived Field

The `isCaptured` field is **derived, not stored**. It's computed by checking:
```typescript
const isCaptured = !!(
  station?.signBlobUrl && station?.stockBlobUrl &&
  station.status === "valid" &&
  station.onHandQty !== null &&
  station.maxQty !== null
);
```

- `isCaptured: true` → Station captured with images, use station data
- `isCaptured: false` → No station or no images, use catalog defaults (on-hand = 0)

### API Changes

**Coverage API:** `app/api/[...route]/_stations.ts`
- Uses `getProduct()` to look up catalog data
- Falls back to catalog min/max if no valid station
- Sets `onHandQty = 0` for uncaptured products
- `canProceed` now allows products with catalog data (not just stations)

**Order Computation:** `lib/workflow/compute.ts`
- `computeOrderItems()` falls back to catalog if no valid station
- `computeCoverage()` considers products covered if in catalog OR captured

### UI Changes

**Coverage Summary:** `app/sessions/[id]/inventory/_components/coverage-summary.tsx`
- Renamed from "Coverage" to "Demanded Products"
- Table with columns: Status, Product, On Hand
- Status badge: "Captured" (green) or "Default" (secondary with warning icon)
- Removed progress bar and legend

**Order Page:** `app/sessions/[id]/order/page.tsx`
- Removed skipped items warning (no longer needed with catalog fallback)
- Reverted to original simple design (warning icon only for exceeds max)

**Home Page:** `app/page.tsx`
- Added "Catalog" button linking to `/products`

### Files Modified

| File | Change |
|------|--------|
| `lib/products/catalog.ts` | **Created** - Static product catalog |
| `app/products/page.tsx` | **Created** - Catalog page |
| `app/page.tsx` | Added catalog link |
| `hooks/stations/types.ts` | Added `isCaptured`, `productDescription` |
| `hooks/order/types.ts` | Added `isCaptured`, `productDescription` |
| `app/api/[...route]/_stations.ts` | Catalog fallback in coverage API |
| `lib/workflow/compute.ts` | Catalog fallback in order computation |
| `app/sessions/[id]/inventory/_components/coverage-summary.tsx` | Table with badges |
| `app/sessions/[id]/order/page.tsx` | Removed skipped warning, simplified |

### Removed Files

- `products.csv` - Dutch version (data now in TypeScript)
- `products_en.csv` - English version (data now in TypeScript)
## Streaming Extraction Persistence Fix
### Status: Complete

### Implementation Notes

See: [`notes/streaming-extraction-persistence.md`](./notes/streaming-extraction-persistence.md)

### Summary

Fixed unreliable database persistence when using Vercel AI SDK's `streamObject`. The `onFinish` callback was not guaranteed to complete before the HTTP response ended, causing extraction results to be lost.

**Solution:**
1. **Server-side:** Use `result.object` promise instead of `onFinish` for reliable persistence
2. **Client-side:** Use React Query's `setQueryData` instead of `invalidateQueries` for immediate cache updates

### Files Created/Modified

| File | Change |
|------|--------|
| `app/api/extract-stream/route.ts` | Replaced `onFinish` with `result.object` promise |
| `hooks/extraction/use-streaming-extraction.ts` | Replaced `invalidateQueries` with `setQueryData` |
| `app/api/station-extract-stream/route.ts` | **Created** - Streaming endpoint for stations |
| `hooks/stations/use-streaming-station-extraction.ts` | **Created** - Streaming hook for stations |
| `hooks/stations/index.ts` | Added export for new hook |
| `notes/streaming-extraction-persistence.md` | **Created** - Implementation notes |

---

## T9 - Session Cleanup (Cron Job)
### Status: Complete

### Implementation Summary

**IMPORTANT: This diverges from the original spec.**

Original spec (T9) called for cleanup on session completion. Instead, we implemented automatic weekly cleanup via Vercel cron jobs to remove sessions older than 1 week.

| Aspect | Original Spec | Implementation |
|--------|---------------|----------------|
| Trigger | On "Mark Completed" action | Weekly cron job (Sundays at midnight UTC) |
| Scope | Single session on completion | All sessions older than 1 week |
| Blob cleanup | Best-effort on completion | Best-effort during cron run |

### Architecture

**Shared Cleanup Logic:** `lib/cleanup/session.ts`
- `deleteSessionWithCleanup(sessionId)` - Deletes single session with all blobs
- `cleanupOldSessions(maxAgeMs)` - Finds and deletes sessions older than threshold

**Cron Endpoint:** `app/api/cron/cleanup-sessions/route.ts`
- Secured with `CRON_SECRET` environment variable
- Vercel sends `Authorization: Bearer <secret>` header
- Returns summary: `{ deletedSessions, deletedBlobs, failedBlobs, errors }`

**Configuration:** `vercel.json`
```json
{
  "crons": [
    {
      "path": "/api/cron/cleanup-sessions",
      "schedule": "0 0 * * 0"
    }
  ]
}
```

### Blob Cleanup (Fixed)

Session deletion now cleans up **all** blob types:
- Loading list images (`loadingListImages.blobUrl`)
- Station sign images (`stationCaptures.signBlobUrl`)
- Station stock images (`stationCaptures.stockBlobUrl`)

### Environment Variables

- `CRON_SECRET` - Required for production (min 16 characters)

### Files Created/Modified

| File | Change |
|------|--------|
| `lib/cleanup/session.ts` | **Created** - Shared cleanup logic |
| `app/api/cron/cleanup-sessions/route.ts` | **Created** - Cron endpoint |
| `app/api/[...route]/_sessions.ts` | Refactored to use shared cleanup |
| `vercel.json` | **Created** - Cron configuration |
| `.env.example` | **Created** - Document all env vars |

### Deployment Notes

1. Add `CRON_SECRET` to Vercel environment variables (production only)
2. Cron jobs only run on production deployments
3. Can manually trigger via Vercel dashboard: Project → Settings → Cron Jobs
4. Hobby plan limit: 2 cron jobs

---
