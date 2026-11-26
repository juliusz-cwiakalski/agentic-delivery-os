# Readiness Review Iteration 2

Verdict: NOT_READY
Work Item: GH-413
Date: 2026-11-26
Pause Required: no

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

Counts: 10 findings (1 critical, 5 major, 3 minor, 1 nit). Findings 1 to 6 block the gate. Two are persistent from iteration 1 (its findings 4 and 14, both partially remediated).

## Iteration-1 Disposition

| # | Iteration-1 finding | Status | Where |
|---|---|---|---|
| 1 | Rule source and deployment precondition | Resolved; pause lifted | DEC-12, RSK-9, section 12, section 18, KPI basis, DoD item 8; verified against `.jaiship/config.yaml:113-117,146-150` |
| 2 | Lease liveness through the park | Resolved in substance | F-5, DEC-13, NFR-10, DM-9, AC-F5-2, TC-PEAK-010, plan phase 2, TDR-0078; one new residual is finding 3 |
| 3 | Composition-fact mode | Resolved | DEC-6, section 8.5, NFR-9, AC-F6-3, AC-F6-4, TC-PEAK-033; a pointer nit is in finding 10 |
| 4 | Operator stop | Partially resolved, persistent | Cause set, `--until`, success output, run path and adapter scope are done; the rest is finding 1 |
| 5 | Stored nomination | Resolved | DEC-16, DM-2, AC-F2-3, TC-PEAK-031; a minor point is finding 8 |
| 6 | Parked-lane verdict | Resolved | DEC-9, the F-6 table, AC-F6-5, TC-PEAK-011, RSK-3 |
| 7 | Window already open at start | Resolved in intent | DEC-14, AC-F1-4, NFR-11, TC-PEAK-030; new gaps are finding 2 |
| 8 | Stop mechanics and bounds | Resolved in substance | DEC-5, DEC-17, NFR-1, NFR-6, TC-PEAK-032; a residual minor is finding 7 |
| 9 | Real-episode placement | Resolved | TC-PEAK-029 is the hand-off; plan phase 8 `doneArtifacts` no longer carries the episode |
| 10 | Definition of Done | Resolved | Section 18.1, eight items; wording nits are in finding 10 |
| 11 | Page set | Resolved | Sixteen pages plus two in plan phase 8; the `operation-count-pages` pin map is scoped |
| 12 | Decision scope | Resolved | TDR-0077 carries DEC-1, 3, 6, 12, 14, 15; TDR-0078 carries DEC-13; DEC-8 and DEC-9 are justified |
| 13 | Delivery note 4 | Resolved | Plan header fence and trigger; test plan sections 1.1, 6 and 7 |
| 14 | Non-terminal recovery refusal | Partially resolved, persistent | Now stated three incompatible ways; finding 4 |
| 15 | Activity-keyed liveness | Resolved | RSK-2, DEC-19, section 12, section 18, TC-PEAK-029 precondition |

## Verification Basis

- Ticket unchanged since the iteration-1 live read: open, milestone `M4: Jaiship-native delivery`, three owner comments, last update 2026-11-25T21:08Z.
- Pause question. The tracked `.jaiship/config.yaml` declares `peakWindows` on both members of the preference chain, `delivery` (lines 113 to 117) and `paid` (lines 146 to 150): 01:00 to 04:00Z and 06:00 to 10:00Z, with `graceSeconds: 300` inside the derived maximum of 300. The incident's 07:22Z commit falls inside the second window's buffer-inclusive interval. Nothing needs the owner for this gate. The two record acceptances and the liveness relaxation are owner acts at or after the pull request.
- `plan validate` returns `verdict=valid`, `readyForDevelopment=true`. All 65 existing paths the plan declares are present and every new path is absent. TDR-0077 and TDR-0078 are free. All 36 test files the test plan names are in some plan phase scope.
- Counts checked: 33 ACs, 11 NFRs, 9 DMs, 19 decisions, 11 risks, 36 TCs, 33 of 33 ACs mapped.
- Code read for the new mechanisms: `app/queue.ts` (park read validator, claim function), `domain/event-projection.ts`, `domain/daemon-peak-pause.ts`, `domain/queue-lease.ts`, `adapters/src/harness/opencode.ts` (terminate), `app/dispatch.ts` (post-collect path), `domain/dispatch-operator-view.ts`, `provider/peak-rules.ts`, `tests/fixtures/queue/production/harness.ts`, `tests/checks/decision-record.test.ts`, `tests/checks/operation-count-pages.test.ts`, `tests/checks/owner-hold-doc.test.ts`.

