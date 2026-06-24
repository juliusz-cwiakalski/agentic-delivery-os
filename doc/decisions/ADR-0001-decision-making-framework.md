---
# Copyright (c) 2025-2026 Juliusz Ćwiąkalski (https://www.cwiakalski.com | https://www.linkedin.com/in/juliusz-cwiakalski/ | https://x.com/cwiakalski)
# MIT License - see LICENSE file for full terms
source: https://github.com/juliusz-cwiakalski/agentic-delivery-os/blob/main/doc/decisions/ADR-0001-decision-making-framework.md
id: ADR-0001
decision_type: adr
status: Proposed
created: 2026-06-24
decision_date: null
last_updated: 2026-06-24
summary: "Refactor the decision-making subsystem: rename @architect -> @decision-advisor, add @decision-critic + /review-decision, process-first guide, bounded AI authority, proportional rigor"
owners:
  - "Juliusz Ćwiąkalski"
service: delivery-os
decision_area: architecture
decision_scope: org
reversibility: moderate
review_date: null
business_impact: "Improves decision quality across the delivery system; reduces architecture-bias blind spots"
customer_impact: null
classification:
  domains: [architecture, operations]
  archetype: design
  environment: complicated
  rigor: R3
  reversibility: moderate
  stakes: high
  urgency: medium
  uncertainty: medium
  blast_radius: org
  recurrence: one-off
governance:
  driver: "@decision-advisor"
  decider: null
  contributors:
    - "Juliusz Ćwiąkalski (author)"
  reviewers: []
  performers:
    - "@coder"
  informed:
    - "ADOS users"
ai_assistance:
  used: true
  roles: [analyst, record-writer]
  external_data_shared: false
  citations_verified: true
  human_decider: null
  reviewers: []
revisit_triggers:
  - "Adoption friction suggests the guide is too heavy or too light"
  - "A future Decision-Intelligence lifecycle ticket adds deferred machinery (verifier/retro, schemas, catalogs)"
  - "Same-model critic independence proves insufficient in practice"
links:
  related_changes: ["GH-46"]
  supersedes: []
  superseded_by: []
  spec: ["doc/spec/features/feature-decision-records.md"]
  contracts: []
  diagrams: []
  decisions: []
  experiments: []
  metrics: []
  roadmap_items: []
---

# ADR-0001: Decision-Making Framework Refactor

## Context

ADOS uses an `@architect` agent to author Architecture Decision Records (ADRs) and, following GH-52, also Product/Business/Technical/Operational records (PDR/BDR/TDR/ODR). The agent is named after one of five decision types — a domain-biased name that causes a discovery bug: users encountering a product or pricing decision do not naturally think to call an "architect."

Additionally, the decision *process* (when to decide, how much ceremony, who decides, what AI may decide autonomously) lives implicitly in agent prompts — not in public, reviewable documentation. GH-60 introduced hard constraints on the decision-record body structure and the constraints-vs-drivers discipline; those fixes revealed that the agent had a baked-in body structure that drifted from the template (two sources of truth).

GH-46 consolidates a broader decision-making framework refactor: rename the agent, extract the process into a public guide, add a bounded-AI-authority model, add an independent challenge agent (`@decision-critic`), integrate meeting decisions, and dogfood the new process by recording this very decision as ADR-0001.

## Problem Framing (Clarified)

The root cause is a coupling of three concerns in one agent: (1) domain identity (architecture), (2) decision process (kernel, rigor, rights), and (3) record rendering (body structure). This coupling causes:

- **Discovery failure**: non-architecture decisions are under-served because the entry point is domain-biased.
- **Process opacity**: the decision process is invisible to users and reviewers; it cannot be challenged or improved publicly.
- **Drift**: the agent's baked-in body structure diverges from the template (the defect that GH-60 surfaced).
- **Missing governance primitives**: no bounded-AI-authority model, no independent challenge path, no DACI decision rights.

The fix is to separate these concerns: rename the agent to a domain-neutral name, extract the process into a public guide, make the agent reference (not duplicate) the template for body structure, and add the missing governance primitives.

## Constraints (Hard Requirements)

### C-1: Backward compatibility

- **Statement:** Existing `<technical_decision_planning_summary>` tags and `adr.*` fields must continue to work with zero behavior change for existing consumers.
- **Source:** internal standard (NFR-2)
- **Verification:** test (alias path produces equivalent output)
- **Negotiable:** no

### C-2: Single source of truth for body section order

