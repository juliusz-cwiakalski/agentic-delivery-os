---
ados_distribution: internal
id: TEST-SPEC-LOOP-SUPERVISION
status: Current
created: 2026-11-19
last_updated: 2026-11-19
owners: ["engineering"]
service: delivery-os
links:
  related_changes: ["GH-348"]
  related_decisions: ["TDR-0055", "TDR-0056"]
  feature_spec: doc/spec/features/feature-loop-supervision.md
---

# Test Specification: Loop Supervision

## Overview

The loop-supervision suite protects one property: an operator can run, stop,
inspect, tail, and reset the Mode A outer loop as a typed command over the
delivered supervision engine, without a shell entry point, without a second
supervisor, and without a second kill path. The suite fails if the loop
reimplements a lease, a budget fold, or a kill instead of composing the delivered
ones; if a second loop can run or a second CEO session can be spawned beside a
recorded live one; if a stop is forgotten across a restart or an unreadable stop
fold is read as "not stopped"; if a CEO blocked on a healthy delivery is killed;
if an unreadable progress or corroborator input is laundered into a kill; if a
kill signals an unverified target; if a restart ordinal is lost, duplicated, or
silently reset; if the durable restart reason or the at-bound history reference
cannot be derived from durable state; if the log grows unbounded or carries a
prompt, transcript, credential, model, or seat; if a read-only verb appends; or if
the shipped binary cannot reach the family.

## Test Scope

- Components under test: the loop vocabulary
  (`packages/core/src/contracts/loop.ts`), the pure loop domain
  (`packages/core/src/domain/loop-verdict.ts`, `loop-backoff.ts`,
  `loop-status.ts`, `loop-log.ts`, `loop-prompt.ts`), the loop state consumer
  (`packages/core/src/state/loop.ts`), the app tier
  (`packages/core/src/app/loop-supervisor.ts`, `loop-session.ts`,
  `loop-corroborator.ts`), the CLI surface
  (`packages/cli/src/commands/loop.ts`, `packages/cli/src/output/loop-text.ts`),
  the composition seams (`packages/cli/src/edge.ts`,
  `packages/cli/src/production.ts`), the additive harness handle `pid`
  (`packages/core/src/contracts/harness.ts` and the opencode adapter), the
  static no-shell invariant over the declared loop surface, the help inventory
  and its reference page, and the six reused `coordinator.*` configuration keys.
- Contracts under test: two additive record kinds and payload schemas
  (`delivery.loop.session.v1`, `delivery.loop.stop.v1`), the closed verb, stop
  mode, stop action, session state, log event, degradation, instance state,
  delivery reading, status-key, and boolean-key vocabularies, the declared
  backoff policy data, the `delivery.loop.v1` and `delivery.loop.log.v1`
  observation shapes, the reused `progressing` / `stuck` / `unevaluable` verdict
  vocabulary and the reused `stuck-artifact-evidence` / `evidence-unevaluable`
  reasons, and the absence of any new error identity, domain kind, or
  configuration key.
- Exclusions: no live opencode session, no live provider selection, no OS-level
  signal to a real child, no real pick-deliver-merge effect, no real clock or
  multi-minute delay, and no arbitrary cross-process race schedule. Those six
  surfaces are the published not-proven boundary, not test gaps (§ Proven and
  not-proven surfaces).

## Test Levels

### Unit and contract tests

- `tests/behaviour/loop-stuck.test.ts` — the pure two-signal rule: every stuck
  condition, positive progress, the delivery veto, both unevaluable inputs, the
  seeded observation, and the decision table over progress × artifact advance ×
  delivery reading, then the integration arms (verdict/outcome pair, the
  termination ordering and exact target set, the terminal unconfirmed
  termination, and the bound formula at two interval settings).
- `tests/behaviour/loop-backoff.test.ts` — the delay schedule at ordinals 1–10,
  the total-epoch bound, the cancellation rule, the at-bound exit and its
  derivable history reference, the durable next epoch under `--fresh-budget`, the
  clean-end path that consumes no ordinal, and the bounded restart evidence.
- `tests/behaviour/loop-status.test.ts` — the fourteen-key block order, exactly
  three boolean keys, `loop_id=loop-main`, `restarts=<n>/<bound>`, live-only
  `ceo_pid`/`ceo_session`, the empty-string rendering with no `none` token, and
  the three golden worlds (running, stopped, absent identifiers).
