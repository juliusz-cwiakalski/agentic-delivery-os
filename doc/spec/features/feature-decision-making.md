---
# Copyright (c) 2025-2026 Juliusz Ćwiąkalski (https://www.cwiakalski.com | https://www.linkedin.com/in/juliusz-cwiakalski/ | https://x.com/cwiakalski)
# MIT License - see LICENSE file for full terms
source: https://github.com/juliusz-cwiakalski/agentic-delivery-os/blob/main/doc/spec/features/feature-decision-making.md
ados_distribution: internal
id: SPEC-DECISION-MAKING
status: Current
created: 2026-06-28
last_updated: 2026-07-05
owners: ["engineering"]
service: delivery-os
summary: "The decision-making process/framework: rigor-calibrated ceremony, a universal decision kernel, four-axis classification with domains-first extension and an ADR/TDR tie-breaker, tiered-default section applicability, a bounded AI-authority model, three decision modes, a bounded technical-selection evidence pack with security controls, evidence delegation to @external-researcher, and a two-stage author+challenge agent flow."
links:
  related_changes: ["GH-79", "GH-133"]
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

- **Primary Goal:** Every R1–R3 decision runs a rigor-calibrated kernel; R0 produces no record. Recommendation and discussion happen on the PR; the record captures the final authorized decision.
- **KPIs:** `@decision-advisor` + `@decision-critic` operational; R3 decisions always receive independent challenge + a human final decision.

## User Experience & Functionality

### Capabilities

- **Rigor-calibrated ceremony (F-1):** Four rigor profiles scale process to stakes: **R0** (routine/delegated — no record, optional note), **R1** (lightweight brief, ≤1 business day), **R2** (standard full record), **R3** (high assurance — full record + independent challenge + human final decision). R1 is a strict proper subset of R3; R0 produces zero records. An **emergency overlay** changes sequencing (not accountability) for incidents.
- **Universal decision kernel D0–D14 (F-2):** Every R1–R3 decision runs this lifecycle at depth scaled by rigor: Trigger & Triage (D0) → Charter & Rights (D1) → Context & Evidence (D2) → Problem Framing (D3) → Constraints & Guardrails (D4) → Drivers & Value Model (D5) → Assumptions/Unknowns (D6) → Alternative Generation (D7) → Feasibility & Constraint Filter (D8) → Analysis Method (D9) → Adversarial Challenge (D10) → Decision (D11) → Execution (D12) → Verification & Revisit (D13) → Retrospective (D14).
- **Four-axis classification (F-3):** A decision is classified on Type (ADR/PDR/TDR/BDR/ODR) × Domain tags × Archetype × Conditions. Classification drives rigor, method, and authority — it is **not** collapsed to a single record type. **Domains-first extension:** specialized concerns (security, privacy, compliance, data, legal, AI, vendor, procurement, ML, UX) route to `classification.domains` plus the primary owning type — **never** to a new top-level prefix; the five top-level types stay stable. **ADR vs TDR tie-breaker:** when both fit, prefer **ADR** when `reversibility=hard` **or** `blast_radius≥team`, otherwise prefer **TDR**; the tie is recorded via `classification.conditions` (not by the prefix alone). Common overlap guidance exists for pricing (PDR if packaging/value; BDR if revenue/contracts), infrastructure (ADR if system-shaping; ODR if operating an existing system), data retention (BDR/ODR/ADR by primary driver), and security/privacy (domain tag + owning type).
- **Constraints vs drivers discipline (F-4):** Constraints are binary pass/fail gates that eliminate alternatives (each with a `negotiable: yes|no` field); drivers are continuous preferences that rank survivors. The two factor classes are kept strictly separate; every alternative carries an explicit constraint-compliance evaluation.
- **Bounded AI-authority model (F-5):** AI is a decision **aid**, not an unaccountable decider. AI may make a final decision autonomously only when authority is explicitly delegated, the decision is R0/defined-R1, boundaries are machine-checkable, reversal is easy, blast radius is limited, an audit trail exists, and an escalation path exists. R3 **always** requires a human final decision. Recommendation happens on the PR; the record merged to `main` captures the final authorized decision at `status: Accepted`.
- **Three decision modes (F-6):** (a) Interactive AI session (`/plan-decision` → `/write-decision` → human decides); (b) meeting-driven (meeting discussion becomes evidence input to `/plan-decision`); (c) delegated AI autonomous (R0–R1, bounded, audited).
- **Two-stage author + challenge flow (F-7):** `@decision-advisor` authors the recommendation/record; `@decision-critic` independently challenges it (D10), returning a tri-state verdict (**PASS / PASS_WITH_RISKS / REWORK**). The critic is read-only and does not modify the record.
- **Tiered-default section applicability (F-8):** Rigor (R1/R2/R3) is the **primary axis** that drives the section set rendered in a record; a record's type and archetype toggle only a small, **enumerated** set of optional add-ons (e.g., a Technical-Selection Evidence pack only when `archetype=selection`; a Communication Plan only when `governance.informed` is non-empty). This deliberately replaces a full 2D applicability matrix (rigor × type), which would push agents to over-emit sections and bloat R1 briefs. The template tags each section by rigor applicability (`R1/R2/R3`, `R2/R3`, `R3-expanded`) and is the section-order authority.
- **Bounded technical-selection evidence pack (F-9):** For framework/library/tool/vendor selections (`archetype: selection`) at R2/R3, a bounded pack defaults to **top-3 candidate options × ~10 highest-signal fields** (expand when the decision warrants more alternatives) (license, maturity/age, release cadence, contributors/activity, issue responsiveness + bus factor, security advisories, adoption, migration/SemVer discipline, integration fit, lock-in cost). Every signal carries a `FACT`/`ASSUMPTION`/`TO-CONFIRM` label, a **canonical source** (official registry/repo URL, not an aggregator), and an **as-of date**. Three mandatory **security controls**: canonical-source verification, as-of-date + revisit trigger ("dependency security advisory published"), and **data-minimization** (send only the research question + public identifiers externally; wire `ai_assistance.external_data_shared`). Signals are evidence, **not a blind numeric scorecard** (a scorecard is allowed only when D9 deliberately selects MCDA). License is recorded as a `FACT` string; **compatibility is a human/R3 determination**.
- **Evidence delegation to `@external-researcher` (F-10):** `@decision-advisor` never uses the network directly. For D2 (Context & Evidence) on a selection decision where external facts materially affect the recommendation, it delegates **bounded** evidence gathering to `@external-researcher` and remains the **synthesizer** of the returned pack — labeling findings `FACT`/`ASSUMPTION`/`TO-CONFIRM` and never inventing metrics. **R1 defaults to local:** R1 uses local evidence + `ASSUMPTION` labels and delegates externally only when the decider explicitly opts in (preserving the R1 ≤ 1 business day SLO). **License-as-human-step:** when a selection introduces a dependency, the advisor records the license string as a `FACT` and flags it for human compatibility-determination **and** acceptance — it never autonomously concludes compatibility or accepts a license.

