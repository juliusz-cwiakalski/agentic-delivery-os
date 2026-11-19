---
ados_distribution: internal
id: SPEC-LOOP-SUPERVISION
status: Current
created: 2026-11-19
last_updated: 2026-11-19
owners: ["engineering"]
service: delivery-os
summary: "CEO loop supervision: the `loop` start/stop/status/log/reset family as a composition profile over the delivered supervision engine under the distinct supervisor identity `loop-main`, the preserved shell parity of six status keys plus the additive key block and its per-key source table, the engine-reuse boundary (lease, per-epoch restart budget, stuck record pair, identity-verified kill, six coordinator keys, per-identity verified state read shared; the coordinator cycle, artifact-evidence predicate, wake path, and escalation not shared), the CEO spawn identity with the per-spawn single-seat binding and the deterministic `ceo-loop-<stamp>` title, the two-signal stuck verdict over sourced progress, artifact advance, and the read-only delivery corroborator with its D1-D6 and M1-M6 evidence classes, F0-F3 fold, pid-only owner-liveness rule and deliberate pid-reuse residual risk, the restart-reason compromise over the delivered closed token `stuck-artifact-evidence`, the declared backoff schedule and the at-bound history reference, the durable identity-scoped `loop.stop` and its `reset`, the bounded identifier-only operational log, the single-instance rule with session re-find, the two additive record kinds `loop.session` and `loop.stop`, and the published proof boundary of nine proven and six not-proven surfaces."
links:
  related_changes: ["GH-348"]
  related_decisions: ["TDR-0055", "TDR-0056", "TDR-0017", "TDR-0051"]
  contracts:
    - "packages/core/src/contracts/loop.ts"
    - "packages/core/src/contracts/coordinator.ts"
    - "packages/core/src/contracts/harness.ts"
    - "packages/core/src/contracts/dispatch.ts"
    - "packages/core/src/contracts/daemon.ts"
    - "packages/core/src/contracts/error-table.ts"
---

# Feature: Loop Supervision (M4-S10)

> **Role of this Document:** Source of truth for the delivered `loop` family and
> the CEO supervision cycle. It describes the commands, the projection, the engine
> boundary, the verdict rule, the termination reuse, the restart policy, the
> durable stop, the log, and the proof boundary. Requirements live in the GH-348
> change artifacts; this page describes current behaviour.

The Mode A outer delivery loop is a typed command family: `jaiship loop
start|stop|status|log|reset`. It is a **composition profile** over the
supervision engine the coordinator family already delivered — the append-only
instance lease, the per-epoch restart budget, the stuck verdict/outcome record
pair, the identity-verified kill-with-grace, and the six `coordinator.*`
configuration keys — under the distinct supervisor identity `loop-main`
(TDR-0055). It is not a second supervisor: no new lease, kill path, or budget
fold exists.

The family supervises one long-lived CEO session through the delivered harness
session port. Its stuck predicate is its own pure rule, because the coordinator's
artifact-evidence predicate decides a delivery expectation and would kill a CEO
that is legitimately blocked on a healthy, progressing delivery (INV-DM-3,
INV-DM-5).

## 1. Command family and grammar

| Verb | Grammar | Effect |
|---|---|---|
| `start` | `loop start --foreground [--fresh-budget]` | Folds the durable stop first; a folded request exits 0 with `state=stopped` and no lease record. Otherwise claims the instance lease, establishes or re-finds the CEO session, and runs the foreground supervision cycle. `--foreground` is required in v1; `--fresh-budget` opens the next restart-budget epoch. |
| `stop` | `loop stop [--mode drain\|immediate]` | Appends at most one durable stop request for the loop identity. Never signals a session, never touches the lease, and works whether or not a loop is running. `drain` is the default. |
| `status` | `loop status` | Read-only `delivery.loop.v1` projection. Appends nothing, evaluates no verdict, spawns nothing. |
| `log` | `loop log [--lines <n>]` | Read-only `delivery.loop.log.v1` tail of the operational log. `n` is an integer 1–100; the default is 50. |
| `reset` | `loop reset` | Appends one durable stop clearance when a request is folded; otherwise a no-op success. |

