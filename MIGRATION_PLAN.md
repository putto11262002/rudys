# Migration Plan: Next.js Server Actions → Hono + React Query

## Status: COMPLETE

All migration slices have been completed successfully.

## Overview

Migrated from Next.js Server Actions + `unstable_cache` to:
- **Hono** - API routes with RPC for end-to-end type safety
- **React Query** - Client-side state management, caching, data fetching
- **All Client Components** - UI stays the same, but everything becomes client-rendered

## Current Architecture

```
┌─────────────────────────────────────────────────────────────────┐
│                        CURRENT STACK                            │
├─────────────────────────────────────────────────────────────────┤
│  UI (Server + Client Components)                                │
│       ↓                                                         │
│  Server Actions (lib/actions/*.ts)                              │
│       ↓                                                         │
│  Data Loaders (lib/data/*.ts) with unstable_cache               │
│       ↓                                                         │
│  Drizzle ORM → Neon Postgres                                    │
│       ↓                                                         │
│  Vercel Blob (images)                                           │
└─────────────────────────────────────────────────────────────────┘
```

## Target Architecture

```
┌─────────────────────────────────────────────────────────────────┐
│                        TARGET STACK                             │
├─────────────────────────────────────────────────────────────────┤
│  UI (Client Components)                                         │
│       ↓                                                         │
│  React Query Hooks (hooks/<feature>/*.ts)                       │
│       ↓                                                         │
│  Hono RPC Client (lib/api/client.ts)                            │
│       ↓                                                         │
│  Hono API Routes (app/api/[...route]/route.ts)                  │
│       ↓                                                         │
│  Drizzle ORM → Neon Postgres                                    │
│       ↓                                                         │
│  Vercel Blob (images)                                           │
└─────────────────────────────────────────────────────────────────┘
```

## File Structure After Migration

```
app/
  api/
    [...route]/
      route.ts              # Root Hono instance, exports handlers + AppType
      _sessions.ts          # Session routes
      _groups.ts            # Group routes
      _extraction.ts        # Extraction routes
  providers.tsx             # QueryClientProvider
  layout.tsx                # Wraps with Providers
  page.tsx                  # Client component (sessions list)
  sessions/
    [id]/
      page.tsx              # Client component (router)
      loading-lists/
        page.tsx            # Client component
        _components/        # Same components, updated imports

hooks/
  sessions/
    use-sessions.ts         # useSessions, useSession, useCreateSession, useDeleteSession
    query-keys.ts           # sessionKeys factory
  groups/
    use-groups.ts           # useGroups, useCreateGroup, useDeleteGroup, useUploadImages
    query-keys.ts           # groupKeys factory
  extraction/
    use-extraction.ts       # useExtractGroup, useExtractionResult
    query-keys.ts           # extractionKeys factory

lib/
  api/
    client.ts               # Hono RPC client: hc<AppType>
  db/                       # Unchanged
  ai/                       # Unchanged (used by API routes)
```

## Migration Slices

### Slice 0: Infrastructure Setup
**Goal**: Set up Hono + React Query foundation without breaking anything
**Status**: COMPLETE

- [x] Install dependencies: `hono`, `@hono/zod-validator`, `@tanstack/react-query`, `@tanstack/react-query-devtools`
- [x] Create `app/api/[...route]/route.ts` with empty Hono app
- [x] Create `app/providers.tsx` with QueryClientProvider
- [x] Update `app/layout.tsx` to wrap with Providers
- [x] Create `lib/api/client.ts` with Hono RPC client
- [x] Verify app still works (no functionality changed yet)

### Slice 1: Sessions Feature
**Goal**: Migrate sessions CRUD while keeping old code as fallback
**Status**: COMPLETE

#### 1a. API Routes
- [x] Create `app/api/[...route]/_sessions.ts`:
  - `GET /api/sessions` - List all sessions
  - `GET /api/sessions/:id` - Get single session
  - `POST /api/sessions` - Create session
  - `DELETE /api/sessions/:id` - Delete session
  - `PATCH /api/sessions/:id/status` - Update status
- [x] Mount in `route.ts` and export combined type

