---
id: PDR-0002
decision_type: pdr
status: Proposed
created: 2026-07-02
decision_date: null
last_updated: 2026-07-04
summary: "At phase 7 (`system_spec_update`), `@doc-syncer` must reconcile affected current-truth docs and close documentation gaps in-change (including first-authoring missing feature specs when warranted). Documentation coverage gaps are resolved as doc artifacts, not tracker tickets."
owners:
  - "Juliusz Ćwiąkalski"
service: delivery-os
decision_area: product
decision_scope: repo
reversibility: moderate
review_date: null
business_impact: "None directly — shapes the reliability of the delivery system's own documentation feedback loop."
customer_impact: "Adopters get more reliable, up-to-date system documentation after each delivered change, with reduced documentation drift in both autonomous and interactive delivery."
classification:
  domains: [product, process, governance, operations]
  archetype: policy
  environment: complicated
  rigor: R2
  reversibility: moderate
  stakes: medium
  urgency: medium
  uncertainty: medium
  blast_radius: team
  recurrence: recurring
governance:
  driver: "@decision-advisor"
  decider: "Juliusz Ćwiąkalski (final acceptance rides the GH-108 PR review)"
  contributors:
    - "@pm (raised the two open questions + the recommended lean during clarify_scope)"
    - "@doc-syncer (phase-7 documentation reconciliation authority)"
  reviewers:
    - "Juliusz Ćwiąkalski (GH-108 PR)"
    - "@decision-critic (independent challenge, PM-run, optional)"
  performers:
    - "@coder (GH-108 delivery — encode always-resolve documentation gap closure in doc-syncer/lifecycle/pm)"
  informed:
    - "delivery agents"
    - "sibling change GH-111 implementer (operational-guides trigger may reuse phase-7 gap-closure policy)"
ai_assistance:
  used: true
  roles: [researcher, analyst, record-writer]
  external_data_shared: false
  citations_verified: true
  human_decider: null
  reviewers: []
revisit_triggers:
  - "Repeated low-quality phase-7 authored docs at PR review → tighten templates/guardrails or adjust authoring delegation."
  - "Current-truth doc scope changes materially (new top-level documentation areas) → reconcile phase-7 reconciliation scope."
  - "Documentation governance policy changes (e.g., ticket-based doc debt process) → reassess no-ticket handoff rule for coverage gaps."
links:
  related_changes: ["GH-108"]
  spec: ["doc/spec/features/feature-delivery-lifecycle.md"]
  decisions: []
---

# PDR-0002: Phase-7 Documentation Gap Closure (Always Resolve In-Change)

## Context

GH-108 identified documentation drift during delivery. In the original problem framing, a long autonomous run produced **zero feature specs** for modified feature areas: phase 7 (`system_spec_update`) could surface `spec_coverage_gaps`, but the handoff path did not reliably close them.

The decision evolved during PR #122 review:

- **Initial recommendation (superseded):** add a `delivery_mode` signal and resolve missing feature specs only in autonomous mode, preserving report-only behavior for interactive runs.
- **Owner review correction:** phase 7's purpose is not to report missing documentation; it is to keep the current system documentation complete and up to date. Missing documentation should be created/updated **always**, with no human mid-flight decision and no follow-up tracker ticket.
- **Scope correction:** the issue is broader than `doc/spec/features/**`. `@doc-syncer` must reconcile any affected current-truth documentation area, using relevant templates before creating or materially changing documents.

This record preserves that evolution because it explains why the file is still named from the original mode-aware proposal while the final decision is mode-independent and broader than feature specs.

## Problem Framing

- **FACT:** `@doc-syncer` owns phase-7 documentation reconciliation and may write current-truth documentation under its allowlisted `doc/**` areas.
- **FACT:** Documentation gaps may be either stale existing docs or missing docs for enduring capabilities, contracts, processes, quality concerns, operational behavior, domain concepts, diagrams, or guides.
- **FACT:** Feature-spec first-authoring is one specific documentation gap: if a modified, coherent feature area warrants `doc/spec/features/feature-<slug>.md` and none exists, phase 7 must create it.
- **FACT:** Tracker-ticket creation remains governed separately: PM must not create new tracker tickets autonomously. Documentation coverage is closed as a doc artifact, not by creating a ticket.
- **ASSUMPTION:** PR review remains the human quality gate for docs authored during delivery.

## Decision

At phase 7 (`system_spec_update`), ADOS uses an **always-resolve** policy for documentation gaps:

1. `@doc-syncer` reconciles affected current-truth docs in scope (`doc/00-index.md`, `doc/guides/**`, `doc/overview/**`, `doc/spec/**`, `doc/contracts/**`, `doc/domain/**`, `doc/quality/**`, `doc/ops/**`, `doc/diagrams/**`, `doc/decisions/**`).
2. Detected documentation gaps are resolved in the same change (update existing docs or create missing docs where enduring behavior/concepts require them).
3. Feature-spec first-authoring is required when warranted and missing; existing specs are reconciled.
4. Documentation coverage handoff does **not** produce tracker tickets.
5. PM DoD requires no unresolved documentation gaps.

