---
ados_distribution: internal
id: TEST-SPEC-RESIDENT-DAEMON
status: Current
created: 2026-11-08
last_updated: 2026-11-08
owners: ["engineering"]
service: delivery-os
links:
  related_changes: ["GH-238"]
  feature_spec: doc/spec/features/feature-resident-daemon.md
---

# Test Specification: Resident Dispatch Daemon

## Overview

The resident-daemon suite protects one property: a resident supervisor is safe
only when it is optional, single-instance, and reconstructible from state alone.
The suite fails if two daemons can drive one state directory; if a live lock is
taken over or a stale takeover lacks evidence; if any command needs the socket to
complete; if a frame carries a fact that cannot be re-derived from state or a
secret that should never transit; if a slow subscriber stalls the dispatcher or
receives another connection's response; if a kill/restart guesses a lane's fate,
re-executes a completed phase, increments a restart twice, or silently requeues a
delivery past budget; if an external effect re-applies after `unknown` without a
query; if a preemption kills a live session; if a daemon-down one-shot fails,
blocks, or claims a false all-clear; if a watch emits a silent empty stream; if
the resident poller exceeds its configured rate; if `install` silently no-ops on
an unsupported platform; or if a merge invocation becomes reachable from the
daemon composition.

## Test Scope

- Components under test: the daemon contracts
  (`packages/core/src/contracts/{daemon,control,effects,principal}.ts`), the pure
  daemon domain modules (`packages/core/src/domain/{daemon-lock,daemon-heartbeat,
  daemon-lane,daemon-reconcile,daemon-preemption,daemon-status,daemon-supervisor,
  control-codec,control-session,effect-protocol,poll-policy,watch-stream}.ts`),
  the app tier (`packages/core/src/app/{daemon,daemon-runtime,daemon-reconcile,
  daemon-supervision,daemon-preemption,daemon-status,daemon-supervisor,effects,
  polling,watch,control-server}.ts`), the adapter daemon subpath
  (`packages/adapters/src/daemon/**` and the additive
  `CommitGitPort.logSince` in `packages/adapters/src/git/commit.ts`), the CLI
  daemon surface (`packages/cli/src/commands/daemon.ts`,
  `packages/cli/src/daemon-compose.ts`, `packages/cli/src/daemon-main.ts`, and the
  additive `--watch`/stream seams in `packages/cli/src/{index,edge,output}`), and
  the `daemon` and `poll` configuration branches plus the eight `daemon` error
  rows.
- Contracts under test: the seven additive record kinds, the nine closed wire
  types and four interaction classes, the eight error rows synchronized with
  [the result contract](../../spec/features/feature-result-contract.md), the
  config branches, the closed degradation-marker and `mergeCodePath` sets, and
  the merge-absence dependency rule.
- Exclusions: no live tracker, VCS, or CI write; no live systemd/launchd/Windows
  service manager; no real disk exhaustion; no unbounded sleep; no measured
  performance budget beyond the deterministic dispatch-latency assertion. The
  full typed dispatch loop, prompt selection, dual-run evidence, per-repo
  handover, and full session resume belong to M1-S9.

## Test Levels

### Unit and Contract Tests

- `tests/behaviour/control-codec.test.ts` — frame envelope, closed wire-type set,
  v1/v0 validation, byte bound, and unsupported-version refusal.
- `tests/behaviour/control-session.test.ts` — version negotiation, bounded
  subscriptions, one degraded event on overflow, request timeouts, and
  at-most-once control dedupe keys.
- `tests/behaviour/daemon-heartbeat.test.ts` — heartbeat payload, monotone
  ordinal, and the running/stale/stopped fold with no fabricated beat.
- `tests/behaviour/watch-stream.test.ts` — bounded snapshots, deduplication,
  finding-coded events, frame-bound truncation, the overflow fallback, the real
  transport subscription/in-memory connection path, live state-change
  publication through the real control server, and the failed-connect
  degraded-polling fallback.
- `tests/behaviour/daemon-effects.test.ts` — the effect state machine, the
  commit `logSince` path-set match and its fail-closed `unknown` outcomes
  (a mismatch is `not-found`, multiple commits are `unreadable`, neither carries
  a SHA), the DM-18 `attempt: 0` redrive detection, replay idempotency of the
  intent append, and the concurrent same-key dedupe under one fence.
