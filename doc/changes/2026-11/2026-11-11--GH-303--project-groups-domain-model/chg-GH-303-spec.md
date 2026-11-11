---
change:
  ref: GH-303
  type: docs
  status: Proposed
  version: 1.1
  slug: project-groups-domain-model
  title: "Amend the M2 plan: three-level domain model with project groups, optional workspaces, and cross-repository changes"
  owners: [engineering]
  service: delivery-os-planning
  labels: [change, docs, planning]
  version_impact: none
  audience: internal
  security_impact: none
  risk_level: medium
  dependencies:
    internal: [oss-tooling-backlog, oss-tooling-status, milestone-packs, m2-blueprint-pack, cli-command-registry, forbidden-literals-registry, doc-distribution-guard]
    external: []
---

# CHANGE SPECIFICATION

> **PURPOSE**: Correct the M2 plan's domain model from one grouping level (repository) to three (repository, project, workspace) by amending M2-S11 in place, adding M2-S18 project groups and M2-S19 cross-repository changes, and propagating one naming boundary — `repos` enumerates checkouts, `projects` groups them — through the whole committed planning corpus so delivery agents execute M2 from a single, non-contradictory blueprint.

## 1. SUMMARY

This change amends the committed M2 planning corpus. It replaces the plan's single grouping unit with a three-level domain model: a **repository** is one git checkout and stays the delivery unit; a **project** is a named group of repositories whose membership is declared in configuration; a **workspace** is an optional persisted directory usable as a discovery root and never mandatory. Because the M2 plan currently spends the group name on a flat checkout list, the change amends M2-S11 in place — its per-repository state scoping, host index, and collision acceptance criteria are unchanged, while its enumeration surface becomes `repos list` — and adds two stories: M2-S18 (project groups, membership configuration, optional workspace discovery, project-scoped queue and status reads, mixed tracker kinds accepted at validation) and M2-S19 (one change spanning member repositories of one project: one lifecycle, one spec and plan, one definition of done, a branch and pull request per member). The blueprint pack, the two command pages, the scenario seeds, the journeys, the entrypoint delta note, the pack and milestone indices, the status snapshot, and the command registry are reconciled to the same model and the same naming boundary. No product code, no delivered surface, and no tracker ticket is created.

## 2. CONTEXT

### 2.1 Current State Snapshot

- **The backlog carries M2-S2 through M2-S17 and no grouping model.** The Epic M2 block opens at `## Epic M2: Ceremonies, measurement, and memory (months 3-6)` with a retirement note (M2-S1 retired into M1, gap deliberate), lists its stories in file order S2, S3, S10, S4, S5, S6, S7, S8, S9, S11, S12, S13, S14, S15, S16, S17, and closes with a blank line and a `---` separator before `## Epic M3`. There is no project-membership story and no cross-repository-change story anywhere in the file.
- **M2-S11 describes repositories as "projects".** Its entry reads: goal — multiple managed repositories are first-class, per-repository state scoping makes same-ref collisions impossible, and "a projects command gives one CLI overview of every managed checkout"; tasks — per-repository state scoping from the checkout identity (git common dir marker) with a host-level index, `projects list` reporting repo key, root, state location, daemon reachability, handover state, a migration note, and tests proving two same-ref checkouts cannot observe each other; AC — two checkouts of different repositories on one host both using ref GH-241 hold disjoint phase state and queue entries, and `projects list` enumerates them without manual configuration; depends on M0-S5, M1-S17.
- **The M2 blueprint pack exists and repeats the same naming.** `doc/planning/oss-tooling/milestones/m2/` holds `README.md`, `architecture.md`, `contracts.md`, `test-scenarios.md`, `journeys.md`, `entrypoint-delta.md`, and `commands/{projects,attempts,events,spend,queue,board}.md`. `commands/projects.md` documents `projects list [--json]` as "one overview of every delivery-managed checkout"; `contracts.md`'s `## projects.v1` section defines the flat per-checkout record (`projectKey` as the repository identity, `root`, `stateLocation`, `daemonReachable`, `handoverState`) with a host index revision; `architecture.md` names a `projects list projector` component and a `projects list` CLI one-shot and its `### Multi-repository overview` flow walks `projects list` → host index → repo key; `journeys.md` opens with a "Multi-repo morning overview" in which three delivery repositories are read through `projects list`; `test-scenarios.md` carries `SC-M2-S11-01` (asserting that a `projects list` row does not reference the other ref) and `SC-M2-S11-02` ("`projects list` enumerates both checkouts without manual configuration").
- **The entrypoint delta names `projects` as the host overview.** `entrypoint-delta.md`'s M2-planned additions open with "`projects` becomes a root family: the host overview of managed checkouts", and its mounting paragraph explains that mounting `projects` requires a prompt-set change plus a help reference page.
- **The command registry assigns the two names to two different meanings.** `cli-command-registry.md`'s M2 table has `ados projects` = M2-S11 "workstation overview of managed checkouts"; its M3 table has `ados repos` = M3-S6 "clone, branch, and worktree hygiene"; and its boundary note reads "`projects` (workstation overview, M2-S11) and the future M3 `repos` family are distinct surfaces, so the names never collide."
- **Both indices enumerate the pack without a `repos` page.** `milestones/m2/README.md` lists twelve artifacts in its pack-contents table and maps stories S2 through S17 to surfaces; `milestones/README.md`'s M2 index row links exactly those twelve targets. Neither knows a `commands/repos.md`, and no map row exists for S18 or S19.
- **`status.md` ends with the 2026-11-10 M2 planning snapshot**, which records M1 story delivery at 23 of 23, the M2 story set S2–S17, the two GH-284 amendments, and the maintenance convention that future M2 story deliveries update the snapshot at meaningful boundaries. Every earlier dated section is a historical record.
- **The guards have different scopes.** `scripts/.tests/test-doc-distribution.sh` marker-checks `doc/guides/**` and a fixed standalone list and skips `doc/planning/**`. `scripts/checks/forbidden-literals.ts` scans user-facing docs under `doc/**` except `doc/changes/**` and `doc/decisions/**`, requires every scanned doc to be listed in `scripts/checks/forbidden-literals.registry.json#registered` (139 entries today, including all twelve M2 pack documents), fails closed on an unregistered doc or a duplicate entry, and has no sorting requirement — the list is alphabetical apart from one pre-existing out-of-order pair. A new pack page therefore needs exactly one registered row.
- **No delivered spec covers these surfaces.** `doc/spec/features/` has no specification for `repos`, `projects`, project groups, workspaces, or cross-repository changes, because these are M2-planned surfaces. The planning corpus is the only place they are stated, so this change reconciles the corpus with itself and creates no current-truth contradiction.
- **Gate reality.** The aggregate gate is `pnpm check` (lint, format:check, typecheck, test, boundaries, prompt-conformance, help-guide-coverage, exports-parity). Under the default `TMPDIR` it currently exits 1 with two failures: `tests/checks/ci-baseline-parity.test.ts` (a `git clone --local` hardlink crossing devices) and `TC-WIRE-002` in `tests/checks/privacy-ci-wiring.test.ts`, a pre-existing timing sensitivity that times out at 5000 ms in both `TMPDIR` modes when run standalone and passes inside the full repository-local suite. With a repository-local `TMPDIR` the full suite exits 0. `test-doc-distribution.sh` has the opposite requirement and needs the default `TMPDIR`. No mermaid syntax validator exists in this repository; diagram validity is established structurally (fence count, fence closure, diagram-type keyword, heading association), and this change adds no tooling.

### 2.2 Pain Points / Gaps

- **The plan spends the group name on a checkout list.** The three-level model reserves `projects` for a group of repositories, but M2-S11, the pack, the journey, the scenarios, the entrypoint delta, and the registry all use `projects list` for the flat enumeration. A reader cannot tell which entity `projects` means, and the M2 surface is on a collision course with the story that needs the group name.
- **Nothing declares membership.** No configuration, contract, or scenario says which repositories belong to one product or system. Neither the board, the queue, nor the status read can scope to a project, so every cross-repository view must be re-derived by hand from a flat list.
- **No story plans a multi-repository change.** Work spanning several repositories is forced into N independent changes with N lifecycles, N specs, N definitions of done, and no single place that says whether the change as a whole landed.
- **The workspace level is unstated.** Without an explicit statement that a workspace is an optional directory and never a required one, a reader can infer either that a shared directory is mandatory or that "workspace" is a new artifact namespace — while in this repository's vocabulary `workspace` already names the per-change artifact set.
- **The M3 hygiene name is reserved against the wrong meaning.** The registry reserves `repos` for M3-S6 clone/branch/worktree hygiene while the ticket assigns the flat enumeration to `repos`; unless both meanings are reconciled into one family story with a documented split, the naming surface contradicts the plan.
- **A half-rename is the natural failure mode.** Pack index, contents table, contracts, entrypoint delta, journey, scenario seed `SC-M2-S11-02`, and registry each name the flat enumeration; fixing some and not others leaves a corpus that is internally contradictory while every individual page looks correct.

## 3. PROBLEM STATEMENT

Because the M2 plan models the repository as the only grouping unit and spends the group name on a flat checkout list, delivery agents cannot declare which repositories belong together, cannot scope a board, queue, or status read to a project, and cannot plan one change across several repositories — and because the flat enumeration's name is shared across the backlog, the blueprint pack, the indices, the entrypoint delta, and the command registry, any partial correction leaves the committed plan contradicting itself — resulting in a blueprint that must be re-litigated story by story, cross-repository work split into unrelated lifecycles, and review that cannot tell whether the planned naming surface is coherent.

## 4. GOALS

- **G-1**: M2-S11 is amended in place: its per-repository state scoping from the checkout identity, its host-level index, its migration note, its collision tests, and its two-checkout GH-241 collision acceptance criterion stay unchanged, while its goal, its enumeration task, and its enumeration acceptance criterion name `repos list` with the fields repo key, root, state location, daemon reachability, and handover state, and the entry records the rename transition.
- **G-2**: M2-S18 lands in the canonical backlog with the ticket's goal, its five task clauses, its five acceptance clauses, and its dependency on M2-S11, and the blueprint covers what the story needs: a project configuration schema, an optional workspace discovery root, a group-listing surface, project-scoped queue and status reads, mixed tracker kinds accepted at validation with the unimplemented member classified not-yet-supported, and the documented naming boundary.
- **G-3**: M2-S19 lands in the canonical backlog with the ticket's goal, its six task clauses, its three acceptance clauses, and its dependencies on M2-S11, M2-S18, and the delivered M1-S17, and the blueprint carries a cross-repository change plan shape in which one lifecycle drives a branch and pull request per member repository under one shared definition of done.
- **G-4**: The three-level model and the `repos`/`projects` naming boundary appear consistently in the M2 architecture, contracts, both command pages, scenario seeds, journeys, entrypoint delta note, pack index, milestone index, status snapshot, command registry, and backlog, with no page asserting the other page's meaning.
- **G-5**: The change is docs-only: exactly thirteen product files change (twelve planning documents under `doc/planning/oss-tooling/**`, one of them new, plus one guard registry row), no product code, test, tooling, or delivered surface changes, and every repository guard that applies to the corpus is green.
- **G-6**: Planned-not-delivered semantics survive: the touched command pages keep `Status: Proposed (M2)`, the pack keeps its planned-until-exit statement, and no part of the corpus claims that `repos`, `projects`, project groups, workspace discovery, or cross-repository changes are delivered.

### 4.1 Success Metrics / KPIs

