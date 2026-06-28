---
ados_distribution: internal
id: SPEC-CLAUDE-PLUGIN-GENERATION
status: Current
created: 2026-06-28
last_updated: 2026-06-28
owners: ["engineering"]
service: delivery-os
summary: "Idempotent generation of the Claude Code plugin (.ados-claude/) from the .opencode/ single source of truth, with model-assignment plumbing, a multi-tool extensibility pattern, and a CI freshness gate."
links:
  related_changes: ["GH-79"]
---

# Feature: Claude Code Plugin Generation

## Overview

ADOS keeps a **single source of truth** for all agent/command definitions in `.opencode/`. From it, a deterministic build script (`scripts/build-claude-plugin.sh`) generates a Claude Code plugin into `.ados-claude/` — agents become `.ados-claude/agents/<name>.md` and commands become `.ados-claude/skills/<name>/SKILL.md`. The generated tree is a build artifact (never hand-edited) kept current by a CI freshness gate. This generation pipeline is the multi-tool mechanism that lets one source feed multiple coding tools.

> **The agent/command system itself is specced in the sibling spec.** The inventory, single-source discipline, and the two-layer model-configuration mechanism are covered in [feature-agents-and-commands.md](feature-agents-and-commands.md). This spec covers the **generation** contract and script.

## Business Context

### Problem Statement

- **Problem:** Maintaining tool definitions twice (once for OpenCode, once for Claude Code) causes drift; one source going stale silently degrades behavior.
- **Affected Users:** Agent authors and contributors running ADOS under both OpenCode and Claude Code.
- **Business Impact:** Drift between source and generated plugin produces inconsistent agent behavior across tools.

### Goals & Success Metrics

- **Primary Goal:** One edit in `.opencode/` propagates to `.ados-claude/` via a deterministic, idempotent rebuild.
- **KPIs:** `scripts/.tests/test-build-claude-plugin.sh` passes in CI (freshness); every commit editing `.opencode/` also commits the regenerated `.ados-claude/`.

## User Experience & Functionality

### Capabilities

- **Single source of truth → generated plugin (F-1):** `scripts/build-claude-plugin.sh` reads `.opencode/agent/*.md` and `.opencode/command/*.md` and writes the Claude Code plugin tree:
  - `.opencode/agent/<name>.md` → `.ados-claude/agents/<name>.md`
  - `.opencode/command/<name>.md` → `.ados-claude/skills/<name>/SKILL.md`
  - a static plugin manifest `.ados-claude/.claude-plugin/plugin.json` (name `ados`, version `1.0.0`).
- **Idempotent rebuild (F-2):** The build **removes the existing output directory then regenerates it** (`rm -rf` then `mkdir` + transform) — there is no incremental/patch generation. Re-running with unchanged source produces byte-identical output. This makes the freshness gate a deterministic oracle.
- **Model-assignment plumbing (F-3):** The build reads each source file's `claude.model` frontmatter hint (`opus` | `sonnet` | `haiku`), defaults to `sonnet` when absent, and writes a `model:` line into the generated file. (OpenCode ignores the `claude:` key entirely; see the sibling spec for the two-layer model mechanism.) The generated frontmatter also carries a fixed `allowed-tools` list and a "GENERATED FILE — DO NOT EDIT" header naming the source path and regeneration command.
- **Multi-tool extensibility (F-4):** The script is structured around a `TOOL` environment variable and a `build_plugin` dispatch with per-tool transform functions (`transform_<tool>_agent_frontmatter`, `transform_<tool>_command_to_skill`, `generate_<tool>_manifest`). Adding a new tool (e.g., copilot, codex, cursor) means adding a tool case and tool-specific transforms; the current tool is `claude`.
- **CI freshness gate (F-5):** `scripts/.tests/test-build-claude-plugin.sh` rebuilds and asserts the generated tree matches a fresh build — it fails on stale output, blocking merge. This enforces the 1:1 invariant (regenerate iff `.opencode/` edited).

### The 1:1 Invariant

Every commit that edits a file under `.opencode/` MUST also include the regenerated `.ados-claude/` output in the **same** commit. Conversely, `.ados-claude/` changes only when `.opencode/` sources change. The manifest version is a static `1.0.0` (a plugin-marketplace version, not a per-change semver) hard-set in the build script — it does not bump per change.

