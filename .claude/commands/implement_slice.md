---
title: Implement a slice
description: Implement a slice of the app
---

Given a task #$1 implement this task across all vertical slices.

Implementation notes: #$2

Rules:
- Data rendering
    - use drizzle query api to fetch and render data on the server
    - Use Suspense to render skeleton loading states that reflect the actual ui
    - Empty state must be communicated to the user via shadcn Empty component
    - Wrap data loader with nextjs unstable_cache and assign appropriate cache tags
- Mutations: 
    - Use server actions to mutation data
    - Use zod to validate mutation input
    - Mutation result must be  communicated to the user via
        - Toasts  - short messages
        - Alerts - long messages
    - Server action must return standardize response: {ok: true, data: ..., message: ...}  | {ok: false, error}
    - If mutation modifies data, you must revalidate appropriate cache tags. updateTag is read own write and revalidateTag is next request will be revalidated.
    - You must revalidate appropriate 
    - Mutation loading state must be communicated to the user via
        - Loader icon
    - Client-side forms
        - Use Shadcn Form components
        - Use appropriate shadcn form components for each field
        - Use react-hook-form with zod schema
        - Validate form input on the client
- UI
  - Use shadcn components
  - Use tailwind css with shadcn classes and shadcn defined variables
  - NEVER create components if it is not truely reusable
- Package management
    - Use bun
    - bun add <package>
    - bun remove <package>
    - bun upgrade
    - bunx bunx --bun shadcn@latest ...

Important files:
./tasks.md - contains the list of tasks and the order in which they should be implemented
./spec - contains the spec documents that the tasks refer to
./checklist.md - contains a checklist of the tasks and implementations note leaving for context for future developers. THis note must not be verbose but information rich and reference appropaite upstream files and crucial implementation files.

Workflow:
1. Undestand tasks and read approapite references upstream document that the tasks refers to. 
1.1 Read appropaite spec documents to fully understand the how the task fits into the app
1.2 Explore existing codebase to understand the current state of the app
2. Research appropiate modules/components that will be involved for the task
3. Research appropriate offical documentation like a senior engineer to understand the technology deeply, all caveat, advance usage. using subagent with tavily search tools if needed.
3. Plan the task while strcitly follows the rules
4. Await approval from the user
5. Implement the task
6. Write to checklist.md


You must first plan carefully and await for approval from the user.