| Metric | Target |
|---|---|
| M2-S11 amendment clauses applied (state scoping and collision kept; enumeration surface renamed; transition noted) | 3 of 3 |
| New M2 stories in the backlog | 2 (M2-S18, M2-S19) |
| Ticket clauses carried with unchanged meaning (12 S18 + 11 S19 + 3 M2-S11 amendment) | 26 of 26; 0 omitted, 0 added, 0 reworded in substance |
| Product files changed (all paths except `doc/changes/**`) | exactly 13 — 12 under `doc/planning/oss-tooling/**` (11 modified plus 1 new) + `scripts/checks/forbidden-literals.registry.json` |
| New files created | 1 (`milestones/m2/commands/repos.md`) |
| Appendix B naming-matrix locations carrying the required meaning | 100%; 0 surviving statements that `projects list` is the flat enumeration |
| Command pages carrying `Status: Proposed (M2)` | 2 of 2 (`repos`, `projects`) |
| Pack index targets in the `milestones/README.md` M2 row | 13 (was 12) |
| New scenario seeds | ≥ 4 (≥ 2 for S18, ≥ 2 for S19), each with exactly one `Assert:` line; amended S11 seeds use `repos list` |
| `bash scripts/.tests/test-doc-distribution.sh` (default `TMPDIR`) | exit 0 |
| Aggregate `pnpm check` (repository-local `TMPDIR`, full suite — the authoritative gate) | exit 0; any failure here is a delivery failure |
| Default-`TMPDIR` aggregate run | recorded; its `ci-baseline-parity` failure and its `TC-WIRE-002` 5000 ms timeout each recorded and re-run, and tolerated only while the repository-local run is green on the same head; any other failure is a delivery failure |
| Delivered/current/shipped claims for the three planned surfaces | 0 |

### 4.2 Non-Goals

- **NG-1**: Delivering any M2 story, including M2-S18 and M2-S19; this change plans and documents, it does not implement project configuration, discovery, scoped reads, or cross-repository lifecycles.
- **NG-2**: Changing any product behaviour, command composition, or entrypoint registration; `repos` and `projects` stay unregistered and unbuilt.
- **NG-3**: Rewriting `doc/spec/**` or `doc/overview/**`; no delivered spec covers these surfaces, so phase 7 records that no current-truth change is required rather than inventing one.
- **NG-4**: Creating tracker tickets for M2-S18 or M2-S19; the PM proposes, the owner decides.
- **NG-5**: Re-wiring existing story dependencies. No dependency line changes except the two new entries; in particular M2-S4's dependency set is not amended, and its use of the group envelope is recorded with the pack's existing advisory convention.
- **NG-6**: Restructuring `roadmap.md`, `backlog-ranking.md`, `measurement-baseline.yaml`, or any page not named in §7.1, including the M1 pack.
- **NG-7**: Adding a diagram validator, a naming lint, a documentation drift check, or any other new tooling or gate; and changing the scope or behaviour of the two existing doc guards.

## 5. FUNCTIONAL CAPABILITIES

| ID | Capability | Rationale |
|----|------------|-----------|
| F-1 | M2-S11 is amended in place | The collision and state-scoping work is correct and must survive; only the enumeration surface's name and fields need correcting |
| F-2 | M2-S18 project groups lands in the backlog | Membership of repositories in a project is a first-class planning unit, not an inference from a flat list |
| F-3 | M2-S19 cross-repository changes lands in the backlog | Cross-repository work is a daily case and needs one lifecycle, one spec and plan, and one definition of done |
| F-4 | The backlog records the domain-model context and preserves every other byte | The naming split must be visible where the story set is read, without disturbing the epic structure or other entries |
| F-5 | The M2 architecture carries the three-level model, the adjusted overview flow, the cross-repository change flow, and the boundary invariants | A reader must see repositories as members of projects and workspaces as optional before reading any contract |
| F-6 | The contracts define the flat enumeration envelope, the group envelope, the project configuration schema, and the cross-repository change plan shape | Both command pages and both stories need one contract to point at, with no field carrying two meanings |
| F-7 | The command pages split: a new flat-enumeration page and a rewritten group page | Two surfaces sharing one page would keep the naming collision alive |
| F-8 | Scenario seeds cover S18 and S19, and the S11 seeds use the corrected surface | Seeds are the first draft of each story's test plan and must be executable against the corrected model |
| F-9 | The multi-repository morning overview journey is rewritten for a project | The journey is the readable test of whether the model answers the operator's real question |
| F-10 | The entrypoint delta note states the `repos`/`projects` split | The note is where a reader learns which families M2 adds and how a family becomes reachable |
| F-11 | The pack and milestone indices learn the new page and the two new stories | A page or story that no index points at is not discoverable |
| F-12 | `status.md` gains a dated snapshot for this amendment without rewriting history | Planning state must stay current and auditable, with earlier snapshots intact |
| F-13 | The command registry reconciles `repos`, `projects`, and the M3 hygiene verbs | The registry is the locked naming surface and must not contradict the plan |
| F-14 | One naming boundary holds across every touched location | A half-rename is the failure mode this change exists to prevent |

### 5.1 Capability Details

- **F-1 — M2-S11 amended in place.** The entry keeps its heading `### M2-S11 Multi-repository workstations`, its dependency line `- Depends on: M0-S5, M1-S17.`, the per-repository state scoping derived from the checkout identity (the git common dir marker) with a host-level index, the migration note for existing single-store users, the tests proving two checkouts using the same ref cannot observe each other's documents, and the acceptance criterion that two checkouts of different repositories on one host both using ref GH-241 hold disjoint phase state and queue entries. Only the naming changes: the goal no longer calls the flat enumeration a "projects command"; the enumeration task reads `repos list` and keeps the same five reported fields (repo key, root, state location, daemon reachability, handover state); the enumeration acceptance criterion reads `repos list`; and the entry records the transition — if the flat `projects list` ships before the group story, the group story renames it with a deprecation alias. The entry keeps the existing story shape (Goal, Tasks, AC, Depends on), its file position, and its code.
- **F-2 — M2-S18 in the backlog.** The Epic M2 block gains `### M2-S18 Project groups` carrying the ticket's goal, its five task clauses (project configuration declaring member repositories, any tracker adapter, mixed trackers remaining valid configuration even if only GitHub is exercised initially; optional workspace-directory discovery root — register a directory, scan for managed clones inside, never required; `projects list` rendering groups with member repos, health, and state; project scoping for queue and status reads; naming boundary documented as `repos` = flat enumeration and `projects` = groups), its five acceptance clauses (a two-member project in one workspace directory is discoverable by registering that directory; the same project configured with repositories in unrelated directories behaves identically; `projects list` shows the group with both members and their state; queue and status accept a project scope; a configuration mixing tracker kinds is accepted at validation time with the unimplemented member classified not-yet-supported rather than rejected silently), and `- Depends on: M2-S11.`. No `- Ticket:` line is added: the reading guide says that line appears only for created stories. The blueprint coverage for the story is F-5, F-6, F-7, F-8, and F-9.
- **F-3 — M2-S19 in the backlog.** The block gains `### M2-S19 Cross-repository changes` with the ticket's goal (one change may span multiple repositories of one project: one lifecycle, one spec and plan, one definition of done, with a branch and pull request per member repository), its six task clauses (the plan declares member repositories and their slices; one lifecycle drives per-repo branches and PRs; per-repo gates and one shared DoD; closeout across member repositories with branch cleanup and issue closure per tracker; dependency edges between member repositories' steps where order matters; evidence records enumerate all member PRs), its three acceptance clauses (a two-repository change produces one spec, two branches, two PRs, one review flow, and a closeout that lands both; per-repo CI truth is corroborated per member before the change counts done; a member failing its gates blocks the shared DoD with the failing member named), and `- Depends on: M2-S11, M2-S18, M1-S17.`
- **F-4 — The backlog context note and preservation.** The Epic M2 block gains one new paragraph immediately after the existing retirement note and before `### M2-S2`, recording the domain-model amendment: the plan now distinguishes repository, project, and workspace; `repos` is the flat enumeration owned by the amended M2-S11 and `projects` is the group surface owned by M2-S18; the entrypoint consequence is that both become root families. The existing retirement note, the epic heading, the frontmatter, the reading guide, the cross-cutting principles, every other story, the separator, and the `## Epic M3` heading stay byte-identical; the two new story entries are inserted after the M2-S17 entry's last line, inside the block and before the blank line and `---` separator that close it.
- **F-5 — The architecture states the model.** `milestones/m2/architecture.md` gains the three-level model in its C4 Level 1 context: repository as the delivery unit, project as a configured group of repositories, workspace as an optional directory usable as a discovery root; the relations make membership explicit and make the workspace optional in the diagram itself. The `### Multi-repository overview` flow is rewritten so the overview is scoped to a project — group resolution, member enumeration, optional workspace discovery, then per-member state and health — and a new `### Cross-repository change` flow describes one lifecycle driving member branches and pull requests, per-member gates, the shared definition of done, and closeout across members. `## Boundary invariants at M2 exit` gains the naming boundary, one-membership-declaration statement, workspace-optional statement, and one-lifecycle-per-cross-repository-change statement. The C4 level structure, the `## Key flows` structure, and the mermaid fence conventions are preserved.
- **F-6 — The contracts.** `milestones/m2/contracts.md` defines, as planned M2 contracts: `repos.v1`, the flat enumeration owned by the amended M2-S11, carrying the repo key derived from the checkout identity, the root, the per-repository state location, daemon reachability with a degradation reason, handover state, and the host index revision; `projects.v1`, redefined as the group surface owned by M2-S18, carrying the group identity and name, its member list with each member's repo key, root, tracker kind, state, and health, and the optional workspace root; the project configuration schema, declaring membership, a tracker kind per member, and an optional workspace discovery root, with mixed tracker kinds valid at validation and an unimplemented member classified as not-yet-supported rather than rejected; and the cross-repository change plan shape, declaring member repositories and their slices, each member's branch and pull request, member step dependency edges, per-member gates, the shared definition of done, per-member closeout including branch cleanup and per-tracker issue closure, and evidence that enumerates every member pull request. No field denotes a repository under the group's name, and no contract asserts that either surface is delivered.
- **F-7 — The command pages.** `milestones/m2/commands/repos.md` is new: the flat enumeration contract moved out of `projects.md`, carrying the pack status header, a bare command name, the `repos list [--json]` surface, the five reported fields, the machine envelope under `repos[]`, exit codes, an error table, invocation examples, see-also links, and an explicit rename note stating that this content was the flat enumeration previously documented as `projects list` and that the surface belongs to `repos` under the amended M2-S11. `milestones/m2/commands/projects.md` is rewritten as the group surface: it enumerates projects with their member repositories, health, and state; it documents project-scoped reads for queue and status; it points at `projects.v1` and the project configuration schema; it states the naming boundary; and it no longer claims to enumerate managed checkouts. Both pages keep `Status: Proposed (M2)` and read as not yet registered at the root listing.
- **F-8 — The scenario seeds.** `test-scenarios.md` gains at least two `SC-M2-S18-*` seeds and at least two `SC-M2-S19-*` seeds, each with exactly one `Assert:` line in the pack's established form, covering at least: discovery through a registered workspace directory, the same project without any workspace behaving identically, group listing with members and state, project-scoped queue and status reads, mixed tracker-kind configuration with the unimplemented member classified not-yet-supported, and — for S19 — one spec with two member branches and two pull requests under one review flow and one closeout, plus a member failing its gates blocking the shared definition of done with that member named. The two S11 seeds are amended to the `repos list` surface, including the first seed's assert line, and no seed asserts that `projects list` enumerates checkouts.
- **F-9 — The journey.** `journeys.md`'s opening "Multi-repo morning overview" is rewritten as a project-scoped morning overview: a project with several member repositories, at least one member living outside any shared directory, the flat view from `repos list`, the group view from `projects list` with members and health, project-scoped queue and status reads, and a board scoped to the project; the journey states that a project configured without a shared workspace reads identically and that same-ref members stay disjoint. The remaining journeys stay as written except where they name the flat enumeration.
- **F-10 — The entrypoint delta.** `entrypoint-delta.md`'s M2-planned additions replace the single `projects` host-overview line with two additions — `repos` as the flat enumeration of managed checkouts (amended M2-S11) and `projects` as the group surface (M2-S18) — and its mounting paragraph names both families where it previously named `projects` alone, so the note no longer claims that `projects` is the host overview. The observed composition, the daemon gap, the mount mechanism, and the snapshot statement stay as written.
- **F-11 — The indices.** `milestones/m2/README.md`'s pack-contents table gains a `commands/repos.md` row and keeps one row per artifact; its story-to-artifact map gains rows for M2-S18 and M2-S19 pointing at the group envelope, the configuration schema, the cross-repository change flow, and their seeds, and the M2-S11 row points at `repos.v1`. The M2-S4 row, which points at the group envelope, gains the pack's advisory phrase `(advisory: consumed at delivery; the owning story declares the edge)` in the same form the M2-S3, M2-S5 and M2-S10 rows carry, so the consumption edge is recorded on the map instead of as a new dependency. `milestones/README.md`'s M2 index row gains `m2/commands/repos.md`, for thirteen targets, while the M0 and M1 rows stay byte-identical.
- **F-12 — The status snapshot.** `status.md` gains one dated section recording this amendment as planning state: the three-level model, the M2-S11 amendment and its transition note, the addition of M2-S18 and M2-S19 with their dependencies, the naming boundary and its registry reconciliation, and the corrected entrypoint delta. No earlier dated section is edited, no line is removed, reordered, or modified, and the section claims neither M2 delivery nor milestone exit.
- **F-13 — The command registry.** `cli-command-registry.md` gains one M2 row for `ados repos` whose purpose is the flat enumeration (repo key, root, state location, daemon reachability, handover state) owned by the amended M2-S11; its `ados projects` row is rewritten as the group surface with membership, health, state, and project-scoped reads, owned by M2-S18; its M3-S6 `ados repos` row is reconciled so the hygiene verbs (clone, branch, worktree) are the family's later subcommands rather than a separate future family; and the boundary note is replaced by the naming boundary (`repos` = flat enumeration and, later, its hygiene verbs; `projects` = groups). Every other row stays byte-identical, and no row claims a delivered surface.
- **F-14 — One naming boundary everywhere.** Across the twelve planning documents, `repos list` (and `repos` as the flat family) means the flat enumeration of managed checkouts, and `projects`/`projects list` means a configured group of repositories with its members; a location that names both states the relation; a location that names only one uses it with the correct meaning. Every location in Appendix B is in the required state after the change.