### Honest independence

Multiple AI agents using the **same model + prompt lineage do not constitute independent evidence.** In a single-model configuration, `@decision-critic` is a **first-pass check, not independent assurance**; R3 always needs a human reviewer regardless of the critic's verdict. Where a different model family is configured, assigning it to the critic is **recommended, not mandated**.

### User Flows

```
Interactive:  /plan-decision  → @decision-advisor triages/classifies/runs kernel
               → /write-decision renders the record proportionally (R1/R2/R3)
               → /review-decision <ID> → @decision-critic independent challenge (tri-state)
               → human decides for R2/R3 (record stays Proposed until authorized)

Delegated:    AI acts within §6 bounds for R0/R1; audit trail + escalation; R0 no record

Selection:    archetype=selection (R2/R3) → @decision-advisor delegates bounded pack to @external-researcher
              (never networks directly) → researcher routes context7→deepwiki→perplexity→web-search
              → returns pack (canonical source, as-of date, data-minimized)
              → advisor labels FACT/ASSUMPTION/TO-CONFIRM → eligibility-first filter → driver ranking
              → recommendation (separate from authorized decision); license flagged as a human step
```

### Edge Cases & Error Handling

- **R0 escape hatch:** a local, easily reversible, policy-covered choice produces **no record** — reaching for a full record is a process smell.
- **R2/R3 auto-Accept refusal:** `@decision-advisor` never marks R2/R3 `Accepted` or sets `decision_date` without an authorized human decision.
- **REWORK loop:** a `REWORK` verdict returns the decision to `@decision-advisor` to address material defects (violated constraint, missing option, framing error).
- **License-as-human-step:** when a selection introduces a dependency, the license is recorded as a `FACT` (with source) but compatibility determination and acceptance are always a human/R3 step — the advisor never autonomously accepts a license.
- **R1 default-local:** R1 uses local evidence + `ASSUMPTION` labels; external delegation happens only when the decider explicitly requests it, preserving the R1 ≤ 1 business day SLO.
- **No fabricated metrics:** when external evidence is incomplete, unknowns are marked `TO-CONFIRM` rather than invented.

