# Readiness Review Iteration 7

Verdict: READY
Work Item: GH-413
Date: 2026-11-26
Pause Required: no

The two sentences that blocked iteration 6 no longer contradict anything. F-4 names `dispatch.resume-parked` at exit 2, and F-5, DEC-13 and the section 12 bullet all say that the parked invocation which lost its lease leaves the successor's lease alone. No requirement, decision, AC, test or plan obligation contradicts the ticket, the owner's decisions or the two decision records. Delivery can start on the artifacts as they stand.

One thing to know before reading "READY" as "the literal fixes were applied". The fix for F-4 was applied in part. The sentence carries the decided identity, but it still says "An operator resume" and it does not place the recovery at the first observation. The pm-notes note "Post-iteration-6 literal fixes applied" says it does both, and comment 9 repeats that the literal fixes are applied. The change's record describes an edit that is not on disk. F-3 states both clauses in full two lines above, so nothing that is built, tested or documented changes. This is finding 1, a minor, and its fix is the iteration-6 sentence, verbatim.

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

Counts: 6 findings (0 major, 2 minor, 4 nit). All are wording-only. None blocks.

## Iteration-6 Disposition

| # | Iteration-6 finding | Status | Where |
|---|---|---|---|
| 1 | F-4 named the superseded identity `queue.precondition.unmet` | Resolved for the identity. Not applied: "a resume or re-dispatch" and "at the first observation" | spec F-4 (line 144). Finding 1 |
| 2 | F-5's parked-case clause said the lost-lease invocation "releases the lease"; DEC-13 and the section 12 bullet had no parked-case sentence | Resolved as written. The section 14 row agrees | spec F-5 (146), DEC-13 (429), section 12 bullet (378), section 14 row 2 (408) |
| 3 | F-3 did not name a re-dispatch | Resolved as written | spec F-3 (142) |
| 4 | The row's pins, documented row and decision-record case had no traced test | Resolved as the suggested fix was written. Two lists that fix did not name are still behind | test plan TC-PEAK-027 (1042 to 1073). Finding 2 |
| 5 | Phase 8 said eighteen pages; the reference-page line was undeclared | Page count resolved as written. The reference-page half is not applied | plan phase 8 summary (993). Findings 3 and 4 |

## Verification Basis

- Ticket read live: open, milestone `M4: Jaiship-native delivery`, ten owner comments. Comment 8 (16:32Z) lists the iteration-6 replacements. Comment 9 (16:35Z) authorizes iterations 7 and 8. Comment 10 (16:36Z) records the resume.
- Artifacts at HEAD `92c03828`. The fix commit's word-level diff against its parent is exactly these edits and no others: F-3 "the resume" to "a resume or re-dispatch"; F-4 "the delivered unmet-precondition refusal" to "`dispatch.resume-parked` at exit 2"; F-5 "releases the lease, so" to "leaves the successor's lease alone;"; the parked-case sentence added to DEC-13 and to the section 12 bullet; in TC-PEAK-027 the three suites in the target, step 1, a new step 2 and its expected-outcome line; the plan's phase 8 summary.
- `queue.precondition.unmet` remains in two places, both revision history: the spec's v1.4 row (650) and the test plan's v1.5 row (1551).
- Both records and all source are unchanged since iteration 6: `git diff e43739cc HEAD` over `doc/decisions`, `packages`, `tests` and `scripts` is empty. The pin claims, the exit-code derivation and the record text verified in iteration 6 stand.
- `plan validate` returns `verdict=valid`, `readyForDevelopment=true`. All eight phase summaries start lowercase.
- Counts: 33 ACs, 10 NFRs, 9 DMs, 23 decisions, 14 risks; 37 TCs; 33 of 33 ACs mapped; every TC has one mapping row.
- Every TC has one owning plan phase, equal to its mapping row. The plan also names TC-PEAK-010 in phase 3 and TC-PEAK-021 and TC-PEAK-037 in phase 2, each in a comment that points to the owning phase.
- Both records are `status: Proposed` with `decision_date: null`.
- The page set: the spec names 19 in section 16 (lines 468 to 486); the plan lists 18 with a reason each in phase 8 and scopes `feature-result-contract.md` in phase 3.
- The three suites TC-PEAK-027 now names are in phase 3 scope with their own Verify lines. TC-PEAK-027 is owned by phase 6.
- One uncommitted file: the pm-notes resume note, 12 added lines. No pm-notes decision entry changed since iteration 6. It is bookkeeping and does not affect this verdict.
- No source file and no artifact was modified. This record is the only file written.

## Findings

1. [minor, WORDING-ONLY] cross_artifact_consistency — chg-GH-413-spec.md#F-4 (line 144, last sentence) vs #F-3 (line 142) vs chg-GH-413-pm-notes.yaml#notes ("Post-iteration-6 literal fixes applied")
   Gap: The two-identity contradiction is gone. Two clauses of the iteration-6 fix are not applied: the sentence says "An operator resume" and not "a resume or re-dispatch", and it does not say the recovery happens at the first observation. F-3 states both. The pm-notes note says F-4 now has both, so the change's own record overstates the edit.
   Suggested remediation target phase: specification
   Suggested fix: Replace F-4's last sentence with the iteration-6 text, verbatim: "**A resume or re-dispatch of a lane whose standing park is still un-expired is refused at resume admission**: `dispatch.resume-parked` at exit 2 names the park's cause and `until`; no session is spawned, nothing is written, and `lanes` and `board` keep showing the lane parked until the park ends; after the end the delivered recovery pass meets an expired park at the first observation and the resume proceeds." If the sentence is not replaced, correct the pm-notes note to say what was applied.