## 6. USER & SYSTEM FLOWS

```
Flow 1 — The owner validates the corrected model before delivery
  Owner opens milestones/README.md -> M2 row -> m2/README.md
    -> architecture: repository, project, workspace with workspace optional
    -> contracts: repos.v1 (flat), projects.v1 (groups), configuration schema,
       cross-repository change plan shape
    -> commands/repos.md and commands/projects.md: two pages, two meanings
  Owner compares against intent; refinements land in the pack, not in a ticket.

Flow 2 — A delivery agent executes M2-S18 from repository truth
  Agent reads backlog.md Epic M2
    -> M2-S11 (amended): repos list enumerates checkouts
    -> M2-S18: project groups, configuration, optional workspace discovery,
       project-scoped queue and status reads, mixed tracker classification
    -> m2/README.md map row -> architecture flow -> contracts schema
    -> inherits SC-M2-S18-* seeds as the first draft of its test plan
  (no ticket lookup required)

Flow 3 — A project configured without any shared workspace
  Operator declares project membership in configuration, no workspace root
    -> membership resolves from the declared repositories wherever they live
    -> repos list shows the checkouts; projects list shows the group and members
    -> queue and status reads scoped to the project return the same shape
       as for a project whose members share a directory
  (a registered workspace root would only add discovery, never a requirement)

Flow 4 — One change across two member repositories (planned, M2-S19)
  One change, one lifecycle
    -> one spec and plan declaring member repositories and their slices
    -> per member: branch, pull request, gates, CI corroboration
    -> one shared definition of done; a failing member blocks it and is named
    -> closeout cleans both branches and closes issues per tracker
    -> evidence enumerates both pull requests

Flow 5 — A reviewer audits the naming boundary
  Reviewer searches the corpus for the two names
    -> every flat-enumeration statement reads repos list
    -> every group statement reads projects / projects list
    -> registry, contracts, entrypoint delta, indices, journey, and seeds agree
    -> no page attests that projects list enumerates checkouts
```

## 7. SCOPE & BOUNDARIES

### 7.1 In Scope

- `doc/planning/oss-tooling/backlog.md`: the in-place M2-S11 amendment, the M2-S18 and M2-S19 entries inside the Epic M2 block, and one new Epic M2 context paragraph recording the domain model and the root-family consequence.
- `doc/planning/oss-tooling/milestones/m2/architecture.md`: the three-level model in the C4 Level 1 context, the project-scoped overview flow, the cross-repository change flow, and boundary invariants including the naming boundary.
- `doc/planning/oss-tooling/milestones/m2/contracts.md`: `repos.v1`, the redefined `projects.v1` group envelope, the project configuration schema, and the cross-repository change plan shape.
- `doc/planning/oss-tooling/milestones/m2/commands/repos.md`: **new file** — the flat enumeration contract moved from `projects.md`, with a rename note.
- `doc/planning/oss-tooling/milestones/m2/commands/projects.md`: rewritten as the group surface with members, health, state, and project-scoped reads.
- `doc/planning/oss-tooling/milestones/m2/test-scenarios.md`: new S18 and S19 seeds, each with one `Assert:` line, and the S11 seeds amended to `repos list`.
- `doc/planning/oss-tooling/milestones/m2/journeys.md`: the multi-repository morning overview rewritten as a project-scoped overview.
- `doc/planning/oss-tooling/milestones/m2/entrypoint-delta.md`: the M2-planned additions and the mounting paragraph corrected to the `repos`/`projects` split.
- `doc/planning/oss-tooling/milestones/m2/README.md`: the pack-contents table row for `commands/repos.md` and the story-to-artifact map rows for S18 and S19, with the S11 row pointing at `repos.v1`.
- `doc/planning/oss-tooling/milestones/README.md`: the M2 index row gains `m2/commands/repos.md`.
- `doc/planning/oss-tooling/status.md`: one new dated planning snapshot for this amendment.
- `doc/planning/oss-tooling/cli-command-registry.md`: the `ados repos` M2 row, the redefined `ados projects` row, the reconciled M3-S6 row, and the replaced boundary note.
- `scripts/checks/forbidden-literals.registry.json`: exactly one added registration for the new pack page, at its sorted position, with no duplicate and no other row changed.
- The change artifacts under `doc/changes/2026-11/2026-11-11--GH-303--project-groups-domain-model/`.

### 7.2 Out of Scope

- [OUT] Any product code, command implementation, configuration loader, discovery scan, scoped read, or lifecycle behaviour; no file under `packages/**` changes.
- [OUT] Any delivered surface or entrypoint registration; `repos` and `projects` stay uncomposed and unlisted.
- [OUT] Rewriting `doc/spec/**` or `doc/overview/**`; phase 7 records that these planned surfaces have no current-truth spec and therefore require no reconciliation.
- [OUT] Changes to `tests/**`, `.opencode/**`, `.ai/**`, `doc/guides/**`, `doc/templates/**`, or any `scripts/**` file other than the single registry row; in particular no change to either doc guard's scope or behaviour and no new check.
- [OUT] Creating tracker tickets for M2-S18 or M2-S19.
- [OUT] Amending any existing story's dependency or body other than M2-S11; the M2-S4 board's use of the group envelope is recorded under the pack's advisory convention instead of a new dependency edge.
- [OUT] Reorganising `roadmap.md`, `backlog-ranking.md`, `measurement-baseline.yaml`, or `doc/planning/oss-tooling/user-journeys.md`.
- [OUT] Editing the M1 pack, the M0 pack, or any M2 page not named in §7.1.
- [OUT] Any private, fleet, hosted, repository, or proprietary product name in new or changed text.

### 7.3 Deferred / Maybe-Later

- The deprecation alias itself: nothing has shipped, so this change records the conditional transition and implements no alias; if a flat `projects list` ever ships before M2-S18, the group story renames it with an alias as the backlog entry states.
- Project-scoped reads beyond queue and status (board scoping, spend scoping, retro scoping) are story work under M2-S4, M2-S6, and M2-S10, not planning scope here.
- A mechanical naming-boundary drift check, if review shows the manual rule is insufficient after the first M2 delivery.
- Reconciling the rest of the planning corpus to the three-level model where it speaks of repositories alone (roadmap, ranking, user journeys) — a later editorial pass, out of this ticket's file set.
- Whether M2-S4's dependency set should admit M2-S18 once the board is delivered against the group envelope; the pack's advisory convention covers the gap meanwhile.

## 8. INTERFACES & INTEGRATION CONTRACTS

### 8.1 REST / HTTP Endpoints

N/A. This change delivers no endpoint. The contracts it documents (`repos.v1`, the redefined `projects.v1`, the project configuration schema, the cross-repository change plan shape) are planned M2 contracts, not delivered interfaces.

### 8.2 Events / Messages

N/A for this change. No event, topic, message, or payload changes. The planning text may reference project scope in existing planned surfaces (queue and status reads), but nothing is delivered or versioned here.

### 8.3 Data Model Impact

| ID | Element | Description |
|----|---------|-------------|
| DM-1 | Backlog story entry | Heading `### Mx-Sn Title`, optional `- Ticket:` line, then `- Goal:`, `- Tasks:`, `- AC:`, `- Depends on:`. Codes are stable identifiers; file position carries no ordering meaning. An `AC` block may be one inline criterion or an indented numbered list. |
| DM-2 | Domain level | The three-level vocabulary with fixed mandatory/optional semantics: repository = one git checkout and the delivery unit (always the leaf, always present); project = a named group of repositories whose membership is declared in configuration (the grouping level, one or many members); workspace = a persisted directory usable as a discovery root for a project's clones (optional, never required). |
| DM-3 | Project configuration document | A declared configuration artifact that names a project, lists its member repositories, assigns a tracker kind per member, and optionally names a workspace discovery root. Mixed tracker kinds are valid at validation time; a member whose tracker kind has no implemented adapter is classified as not-yet-supported rather than rejected. |
| DM-4 | `repos.v1` envelope | The flat enumeration's machine envelope: per checkout, the repo key derived from the checkout identity, the absolute root, the per-repository state location, daemon reachability with a degradation reason, and handover state, plus the host index revision. Owned by the amended M2-S11. |
| DM-5 | `projects.v1` envelope | The group surface's machine envelope: the group identity and name, its members each with repo key, root, tracker kind, state, and health, the optional workspace root, and the project scope accepted by queue and status reads. Owned by M2-S18. No field denotes a repository under a group-named key. |
| DM-6 | Cross-repository change plan shape | The plan declaration for one change across member repositories: member repositories and their slices, each member's branch and pull request, dependency edges between member steps, per-member gates, one shared definition of done, per-member closeout (branch cleanup, per-tracker issue closure), and evidence listing every member pull request. Owned by M2-S19. |
| DM-7 | Scenario seed | A `### SC-M2-<story>-<n> <title>` block with Given/When/Then prose and exactly one `Assert:` line stating a predicate over an envelope field, exit code, or file/ledger fact. |
| DM-8 | Command page | A page with a `Status:` header, NAME, SYNOPSIS, OPTIONS, OUTPUT (text digest and machine envelope), EXIT STATUS, invocation examples, an error table, and see-also links; command names are bare with the `<binary>` invocation prefix. |

### 8.4 External Integrations

- Tracker adapters are separate engines, so a project may declare members with different tracker kinds. This change documents that configuration as valid and records the not-yet-supported classification for a member with no implemented adapter; it performs no tracker read or write.
- No other external integration is touched: no provider, vendor API, credential path, or hosted surface is added, removed, or reconfigured.

### 8.5 Backward Compatibility

- M2-S11's state-scoping, host-index, migration, test, and collision clauses keep their meaning and their dependency line, so the delivered work the story describes is unaffected by the rename.
- Nothing is delivered, so no executable surface, output shape, exit code, or user workflow changes; readers' existing links to the pack resolve, and no page is removed.
- `projects.v1` is redefined before delivery: the plan states that consumers of the group envelope read member lists, and the M2-S4 map row carries the pack's existing advisory note rather than a new dependency edge.
- `status.md` history is additive: no base line is removed, reordered, or modified, so earlier snapshots keep their recorded meaning.
- The registry's existing rows, including the M3-S6 hygiene row and the historical rename note, keep their bytes except for the M3-S6 row this change reconciles.

## 9. NON-FUNCTIONAL REQUIREMENTS (NFRs)

