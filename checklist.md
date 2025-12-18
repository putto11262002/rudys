# Implementation Checklist

## T1 - Sessions list + create/resume/delete

### Status: Complete

### Implementation Summary

**Database:**
- Schema: `lib/db/schema.ts` - Session table with status enum
- Connection: `lib/db/index.ts` - Neon serverless + Drizzle ORM
- Config: `drizzle.config.ts` - Drizzle Kit configuration

**Server Actions:** `lib/actions/sessions.ts`
- `createSession()` - Creates session, redirects to `/sessions/:id/loading-lists`
- `deleteSession(sessionId)` - Validates with zod, returns `{ok, data/error, message}`

**Data Loaders:** `lib/data/sessions.ts`
- `getSessions()` - Cached with `unstable_cache`, tag: `"sessions"`
- `getSession(id)` - Single session lookup, same cache tag

**UI:**
- Home page: `app/page.tsx` - Sessions list with Suspense/skeleton
- Delete button: `app/delete-session-button.tsx` - AlertDialog confirmation + toast
- Session route: `app/sessions/[id]/page.tsx` - Redirects based on status
- Loading lists stub: `app/sessions/[id]/loading-lists/page.tsx` - Placeholder for T3

**Dependencies added:**
- `drizzle-orm`, `@neondatabase/serverless` - DB
- `zod` - Validation
- `sonner` - Toasts

### Setup Required
1. Create `.env.local` with `DATABASE_URL` (see `.env.example`)
2. Run `bun run db:push` to sync schema to Neon

### Key Patterns
- Server actions return `{ok: true, data, message}` or `{ok: false, error}`
- Cache revalidation: `revalidateTag("sessions", "max")` (Next.js 16 API)
- Empty state: `Empty` component from shadcn
- Loading state: Skeleton cards matching actual UI structure

---

## T2 - Vercel Blob upload plumbing
### Status: Complete

### Implementation Summary

**Refs:** Constraints §1, §5, Flow1.2

