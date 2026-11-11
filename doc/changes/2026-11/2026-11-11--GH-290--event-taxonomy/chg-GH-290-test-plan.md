---
id: chg-GH-290-test-plan
status: Proposed
version: 1.0
created: 2026-11-11
last_updated: 2026-11-11
owners: [engineering]
service: delivery-os daemon subscribe surface (event taxonomy v1, reference command, mount)
labels: [daemon, control-protocol, events, taxonomy, contracts, cli, help, m2]
version_impact: minor
summary: "Pin event taxonomy v1 as a comparison a test runs: the six-topic declaration (and the absence of `status`) is asserted by exact set equality, each event topic's kind set and per-kind payload-field list is asserted per topic, one authored declaration is proven to be the only source for both the `events list` / `events describe <topic>` surface and the daemon-emitted frames, the eight-field envelope and per-`(topic, lane)` monotonic `sequence` are observed end to end through the delivered control session/server over a real store (with a bounded real-unix-socket variant), overflow-to-repoll is proven identical for all six topics with exactly one `degraded` frame per overflowing subscription carrying `overflow: \"repoll\"` and `taxonomyVersion: \"v1\"`, the delivered `queue`/`lanes` snapshot frames are proven byte-identical, the mount is proven as one unit (prompt-required 18→19, root help 19 families, family and verb help entries, M2 reference page, coverage-inventory rows, page-root row) together with the guards that fail when any piece is missing, and additivity is proven by unchanged vocabulary, unchanged state schema, unchanged dependency set, and exactly three error rows in one new `events` kind. The two declared gaps (`queue.graph.remove` `emitted: false`, `phase.state.began` derived at the first `complete`) and the S17 boundary are asserted, not assumed. 38 acceptance criteria (33 capability plus 5 non-functional) are bound to 45 test cases; every criterion is covered, five of them partly through a named substitute assertion recorded in §3.5."
links:
  change_spec: ./chg-GH-290-spec.md
  implementation_plan: ./chg-GH-290-plan.yaml
  testing_strategy: ../../../../.ai/rules/testing-strategy.md
---

# Test Plan - Publish event taxonomy v1 on the daemon subscribe surface

## 1. Scope and Objectives

This change publishes a contract, so the risk is not that a feature is missing — it is that the contract looks published while one of six independent facts is false, and every consumer inherits the falsehood. Each fact is therefore proven as a comparison a test runs, never as a prose claim. **First, the topic set and the kind sets are exact.** The declaration's six topics equal the served set and `status` is absent (`TC-EVT-001`); each event topic's kind set equals the contract section's enumeration — 4 / 3 / 3 / 3 — with `queue` and `lanes` carrying the single `snapshot` kind (`TC-EVT-002`). A count copied from the planning page's example (6 and 4) would pass a "topics exist" test and fail this one, which is exactly why the assertion is set equality per topic and a token scan for the four S17 kind names. **Second, there is one authored source.** The surface is generated from the declaration, not hand-written beside it: an injected declaration copy changes the surface record and the emitted frame together (`TC-EVT-006`), the command module carries no literal kind arrays (source scan), and a single drift in any one of five items — version, kind, payload field, ordering, overflow — fails a named per-topic assertion that names the drifted item (`TC-EVT-003`). **Third, the envelope is real on the wire and ordered per lane.** A subscriber to `queue.graph` observes an `entry` and then a `dependency-edge` event it can act on, each carrying exactly `topic`, `kind`, `lane`, `ref`, `sequence`, `occurredAt`, `payload`, `taxonomyVersion` and no `cursor`, end to end through the delivered control server and session over a real store (`TC-EVT-020`, with a bounded real-unix-socket variant `TC-EVT-021`); the per-`(topic, lane)` counters are monotonic and shared by two subscribers (`TC-EVT-030`), independent across lanes and topics (`TC-EVT-031`), and restart-scoped (`TC-EVT-032`).

**Fourth, overflow stays exactly as delivered and gains only a readable remedy, on all six topics.** A subscription that stops reading receives exactly one `degraded` frame carrying `degraded: "subscriber-overflow"`, `overflow: "repoll"`, and `taxonomyVersion: "v1"`, is the only subscription dropped, and every other subscription on that topic keeps receiving (`TC-EVT-040`); the value on the frame and the value on the reference record are rendered from one constant, proven by a mutant that moves both or neither (`TC-EVT-041`); and the single capacity bound still refuses with `daemon.subscriber-degraded` (`TC-EVT-042`). **Fifth, the delivered snapshot topics do not move.** `queue` and `lanes` keep `{topic, cursor, snapshot}`, the `cursor: 0` baseline, and change-only cursor advancement, with the degraded frame's two additive fields as the only delta (`TC-EVT-050`, `TC-EVT-051`), and the delivered control/session/server/watch suites pass unmodified as controls. **Sixth, the mount is one unit or the guards fail.** `events` is prompt-required (18 → 19), composed unconditionally, reachable from root `--help` (19 families) with family and verb help entries, backed by the M2 reference page, a coverage-inventory `commands` and `referencePages` row, and the page-root row (`TC-EVT-060`..`TC-EVT-063`); and each of those pieces is removed in a temp copy by a mutant that must trip a named guard (`TC-EVT-064`), so "partially mounted" cannot pass.

The plan is deliberately adversarial about the failure modes the ticket names. **A second copy of the contract**: a hand-written surface would still pass a "the counts look right" test, so `TC-EVT-006` mutates the declaration once and asserts both consumers move, and `TC-EVT-003` proves five drift classes each fail a named assertion. **A declared kind with no emitter**: `remove` is asserted to be declared, `emitted: false`, and never produced by a full-delivery fixture (`TC-EVT-027`), while all fourteen emitted kinds are asserted to appear at least once — so the declaration cannot be a list of wishful entries. **A derived begin presented as a record**: `began` is asserted to be produced from the first `complete`, once per phase, immediately before that phase's first `completed`, with ascending sequence on the same lane (`TC-EVT-025`). **A client that treats `sequence` as durable**: a second daemon incarnation over the same store restarts the counter and the declared rule routes the client to a repoll (`TC-EVT-032`), and the surface is asserted to describe the restart discontinuity rather than imply a durable revision. **A version prose asserts**: both the surface record and every emitted frame are compared against the same declaration (`TC-EVT-011`, `TC-EVT-022`), so a version that only one of them reports fails.

This document is a verification map, not an execution claim: no command was run against a new implementation at authoring time, and no plan phase is asserted (the implementation plan is a later artifact). Where delivery owns a name — a module path, a validator function, an injection seam, a private projection helper — the scenario asserts the declared property through the public surface, the control frames, or an injected port, and names the seam; a case that cannot resolve its seam must fail naming the missing contract rather than skip. All 38 acceptance criteria are covered; there are no TODO rows and no orphan cases. Five criteria are covered partly through a named substitute assertion (§3.5) because one half of their wording is a client-side reaction, an out-of-tree peer, or an in-memory growth property that no server test can observe; that is recorded, not smoothed over.

### 1.1 In Scope

- The taxonomy declaration: version, six topics, kind records with `emitted`, derived payload-field unions, frame lists, lane rules, ordering, overflow, and the integrity check (F-1; AC-F1-1..AC-F1-5; DM-1; DEC-A, DEC-B, DEC-E, DEC-J, DEC-K, DEC-M).
- The reference surface: text grammar and machine envelope for `events list` and `events describe <topic>`, the eight-field `envelope[]`, the six topic records, the single-topic `describe` shape, the three error identities, and the `{0,1,2}` exit projection (F-2; AC-F2-1..AC-F2-5; DM-7; EVT-1; Appendix D).
- Event emission on `queue.graph`, `dispatch.attempt`, `phase.state`, and `blockers.state`, per-kind source mapping, `occurredAt` from the source record, bounded payloads, the two declared gaps, and the never-emitted `remove` kind (F-3; AC-F3-1..AC-F3-7; DM-2; EVT-1, EVT-4; Appendix E).
- Per-`(topic, lane)` sequence allocation, monotonicity, cross-lane and cross-topic independence, subscriber agreement, the process-scoped restart discontinuity, and the declared gap-to-repoll rule (F-4; AC-F4-1..AC-F4-3; DM-5; NFR-6).
- Overflow parity for all six topics with the additive `overflow`/`taxonomyVersion` stamp, the unchanged dropped-subscription behaviour, and the unchanged capacity bound (F-5; AC-F5-1..AC-F5-3; DM-4; EVT-2; NFR-7, NFR-9).
- Byte-level preservation of the delivered `queue`/`lanes` snapshot frames and their surface records (F-6; AC-F6-1, AC-F6-2; DM-3; EVT-3).
- The mount as one unit and the guards in both directions: prompt-required set, production composition, root and verb help, M2 reference page, coverage inventory, page-root mapping, file-set inventory, v1 contract inventory, and executable-export allowances (F-7; AC-F7-1..AC-F7-4; DEC-F; §8.5).
- Additivity and the error table: unchanged wire types, frame kinds, degraded reasons, stop modes, protocol version, buffer bound, state schema, record kinds, and dependency set; exactly three error rows in one new `events` kind; the one intentional delivered refusal-identity change (F-8; AC-F8-1..AC-F8-4; DM-6, DM-8; EVT-5; DEC-L).
- The measured NFRs: reference-surface purity and latency, publish-tick read/socket/probe/sleep cost and added latency, burst cap with watermark pending, frame bound and truncation marker, and privacy of every projected value (AC-NFR-1..AC-NFR-5; NFR-1, NFR-2, NFR-3, NFR-5, NFR-10).

### 1.2 Out of Scope & Known Gaps

