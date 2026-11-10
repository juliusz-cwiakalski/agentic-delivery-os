# queue(1)

Status: Proposed (M2)

## NAME

`queue` - the lifecycle verbs that complete queue hygiene.

## SYNOPSIS

```
<binary> queue release <ref> --reason <landed|abandoned|superseded|reconciled> [--json]
<binary> queue remove <ref> --reason <landed|abandoned|superseded|reconciled> [--json]
<binary> queue dep add <ref> <depends-on> [--json]
<binary> queue dep remove <ref> <depends-on> [--json]
<binary> queue reconcile [--ref <ref>] [--json]
```

## DESCRIPTION

The lifecycle completion of the M1 queue. Entries leave the queue when their
work lands or is abandoned, dependencies are managed explicitly, and one ref
cannot run twice at once regardless of entry path.

`release` returns an entry to the queue's hold set with a reason; `remove`
takes it out of the queue entirely with a reason. Both require a reason, and
an unqualified removal is refused. `dep add` and `dep remove` edit dependency
edges and recompute the ready set. `reconcile` compares stale entries with
tracker truth and releases or removes them without editing state files by
hand. Every mutation publishes a `queue.graph` event.

Single-flight is enforced across dispatch paths, not only through the queue:
a second dispatch against a ref with an active lane is refused with a
classified error naming the holder.

This surface is proposed for M2-S15 and is not yet registered at the root
listing; see [../entrypoint-delta.md](../entrypoint-delta.md). The contract is
[../contracts.md](../contracts.md).

## OPTIONS

| Option | Meaning |
|---|---|
| `--reason <reason>` | Required for `release` and `remove`: `landed`, `abandoned`, `superseded`, or `reconciled`. |
| `--ref <ref>` | Scope `reconcile` to one ref. |
| `--json` | Emit the machine envelope. |

## OUTPUT

Text: one line per mutation with the ref, the verb, the reason, and the
resulting ready set.

Envelope `data` carries:

| Key | Contract |
|---|---|
| `mutation` | The applied verb and ref |
| `reason` | The recorded reason, or the classified refusal when absent |
| `readySet[]` | Refs that became ready from the mutation |
| `event` | The `queue.graph` event kind and sequence |

## EXIT STATUS

| Code | Meaning |
|---|---|
| `0` | The mutation was applied |
| `1` | The request was refused, including a missing reason or a single-flight conflict |
| `2` | A platform or state failure prevented the mutation |

## EXAMPLES

```
$ <binary> queue release GH-241 --reason landed
GH-241 released (landed); ready: GH-243
```

```
$ <binary> queue remove GH-241 --json
{ "ok": true, "command": "queue remove", "data": { "mutation": "remove", "reason": "abandoned", "event": "queue.graph/removed" } }
```

## ERRORS

| Error | Meaning | Exit |
|---|---|---|
| `queue.reason-missing` | `release` or `remove` was attempted without a reason | 1 |
| `queue.single-flight` | A second dispatch or claim against a ref with an active lane; names the holder | 1 |
| `queue.entry-unknown` | The ref has no queue entry | 1 |
| `queue.state-unavailable` | The queue state cannot be read or written | 2 |

## SEE ALSO

[queue lifecycle mutations](../contracts.md),
[auto-release flow](../architecture.md), [queue v1](../../m1/commands/queue.md)
