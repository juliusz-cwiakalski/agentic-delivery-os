---
# Copyright (c) 2025-2026 Juliusz Ćwiąkalski (https://www.cwiakalski.com | https://www.linkedin.com/in/juliusz-cwiakalski/ | https://x.com/cwiakalski)
# MIT License - see LICENSE file for full terms
# Latest version: https://github.com/juliusz-cwiakalski/agentic-delivery-os/blob/main/AGENTS.md
---
# AGENTS.md

Quick-reference for AI coding agents and human contributors working in this repo.

## What this repo is

Agentic Delivery OS is a spec-driven software delivery system: a team of 18 AI agents and 15 commands that turn a ticket into a reviewed, tested PR through a deterministic 10-phase workflow.

The agents and their prompt definitions (`.opencode/agent/*.md`, `.opencode/command/*.md`) **are the product**. A degraded prompt degrades everything downstream — treat them with the same rigor as production code. The delivery process is used to deliver improvements to itself.

## Delivery process

Every change flows through 10 phases. `@pm` orchestrates; phases are gated but can be reopened when gaps are discovered.

| Phase | Agent | What happens |
|-------|-------|--------------|
| 1. clarify_scope | `@pm` | Read ticket via MCP, cross-check against system spec (`doc/spec/**`), STOP if questions |
| 2. specification | `@spec-writer` | Create `chg-<ref>-spec.md` (problem, goals, AC) |
| 3. test_planning | `@test-plan-writer` | Create `chg-<ref>-test-plan.md` (traceable to AC) |
| 4. delivery_planning | `@plan-writer` | Create `chg-<ref>-plan.md` (phased tasks) |
| 5. delivery | `@coder` | Execute plan phases, commit per phase |
| 6. system_spec_update | `@doc-syncer` | Reconcile `doc/spec/**` with implementation |
| 7. review_fix | `@reviewer` | Audit vs spec/plan; if FAIL → `@coder` remediates → re-review |
| 8. quality_gates | `@runner` | Build/test/lint; if failures → `@fixer` → re-run |
| 9. dod_check | `@pm` | Verify all AC met, all plan tasks done |
| 10. pr_creation | `@pr-manager` | Create PR, assign to human, STOP |

Detail: [doc/guides/change-lifecycle.md](doc/guides/change-lifecycle.md)

## Agent team

### Orchestration
- `pm` — orchestrate changes; manage tickets via MCP; never implements code
- `architect` — architecture decisions and ADR authoring

### Artifact creation
- `spec-writer` — author change specifications
- `plan-writer` — author implementation plans
- `test-plan-writer` — author test plans with traceable coverage

### Implementation
- `coder` — execute plan phases; delegates to `@designer`, `@architect`, `@committer`, `@runner`
- `designer` — visual design and UI implementation
- `editor` — content rewrites and translations

### Verification
- `reviewer` — review change vs spec/plan; append remediation if FAIL
- `fixer` — reproduce failures and apply targeted fixes
- `runner` — execute commands, capture logs (subagent)

### Documentation & release
- `doc-syncer` — reconcile system docs with completed changes
- `committer` — create one Conventional Commit
- `pr-manager` — create/update PR/MR; enrich with ticket context via MCP

### Specialized
- `external-researcher` — research via MCP (context7, deepwiki, perplexity)
- `image-generator` — generate AI images via text-to-image CLI
- `image-reviewer` — analyze screenshots and visual artifacts (subagent)
- `toolsmith` — create and tune agents, commands, and skills

Full definitions: `.opencode/agent/*.md` | Inventory: [.opencode/README.md](.opencode/README.md)

## Commands

| Command | Purpose |
|---------|---------|
| `/plan-change` | Interactive planning session (prep context for /write-spec) |
| `/write-spec <ref>` | Generate change specification |
| `/write-test-plan <ref>` | Generate test plan |
| `/write-plan <ref>` | Generate implementation plan |
| `/run-plan <ref>` | Execute plan phases |
| `/review <ref>` | Review change vs spec/plan |
| `/review-deep <ref>` | Deep review with stronger reasoning model |
| `/sync-docs <ref>` | Reconcile system docs from a change |
| `/check` | Run quality gates (no fixes) |
| `/check-fix` | Run quality gates and fix failures |
| `/commit` | Create one Conventional Commit |
| `/pr` | Create/update PR/MR |
| `/plan-decision` | Interactive architecture decision session |
| `/write-adr` | Generate Architecture Decision Record |
| `/design` | Generate/update visual design assets |

Full definitions: `.opencode/command/*.md`

## Using the system

**Autopilot** (recommended) — `@pm` orchestrates all 10 phases:

```
@pm deliver change GH-456
```

**Manual** — you trigger each step:

