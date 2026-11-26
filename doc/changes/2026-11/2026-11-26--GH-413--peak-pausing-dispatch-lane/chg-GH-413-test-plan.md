---
id: chg-GH-413-test-plan
status: Updated
created: 2026-11-26T10:13:20Z
last_updated: 2026-11-26T22:31:44Z
owners: ["engineering"]
service: delivery-os
labels: [change, m4, peak-pausing, dispatch, lane-lifecycle, config]
version_impact: minor
summary: "Test design for GH-413 v1.5 peak pausing for a lane started by dispatch: the life-long dispatch-owned window watch over the nominated profile's declared peakWindows rules read from every active durable lane record, the first-open-window end, the standing-park recovery and occupancy rule before a new episode, the composed-grace stop and exactly-once park, the in-invocation wait with lease renewal at min(lane.liveness-interval, queue.lease-ttl / 2) keyed on the invocation's own last heartbeat write, the classification-routed resume, the returned classified refusal result, the additive status and result facts, the configuration-derived composition mode, the disabling key, the peak-window-only operator stop with its confirmed-terminate, any-open-park already-parked predicate, post-collection re-read, success and race contracts, owner-hold precedence and per-profile isolation, and the zero-spend evidence. The pre-session park is out of scope with a declared one-cadence-plus-applied-grace residual. All fixtures are hermetic over an injected clock, delay, transport, and lease clock; every one of the 33 acceptance criteria is traceable to a named test case and each TC is owned by one plan phase."
links:
  change_spec: ./chg-GH-413-spec.md
  implementation_plan: ./chg-GH-413-plan.yaml
  testing_strategy: .ai/rules/testing-strategy.md
---

# Test Plan - M4-S42: Peak pausing for a lane started by dispatch: it stops at the window's start and resumes at the window's end

## 1. Scope and Objectives

This plan protects the core behaviour of GH-413 v1.5: a lane started by the one-shot `dispatch` invocation is watched for its whole life by that invocation; before its first stop decision it recovers any standing `peak-window` park for the reference through the delivered mutating park pass, treats a remaining standing park as occupancy, parks with the composed-grace stop at the first open window's start, keeps its lease live through the run and park at the derived renewal cadence keyed on its own last heartbeat write, waits until the first open window's effective end, resumes the same session on the same branch and in the same worktree, or returns one classified refusal result when the not-preserved recovery refuses, and returns one result whose summary states the outcome. It also protects the nomination carried on every active lane record, the configuration-derived composition mode, the `peak-window`-only operator command `dispatch stop <ref>` with its confirmed-terminate, any-open-park already-parked predicate, post-collection re-read, success and race contracts, the classified not-running refusal, the disabling key, owner-hold precedence, per-profile isolation, and the falsifiable zero-spend claim.

The highest-integrity risks are: (1) two compositions drifting into different answers for the same lane and instant (RSK-8, AC-F1-1); (2) a second park for one reference permanently degrading every park-reading surface through the delivered duplicate invariant (RSK-14, AC-F3-4); (3) a duplicate or missing episode frame across many observations (NFR-2); (4) a lost branch, change folder, phase, or queue state and a second session for the work item (NFR-4, NFR-10, AC-F5-1, AC-F5-2); (5) a second kill path, a phantom park after an unconfirmed terminate, or an escalation that outlasts the window buffer (NFR-1, AC-F3-3, AC-F9-2, AC-F10-1); (6) a zero-spend claim that cannot fail (AC-F12-2); (7) a disabled setting that silently reintroduces peak spend (RSK-5, AC-F8-1); (8) a mode fixture that passes through a test override instead of the production composition (RSK-11, AC-F6-4); and (9) a park that lands after the owning invocation's collection resolves and is missed (RSK-7, AC-F9-4, AC-F10-2). Everything runs hermetically over the injected clock, delay, transport, and lease clock. No live network, real sleep, or credential read participates in the automated gate (NFR-5, NFR-7).

### 1.1 In Scope

- Every acceptance criterion in the change specification section 17: all 33, AC-F1-1 through AC-F12-2, each mapped to at least one named test case in section 3.1.
- Every functional capability F-1 through F-12, every data-model element DM-1 through DM-9, and every non-functional requirement NFR-1 through NFR-10, mapped in sections 3.2 and 3.3.
- The standing-park recovery and occupancy rule before a new episode (AC-F3-4, DM-1, RSK-14), the durable lane-record nomination on every active record (AC-F2-3, DM-2), the first-open-window end and the declared overlap churn (AC-F2-1, DEC-20, RSK-13), the composed-grace stop and the observation-to-park bound (AC-F3-3, AC-F3-2, NFR-1, NFR-6), the terminal budget-exhaustion refusal and its reachable result shape (AC-F4-3), lease liveness at `min(lane.liveness-interval, queue.lease-ttl / 2)` across several TTLs including an interval-above-TTL configuration, keyed by the invocation's own last heartbeat write with the re-dispatch and `lease:not-owned` arms (AC-F5-2, NFR-10, DM-9), the production composition mode (AC-F6-4, DM-7), the three parked-lane probe arms (AC-F6-5), the `peak-window`-only stop with its grammar refusals, confirmed terminate, any-open-park already-parked and unconfirmed-terminate refusals, the grace-plus-cadence post-collection re-read, success output and race (AC-F9-1, AC-F9-2, AC-F9-3, AC-F9-4, DM-8, AC-F10-1, AC-F10-2), and the rewritten byte-identical carve-out (AC-F6-3, NFR-9).
- The deliberately distinct episode frame written by the dispatch-owned watch and by `dispatch stop` (a complete watcher-shaped frame), and the untouched operator-shaped minimal frame of the release grammar (DEC-7). No pre-session frame exists because the pre-session park is out of scope.
- The intentional supersession of the daemon-absent degradation statement (DEC-1) and the configuration-derived, two-value composition fact with its one intended value change (DEC-6), asserted at the observable read rather than as documentation text.
- The owner delivery notes: (1) the change's changeset exists before the first gate run (TC-PEAK-028); (2) affected tests run during implementation and the full battery once at the gate (section 7); (3) the behavioural proof is fixtures with an injected clock and transport plus one real post-upgrade episode observed by the reference host on the next lane, whose hand-off and preconditions are recorded in the pm-notes and carried into the PR (TC-PEAK-029); (4) delivery never searches the file system outside the checkout and the change folder.
- Hermeticity, determinism, vocabulary economy, and additive-read bounds as first-class checks, not incidental properties.

### 1.2 Out of Scope & Known Gaps

- Any change to the resident daemon's supervision cycle, watch cadence, park, or resume behaviour (NG-1). The daemon suites are only read for parity and regression, never re-specified here.
- Parallel lanes or multi-lane concurrency (NG-2), weekday or calendar-aware windows (NG-3), resident or always-on dispatch (NG-4), and shell-orchestrator work (NG-5).
- Any new park cause, event kind, record kind, schema identity, error identity, result token, or second kill path (NG-6). The plan asserts the closed sets unchanged instead.
- A read surface for a declared or open window as an object, and any provider quota or provider API query (NG-7).
- Any change to provider-entry admission gating, any participation of profile `peakWindows` in eligibility or admission, or any change to the nomination rule (NG-8); and any participation of provider-entry `peak` windows in the lane watch (NG-9).
- **A park before the first session (NG-10, DEC-14 withdrawn).** A dispatch admitted while its nominated profile's window is already open spawns and is parked at the first observation, so at most one observation cadence (`lane.liveness-interval`, 30 000 ms default) plus the applied grace of billing precedes the park (RSK-12, spec section 7.2). No test case asserts a pre-session representation; the residual is declared, not tested.
- `dispatch stop` for any cause other than `peak-window`, and manual resume of an operator-stopped lane before its declared end (spec section 7.2).
- Automatic recovery after the dispatch process is killed during the wait; the park record and the lane record's nomination stand, and the delivered resume path applies (spec section 7.2).
- Live-tracker or live-PR behaviour in the automated suites. TC-PEAK-029 is a post-upgrade reference-host hand-off, not a suite.
- Timing assertions on wall-clock durations. The stop-request instant is taken from the stop seam; the record bound is park no later than the window-open observation plus the applied grace, with the observation derived from `graceDeadline` minus the profile grace; the resume lag is derived from `until` and `resumedAt`. All are asserted over the injected clock, never by sleeping.
- A union of overlapping windows as one park. The delivered first-open-window end applies, and the overlap churn is a consecutive exactly-once episode (DEC-20, RSK-13), not a tested union.

## 2. References

- Change specification: `./chg-GH-413-spec.md` v1.5. Source of truth for sections 5 (capabilities), 8 (interfaces and data model), 9 (NFRs), 15 (decisions DEC-1 to DEC-21), 17 (33 acceptance criteria), and 18.1 (Definition of Done).
- Testing strategy: `.ai/rules/testing-strategy.md`. Layer and module mapping, bun:test conventions, hermeticity, invariant-test authoring, and the aggregate gate.
- Implementation plan: `./chg-GH-413-plan.yaml` v1.7. The plan is the authority for phase numbering and TC ownership; this test plan v1.10 follows it and invents no phase.
- Decision records: TDR-0077 (the dispatch-owned window watch contract, path declared by the plan as `doc/decisions/TDR-0077-dispatch-owned-window-watch.md`) and TDR-0078 (the lease-renewal amendment to the delivered no-renewal rule), both `Proposed` at Done (spec section 15, 18.1).
- Repository rules: `AGENTS.md` and `.ai/rules/typescript.md` for the TypeScript workspace, fixture, and bun:test conventions.
- Existing suites this plan extends rather than duplicates:
  - Peak-pause decisions and daemon watch: `tests/behaviour/peak-pause-determinism.test.ts`, `tests/behaviour/daemon-peak-window-park.test.ts`, `tests/behaviour/daemon-peak-window-resume.test.ts`, `tests/behaviour/daemon-peak-window-isolation.test.ts`, `tests/behaviour/peak-pause-composed-edge.test.ts`, `tests/behaviour/daemon-absent-degradation.test.ts`, `tests/behaviour/pause-episode-events.test.ts`, `tests/checks/peak-pause-hermetic.test.ts`.
  - Dispatch engine and harness: `tests/behaviour/dispatch-watch.test.ts`, `tests/behaviour/dispatch-determinism.test.ts`, `tests/behaviour/dispatch-single-flight.test.ts`, `tests/behaviour/dispatch-resume.test.ts`, `tests/behaviour/dispatch-resume-economics.test.ts`, `tests/behaviour/dispatch-restart-budget.test.ts`, `tests/behaviour/dispatch-token-closure.test.ts`, `tests/behaviour/dispatch-envelope.test.ts`, `tests/behaviour/dispatch-daemonless.test.ts`.
  - Lease claim and renewal: `tests/behaviour/queue-claim-single-flight.test.ts`, `tests/behaviour/queue-lease.test.ts`, `tests/behaviour/queue-lease-renewal-narrowing.test.ts`, `tests/behaviour/queue-lease-takeover.test.ts`, `tests/behaviour/queue-single-flight-purity.test.ts`, `tests/behaviour/queue-single-flight-read-cost.test.ts`.
  - Configuration: `tests/behaviour/config-lane.test.ts`, `tests/behaviour/config-schema.test.ts`, `tests/behaviour/peak-pause-composed-edge.test.ts`.
  - Surfaces: `tests/behaviour/status-brief-park-fields.test.ts`, `tests/behaviour/status-parked-conditions.test.ts`, `tests/behaviour/lanes-parked-stall.test.ts`, `tests/behaviour/board-parked.test.ts`, `tests/behaviour/spend-zero-window.test.ts`, `tests/behaviour/dispatch-additive-stability.test.ts`.
  - Owner hold: `tests/behaviour/queue-hold-park-resume.test.ts`, `tests/behaviour/owner-hold-fact.test.ts`.
  - Vocabulary and release: `tests/structure/event-taxonomy-integrity.test.ts`, `tests/checks/event-taxonomy-conformance.test.ts`, `tests/checks/privacy-release.test.ts` (TC-RELEASE-001), `tests/structure/changeset-additivity.test.ts`.
- Delivered decision and contract modules the fixtures compose: `packages/core/src/domain/daemon-peak-pause.ts` (`decidePeakStops`, `decidePeakResumes`, `runPeakWatch`, `runPeakResume`), `packages/core/src/domain/queue-park.ts`, `packages/core/src/domain/spend.ts`, `packages/core/src/app/dispatch.ts`, `packages/core/src/app/dispatch-lane-view.ts`, `packages/core/src/app/queue.ts` (the delivered lease renewal path and `recoverQueueParks` mutating park pass), `packages/core/src/config/catalog.ts`, `packages/core/src/contracts/taxonomy.ts`.
- Fixture seams: `tests/fixtures/dispatch/golden/harness.ts` (`createCommandScenario` with `nowIso`, `delay`, `harnessPort`, `livenessIntervalMs`, `livenessOf`, `restartBudget`, `initialRestarts`), `tests/fixtures/state/harness.ts` (temporary store and lease clock), `tests/fixtures/events/event-harness.ts` (in-memory transport pair), `tests/fixtures/telemetry` (seeded telemetry steps), `tests/fixtures/board`, `tests/fixtures/supervise`, the production composition factory at `tests/fixtures/queue/production/harness.ts` (the real `createProductionComposer`), the standing-park fixture built from the delivered `recoverQueueParks` pass (clear-observed marker, recovered record, `park-auto-recovery` incident), the stop seam that records the stop-request instant, and the stop-hand-off fixture that puts a separate stop command and the owning invocation over one durable store.

## 3. Coverage Overview

### 3.1 Functional Coverage (F-#, AC-#)

| AC ID | Description (short) | TC ID(s) | Status |
|-------|---------------------|----------|--------|
| AC-F1-1 | Dispatch-owned watch and the daemon's watch take the same stop or no-stop decision for the same profile and instant, through the same rules and clock, with neither deriving its own rule | TC-PEAK-001 | Covered |
| AC-F1-2 | A window opening mid-iteration and a window opening between iterations both park, and the watch remains active until the lane's terminal classification | TC-PEAK-002 | Covered |
| AC-F1-3 | Paired identical runs produce byte-identical decisions, park records, events, and summary apart from the intended composition-fact mode value, with no real sleep, network call, or credential read | TC-PEAK-003 | Covered |
| AC-F2-1 | A chain whose base profile declares no `peakWindows` does not exempt a lane nominated to a later profile whose windows are open: it parks with `until` at that profile's first open window's effective end | TC-PEAK-004 | Covered |
| AC-F2-2 | A lane whose nominated profile declares no `peakWindows` is never stopped for peak reasons, while provider-entry `peak` windows still gate admission exactly as delivered | TC-PEAK-005 | Covered |
| AC-F2-3 | Every active lane record carries the nomination after first acquisition, after a restart iteration, and after a post-park resume, so a latest-wins read always finds it; a pre-change record reads absent, is never pausable, and is never fabricated | TC-PEAK-031 | Covered |
| AC-F3-1 | One bounded-grace stop request, a park with the recorded stop instant and `until` at the first open window's effective end, and exactly one `stop` and one `parked` sharing one episode id | TC-PEAK-006 | Covered |
| AC-F3-2 | The park instant is no later than the window-open observation plus the applied grace, with the observation taken as `graceDeadline` minus the profile grace and the stop-request instant measured at the stop seam | TC-PEAK-007 | Covered |
| AC-F3-3 | Exactly one terminate call carries `graceMs` equal to the smallest of the remaining profile grace, the delivered kill grace, and the time to the effective end, with TERM before KILL and no escalation outlasting the buffer | TC-PEAK-032 | Covered |
| AC-F3-4 | A standing `peak-window` park is recovered through the delivered mutating park pass before the first stop decision and at the first observation of a resuming invocation; any remaining standing park is occupancy; an unrecoverable park refuses the run and starts no episode; a non-expired standing park refuses a resume or re-dispatch before any session starts with `dispatch.resume-parked` at exit 2 (platform-provider, transient, retryable, not_landed) and writes nothing, while an expired standing park is recovered at the first observation and the resume proceeds; closing a `preserved` standing park projects a `dispatch.attempt/resumed` frame with empty `sessionRef` and `branch` under the original episode id | TC-PEAK-038 | Covered |
| AC-F4-1 | A preserved episode resumes the preserved session on the same branch and worktree, records exactly one `resumed` with the no-re-dispatch fact, consumes no restart ordinal, and starts no second session | TC-PEAK-008 | Covered |
| AC-F4-2 | A not-preserved episode attempts no session resume, routes to the delivered interrupted-lane recovery consuming at most one ordinal per observation, emits no `resumed`, and escalates on budget exhaustion | TC-PEAK-009 | Covered |
| AC-F4-3 | At budget exhaustion, the delivered terminal exhaustion record is appended, the delivered typed question is raised, and the invocation returns the reachable classified result with the park standing, its summary naming the exhaustion and the park end rather than a pause and resume, and the exhaustion refusal carried only by the result's bounded episode fact | TC-PEAK-009 | Covered |
| AC-F5-1 | Branch, change folder, recorded phases, and queue state are unchanged by a complete park and resume, and the recorded worktree is reused | TC-PEAK-037 | Covered |
| AC-F5-2 | A park outlasting the lease TTL several times keeps the lease live by renewal at `min(lane.liveness-interval, queue.lease-ttl / 2)` keyed on the invocation's own last heartbeat write; a second dispatch before, at, and after each TTL boundary is refused `queue.single-flight` while the owner renews, with no takeover and no second session; a second dispatch during an un-expired standing park is refused `dispatch.resume-parked` at exit 2 at resume admission, and `queue.single-flight` applies only to a running lane without a park; after a longer outage a re-dispatch may take the delivered `renewed` arm, and the earlier invocation's next renewal is `lease:not-owned`, extends nothing, and returns with the park standing instead of resuming | TC-PEAK-010 | Covered |
| AC-F6-1 | `dispatch status <ref>` reports the park cause, window end, stop instant, and preservation from the park record and reports the observed probe verdict without redefining `stale` or `delivering`; it carries no exhaustion refusal, which lives only in the result's bounded episode fact | TC-PEAK-011 | Covered |
| AC-F6-2 | `lanes` renders `parked:peak-window` with the recorded `until` and delivered `leaseHolder`; `board` lists the row in `PARKED` from the same record, with no second vocabulary | TC-PEAK-012 | Covered |
| AC-F6-3 | With no open park, `dispatch status`, `board`, `brief`, and a result are byte-identical and the added members absent; `lanes --json` differs only in `peakEnforcement.mode` on a production composition with pausing enabled | TC-PEAK-013 | Covered |
| AC-F6-4 | The production composition reports `window-watch` with pausing enabled and `iteration-start-gating` disabled, derived from its own effective configuration, with `parkClaimed` following durable records | TC-PEAK-033 | Covered |
| AC-F6-5 | A parked lane with probe `live` or `unknown` reports `stale: false` and `delivering: true`; with `dead` it reports `stale: true` and `delivering: false`; all three carry the park fact and the dead arm names the recorded end | TC-PEAK-011 | Covered |
| AC-F7-1 | One invocation returns one result with the same token and exit; a resumed episode's summary states paused and resumed, a budget-exhaustion terminal refusal's summary names the exhaustion and the park end, and the bounded episode fact includes the exhaustion where it occurred | TC-PEAK-014 | Covered |
| AC-F8-1 | The key unset or `false` keeps pausing on and parks; the key `true` supplies no watch, stop, park, resume, or episode event, equals admission gating, and reports `iteration-start-gating` | TC-PEAK-015 | Covered |
| AC-F8-2 | With the disabling key `true`, `dispatch stop <ref>` on a running lane produces the same stop, park, and events as the enabled case | TC-PEAK-016 | Covered |
| AC-F9-1 | `dispatch stop <ref> --cause peak-window --until <iso>` sends the same bounded-grace stop, parks with that cause and end, records one `stop` and one `parked` with the same payloads, and reads the profile from the lane record | TC-PEAK-018 | Covered |
| AC-F9-2 | `dispatch stop` sends no signal of its own; exactly one terminate call carries the composed `graceMs`, TERM precedes KILL, KILL reaches only a still-listed target, no second kill mechanism exists, and the park is written only after a confirmed terminate; an unconfirmed terminate is the not-running refusal, and a terminate-less harness refuses with no park/event and `lanes` mode `iteration-start-gating` | TC-PEAK-019 | Covered |
| AC-F9-3 | A cause other than `peak-window`, or a missing end, is refused `input.value.rejected` at the grammar boundary before any lane read, the missing end reusing `until-required`, and writes nothing; the canonical `Z` end is accepted, while a past or non-canonical end is refused | TC-PEAK-034 | Covered |
| AC-F9-4 | Stop success answers only after a confirmed terminate and the park append, with one human line and machine data naming the work item, cause, park end, episode id, and preservation at exit `0`; the owning invocation withholds classification for at least the applied grace plus one observation cadence, re-reads the park, and enters wait/resume | TC-PEAK-035 | Covered |
| AC-F10-1 | A newest lane that is terminal, absent, active without a session identity, already carrying an open park of any cause, or whose terminate cannot be confirmed refuses with the delivered unmet-precondition identity, names the work item and lane state, and writes no second park or other record; for a repository-wide pass, the recovery-refusal summary names the stuck refs | TC-PEAK-020 | Covered |
| AC-F10-2 | A stop racing a session end produces exactly one classified outcome, either the confirmed episode or the not-running refusal, never a partial episode, duplicate park, or losing-side write; a park landing after collection is caught by the grace-plus-cadence re-read | TC-PEAK-036 | Covered |
| AC-F11-1 | An active owner hold does not change the watch: the lane still parks `peak-window` with `until`, the hold writes no park record, the lease keeps renewing, and the resume refuses the owner-hold precondition then proceeds with the park record byte-unchanged | TC-PEAK-021 | Covered |
| AC-F11-2 | Two dispatch lanes on different profiles: only the lane with an open window parks and resumes; the other keeps running, keeps its lease, and keeps its supervision unchanged | TC-PEAK-022 | Covered |
| AC-F12-1 | The window-scoped reading from park instant through park end over present telemetry counts zero attributable billable calls, discloses the telemetry state, and names its basis | TC-PEAK-023 | Covered |
| AC-F12-2 | A seeded billable call attributed to the lane inside the interval makes the reading greater than zero, so the zero claim is falsifiable | TC-PEAK-024 | Covered |

