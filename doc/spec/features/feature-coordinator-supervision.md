---
ados_distribution: internal
id: SPEC-COORDINATOR-SUPERVISION
status: Current
created: 2026-11-09
last_updated: 2026-11-09
owners: ["engineering"]
service: delivery-os
summary: "Coordinator supervision: the coordinator start/stop/status/tick family, the append-only instance lease with a liveness-first atomic claim and one-record stale takeover, the two named state-fence rules, the recorded join-or-resume-or-spawn lifecycle decision, artifact-evidence stuck detection with the progress-bound corroborator, identity-verified kill-with-grace over the delivered DaemonProcessPort, the distinct per-epoch restart budget, loud owner-brief exhaustion escalation with a reserved render-first slot, wake-on-typed-question, the six additive coordinator.* records, the coordinator configuration branch, and the deterministic delivery.coordinator.v1 observation payload."
links:
  related_changes: ["GH-241"]
  related_decisions:
    ["TDR-0017", "TDR-0018", "ADR-0003", "ODR-0003"]
  contracts:
    - "packages/core/src/contracts/coordinator.ts"
    - "packages/core/src/contracts/daemon.ts"
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
| `coordinator stop` | none | Appends one `stop-requested` lease record and reports `requested`/`not-running`; never releases another process's fence handle. |
| `coordinator status` | `--live` | Projects `delivery.coordinator.v1`; never mutates state and never evaluates. |
| `coordinator tick` | none | Claims the lease, runs exactly one bounded collection cycle, appends one released, and reports a non-null `tickVerdict`. |

A bare `start` is `fallback.invocation` at exit 1 naming that `--foreground` is
required in v1 and that detached or OS-unit hosting is the M1-S18 seam.
Coordinator `install`/`uninstall` does not exist: installation stays with the
delivered daemon installer, and hosting a coordinator unit would require an
additive explicit `command` vector in `SupervisorInstallRequest` /
`renderSystemdUnit` (still hardcoded to `daemon start --foreground`).

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
`acquired` or one `stale-takeover`, release. The under-fence read is the tick's
single verified state read. Liveness is decided **before** age:

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
held across a cycle.

## 3. Lifecycle decision

Every lifecycle evaluation records exactly one decision before the effect:

- `join-live` — the recorded session is alive; attach and observe; no ordinal.
- `resume-context` — no live session, the prior session did not complete cleanly,
  it is resumable, its known context is below `coordinator.resume-context-limit`,
  and the harness declares resume; one recovery ordinal.
- `spawn-fresh` — `initial-start` / `clean-iteration-end` (no ordinal) or
  `context-pressure` / `context-unknown` / `session-interrupted` (one ordinal).
  An undeclared or unavailable resume selects `session-interrupted` with no error
  identity.

A killed coordinator resumes or respawns per the recorded decision; closed-out
phase, merge, and answer artifacts remain and are never re-executed.

## 4. Artifact-evidence stuck detection

An expectation is the latest recorded iteration. Three read-only classes decide
the verdict:

1. `digest-consumed` — the state event-log cursor or the open
   coordinator-audience question count advanced **and** the session produced a
   new turn. The fingerprint is `cursor=<n>;open=<n>`: state-sourced only, with
   no tracker, CI, or network read.
2. `merge` — a terminal merge record landed after the expectation.
3. `answer` — a blocker answer record landed after the expectation.

A new turn is a positive `token-delta` or `session-traffic` reading mapped by the
adapter; absent maps to `unknown`, never zero. Positive sourced progress within
`coordinator.progress-bound` vetoes a stuck verdict (the prefill-safety
corroborator). A verified-empty merge or answer store is a legitimate `stale`
class; only an unreadable store is `unknown`. If the required store is unreadable
the verdict is `unevaluable` with reason `evidence-unevaluable`, exactly one
`phase=verdict` record appends, and no kill or restart occurs. CPU is never read.

## 5. Kill with grace and the restart budget

