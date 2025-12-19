---
title: Implement a slice
description: Implement a slice of the app
---

Given a task #$1 implement this task across all vertical slices.

Implementation notes: #$2

Rules:
- Data fetching
    - Use React Query hooks for data fetching (useQuery)
    - Query key factories for consistent cache keys (e.g., sessionKeys.lists())
    - Loading states via React Query's isPending/isLoading
    - Use Skeleton components that reflect the actual UI structure
    - Empty state must be communicated via shadcn Empty component
- Mutations
    - Use React Query mutations (useMutation) calling Hono RPC client
    - Use zod to validate input in Hono routes (@hono/zod-validator)
    - Hooks handle ONLY cache invalidation - NO UI concerns (toasts, navigation)
    - UI side effects (toasts, navigation) handled in components via mutate(..., { onSuccess })
    - Mutation result communicated via:
        - Toasts (sonner) - short messages
        - Alerts - long messages
    - Mutation loading state communicated via:
        - isPending from useMutation
        - Loader icon on buttons
- API Routes (Hono)
    - Routes in app/api/[...route]/_<feature>.ts
    - Routes MUST be chained (.get().post().delete()) for type inference
    - Export type from chained result for RPC client
    - Route aggregation: app.route('/path', subRoutes)
    - Return JSON with error field on failure
- Client-side forms
    - Use Shadcn Form components
    - Use react-hook-form with zod schema
    - Validate form input on the client
- UI
    - All components are client components
    - Use shadcn components
    - Use tailwind css with shadcn classes and variables
    - NEVER create components if not truly reusable
- Streaming (AI extraction)
    - Use separate Next.js route handler for streaming (/api/extract-stream)
    - Use @ai-sdk/react useObject for streaming UI
- Package management
    - Use bun
    - bun add <package>
    - bun remove <package>
    - bunx --bun shadcn@latest ...

Important files:
./tasks.md - contains the list of tasks and the order in which they should be implemented
./spec - contains the spec documents that the tasks refer to
./checklist.md - contains a checklist of the tasks and implementations note leaving for context for future developers. THis note must not be verbose but information rich and reference appropaite upstream files and crucial implementation files.

Workflow:
1. Undestand tasks and read approapite references upstream document that the tasks refers to. 
1.1 Read appropaite spec documents to fully understand the how the task fits into the app
1.2 Read the checklist to understand progress and implementation notes. Divergance from the specs is documented here. If there is conflict against the spec you must prefer the checkllist version.
1.2 Explore existing codebase to understand the current state of the app
3. Research appropiate modules/components that will be involved for the task
4. Research appropriate offical documentation like a senior engineer to understand the technology deeply, all caveat, advance usage. using subagent with tavily search tools if needed.
3. Plan the task while strcitly follows the rules
4. Await approval from the user
5. Implement the task
6. Write to checklist.md


You must first plan carefully and await for approval from the user.
