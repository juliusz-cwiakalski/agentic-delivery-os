---
id: chg-GH-413-test-plan
status: Proposed
created: 2026-11-26T10:13:20Z
last_updated: 2026-11-26T10:13:20Z
owners: ["engineering"]
service: delivery-os
labels: [change, m4, peak-pausing, dispatch, lane-lifecycle, config]
version_impact: minor
summary: "Test design for GH-413 peak pausing for a lane started by dispatch: the life-long dispatch-owned window watch, the nominated profile's declared peakWindows rules, the bounded-grace stop and exactly-once park, the in-invocation wait and classification-routed resume, the additive status and result facts, the disabling key, the operator stop command, owner-hold precedence and per-profile isolation, and the zero-spend evidence. All fixtures are hermetic over an injected clock, delay, and transport; every one of the 23 acceptance criteria is traceable to a named test case."
links:
  change_spec: ./chg-GH-413-spec.md
  implementation_plan: ./chg-GH-413-plan.yaml
  testing_strategy: .ai/rules/testing-strategy.md
---

# Test Plan - M4-S42: Peak pausing for a lane started by dispatch: it stops at the window's start and resumes at the window's end

## 1. Scope and Objectives

This plan protects the core behaviour of GH-413: a lane started by the one-shot `dispatch` invocation is watched for its whole life by that invocation, parks at the buffer-inclusive start of its nominated profile's declared peak window with a bounded grace, waits until the effective window end, resumes the same session on the same branch and in the same worktree, and returns one result whose summary states that the lane was paused and resumed. It also protects the operator command `dispatch stop <ref>` as the same bounded-grace stop, the classified not-running refusal, the disabling key, owner-hold precedence, per-profile isolation, and the falsifiable zero-spend claim.

The highest-integrity risks are: (1) two compositions drifting into different answers for the same lane and instant (RSK-8, AC-F1-1); (2) a duplicate or missing episode frame across many observations (NFR-2); (3) a lost branch, change folder, phase, or queue state and a second session for the work item (NFR-4, AC-F5-1); (4) a second kill path or an over-long grace (NFR-1, AC-F9-2); (5) a zero-spend claim that cannot fail (AC-F12-2); and (6) a disabled setting that silently reintroduces peak spend (RSK-5, AC-F8-1). Everything runs hermetically over the injected clock, delay, and transport. No live network, real sleep, or credential read participates in the automated gate (NFR-5, NFR-7).

### 1.1 In Scope

- Every acceptance criterion in the change specification section 17: AC-F1-1 through AC-F12-2, each mapped to at least one named test case in section 3.1.
- Every functional capability F-1 through F-12, every data-model element DM-1 through DM-7, and every non-functional requirement NFR-1 through NFR-9, mapped in sections 3.2 and 3.3.
- The deliberately distinct episode frame written by the dispatch-owned watch and by `dispatch stop` (a complete watcher-shaped frame), and the untouched operator-shaped minimal frame of the release grammar (DEC-7).
- The intentional supersession of the daemon-absent degradation statement (DEC-1) and the two-value composition fact (DEC-6), asserted at the observable read rather than as documentation text.
- The owner delivery notes: the change's changeset exists before the first gate run (TC-PEAK-028), affected tests run during implementation and the full battery once at the gate (section 7), and one real episode is recorded on the pull request (TC-PEAK-029).
- Hermeticity, determinism, vocabulary economy, and additive-read bounds as first-class checks, not incidental properties.

### 1.2 Out of Scope & Known Gaps

- Any change to the resident daemon's supervision cycle, watch cadence, park, or resume behaviour (NG-1). The daemon suites are only read for parity and regression, never re-specified here.
- Parallel lanes or multi-lane concurrency (NG-2), weekday or calendar-aware windows (NG-3), resident or always-on dispatch (NG-4), and shell-orchestrator work (NG-5).
- Any new park cause, event kind, record kind, schema identity, error identity, result token, or second kill path (NG-6). The plan asserts the closed sets unchanged instead.
- A read surface for a declared or open window as an object, and any provider quota or provider API query (NG-7).
- Any change to admission gating, the nomination rule, or the four no-nomination refusal identities (NG-8).
- Manual resume of an operator-stopped lane before its declared end, and automatic recovery after the dispatch process is killed during the wait (spec section 7.2).
- Live-tracker or live-PR behaviour. The manual scenario uses the reference host for a real episode only; all automated truth reads are injected.
- Timing assertions on wall-clock durations. Observation lag is asserted in cadences through the injected clock, and the wait's own wake count is bounded over the injected clock, never by sleeping.

## 2. References

- Change specification: `./chg-GH-413-spec.md`. Source of truth for sections 5 (capabilities), 8 (interfaces and data model), 9 (NFRs), 15 (decisions), and 17 (acceptance criteria).
- Testing strategy: `.ai/rules/testing-strategy.md`. Layer and module mapping, bun:test conventions, hermeticity, invariant-test authoring, and the aggregate gate.
- Implementation plan: `./chg-GH-413-plan.yaml`, authored in phase 4 immediately after this plan. The phase-to-scenario mapping is finalized there.
- Repository rules: `AGENTS.md` and `.ai/rules/typescript.md` for the TypeScript workspace, fixture, and bun:test conventions.
- Existing suites this plan extends rather than duplicates:
  - Peak-pause decisions and daemon watch: `tests/behaviour/peak-pause-determinism.test.ts`, `tests/behaviour/daemon-peak-window-park.test.ts`, `tests/behaviour/daemon-peak-window-resume.test.ts`, `tests/behaviour/daemon-peak-window-isolation.test.ts`, `tests/behaviour/peak-pause-composed-edge.test.ts`, `tests/behaviour/daemon-absent-degradation.test.ts`, `tests/behaviour/pause-episode-events.test.ts`, `tests/checks/peak-pause-hermetic.test.ts`.
  - Dispatch engine and harness: `tests/behaviour/dispatch-watch.test.ts`, `tests/behaviour/dispatch-determinism.test.ts`, `tests/behaviour/dispatch-single-flight.test.ts`, `tests/behaviour/dispatch-resume.test.ts`, `tests/behaviour/dispatch-resume-economics.test.ts`, `tests/behaviour/dispatch-restart-budget.test.ts`, `tests/behaviour/dispatch-token-closure.test.ts`, `tests/behaviour/dispatch-envelope.test.ts`, `tests/behaviour/dispatch-daemonless.test.ts`.
  - Configuration: `tests/behaviour/config-lane.test.ts`, `tests/behaviour/config-schema.test.ts`.
  - Surfaces: `tests/behaviour/status-brief-park-fields.test.ts`, `tests/behaviour/status-parked-conditions.test.ts`, `tests/behaviour/lanes-parked-stall.test.ts`, `tests/behaviour/board-parked.test.ts`, `tests/behaviour/spend-zero-window.test.ts`.
  - Owner hold: `tests/behaviour/queue-hold-park-resume.test.ts`, `tests/behaviour/owner-hold-fact.test.ts`.
  - Vocabulary and release: `tests/structure/event-taxonomy-integrity.test.ts`, `tests/checks/event-taxonomy-conformance.test.ts`, `tests/checks/privacy-release.test.ts` (TC-RELEASE-001), `tests/structure/changeset-additivity.test.ts`.