- `tests/behaviour/loop-log.test.ts` — the eleven-name event vocabulary, the line
  contract, the byte and line bounds, the rotation that keeps the newest data,
  the read nothing-creates rule, the unreadable-read marker, and the swallow rule
  that leaves exit, records, and disclosure unchanged.
- `tests/behaviour/loop-grammar.test.ts` — every verb × declared flag
  combination, every malformed form, the missing `--foreground`, the accepted
  global flags, and zero appends on every refusal.
- `tests/structure/loop-imports.test.ts` — the domain tier's purity (no ambient
  clock, timer, environment, I/O, or network), the composition of the delivered
  engine primitives, and the absence of any re-declared lease, budget, kill, or
  lock fold.
- `tests/structure/loop-production-composition.test.ts` and
  `tests/structure/loop-production-session.test.ts` — the shipped composer reaches
  the handler, the delivered harness session port runs the spawn and resume
  effects, the per-spawn binding is the delivered resolution, and the additive
  handle pid is filled when the starter reports one and absent otherwise.
- `tests/checks/loop-contract-invariance.test.ts`, `loop-privacy.test.ts`,
  `loop-mutants.test.ts` — the closed contract surface against an in-suite
  baseline (zero new identities, domain kinds, configuration keys, and no
  delivered schema-version change; exactly two record kinds and one additive
  optional harness fact), record/log/diagnostic hygiene, and the mutation
  controls.
- `tests/checks/no-shell-dispatch.test.ts` — the delivered static invariant,
  extended over the declared loop surface with its planted-reference control.

### Integration tests

- `tests/behaviour/loop-spawn.test.ts` — the fresh-spawn argv (`--agent ceo`,
  the resolved `--model`, the deterministic `ceo-loop-<stamp>` title), the
  pre-session refusals with a released lease and no session record, the additive
  handle pid, the session record's declared facts and append cardinality, and the
  absence of a pre-iteration hook.
- `tests/behaviour/loop-instance.test.ts` — the two-start interleaving in both
  directions, the liveness-first takeover, the join without a second spawn, the
  ended-session replacement, the pid-less resume with no title, the distinct
  `loop-main` identity against `coordinator-main`, the one-session invariant, and
  the undeclared-capability refusal.
- `tests/behaviour/loop-stuck.test.ts` — the integration arms of the same suite:
  the verdict and outcome record pair with the loop-scoped identity, the delivery
  veto, the unevaluable arms, the termination ordering and exact target set, the
  unconfirmed termination that is terminal, and the bound formula at two interval
  settings.
- `tests/behaviour/loop-stop.test.ts` — the idempotent request, the folded start
  after a simulated restart and after a crash, the torn fold that fails closed,
  the clearance, both stop modes' latency bounds, the unverifiable identity that
  is never signalled, and the payload's identity-only facts.
- `tests/behaviour/loop-read-cost.test.ts` — one verified state read per
  supervision cycle, zero added reads and zero writes for `status` and `log`, and
  the bounded output sizes.

### End-to-end and conformance tests

- `tests/conformance/loop/loop-parity-battery.test.ts` — the case registry
  (`tests/fixtures/loop/parity/cases.ts`) driven over the real command path with
  the harness, tracker, and process doubled: every row executes and declares one
  proven surface, no battery file reimplements a seam (with a planted
  reimplementation rejected by name), two runs are canonical-equal with zero live
  calls, the injected runner records zero shells, the declared prompt carries no
  script path and names the four primitives, the privacy scan finds no forbidden
  token in any line, and the proof boundary is the permanent constant.
- `tests/conformance/loop/loop-pick-deliver-merge.test.ts` — the session drives
  `queue claim` → `dispatch` → `merge` → `closeout` through the real command
  runtime with zero shells, zero kills, zero restarts, and no `phase complete` on
  the deliver leg.
- `tests/checks/reference-page-parity.test.ts`, `tests/structure/metrics-mounting.test.ts`,
  `tests/checks/install-conformance-mutants.test.ts`, and the help-guide coverage
  inventory — the prompt-required set at 27 families with `loop` last, the M4
  reference-page root for `loop`, and a removal control that fails by name.

## Test Data