- [OUT] Any S17 shape: `stop`, `parked`, `resumed`, and `park-edge` kinds, their payloads, their deadlines, and the park fields on `status`/`brief`. They are asserted **absent** by `TC-EVT-002` (declaration token scan) and `TC-EVT-027` (emitted-kind equality); no case exercises them (NG-2, DEC-A, §7.2).
- [OUT] Queue or lane mutation: entry removal with a reason, the `dep add`/`dep remove` grammar, automatic removal on merge/closeout, stale reconciliation. `TC-EVT-027` asserts the absence of a `remove` emitter; nothing asserts a removal path works (NG-4, §7.2).
- [OUT] A phase begin record or any new persistence. `TC-EVT-025` asserts the derived projection; `TC-EVT-073` asserts no record kind, payload schema, key prefix, migration, seed, or schema version was added (NG-3, DM-8).
- [OUT] Control-protocol change: no new wire type, frame kind, protocol version or floor, codec rule, buffer semantics, or at-most-once change; `TC-EVT-070` and `TC-EVT-071` assert the delivered sets and the negative controls are untouched (NG-1).
- [OUT] Re-keying, re-wrapping, or enriching `queue` and `lanes`: `TC-EVT-050` asserts byte-identity and the delivered suites are unmodified controls (DEC-B).
- [OUT] New `--watch` topics on `queue`/`lanes`, a new watch command, or any CLI consumption of the four event topics. The event topics are consumed only through the daemon's subscribe surface in this plan (NG-6).
- [OUT] A second served taxonomy version, per-client negotiation, or a version stamp on frames that do not carry the envelope (`TC-EVT-051` asserts snapshot frames carry none) (NG-7).
- [OUT] `board`, `spend` v2, telemetry, `attempts` read side, `projects`, cross-repository group scoping, dashboards, metrics, traces, alerts (NG-5, NG-8).
- [OUT] Plugin/prompt/agent lifecycle edits, `.opencode/**`, and any new package dependency (`TC-EVT-074` asserts the dependency sets unchanged).
- [GAP-T1 — "generated from one declaration, not hand-written" is proven by mutation plus a source scan, not by a diff shape] The mechanical half is `TC-EVT-006` (an injected declaration copy changes both consumers, so a hand-written surface fails it) and a scan of the command module for literal topic/kind arrays. The "no second copy anywhere" half is a review-attested tree property; `.ai/rules/testing-strategy.md` assigns diff-shape claims to review, not to a permanent suite. **Compensation:** the scan enumerates the modules allowed to mention a topic name (`packages/core/src/contracts/taxonomy.ts`, the projection, and the command renderer reading the declaration) and `@reviewer` confirms at phase 8 that no other module carries a kind list. Owner: `@reviewer`.
- [GAP-T2 — the end-to-end subscribe cases use a delivered in-memory transport double, not a socket, except one bounded socket case] The ticket asks for the delivered session/server, not a mock of the thing under test. `TC-EVT-020` composes the real `createControlServer` and the real `createControlSession` over `tests/fixtures/daemon/transport/pair` — the transport is the only double, and it is the delivered test seam used by the delivered control suites. `TC-EVT-021` re-proves the same observation over a real unix socket under a temp state directory (the delivered `createUnixTransport` pattern), bounded by a hard timeout and a `finally` close. No case re-implements the server, the session, the codec, or the projection. See §6.1.
- [GAP-T3 — absences need three observations] "No store read", "no write", "no socket connect", "no process probe", "no sleep", "no composer invocation", "no `remove` frame", and "no `cursor` on an event frame" are absences. Each is proven by (i) the seam being a recording fake or an armed guard, (ii) a zero counter on it, and (iii) an unchanged durable record count, a byte-level key-set assertion, or a source scan. A single passing assertion is never accepted as proof of an absence.
- [GAP-T4 — timing bounds are measured, not assumed] The reference-surface latency (`TC-EVT-080`) and the added publish-tick latency (`TC-EVT-081`) are measured in the hermetic test process against a baseline captured in the same run over the same fixture store, with the iteration count, environment, and store shape written into the test output. The assertions are the declared bounds; if the bound cannot be held deterministically on the reference host, the case is reported with its measurement and re-run at the quality gate rather than relaxed silently.
- [GAP-T5 — delivery-bound names] Module paths, validator/helper names, export names, the declaration injection seam, and the pending-watermark inspector the specification does not pin are delivery-bound. Behaviour, identities, exits, closed vocabularies, ordering, frame field order, bounds, error codes, and AC traceability are not. A test that cannot resolve a seam fails naming the missing contract; it never skips.
- [GAP-T6 — the M2 reference page's prose is checked by token, not by semantics] `TC-EVT-002` asserts the four S17 kind names are absent from the page's taxonomy section and `TC-EVT-032` asserts the restart/repoll sentence exists. Neither proves the page's every sentence is true; the reconciliation claim in §16 of the specification is review-attested by `@doc-syncer` and `@reviewer`.

## 2. References

| Reference | Role in this plan |
|---|---|
| [`chg-GH-290-spec.md`](./chg-GH-290-spec.md) v1.0 | Binding source: F-1..F-8, **38 ACs** (AC-F1-1..AC-F1-5, AC-F2-1..AC-F2-5, AC-F3-1..AC-F3-7, AC-F4-1..AC-F4-3, AC-F5-1..AC-F5-3, AC-F6-1..AC-F6-2, AC-F7-1..AC-F7-4, AC-F8-1..AC-F8-4, AC-NFR-1..AC-NFR-5), DEC-A..DEC-M, DM-1..DM-8, EVT-1..EVT-5, NFR-1..NFR-10, RSK-1..RSK-9, OQ-1/OQ-2, §5.1 topic/kind/payload tables, §6 flows 1–7, Appendix C (closed vocabularies), Appendix D (exit matrix), Appendix E (kind→record source map), Appendix F (frame matrix). |
| [`TDR-0024-public-event-taxonomy-v1-subscribe-surface.md`](../../../decisions/TDR-0024-public-event-taxonomy-v1-subscribe-surface.md) (status `Proposed`, uncommitted working-tree file) | Binding decision record consumed unchanged: DC-1 (contract section is the kind authority, S17 shapes out of scope), DC-2 (seven-field envelope inside the open `data` body, per-`(topic, lane)` sequence, cursor excluded), DC-3 (delivered overflow preserved, `repoll` declared per topic), DC-4 (versioned machine-readable reference surface, pinned per topic, mounted as one unit), DC-5 (what v1 pins, may grow, and what forces v2). |
| [`chg-GH-290-pm-notes.yaml`](./chg-GH-290-pm-notes.yaml) | Context only: clarify-scope findings. The specification is the source of truth. |
| [`.ai/rules/testing-strategy.md`](../../../../.ai/rules/testing-strategy.md) | `bun:test` under `tests/**/*.test.ts`; fixtures never named `*.test.ts`; suites under `tests/{structure,behaviour,conformance,golden,checks,boundaries}`; permanent suites assert the current tree, never a moving base branch; goldens regenerate only by an explicit command; `pnpm check` is the aggregate gate; absences and invariants are proven by a failing check that names the offending field. |
| [`.ai/rules/typescript.md`](../../../../.ai/rules/typescript.md) | Strict typing; injected clock/randomness/environment; data-only contracts (no clock, I/O, or call expression in the declaration); pure domain; adapters own I/O; injected fakes over `mock.module`. |
| **Planning seeds (contract authority and scenarios)** | `doc/planning/oss-tooling/milestones/m2/contracts.md` §Event taxonomy v1 (topics, kind enumeration, payload shapes, ordering, overflow, versioning) and §S17 mapping — the sole kind-set authority; `doc/planning/oss-tooling/milestones/m2/test-scenarios.md` SC-M2-S13-01 (`queue.graph` monotonic `sequence` + pinned `data.taxonomyVersion`) and SC-M2-S13-02 (`data.overflow == "repoll"` per new topic); `doc/planning/oss-tooling/milestones/m2/commands/events.md` (the page whose example counts and stop/park/resume prose are reconciled by phase-7 doc sync and are non-governing). |
| **Delivered contracts consumed under test** | `packages/core/src/contracts/control.ts` (`CONTROL_TOPICS`, `CONTROL_WIRE_TYPES`, `CONTROL_FRAME_KINDS`, `CONTROL_DEGRADED_REASONS`, `CONTROL_STOP_MODES`, `ControlEventData`), `packages/core/src/contracts/error-table.ts`, `packages/core/src/contracts/daemon.ts` (`DAEMON_MAX_FRAME_BYTES`, `daemon.subscription-buffer` default), `packages/core/src/domain/control-codec.ts` (`decodeControlLine`, `encodeControlFrame`), `packages/core/src/domain/control-session.ts`, `packages/core/src/app/control-server.ts`, `packages/core/src/app/daemon-runtime.ts`, `packages/core/src/domain/watch-stream.ts`, `packages/core/src/app/watch.ts`, `packages/cli/src/daemon-compose.ts` (subscribe handler, watch projection, publish tick) |
| **Delivered record shapes and read folds consumed unchanged** | `packages/core/src/contracts/queue.ts` (`queue.entry`, `queue.dependency`, `queue.lease`, `queue.park`), `packages/core/src/contracts/dispatch.ts` (`dispatch.attempt`, `HARNESS_OUTCOMES` incl. `refused`), `packages/core/src/contracts/registry.ts` (`phase.transition`, `foldPhaseState`), `packages/core/src/contracts/blockers.ts` (`blocker.question`, `blocker.answer`), `packages/core/src/contracts/daemon.ts` (`daemon.lane`), with the app-level appenders and read folds used as the *production writers* in fixtures. |
| **Mount surfaces and guards under test** | `packages/cli/src/help/prompt-required-commands.ts` (`PROMPT_REQUIRED_COMMANDS`, 18 today), `packages/cli/src/help.ts` (`ROOT_HELP`, `COMMAND_HELP`, `allHelpEntries`, `M2_REFERENCE_ROOT`), `packages/cli/src/entrypoint.ts` (`runEntrypoint`, `selectPromptRequiredProgram`), `packages/cli/src/edge.ts`, `scripts/checks/help-guide-coverage.ts` (`PAGE_ROOT`, `M2_PAGE_ROOT`, page resolution), `tests/fixtures/help-guide/coverage.json`, `tests/checks/{help-guide-coverage,reference-page-parity,doc-conformance,error-table-sync,exports-parity,exit-code-literals,prompt-conformance-mutants}.test.ts`, `scripts/checks/{prompt-conformance,error-table-sync,exports-parity,ambient-globals,workspace-entrypoints}.ts`, `tests/structure/content-inventory.test.ts` + `tests/structure/inventory.json` |
| **Reference page reconciled by this change** | `doc/planning/oss-tooling/milestones/m2/commands/events.md` — must carry `--help` and `--version`, must describe 4/3/3/3 kinds, must declare `queue`/`lanes` as snapshot topics, and must not carry the stop/parked/resumed/park-edge prose as v1 kinds. |
| **Delivered suites that must keep passing without semantic change** | `tests/behaviour/{control-codec,control-conformance,control-session,control-connection,control-transport,watch-stream,daemon-lifecycle,daemon-degradation*,daemon-heartbeat,daemon-lane-supervision,daemon-crash-restart,daemon-effects,daemon-watch-state-changes,queue-cli,queue-watch,lanes,lanes-watch,entrypoint-help,entrypoint-help-coverage,entrypoint-composition,error-classification*}.test.ts`, `tests/structure/{queue-scheduling-contract,daemon-vocabulary,daemon-contract,state-contract,error-table,envelope-contract}.test.ts`, `tests/golden/{queue-list,lanes-list,daemon-*}.test.ts`, `tests/checks/{doc-conformance,reference-page-parity,help-guide-coverage,error-table-sync,exit-code-literals}.test.ts` |
| **Precedent to mirror** | `tests/behaviour/daemon-watch-state-changes.test.ts` (real `createDaemonCommandRuntime` + manual wake + injected clock + temp store over `tests/fixtures/state/harness`), `tests/behaviour/control-connection.test.ts` (real `createControlServer` over `createMemoryTransportPair`), `tests/behaviour/control-transport.test.ts` (real `createUnixTransport` + `createControlServer` under a temp state directory), `tests/structure/coordinator-production-composition.test.ts` (temp root, injected facts, prompt-required membership) |
| **Ticket** | GitHub issue `juliusz-cwiakalski/agentic-delivery-os#290` |
| **TMPDIR caveat** | `.ai/memory/lessons/lesson-2026-001-ci-baseline-parity-tmpdir.md` — `tests/checks/ci-baseline-parity.test.ts` runs `git clone --local`, which fails on a cross-device hardlink error when `TMPDIR` is tmpfs; the canonical local gate is `TMPDIR="$PWD/tmp/tmpdir" pnpm check`. |

## 3. Coverage Overview

All 38 acceptance criteria map to at least one named case, and no case is an orphan. The mapping is intentionally uneven in one direction: a criterion whose wording spans two independent observables is covered by more than one case (AC-F1-3 by `TC-EVT-003` for drift and `TC-EVT-006` for single-source; AC-F2-1/AC-F2-2 by the text and `--json` cases plus `describe`; AC-F3-1 by the end-to-end, socket, and conformance cases; AC-F4-1 by the ticket's end-to-end case and the dedicated multi-subscriber case; AC-F5-2 by the parity and agreement cases; AC-F7-1..AC-F7-4 by the positive mount cases plus the guard-negative-control case). Five criteria — AC-F4-2, AC-F4-3, AC-F5-1, AC-F8-2, and AC-NFR-3 — contain one half that describes a *consumer's* reaction, an out-of-tree peer, or an in-memory growth property; those halves carry a named substitute assertion (§3.5) and are still counted as covered, with the substitution stated rather than hidden.

### 3.1 Functional Coverage (F-#, AC-#)

| AC ID | Criterion (condensed) | TC ID(s) | Status |
|---|---|---|---|
| AC-F1-1 | The declared topic set is exactly the six topics, `status` is absent, `queue.graph` is the only topic with parent `queue`, and every topic declares shape, frame, lane, ordering, overflow, and kind records | TC-EVT-001 | Covered |
| AC-F1-2 | Kind sets are exact per topic (4/3/3/3; snapshot topics single `snapshot`), with no S17 kind and none taken from the planning example counts | TC-EVT-002, TC-EVT-016, TC-EVT-027 | Covered |
| AC-F1-3 | A drift in version, a kind, a payload field, the ordering value, or the overflow value fails at least one named per-topic test that names the drifted item; with no drift every per-topic test passes | TC-EVT-003, TC-EVT-006 | Covered |
| AC-F1-4 | Integrity violations (duplicate topic, empty kinds, duplicated kind, kind without payload fields, unknown shape/ordering/overflow, missing frame field) each fail the check, and a failing declaration yields `events.taxonomy-unavailable` at exit `2` and renders no page | TC-EVT-004, TC-EVT-014 | Covered |
| AC-F1-5 | An added payload field inside v1 decodes successfully, unknown payload fields are tolerated, and the declared `payloadFields` list is unchanged unless the taxonomy version changed | TC-EVT-005, TC-EVT-003 | Covered |
| AC-F2-1 | `events list --json` exits `0` with `taxonomyVersion: "v1"`, the eight-field `envelope[]`, and six topic records exactly equal to the declaration | TC-EVT-011, TC-EVT-010, TC-EVT-013, TC-EVT-006 | Covered |
| AC-F2-2 | `events describe <topic>` text names shape, kinds with `emitted`, per-kind payload fields, lane rule, ordering, overflow, and frame within 40 lines / 8 192 bytes; `--json` returns exactly one topic record | TC-EVT-012, TC-EVT-013, TC-EVT-010 | Covered |
| AC-F2-3 | An unknown topic (including `status`) yields `events.topic-unknown` at exit `1` naming the topic and the six declared names; an absent/unknown verb yields `events.verb-unknown` at exit `1` naming `list` and `describe` | TC-EVT-014, TC-EVT-075 | Covered |
| AC-F2-4 | Any reference invocation performs zero state/config/git/network/filesystem reads, zero writes, and zero composer invocations, and the envelope is `{ ok, command, data, error?, warnings? }` with `command` = `events list`/`events describe` | TC-EVT-011, TC-EVT-015, TC-EVT-080 | Covered |
| AC-F2-5 | Every `queue.graph` kind carries a non-empty `payloadFields` list, `remove` alone carries `emitted: false`, and the topic's `payloadFields` equals the derived union of its kinds' lists | TC-EVT-016 | Covered |
| AC-F3-1 | On every event topic the `data` keys are exactly the eight declared fields in order; `lane` is present (null where no lane holds the subject); `kind` is in its topic's set; `occurredAt` equals the source record timestamp; no `cursor` | TC-EVT-020, TC-EVT-021, TC-EVT-022, TC-EVT-006 | Covered |
| AC-F3-2 | A `queue.graph` subscriber receives an `entry` event (payload `ref`, `priority`, `recordedAt`) and then a `dependency-edge` event (payload `edges`, `added`, `removed`) it can act on | TC-EVT-020, TC-EVT-021, TC-EVT-023 | Covered |
| AC-F3-3 | A re-written dependency record with an identical folded edge set publishes no `dependency-edge` event | TC-EVT-023 | Covered |
| AC-F3-4 | A lane reaching `delivering` emits `started` (`ref`, `spawnOrdinal`, `recordedAt`), a refused attempt emits `refused` (`attemptId`, `token`, `startedAt`, `finishedAt`, `evidenceRefs`), and any other outcome emits `completed` whose payload `outcome` names what happened | TC-EVT-024 | Covered |
| AC-F3-5 | The first `complete` for a phase emits `began` then `completed` on the same lane with ascending sequence; a later `complete` emits only `completed`; a `reopen` emits `reopened` with its reason | TC-EVT-025 | Covered |
| AC-F3-6 | A published question emits `published`, a recorded answer emits `updated` with its resume mode, and a consumed answer's `resumeIntent` emits `cleared` naming question, lane, and resume mode — each exactly once per source record | TC-EVT-026 | Covered |
| AC-F3-7 | No `remove` event is emitted by any v1 path, the surface reports `emitted: false`, and the emitted kind set per topic equals the declared set minus the declared non-emitted kinds | TC-EVT-027 | Covered |
| AC-F4-1 | For one lane, received `sequence` values are strictly increasing with no gap, and two subscribers of the same topic receive the same `sequence` for the same event | TC-EVT-030, TC-EVT-020 | Covered |
| AC-F4-2 | Two lanes' sequences are independent with no cross-lane or cross-topic order asserted; a gap or any value at or below the last observed value routes the client to a repoll and no order is inferred from `occurredAt` or a cursor | TC-EVT-031 | Covered — substitute (AMB-T1) |
| AC-F4-3 | A restart-produced sequence at or below the last observed value is a detected discontinuity answered with a repoll, and the ordering declaration documents the per-lane scope and the restart discontinuity | TC-EVT-032 | Covered — substitute (AMB-T2) |
| AC-F5-1 | Per topic, an overflowing subscription receives exactly one `degraded` event carrying `subscriber-overflow`, `overflow: "repoll"`, and `taxonomyVersion: "v1"`, is the only subscription removed, every other subscription keeps receiving, and the client's next action is a repoll | TC-EVT-040 | Covered — substitute for the client half (AMB-T3) |
| AC-F5-2 | Every topic's declared `overflow` is `repoll` and equals the value on that topic's degraded frame, both from one declaration constant | TC-EVT-041, TC-EVT-040 | Covered |
| AC-F5-3 | Exceeding the subscription capacity bound is still refused with `daemon.subscriber-degraded` under the same single bound, with no new key, marker, or vocabulary value | TC-EVT-042 | Covered |
| AC-F6-1 | `queue`/`lanes` frames are exactly `{topic, cursor, snapshot}`, the baseline carries `cursor: 0`, the cursor advances only on change, and the delivered snapshot expectation set passes unchanged | TC-EVT-050 | Covered |
| AC-F6-2 | A snapshot topic's record declares `shape: snapshot`, exactly the one `snapshot` kind, the frame `["topic","cursor","snapshot"]`, and `ordering: snapshot-revision`, with no per-lane sequence claim | TC-EVT-051 | Covered |
| AC-F7-1 | `events` is prompt-required (19 members), the production composer supplies the runtime, selection completes without the containment throw, and `events list` reaches its handler composing no store/config/transport/supervisor input | TC-EVT-060, TC-EVT-064 | Covered |
| AC-F7-2 | Root `--help` lists nineteen families including `events`; `events --help` exits `0` with usage, options, examples, exit codes, and a see-also to the M2 page; both verb `--help` forms exit `0` | TC-EVT-061, TC-EVT-064 | Covered |
| AC-F7-3 | The coverage check reports zero failures (page exists, has `--help` and `--version`, is in `commands` and `referencePages`, resolves through the `events` page root) and reference-page parity holds | TC-EVT-062, TC-EVT-064 | Covered |
| AC-F7-4 | Prompt conformance and help checks pass; the file-set inventory and v1 contract inventory equal the tree in both directions with the new modules/exports; executable-export allowances name the new files | TC-EVT-063, TC-EVT-064 | Covered |
| AC-F8-1 | Wire types, frame kinds, degraded reasons, stop modes, protocol version/floor, and the buffer bound are unchanged; `CONTROL_TOPICS` has six members; no frame carries a field outside `data` that delivered frames did not | TC-EVT-070, TC-EVT-042, TC-EVT-075 | Covered |
| AC-F8-2 | A v1 peer that ignores unknown `data` fields decodes an event frame and a degraded frame carrying the additive fields, routes the frame as an event, and keeps its existing handling | TC-EVT-071 | Covered — substitute (AMB-T3b) |
| AC-F8-3 | The new `events` kind carries exactly three rows with the declared classes/exits, no existing row is added, removed, or reworded, the documented table matches the code both ways, and every path exits only `0`/`1`/`2` | TC-EVT-072, TC-EVT-014, TC-EVT-075 | Covered |
| AC-F8-4 | `STATE_SCHEMA_VERSION` is unchanged, no record kind/payload schema/key prefix/migration/seed is added, and the taxonomy projects existing records only | TC-EVT-073, TC-EVT-074 | Covered |
| AC-NFR-1 | Any `events` invocation performs no state/config/git/network/filesystem read, writes nothing, invokes no composer, and returns within the reference-surface latency budget | TC-EVT-080, TC-EVT-015 | Covered |
| AC-NFR-2 | A publish tick performs at most one bounded read per source ledger, opens no socket, probes no process, takes no sleep, and adds at most the declared p95 latency over the delivered tick | TC-EVT-081 | Covered |
| AC-NFR-3 | A burst emits at most the per-topic per-tick cap, keeps the remainder pending via a per-lane watermark, drops nothing, and creates no unbounded in-memory event queue | TC-EVT-082 | Covered — substitute for the bounded-state half (AMB-T3c) |
| AC-NFR-4 | Every event frame is at or below the frame bound, and a payload cut by the bound sets `truncated: true` with `truncationReason: "frame-max-bytes"` rather than being silently shortened | TC-EVT-083, TC-EVT-071 | Covered |
| AC-NFR-5 | No new output, frame, or payload carries a credential, token, prompt, transcript, diff, or repository content; `repositoryRoot` never appears; evidence is identifiers, counts, closed values, or bounded text | TC-EVT-084 | Covered |

**Capability coverage** (every F-# has at least one TC): F-1 → 001, 002, 003, 004, 005, 006; F-2 → 010, 011, 012, 013, 014, 015, 016, 075; F-3 → 020, 021, 022, 023, 024, 025, 026, 027; F-4 → 020, 021, 030, 031, 032; F-5 → 040, 041, 042; F-6 → 050, 051; F-7 → 060, 061, 062, 063, 064; F-8 → 070, 071, 072, 073, 074, 075.

**Decision coverage**: DEC-A → 002, 027; DEC-B → 001, 002, 050, 051; DEC-C → 040, 041, 042; DEC-D → 020, 022, 030, 031, 032; DEC-E → 003, 006, 011, 022; DEC-F → 060, 061, 062, 063, 064; DEC-G → 011, 022, 032; DEC-H → 020, 075; DEC-I → 030, 032; DEC-J → 025, 027, 016; DEC-K → 001, 011, 016; DEC-L → 014, 075; DEC-M → 004, 014. **Ticket-scenario coverage**: SC-M2-S13-01 → 020, 021, 030; SC-M2-S13-02 → 040, 041.

### 3.2 Interface Coverage (API-#, EVT-#, DM-#)

The specification declares no REST/HTTP endpoint (API-#), no new listener, and no new record. The interface surface is the two mounted commands, five frame/degradation contracts over the delivered control protocol, and the declared data model.

| Element | TC ID(s) | Observable assertion |
|---|---|---|
| EVT-1 Event-topic frame | 020, 021, 022, 023, 024, 025, 026, 030, 031, 040, 070, 071, 083 | `type: frame`, `kind: event`, `data` keys exactly `topic, kind, lane, ref, sequence, occurredAt, payload, taxonomyVersion` in order; `kind` in the topic's set; `lane` present (nullable); `sequence` positive integer; `occurredAt` the source record's ISO-8601 UTC timestamp; payload keys within the kind's declared list; no `cursor`. |
| EVT-2 Degraded frame | 040, 041, 050, 070, 071, 075 | Exactly one frame per overflowing subscription; `degraded: "subscriber-overflow"` and the closed reason vocabulary unchanged; `data` additionally carries `overflow: "repoll"` and `taxonomyVersion: "v1"` for all six topics; only that subscription is dropped; `daemon.subscriber-degraded` still refuses an over-capacity subscribe. |
| EVT-3 Snapshot frame | 050, 051, 040 | Byte-identical `{ topic, cursor, snapshot }` on `queue`/`lanes`; baseline `cursor: 0`; change-only cursor advancement; no envelope field; the degraded frame's two additive fields are the only snapshot-topic delta. |
| EVT-4 Consumed durable records (unchanged) | 020, 023, 024, 025, 026, 027, 073 | Every emitted kind maps to exactly one of `queue.entry`, `queue.dependency`, `queue.lease`, `daemon.lane`, `dispatch.attempt`, `phase.transition`, `blocker.question`, `blocker.answer`, and the delivering lane's `resumeIntent`; no field, vocabulary, schema, or key prefix changes. |
| EVT-5 No new record, capsule event, outbox effect, or telemetry | 073, 074, 081 | No record is appended by the taxonomy; no `events.jsonl` capsule event kind is added; no command receipt, metric, trace, or log is added; the projection writes nothing. |
| DM-1 Taxonomy declaration | 001, 002, 003, 004, 005, 006, 016 | Runtime-neutral data: a version constant, the closed six-topic set, one record per topic with `name, version, shape, parent?, frame[], lane, kinds[], payloadFields[], ordering, overflow`; types and `as const` data only — the ambient-globals/scan checks find no clock, I/O, environment, or call expression. |
| DM-2 Event frame data | 020, 022, 030, 071, 083 | Eight fields in declared order inside the delivered open `data`; `taxonomyVersion` outside `payload`; the seven contract fields carry the change; no new top-level frame field. |
| DM-3 Snapshot frame data (unchanged) | 050, 051 | Exactly `{ topic, cursor, snapshot? }` for `queue` and `lanes`; the envelope is absent. |
| DM-4 Degraded frame data | 040, 041, 042, 050 | Delivered `{ degraded, topic? }` plus `overflow: "repoll"` and `taxonomyVersion: "v1"`; the marker and drop behaviour unchanged; the bound is still the single `daemon.subscription-buffer`. |
| DM-5 Sequence semantics | 020, 030, 031, 032, 082 | Allocated once per emitted event per `(topic, lane)`; positive; increments by exactly one; shared across subscribers of the topic; process-scoped with a restart discontinuity; not durable, not persisted, not seeded from a ledger (a populated store baselines rather than replays). |
| DM-6 Topic-set widening | 001, 070, 075, 060 | `CONTROL_TOPICS` has the six declared members; the event body union gains the envelope member; the subscribe accept tolerates a topic with no snapshot; no wire type, codec rule, or protocol version changes. |
| DM-7 Events envelope and topic record | 010, 011, 012, 013, 014, 016, 062 | `{ ok, command, data: { taxonomyVersion, envelope[], topics[] }, error?, warnings? }`; per-topic keys exactly as declared; closed `shape`/`lane`/`ordering`/`overflow` values; `kinds[]` elements carry `name`, `emitted`, `payloadFields[]`. |
| DM-8 No state-schema change | 073, 074 | `STATE_SCHEMA_VERSION` unchanged; no record kind, payload schema, key prefix, migration, backfill, or seed; the only contract addition outside the taxonomy is three error rows. |
| Appendix D exit matrix | 004, 010, 011, 012, 013, 014, 060, 061, 072, 075 | Every outcome resolves to exactly one identity and one exit digit; `events.topic-unknown`/`events.verb-unknown` → `1` (`user-validation`), `events.taxonomy-unavailable` → `2` (`platform-provider`); no other digit is reachable from the mounted surface; a control error frame carries no exit digit. |
| Appendix E source map | 020, 023, 024, 025, 026, 027 | Each kind is produced by exactly the declared durable record, `began` by the first `complete` observation, and `remove` by no v1 path. |
| Appendix F frame matrix | 022, 050, 051, 040 | Snapshot topics carry three `data` fields and `snapshot-revision`; event topics carry the eight fields and `sequence-per-lane`; the degraded frame carries the two additive fields on any topic. |

### 3.3 Non-Functional Coverage (NFR-#)

| NFR ID | Requirement (threshold) | TC ID(s) | Status |
|---|---|---|---|
| NFR-1 | Reference-surface purity: 0 state/config/git/network/filesystem reads, 0 writes, 0 composer invocations; p95 ≤ 100 ms; ≤ 40 lines and ≤ 8 192 bytes | TC-EVT-080, TC-EVT-015, TC-EVT-010, TC-EVT-012 | Covered |
| NFR-2 | Publish-tick cost: ≤ 1 bounded read per source ledger per tick, 0 socket connects, 0 process probes, 0 sleeps; added p95 tick latency ≤ 25 ms over the delivered tick | TC-EVT-081 | Covered |
| NFR-3 | Burst handling, no silent loss: ≤ 64 events per topic per tick; the remainder stays pending via a per-`(topic, lane)` watermark; 0 dropped; 0 unbounded in-memory event queues | TC-EVT-082, TC-EVT-023 | Covered — substitute (AMB-T3c) |
| NFR-4 | Envelope conformance: 100% of emitted events carry all eight fields; `lane` never absent; `kind` always in its topic's declared set | TC-EVT-022, TC-EVT-020, TC-EVT-021, TC-EVT-030 | Covered |
| NFR-5 | Frame bound: every event frame ≤ `DAEMON_MAX_FRAME_BYTES`; a cut payload sets `truncated: true` with `truncationReason: "frame-max-bytes"`; nothing silently shortened | TC-EVT-083, TC-EVT-071 | Covered |
| NFR-6 | Ordering determinism: 0 non-monotonic values per `(topic, lane)` within one incarnation; 100% of discontinuities route to a repoll; 0 orderings inferred from `occurredAt` or `cursor` | TC-EVT-030, TC-EVT-031, TC-EVT-032 | Covered |
| NFR-7 | Overflow parity for each of the six topics: one degraded event, that subscription gone, other subscriptions still receiving, `overflow == "repoll"` on frame and record | TC-EVT-040, TC-EVT-041, TC-EVT-042 | Covered |
| NFR-8 | Additivity: 0 new wire types, 0 new state record kinds, 0 payload schema versions, 0 migrations, 0 new package dependencies, 3 new error rows and 0 changed existing rows | TC-EVT-070, TC-EVT-072, TC-EVT-073, TC-EVT-074 | Covered |
| NFR-9 | Non-blocking publication: no publish path awaits a subscriber write; a stopped reader cannot delay the tick or another subscription beyond its own buffer | TC-EVT-040, TC-EVT-081 | Covered |
| NFR-10 | Privacy and content safety: no credential, token, prompt, transcript, diff, or repository content; bounded identifiers/counts/closed values/caps; `repositoryRoot` never projected | TC-EVT-084 | Covered |

### 3.4 Coverage-Matrix Integrity

| Check | Value | Verdict |
|---|---|---|
| Acceptance criteria in the specification | 38 (33 capability + 5 non-functional) | — |
| Acceptance criteria with at least one case | 38 | Pass |
| Acceptance criteria uncovered / TODO | 0 | Pass |
| Cases in this plan | 45 (`TC-EVT-001`..`TC-EVT-084`, block-structured) | — |
| Cases naming at least one AC (no orphans) | 45 | Pass |
| Cases that are manual-only | 0 | Pass |
| Cases with a substitute assertion recorded (§3.5) | 5 criteria / 5 cases | Declared |
| AC → TC direction present | §3.1 | Pass |
| TC → AC direction present | §5.1 index and every §5.2 header | Pass |
| Cases appearing in the Automation Plan (§7) | 45 of 45 | Pass |
| Response-type / structural / behavioural / guard distribution (primary shape per case; six cases assert both a structural and a runtime half) | 15 structure/contract, 22 behaviour/integration, 3 guard/checks, 5 bounds-and-privacy | Pass |

### 3.5 Declared gaps, boundaries, and substitute assertions

| ID | What is asserted, and how | Cases | AC |
|---|---|---|---|
| **DECL-G1 — `queue.graph.remove` is declared and never emitted** | (i) the surface reports the kind with `emitted: false` and a non-empty payload list `ref, reason, recordedAt`; (ii) a full-delivery fixture (entry, dependency add/change, lease release, lane delivering, refused/completed attempts, phase complete/reopen, blocker cycle) emits no `remove` frame across many ticks; (iii) the emitted `(topic, kind)` set equals the declared set minus the one non-emitted kind, and every `emitted: true` kind appears at least once; (iv) a scan finds no projection branch producing `remove`. The declared `reason` vocabulary is asserted against the S15 list in the payload-field declaration, not by exercising an S15 path. | 016, 027 | AC-F2-5, AC-F3-7 |
| **DECL-G2 — `phase.state.began` is derived at the first `complete`** | One `complete` transition is appended for a phase whose projection has no prior `started`; the stream must contain `began` immediately followed by `completed`, same lane, ascending sequence, `began.payload` = `{changeRef, phaseId, timestamp}` taken from that transition; a second `complete` for the same phase produces only `completed`; `began` is emitted exactly once per phase for the whole stream; a `reopen` produces `reopened` with `reason`. No begin record is appended (record-count assertion). | 025 | AC-F3-5 |
| **S17 boundary — no stop/parked/resumed/park-edge shape exists in v1** | The declaration is token-scanned for `stop`, `parked`, `resumed`, and `park-edge` outside the closed vocabularies that legitimately contain `stop` as a *wire type* and `parked`/`preempted` as *lane states* (the scan runs over kind names and payload field names only); the M2 page's taxonomy section is scanned the same way; `TC-EVT-027` asserts the emitted set equals the declared set, so an undeclared shape cannot appear on the wire; `TC-EVT-031` asserts the stop mode vocabulary is unchanged and is not a kind. | 002, 027, 070 | AC-F1-2, AC-F3-7, AC-F8-1 |
| **AMB-T1 — AC-F4-2's "the client's declared action is a repoll"** | The server cannot observe a consumer's next action. **Substitute:** (i) two lanes' sequence series are independent and start at 1; (ii) the ordering declaration is `sequence-per-lane` on every event topic; (iii) the reference page's ordering section contains the gap→repoll rule (token assertion on `gap` and `repoll`); (iv) a source scan asserts no ordering comparator or sort on `occurredAt` and no use of `cursor` as an ordering key; (v) no frame carries both `sequence` and `cursor`. The client's reaction itself is documented, not executed. | 031 | AC-F4-2 |
| **AMB-T2 — AC-F4-3's "the subscriber detects the discontinuity and repolls"** | **Substitute:** a second incarnation over the same populated store emits `sequence: 1` for a lane whose previous incarnation reached `N > 1`, and `1 ≤ N` is asserted directly (the declared discontinuity predicate); the page's ordering section names the restart discontinuity and the repoll remedy; the projection is asserted not to seed counters from the ledger (a populated store baselines and the first observed change starts at 1). Detection by a live client is a client-side property. | 032 | AC-F4-3 |
| **AMB-T3 — AC-F5-1's "the client's next action is a repoll"** | **Substitute:** the degraded frame carries `overflow: "repoll"` and `taxonomyVersion: "v1"` (the instruction a client reads), the reference record declares the same value, and the frame/record are proven to render from one constant (`TC-EVT-041`). | 040 | AC-F5-1 |
| **AMB-T3b — AC-F8-2's "a v0 peer"** | No v0 binary exists in the tree. **Substitute:** the delivered codec (the v1 peer implementation) decodes an event frame and a degraded frame carrying the additive fields, routes the event, and keeps every delivered negative control (exactly-one-of `payload`/`data`/`error`, no `id` on events) intact; the additive fields live only inside `data`, and a synthetic extra `data` field also decodes, which is the wire property a v0 peer relies on. | 071 | AC-F8-2 |
| **AMB-T3c — AC-NFR-3's "no unbounded in-memory event queue"** | **Substitute:** the burst case asserts the observable cap and the pending remainder are emitted on later ticks with contiguous sequences and zero loss; the bounded-state half is asserted structurally — pending state is keyed per `(topic, lane)` (entry count ≤ number of lanes) and the projection module contains no array that accumulates events across ticks (source scan plus an injected inspector when the delivery exposes one). Memory growth over ticks is not measured in bytes. | 082 | AC-NFR-3 |

## 4. Test Types and Layers

- **Unit / structure (contract-level), `bun:test` under `tests/structure/`** — declaration shape and closed values, drift comparators, integrity validator, single-source mutation, control-vocabulary equality, state-layer and dependency additivity, production composition membership, ordering declaration. No I/O; imports the declaration and the pure comparators directly.
- **Contract / conformance, `bun:test` under `tests/checks/` and `tests/golden/`** — help coverage, reference-page parity, prompt conformance, error-table sync, exit-code literals, inventory both-directions, exports parity, page token scans, goldens for the text pages and snapshot frames. These are the guards that fail in both directions when the mount or the contract is incomplete.
- **Behaviour (integration over the delivered seams), `bun:test` under `tests/behaviour/`** — the reference commands over the composition; the event topics observed through the real `createControlServer` + `createControlSession` over a real temp store, with the in-memory transport pair (and one real unix socket variant); overflow at a small bounded buffer; snapshot preservation; restart. This is where the ticket's three acceptance criteria are proven.
- **Measured NFR, `bun:test` with recording counters and `performance.now()`** — purity counters, per-ledger read counts, connect/probe/sleep counters, p50/p95 measurements against a same-run baseline, frame sizes, and the burst cap. Measurements are printed with the environment and iteration count.
- **Not used:** `mock.module`-style substitution of the modules under test, real network, real `sleep`, real `$HOME`/state directory, and any test that writes the live tree. Fakes are injected ports (clock, transport pair, recording edge, manual wake) — never a mock of the projection, the session, the server, or the codec.

## 5. Test Scenarios

TC IDs use the `EVT` feature prefix and follow the capability blocks of the specification: `001`–`006` declaration, drift, and single-source; `010`–`016` reference surface; `020`–`027` envelope and emission; `030`–`032` ordering; `040`–`042` overflow; `050`–`051` snapshot preservation; `060`–`064` mount and guards; `070`–`075` additivity and error table; `080`–`084` measured NFRs. A new sequence appends at the end of its block; an ID is never reused for a different scenario.

### 5.1 Scenario Index

| TC ID | Title | Type | Impact | Priority | AC / NFR |
|---|---|---|---|---|---|
| TC-EVT-001 | The declared topic set is exactly six, `status` is absent, and `queue.graph` is the only child topic | Happy Path | Critical | High | AC-F1-1; F-1; DM-1; NFR-8 |
| TC-EVT-002 | Every topic's kind set is exact and no S17 kind is declared | Happy Path | Critical | Critical | AC-F1-2; F-1, F-3; DM-1; NFR-8 |
| TC-EVT-003 | Each of the five drift classes fails a named per-topic assertion that names the item | Negative | Critical | Critical | AC-F1-3, AC-F1-5; F-1; NFR-6, NFR-7 |
| TC-EVT-004 | A malformed declaration fails integrity and yields `events.taxonomy-unavailable` at exit `2` with no page | Negative | Critical | Critical | AC-F1-4; F-1, F-2; NFR-8; DEC-M |
| TC-EVT-005 | An added v1 payload field decodes, is tolerated, and is not auto-advertised | Edge Case | Important | High | AC-F1-5; F-1, F-8; NFR-8 |
| TC-EVT-006 | One declaration drives both the surface record and the emitted frame | Happy Path | Critical | Critical | AC-F1-3, AC-F2-1, AC-F3-1; F-1..F-3; DM-1, DM-7; DEC-E |
| TC-EVT-010 | `events list` renders the six-topic table in the declared grammar and within the human bounds | Happy Path | Critical | High | AC-F2-1, AC-F2-2; F-2; NFR-1 |
| TC-EVT-011 | `events list --json` carries the version, the eight-field envelope, and six records equal to the declaration | Happy Path | Critical | Critical | AC-F2-1, AC-F2-4; F-2; DM-7; NFR-1 |
| TC-EVT-012 | `events describe <topic>` names shape, emitted kinds, payload fields, lane, ordering, overflow, and frame | Happy Path | Critical | High | AC-F2-2; F-2; DM-7; NFR-1, NFR-5 |
| TC-EVT-013 | `events describe <topic> --json` returns exactly that one topic record, identical to its `list` element | Happy Path | Critical | High | AC-F2-2, AC-F2-1; F-2; DM-7 |
| TC-EVT-014 | The surface's error identities and the `{0,1,2}` exit matrix hold on every path | Negative | Critical | Critical | AC-F2-3, AC-F1-4, AC-F8-3; F-2, F-8; Appendix D; NFR-1 |
| TC-EVT-015 | Every reference invocation is pure: no read, no write, no composer | Negative | Critical | Critical | AC-F2-4, AC-NFR-1; F-2; NFR-1 |
| TC-EVT-016 | `queue.graph` kind records carry non-empty payload lists, `remove` alone is unemitted, and the union is derived | Happy Path | Critical | High | AC-F2-5, AC-F1-2; F-2, F-3; DM-7; DEC-J |
| TC-EVT-020 | A `queue.graph` subscriber observes `entry` then `dependency-edge` through the real session/server, with the envelope and per-lane sequence | Happy Path | Critical | Critical | AC-F3-1, AC-F3-2, AC-F4-1; F-3, F-4; DM-2, DM-5; EVT-1; NFR-4 |
| TC-EVT-021 | **Integration-marked**: the same observation over a real unix socket under a temp state directory | Happy Path | Important | Medium | AC-F3-1, AC-F3-2; F-3; EVT-1; NFR-4 |
| TC-EVT-022 | Every emitted frame on all four event topics carries exactly the eight declared fields, with `lane` nullable and no `cursor` | Happy Path | Critical | Critical | AC-F3-1; F-3; DM-2; EVT-1; NFR-4 |
| TC-EVT-023 | A dependency delta emits `added`/`removed`; an identical folded edge set emits nothing | Corner Case | Critical | High | AC-F3-3, AC-F3-2; F-3; DM-2; NFR-3 |
| TC-EVT-024 | Dispatch emits `started`, `refused` for a refusal, and `completed` for every other outcome with its `outcome` named | Happy Path | Critical | High | AC-F3-4; F-3; DM-2; EVT-4; NFR-4 |
| TC-EVT-025 | Phase emits `began` (derived once) then `completed`, and `reopened` carries its reason | Happy Path | Critical | Critical | AC-F3-5; F-3; DM-2; DEC-J; NFR-4 |
| TC-EVT-026 | Blockers emit `published`, `updated`, then `cleared`, once per source record, with the lane named on `cleared` | Happy Path | Critical | High | AC-F3-6; F-3; DM-2; EVT-4; NFR-4 |
| TC-EVT-027 | `remove` is never emitted and the emitted kind set equals the declared set minus non-emitted kinds | Negative | Critical | Critical | AC-F3-7, AC-F1-2; F-3, F-1; DEC-A, DEC-J; NFR-8 |
| TC-EVT-030 | Two subscribers of one topic agree on every `sequence`, and one lane's series has no gaps | Happy Path | Critical | Critical | AC-F4-1; F-4; DM-5; NFR-4, NFR-6 |
| TC-EVT-031 | Lanes and topics are independent, and no order is inferred from `occurredAt` or `cursor` | Corner Case | Critical | High | AC-F4-2; F-4; DM-5; NFR-6; AMB-T1 |
| TC-EVT-032 | A second daemon incarnation over the same store restarts the counter, and the declaration documents the discontinuity | Regression | Critical | Critical | AC-F4-3; F-4; DM-5; NFR-6; AMB-T2 |
| TC-EVT-040 | For each of the six topics, overflow yields exactly one stamped degraded frame, drops only that subscription, and spares the rest | Negative | Critical | Critical | AC-F5-1, AC-F5-2; F-5; DM-4; EVT-2; NFR-7, NFR-9 |
| TC-EVT-041 | The declared `overflow` and the frame's `overflow` come from one constant and cannot disagree | Corner Case | Critical | Critical | AC-F5-2; F-5; DM-4; DEC-C; NFR-7 |
| TC-EVT-042 | The subscription capacity bound and the `daemon.subscriber-degraded` refusal are unchanged | Regression | Critical | High | AC-F5-3, AC-F8-1; F-5, F-8; DM-4; NFR-7 |
| TC-EVT-050 | `queue` and `lanes` frames stay byte-identical, baseline at `cursor: 0`, and change-only | Regression | Critical | Critical | AC-F6-1; F-6; DM-3; EVT-3 |
| TC-EVT-051 | Snapshot topic records declare the snapshot shape, the single kind, the three-field frame, and snapshot-revision ordering | Happy Path | Critical | High | AC-F6-2; F-6; DM-7; EVT-3 |
| TC-EVT-060 | `events` is prompt-required (19), composed unconditionally with no runtime input, and reaches its handler | Happy Path | Critical | Critical | AC-F7-1; F-7; DM-6; DEC-F |
| TC-EVT-061 | Root help lists nineteen families, the family page renders five sections, and both verb pages answer `--help` | Happy Path | Critical | High | AC-F7-2; F-7; NFR-1 |
| TC-EVT-062 | Help coverage and reference-page parity pass with the M2 page, both inventory rows, and the page root | Happy Path | Critical | Critical | AC-F7-3; F-7; DM-7; DEC-F |
| TC-EVT-063 | Prompt conformance, the file-set inventory, the v1 contract inventory, and the export allowances equal the tree | Happy Path | Critical | High | AC-F7-4; F-7, F-8; NFR-8 |
| TC-EVT-064 | Removing any one mount piece trips a named guard (negative controls for all six pieces and both inventories) | Negative | Critical | Critical | AC-F7-1, AC-F7-2, AC-F7-3, AC-F7-4; F-7; DEC-F |
| TC-EVT-070 | The wire-type, frame-kind, degraded-reason, stop-mode, protocol, and buffer vocabularies are unchanged; `CONTROL_TOPICS` has six | Regression | Critical | Critical | AC-F8-1; F-8; DM-6; NFR-8 |
| TC-EVT-071 | A v1 peer decodes the envelope and the stamped degraded frame, keeps its negative controls, and tolerates extra `data` fields | Happy Path | Critical | High | AC-F8-2, AC-NFR-4; F-8; DM-2, DM-4; EVT-1, EVT-2; NFR-4, NFR-5; AMB-T3b |
| TC-EVT-072 | The error table has exactly three new rows in one `events` kind, no row changed, and the documented table matches both ways | Happy Path | Critical | Critical | AC-F8-3; F-8; NFR-8; Appendix D |
| TC-EVT-073 | The state schema, record kinds, payload schemas, key prefixes, and migrations are unchanged | Regression | Critical | High | AC-F8-4; F-8; DM-8; NFR-8 |
| TC-EVT-074 | The additivity inventory holds: no new wire type, record kind, schema version, migration, dependency, or capsule event | Regression | Critical | High | AC-F8-4; F-8; EVT-5; NFR-8 |
| TC-EVT-075 | An unknown subscribe topic is refused as `events.topic-unknown` (never `daemon.state-recovery-failed`), a known event topic is accepted with no synthetic baseline, and `since` is ignored | Negative | Critical | Critical | AC-F2-3, AC-F8-1, AC-F8-3; F-8; DM-6; DEC-H, DEC-L |
| TC-EVT-080 | The reference surface stays pure and inside its latency and output budgets | Happy Path | Important | High | AC-NFR-1, AC-F2-4; NFR-1; GAP-T4 |
| TC-EVT-081 | A publish tick reads each ledger at most once, opens no socket, probes no process, sleeps zero times, and stays inside its added-latency budget | Happy Path | Important | High | AC-NFR-2; NFR-2, NFR-9; GAP-T4 |
| TC-EVT-082 | A burst above the per-tick cap emits the cap, keeps the remainder pending, loses nothing, and keeps bounded state | Corner Case | Critical | High | AC-NFR-3; NFR-3; AMB-T3c |
| TC-EVT-083 | Every event frame respects the frame bound and an over-bound payload is truncated with the declared marker | Edge Case | Critical | High | AC-NFR-4; NFR-5; DM-2 |
| TC-EVT-084 | No payload, page, or error carries a credential, token, prompt, transcript, diff, repository content, or `repositoryRoot` | Negative | Critical | Critical | AC-NFR-5; NFR-10; NFR-4 |

### 5.2 Scenario Details

#### TC-EVT-001 - The declared topic set is exactly six, `status` is absent, and `queue.graph` is the only child topic

**Objective**: Prove the closed topic set and the per-topic required keys by exact equality, so a seventh topic, a missing topic, or a `status` topic fails.
**Scenario Type**: Happy Path
**Impact Level**: Critical
**Priority**: High
**Related IDs**: AC-F1-1, F-1, DM-1, NFR-8
**Test Type(s)**: Unit, Contract
**Automation Level**: Automated
**Target Layer / Location**: `tests/structure/event-taxonomy-declaration.test.ts` (new); `packages/core/src/contracts/taxonomy.ts` (new, re-exported from the contract index)
**Harness entry**: `bun test tests/structure/event-taxonomy-declaration.test.ts` — imports `TAXONOMY` (declaration), `CONTROL_TOPICS`, and the contract index re-export.
**Tags**: @backend, @contract

**Preconditions / fixture**:
- The declaration is the shipped compiled constant; no injection is needed for this case.
- The contract index re-exports the declaration (asserted in `TC-EVT-063`).

**Steps**:
1. Read `TAXONOMY.topics` and assert `map(name)` equals `["queue","lanes","queue.graph","dispatch.attempt","phase.state","blockers.state"]` exactly (same members, same declared order), with `length === 6`.
2. Assert `TAXONOMY.topics.every((t) => t.name !== "status")` and that no topic record is named `status`; assert `TAXONOMY.version === "v1"` and every topic's `version === "v1"`.
3. Assert exactly one topic has a `parent`: `queue.graph`, value `queue`; every other topic's `parent` is absent/undefined.
4. For every topic assert `shape ∈ {"snapshot","event"}`, `frame` is a non-empty ordered array of known field names, `lane ∈ {"none","ref","change-ref","blocker-lane"}`, `ordering ∈ {"sequence-per-lane","snapshot-revision"}`, `overflow === "repoll"`, and `kinds` is a non-empty array whose elements each carry `name` (non-empty string), `emitted` (boolean), and `payloadFields` (array).
5. Assert `CONTROL_TOPICS` deep-equals the declared topic names (surface set equals served set) and that no name appears twice.
6. Assert the declaration is data-only: the ambient-globals scan reports no call expression, clock, environment read, or I/O import reachable from the module.

**Expected Outcome**:
- The six-topic set, the single parent, the version, and the per-topic required keys hold by exact equality; `status` is not a topic; the served topic union and the declared set are identical.
- A seventh topic, a renamed topic, a `status` topic, a missing `frame`, or an out-of-vocabulary `shape`/`ordering`/`overflow` value fails with the offending topic named.

**Notes / Clarifications**:
- Ordering is asserted because the surface's text rows and `envelope[]` are order-bearing; a reordered declaration must fail rather than silently reorder a client's reading.

#### TC-EVT-002 - Every topic's kind set is exact and no S17 kind is declared

**Objective**: Pin the contract section's enumeration per topic and prove S17's shapes are absent, so a count taken from the planning page's example cannot pass.
**Scenario Type**: Happy Path
**Impact Level**: Critical
**Priority**: Critical
**Related IDs**: AC-F1-2, F-1, F-3, DM-1, NFR-8; DEC-A, DEC-J; RSK-1, RSK-7
**Test Type(s)**: Unit, Contract
**Automation Level**: Automated
**Target Layer / Location**: `tests/structure/event-taxonomy-declaration.test.ts` (new); `tests/checks/event-taxonomy-conformance.test.ts` (new, page token scan)
**Harness entry**: `bun test tests/structure/event-taxonomy-declaration.test.ts tests/checks/event-taxonomy-conformance.test.ts`
**Tags**: @backend, @contract, @docs

**Preconditions / fixture**:
- `tests/fixtures/events/taxonomy-cases.ts` (new) carries the contract-section enumeration as data, transcribed from `m2/contracts.md` §Event taxonomy v1, with a comment naming the source lines.

**Steps**:
1. Assert `queue.graph.kinds.map(name)` equals `["entry","dependency-edge","release","remove"]`; `dispatch.attempt` equals `["started","refused","completed"]`; `phase.state` equals `["began","completed","reopened"]`; `blockers.state` equals `["published","updated","cleared"]`.
2. Assert `queue.kinds` and `lanes.kinds` each equal `["snapshot"]` with a single record.
3. Assert the kind counts are exactly `4, 3, 3, 3` — the example counts `6` and `4` fail by construction; assert no topic has more than 4 kinds.
4. Recursively collect every kind name across the declaration and assert none of `stop`, `parked`, `resumed`, `park-edge` appears; the scan is restricted to kind names and payload field names, so the legitimate wire type `stop` and lane states `parked`/`preempted` are not false positives.
5. Run the same token scan over the taxonomy section of `doc/planning/oss-tooling/milestones/m2/commands/events.md` and assert the four names are absent and the printed counts are `1/1/4/3/3/3`.
6. Non-vacuity control: assert the reference page still exists and the scan actually visited at least one section (a non-zero line count), so a missing page fails rather than passes.

**Expected Outcome**:
- Each topic's declared kind set equals the contract enumeration, in declared order; the snapshot topics carry one kind each; no S17 kind is declared in code or described as a v1 kind on the page.
- Any kind addition, rename, removal, or reordering fails naming the topic and the kind.

**Notes / Clarifications**:
- This case is the mechanical half of DEC-A; the page's prose truth beyond the four forbidden names and the counts is review-attested (GAP-T6).

#### TC-EVT-003 - Each of the five drift classes fails a named per-topic assertion that names the item

**Objective**: Prove the pin is a comparison that localizes drift, not a claim: a single change to the version, a kind, a payload field, the ordering value, or the overflow value fails a named assertion naming the drifted item.
**Scenario Type**: Negative
**Impact Level**: Critical
**Priority**: Critical
**Related IDs**: AC-F1-3, AC-F1-5, F-1, NFR-6, NFR-7; DEC-E, RSK-9
**Test Type(s)**: Unit, Contract
**Automation Level**: Automated
**Target Layer / Location**: `tests/structure/event-taxonomy-drift.test.ts` (new); `tests/fixtures/events/drift-mutants.ts` (new)
**Harness entry**: `bun test tests/structure/event-taxonomy-drift.test.ts`
**Tags**: @backend, @contract, @mutation

**Preconditions / fixture**:
- `drift-mutants.ts` exports five declaration copies (deep-cloned and edited) plus the surface/frame comparator entry points used by production: `compareSurface`, `compareFrames` (delivery-bound names; the assertion is on the returned violation list / thrown message, not the spelling).
- The unmutated declaration is the baseline.

**Steps**:
1. Baseline: `compareSurface(TAXONOMY, renderSurface(TAXONOMY))` and `compareFrames(TAXONOMY, scriptedFrames(TAXONOMY))` return no violations for all six topics.
2. Version drift: set `queue.graph.version = "v2"` on the surface side only; assert the comparison reports exactly one violation whose text names `queue.graph`, `version`, and both values.
3. Kind drift: rename `phase.state.reopened` to `reopened-v2`; assert the violation names `phase.state`, `kind`, and the two values, and that the other three topics report nothing.
4. Payload-field drift: remove `token` from `dispatch.attempt.refused.payloadFields`; assert the violation names `dispatch.attempt`, `refused`, `payloadFields`, and `token`.
5. Ordering drift: change `blockers.state.ordering` to `snapshot-revision`; assert the violation names `blockers.state` and `ordering`.
6. Overflow drift: change `queue.overflow` to `drop`; assert the violation names `queue` and `overflow`, and that `drop` is rejected as an unknown closed value.
7. Assert each mutant trips exactly one topic's assertion set (localization), and that a payload-field drift is reported as a version-forcing change per DEC-E (the violation text carries the `version` implication flag).
8. Run each mutant in a temp copy only; assert the live declaration file's bytes are unchanged after the run.

**Expected Outcome**:
- Five drift classes, five named failures; the failing message identifies the topic and the drifted item; no drift yields no violations.
- The comparison runs per topic, so a drift never hides behind a whole-taxonomy aggregate.

**Notes / Clarifications**:
- "Fails a named test" is demonstrated by running the production comparator against a mutant, never by editing the shipped constant.

#### TC-EVT-004 - A malformed declaration fails integrity and yields `events.taxonomy-unavailable` at exit `2` with no page

**Objective**: Make DEC-M's fail-closed path real and reachable: each integrity violation is detected, and a failing declaration refuses with the documented identity at exit `2` without rendering a partial page.
**Scenario Type**: Negative
**Impact Level**: Critical
**Priority**: Critical
**Related IDs**: AC-F1-4, F-1, F-2, NFR-8; DEC-M; Appendix D
**Test Type(s)**: Unit, Contract
**Automation Level**: Automated
**Target Layer / Location**: `tests/structure/event-taxonomy-integrity.test.ts` (new); `tests/behaviour/events-errors.test.ts` (new)
**Harness entry**: `bun test tests/structure/event-taxonomy-integrity.test.ts tests/behaviour/events-errors.test.ts`
**Tags**: @backend, @contract, @errors

**Preconditions / fixture**:
- The integrity validator is a pure function over a declaration value (`validateTaxonomy(declaration)`); the mounted command accepts an injected declaration defaulting to the shipped one (the seam `TC-EVT-004` needs; GAP-T5).
- Six violation fixtures in `drift-mutants.ts`.

**Steps**:
1. Call the validator with each fixture and assert a violation naming the offending topic and field: duplicate topic names; an empty `kinds` list; a kind repeated within a topic; a kind whose `payloadFields` is absent or empty; an unknown `shape`, `ordering`, or `overflow` value; a `frame` missing a declared field.
2. Assert the shipped declaration validates with zero violations (positive control), so the validator is not vacuously strict.
3. Compose the `events` command with an injected invalid declaration; run `events list` and `events describe queue`; assert exit `2`, `error.code === "events.taxonomy-unavailable"`, `category === "platform"`, `retryable === false`, `consequence === "not_landed"`, and a remediation class of `platform-provider`.
4. Assert stdout carries no page: for the text form, no topic rows and no partial table; for `--json`, no `data.topics`.
5. Assert the failure path reads no store, configuration, network, or filesystem (recording counters zero) — the declaration is the only input.
6. Assert every listed violation class is reachable from the validator (six of six) and that a passing declaration renders the full page (control).

**Expected Outcome**:
- Each integrity violation fails the check by name; a failing declaration exits `2` with `events.taxonomy-unavailable`, platform class, non-retryable, `not_landed`, and renders nothing.
- No path can serve a page that under-describes the topics.

**Notes / Clarifications**:
- If delivery exposes no injectable declaration, this case must fail naming the missing seam rather than assert the shipped path only (GAP-T5); a validator called on a literal copy in the same process is the minimum acceptable seam.

#### TC-EVT-005 - An added v1 payload field decodes, is tolerated, and is not auto-advertised

**Objective**: Prove payload growth inside v1 is non-breaking on the wire while the declared field list stays the contract.
**Scenario Type**: Edge Case
**Impact Level**: Important
**Priority**: High
**Related IDs**: AC-F1-5, F-1, F-8, NFR-8; DEC-E, DC-5
**Test Type(s)**: Unit, Contract
**Automation Level**: Automated
**Target Layer / Location**: `tests/structure/event-taxonomy-additive.test.ts` (new); `tests/behaviour/events-decode-additive.test.ts` (new)
**Harness entry**: `bun test tests/structure/event-taxonomy-additive.test.ts tests/behaviour/events-decode-additive.test.ts`
**Tags**: @backend, @contract

**Preconditions / fixture**:
- A synthetic event frame for `queue.graph`/`entry` whose `payload` carries every declared field plus `futureField: "x"`.

**Steps**:
1. Encode and decode the synthetic frame with the delivered codec; assert decode succeeds and the frame routes as `kind: "event"`.
2. Assert the decoded `data` keeps the eight declared keys and that `payload.futureField` is not rejected.
3. Assert the surface's `payloadFields` for that kind equals the declaration and does **not** contain `futureField` — an added wire field is not auto-advertised as contract.
4. Assert the projection of a source record carrying an unknown extra property emits a payload whose keys are a subset of the declared field list (the projection is a field list, not a spread).
5. Assert that changing the declared `payloadFields` list trips the drift comparator as version-forcing (`TC-EVT-003` step 7), so "unchanged unless the version changed" is enforced rather than stated.
6. Assert a v1 peer's negative controls are untouched: a frame with zero or two of `payload`/`data`/`error` is still refused.

**Expected Outcome**:
- An added payload field decodes and is ignored; the declared list is unchanged; changing the declared list is flagged as a version change.
- No consumer must change when a payload field is added inside v1.

#### TC-EVT-006 - One declaration drives both the surface record and the emitted frame

**Objective**: Prove the single authored source: the surface record and the emitted frame both move when the declaration moves, and neither carries a private copy.
**Scenario Type**: Happy Path
**Impact Level**: Critical
**Priority**: Critical
**Related IDs**: AC-F1-3, AC-F2-1, AC-F3-1, F-1, F-2, F-3, DM-1, DM-7; DEC-E, RSK-9
**Test Type(s)**: Contract, Structure
**Automation Level**: Automated
**Target Layer / Location**: `tests/structure/event-taxonomy-single-source.test.ts` (new); `tests/checks/event-taxonomy-conformance.test.ts` (new)
**Harness entry**: `bun test tests/structure/event-taxonomy-single-source.test.ts tests/checks/event-taxonomy-conformance.test.ts`
**Tags**: @backend, @contract, @mutation

**Preconditions / fixture**:
- An injected declaration copy with one additive payload field added to `queue.graph.entry` (legal inside v1) and a second copy with `taxonomyVersion` set to `"v1-experiment"` (illegal inside v1, used only to observe propagation).

**Steps**:
1. Render the surface for `queue.graph` from the shipped declaration and from the additive copy; assert the record's `kinds[].payloadFields` for `entry` reflects the copy, with no second edit.
2. Project the same source record through the frame projection with each declaration; assert the emitted frame's `payload` carries the added field for the copy and not for the shipped declaration.
3. Assert the surface record's `kinds[]` for every topic is element-wise and order-wise equal to the declaration's `kinds[]` (name, `emitted`, `payloadFields`) — no reordering, no filtering.
4. Assert every emitted frame's `kind` is a member of its topic's declared set, for a scripted full-delivery stream.
5. Source scan: assert `packages/cli/src/commands/events.ts` and the event projection module import the declaration, and that no module outside `packages/core/src/contracts/taxonomy.ts` contains a literal array of three or more declared kind names (a regex over the declared names).
6. Assert the version-propagating copy changes both the surface `version` and every frame's `taxonomyVersion` together; a surface-only or frame-only version fails `TC-EVT-003`.

**Expected Outcome**:
- One declared mutation changes surface and frames together; no test can pass by editing one consumer.
- A hand-written surface (a second kind list) fails step 5, and a hand-written frame version fails `TC-EVT-003`.

**Notes / Clarifications**:
- The scan is the mechanical part; the "no other copy anywhere" claim is review-attested (GAP-T1).

#### TC-EVT-010 - `events list` renders the six-topic table in the declared grammar and within the human bounds

**Objective**: Pin the human grammar and row order of the reference list so a client scraping it (or a human reading it) sees a declared, bounded page.
**Scenario Type**: Happy Path
**Impact Level**: Critical
**Priority**: High
**Related IDs**: AC-F2-1, AC-F2-2, F-2, NFR-1
**Test Type(s)**: Behaviour, Golden
**Automation Level**: Automated
**Target Layer / Location**: `tests/behaviour/events-list.test.ts` (new); `tests/golden/events-reference-page.test.ts` (new); `packages/cli/src/commands/events.ts` (new)
**Harness entry**: `bun test tests/behaviour/events-list.test.ts tests/golden/events-reference-page.test.ts`
**Tags**: @ui, @cli, @golden

**Preconditions / fixture**:
- Synthetic brand rendering as `example-product`; no store, no configuration, no transport.
- A committed golden of the six-row page under `tests/fixtures/events/goldens/events-list.txt` (recorded once by an explicit command).

**Steps**:
1. Run `events list`; assert exit `0`.
2. Assert the output equals the golden byte-for-byte (including trailing newline) and that the golden was regenerated only by the documented command (the golden file carries its generation header).
3. Assert per-row grammar: `queue` and `lanes` match `^\S+\s+v1\s+shape=snapshot\s+kinds=1\s+ordered by snapshot revision\s+overflow=repoll$`; each event topic matches `^\S+\s+v1\s+shape=event\s+kinds=(4|3)\s+(parent=queue\s+)?ordered per lane\s+overflow=repoll$`; only `queue.graph` carries `parent=`.
4. Assert row order equals the declaration order and that `status` appears nowhere.
5. Assert the page contains no ANSI escape (no `\u001b[`), at most 40 lines, and at most 8 192 bytes.
6. Assert the command ran with zero composer invocations and zero store/config/transport reads.

**Expected Outcome**:
- Six rows, declared order, declared grammar, `parent=queue` only on `queue.graph`, `overflow=repoll` on every row, within the human bounds.
- A reordered topic, an added topic, a changed count, or a dropped `parent=` fails the golden or the per-row regex.

#### TC-EVT-011 - `events list --json` carries the version, the eight-field envelope, and six records equal to the declaration

**Objective**: Pin the machine contract of the list surface: version, envelope field order, and six topic records equal to the declaration.
**Scenario Type**: Happy Path
**Impact Level**: Critical
**Priority**: Critical
**Related IDs**: AC-F2-1, AC-F2-4, F-2, DM-7, NFR-1; DEC-K
**Test Type(s)**: Behaviour, Contract
**Automation Level**: Automated
**Target Layer / Location**: `tests/behaviour/events-list.test.ts` (new)
**Harness entry**: `bun test tests/behaviour/events-list.test.ts`
**Tags**: @api, @cli, @contract

**Preconditions / fixture**:
- The declaration projection helper used by the surface (`toTopicRecord`) and the expected records computed independently from `TAXONOMY` in the test.

**Steps**:
1. Run `events list --json`; assert exit `0`, `ok === true`, `command === "events list"`, and that no `error` key is present.
2. Assert `data.taxonomyVersion === "v1"` and `data.envelope` deep-equals `["topic","kind","lane","ref","sequence","occurredAt","payload","taxonomyVersion"]` (order asserted).
3. Assert `data.topics.length === 6` and deep-equal the expected projection, element by element, in declared order.
4. For every topic record assert the key set is exactly `{name,version,shape,frame,lane,kinds,payloadFields,ordering,overflow}` plus `parent` only on `queue.graph`; assert `frame` equals `["topic","cursor","snapshot"]` for snapshot topics and the eight-field list for event topics.
5. Assert `payloadFields` equals the union derived from that topic's `kinds[].payloadFields` (no topic-level authored copy), preserving first-seen order.
6. Assert the out-of-band bounds: ≤ 40 lines / 8 192 bytes when pretty-printed with `--pretty`, and zero reads/writes/composers.

**Expected Outcome**:
- The machine envelope is exactly the delivered shape with the declared `command` value, the pinned version, the ordered eight-field envelope, and six records equal to the declaration.
- A missing `parent`, a `parent` on a snapshot topic, an extra key, a wrong `frame`, or a hand-authored `payloadFields` union fails.

#### TC-EVT-012 - `events describe <topic>` names shape, emitted kinds, payload fields, lane, ordering, overflow, and frame

**Objective**: Prove a single topic's page answers every question a client must not infer, within the delivered human bounds.
**Scenario Type**: Happy Path
**Impact Level**: Critical
**Priority**: High
**Related IDs**: AC-F2-2, F-2, DM-7, NFR-1, NFR-5
**Test Type(s)**: Behaviour, Golden
**Automation Level**: Automated
**Target Layer / Location**: `tests/behaviour/events-describe.test.ts` (new); `tests/golden/events-reference-page.test.ts` (new)
**Harness entry**: `bun test tests/behaviour/events-describe.test.ts tests/golden/events-reference-page.test.ts`
**Tags**: @ui, @cli, @golden

**Preconditions / fixture**:
- Goldens for one representative event topic (`queue.graph`) and one snapshot topic (`lanes`) under `tests/fixtures/events/goldens/`.

**Steps**:
1. Run `events describe queue.graph`; assert exit `0` and byte-equality with the golden.
2. Assert the page names the topic, `shape=event`, and `parent=queue`.
3. Assert each of the four kinds appears with its `emitted` state, and that `remove` is the only row rendered as not emitted.
4. Assert each kind's payload field list appears verbatim in declared order, including the optional markers for `repository?` and `parkCause?`.
5. Assert the page names the lane rule (`ref`), the ordering sentence (per lane / `sequence-per-lane`), the overflow sentence (`repoll`), and the eight-field frame list in declared order.
6. Run `events describe lanes`; assert `shape=snapshot`, one kind `snapshot`, frame `["topic","cursor","snapshot"]`, `snapshot-revision` ordering, and that no per-lane sequence promise is stated.
7. Assert every page is ≤ 40 lines and ≤ 8 192 bytes and contains no ANSI escape.

**Expected Outcome**:
- The page is a complete, bounded reference for one topic: shape, kinds with emission state, payload fields, lane, ordering, overflow, frame.
- A kind rendered without its `emitted` state, a missing payload field, or a snapshot topic claiming per-lane ordering fails.

#### TC-EVT-013 - `events describe <topic> --json` returns exactly that one topic record, identical to its `list` element

**Objective**: Prove `describe` adds nothing to the machine shape and that the two verbs cannot disagree.
**Scenario Type**: Happy Path
**Impact Level**: Critical
**Priority**: High
**Related IDs**: AC-F2-2, AC-F2-1, F-2, DM-7
**Test Type(s)**: Contract
**Automation Level**: Automated
**Target Layer / Location**: `tests/behaviour/events-describe.test.ts` (new)
**Harness entry**: `bun test tests/behaviour/events-describe.test.ts`
**Tags**: @api, @cli, @contract

**Preconditions / fixture**:
- The `list --json` output captured in the same process.

**Steps**:
1. For each of the six topics, run `events describe <topic> --json`; assert exit `0`, `ok === true`, `command === "events describe"`.
2. Assert `data.topics.length === 1` and `data.taxonomyVersion === "v1"`.
3. Assert `data.envelope` deep-equals the `list` envelope (describe adds nothing).
4. Assert `data.topics[0]` deep-equals the corresponding element of `list`'s `data.topics`.
5. Assert `describe` for a snapshot topic returns the same record `list` returns (no verb-specific special case).
6. Assert no state, configuration, or transport input is read for any of the six invocations.

**Expected Outcome**:
- One topic record, identical to its list element; the machine shape is verb-independent.
- A `describe`-only field, a different version, or a diverging record fails.

#### TC-EVT-014 - The surface's error identities and the `{0,1,2}` exit matrix hold on every path

**Objective**: Pin the three error identities, their classes, and the exit digits; including the `status`-is-not-a-topic refusal and the absent/unknown verb refusals.
**Scenario Type**: Negative
**Impact Level**: Critical
**Priority**: Critical
**Related IDs**: AC-F2-3, AC-F1-4, AC-F8-3, F-2, F-8, Appendix D, NFR-1; DEC-L
**Test Type(s)**: Behaviour, Contract
**Automation Level**: Automated
**Target Layer / Location**: `tests/behaviour/events-errors.test.ts` (new)
**Harness entry**: `bun test tests/behaviour/events-errors.test.ts`
**Tags**: @cli, @errors, @contract

**Preconditions / fixture**:
- A decision table in `taxonomy-cases.ts` listing each invocation, expected identity, expected exit, and the expected detail fields.

**Steps**:
1. `events describe status` → exit `1`, `error.code === "events.topic-unknown"`, `category === "user"`, `retryable === false`, `consequence === "not_landed"`; the summary names `status` and the remediation lists all six declared names.
2. `events describe nope` → the same identity, naming `nope` and listing the six names.
3. `events describe` (no topic) and `events frobnicate` and `events` (no verb) → exit `1`, `error.code === "events.verb-unknown"`, naming `list` and `describe`; assert no `events.topic-unknown` for these.
4. `events list` and `events describe queue` → exit `0` with success `data` (the `0` row of the matrix).
5. An injected invalid declaration (from `TC-EVT-004`) → exit `2` with `events.taxonomy-unavailable` (the `2` row).
6. Assert every observed exit digit is in `{0,1,2}` and that no invocation produces a fourth digit or an unclassified error.
7. Assert the error paths read no state, configuration, or transport (recording counters zero), so a bad topic never touches a ledger.
8. Assert the error objects carry the delivered field set (`code`, `category`, `retryable`, `consequence`, `remediationHint`, `summary`) and no new field.

**Expected Outcome**:
- Three identities, three exit digits, one class each; a wrong topic names the topic and the six valid names; a wrong verb names only the verbs.
- Any path exiting `>2`, any missing/renamed identity, or any state read on a refusal fails.

#### TC-EVT-015 - Every reference invocation is pure: no read, no write, no composer

**Objective**: Prove the reference surface is a data rendering, so it can be mounted anywhere and cannot be the source of a hidden store dependency.
**Scenario Type**: Negative
**Impact Level**: Critical
**Priority**: Critical
**Related IDs**: AC-F2-4, AC-NFR-1, F-2, NFR-1
**Test Type(s)**: Behaviour, Checks
**Automation Level**: Automated
**Target Layer / Location**: `tests/behaviour/events-purity.test.ts` (new); `tests/checks/events-hermetic.test.ts` (new)
**Harness entry**: `bun test tests/behaviour/events-purity.test.ts tests/checks/events-hermetic.test.ts`
**Tags**: @backend, @purity, @hermetic

**Preconditions / fixture**:
- Recording counters around the state edge, the configuration resolver, the transport factory, the git adapter, and the filesystem (the delivered hermetic pattern in `tests/checks/daemon-hermetic.test.ts`).
- An armed guard that throws on `fetch`, `Bun.spawn`, `child_process`, and `node:fs` write functions for the duration of the invocations.

**Steps**:
1. For each of `events list`, `events list --json`, `events describe queue.graph`, `events describe queue.graph --json`, run the handler 20 times; assert every counter is zero after each.
2. Assert the armed guard never fired (no network, no spawn, no write) and that no file under the state directory was created or modified (directory listing before/after, including mtime).
3. Assert zero composer invocations (a counting composer injected into `runEntrypoint`).
4. Assert the process did not read `$HOME` or a state-directory variable: run with an empty environment record and assert identical output.
5. Assert output determinism: 20 runs produce byte-identical stdout for the same brand.

**Expected Outcome**:
- Zero reads, zero writes, zero composer invocations, zero network, byte-identical repeat output.
- Any lazy store/config read, any environment dependence, or any write fails on a counter, not on an impression.

**Notes / Clarifications**:
- "No filesystem read" is observed after module load; module-loading reads are outside the assertion window and declared in GAP-T3 terms.

#### TC-EVT-016 - `queue.graph` kind records carry non-empty payload lists, `remove` alone is unemitted, and the union is derived

**Objective**: Pin the per-kind payload detail and the derivation rule that keeps the topic-level union from becoming a second authored list.
**Scenario Type**: Happy Path
**Impact Level**: Critical
**Priority**: High
**Related IDs**: AC-F2-5, AC-F1-2, F-2, F-3, DM-7; DEC-J, DEC-K
**Test Type(s)**: Contract, Behaviour
**Automation Level**: Automated
**Target Layer / Location**: `tests/behaviour/events-describe.test.ts` (new); `tests/structure/event-taxonomy-single-source.test.ts` (new)
**Harness entry**: `bun test tests/behaviour/events-describe.test.ts tests/structure/event-taxonomy-single-source.test.ts`
**Tags**: @backend, @contract

**Preconditions / fixture**:
- The per-kind payload expectation table transcribed from §5.1 F-3 into `taxonomy-cases.ts`.

**Steps**:
1. `events describe queue.graph --json`: assert `kinds.length === 4`; every kind's `payloadFields` is a non-empty array; `emitted` is `true` for `entry`, `dependency-edge`, `release` and `false` for `remove` only.
2. Assert the per-kind lists: `entry` = `["ref","repository?","priority","recordedAt"]`; `dependency-edge` = `["ref","edges[]","added[]","removed[]","recordedAt"]`; `release` = `["leaseId","repository","ref","holder","runner","weightClass","parkCause?","recordedAt"]`; `remove` = `["ref","reason","recordedAt"]`.
3. Assert `remove`'s payload field vocabulary for `reason` is documented as `landed|abandoned|superseded|reconciled` on the page, and that the declaration marks it non-emitted.
4. Assert the topic record's `payloadFields` equals the derived union of the four lists in first-seen order, computed independently in the test.
5. Commit a mutant where the topic's `payloadFields` is replaced by a hand-authored array differing from the union; assert the surface test fails naming `payloadFields` and `queue.graph`.
6. Repeat steps 1 and 4 for the other three event topics (non-empty per-kind lists; derived union).

**Expected Outcome**:
- Every kind carries its declared payload list; only `remove` is unemitted; the topic union is derived and cannot disagree.
- A hand-authored union, an empty list, or a second unemitted kind fails.

#### TC-EVT-020 - A `queue.graph` subscriber observes `entry` then `dependency-edge` through the real session/server, with the envelope and per-lane sequence

**Objective**: Prove the ticket's first acceptance criterion end to end: a connected subscriber acts on entry and dependency changes without reading state files.
**Scenario Type**: Happy Path
**Impact Level**: Critical
**Priority**: Critical
**Related IDs**: AC-F3-1, AC-F3-2, AC-F4-1, F-3, F-4, DM-2, DM-5, EVT-1, NFR-4; DEC-D, DEC-H, DEC-I; SC-M2-S13-01
**Test Type(s)**: Integration, Behaviour
**Automation Level**: Automated
**Target Layer / Location**: `tests/behaviour/events-subscribe-queue-graph.test.ts` (new); `tests/fixtures/events/event-harness.ts` (new)
**Harness entry**: `bun test tests/behaviour/events-subscribe-queue-graph.test.ts`
**Tags**: @backend, @daemon, @events

**Preconditions / fixture**:
- `event-harness.ts` composes the **delivered** pieces: `createDaemonCommandRuntime` (production subscribe handler + watch/publish projection) with an injected `DaemonClockPort` (fixed `nowIso`), an injected `DaemonWakePort` whose ticks are released one at a time (the `createManualWake` pattern), a real temp store under `$REPO_ROOT/tmp/tmpdir/gh290-events-*` via `tests/fixtures/state/harness`, the real `createControlServer`, and the delivered `createMemoryTransportPair` as the only double.
- The subscriber is a real `createControlSession` client connection; the producer actions are the delivered appenders (`declareQueueEntry`, `addQueueDependency`).

**Steps**:
1. Start the server on the in-memory pair; connect a client; send `subscribe { topic: "queue.graph" }` with `v: CONTROL_PROTOCOL_CURRENT` and `LOCAL_CALLER_PRINCIPAL`; assert the response is `ok: true`.
2. Release one baseline tick over the **empty** store (the delivered first-observation rule primes a baseline rather than emitting); assert the client received no frame, so the baseline cannot be mistaken for a change.
3. `declareQueueEntry({ ref: "GH-999", priority: 5 })`; release one tick; assert exactly one event frame.
4. Assert the frame: `type: "frame"`, `kind: "event"`, and `Object.keys(data)` exactly `["topic","kind","lane","ref","sequence","occurredAt","payload","taxonomyVersion"]`; `topic === "queue.graph"`; `kind === "entry"`; `lane === "GH-999"`; `ref === "GH-999"`; `sequence === 1`; `occurredAt` equals the durable entry record's `recordedAt`; `data.payload` equals `{ref, priority, recordedAt}` with keys ⊆ the declared list; `taxonomyVersion === "v1"`; `"cursor" in data === false`.
5. `addQueueDependency({ ref: "GH-999", edges: ["GH-777"] })`; release one tick; assert a second frame with `kind === "dependency-edge"`, `lane === "GH-999"`, `sequence === 2`, and payload keys `ref`, `edges`, `added` (`["GH-777"]`), `removed` (`[]`), `recordedAt`.
6. Assert no third frame and no snapshot-shaped frame arrives on this topic (event topics publish observed deltas only), and that the durable record count is exactly the two appends.
7. Assert the sequence series for lane `GH-999` is `[1, 2]` (strictly increasing, step 1) and that `occurredAt` is the record timestamp, not the tick time (a re-observation with the same record yields the same value).

**Expected Outcome**:
- The client receives an actionable `entry` event followed by an actionable `dependency-edge` event, both with the full envelope and a per-lane sequence, with no state-file read on the client side.
- A subscriber that gets a snapshot frame, a missing envelope field, a `cursor`, a wrong `lane`, or a sequence gap fails.

**Notes / Clarifications**:
- Determinism: see §6.1. The server, session, codec, projection, and appenders are the delivered implementations; only the transport, clock, and wake are injected.

#### TC-EVT-021 - **Integration-marked**: the same observation over a real unix socket under a temp state directory

**Objective**: Close the gap between the in-memory pair and production transport by observing the same two events over a real unix socket, bounded and hermetic.
**Scenario Type**: Happy Path
**Impact Level**: Important
**Priority**: Medium
**Related IDs**: AC-F3-1, AC-F3-2, F-3, EVT-1, NFR-4
**Test Type(s)**: Integration
**Automation Level**: Automated
**Target Layer / Location**: `tests/conformance/events/real-socket-subscribe.test.ts` (new); `packages/adapters/src/daemon/unix.ts` (delivered)
**Harness entry**: `bun test tests/conformance/events/real-socket-subscribe.test.ts`
**Tags**: @integration, @daemon, @events

**Preconditions / fixture**:
- Temp state directory from `makeTempRoot("gh290-events-socket")`, mode `0700`; socket `${root}/daemon.sock`; `createUnixTransport({ stateDirectory, socketPath })` plus the real `createControlServer`.
- A 10 000 ms hard timeout and a `finally` that closes the server, the client, and removes the root.

**Steps**:
1. Start the server on the real socket; connect a client and subscribe to `queue.graph`; assert `ok: true`.
2. Append the entry and release one tick; decode the received line with the delivered codec and assert the full eight-field envelope, `kind: "entry"`, `sequence: 1`.
3. Append the dependency edge and release one tick; assert `kind: "dependency-edge"`, `sequence: 2`, payload deltas.
4. Assert the socket file exists with mode `0600` and the directory with `0700` (the delivered transport invariants), so the case also proves the same transport path is used.
5. Assert no TCP listener, no DNS, and no non-local address was opened (hermetic guard), and that the live worktree is unchanged (`git status --porcelain` before/after).

**Expected Outcome**:
- The same two events with the same envelope and sequence are observed over the delivered unix transport.
- A transport-specific envelope difference, a permissions regression, or a non-local connect fails.

**Notes / Clarifications**:
- This is the only socket-bound case for the subscription path; it is bounded and never runs against a real daemon process.

#### TC-EVT-022 - Every emitted frame on all four event topics carries exactly the eight declared fields, with `lane` nullable and no `cursor`

**Objective**: Prove envelope conformance at 100% across a scripted full-delivery stream, including the null-lane case.
**Scenario Type**: Happy Path
**Impact Level**: Critical
**Priority**: Critical
**Related IDs**: AC-F3-1, F-3, DM-2, EVT-1, NFR-4; DEC-D, DEC-K
**Test Type(s)**: Contract, Behaviour
**Automation Level**: Automated
**Target Layer / Location**: `tests/behaviour/events-envelope-conformance.test.ts` (new)
**Harness entry**: `bun test tests/behaviour/events-envelope-conformance.test.ts`
**Tags**: @backend, @contract

**Preconditions / fixture**:
- A scripted stream covering every emitted kind: `queue.graph` `entry`, `dependency-edge`, `release`; `dispatch.attempt` `started`, `refused`, `completed`; `phase.state` `began`, `completed`, `reopened`; `blockers.state` `published`, `updated`, `cleared`.
- A blocker question published with no recorded lane (the null-lane cell).

**Steps**:
1. Collect every frame emitted across the stream (each tick drained).
2. For each frame assert `Object.keys(data)` equals the eight declared fields **in order** and that `"cursor" in data === false`.
3. Assert `kind` is a member of its topic's declared kind set for 100% of frames, and that a frame's `kind` is never valid only for another topic (`completed` appears on both `dispatch.attempt` and `phase.state`, discriminated by `topic`).
4. Assert `lane` is present on every frame: either a non-empty string or explicit `null`; assert the null cell occurs for the lane-less blocker question and that no frame omits the key.
5. Assert `ref` is a non-empty string on every frame; `sequence` is a positive integer; `occurredAt` is an ISO-8601 UTC string ending in `Z` and parses to the source record's timestamp; `payload` is a plain object whose present keys are a subset of the kind's declared list and which contains every non-optional declared key.
6. Assert `taxonomyVersion === "v1"` on every frame.
7. Assert the payload union observed over the stream is a subset of the declared `payloadFields` union for each topic (nothing leaks in).

**Expected Outcome**:
- 100% envelope conformance, explicit null lanes, no `cursor`, ordered keys, and payload keys bounded by the declaration.
- A missing `lane`, an absent `taxonomyVersion`, a `cursor`, an undeclared kind, or an undeclared payload key fails.

#### TC-EVT-023 - A dependency delta emits `added`/`removed`; an identical folded edge set emits nothing

**Objective**: Prove the change semantics clients act on: a delta with an actionable difference, and silence when a record is re-written identically.
**Scenario Type**: Corner Case
**Impact Level**: Critical
**Priority**: High
**Related IDs**: AC-F3-3, AC-F3-2, F-3, DM-2, NFR-3
**Test Type(s)**: Behaviour
**Automation Level**: Automated
**Target Layer / Location**: `tests/behaviour/events-dependency-delta.test.ts` (new)
**Harness entry**: `bun test tests/behaviour/events-dependency-delta.test.ts`
**Tags**: @backend, @events

**Preconditions / fixture**:
- Store with an entry for `GH-999` and a dependency record carrying `edges: ["GH-777"]`.

**Steps**:
1. Append the first dependency record to a store whose projection has been primed (one baseline tick, `prime()`), then tick once; assert one `dependency-edge` with `added: ["GH-777"]`, `removed: []`, `edges: ["GH-777"]`.
2. Append an identical folded edge set as a new record (new record id and `recordedAt`); tick; assert **zero** frames on `queue.graph` (no re-publication, no snapshot-style frame).
3. Append `edges: ["GH-777","GH-888"]`; tick; assert `added: ["GH-888"]`, `removed: []`.
4. Append `edges: ["GH-888"]`; tick; assert `added: []`, `removed: ["GH-777"]`.
5. Append `edges: []`; tick; assert `removed: ["GH-888"]` and that the event is still a `dependency-edge` (not a remove).
6. Assert the frame count equals the number of differing folded sets (4) and that no event carries a full history array.

**Expected Outcome**:
- Deltas carry exactly the added and removed edges; an identical record publishes nothing; removal of an edge is not confused with the `remove` kind.
- Any publication on no change fails the "no-change publishes nothing" assertion.

#### TC-EVT-024 - Dispatch emits `started`, `refused` for a refusal, and `completed` for every other outcome with its `outcome` named

**Objective**: Prove the dispatch mapping and that `completed` never implies success.
**Scenario Type**: Happy Path
**Impact Level**: Critical
**Priority**: High
**Related IDs**: AC-F3-4, F-3, DM-2, EVT-4, NFR-4
**Test Type(s)**: Behaviour
**Automation Level**: Automated
**Target Layer / Location**: `tests/behaviour/events-subscribe-dispatch.test.ts` (new)
**Harness entry**: `bun test tests/behaviour/events-subscribe-dispatch.test.ts`
**Tags**: @backend, @events, @dispatch

**Preconditions / fixture**:
- A `daemon.lane` record appended in state `delivering` for `spawnOrdinal: 1`, `sessionId`, `harnessKind`.
- Four `dispatch.attempt` records with `outcome` `refused`, `completed`, `failed`, `timed-out` (and `premature-end` as the fifth delivered outcome).

**Steps**:
1. Tick after the lane record; assert one `dispatch.attempt` frame, `kind: "started"`, `lane` = the lane `ref`, payload fields `ref`, `spawnOrdinal`, optional `sessionId`/`harnessKind`, and `recordedAt` equal to the lane record timestamp.
2. Append the refused attempt; tick; assert `kind: "refused"` and payload contains `attemptId`, `ref`, `repository`, `harness`, `evidenceClass`, `token`, `startedAt`, `finishedAt`, `evidenceRefs[]`.
3. Append the `completed` attempt; tick; assert `kind: "completed"`, payload `outcome === "completed"`, and the declared `completed` fields present (`attemptId`, `ref`, `token`, `outcome`, `handoverState`, `comparisonClass`, `falseSuccess`, `finishedAt`, optional `divergenceRef`).
4. Append the `failed`, `timed-out`, and `premature-end` attempts; tick; assert each emits `kind: "completed"` with `outcome` naming that outcome — never `failed`/`timed-out` as kinds and never an implied success.
5. Assert exactly one frame per source record and that a re-tick emits nothing (no duplicate).
6. Assert `refused` never appears for a non-refused outcome and `completed` never appears for a refusal.

**Expected Outcome**:
- `started` → `refused` for a refusal; `completed` for every other outcome with the outcome named in the payload.
- A `completed` frame without `outcome`, a refused attempt emitted as `completed`, or a duplicate fails.

#### TC-EVT-025 - Phase emits `began` (derived once) then `completed`, and `reopened` carries its reason

**Objective**: Prove the declared gap: `began` is derived from the first `complete` for a phase, emitted once, before that phase's first `completed`, with ascending sequence on the same lane.
**Scenario Type**: Happy Path
**Impact Level**: Critical
**Priority**: Critical
**Related IDs**: AC-F3-5, F-3, DM-2, DEC-J, NFR-4; DECL-G2
**Test Type(s)**: Behaviour
**Automation Level**: Automated
**Target Layer / Location**: `tests/behaviour/events-subscribe-phase.test.ts` (new)
**Harness entry**: `bun test tests/behaviour/events-subscribe-phase.test.ts`
**Tags**: @backend, @events, @phase

**Preconditions / fixture**:
- A store with no prior `started` for `(GH-290, specification)`.
- Two `phase.transition` records with `operation: complete` for that phase, and one with `operation: reopen` carrying a `reason`.

**Steps**:
1. Append the first `complete`; tick; assert exactly two frames on `phase.state`, in order: `began` then `completed`.
2. Assert both carry `lane === "GH-290"` and ascending contiguous sequences (`n`, `n+1`).
3. Assert `began.payload` equals `{changeRef: "GH-290", phaseId: "specification", timestamp}` with `timestamp` equal to the transition's timestamp; assert `completed.payload` carries `changeRef`, `phaseId`, optional commit-intent fields, and `timestamp`.
4. Assert the record count changed by exactly one (no begin record was appended): re-read the ledger and assert one `phase.transition` record for the first `complete`.
5. Append the second `complete`; tick; assert exactly one frame, `completed` (no second `began`).
6. Append the `reopen` with `reason: "review-feedback"`; tick; assert one `reopened` frame with `payload.reason === "review-feedback"`.
7. Assert `began` appears exactly once for the whole stream and that the sequence for the lane is contiguous across all five frames.
8. Restart-free control: a phase whose projection already had `started` (e.g. after a re-tick) emits no second `began` on re-observation.

**Expected Outcome**:
- `began` is derived, once, immediately before the first `completed`, with the source timestamp and ascending sequence; later completions emit only `completed`; `reopened` carries its reason.
- A missing `began`, a duplicated `began`, a begin record appended, or a reordered pair fails.

#### TC-EVT-026 - Blockers emit `published`, `updated`, then `cleared`, once per source record, with the lane named on `cleared`

**Objective**: Prove the blocker plane's three kinds and the resume-intent evidence for `cleared`.
**Scenario Type**: Happy Path
**Impact Level**: Critical
**Priority**: High
**Related IDs**: AC-F3-6, F-3, DM-2, EVT-4, NFR-4
**Test Type(s)**: Behaviour
**Automation Level**: Automated
**Target Layer / Location**: `tests/behaviour/events-subscribe-blockers.test.ts` (new)
**Harness entry**: `bun test tests/behaviour/events-subscribe-blockers.test.ts`
**Tags**: @backend, @events, @blockers

**Preconditions / fixture**:
- A question record with `options[]` and no lane; an answer record with `choice`, `answeringAudience`, `resumeMode`; a delivering lane whose consumption records `resumeIntent`.

**Steps**:
1. Append the question; tick; assert one `published` frame with payload `{id, type, audience, question, options[], askedAt}` and `lane === null`.
2. Append the answer; tick; assert one `updated` frame with `{id, answeringAudience, choice?, text?, answeredAt, resumeMode}`.
3. Tick again **before** the daemon consumes the answer; assert no `cleared` frame (the answer alone is not a clear).
4. Record `resumeIntent` on the delivering lane; tick; assert one `cleared` frame with `{id, lane, resumeMode, clearedAt}` where `lane` is the delivering lane and `resumeMode` matches the answer's.
5. Assert each source record produced exactly one frame (re-tick emits nothing) and that the three `lane` values are `null`, `null`, and the lane ref respectively.
6. Assert the blocker text is the bounded delivered value (no truncation of the delivered cap, no extra fields).

**Expected Outcome**:
- `published` → `updated` → `cleared`, one frame per source record, with `cleared` naming the lane and the resume mode and appearing only after consumption.
- A `cleared` emitted on the answer, a duplicate, or a lane-less `cleared` fails.

#### TC-EVT-027 - `remove` is never emitted and the emitted kind set equals the declared set minus non-emitted kinds

**Objective**: Prove the declared-but-unemitted gap and that every emitted kind has a producer, so the declaration is neither over- nor under-claimed.
**Scenario Type**: Negative
**Impact Level**: Critical
**Priority**: Critical
**Related IDs**: AC-F3-7, AC-F1-2, F-3, F-1, DEC-A, DEC-J, NFR-8; DECL-G1, S17 boundary
**Test Type(s)**: Integration, Contract
**Automation Level**: Automated
**Target Layer / Location**: `tests/behaviour/events-emitted-kinds.test.ts` (new); `tests/checks/event-taxonomy-conformance.test.ts` (new)
**Harness entry**: `bun test tests/behaviour/events-emitted-kinds.test.ts tests/checks/event-taxonomy-conformance.test.ts`
**Tags**: @backend, @events, @contract

**Preconditions / fixture**:
- A full-delivery fixture: entry, dependency add then change, lease `released`, lane `delivering`, refused and completed attempts, phase complete and reopen, blocker published/answered/cleared — over many ticks (at least three per append batch).

**Steps**:
1. Run the fixture to completion, draining each tick; collect the distinct `(topic, kind)` pairs observed.
2. Compute the expected set from the declaration: every declared pair whose kind has `emitted: true`.
3. Assert set equality — no extra pair (no undeclared shape, no S17 kind) and no missing pair (every emitted kind appeared at least once).
4. Assert no frame anywhere has `kind === "remove"` and that `queue.graph` frames number exactly the entry/dependency/release events in the fixture.
5. Assert the surface reports `queue.graph.remove` with `emitted: false` in both text and `--json` forms.
6. Source scan: assert no module in the projection or composition path contains a branch that produces `remove` (search for the kind name outside the declaration and the surface renderer), and assert no `queue`-removal verb exists that could feed one.
7. Negative control: a mutant projection that emits a `remove` frame on entry removal fails step 3 with the extra pair named.

**Expected Outcome**:
- Emitted kinds equal declared emitted kinds exactly; `remove` never appears; every emitted kind has a producer.
- Any undeclared kind, any S17 shape, or any silent absence of a declared emitted kind fails.

#### TC-EVT-030 - Two subscribers of one topic agree on every `sequence`, and one lane's series has no gaps

**Objective**: Prove the shared, per-`(topic, lane)` sequence: monotonic, contiguous, and identical for two subscribers.
**Scenario Type**: Happy Path
**Impact Level**: Critical
**Priority**: Critical
**Related IDs**: AC-F4-1, F-4, DM-5, NFR-4, NFR-6
**Test Type(s)**: Behaviour
**Automation Level**: Automated
**Target Layer / Location**: `tests/behaviour/events-sequence-per-lane.test.ts` (new)
**Harness entry**: `bun test tests/behaviour/events-sequence-per-lane.test.ts`
**Tags**: @backend, @events, @ordering

**Preconditions / fixture**:
- Two client connections subscribed to `queue.graph`; five changes on lane `GH-999` (three dependency deltas and two entries for two refs to also check per-ref lanes).

**Steps**:
1. Drain both subscribers after each tick; assert both received the same number of frames.
2. Assert for each event index that both subscribers' `sequence`, `kind`, `ref`, `lane`, and `occurredAt` agree exactly.
3. Assert the `GH-999` series equals `[1,2,3]` (or the contiguous `n..n+2` offset if earlier events seeded the lane) with step exactly `1` and no repeats.
4. Assert no value is at or below the previous value for that lane, and that no gap exists.
5. Assert each frame is delivered to both subscribers exactly once (no duplicate on reconnect-free path).
6. Assert the counter is allocated once per event: the number of distinct sequences for the lane equals the number of events for the lane (no per-subscriber counters).

**Expected Outcome**:
- Both subscribers see identical per-lane sequences, strictly increasing by one, one allocation per event.
- A per-subscriber counter, a gap, a repeat, or divergent values between subscribers fails.

#### TC-EVT-031 - Lanes and topics are independent, and no order is inferred from `occurredAt` or `cursor`

**Objective**: Prove the declared scope of the ordering guarantee and that no other field is used as an ordering signal.
**Scenario Type**: Corner Case
**Impact Level**: Critical
**Priority**: High
**Related IDs**: AC-F4-2, F-4, DM-5, NFR-6; DEC-D; AMB-T1
**Test Type(s)**: Behaviour, Structure
**Automation Level**: Automated
**Target Layer / Location**: `tests/behaviour/events-sequence-per-lane.test.ts` (new); `tests/structure/event-ordering-contract.test.ts` (new)
**Harness entry**: `bun test tests/behaviour/events-sequence-per-lane.test.ts tests/structure/event-ordering-contract.test.ts`
**Tags**: @backend, @events, @ordering

**Preconditions / fixture**:
- Interleaved changes on two lanes of `queue.graph` (`GH-999`, `GH-888`) and on a second topic (`dispatch.attempt`) for the same ref.
- A pair of events constructed so `occurredAt` decreases while `sequence` increases.

**Steps**:
1. Assert lane `GH-999` sequences are contiguous from 1 and lane `GH-888` sequences are contiguous from 1 — independent counters, no interleaving effect.
2. Assert `dispatch.attempt` for ref `GH-999` starts at 1 even though `queue.graph` for the same ref is already at 3 (cross-topic independence).
3. Assert the constructed pair: `sequence` increases while `occurredAt` decreases, proving order is not derived from time; assert the frame order equals the sequence order.
4. Assert no frame carries both `sequence` and `cursor`, and that the snapshot topics' `cursor` values never appear in an event frame.
5. Assert each event topic's declared `ordering === "sequence-per-lane"` and each snapshot topic's is `"snapshot-revision"`, and that the page's ordering section contains both `gap` and `repoll`.
6. Source scan: assert the projection contains no sort/comparison on `occurredAt` and no ordering key derived from `cursor`.

**Expected Outcome**:
- Lane and topic counters are independent; `occurredAt` and `cursor` are never ordering signals; the gap rule is declared.
- A global counter, a cross-lane comparison, or an ordering derived from time fails.

**Notes / Clarifications**:
- The client's own repoll reaction cannot be observed here; AMB-T1 records the substitute.

#### TC-EVT-032 - A second daemon incarnation over the same store restarts the counter, and the declaration documents the discontinuity

**Objective**: Prove the process-scoped sequence and the restart discontinuity rule, so a client never reads a restart as data.
**Scenario Type**: Regression
**Impact Level**: Critical
**Priority**: Critical
**Related IDs**: AC-F4-3, F-4, DM-5, NFR-6; DEC-D, DEC-I, DEC-G; OQ-2; AMB-T2
**Test Type(s)**: Integration, Contract
**Automation Level**: Automated
**Target Layer / Location**: `tests/behaviour/events-sequence-restart.test.ts` (new); `tests/checks/event-taxonomy-conformance.test.ts` (new)
**Harness entry**: `bun test tests/behaviour/events-sequence-restart.test.ts tests/checks/event-taxonomy-conformance.test.ts`
**Tags**: @backend, @events, @ordering

**Preconditions / fixture**:
- One temp store; incarnation A (server + runtime + projection) drains several `queue.graph` events for lane `GH-999`, reaching `N > 1`; incarnation B is a fresh server + runtime + projection over the **same** store (new process-scoped allocator), with no restart of the store.

**Steps**:
1. In incarnation A, append three dependency deltas for `GH-999`; assert the final observed sequence is `N = 3`.
2. Close A's server and transport; compose B over the same store with a fresh clock/wake.
3. Subscribe in B **before** appending; assert no synthetic baseline and no replay of prior events (the populated store baselines rather than replaying).
4. Append one dependency delta in B; assert the received `sequence === 1` and that `1 <= N` (the declared discontinuity predicate holds).
5. Assert the daemon did not seed the counter from the ledger: a second identical run yields the same `1`, independent of `N`.
6. Assert the page's ordering section names the restart discontinuity and the repoll remedy (token assertion on `restart` and `repoll`), and that the machine `ordering` value remains `sequence-per-lane` (no new value).
7. Assert the snapshot topics' cursor over the same restart keeps its delivered snapshot-revision meaning (a cursor does not reset as a contract).

**Expected Outcome**:
- A fresh incarnation restarts the per-lane counter at 1, no replay occurs, and the discontinuity is detectable by the declared rule and documented.
- Any durable seeding, replay, or silent continuation fails.

**Notes / Clarifications**:
- AMB-T2 records that the client's detection itself is a documented client property, not an executed assertion.

#### TC-EVT-040 - For each of the six topics, overflow yields exactly one stamped degraded frame, drops only that subscription, and spares the rest

**Objective**: Prove the ticket's third acceptance criterion: overflow-to-repoll is identical for all six topics, with the additive stamp and the delivered drop behaviour intact.
**Scenario Type**: Negative
**Impact Level**: Critical
**Priority**: Critical
**Related IDs**: AC-F5-1, AC-F5-2, F-5, DM-4, EVT-2, NFR-7, NFR-9; DEC-C; SC-M2-S13-02; AMB-T3
**Test Type(s)**: Integration, Behaviour
**Automation Level**: Automated
**Target Layer / Location**: `tests/behaviour/events-overflow-parity.test.ts` (new); `tests/fixtures/events/overflow-cases.ts` (new)
**Harness entry**: `bun test tests/behaviour/events-overflow-parity.test.ts`
**Tags**: @backend, @daemon, @events, @overflow

**Preconditions / fixture**:
- `subscriptionBuffer: 2` (a two-slot bounded buffer), one subscriber `A` per topic that never drains, one subscriber `B` on the same topic that drains every tick, and one subscriber on a different topic as a bystander.
- `overflow-cases.ts` declares the six topics and, for each, the change sequence that produces at least three events (snapshot topics: three snapshot-changing mutations; event topics: three appends).

**Steps**:
1. For each topic: prime the projection with one baseline tick over the empty store (assert no frame); subscribe `A`, `B` (same topic) and the bystander; produce at least three changes; release both ticks needed to overflow.
2. Assert `A` received exactly **one** degraded frame; assert its `data` keys are exactly `{degraded, topic, overflow, taxonomyVersion}`, `degraded === "subscriber-overflow"`, `topic` is the overflowing topic, `overflow === "repoll"`, `taxonomyVersion === "v1"`, and no `cursor`/`snapshot`.
3. Assert `A`'s subscription is gone: subsequent publishes write zero frames to `A` (its connection queue stays empty / the session reports the subscription removed) and a poke on `A` sees no further event.
4. Assert `B` received **every** event for that topic (no loss) and the bystander received every event on its own topic — drop isolation.
5. Assert the tick did not block on `A`: measure the tick duration and assert `B`'s frames arrived within the same tick release (NFR-9), with the buffer bounded rather than awaited.
6. Repeat for all six topics and assert an identical outcome row per topic (a parity table with six rows and the same four `data` keys).
7. Assert the two snapshot topics' non-degraded frames are still exactly `{topic,cursor,snapshot}` — the stamp applies only to the degraded frame.
8. Assert the number of degraded frames equals the number of overflowing subscriptions (one), never one per dropped event.

**Expected Outcome**:
- Six identical overflow outcomes; exactly one stamped degraded frame per overflowing subscription; only that subscription dropped; no loss elsewhere; no tick block.
- A second degraded frame, a per-event degraded frame, a missing `overflow`, an unstamped snapshot-topic frame, or a bystander drop fails.

**Notes / Clarifications**:
- The client's repoll itself is a client action (AMB-T3); the instruction is asserted on the frame and the record.

#### TC-EVT-041 - The declared `overflow` and the frame's `overflow` come from one constant and cannot disagree

**Objective**: Prove DEC-C's single source: the value a client reads on the page and the value it reads on the wire are rendered from the same declaration constant.
**Scenario Type**: Corner Case
**Impact Level**: Critical
**Priority**: Critical
**Related IDs**: AC-F5-2, F-5, DM-4, DEC-C, NFR-7
**Test Type(s)**: Contract, Structure
**Automation Level**: Automated
**Target Layer / Location**: `tests/structure/event-overflow-carriage.test.ts` (new); `tests/behaviour/events-overflow-parity.test.ts` (new)
**Harness entry**: `bun test tests/structure/event-overflow-carriage.test.ts tests/behaviour/events-overflow-parity.test.ts`
**Tags**: @backend, @contract, @overflow

**Preconditions / fixture**:
- The declaration's `OVERFLOW_VALUES` (or the per-topic constant) and the degraded-frame renderer, both importable.
- A temp-copy mutant whose constant is `"drop"`.

**Steps**:
1. Assert `OVERFLOW_VALUES` deep-equals `["repoll"]` and every topic's `overflow === "repoll"`.
2. Capture a degraded frame (from `TC-EVT-040`'s fixture) for each of the six topics and assert `data.overflow === TAXONOMY_OVERFLOW` (the same imported constant), not a string literal typed in the test.
3. Assert the frame-rendering module imports the constant and contains no second literal `"repoll"` for the overflow field (source scan over the session/server degradation path).
4. Mutant: change the constant to `"drop"` in a temp copy; assert the surface test and the frame test both fail naming `overflow` (so one edit moves both, or neither).
5. Assert an unknown value is rejected by the closed-value check (`TC-EVT-003` step 6), so `"drop"` cannot ship.
6. Assert the delivered `degraded` marker and reason vocabulary are untouched (the frame still says `subscriber-overflow`).

**Expected Outcome**:
- One constant, one value, two surfaces; a change moves both or fails the closed-value check.
- A hardcoded second `"repoll"`, a divergence between page and frame, or a renamed marker fails.

#### TC-EVT-042 - The subscription capacity bound and the `daemon.subscriber-degraded` refusal are unchanged

**Objective**: Prove the single bound still governs both the buffer and the subscription count, with no new key or vocabulary.
**Scenario Type**: Regression
**Impact Level**: Critical
**Priority**: High
**Related IDs**: AC-F5-3, AC-F8-1, F-5, F-8, DM-4, NFR-7
**Test Type(s)**: Behaviour, Structure
**Automation Level**: Automated
**Target Layer / Location**: `tests/behaviour/events-overflow-parity.test.ts` (new); `tests/structure/event-control-vocabulary.test.ts` (new)
**Harness entry**: `bun test tests/behaviour/events-overflow-parity.test.ts tests/structure/event-control-vocabulary.test.ts`
**Tags**: @backend, @daemon, @contract

**Preconditions / fixture**:
- Session with `subscriptionBuffer: 2`; one connection requesting three subscriptions.

**Steps**:
1. Subscribe twice successfully; assert the third subscribe on the same connection is refused with `daemon.subscriber-degraded` and that the first two subscriptions still receive.
2. Assert the refusal does not emit a degraded event frame (it is a subscribe-response error, as delivered) and does not close the connection.
3. Assert the delivered `daemon.subscription-buffer` setting name and default `256` are unchanged in the contracts, and that no second capacity key exists for event topics (config catalogue diff by key set).
4. Assert `CONTROL_DEGRADED_REASONS` still equals the three delivered values (no `overflow` value added to the reason vocabulary).
5. Assert a topic-aware capacity does not exist: the same bound applies to `queue`, `lanes`, and the four event topics (one parameterised row per topic).

**Expected Outcome**:
- One bound, one refusal identity, unchanged default and vocabulary for all six topics.
- A per-topic capacity key, a new reason value, or a changed default fails.

#### TC-EVT-050 - `queue` and `lanes` frames stay byte-identical, baseline at `cursor: 0`, and change-only

**Objective**: Protect the two live consumers: no field added, no shape change, no changed dedupe, with the degraded stamp as the only delta.
**Scenario Type**: Regression
**Impact Level**: Critical
**Priority**: Critical
**Related IDs**: AC-F6-1, F-6, DM-3, EVT-3, DEC-B
**Test Type(s)**: Regression, Integration
**Automation Level**: Automated
**Target Layer / Location**: `tests/behaviour/events-snapshot-preserved.test.ts` (new); delivered `tests/behaviour/{control-session,control-connection,daemon-watch-state-changes,queue-watch,lanes-watch}.test.ts` as unmodified controls
**Harness entry**: `bun test tests/behaviour/events-snapshot-preserved.test.ts tests/behaviour/control-session.test.ts tests/behaviour/control-connection.test.ts tests/behaviour/daemon-watch-state-changes.test.ts tests/behaviour/queue-watch.test.ts tests/behaviour/lanes-watch.test.ts`
**Tags**: @backend, @daemon, @regression

**Preconditions / fixture**:
- A temp store with a queue entry and a lane; the subscription buffer at the delivered default.

**Steps**:
1. Subscribe to `queue`; assert the baseline frame's `data` keys are exactly `["topic","cursor","snapshot"]`, `cursor === 0`, and `topic === "queue"`.
2. Mutate the queue snapshot; tick; assert the change frame's keys are exactly the same three, `cursor === 1`, and the snapshot content equals the delivered projection.
3. Tick with no change; assert **no** frame (dedupe preserved).
4. Assert no envelope field (`kind`, `lane`, `ref`, `sequence`, `occurredAt`, `payload`, `taxonomyVersion`) appears on any `queue` frame; assert `Object.keys(data).length === 3` for every frame.
5. Repeat for `lanes`.
6. Assert the exact serialized line for the baseline and the first change equals the delivered golden bytes (recorded pre-change and committed as a control fixture); any byte difference fails.
7. Overflow a `queue` subscription at `subscriptionBuffer: 1`; assert the one degraded frame carries the two additive fields and that `degraded`/`topic` are unchanged; assert the non-degraded frames remain three-key.
8. Run the five delivered suites unmodified and assert they pass (no edits to their assertions in this change).

**Expected Outcome**:
- `queue`/`lanes` frames are byte-identical to the delivered behaviour, baseline `cursor: 0`, change-only advancement, with the degraded stamp as the only delta.
- An added field, a re-keyed frame, a reordered key, or a dedupe change fails the byte comparison or the delivered suites.

#### TC-EVT-051 - Snapshot topic records declare the snapshot shape, the single kind, the three-field frame, and snapshot-revision ordering

**Objective**: Prove the surface tells a client that these two topics are snapshot topics and carry no per-lane sequence promise.
**Scenario Type**: Happy Path
**Impact Level**: Critical
**Priority**: High
**Related IDs**: AC-F6-2, F-6, DM-7, EVT-3, DEC-B
**Test Type(s)**: Contract, Behaviour
**Automation Level**: Automated
**Target Layer / Location**: `tests/behaviour/events-describe.test.ts` (new)
**Harness entry**: `bun test tests/behaviour/events-describe.test.ts`
**Tags**: @backend, @contract

**Preconditions / fixture**:
- The `list --json` and `describe` outputs for `queue` and `lanes`.

**Steps**:
1. Assert `shape === "snapshot"`, `lane === "none"`, `ordering === "snapshot-revision"`, `overflow === "repoll"`.
2. Assert `kinds.length === 1` with `name === "snapshot"` and `emitted === true`.
3. Assert `frame` deep-equals `["topic","cursor","snapshot"]`.
4. Assert `payloadFields` equals the derived union of the one kind's list and does not include `kind`, `lane`, `ref`, `sequence`, `occurredAt`, or `taxonomyVersion`.
5. Assert the text page contains no per-lane sequence sentence and does state that the cursor is a snapshot revision (token assertion on `snapshot revision` and absence of `per lane`).
6. Assert no snapshot topic declares a `parent` and none appears with the event-topic frame.

**Expected Outcome**:
- The two delivered topics are described as snapshot topics with one kind, three frame fields, and snapshot-revision ordering, with no envelope or per-lane claim.
- A snapshot topic described as an event topic, or an added kind, fails.

#### TC-EVT-060 - `events` is prompt-required (19), composed unconditionally with no runtime input, and reaches its handler

**Objective**: Prove the mount's composition half: membership, unconditional runtime, selection, and a real handler invocation with nothing composed.
**Scenario Type**: Happy Path
**Impact Level**: Critical
**Priority**: Critical
**Related IDs**: AC-F7-1, F-7, DM-6, DEC-F; §8.5
**Test Type(s)**: Structure, Behaviour
**Automation Level**: Automated
**Target Layer / Location**: `tests/structure/events-production-composition.test.ts` (new); `tests/behaviour/entrypoint-composition.test.ts` (update)
**Harness entry**: `bun test tests/structure/events-production-composition.test.ts tests/behaviour/entrypoint-composition.test.ts`
**Tags**: @backend, @cli, @composition

**Preconditions / fixture**:
- Production composer with injected facts and a temp `HOME`; a recording factory for the store, configuration resolver, transport, and supervisor that counts construction.

**Steps**:
1. Assert `PROMPT_REQUIRED_COMMANDS` has 19 members, contains `events` exactly once, and preserves the delivered 18 as a subset (the delivery appends `events`).
2. Compose the production program; assert `program.commands.events` is defined with a declared verb list `["list","describe"]` and no unexpected flags beyond `--json`.
3. Run `selectPromptRequiredProgram(program)`; assert it returns all 19 keys without throwing, and that `fallback.internal` containment is never reached.
4. Through `runEntrypoint`, invoke `["events","list"]`; assert exit `0`, `command === "events list"`, and a success `data` payload.
5. Assert zero store handles opened, zero configuration reads, zero transport connects, zero supervisor probes, and zero entry-path reads during composition and invocation — the runtime is the declaration.
6. Mutant: a composer that registers `events` only when an optional input is supplied makes selection throw and the invocation contained as `fallback.internal`; assert the mutant fails step 3.
7. Mutant: dropping `events` from the prompt set makes `runEntrypoint` refuse with `fallback.internal`; assert the mutant fails step 4.

**Expected Outcome**:
- `events` is prompt-required, unconditionally composed, selectable, and reaches its handler with nothing composed.
- A conditional registration, a missing membership row, or a hidden runtime dependency fails.

#### TC-EVT-061 - Root help lists nineteen families, the family page renders five sections, and both verb pages answer `--help`

**Objective**: Prove the self-description half of the mount and the exit-`0` behaviour of every `--help` form.
**Scenario Type**: Happy Path
**Impact Level**: Critical
**Priority**: High
**Related IDs**: AC-F7-2, F-7, NFR-1
**Test Type(s)**: Behaviour
**Automation Level**: Automated
**Target Layer / Location**: `tests/behaviour/events-mount-help.test.ts` (new); `tests/behaviour/entrypoint-help.test.ts` (update)
**Harness entry**: `bun test tests/behaviour/events-mount-help.test.ts tests/behaviour/entrypoint-help.test.ts`
**Tags**: @ui, @cli, @help

**Preconditions / fixture**:
- Synthetic brand rendering as `example-product`; a counting composer.

**Steps**:
1. Run `--help`; assert exit `0`, nineteen family rows, one of them `  events  ` with a non-empty one-line summary, and zero composer invocations.
2. Run `events --help`; assert exit `0` and that the page carries the five declared sections: usage, options, examples, exit codes, and a see-also containing `doc/planning/oss-tooling/milestones/m2/commands/events.md`.
3. Assert the usage lines name both verbs and `--json`; assert the exit-code section lists `0`, `1`, `2` only.
4. Run `events list --help` and `events describe --help`; assert each exits `0`, renders its own usage, and never emits `unknown flag`/`unknown argument`.
5. Run `--version`; assert identity only, no command list, exit `0`.
6. Assert every page is ≤ 40 lines / 8 192 bytes and contains no ANSI escape; assert zero reads/writes/composers for all `--help`/`--version` runs.
7. Assert adding `events` did not reorder or remove the delivered eighteen family rows (compare the delivered list as a subsequence).

**Expected Outcome**:
- Nineteen families; a complete family page pointing at the M2 page; both verb pages answering `--help` at exit `0`; help/version purity preserved.
- A missing family row, a page without see-also or exit codes, or an unknown-flag refusal fails.

#### TC-EVT-062 - Help coverage and reference-page parity pass with the M2 page, both inventory rows, and the page root

**Objective**: Prove the two help gates pass with the new page and its inventory rows, and that the page-root mapping is the `events` row.
**Scenario Type**: Happy Path
**Impact Level**: Critical
**Priority**: Critical
**Related IDs**: AC-F7-3, F-7, DM-7, DEC-F
**Test Type(s)**: Checks, Contract
**Automation Level**: Automated
**Target Layer / Location**: `scripts/checks/help-guide-coverage.ts` (update: `events` row); `tests/fixtures/help-guide/coverage.json` (update); `tests/checks/help-guide-coverage.test.ts`, `tests/checks/reference-page-parity.test.ts`; `doc/planning/oss-tooling/milestones/m2/commands/events.md` (update, phase 7)
**Harness entry**: `bun run scripts/checks/help-guide-coverage.ts`; `bun test tests/checks/help-guide-coverage.test.ts tests/checks/reference-page-parity.test.ts`
**Tags**: @checks, @help, @docs

**Preconditions / fixture**:
- The M2 page carries a `## HELP` section with both `--help` and `--version`.
- The coverage fixture lists `events` in `commands` and the M2 events page in `referencePages`.

**Steps**:
1. Assert the page-root resolver maps `events` to `doc/planning/oss-tooling/milestones/m2/commands/events.md` (and not to the M1 root, and not to a generic `${root}/events.md` under M1).
2. Run the coverage check; assert exit `0` and zero failures.
3. Assert the page exists, contains `--help` and `--version`, and appears in both fixture arrays.
4. Assert the inventory's `commands` list equals `PROMPT_REQUIRED_COMMANDS` as a set (19), and that `referencePages` contains one page per command family (including `events`).
5. Assert reference-page parity: every see-also target in the help inventory exists on disk and is registered, including the `events` family's see-also target.
6. Assert no duplicate page registration and that no other page was removed by the mount.

**Expected Outcome**:
- Zero coverage failures; the page root resolves to the M2 page; parity holds; both inventory rows exist.
- A missing page, a page without `--version`, an M1 mapping, or a parity gap fails.

#### TC-EVT-063 - Prompt conformance, the file-set inventory, the v1 contract inventory, and the export allowances equal the tree

**Objective**: Prove the conformance and inventory guards pass in both directions with the new modules and exports registered.
**Scenario Type**: Happy Path
**Impact Level**: Critical
**Priority**: High
**Related IDs**: AC-F7-4, F-7, F-8, NFR-8
**Test Type(s)**: Checks, Structure
**Automation Level**: Automated
**Target Layer / Location**: `tests/structure/content-inventory.test.ts` + `tests/structure/inventory.json` (update); `tests/checks/exports-parity.test.ts`; `scripts/checks/prompt-conformance.ts`; `scripts/checks/workspace-entrypoints.ts`
**Harness entry**: `bun run scripts/checks/prompt-conformance.ts`; `bun test tests/structure/content-inventory.test.ts tests/checks/exports-parity.test.ts tests/checks/prompt-conformance.test.ts`
**Tags**: @checks, @contract, @inventory

**Preconditions / fixture**:
- Inventory rows for the new modules: the taxonomy contract, the event projection, the `events` command, and the composition helper; the v1 contract inventory entries for the new exports.

**Steps**:
1. Run prompt conformance; assert exit `0` (no plan-progress, hand-edited phase state, raw git writes, or retired platform literals).
2. Assert the file-set inventory equals the tree both ways: every listed file exists and every non-exempt file is listed; the new modules are listed and no file was dropped.
3. Assert the v1 contract inventory equals the tree both ways: the new exports (`TAXONOMY`, the type names, the validator) are listed and no listed export is missing.
4. Assert the executable-export allowances name the new files that host executable exports, and that no file gained an executable export without an allowance.
5. Assert `bun run scripts/checks/workspace-entrypoints.ts` passes (no undeclared cross-package import from the new modules).
6. Assert the contract index re-exports the declaration (so a consumer imports it from the index, not a deep path).

**Expected Outcome**:
- Prompt conformance and both inventories pass in both directions; the new modules and exports are registered; allowances are named.
- A missing inventory row, an unlisted export, an undeclared import, or a dropped file fails.

#### TC-EVT-064 - Removing any one mount piece trips a named guard (negative controls for all six pieces and both inventories)

**Objective**: Prove the mount is enforced in both directions: each missing piece fails a named guard, so a partial mount cannot pass.
**Scenario Type**: Negative
**Impact Level**: Critical
**Priority**: Critical
**Related IDs**: AC-F7-1, AC-F7-2, AC-F7-3, AC-F7-4, F-7, DEC-F
**Test Type(s)**: Checks, Mutation
**Automation Level**: Automated
**Target Layer / Location**: `tests/checks/help-guide-coverage-mutants.test.ts` (update); `tests/fixtures/events/mount-mutants.ts` (new)
**Harness entry**: `bun test tests/checks/help-guide-coverage-mutants.test.ts tests/checks/event-mount-guards.test.ts`
**Tags**: @checks, @mutation, @help

**Preconditions / fixture**:
- Temp-copy mutants of the program, the help inventory, the coverage fixture, the page-root resolver, the page, the file inventory, and the export allowances. The live tree is never mutated; each mutant declares the suite and the assertion it must trip.

**Steps**:
1. Remove `events` from the prompt-required set; assert the coverage/parity guard fails naming `events` as present in `commands` but absent from the prompt set.
2. Keep prompt membership but remove the family help entry; assert the parity/coverage guard fails naming the missing help entry.
3. Keep both but remove the `commands` row; assert the coverage check reports a failure for `events`.
4. Remove the `referencePages` row (or delete the page file); assert the coverage check fails naming the missing page.
5. Remove `--version` from the page; assert the coverage check fails naming the page section.
6. Remove the `events` page-root row (fall back to the M1 root or to a non-existent path); assert the coverage check fails naming the resolved page.
7. Remove the new module from the file inventory; assert `content-inventory` fails naming the file.
8. Remove the new export from the v1 contract inventory (or the allowance); assert `exports-parity` fails naming the file/export.
9. Assert each mutant trips exactly one guard (no shotgun failure), and that the unmutated tree trips none.

**Expected Outcome**:
- Eight mutants, eight named guard failures — the six mount pieces plus the two inventories; the unmutated tree is green.
- A mount that omits any piece cannot pass, and a guard cannot pass vacuously.

#### TC-EVT-070 - The wire-type, frame-kind, degraded-reason, stop-mode, protocol, and buffer vocabularies are unchanged; `CONTROL_TOPICS` has six

**Objective**: Prove the only control-vocabulary change is the additive topic widening.
**Scenario Type**: Regression
**Impact Level**: Critical
**Priority**: Critical
**Related IDs**: AC-F8-1, F-8, DM-6, NFR-8; NG-1
**Test Type(s)**: Structure, Contract
**Automation Level**: Automated
**Target Layer / Location**: `tests/structure/event-control-vocabulary.test.ts` (new); delivered `tests/structure/daemon-vocabulary.test.ts` as a control
**Harness entry**: `bun test tests/structure/event-control-vocabulary.test.ts tests/structure/daemon-vocabulary.test.ts`
**Tags**: @backend, @contract, @regression

**Preconditions / fixture**:
- A committed fixture of the delivered vocabularies (`tests/fixtures/events/delivered-vocabularies.json`), captured before the change.

**Steps**:
1. Assert `CONTROL_WIRE_TYPES` deep-equals the fixture (9 values, same order).
2. Assert `CONTROL_FRAME_KINDS` deep-equals the fixture (4 values).
3. Assert `CONTROL_DEGRADED_REASONS` deep-equals the fixture (3 values).
4. Assert `CONTROL_STOP_MODES` deep-equals the fixture (2 values).
5. Assert the protocol current version and floor equal the fixture, and the subscription-buffer default (`256`) and setting name equal the fixture.
6. Assert `CONTROL_TOPICS` has exactly six members equal to the declaration's topic names, and that the delivered two are a prefix subset.
7. Assert a frame's top-level key set is a subset of the delivered key set (`v`, `kind`, `type`, `id`, `payload`, `data`, `error`, `callerPrincipal`) for every frame emitted in `TC-EVT-022`'s stream, and that `id` is absent on events.
8. Assert no wire type named `event` was added (the event is a frame `kind`, not a wire type).

**Expected Outcome**:
- Six topics; every other vocabulary, version, floor, and bound unchanged; no field outside `data` added.
- Any changed value, a seventh topic, a new wire type, or a top-level envelope field fails.

#### TC-EVT-071 - A v1 peer decodes the envelope and the stamped degraded frame, keeps its negative controls, and tolerates extra `data` fields

**Objective**: Prove the additive fields are wire-compatible inside the delivered open `data` body.
**Scenario Type**: Happy Path
**Impact Level**: Critical
**Priority**: High
**Related IDs**: AC-F8-2, AC-NFR-4, F-8, DM-2, DM-4, EVT-1, EVT-2, NFR-4, NFR-5; OQ-1; AMB-T3b
**Test Type(s)**: Contract
**Automation Level**: Automated
**Target Layer / Location**: `tests/behaviour/events-decode-additive.test.ts` (new); delivered `tests/behaviour/control-codec.test.ts` as a control
**Harness entry**: `bun test tests/behaviour/events-decode-additive.test.ts tests/behaviour/control-codec.test.ts`
**Tags**: @backend, @codec, @contract

**Preconditions / fixture**:
- Serialized lines for: an event frame with the eight fields; a degraded frame with `overflow` and `taxonomyVersion`; a frame with a synthetic extra `data` field; and four negative controls (zero of `payload`/`data`/`error`, two of them, an `id` on an event, a wrong `v`).

**Steps**:
1. Decode each additive frame; assert success and the correct routing (`kind: "event"` for both the event and degraded frames, with the degraded body recognised by `degraded`).
2. Assert the decoded `data` retains the additive fields and that no field was moved outside `data`.
3. Decode the synthetic extra-field frame; assert success (an unknown `data` field is tolerated), which is the property a v0/v1 peer relies on.
4. Assert every delivered negative control is still refused with the delivered identity (no validation was relaxed).
5. Assert the frame size of each additive frame is ≤ `DAEMON_MAX_FRAME_BYTES`.
6. Assert encode→decode round-trip fidelity for the additive frames (no field dropped by the codec).

**Expected Outcome**:
- Additive frames decode and route; unknown `data` fields are tolerated; no delivered validation relaxed; the frame bound holds.
- A closed `data` body, a rejected additive field, or a relaxed negative control fails.

**Notes / Clarifications**:
- No v0 binary exists; AMB-T3b records the substitution.

#### TC-EVT-072 - The error table has exactly three new rows in one `events` kind, no row changed, and the documented table matches both ways

**Objective**: Prove the error-table delta is exactly +3 in one new kind, with zero churn on existing rows, and that documentation and code agree both ways.
**Scenario Type**: Happy Path
**Impact Level**: Critical
**Priority**: Critical
**Related IDs**: AC-F8-3, F-8, NFR-8, Appendix D
**Test Type(s)**: Structure, Checks
**Automation Level**: Automated
**Target Layer / Location**: `tests/structure/error-table.test.ts` (update); delivered `tests/checks/error-table-sync.test.ts`; `doc/spec/features/feature-result-contract.md` (update, phase 7)
**Harness entry**: `bun test tests/structure/error-table.test.ts tests/checks/error-table-sync.test.ts`; `bun run scripts/checks/error-table-sync.ts`
**Tags**: @backend, @errors, @docs

**Preconditions / fixture**:
- A committed snapshot of the delivered error table (`tests/fixtures/events/error-table-baseline.json`) captured before the change.

**Steps**:
1. Assert the table has a domain kind `events` and that its rows are exactly `events.topic-unknown`, `events.verb-unknown`, `events.taxonomy-unavailable` (three, no more).
2. Assert each row's class and projection: the first two `category: "user"`, `retryable: false`, `consequence: "not_landed"`, remediation class `user-validation`; the third `category: "platform"`, `retryable: false`, `consequence: "not_landed"`, remediation class `platform-provider`.
3. Assert the delivered baseline rows are byte-identical (no add, remove, or reword): compare the table minus the `events` kind to the baseline fixture.
4. Run the bidirectional sync check; assert exit `0` (the documented result-contract table lists the three rows and the code has no undocumented row).
5. Assert kind-only lookup resolves to the `events` kind and returns exactly the three rows.
6. Assert every path of the mounted surface resolves to one of the three rows or to success, and that `tests/checks/exit-code-literals.test.ts` passes (no stray digit).
7. Assert the classification chain is unaffected: a delivered identity not in `events` still resolves to its own class (a small sample of baseline rows).

**Expected Outcome**:
- Exactly three new rows, one new kind, no existing row touched, documentation and code agreeing both ways, and exits `{0,1,2}`.
- A fourth row, a reworded row, a missing doc row, or a wrong class/exit fails.

#### TC-EVT-073 - The state schema, record kinds, payload schemas, key prefixes, and migrations are unchanged

**Objective**: Prove the change persists nothing: the taxonomy projects existing records.
**Scenario Type**: Regression
**Impact Level**: Critical
**Priority**: High
**Related IDs**: AC-F8-4, F-8, DM-8, NFR-8; NG-3; EVT-5
**Test Type(s)**: Structure, Contract
**Automation Level**: Automated
**Target Layer / Location**: `tests/structure/event-state-additivity.test.ts` (new); delivered `tests/structure/state-contract.test.ts` as a control
**Harness entry**: `bun test tests/structure/event-state-additivity.test.ts tests/structure/state-contract.test.ts`
**Tags**: @backend, @state, @regression

**Preconditions / fixture**:
- Committed fixtures of `STATE_SCHEMA_VERSION`, the record-kind set, the payload-schema constants, and the key prefixes, captured before the change.

**Steps**:
1. Assert `STATE_SCHEMA_VERSION` equals the fixture.
2. Assert the record-kind set equals the fixture (no new kind; `queue.entry`, `queue.dependency`, `queue.lease`, `queue.park`, `dispatch.attempt`, `daemon.lane`, `phase.transition`, `blocker.question`, `blocker.answer`, `daemon.instance`, `daemon.heartbeat` unchanged).
3. Assert every payload-schema constant equals the fixture and no new schema constant was added.
4. Assert every key prefix equals the fixture and no new prefix or file location was added.
5. Assert no migration, backfill, or seed module exists or is referenced (search for the delivered migration entry points and assert none grows).
6. Run a full-delivery fixture (from `TC-EVT-027`) and assert the store's record count increases only through the appenders the fixture itself calls — the taxonomy appended nothing (record-count delta equals the number of fixture appends).
7. Assert `tests/golden/{queue-list,lanes-list,daemon-*}` pass unmodified.

**Expected Outcome**:
- Schema version, kinds, payload schemas, prefixes unchanged; zero taxonomy writes; goldens green.
- A new record kind, a schema bump, a seed, or an extra append fails.

#### TC-EVT-074 - The additivity inventory holds: no new wire type, record kind, schema version, migration, dependency, or capsule event

**Objective**: Prove the composite additivity claim (NFR-8) mechanically: four zeroes, no dependency, no capsule-event extension, no new file location.
**Scenario Type**: Regression
**Impact Level**: Critical
**Priority**: High
**Related IDs**: AC-F8-4, F-8, EVT-5, NFR-8; NG-3, NG-8
**Test Type(s)**: Structure, Checks
**Automation Level**: Automated
**Target Layer / Location**: `tests/structure/event-additivity-inventory.test.ts` (new); `tests/fixtures/events/additivity-baseline.json` (new)
**Harness entry**: `bun test tests/structure/event-additivity-inventory.test.ts`
**Tags**: @backend, @regression, @inventory

**Preconditions / fixture**:
- A committed baseline of: the dependency sets parsed from `package.json` and the workspace manifests, the capsule event-kind set read from the events module, the record-kind set, the schema-version constants, the error-table kind set, and the set of directories the state layer writes.

**Steps**:
1. Parse the dependency sets from the manifests and compare to the baseline; assert set equality (zero additions and zero removals), with `pnpm-lock.yaml` unchanged as a control (a tree invariant, not a branch diff).
2. Assert the capsule event-kind set equals the baseline (no `taxonomy.*`/`events.*` capsule event was added).
3. Assert the record-kind set and the schema-version constants equal the baseline (delegated to `TC-EVT-073`, asserted here as part of the composite).
4. Assert the error-table kind set gained exactly one kind (`events`) with exactly three rows (delegated to `TC-EVT-072`).
5. Assert no new directory or file location is written by the daemon: the writable-root set equals the baseline.
6. Assert no new telemetry record kind, metric, trace, log sink, or outbox effect exists.
7. Report the composite as a table of five zeroes plus one `+3 rows` and one `+1 kind`, failing with the offending axis named.

**Expected Outcome**:
- Zero new wire types, record kinds, schema versions, migrations, dependencies; no new capsule event, file location, or telemetry.
- Any added dependency, capsule event, location, or metric fails naming that axis.

#### TC-EVT-075 - An unknown subscribe topic is refused as `events.topic-unknown` (never `daemon.state-recovery-failed`), a known event topic is accepted with no synthetic baseline, and `since` is ignored

**Objective**: Prove the one intentional delivered behaviour change (DEC-L) and the event-topic subscription semantics (DEC-H) at the control plane.
**Scenario Type**: Negative
**Impact Level**: Critical
**Priority**: Critical
**Related IDs**: AC-F2-3, AC-F8-1, AC-F8-3, F-8, DM-6, DEC-H, DEC-L; §8.5
**Test Type(s)**: Behaviour, Contract
**Automation Level**: Automated
**Target Layer / Location**: `tests/behaviour/events-subscribe-refusal.test.ts` (new)
**Harness entry**: `bun test tests/behaviour/events-subscribe-refusal.test.ts`
**Tags**: @backend, @daemon, @errors

**Preconditions / fixture**:
- The real server + session over the in-memory pair, with a recording state edge counting reads.

**Steps**:
1. Send `subscribe { topic: "status" }`; assert an error frame with `error.code === "events.topic-unknown"`, `category: "user"`, `retryable: false`, `consequence: "not_landed"`.
2. Assert the state edge recorded **zero** reads for that refusal (the decision is made from the declaration before any ledger read).
3. Assert no error frame anywhere in the case carries `daemon.state-recovery-failed` for a topic refusal.
4. Send `subscribe { topic: "queue.graph" }`; assert `ok: true` and a `subscriptionId`; assert **no** frame is delivered until the next observed change (no synthetic baseline).
5. Send `subscribe { topic: "queue.graph", since: 42 }`; assert it is accepted (not refused) and that no replay occurs — the first frame after a change carries `sequence: 1`, not a replay from `42`.
6. Send `subscribe { topic: "queue" }`; assert the delivered baseline frame still arrives with `cursor: 0` (snapshot topics unchanged).
7. Assert a refused subscribe leaves the connection usable: a subsequent valid subscribe on the same connection succeeds.
8. Assert the error object's field set is the delivered one and that the frame remains a control error frame (no exit digit on the wire).

**Expected Outcome**:
- One identity for one client mistake, decided before any state read; known event topics accepted without a baseline; `since` accepted and ignored; snapshot topics unchanged.
- A `daemon.state-recovery-failed` refusal, a baseline frame on an event topic, a replay on `since`, or a state read before refusal fails.

#### TC-EVT-080 - The reference surface stays pure and inside its latency and output budgets

**Objective**: Measure the purity, latency, and output bounds the NFR declares, so the mount is cheap by evidence.
**Scenario Type**: Happy Path
**Impact Level**: Important
**Priority**: High
**Related IDs**: AC-NFR-1, AC-F2-4, NFR-1, GAP-T4
**Test Type(s)**: Performance, Behaviour
**Automation Level**: Semi-automated (purity automated; latency evidence recorded and re-run at the gate)
**Target Layer / Location**: `tests/behaviour/events-purity.test.ts` (new)
**Harness entry**: `bun test tests/behaviour/events-purity.test.ts`
**Tags**: @perf, @cli, @purity

**Preconditions / fixture**:
- Recording counters from `TC-EVT-015`; `performance.now()` around the handler call; 5 warm-up invocations then 50 measured per form.

**Steps**:
1. Re-assert zero reads/writes/composers for all four invocation forms (purity half, fully deterministic).
2. Measure p50 and p95 for `events list`, `events list --json`, `events describe queue.graph`, `events describe queue.graph --json`; assert p95 ≤ 100 ms.
3. Assert output bounds: text ≤ 40 lines and ≤ 8 192 bytes for `list` and every `describe`; `--json` output ≤ 8 192 bytes when not pretty-printed and ≤ 65 536 when pretty-printed (the frame bound is not the page bound, so the page bound is asserted on the human page).
4. Print the environment (Bun version, platform, CPU count), the iteration counts, and the measured percentiles in the test output so the evidence is recorded.
5. Assert determinism across the 50 runs (identical bytes), so latency is not measured against a varying workload.

**Expected Outcome**:
- Zero reads/writes/composers; p95 ≤ 100 ms with the measurement recorded; output inside the human bounds; byte-identical repeats.
- A read, a write, a composer call, an over-bound page, or a p95 above the budget fails with the measurement attached.

#### TC-EVT-081 - A publish tick reads each ledger at most once, opens no socket, probes no process, sleeps zero times, and stays inside its added-latency budget

**Objective**: Prove the publish tick's cost budget and non-blocking shape, including the absence of socket, probe, and sleep on the publish path.
**Scenario Type**: Happy Path
**Impact Level**: Important
**Priority**: High
**Related IDs**: AC-NFR-2, NFR-2, NFR-9, GAP-T4
**Test Type(s)**: Performance, Behaviour
**Automation Level**: Semi-automated
**Target Layer / Location**: `tests/behaviour/events-tick-cost.test.ts` (new)
**Harness entry**: `bun test tests/behaviour/events-tick-cost.test.ts`
**Tags**: @perf, @daemon, @backend

**Preconditions / fixture**:
- A counting wrapper around the four source read folds (`readQueueEntries`, `readQueueDependencies`, `readQueueLeases`, the attempt/phase/blocker/lane reads) recording call counts per tick; recording transport, process port, and clock with `sleep` counters.
- The same fixture store measured twice in one run: tick **without** the event projection (baseline) and tick **with** it.

**Steps**:
1. Assert per tick at most one bounded read per source ledger (≤ 4 for the four event planes, plus the delivered snapshot reads), and that the reads are not repeated within a tick.
2. Assert zero socket connects, zero process probes, and zero `sleep` calls on the publish path.
3. Assert the tick does not await a subscriber write: with a full subscriber buffer, the tick completes and another subscriber still receives (NFR-9).
4. Measure p50/p95 tick duration over 50 ticks with and without the event projection; assert added p95 ≤ 25 ms.
5. Record the store shape (entries, dependencies, attempts, phases, blockers) and the environment in the output.
6. Assert no unbounded scan: the number of records read per tick equals a bounded page (not the whole ledger count) when the ledger is large; assert the read returns at most the configured bound.

**Expected Outcome**:
- ≤ 1 read per ledger per tick; zero connects/probes/sleeps; no publish blocked on a subscriber; added p95 ≤ 25 ms with evidence.
- A per-tick full scan, a socket on the publish path, a sleep, or a blocked tick fails.

#### TC-EVT-082 - A burst above the per-tick cap emits the cap, keeps the remainder pending, loses nothing, and keeps bounded state

**Objective**: Prove the burst cap, the watermark pending rule, and zero loss, with the bounded-state substitution recorded.
**Scenario Type**: Corner Case
**Impact Level**: Critical
**Priority**: High
**Related IDs**: AC-NFR-3, NFR-3; AMB-T3c; RSK-2
**Test Type(s)**: Behaviour, Structure
**Automation Level**: Automated
**Target Layer / Location**: `tests/behaviour/events-burst.test.ts` (new); `tests/structure/event-projection-bounds.test.ts` (new)
**Harness entry**: `bun test tests/behaviour/events-burst.test.ts tests/structure/event-projection-bounds.test.ts`
**Tags**: @backend, @events, @bounds

**Preconditions / fixture**:
- 100 dependency changes for one lane appended before a single tick, with the subscriber draining.
- An injected inspector (or a declared read accessor) for the projection's pending state when available; otherwise a source scan substitute (AMB-T3c).

**Steps**:
1. Release one tick; assert at most 64 frames are emitted for that `(topic, lane)` and that the first 64 are the first 64 changes in order.
2. Assert the remaining 36 stay pending (not dropped, not buffered as 36 frames): release further ticks and assert all 36 arrive in order with contiguous sequences.
3. Assert the total emitted equals 100, the lane's sequence series is `1..100` with no gap and no repeat.
4. Assert no lower-than-64-then-64 oscillation: the cap is applied per tick, and the pending remainder is emitted before newly observed changes (attempted in this fixture by appending one more change mid-drain and asserting it arrives last).
5. Assert the pending state is keyed per `(topic, lane)` with at most one entry per lane (inspector), and that the projection module contains no array accumulating events across ticks (source scan) — the AMB-T3c substitute.
6. Assert zero loss: the set of emitted `(ref, edges)` deltas equals the set appended.

**Expected Outcome**:
- Cap respected, remainder pending and emitted later, contiguous sequences, zero loss, bounded per-lane pending state.
- A drop, a reorder, a gap, an unbounded queue, or a cap violation fails.

#### TC-EVT-083 - Every event frame respects the frame bound and an over-bound payload is truncated with the declared marker

**Objective**: Prove the bound and the truncation contract: nothing is silently shortened.
**Scenario Type**: Edge Case
**Impact Level**: Critical
**Priority**: High
**Related IDs**: AC-NFR-4, NFR-5, DM-2
**Test Type(s)**: Behaviour, Contract
**Automation Level**: Automated
**Target Layer / Location**: `tests/behaviour/events-frame-bound.test.ts` (new)
**Harness entry**: `bun test tests/behaviour/events-frame-bound.test.ts`
**Tags**: @backend, @events, @bounds

**Preconditions / fixture**:
- A blocker question at the delivered maximum text length, an answer with maximum `text`, and an attempt with a large `evidenceRefs[]` (at the declared cap).
- A forced over-bound fixture: a payload whose serialized size exceeds `DAEMON_MAX_FRAME_BYTES`.

**Steps**:
1. Emit frames for the maximum-size delivered payloads; assert each encoded line is ≤ 65 536 bytes.
2. Force the over-bound payload; assert the frame is emitted with `payload.truncated === true` and `payload.truncationReason === "frame-max-bytes"`, and that the frame itself is ≤ the bound.
3. Assert the frame still decodes and still carries the eight envelope fields (truncation is inside `payload`).
4. Assert a control (under-bound) payload has no `truncated` key.
5. Assert the truncation is not silent: a scan of the projection shows no path that slices a serialized frame or drops a field without setting the marker.
6. Assert the reference page's per-kind payload bounds are respected by the maximum-size fixtures (no payload field beyond its declared cap).

**Expected Outcome**:
- All frames within the bound; an over-bound payload carries the truncation marker and reason; under-bound payloads carry none.
- A frame above the bound, a silent shortening, or a missing marker fails.

#### TC-EVT-084 - No payload, page, or error carries a credential, token, prompt, transcript, diff, repository content, or `repositoryRoot`

**Objective**: Prove the projection publishes identities, counts, closed values, and bounded text only.
**Scenario Type**: Negative
**Impact Level**: Critical
**Priority**: Critical
**Related IDs**: AC-NFR-5, NFR-10, NFR-4; RSK-8; §20
**Test Type(s)**: Behaviour, Checks
**Automation Level**: Automated
**Target Layer / Location**: `tests/behaviour/events-privacy.test.ts` (new); `tests/checks/event-privacy-literals.test.ts` (new)
**Harness entry**: `bun test tests/behaviour/events-privacy.test.ts tests/checks/event-privacy-literals.test.ts`
**Tags**: @privacy, @backend, @security

**Preconditions / fixture**:
- Canaries planted in every non-publishable field: `repositoryRoot: "/canary/repository-root"`, a lease `lockToken`, an attempt transcript/diff fixture, a credential-looking string, a prompt text, and a bearer token.
- The full-delivery fixture plus the maximum-size fixtures from `TC-EVT-083`.

**Steps**:
1. Run the full-delivery stream and the maximum-size fixtures; collect every emitted frame, every `describe` page, and every error envelope.
2. Assert no canary string appears in any collected output (substring scan for each canary).
3. Assert `repositoryRoot` never appears as a key or a value in any `queue.graph.entry` payload, even though the durable record carries it.
4. Assert every payload key is a member of the kind's declared field list, and that evidence fields (`evidenceRefs[]`) contain identifiers only (no path separator, no diff marker, no newline-count over the declared cap).
5. Assert blocker text is the delivered bounded value and is the only free-form field published; assert no prompt/transcript/diff field exists on any kind.
6. Run the committed privacy-literal scan; assert no new committed private literal was introduced by the taxonomy or the page fixtures.
7. Assert the error envelopes carry only identity fields (`code`, `category`, `retryable`, `consequence`, `summary`, `remediationHint`) and no captured user input beyond the requested topic name.

**Expected Outcome**:
- No canary, no `repositoryRoot`, no credential/token/prompt/transcript/diff, no undeclared payload key; free-form text limited to the blocker plane's bounded value.
- Any canary hit, any `repositoryRoot`, or any undeclared key fails.

## 6. Environments and Test Data

| Environment | Runtime / tool | Invocation | Scope |
|---|---|---|---|
| Local development | Bun (repo pin), pnpm (repo pin) | `bun test tests/structure/event-*.test.ts tests/behaviour/events-*.test.ts` | Declaration, surface, envelope, ordering, overflow, snapshot, additivity |
| Local guards | Bun | `bun run scripts/checks/{help-guide-coverage,prompt-conformance,error-table-sync,exports-parity,ambient-globals,workspace-entrypoints}.ts` | Mount, parity, error table, inventory, purity, boundaries |
| Local conformance | Bun | `bun test tests/conformance/events/real-socket-subscribe.test.ts` | The one bounded real-socket subscription case |
| CI `ts-test` | Bun | `pnpm test` after `pnpm install --frozen-lockfile` | Every `*.test.ts` |
| CI `ts-boundaries` | Bun | `pnpm build`; `pnpm check:boundaries` | Dependency rules, ambient globals, entrypoints, fixture coverage |
| CI aggregate | Bun | `TMPDIR="$PWD/tmp/tmpdir" pnpm check`; `git diff --check` | The full gate battery (the `TMPDIR` caveat in §2 applies) |

**Test data.**

- **Scripted timelines** live in `tests/fixtures/events/taxonomy-cases.ts` (new): one declarative row per emitted kind carrying the appender call, the source record fields, the expected `(topic, kind, lane, ref)`, and the expected payload key set. The row is the single fixture a case replays; adding a kind to the fixture without a declaration fails `TC-EVT-027`.
- **Declaration mutants** live in `tests/fixtures/events/drift-mutants.ts` (new): five drift copies (version, kind, payload field, ordering, overflow) and six integrity violations (duplicate topic, empty kinds, duplicate kind, kind without payload fields, unknown closed value, missing frame field), each naming the case it must trip. Mutants are applied to deep copies in memory or to temp copies on disk; the live tree is never mutated.
- **Overflow fixtures** live in `tests/fixtures/events/overflow-cases.ts` (new): six rows, one per topic, each declaring `subscriptionBuffer`, the change sequence that forces overflow, and the expected degraded `data` key set.
- **Contracted baselines** live in `tests/fixtures/events/{delivered-vocabularies,error-table-baseline,additivity-baseline}.json` (new), captured from the delivered tree before the change: the nine wire types, four frame kinds, three degraded reasons, two stop modes, protocol version/floor, the buffer bound and setting name, the error table minus the `events` kind, the record-kind set, the schema-version constants, the dependency sets, the capsule event-kind set, and the writable-root set. Each baseline is a tree invariant (a committed expectation), never a diff against a moving base branch.
- **Goldens** live in `tests/fixtures/events/goldens/` (new): `events-list.txt`, `events-describe-queue-graph.txt`, `events-describe-lanes.txt`, and the snapshot frame bytes captured from the delivered behaviour. Regenerated only by the documented golden command, with a review diff.
- **Temp roots** are created with the delivered `makeTempRoot`/`mkdtemp` helper under `$REPO_ROOT/tmp/tmpdir/gh290-events-*` and removed in `afterEach`/`finally` including on failure; a guard rejects any root equal to `process.cwd()`, the real user state directory, or `$HOME`.
- **Privacy canaries** are the fabricated strings in `TC-EVT-084`: a repository root, a lock token, a credential-looking value, a bearer token, a prompt text, a transcript fragment, and a diff marker.
- **No real time, no real store, no network**: the clock is injected (`DaemonClockPort` with a fixed `nowIso`), ticks are released by a manual wake port, `sleep` is a recorded no-op, and every socket case is bounded to a temp unix socket under the state directory.

### 6.1 Determinism of the end-to-end subscribe cases

The ticket's first and third acceptance criteria are observed through the delivered server and session, so the plan must show that those observations are deterministic rather than timing-dependent.

- **Baseline priming.** Every event-topic case releases one tick over the store **before** driving its changes, so the projection's first observation is a baseline (the delivered rule: the first observation of a topic is a baseline, not an event) and every later append is an event. The harness exposes `prime()` for that tick, which also asserts it emitted no frame; a case that appends before priming would assert on the baseline path, so priming is a precondition of every emission case, not a convention.
- **Clock.** Every runtime composition receives an injected `DaemonClockPort` whose `nowMs`/`nowIso` return a fixed instant and whose `sleep` resolves immediately and increments a counter. No case waits on wall-clock time; the recorded `occurredAt` values come from the durable records' own timestamps (written with the same injected clock), so `occurredAt` assertions are exact, not approximate.
- **Tick release.** The publish tick is driven by an injected `DaemonWakePort` (`createManualWake` pattern): a tick is released explicitly, and the case drains the subscriber's frames after each release. A case therefore asserts "one tick, one frame" rather than "wait and hope".
- **Sequence allocation.** The sequence is allocated by the projection under test, not by the harness: every case asserts the value the delivered allocator produced (1, 2, 3 …) per `(topic, lane)`. The harness never injects a sequence value; `TC-EVT-032` composes a second, independent runtime over the same store to observe the process-scoped reset. No test depends on inter-tick timing to decide a value.
- **Composition.** The real `createControlServer`, the real `createControlSession` per connection, the real `encodeControlFrame`/`decodeControlLine`, the real production subscribe handler, and the real projection are under test. The only doubles are the transport (`createMemoryTransportPair`, the delivered test seam used by the delivered control suites), the clock, and the wake. `TC-EVT-021` re-proves the same observation over a real unix socket. No case mocks the session, the server, the codec, or the projection.
- **Ordering of observations.** Frames are read from the client connection in write order after a released tick; the harness asserts an exact frame count so a late frame cannot be silently ignored. Where a case needs "no frame", it releases a tick and asserts an empty read plus an unchanged durable record count.
- **Bounded buffer sizing for overflow.** `TC-EVT-040` composes the session with `subscriptionBuffer: 2` and a subscriber that never drains, so overflow is reached in two ticks rather than by racing 256 writes. The second subscriber on the same topic drains each tick, and the assertion is a count (`exactly one degraded frame`) — not a timing window. All six topics use the same bound, making "identical for every topic" a data property.
- **Restart.** `TC-EVT-032` closes the first server and transport and composes a second runtime over the same store; there is no process boundary to race, and the assertion is `sequence === 1` after the restart with `1 <= N` from the previous incarnation.
- **No ambient state.** Each case sets `HOME` and the state-directory binding inside its temp root; no case reads the real user store, the real `$HOME`, the network, or a live harness.

### 6.2 Fixture and isolation rules

- Store handles and edges are closed in `finally`; a fresh reader handle over the same root is opened only after the writer closes.
- Every suite that touches the filesystem records the root and asserts it is not the live tree; the live worktree is never written, and the read-only/golden suites snapshot `git status --porcelain` before and after.
- Injected fakes replace the clock, transport, wake, and recording counters; no default suite touches `process.env` beyond the injected environment record.
- A case that needs an absence asserts it three ways (GAP-T3): a zero counter on the injected seam, an unchanged durable record count, and a byte-level key-set or source scan.

### 6.3 Deliberate non-goals (asserted absent, never exercised)

| Non-goal | How it is asserted, not exercised |
|---|---|
| S17 stop/parked/resumed/park-edge kinds | `TC-EVT-002` (declaration and page token scan), `TC-EVT-027` (emitted set equality), `TC-EVT-070` (stop mode vocabulary unchanged and not a kind). |
| Entry removal and the `remove` emitter | `TC-EVT-016` (declared, `emitted: false`), `TC-EVT-027` (never emitted; no producer branch), `TC-EVT-074` (no new record kind/path). |
| A phase begin record | `TC-EVT-025` (derived, record count unchanged), `TC-EVT-073` (no record kind added). |
| A second taxonomy version or per-client negotiation | `TC-EVT-001` (single `version`), `TC-EVT-011` (one `taxonomyVersion`), `TC-EVT-051` (no stamp on snapshot frames), `TC-EVT-032` (no new ordering value). |
| Control-protocol change (wire type, frame kind, codec rule, protocol version, buffer semantics) | `TC-EVT-070`, `TC-EVT-071`, `TC-EVT-042`. |
| Any new persistence, migration, seed, dependency, telemetry, dashboard, metric, trace, or log | `TC-EVT-073`, `TC-EVT-074`, `TC-EVT-081`. |
| New `--watch` topics or a new watch command | No case; the delivered `queue-watch`/`lanes-watch`/`dispatch-watch` suites pass unmodified as controls (`TC-EVT-050`). |
| `board`, `spend` v2, `attempts` read side, `projects`, cross-repository scoping | Out of the plan's surface; no case names or mounts them. |
| `.opencode/**` or lifecycle-prompt edits | Not tested; the conformance scans (`TC-EVT-063`) would fail a prompt change caught by their rules, and no case asserts a prompt behaviour. |

## 7. Automation Plan and Implementation Mapping

**File-inventory authority.** The paths below are this plan's intended grouping. No implementation plan exists at authoring time; when the delivery plan is authored, its file inventory may consolidate suites (for example one `tests/behaviour/events-subscribe.test.ts` absorbing the four per-topic files) as long as every TC remains its own `test(...)` title and no assertion, counter, fixture, or negative control is dropped. Where the two disagree about a path, the delivery plan wins; where they disagree about an assertion, this plan wins.

**Seam discipline.** The cases compose one of four shapes, declared per case:

| Shape | Cases | Basis |
|---|---|---|
| **S** — pure structure/contract (declaration, comparators, validator, inventories, scans) | 001, 002, 003, 004 (validator half), 005, 006, 016 (union half), 031 (scan half), 041, 042 (vocabulary half), 070, 073, 074 | Imports the declaration and pure functions; no I/O. |
| **C** — command surface over the composition (no runtime input) | 010, 011, 012, 013, 014, 015, 016, 060, 061, 080 | Composes the program, injects an invalid declaration where a case needs it, counts reads/composers. |
| **R** — real control server + real session over a real store (transport/clock/wake injected) | 020, 021 (real socket), 022, 023, 024, 025, 026, 027, 030, 031, 032, 040, 042, 050, 075, 081, 082, 083, 084 | The delivered session/server/codec/projection with the delivered appenders; only transport, clock, and wake are doubles. |
| **G** — guard suites and their mutants (no command invocation) | 062, 063, 064, 072, 071 (codec only), 084 (scan half) | Runs the checks and mutation fixtures. |

A case appears in more than one row only when it asserts both a structural half and a runtime half (for example `TC-EVT-016`'s payload union and its surface rendering); the row records which half needs which shape, and no case is counted twice in the §3.4 totals.

| TC ID | Test file to create or update | Execution command | Mocking / fixtures | Status |
|---|---|---|---|---|
| TC-EVT-001 | `tests/structure/event-taxonomy-declaration.test.ts` (new) | `bun test tests/structure/event-taxonomy-declaration.test.ts` | Shipped `TAXONOMY`; `CONTROL_TOPICS`; ambient scan | To Implement |
| TC-EVT-002 | `tests/structure/event-taxonomy-declaration.test.ts` (new); `tests/checks/event-taxonomy-conformance.test.ts` (new) | `bun test tests/structure/event-taxonomy-declaration.test.ts tests/checks/event-taxonomy-conformance.test.ts` | `taxonomy-cases.ts`; M2 page token scan | To Implement |
| TC-EVT-003 | `tests/structure/event-taxonomy-drift.test.ts` (new) | `bun test tests/structure/event-taxonomy-drift.test.ts` | Five drift mutants; production comparators | To Implement |
| TC-EVT-004 | `tests/structure/event-taxonomy-integrity.test.ts` (new); `tests/behaviour/events-errors.test.ts` (new) | `bun test tests/structure/event-taxonomy-integrity.test.ts tests/behaviour/events-errors.test.ts` | Six violation mutants; injected invalid declaration | To Implement |
| TC-EVT-005 | `tests/structure/event-taxonomy-additive.test.ts` (new); `tests/behaviour/events-decode-additive.test.ts` (new) | `bun test tests/structure/event-taxonomy-additive.test.ts tests/behaviour/events-decode-additive.test.ts` | Synthetic extra payload field; delivered codec | To Implement |
| TC-EVT-006 | `tests/structure/event-taxonomy-single-source.test.ts` (new); `tests/checks/event-taxonomy-conformance.test.ts` (new) | `bun test tests/structure/event-taxonomy-single-source.test.ts tests/checks/event-taxonomy-conformance.test.ts` | Injected declaration copies; literal-array scan | To Implement |
| TC-EVT-010 | `tests/behaviour/events-list.test.ts` (new); `tests/golden/events-reference-page.test.ts` (new) | `bun test tests/behaviour/events-list.test.ts tests/golden/events-reference-page.test.ts` | `events-list.txt` golden; synthetic brand | To Implement |
| TC-EVT-011 | `tests/behaviour/events-list.test.ts` (new) | `bun test tests/behaviour/events-list.test.ts` | Independent declaration projection | To Implement |
| TC-EVT-012 | `tests/behaviour/events-describe.test.ts` (new); `tests/golden/events-reference-page.test.ts` (new) | `bun test tests/behaviour/events-describe.test.ts tests/golden/events-reference-page.test.ts` | Two page goldens; bounds | To Implement |
| TC-EVT-013 | `tests/behaviour/events-describe.test.ts` (new) | `bun test tests/behaviour/events-describe.test.ts` | `list --json` captured in-process | To Implement |
| TC-EVT-014 | `tests/behaviour/events-errors.test.ts` (new) | `bun test tests/behaviour/events-errors.test.ts` | Decision table; invalid declaration; recording counters | To Implement |
| TC-EVT-015 | `tests/behaviour/events-purity.test.ts` (new); `tests/checks/events-hermetic.test.ts` (new) | `bun test tests/behaviour/events-purity.test.ts tests/checks/events-hermetic.test.ts` | Recording edge/config/transport; armed fs/net/spawn guard; empty environment | To Implement |
| TC-EVT-016 | `tests/behaviour/events-describe.test.ts` (new); `tests/structure/event-taxonomy-single-source.test.ts` (new) | `bun test tests/behaviour/events-describe.test.ts tests/structure/event-taxonomy-single-source.test.ts` | Payload expectation table; hand-authored-union mutant | To Implement |
| TC-EVT-020 | `tests/behaviour/events-subscribe-queue-graph.test.ts` (new); `tests/fixtures/events/event-harness.ts` (new) | `bun test tests/behaviour/events-subscribe-queue-graph.test.ts` | Real runtime/server/session; `createMemoryTransportPair`; injected clock + manual wake; temp store | To Implement |
| TC-EVT-021 | `tests/conformance/events/real-socket-subscribe.test.ts` (new) | `bun test tests/conformance/events/real-socket-subscribe.test.ts` | `createUnixTransport`; temp `0700` root; 10 s timeout; `finally` close | To Implement |
| TC-EVT-022 | `tests/behaviour/events-envelope-conformance.test.ts` (new) | `bun test tests/behaviour/events-envelope-conformance.test.ts` | Scripted full-delivery stream; lane-less blocker row | To Implement |
| TC-EVT-023 | `tests/behaviour/events-dependency-delta.test.ts` (new) | `bun test tests/behaviour/events-dependency-delta.test.ts` | Four dependency records incl. an identical rewrite | To Implement |
| TC-EVT-024 | `tests/behaviour/events-subscribe-dispatch.test.ts` (new) | `bun test tests/behaviour/events-subscribe-dispatch.test.ts` | Lane record + five attempt outcomes | To Implement |
| TC-EVT-025 | `tests/behaviour/events-subscribe-phase.test.ts` (new) | `bun test tests/behaviour/events-subscribe-phase.test.ts` | Two `complete` + one `reopen`; record-count oracle | To Implement |
| TC-EVT-026 | `tests/behaviour/events-subscribe-blockers.test.ts` (new) | `bun test tests/behaviour/events-subscribe-blockers.test.ts` | Question/answer/`resumeIntent` fixtures; pre-consume tick | To Implement |
| TC-EVT-027 | `tests/behaviour/events-emitted-kinds.test.ts` (new); `tests/checks/event-taxonomy-conformance.test.ts` (new) | `bun test tests/behaviour/events-emitted-kinds.test.ts tests/checks/event-taxonomy-conformance.test.ts` | Full-delivery fixture; declared-emitted set; remove-emitter mutant | To Implement |
| TC-EVT-030 | `tests/behaviour/events-sequence-per-lane.test.ts` (new) | `bun test tests/behaviour/events-sequence-per-lane.test.ts` | Two subscriber connections; five changes | To Implement |
| TC-EVT-031 | `tests/behaviour/events-sequence-per-lane.test.ts` (new); `tests/structure/event-ordering-contract.test.ts` (new) | `bun test tests/behaviour/events-sequence-per-lane.test.ts tests/structure/event-ordering-contract.test.ts` | Two lanes + second topic; decreasing-`occurredAt` pair; sort/cursor scan | To Implement |
| TC-EVT-032 | `tests/behaviour/events-sequence-restart.test.ts` (new); `tests/checks/event-taxonomy-conformance.test.ts` (new) | `bun test tests/behaviour/events-sequence-restart.test.ts tests/checks/event-taxonomy-conformance.test.ts` | Two sequential runtimes over one store; page `restart`/`repoll` scan | To Implement |
| TC-EVT-040 | `tests/behaviour/events-overflow-parity.test.ts` (new); `tests/fixtures/events/overflow-cases.ts` (new) | `bun test tests/behaviour/events-overflow-parity.test.ts` | `subscriptionBuffer: 2`; one non-draining + one draining subscriber + bystander; six rows | To Implement |
| TC-EVT-041 | `tests/structure/event-overflow-carriage.test.ts` (new); `tests/behaviour/events-overflow-parity.test.ts` (new) | `bun test tests/structure/event-overflow-carriage.test.ts tests/behaviour/events-overflow-parity.test.ts` | Captured frames; `"drop"` constant mutant; second-literal scan | To Implement |
| TC-EVT-042 | `tests/behaviour/events-overflow-parity.test.ts` (new); `tests/structure/event-control-vocabulary.test.ts` (new) | `bun test tests/behaviour/events-overflow-parity.test.ts tests/structure/event-control-vocabulary.test.ts` | `subscriptionBuffer: 2`; config key-set comparison | To Implement |
| TC-EVT-050 | `tests/behaviour/events-snapshot-preserved.test.ts` (new) + five delivered suites as controls | `bun test tests/behaviour/events-snapshot-preserved.test.ts tests/behaviour/{control-session,control-connection,daemon-watch-state-changes,queue-watch,lanes-watch}.test.ts` | Snapshot golden bytes; snapshot-topic overflow row | To Implement |
| TC-EVT-051 | `tests/behaviour/events-describe.test.ts` (new) | `bun test tests/behaviour/events-describe.test.ts` | `list`/`describe` records for `queue`/`lanes` | To Implement |
| TC-EVT-060 | `tests/structure/events-production-composition.test.ts` (new); `tests/behaviour/entrypoint-composition.test.ts` (update) | `bun test tests/structure/events-production-composition.test.ts tests/behaviour/entrypoint-composition.test.ts` | Injected facts; recording factories; membership-omission and conditional-registration mutants | To Implement |
| TC-EVT-061 | `tests/behaviour/events-mount-help.test.ts` (new); `tests/behaviour/entrypoint-help.test.ts` (update) | `bun test tests/behaviour/events-mount-help.test.ts tests/behaviour/entrypoint-help.test.ts` | Counting composer; synthetic brand; help bounds | To Implement |
| TC-EVT-062 | `scripts/checks/help-guide-coverage.ts` (update); `tests/fixtures/help-guide/coverage.json` (update); `doc/planning/oss-tooling/milestones/m2/commands/events.md` (update, phase 7) | `bun run scripts/checks/help-guide-coverage.ts`; `bun test tests/checks/help-guide-coverage.test.ts tests/checks/reference-page-parity.test.ts` | Page-root row; page `--help`/`--version`; inventory rows | Existing – Update |
| TC-EVT-063 | `tests/structure/inventory.json` (update); `tests/structure/content-inventory.test.ts`; `tests/checks/exports-parity.test.ts`; `scripts/checks/prompt-conformance.ts` | `bun run scripts/checks/prompt-conformance.ts`; `bun test tests/structure/content-inventory.test.ts tests/checks/exports-parity.test.ts tests/checks/prompt-conformance.test.ts` | File-set and v1-contract inventory rows; export allowances | Existing – Update |
| TC-EVT-064 | `tests/checks/help-guide-coverage-mutants.test.ts` (update); `tests/checks/event-mount-guards.test.ts` (new); `tests/fixtures/events/mount-mutants.ts` (new) | `bun test tests/checks/help-guide-coverage-mutants.test.ts tests/checks/event-mount-guards.test.ts` | Eight temp-copy mutants | To Implement |
| TC-EVT-070 | `tests/structure/event-control-vocabulary.test.ts` (new); `tests/structure/daemon-vocabulary.test.ts` (control) | `bun test tests/structure/event-control-vocabulary.test.ts tests/structure/daemon-vocabulary.test.ts` | `delivered-vocabularies.json`; emitted-frame key sets | To Implement |
| TC-EVT-071 | `tests/behaviour/events-decode-additive.test.ts` (new); `tests/behaviour/control-codec.test.ts` (control) | `bun test tests/behaviour/events-decode-additive.test.ts tests/behaviour/control-codec.test.ts` | Serialized additive frames; four negative controls | To Implement |
| TC-EVT-072 | `tests/structure/error-table.test.ts` (update); `tests/checks/error-table-sync.test.ts`; `doc/spec/features/feature-result-contract.md` (update, phase 7) | `bun test tests/structure/error-table.test.ts tests/checks/error-table-sync.test.ts`; `bun run scripts/checks/error-table-sync.ts` | `error-table-baseline.json`; three-row `events` kind | Existing – Update |
| TC-EVT-073 | `tests/structure/event-state-additivity.test.ts` (new); `tests/structure/state-contract.test.ts` (control) | `bun test tests/structure/event-state-additivity.test.ts tests/structure/state-contract.test.ts` | Schema/kind/prefix fixtures; record-count oracle | To Implement |
| TC-EVT-074 | `tests/structure/event-additivity-inventory.test.ts` (new) | `bun test tests/structure/event-additivity-inventory.test.ts` | `additivity-baseline.json`; manifest/lockfile parse; capsule event set | To Implement |
| TC-EVT-075 | `tests/behaviour/events-subscribe-refusal.test.ts` (new) | `bun test tests/behaviour/events-subscribe-refusal.test.ts` | Real server/session; `status`/unknown/known/`since` requests; read counter | To Implement |
| TC-EVT-080 | `tests/behaviour/events-purity.test.ts` (new) | `bun test tests/behaviour/events-purity.test.ts` | Recording counters; 5 warm-up + 50 measured; `performance.now()` | To Implement |
| TC-EVT-081 | `tests/behaviour/events-tick-cost.test.ts` (new) | `bun test tests/behaviour/events-tick-cost.test.ts` | Counting read wrapper; transport/probe/sleep counters; same-run baseline | To Implement |
| TC-EVT-082 | `tests/behaviour/events-burst.test.ts` (new); `tests/structure/event-projection-bounds.test.ts` (new) | `bun test tests/behaviour/events-burst.test.ts tests/structure/event-projection-bounds.test.ts` | 100-change burst; pending-state inspector or scan | To Implement |
| TC-EVT-083 | `tests/behaviour/events-frame-bound.test.ts` (new) | `bun test tests/behaviour/events-frame-bound.test.ts` | Max-size delivered payloads; forced over-bound fixture | To Implement |
| TC-EVT-084 | `tests/behaviour/events-privacy.test.ts` (new); `tests/checks/event-privacy-literals.test.ts` (new) | `bun test tests/behaviour/events-privacy.test.ts tests/checks/event-privacy-literals.test.ts` | Privacy canaries; full-delivery + max-size outputs | To Implement |

**Delivered suites used as unmodified controls:** `tests/behaviour/{control-codec,control-conformance,control-session,control-connection,control-transport,watch-stream,daemon-lifecycle,daemon-watch-state-changes,queue-watch,lanes-watch,queue-cli,lanes,entrypoint-help,entrypoint-help-coverage,entrypoint-composition}.test.ts`, `tests/structure/{queue-scheduling-contract,daemon-vocabulary,daemon-contract,state-contract,error-table,envelope-contract}.test.ts`, `tests/golden/{queue-list,lanes-list}.test.ts`, `tests/checks/{doc-conformance,reference-page-parity,help-guide-coverage,error-table-sync,exit-code-literals}.test.ts`. Any change to one of these assertions outside the declared mount rows (the prompt-required enumeration, the coverage fixture, the page-root row, the inventories, and the export allowances) is a finding, not an adjustment.

**Not changed, deliberately:** `tests/checks/doc-conformance.test.ts`'s page list is not extended (§8.5 precedent: it already omits `dispatch`, `coordinator`, and `projects`; `events`' `--help`/`--version` coverage is carried by the help-coverage guard, `TC-EVT-062`).

## 8. Risks, Assumptions, and Open Questions

### 8.1 Risks

| ID | Risk | Mitigation in this plan |
|---|---|---|
| TR-1 | A hand-written surface passes a "counts look right" test | `TC-EVT-006` mutates one declaration and asserts both consumers move; `TC-EVT-003` localizes five drift classes; a literal-array scan catches a second copy. |
| TR-2 | The kind set is taken from the planning page's example counts | `TC-EVT-002` asserts exact ordered sets and the 4/3/3/3 counts; the page is token-scanned for S17 names and for the reconciled counts. |
| TR-3 | `sequence` is silently treated as durable or globally ordered | `TC-EVT-031` constructs a decreasing-`occurredAt` pair and scans for time/cursor ordering; `TC-EVT-032` restarts the counter over a populated store and asserts no seeding or replay. |
| TR-4 | Overflow passes on one topic and regresses on another | `TC-EVT-040` is a six-row parity table at `subscriptionBuffer: 2`, asserting the exact four-key degraded `data`, one frame per subscription, drop isolation, and no tick block. |
| TR-5 | The snapshot topics are quietly enriched | `TC-EVT-050` asserts three-key frames, `cursor: 0` baselines, change-only advancement, and byte-equality with a delivered golden; five delivered suites run unmodified. |
| TR-6 | The mount looks done because the family name is registered | `TC-EVT-064` removes each of the six pieces plus both inventory rows and requires a named guard failure; `TC-EVT-062`/`TC-EVT-063` assert both directions. |
| TR-7 | A declared-but-unemitted kind hides a missing emitter | `TC-EVT-027` asserts emitted set equality in both directions, so every `emitted: true` kind must appear and `remove` must not. |
| TR-8 | The event projection makes the tick expensive or blocks on a slow consumer | `TC-EVT-081` counts reads/connects/probes/sleeps and measures added p95 against a same-run baseline; `TC-EVT-040`/`TC-EVT-081` assert no tick block; `TC-EVT-082` bounds the pending state. |
| TR-9 | A payload leaks a path, token, or transcript | `TC-EVT-084` plants canaries in every non-publishable field and scans frames, pages, and errors; `repositoryRoot` is asserted absent by key and value. |
| TR-10 | Timing assertions are flaky on CI | Latency cases are `Semi-automated` with recorded measurements and a gate re-run (GAP-T4); equality assertions never depend on wall-clock order. |
| TR-11 | The `TMPDIR` tmpfs issue breaks the aggregate gate | The canonical invocation is `TMPDIR="$PWD/tmp/tmpdir" pnpm check` (§2). |

### 8.2 Assumptions

- The delivered control codec leaves the event `data` body open and validates only the delivered invariants; `TC-EVT-071` asserts this and the negative controls prove no relaxation.
- The four event topics' source ledgers and folds are available and read-only for the daemon; each emitted kind maps to exactly one of them (Appendix E), asserted by `TC-EVT-020`..`TC-EVT-027`.
- The declaration is injected into the `events` runtime and into the projection through one seam, defaulting to the shipped constant; `TC-EVT-004`/`TC-EVT-006` need that seam, and its absence is a named failure (GAP-T5), not a skip.
- The publish tick accepts an injected manual wake and clock in tests; the delivered suites already compose this way (`daemon-watch-state-changes.test.ts`).
- A snapshot topic's single-kind `payloadFields` list is delivered data, not invented by this plan; `TC-EVT-051` asserts the derivation invariant and the absence of envelope fields rather than guessing its exact contents.
- Baselines (vocabularies, error table minus `events`, record kinds, schema versions, dependency sets, capsule events) are captured from the delivered tree before the change and committed as tree invariants, never as a branch diff.

### 8.3 Open Questions

- **OQ-A (non-blocking, owner `@reviewer`)** — Does any consumer outside the repository decode an event `data` body strictly enough to reject the added fields? The specification carries this as OQ-1; `TC-EVT-071` proves the additive decode for the delivered codec, and `TC-EVT-005` proves an extra payload field is tolerated. Review-confirmed only.
- **OQ-B (deferred, owner `@pm`)** — Does a client need a sequence that survives a restart? v1 declares the restart a discontinuity (DEC-I); `TC-EVT-032` asserts the declared behaviour and the documented remedy. A durable sequence is a recorded follow-up (§7.3), not a gap in this plan.
- **OQ-C (non-blocking, owner `@test-plan-writer`/`@reviewer`)** — The pending-watermark inspector used by `TC-EVT-082` may not exist; the case then uses the source-scan substitute recorded in AMB-T3c, which must be stated in the test output rather than silently swapped.

## 9. Plan Revision Log

| Version | Date | Author | Changes |
|---|---|---|---|
| 1.0 | 2026-11-11 | `@test-plan-writer` | Initial test plan for GH-290 / M2-S13: 45 cases binding all 38 acceptance criteria (33 capability + 5 non-functional), with the six-topic and kind-set equality, five drift classes, the integrity/exit matrix, single-source mutation proof, the end-to-end `queue.graph` subscription through the delivered session/server (plus a bounded real-socket variant), envelope conformance, per-`(topic, lane)` ordering and restart scope, six-topic overflow parity with the additive stamp and the one-constant proof, byte-identical snapshot preservation, the mount as one unit with eight guard-negative controls, additivity and the exactly-three-row error table, the delivered refusal-identity change, and the measured NFRs. Records the two declared gaps (`remove` unemitted, `began` derived), the S17 boundary, three substitute assertions (AMB-T1..T3b, plus AMB-T3c), and the determinism method for the end-to-end cases. |

## 10. Test Execution Log

Populated during execution. This section is intentionally empty at authoring time: nothing in this plan has been executed against a new implementation.

### 10.1 Per-TC results

| TC ID | Run Date | Result | Notes |
|---|---|---|---|
| TC-EVT-001 … TC-EVT-084 | — | Not run | To be populated at delivery and quality-gate time |

### 10.2 Aggregate gate evidence

| Gate | Command | Result | Notes |
|---|---|---|---|
| Typecheck | `pnpm typecheck` | Not run | — |
| Lint / format | `pnpm lint`, `pnpm format:check` | Not run | — |
| Tests | `bun test tests/structure tests/behaviour tests/checks tests/golden` | Not run | — |
| Boundaries | `pnpm check:boundaries` | Not run | — |
| Help/parity/inventories | `bun run scripts/checks/{help-guide-coverage,prompt-conformance,error-table-sync,exports-parity}.ts` | Not run | — |
| Aggregate | `TMPDIR="$PWD/tmp/tmpdir" pnpm check` | Not run | The `TMPDIR` caveat in §2 applies |
| Diff hygiene | `git diff --check` | Not run | — |

### 10.3 Deviations and observations

| Date | TC ID | Observation | Disposition |
|---|---|---|---|
| — | — | — | — |
