---
ados_distribution: internal
id: SPEC-COORDINATOR-SUPERVISION
status: Current
created: 2026-11-09
last_updated: 2026-11-09
owners: ["engineering"]
service: delivery-os
summary: "Coordinator supervision: the coordinator start/stop/status/tick family, the append-only instance lease with a liveness-first atomic claim and one-record stale takeover, the two named state-fence rules, the recorded join-or-resume-or-spawn lifecycle decision, artifact-evidence stuck detection with the progress-bound corroborator, identity-verified kill-with-grace over the delivered DaemonProcessPort, the distinct per-epoch restart budget, loud owner-brief exhaustion escalation with a reserved render-first slot, wake-on-typed-question, the declared foreground supervision loop with its lifetime lease pair, the six additive coordinator.* records, the six coordinator config keys, the six coordinator error identities, and the deterministic delivery.coordinator.v1 observation payload."
links:
  related_changes: ["GH-241"]
  related_decisions:
    ["TDR-0017", "TDR-0018", "ADR-0003", "ODR-0003"]
  contracts:
    - "packages/core/src/contracts/coordinator.ts"
    - "packages/core/src/contracts/daemon.ts"
    - "packages/core/src/contracts/error-table.ts"
    - "packages/core/src/contracts/status.ts"
    - "packages/core/src/contracts/brief.ts"
---

# Feature: Coordinator Supervision (M1-S23)

The coordinator session is the last actor in the M1 end state without a managed
lifecycle. This feature gives it the same treatment lanes already have — a
recorded lifecycle decision, artifact-evidence stuck detection, kill with grace,
a bounded restart budget, and wake on a typed question — without creating a
second daemon, a control socket, lane supervision, or an OS installer.

`ceo-loop.sh` is unchanged. The `coordinator` family is its typed replacement;
the bash entry point retires at M4-S5.

## 1. Command family

| Grammar | Flags | Result |
|---|---|---|
| `coordinator start` | `--foreground` (required in v1), `--fresh-budget` | Claims the lifetime lease, records and applies the lifecycle decision, then runs the declared foreground loop; `--fresh-budget` opens a new budget epoch. |
| `coordinator stop` | none | Requests a stop against the live holder and reports `requested`/`not-running`; never releases another process's fence handle. |
| `coordinator status` | `--live` | Projects `delivery.coordinator.v1`; never mutates state and never evaluates. |
| `coordinator tick` | none | Claims the lease, runs exactly one bounded collection cycle, appends one released, and reports a non-null `tickVerdict` on success. |

A bare `start` is `fallback.invocation` at exit 1 naming that `--foreground` is
required in v1 and that detached or OS-unit hosting is the M1-S18 seam.
Coordinator `install`/`uninstall` does not exist: installation stays with the
delivered daemon installer, and hosting a coordinator unit would require an
additive explicit `command` vector in `SupervisorInstallRequest` /
`renderSystemdUnit` (still hardcoded to `daemon start --foreground`).

The family is composed through the injected `CoordinatorComposition` seam. The
prompt-required production composition does not include it, so an executable
invocation without that composition fails closed through the delivered
containment path.

### 1.1 Foreground loop and stop request

`start --foreground` claims the lease, records and applies the lifecycle decision,
then runs the same evaluation cycle as `tick` without the per-cycle claim, driven
by an injected cycle driver/clock seam (a bounded cancellable wait; no ambient
timer). Every cycle re-reads durable state. A `stop-requested` seen at a cycle
boundary ends the loop, and a signal exit ends it the same way. The loop appends
exactly one acquisition at loop start and exactly one `released` at loop exit and
never a per-cycle lease record. A `released` append that cannot land returns
`state.write.failed` at exit 2, or `state.lock.busy` when the non-claim append
still finds the fence busy after its one stale-lock recovery. A fatal cycle error
returns its typed identity after the release attempt. Start re-reads the harness
session facts and rebuilds the budget epoch and count, active expectation,
last-wake dedupe, and escalation state from durable records, so a start after a
crash converges without duplicating work.

