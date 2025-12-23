# Memory (Claude Code): concept + setup

## What “memory” means in Claude Code

Claude Code memory is **a set of Markdown instruction files** that are automatically loaded into context to provide persistent preferences and project conventions across sessions.

Use memory for:
- Coding conventions (formatting, naming, patterns)
- Repo workflow (test commands, branching, PR expectations)
- Domain rules (data invariants, API contracts, “don’t do X”)
- Safety constraints (no prod writes, secrets handling)

Avoid using memory for:
- Large docs/specs (link to them instead)
- Secrets (never store tokens/credentials)

## Where memory comes from (layers + priority)

Memory is loaded in layers, from general to specific:

1) **Enterprise policy** (org-managed, if applicable)
2) **User memory**: `~/.claude/CLAUDE.md` (your defaults for all projects)
3) **User rules**: `~/.claude/rules/**/*.md` (optional modular rules)
3) **Project memory**:
   - `./CLAUDE.md` (repo root)
   - or `./.claude/CLAUDE.md` (same idea, more “hidden”)
4) **Project rules**: `./.claude/rules/**/*.md` (modular rules; can be path-scoped)
5) **Local project memory**: `./CLAUDE.local.md` (personal notes for this repo; typically added to `.gitignore`)

If both user and project rules exist, **project rules win** for the project.

## Discovery: how Claude finds the right `CLAUDE.md`

When you run Claude Code in a directory, it searches **upward from the current working directory** for:
- `CLAUDE.md`
- `CLAUDE.local.md`

It can also discover additional `CLAUDE.md` files **inside subdirectories**, but those are typically loaded only when Claude is working in/reading those subtrees.

## `@imports`: compose memory from smaller files

In a `CLAUDE.md`, you can include other files using `@path/to/file`.

Rules of thumb:
- Prefer small imported files (one topic each) over a giant `CLAUDE.md`.
- Keep import depth shallow (imports are limited, e.g. max 5 hops).
- Don’t rely on imports inside code blocks/spans (they aren’t processed there).

Example:

```md
# Repo conventions

@.claude/rules/typescript.md
@.claude/rules/testing.md
@notes/architecture.md
```

## `.claude/rules/`: modular, scoped rules

Put reusable rules into `./.claude/rules/` as separate `.md` files.

Why:
- Easier review and ownership (one file per domain)
- Can scope rules to paths
- Avoids turning `CLAUDE.md` into a dumping ground

### Path-scoped rules (`paths:`)

Add YAML frontmatter with `paths:` to apply rules only to matching files.

Example:

```md
---
paths:
  - "app/**"
  - "components/**"
---

Frontend rules:
- Use server components by default.
- Prefer `fetch` wrappers in `lib/api/*`.
```

## Recommended setup (practical)

1) Add repo-wide conventions:
- Create `./CLAUDE.md`
- Put high-level “how we work” rules there
- Import deeper topic files using `@...`

2) Add modular rules:
- Create `./.claude/rules/`
- Add rule files like:
  - `./.claude/rules/testing.md`
  - `./.claude/rules/typescript.md`
  - `./.claude/rules/security.md`
  - `./.claude/rules/ui.md`

3) Add personal notes (optional):
- Create `./CLAUDE.local.md` for your own TODOs/shortcuts

## What to put in each file (cheat sheet)

- `~/.claude/CLAUDE.md`:
  - Your preferred tone/format
  - Default tooling (e.g., always run unit tests after edits)
  - Personal editor/OS constraints

- `./CLAUDE.md` or `./.claude/CLAUDE.md`:
  - “How to work in this repo” (commands, directories, conventions)
  - Links/imports to deeper rules
  - High-level guardrails

- `./.claude/rules/**/*.md`:
  - Rules that are specific to a subsystem
  - Path-scoped rules (frontend/backend/tests)

- `./CLAUDE.local.md`:
  - Your local workflow notes
  - Temporary constraints (e.g., “avoid touching X during migration”)

## Operating tips

- Use `/memory` to review what Claude Code has loaded for the current session.
- Keep memory short and enforceable: write rules that can be checked in code review.
- Prefer “Do/Don’t” bullets and concrete commands over philosophy.
