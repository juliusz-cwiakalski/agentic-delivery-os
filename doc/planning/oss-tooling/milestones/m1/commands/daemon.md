# daemon(1)

Status: M1 planned (M1-S18). Proposed contract; scenarios SC-M1-15..18,
SC-M1-20; full protocol in [../architecture.md](../architecture.md).

## NAME

`daemon` - the resident dispatch daemon: start, stop, status, install.

## SYNOPSIS

```
<binary> daemon start [--foreground]
<binary> daemon stop [--mode drain|immediate]
<binary> daemon status [--live]
<binary> daemon install | uninstall
```

## DESCRIPTION

Single-instance (fence-token lock with staleness takeover), crash-safe
(state-layer-only truth; startup reconciliation classifies in-flight
lanes alive, interrupted, or crashed and resumes from the ledger),
never a lane, never fires merges. Degrades to CLI one-shots when absent.
`install` registers a user-level auto-start unit (systemd user unit
with linger, launchd, Windows equivalent) scoped to the state dir.
Control protocol v1: NDJSON frames; poke, query, subscribe, control;
connection per invocation; filesystem authorization.

## OUTPUT

Text: instance line and lane table; startup reconciliation report.
Envelope `data`: `instance` (pid, uptime, fence), `queueDepth`, `lanes[]`,
`restarts[]` (reason, classified), `heartbeat` (ageMs), `socket`
(path, reachable), `mergeCodePath` ("absent").

## EXIT STATUS

0 running or installed; 1 already running, refused takeover, or
install precondition failed (classified); 2 daemon unreachable for
`status --live` (degraded hint, or exit 0 with declared degraded for
plain status).

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
    "instance": { "pid": 22810, "fence": "t-94" },
    "reconciliation": {
      "queue": { "entries": 7, "edges": 2, "parks": 1 },
      "lanes": [
        { "id": "L1", "ref": "GH-311", "classification": "alive", "action": "reattached" },
        { "id": "L2", "ref": "GH-312", "classification": "interrupted",
          "action": "resume from phase 8, completed phases skipped", "restarts": "1/3" },
        { "id": "L5", "ref": "GH-315", "classification": "crashed",
          "action": "budget exhausted 3/3 -> failed terminal, question q-9042 raised" }
      ],
      "duplicates": 0
    }
  }
}
```

## ERRORS

`daemon.already-running`, `daemon.heartbeat-stale`,
`daemon.state-recovery-failed`, `daemon.protocol.unsupported`,
`daemon.subscriber-degraded`.

## SEE ALSO

[queue.md](queue.md), [dispatch.md](dispatch.md), [watchdog.md](watchdog.md)
