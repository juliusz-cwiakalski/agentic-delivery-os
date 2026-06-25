---
# Copyright (c) 2025-2026 Juliusz Ćwiąkalski (https://www.cwiakalski.com | https://www.linkedin.com/in/juliusz-cwiakalski/ | https://x.com/cwiakalski)
# MIT License - see LICENSE file for full terms
source: https://github.com/juliusz-cwiakalski/agentic-delivery-os/blob/main/doc/decisions/PDR-0001-decision-record-validator-scope.md
id: PDR-0001
decision_type: pdr
status: Proposed
created: 2026-06-25
decision_date: null
last_updated: 2026-06-25
summary: "Scope of GH-63's §28.3 validator negative cases: enforce cases expressible against landed artifacts now; defer body-content/not-yet-landed-field cases to sibling tickets."
owners:
  - "@cwiakalski"
service: delivery-os
decision_area: product
decision_scope: repo
reversibility: moderate
review_date: null
classification:
  domains: [product, operations]
  archetype: policy
  environment: complicated
  rigor: R3
  reversibility: moderate
  stakes: medium
  urgency: medium
  uncertainty: low
  blast_radius: repo
  recurrence: one-off
governance:
  driver: "@decision-advisor"
  decider: null
  contributors:
    - "@pm"
    - "@red-team-coordinator"
  reviewers:
    - "@cwiakalski"
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
  reviewers:
    - "@cwiakalski"
revisit_triggers:
  - "A sibling ticket (GH-64/GH-65) lands the deferred machinery"
  - "The ticket owner rejects this scope interpretation at PR review"
links:
  related_changes: ["GH-63"]
  supersedes: []
  superseded_by: []
  spec: ["doc/changes/2026-06/2026-06-25--GH-63--machine-enforceable-decision-records/chg-GH-63-spec.md"]
  contracts: []
  diagrams: []
  decisions: ["ADR-0001"]
  experiments: []
  metrics: []
  roadmap_items: []
---

# PDR-0001: Decision-Record Validator Negative-Case Scope (GH-63 §28.3)

## Context

