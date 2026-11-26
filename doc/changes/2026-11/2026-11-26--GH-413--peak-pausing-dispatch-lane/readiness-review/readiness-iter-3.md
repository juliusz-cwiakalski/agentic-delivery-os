# Readiness Review Iteration 3

Verdict: NOT_READY
Work Item: GH-413
Date: 2026-11-26
Pause Required: yes

The pause is procedural, not a content question. The three-iteration cap is reached with three blocking findings. None of them needs an owner decision on content; all three are fixable by the artifact agents in one pass. What needs the owner is how to proceed past the cap (see Owner Escalation).

## Facet Summary

- spec_completeness: FAIL
- ac_quality: PASS
- plan_coverage: PASS
- test_traceability: FAIL
- cross_artifact_consistency: FAIL
- decision_capture: FAIL
- system_spec_consistency: FAIL
- plan_doc_update_coverage: PASS
- plan_code_area_coverage: PASS
- dod_defined: PASS

Counts: 5 findings (1 critical, 2 major, 1 minor, 1 nit). Findings 1 to 3 block the gate. One is persistent from iteration 2; two are new.

## Iteration-2 Disposition

| # | Iteration-2 finding | Status | Where |
|---|---|---|---|
| 1 | `dispatch stop` against the delivered code | Partially resolved; one part persists and the watch side is open | Already-parked refusal, unconfirmed terminate, the worktree-or-main-checkout tree root and the park-after-confirmed-terminate rule are specified and tested (F-9, F-10, AC-F9-2, AC-F10-1, TC-PEAK-019, TC-PEAK-020, TC-PEAK-035, TC-PEAK-036). The post-collection race is closed in DEC-15 and both ACs but stated two ways (finding 3). The double-park hazard is closed for the command and open for the watch (finding 1). |
| 2 | Pre-session park | Resolved by withdrawal, accepted | DEC-14 withdrawn, NG-10, RSK-12, section 7.2; a one-cadence residual is declared; AC-F1-4, NFR-11 and TC-PEAK-030 are removed. One KPI wording point remains (finding 5b). |
| 3 | Lease cadence relation | Resolved; the key added in its place fails | Cadence `min(lane.liveness-interval, queue.lease-ttl / 2)`, the interval-above-TTL arm and the owner-hold exemption (DEC-13, NFR-10, AC-F5-2, TC-PEAK-010, TDR-0078). The lease-id key does not do what the artifacts claim (finding 2). The wake bound wording is off in one configuration (finding 4). |
| 4 | Non-terminal recovery refusal | Resolved | One returned classified result with the lease released (DEC-18, F-4, F-7, NFR-4, AC-F4-3, AC-F7-1, TC-PEAK-009, TC-PEAK-014). It leaves a standing park, which is finding 1. |
| 5 | Overlap union | Resolved | DEC-20, RSK-13, the first-open-window end and consecutive episodes (the TC-PEAK-006 overlap arm). |
| 6 | Test-plan phase numbering | Resolved | The plan phase column is renumbered to the plan's eight phases; TC-PEAK-010 is split into TC-PEAK-010 and TC-PEAK-037; `dispatch-lease-liveness.test.ts` is named; the factory pointer is corrected. Compared mechanically: 36 TCs, each owned by exactly one phase, the test plan column equal to the plan. Two stale sentences remain (finding 5d). |
| 7 | Lag derivation | Resolved | NFR-6, AC-F3-2, DEC-17, TC-PEAK-007. |
| 8 | Nomination on every active record | Resolved | F-2, DM-2, DEC-16, AC-F2-3, TC-PEAK-031. |
| 9 | Refusal identity | Resolved | DEC-21, AC-F9-3, the plan fence. One wording point remains (finding 5a). |
| 10 | Page count, DoD, TDR phase, wording | Resolved | Eighteen pages in the spec, the plan and DoD item 6; DoD item 7 on the pm-notes hand-off; section 18 wording. New state points are in finding 5d. |

## Verification Basis