Capability traceability: F-1 -> TC-PEAK-001/002/003/038; F-2 -> TC-PEAK-004/005/022/031; F-3 -> TC-PEAK-004/006/007/032/038; F-4 -> TC-PEAK-008/009/025; F-5 -> TC-PEAK-008/010/037/038; F-6 -> TC-PEAK-011/012/013/033; F-7 -> TC-PEAK-014; F-8 -> TC-PEAK-015/016/017; F-9 -> TC-PEAK-016/018/019/034/035; F-10 -> TC-PEAK-016/020/036; F-11 -> TC-PEAK-005/021/022; F-12 -> TC-PEAK-023/024.

Derived scenarios (not acceptance criteria): the invalid-value configuration refusal is TC-PEAK-017, from spec section 5.1 F-8, section 8.3 DM-6, and Appendix B; the resume-admission window re-check is TC-PEAK-025, from spec section 5.1 F-4 and RSK-6. The owner delivery note on the changeset is TC-PEAK-028. The owner behavioural verification on the reference host is TC-PEAK-029, a post-upgrade hand-off.

Every TC is owned by exactly one plan phase. The plan is the authority for phase numbering and TC ownership; this list follows plan v1.7 and test plan v1.10 across the plan's eight phases: phase 1 owns TC-PEAK-017 and TC-PEAK-028; phase 2 owns TC-PEAK-010 (the running-lane lease arms); phase 3 owns TC-PEAK-001, 002, 004, 005, 006, 007, 008, 009, 015, 021, 022, 025, 031, 032, 037, 038; phase 4 owns TC-PEAK-011, 012, 013, 014, 023, 024, 033; phase 5 owns TC-PEAK-016, 018, 019, 020, 034, 035, 036; phase 6 owns TC-PEAK-003, 026, 027; phase 7 owns no TC; phase 8 owns TC-PEAK-029.

### 3.2 Interface Coverage (API-#, EVT-#, DM-#)

No HTTP or provider API is added or changed (spec sections 8.1 and 8.4). The coverage below is the data model and the taxonomy kinds this change produces.

| Interface element | TC ID(s) | Notes |
|-------------------|----------|-------|
| DM-1 Durable park record, episode frame | TC-PEAK-006, TC-PEAK-009, TC-PEAK-018, TC-PEAK-021, TC-PEAK-037, TC-PEAK-038 | Reused unchanged in shape; dispatch-owned stops write the complete frame; a standing park is closed by the delivered recovery record with its clear-observed marker and `park-auto-recovery` incident before a new episode; a preserved standing park's recovery projects the empty `sessionRef`/`branch` `resumed` frame under the original episode id; append-only, read-time expiry, no in-place mutation. The operator release writer keeps its minimal frame. No pre-session frame exists. |
| DM-2 Durable lane record | TC-PEAK-008, TC-PEAK-010, TC-PEAK-011, TC-PEAK-031 | One additive optional `providerProfile`, written on every `active` record the invocation appends: first acquisition, each restart iteration, and each post-park resume. The lane record carries no exhaustion refusal. Absent on pre-change records, never fabricated. The delivered `active` and `terminal` states and the open-park join at read time are unchanged. |
| DM-3 `dispatch status` payload | TC-PEAK-011, TC-PEAK-013, TC-PEAK-009 | Additive optional park fact: cause, park end, stop instant, and preservation from the park record; absent when no park stands; all delivered members and lines unchanged and the delivered `stale`/`delivering` derivation untouched. The status payload carries no `recoveryRefusal` member; the refusal lives only in the result's bounded episode fact (DM-4). |
| DM-4 Dispatch result payload | TC-PEAK-014, TC-PEAK-009 | Additive optional bounded episode fact including the exhaustion refusal where the recovery exhausted its budget; no new token and no change to derivation. |
| DM-5 Dispatch result summary | TC-PEAK-014 | States paused and resumed for a resumed episode, and names the exhaustion and the park end at budget exhaustion; the delivered key set and verbose detail line keep their shape. |
| DM-6 Configuration key for disabling pausing | TC-PEAK-015, TC-PEAK-016, TC-PEAK-017 | One boolean in the delivered typed lane policy branch, unset by default, meaning pausing is on; `true` composes no watch. |
| DM-7 Composition-fact read | TC-PEAK-005, TC-PEAK-015, TC-PEAK-033 | Two members and two mode values kept; the mode input is the reading composition's own effective configuration, `window-watch` with pausing enabled and `iteration-start-gating` disabled or with no watch; `parkClaimed` stays derived from durable park records; the one intended value change is carved out of the byte-identical promise. |
| DM-8 `dispatch stop` success output | TC-PEAK-035 | One human line naming the work item, cause, park end, and episode id; machine data with those and the preservation classification at exit `0`, only after a confirmed terminate and the park append; no new envelope shape or key family. |
| DM-9 Lease liveness during the episode | TC-PEAK-010, TC-PEAK-037 | The existing lease is renewed through the delivered renewal path at `min(lane.liveness-interval, queue.lease-ttl / 2)` for the run and the park; the renewal is a no-op unless the live lease's latest heartbeat is the invocation's own last write, so a re-dispatch's `renewed` arm (which preserves the lease id and appends a newer heartbeat) makes the earlier invocation's renewal `lease:not-owned`, appending and extending nothing; an invocation that has lost the lease returns one classified result with the park standing instead of resuming; it does not pass the owner-hold gate; no new record kind, schema, or exclusion mechanism. |
| Event `dispatch.attempt/stop` | TC-PEAK-006, TC-PEAK-018, TC-PEAK-019, TC-PEAK-027, TC-PEAK-032 | Exactly one per episode in which a session was stopped, only over a complete frame and only after a confirmed terminate; declared payload unchanged. |
| Event `dispatch.attempt/parked` | TC-PEAK-006, TC-PEAK-009, TC-PEAK-018, TC-PEAK-027, TC-PEAK-032 | Exactly one per stopped episode, carrying the closed preservation classification; only after a confirmed terminate. |
| Event `dispatch.attempt/resumed` | TC-PEAK-008, TC-PEAK-009, TC-PEAK-027, TC-PEAK-038 | Exactly one per preserved episode with the no-re-dispatch fact; a preserved standing park closed through the recovery pass projects a `resumed` frame with empty `sessionRef` and `branch` under the original episode id, whether or not a session resumed; never emitted by a restart recovery. |
| Event `queue.graph/park-edge` | TC-PEAK-012, TC-PEAK-018, TC-PEAK-027, TC-PEAK-037 | Exactly one per episode from the delivered park projection; overlapping windows produce consecutive episodes, each with its own `park-edge`. |

### 3.3 Non-Functional Coverage (NFR-#)

| NFR | Requirement (short) | TC ID(s) | Coverage mode |
|-----|---------------------|----------|---------------|
| NFR-1 | Bounded-grace stop: exactly one terminate call with `graceMs` the smallest of the three bounds; recorded deadline at or below `graceSecondsMax`; TERM before KILL; zero added signal paths | TC-PEAK-006, TC-PEAK-018, TC-PEAK-019, TC-PEAK-032 | Behaviour fixture plus structure guard |
| NFR-2 | Exactly-once episode across any number of observations: one `stop`, one `parked`, one `park-edge`, and, for a preserved episode only, one `resumed`, all sharing one episode id; overlapping windows produce consecutive episodes, each exactly once; a standing park is recovered so no second active park is ever appended | TC-PEAK-006, TC-PEAK-018, TC-PEAK-027, TC-PEAK-038 | Behaviour fixture over repeated observations |
| NFR-3 | Zero billable calls attributable to the parked lane between park and end, both boundaries inclusive, over present telemetry; absence classified, never zero; a seeded in-window call reads greater than zero; billing before the park is outside the count and is the declared one-cadence-plus-applied-grace residual (RSK-12) | TC-PEAK-023, TC-PEAK-024 | Behaviour fixture, both directions in one run |
| NFR-4 | Preserved episode consumes zero ordinals and starts no fresh spawn; not-preserved consumes at most one ordinal per observation under the delivered budget; budget exhaustion appends the delivered terminal exhaustion record, raises the delivered typed question, and returns the reachable classified result with the park standing; zero second sessions | TC-PEAK-008, TC-PEAK-009, TC-PEAK-037 | Behaviour fixture over the delivered restart/economics seams |
| NFR-5 | Determinism and hermeticity: identical configuration, rules, clock, and transport produce byte-identical output excluding the intended mode value; zero live network, real sleeps, or credential reads | TC-PEAK-001, TC-PEAK-003, TC-PEAK-026 | Paired-run fixture plus armed canaries and source scan |
| NFR-6 | Observation-to-park bound: park instant no later than the window-open observation plus the applied grace, with the observation taken as `graceDeadline` minus the profile grace; the stop-request instant is measured at the stop seam, not read from the record; resume within one cadence of the recorded end; no added evidence field | TC-PEAK-007, TC-PEAK-008 | Fixture over the injected clock, the stop seam, and the delivered liveness cadence |
| NFR-7 | Wait cost and boundedness: no billable call, session operation, or provider request during the wait; at most one clock observation per wake; renewals at most once per renewal cadence and no more than once per wake; renewal cadence `min(lane.liveness-interval, queue.lease-ttl / 2)`; wakes <= elapsed time / `min(lane.liveness-interval, queue.lease-ttl / 2)` + 1, with a derived-cadence renewal wake counted as a renewal, not an extra observation; no busy loop; end re-derived each wake | TC-PEAK-003, TC-PEAK-010, TC-PEAK-025, TC-PEAK-026 | Fixture with a counted wake, renewal spy, and delay spy; no timer |
| NFR-8 | Vocabulary economy and evidence bounds: exactly one added error-table row (`dispatch.resume-parked`), an owner-authorised exception; no other added kind, record kind, schema identity, result token, or reason; refusals reuse delivered identities; at most 20 fields and 1024 bytes per frame | TC-PEAK-017, TC-PEAK-020, TC-PEAK-027, TC-PEAK-034 | Structure and check suites over the closed sets and payload bounds |
| NFR-9 | Additive interface and bounded reads: one changed delivered field (`peakEnforcement.mode` on a production composition with pausing enabled), every other field zero; zero new stores; at most one additional bounded park-record read on `dispatch status`; no unbounded reads | TC-PEAK-011, TC-PEAK-012, TC-PEAK-013, TC-PEAK-015, TC-PEAK-033 | Golden/regression fixture plus a read-count spy |
| NFR-10 | Lease liveness through the run and the park: heartbeat age below the lease TTL **between renewals and outside the unrenewed bounded waits** (terminate grace, worktree provisioning, and handle acquisition) at `min(lane.liveness-interval, queue.lease-ttl / 2)`, including an interval-above-TTL configuration; the renewal keys on the live lease's latest heartbeat being the invocation's own last write; no takeover while the owner renews, at most one renewal per renewal cadence, no renewal that acquires, takes over, or displaces a lease, `lease:not-owned` for a non-owner, no resume by an invocation that lost the lease, owner-hold exemption, renewal failures surfaced | TC-PEAK-010, TC-PEAK-021 | Behaviour fixture crossing several TTLs over the injected clock, plus the owner-hold and lost-lease arms |

## 4. Test Types and Layers

Per `.ai/rules/testing-strategy.md`, all automated suites are `bun:test` files under `tests/**`, run with `bun test` and folded into `pnpm check`.

- **Unit and pure decision tests** - direct calls to the delivered decision layer (`decidePeakStops`, `decidePeakResumes`, `runPeakWatch`, `runPeakResume`) and to the configuration resolver. Used to pin parity of the decision inputs and the setting's default and refusal. Target: `tests/behaviour/*peak*.test.ts` and `tests/behaviour/config-lane.test.ts`.
- **Behaviour and integration tests** - the command-level dispatch harness `createCommandScenario`, the temporary state store and lease clock, the scripted session port, the in-memory event transport, the seeded telemetry ledger, the production composition factory at `tests/fixtures/queue/production/harness.ts`, the delivered `recoverQueueParks` standing-park fixture, the stop seam that records the stop-request instant, and the stop-hand-off fixture that runs a separate stop command and the owning invocation over one durable store. Used for the episode lifecycle, standing-park recovery, nomination, lease renewal, stop command including the post-collection re-read, resume routing, surfaces, isolation, and spend. Target: new `tests/behaviour/dispatch-peak-*.test.ts`, `tests/behaviour/dispatch-lease-liveness.test.ts`, and `tests/behaviour/dispatch-stop*.test.ts`, extending the existing dispatch and daemon park suites by pattern, never by copy.
- **Structure tests** - `tests/structure/**`: closed-set and contract assertions (taxonomy unchanged, the additive lane-record, status, and result shapes, the composition fact, the changeset tree invariant). Target: `tests/structure/event-taxonomy-*.test.ts`, `tests/structure/dispatch-contract.test.ts`, `tests/structure/changeset-additivity.test.ts`, with a new narrow `tests/structure/dispatch-peak-contract.test.ts` only if the additive contract needs one.
- **Check and invariant tests** - `tests/checks/**`: hermeticity canaries and source scans, event payload bounds, release shape, and the mutation controls that prove a guard can fail. Target: `tests/checks/peak-pause-hermetic.test.ts` (extended), `tests/checks/event-taxonomy-conformance.test.ts`, `tests/checks/privacy-release.test.ts`.
- **Manual/operational evidence** - TC-PEAK-029 is a post-upgrade observation by the reference host on the next lane; the change's pm-notes record the hand-off and its preconditions before `dod_check`, and the PR carries them. No automated suite depends on it and the episode is not a Done criterion.
- **Aggregate gate** - `pnpm check` (lint, format check, typecheck, test, boundaries) is the final verification. The full battery runs once at the gate; during implementation only the affected suites run (section 7).

Test type vocabulary used in section 5 follows the template: Unit, Integration, Contract, E2E, Manual, Performance, plus the repository's Structure and Check layers as the location qualifier.

## 5. Test Scenarios

### 5.1 Scenario Index