`stop` is a request, not a remote release: against a held lease whose holder is
alive it appends one `stop-requested` record carrying the holder's identity and
reports `requested`; it never acquires another process's identity, releases
another process's handle, or changes the lease anchor. A released or dead holder,
or an unanswered probe past the 2 x `coordinator.collection-interval` bound,
reports `not-running` and appends nothing; an undeclared alive capability is
`coordinator.process.capability-gap` at exit 2.

## 2. Instance lease and the two fence rules

Coordinator single-instance ownership is an **append-only instance lease** carried
by `coordinator.fence` records over four actions — `acquired`, `released`,
`stale-takeover`, `stop-requested` — not a hold on the delivered state write
fence. The lease is folded from the latest record by **ledger sequence** into
`instanceId`, `holder` (pid plus process start time), `pid`,
`processStartTimeMs`, `supervisorMode` (`foreground` in v1; `detached` is a
reserved value never produced), `externalUnit` (`absent`), and, on a takeover,
`previousHolder` and `fenceAgeMs`. There is no separate instance record and no
heartbeat or lease-refresh record.

Claiming is one fenced critical section: acquire the delivered state write fence,
re-read the lease fold and probe `alive(handle)` under it, append exactly one
`acquired` or one `stale-takeover`, release. The new holder is the supervisor's own
recorded `pid` and `processStartTimeMs`; an unavailable self-identity is the same
`coordinator.process.capability-gap` before any lease record lands. The under-fence
read is the tick's single verified state read. Liveness is decided **before** age:

- `alive = true` holds and is refused `coordinator.already-running` regardless of
  lease age;
- `alive = false` is takeover-eligible;
- a declared probe that returns no answer is `unknown` and takes over only when
  the lease age exceeds 2 x `coordinator.collection-interval`;
- an **undeclared** alive capability is `coordinator.process.capability-gap` at
  exit 2 with no lease record and no takeover.

Lease age is the injected now minus the acquisition record's `recordedAt` (the
`acquired` or `stale-takeover` record); a later `stop-requested` never re-anchors
it. A `stale-takeover` is itself the new acquisition and is never followed by a
second `acquired`.

Two state-fence rules are distinct:

| Rule | Applies to | One-shot stale recovery | Still-busy result |
|---|---|---|---|
| Claim acquire | `start`, `tick` | `fenceStatus()`; when stale, one `recoverFence` + one acquire retry | `coordinator.already-running` (exit 2, no lease record, no append) |
| Non-claim append | every other coordinator record append, the escalation publish path | same | the delivered `state.lock.busy` |

The fence is taken for one append only and released in a `finally`; no handle is
held across a cycle. Two concurrent claims are deterministic: one appends its
acquisition and the other is refused. A claimed `tick` attempts `released` on
every outcome, including a non-zero exit; an unlanded release is disclosed, and
the next claim's liveness-first fold clears the dead lease.

## 3. Lifecycle decision

Every lifecycle evaluation records at most one decision before its effect: a
`start` records its decision (including `join-live`), and a collection cycle
records one only when it resumes or spawns a session. A live session on a
collection cycle is a quiet join that appends no new decision.

- `join-live` — the recorded session is alive; attach and observe; no ordinal.
- `resume-context` — no live session, the prior session did not complete cleanly,
  it is resumable, its known context is below `coordinator.resume-context-limit`,
  and the harness declares resume; one recovery ordinal.
- `spawn-fresh` — `initial-start` / `clean-iteration-end` (no ordinal) or
  `context-pressure` / `context-unknown` / `session-interrupted` (one ordinal).
  An undeclared or unavailable resume selects `session-interrupted` with no error
  identity.

