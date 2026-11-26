# Readiness Review Iteration 6

Verdict: NOT_READY
Work Item: GH-413
Date: 2026-11-26
Pause Required: yes

The pause is the park this final authorized pass ends in. Two sentences of the spec contradict the decision, the AC, the record, the test plan and the plan. Both are wording-only and both fixes are literal. No owner decision on content is needed; the owner decides whether to apply the two edits and authorise a further pass.

## Facet Summary

- spec_completeness: PASS
- ac_quality: PASS
- plan_coverage: PASS
- test_traceability: PASS
- cross_artifact_consistency: FAIL
- decision_capture: PASS
- system_spec_consistency: PASS
- plan_doc_update_coverage: PASS
- plan_code_area_coverage: PASS
- dod_defined: PASS

Counts: 5 findings (2 major, 2 minor, 1 nit). All are wording-only. Findings 1 and 2 block.

## Iteration-5 Disposition

| # | Iteration-5 finding | Status | Where |
|---|---|---|---|
| 1 | Exit code and identity of the un-expired-park refusal | Resolved in the decision, the AC, the record, the test plan and the plan; one sentence of the spec was not updated | `dispatch.resume-parked` at exit 2 with the owner's fields (DEC-22, F-3, Flow 3, AC-F3-4, RSK-14, TDR-0077 C-2, C-6 and D8, TC-PEAK-038 step 5, TC-PEAK-027, plan phase 3 and trigger 18, pm-notes). F-4 still names the superseded identity (finding 1). |
| 2 | A plain re-dispatch not named | Resolved in DEC-22, Flow 3, AC-F3-4, the test plan, the plan and the record; not in F-3 or F-4 | Findings 1 and 3. |
| 3 | Parked-case lost-lease sentence dropped | Restored in F-5 and section 14, with one wrong clause; not in DEC-13 or section 12 | Finding 2. |
| 4 | Flow 3 placed the expired park's recovery at admission | Resolved | Flow 3 now recovers it at the first observation. |

## Iteration-4 Disposition

| # | Iteration-4 finding | Status |
|---|---|---|
| 1 | Un-expired standing park specified three ways | Resolved. One outcome: a pre-session refusal before any session, writing nothing; the pass meets only an expired park or none; a failed recovery after the session started ends it with one terminate. The identity in F-4 is the one leftover (finding 1). |
| 2 | Lost lease with a live session | Resolved in F-5, section 14, section 22, TDR-0078 C-5 and D5, TC-PEAK-010. The parked-case clause contradicts the no-release rule (finding 2). |
| 3 | Decision capture | Resolved. |
| 4 | Delivered-pass consequences | Resolved. |
| 5 | Nits | Resolved. |

## Verification Basis

- Ticket read live: open, milestone `M4: Jaiship-native delivery`, seven owner comments. Comment 5 (2026-11-26T14:21Z) carries Decision 1 and Decision 2. Comment 7 (14:54Z) records the provider-limit park and that iteration 6 runs after the reset.
- `plan validate` returns `verdict=valid`, `readyForDevelopment=true`. All eight phase summaries start lowercase. Of 112 declared paths 81 exist and 31 are new; no existing path is untracked.
- Counts: the spec has 33 ACs, 10 NFRs, 9 DMs, 23 decisions and 14 risks. The test plan has 37 TCs and maps 33 of 33 ACs. Every TC is owned by exactly one plan phase.
- Both records are `status: Proposed` with `decision_date: null`.
- The row's fields are identical in the spec (F-3, DEC-22), plan phase 3, TDR-0077 D8 and TC-PEAK-038 step 5: `dispatch.resume-parked`, dispatch kind, `transient`, `retryable: true`, `not_landed`, `platform-provider`, the stated summary and remediation. Exit 2 follows from `platform-provider`, the class of the window refusal `provider.profile.unavailable`, as the iteration-5 probe showed.
- The plan's pin claims were checked against the repo: the two-segment reserved sets hold 71 members in the sync script and its duplicate; the table totals are 172 and 171 outside the spend kind; the dispatch kind carries four rows in `dispatch-error-identity.test.ts` and `dispatch-attempts-taxonomy.test.ts`; `dispatch-contract-invariance.test.ts` holds closed lists; the contract baseline pins `errorRowCount: 172`; `cross-repository-contract.test.ts` reads a baseline; `decision-record.test.ts` has per-record cases; the sync check fails "source entry is undocumented" against `feature-result-contract.md`, which phase 3 scopes with the row; `AppErrorCode` is a string alias.
- The 19-page set: the spec lists 19; the plan scopes all 19, 18 in phase 8 and `feature-result-contract.md` in phase 3.

## Findings

1. [major, WORDING-ONLY] cross_artifact_consistency — chg-GH-413-spec.md#F-4 (line 144, last sentence) vs #F-3 (line 142), DEC-22 (line 438), Flow 3 (lines 224 to 229), AC-F3-4 (line 501) vs TDR-0077 C-6 and D8 vs chg-GH-413-test-plan.md#TC-PEAK-038 step 5 vs chg-GH-413-plan.yaml#trigger 18
   Gap: F-4's last sentence still describes the un-expired-park refusal with the identity iteration 5 removed: "the delivered unmet-precondition refusal names the park's cause and `until`". That is `queue.precondition.unmet`. F-3, DEC-22, Flow 3, AC-F3-4, the record, the test plan and the plan all say `dispatch.resume-parked` at exit 2. The sentence also says "an operator resume" only. The spec names two identities for one refusal, on the attribute the owner decided, and the doc-syncer reconciles current truth from this text.
   Suggested remediation target phase: specification
   Suggested fix: Replace F-4's last sentence with: "**A resume or re-dispatch of a lane whose standing park is still un-expired is refused at resume admission**: `dispatch.resume-parked` at exit 2 names the park's cause and `until`; no session is spawned, nothing is written, and `lanes` and `board` keep showing the lane parked until the park ends; after the end the delivered recovery pass meets an expired park at the first observation and the resume proceeds."