- `tests/behaviour/config-resolver.test.ts` — the daemon and poll branches plus
  the state-directory scope: the production brand prefix shape
  (`<PREFIX>_STATE_DIR`, one separator), the installed unit's `Environment=`
  name round-trip, the two-scope positive, the wrong-spelling negative, and
  absolute-only validation.
- `tests/types/daemon-protocol.type-test.ts` — compile-time protocol shapes.
- `tests/checks/daemon-determinism.test.ts` — identical-run status, reconciliation,
  and watch-snapshot output.

### Behaviour and Integration Tests

- `tests/behaviour/daemon-lifecycle.test.ts` — start/stop/status at readiness,
  foreground versus resident, drain and immediate stop, state-first stop with no
  lane signal, the resident heartbeat/supervision/effect/blocker cadence, the
  `status --live` transport probe, the already-running holder evidence, and the
  failed-start lock release with a terminal instance record.
- `tests/behaviour/daemon-lock.test.ts`, `daemon-lock-concurrency.test.ts` — live
  lock refusal with holder evidence, stale takeover with full evidence, two-scope
  isolation, 100-contender single acquisition, and the lock/fence separation.
- `tests/behaviour/daemon-state-mediation.test.ts` — daemon-down queue and
  blocker intents, the `daemon-unreachable` marker, reconciliation making
  intents effective, and the blocker-answer resume intent recorded only when a
  delivering lane exists.
- `tests/behaviour/control-connection.test.ts`, `control-conformance.test.ts`,
  `control-transport.test.ts`, `tests/fixtures/daemon/transport/pair.ts` — the
  multi-connection single-loop dispatcher, cross-connection isolation, stdio
  transport independence, unix permissions, and concurrent `status --live`.
- `tests/behaviour/daemon-reconciliation.test.ts`,
  `daemon-reconciliation-crash.test.ts` — alive/interrupted/crashed
  classification, evidence-insufficient hold, ledger resume, one restart per
  interruption, terminal budget exhaustion, typed question, unreadable-state
  refusal, the folded active park count, the measured duplicate count, and zero
  duplicated artifacts.
- `tests/behaviour/daemon-lane-supervision.test.ts` — claim/spawn/record/observe/
  release, no in-process delivery work, the supervise-only degradation, prefill
  safety, corroborated-stall handling with restart admission, and the distinct
  lane execution set.
- `tests/behaviour/daemon-preemption.test.ts` — pending active-session
  preemption, boundary apply, restart re-evaluation, immediate no-session apply,
  and single-flight.
- `tests/behaviour/daemon-degradation.test.ts` — the one-shot matrix daemon-down
  and the plain-status/`--live` split, including the stale/unreachable markers
  and the economics restart-counter fold.
- `tests/behaviour/queue-watch.test.ts`, `lanes-watch.test.ts` — accepted
  `--watch`, bounded snapshots, deduplicated events, interruption exit `0`, and
  a declared degraded marker without a daemon.
- `tests/behaviour/daemon-polling.test.ts` — exponential backoff, success reset,
  minimum spacing, and read-seam-only polling.
- `tests/behaviour/daemon-supervisor-install.test.ts` — scoped systemd unit,
  linger enablement and rollback, uninstall scoping, unsupported platforms, and
  a composition with no supported adapter refusing instead of reporting
  installed.
- `tests/behaviour/commit-act.test.ts`, `commit-convergence.test.ts`,
  `phase-atomic.test.ts` — the additive `logSince` read, the production
  `phase complete` wrapper writing the intent before the commit, the owner's
  redrive-evidence restoration through the delivered convergence row, and the
  post-crash convergence with no second commit.

### Golden Tests

- `tests/golden/daemon-lifecycle.test.ts`, `daemon-status-matrix.test.ts`,
  `daemon-install.test.ts` — deterministic envelopes and the plain-status versus
  `--live` matrix.
- `tests/golden/lanes-watch-accepted.test.ts`, `watch-refusal-absent.test.ts`,
  `watch-unreadable.test.ts` — accepted watch output, the declared degraded
  marker, and exit `2` on unreadable state.

### Structure, Check, and Boundary Tests

- `tests/structure/daemon-contract.test.ts`, `daemon-vocabulary.test.ts`,
  `daemon-imports.test.ts`, `config-contract.test.ts`, `error-table.test.ts`,
  `tests/checks/daemon-vocabulary.test.ts`, `error-table-sync.test.ts` — the
  closed vocabularies, the seven record kinds, eight error rows, two config
  branches, the optional caller principal, and bidirectional documentation sync.