- Ticket unchanged since the iteration-1 live read: open, milestone `M4: Jaiship-native delivery`, three owner comments, last update 2026-11-25T21:08Z.
- `plan validate` returns `verdict=valid`, `readyForDevelopment=true`. All eight phase summaries start lowercase. Of 99 declared paths 68 exist and 31 are new; the two TDR files are the only existing untracked paths.
- Counts: the spec has 32 ACs, 10 NFRs, 9 DMs, 21 decisions and 13 risks. The test plan has 36 TCs and maps 32 of 32 ACs.
- Both records are `status: Proposed` with `decision_date: null`. The facts TDR-0078 cites were checked against the code and hold (the defaults, the renewed arm, the holder-only release match, the two independent keys). The facts TDR-0077 cites hold except the withhold bound (finding 3) and one duration (finding 1).
- Executed probe over the delivered pure functions, with no file written: two `parked` records for one ref keep `hasDuplicateActiveParks` true also after a later recovery; with a standing expired park and the next window open, an expiry-aware `parkedRefs` returns one stop decision and an occupancy `parkedRefs` returns none.
- Code read for the new mechanisms: `app/queue.ts` (the renewed arm, the release match, `recoverQueueParks`, the park read), `domain/queue-park.ts`, `domain/daemon-peak-pause.ts`, `cli/src/edge.ts` (the callers of `recoverParksForMutation`), `cli/src/commands/queue.ts` (the refusal identities), `config/defaults.ts`, `config/catalog.ts`, `tests/behaviour/daemon-peak-window-park.test.ts`.

## Findings

1. [critical] spec_completeness + system_spec_consistency + test_traceability — chg-GH-413-spec.md#F-3, F-4, RSK-3, section 7.2, DM-1 vs chg-GH-413-test-plan.md#TC-PEAK-006, TC-PEAK-009, TC-PEAK-037 vs chg-GH-413-plan.yaml#phases[id=3] vs `packages/core/src/domain/daemon-peak-pause.ts:160-208`, `packages/core/src/domain/queue-park.ts:89-102`, `packages/core/src/app/queue.ts:714-729,2564-2668`, `packages/cli/src/edge.ts:7064-7076,7386-7749`, `tests/behaviour/daemon-peak-window-park.test.ts:116-128`
   Gap: The double-park hazard is closed for `dispatch stop` (F-10, AC-F10-1) and open for the watch. `runPeakWatch` appends a park for every stop the decision returns, and its only guard is the `parkedRefs` the composition supplies. No artifact says how the dispatch composition derives it. Three outcomes the spec itself defines leave an expired `parked` record standing for a lane that later runs again: an orphaned park followed by the operator resume RSK-3 prescribes; the refusal return of DEC-18, whose stated follow-up is the operator resume; and restart-budget exhaustion followed by a later dispatch of the ref. Executed against the delivered pure functions: with the delivered reference pattern for `parkedRefs` (un-expired parks only), the next open window returns a stop decision and a second `parked` record is appended, after which `hasDuplicateActiveParks` is true for the store for good, also once the later episode recovers, so every `readQueueParks` fails closed with `state.store.torn` permanently. With occupancy, the lane is skipped at every later window and is never paused again. Under occupancy `dispatch stop` also refuses that running lane as already parked; under an expiry reading of "open" it appends the second park. Nothing on the dispatch path recovers a park: `recoverQueueParks` runs only inside the queue command family's mutations. TDR-0077 D7.4 says a double park degrades the surfaces "until the window ends", and iteration 2 of this review said the same. Both understate it, because the append-only history cannot be repaired.
   Suggested remediation target phase: specification
   Suggested fix: State the watch's already-parked rule as occupancy (any standing `parked` `peak-window` record for the ref, whatever its `until`), and require the invocation to close an expired standing park through the delivered mutating park pass (`recoverQueueParks`: clear-observed marker, recovered record, `park-auto-recovery` incident) before its first stop decision for the ref and at the first observation of an invocation that resumes such a lane. Say what an operator resume during an open window does. Then add a standing-expired-park arm to TC-PEAK-006, TC-PEAK-009 and TC-PEAK-037 (next window: one active park, the lane is paused), name the pass in plan phase 3, and correct TDR-0077 D7.4.

