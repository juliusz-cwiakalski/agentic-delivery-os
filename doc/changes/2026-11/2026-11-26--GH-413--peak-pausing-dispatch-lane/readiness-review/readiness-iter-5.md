# Readiness Review Iteration 5

Verdict: NOT_READY
Work Item: GH-413
Date: 2026-11-26
Pause Required: no

One blocking finding remains. It needs no new owner decision: the owner's comment of 2026-11-26 already decides the point, and the artifacts encode it differently. Iteration 6 is authorised for it.

## Facet Summary

- spec_completeness: FAIL
- ac_quality: PASS
- plan_coverage: PASS
- test_traceability: PASS
- cross_artifact_consistency: FAIL
- decision_capture: PASS
- system_spec_consistency: PASS
- plan_doc_update_coverage: PASS
- plan_code_area_coverage: PASS
- dod_defined: PASS

Counts: 4 findings (1 major, 2 minor, 1 nit). One is substantive and blocks; three are wording-only.

## Iteration-4 Disposition

| # | Iteration-4 finding | Status | Where |
|---|---|---|---|
| 1 | Un-expired standing park | Resolved as to outcome, decision point and session safety; the owner's exit code and identity rule are not encoded | Pre-session refusal at resume admission before any session starts, writing nothing, with the surfaces still parked (F-3, F-4, Flow 3, DEC-22, AC-F3-4, RSK-14, TDR-0077 C-6 and D8, plan phase 3, TC-PEAK-038 step 5). The pass meets only an expired park or none. A failed recovery observed after the session started ends that session through one terminate and writes no park. The exit code and identity differ from Decision 1 (finding 1); a plain re-dispatch is not named (finding 2). |
| 2 | Lost lease with a live session | Resolved | No owner act, observe to session end, return with `lease:not-owned`, own result records still appended, never abandon the session (F-5, section 14, section 22, TDR-0078 C-5 and D5, TC-PEAK-010). The edit dropped the parked-case sentence from the spec (finding 3). |
| 3 | Decision capture | Resolved | DEC-22 and DEC-23 are numbered; the record scope names them and TDR-0077 C-6 and D8 cite them; pm-notes decision 15 is superseded and retro (b) is corrected; the section 18 list and DoD item 6 carry the standing-park recovery. |
| 4 | Delivered-pass consequences | Resolved | The empty `sessionRef` and `branch` `resumed` frame, the repository-wide pass and the never-retried stuck marker are stated in RSK-14, section 8.2 and section 22, asserted in TC-PEAK-038 step 7 and carried in TDR-0077 D8. NFR-10 is scoped to "between renewals and outside the unrenewed bounded waits", naming them. |
| 5 | Nits | Resolved | The ownership check and the `renewed` append are one fenced step (F-5, section 12, section 22); the stop wording and the section 14 citation are corrected. |

## Verification Basis