- Delivered decision and contract modules the fixtures compose: `packages/core/src/domain/daemon-peak-pause.ts` (`decidePeakStops`, `decidePeakResumes`, `runPeakWatch`, `runPeakResume`), `packages/core/src/domain/queue-park.ts`, `packages/core/src/domain/spend.ts`, `packages/core/src/app/dispatch.ts`, `packages/core/src/app/dispatch-lane-view.ts`, `packages/core/src/config/catalog.ts`, `packages/core/src/contracts/taxonomy.ts`.
- Fixture seams: `tests/fixtures/dispatch/golden/harness.ts` (`createCommandScenario` with `nowIso`, `delay`, `harnessPort`, `livenessIntervalMs`, `livenessOf`, `restartBudget`, `initialRestarts`), `tests/fixtures/state/harness.ts` (temporary store), `tests/fixtures/events/event-harness.ts` (in-memory transport pair), `tests/fixtures/telemetry` (seeded telemetry steps), `tests/fixtures/board`, `tests/fixtures/supervise`.

## 3. Coverage Overview

### 3.1 Functional Coverage (F-#, AC-#)

| AC ID | Description (short) | TC ID(s) | Status |
|-------|---------------------|----------|--------|
| AC-F1-1 | Dispatch-owned watch and the daemon's watch take the same stop or no-stop decision for the same profile and instant, through the same rules and clock, with neither deriving its own rule | TC-PEAK-001 | Covered |
| AC-F1-2 | A window opening mid-iteration and a window opening between iterations both park, and the watch remains active until the lane's terminal classification | TC-PEAK-002 | Covered |
| AC-F1-3 | Paired identical runs produce byte-identical decisions, park records, events, and summary, with no real sleep, network call, or credential read | TC-PEAK-003 | Covered |
| AC-F2-1 | A chain whose base profile declares no `peakWindows` does not exempt a lane nominated to a later profile whose windows are open: it parks with `until` at that profile's effective end | TC-PEAK-004 | Covered |
| AC-F2-2 | A lane whose nominated profile declares no `peakWindows` is never stopped for peak reasons, while provider-entry `peak` windows still gate admission exactly as delivered | TC-PEAK-005 | Covered |
| AC-F3-1 | One bounded-grace stop request, a park with the recorded stop instant and `until` at the effective end, and exactly one `stop` and one `parked` sharing one episode id | TC-PEAK-006 | Covered |
| AC-F3-2 | The park lands within one observation cadence of the window-open observation and the measured lag is recorded with the episode | TC-PEAK-007 | Covered |
| AC-F4-1 | A preserved episode resumes the preserved session on the same branch and worktree, records exactly one `resumed` with the no-re-dispatch fact, consumes no restart ordinal, and starts no second session | TC-PEAK-008 | Covered |
| AC-F4-2 | A not-preserved episode attempts no session resume, routes to the delivered interrupted-lane recovery consuming exactly one ordinal, emits no `resumed`, and escalates on budget exhaustion | TC-PEAK-009 | Covered |
| AC-F5-1 | Branch, change folder, recorded phases, and queue state are unchanged; the recorded worktree is reused; a second dispatch is refused `queue.single-flight` for the whole parked interval | TC-PEAK-010 | Covered |
| AC-F6-1 | `dispatch status <ref>` reports the park cause and the window's end from the park record, does not classify the lane stale, and reports the observed probe verdict | TC-PEAK-011 | Covered |
| AC-F6-2 | `lanes` renders `parked:peak-window` with the recorded `until` and `board` lists the row in `PARKED` from the same durable park record, with no second vocabulary | TC-PEAK-012 | Covered |
| AC-F6-3 | With no open park, `dispatch status`, `lanes`, `board`, `brief`, and a dispatch result are byte-identical to the pre-change output and the added members are absent | TC-PEAK-013 | Covered |
| AC-F7-1 | One invocation spanning an episode returns exactly one result with the same token and exit, a summary stating paused and resumed, and the bounded episode fact in the machine envelope | TC-PEAK-014 | Covered |
| AC-F8-1 | The key unset or `false` keeps pausing on and parks; the key `true` supplies no watch, stop, park, resume, or episode event, equals admission gating, and reports `iteration-start-gating` | TC-PEAK-015 | Covered |
| AC-F8-2 | With the disabling key `true`, `dispatch stop <ref>` on a running lane produces the same stop, park, and events as the enabled case | TC-PEAK-016 | Covered |
| AC-F9-1 | `dispatch stop <ref>` sends the same bounded-grace stop a window-open stop sends, parks with the declared cause and end, and records one `stop` and one `parked` with the same payloads | TC-PEAK-018 | Covered |
| AC-F9-2 | `dispatch stop` sends no signal of its own; exactly one stop request reaches the delivered terminate path with TERM before KILL, KILL only over a still-listed target, unknown session as success, and no second kill mechanism | TC-PEAK-019 | Covered |
| AC-F10-1 | A stop request for a non-running newest lane refuses with the delivered classified identity, names the work item and observed lane state, and writes no park, event, attempt, lane, or queue record | TC-PEAK-020 | Covered |
| AC-F11-1 | An active owner hold does not change the watch: the lane still parks `peak-window` with `until`, the hold writes no park record, and the resume refuses the owner-hold precondition then proceeds with the park record byte-unchanged | TC-PEAK-021 | Covered |
| AC-F11-2 | Two dispatch lanes on different profiles: only the lane with an open window parks and resumes; the other keeps running, keeps its lease, and keeps its supervision unchanged | TC-PEAK-022 | Covered |
| AC-F12-1 | The window-scoped reading from park instant through park end over present telemetry counts zero attributable billable calls, discloses the telemetry state, and names its basis | TC-PEAK-023 | Covered |
| AC-F12-2 | A seeded billable call attributed to the lane inside the interval makes the reading greater than zero, so the zero claim is falsifiable | TC-PEAK-024 | Covered |

Capability traceability: F-1 -> TC-PEAK-001/002/003; F-2 -> TC-PEAK-004/005/022; F-3 -> TC-PEAK-004/006/007; F-4 -> TC-PEAK-008/009/025; F-5 -> TC-PEAK-008/010; F-6 -> TC-PEAK-011/012/013; F-7 -> TC-PEAK-014; F-8 -> TC-PEAK-015/016/017; F-9 -> TC-PEAK-016/018/019; F-10 -> TC-PEAK-016/020; F-11 -> TC-PEAK-005/021/022; F-12 -> TC-PEAK-023/024.

Derived scenarios (not acceptance criteria): the invalid-value configuration refusal is TC-PEAK-017, from spec section 5.1 F-8, section 8.3 DM-6, and Appendix B; the resume-admission window re-check is TC-PEAK-025, from spec section 5.1 F-4 and RSK-6. The owner delivery note on the changeset is TC-PEAK-028. The owner behavioural verification on the reference host is TC-PEAK-029.

### 3.2 Interface Coverage (API-#, EVT-#, DM-#)

No HTTP or provider API is added or changed (spec sections 8.1 and 8.4). The coverage below is the data model and the taxonomy kinds this change produces.