## Findings

1. [critical] cross_artifact_consistency + system_spec_consistency + spec_completeness (PERSISTENT: iteration-1 finding 4, partially remediated) — chg-GH-413-spec.md#F-9, F-10, AC-F9-2, AC-F10-1, AC-F10-2, RSK-7 vs chg-GH-413-test-plan.md#TC-PEAK-019, TC-PEAK-020, TC-PEAK-035, TC-PEAK-036 vs chg-GH-413-plan.yaml#phases[id=5] vs `packages/core/src/app/queue.ts:714-729`, `packages/adapters/src/harness/opencode.ts:795-833`, `packages/core/src/app/dispatch.ts:1205-1228`
   Gap: The `peak-window`-only cause set with `--until`, the success output (DM-8, AC-F9-4), the run path and adapter scope, and the profile from the stored nomination are resolved. Four parts are not.
   (a) An already-parked lane. "Running" is an `active` record with a session identity. A peak-parked lane's newest record is exactly that, because the park is not a lane state. So `dispatch stop` on a parked lane, or a second `dispatch stop`, is admitted; the session is already stopped, nothing is signalled, and F-9 then writes a second `parked` record. Two concurrently active parks for one ref make `readQueueParks` fail closed with `state.store.torn`, which degrades every park-reading surface (`lanes` `parkClaimed`, the status collectors, the spend evidence's profile lookup) until the window ends. No AC or TC has an already-parked arm.
   (b) The invocation side of the hand-off. The command appends the park after its terminate call returns, and the delivered terminate awaits the whole composed grace (`opencode.ts:832-833`). The owning invocation's `collect` resolves as soon as the session exits after TERM, and the delivered loop classifies at once (`dispatch.ts:1205-1228`). In the common ordering the invocation therefore sees a session end with no park record on disk, classifies, appends the terminal lane record and returns, and the command then lands an orphaned park on a terminal lane. "Re-reads the record at its next observation" presumes an observation after session end; the loop has none. RSK-7's "record-first decision" is a command-side rule. TC-PEAK-035 step 3 and TC-PEAK-036 model only orderings in which the park record already exists.
   (c) An unknown session. AC-F9-2 and TC-PEAK-019 treat it as success and F-9 then writes the complete frame. A stale `active` record whose session is gone (a crash, or an orphaned park under RSK-3) therefore yields exit 0 with `stop` and `parked` frames for a stop that never happened, against F-10's "never a phantom episode".
   (d) "By session identity and recorded worktree path": a `lane.disable-worktrees` lane record carries no worktree path.
   Suggested remediation target phase: specification
   Suggested fix: Define running as an `active` record with a session identity and no open park, so an already-parked lane is the not-running refusal. Map "no live exact identity matched" to the same refusal, and keep "unknown session is success" for the terminate operation alone. Specify the ordering that closes (b): either the command appends the park before the terminate, or the invocation withholds classification at session end for one bounded interval and re-reads the park record. Accept the path-less in-checkout shape. Then add the arms to TC-PEAK-019, TC-PEAK-020, TC-PEAK-035 and TC-PEAK-036, including "session end observed before the park record is durable".

