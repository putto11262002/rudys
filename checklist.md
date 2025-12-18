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

**Refs:** Constraints §1, §5, §6, Flow1.2

**Database:** `lib/db/schema.ts`
- `employeeCaptureGroups` - Stub table (id, sessionId, employeeLabel, status, createdAt) for FK reference
- `loadingListImages` - Full table per spec (id, groupId, blobUrl, captureType, orderIndex, width, height, uploadedAt, validation fields, AI classification fields)
- Migration: `drizzle/0001_nifty_spyke.sql`

**Route Handler:** `app/api/blob/upload/route.ts`
- `onBeforeGenerateToken`: Parses clientPayload, validates required fields, constructs blob path per Constraints §5: `sessions/{sessionId}/loading-lists/{groupId}/{imageId}.{ext}`
- `onUploadCompleted`: Inserts `loadingListImages` row with auto-incrementing orderIndex

**Client Upload Utilities:** `lib/blob/upload.ts`
- `validateImageForUpload(file)` - Client-side gate per Constraints §1:
  - MIME types: `image/jpeg`, `image/png`, `image/webp`
  - Max size: 10MB
  - Orientation: portrait (height > width)
- `uploadLoadingListImage({file, sessionId, groupId, captureType})` - Returns `{ok, data, imageId}` or `{ok: false, error}`

**Dependencies added:**
- `@vercel/blob@2.0.0`

### Environment Variables
- `BLOB_READ_WRITE_TOKEN` - Vercel Blob token (auto-set in Vercel)
- `VERCEL_URL` - Set to ngrok URL for local callback testing

### Key Patterns
- Client validates before upload (fail fast, no blob orphans)
- Server re-validates via `allowedContentTypes` (defense-in-depth)
- `clientPayload` passes metadata through token generation to callback
- Blob paths follow `sessions/{sessionId}/loading-lists/{groupId}/{imageId}.{ext}`
- DB row created only in `onUploadCompleted` callback (no orphan records)

### Usage (for T3)
```typescript
import { uploadLoadingListImage, validateImageForUpload } from "@/lib/blob/upload";

// Validate only (for UI feedback)
const validation = await validateImageForUpload(file);
if (!validation.valid) {
  toast.error(validation.message);
  return;
}

// Full upload
const result = await uploadLoadingListImage({
  file,
  sessionId: "...",
  groupId: "...",
  captureType: "camera_photo" | "uploaded_file",
});

if (result.ok) {
  // result.data.url - blob URL
  // result.imageId - DB record ID
} else {
  toast.error(result.error);
}
```

---

## T3 - Loading list capture
### Status: Complete

### Implementation Summary

**Refs:** Flow1.1–1.3, FR-7..FR-10, FR-5..FR-6, Constraints §1, §5, NFR-1

**Database:** `lib/db/schema.ts`
- Added Drizzle relations for `sessions`, `employeeCaptureGroups`, `loadingListImages`
- Enables relational queries with `with: { images: ... }`

**Server Actions:**
- `lib/actions/groups.ts`
  - `createEmployeeGroup(sessionId)` - Creates group with auto-incrementing label
  - `deleteEmployeeGroup(groupId)` - Deletes group + blobs (best-effort)
- `lib/actions/images.ts`
  - `reorderImages(groupId, orderedImageIds)` - Updates orderIndex for all images
  - `deleteImage(imageId)` - Deletes image + blob (best-effort)

**Data Loaders:** `lib/data/groups.ts`
- `getGroupsWithImages(sessionId)` - Cached with `unstable_cache`
- Tags: `["sessions", "session:${sessionId}", "groups:${sessionId}"]`
- Returns groups with images ordered by `orderIndex`

**UI Components:** `app/sessions/[id]/loading-lists/`
- `page.tsx` - Main page with Suspense, empty state, group list
- `loading.tsx` - Skeleton loading state
- `_components/add-group-button.tsx` - Creates new employee group
- `_components/delete-group-button.tsx` - Deletes group with confirmation
- `_components/group-card.tsx` - Card displaying group with images
- `_components/image-upload-button.tsx` - Camera capture + file upload
- `_components/delete-image-button.tsx` - Deletes image with confirmation
- `_components/sortable-image-grid.tsx` - Drag-drop reordering with @dnd-kit

**Dependencies added:**
- `@dnd-kit/core@6.3.1`
- `@dnd-kit/sortable@10.0.0`
- `@dnd-kit/utilities@3.2.2`

### Key Patterns
- Drag-drop with @dnd-kit: `DndContext` + `SortableContext` + `useSortable`
- Optimistic UI: update local state immediately, revert on error
- Image upload uses T2's `uploadLoadingListImage` utility
- Cache revalidation via `updateTag("groups:${sessionId}")`
- Continue button disabled until at least one group has images

### User Flow
1. User clicks "Add Employee Group" → creates group with label "Employee 1", "Employee 2", etc.
2. User clicks Camera/Upload → validates image (portrait, <10MB, jpeg/png/webp) → uploads to Blob → DB row created
3. User drags images to reorder → optimistic update → server sync
4. User clicks X on image → confirmation dialog → deletes image + blob
5. User clicks trash on group → confirmation dialog → deletes group + all images + blobs
6. User clicks "Continue to Review" → navigates to demand review (T5)

---