| Interface element | TC ID(s) | Notes |
|-------------------|----------|-------|
| DM-1 Durable park record, episode frame | TC-PEAK-006, TC-PEAK-009, TC-PEAK-018, TC-PEAK-021 | Reused unchanged in shape; dispatch-owned stops write the complete frame; append-only, read-time expiry, no in-place mutation. The operator release writer keeps its minimal frame. |
| DM-2 Durable lane record | TC-PEAK-008, TC-PEAK-010, TC-PEAK-011 | Unchanged `active` and `terminal` states; the open park is joined at read time, never turned into a lane state. |
| DM-3 `dispatch status` payload | TC-PEAK-011, TC-PEAK-013 | Additive optional park fact; absent when no park stands; all delivered members and lines unchanged. The exact member name is pinned at delivery, and the test asserts the declared behaviour through the command's own JSON contract. |
| DM-4 Dispatch result payload | TC-PEAK-014 | Additive optional bounded episode fact; no new token and no change to derivation. |
| DM-5 Dispatch result summary | TC-PEAK-014 | Gains the pause and resume statement for a spanning invocation; the delivered key set and verbose detail line keep their shape. |
| DM-6 Configuration key for disabling pausing | TC-PEAK-015, TC-PEAK-016, TC-PEAK-017 | One boolean in the delivered typed lane policy branch, unset by default, meaning pausing is on. |
| DM-7 Composition-fact read | TC-PEAK-005, TC-PEAK-015 | Two members and two mode values kept; a watch supplied by either composition reports `window-watch`; no watch, including the disabled setting, reports `iteration-start-gating`; `parkClaimed` stays derived from durable park records. |
| Event `dispatch.attempt/stop` | TC-PEAK-006, TC-PEAK-018, TC-PEAK-019, TC-PEAK-027 | Exactly one per episode, only over a complete episode frame; declared payload unchanged. |
| Event `dispatch.attempt/parked` | TC-PEAK-006, TC-PEAK-009, TC-PEAK-018, TC-PEAK-027 | Exactly one per episode, carrying the closed preservation classification. |
| Event `dispatch.attempt/resumed` | TC-PEAK-008, TC-PEAK-009, TC-PEAK-027 | Exactly one per preserved episode with the no-re-dispatch fact; never emitted by a restart recovery. |
| Event `queue.graph/park-edge` | TC-PEAK-012, TC-PEAK-018, TC-PEAK-027 | Exactly one per episode from the delivered park projection. |

### 3.3 Non-Functional Coverage (NFR-#)

| NFR | Requirement (short) | TC ID(s) | Coverage mode |
|-----|---------------------|----------|---------------|
| NFR-1 | Bounded-grace stop: deadline at or below `graceSecondsMax`, one terminate request per stop, zero added signal paths | TC-PEAK-006, TC-PEAK-018, TC-PEAK-019 | Behaviour fixture plus structure guard |
| NFR-2 | Exactly-once episode across any number of observations: one `stop`, one `parked`, one `park-edge`, one `resumed` only when preserved, one episode id | TC-PEAK-006, TC-PEAK-018 | Behaviour fixture over repeated observations |
| NFR-3 | Zero billable calls attributable to the parked lane between park and end, both boundaries inclusive, over present telemetry; absence classified, never zero; a seeded in-window call reads greater than zero | TC-PEAK-023, TC-PEAK-024 | Behaviour fixture, both directions in one run |
| NFR-4 | Preserved episode consumes zero ordinals and starts no fresh spawn; not-preserved consumes exactly one under the delivered budget and escalates at exhaustion; zero second sessions | TC-PEAK-008, TC-PEAK-009, TC-PEAK-010 | Behaviour fixture over the delivered restart/economics seams |
| NFR-5 | Determinism and hermeticity: identical configuration, rules, clock, and transport produce byte-identical output; zero live network, real sleeps, or credential reads | TC-PEAK-001, TC-PEAK-003, TC-PEAK-026 | Paired-run fixture plus armed canaries and source scan |
| NFR-6 | Observation latency: park within one cadence of the open observation; resume within one cadence of the recorded end; measured lag recorded as episode evidence | TC-PEAK-007, TC-PEAK-008 | Fixture over the injected clock and delivered liveness cadence |
| NFR-7 | Wait cost and boundedness: no billable call, session operation, or provider request during the wait; at most one clock observation per wake; no busy loop; end re-derived each wake | TC-PEAK-003, TC-PEAK-025, TC-PEAK-026 | Fixture with a counted wake and delay spy; no timer |
| NFR-8 | Vocabulary economy and evidence bounds: zero added kinds, record kinds, schema identities, result tokens, or error rows; refusal reuses a delivered identity; at most 20 fields and 1024 bytes per frame | TC-PEAK-017, TC-PEAK-020, TC-PEAK-027 | Structure and check suites over the closed sets and payload bounds |
| NFR-9 | Additive interface and bounded reads: zero changed delivered field with no park; zero new stores; at most one additional bounded park-record read on `dispatch status`; no unbounded reads | TC-PEAK-011, TC-PEAK-012, TC-PEAK-013, TC-PEAK-015 | Golden/regression fixture plus a read-count spy |

## 4. Test Types and Layers

Per `.ai/rules/testing-strategy.md`, all automated suites are `bun:test` files under `tests/**`, run with `bun test` and folded into `pnpm check`.

- **Unit and pure decision tests** - direct calls to the delivered decision layer (`decidePeakStops`, `decidePeakResumes`, `runPeakWatch`, `runPeakResume`) and to the configuration resolver. Used to pin parity of the decision inputs and the setting's default and refusal. Target: `tests/behaviour/*peak*.test.ts` and `tests/behaviour/config-lane.test.ts`.
- **Behaviour and integration tests** - the command-level dispatch harness `createCommandScenario`, the temporary state store, the scripted session port, the in-memory event transport, and the seeded telemetry ledger. Used for the episode lifecycle, stop command, resume routing, surfaces, isolation, and spend. Target: new `tests/behaviour/dispatch-peak-*.test.ts` and `tests/behaviour/dispatch-stop*.test.ts`, extending the existing dispatch and daemon park suites by pattern, never by copy.
- **Structure tests** - `tests/structure/**`: closed-set and contract assertions (taxonomy unchanged, additive record and result shapes, composition fact, changeset tree invariant). Target: `tests/structure/event-taxonomy-*.test.ts`, `tests/structure/dispatch-contract.test.ts`, `tests/structure/changeset-additivity.test.ts`, with a new narrow `tests/structure/dispatch-peak-contract.test.ts` only if the additive contract needs one.
- **Check and invariant tests** - `tests/checks/**`: hermeticity canaries and source scans, event payload bounds, release shape, and the mutation controls that prove a guard can fail. Target: `tests/checks/peak-pause-hermetic.test.ts` (extended), `tests/checks/event-taxonomy-conformance.test.ts`, `tests/checks/privacy-release.test.ts`.
- **Manual/operational evidence** - TC-PEAK-029 on the reference host, recorded on the pull request and in section 10 by the delivering lane. No automated suite depends on it.
- **Aggregate gate** - `pnpm check` (lint, format check, typecheck, test, boundaries) is the final verification. The full battery runs once at the gate; during implementation only the affected suites run (section 7).