**Note:** Original plan was client-side upload with route handler callback. Changed to server-side upload via `put()` to enable `updateTag()` cache revalidation (client uploads can't trigger server-side cache invalidation).

**Database:** `lib/db/schema.ts`
- `employeeCaptureGroups` - Table (id, sessionId, employeeLabel, status, createdAt)
- `loadingListImages` - Table (id, groupId, blobUrl, captureType, orderIndex, width, height, uploadedAt, validation fields, AI classification fields)
- Drizzle relations for relational queries

**Dependencies:**
- `@vercel/blob` - Server-side `put()` and `del()` functions

### Environment Variables
- `BLOB_READ_WRITE_TOKEN` - Vercel Blob token (required)

### Key Patterns
- Server-side upload via `put()` in server actions (not client upload)
- Blob paths: `sessions/{sessionId}/loading-lists/{groupId}/{uuid}.{ext}`
- Enables `updateTag()` for cache revalidation after uploads

---

## T3 - Loading list capture
### Status: Complete

### Implementation Summary

**Refs:** Flow1.1–1.3, FR-7..FR-10, FR-5..FR-6, Constraints §1, §5, NFR-1

**Database:** `lib/db/schema.ts`
- Drizzle relations for `sessions`, `employeeCaptureGroups`, `loadingListImages`
- Enables relational queries with `with: { images: ... }`

**Shared Types:** `lib/actions/types.ts`
- `ActionResult<T>` - Standardized server action return type

**Server Actions:** `lib/actions/groups.ts`
- `createEmployeeGroup(sessionId)` - Creates group with auto-incrementing label ("Employee 1", etc.)
- `uploadGroupImage(groupId, sessionId, orderIndex, formData)` - Uploads single image via `put()`, creates DB row
- `finalizeGroup(sessionId)` - Revalidates cache after all uploads complete
- `deleteEmployeeGroup(groupId)` - Deletes group + blobs in parallel (best-effort)

**Server Actions:** `lib/actions/sessions.ts`
- `deleteSession(sessionId)` - Now also deletes all blobs for all groups (best-effort)

**Data Loaders:** `lib/data/groups.ts`
- `getGroupsWithImages(sessionId)` - Cached with `unstable_cache`
- Tags: `["sessions", "session:${sessionId}", "groups:${sessionId}"]`
- Returns groups with images ordered by `orderIndex`

**UI Components:** `app/sessions/[id]/loading-lists/_components/`
- `capture-card.tsx` - Local image capture with camera/upload, client-side validation (5MB max, jpeg/png/webp), batch upload on "Confirm"
- `group-card.tsx` - Read-only display of completed groups with image thumbnails
- `group-list-client.tsx` - Client wrapper managing capture state, dynamic import of CaptureCard
- `delete-group-button.tsx` - Deletes group with AlertDialog confirmation

**Config:** `next.config.ts`
- `serverActions.bodySizeLimit: "5mb"` - Increased from 1MB default for image uploads
- `images.remotePatterns` - Allows Vercel Blob images

### Key Patterns
- **Separate server action calls per image** - Avoids body size limits, enables parallel uploads via `Promise.all`
- **Local state until "Confirm"** - Images stored as File objects with preview URLs, uploaded on submit
- **Client-side validation** - 5MB max, jpeg/png/webp only, validated before adding to local state
- **Blob cleanup on delete** - Both group and session deletion clean up associated blobs
- **Cache revalidation** - `updateTag()` called after uploads and deletes
- **Dynamic import** - `CaptureCard` loaded with `ssr: false` to avoid hydration issues with server actions

### User Flow
1. User clicks "Add Loading List" → shows CaptureCard
2. User captures/uploads images → stored locally with preview, validated (5MB, jpeg/png/webp)
3. User clicks "Confirm" → creates group → uploads images in parallel → shows success toast
4. User can add more groups or "Continue to Review"
5. User can delete groups → confirmation dialog → deletes group + all blobs

---

## T4 - Loading-list extraction Server Action + persistence
### Status: Complete

### Implementation Summary

**Refs:** Flow2.1–2.3, FR-11..FR-15, Constraints §2

**Dependencies added:**
- `ai@5.0.115` - Vercel AI SDK core
- `@ai-sdk/react@2.0.117` - AI SDK React hooks (useObject)

### Environment Variables
- `AI_GATEWAY_API_KEY` - Required for Vercel AI Gateway

**Database:** `lib/db/schema.ts`
- `loadingListExtractionResults` - Table storing AI extraction output per group
  - `id`, `groupId` (FK), `extractedAt`
  - `imageChecks` (jsonb) - Per-image loading list classification
  - `activities` (jsonb) - Extracted ACT.* codes
  - `lineItems` (jsonb) - Extracted product codes and quantities
  - `ignoredImages` (jsonb) - Images marked as non-loading-list
  - `warnings` (jsonb) - Extraction warnings
  - `summary` (jsonb) - Counts rollup
- JSON types for type-safe jsonb fields

**Zod Schemas:** `lib/ai/schemas/loading-list-extraction.ts`
- `WarningSchema` - Extraction warnings with severity levels
- `ImageCheckSchema` - Per-image classification result
- `ActivitySchema` - ACT.* activity with metadata
- `LineItemSchema` - Product line item with partial reconciliation
- `LoadingListExtractionSchema` - Full extraction output schema

**AI Prompts:** `lib/ai/prompts.ts`
- `LOADING_LIST_SYSTEM_PROMPT` - Dutch "Laadlijst" extraction rules
- `LOADING_LIST_USER_PROMPT` - Per-group user prompt template

**AI Core:** `lib/ai/extract-loading-list.ts`
- `extractLoadingList(imageUrls)` - Calls GPT-4o-mini via Vercel AI Gateway
- `safeExtractLoadingList(imageUrls)` - Safe wrapper with error handling
- Uses Vercel AI Gateway with model string `"openai/gpt-4o-mini"`

**Route Handler:** `app/api/extract/loading-list/route.ts`
- POST handler for streaming extraction
- Uses `streamObject` for real-time streaming to `useObject` hook
- `onFinish` callback saves extraction result to database
- 60s timeout for multi-image extraction

**Server Actions:** `lib/actions/extraction.ts`
- `runLoadingListExtraction(sessionId, groupIds?)` - Main extraction action
  - Validates session exists
  - Processes groups sequentially
  - Persists extraction results to DB
  - Updates image AI classification fields
  - Updates group status (`extracted` | `needs_attention`)
  - Updates session status to `review_demand`
  - Returns summary with per-group results
- `getGroupExtractionResult(groupId)` - Retrieves extraction result

**Data Loaders:** `lib/data/extraction.ts`
- `getGroupsWithExtractionResults(sessionId)` - Groups with extraction data
- `getExtractionResult(groupId)` - Single extraction result

**UI Components:**

`app/sessions/[id]/loading-lists/_components/group-list-client.tsx`
- Uses `useObject` hook from `@ai-sdk/react` for streaming extraction
- "Continue to Review" button triggers extraction for all groups sequentially
- Shows progress "Extracting 1/N..." with spinner
- `onFinish` callback chains to next group or navigates to demand page
- Toast notifications for success/failure

`app/sessions/[id]/loading-lists/_components/group-card.tsx`
- StatusBadge component shows extraction status
- Pending (clock icon) / Extracted (green check) / Needs Attention (amber alert)

`app/sessions/[id]/demand/page.tsx`
- Demand review page showing extraction results
- Aggregates line items by primaryCode
- Summary stats (activities, line items, unique products)
- Warning for ignored partial items
- Placeholder for T5 approval flow

### Key Patterns
- **Streaming extraction with useObject** - Real-time updates via `streamObject` + `useObject` hook
- **Vercel AI Gateway** - Uses `AI_GATEWAY_API_KEY` with model string `"openai/gpt-4o-mini"`
- **Per-group isolation** - Extraction failures don't block other groups
- **Blocking warnings** - Groups with severity="block" warnings marked `needs_attention`
- **Partial item handling** - Items with `isPartial=true && reconciled=false` excluded from demand aggregation
- **Image classification update** - Individual images updated with AI classification results
- **Session status transition** - Moves to `review_demand` after extraction

### User Flow
1. User adds loading list images via capture
2. User clicks "Continue to Review" → triggers extraction
3. Extraction runs for all groups with images
4. Toast shows success/failure count
5. Navigates to demand review page
6. Demand page shows aggregated product quantities

### Error Handling
- Network errors caught and reported via toast
- Failed groups marked `needs_attention`
- Summary includes success/fail counts
- Individual group errors logged to console

---