| TC ID | Title | Type | Level | Priority | AC Coverage | Plan Phase |
|-------|-------|------|-------|----------|-------------|------------|
| TC-PEAK-001 | Dispatch-owned watch and daemon watch agree on the same profile and instant | Contract | Behaviour + Structure | Critical | AC-F1-1 | 3 |
| TC-PEAK-002 | Mid-iteration and between-iteration windows both park; the watch lives to terminal | Happy Path | Behaviour | Critical | AC-F1-2 | 3 |
| TC-PEAK-003 | Paired identical runs produce byte-identical episode evidence with the mode carve-out | Regression | Behaviour | High | AC-F1-3 | 6 |
| TC-PEAK-004 | Chain-first-no-window does not exempt a lane nominated to a later profile with an open window | Edge Case | Behaviour | Critical | AC-F2-1 | 3 |
| TC-PEAK-005 | A profile with no `peakWindows` is never stopped; admission gating is unchanged | Negative | Behaviour | Critical | AC-F2-2 | 3 |
| TC-PEAK-006 | One bounded-grace stop and exactly-once park at the first open window's start, with the grace, overlap, and standing-park arms | Happy Path | Behaviour | Critical | AC-F3-1 | 3 |
| TC-PEAK-007 | Observation-to-park bound is derived; park is no later than observation plus grace | Happy Path | Behaviour | High | AC-F3-2 | 3 |
| TC-PEAK-008 | Preserved resume: same session, branch, and worktree; one `resumed`; zero ordinals | Happy Path | Behaviour | Critical | AC-F4-1 | 3 |
| TC-PEAK-009 | Not-preserved recovery, terminal budget exhaustion, and standing-park recovery | Corner Case | Behaviour | Critical | AC-F4-2, AC-F4-3 | 3 |
| TC-PEAK-010 | The running lane's lease stays live at the derived renewal cadence and is keyed on its own last heartbeat write | Happy Path | Behaviour | Critical | AC-F5-2 | 2 |
| TC-PEAK-011 | `dispatch status` reports the park fact and the three parked-lane probe arms | Happy Path | Behaviour | Critical | AC-F6-1, AC-F6-5 | 4 |
| TC-PEAK-012 | `lanes` and `board` show the dispatch-owned park and the live lease holder | Happy Path | Behaviour | High | AC-F6-2 | 4 |
| TC-PEAK-013 | No-park output is byte-identical except the one intended mode value | Regression | Behaviour + Golden | Critical | AC-F6-3 | 4 |
| TC-PEAK-014 | One result states paused and resumed, or the terminal exhaustion and the park end | Happy Path | Behaviour | Critical | AC-F7-1 | 4 |
| TC-PEAK-015 | The disabling key unset, `false`, and `true` behave exactly as declared | Edge Case | Behaviour + Contract | Critical | AC-F8-1 | 3 |
| TC-PEAK-016 | `dispatch stop` works identically when automatic pausing is disabled | Edge Case | Behaviour | High | AC-F8-2 | 5 |
| TC-PEAK-017 | An invalid disabling value is refused by name with no partial effect | Negative | Behaviour + Contract | High | F-8 derived | 1 |
| TC-PEAK-018 | `dispatch stop --cause peak-window --until` equals a window-open stop, payload for payload | Happy Path | Behaviour | Critical | AC-F9-1 | 5 |
| TC-PEAK-019 | `dispatch stop` never kills; one terminate call with the composed grace; park only after a confirmed terminate | Negative | Behaviour + Structure | Critical | AC-F9-2 | 5 |
| TC-PEAK-020 | A stop for a terminal, absent, session-less active, any-open-park, or unconfirmed-terminate lane is refused | Negative | Behaviour | Critical | AC-F10-1 | 5 |
| TC-PEAK-021 | An active owner hold does not change the watch or the park, and the lease keeps renewing | Corner Case | Behaviour | High | AC-F11-1 | 3 |
| TC-PEAK-022 | Per-profile isolation: only the lane in an open window parks and resumes | Happy Path | Behaviour | High | AC-F11-2 | 3 |
| TC-PEAK-023 | Zero-spend reading is positive zero with present telemetry and a classified absence otherwise | Happy Path | Behaviour | Critical | AC-F12-1 | 4 |
| TC-PEAK-024 | A seeded mid-window call makes the zero-spend claim fail | Negative | Behaviour | Critical | AC-F12-2 | 4 |
| TC-PEAK-025 | Resume admission re-checks the window and never resumes into an open window | Corner Case | Behaviour | High | F-4 derived | 3 |
| TC-PEAK-026 | The delivering suites are hermetic: zero live resources, zero real sleeps | Check | Checks | Critical | NFR-5, NFR-7 | 6 |
| TC-PEAK-027 | Vocabulary economy and event evidence bounds hold, including the consecutive-episode shape | Check | Structure + Checks | High | NFR-8 | 6 |
| TC-PEAK-028 | The change's changeset exists before the first gate run | Check | Checks + Structure | High | Owner note, TC-RELEASE-001 | 1 |
| TC-PEAK-029 | The reference host observes one real episode on the next lane after the upgrade; the pm-notes and PR record the hand-off | Manual | Manual | Medium | Owner behavioural verification (non-gating) | 8 |
| TC-PEAK-031 | Every active lane record carries the nomination, including after a restart and a post-park resume | Happy Path | Behaviour | Critical | AC-F2-3 | 3 |
| TC-PEAK-032 | One terminate call carries the composed grace; escalation cannot outlast the buffer | Happy Path | Behaviour | Critical | AC-F3-3 | 3 |
| TC-PEAK-033 | The production composition mode is configuration-derived in both settings | Happy Path | Behaviour + Contract | Critical | AC-F6-4 | 4 |
| TC-PEAK-034 | A stop with another cause, a missing end, or an invalid end is a grammar refusal | Negative | Behaviour | High | AC-F9-3 | 5 |
| TC-PEAK-035 | The stop success output and the owning invocation's post-collection re-read, wait and resume | Happy Path | Behaviour | Critical | AC-F9-4 | 5 |
| TC-PEAK-036 | A stop racing a session end resolves exactly one outcome, including a park after collection | Corner Case | Behaviour | Critical | AC-F10-2 | 5 |
| TC-PEAK-037 | A complete park and resume loses nothing, reuses the worktree, and recovers a standing park | Happy Path | Behaviour | Critical | AC-F5-1 | 3 |
| TC-PEAK-038 | A standing peak-window park is recovered or refused before a new episode; occupancy prevents a double park | Happy Path | Behaviour | Critical | AC-F3-4 | 3 |

### 5.2 Scenario Details

#### TC-PEAK-001 - Dispatch-owned watch and daemon watch agree on the same profile and instant

**Scenario Type**: Happy Path (parity)
**Impact Level**: Critical
**Priority**: High
**Related IDs**: F-1, AC-F1-1, NFR-5, RSK-8
**Test Type(s)**: Contract, Integration
**Automation Level**: Automated
**Target Layer / Location**: `tests/behaviour/dispatch-peak-parity.test.ts` (new), composing the delivered daemon fixture pattern from `tests/behaviour/daemon-peak-window-park.test.ts` and the command harness `tests/fixtures/dispatch/golden/harness.ts`
**Tags**: @backend, @parity

**Preconditions**:

- One parsed `peakWindows` rule set for a named profile, one injected clock instant inside the buffer-inclusive window and one outside it.
- A dispatch-owned watch composition and a daemon-watch composition, both over the same profile and rule set.

**Steps**:

1. Evaluate the daemon path at the inside-window instant and at the outside-window instant.
2. Evaluate the dispatch-owned watch over the equivalent lane at the same two instants.
3. Compare the decision tuple: stop or no stop, the profile, the grace deadline, and the effective window end.
4. Run the structure guard that the dispatch path resolves the rule through the delivered decision layer and does not compute its own window.

**Expected Outcome**:

- Identical decisions at both instants: the same stop with the same grace deadline and effective end, or the same no-stop.
- The dispatch composition reads the nominated profile's rule data through the delivered decision functions and the same injected clock; no local window arithmetic is present.

**Notes / Clarifications**:

- The test compares outcomes, not internal call order. The guard ensures a future edit cannot replace the shared decision with a copy.

#### TC-PEAK-002 - Mid-iteration and between-iteration windows both park; the watch lives to terminal

**Scenario Type**: Happy Path
**Impact Level**: Critical
**Priority**: High
**Related IDs**: F-1, AC-F1-2
**Test Type(s)**: Integration
**Automation Level**: Automated
**Target Layer / Location**: `tests/behaviour/dispatch-peak-watch.test.ts` (new), over `createCommandScenario`
**Tags**: @backend

**Preconditions**:

- A controllable injected clock and a scripted session port whose liveness observations can be interleaved with clock advances.
- A nominated profile whose window opens at a known instant.

**Steps**:

1. Run a dispatch lane whose session is actively producing output when the window opens mid-iteration, advance the clock to the open instant, and observe the watch.
2. Run a second dispatch lane where the window opens after one observation returns and before the next session step.
3. Continue both lanes past the resume to their terminal classification.
4. Record every watch evaluation after the terminal classification.

**Expected Outcome**:

- Both lanes park with cause `peak-window`.
- Mid-iteration arm: the window is observed while the session is actively producing output, not only between polls, and the lane still parks.
- The watch is evaluated while the lane is in flight, and no watch evaluation occurs after the terminal classification.
- The between-iteration lane is not skipped: the watch is not tied to a phase boundary alone.

#### TC-PEAK-003 - Paired identical runs produce byte-identical episode evidence with the mode carve-out

**Scenario Type**: Regression
**Impact Level**: Critical
**Priority**: High
**Related IDs**: F-1, AC-F1-3, NFR-5, NFR-7
**Test Type(s)**: Integration
**Automation Level**: Automated
**Target Layer / Location**: `tests/behaviour/dispatch-peak-determinism.test.ts` (new), extending the pattern of `tests/behaviour/peak-pause-determinism.test.ts` and `tests/behaviour/dispatch-determinism.test.ts`
**Tags**: @backend, @determinism

**Preconditions**:

- Identical declared configuration, lane-watch rule data, injected clock sequence, injected delay, and scripted transport for both runs.
- Deterministic episode-id and attempt-id factories.

**Steps**:

1. Run the full park-and-resume fixture once and serialize the decisions, park records, event frames, result envelope, and human summary.
2. Run the identical fixture a second time with fresh but identically seeded fakes.
3. Compare the serialized outputs byte for byte; assert that the only field permitted to differ from the pre-change baseline is `peakEnforcement.mode`, and that it is identical between the paired runs.
4. Confirm the injected delay recorded calls and no real timer, `Bun.sleep`, or network accessor was used.

**Expected Outcome**:

- Byte-identical decisions, records, events, and summary across the paired runs, apart from the one intended composition-fact mode value.
- The mode carve-out is asserted as exactly one named field, never as a blanket exemption: every other field is compared strictly, and the mode is stable across paired runs.
- No real sleep, no network call, and no credential read; all time advances come from the injected clock.

#### TC-PEAK-004 - Chain-first-no-window does not exempt a lane nominated to a later profile with an open window

**Scenario Type**: Edge Case
**Impact Level**: Critical
**Priority**: High
**Related IDs**: F-2, F-3, AC-F2-1
**Test Type(s)**: Integration
**Automation Level**: Automated
**Target Layer / Location**: `tests/behaviour/dispatch-peak-watch.test.ts`, chain fixture in `tests/fixtures/provider/profile/` or a new dispatch-local chain fixture
**Tags**: @backend, @provider

**Preconditions**:

- A preference chain whose base (first) entry declares no `peakWindows`.
- A later entry, nominated at admission, that declares an open window with a known effective end.
- The lane's recorded nomination names the later profile.

**Steps**:

1. Admit a dispatch lane under the chain and record the nomination.
2. Run the watch at the open instant.
3. Read the park record and the episode events.

**Expected Outcome**:

- The lane parks with cause `peak-window`, the nominated later profile named, and `until` at that profile's first open window's effective end.
- The absent rules on the chain's first entry produce no exemption and no default rule; the delivered first-match evaluation is the only end derivation.

#### TC-PEAK-005 - A profile with no `peakWindows` is never stopped; admission gating is unchanged

**Scenario Type**: Negative
**Impact Level**: Critical
**Priority**: High
**Related IDs**: F-2, F-11, AC-F2-2, DM-7
**Test Type(s)**: Integration
**Automation Level**: Automated
**Target Layer / Location**: `tests/behaviour/dispatch-peak-watch.test.ts`, with the delivered admission-preflight suites read for parity
**Tags**: @backend, @provider

**Preconditions**:

- A nominated profile with no `peakWindows` branch.
- Other profiles' windows open during the same interval.
- A provider-entry `peak` window configured to gate admission, separate from the profile rule data.

**Steps**:

1. Run a dispatch lane on the no-window profile across the interval.
2. Observe the watch decisions and the records written.
3. Attempt a new dispatch inside a provider-entry `peak` window.

**Expected Outcome**:

- The lane is never stopped for peak reasons; no stop, park, resume, or episode event is written.
- The composition fact still reflects the composition actually supplied.
- The new dispatch inside a provider-entry `peak` window is refused exactly as delivered; admission gating is not relaxed or rerouted.

#### TC-PEAK-006 - One bounded-grace stop and exactly-once park at the first open window's start, with the grace, overlap, and standing-park arms

**Scenario Type**: Happy Path
**Impact Level**: Critical
**Priority**: High
**Related IDs**: F-3, AC-F3-1, AC-F3-4, NFR-1, NFR-2, DM-1, DEC-20, RSK-13, RSK-14, events `stop` and `parked`
**Test Type(s)**: Integration
**Automation Level**: Automated
**Target Layer / Location**: `tests/behaviour/dispatch-peak-episode.test.ts` (new), with the event projection harness from `tests/fixtures/events/event-harness.ts`
**Tags**: @backend, @events

**Preconditions**:

- A running dispatch lane nominated to a profile whose window opens at a known instant.
- An injected clock, an injected delay, and a scripted transport that records stop requests.
- Three grace arms: a default grace below the derived maximum; a small-buffer arm where the time from the stop instant to the first open window's effective end is smaller than the delivered kill grace; and a grace-above-cadence arm where the profile grace is longer than one observation cadence.
- A profile rule fixture whose declared buffers are known, a second profile fixture whose windows overlap in effect, and a standing-expired-park fixture.
- The standing-expired-park fixture carries an earlier `peak-window` park for the ref with an `until` in the past, and a next window that is open.
- One durable store shared with the owning invocation, so the window-open park record and episode frames are the hand-off.

**Steps**:

1. Advance the clock to the buffer-inclusive open instant and run the watch on the default arm.
2. Read the park record and project the episode events.
3. Repeat the watch over several later observations.
4. Repeat with the small-buffer fixture and record the park instant relative to the stop instant and the first open window's effective end.
5. Repeat with the grace-above-cadence fixture and record the stop instant, the park instant, and the applied grace.
6. Run the overlapping-window fixture through the first park, a short resume, and the next observation; read both episodes.
7. Run the standing-expired-park fixture through the first observation; assert the delivered `recoverQueueParks` pass closes the standing park and then the next window parks exactly once.
8. Run the hand-off-over-one-store arm: write the episode to the shared store, read it back through the owning invocation's next observation, and assert the same park record drives the episode frames.

**Expected Outcome**:

- Exactly one bounded-grace stop request reaches the delivered stop seam.
- One park record with cause `peak-window`, the profile, `until` at the first open window's effective end, the recorded stop instant, the grace deadline, one episode id, and the closed preservation classification.
- Exactly one `stop` and one `parked` event share the episode id; the `park-edge` projection appears once; further observations add no frame and mutate no record.
- The grace deadline never exceeds the profile's derived maximum; no second signal path is used.
- Small-buffer arm: the park lands no later than the first open window's effective end, so the escalation cannot outlast the buffer.
- Grace-above-cadence arm: the stop request lands within one cadence, and the park lands after the applied grace; the observation-to-park bound is asserted in TC-PEAK-007.
- Overlapping-window arm: the first park ends at the first open window's effective end; after a short resume, the next observation parks again into the second window as a separate episode with its own `stop`, `parked`, and `park-edge`, exactly once each. No union is asserted.
- Standing-expired-park arm: the standing park is recovered (clear-observed marker, recovered record, `park-auto-recovery` incident) before the stop decision; the next window yields exactly one active park and one new episode for the ref, never two active parks.
- Hand-off over one store: the park record and episode frames live in one durable store; the owning invocation reads the same record and no second store or control channel is used.

#### TC-PEAK-007 - Observation-to-park bound is derived; park is no later than observation plus grace

**Scenario Type**: Happy Path
**Impact Level**: Important
**Priority**: High
**Related IDs**: F-3, AC-F3-2, NFR-6, DEC-17
**Test Type(s)**: Integration
**Automation Level**: Automated
**Target Layer / Location**: `tests/behaviour/dispatch-peak-episode.test.ts`, using `livenessIntervalMs`, the injected clock, and the stop seam that records the stop-request instant
**Tags**: @backend, @latency

**Preconditions**:

- The delivered liveness cadence configured to a known value, for example 30 000 ms.
- The window-open observation recorded by the fixture, the stop-request instant recorded at the stop seam, and the profile grace known.
- A grace-below-cadence arm, a grace-above-cadence arm, and a kill grace above the cadence over the same fixture.

**Steps**:

1. Advance the clock to the window-open observation, then to the first observation at or after it; run the watch and record the stop-request instant at the stop seam, the park instant, and the effective end.
2. Derive the window-open observation instant from the record as `graceDeadline` minus the profile grace; assert the stop-request instant recorded at the stop seam equals that derived instant, and both equal the fixture's observation instant within the injection precision.
3. Assert the park instant is no later than that derived observation instant plus the applied grace.
4. Repeat with the kill grace above the cadence and assert the bound still holds without a false violation.
5. Derive the resume lag from `until` and `resumedAt`; assert it is at most one cadence.
6. Assert no new evidence field was added to the park record or the result.

**Expected Outcome**:

- The stop-request instant is taken from the stop seam, not from the record; the record's `stoppedAt` is the park instant because the delivered `runPeakWatch` stamps it after the stop resolves.
- The record proves only the observation-to-park bound: park no later than (`graceDeadline` minus profile grace) plus the applied grace. No claim is made that the stop lands within one cadence based on `stoppedAt`.
- With the kill grace above the cadence the bound still holds and is not reported as a violation.
- The resume lag is derived from `until` and `resumedAt` and is at most one cadence.
- The park's `until` is the first open window's effective end; overlapping windows produce independent bounds for each consecutive episode, and no union end is asserted.
- No lag field is added to any record or payload; no test asserts a wall-clock duration; the cadence and the clock are injected.

#### TC-PEAK-008 - Preserved resume: same session, branch, and worktree; one `resumed`; zero ordinals

**Scenario Type**: Happy Path
**Impact Level**: Critical
**Priority**: High
**Related IDs**: F-4, F-5, AC-F4-1, NFR-4, DM-2, event `resumed`
**Test Type(s)**: Integration
**Automation Level**: Automated
**Target Layer / Location**: `tests/behaviour/dispatch-peak-resume.test.ts` (new), extending the delivered resume and economics fixtures
**Tags**: @backend, @resume

**Preconditions**:

- A completed preserved peak-window episode with a recorded `until` and `preserved` classification.
- One recorded session id, branch, worktree path, and change folder before the park.
- A controllable clock and a scripted port that records resume, spawn, and attach calls.

**Steps**:

1. Advance the clock to the recorded end, then to the first observation at or after it.
2. Run the resume decision and the delivered session resume path.
3. Read the `resumed` event, the restart ledger, and the session and worktree facts.
4. Take the window-scoped reading of the resume lag.

**Expected Outcome**:

- The preserved session identity is resumed on the same branch and in the same worktree; no fresh spawn occurs.
- Exactly one `resumed` event carries the no-re-dispatch fact; zero restart ordinals are consumed; no second session exists for the work item.
- The resume decision lands within one cadence of the recorded end; the lag is derived from the recorded end and `resumedAt`, with no added evidence field.

#### TC-PEAK-009 - Not-preserved recovery, terminal budget exhaustion, and standing-park recovery

