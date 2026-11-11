---
ados_distribution: internal
id: SPEC-RESIDENT-DAEMON
status: Current
created: 2026-11-08
last_updated: 2026-11-10
owners: ["engineering"]
service: delivery-os
summary: "The resident dispatch daemon: the start/stop/status/install family, composed only when a daemon runtime is supplied and not mounted at the production entrypoint, fence-style single-instance ownership, durable instance/heartbeat/lane/reconciliation/preemption records, control protocol v1 over stdio and unix, state-mediated truth and the daemon-down one-shot surface, startup reconciliation, lane supervision through the composed lane-launch planner and lane executor seam with the conditional owner-hold guarantee, the external-effect protocol with message-independent commit crash safety, safe-boundary preemption, bounded live watch, per-platform polling, the optional systemd user unit, and the daemon-path dispatch attempt record."
links:
  related_changes: ["GH-238", "GH-239", "GH-241", "GH-280", "GH-284", "GH-288"]
  related_decisions: ["ADR-0003", "TDR-0014", "TDR-0004", "TDR-0015"]
  contracts:
    - "packages/core/src/contracts/daemon.ts"
    - "packages/core/src/contracts/control.ts"
    - "packages/core/src/contracts/effects.ts"
    - "packages/core/src/contracts/principal.ts"
---

# Feature: Resident Dispatch Daemon (M1-S18)

The daemon is an optional supervisor. State is the only shared truth and the
only durable route; the control socket is an optimization. Its absence never
changes a one-shot result, a lease decision, a park decision, or a blocker
answer.

## Vocabulary and bounds

Seven additive record kinds join `delivery.state.v1`: `daemon.instance`,
`daemon.heartbeat`, `daemon.lane`, `daemon.reconciliation`,
`daemon.preemption`, `command.receipt`, and `outbox.effect`. The `daemon` error
kind carries exactly eight rows: `daemon.already-running`,
`daemon.takeover-refused`, `daemon.heartbeat-stale`,
`daemon.state-recovery-failed`, `daemon.protocol.unsupported`,
`daemon.socket-unreachable`, `daemon.subscriber-degraded`, and
`daemon.supervisor-unsupported`. The `daemon` configuration branch carries
eleven keys (heartbeat interval/cycle, lock staleness, poll and watch-poll
intervals, response timeout, subscription buffer, frame max bytes, reconcile max
lanes, transport, socket path); the `poll.<platform>` branch carries
`base-interval`, `max-interval`, and `min-spacing` for `github`, `gitlab`, and
`jira`. Bounds are a 65,536-byte frame, a 256-frame subscription buffer, 200
status lanes, 200 reconciliation lanes, 40 lines / 8,192 bytes of human output,
512 bytes of receipt/effect evidence, and a 2,000 ms response timeout.

The change capsule (`events.jsonl`, `candidates/`) is closeout-owned file state
inside the change folder. The daemon appends no capsule event, reads no capsule
record, and the state ledger never carries capsule records.

## Command family

`daemon start [--foreground]`, `daemon stop [--mode drain|immediate]`,
`daemon status [--live]`, `daemon install`, `daemon uninstall`. The family is
composed only when a daemon runtime is supplied to the CLI composition; the
production entrypoint supplies none, so `<binary> daemon ...` reaches no
lifecycle handler and the invocation is refused at the entrypoint. Mounting the
family is product work tracked in the
[M2 entrypoint delta](../../planning/oss-tooling/milestones/m2/entrypoint-delta.md).
The state directory is selected process-wide by the one state-scope policy: an
absolute `<PREFIX>_STATE_DIR` when set, otherwise the injected home plus
`<brand.stateDirectoryName>`, which names the host root. There is no `--state-dir`
flag and no state-directory configuration key.

The daemon's own state is project-owned. The single composing site that supplies a
state directory to the delivered settings resolution
(`resolveProjectDaemonSettings` in `packages/cli/src/daemon-compose.ts`) passes the
policy-derived **project** state root, so the derived socket path and the
supervisor `Environment=` binding lie inside `<host root>/projects/<project key>`
and an explicit socket path outside it is refused. The settings resolution has
exactly one call site, and the family stays unmounted in this build.

