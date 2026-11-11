---
ados_distribution: internal
id: SPEC-FEATURE-PROJECTS
status: Current
created: 2026-11-11
last_updated: 2026-11-11
owners: ["engineering"]
service: delivery-os
summary: "The projects host overview: the two-layer state scope (host root plus a per-repository project root), the checkout identity marker and its minted project key, the derived host index with bounded maintenance and the DEC-18 key guard, the read-only `projects list [--json]` surface with its five-field envelope, deterministic table, exit projection, three contract error identities, handover and daemon projections, and the four state-location outcomes."
links:
  related_changes: ["GH-288"]
  related_decisions: ["TDR-0022"]
---

# Feature: Projects Host Overview

## Overview

Delivery state is scoped per repository. Two layers resolve it: the **host root**
— an absolute `<PREFIX>_STATE_DIR` environment override when set, otherwise the
injected home plus `brand.stateDirectoryName` — and a **project state root**
`<host root>/projects/<project key>` minted once from the checkout's identity
marker. The host root keeps only host-wide documents: the derived host index
`host-index.json` and the host-wide owner-hold marker; `unmigrated` store
artifacts are detected, never read from there.

`projects list [--json]` is the host overview and the only verb of the family.
It reads the host index, derives every state location from its key, projects each
project's handover state and daemon reachability, and writes nothing.

The durable architecture record is
[TDR-0022](../../decisions/TDR-0022-multi-repository-workstation-state-scope.md);
this page states the delivered behaviour.

## Host root and project root

| Layer | Path | Holds |
|---|---|---|
| Host root | `<PREFIX>_STATE_DIR` (absolute) else `<home>/<brand.stateDirectoryName>` | `host-index.json`, `owner-hold`, `projects/`, `unbound/` |
| Project root | `<host root>/projects/<project key>` | The delivered store layout under workspace `default`: ledger, header, index, fence, `documents.<ws>/`, `quarantine.<ws>/`, the audit chain key, the retro sidecar and its lock, and the retro chain key |

The state-scope policy lives once, in the app tier
(`packages/core/src/app/state-scope.ts`), is exported from the existing
`@delivery-os/core` root entry, and is consumed by the CLI production
composition, the MCP serve composition, the runtime-aware edge's audit store, the
daemon settings composing site, the dispatch state root, the retro sidecar
location, the owner-hold read (host root only), and the CLI-independent shell
fallback. No surface composes a state directory from a home and a brand value.

The workspace identifier stays `default` inside every project root, and the store
layout inside a root is the delivered layout unchanged: isolation comes from the
root, not from re-keying the workspace.

## Checkout identity and the project key

The **checkout identity marker** is one JSON document inside the checkout's git
**common** directory (`project-identity.json`, schema
`delivery.projects.identity.v1`). It records the project key, a random 128-bit
project identifier, and the mint-time basename. It is created once through an
atomic synced sibling plus link at mode `0600`, is never rewritten, is shared by
every linked worktree of the clone, and travels with a renamed or moved
checkout.

The key is `<sanitised mint-time basename>-<first eight lowercase hex of the
identifier>`: the basename is lowercased, every run outside `[a-z0-9]` collapses
to one `-`, leading and trailing separators are stripped, the result is at most
32 characters, a basename that sanitises to nothing falls back to `project`, and
the literal `unbound` is refused as a basename. Because the discriminator derives
from the once-minted identifier, two checkouts of different repositories that
share a basename mint different keys. Because the mint-time basename travels in
the marker, a rename or a move changes only the reported checkout root.

The identity outcome is a closed table:

| State | Condition | Outcome |
|---|---|---|
| Not a work tree | No git root: no `.git`, or a `.git` file that is not a `gitdir:` pointer | The declared `unbound` scope, exit `0`, one warning, no registration |
| Git metadata unusable | A git root resolves but its git directories do not (an empty `gitdir:` value) | `projects.identity-unreadable`, exit `1` |
| Marker absent | A git root and common directory resolve, no marker exists | Mint once and use its key |
| Marker unreadable or inconsistent | The marker cannot be read, is not JSON, misses a field, or its key disagrees with its recorded basename and identifier | `projects.identity-unreadable`, exit `1`, naming the key and identifier when readable |
| Marker write fails | The marker cannot be created | `projects.state-unavailable`, exit `2`, naming the checkout root and the failing marker path |

The refusal is always about the **invoking** checkout and never names another
project's root.

## Host index

`<host root>/host-index.json` (schema `delivery.projects.host-index.v1`) is a
derived, revisioned cache: not a state record, never authoritative, rebuildable
from checkouts. Each entry records `projectKey`, `projectIdentifier`, `root`, the
derived `stateLocation`, and `lastWrittenAt`. The index is discovered from use,
never by a filesystem crawl.