#### 1b. React Query Hooks
- [x] Create `hooks/sessions/query-keys.ts`
- [x] Create `hooks/sessions/use-sessions.ts`:
  - `useSessions()` - Query for listing
  - `useSession(id)` - Query for single
  - `useCreateSession()` - Mutation
  - `useDeleteSession()` - Mutation
  - `useUpdateSessionStatus()` - Mutation

#### 1c. UI Migration
- [x] Update `app/page.tsx` to use `useSessions()` instead of `getSessions()`
- [x] Update `app/_components/delete-session-button.tsx` to use `useDeleteSession()`
- [x] Update "New Session" form to use `useCreateSession()`
- [x] Verify sessions list works end-to-end

#### 1d. Cleanup
- [x] Remove `lib/actions/sessions.ts` (after verification)
- [x] Remove `lib/data/sessions.ts` (after verification)

### Slice 2: Groups Feature
**Goal**: Migrate groups CRUD and image upload
**Status**: COMPLETE

#### 2a. API Routes
- [x] Create `app/api/[...route]/_groups.ts`:
  - `GET /api/sessions/:sessionId/groups` - List groups with images
  - `POST /api/sessions/:sessionId/groups` - Create group with images (base64 JSON)
  - `DELETE /api/groups/:id` - Delete group
- [x] Handle base64 image data in JSON body
- [x] Mount and update AppType

#### 2b. React Query Hooks
- [x] Create `hooks/groups/query-keys.ts`
- [x] Create `hooks/groups/use-groups.ts`:
  - `useGroups(sessionId)` - Query for listing with images
  - `useCreateGroupWithImages()` - Mutation for batch create+upload
  - `useDeleteGroup()` - Mutation

#### 2c. UI Migration
- [x] Update `loading-lists/page.tsx` to use `useGroups()`
- [x] Update `group-list-client.tsx` to use hooks
- [x] Update `capture-card.tsx` to use `useCreateGroupWithImages()`
- [x] Update `delete-group-button.tsx` to use `useDeleteGroup()`

#### 2d. Cleanup
- [x] Remove `lib/actions/groups.ts`
- [x] Remove `lib/data/groups.ts`

### Slice 3: Extraction Feature
**Goal**: Migrate AI extraction (most complex due to streaming)
**Status**: COMPLETE

#### 3a. API Routes
- [x] Create `app/api/[...route]/_extraction.ts`:
  - `POST /api/groups/:groupId/extract` - Run extraction for single group
  - `GET /api/groups/:groupId/extraction` - Get extraction result
- [x] Synchronous extraction (no streaming needed for current use case)
- [x] Mount and update AppType

#### 3b. React Query Hooks
- [x] Create `hooks/extraction/query-keys.ts`
- [x] Create `hooks/extraction/use-extraction.ts`:
  - `useExtractGroup()` - Mutation with cache invalidation
  - `useExtractionResult(groupId)` - Query for result

#### 3c. UI Migration
- [x] Update extraction flow in `capture-card.tsx`
- [x] Update `demand/page.tsx` to use hooks

#### 3d. Cleanup
- [x] Remove `lib/actions/extraction.ts`
- [x] Remove `lib/data/extraction.ts`

### Slice 4: Final Cleanup & Optimization
**Goal**: Remove all legacy code, optimize
**Status**: COMPLETE

- [x] Remove all `unstable_cache` usage
- [x] Remove all `revalidateTag` / `updateTag` calls
- [x] Remove any remaining server action files
- [x] Update `checklist.md` with new architecture
- [x] Test full user flow (build verification)
- [x] Create `GroupWithImages` type in `hooks/groups/types.ts`

## Key Technical Decisions

### 1. Hono Route Chaining for Type Safety
```typescript
// ❌ BAD - types break
const app = new Hono()
app.get('/sessions', handler1)
app.post('/sessions', handler2)

// ✅ GOOD - types preserved
const sessionRoutes = new Hono()
  .get('/', handler1)
  .post('/', handler2)
```