- `tests/fixtures/loop/harness.ts` — the composed loop harness: an in-memory
  ledger double with the coordinator and loop record kinds, a recording process
  port, a scripted harness session, a recording delay seam, and the real command
  path.
- `tests/fixtures/loop/facts.ts` — the shared fact builders (fence, restart,
  stuck, session, stop, and lane facts) with fixed identifiers.
- `tests/fixtures/loop/session.ts`, `tests/fixtures/loop/log-fs.ts` — the
  scripted session effects and the bounded log file-system double.
- `tests/fixtures/loop/parity/{cases,seams,evidence,e2e}.ts` — the parity case
  registry, the forbidden-seam signatures and planted reimplementation, the
  permanent proof boundary and its canonicalizer, and the pick-deliver-merge
  transcript builder.
- `tests/fixtures/loop/golden/status.ts` — the three status goldens, including the
  absent-identifier world.
- No fixture reads or writes the live workspace state directory, spawns a real
  child, or performs a network call.

## Test Scenarios

### Scenario: Verb and grammar parity

- **Given** the five verbs, **when** each runs with its declared flags, **then**
  it performs its effect, returns its declared payload, and exits on the identity
  that produced the outcome.
- **And** every malformed form — including a bare `start` — is a grammar refusal
  at exit 1 with zero records, while the global flags are accepted.
- **And** a clean end is the cycle driver's declared end at exit 0, not a failure.

### Scenario: Status block honesty

- **Given** a running, a stopped, and an absent-identifier world, **when**
  `status` renders, **then** the first six keys are the shell names in the shell's
  order, exactly three keys are boolean, `stop_mode` follows `stop_signal`,
  `loop_id=loop-main` and `restarts=0/<bound>` are present, only the genuinely
  optional identifiers are empty, and no `none` token exists.

### Scenario: Engine composition, not reimplementation

- **Given** the loop modules, **when** the structure and mutation suites run,
  **then** the lease claim, the per-epoch budget admission, the stuck record pair,
  and the terminate path are the delivered ones; the loop re-declares no lease,
  budget, kill, or lock fold; and the domain tier reads no ambient clock, timer,
  environment, or I/O.

### Scenario: Spawn identity and pre-session refusal

- **Given** a fresh spawn, **when** it runs, **then** the adapter renders exactly
  one `--agent ceo` with the resolved seat `--model` and exactly one
  `ceo-loop-<stamp>` title, which is the reap identity.
- **And** an unassigned seat, an unresolvable profile context, and an
  unrepresentable model each keep their delivered identity at exit 1, release the
  lease, and append no session record.
- **And** a handle without an adapter-supplied pid records `null` and discloses
  `session-pid-unknown`; it is never fabricated.

### Scenario: Single instance and session re-find

- **Given** two concurrent starts, **when** they interleave, **then** exactly one
  is admitted and one is refused `coordinator.already-running` at exit 2.
- **And** a takeover joins a live recorded session, replaces an ended one with
  exactly one fresh session, resumes a pid-less `active` one exactly once without
  a title, and never spawns a second session beside a recorded live one.
- **And** `loop-main` and `coordinator-main` neither exclude nor read each other.

### Scenario: Two-signal stuck detection and the delivery veto

- **Given** zero sourced progress for the window, no artifact advance, and a
  readable corroborator reporting `none`, **when** the cycle evaluates, **then**
  the verdict is `stuck`, one verdict record and one outcome record land under the
  loop-scoped identity, and the restart admission decision follows.
- **And** a live delivery in progress makes the same quiet session `progressing`,
  with zero records and zero terminations, even after twenty virtual minutes.
- **And** an unreadable progress reading or an unreadable corroborator is
  `unevaluable`: one record, no kill, continued cycling.
- **And** the corroborator consumes no start-time or age fact and writes nothing;
  the sixteen-row class/fold decision is total, and the pid-reuse residual risk is
  a delay, never a kill.

### Scenario: Termination ordering and its terminal failure

- **Given** a confirmed stuck verdict, **when** the loop terminates the session,
  **then** TERM precedes KILL, KILL respects the grace and the live tree, only
  this session's tree or its exact identity is signalled, and a confirmed
  termination proceeds to the restart path.
- **And** an unconfirmed termination appends one outcome record, releases the
  lease, and exits 2 on `coordinator.session.kill-failed` with zero restarts and
  zero spawns.