A missing or unknown subcommand, a second positional, a flag outside the verb's
declared set, a bare `start` without `--foreground`, and a malformed `--lines`
value are grammar refusals: `fallback.invocation` at exit 1 with the summary
`result=refused; reason=grammar` (the bare `start` names the `--foreground`
requirement). No refusal mutates state.

`--json`, `--verbose`, and `--pretty` are the CLI's global flags. They are
accepted on every verb and are never grammar refusals; `--json` selects the
machine payload.

`start` ends for exactly five declared causes: a folded stop, a signal, the
composition's cycle driver reporting its declared end (a declared clean end at
exit 0), a restart-budget exhaustion (exit 1), or a failure (its mapped exit).
It always releases the lease it holds.

## 2. Exit vocabulary and the shell mapping

| Outcome | Identity | Exit |
|---|---|---|
| Clean stop, folded stop, or the driver's declared clean end | — (`state=stopped`) | 0 |
| Grammar or missing-`--foreground` refusal | `fallback.invocation` | 1 |
| Restart budget at or above the bound | `coordinator.restart-budget-exhausted` | 1 |
| A pre-session provider, configuration, or harness refusal | the delivered refusal identity | 1 |
| A live instance lease holder | `coordinator.already-running` | 2 |
| An undeclared alive capability, or an unavailable self-identity | `coordinator.process.capability-gap` | 2 |
| An unconfirmed termination | `coordinator.session.kill-failed` | 2 |
| An unreadable or torn state read or stop fold | the delivered `state.*` row | that row's projection (`state.permission.denied` projects 1; the platform rows project 2) |

Parity against the shell's three exit values is deliberate: clean stop 0 and
max-restarts 1 are preserved; the shell's usage exit 2 becomes the closed
projection table's `user-validation` exit 1, because exit 2 now means a
supervision failure rather than a bad argument.

## 3. Status projection and the status-key source table

Human `status` renders a deterministic, ANSI-free `key=value` block in this
order — the six shell names first, so an existing consumer keeps working, then
the additive tail:

`loop_running`, `loop_pid`, `ceo_alive`, `ceo_pid`, `ceo_session`,
`stop_signal`, `stop_mode`, `loop_id`, `ceo_title`, `restarts`, `budget_epoch`,
`last_restart_reason`, `last_verdict`, `degraded`.

Exactly three keys are boolean and render `yes`/`no`: `loop_running`,
`ceo_alive`, and `stop_signal` (`yes` when a stop is folded). Every absent value
renders as the **empty string after `=`**; no placeholder token is emitted.

| Key | Source | Empty when |
|---|---|---|
| `loop_running` | the lease fold: an `acquired` / `stale-takeover` action that has not been released | never — renders `no` |
| `loop_pid` | the lease instance's recorded pid | no live instance lease record |
| `ceo_alive` | the current session's liveness | never — renders `no` |
| `ceo_pid` | the **live** session only | the session is not alive — shell parity: the shell reads both from a live CEO child |
| `ceo_session` | the **live** session only | the session is not alive |
| `stop_signal` | the folded `loop.stop` transition | never — renders `no` |
| `stop_mode` | the folded request's mode | no stop is folded |
| `loop_id` | the constant supervisor identity `loop-main` | never |
| `ceo_title` | the recorded fresh-spawn title of the newest `loop.session` record | no session has ever been recorded |
| `restarts` | `<count>/<bound>` from the epoch fold plus the composition-supplied `coordinator.restart-budget` | never — renders `0/<bound>` |
| `budget_epoch` | the persisted epoch on the lease carrier, else the newest restart record's epoch | no epoch has been persisted |
| `last_restart_reason` | the newest `coordinator.restart` record's reason | no restart has been recorded |
| `last_verdict` | the newest `coordinator.stuck` record's verdict | no verdict has been recorded |
| `degraded` | the closed degradation list, comma-joined in vocabulary order | the list is empty |

`loop_id` is the constant identity and is never the instance id; `loop_pid` is
the instance's pid. The two never stand in for each other. The degradation
vocabulary is closed at five values: `session-pid-unknown`,
`progress-unreadable`, `delivery-corroborator-unreadable`, `live-facts-unknown`,
`log-unavailable`. `state` is projected from the lease fold as `running` or
`stopped`; the contract vocabulary also declares `unknown`, which the projection
does not produce while the lease fold is readable.