- **Statement:** There must be exactly ONE structural definition of the decision-record body; the agent must NOT bake in its own body-section list.
- **Source:** prior decision (GH-60 NFR-1; this change's NFR-4)
- **Verification:** code review (grep for structural enumerations; count must be 1)
- **Negotiable:** no

### C-3: No stored chain-of-thought

- **Statement:** Decision records capture decision + rationale + assumptions only; no raw model chain-of-thought is stored.
- **Source:** internal standard (NFR-6)
- **Verification:** audit
- **Negotiable:** no

### C-4: Git-native; no proprietary runtime

- **Statement:** All artifacts are plain Markdown/YAML; no proprietary runtime, secret, or network call is introduced.
- **Source:** internal standard (NFR-5)
- **Verification:** code review
- **Negotiable:** no

## Decision Drivers

**Business drivers:**
- Improve decision quality across all five types, not just architecture
- Reduce discovery friction (users finding the right tool for any decision type)

**Technical drivers:**
- Eliminate the drift source (agent vs template body structure)
- Right-size ceremony (proportional rigor reduces overhead for routine decisions)
- Maintainability (condensed single guide vs proliferated files)

**Operational drivers:**
- Keep a human accountable for material/irreversible decisions (bounded AI authority)
- Provide an independent challenge path for high-stakes decisions (R3 governance)

## Mental Models & Techniques Used

- **First Principles**: What is the irreducible purpose of a decision-making agent? (Answer: help make and record decisions of any type — the domain is incidental to the function.)
- **Separation of Concerns**: Identity (domain-neutral), Process (public guide), Rendering (template reference) are three distinct responsibilities that were coupled.
- **Proportionality / Pareto**: Most decisions are R0–R1 (routine, reversible). Full ceremony for every decision is wasteful and encourages bypass.
- **Inversion**: What would make the decision process *fail*? (Too heavy → bypass; too opaque → no review; no human accountability → automation bias.) The framework inverts these failure modes.
- **Bounded Authority**: Delegating routine/reversible decisions to AI with audit + escalation; requiring human final decision for material/irreversible ones.

## Alternatives Considered

### Per-Alternative Constraint-Compliance Evaluation

|          | C-1 (back-compat) | C-2 (single source) | C-3 (no CoT) | C-4 (git-native) |
|----------|-------------------|---------------------|--------------|------------------|
| Alt 0    | ✅                | ❌                  | ✅           | ✅               |
| Alt 1    | ✅                | ✅                  | ✅           | ✅               |
| Alt 2    | ❌                | ✅                  | ✅           | ✅               |

### Alternative 0 — Do Nothing / Keep Current Approach

- **Summary:** Retain `@architect` as-is; continue relying on the agent prompt as the implicit decision process.
- **Pros:** Zero migration cost; no reference sweep.
- **Cons:** Architecture-bias discovery bug persists; process remains opaque; drift risk remains; no bounded-AI-authority model; no independent challenge path.
- **Constraint compliance:** Fails C-2 (the agent continues to bake in body structure, which can drift from the template).
- **Why rejected:** The domain bias and process opacity are the root problems; doing nothing leaves them in place.

### Alternative 1 — Rename + process-first guide + bounded AI authority + critic (chosen)

- **Summary:** Rename `@architect` → `@decision-advisor` (domain-neutral, all five types); extract the decision process into a public Decision-Making Guide (kernel D0–D14, rigor R0–R3 + emergency, DACI rights, AI-authority model); remove the agent's baked-in body structure (reference the template); add `@decision-critic` + `/review-decision`; integrate meeting decisions; defer heavy machinery (verifier/retro, schemas, catalogs, evidence-ledger YAML, forecasting).
- **Pros:** Fixes the discovery bug (domain-neutral name); makes the process public and reviewable; eliminates drift (single source of truth); right-sizes ceremony (proportional rigor); adds bounded AI authority (human accountability for R2/R3); adds independent challenge (critic); keeps v1 lean (deferred machinery).
- **Cons:** One-time reference sweep across ~16 live sources; new guide adds documentation surface area; same-model critic is only a first-pass check (documented limitation, not false assurance).
- **Constraint compliance:** Passes all constraints. C-1 satisfied via back-compat alias; C-2 satisfied by removing baked-in structure; C-3/C-4 inherently satisfied (plain Markdown/YAML, no runtime/secrets).
- **Why chosen:** Separates the three coupled concerns; fixes root causes not symptoms; right-sized for ADOS v1 without over-engineering.

### Alternative 2 — Split into per-domain agents (@architect-advisor, @product-advisor, @business-advisor, …)

- **Summary:** Instead of one domain-neutral agent, create specialized agents per decision type, each with deep domain context.
- **Pros:** Domain-specialized prompts; no ambiguity about which agent handles which type.
- **Cons:** Agent proliferation (5+ agents for one capability); shared process logic duplicated or extracted anyway; higher maintenance cost; harder to route (user must know which domain agent to call).
- **Constraint compliance:** Fails C-1 (breaking change — existing `@architect` callers would need to migrate to `@architect-advisor` or a routing layer, no clean alias).
- **Why rejected:** Type-aware context modes within one agent provide domain depth without agent proliferation; the domain is a *mode*, not a *separate agent*. Maximizes reuse (RD-1).

## Decision

**Adopt Alternative 1.** The decision-making subsystem is refactored as follows:

1. **One generalized orchestrator (RD-1, DEC-1):** `@architect` is renamed to `@decision-advisor` — domain-neutral, owns all five types (architecture, product, business, technical, operating). Domain depth comes from type-aware context modes, not separate agents.

2. **Agent rename (RD-2, RD-10, DEC-2, DEC-10):** `@architect` → `@decision-advisor`. Broadening-only (keeping the name) leaves the architecture-bias discovery bug intact.

3. **Remove baked-in body structure (RD-3, DEC-3):** The agent references the template for body section order; it does NOT bake in its own list. This eliminates the drift source (single source of truth = the template).

4. **Process-first guide (RD-4, DEC-4):** A new `doc/guides/decision-making.md` captures the decision process: decision kernel (D0–D14), rigor levels (R0–R3 + emergency overlay), four-axis classification, DACI decision rights, AI-authority model, per-type matrix, three decision modes. The records-management guide is demoted to a record-artifact reference.

5. **Consolidate into GH-46 (RD-5, DEC-5):** All decision-making work is consolidated into one change to avoid fragmenting a tightly-coupled capability.

6. **Dogfood (RD-6, DEC-6):** This very record (ADR-0001) is produced using the new process, validating it end-to-end on its own delivery.

7. **Universal kernel + R0–R3 + emergency overlay (RD-7, DEC-7):** The decision kernel (D0–D14) standardizes what happens in every decision; rigor levels (R0–R3) scale ceremony to context; the emergency overlay handles crisis-mode shortcuts.

8. **DACI decision rights (RD-8, DEC-8):** Decision rights (Driver, Decider, Contributors, Reviewers, Informed) are first-class in the record and the planning flow. This makes accountability explicit.

9. **Bounded AI authority (RD-9, DEC-9):** AI acts autonomously only within delegated/reversible/bounded R0–R1 decisions with audit + escalation. R2/R3 require a human final decision. A recommendation is NOT a decision.

10. **Agent name = `@decision-advisor` (RD-10, DEC-10):** Resolved — domain-neutral, describes the function (advising on decisions), not one domain.

11. **Lean `@decision-critic` + `/review-decision` (RD-11, DEC-11):** A read-only independent challenger returns PASS / PASS_WITH_RISKS / REWORK. It is an R3 governance primitive, not a full verification lifecycle.

12. **Meeting integration (RD-12, DEC-12):** `@meeting-organizer` routes durable meeting decisions into the workflow. Meeting discussion is evidence input to `/plan-decision`; durable decisions route to `/write-decision`.

13. **Defer heavy machinery (RD-13, DEC-13):** Verifier/retro commands, JSON schemas/validators, 18 per-domain catalogs, evidence-ledger YAML, forecasting, and `@decision-researcher` are deferred to a future Decision-Intelligence lifecycle ticket.

14. **Condensed guide, not 18 files (RD-14, DEC-14):** A condensed master driver checklist + per-type matrix live in the guide — not 18 catalog files. This keeps v1 maintainable and skimmable.

15. **OQ-A: proportional rendering (DEC-15):** One template, rendered proportionally by rigor (R0 = no record; R1 = strict proper subset; R2/R3 = full). No separate lite template.

16. **OQ-B: rename summary tag (DEC-16):** `<technical_decision_planning_summary>` → `<decision_planning_summary>` with a back-compat alias and `adr.*` field aliasing.

17. **Evidence discipline (RD-15, DEC-17):** v1 uses prose FACT/ASSUMPTION/UNKNOWN/TO-CONFIRM labels + source references. Structured evidence-ledger YAML is deferred.

18. **Critic independence honesty (RD-16, DEC-18):** For a single-model configuration, `@decision-critic` is a first-pass check, NOT independent assurance. R3 ALWAYS requires a human reviewer regardless of the critic's verdict. Where a different model family is configured, assigning it to the critic is recommended (not mandated).

### Constraint Compliance Attestation

The chosen alternative satisfies all constraints C-1 through C-4:

- **C-1 (back-compat):** The legacy `<technical_decision_planning_summary>` tag and `adr.*` fields are accepted via alias with zero behavior change (NFR-2).
- **C-2 (single source of truth):** The agent references the template; it does not bake in body structure (NFR-4). Exactly one structural definition exists.
- **C-3 (no CoT):** Records capture decision + rationale + assumptions only (NFR-6).
- **C-4 (git-native):** All artifacts are plain Markdown/YAML; no runtime/secrets/network calls (NFR-5).

## Trade-offs & Consequences

### Positive Outcomes

- Discovery is no longer domain-biased — any decision type has a clear entry point.
- The decision process is public, reviewable, and improvable.
- Single source of truth for body structure eliminates drift.
- Proportional rigor reduces ceremony overhead for routine decisions.
- Bounded AI authority keeps humans accountable for material decisions.
- Independent challenge is available for high-stakes decisions.
- v1 is lean and maintainable (heavy machinery deferred).

### Negative Outcomes

- One-time reference sweep cost (renamed agent across ~16 live sources).
- New guide adds documentation surface area to maintain.
- Same-model critic is only a first-pass check (documented limitation).
- Migration may require updating user habits (calling `@decision-advisor` instead of `@architect`).

### Unresolved Questions

- [ ] Should a future Decision-Intelligence lifecycle ticket add the deferred verifier/retro commands, schemas, catalogs, evidence-ledger YAML, and forecasting? (owner: future ticket)
- [ ] Should the critic be assigned a different model family by default where one is configured? (owner: config review)

## Implementation Plan

1. **Phase 1–2 (committed):** Create the guide; update the template; rename + rewrite the agent; create the critic agent.
2. **Phase 3 (committed):** Generalize the commands; add `/review-decision`.
3. **Phase 4 (committed):** Integrate meeting decisions.
4. **Phase 5 (committed):** Sweep all live `@architect` references; reconcile system specs.
5. **Phase 6 (committed):** Regenerate Claude plugin; apply license headers.
6. **Phase 7 (this record):** Dogfood ADR-0001.
7. **Phase 8:** Final consistency sweep + verification.

Rollout is via the standard ADOS delivery process (spec → plan → delivery → review → quality gates → PR). The reference sweep ensures no stale `@architect` references remain in live sources.

## Verification Criteria

- **Metric:** Stale `@architect` references in live sources — Target: 0 — Window: post-merge
- **Metric:** Structural definitions in `write-decision.md` — Target: 1 — Window: post-merge
- **Metric:** Decision types served by `@decision-advisor` — Target: 5 — Window: ongoing
- **Metric:** Proportional rendering levels defined — Target: 4 (R0–R3) — Window: post-merge
- **Metric:** This record exists and captures RD-1…RD-16 — Target: yes — Window: now

## Confidence Rating

**High.** The decisions are grounded in concrete defects (GH-60 drift, domain-bias discovery bug) and a research basis (AI-Driven Decision Intelligence Framework). The main uncertainty is adoption friction — mitigated by the condensed guide and proportional rigor.

## Lessons Learned (Retrospective)

TODO: Populate after implementation and observation.

## References

- **Change spec:** [doc/changes/2026-06/2026-06-24--GH-46--decision-making-framework/chg-GH-46-spec.md](../changes/2026-06/2026-06-24--GH-46--decision-making-framework/chg-GH-46-spec.md)
- **Decision-Making Guide:** [doc/guides/decision-making.md](../guides/decision-making.md)
- **Record-artifact guide:** [doc/guides/decision-records-management.md](../guides/decision-records-management.md)
- **Template:** [doc/templates/decision-record-template.md](../templates/decision-record-template.md)
- **Prior change (GH-60):** Hard-constraint discipline; body-structure collision fix
- **Prior change (GH-52):** Extended decision records to PDR/BDR/TDR/ODR
- **Research basis:** `.ai/local/decision-process/` (AI-Driven Decision Intelligence Framework)
