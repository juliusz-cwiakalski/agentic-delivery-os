---
change:
  ref: GH-309
  type: feat
  status: Proposed
  slug: project-groups
  title: "M2-S18: Project groups (M2)"
  owners: [Juliusz Ćwiąkalski]
  service: delivery-os
  labels: [milestone-m2, cli, projects, multi-repository, naming-boundary]
  version_impact: minor
  audience: mixed
  security_impact: low
  risk_level: medium
  dependencies:
    internal:
      - "GH-288 (M2-S11 multi-repository workstations — delivered, tracker-closed 2026-11-11)"
      - "Delivered config layer (GH-173; brand-derived <configDirectoryName>)"
      - "Delivered queue and status read surfaces (scoping extends them additively)"
      - "ODR-0003 CLI command naming v1 lock (DC-4 superseding-record rule)"
      - "Superseding decision record for the repos name (parallel artifact-phase deliverable via @decision-advisor; gates delivery)"
    external: []
  links:
    decisions: ["ODR-0003"]
---

# CHANGE SPECIFICATION

> **PURPOSE**: Make a project mean a configured group of repositories that belong together — declared in a validated configuration document, enumerable as groups with member health and state, and usable as a delivery-read scope — with an optional workspace directory as a discovery root, and deliver the planned naming boundary: `repos list` becomes the flat record set, `projects list` becomes the group surface, and `projects list --flat` keeps the delivered flat payload reachable as the deprecation alias until the M3 boundary.

## 1. SUMMARY

The delivered `projects list` surface (GH-288, M2-S11) is the flat record set of managed checkouts on the host. There is today no way to declare that repositories belong together as a project group, no group enumeration with member health and state, and no project-scoped delivery read. The documented naming boundary — `repos` names the flat record set and `projects` names groups — is planned but not delivered, and the ODR-0003 v1 command-name freeze (DC-4) requires a superseding decision record plus a code change before the rename may ship.

This change delivers: the project configuration document (`<configDirectoryName>/projects.yaml`, schema `delivery.projects.groups.v1`) declaring member repositories with per-member tracker kinds, validated at load time so an unreadable or contradictory configuration is a classified error and never a silently empty group; an optional workspace-directory discovery root whose scan only locates declared members and never admits an undeclared clone; `projects list` as the group surface under `project-groups.v1` with the project-scoped aggregation clause; the scoped-read grammar `queue list --project <groupKey>` and `status --project <groupKey>`; and the rename as S18 code work — `repos list` enumerates the flat record set under `repos.v1` (field renames `projectKey → repoKey`, `data.projects[] → data.repos[]`), while `projects list --flat` returns the delivered `projects.v1` payload unchanged as the deprecation alias, owned by this change and retired at the M3 boundary. A superseding decision record for the `repos` name (ODR-0003 DC-4) is a declared deliverable and a dependency of the delivery phase; it is authored via `@decision-advisor` as a parallel artifact-phase deliverable, not by this specification.

## 2. CONTEXT

### 2.1 Current State Snapshot

- **Delivered flat surface (GH-288, M2-S11; tracker-closed 2026-11-11).** Delivery state resolves as two layers: the host root and a per-repository project root `<host root>/projects/<project key>` minted once from the checkout identity marker (`project-identity.json` in the git common directory). A derived, revisioned host index (bounded at 2 000 entries, collision-guarded) is maintained only on store-opening invocations. The read-only `projects list [--json]` is the host overview: envelope `data` carries exactly `projects` and `hostIndexRevision`; each entry carries exactly `projectKey`, `root`, `stateLocation`, `daemonReachable` (`{ reachable }` or `{ reachable: false, reason }` with the closed reason vocabulary `daemon-not-mounted`, `state-absent`, `socket-absent`, `socket-unreachable`), and `handoverState` (`engine`, `shell`, `in-transition`). Exit projection: `0` produced, `1` refused, `2` the host index or a state location prevents an honest answer. Error identities are the delivered `projects.identity-unreadable` (exit 1), `projects.registry-corrupt` (exit 2), and `projects.state-unavailable` (exit 2). An invocation outside any git work tree uses the declared `unbound` scope and is never an error. Read-only holds: no index maintenance, no prune, exactly two permitted side effects (the create-once identity marker; removal of a leftover `*.tmp` store sibling by the read-only store handle).
- **Queue and status are repository-scoped.** Both reads resolve the invoking checkout's repository scope. No group scope exists; nothing can answer "what does this project have running, waiting, and parked" across member repositories.
- **Naming boundary: planned, not delivered.** The M2 contracts record the rename rule once — from M2-S18 `projects list` enumerates groups and `repos list` enumerates the flat record set, with the deprecation alias `projects list --flat` returning the delivered `projects.v1` payload and retiring at the M3 boundary. The command registry carries one delivered `projects` row (M2-S11, shipped in GH-288) and one prospective `repos` row marked Not delivered pending the superseding decision record and code change required by ODR-0003. The `repos` family is not registered at the root listing (nineteen families observed); the entrypoint delta plans `repos` as a root family owned by M2-S18.
- **ODR-0003 DC-4.** After M0, a rename of a locked command name requires a superseding decision record plus a code change; a documentation-only edit never renames a command. This is the gate the `repos` rename must satisfy.
- **M2 domain-model amendment (2026-11-11, planning state).** The domain model is three-level: a repository is one checkout and the delivery unit; a project group is a configured group of repositories whose membership is declared in configuration; a workspace is an optional discovery root that is never required. M2-S18 owns the rename and alias retirement, configuration-only membership, the scoped-read grammar, and the superseding decision record. `board --project` stays a repository key; the board is not group-scoped. M2-S4 depends on M2-S18.
- **Board status.** The board is not delivered: the command is defined in the edge composition but not composed by the production entrypoint; M2-S4 must mount it. The planned board page (Proposed) already names its repository list field `repositories[]` per the rename rule.
- **Delivered config layer (GH-173).** Configuration resolves through ranked layers including the project-committed layer `<repo>/<configDirectoryName>/config.yaml`; `<configDirectoryName>` is a brand-derived parameter supplied by the frozen brand identity, with no product name committed.
- **Migration guide.** The one-step, operator-run migration to per-repository state is documented in the existing migration guide; it predates the rename and still describes the flat surface under its delivered name.
- **Envelope continuity (delivered contract).** The machine envelope stays the delivered five-field `delivery.result.v1` shape (`schemaVersion`, `runId`, `exitCode`, `timing`, `data`, plus `error` on failure); new commands add keys under `data`, never new top-level keys, and no `ok` or `command` field exists on the envelope. Exit codes keep their meaning: `0` declared verdict, `1` refused or negative verdict, `2` platform, state, or provider failure.

### 2.2 Pain Points / Gaps

- **GAP-1**: No way to declare that repositories belong together — there is no project configuration document, no group identity, and no declared membership.
- **GAP-2**: No group enumeration — `projects list` shows only the flat record set; no surface renders groups with member repositories, their health, and their state.
- **GAP-3**: No project-scoped delivery reads — queue and status cannot be scoped to a group, so cross-repository questions require manual aggregation across checkouts.
- **GAP-4**: The documented naming boundary (`repos` = flat record set, `projects` = groups) is planned-only; the `projects` name still denotes the flat record set, and the registry's `repos` row is blocked by the ODR-0003 DC-4 superseding-record requirement.
- **GAP-5**: No optional workspace discovery — there is no way to register a directory so that declared member clones inside it are located for a group.
- **GAP-6**: The migration guide and the flat surface's field names (`projectKey`, `data.projects[]`) still speak the pre-rename vocabulary, which conflicts with the group vocabulary once the boundary lands.

## 3. PROBLEM STATEMENT

Because the delivered tooling cannot declare or enumerate project groups, cannot scope delivery reads per project, and still names the flat record set `projects`, operators and agents cannot express or observe that repositories belong together, cannot answer project-level delivery questions without manual cross-checkout work, and the documented naming boundary remains planned-only — with the rename additionally gated by ODR-0003 DC-4, which demands a superseding decision record plus a code change before any command name may move.

## 4. GOALS

