---
# Copyright (c) 2025-2026 Juliusz Ćwiąkalski (https://www.cwiakalski.com | https://www.linkedin.com/in/juliusz-cwiakalski/ | https://x.com/cwiakalski)
# Apache-2.0 License - see LICENSE file for full terms
source: https://github.com/juliusz-cwiakalski/agentic-delivery-os/blob/main/doc/spec/features/feature-agents-and-commands.md
ados_distribution: internal
id: SPEC-AGENTS-AND-COMMANDS
status: Current
created: 2026-06-28
last_updated: 2026-11-17
owners: ["engineering"]
service: delivery-os
summary: "The .opencode/ agent and command system is the product: a single source of truth for tool definitions, a precise two-layer model-configuration mechanism, a no-hand-edit discipline for generated multi-tool plugins, the delivery-integration invariants the lifecycle prompts follow, and the deterministic prompt, help/guide, and document conformance scans that enforce them."
links:
  related_changes: ["GH-79", "GH-242", "GH-239", "GH-241", "GH-286", "GH-288", "GH-290", "GH-313", "GH-297", "GH-296", "GH-287", "GH-298", "GH-299"]
  guides:
    - "doc/guides/opencode-model-configuration.md"
---

# Feature: Agents and Commands System

## Overview

The agents and their prompt definitions (`.opencode/agent/*.md`, `.opencode/command/*.md`) **are the product** of ADOS. The repository maintains a single source of truth for all tool definitions, from which a Claude Code plugin (`.ados-claude/`) is generated. This spec covers the inventory, the single-source-of-truth discipline, the **two-layer model-configuration mechanism** (which must be understood precisely and not conflated), and authoring discipline.

> **Canonical inventory and conventions.** The agent/command inventory (one-line purpose per tool) is in [AGENTS.md](../../../AGENTS.md) ("Agent team" + "Commands") and [.opencode/README.md](../../../.opencode/README.md). This spec does **not** re-list all agents; it documents the *system* and points to the inventory.

## Business Context

### Problem Statement

- **Problem:** AI agent prompts degrade downstream quality; a degraded prompt degrades everything. Tool definitions must be treated with the same rigor as production code, and a single source of truth must prevent drift between tools.
- **Affected Users:** Agent authors, contributors tuning the system, and the AI team that runs delivery.
- **Business Impact:** Drift between source prompts and generated plugins, or conflated model-configuration concerns, causes silent failures and hard-to-debug behavior.

### Goals & Success Metrics

- **Primary Goal:** One authoritative source (`.opencode/`) for every agent/command, with a generated multi-tool plugin kept current by CI.
- **KPIs:** Every agent/command has a definition; `.ados-claude/` is never stale (CI freshness gate).

## User Experience & Functionality

### Capabilities

- **Single source of truth (F-1):** `.opencode/` is canonical. Agents live in `.opencode/agent/*.md`; commands in `.opencode/command/*.md`. The generated Claude Code plugin (`.ados-claude/`) is a build artifact — **never hand-edited**. See [AGENTS.md](../../../AGENTS.md) ("Multi-tool support") and the sibling spec [feature-claude-plugin-generation.md](feature-claude-plugin-generation.md) for the generation mechanism.
- **Agent/command inventory (F-2):** Agents perform roles (orchestration, artifact creation, implementation, verification, documentation/release, specialized); commands are thin entry points that delegate to agents. Authoritative inventory: [AGENTS.md](../../../AGENTS.md) ("Agent team" + "Commands") and [.opencode/README.md](../../../.opencode/README.md).
- **Frontmatter (F-3):** Each `.md` carries frontmatter (`description`, `mode`, and an optional `claude:` block). See the model-configuration mechanism below.
- **Authoring/tuning discipline (F-4):** Creating or modifying agents/commands is delegated to `@toolsmith` (by reference — see `.opencode/agent/toolsmith.md`), which specializes in prompt engineering and model-format-aware design. Hand-editing is discouraged; related tools are tuned together because agents hand off to each other.
- **Delivery-integration invariants (F-9):** Lifecycle commits route through the `commit` primitive or the thin `@committer`; phase state is written only through the `phase` family; the PR URL is a pm-notes `notes:` entry.
- **Milestone rules in the prompts (F-10):** The `@pm` prompt requires a milestone, resolved from the project's existing milestone set, on every created ticket and verifies the attachment at intake before artifact phases; agents never create a milestone autonomously. The `@spec-writer` prompt requires `change.milestone` in change-spec front matter. The `@bootstrapper` prompt's tracker-instruction guidance generates a Milestone Attachment section (convention, attachment at creation from the existing set, no autonomous creation, intake verification, capture exemption) so a bootstrapped project inherits the rule. The project-specific milestone set, resolution rule, label vocabulary, and intake verification live in `.ai/agent/pm-instructions.md`. The operating rule is documented in [Milestone Governance](feature-milestone-governance.md).