GH-46 (PR #62) established the decision-record quality invariants — single source of truth for body structure, rigor-aware required fields, lifecycle validity, constraint/driver discipline — but left them **prompt-enforced and grep-verified**, not machine-enforceable. GH-63 closes that gap: JSON Schemas for the landed nested front matter, a stdlib-only `validate-decision-record` CLI, a deterministic index generator, a read-only `/decision-index` command, and a CI gate that blocks drift at PR time.

The validator's mandate comes from the local research basis (§28.3), which enumerates **14 negative cases** a sound decision-record validator should "fail with an actionable error." GH-63's acceptance criterion (AC-GH63-5/7) says the validator must "fail **each** negative case from §28.3." However, the same ticket's **non-goals** explicitly exclude the machinery that 4 of those 14 cases require:

- an evidence ledger + R3 source verification (NG-2 → GH-65),
- a verification & retrospective lifecycle with body-content recommendation/decision separation (NG-3 → GH-64),
- immutable-rationale snapshot/diff machinery (→ GH-64), and
- a waiver/expiry front-matter field that does not yet exist (NG-6 → likely GH-65).

A red-team review of the GH-63 spec challenged the literal "each case" reading against these non-goals. The PM had pre-committed to formalizing the resulting scope interpretation as a Product Decision Record if it was challenged. This is that record.

> **FACT:** §28.3 enumerates exactly 14 negative cases (verified verbatim in the spec's Appendix A).
> **FACT:** 4 of those 14 require machinery listed as GH-63 non-goals (NG-2, NG-3, NG-6) / out-of-scope.
> **ASSUMPTION:** the AC's "each" was written against the full §28.3 research vision, not against GH-63's deliberately narrower landing scope.

## Problem Framing (Clarified)

The literal AC ("fail **each** negative case from §28.3") is in **direct tension** with the ticket's own non-goals. A validator cannot fail a negative case whose backing field or machinery does not yet exist without doing one of two dishonest things:

1. **Invent scope** — build the evidence ledger, verifier/retro agents, immutable-rationale diff, and waiver field *inside* a ticket that explicitly defers them; or
2. **Ship fake enforcement** — emit a check that pretends to detect a condition it cannot actually observe, giving reviewers false assurance.

The root cause is a **scope-boundary mismatch**: the AC was phrased against the complete research vision, while the ticket's scope deliberately lands only the foundation the deferred siblings will build on. The decision is how to reconcile "each case" with the non-goals *without* sacrificing honesty.

The reframe: the validator must enforce **every §28.3 case that is expressible against landed artifacts today**, and the remainder must be **visibly and accountably deferred** — never silently dropped and never faked.

## Constraints (Hard Requirements)

### C-1: Backward compatibility

- **Statement:** The validator must not reject landed records; ADR-0001, the template, and un-classified records remain valid (additive only; default rigor R2 when `classification` is absent).
- **Source:** internal standard (GH-63 NFR-2, DM-4) and prior decision (ADR-0001 C-1).
- **Verification:** test (ADR-0001 + template are positive fixtures; AC-GH63-1/AC-GH63-4).
- **Negotiable:** no

### C-2: Git-native, no heavy runtime

- **Statement:** All artifacts are plain Markdown/YAML/JSON + a stdlib-only validator (bash + python3/jq). No proprietary runtime, no `jsonschema` pip dependency, no network call, no secret.
- **Source:** internal standard (GH-63 NFR-1, SD-4) and prior decision (ADR-0001 C-4).
- **Verification:** test (AC-GH63-8: 0 pip installs on stock CI `python3`).
- **Negotiable:** no

### C-3: Single source of truth for structure

- **Statement:** The decision-record template remains the one structural definition of the record body; the scope interpretation must not introduce a second body-structure encoding.
- **Source:** prior decision (ADR-0001 C-2; GH-63 NFR-4/NG-5).
- **Verification:** code review (grep for structural enumerations; count must remain 1).
- **Negotiable:** no

### C-4: Honor the ticket's non-goals

- **Statement:** GH-63 must not build the evidence ledger (NG-2), verifier/retrospective lifecycle agents (NG-3), or a waiver/expiry field (NG-6). A negative case is enforceable in this ticket **only if** its backing field/machinery already exists.
- **Source:** AC / non-goals (GH-63 NG-2, NG-3, NG-6).
- **Verification:** code review + spec audit (the four deferred cases map to owning siblings in Appendix A; AC-GH63-7).
- **Negotiable:** no

## Decision Drivers

**Product / integrity drivers:**
- **Honesty** — never claim enforcement that is not real. A fake check is worse than no check (false assurance, violates ADOS's stated heuristic-honesty discipline, GH-63 DEC-10/DEC-13).
- **Auditability** — deferred cases must be visibly tracked with an owning sibling, not silently dropped from the disposition.

**Forward-compatibility drivers:**
- **Forward-compat** — the schema/validator must be reusable by the deferred siblings (GH-64/GH-65/GH-66); the split must not bake in assumptions that block them.

**Delivery drivers:**
- **AC-testability** — the scope interpretation must yield acceptance criteria that are demonstrably pass/fail, not aspirational.

## Mental Models & Techniques Used

- **First Principles:** what does "fail a negative case" irreducibly require? Answer: a field or artifact the validator can observe. If the backing field does not exist, the case is not yet *fail-able* — it is *not-yet-built*.
- **Inversion:** what would make this scope decision *fail*? Shipping enforcement for cases it cannot observe (fake assurance). The split inverts that failure mode by deferring exactly those cases.
- **Honesty / Dogfooding:** GH-63 already commits to labeling heuristics as heuristics (DEC-10/DEC-13). This PDR extends the same honesty principle from *heuristics* to *scope*: distinguish "enforced," "best-effort," and "deferred" explicitly.
- **Opportunity Cost:** enforcing all 14 now forces coupling 4 sibling tickets into GH-63 and expanding scope past its non-goals. Deferring preserves the foundation without the coupling.

## Alternatives Considered

### Per-Alternative Constraint-Compliance Evaluation

|          | C-1 (back-compat) | C-2 (git-native) | C-3 (single SoT) | C-4 (honor non-goals) |
|----------|-------------------|------------------|------------------|-----------------------|
| Alt 0    | ✅                | ✅               | ✅               | ❌                     |
| Alt 1    | ✅                | ✅               | ✅               | ✅                     |
| Alt 2    | ✅                | ⚠️               | ✅               | ❌                     |

Legend: ✅ = passes · ❌ = fails · ⚠️ = passes only via added surface (not a violation here, but a cost)

### Alternative 0 — Literal AC ("each" = all 14 cases)

- **Summary:** Take the AC at its literal word: the validator must fail all 14 §28.3 cases.
- **Pros:** Maximally literal reading of the AC; no judgment call visible to a reader.
- **Cons:** To actually fail the 4 sibling-owned cases, the implementer must either *invent scope* (build the evidence ledger + verifier/retro agents + waiver field inside GH-63) or *fake enforcement* (emit checks that cannot observe their target). Both are dishonest; the former also couples 4 tickets.
- **Constraint compliance:** Fails C-4 — both branches require building machinery that NG-2/NG-3/NG-6 explicitly exclude.
- **Why rejected:** Violates a non-negotiable constraint (C-4); the fake-enforcement branch additionally fails the honesty driver. No score rescues an ineligible option.

### Alternative 1 — Split: enforce landed-artifact cases, defer the rest with documented ownership (chosen)

- **Summary:** Enforce the **10 in-scope cases** (8 hard-fail + 1 best-effort + 1 heuristic) expressible against landed artifacts, and **defer** the 4 sibling-owned cases with rationale + owning ticket recorded in the spec's Appendix A. The validator documents the split; CI gates the in-scope cases.
- **Pros:** Honest — every enforced case is genuinely observable; every unenforced case is visibly accounted for. Reuses the landed schema as the foundation the siblings extend (forward-compat). Yields demonstrably testable ACs. Honors the ticket's non-goals.
- **Cons:** A literal-AC reader may perceive under-delivery ("you said *each*"). Mitigated by this PDR + Appendix A's disposition table, both of which reframe "each" as "each case expressible against landed artifacts."
- **Constraint compliance:** Passes all four constraints (C-1 additive; C-2 stdlib; C-3 leaves the template as SoT; C-4 defers exactly the four cases needing non-goal machinery).
- **Why chosen:** The sole constraint-eligible option, and the strongest on the honesty/auditability/forward-compat drivers.

### Alternative 2 — Expand GH-63 to land all 14 (build the deferred machinery now)

- **Summary:** Broaden GH-63's scope to include the evidence ledger, verifier/retro agents, immutable-rationale snapshot/diff, and waiver/expiry field, so all 14 cases fail for real.
- **Pros:** Maximally complete in one ticket; no deferral bookkeeping.
- **Cons:** Directly violates the ticket's non-goals; couples GH-63 with GH-64 and GH-65 into a single mega-change; blows the "avoid a heavy runtime / lean foundation" framing; dramatically raises review risk and delivery latency for a foundation whose value is mostly in being landed *first*.
- **Constraint compliance:** Fails C-4 (builds NG-2/NG-3/NG-6 machinery); C-2 at ⚠️ (the verifier/retro *agents/commands* add runtime surface, though still technically git-native).
- **Why rejected:** Violates C-4; trades a clean, landable foundation for scope creep that the sibling tickets already own.

## Decision

**Adopt Alternative 1.** The GH-63 validator enforces the **10 in-scope §28.3 negative cases** and **defers** the 4 sibling-owned cases with documented ownership:

**In-scope (10) — enforced now:**
- *Hard-fail (8):* invalid `decision_type`; invalid `status`; impossible lifecycle transition incl. `supersedes`/`superseded_by` inconsistency; missing `owners`; missing `governance.decider` for Accepted R2/R3; missing `decision_date` for Accepted; Accepted R3 without `governance.reviewers` (acceptance-gated, DEC-12); same factor as both constraint and driver.
- *Best-effort (1):* non-negotiable-constraint violation in the chosen option (non-blocking warning, DEC-13).
- *Heuristic (1):* Accepted record without a non-empty `## Verification Criteria` (non-blocking warning, DEC-10/DEC-13).

**Deferred (4) — owned by siblings:**
- "recommendation copied into final decision without authority" → **GH-64** (body-content recommendation/decision separation).
- "R3 without evidence verification" → **GH-65** (structured evidence ledger + source verification).
- "expired waiver" → **future waiver/expiry field** (likely **GH-65**; no field landed yet — NG-6).
- "modification of immutable accepted rationale without supersession" → **GH-64** (needs snapshot/diff machinery).

The split is encoded in the spec as scope decision **SD-2** and the Appendix A disposition table; the four deferred cases each carry rationale + owning sibling, satisfying AC-GH63-7. This interpretation redefines the AC's "each negative case" as "each negative case **expressible against landed artifacts**," which is the only reading consistent with the ticket's own non-goals.

**R3 independent challenge:** a red-team review independently challenged the literal "each case" reading against the non-goals; this record is the formalized response. `/review-decision` (`@decision-critic`) remains available for a second pass. A human final decision is required (R3) — the decider is the GH-63 ticket owner / PR reviewer.

### Constraint Compliance Attestation

The chosen alternative satisfies **all** constraints C-1 through C-4 (full compliance, no accepted-risk exceptions):

- **C-1 (back-compat):** Enforcement is additive; ADR-0001, the template, and un-classified records remain valid (default rigor R2).
- **C-2 (git-native):** Stdlib-only validator; no `jsonschema` dependency, no network, no secrets (AC-GH63-8).
- **C-3 (single SoT):** The split touches scope/semantics, not body structure; the template remains the sole structural definition.
- **C-4 (honor non-goals):** GH-63 builds none of the evidence ledger, verifier/retro agents, or waiver field; the four cases needing that machinery are deferred to their owning siblings.

## Trade-offs & Consequences

### Positive Outcomes

- **Honest:** every enforced case is genuinely observable; the disposition never claims enforcement it does not have.
- **Testable:** the 10 in-scope cases each have a failing fixture + test case (AC-GH63-5); the split yields clean pass/fail ACs.
- **Accountable:** the 4 deferred cases are visibly tracked with owning siblings in Appendix A (AC-GH63-7), not silently dropped.
- **Forward-compatible:** the landed schema/validator/index are the clean foundation GH-64/GH-65/GH-66 extend; no coupling baked in.

### Negative Outcomes

- A literal-AC reader may perceive **under-delivery** ("you said *each*"). Mitigated by this PDR + Appendix A, which reframe "each" explicitly.
- Best-effort and heuristic checks (the non-negotiable-violation and verification-criteria cases) are **non-blocking warnings**, documented as not structural guarantees (RSK-6) — a conscious honesty trade, not a defect.

### Unresolved Questions

- [ ] Does the GH-63 ticket owner / PR reviewer accept this scope interpretation? (owner: @cwiakalski — the R3 human decider)

## Implementation Plan

This is a **scope-interpretation** decision, not a build plan — the implementation is the GH-63 delivery already underway. The decision's execution obligations are:

1. **Encode the split** in the spec as SD-2 + Appendix A (done in the GH-63 spec).
2. **Implement** the 10 in-scope cases in `tools/validate-decision-record` with actionable errors (AC-GH63-5/6); best-effort/heuristic checks emit non-blocking warnings (DEC-13).
3. **Document** each deferred case with rationale + owning sibling (AC-GH63-7).
4. **Gate** the in-scope cases in CI (AC-GH63-12/13).
5. **Hand off** the four deferred cases to GH-64/GH-65 via their owning non-goal references (NG-2/NG-3/NG-6).

Rollout is via the standard ADOS delivery process. The decision is revisited if a sibling lands the deferred machinery (revisit trigger) or the ticket owner rejects the interpretation at PR review.

## Verification Criteria

- **Metric:** In-scope §28.3 cases with a failing fixture + test case — Target: 10 (8 hard-fail + 1 best-effort + 1 heuristic) — Window: GH-63 delivery (AC-GH63-5/6).
- **Metric:** Deferred §28.3 cases naming an owning sibling in Appendix A — Target: 4/4 — Window: now (AC-GH63-7).
- **Metric:** CI gate enforcing the in-scope cases on PRs touching `doc/decisions/` or `schemas/` — Target: yes (new job alongside `verify-claude-build`) — Window: post-merge (AC-GH63-12).

## Confidence Rating

**High.** The split is grounded in verifiable facts (the 14-case enumeration, the ticket's explicit non-goals NG-2/NG-3/NG-6) and is the only reading that satisfies every hard constraint. The residual uncertainty is purely governance: whether the human decider (ticket owner) accepts the reframing of "each" — which is why the record is `Proposed` pending that decision.

## Lessons Learned (Retrospective)

TODO: Populate after the GH-63 PR review confirms or revises the interpretation.

## References

- **GH-63 change spec (authoritative scope + Appendix A disposition):** [doc/changes/2026-06/2026-06-25--GH-63--machine-enforceable-decision-records/chg-GH-63-spec.md](../changes/2026-06/2026-06-25--GH-63--machine-enforceable-decision-records/chg-GH-63-spec.md) — §4.2 Non-Goals, §7.3 Deferred, §15 SD-2, §17 AC-GH63-5/6/7/12, Appendix A.
- **Research basis:** `.ai/local/decision-process/ados-ai-driven-decision-intelligence-framework-spec.md` §28.3 (the 14 negative cases; git-ignored, referenced per spec §12 assumptions).
- **Sibling tickets:** GH-64 (decision verification & retrospective lifecycle — owns rec/decision separation + immutable-rationale diff); GH-65 (structured evidence ledger + R3 source verification — owns evidence verification and likely the waiver/expiry field).
- **Prior decision:** [ADR-0001](ADR-0001-decision-making-framework.md) — decision-making framework (C-1/C-4 lineage; deferral discipline).
- **Dogfooding note:** This record is written to conform to the structure GH-63's schema/validator will enforce. **Formal machine-validation of this record occurs once GH-63's validator lands** (pre-landing, correctness rests on this record matching the ADR-0001 + template fixtures, which the schema is derived from per SD-1).