A killed coordinator is replaced through the recorded restart path: the stuck path
records restart reason `stuck-artifact-evidence` and spawns a fresh session, while
a later `start` or `tick` decides join, resume, or spawn from the recorded session
facts. Closed-out phase, merge, and answer artifacts remain and are never
re-executed.

## 4. Artifact-evidence stuck detection

An expectation is the latest recorded iteration. Three read-only classes decide
the verdict:

1. `digest-consumed` — the state event-log position (the store's record count,
   carried as the `cursor` field) or the open coordinator-audience question count
   advanced **and** the session produced a new turn. The fingerprint is
   `cursor=<n>;open=<n>`: state-sourced only, with no tracker, CI, or network
   read.
2. `merge` — a `merge.transaction` record landed after the expectation.
3. `answer` — a blocker answer record landed after the expectation.

A new turn is a positive `token-delta` or `session-traffic` reading mapped by the
adapter; absent maps to `unknown`, never zero. Positive sourced progress within
`coordinator.progress-bound` vetoes a stuck verdict (the prefill-safety
corroborator). A `stuck` verdict requires the expectation's
`coordinator.stuck-window` to elapse, no class to have advanced, no positive
sourced progress inside the bound, and at least one evaluable `stale` class. A
verified-empty merge or answer store is a legitimate `stale` class; only an
unreadable store is `unknown`. If every class is `unknown` or the required store
is unreadable the verdict is `unevaluable` with reason `evidence-unevaluable`,
exactly one `phase=verdict` record appends, and no kill or restart occurs. CPU is
never read.

## 5. Kill with grace and the restart budget

On a `stuck` verdict the supervisor appends `coordinator.stuck` with
`phase=verdict`, `killOutcome=not-attempted` and a bounded key=value evidence
corpus, then verifies the recorded `pid` plus `processStartTimeMs` through the
delivered `DaemonProcessPort`'s optional `startTimeMs` capability, sends TERM,
waits `coordinator.kill-grace`, sends `SIGKILL` only if the tree is still alive,
and appends `phase=outcome` under the same `stuckId` (= the expectation's
`iterationId`). A mismatch sends no signal and records `killFailureReason=
identity-mismatch` with `coordinator.session.kill-failed` at exit 2; a failed TERM
or SIGKILL records `killOutcome=failed` with a null `killFailureReason` and the
same identity and exit; an absent start-time capability is
`coordinator.process.capability-gap` before TERM. The target is the recorded
handle only: no name, pattern, or shell interpolation.

The restart budget is per durable epoch in the `coordinator/<coordinatorId>`
namespace, folded from contiguous ordinals starting at 1; a torn or gapped
ordinal set is unevaluable, never count 0. The first epoch identity is `epoch-1`;
`start --fresh-budget` opens the next `epoch-<n>` after the highest epoch seen. A
below-bound restart appends one record with the next ordinal and proceeds; at or
above the bound no restart record is appended and no replacement starts, the
command returns `coordinator.restart-budget-exhausted` at exit 1, and the
escalation path runs.
The fresh epoch starts at count 0 while the old epoch and its escalation remain
in history; it is a start-time option, so a live holder is refused
`coordinator.already-running` first.

## 6. Exhaustion escalation and the reserved slot

Exhaustion publishes exactly one owner-audience `decision-needed` question
through the delivered blocker channel with `ref` `<coordinatorId>#<budgetEpochId>`,
the restart count and bound, and the options `restart-fresh-budget` /
`park-owner-review`; the terminal `coordinator.exhaustion` receipt records the
restart count, the durable history reference, and the question id, and lands only
after the question. A publish failure is
`coordinator.escalation.publish-failed` at exit 2 with consequence `unknown`
and status `exhausted-escalation-failed`. A repeated exhausted tick reuses the
open question, never appends a second terminal receipt, and reports
`exhausted-escalated` at exit 0.

