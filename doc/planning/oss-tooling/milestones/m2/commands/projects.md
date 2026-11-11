# projects(1)

Status: Proposed (M2)

## NAME

`projects` - one overview of every delivery-managed checkout on the host.

## SYNOPSIS

```
<binary> projects list [--json]
```

## DESCRIPTION

Read-only host overview. Each managed checkout is identified by its checkout
identity (the git common dir marker), and its state lives under a
per-repository root, so two checkouts of different repositories never share
phase state, queue entries, or lane leases - even when both use the same ref.

`projects list` reports one row per project: the repo key, the checkout root,
the state location, daemon reachability, and the handover state. No manual
registry is required; the host index is discovered from the checkouts.

This surface is proposed for M2-S11 and is not yet registered at the root
listing. See [../entrypoint-delta.md](../entrypoint-delta.md) for the root
listing delta and [../contracts.md](../contracts.md) for `projects.v1`.

## OPTIONS

| Option | Meaning |
|---|---|
| `list` | Enumerate managed projects. The only verb in this contract. |
| `--json` | Emit the machine envelope instead of the human table. |

## OUTPUT

Text: a deterministic table with one row per project and the columns `key`,
`root`, `state`, `daemon`, `handover`, sorted by repo key.

Envelope `data` carries:

| Key | Contract |
|---|---|
| `projects[]` | One entry per managed checkout |
| `projects[].projectKey` | Stable repo key derived from the checkout identity |
| `projects[].root` | Absolute checkout root |
| `projects[].stateLocation` | Per-repository state root |
| `projects[].daemonReachable` | Boolean plus a degradation reason when false |
| `projects[].handoverState` | `engine`, `shell`, or `in-transition` |
| `hostIndexRevision` | Revision of the host-level index that produced the list |

## EXIT STATUS

| Code | Meaning |
|---|---|
| `0` | The project list was produced |
| `1` | The request was refused, for example an unknown verb |
| `2` | A platform or state failure prevented discovery |

## EXAMPLES

```
$ <binary> projects list
KEY            ROOT                     STATE                   DAEMON       HANDOVER
delivery-a     /work/delivery-a         /work/delivery-a/.state reachable    engine
delivery-b     /work/delivery-b         /work/delivery-b/.state unreachable  shell
```

```
$ <binary> projects list --json
{
  "ok": true,
  "command": "projects list",
  "data": { "projects": [ { "projectKey": "delivery-a", "...": "..." } ], "hostIndexRevision": 12 }
}
```

## ERRORS

| Error | Meaning | Exit |
|---|---|---|
| `projects.identity-unreadable` | The checkout identity cannot be derived; the root is not a git work tree | 1 |
| `projects.registry-corrupt` | The host index cannot be read; run discovery again | 2 |
| `projects.state-unavailable` | A per-repository state root is missing or unreadable | 2 |

## SEE ALSO

[projects.v1](../contracts.md), [architecture: multi-repository overview](../architecture.md),
[backlog](../../../backlog.md)