### Scenario: Backoff, budget, and the at-bound exit

- **Given** a below-bound stuck restart, **when** the ordinal is consumed, **then**
  exactly one restart record lands with the delivered reason and the replaced
  session identity, one session record and one spawn follow after
  `min(2 s × 2^(n−1), 300 s)`, and a durable stop or signal cancels the wait
  without the session effect.
- **And** a self-ended session consumes no ordinal and waits the collection
  interval.
- **And** at the bound the loop exits 1 on the delivered identity with its own
  remediation, the derivable history reference, and no new session; a
  `--fresh-budget` start opens the next durable epoch.

### Scenario: Durable stop and reset

- **Given** a folded stop, **when** the process restarts or crashes and `start`
  runs again, **then** it exits 0 with `state=stopped`, appends no lease record,
  spawns no session, and records nothing; an unreadable fold fails closed at exit
  2 with zero session effects.
- **And** `reset` appends one clearance when a request is folded and nothing
  otherwise, after which the loop runs.
- **And** `drain` never terminates and `immediate` terminates within the bound,
  leaving at most one live session; an unverifiable identity is never signalled.
- **And** the typed stop and the shell marker are not interchangeable.

### Scenario: Bounded operational log

- **Given** a full scenario, **when** the log is read, **then** every line is at
  most 512 bytes, the active file is bounded at 1 MiB with one retained
  generation, the read is bounded in lines and bytes with a truncation flag, and
  no prompt, transcript, credential, environment value, model, or seat appears.
- **And** a failing append or rotation changes no exit, record, or verdict.

### Scenario: Declared divergences from the shell loop

- **Given** each of the ten declared divergences, **when** the loop runs, **then**
  it asserts the intended typed behaviour: a second start exits 2 rather than 0; a
  grammar refusal exits 1 rather than the shell's usage 2; the budget is durable per
  epoch and only `--fresh-budget` resets it; stuck restarts back off while ordinary
  iterations wait the collection interval; an ended session is replaced rather than
  resumed; `log` returns the bounded supervision log rather than a transcript;
  `stop` defaults to `drain` with `--mode immediate` opt-in; no pre-iteration hook
  runs or is read; no `CEO_LOOP_*` environment knob participates; and `--lines`
  outside 1–100 is a grammar refusal.
- **And** the typed stop and the shell stop are not interchangeable: neither path
  reads the other's carrier.

### Scenario: Proof boundary and no-shell

- **Given** the permanent boundary constant, **when** the boundary case reads it,
  **then** it carries nine proven ids and six not-proven ids in the declared
  order, every battery row names a proven surface, and a missing, reordered, or
  off-boundary id fails by name.
- **And** the injected runner records zero shell invocations, the static
  invariant is clean over the declared loop surface with a planted reference
  failing by name, and the declared prompt carries no script path.

## Performance & Load Tests

`tests/behaviour/loop-read-cost.test.ts` asserts one verified state read per
supervision cycle, zero added reads and zero writes for `status` and `log`, machine
data within 65 536 bytes, and human text within the declared line bounds. The
battery's injected delay records instead of sleeping, so no case waits on real
time.

## Security Tests

- The termination target is the session this process holds or the recorded pid
  identity; a mismatch sends no signal, and a structural scan proves no name,
  pattern, or shell interpolation exists on the path.
- `tests/checks/loop-privacy.test.ts` proves no prompt, transcript, secret, or
  credential canary reaches a record, a log line, or an error, and verdict
  evidence stays within the 512-byte bound.
- `--foreground`, `--fresh-budget`, `--mode`, and `--lines` are accepted only on
  their declared subcommands; every grammar refusal is `fallback.invocation` at
  exit 1.
- The loop spawns from a fixed argv with no shell, the title comes from a fixed
  template plus a UTC stamp, and the prompt is passed as data.

## Negative Testing

Negative coverage includes a bare `start`, an unknown verb, a second positional, a
flag outside its verb, a malformed `--lines`, a live second supervisor, lock
contention, an undeclared alive capability, a torn stop fold, a torn session
record, an identity mismatch, a failed termination, an unreadable progress
reading, an unreadable corroborator, an unreadable log, and a domain refusal from
the provider, configuration, or harness layer. Each negative asserts a classified
identity, exit `{0,1,2}`, and either no append or exactly the declared record,
plus unchanged durable bytes where a write was refused.

