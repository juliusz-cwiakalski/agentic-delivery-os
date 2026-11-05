# lanes(1)

Status: M1 planned (M1-S17). Proposed contract.

## NAME

`lanes` - the lane plan view: what is delivering, what is idle and why.

## SYNOPSIS

```
<binary> lanes [list | show <lane>] [--watch] [--json]
```

## DESCRIPTION

Read view over lanes: state (delivering, idle-with-reason, parked,
merge-ready, in-review, failed), lease scope and holder, restart
counters, resume-amplification signal. `--watch` subscribes to bounded
lane events (NDJSON frames; line-delimited always).

## OUTPUT

Text: one line per lane with state and reason. Envelope `data`:
`lanes[]` (id, ref, state, reason, lease, restarts, amplification,
weightClass).

## EXIT STATUS

0 read; 2 collection impossible.

## EXAMPLES

```
$ <binary> lanes list --json
{
  "schemaVersion": 1,
  "runId": "r_01J8ZS7T3X",
  "exitCode": 0,
  "timing": { "started": "2026-11-18T09:10:00Z", "durationMs": 95 },
  "data": {
    "lanes": [
      { "id": "L1", "ref": "GH-301", "state": "delivering", "reason": null,
        "lease": "repo-alpha", "restarts": 0, "amplification": 1.0, "weightClass": "standard" },
      { "id": "L3", "ref": "GH-304", "state": "parked", "reason": "provider window ends 10:30Z",
        "lease": null, "restarts": 1, "amplification": 1.02, "weightClass": "standard" }
    ]
  }
}
```

## ERRORS

`status.collector.lanes.unavailable` (declared, never silent zero).

## SEE ALSO

[queue.md](queue.md), [daemon.md](daemon.md), [spend.md](spend.md)
