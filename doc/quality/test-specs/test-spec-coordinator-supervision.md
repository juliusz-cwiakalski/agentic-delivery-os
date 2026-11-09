---
ados_distribution: internal
id: TEST-SPEC-COORDINATOR-SUPERVISION
status: Current
created: 2026-11-09
last_updated: 2026-11-09
owners: ["engineering"]
service: delivery-os
links:
  related_changes: ["GH-241"]
  feature_spec: doc/spec/features/feature-coordinator-supervision.md
---

# Test Specification: Coordinator Supervision

## Overview

The coordinator-supervision suite protects one property: a coordinator session is
managed exactly as safely as a lane session, and every claim it makes is backed by
durable evidence rather than a fabricated fact. The suite fails if two supervisors
can drive one state directory; if a live holder is taken over regardless of age;
if a lifecycle decision is applied without being recorded first; if closed-out
phase, merge, or answer artifacts are re-executed; if an `unknown` reading is
fabricated as stale or a CPU reading participates; if a kill signals an
unverified pid; if a
restart ordinal is lost, duplicated, or silently reset; if exhaustion publishes a
second question or no question; if a wake is delivered for a question that is not
rank-1 open; if `--fresh-budget` is forgotten by a later command; if `status`
mutates or evaluates state; or if the shipped binary cannot reach the family.

## Test Scope

- Components under test: the coordinator vocabulary
  (`packages/core/src/contracts/coordinator.ts`), the pure coordinator domain
  (`packages/core/src/domain/coordinator-*.ts`), the coordinator record consumer
  (`packages/core/src/state/coordinator.ts`), the CLI surface
  (`packages/cli/src/commands/coordinator.ts`,
  `packages/cli/src/commands/coordinator-loop.ts`,
  `packages/cli/src/output/coordinator-text.ts`), the additive process-port
  capability and kill helper (`packages/adapters/src/daemon/process.ts`), the
  new-turn mapping (`packages/adapters/src/harness/liveness.ts`), the production
  composition (`packages/cli/src/production.ts`), the reserved escalation slot in
  the digest and brief projections, and the `coordinator` configuration branch
  with its six error rows.
- Contracts under test: six additive record kinds and payload schemas, six config
  keys, six error identities (two two-segment allowlist additions and four
  three-segment), the closed decision/restart/stuck/wake/fence vocabularies, the
  `delivery.coordinator.v1` observation shape, and the four-way capability
  ownership split.
- Exclusions: no real harness session, no real signal, no real user state
  directory, and no live tracker, CI, or network read. The Windows process start
  time and the non-Linux branch are platform-conditional; on Linux the shipped
  reader is exercised against the running test process, and elsewhere the same
  case asserts the absent reading. Coordinator OS-unit hosting, detached
  supervision, and an installer are out of scope (M1-S18 seam).

## Test Levels

### Unit and Contract Tests

- `tests/structure/coordinator-contract.test.ts` — six record kinds with distinct
  payload schemas, the closed vocabularies, foreground-only supervisor mode with a
  reserved `detached`, the six config keys, the six error identities, the two
  state-fence rules with distinct refusal identities, the payload-only reserved
  slot predicate, the regime and capability declarations, and a data-only module.
- `tests/behaviour/coordinator-decision-{join,resume,spawn}.test.ts`,
  `coordinator-ordinals.test.ts` — the pure join/resume/spawn decision, its closed
  reasons, and the ordinal accounting for all six outcomes.
- `tests/behaviour/coordinator-stuck-{verdict,matrix,fingerprint,reason,
  corroborator,unknown,unevaluable,torn}.test.ts` — the three-class evidence
  matrix, the state-sourced fingerprint, the prefill-safety veto, `unknown` never
  fabricated as stale, and the all-unknown `unevaluable` path.
- `tests/behaviour/coordinator-restart-{admit,durability,namespace,torn}.test.ts`,
  `coordinator-budget-config.test.ts` — contiguous admission, the durable
  per-epoch fold, namespace disjointness, torn-ordinal classification, and
  configuration-driven bounds including budget `0`.
- `tests/behaviour/coordinator-wake-{pickup,dedupe,answered,next,failed}.test.ts`
  — the strict pickup predicate, one wake per question lifetime, the answered and
  delivery-failure outcomes, and the new-question path.
- `tests/behaviour/coordinator-lease-liveness.test.ts`,
  `coordinator-claim-{race,serialized,stale-fence,capability-gap}.test.ts`,
  `coordinator-fence-{records,stale}.test.ts` — liveness before lease age, the
  one-record takeover, both named state-fence rules, and both non-blocking claim
  interleavings.