2. [major] system_spec_consistency + spec_completeness — chg-GH-413-spec.md#DEC-14, F-1, DM-1, section 8.2, NFR-2, NFR-11, AC-F1-4 vs chg-GH-413-test-plan.md#TC-PEAK-030 vs chg-GH-413-plan.yaml#phases[id=3] vs `packages/core/src/domain/event-projection.ts:659-689`, `packages/core/src/domain/daemon-peak-pause.ts:345-351,481-487`, `packages/core/src/domain/dispatch-operator-view.ts:43-50`
   Gap: The new pre-session park cannot be expressed as specified inside the fenced layer.
   (a) Closure. The park carries `preservation: preserved`, projects the `park-edge` alone, and section 8.2 promises no `resumed`. The delivered projection, which the plan composes unchanged, emits `resumed` for any recovered `peak-window` record whose preservation is `preserved`. Closing the park at the first start emits a `resumed` frame for a session that never existed; not closing it leaves a `parked` record standing for the lane's whole life.
   (b) The resume half. `runPeakResume`, also composed, routes a `preserved` park to the session-resume path and skips it when no session reference resolves, so a session-less park is never resumed. A record without `preservation` routes to the interrupted recovery and consumes a restart ordinal. Neither is "the first session starts at the effective end".
   (c) Visibility. Before the first acquisition no `dispatch.lane` record exists, so `dispatch status <ref>` answers `marker: absent` and `dispatch is-delivering <ref>` answers false for the whole pre-session park. On the tracked rules the lane-watch interval runs from 00:30Z to 10:10Z. Ticket requirement 6 asks `dispatch status` to report the park and the window's end; AC-F1-4 and TC-PEAK-030 do not assert it.
   Suggested remediation target phase: specification
   Suggested fix: Choose a representation the fenced layer can express, for example a pre-session park with no `preservation` member, closed by the invocation's own first-start step rather than by the resume half, and amend DM-1, NFR-11 and AC-F1-4 to match. State the `dispatch status` and `is-delivering` answers during a pre-session park. Add those assertions and the closure assertion to TC-PEAK-030.

3. [major] spec_completeness + ac_quality + system_spec_consistency — chg-GH-413-spec.md#F-5, DEC-11, DEC-13, NFR-7, NFR-10, AC-F5-2, Appendix D vs chg-GH-413-plan.yaml#phases[id=2] vs `packages/core/src/config/catalog.ts:846`, `packages/core/src/domain/queue-lease.ts:54`, `packages/core/src/app/queue.ts:2087-2272`
   Gap: The lease invariant rests on an unstated relation between two independent operator keys. Renewal happens once per wake at `lane.liveness-interval`, so the heartbeat reaches the TTL between wakes whenever that interval is at or above `queue.lease-ttl`. A second dispatch is then admitted through the same-holder renewal arm, the outcome DEC-13 exists to prevent. Nothing states, validates or tests the relation. The tracked config sets neither key, so the defaults hold on the reference host and NFR-10's "throughout" is true only for them. Two smaller points on the same path: the renewal is described as "over the delivered same-holder `renewed` arm", but the delivered claim function without the no-renewal flag also acquires an absent lease, takes over a stale one, and refuses when given an active owner hold, which F-11 says must not affect a parked lane. No trigger or test arm confines the renewal to `renewed`.
   Suggested remediation target phase: specification
   Suggested fix: State and validate the precondition, or bound the renewal by the delivered `renewalCadenceMs`. State that the renewal is a no-op unless the lease is this lane's own same-ref lease, and that it does not pass the owner-hold gate. Then add an interval-above-TTL arm to TC-PEAK-010, the hold case to TC-PEAK-021, and a trigger to the plan.

4. [major] ac_quality + cross_artifact_consistency (PERSISTENT: iteration-1 finding 14, partially remediated; raised from minor) — chg-GH-413-spec.md#F-4, NFR-4, AC-F4-3, AC-F7-1, section 12 "Bounded wait", section 22 vs chg-GH-413-test-plan.md#TC-PEAK-009, TC-PEAK-014
   Gap: The outcome of a non-terminal recovery refusal is now stated three incompatible ways. F-4 and NFR-4 keep the invocation waiting and re-evaluating ("no further attempt ... in that observation"). AC-F4-3, TC-PEAK-009 and TC-PEAK-014 read the refusal "in the invocation's bounded episode fact", which exists only on a returned result. Section 12 and section 22 call the operator resume path "the way forward", but under DEC-13 a waiting invocation holds a live renewed lease, so `dispatch <ref> --resume-prompt` is refused `queue.single-flight` until that invocation is gone. If the invocation returns, the result's token, exit and summary for this arm are unspecified, and F-7's "paused and resumed" summary does not fit.
   Suggested remediation target phase: specification
   Suggested fix: Decide and state one outcome. If the invocation returns, name the delivered result shape, and say the lease is released and the lane stays parked for the operator resume. If it waits, say how the operator ends it. Align AC-F4-3, AC-F7-1, NFR-4, section 12 and section 22, and TC-PEAK-009 and TC-PEAK-014.