**Scenario Type**: Corner Case
**Impact Level**: Critical
**Priority**: High
**Related IDs**: F-4, AC-F4-2, AC-F4-3, AC-F3-4, NFR-4, DM-1, DM-3, DM-4, RSK-14, event `parked`
**Test Type(s)**: Integration
**Automation Level**: Automated
**Target Layer / Location**: `tests/behaviour/dispatch-peak-recovery.test.ts` (new), reusing `tests/behaviour/dispatch-resume-economics.test.ts` and `tests/behaviour/dispatch-restart-budget.test.ts` patterns
**Tags**: @backend, @recovery

**Preconditions**:

- A peak-window episode whose state preservation fails.
- The delivered restart budget recorded on the lane and the delivered typed-question seam available.
- An injected clock, a scripted session port, and a recording restart append.
- A budget-exhaustion terminal arm where the restart count is already at the delivered budget.

**Steps**:

1. Run the window-open stop with a preservation failure.
2. Read the park record and the applied grace.
3. Advance the clock to the recorded end and run the resume decision; observe the admitted recovery and its ordinal.
4. Repeat with the restart count already at the delivered budget.
5. Read the terminal exhaustion record, the delivered typed question, the reachable classified result, and the parked state.
6. Run the next invocation over the standing park left by the exhausted recovery; observe the delivered `recoverQueueParks` pass before its first stop decision and count active parks for the ref.

**Expected Outcome**:

- The park lands anyway with `session-state-not-preserved`; the preservation failure neither refuses the park nor extends the grace.
- At the end, no session resume is attempted and no `resumed` event is emitted; the delivered interrupted-lane recovery runs on the same branch and consumes at most one restart ordinal per observation.
- At budget exhaustion, the delivered terminal exhaustion record is appended, the delivered typed question is raised, and the invocation returns the reachable classified result with the park standing; no pause-and-resume claim is made. The exhaustion refusal is carried only by the result's bounded episode fact, not by the status, `laneParks`, brief, or board surfaces.
- Standing-park arm: the exhausted recovery leaves a standing `peak-window` park; the next invocation recovers it through the delivered mutating pass (clear-observed marker, recovered record, `park-auto-recovery` incident) before its first stop decision, and the ref never carries two active parks (RSK-14).

#### TC-PEAK-010 - The running lane's lease stays live at the derived renewal cadence and is keyed on its own last heartbeat write

**Scenario Type**: Happy Path
**Impact Level**: Critical
**Priority**: High
**Related IDs**: F-5, AC-F5-2, NFR-10, DM-9, DEC-13
**Test Type(s)**: Integration
**Automation Level**: Automated
**Target Layer / Location**: `tests/behaviour/dispatch-lease-liveness.test.ts` (new), using the store harness with its injected lease clock and the `tests/behaviour/queue-lease*.test.ts` renewal pattern
**Tags**: @backend, @single-flight, @lease

**Preconditions**:

- A running lane (no park yet) holding its repository lease, with `lane.liveness-interval` below `queue.lease-ttl / 2`.
- The delivered lease TTL configured to its 90 000 ms default and an injected clock that can cross it several times.
- An interval-above-TTL configuration where `lane.liveness-interval` is at or above the TTL.
- A second-dispatch admission probe that reads the same store.
- An un-expired standing-park second-dispatch arm.
- The invocation remembers the heartbeat instant it last wrote on its lease.
- A heartbeat-ownership no-op arm, a re-dispatch arm, a lost-lease arm, an owner-hold arm, and a renewal-failure arm in which one renewal fails and the next succeeds.
- The re-dispatch arm uses the delivered `renewed` arm: a second invocation takes over a stale lease under the same holder and reference, the lease id and acquisition instant are preserved, and a newer heartbeat is appended.
- The lost-lease arm keeps the first invocation's own session live after it has lost the lease.
- A parked-through-engine arm where the lane is already parked and the engine's renewal continues across a TTL inside the park.

**Steps**:

1. Run the lane at the default liveness interval and advance the injected clock across several TTL boundaries; at each boundary attempt a second dispatch of the same work item just before, exactly at, and just after the boundary.
2. After each attempt, read the lease heartbeat age and the renewal records; assert the renewal cadence is `min(lane.liveness-interval, queue.lease-ttl / 2)` and no takeover occurred while the owner renewed.
3. Repeat with `lane.liveness-interval` at or above the TTL and assert the renewal cadence is `queue.lease-ttl / 2`, so no heartbeat gap reaches the TTL.
4. Run the heartbeat-ownership no-op arm: call the renewal when the live lease's latest heartbeat is not the invocation's own last write (another writer, absent, other holder, or stale); assert no append, no extension, `lease:not-owned`, and no acquire, takeover, or displacement.
5. Run the re-dispatch arm: let a second invocation take over a stale lease through the delivered `renewed` arm, then run the first invocation's renewal; assert the preserved lease id does not make it the owner, the newer heartbeat makes the first invocation's renewal `lease:not-owned`, it appends and extends nothing, the second invocation's lease is untouched, and the first invocation returns one classified result with the park standing instead of resuming as owner.
6. Run the un-expired standing-park second-dispatch arm: while the park stands and has not expired, attempt a second dispatch; assert it is refused `dispatch.resume-parked` at exit 2 at resume admission, not `queue.single-flight`, and that no park or session is written.
7. Run the lost-lease arm: after the first invocation loses the lease while its own session is live, assert it performs no owner act (no stop, park, restart, resume, renew, or release), observes until that session ends, then returns with `lease:not-owned`; its return path still appends its own result records and it never abandons the live session.
8. Run the parked-through-engine arm: park the lane, advance across a TTL inside the park, and assert the engine's renewal continues through the delivered path at the derived cadence, so the lease stays live through the parked interval.
9. Run the owner-hold arm: with an active hold, assert the lane keeps renewing and the hold still parks nothing.
10. Run the renewal-failure arm; read the lease evidence and the next cadence's renewal.

**Expected Outcome**:

- The lease's heartbeat age stays below the TTL between renewals and outside the unrenewed bounded waits (terminate grace, worktree provisioning, and handle acquisition); renewals occur at most once per `min(lane.liveness-interval, queue.lease-ttl / 2)`, use the existing lease record, and add no new record kind.
- A second dispatch is refused `queue.single-flight` with the live holder at every attempted point before, at, and after each TTL boundary while the owner renews, with no takeover and no second session.
- The interval-above-TTL configuration is safe because the renewal cadence is halved by the TTL, not driven by the liveness interval.
- Heartbeat-ownership no-op: the renewal is keyed on the live lease's latest heartbeat being the invocation's own last write; when it is not, the renewal appends nothing, extends nothing, surfaces `lease:not-owned`, and never acquires, takes over, or displaces.
- Re-dispatch arm: the delivered `renewed` arm preserves the lease id, so the lease id alone cannot identify the invocation; the newer heartbeat does, and the earlier invocation's next renewal is `lease:not-owned`, extends nothing, and does not release or renew the successor's lease. The earlier invocation returns one classified result with the park standing and does not resume as owner.
- Un-expired standing-park second-dispatch: while the park stands and has not expired, the second dispatch is refused `dispatch.resume-parked` at exit 2 at resume admission, not `queue.single-flight`; `queue.single-flight` applies only to a running lane without a park.
- Lost-lease arm: when the invocation no longer holds the lease while its own session is live, it performs no owner act (no stop, park, restart, resume, renew, or release), observes until that session ends, and then returns with `lease:not-owned`; its return path still appends its own result records, and it never abandons the live session.
- Parked-case: a parked lane's invocation returns one classified result with the park standing and leaves the successor's lease alone; the live-session lost-lease rule applies only while the session is live.
- Parked-through-engine arm: across a TTL inside the park, the engine renews through the delivered path at the derived cadence; the lease stays live through the parked interval, not only while the lane is running.
- Owner-hold arm: the renewal does not pass the owner-hold gate, the lease keeps renewing, and the hold writes no park record.
- A renewal failure is retried at the next cadence and surfaced as bounded lease evidence; the lease does not go stale.

#### TC-PEAK-011 - `dispatch status` reports the park fact and the three parked-lane probe arms

**Scenario Type**: Happy Path
**Impact Level**: Critical
**Priority**: High
**Related IDs**: F-6, AC-F6-1, AC-F6-5, DM-2, DM-3, NFR-9, DEC-9
**Test Type(s)**: Integration
**Automation Level**: Automated
**Target Layer / Location**: `tests/behaviour/dispatch-status-park.test.ts` (new), extending the `dispatch-lane-view` and `status-brief-park-fields` patterns
**Tags**: @backend, @status, @probe

**Preconditions**:

- A dispatch lane with an open peak-window park record and an injectable owner probe.
- A budget-exhaustion result whose bounded episode fact carries the exhaustion refusal; the status, `laneParks`, brief, and board surfaces carry no refusal.
- A store read counter that records bounded park-record reads.
- The exact additive member names fixed by the delivery in this change.

**Steps**:

1. Invoke `dispatch status <ref> --json` with the owner probe `live`; read the park fact, `stale`, `delivering`, and the observed probe verdict.
2. Repeat with the owner probe `unknown`.
3. Repeat with the owner probe `dead`.
4. Repeat with the budget-exhaustion arm and with the park record expired; read the result's bounded episode fact and assert the status payload carries no `recoveryRefusal` member.
5. Assert the bounded park-record read count.

**Expected Outcome**:

- The park fact carries the cause, the window's end, the recorded stop instant, and the preservation classification from the park record; it is absent when no park stands. The status payload carries no `recoveryRefusal` member, and the same is true of `laneParks`, brief, and board.
- The exhaustion refusal is present only in the result's bounded episode fact (DM-4); the status and park surfaces carry no refusal.
- `live`: `stale: false`, `delivering: true`, park fact present, explaining that the invocation is alive and will resume.
- `unknown`: `stale: false`, `delivering: true`, park fact present, with the delivered rule that an unknown probe never asserts staleness.
- `dead`: `stale: true`, `delivering: false`, park fact present with the recorded end, so the orphaned park is visible as orphaned.
- The delivered `stale`/`delivering` derivation is not redefined or suppressed in any arm; the command performs at most one additional bounded park-record read and opens no new store.

#### TC-PEAK-012 - `lanes` and `board` show the dispatch-owned park and the live lease holder

**Scenario Type**: Happy Path
**Impact Level**: Important
**Priority**: High
**Related IDs**: F-6, AC-F6-2, NFR-9, DM-7, DM-9, event `park-edge`
**Test Type(s)**: Integration
**Automation Level**: Automated
**Target Layer / Location**: `tests/behaviour/dispatch-peak-surfaces.test.ts` (new), extending `tests/behaviour/lanes-parked-stall.test.ts` and `tests/behaviour/board-parked.test.ts`
**Tags**: @backend, @lanes, @board

**Preconditions**:

- One dispatch-owned park record with cause `peak-window`, a recorded `until`, and a preserved classification.
- A live lease held by the lane, so `leaseHolder` is populated.
- The production composition with automatic pausing enabled, so the lane row is read through the real composition.
- A read spy around the durable park record source.

**Steps**:

1. Invoke `lanes` in its machine form and read the lane row, including `leaseHolder` and the composition-fact block.
2. Invoke `board` and read the `PARKED` section.
3. Compare both to the park record and the lease record.

**Expected Outcome**:

- `lanes` renders `parked:peak-window` with the recorded `until` and the delivered `leaseHolder` from the live lease.
- `board` lists the same row in `PARKED` with the same cause and end.
- Both read the same durable park record and the existing lease record; no second vocabulary, no additional store read that invents the row, and no new lease field.

#### TC-PEAK-013 - No-park output is byte-identical except the one intended mode value

**Scenario Type**: Regression
**Impact Level**: Critical
**Priority**: High
**Related IDs**: F-6, AC-F6-3, NFR-9, DM-3, DM-7
**Test Type(s)**: Regression, Contract
**Automation Level**: Automated
**Target Layer / Location**: `tests/behaviour/dispatch-peak-byte-identical.test.ts` (new), with golden fixtures under `tests/golden`, extending `tests/behaviour/dispatch-additive-stability.test.ts`
**Tags**: @backend, @regression

**Preconditions**:

- A state with no open park, containing a delivered lane, queue entries, and a completed attempt.
- Pre-change golden outputs for `dispatch status`, `lanes`, `board`, `brief`, and a dispatch result.
- A production composition with automatic pausing enabled, and the same composition with it disabled.

**Steps**:

1. Run the byte-identical no-park arm: render `dispatch status`, `board`, `brief`, and a dispatch result from the no-park state, and compare each byte for byte with the pre-change golden.
2. Render `lanes --json` on the production composition with pausing enabled; compare every member and every human line except `peakEnforcement.mode`.
3. Assert `peakEnforcement.mode` is the only difference and reads `window-watch`; `parkClaimed` and every other member stay pre-change.
4. Repeat with pausing disabled and assert the mode keeps its delivered `iteration-start-gating` value and the output is fully byte-identical.

**Expected Outcome**:

- Byte-identical no-park arm: `dispatch status`, `board`, `brief`, and the dispatch result are byte-identical with no park open; the additive park and episode members are absent, not null.
- `lanes --json` with pausing enabled differs only in `peakEnforcement.mode`, which reads `window-watch`; no other member or human line moves.
- With pausing disabled, `lanes` is fully byte-identical and the mode reads `iteration-start-gating`.
- No golden is updated in this scenario; the no-park pins are deliberately untouched and the carve-out is asserted as one named field.

#### TC-PEAK-014 - One result states paused and resumed, or the terminal exhaustion and the park end

**Scenario Type**: Happy Path
**Impact Level**: Critical
**Priority**: High
**Related IDs**: F-7, AC-F7-1, DM-4, DM-5, AC-F4-3
**Test Type(s)**: Integration
**Automation Level**: Automated
**Target Layer / Location**: `tests/behaviour/dispatch-peak-result.test.ts` (new), extending `tests/behaviour/dispatch-token-closure.test.ts` and `tests/behaviour/dispatch-envelope.test.ts`
**Tags**: @backend, @result

**Preconditions**:

- One dispatch invocation that parks and resumes before its terminal classification.
- A second arm in which the not-preserved recovery reaches budget exhaustion.
- The same truth inputs run once without an episode as the token and exit control.
- The exact additive episode member names fixed by the delivery in this change.

**Steps**:

1. Run the spanning invocation to completion on the preserved arm.
2. Read the result count, token, exit projection, human summary, and machine envelope.
3. Read the bounded episode fact.
4. Compare the token and exit with the no-episode control.
5. Repeat on the budget-exhaustion arm; read the terminal exhaustion record, the delivered typed question, the returned result, its summary, the exhaustion in the episode fact, and the parked state.

**Expected Outcome**:

- Exactly one result for the work item; token and exit are the same the same truth would produce without an episode; no episode invents a token.
- Preserved arm: the summary states that the lane was paused and resumed, naming the cause and the episode's end.
- Budget-exhaustion arm: the terminal exhaustion record and the delivered typed question are present; the summary names the exhaustion and the park end instead of claiming a pause and a resume, and the result is the delivered derivation over the same truth.
- The envelope carries the bounded episode fact: episode id, cause, park end, resume instant, the preservation classification when the resume was a recovery, and the exhaustion refusal where the terminal refusal occurred. The status, `laneParks`, brief, and board surfaces carry no refusal.
- The budget-exhaustion arm leaves the lane parked and visible on the `dispatch status` park fact with the recorded end, without a `recoveryRefusal` member.
- No new result key set or verbose detail shape is introduced.

#### TC-PEAK-015 - The disabling key unset, `false`, and `true` behave exactly as declared

**Scenario Type**: Edge Case
**Impact Level**: Critical
**Priority**: High
**Related IDs**: F-8, AC-F8-1, DM-6, DM-7, NFR-9
**Test Type(s)**: Integration, Contract
**Automation Level**: Automated
**Target Layer / Location**: `tests/behaviour/dispatch-peak-setting.test.ts` (new), with the resolver assertions in `tests/behaviour/config-lane.test.ts`
**Tags**: @backend, @config

**Preconditions**:

- Three configurations of `lane.disable-peak-pausing`: absent, `false`, and `true`.
- The same dispatch lane, window, injected clock, and transport for each arm.
- The production composition, so the composition-fact value is the real one and not a test override.
- A lane already parked before the key changes to `true`.

**Steps**:

1. Run the lane to the open window with the key absent; then with `false`.
2. Run the same lane with the key `true`; read the composition fact and the written records.
3. Change the key to `true` while a lane is already parked and run the next observation.
4. Compare the `true` arm's result with the delivered pre-change admission-gating-only behaviour.

**Expected Outcome**:

- Absent or `false`: the lane parks exactly as specified.
- `true`: no in-flight watch, no stop, no park, no resume, no episode event; admission gating refuses a new dispatch inside a provider-entry window exactly as delivered; the composition fact reports `iteration-start-gating`; no zero-spend reading is synthesized for a park that did not happen.
- The key is resolved for each admitted change; it never rewrites an already parked lane and never disables `dispatch stop`.

**Notes / Clarifications**:

- The already-open-at-start case is out of scope with the declared one-cadence-plus-applied-grace residual (NG-10, RSK-12); this scenario asserts no pre-session representation and no pre-session park.

#### TC-PEAK-016 - `dispatch stop` works identically when automatic pausing is disabled

**Scenario Type**: Edge Case
**Impact Level**: Important
**Priority**: High
**Related IDs**: F-8, F-9, F-10, AC-F8-2
**Test Type(s)**: Integration
**Automation Level**: Automated
**Target Layer / Location**: `tests/behaviour/dispatch-stop.test.ts` (new), reusing the TC-PEAK-018 comparison fixture
**Tags**: @backend, @stop

**Preconditions**:

- A running lane under `lane.disable-peak-pausing: true`.
- The same running lane fixture under pausing enabled as the control.
- An injected clock and a scripted stop seam.

**Steps**:

1. Issue `dispatch stop <ref> --cause peak-window --until <iso>` under the disabled setting.
2. Use the same injected clock and deterministic episode-id factory as the enabled control, then compare the stop request, park record, and event payloads with that control.
3. Advance the clock to the declared end and observe the resume.

**Expected Outcome**:

- The stop, park, and events are identical to the enabled case, payload for payload.
- The lane resolves at its declared end by the same classification-routed resume.
- The setting governs automatic policy only; operator intent is not suppressed.

#### TC-PEAK-017 - An invalid disabling value is refused by name with no partial effect

**Scenario Type**: Negative
**Impact Level**: Important
**Priority**: High
**Related IDs**: F-8 (derived, not an acceptance criterion), DM-6, NFR-8
**Test Type(s)**: Contract, Integration
**Automation Level**: Automated
**Target Layer / Location**: `tests/behaviour/dispatch-peak-setting.test.ts`, with the invalid lane cases in `tests/fixtures/config/lane.ts` and the resolver assertions in `tests/behaviour/config-lane.test.ts`
**Tags**: @backend, @config

**Preconditions**:

- Lane configuration sources with a non-boolean value for `lane.disable-peak-pausing`, for example a string or a number.
- The delivered error table loaded for identity comparison.

**Steps**:

1. Resolve the lane configuration with the invalid value.
2. Read the refusal identity, the named key, and the exit projection.
3. Attempt a dispatch admission with the same configuration.

**Expected Outcome**:

- The delivered configuration refusal is returned and names `lane.disable-peak-pausing`; no new error identity or error-table row is introduced.
- No partial effect: no lane is admitted and no watch is composed.
- The refusal is the delivered identity at its delivered exit.

#### TC-PEAK-018 - `dispatch stop --cause peak-window --until` equals a window-open stop, payload for payload

**Scenario Type**: Happy Path
**Impact Level**: Critical
**Priority**: High
**Related IDs**: F-9, AC-F9-1, NFR-1, NFR-2, DM-1, DM-2, events `stop`, `parked`, `park-edge`
**Test Type(s)**: Integration
**Automation Level**: Automated
**Target Layer / Location**: `tests/behaviour/dispatch-stop.test.ts` (new), sharing the episode assertions of `tests/behaviour/dispatch-peak-episode.test.ts`
**Tags**: @backend, @stop

**Preconditions**:

- A running dispatch lane whose durable lane record carries the nominated `providerProfile`.
- An injected clock and a recording stop seam.
- The same deterministic episode-id factory for both arms.
- A declared end passed through `--until`, and the `peak-window` cause passed through `--cause`.

**Steps**:

1. Issue `dispatch stop <ref> --cause peak-window --until <iso>`.
2. Read the stop request, the park record, and the three projected events.
3. Assert the park and event payloads carry the profile read from the durable lane record, not a re-resolution.
4. Run the window-open stop on an identically seeded lane at the same instant, using the same injected clock and deterministic episode-id factory.
5. Compare the two episode payloads exactly; only the invocation form differs.

**Expected Outcome**:

- The stop request is the same bounded-grace request a window-open stop sends; the applied grace is the composed `graceMs` of AC-F3-3 / AC-F9-2.
- The park carries cause `peak-window`, the operator's declared end, the grace deadline, the stop instant, the episode id, the preservation classification, and the profile from the lane record.
- Exactly one `stop`, one `parked`, and one `park-edge` are recorded with the same payloads as the window-open stop.
- At the declared end the lane resumes by the same classification-routed resume.

#### TC-PEAK-019 - `dispatch stop` never kills; one terminate call with the composed grace; park only after a confirmed terminate

**Scenario Type**: Negative
**Impact Level**: Critical
**Priority**: High
**Related IDs**: F-9, F-10, AC-F9-2, AC-F10-1, NFR-1
**Test Type(s)**: Integration, Structure
**Automation Level**: Automated
**Target Layer / Location**: `tests/behaviour/dispatch-stop-safety.test.ts` (new), reusing the delivered terminate-path fixtures from the dispatch stall and coordinator kill suites
**Tags**: @backend, @stop, @safety

**Preconditions**:

- A running lane with an identified session and process target.
- A recording terminate seam that observes TERM and KILL requests, the single `graceMs` input, the target listing, and whether the terminate is confirmed.
- Three arms where a different bound is the smallest: the remaining profile grace, the delivered kill grace, and the time to the effective end.
- An unknown-session arm and an unconfirmed-terminate arm in which no live process matches the recorded session's exact identity.
- A terminate-less harness arm where the harness exposes no terminate capability; `lanes` reports `iteration-start-gating` because no watch is composed.
- A store snapshot that shows when the park is appended relative to the terminate result.

**Steps**:

1. Issue `dispatch stop <ref> --cause peak-window --until <iso>` on each bound arm.
2. Record every signal request, its order, its target, the `graceMs` the one terminate call receives, and the park append relative to the confirmed terminate.
3. Run the unknown-session arm and the unconfirmed-terminate arm.
4. Run the terminate-less-harness arm; assert no terminate call is made, the classified refusal is returned, no park or event is written, and `lanes` reports `iteration-start-gating`.
5. Run the structure guard over the command path for any second signalling route.

**Expected Outcome**:

- The command sends no signal of its own; exactly one terminate call reaches the delivered terminate path.
- The call's `graceMs` is the smallest of the remaining profile grace deadline, the delivered kill grace, and the time to the effective window end; the applied grace never outlasts the buffer.
- TERM is requested before KILL; KILL follows only after that grace and only over a target still listed.
- The park is appended only after a confirmed terminate; an unconfirmed terminate writes no `stop`, no `parked`, and no `park-edge`, and is the not-running refusal of TC-PEAK-020.
- The terminate operation's own idempotence on an unknown session is its contract, not the command's licence to record an episode; the command still refuses when no live exact identity matched.
- Terminate-less harness arm: when the harness exposes no terminate capability, no terminate call is made, the classified refusal is returned, no park or event is written, and `lanes` reports `iteration-start-gating` with no watch composed.
- No second signal path, pattern, process-group signal, or kill mechanism exists.

#### TC-PEAK-020 - A stop for a terminal, absent, session-less active, any-open-park, or unconfirmed-terminate lane is refused

**Scenario Type**: Negative
**Impact Level**: Critical
**Priority**: High
**Related IDs**: F-10, AC-F10-1, NFR-8, RSK-7, RSK-14
**Test Type(s)**: Integration
**Automation Level**: Automated
**Target Layer / Location**: `tests/behaviour/dispatch-stop-refusal.test.ts` (new), extending `tests/behaviour/dispatch-attempts-refusals.test.ts` and the delivered unmet-precondition family
**Tags**: @backend, @stop, @refusal

**Preconditions**:

- Five arms for the newest lane record: terminal, absent, active without a session identity, active with an open park of any cause standing, and a running record whose terminate cannot be confirmed.
- The any-open-park arm includes a non-`peak-window` cause, because the delivered duplicate invariant counts every cause.
- A repository-wide pass arm with multiple stuck refs.
- A store snapshot and a read counter before each command.

**Steps**:

1. Snapshot the record set and the store read count for each arm.
2. Issue `dispatch stop <ref> --cause peak-window --until <iso>` on each arm.
3. Read the refusal identity, the exit, and the bounded summary.
4. Run the repository-wide pass arm and read its recovery-refusal summary.
5. Compare each record set with its snapshot, and count the open parks for the ref.

**Expected Outcome**:

- Every arm refuses with the delivered classified unmet-precondition identity at its delivered exit; no new identity or row.
- The summary names the work item and the observed lane state within the evidence bound, and distinguishes terminal, absent, session-less active, any-open-park, and unconfirmed-terminate states.
- The any-open-park arm appends no second park, whether the standing park is `peak-window` or another cause; the open-park count for the ref stays one, so the park-reading surfaces cannot see two active parks.
- The unconfirmed-terminate arm writes nothing, because a terminate with no live exact identity match is not a confirmed stop.
- Repository-wide pass: the recovery-refusal summary names the stuck refs.
- No park record, episode event, attempt, lane, or queue record is appended; nothing is signalled; the cost is read-like and bounded.

#### TC-PEAK-021 - An active owner hold does not change the watch or the park, and the lease keeps renewing

**Scenario Type**: Corner Case
**Impact Level**: Important
**Priority**: High
**Related IDs**: F-11, AC-F11-1
**Test Type(s)**: Integration
**Automation Level**: Automated
**Target Layer / Location**: `tests/behaviour/dispatch-peak-owner-hold.test.ts` (new), extending `tests/behaviour/queue-hold-park-resume.test.ts` and the owner-hold fact fixtures
**Tags**: @backend, @owner-hold

**Preconditions**:

- An active owner hold resolved from an injected marker.
- A dispatch lane whose nominated profile opens a window.
- A park record snapshot before the hold is cleared.
- A lease heartbeat and renewal record read across several renewal cadences while the hold is active.

**Steps**:

1. Run the watch with the hold active and the window open.
2. Read the park record, any record the hold itself wrote, and the lease heartbeat and renewal records across several cadences.
3. Advance to the recorded end with the hold still active and run resume admission.
4. Clear the hold and run the next resume observation.

**Expected Outcome**:

- The lane still parks `peak-window` with `until`; the hold writes no park record of its own.
- The lease keeps renewing at the derived cadence while the hold is active, because the renewal does not pass the owner-hold gate; the lease never goes stale.
- Resume admission refuses the delivered owner-hold precondition and appends nothing.
- Once the hold clears the lane resumes, and the existing park record is byte-unchanged throughout.

#### TC-PEAK-022 - Per-profile isolation: only the lane in an open window parks and resumes

**Scenario Type**: Happy Path
**Impact Level**: Important
**Priority**: High
**Related IDs**: F-11, F-2, AC-F11-2
**Test Type(s)**: Integration
**Automation Level**: Automated
**Target Layer / Location**: `tests/behaviour/dispatch-peak-isolation.test.ts` (new), extending `tests/behaviour/daemon-peak-window-isolation.test.ts`
**Tags**: @backend, @isolation

**Preconditions**:

- Two dispatch lanes, one nominated to a profile with an open window and one to a profile with no open window.
- Distinct leases and independent supervision facts for both.
- An injected clock.

**Steps**:

1. Run both watches at the same instant.
2. Read the park records and the stop requests.
3. Advance to the first lane's end and run resume.
4. Read both lanes' leases, sessions, and supervision facts.

**Expected Outcome**:

- Only the open-window lane parks and resumes; the other lane is never stopped and records no peer episode.
- The first lane keeps renewing its own lease through the park; the second lane keeps its lease, its session, and its supervision unchanged.
- The decision reads one lane's recorded nomination and that profile's window state only; no cross-profile inference.

#### TC-PEAK-023 - Zero-spend reading is positive zero with present telemetry and a classified absence otherwise

**Scenario Type**: Happy Path
**Impact Level**: Critical
**Priority**: High
**Related IDs**: F-12, AC-F12-1, NFR-3
**Test Type(s)**: Integration
**Automation Level**: Automated
**Target Layer / Location**: `tests/behaviour/dispatch-peak-spend.test.ts` (new), extending `tests/behaviour/spend-zero-window.test.ts` and the telemetry fixtures
**Tags**: @backend, @spend

**Preconditions**:

- A completed episode with a recorded park instant and park end.
- A seeded telemetry ledger with present, attributable telemetry and no call inside the interval.
- A second arm with telemetry absent.

**Steps**:

1. Take the window-scoped reading from the park instant through the park end, both boundaries inclusive, over present telemetry.
2. Read the telemetry state and the basis.
3. Take the same reading over absent telemetry.

**Expected Outcome**:

- Present telemetry: the count of billable calls attributable to the lane is zero, the telemetry state is disclosed, and the reading names its basis.
- Absent telemetry: the reading is a classified absence, never a fabricated zero; the two renderings are mutually exclusive in the same run.
- No billable call, session operation, or provider request is issued by the wait itself.
- Billing before the park is outside this reading's scope and is the declared one-cadence-plus-applied-grace residual (RSK-12); the reading starts at the park instant.

#### TC-PEAK-024 - A seeded mid-window call makes the zero-spend claim fail

**Scenario Type**: Negative
**Impact Level**: Critical
**Priority**: High
**Related IDs**: F-12, AC-F12-2, NFR-3
**Test Type(s)**: Integration
**Automation Level**: Automated
**Target Layer / Location**: `tests/behaviour/dispatch-peak-spend.test.ts`, reusing the telemetry seeding fixture
**Tags**: @backend, @spend

**Preconditions**:

- The same episode interval as TC-PEAK-023.
- A seeded billable model call attributed to the lane at an instant inside the interval, including a boundary instant in a second arm.

**Steps**:

1. Seed the mid-window call.
2. Take the same window-scoped reading.
3. Repeat with the call at the park instant and at the park end.

**Expected Outcome**:

- The count is greater than zero, so the zero claim is falsifiable.
- Both inclusive boundaries are covered: a call exactly at either boundary is counted.
- The reading still discloses its telemetry state and basis.

#### TC-PEAK-025 - Resume admission re-checks the window and never resumes into an open window

**Scenario Type**: Corner Case
**Impact Level**: Important
**Priority**: High
**Related IDs**: F-4 (derived, not an acceptance criterion), RSK-6
**Test Type(s)**: Integration
**Automation Level**: Automated
**Target Layer / Location**: `tests/behaviour/dispatch-peak-resume.test.ts`, alongside TC-PEAK-008
**Tags**: @backend, @resume, @config

**Preconditions**:

- A preserved episode with a recorded end.
- A rule change during the episode that opens the same profile's next contiguous window, or widens the current one, before the recorded end.
- The injected clock advanced to the recorded end.

**Steps**:

1. Park the lane under the original rule set.
2. Change the nominated profile's rule data so the window remains open at the recorded end.
3. Run resume admission.
4. Close the window and run the next resume observation.

**Expected Outcome**:

- Resume admission re-evaluates the nominated profile's window rules and refuses to resume into an observed open window; the lane stays parked rather than resuming early.
- The park record is untouched; no `resumed` event is emitted while the window is open.
- Once the window is observed closed, the lane resumes according to its classification.

#### TC-PEAK-026 - The delivering suites are hermetic: zero live resources, zero real sleeps

**Scenario Type**: Negative (guard)
**Impact Level**: Critical
**Priority**: High
**Related IDs**: NFR-5, NFR-7
**Test Type(s)**: Check
**Automation Level**: Automated
**Target Layer / Location**: `tests/checks/peak-pause-hermetic.test.ts` (extended) and `tests/checks/dispatch-peak-hermetic.test.ts` (new only if the watched-file set outgrows the existing suite)
**Tags**: @backend, @hermetic

**Preconditions**:

- The list of modules and tests the dispatch peak-pause suites drive, including the new fixtures and command paths.
- Armed canaries for `fetch`, credential access, and real sleep/timer use.
- A counted wake and renewal spy that distinguishes an observation from a derived-cadence renewal wake.

**Steps**:

1. Arm the network, credential, and sleep canaries with a proven-firing control.
2. Run a full park, wait, and resume pass over the injected seams.
3. Scan the watched sources for direct network, credential-read, `setTimeout`, and real-sleep calls outside the declared seam.
4. Measure the wake count over the elapsed wait and assert it is at most `elapsed / min(lane.liveness-interval, queue.lease-ttl / 2) + 1`; a derived-cadence renewal wake is a renewal, not an extra observation.
5. Assert the canaries counted zero calls and the scan found no violation.

**Expected Outcome**:

- Zero live network calls, zero credential reads, zero real sleeps, and temp-directory state only.
- The wake bound is `elapsed / min(lane.liveness-interval, queue.lease-ttl / 2) + 1`; a renewal wake on the derived cadence is not an extra observation.
- The guard fails if a watched module introduces a live resource call; it cannot pass vacuously.

#### TC-PEAK-027 - Vocabulary economy and event evidence bounds hold, including the consecutive-episode shape

**Scenario Type**: Regression (contract)
**Impact Level**: Important
**Priority**: High
**Related IDs**: NFR-8, events `stop`, `parked`, `resumed`, `park-edge`, DM-1
**Test Type(s)**: Contract, Check
**Automation Level**: Automated
**Target Layer / Location**: `tests/structure/event-taxonomy-integrity.test.ts`, `tests/checks/event-taxonomy-conformance.test.ts`, `tests/structure/error-table.test.ts`, `tests/checks/error-table-sync.test.ts`, `tests/checks/decision-record.test.ts`, and a narrow `tests/structure/dispatch-peak-contract.test.ts` only if the additive contract needs its own closed-set assertion
**Tags**: @backend, @contract

**Preconditions**:

- The delivered taxonomy declarations, the error table, the result-token set, and the event payload bound constants.
- A dispatch-owned park record with a complete episode frame.

**Steps**:

1. Assert the closed sets carry exactly one added error-table row, `dispatch.resume-parked` (exit 2), with its declared fields and remediation, and no other added event kind, record kind, schema identity, result token, or reason.
2. Assert the row is documented on `doc/spec/features/feature-result-contract.md` (the sync check fails an undocumented source row), and that the decision-record case asserts TDR-0077 states the row.
3. Project the four episode frames and measure payload fields and evidence bytes.
4. Assert the not-running refusal reuses a delivered identity; the only added row is `dispatch.resume-parked`.

**Expected Outcome**:

- Exactly one added error-table row, `dispatch.resume-parked` (exit 2), an owner-authorised exception; no other added kind, record kind, schema identity, result token, or reason.
- The row is documented on `doc/spec/features/feature-result-contract.md`, and the decision-record case asserts TDR-0077 states the row.
- Every projected frame stays within at most 20 payload fields and 1024 bytes; every frame stays inside the delivered eight-field envelope.
- Overlapping windows project consecutive episodes, each with one `stop`, one `parked`, and one `park-edge`; no union frame and no shared episode id are introduced.
- A budget-exhaustion terminal refusal adds no episode event frame; it is carried by the delivered terminal exhaustion record and the result's bounded episode fact, not by a status/park surface, a new event, or the park record.
- The new producers conform to the delivered declarations without a version move.

#### TC-PEAK-028 - The change's changeset exists before the first gate run

**Scenario Type**: Check (release)
**Impact Level**: Important
**Priority**: High
**Related IDs**: Owner delivery note 1; delivered TC-RELEASE-001
**Test Type(s)**: Check
**Automation Level**: Automated
**Target Layer / Location**: `tests/checks/privacy-release.test.ts` (the delivered TC-RELEASE-001) and the tree invariant `tests/structure/changeset-additivity.test.ts`; no new suite
**Tags**: @backend, @release

**Preconditions**:

- The change edits publishable `packages/**` paths.
- The change's own changeset file is present in `.changeset/` before the first gate run.

**Steps**:

1. Before the first `pnpm check`, confirm the change's changeset file exists.
2. Run `bun test tests/checks/privacy-release.test.ts tests/structure/changeset-additivity.test.ts`.
3. Read the changeset shape: exactly one new changeset for the five publishable packages at `minor`, `@delivery-os/testkit` absent, a non-empty body, and pre-existing changesets byte-identical.

**Expected Outcome**:

- TC-RELEASE-001 passes; the change ships exactly one new five-package minor changeset.
- The full battery is not started with a missing changeset, avoiding a wasted gate run.

**Notes / Clarifications**:

- This is the owner's stated delivery order, not a new product requirement. The test is the delivered release assertion.

#### TC-PEAK-029 - The reference host observes one real episode on the next lane after the upgrade; the pm-notes and PR record the hand-off

**Scenario Type**: Manual (operational, post-upgrade hand-off)
**Impact Level**: Important
**Priority**: Medium
**Related IDs**: Owner delivery note 3; spec section 18.1 item 7; F-1 through F-12 observed end to end
**Test Type(s)**: Manual
**Automation Level**: Manual
**Target Layer / Location**: Reference host, the next lane after this change is installed; the change's pm-notes record the hand-off and its preconditions before `dod_check`, and the pull-request phase carries them into the PR description; section 10 carries the row
**Tags**: @manual, @operational