The digest `typed-questions` section and the brief `blocker-questions` anchor
keep one **reserved escalation slot**: an open owner-audience `decision-needed`
coordinator question whose ref has exactly one `#` with both sides non-empty
renders first by index, up to seven others follow in rank order, and the
lowest-ranked question is displaced and counted as omitted inside the unchanged
eight-question bound. The predicate is payload-only and adds no read, section,
anchor, or question type.

## 7. Wake on a typed question

Each collection cycle performs one verified ledger read, applies the delivered
`isCoordinatorPickup` predicate strictly (rank 1, open with an absent status
counting as open, coordinator audience), and delivers one wake effect to the
session within one `coordinator.collection-interval`. Only a successful wake
appends one durable `coordinator.wake` record with outcome `woken`, the question
id, its rank, the persisted `askedAt`, and the iteration identity. One wake is
issued per question lifetime, keyed by coordinator identity, question id, and the
persisted `askedAt`. `already-woken`, `answered-before-wake`, `delivery-failed`,
and `no-pickup` are tick results that append nothing, so a retry cannot
duplicate a record. A failed delivery is `coordinator.wake.delivery-failed` at
exit 2.

## 8. Records, configuration, and the observation payload

Six additive record kinds live under `delivery.state.v1` (no schema bump, no
migration). The command composition supplies the coordinator identity, defaulting
to `coordinator-main` when none is supplied, and every record key is scoped by
it. Every fold — lease, stuck, last decision, last wake — orders by ledger
sequence; `recordedAt` is descriptive only, except as the lease-age anchor in §2.

| Record kind | Payload schema | Store key | Purpose |
|---|---|---|---|
| `coordinator.iteration` | `delivery.coordinator.iteration.v1` | `coordinator.iterations:<coordinatorId>` | One recorded lifecycle decision or expectation |
| `coordinator.restart` | `delivery.coordinator.restart.v1` | `coordinator/<coordinatorId>` | One admitted restart ordinal in the current budget epoch |
| `coordinator.stuck` | `delivery.coordinator.stuck.v1` | `coordinator.stuck:<coordinatorId>` | One `verdict` phase, plus one `outcome` phase for a `stuck` verdict |
| `coordinator.exhaustion` | `delivery.coordinator.exhaustion.v1` | `coordinator.exhaustion:<coordinatorId>` | The single terminal escalation receipt per epoch |
| `coordinator.wake` | `delivery.coordinator.wake.v1` | `coordinator.wake:<coordinatorId>` | One durable successful wake per question lifetime |
| `coordinator.fence` | `delivery.coordinator.fence.v1` | `coordinator.fence:<coordinatorId>` | One instance-lease action |

The `coordinator` configuration branch declares six integer keys with shipped
defaults and domains; unknown keys fail `config.key.unknown` and a wrong type or
domain fails `config.value.invalid`, so no default or bound literal lives in
decision code.

| Key | Default | Domain |
|---|---|---|
| `coordinator.stuck-window` | 600 000 ms | positive integer |
| `coordinator.kill-grace` | 20 000 ms | positive integer |
| `coordinator.restart-budget` | 10 | non-negative integer (`0` admits no restart) |
| `coordinator.resume-context-limit` | 100 000 tokens | positive integer |
| `coordinator.collection-interval` | 30 000 ms | positive integer |
| `coordinator.progress-bound` | 300 000 ms | positive integer |

Every successful command returns `delivery.coordinator.v1`: coordinator id,
instance folded from the lease, regime descriptor, session facts, last decision,
restart count/bound/epoch/history, the last **persisted** stuck verdict with
non-null phase/reason/evidence, the tick-specific `tickVerdict` (null for
`start`, `stop`, and `status`; nullable phase/reason/evidence when
`progressing`), last wake, escalation state and question id, the last lease action
with previous holder and fence age, and a bounded degradation list. Declared
degradation entries are `supervisor-loop-stopped` on a completed `start`,
`live-facts-unknown` on `status --live` when the probe returns no answer, and
`state write fence busy` when the shared fence is held. Human output is
deterministic, ANSI-free, and at most 32 lines; machine data is at most 64 KiB.

