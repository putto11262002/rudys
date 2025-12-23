# Skills (Claude Code): concept + setup

## What a Skill is

A Skill is a **model-invoked, reusable workflow** packaged as a folder.

Use Skills for work that benefits from:
- A repeatable process (steps, checks, templates)
- Supporting assets (scripts, prompts, reference files)
- Selective loading (“progressive disclosure”) to keep context small

Skills differ from:
- **Slash commands:** user-invoked (`/command`), usually single-file prompts.
- **Memory:** always-loaded conventions (`CLAUDE.md`, `.claude/rules/`).
- **Subagents:** separate-context specialists (`.claude/agents/`).

## Core design principles (from skill-creator best practices)

- **Be concise:** the context window is shared with everything else (system prompt, chat history, other Skills, your request). Include only what Claude wouldn’t reliably infer.
- **Choose the right “degrees of freedom”:**
  - High freedom: heuristics + guidance (multiple valid approaches).
  - Medium freedom: pseudocode / parameterized scripts (preferred pattern with variation).
  - Low freedom: exact scripts / strict steps (fragile or error-prone tasks).

## Where Skills live (sources + priority)

Skills can come from:
- Project: `./.claude/skills/<skill-name>/` (team-shared)
- User: `~/.claude/skills/<skill-name>/` (personal)
- Plugins: shipped by installed plugins

If multiple Skills share the same `name`, Claude Code prefers the **project** version.

## Required structure

Each Skill is a folder. The only required file is `SKILL.md`:

```
.claude/skills/<skill-name>/
  SKILL.md
  scripts/           (optional) - executable helpers (bash/python/etc.)
  references/        (optional) - docs to load as needed
  assets/            (optional) - templates/files used in outputs
```

## `SKILL.md` contract (reference)

`SKILL.md` must include YAML frontmatter with:
- `name` (required): lowercase letters/numbers/hyphens only, max 64 chars
- `description` (required): when to use it + what it does, max 1024 chars
- `allowed-tools` (optional): restrict tools available while the Skill is active

Notes:
- The `description` is the **primary trigger** for selection. Put “when to use this skill” in `description`, not only in the body.
- Some packaging workflows validate Skills and may require frontmatter to be **only** `name` + `description`. If you plan to distribute using such tooling, keep extra fields out.

The Markdown body defines how to run the workflow (steps, rules, output format). It’s loaded after the Skill triggers.

## How Claude decides to use a Skill

Claude Code uses the Skill’s `description` as the primary trigger signal.

Write descriptions that are:
- Task-specific (“Use when generating release notes from git history…”)
- Explicit about inputs/outputs
- Strong about when to apply (“MUST BE USED when…”, if you really mean it)

## Progressive disclosure (how to write Skills)

Skills effectively load in levels:
1) Metadata (`name` + `description`) is always available for triggering.
2) `SKILL.md` body is used when the Skill triggers.
3) Bundled resources are read/run only when needed.

Pattern:
- In `SKILL.md`, outline the workflow and reference supporting files by path.
- Only load `references/` when needed (don’t paste huge docs into `SKILL.md`).
- Prefer scripts for repeatable mechanical steps.

Practical best practices:
- Keep `SKILL.md` body lean (target <500 lines); split into references when it grows.
- Avoid duplicating the same info in both `SKILL.md` and `references/*`.
- For large reference docs (e.g. >10k words), include suggested search patterns (keywords/`rg` queries) in `SKILL.md`.
- Avoid deeply nested reference trees; keep “one hop” from `SKILL.md` to reference files.
- If a reference file is long (>100 lines), add a small table of contents at the top.

## Minimal template

Create: `.claude/skills/example-skill/SKILL.md`

```md
---
name: example-skill
description: Use when you need to do X. Inputs: Y. Output: Z.
allowed-tools: Read, Write
---

## Goal
Do X safely and consistently.

## Steps
1) Gather context (list files/commands to check).
2) Produce output (format, sections, acceptance criteria).

## Output format
- Bullet list of actions
- File paths + line numbers for code references
```

## Practical templates (copy/paste)

### 1) “Repo onboarding” skill

Path: `.claude/skills/repo-onboarding/SKILL.md`

```md
---
name: repo-onboarding
description: Use when joining a repo: summarize structure, key commands, and conventions into a short README-style brief.
allowed-tools: Read, Glob, Grep
---

## Steps
1) Identify entrypoints, build/test commands, and primary packages.
2) Summarize directory roles (max 10 bullets).
3) List “how to run” commands and common pitfalls.

## Output
- Repo map
- Run/test commands
- Conventions + gotchas
```

### 2) “Changelog writer” skill (with templates)

Folder:
```
.claude/skills/changelog-writer/
  SKILL.md
  assets/
    CHANGELOG_ENTRY.md
```

`SKILL.md`:

```md
---
name: changelog-writer
description: Use when drafting release notes or changelog entries from diffs/commits. Output must follow assets/CHANGELOG_ENTRY.md.
allowed-tools: Read, Grep, Bash
---

## Steps
1) Collect changes (git log / diff as needed).
2) Classify by user impact (Added/Changed/Fixed/Breaking).
3) Fill out the template in assets/CHANGELOG_ENTRY.md.
```

## Tool restrictions (`allowed-tools`)

Use `allowed-tools` to keep Skills safe and predictable.

Rules of thumb:
- Default to read-only tools (`Read`, `Glob`, `Grep`) unless edits are required.
- Only allow `Bash` when the Skill truly needs it; keep commands non-destructive.
- If a Skill relies on scripts, ensure they’re executable and documented.

## What not to include

Keep Skill folders minimal. Avoid “extra docs” that don’t directly help the model do the task, such as:
- `README.md`, changelogs, installation guides, or internal notes about how the Skill was made

## Troubleshooting

- Skill not used: make `description` more explicit and task-shaped (it’s the main trigger).
- Skill not loading: verify folder name, `SKILL.md` path, and valid YAML frontmatter.
- Unsure what Skills are installed: ask Claude Code “What Skills are available?”.
- Loading errors: run `claude --debug` and look for Skill load warnings/errors.
