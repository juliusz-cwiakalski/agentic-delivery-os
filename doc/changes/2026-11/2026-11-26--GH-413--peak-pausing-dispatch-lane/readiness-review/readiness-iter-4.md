# Readiness Review Iteration 4

Verdict: NOT_READY
Work Item: GH-413
Date: 2026-11-26
Pause Required: yes

The pause is the hand-back this iteration was authorized for. The cap is exhausted and one blocking finding remains. It needs no owner decision on content. The owner decides whether to authorise a further pass or to leave the change parked.

## Facet Summary

- spec_completeness: FAIL
- ac_quality: FAIL
- plan_coverage: PASS
- test_traceability: PASS
- cross_artifact_consistency: FAIL
- decision_capture: PASS
- system_spec_consistency: FAIL
- plan_doc_update_coverage: PASS
- plan_code_area_coverage: PASS
- dod_defined: PASS

Counts: 5 findings (1 major, 3 minor, 1 nit). Finding 1 blocks. Four of the five iteration-3 findings are resolved; the first is resolved for the case it was raised for and leaves one branch open.

## Iteration-3 Disposition

| # | Iteration-3 finding | Status | Where |
|---|---|---|---|
| 1 | Standing park after an abnormal episode end | Resolved for an expired park; one branch open | Occupancy plus the delivered pass gives one active park and one new episode (F-3, AC-F3-4, RSK-14, TC-PEAK-038, plan phase 3), and `dispatch stop` excludes an open park of any cause (F-10, AC-F10-1). The permanent double-park hazard is closed. A standing park whose `until` is still in the future is specified three ways (finding 1). |
| 2 | Lease-id key | Resolved | The key is the live lease's latest heartbeat being the invocation's own last write (F-5, DEC-13, DM-9, NFR-10, section 14, AC-F5-2, TC-PEAK-010, plan phase 2, TDR-0078 C-4 and D4). It holds against the delivered `renewed` arm. Two points of precision remain (finding 2). |
| 3 | Withhold bound stated two ways | Resolved | F-9, DEC-15, RSK-7, Flow 3, AC-F9-4, AC-F10-2, the glossary, TDR-0077 in every place, the index paragraph, the plan and the test plan all say "at least the applied grace plus one observation cadence". The cost (about 50 s per session end) is stated in F-9, section 18, section 22 and the record. The old bound survives only as pm-notes decision 10, a dated entry that decision 15 corrected. |
| 4 | Wake bound | Resolved | NFR-7, DEC-11, plan trigger 5 and the test plan's NFR-7 row use the smaller cadence and exempt the renewal cadence. |
| 5 | Wording and state | Resolved | DEC-21 drops the release-grammar comparison; the admission residual is one cadence plus the applied grace; F-10 counts any cause; both records are tracked; the plan and test plan cite the current versions. |

## Verification Basis

- Ticket unchanged since the iteration-1 live read: open, milestone `M4: Jaiship-native delivery`, three owner comments, last update 2026-11-25T21:08Z.
- `plan validate` returns `verdict=valid`, `readyForDevelopment=true`. All eight phase summaries start lowercase. Of 100 declared paths 69 exist and 31 are new; no existing path is untracked. Both TDR files are tracked.
- Counts: the spec has 33 ACs, 10 NFRs, 9 DMs, 21 decisions and 14 risks. The test plan has 37 TCs and maps 33 of 33 ACs. Every TC is owned by exactly one plan phase, and the test plan's phase column equals the plan.
- Both records are `status: Proposed` with `decision_date: null`. Each numbered decision they carry matches the spec's section 15 text: TDR-0077 for DEC-1, 3, 6, 12, 15, 20 and 21; TDR-0078 for DEC-13, including the stale-own revival, the lost-lease rule and its three settled questions.
- Executed probe over the delivered pure functions, with no file written: a `parked` record whose `until` is in the future evaluates `active` and becomes `resumable` only after `until`, so `recoverQueueParks` recovers it only once it has expired; a `clear-observed` marker evaluates `stuck`, which the pass reports and skips; and a `preserved` park closed by the pass projects a `resumed` frame with an empty `sessionRef` and `branch`.
- Code read for the new mechanisms: `domain/queue-park.ts` (park evaluation, occupancy home), `app/queue.ts` (`recoverQueueParks`, the renewed arm, the release match), `domain/event-projection.ts` (the `resumed` rule), `app/dispatch.ts` (run order: the session is acquired before the first observation), `domain/dispatch-tracker.ts` (ladder waits), `doc/spec/features/feature-projects.md` (the store is per clone, so the pass is repository-wide).

## Findings

