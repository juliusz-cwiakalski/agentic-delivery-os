# queue(1)

Status: Delivered (GH-292, M2-S15). The lifecycle verbs below are current
truth; the S18 additions keep their planned markers.

## NAME

`queue` - the M2 lifecycle completion: reason-bearing entry removal, explicit
dependency edges, and reconciliation, on top of the delivered lease release.

## SYNOPSIS

```
<binary> queue release <ref> [--holder <id>] [--park <provider-window|provider-quota|preempted-for-close-item>] [--until <iso>] [--json]
<binary> queue remove <ref> --reason <landed|abandoned|superseded|reconciled> [--json]
<binary> queue dep <ref> <on-ref> [--json]
<binary> queue dep add <ref> <on-ref> [--json]
<binary> queue dep remove <ref> <on-ref> [--json]
<binary> queue reconcile [--ref <ref>] [--json]
<binary> queue list --project <groupKey> [--json]
```

## DESCRIPTION

The `queue` family is registered in the root listing: M1 delivered
`ready`, `list`, `plan`, `add`, `prioritize`, `dep`, `claim`, and `release`.
M2-S15 (GH-292) completed the lifecycle with three delivered additions -
reason-bearing entry removal, the explicit dependency-edge grammar, and
reconciliation - and keeps the delivered verbs and their meaning.

`release` is the delivered **lease** release. It drops the lane's lease on the
ref; the queue entry stays, and may be parked with `--park <cause>` and
`--until <iso>` (the delivered park causes are `provider-window`,
`provider-quota`, and `preempted-for-close-item`). Release never removes an
entry and takes no removal reason.

`remove` is the delivered verb that takes an entry **out** of the queue. It
requires `--reason` (`landed`, `abandoned`, `superseded`, or `reconciled`);
an unqualified removal is refused with `queue.reason-missing` at exit 1 and
nothing is appended. Removal is append-only: one `queue.removal` record
carries the ref, the reason, `recordedAt`, and the caller principal; the
entry is present iff its latest `queue.entry` append is later than its
latest `queue.removal` append in ledger position, so a removed entry leaves
every read without any record being deleted and a later re-declaration
restores it. After a squash merge and closeout the ref's entry is removed
automatically with reason `landed`, without manual action.

`queue dep <ref> <on-ref>` is the delivered two-positional add. M2-S15 made
it explicit as `dep add` and added `dep remove`; both forms edit one
dependency edge and recompute the ready set, and the two-positional spelling
stays valid with an identical payload. `reconcile` compares queue entries
with tracker truth and removes the stale ones (`deliveryState` `done` or
`canceled`) with the `reconciled` reason without editing state files by
hand. Every applied mutation publishes a `queue.graph` event; a refused
mutation and a `noop` publish nothing.

Single-flight is a per-ref admission policy across dispatch paths, not only
through the queue: the dispatch family (`dispatch run`, composed daemon
supervision claim) refuses any live same-ref lease - same or different
holder - with `queue.single-flight`, naming the holder at the envelope root
(`detail.holder`); `queue claim` renews the caller's own holder's same-ref
lease and refuses another holder's same-ref lease with the same identity; a
live lease on any other ref refuses the delivered `queue.lease-conflict`. A
stale lease (heartbeat age at or over the TTL) is not active and keeps the
delivered takeover. This is distinct from the scheduling engine's per-pass
single-flight (one action per repository per pass), which is unchanged.

The family is registered; the removal verb, the `dep add`/`dep remove`
spelling, and `reconcile` are delivered by GH-292 (M2-S15). See
[../entrypoint-delta.md](../entrypoint-delta.md) and the contract in
[../contracts.md](../contracts.md).

## OPTIONS

| Option | Meaning |
|---|---|
| `--holder <id>` | On `release`: the lane whose lease is released; omitted, the caller's lane is used. |
| `--park <cause>` | On `release`: park the entry with a delivered park cause (`provider-window`, `provider-quota`, `preempted-for-close-item`); S17 adds `peak-window` and `owner-hold` — see [../contracts.md](../contracts.md). |
| `--until <iso>` | On `release`: the timestamp at which the park condition is expected to clear. |
| `--reason <reason>` | Required on `remove`: `landed`, `abandoned`, `superseded`, or `reconciled`. |
| `--ref <ref>` | Scope `reconcile` to one ref. |
| `--project <groupKey>` | S18 planned on `list`: scope the read to one configured group. |
| `--json` | Emit the machine envelope. |

## OUTPUT

Text: one line per mutation with the ref, the verb, the reason or park cause,
and the resulting ready set.

Envelope `data` is per verb (additive payloads under the delivered
`delivery.result.v1` envelope; no new top-level keys):

| Verb | `data` keys |
|---|---|
| `remove` | `ref`, `result` (`removed`), `reason`, `readySet[]`, `event` (`queue.graph` topic, `remove` kind), `degraded[]` |
| `dep add` (either spelling) | the delivered mutation payload (`ref`, `entry`, `edges[]`, `result` `added`/`updated`/`noop`, `degraded[]`) |
| `dep remove` | the delivered mutation keys plus `readySet[]` and `event` (`dependency-edge` kind); an absent edge is `noop` at exit 0 |
| `reconcile` | `result` (`removed`/`noop`), `checked`, `removed[]`, `retained[]` (with observed `deliveryState`), `unobserved[]`, `readySet[]`, `truncated`, `remainder`, `degraded[]` |
| `release` | `result` (`released`/`parked`/`noop`), `lease`, optional `park`, `degraded[]` |

