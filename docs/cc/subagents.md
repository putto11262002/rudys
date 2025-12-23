# Subagents (Claude Code): concept + Markdown setup

## Concept

A subagent is a **specialist assistant** Claude Code can delegate work to.

What changes with a subagent:
- **Separate context:** it runs in its own context window to keep the main thread clean.
- **Focused instructions:** it uses the Markdown body as its specialist guidance.
- **Tool scoping:** you can restrict tools (or let it inherit all tools from the main session).
- **Optional model + permission mode:** you can pin a model and tune how it behaves with permissions.

Limits:
- Subagents **cannot spawn other subagents**.
- Each run may need to re-collect context (separation trades off with speed).

## How subagents get used

- **Explicit:** “Use the `test-runner` subagent to run tests and summarize failures.”
- **Automatic:** Claude Code may choose a subagent based on its `description` and the task.

Tip: Put strong triggers in `description` (e.g. “PROACTIVELY”, “MUST BE USED”) if you want it selected more often.

## Where subagent files live (priority)

- Project: `.claude/agents/*.md` (highest priority)
- Session-defined (CLI): lower than project, higher than user
- User: `~/.claude/agents/*.md`

If names conflict, the **project** subagent wins.

## Preferred workflow

Use `/agents` to create/edit/manage subagents and tool permissions without restarting.

Manual file edits are fine, but may require a new session to load.

## Markdown format (reference)

Create a file like: `.claude/agents/<agent>.md`

Frontmatter fields:
- `name` (required): lowercase + hyphens (example: `test-runner`)
- `description` (required): what it does + when to use it
- `tools` (optional): comma-separated tool list; omit to inherit all tools from main (including MCP)
- `model` (optional): `sonnet` | `opus` | `haiku` | `inherit`
- `permissionMode` (optional): `default` | `acceptEdits` | `bypassPermissions` | `plan` | `ignore`
- `skills` (optional): list of skills to enable (if your setup supports skills)

Body:
- The Markdown body is the subagent’s guidance (rules, workflow, output format).

## Minimal template

```md
---
name: code-explorer
description: PROACTIVELY explore the repo and report findings with file paths + line numbers.
tools: Read, Glob, Grep
model: haiku
permissionMode: default
---

Goal: quickly locate relevant code and summarize structure and call sites.

Rules:
- Prefer searching first, then targeted file reads.
- Include file paths + line numbers in every finding.
- Don’t edit code unless explicitly asked.
```

## Practical templates (copy/paste)

### Test runner

```md
---
name: test-runner
description: MUST BE USED to run tests, interpret failures, and propose minimal fixes.
tools: Bash, Read, Grep
model: sonnet
permissionMode: acceptEdits
---

Workflow:
- Run the smallest relevant test command first; expand only if needed.
- Summarize failures with exact error lines and file paths.
- Propose the smallest fix consistent with repo conventions.
```

### Docs writer

```md
---
name: docs-writer
description: PROACTIVELY draft concise, rule-focused docs and check for consistency.
tools: Read, Write
model: sonnet
permissionMode: acceptEdits
---

Writing rules:
- Practical, not verbose.
- Prefer checklists, templates, “Do/Don’t”, and “Troubleshooting”.
```

## Tool scoping rules (important)

- If you **omit** `tools`, the subagent typically inherits **all** tools available to the main session.
- If you **set** `tools`, keep it minimal for safety and predictability.

## Troubleshooting

- Subagent not visible in `/agents`: confirm it’s in `.claude/agents/` and restart (or create it via `/agents`).
- Wrong tools/behavior: verify `tools` / `permissionMode` and your Claude Code permissions settings.
- Not chosen automatically: make the `description` more explicit (“Use when…”, “MUST BE USED…”).