2. [major] system_spec_consistency + cross_artifact_consistency + test_traceability — chg-GH-413-spec.md#F-5, DEC-13, DM-9, NFR-10, section 14 ("Open Questions: None") vs chg-GH-413-plan.yaml#header fence, phases[id=2], trigger 9 vs chg-GH-413-test-plan.md#DM-9, TC-PEAK-010 steps 4 and 5, section 8.2 vs TDR-0078 lines 94, 211, 334, 393-395 vs `packages/core/src/app/queue.ts:2189-2211`
   Gap: The renewal's ownership key is the lease id acquired at admission, and the spec, plan and test plan claim it stops a re-dispatch from renewing "a previous invocation's stale lease under the same holder and reference". The delivered `renewed` arm preserves `leaseId` and `acquiredAt`, and a re-dispatch against a stale same-holder lease takes that arm, so the earlier invocation's lease id is still current afterwards. TDR-0078 records this as an executed fact ("the lease identity is preserved across all four, so it does not by itself tell two invocations apart"), rates the key TO-CONFIRM, and lists it as its first Unresolved Question. The spec says there are none. TC-PEAK-010's re-dispatch arm presupposes that "the earlier invocation's lease id is no longer current", which the delivered claim does not produce, so a Critical arm of AC-F5-2 cannot pass without a faked takeover. Plan trigger 9 carries the same false parenthetical. After a renewal outage longer than the TTL and a re-dispatch, the earlier invocation would keep renewing, and on exit release, the successor's lease. TDR-0078's other two open questions are also delivery-shaped: what a no-op renewal surfaces and whether the invocation resumes on a lease it no longer holds, and renewals around the run's bounded waits.
   Suggested remediation target phase: specification
   Suggested fix: Name a key that survives the delivered arm, for example the lease's latest heartbeat being the invocation's own last write, and say whether a stale untaken lease is still the lane's own. Settle TDR-0078's three open questions in the spec or record them as the spec's open questions. Rewrite TC-PEAK-010's re-dispatch arm from the delivered semantics, and align DEC-13, plan trigger 9 and TDR-0078.

3. [major] decision_capture + cross_artifact_consistency (PERSISTENT: iteration-2 finding 1, part b, partially remediated) — chg-GH-413-spec.md#F-9 vs #DEC-15, RSK-7, Flow 3, AC-F9-4, AC-F10-2, section 23 vs TDR-0077 lines 8, 13, 170, 232, 326-330, 408, 426, 443, 455, 466, 483 vs `doc/decisions/00-index.md:204` (committed)
   Gap: The post-collection withhold is stated two ways. Decision 15 corrected it to "at least the applied grace plus one observation cadence", and DEC-15, RSK-7, Flow 3, both ACs, the glossary, the plan and the test plan carry that. The superseded "up to one observation cadence" remains in the spec's capability text F-9, in eleven places of TDR-0077 (its summary, business impact, the hard constraint C-7 marked Negotiable: no, D7.10, the attestation, a negative outcome, the implementation plan, a verification metric) and in the committed index paragraph. TDR-0077 rests the one-cadence bound on an assumption it rates Medium and lists "the withhold window against the applied grace" as an Unresolved Question, which is the question DEC-15 already decided. The record the owner is asked to accept therefore documents a weaker rule than the ACs will test, and the weaker rule misses the park whenever the kill grace is at or above the cadence. The spec is also silent on the cost of the corrected rule: every session end, with pausing disabled too, returns at least the applied grace plus one cadence later (about 50 s at the defaults). TDR-0077 states that cost with the old number.
   Suggested remediation target phase: specification
   Suggested fix: Align F-9, the eleven places in TDR-0077 and the index paragraph to DEC-15, close TDR-0077's second Unresolved Question, and state the result-latency cost in the spec with the right number.