- **G-1**: A project is a configured group of repositories: membership is declared in `<configDirectoryName>/projects.yaml` (schema `delivery.projects.groups.v1`), per member with a repository selector (`root` or `repoKey`) and a `trackerKind`, validated at load time, configuration-only.
- **G-2**: Groups are enumerable with member health and state: `projects list` renders every configured group with its members under `project-groups.v1`.
- **G-3**: Delivery reads scope per project: `queue list --project <groupKey>` and `status --project <groupKey>` use one defined aggregation clause for every group-scoped read.
- **G-4**: A workspace directory is an optional discovery root: registering it locates declared member clones inside it; it is never required, and a scan never admits an undeclared clone.
- **G-5**: The naming boundary is delivered as code: `repos list` enumerates the flat record set under `repos.v1` (with the field renames and the `repos.*` error identities), `projects list` enumerates groups, `projects list --flat` keeps the delivered payload reachable as the deprecation alias until the M3 boundary — under a superseding decision record per ODR-0003 DC-4 that exists before the registry row moves to Delivery.
- **G-6**: The permanent repository vocabulary is unchanged: the identity marker, the `<host root>/projects/<key>` container, the host index's `projects[]`/`projectKey` fields, and the `--project-root` flag keep denoting repository checkouts.

### 4.1 Success Metrics / KPIs

| Metric | Target |
|--------|--------|
| Ticket acceptance criteria demonstrated | 6 of 6 (AC1–AC6, mapped in Appendix B) |
| Undeclared clones admitted by any scan | 0 in every scenario (configuration-only membership holds absolutely) |
| Envelope conformance | 0 new top-level envelope keys; 0 occurrences of `ok` or `command` fields; every new key under `data` |
| Behavior parity with vs. without workspace | Identical members, health, and state (1:1), only `workspaceRoot` absent |
| Configuration failure handling | 100% of unreadable/contradictory configurations produce a classified error identity; 0 silent-empty outcomes |
| Registry compliance | `repos` row moves to Delivery only together with the code change and the superseding record; 0 documentation-only renames |
| Quality gates | `TMPDIR=$PWD/tmp/tmpdir pnpm check` green before the PR opens |

### 4.2 Non-Goals

- **NG-1**: No cross-repository changes mechanics — one lifecycle over member repositories, per-member branches and pull requests, shared definition of done, closeout across members (M2-S19).
- **NG-2**: No cross-repository queue-and-lane representation work (one queue entry per member, per-member release and removal rules, one lane per member entry) — contracts groundwork consumed at M2-S19 delivery; excluded because the ticket's canonical task list does not include it (DEC-4).
- **NG-3**: No group-scoped board — `board --project` stays a repository key, the board is never group-scoped, and no board surface change ships here (the board itself is M2-S4 and is not delivered).
- **NG-4**: No alias retirement — `projects list --flat` lives until the M3 boundary; this change does not retire it.
- **NG-5**: No new tracker adapter implementations — only GitHub is exercised initially; additional tracker kinds remain declaratively valid configuration and are classified `not-yet-supported` until their adapters land (M3-S3).
- **NG-6**: No current-truth feature-spec amendment by this specification — current-truth docs flip in phase 7 (system_spec_update) of the lifecycle; the spec describes post-delivery behavior as this change's scope (DEC-1).
- **NG-7**: No membership inference, automatic registration of undeclared clones, or automatic migration — membership is configuration-only; migration remains operator-run.
- **NG-8**: No change to the delivered two-layer state scope, host index mechanics, identity marker, or envelope shape — reused unchanged.

## 5. FUNCTIONAL CAPABILITIES

| ID | Capability | Rationale |
|----|------------|-----------|
| F-1 | Project configuration document (`delivery.projects.groups.v1`) | Group membership must be declarable, per member with a repository selector and tracker kind |
| F-2 | Load-time configuration validation with classified errors | An unreadable or contradictory configuration must never yield a silently empty group |
| F-3 | Optional workspace-directory discovery root | A registered directory locates declared member clones; it is a convenience, never a requirement |
| F-4 | Group enumeration surface (`projects list` → `project-groups.v1`) | The tooling must render configured groups with member health and state |
| F-5 | Project-scoped aggregation clause | One shared definition governs every group-scoped read's per-member outcomes and partial results |
| F-6 | Group-scoped queue and status reads | Delivery views must answer project-level questions (`queue list --project`, `status --project`) |
| F-7 | The rename: `repos list` (`repos.v1`), field renames, deprecation alias | The documented naming boundary must become delivered code, with the delivered payload kept reachable |
| F-8 | Naming boundary and permanent vocabulary preservation | `repos` = flat record set and `projects` = groups must hold everywhere; repository vocabulary stays permanent |
| F-9 | Entrypoint registration and migration-guide update | `repos` must be reachable at the root listing; the migration guide must speak the delivered vocabulary |
| F-10 | Superseding decision record (ODR-0003 DC-4) as a gated deliverable | The rename is lawful only with the superseding record plus the code change; the record gates delivery |

### 5.1 Capability Details

- **F-1 — Project configuration document.** The configuration document lives at `<configDirectoryName>/projects.yaml` — the brand-derived configuration directory of the delivered config layer, beside the delivered project-committed configuration file (DEC-6). Schema `delivery.projects.groups.v1`: `groups[]`, each group declaring `groupKey` (the group identity), `name` (its display name), an optional `workspaceRoot`, and `members[]`, where each member declares a repository selector (`root` or `repoKey`) plus a `trackerKind`. Any tracker adapter kind and mixed trackers remain valid configuration even if only GitHub is exercised initially; the tracker kind is per member, so an unimplemented kind narrows nothing — it is classified `not-yet-supported` at validation/read time, never rejected silently. Membership is configuration-only: it resolves from the declared members wherever their checkouts live.
- **F-2 — Load-time validation and classified errors.** Membership is validated at load time. An unreadable or contradictory configuration document (schema or content validation failure) is the classified configuration error `projects.config-invalid` — never a silently empty group. A requested group key that is not configured is `projects.unknown-group` at exit 1. A configuration document or invoking scope that cannot be read is `projects.scope-unavailable` at exit 2.
- **F-3 — Optional workspace discovery root.** A group may declare a `workspaceRoot`; registering that directory enables a scan that locates the group's **declared** member clones inside it. The workspace is never required: the same group configured with repositories in unrelated directories behaves identically, with only `workspaceRoot` absent. A scan only locates declared members and never admits an undeclared clone — configuration is the sole source of membership. The discovery root is distinct from the state layer's fixed `default` workspace identifier inside every per-checkout state root.
- **F-4 — Group enumeration surface.** `projects list [--json]` renders configured groups under `project-groups.v1`: `data.groups[]`, one entry per configured group, each carrying `groupKey`, `name`, the optional `workspaceRoot` (absent when none is configured), and `members[]` — one entry per declared member with `repoKey`, `root`, `trackerKind`, `state`, `health` (carrying the `not-yet-supported` classification when its tracker kind has no implemented adapter), and `daemonReachable` with the closed reason vocabulary `daemon-not-mounted`, `state-absent`, `socket-absent`, `socket-unreachable` (first applicable reason wins, in that order). Membership comes from configuration in declared order; the envelope never infers a member from a directory scan. `--project <groupKey>` scopes the read to one group. Text output renders a group block per group with one member line per repository (columns `group`, `member`, `tracker`, `state`, `health`, `daemon`).
- **F-5 — Project-scoped aggregation clause.** Defined once and applied to every group-scoped read: members come from configuration in declared order, and the state layer's own scope stays per-checkout — never a group-scoped store. Each member resolves to exactly one outcome of `observed`, `not-yet-supported`, `state-unavailable`, or `unregistered`. One `state-unavailable` member produces a classified partial result at exit 0: the envelope carries `data.partial` true and `data.degradedMembers[]`, each entry naming a degraded member by its `repoKey` and its outcome, while the readable members are still returned. A `not-yet-supported` member contributes no records and never fails the read. Exit 2 occurs only when the configuration document or the invoking scope cannot be read (`projects.scope-unavailable`).
- **F-6 — Group-scoped queue and status reads.** `queue list --project <groupKey>` and `status --project <groupKey>` answer what one group has running, waiting, and parked, applying the aggregation clause. Outside the `projects` family itself, only queue and status are group-scoped: `board --project` stays a repository key and is never group-scoped (no group-scoped board claim). An unknown group key is `projects.unknown-group` at exit 1.
- **F-7 — The rename (S18 code work).** `repos list [--json]` enumerates the flat record set under `repos.v1`: `data.repos[]` with `repoKey` (renamed from the delivered `projectKey`), `root`, `stateLocation`, `daemonReachable` (unchanged shape and closed reason vocabulary), and `handoverState`, plus `hostIndexRevision`; the deterministic text table is sorted by repo key; the `unbound`-scope rule is preserved. The flat surface's error identities move with the rename to the `repos.*` prefix (`repos.identity-unreadable` exit 1; `repos.registry-corrupt` and `repos.state-unavailable` exit 2) — the delivered `projects.*` identities are current truth until the rename lands, and this prefix change is declared S18 code work. `projects list --flat [--json]` is the deprecation alias defined by the rename rule: it returns the delivered `projects.v1` payload unchanged on success (`data.projects[]`, `projectKey`, `hostIndexRevision`), is owned by this change, and retires at the M3 boundary. After the rename, the alias's failure envelopes carry the moved `repos.*` error identities — the alias is the flat surface under the old token, so identities follow the surface, not the token. `projects list --json` without `--flat` returns `project-groups.v1`.
- **F-8 — Naming boundary and permanent vocabulary.** The boundary holds everywhere: `repos` is the flat record set of managed checkouts and `projects` groups it; the rename rule is stated once and referenced, not restated. The repository vocabulary is permanent: the identity marker, the `<host root>/projects/<key>` container, the host index's `projects[]` and `projectKey` fields, and the `--project-root` flag each denote a repository checkout and keep that meaning unless a code change renames them. The board's repository list field name (`repositories[]`) binds M2-S4's future delivery, not this change (DEC-3).
- **F-9 — Entrypoint registration and migration-guide update.** The `repos` family is registered at the root entry listing per the delivered mounting pattern (prompt-set entry, edge composition, help entries, and its reference page), so `repos` appears in root `--help` alongside `projects`. The per-repository state migration guide is updated to the delivered vocabulary (ticket derived task d) — the flat enumeration's delivered name and the group surface are both documented, and the guide keeps stating that migration is one-step and operator-run.
- **F-10 — Superseding decision record as a gated deliverable.** A superseding decision record for the `repos` name, satisfying ODR-0003 DC-4 (superseding record plus code change; a documentation-only edit never renames a command), is a declared deliverable of this change and a dependency of the delivery phase. It is authored via `@decision-advisor` as a parallel artifact-phase deliverable before delivery begins; this specification declares it and does not author it. The command registry's prospective `repos` row moves to Delivery only together with the delivered code change (DEC-2).

