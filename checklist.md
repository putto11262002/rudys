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