- `tests/checks/daemon-bounds.test.ts`, `daemon-hermetic.test.ts`,
  `daemon-mutants.test.ts`, `privacy-literals.test.ts`,
  `secret-read-boundary.test.ts` — explicit bounds, hermetic guards, mutation
  controls, and secret/payload safety.
- `tests/boundaries/boundaries.test.ts` and `.dependency-cruiser.cjs` — the
  daemon merge-absence rule over core daemon app/domain, the CLI daemon surface,
  and the adapters daemon subpath, plus the injected-executor
  `mergeCodePath: "present"` reachability proof (no import edge).

## Test Data

- Every integration suite uses a per-test temporary state root through
  `tests/fixtures/state/harness.ts`; teardown removes it and no live store is
  committed.
- The clock, transport, process supervisor, lane executor, external-effect
  adapter, platform supervisor, launch planner, and recovery persistence are
  injected. The stdio conformance tier uses the in-memory transport pair, never a
  real socket.
- Golden cases render the socket path as the normalized
  `<state-dir>/daemon.sock` placeholder; the real absolute path never appears in a
  fixture.
- Commit-effect tests use the commit harness and a bounded in-memory log reader;
  the git adapter's `logSince` is covered separately by its own adapter-level
  cases.

## Test Scenarios

### Scenario: Kill and restart without duplication

- **Given** a state directory with an `acquired` instance record, delivering and
  detached lanes, and a pending commit effect,
- **When** the daemon is restarted,
- **Then** every in-flight lane is classified exactly once as `alive`,
  `interrupted`, or `crashed`, an interrupted lane resumes from its ledger
  position, and exactly one restart is consumed through the delivered gate,
- **And** zero tickets, comments, or commits are duplicated; a detected commit
  produces a DM-18 redrive request and the owner restores the phase binding.

### Scenario: Single-instance ownership

- **Given** one live daemon holding `daemon.lock`,
- **When** a second `daemon start` runs,
- **Then** it refuses `daemon.already-running` at exit `1`, names the holder's
  instance, process, acquisition time, and heartbeat age, and appends nothing,
- **And** a lock whose heartbeat age is at or beyond `daemon.lock-staleness` is
  taken over with previous-instance, previous-token, last-heartbeat, heartbeat-age,
  and takeover-time evidence.

### Scenario: Daemon-down one-shot continuity

- **Given** no reachable daemon,
- **When** a queue mutation, blocker answer, `phase complete`, or `commit` runs,
- **Then** the intent lands through the state fence at exit `0`,
- **And** the queue/lanes payload carries `degraded: ["daemon-unreachable"]` while
  the marker is absent once the daemon is reachable.

### Scenario: Safe-boundary preemption

- **Given** a computed preemption for a close item and a preempted lane with an
  active session,
- **When** the daemon applies the preemption,
- **Then** it records a durable `pending` preemption and sends no signal,
- **And** at the next phase boundary or on completion it releases, parks with
  `preempted-for-close-item` and condition type `preemption`, and names the close
  item; a no-session lane releases and parks immediately.

### Scenario: Commit crash safety

- **Given** the production `phase complete` path has written a pre-commit
  `outbox.effect` carrying baseline HEAD, change ref, phase, and the sorted
  normalized staged path set before the commit primitive ran,
- **When** recovery performs one bounded `logSince(baselineHead)` read,
- **Then** the effect is `already-applied` only for exactly one new commit whose
  changed-path set equals the recorded set,
- **And** zero, multiple, mismatch, unreadable, or over-cap stays `unknown` with
  no automatic re-apply and no guessed SHA; a mismatch is `not-found`, multiple
  commits are `unreadable`, and the daemon detection records that same verdict
  without a discovered SHA.

### Scenario: Protocol isolation

- **Given** two concurrent stdio connections,
- **When** each sends requests and one subscriber overflows its buffer,
- **Then** every response returns only on its asking connection,
- **And** the overflowing subscription receives one `degraded` event and is
  dropped while the dispatcher keeps serving the other connection.

### Scenario: Truthful watch

