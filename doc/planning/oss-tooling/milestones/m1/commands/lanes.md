# lanes(1)

Status: shipped by GH-237 (M1-S17). `--watch` is refused in this release;
live streaming belongs to the resident daemon (M1-S18).

## NAME

`lanes` - the lane plan view: what is delivering, what is idle and why.

## SYNOPSIS

```
<binary> lanes list|show <ref> [--json]
```

`--watch` is refused in this release: it is not in the accepted grammar, the
invocation fails at exit 1 through `fallback.invocation`, the remediation hint
names the resident daemon (M1-S18), and no stream or frame is emitted.

## DESCRIPTION

Read view over lanes: state (delivering, idle-with-reason, parked,
merge-ready, in-review, failed), lease scope and holder, restart
counters, resume-amplification signal. `--watch` is refused in this
release; live streaming belongs to the resident daemon (M1-S18).

## OUTPUT

Text: one line per lane with state and reason. Envelope `data` (schema
`delivery.lanes.v1`): `lanes[]` (`id`, `ref`, `state`, `reason`, `lease`,
`leaseScope`, `restarts`, `amplification`, `amplificationWarning`,
`weightClass`), `findings[]`, `degraded[]`, `truncated`, `counts`.

## EXIT STATUS

0 read or observed-empty; 1 invocation refusal (including `--watch`) or an
unobserved ref from `show`; 2 collection impossible.

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

`--watch` refused:

```
$ <binary> lanes list --watch --json
{
  "schemaVersion": "delivery.result.v1",
  "runId": "run-lanes-example",
  "exitCode": 1,
  "timing": { "totalMs": 10 },
  "error": {
    "code": "fallback.invocation",
    "category": "user",
    "retryable": false,
    "consequence": "unknown",
    "remediationHint": "Check the command name and arguments, then retry the invocation.",
    "summary": "The invocation could not be understood."
  }
}
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

`--watch` is **refused** in this release. The flag is not in the accepted
grammar; the invocation fails at exit 1 through `fallback.invocation` and no
stream or frame is emitted. Live streaming belongs to the resident daemon
(M1-S18).