2. [minor, WORDING-ONLY] test_traceability — chg-GH-413-test-plan.md#section 7 row TC-PEAK-027 and #section 2 "Existing suites this plan extends" vs #TC-PEAK-027 target (line 1050) vs chg-GH-413-plan.yaml#phases[id=3]
   Gap: The scenario block now names five suites. The section 7 row lists two under "Test file" and runs two under "Execution command", and the section 2 list omits `tests/structure/error-table.test.ts`, `tests/checks/error-table-sync.test.ts` and `tests/checks/decision-record.test.ts`. The trace for the row's pins, the documented row and the decision-record case stops at the scenario block. Coverage is intact: phase 3 runs the three suites and `pnpm check` runs them at the gate.
   Suggested remediation target phase: test_planning
   Suggested fix: Add the three suites to the row's "Test file" and "Execution command" cells and to the "Vocabulary and release" bullet of section 2.

3. [nit] plan_doc_update_coverage — chg-GH-413-plan.yaml#phases[id=5] scope entry `doc/planning/oss-tooling/milestones/m1/commands/dispatch.md` (line 885)
   Gap: The dispatch reference page is in phase 5 scope for `dispatch stop` only. It lists today's pre-session refusals by identity (lines 78 to 83, 125 and 139). Neither the plan nor the spec says whether it gains a line for `dispatch.resume-parked`.
   Suggested remediation target phase: delivery_planning
   Suggested fix: Declare that line in phase 5, or state that none is added. Unchanged from iteration 6.

4. [nit] plan_doc_update_coverage — chg-GH-413-plan.yaml#phases[id=8] comment (line 997)
   Gap: The comment says "The eighteen pages spec section 16 names". Section 16 names nineteen. The list under the comment holds eighteen, and the summary above it is now correct.
   Suggested remediation target phase: delivery_planning
   Suggested fix: Write "Eighteen of the nineteen pages spec section 16 names, one reason each:".

5. [nit] cross_artifact_consistency — chg-GH-413-spec.md#section 25 document history and validation checklist
   Gap: The iteration-6 remediation is not logged. The history ends at v1.5 and the checklist names the findings of iterations 1 to 4 only.
   Suggested remediation target phase: specification
   Suggested fix: Add a v1.6 row for the iteration-6 remediation and extend the checklist line to iteration 6.

6. [nit] cross_artifact_consistency — chg-GH-413-test-plan.md front matter `last_updated` (line 5), section 2 first bullet (line 51), section 9 revision log
   Gap: The iteration-6 edit to TC-PEAK-027 is not logged: `last_updated` is 14:43:55Z and the revision log ends at v1.6. Section 2 cites the spec as the source of "decisions DEC-1 to DEC-21"; the spec carries 23, and DEC-22 is the decision TC-PEAK-038 step 5 verifies.
   Suggested remediation target phase: test_planning
   Suggested fix: Set `last_updated`, add a v1.7 row, and write "DEC-1 to DEC-23".

## Classification

- No finding blocks. Findings 1 and 2 are minor and wording-only. Findings 3 to 6 are nits.
- Finding 1 is the one worth doing: it is the sentence comment 8 asked to be replaced. Applied verbatim, it also makes the pm-notes note true.
- The six edits make the artifacts agree more and change no requirement, so none needs another pass of this gate. Iteration 8 is not needed.

## What Is Settled

Everything the owner decided is encoded and agrees across the ticket, the spec's requirements, decision and AC, the test plan, the plan and both records: the pre-session refusal before any session, for a resume or a re-dispatch, writing nothing; `dispatch.resume-parked` at exit 2 as the one owner-authorised row with the stated fields and remediation; the single exception in NG-6, NFR-8 and TDR-0077 C-2; the recovery pass meeting only an expired park or none; the one terminate when a failure is seen after the session started; the lost-lease invocation performing no owner act and leaving the successor's lease alone; the row's pins, the documented row and the 19-page set in the plan. No finding reopens any of that.

## Decision Routing

- `needs_human_input`: none.
- `change`: findings 1 to 6, all wording. No decision record is needed.

## Next Remediation Target Phases

None reopens. Delivery may start with the artifacts as they are. The findings can be applied on this branch while delivery runs:

- specification: findings 1 and 5.
- test_planning: findings 2 and 6.
- delivery_planning: findings 3 and 4.

Finding 1 is best applied before `system_spec_update`, which reconciles the feature pages from the spec text.

## Deduplication

- Finding 1 is the residual of iteration-6 finding 1, persistent and reduced from major to minor: the identity is corrected, two clauses are not applied. The pm-notes half is new.
- Finding 2 is the residual of iteration-6 finding 4, persistent at minor: the scenario block is fixed; the section 7 row and the section 2 list are not.
- Findings 3 and 4 are the residual of iteration-6 finding 5, persistent at nit: the page count is fixed; the reference-page declaration is not, and the comment line is a leftover of the same edit.
- Findings 5 and 6 are new. No earlier record named the history rows or the decision range.
- Iteration-6 findings 2 and 3 are resolved and are not repeated.