- **Given** readable state and no reachable daemon,
- **When** `queue --watch` or `lanes --watch` runs,
- **Then** it prints a bounded snapshot, names `daemon-unreachable`, prints only
  changed snapshots, and exits `0` on interruption,
- **And** unreadable state exits `2` with the delivered `state.*` identity rather
  than polling a lie.

### Scenario: Live watch on a reachable daemon

- **Given** a reachable daemon and a subscription on the `queue` or `lanes` topic,
- **When** the topic's published snapshot changes on a resident tick,
- **Then** the watch prints a second bounded event line carrying the changed
  snapshot,
- **And** a tick whose published snapshot is unchanged publishes nothing, so the
  same snapshot is never printed twice.

## Security and Privacy Tests

- No credential value, prompt, message body, transcript, diff, raw provider
  payload, or absolute repository root appears in a frame, record, status
  payload, golden, or log line; the daemon lock token is the sole exempt
  same-user ownership capability and appears only in the three control payloads
  and durable lock/instance records.
- The execution-environment allowlist and the secret-read boundary are covered by
  `tests/checks/privacy-literals.test.ts` and
  `tests/checks/secret-read-boundary.test.ts`.
- Cross-user socket access is refused through the delivered
  `state.permission.denied`; a socket path outside the state directory is
  `config.value.invalid`.

## Coverage Map

| Capability | Primary suites |
|---|---|
| F-1 lifecycle and envelopes | `daemon-lifecycle`, `daemon-status-matrix`, `daemon-install` goldens, `config-resolver` |
| F-2 single-instance lock | `daemon-lock`, `daemon-lock-concurrency` |
| F-3 state-mediated truth | `daemon-state-mediation`, `daemon-degradation` |
| F-4 protocol v1 | `control-codec`, `control-session`, `control-conformance` |
| F-5 layered transport | `control-transport`, `daemon-hermetic` |
| F-6 connection concurrency | `control-connection`, `control-conformance` |
| F-7 heartbeat and status | `daemon-heartbeat`, `daemon-lifecycle` |
| F-8 reconciliation | `daemon-reconciliation`, `daemon-reconciliation-crash` |
| F-9 lane supervision | `daemon-lane-supervision` |
| F-10 external effects | `daemon-effects`, `commit-act` |
| F-11 safe-boundary preemption | `daemon-preemption` |
| F-12 daemon-down continuity | `daemon-degradation`, `daemon-state-mediation` |
| F-13 bounded watch | `queue-watch`, `lanes-watch`, `watch-stream`, watch goldens |
| F-14 polling discipline | `daemon-polling` |
| F-15 supervisor install | `daemon-supervisor-install`, `daemon-install` golden, `config-resolver` unit round-trip |
| F-16 vocabulary growth | `daemon-vocabulary`, `daemon-contract`, `error-table-sync` |
| F-17 merge absence | `daemon-imports`, `tests/boundaries`, dependency-cruiser |
| NFR-1/9/12/13 bounds, determinism, privacy | `daemon-determinism`, `daemon-bounds`, `privacy-literals` |

## Known Gaps

- TC-STATE-004 and TC-STATE-005 (poke/tail/timeout wake durability) have no
  dedicated suite; wake loss is covered indirectly by the state-mediated
  continuity suites. The change test plan records this as the two named gaps.
- `queue-watch` and `lanes-watch` drive the command definition with an injected
  watch generator. The production subscription path — `watchLines` opening the
  configured transport, sending `subscribe`, and consuming bounded deduplicated
  events — is covered through the in-memory control transport in `watch-stream`,
  not a live unix socket from the binary's composition root. The daemon
  composition's live `stateChanges` snapshot source is also exercised only
  through the injected control-server test, not end-to-end from the binary.
- No production tracker-transition or tracker-comment write adapter exists, so
  those effect channels are proven against injected effect ports only.

## Running the Suites

```bash
bun test tests/behaviour/daemon-*.test.ts
bun test tests/behaviour/control-*.test.ts
bun test tests/behaviour/queue-watch.test.ts tests/behaviour/lanes-watch.test.ts tests/behaviour/watch-stream.test.ts
bun test tests/golden/daemon-*.test.ts tests/golden/*watch*.test.ts
bun test tests/structure/daemon-*.test.ts tests/checks/daemon-*.test.ts
```

The aggregate gate is `pnpm check`; no suite spawns a live network call, reads a
real credential, or sleeps without a bound.