The instance projection carries the lease instance and its pid; the session
projection carries the live session id, alive flag, pid, the recorded title, and
the progress state the running supervisor **last observed** (`null` before its
first reading, never a fabricated token); restarts carry count, bound, epoch, and
last reason; the stop fact carries the folded request and mode; the verdict
carries the newest persisted verdict, reason, and bounded evidence. The progress
state appears only in the machine projection's `session.progress`; the human
block has no progress key.

## 4. Engine reuse boundary

The loop shares the delivered engine primitives and deliberately does not share
the coordinator's supervision cycle (TDR-0055).

| Surface | Shared with the coordinator | Notes |
|---|---|---|
| Instance lease (`coordinator.fence`) | Yes | Same append-only fold and `decideCoordinatorClaim` decision: liveness first, then the 2 × `coordinator.collection-interval` age fallback, one `acquired` or one `stale-takeover` record, an undeclared alive capability refused before any record. |
| Per-epoch restart budget (`coordinator.restart`) | Yes | Same contiguous-ordinal admission and the same `coordinator.restart-budget` bound; the budget epoch is persisted on the lease carrier and `--fresh-budget` opens the next one. |
| Stuck record pair (`coordinator.stuck`) | Yes | Same payload schema, the same closed verdict/reason vocabularies, and the same verdict-then-outcome shape. |
| Identity-verified kill-with-grace | Yes | The same grace key (`coordinator.kill-grace`) and the delivered harness `terminate` operation. |
| Configuration | Yes | The six `coordinator.*` keys with their shipped defaults; no new key. |
| Per-identity verified state read | Yes | `readCoordinatorRecords(store, loopId)`; record keys are identity-scoped, so a second identity's records are skipped rather than rejected. |
| Supervision cycle | **No** | The loop runs its own cycle over the CEO session. |
| Stuck predicate | **No** | The coordinator's artifact-evidence `evaluateStuck` is not used; the loop's two-signal rule applies (§7). |
| Wake path and escalation | **No** | The loop publishes no question and no answer; budget exhaustion ends the loop with its own bounded summary instead of an owner escalation. |
| `coordinator.iteration` records | **No** | The loop writes none; the delivered `iterationId` is a required string, not a foreign key. |

`loop start` and `coordinator start --foreground` therefore do not exclude each
other and neither reads the other's records: the ledger key is identity-scoped
(`coordinator.fence:loop-main` versus `coordinator.fence:coordinator-main`).

## 5. CEO session spawn and the durable session record

A fresh session is spawned through the delivered harness session port with:

- the caller agent identity `ceo`;
- the single-seat binding produced by the delivered per-spawn profile
  resolution, so the adapter renders exactly one `--agent ceo` and one resolved
  `--model`;
- exactly one deterministic title `ceo-loop-<UTC yyyymmdd-hhmmss>` (≤ 64
  characters), which is also the exact-identity reap target for termination;
- a fixed argv, never shell-interpreted.

A resume carries no title. A pre-session refusal keeps its delivered identity —
an unassigned `ceo` seat refuses `provider.profile.invalid`, an unresolvable
profile context refuses `config.value.invalid`, and an unrepresentable seat model
refuses `harness.profile.model-unrepresentable` — all at exit 1, all before a
session exists, all with the lease released and no session record.

The session's process id, when the adapter can supply it, is the additive
optional `pid` on the harness session handle. It is recorded on the loop's
`loop.session` record together with the platform start time read at acquisition.
When the adapter supplies none, the record carries `null` (never a fabricated
number), `status` discloses `session-pid-unknown`, and the loop degrades
conservatively: a recorded `active` session without a verifiable process identity
(no pid, or a pid with no platform start time) is unknown-liveness (no stuck
verdict) and is joined or resumed rather than duplicated.

One `loop.session` record is appended per acquisition and one per state change
(`active` → `ended`) — never one per cycle, so a quiet or continuously
progressing session appends nothing.

## 6. Single instance and session re-find

The loop claims the delivered append-only instance lease under `loop-main`:

- a live holder is refused `coordinator.already-running` at exit 2 with no
  session record and no spawn;
