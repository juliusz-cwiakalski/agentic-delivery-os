---
id: chg-GH-413-test-plan
status: Updated
created: 2026-11-26T10:13:20Z
last_updated: 2026-11-26T11:52:22Z
owners: ["engineering"]
service: delivery-os
labels: [change, m4, peak-pausing, dispatch, lane-lifecycle, config]
version_impact: minor
summary: "Test design for GH-413 v1.1 peak pausing for a lane started by dispatch: the life-long dispatch-owned window watch including the pre-session park, the nominated profile's declared peakWindows rules read from the durable lane record, the composed-grace stop and exactly-once park, the in-invocation wait with lease renewal and the classification-routed resume including a surfaced non-terminal refusal, the additive status and result facts, the configuration-derived composition mode, the disabling key, the peak-window-only operator stop with its hand-off, success and race contracts, owner-hold precedence and per-profile isolation, and the zero-spend evidence. All fixtures are hermetic over an injected clock, delay, transport, and lease clock; every one of the 33 acceptance criteria is traceable to a named test case and each TC is owned by one plan phase."
links:
  change_spec: ./chg-GH-413-spec.md
  implementation_plan: ./chg-GH-413-plan.yaml
  testing_strategy: .ai/rules/testing-strategy.md
---

# Test Plan - M4-S42: Peak pausing for a lane started by dispatch: it stops at the window's start and resumes at the window's end

## 1. Scope and Objectives

This plan protects the core behaviour of GH-413 v1.1: a lane started by the one-shot `dispatch` invocation is watched for its whole life by that invocation, including before its first session when the nominated profile's window is already open; it parks with the composed-grace stop at the window's start, keeps its lease live through the park, waits until the effective window end, resumes the same session on the same branch and in the same worktree (or surfaces a non-terminal recovery refusal), and returns one result whose summary states that the lane was paused and resumed. It also protects the durable lane-record nomination, the configuration-derived composition mode, the `peak-window`-only operator command `dispatch stop <ref>` with its hand-off, success and race contracts, the classified not-running refusal, the disabling key, owner-hold precedence, per-profile isolation, and the falsifiable zero-spend claim.

The highest-integrity risks are: (1) two compositions drifting into different answers for the same lane and instant (RSK-8, AC-F1-1); (2) a duplicate or missing episode frame across many observations (NFR-2); (3) a lost branch, change folder, phase, or queue state and a second session for the work item (NFR-4, NFR-10, AC-F5-1, AC-F5-2); (4) a second kill path or an escalation that outlasts the window buffer (NFR-1, AC-F3-3, AC-F9-2); (5) a zero-spend claim that cannot fail (AC-F12-2); (6) a disabled setting that silently reintroduces peak spend (RSK-5, AC-F8-1); and (7) a mode fixture that passes through a test override instead of the production composition (RSK-11, AC-F6-4). Everything runs hermetically over the injected clock, delay, transport, and lease clock. No live network, real sleep, or credential read participates in the automated gate (NFR-5, NFR-7).

### 1.1 In Scope

- Every acceptance criterion in the change specification section 17: all 33, AC-F1-1 through AC-F12-2, each mapped to at least one named test case in section 3.1.
- Every functional capability F-1 through F-12, every data-model element DM-1 through DM-9, and every non-functional requirement NFR-1 through NFR-11, mapped in sections 3.2 and 3.3.
- The pre-session park for an already-open window (AC-F1-4, NFR-11), the durable lane-record nomination (AC-F2-3, DM-2), the composed-grace stop and the derived stop/park/resume lags (AC-F3-3, AC-F3-2, NFR-1, NFR-6), the non-terminal recovery refusal (AC-F4-3), lease liveness across several TTLs (AC-F5-2, NFR-10, DM-9), the production composition mode (AC-F6-4, DM-7), the three parked-lane probe arms (AC-F6-5), the `peak-window`-only stop with its refusals, success output, hand-off and race (AC-F9-1, AC-F9-3, AC-F9-4, DM-8, AC-F10-2), and the rewritten byte-identical carve-out (AC-F6-3, NFR-9).
- The deliberately distinct episode frame written by the dispatch-owned watch and by `dispatch stop` (a complete watcher-shaped frame), the pre-session minimal frame that projects the `park-edge` alone, and the untouched operator-shaped minimal frame of the release grammar (DEC-7, DEC-14).
- The intentional supersession of the daemon-absent degradation statement (DEC-1) and the configuration-derived, two-value composition fact with its one intended value change (DEC-6), asserted at the observable read rather than as documentation text.
- The owner delivery notes: (1) the change's changeset exists before the first gate run (TC-PEAK-028); (2) affected tests run during implementation and the full battery once at the gate (section 7); (3) the behavioural proof is fixtures with an injected clock and transport plus one real post-upgrade episode observed by the reference host on the next lane, whose hand-off and preconditions are recorded on the pull request (TC-PEAK-029); (4) delivery never searches the file system outside the checkout and the change folder.
- Hermeticity, determinism, vocabulary economy, and additive-read bounds as first-class checks, not incidental properties.

### 1.2 Out of Scope & Known Gaps

- Any change to the resident daemon's supervision cycle, watch cadence, park, or resume behaviour (NG-1). The daemon suites are only read for parity and regression, never re-specified here.
- Parallel lanes or multi-lane concurrency (NG-2), weekday or calendar-aware windows (NG-3), resident or always-on dispatch (NG-4), and shell-orchestrator work (NG-5).
- Any new park cause, event kind, record kind, schema identity, error identity, result token, or second kill path (NG-6). The plan asserts the closed sets unchanged instead.
- A read surface for a declared or open window as an object, and any provider quota or provider API query (NG-7).
- Any change to provider-entry admission gating, any participation of profile `peakWindows` in eligibility or admission, or any change to the nomination rule (NG-8); and any participation of provider-entry `peak` windows in the lane watch (NG-9).
- `dispatch stop` for any cause other than `peak-window`, and manual resume of an operator-stopped lane before its declared end (spec section 7.2).
- Automatic recovery after the dispatch process is killed during the wait; the park record and the lane record's nomination stand, and the delivered resume path applies (spec section 7.2).
- Live-tracker or live-PR behaviour in the automated suites. TC-PEAK-029 is a post-upgrade reference-host observation recorded on the pull request, not a suite.
- Timing assertions on wall-clock durations. Stop, park, and resume lags are derived from recorded instants and asserted in cadences over the injected clock; the wait's wake count is bounded over the injected clock, never by sleeping.

## 2. References

- Change specification: `./chg-GH-413-spec.md` v1.1. Source of truth for sections 5 (capabilities), 8 (interfaces and data model), 9 (NFRs), 15 (decisions DEC-1 to DEC-19), 17 (33 acceptance criteria), and 18.1 (Definition of Done).
- Testing strategy: `.ai/rules/testing-strategy.md`. Layer and module mapping, bun:test conventions, hermeticity, invariant-test authoring, and the aggregate gate.
- Implementation plan: `./chg-GH-413-plan.yaml`. Its revised version follows this plan's phase ownership; this plan invents no phase.
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
- Delivered decision and contract modules the fixtures compose: `packages/core/src/domain/daemon-peak-pause.ts` (`decidePeakStops`, `decidePeakResumes`, `runPeakWatch`, `runPeakResume`), `packages/core/src/domain/queue-park.ts`, `packages/core/src/domain/spend.ts`, `packages/core/src/app/dispatch.ts`, `packages/core/src/app/dispatch-lane-view.ts`, `packages/core/src/app/queue.ts` (the delivered lease renewal path), `packages/core/src/config/catalog.ts`, `packages/core/src/contracts/taxonomy.ts`.
- Fixture seams: `tests/fixtures/dispatch/golden/harness.ts` (`createCommandScenario` with `nowIso`, `delay`, `harnessPort`, `livenessIntervalMs`, `livenessOf`, `restartBudget`, `initialRestarts`), `tests/fixtures/state/harness.ts` (temporary store and lease clock), `tests/fixtures/events/event-harness.ts` (in-memory transport pair), `tests/fixtures/telemetry` (seeded telemetry steps), `tests/fixtures/board`, `tests/fixtures/supervise`, the production composition factory used by `tests/behaviour/peak-pause-composed-edge.test.ts`, and the stop-hand-off fixture that puts a separate stop command and the owning invocation over one durable store.

## 3. Coverage Overview

### 3.1 Functional Coverage (F-#, AC-#)