Test type vocabulary used in section 5 follows the template: Unit, Integration, Contract, E2E, Manual, Performance, plus the repository's Structure and Check layers as the location qualifier.

## 5. Test Scenarios

### 5.1 Scenario Index

| TC ID | Title | Type | Level | Priority | AC Coverage |
|-------|-------|------|-------|----------|-------------|
| TC-PEAK-001 | Dispatch-owned watch and daemon watch agree on the same profile and instant | Contract | Behaviour + Structure | Critical | AC-F1-1 |
| TC-PEAK-002 | Mid-iteration and between-iteration windows both park; the watch lives to terminal | Happy Path | Behaviour | Critical | AC-F1-2 |
| TC-PEAK-003 | Paired identical runs produce byte-identical episode evidence | Regression | Behaviour | High | AC-F1-3 |
| TC-PEAK-004 | Chain-first-no-window does not exempt a lane nominated to a later profile with an open window | Edge Case | Behaviour | Critical | AC-F2-1 |
| TC-PEAK-005 | A profile with no `peakWindows` is never stopped; admission gating is unchanged | Negative | Behaviour | Critical | AC-F2-2 |
| TC-PEAK-006 | One bounded-grace stop and exactly-once park at the window's start | Happy Path | Behaviour | Critical | AC-F3-1 |
| TC-PEAK-007 | Park lands within one observation cadence and the lag is recorded | Happy Path | Behaviour | High | AC-F3-2 |
| TC-PEAK-008 | Preserved resume: same session, branch, and worktree; one `resumed`; zero ordinals | Happy Path | Behaviour | Critical | AC-F4-1 |
| TC-PEAK-009 | Not-preserved recovery: park lands, one ordinal, no `resumed`, exhaustion escalates | Corner Case | Behaviour | Critical | AC-F4-2 |
| TC-PEAK-010 | Nothing lost and single-flight held for the whole parked interval | Happy Path | Behaviour | Critical | AC-F5-1 |
| TC-PEAK-011 | `dispatch status` reports the park fact and does not classify the lane stale | Happy Path | Behaviour | Critical | AC-F6-1 |
| TC-PEAK-012 | `lanes` and `board` show the dispatch-owned park from the same record | Happy Path | Behaviour | High | AC-F6-2 |
| TC-PEAK-013 | No-park output is byte-identical to the pre-change surfaces | Regression | Behaviour + Golden | Critical | AC-F6-3 |
| TC-PEAK-014 | One invocation returns one result whose summary states paused and resumed | Happy Path | Behaviour | Critical | AC-F7-1 |
| TC-PEAK-015 | The disabling key unset, `false`, and `true` behave exactly as declared | Edge Case | Behaviour + Contract | Critical | AC-F8-1 |
| TC-PEAK-016 | `dispatch stop` works identically when automatic pausing is disabled | Edge Case | Behaviour | High | AC-F8-2 |
| TC-PEAK-017 | An invalid disabling value is refused by name with no partial effect | Negative | Behaviour + Contract | High | F-8 derived |
| TC-PEAK-018 | `dispatch stop` equals a window-open stop, payload for payload | Happy Path | Behaviour | Critical | AC-F9-1 |
| TC-PEAK-019 | `dispatch stop` never kills; one terminate request; TERM before KILL | Negative | Behaviour + Structure | Critical | AC-F9-2 |
| TC-PEAK-020 | A stop for a non-running lane is a classified refusal that writes nothing | Negative | Behaviour | Critical | AC-F10-1 |
| TC-PEAK-021 | An active owner hold does not change the watch or the park | Corner Case | Behaviour | High | AC-F11-1 |
| TC-PEAK-022 | Per-profile isolation: only the lane in an open window parks and resumes | Happy Path | Behaviour | High | AC-F11-2 |
| TC-PEAK-023 | Zero-spend reading is positive zero with present telemetry and a classified absence otherwise | Happy Path | Behaviour | Critical | AC-F12-1 |
| TC-PEAK-024 | A seeded mid-window call makes the zero-spend claim fail | Negative | Behaviour | Critical | AC-F12-2 |
| TC-PEAK-025 | Resume admission re-checks the window and never resumes into an open window | Corner Case | Behaviour | High | F-4 derived |
| TC-PEAK-026 | The delivering suites are hermetic: zero live resources, zero real sleeps | Check | Checks | Critical | NFR-5, NFR-7 |
| TC-PEAK-027 | Vocabulary economy and event evidence bounds hold | Check | Structure + Checks | High | NFR-8 |
| TC-PEAK-028 | The change's changeset exists before the first gate run | Check | Checks + Structure | High | Owner note, TC-RELEASE-001 |
| TC-PEAK-029 | One real peak-pause episode is observed on the reference host and recorded on the PR | Manual | Manual | Critical | Owner behavioural verification |

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

#### TC-PEAK-003 - Paired identical runs produce byte-identical episode evidence

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
3. Compare the serialized outputs byte for byte.
4. Confirm the injected delay recorded calls and no real timer, `Bun.sleep`, or network accessor was used.

**Expected Outcome**:

- Byte-identical decisions, records, events, and summary across the paired runs.
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

#### TC-PEAK-006 - One bounded-grace stop and exactly-once park at the window's start

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
- A profile whose declared default grace is below the derived maximum.

**Steps**:

1. Advance the clock to the buffer-inclusive open instant and run the watch.
2. Read the park record and project the episode events.
3. Repeat the watch over several later observations.
4. Read the stop request count and the applied grace.

**Expected Outcome**:

- Exactly one bounded-grace stop request reaches the delivered stop seam.
- One park record with cause `peak-window`, the profile, `until` at the effective end, the recorded stop instant, the grace deadline, one episode id, and the closed preservation classification.
- Exactly one `stop` and one `parked` event share the episode id; the `park-edge` projection appears once; further observations add no frame and mutate no record.
- The grace deadline never exceeds the profile's derived maximum; no second signal path is used.

#### TC-PEAK-007 - Park lands within one observation cadence and the lag is recorded

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

**Steps**:

1. Advance the clock to the open instant, then to the first observation instant.
2. Run the watch and record the park instant and the open instant.
3. Repeat with an observation exactly one cadence after the open instant.
4. Read the recorded lag evidence.

**Expected Outcome**:

- The park lands at the first observation at or after the open instant, never later than one cadence.
- The measured lag from window-open observation to park is recorded with the episode and is at most one cadence.
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
- The resume decision lands within one cadence of the recorded end and the lag is recorded.

#### TC-PEAK-009 - Not-preserved recovery: park lands, one ordinal, no `resumed`, exhaustion escalates

**Scenario Type**: Corner Case
**Impact Level**: Critical
**Priority**: High
**Related IDs**: F-4, AC-F4-2, NFR-4, DM-1, event `parked`
**Test Type(s)**: Integration
**Automation Level**: Automated
**Target Layer / Location**: `tests/behaviour/dispatch-peak-recovery.test.ts` (new), reusing `tests/behaviour/dispatch-resume-economics.test.ts` and `tests/behaviour/dispatch-restart-budget.test.ts` patterns
**Tags**: @backend, @recovery

**Preconditions**:

- A peak-window episode whose state preservation fails.
- The delivered restart budget recorded on the lane and the delivered typed-question seam available.
- An injected clock, a scripted session port, and a recording restart append.