On a `stuck` verdict the supervisor appends `coordinator.stuck` with
`phase=verdict`, `killOutcome=not-attempted` and a bounded key=value evidence
corpus, then verifies the recorded `pid` plus `processStartTimeMs` through the
delivered `DaemonProcessPort`'s optional `startTimeMs` capability, sends TERM,
waits `coordinator.kill-grace`, sends `SIGKILL` only if the tree is still alive,
and appends `phase=outcome` under the same `stuckId` (= the expectation's
`iterationId`). A mismatch sends no signal and records `killFailureReason=
identity-mismatch` with `coordinator.session.kill-failed` at exit 2; an absent
start-time capability is `coordinator.process.capability-gap` before TERM. The
target is the recorded handle only: no name, pattern, or shell interpolation.

The restart budget is per durable epoch in the `coordinator/<coordinatorId>`
namespace, folded from contiguous ordinals starting at 1; a torn or gapped
ordinal set is unevaluable, never count 0. A below-bound restart appends one
record with the next ordinal and proceeds; at or above the bound nothing is
started, the command returns `coordinator.restart-budget-exhausted` at exit 1, and
the escalation path runs. `start --fresh-budget` opens a new epoch at count 0
while the old epoch and its escalation remain in history.

## 6. Exhaustion escalation and the reserved slot

Exhaustion publishes exactly one owner-audience `decision-needed` question
through the delivered blocker channel with `ref` `<coordinatorId>#<budgetEpochId>`,
the restart count and bound, the history reference, and the options
`restart-fresh-budget` / `park-owner-review`; the terminal
`coordinator.exhaustion` receipt lands only after the question. A publish failure
is `coordinator.escalation.publish-failed` at exit 2 with consequence `unknown`
and status `exhausted-escalation-failed`. A repeated exhausted tick reuses the
open question, creates no second question or receipt, and reports
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
counting as open, coordinator audience), and wakes the next iteration — live,
resume, or spawn — within one `coordinator.collection-interval`. Only a
successful wake appends one durable `coordinator.wake` record with outcome
`woken`, the question id, its rank, the persisted `askedAt`, and the iteration
identity. `already-woken`, `answered-before-wake`, `delivery-failed`, and
`no-pickup` are tick results that append nothing, so a retry cannot duplicate a
record. A failed delivery is `coordinator.wake.delivery-failed` at exit 2.

## 8. Records, configuration, and the observation payload

Six additive record kinds live under `delivery.state.v1` (no schema bump, no
migration): `coordinator.iteration`, `coordinator.restart`, `coordinator.stuck`,
`coordinator.exhaustion`, `coordinator.wake`, and `coordinator.fence`. Every fold
— lease, stuck, last decision, last wake — orders by ledger sequence;
`recordedAt` is descriptive only.

The `coordinator` configuration branch declares six keys with shipped defaults:
`stuck-window` 600 000 ms, `kill-grace` 20 000 ms, `restart-budget` 10,
`resume-context-limit` 100 000 tokens, `collection-interval` 30 000 ms, and
`progress-bound` 300 000 ms. No default or bound literal lives in decision code.

Every successful command returns `delivery.coordinator.v1`: coordinator id,
instance folded from the lease, regime descriptor, session facts, last decision,
restart count/bound/epoch/history, the last **persisted** stuck verdict with
non-null phase/reason/evidence, the tick-specific `tickVerdict` (null for
`start`, `stop`, and `status`; nullable phase/reason/evidence when
`progressing`), last wake, escalation state and question id, the last lease action
with previous holder and fence age, and a bounded degradation list. Human output
is deterministic, ANSI-free, and at most 32 lines; machine data is at most 64 KiB.

## 9. Regime descriptor and the M1-S18 seam

The shared supervisor-regime descriptor declares state-dir scope, the
single-instance lease, a unit identity derived from the state directory and the
coordinator identity, a distinct process kind, a distinct budget store,
`supervisorMode` `foreground` (the only v1 value), `externalUnit` `absent`, and
the delivered `SupervisorPort` / `DaemonSupervisorDescriptor` install seam. This
change ships no coordinator installer and changes no daemon command, unit
renderer, control surface, or `daemon.lock`; a future coordinator unit needs the
additive explicit `command` vector named above.

## 10. Constraints

- No CPU signal and no model call in any decision, render, or observation path.
- No prompt, transcript, secret, or credential value in any record or error
  evidence; evidence is bounded key=value at 512 UTF-8 bytes.
- No per-cycle lease record in the foreground loop: one acquisition at loop start
  and one release at loop exit; a quiet tick appends exactly its lease pair.
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