## 6. USER & SYSTEM FLOWS

```
Flow 1: Configure and discover a two-member group in one workspace (AC1)
  Owner writes <configDirectoryName>/projects.yaml declaring one group with
  two members (selectors + trackerKind) and a workspaceRoot
  → registers the directory → the scan locates the two declared clones
  → `projects list --json` returns project-groups.v1 with data.groups[]
    carrying both declared member repoKeys with state and health.

Flow 2: The same group without a workspace (AC2)
  Same group configured with members in unrelated directories, no workspaceRoot
  → the read behaves identically: same members, health, state; only
  `workspaceRoot` is absent. No scan runs; nothing is inferred from directories.

Flow 3: Group-scoped delivery read (AC4)
  `queue list --project <groupKey>` / `status --project <groupKey>`
  → aggregation resolves each member (observed | not-yet-supported |
    state-unavailable | unregistered) → only that group's work is returned
  → one state-unavailable member: exit 0, data.partial true,
    data.degradedMembers[] names it; readable members still returned
  → unknown group key: projects.unknown-group, exit 1.

Flow 4: The rename and the alias (AC6)
  `repos list --json`        → repos.v1: data.repos[] (repoKey, root,
                               stateLocation, daemonReachable, handoverState),
                               hostIndexRevision
  `projects list --json`     → project-groups.v1: data.groups[] (groupKey)
  `projects list --flat --json` → delivered projects.v1 unchanged
                               (data.projects[], projectKey,
                               hostIndexRevision) — alias until M3.

Flow 5: Mixed tracker kinds (AC5)
  Configuration declares members across tracker kinds, one without an
  implemented adapter → validation accepts the configuration; the read
  classifies that member health `not-yet-supported`, contributes no records
  for it, and never fails the read.
```

## 7. SCOPE & BOUNDARIES

### 7.1 In Scope

- The project configuration document: schema `delivery.projects.groups.v1` at `<configDirectoryName>/projects.yaml`, declared fields (`groups[]` with `groupKey`, `name`, optional `workspaceRoot`, `members[]` with a `root` or `repoKey` selector plus `trackerKind`), mixed tracker kinds valid, unimplemented kinds classified `not-yet-supported`.
- Load-time validation of the configuration with the classified error identities `projects.config-invalid`, `projects.unknown-group`, and `projects.scope-unavailable`.
- The optional workspace discovery root: registering a directory, scanning for declared member clones inside it, never required, never admitting an undeclared clone.
- `projects list` as the group surface under `project-groups.v1`, including `--project <groupKey>` scoping, member health and state, and the closed daemon-reachability reason vocabulary.
- The project-scoped aggregation clause (per-member outcome vocabulary, classified partial result with `data.partial` / `data.degradedMembers[]`, restricted exit 2) applied to every group-scoped read.
- The scoped-read grammar `queue list --project <groupKey>` and `status --project <groupKey>`.
- The rename as S18 code work: `repos list` under `repos.v1`, field renames `projectKey → repoKey` and `data.projects[] → data.repos[]` on the flat surface, the `repos.*` error identities on the flat surface, and the `projects list --flat` deprecation alias returning the delivered `projects.v1` payload unchanged.
- The naming boundary documented (`repos` = flat record set, `projects` = groups) with the permanent repository vocabulary preserved and the board resolution recorded (DEC-3).
- `repos` registration at the root entry listing (entrypoint delta) and carrying the flat surface's reference page.
- Update of the per-repository state migration guide to the delivered vocabulary (ticket derived task d).
- Declaration of the superseding decision record for the `repos` name as a deliverable and delivery-phase dependency (authored via `@decision-advisor`; the registry `repos` row moves to Delivery only with the code change) (ticket derived task f).
- Milestone bookkeeping per planning conventions: backlog progress markers, status snapshot, registry rows, milestone pack page statuses, entrypoint delta.

### 7.2 Out of Scope