### Integration Tests

Every integration case drives the in-process CLI through
`tests/fixtures/coordinator/harness.ts` over a temporary state root, with the
recording process-port fake (`process-port.ts`), injected clock, ids, and fence
tokens, and a fixture blocker ledger. The suites live under `tests/behaviour/`
because the repository is laid out by layer.

- `coordinator-start.test.ts`, `coordinator-stop.test.ts`,
  `coordinator-status.test.ts`, `coordinator-tick.test.ts` — acquisition,
  recorded stop requests, read-only status with `tickVerdict: null`, and one
  bounded tick with a non-null verdict.
- `coordinator-foreground-loop.test.ts` — N cycles with one lifetime lease pair,
  no per-cycle lease record, and the declared stop, fatal, and signal exits.
- `coordinator-fresh-budget.test.ts` — the new epoch starts at count 0 while the
  old epoch and its escalation remain, and the fresh epoch survives a later
  `status`, `tick`, and `start`.
- `coordinator-expectation{,-refresh}.test.ts` — the active expectation and the
  digest-change refresh while the session is live.
- `coordinator-kill-{grace,identity,failed,target,fence}.test.ts` — TERM, grace,
  conditional SIGKILL, the identity check, and the two-phase stuck record.
- `coordinator-escalation-{publish,failed,idempotent,reuse,slot,surface}.test.ts`
  — exactly one owner question with its `historyRef`, the terminal receipt, publish
  failure, idempotent reuse after an answer, and the reserved render-first slot in
  the digest and brief.
- `coordinator-scenario.test.ts` — the SC-M1-25 end-to-end lifecycle: context
  pressure, stuck kill, restart within budget, wake within one cycle, and loud
  exhaustion escalation in one world.

### End-to-End and Production Composition Tests

- `tests/structure/coordinator-production-composition.test.ts` — the shipped
  composer registers the family and it is prompt-required.
- `tests/structure/coordinator-production-session.test.ts` — the real production
  composer plus the delivered harness adapters: an absent session spawns, a
  resumable session resumes, an absent context count records
  `spawn-fresh`/`context-unknown`, `start --foreground` runs the composed spawn and
  releases the lease, and the Claude Code resume gap stays a declared adapter gap.
- `tests/behaviour/entrypoint-composition.test.ts`,
  `entrypoint-help-coverage.test.ts` — the composed command set and the
  coordinator help entry.

### Structure, Boundary, and Check Tests

- `tests/structure/coordinator-{imports,regime,no-cpu,kill-target}.test.ts` —
  tier confinement, the shared regime with no installer, no CPU read, and the
  handle-only kill target.
- `tests/structure/daemon-contract.test.ts` — the additive `SIGKILL` signal value
  and the optional `startTimeMs` capability, with no second process port.
- `tests/behaviour/merge-coordinator-boundary.test.ts` — no coordinator path
  imports merge execution.
- `tests/checks/coordinator-{determinism,mutants,privacy,sequence}.test.ts` — byte
  identity with no ambient input, temp-copy mutants that must fail their oracles,
  no prompt/secret content in records or errors, and the J1 prompt sequence.
- `tests/checks/error-table-sync.test.ts` and
  `tests/structure/error-table.test.ts` — the six rows bound two-way to the
  documented table.
- `tests/types/coordinator.type-test.ts` — closed unions, absent-versus-null
  modelling, and envelope exclusivity.
- `tests/golden/coordinator.test.ts` — inline snapshots of the tick and status
  payloads and the bounded human text.

## Test Data

- Every state root is `mkdtemp`-created with an identifiable label and removed in
  teardown; no live store is committed.
- `tests/fixtures/coordinator/harness.ts` supplies the CLI harness, session facts,
  record seeding, and the counters used to assert read cost and append counts.
  `process-port.ts` is a recording fake with an alive map and a fake clock, so a
  TERM/KILL sequence and its duration are asserted without signalling.
  `blockers.ts`, `lifecycle.ts`, `evidence.ts`, `states.ts`, and `claim-race.ts`
  hold the question ledger, decision facts, evidence matrices, seeded record
  states, and the two-handle claim race.
- Fixtures are never named `*.test.ts`, so Bun does not discover them as suites.
- Golden expectations are inline snapshots in the suite, not mutable fixture
  files.

## Test Scenarios

### Scenario: Single-instance claim

- **Given** a readable store and a declared alive capability, **when** `start` or
  `tick` claims the lease, **then** the claim is one fenced critical section that
  re-reads the lease and probes liveness before age, appends exactly one `acquired`
  or one `stale-takeover`, and releases the fence.