Maintenance runs at most once per store-opening invocation whose scope resolves
inside a checkout: exactly one index read and at most one write. The fold upserts
the current project, prunes only entries that are provably dead (the recorded
root is absent, or that root's marker now resolves to a different identifier),
leaves uncertain entries, always re-derives every state location from its key,
and reports a disagreement as a warning that never redirects a read. Content that
did not change produces zero writes and no revision advance.

Absent is not corrupt: no index means no registered project, an empty list,
revision `0`, and exit success. A present but unparsable index is corruption for
a read and is replaced by maintenance, which preserves the corrupt bytes once as
a timestamped sibling.

**Collision guard.** If registration finds the minted key already held under a
different project identifier, the index keeps the existing entry unchanged and
advances no revision; the colliding invocation warns once and reports
`projects.state-unavailable` at exit `2` naming its own checkout root, its key,
and the conflicting identifier. It never adopts that state root.

## `projects list` contract

- **Verb.** `list` only. Any other verb is refused through the shared invocation
  classification at exit `1` before the index is read.
- **Envelope.** `data` carries exactly `projects` and `hostIndexRevision`; each
  entry carries exactly `projectKey`, `root`, `stateLocation`, `daemonReachable`
  (`{ reachable }` or `{ reachable: false, reason }`), and `handoverState`.
  Entries are ordered by `projectKey`. No new top-level envelope key exists.
- **Text.** A deterministic table with the columns `key`, `root`, `state`,
  `daemon`, `handover`, sorted by key. The `daemon` cell carries the reason token
  when unreachable, never a bare negative. Two runs over unchanged state are
  byte-identical.
- **Exit projection.** `0` produced; `1` refused (unknown verb, or the invoking
  checkout's identity cannot be read); `2` the host index or a project state
  location prevents an honest answer. No other code is produced by the family.
- **Read-only.** No maintenance, no prune, no corrupt-file replacement, no
  project-root creation, no migration, and no write of any kind. Host-root and
  `projects/` bytes, modes, and mtimes are unchanged across a listing.

## Handover projection

`handoverState` is folded from delivered evidence only:

| Folded latest handover operation | Derived authority document | Reported |
|---|---|---|
| `authoritative` | `authoritative` | `engine` |
| `dual-run` | `dual-run` or absent | `shell` |
| no record | any | `shell` (the documented safe default) |
| `authoritative` | absent, `dual-run`, or malformed | `in-transition` |
| `dual-run` | `authoritative` | `in-transition` |

`engine` is produced only on agreement and `in-transition` only on a detected
disagreement; a malformed document is distinct from an absent one. A present but
unreadable state root is a state failure, never a fabricated handover value.

## Daemon reachability

`daemonReachable` is `{ reachable }` or `{ reachable: false, reason }` with the
closed reason vocabulary `daemon-not-mounted`, `state-absent`, `socket-absent`,
`socket-unreachable`. The mount capability is injected: the shipped build
composes none, declares `daemon-not-mounted`, and performs no probe. A mounted
composition derives the socket path from the **project** state root through the
delivered settings rule and performs one bounded, write-free connect with no
payload and no command.

## State-location outcomes

| Cell | Condition | Outcome |
|---|---|---|
| First use | Project root absent, no delivered store artifact at the host root | Ordinary (exit `0`, no warning, `handoverState` `shell`) |
| Legacy warning | Project root absent while the host root still holds a delivered store artifact | One bounded warning naming the migration guide; nothing moved, no exit change |
| Unreadable root | Project root present but unreadable or not a directory | `projects.state-unavailable`, exit `2`, naming the project key and its state location |
| Uncreatable marker | The identity marker cannot be created | `projects.state-unavailable`, exit `2`, naming the checkout root and the failing marker path |

The legacy predicate is closed over the delivered store artifact names and
excludes the host index (and its corrupt siblings), the owner-hold marker, the
project container, and the `unbound` scope.

## Owner hold

The owner hold is host-wide: the marker is read at the host root, no per-project
marker exists, and the brand-derived environment source keeps its precedence. One
hold stops every project on the host.

## Migration

Migration is one-step and operator-run: move the populated store into one
designated primary project's root, keeping every name and mode, and leave the
owner-hold marker and the host index at the host root. Nothing is rewritten, so
the inverse move restores the previous reads. The procedure, the primary-checkout
choice, and the override caveat are documented in
[Migrating to Per-Repository Delivery State](../../guides/migrating-to-per-repository-state.md).
No automatic migration, migration command, or re-attribution exists.

## Related

- [State Layer](feature-state-layer.md) — the store contract this surface scopes.
- [CLI Entrypoint](feature-cli-entrypoint.md) — the prompt-required set that
  carries `projects list`.
- [Branding Seam](feature-branding-seam.md) — `stateDirectoryName` naming the host
  root.
- [Audit Ledger](feature-audit-ledger.md) — the runtime-aware edge's audit store,
  now opened at the project root.
- [Resident Dispatch Daemon](feature-resident-daemon.md) — the socket path derived
  from the project state root by the composing site.
- [Owner-Gate SLA](feature-owner-gate-sla.md) — the host-wide owner hold.
