# board(1)

Status: Delivered M1-S5 (GH-229); the full board is planned in M2-S4.
Proposed contract scoped to the M2-S4 remainder.

## NAME

`board` - the owner-gate SLA surface: aging, escalation, defaults.

## SYNOPSIS

```
<binary> board [--watch] [--json]
```

## DESCRIPTION

Owner gates age under the SLA: 24 h stale-review escalation, 72 h
default-on-expiry with one pre-agreed default per gate; silence is
impossible. The full fleet grid (lanes, gates, owner asks, parked work
on one screen) arrives in M2-S4 sharing this state source.

## OUTPUT

Text: aging grid. Envelope `data`: `gates[]` (id, kind, ref, age,
slaState (fresh, escalated, default-applied), default, waived by).

## EXIT STATUS

0 rendered; 2 collectors unavailable (declared).

## EXAMPLES

```
$ <binary> board --json
{
  "schemaVersion": 1,
  "runId": "r_01J8ZV4B9G",
  "exitCode": 0,
  "timing": { "started": "2026-11-18T08:05:00Z", "durationMs": 410 },
  "data": {
    "gates": [
      { "id": "G-7", "kind": "owner-review", "ref": "GH-303",
        "age": "26h", "slaState": "escalated", "default": null },
      { "id": "W-12", "kind": "waiver", "ref": "GH-299",
        "age": "2d", "slaState": "default-applied",
        "default": "owner-review-first", "waivedBy": "owner" }
    ]
  }
}
```

## ERRORS

`status.collector.<id>.unavailable` (declared, never silent).

## SEE ALSO

[brief.md](brief.md), [status.md](status.md), [blockers.md](blockers.md)
