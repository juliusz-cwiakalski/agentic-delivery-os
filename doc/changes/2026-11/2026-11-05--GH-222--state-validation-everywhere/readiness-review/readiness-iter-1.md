# Readiness Review Iteration 1

Verdict: NOT_READY
Work Item: GH-222
Date: 2026-11-05
Pause Required: no

Reopen phase: **specification** (surgical v1.2 amendment; single root cause, two findings).
Test plan and implementation plan are NOT reopened; their resolution of the tension is accepted in substance (adjudication below).

## Facet Summary

- spec_completeness: PASS
- ac_quality: PASS
- plan_coverage: PASS
- test_traceability: PASS
- cross_artifact_consistency: FAIL
- decision_capture: FAIL
- system_spec_consistency: PASS
- plan_doc_update_coverage: PASS
- plan_code_area_coverage: PASS
- dod_defined: PASS

## Submitted Tension — Adjudication

**Spec §7.1/§8.5 ("refines only the remediation guidance text of `state.write.failed`") vs spec §22 + TC-GH222-001/010 + plan task 1.3 (torn-read guidance must mention salvage as an explicit separate operation).**

Ruling: the plan's substantive resolution is **accepted**; the alternative (carrying the salvage pointer in read evidence) is **rejected**. Grounds:

1. Spec §22 mandates the update ("repair guidance text must be updated to point at it"); spec §10 and F-2 make actionable guidance a property of the classified failure. The remediation table row is where guidance lives; the evidence model (paths/positions/counts only — spec §10, feature-state-layer.md "Evidence model") forbids parking remediation prose in evidence.
2. The m1 pack `state` entry ("torn or unknown reads classified with repair guidance, never silent zeros") confirms guidance travels with the classification, not the evidence.
3. Text-only refinement with identity/category/retryability/consequence unchanged satisfies §8.5's operative compatibility guarantee (seven codes keep identity and semantics); only §8.5's/§7.1's word "only" conflicts, and it conflicts with the same document's §22.

However, the spec text itself remains self-contradictory and must be amended before delivery: a literal phase-8 review against §8.5 would FAIL a correctly implemented delivery (or invite reverting the correct behavior), and the delivered torn-row refinement would sit outside the spec's declared table dispositions. The fix is mechanical — see Findings 1–2.

## Findings

1. [major — BLOCKING] cross_artifact_consistency — chg-GH-222-spec.md §7.1 (In Scope, error-code dispositions) and §8.5 (Backward Compatibility, bullet 2)
   Gap: both sections declare exactly one refined remediation row (`state.write.failed`), while spec §22, test-plan TC-GH222-001 ("points at an inspect/salvage path") and TC-GH222-010 ("mentions salvage as an explicit separate operation"), and plan Phase 1 task 1.3 require and implement a second text-only refinement of `state.store.torn` (both tables, same commit, sync discipline binding). Spec contradicts itself and its downstream artifacts.
   Suggested remediation target phase: specification
   Suggested fix: v1.2 amendment — in §7.1 and §8.5, declare the `state.store.torn` remediation text refinement alongside `state.write.failed` (text-only; identity, category, retryability, consequence `not_landed` unchanged; declared in both error tables in the same change per DEC-5/NFR-6). No other section changes required.

2. [major — BLOCKING; same root cause as Finding 1] decision_capture — chg-GH-222-spec.md §15 (DEC-5)
   Gap: the change makes four table dispositions (two new rows, `state.write.failed` text refinement, `state.store.torn` text refinement) but DEC-5 records only the first three; the fourth is recorded only in the plan's Context and pm-notes and is contradicted by spec §8.5. A table-contract disposition of this class belongs in the spec decision log.
   Suggested remediation target phase: specification
   Suggested fix: fold into the same v1.2 amendment — extend DEC-5 case 1 (or add DEC-6) recording the `state.store.torn` remediation refinement as a decided disposition with the §22/TC-GH222-001/010 rationale.

3. [minor — non-blocking] plan_coverage — chg-GH-222-plan.md Phase 1, task 1.7
   Gap: task 1.7's parenthetical "(row shape)" under-describes the required update: `tests/structure/error-table.test.ts` asserts the exact state-row count **three times** (`toHaveLength(7)` at lines 390, 480, 647) and all three must become 9 in Phase 1. The file is already in Phase-1 scope and its verification command runs it, so the every-commit-green discipline holds; only the task wording is imprecise.
   Suggested remediation target phase: delivery_planning
   Suggested fix: opportunistically (may ride the iteration triggered by Findings 1–2) amend task 1.7 to name the three exact-count assertions (7→9) alongside row-shape and row assertions.

