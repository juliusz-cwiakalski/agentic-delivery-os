---
ados_distribution: project-generated
id: TDR-0010
decision_type: tdr
status: Proposed
created: 2026-11-07
decision_date: null
last_updated: 2026-11-07
summary: "Ratify the dispatch-session classification projection as a TDR-0005 addendum: the shared harness-neutral classifier projects its closed outcome vocabulary onto the existing eleven delivery-result tokens (finished, partial, partial, failed, noop-lane-permission, max-restarts); consumers are bound to read `outcome` beside any `partial` token and to read harness-path `noop-lane-permission` as spawn-refused, never as a lane-permission verdict."
owners:
  - "Juliusz Ćwiąkalski"
service: delivery-os harness adapters
decision_scope: repo
review_date: null
classification:
  domains: [tooling, architecture]
  archetype: design
  environment: complicated
  rigor: R2
  reversibility: easy
  stakes: medium
  urgency: medium
  uncertainty: low
  blast_radius: team
  recurrence: one-off
governance:
  driver: "@decision-advisor (routed from GH-233 review iteration 1, finding F-2)"
  decider: "Juliusz Ćwiąkalski (owner; acceptance pending at the GH-233 PR review)"
  contributors:
    - "@reviewer (GH-233 review iteration 1, finding F-2 — taxonomy-owner routing)"
    - "@spec-writer (chg-GH-233-spec DEC-10)"
    - "@test-plan-writer (chg-GH-233-test-plan §4.2 v1.2 binding oracle)"
  reviewers:
    - "@reviewer"
    - "Human owner (GH-233 PR review)"
  performers:
    - "@coder (GH-233 — projection delivered in packages/core)"
  informed:
    - "GH-236 (M1-S8 retro/spend consumers)"
    - "M1-S9 dual-run evaluators"
ai_assistance:
  used: true
  roles: [repository-analyst, analyst, record-writer]
  external_data_shared: false
  citations_verified: true
  human_decider: null
  reviewers: []
revisit_triggers:
  - "A consumer needs to distinguish `partial`-projected dispatch-session results by token alone (premature-end vs completed-with-tool-failure): that is the deferred per-outcome-distinct-tokens alternative and requires a taxonomy-owner change to TDR-0005's closed eleven-token set, never a classifier-local token."
  - "TDR-0005's taxonomy gains a dispatch-session completion token, a twelfth token, or a remapped derivation class: re-derive this projection and its two consumer rules in the same change."
  - "A consumer (for example retro/spend) acts on harness-path `noop-lane-permission` as a lane-permission policy verdict instead of spawn-refused: reopen with the taxonomy owner."
links:
  related_changes: ["GH-233"]
  supersedes: []
  superseded_by: []
  spec:
    - "doc/spec/features/feature-harness-adapters.md"
    - "doc/spec/features/feature-result-contract.md"
    - "doc/spec/features/feature-verify-change-and-exit-taxonomy.md"
  contracts:
    - "packages/core/src/contracts/harness.ts"
    - "packages/core/src/domain/harness-classify.ts"
    - "packages/core/src/contracts/delivery-result.ts"
  diagrams: []
  decisions: ["TDR-0005", "ADR-0008"]
  experiments: []
  metrics: []
  roadmap_items: ["M1-S11", "M1-S8"]
---

# TDR-0010: Dispatch-Session Classification Token Projection (TDR-0005 Addendum)

## Context