5. [major] system_spec_consistency + cross_artifact_consistency — chg-GH-413-spec.md#F-2 ("enforcement unions the intervals and the park's end is the effective end of the contiguous open interval"), DEC-12 vs chg-GH-413-test-plan.md#section 6 test data ("a profile with overlapping windows for the union assertion") vs chg-GH-413-plan.yaml#header fence vs `packages/core/src/domain/daemon-peak-pause.ts:102-140`, `.jaiship/config.yaml:116-117`
   Gap: The composed decision function does not union. `peakWindowOpenAt` returns the first open window's own effective end, and the function is fenced outside every scope. On the tracked profile `delivery` the two windows overlap in effect from 04:00Z to 04:05Z, so a lane parked by the first window resumes at 04:05Z and is stopped again within one cadence and parked until 10:10Z: two episodes and a short resume, where the spec promises one park to the contiguous end. A test asserting the union, as the test plan's fixture list announces, would fail against the fence and stop the lane.
   Suggested remediation target phase: specification
   Suggested fix: Restate F-2 as the delivered first-match behaviour, record the overlap churn as a known consequence in RSK and in the hand-off expectations, and drop the union assertion from the test plan's fixture list. Changing the decision layer instead would amend NG-1 and needs its own decision.

6. [major] cross_artifact_consistency — chg-GH-413-test-plan.md#section 2 line 51, section 3.1 ownership paragraph, section 5.1 "Plan Phase" column, section 7 TC-PEAK-010 row vs chg-GH-413-plan.yaml#header crosswalk, phases[id=2], phases[id=3]
   Gap: Judged not acceptable as it stands. The offset alone would be a sound crosswalk: for 35 of 36 TCs, test-plan phase n (n of 2 or more) is plan phase n+1, and each plan phase lists its own TC ownership. Three things break it. (1) The test plan asserts the opposite authority ("the revised plan follows this mapping; this plan invents no phase"; "each TC is owned by one plan phase"), while the plan states the test plan's numbering predates the lease phase. (2) TC-PEAK-010: the test plan owns it in its phase 2, the watch phase (plan phase 3), with the single file `dispatch-peak-preservation.test.ts` and steps that park the lane before crossing the TTLs. The plan owns its lease arms in plan phase 2, where no park exists, in `tests/behaviour/dispatch-lease-liveness.test.ts`, a file the test plan never names. The test plan's execution command for TC-PEAK-010 does not run the lease-liveness suite, and AC-F5-2's steps cannot run in the phase the plan schedules them. (3) The test plan says implementation follows the spec's delivery order, which places the lease renewal after the watch; the plan places it first.
   Suggested remediation target phase: test_planning
   Suggested fix: Renumber the Plan Phase column and the ownership paragraph to the plan's eight phases, or replace them with a pointer to the plan's crosswalk. Split TC-PEAK-010 into a running-lane lease TC (plan phase 2, `dispatch-lease-liveness.test.ts`) and a parked-lane TC (plan phase 3), or describe both parts with their files and their order. The duplicate TDR-0078 declaration in plan phases 2 and 7 is sound and needs no change: multi-phase files are declared in every phase that touches them, `plan validate` passes, and no check requires index contiguity.

7. [minor] ac_quality (PERSISTENT: iteration-1 finding 8, residual) — chg-GH-413-spec.md#AC-F3-2, NFR-6, DEC-17, DM-1 vs chg-GH-413-test-plan.md#TC-PEAK-007 vs `packages/core/src/domain/daemon-peak-pause.ts:250-276`
   Gap: The bounds are now consistent, but the derivation is not. The composed `runPeakWatch` stamps `stoppedAt` after the stop resolves, so the record's stop instant is the park instant, and the window-open observation is not recorded. "The stop request landed within one cadence, derived from `stoppedAt`" therefore measures observation to park, which already contains the applied grace. The "park no later than stop plus grace" half is vacuous on the record, and with a kill grace above the cadence the first bound reads as violated while the behaviour is correct.
   Suggested remediation target phase: specification
   Suggested fix: State the one bound the record can prove: the park instant is no later than the window-open observation plus the applied grace, with the observation instant taken as `graceDeadline` minus the profile grace. Let the tests take the stop-request instant from the stop seam and say so in TC-PEAK-007.