`event` names a topic and kind, never a sequence. The removal's event is
spelled `queue.graph/remove` — kind `remove`, never `removed` — with exactly
the payload fields `ref`, `reason`, and `recordedAt` in the removed entry's
lane. Reconcile examines at most 100 entries with one bounded tracker read
per examined entry and reports `truncated` with the exact `remainder` beyond
the cap; `--ref` examines exactly one entry.

## EXIT STATUS

| Code | Meaning |
|---|---|
| `0` | The mutation was applied, or reported no work (`noop` / `satisfied`) |
| `1` | The request was refused, including a missing removal reason or a single-flight conflict |
| `2` | A platform, state, or provider failure prevented the mutation |

## EXAMPLES

```
$ <binary> queue release GH-241 --park provider-window --until 2026-11-11T06:00:00Z
GH-241 lease released (holder lane-1); entry parked: provider-window until 2026-11-11T06:00:00Z
```

```
$ <binary> queue remove GH-241 --reason abandoned --json
{
  "schemaVersion": "delivery.result.v1",
  "runId": "run-queue-example",
  "exitCode": 0,
  "timing": { "totalMs": 10 },
  "data": {
    "ref": "GH-241",
    "result": "removed",
    "reason": "abandoned",
    "readySet": [],
    "event": { "topic": "queue.graph", "kind": "remove" },
    "degraded": []
  }
}
```

A removal without `--reason` is refused and appends nothing:

```
$ <binary> queue remove GH-241 --json
{
  "schemaVersion": "delivery.result.v1",
  "runId": "run-queue-example",
  "exitCode": 1,
  "timing": { "totalMs": 10 },
  "error": {
    "code": "queue.reason-missing",
    "category": "user",
    "retryable": false,
    "consequence": "not_landed",
    "remediationHint": "Supply `--reason` with one of the declared values (landed, abandoned, superseded, reconciled) and retry; nothing was appended.",
    "summary": "A queue removal requires a declared reason."
  }
}
```

A second dispatch against a ref with an active lane names the holder at the
envelope root and creates no session, lease record, attempt, or event:

```
$ <binary> queue claim GH-241 --holder lane-2 --json
{
  "schemaVersion": "delivery.result.v1",
  "runId": "run-queue-example",
  "exitCode": 1,
  "timing": { "totalMs": 10 },
  "detail": { "holder": "lane-1" },
  "error": {
    "code": "queue.single-flight",
    "category": "transient",
    "retryable": true,
    "consequence": "not_landed",
    "remediationHint": "Wait for the named holder's lane to end, then retry; no session, lease record, attempt, or event was created.",
    "summary": "The requested ref already has an active lane."
  }
}
```

A reconcile over tracker truth (bounded at 100 examined entries):

```
$ <binary> queue reconcile --json
{
  "schemaVersion": "delivery.result.v1",
  "runId": "run-queue-example",
  "exitCode": 0,
  "timing": { "totalMs": 10 },
  "data": {
    "result": "removed",
    "checked": 2,
    "removed": ["GH-241"],
    "retained": [{ "ref": "GH-242", "deliveryState": "in-progress" }],
    "unobserved": [],
    "readySet": [],
    "truncated": false,
    "remainder": 0,
    "degraded": []
  }
}
```

## ERRORS

| Error | Meaning | Exit |
|---|---|---|
| `queue.reason-missing` | `remove` was attempted without `--reason` | 1 |
| `queue.single-flight` | A second dispatch, or a claim under another holder, against a ref with an active lane; names the holder at the envelope root (`detail.holder`) | 1 |
| `queue.entry.unobserved` | The ref has no queue entry (absent, or already removed) | 1 |
| `queue.precondition.unmet` | A removal or claim blocked by a precondition (`lease-held`, owner hold); names the holder, appends nothing | 1 |
| `queue.lease-conflict` | A claim for another ref while a live lease is held in one repository; the lease's recorded ref is unchanged | 1 |
| `input.value.rejected` | An out-of-vocabulary `--reason` value, a non-canonical ref, or a malformed grammar token | 1 |
| `provider.auth.rejected` | Reconcile: the tracker credential was rejected | 1 |
| `provider.outage`, `provider.quota.exceeded` | Reconcile: the tracker is unreadable or quota-exhausted; nothing is appended and nothing is removed | 2 |
| delivered `state.*` rows | The queue state cannot be read or written | 2 |

Automatic removal never fails closeout: the `queueRemoval` block reports
`removed`, `would-remove` (plan mode), `satisfied` (re-run or never-entered
ref, exit 0), or `skipped` with one of `no-merge-truth`, `lease-held`,
`state-unavailable`, `ref-not-canonical`, and the hook never changes a step
outcome or closeout's exit code.

## SEE ALSO

[queue lifecycle mutations](../contracts.md),
[auto-release flow](../architecture.md), [queue v1](../../m1/commands/queue.md)
