# daemon(1)

Status: Mounted. The daemon engine and control protocol are delivered
(M1-S18, GH-238) and the lifecycle command is prompt-required at the production
entrypoint (GH-286), so `daemon` is reachable from the shipped program.
Scenarios SC-M1-14..18 and SC-M1-20; full protocol in
[../architecture.md](../architecture.md).

## NAME

`daemon` - the resident dispatch daemon: start, stop, status, install,
uninstall.

## SYNOPSIS

```
<binary> daemon start [--foreground]
<binary> daemon stop [--mode drain|immediate]
<binary> daemon status [--live]
<binary> daemon install | uninstall
```

## DESCRIPTION

Single-instance (fence-token lock with staleness takeover), crash-safe
(state-layer-only truth; startup reconciliation classifies in-flight lanes alive,
interrupted, or crashed and resumes from the ledger), never a lane, never fires
merges. Degrades to CLI one-shots when absent. `install` registers an optional
user-level systemd unit with linger on Linux; launchd and Windows return the
classified `daemon.supervisor-unsupported` outcome. Control protocol v1 is
NDJSON over a transport-selected stream (`unix` default, `stdio` for the
conformance proof), with poke, query, subscribe, and control interaction
classes, connection per invocation, and filesystem same-user authorization.

The state-directory scope is selected process-wide by the brand-derived
`<PREFIX>_STATE_DIR` environment variable when set and otherwise by
`<home>/<brand.stateDirectoryName>`; there is no `--state-dir` flag and no
state-directory configuration key. The production composition resolves the same
scope for the daemon store, the daemon lock, the daemon settings, the control
socket, the supervisor scope, and the re-entry binding, so the ledger, the lock,
and the socket never disagree. With no override and no home the directory is
unresolvable: the family stays mounted and every subcommand returns the
delivered `config.value.invalid` identity at exit `1` instead of addressing a
root-level path.

A bare `start` re-enters the running entry path as `daemon start --foreground`
with the declared re-entry environment (the state-directory binding written
last, plus the composing `PATH`, its home, and a set working-name override). A
`--foreground` start owns its lifetime through the injected signal host:
`SIGTERM` drains, releases the lock, and detaches delivering lanes; `SIGINT`
stops immediately; both listeners are removed before the invocation returns.
Cross-process `stop` addresses only a recorded positive pid and refuses anything
else as `daemon.state-recovery-failed`. Queue and lanes degradation is derived
from durable state (an owned instance with a heartbeat strictly inside the
configured staleness bound), not from a hardcoded marker.

## OUTPUT

Text: a bounded `key=value` summary and lane lines. Envelope `data`:

- `start` — `instance` (`instanceId`, `pid`, `scope`, `acquiredAt`, `mode`),
  `reconciliation` (`queue` counts, `lanes[]` with `ref`, `classification`,
  `action`, `restarts`, `reason?`, `duplicates`, `questions[]`, `truncated`),
  `socket` (`path`, `transport`, `reachable`), `heartbeat` (`intervalMs`,
  `ageMs`), `supervisor` (`kind`, `installed`, `unit`, `scope`, `linger`,
  `commandForm`, `serviceType`, `restartPolicy`), `degraded[]`.
- `stop` — `result` (`stopped`, `draining`, `noop`), `instance`, `detachedLanes[]`,
  `degraded[]`.
- `status` — `instance` or `null`, `uptimeMs`, `queueDepth`, `lanes[]`,
  `restarts[]` (`ref`, `count`, `reason`, `classified`), `heartbeat` (`ageMs`,
  `intervalMs`, `state`: `running` | `stale` | `stopped`), `socket` (`path`,
  `transport`, `reachable`), `supervisor`, `reconciliation` or `null`,
  `mergeCodePath` from `{"absent", "present"}` (production computes
  `"absent"`), `degraded[]`, and `truncated`/`truncationReason` when a bound
  drops rows.
- `install`/`uninstall` — `result` (`installed` | `noop`, `uninstalled` |
  `noop`), `supervisor`, `degraded[]`.

The command envelopes never carry the daemon lock token. The lock token is
permitted only in the three control-frame payloads (`drain`, `stop`, `takeover`)
and durable lock and instance records.

## EXIT STATUS

0 started, stopped/draining/noop, plain status (including a declared stale or
stopped state), an installed/removed unit, and a successful one-shot mutation;
1 `daemon.already-running`, `daemon.takeover-refused`,
`daemon.protocol.unsupported`, an invocation rejection, a socket path outside
the state directory, and a cross-user connection refused as
`state.permission.denied`; 2 `daemon.socket-unreachable` or
`daemon.heartbeat-stale` on `status --live`, `daemon.state-recovery-failed`,
`daemon.supervisor-unsupported`, `daemon.subscriber-degraded`, and the delivered
`state.*` family.

## EXAMPLES

Startup reconciliation after a host restart (SC-M1-16):

```
$ <binary> daemon start --json
{
  "schemaVersion": 1,
  "runId": "r_01J8ZV9F3J",
  "exitCode": 0,
  "timing": { "started": "2026-11-18T07:00:02Z", "durationMs": 940 },
  "data": {
    "instance": {
      "instanceId": "instance-01J8ZV9F3J",
      "pid": 22810,
      "scope": "9f1c0a2b3d4e5f60",
      "acquiredAt": "2026-11-18T07:00:02Z",
      "mode": "resident"
    },
    "reconciliation": {
      "queue": { "entries": 7, "edges": 2, "parks": 1 },
      "lanes": [
        { "ref": "GH-311", "classification": "alive", "action": "reattach", "restarts": 0 },
        { "ref": "GH-312", "classification": "interrupted", "action": "resume", "restarts": 1 },
        { "ref": "GH-315", "classification": "crashed", "action": "terminal-failed", "restarts": 3, "reason": "restart-budget-exhausted" }
      ],
      "duplicates": 0,
      "questions": ["daemon-restart-GH-315"],
      "truncated": false
    },
    "socket": { "path": "<state-dir>/daemon.sock", "transport": "unix", "reachable": true },
    "heartbeat": { "intervalMs": 5000, "ageMs": 0 },
    "degraded": []
  }
}
```

## ERRORS

`daemon.already-running`, `daemon.takeover-refused`, `daemon.heartbeat-stale`,
`daemon.state-recovery-failed`, `daemon.protocol.unsupported`,
`daemon.socket-unreachable`, `daemon.subscriber-degraded`, and
`daemon.supervisor-unsupported`.

## HELP

```
<binary> daemon --help
<binary> daemon start --help
<binary> daemon stop --help
<binary> daemon status --help
<binary> daemon install --help
<binary> daemon uninstall --help
<binary> --help
<binary> --version
```

Every invocation above prints its declared help page at exit `0` and performs no
state, configuration, filesystem, git, or network read. The family appears in
root `--help` through the delivered family derivation, and `--version` reports
the binary identity.

## SEE ALSO

[queue.md](queue.md), [lanes.md](lanes.md), [dispatch.md](dispatch.md),
[watchdog.md](watchdog.md)
