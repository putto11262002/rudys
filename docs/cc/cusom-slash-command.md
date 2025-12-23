# Custom Slash Commands (Claude Code)

Custom slash commands are Markdown prompt files that you run like `/<command>`.

## Where commands live

- Project (recommended): `.claude/commands/` (shared in repo)
- Personal: `~/.claude/commands/` (your machine only)

If a project and personal command share the same name, the **project** command wins.

## Naming + discovery rules

- **Command name = filename (no `.md`).** Example: `.claude/commands/review.md` → `/review`.
- Prefer `kebab-case` names (`fix-tests`, `write-changelog`).
- Subfolders are for organization; they **don’t change the command name** (only how it’s grouped/labelled in help).

## File format

Files are Markdown with optional YAML frontmatter.

Minimal:

```md
---
description: One-line summary shown in help
argument-hint: "What to type after /command (optional)"
---

Write the instructions here.
Use $ARGUMENTS (or $1, $2, ...) for user-provided input.
```

## Frontmatter fields (reference)

- `description`:
  - Shown in command lists/help.
  - Required if you want the model to invoke it via the `SlashCommand` tool.
- `argument-hint`: UI hint for expected args.
- `allowed-tools`: tools the command is allowed to use (important for Bash / MCP tools).
- `model`: request a specific model for this command.
- `disable-model-invocation`: if `true`, prevents tool-based invocation.

## Arguments

- `$ARGUMENTS`: the entire argument string after the command.
- `$1`, `$2`, …: positional args.

Example:

```md
---
description: Summarize a file with optional focus
argument-hint: "@path [focus...]"
---

Summarize $1. Focus on: $ARGUMENTS
```

## File references (`@path`)

Use `@relative/or/absolute/path` in the command body to pull in files.

Practical rules:
- Prefer referencing **specific files**, not whole directories.
- Keep references minimal; commands are easier to run and cheaper to execute.

## Running Bash before the prompt (`!`)

You can prefix a shell command with `!` to run it and feed its output into the context.

Example:

```md
---
description: Review current git diff
allowed-tools: Bash
---

!git diff --stat
!git diff

Review the diff. Call out risky changes and suggest improvements.
```

Safety rules:
- Keep `!` commands **read-only** by default (diffs, status, logs).
- Avoid destructive operations unless the command is explicitly meant for that and clearly labeled.

## Tool-based invocation (advanced)

Claude can only invoke a custom command through the `SlashCommand` tool when:
- It’s a **user-defined** command (not built-in), and
- `description` is set (non-empty), and
- Permissions allow it, and
- `disable-model-invocation` is not `true`.

## Troubleshooting

- Command not listed: confirm the file is under `.claude/commands/` (or `~/.claude/commands/`) and ends with `.md`.
- Wrong name: verify the filename (e.g. `review.md` → `/review`).
- No args seen: ensure you typed `/<name> ...` and use `$ARGUMENTS` or `$1`.
- `!` not running: ensure `allowed-tools` includes `Bash` and permissions allow it.