| AC ID | Description (short) | TC ID(s) | Status |
|-------|---------------------|----------|--------|
| AC-F1-1 | Dispatch-owned watch and the daemon's watch take the same stop or no-stop decision for the same profile and instant, through the same rules and clock, with neither deriving its own rule | TC-PEAK-001 | Covered |
| AC-F1-2 | A window opening mid-iteration and a window opening between iterations both park, and the watch remains active until the lane's terminal classification | TC-PEAK-002 | Covered |
| AC-F1-3 | Paired identical runs produce byte-identical decisions, park records, events, and summary apart from the intended composition-fact mode value, with no real sleep, network call, or credential read | TC-PEAK-003 | Covered |
| AC-F1-4 | A window already open at dispatch start parks before any session with `preservation: preserved` and no stop or grace frame, holds and renews the lease, and starts the first session at the effective end | TC-PEAK-030 | Covered |
| AC-F2-1 | A chain whose base profile declares no `peakWindows` does not exempt a lane nominated to a later profile whose windows are open: it parks with `until` at that profile's effective end | TC-PEAK-004 | Covered |
| AC-F2-2 | A lane whose nominated profile declares no `peakWindows` is never stopped for peak reasons, while provider-entry `peak` windows still gate admission exactly as delivered | TC-PEAK-005 | Covered |
| AC-F2-3 | The durable lane record carries the nomination from first acquisition; the park and event payloads carry the same profile; a pre-change record reads absent, is never pausable, and is never fabricated | TC-PEAK-031 | Covered |
| AC-F3-1 | One bounded-grace stop request, a park with the recorded stop instant and `until` at the effective end, and exactly one `stop` and one `parked` sharing one episode id | TC-PEAK-006 | Covered |
| AC-F3-2 | The stop request lands within one cadence and the park instant is no later than the stop instant plus the applied grace, with both lags derived from recorded instants and no added field | TC-PEAK-007 | Covered |
| AC-F3-3 | Exactly one terminate call carries `graceMs` equal to the smallest of the remaining profile grace, the delivered kill grace, and the time to the effective end, with TERM before KILL and no escalation outlasting the buffer | TC-PEAK-032 | Covered |
| AC-F4-1 | A preserved episode resumes the preserved session on the same branch and worktree, records exactly one `resumed` with the no-re-dispatch fact, consumes no restart ordinal, and starts no second session | TC-PEAK-008 | Covered |
| AC-F4-2 | A not-preserved episode attempts no session resume, routes to the delivered interrupted-lane recovery consuming at most one ordinal per observation, emits no `resumed`, and escalates on budget exhaustion | TC-PEAK-009 | Covered |
| AC-F4-3 | A non-terminal recovery refusal leaves the lane parked, consumes no additional ordinal in that observation, and surfaces the refusal on the episode fact and the `dispatch status` park fact with the recorded end | TC-PEAK-009 | Covered |
| AC-F5-1 | Branch, change folder, recorded phases, and queue state are unchanged by a complete park and resume, and the recorded worktree is reused | TC-PEAK-010 | Covered |
| AC-F5-2 | A park outlasting the lease TTL several times keeps the lease live by renewal; a second dispatch before, at, and after each TTL boundary is refused `queue.single-flight`, with no takeover and no second session | TC-PEAK-010 | Covered |
| AC-F6-1 | `dispatch status <ref>` reports the park cause, window end, stop instant, preservation, and any recovery refusal from the record, and reports the observed probe verdict without redefining `stale` or `delivering` | TC-PEAK-011 | Covered |
| AC-F6-2 | `lanes` renders `parked:peak-window` with the recorded `until` and delivered `leaseHolder`; `board` lists the row in `PARKED` from the same record, with no second vocabulary | TC-PEAK-012 | Covered |
| AC-F6-3 | With no open park, `dispatch status`, `board`, `brief`, and a result are byte-identical and the added members absent; `lanes --json` differs only in `peakEnforcement.mode` on a production composition with pausing enabled | TC-PEAK-013 | Covered |
| AC-F6-4 | The production composition reports `window-watch` with pausing enabled and `iteration-start-gating` disabled, derived from its own effective configuration, with `parkClaimed` following durable records | TC-PEAK-033 | Covered |
| AC-F6-5 | A parked lane with probe `live` or `unknown` reports `stale: false` and `delivering: true`; with `dead` it reports `stale: true` and `delivering: false`; all three carry the park fact and the dead arm names the recorded end | TC-PEAK-011 | Covered |
| AC-F7-1 | One invocation spanning an episode returns exactly one result with the same token and exit, a summary stating paused and resumed, and the bounded episode fact including a recovery refusal where one occurred | TC-PEAK-014 | Covered |
| AC-F8-1 | The key unset or `false` keeps pausing on and parks; the key `true` supplies no pre-session evaluation, watch, stop, park, resume, or episode event, equals admission gating, and reports `iteration-start-gating` | TC-PEAK-015 | Covered |
| AC-F8-2 | With the disabling key `true`, `dispatch stop <ref>` on a running lane produces the same stop, park, and events as the enabled case | TC-PEAK-016 | Covered |
| AC-F9-1 | `dispatch stop <ref> --cause peak-window --until <iso>` sends the same bounded-grace stop, parks with that cause and end, records one `stop` and one `parked` with the same payloads, and reads the profile from the lane record | TC-PEAK-018 | Covered |
| AC-F9-2 | `dispatch stop` sends no signal of its own; exactly one terminate call carries the composed `graceMs`, TERM precedes KILL, KILL reaches only a still-listed target, an unknown session is success, and no second kill mechanism exists | TC-PEAK-019 | Covered |
| AC-F9-3 | A cause other than `peak-window`, or a missing end, is refused by name before any lane read and writes nothing | TC-PEAK-034 | Covered |
| AC-F9-4 | Stop success is one human line and machine data naming the work item, cause, park end, episode id, and preservation at exit `0`; the owning invocation re-reads the record, renews the lease, waits, and resumes | TC-PEAK-035 | Covered |
| AC-F10-1 | A newest lane that is terminal, absent, or active without a session identity refuses with the delivered classified identity, names the work item and lane state, and writes no park, event, attempt, lane, or queue record | TC-PEAK-020 | Covered |
| AC-F10-2 | A stop racing a session end produces exactly one classified outcome, either the complete episode or the not-running refusal, never a partial episode, duplicate frame, or losing-side write | TC-PEAK-036 | Covered |
| AC-F11-1 | An active owner hold does not change the watch: the lane still parks `peak-window` with `until`, the hold writes no park record, and the resume refuses the owner-hold precondition then proceeds with the park record byte-unchanged | TC-PEAK-021 | Covered |
| AC-F11-2 | Two dispatch lanes on different profiles: only the lane with an open window parks and resumes; the other keeps running, keeps its lease, and keeps its supervision unchanged | TC-PEAK-022 | Covered |
| AC-F12-1 | The window-scoped reading from park instant through park end over present telemetry counts zero attributable billable calls, discloses the telemetry state, and names its basis | TC-PEAK-023 | Covered |
| AC-F12-2 | A seeded billable call attributed to the lane inside the interval makes the reading greater than zero, so the zero claim is falsifiable | TC-PEAK-024 | Covered |

Capability traceability: F-1 -> TC-PEAK-001/002/003/030; F-2 -> TC-PEAK-004/005/022/031; F-3 -> TC-PEAK-004/006/007/032; F-4 -> TC-PEAK-008/009/025; F-5 -> TC-PEAK-008/010/030; F-6 -> TC-PEAK-011/012/013/033; F-7 -> TC-PEAK-014; F-8 -> TC-PEAK-015/016/017; F-9 -> TC-PEAK-016/018/019/034/035; F-10 -> TC-PEAK-016/020/036; F-11 -> TC-PEAK-005/021/022; F-12 -> TC-PEAK-023/024/030.

Derived scenarios (not acceptance criteria): the invalid-value configuration refusal is TC-PEAK-017, from spec section 5.1 F-8, section 8.3 DM-6, and Appendix B; the resume-admission window re-check is TC-PEAK-025, from spec section 5.1 F-4 and RSK-6. The owner delivery note on the changeset is TC-PEAK-028. The owner behavioural verification on the reference host is TC-PEAK-029, a post-upgrade hand-off.

Every TC is owned by exactly one plan phase: phase 1 owns TC-PEAK-017 and TC-PEAK-028; phase 2 owns TC-PEAK-001, 002, 004, 005, 006, 007, 008, 009, 010, 015, 021, 022, 025, 030, 031, 032; phase 3 owns TC-PEAK-011, 012, 013, 014, 023, 024, 033; phase 4 owns TC-PEAK-016, 018, 019, 020, 034, 035, 036; phase 5 owns TC-PEAK-003, 026, 027; phase 7 owns TC-PEAK-029. Phase 6 is the decision-record phase and owns no TC. No phase is invented here; the revised plan follows this mapping.

### 3.2 Interface Coverage (API-#, EVT-#, DM-#)

No HTTP or provider API is added or changed (spec sections 8.1 and 8.4). The coverage below is the data model and the taxonomy kinds this change produces.

| Interface element | TC ID(s) | Notes |
|-------------------|----------|-------|
| DM-1 Durable park record, episode frame | TC-PEAK-006, TC-PEAK-009, TC-PEAK-018, TC-PEAK-021, TC-PEAK-030 | Reused unchanged in shape; dispatch-owned stops write the complete frame; the pre-session park writes the minimal frame (cause, `until`, episode id, `preserved`) and projects the `park-edge` alone; append-only, read-time expiry, no in-place mutation. The operator release writer keeps its minimal frame. |
| DM-2 Durable lane record | TC-PEAK-008, TC-PEAK-010, TC-PEAK-011, TC-PEAK-031 | One additive optional `providerProfile` written at first acquisition; absent on pre-change records, never fabricated. The delivered `active` and `terminal` states and the open-park join at read time are unchanged. |
| DM-3 `dispatch status` payload | TC-PEAK-011, TC-PEAK-013, TC-PEAK-009 | Additive optional park fact: cause, park end, stop instant, preservation, and any recovery refusal; absent when no park stands; all delivered members and lines unchanged and the delivered `stale`/`delivering` derivation untouched. |
| DM-4 Dispatch result payload | TC-PEAK-014, TC-PEAK-009 | Additive optional bounded episode fact including the refusal where a recovery refused; no new token and no change to derivation. |
| DM-5 Dispatch result summary | TC-PEAK-014 | Gains the pause and resume statement for a spanning invocation; the delivered key set and verbose detail line keep their shape. |
| DM-6 Configuration key for disabling pausing | TC-PEAK-015, TC-PEAK-016, TC-PEAK-017 | One boolean in the delivered typed lane policy branch, unset by default, meaning pausing is on; `true` also disables the pre-session evaluation. |
| DM-7 Composition-fact read | TC-PEAK-005, TC-PEAK-015, TC-PEAK-033 | Two members and two mode values kept; the mode input is the reading composition's own effective configuration, `window-watch` with pausing enabled and `iteration-start-gating` disabled or with no watch; `parkClaimed` stays derived from durable park records; the one intended value change is carved out of the byte-identical promise. |
| DM-8 `dispatch stop` success output | TC-PEAK-035 | One human line naming the work item, cause, park end, and episode id; machine data with those and the preservation classification at exit `0`; no new envelope shape or key family. |
| DM-9 Lease liveness during the episode | TC-PEAK-010 | The existing lease is renewed through the delivered renewal path at the observation cadence for the run and the park; no new record kind, schema, or exclusion mechanism. |
| Event `dispatch.attempt/stop` | TC-PEAK-006, TC-PEAK-018, TC-PEAK-019, TC-PEAK-027, TC-PEAK-032 | Exactly one per episode in which a session was stopped, only over a complete frame; never emitted for the pre-session park; declared payload unchanged. |
| Event `dispatch.attempt/parked` | TC-PEAK-006, TC-PEAK-009, TC-PEAK-018, TC-PEAK-027, TC-PEAK-032 | Exactly one per stopped episode, carrying the closed preservation classification; never emitted for the pre-session park. |
| Event `dispatch.attempt/resumed` | TC-PEAK-008, TC-PEAK-009, TC-PEAK-027 | Exactly one per preserved episode with the no-re-dispatch fact; never emitted by a restart recovery or by the pre-session park's first start. |
| Event `queue.graph/park-edge` | TC-PEAK-012, TC-PEAK-018, TC-PEAK-027, TC-PEAK-030 | Exactly one per episode from the delivered park projection, including the pre-session park. |

