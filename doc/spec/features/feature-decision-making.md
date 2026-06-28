---
ados_distribution: internal
id: SPEC-DECISION-MAKING
status: Current
created: 2026-06-28
last_updated: 2026-06-28
owners: ["engineering"]
service: delivery-os
summary: "The decision-making process/framework: rigor-calibrated ceremony, a universal decision kernel, four-axis classification, a bounded AI-authority model, three decision modes, and a two-stage author+challenge agent flow."
links:
  related_changes: ["GH-79"]
  guides:
    - "doc/guides/decision-making.md"
---

# Feature: Decision-Making Framework

## Overview

ADOS provides a process-first decision-making framework that calibrates the *amount* of process to the *nature and risk* of a decision — not its record prefix. The framework is implemented by the `@decision-advisor` agent (the orchestrator/author for all five types) and the `@decision-critic` agent (the read-only independent challenger), driven by the commands `/plan-decision`, `/write-decision`, and `/review-decision`. This spec covers the **process** — the part **not** covered by the records spec.

> **This spec is the process; the record artifact lives elsewhere.** Decision-record naming, front matter, lifecycle, and governance tables are the concern of the sibling spec [feature-decision-records.md](feature-decision-records.md) (and its guide [decision-records-management.md](../../guides/decision-records-management.md)). This spec does not duplicate that artifact taxonomy; it cross-links it.

## Business Context

### Problem Statement

- **Problem:** Uncalibrated decision process — either too much ceremony for routine choices or too little for high-assurance ones — wastes effort and lets risky decisions slip through.
- **Affected Users:** Engineers, product owners, founders, operators, and the AI agent team.
- **Business Impact:** Poor decision discipline causes reversible choices to be over-documented and irreversible ones to be under-scrutinized.

### Goals & Success Metrics

- **Primary Goal:** Every R1–R3 decision runs a rigor-calibrated kernel with separated recommendation and authorized decision; R0 produces no record.
- **KPIs:** `@decision-advisor` + `@decision-critic` operational; R3 decisions always receive independent challenge + a human final decision.

## User Experience & Functionality

### Capabilities

- **Rigor-calibrated ceremony (F-1):** Four rigor profiles scale process to stakes: **R0** (routine/delegated — no record, optional note), **R1** (lightweight brief, ≤1 business day), **R2** (standard full record), **R3** (high assurance — full record + independent challenge + human final decision). R1 is a strict proper subset of R3; R0 produces zero records. An **emergency overlay** changes sequencing (not accountability) for incidents.
- **Universal decision kernel D0–D14 (F-2):** Every R1–R3 decision runs this lifecycle at depth scaled by rigor: Trigger & Triage (D0) → Charter & Rights (D1) → Context & Evidence (D2) → Problem Framing (D3) → Constraints & Guardrails (D4) → Drivers & Value Model (D5) → Assumptions/Unknowns (D6) → Alternative Generation (D7) → Feasibility & Constraint Filter (D8) → Analysis Method (D9) → Adversarial Challenge (D10) → Recommendation & Decision separated (D11) → Execution (D12) → Verification & Revisit (D13) → Retrospective (D14).
- **Four-axis classification (F-3):** A decision is classified on Type (ADR/PDR/TDR/BDR/ODR) × Domain tags × Archetype × Conditions. Classification drives rigor, method, and authority — it is **not** collapsed to a single record type.
- **Constraints vs drivers discipline (F-4):** Constraints are binary pass/fail gates that eliminate alternatives (each with a `negotiable: yes|no` field); drivers are continuous preferences that rank survivors. The two factor classes are kept strictly separate; every alternative carries an explicit constraint-compliance evaluation.
- **Bounded AI-authority model (F-5):** AI is a decision **aid**, not an unaccountable decider. AI may make a final decision autonomously only when authority is explicitly delegated, the decision is R0/defined-R1, boundaries are machine-checkable, reversal is easy, blast radius is limited, an audit trail exists, and an escalation path exists. R3 **always** requires a human final decision. Recommendation ≠ decision: the analyst/AI recommendation is rendered separately from the authorized (often human) decision.
- **Three decision modes (F-6):** (a) Interactive AI session (`/plan-decision` → `/write-decision` → human decides); (b) meeting-driven (meeting discussion becomes evidence input to `/plan-decision`); (c) delegated AI autonomous (R0–R1, bounded, audited).
- **Two-stage author + challenge flow (F-7):** `@decision-advisor` authors the recommendation/record; `@decision-critic` independently challenges it (D10), returning a tri-state verdict (**PASS / PASS_WITH_RISKS / REWORK**). The critic is read-only and does not modify the record.

### Honest independence

