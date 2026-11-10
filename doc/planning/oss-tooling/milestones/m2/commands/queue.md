# queue(1)

Status: Proposed (M2)

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
```

## DESCRIPTION

The `queue` family is registered in the root listing today: M1 delivered
`ready`, `list`, `plan`, `add`, `prioritize`, `dep`, `claim`, and `release`.
M2-S15 completes the lifecycle with three additions - reason-bearing entry
removal, the explicit dependency-edge grammar, and reconciliation - and keeps
the delivered verbs and their meaning.

`release` is the delivered **lease** release. It drops the lane's lease on the
ref; the queue entry stays, and may be parked with `--park <cause>` and
`--until <iso>` (the delivered park causes are `provider-window`,
`provider-quota`, and `preempted-for-close-item`). Release never removes an
entry.

`remove` is the M2 verb that takes an entry **out** of the queue. It requires
`--reason` (`landed`, `abandoned`, `superseded`, or `reconciled`); an
unqualified removal is refused with `queue.reason-missing` at exit 1. After a
squash merge and closeout the ref's entry is removed automatically with reason
`landed`, without manual action.

`queue dep <ref> <on-ref>` is the delivered two-positional add. M2 makes it
explicit as `dep add` and adds `dep remove`; both forms edit one dependency
edge and recompute the ready set, and the two-positional spelling stays valid.
`reconcile` compares stale entries with tracker truth and removes them with
the `reconciled` reason without editing state files by hand. Every mutation publishes a
`queue.graph` event.

Single-flight is enforced across dispatch paths, not only through the queue:
a second dispatch against a ref with an active lane is refused with a
classified error naming the holder.

The family is registered; the removal verb, the `dep add`/`dep remove`
spelling, and `reconcile` are planned for M2-S15. See
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
| `--json` | Emit the machine envelope. |

## OUTPUT

Text: one line per mutation with the ref, the verb, the reason or park cause,
and the resulting ready set.

Envelope `data` carries:

| Key | Contract |
|---|---|
| `mutation` | The applied verb and ref |
| `reason` | The recorded removal reason, or the classified refusal when absent |
| `lease` | For `release`: the released holder, or `none` when no lease was held |
| `park` | For a parked release: the cause and the `until` timestamp |
| `readySet[]` | Refs that became ready from the mutation |
| `event` | The `queue.graph` event kind and sequence |

## EXIT STATUS

| Code | Meaning |
|---|---|
| `0` | The mutation was applied |
| `1` | The request was refused, including a missing removal reason or a single-flight conflict |
| `2` | A platform or state failure prevented the mutation |

## EXAMPLES

```
$ <binary> queue release GH-241 --park provider-window --until 2026-11-11T06:00:00Z
GH-241 lease released (holder lane-1); entry parked: provider-window until 2026-11-11T06:00:00Z
```

```
$ <binary> queue remove GH-241 --reason abandoned --json
{ "ok": true, "command": "queue remove", "data": { "mutation": "remove", "reason": "abandoned", "event": "queue.graph/removed" } }
```

```
$ <binary> queue remove GH-241 --json
{ "ok": false, "command": "queue remove", "error": { "code": "queue.reason-missing", "summary": "removal requires --reason" } }
exit 1
```

## ERRORS

| Error | Meaning | Exit |
|---|---|---|
| `queue.reason-missing` | `remove` was attempted without a reason | 1 |
| `queue.single-flight` | A second dispatch or claim against a ref with an active lane; names the holder | 1 |
| `queue.entry-unknown` | The ref has no queue entry | 1 |
| `queue.state-unavailable` | The queue state cannot be read or written | 2 |

## SEE ALSO

[queue lifecycle mutations](../contracts.md),
[auto-release flow](../architecture.md), [queue v1](../../m1/commands/queue.md)
