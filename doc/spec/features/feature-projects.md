---
ados_distribution: internal
id: SPEC-FEATURE-PROJECTS
status: Current
created: 2026-11-11
last_updated: 2026-11-24
owners: ["engineering"]
service: delivery-os
summary: "The host overview and the flat record set: the two-layer state scope (host root plus a per-clone project root), the clone-identity marker and its minted key, the additive declared-product-key and clone-key contract exports beside the served `cloneKey` on the resolved project scope, the derived host index with bounded maintenance and the DEC-18 key guard, the read-only `repos list [--json]` surface with its `repos.v1` payload, deterministic `CLONE` table, exit projection, three `repos.*` contract error identities, handover and daemon projections, the four state-location outcomes, and the delivered `projects list --flat` alias that serves the byte-compatible `projects.v1` payload; the board reads the host index once per `--all`/`--project` run, unions it with the invoking checkout, and never maintains it."
links:
  related_changes: ["GH-288", "GH-289", "GH-309", "GH-320", "GH-297", "GH-293", "GH-365", "GH-406"]
  related_decisions: ["TDR-0022", "ODR-0004", "TDR-0031", "ODR-0006"]
---

# Feature: Repositories and the Host Overview

## Overview

Delivery state is scoped per clone. Two layers resolve it: the **host root**
— an absolute `<PREFIX>_STATE_DIR` environment override when set, otherwise the
injected home plus `brand.stateDirectoryName` — and a **project state root**
`<host root>/projects/<clone identity>` minted once from the checkout's
clone-identity marker. The host root keeps only host-wide documents: the derived
host index `host-index.json` and the host-wide owner-hold marker; a
pre-migration store left at the host root is detected there, never read from it.

