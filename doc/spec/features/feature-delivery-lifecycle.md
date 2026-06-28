---
ados_distribution: internal
id: SPEC-DELIVERY-LIFECYCLE
status: Current
created: 2026-06-28
last_updated: 2026-06-28
owners: ["engineering"]
service: delivery-os
summary: "The deterministic 11-phase spec→plan→deliver→review→PR change delivery workflow with PM-led orchestration, Definition of Ready / Definition of Done gating, phase reopening, and the per-change artifact set."
links:
  related_changes: ["GH-79"]
  guides:
    - "doc/guides/change-lifecycle.md"
    - "doc/guides/definition-of-ready.md"
    - "doc/guides/definition-of-done.md"
---

# Feature: Delivery Lifecycle

## Overview

ADOS turns a single tracker ticket (`workItemRef`) into a reviewed, tested PR/MR through a **deterministic, gated 11-phase workflow** orchestrated by the `@pm` agent. Each phase is owned by a specialized agent and produces or validates a concrete artifact. The workflow is the spine of the system: it is what `@pm` drives via `@pm deliver change <ref>` (autopilot) or what a human steps through manually (`/write-spec` → `/write-test-plan` → `/write-plan` → `/check-readiness` → `/run-plan` → `/sync-docs` → `/review` → `/check` → `/pr`).

> **Lifecycle phase count and owner are canonical.** The lifecycle is **11 phases** ending in `pr_creation`; `system_spec_update` is **phase 7** (run by `@doc-syncer`). The authoritative owner/agent table is in [AGENTS.md](../../../AGENTS.md) ("Delivery process"), and the full per-phase detail (actions, outcomes, exit criteria, the mermaid diagram) is in [doc/guides/change-lifecycle.md](../../guides/change-lifecycle.md). This spec does **not** restate that table; it names the capabilities and points to the canonical sources.

## Business Context

### Problem Statement

- **Problem:** Software delivery without a deterministic workflow produces late-discovered gaps, inconsistent artifacts, and un-reviewable PRs.
- **Affected Users:** Engineers, reviewers, and the AI agent team that delivers changes.
- **Business Impact:** A non-deterministic workflow makes quality, traceability, and coverage non-reproducible; the lifecycle's gates exist to catch gaps at the cheapest moment.

### Goals & Success Metrics

- **Primary Goal:** Every change flows through the same gated phases from ticket to PR, producing a traceable artifact set and a PASS at every gate.
- **KPIs:** Every change has the four mandatory artifacts; DoR returns `READY` (or a recorded trivial override); DoD confirms all AC met.

## User Experience & Functionality

### Capabilities

- **11-phase gated workflow (F-1):** `clarify_scope` → `specification` → `test_planning` → `delivery_planning` → `dor_check` → `delivery` → `system_spec_update` → `review_fix` → `quality_gates` → `dod_check` → `pr_creation`. See the canonical table in [AGENTS.md](../../../AGENTS.md) and the per-phase sections in [change-lifecycle.md](../../guides/change-lifecycle.md).
- **PM orchestration (F-2):** `@pm` owns the lifecycle; it delegates each phase to the matching agent (e.g. `specification` → `@spec-writer`, `delivery` → `@coder`, `dor_check` → `@readiness-reviewer`) and manages the ticket via MCP. `@pm` never implements code. (Authoritative: `.opencode/agent/pm.md`.)
- **Definition of Ready gate (F-3):** `dor_check` (phase 5) is a **hard pre-delivery gate**: `@readiness-reviewer` adversarially critiques the **spec + test-plan + plan together against the ticket** and emits `READY` / `NOT_READY`. See [definition-of-ready.md](../../guides/definition-of-ready.md) (a human-readable mirror; the `@readiness-reviewer` prompt is authoritative).
- **Definition of Done check (F-4):** `dod_check` (phase 10) verifies all phases complete, all plan tasks checked, and all acceptance criteria satisfied before PR creation. See [definition-of-done.md](../../guides/definition-of-done.md).
- **Phase reopening (F-5):** Phases are **not strictly linear**. When a gap is discovered in a later phase, `@pm` reopens the relevant earlier phase and re-delegates. Critically, a DoR `NOT_READY` reopens an **artifact-creation phase** (`specification`, `test_planning`, or `delivery_planning`) — **never `delivery`**. Review remediation, quality-gate fixes, and DoD gaps reopen `delivery` (or the relevant phase). Every reopening triggers a `retro` note in `chg-<ref>-pm-notes.yaml`.
- **Artifact set (F-6):** Each change lives under `doc/changes/YYYY-MM/YYYY-MM-DD--<workItemRef>--<slug>/` and carries four mandatory artifacts plus optional ones. The folder/branch/naming convention is defined authoritatively in [doc/guides/unified-change-convention-tracker-agnostic-specification.md](../../guides/unified-change-convention-tracker-agnostic-specification.md); this spec does not restate it.

### The Mandatory Per-Change Artifact Set

| Artifact | Purpose | Mandatory |
|----------|---------|-----------|
| `chg-<ref>-spec.md` | Canonical specification (problem, goals, AC, DoD) | Yes |
| `chg-<ref>-test-plan.md` | Test strategy + traceability to AC | Yes |
| `chg-<ref>-plan.md` | Phased, check-listable implementation plan | Yes |
| `chg-<ref>-pm-notes.yaml` | PM phase tracking, decisions, open questions, retro notes (git-committed) | Yes |
| `doc/decisions/<TYPE>-<zeroPad4>-<slug>.md` | Decision record for a major/precedent-setting decision | Optional |

### Two Gated Acceptance Checks (DoR / DoD)