Multiple AI agents using the **same model + prompt lineage do not constitute independent evidence.** In a single-model configuration, `@decision-critic` is a **first-pass check, not independent assurance**; R3 always needs a human reviewer regardless of the critic's verdict. Where a different model family is configured, assigning it to the critic is **recommended, not mandated**.

### User Flows

```
Interactive:  /plan-decision  → @decision-advisor triages/classifies/runs kernel
              → /write-decision renders the record proportionally (R1/R2/R3)
              → /review-decision <ID> → @decision-critic independent challenge (tri-state)
              → human decides for R2/R3 (record stays Proposed until authorized)

Delegated:    AI acts within §6 bounds for R0/R1; audit trail + escalation; R0 no record
```

### Edge Cases & Error Handling

- **R0 escape hatch:** a local, easily reversible, policy-covered choice produces **no record** — reaching for a full record is a process smell.
- **R2/R3 auto-Accept refusal:** `@decision-advisor` never marks R2/R3 `Accepted` or sets `decision_date` without an authorized human decision.
- **REWORK loop:** a `REWORK` verdict returns the decision to `@decision-advisor` to address material defects (violated constraint, missing option, framing error).

## Technical Architecture & Codebase Map

### Core Components

| Path | Component | Responsibility |
|------|-----------|----------------|
| `doc/guides/decision-making.md` | Decision-making guide | Authoritative process (kernel, rigor profiles, classification, AI-authority model, modes). NOTE: carries no `status:` key — it is not Draft. |
| `.opencode/agent/decision-advisor.md` | Decision advisor agent | Domain-neutral orchestrator for all five types; runs triage → classify → rigor → rights → kernel; requests human approval for R2/R3 |
| `.opencode/agent/decision-critic.md` | Decision critic agent | Read-only independent challenger (D10); tri-state verdict; honest about same-model non-independence |
| `.opencode/command/plan-decision.md` | Plan Decision command | Interactive planning session (triage → classify → rigor → rights → D2–D9) |
| `.opencode/command/write-decision.md` | Write Decision command | Renders the record proportionally by rigor; keeps recommendation ≠ decision; refuses auto-Accept of R2/R3 |
| `.opencode/command/review-decision.md` | Review Decision command | Delegates an independent challenge to `@decision-critic` |
| `.ai/agent/decision-instructions.md` | Project-local instructions | Optional project-specific strategic context + tracking conventions (read by advisor + critic when present) |

## Non-Functional Requirements

| ID | Category | Requirement | Threshold |
|----|----------|-------------|-----------|
| NFR-1 | Calibration | Process depth is scaled by rigor profile (R0–R3), not record prefix | R0 = no record; R3 = full + challenge + human |
| NFR-2 | Separation | Recommendation is rendered separately from authorized decision | R2/R3 never auto-Accepted by AI |
| NFR-3 | Independence | R3 always receives independent challenge + a human reviewer | Regardless of critic verdict |
| NFR-4 | Factor hygiene | Constraints (binary) and drivers (continuous) kept separate | No factor in both buckets |

## Quality Assurance Strategy

### Testing Approach

| Level | Scope | Notes |
|-------|-------|-------|
| Manual | Two-stage flow | Run `/plan-decision` → `/write-decision` → `/review-decision`; verify proportional rendering + tri-state verdict |
| Manual | R3 guard | Verify an R3 record stays `status: Proposed` until a human decides |

## Dependencies & Risks

- **Depends on:** the record artifact standard (sibling spec [feature-decision-records.md](feature-decision-records.md)) and the record template (`doc/templates/decision-record-template.md`).
- **Risk:** Model-config conflation — the critic in a single-model setup is not independent; mitigated by the honest-independence statement and the R3 human-reviewer requirement.
- **Risk:** Over-ceremony on routine choices; mitigated by the R0 escape hatch.

## Related Documentation

- **Process guide (authoritative):** [doc/guides/decision-making.md](../../guides/decision-making.md) — kernel D0–D14, rigor profiles, classification, AI-authority model, modes.
- **Decision advisor prompt:** `.opencode/agent/decision-advisor.md`.
- **Decision critic prompt:** `.opencode/agent/decision-critic.md`.
- **Commands:** `/plan-decision`, `/write-decision`, `/review-decision` (`.opencode/command/*.md`).
- **Project-local config:** `.ai/agent/decision-instructions.md`.
- **Sibling spec (record artifact, not duplicated here):** [feature-decision-records.md](feature-decision-records.md) — naming, front matter, lifecycle, governance.
- **Record-artifact reference:** [decision-records-management.md](../../guides/decision-records-management.md).
- **Record template:** [doc/templates/decision-record-template.md](../../templates/decision-record-template.md) — single source of truth for record body structure.
- **System bootstrap:** [AGENTS.md](../../../AGENTS.md) — decision-advisor / decision-critic roles.