The six error identities are the coordinator failure vocabulary; every non-zero
exit projects from the error table.

| Identity | Category | Retryable | Consequence | Exit |
|---|---|---|---|---|
| `coordinator.already-running` | user | false | not_landed | 2 |
| `coordinator.restart-budget-exhausted` | user | false | not_landed | 1 |
| `coordinator.process.capability-gap` | platform | false | not_landed | 2 |
| `coordinator.session.kill-failed` | platform | true | unknown | 2 |
| `coordinator.escalation.publish-failed` | platform | true | unknown | 2 |
| `coordinator.wake.delivery-failed` | platform | true | unknown | 2 |

The two two-segment identities — `coordinator.already-running` and
`coordinator.restart-budget-exhausted` — join the exact two-segment allowlist; the
other four are three-segment. There is no `coordinator.*` wildcard or family
widening. Non-claim fence contention and failed coordinator appends reuse the
delivered `state.lock.busy` and `state.write.failed` identities; an unevaluable
record fold reuses the delivered `state.*` identity.

## 9. Regime descriptor and the M1-S18 seam

The shared supervisor-regime descriptor declares state-dir scope, the
single-instance lease, a unit identity derived from the state directory and the
coordinator identity (`coordinator@<stateDirectory>#<coordinatorId>`), a distinct
process kind, a distinct budget store,
`supervisorMode` `foreground` (the only v1 value), `externalUnit` `absent`, and
the delivered `SupervisorPort` / `DaemonSupervisorDescriptor` install seam. The
coordinator's single-instance ownership is its append-only ledger lease and never
`daemon.lock`; the daemon keeps its own heartbeat-age lock. No coordinator
installer or unit renderer exists: the daemon command, unit renderer, and control
surface carry no coordinator unit, and a future coordinator unit needs the
additive explicit `command` vector named above.

## 10. Constraints

- No CPU signal and no model call in any decision, render, or observation path.
- No prompt, transcript, secret, or credential value in any record or error
  evidence; evidence is bounded key=value at 512 UTF-8 bytes.
- No per-cycle lease record in the foreground loop: one acquisition at loop start
  and one release at loop exit; a quiet tick appends exactly its lease pair.
- Capability ownership is split: an undeclared or unavailable harness resume
  selects `spawn-fresh` with no error identity; a harness spawn gap or refusal
  keeps `harness.capability.gap` / `harness.spawn.refused` at exit 1; an absent
  progress source is an `unknown` evidence class; only a missing process-port
  alive, kill-with-grace, or start-time identity capability raises
  `coordinator.process.capability-gap` at exit 2.
- `ceo-loop.sh` stays byte-unchanged.

## Related

- [Session Lifecycle Economics](feature-session-lifecycle-economics.md) — the
  sourced progress signals and the `evaluateRestartBudget` shape this feature
  consumes; the coordinator owns a distinct budget.
- [Typed Blocker and Question Channel](feature-blockers.md) — the pickup
  predicate, ranking, ledger, and owner question this feature enforces.
- [Brief](feature-brief.md) and [Status Digest](feature-status-digest.md) — the
  reserved escalation slot.
- [Resident Dispatch Daemon](feature-resident-daemon.md) — the delivered process
  port and the M1-S18 install seam.
- [Harness Adapters](feature-harness-adapters.md) — the additive process-port
  capabilities and the new-turn mapping.
- [Result Contract and Error Table](feature-result-contract.md) — the
  `coordinator` domain kind and six rows.
- Decision records: [TDR-0017](../../decisions/TDR-0017-coordinator-supervision-architecture.md)
  and [TDR-0018](../../decisions/TDR-0018-coordinator-artifact-evidence-and-brief-escalation.md).