### 3.3 Non-Functional Coverage (NFR-#)

| NFR | Requirement (short) | TC ID(s) | Coverage mode |
|-----|---------------------|----------|---------------|
| NFR-1 | Bounded-grace stop: exactly one terminate call with `graceMs` the smallest of the three bounds; recorded deadline at or below `graceSecondsMax`; TERM before KILL; zero added signal paths | TC-PEAK-006, TC-PEAK-018, TC-PEAK-019, TC-PEAK-032 | Behaviour fixture plus structure guard |
| NFR-2 | Exactly-once episode across any number of observations: one `stop`, one `parked`, one `park-edge`, one `resumed` only when preserved, one episode id; the pre-session park yields the `park-edge` alone | TC-PEAK-006, TC-PEAK-018, TC-PEAK-030 | Behaviour fixture over repeated observations |
| NFR-3 | Zero billable calls attributable to the parked lane between park and end, both boundaries inclusive, over present telemetry; absence classified, never zero; a seeded in-window call reads greater than zero | TC-PEAK-023, TC-PEAK-024 | Behaviour fixture, both directions in one run |
| NFR-4 | Preserved episode consumes zero ordinals and starts no fresh spawn; not-preserved consumes at most one ordinal per observation under the delivered budget and escalates at exhaustion; a non-terminal refusal consumes none that observation; zero second sessions | TC-PEAK-008, TC-PEAK-009, TC-PEAK-010 | Behaviour fixture over the delivered restart/economics seams |
| NFR-5 | Determinism and hermeticity: identical configuration, rules, clock, and transport produce byte-identical output excluding the intended mode value; zero live network, real sleeps, or credential reads | TC-PEAK-001, TC-PEAK-003, TC-PEAK-026 | Paired-run fixture plus armed canaries and source scan |
| NFR-6 | Stop, park, and resume latency: stop within one cadence of the open observation; park instant no later than stop plus applied grace; resume within one cadence of the recorded end; lags derived from recorded instants with no added field | TC-PEAK-007, TC-PEAK-008 | Fixture over the injected clock and delivered liveness cadence |
| NFR-7 | Wait cost and boundedness: no billable call, session operation, or provider request during the wait; at most one clock observation and one lease renewal per wake; no busy loop; end re-derived each wake | TC-PEAK-003, TC-PEAK-010, TC-PEAK-025, TC-PEAK-026 | Fixture with a counted wake, renewal spy, and delay spy; no timer |
| NFR-8 | Vocabulary economy and evidence bounds: zero added kinds, record kinds, schema identities, result tokens, or error rows; refusals reuse delivered identities; at most 20 fields and 1024 bytes per frame | TC-PEAK-017, TC-PEAK-020, TC-PEAK-027, TC-PEAK-034 | Structure and check suites over the closed sets and payload bounds |
| NFR-9 | Additive interface and bounded reads: one changed delivered field (`peakEnforcement.mode` on a production composition with pausing enabled), every other field zero; zero new stores; at most one additional bounded park-record read on `dispatch status`; no unbounded reads | TC-PEAK-011, TC-PEAK-012, TC-PEAK-013, TC-PEAK-015, TC-PEAK-033 | Golden/regression fixture plus a read-count spy |
| NFR-10 | Lease liveness through the run and the park: heartbeat age below the lease TTL throughout, no takeover, at most one renewal per cadence, renewal failures surfaced | TC-PEAK-010 | Behaviour fixture crossing several TTLs over the injected clock |
| NFR-11 | Pre-session park: zero sessions and zero billable calls before the park; every such case carries `preservation: preserved` and no stop frame; the first session starts at the effective end | TC-PEAK-030 | Behaviour fixture with a spawn and call recorder |

## 4. Test Types and Layers

Per `.ai/rules/testing-strategy.md`, all automated suites are `bun:test` files under `tests/**`, run with `bun test` and folded into `pnpm check`.

- **Unit and pure decision tests** - direct calls to the delivered decision layer (`decidePeakStops`, `decidePeakResumes`, `runPeakWatch`, `runPeakResume`) and to the configuration resolver. Used to pin parity of the decision inputs and the setting's default and refusal. Target: `tests/behaviour/*peak*.test.ts` and `tests/behaviour/config-lane.test.ts`.
- **Behaviour and integration tests** - the command-level dispatch harness `createCommandScenario`, the temporary state store and lease clock, the scripted session port, the in-memory event transport, the seeded telemetry ledger, the production composition factory, and the stop-hand-off fixture that runs a separate stop command and the owning invocation over one durable store. Used for the episode lifecycle, pre-session park, nomination, lease renewal, stop command, resume routing, surfaces, isolation, and spend. Target: new `tests/behaviour/dispatch-peak-*.test.ts` and `tests/behaviour/dispatch-stop*.test.ts`, extending the existing dispatch and daemon park suites by pattern, never by copy.
- **Structure tests** - `tests/structure/**`: closed-set and contract assertions (taxonomy unchanged, the additive lane-record, status, and result shapes, the composition fact, the changeset tree invariant). Target: `tests/structure/event-taxonomy-*.test.ts`, `tests/structure/dispatch-contract.test.ts`, `tests/structure/changeset-additivity.test.ts`, with a new narrow `tests/structure/dispatch-peak-contract.test.ts` only if the additive contract needs one.
- **Check and invariant tests** - `tests/checks/**`: hermeticity canaries and source scans, event payload bounds, release shape, and the mutation controls that prove a guard can fail. Target: `tests/checks/peak-pause-hermetic.test.ts` (extended), `tests/checks/event-taxonomy-conformance.test.ts`, `tests/checks/privacy-release.test.ts`.
- **Manual/operational evidence** - TC-PEAK-029 is a post-upgrade observation by the reference host on the next lane; the pull request records the hand-off and its preconditions. No automated suite depends on it and it is not a Done criterion.
- **Aggregate gate** - `pnpm check` (lint, format check, typecheck, test, boundaries) is the final verification. The full battery runs once at the gate; during implementation only the affected suites run (section 7).

Test type vocabulary used in section 5 follows the template: Unit, Integration, Contract, E2E, Manual, Performance, plus the repository's Structure and Check layers as the location qualifier.

## 5. Test Scenarios

### 5.1 Scenario Index

| TC ID | Title | Type | Level | Priority | AC Coverage | Plan Phase |
|-------|-------|------|-------|----------|-------------|------------|
| TC-PEAK-001 | Dispatch-owned watch and daemon watch agree on the same profile and instant | Contract | Behaviour + Structure | Critical | AC-F1-1 | 2 |
| TC-PEAK-002 | Mid-iteration and between-iteration windows both park; the watch lives to terminal | Happy Path | Behaviour | Critical | AC-F1-2 | 2 |
| TC-PEAK-003 | Paired identical runs produce byte-identical episode evidence with the mode carve-out | Regression | Behaviour | High | AC-F1-3 | 5 |
| TC-PEAK-004 | Chain-first-no-window does not exempt a lane nominated to a later profile with an open window | Edge Case | Behaviour | Critical | AC-F2-1 | 2 |
| TC-PEAK-005 | A profile with no `peakWindows` is never stopped; admission gating is unchanged | Negative | Behaviour | Critical | AC-F2-2 | 2 |
| TC-PEAK-006 | One bounded-grace stop and exactly-once park at the window's start, with the grace arms | Happy Path | Behaviour | Critical | AC-F3-1 | 2 |
| TC-PEAK-007 | Stop and park lags are derived and bounded; park is no later than stop plus grace | Happy Path | Behaviour | High | AC-F3-2 | 2 |
| TC-PEAK-008 | Preserved resume: same session, branch, and worktree; one `resumed`; zero ordinals | Happy Path | Behaviour | Critical | AC-F4-1 | 2 |
| TC-PEAK-009 | Not-preserved recovery and the non-terminal refusal: one ordinal per observation, no `resumed`, exhaustion escalates | Corner Case | Behaviour | Critical | AC-F4-2, AC-F4-3 | 2 |
| TC-PEAK-010 | Nothing lost and the lease stays live across several TTLs | Happy Path | Behaviour | Critical | AC-F5-1, AC-F5-2 | 2 |
| TC-PEAK-011 | `dispatch status` reports the park fact and the three parked-lane probe arms | Happy Path | Behaviour | Critical | AC-F6-1, AC-F6-5 | 3 |
| TC-PEAK-012 | `lanes` and `board` show the dispatch-owned park and the live lease holder | Happy Path | Behaviour | High | AC-F6-2 | 3 |
| TC-PEAK-013 | No-park output is byte-identical except the one intended mode value | Regression | Behaviour + Golden | Critical | AC-F6-3 | 3 |
| TC-PEAK-014 | One invocation returns one result whose summary states paused and resumed, including a refusal | Happy Path | Behaviour | Critical | AC-F7-1 | 3 |
| TC-PEAK-015 | The disabling key unset, `false`, and `true` behave exactly as declared | Edge Case | Behaviour + Contract | Critical | AC-F8-1 | 2 |
| TC-PEAK-016 | `dispatch stop` works identically when automatic pausing is disabled | Edge Case | Behaviour | High | AC-F8-2 | 4 |
| TC-PEAK-017 | An invalid disabling value is refused by name with no partial effect | Negative | Behaviour + Contract | High | F-8 derived | 1 |
| TC-PEAK-018 | `dispatch stop --cause peak-window --until` equals a window-open stop, payload for payload | Happy Path | Behaviour | Critical | AC-F9-1 | 4 |
| TC-PEAK-019 | `dispatch stop` never kills; one terminate call with the composed grace; TERM before KILL | Negative | Behaviour + Structure | Critical | AC-F9-2 | 4 |
| TC-PEAK-020 | A stop for a terminal, absent, or session-less active lane is a classified refusal that writes nothing | Negative | Behaviour | Critical | AC-F10-1 | 4 |
| TC-PEAK-021 | An active owner hold does not change the watch or the park | Corner Case | Behaviour | High | AC-F11-1 | 2 |
| TC-PEAK-022 | Per-profile isolation: only the lane in an open window parks and resumes | Happy Path | Behaviour | High | AC-F11-2 | 2 |
| TC-PEAK-023 | Zero-spend reading is positive zero with present telemetry and a classified absence otherwise | Happy Path | Behaviour | Critical | AC-F12-1 | 3 |
| TC-PEAK-024 | A seeded mid-window call makes the zero-spend claim fail | Negative | Behaviour | Critical | AC-F12-2 | 3 |
| TC-PEAK-025 | Resume admission re-checks the window and never resumes into an open window | Corner Case | Behaviour | High | F-4 derived | 2 |
| TC-PEAK-026 | The delivering suites are hermetic: zero live resources, zero real sleeps | Check | Checks | Critical | NFR-5, NFR-7 | 5 |
| TC-PEAK-027 | Vocabulary economy and event evidence bounds hold, including the pre-session shape | Check | Structure + Checks | High | NFR-8 | 5 |
| TC-PEAK-028 | The change's changeset exists before the first gate run | Check | Checks + Structure | High | Owner note, TC-RELEASE-001 | 1 |
| TC-PEAK-029 | The reference host observes one real episode on the next lane after the upgrade; the PR records the hand-off | Manual | Manual | Medium | Owner behavioural verification (non-gating) | 7 |
| TC-PEAK-030 | A window already open at dispatch start parks before the first session | Happy Path | Behaviour | Critical | AC-F1-4 | 2 |
| TC-PEAK-031 | The durable lane record carries the nomination from first acquisition | Happy Path | Behaviour | Critical | AC-F2-3 | 2 |
| TC-PEAK-032 | One terminate call carries the composed grace; escalation cannot outlast the buffer | Happy Path | Behaviour | Critical | AC-F3-3 | 2 |
| TC-PEAK-033 | The production composition mode is configuration-derived in both settings | Happy Path | Behaviour + Contract | Critical | AC-F6-4 | 3 |
| TC-PEAK-034 | A stop with another cause or a missing end is refused before any read | Negative | Behaviour | High | AC-F9-3 | 4 |
| TC-PEAK-035 | The stop success output and the owning invocation's wait and resume | Happy Path | Behaviour | Critical | AC-F9-4 | 4 |
| TC-PEAK-036 | A stop racing a session end resolves exactly one classified outcome | Corner Case | Behaviour | Critical | AC-F10-2 | 4 |

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

