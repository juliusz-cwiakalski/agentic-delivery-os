# repos(1)

Delivered (M2-S18)

## NAME

`repos` - the flat record set of delivery-managed checkouts on the host.

## SYNOPSIS

```
<binary> repos list [--json]
<binary> repos --help
<binary> repos list --help
<binary> repos --version
```

## DESCRIPTION

Read-only host enumeration. Each managed checkout is identified by its
checkout identity (the git common dir marker), and its state lives under a
per-repository root, so two checkouts of different repositories never share
phase state, queue entries, or lane leases - even when both use the same ref.

`repos list` reports one row per checkout: the repo key, the checkout root,
the state location, the daemon reachability, the handover state, whether a flip
is reversible, and the handover gate block evaluated at read time. No manual
registry is required; the host index is discovered from the checkouts.

This is the flat record set contract, delivered by M2-S18. The rename rule
moves the enumeration to `repos list`, and the deprecation alias is the
different token `projects list --flat`, which keeps the delivered payload
reachable until the M3 boundary. The group surface belongs to `projects` and
has its own page at [./projects.md](./projects.md).

`repos` is registered at the root listing. See
[../entrypoint-delta.md](../entrypoint-delta.md) for the root listing delta
and [../contracts.md](../contracts.md) for `repos.v1`.

## OPTIONS

| Option | Meaning |
|---|---|
| `list` | Enumerate managed checkouts. The only verb in this contract. |
| `--json` | Emit the machine envelope instead of the human table. |
| `--help` | Print command or verb help and exit without reading state, git, configuration, or the network. |
| `--version` | Print the binary's version and build identity and exit without reading state, git, configuration, or the network. |

## OUTPUT

Text: a deterministic table with one row per checkout and the columns `key`,
`root`, `state`, `daemon`, `handover`, sorted by repo key. The five columns are
unchanged: the gate detail is a JSON read, and the human per-condition view is
the summary text.

Envelope `data` carries:

| Key | Contract |
|---|---|
| `repos[]` | One entry per managed checkout |
| `repos[].repoKey` | Stable repo key derived from the checkout identity |
| `repos[].root` | Absolute checkout root |
| `repos[].stateLocation` | Per-repository state location |
| `repos[].daemonReachable` | Daemon reachability, plus a degradation reason when false |
| `repos[].handoverState` | `engine`, `shell`, or `in-transition` |
| `repos[].reversible` | `true` exactly when the latest folded handover operation is `authoritative` |
| `repos[].handoverGate` | Read-time gate block: `verdict` (`eligible`, `ineligible`, or `unverifiable`), the four ordered `conditions` (`truth`, `coverage`, `floor`, `corroboration`; each `{condition, status}` with `status` in `met \| open`), `countedDeliveries`, `cleanDispatches`, and `truncation` only when the bounded read omitted records |
| `hostIndexRevision` | Revision of the host-level index that produced the list |

The gate block is evaluated at read time for every `ready` row, over one bounded
attempts read plus one divergences read on the store the row pass has already
opened, bound to the row's own normalized `host/owner/name` identity (resolved
read-only and non-persisting from the checkout) and folded at the declared
`production` evidence scope — the same scope `dispatch dual-run summary --repo`
and the handover decision use — so records of another repository in the same
store are excluded. A `first-use` row reports the declared empty-window
evaluation (`ineligible`; `truth` met, `corroboration` met vacuously, `coverage`
and `floor` open; `countedDeliveries: 0`, `cleanDispatches: 0`,
`reversible: false`) without opening a store. An unreadable, torn, or malformed
attempts/divergences ledger, and an unresolvable repository identity on a `ready`
row, fail the whole read as `repos.state-unavailable` at exit `2` with no
fabricated row; a truncated attempts read is not a failure and reports
`verdict: "unverifiable"` with the `truncation` object.

`<binary> repos list --json` returns `repos.v1` with `data.repos[]` exactly as
tabulated above.

## SCOPE

`repos list` performs no index maintenance, prunes nothing, replaces no
corrupt file, creates no state root, and writes no index or store content.
Two side effects are permitted: the invoking checkout's identity marker is
created once inside its git common directory when it is absent, as it is for
every composed command, and opening a checkout's store read-only to read its
handover evidence removes a leftover `*.tmp` sibling. Neither can create,
change, or prune an index entry, a phase document, a queue record, or any
other store content.

An invocation outside any git work tree uses the declared `unbound` scope,
emits one bounded warning that its state is not repository-scoped, registers
nothing, creates no state root, and keeps its exit code. It is never reported
as a row and is never a failure.

The repository vocabulary is permanent: the `project-identity.json` marker,
the `<host root>/projects/<key>` container, the host index's `projects[]` and
`projectKey` fields, and the `--project-root` flag each denote a repository checkout
and keep that meaning unless a code change renames them.

## STATE

The per-repository state location is `<host root>/projects/<key>`, where the
key conforms to `PROJECT_KEY_PATTERN`
(`^[a-z0-9][a-z0-9-]*-[0-9a-f]{8}$`), for example
`<host root>/projects/delivery-a-1a2b3c4d`. A bare repository basename is not
a valid key.

## EXIT STATUS

| Code | Meaning |
|---|---|
| `0` | The checkout list was produced |
| `1` | The request was refused, for example an unknown verb |
| `2` | A platform or state failure prevented discovery |

## EXAMPLES

```
$ <binary> repos list
KEY                        ROOT                STATE                                  DAEMON       HANDOVER
delivery-a-1a2b3c4d        /work/delivery-a    <host root>/projects/delivery-a-1a2b3c4d reachable    engine
delivery-b-5e6f7a8b        /work/delivery-b    <host root>/projects/delivery-b-5e6f7a8b unreachable  shell
```

```
$ <binary> repos list --json
{
  "schemaVersion": "delivery.result.v1",
  "runId": "run-1",
  "exitCode": 0,
  "timing": { "totalMs": 4 },
  "data": { "repos": [ { "repoKey": "delivery-a-1a2b3c4d", "...": "..." } ], "hostIndexRevision": 12 }
}
```

## ERRORS

| Error | Meaning | Exit |
|---|---|---|
| `repos.identity-unreadable` | The invoking checkout's git metadata is unusable, or its identity marker is unreadable or inconsistent | 1 |
| `repos.registry-corrupt` | The host index cannot be read; run discovery again | 2 |
| `repos.state-unavailable` | A per-repository state location is missing or unreadable, or a row's gate evaluation cannot be produced (an unreadable, torn, or malformed evidence ledger, or an unresolvable row identity) | 2 |

The flat surface's error identities follow the surface, not the token: every
failure of `repos list` and of the `projects list --flat` alias classifies under
the `repos.*` identities above (see [../contracts.md](../contracts.md)).

## SEE ALSO

[repos.v1](../contracts.md), [projects](./projects.md),
[architecture: multi-repository overview](../architecture.md),
[entrypoint delta](../entrypoint-delta.md),
[backlog](../../backlog.md)

The rename and its alias are stated once in the
[rename rule](../contracts.md#naming-boundary-and-the-rename-rule).