- **FACT:** TDR-0005 adopts the eleven-token delivery-result enum as the single typed CLI vocabulary with a total taxonomy: exactly one projection class and one derivation class per token, drawn from `verify | tracker-pr | dispatch-session` (`packages/core/src/contracts/delivery-result.ts`, `DELIVERY_RESULT_TAXONOMY`; TDR-0005 Decision 2).
- **FACT:** In that taxonomy the `dispatch-session` derivation class owns exactly three tokens — `max-restarts`, `noop-lane-permission`, `noop-lane-nothing-to-do` — none of which is a completion token. `finished`, `partial`, and `failed` are `verify`-class tokens.
- **FACT:** ADR-0008 (Accepted 2026-10-31) DC-2 makes classification part of the `HarnessSession` lifecycle: engines drive spawn, deliver, resume/steer, collect, classify through one uniform session surface and never branch on a runtime name.
- **FACT:** The harness adapter seam delivers one shared harness-neutral classifier. `HARNESS_OUTCOMES` declares the closed five-value outcome vocabulary (`completed`, `premature-end`, `failed`, `refused`, `timed-out`) and `HARNESS_CLASSIFICATION_TOKENS` declares the outcome-to-token projection once as `as const` data in the contracts tier (`packages/core/src/contracts/harness.ts`). The pure classifier (`packages/core/src/domain/harness-classify.ts`) imports the taxonomy, carries no token literal of its own, and resolves each projected token's derivation class from the taxonomy row. Evaluation order is structural: spawn refusal and timeout are terminal before any exit is read; a non-zero exit or reported failure is a failure; a completion marker separates completion (split by tool failure) from premature end.
- **FACT:** The declared projection maps `completed`→`finished`, `completed-with-tool-failure`→`partial`, `premature-end`→`partial`, `failed`→`failed`, `refused`→`noop-lane-permission`, `timed-out`→`max-restarts` (`HARNESS_CLASSIFICATION_TOKENS`). Test plan §4.2 (chg-GH-233-test-plan, v1.2) pins this six-row table as the binding expected-token oracle, and `feature-harness-adapters.md` §Classification records it as current spec.
- **FACT:** GH-233 review iteration 1, finding F-2 routed the projection to `@decision-advisor`: cross-derivation-class token reuse with collapsed meanings is a taxonomy-owner decision, not a delivery spelling. The PM recorded the routing ("TDR-0005 ratification of the outcome→token projection — taxonomy-owner decision per reviewer"); the test plan carries the pending-ratification note (§9 v1.2) and reflects delivered truth in the interim.
- **FACT:** The projection is lossy in exactly two ways, both already documented as current truth: (a) `premature-end` and `completed`-with-tool-failure both project `partial`, disambiguated only by the separate `outcome` field on `HarnessClassification`; (b) `noop-lane-permission` arriving from the harness path means the harness refused the spawn before a session existed — it is not a lane-permission policy verdict.

## Problem Framing (Clarified)

The `dispatch-session` derivation class declares no completion tokens of its own, yet a dispatch session completes, completes with a tool-level failure, ends prematurely, fails, refuses, or times out. The classifier must emit delivery-result tokens, so the decision is which existing taxonomy tokens the dispatch-session path reuses, and which binding disambiguation rules consumers need wherever the reused token's lane meaning does not fit the harness fact.

The failure mode to prevent: a consumer reading a projected token as its lane-specific meaning — treating harness-path `noop-lane-permission` as a lane-permission verdict (for example, retrying lane permission instead of the spawn), or treating a `partial` token as identifying one specific outcome. Retro/spend consumers (GH-236, M1-S8) and dual-run evaluators (M1-S9) are the blast radius.

**Mechanism:** TDR-0005's eleven-token set is the closed vocabulary; this record completes the dispatch-session class's projection onto that set as a separate addendum record linked back via `links.decisions` — it neither edits TDR-0005 nor supersedes it (the same separate-record pattern TDR-0007 used to complete ADR-0003 without rewriting accepted text).

## Constraints (Hard Requirements)

### C-1: Closed-vocabulary reuse only

- **Statement:** The projection emits only tokens from TDR-0005's closed eleven-token taxonomy; no new token, no twelfth token, no reordering, no second vocabulary.
- **Source:** prior decision (TDR-0005 C-2 totality)
- **Verification:** structure test (taxonomy equality) + code review
- **Negotiable:** no

### C-2: One declared projection, one classifier

- **Statement:** The outcome-to-token mapping is declared exactly once as `as const` data in the runtime-neutral contracts tier (`HARNESS_CLASSIFICATION_TOKENS`); the shared pure classifier carries no token literal and resolves the derivation class from the taxonomy row; adapters normalize evidence and never classify.
- **Source:** prior decision (TDR-0005 C-5 single-enum-home; ADR-0008 C-1, DC-2)
- **Verification:** `verify-imports`/dependency-cruiser boundaries + code review + TC-HARN-005/TC-HARN-028
- **Negotiable:** no

### C-3: Identical classification across harnesses

- **Statement:** The same neutral evidence yields the same `(outcome, token, derivationClass)` triple for every harness; classification is one shared pure function over the neutral evidence shape.
- **Source:** AC (GH-233 DEC-10, AC-F2-1, NFR-8); prior decision (ADR-0008 DC-2)
- **Verification:** test (TC-HARN-004/TC-HARN-005 conformance suite; TC-HARN-029 mutant control)
- **Negotiable:** no