1. [major] spec_completeness + ac_quality + cross_artifact_consistency + system_spec_consistency — chg-GH-413-spec.md#F-3, F-4 (last sentence), Flow 3, RSK-14, AC-F3-4 vs chg-GH-413-test-plan.md#TC-PEAK-038 step 5 vs chg-GH-413-plan.yaml#phases[id=3] ("Standing-park recovery") vs TDR-0077 lines 170 and 443-446 vs `packages/core/src/domain/queue-park.ts:143-198`, `packages/core/src/app/queue.ts:2612-2624`
   Gap: One branch of the new rule is specified three ways, and one of the three cannot be built. The branch is a standing park whose `until` is still in the future while the lane runs again: an operator resume, or a re-dispatch, during the window that parked the lane. It is the natural operator action after an orphaned park, which is RSK-3's prescribed route.
   (a) F-4, Flow 3, AC-F3-4, TC-PEAK-038 step 5, TDR-0077 C-6 and D8, and plan phase 3 all say the invocation recovers the park first and then parks again. The delivered pass recovers only a latest park whose condition has cleared. Executed: inside its own window the park evaluates `active`, and `resumable` only after `until`. Nothing is recovered, so nothing can precede a new stop, and occupancy forbids a second park.
   (b) F-3's occupancy sentence and plan phase 3 then let the lane run on: the pass succeeded, the park remains, and the stop is suppressed. The lane bills inside the window while `lanes` and `board` show it `parked:peak-window`. TDR-0077's own driver analysis calls that a failure ("call parked when it is running", line 344).
   (c) The last sentence of F-3, RSK-14 and TDR-0077 D8 say a park that cannot be recovered refuses the run. The plan reads "unrecoverable" as a failure of the pass only. Spec and plan disagree on the outcome.
   (d) Under the refusal reading nothing says when it is decided or what becomes of the session. The pass runs "at the first observation", which is after the resume has started the session, so a refusal there returns from a live session and leaves it without an owner. No identity is named.
   Suggested remediation target phase: specification
   Suggested fix: Choose one outcome for an un-expired standing park and state it once. Either the operator's resume is an override: the park stays as occupancy, the watch issues no stop and no park for the rest of that window, the surfaces say the lane is running, and the park is recovered at the first stop decision or resuming observation after `until`. Or the resume is refused before any session starts, as a pre-session refusal with a delivered identity. Align F-3, F-4, Flow 3, AC-F3-4, RSK-14, TC-PEAK-038 step 5, TDR-0077 C-6 and D8, and plan phase 3 with that choice. For every "refuses the run" outcome, name the identity, decide it before a session is acquired or stop the session through the delivered terminate path with no park written, and forbid returning while a session the invocation started is still live.

2. [minor] ac_quality + cross_artifact_consistency — chg-GH-413-spec.md#F-5, section 14 row 2, section 22 vs TDR-0078 C-5 and D5
   Gap: The two new clarifications are consistent where they speak. The stale-own revival reads the same in F-5, section 12, section 22 and TDR-0078 D4, and it matches the delivered arm: the `renewed` arm does not require a live lease, and a re-dispatch appends a newer heartbeat, which turns the revival into a no-op. The lost-lease rule is consistent for a parked lane across F-5, sections 12, 14 and 22, Appendix D, AC-F5-2, the plan and TDR-0078 D5, including the skip of the holder-only release. Two points are open. First, F-5 and section 14 extend the rule to "a `dispatch stop` it issues, or any owner-state write" while a session is running, and say the invocation "returns one classified result with the park standing". No park stands then, and returning would leave a live session without an owner; TDR-0078 frames the rule at the resume only. Second, "any owner-state write" forbids the terminal lane record and the attempt record that the classified result itself appends, so the sentence contradicts itself.
   Suggested remediation target phase: specification
   Suggested fix: Say what a lost-lease invocation does while its own session is live: it performs no owner act on the lane (no stop, park, restart, resume, renew or release) and never abandons the session. Either it observes until the session ends and then returns with `lease:not-owned`, or it issues one terminate for the session it started, writes no park, and returns. Replace "any owner-state write" with that list, and say the return path still appends its own result records.