The delivery vocabulary — product, repository, main checkout, worktree,
lane, work item, clone identity, product key — is defined once in the
[ubiquitous language](../../overview/ubiquitous-language.md#the-delivery-vocabulary)
delivery vocabulary table; this page states the delivered behaviour and keeps
the delivered field names (`repoKey`, `projectKey`) until the mechanical rename.

`repos list [--json]` is the flat record set of managed checkouts on the host:
it reads the host index, derives every state location from its key, and projects
each checkout's handover state and daemon reachability. It writes no index or
store content; the two permitted side effects are named under Read-only below.
The `projects` command family names project groups described in [Project
Groups](feature-project-groups.md); the same flat payload is also served by the
delivered `projects list --flat` alias.

The durable architecture record is
[TDR-0022](../../decisions/TDR-0022-multi-repository-workstation-state-scope.md);
this page states the delivered behaviour. The command rename that makes `repos`
the flat record set is recorded in
[ODR-0004](../../decisions/ODR-0004-flat-record-set-rename-projects-to-repos.md).

## Host root and project root

| Layer | Path | Holds |
|---|---|---|
| Host root | an absolute `<PREFIX>_STATE_DIR` override, else the current default root when it exists, else the prior-identity default root when it exists, else the current default root (first use) | `host-index.json`, `owner-hold`, `projects/`, `unbound/` |
| Project root | `<host root>/projects/<clone identity>` | The delivered store layout under workspace `default`: ledger, header, index, fence, `documents.<ws>/`, `quarantine.<ws>/`, the audit chain key, the retro sidecar and its lock, and the retro chain key |

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

### Prior-identity host root

When the invoking identity declares a prior identity, the one pure policy selects
the host root in this order: an absolute current `<PREFIX>_STATE_DIR` override
wins outright and disables the fallback; otherwise the current default root when
it exists; otherwise the prior default root when it exists; otherwise the current
default root, which is the ordinary first-use creation path. The two existence
facts are injected by the composition tier (which already owns the filesystem
facts); the policy performs no filesystem access. The prior identity's
environment names are never read, so an override cannot silently cross
identities.

While the fallback holds, no current default root is created — the
anti-orphaning guarantee — and because a project store is single-rooted the prior
root serves reads **and** the ordinary store operations that follow, so nothing is
moved, copied, or rewritten. When both default roots exist the current root wins
and the prior root is reported once as not used by the prior-identity fallback
notice (`prior-identity-fallback`, reasons `state-read` and `state-skipped`) on
stderr in every mode. The fallback invocation therefore resolves exactly one host
root, keeps the one home-plus-directory composition helper and the one
`<PREFIX>_STATE_DIR` read, and leaves the delivered first-use path untouched.

This **extends** [TDR-0022](../../decisions/TDR-0022-multi-repository-workstation-state-scope.md)
without contradicting it: one effective host root per invocation, one
home-plus-brand composition, and one `<PREFIX>_STATE_DIR` read remain; only which
root that same rule selects changes. The operator-facing description is the
[Local Install and Prior-Identity Transition](../../../guides/local-install.md)
guide.

## Clone identity and the delivered names

The **clone identity marker** is one JSON document inside the checkout's git
**common** directory (`project-identity.json`, schema
`delivery.projects.identity.v1`). It records the clone identity — delivered
under the field name `projectKey` — a random 128-bit project identifier, and
the mint-time basename. It is created once through an atomic synced sibling
plus link at mode `0600`, is never rewritten, is shared by every linked
worktree of the clone, and travels with a renamed or moved checkout.

The clone identity is `<sanitised mint-time basename>-<first eight lowercase
hex of the identifier>`: the basename is lowercased, every run outside
`[a-z0-9]` collapses to one `-`, leading and trailing separators are stripped,
the result is at most 32 characters, a basename that sanitises to nothing falls
back to `project`, and the literal `unbound` is refused as a basename. Because
the discriminator derives from the once-minted identifier, two checkouts of
different repositories that share a basename mint different clone identities.
Because the mint-time basename travels in the marker, a rename or a move
changes only the reported checkout root.

The clone-identity pattern is exported under its vocabulary name
`CLONE_KEY_PATTERN`; the delivered export `PROJECT_KEY_PATTERN` stays exported
as the same-value alias, and both denote the clone identity until the
mechanical rename (GH-408). The resolved project scope serves the clone
identity as the read-only `cloneKey` member beside the delivered
`projectKey` field — a served read that writes nothing: the marker field, the
host-index field, and the `projects list --flat` alias payload keep their
delivered names.

The **declared product key** is a different contract in a disjoint namespace:
`DECLARED_PRODUCT_KEY_PATTERN` is `^[a-z0-9][a-z0-9-]{0,62}[a-z0-9]$` (2–64
characters, lowercase alphanumerics and hyphens, no leading or trailing
hyphen, path-safe by construction), and its predicate
(`isDeclaredProductKey`) additionally refuses the two reserved state
segments `unbound` and `projects`, exact-match on the whole key —
substring-containing keys are accepted — with every rejection naming its rule
(`length`, `charset`, `hyphen-position`, `reserved-segment`). It names the
product (see [Project Groups](feature-project-groups.md)), is never compared
against the clone identity, and is enforced only where a key is used as a
declared key — the credential, manifest, and workspace consumers own those
enforcement points; nothing on this page enforces it. New code names the
concept `declaredProductKey`, keeping the *declared* qualifier while the
legacy names (`projectKey`, the `projects` family) exist; the mechanical
rename (GH-408) may drop it. The noun *project* is retired from the model's
own vocabulary — the delivered vocabulary table records the retirement and
the legacy-name exceptions
([ubiquitous language](../../overview/ubiquitous-language.md#the-delivery-vocabulary)).

The identity outcome is a closed table:

| State | Condition | Outcome |
|---|---|---|
| Not a work tree | No git root: no `.git`, or a `.git` file that is not a `gitdir:` pointer | The declared `unbound` scope, exit `0`, one warning, no registration |
| Git metadata unusable | A git root resolves but its git directories do not (an empty `gitdir:` value) | `repos.identity-unreadable`, exit `1` |
| Marker absent | A git root and common directory resolve, no marker exists | Mint once and use its key |
| Marker unreadable or inconsistent | The marker cannot be read, is not JSON, misses a field, or its key disagrees with its recorded basename and identifier | `repos.identity-unreadable`, exit `1`, naming the key and identifier when readable |
| Marker write fails | The marker cannot be created | `repos.state-unavailable`, exit `2`, naming the checkout root and the failing marker path |

The refusal is always about the **invoking** checkout and never names another
clone's state root. The table gives the flat surface's identities: the composition's
scope refusal classifies the same identity and state conditions under `repos.*`
for `repos list` and the `projects list --flat` alias, and under `projects.*` for
every other command, including the group surface.

## Host index

`<host root>/host-index.json` (schema `delivery.projects.host-index.v1`) is a
derived, revisioned cache: not a state record, never authoritative, rebuildable
from checkouts. Each entry records `projectKey`, `projectIdentifier`, `root`, the
derived `stateLocation`, and `lastWrittenAt`. The index holds at most 2 000
entries and keeps them in clone-identity order (the delivered `projectKey`
field); entries beyond the bound are dropped
from the document, never merged into another entry. The index is discovered from
use, never by a filesystem crawl.

The board consumes this index as one input to its managed set: `--all` and
`--project` read it once, union its live recorded checkouts with the bound
invoking checkout, and bound the included set to 128 repositories with the
overflow counted. The board belongs to the read-only `maintainsIndex` exception
set, so a board run never maintains, prunes, or re-registers the index
([Board](feature-board.md)).

Maintenance runs at most once per store-opening invocation whose scope resolves
inside a checkout: exactly one index read and at most one write. The fold upserts
the invoking checkout's entry, prunes only entries that are provably dead (the recorded
root is absent, or that root's marker now resolves to a different identifier),
leaves uncertain entries, always re-derives every state location from its key,
and reports a disagreement as a warning that never redirects a read. Content that
did not change produces zero writes and no revision advance.

Absent is not corrupt: no index means no registered project, an empty list,
revision `0`, and exit success. A present but unreadable or unparsable index is
corruption for a read and is replaced by maintenance, which preserves the corrupt
bytes once as a timestamped sibling.

**Collision guard.** If registration finds the minted key already held under a
different project identifier, the index keeps the existing entry unchanged and
advances no revision; the colliding invocation warns once and reports
`projects.state-unavailable` at exit `2` naming its own checkout root, its key,
and the conflicting identifier. It never adopts that state root.

## `repos list` contract

- **Verb.** `list` only. Any other verb is refused through the shared invocation
  classification at exit `1` before the index is read.
- **Envelope.** `data` carries exactly `repos` and `hostIndexRevision`; each entry
  carries exactly `repoKey`, `root`, `stateLocation`, `daemonReachable`
  (`{ reachable }` or `{ reachable: false, reason }`), `handoverState`,
  `reversible`, and `handoverGate`. Entries are ordered by `repoKey`. No new
  top-level envelope key exists. The payload's `repoKey` is the checkout's clone
  identity: the host index keeps the field name `projectKey`, and the record's
  contract name is `repoKey` — both delivered names denote the clone identity
  until the mechanical rename (GH-408).
- **Gate block.** `reversible` is `true` exactly when the row's own repository's
  latest folded handover operation is `authoritative` (the same rule the authority
  document applies to `reversalAvailable`). `handoverGate` carries `verdict`
  (`eligible`, `ineligible`, `unverifiable`), the four ordered `conditions`
  (`truth`, `coverage`, `floor`, `corroboration`, each `{condition, status}` with
  `status` in `met | open`), `countedDeliveries`, `cleanDispatches`, and
  `truncation` only when the bounded read omitted records. The block is evaluated
  at read time, for every `ready` row, over one bounded attempts read plus one
  divergences read on the store the row pass already opened — no write, network
  call, model call, cache, or scheduler.
- **Repository binding.** The evaluation is bound to the row's own normalized
  `host/owner/name` identity, resolved read-only and non-persisting through the
  delivered identity policy (the persisted create-once binding recorded with that
  checkout's git common directory, otherwise the checkout's configured VCS
  remote). Records of another repository in the same store are excluded from
  `countedDeliveries`, `conditions`, and `cleanDispatches`. The row's handover
  fold is bound to the same resolved identity: `handoverState` and `reversible`
  are folded over that repository's handover records only, so a store that
  accumulated a second identity never reports another repository's authority as
  this row's.
- **Evidence scope.** The row folds the declared `production` scope (it counts
  `pilot` attempts), the same scope `dispatch dual-run summary --repo` and the
  handover decision use, so the row's `conditions` and `cleanDispatches` are
  comparable with the summary's over the same ledger. The `controlled` scope
  (which counts `controlled-proof`) stays available to controlled compositions and
  fixtures and is never the row's scope. No scope key, flag, or configuration
  member exists: the declaration is the delivered counting rule, not an input.
- **Degraded evidence.** An unreadable, torn, or malformed attempts/divergences
  ledger — and an unresolvable repository identity on a `ready` row — fails the
  whole read as `repos.state-unavailable` at exit `2` with no row and no binding
  written. A truncated attempts read is not a failure: the row reports
  `verdict: "unverifiable"` with the `truncation` object over the visible window at
  exit `0`. A `first-use` row reports the empty-window evaluation (`ineligible`;
  `truth` met, `corroboration` met vacuously, `coverage` and `floor` open;
  `countedDeliveries: 0`, `cleanDispatches: 0`, `reversible: false`) without
  opening a store and without reading a record. That block is the one production
  derivation over an empty window — the same fold, evaluation, and status
  projection the ready rows, the summary, and the handover decision use — so a
  gate-rule change moves it exactly as it moves those surfaces.
- **Text.** A deterministic table with the columns `clone`, `root`, `state`,
  `daemon`, `handover`, sorted by clone identity. The five columns are unchanged: the
  gate detail is a JSON read, and the human per-condition view is the summary
  text. The `daemon` cell carries the reason token when unreachable, never a bare
  negative. Two runs over unchanged state are byte-identical.
- **Exit projection.** `0` produced; `1` refused (unknown verb, an unusable
  state-directory override, or the invoking checkout's identity cannot be
  read); `2` the host index, a project state location, or a row's gate
  evaluation (an unreadable evidence ledger or an unresolvable row identity)
  prevents an honest answer. No other code is produced by the family.
- **Read-only.** No maintenance, no prune, no corrupt-file replacement, no
  project-root creation, no migration, and no index or store-content write.
  Exactly two side effects are permitted: the create-once clone identity marker
  minted inside the invoking checkout's git common directory when it is absent (the same
  write every composed command performs), and the removal of a leftover `*.tmp`
  store sibling by the store handle opened read-only to read handover evidence.
  Neither can create, change, or prune an index entry, a phase document, a queue
  record, or any other store content, so the host index and every `projects/`
  entry keep their bytes, modes, and mtimes apart from that removed temp file.

The `dispatch attempts` read is also read-only with respect to delivery evidence:
it appends no attempt, divergence, handover, or authority record and acquires no
fence, and it inherits exactly the store-opening effects above — the host-index
maintenance write (zero when unchanged) and the create-once clone identity
marker. The dispatch repository binding marker
(`dispatch-identity.json` in the git common directory) is a different artefact
and is never created, repaired, or re-persisted by a read.

The four state-location outcomes and the handover and daemon projections below
describe this read.

### The `projects list --flat` alias

`projects list --flat [--json]` serves the delivered `projects.v1` payload
unchanged — `data.projects[]` with `projectKey`, `root`, `stateLocation`,
`daemonReachable`, and `handoverState`, plus `hostIndexRevision` — so a consumer
written against the earlier flat payload keeps working while it moves to
`repos list`. The payload is byte-compatible, absence negatives included: it
carries no `repoKey`, no `groupKey`, and no `data.groups[]` or `data.repos[]`.
The alias is the flat surface under the `projects` token, so its failures
classify under the `repos.*` identities on every form, and it takes no group
scoping. The alias retires at the M3 boundary
([ODR-0004](../../decisions/ODR-0004-flat-record-set-rename-projects-to-repos.md)).

## Handover projection

`handoverState` is folded from delivered evidence only:

| Folded latest handover operation | Derived authority document | Reported |
|---|---|---|
| `authoritative` | `authoritative` | `engine` |
| `dual-run` | `dual-run`, absent, or malformed | `shell` |
| no record | any | `shell` (the documented safe default) |
| `authoritative` | absent, `dual-run`, or malformed | `in-transition` |
| `dual-run` | `authoritative` | `in-transition` |

`engine` is produced only on agreement and `in-transition` only on a detected
disagreement; a malformed document is distinct from an absent one. A present but
unreadable state root is a state failure, never a fabricated handover value. On
`repos list` the fold reads the row's own repository's records, bound to the
identity the row's gate block resolves, so a store holding a second identity can
never report another repository's authority as this row's; the
`projects list --flat` alias keeps the delivered payload and its delivered
cross-record fold.

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
| Unreadable root | Project root present but unreadable or not a directory | `repos.state-unavailable`, exit `2`, naming the clone identity (delivered field `projectKey`) and its state location |
| Uncreatable marker | The clone identity marker cannot be created | `repos.state-unavailable`, exit `2`, naming the checkout root and the failing marker path |

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
the inverse move restores the previous reads. The procedure, the main-checkout
choice, and the override caveat are documented in
[Migrating to Per-Repository Delivery State](../../guides/migrating-to-per-repository-state.md).
No automatic migration, migration command, or re-attribution exists.

## Related

- [Local Install and Prior-Identity Transition](../../../guides/local-install.md) — the operator-facing host-root transition and the declared divergences.

- [Project Groups](feature-project-groups.md) — the `projects` family: the
  configuration document, the group surface, and the group-scoped reads.
- [State Layer](feature-state-layer.md) — the store contract this surface scopes.
- [CLI Entrypoint](feature-cli-entrypoint.md) — the prompt-required set that
  carries `repos list` and `projects list`.
- [Branding Seam](feature-branding-seam.md) — `stateDirectoryName` naming the host
  root.
- [Audit Ledger](feature-audit-ledger.md) — the runtime-aware edge's audit store,
  opened at the project root.
- [Resident Dispatch Daemon](feature-resident-daemon.md) — the socket path derived
  from the project state root by the composing site.
- [Engine-first Delivery Operations](../../guides/engine-first-operations.md) — the
  operator routine that reads the `repos list` gate block and performs a
  per-repository flip or reversal.
- [Owner-Gate SLA](feature-owner-gate-sla.md) — the host-wide owner hold.
- [Board](feature-board.md) — the fleet read that consumes this host index,
  per-repository state scope, and the `unbound` scope.

### The post-move host index (GH-365)

`install migrate` moves the host state root byte-preservingly to `<home>/<brand.stateDirectoryName>` (`~/.jaiship-state`). `host-index.json` is a derived cache: a store-opening invocation re-derives every `stateLocation` from its key, and a stale `stateLocation` is reported as the delivered warning that never redirects a read — every reported location is under the new root and no read targets the prior root. The per-project group document `<repo>/<configDirectoryName>/projects.yaml` is an operator-local, git-ignored overlay, never a tracked or project-committed artifact.