| ID | Requirement | Threshold |
|----|-------------|-----------|
| NFR-1 | Docs-only containment | Exactly 13 product files change (all paths except `doc/changes/**`): 12 under `doc/planning/oss-tooling/**` — 11 modified plus 1 new — and `scripts/checks/forbidden-literals.registry.json`. Zero files change under `doc/spec/**`, `doc/overview/**`, `doc/guides/**`, `doc/templates/**`, `packages/**`, `tests/**`, `.opencode/**`, `.ai/**`, or any other `scripts/**` path. Phase 7 records "no current-truth change required" and edits nothing. |
| NFR-2 | Backlog preservation and placement | 100% byte identity for the frontmatter block, the `## Reading guide`, `## Cross-cutting principles`, the Epic M2 heading and its retirement note, every existing story other than M2-S11, the blank line and `---` separator closing the Epic M2 block, and the `## Epic M3` heading. The only changed regions are the M2-S11 entry, one added context paragraph after the retirement note, and two inserted entries between M2-S17's last line and the closing separator. 0 story codes renamed, reordered, or removed. |
| NFR-3 | Planned-not-delivered semantics | 2 of 2 command pages carry the exact header `Status: Proposed (M2)`; 0 claims — status header, delivery attribution, or prose — that `repos`, `projects`, project groups, workspace discovery, or cross-repository changes are delivered, current, or shipped; the pack's planned-until-exit statement survives verbatim; 0 pack pages relabelled as snapshots. |
| NFR-4 | Forbidden-literals registration | Exactly 1 row added to `registered` (139 → 140), placed at its lexicographic position inside the existing `doc/planning/oss-tooling/milestones/m2/commands/` group so the surrounding rows keep their relative order; 0 duplicate entries; the guard reports 0 unregistered-doc findings and 0 violations. |
| NFR-5 | Doc-distribution guard | `bash scripts/.tests/test-doc-distribution.sh` exits 0 when run with the default `TMPDIR`; 0 `ados_distribution` markers added to any planning document. |
| NFR-6 | Aggregate gate | The authoritative run is `pnpm check` with a repository-filesystem `TMPDIR` (`mkdir -p <repo>/tmp/tmpdir && TMPDIR=<repo>/tmp/tmpdir pnpm check`) over the full suite; it must exit 0 on the branch head, and any failure there — including a repeated `TC-WIRE-002` timeout — is a delivery failure to investigate, never an environmental exemption. Both the default-`TMPDIR` and repository-local-`TMPDIR` runs are recorded in the delivery evidence. A default-run failure of `tests/checks/ci-baseline-parity.test.ts` (cross-device hardlink) and a default-run `TC-WIRE-002` timeout in `tests/checks/privacy-ci-wiring.test.ts` (5000 ms timing sensitivity; passes inside the repository-local suite) are each recorded and re-run, and are not delivery failures only while the repository-local run is green on the same head. Any other default-run failure is a delivery failure to investigate and is never silently reclassified as environmental. |
| NFR-7 | Document structure (no new tooling) | Every touched file's fenced-block count is even, so every mermaid block closes before the next heading; every diagram fence is tagged `mermaid` and its first body line begins with `flowchart`, `graph`, `sequenceDiagram`, `classDiagram`, or `stateDiagram-v2`; `## C4 Level 1`, `## C4 Level 2`, and `## C4 Level 3` appear exactly once each; `## Key flows` holds exactly 8 `###` headings, each owning exactly one mermaid block. Proven by the same structural read the pack already uses; no validator, script, or gate is added. |
| NFR-8 | Ticket clause fidelity | 26 of 26 ticket clauses present with unchanged meaning (12 for S18, 11 for S19, 3 for the M2-S11 amendment); 0 added acceptance criteria; 0 clauses weakened to "may", merged, or dropped; the only editorial degrees of freedom are whitespace, line wrapping, and typographic normalisation. |
| NFR-9 | Public/OSS hygiene | 0 private fleet, repository, host, hosted, or proprietary product names in new or changed text; 0 forbidden-literal violations with all scope classes scanned. |
| NFR-10 | Link integrity and non-duplication | 0 broken relative links introduced or left behind; 0 pack documents restating a story's acceptance-criteria block instead of referencing the story code. |
| NFR-11 | Status history retention | In `status.md`, 0 base lines removed, reordered, or modified; every added line lies inside the one new dated section; a whole-file retention comparison passes, and no whole-section `cmp` is asserted. |
| NFR-12 | Naming-boundary consistency | 0 occurrences in the twelve planning documents of `projects list` or `projects` denoting the flat enumeration; 0 occurrences of `repos list` or `repos` denoting a group; 100% of the Appendix B matrix rows in their required state. |

## 10. TELEMETRY & OBSERVABILITY REQUIREMENTS

N/A. No runtime surface is added or modified, so no metric, log, trace, span, or alert is emitted. The change produces documentary evidence only: the two gate runs, the structural diagram read, the naming-matrix scan, the clause-fidelity table, and the file-set comparison recorded in the change artifacts.

## 11. RISKS & MITIGATIONS

| ID | Risk | Impact | Probability | Mitigation | Residual Risk |
|----|------|--------|-------------|------------|---------------|
| RSK-1 | Half-rename: some locations keep `projects list` for the flat enumeration while others move to `repos list`, leaving a corpus that contradicts itself page by page | H | H | Appendix B enumerates every location and its required meaning; F-14 and AC-F14-1/AC-F14-2 scan the whole corpus; NFR-12 sets a zero-survivor threshold; review reads the matrix, not individual pages | L: a peripheral page outside the matrix could still use an ambiguous phrase |
| RSK-2 | Backlog structure damaged: an entry inserted below the `---` separator or the separator/`## Epic M3` moved, breaking the epic block | M | M | Placement pinned in F-4 and AC-F4-1; hunk containment in AC-F4-3; preservation in NFR-2 | L |
| RSK-3 | `projects.v1` redefinition leaves a field meaning two things (`projectKey` as both group and repository identity) | M | M | AC-F6-2 states the group/member split and forbids a group-named key denoting a repository; AC-F6-1 fixes the flat envelope's keys | L |
| RSK-4 | The mixed tracker-kind clause is softened to "mixed trackers are not supported" or silently dropped | H | M | AC-F2-2 and AC-F6-3 make the classification vocabulary checkable; NFR-8's 26-clause oracle counts it | L |
| RSK-5 | Planned content reads as delivered, or a page loses its status header while being rewritten | M | M | NFR-3 and AC-NFR3-1 require the exact header on both command pages and zero delivery claims; `projects.md` is rewritten in place rather than replaced by a differently-labelled page | L |
| RSK-6 | The single registry row is missing, duplicated, or inserted far from its sorted position, failing the guard | M | L | NFR-4 fixes 139 → 140, one row, sorted position between `queue.md` and `spend.md`; AC-NFR4-1 checks the guard output | L |
| RSK-7 | The gate runs are confused: the authoritative repository-local `pnpm check` result is not recorded, a default-run `TC-WIRE-002` timeout or `ci-baseline-parity` failure is tolerated on a head whose repository-local run is not green, or any other default-run failure is reclassified as environmental | M | M | NFR-6 and AC-NFR6-1 make the repository-local full-suite run authoritative, require both runs recorded, and admit only the two named default-only failures, each recorded, re-run, and conditional on a green repository-local run on the same head; NFR-5 and AC-NFR5-1 keep the distribution guard on the default `TMPDIR` | L |
| RSK-8 | The three-level model is asserted in words but not drawn, leaving readers to guess membership and workspace optionality from prose | M | M | F-5 and AC-F5-1/AC-F5-2 require the model in the C4 context with relations; NFR-7 pins the diagram structure; the overview and cross-repository flows carry the operational reading | L |
| RSK-9 | Editing mermaid blocks while rewriting the overview flow breaks fence balance or the keyword line, with no renderer to catch it | L | M | NFR-7's structural read (even fence counts, tagged fences, keyword first line, one diagram per flow heading) is applied to every touched file | L |
| RSK-10 | `status.md` history is rewritten instead of appended while adding the snapshot | M | L | AC-F12-2 and NFR-11 use a whole-file retention oracle with additions confined to one section | L |
| RSK-11 | The M3-S6 reconciliation is read as re-scoping M3 hygiene work, creating an apparent delivery change | M | L | F-13 and AC-F13-1 keep M3-S6 delivery attribution unchanged and only restate the verbs as family subcommands; the registry row's Delivery column keeps M3-S6 | L |
| RSK-12 | A contract name for the flat envelope drifts between `repos.v1` and an invented synonym, so the pages point at different contracts | M | M | DEC-3 fixes `repos.v1` as the single name; AC-F6-1 and AC-F7-1 both require it | L |

## 12. ASSUMPTIONS

- The ticket body is the normative requirement source for the M2-S11 amendment, the S18 and S19 story text, the blueprint targets, and the acceptance list.
- M2 has not been delivered: no `projects list`, `repos list`, group surface, workspace discovery, or cross-repository lifecycle exists in the product, in `doc/spec/**`, or in any entrypoint. The rename-transition clause is therefore recorded as a conditional and requires no alias mechanics now.
- `doc/planning/**` is outside the distribution-marker guard's scan set but inside the forbidden-literals guard's `userFacingDocs` scope, so the one new pack page needs exactly one registry row and the guard fails closed otherwise.
- `scripts/checks/forbidden-literals.ts` has no sorting requirement; the alphabetical convention of its `registered` list is followed for reviewability, and one pre-existing out-of-order pair is left untouched.
- No mermaid syntax validator exists in this repository, so diagram validity is established structurally (NFR-7) and no renderer or gate is invented.
- Backlog story order in the file is not numeric; insertion positions are read from the file, not assumed, and the Epic M2 block closes with a blank line and `---` before `## Epic M3`.
- Existing backlog and pack statements about M1 delivery, M2-S11 state scoping, and the daemon registration gap remain true and are preserved.
- M1-S17 is delivered, so M2-S19's dependency on it is satisfiable as stated.
- The environment's default `TMPDIR` is tmpfs; the two doc guards have opposite `TMPDIR` requirements, and both are recorded rather than resolved by changing the environment for the repository. The default-run aggregate gate has two known failure modes — the cross-device `ci-baseline-parity` clone and the 5000 ms `TC-WIRE-002` timeout — both of which the full repository-local suite clears.
- Story codes, not file positions, identify stories, and pack documents reference story codes instead of restating acceptance blocks.

## 13. DEPENDENCIES

| Direction | Item | Notes |
|-----------|------|-------|
| Depends on | GH-303 ticket text | Normative source for the amendment, both stories, the blueprint targets, and acceptance |
| Depends on | Delivered M1 baseline (M1-S17 in particular) | M2-S19's dependency line names M1-S17; the M2-S11 state-scoping premises are M0-S5 and M1-S17 |
| Depends on | Current M2 corpus (backlog, pack, indices, status snapshot, registry) | Every touched file must exist in its GH-284 state before the amendment applies; verified in the working tree |
| Depends on | Doc guards and the aggregate gate | `test-doc-distribution.sh` (default `TMPDIR`), `forbidden-literals` (one new registration), `pnpm check` (repository-local `TMPDIR`, full suite, authoritative) |
| Blocks | M2-S18 and M2-S19 ticket creation and delivery | Tickets are created from backlog entries; the pack seeds each story's test plan |
| Blocks | Any M2 board work that scopes to a project | The group envelope is the surface such work consumes; the pack records it as advisory until S18 delivers |
| Related | M2-S4 board | Consumes the group envelope; its dependency set is deliberately unchanged (NG-5) and the map row carries the advisory note |
| Related | M3-S6 repository hygiene | The hygiene verbs become `repos` subcommands delivered later; no M3 delivery is changed |
| Related | #286 (daemon mount) | Untouched prerequisite context recorded in the entrypoint delta note; not re-litigated here |

## 14. OPEN QUESTIONS

None outstanding. The two ambiguities the ticket carried — the `repos`/M3-S6 name reservation and the unnamed entrypoint delta note — were resolved by the PM's intake decisions and are recorded as DEC-2 and DEC-4. Every other editing choice (contract name, insertion position, status handling, alias timing) is recorded as a decision rather than left open.

