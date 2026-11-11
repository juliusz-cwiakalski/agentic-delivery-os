# projects(1)

Status: Proposed (M2)

## NAME

`projects` - the group surface: configured projects with their member
repositories, health, and state.

## SYNOPSIS

```
<binary> projects list [--json]
<binary> projects list --project <key> [--json]
<binary> projects --help
<binary> projects list --help
<binary> --version
```

## DESCRIPTION

Read-only group view. A project is a named group of repositories that belong
together, and its membership is declared in configuration rather than inferred
from a directory. `projects list` renders every configured project with its
member repositories, their health, and their state.

Project-scoped reads take the project scope: `queue` and `status` accept a
project scope, so a reader can ask what one project has running, waiting, and
parked without scanning a host-wide list. A registered workspace root adds
discovery of managed clones inside that directory; it is never required, and a
project whose members live in unrelated directories reads identically.

The naming boundary is fixed: `repos` enumerates managed checkouts, and
`projects` groups them. The shipped `projects list` surface is the flat
enumeration this change renames to `repos list`; it is not the group surface
documented here. This page documents the group surface only; the flat
enumeration has its own page at [./repos.md](./repos.md) and its own contract
in [../contracts.md](../contracts.md).

This surface is proposed for M2-S18 and is not yet registered at the root
listing. The machine envelope is `projects.v1` in
[../contracts.md](../contracts.md); the configuration document is the project
configuration schema in the same file. See
[../entrypoint-delta.md](../entrypoint-delta.md) for the root listing delta.

## OPTIONS

| Option | Meaning |
|---|---|
| `list` | Render configured projects with their members. |
| `--project <key>` | Scope the read to one project. |
| `--json` | Emit the machine envelope instead of the human table. |
| `--help` | Print this command's help and exit without reading state, git, configuration, or the network. |
| `--version` | Print the binary's version and build identity and exit without reading state. |

## OUTPUT

Text: a project block per group with one member line per repository and the
columns `project`, `member`, `tracker`, `state`, `health`.

Envelope `data` carries:

| Key | Contract |
|---|---|
| `projects[]` | One entry per configured project |
| `projects[].projectKey` | Group identity of the project |
| `projects[].name` | Display name of the group |
| `projects[].workspaceRoot` | Optional workspace root used for discovery, absent when none is configured |
| `projects[].scope` | Project scope accepted by queue and status reads |
| `projects[].members[]` | One entry per declared member repository |
| `projects[].members[].repoKey` | Repo key of that member |
| `projects[].members[].root` | Absolute root of that member |
| `projects[].members[].trackerKind` | Tracker kind declared for that member |
| `projects[].members[].state` | Delivery state of that member |
| `projects[].members[].health` | Health of that member, including a `not-yet-supported` classification when its tracker kind has no implemented adapter |

The `daemonReachable.reason` vocabulary is closed: `daemon-not-mounted`,
`state-absent`, `socket-absent`, `socket-unreachable`. The first applicable
reason wins, in that order: an unmounted build declares the mount state and
performs no probe, and an absent state root makes the socket question
unanswerable.

## EXIT STATUS

| Code | Meaning |
|---|---|
| `0` | The group listing was produced |
| `1` | The request was refused, for example an unknown project key |
| `2` | A platform or state failure prevented the read |

## EXAMPLES

```
$ <binary> projects list
PROJECT    MEMBER        TRACKER STATE   HEALTH
platform   delivery-a    github  engine  healthy
platform   delivery-b    github  engine  degraded
```

```
$ <binary> projects list --project platform --json
{
  "ok": true,
  "command": "projects list",
  "data": { "projects": [ { "projectKey": "platform", "members": [ { "repoKey": "delivery-a", "...": "..." } ] } ] }
}
```

## SCOPE

`projects list` performs no index maintenance, prunes nothing, replaces no
corrupt file, creates no project state root, and writes no index or store
content. Two side effects are permitted: the invoking checkout's identity marker
is created once inside its git common directory when it is absent, as it is for
every composed command, and opening a project's store read-only to read its
handover evidence removes a leftover `*.tmp` sibling. Neither can create, change,
or prune an index entry, a phase document, a queue record, or any other store
content.

An invocation outside any git work tree uses the declared host-scoped `unbound`
state root beside the project container, emits one bounded warning that its
state is not repository-scoped, registers no project, creates no project root,
and keeps its exit code. It is never reported as a project row.

## ERRORS

| Error | Meaning | Exit |
|---|---|---|
| `projects.config-invalid` | The project configuration cannot be read or contradicts itself | 1 |
| `projects.unknown-project` | The requested project key is not configured | 1 |
| `projects.state-unavailable` | A member's per-repository state is missing or unreadable | 2 |

## SEE ALSO

[projects.v1](../contracts.md), [repos](./repos.md),
[architecture: multi-repository overview](../architecture.md),
[entrypoint delta](../entrypoint-delta.md),
[backlog](../../../backlog.md)
