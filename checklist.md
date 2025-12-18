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
### Status: Pending

---