### User Flows

```
Edit .opencode/agent/<name>.md  → run scripts/build-claude-plugin.sh
                                → git diff --stat .ados-claude/ shows ONLY the changed agent/skill files
                                → commit source + generated together (1:1 invariant)
```

### Edge Cases & Error Handling

- **Stale generated plugin:** CI freshness gate fails and blocks merge until `scripts/build-claude-plugin.sh` is run and committed.
- **Non-deterministic output:** if a rebuild with unchanged source produces a diff, that signals an undeterministic/stale prior generation — reconcile before proceeding.
- **TOOL validation:** the script validates `TOOL` is a simple identifier (letters, digits, hyphen, underscore) to prevent path traversal via the `rm -rf`.

## Technical Architecture & Codebase Map

### Core Components

| Path | Component | Responsibility |
|------|-----------|----------------|
| `scripts/build-claude-plugin.sh` | Build script | Deterministic, idempotent generation: frontmatter parse → transform → write agents + skills + manifest |
| `.opencode/agent/*.md` | Source agents | The single source of truth (input) |
| `.opencode/command/*.md` | Source commands | The single source of truth (input) |
| `.ados-claude/agents/*.md` | Generated agents | Build artifact (output); never hand-edited |
| `.ados-claude/skills/*/SKILL.md` | Generated skills | Build artifact (output); never hand-edited |
| `.ados-claude/.claude-plugin/plugin.json` | Plugin manifest | Static `1.0.0` manifest |
| `scripts/.tests/test-build-claude-plugin.sh` | Freshness gate | CI oracle: rebuild must match committed output |

### Build Internals

- **Frontmatter parsing:** `extract_frontmatter` / `extract_body` split a source file; `get_yaml_value` resolves keys (including nested `claude.model`).
- **Agent transform (`transform_agent_frontmatter`):** emits generated header + `name` + `description` + `model` (from `claude.model`, default `sonnet`) + fixed `allowed-tools`.
- **Command transform (`transform_command_to_skill`):** emits generated header + `name` + `description` + `model` (default `sonnet`) + fixed `allowed-tools`; command body is appended unchanged.
- **Manifest (`generate_manifest`):** static JSON (`name: ados`, `version: 1.0.0`).

## Non-Functional Requirements

| ID | Category | Requirement | Threshold |
|----|----------|-------------|-----------|
| NFR-1 | Determinism | Rebuild with unchanged source is byte-identical | Empty diff on no-op rebuild |
| NFR-2 | Freshness | CI gate fails on stale `.ados-claude/` | `test-build-claude-plugin.sh` green in CI |
| NFR-3 | Invariant | `.ados-claude/` changes iff `.opencode/` source changes | 1:1 edit set per commit |

## Quality Assurance Strategy

### Testing Approach

| Level | Scope | Notes |
|-------|-------|-------|
| CI | Freshness | `bash scripts/.tests/test-build-claude-plugin.sh` |
| Manual | Idempotency | Run the build twice; assert `git diff --stat .ados-claude/` empty on the second run |
| Manual | 1:1 | Edit one agent; assert the regen diff touches only that agent's generated file |

## Dependencies & Risks

- **Depends on:** `.opencode/` source definitions (the input).
- **Risk:** Stale generated plugin merged by accident — mitigated by the CI freshness gate.
- **Risk:** Hand-edits to `.ados-claude/` lost on next rebuild — mitigated by the "GENERATED FILE — DO NOT EDIT" header and the source-only editing discipline.

## Related Documentation

- **Build script (authoritative):** `scripts/build-claude-plugin.sh`.
- **Freshness gate:** `scripts/.tests/test-build-claude-plugin.sh`.
- **System bootstrap:** [AGENTS.md](../../../AGENTS.md) — "Multi-tool support" (the `.opencode/` ↔ `.ados-claude/` discipline, the no-hand-edit rule, the source+generated commit workflow).
- **Sibling spec (the system being generated):** [feature-agents-and-commands.md](feature-agents-and-commands.md) — single source of truth, agent/command inventory, the two-layer model-configuration mechanism.
- **Model configuration mechanism:** [doc/guides/opencode-model-configuration.md](../../guides/opencode-model-configuration.md).