- `start` acquires the daemon lock, reconciles, appends one instance record,
  appends one reconciliation record, opens the transport, writes the first
  heartbeat, starts the resident cadence (heartbeat, lane supervision, effect
  detection, and blocker-answer consumption), and returns at readiness. The
  default leaves the daemon resident; `--foreground` keeps the process attached
  for a supervisor unit. A start that fails after acquiring the lock releases
  the lock; once an instance record exists it appends a terminal `released`
  record, leaving no live owner behind. A transport that cannot open starts the
  daemon in declared transport-degraded mode with `daemon-socket-unreachable`;
  state-mediated operation continues and the socket is never reported reachable.
- `stop` is state-first. Against an absent daemon it is an idempotent `noop` at
  exit 0. `drain` records live lanes detached and releases; `immediate` records
  `immediate-stop` and signals no lane.
- `status` derives instance, queue, lane, restart-counter, heartbeat, and
  reconciliation values from durable records (restart counters fold the delivered
  `economics.restart` records) and probes the configured control transport for
  reachability. Plain status exits 0 for a readable but degraded or absent
  daemon and declares `daemon-heartbeat-stale` and/or `daemon-unreachable`;
  unreadable state exits 2 with `daemon.state-recovery-failed`. Only
  `status --live` additionally fails closed on `daemon.socket-unreachable` or
  `daemon.heartbeat-stale`.
- `install`/`uninstall` manage the optional Linux systemd user unit.

The command envelopes never carry the daemon lock token. Exit projection is the
delivered `{0,1,2}` taxonomy.

## Single-instance lock and liveness

The lock is a daemon-owned `daemon.lock` artifact over the state-directory edge,
with a unique token, exclusive create, 0600, and a verified 0700 directory. It is
not the state writer fence: the fence is acquired only for each short append.
A heartbeat age at or beyond `daemon.lock-staleness` is stale and
takeover-eligible; a live holder refuses `daemon.already-running` with the
holder's identity, process, acquisition time, and heartbeat age and appends
nothing. Takeover appends `taken-over` with the previous instance, token, last
heartbeat, heartbeat age, and takeover time.

The heartbeat record carries instance identity, a monotone ordinal, beat time,
uptime, queue depth, lane counts, the current spawn when one exists, and the
consumed cursor. Liveness folds to `running`, `stale`, or `stopped`; no reader
fabricates a beat.

## Control protocol v1

Newline-delimited JSON with a transport-free codec, a session layer, and
stdio/unix transports. Wire types are exactly
`{poke,status,lane,subscribe,drain,stop,takeover,frame,degraded}`; interaction
classes are derived. Version 1 requires `callerPrincipal`; version 0 is the
compatibility shape without the reserved field. Every subscription has a bounded
buffer; overflow emits one `degraded` event with `subscriber-overflow` and drops
only that subscription. `daemon.subscription-buffer` is the single capacity
bound for both the per-subscription frame buffer and the per-connection
subscription count: a subscription request beyond that count is refused with
`daemon.subscriber-degraded`, with no separate capacity key. Responses are
routed only to the asking connection.
Control actions are at-most-once by (connection identity, frame id, lock token);
a cross-connection id collision is a distinct request. The lock token appears
only in the three control payloads and durable lock/instance records.

## State-mediated truth and one-shot continuity

Queue intents, blocker answers, `phase complete`, and `commit` land without a
daemon. A daemon-down queue surface carries `degraded: ["daemon-unreachable"]`
at exit 0; the marker is absent when the daemon is reachable. On its heartbeat
cadence the daemon consumes durable blocker answers and records a pending
`resumeIntent` on the matching delivering lane; the answer record stays
`applied: false` and the intent applies at the next safe boundary. Activation
order is poke, event-log tail, bounded poll; losing any wake changes nothing
durable.

## Startup reconciliation

On start the daemon reads the verified queue, lanes, leases, parks, transitions,
economics restarts, and blocker questions. Every in-flight lane is classified
once: `alive` (reattach, no restart), `interrupted` (gone with no failure
record: resume from the ledger position and consume one restart), or `crashed`
(failure record: classify the reason and resume per budget). Insufficient
evidence holds the lane with `evidence-insufficient`. At or past the restart
budget the lane becomes a terminal `failed`, the delivered exhaustion record is
present, and a typed question is raised; exhaustion never silently requeues.
Unreadable state refuses the start with `daemon.state-recovery-failed`. One
`daemon.reconciliation` record is appended per instance, carrying the folded
entry, edge, and active-park counts plus the per-lane classification; it is
bounded by `daemon.reconcile-max-lanes` with explicit truncation, and a replay
appends no second report. The report's `duplicates` value is measured from the
verified ledger across the queue, lane, blocker, outbox, and receipt identity
kinds: a repeated kind plus identity whose payload is identical to the first is
a duplicate append, while a payload-changing update is not. A checked read
returns `0` only when it found no such duplicate.

