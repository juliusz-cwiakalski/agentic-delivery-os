# Readiness Review Iteration 1

Verdict: READY
Work Item: GH-388
Date: 2026-11-23
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
1. [minor] test_traceability — chg-GH-388-test-plan.md#TC-VGATES-071 steps 6–7
   Gap: The append-fault negative control says "rebuild the harness with the state store wrapped … run `verify gates <ref>` again … run `merge <ref>` on the faulted fixture" and expects the `merge.state-unverified` refusal. That expectation holds only if the rebuilt harness uses a fresh store root; on the first arm's store the already-persisted record would satisfy the envelope and `merge` would land. The fresh-store requirement is implied by "rebuild" (and by TC-MERGE-041's fresh-harness convention) but never stated.
   Suggested remediation target phase: test_planning
   Suggested fix: One clause in TC-VGATES-071's preconditions: the append-fault arm runs on a fresh store root with no pre-existing verification record. May be applied by the implementing suite author and noted in the plan revision log; it does not change coverage.

## Verification Evidence (anchors checked in the delivered tree)
- Code truth confirmed: the shipped `createVerifyGatesCommandRuntime` call at `packages/cli/src/production.ts:2507` supplies no `appendVerification`; the no-op default ("The EVT-1 append seam; absent leaves the evaluation unrecorded") is `packages/cli/src/edge.ts:1438` (option doc at edge.ts:1281); the merge composition's ports wiring pattern (`appendMergeGateVerification` + `fenceToken: composition.newFenceToken()`) is edge.ts:1562; the fence-token factory `newFenceToken` is production.ts:2006; the handler calls `runtime.appendVerification(record)` on both paths (`packages/cli/src/commands/verify-gates.ts:446,544`); `appendMergeGateVerification` is exported from `packages/core/src/state`.
- The deferred-seam premise (OQ-1/RSK-2) is code-true: the shipped verify-gates composition's default `readGateSet` resolves `resolveMergeGateSet(undefined)` (shipped default set), while merge resolves the declared configuration.
- System-spec claims confirmed: `doc/spec/features/feature-verify-gates.md:547` declares the record truth; `feature-merge-verify-deploy.md` declares the freshness envelope, `state-unverified`, the shared registry, and the five built-ins plus merge-only `tracker-freshness`; `feature-result-contract.md:230` carries the remediation sentence byte-identical to DEC-4/TC-MERGE-042's pin; `doc/guides/engine-first-operations.md:30` currently documents the `--dry-run` step (the ticket's blocked documentation); `doc/quality/test-specs/test-spec-merge-verify-deploy.md` exists.
- Test ecosystem confirmed: all 24 cited suites/fixture files exist, including the injectable fixture `appendVerification` seam (`tests/fixtures/verify-gates/cases/harness.ts:31,74`) and `stateStoreWrap` (`tests/fixtures/merge/production-composition.ts:74,382`); the delivered merge harness already materializes the CI workflow and pm-notes, so the verify-gates arms are realistic extensions. TC-id continuity confirmed: no TC-VGATES-071+ or TC-MERGE-040+ exists in `tests/`; delivered maxima are TC-VGATES-070 and TC-MERGE-039 as claimed.
- Changeset format confirmed precedented: `.changeset/gh-377-*`, `gh-381-*`, `gh-384-*` each declare exactly the five fixed-group packages at minor (GH-381's filename says patch but its front matter declares minor — matching the plan's "a patch guess failed the gates on GH-381 and is not repeated" note).
- Ticket trace confirmed against the live issue: five verbatim ACs → spec Appendix B 1:1 → TC cases; the mechanism delegation is exercised (owner comment 2026-11-23 declares option (A) + total-identity rule = spec DEC-1/DEC-2); ticket AC-2's alternative branch is resolved, not dropped (AC-T2-1 + TC-MERGE-041 assert option (B) absent and the remediation sequence converging).

## Decision Routing
- No `needs_human_input` decisions. The mechanism choice was delegated by the ticket and declared by the owner in a ticket comment; it is recorded as change-level decisions (spec DEC-1..DEC-6, pm-notes `decisions:`).
- OQ-1 (custom-declared-set surface parity) is deferred fail-closed with an explicit escalation condition (consult `@decision-advisor` only if delivery or review judges it blocking for M4). No decision record is required now; the deferred item is consistent across spec §7.3/§14/RSK-2/DEC-5/NG-9, the test plan §1.2/§8.3, and the plan header fence.

## Advisory (non-blocking) observations
- Delivered-suite hygiene (pre-existing, outside these artifacts): `tests/behaviour/verify-gates-ci.test.ts` carries two tests both labelled TC-VGATES-070 (lines 88 and 236). Harmless to this change — the plan consumes TC-VGATES-071+ — but a future change should deduplicate the label to keep id-based traceability clean.
- pm-notes shorthand nit: the delivery-planning outcome note reads "production.ts:2507 no-op default, edge.ts:1438 seam default"; strictly, the no-op default lives at edge.ts:1438 and production.ts:2507 is the call site that omits the seam. The substance and the plan header's own anchors are exact; no artifact change required.

## Gate Result
READY — delivery may start. The single minor finding (TC-VGATES-071 fault-arm store freshness) does not fail any facet and may be resolved in the test artifact or by the implementing suite author with a one-clause clarification; the binding capture-before-change ordering, golden no-regeneration rule, one-production-file scope, and option-(B)-absent pin are all consistent and enforceable as written.