**Steps**:

1. Run the window-open stop with a preservation failure.
2. Read the park record and the applied grace.
3. Advance the clock to the recorded end and run the resume decision.
4. Repeat with the restart count already at the delivered budget.

**Expected Outcome**:

- The park lands anyway with `session-state-not-preserved`; the preservation failure neither refuses the park nor extends the grace.
- At the end, no session resume is attempted and no `resumed` event is emitted; the delivered interrupted-lane recovery runs on the same branch and consumes exactly one restart ordinal.
- At budget exhaustion, the delivered terminal exhaustion record is appended and the delivered typed question is raised.

#### TC-PEAK-010 - Nothing lost and single-flight held for the whole parked interval

**Scenario Type**: Happy Path
**Impact Level**: Critical
**Priority**: High
**Related IDs**: F-5, AC-F5-1, NFR-4
**Test Type(s)**: Integration
**Automation Level**: Automated
**Target Layer / Location**: `tests/behaviour/dispatch-peak-preservation.test.ts` (new), using the temporary git repository and store harness, plus `tests/behaviour/dispatch-single-flight.test.ts` pattern
**Tags**: @backend, @single-flight

**Preconditions**:

- A lane with a branch, a change folder with recorded phases, a queue entry, a lease, and a recorded worktree.
- A snapshot function for branch tip, change-folder file set and content, phase list, queue state, and worktree path.

**Steps**:

1. Take the snapshot before the park.
2. Park the lane and, at several points inside the parked interval, attempt a second dispatch of the same work item.
3. Advance to the recorded end, resume, and wait for the terminal classification.
4. Take the snapshot after the resume and compare every element.

**Expected Outcome**:

- A second dispatch is refused `queue.single-flight` with the live holder for the whole parked interval, at every attempted point.
- Branch, change folder, recorded phases, and queue state are unchanged; the recorded worktree is reused and not re-provisioned.
- No second session and no second episode exist for the work item.

#### TC-PEAK-011 - `dispatch status` reports the park fact and does not classify the lane stale

**Scenario Type**: Happy Path
**Impact Level**: Critical
**Priority**: High
**Related IDs**: F-6, AC-F6-1, DM-2, DM-3, NFR-9
**Test Type(s)**: Integration
**Automation Level**: Automated
**Target Layer / Location**: `tests/behaviour/dispatch-status-park.test.ts` (new), extending the `dispatch-lane-view` and `status-brief-park-fields` patterns
**Tags**: @backend, @status

**Preconditions**:

- A dispatch lane with an open peak-window park record and an injected probe verdict.
- A store read counter that records bounded park-record reads.
- The exact additive member name fixed by the delivery in this change.

**Steps**:

1. Invoke `dispatch status <ref> --json`.
2. Read the park fact, the staleness classification, the probe verdict, and `delivering`.
3. Repeat after the park record expires.

**Expected Outcome**:

- The park fact carries the cause, the window's end, the recorded stop instant, and the preservation classification from the record; it is absent when no park stands.
- While the park stands, the lane is not classified stale; the probe verdict is the observed one; the stopped session still answers `delivering: false`.
- The command performs at most one additional bounded park-record read and opens no new store.

#### TC-PEAK-012 - `lanes` and `board` show the dispatch-owned park from the same record

**Scenario Type**: Happy Path
**Impact Level**: Important
**Priority**: High
**Related IDs**: F-6, AC-F6-2, NFR-9, event `park-edge`
**Test Type(s)**: Integration
**Automation Level**: Automated
**Target Layer / Location**: `tests/behaviour/dispatch-peak-surfaces.test.ts` (new), extending `tests/behaviour/lanes-parked-stall.test.ts` and `tests/behaviour/board-parked.test.ts`
**Tags**: @backend, @lanes, @board

**Preconditions**:

- One dispatch-owned park record with cause `peak-window`, a recorded `until`, and a preserved classification.
- A read spy around the durable park record source.

**Steps**:

1. Invoke `lanes` in its machine form and read the lane row.
2. Invoke `board` and read the `PARKED` section.
3. Compare both to the park record.

**Expected Outcome**:

- `lanes` renders `parked:peak-window` with the recorded `until` and the composition-fact mode `window-watch`.
- `board` lists the same row in `PARKED` with the same cause and end.
- Both read the same durable park record; no second vocabulary, no additional store read that invents the row.

#### TC-PEAK-013 - No-park output is byte-identical to the pre-change surfaces

**Scenario Type**: Regression
**Impact Level**: Critical
**Priority**: High
**Related IDs**: F-6, AC-F6-3, NFR-9
**Test Type(s)**: Regression, Contract
**Automation Level**: Automated
**Target Layer / Location**: `tests/behaviour/dispatch-peak-byte-identical.test.ts` (new), with golden fixtures under `tests/golden`, extending `tests/behaviour/dispatch-additive-stability.test.ts`
**Tags**: @backend, @regression

**Preconditions**:

- A state with no open park, containing a delivered lane, queue entries, and a completed attempt.
- Pre-change golden outputs for `dispatch status`, `lanes`, `board`, `brief`, and a dispatch result.

**Steps**:

1. Render every surface from the no-park state.
2. Compare each rendering byte for byte with the pre-change golden.
3. Inspect the machine payloads for the added members.

**Expected Outcome**:

- Every delivered field and line is byte-identical; no line is added.
- The additive park and episode members are absent, not present with a null placeholder.
- No golden is updated in this scenario; the no-park pins are deliberately untouched.

#### TC-PEAK-014 - One invocation returns one result whose summary states paused and resumed

**Scenario Type**: Happy Path
**Impact Level**: Critical
**Priority**: High
**Related IDs**: F-7, AC-F7-1, DM-4, DM-5
**Test Type(s)**: Integration
**Automation Level**: Automated
**Target Layer / Location**: `tests/behaviour/dispatch-peak-result.test.ts` (new), extending `tests/behaviour/dispatch-token-closure.test.ts` and `tests/behaviour/dispatch-envelope.test.ts`
**Tags**: @backend, @result

**Preconditions**:

- One dispatch invocation that parks and resumes before its terminal classification.
- The same truth inputs run once without an episode as the token and exit control.
- The exact additive episode member names fixed by the delivery in this change.

**Steps**:

1. Run the spanning invocation to completion.
2. Read the result count, token, exit projection, human summary, and machine envelope.
3. Read the bounded episode fact.
4. Compare the token and exit with the no-episode control.

**Expected Outcome**:

- Exactly one result for the work item; token and exit are the same the same truth would produce without an episode; no episode invents a token.
- The summary states that the lane was paused and resumed, names the cause and the episode's end.
- The envelope carries the bounded episode fact: episode id, cause, park end, and resume instant, or the preservation classification when the resume was a recovery.
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
- A lane already parked before the key changes to `true`.

**Steps**:

1. Run the lane to the open window with the key absent; then with `false`.
2. Run the same lane with the key `true`; read the composition fact and the written records.
3. Change the key to `true` while a lane is already parked and run the next observation.
4. Compare the `true` arm's result with the delivered pre-change admission-gating-only behaviour.

**Expected Outcome**:

- Absent or `false`: the lane parks exactly as specified.
- `true`: no in-flight watch, no stop, no park, no resume, no episode event; admission gating refuses a new dispatch inside a window exactly as delivered; the composition fact reports `iteration-start-gating`; no zero-spend reading is synthesized for a park that did not happen.
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

1. Issue `dispatch stop <ref>` with a cause from the delivered closed set and a declared end under the disabled setting.
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

#### TC-PEAK-018 - `dispatch stop` equals a window-open stop, payload for payload

**Scenario Type**: Happy Path
**Impact Level**: Critical
**Priority**: High
**Related IDs**: F-9, AC-F9-1, NFR-1, NFR-2, DM-1, events `stop`, `parked`, `park-edge`
**Test Type(s)**: Integration
**Automation Level**: Automated
**Target Layer / Location**: `tests/behaviour/dispatch-stop.test.ts` (new), sharing the episode assertions of `tests/behaviour/dispatch-peak-episode.test.ts`
**Tags**: @backend, @stop

**Preconditions**:

- A running dispatch lane with an injected clock and a recording stop seam.
- The same deterministic episode-id factory for both arms.
- A declared operator cause from the delivered closed park-cause set and a declared end.

**Steps**:

1. Issue `dispatch stop <ref>` with the cause and end.
2. Read the stop request, the park record, and the three projected events.
3. Run the window-open stop on an identically seeded lane at the same instant, using the same injected clock and deterministic episode-id factory.
4. Compare the two episode payloads exactly; only the invocation form differs.

**Expected Outcome**:

- The stop request is the same bounded-grace request a window-open stop sends; the applied grace is the delivered default bounded by the derived maximum.
- The park carries the operator's declared cause and end, the grace deadline, the stop instant, the episode id, and the preservation classification.
- Exactly one `stop`, one `parked`, and one `park-edge` are recorded with the same payloads as the window-open stop.
- At the declared end the lane resumes by the same classification-routed resume.

#### TC-PEAK-019 - `dispatch stop` never kills; one terminate request; TERM before KILL

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
- A recording terminate seam that observes TERM and KILL requests, the declared grace, and the target listing.
- A case where the session is unknown.

**Steps**:

1. Issue `dispatch stop <ref>` with a declared cause and end.
2. Record every signal request, its order, its target, and its grace.
3. Run the unknown-session arm.
4. Run the structure guard over the command path for any second signalling route.

**Expected Outcome**:

- The command sends no signal of its own; exactly one stop request reaches the delivered terminate path.
- TERM is requested before KILL; KILL follows only after the delivered declared grace and only over a target still listed.
- An unknown session is treated as success.
- No second signal path, pattern, process-group signal, or kill mechanism exists.

#### TC-PEAK-020 - A stop for a non-running lane is a classified refusal that writes nothing

**Scenario Type**: Negative
**Impact Level**: Critical
**Priority**: High
**Related IDs**: F-10, AC-F10-1, NFR-8
**Test Type(s)**: Integration
**Automation Level**: Automated
**Target Layer / Location**: `tests/behaviour/dispatch-stop-refusal.test.ts` (new), extending `tests/behaviour/dispatch-attempts-refusals.test.ts` and the delivered unmet-precondition family
**Tags**: @backend, @stop, @refusal

**Preconditions**:

- A repository whose newest lane for the addressed work item is terminal, absent, or otherwise not running.
- A store snapshot and a read counter before the command.

**Steps**:

1. Snapshot the record set and the store read count.
2. Issue `dispatch stop <ref>` with a valid cause and end.
3. Read the refusal identity, the exit, and the bounded summary.
4. Compare the record set with the snapshot.

**Expected Outcome**:

- The command refuses with the delivered classified unmet-precondition identity at its delivered exit; no new identity or row.
- The summary names the work item and the observed lane state within the evidence bound.
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
- The second lane keeps its lease, its session, and its supervision unchanged.
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

#### TC-PEAK-027 - Vocabulary economy and event evidence bounds hold

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

#### TC-PEAK-029 - One real peak-pause episode is observed on the reference host and recorded on the PR

**Scenario Type**: Manual (operational)
**Impact Level**: Critical
**Priority**: High
**Related IDs**: Owner delivery note 3; F-1 through F-12 observed end to end
**Test Type(s)**: Manual
**Automation Level**: Manual
**Target Layer / Location**: Reference host, one real lane, recorded on the pull request and in section 10 by the delivering lane
**Tags**: @manual, @operational

**Preconditions**:

- Automatic pausing is on (`lane.disable-peak-pausing` unset or `false`).
- A real lane whose nominated profile declares a peak window that it will cross.
- The delivered binary built from this change.

**Steps**:

1. Dispatch the real lane and let it run into the nominated profile's open window.
2. Observe `dispatch status <ref>`, `lanes`, and `board` while the lane is parked: cause, `until`, recorded stop instant, and no stale classification.
3. Observe the resume at the window's end and let the lane reach its terminal classification.
4. Record the episode id, the park and resume instants, the observed lag, the zero-spend reading, and the one-result summary on the pull request.
5. Fill the TC-PEAK-029 row in section 10 with the run date, result, and the PR evidence link.

**Expected Outcome**:

- One real episode shows exactly one `stop`, one `parked`, one `park-edge`, and one `resumed`; the session, branch, worktree, change folder, phases, and queue state survive; no second session exists.
- The zero-spend reading over present telemetry is zero for the parked interval; the one result states paused and resumed.
- The evidence is recorded on the pull request, as the owner requires; the automated fixtures remain the gate evidence.

**Notes / Clarifications**:

- If no declared window opens during the delivery window, the delivering lane records that fact on the pull request and schedules the observation on the next lane; the automated fixtures remain the merge gate. This is tracked as OQ-TP-2, non-blocking.

## 6. Environments and Test Data

- **Runtime**: local development and CI, Bun pinned by `.bun-version`, `bun:test` discovery per `bunfig.toml`. No browser, no container, no external service.
- **State**: a temporary state store per fixture from `tests/fixtures/state/harness.ts` (`makeTempRoot`, `openStore`, `makeIdentity`, `removeRoot`), disposed in a `finally` block. No test writes to a real state root.
- **Git**: a temporary repository per lifecycle fixture for branch, worktree, change-folder, phase, and queue-state assertions, created by the harness inside its own temp directory. The fixture never runs in the developer checkout.
- **Injected seams**:
  - Clock: `nowIso` (or a controllable stepping clock) on `createCommandScenario`; the fixture advances time explicitly. No `setTimeout`, `Bun.sleep`, or real timer participates.
  - Delay: the delivered `DispatchDelay` seam, recording each requested delay and returning immediately; the wait's wake count is asserted over this spy.
  - Transport: the scripted `HarnessSessionPort` and the in-memory event transport pair; zero live provider, tracker, or network calls.
  - Restart and resume: the delivered restart-append and resume-economics seams, seeded with explicit budgets and counts.
- **Test data**:
  - Profile rule fixtures: a UTC profile with one window and buffers, a profile with overlapping windows for the union assertion, a profile with no `peakWindows`, and a preference chain with a base entry that declares none.
  - Episode fixtures: deterministic episode-id factory, declared grace values below and at the derived maximum, preserved and not-preserved classifications, and operator causes from the delivered closed set.
  - Telemetry fixtures: a present ledger with no in-window call, a present ledger with a seeded in-window call at each inclusive boundary, and an absent-telemetry arm.
  - Surface fixtures: the existing status, lanes, board, brief, and result golden inputs, with and without an open park.