### The Two-Layer Model-Configuration Mechanism (F-5) — must be understood precisely

Model assignment is split across two **independent** layers. Conflating them is a common, hard-to-debug mistake.

| Layer | Where | What it controls | Mechanism |
|-------|-------|------------------|-----------|
| **Claude-Code build-time hint** | `.opencode/agent/*.md` frontmatter `claude.model` (`opus` \| `sonnet` \| `haiku`) | Which model the *generated* Claude Code plugin assigns to that agent | Consumed by `scripts/build-claude-plugin.sh`, which reads `claude.model` (defaulting to `sonnet`) and writes a `model:` line into `.ados-claude/agents/<name>.md` |
| **OpenCode-effective runtime model** | OpenCode config files (`opencode*.jsonc`) | Which model actually runs the agent under OpenCode at runtime | Per-agent `agent.<name>.model` keys in the OpenCode config layer |

Key facts (authoritative: `.opencode/opencode.jsonc`, [doc/guides/opencode-model-configuration.md](../../guides/opencode-model-configuration.md), [AGENTS.md](../../../AGENTS.md) "Multi-tool support"):

- **OpenCode ignores the `claude:` frontmatter key entirely.** The `claude.model` hint has no effect on OpenCode runtime behavior; it is consumed only by the build script that generates the Claude Code plugin.
- **In this repo, `.opencode/opencode.jsonc` does NOT contain a per-agent model table.** Its comment (line 25) explicitly delegates per-agent model assignments to user-global config: *"rest (models etc) are customized in user-centric global configs so they don't have to be added below."* The repo's `.opencode/opencode.jsonc` instead customizes per-agent *tool access* (e.g. enabling `github*` tools for `pm`, `pr-manager`, `reviewer`, `review-feedback-applier`).
- **The OpenCode-effective model assignment lives in the OpenCode config layer** (merged across remote → user-global → project → env, per [opencode-model-configuration.md](../../guides/opencode-model-configuration.md)). In this repo the project file delegates the per-agent model selection to the user's global config.
- **The two concerns are independent:** changing `claude.model` in an agent prompt changes the generated Claude Code plugin's model; it does **not** change the OpenCode runtime model (and vice versa).

> **Do not** imply `.opencode/opencode.jsonc` holds a literal per-agent model table — it does not (in this repo). It holds tool-access customizations and delegates model selection to user-global config. The general README line ("models are assigned in `opencode*.jsonc` config files") refers to the OpenCode config layer as a whole, not to this repo's `.opencode/opencode.jsonc` specifically.

### No-Hand-Edit Discipline (F-6)

To change an agent, command, model assignment, or plugin behavior:

1. Edit only `.opencode/agent/*.md` or `.opencode/command/*.md` (the source).
2. Run `scripts/build-claude-plugin.sh` to regenerate `.ados-claude/`.
3. Commit source **and** generated output **together** (the 1:1 invariant).
4. CI verifies the generated plugin is current and fails if stale.

Never hand-edit `.ados-claude/**`. Generated files include comments naming their source and regeneration command — treat those as authoritative. See [feature-claude-plugin-generation.md](feature-claude-plugin-generation.md) for the full generation contract.

### Delivery-integration invariants (F-9)

The lifecycle prompts are product code and follow these invariants. They are machine-checked, not prose-only.

- **Commit path.** Lifecycle commits route through the `commit` primitive, directly or through the thin `@committer`, which only invokes `commit`. No lifecycle prompt teaches `git add`, `git commit`, `git reset`, `git stash`, or `git rebase`; read-only git inspection (`status`, `diff`, `log`, `rev-parse`, `branch --list`) stays allowed, and `git push` plus PR creation stay with `@pr-manager`.
- **Phase state.** Phase state is written only through the `phase` family; no prompt writes `started`, `completed`, or `phases.pr_creation.url`. The PR URL is a pm-notes `notes:` entry.
- **Typed blockers.** Lanes and the coordinator use `blockers publish`/`list`/`answer`; the pm-notes `blockers:` collection is not an agent write target.
- **Plan progress.** Plans carry no `tasks` key and no progress log; plan-phase progress is a pm-notes `notes:` entry.
- **Allowed command set.** Prompt-required invocations are the entrypoint's composed set — `status`, `brief`, `queue`, `lanes`, `blockers`, `phase`, `commit`, `lint`, `plan`, `verify`, `merge`, `closeout`, `spend`, `retro`, `dispatch`, `coordinator`, `daemon`, `projects`, `repos`, `events`, `board`, `ceremony`, `steer`, and `metrics` — plus the retained `scripts/deliver-ticket.sh` and `scripts/ceo-loop.sh`. The resident daemon is claimed through its mounted lifecycle family.
- **Self-description.** Every prompt-required command has a `--help` surface and a reference page; see [CLI Entrypoint and Self-Description](feature-cli-entrypoint.md).

