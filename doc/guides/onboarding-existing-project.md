---
# Copyright (c) 2025-2026 Juliusz Ćwiąkalski (https://www.cwiakalski.com | https://www.linkedin.com/in/juliusz-cwiakalski/ | https://x.com/cwiakalski)
# MIT License - see LICENSE file for full terms
source: https://github.com/juliusz-cwiakalski/agentic-delivery-os/blob/main/doc/guides/onboarding-existing-project.md
---
# Onboarding an Existing Project to ADOS

> **Audience:** Engineers and tech leads adopting Agentic Delivery OS (ADOS) in an existing project.
>
> **Goal:** Step-by-step guide to set up the minimum viable ADOS configuration, with clear distinction between mandatory and optional artifacts.

---

<!-- TOC -->
* [Onboarding an Existing Project to ADOS](#onboarding-an-existing-project-to-ados)
  * [Getting ADOS](#getting-ados)
    * [Keeping ADOS Updated](#keeping-ados-updated)
  * [Prerequisites](#prerequisites)
  * [Artifact Checklist](#artifact-checklist)
  * [Choose Your Setup Path](#choose-your-setup-path)
  * [Automated Bootstrap](#automated-bootstrap)
  * [Manual Setup (Step-by-Step)](#manual-setup-step-by-step)
    * [Step 1: Mandatory Artifacts](#step-1-mandatory-artifacts)
    * [1.1 `AGENTS.md` (Project Root)](#11-agentsmd-project-root)
    * [1.2 `.ai/agent/pm-instructions.md`](#12-aiagentpm-instructionsmd)
      * [Mandatory Sections](#mandatory-sections)
      * [Recommended Extensions](#recommended-extensions)
      * [What NOT to include](#what-not-to-include)
      * [Example: GitHub Issues (Minimal)](#example-github-issues-minimal)
      * [Example: Jira (with common extensions)](#example-jira-with-common-extensions)
      * [Example: Local Markdown Backlog (Git-native)](#example-local-markdown-backlog-git-native)
    * [1.3 `doc/documentation-handbook.md`](#13-docdocumentation-handbookmd)
  * [Step 2: Recommended Artifacts (Optional)](#step-2-recommended-artifacts-optional)
    * [2.1 `doc/00-index.md` — Documentation Landing Page](#21-doc00-indexmd--documentation-landing-page)
    * [2.2 `doc/overview/` — Project Overview](#22-docoverview--project-overview)
    * [2.3 `doc/spec/features/` — Feature Specifications](#23-docspecfeatures--feature-specifications)
    * [2.4 `doc/templates/` — Document Templates](#24-doctemplates--document-templates)
    * [2.5 `doc/decisions/` — Decision Records](#25-docdecisions--decision-records)
    * [2.6 `doc/guides/` — Project-Specific Guides](#26-docguides--project-specific-guides)
  * [Step 3: Decision Records Setup](#step-3-decision-records-setup)
  * [Step 4: First Change Walkthrough](#step-4-first-change-walkthrough)
    * [Using Autopilot (Recommended)](#using-autopilot-recommended)
    * [Using Manual Commands](#using-manual-commands)
  * [Troubleshooting](#troubleshooting)
    * ["Agent can't find my issue tracker"](#agent-cant-find-my-issue-tracker)
    * ["Templates are not being used"](#templates-are-not-being-used)
    * ["Decision records workflow doesn't work"](#decision-records-workflow-doesnt-work)
    * ["Change artifacts are in the wrong location"](#change-artifacts-are-in-the-wrong-location)
    * ["Agents reference files that don't exist"](#agents-reference-files-that-dont-exist)
    * ["PM agent can't read or update tickets" / MCP tracker setup](#pm-agent-cant-read-or-update-tickets--mcp-tracker-setup)
  * [Related Guides](#related-guides)
<!-- TOC -->

## Getting ADOS

**One-liner global install** (recommended — gives you ADOS agents in every project):

```bash
curl -fsSL https://raw.githubusercontent.com/juliusz-cwiakalski/agentic-delivery-os/main/scripts/install.sh | bash -s -- --global
```

This clones ADOS to `~/.ados/repo/` and installs all agent and command definitions globally.

**Then set up a specific project:**

```bash
~/.ados/repo/scripts/install.sh --local
```

This copies all ADOS framework artifacts into your project: documentation handbook, guides, templates, decision record stubs, AI rules index, and creates required directory structure. Re-running updates everything to the latest ADOS version.

**Alternative — manual clone:**

```bash
git clone --depth=1 https://github.com/juliusz-cwiakalski/agentic-delivery-os.git /tmp/ados-source
```

> **Tip:** Use `--dry-run` with either install mode to preview changes before applying them.
> Use `--interactive` to review diffs for each changed file before accepting updates.
> Use `--no-fetch` to skip automatic ADOS repo update before local install.
> To remove ADOS later, run `~/.ados/repo/scripts/uninstall.sh --global` or `~/.ados/repo/scripts/uninstall.sh --local`.

### Keeping ADOS Updated

Re-run `install.sh --local` to update all framework artifacts to the latest ADOS version:

```bash
~/.ados/repo/scripts/install.sh --local
```

This automatically:
- Fetches the latest ADOS from GitHub (skip with `--no-fetch`)
- Updates guides, templates, handbook, and other framework files
- Preserves your project-specific files (PM instructions, custom rules)

To review changes before accepting them:

```bash
~/.ados/repo/scripts/install.sh --local --interactive
```

Interactive mode shows a diff for each changed file and lets you accept or skip individually.

---

## Prerequisites

Before starting, ensure you have:

- A **git repository** for your project
- **[OpenCode](https://opencode.ai)** — the AI coding agent that ADOS currently targets. OpenCode provides the agent/command framework that ADOS definitions use. Other tools (Claude Code CLI, Cursor, Windsurf) may work with manual configuration but are not officially tested.
- An **AI provider API key** — OpenCode requires access to an LLM provider (e.g., Anthropic API key for Claude). See [OpenCode docs](https://opencode.ai) for setup.
- Basic familiarity with ADOS concepts (see [Agents & Commands Guide](opencode-agents-and-commands-guide.md))
- Access to your team's issue tracker (GitHub Issues or Jira)

> **What to expect:**
> - **Automated bootstrap:** ~15 minutes (scan + interview + review)
> - **Manual setup:** ~30 minutes (copy files, configure tracker, create stubs)
> - **First change (full 10-phase workflow):** ~1 hour
> - **Ongoing changes:** 15-30 minutes each (agents handle most phases automatically)

---

## Supported AI Coding Tools

ADOS supports multiple AI coding tools:

### OpenCode (Primary)

OpenCode is the primary target for ADOS. Install with:

```bash
curl -fsSL https://raw.githubusercontent.com/juliusz-cwiakalski/agentic-delivery-os/main/scripts/install.sh | bash -s -- --global
```

### Claude Code (Plugin)

Claude Code users can install ADOS as a plugin. Claude Code supports multiple model providers — see [Claude Code Setup Guide](claude-code-setup.md) for provider configuration (Anthropic API, Z.AI GLM Coding Plan).

**Recommended: Install from GitHub marketplace**

```bash
# Step 1: Add ADOS marketplace (one-time setup)
/plugin marketplace add juliusz-cwiakalski/agentic-delivery-os

# Step 2: Install ADOS plugin
/plugin install ados@ados
```

**For local development (contributors):**

```bash
claude --plugin-dir .ados-claude
```

This loads ADOS directly from the local repo.

### Other tools

See [doc/guides/adding-tool-support.md](adding-tool-support.md) for extending ADOS to other tools (Copilot CLI, Codex, etc.)

---

## Artifact Checklist

ADOS is both a framework you adopt **and** a system that uses itself. Some artifacts are generic (copy as-is from the ADOS repo), while others must be written specifically for your project. Use this table to plan your setup:

| Artifact | Path | Action | Notes |
|----------|------|--------|-------|
| **Mandatory** | | | |
| AGENTS.md | `AGENTS.md` | Copy & customize | Customize project description, repo structure, key references |
| PM instructions | `.ai/agent/pm-instructions.md` | Auto-installed, customize | `install.sh --local` creates stub; customize for your tracker |
| Documentation handbook | `doc/documentation-handbook.md` | Auto-installed | `install.sh --local` installs and keeps updated |
| **Recommended** | | | |
| Documentation index | `doc/00-index.md` | Auto-installed, customize | Update links to match your docs |
| Document templates | `doc/templates/` | Auto-installed | 7 templates — agents read at runtime |
| Decision records dir | `doc/decisions/` | Auto-installed | README.md + 00-index.md stubs |
| AI rules index | `.ai/rules/README.md` | Auto-installed, customize | Add project-specific rules to routing table |
| ADOS guides | `doc/guides/` | Auto-installed | 9 framework guides — change lifecycle, conventions, etc. |
| **Optional (create as needed)** | | | |
| Project overview | `doc/overview/` | Create & customize | North star, architecture, glossary |
| Feature specs | `doc/spec/features/` | Create & customize | Current-truth feature descriptions |
| Coding rules | `.ai/rules/<topic>.md` | Create & customize | Language/framework-specific coding standards |
| Testing strategy | `.ai/rules/testing-strategy.md` | Create & customize | Required before `@test-plan-writer` can run |
| Project guides | `doc/guides/` | Create & customize | Dev setup, debugging, deployment, etc. |

> **Decision management:** All decisions (architecture, product, technical, business, operational) go in `doc/decisions/` — see the [Decision Records Management Guide](decision-records-management.md).

---

## Choose Your Setup Path

> **Automated (recommended):** Run `/bootstrap` and the `@bootstrapper` agent will scan your repo, ask targeted questions, and generate all required artifacts with your approval. Takes ~15 minutes.
>
> **Manual (full control):** Follow Steps 1-5 below to set up each artifact individually. Takes ~30 minutes.
>
> **Skip to:** [Automated Bootstrap](#automated-bootstrap) | [Manual Setup](#manual-setup-step-by-step)

---

## Automated Bootstrap

```
/bootstrap
```

The `@bootstrapper` agent will:

1. **Scan** your repo structure, tech stack, and existing docs
2. **Assess** what it can infer vs. what needs your input
3. **Interview** you with targeted questions (~3-7 per round)
4. **Draft** all required ADOS artifacts for your review
5. **Write** final artifacts upon your approval

After bootstrap completes, jump to [First Change Walkthrough](#step-4-first-change-walkthrough) to validate your setup.

---

## Manual Setup (Step-by-Step)

### Step 1: Mandatory Artifacts

These three files are **required** for ADOS to function. Without them, agents cannot orchestrate changes.

### 1.1 `AGENTS.md` (Project Root)

The bootstrap file that AI agents read first. It tells agents what your project is, how the delivery process works, and where to find everything.

**Setup:**

1. Copy `AGENTS.md` from the ADOS repository as a starting point
2. Customize the following sections for your project:
   - **"What this repo is"** — describe your project, not ADOS
   - **"Repo structure"** — match your actual directory layout
   - **"Key references"** — update paths to your project's docs
3. Keep the **Delivery process**, **Agent team**, and **Commands** sections as-is (they describe ADOS capabilities)
4. Update agent/command counts if you add custom agents

**Key content:**

- Project description and purpose
- Delivery process overview (10-phase workflow)
- Agent team inventory
- Commands table
- Repo structure tree
- Key references table

### 1.2 `.ai/agent/pm-instructions.md`

Configures the `@pm` agent for your specific issue tracker and workflow.

> **What goes here:** PM instructions contain ONLY information that is specific to your project and tracker. Do not repeat the standard ADOS change lifecycle (that lives in `doc/guides/change-lifecycle.md`). The goal is a lean file: the less you repeat, the less drifts.

#### Mandatory Sections

| Section | Purpose |
|---------|---------|
| **Tracker Configuration** | Which tracker is canonical (GitHub Issues / Jira / local markdown backlog), connection details, project keys |
| **Workflow States Mapping** | How ADOS lifecycle phases map to your tracker's statuses or labels |
| **Label Taxonomy** | Which labels the PM agent should use — at minimum `change` for all ADOS-managed items |
| **Backlog Source of Truth** | Explicit statement of where the backlog lives to prevent duplicate sources |

#### Recommended Extensions

| Extension | When to add | Example |
|-----------|------------|---------|
| **Issue Validation Checklist** | When tickets often start without enough context | "Check labels are set, status is not Blocked, epic context is read" |
| **Priority & Selection Rules** | When PM needs to auto-select the next issue | "In-progress takes precedence, then `priority:high`, then oldest" |
| **Quality Gate References** | When repo has specific scripts to run before PR/MR | "Run `scripts/quality-gates.sh` via `@runner`" |
| **Blocking Question Workflow** | When human approval gates exist | "Add comment with question, assign to human, set `blocked` label, STOP" |
| **Multi-Repo Coordination** | When changes span multiple repos | "Use `todo-<repo>`/`done-<repo>` labels; see inventory table" |
| **Definition of Ready (DoR)** | When tickets need pre-conditions before work starts | 5-9 point checklist: AC defined, dependencies identified, etc. |
| **Estimation Methodology** | When team uses story points or T-shirt sizing | "Fibonacci scale (1-89), split at 100+, triangulate against reference stories" |
| **PR/MR Workflow Customizations** | When merge process has repo-specific steps | "Squash-only merge, i18n completeness check before MR, human-only merge" |
| **Decision Documentation** | When product decisions need formal records | "Delegate to `@architect`; use PDRs in `doc/decisions/`" |

#### What NOT to include

- Do not repeat the standard ADOS change lifecycle — reference `doc/guides/change-lifecycle.md`
- Do not embed build/test commands — those belong in quality gate scripts or the project README
- Do not duplicate content across repos — if 5 repos share identical tracker config, extract it into a shared file
- Do not include volatile delivery schedules or backlogs — use separate planning docs
- Do not embed tool bug workarounds — document those in tool docs or fix them upstream

#### Example: GitHub Issues (Minimal)

```markdown
# PM Instructions

## Tracker Configuration

tracker: github
owner: <your-github-org-or-username>
repo: <your-repo-name>

## Workflow Mapping

| Phase | GitHub Label | Notes |
|-------|-------------|-------|
| Planning started | `in-progress` | Applied when PM begins work |
| Ready for review | `review` | Applied when PR is ready |
| Done | (close issue) | Issue closed after merge |

## Labels

- `change` — all changes managed by ADOS
- `bug`, `feature`, `docs` — issue type labels
- `priority:high`, `priority:medium`, `priority:low` — priority levels

## Backlog Source of Truth

GitHub Issues is the only backlog. Do not create or rely on local backlog files.

## Conventions

- workItemRef format: `GH-<number>` (e.g., `GH-123`)
- Branch naming: `<type>/GH-<number>/<slug>`
```

#### Example: Jira (with common extensions)

```markdown
# PM Instructions

## Tracker Configuration

tracker: jira
project_key: <YOUR-PROJECT-KEY>
base_url: https://<your-domain>.atlassian.net

## Workflow Mapping

| Phase | Jira Status | Transition ID | Notes |
|-------|-------------|---------------|-------|
| Planning started | In Progress | 21 | |
| Spec/Plan/Tests created | In Progress | — | No transition needed |
| Delivery started | In Progress | — | |
| Ready for review | In Review | 31 | |
| Done | Done | 41 | |
| Blocked | Blocked | 51 | Set when waiting on human input |

## Labels

- `change` — all changes managed by ADOS
- `todo-<repo-name>`, `done-<repo-name>` — per-repo tracking (for multi-repo setups)

## Backlog Source of Truth

Jira is the canonical backlog. Query: project = <KEY> AND labels = "change" AND status != Done ORDER BY priority DESC, created ASC

## Issue Validation Checklist

Before starting any issue:
1. Verify `change` label is applied
2. Check status is not `Blocked`
3. Read parent epic (if any) for wider context
4. Confirm acceptance criteria exist in description

## Conventions

- workItemRef format: `<PROJECT>-<number>` (e.g., `PDEV-123`)
- Branch naming: `<type>/<PROJECT>-<number>/<slug>`
```

#### Example: Local Markdown Backlog (Git-native)

For solo developers or small teams without an external tracker, ADOS supports a fully Git-managed backlog. The backlog table tracks order and status; the actual content lives in structured files.

**Directory structure:**

```
doc/planning/
├── backlog.md                              # Active backlog (order + status)
├── archive/
│   └── backlog-2026-03-01.md               # Archived completed items
└── epics/
    ├── EPIC-1--onboarding-flow/
    │   ├── EPIC-1--onboarding-flow.md       # Epic overview: goals, scope, success criteria
    │   ├── STORY-1--user-registration.md    # Story detail: AC, context, notes
    │   ├── STORY-2--email-verification.md
    │   └── BUG-3--signup-validation.md
    └── EPIC-2--payment-integration/
        ├── EPIC-2--payment-integration.md
        ├── STORY-4--stripe-checkout.md
        └── STORY-5--invoice-generation.md
```

**How it works:**

- **`backlog.md`** is the single view of active work — a lightweight table with delivery order, status, and priority. It does NOT contain requirements or acceptance criteria.
- **Epic folders** (`doc/planning/epics/<EPIC-ID>--<slug>/`) hold the real content: an epic document describing overall goals, and individual story/bug files with full descriptions, AC, and context.
- **Planning a new epic** starts by creating the epic folder and document, then breaking it into stories with their own files, then adding rows to `backlog.md`.
- **Archiving**: periodically move completed items from `backlog.md` to `doc/planning/archive/backlog-<YYYY-MM-DD>.md` to keep the active backlog focused. Archive when the done section exceeds ~20 items or at sprint/milestone boundaries.

```markdown
# PM Instructions

## Tracker Configuration

tracker: local
backlog_file: doc/planning/backlog.md
epics_dir: doc/planning/epics
archive_dir: doc/planning/archive

## Backlog File Format

The backlog is an ordered table. Top item = highest priority. The PM delivers
items top-to-bottom unless dependencies require reordering.

| # | ID | Title | Status | Priority | Labels | Epic |
|---|-----|-------|--------|----------|--------|------|
| 1 | STORY-1 | User registration | todo | high | feature | EPIC-1 |
| 2 | STORY-2 | Email verification | todo | high | feature | EPIC-1 |
| 3 | BUG-3 | Signup validation error | todo | high | bug | EPIC-1 |
| 4 | STORY-4 | Stripe checkout | todo | medium | feature | EPIC-2 |

Status values: `todo`, `in-progress`, `review`, `done`, `blocked`

## Work Item Documentation

Each story or bug has a dedicated file in its epic folder:
- Path: `doc/planning/epics/<EPIC-ID>--<slug>/<ID>--<slug>.md`
- Contains: description, acceptance criteria, context, dependencies, notes
- The backlog table links to these files by ID — the file is the source of truth
  for requirements, the table row is the source of truth for status and order.

Epic documents describe the overall goal, success criteria, and scope.
Stories reference their parent epic for context.

## Workflow Mapping

| Phase | Backlog Status |
|-------|---------------|
| Planning started | in-progress |
| Ready for review | review |
| Done | done |
| Blocked | blocked |

## Backlog Archiving

When the backlog accumulates more than ~20 completed items (or at milestone
boundaries), archive them:
1. Cut all `done` rows from `backlog.md`
2. Paste into `doc/planning/archive/backlog-<YYYY-MM-DD>.md`
3. Keep epic folders intact (they are the permanent record)

## Labels

- feature, bug, docs, infra, tech-debt

## Conventions

- workItemRef format: `STORY-<number>` or `BUG-<number>`
- Epic ID format: `EPIC-<number>`
- Branch naming: `<type>/STORY-<number>/<slug>`
- Numbering is sequential across all types (STORY-1, STORY-2, BUG-3, STORY-4...)
```

> **Tip:** Start minimal. You can always add extensions later as your workflow matures. The leanest effective PM instructions file is ~30 lines; the richest is ~300 lines.

### 1.3 `doc/documentation-handbook.md`

The canonical documentation standard. **Auto-installed** by `install.sh --local`. If setting up manually, copy it as-is from the ADOS repository.

**Setup:**

1. Copy `doc/documentation-handbook.md` from ADOS into your project's `doc/` directory
2. Do NOT customize — keep it identical across repos (see §1 of the handbook)
3. This ensures all agents and humans follow the same documentation conventions

---

## Step 2: Recommended Artifacts (Optional)

> **Note:** If you used `install.sh --local`, most recommended artifacts below are already installed. This section is for manual setup or understanding what each artifact does.

These artifacts improve the ADOS experience but are not strictly required. Set them up incrementally as your project grows.

### 2.1 `doc/00-index.md` — Documentation Landing Page

A table of contents for your project's documentation. Helps humans and agents navigate.

**Setup:** Copy from ADOS and update links to match your project's actual docs.

### 2.2 `doc/overview/` — Project Overview

High-level project context:

- `01-north-star.md` — Vision, mission, and product direction
- `02-roadmap.md` — High-level phases and milestones
- `architecture-overview.md` — System architecture diagrams
- `glossary.md` — Terms and acronyms used in the project

### 2.3 `doc/spec/features/` — Feature Specifications

Current-truth descriptions of your system's features. Use `doc/templates/feature-spec-template.md` as the structural guide.

### 2.4 `doc/templates/` — Document Templates

**Auto-installed** by `install.sh --local`.

Copy the templates directory from ADOS:

- `change-spec-template.md`
- `decision-record-template.md`
- `feature-spec-template.md`
- `test-spec-template.md`
- `test-plan-template.md`
- `implementation-plan-template.md`
- `north-star-template.md`

Agents read these at runtime to guide document structure.

### 2.5 `doc/decisions/` — Decision Records

**Auto-installed** by `install.sh --local`.

Set up the decision records directory:

1. Create `doc/decisions/README.md` (copy from ADOS)
2. Create `doc/decisions/00-index.md` (empty index)
3. See [Decision Records Management Guide](decision-records-management.md) for the full standard

### 2.6 `doc/guides/` — Project-Specific Guides

Add guides as needed:

- Local development setup
- Debugging procedures
- Testing strategy
- Deployment workflows

---

## Step 3: Decision Records Setup

If your project makes architectural, product, or technical decisions, set up decision records:

1. Create `doc/decisions/` directory with `README.md` and `00-index.md`
2. Read the [Decision Records Management Guide](decision-records-management.md) for:
   - Decision types (ADR, PDR, TDR, BDR, ODR)
   - Naming convention (`<TYPE>-<zeroPad4>-<slug>.md`)
   - Lifecycle (Proposed → Under Review → Accepted)
   - Governance (who proposes, reviews, accepts)
3. Use `/plan-decision` + `/write-decision` to create your first decision record

---

## Step 4: First Change Walkthrough

Once your mandatory artifacts are in place, try running the full 10-phase workflow on a real change:

### Using Autopilot (Recommended)

```
@pm deliver change GH-1
```

The `@pm` agent will orchestrate all 10 phases:

1. **Clarify scope** — PM reads the ticket and cross-checks against system spec
2. **Specification** — `@spec-writer` creates the change spec
3. **Test planning** — `@test-plan-writer` creates the test plan
4. **Delivery planning** — `@plan-writer` creates the implementation plan
5. **Delivery** — `@coder` executes the plan phases
6. **System spec update** — `@doc-syncer` reconciles docs
7. **Review** — `@reviewer` audits against spec/plan
8. **Quality gates** — `@runner` runs builds/tests/lint
9. **DoD check** — PM verifies all criteria met
10. **PR creation** — `@pr-manager` creates the PR

### Using Manual Commands

```
/plan-change GH-1
/write-spec GH-1
/write-test-plan GH-1
/write-plan GH-1
/run-plan GH-1
/review GH-1
/sync-docs GH-1
/check
/pr
```

---

## Troubleshooting

### "Agent can't find my issue tracker"

Ensure `.ai/agent/pm-instructions.md` exists and has the correct tracker configuration. The `@pm` agent reads this file first.

### "Templates are not being used"

Verify `doc/templates/` exists and contains the template files. Agents fall back to embedded defaults if templates are absent — this is expected behavior, not an error.

### "Decision records workflow doesn't work"

Ensure `doc/decisions/` directory exists. The `@architect` agent writes decision records there. See [Decision Records Management Guide](decision-records-management.md).

### "Change artifacts are in the wrong location"

Check your `AGENTS.md` for the correct folder pattern: `doc/changes/YYYY-MM/YYYY-MM-DD--<workItemRef>--<slug>/`. The `@pm` agent creates this structure automatically.

### "Agents reference files that don't exist"

Run a fresh ADOS onboarding — some referenced directories (like `doc/overview/`, `doc/spec/`) need to be created. Create them with README.md stubs and populate incrementally.

### "PM agent can't read or update tickets" / MCP tracker setup

The `@pm` and `@pr-manager` agents need MCP (Model Context Protocol) access to your issue tracker to read tickets, update statuses, and enrich PR descriptions. Other agents do **not** need tracker access.

**Best practice: disable tracker MCP globally, enable per agent.**

This follows the principle of least privilege — only agents that need tracker access get it. This prevents other agents from accidentally modifying tickets.

**GitHub Issues setup** (in `.opencode/opencode.jsonc`):

```jsonc
{
  "mcp": {
    "github-mcp": {
      "type": "local",
      "command": ["npx", "-y", "@modelcontextprotocol/server-github"],
      "environment": {
        // Settings → Developer Settings → Personal access tokens (classic)
        // Permissions: repo, read:org, user
        "GITHUB_PERSONAL_ACCESS_TOKEN": "{env:GITHUB_API_TOKEN}"
      },
      "enabled": true
    }
  },
  "tools": {
    "github*": false          // disabled globally for all agents
  },
  "agent": {
    "pm": {
      "tools": {
        "github*": true       // PM can read/update issues
      }
    },
    "pr-manager": {
      "tools": {
        "github*": true       // PR manager reads tickets for context
      }
    }
  }
}
```

**Jira setup** (in `~/.config/opencode/opencode.jsonc` — global, or per-project):

```jsonc
{
  "mcp": {
    "jira-mcp": {
      "type": "local",
      "command": ["uvx", "mcp-atlassian"],
      "environment": {
        "JIRA_URL": "https://<your-domain>.atlassian.net/",
        "JIRA_USERNAME": "{env:JIRA_USERNAME}",
        "JIRA_API_TOKEN": "{env:JIRA_API_TOKEN}"
      },
      "timeout": 60000
    }
  },
  "tools": {
    "jira*": false            // disabled globally
  },
  "agent": {
    "pm": {
      "tools": {
        "jira*": true         // PM can read/update Jira issues
      }
    },
    "pr-manager": {
      "tools": {
        "jira*": true         // PR manager reads tickets for context
      }
    }
  }
}
```

**Key points:**

- **Global vs project config:** MCP servers can be declared in the global config (`~/.config/opencode/opencode.jsonc`) and shared across projects, or per-project in `.opencode/opencode.jsonc`. Tool permissions (`"tools"` and `"agent"` blocks) are always per-project.
- **Multiple Jira instances:** If you work across multiple Jira instances, declare each with a unique MCP name (e.g., `jira-projecta-mcp`, `jira-projectb-mcp`) in the global config. Each can have different credentials and URLs.
- **Why `@pr-manager` needs access:** It reads ticket descriptions and comments to enrich PR descriptions with the "why" behind changes. Without MCP access, PRs will still be created but without ticket context.
- **Environment variables:** Store API tokens in environment variables (e.g., `GITHUB_API_TOKEN`, `JIRA_API_TOKEN`), not directly in config files. OpenCode resolves `{env:VAR_NAME}` at runtime.
- **Verification:** Run `@pm deliver change <ref>` — if the PM agent can read the ticket, MCP is working. If you see "MCP tools unavailable" warnings, check your config and token setup.

---

## Related Guides

| Guide | Description |
|-------|-------------|
| [Change Lifecycle](change-lifecycle.md) | Detailed 10-phase delivery workflow |
| [Change Convention](unified-change-convention-tracker-agnostic-specification.md) | Naming, folders, branches |
| [Agents & Commands Guide](opencode-agents-and-commands-guide.md) | How to use agents and commands |
| [Tools Convention](tools-convention.md) | Standard for building CLI tools |
| [Documentation Handbook](../documentation-handbook.md) | Repository documentation standard |
| [Decision Records Management](decision-records-management.md) | Decision record types, lifecycle, governance |