## Technical Architecture & Codebase Map

### Core Components

| Path | Component | Responsibility |
|------|-----------|----------------|
| `doc/guides/decision-making.md` | Decision-making guide | Authoritative process (kernel, rigor profiles, tiered-default applicability, four-axis classification + domains-first + ADR/TDR tie-breaker, AI-authority model, bounded technical-selection evidence pack + security controls, modes). NOTE: carries no `status:` key — it is not Draft. |
| `.opencode/agent/decision-advisor.md` | Decision advisor agent | Domain-neutral orchestrator for all five types; runs triage → classify → rigor → rights → kernel; requests human approval for R2/R3; delegates bounded evidence gathering to `@external-researcher` for selection decisions (never networks directly); applies the ADR/TDR tie-breaker and R1 default-local rule |
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
| NFR-5 | Applicability model | Rigor is the single primary axis driving the section set; no full 2D type × rigor matrix | Tiered-default model; enumerated type/archetype add-ons only |
| NFR-6 | Evidence bound | Technical-selection evidence pack is bounded | Default 3 candidate options (expand when warranted) × ~10 highest-signal fields |
| NFR-7 | R1 cycle time | External delegation is off by default at R1 | ≤ 1 business day; R1 defaults to local evidence |
| NFR-8 | Evidence integrity | Every selection signal carries a canonical source, an as-of date, and a FACT/ASSUMPTION/TO-CONFIRM label | Aggregators never the sole source; license is a human step |

## Quality Assurance Strategy

### Testing Approach

| Level | Scope | Notes |
|-------|-------|-------|
| Manual | Two-stage flow | Run `/plan-decision` → `/write-decision` → `/review-decision`; verify tiered-default rendering + tri-state verdict |
| Manual | R3 guard | Verify an R3 record stays `status: Proposed` until a human decides |

## Dependencies & Risks

- **Depends on:** the record artifact standard (sibling spec [feature-decision-records.md](feature-decision-records.md)) and the record template (`doc/templates/decision-record-template.md`).
- **Depends on:** `@external-researcher` for bounded evidence gathering on selection decisions (sibling spec [feature-external-researcher.md](feature-external-researcher.md)).
- **Risk:** Model-config conflation — the critic in a single-model setup is not independent; mitigated by the honest-independence statement and the R3 human-reviewer requirement.
- **Risk:** Over-ceremony on routine choices; mitigated by the R0 escape hatch and the tiered-default model (R1 is a strict proper subset).
- **Risk:** Data leakage in delegation to the researcher; mitigated by the data-minimization rule (question + public identifiers only) and `ai_assistance.external_data_shared`.
- **Risk:** Evidence signals misused as a blind numeric scorecard; mitigated by the explicit warning (scorecard only when D9 selects MCDA) and license-as-human-step.

## Related Documentation

- **Process guide (authoritative):** [doc/guides/decision-making.md](../../guides/decision-making.md) — kernel D0–D14, rigor profiles, tiered-default applicability, classification + domains-first + ADR/TDR tie-breaker, AI-authority model, bounded technical-selection evidence pack + security controls, modes.
- **Decision advisor prompt:** `.opencode/agent/decision-advisor.md` (includes the evidence-delegation contract, R1 default-local rule, and license-as-human-step).
- **Decision critic prompt:** `.opencode/agent/decision-critic.md`.
- **Commands:** `/plan-decision`, `/write-decision`, `/review-decision` (`.opencode/command/*.md`).
- **Project-local config:** `.ai/agent/decision-instructions.md`.
- **Sibling spec (record artifact, not duplicated here):** [feature-decision-records.md](feature-decision-records.md) — naming, front matter, lifecycle, governance.
- **Sibling spec (evidence delegation target):** [feature-external-researcher.md](feature-external-researcher.md) — decision-evidence gathering mode.
- **Record-artifact reference:** [decision-records-management.md](../../guides/decision-records-management.md).
- **Record template:** [doc/templates/decision-record-template.md](../../templates/decision-record-template.md) — single source of truth for record body structure; tags each section by rigor applicability; ships worked R1/R2/R3 examples.
- **System bootstrap:** [AGENTS.md](../../../AGENTS.md) — decision-advisor / decision-critic roles.
