---
# Copyright (c) 2025-2026 Juliusz Ćwiąkalski (https://www.cwiakalski.com | https://www.linkedin.com/in/juliusz-cwiakalski/ | https://x.com/cwiakalski)
# MIT License - see LICENSE file for full terms
source: https://github.com/juliusz-cwiakalski/agentic-delivery-os/blob/main/doc/spec/features/feature-doc-mermaid-validation.md
ados_distribution: internal
id: SPEC-DOC-MERMAID-VALIDATION
status: Current
created: 2026-07-03
last_updated: 2026-07-03
owners: ["Juliusz Ćwiąkalski"]
service: doc-validation
summary: "The first automated guardrail over doc/**: a headless mermaid render validator plus a non-render-safe C4 keyword guard (DEC-7), a doc-path-scoped CI gate, a render-safe diagrams rule, and an authoring self-check wired into three doc-authoring agents."
links:
  related_changes: ["GH-110"]
  decisions: []
  contracts: []
---

# Feature: Doc & Mermaid Validation

## Overview

Documentation surfaces under `doc/**` historically had **no** automated quality gate: a mermaid block that failed to render could pass authoring, the inception gate, PR review, and CI, and ship undetected. This feature is the first automated guardrail over documentation renderability. It couples four deliverables — a headless mermaid **render + render-safe keyword validator** (`scripts/validate-mermaid.sh`), a dedicated **doc-path-scoped CI gate**, a **render-safe diagrams rule** (`.ai/rules/diagrams.md`), and a concise **authoring self-check** in three doc-authoring agents — so a broken or GitHub-unrenderable diagram is caught at authoring time and at PR time.

> **Marker honesty note.** This feature spec carries `ados_distribution: internal`, but `doc/spec/**` is **outside** the GH-67 DM-2 scan set, so the marker is honest-but-unenforced and does not affect the doc-distribution guard. See [feature-doc-distribution-marker.md §63](feature-doc-distribution-marker.md) for the closed scan scope.

## Business Context

### Problem Statement

- **Problem:** No automated check inspected `doc/**` renderability; agents cannot visually "see" a broken diagram. A mermaid block that does not render on GitHub passed every existing gate.
- **Affected Users:** Doc-authoring agents (`spec-writer`, `doc-syncer`, `bootstrapper`), reviewers, and any reader of architecture/decision/process docs.
- **Business Impact:** Unrenderable diagrams ship into current-truth docs; a human only discovers the break by manually rendering the page, and the defect recurs on every subsequent doc-authoring turn. A motivating incident shipped a gate-approved architecture doc whose mermaid block does not render.

### Goals & Success Metrics

- **Primary Goal:** Make `doc/**` renderability an enforced property — broken or GitHub-unrenderable diagrams are unmergeable and detectable locally.
- **KPIs:**

| Metric | Target |
|--------|--------|
| `doc/**` paths with an automated renderability guard | 1 (was 0) |
| Validator verdict determinism on a fixed repo state | 100% reproducible |
| Failure-message completeness (file + block index + first error/reason) | 3/3 on every failure |
| Doc-authoring agents carrying the rule + self-check | 3/3 (`spec-writer`, `doc-syncer`, `bootstrapper`) |
| Runtime dependencies added to the existing `ci.yml` | 0 (dedicated workflow) |

## User Experience & Functionality

### Capabilities

- **Render + render-safe validator (F-1):** `scripts/validate-mermaid.sh` extracts every ```` ```mermaid ```` fenced block from in-scope `.md` files and applies the **dual check**: a block **passes** iff (a) its `mmdc` headless render exits 0 **and** (b) it contains no non-render-safe keyword. The dual check exists because `mmdc` renders Mermaid C4 (`C4Context`/`C4Container`/`C4Component`) that GitHub does **not**, so render-only would miss the exact motivating bug class (DEC-7). The keyword guard is a pure `grep` needing no `mmdc`.
- **CI gate (F-2):** `.github/workflows/docs-mermaid-validate.yml` — a dedicated, doc-path-scoped workflow (job `docs (mermaid validate)`) triggered only on `pull_request` with a `paths:` filter; it installs `@mermaid-js/mermaid-cli` and runs the validator. `ci.yml` is unchanged.
- **Render-safe diagrams rule (F-3):** `.ai/rules/diagrams.md` states the preferred GitHub-render-safe families, the C4 avoidance rule, and a flowchart fallback; it is indexed in `.ai/rules/README.md` and is the **canonical** keyword source.
- **Authoring self-check (F-4):** A concise (1–2 line) reference to `.ai/rules/diagrams.md` plus the self-check in `spec-writer`, `doc-syncer`, and `bootstrapper` — the three doc-authoring agents whose outputs are the real mermaid surfaces today.

### User Flows

```mermaid
flowchart LR
    A[Agent emits a mermaid block] --> B{Self-check pre-DoR/DoD}
    B -->|render-safe + renders| C[Mark passed]
    B -->|broken or C4 keyword| D[Fix the block]
    D --> B
    E[PR touches a doc path] --> F[CI: install mmdc]
    F --> G[Run validate-mermaid.sh]
    G -->|exit 0| H[PR check passes]
    G -->|non-zero| I[PR check fails - blocks merge]