8. [minor] spec_completeness — chg-GH-413-spec.md#F-2, DM-2, DEC-16, AC-F2-3 vs chg-GH-413-test-plan.md#TC-PEAK-031
   Gap: "Written at the lane's first acquisition" meets latest-wins reads. The lane resolver, `dispatch status` and `dispatch stop` read the newest record, and every restart iteration and every post-park resume appends a new `active` record. If only the first record carries the nomination, a stop after a restart or a resume reads none, and AC-F9-1's profile cannot be produced.
   Suggested remediation target phase: specification
   Suggested fix: Say that every `active` record the invocation appends carries the nomination. Add a post-restart read to TC-PEAK-031.

9. [minor] spec_completeness — chg-GH-413-spec.md#AC-F9-3, NFR-8, DEC-8 vs chg-GH-413-plan.yaml#header fence
   Gap: The refusal for a disallowed cause or a missing `--until` is "the delivered classified identity", unnamed. The plan's fence lists only `queue.precondition.unmet` and `config.value.invalid`. The delivered precedent for this shape, `queue release --park` with a missing `--until`, is the invocation refusal `until-required`. An implementer could add a reason token, which NFR-8 and DEC-8 forbid.
   Suggested remediation target phase: specification
   Suggested fix: Name the identity and the reused reason for AC-F9-3, and correct the plan's fence list.

10. [nit] cross_artifact_consistency — wording and pointers
    Gap: (a) Test plan section 2 and the TC-PEAK-033 target attribute the production composition factory to `peak-pause-composed-edge.test.ts`; that file uses the test composition and the override. The factory is `tests/fixtures/queue/production/harness.ts` (the real `createProductionComposer`), which the plan names. (b) DoD item 6 and spec section 16 count sixteen pages; the plan reconciles eighteen, adding `feature-config-layer.md` (the key's current-truth home) and `engine-first-operations.md`. (c) DoD item 7 makes "the pull request records the hand-off" a Done criterion, and `dod_check` precedes `pr_creation`. (d) Spec section 18 says TDR-0078 is recorded "before delivery"; the plan authors it in plan phase 2, inside lifecycle delivery. (e) Spec section 16 and plan phase 8 list "the owner-hold one-writer sentence" as a reason to reconcile `feature-scheduling-engine.md`; with a `peak-window`-only stop that sentence stays true, and `tests/checks/owner-hold-doc.test.ts` pins its phrases. (f) Plan phase 1 pre-declares `readiness-iter-3.md`; readiness records are tracked before delivery (iteration 1 already is), so the declaration is inert.
    Suggested remediation target phase: specification
    Suggested fix: Correct (b), (c) and (d) in the spec, (a) in the test plan, and (e) in both the spec and plan phase 8. Drop (f) or leave it.

## Decision Routing

- `needs_human_input`: none. The iteration-1 pause is lifted by the tracked configuration fact.
- `system`: TDR-0077 and TDR-0078 are correctly routed through the decision advisor. Finding 5 needs no record if the spec is restated; changing the decision layer instead would amend NG-1 and would need one.
- `change`: all other fixes are change-local.

## Next Remediation Target Phases

- specification: findings 1 to 5, 7, 8, 9, and 10 (b) to (e).
- test_planning: finding 6, finding 10 (a), and the test arms named in findings 1 to 5, 7 and 8.
- delivery_planning: the trigger named in finding 3 and the phase 8 reason in finding 10 (e).

## Deduplication

Findings 1 and 4 are persistent from iteration 1 (its findings 4 and 14); each records what the remediation resolved and what remains. Finding 7 is the residual of iteration-1 finding 8. Findings 2, 3, 5, 6, 8, 9 and 10 are new in this iteration: 2 and 3 arise from the remediation itself, 5 was present in v1.0 and becomes material now that DEC-12 cites the tracked rules. The other twelve iteration-1 findings are resolved and are not repeated.
