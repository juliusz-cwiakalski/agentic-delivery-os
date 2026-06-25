---
# Copyright (c) 2025-2026 Juliusz Ćwiąkalski (https://www.cwiakalski.com | https://www.linkedin.com/in/juliusz-cwiakalski/ | https://x.com/cwiakalski)
# MIT License - see LICENSE file for full terms
source: https://github.com/juliusz-cwiakalski/agentic-delivery-os/blob/main/.opencode/README.md
---
# OpenCode Tooling (Repo)

Repo-local OpenCode agents, commands, and skills.

## Layout (This Repo)

- Agents: `.opencode/agent/*.md`
- Commands: `.opencode/command/*.md`
- Skills: `.opencode/skills/<skill-name>/SKILL.md`

Note: OpenCode upstream docs use `.opencode/agents/` and `.opencode/commands/`. This repo uses singular folders.

## Conventions

- Naming: kebab-case; agent/command name = filename; skill name = folder name.
- Descriptions: frontmatter `description` stays short (usually 3-10 words).
- Commands: accept args via `$ARGUMENTS` and optional `$1`, `$2`, ...
- Commands: prefer `subtask: true` for non-trivial work (avoid polluting main context).
- Context: keep `@path` includes narrow; keep `!` shell injections small and deterministic.
- Repo rules: if a tool runs repo workflows (build/test/docs), follow `AGENTS.md`.
- Consistency: if a new tool overlaps an existing workflow area (change lifecycle, quality gates, docs, UI), match the established patterns unless explicitly diverging.
- Prompt tuning: when updating existing tools, preserve intent and keep diffs minimal.
- Tool suites: when a workflow spans multiple tools, tune them together (contracts, arguments, outputs, delegation).
- Hygiene: update this file whenever you add/rename/remove a tool or materially change its intent.
- PM tracker config: `@pm` reads `.ai/agent/pm-instructions.md` (repo-specific Jira/GitHub workflow).
- PR/MR platform config: `@pr-manager`, `@reviewer`, `@review-feedback-applier` read `.ai/agent/pr-instructions.md` (repo-specific PR/MR platform and CLI commands).
- PM delegation: `@pm` delegates debugging to `@fixer`, commits to `@committer`, and command execution to `@runner`.
- Pre-PR gate (autopilot): `@pm` runs `@reviewer` + `@doc-syncer` before `@pr-manager`.
- Model configuration: models are assigned in `opencode*.jsonc` config files, NOT in agent/command definitions. Agent files describe behavior; config files define which model runs them.

## Agents

- `decision-advisor`: decisions of all types (architecture, product, business, technical, operating); decision record authoring (ADR/PDR/TDR/BDR/ODR) _(formerly `architect`)_
- `decision-critic`: independent, read-only decision challenger; tri-state verdict (PASS / PASS_WITH_RISKS / REWORK)
- `bootstrapper`: automate ADOS adoption for existing projects
- `coder`: implement plan phases by writing code for a change
- `committer`: create one Conventional Commit
- `designer`: visual design and UI implementation
- `doc-syncer`: reconcile system docs with change
- `editor`: rewrite/translate content per repo guidelines
- `external-researcher`: research external sources via MCP
- `fixer`: reproduce and fix failures
- `image-generator`: generate AI images via text-to-image CLI
- `image-reviewer`: analyze images, screenshots, and visual artifacts
- `meeting-organizer`: prepare agendas and summarize meeting docs
- `plan-writer`: author change implementation plans
- `pm`: orchestrate changes; manage tickets via MCP (reads `.ai/agent/pm-instructions.md`)
- `pr-manager`: create/update PR/MR for branch; enriches description with ticket context via MCP
- `review-feedback-applier`: classify and apply accepted review feedback from PR/MR
- `reviewer`: review changes against spec, plan, code quality heuristics, and repo rules (local + remote modes)
- `runner`: run commands and capture logs
- `spec-writer`: author change specifications
- `test-plan-writer`: author change test plans
- `toolsmith`: create and tune OpenCode tooling

## Commands

- `/apply-review-feedback`: classify and apply accepted PR/MR review feedback locally (via `@review-feedback-applier`)
- `/bootstrap`: scaffold ADOS artifacts for an existing project
- `/check`: run quality gates (no fixes)
- `/check-fix`: run quality gates and fix failures
- `/commit`: create one Conventional Commit
- `/decision-index`: regenerate the decision-record index + Health report (`tools/generate-decision-index`; read-only w.r.t. records, mutates only `00-index.md`)
- `/design`: generate/update visual design assets
- `/plan-change`: plan a change (prep context)
- `/plan-decision`: interactive decision session (any type: architecture, product, business, technical, operating)
- `/pr`: create/update PR/MR and sync title/description (`tmp/pr/<branch>/description.md`, via `@pr-manager`); fetches ticket context from Jira/GitHub when `workItemRef` is detected
- `/review`: review a change vs spec/plan
- `/review-deep`: deeper review vs spec/plan
- `/review-decision`: independent decision challenge (delegates to `@decision-critic`)
- `/review-remote`: review open PR/MR diff and optionally publish findings (via `@reviewer` remote mode)
- `/run-plan`: execute an implementation plan
- `/sync-docs`: reconcile system specs from a change
- `/write-decision`: write a decision record (ADR/PDR/TDR/BDR/ODR) from planning context
- `/write-plan`: generate an implementation plan
- `/write-spec`: generate a change spec
- `/write-test-plan`: generate a change test plan