4. [nit — non-blocking] cross_artifact_consistency — chg-GH-222-plan.md Context ("the current hint names neither")
   Gap: the current documented `state.store.torn` remediation is "Inspect or restore the named state store; never treat it as empty." (feature-result-contract.md:128) — it names inspection; it lacks only the salvage-as-explicit-operation pointer. The plan's justification sentence is factually imprecise about current state.
   Suggested remediation target phase: delivery_planning
   Suggested fix: correct the sentence when next touching the plan (rides Finding 3's edit).

## Verified (adversarial checks performed — no finding)

- Ticket AC coverage: all 5 ticket ACs map (AC1→AC-F2-1, AC2→AC-F6-1, AC3→AC-F3-1, AC4→AC-F4-1, AC5→AC-F5-1) against the live issue body; pinned decisions recorded as DEC-3 and never re-derived.
- AC↔TC↔phase traceability: bidirectional — 9/9 ACs covered by TC-GH222-001..023; every TC maps to ≥1 AC; plan coverage matrix maps all 23 TCs to phase tasks, including the deliberate TC-GH222-018 split (Phase 1 rows/sync + Phase 5 trigger sweep — committing the sweep earlier would not be green).
- Every-commit-green: verified against source. The seven-code sweep (`tests/behaviour/state-error-classification.test.ts`) is a membership loop, not an exact-count assertion — it stays green when rows are added. All exact-count/remediation-text dependencies (`tests/structure/error-table.test.ts`, `tests/checks/error-table-sync.test.ts`, `tests/fixtures/result/code-corpora/**`, goldens) are inside Phase-1 tasks 1.6/1.7 with the sync check as verification.
- Architecture boundaries: plan constraints match feature-state-layer.md (state tier imports contracts + own modules only; runtime APIs only in `driver/runtime-edge.ts`; no driver discriminant; `repairTornTail` exists at state/index.ts:492 as the mirror the plan names; ENOSPC classification placed at the driver edge; additive kinds within `delivery.state.v1`, no version bump; no read-triggered repair anywhere).
- Fault points: all ASM-3 names verified in `StateEdgeFaultPoint` (edge.ts permits delivery additions for the two salvage points); `index-rebuild-write` correctly keeps `state.write.failed` (TC-GH222-013).
- Error-code set: current tables hold exactly the seven verified rows; DEC-5's 7→9 disposition is consistent across spec/test-plan/plan.
- Scope decisions vs backlog canonical scope: DEC-1 (mechanism-first) is the only executable reading of ticket AC2 — no retro/ceremony modules exist in `packages/core/src` (verified); rank-22 goal line and PM clarify decision support it. DEC-4 (library-only, `state` CLI deferred) is correct per milestones/README ("the backlog stays canonical for scope and order"; pack entries are proposals refined at delivery) and the backlog naming no command; the pack's `state` page (commands/state.md:53, `state.store.unknown-schema`) correctly remains a proposal, superseded in name only by DEC-5 when the CLI line refines it.
- Test-plan handoff claim verified: test-scenarios.md:342 lists S2 among stories inheriting the pattern with story-local TC ids; the plan's TC-GH222-* traceability satisfies the pack's "fails its own DoR" rule.
- Migration/compat: additive-only; existing stores unchanged; §19 correctly declares no migration; corpora/golden regeneration scoped deliberately.
- NFRs: NFR-1..7 are measurable and each traced to TCs; no missing NFR class identified (performance explicitly and reasonably out of scope).

## Residual Risks to Carry into Delivery/Review (pre-recorded for the READY iteration)

1. Mechanism-first bet: M1-S8/M2-S3 must actually adopt the artifact-boundary contracts; TC-GH222-020's second-kind reuse assertion is the guardrail — review should confirm it stays.
2. Pack drift: `doc/planning/oss-tooling/milestones/m1/commands/state.md` retains the proposed `state.store.unknown-schema`; the later operate-family CLI story must reconcile it to the shipped `state.store.unknown`.
3. AC-F5-1 wording: "the ledger remains at the last valid frame" must be read per plan task 2.3 under `replaceDocument`'s existing ledger-first intent record (documented DEC-8 contract) — TC-GH222-016 correctly asserts document stability, not ledger byte-identity; reviewers should apply the plan's documented reading, not a byte-identity reading of the AC.
4. OQ-T2 (conformance matrix) and OQ-T3 (second salvage on clean ledger) are deliberately deferred with recorded decision paths — verify execution-log recording at Phase 5/6.
5. SQLite-binding skips must be recorded as skips, not passes (plan Phase 6; test plan §7.2).