1. Run a dispatch lane where the window opens during an in-flight session observation, advance the clock to the open instant, and observe the watch.
2. Run a second dispatch lane where the window opens after one observation returns and before the next session step.
3. Continue both lanes past the resume to their terminal classification.
4. Record every watch evaluation after the terminal classification.

**Expected Outcome**:

- Both lanes park with cause `peak-window`.
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

- The lane parks with cause `peak-window`, the nominated later profile named, and `until` at that profile's effective end.
- The absent rules on the chain's first entry produce no exemption and no default rule.

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

#### TC-PEAK-006 - One bounded-grace stop and exactly-once park at the window's start, with the grace arms

**Scenario Type**: Happy Path
**Impact Level**: Critical
**Priority**: High
**Related IDs**: F-3, AC-F3-1, NFR-1, NFR-2, DM-1, events `stop` and `parked`
**Test Type(s)**: Integration
**Automation Level**: Automated
**Target Layer / Location**: `tests/behaviour/dispatch-peak-episode.test.ts` (new), with the event projection harness from `tests/fixtures/events/event-harness.ts`
**Tags**: @backend, @events

**Preconditions**:

- A running dispatch lane nominated to a profile whose window opens at a known instant.
- An injected clock, an injected delay, and a scripted transport that records stop requests.
- Three grace arms: a default grace below the derived maximum; a small-buffer arm where the time from the stop instant to the effective end is smaller than the delivered kill grace; and a grace-above-cadence arm where the profile grace is longer than one observation cadence.
- A profile rule fixture whose declared buffers are known.

**Steps**:

1. Advance the clock to the buffer-inclusive open instant and run the watch on the default arm.
2. Read the park record and project the episode events.
3. Repeat the watch over several later observations.
4. Repeat with the small-buffer fixture and record the park instant relative to the stop instant and the effective end.
5. Repeat with the grace-above-cadence fixture and record the stop instant, the park instant, and the applied grace.

**Expected Outcome**:

- Exactly one bounded-grace stop request reaches the delivered stop seam.
- One park record with cause `peak-window`, the profile, `until` at the effective end, the recorded stop instant, the grace deadline, one episode id, and the closed preservation classification.
- Exactly one `stop` and one `parked` event share the episode id; the `park-edge` projection appears once; further observations add no frame and mutate no record.
- The grace deadline never exceeds the profile's derived maximum; no second signal path is used.
- Small-buffer arm: the park lands no later than the effective end, so the escalation cannot outlast the buffer.
- Grace-above-cadence arm: the stop request lands within one cadence, and the park lands after the stop plus the applied grace rather than within one cadence; the park bound is stop plus grace.

#### TC-PEAK-007 - Stop and park lags are derived and bounded; park is no later than stop plus grace

**Scenario Type**: Happy Path
**Impact Level**: Important
**Priority**: High
**Related IDs**: F-3, AC-F3-2, NFR-6
**Test Type(s)**: Integration
**Automation Level**: Automated
**Target Layer / Location**: `tests/behaviour/dispatch-peak-episode.test.ts`, using `livenessIntervalMs` and the injected clock
**Tags**: @backend, @latency

**Preconditions**:

- The delivered liveness cadence configured to a known value, for example 30 000 ms.
- The window open instant, and the first observation instant at a known offset inside one cadence.
- A grace-below-cadence arm and a grace-above-cadence arm over the same fixture.

**Steps**:

1. Advance the clock to the open instant, then to the first observation instant; run the watch and record the open, stop, park, and effective-end instants.
2. Derive the stop lag from the open observation to `stoppedAt`; assert it is at most one cadence.
3. Assert the park instant is no later than `stoppedAt` plus the applied grace.
4. Repeat with the grace-above-cadence arm: the stop still lands within one cadence, and the park lands after the applied grace.
5. Assert no new evidence field was added to the park record or the result.

**Expected Outcome**:

- The stop request lands at the first observation at or after the open instant, never later than one cadence.
- The park instant is no later than the stop instant plus the applied grace; with a grace above a cadence the park is bound by the grace, not by the cadence.
- Both lags are derived from the recorded `stoppedAt`, `graceDeadline`, and `until`; no lag field is added to any record or payload.
- No test asserts a wall-clock duration; the cadence and the clock are injected.

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

#### TC-PEAK-009 - Not-preserved recovery and the non-terminal refusal: one ordinal per observation, no `resumed`, exhaustion escalates

**Scenario Type**: Corner Case
**Impact Level**: Critical
**Priority**: High
**Related IDs**: F-4, AC-F4-2, AC-F4-3, NFR-4, DM-1, DM-3, DM-4, event `parked`
**Test Type(s)**: Integration
**Automation Level**: Automated
**Target Layer / Location**: `tests/behaviour/dispatch-peak-recovery.test.ts` (new), reusing `tests/behaviour/dispatch-resume-economics.test.ts` and `tests/behaviour/dispatch-restart-budget.test.ts` patterns
**Tags**: @backend, @recovery

**Preconditions**:

- A peak-window episode whose state preservation fails.
- The delivered restart budget recorded on the lane and the delivered typed-question seam available.
- An injected clock, a scripted session port, and a recording restart append.
- A recovery arm that refuses without being terminal, through the delivered uneconomical-resume and unverifiable-state refusals.

**Steps**:

1. Run the window-open stop with a preservation failure.
2. Read the park record and the applied grace.
3. Advance the clock to the recorded end and run the resume decision; observe the admitted recovery and its ordinal.
4. Repeat with the restart count already at the delivered budget.
5. Repeat with the recovery refusing without being terminal; read the invocation's bounded episode fact and the `dispatch status` park fact, and count the ordinals appended in that observation.

**Expected Outcome**:

- The park lands anyway with `session-state-not-preserved`; the preservation failure neither refuses the park nor extends the grace.
- At the end, no session resume is attempted and no `resumed` event is emitted; the delivered interrupted-lane recovery runs on the same branch and consumes at most one restart ordinal per observation.
- At budget exhaustion, the delivered terminal exhaustion record is appended and the delivered typed question is raised.
- Non-terminal refusal: no additional ordinal is consumed in that observation, the lane stays parked, and the refusal appears in the episode fact and the `dispatch status` park fact with the recorded end; the invocation does not wait without a stated reason.

#### TC-PEAK-010 - Nothing lost and the lease stays live across several TTLs

**Scenario Type**: Happy Path
**Impact Level**: Critical
**Priority**: High
**Related IDs**: F-5, AC-F5-1, AC-F5-2, NFR-4, NFR-10, DM-9
**Test Type(s)**: Integration
**Automation Level**: Automated
**Target Layer / Location**: `tests/behaviour/dispatch-peak-preservation.test.ts` (new), using the temporary git repository, the store harness with its injected lease clock, and the `tests/behaviour/queue-lease*.test.ts` renewal pattern
**Tags**: @backend, @single-flight, @lease

**Preconditions**:

- A lane with a branch, a change folder with recorded phases, a queue entry, a lease, and a recorded worktree.
- The delivered lease TTL configured to its 90 000 ms default and an injected clock that can cross it.
- A snapshot function for branch tip, change-folder file set and content, phase list, queue state, worktree path, lease heartbeat age, and the renewal records.
- A second-dispatch admission probe that reads the same store.
- A renewal-failure arm in which one renewal fails and the next succeeds.

**Steps**:

1. Take the snapshot before the park.
2. Park the lane.
3. Advance the injected clock across several TTL boundaries; at each boundary attempt a second dispatch of the same work item just before, exactly at, and just after the boundary.
4. After each attempt, read the lease heartbeat age and the renewal records; assert the lane renewed at the observation cadence and no takeover occurred.
5. Run the renewal-failure arm; read the lease evidence and the next cadence's renewal.
6. Advance to the recorded end, resume, and wait for the terminal classification.
7. Take the snapshot after the resume and compare every element.

**Expected Outcome**:

- A second dispatch is refused `queue.single-flight` with the live holder at every attempted point before, at, and after each TTL boundary across the whole parked interval.
- The lease's heartbeat age stays below the TTL throughout; the renewal records exist at the observation cadence, use the existing lease record, and add no new record kind.
- A renewal failure is retried at the next cadence and surfaced as bounded lease evidence; the lease does not go stale and no takeover follows.
- No takeover, no second session, and no second episode exist for the work item.
- Branch, change folder, recorded phases, and queue state are unchanged; the recorded worktree is reused and not re-provisioned.

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
- A park record carrying a recorded recovery refusal in one arm.
- A store read counter that records bounded park-record reads.
- The exact additive member names fixed by the delivery in this change.