**Preconditions**:

- This change is installed on the reference host. The episode is observed by the reference host on the next lane after the upgrade, not by this delivering lane and not on the pre-change binary.
- The reference host's tracked `.jaiship/config.yaml` declares the nominated profile (`delivery`) with `peakWindows` at 01:00-04:00 and 06:00-10:00 UTC, so the next lane is pausable and the incident's window is covered. This is the tracked fact verified before Done (spec section 12, DoD item 8).
- Activity-keyed liveness consumers (`pm-liveness`, `deliver-ticket`, `ceo-loop`, and any operator probe with the same shape) are relaxed or exclude a parked lane, so the silent wait is not read as a stall and killed (DEC-19, RSK-2).
- Automatic pausing is on (`lane.disable-peak-pausing` unset or `false`).

**Steps**:

1. After the upgrade, the reference host dispatches the next lane on a schedule that crosses one declared `peakWindows` interval.
2. Observe `dispatch status <ref>`, `lanes`, and `board` while the lane is parked: cause, `until`, recorded stop instant, `leaseHolder`, and the probe verdict under the delivered rule.
3. Observe the resume at the window's end and the one result whose summary states paused and resumed.
4. Before `dod_check`, record in the change's pm-notes the hand-off itself: the tracked profile fact, the liveness relaxation, the expected 04:00-04:05Z overlap churn, and the command sequence used to observe the episode; the pull-request phase carries them into the PR description.
5. When the next lane has run, record the episode id, park and resume instants, derived lags, zero-spend reading, and one-result summary in the pm-notes and fill the TC-PEAK-029 row in section 10 with the observation date, result, and evidence link.

**Expected Outcome**:

- The change's pm-notes record the hand-off and its preconditions before `dod_check`, and the pull-request phase carries them into the PR description: the nominated profile declares `peakWindows` (the tracked fact), the activity-keyed liveness relaxation is in place, and the tracked profile's 04:00-04:05Z overlap may show a short resume and a second park (DEC-20, RSK-13).
- The real episode, once observed, shows exactly one `stop`, one `parked`, one `park-edge`, and one `resumed` per episode; a second overlapping episode is also exactly once. The session, branch, worktree, change folder, phases, queue state, and live lease survive; no second session exists; the zero-spend reading is zero over present telemetry; the one result states paused and resumed.
- The automated fixtures remain the merge gate. The episode is a post-upgrade observation, explicitly non-gating; the recorded hand-off is named in the DoD, while the episode itself is not a Done criterion.

**Notes / Clarifications**:

- The episode is not performed by the delivering lane: that lane runs on the pre-change binary and holds this repository's lease. The pm-notes record the hand-off and the PR carries it; neither claims an episode that has not happened.

#### TC-PEAK-031 - Every active lane record carries the nomination, including after a restart and a post-park resume

**Scenario Type**: Happy Path
**Impact Level**: Critical
**Priority**: High
**Related IDs**: F-2, AC-F2-3, DM-2, DEC-16
**Test Type(s)**: Integration
**Automation Level**: Automated
**Target Layer / Location**: `tests/behaviour/dispatch-peak-nomination.test.ts` (new), reading the durable lane record through the store harness
**Tags**: @backend, @nomination

**Preconditions**:

- A lane admitted under a named nominated profile.
- A restart iteration and a post-park resume in the same fixture, each appending a new `active` lane record.
- A pre-change lane record fixture with no `providerProfile`.
- A park episode produced after the restart.

**Steps**:

1. Read the newest durable lane record after the first acquisition, after the restart iteration, and after the post-park resume.
2. After the restart, read the park and event payloads and the stop path's profile source.
3. Load the pre-change record and run the watch over it.

**Expected Outcome**:

- Every `active` lane record the invocation appends carries the nominated `providerProfile`, not only the first record; a latest-wins read finds it after the restart and after the resume.
- The park and event payloads, and a stop issued after the restart, carry the same profile read from the newest record rather than re-resolved or defaulted.
- The pre-change record reads no nomination, is not window-pausable, and is never given a fabricated value; no lane is re-nominated.

#### TC-PEAK-032 - One terminate call carries the composed grace; escalation cannot outlast the buffer

**Scenario Type**: Happy Path
**Impact Level**: Critical
**Priority**: High
**Related IDs**: F-3, AC-F3-3, NFR-1, event `stop`
**Test Type(s)**: Integration
**Automation Level**: Automated
**Target Layer / Location**: `tests/behaviour/dispatch-peak-stop-grace.test.ts` (new), reusing the recording terminate seam of the dispatch stall and coordinator kill suites
**Tags**: @backend, @stop, @grace

**Preconditions**:

- A running lane and a recording terminate seam that exposes the single `graceMs` input, TERM and KILL order, and the target listing.
- Three arms where a different bound is smallest: the remaining profile grace deadline, the delivered kill grace, and the time to the effective window end.

**Steps**:

1. Run the watch stop on each bound arm and record the terminate call's `graceMs`, its order, and its target.
2. Repeat with a small buffer where the time to the effective end is the smallest bound.
3. Assert the recorded deadline against the profile's derived maximum.

**Expected Outcome**:

- Exactly one terminate call is issued per stop; no additional call or signal path exists.
- `graceMs` equals the smallest of the three bounds, so the escalation never outlasts the buffer protecting the window.
- TERM precedes KILL; KILL follows only after the composed grace and only over a target still listed.
- The recorded grace deadline never exceeds the profile's derived maximum.

#### TC-PEAK-033 - The production composition mode is configuration-derived in both settings

**Scenario Type**: Happy Path
**Impact Level**: Critical
**Priority**: High
**Related IDs**: F-6, F-8, AC-F6-4, DM-7, NFR-9
**Test Type(s)**: Integration, Contract
**Automation Level**: Automated
**Target Layer / Location**: `tests/behaviour/dispatch-peak-mode.test.ts` (new), using the production composition factory at `tests/fixtures/queue/production/harness.ts` (the real `createProductionComposer`)
**Tags**: @backend, @mode

**Preconditions**:

- The production composition with automatic pausing enabled and the same composition with it disabled.
- Durable park records in both arms so `parkClaimed` is observable.
- A control that proves the fixture reaches `tests/fixtures/queue/production/harness.ts`, not the test-only `peakWatchComposed` override in `peak-pause-composed-edge.test.ts`.

**Steps**:

1. Read `lanes --json` on the production composition with pausing enabled.
2. Read it again with pausing disabled.
3. Compare `peakEnforcement.mode` and `parkClaimed` with the durable park records in both arms.

**Expected Outcome**:

- Enabled: `peakEnforcement.mode` is `window-watch`; disabled: `iteration-start-gating`.
- The mode is derived from the reading composition's own effective configuration, never from another process or a test override.
- `parkClaimed` follows the durable park records in both arms; no third mode value appears.

#### TC-PEAK-034 - A stop with another cause, a missing end, or an invalid end is a grammar refusal

**Scenario Type**: Negative
**Impact Level**: Important
**Priority**: High
**Related IDs**: F-9, AC-F9-3, NFR-8, DEC-21
**Test Type(s)**: Integration
**Automation Level**: Automated
**Target Layer / Location**: `tests/behaviour/dispatch-stop-cause.test.ts` (new), with grammar and refusal patterns from `tests/behaviour/dispatch-stop-refusal.test.ts`
**Tags**: @backend, @stop, @refusal

**Preconditions**:

- A running lane and a store read counter.
- Causes outside the admitted set, including `owner-hold` and `liveness-stall`, and an invocation with no `--until`.
- A canonical `Z` end form, a past end, and a non-canonical end form.

**Steps**:

1. Snapshot the store and the read count.
2. Issue `dispatch stop <ref>` with each disallowed cause, and separately with no end.
3. Issue `dispatch stop <ref> --cause peak-window --until <canonical-Z>` and read the success.
4. Issue the same with a past end and with a non-canonical end; read each refusal.
5. Read the refusal identity, the named cause or end, and the exit.
6. Compare the store and read count with the snapshot.

**Expected Outcome**:

- Each disallowed cause and the missing end are refused `input.value.rejected` at the grammar boundary before any lane read or write; this refusal adds no error-table row, and the only added row remains `dispatch.resume-parked`.
- A missing end is `input.value.rejected` with the `until-required` reason and names the missing end; no release-grammar comparison is asserted.
- The canonical `Z` end is accepted and proceeds; a past end and a non-canonical end are refused `input.value.rejected` and write nothing.
- Nothing is written and nothing is signalled; the refusal stays inside the evidence bound.

#### TC-PEAK-035 - The stop success output and the owning invocation's post-collection re-read, wait and resume

**Scenario Type**: Happy Path
**Impact Level**: Critical
**Priority**: High
**Related IDs**: F-9, AC-F9-4, DM-8, DM-9, DEC-15
**Test Type(s)**: Integration
**Automation Level**: Automated
**Target Layer / Location**: `tests/behaviour/dispatch-stop-handoff.test.ts` (new), running a separate stop command and the owning invocation over one durable store with an injected clock
**Tags**: @backend, @stop, @handoff

**Preconditions**:

- A running lane whose owning invocation is alive and waiting.
- A durable lane record carrying the session identity, the tree root (recorded worktree path, or the main checkout for a `lane.disable-worktrees` record), and the nomination.
- A separate stop command process over the same store.
- An injected clock and a deterministic episode factory.
- A renewal spy covering the withhold window, so the renewal instants can be measured against the earlier cadence.
- An ordering in which the owning invocation's collection resolves before the park record is durable, and one in which the park is already durable.

**Steps**:

1. Invoke `dispatch stop <ref> --cause peak-window --until <iso>` from the separate command.
2. Read the human line, the machine data, and the exit; assert the answer occurs only after the confirmed terminate and the park append.
3. Run the owning invocation's post-collection step; observe that it withholds terminal classification for at least the applied grace plus one observation cadence and re-reads the park record.
4. During the withhold, measure the renewal instants and assert renewals occur at the earlier cadence `min(lane.liveness-interval, queue.lease-ttl / 2)`, not at the withhold cadence.
5. Repeat with the park already durable before collection.
6. Advance to the recorded end and observe the resume and the one result.

**Expected Outcome**:

- The human output is one line naming the work item, cause, park end, and episode id.
- The machine data carries the work item, cause, park end, episode id, and preservation classification at exit `0`; no new envelope shape or key family.
- The command answers only after a confirmed terminate and the park append; an unconfirmed terminate never produces success output.
- When the park lands after collection, the owning invocation's grace-plus-cadence re-read finds the open `peak-window` park and enters the wait and resume path instead of classifying terminal; when the park is already durable, the same path is taken. The bound is at least the applied grace plus one observation cadence because the terminate call awaits the whole grace before the park append.
- Withhold renewal measurement: across the withhold window, renewals occur at the earlier cadence `min(lane.liveness-interval, queue.lease-ttl / 2)`, not at the withhold cadence; the lease stays live through the withhold.
- The worktree-or-main-checkout tree root is used to match the session; the path-less in-checkout shape is accepted.
- The owning invocation keeps renewing the lease, waits, and resumes at the end; the lane returns one result whose summary states paused and resumed.

#### TC-PEAK-036 - A stop racing a session end resolves exactly one outcome, including a park after collection

**Scenario Type**: Corner Case
**Impact Level**: Critical
**Priority**: High
**Related IDs**: F-10, F-9, AC-F10-2, NFR-2, NFR-8, DEC-15, RSK-7
**Test Type(s)**: Integration
**Automation Level**: Automated
**Target Layer / Location**: `tests/behaviour/dispatch-stop-race.test.ts` (new), with a deterministic clock and a store snapshot
**Tags**: @backend, @stop, @race

**Preconditions**:

- A session that can be made to end at the same observation in which a stop is resolved.
- A store snapshot and a record-kind counter.
- Three orderings: the stop resolves first, the session end resolves first, and the session end is observed by the owning invocation before the park record is durable.

**Steps**:

1. Run the stop and the session end in each ordering at the same injected instant.
2. For the third ordering, run the owning invocation's post-collection re-read for at least the applied grace plus one observation cadence and read whether it finds the park.
3. Read the outcome class, the park record, the episode events, and the lane record.
4. Compare the store with the expected single outcome for each ordering.

**Expected Outcome**:

- Exactly one classified outcome per request: either the confirmed terminate with the complete episode and one `stop` and one `parked`, or the not-running refusal.
- No partial episode, duplicate park, or write from the losing side; a request that loses the race writes nothing.
- Third ordering: the invocation's grace-plus-cadence re-read catches the park that lands after collection and takes the wait and resume path instead of classifying terminal; the outcome is still a single episode.
- The lane record and the durable park state agree with the single chosen outcome; no two active parks exist for the ref.

#### TC-PEAK-037 - A complete park and resume loses nothing, reuses the worktree, and recovers a standing park

**Scenario Type**: Happy Path
**Impact Level**: Critical
**Priority**: High
**Related IDs**: F-5, AC-F5-1, AC-F3-4, NFR-4, DM-1, DM-9, RSK-14
**Test Type(s)**: Integration
**Automation Level**: Automated
**Target Layer / Location**: `tests/behaviour/dispatch-peak-preservation.test.ts` (new), using the temporary git repository and store snapshots; the lease arms are TC-PEAK-010
**Tags**: @backend, @preservation

**Preconditions**:

- A lane with a branch, a change folder with recorded phases, a queue entry, a live lease, and a recorded worktree.
- A complete park and resume episode over the injected clock.
- A standing expired `peak-window` park from an earlier episode, so the next run must recover it before its first stop decision.
- A snapshot function for branch tip, change-folder file set and content, phase list, queue state, worktree path, session identity, lease record identity, and the active-park count.

**Steps**:

1. Take the snapshot before the park.
2. Park the lane; read the parked interval's lease and worktree facts.
3. Advance to the recorded end, resume, and wait for the terminal classification.
4. Run the next invocation over the standing expired park; observe the delivered `recoverQueueParks` pass before its first stop decision and count active parks.
5. Take the snapshot after the resume and compare every element.

**Expected Outcome**:

- Branch, change folder, recorded phases, and queue state are unchanged; nothing is deleted, rewritten, requeued, or duplicated.
- The recorded worktree is reused and not re-provisioned; the same session is resumed.
- The lease remains live through the parked interval at the derived renewal cadence, and its record identity is unchanged.
- Standing-park arm: the standing expired park is recovered (clear-observed marker, recovered record, `park-auto-recovery` incident) before the next episode; the ref carries one active park and one new episode, never two.
- No second session and no second episode exist for the work item.
- The TTL-crossing lease arms, including interval-above-TTL, heartbeat-ownership no-op, and re-dispatch, are TC-PEAK-010; this scenario asserts that the episode preserves the work and keeps the same lease.

#### TC-PEAK-038 - A standing peak-window park is recovered or refused before a new episode; occupancy prevents a double park

**Scenario Type**: Happy Path
**Impact Level**: Critical
**Priority**: High
**Related IDs**: F-3, F-5, AC-F3-4, NFR-2, DM-1, RSK-14, event `resumed`
**Test Type(s)**: Integration
**Automation Level**: Automated
**Target Layer / Location**: `tests/behaviour/dispatch-peak-standing-park.test.ts` (new), over the store harness and the delivered `recoverQueueParks` mutating park pass
**Tags**: @backend, @recovery, @park

**Preconditions**:

- Three standing-park origins, one arm each: expired by time, orphaned after a killed invocation, and left by restart-budget exhaustion.
- A non-expired standing-park fixture for the pre-session refusal, and an expired standing-park fixture whose resume proceeds after recovery.
- A preserved standing-park fixture for the `dispatch.attempt/resumed` frame assertion.
- An unrecoverable standing-park fixture whose delivered recovery pass refuses.
- An ordering arm where the recovery pass is observed before the first spawn/resume.
- An injected clock, a store snapshot function, and an active-park counter for the ref.
- The delivered recovery record shape: clear-observed marker, recovered record, and `park-auto-recovery` incident.

**Steps**:

1. For each standing-park origin, run the run path to its first observation and assert the delivered `recoverQueueParks` pass runs before the first stop decision; assert the pass only ever meets an expired park or none.
2. Read the recovery evidence (clear-observed marker, recovered record, `park-auto-recovery` incident) and the active-park count for the ref.
3. Assert occupancy: any remaining standing `peak-window` park for the ref, whatever its `until`, suppresses a new stop; no second `stop` or `parked` is appended.
4. Run the unrecoverable arm; assert the recovery pass runs before the first spawn/resume, the run is refused with no park appended and no spawn or resume call, and the store is otherwise unchanged.
5. Run the non-expired refusal arm: a resume or a re-dispatch of a lane whose standing park has not expired is refused before any session starts, with the new dispatch-family `dispatch.resume-parked` error row: `projectionClass: platform-provider`, exit 2, category transient, retryable true, consequence `not_landed`, and remediation "Resume after the park's recorded `until`; the park stands and nothing was written." The bounded summary names the park's cause and `until`; no session, no park, and no event is written; assert `lanes` and `board` still show the lane parked.
6. Run the expired standing-park arm: at the first observation of the resuming invocation, the park is recovered through the delivered pass and the resume proceeds; assert exactly one active park and one new episode for the ref.
7. Run the preserved-standing-park arm through the delivered pass and read the projected frames.
8. Read the active-park count after every arm and assert it never exceeds one, so the permanent duplicate-invariant degradation (RSK-14) is absent.

**Expected Outcome**:

- The standing park is recovered through the delivered mutating pass before the first stop decision and at the first observation of a resuming invocation; the recovery evidence is the delivered clear-observed marker, recovered record, and `park-auto-recovery` incident, with no new event or record kind. The pass only ever meets an expired park or none.
- Occupancy holds: a remaining standing `peak-window` park for the ref suppresses a new stop regardless of its `until`; no second `stop` or `parked` is appended.
- The unrecoverable arm refuses the run as a classified failure, starts no new episode, and leaves the store unchanged.
- Non-expired refusal: the resume or re-dispatch is refused before any session starts with the new dispatch-family `dispatch.resume-parked` row at exit 2 (`projectionClass: platform-provider`, category transient, retryable true, consequence `not_landed`); the remediation is "Resume after the park's recorded `until`; the park stands and nothing was written." The bounded summary names the park's cause and `until`; no session, park, or event is written, and `lanes` and `board` keep showing the lane parked.
- Expired standing-park arm: at the first observation of the resuming invocation, the park is recovered through the delivered pass and the resume proceeds; exactly one active park and one new episode exist for the ref.
- Finding 4a: closing a `preserved` standing park through the pass projects a `dispatch.attempt/resumed` frame with an empty `sessionRef` and an empty `branch` under the original episode id, whether or not a session resumed; no new kind is introduced.
- Ordering invariant: the recovery pass runs before the first session; an unrecoverable standing park is refused without appending a park and without any spawn or resume call. There is no terminate arm for this case.
- The active-park count never exceeds one on any arm, so the delivered duplicate invariant cannot permanently degrade the park-reading surfaces (RSK-14).