| ID | Question | Context | Status |
|----|----------|---------|--------|
| — | None outstanding | — | Closed |

## 15. DECISION LOG

| ID | Decision | Rationale | Date |
|----|----------|-----------|------|
| DEC-1 | The change is docs-only and its product-file budget is exactly 13 files: 12 under `doc/planning/oss-tooling/**` (11 modified plus 1 new) plus `scripts/checks/forbidden-literals.registry.json` | The ticket's acceptance is "docs-only change; guards green; no code"; the registry row is required because the forbidden-literals guard scans `doc/planning/**` and fails closed | 2026-11-11 |
| DEC-2 | `repos` is the flat enumeration family owned by the amended M2-S11 (`repos list`), and the M3-S6 clone/branch/worktree hygiene verbs are that family's later subcommands; `projects` is the group surface owned by M2-S18 | The ticket assigns the flat enumeration to the name M3 reserves; leaving the registry's two meanings unreconciled would break the "guards green, no contradictions" acceptance, so the family is defined once and its later verbs are scoped inside it | 2026-11-11 |
| DEC-3 | The flat enumeration contract is named `repos.v1` and `projects.v1` is redefined as the group envelope | The pack's contract names are one per surface (`attempts.v1`, `telemetry.v1`); a single fixed name keeps the two command pages pointing at one contract and makes the field split checkable | 2026-11-11 |
| DEC-4 | The ticket's "entrypoint delta note" is read as two requirements: one new Epic M2 context paragraph in `backlog.md`, and the correction of `m2/entrypoint-delta.md`'s root-family line and mounting paragraph | The backlog bullet and the blueprint bullet each name a delta note; both are needed so the story set and the blueprint say the same thing | 2026-11-11 |
| DEC-5 | Index edits are in scope as derived consistency: `m2/README.md`'s contents table and story-to-artifact map, and `milestones/README.md`'s M2 index row | A new page and two new stories that no index points at are not discoverable; the GH-284 precedent treated the same index as part of the pack | 2026-11-11 |
| DEC-6 | `status.md` gains one new dated section only; no earlier dated section is edited and no base line is modified, and the new section claims planning state, not delivery | Follows the GH-266 and GH-284 precedent: dated sections are historical records, and the snapshot records the amendment as plan state | 2026-11-11 |
| DEC-7 | No deprecation alias is implemented or specified as active; the backlog entry records the conditional transition only | Nothing has shipped, so there is no `projects list` to alias; specifying alias mechanics for an unbuilt surface would invent behaviour | 2026-11-11 |
| DEC-8 | M2-S18 and M2-S19 are inserted after the M2-S17 entry and before the blank line and `---` separator that close the Epic M2 block, in code order S18 then S19, and M2-S11 is amended in place | Appending inside the block minimises the diff and preserves every anchor; the epics' separators are structural, so inserting below one would strand it inside the block | 2026-11-11 |
| DEC-9 | The three-level model is stated in the C4 Level 1 context with membership and optionality visible in the diagram, and a new `### Cross-repository change` flow is added under `## Key flows`; the overview flow is rewritten in place | The model is the change's central claim, so it must be drawn where a reader starts; keeping the flow section's structure preserves the pack convention | 2026-11-11 |
| DEC-10 | `commands/repos.md` is a new page carrying the flat enumeration content moved from `projects.md` with a rename note; `projects.md` is rewritten in place as the group surface; both keep `Status: Proposed (M2)` | Two surfaces with two meanings need two pages, and rewriting in place keeps each page's identity and avoids a second rename on top of the first | 2026-11-11 |
| DEC-11 | `SC-M2-S11-01` is amended alongside `SC-M2-S11-02`: its assert line names the flat surface, so it must read `repos list` to satisfy the naming boundary | The ticket names only the second seed, but leaving the first seed's assert on `projects list` would be a surviving flat-enumeration statement and make the boundary AC unsatisfiable | 2026-11-11 |
| DEC-12 | Mixed tracker kinds are declared valid configuration at validation time, and a member whose tracker kind has no implemented adapter is classified with the fixed token `not-yet-supported` in the envelope and the group listing | The ticket requires "accepted at validation time … classified as not-yet-supported rather than rejected silently"; a fixed token makes the clause testable instead of a prose promise | 2026-11-11 |
| DEC-13 | The project configuration schema and the cross-repository change plan shape are documented as planned data shapes in `contracts.md`, not as delivered configuration or lifecycle behaviour | M2-S18 and M2-S19 are undelivered stories; the pack records intended contracts, and status semantics keep them planned | 2026-11-11 |
| DEC-14 | M2-S4's dependency set is not amended; this change adds the pack's advisory phrase ("advisory: consumed at delivery; the owning story declares the edge") to the map row pointing the board at the group envelope, in the same form the M2-S3, M2-S5 and M2-S10 rows use | NG-5 keeps this change's edits inside the ticket's story set; the advisory convention records the map-vs-dependency gap without misstating S4's scope | 2026-11-11 |
| DEC-15 | The registry edit is exactly one row, inserted at its lexicographic position inside the `m2/commands/` group (between `queue.md` and `spend.md`); the one pre-existing out-of-order pair elsewhere in the list is not re-sorted | The guard requires uniqueness and presence, not order; sorting only the new row keeps the diff minimal and reviewable | 2026-11-11 |
| DEC-16 | The gates are invoked per guard: the distribution guard with the default `TMPDIR`, and the aggregate gate with a repository-local `TMPDIR` as the authoritative full-suite run, with both aggregate runs recorded. A default-run `ci-baseline-parity` failure and a default-run `TC-WIRE-002` timeout are each recorded and re-run, and are excused only while the repository-local full suite is green on the same head; any other default-run failure, or a `TC-WIRE-002` repeat inside the repository-local run, is a delivery failure | The aggregate gate's two known default-`TMPDIR` failures are a cross-device clone and a 5000 ms timing sensitivity that passes inside the full repository-local suite, so the repository-local full suite decides delivery and every tolerated default-run failure is named, re-run, and conditional rather than waved through | 2026-11-11 |
| DEC-17 | Phase 7 records that no current-truth change is required, and `doc/spec/**` and `doc/overview/**` stay untouched | No delivered spec covers `repos`, `projects`, groups, workspaces, or cross-repository changes; inventing a spec update would create current truth for an undelivered plan | 2026-11-11 |

## 16. AFFECTED COMPONENTS (HIGH-LEVEL)

| Component | Impact |
|-----------|--------|
| `doc/planning/oss-tooling/backlog.md` | Updated: M2-S11 amended in place, M2-S18 and M2-S19 added, one Epic M2 context paragraph |
| `doc/planning/oss-tooling/milestones/m2/architecture.md` | Updated: three-level C4 context, project-scoped overview flow, cross-repository change flow, boundary invariants |
| `doc/planning/oss-tooling/milestones/m2/contracts.md` | Updated: `repos.v1`, redefined `projects.v1`, project configuration schema, cross-repository change plan shape |
| `doc/planning/oss-tooling/milestones/m2/commands/repos.md` | New: flat enumeration contract with rename note |
| `doc/planning/oss-tooling/milestones/m2/commands/projects.md` | Updated: rewritten as the group surface with members, health, state, and project scope |
| `doc/planning/oss-tooling/milestones/m2/test-scenarios.md` | Updated: S18 and S19 seeds, S11 seeds amended to `repos list` |
| `doc/planning/oss-tooling/milestones/m2/journeys.md` | Updated: multi-repository morning overview rewritten as a project-scoped overview |
| `doc/planning/oss-tooling/milestones/m2/entrypoint-delta.md` | Updated: `repos`/`projects` split in the planned additions and the mounting paragraph |
| `doc/planning/oss-tooling/milestones/m2/README.md` | Updated: pack-contents row for `commands/repos.md`, map rows for S18 and S19, S11 row on `repos.v1` |
| `doc/planning/oss-tooling/milestones/README.md` | Updated: M2 index row gains `m2/commands/repos.md` |
| `doc/planning/oss-tooling/status.md` | Updated: one new dated planning snapshot |
| `doc/planning/oss-tooling/cli-command-registry.md` | Updated: `ados repos` (M2), `ados projects` (groups), M3-S6 row reconciled, boundary note replaced |
| `scripts/checks/forbidden-literals.registry.json` | Updated: one registration for the new pack page |
| `doc/spec/**`, `doc/overview/**`, `packages/**`, `tests/**`, `.opencode/**`, `.ai/**`, all other `scripts/**`, the M1 pack, and the M0 pack | Unchanged |

## 17. ACCEPTANCE CRITERIA

### 17.1 Functional

