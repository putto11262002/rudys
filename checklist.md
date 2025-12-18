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
### Status: Pending

---

## T3 - Loading list capture
### Status: Pending

---
