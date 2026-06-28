---
# Copyright (c) 2025-2026 Juliusz Ćwiąkalski (https://www.cwiakalski.com | https://www.linkedin.com/in/juliusz-cwiakalski/ | https://x.com/cwiakalski)
# MIT License - see LICENSE file for full terms
source: https://github.com/juliusz-cwiakalski/agentic-delivery-os/blob/main/doc/spec/features/feature-agents-and-commands.md
ados_distribution: internal
id: SPEC-AGENTS-AND-COMMANDS
status: Current
created: 2026-06-28
last_updated: 2026-06-28
owners: ["engineering"]
service: delivery-os
summary: "The .opencode/ agent and command system is the product: a single source of truth for tool definitions, with a precise two-layer model-configuration mechanism and a no-hand-edit discipline for generated multi-tool plugins."
links:
  related_changes: ["GH-79"]
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
- **Sibling spec:** [feature-claude-plugin-generation.md](feature-claude-plugin-generation.md) — the `.opencode/`→`.ados-claude/` build contract, idempotency, and CI freshness gate.