## Constraints

- **C-1 — No autonomous tracker-ticket creation:** documentation coverage gaps must not be resolved by auto-creating tracker tickets.
- **C-2 — In-change closure:** actionable documentation gaps discovered during phase 7 must be closed in the same change. If authoritative information is missing, the residual gap must be reported and DoD must not pass until resolved or explicitly human-waived.
- **C-3 — Broad current-truth scope:** phase 7 must consider all affected current-truth documentation areas, not only feature specs.
- **C-4 — Template discipline:** before creating or materially updating a doc, `@doc-syncer` must inspect the relevant `doc/templates/**` template or nearest existing document pattern.

## Alternatives Considered

### Option A — Report-only handoff (rejected)

- Detect and report gaps, then rely on follow-up workflow.
- Rejected because this permits documentation drift in practice.

### Option B — Mode-aware feature-spec resolution (superseded)

- Add `delivery_mode` and author missing feature specs only for autonomous runs; leave interactive runs report-only.
- This was the initial recommendation because it targeted the autonomous-run failure mode while preserving the prior interactive de-noise design.
- Superseded by owner review: phase 7 should close documentation gaps in all delivery modes; `@doc-syncer` should not branch on delivery mode for this responsibility.

### Option C — Always-resolve feature-spec gaps only (superseded)

- Always author the missing first feature spec when a modified feature area lacks one.
- This satisfies the original GH-108 feature-spec symptom but is too narrow: PR review clarified that `@doc-syncer` must reconcile and fill gaps across affected current-truth docs.

### Option D — Always-resolve current-truth documentation gaps (chosen)

- Detect and close documentation gaps during phase 7.
- Covers both existing-doc reconciliation and missing-doc creation across the phase-7 doc scope.
- Chosen for deterministic documentation freshness, lower drift risk, and alignment with `@doc-syncer`'s role.

### Option E — Auto-create follow-up tracker tickets (rejected)

- Create a tracker ticket when documentation coverage is missing.
- Rejected because it violates the governance rule against autonomous ticket creation and defers a phase-7 responsibility instead of completing it.

## Drivers

- Keep system documentation current after every delivered change.
- Reduce silent documentation drift.
- Preserve governance: documentation closure happens in docs, not ticket auto-creation.
- Keep agent prompts lean: role prompts should describe current responsibilities, not historical implementation debates.
- Keep phase 7 domain-neutral across documentation types, with feature specs as one concrete gap type.

## Consequences

### Positive

- Documentation completeness is enforced in delivery, not deferred.
- Reduced backlog noise from documentation follow-up tickets.
- Stronger DoD posture: phase-7 output is verifiable.
- `@pm` acts as a second line of defense by re-running `@doc-syncer` if residual or missed documentation gaps remain.

### Trade-offs

- Slightly higher phase-7 execution scope.
- Quality of authored docs must still be verified at review.
- Broad scope requires good template routing and concise doc-syncer reporting to avoid over-editing unrelated docs.

## Decision Outcome / Current State

- `.opencode/agent/doc-syncer.md` describes broad current-truth documentation reconciliation and in-change gap closure; it does not use `delivery_mode` for this responsibility.
- `.opencode/agent/pm.md` makes documentation completeness part of PM orchestration and DoD; PM reopens `system_spec_update` when docs remain incomplete.
- `doc/guides/change-lifecycle.md` phase 7 states that affected current-truth docs are reconciled and documentation gaps are resolved in-change.
- `doc/spec/features/feature-delivery-lifecycle.md` describes phase-7 documentation gap closure broadly, with feature-spec first-authoring as one gap type.
- The record remains `Proposed` until the GH-108 PR is accepted.

## Verification Criteria

- Phase 7 output includes updated/created docs for all detected actionable gaps.
- `doc/guides/change-lifecycle.md` and `doc/spec/features/feature-delivery-lifecycle.md` reflect always-resolve phase-7 behavior.
- PM DoD includes documentation completeness and re-open of phase 7 if gaps remain.
- No tracker ticket is generated for documentation coverage handoff.
- `@doc-syncer` prompt contains no delivery-mode gate for documentation gap closure.

## References

- Change: GH-108
- PR: #122
- Original record evolution: created as mode-aware spec-coverage resolution, amended during PR #122 to always-resolve, then generalized from feature specs to affected current-truth documentation.
- Authority:
  - `.opencode/agent/doc-syncer.md`
  - `.opencode/agent/pm.md`
  - `doc/guides/change-lifecycle.md`
  - `doc/spec/features/feature-delivery-lifecycle.md`