## Lane supervision

The daemon computes the next action, claims the lease through the delivered
fenced claim path, asks the lane executor to start, records one
`daemon.lane` delivering record, observes, and releases or parks. It performs no
delivery work in-process: no phase run, no commit, no gate. The daemon
composition supplies `createLaneLaunchPlanner`, which returns the lifecycle
prompt and only the declared execution-environment variable names, and composes
`createLaneExecutor` over the selected harness session port and descriptor, so a
planned lane starts, records the delivered lane record, observes progress,
collects the outcome, and resumes through the same executor. The lane seam is
factory-proven: the daemon composition composes it when a lane composition is
supplied. The production daemon entry that supplies the lane composition and
registers the daemon command remains the resident-daemon production scope
(GH-238); the dispatch engine proves the seam and the daemon-path attempt
producer, not a resident production daemon that launches lanes.

A supervision cycle that derives its next-action seam from a held scheduling
pass receives no action, and a claim port that supplies the resolved owner-hold
fact refuses `queue.precondition.unmet` with reason `owner-hold` before the
fence. The guarantee is conditional on that composition: the production daemon
entry is not wired and resolves no owner-hold fact, so the resident-daemon
residual is unchanged.

The daemon path hands the same observation and collection evidence to
`recordDaemonDispatchResult`, which derives the outcome and token through the
shared classifier and truth derivation, builds the same comparison and
corroboration records, and appends exactly one dispatch attempt record through
the same ledger as a one-shot dispatch. A resume or replay of the same attempt
appends no second record. A missing executor runs the declared `supervise-only`
mode with `degraded: ["lane-executor-unavailable"]`. Prefill and resume progress
is never stalled; only a fully corroborated stall applies the delivered
`watchdog.liveness-stalled` classification and restart admission. Admission
consults the delivered restart budget: an admitted restart appends the
`economics.restart` record, while budget exhaustion appends the terminal
exhaustion record and raises a typed question instead of silently failing the
lane. The daemon execution state is distinct from the delivered six-value lanes
projection, which folds daemon evidence without a payload-shape change.

## External effects and commit crash safety

Every effect is intent first, receipt second. `outbox.effect` carries the closed
kind, bounded target, payload digest, idempotency key, optional `callerPrincipal`,
state, attempts, and check strategy. A commit intent additionally carries
`baselineHead`, `changeRef`, `phase`, and the sorted normalized staged path set;
it never carries a message, subject, body, or fingerprint. An identical replay
of one effect intent (same identity, state, and attempts; only the observation
time differs) appends no second `outbox.effect` record, while receipts remain
per-attempt. The dedupe read and the append execute under one fence acquisition,
so concurrent same-key replays cannot both append.

The production `commit` and `phase complete` paths compose the wrapper. They read
HEAD once, compute the sorted normalized staged path set with the same pure
staging computation the act uses over the same scope, and append the intent and
its `in-flight` transition before the commit primitive runs. When an effect was
started, they append a per-attempt receipt and the effect's terminal state after
the act returns. They also supply the DM-18 redrive-evidence reader, which yields
a SHA only from an `attempt: 0` receipt whose effect, change ref, phase, and
recorded baseline match the effect. A dry run starts no effect, and a HEAD read
failure starts no effect.

Recovery performs exactly one bounded `CommitGitPort.logSince(baselineHead)` read
and resolves `already-applied` only when the read yields exactly one new commit
whose normalized changed-path set equals the recorded set. Paths are
repo-relative, `/`-separated, deduplicated, and sorted; a rename contributes both
its delete and add paths. Zero, multiple, mismatch, unreadable, or over-cap stays
`unknown` with no automatic re-apply and no guessed SHA. Daemon detection reuses
the same match rule: a path-set mismatch records `not-found`, while multiple
commits or an unverifiable recorded set records `unreadable`; neither carries a
discovered SHA. The daemon detects and records a DM-18 redrive request
(`attempt: 0`); the owning lane/one-shot process restores the phase binding
through `commit-without-record`, so the phase reads `both`, never `record-only`.
No tracker or VCS write adapter ships.