- a dead holder is taken over with exactly one lease record;
- an undeclared alive capability is `coordinator.process.capability-gap` at exit
  2 before any record.

After a takeover the loop resolves its recorded session **before** it considers
spawning, and every arm is conservative:

| Recorded state | Effect |
|---|---|
| the current process holds a live session | join and observe; no spawn |
| a recorded pid is alive **and** its platform start time read at acquisition still matches | join and observe; no spawn, and no reliance on a composition timestamp |
| a recorded pid is present but its platform start time is `null` | unknown-liveness: joined with the recorded identity and never probed with `0`; no spawn |
| the session is recorded `ended` | replaced by exactly one fresh session |
| the session is recorded `active` with no process identity | unknown-liveness: resumed exactly once with the recorded session id and no title; never killed, never duplicated |

A re-find seeds the established facts from the joined session — and, in the
production composition, from the newest durable `loop.session` when the fresh
process holds no in-memory facts — so the re-found session is observed live by
later cycles rather than as an absent in-memory placeholder. A recorded `pid`
without a platform start time cannot be identity-verified, so it takes the
unknown-liveness join arm and is never replaced by a spawn.

No path spawns a second session beside a recorded live one, so at most one CEO
session exists at any observation point.

## 7. Two-signal stuck verdict

The verdict is a pure, total function over three injected fact sets.

1. **Sourced progress** — the projected new-turn fact from the delivered mapper
   over a sourced `token-delta` reading of the recorded session. A positive delta
   is `positive`, a sourced zero is `zero`, and no source is `unknown`.
2. **Artifact advance** — whether a `merge.transaction` or a blocker answer
   record landed **after the same baseline instant the stuck window measures
   from**: the last sourced-progress observation the running supervisor holds.
   Before the supervisor holds a baseline, no record counts as "since" it, so the
   signal reports no advance. A record with no parseable `recordedAt` counts as an
   advance, so an undatable artifact can only delay a verdict, never cause a kill.
3. **Delivery corroborator** — `in-progress`, `none`, or `unknown`, decided from
   the newest-per-ref lane records and the process-port probe (§7.1).

`stuck` requires all of: a live session; sourced progress `zero` for at least
`coordinator.stuck-window` (600 000 ms) measured from that baseline; no artifact
advance since that baseline; and a readable corroborator that reports `none`. A
`stuck` verdict always requires a sourced `zero`: a positive reading is never
laundered into a kill.

`progressing` when sourced progress is positive within
`coordinator.progress-bound` (300 000 ms), or when the corroborator reports a
delivery in progress. A positive reading with no timestamp is treated as fresh
because no age evidence exists. With no delivery corroborated in progress, a
positive reading older than the bound is **stale**: it does not license
`progressing`, and it is not a sourced zero, so it never licenses `stuck` either.

`unevaluable` when the progress reading is `unknown`, the corroborator is
unreadable, or a stale positive reading falls through the progressing causes.
Nothing is killed; exactly one verdict record lands per expectation and the loop
continues. An unreadable or stale input is never laundered into a kill.

A supervisor that has only just started seeds the progress observation at its own
session acquisition or first reading — never earlier — so a process restart can
only delay a verdict, never cause one.

### 7.1 Delivery corroborator: evidence classes and the fold

The corroborator is a total decision over delivered facts from the same verified
state read plus the delivered process-port liveness probe. It consumes store
readability, the newest `dispatch.lane` record for **every** ref that has one
(state, owner `processId` presence, owner liveness), and the newest
`daemon.lane` record (state, `processId` presence, liveness). It consumes **no**
`startedAt` value, no age bound, and no start-time comparison.

The dispatch input is reduced to the **newest record per ref** before
classification, so a superseded `active` lane is never classified and cannot veto
a stuck verdict by contributing `in-progress`. Each candidate lane contributes at
most one class:

| # | Candidate | Contribution |
|---|---|---|
| D1 | no `dispatch.lane` record for the ref | ignored |
| D2 | newest `dispatch.lane` is `terminal` (any owner pid) | ignored |
| D3 | newest `dispatch.lane` is `active` with an absent owner `processId` | `unknown` |
| D4 | newest `dispatch.lane` is `active` with a present, alive owner `processId` | `in-progress` |
| D5 | newest `dispatch.lane` is `active` with a present, dead owner `processId` | ignored |
| D6 | newest `dispatch.lane` is `active` with a present owner whose liveness is unreadable | `unknown` |
| M1 | no `daemon.lane` record | ignored |
| M2 | newest `daemon.lane` state is anything other than `delivering` | ignored |
| M3 | newest `daemon.lane` is `delivering` with an absent `processId` | `unknown` |
| M4 | newest `daemon.lane` is `delivering` with a present, alive `processId` | `in-progress` |
| M5 | newest `daemon.lane` is `delivering` with a present, dead `processId` | ignored |
| M6 | newest `daemon.lane` is `delivering` with a present owner whose liveness is unreadable | `unknown` |

Owner liveness is the delivered process-port probe on the recorded id: `alive`,
`dead`, or `unreadable` (an undeclared or failing probe).

The fold is evaluated in this order; the first matching rule decides:

| # | Condition | Reading |
|---|---|---|
| F0 | the state read is unreadable | `unknown` |
| F1 | any candidate contributes `in-progress` | `in-progress` |
| F2 | else, any candidate contributes `unknown` | `unknown` |
| F3 | else — readable store, and every active/delivering candidate was ignored because its owner pid is present and provably dead | `none` |

`none` is reachable **only** through F3, so an unreadable store, an absent pid, or
an unreadable probe is always `unknown` — never `none`, because `none` licenses a
kill. `in-progress` dominates `unknown` because both are kill-safe and
`in-progress` is the more informative reading.

**Residual risk, stated deliberately.** The rule uses process identity by pid
only, so a **reused pid** can make a dead delivery's lane look alive. The
corroborator then reads `in-progress` and the loop declines to kill a CEO that is
genuinely stuck. That error is a *delay*, bounded by the next observation in
which the pid is gone and the window runs again; it can never cause a kill. The
opposite asymmetry — a false `none` for a live delivery — would kill a healthy
session, which is the exact failure INV-DM-3 exists to prevent. A delayed kill is
recoverable by an operator (`loop stop --mode immediate`, then `loop start`); a
killed healthy delivery is not. The asymmetry is therefore deliberate and is not
to be tightened with a start-time or age test over a fact the lane does not
carry.

### 7.2 Verdict and outcome records

On `stuck` the loop appends one `coordinator.stuck` **verdict** record and then
one **outcome** record under the same `stuckId`, with the bounded identifier-only
evidence corpus (`traffic`, `delivery`, `progressAgeMs`, `windowMs`,
`killOutcome`, and `killFailureReason` populated only on a failed kill). Both
`stuckId` and `iterationId` are the loop-scoped value `<loopId>:<cycle ordinal>`;
`coordinatorId` is `loop-main`. The loop writes no `coordinator.iteration` record
and no third record kind.

## 8. Termination reuse

Termination is the delivered identity-verified path and is never re-implemented.
For a session this process holds, the loop calls the delivered harness `terminate`
operation: TERM goes to the session's own process tree, KILL only after the
declared grace (`coordinator.kill-grace`), an escaped runtime is matched only by
this session's identity or its exact title, and a repeated terminate is
idempotent. No name or pattern match exists and a mismatch sends no signal.

An unconfirmed termination is **terminal and closes the loop**: the mismatch or
failed-signal arm appends exactly one outcome record, releases the lease, and
exits 2 on `coordinator.session.kill-failed` — with no restart and no second
session, because a possibly-live orphan must never be joined by another session.
Only a **confirmed** termination proceeds to the restart path (§9).

On `stop --mode immediate`, a held session is terminated within one collection
interval plus the declared kill grace. A session whose process identity cannot be
verified is never signalled; the loop reports `session-pid-unknown` and ends at
the iteration boundary instead.

## 9. Restart policy, backoff, and the budget

Only a **stuck** restart consumes a restart ordinal; a session that ends on its
own never does.

A below-bound stuck restart appends exactly one `coordinator.restart` record
carrying the next contiguous ordinal, the replaced session identity, and the
delivered closed reason `stuck-artifact-evidence`; then the loop waits
`restartDelayMs(n) = min(2 000 × 2^(n−1), 300 000)` milliseconds for ordinal `n`
and starts the next session.

