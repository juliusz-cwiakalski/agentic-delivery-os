# Readiness Review Iteration 1

Verdict: READY
Work Item: GH-384
Date: 2026-11-22
Pause Required: no

## Facet Summary

- spec_completeness: PASS
- ac_quality: PASS
- plan_coverage: PASS
- test_traceability: PASS
- cross_artifact_consistency: PASS
- decision_capture: PASS
- system_spec_consistency: PASS
- plan_doc_update_coverage: PASS
- plan_code_area_coverage: PASS
- dod_defined: PASS

## Findings

1. [minor] cross_artifact_consistency — chg-GH-384-spec.md#NFR-5 (§9) vs chg-GH-384-plan.yaml (header decision + phase-2 comment) and chg-GH-384-test-plan.md §8.3
   Gap: The `verifiedEmpty` settlement is sound and code-grounded — delivered steps/baseline reads pass the store's ledger-wide flag through (`packages/core/src/state/telemetry.ts:421,456`), the rule source families read derives it per-ref (`telemetry.ts` `readTelemetryFamilies`), the plan bindingly keeps the pass-through as contract, and TC-TELEMETRY-048 step 8 test-enforces it — but spec NFR-5's iff-clause ("verified-empty true if and only if the requested ref holds no records of the family") still reads universal while its enforcement clause is fixture-scoped, so a later reader of the spec alone sees a clause the settled contract contradicts for an absent ref over a non-empty ledger (a shape no AC names). The plan's "recorded at delivery planning per owner directive" attribution is not reflected in pm-notes (`decisions: []`).
   Suggested remediation target phase: specification
   Suggested fix: Annotate NFR-5 (or fold into the §22 phase-7 reconciliation obligation) to state the derivation contract explicitly — the delivered ledger-wide pass-through is the contract for these two reads — and record the settlement and its owner-attribution in pm-notes so the corner shape cannot be re-litigated mid-delivery.