### Prompt and document conformance (F-9)

Three deterministic checks enforce the invariants and keep them from decaying after a change lands.

| Check | Scope | Failure |
|---|---|---|
| `scripts/checks/prompt-conformance.ts` (`pnpm check:prompt`) | Every `.md` under the declared scan roots `.opencode/agent` and `.opencode/command`, plus the required/forbidden phrase inventory in `tests/fixtures/prompt-inventory/lifecycle.json` | A non-negated line matching a rule, a missing required phrase, a forbidden literal, or a retired literal from `tests/fixtures/prompt-inventory/retained-retired.json` |
| `scripts/checks/help-guide-coverage.ts` (`pnpm check:help`) | The `PROMPT_REQUIRED_COMMANDS` set against `tests/fixtures/help-guide/coverage.json` and one reference page per command, resolved through the per-command page root: the M1 pages under `doc/planning/oss-tooling/milestones/m1/commands/`, the `verify-change` page for `verify`, and the M2 pages under `doc/planning/oss-tooling/milestones/m2/commands/` for `projects`, `repos`, `events`, `board`, `ceremony`, `retro`, `steer`, and `metrics` | A missing command row, a missing page, a page without `--help` or `--version`, a missing entrypoint page, or an inventory row naming a non-prompt-required command || `tests/checks/doc-conformance.test.ts` | The change spec's §16.1.1 stale/required phrase table (the single source for named phrases) over the affected `doc/spec/features/**` pages, plus the reconciled guides, man page, and reference pages | A stale phrase still present or a required current-truth phrase missing |

The prompt rules reject plan progress (`plan.no-progress`), hand-edited phase state (`phase.no-hand-edit`), a written `phases.pr_creation.url` (`phase.no-pr-url-write`), raw git writes (`git.no-raw-write`), and platform merge or PR-list discovery (`retired.platform`). A line that is a negation — containing `never`, `not`, `do not`, `don't`, `must not`, or `no` — is allowed, so a prompt can teach the prohibition itself. The scan is deterministic and non-vacuous: identical trees yield identical findings, and a mutated fixture fails.

Both scans run as standalone `bun run` steps before the aggregate `pnpm check` stage in the TypeScript CI job, and the doc conformance suite runs with the workspace tests. A new prompt or command must satisfy the scan, and a new prompt-required command must add its reference page and coverage row before merge.

### Milestone-attachment check (F-10)

The milestone rules the prompts carry are observed by a repository-local issue-event check. It is not one of the offline conformance scans and does not enter `pnpm check`.

| Check | Scope | Failure |
|---|---|---|
| `.github/workflows/ticket-milestone-check.yml` + `scripts/checks/milestone-attachment{,-runner,-github}.ts` | The seven issue events (`opened`, `edited`, `labeled`, `unlabeled`, `milestoned`, `demilestoned`, `reopened`) on a `change` issue, evaluated by a pure core to one of five verdicts; the manual advisory sweep on `workflow_dispatch` | A tracker write outside the closed set, a second comment, a flag on a milestone-present or exempt issue, or any tracker call reachable from the aggregate gate; the workflow is audited by `tests/checks/milestone-workflow.test.ts` and `tests/checks/milestone-gate.test.ts` |

The workflow is non-blocking: it is not a required status, and a failed run blocks nothing. Job permissions are limited to `issues: write` and `contents: read`, every action is SHA-pinned, and no secret is referenced. The rule and its decision table are specified in [Milestone Governance](feature-milestone-governance.md).

### Edge Cases & Error Handling

- **Changing one agent's output format may break a downstream consumer.** Mitigated by tuning related tools together and testing through a real delivery.
- **Adding a new tool requires updating the inventory** ([.opencode/README.md](../../../.opencode/README.md) and [AGENTS.md](../../../AGENTS.md)).

## Technical Architecture & Codebase Map

### Core Components

