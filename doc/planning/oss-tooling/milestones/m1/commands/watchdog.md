# watchdog(1)

Status: Delivered M1-S1 (GH-221); M1-S15 adds progress signals; the
supervision battery is planned in M2-S2.
The watchdog command is not mounted at the production entrypoint.
Proposed contract scoped to the M2-S2 remainder; scenario SC-M1-14.

## NAME

`watchdog` - liveness checks: preflight, teardown, liveness probes.

## SYNOPSIS

```
<binary> watchdog preflight <lane>
<binary> watchdog teardown <lane>
<binary> watchdog liveness <lane>
```

## DESCRIPTION

Checks, not a runner: preflight refuses non-base or dirty checkouts;
teardown restores on every exit; liveness evaluates progress signals
(heartbeat, session traffic, token delta; CPU never the only signal) so
a prefilling or resuming session never reads as stalled. The daemon
consumes the same probes for its lanes.

## OUTPUT

Text: verdict lines with evidence. Envelope `data`: `verdict` (ok,
refused, stalled, progressing), `signals` (heartbeatAgeMs, tokenDelta,
traffic), `evidence`.

## EXIT STATUS

0 ok or progressing; 1 refused or stalled (evidence named); 2 probe
unavailable (classified).

## EXAMPLES

```
$ <binary> watchdog liveness L1 --json
{
  "schemaVersion": 1,
  "runId": "r_01J8ZW2H5K",
  "exitCode": 0,
  "timing": { "started": "2026-11-18T10:15:00Z", "durationMs": 60 },
  "data": {
    "verdict": "progressing",
    "signals": { "heartbeatAgeMs": 1200, "tokenDelta": 41000, "traffic": "active" },
    "evidence": "large session resuming; prefill in progress; no stall"
  }
}
```

## ERRORS

`watchdog.checkout-dirty`, `watchdog.checkout-non-base`,
`watchdog.signals-absent` (unknown, never guessed).

## SEE ALSO

[daemon.md](daemon.md), [doctor.md](doctor.md)