- Ticket read live: open, milestone `M4: Jaiship-native delivery`, six owner comments. Comments 4 to 6 are dated 2026-11-26; comment 5 is the authorization under the owner's delegated authority, with Decision 1 (pre-session refusal) and Decision 2 (iterations 5 and 6).
- `plan validate` returns `verdict=valid`, `readyForDevelopment=true`. All eight phase summaries start lowercase. Of 101 declared paths 70 exist and 31 are new; no existing path is untracked.
- Counts: the spec has 33 ACs, 10 NFRs, 9 DMs, 23 decisions and 14 risks. The test plan has 37 TCs and maps 33 of 33 ACs. Every TC is owned by exactly one plan phase, and the test plan's phase column equals the plan.
- Both records are `status: Proposed` with `decision_date: null`. TDR-0077 C-6 and D8 cite DEC-22 and DEC-23. TDR-0078 C-5 and D5 carry both lost-lease cases.
- Executed probe over the delivered exit projection and error table, with no file written: the refusal a new dispatch gets inside a window, `provider.profile.unavailable`, is `platform-provider`, transient and retryable, and exits 2. The refusal DEC-22 encodes, `queue.precondition.unmet`, is `user-validation`, category user, not retryable, and exits 1.
- Code read: `cli/src/projection.ts` (a class projects to one digit; a row's exit cannot be chosen separately from its class), `contracts/error-table.ts`, `provider/profile.ts` and `production.ts` (the nomination refusal), `doc/spec/features/feature-dispatch-engine.md` line 95 (the exit 2 convention).

## Findings

1. [major, SUBSTANTIVE] spec_completeness + cross_artifact_consistency — chg-GH-413-spec.md#DEC-22, F-3, F-4, Flow 3, AC-F3-4 vs the owner comment of 2026-11-26 (Decision 1) vs chg-GH-413-test-plan.md#TC-PEAK-038 step 5 vs TDR-0077 lines 170 and 444 vs chg-GH-413-plan.yaml#header fence and phases[id=3] vs chg-GH-413-pm-notes.yaml#decisions (line 181) vs `packages/core/src/contracts/error-table.ts:242-251,1429-1438`, `packages/cli/src/projection.ts:10-15`
   Gap: Decision 1 fixes two attributes of the refusal, and the artifacts encode neither.
   (a) Exit code. The owner's comment says the refusal "uses the exit code the window refusal of a new dispatch uses today". That refusal is `provider.profile.unavailable`, which exits 2. DEC-22, F-3, Flow 3, AC-F3-4, TC-PEAK-038 step 5, TDR-0077 C-6 and D8 and the plan all say exit 1.
   (b) Identity. The owner allows two: the window refusal if its contract fits exactly, otherwise one registered code in the dispatch family with a remediation that says to resume after `until`. The artifacts use a third, `queue.precondition.unmet`. It is a queue-family row for an unmet claim precondition, not retryable, and its remediation says to resolve a blocking precondition and retry. The pm-notes decision calls it "the delivered window-refusal identity", which it is not.
   The window refusal itself does not fit exactly: its summary says no profile is eligible, it carries an eligibility list, and a new dispatch is admitted at instants when this refusal applies. So under Decision 1 the identity is one new dispatch-family code.
   Suggested remediation target phase: specification
   Suggested fix: Encode Decision 1 as written. The refusal exits 2, so its row is `platform-provider`. Its identity is one registered code in the dispatch family with a remediation that says to resume after `until`, named in the spec, the test plan and the record. Carry that through NG-6, NFR-8 (one added row, owner-sanctioned), DEC-22, F-3, F-4, Flow 3, AC-F3-4, RSK-14, TDR-0077 C-6 and D8, plan trigger 2 and the phase that edits the error table with its pins, TC-PEAK-038 step 5 and TC-PEAK-027, and correct the pm-notes decision text. If the owner instead accepts `queue.precondition.unmet` at exit 1, that is an explicit exception to Decision 1: record the owner's confirmation in DEC-22 and the pm-notes. A PM assumption is not enough, because the exit code decides whether the operator's automation retries or stops.

2. [minor, WORDING-ONLY] cross_artifact_consistency — chg-GH-413-spec.md#F-3, F-4, Flow 3, DEC-22, AC-F3-4 vs TDR-0077 lines 170 and 444 vs chg-GH-413-test-plan.md#TC-PEAK-038 step 5 vs chg-GH-413-plan.yaml trigger (line 167)
   Gap: The owner, the record, the test plan and the plan all name "a resume or re-dispatch" as the trigger. The spec says "resume admission" and "operator resume" throughout and never names a plain re-dispatch, although an orphaned park with a dead owner is exactly the case a plain re-dispatch meets.
   Suggested remediation target phase: specification
   Suggested fix: In F-3, F-4, Flow 3, DEC-22 and AC-F3-4 write "a resume or re-dispatch of a lane whose standing park has not expired", and keep "at admission, before any session is spawned".

3. [minor, WORDING-ONLY] cross_artifact_consistency — chg-GH-413-spec.md#F-5, DEC-13, section 12 "Lease renewal", section 14 row 2 vs TDR-0078 lines 151 and 363 vs chg-GH-413-test-plan.md#TC-PEAK-010 step 5 vs chg-GH-413-plan.yaml#phases[id=2]
   Gap: The fix for the live-session case replaced the parked-case sentence. "Park standing" no longer appears anywhere in the spec. F-5, DEC-13, section 12 and section 14 row 2 state only the live-session rule, so a waiting invocation that has lost the lease has no stated outcome at window end in the capability text. The record, the test plan and the plan still state it: a parked lane returns one classified result with the park standing and the operator resume path applies. AC-F5-2 and Appendix D cover it generically, so the behaviour is not ambiguous, but the spec is thinner than its own record.
   Suggested remediation target phase: specification
   Suggested fix: Restore in F-5 and DEC-13: "A parked lane that no longer holds the lease returns one classified result with the park standing and the observation, and the operator resume path applies." Add the same sentence to section 14 row 2.

4. [nit, WORDING-ONLY] cross_artifact_consistency — chg-GH-413-spec.md#Flow 3 vs #F-3, AC-F3-4 vs chg-GH-413-test-plan.md#TC-PEAK-038 step 8
   Gap: Flow 3 says an expired park is recovered at "resume admission". F-3, AC-F3-4 and TC-PEAK-038 step 8 place the recovery at the first observation, after the resume's session has started, which is why F-3 needs the terminate rule for a failure observed there.
   Suggested remediation target phase: specification
   Suggested fix: In Flow 3 write: "once the park has expired, the resume proceeds and the invocation recovers it at its first observation through the delivered mutating pass".

## Classification For The Hand-Back

- Finding 1: substantive. It cannot be closed by applying a sentence. It either registers one error-table row with the fence and pin changes that brings, or it needs the owner's explicit acceptance of exit 1.
- Findings 2 to 4: wording-only. The fixes above can be applied literally.

## Decision Routing

- `needs_human_input`: none is required to proceed. Decision 1 already decides the exit code and the identity rule. Human input is needed only for the alternative in finding 1, where the owner accepts exit 1 as an exception.
- `system`: the refusal's identity and exit code are contract-level. TDR-0077 C-6 and D8 must carry the corrected rule.
- `change`: findings 2 to 4, and the pm-notes correction inside finding 1.

## Next Remediation Target Phases

- specification: findings 1 to 4, with TDR-0077 updated through the decision advisor.
- test_planning: TC-PEAK-038 step 5 and TC-PEAK-027 for the corrected identity and exit.
- delivery_planning: the fences, trigger 2, and the phase scope for the error table and its pins, if finding 1 follows Decision 1.

## Deduplication

Finding 1 is new in this iteration: the exit code and identity were not in question before, because the owner decided them on 2026-11-26 after iteration 4. Finding 2 is the residual of iteration-4 finding 1. Finding 3 is the residual of iteration-4 finding 2, introduced by its own fix. Finding 4 is new and small. The other parts of iteration-4 findings 1 to 5 are resolved and are not repeated.