| Path | Component | Responsibility |
|------|-----------|----------------|
| `.opencode/agent/*.md` | Agent definitions (source) | One prompt per agent; frontmatter (`description`, `mode`, `claude.model`) |
| `.opencode/command/*.md` | Command definitions (source) | One prompt per command; thin entry points delegating to agents |
| `.opencode/opencode.jsonc` | Repo OpenCode config | `default_agent`, MCP, per-agent **tool access** customizations; delegates per-agent models to user-global config |
| `.ados-claude/**` | Generated Claude Code plugin | Build artifact; never hand-edited; regenerated by `scripts/build-claude-plugin.sh` |
| `.opencode/README.md` | Inventory | Agent/command listing + conventions |
| `.opencode/agent/toolsmith.md` | Toolsmith agent | Author/tune agents, commands, skills |
| `scripts/checks/prompt-conformance.ts` | Prompt invariant scan | Rule regexes, required/forbidden phrase inventory, retired-literal scan |
| `scripts/checks/help-guide-coverage.ts` | Help/guide matrix | Prompt-required set versus reference pages |
| `tests/fixtures/prompt-inventory/` | Scan fixtures | `lifecycle.json`, `allowed-commands.json`, `retained-retired.json`, mutation controls |
| `tests/fixtures/help-guide/coverage.json` | Coverage fixture | The command and reference-page inventory |
| `tests/checks/doc-conformance.test.ts` | Current-truth scan | The §16.1.1 phrase table over specs, guides, man page, and reference pages |
| `scripts/checks/milestone-attachment.ts`, `scripts/checks/milestone-attachment-runner.ts`, `scripts/checks/milestone-attachment-github.ts` | Milestone-attachment evaluation | Pure ordered evaluation core, port-injected runner, and the sole network-capable GitHub adapter; repository-local, not in the install set or the aggregate chain |
| `.github/workflows/ticket-milestone-check.yml` | Issue-event enforcement | Seven issue events plus a manual advisory sweep; least privilege; SHA pins; never blocks delivery |

## Non-Functional Requirements

| ID | Category | Requirement | Threshold |
|----|----------|-------------|-----------|
| NFR-1 | Single source | `.opencode/` is the only place to edit tool definitions | Zero hand-edits to `.ados-claude/` |
| NFR-2 | Freshness | `.ados-claude/` is regenerated in the same commit as any `.opencode/` edit | 1:1 invariant; CI gate |
| NFR-3 | Config clarity | The two model-config layers are documented and not conflated | No claim that `.opencode/opencode.jsonc` holds a per-agent model table |

## Quality Assurance Strategy

### Testing Approach

| Level | Scope | Notes |
|-------|-------|-------|
| CI | Plugin freshness | `scripts/.tests/test-build-claude-plugin.sh` fails on stale `.ados-claude/` |
| CI | Prompt invariants | `bun run scripts/checks/prompt-conformance.ts` fails on a rule match, a missing required phrase, or a retired literal; `pnpm check` also runs it |
| CI | Help/guide coverage | `bun run scripts/checks/help-guide-coverage.ts` fails on a missing page or a page without `--help`/`--version` |
| CI | Current-truth phrases | `tests/checks/doc-conformance.test.ts` fails on a stale or missing phrase-table phrase |
| Manual | Model-config understanding | Read `.opencode/opencode.jsonc` line 25 + `opencode-model-configuration.md` |

## Dependencies & Risks

- **Depends on:** `scripts/build-claude-plugin.sh` (generation) and `@toolsmith` (authoring).
- **Risk:** Model-config conflation — mitigated by the two-layer table above and the explicit delegation note.
- **Risk:** Stale generated plugin — mitigated by CI freshness gate and the source+generated commit invariant.

## Related Documentation

- **System bootstrap:** [AGENTS.md](../../../AGENTS.md) — agent team, commands, "Multi-tool support", repo structure.
- **Tool inventory + conventions:** [.opencode/README.md](../../../.opencode/README.md).
- **Model configuration (mechanism):** [doc/guides/opencode-model-configuration.md](../../guides/opencode-model-configuration.md) — config precedence, agent override behavior, tier recommendations.
- **Repo config:** `.opencode/opencode.jsonc` (tool access; delegates models to user-global config — see line 25).
- **Toolsmith agent:** `.opencode/agent/toolsmith.md` (authoring/tuning tools).
- **Milestone governance:** [feature-milestone-governance.md](feature-milestone-governance.md) — the creation, intake, and issue-event rules the prompts carry.
- **Sibling spec:** [feature-claude-plugin-generation.md](feature-claude-plugin-generation.md) — the `.opencode/`→`.ados-claude/` build contract, idempotency, and CI freshness gate.
- **Entrypoint and help surface:** [feature-cli-entrypoint.md](feature-cli-entrypoint.md) — the executable bin, the composed prompt-required set, and the `--help`/`--version` contract.
