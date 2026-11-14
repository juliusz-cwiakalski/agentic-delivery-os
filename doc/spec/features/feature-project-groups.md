---
ados_distribution: internal
id: SPEC-FEATURE-PROJECT-GROUPS
status: Current
created: 2026-11-14
last_updated: 2026-11-14
owners: ["engineering"]
service: delivery-os
summary: "Project groups: the configuration-only membership document (`<configDirectoryName>/projects.yaml`, schema `delivery.projects.groups.v1`) with load-time validation and its three classified identities, the optional workspace discovery root that locates declared member clones only, the `projects list` group surface under `project-groups.v1` with the closed five-value member health vocabulary and the closed daemon-reachability reasons, the one aggregation clause with its four per-member outcomes and the `data.partial`/`data.degradedMembers[]` projection, and the additive group-scoped `queue list --project` and `status --project` reads."
links:
  related_changes: ["GH-309"]
  related_decisions: ["ODR-0004", "TDR-0022"]
  contracts:
    - "packages/core/src/contracts/projects.ts"
    - "packages/core/src/domain/project-groups.ts"
---

# Feature: Project Groups

## Overview

A **project group** is a configured set of repositories that belong together. A
repository is one checkout and the delivery unit; a group is the declared
collection of repositories an operator or agent treats as one project; a
workspace is an optional discovery root and is never required. Membership is
**configuration only**: a group's members come from a validated configuration
document, and no directory scan, host index, or inference ever adds a member.

`projects list [--json]` renders every configured group with its member
repositories, their state, their health, and their daemon reachability under the
`project-groups.v1` payload.
`--project <groupKey>` scopes the read to one group. `queue list --project
<groupKey>` and `status --project <groupKey>` answer what one group has running,
waiting, and parked, applying the one aggregation clause this page defines.

**Naming boundary.** `repos` names the flat record set of managed checkouts,
documented in [Repositories and the Host Overview](feature-projects.md);
`projects` names the group surface described here. `board --project` stays a
repository key and the board is never group-scoped. The rename that establishes
the boundary is recorded in
[ODR-0004](../../decisions/ODR-0004-flat-record-set-rename-projects-to-repos.md).

## Project configuration document

The document is `<configDirectoryName>/projects.yaml` at the invoking checkout's
git root — the brand-derived configuration directory of the delivered
configuration layer, beside the project-committed `config.yaml`. It is its own
document with its own schema, and it is not a member of the ranked configuration
stack: it resolves from that one path only.

Schema `delivery.projects.groups.v1`:

```yaml
groups:
  - groupKey: platform            # the group identity
    name: Platform                # its display name
    workspaceRoot: ../workspace   # optional discovery root
    members:
      - root: ../checkouts/api    # a repository selector: root ...
        trackerKind: github
      - repoKey: api-0123abcd     # ... or repoKey
        trackerKind: github
```

Every group declares a `groupKey`, a `name`, an optional `workspaceRoot`, and at
least one member. Every member declares exactly one repository selector —
`root` or `repoKey` — plus a `trackerKind`. Trackers may be mixed inside one
group, and any non-empty tracker kind is valid configuration: only the GitHub
kind has an implemented adapter, and an unimplemented kind is classified per
member at read time rather than rejected.

An absent document and a document declaring zero groups are both the ordinary
**empty listing** for the unscoped default form: `projects list` returns
`data.groups: []` at exit `0`. Membership adoption is opt-in, so a host that
never writes the document keeps working. An explicit `--project <groupKey>` is
never an empty listing: a key the document does not declare is refused with
`projects.unknown-group` at exit `1`, including when the document is absent or
declares zero groups. A configuration path whose parent exists but is not a
directory is a scope failure, not an empty listing.

### Validation and the classified identities

The document is validated at load time on every group-scoped read, so a
contradictory configuration is a classified error and never a silently empty
group. The validation rules are closed:

| Rule | Classified as |
|---|---|
| `groupKey` is a non-empty string, unique across the document | `projects.config-invalid` |
| Every group declares a non-empty `name` and a `members[]` list | `projects.config-invalid` |
| Every member declares exactly one of `root` or `repoKey` | `projects.config-invalid` |
| Every member declares a non-empty `trackerKind` | `projects.config-invalid` |
| No two member declarations inside one group resolve to the same selector | `projects.config-invalid` |
| Every group declares at least one member | `projects.config-invalid` |
| The document parses and matches the declared schema | `projects.config-invalid` |
| A requested group key is not declared by the configuration document, including an absent or zero-group document | `projects.unknown-group` |
| The invoking scope is absent, or the configuration document is present but unreadable | `projects.scope-unavailable` |