**Steps**:

1. Invoke `dispatch status <ref> --json` with the owner probe `live`; read the park fact, `stale`, `delivering`, and the observed probe verdict.
2. Repeat with the owner probe `unknown`.
3. Repeat with the owner probe `dead`.
4. Repeat with the recovery-refusal arm and with the park record expired.
5. Assert the bounded park-record read count.

**Expected Outcome**:

- The park fact carries the cause, the window's end, the recorded stop instant, the preservation classification, and any recorded recovery refusal from the record; it is absent when no park stands.
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

1. Render `dispatch status`, `board`, `brief`, and a dispatch result from the no-park state; compare each byte for byte with the pre-change golden.
2. Render `lanes --json` on the production composition with pausing enabled; compare every member and every human line except `peakEnforcement.mode`.
3. Assert `peakEnforcement.mode` is the only difference and reads `window-watch`; `parkClaimed` and every other member stay pre-change.
4. Repeat with pausing disabled and assert the mode keeps its delivered `iteration-start-gating` value and the output is fully byte-identical.

**Expected Outcome**:

- `dispatch status`, `board`, `brief`, and the dispatch result are byte-identical with no park open; the additive park and episode members are absent, not null.
- `lanes --json` with pausing enabled differs only in `peakEnforcement.mode`, which reads `window-watch`; no other member or human line moves.
- With pausing disabled, `lanes` is fully byte-identical and the mode reads `iteration-start-gating`.
- No golden is updated in this scenario; the no-park pins are deliberately untouched and the carve-out is asserted as one named field.

#### TC-PEAK-014 - One invocation returns one result whose summary states paused and resumed, including a refusal

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
- A second arm in which the not-preserved recovery refuses without being terminal.
- The same truth inputs run once without an episode as the token and exit control.
- The exact additive episode member names fixed by the delivery in this change.

**Steps**:

1. Run the spanning invocation to completion on the preserved arm.
2. Read the result count, token, exit projection, human summary, and machine envelope.
3. Read the bounded episode fact.
4. Compare the token and exit with the no-episode control.
5. Repeat on the recovery-refusal arm and read the refusal in the episode fact.

**Expected Outcome**:

- Exactly one result for the work item; token and exit are the same the same truth would produce without an episode; no episode invents a token.
- The summary states that the lane was paused and resumed, names the cause and the episode's end.
- The envelope carries the bounded episode fact: episode id, cause, park end, and resume instant, the preservation classification when the resume was a recovery, and the refusal where a recovery refused.
- The refusal arm does not wait without a stated reason: the answer names the refusal and the recorded end, and the lane remains visible as parked.
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
- A second arm where a dispatch is admitted while the window is already open, to exercise the pre-session evaluation.
- A lane already parked before the key changes to `true`.

**Steps**:

1. Run the lane to the open window with the key absent; then with `false`.
2. Run the same lane with the key `true`; read the composition fact and the written records.
3. Admit a dispatch while the window is already open under the key `true`; assert no pre-session evaluation and no pre-session park, and that the first session starts as delivered.
4. Change the key to `true` while a lane is already parked and run the next observation.
5. Compare the `true` arm's result with the delivered pre-change admission-gating-only behaviour.

**Expected Outcome**:

- Absent or `false`: the lane parks exactly as specified, including the pre-session park when the window is already open.
- `true`: no pre-session evaluation, no in-flight watch, no stop, no park, no resume, no episode event; admission gating refuses a new dispatch inside a provider-entry window exactly as delivered; the composition fact reports `iteration-start-gating`; no zero-spend reading is synthesized for a park that did not happen.
- The key is resolved for each admitted change; it never rewrites an already parked lane and never disables `dispatch stop`.

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

#### TC-PEAK-019 - `dispatch stop` never kills; one terminate call with the composed grace; TERM before KILL

**Scenario Type**: Negative
**Impact Level**: Critical
**Priority**: High
**Related IDs**: F-9, AC-F9-2, NFR-1
**Test Type(s)**: Integration, Structure
**Automation Level**: Automated
**Target Layer / Location**: `tests/behaviour/dispatch-stop-safety.test.ts` (new), reusing the delivered terminate-path fixtures from the dispatch stall and coordinator kill suites
**Tags**: @backend, @stop, @safety

**Preconditions**:

- A running lane with an identified session and process target.
- A recording terminate seam that observes TERM and KILL requests, the single `graceMs` input, and the target listing.
- Three arms where a different bound is the smallest: the remaining profile grace, the delivered kill grace, and the time to the effective end.
- A case where the session is unknown.

**Steps**:

1. Issue `dispatch stop <ref> --cause peak-window --until <iso>` on each bound arm.
2. Record every signal request, its order, its target, and the `graceMs` the one terminate call receives.
3. Run the unknown-session arm.
4. Run the structure guard over the command path for any second signalling route.

**Expected Outcome**:

- The command sends no signal of its own; exactly one terminate call reaches the delivered terminate path.
- The call's `graceMs` is the smallest of the remaining profile grace deadline, the delivered kill grace, and the time to the effective window end; the applied grace never outlasts the buffer.
- TERM is requested before KILL; KILL follows only after that grace and only over a target still listed.
- An unknown session is treated as success.
- No second signal path, pattern, process-group signal, or kill mechanism exists.

#### TC-PEAK-020 - A stop for a terminal, absent, or session-less active lane is a classified refusal that writes nothing

**Scenario Type**: Negative
**Impact Level**: Critical
**Priority**: High
**Related IDs**: F-10, AC-F10-1, NFR-8
**Test Type(s)**: Integration
**Automation Level**: Automated
**Target Layer / Location**: `tests/behaviour/dispatch-stop-refusal.test.ts` (new), extending `tests/behaviour/dispatch-attempts-refusals.test.ts` and the delivered unmet-precondition family
**Tags**: @backend, @stop, @refusal

**Preconditions**:

- Three arms for the newest lane record: terminal, absent, and active without a session identity.
- A store snapshot and a read counter before each command.

**Steps**:

1. Snapshot the record set and the store read count for each arm.
2. Issue `dispatch stop <ref> --cause peak-window --until <iso>` on each arm.
3. Read the refusal identity, the exit, and the bounded summary.
4. Compare each record set with its snapshot.

**Expected Outcome**:

- Every arm refuses with the delivered classified unmet-precondition identity at its delivered exit; no new identity or row.
- The summary names the work item and the observed lane state within the evidence bound, and distinguishes the three states.
- No park record, episode event, attempt, lane, or queue record is appended; nothing is signalled; the cost is read-like and bounded.

#### TC-PEAK-021 - An active owner hold does not change the watch or the park

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

**Steps**:

1. Run the watch with the hold active and the window open.
2. Read the park record and any record the hold itself wrote.
3. Advance to the recorded end with the hold still active and run resume admission.
4. Clear the hold and run the next resume observation.

**Expected Outcome**:

- The lane still parks `peak-window` with `until`; the hold writes no park record of its own.
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
- The pre-session interval holds the same claim before any session exists; that arm is exercised in TC-PEAK-030 and reuses this reading.

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

**Steps**:

1. Arm the network, credential, and sleep canaries with a proven-firing control.
2. Run a full park, wait, and resume pass over the injected seams.
3. Scan the watched sources for direct network, credential-read, `setTimeout`, and real-sleep calls outside the declared seam.
4. Assert the canaries counted zero calls and the scan found no violation.

**Expected Outcome**:

- Zero live network calls, zero credential reads, zero real sleeps, and temp-directory state only.
- The guard fails if a watched module introduces a live resource call; it cannot pass vacuously.

#### TC-PEAK-027 - Vocabulary economy and event evidence bounds hold, including the pre-session shape

**Scenario Type**: Regression (contract)
**Impact Level**: Important
**Priority**: High
**Related IDs**: NFR-8, events `stop`, `parked`, `resumed`, `park-edge`, DM-1
**Test Type(s)**: Contract, Check
**Automation Level**: Automated
**Target Layer / Location**: `tests/structure/event-taxonomy-integrity.test.ts`, `tests/checks/event-taxonomy-conformance.test.ts`, and a narrow `tests/structure/dispatch-peak-contract.test.ts` only if the additive contract needs its own closed-set assertion
**Tags**: @backend, @contract

**Preconditions**:

- The delivered taxonomy declarations, the error table, the result-token set, and the event payload bound constants.
- A dispatch-owned park record with a complete episode frame.

**Steps**:

1. Assert the closed sets are unchanged: no added event kind, record kind, schema identity, result token, or error-table row.
2. Project the four episode frames and measure payload fields and evidence bytes.
3. Assert the not-running refusal reuses a delivered identity and adds no row.

**Expected Outcome**:

- Zero added kinds and identities; zero added error rows.
- Every projected frame stays within at most 20 payload fields and 1024 bytes; every frame stays inside the delivered eight-field envelope.
- The pre-session park projects the `park-edge` alone and adds no `stop` or `parked` frame; the completed stop episode projects the four expected frames.
- A non-terminal recovery refusal adds no frame; it is carried by the existing park record and the surfaces, not by a new event.
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

#### TC-PEAK-029 - The reference host observes one real episode on the next lane after the upgrade; the PR records the hand-off

**Scenario Type**: Manual (operational, post-upgrade hand-off)
**Impact Level**: Important
**Priority**: Medium
**Related IDs**: Owner delivery note 3; spec section 18.1 item 7; F-1 through F-12 observed end to end
**Test Type(s)**: Manual
**Automation Level**: Manual
**Target Layer / Location**: Reference host, the next lane after this change is installed; the pull request records the hand-off and its preconditions; section 10 carries the row
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
4. Record on the pull request the hand-off itself: the tracked profile fact, the liveness relaxation, the command sequence used to observe the episode, and then the episode id, park and resume instants, derived lags, zero-spend reading, and one-result summary.
5. Fill the TC-PEAK-029 row in section 10 with the observation date, result, and the PR evidence link when the next lane has run.

**Expected Outcome**:

- The pull request records the hand-off and its preconditions: the nominated profile declares `peakWindows` (the tracked fact) and the activity-keyed liveness relaxation is in place.
- The real episode, once observed, shows exactly one `stop`, one `parked`, one `park-edge`, and one `resumed`; the session, branch, worktree, change folder, phases, queue state, and live lease survive; no second session exists; the zero-spend reading is zero over present telemetry; the one result states paused and resumed.
- The automated fixtures remain the merge gate. The episode is a post-upgrade observation, explicitly non-gating, named in the DoD as a recorded hand-off rather than as a Done criterion.

**Notes / Clarifications**:

- The episode is not performed by the delivering lane: that lane runs on the pre-change binary and holds this repository's lease. The PR records the hand-off, not a claimed episode.

#### TC-PEAK-030 - A window already open at dispatch start parks before the first session

**Scenario Type**: Happy Path
**Impact Level**: Critical
**Priority**: High
**Related IDs**: F-1, F-5, F-12, AC-F1-4, NFR-2, NFR-11, DM-1
**Test Type(s)**: Integration
**Automation Level**: Automated
**Target Layer / Location**: `tests/behaviour/dispatch-peak-presession.test.ts` (new), over `createCommandScenario` with a stepping clock and a spawn recorder
**Tags**: @backend, @presession

**Preconditions**:

- A nominated profile whose buffer-inclusive window is already open at the admitted instant.
- An injected clock, a scripted session port that records every spawn and resume, and a telemetry ledger that can attribute calls.
- A live lease held from admission.

**Steps**:

1. Admit the dispatch while the window is open and run the pre-session watch evaluation before any spawn or resume.
2. Read the spawn and resume counts, the billable-call count before the park, the park record, the projected events, and the lease.
3. Advance the clock to the effective end and run the first session start.
4. Take the window-scoped reading for the interval before the session existed.

**Expected Outcome**:

- No session is spawned and no billable call is made before the park.
- The park carries `preservation: preserved`, cause `peak-window`, `until` at the effective end, and one episode id; it writes no stop and no grace frame, so the record projects the `park-edge` alone.
- The lease is held and renewed through the wait; the first session starts at the effective end; no `resumed` event is emitted for that first start.
- The pre-session interval reads zero attributable calls over present telemetry.

#### TC-PEAK-031 - The durable lane record carries the nomination from first acquisition

**Scenario Type**: Happy Path
**Impact Level**: Critical
**Priority**: High
**Related IDs**: F-2, AC-F2-3, DM-2
**Test Type(s)**: Integration
**Automation Level**: Automated
**Target Layer / Location**: `tests/behaviour/dispatch-peak-nomination.test.ts` (new), reading the durable lane record through the store harness
**Tags**: @backend, @nomination

**Preconditions**:

- A lane admitted under a named nominated profile.
- A pre-change lane record fixture with no `providerProfile`.
- A park episode produced in the same run.

**Steps**:

1. Read the durable lane record during the run and again during the park.
2. Read the park and event payloads.
3. Load the pre-change record and run the watch over it.

**Expected Outcome**:

- The lane record carries the nominated `providerProfile` from the first acquisition; it is present during the run and unchanged during the park.
- The park and event payloads carry the same profile, read from the record rather than re-resolved.
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
**Target Layer / Location**: `tests/behaviour/dispatch-peak-mode.test.ts` (new), using the production composition factory, with `tests/behaviour/peak-pause-composed-edge.test.ts` as the control pattern
**Tags**: @backend, @mode

**Preconditions**:

- The production composition with automatic pausing enabled and the same composition with it disabled.
- Durable park records in both arms so `parkClaimed` is observable.
- A control that proves the fixture reaches the production composition, not a test-only watch override.

**Steps**:

1. Read `lanes --json` on the production composition with pausing enabled.
2. Read it again with pausing disabled.
3. Compare `peakEnforcement.mode` and `parkClaimed` with the durable park records in both arms.

**Expected Outcome**:

- Enabled: `peakEnforcement.mode` is `window-watch`; disabled: `iteration-start-gating`.
- The mode is derived from the reading composition's own effective configuration, never from another process or a test override.
- `parkClaimed` follows the durable park records in both arms; no third mode value appears.

#### TC-PEAK-034 - A stop with another cause or a missing end is refused before any read

**Scenario Type**: Negative
**Impact Level**: Important
**Priority**: High
**Related IDs**: F-9, AC-F9-3, NFR-8
**Test Type(s)**: Integration
**Automation Level**: Automated
**Target Layer / Location**: `tests/behaviour/dispatch-stop-cause.test.ts` (new), with grammar and refusal patterns from `tests/behaviour/dispatch-stop-refusal.test.ts`
**Tags**: @backend, @stop, @refusal

**Preconditions**:

- A running lane and a store read counter.
- Causes outside the admitted set, including `owner-hold` and `liveness-stall`, and an invocation with no `--until`.

**Steps**:

1. Snapshot the store and the read count.
2. Issue `dispatch stop <ref>` with each disallowed cause, and separately with no end.
3. Read the refusal identity, the named cause or missing end, and the exit.
4. Compare the store and read count with the snapshot.

**Expected Outcome**:

- Each request is refused by name before any lane read or write; the delivered classified identity is reused and no error-table row is added.
- A missing end is refused with the same discipline, because the delivered expiry-carrying cause requires it.
- Nothing is written and nothing is signalled; the refusal stays inside the evidence bound.

#### TC-PEAK-035 - The stop success output and the owning invocation's wait and resume

**Scenario Type**: Happy Path
**Impact Level**: Critical
**Priority**: High
**Related IDs**: F-9, AC-F9-4, DM-8, DM-9
**Test Type(s)**: Integration
**Automation Level**: Automated
**Target Layer / Location**: `tests/behaviour/dispatch-stop-handoff.test.ts` (new), running a separate stop command and the owning invocation over one durable store with an injected clock
**Tags**: @backend, @stop, @handoff

**Preconditions**:

- A running lane whose owning invocation is alive and waiting.
- A durable lane record carrying the session identity, worktree path, and nomination.
- A separate stop command process over the same store.
- An injected clock and a deterministic episode factory.

**Steps**:

1. Invoke `dispatch stop <ref> --cause peak-window --until <iso>` from the separate command.
2. Read the human line, the machine data, and the exit.
3. Run the owning invocation's next observation; observe that it re-reads the lane and park record, renews the lease, and waits instead of returning.
4. Advance to the recorded end and observe the resume and the one result.

**Expected Outcome**:

- The human output is one line naming the work item, cause, park end, and episode id.
- The machine data carries the work item, cause, park end, episode id, and preservation classification at exit `0`; no new envelope shape or key family.
- The owning invocation recognises the open park it did not create, keeps renewing the lease, waits, and resumes at the end; it does not classify and return before the episode ends.
- The lane returns one result whose summary states paused and resumed.

#### TC-PEAK-036 - A stop racing a session end resolves exactly one classified outcome

**Scenario Type**: Corner Case
**Impact Level**: Critical
**Priority**: High
**Related IDs**: F-10, F-9, AC-F10-2, NFR-2, NFR-8
**Test Type(s)**: Integration
**Automation Level**: Automated
**Target Layer / Location**: `tests/behaviour/dispatch-stop-race.test.ts` (new), with a deterministic clock and a store snapshot
**Tags**: @backend, @stop, @race

**Preconditions**:

- A session that can be made to end at the same observation in which a stop is resolved.
- A store snapshot and a record-kind counter.
- Two orderings: the stop resolves first, and the session end resolves first.

**Steps**:

1. Run the stop and the session end in each ordering at the same injected instant.
2. Read the outcome class, the park record, the episode events, and the lane record.
3. Compare the store with the expected single outcome for each ordering.

**Expected Outcome**:

- Exactly one classified outcome per request: either the complete episode with one `stop` and one `parked`, or the not-running refusal.
- No partial episode, duplicate frame, or write from the losing side; a request that loses the race writes nothing.
- The lane record and the durable park state agree with the single chosen outcome.

## 6. Environments and Test Data

- **Runtime**: local development and CI, Bun pinned by `.bun-version`, `bun:test` discovery per `bunfig.toml`. No browser, no container, no external service.
- **State**: a temporary state store per fixture from `tests/fixtures/state/harness.ts` (`makeTempRoot`, `openStore`, `makeIdentity`, `removeRoot`), disposed in a `finally` block. No test writes to a real state root.
- **Git**: a temporary repository per lifecycle fixture for branch, worktree, change-folder, phase, and queue-state assertions, created by the harness inside its own temp directory. The fixture never runs in the developer checkout.
- **Injected seams**:
  - Clock: `nowIso` (or a controllable stepping clock) on `createCommandScenario`; the fixture advances time explicitly. No `setTimeout`, `Bun.sleep`, or real timer participates.
  - Delay: the delivered `DispatchDelay` seam, recording each requested delay and returning immediately; the wait's wake count is asserted over this spy.
  - Transport: the scripted `HarnessSessionPort` and the in-memory event transport pair; zero live provider, tracker, or network calls.
  - Restart and resume: the delivered restart-append and resume-economics seams, seeded with explicit budgets and counts.
  - Lease clock and TTL: the store harness's injected clock with the delivered 90 000 ms lease TTL, so TC-PEAK-010 can cross several TTLs without sleeping; renewal records are read from the existing lease record.
  - Production composition: the delivered production composition factory, with automatic pausing enabled and disabled, so TC-PEAK-033 cannot pass through a test-only watch override; the `peak-pause-composed-edge` case is the control pattern.
  - Stop hand-off and race: one durable store shared by a separately invoked stop command and the owning invocation, with a deterministic clock and an episode factory; the session-end race is driven by the same fixture.
- **Test data**:
  - Profile rule fixtures: a UTC profile with one window and buffers, a profile with overlapping windows for the union assertion, a profile with no `peakWindows`, a preference chain with a base entry that declares none, a small-buffer profile whose buffer is shorter than the delivered kill grace, and a grace-above-cadence profile.
  - Episode fixtures: deterministic episode-id factory, declared grace values below and at the derived maximum, preserved and not-preserved classifications, a non-terminal recovery-refusal arm, the pre-session arm with no session, and the `peak-window` operator cause with its declared end.
  - Nomination fixtures: a lane record with the additive `providerProfile`, a pre-change lane record without it, and a chain whose base entry has no windows.
  - Lease fixtures: a live lease with renewal records, a lease record near its TTL, and a second-dispatch admission probe.
  - Telemetry fixtures: a present ledger with no in-window call, a present ledger with a seeded in-window call at each inclusive boundary, and an absent-telemetry arm.
  - Surface fixtures: the existing status, lanes, board, brief, and result golden inputs, with and without an open park, and the two production mode values.