| ID | Criterion | Linked |
|----|-----------|--------|
| AC-F1-1 | **Given** the M2-S11 entry in `backlog.md`, **when** it is compared with the base revision, **then** the heading, the `- Depends on: M0-S5, M1-S17.` line, the per-repository state scoping derived from the checkout identity with a host-level index, the migration note, the tests clause, and the two-checkout ref-GH-241 collision acceptance criterion are unchanged in substance; the goal, the enumeration task, and the enumeration acceptance criterion name `repos list`; the enumeration fields are exactly repo key, root, state location, daemon reachability, and handover state; and the entry records that if the flat `projects list` ships first, the group story renames it with a deprecation alias. | F-1, DM-1 |
| AC-F1-2 | **Given** the amended M2-S11 entry, **when** every occurrence of the two names in it is read, **then** `projects list` does not appear as the enumeration surface, `repos list` does not appear with group semantics, and no clause of the retained state-scoping or collision set has been weakened, merged, or moved to another story. | F-1, NFR-8 |
| AC-F2-1 | **Given** `backlog.md`, **when** the Epic M2 block is read, **then** `### M2-S18 Project groups` appears with `- Goal:`, `- Tasks:`, `- AC:`, and `- Depends on: M2-S11.`, carrying all 12 ticket clauses enumerated in Appendix A (1 goal, 5 tasks, 5 acceptance, 1 dependency), with no `- Ticket:` line and no added acceptance criterion. | F-2, DM-1, NFR-8 |
| AC-F2-2 | **Given** the S18 entry and the contracts, **when** the mixed-tracker clause is checked, **then** the entry states that a configuration mixing tracker kinds is accepted at validation time with the unimplemented member classified not-yet-supported rather than rejected silently, and the contracts name the same classification and the same acceptance rule, with no clause softened to "supported later" or "rejected". | F-2, F-6, DEC-12 |
| AC-F3-1 | **Given** `backlog.md`, **when** the Epic M2 block is read, **then** `### M2-S19 Cross-repository changes` appears with `- Goal:`, `- Tasks:`, `- AC:`, and `- Depends on: M2-S11, M2-S18, M1-S17.`, carrying all 11 ticket clauses enumerated in Appendix A (1 goal, 6 tasks, 3 acceptance, 1 dependency), with no added criterion and no omitted clause. | F-3, DM-1, NFR-8 |
| AC-F3-2 | **Given** the S19 entry, **when** its acceptance block is read, **then** each of its three criteria is independently identifiable: (1) a two-repository change produces one spec, two branches, two PRs, one review flow, and a closeout that lands both; (2) per-repo CI truth is corroborated per member before the change counts done; (3) a member failing its gates blocks the shared DoD with the failing member named. | F-3, NFR-8 |
| AC-F3-3 | **Given** `contracts.md`'s cross-repository change plan shape, **when** it is read against the S19 task clauses, **then** it declares member repositories and their slices, one lifecycle driving per-member branches and pull requests, per-member gates, one shared definition of done, per-member closeout with branch cleanup and per-tracker issue closure, dependency edges between member steps where order matters, and evidence enumerating every member pull request. | F-3, F-6, DM-6 |
| AC-F4-1 | **Given** the `backlog.md` diff against the base revision, **when** insertion positions are checked, **then** the two new entries lie after the M2-S17 entry's last line, inside the Epic M2 block, and before the blank line and `---` separator that close the block; the separator, the blank line after it, and the `## Epic M3` heading are byte-identical and follow the inserted entries. | F-4, NFR-2, DEC-8 |
| AC-F4-2 | **Given** the Epic M2 block, **when** it is compared with the base revision, **then** one new context paragraph follows the existing retirement note and precedes `### M2-S2`, stating the repository/project/workspace distinction, the `repos`/`projects` boundary, and the root-family consequence for the entrypoint; the retirement note, the epic heading, the frontmatter, the reading guide, the cross-cutting principles, and every other story are byte-identical. | F-4, NFR-2, DEC-4 |
| AC-F4-3 | **Given** the `backlog.md` diff with zero context, **when** the hunks are inspected, **then** every hunk lies inside the M2-S11 entry, the one added context paragraph, or one of the two inserted entries, and no hunk quotes a neighbouring story's line. | F-4, NFR-2 |
| AC-F5-1 | **Given** `milestones/m2/architecture.md`, **when** its C4 Level 1 context is read, **then** it presents repository, project, and workspace as three related levels — the repository as the delivery unit, the project as a configured group of repositories with declared members, the workspace as an optional directory usable as a discovery root — with the optionality visible in the diagram and prose, and no level described as mandatory that the ticket calls optional. | F-5, DM-2, RSK-8 |
| AC-F5-2 | **Given** the same document, **when** the model prose is read, **then** a project's membership is declared in configuration, a workspace is never required, a project whose members live in unrelated directories behaves identically to one whose members share a workspace directory, and no member repository is required to live inside a workspace. | F-5, DM-2, DM-3 |
| AC-F5-3 | **Given** `milestones/m2/architecture.md`, **when** the flows and invariants are read, **then** the multi-repository overview flow is scoped to a project (group resolution, member enumeration, optional workspace discovery, per-member state and health) and no longer starts from a flat host list; a `### Cross-repository change` flow exists describing one lifecycle across member branches and pull requests, per-member gates, the shared definition of done, and closeout; and `## Boundary invariants at M2 exit` states the naming boundary, declared membership, workspace optionality, and one lifecycle per cross-repository change. | F-5, DM-2, DM-6 |
| AC-F6-1 | **Given** `contracts.md`, **when** the flat enumeration contract is read, **then** it is named `repos.v1`, owned by the amended M2-S11, and defines the record as repo key derived from the checkout identity, root, state location, daemon reachability with a degradation reason, handover state, and the host index revision, matching the fields the S11 entry names. | F-6, DM-4, DEC-3 |
| AC-F6-2 | **Given** the redefined `projects.v1`, **when** its fields are read, **then** it carries a group identity and name, a member list where each member carries its own repo key, root, tracker kind, state, and health, and the optional workspace root; it defines the project scope accepted by queue and status reads; and no group-named field denotes a repository, while no member field denotes the group. | F-6, DM-5, RSK-3 |
| AC-F6-3 | **Given** the project configuration schema, **when** it is read, **then** it declares a project, its member repositories, a tracker kind per member, and an optional workspace discovery root; it states that mixed tracker kinds are valid at validation time and that a member whose tracker kind has no implemented adapter is classified not-yet-supported rather than rejected; and it states that a configuration without any workspace root is valid and behaves identically. | F-6, DM-3, DEC-12 |
| AC-F6-4 | **Given** the cross-repository change plan shape, **when** it is read, **then** it declares member repositories and their slices, one lifecycle producing a branch and pull request per member, per-member gates, one shared definition of done, per-member closeout with branch cleanup and per-tracker issue closure, dependency edges between member steps where order matters, and evidence enumerating every member pull request. | F-6, DM-6 |
| AC-F6-5 | **Given** `contracts.md` and `milestones/m2/README.md`, **when** the downstream consumers of the group envelope are checked, **then** the contracts state that consumers of `projects.v1` read the group envelope with its members; the M2-S4 story-to-artifact map row pointing at that envelope gains the advisory note "(advisory: consumed at delivery; the owning story declares the edge)" in the same phrasing the M2-S3, M2-S5 and M2-S10 rows use, rather than a new dependency edge. | F-6, F-11, DEC-14 |
| AC-F7-1 | **Given** `milestones/m2/commands/repos.md`, **when** it is read, **then** it carries `Status: Proposed (M2)`, a bare `repos` name with the `<binary>` invocation prefix, the `repos list [--json]` synopsis, the five reported fields, the machine envelope under `repos[]`, exit codes, at least one invocation example, an error table, and see-also links; and it contains a rename note stating that the content was the flat enumeration previously documented as `projects list` and now belongs to `repos` under the amended M2-S11. | F-7, DM-8, DEC-10 |
| AC-F7-2 | **Given** `milestones/m2/commands/projects.md`, **when** it is read, **then** it carries `Status: Proposed (M2)`, a bare `projects` name, a synopsis offering group listing and the project scope used by queue and status reads, member repositories with health and state in its output shape, references to the group envelope and the project configuration schema, and the naming boundary; and it contains no statement that `projects list` enumerates managed checkouts. | F-7, DM-5, DM-8, DEC-10 |
| AC-F7-3 | **Given** the two command pages together, **when** their surfaces are compared, **then** the flat enumeration appears only on the `repos` page and the group surface only on the `projects` page, each page points at its own contract, and both pages state the planned status without claiming registration at the root listing. | F-7, F-14, NFR-3 |
| AC-F8-1 | **Given** `test-scenarios.md`, **when** the S18 and S19 seeds are counted and read, **then** at least two `SC-M2-S18-*` and at least two `SC-M2-S19-*` seeds exist, each carrying exactly one `Assert:` line; the S18 set covers discovery through a registered workspace directory, the same project without a workspace, group listing with members and state, project-scoped queue and status reads, and mixed tracker-kind classification; the S19 set covers one spec with two member branches, two pull requests, one review flow and one closeout, plus a failing member blocking the shared definition of done with the member named. | F-8, DM-7 |
| AC-F8-2 | **Given** the two `SC-M2-S11-*` seeds, **when** they are read, **then** both use the `repos list` surface, the first seed's assert line refers to `repos list` rows rather than `projects list` rows, the second seed's title and prose name `repos list`, its asserted fields are the five flat-enumeration fields, and no scenario in the file asserts that `projects list` enumerates checkouts. | F-8, F-14, DEC-11 |
| AC-F9-1 | **Given** `journeys.md`, **when** its opening journey is read, **then** it is a project-scoped morning overview over a project with several member repositories, at least one member outside any shared directory; it uses `repos list` for the flat view and `projects list` for the group view with members and health; it shows project-scoped queue and status reads; it states that the same project without a shared workspace reads identically; and it states that same-ref members stay disjoint. | F-9, DM-5 |
| AC-F10-1 | **Given** `entrypoint-delta.md`, **when** its M2-planned additions and mounting paragraph are read, **then** they list `repos` as the flat enumeration of managed checkouts (amended M2-S11) and `projects` as the group surface (M2-S18) as two additions, the mounting paragraph names both families where it previously named `projects`, and the page no longer describes `projects` as the host overview; the observed composition, the daemon gap, the snapshot statement, and the remaining planned additions are unchanged in meaning. | F-10, DEC-4 |
| AC-F11-1 | **Given** `milestones/m2/README.md`, **when** its pack-contents table and story-to-artifact map are read, **then** the table carries one row for `commands/repos.md` with its purpose alongside the other twelve, the map carries a row for M2-S18 and a row for M2-S19 naming their architecture flow, contract surfaces, and seeds, the M2-S11 row points at `repos.v1`, and the planned-until-exit statement is unchanged. | F-11, F-14 |
| AC-F11-2 | **Given** `milestones/README.md`, **when** its `## Index` table is read, **then** the M2 row links `m2/commands/repos.md` in addition to its previous twelve targets, for thirteen targets, with the table formatting followed, and the M0 and M1 rows are byte-identical to the base revision. | F-11, DEC-5 |
| AC-F12-1 | **Given** the new dated section in `status.md`, **when** it is read, **then** it records this amendment as planning state: the three-level model, the M2-S11 amendment with its transition note, the addition of M2-S18 and M2-S19 with their dependencies, the naming boundary and its registry reconciliation, and the corrected entrypoint delta note; and it claims neither M2 delivery nor milestone exit. | F-12, DEC-6 |
| AC-F12-2 | **Given** `status.md` compared with the base revision, **when** a line-retention comparison runs over the whole file, **then** every base line is present, in the same order, byte-identical, and every added line lies inside the one new dated section. | F-12, NFR-11, DEC-6 |
| AC-F13-1 | **Given** `cli-command-registry.md`, **when** the `repos` and `projects` rows and the boundary note are read, **then** the M2 table carries an `ados repos` row whose purpose is the flat enumeration with the five reported fields and Delivery M2-S11; the `ados projects` row's purpose is the group surface with membership, health, state, and project-scoped reads and Delivery M2-S18; the M3-S6 row attributes clone, branch, and worktree hygiene to `repos` subcommands delivered later; the boundary note states the naming boundary; and no row attributes a delivered surface to either family. | F-13, DEC-2, NFR-3 |
| AC-F13-2 | **Given** the `cli-command-registry.md` diff, **when** the rows are compared with the base revision, **then** only the `ados projects` row, the M3-S6 row, the boundary note line, and the one added `ados repos` M2 row differ; every other row, including the historical rename note, is byte-identical. | F-13, NFR-1 |
| AC-F14-1 | **Given** the twelve touched planning documents, **when** the corpus is searched for both names, **then** zero occurrences of `projects list` or `projects` denote the flat enumeration and zero occurrences of `repos list` or `repos` denote a group; every location in Appendix B is in the state the matrix requires. | F-14, NFR-12, RSK-1 |
| AC-F14-2 | **Given** any location that names both surfaces, **when** its surrounding text is read, **then** it states the boundary once in the same terms — `repos` enumerates checkouts, `projects` groups them — and no two touched pages give the two names contradictory meanings. | F-14, DM-2, RSK-1 |

### 17.2 Non-Functional

