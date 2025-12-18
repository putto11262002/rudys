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
