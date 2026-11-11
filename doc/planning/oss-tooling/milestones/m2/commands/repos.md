# repos(1)

Status: Proposed (M2)

## NAME

`repos` - the flat enumeration of delivery-managed checkouts on the host.

## SYNOPSIS

```
<binary> repos list [--json]
```

## DESCRIPTION

Read-only host enumeration. Each managed checkout is identified by its
checkout identity (the git common dir marker), and its state lives under a
per-repository root, so two checkouts of different repositories never share
phase state, queue entries, or lane leases - even when both use the same ref.

`repos list` reports one row per checkout: the repo key, the checkout root,
the state location, the daemon reachability, and the handover state. No manual
registry is required; the host index is discovered from the checkouts.

This is the flat enumeration contract, previously documented as `projects list`
and now owned by the amended M2-S11. The rename note is recorded here so a
reader of the older page finds the boundary in one place: `repos` enumerates
managed checkouts, and the group surface belongs to `projects`.

This surface is proposed for M2-S11 and is not yet registered at the root
listing. See [../entrypoint-delta.md](../entrypoint-delta.md) for the root
listing delta and [../contracts.md](../contracts.md) for `repos.v1`.

## OPTIONS

| Option | Meaning |
|---|---|
| `list` | Enumerate managed checkouts. The only verb in this contract. |
| `--json` | Emit the machine envelope instead of the human table. |

## OUTPUT

Text: a deterministic table with one row per checkout and the columns `key`,
`root`, `state`, `daemon`, `handover`, sorted by repo key.

Envelope `data` carries:

| Key | Contract |
|---|---|
| `repos[]` | One entry per managed checkout |
| `repos[].repoKey` | Stable repo key derived from the checkout identity |
| `repos[].root` | Absolute checkout root |
| `repos[].stateLocation` | Per-repository state location |
| `repos[].daemonReachable` | Daemon reachability, plus a degradation reason when false |
| `repos[].handoverState` | `engine`, `shell`, or `in-transition` |
| `hostIndexRevision` | Revision of the host-level index that produced the list |

## EXIT STATUS

| Code | Meaning |
|---|---|
| `0` | The checkout list was produced |
| `1` | The request was refused, for example an unknown verb |
| `2` | A platform or state failure prevented discovery |

## EXAMPLES

```
$ <binary> repos list
KEY            ROOT                     STATE                   DAEMON       HANDOVER
delivery-a     /work/delivery-a         /work/delivery-a/.state reachable    engine
delivery-b     /work/delivery-b         /work/delivery-b/.state unreachable  shell
```

```
$ <binary> repos list --json
{
  "ok": true,
  "command": "repos list",
  "data": { "repos": [ { "repoKey": "delivery-a", "...": "..." } ], "hostIndexRevision": 12 }
}
```

## ERRORS

| Error | Meaning | Exit |
|---|---|---|
| `repos.identity-unreadable` | The checkout identity cannot be derived; the root is not a git work tree | 1 |
| `repos.index-corrupt` | The host index cannot be read; run discovery again | 2 |
| `repos.state-unavailable` | A per-repository state location is missing or unreadable | 2 |

## SEE ALSO

[repos.v1](../contracts.md), [projects](./projects.md),
[architecture: multi-repository overview](../architecture.md),
[entrypoint delta](../entrypoint-delta.md),
[backlog](../../../backlog.md)