| ID | Criterion | Linked |
|----|-----------|--------|
| AC-NFR1-1 | **Given** the whole-change diff filtered to product files (all paths except `doc/changes/**`), **when** the changed-path list is inspected, **then** exactly 13 files change — 12 under `doc/planning/oss-tooling/**` (the eleven modified documents plus the new `milestones/m2/commands/repos.md`) and `scripts/checks/forbidden-literals.registry.json` — and zero files change under `doc/spec/**`, `doc/overview/**`, `doc/guides/**`, `doc/templates/**`, `packages/**`, `tests/**`, `.opencode/**`, `.ai/**`, or any other `scripts/**` path. | NFR-1 |
| AC-NFR2-1 | **Given** the `backlog.md` diff, **when** the preservation set is checked, **then** every heading except the two new entries is byte-identical, every existing story except M2-S11 is byte-identical, the frontmatter, reading guide, cross-cutting principles, epic retirement note, closing separator, and `## Epic M3` heading are byte-identical, and no story code has been renamed, reordered, or removed. | NFR-2, F-4 |
| AC-NFR3-1 | **Given** the touched pack pages, **when** their status is read, **then** `commands/repos.md` and `commands/projects.md` both carry the exact header `Status: Proposed (M2)`; zero occurrences in the touched corpus attribute `repos`, `projects`, project groups, workspace discovery, or cross-repository changes to a delivered, current, or shipped surface; the pack README's planned-until-exit statement survives verbatim; and no page is relabelled as a snapshot. | NFR-3, F-7, F-12, RSK-5 |
| AC-NFR4-1 | **Given** the branch head, **when** `scripts/checks/forbidden-literals.registry.json` is read and the guard runs, **then** `registered` holds exactly one more entry than the base revision (139 → 140), that entry is `doc/planning/oss-tooling/milestones/m2/commands/repos.md`, it sits between the `queue.md` and `spend.md` entries with the surrounding order preserved, there are no duplicates, every other entry is byte-identical, and the guard reports zero unregistered-doc findings and zero violations. | NFR-4, DEC-15 |
| AC-NFR5-1 | **Given** the branch head, **when** `bash scripts/.tests/test-doc-distribution.sh` runs with the default `TMPDIR`, **then** it exits 0 and no planning document carries an `ados_distribution` marker. | NFR-5, DEC-16 |
| AC-NFR6-1 | **Given** the branch head, **when** the aggregate gate is run once with the default `TMPDIR` and once with a repository-filesystem `TMPDIR` created under the repository, **then** (a) the repository-local full-suite run exits 0 and is the authoritative gate, so any failure in it — including a repeated `TC-WIRE-002` timeout — is a delivery failure; (b) both invocations and their results are recorded; (c) a default-run failure of `tests/checks/ci-baseline-parity.test.ts` and a default-run `TC-WIRE-002` timeout in `tests/checks/privacy-ci-wiring.test.ts` are each recorded and re-run, and are not delivery failures only because the repository-local run is green on the same head; and (d) any other default-run failure is a delivery failure to investigate, never silently reclassified as environmental. | NFR-6, DEC-16, RSK-7 |
| AC-NFR7-1 | **Given** each touched file that contains mermaid, **when** the structural read runs (fence count, fence tag, first body line keyword, heading association), **then** fence counts are even, every diagram fence is tagged `mermaid`, every first body line begins with an allowed diagram-type keyword, `## C4 Level 1`, `## C4 Level 2`, and `## C4 Level 3` each appear exactly once, and `## Key flows` holds exactly 8 `###` headings each owning exactly one mermaid block; no validator, script, or gate is added. | NFR-7, RSK-9 |
| AC-NFR8-1 | **Given** the amended and new backlog entries, **when** each is diffed clause by clause against Appendix A, **then** 26 of 26 ticket clauses are present, the missing-clause, added-criterion, and changed-meaning counts are each zero, and the only differences are whitespace, line wrapping, and typographic normalisation. | NFR-8, F-1, F-2, F-3 |
| AC-NFR9-1 | **Given** all new and changed text, **when** the forbidden-literals guard runs with all scope classes scanned, **then** it reports zero violations and no private fleet, repository, host, hosted, or proprietary product name appears. | NFR-9, RSK-1 |
| AC-NFR10-1 | **Given** the touched documents, **when** their relative links and content are inspected, **then** zero relative links are broken and zero pack documents restate a story's acceptance block instead of referencing its code. | NFR-10 |
| AC-NFR11-1 | **Given** `status.md`, **when** the retention oracle runs over the whole file, **then** zero base lines are removed, reordered, or modified, and every added line lies inside the new dated section; no whole-section `cmp` is asserted. | NFR-11, F-12 |
| AC-NFR12-1 | **Given** the twelve planning documents, **when** the naming-boundary scan runs, **then** the count of `projects list` occurrences with flat-enumeration meaning is 0, the count of `repos list`/`repos` occurrences with group meaning is 0, and 100% of Appendix B's rows hold their required meaning. | NFR-12, F-14, RSK-1 |

### 17.3 Definition of Done

- [ ] `backlog.md` carries the amended M2-S11 (state scoping, host index, migration note, collision tests, and the GH-241 collision AC retained; enumeration surface `repos list`; rename transition recorded), M2-S18 and M2-S19 inside the Epic M2 block with their 23 ticket clauses and the amendment's 3, and one new Epic M2 context paragraph, with the separator and `## Epic M3` intact and every other byte preserved (AC-F1-1, AC-F1-2, AC-F2-1, AC-F3-1, AC-F4-1, AC-F4-2, AC-F4-3, AC-NFR2-1, AC-NFR8-1).
- [ ] `milestones/m2/architecture.md` states the three-level model in the C4 context with workspace optionality visible, rewrites the overview flow as project-scoped, adds the cross-repository change flow, and extends the boundary invariants with the naming boundary, declared membership, workspace optionality, and one lifecycle per cross-repository change; diagram structure holds (AC-F5-1, AC-F5-2, AC-F5-3, AC-NFR7-1).
- [ ] `milestones/m2/contracts.md` defines `repos.v1`, the redefined `projects.v1` group envelope with member fields, the project configuration schema with mixed tracker kinds and the not-yet-supported classification, the optional workspace discovery root, the cross-repository change plan shape, and the consumer note for the group envelope, and the M2-S4 map row carries the advisory note (AC-F6-1, AC-F6-2, AC-F6-3, AC-F6-4, AC-F6-5, AC-F2-2, AC-F3-3).
- [ ] `milestones/m2/commands/repos.md` exists as the flat enumeration contract with the rename note, and `commands/projects.md` is rewritten as the group surface with members, health, state, and project scope; both keep `Status: Proposed (M2)` and neither attests the other's surface (AC-F7-1, AC-F7-2, AC-F7-3, AC-NFR3-1).
- [ ] `test-scenarios.md` carries at least two S18 and two S19 seeds with one `Assert:` line each, and both S11 seeds use `repos list`; `journeys.md`'s opening journey is project-scoped and states workspace optionality and same-ref disjointness (AC-F8-1, AC-F8-2, AC-F9-1).
- [ ] `entrypoint-delta.md` records the `repos`/`projects` split in its planned additions and mounting paragraph without claiming `projects` is the host overview (AC-F10-1).
- [ ] `milestones/m2/README.md` lists the new page and maps S18 and S19 with the S11 row on `repos.v1`; `milestones/README.md`'s M2 row links thirteen targets with M0 and M1 untouched (AC-F11-1, AC-F11-2).
- [ ] `status.md` carries one new dated section claiming planning state only, under the retention oracle; `cli-command-registry.md` reconciles `ados repos`, `ados projects`, the M3-S6 row, and the boundary note with every other row byte-identical (AC-F12-1, AC-F12-2, AC-F13-1, AC-F13-2, AC-NFR11-1).
- [ ] The naming boundary holds across every Appendix B location: zero flat-`projects list` statements, zero group-meaning `repos` statements, and no two pages in contradiction (AC-F14-1, AC-F14-2, AC-NFR12-1).
- [ ] Exactly 13 product files changed, the single registry row is in its sorted position, `bash scripts/.tests/test-doc-distribution.sh` exits 0 under the default `TMPDIR`, and the authoritative repository-local-`TMPDIR` full `pnpm check` exits 0 with both aggregate runs recorded; a default-run `ci-baseline-parity` failure and a default-run `TC-WIRE-002` timeout are each recorded, re-run, and excused only while the repository-local run is green on the same head, while any other default-run failure or a repository-local `TC-WIRE-002` repeat is treated as a delivery failure (AC-NFR1-1, AC-NFR4-1, AC-NFR5-1, AC-NFR6-1, AC-NFR9-1, AC-NFR10-1).
- [ ] No M2 story was delivered, no product behaviour, command composition, or entrypoint registration changed, no tracker ticket was created, and phase 7 recorded that no current-truth change is required (NG-1, NG-2, NG-4, DEC-17).

## 18. ROLLOUT & CHANGE MANAGEMENT (HIGH-LEVEL)

One docs-only pull request against `main-tools`. Recommended commit sequence, so each commit is reviewable on its own and later commits can point at earlier names: (1) the backlog — M2-S11 amendment, the context paragraph, M2-S18 and M2-S19; (2) contracts — `repos.v1`, the group envelope, the configuration schema, the change plan shape; (3) the command pages — new `repos.md`, rewritten `projects.md`; (4) architecture, scenarios, journeys, and the entrypoint delta note; (5) the indices, the status snapshot, the command registry, and the registry row. No feature flag, no migration, no coordination window: the documents are read by maintainers and delivery agents, and the only adoption step is that M2-S18 and M2-S19 tickets are created from the new backlog entries.

## 19. DATA MIGRATION / SEEDING (IF APPLICABLE)

N/A. No stored data, schema, index, or seed set changes. The only migration is editorial and naming-only: pages that meant the flat enumeration say `repos` instead of `projects`, and readers of the plan see the group surface where the group name always belonged. Because nothing has shipped, no user data and no runtime state is migrated, and no deprecation alias is active.

## 20. PRIVACY / COMPLIANCE REVIEW

None. The change touches public planning documents and adds no personal data, telemetry, tracking, or credential path. The planning text names tracker kinds generically (a per-member configuration field), never a specific credentialed integration, and no private host, repository, or product name is introduced.

## 21. SECURITY REVIEW HIGHLIGHTS

No security impact. The change adds no runtime surface, permission, credential flow, or executable content. The only security-adjacent statement is that tracker kinds are configuration data and that mixed kinds are validated rather than rejected; it introduces no new trust boundary. Published text must not include secrets, hostnames, or internal URLs, which NFR-9 covers.

## 22. MAINTENANCE & OPERATIONS IMPACT

- The naming boundary is now the corpus's maintenance invariant: any later page that speaks about managed checkouts uses `repos`, and any page about grouping uses `projects`. The Appendix B matrix is the review checklist while the rule is manual.
- The pack remains planned-until-M2-exit; the two command pages are proposals until their stories deliver, and the status snapshot records this amendment as plan state, not as delivery.
- Each future M2 delivery (S4, S18, S19) updates its backlog entry, its pack rows, and the status snapshot at meaningful boundaries, per the convention the 2026-11-10 snapshot states.
- If a flat `projects list` ever ships before M2-S18, the recorded transition applies: the group story renames it with a deprecation alias, and the registry, pack, and delta note are updated together so the boundary never splits.
- The M3-S6 hygiene verbs are part of the `repos` family; when they deliver, `repos.md` becomes the family page and gains the hygiene verbs, so the family page and the registry stay in step.

## 23. GLOSSARY

| Term | Definition |
|------|------------|
| Repository | One git checkout; the delivery unit, and the leaf of the three-level model. Identified by its checkout identity (the git common dir marker). |
| Project | A named group of repositories that belong together (a product or system spanning repositories), with membership declared in configuration. |
| Workspace | An optional persisted directory where a project's repositories are cloned; usable as a discovery root, never mandatory. Distinct from the per-change artifact set this repository also calls a workspace. |
| Member repository | A repository declared as part of a project. |
| Flat enumeration | The host-level list of managed checkouts with repo key, root, state location, daemon reachability, and handover state. Produced by `repos list`. |
| Group surface | The project-level view listing groups with their members, health, and state, and accepting a project scope for reads. Produced by `projects list`. |
| Naming boundary | The rule that `repos` means the flat enumeration (and, later, its hygiene subcommands) while `projects` means groups, stated wherever both names appear. |
| Cross-repository change | One change spanning member repositories of one project: one lifecycle, one spec and plan, one definition of done, a branch and pull request per member. |
| Slice | The part of a cross-repository change that belongs to one member repository. |
| Deprecation alias | The compatibility name a renamed surface keeps if a flat `projects list` had shipped before the group story. Not active; recorded as a condition. |
| Planned-until-exit | Pack convention: everything in a milestone pack is a proposal until the milestone exits, after which the pack is a snapshot. |
| Docs-only change | A change whose product files are documentation plus a data-only guard registry registration, with no behaviour, test, or tooling change. |

## 24. APPENDICES

### Appendix A — Ticket clause table (fidelity oracle)

The table is the oracle for AC-F2-1, AC-F3-1, and AC-NFR8-1: 26 clauses, each present in the backlog entry with unchanged meaning. Clause IDs are for the change artifacts, not for the backlog.