## 6. Environments and Test Data

- **Runtime**: local development and CI, Bun pinned by `.bun-version`, `bun:test` discovery per `bunfig.toml`. No browser, no container, no external service.
- **State**: a temporary state store per fixture from `tests/fixtures/state/harness.ts` (`makeTempRoot`, `openStore`, `makeIdentity`, `removeRoot`), disposed in a `finally` block. No test writes to a real state root.
- **Git**: a temporary repository per lifecycle fixture for branch, worktree, change-folder, phase, and queue-state assertions, created by the harness inside its own temp directory. The fixture never runs in the developer checkout.
- **Injected seams**:
  - Clock: `nowIso` (or a controllable stepping clock) on `createCommandScenario`; the fixture advances time explicitly. No `setTimeout`, `Bun.sleep`, or real timer participates.
  - Delay: the delivered `DispatchDelay` seam, recording each requested delay and returning immediately; the wait's wake count is asserted over this spy.
  - Transport: the scripted `HarnessSessionPort` and the in-memory event transport pair; zero live provider, tracker, or network calls.
  - Restart and resume: the delivered restart-append and resume-economics seams, seeded with explicit budgets and counts.
  - Lease clock and TTL: the store harness's injected clock with the delivered 90 000 ms lease TTL, so TC-PEAK-010 can cross several TTLs without sleeping; renewal records are read from the existing lease record, including an interval-above-TTL configuration, a heartbeat-ownership no-op arm, a re-dispatch arm using the delivered `renewed` arm, and an owner-hold arm.
  - Standing-park pass: the delivered `recoverQueueParks` mutating park pass exercised over the three standing-park origins (expired, orphaned, budget-exhausted), with the clear-observed marker, recovered record, and `park-auto-recovery` incident observed, plus an unrecoverable arm, a non-expired pre-session refusal arm, an expired-resume arm, and a preserved-standing-park arm that projects the empty `sessionRef`/`branch` `resumed` frame.
  - Production composition: the delivered production composition factory at `tests/fixtures/queue/production/harness.ts` (the real `createProductionComposer`), with automatic pausing enabled and disabled, so TC-PEAK-033 cannot pass through a test-only watch override.
  - Stop seam and hand-off: a stop seam that records the stop-request instant, and one durable store shared by a separately invoked stop command and the owning invocation, with a deterministic clock and an episode factory; the session-end race and the post-collection park ordering are driven by the same fixture, and the owning invocation withholds classification for at least the applied grace plus one observation cadence.
- **Test data**:
  - Profile rule fixtures: a UTC profile with one window and buffers, a profile with overlapping windows to assert the first open window's end and the consecutive second episode, a profile with no `peakWindows`, a preference chain with a base entry that declares none, a small-buffer profile whose buffer is shorter than the delivered kill grace, and a grace-above-cadence profile.
  - Episode fixtures: deterministic episode-id factory, declared grace values below and at the derived maximum, preserved and not-preserved classifications, a budget-exhaustion terminal arm, an already-parked arm, an unconfirmed-terminate arm, and the `peak-window` operator cause with its declared end. No pre-session arm exists; that case is out of scope (NG-10, RSK-12).
  - Standing-park fixtures: an expired park with the next window open, an orphaned park after a killed invocation, a park left by budget exhaustion, an unrecoverable park, a non-expired park for the pre-session refusal, and a preserved park for the empty `sessionRef`/`branch` `resumed` frame.
  - Nomination fixtures: a lane record with the additive `providerProfile`, a pre-change lane record without it, a chain whose base entry has no windows, and a post-restart record.
  - Lease fixtures: a live lease with renewal records, a lease record near its TTL, an interval-above-TTL configuration, a heartbeat-ownership no-op arm, a re-dispatch arm using the delivered `renewed` arm (lease id preserved, newer heartbeat), a lost-lease arm, an owner-hold arm, and a second-dispatch admission probe.
  - Telemetry fixtures: a present ledger with no in-window call, a present ledger with a seeded in-window call at each inclusive boundary, and an absent-telemetry arm.
  - Surface fixtures: the existing status, lanes, board, brief, and result golden inputs, with and without an open park, and the two production mode values.
- **Isolation**: one temp root and one store per test, unique labels for attempt and divergence ids, no shared mutable module state. Tests run in any order. Every fixture is created inside the checkout or the change folder; no test or delivery step searches the file system outside them (owner delivery note 4).
- **Manual environment**: the reference host only, for TC-PEAK-029, on the next lane after the upgrade. Its evidence is a pm-notes hand-off record carried into the PR and the eventual episode record, never a hidden local step.
- **Gate environment**: `TMPDIR=$PWD/tmp/tmpdir` for the aggregate gate, as the repository's `ci-baseline-parity` cross-device requirement expects.

## 7. Automation Plan and Implementation Mapping

Implementation order follows the plan's phase order, which is the authority for phase numbering: the policy key and changeset (phase 1), lease liveness (phase 2), the watch and episode (phase 3), the surfaces and result (phase 4), the operator stop (phase 5), cross-cutting proof (phase 6), decision records (phase 7), and the release/hand-off declaration (phase 8). Each phase adds tests for what it changes and leaves the delivered behaviour intact when its part is not exercised.

Execution guidance from the owner, recorded here as delivery guidance and not as a new requirement:

- While implementing, run only the affected suites, for example `bun test tests/behaviour/dispatch-lease-liveness.test.ts tests/behaviour/dispatch-peak-standing-park.test.ts tests/behaviour/dispatch-peak-*.test.ts tests/behaviour/dispatch-stop*.test.ts tests/behaviour/config-lane.test.ts`.
- Run the whole battery once at the gate: `pnpm check`, with `TMPDIR=$PWD/tmp/tmpdir`.
- Create the change's changeset before the first gate run (TC-PEAK-028).
- Do not search the file system outside the checkout and the change folder (owner delivery note 4). Every fixture and every command below stays inside them.

| TC ID | Test file | Execution command | Injection / mocking | Plan phase | Status |
|-------|-----------|-------------------|---------------------|------------|--------|
| TC-PEAK-001 | `tests/behaviour/dispatch-peak-parity.test.ts` | `bun test tests/behaviour/dispatch-peak-parity.test.ts` | Injected clock and shared rules lookup over both compositions | 3 | To Implement |
| TC-PEAK-002 | `tests/behaviour/dispatch-peak-watch.test.ts` | `bun test tests/behaviour/dispatch-peak-watch.test.ts` | `createCommandScenario` with `nowIso` and a scripted liveness sequence | 3 | To Implement |
| TC-PEAK-003 | `tests/behaviour/dispatch-peak-determinism.test.ts` | `bun test tests/behaviour/dispatch-peak-determinism.test.ts` | Fixed clock sequence, delay spy, scripted transport, deterministic ids, mode carve-out | 6 | To Implement |
| TC-PEAK-004 | `tests/behaviour/dispatch-peak-watch.test.ts` | `bun test tests/behaviour/dispatch-peak-watch.test.ts` | Chain fixture with a base entry that declares no `peakWindows` | 3 | To Implement |
| TC-PEAK-005 | `tests/behaviour/dispatch-peak-watch.test.ts` | `bun test tests/behaviour/dispatch-peak-watch.test.ts` | No-window profile, provider-entry `peak` fixture, admission preflight | 3 | To Implement |
| TC-PEAK-006 | `tests/behaviour/dispatch-peak-episode.test.ts` | `bun test tests/behaviour/dispatch-peak-episode.test.ts` | Injected clock, delay spy, stop-request recorder, event transport, grace, overlap, and standing-expired-park arms | 3 | To Implement |
| TC-PEAK-007 | `tests/behaviour/dispatch-peak-episode.test.ts` | `bun test tests/behaviour/dispatch-peak-episode.test.ts` | `livenessIntervalMs`, stepping `nowIso`, stop seam, grace-below/above-cadence arms | 3 | To Implement |
| TC-PEAK-008 | `tests/behaviour/dispatch-peak-resume.test.ts` | `bun test tests/behaviour/dispatch-peak-resume.test.ts` | Preserved-resume seam, session-port recorder, restart ledger | 3 | To Implement |
| TC-PEAK-009 | `tests/behaviour/dispatch-peak-recovery.test.ts` | `bun test tests/behaviour/dispatch-peak-recovery.test.ts` | Preservation-failure fixture, restart budget, terminal exhaustion record, typed-question seam, episode-fact exhaustion refusal, standing-park recovery | 3 | To Implement |
| TC-PEAK-010 | `tests/behaviour/dispatch-lease-liveness.test.ts` | `bun test tests/behaviour/dispatch-lease-liveness.test.ts` | Injected lease clock crossing several 90 s TTLs, interval-above-TTL, heartbeat-ownership no-op, re-dispatch via the delivered `renewed` arm, lost lease, owner-hold, renewal failure | 2 | To Implement |
| TC-PEAK-011 | `tests/behaviour/dispatch-status-park.test.ts` | `bun test tests/behaviour/dispatch-status-park.test.ts` | Open park record, live/unknown/dead probe arms, no `recoveryRefusal` on status/park surfaces, exhaustion only in the result episode fact, read counter | 4 | To Implement |
| TC-PEAK-012 | `tests/behaviour/dispatch-peak-surfaces.test.ts` | `bun test tests/behaviour/dispatch-peak-surfaces.test.ts` | Seed one park record and a live lease, read spy, lanes and board harnesses | 4 | To Implement |
| TC-PEAK-013 | `tests/behaviour/dispatch-peak-byte-identical.test.ts` | `bun test tests/behaviour/dispatch-peak-byte-identical.test.ts` | Pre-change goldens, no-park state, production mode enabled/disabled | 4 | To Implement |
| TC-PEAK-014 | `tests/behaviour/dispatch-peak-result.test.ts` | `bun test tests/behaviour/dispatch-peak-result.test.ts` | Spanning episode fixture, budget-exhaustion terminal arm with episode-fact refusal, no-episode control | 4 | To Implement |
| TC-PEAK-015 | `tests/behaviour/dispatch-peak-setting.test.ts` | `bun test tests/behaviour/dispatch-peak-setting.test.ts` | Three configuration arms, same episode fixture | 3 | To Implement |
| TC-PEAK-016 | `tests/behaviour/dispatch-stop.test.ts` | `bun test tests/behaviour/dispatch-stop.test.ts` | Disabled-setting arm and enabled control, shared episode fixture, `--cause peak-window --until` | 5 | To Implement |
| TC-PEAK-017 | `tests/behaviour/dispatch-peak-setting.test.ts`, `tests/behaviour/config-lane.test.ts`, `tests/fixtures/config/lane.ts` | `bun test tests/behaviour/dispatch-peak-setting.test.ts tests/behaviour/config-lane.test.ts` | Invalid lane source cases; delivered error table | 1 | To Implement |
| TC-PEAK-018 | `tests/behaviour/dispatch-stop.test.ts` | `bun test tests/behaviour/dispatch-stop.test.ts` | Same clock, same episode factory, window-open control, profile from the lane record | 5 | To Implement |
| TC-PEAK-019 | `tests/behaviour/dispatch-stop-safety.test.ts` | `bun test tests/behaviour/dispatch-stop-safety.test.ts` | Recording terminate seam, three bound arms, unknown-session and unconfirmed-terminate arms, terminate-less harness arm, source guard | 5 | To Implement |
| TC-PEAK-020 | `tests/behaviour/dispatch-stop-refusal.test.ts` | `bun test tests/behaviour/dispatch-stop-refusal.test.ts` | Terminal/absent/session-less active/any-open-park/unconfirmed-terminate arms, repository-wide pass summary, store snapshot and read counter | 5 | To Implement |
| TC-PEAK-021 | `tests/behaviour/dispatch-peak-owner-hold.test.ts` | `bun test tests/behaviour/dispatch-peak-owner-hold.test.ts` | Injected owner-hold marker, park-record snapshot, lease renewal across cadences | 3 | To Implement |
| TC-PEAK-022 | `tests/behaviour/dispatch-peak-isolation.test.ts` | `bun test tests/behaviour/dispatch-peak-isolation.test.ts` | Two lanes, two profiles, two leases, one injected clock | 3 | To Implement |
| TC-PEAK-023 | `tests/behaviour/dispatch-peak-spend.test.ts` | `bun test tests/behaviour/dispatch-peak-spend.test.ts` | Present and absent telemetry ledgers over the episode interval | 4 | To Implement |
| TC-PEAK-024 | `tests/behaviour/dispatch-peak-spend.test.ts` | `bun test tests/behaviour/dispatch-peak-spend.test.ts` | Seeded in-window calls at both inclusive boundaries | 4 | To Implement |
| TC-PEAK-025 | `tests/behaviour/dispatch-peak-resume.test.ts` | `bun test tests/behaviour/dispatch-peak-resume.test.ts` | Rule-data mutation between park and recorded end | 3 | To Implement |
| TC-PEAK-026 | `tests/checks/peak-pause-hermetic.test.ts` | `bun test tests/checks/peak-pause-hermetic.test.ts` | Armed fetch, credential, and sleep canaries; source scan; lease wake bound | 6 | Existing - Update |
| TC-PEAK-027 | `tests/structure/event-taxonomy-integrity.test.ts`, `tests/checks/event-taxonomy-conformance.test.ts` | `bun test tests/structure/event-taxonomy-integrity.test.ts tests/checks/event-taxonomy-conformance.test.ts` | Closed-set declarations, payload bounds, consecutive-episode shape | 6 | Existing - Update |
| TC-PEAK-028 | `tests/checks/privacy-release.test.ts`, `tests/structure/changeset-additivity.test.ts` | `bun test tests/checks/privacy-release.test.ts tests/structure/changeset-additivity.test.ts` | The change's changeset and the tree baseline pin | 1 | Existing - No Change (run early) |
| TC-PEAK-029 | Reference host, pm-notes, and pull request | Manual, no command in CI | The next lane after the upgrade; the pm-notes and PR record the hand-off and preconditions | 8 | Manual Only |
| TC-PEAK-031 | `tests/behaviour/dispatch-peak-nomination.test.ts` | `bun test tests/behaviour/dispatch-peak-nomination.test.ts` | Every active lane record, post-restart and post-resume reads, pre-change record, park payloads | 3 | To Implement |
| TC-PEAK-032 | `tests/behaviour/dispatch-peak-stop-grace.test.ts` | `bun test tests/behaviour/dispatch-peak-stop-grace.test.ts` | Recording terminate seam with three bound arms and a small buffer | 3 | To Implement |
| TC-PEAK-033 | `tests/behaviour/dispatch-peak-mode.test.ts` | `bun test tests/behaviour/dispatch-peak-mode.test.ts` | `tests/fixtures/queue/production/harness.ts`, enabled/disabled arms, durable park records | 4 | To Implement |
| TC-PEAK-034 | `tests/behaviour/dispatch-stop-cause.test.ts` | `bun test tests/behaviour/dispatch-stop-cause.test.ts` | Disallowed causes and missing end, canonical `Z` acceptance, past/non-canonical refusal, `input.value.rejected`, `until-required`, store snapshot and read counter | 5 | To Implement |
| TC-PEAK-035 | `tests/behaviour/dispatch-stop-handoff.test.ts` | `bun test tests/behaviour/dispatch-stop-handoff.test.ts` | Separate stop command and owning invocation over one store, post-collection re-read, withhold renewal measurement, deterministic clock | 5 | To Implement |
| TC-PEAK-036 | `tests/behaviour/dispatch-stop-race.test.ts` | `bun test tests/behaviour/dispatch-stop-race.test.ts` | Session-end race in three orders, including a park after collection, store snapshot and record-kind counter | 5 | To Implement |
| TC-PEAK-037 | `tests/behaviour/dispatch-peak-preservation.test.ts` | `bun test tests/behaviour/dispatch-peak-preservation.test.ts` | Temporary git repo and store snapshots, complete park and resume, worktree reuse, standing-park recovery | 3 | To Implement |
| TC-PEAK-038 | `tests/behaviour/dispatch-peak-standing-park.test.ts` | `bun test tests/behaviour/dispatch-peak-standing-park.test.ts` | `recoverQueueParks` pass, three standing-park origins, occupancy, unrecoverable refusal, non-expired pre-session refusal, expired-resume, empty `sessionRef`/`branch` resumed frame, active-park counter | 3 | To Implement |

Notes on mapping:

- The existing peak-pause determinism suite (`tests/behaviour/peak-pause-determinism.test.ts`) pins the pure decisions. TC-PEAK-003 pins the dispatch command's full output with the mode carve-out, so it extends the pattern at the command boundary and does not duplicate the pure-suite assertions.
- The existing daemon park and resume suites are the parity control for TC-PEAK-001 and the regression context for TC-PEAK-005. They are not modified by this change.
- The existing `dispatch-additive-stability` suite is the pattern for TC-PEAK-013; its no-park goldens are deliberately untouched, and the one mode value is asserted as a named carve-out.
- The existing lease suites are the pattern for TC-PEAK-010 (running-lane lease arms, `dispatch-lease-liveness.test.ts`, plan phase 2) and TC-PEAK-037 (nothing lost over a complete park and resume, `dispatch-peak-preservation.test.ts`, plan phase 3). The change extends the claim path with renewal keyed on the invocation's own last heartbeat write, but adds no lease record kind.
- TC-PEAK-038 uses the delivered `recoverQueueParks` mutating park pass; it asserts the clear-observed marker, the recovered record, and the `park-auto-recovery` incident, and the active-park counter proves the duplicate-invariant degradation (RSK-14) cannot arise.
- The event bounds constants already exist in the event fixtures; TC-PEAK-027 reuses them and asserts non-vacuity, never a growing count, plus the consecutive-episode shape. No pre-session frame exists.
- TC-PEAK-033 uses the production composition factory at `tests/fixtures/queue/production/harness.ts` and a proven-firing control, not the test-only `peakWatchComposed` override, so the mode assertion cannot pass vacuously.
- TC-PEAK-035 runs the separately invoked stop command and the owning invocation over one durable store; the record is the hand-off, so no control channel is mocked, and the post-collection re-read is driven by the same fixture.
- TC-PEAK-029 is the only manual scenario and is a post-upgrade hand-off, not a merge gate. The automated fixtures above are the gate evidence.
- No new CI job is added. Every automated TC rides `bun test` through `pnpm check`, as the testing strategy requires.

## 8. Risks, Assumptions, and Open Questions

### 8.1 Risks