The lifecycle is bracketed by two gates that mirror each other:

| Gate | Phase | Owner | When | Checks |
|------|-------|-------|------|--------|
| **Definition of Ready** | 5. `dor_check` | `@readiness-reviewer` | Before code | Artifacts vs ticket + existing system spec; spec_completeness, ac_quality, plan_coverage, test_traceability, cross_artifact_consistency, etc. |
| **Definition of Done** | 10. `dod_check` | `@pm` | After code | All phases complete; all plan tasks checked; all AC satisfied |

### User Flows

```
Autopilot:   @pm deliver change <ref>   → @pm drives all 11 phases, delegating per phase
Manual:      /plan-change → /write-spec → /write-test-plan → /write-plan
             → /check-readiness → /run-plan → /sync-docs → /review → /check → /pr
```

### Edge Cases & Error Handling

- **DoR stalemate:** after 3 `NOT_READY` iterations, escalate to human.
- **Trivial-change DoR bypass:** an explicit, recorded override (workItemRef, triviality rationale, human approver, date) in `pm-notes.yaml` is the **only** DoR bypass; no silent skip exists.
- **Phase reopening after code:** if `quality_gates` reveals missing implementation, reopen `delivery` and delegate to `@fixer` / `@coder`.

## Technical Architecture & Codebase Map

### Core Components

| Path | Component | Responsibility |
|------|-----------|----------------|
| `.opencode/agent/pm.md` | PM agent (orchestrator) | Owns the lifecycle; delegates phases; manages ticket via MCP; phase definitions live here |
| `.opencode/agent/{spec-writer,test-plan-writer,plan-writer}.md` | Artifact authors | Phases 2–4 (specification, test_planning, delivery_planning) |
| `.opencode/agent/readiness-reviewer.md` | Readiness reviewer | Phase 5 (dor_check) — authoritative DoR gate |
| `.opencode/agent/coder.md` | Coder agent | Phase 6 (delivery) — executes plan phases |
| `.opencode/agent/doc-syncer.md` | Doc-syncer agent | Phase 7 (system_spec_update) — reconciles system docs; also runs the feature-spec-coverage check |
| `.opencode/agent/{reviewer,runner,fixer,committer,pr-manager}.md` | Verification & finalization agents | Phases 8–11 |
| `doc/guides/change-lifecycle.md` | Lifecycle guide | Human-readable mirror of the 11 phases (status: Draft; prompts authoritative) |
| `doc/guides/definition-of-ready.md` | DoR guide | Human-readable mirror of the DoR gate (status: Draft; `@readiness-reviewer` prompt authoritative) |

### Key Agent Boundaries

- `@pm` orchestrates but does **not** implement, debug, run gates, or commit directly — it delegates to `@coder`, `@fixer`, `@runner`, `@committer`.
- `@doc-syncer` only **reconciles and reports**; it never modifies source code or change artifacts.
- Phase definitions in `.opencode/agent/pm.md` are the operational source of truth for the phase list; the guide mirrors them.

## Non-Functional Requirements

| ID | Category | Requirement | Threshold |
|----|----------|-------------|-----------|
| NFR-1 | Determinism | Every change follows the same 11-phase gated sequence | 100% of changes |
| NFR-2 | Gating | DoR (phase 5) and DoD (phase 10) are hard gates | No silent DoR bypass; only a recorded trivial override |
| NFR-3 | Traceability | Every change carries the 4 mandatory artifacts under the convention folder | 4/4 per change |
| NFR-4 | Reopening discipline | DoR `NOT_READY` reopens an artifact phase, never `delivery` | Zero `delivery` reopenings from DoR |

## Quality Assurance Strategy

### Testing Approach

| Level | Scope | Notes |
|-------|-------|-------|
| Manual | Lifecycle walk-through | Deliver a change via autopilot and via manual commands; verify all phases run and gate |
| Structural | Artifact presence | Each change folder contains the 4 mandatory artifacts |
| Grep | Phase count | The lifecycle is described as **eleven** phases; `system_spec_update` = phase 7 (no stale shorter-phase phrasing) |

## Dependencies & Risks

- **Depends on:** the full agent team (every phase has a dedicated agent).
- **Depends on:** the Unified Change Convention for folder/branch/naming (`doc/guides/unified-change-convention-tracker-agnostic-specification.md`).
- **Risk:** Guide drift — the lifecycle guide is `status: Draft`; the `@pm` prompt is the operational source of truth. Mitigated by the "prompt wins" rule recorded in `definition-of-ready.md`.

## Related Documentation

- **Lifecycle guide (canonical detail):** [doc/guides/change-lifecycle.md](../../guides/change-lifecycle.md) — full 11-phase sections, mermaid diagram, PM notes structure, reopening table.
- **PM agent prompt:** `.opencode/agent/pm.md` — phase definitions, delegation inventory, workflow steps.
- **Change convention:** [doc/guides/unified-change-convention-tracker-agnostic-specification.md](../../guides/unified-change-convention-tracker-agnostic-specification.md) — `workItemRef`, folder/branch naming.
- **Definition of Ready:** [definition-of-ready.md](../../guides/definition-of-ready.md) — phase 5 gate (mirror; `@readiness-reviewer` prompt authoritative).
- **Definition of Done:** [definition-of-done.md](../../guides/definition-of-done.md) — phase 10 gate.
- **System bootstrap:** [AGENTS.md](../../../AGENTS.md) — the 11-phase owner/agent table ("Delivery process").
- **Sibling spec:** [feature-quality-gates-and-pr.md](feature-quality-gates-and-pr.md) — phases 8–11 (review_fix, quality_gates, dod_check, pr_creation) are that spec's scope.