| Ordinal | 1 | 2 | 3 | 4 | 5 | 6 | 7 | 8 | 9 | 10 |
|---|---|---|---|---|---|---|---|---|---|---|
| Delay (ms) | 2 000 | 4 000 | 8 000 | 16 000 | 32 000 | 64 000 | 128 000 | 256 000 | 300 000 | 300 000 |

A full epoch's delays total ≤ 1 110 000 ms. The wait is cancellable: a durable
stop or a signal ends it immediately, without the session effect. The injected
delay records rather than sleeps in the battery.

**The restart reason is a declared operator-facing compromise.** The durable
reason is the delivered closed token `stuck-artifact-evidence`, because this
family adds no reason token to a delivered closed vocabulary — even though the
loop's verdict is the two-signal rule rather than artifact evidence. The facts
that distinguish a loop restart from a coordinator restart (traffic state,
corroborator reading, progress age) ride the bounded evidence corpus of the
paired `coordinator.stuck` records, and the loop's `event=restart` log line
carries the same facts. An operator reading `coordinator.restart` alone cannot
tell the two apart and must read the corpus or the log line.

At or above the bound (`coordinator.restart-budget`, default 10) no restart
record is appended and no session starts: the loop releases the lease, logs
`event=budget-exhausted`, and exits 1 on the delivered
`coordinator.restart-budget-exhausted` identity, with its own bounded summary
naming the derivable **history reference**
`<epoch>;restarts=<count>;seq=<the newest restart record's ledger sequence>`,
`restarts=<n>/<bound>`, and the remediation `loop start --foreground
--fresh-budget`. The history reference is derived from durable state alone: the
epoch from the lease carrier, the count from the restarts in that epoch, and the
sequence from the newest restart record.

The detecting-to-next-session bound is the **formula**
`stuck-window + collection-interval + kill-grace + first backoff`, which is
`600 000 + 30 000 + 20 000 + 2 000 = 652 000 ms` at the shipped defaults. The
implementation holds the formula, never a hardcoded literal, so a raised
collection interval raises the bound.

## 10. Durable stop and reset

`loop stop` appends exactly one `loop.stop` record for the loop identity with
action `requested` and the requested mode; a repeat within a stop episode appends
nothing and still exits 0. `loop reset` appends exactly one record with action
`cleared` when a request is folded, otherwise nothing (exit 0 either way).

The stop names the **loop identity**, never a process instance: no pid, start
time, or holder participates, which is what makes it survive any number of
restarts, a crash, and a fresh process (TDR-0056).

- `start` folds the stop **before** claiming the lease. A folded request yields
  exit 0 with `state=stopped`, no lease record, no session, and no session
  record.
- A torn or unreadable fold fails closed — a `state.*` failure at exit 2 with no
  lease record and no session — because "unreadable" must never read as "not
  stopped".
- A running loop re-reads the fold at every iteration boundary.
- `drain` (the parity mode) never terminates a session: the loop finishes the
  current session, then ends. `immediate` terminates the held session (§8). Both
  release the lease and exit 0.

The typed stop and the legacy shell's workspace marker are not interchangeable:
neither reads the other, so a `loop stop` does not stop a running
`scripts/ceo-loop.sh` and a `ceo-loop.sh --stop` does not stop the typed loop.
Each path's own stop and reset governs that path.

## 11. Operational log

The loop appends one single-line, ANSI-free, identifier-only record per
supervision event: `start`, `cycle`, `session`, `stuck-verdict`, `kill`,
`restart`, `backoff`, `stop`, `budget-exhausted`, `release`, `error`. A line is
`<ISO-8601 UTC> event=<name>` followed by bounded `key=value` pairs and is at
most 512 UTF-8 bytes; whole pairs are dropped rather than cut.

| Bound | Value |
|---|---|
| One line | 512 UTF-8 bytes |
| Active file | 1 048 576 bytes (1 MiB) |
| Retained rotated generations | 1 |
| Total footprint per identity | 2 097 152 bytes (2 MiB) |
| `log` default / maximum lines | 50 / 100 |

The log lives inside the project state directory beside the state ledger, per
loop identity (`loop/<loopId>.log`). Its directory is created by the first
append, never by a read. When an append would push the active file past 1 MiB it
is rotated to one retained generation and the previous generation is discarded,
so the oldest data is always the data that is dropped.

