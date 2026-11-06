# Readiness Review Iteration 1

Verdict: NOT_READY
Work Item: GH-232
Date: 2026-11-06
Pause Required: no

## Facet Summary
- spec_completeness: PASS
- ac_quality: PASS
- plan_coverage: FAIL
- test_traceability: PASS
- cross_artifact_consistency: FAIL
- decision_capture: PASS
- system_spec_consistency: PASS
- plan_doc_update_coverage: PASS
- plan_code_area_coverage: PASS
- dod_defined: PASS

## Findings

1. [major] cross_artifact_consistency — chg-GH-232-spec.md#G-5 / F-6 check (5) / AC-F6-1 vs chg-GH-232-plan.yaml#PIN-5 (and plan-end note "PIN-5 no-eligible-target semantics")
   Gap: The no-eligible-target path (every completed change already collected — reachable in any real workspace) has an unpinned oracle in spec and test plan, and the plan's pin contradicts the spec's unconditional wording. Spec G-5 and F-6(5) say "zero-collector runs flagged" with no carve-out; AC-F6-1 says "a collection that ran zero collectors … fails classified `retro.truth.vacuous-run` (exit 1)". Plan PIN-5 pins the opposite exit for a reachable zero-collector invocation: "no eligible target -> explicit no-target SUCCESS (exit 0)", scoping C-05 to "a target WAS selected" — a precondition that exists only in the plan, not in the spec. The test plan does not resolve the fork: §4.7 C-05's fixture presupposes a target, §4.8 has no no-target row, and TC-RETRO-015 step 4 requires only "an explicit no-target outcome (never a fabricated scope)" without identity or exit. This is exactly the class of unpinned-oracle gap that the iteration-2 reopen closed for GAP-T5; left open it will surface as a delivery-phase collision (TC-015/TC-045 oracle authoring) or a phase-8 review failure on a literal AC-F6-1 reading.
   Suggested remediation target phase: specification
   Suggested fix: Surgical spec amendment (F-1 or F-6, G-5, AC-F6-1, and ideally a §4.8-mirror row): pin the no-eligible-target outcome — explicit no-target evidence naming the empty selection, classified identity and exit — and scope C-05/vacuous-run to a run where a target scope was selected and zero collectors executed. Then mirror the pinned identity/exit in the test plan (§4.7 or §4.8 row + TC-RETRO-015 step 4). Alternative acceptable closure: keep PIN-5's semantics but record the C-05 precondition in the spec's own words, so the plan's carve-out is spec-grounded rather than plan-invented.

2. [minor] cross_artifact_consistency — chg-GH-232-spec.md#§7.1/§16 (registry record-kind enumeration) + chg-GH-232-test-plan.md#A-T5 vs chg-GH-232-plan.yaml#PIN-4
   Gap: The spec enumerates exactly two retro-registry record kinds ("level entries …, run records" in §7.1; "additive validated record kinds (level entries, run records)" in §16), and test-plan assumption A-T5 says "two record kinds (level and run)". But F-9/AC-F9-1 require the periodic memory-audit trigger to be "a registered trigger with a declared cadence" — which is neither a level nor a run record — and the plan honestly fills the hole with a third kind (`retro.trigger`, PIN-4), self-flagging the delta. The spec's data model under-enumerates what its own F-9 demands; A-T5 was not updated.
   Suggested remediation target phase: specification
   Suggested fix: One-line spec amendment in §7.1/§16 (and optionally a DM note) naming the third additive kind (trigger entries) that hosts the memory-audit trigger per DEC-10; update A-T5's "two record kinds" to match. No test oracle changes — TC-RETRO-057/060 already assert boundary properties and the trigger's registry presence, not a kind count.