| ID | Risk | Mitigation |
|----|------|------------|
| RSK-TP-1 | The parity fixture passes on a simplified path while the dispatch composition quietly re-derives a window rule | TC-PEAK-001 compares both compositions on the same rules and instant and adds a structure guard that the dispatch path calls the delivered decision layer; the guard fails on a copied implementation. |
| RSK-TP-2 | A fixture accidentally uses wall-clock time or a real sleep, making the episode test slow or flaky | TC-PEAK-003 and TC-PEAK-026 use a counted clock, a recording delay seam, and armed canaries; TC-PEAK-026 also source-scans for `setTimeout` and real sleeps; TC-PEAK-010 crosses the lease TTL on the injected clock, never by waiting. |
| RSK-TP-3 | A test hardcodes a guessed member name for the additive status or result fact and fails on a legitimate rename | The plan requires asserting the declared behaviour through the command's own JSON contract; the exact member names are pinned by the delivery in this change and reviewed once, not guessed (OQ-TP-3). |
| RSK-TP-4 | The reference host does not observe the episode before the PR merges | TC-PEAK-029 is a post-upgrade hand-off, explicitly non-gating and not a Done criterion; the pm-notes record the hand-off and preconditions before `dod_check`, the PR carries them, and the episode is observed on the next lane after installation. The automated fixtures remain the merge gate. |
| RSK-TP-5 | The first full gate run fails TC-RELEASE-001 for a missing changeset, wasting a battery run | TC-PEAK-028 is run before the first gate; the changeset is created in the same delivery phase as the code. |
| RSK-TP-6 | A no-park golden is updated to accommodate an additive change, erasing the byte-identical guarantee | TC-PEAK-013 treats every no-park output as read-only except the one named `peakEnforcement.mode` value; any wider golden update requires an explicit review note. |
| RSK-TP-7 | The not-preserved recovery test double-counts an ordinal because the fixture seeds the budget and the count inconsistently | TC-PEAK-009 reads the delivered restart ledger after the recovery and asserts at most one appended ordinal per observation, with a separate budget-exhaustion arm that appends the terminal exhaustion record and raises the delivered typed question. |
| RSK-TP-8 | The manual scenario is treated as a substitute for the fixtures | The plan states explicitly that TC-PEAK-029 is a post-upgrade hand-off and the automated fixtures are the gate evidence; the manual row cannot turn a red suite green. |
| RSK-TP-9 | The lease fixture passes vacuously because the second dispatch is attempted outside the TTL, the renewal cadence is not asserted, or the ownership key is faked | TC-PEAK-010 asserts the heartbeat age and the renewal records at every point before, at, and after each of several TTL boundaries, names the 90 000 ms TTL, asserts the `min(lane.liveness-interval, queue.lease-ttl / 2)` cadence, and includes the interval-above-TTL, heartbeat-ownership no-op, delivered-`renewed`-arm re-dispatch, lost-lease, and owner-hold arms. |
| RSK-TP-10 | The mode fixture passes through the test-only `peakWatchComposed` override and never exercises the production composition | TC-PEAK-033 uses the production composition factory at `tests/fixtures/queue/production/harness.ts` with a proven-firing control, and TC-PEAK-013 asserts the mode value through that composition, not through the override. |
| RSK-TP-11 | The race fixture is nondeterministic and flaky | TC-PEAK-036 drives three orderings, including a park landing after collection, from the same injected clock and asserts the single outcome from the record set, never from timing. |
| RSK-TP-12 | The withdrawn pre-session case is reintroduced as a test or fixture | The pre-session park is out of scope with the declared one-cadence-plus-applied-grace residual (NG-10, RSK-12); no TC or fixture asserts a pre-session representation, and TC-PEAK-015 notes the case explicitly. |
| RSK-TP-13 | An unconfirmed terminate is treated as success and writes a phantom park | TC-PEAK-019 asserts the park is written only after a confirmed terminate, and TC-PEAK-020 makes an unconfirmed terminate the not-running refusal with nothing written. |
| RSK-TP-14 | A standing expired, orphaned, refused, or budget-exhausted park is not recovered, so the next window appends a second active park and permanently degrades every park-reading surface | TC-PEAK-038 asserts the delivered `recoverQueueParks` pass before the first stop decision and at the first observation of a resuming invocation, the occupancy rule, the unrecoverable refusal, the non-expired pre-session refusal, and the never-more-than-one active park count; TC-PEAK-006, TC-PEAK-009 and TC-PEAK-037 carry the standing-expired-park arm. |

### 8.2 Assumptions

- The delivered harness (`createCommandScenario`) already supports an injected clock, delay, and transport; this change extends it for the episode, lease, and stop fixtures rather than replacing it.
- The temporary git repository and store harness can snapshot branch tip, change-folder content, phases, queue state, lease heartbeat age, renewal records, worktree path, and the tree root without live resources.
- The event projection harness can produce the four episode kinds from a seeded park record over the in-memory transport pair.
- The telemetry fixture can seed and then omit attributable steps for the same ref and interval, so TC-PEAK-023 can assert the present-zero and classified-absence arms in one run.
- The additive member names for `dispatch status` and the result envelope are delivery-level details fixed in this change (spec section 14); the tests assert the declared behaviour through the command contract.
- The operator stop grammar requires `--cause peak-window` and `--until <iso>` as spec Flow 3 and AC-F9-1 state; the missing end reuses `until-required`, and the test pins the delivered grammar and does not invent an extra flag.
- The production composition factory at `tests/fixtures/queue/production/harness.ts` can be exercised in both enabled and disabled arms, and its control cannot pass through a test-only watch override.
- The delivered lease renewal path is available to the one-shot invocation, updates the existing lease record without a new record kind, is a no-op unless the live lease's latest heartbeat is the invocation's own last write, surfaces `lease:not-owned` without appending or extending, and does not pass the owner-hold gate; a re-dispatch's delivered `renewed` arm preserves the lease id but appends a newer heartbeat, so the earlier invocation loses ownership.
- The delivered `recoverQueueParks` mutating park pass is available to the run path before the first stop decision and at the first observation of a resuming invocation; it writes the clear-observed marker, the recovered record, and the `park-auto-recovery` incident, and an unrecoverable park refuses the run.
- The owning invocation withholds terminal classification for at least the applied grace plus one observation cadence after collection, because the terminate call awaits the whole grace before the command appends the park.
- The wake bound uses `elapsed / min(lane.liveness-interval, queue.lease-ttl / 2) + 1`; a renewal wake on the derived renewal cadence is a renewal, not an extra observation.
- The reference host's tracked `.jaiship/config.yaml` declares profile `delivery` with `peakWindows` at 01:00-04:00 and 06:00-10:00 UTC (spec section 12), so the next lane after the upgrade is pausable.
- The reference host's activity-keyed liveness consumers are relaxed or exclude a parked lane before the next lane is dispatched (DEC-19).
- The tracked profile's 04:00-04:05Z overlap may show a short resume and a second park; that is the declared first-open-window churn (DEC-20, RSK-13), not a defect.
- Delivery and every fixture stay inside the checkout and the change folder (owner delivery note 4).

### 8.3 Open Questions

| ID | Question | Blocking? | Owner | Resolution |
|----|----------|-----------|-------|------------|
| OQ-TP-2 | The exact evidence format of the PR hand-off in TC-PEAK-029 (which section and which command transcript) is delivery-level. | No | Reference host and PR author | The PR names the tracked profile fact, the liveness relaxation, and the command sequence; the eventual episode record follows when the next lane runs. |
| OQ-TP-3 | The additive `dispatch status` park fact and result episode fact member names are fixed by the delivery in this change (spec section 14). | No | Delivery | Pin the names in the same change and assert the declared behaviour; no test hardcodes a guessed name. |

No acceptance criterion is left uncovered. All 33 are covered by an automated scenario; TC-PEAK-029 is the only manual scenario and it is a post-upgrade hand-off, not a coverage gap. The withdrawn park-before-first-session case has no test case because it is out of scope with the declared one-cadence-plus-applied-grace residual (NG-10, RSK-12).

## 9. Plan Revision Log

| Version | Date | Author | Changes |
|---------|------|--------|---------|
| 1.0 | 2026-11-26 | @test-plan-writer | Initial test plan from `chg-GH-413-spec.md`: 23 acceptance criteria covered by 28 automated scenarios (including the derived invalid-value configuration scenario and the release assertion) plus 1 owner manual episode; capability, data-model, event, and NFR traceability; hermetic fixture design; owner delivery notes recorded. |
| 1.1 | 2026-11-26 | @test-plan-writer | DoR iteration-1 remediation: reworded TC-PEAK-029 to the post-upgrade reference-host hand-off and removed the chance-based fallback (finding 9); added TC-PEAK-030 (pre-session park), TC-PEAK-031 (lane-record nomination), TC-PEAK-032 (composed-grace terminate call), TC-PEAK-033 (production composition mode), TC-PEAK-034 (stop cause/end refusal), TC-PEAK-035 (stop success and owning-invocation hand-off), TC-PEAK-036 (stop/session-end race); extended TC-PEAK-003 (mode carve-out), TC-PEAK-006 (small-buffer and grace-above-cadence arms), TC-PEAK-007 (derived stop/park lags), TC-PEAK-009 (per-observation ordinal and non-terminal refusal), TC-PEAK-010 (lease across several TTLs), TC-PEAK-011 (three probe arms and recovery refusal), TC-PEAK-012 (lease holder), TC-PEAK-013 (one intended mode carve-out), TC-PEAK-014 (refusal in the episode fact), TC-PEAK-015 (pre-session disabled), TC-PEAK-016/018/019 (cause/until, profile from record, composed grace), TC-PEAK-020 (three running-predicate arms), TC-PEAK-022 (per-lane lease), TC-PEAK-023 and TC-PEAK-027 (pre-session claim and shape); updated coverage to 33 ACs, NFR-1 to 11, DM-1 to 9; added the fourth owner delivery note and plan-phase ownership. |
| 1.2 | 2026-11-26 | @test-plan-writer | DoR iteration-2 remediation: removed TC-PEAK-030 and every AC-F1-4/NFR-11 reference, recorded the pre-session park as out of scope with the one-cadence residual (NG-10, RSK-12); renumbered the Plan Phase column and ownership paragraph to the plan's eight phases (phase 1 = TC-PEAK-017, 028; phase 2 = TC-PEAK-010; phase 3 = TC-PEAK-001, 002, 004, 005, 006, 007, 008, 009, 015, 021, 022, 025, 031, 032, 037; phase 4 = TC-PEAK-011, 012, 013, 014, 023, 024, 033; phase 5 = TC-PEAK-016, 018, 019, 020, 034, 035, 036; phase 6 = TC-PEAK-003, 026, 027; phase 7 = none; phase 8 = TC-PEAK-029), with the plan as authority; split TC-PEAK-010 into the running-lane lease arms at `tests/behaviour/dispatch-lease-liveness.test.ts` (phase 2) and the new TC-PEAK-037 nothing-lost/parked-interval arms at `tests/behaviour/dispatch-peak-preservation.test.ts` (phase 3); extended TC-PEAK-019/020/035/036 with the already-parked refusal, unconfirmed terminate, confirmed-terminate-before-park, and post-collection re-read arms; extended TC-PEAK-010/021 with the interval-above-TTL, lease-id no-op, and owner-hold lease arms; extended TC-PEAK-031 with the post-restart and post-resume nomination read; rewrote TC-PEAK-007 to the observation-to-park bound with the stop-request instant from the stop seam; stated the first-open-window end and consecutive overlap episode in TC-PEAK-004/006/007 and removed the union fixture; pointed the production factory at `tests/fixtures/queue/production/harness.ts`; updated coverage to 32 ACs, NFR-1 to 10, DM-1 to 9; updated TC-PEAK-029 and the execution log to the pm-notes/PR hand-off with the overlap expectation. |
| 1.3 | 2026-11-26 | @test-plan-writer | PM decision 15 and spec v1.2 correction: the lease renewal is keyed by the lease id acquired at admission, not by holder and reference alone; TC-PEAK-010 now carries the lease-id no-op and re-dispatch arms (a same-holder re-dispatch that takes over a stale lease cannot be renewed by the earlier invocation), and DM-9, the fixture notes, RSK-TP-9 and the assumptions say so. The post-collection withhold bound is corrected to at least the applied grace plus one observation cadence in AC-F9-4, AC-F10-2, TC-PEAK-035 and TC-PEAK-036, with the supporting note in section 6 and the assumptions; the bound exists because the terminate call awaits the whole grace before the park append. No TC id was added or removed. |
| 1.4 | 2026-11-26 | @test-plan-writer | DoR iteration-3 remediation and final spec v1.3 sync: added TC-PEAK-038 (AC-F3-4) for the standing-park recovery before the first stop decision and at the first resuming observation, occupancy by any standing `peak-window` park, the unrecoverable-park refusal, the operator-resume-during-open-window case, and the never-two-active-parks assertion (RSK-14), plan phase 3; extended TC-PEAK-006, TC-PEAK-009 and TC-PEAK-037 with the standing-expired-park arm. Rewrote TC-PEAK-010 to key renewal on the live lease's latest heartbeat being the invocation's own last write, with `lease:not-owned`, a re-dispatch through the delivered `renewed` arm, and the lost-lease return instead of resuming as owner. Updated TC-PEAK-020 to the any-open-park already-parked predicate, TC-PEAK-034 to `input.value.rejected` with `until-required` and no release-grammar comparison, and the admission residual to one observation cadence plus the applied grace. NFR-7 now bounds wakes by `elapsed / min(lane.liveness-interval, queue.lease-ttl / 2) + 1`, with a renewal wake not an extra observation. Coverage is 33 of 33 ACs, NFR-1 to 10 and DM-1 to 9; final count 37 TCs (36 automated, 1 manual). |
| 1.5 | 2026-11-26 | @test-plan-writer | Owner Decision 1 and iteration-4 test arms: TC-PEAK-038 replaces the operator-resume-during-open-window arm with the pre-session refusal for a non-expired standing park (`queue.precondition.unmet` at exit 1, cause and `until` in the bounded summary, no session/park/event, `lanes`/`board` still parked), adds the expired-park recovery-and-resume arm, asserts the pass meets only an expired park or none, and adds the finding-4a preserved-park `dispatch.attempt/resumed` frame with empty `sessionRef`/`branch` under the original episode id and no new kind. TC-PEAK-010 adds the lost-lease live-session arm: no owner act, observe until the session ends, return `lease:not-owned`, append its own result records, and never abandon the live session. NFR-10 scopes the heartbeat-age measurement to between renewals and outside the unrenewed bounded waits (terminate grace, worktree provisioning, handle acquisition). No TC id was added or removed; coverage remains 33 of 33 ACs, 37 TCs (36 automated, 1 manual). |
| 1.6 | 2026-11-26 | @test-plan-writer | Owner Decision 1 literal: TC-PEAK-038 step 5 and expected outcome now use the new dispatch-family `dispatch.resume-parked` row at exit 2 (`projectionClass: platform-provider`, category transient, retryable true, consequence `not_landed`, remediation "Resume after the park's recorded `until`; the park stands and nothing was written.") for a resume or a re-dispatch of a lane whose standing park has not expired; the expired-park recovery remains at the first observation, and the started-session unrecoverable arm is unchanged. TC-PEAK-010 restores the parked-case sentence: a parked lane's invocation returns one classified result with the park standing, releasing the lease, alongside the live-session lost-lease rule. Version citations updated to spec v1.5, plan v1.5, test plan v1.6. Coverage remains 33 of 33 ACs, 37 TCs (36 automated, 1 manual). |
| 1.7 | 2026-11-26 | @test-plan-writer | PM review remediation: TC-PEAK-011 now reads `recoveryRefusal` from the terminal durable lane record, and DM-2/DM-3/AC-F6-1 state that the park-record member is removed. TC-PEAK-010 and AC-F5-2 add the un-expired standing-park second-dispatch arm (`dispatch.resume-parked` at exit 2 at resume admission; `queue.single-flight` only for a running lane without a park), the parked-through-engine lease renewal arm, and retain the lost-lease and parked-case rules. TC-PEAK-038 replaces the started-session arm with the ordering invariant: the recovery pass runs before the first session, an unrecoverable standing park refuses with no park appended and no spawn/resume call, and there is no terminate arm. F-14 arms added to TC-PEAK-002 (mid-iteration while the session is actively producing output), TC-PEAK-006 (hand-off over one store), and TC-PEAK-013 (byte-identical no-park output); the TDR-0077 decision-record case remains in TC-PEAK-027. No TC id was added or removed; coverage remains 33 of 33 ACs, 37 TCs (36 automated, 1 manual). |
| 1.8 | 2026-11-26 | @test-plan-writer | Review iteration-2 decisions: F-7 removes the non-terminal recovery-refusal arm from TC-PEAK-009 and TC-PEAK-014; the only terminal refusal is budget exhaustion, which appends the terminal exhaustion record, raises the delivered typed question, and keeps the reachable result shape (AC-F4-3, AC-F7-1, DM-3, DM-4, DM-5, NFR-4 updated). F-9 adds the terminate-less-harness arm (`lanes` mode `iteration-start-gating`, no watch composed) to TC-PEAK-019 and the withhold renewal-at-the-earlier-cadence measurement to TC-PEAK-035. F-14e adds the repository-wide-pass summary naming the stuck refs to TC-PEAK-020/AC-F10-1. F-18 adds canonical `Z` acceptance and past/non-canonical-end refusal to TC-PEAK-034/AC-F9-3. No TC id was added or removed; coverage remains 33 of 33 ACs, 37 TCs (36 automated, 1 manual). |
| 1.9 | 2026-11-26 | @test-plan-writer | Plan-writer stale-sentence cleanup: TC-PEAK-010's parked-case now leaves the successor's lease alone instead of releasing it; TC-PEAK-011 reads the terminal exhaustion refusal from the terminal durable lane record, never the park record, with AC-F6-1/DM-2/DM-3 aligned; the ownership paragraph cites plan v1.7 and test plan v1.8. No TC id, coverage, or phase change. |
| 1.10 | 2026-11-26 | @test-plan-writer | Final record correction (review iteration 4, F-1): the exhaustion refusal is carried only by the result's bounded episode fact; `dispatch status`, `laneParks`, brief, and board carry no refusal and project no `recoveryRefusal` member. TC-PEAK-011 now asserts that absence; TC-PEAK-009, TC-PEAK-014, AC-F4-3, AC-F6-1, DM-2, DM-3, DM-4, DM-5, and TC-PEAK-027 are aligned. No TC id, coverage, or phase change; 33 of 33 ACs and 37 TCs remain. |

## 10. Test Execution Log

Results are appended during delivery. The manual row is a post-upgrade hand-off: the change's pm-notes record the hand-off and preconditions before `dod_check`, the pull request carries them, and the reference host observes the episode on the next lane after installation.

| TC ID | Run Date | Result | Notes |
|-------|----------|--------|-------|
| TC-PEAK-029 | Pending | Pending (non-gating hand-off) | Post-upgrade observation by the reference host on the next lane; the pm-notes and PR record the hand-off, the tracked profile fact, the liveness relaxation, the command sequence, and the expected 04:00-04:05Z overlap churn (a short resume and a second park). The episode itself is recorded when that lane runs. |