The log is bounded observability, not durable truth: an append or rotation
failure is swallowed after one bounded attempt, never changes the loop's verdict,
exit code, or records, and is disclosed only as the `log-unavailable` degradation
entry. A read of a missing or empty log is a success with zero lines; a read of an
unreadable file reports zero lines with `unreadable: true`. No prompt, transcript,
diff, credential, environment value, model name, or seat name is ever written.

## 12. Configuration

The loop adds **zero** configuration keys. It consumes the six delivered
`coordinator.*` keys and their shipped defaults.

| Shell knob | Typed key | Value |
|---|---|---|
| `CEO_LOOP_STUCK_MINUTES=10` | `coordinator.stuck-window` | 600 000 ms |
| `CEO_LOOP_POLL_SECONDS=30` | `coordinator.collection-interval` | 30 000 ms |
| `CEO_LOOP_KILL_GRACE_SECONDS=20` | `coordinator.kill-grace` | 20 000 ms |
| `CEO_LOOP_MAX_RESTARTS=10` | `coordinator.restart-budget` | 10 |
| `CEO_RESUME_TOKEN_LIMIT=100000` | `coordinator.resume-context-limit` | 100 000 (read only if a total-context source exists; unreachable today) |
| `CEO_LOOP_SLEEP_SECONDS=2` | — (replaced) | the backoff schedule plus the collection interval |
| `CEO_LOOP_MAX_ITERATIONS=0` | — (not mapped) | the loop is unbounded, as `0` meant |
| — (no shell counterpart) | `coordinator.progress-bound` | 300 000 ms |

Configuration resolution failure falls back to the shipped defaults, so the
prompt-required surface always composes and the family surfaces no configuration
identity of its own.

## 13. Records

Two additive record kinds join `delivery.state.v1` with no schema-version bump
and no migration. Both are latest-wins by ledger sequence, and both are written
and read only by the loop supervisor under the loop identity.

| Kind | Payload schema | Store key | Purpose |
|---|---|---|---|
| `loop.session` | `delivery.loop.session.v1` | `loop.sessions:<loopId>` | The loop's durable session identity: `sessionId`, `harnessKind`, `pid` (or `null`), `processStartTimeMs` (or `null`), `title` (or `null`), `state` (`active`/`ended`), `acquiredAt`, `recordedAt`. One append per acquisition and per state change. |
| `loop.stop` | `delivery.loop.stop.v1` | `loop.stops:<loopId>` | The durable identity-scoped stop: `stopId`, `action` (`requested`/`cleared`), `mode` (`drain`/`immediate`, or `null` on a clearance), `recordedAt`. |

A replayed `sessionRecordId` or `stopId` appends nothing. A malformed payload of
either kind is a classified `state.store.torn`, never a silently dropped record.
The coordinator family reads only its own identity's keys, so it never sees these
records; the daemon family neither reads nor writes them, and the loop never
writes a daemon lane.

## 14. Published proof boundary

The offline conformance battery proves nine surfaces and explicitly does not
prove six. This list is the permanent fixture constant
`LOOP_PARITY_PROOF_BOUNDARY` (`tests/fixtures/loop/parity/evidence.ts`); this page
publishes the same boundary in the same order.

**Proven (9):** `verbs`, `log`, `spawn`, `stuck`, `kill`, `backoff-budget`,
`stop`, `single-instance`, `no-shell`.

| Proven id | What it proves |
|---|---|
| `verbs` | All five verbs, their grammar, refusals, exits, payloads, and the status-key block. |
| `log` | The line contract, rotation and retention bounds, and the bounded read. |
| `spawn` | The CEO agent identity, the resolved seat model, the deterministic title, the fixed argv, and the pre-session refusals. |
| `stuck` | The two-signal verdict including the baseline-relative artifact advance, the stale-positive and unreadable `unevaluable` paths, the corroborator veto under the newest-per-ref evidence-class and fold tables, and the window-to-restart bound formula at two interval settings. |
| `kill` | TERM-before-KILL within the grace, the exact target set, the identity-mismatch path, the terminal no-restart consequence, and idempotence. |
| `backoff-budget` | The exact delay schedule, one ordinal per stuck restart, zero ordinals for a clean end, and the at-bound refusal with its exit. |
| `stop` | The durable request surviving a simulated process restart and crash, the clearance, the idempotence, and both stop modes' latency bounds. |
| `single-instance` | The two-start interleaving, the liveness-first takeover, session re-find without a second spawn (the joined session observed live, and a recorded pid with a null start time joined as unknown-liveness and never probed with `0`), the distinct coordinator identity, and the session-uniqueness invariant. |
| `no-shell` | The injected runner recording zero, the static invariant over the declared loop surface with its mutation control, and the prompt scan. |