3. [minor] decision_capture + plan_doc_update_coverage — chg-GH-413-pm-notes.yaml#decisions[15] (lines 165-174) and the retro at lines 254-262 vs chg-GH-413-spec.md#section 15 and 18, DoD item 6 vs TDR-0077 C-6 and D8
   Gap: pm-notes decision 15 still requires the lease-id key "because a re-dispatch can renew a previous invocation's stale lease", which iteration 3 showed false and v1.3 replaced. No later decision entry supersedes it or records the heartbeat key, the occupancy-with-recovery rule, or the unified withhold. That retro's lesson (b) says "the claim's stale same-holder arm must be amended alongside the renewal", while TDR-0078 C-2 and D6 keep the claim untouched and spec F-5 says the key "needs no change to the claim". In the spec the occupancy-with-recovery rule has no numbered decision, so TDR-0077's C-6 and D8 trace to none, and the section 18 reconciliation list and DoD item 6 omit the standing-park recovery.
   Suggested remediation target phase: specification
   Suggested fix: Add a pm-notes decision that supersedes 15 and records the three iteration-3 remediation decisions, and correct retro (b). Number the occupancy-with-recovery decision in section 15 and point TDR-0077 C-6 and D8 at it. Add the standing-park recovery to the section 18 list and DoD item 6.

4. [minor] system_spec_consistency — chg-GH-413-spec.md#section 8.2 (last sentence), RSK-14, NFR-10, section 22 vs `packages/core/src/domain/event-projection.ts:659-689`, `packages/core/src/app/queue.ts:2564-2668`, `packages/core/src/domain/queue-park.ts:151-156`
   Gap: Four consequences of reusing the delivered pass are not stated. (a) Executed: closing a `preserved` standing park through the pass projects a `dispatch.attempt/resumed` frame with an empty `sessionRef` and `branch` under the original episode id, whether or not a session was resumed. Section 8.2 says only that "the delivered projection's own rules frame it", and TC-PEAK-038 asserts no new kind but not this frame. (b) The pass is repository-wide, so a dispatch lane also closes every other reference's resumable latest park, as a queue mutation does. (c) A recovery whose second append is refused leaves a `clear-observed` marker that the pass reports as stuck and never retries. With occupancy that reference is then suppressed at every later window, and the artifacts name no operator route. (d) NFR-10's "throughout" stands beside unrenewed bounded waits that are neither tracker nor claim waits: the terminate grace, worktree provisioning and handle acquisition. They fit the margin at the defaults and need not at a short TTL.
   Suggested remediation target phase: specification
   Suggested fix: State (a), (b) and (c) in RSK-14 and section 22, and assert (a) in TC-PEAK-038. Scope NFR-10's "throughout" to "between renewals and outside the unrenewed bounded waits", and name them.

5. [nit] ac_quality — chg-GH-413-spec.md#F-5, section 14
   Gap: (a) The ownership check and the `renewed` append should be one fenced step; otherwise a re-dispatch can land between them, and TDR-0078's revisit trigger covers only two writes sharing an instant. (b) F-5 and section 14 say "a `dispatch stop` it issues": the invocation issues the watch's stop, the command is the operator's. (c) Section 14 row 3 cites Appendix D for the tracker and claim wait rule, which Appendix D does not contain.
   Suggested remediation target phase: specification
   Suggested fix: State the fenced step in F-5 and plan phase 2, and correct (b) and (c).

## Owner Escalation

The single blocking issue for the park is finding 1. The standing-park rule closes the permanent double-park for an expired park. It does not say what happens when the park has not expired yet and the operator resumes the lane inside its own window. Three parts of the artifacts give three different answers, the answer in the acceptance criterion cannot be built with the delivered recovery pass, and the refusal answer would return from a live session.

The fix is small and needs no owner decision on content: pick one outcome for that branch, align seven passages, and name the refusal's identity and its point in the run. Findings 2 to 4 are small and can ride the same edit. The owner decides whether to authorise one more gate pass for this set or to leave GH-413 parked.

## Decision Routing

- `needs_human_input`: none on content. The pause is the cap and the hand-back.
- `system`: both records are routed correctly and match the spec's numbered decisions. TDR-0077 C-6 and D8 need a numbered decision to trace to (finding 3), and finding 1's choice must be carried into D8.
- `change`: findings 2, 4 and 5.

## Next Remediation Target Phases

- specification: findings 1 to 5, with TDR-0077 and TDR-0078 updated through the decision advisor.
- test_planning: TC-PEAK-038 step 5 for the chosen outcome, and the `resumed`-frame assertion of finding 4.
- delivery_planning: the phase 3 comment and trigger 18 for the chosen outcome, and the fenced step of finding 5.

## Deduplication

All five iteration-3 findings are checked above and none is repeated as it stood. Finding 1 is the residual of iteration-3 finding 1: that finding's case, the expired park, is resolved; the open branch is the un-expired park that the remediation's own operator-resume clause introduced. Finding 2 is the residual of iteration-3 finding 2. Findings 3, 4 and 5 are new in this iteration.