```
/plan-change → /write-spec <ref> → /write-test-plan <ref> → /write-plan <ref>
→ /run-plan <ref> → /review <ref> → /sync-docs <ref> → /check → /pr
```

Guide: [doc/guides/opencode-agents-and-commands-guide.md](doc/guides/opencode-agents-and-commands-guide.md)

## Extending the system

When adding or modifying agents, commands, or skills:

- **Delegate to `@toolsmith`** — it specializes in prompt engineering, model-format-aware design, and quality gates for OpenCode tooling. Do not hand-edit agent/command files directly.
- **Tune related tools together** — agents hand off to each other; changing one agent's output format can break another's input. Check upstream inputs and downstream consumers.
- **Test through the delivery process** — run modified agents on a real change to validate.
- **Update [.opencode/README.md](.opencode/README.md)** when adding, removing, or renaming tools.
- **Keep prompts tight** — verbose prompts waste tokens and reduce quality; prefer XML structure for Claude models.

## Change artifacts

Changes are identified by `workItemRef` (`GH-456` for GitHub, `PDEV-123` for Jira).

```
doc/changes/YYYY-MM/YYYY-MM-DD--<workItemRef>--<slug>/
  ├── chg-<workItemRef>-spec.md
  ├── chg-<workItemRef>-plan.md
  ├── chg-<workItemRef>-test-plan.md
  └── chg-<workItemRef>-pm-notes.yaml
```

Branches: `<type>/<workItemRef>/<slug>` (e.g., `feat/GH-456/some-feature`)

Detail: [doc/guides/unified-change-convention-tracker-agnostic-specification.md](doc/guides/unified-change-convention-tracker-agnostic-specification.md)

## Repo structure

```
.
├── AGENTS.md             # this file — delivery system bootstrap
├── .opencode/            # agent and command definitions (THE product)
│   ├── agent/            # 18 agents (one .md each)
│   └── command/          # 15 commands (one .md each)
├── .ai/
│   ├── agent/            # PM tracker config (pm-instructions.md)
│   ├── local/            # git-ignored ephemeral state
│   └── rules/            # language/tool rules (bash.md)
├── scripts/              # repo-internal automation (.sh extension)
│   └── .tests/           # test files for scripts (test-*.sh)
├── tools/                # PATH-able CLI utilities (no .sh extension)
│   └── .tests/           # test files for tools (test-*.sh)
└── doc/
    ├── changes/          # change artifacts (spec, plan, test-plan per workItemRef)
    ├── guides/           # how-to guides
    ├── spec/             # current system spec (reconciled after each change)
    └── documentation-handbook.md
```

## `tools/` and `scripts/` conventions

| Aspect | `tools/` | `scripts/` |
|--------|-------------------|------------|
| Purpose | PATH-able CLI utilities for use beyond this repo | Repo-internal automation |
| Extension | No `.sh` — invoked by name (e.g., `tools/my-tool`) | `.sh` required |
| Tests | `tools/.tests/test-<tool-name>.sh` | `scripts/.tests/test-<script-name>.sh` |

## Running tests

Test files follow the pattern `test-*.sh` inside `.tests/` subdirectories. Run with `bash <dir>/.tests/test-*.sh`.

## License headers

Every Markdown file carries a three-line YAML frontmatter: copyright, MIT license reference, and canonical URL. Bash scripts carry the same three lines as comments after the shebang. Run `scripts/add-header-location.sh <file-or-directory>` to add or update headers for both file types.

## Key references

| Document | Description |
|----------|-------------|
| [.opencode/README.md](.opencode/README.md) | Agent and command inventory, naming conventions |
| [doc/guides/change-lifecycle.md](doc/guides/change-lifecycle.md) | Change delivery lifecycle (10-phase workflow, detailed) |
| [doc/guides/opencode-agents-and-commands-guide.md](doc/guides/opencode-agents-and-commands-guide.md) | How to use agents and commands (manual + autopilot) |
| [doc/guides/unified-change-convention-tracker-agnostic-specification.md](doc/guides/unified-change-convention-tracker-agnostic-specification.md) | Change naming convention (workItemRef, folders, branches) |
| [.ai/agent/pm-instructions.md](.ai/agent/pm-instructions.md) | PM tracker configuration (GitHub/Jira setup) |
| [.ai/rules/bash.md](.ai/rules/bash.md) | Bash coding rules |
| [doc/documentation-handbook.md](doc/documentation-handbook.md) | Documentation layout standard |
| [doc/tools/text-to-image.md](doc/tools/text-to-image.md) | text-to-image CLI tool user guide and provider setup |
| [doc/guides/tools-convention.md](doc/guides/tools-convention.md) | Standard for building CLI tools in tools/ |