- **And** a live holder is refused `coordinator.already-running` regardless of
  age with no append; a dead holder is taken over by one record; a declared probe
  that returns no answer falls back to 2 x `collection-interval`; an undeclared
  alive capability is `coordinator.process.capability-gap` with no lease record.
- **And** two claims over two handles yield exactly one acquisition and one
  refusal, with no loser append; a dead writer's stale state fence is recovered
  with one `recoverFence` and one retry.

### Scenario: Lifecycle decision durability

- **Given** a recorded prior session, **when** a cycle evaluates, **then** the
  decision (`join-live`, `resume-context`, or `spawn-fresh`) is recorded before its
  effect, and a live session records `join-live` on every evaluation without
  becoming the active expectation.
- **And** a killed coordinator is replaced through the recorded restart path
  without re-executing closed-out phase, merge, or answer artifacts, and a start
  after a crash converges from durable records.

### Scenario: Artifact-evidence stuck detection

- **Given** an active expectation, **when** the stuck window elapses with no
  digest, merge, or answer advance and no positive sourced progress inside
  `progress-bound`, **then** the verdict is `stuck` and is recorded as
  `phase=verdict` with `killOutcome=not-attempted` before any signal.
- **And** a digest change while the session is live records a fresh `decision:
  none` expectation so the window measures the new baseline; a verified-empty
  merge or answer store is stale; an unreadable store is `unknown`; all-unknown is
  `unevaluable` with one verdict record, no kill, and exit 2.

### Scenario: Identity-verified kill with grace

- **Given** a stuck verdict and a recorded pid plus start time, **when** the kill
  runs, **then** the port verifies the identity, sends TERM, waits the configured
  grace, sends SIGKILL only if still alive, and one `phase=outcome` record lands
  under the same `stuckId`.
- **And** a mismatch sends no signal and records `identity-mismatch`; a failed
  signal records `failed`; an absent capability is a capability gap before TERM;
  the target is the recorded pid only.

### Scenario: Per-epoch restart budget

- **Given** a budget epoch, **when** a recovery is admitted below the bound,
  **then** one restart record with the next contiguous ordinal lands before its
  effect; **and** at or above the bound no restart record lands, the command exits
  `1` with the durable history reference, and escalation runs.
- **And** `start --fresh-budget` opens `epoch-<n>` after the highest epoch seen,
  persists it on the lease carrier, and the new epoch is observed by a later
  `status`, `tick`, or `start`; a torn or gapped ordinal set is unevaluable.

### Scenario: Exhaustion escalation and the reserved slot

- **Given** an exhausted epoch, **when** the escalation runs, **then** exactly one
  owner-audience `decision-needed` question lands with
  `ref` `<coordinatorId>#<budgetEpochId>`, the restart count and bound, the
  durable `historyRef`, and the two declared options, followed by one terminal
  receipt.
- **And** a repeated exhausted tick reuses the question even after it is answered
  and reports `exhausted-escalated` at exit 0; a publish failure is exit 2 and
  `exhausted-escalation-failed`; the digest and brief render the question first by
  index inside the eight-question bound and count the displaced one as omitted.

### Scenario: Wake on a typed question

- **Given** an open rank-1 coordinator question, **when** a collection cycle runs,
  **then** one wake effect is selected from the lifecycle decision (`live`,
  `resume`, or `spawn`), reported as `wake.effect`, and one durable wake record
  lands with the question, rank, `askedAt`, and iteration identity.
- **And** `already-woken`, `answered-before-wake`, `delivery-failed`, and
  `no-pickup` append nothing; a cycle with no pickup reports `no-pickup` with a
  null question; a failed delivery is exit 2.

### Scenario: Observation honesty

- **Given** a coordinator result, **when** it renders, **then** the payload carries
  the instance, regime, session, decision, restart count/bound/epoch/history,
  persisted stuck verdict, `tickVerdict` (null outside `tick`), wake, escalation,
  fence, live facts, and degradation, within 64 KiB and 32 human lines.
- **And** `status` never mutates or evaluates; `status --live` reports
  `alive`/`startTimeVerified`/`leaseAgeMs` when the probe answers and
  `live-facts-unknown` when it does not; `start --foreground` reports the
  acquisition instance and renders `stopped`/`released` when the loop has already
  released.

### Scenario: Production composition

- **Given** the shipped composer, **when** `coordinator status|start|stop|tick`
  runs, **then** the invocation reaches the handler and the delivered harness
  session port runs the spawn and resume effects; no delivered capability is
  reported as a coordinator-local gap.
