# projects(1)

Status: Proposed (M2)

## NAME

`projects` - one overview of every delivery-managed checkout on the host.

## SYNOPSIS

```
<binary> projects list [--json]
<binary> projects --help
<binary> projects list --help
<binary> --version
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
| `--help` | Print this command's help and exit without reading state, git, configuration, or the network. |
| `--version` | Print the binary's version and build identity and exit without reading state. |

## OUTPUT

Text: a deterministic table with one row per project and the columns `key`,
`root`, `state`, `daemon`, `handover`, sorted by repo key. The `daemon` cell is
the closed vocabulary below: `daemon-not-mounted` (the shipped build composes no
resident daemon), `state-absent` (the project has no state root yet),
`socket-absent` (the derived socket path does not exist), `socket-unreachable`
(the socket exists and a bounded connect fails), or `reachable` with no reason.
A bare negative is never rendered.

Envelope `data` carries:

| Key | Contract |
|---|---|
| `projects[]` | One entry per managed checkout |
| `projects[].projectKey` | Stable repo key derived from the checkout identity |
| `projects[].root` | Absolute checkout root |
| `projects[].stateLocation` | Per-repository state root |
| `projects[].daemonReachable` | `{ reachable }` or `{ reachable: false, reason }` with the closed reason set below |
| `projects[].handoverState` | `engine`, `shell`, or `in-transition` |
| `hostIndexRevision` | Revision of the host-level index that produced the list |

The `daemonReachable.reason` vocabulary is closed: `daemon-not-mounted`,
`state-absent`, `socket-absent`, `socket-unreachable`. The first applicable
reason wins, in that order: an unmounted build declares the mount state and
performs no probe, and an absent state root makes the socket question
unanswerable.

## EXIT STATUS

| Code | Meaning |
|---|---|
| `0` | The project list was produced; also the declared `unbound` scope outside any work tree |
| `1` | The request was refused, for example an unknown verb, or the invoking checkout's identity cannot be read |
| `2` | A platform or state failure prevented discovery |

## EXAMPLES

```
$ <binary> projects list
KEY              ROOT                 STATE                                     DAEMON              HANDOVER
delivery-a-1a2b3c4d  /work/delivery-a  /srv/delivery-state/projects/delivery-a-1a2b3c4d  daemon-not-mounted  engine
delivery-b-5e6f7a8b  /work/delivery-b  /srv/delivery-state/projects/delivery-b-5e6f7a8b  socket-absent       shell
```

```
$ <binary> projects list --json
{
  "ok": true,
  "command": "projects list",
  "data": { "projects": [ { "projectKey": "delivery-a", "...": "..." } ], "hostIndexRevision": 12 }
}
```

## SCOPE

`projects list` is read-only without exception: it performs no index
maintenance, prunes nothing, replaces no corrupt file, creates no project state
root, and writes nothing.

An invocation outside any git work tree uses the declared host-scoped `unbound`
state root beside the project container, emits one bounded warning that its
state is not repository-scoped, registers no project, creates no project root,
and keeps its exit code. It is never reported as a project row.

## ERRORS

| Error | Meaning | Exit |
|---|---|---|
| `projects.identity-unreadable` | The **invoking** checkout's identity cannot be read: git metadata is present but unusable, or the identity marker is unreadable, invalid, or inconsistent with its recorded key. A path that is not a git work tree is not this error — it is the `unbound` scope below | 1 |
| `projects.registry-corrupt` | The host index is present but cannot be parsed; a state-opening invocation repairs it, preserving the corrupt bytes as a timestamped sibling | 2 |
| `projects.state-unavailable` | A project state location is present but unreadable or cannot be established, or the identity marker cannot be created. An **absent** root is ordinary first use, not this error | 2 |

## SEE ALSO

[projects.v1](../contracts.md), [architecture: multi-repository overview](../architecture.md),
[backlog](../../../backlog.md)