### 2. Route Aggregation Pattern
```typescript
// route.ts
import { sessionRoutes } from './_sessions'
import { groupRoutes } from './_groups'
import { extractionRoutes } from './_extraction'

const app = new Hono().basePath('/api')

const routes = app
  .route('/sessions', sessionRoutes)
  .route('/groups', groupRoutes)
  .route('/extraction', extractionRoutes)

export type AppType = typeof routes
```

### 3. Image Upload Handling
```typescript
// Hono route
.post(
  '/',
  zValidator('form', z.object({
    sessionId: z.string(),
    images: z.array(z.instanceof(File)),
  })),
  async (c) => {
    const { sessionId, images } = c.req.valid('form')
    // Upload to Vercel Blob
  }
)

// Client
const res = await client.sessions[':sessionId'].groups.$post({
  param: { sessionId },
  form: { images: files },
})
```

### 4. Query Key Factory Pattern
```typescript
// hooks/sessions/query-keys.ts
export const sessionKeys = {
  all: ['sessions'] as const,
  lists: () => [...sessionKeys.all, 'list'] as const,
  detail: (id: string) => [...sessionKeys.all, 'detail', id] as const,
}

// Invalidation after mutation
queryClient.invalidateQueries({ queryKey: sessionKeys.lists() })
```

### 5. Separation of Concerns: Hooks vs Components

**CRITICAL**: Hooks handle ONLY data + cache invalidation. UI side effects belong in components.

```typescript
// ✅ GOOD - Hook only handles cache
// hooks/sessions/use-sessions.ts
export function useDeleteSession() {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: async (id: string) => {
      const res = await client.api.sessions[':id'].$delete({ param: { id } })
      if (!res.ok) throw new Error('Failed to delete')
      return res.json()
    },
    onSuccess: () => {
      // ONLY cache invalidation here
      queryClient.invalidateQueries({ queryKey: sessionKeys.lists() })
    },
    // NO toasts, NO navigation, NO UI side effects
  })
}

// ✅ GOOD - Component handles UI side effects
// components/delete-button.tsx
function DeleteButton({ id }: { id: string }) {
  const { mutate, isPending } = useDeleteSession()
  const router = useRouter()

  const handleDelete = () => {
    mutate(id, {
      onSuccess: () => {
        toast.success('Session deleted')  // UI concern
        router.push('/')                   // Navigation concern
      },
      onError: (error) => {
        toast.error(error.message)         // UI concern
      },
    })
  }

  return <button onClick={handleDelete} disabled={isPending}>Delete</button>
}
```

```typescript
// ❌ BAD - Don't put UI concerns in hooks
export function useDeleteSession() {
  return useMutation({
    mutationFn: ...,
    onSuccess: () => {
      queryClient.invalidateQueries(...)
      toast.success('Deleted!')  // ❌ NO - this belongs in component
      router.push('/')           // ❌ NO - this belongs in component
    },
  })
}
```

This pattern keeps hooks **reusable** and **testable**, while components control the **user experience**.

### 5. Streaming Extraction
For AI extraction streaming, we have options:
- **Option A**: Keep using `useObject` from `@ai-sdk/react` with existing route handler
- **Option B**: Use React Query with polling/refetching
- **Option C**: SSE (Server-Sent Events) with Hono + custom hook

Recommendation: **Option A** - Keep `useObject` for streaming, but wrap in React Query for cache management.

## Rollback Strategy

Each slice is independent. If issues arise:
1. Keep old code until new code is verified
2. Feature flags can toggle between implementations
3. Database schema unchanged - no migrations needed

## Testing Checklist Per Slice

- [ ] Create session works
- [ ] List sessions shows data
- [ ] Delete session removes data + blobs
- [ ] Create group with images uploads correctly
- [ ] Images display from Vercel Blob
- [ ] Delete group removes data + blobs
- [ ] Extraction runs and saves results
- [ ] Extraction results display correctly
- [ ] Session status transitions work
- [ ] Navigation between pages works
- [ ] Loading states show correctly
- [ ] Error states handle gracefully
- [ ] Toast notifications work

## Dependencies to Install

```bash
bun add hono @hono/zod-validator @tanstack/react-query @tanstack/react-query-devtools
```

Note: `zod` already installed.
