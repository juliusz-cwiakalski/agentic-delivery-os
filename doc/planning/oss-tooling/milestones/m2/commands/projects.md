# projects(1)

Status: Proposed (M2)

## NAME

`projects` - the group surface: configured groups with their member
repositories, health, and state.

## SYNOPSIS

```
<binary> projects list [--json]
<binary> projects list --project <groupKey> [--json]
<binary> projects list --flat [--json]
<binary> projects --help
<binary> projects list --help
<binary> projects --version
```

## DESCRIPTION

Read-only group view. A project is a named group of repositories that belong
together, and its membership is declared in configuration rather than inferred
from a directory. `projects list` renders every configured group with its
member repositories, their health, and their state, under the
`project-groups.v1` contract.

Group-scoped reads take the group key: `queue list --project <groupKey>` and
`status --project <groupKey>` answer what one group has running, waiting, and
parked. A registered `workspaceRoot` adds discovery of the declared members
inside that directory; it is never required, and a group whose members live in
unrelated directories reads identically. Scan results never admit an
undeclared clone.

The naming boundary is fixed: `repos` is the flat record set, and `projects`
groups it. The time-scoped disambiguation: before M2-S18 the shipped
`projects list` was the delivered flat record set, and from M2-S18 the rename
rule makes `projects list` the group surface while `repos list` takes the flat
enumeration. The flat page is [./repos.md](./repos.md) and its contract lives
in [../contracts.md](../contracts.md).

This surface is proposed for M2-S18 and is not yet registered at the root
listing. The group contract is `project-groups.v1`, the configuration document
is `<configDirectoryName>/projects.yaml` (schema
`delivery.projects.groups.v1`), and the aggregation behaviour is declared in
the project-scoped aggregation clause; all three are in
[../contracts.md](../contracts.md). See
[../entrypoint-delta.md](../entrypoint-delta.md) for the root listing delta.

## OPTIONS

| Option | Meaning |
|---|---|
| `list` | Render configured groups with their members. |
| `--project <groupKey>` | Scope the read to one group. |
| `--flat` | The deprecation alias defined by the rename rule: return the delivered flat payload instead of groups. |
| `--json` | Emit the machine envelope instead of the human table. |
| `--help` | Print command or verb help and exit without reading state, git, configuration, or the network. |
| `--version` | Print the binary's version and build identity and exit without reading state, git, configuration, or the network. |

## OUTPUT

Text: a group block per group with one member line per repository and the
columns `group`, `member`, `tracker`, `state`, `health`, `daemon`.

Envelope `data.groups[]` carries exactly one entry per configured group, and
`data.groups[]` carries a `groupKey` for each such group. Each entry holds:

| Key | Contract |
|---|---|
| `data.groups[].groupKey` | Group identity of the group |
| `data.groups[].name` | Display name of the group |
| `data.groups[].workspaceRoot` | Optional workspace root used for discovery, absent when none is configured |
| `data.groups[].members[]` | One entry per declared member repository |
| `data.groups[].members[].repoKey` | Repo key of that member |
| `data.groups[].members[].root` | Absolute root of that member |
| `data.groups[].members[].trackerKind` | Tracker kind declared for that member |
| `data.groups[].members[].state` | Delivery state of that member |
| `data.groups[].members[].health` | Health of that member, including a `not-yet-supported` classification when its tracker kind has no implemented adapter |
| `data.groups[].members[].daemonReachable` | Daemon reachability for that member, plus a degradation reason when false |

The `data.groups[].members[].daemonReachable.reason` vocabulary is closed:
`daemon-not-mounted`, `state-absent`, `socket-absent`, `socket-unreachable`.
The first applicable reason wins, in that order: an unmounted build declares
the mount state and performs no probe, and an absent state root makes the
socket question unanswerable.

Aggregation reads the members from configuration in declared order. One
`state-unavailable` member produces a classified partial result at exit `0`
with `partial` true and the degraded member named, so the readable members are
still returned; a `not-yet-supported` member contributes no records and never
fails the read. Exit `2` occurs only when the configuration document or the
invoking scope cannot be read.

## EXIT STATUS

| Code | Meaning |
|---|---|
| `0` | The group listing was produced, including a classified partial result |
| `1` | The request was refused, for example an unknown group key |
| `2` | The configuration document or the invoking scope cannot be read |

## EXAMPLES

```
$ <binary> projects list
GROUP       MEMBER                    TRACKER  STATE   HEALTH    DAEMON
platform    delivery-a-1a2b3c4d       github   engine  healthy   reachable
platform    delivery-b-5e6f7a8b       github   engine  degraded  unreachable
```

```
$ <binary> projects list --project platform --json
{
  "ok": true,
  "command": "projects list",
  "data": { "groups": [ { "groupKey": "platform", "members": [ { "repoKey": "delivery-a-1a2b3c4d", "...": "..." } ] } ] }
}
```

## SCOPE

`projects list` performs no index maintenance, prunes nothing, replaces no
corrupt file, and creates no group state root. Two side effects are permitted:
the invoking checkout's identity marker is created once inside its git common
directory when it is absent, and opening a member's store read-only to read
its handover evidence removes a leftover `*.tmp` sibling. Neither can create,
change, or prune an index entry, a phase document, a queue record, or any
other store content.

Outside the projects family itself, only queue and status are group-scoped.
`board --project` stays a repository key and is never group-scoped, and this
page makes no group-scoped board claim.

The repository vocabulary is permanent: the `project-identity.json` marker,
the `<host root>/projects/<key>` container, the host index's `projects[]` and
`projectKey` fields, and the `--project-root` flag each denote a repository checkout
and keep that meaning unless a code change renames them.

`projects list --flat` is only the deprecation alias defined by the rename
rule: it returns the delivered flat payload and is not restated here.

## ERRORS

| Error | Meaning | Exit |
|---|---|---|
| `projects.config-invalid` | The configuration document contradicts itself or fails schema/content validation | 1 |
| `projects.unknown-group` | The requested group key is not configured | 1 |
| `projects.scope-unavailable` | The configuration document cannot be read, or the invoking scope is unavailable | 2 |

## SEE ALSO

[project-groups.v1](../contracts.md), [repos](./repos.md),
[architecture: multi-repository overview](../architecture.md),
[entrypoint delta](../entrypoint-delta.md),
[backlog](../../../backlog.md)