- [OUT] Cross-repository changes mechanics: one lifecycle over member repositories, per-member branches/PRs, per-member review verdicts, shared definition of done, closeout across members (M2-S19).
- [OUT] The cross-repository queue-and-lane representation (one entry per member keyed by that member's ref, per-member release/removal rules, one lane per member entry) — contract groundwork consumed at M2-S19 delivery; excluded because the ticket's canonical task list does not include it (DEC-4, NG-2).
- [OUT] Any board surface change or the board field rename as code — the board is not delivered (M2-S4); the `repositories[]` field name binds M2-S4's future delivery; `board --project` stays a repository key (DEC-3, NG-3).
- [OUT] Retirement of the `projects list --flat` alias (M3 boundary, NG-4).
- [OUT] New tracker adapter implementations beyond the exercised GitHub kind (M3-S3, NG-5).
- [OUT] Amendment of current-truth feature specifications by this specification (phase 7 reconciles them; NG-6).
- [OUT] Changes to the delivered two-layer state scope, host index mechanics, identity marker, store layout, or envelope shape (NG-8).
- [OUT] Membership inference from scans, automatic registration, or automatic migration (NG-7).
- [OUT] Group-scoped reads beyond queue and status (spend, brief, and others stay repository-scoped).

### 7.3 Deferred / Maybe-Later

- Retirement of the `projects list --flat` alias at the M3 boundary (owned by the rename rule; a later change executes it).
- Cross-repository changes consuming the group surface and the queue-and-lane representation (M2-S19).
- The full cross-repository board mount and its `repositories[]` field (M2-S4; depends on M2-S18).
- Additional tracker adapters behind the primitive ports (M3-S3); multi-tracker federation stays a parked concept.
- Group-scoped variants of other read surfaces if a future story needs them.

## 8. INTERFACES & INTEGRATION CONTRACTS

### 8.1 REST / HTTP Endpoints

N/A — no HTTP surface is added or changed. The delivered surfaces are CLI commands; the daemon and its control protocol are untouched.

### 8.2 Events / Messages

N/A — no new event topics, kinds, or payload shapes. The delivered event taxonomy v1 is unchanged; group-scoped reads are read-side commands and emit no events.

### 8.3 Data Model Impact

| ID | Element | Description |
|----|---------|-------------|
| DM-1 | Project configuration document | `<configDirectoryName>/projects.yaml`, schema `delivery.projects.groups.v1`: `groups[]` each with `groupKey`, `name`, optional `workspaceRoot`, and `members[]`; each member declares a repository selector (`root` or `repoKey`) plus a `trackerKind`; configuration-only membership |
| DM-2 | Group envelope `project-groups.v1` | `data.groups[]` (one entry per configured group: `groupKey`, `name`, optional `workspaceRoot`, `members[]` with `repoKey`, `root`, `trackerKind`, `state`, `health`, `daemonReachable`), plus the aggregation keys `data.partial` and `data.degradedMembers[]` (each entry naming a member `repoKey` and its outcome) on group-scoped reads |
| DM-3 | Flat envelope `repos.v1` | `data.repos[]` (one entry per managed checkout: `repoKey`, `root`, `stateLocation`, `daemonReachable`, `handoverState`) plus `hostIndexRevision`; the flat surface's renamed record shape |
| DM-4 | Alias payload `projects.v1` | The delivered flat payload, returned unchanged by `projects list --flat`: `data.projects[]` with `projectKey`, plus `hostIndexRevision`; no group field, no group claim |
| DM-5 | Aggregation outcome vocabulary | Closed per-member outcome set for every group-scoped read: `observed`, `not-yet-supported`, `state-unavailable`, `unregistered`; the daemon-reachability degradation reasons stay the closed delivered vocabulary (`daemon-not-mounted`, `state-absent`, `socket-absent`, `socket-unreachable`) |

### 8.4 External Integrations

N/A — no external vendor or API integration is added. `trackerKind` is declarative configuration: only the GitHub kind is exercised initially through the delivered adapter; an unimplemented kind performs no external calls and is classified `not-yet-supported`.

### 8.5 Backward Compatibility

- **Alias keeps the delivered payload reachable.** `projects list --flat` returns the delivered `projects.v1` payload byte-compatibly until the M3 boundary, so consumers of the delivered flat surface keep working across the rename. The byte-compat guarantee covers success envelopes only: failure envelopes use the renamed `repos.*` identities (see Error identities below), and consumers matching on the old `projects.*` failure identities must update their matchers at the rename as part of the documented transition.
- **Default meaning changes.** After the rename, `projects list` (without `--flat`) returns groups instead of the flat record set. The alias is the compatibility path; the superseding decision record and the updated migration guide document the transition, and the registry row moves only with the code change.
- **Error identities.** The delivered `projects.*` identities on the flat surface move to the `repos.*` prefix with the rename code (declared S18 work); the group surface introduces `projects.config-invalid`, `projects.unknown-group`, and `projects.scope-unavailable`. Exit-code meaning is unchanged (`0`/`1`/`2`).
- **Permanent vocabulary.** The identity marker, the `<host root>/projects/<key>` container, the host index's `projects[]`/`projectKey` fields, and the `--project-root` flag keep their repository meaning — no data or state is renamed or rewritten.
- **Envelope continuity.** Every new envelope key lives under `data`; the five-field `delivery.result.v1` shape, the error taxonomy, and the state-layer validation rules are unchanged.

## 9. NON-FUNCTIONAL REQUIREMENTS (NFRs)

| ID | Requirement | Threshold |
|----|-------------|-----------|
| NFR-1 | Envelope continuity: every new or renamed key lives under `data`; the five-field `delivery.result.v1` shape is preserved | 0 new top-level envelope keys; 0 `ok` or `command` fields anywhere in the delivered envelopes |
| NFR-2 | Read-only preservation: group and flat reads write no index or store content | Exactly the two delivered permitted side effects (create-once identity marker; `*.tmp` sibling removal by the read-only store handle); 0 other writes |
| NFR-3 | Determinism: repeated reads over unchanged state are stable, and member order follows configuration | Two runs over unchanged state produce byte-identical text output; member order = configuration declared order, 100% of reads |
| NFR-4 | Membership containment: a scan locates declared members only | 0 undeclared clones admitted in any scenario; with and without a workspace, member resolution is identical (1:1 parity) |
| NFR-5 | Classification fidelity: configuration failures are never silent | 100% of unreadable/contradictory configurations produce `projects.config-invalid` (or `projects.scope-unavailable` when unreadable at exit-2 conditions); 0 silent-empty outcomes |
| NFR-6 | Quality gates for the delivering change | `TMPDIR=$PWD/tmp/tmpdir pnpm check` green before the PR opens (recorded per pm-notes conventions) |
| NFR-7 | Commit hygiene for the delivering change | Conventional commit subjects via the commit primitive; every commit body/footer line ≤100 characters |

## 10. TELEMETRY & OBSERVABILITY REQUIREMENTS

N/A — no new telemetry ships. Observability comes from the classified outcomes the surfaces already project: the closed error identities (`projects.config-invalid`, `projects.unknown-group`, `projects.scope-unavailable`, and the flat surface's moved `repos.*` identities), the closed daemon-reachability reason vocabulary, and the explicit per-member outcome vocabulary with `data.partial` / `data.degradedMembers[]` naming degraded members. Absence and degradation are always classified, never silent.

## 11. RISKS & MITIGATIONS

| ID | Risk | Impact | Probability | Mitigation | Residual Risk |
|----|------|--------|-------------|------------|---------------|
| RSK-1 | Rename breakage: scripts and operators relying on `projects list` meaning the flat record set receive groups after the rename | H | M | The `--flat` alias keeps the delivered payload reachable until the M3 boundary; the superseding record and the updated migration guide document the transition; the registry row moves only with the code change | Medium |
| RSK-2 | Sequencing failure: the registry `repos` row moves to Delivery without the superseding decision record | M | L | The record is a declared delivery-phase dependency (F-10, DEC-2); the DoR gate and review verify the record exists before delivery; ODR-0003 DC-4 is checked at review | Low |
| RSK-3 | Schema invention: configuration fields or vocabularies beyond the contracts drift into the implementation | M | L | The schema is contracts-verbatim (`delivery.projects.groups.v1` declared fields only); review cross-checks the envelope and schema against contracts.md; unresolved details are pinned via OQ-1/OQ-3 | Low |
| RSK-4 | Scan overreach: the workspace scan admits undeclared clones or writes to checkouts | H | L | Configuration-only membership is an absolute invariant (NFR-4, SC-M2-S18-06); reads stay read-only (NFR-2); the scenario seed asserts the negative case | Low |
| RSK-5 | Envelope drift: the pack's example snippets (`ok`/`command` fields) leak into the delivered envelopes | M | M | DEC-5 binds the delivered five-field `delivery.result.v1` shape over pack snippets; NFR-1/AC-NFR1-1 measure conformance; contract tests pin the shape | Low |
| RSK-6 | Scope creep into M2-S19: queue-and-lane representation or cross-repository change mechanics land here | M | M | Ticket is canonical; the exclusion is recorded (DEC-4, NG-2); reviewer checks the delivered scope against §7 | Low |
| RSK-7 | Aggregation ambiguity: partial-vs-failure semantics differ between group-scoped reads | M | L | The aggregation clause is defined once (F-5) and applied to every group-scoped read; the outcome vocabulary is closed (DM-5); SC-M2-S18-07 seeds the partial case | Low |

## 12. ASSUMPTIONS

- The delivered GH-288 baseline (two-layer state scope, identity marker, host index, `projects list` behavior) remains stable through this change; this change consumes it and does not rework it.
- The state layer's scope stays per-checkout; no group-scoped store is introduced anywhere.
- The delivered `projects.v1` payload is stable and can be returned unchanged by the `--flat` alias.
- The superseding decision record for the `repos` name is authored and lands during the artifact phases, before delivery begins.
- Only GitHub is exercised initially; other tracker kinds remain valid declarative configuration classified `not-yet-supported`.
- The board remains undelivered (M2-S4) through this change, so no board code rename is required here.
- `<configDirectoryName>` continues to be the brand-derived configuration directory name from the delivered config layer (DEC-6).
- The delivered five-field envelope shape and exit-code meaning are unchanged contract continuity.

## 13. DEPENDENCIES

| Direction | Item | Notes |
|-----------|------|-------|
| Depends on | GH-288 (M2-S11 multi-repository workstations) | **Delivered** — tracker-closed 2026-11-11; backlog records "delivered by GH-288". Dependency satisfied |
| Depends on | Delivered config layer (GH-173) | Supplies the brand-derived `<configDirectoryName>` the configuration document lives under (DEC-6) |
| Depends on | Delivered queue and status read surfaces | The scoped grammar extends them additively; their delivered envelopes and exit meanings are unchanged |
| Depends on | ODR-0003 (CLI command naming v1 lock), DC-4 | The rule the rename must satisfy: superseding record plus code change, never a documentation-only edit |
| Depends on (delivery gate) | Superseding decision record for the `repos` name | Authored via `@decision-advisor` as a parallel artifact-phase deliverable; must exist **before** the registry row moves to Delivery and before the rename code lands (DEC-2) |
| Related (consumers) | M2-S19 cross-repository changes | Formally depends on M2-S18; consumes the group surface and the scoped reads |
| Related (consumer) | M2-S4 full board | Depends on M2-S18 (domain-model amendment); its `repositories[]` field name binds its own future delivery (DEC-3) |
| Blocks | M2-S19 and M2-S4 | Per the M2 domain-model amendment dependency statements |

## 14. OPEN QUESTIONS

| ID | Question | Context | Status |
|----|----------|---------|--------|
| OQ-1 | What format and uniqueness constraints does `delivery.projects.groups.v1` enforce on `groupKey` (and on duplicate group declarations)? | The contracts name `groupKey` as the group identity but declare no format pattern (unlike the delivered `PROJECT_KEY_PATTERN` for repository keys); load-time schema/content validation under `projects.config-invalid` is the declared mechanism | Open — pin at plan authoring from the schema contract; proposed: non-empty, host-unique group keys, duplicates and self-contradictory member declarations are `projects.config-invalid`; no new public key pattern beyond what the schema defines |
| OQ-2 | How does `projects list` behave when `--flat` and `--project <groupKey>` are combined? | The pack defines three separate synopsis forms (plain, `--project`, `--flat`) and never the combination; AC6 exercises only `--flat --json` without `--project` | Open — pin at plan authoring; proposed: the alias returns the delivered flat payload and takes no group scoping, so the combination is refused as mutually exclusive at exit 1 unless the plan declares otherwise |
| OQ-3 | What is the member `health` value set on group entries? | The group contract requires member `health` and mandates the `not-yet-supported` classification for unimplemented tracker kinds, but declares no closed value set; the pack's example rendering shows `healthy` / `degraded` | Open — pin at plan authoring; proposed: a closed health vocabulary declared with the group contract, `not-yet-supported` mandatory for unimplemented tracker kinds, so contract tests can pin it like the delivered daemon-reason vocabulary |

## 15. DECISION LOG

| ID | Decision | Rationale | Date |
|----|----------|-----------|------|
| DEC-1 | The rename (command move, field renames, alias, `repos.*` error identities) is S18 code work described by this spec as post-delivery behavior; current-truth documentation flips only in phase 7 (system_spec_update), not by this specification | Binding PM decision recorded in pm-notes: the shipped `projects list` flat surface is pre-rename current truth by design; scope cross-check confirmed the rename rule is "not current truth" | 2026-11-14 |
| DEC-2 | The superseding decision record for the `repos` name is authored via `@decision-advisor` during the artifact phases, BEFORE delivery; this spec declares it a deliverable and delivery-phase dependency and does not author it; the registry `repos` row moves to Delivery only together with the code change | ODR-0003 DC-4 requires a superseding record plus a code change; pm-notes decision; keeps the freeze rule enforceable and the rename lawful | 2026-11-14 |
| DEC-3 | The board field rename (`repositories[]`) binds M2-S4's future delivery, not S18 code: the board is not delivered (edge-composed only, M2-S4 mounts it), and the planned board page already names the field `repositories[]`; S18's only board obligation is the naming-boundary statement that `board --project` stays a repository key and the board is never group-scoped | Resolution of the pm-notes open question, read from pack status (commands/board.md Proposed; entrypoint-delta "mounted by M2-S4"; status.md amendment point 4 and 6): there is no delivered board `projects[]` field for S18 to rename | 2026-11-14 |
| DEC-4 | The contracts' "Queue and lane representation" section (one entry per member, per-member release/removal, one lane per member entry) is excluded from S18 scope | The ticket is canonical and its task list does not include it; the section is contract groundwork for cross-repository changes consumed at M2-S19 delivery; S18 delivers the group surface and the scoped reads only | 2026-11-14 |
| DEC-5 | Envelope continuity wins over pack example snippets: the delivered envelopes use the five-field `delivery.result.v1` shape with keys under `data`; no `ok` or `command` top-level field exists, notwithstanding the pack's example JSON | contracts.md shared continuity states the delivered envelope shape explicitly and says no `ok`/`command` field exists; examples are illustrative, contracts are normative | 2026-11-14 |
| DEC-6 | `<configDirectoryName>` is the delivered brand-derived configuration directory name (config layer, GH-173); the project configuration document sits beside the delivered project-committed configuration file in that directory; no product name is committed | Reconciles the pack's `<configDirectoryName>` placeholder with delivered current truth; the config layer already defines the parameter via the frozen brand identity | 2026-11-14 |
| DEC-7 | Delivery runs the full 11-phase lifecycle in interactive mode per pm-notes: plan phases declared in the plan, commits through the commit primitive (conventional subjects, every body/footer line ≤100 chars), `TMPDIR=$PWD/tmp/tmpdir pnpm check` green before the PR, PR targets `main-tools` and stops open; dependency M2-S11 is satisfied (GH-288 closed 2026-11-11) | Ticket delivery conventions and pm-notes; the repo is in the tooling transition (`main` is the frozen public baseline) | 2026-11-14 |

## 16. AFFECTED COMPONENTS (HIGH-LEVEL)

| Component | Impact |
|-----------|--------|
| `projects` CLI family | Extended — `projects list` becomes the group surface (`project-groups.v1`) with `--project <groupKey>`; gains `--flat` as the deprecation alias; new configuration load and validation |
| `repos` CLI family | New root family — the flat record set (`repos.v1`) with the renamed record fields and `repos.*` error identities; registered at the root entry listing |
| `queue` CLI family | Extended additively — `queue list --project <groupKey>` group scoping via the aggregation clause |
| `status` CLI family | Extended additively — `status --project <groupKey>` group scoping via the aggregation clause |
| Project configuration schema | New — `delivery.projects.groups.v1` document under the delivered brand-derived configuration directory |
| CLI entrypoint (prompt set, root listing, help) | Extended — `repos` prompt-set entry, composition, help entries, and reference page per the delivered mounting pattern |
| Command registry (planning area) | Updated — the prospective `repos` row moves to Delivery together with the code change and the superseding record; the `projects` row reflects the group surface |
| Decision record (new, via `@decision-advisor`) | New — the superseding decision record for the `repos` name satisfying ODR-0003 DC-4 |
| Migration guide (per-repository state) | Updated — the delivered vocabulary (renamed flat surface, group surface, alias) replaces the pre-rename naming |
| Current-truth feature specs (projects, CLI entrypoint) | Reconciled in phase 7 (system_spec_update) — not amended by this specification (DEC-1, NG-6) |
| Milestone planning pack (backlog, status, M2 pages, entrypoint delta) | Maintained per milestone conventions at delivery |
| State layer, host index, identity marker, daemon, event taxonomy | **Unchanged** — consumed as delivered; no group-scoped store, no new topics |

## 17. ACCEPTANCE CRITERIA

**Configuration and membership**

| ID | Criterion | Linked |
|----|-----------|--------|
| AC-F1-1 | **Given** a configuration mixing tracker kinds where one member's tracker kind has no implemented adapter, **when** the configuration is validated and `projects list --json` runs, **then** the configuration is accepted, the unimplemented member is classified `not-yet-supported` in `data.groups[].members[].health`, contributes no records, and the read does not fail (ticket AC5; scenario seed SC-M2-S18-05 inherited, not restated) | F-1, F-2, F-4, DM-1, DM-5 |
| AC-F2-1 | **Given** an unreadable or self-contradictory configuration document, **when** any group-scoped read loads it, **then** the failure is the classified error `projects.config-invalid` (or `projects.scope-unavailable` at exit 2 when the document or the invoking scope cannot be read) — never a silently empty group; and **given** a requested group key that is not configured, **when** a scoped read runs, **then** it is refused with `projects.unknown-group` at exit 1 | F-2, F-5, NFR-5 |
| AC-F3-1 | **Given** the same two-member group configured with repositories in unrelated directories and no `workspaceRoot`, **when** `projects list --project <groupKey> --json` runs, **then** the same members, health, and state appear as in the registered case, and only `workspaceRoot` is absent (ticket AC2; scenario seed SC-M2-S18-02 inherited, not restated) | F-3, F-4, DM-2, NFR-4 |
| AC-F3-2 | **Given** a group whose `workspaceRoot` contains a managed clone that its configuration does not declare, **when** `projects list --json` runs, **then** the undeclared clone is not a member: `data.groups[].members[]` lists only declared members (scenario seed SC-M2-S18-06 inherited, not restated) | F-3, F-4, NFR-4 |

**Group surface and aggregation**

| ID | Criterion | Linked |
|----|-----------|--------|
| AC-F4-1 | **Given** a group whose configuration names two member repositories cloned inside one directory, **when** that directory is registered as the `workspaceRoot` and `projects list --json` runs, **then** both declared members appear under the group in `data.groups[]` with their `repoKey` values (ticket AC1; scenario seed SC-M2-S18-01 inherited, not restated) | F-3, F-4, DM-2 |
| AC-F4-2 | **Given** a group whose member checkouts differ in daemon reachability, **when** `projects list --json` runs, **then** the group shows both members with their state, and every member entry carries `health` and `daemonReachable` with a closed degradation reason when unreachable (ticket AC3; scenario seed SC-M2-S18-03 inherited, not restated) | F-4, DM-2, DM-5 |
| AC-F5-1 | **Given** one member whose per-repository state is `state-unavailable` and one readable member, **when** a group-scoped read runs, **then** it returns the readable members with a classified partial result at exit 0, `data.partial` true, and `data.degradedMembers[]` naming the degraded member by `repoKey` and outcome (scenario seed SC-M2-S18-07 inherited, not restated) | F-5, DM-2, DM-5 |

**Scoped reads**

| ID | Criterion | Linked |
|----|-----------|--------|
| AC-F6-1 | **Given** a configured group with running, waiting, and parked work, **when** `queue list --project <groupKey>` and `status --project <groupKey>` run, **then** both reads return only that group's work, both exit 0, and no non-member repository's envelope is read (ticket AC4; scenario seed SC-M2-S18-04 inherited, not restated) | F-5, F-6, DM-5 |

**Rename and compatibility**

| ID | Criterion | Linked |
|----|-----------|--------|
| AC-F7-1 | **Given** the rename has landed, **when** `projects list --flat --json` and `projects list --json` run, **then** the alias returns the delivered `projects.v1` payload with `data.projects[]`, `projectKey`, and `hostIndexRevision`, while the default returns `project-groups.v1` with `data.groups[]` and `groupKey` (ticket AC6; scenario seed SC-M2-S18-08 inherited, not restated) | F-4, F-7, DM-2, DM-3, DM-4 |
| AC-F7-2 | **Given** a host with managed checkouts, **when** `repos list --json` runs, **then** it returns `repos.v1` with `data.repos[]` carrying exactly `repoKey`, `root`, `stateLocation`, `daemonReachable`, and `handoverState`, plus `hostIndexRevision`, the text table sorted by repo key, the `unbound`-scope rule preserved, and the flat surface's errors classified under the `repos.*` identities | F-7, DM-3, NFR-3 |
| AC-F8-1 | **Given** the delivered surfaces and documentation, **when** the naming boundary is inspected, **then** `repos` names the flat record set everywhere, `projects` names groups, `board --project` remains a repository key with no group-scoped board claim, and the permanent repository vocabulary (identity marker, `<host root>/projects/<key>` container, host index `projects[]`/`projectKey`, `--project-root`) is unchanged | F-8, NG-3 |

**Registration, gating, and quality**

| ID | Criterion | Linked |
|----|-----------|--------|
| AC-F9-1 | **Given** the delivered entrypoint, **when** root `--help` runs, **then** `repos` appears as a registered root family with its help and reference page, and the migration guide speaks the delivered vocabulary (renamed flat surface, group surface, alias) | F-9, F-8 |
| AC-F10-1 | **Given** the artifact phases, **when** delivery begins, **then** the superseding decision record for the `repos` name exists (authored via `@decision-advisor`), and the registry `repos` row moves to Delivery only together with the rename code change | F-10, NFR-6 |
| AC-NFR1-1 | **Given** every delivered envelope of this change, **when** envelopes are inspected or contract-tested, **then** each uses the five-field `delivery.result.v1` shape with all new keys under `data`, and no `ok` or `command` top-level field exists | NFR-1, DM-2, DM-3, DM-4 |
| AC-NFR2-1 | **Given** any group or flat read, **when** its writes are audited, **then** it performs no index maintenance, no prune, and no store-content write, and exhibits exactly the two delivered permitted side effects | NFR-2, F-4, F-7 |
| AC-NFR6-1 | **Given** the delivering change, **when** quality gates run before the PR opens, **then** `TMPDIR=$PWD/tmp/tmpdir pnpm check` is green | NFR-6 |

### 17.1 Definition of Done (change-specific)

This change is done when every condition below holds. Each condition binds the §17 acceptance criteria to a concrete, checkable outcome, names its verification method, and is proven in the delivering plan phase of `chg-GH-309-plan.yaml` that owns the capability (the plan maps conditions to its declared phases). The change-specific DoD is the post-implementation acceptance gate (`dod_check`): `@reviewer` audits the implementation against it, then `@pm` confirms the full checklist before PR creation. This specification claims no passing evidence and no acceptance; the conditions define what must be proven. Two framing rules, both binding:

1. **Pre-delivery gate.** Per F-10 and DEC-2, no rename code lands before the superseding decision record exists; a delivery phase that starts without it fails this DoD.
2. **Current-truth boundary.** Per DEC-1/NG-6, this change's scope claim describes post-delivery behavior; current-truth feature specs flip in phase 7, and their presence in the delivery diff as pre-flipped would fail review, not pass it.

| # | Done condition | Binds | Verification (test / evidence) | Proven in plan |
|---|---|---|---|---|
| DoD-1 | The configuration document loads per `delivery.projects.groups.v1`: declared fields only (`groups[]`, `groupKey`, `name`, optional `workspaceRoot`, `members[]` with `root`/`repoKey` selector + `trackerKind`), at the delivered brand-derived configuration directory | F-1, DM-1, AC-F1-1 | Configuration schema/content tests green; OQ-1 resolution recorded | Configuration phase |
| DoD-2 | Load-time validation classifies: contradictory/unreadable → `projects.config-invalid`; unknown group → `projects.unknown-group` exit 1; unreadable document or scope → `projects.scope-unavailable` exit 2; zero silent-empty outcomes | F-2, AC-F2-1, NFR-5 | Negative-path tests green (each identity asserted) | Configuration phase |
| DoD-3 | Workspace discovery: registering a directory locates the declared members inside it; the same group without a workspace reads identically; an undeclared clone inside the workspace is never admitted | F-3, AC-F4-1, AC-F3-1, AC-F3-2, NFR-4 | SC-M2-S18-01/02/06 coverage green | Discovery phase |
| DoD-4 | `projects list` renders groups under `project-groups.v1`: `data.groups[]` with `groupKey`, `name`, optional `workspaceRoot`, `members[]` (`repoKey`, `root`, `trackerKind`, `state`, `health` incl. `not-yet-supported`, `daemonReachable` with closed reasons); membership in declared order; text rendering deterministic | F-4, AC-F4-2, NFR-3 | Envelope contract tests and determinism checks green; SC-M2-S18-03 green | Group-surface phase |
| DoD-5 | Mixed tracker kinds are accepted at validation; the unimplemented member is classified `not-yet-supported`, contributes no records, and never fails the read | F-1, F-5, AC-F1-1 | SC-M2-S18-05 green | Group-surface phase |
| DoD-6 | The aggregation clause governs every group-scoped read: closed outcome vocabulary, one degraded member → exit 0 with `data.partial` true and `data.degradedMembers[]`, readable members still returned; exit 2 only for unreadable configuration/scope | F-5, AC-F5-1, AC-F2-1 | SC-M2-S18-07 green; aggregation unit tests green | Aggregation/scoped-read phase |
| DoD-7 | `queue list --project <groupKey>` and `status --project <groupKey>` return only the scoped group's work at exit 0; `board` remains repository-keyed with no group scope shipped | F-6, AC-F6-1, NG-3 | SC-M2-S18-04 green; changed-surface check shows no board change | Aggregation/scoped-read phase |
| DoD-8 | The rename holds: `repos list --json` returns `repos.v1` with the renamed fields and `hostIndexRevision`; `projects list --flat --json` returns the delivered `projects.v1` payload unchanged; `projects list --json` returns `project-groups.v1`; flat-surface errors carry the `repos.*` identities | F-7, AC-F7-1, AC-F7-2 | SC-M2-S18-08 green; alias byte-compat check against the delivered payload shape; alias failure probe green — an alias invocation under a corrupt-registry/unreadable-state fixture asserts the moved `repos.*` identity and its exit code | Rename phase |
| DoD-9 | The naming boundary is consistent across surfaces: `repos` = flat record set, `projects` = groups; permanent repository vocabulary unchanged | F-8, AC-F8-1 | Documentation and help-text review against the rename rule | Rename/docs phase |
| DoD-10 | `repos` is registered at the root listing (prompt-set entry, composition, help entries, reference page) and the migration guide is updated to the delivered vocabulary | F-9, AC-F9-1 | Root `--help` snapshot test; guide review | Registration/docs phase |
| DoD-11 | The superseding decision record for the `repos` name exists in the decision register before any rename code lands, and the registry `repos` row moves to Delivery together with the code change | F-10, AC-F10-1, DEC-2 | Decision-register inspection; commit-order review | Artifact phases; verified at delivery gate |
| DoD-12 | Envelope conformance: every delivered envelope of this change uses the five-field shape, all new keys under `data`, zero `ok`/`command` fields | NFR-1, AC-NFR1-1, DEC-5 | Contract tests pinning the envelope shape green | Group-surface and rename phases |
| DoD-13 | Read-only preservation: group and flat reads exhibit exactly the two delivered permitted side effects and no other write | NFR-2, AC-NFR2-1 | Read-only audit tests green | Group-surface and rename phases |
| DoD-14 | Scope conformance: the delivered diff contains no M2-S19 mechanics, no queue-and-lane representation, no board change, no alias retirement, no new tracker adapter | §7.2, NG-1..NG-8, DEC-3, DEC-4 | Review-time changed-scope check against §7 | Every delivery phase's gate |
| DoD-15 | Full acceptance coverage: all sixteen §17 acceptance criteria green — AC-F1-1, AC-F2-1, AC-F3-1, AC-F3-2, AC-F4-1, AC-F4-2, AC-F5-1, AC-F6-1, AC-F7-1, AC-F7-2, AC-F8-1, AC-F9-1, AC-F10-1, AC-NFR1-1, AC-NFR2-1, AC-NFR6-1 — with no uncovered criterion and no orphan test | §17, NFR-1..NFR-7 | Test plan coverage matrix all Covered; execution evidence in phase pm-notes | Per-phase, roll-up at the final delivery phase |
| DoD-16 | The full gate battery is green at the delivered HEAD: `TMPDIR=$PWD/tmp/tmpdir pnpm check` before the PR opens | NFR-6, AC-NFR6-1 | Gate run recorded in pm-notes `notes:` | Final delivery phase / quality_gates |
| DoD-17 | PR posture: a pull request is created against `main-tools` and left open for human review with required CI green on the pushed HEAD; merge and owner acceptance remain external and are not claimed by this specification | §18, DEC-7 | PR record attached to the change | Lifecycle phase 11 |

A condition without passing evidence is not done; `dod_check` reopens the owning plan phase rather than waiving a row.

## 18. ROLLOUT & CHANGE MANAGEMENT (HIGH-LEVEL)

- **Delivery**: full 11-phase lifecycle in interactive mode on a feature branch created from `main-tools`; the PR targets `main-tools` (repo in the tooling transition; `main` is the frozen public baseline) and stops open for human review. Commits go through the commit primitive with conventional subjects and every body/footer line ≤100 characters; `TMPDIR=$PWD/tmp/tmpdir pnpm check` is green before the PR opens (DEC-7).
- **Artifact-phase gate**: the superseding decision record for the `repos` name lands during the artifact phases (authored via `@decision-advisor`) and precedes all rename code; the registry `repos` row moves to Delivery only together with the code change (DEC-2).
- **Adoption**: operators gain the group surface by writing the configuration document — opt-in, no automatic behavior change for unconfigured hosts (an empty or absent configuration yields a valid empty group listing). Consumers of the delivered flat surface migrate at their own pace via `projects list --flat`, which stays until the M3 boundary.
- **Communication**: milestone bookkeeping via the OSS-tooling backlog progress markers, the status snapshot, the registry rows, and the milestone pack page statuses per planning conventions; the superseding decision record documents the rename rationale for the public surface.
- **Rollback**: revert-safe — the delivered payloads are additive surfaces over unchanged state; a revert restores the pre-rename behavior (`projects list` returns the flat payload again), and configured `projects.yaml` files are inert data with no migration to undo.

## 19. DATA MIGRATION / SEEDING (IF APPLICABLE)

No data migration and no seeding. The configuration document is opt-in project-committed data; groups exist only where configured, and an absent or empty configuration is valid (empty group listing, exit 0). No state file, index entry, or store layout is renamed, rewritten, or moved by this change; the rename is a surface and vocabulary change only. The migration guide update is documentation: the delivered one-step, operator-run migration procedure is unchanged, only its naming of the surfaces is refreshed.

## 20. PRIVACY / COMPLIANCE REVIEW

Low impact. The configuration document may contain local filesystem paths (member `root` selectors, `workspaceRoot`) and stays local under the project-committed configuration directory; it is never transmitted. No secrets, credentials, or personal data flows are introduced; no new network surface exists (unimplemented tracker kinds make no calls). The delivered read-only and audit disciplines are unchanged.

## 21. SECURITY REVIEW HIGHLIGHTS

- **Membership containment is the security-relevant invariant**: a directory scan never admits an undeclared clone, so a workspace registration cannot enlarge a group beyond its declared configuration (NFR-4, RSK-4).
- **Fail-closed configuration**: an unreadable or contradictory configuration is a classified error, never a silently empty group — a degraded read cannot masquerade as a healthy empty project (NFR-5).
- **Read-only preservation**: group and flat reads keep the delivered write discipline — exactly the two permitted side effects, nothing else (NFR-2).
- **No new trust boundaries**: no new credentials, sockets, or external surfaces; the tracker kind is declarative and unimplemented kinds perform no external calls.
- **Naming-governance compliance**: the rename is lawful only under the ODR-0003 DC-4 superseding record plus code change — enforced as a delivery gate (F-10, DEC-2), preventing a documentation-only rename.

## 22. MAINTENANCE & OPERATIONS IMPACT

- **Two reference surfaces**: `repos` (flat record set) and `projects` (groups) each carry their reference page; future documentation must respect the naming boundary, and the rename rule remains the single statement of the transition.
- **Alias lifecycle**: `projects list --flat` is owned by this change and retires at the M3 boundary — the retirement is a tracked obligation for a later change, not an option left open here.
- **Naming governance**: the superseding decision record governs the `repos` name; any further command-name movement repeats the ODR-0003 DC-4 cost (record plus code change).
- **Configuration upkeep**: `delivery.projects.groups.v1` is a versioned schema; future member or group fields evolve additively through schema versions, with load-time validation the standing guard.
- **Board inheritance**: M2-S4 inherits the `repositories[]` field name and the never-group-scoped rule from the rename rule (DEC-3); its delivery must not re-litigate the boundary.
- **Planning corpus**: backlog progress markers, status snapshot, registry rows, and milestone pack page statuses are maintained per milestone conventions at delivery.

## 23. GLOSSARY

| Term | Definition |
|------|------------|
| Project (group) | A configured group of repositories that belong together; membership is declared in configuration, never inferred |
| Group key (`groupKey`) | The identity of a configured group in the configuration document and the group envelope |
| Repo key (`repoKey`) | The stable key derived from a checkout's identity marker; the flat surface's renamed record identity (delivered as `projectKey`) |
| Member | One repository declared in a group's `members[]`, with a selector (`root` or `repoKey`) and a `trackerKind` |
| Workspace root (`workspaceRoot`) | The optional discovery root of a group; registering it locates declared member clones inside; never required |
| Project configuration document | `<configDirectoryName>/projects.yaml`, schema `delivery.projects.groups.v1`, declaring groups and their members |
| `project-groups.v1` | The group contract: `data.groups[]` with `groupKey`, `name`, optional `workspaceRoot`, `members[]` |
| `repos.v1` | The flat record set contract: `data.repos[]` with `repoKey`, `root`, `stateLocation`, `daemonReachable`, `handoverState`, plus `hostIndexRevision` |
| `projects.v1` | The delivered flat payload (`data.projects[]`, `projectKey`, `hostIndexRevision`), returned unchanged by the alias |
| Rename rule | The single statement of the naming transition: from M2-S18 `projects list` enumerates groups, `repos list` the flat record set, `projects list --flat` the deprecation alias until the M3 boundary |
| Deprecation alias | `projects list --flat` — keeps the delivered flat payload reachable until the M3 boundary |
| Superseding decision record | The decision record required by ODR-0003 DC-4 before a locked command name may rename; paired with a code change |
| Project-scoped aggregation | The single clause governing every group-scoped read: per-member outcomes, classified partial results, restricted exit 2 |
| Per-member outcomes | The closed vocabulary `observed`, `not-yet-supported`, `state-unavailable`, `unregistered` |
| Partial result | A classified exit-0 outcome with `data.partial` true and `data.degradedMembers[]` naming degraded members, readable members still returned |
| `not-yet-supported` | The classification of a member whose declared tracker kind has no implemented adapter; contributes no records, never fails a read |
| Permanent repository vocabulary | The identity marker, `<host root>/projects/<key>` container, host index `projects[]`/`projectKey` fields, and `--project-root` flag — always denoting a repository checkout |
| Unbound scope | The declared scope of an invocation outside any git work tree: one bounded warning, never an error, never a listed row |
| Host index | The derived, revisioned, bounded host-level cache of managed checkouts; discovered from use, never by a filesystem crawl |

## 24. APPENDICES

### Appendix A — Planning open-point resolutions

| # | Open point (from planning) | Resolution | Where |
|---|----------------------------|------------|-------|
| 1 | Board field rename (`projects[]` → `repositories[]` per the contracts rename rule) — does it bind S18 code or only M2-S4's future delivery? | **Binds M2-S4's future delivery, not S18 code.** The board is not delivered (edge-composed only; M2-S4 mounts it per the entrypoint delta and the status snapshot), so no delivered board `projects[]` field exists for S18 to rename; the planned board page (Proposed) already names the field `repositories[]`. S18's only board obligation is the naming-boundary statement: `board --project` stays a repository key, the board is never group-scoped | DEC-3, F-8, NG-3, AC-F8-1 |
| 2 | contracts.md "Queue and lane representation" says "Owned by M2-S18 for cross-repository changes" but the ticket's canonical task list does not include it | **Excluded from S18 scope.** The ticket is canonical; the section is contract groundwork for cross-repository changes and is consumed at M2-S19 delivery. S18 delivers the group surface and the scoped reads only | DEC-4, NG-2, §7.2 |
| 3 | Pack example envelopes show `"ok": true, "command": ...`; contracts.md shared continuity says the envelope is the delivered five-field shape with no `ok` or `command` field | **The delivered envelope shape wins.** The spec follows contract continuity over pack example snippets: five-field `delivery.result.v1`, all new keys under `data`, zero `ok`/`command` fields — measured by NFR-1/AC-NFR1-1 | DEC-5, NFR-1, AC-NFR1-1 |
| 4 | `<configDirectoryName>` must reconcile with the delivered config layer (GH-173) | **Reconciled**: `<configDirectoryName>` is the delivered brand-derived configuration directory name from the frozen brand identity; the project configuration document sits beside the delivered project-committed configuration file in that directory; no product name is committed | DEC-6, F-1, DM-1 |

### Appendix B — Ticket acceptance criteria mapping

The ticket's six acceptance criteria, verbatim in intent, map to this spec's criteria and the inherited scenario seeds:

| Ticket AC (M2-S18) | Spec criterion | Scenario seed |
|--------------------|----------------|---------------|
| AC1 — a project with two member repositories in one workspace directory is discoverable by registering that directory | AC-F4-1 | SC-M2-S18-01 |
| AC2 — the same project configured with repositories in unrelated directories behaves identically, because a workspace is optional | AC-F3-1 | SC-M2-S18-02 |
| AC3 — `projects list` shows the group with both members and their state | AC-F4-2 | SC-M2-S18-03 |
| AC4 — queue and status accept a project scope | AC-F6-1 | SC-M2-S18-04 |
| AC5 — a configuration mixing tracker kinds is accepted at validation time with the unimplemented member classified `not-yet-supported` rather than rejected silently | AC-F1-1 | SC-M2-S18-05 |
| AC6 — `projects list --flat --json` returns the delivered `projects.v1` payload with `data.projects[]`, `projectKey`, and `hostIndexRevision`, while `projects list --json` returns `project-groups.v1` with `data.groups[]` and `groupKey` | AC-F7-1 | SC-M2-S18-08 |

Scenario seeds SC-M2-S18-06 (undeclared clone not a member) and SC-M2-S18-07 (classified partial result) are inherited by the change test plan beyond the ticket's six — they enforce the configuration-only membership invariant and the aggregation clause (AC-F3-2, AC-F5-1).

### Appendix C — Constraint register (carried into plan and test authoring)

- C-1: Envelope continuity is normative — five-field `delivery.result.v1`, keys under `data`, no `ok`/`command` fields, over any pack example (DEC-5, NFR-1).
- C-2: The alias returns the delivered `projects.v1` payload **unchanged** — that binding covers the success payload; failure envelopes carry the moved `repos.*` identities; any field or shape drift in the alias success payload fails review (F-7, DM-4, AC-F7-1).
- C-3: The superseding decision record precedes all rename code; the registry `repos` row moves to Delivery only with the code change (DEC-2, DoD-11).
- C-4: Configuration-only membership is absolute — zero undeclared clones admitted, zero writes beyond the two permitted side effects (NFR-2, NFR-4).
- C-5: Scope exclusions are binding — no M2-S19 mechanics, no queue-and-lane representation, no board change, no alias retirement, no new tracker adapters (§7.2, NG-1..NG-8).
- C-6: Current-truth feature specs flip in phase 7, not in the delivery phases (DEC-1, NG-6) — with one mechanical exception: the error-identity rows this change introduces are documented in `doc/spec/features/feature-result-contract.md` within the delivering boundary, because the error-table sync gate inside `pnpm check` requires every new error table row to carry its documentation in the same boundary (GH-288/289/290/292 feat-commit precedent); no behavioral current-truth prose flips in delivery — that remains phase 7.
- C-7: Gate battery and commit hygiene per ticket conventions: `TMPDIR=$PWD/tmp/tmpdir pnpm check` before the PR; conventional subjects; every body/footer line ≤100 chars; PR to `main-tools`, stop open (DEC-7, NFR-6, NFR-7).

## 25. DOCUMENT HISTORY

| Version | Date | Author | Changes |
|---------|------|--------|---------|
| 1.0 | 2026-11-14 | spec-writer (GLM-5.3-Flash) | Initial specification from GitHub issue #309 (M2-S18), backlog canonical entry, M2 milestone pack (contracts, command pages, scenario seeds, architecture, entrypoint delta), status.md snapshots (M2 domain-model amendment 2026-11-11; delivery snapshots), current-truth feature specs (projects, config layer, CLI entrypoint), ODR-0003, and pm-notes decisions; the four planning open points resolved from pack truth (Appendix A) |
| 1.1 | 2026-11-14 | spec-writer (GLM-5.3-Flash) | DoR iter-1 remediation: alias failure-envelope identity pinned (repos.* follows the surface; §8.5 compat scoped to success payload; DoD-8 alias failure probe); C-6 sync-carrier exception declared |

---

## AUTHORING GUIDELINES

Sources: GitHub issue #309 "M2-S18: Project groups (M2)" (owner-authored; AC quoted in intent via Appendix B); backlog story M2-S18 (canonical scope and derived tasks a–f) and M2-S11 (delivered baseline); the M2 milestone pack — contracts.md (shared continuity, repos.v1, projects.v1, project-groups.v1, naming boundary and rename rule, project configuration document, project-scoped aggregation), commands/projects.md and commands/repos.md, commands/board.md (status check for the board resolution), test-scenarios.md (SC-M2-S18-01..08, inherited by name, not restated), architecture.md (three-level domain model, multi-repository overview), entrypoint-delta.md (mounting pattern, root listing); status.md (M2 domain-model amendment 2026-11-11, delivery snapshots); current truth — feature-projects.md (delivered flat surface contract), feature-config-layer.md (`<configDirectoryName>`), feature-cli-entrypoint.md (prompt-required set); ODR-0003 (DC-4 freeze rule); `chg-GH-309-pm-notes.yaml` (binding decisions and the board open question).

Resolutions applied against the planning open points (all four resolved from pack truth, none invented): the board field rename binds M2-S4's future delivery (board undelivered; pack page already names `repositories[]`) — DEC-3; the queue-and-lane representation is excluded per the canonical ticket — DEC-4; envelope continuity wins over pack example snippets — DEC-5; `<configDirectoryName>` reconciles with the delivered brand-derived config layer — DEC-6. Three genuine detail gaps remain and are raised as OQ-1..OQ-3 with proposed resolutions for plan authoring; none requires a product decision.

Constraints honored: scope stated at capability level only — no implementation steps, no repository code paths; runtime artifact locations that are themselves the contract surface (the configuration document location, the host-root container patterns) are named as contracts, not as implementation directives; scenario seeds and contracts are referenced by name, never duplicated.

## VALIDATION CHECKLIST

- [x] `change.ref` matches provided `workItemRef` (GH-309)
- [x] `owners` has at least one entry
- [x] `status` is "Proposed"
- [x] All sections present in order (1–25 + guidelines + checklist)
- [x] ID prefixes consistent and unique (F-, DM-, NFR-, RSK-, DEC-, OQ-, AC-, GAP-, NG-, G-, C-, DoD-)
- [x] Acceptance criteria reference at least one F-/DM-/NFR- ID and use Given/When/Then
- [x] Change-specific Definition of Done present (§17.1) — binds all sixteen ACs, the pre-delivery decision-record gate, the scope-conformance check, the gate battery, and the PR posture with per-condition verification and plan-phase ownership
- [x] NFRs include measurable values
- [x] Risks include Impact & Probability
- [x] Out-of-scope items start with `[OUT]`
- [x] No implementation details (no repository code file paths, no step-by-step tasks)
- [x] No content duplicated from linked docs (contracts, command pages, and scenario seeds referenced by name only)
- [x] Front matter validates per front_matter_rules