- **Isolation**: one temp root and one store per test, unique labels for attempt and divergence ids, no shared mutable module state. Tests run in any order.
- **Manual environment**: the reference host only, for TC-PEAK-029. Its evidence is a pull-request record, never a hidden local step.
- **Gate environment**: `TMPDIR=$PWD/tmp/tmpdir` for the aggregate gate, as the repository's `ci-baseline-parity` cross-device requirement expects.

## 7. Automation Plan and Implementation Mapping

Implementation order follows the spec's delivery order: setting and validation, watch and episode, wait and resume, surfaces and one-result summary, operator command. Each phase adds tests for what it changes and leaves the delivered behaviour intact when its part is not exercised.

Execution guidance from the owner, recorded here as delivery guidance and not as a new requirement:

- While implementing, run only the affected suites, for example `bun test tests/behaviour/dispatch-peak-*.test.ts tests/behaviour/dispatch-stop*.test.ts tests/behaviour/config-lane.test.ts`.
- Run the whole battery once at the gate: `pnpm check`, with `TMPDIR=$PWD/tmp/tmpdir`.
- Create the change's changeset before the first gate run (TC-PEAK-028).

| TC ID | Test file | Execution command | Injection / mocking | Status |
|-------|-----------|-------------------|---------------------|--------|
| TC-PEAK-001 | `tests/behaviour/dispatch-peak-parity.test.ts` | `bun test tests/behaviour/dispatch-peak-parity.test.ts` | Injected clock and shared rules lookup over both compositions | To Implement |
| TC-PEAK-002 | `tests/behaviour/dispatch-peak-watch.test.ts` | `bun test tests/behaviour/dispatch-peak-watch.test.ts` | `createCommandScenario` with `nowIso` and a scripted liveness sequence | To Implement |
| TC-PEAK-003 | `tests/behaviour/dispatch-peak-determinism.test.ts` | `bun test tests/behaviour/dispatch-peak-determinism.test.ts` | Fixed clock sequence, delay spy, scripted transport, deterministic ids | To Implement |
| TC-PEAK-004 | `tests/behaviour/dispatch-peak-watch.test.ts` | `bun test tests/behaviour/dispatch-peak-watch.test.ts` | Chain fixture with a base entry that declares no `peakWindows` | To Implement |
| TC-PEAK-005 | `tests/behaviour/dispatch-peak-watch.test.ts` | `bun test tests/behaviour/dispatch-peak-watch.test.ts` | No-window profile, provider-entry `peak` fixture, admission preflight | To Implement |
| TC-PEAK-006 | `tests/behaviour/dispatch-peak-episode.test.ts` | `bun test tests/behaviour/dispatch-peak-episode.test.ts` | Injected clock, delay spy, stop-request recorder, event transport | To Implement |
| TC-PEAK-007 | `tests/behaviour/dispatch-peak-episode.test.ts` | `bun test tests/behaviour/dispatch-peak-episode.test.ts` | `livenessIntervalMs` plus a stepping `nowIso` | To Implement |
| TC-PEAK-008 | `tests/behaviour/dispatch-peak-resume.test.ts` | `bun test tests/behaviour/dispatch-peak-resume.test.ts` | Preserved-resume seam, session-port recorder, restart ledger | To Implement |
| TC-PEAK-009 | `tests/behaviour/dispatch-peak-recovery.test.ts` | `bun test tests/behaviour/dispatch-peak-recovery.test.ts` | Preservation-failure fixture, restart budget, typed-question seam | To Implement |
| TC-PEAK-010 | `tests/behaviour/dispatch-peak-preservation.test.ts` | `bun test tests/behaviour/dispatch-peak-preservation.test.ts` | Temporary git repo and store snapshots, single-flight lease fixture | To Implement |
| TC-PEAK-011 | `tests/behaviour/dispatch-status-park.test.ts` | `bun test tests/behaviour/dispatch-status-park.test.ts` | Open park record, probe verdict, read counter | To Implement |
| TC-PEAK-012 | `tests/behaviour/dispatch-peak-surfaces.test.ts` | `bun test tests/behaviour/dispatch-peak-surfaces.test.ts` | Seed one park record, read spy, lanes and board harnesses | To Implement |
| TC-PEAK-013 | `tests/behaviour/dispatch-peak-byte-identical.test.ts` | `bun test tests/behaviour/dispatch-peak-byte-identical.test.ts` | Pre-change goldens and a no-park state | To Implement |
| TC-PEAK-014 | `tests/behaviour/dispatch-peak-result.test.ts` | `bun test tests/behaviour/dispatch-peak-result.test.ts` | Spanning episode fixture plus a no-episode control | To Implement |
| TC-PEAK-015 | `tests/behaviour/dispatch-peak-setting.test.ts` | `bun test tests/behaviour/dispatch-peak-setting.test.ts` | Three configuration arms over the same episode fixture | To Implement |
| TC-PEAK-016 | `tests/behaviour/dispatch-stop.test.ts` | `bun test tests/behaviour/dispatch-stop.test.ts` | Disabled-setting arm and enabled control, shared episode fixture | To Implement |
| TC-PEAK-017 | `tests/behaviour/dispatch-peak-setting.test.ts`, `tests/behaviour/config-lane.test.ts`, `tests/fixtures/config/lane.ts` | `bun test tests/behaviour/dispatch-peak-setting.test.ts tests/behaviour/config-lane.test.ts` | Invalid lane source cases; delivered error table | To Implement |
| TC-PEAK-018 | `tests/behaviour/dispatch-stop.test.ts` | `bun test tests/behaviour/dispatch-stop.test.ts` | Same clock, same episode factory, window-open control | To Implement |
| TC-PEAK-019 | `tests/behaviour/dispatch-stop-safety.test.ts` | `bun test tests/behaviour/dispatch-stop-safety.test.ts` | Recording terminate seam, unknown-session arm, source guard | To Implement |
| TC-PEAK-020 | `tests/behaviour/dispatch-stop-refusal.test.ts` | `bun test tests/behaviour/dispatch-stop-refusal.test.ts` | Newest-lane state fixtures, store snapshot and read counter | To Implement |
| TC-PEAK-021 | `tests/behaviour/dispatch-peak-owner-hold.test.ts` | `bun test tests/behaviour/dispatch-peak-owner-hold.test.ts` | Injected owner-hold marker and park-record snapshot | To Implement |
| TC-PEAK-022 | `tests/behaviour/dispatch-peak-isolation.test.ts` | `bun test tests/behaviour/dispatch-peak-isolation.test.ts` | Two lanes, two profiles, two leases, one injected clock | To Implement |
| TC-PEAK-023 | `tests/behaviour/dispatch-peak-spend.test.ts` | `bun test tests/behaviour/dispatch-peak-spend.test.ts` | Present and absent telemetry ledgers over the episode interval | To Implement |
| TC-PEAK-024 | `tests/behaviour/dispatch-peak-spend.test.ts` | `bun test tests/behaviour/dispatch-peak-spend.test.ts` | Seeded in-window calls at both inclusive boundaries | To Implement |
| TC-PEAK-025 | `tests/behaviour/dispatch-peak-resume.test.ts` | `bun test tests/behaviour/dispatch-peak-resume.test.ts` | Rule-data mutation between park and recorded end | To Implement |
| TC-PEAK-026 | `tests/checks/peak-pause-hermetic.test.ts` | `bun test tests/checks/peak-pause-hermetic.test.ts` | Armed fetch, credential, and sleep canaries; source scan | Existing - Update |
| TC-PEAK-027 | `tests/structure/event-taxonomy-integrity.test.ts`, `tests/checks/event-taxonomy-conformance.test.ts` | `bun test tests/structure/event-taxonomy-integrity.test.ts tests/checks/event-taxonomy-conformance.test.ts` | Closed-set declarations and payload bounds | Existing - Update |
| TC-PEAK-028 | `tests/checks/privacy-release.test.ts`, `tests/structure/changeset-additivity.test.ts` | `bun test tests/checks/privacy-release.test.ts tests/structure/changeset-additivity.test.ts` | The change's changeset and the tree baseline pin | Existing - No Change (run early) |
| TC-PEAK-029 | Reference host and pull request | Manual, no command in CI | One real lane and one real declared window | Manual Only |