4. [minor] ac_quality — chg-GH-413-spec.md#NFR-7, DEC-11 vs chg-GH-413-plan.yaml#trigger 5 vs TDR-0078 D2
   Gap: When `queue.lease-ttl / 2` is below `lane.liveness-interval`, TDR-0078 D2 has the heartbeat wake at half the TTL between observations. NFR-7 still bounds wakes by "elapsed time / cadence + 1" on the liveness cadence, DEC-11 says the wait "wakes at most once per delivered cadence", and plan trigger 5 stops the lane on "a second cadence". A correct implementation fails the first two readings in that configuration and can trip the third.
   Suggested remediation target phase: specification
   Suggested fix: Express the wake bound with the smaller of the two cadences, and exempt the derived renewal cadence in trigger 5.

5. [nit] cross_artifact_consistency — wording and state
   Gap: (a) F-9, AC-F9-3, DEC-21 and TC-PEAK-034 say the missing-end refusal reuses `until-required` "as the delivered expiry-carrying release grammar does"; the release grammar emits that reason under `fallback.invocation` (`packages/cli/src/commands/queue.ts:331-337`). The dispatch identity `input.value.rejected` with the delivered reason is the plan's stated intent and is sound; only the comparison is wrong. (b) The KPI "no billable call after the first observation" ignores calls already in flight that complete during the stop grace; the admission residual is one cadence plus the applied grace, and NFR-3 counts from the park instant. (c) The `dispatch stop` already-parked predicate names only `peak-window` parks, while the delivered duplicate invariant counts any cause. (d) Both TDR files are untracked while the committed index already carries their rows and a paragraph describing them; plan phase 1 stages them, so this heals itself. Stale wording remains in spec section 18 ("authored in plan phase 2"), in the plan header (test plan v1.2; it is v1.3), and in the test plan (section 2, "Its revised version follows this plan's phase ownership"; section 3.1, "plan v1.1").
   Suggested remediation target phase: specification
   Suggested fix: Correct (a), (b) and the section 18 phrase in the spec, (c) in F-10, the plan header in the plan, and the two test plan sentences.

## Owner Escalation

The cap is reached with three blocking findings. None needs an owner decision on content: all three are fixable by the artifact agents in one pass (one spec revision, two record syncs, one test plan revision). The owner decides how to proceed past the cap.

- **Recommended: authorise one more gate pass for exactly findings 1 to 3.**
- **Alternative: accept delivery with the three risks recorded.** This should not be chosen for finding 1. On the reference host the first orphaned park, followed by the operator resume the spec prescribes, leads at the next daily window either to a permanent failure of every park-reading surface in the store or to a lane that is never paused again.

If a single issue is escalated, it is finding 1.

## Decision Routing

- `needs_human_input`: none on content. The pause is the iteration cap.
- `system`: TDR-0077 and TDR-0078 are routed to the decision advisor correctly. Both must be brought in line with the spec after the fixes; TDR-0078 is the more accurate of the two on the lease key and the spec should move toward it.
- `change`: findings 4 and 5.

## Next Remediation Target Phases

- specification: findings 1 to 5 (the spec parts, and the two records through the decision advisor).
- test_planning: the arms in findings 1 and 2, and the two sentences in finding 5.
- delivery_planning: the plan phase 3 comment (finding 1), trigger 9 (finding 2), trigger 5 (finding 4), the header (finding 5).

## Deduplication

Finding 3 is persistent from iteration 2 (its finding 1, part b). Findings 1 and 2 are new in this iteration and both come out of the iteration-2 remediation: finding 1 is the watch-side twin of the double-park hazard that iteration 2 closed for the command only, and finding 2 is the key that remediation added for iteration-2 finding 3. Findings 4 and 5 are new and small. This record corrects iteration 2's statement that a double park degrades the surfaces "until the window ends". The other eight iteration-2 findings are resolved and are not repeated.