| Clause | Source | Required substance | Spec requirement |
|---|---|---|---|
| S18-G | S18 Goal | A project is a configured group of repositories; the tooling can enumerate groups with their members and scope delivery views per project, with the workspace directory usable as an optional discovery root. | F-2 |
| S18-T1 | S18 Tasks | Project configuration declaring member repositories (any tracker adapter; mixed trackers remain valid configuration even if only GitHub is exercised initially). | F-2, F-6 |
| S18-T2 | S18 Tasks | Optional workspace-directory discovery root: register a directory, scan for managed clones inside; never required. | F-2, F-6 |
| S18-T3 | S18 Tasks | `projects list` rendering groups with member repos, health, and state. | F-2, F-7 |
| S18-T4 | S18 Tasks | Project scoping for queue and status reads. | F-2, F-6, F-7 |
| S18-T5 | S18 Tasks | Naming boundary documented: `repos` = flat enumeration, `projects` = groups. | F-2, F-14 |
| S18-A1 | S18 AC | A project with two member repositories in one workspace directory is discoverable by registering that directory. | F-6, F-8 |
| S18-A2 | S18 AC | The same project configured with repositories in unrelated directories behaves identically (workspace optional). | F-5, F-6, F-8 |
| S18-A3 | S18 AC | `projects list` shows the group with both members and their state. | F-6, F-7 |
| S18-A4 | S18 AC | Queue and status accept a project scope. | F-6, F-7 |
| S18-A5 | S18 AC | A configuration mixing tracker kinds is accepted at validation time with the unimplemented member classified as not-yet-supported rather than rejected silently. | F-2, F-6, DEC-12 |
| S18-D | S18 Depends | M2-S11. | F-2 |
| S19-G | S19 Goal | One change may span multiple repositories of one project: one lifecycle, one spec and plan, one definition of done, with a branch and pull request per member repository. | F-3 |
| S19-T1 | S19 Tasks | The plan declares member repositories and their slices. | F-3, F-6 |
| S19-T2 | S19 Tasks | One lifecycle drives per-repo branches and PRs. | F-3, F-6 |
| S19-T3 | S19 Tasks | Per-repo gates and one shared DoD. | F-3, F-6 |
| S19-T4 | S19 Tasks | Closeout across member repositories (branch cleanup, issue closure per tracker). | F-3, F-6 |
| S19-T5 | S19 Tasks | Dependency edges between member repositories' steps where order matters. | F-3, F-6 |
| S19-T6 | S19 Tasks | Evidence records enumerate all member PRs. | F-3, F-6 |
| S19-A1 | S19 AC | A two-repository change produces one spec, two branches, two PRs, one review flow, and a closeout that lands both. | F-3, F-6 |
| S19-A2 | S19 AC | Per-repo CI truth is corroborated per member before the change counts done. | F-3, F-6 |
| S19-A3 | S19 AC | A member failing its gates blocks the shared DoD with the failing member named. | F-3, F-6, F-8 |
| S19-D | S19 Depends | M2-S11, M2-S18, M1-S17. | F-3 |
| S11-1 | M2-S11 amendment | Per-repository state scoping, host index, and collision ACs unchanged. | F-1 |
| S11-2 | M2-S11 amendment | The enumeration surface becomes `repos list` (repo key, root, state location, daemon reachability, handover state). | F-1 |
| S11-3 | M2-S11 amendment | Note the rename transition: if `projects list` ships first as the flat enumeration, the group story renames it with a deprecation alias. | F-1, DEC-7 |

### Appendix B — Naming-boundary matrix (consistency oracle)

Every row is a location the naming boundary must hold in. "Flat" means the location uses `repos`/`repos list` for the enumeration of managed checkouts; "Group" means it uses `projects`/`projects list` for a configured group.

| Location | What it must say | What it must not say |
|---|---|---|
| `backlog.md` M2-S11 | Flat: `repos list` enumerates checkouts with the five fields; transition note recorded | `projects list` as the enumeration surface |
| `backlog.md` M2-S18 / M2-S19 | Group: `projects list` renders groups; boundary stated in S18-T5 | `repos` as a group; `projects` as a checkout list |
| `backlog.md` Epic M2 context paragraph | Both: three-level model plus the boundary | Any claim that `projects` enumerates checkouts |
| `m2/contracts.md` `repos.v1` | Flat: `repos list` envelope | Group fields in the flat envelope |
| `m2/contracts.md` `projects.v1` + configuration schema | Group: group identity, members with repo keys and tracker kinds, optional workspace root | A group-named key denoting a repository |
| `m2/architecture.md` | Both: three-level context, project-scoped overview flow, cross-repository change flow, boundary invariants | `projects list` as the host index reader; `repos` as a group |
| `m2/commands/repos.md` | Flat, with the rename note | Any group surface |
| `m2/commands/projects.md` | Group, with members, health, state, project scope | Any statement that it enumerates checkouts |
| `m2/test-scenarios.md` S11 seeds | Flat: `repos list` in prose, titles, and assert lines | `projects list` rows for checkouts |
| `m2/test-scenarios.md` S18/S19 seeds | Group: group listing and project scope; cross-repository lifecycle | Flat-enumeration assertions |
| `m2/journeys.md` opening journey | Both, with each name in its own role | `projects list` as the flat view |
| `m2/entrypoint-delta.md` planned additions and mount paragraph | Both families, each with its own meaning | `projects` as the host overview |
| `m2/README.md` contents and map rows | Both: `repos.md` row; S11 on `repos.v1`; S4 row carries the advisory note; S18/S19 on the group envelope and change plan shape | Map rows conflating the two |
| `milestones/README.md` M2 row | Both pages linked (13 targets) | — |
| `cli-command-registry.md` rows and boundary note | Flat (`ados repos`, M2-S11), Group (`ados projects`, M2-S18), hygiene verbs as `repos` subcommands (M3-S6 later) | The old "distinct surfaces" note; `projects` as workstation overview |
| `status.md` new section | Both, in the same terms | Any contrary meaning |

### Appendix C — File manifest and change type

| # | Path | Change |
|---|---|---|
| 1 | `doc/planning/oss-tooling/backlog.md` | Amend M2-S11 in place; add one Epic M2 context paragraph; insert M2-S18 and M2-S19 |
| 2 | `doc/planning/oss-tooling/milestones/m2/architecture.md` | Three-level C4 context; project-scoped overview flow; cross-repository change flow; boundary invariants |
| 3 | `doc/planning/oss-tooling/milestones/m2/contracts.md` | Add `repos.v1`; redefine `projects.v1`; add configuration schema and cross-repository change plan shape |
| 4 | `doc/planning/oss-tooling/milestones/m2/commands/repos.md` | **New** flat-enumeration contract with rename note |
| 5 | `doc/planning/oss-tooling/milestones/m2/commands/projects.md` | Rewrite as the group surface |
| 6 | `doc/planning/oss-tooling/milestones/m2/test-scenarios.md` | Add S18/S19 seeds; amend both S11 seeds |
| 7 | `doc/planning/oss-tooling/milestones/m2/journeys.md` | Rewrite the opening journey as project-scoped |
| 8 | `doc/planning/oss-tooling/milestones/m2/entrypoint-delta.md` | Split the `projects` host-overview line into `repos` and `projects`; correct the mount paragraph |
| 9 | `doc/planning/oss-tooling/milestones/m2/README.md` | Contents row for `repos.md`; map rows for S18/S19; S11 on `repos.v1`; the S4 row gains the advisory note |
| 10 | `doc/planning/oss-tooling/milestones/README.md` | M2 index row gains `m2/commands/repos.md` |
| 11 | `doc/planning/oss-tooling/status.md` | One new dated planning snapshot |
| 12 | `doc/planning/oss-tooling/cli-command-registry.md` | `ados repos` (M2), `ados projects` (groups), M3-S6 reconciled, boundary note replaced |
| 13 | `scripts/checks/forbidden-literals.registry.json` | One registration for the new pack page |

### Appendix D — Gate and evidence record

| Evidence | How it is produced | Expected result |
|---|---|---|
| Distribution-marker guard | `bash scripts/.tests/test-doc-distribution.sh` with the default `TMPDIR` | exit 0; 0 markers added |
| Aggregate gate (authoritative) | `mkdir -p <repo>/tmp/tmpdir && TMPDIR=<repo>/tmp/tmpdir pnpm check`, full suite | exit 0; any failure is a delivery failure |
| Aggregate gate (recorded) | `pnpm check` with the default `TMPDIR` | recorded; a `ci-baseline-parity` failure and a `TC-WIRE-002` 5000 ms timeout each recorded and re-run, tolerated only while the authoritative run is green on the same head; any other failure is a delivery failure |
| Forbidden-literals | `pnpm check`'s prompt/guard battery or the check's own entry point | 0 unregistered-doc findings, 0 violations, 140 registered entries |
| Clause fidelity | Appendix A diffed against the head backlog | 26 of 26 present, 0 added, 0 changed meaning |
| Naming boundary | Corpus search over the twelve planning documents plus the Appendix B walk | 0 flat-`projects list` occurrences, 0 group-meaning `repos` occurrences |
| Document structure | Structural read of fence counts, fence tags, keyword lines, and heading association | 0 failures, no new tooling |
| File containment | Diff filtered to product files | exactly 13 files, none outside the manifest |
| Status retention | Whole-file line comparison of `status.md` | 0 base lines changed; additions only in the new section |

## 25. DOCUMENT HISTORY

| Version | Date | Author | Changes |
|---------|------|--------|---------|
| 1.1 | 2026-11-11 | @spec-writer | Remediated DoR iteration 1: NFR-6/AC-NFR6-1 now make the repository-local-TMPDIR full-suite run the authoritative gate, require both aggregate runs recorded, and name both default-run-only failures (`ci-baseline-parity` and the `TC-WIRE-002` 5000 ms timeout) as recorded, re-run, and excused only behind a green repository-local run on the same head, with any other default-run failure a delivery failure (NFR-6, KPI rows, RSK-7, DoD, DEC-16, Appendix D). Made the M2-S4 advisory note an owned edit and corrected the containment accounting to 13 product files (12 planning documents: 11 modified plus the new `commands/repos.md`, plus the registry row) across G-5, F-11/F-14, §7.1, NFR-1/NFR-12, DEC-1/DEC-14, §16, AC-F6-5/AC-F14-1/AC-NFR1-1/AC-NFR12-1, DoD, and Appendix C. Count correction within the same iteration: an interim draft over-counted the product-file budget by one file (an extra page edit); the manifest was corrected to the verified 13 product files above. AC set unchanged: 45 ACs (33 functional + 12 non-functional), no AC added or removed. |
| 1.0 | 2026-11-11 | @spec-writer | Initial specification |

---

## AUTHORING GUIDELINES

- The ticket body (GH-303) is the normative source for the M2-S11 amendment, the M2-S18 and M2-S19 story text, the blueprint targets, and the acceptance list; the PM intake notes supplied the binding decisions (registry and index scope, the `repos`/M3-S6 name resolution, the entrypoint-delta reading, the flat-envelope contract surface, the status snapshot handling), encoded as DEC-1 through DEC-17 rather than re-litigated.
- Repository facts were read from the working tree rather than assumed: the M2-S11 entry's exact clauses, the Epic M2 block's story order and closing separator, the twelve-document pack and its `projects.v1`/`projects.md`/`journeys.md`/`test-scenarios.md`/`entrypoint-delta.md` statements, the two index tables, the closing 2026-11-10 status snapshot, the registry's 139 explicit entries and absent sorting requirement, the guards' differing scopes, and the gate battery with its opposite `TMPDIR` requirements.
- One ticket ambiguity was resolved by the PM and is recorded: the `repos` name is reserved by M3-S6 for hygiene while the ticket assigns it the flat enumeration, so the family is defined once with enumeration today and hygiene verbs later (DEC-2); the registry is therefore a derived deliverable even though the ticket's file list names only blueprint documents.
- Contract naming was left to this document by the PM and fixed here as `repos.v1` (flat) alongside the redefined `projects.v1` (groups), so both command pages point at one contract each (DEC-3).
- Three derived-consistency edits are recorded rather than silently taken: the new pack page's registry row (DEC-1, DEC-15), both S11 scenario seeds, including `SC-M2-S11-01`'s assert line, which the ticket does not name but the boundary requires (DEC-11), and the M2-S4 advisory note on the map row, which the tree does not yet carry and this change adds (DEC-14).
- The template at `doc/templates/change-spec-template.md` governed structure; every section is present in order, and the Definition of Done lives under Section 17 so the mandated ordering is preserved.
- No implementation detail, code path, or step-by-step task appears; planned contracts are described as required shapes and behaviours, and the change's product files are named only to bound the edit.

## VALIDATION CHECKLIST

- [x] `change.ref` matches provided `workItemRef` (GH-303)
- [x] `owners` has at least one entry
- [x] `status` is "Proposed"
- [x] All sections present in order (1-25 + guidelines + checklist)
- [x] ID prefixes consistent and unique (F-, AC-, NFR-, RSK-, DEC-, DM-, OQ-)
- [x] Acceptance criteria reference at least one F-/NFR-/DM- ID and use Given/When/Then
- [x] NFRs include measurable values
- [x] Risks include Impact & Probability
- [x] No implementation details (no code-level file paths, no step-by-step tasks)
- [x] No content duplicated from linked docs
- [x] Front matter validates per front_matter_rules