### C-4: Lossy semantics carry binding consumer rules in a durable record

- **Statement:** The two lossy semantics are ratified with binding consumer rules in an owner-visible decision record: `outcome` is required reading beside any `partial`-projected dispatch-session result, and harness-path `noop-lane-permission` means spawn-refused.
- **Source:** review finding (GH-233 review iteration 1, F-2); AC (chg-GH-233-test-plan §4.2 binding oracle)
- **Verification:** audit (this record + `feature-harness-adapters.md` §Classification) + test (§4.2 oracle asserts outcome disambiguation)
- **Negotiable:** no

> **Table stakes:** the eleven-token set, each token's projection class and exit, and the result-contract envelope are unchanged (TDR-0005 scope); acknowledged once for all alternatives.

## Decision Drivers

1. **Closed-vocabulary integrity** — the taxonomy stays total and small; no token proliferation (TDR-0005 driver 3).
2. **Consumer correctness** — retro/spend (GH-236/M1-S8) and dual-run evaluators (M1-S9) must not misread projected tokens; the disambiguation rules travel with the ratification.
3. **Additive, data-declared change** — the projection is `as const` data plus recorded rules; reversal is a data edit, not a refactor (TDR-0005 driver 4).
4. **Deterministic classification** — same evidence, same triple, every harness (ADR-0008 DC-2).
5. **Owner visibility** — the lossy semantics are ratified where the taxonomy owner can accept, adjust, or veto them.

## Decision Rights (DACI)

- **Driver:** `@decision-advisor` (routed from GH-233 review iteration 1, finding F-2).
- **Decider / Approver:** Juliusz Ćwiąkalski — acceptance pending at the GH-233 PR review. The open PR is the human acceptance gate; the record remains `Proposed` until then and the AI does not accept it.
- **Contributors:** `@reviewer` (F-2 taxonomy-owner routing), `@spec-writer` (DEC-10), `@test-plan-writer` (§4.2 binding oracle).
- **Required reviewers:** `@reviewer`; the owner at GH-233 PR review.
- **Performers:** `@coder` — the projection is delivered in GH-233 (`packages/core`).
- **Informed:** GH-236 (M1-S8 retro/spend), M1-S9 dual-run evaluators.

## Evidence, Assumptions & Unknowns

| Item | Label | Source | Impact if false | Confidence |
|---|---|---|---|---|
| The dispatch-session derivation class owns only `max-restarts`, `noop-lane-permission`, `noop-lane-nothing-to-do`; none is a completion token. | FACT | `packages/core/src/contracts/delivery-result.ts` (`DELIVERY_RESULT_TAXONOMY`), read 2026-11-07 | A dispatch-session completion token would already exist and the projection would be unnecessary | High |
| `HARNESS_CLASSIFICATION_TOKENS` declares exactly the six-key projection cited above, `as const` in the contracts tier; the classifier holds no token literal. | FACT | `packages/core/src/contracts/harness.ts`; `packages/core/src/domain/harness-classify.ts`, read 2026-11-07 | The ratified table would diverge from delivered truth | High |
| Test plan §4.2 (v1.2) pins the six-row projection as the binding oracle, with the `outcome`-beside-`partial` and spawn-refused rules stated. | FACT | `chg-GH-233-test-plan.md` §4.2, §9 v1.2 | The ratification would bind a different table than the one tests enforce | High |
| `feature-harness-adapters.md` §Classification documents the same projection and both disambiguation rules as current spec. | FACT | `doc/spec/features/feature-harness-adapters.md`, read 2026-11-07 | Record and spec would disagree; doc-sync reconciliation gap | High |
| Review iteration 1 F-2 routed the projection as a taxonomy-owner decision (cross-derivation-class reuse with collapsed meanings). | FACT | `code-review/review-iter-1.yaml` F-2; `chg-GH-233-pm-notes.yaml` routing notes | The record would claim an owner question nobody routed | High |
| No current consumer requires token-level disambiguation of `partial`-projected dispatch-session results. | ASSUMPTION | F-2 analysis; M1-S8 design-stage | The deferred distinct-token alternative becomes live; revisit trigger fires | Medium |
| M1-S8 retro/spend will read `outcome` beside `partial` and treat harness-path `noop-lane-permission` as spawn-refused. | TO-CONFIRM | GH-236 design review | A misreading consumer surfaces as wrong spend/retro attribution; confirm at the GH-236 design review | Medium |