2. [minor] plan_coverage — chg-GH-384-plan.yaml#phase-1 summary vs pre-fix executability
   Gap: Phase 1 runs at the branch point (pre-fix), and its summary says it builds FX-8 "with one baseline per ref through the real helper" and FX-9 with "ref B's capture — its same-identity repeat and its distinct-session append — through the same helper"; pre-fix, every dual-ref healthy-baseline helper call fails (that call is the defect). Phase 1's declared verify (the capture entry over FX-R1/FX-R2/FX-13, all constructible pre-fix) is executable as planned, and the TC-ownership comment scopes execution to phases 2–3 — but nothing states explicitly that the dual-ref healthy-baseline seeding paths must not execute until phase 2 (post-fix). A coder validating phase-1 builders could misread the defect tear as a phase-1 failure and reach for the GH-381 raw-append workaround, recreating the exact retro the plan forbids.
   Suggested remediation target phase: delivery_planning
   Suggested fix: Add one binding note to phase 1: dual-ref healthy-baseline seeding (FX-8/FX-9 beyond FX-R2's single ref-A seed) executes only from phase 2 onward, post-fix; phase 1 validates builders solely through the capture-entry fixtures (FX-R1/FX-R2/FX-13).

3. [nit] spec_completeness — chg-GH-384-spec.md §2.1/§7.3/OQ-2 (standalone capture-family read)
   Gap: "No delivered consumer composes it" is precise for production (only `packages/core/src/state/index.ts` re-exports `readTelemetryCaptureOutcomes`; no production composition), but two delivered proof suites call it directly on single-ref fixtures (`tests/behaviour/telemetry-attribution.test.ts:277`, `tests/behaviour/telemetry-ingest.test.ts:348`). The deferral itself is sound: the ticket and binding owner comment scope exactly two sites, no failure is observed, and single-ref test fixtures cannot bite. Wording only.
   Suggested remediation target phase: specification
   Suggested fix: Reword to "no delivered production consumer composes it" so the boundary statement matches the tree exactly.

## Gate Evidence (ground-truth probes, authoring-only)

- **Ticket/owner traceability**: Issue #384 body + binding owner comment fetched; all five ticket ACs map one-to-one (spec Appendix B) to AC-F1-1/AC-F2-1/AC-F4-1/AC-F4-2/AC-F8-1, thence to TC-TELEMETRY-048..053 + TC-SPEND-035, thence to plan phases 2–3; required behaviors map to AC-F6-1/AC-F7-1/AC-NFR2-1 (TC-054/055/056). No orphan AC, no orphan TC.
- **TC-id freshness**: grep across current `tests/` — TC-TELEMETRY-048..056 and TC-SPEND-035 unused; delivered maxima confirmed TC-TELEMETRY-047 (`telemetry-foreign-ref-skip.test.ts`), TC-SPEND-034, TC-REF-007, TC-METRICS-113. No collision.
- **Defect sites verified in code**: `readTelemetrySteps` tears on any foreign step key (`telemetry.ts:409-413`); `appendTelemetryBaseline`'s pre-read and post-verified read both compose `readTelemetryBaselines` (`telemetry.ts:529,550`) — the shared-path settlement (OQ-1/DEC-3) matches the code; `readTelemetryStepsAtVersion` composes `readTelemetrySteps` (A-4 inheritance verified); `captureTelemetryBaseline` composes `appendTelemetryBaseline` (`telemetry.ts:669`), so the CLI capture path inherits the fix.
- **Latent third instance**: `readTelemetryCaptureOutcomes` (`telemetry.ts:605-609`) carries the same shape; no production consumer; deferral bounded and recorded (§7.3, NG-10, OQ-2) — finding 3 nit only.
- **Rule and system-spec consistency**: `doc/spec/features/feature-telemetry-v2.md` §5/§5.1 already declare the per-ref skip rule as current contract truth for the reading bases and both declared consumers; GH-384 closes the two code sites so implementation matches the declared contract. No contradiction; phase-7 reconciliation obligation named (spec §22; pm-notes doc impacts).
- **Changeset ground truth**: `.changeset/config.json` fixed group is exactly the five packages; landed `gh-381-telemetry-foreign-ref-skip-patch.md` carries five minor entries (the "-patch filename / five minor entries" claim verified verbatim). Spec §18/Appendix D and plan phase 3 declare the correct format.
- **Decision-id ceiling**: `doc/decisions/` maximum is TDR-0075 — matches the owner's stated ceiling; DEC-4's no-record posture and re-verify-before-authoring clause are consistent.
- **Constraint carry-through into the plan**: real-helper fixtures (fail-fast seeder), no idempotency weakening, single verified pass / no per-record reads, no ledger mutation, forbidden surfaces (`.jaiship/config.local.yaml`, GH-366 worktree `5a9d3ab8`, #378 scope), and `TMPDIR=$PWD/tmp/tmpdir` gate evidence are all present as binding plan-wide fences.
- **Golden-before-fix sequencing**: phase 1's capture entry (FX-R1/FX-R2/FX-13) is constructible and executable pre-fix (FX-R2 records the pre-fix tear after a single helper seed that succeeds on a one-ref ledger; FX-13 is single-ref); phase 2 captures corrected halves post-fix; no branch-diff assertion in permanent suites. One latent trap recorded as finding 2.
- **Prior readiness records**: none exist for this change folder — iteration 1 is the first gate run; no deduplication required.
- **DoR override**: not applicable (behavioral change, contracts-adjacent seam).

Verdict rationale: every facet passes; the two minor findings and one nit are recorded refinements whose worst cases are caught by existing plan assertions or cost minutes of confusion, not proof corruption or AC orphans. No pause flag: no `needs_human_input` decision remains — the `verifiedEmpty` settlement is recorded in change docs (decision_routing class `change`), and the latent third instance is resolved code-grounded (OQ-2).