`projects.config-invalid` and `projects.unknown-group` project as
`user-validation` (exit `1`); `projects.scope-unavailable` projects as
`platform-provider` (exit `2`). Group keys carry no public pattern: they are
non-empty strings, unique per document, and no regex constrains them. The three
group identities are declared in the [Result Contract](feature-result-contract.md).

A group-scoped read outside any git work tree has no scope to resolve the
document from and is refused with `projects.scope-unavailable` at exit `2`; the
flat record set keeps its own declared `unbound` scope at exit `0`.

## Workspace discovery root

A group may declare a `workspaceRoot`. Registering that directory enables a
read-only scan that **locates** the group's declared member clones inside it: the
walk descends into every non-symbolic child directory, never enters a `.git`
directory, and admits a candidate only when its durable repository key is a
declared `repoKey` selector or its root is a declared `root` selector. An
undeclared clone is never a member, at any depth, and the scan creates, moves,
and removes nothing.

The workspace is a convenience, never a requirement. The same group configured
with members in unrelated directories has identical members, health, and state,
and only `workspaceRoot` is absent from the envelope; no scan runs when no
workspaceRoot is configured.

The discovery root is distinct from the `default` workspace identifier inside
every per-checkout state root: the discovery root locates checkouts, the state
workspace keys a store.

## Member resolution and observation

Membership is declared order, always. Each declared member resolves
configuration-first:

- A `root` selector resolves through the host index, then the declared-only
  workspace scan, then the checkout's own readable identity marker.
- A `repoKey` selector resolves through the host index, then the declared-only
  workspace scan.

A corrupt or unreadable host index is an **empty resolution aid** on the group
surface: the index is never a membership source, so a member that depends on it
classifies `unregistered` at exit `0` while root-selected or workspace-located
members still resolve. A group read never replaces, repairs, or rewrites the
index.

A member that cannot be located is still listed: a `root`-selected member keeps
its declared root, a `repoKey`-selected member reports its declared key with an
empty `root`, and both are classified `unregistered`. A member is never dropped
from `members[]` because it could not be observed.

An observed member reuses the delivered per-checkout machinery: its state root is
`<host root>/projects/<repoKey>`, its handover state is the delivered handover
fold, and its daemon reachability uses the closed reason vocabulary
`daemon-not-mounted`, `state-absent`, `socket-absent`, `socket-unreachable`
(first applicable reason wins, in that order). A member that is not observed
reports the documented safe defaults — state `shell` and
`daemon-not-mounted` — alongside its classification.

### Member health

Member `health` is a closed five-value vocabulary. Each member carries exactly
one health value, and the three non-`observed` aggregation outcomes map to the
same-named health value:

| Health | Meaning |
|---|---|
| `healthy` | Observed with the daemon reachable |
| `degraded` | Observed with the daemon unreachable, carrying one of the closed reasons |
| `state-unavailable` | The member's state location cannot be established or read |
| `not-yet-supported` | The member's `trackerKind` has no implemented adapter; mandatory for such a member |
| `unregistered` | The member is declared but cannot be located |

## Group surface

`projects list [--json]` returns the `project-groups.v1` payload:

- **`data.groups[]`** — one entry per configured group in declared order, with
  exactly `groupKey`, `name`, the optional `workspaceRoot` (absent when none is
  configured), and `members[]`.
- **`members[]`** — one entry per declared member in declared order, with exactly
  `repoKey`, `root`, `trackerKind`, `state`, `health`, and `daemonReachable`.
- **Aggregation keys** — `data.partial` and `data.degradedMembers[]`, present
  only when a member degraded (see the aggregation clause).

The default form enumerates every configured group; `--project <groupKey>`
scopes it to one and refuses a key the document does not declare with
`projects.unknown-group` at exit `1`. `--flat` and `--project` are mutually exclusive and the
combination is refused at exit `1` through the shared `input.value.rejected`
grammar classification — the alias takes no group scoping and is never silently
coerced to either synopsis form. Any verb other than `list` is refused through
the shared invocation classification before the document is read.

Text output is a deterministic table with the columns `group`, `member`,
`tracker`, `state`, `health`, `daemon`: one row per declared member in declared
order, with the group key repeated. Two runs over unchanged state are
byte-identical.

## The aggregation clause

One clause governs every group-scoped read. Members come from configuration in
declared order, and the state layer's own scope stays per-checkout — a group
never owns a store. Each member resolves to exactly one closed outcome:

| Outcome | Contribution |
|---|---|
| `observed` | The member's records are returned |
| `not-yet-supported` | No records; never fails the read |
| `state-unavailable` | No records; degrades the result |
| `unregistered` | No records; never fails the read |

A `state-unavailable` member produces a classified **partial** result at exit
`0`: `data.partial` is `true` and `data.degradedMembers[]` names each degraded
member by `repoKey` and outcome, while the readable members are still returned.
Only `state-unavailable` degrades a read: an unregistered or not-yet-supported
member stays classified and leaves `data.partial` absent.

Exit `2` is reserved for an unreadable configuration document or invoking
scope. Every other group-scoped outcome answers at exit `0` or is refused at
exit `1`.

## Group-scoped queue and status reads

`queue list --project <groupKey>` and `status --project <groupKey>` apply the
same clause and return the group's work per member:

- exactly `groupKey`, `members[]`, and the same optional `partial` and
  `degradedMembers[]` keys;
- each member entry carries exactly `repoKey`, `root`, `trackerKind`, `outcome`,
  `health`, and the three collections `running`, `waiting`, and `parked`,
  read from that member's own per-checkout state;
- a member whose outcome is not `observed` contributes no records and keeps its
  classification, so a degraded member never vanishes from `members[]`.

Text output is a deterministic table with the columns `group`, `member`,
`tracker`, `outcome`, `bucket`, `ref`, `state`, one row per contributed entry; a
member that contributes nothing renders one row with bucket `none` and its
health in the `state` column.

An unknown group key is refused with `projects.unknown-group` at exit `1` on
every group-scoped surface — one refusal rule, including when the configuration
document is absent or declares zero groups. Within the queue family,
`--project` is accepted on `queue list` only, and no other surface gains group
scoping: `board --project` remains a repository key, and spend, brief, and the
remaining reads stay repository-scoped. The unscoped `queue list` and `status`
forms are unchanged.

## Read-only posture

Group reads perform no host-index maintenance, no prune, no corrupt-file
replacement, no state-root creation, no migration, and no store-content write.
The same two delivered side effects are permitted: the create-once identity
marker minted inside the invoking checkout's git common directory when it is
absent, and the removal of a leftover `*.tmp` store sibling by the store handle
opened read-only to read a member's handover evidence. A workspace scan writes
nothing. A classified failure writes nothing at all.

## Error identities

| Identity | Kind | Exit | Condition |
|---|---|---|---|
| `projects.config-invalid` | `projects` | `1` | The configuration document contradicts itself or fails schema validation |
| `projects.unknown-group` | `projects` | `1` | The requested group key is not declared by the configuration document, including an absent or zero-group document |
| `projects.scope-unavailable` | `projects` | `2` | The invoking scope is absent, or the configuration document is present but unreadable |
| `input.value.rejected` | `input` | `1` | `--flat` combined with `--project` on `projects list` |

No group-scoped failure is silent and no unclassified outcome exists: a
configuration problem is always one of the rows above.

## Quality evidence

| Level | Scope | Evidence |
|---|---|---|
| Behaviour | Configuration validation, scoped and default group reads, workspace discovery parity, aggregation, group-scoped queue and status, read-only posture | `tests/behaviour/projects-config.test.ts`, `projects-groups-list.test.ts`, `queue-status-project-scope.test.ts`, `projects-read-only-audit.test.ts` |
| Structure | The `project-groups.v1` envelope, the closed outcome and health vocabularies, and the full delivered envelope set | `tests/structure/projects-groups-envelope.test.ts` |
| Boundary | `repos` = flat record set and `projects` = groups across help, the reference pages, and the migration guide; the board is never group-scoped | `tests/structure/naming-boundary.test.ts` |

## Related

- [Repositories and the Host Overview](feature-projects.md) — the two-layer state
  scope, the identity marker, the host index, and the flat record set.
- [Scheduling Engine](feature-scheduling-engine.md) — the per-checkout queue
  read each observed member contributes.
- [Status Digest](feature-status-digest.md) — the repository-scoped digest the
  group-scoped form replaces for one group.
- [Result Contract and Error Table](feature-result-contract.md) — the envelope,
  the `projects` kind, and the exit projection.
- [CLI Entrypoint](feature-cli-entrypoint.md) — the prompt-required set that
  carries `projects list`.
- [ODR-0004 — Flat Record Set Command Rename](../../decisions/ODR-0004-flat-record-set-rename-projects-to-repos.md)
- [TDR-0022 — Multi-Repository Workstation State Scope](../../decisions/TDR-0022-multi-repository-workstation-state-scope.md)