## Mental Models & Techniques Used

- **Single source of truth:** one taxonomy, one declared projection, one shared classifier; the bash-era enum stays the external reference (TDR-0005's model, extended to the dispatch-session path).
- **Inversion:** how would a consumer misread? A `partial` token without `outcome` (dead session vs flawed completion), and a lane-permission token read as a lane verdict on the harness path. The two binding rules invert precisely these failure modes.
- **Second-order thinking:** reusing lane tokens reassigns meaning on the harness path; the disambiguation rule must be ratified with the token, or each consumer re-derives it silently.
- **KISS / least vocabulary:** reuse a closed set before extending it; distinct tokens are bought only when a consumer proves it needs them.
- **Reversibility:** the projection is data; recording the deferred alternative as a revisit trigger keeps the escape hatch explicit.

## Alternatives Considered

### Per-Alternative Constraint-Compliance Evaluation

| | C-1 closed vocabulary | C-2 one declaration | C-3 identical classification | C-4 durable consumer rules | Eligibility |
|---|:---:|:---:|:---:|:---:|---|
| ALT-0 no ratification (delivery spelling only) | ✅ | ✅ | ✅ | ❌ | Not eligible |
| ALT-1 new dispatch-session token set | ❌ | ✅ | ✅ | ✅ | Not eligible |
| ALT-2 per-outcome distinct tokens | ❌ | ✅ | ✅ | ✅ | Not eligible (deferred to the taxonomy owner) |
| ALT-3 ratify the delivered projection with binding consumer rules (selected) | ✅ | ✅ | ✅ | ✅ | Eligible |

Legend: ✅ passes · ❌ fails.

### Alternative 0 — Do Nothing / Leave the Projection a Delivery Spelling

- **Eligibility:** Not eligible (fails C-4 — no durable, owner-visible consumer rules).
- **Summary:** The projection stays an unratified mapping in contracts data; consumers discover the lossy semantics by misreading them.
- **Constraint compliance:** Passes C-1…C-3 vacuously (the delivered code already complies); fails C-4.
- **Driver fit:** Worst — drivers 2 and 5 unserved.
- **Cons:** The exact ambiguity class F-2 flagged: retro/spend misreading `noop-lane-permission` as a lane verdict; token-only assertions over `partial`.
- **Why rejected:** F-2 routed it here precisely because a taxonomy-owner decision, not a delivery spelling, must own the collapsed meanings.

### Alternative 1 — New Dispatch-Session Token Set

- **Eligibility:** Not eligible (fails C-1, `negotiable: no`).
- **Summary:** Mint a parallel vocabulary for the dispatch-session class (for example dispatch-completion, dispatch-partial, spawn-refused tokens) and project onto it.
- **Constraint compliance:** Fails C-1 — a second vocabulary and new tokens against TDR-0005's closed eleven-token set; would also fork the dual-run comparison unit (token-level parity).
- **Driver fit:** Good on driver 2 in isolation; fails driver 1 outright.
- **Pros:** Lossless per-outcome naming; no reused lane meanings.
- **Cons:** Token proliferation versus TDR-0005's closed taxonomy; every consumer, evaluator, and the totality structure test must learn a second set.
- **Why rejected:** Token proliferation against a deliberate closed-vocabulary decision; the ambiguity is cheaper to bind by rule than to buy by vocabulary.

### Alternative 2 — Per-Outcome Distinct Tokens

- **Eligibility:** Not eligible today (fails C-1 — adds tokens to the closed set); **deferred to the taxonomy owner**, with the GH-233 PR review as the acceptance gate for the interim projection.
- **Summary:** Keep the reuse projection but extend the taxonomy with distinct tokens for the collapsed outcomes (a premature-end token, a completed-with-tool-failure token), removing both lossy semantics at the token level.
- **Constraint compliance:** Fails C-1 as stated (new tokens require reopening TDR-0005's closed set); passes C-2…C-4 in a future taxonomy.
- **Driver fit:** Best on driver 2 in the long run; worst on driver 3 now (taxonomy churn with no consumer yet demanding it).
- **Pros:** Token-level disambiguation; the `outcome`-beside-`partial` rule becomes unnecessary.
- **Cons:** Reopens a closed, structure-tested vocabulary while the assumption "no consumer needs token-level disambiguation" still holds.
- **Why deferred:** Extending the eleven-token set is a taxonomy-owner change; the revisit trigger records the exact condition under which it becomes live (a consumer that must distinguish `partial`-projected results by token alone), and the owner accepts or adjusts the interim projection at the GH-233 PR review.

### Alternative 3 — Ratify the Delivered Projection with Binding Consumer Rules (selected)

- **Eligibility:** Eligible (passes C-1…C-4).
- **Summary:** Ratify the six-row projection as the dispatch-session projection onto the existing taxonomy tokens, with the two consumer rules binding wherever projected tokens are consumed.
- **Constraint compliance:** Existing tokens only (C-1); one `as const` declaration and one shared pure classifier, already delivered (C-2, C-3); the lossy semantics are owned by this record (C-4).
- **Driver fit:** Best — closed vocabulary intact (driver 1), consumers bound (driver 2), additive data (driver 3), deterministic (driver 4), owner-ratified (driver 5).
- **Cons:** The token alone stays lossy for the dispatch-session path; the rules must be honored by every consumer.
- **Why chosen:** See Decision.

## Decision

- **Recommendation:** Alternative 3.
- **Authorized Decision:** pending — the owner ratifies or adjusts at the GH-233 PR review. Until then the record is `Proposed` and grants no authority; the delivered projection it ratifies remains binding test-oracle truth in the interim (chg-GH-233-test-plan §4.2). This record is a **TDR-0005 addendum**: it completes the `dispatch-session` derivation class's projection onto TDR-0005's closed taxonomy and binds consumers; it does not modify or supersede TDR-0005.

1. **Ratified projection.** The dispatch-session classification projection is the declared six-row mapping onto the existing delivery-result tokens: `completed`→`finished`, `completed-with-tool-failure`→`partial`, `premature-end`→`partial`, `failed`→`failed`, `refused`→`noop-lane-permission`, `timed-out`→`max-restarts` (`HARNESS_CLASSIFICATION_TOKENS`, `packages/core/src/contracts/harness.ts`). The declared mapping is the single projection; adapters normalize neutral evidence, the one shared classifier maps, and the derivation class is read from the taxonomy row.

2. **Binding consumer rule — `partial` requires `outcome`.** Results projecting `partial` are disambiguated only by the separate `outcome` field: `premature-end` and `completed`-with-tool-failure share the token and differ only by outcome. Retro/spend consumers (GH-236/M1-S8) and every other consumer MUST read `outcome` beside a `partial` token; a token-only assertion over `partial`-projected dispatch-session results is incomplete.

3. **Binding consumer rule — harness-path `noop-lane-permission` is spawn-refused.** `noop-lane-permission` arriving from the harness path means the harness refused the spawn before a session existed; it asserts no lane-permission policy verdict. Consumers MUST NOT treat it as one (for example, by retrying lane permission instead of the spawn).

4. **Lossy-token caveat.** The token alone is deliberately lossy for the dispatch-session path; rules 2 and 3 are part of the projection's contract, not consumer discretion. Distinct per-outcome tokens remain the deferred taxonomy-owner path (revisit trigger).

- **Decider:** Juliusz Ćwiąkalski (owner) — ratification at the GH-233 PR review; on acceptance, the record's status flips to `Accepted` with `decision_date` set and the ratification evidence recorded in an Acceptance section.
- **Conditions for revisit:** see `revisit_triggers`; the most important is a consumer that must distinguish `partial`-projected results by token alone.

### Constraint Compliance Attestation

The chosen alternative satisfies all constraints C-1 through C-4: it emits only existing taxonomy tokens (C-1); the projection is declared once as contracts data and mapped by the one shared pure classifier with no adapter-local classification (C-2); identical evidence yields identical classification triples across harnesses, bound by the conformance suite (C-3); and both lossy semantics carry binding consumer rules in this durable record (C-4). No accepted-risk exceptions are taken.

## Trade-offs & Consequences

### Positive Outcomes

- The closed eleven-token taxonomy survives a new derivation path without proliferation; dual-run token comparison stays meaningful.
- The two lossy semantics are owner-visible and binding rather than tribal knowledge; retro/spend consumers inherit explicit rules.
- The projection is data: reversal or remapping is a contracts-data edit plus a rule update, not a refactor.
- Adapters stay classification-free; a third harness inherits the projection by normalizing evidence.

### Negative Outcomes

- `partial`-projected dispatch-session results are ambiguous at the token level; consumers must read `outcome` (rule 2), and a consumer that forgets under-attributes.
- Harness-path `noop-lane-permission` reassigns a lane token's meaning; a consumer that ignores rule 3 misdiagnoses a spawn refusal as a permission verdict.
- Token-level disambiguation is deferred, so the lossiness is permanent until a revisit trigger fires.

### Unresolved Questions

- [ ] Confirm the GH-236 (M1-S8) retro/spend design reads `outcome` beside `partial` and treats harness-path `noop-lane-permission` as spawn-refused (owner: GH-236 design review).

## Implementation Plan

1. Delivered in GH-233: `HARNESS_CLASSIFICATION_TOKENS` (contracts tier), the shared classifier (`packages/core/src/domain/harness-classify.ts`), and the conformance suite pinning the §4.2 oracle (TC-HARN-004/005/010/011, TC-HARN-029 mutant control).
2. This record rides the GH-233 PR; the owner's PR-review acceptance flips status to `Accepted` with `decision_date` and an Acceptance section recording the evidence. No code or test change is implied by this record.
3. Consumers apply rules 2 and 3 at design time: retro/spend (GH-236) reads `outcome` beside `partial` and interprets harness-path `noop-lane-permission` as spawn-refused; M1-S9 evaluators compare `(outcome, token)` pairs, not tokens alone, for dispatch-session results.

## Verification Criteria

- Metric: projection keys outside the six declared rows / token values outside `DELIVERY_RESULT_TOKENS` — Target: 0 — Window: GH-233 structure tests and CI.
- Metric: token literals in the classifier or any adapter — Target: 0 — Window: TC-HARN-005/TC-HARN-028, dependency-cruiser.
- Metric: identical-classification failures across adapters — Target: 0 — Window: TC-HARN-004/TC-HARN-005 conformance suite.
- Metric: premature-end distinguished from completed-with-tool-failure by `outcome` alone (both `partial`) — Target: asserted in every run — Window: §4.2 premature-end rule.
- Metric: consumers honoring rules 2 and 3 — Target: GH-236 design review confirms — Window: M1-S8 design.

## Confidence Rating

**High.** All load-bearing evidence is repo-local and read directly (contracts data, the classifier, the taxonomy, the binding test oracle, the reconciled feature specs, and the routing record). The residual uncertainty — whether any consumer eventually demands token-level disambiguation — is bounded by an explicit revisit trigger and the deferred alternative, not by evidence.

## References

- [TDR-0005](TDR-0005-delivery-result-enum-and-cli-exit-taxonomy.md) — the amended record: the closed eleven-token taxonomy this projection draws on.
- [ADR-0008](ADR-0008-harness-adapter-contract.md) — the harness adapter contract (Accepted): classification as part of the `HarnessSession` lifecycle.
- [GH-233 specification](../changes/2026-11/2026-11-06--GH-233--harness-adapters/chg-GH-233-spec.md) — F-2, DEC-10.
- [GH-233 test plan](../changes/2026-11/2026-11-06--GH-233--harness-adapters/chg-GH-233-test-plan.md) — §4.2 binding projection oracle; §9 v1.2 pending-ratification note.
- [GH-233 review iteration 1](../changes/2026-11/2026-11-06--GH-233--harness-adapters/code-review/review-iter-1.yaml) — finding F-2 (taxonomy-owner routing).
- [Harness adapters feature spec](../spec/features/feature-harness-adapters.md) — §Classification (current projection and both disambiguation rules).
- [Result contract](../spec/features/feature-result-contract.md); [verify-change and exit taxonomy](../spec/features/feature-verify-change-and-exit-taxonomy.md) — reconciled current truth.
- `packages/core/src/contracts/harness.ts` (`HARNESS_OUTCOMES`, `HARNESS_CLASSIFICATION_TOKENS`); `packages/core/src/domain/harness-classify.ts` (the shared classifier); `packages/core/src/contracts/delivery-result.ts` (`DELIVERY_RESULT_TAXONOMY`) — machine sources.
- [TDR-0007](TDR-0007-license-gate-compound-spdx-expression-evaluation.md) — separate-record-completes-earlier-record precedent.