## Automation Strategy

- All cases are `bun:test` suites on the pinned Bun version; the aggregate gate
  is `pnpm check`.
- `bun run scripts/checks/no-shell-dispatch.ts` and
  `tests/checks/no-shell-dispatch.test.ts` bind the declared surface and its
  planted-reference control.
- `pnpm check:help` binds the `loop` help entry to its M4 reference page, and the
  reference-page-parity suite resolves `loop` to that root.
- `tests/checks/doc-conformance.test.ts` enforces the current-truth phrases across
  the touched feature specs, guides, and reference pages.
- Narrow suites run first during delivery (contract, verdict, backoff, status,
  log), then behaviour and structure, then the conformance battery.

## Test Environment

- Runtime: pinned Bun; no external service, network, live tracker, live model, or
  live state directory.
- Process: the process port is always a recording double; no real child is
  spawned and no real signal is sent. The production-composition suites drive the
  real composer with the delivered adapters behind their declared ports.
- Clock and delay: both are injected. The harness supplies a fixed clock and a
  recording delay, so a window, a grace, and a backoff are asserted as recorded
  facts rather than observed over wall time.

## Test Coverage Metrics

No numeric threshold is asserted. Coverage is risk-based: every closed
vocabulary value, every evidence class D1–D6 and M1–M6, every fold rule F0–F3,
every stop transition and mode, every exit identity's real trigger, every backoff
ordinal 1–10, every log event, and every declared degradation is exercised at
least once. A declared identity without a trigger is a test gap, not a
documentation concern.

## Maintenance

- A new loop record kind, status key, log event, or degradation requires its
  contract test, its state-boundary validation, and its real trigger in the same
  change. Adding an error identity is out of contract: the loop reuses the
  delivered coordinator and state identities.
- The proof boundary is a permanent constant; changing it is a deliberate edit to
  `tests/fixtures/loop/parity/evidence.ts` that must be mirrored on the feature
  page in the same change.
- When the delivered harness session port, process port, or supervision engine
  changes, the production-composition and battery suites are the parity gate; a
  declared platform skip is recorded, never converted into a pass.
- `scripts/ceo-loop.sh` is byte-unchanged and pinned by
  `tests/structure/provider-surface.test.ts`; its function map stays covered by
  `tests/checks/coordinator-sequence.test.ts`.

## Proven and not-proven surfaces

The permanent fixture constant `LOOP_PARITY_PROOF_BOUNDARY`
(`tests/fixtures/loop/parity/evidence.ts`) declares the boundary; the feature page
publishes the same list in the same order, and the doc guard compares the two.

**Proven (9):** `verbs`, `log`, `spawn`, `stuck`, `kill`, `backoff-budget`,
`stop`, `single-instance`, `no-shell`.

**Not proven (6):** `live-opencode`, `live-provider`, `os-termination`,
`real-pick-deliver-merge`, `long-run-loop`, `cross-process-race`.

## References

- Feature specification:
  [Loop Supervision](../../spec/features/feature-loop-supervision.md).
- Engine this profile composes:
  [Coordinator Supervision](../../spec/features/feature-coordinator-supervision.md),
  [coordinator supervision test specification](test-spec-coordinator-supervision.md).
- Autonomy contract:
  [Autonomous Delivery](../../spec/features/feature-autonomous-delivery.md),
  [autonomous delivery test specification](test-spec-autonomous-delivery.md).
- State consumer: [State Layer](../../spec/features/feature-state-layer.md).
- Harness port: [Harness Adapters](../../spec/features/feature-harness-adapters.md).
- Corroborator record sources: [Dispatch Engine](../../spec/features/feature-dispatch-engine.md),
  [Resident Dispatch Daemon](../../spec/features/feature-resident-daemon.md).
- Error table: [Result Contract and Error Table](../../spec/features/feature-result-contract.md).
- Decisions: [TDR-0055](../../decisions/TDR-0055-loop-supervision-as-a-profile-of-the-coordinator-engine.md),
  [TDR-0056](../../decisions/TDR-0056-durable-loop-stop-as-a-state-ledger-record.md).
- Reference page: [`loop`](../../planning/oss-tooling/milestones/m4/commands/loop.md).