**Not proven (6):** `live-opencode`, `live-provider`, `os-termination`,
`real-pick-deliver-merge`, `long-run-loop`, `cross-process-race`.

| Not-proven id | What remains unproven |
|---|---|
| `live-opencode` | A real session's real message traffic, real resume after a real process exit, and real stdout framing. |
| `live-provider` | A real profile selection against live quota, balance, or availability. |
| `os-termination` | OS-level termination of a real child and a real escaped runtime; the battery proves the contract, ordering, grace, and exact-identity target selection, not kernel signal delivery. |
| `real-pick-deliver-merge` | A real tracker, pull-request, CI, and merge effect; the scenario drives the real composed command runtime and asserts its envelopes, but those external effects are fixtures and remain unproven. |
| `long-run-loop` | Long-run behaviour under a real clock and real multi-minute delays; the battery injects time. |
| `cross-process-race` | Race freedom beyond the state store's fence guarantee; the two-start interleaving is deterministic, not an arbitrary OS schedule. |

Every battery row declares one proven surface, and no row may name a not-proven
one. A page/constant mismatch is a documentation-phase defect, checked by the
current-truth doc guard, never by the delivery-phase battery.

## 15. Testing

The enduring coverage map is the
[loop supervision test specification](../../quality/test-specs/test-spec-loop-supervision.md).
The pure rules (verdict, backoff, status block, log line) and the cycle cases
live under `tests/behaviour/loop-*.test.ts`; the shipped composition is proven by
`tests/structure/loop-production-composition.test.ts`,
`loop-production-session.test.ts`, and `loop-imports.test.ts`; the parity battery
and the pick-deliver-merge scenario live under `tests/conformance/loop/`. That
scenario drives the real composed command runtime over the delivered dispatch
conformance fixtures and asserts its real envelopes, lane evidence, and zero
shells; a live pick-deliver-merge remains not proven, so the nine/six boundary is
unchanged. `scripts/checks/no-shell-dispatch.ts` scans the declared loop surface.

## Related

- [Coordinator Supervision](feature-coordinator-supervision.md) — the engine this
  profile composes and the family it sits beside.
- [Autonomous Delivery](feature-autonomous-delivery.md) — Mode A, INV-DM-3/INV-DM-5,
  and the shell fallback this family proves unnecessary.
- [Harness Adapters](feature-harness-adapters.md) — the session port, the
  additive optional handle pid, the fresh-spawn title, and `terminate`.
- [State Layer](feature-state-layer.md) — the two additive record kinds.
- [Result Contract and Error Table](feature-result-contract.md) — the reused
  coordinator and state identities, and the confirmation that no identity is added.
- [Resident Dispatch Daemon](feature-resident-daemon.md) — the `daemon.lane`
  record read as a corroborator.
- [Dispatch Engine](feature-dispatch-engine.md) — the `dispatch.lane` record read
  as a corroborator, and the per-repository handover that gates F6.
- [Configuration Layer](feature-config-layer.md) — the six consumed keys.
- [CLI Entrypoint and Self-Description](feature-cli-entrypoint.md) — the
  twenty-seventh prompt-required family and the M4 reference-page root.
- Decision records: [TDR-0055](../../decisions/TDR-0055-loop-supervision-as-a-profile-of-the-coordinator-engine.md)
  (the profile boundary) and
  [TDR-0056](../../decisions/TDR-0056-durable-loop-stop-as-a-state-ledger-record.md)
  (the durable stop home).
- Reference page: [`loop`](../../planning/oss-tooling/milestones/m4/commands/loop.md).
