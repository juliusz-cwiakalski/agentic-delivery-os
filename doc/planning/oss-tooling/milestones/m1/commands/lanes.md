# lanes(1)

Status: shipped by GH-237 (M1-S17); `--watch` is accepted by GH-238 (M1-S18).

## NAME

`lanes` - the lane plan view: what is delivering, what is idle and why.

## SYNOPSIS

```
<binary> lanes list|show <ref> [--json]
```

`--watch` is accepted: with a reachable daemon the invocation subscribes to the
closed `lanes` topic, prints one bounded initial snapshot, then one deduplicated
bounded event frame per line, and exits 0 on interruption. With no reachable
daemon it enters declared degraded polling at `daemon.watch-poll-interval`,
names `daemon-unreachable`, prints only changed snapshots, and exits 0; unreadable
state exits 2 with the delivered `state.*` identity.

## DESCRIPTION

Read view over lanes: state (delivering, idle-with-reason, parked,
merge-ready, in-review, failed), lease scope and holder, restart
counters, resume-amplification signal. `--watch` streams bounded daemon
frames when the daemon is reachable and declares degraded bounded polling
when it is not.

## OUTPUT

Text: one line per lane with state and reason. Envelope `data` (schema
`delivery.lanes.v1`): `lanes[]` (`id`, `ref`, `state`, `reason`, `lease`,
`leaseScope`, `restarts`, `amplification`, `amplificationWarning`,
`weightClass`), `findings[]`, `degraded[]`, `truncated`, `counts`.

## EXIT STATUS

0 read, observed-empty, or an interrupted watch; 1 invocation refusal or an
unobserved ref from `show`; 2 collection impossible or unreadable state on a
watch.

## EXAMPLES

```
$ <binary> lanes list --json
{
  "schemaVersion": "delivery.result.v1",
  "runId": "run-lanes-example",
  "exitCode": 0,
  "timing": { "totalMs": 10 },
  "data": {
    "schemaVersion": "delivery.lanes.v1",
    "lanes": [
      {
        "id": "GH-320", "ref": "GH-320", "state": "delivering",
        "lease": "lease-GH-320", "leaseScope": "repo-exclusive",
        "restarts": 1, "amplification": 2, "weightClass": "standard"
      },
      {
        "id": "GH-321", "ref": "GH-321", "state": "parked",
        "reason": "parked:provider-quota",
        "restarts": null, "amplification": null,
        "amplificationWarning": "economics-underivable",
        "weightClass": "standard"
      }
    ],
    "findings": [],
    "degraded": ["daemon-unreachable"],
    "truncated": false,
    "counts": { "lanes": 2, "delivering": 1, "idle": 0, "parked": 1, "failed": 0 }
  }
}
```

`--watch` with no reachable daemon (declared degraded polling, exit 0):

```
$ <binary> lanes list --watch --json
{
  "schemaVersion": "delivery.result.v1",
  "runId": "run-lanes-example",
  "exitCode": 0,
  "timing": { "totalMs": 10 },
  "data": { "watch": true, "topic": "lanes" }
}
{"kind":"event","type":"frame","topic":"lanes","cursor":0,"degraded":["daemon-unreachable"],"data":{"lanes":1}}
{"kind":"event","type":"frame","topic":"lanes","cursor":1,"degraded":["daemon-unreachable"],"data":{"lanes":2}}
```

## ERRORS

`status.collector.lanes.unavailable` (declared, never a silent zero) and
`queue.entry.unobserved` for `lanes show <ref>`.

## SEE ALSO

[queue.md](queue.md), [spend.md](spend.md),
[scheduling engine specification](../../../../../spec/features/feature-scheduling-engine.md)

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

`--watch` is accepted as an additive flag (GH-238). With a reachable daemon the
invocation subscribes to the closed `lanes` topic and streams bounded event
frames; with none it enters declared degraded polling at
`daemon.watch-poll-interval`, names `daemon-unreachable`, prints only changed
snapshots, and exits 0 on interruption. Live streaming is the resident daemon's
surface, and an absent daemon is always declared, never hidden.

## HELP

`<binary> lanes --help` prints usage, options, at least one example, exit codes,
and a see-also pointer. Root `<binary> --help` and `<binary> --version` are
self-description only: zero state, network, git, or configuration reads and
zero writes. The executable is a non-installed Bun bin; see the
[man page](../man-page.md).