- **And** an absent context count records `spawn-fresh`/`context-unknown`, and the
  Claude Code resume gap remains the delivered adapter gap.

## Performance & Load Tests

`tests/behaviour/coordinator-performance.test.ts` asserts p95 `tick` at most
2,000 ms, `status` at most 1,000 ms, and `start` at most 2,000 ms excluding spawn,
over a reference state store with an injected clock.
`tests/behaviour/coordinator-read-cost.test.ts` asserts one verified state read per
`tick` and per `status`, machine data within 64 KiB, and human text within 32
lines.

## Security Tests

- The kill target is the recorded pid; a structural scan proves no name, pattern,
  or shell interpolation exists on the kill path, and the same-user trust boundary
  is unchanged.
- `tests/checks/coordinator-privacy.test.ts` proves no prompt, transcript, secret,
  or credential canary reaches a record or an error, and stuck evidence stays
  within the 512-byte key=value bound.
- `--fresh-budget`, `--live`, and `--foreground` are accepted only on their
  declared subcommands; every grammar refusal is `fallback.invocation` at exit 1.

## Negative Testing

Negative coverage includes a bare `start`, a live second supervisor, lock
contention and a serialized claim, an undeclared alive capability, a stale state
fence, a torn record set, a torn ordinal set, an identity mismatch, a failed TERM
or SIGKILL, a publish failure, a wake delivery failure, and an unreadable
evidence store. Each negative asserts a classified identity, exit `{0,1,2}`, and
either no append or exactly the declared record, plus unchanged durable bytes
where a write was refused.

## Automation Strategy

- All cases are `bun:test` suites run on the pinned Bun version; the aggregate
  gate is `pnpm check`.
- `bun run scripts/checks/error-table-sync.ts` and
  `tests/checks/error-table-sync.test.ts` bind the six rows in both directions.
- `pnpm check:help` binds the coordinator help entry to its reference page, and
  `pnpm check:prompt` keeps the lifecycle prompts free of forbidden literals.
- `tests/checks/doc-conformance.test.ts` enforces the current-truth phrases across
  the touched feature specs, guides, man page, and reference pages.
- Narrow suites run first during delivery (contract, decision, fence, kill,
  budget), then the full behaviour and structure tiers, then the production
  composition suites.

## Test Environment

- Runtime: pinned Bun; no external services, network, or real state directory.
- Platform: on Linux, `tests/behaviour/coordinator-kill-grace.test.ts` reads its
  own process start time through the shipped `/proc` reader; elsewhere the same
  case asserts the absent reading, and the non-Linux consequences
  (`identity-mismatch` without a signal, and no self-identity for a claim) are
  declared platform-conditional limitations.
- Process: the process port is always a recording fake in the default suite; no
  real child process or signal runs.

## Test Coverage Metrics

No numeric coverage threshold is asserted. Coverage is risk-based: every closed
vocabulary value, every fence rule, every lifecycle decision, every evidence
class state, every kill outcome, every wake outcome, every restart boundary, and
every coordinator error row's real trigger is exercised at least once. A declared
identity without a trigger is a test gap, not a documentation concern.

## Maintenance

- A new coordinator record kind, config key, or error identity requires its
  contract test, its state-boundary validation, its real trigger, and both error
  tables in the same change.
- Golden payloads are inline snapshots regenerated deliberately, never by blanket
  rewrite.
- When the delivered harness session port or process port changes, the production
  composition suites are the parity gate; a declared platform skip is recorded,
  never converted into a pass.
- The README-level `ceo-loop.sh` function map stays covered by
  `tests/checks/coordinator-sequence.test.ts`; `ceo-loop.sh` is byte-unchanged.

## References

- Feature specification:
  [Coordinator Supervision](../../spec/features/feature-coordinator-supervision.md).
- Blocker channel: [Typed Blocker and Question Channel](../../spec/features/feature-blockers.md).
- State consumer: [State Layer](../../spec/features/feature-state-layer.md).
- Process port and install seam: [Resident Dispatch Daemon](../../spec/features/feature-resident-daemon.md).
- Harness port: [Harness Adapters](../../spec/features/feature-harness-adapters.md).
- Error table: [Result Contract and Error Table](../../spec/features/feature-result-contract.md).
- Decisions: [TDR-0017](../../decisions/TDR-0017-coordinator-supervision-architecture.md),
  [TDR-0018](../../decisions/TDR-0018-coordinator-artifact-evidence-and-brief-escalation.md).
- Testing rules: [.ai/rules/testing-strategy.md](../../../.ai/rules/testing-strategy.md).
