---
# Copyright (c) 2025-2026 Juliusz Ćwiąkalski (https://www.cwiakalski.com | https://www.linkedin.com/in/juliusz-cwiakalski/ | https://x.com/cwiakalski)
# MIT License - see LICENSE file for full terms
source: https://github.com/juliusz-cwiakalski/agentic-delivery-os/blob/main/README.md
---
<p align="center">
  <a href="./assets/hero.png">
    <picture>
      <source srcset="assets/hero.webp" type="image/webp" />
      <img
        src="./assets/hero.png"
        alt="Agentic Delivery OS - Ship faster. Break less. AI-Native SDLC"
        width="880"
      />
    </picture>
  </a>
</p>

# Agentic Delivery OS (ADOS)

Turn AI from "chat assistance" into a repeatable, auditable delivery system:

ticket -> spec -> plan -> test plan -> code -> [/review](.opencode/command/review.md) -> [/sync-docs](.opencode/command/sync-docs.md) -> [/check](.opencode/command/check.md) -> [/pr](.opencode/command/pr.md) -> release

This repo is a practical reference implementation of a spec-driven workflow using OpenCode (and supporting Claude Code):

- Artifacts are first-class (versioned in Git), not trapped in chats.
- Deterministic quality gates define "done".
- The workflow is tracker-agnostic: the tracker owns status, Git stores the delivery artifacts.
- The repo maintains a continuously updated "current system spec" under `doc/spec/**` (created if missing; reconciled after each accepted change).

> Note: `doc/spec/**` may not exist in a fresh repo; it's created/updated by the workflow (see [/sync-docs](.opencode/command/sync-docs.md)).

