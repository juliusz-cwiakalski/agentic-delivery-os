# lanes(1)

Status: shipped by GH-237 (M1-S17). `--watch` is refused in this release;
live streaming belongs to the resident daemon (M1-S18).

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

## Shipped contract (GH-237)

`lanes list` and `lanes show <ref>` fold queue entries, leases, parks, and the
economics view. Lane identity is the canonical work-item ref. The closed state
set is `delivering`, `idle-with-reason`, `parked`, `merge-ready`, `in-review`,
`failed`; an idle reason is a declared token, and a parked reason is
`parked:<cause>` over the closed cause set. Each lane carries its lease holder
and scope when held, `restarts` and `amplification` from the delivered economics
fold (`null` plus a warning when underivable), and its weight class.

Machine envelope: `lanes[]`, `findings[]`, `degraded[]`, `truncated`, `counts`.
An empty queue is an explicit observed-empty with counts. `show` returns one
lane or `queue.entry.unobserved` at exit 1. An unreadable queue store projects
`status.collector.lanes.unavailable` at exit 2, never a zero-lane view.

`--watch` is **refused** in this release. The flag is not in the accepted
grammar; the invocation fails at exit 1 through `fallback.invocation` and no
stream or frame is emitted. Live streaming belongs to the resident daemon
(M1-S18).
