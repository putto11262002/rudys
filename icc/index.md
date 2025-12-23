# Claude Code: high-level architecture (practical mental model)

This doc explains what Claude Code is and how it “hangs together” so you can choose the right mechanism (memory vs commands vs skills vs subagents) and keep context under control.

## What Claude Code is

Claude Code is an interactive, tool-using coding assistant you run in (or for) a codebase. It combines:
- A chat interface for intent (“what to do”),
- A tool layer for execution (read/write files, run commands, call integrations),
- A context system to keep behavior consistent (memory, commands, skills, subagents).

## Big picture

Claude Code is a chat-driven agent that:
1) Builds a **working context** (instructions + relevant files + tool outputs),
2) Chooses an approach (direct response vs delegated work),
3) Uses tools (filesystem, shell, MCP, etc.) under your permissions,
4) Produces outputs (edits, plans, summaries) back in the main thread.

The system is designed around **context management**:
- Keep stable conventions in “always-on” memory.
- Keep repeatable actions as explicit commands.
- Package larger reusable workflows as Skills.
- Offload exploratory work to subagents to avoid polluting the main thread.

## Context layers (what influences behavior)

Claude Code behavior is shaped by layers of instructions and artifacts. A practical ordering is:

1) **System + app settings**: global behavior, safety, tool availability, permissions.
2) **Memory**: persistent instructions loaded from your machine and the repo.
3) **Session context**: current conversation + the files/tool outputs you’ve pulled in.
4) **On-demand workflows**: slash commands, Skills, and subagents that can add more context/work.

## Features and when they fit

### Memory (persistent defaults)

Memory is the “always-on” rule layer: repo conventions, guardrails, and preferences that should apply broadly.

Detail: `docs/cc/memory.md`

### Slash commands (user-invoked prompts)

Slash commands are named Markdown prompts you run explicitly (`/review`, `/summarize`, etc.). They’re ideal for quick, repeatable actions you want manual control over.

Detail: `docs/cc/cusom-slash-command.md`

### Skills (model-invoked packaged workflows)

Skills are folder-packaged workflows that Claude can choose automatically based on the Skill’s `description`. They’re best when you want reusable process + bundled resources (scripts, references, assets) with progressive disclosure.

Detail: `docs/cc/skills.md`

### Subagents (delegation with separate context)

Subagents are specialist configurations that Claude can delegate to. They run in a separate context window, can have different tools/models/permission mode, and return results to the main thread.

Detail: `docs/cc/subagents.md`

## Common architecture patterns (how to combine features)

### Pattern: “Guardrails + workflow”

- Put non-negotiables in **Memory** (e.g. “never write secrets”, “run tests after changes”).
- Put the repeatable action in a **Slash command** (e.g. `/review-diff`).
- If the workflow needs assets/scripts or should auto-trigger, promote it to a **Skill**.

### Pattern: “Explore then act”

- Use a **Subagent** to search/triage/explore and report back with file paths and options.
- Apply edits in the main thread (or via a write-enabled subagent) once the direction is clear.

### Pattern: “Big domain knowledge”

- Keep the core workflow in `SKILL.md`.
- Move heavy docs/schemas into `references/` and load them only when needed.
- Add scripts for fragile or repetitive steps.

## Practical decision table

| Need | Use |
|------|-----|
| Always-on repo rules | Memory |
| Manual “button-like” action | Slash command |
| Auto-selected, resource-backed workflow | Skill |
| Separate-context investigation or specialist work | Subagent |

## Where our docs live

- `docs/cc/memory.md`
- `docs/cc/cusom-slash-command.md`
- `docs/cc/skills.md`
- `docs/cc/subagents.md`