3. [minor] decision_capture — doc/decisions/TDR-0009-retro-evidence-sidecar-keyed-chain-construction.md#Implementation Plan item 5
   Gap: The TDR (authored before the spec-v1.1 amendment) still says "error-table sync for the three `retro` rows"; every delivery-authoritative artifact (spec DEC-11/DM-8/NFR-8, test plan TC-RETRO-004/005, plan task 1.2) pins exactly four rows including `retro.truth.vacuous-run`. The TDR is Proposed with human acceptance reserved at PR review (by design, not a DoR gap), but its stale row count is the one place a reader could re-import the pre-amendment state.
   Suggested remediation target phase: specification
   Suggested fix: Amend TDR-0009 item 5 (via @decision-advisor, one word: "three" → "four", optionally noting DEC-11's iteration-2 amendment) or add a dated note that DEC-11 supersedes the row count named there. Spec/plan/test plan stay the delivery truth; no behavioral change.

4. [nit] cross_artifact_consistency — chg-GH-232-plan.yaml#PIN-10 vs doc/planning/oss-tooling/milestones/m1/commands/retro.md#OUTPUT example
   Gap: The command pack's illustrative example uses finding kind `"win"` and follow-through verdict `"done"`; neither is representable under PIN-10's closed vocabularies (finding kinds ["retro-note","collector-finding","truth-check","tamper-flag","malformed-entry","verified-empty"]; verdicts ["verified","unverified","unknown"]). The divergence is defensible (the pack is a Proposed contract and its example is non-normative), but no artifact records the deliberate supersession.
   Suggested remediation target phase: delivery_planning
   Suggested fix: Add one line to the plan's PIN-10 note (or the plan-end notes) recording that PIN-10's closed vocabularies intentionally supersede the pack example's illustrative "win"/"done" values, so phase-7 doc-sync reconciles the pack deliberately.

5. [nit] test_traceability — chg-GH-232-test-plan.md#front matter links + §8.3 GAP-T1
   Gap: `implementation_plan: null` and GAP-T1 status "Open — non-blocking, delivery-bound (@plan-writer)" are stale: chg-GH-232-plan.yaml now exists and the plan itself records GAP-T1 as resolved by its existence. Behavior/oracle contract unaffected; link hygiene only.
   Suggested remediation target phase: test_planning
   Suggested fix: Set `implementation_plan: ./chg-GH-232-plan.yaml` and mark GAP-T1 resolved (plan authored 2026-11-06), keeping the retained-for-traceability wording intact.

6. [nit] ac_quality — chg-GH-232-test-plan.md#TC-RETRO-044 fixture C (and §4.7 C-04a control)
   Gap: Fixture C is "a legitimately quiet change with no expected activity (verified-empty)", but the spec's pinned rule (F-6 check 4) makes activity expected for every completed change (audit invocations) and every closed change (closeout record). What distinguishes fixture C from a finding case is not pinned — the spec's rule as written leaves no "quiet completed change" category, so fixture C's scope kind is undefined and could be delivered as a contradiction of the rule it sits beside. The paired controls and the step-5 mutant keep the semantics testable; this is a fixture-definition pin, not an oracle fork.
   Suggested remediation target phase: test_planning
   Suggested fix: Pin fixture C's nature (e.g., a scope that is not completed/closed under the F-6 rule, or a window outside any change scope) so "no expected activity" is derived from the pinned rule rather than asserted.

## Notes

- Ticket binding verified: both ACs quoted verbatim inside AC-F4-1/AC-F4-2 and AC-F2-3/AC-F3-1; the pinned integrity decision (tamper-evidence not prevention; chaining key never in lane environments) is carried unweakened through G-2, NG-5, DEC-1/2/4, §21, and TDR-0009; every ticket task (retro collection, registry hardening, shape-crash guards, export, periodic memory audit home, independent evidence sidecar with trace ids + pipeline-truth checks) maps to a capability, ACs, TCs, and plan phases.
- Iteration-2 amendment completeness verified against current system truth: per-identity store-level projections match the delivered `feature-result-contract.md` rows exactly (`state.permission.denied` user/user-validation/exit 1; `state.store.torn` and `state.keys.missing` platform/platform-provider/exit 2); the four-row DEC-11 projection pin is producible by the delivered exit-by-projection-class map; export-as-engine-surface is consistent across spec §8.5, test plan TC-049..052/§4.6 (deliberately no `retro export` row), and plan tasks 3.5/4.1/4.2 (absence asserted, not assumed); `state.lock.busy`, `state.store.unknown`, `fallback.invocation`/`fallback.internal` reuse claims all check out against the delivered table; `readAuditLedger`/`AuditReadOutcome` field names match `feature-audit-ledger.md` truth; locked surface matches man-page.md; R1–R6 level names match the concepts doc; the journeys "folded into `ados retro`, no new command" quote is accurate; plan code-area anchors (runtime-edge.ts, db.ts pattern, harnesses, checks, renderer set) all exist.
- Scope discipline clean: no M2-S3/M2-S10/M1-S12 scope leaked; memory-audit boundary (DEC-10) honest; follow-through read-only; no CLI export anywhere.
- plan_coverage is marked FAIL solely because finding 1 leaves a reachable outcome (no-eligible-target) pinned only in the plan and contradicted by the spec's unconditional G-5/AC-F6-1 wording — the phase map itself (16/16 ACs, 64/64 TCs) was verified complete by set-difference.
- Prior readiness records: none (first iteration). Findings 2 and 3 should be checked for persistence if a further iteration runs.
- No human input required; all findings are change-scoped (specification/test_planning remediation). TDR-0009's Proposed status with human acceptance at PR review is per its R2 governance and is not a DoR gap.