2. [major, WORDING-ONLY] cross_artifact_consistency — chg-GH-413-spec.md#F-5 (line 146) vs AC-F5-2 (line 506), Appendix D (line 640) vs TDR-0078 D5 (line 365) vs chg-GH-413-test-plan.md#TC-PEAK-010 (line 533) vs chg-GH-413-plan.yaml#phases[id=2] (lines 98 and 307)
   Gap: The parked-case sentence was restored in F-5 with a clause that reverses the rule: "When the lane is parked, that invocation returns one classified result with the park standing and the observation and releases the lease". "That invocation" is one that no longer holds the lease, and the delivered release matches on holder, so the lease it would release is the successor's. AC-F5-2 says it "does not release or renew the successor's lease". Appendix D, TDR-0078 D5 ("the run path does not call it for a lease it no longer owns"), the plan and TC-PEAK-010 say the same. An implementer who follows F-5 ends the successor's single-flight. DEC-13 and the section 12 "Lease renewal" bullet still have no parked-case sentence.
   Suggested remediation target phase: specification
   Suggested fix: In F-5 replace "and releases the lease, so the delivered operator resume path applies" with "and leaves the successor's lease alone; the delivered operator resume path applies". Add to DEC-13 and to the section 12 "Lease renewal" bullet: "A parked lane's invocation that no longer holds the lease returns one classified result with the park standing and does not release the successor's lease."

3. [minor, WORDING-ONLY] cross_artifact_consistency — chg-GH-413-spec.md#F-3 (line 142)
   Gap: F-3's refusal sentence says "at the admission of the resume" and does not name a re-dispatch. DEC-22, Flow 3 and AC-F3-4 do.
   Suggested remediation target phase: specification
   Suggested fix: In F-3 write "at the admission of a resume or re-dispatch".

4. [minor] test_traceability — chg-GH-413-test-plan.md#TC-PEAK-027 and section 2 vs chg-GH-413-plan.yaml#phases[id=3]
   Gap: The plan declares the row's table-level pins, the documented-row sync and a decision-record case that asserts TDR-0077 states the row, each with its own Verify line. No test case traces them. TC-PEAK-027's target lists only the event-taxonomy suites, and section 2 names none of `tests/structure/error-table.test.ts`, `tests/checks/error-table-sync.test.ts` or `tests/checks/decision-record.test.ts`. The row's own field assertions and its documented row are therefore outside the test plan's trace, although `pnpm check` would still run them.
   Suggested remediation target phase: test_planning
   Suggested fix: Add those three suites to TC-PEAK-027's target, steps and expected outcome: one added row with the declared fields at exit 2, a documented row on the result-contract page, and a decision-record case asserting TDR-0077 states the row.

5. [nit] plan_doc_update_coverage — chg-GH-413-plan.yaml#phases[id=8] summary and comment; the dispatch reference page
   Gap: Phase 8 says "the eighteen pages the spec names". The spec names nineteen, and the nineteenth moves with the row in phase 3, which only the phase 3 comment says. Separately, neither the spec nor the plan says whether the dispatch reference page, already in phase 5 scope, lists the new refusal beside its other exit-2 refusals.
   Suggested remediation target phase: delivery_planning
   Suggested fix: In phase 8 write "eighteen of the nineteen pages; `feature-result-contract.md` moves with the row in phase 3". Declare the reference-page line for `dispatch.resume-parked` in phase 5, or state that none is added.

## Classification For The Hand-Back

- Findings 1 and 2 block. Both are wording-only: each is one sentence that contradicts what the decision, the AC, the record, the test plan and the plan already say, and each fix is a literal replacement given above.
- Findings 3 and 4 are wording-only and can ride the same edit.
- Finding 5 is a nit.

## What Is Settled

Everything the owner decided is encoded and agrees across the ticket, the spec's decision and AC, the test plan, the plan and both records: the pre-session refusal before any session, for a resume or a re-dispatch, writing nothing; `dispatch.resume-parked` at exit 2, the window refusal's exit code, as the one owner-authorised row with the stated fields and remediation; the single exception in NG-6, NFR-8 and TDR-0077 C-2; the recovery pass meeting only an expired park or none; the terminate rule for a failure seen after the session started; the row's pins, the documented row and the 19-page set in the plan. No finding reopens any of that.

## Decision Routing

- `needs_human_input`: none on content. The pause is the park.
- `change`: all five findings.

## Next Remediation Target Phases

- specification: findings 1, 2 and 3.
- test_planning: finding 4.
- delivery_planning: finding 5.

## Deduplication

Finding 1 is the residual of iteration-5 finding 1: the identity is corrected everywhere except F-4. Finding 2 is the residual of iteration-5 finding 3, introduced by its own fix. Finding 3 is the residual of iteration-5 finding 2 in F-3. Findings 4 and 5 are new in this iteration. No earlier finding is repeated as it stood.