## Safe-boundary preemption

An active session records a durable pending preemption and is never signalled.
At the next phase boundary or on completion the daemon releases the lease, parks
with `preempted-for-close-item` and condition type `preemption`, and records the
applied preemption naming the close item. No active session releases and parks
immediately. Pending state survives restart and is re-evaluated; the close item
is not scheduled in the same pass. `withdrawn` is a declared read-only state.

## Watch and degradation

`queue --watch` and `lanes --watch` subscribe to the closed topic and print a
bounded snapshot followed by deduplicated bounded events; an interruption exits
0. The resident loop publishes a deduplicated state snapshot for each topic whose
published snapshot changed since the previous tick; an unchanged tick publishes
nothing, and publication never blocks the loop. With no reachable daemon they
enter declared degraded polling at `daemon.watch-poll-interval`, name
`daemon-unreachable`, print only changed snapshots, and exit 0. Mid-stream
overflow drops that subscription to the same polling with a `subscriber-overflow`
marker. Unreadable state exits 2 with a classified identity, never an all-clear.
The CLI stream seam is the single serialization/redaction chokepoint.

## Polling

Each platform declares a base interval, maximum interval, and minimum request
spacing. Failures back off from base to max; success resets to base. Polling uses
only delivered read seams, never performs a write, and never exceeds the
configured rate. A one-shot read carries no resident backoff state.

## Supervisor installation

> **Coordinator consumption (GH-241).** Coordinator supervision consumes the
> delivered `DaemonProcessPort` additively (`SIGKILL`, optional `startTimeMs`) and
> the `SupervisorPort` / `DaemonSupervisorDescriptor` seam. The shipped
> `createNodeProcessPort` implements `startTimeMs(pid)` from the Linux
> `/proc/<pid>/stat` start ticks plus `/proc/stat` `btime`; off Linux, or when
> either file is unreadable, it yields no reading, so identity-verified kill
> returns `identity-mismatch` without signalling and a coordinator cannot claim
> the lease (its own start time is unavailable). The daemon command, control
> surface, unit renderer, and installer carry no coordinator unit;
> `renderSystemdUnit` is hardcoded to `daemon start --foreground`, so a coordinator
> unit needs an additive explicit `command` vector, and coordinator
> `install`/`uninstall` does not exist. `daemon.lock` is the daemon's own
> heartbeat-age instance lock; the coordinator's single-instance ownership is its
> append-only ledger lease and never `daemon.lock`.

The Linux systemd user unit uses `ExecStart=<binary> daemon start --foreground`,
`Type=simple`, `Restart=on-failure`, and
`Environment=<PREFIX>_STATE_DIR=<canonical absolute host root>`, and the socket
path passed to the composed transport is derived from the project state root. The unit
and the secret-free ownership marker are written by the composed platform
supervisor adapter; on Linux the real systemd user adapter is composed by
default. Linger is enabled and reported. A linger failure removes the unit and
returns `daemon.supervisor-unsupported` with platform evidence. Uninstall
removes only what this installation created and disables linger only when it
enabled it.
macOS and Windows return the classified unsupported outcome and write no unit.
Installation is optional; with no unit every one-shot is identical.

## Merge absence

A dependency-boundary rule forbids any daemon path (core app/domain daemon, the
CLI daemon surface, and the adapters daemon subpath) from importing merge
execution. Reachability is a distinct assertion: an injected merge executor makes
the composition compute `mergeCodePath: "present"` without adding an import edge;
the production composition always computes `"absent"`.

## Testing

The enduring coverage map is the [resident daemon test specification](../../quality/test-specs/test-spec-resident-daemon.md).
The daemon-side dispatch composition is covered by the
[dispatch engine test specification](../../quality/test-specs/test-spec-dispatch-engine.md).

## Declared residuals

The dispatch loop, prompt selection, dual-run evidence, per-repo handover, and
session resume are delivered by the dispatch engine ([Dispatch Engine](feature-dispatch-engine.md)).
The dispatch engine composes the lane seam and proves the daemon-path attempt
producer; the production daemon entry that supplies the lane composition remains
resident-daemon production scope (GH-238). launchd and Windows supervisor
adapters, remote/container transports, status-watch, lane-scoped authorization,
and the OQ-5 full session-resume remainder are future work.