```

### Edge Cases & Error Handling

- **`mmdc` absent locally:** `--if-present` skips the render but **never** skips the keyword guard (a non-render-safe block cannot slip a tool-less local run). Without `--if-present`, an absent `mmdc` with ≥1 block exits `3` (missing-mmdc-when-required).
- **Unterminated mermaid fence:** the extractor validates what was captured (treats it as a block).
- **Non-mermaid code spans** (e.g., an example wrapped in 4 backticks): fence-length tracking prevents them fooling the extractor.
- **Block passes render but contains C4:** the keyword guard forces a failure (DEC-7 / NFR-5 AND-semantics) — this is the regression guard for the motivating incident.
- **`.ai/local/` scratch:** always excluded from the scan so local ephemeral state never trips a run.
- **No mermaid blocks anywhere:** exit 0 (success).

## Technical Architecture & Codebase Map

### High-Level Design

A bash validator is the core detection primitive; the CI gate is the forcing function; the rule is the authoring-time steer; the agent prompts close the authoring-time feedback loop. The render dependency (`mmdc`) and the keyword denylist are both exposed as **injectable seams** so the fast test suite stays Chromium-free and deterministic, and so the denylist can be driven by tests.

### Core Components & Directory Structure

| Path | Component | Responsibility |
|------|-----------|----------------|
| `scripts/validate-mermaid.sh` | Render + render-safe validator (F-1) | Extract `mermaid` blocks; dual render+keyword check; precise failure messages; `--if-present`/`--help`/`--version` |
| `scripts/.tests/test-validate-mermaid.sh` | Validator test (F-1) | `TC-MMD-001…012` (mocked `MMDC_CMD`, no Chromium) + mmdc-gated green baseline (`TC-BASE-001`, self-skips without `mmdc`); auto-discovered by `scripts/test-all.sh` |
| `scripts/.tests/test-docs-mermaid-workflow.sh` | Workflow structural test (F-2) | `TC-CI-003`: grep assertions (required-present + forbidden-absent) + `actionlint`/YAML-parse when available; auto-discovered by `scripts/test-all.sh` |
| `.github/workflows/docs-mermaid-validate.yml` | CI gate (F-2) | `pull_request` + `paths:` filter; `permissions: contents: read`; installs `mmdc`; runs the validator |
| `.github/workflows/ci.yml` | Existing CI (unchanged) | Not modified — the gate is a separate workflow (DEC-1) |
| `.ai/rules/diagrams.md` | Render-safe rule (F-3) | Preferred families + C4 denylist + flowchart fallback; **canonical** keyword source (no `ados_distribution` marker — outside DM-2) |
| `.ai/rules/README.md` | Rule index (F-3) | Indexes the `diagrams.md` row |
| `.opencode/agent/{spec-writer,doc-syncer,bootstrapper}.md` | Authoring self-check (F-4) | Concise rule reference + self-check before marking a doc DoR/DoD-passed |
| `.ados-claude/agent/{spec-writer,doc-syncer,bootstrapper}.md` | Generated plugin (F-4) | Regenerated via `scripts/build-claude-plugin.sh`; CI `verify-claude-build` enforces freshness |

### Key Seams & Contracts

- **`MMDC_CMD` (env, render seam):** the sole mermaid render invocation; defaults to `mmdc`. Set to a shim to mock the render (testability; keeps the fast suite Chromium-free).
- **`RENDER_SAFE_DENYLIST` (env, keyword seam):** space- or comma-separated; **REPLACE** semantics (overrides the default). Default mirrors `.ai/rules/diagrams.md` exactly: `C4Context C4Container C4Component` (DM-3 single source). A drift-guard test (`TC-RULE-004`) pins the parity so the script and rule cannot silently diverge.
- **Scan-root set (DM-2):** the union `{doc, decisions, changes, inception, .ai}` over `.md`, excluding git-ignored paths (notably `.ai/local/`). In this repo `decisions/`/`changes/`/`inception/` live under `doc/`, so `doc/**` subsumes them; the explicit roots mirror the CI `paths:` filter for robustness. Files are enumerated **sorted** (NFR-1).
- **Exit codes (DM-1):** `0` success · `2` usage error · `3` missing-mmdc-when-required · `4` render failure · `5` non-render-safe-keyword failure. Aggregate exit precedence: keyword (5) > render (4) > missing-mmdc (3) > success (0). The missing-`mmdc` code keeps "tool not installed" separable from "tool ran and failed".
- **Failure messages:** every failure emits a human line **and** a GitHub `::error::` annotation, both carrying file path + 1-based block index + first error/keyword (3/3, NFR-4).

### Data Architecture

No persisted data. The validator treats the current repository as the **green baseline** — it passes every existing mermaid block before the gate is enabled (repo `C4*` usage = 0 at delivery). No existing block is re-authored.

## Non-Functional Requirements

| ID | Category | Requirement | Threshold |
|----|----------|-------------|-----------|
| NFR-1 | Determinism | Fixed repo state ⇒ fixed verdict; sorted file enumeration, no time/randomness/ordering dependence | 100% reproducible |
| NFR-2 | Performance | CI runtime — full repo doc-set validation on `ubuntu-latest` | < 120s wall-clock (**CI-only observation**; Chromium cold-start; not assertable in the local fast suite) |
| NFR-3 | Local opt-in safety | `--if-present` never hard-fails a local run on a missing tool; CI (which installs `mmdc`) is mandatory | Local without `mmdc` exits 0 with a skip notice; keyword guard still runs |
| NFR-4 | Failure-message specificity | Every failure carries file path + block index + first error/reason | 3/3 on every failure |
| NFR-5 | Dual-check contract | A block passes iff its `mmdc` render exits 0 **and** it has no non-render-safe keyword | AND-semantics (DEC-7); no pass on stylistic warning alone |
| NFR-6 | `bash.md` conformance | Script + test follow `.ai/rules/bash.md` | ShellCheck-clean, `shfmt -i 2 -ci -bn`; strict mode + traps; context-tagged logging; `MMDC_CMD` injection; testable main guard; documented exit codes |

## Quality Assurance Strategy

### Testing Approach

| Level | Location | Scope/Goal |
|-------|----------|------------|
| Shell integration/unit | `scripts/.tests/test-validate-mermaid.sh` | `TC-MMD-001…012`: broken-block failure, valid-block pass, `MMDC_CMD` injection, C4 keyword guard (incl. `--if-present` and `RENDER_SAFE_DENYLIST` override), AND-semantics truth table, failure-message 3/3, determinism, exit-code distinctness — all Chromium-free via mocked `MMDC_CMD` |
| Green baseline (mmdc-gated) | `scripts/.tests/test-validate-mermaid.sh` (`TC-BASE-001`) | Validator passes the real repo doc tree; self-skips without `mmdc` so the fast suite stays green on a tool-less runner |
| Workflow structural | `scripts/.tests/test-docs-mermaid-workflow.sh` (`TC-CI-003`) | Grep assertions (required-present + forbidden-absent) + `actionlint`/YAML-parse when available; catches a malformed-workflow silent-pass |
| Rule/denylist drift | `TC-RULE-004` | Script default denylist mirrors `.ai/rules/diagrams.md` (byte-aligned); fails on divergence |
| CI freshness | `verify-claude-build` job | `.ados-claude/` is current after the three agent-prompt edits (build invariant) |
| Inspection | workflow / rule / agents | `TC-CI-001`, `TC-RULE-001/002/003`, `TC-AGENT-001` — content greps + `ci.yml` unchanged diff |

### Critical Scenarios

- **Motivating-incident regression (TC-MMD-005 / TC-MMD-012 quadrant 2):** a C4 block with a success-mock `mmdc` **must** fail — `mmdc` renders C4, GitHub does not. This is the case a render-only gate would miss.
- **`--if-present` keyword guard (TC-MMD-006):** a C4 block fails even with `mmdc` absent — the keyword guard needs no `mmdc`, closing the tool-less-local-run gap.
- **Failure-message 3/3 (TC-MMD-009):** file + block index + first error/keyword on every failure; multi-block indexing is per-block, not per-file.

## Operational & Support

### Configuration

| Var / Flag | Default | Effect |
|------------|---------|--------|
| `MMDC_CMD` | `mmdc` | Render command; set to a shim to mock |
| `RENDER_SAFE_DENYLIST` | `C4Context C4Container C4Component` | Keyword denylist (REPLACE semantics); mirrors `.ai/rules/diagrams.md` |
| `VERBOSE` | unset | Set to `true` for debug output |
| `--if-present` | off | Skip the render when `mmdc` is absent (keyword guard still runs) |
| `-h` / `--help` | — | Usage |
| `-V` / `--version` | — | Version |

### Observability

- CI step output + GitHub `::error::` annotations on failure (file + block index + reason). No runtime metrics/logs/alerts beyond CI — this is a repo-internal build gate.

### Cost & Infrastructure

- One CI job on doc-path PRs (Chromium install + per-block render; Puppeteer/Chromium cached). Source-only PRs incur no cost — the `paths:` filter does not match. `ci.yml` is unchanged (DEC-1).
- **Drift management:** pin the `mmdc` version; render divergence vs GitHub is the key ongoing risk. The script's scan-root set (DM-2) and the CI `paths:` filter must stay aligned — future doc-tree layout changes require updating both.

## Dependencies & Risks

- **Depends on:** `@mermaid-js/mermaid-cli` (`mmdc`) — external npm package; pulls `puppeteer` + Chromium (transitive).
- **Depends on:** `.ai/rules/bash.md` (script + test standard); `scripts/test-all.sh` (auto-discovery); `scripts/build-claude-plugin.sh` (`.ados-claude/` regen for agent edits).
- **Non-goals (deferred):** markdownlint config + job; re-rendering diagrams to committed image assets; redistributing the validator or the rule to adopters.

| Risk | Mitigation |
|------|------------|
| **Render divergence** — `mmdc`'s bundled Mermaid ≠ GitHub's; C4 is the canonical case (`mmdc` renders it, GitHub does not) | The keyword guard (DEC-7) + the render-safe-family rule keep authoring inside the low-divergence set; pin `mmdc` deliberately |
| `mmdc`/puppeteer/Chromium heavy/flaky (CI runtime + cold-start) | Dedicated, doc-path-scoped job isolated from `ci.yml`; cache the Chromium install |
| `--if-present` local ambiguity — agents skip local validation, a broken block ships | CI is the hard gate (always installs `mmdc`); the agent self-check includes a cheap keyword grep needing no `mmdc` |
| `.ados-claude/` regen drift — editing agent prompts without regenerating | Regenerate + commit source + generated together; CI `verify-claude-build` enforces freshness |

## Glossary & References

- **`mmdc`** — `@mermaid-js/mermaid-cli`, the headless Mermaid renderer (CLI); pulls `puppeteer` + Chromium.
- **Render-safe family** — a Mermaid diagram family that renders consistently on GitHub (`flowchart`, `sequenceDiagram`, `stateDiagram-v2`, `classDiagram`).
- **C4** — Mermaid C4 diagrams (`C4Context`/`C4Container`/`C4Component`); render in tooling but not on GitHub; avoided.
- **Render divergence** — a block whose render result differs between `mmdc` and GitHub (the motivating failure class; C4 is canonical).
- **`--if-present`** — validator mode that skips the render (exit 0) when `mmdc` is absent; the keyword guard still runs; CI is mandatory.
- **Green baseline** — the current repo state, on which the validator passes before the gate is enabled.

### Related Documentation

- **Delivering change:** GH-110 (this feature; DEC-7 = change-scoped dual-check decision).
- **Rule (canonical keyword source):** [.ai/rules/diagrams.md](../../../.ai/rules/diagrams.md).
- **Validator:** [scripts/validate-mermaid.sh](../../../scripts/validate-mermaid.sh); tests: [test-validate-mermaid.sh](../../../scripts/.tests/test-validate-mermaid.sh), [test-docs-mermaid-workflow.sh](../../../scripts/.tests/test-docs-mermaid-workflow.sh).
- **Sibling spec (DM-2 scope):** [feature-doc-distribution-marker.md](feature-doc-distribution-marker.md) — confirms `doc/spec/**` is outside the marker/guard scan set.
- **Sibling spec (gates neighborhood):** [feature-quality-gates-and-pr.md](feature-quality-gates-and-pr.md) — the verification-and-release gates this doc-renderability gate complements.