Notes on mapping:

- The existing peak-pause determinism suite (`tests/behaviour/peak-pause-determinism.test.ts`) pins the pure decisions. TC-PEAK-003 pins the dispatch command's full output, so it extends the pattern at the command boundary and does not duplicate the pure-suite assertions.
- The existing daemon park and resume suites are the parity control for TC-PEAK-001 and the regression context for TC-PEAK-005. They are not modified by this change.
- The existing `dispatch-additive-stability` suite is the pattern for TC-PEAK-013; its no-park goldens are deliberately untouched.
- The event bounds constants already exist in the event fixtures; TC-PEAK-027 reuses them and asserts non-vacuity, never a growing count.
- No new CI job is added. Every automated TC rides `bun test` through `pnpm check`, as the testing strategy requires.

## 8. Risks, Assumptions, and Open Questions

### 8.1 Risks

| ID | Risk | Mitigation |
|----|------|------------|
| RSK-TP-1 | The parity fixture passes on a simplified path while the dispatch composition quietly re-derives a window rule | TC-PEAK-001 compares both compositions on the same rules and instant and adds a structure guard that the dispatch path calls the delivered decision layer; the guard fails on a copied implementation. |
| RSK-TP-2 | A fixture accidentally uses wall-clock time or a real sleep, making the episode test slow or flaky | TC-PEAK-003 and TC-PEAK-026 use a counted clock, a recording delay seam, and armed canaries; TC-PEAK-026 also source-scans for `setTimeout` and real sleeps. |
| RSK-TP-3 | A test hardcodes a guessed member name for the additive status or result fact and fails on a legitimate rename | The plan requires asserting the declared behaviour through the command's own JSON contract; the exact member names are pinned by the delivery in this change and reviewed once, not guessed. |
| RSK-TP-4 | No real peak window occurs during the delivery window, so the manual episode cannot be recorded before the PR | TC-PEAK-029 is manual and non-gating; if no window opens, the lane records the reason on the PR and schedules the next lane, while the automated fixtures remain the merge gate (OQ-TP-2). |
| RSK-TP-5 | The first full gate run fails TC-RELEASE-001 for a missing changeset, wasting a battery run | TC-PEAK-028 is run before the first gate; the changeset is created in the same delivery phase as the code. |
| RSK-TP-6 | A no-park golden is updated to accommodate an additive change, erasing the byte-identical guarantee | TC-PEAK-013 treats the no-park goldens as read-only and asserts absence, not null presence; any golden update requires an explicit review note. |
| RSK-TP-7 | The not-preserved recovery test double-counts an ordinal because the fixture seeds the budget and the count inconsistently | TC-PEAK-009 reads the delivered restart ledger after the recovery and asserts exactly one appended ordinal, with a separate exhaustion arm that starts at the delivered budget. |
| RSK-TP-8 | The manual scenario is treated as a substitute for the fixtures | The plan states explicitly that TC-PEAK-029 is owner behavioural verification and the automated fixtures are the gate evidence; the manual row cannot turn a red suite green. |

### 8.2 Assumptions

- The delivered harness (`createCommandScenario`) already supports an injected clock, delay, and transport; this change extends it for the episode fixture rather than replacing it.
- The temporary git repository and store harness can snapshot branch tip, change-folder content, phases, queue state, lease, and worktree path without live resources.
- The event projection harness can produce the four episode kinds from a seeded park record over the in-memory transport pair.
- The telemetry fixture can seed and then omit attributable steps for the same ref and interval, so TC-PEAK-023 can assert the present-zero and classified-absence arms in one run.
- The additive member names for `dispatch status` and the result envelope are delivery-level details fixed in this change (spec section 14); the tests assert the declared behaviour through the command contract.
- The operator stop grammar accepts a cause from the delivered closed set and an end, as shown in spec Flow 3; the test pins the delivered grammar and does not invent an extra flag.
- The reference host has a real lane and a declared window that can be observed for TC-PEAK-029 within a reasonable delivery window; otherwise OQ-TP-2 applies.

### 8.3 Open Questions

| ID | Question | Blocking? | Owner | Resolution |
|----|----------|-----------|-------|------------|
| OQ-TP-1 | The exact flag spellings for the operator cause and end beyond spec Flow 3's `--cause` and `--until` are delivery-level; the test will assert the delivered grammar rather than a guessed spelling. | No | Delivery | Pin in the implementation plan and in the command help; TC-PEAK-018 and TC-PEAK-020 read the delivered grammar. |
| OQ-TP-2 | A real peak window may not open while the delivery lane is active, so TC-PEAK-029 may need to be recorded on the next lane after merge. | No | Delivering lane | Record the reason on the pull request and schedule the next real lane; the automated fixtures remain the gate evidence. |
| OQ-TP-3 | The additive `dispatch status` park fact and result episode fact member names are fixed by the delivery in this change (spec section 14). | No | Delivery | Pin the names in the same change and assert the declared behaviour; no test hardcodes a guessed name. |

No acceptance criterion is left uncovered. All 23 are covered by an automated scenario; TC-PEAK-029 is the only manual scenario and it is owner-required behavioural evidence, not a coverage gap.

## 9. Plan Revision Log

| Version | Date | Author | Changes |
|---------|------|--------|---------|
| 1.0 | 2026-11-26 | @test-plan-writer | Initial test plan from `chg-GH-413-spec.md`: 23 acceptance criteria covered by 28 automated scenarios (including the derived invalid-value configuration scenario and the release assertion) plus 1 owner manual episode; capability, data-model, event, and NFR traceability; hermetic fixture design; owner delivery notes recorded. |

## 10. Test Execution Log

Results are appended during delivery. The manual row is filled by the delivering lane and recorded on the pull request.

| TC ID | Run Date | Result | Notes |
|-------|----------|--------|-------|
| TC-PEAK-029 | Pending | Pending | Reference-host episode to be recorded on the pull request by the delivering lane. |