- **Isolation**: one temp root and one store per test, unique labels for attempt and divergence ids, no shared mutable module state. Tests run in any order. Every fixture is created inside the checkout or the change folder; no test or delivery step searches the file system outside them (owner delivery note 4).
- **Manual environment**: the reference host only, for TC-PEAK-029, on the next lane after the upgrade. Its evidence is a pull-request hand-off record and the eventual episode record, never a hidden local step.
- **Gate environment**: `TMPDIR=$PWD/tmp/tmpdir` for the aggregate gate, as the repository's `ci-baseline-parity` cross-device requirement expects.

## 7. Automation Plan and Implementation Mapping

Implementation order follows the spec's delivery order: setting and validation, the lane-record nomination and the pre-session evaluation, the watch and episode with the composed grace, the lease renewal, the wait and resume with the refusal outcome, the surfaces and the mode rule, then the operator command. Each phase adds tests for what it changes and leaves the delivered behaviour intact when its part is not exercised. The plan-phase column is the ownership the revised implementation plan follows; no phase is invented here.

Execution guidance from the owner, recorded here as delivery guidance and not as a new requirement:

- While implementing, run only the affected suites, for example `bun test tests/behaviour/dispatch-peak-*.test.ts tests/behaviour/dispatch-stop*.test.ts tests/behaviour/config-lane.test.ts`.
- Run the whole battery once at the gate: `pnpm check`, with `TMPDIR=$PWD/tmp/tmpdir`.
- Create the change's changeset before the first gate run (TC-PEAK-028).
- Do not search the file system outside the checkout and the change folder (owner delivery note 4). Every fixture and every command below stays inside them.

| TC ID | Test file | Execution command | Injection / mocking | Plan phase | Status |
|-------|-----------|-------------------|---------------------|------------|--------|
| TC-PEAK-001 | `tests/behaviour/dispatch-peak-parity.test.ts` | `bun test tests/behaviour/dispatch-peak-parity.test.ts` | Injected clock and shared rules lookup over both compositions | 2 | To Implement |
| TC-PEAK-002 | `tests/behaviour/dispatch-peak-watch.test.ts` | `bun test tests/behaviour/dispatch-peak-watch.test.ts` | `createCommandScenario` with `nowIso` and a scripted liveness sequence | 2 | To Implement |
| TC-PEAK-003 | `tests/behaviour/dispatch-peak-determinism.test.ts` | `bun test tests/behaviour/dispatch-peak-determinism.test.ts` | Fixed clock sequence, delay spy, scripted transport, deterministic ids, mode carve-out | 5 | To Implement |
| TC-PEAK-004 | `tests/behaviour/dispatch-peak-watch.test.ts` | `bun test tests/behaviour/dispatch-peak-watch.test.ts` | Chain fixture with a base entry that declares no `peakWindows` | 2 | To Implement |
| TC-PEAK-005 | `tests/behaviour/dispatch-peak-watch.test.ts` | `bun test tests/behaviour/dispatch-peak-watch.test.ts` | No-window profile, provider-entry `peak` fixture, admission preflight | 2 | To Implement |
| TC-PEAK-006 | `tests/behaviour/dispatch-peak-episode.test.ts` | `bun test tests/behaviour/dispatch-peak-episode.test.ts` | Injected clock, delay spy, stop-request recorder, event transport, grace arms | 2 | To Implement |
| TC-PEAK-007 | `tests/behaviour/dispatch-peak-episode.test.ts` | `bun test tests/behaviour/dispatch-peak-episode.test.ts` | `livenessIntervalMs`, stepping `nowIso`, grace-below/above-cadence arms | 2 | To Implement |
| TC-PEAK-008 | `tests/behaviour/dispatch-peak-resume.test.ts` | `bun test tests/behaviour/dispatch-peak-resume.test.ts` | Preserved-resume seam, session-port recorder, restart ledger | 2 | To Implement |
| TC-PEAK-009 | `tests/behaviour/dispatch-peak-recovery.test.ts` | `bun test tests/behaviour/dispatch-peak-recovery.test.ts` | Preservation-failure fixture, restart budget, typed-question seam, non-terminal refusal arm | 2 | To Implement |
| TC-PEAK-010 | `tests/behaviour/dispatch-peak-preservation.test.ts` | `bun test tests/behaviour/dispatch-peak-preservation.test.ts` | Temporary git repo, store snapshots, injected lease clock crossing several 90 s TTLs | 2 | To Implement |
| TC-PEAK-011 | `tests/behaviour/dispatch-status-park.test.ts` | `bun test tests/behaviour/dispatch-status-park.test.ts` | Open park record, live/unknown/dead probe arms, recovery refusal, read counter | 3 | To Implement |
| TC-PEAK-012 | `tests/behaviour/dispatch-peak-surfaces.test.ts` | `bun test tests/behaviour/dispatch-peak-surfaces.test.ts` | Seed one park record and a live lease, read spy, lanes and board harnesses | 3 | To Implement |
| TC-PEAK-013 | `tests/behaviour/dispatch-peak-byte-identical.test.ts` | `bun test tests/behaviour/dispatch-peak-byte-identical.test.ts` | Pre-change goldens, no-park state, production mode enabled/disabled | 3 | To Implement |
| TC-PEAK-014 | `tests/behaviour/dispatch-peak-result.test.ts` | `bun test tests/behaviour/dispatch-peak-result.test.ts` | Spanning episode fixture, recovery-refusal arm, no-episode control | 3 | To Implement |
| TC-PEAK-015 | `tests/behaviour/dispatch-peak-setting.test.ts` | `bun test tests/behaviour/dispatch-peak-setting.test.ts` | Three configuration arms, pre-session arm, same episode fixture | 2 | To Implement |
| TC-PEAK-016 | `tests/behaviour/dispatch-stop.test.ts` | `bun test tests/behaviour/dispatch-stop.test.ts` | Disabled-setting arm and enabled control, shared episode fixture, `--cause peak-window --until` | 4 | To Implement |
| TC-PEAK-017 | `tests/behaviour/dispatch-peak-setting.test.ts`, `tests/behaviour/config-lane.test.ts`, `tests/fixtures/config/lane.ts` | `bun test tests/behaviour/dispatch-peak-setting.test.ts tests/behaviour/config-lane.test.ts` | Invalid lane source cases; delivered error table | 1 | To Implement |
| TC-PEAK-018 | `tests/behaviour/dispatch-stop.test.ts` | `bun test tests/behaviour/dispatch-stop.test.ts` | Same clock, same episode factory, window-open control, profile from the lane record | 4 | To Implement |
| TC-PEAK-019 | `tests/behaviour/dispatch-stop-safety.test.ts` | `bun test tests/behaviour/dispatch-stop-safety.test.ts` | Recording terminate seam, three bound arms, unknown-session arm, source guard | 4 | To Implement |
| TC-PEAK-020 | `tests/behaviour/dispatch-stop-refusal.test.ts` | `bun test tests/behaviour/dispatch-stop-refusal.test.ts` | Terminal/absent/session-less active arms, store snapshot and read counter | 4 | To Implement |
| TC-PEAK-021 | `tests/behaviour/dispatch-peak-owner-hold.test.ts` | `bun test tests/behaviour/dispatch-peak-owner-hold.test.ts` | Injected owner-hold marker and park-record snapshot | 2 | To Implement |
| TC-PEAK-022 | `tests/behaviour/dispatch-peak-isolation.test.ts` | `bun test tests/behaviour/dispatch-peak-isolation.test.ts` | Two lanes, two profiles, two leases, one injected clock | 2 | To Implement |
| TC-PEAK-023 | `tests/behaviour/dispatch-peak-spend.test.ts` | `bun test tests/behaviour/dispatch-peak-spend.test.ts` | Present and absent telemetry ledgers over the episode interval | 3 | To Implement |
| TC-PEAK-024 | `tests/behaviour/dispatch-peak-spend.test.ts` | `bun test tests/behaviour/dispatch-peak-spend.test.ts` | Seeded in-window calls at both inclusive boundaries | 3 | To Implement |
| TC-PEAK-025 | `tests/behaviour/dispatch-peak-resume.test.ts` | `bun test tests/behaviour/dispatch-peak-resume.test.ts` | Rule-data mutation between park and recorded end | 2 | To Implement |
| TC-PEAK-026 | `tests/checks/peak-pause-hermetic.test.ts` | `bun test tests/checks/peak-pause-hermetic.test.ts` | Armed fetch, credential, and sleep canaries; source scan; lease wake bound | 5 | Existing - Update |
| TC-PEAK-027 | `tests/structure/event-taxonomy-integrity.test.ts`, `tests/checks/event-taxonomy-conformance.test.ts` | `bun test tests/structure/event-taxonomy-integrity.test.ts tests/checks/event-taxonomy-conformance.test.ts` | Closed-set declarations, payload bounds, pre-session `park-edge`-only shape | 5 | Existing - Update |
| TC-PEAK-028 | `tests/checks/privacy-release.test.ts`, `tests/structure/changeset-additivity.test.ts` | `bun test tests/checks/privacy-release.test.ts tests/structure/changeset-additivity.test.ts` | The change's changeset and the tree baseline pin | 1 | Existing - No Change (run early) |
| TC-PEAK-029 | Reference host and pull request | Manual, no command in CI | The next lane after the upgrade; the PR records the hand-off and preconditions | 7 | Manual Only |
| TC-PEAK-030 | `tests/behaviour/dispatch-peak-presession.test.ts` | `bun test tests/behaviour/dispatch-peak-presession.test.ts` | Stepping clock, spawn/call recorder, lease, event projection | 2 | To Implement |
| TC-PEAK-031 | `tests/behaviour/dispatch-peak-nomination.test.ts` | `bun test tests/behaviour/dispatch-peak-nomination.test.ts` | Durable lane record, pre-change record, park payloads | 2 | To Implement |
| TC-PEAK-032 | `tests/behaviour/dispatch-peak-stop-grace.test.ts` | `bun test tests/behaviour/dispatch-peak-stop-grace.test.ts` | Recording terminate seam with three bound arms and a small buffer | 2 | To Implement |
| TC-PEAK-033 | `tests/behaviour/dispatch-peak-mode.test.ts` | `bun test tests/behaviour/dispatch-peak-mode.test.ts` | Production composition factory, enabled/disabled arms, durable park records | 3 | To Implement |
| TC-PEAK-034 | `tests/behaviour/dispatch-stop-cause.test.ts` | `bun test tests/behaviour/dispatch-stop-cause.test.ts` | Disallowed causes and missing end, store snapshot and read counter | 4 | To Implement |
| TC-PEAK-035 | `tests/behaviour/dispatch-stop-handoff.test.ts` | `bun test tests/behaviour/dispatch-stop-handoff.test.ts` | Separate stop command and owning invocation over one store, deterministic clock | 4 | To Implement |
| TC-PEAK-036 | `tests/behaviour/dispatch-stop-race.test.ts` | `bun test tests/behaviour/dispatch-stop-race.test.ts` | Session-end race in both orders, store snapshot, record-kind counter | 4 | To Implement |