<!-- TOC -->
* [Agentic Delivery OS (ADOS)](#agentic-delivery-os-ados)
  * [Why this exists](#why-this-exists)
  * [What this gives you](#what-this-gives-you)
  * [Installation](#installation)
    * [Quick Start](#quick-start)
      * [For Claude Code users](#for-claude-code-users)
    * [Installation Modes](#installation-modes)
    * [Tool Selection (OpenCode only)](#tool-selection-opencode-only)
  * [Benefits](#benefits)
  * [Intention](#intention)
  * [Docs at a glance](#docs-at-a-glance)
  * [What is implemented here](#what-is-implemented-here)
  * [Multi-tool support](#multi-tool-support)
  * [Autopilot (PM-driven)](#autopilot-pm-driven)
  * [Typical workflow (manual)](#typical-workflow-manual)
  * [Change artifacts (tracker-agnostic)](#change-artifacts-tracker-agnostic)
  * [Repo structure](#repo-structure)
  * [License](#license)
  * [Author](#author)
<!-- TOC -->

## Why this exists

AI can generate code quickly, but most teams struggle to use it reliably at scale:

- Prompts live in DMs and chat logs (not versioned, not repeatable)
- Output quality varies day-to-day ("prompt roulette")
- Delivery still needs specs, acceptance criteria, test strategy, reviews, docs, release discipline
- Tooling glue work persists between Jira/Git/CI/docs

Agentic Delivery OS codifies a predictable pipeline where quality and traceability are non-negotiable.

## What this gives you

- A team of 19 repo-local agents aligned to SDLC roles (PM, spec writer, planner, coder, reviewer, bootstrapper, and more).
- A standard artifact set (spec, implementation plan, test plan) stored under `doc/changes/` using stable, tracker-linked names.
- A versioned, human-readable system spec under `doc/spec/**` that acts as the baseline input for planning the next change (kept up to date via [`/sync-docs`](.opencode/command/sync-docs.md)).
- Commands that compose those agents into repeatable workflows (manual or autopilot).

## Installation

### Quick Start

**For OpenCode users:**

```bash
# Global (all projects)
curl -fsSL https://raw.githubusercontent.com/juliusz-cwiakalski/agentic-delivery-os/main/scripts/install.sh | bash -s -- --global

# Local (current project)
~/.ados/repo/scripts/install.sh --local
```

Then in your AI coding agent:

```text
/bootstrap                                  # AI-guided configuration
```

#### For Claude Code users

**Recommended: Install from GitHub marketplace**

```bash
# Step 1: Add ADOS marketplace (one-time setup)
/plugin marketplace add juliusz-cwiakalski/agentic-delivery-os

# Step 2: Install ADOS plugin
/plugin install ados@ados
```

This uses the `git-subdir` source to load ADOS directly from the GitHub repository.

**For local development (contributors):**

```bash
claude --plugin-dir .ados-claude
```

This loads ADOS directly from the local repo — useful for contributors testing changes.

### Installation Modes

| Mode | OpenCode Target | Claude Code Target |
|------|-----------------|-------------------|
| `--global` | `~/.config/opencode/` | Use `/plugin marketplace add` |
| `--local` | `./.opencode/` | `claude --plugin-dir .ados-claude` |

### Tool Selection (OpenCode only)

```bash
--tool opencode    # OpenCode only (default)
--tool claude      # Not needed - use /plugin commands instead
--tool all         # Not needed - install separately per tool
```

**Uninstall:** `~/.ados/repo/scripts/uninstall.sh --global` or `~/.ados/repo/scripts/uninstall.sh --local`

> **Update:** Re-run the same install commands to update to the latest version.

> Full guide: [doc/guides/onboarding-existing-project.md](doc/guides/onboarding-existing-project.md)

## Benefits

- Less ambiguity: specs and test plans are explicit before code is written.
- Predictable planning: next changes can start from the current system spec (`doc/spec/**`) instead of rebuilding context from chat history.
- Higher trust: [/review](.opencode/command/review.md) and [/check](.opencode/command/check.md) run against artifacts, not vibes.
- Quality is non-negotiable: [/review](.opencode/command/review.md) iterates until PASS and [/check](.opencode/command/check.md) is green before you get a PR/MR (via [/pr](.opencode/command/pr.md)) to look at.
- Faster iteration: agents can find the right context deterministically (stable paths, no global indexes).
- Better auditability: tickets link to change folders, branches, PR descriptions, and logs.
- Less noise: in autopilot mode, the tracker is the interface; the [@pm](.opencode/agent/pm.md) agent pings you only when decisions/clarifications/reviews are needed.

## Intention

This project exists to evolve and validate an AI-native delivery operating model on real work: reduce "prompt roulette", keep humans accountable, and make shipping faster without lowering quality.

## Docs at a glance

- AI agent & contributor quick-reference: [AGENTS.md](AGENTS.md)
- How to use the agents/commands: [doc/guides/opencode-agents-and-commands-guide.md](doc/guides/opencode-agents-and-commands-guide.md)
- Change delivery lifecycle (10-phase workflow): [doc/guides/change-lifecycle.md](doc/guides/change-lifecycle.md)
- Change folder + naming convention (workItemRef, branches, files): [doc/guides/unified-change-convention-tracker-agnostic-specification.md](doc/guides/unified-change-convention-tracker-agnostic-specification.md)
- Broader docs layout standard (some details may differ per repo): [doc/documentation-handbook.md](doc/documentation-handbook.md)
- Tooling definitions (agents/commands): [.opencode/README.md](.opencode/README.md)
- Tracker/PM setup for autopilot mode: [.ai/agent/pm-instructions.md](.ai/agent/pm-instructions.md)
- Onboarding guide (adopt ADOS in your project): [doc/guides/onboarding-existing-project.md](doc/guides/onboarding-existing-project.md)

## What is implemented here

OpenCode tooling (see [.opencode/README.md](.opencode/README.md) for the authoritative list):

- **19 agents** for SDLC roles:
  - [@pm](.opencode/agent/pm.md), [@coder](.opencode/agent/coder.md), [@spec-writer](.opencode/agent/spec-writer.md), [@plan-writer](.opencode/agent/plan-writer.md), [@test-plan-writer](.opencode/agent/test-plan-writer.md), [@reviewer](.opencode/agent/reviewer.md), [@doc-syncer](.opencode/agent/doc-syncer.md), [@pr-manager](.opencode/agent/pr-manager.md), [@runner](.opencode/agent/runner.md), [@fixer](.opencode/agent/fixer.md), [@committer](.opencode/agent/committer.md), [@architect](.opencode/agent/architect.md), [@editor](.opencode/agent/editor.md), [@designer](.opencode/agent/designer.md), [@image-generator](.opencode/agent/image-generator.md), [@image-reviewer](.opencode/agent/image-reviewer.md), [@bootstrapper](.opencode/agent/bootstrapper.md), [@external-researcher](.opencode/agent/external-researcher.md), [@toolsmith](.opencode/agent/toolsmith.md).
- **16 commands** that compose them into a repeatable workflow:
  - [/plan-change](.opencode/command/plan-change.md), [/write-spec](.opencode/command/write-spec.md), [/write-plan](.opencode/command/write-plan.md), [/write-test-plan](.opencode/command/write-test-plan.md), [/run-plan](.opencode/command/run-plan.md), [/review](.opencode/command/review.md), [/review-deep](.opencode/command/review-deep.md), [/sync-docs](.opencode/command/sync-docs.md), [/check](.opencode/command/check.md), [/check-fix](.opencode/command/check-fix.md), [/pr](.opencode/command/pr.md), [/commit](.opencode/command/commit.md), [/plan-decision](.opencode/command/plan-decision.md), [/write-decision](.opencode/command/write-decision.md), [/bootstrap](.opencode/command/bootstrap.md), [/design](.opencode/command/design.md).

## Multi-tool support

ADOS supports multiple AI coding tools while maintaining a **single source of truth** for agent and command definitions:

- **`.opencode/`** — Canonical source for all agent/command definitions
- **`.ados-claude/`** — Generated Claude Code plugin (committed to repo, ready to use)

The build script `scripts/build-claude-plugin.sh` transforms `.opencode/` definitions to Claude Code format. This ensures:

1. No duplicate definitions to maintain
2. All tools get the same prompts
3. Model assignments are tool-specific (via `claude.model` frontmatter)

**For Claude Code users:**

The `.ados-claude/` directory is pre-generated and committed to the repo. No build step required.

Install options:

- **Marketplace (recommended):**
  ```
  /plugin marketplace add juliusz-cwiakalski/agentic-delivery-os
  /plugin install ados@ados
  ```
- **Local development:** `claude --plugin-dir .ados-claude`

Point Claude Code at the plugin root (`.ados-claude/`), not at the `agents/` or `skills/` subdirectories — Claude Code reads `.claude-plugin/plugin.json` from the directory you pass.

**Marketplace structure:**
- `.claude-plugin/marketplace.json` (repo root) - Tells Claude Code where to find the ADOS plugin
- `.ados-claude/.claude-plugin/plugin.json` - The actual plugin manifest (inside the plugin directory)

**For OpenCode users:**

No changes — continue using `.opencode/` as before. The `claude:` frontmatter key is ignored by OpenCode.

**Adding new tools:**

See [doc/guides/adding-tool-support.md](doc/guides/adding-tool-support.md) for the extensibility pattern.

## Autopilot (PM-driven)

Autopilot mode is a high-level handoff: you provide a ticket reference (or URL) and the [@pm](.opencode/agent/pm.md) agent orchestrates the full delivery loop (including [/review](.opencode/command/review.md), [/sync-docs](.opencode/command/sync-docs.md), and [/check](.opencode/command/check.md)), then creates/updates a PR/MR via [/pr](.opencode/command/pr.md) only when it's ready for human review.

Example prompt:

```text
@pm deliver change GH-456
```

(You can also use a GitHub issue URL or a `workItemRef` like `GH-456`.)

## Typical workflow (manual)

For the detailed walkthrough, see [doc/guides/opencode-agents-and-commands-guide.md](doc/guides/opencode-agents-and-commands-guide.md). The common flow is:

```text
/plan-change <workItemRef?>
/write-spec <workItemRef>
/write-test-plan <workItemRef>
/write-plan <workItemRef>
/run-plan <workItemRef>
/sync-docs <workItemRef>
/review <workItemRef>
/check
/pr
```

Tool definitions: [/plan-change](.opencode/command/plan-change.md), [/write-spec](.opencode/command/write-spec.md), [/write-plan](.opencode/command/write-plan.md), [/write-test-plan](.opencode/command/write-test-plan.md), [/run-plan](.opencode/command/run-plan.md), [/review](.opencode/command/review.md), [/sync-docs](.opencode/command/sync-docs.md), [/check](.opencode/command/check.md), [/pr](.opencode/command/pr.md)

## Change artifacts (tracker-agnostic)

Changes are identified by `workItemRef` (for example `PDEV-123` for Jira or `GH-456` for GitHub). Artifacts live under:

- `doc/changes/YYYY-MM/YYYY-MM-DD--<workItemRef>--<slug>/`
- Stable filenames inside the folder:
  - `chg-<workItemRef>-spec.md`
  - `chg-<workItemRef>-plan.md`
  - `chg-<workItemRef>-test-plan.md`
  - `chg-<workItemRef>-pm-notes.yaml` (progress tracking, decisions, open questions)

After the change is implemented and accepted, the workflow reconciles the "current truth" docs (via [/sync-docs](.opencode/command/sync-docs.md)):

- `doc/spec/**` (system specification)
- `doc/contracts/**` (interfaces/contracts, when used)

Branches follow conventional-commit-aligned types:

- `<type>/<workItemRef>/<slug>` (for example `feat/PDEV-123/responsive-product-images`)

## Repo structure

```
.
├── AGENTS.md             # delivery system bootstrap (start here)
├── .opencode/            # agent and command definitions (THE product)
│   ├── agent/            # 19 agents (one .md each)
│   └── command/          # 16 commands (one .md each)
├── .ai/
│   ├── agent/            # PM tracker config (pm-instructions.md)
│   ├── local/            # git-ignored ephemeral state
│   └── rules/            # language/tool rules (bash.md)
├── scripts/              # repo-internal automation (.sh extension)
│   └── .tests/           # test files for scripts (test-*.sh)
├── tools/                # PATH-able CLI utilities (no .sh extension)
│   └── .tests/           # test files for tools (test-*.sh)
└── doc/
    ├── 00-index.md           # documentation landing page
    ├── changes/              # change artifacts (spec, plan, test-plan per workItemRef)
    ├── decisions/            # decision records (ADR/PDR/TDR/BDR/ODR)
    ├── guides/               # how-to guides
    ├── overview/             # north star, architecture, glossary
    ├── planning/             # internal planning notes
    ├── spec/                 # current system spec (reconciled after each change)
    ├── templates/            # core + optional profile-aware document templates
    ├── tools/                # CLI tool user guides
    └── documentation-handbook.md
```

## License

Open-source. See [LICENSE](LICENSE).

## Author

Maintained by Juliusz Ćwiąkalski. If you find this useful, follow me or drop by my homepage (blog + newsletter):

- LinkedIn: [@juliusz-cwiakalski](https://www.linkedin.com/in/juliusz-cwiakalski/)
- X: [@cwiakalski](https://x.com/cwiakalski)
- Website (blog + newsletter): https://www.cwiakalski.com