Notes on mapping:

- The existing peak-pause determinism suite (`tests/behaviour/peak-pause-determinism.test.ts`) pins the pure decisions. TC-PEAK-003 pins the dispatch command's full output with the mode carve-out, so it extends the pattern at the command boundary and does not duplicate the pure-suite assertions.
- The existing daemon park and resume suites are the parity control for TC-PEAK-001 and the regression context for TC-PEAK-005. They are not modified by this change.
- The existing `dispatch-additive-stability` suite is the pattern for TC-PEAK-013; its no-park goldens are deliberately untouched, and the one mode value is asserted as a named carve-out.
- The existing lease suites are the pattern for TC-PEAK-010; the change extends the claim path with renewal but adds no lease record kind.
- The event bounds constants already exist in the event fixtures; TC-PEAK-027 reuses them and asserts non-vacuity, never a growing count, plus the pre-session `park-edge`-only shape.
- TC-PEAK-033 uses the production composition factory and a proven-firing control, not the test-only `peakWatchComposed` override, so the mode assertion cannot pass vacuously.
- TC-PEAK-035 runs the separately invoked stop command and the owning invocation over one durable store; the record is the hand-off, so no control channel is mocked.
- TC-PEAK-029 is the only manual scenario and is a post-upgrade hand-off, not a merge gate. The automated fixtures above are the gate evidence.
- No new CI job is added. Every automated TC rides `bun test` through `pnpm check`, as the testing strategy requires.

## 8. Risks, Assumptions, and Open Questions

### 8.1 Risks

| ID | Risk | Mitigation |
|----|------|------------|
| RSK-TP-1 | The parity fixture passes on a simplified path while the dispatch composition quietly re-derives a window rule | TC-PEAK-001 compares both compositions on the same rules and instant and adds a structure guard that the dispatch path calls the delivered decision layer; the guard fails on a copied implementation. |
| RSK-TP-2 | A fixture accidentally uses wall-clock time or a real sleep, making the episode test slow or flaky | TC-PEAK-003 and TC-PEAK-026 use a counted clock, a recording delay seam, and armed canaries; TC-PEAK-026 also source-scans for `setTimeout` and real sleeps; TC-PEAK-010 crosses the lease TTL on the injected clock, never by waiting. |
| RSK-TP-3 | A test hardcodes a guessed member name for the additive status or result fact and fails on a legitimate rename | The plan requires asserting the declared behaviour through the command's own JSON contract; the exact member names are pinned by the delivery in this change and reviewed once, not guessed (OQ-TP-3). |
| RSK-TP-4 | The reference host does not observe the episode before the PR merges | TC-PEAK-029 is a post-upgrade hand-off, explicitly non-gating and not a Done criterion; the PR records the hand-off and its preconditions, and the episode is observed on the next lane after installation. The automated fixtures remain the merge gate. |
| RSK-TP-5 | The first full gate run fails TC-RELEASE-001 for a missing changeset, wasting a battery run | TC-PEAK-028 is run before the first gate; the changeset is created in the same delivery phase as the code. |
| RSK-TP-6 | A no-park golden is updated to accommodate an additive change, erasing the byte-identical guarantee | TC-PEAK-013 treats every no-park output as read-only except the one named `peakEnforcement.mode` value; any wider golden update requires an explicit review note. |
| RSK-TP-7 | The not-preserved recovery test double-counts an ordinal because the fixture seeds the budget and the count inconsistently | TC-PEAK-009 reads the delivered restart ledger after the recovery and asserts at most one appended ordinal per observation, with a separate exhaustion arm and a non-terminal refusal arm that appends none. |
| RSK-TP-8 | The manual scenario is treated as a substitute for the fixtures | The plan states explicitly that TC-PEAK-029 is a post-upgrade hand-off and the automated fixtures are the gate evidence; the manual row cannot turn a red suite green. |
| RSK-TP-9 | The lease fixture passes vacuously because the second dispatch is attempted outside the TTL | TC-PEAK-010 asserts the heartbeat age and the renewal records at every point before, at, and after each of several TTL boundaries, and names the 90 000 ms TTL. |
| RSK-TP-10 | The mode fixture passes through the test-only `peakWatchComposed` override and never exercises the production composition | TC-PEAK-033 uses the production composition factory with a proven-firing control, and TC-PEAK-013 asserts the mode value through that composition, not through the override. |
| RSK-TP-11 | The race fixture is nondeterministic and flaky | TC-PEAK-036 drives both orderings from the same injected clock and asserts the single outcome from the record set, never from timing. |
| RSK-TP-12 | The pre-session fixture spawns a session before evaluating the watch | TC-PEAK-030 records spawn and resume counts before the park and asserts zero, and TC-PEAK-026 keeps the fixture hermetic. |

### 8.2 Assumptions

- The delivered harness (`createCommandScenario`) already supports an injected clock, delay, and transport; this change extends it for the episode, pre-session, and lease fixtures rather than replacing it.
- The temporary git repository and store harness can snapshot branch tip, change-folder content, phases, queue state, lease heartbeat age, renewal records, and worktree path without live resources.
- The event projection harness can produce the four episode kinds from a seeded park record over the in-memory transport pair, and the pre-session park's `park-edge`-only shape from the minimal frame.
- The telemetry fixture can seed and then omit attributable steps for the same ref and interval, so TC-PEAK-023 can assert the present-zero and classified-absence arms in one run.
- The additive member names for `dispatch status` and the result envelope are delivery-level details fixed in this change (spec section 14); the tests assert the declared behaviour through the command contract.
- The operator stop grammar requires `--cause peak-window` and `--until <iso>` as spec Flow 3 and AC-F9-1 state; the test pins the delivered grammar and does not invent an extra flag.
- The production composition factory can be exercised in both enabled and disabled arms, and its control cannot pass through a test-only watch override.
- The delivered lease renewal path is available to the one-shot invocation and updates the existing lease record without a new record kind.
- The reference host's tracked `.jaiship/config.yaml` declares profile `delivery` with `peakWindows` at 01:00-04:00 and 06:00-10:00 UTC (spec section 12), so the next lane after the upgrade is pausable.
- The reference host's activity-keyed liveness consumers are relaxed or exclude a parked lane before the next lane is dispatched (DEC-19).
- Delivery and every fixture stay inside the checkout and the change folder (owner delivery note 4).

### 8.3 Open Questions

| ID | Question | Blocking? | Owner | Resolution |
|----|----------|-----------|-------|------------|
| OQ-TP-2 | The exact evidence format of the PR hand-off in TC-PEAK-029 (which section and which command transcript) is delivery-level. | No | Reference host and PR author | The PR names the tracked profile fact, the liveness relaxation, and the command sequence; the eventual episode record follows when the next lane runs. |
| OQ-TP-3 | The additive `dispatch status` park fact and result episode fact member names are fixed by the delivery in this change (spec section 14). | No | Delivery | Pin the names in the same change and assert the declared behaviour; no test hardcodes a guessed name. |

No acceptance criterion is left uncovered. All 33 are covered by an automated scenario; TC-PEAK-029 is the only manual scenario and it is a post-upgrade hand-off, not a coverage gap.

## 9. Plan Revision Log

| Version | Date | Author | Changes |
|---------|------|--------|---------|
| 1.0 | 2026-11-26 | @test-plan-writer | Initial test plan from `chg-GH-413-spec.md`: 23 acceptance criteria covered by 28 automated scenarios (including the derived invalid-value configuration scenario and the release assertion) plus 1 owner manual episode; capability, data-model, event, and NFR traceability; hermetic fixture design; owner delivery notes recorded. |
| 1.1 | 2026-11-26 | @test-plan-writer | DoR iteration-1 remediation: reworded TC-PEAK-029 to the post-upgrade reference-host hand-off and removed the chance-based fallback (finding 9); added TC-PEAK-030 (pre-session park), TC-PEAK-031 (lane-record nomination), TC-PEAK-032 (composed-grace terminate call), TC-PEAK-033 (production composition mode), TC-PEAK-034 (stop cause/end refusal), TC-PEAK-035 (stop success and owning-invocation hand-off), TC-PEAK-036 (stop/session-end race); extended TC-PEAK-003 (mode carve-out), TC-PEAK-006 (small-buffer and grace-above-cadence arms), TC-PEAK-007 (derived stop/park lags), TC-PEAK-009 (per-observation ordinal and non-terminal refusal), TC-PEAK-010 (lease across several TTLs), TC-PEAK-011 (three probe arms and recovery refusal), TC-PEAK-012 (lease holder), TC-PEAK-013 (one intended mode carve-out), TC-PEAK-014 (refusal in the episode fact), TC-PEAK-015 (pre-session disabled), TC-PEAK-016/018/019 (cause/until, profile from record, composed grace), TC-PEAK-020 (three running-predicate arms), TC-PEAK-022 (per-lane lease), TC-PEAK-023 and TC-PEAK-027 (pre-session claim and shape); updated coverage to 33 ACs, NFR-1 to 11, DM-1 to 9; added the fourth owner delivery note and plan-phase ownership. |

## 10. Test Execution Log

Results are appended during delivery. The manual row is a post-upgrade hand-off: the pull request records the hand-off and preconditions, and the reference host observes the episode on the next lane after installation.

| TC ID | Run Date | Result | Notes |
|-------|----------|--------|-------|
| TC-PEAK-029 | Pending | Pending (non-gating hand-off) | Post-upgrade observation by the reference host on the next lane; the PR records the hand-off, the tracked profile fact, the liveness relaxation, and the command sequence. The episode itself is recorded when that lane runs. |
