---
change:
  ref: GH-303
  type: docs
  status: Proposed
  version: 1.4
  base_revision: 723454e4
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

> **PURPOSE**: Correct the M2 plan's domain model and its naming surface so one
> spelling never carries two meanings: the group contract is
> `project-groups.v1` with `groupKey`, the delivered flat record set keeps
> `projects.v1` and its shipped `projects list` behaviour, the flat surface
> becomes `repos list` / `repos.v1` / `repoKey` under one stated rename rule
> with the `projects list --flat` alias, and every delivered fact, error
> identity, unbound-scope behaviour, and repository-vocabulary token is
> preserved — so delivery agents execute M2 from a corpus that is internally
> consistent and testable.

## 1. SUMMARY

This change amends the committed M2 planning corpus to a three-level domain
model — repository, project group, optional workspace — and to one naming
surface in which each spelling has exactly one meaning. It splits the
delivered flat record set from the new group contract: groups are
`project-groups.v1` with `data.groups[]` and `groupKey`; the delivered flat
payload stays `projects.v1` with `data.projects[]` and `projectKey`; the flat
surface becomes `repos list` with `repos.v1`, `data.repos[]`, and `repoKey`
under a single stated rename rule, with `projects list --flat` as the
deprecation alias owned by M2-S18 and retired at the M3 boundary. It
re-lands M2-S18 and M2-S19 against that surface: configuration-only
membership with an undeclared-clone seed, project-scoped reads expressed as
`queue list --project <groupKey>` and `status --project <groupKey>`,
classified partial failure instead of a whole-read failure, one queue entry per
member for cross-member edges, per-member CI corroboration, dependency
ordering, and contracted envelopes for every scenario assertion. It also
restores the delivered `repos` page semantics (the `unbound` scope and the
`projects.*` error identities), reconciles the board to the repository-key
boundary, and splits the command-registry row so the delivered `projects list`
and the prospective `repos` name are not conflated.

## 2. CONTEXT

### 2.1 Current State Snapshot

- **Change base and revision state.** The product-file accounting is taken
  against change base `723454e4` (`main-tools` with GH-288 merged). The branch
  already carries the v1.3 amendment; this revision corrects that amendment's
  rendered corpus, so the snapshot below records the base facts plus the exact
  state this revision must leave behind. The corpus spans thirteen existing M2
  pack and planning documents, one new pack command page, and the
  forbidden-literals registration row that page requires.
- **The group surface is currently keyed to the delivered flat name.**
  `milestones/m2/contracts.md` assigns the group fields — a group list, a group
  identity, and a `members[]` list — to the delivered flat contract name and to
  the delivered flat identity token; the same file's `repos.v1` section says the
  shipped `projects list --json` returns the same records as
  `data.projects[]`. One command spelling therefore appears to return two
  shapes, and one identity token denotes a group in one section and a repository
  in another.
- **The delivered flat payload has no declared owner of its own name.** Nothing
  in the corpus says that `projects.v1` is the delivered flat record set that
  survives as the alias payload; the only reading available is that the name
  was reassigned. The delivered envelope (`data.projects[]`,
  `hostIndexRevision`, `projectKey`) is recorded in current truth at
  `doc/spec/features/feature-projects.md`.
- **The repository-vocabulary tokens carry no mapping clause.** The
  `project-identity.json` checkout marker, the `<host root>/projects/<key>`
  container, the host index's `projects[]`/`projectKey` fields, and the
  `--project-root` configuration flag are all repository vocabulary, but no
  clause says so, so a reader can mistake each of them for group vocabulary and
  plan a rename that would break the delivered state layout.
- **Membership has no configuration document.** `contracts.md` states that the
  member list is the configured membership and that the envelope never infers a
  member from a scan, but it names no document path, no format, and no member
  selector; the S18 task still reads "scan for managed clones inside", which
  invites the reading that a directory scan admits clones.
- **Project-scoped aggregation is undefined.** No clause states where member
  records come from, in what order they merge, what happens when one member's
  state is unreadable, or what a member with no implemented tracker adapter
  contributes. `commands/projects.md` currently answers the first of these by
  failing the whole read with `projects.state-unavailable` at exit 2.
- **The queue/lane representation for cross-member edges is unstated.**
  `contracts.md` and `architecture.md` describe a cross-repository change as one
  lifecycle with a branch and pull request per member, but neither says whether
  the change holds one queue entry or one per member, nor how release behaves.
- **`commands/repos.md` has lost delivered semantics.** Its synopsis and OPTIONS
  table have no `--help` and no `--version`; it has no scope section, so the
  `unbound` scope outside any git work tree is absent; its error table invents
  `repos.identity-unreadable`, `repos.index-corrupt`, and
  `repos.state-unavailable` and maps a non-work-tree root to
  `repos.identity-unreadable` at exit 1, although the delivered behaviour is the
  declared `unbound` scope at exit 0 with one warning; its STATE example shows a
  checkout-local path; and its example key carries no identity discriminator.
- **`commands/projects.md` carries the wrong envelope and an orphan field.**
  It documents the delivered flat contract name, the `data.projects[]` payload,
  and the delivered identity token as the group surface; it carries a
  `daemonReachable.reason` paragraph although `members[].daemonReachable` does
  not exist; it describes "a project scope" for queue and status reads without
  naming a grammar.
- **`commands/board.md` claims group scope.** Its synopsis offers
  `--project <key>`, its prose says the board reads "every managed project on
  the host through the project model", its envelope field is `projects[]`, and
  its attribution says the remainder depends on "the project model M2-S11
  introduces" — although M2-S11 delivered per-repository state and the host
  index, and M2-S18 scopes only queue and status reads.
- **The backlog has drifted from the delivered story.** M2-S11's goal, its
  enumeration task, and its acceptance criterion already read `repos list`, and
  the entry no longer carries the acceptance criterion that describes the
  shipped `projects list`; the `projectKey → repoKey` and
  `data.projects[] → data.repos[]` renames have no owner; S18 has no rename,
  alias, migration-guide, configuration-only-membership, scoped-grammar, or
  decision-record task; S19 has no dependency-ordering acceptance; and M2-S4
  does not depend on M2-S18 although its map row consumes the group envelope.
- **The seeds assert uncontracted and retired envelopes.**
  `test-scenarios.md` opens with "stories M2-S2 through M2-S17";
  `SC-M2-S18-01` asserts `projects list --json.data.projects[].members[]`;
  `SC-M2-S19-02` asserts a `change.data.definitionOfDone` /
  `change.data.blockingMember` family that no contract declares;
  `SC-M2-S19-01` asserts `closeout.data.members[]`, also undeclared;
  `SC-M2-S11-02` asserts the delivered surface as `repos list` today; and there
  is no seed for configuration-only membership, an undeclared clone, per-member
  CI corroboration, dependency ordering, or the alias shape.
- **The registry carries two Delivery rows for one name.**
  `cli-command-registry.md` has an M2 `ados repos` row with Delivery "M2-S11
  (shipped in GH-288)" and a separate M3 `ados repos` row with Delivery "M3-S6";
  the M2 `ados projects` row is attributed to M2-S18 only; and `projects` is
  absent from COMMAND FAMILIES.
- **The pack index and the delta note overstate what this change does.**
  `milestones/m2/README.md` keeps the M2-S4 advisory note even though the
  dependency is being declared, names the group envelope by the flat contract
  name, and does not name the S18 status scope delta;
  `entrypoint-delta.md` records the reference-page move as an effect of this
  change; and `architecture.md` has no sentence distinguishing the discovery
  workspace root from the state layer's fixed `default` workspace identifier.
- **Guard reality is unchanged.** `scripts/checks/forbidden-literals.ts` scans
  user-facing docs under `doc/**` except `doc/changes/**` and
  `doc/decisions/**`, literal-scans only registered documents absent at
  `corpusBaseline`, and fails closed on an unregistered or duplicated entry;
  `registered` holds 141 entries at the change base, and the new
  `commands/repos.md` is the one row this change adds (142).
  `scripts/.tests/test-doc-distribution.sh` marker-checks `doc/guides/**` and a
  fixed standalone list and skips `doc/planning/**`. The aggregate gate is
  `pnpm check`; under the default `TMPDIR` it can fail on
  `tests/checks/ci-baseline-parity.test.ts` (cross-device `git clone --local`)
  and on a 5000 ms `TC-WIRE-002` timeout in
  `tests/checks/privacy-ci-wiring.test.ts`, while a repository-local `TMPDIR`
  run is green. No mermaid validator exists; diagram validity is established
  structurally.

### 2.2 Pain Points / Gaps

- **One spelling, two shapes.** The corpus lets `projects list` mean the
  delivered flat record set and the group surface at the same time, so no
  reader — human or agent — can decide what a `projects list` sentence asserts
  without dating it.
- **The group identity token is borrowed.** Reusing the delivered repository
  identity token at the group level makes the one token that identifies a
  checkout also identify a group, which breaks the traceability of the delivered
  host index and the identity marker.
- **Delivered semantics are being renamed by documentation.** The `unbound`
  scope, the `projects.*` error identities, and the host-root state layout are
  delivered behaviour; documenting them as `repos.*` and as failures turns a
  docs change into a silent behaviour claim.
- **Repository vocabulary is up for renegotiation.** Without the mapping
  clause, a future reader can plan to rename the identity marker, the projects
  container, the host-index fields, or `--project-root` as part of the group
  story, which would be a state-layout migration disguised as naming.
- **Membership can be inferred instead of declared.** A task that says "scan
  for managed clones inside" admits undeclared clones into a project, so the
  group view can show repositories nobody configured.
- **Aggregation has no failure model.** Failing a whole project read because one
  member's state is unavailable hides the members that are readable and makes
  partial degradation indistinguishable from a host-wide failure.
- **The queue cannot express a cross-member change.** Without one queue entry
  per member and a release rule, a two-repository change either holds one entry
  for two repositories or holds none, and release semantics become guesswork.
- **The board is scoped by a name that has no group meaning.** A board claiming
  group scope while its key is a repository key creates a third meaning for
  `project`.
- **The registry asserts a delivery that has not happened.** Two Delivery rows
  for `repos`, one of them shipped, is a factually false registry for a name
  whose rename has not landed.
- **Ownership is split and therefore unenforceable.** The rename, alias, field
  renames, and migration-guide update sit between two stories, so each can
  assume the other did it.

## 3. PROBLEM STATEMENT

Because the M2 planning corpus gives one command spelling two shapes, borrows
the delivered repository identity token for groups, and leaves the delivered
`repos` semantics, membership declaration, aggregation failure model, queue
representation, and registry attribution unstated, delivery agents and the
owner cannot tell which contract a page describes or which story owns a rename,
and any partial correction leaves a corpus in which `projects list` means two
things, a repository token names a group, and a documented error path silently
contradicts shipped behaviour — resulting in a blueprint that must be
re-litigated page by page, scenarios that assert envelopes no contract
declares, and review that cannot prove the naming surface is coherent.

## 4. GOALS

- **G-1**: The contract identity split is complete and unambiguous:
  `project-groups.v1` with `data.groups[]` and `groupKey` is the group contract;
  `projects.v1` keeps its delivered flat record set (`data.projects[]`,
  `projectKey`); `repos.v1` with `data.repos[]` and `repoKey` is the planned
  flat surface; no contract, page, seed, or registry row asserts otherwise.
- **G-2**: Exactly one normative rename rule is stated, in `contracts.md`, and
  every other location references it: from M2-S18 `projects list` enumerates
  groups and `repos list` enumerates the flat record set; the deprecation alias
  is the different token `projects list --flat`, returning the delivered
  `projects.v1` payload, owned by M2-S18, retired at the M3 boundary; no text
  describes one spelling returning two shapes at one time.
- **G-3**: Every repository-vocabulary token carries the mapping clause: the
  `project-identity.json` marker, the `<host root>/projects/<key>` container,
  the host index's `projects[]`/`projectKey` fields, and `--project-root` denote
  a repository checkout and keep that meaning permanently unless a code change
  renames them.
- **G-4**: M2-S11 keeps the delivered story it shipped, including the acceptance
  criterion that describes the shipped `projects list` surface, the GH-288
  delivery record, and the state-scoping and collision clauses; the rename, the
  alias, the field renames, the migration-guide update, configuration-only
  membership, the scoped-read grammar, and the superseding decision record are
  owned by M2-S18 as the single owner.
- **G-5**: `commands/repos.md` states the delivered semantics: a non-work-tree
  root is the declared `unbound` scope at exit 0 with one bounded warning and is
  never a failure; the delivered `projects.identity-unreadable`,
  `projects.registry-corrupt`, and `projects.state-unavailable` identities are
  retained with any `repos.*` prefix change recorded as S18 code work; the
  STATE example is `<host root>/projects/<key>` with a key conforming to
  `PROJECT_KEY_PATTERN`; and `--help`/`--version` are listed with no-state-read
  semantics alongside the restored scope section.
- **G-6**: The board stays on the repository-key boundary: `board --project`
  takes a repository key, the board spans managed repositories rather than
  groups, its envelope names repositories, and its attribution names the
  per-repository state scope and host index M2-S11 delivered; M2-S18 scopes only
  queue and status reads, expressed as `queue list --project <groupKey>` and
  `status --project <groupKey>`, with the M1 status page frozen and the S18
  delta named in the M2 pack's README row.
- **G-7**: Membership is configuration-only and aggregation is classified:
  registration means declaring `workspaceRoot` and `members` in the project
  configuration document at a declared path and format; a scan only locates
  declared members and never admits an undeclared clone; project-scoped reads
  merge member records in declared order, classify per-member outcomes
  (`observed`, `not-yet-supported`, `state-unavailable`, `unregistered`), and
  degrade a single unavailable member as a classified partial result rather
  than a whole-read exit 2.
- **G-8**: A cross-repository change has an explicit queue/lane representation:
  one queue entry per member keyed by that member's ref, per-member dependency
  edges, and a release rule in which releasing the change drops each member's
  lease while the entries stay, removal happens per member with the change's
  reason, and one member landing never removes another member's entry.
- **G-9**: M2-S19 is verifiable: it carries a dependency-ordering acceptance and
  per-member CI corroboration, every assertion reads a declared envelope
  (`project-groups.v1`, `repos.v1`, `plan.data.members[]`,
  `closeout.data.members[]`, `verify gates.data.definitionOfDone` with
  `blockingMembers[]`), and "one review flow" is defined executably as one
  review run over the declared member pull-request set with one verdict per
  member.
- **G-10**: The registry, the indices, and the derived surfaces agree: the
  `repos` name has one row marked not-delivered and owned by M2-S18 pending the
  superseding decision record and code change required by ODR-0003, the
  delivered `projects` row keeps its Delivery attribution, `projects` joins
  COMMAND FAMILIES, M2-S4 depends on M2-S18, the pack README drops the advisory
  note and names the S18 status delta, the scenario intro reads M2-S2 through
  M2-S19, and the two cheap notes (discovery root versus `default` workspace
  identifier; the reference-page move phrased as pending S18 code work) are
  landed.

### 4.1 Success Metrics / KPIs

| Metric | Target |
|---|---|
| Functional capabilities | 14 |
| Functional acceptance criteria | 56 |
| Non-functional requirements / their acceptance criteria | 13 / 13 |
| Total acceptance criteria | 69 |
| New decisions recorded (DEC-19 through DEC-32) | 14 |
| Board-derived clauses covered (Appendix A.2) | 32 of 32 |
| Ticket clauses preserved in substance (Appendix A.1) | 26 of 26; 0 reworded |
| Normative rename-rule statements in the corpus | exactly 1 |
| Field renames named under the one rule | 3 of 3 (`projectKey → repoKey`, `data.projects[] → data.repos[]`, `board.data.projects[] → board.data.repositories[]`) |
| Surviving `projects.v1`-as-group-contract statements | 0 |
| Surviving `projectKey`-as-group-identity statements | 0 |
| Surviving one-spelling-two-shapes statements | 0 |
| Product files changed (all paths except `doc/changes/**`) | exactly 15 — 14 under `doc/planning/oss-tooling/**` (13 modified plus 1 new) + `scripts/checks/forbidden-literals.registry.json` |
| New files created | 1 (`milestones/m2/commands/repos.md`) |
| Pack index targets in the `milestones/README.md` M2 row | 13 (was 12) |
| New scenario seeds | ≥ 10 (≥ 5 for S18, ≥ 5 for S19), each with exactly one `Assert:` line |
| Alias shape-asserting seeds | 1 (`projects list --flat` versus `projects list`) |
| Deliverable-state seeds | 1 undeclared clone inside the registered workspace root, asserted not to be a member |
| Registry entries | 142 (141 at base; one added row) |
| Planning documents literal-scanned | 12 of 14 (2 exempt: `backlog.md`, `cli-command-registry.md`) |
| `bash scripts/.tests/test-doc-distribution.sh` (default `TMPDIR`) | exit 0 |
| Aggregate `pnpm check` (repository-local `TMPDIR`, full suite — authoritative) | exit 0; any failure here is a delivery failure |
| Default-`TMPDIR` aggregate run | recorded; the `ci-baseline-parity` failure and the `TC-WIRE-002` 5000 ms timeout each recorded and re-run, tolerated only while the repository-local run is green on the same head |
| Delivered facts preserved (GH-288 record, closed daemon reason set, `unbound` scope, exit projection, mounted delta note, 2026-11-11 status snapshot, delivered error identities, host-root state layout) | 9 of 9 present |
| Pages using the group meaning that carry a time-scoped disambiguation referencing the rename rule | 100% |

### 4.2 Non-Goals

- **NG-1**: Delivering any M2 story, including the M2-S18 rename, the alias, and
  M2-S19; this change plans and documents.
- **NG-2**: Changing any product behaviour, command composition, or entrypoint
  registration; `repos` stays unbuilt and unregistered, and the shipped
  `projects list` keeps exactly the behaviour GH-288 mounted.
- **NG-3**: Renaming the delivered marker, container, host-index fields, or
  `--project-root`; the mapping clause fixes them as repository vocabulary and
  any future rename needs a code change.
- **NG-4**: Authoring the superseding decision record for the `repos` name; that
  record is an M2-S18 task because it precedes S18's code change under ODR-0003.
- **NG-5**: Rewriting `doc/spec/**`, `doc/overview/**`, or
  `doc/guides/migrating-to-per-repository-state.md`; current truth keeps
  describing the delivered flat surface, and the migration-guide update is an
  S18 task.
- **NG-6**: Editing the M1 status page, the M1 pack, or the M0 pack; the M1
  status page is frozen and the S18 status delta is named in the M2 README row.
- **NG-7**: Creating tracker tickets for M2-S18 or M2-S19.
- **NG-8**: Adding a diagram validator, a naming lint, a drift check, or any new
  tooling or gate, and changing either doc guard's scope or behaviour.
- **NG-9**: Introducing, in new or changed text, a statement that `repos` is a
  group, that `projects list` is both surfaces at once, or that a repository
  token is group vocabulary.

## 5. FUNCTIONAL CAPABILITIES

| ID | Capability | Rationale |
|----|------------|-----------|
| F-1 | M2-S11 is amended in place and keeps the delivered story it shipped | The GH-288 record, the state scoping, the collision criterion, and the shipped-surface acceptance criterion are delivered truth; the story must not be rewritten to describe a surface it did not ship |
| F-2 | M2-S18 becomes the single owner of the rename, alias, field renames, migration guide, config-only membership, scoped grammar, and decision record | One owner per rename is the only way the transition is enforceable instead of assumed |
| F-3 | M2-S19 is verifiable end to end | A cross-repository change is only plannable if its ordering, CI corroboration, envelopes, and review flow are contracted |
| F-4 | The backlog records the domain-model context, declares the S4 edge, and preserves every other byte | The story set must read coherently without disturbing the epic structure |
| F-5 | The architecture carries the three-level model, the adjusted flows, the queue/lane representation, and the discovery-root distinction | A reader must see repositories as members, workspaces as optional, and cross-member work as explicit before reading any contract |
| F-6 | The contracts define one identity split, one rename rule, one mapping clause, one configuration document, one aggregation model, one queue representation, and one change-plan shape | Every page and seed points at one contract each, with no field carrying two meanings |
| F-7 | The command pages state delivered semantics for `repos`, the group surface for `projects`, the repository-key boundary for `board`, and the scope grammar for `queue` | Two surfaces, one page each, and no page claims another's scope |
| F-8 | Scenario seeds cover S18 and S19 with contracted assertions and carry the delivered-story split | Seeds are the first draft of each test plan and must be executable against the corrected model |
| F-9 | The morning-overview journey is rewritten for a project | The journey is the readable test of whether the model answers the operator's question |
| F-10 | The entrypoint delta note states the split and phases the reference-page move as pending S18 code work | The note is where a reader learns what M2 adds and when a page moves |
| F-11 | The pack and milestone indices learn the new page, the corrected contract owners, and the S18 status delta | A page, delta, or owner that no index points at is not discoverable |
| F-12 | `status.md` gains one dated correction snapshot without rewriting history | Planning state must stay current and auditable |
| F-13 | The command registry splits the delivered and prospective names and keeps one Delivery row per name | The registry is the locked naming surface; a false delivery claim contradicts the plan |
| F-14 | One naming boundary, one time-scoped disambiguation, and one terminology lock hold across every touched location | A half-rename is the failure mode this change exists to prevent |

### 5.1 Capability Details

- **F-1 — M2-S11 amended in place, delivered story intact.** The entry keeps its
  heading, its `- Depends on: M0-S5, M1-S17.` line, its
  `- Ticket: GH-288 (milestone M2)` line, its `- Progress: delivered by GH-288 …`
  record, the per-repository state scoping derived from the checkout identity
  with a host-level index, the migration note, the tests clause, and the
  two-checkout ref-GH-241 collision acceptance criterion. Its goal keeps the
  shipped overview meaning and no longer promises `repos list`; its enumeration
  task keeps the delivered meaning and names the flat record set; its
  enumeration acceptance criterion keeps describing the shipped
  `projects list` surface. It records the planned transition in one sentence:
  the rename, the `--flat` alias, and the field renames are M2-S18's work. No
  `repos list` acceptance criterion, no `projectKey → repoKey` clause, and no
  `data.projects[] → data.repos[]` clause appears in this entry.
- **F-2 — M2-S18 in the backlog, as the single owner.** The entry keeps its
  heading and its twelve ticket clauses (Appendix A.1) and gains six derived
  task clauses and one derived acceptance criterion: (a) the rename — from
  M2-S18, `projects list` enumerates groups and `repos list` enumerates the flat
  record set; (b) the alias — `projects list --flat` returns the delivered
  `projects.v1` payload (`data.projects[]`, `projectKey`, `hostIndexRevision`),
  owned by M2-S18 and retired at the M3 boundary; (c) the field renames —
  `projectKey → repoKey` and `data.projects[] → data.repos[]` on the flat
  surface; (d) the migration-guide update for
  `doc/guides/migrating-to-per-repository-state.md`; (e) configuration-only
  membership plus the scoped-read grammar `queue list --project <groupKey>` and
  `status --project <groupKey>`; (f) the superseding decision record for the
  `repos` name before the registry row moves to Delivery. The derived
  acceptance criterion asserts the alias payload shape. The entry states that
  the rename is S18 code work and is not current truth.
- **F-3 — M2-S19 in the backlog, verifiable.** The entry keeps its heading and
  its eleven ticket clauses and gains a dependency-ordering acceptance
  criterion ("a member step with a dependency edge does not start before the
  prerequisite member's pull request lands, and the evidence lists the pull
  requests in landing order"). Its per-member CI corroboration clause is stated
  testably: CI truth on each member's pushed head is read and recorded, and an
  unavailable reading blocks the shared definition of done as a classified
  outcome rather than counting as green. "One review flow" is defined
  executably in the contract the story points at: exactly one review run over
  the declared member pull-request set, one verdict per member, each member
  reviewed once.
- **F-4 — The backlog context note, the S4 edge, and preservation.** The Epic M2
  block gains one context paragraph after the retirement note stating the
  three-level model, configuration-only membership, the delivered flat surface
  and the rename rule by reference (not restated), and the root-family
  consequence. M2-S4's `- Depends on:` line gains M2-S18 and keeps its terminal
  period; no other S4 clause changes. The retirement note, the epic heading, the
  frontmatter, the reading guide, the cross-cutting principles, every story
  other than M2-S11, M2-S18, M2-S19, and M2-S4, the closing separator, and the
  `## Epic M3` heading stay byte-identical.
- **F-5 — The architecture states the model and the representation.**
  `milestones/m2/architecture.md` keeps the three-level C4 context (repository
  as delivery unit, project as a configured group of repositories, workspace as
  an optional discovery root) and gains one sentence distinguishing the
  discovery workspace root from the state layer's fixed `default` workspace
  identifier, so the two uses of "workspace" cannot be conflated. The overview
  flow stays project-scoped; the cross-repository change flow gains the queue
  representation (one queue entry per member, per-member dependency edges).
  `## Boundary invariants at M2 exit` gains the rename rule reference, the
  configuration-only membership statement, the one-queue-entry-per-member
  statement, and the release rule statement.
- **F-6 — The contracts.** `milestones/m2/contracts.md` defines, as planned M2
  contracts: `repos.v1`, the flat record set with `data.repos[]`, `repoKey`,
  `root`, `stateLocation`, `daemonReachable` with the closed reason set, the
  `unbound` scope, `handoverState`, and the host index revision; the delivered
  `projects.v1` record set with `data.projects[]`, `projectKey`, and
  `hostIndexRevision`, explicitly retained as the alias payload; the group
  contract `project-groups.v1` with `data.groups[]`, `groupKey`, `name`, the
  optional `workspaceRoot`, and `members[]` each carrying `repoKey`, `root`,
  `trackerKind`, `state`, `health`, and `daemonReachable`; the canonical rename
  rule; the repository-vocabulary mapping clause; the project configuration
  document (path, format, schema, member selector, configuration-only
  membership); the project-scoped aggregation clause; the queue/lane
  representation and release rule; and the cross-repository change plan shape
  with its `plan.data.members[]`, `closeout.data.members[]`, and shared
  definition-of-done verdict at `verify gates`. No section calls the group
  contract `projects.v1`, and no field of `projects.v1` denotes a group.
- **F-7 — The command pages.** `commands/repos.md` is the flat record-set page:
  `Status: Proposed (M2)`, a bare `repos` name, a synopsis carrying
  `repos list [--json]`, `repos --help`, `repos list --help`, and
  `repos --version`, OPTIONS rows for `--json`, `--help`, and `--version` with
  no-state-read semantics (no state, git, configuration, or network read), the
  five reported fields, the `repos.v1` envelope, exit codes, an error table
  carrying the delivered `projects.identity-unreadable`,
  `projects.registry-corrupt`, and `projects.state-unavailable` identities, a
  scope section restoring the read-only statement and the `unbound` behaviour
  (non-work-tree root, exit 0, one bounded warning, never a failure and never a
  row), a STATE example at `<host root>/projects/<key>` with a key conforming to
  `PROJECT_KEY_PATTERN` (for example `delivery-a-1a2b3c4d`), the carried mapping
  clause, and a rename note pointing at the canonical rule.
  `commands/projects.md` is the group page: `project-groups.v1`,
  `data.groups[]`, `groupKey`, `members[].daemonReachable` documented on the
  page and in the contract, the configuration document and aggregation
  behaviour by reference, the scoped-read grammar, the `--flat` alias as a
  pointer to the rename rule, no group-scoped board claim, and a time-scoped
  disambiguation. `commands/queue.md` gains `queue list --project <groupKey>`
  in its synopsis and OPTIONS. `commands/board.md` is reconciled to the
  repository-key boundary: `--project <key>` takes a repository key, `--all`
  spans managed repositories, the envelope's repository list field is
  `repositories[]` (the delivered-style `projects[]` field renamed under the
  rename rule), the refusal identity uses repository vocabulary, and the
  attribution names the M2-S11 per-repository state scope and host index.
- **F-8 — The scenario seeds.** `test-scenarios.md` opens with "stories M2-S2
  through M2-S19". It gains at least five S18 seeds and five S19 seeds, each with
  exactly one `Assert:` line: S18 covers discovery through a registered
  workspace directory, the same project without a workspace, group listing with
  member health and `daemonReachable`, project-scoped queue and status reads,
  mixed tracker-kind classification, and configuration-only membership with one
  undeclared clone inside the root that is not a member; S19 covers one spec
  with two member branches, two pull requests, one review flow and one closeout,
  a failing member blocking the shared definition of done with the member named,
  per-member CI corroboration, dependency ordering, and the alias shape. Every
  assertion reads a declared envelope; no assertion uses a `change.data.*`
  family. The two S11 seeds are reconciled: `SC-M2-S11-01` reads `repos list`,
  and `SC-M2-S11-02` is prospective, asserting the S18 rename rather than the
  delivered surface.
- **F-9 — The journey.** `journeys.md`'s opening journey stays a project-scoped
  morning overview and states: configuration-only membership, the flat view from
  `repos list`, the group view from `projects list`, the project-scoped queue
  and status reads, same-ref disjointness, workspace optionality, and one
  time-scoped disambiguation referencing the rename rule.
- **F-10 — The entrypoint delta.** `entrypoint-delta.md` lists `repos` as the
  flat record set owned by M2-S18 and `projects` as the group surface owned by
  M2-S18, keeps the **Mounted by GH-288 (M2-S11)** note stating that the shipped
  `projects list` is the delivered flat surface, and phrases the reference-page
  move as pending S18 code work rather than as an effect of this change.
- **F-11 — The indices.** `milestones/m2/README.md`'s pack-contents table keeps
  one row per artifact and states `commands/repos.md` as the flat record set
  owned by M2-S18; its contracts row names `repos.v1`, the group contract
  `project-groups.v1`, the delivered `projects.v1` payload, the configuration
  document, and the change plan shape; its map rows put M2-S11 on the delivered
  `projects.v1`, M2-S18 on `project-groups.v1` plus the configuration document
  plus the S18 status scope delta plus the superseding decision record, and
  M2-S19 on the change plan shape; the M2-S4 row loses the advisory phrase
  because the dependency is now declared; the scenarios row reads S2 through
  S19. `milestones/README.md`'s M2 row links `m2/commands/repos.md` for thirteen
  targets.
- **F-12 — The status snapshot.** `status.md` gains one dated correction
  section recording the contract split, the rename rule and alias, the
  ownership split, configuration-only membership, the scoped-read grammar, the
  board boundary, the registry split, and the S4 edge, as planning state only.
  No earlier line changes.
- **F-13 — The command registry.** `cli-command-registry.md` carries one
  `ados projects` row: delivered flat record set as `projects list`, Delivery
  `M2-S11 (shipped in GH-288)`, Extended `M2-S18` (the spelling becomes the
  group surface while the delivered record set remains reachable only through
  the `--flat` alias until the M3 boundary). It carries one `ados repos` row:
  prospective flat record set, Delivery `-`, Extended `M2-S18` (delivery owner,
  rename and alias) and `M3-S6` (clone, branch, and worktree hygiene verbs),
  marked not-delivered pending the superseding decision record and code change
  required by ODR-0003. The M3 table carries no second `ados repos` Delivery
  row. `projects` joins COMMAND FAMILIES in the Operate line. The boundary note
  names the two meanings and points at the rename rule.
- **F-14 — One naming boundary and one terminology lock.** Across the fourteen
  planning documents, `repos`/`repos list` means the flat record set and
  `projects`/`projects list` means a configured group of repositories from
  M2-S18 onward; every page using the group meaning carries a time-scoped
  disambiguation that references the rename rule instead of restating it; the
  group contract is `project-groups.v1`, a group identity is `groupKey`, and a
  repository identity is `repoKey` (delivered as `projectKey`); the state layer's
  scope is per-checkout and is never called a project scope; and no page asserts
  one spelling returning both shapes at one time. Delivered GH-288 facts are
  preserved, and where a page's surface name moves, the delivered fact is
  carried to the location that owns the delivered surface.

## 6. USER & SYSTEM FLOWS

```
Flow 1 — The owner validates the corrected model before delivery
  Owner opens milestones/README.md -> M2 row -> m2/README.md
    -> architecture: repository, project group, optional workspace;
       one sentence separates the discovery root from the `default` workspace id
    -> contracts: project-groups.v1 (groups, groupKey), projects.v1 (delivered
       flat payload), repos.v1 (flat record set), the one rename rule, the
       mapping clause, the configuration document, aggregation, queue/lane
    -> commands/repos.md and commands/projects.md: two pages, two meanings
  Owner checks the registry row split and the S4 dependency; refinements land
  in the pack, not in a ticket.

Flow 2 — A delivery agent executes M2-S18 from repository truth
  Agent reads backlog.md Epic M2
    -> M2-S11 (delivered): the shipped projects list surface, its record, its
       state scoping, and its collision criterion
    -> M2-S18: the rename, the --flat alias, the field renames, the migration
       guide, configuration-only membership, the scoped grammar, the decision
       record
    -> m2/README.md row -> architecture flow -> contracts clauses
    -> inherits SC-M2-S18-* seeds as the first draft of its test plan
  (no ticket lookup required)

Flow 3 — Configuration-only membership with an undeclared clone
  Operator declares groupKey, optional workspaceRoot, and members in the
  project configuration document
    -> the read resolves members from configuration, in declared order
    -> the scan inside workspaceRoot locates the declared checkouts only
    -> a clone inside the root that is not declared is never a member
    -> projects list shows the configured members with health and state
  (declaring nothing means no group; a scan never admits a member)

Flow 4 — A project-scoped read with one degraded member
  Reader runs queue list --project <groupKey> or status --project <groupKey>
    -> members resolved from configuration, in declared order
    -> one member's state is unavailable -> that member is classified
       state-unavailable, the read reports partial with the degraded member
       named, and the readable members are returned at exit 0
    -> a member with no implemented adapter is classified not-yet-supported,
       contributes no records, and never fails the read
    -> exit 2 only when the configuration document or the invoking scope
       cannot be read

Flow 5 — One change across two member repositories (planned, M2-S19)
  One change, one lifecycle, one spec and plan
    -> one queue entry per member, with the second member's entry depending on
       the first member's entry
    -> per member: branch, pull request, gates, CI corroboration on the pushed
       head (an unavailable reading blocks, never counts as green)
    -> one review flow: one review run over both pull requests, one verdict per
       member
    -> one shared definition of done; a failing member blocks it and is named
       through verify gates (definitionOfDone, blockingMembers)
    -> closeout reports each member (branch cleanup, pull-request number, issue
       closure, landed); release dropped each member's lease, and one member
       landing removed only its own entry

Flow 6 — A reviewer audits the naming surface
  Reviewer searches the corpus for the two names and the two identities
    -> every flat-record statement reads repos list; every group statement reads
       projects list (from M2-S18)
    -> the rename rule appears once, in contracts, and elsewhere by reference
    -> no line says the group contract is projects.v1 or that a group identity
       is projectKey
    -> the delivered facts are present: the GH-288 record, the closed daemon
       reason set, the unbound scope at exit 0, the projects.* error
       identities, the host-root state layout, the mounted delta note, the
       shipped projects registry row, the 2026-11-11 snapshot
    -> doc/spec is unedited and still describes the delivered surface
```

## 7. SCOPE & BOUNDARIES

### 7.1 In Scope

- `doc/planning/oss-tooling/backlog.md`: the in-place M2-S11 amendment that
  keeps the delivered story and its shipped-surface acceptance criterion, the
  M2-S18 entry as the single rename owner with its derived tasks and alias
  acceptance, the M2-S19 entry with its ordering acceptance, M2-S4's
  `Depends on` gaining M2-S18, and one Epic M2 context paragraph.
- `doc/planning/oss-tooling/milestones/m2/architecture.md`: the three-level C4
  context, the discovery-root versus `default` sentence, the project-scoped
  overview flow, the cross-repository change flow with the queue/lane
  representation, and the boundary invariants.
- `doc/planning/oss-tooling/milestones/m2/contracts.md`: `repos.v1`, the
  retained delivered `projects.v1`, `project-groups.v1`, the canonical rename
  rule, the repository-vocabulary mapping clause, the project configuration
  document, the aggregation clause, the queue/lane representation and release
  rule, and the cross-repository change plan shape with its closeout and
  definition-of-done envelopes.
- `doc/planning/oss-tooling/milestones/m2/commands/repos.md`: **new file** —
  the flat record-set page with delivered semantics, the `unbound` scope, the
  delivered error identities, the host-root STATE example, `--help`/`--version`
  with no-state-read semantics, the carried mapping clause, and the rename
  pointer.
- `doc/planning/oss-tooling/milestones/m2/commands/projects.md`: rewritten as
  the group page with `project-groups.v1`, `groupKey`, member
  `daemonReachable`, aggregation and partial-failure behaviour, and the scoped
  grammar.
- `doc/planning/oss-tooling/milestones/m2/commands/queue.md`: the
  `queue list --project <groupKey>` synopsis and OPTIONS row.
- `doc/planning/oss-tooling/milestones/m2/commands/board.md`: the
  repository-key boundary, the repository-vocabulary envelope and refusal
  identity, and the corrected attribution.
- `doc/planning/oss-tooling/milestones/m2/test-scenarios.md`: the S2-S19 intro,
  the S18 and S19 seed sets with one `Assert:` line each, contracted-envelope
  assertions only, the alias shape seed, and the two S11 seeds reconciled.
- `doc/planning/oss-tooling/milestones/m2/journeys.md`: the opening journey
  reconciled to the corrected model and the time-scoped disambiguation.
- `doc/planning/oss-tooling/milestones/m2/entrypoint-delta.md`: the split, the
  retained GH-288 mount note, and the reference-page move phrased as pending S18
  code work.
- `doc/planning/oss-tooling/milestones/m2/README.md`: the contents rows, the
  corrected map rows (S11, S18, S19, S4, scenarios), and the S18 status delta.
- `doc/planning/oss-tooling/milestones/README.md`: the M2 index row gaining
  `m2/commands/repos.md`.
- `doc/planning/oss-tooling/status.md`: one new dated correction section.
- `doc/planning/oss-tooling/cli-command-registry.md`: the split `ados projects`
  and `ados repos` rows, the removal of the second `repos` Delivery row, the
  ODR-0003 lock statement, `projects` in COMMAND FAMILIES, and the boundary
  note.
- `scripts/checks/forbidden-literals.registry.json`: exactly one added
  registration for the new pack page, at its position, with no duplicate and no
  other row changed.
- The change artifacts under
  `doc/changes/2026-11/2026-11-11--GH-303--project-groups-domain-model/`.

### 7.2 Out of Scope

- [OUT] Any product code, command implementation, configuration loader, scan, scoped read, alias, or lifecycle behaviour; no file under `packages/**` changes.
- [OUT] Any delivered surface or entrypoint registration; `repos` stays uncomposed and unlisted.
- [OUT] Rewriting `doc/spec/**` or `doc/overview/**`; current truth keeps describing the delivered surface.
- [OUT] Editing `doc/guides/migrating-to-per-repository-state.md`; its update is an M2-S18 task.
- [OUT] Editing the M1 status page, the M1 pack, or the M0 pack.
- [OUT] Renaming `project-identity.json`, `<host root>/projects/<key>`, the host index's `projects[]`/`projectKey`, or `--project-root`.
- [OUT] Changes to `tests/**`, `.opencode/**`, `.ai/**`, `doc/guides/**`, `doc/templates/**`, or any `scripts/**` file other than the single registry row.
- [OUT] Creating tracker tickets for M2-S18 or M2-S19.
- [OUT] Authoring the superseding decision record for the `repos` name.
- [OUT] Reorganising `roadmap.md`, `backlog-ranking.md`, `measurement-baseline.yaml`, or `doc/planning/oss-tooling/user-journeys.md`.
- [OUT] Any private, fleet, hosted, repository, or proprietary product name in new or changed text.

### 7.3 Deferred / Maybe-Later

- The rename, the alias, and the field renames themselves: M2-S18 code work.
- Group scoping for any read other than queue and status (board, spend, retro):
  story work under M2-S4, M2-S6, and M2-S10, and explicitly not an S18 claim.
- A mechanical naming-boundary drift check, if review shows the manual rule is
  insufficient after the first M2 delivery.
- Reconciling the rest of the planning corpus (roadmap, ranking, user journeys)
  to the three-level model — a later editorial pass outside this ticket's file
  set.
- Whether a group should also scope the daemon supervision battery; no story
  claims it today.

## 8. INTERFACES & INTEGRATION CONTRACTS

### 8.1 REST / HTTP Endpoints

N/A. This change delivers no endpoint. The contracts it documents
(`repos.v1`, the delivered `projects.v1`, `project-groups.v1`, the project
configuration document, the aggregation clause, the queue representation, and
the cross-repository change plan shape) are planned M2 contracts, not delivered
interfaces.

### 8.2 Events / Messages

N/A for this change. No event, topic, message, or payload changes. The planning
text references the `queue.graph` event kinds already contracted by M2-S13 for
dependency-edge changes; nothing is delivered or versioned here.

### 8.3 Data Model Impact

| ID | Element | Description |
|----|---------|-------------|
| DM-1 | Backlog story entry | Heading `### Mx-Sn Title`, optional `- Ticket:` line, then `- Goal:`, `- Tasks:`, `- AC:`, `- Depends on:`. Codes are stable identifiers; file position carries no ordering meaning. An `AC` block may be one inline criterion or an indented numbered list. |
| DM-2 | Domain level | Repository = one git checkout and the delivery unit (the leaf, always present). Project = a named group of repositories whose membership is declared in configuration. Workspace = an optional persisted directory usable as a discovery root for a group's declared members; never required. |
| DM-3 | Project configuration document | The configuration artifact at `<configDirectoryName>/projects.yaml`, schema `delivery.projects.groups.v1`, holding `groups[]` with `groupKey`, `name`, optional `workspaceRoot`, and `members[]` where each member declares a repository selector (`root` or `repoKey`) and a `trackerKind`. Membership is configuration-only; a scan locates declared members and never admits an undeclared clone. |
| DM-4 | `repos.v1` envelope | The flat record set: `data.repos[]` with `repoKey`, `root`, `stateLocation`, `daemonReachable` (with the closed reason set and the `unbound` scope), `handoverState`, plus `hostIndexRevision`. Owned by M2-S18 as the renamed flat surface; not delivered by this change. |
| DM-5 | `project-groups.v1` envelope | The group contract: `data.groups[]`, each with `groupKey` (the group identity), `name`, optional `workspaceRoot`, and `members[]` each carrying `repoKey`, `root`, `trackerKind`, `state`, `health`, and `daemonReachable`. Owned by M2-S18. |
| DM-6 | `projects.v1` envelope (delivered) | The delivered flat record set: `data.projects[]` with `projectKey`, `root`, `stateLocation`, `daemonReachable`, `handoverState`, plus `hostIndexRevision`. Keeps this meaning permanently and is the payload returned by `projects list --flat`. |
| DM-7 | Rename rule and alias | The canonical statement: from M2-S18 `projects list` enumerates groups and `repos list` enumerates the flat record set; the deprecation alias is the different token `projects list --flat`, returning the delivered `projects.v1` payload, owned by M2-S18, retired at the M3 boundary. Under the same rule it carries three field renames: `projectKey → repoKey`, `data.projects[] → data.repos[]`, and the board's repository list field `projects[] → repositories[]`. |
| DM-8 | Project-scoped aggregation | Members resolved from configuration in declared order; per-member outcome vocabulary `observed`, `not-yet-supported`, `state-unavailable`, `unregistered`; one degraded member yields a classified partial result (exit 0, `partial` true, degraded members named); exit 2 only when the configuration or the invoking scope cannot be read. |
| DM-9 | Queue/lane representation (cross-member) | One queue entry per member keyed by that member's ref; per-member dependency edges; release drops each member lease while entries stay; removal is per member with the change's reason; one member landing never removes another's entry; one lane per member entry, never a cross-repository lane. |
| DM-10 | Cross-repository change plan shape | `plan.data.members[]` (repoKey, slice, branch, pullRequest, dependsOn[], gates); per-member gates; one review flow (one run over the declared pull-request set, one verdict per member); shared definition-of-done verdict at `verify gates` (`data.definitionOfDone`, `data.blockingMembers[]`); `closeout.data.members[]` (repoKey, branch, cleanup, pullRequest, issueClosure, landed); evidence enumerating every member pull request in landing order. |
| DM-11 | Repository-vocabulary mapping | The `project-identity.json` marker, the `<host root>/projects/<key>` container, the host index's `projects[]`/`projectKey` fields, and `--project-root` each denote a repository checkout and keep that meaning permanently unless a code change renames them. |
| DM-12 | Scenario seed | A `### SC-M2-<story>-<n> <title>` block with Given/When/Then prose and exactly one `Assert:` line stating a predicate over a declared envelope field, exit code, or file/ledger fact. |
| DM-13 | Command page | A page with a `Status:` header, NAME, SYNOPSIS, OPTIONS, OUTPUT (text digest and machine envelope), EXIT STATUS, invocation examples, an error table, and see-also links; command names are bare with the `<binary>` invocation prefix. |

### 8.4 External Integrations

- Tracker adapters remain separate engines, so a group may declare members with
  different tracker kinds. This change documents that configuration as valid and
  records the `not-yet-supported` classification for a member with no
  implemented adapter; it performs no tracker read or write.
- No other external integration is touched: no provider, vendor API, credential
  path, or hosted surface is added, removed, or reconfigured.

### 8.5 Backward Compatibility

- The delivered `projects list` surface keeps its behaviour, output shape, exit
  codes, help entry, and state layout; current truth keeps describing it.
- `projects.v1` is not redefined: it keeps the delivered flat record set and its
  `data.projects[]` payload, which is what the `--flat` alias returns.
- The rename is prospective: the corpus states that from M2-S18 the spellings
  split, and that the alias carries the delivered payload until the M3 boundary.
- The repository-vocabulary tokens keep their meaning permanently; no reader of
  this corpus is told that the identity marker, the projects container, the
  host-index fields, or `--project-root` will be renamed.
- `board --project` keeps taking a repository key; nothing in this change widens
  the board to a group.
- `status.md` history is additive: no base line is removed, reordered, or
  modified.
- The registry's existing rows keep their bytes except for the two rows this
  change splits and the COMMAND FAMILIES line.

## 9. NON-FUNCTIONAL REQUIREMENTS (NFRs)

| ID | Requirement | Threshold |
|----|-------------|-----------|
| NFR-1 | Docs-only containment | Exactly 15 product files change (all paths except `doc/changes/**`): 14 under `doc/planning/oss-tooling/**` — 13 modified plus the new `milestones/m2/commands/repos.md` — and `scripts/checks/forbidden-literals.registry.json`. Zero files change under `doc/spec/**`, `doc/overview/**`, `doc/guides/**`, `doc/templates/**`, `packages/**`, `tests/**`, `.opencode/**`, `.ai/**`, or any other `scripts/**` path. `doc/planning/oss-tooling/milestones/m1/commands/status.md` is byte-identical. |
| NFR-2 | Backlog preservation and placement | 100% byte identity for the frontmatter, the `## Reading guide`, `## Cross-cutting principles`, the Epic M2 heading and its retirement note, every story other than M2-S11, M2-S18, M2-S19, and M2-S4, the blank line and `---` separator closing the Epic M2 block, and the `## Epic M3` heading. The M2-S4 diff is confined to its `- Depends on:` line. 0 story codes renamed, reordered, or removed. |
| NFR-3 | Planned-not-delivered semantics with delivered facts preserved | 2 of 2 command pages carry the exact header `Status: Proposed (M2)`; 0 claims that `repos`, project groups, workspace discovery, or cross-repository changes are delivered; the registry marks `repos` not-delivered; the nine delivered facts (GH-288 record, closed daemon reason set, `unbound` scope, exit projection, `projects.*` error identities, host-root state layout, mounted delta note, shipped `projects` registry attribution, 2026-11-11 status snapshot) are present and unaltered; the pack's planned-until-exit statement survives verbatim. |
| NFR-4 | Forbidden-literals registration | Exactly 1 row added to `registered` (141 → 142), placed inside the existing `doc/planning/oss-tooling/milestones/m2/commands/` group so the surrounding rows keep their relative order; 0 duplicate entries; the guard reports 0 unregistered-doc findings and 0 violations. |
| NFR-5 | Doc-distribution guard | `bash scripts/.tests/test-doc-distribution.sh` exits 0 with the default `TMPDIR`; 0 `ados_distribution` markers added to any planning document. |
| NFR-6 | Aggregate gate | The authoritative run is `pnpm check` with a repository-filesystem `TMPDIR` over the full suite; it must exit 0 on the branch head. Both aggregate runs are recorded. A default-run `ci-baseline-parity` failure and a default-run 5000 ms `TC-WIRE-002` timeout are each recorded and re-run and are excused only while the repository-local run is green on the same head; any other default-run failure, or a repository-local `TC-WIRE-002` repeat, is a delivery failure. |
| NFR-7 | Document structure (no new tooling) | Every touched file's fenced-block count is even; every diagram fence is tagged `mermaid` and its first body line begins with `flowchart`, `graph`, `sequenceDiagram`, `classDiagram`, or `stateDiagram-v2`; `## C4 Level 1`, `## C4 Level 2`, and `## C4 Level 3` appear exactly once each; `## Key flows` holds exactly 8 `###` headings, each owning exactly one mermaid block. No validator, script, or gate is added. |
| NFR-8 | Clause fidelity and coverage | 26 of 26 ticket clauses preserved with unchanged meaning (12 for S18, 11 for S19, 3 for the M2-S11 amendment) and 32 of 32 board-derived clauses covered (Appendix A.2) = 58 clauses traced; 0 ticket clauses reworded, weakened, merged, or dropped; derived clauses are recorded as derived additions and never rewrite ticket text. |
| NFR-9 | Public/OSS hygiene and the scanned set | 0 private fleet, repository, host, hosted, or proprietary product names in new or changed text. Of the 14 planning documents this change touches, 12 are literal-scanned (`milestones/README.md`, `milestones/m2/README.md`, `milestones/m2/architecture.md`, `milestones/m2/contracts.md`, `milestones/m2/commands/projects.md`, `milestones/m2/commands/repos.md`, `milestones/m2/commands/queue.md`, `milestones/m2/commands/board.md`, `milestones/m2/test-scenarios.md`, `milestones/m2/journeys.md`, `milestones/m2/entrypoint-delta.md`, `status.md`) and 2 are exempt because they are neither registered nor scanned (`backlog.md` and `cli-command-registry.md`, both present at `corpusBaseline` and unregistered): 0 occurrences of the seed literals `ados`, `ADOS_`, or `~/.ados` in the scanned set, every command name written with the `<binary>` prefix, 0 violations, 0 unregistered-doc findings. |
| NFR-10 | Link integrity and non-duplication | 0 broken relative links introduced or left behind; 0 pack documents restating a story's acceptance block instead of referencing the story code. |
| NFR-11 | Status history retention | In `status.md`, 0 base lines removed, reordered, or modified; every added line lies inside the one new dated section. |
| NFR-12 | Naming-boundary consistency and disambiguation | 0 occurrences of `repos`/`repos list` denoting a group; 0 occurrences of `projects`/`projects list` denoting the flat record set outside the time-scoped per-page disambiguation and statements recording delivered GH-288 facts; the alias token appears only where the alias is defined or pointed at; 100% of Appendix B rows in their required state. |
| NFR-13 | Terminology lock and vocabulary separation | 0 statements that the group contract is `projects.v1`; 0 statements that a group identity is `projectKey`; 0 statements that one spelling returns both shapes at one time; `groupKey` is the only group identity token and `repoKey` the only planned repository identity token; the state layer's scope is called per-checkout and never a project scope; the four repository-vocabulary tokens are described as repository checkouts wherever they appear. |

## 10. TELEMETRY & OBSERVABILITY REQUIREMENTS

N/A. No runtime surface is added or modified, so no metric, log, trace, span, or
alert is emitted. The change produces documentary evidence only: the two gate
runs, the structural diagram read, the naming-matrix and terminology scans, the
clause-fidelity tables, and the file-set comparison recorded in the change
artifacts.

## 11. RISKS & MITIGATIONS

| ID | Risk | Impact | Probability | Mitigation | Residual Risk |
|----|------|--------|-------------|------------|---------------|
| RSK-1 | Half-rename: some locations keep `projects list` for the flat record set while others use it for groups, leaving a corpus that contradicts itself page by page | H | H | Appendix B enumerates every location; AC-F14-1/AC-F14-2/AC-F14-3 scan the corpus; NFR-12 and NFR-13 set zero-survivor thresholds; the rename rule is stated once and referenced elsewhere | L: a peripheral page outside the matrix could still use an ambiguous phrase |
| RSK-2 | Backlog structure damaged: an entry inserted below the separator or the separator moved | M | M | Placement pinned in AC-F4-1; hunk containment in AC-F4-3; preservation in NFR-2 | L |
| RSK-3 | The group contract keeps the flat name in one page while another page uses it correctly, recreating the two-shape reading | H | M | AC-F6-2 and AC-F6-3 fix the two envelopes; AC-F14-3 forbids the affirmation; NFR-13 makes it a zero-count assertion | L |
| RSK-4 | The alias drifts into a second flat spelling with a different shape, or is described as `projects list` unqualified | M | M | DEC-21 fixes the token, payload, owner, and retirement; AC-F6-4 and AC-F8-5 assert both shapes | L |
| RSK-5 | A repository-vocabulary token is planned for rename, implying a state-layout migration inside a docs change | H | L | AC-F6-5 requires the mapping clause verbatim in contracts and carried on both pages; NFR-13 asserts the four tokens are described as checkouts | L |
| RSK-6 | The delivered `repos` semantics are lost again while the page is rewritten: `unbound` becomes an error or the delivered identities are renamed | H | M | AC-F7-2, AC-F7-3, and AC-F7-4 fix scope, identities, and the STATE example; NFR-3 counts the nine delivered facts | L |
| RSK-7 | Membership is inferred from a scan, so an undeclared clone is admitted | M | M | AC-F6-6 states configuration-only membership; AC-F8-1 requires the undeclared-clone seed; AC-F5-2 and the architecture invariant repeat it | L |
| RSK-8 | Aggregation reintroduces a whole-read exit 2 for one degraded member | M | M | AC-F6-7 and AC-F7-6 fix the classified partial result; the scenario asserts partial with the degraded member named | L |
| RSK-9 | The cross-member queue representation stays unstated, so release semantics are guessed | M | M | AC-F6-8 states one entry per member and the release rule; AC-F5-3 carries it into the architecture invariants | L |
| RSK-10 | The board keeps a group claim, creating a third meaning for `project` | M | M | AC-F7-8 reconciles `board.md`; AC-F7-6 forbids the group-scoped board claim on the projects page; AC-F11-1 keeps the README row honest | L |
| RSK-11 | The registry keeps two Delivery rows for `repos`, asserting a delivery that has not happened | H | M | AC-F13-1 and AC-F13-2 fix the row split and the COMMAND FAMILIES entry; AC-F2-6 records the decision-record task | L |
| RSK-12 | M2-S4 consumes the group contract without a declared edge | M | L | AC-F4-4 declares the dependency; AC-F11-1 removes the advisory note so the map and the dependency agree | L |
| RSK-13 | S19 assertions return to undeclared envelopes (`change.data.*`) while being "fixed" | M | M | AC-F3-4, AC-F6-9, AC-F8-3 declare `plan`, `closeout`, and `verify gates` envelopes and forbid the retired family | L |
| RSK-14 | A member with no implemented adapter is rejected instead of classified | H | M | AC-F2-2, AC-F6-7, AC-F8-1 keep the `not-yet-supported` token checkable | L |
| RSK-15 | Clause fidelity is sacrificed while adding derived requirements | M | M | NFR-8 separates 26 preserved ticket clauses from 32 board-derived clauses; AC-NFR8-1 checks both counts | L |
| RSK-16 | The single registry row is missing, duplicated, or misplaced | M | L | NFR-4 fixes 141 → 142, one row, one position; AC-NFR4-1 checks the guard output | L |
| RSK-17 | The gate runs are confused and a default-only failure is excused on a non-green head | M | M | NFR-6 and AC-NFR6-1 make the repository-local full suite authoritative and name the two tolerated default-only failures | L |
| RSK-18 | Diagram structure breaks while the flows are edited, with no renderer to catch it | L | M | NFR-7's structural read applies to every touched file | L |
| RSK-19 | `status.md` history is rewritten instead of appended | M | L | AC-F12-2 and NFR-11 use a whole-file retention oracle | L |
| RSK-20 | The M1 status page is edited to carry the S18 delta, breaking a frozen delivered page | M | L | AC-F7-9 pins the delta to the M2 README row; NFR-1 requires the page byte-identical | L |
| RSK-21 | The reference-page move is recorded as delivered by this docs change | M | L | AC-F10-1 phrases it as pending S18 code work; NFR-3 forbids delivery claims | L |

## 12. ASSUMPTIONS

- The ticket body (GH-303) remains the normative source for the M2-S11
  amendment, the S18 and S19 story text, the blueprint targets, and the ticket
  acceptance list; the review board's findings and decisions are the normative
  source for the derived clauses listed in Appendix A.2.
- M2-S11 is delivered by GH-288: the two-layer state scope, the checkout
  identity marker with its minted project key, the host index, the read-only
  `projects list [--json]` overview, the one-step migration guide, and the
  host-wide owner hold. `doc/spec/features/feature-projects.md`,
  `doc/spec/features/feature-cli-entrypoint.md`,
  `doc/guides/migrating-to-per-repository-state.md`, and
  `doc/decisions/TDR-0022-multi-repository-workstation-state-scope.md` describe
  that delivered behaviour and are unedited here.
- The delivered error identities are exactly `projects.identity-unreadable`,
  `projects.registry-corrupt`, and `projects.state-unavailable`, and a
  non-work-tree root is the declared `unbound` scope at exit 0 with one
  warning — verified against the delivered contracts and the projects feature
  spec.
- `PROJECT_KEY_PATTERN` is
  `^[a-z0-9](?:[a-z0-9-]*[a-z0-9])?-[0-9a-f]{8}$`, so an example key such as
  `delivery-a-1a2b3c4d` is valid and a bare basename is not.
- The project configuration document lives at
  `<configDirectoryName>/projects.yaml` with schema
  `delivery.projects.groups.v1`; the brand's directory name is configuration
  data, never a literal in planning text.
- `doc/planning/**` is outside the distribution-marker scope but inside the
  forbidden-literals `userFacingDocs` scope, and the guard literal-scans only
  registered documents absent at `corpusBaseline`.
- The forbidden-literals `registered` list holds 141 entries at base
  `723454e4`; the new page adds the one row (142). The list has no sorting
  requirement; the alphabetical convention is followed for reviewability.
- No mermaid syntax validator exists, so diagram validity is established
  structurally and no renderer or gate is invented.
- Backlog story order in the file is not numeric; insertion positions are read
  from the file, and the Epic M2 block closes with a blank line and `---`.
- M1-S17 is delivered, so M2-S19's dependency on it is satisfiable.
- M2-S4 needs the group contract, so its dependency on M2-S18 is declared rather
  than recorded as advisory.
- The environment's default `TMPDIR` is tmpfs; the two doc guards have opposite
  requirements and both are recorded rather than resolved by changing the
  environment.

## 13. DEPENDENCIES

| Direction | Item | Notes |
|-----------|------|-------|
| Depends on | GH-303 ticket text | Normative source for the amendment, both stories, the blueprint targets, and ticket acceptance |
| Depends on | Six-critic review board record on PR #306 | Normative source for the 32 derived clauses in Appendix A.2 |
| Depends on | ODR-0003 command-registry lock rule | A rename after M0 requires a superseding decision record plus a code change, which fixes the registry row split and the S18 decision-record task |
| Depends on | Repository state at change base `723454e4` (`main-tools`, GH-288 merged) | The base carries the delivered M2-S11 facts, the pack, the indices, the snapshot, and the 141-row registry |
| Depends on | Shipped GH-288 delivery (M2-S11, `projects list` mounted) | The premise: the flat surface exists in code, in the prompt-required set, in root help, in current truth, and in the delivered `projects.v1` payload |
| Depends on | Delivered M1 baseline (M1-S17 in particular) | M2-S19's dependency line names M1-S17; the M2-S11 premises are M0-S5 and M1-S17 |
| Depends on | Doc guards and the aggregate gate | `test-doc-distribution.sh` (default `TMPDIR`), `forbidden-literals` (one new registration), `pnpm check` (repository-local `TMPDIR`, authoritative) |
| Blocks | M2-S18 and M2-S19 ticket creation and delivery | Tickets are created from backlog entries; the pack seeds each test plan |
| Blocks | Any M2 board work that consumes the group contract | The dependency is now declared (M2-S4 on M2-S18) |
| Related | M3-S6 repository hygiene | The hygiene verbs are the `repos` family's later subcommands delivered by M3-S6; no M3 delivery is changed |
| Related | Current truth for the delivered flat surface | Unchanged here; describes the delivered surface until S18 ships |
| Related | #286 (daemon mount) | Untouched prerequisite context recorded in the entrypoint delta note |

## 14. OPEN QUESTIONS

None outstanding. The review board's decisions A-D resolved the contract
identity, the flat surface name, the rename rule and alias, and the group
identity; every other choice this revision needed (configuration document path
and format, aggregation and partial-failure semantics, the board's key
vocabulary, the queue representation, the status scope surface, the S4 edge,
and the registry lock statement) is recorded as a decision (DEC-19 through
DEC-32) rather than left open.

| ID | Question | Context | Status |
|----|----------|---------|--------|
| — | None outstanding | — | Closed |

## 15. DECISION LOG

| ID | Decision | Rationale | Date |
|----|----------|-----------|------|
| DEC-1 | The change is docs-only and its product-file budget is exactly 15 files: 14 under `doc/planning/oss-tooling/**` (13 modified plus 1 new) plus `scripts/checks/forbidden-literals.registry.json` | The ticket's acceptance is "docs-only change; guards green; no code"; the registry row is required because the guard fails closed on an unregistered new page | 2026-11-11 |
| DEC-2 | `repos` is the flat record-set family delivered by M2-S18 (rename and alias), and the M3-S6 clone/branch/worktree hygiene verbs are that family's later subcommands; `projects` is the group surface owned by M2-S18 | The ticket assigns the flat record set to the name M3 reserves; the family is defined once with the flat record set first and hygiene verbs later | 2026-11-11 |
| DEC-3 | **Superseded by DEC-19.** The flat contract is not renamed onto the delivered name: the delivered flat contract stays `projects.v1`, the renamed flat surface is `repos.v1`, and the group contract is `project-groups.v1` | Reusing `projects.v1` for groups made one name carry two payloads and contradicted the delivered envelope | 2026-11-11 |
| DEC-4 | The ticket's "entrypoint delta note" is read as two requirements: one new Epic M2 context paragraph in `backlog.md`, and the correction of `m2/entrypoint-delta.md`'s root-family line and mounting paragraph | The backlog bullet and the blueprint bullet each name a delta note; both are needed so the story set and the blueprint agree | 2026-11-11 |
| DEC-5 | Index edits are in scope as derived consistency: `m2/README.md`'s contents table and map, and `milestones/README.md`'s M2 index row | A new page and two new stories that no index points at are not discoverable | 2026-11-11 |
| DEC-6 | `status.md` gains one new dated section only, after the 2026-11-11 delivery snapshot; no earlier section or line changes | Dated sections are historical records; the snapshot records the amendment as plan state | 2026-11-11 |
| DEC-7 | No alias, rename, or deprecation is implemented by this change; the alias is recorded as M2-S18's obligation with its token, payload, owner, and retirement fixed by DEC-21 | The delivered flat surface exists, so the alias is a real transition — but it belongs to the change that renames the surface | 2026-11-11 |
| DEC-8 | M2-S18 and M2-S19 are inserted after M2-S17 and before the closing separator; M2-S11 is amended in place | Appending inside the block minimises the diff and preserves every anchor | 2026-11-11 |
| DEC-9 | The three-level model is stated in the C4 Level 1 context, and a `### Cross-repository change` flow is added; the overview flow is rewritten in place | The model is the change's central claim, so it is drawn where a reader starts | 2026-11-11 |
| DEC-10 | `commands/repos.md` is a new page carrying the flat record-set content with the delivered semantics; `projects.md` is rewritten in place as the group page; both keep `Status: Proposed (M2)` | Two surfaces with two meanings need two pages, and rewriting in place keeps each page's identity | 2026-11-11 |
| DEC-11 | **Amended by DEC-20.** `SC-M2-S11-01` names the flat surface; `SC-M2-S11-02` becomes prospective and asserts the S18 rename rather than the delivered surface, because M2-S11's delivered acceptance criterion keeps describing the shipped `projects list` | Leaving either seed asserting the delivered surface as `repos list` would attribute an undelivered rename to the delivered story | 2026-11-11 |
| DEC-12 | Mixed tracker kinds are valid configuration at validation time, and a member whose tracker kind has no implemented adapter is classified `not-yet-supported` | A fixed token makes the clause testable instead of a prose promise | 2026-11-11 |
| DEC-13 | The configuration document and the change plan shape are documented as planned data shapes | M2-S18 and M2-S19 are undelivered; the pack records intended contracts | 2026-11-11 |
| DEC-14 | **Superseded by DEC-28.** M2-S4's dependency set is no longer left advisory: it gains M2-S18 and the map row loses the advisory phrase | The board consumes the group contract, so a declared edge is honest and the advisory convention is no longer needed | 2026-11-11 |
| DEC-15 | The registry edit adds exactly one row for the new page; the one pre-existing out-of-order pair elsewhere is not re-sorted | The guard requires uniqueness and presence, not order | 2026-11-11 |
| DEC-16 | The gates are invoked per guard: distribution guard with the default `TMPDIR`; aggregate gate with a repository-local `TMPDIR` as authoritative, with both runs recorded | The aggregate gate's two default-only failures are a cross-device clone and a timing sensitivity | 2026-11-11 |
| DEC-17 | Phase 7 records that no current-truth change is required, and `doc/spec/**` and `doc/overview/**` stay untouched | Current truth describes the delivered surface; this change renames nothing in code | 2026-11-11 |
| DEC-18 | The rebase onto `723454e4` made the shipped GH-288 state, the per-page disambiguation, and delivered-fact preservation part of the requirement | The rebase changed the premises: the delivered flat surface now exists | 2026-11-11 |
| DEC-19 | **Decision A.** The group contract is `project-groups.v1` with top-level `data.groups[]` and the group identity field `groupKey`; `projects.v1` keeps its delivered meaning — the flat record set with `data.projects[]` and `projectKey` — and is never reused for groups | Reusing the delivered name and its repository-shaped identity field made one contract carry two meanings and broke traceability of the delivered envelope | 2026-11-11 |
| DEC-20 | **Decision B.** The flat surface is `repos list --json` returning `repos.v1` with `data.repos[]` and the record field `repoKey` | The flat surface moves to the name reserved for it and takes repository vocabulary with it | 2026-11-11 |
| DEC-21 | **Decision C.** One rename rule, stated once: from M2-S18, `projects list` enumerates groups and `repos list` enumerates the flat record set; the deprecation alias is the different token `projects list --flat`, which returns the delivered `projects.v1` payload (`data.projects[]`); the alias is owned by M2-S18 and retires at the M3 boundary. The same rule carries three field renames: `projectKey → repoKey` and `data.projects[] → data.repos[]` on the flat surface at M2-S18, and the board's repository list field `projects[] → repositories[]` in the planned board envelope corrected by this change. The alias requires an S18 acceptance criterion, a shape-asserting seed, and an S18 task to update `doc/guides/migrating-to-per-repository-state.md` | One rule with one owner and one payload removes the reading in which a single command spelling returns two shapes | 2026-11-11 |
| DEC-22 | **Decision D.** A group's identity field is `groupKey`; `projectKey` is never a group identity | The delivered repository identity token keeps its meaning, so no reader can confuse a group with a checkout | 2026-11-11 |
| DEC-23 | The project configuration document is `<configDirectoryName>/projects.yaml`, schema `delivery.projects.groups.v1`, with `groups[]` holding `groupKey`, `name`, optional `workspaceRoot`, and `members[]` where each member declares a repository selector (`root` or `repoKey`) and a `trackerKind` | Membership needs a declared path and format to be configuration-only and testable; a selector keeps the declaration independent of where a checkout lives | 2026-11-11 |
| DEC-24 | Project-scoped aggregation is defined once: members from configuration in declared order; per-member outcomes `observed`, `not-yet-supported`, `state-unavailable`, `unregistered`; one degraded member yields exit 0 with `partial` true and the degraded members named; exit 2 only when the configuration or the invoking scope cannot be read | A read that fails wholesale for one unavailable member cannot show the members that are readable; classifying the member is both truthful and testable | 2026-11-11 |
| DEC-25 | The status scope surface is pinned as `status --project <groupKey>`; the M1 status page stays frozen and the S18 delta is named in the M2 pack README row | Naming the surface removes the ambiguity in "status accepts a project scope" without editing a delivered page | 2026-11-11 |
| DEC-26 | `board --project` stays a repository key, the board's envelope lists repository keys, and its refusal identity uses repository vocabulary (`board.repository-unknown`); the group claim is removed | The board is a host view over managed checkouts; only queue and status are group-scoped in S18 | 2026-11-11 |
| DEC-27 | A cross-repository change holds one queue entry per member keyed by that member's ref; dependency edges are per member; release drops each member lease while entries stay, removal is per member with the change's reason, and one member's landing removes only its entry; one lane per member entry | Without an explicit representation, a two-repository change either shares one entry or holds none, and release semantics become guesswork | 2026-11-11 |
| DEC-28 | M2-S4's dependency line gains M2-S18 and the M2 pack's map row loses the advisory phrase | The dependency is real and declared; the advisory convention existed only because the edge was missing | 2026-11-11 |
| DEC-29 | The registry splits into one delivered `projects` row (M2-S11, shipped GH-288) and one prospective `repos` row (Delivery `-`, Extended M2-S18 and M3-S6), marked not-delivered pending the superseding decision record and code change required by ODR-0003; the record itself is an S18 task | Two Delivery rows for one name asserts a delivery that has not happened and contradicts the ODR-0003 lock rule | 2026-11-11 |
| DEC-30 | The board-mandated additions to M2-S18 and M2-S19 are recorded as derived task and acceptance clauses (Appendix A.2), never as rewrites of ticket clauses | Fidelity to the ticket and coverage of the board are both required; separating them keeps both auditable | 2026-11-11 |
| DEC-31 | S19's shared definition-of-done verdict is contracted at `verify gates` (`data.definitionOfDone`, `data.blockingMembers[]`), and closeout reports `closeout.data.members[]` | S19's failing-member assertion needs a declared envelope instead of a retired `change.data` family | 2026-11-11 |
| DEC-32 | "One review flow" is defined executably as one review run over the declared member pull-request set with one verdict per member, each member reviewed once | The phrase is otherwise untestable, and a per-member review cycle would silently multiply the lifecycle | 2026-11-11 |

## 16. AFFECTED COMPONENTS (HIGH-LEVEL)

| Component | Impact |
|-----------|--------|
| `doc/planning/oss-tooling/backlog.md` | Updated: M2-S11 keeps the delivered story and its shipped-surface acceptance; M2-S18 owns the rename, alias, field renames, migration guide, config-only membership, scoped grammar, and decision record; M2-S19 gains ordering; M2-S4 depends on M2-S18; one context paragraph |
| `doc/planning/oss-tooling/milestones/m2/architecture.md` | Updated: three-level context, discovery-root versus `default` sentence, project-scoped overview flow, cross-repository flow with the queue representation, boundary invariants |
| `doc/planning/oss-tooling/milestones/m2/contracts.md` | Updated: `repos.v1`, retained `projects.v1`, `project-groups.v1`, rename rule, mapping clause, configuration document, aggregation, queue/lane representation, change plan shape |
| `doc/planning/oss-tooling/milestones/m2/commands/repos.md` | New: flat record-set page with delivered semantics, `unbound` scope, delivered error identities, host-root STATE example, `--help`/`--version`, mapping clause |
| `doc/planning/oss-tooling/milestones/m2/commands/projects.md` | Updated: group page with `project-groups.v1`, `groupKey`, member `daemonReachable`, aggregation and partial failure, scoped grammar |
| `doc/planning/oss-tooling/milestones/m2/commands/queue.md` | Updated: `queue list --project <groupKey>` in synopsis and OPTIONS |
| `doc/planning/oss-tooling/milestones/m2/commands/board.md` | Updated: repository-key boundary, repository-vocabulary envelope and refusal identity, corrected attribution |
| `doc/planning/oss-tooling/milestones/m2/test-scenarios.md` | Updated: S2-S19 intro, S18/S19 seed sets, contracted-envelope assertions, alias seed, S11 seeds reconciled |
| `doc/planning/oss-tooling/milestones/m2/journeys.md` | Updated: opening journey reconciled, time-scoped disambiguation |
| `doc/planning/oss-tooling/milestones/m2/entrypoint-delta.md` | Updated: split, retained mount note, reference-page move as pending S18 code work |
| `doc/planning/oss-tooling/milestones/m2/README.md` | Updated: contents rows, corrected map rows (S11, S18 with the status delta and decision record, S19, S4, scenarios) |
| `doc/planning/oss-tooling/milestones/README.md` | Updated: M2 index row gains `m2/commands/repos.md` |
| `doc/planning/oss-tooling/status.md` | Updated: one new dated correction section |
| `doc/planning/oss-tooling/cli-command-registry.md` | Updated: split rows, one Delivery row per name, ODR-0003 lock statement, `projects` in COMMAND FAMILIES, boundary note |
| `scripts/checks/forbidden-literals.registry.json` | Updated: one registration for the new pack page |
| `doc/spec/**`, `doc/overview/**`, `doc/guides/**`, `packages/**`, `tests/**`, `.opencode/**`, `.ai/**`, all other `scripts/**`, the M1 pack, and the M0 pack | Unchanged; the delivered surface, its feature specs, the migration guide, and TDR-0022 keep describing today's behaviour |

## 17. ACCEPTANCE CRITERIA

### 17.1 Functional

| ID | Criterion | Linked |
|----|-----------|--------|
| AC-F1-1 | **Given** the M2-S11 entry and the base revision `723454e4`, **when** they are compared, **then** the heading, the `- Depends on: M0-S5, M1-S17.` line, the `- Ticket: GH-288 (milestone M2)` line, the `- Progress: delivered by GH-288 …` record, the per-repository state scoping, the host index, the migration note, the tests clause, and the two-checkout ref-GH-241 collision acceptance criterion are unchanged in substance; the enumeration acceptance criterion still describes the shipped `projects list` surface; and the entry records the planned transition as M2-S18's rename with the `--flat` alias. | F-1, DM-1 |
| AC-F1-2 | **Given** the amended M2-S11 entry, **when** every clause is read, **then** it contains no `repos list` acceptance criterion and no `projectKey → repoKey` or `data.projects[] → data.repos[]` rename clause, no delivered clause is weakened, merged, or moved, and the GH-288 record is present and is not restated as a plan. | F-1, NFR-8, NFR-13 |
| AC-F1-3 | **Given** the M2-S11 and M2-S18 entries together, **when** ownership is checked clause by clause, **then** the rename, the alias, the field renames, the migration-guide update, configuration-only membership, the scoped-read grammar, and the superseding decision record are each claimed by exactly one story — M2-S18 — and M2-S11 names M2-S18 as that single owner. | F-1, F-2, DM-1 |
| AC-F2-1 | **Given** `backlog.md`, **when** the Epic M2 block is read, **then** `### M2-S18 Project groups` appears with `- Goal:`, `- Tasks:`, `- AC:`, and `- Depends on: M2-S11.`, carrying the 12 ticket clauses of Appendix A.1 verbatim in substance and no `- Ticket:` line. | F-2, DM-1, NFR-8 |
| AC-F2-2 | **Given** the S18 entry and the contracts, **when** the mixed-tracker clause is checked, **then** both state that a configuration mixing tracker kinds is accepted at validation time with the unimplemented member classified `not-yet-supported` rather than rejected silently, and no clause is softened to "supported later" or "rejected". | F-2, F-6, DEC-12 |
| AC-F2-3 | **Given** the S18 entry, **when** its tasks and acceptance block are read, **then** it carries the rename task (from M2-S18 `projects list` enumerates groups and `repos list` enumerates the flat record set), the alias task (`projects list --flat` returns the delivered `projects.v1` payload with `data.projects[]`, owned by M2-S18, retired at the M3 boundary), and an acceptance criterion asserting that alias payload shape. | F-2, DM-7, DEC-21 |
| AC-F2-4 | **Given** the S18 entry, **when** the remaining derived tasks are read, **then** it carries the field-rename task (`projectKey → repoKey`, `data.projects[] → data.repos[]`), the task to update `doc/guides/migrating-to-per-repository-state.md`, and a statement that these are S18 code work and not current truth. | F-2, DM-4, DM-6 |
| AC-F2-5 | **Given** the S18 entry, **when** the membership and scope tasks are read, **then** registration is declared as configuration-only (`workspaceRoot` and `members` in the project configuration document, with a scan only locating declared members), and the scoped-read task names `queue list --project <groupKey>` and `status --project <groupKey>`. | F-2, DM-3, DM-8 |
| AC-F2-6 | **Given** the S18 entry and the registry, **when** the `repos` delivery claim is checked, **then** S18 carries the task to author the superseding decision record for the `repos` name before the registry row moves to Delivery, and no task claims the rename has shipped. | F-2, F-13, DEC-29 |
| AC-F3-1 | **Given** `backlog.md`, **when** the Epic M2 block is read, **then** `### M2-S19 Cross-repository changes` appears with `- Goal:`, `- Tasks:`, `- AC:`, and `- Depends on: M2-S11, M2-S18, M1-S17.`, carrying the 11 ticket clauses of Appendix A.1 verbatim in substance and no added or omitted ticket clause. | F-3, DM-1, NFR-8 |
| AC-F3-2 | **Given** the S19 entry, **when** its acceptance block is read, **then** each of its three ticket criteria is independently identifiable, "one review flow" is defined executably as one review run over the declared member pull-request set with one verdict per member and no member reviewed twice, and the per-member CI corroboration criterion states that an unavailable CI reading blocks the shared definition of done rather than counting as green. | F-3, DM-10, DEC-32 |
| AC-F3-3 | **Given** the S19 entry, **when** the derived acceptance criterion is read, **then** it states that a member step with a dependency edge does not start before the prerequisite member's pull request lands and that the evidence lists the pull requests in landing order. | F-3, DM-10 |
| AC-F3-4 | **Given** `contracts.md`'s cross-repository change plan shape, **when** it is read against the S19 acceptance set, **then** it declares `plan.data.members[]` (repoKey, slice, branch, pullRequest, dependsOn[], gates), per-member gates, the one-review-flow definition, the shared verdict at `verify gates` (`data.definitionOfDone`, `data.blockingMembers[]`), `closeout.data.members[]` (repoKey, branch, cleanup, pullRequest, issueClosure, landed), and evidence enumerating every member pull request in landing order. | F-3, F-6, DM-10, DEC-31 |
| AC-F4-1 | **Given** the `backlog.md` diff against the base revision, **when** insertion positions are checked, **then** the two new entries lie after M2-S17's last line, inside the Epic M2 block, and before the blank line and `---` that close it, and the separator and `## Epic M3` heading are byte-identical and follow the inserted entries. | F-4, NFR-2, DEC-8 |
| AC-F4-2 | **Given** the Epic M2 block, **when** it is compared with the base revision, **then** one new context paragraph follows the retirement note and precedes `### M2-S2`, stating the repository/group/workspace distinction, configuration-only membership, the delivered flat surface, the rename rule by reference (not restated), and the root-family consequence; the retirement note, epic heading, frontmatter, reading guide, cross-cutting principles, and every other story are byte-identical. | F-4, NFR-2, DEC-4 |
| AC-F4-3 | **Given** the `backlog.md` diff with zero context, **when** the hunks are inspected, **then** every hunk lies inside the M2-S11 entry, the M2-S18 entry, the M2-S19 entry, the M2-S4 `- Depends on:` line, or the one added context paragraph, and no hunk quotes a neighbouring story's line. | F-4, NFR-2 |
| AC-F4-4 | **Given** the M2-S4 entry, **when** its dependency line is compared with the base revision, **then** it reads `- Depends on: M1-S5, M1-S17, M2-S11, M2-S18.` with its terminal period, and every other line of the entry is byte-identical. | F-4, F-11, DEC-28 |
| AC-F5-1 | **Given** `milestones/m2/architecture.md`, **when** the C4 Level 1 context is read, **then** it presents repository, project group, and workspace as three related levels — repository as the delivery unit, project as a configured group of repositories with declared members, workspace as an optional directory usable as a discovery root — with the optionality visible in the diagram and prose. | F-5, DM-2, RSK-8 |
| AC-F5-2 | **Given** the same document, **when** the model prose is read, **then** a group's membership is declared in configuration, a directory scan only locates declared members and never admits an undeclared clone, a workspace is never required, and a group whose members live in unrelated directories behaves identically to one whose members share a root. | F-5, DM-2, DM-3 |
| AC-F5-3 | **Given** the architecture, **when** the flows and invariants are read, **then** the overview flow is group-scoped, the cross-repository change flow names one queue entry per member with per-member dependency edges, and `## Boundary invariants at M2 exit` states the naming boundary by reference to the rename rule, configuration-only membership, one queue entry per member, the release rule, workspace optionality, and one lifecycle per cross-repository change. | F-5, DM-2, DM-9, DM-10 |
| AC-F5-4 | **Given** the architecture's workspace discussion, **when** the state paragraph and the model prose are compared, **then** one sentence distinguishes the discovery workspace root (an optional directory) from the state layer's fixed `default` workspace identifier (the workspace key inside every per-checkout state root), and no sentence collapses the two. | F-5, DM-2 |
| AC-F6-1 | **Given** `contracts.md`, **when** the `repos.v1` section is read, **then** it defines the flat record set as `data.repos[]` with `repoKey`, `root`, `stateLocation`, `daemonReachable` including the closed reason set and the `unbound` scope, `handoverState`, and `hostIndexRevision`, records the rename from the delivered surface, and attributes the surface to M2-S18. | F-6, DM-4, DEC-20 |
| AC-F6-2 | **Given** the `project-groups.v1` section, **when** its fields are read, **then** it defines `data.groups[]` with `groupKey` as the group identity, `name`, the optional `workspaceRoot`, and `members[]` each carrying `repoKey`, `root`, `trackerKind`, `state`, `health`, and `daemonReachable`; a member field never denotes the group, and no group-named field denotes a repository. | F-6, DM-5, DEC-19, DEC-22 |
| AC-F6-3 | **Given** the `projects.v1` section, **when** it is read, **then** it defines the delivered flat record set (`data.projects[]`, `projectKey`, `hostIndexRevision`), names `project-groups.v1` as the group contract, and contains no sentence describing `projects.v1` as the group contract and no field of `projects.v1` denoting a group. | F-6, DM-6, DEC-19 |
| AC-F6-4 | **Given** `contracts.md`, **when** the rename rule is checked, **then** it appears exactly once as the sentence "**From M2-S18, `projects list` enumerates groups and `repos list` enumerates the flat record set; the deprecation alias is the different token `projects list --flat`, owned by M2-S18, which returns the delivered `projects.v1` payload (`data.projects[]`) and retires at the M3 boundary.**"; the same rule names the three field renames — `projectKey → repoKey`, `data.projects[] → data.repos[]`, and `board.data.projects[] → board.data.repositories[]` — with no second statement of the rule elsewhere; the alias token is used only for that meaning; and no location in the corpus describes one spelling returning both shapes at one time. | F-6, DM-7, DEC-21, DEC-22 |
| AC-F6-5 | **Given** `contracts.md`, **when** the repository-vocabulary mapping is read, **then** one clause states that the `project-identity.json` marker, the `<host root>/projects/<key>` container, the host index's `projects[]`/`projectKey` fields, and `--project-root` each denote a repository checkout and keep that meaning permanently unless a code change renames them; and the clause is carried in `commands/repos.md`, in `commands/projects.md`, and in the `repos.v1` section. | F-6, DM-11, F-7 |
| AC-F6-6 | **Given** the project configuration section, **when** it is read, **then** it declares the document path `<configDirectoryName>/projects.yaml`, the schema `delivery.projects.groups.v1`, `groups[]` with `groupKey`, `name`, optional `workspaceRoot`, and `members[]` with a repository selector (`root` or `repoKey`) plus `trackerKind`; states that membership is configuration-only; and states that a scan inside `workspaceRoot` locates declared members only and never admits an undeclared clone. | F-6, DM-3, DEC-23 |
| AC-F6-7 | **Given** the project-scoped aggregation clause, **when** it is read, **then** it states that members come from configuration in declared order, defines the per-member outcomes `observed`, `not-yet-supported`, `state-unavailable`, and `unregistered`, states that one `state-unavailable` member produces a classified partial result at exit 0 with `partial` true and the degraded member named, states that exit 2 occurs only when the configuration document or the invoking scope cannot be read, and states that a `not-yet-supported` member contributes no records and never fails the read. | F-6, DM-8, DEC-24 |
| AC-F6-8 | **Given** the queue/lane representation clause, **when** it is read, **then** it states one queue entry per member keyed by that member's ref, per-member dependency edges, the release rule (release drops each member lease while entries stay, removal is per member with the change's reason, one member's landing removes only its entry), and one lane per member entry with no cross-repository lane. | F-6, DM-9, DEC-27 |
| AC-F6-9 | **Given** the cross-repository change plan shape, **when** it is read, **then** it declares the `plan.data.members[]`, `verify gates` definition-of-done verdict, and `closeout.data.members[]` envelopes of AC-F3-4, the one-review-flow definition, per-member CI corroboration, dependency ordering, and evidence enumerating every member pull request. | F-6, DM-10, DEC-31, DEC-32 |
| AC-F7-1 | **Given** `commands/repos.md`, **when** it is read, **then** it carries `Status: Proposed (M2)`, a bare `repos` name with the `<binary>` prefix, a synopsis with `repos list [--json]`, `repos --help`, `repos list --help`, and `repos --version`, OPTIONS rows for `--json`, `--help`, and `--version` where both help forms and the version state no read of state, git, configuration, or the network, the five reported fields, the `repos.v1` envelope, exit codes, examples, an error table, see-also links, and a rename pointer to the canonical rule. | F-7, DM-13, DEC-21 |
| AC-F7-2 | **Given** `commands/repos.md`, **when** its scope section is read, **then** it restores the read-only statement (no index maintenance, no pruning, no replacement, no creation of state roots, and the two permitted side effects named) and states that an invocation outside any git work tree uses the declared `unbound` scope, emits one bounded warning, registers nothing, keeps its exit code, and is never reported as a row. | F-7, DM-4, F-6 |
| AC-F7-3 | **Given** `commands/repos.md`, **when** the error table and the `unbound` prose are compared, **then** the table carries the delivered identities `projects.identity-unreadable`, `projects.registry-corrupt`, and `projects.state-unavailable`, a non-work-tree root appears as the `unbound` scope at exit 0 rather than as an error, and any `repos.*` prefix change is stated as M2-S18 code work and never as current truth. | F-7, DM-4, F-6 |
| AC-F7-4 | **Given** `commands/repos.md`, **when** the examples and the STATE column are read, **then** the state location is `<host root>/projects/<key>`, the example key conforms to `PROJECT_KEY_PATTERN` (for example `delivery-a-1a2b3c4d`), and the page carries the mapping clause sentence. | F-7, DM-11 |
| AC-F7-5 | **Given** `commands/projects.md`, **when** it is read, **then** it names `project-groups.v1`, `data.groups[]`, and `groupKey`; documents `members[].daemonReachable` with the closed reason vocabulary; contains no orphan `daemonReachable.reason` paragraph unattached to a group field; uses `data.groups[]` and `groupKey` in its envelope table and examples; and points at the configuration document and the aggregation clause. | F-7, DM-5 |
| AC-F7-6 | **Given** `commands/projects.md`, **when** the behaviour prose is read, **then** it describes the classified partial result for one degraded member, the `not-yet-supported` member, and the exit codes of the aggregation clause; it makes no group-scoped board claim; its `--project` argument is `<groupKey>`; it documents `--flat` as a pointer to the rename rule; and it carries a time-scoped disambiguation that does not describe one spelling returning both shapes at one time. | F-7, DM-7, DM-8 |
| AC-F7-7 | **Given** the two command pages together, **when** their surfaces are compared, **then** `repos.v1` and the flat record set appear only on the `repos` page, `project-groups.v1` and the group surface only on the `projects` page, each page points at its own contract, and neither claims the other's surface or registration. | F-7, F-14, NFR-3 |
| AC-F7-8 | **Given** `commands/board.md`, **when** it is read, **then** `--project <key>` is described as a repository key, `--all` spans managed repositories, the envelope's repository list field is `repositories[]` (renamed from the delivered-style `projects[]`), the refusal identity uses repository vocabulary, the attribution names the per-repository state scope and host index delivered by M2-S11, and no sentence claims a group-scoped board. | F-7, DM-11, DEC-26 |
| AC-F7-9 | **Given** `commands/queue.md` and the M2 pack README, **when** the scope grammar is checked, **then** `queue.md`'s synopsis and OPTIONS carry `queue list --project <groupKey>`, the S18 status delta is pinned as `status --project <groupKey>` and named in the M2 README's S18 row, and `doc/planning/oss-tooling/milestones/m1/commands/status.md` is byte-identical to the base revision. | F-7, DM-8, DEC-25 |
| AC-F8-1 | **Given** `test-scenarios.md`, **when** the S18 seeds are counted and read, **then** at least five `SC-M2-S18-*` seeds exist, each with exactly one `Assert:` line, covering discovery through a registered workspace directory, the same group without a workspace, group listing with member health and `daemonReachable`, `queue list --project <groupKey>` and `status --project <groupKey>`, mixed tracker-kind classification, and configuration-only membership with one undeclared clone inside the root that is asserted not to be a member. | F-8, DM-12, DEC-23 |
| AC-F8-2 | **Given** the same document, **when** the S19 seeds are counted and read, **then** at least five `SC-M2-S19-*` seeds exist, each with exactly one `Assert:` line, covering one spec with two member branches and two pull requests under one review flow and one closeout, a failing member blocking the shared definition of done with the member named, per-member CI corroboration including the unavailable-reading case, and dependency ordering with the evidence in landing order. | F-8, DM-10, DM-12 |
| AC-F8-3 | **Given** every S18 and S19 `Assert:` line, **when** the fields it reads are checked against the contracts, **then** each reads only `project-groups.v1`, `repos.v1`, `plan.data.members[]`, `closeout.data.members[]`, or `verify gates.data.definitionOfDone`/`blockingMembers[]`; zero assertions use a `change.data.*` family; and the `closeout.data.members[]` assertion is backed by the contract declaration of AC-F3-4. | F-8, DM-10, DEC-31 |
| AC-F8-4 | **Given** the two `SC-M2-S11-*` seeds, **when** they are read, **then** `SC-M2-S11-01` names the flat record set through `repos list`, and `SC-M2-S11-02` is prospective — asserting the S18 rename (delivered spelling to `repos list`, plus the alias payload) rather than the delivered surface as `repos list` today; and no seed asserts a shipped `projects list` group enumeration. | F-8, F-1, DEC-11 |
| AC-F8-5 | **Given** the alias seed, **when** it is read, **then** it asserts in one scenario that `projects list --flat --json` returns the delivered `projects.v1` payload (`data.projects[]`, `projectKey`, `hostIndexRevision`) while `projects list --json` returns `project-groups.v1` (`data.groups[]`, `groupKey`). | F-8, DM-7, DEC-21 |
| AC-F8-6 | **Given** the document's introduction, **when** it is read, **then** it states "M2-S2 through M2-S19" and states at least two seeds per story. | F-8, F-11 |
| AC-F9-1 | **Given** `journeys.md`, **when** the opening journey is read, **then** it is a group-scoped morning overview that shows membership from configuration, the flat view from `repos list`, the group view from `projects list`, the project-scoped queue and status reads, workspace optionality, same-ref disjointness, and one time-scoped disambiguation referencing the rename rule. | F-9, DM-2, DM-5 |
| AC-F10-1 | **Given** `entrypoint-delta.md`, **when** its planned additions and mounting paragraph are read, **then** `repos` appears as the flat record set owned by M2-S18 and `projects` as the group surface owned by M2-S18, the **Mounted by GH-288 (M2-S11)** note states that the shipped `projects list` is the delivered flat surface, the reference-page move is phrased as pending S18 code work, and the observed composition, daemon gap, snapshot statement, and remaining additions are unchanged in meaning. | F-10, DEC-4 |
| AC-F11-1 | **Given** `milestones/m2/README.md`, **when** its contents table and map are read, **then** the table has one row per artifact with `commands/repos.md` stated as the flat record set owned by M2-S18; the contracts row names `repos.v1`, the group contract `project-groups.v1`, the delivered `projects.v1` payload, the configuration document, and the change plan shape; M2-S11 maps to the delivered `projects.v1`, M2-S18 maps to `project-groups.v1` plus the configuration document plus the `status --project <groupKey>` delta plus the superseding decision record, M2-S19 maps to the change plan shape, the M2-S4 row carries no advisory phrase, and the scenarios row reads S2 through S19. | F-11, F-14, DEC-28 |
| AC-F11-2 | **Given** `milestones/README.md`, **when** its index table is read, **then** the M2 row links `m2/commands/repos.md` in addition to its previous targets, for thirteen targets, and the M0 and M1 rows are byte-identical to the base revision. | F-11, DEC-5 |
| AC-F12-1 | **Given** the new dated section in `status.md` placed after the 2026-11-11 delivery snapshot, **when** it is read, **then** it records the contract split (`project-groups.v1`/`groupKey`; delivered `projects.v1`; `repos.v1`/`repoKey`), the rename rule and alias, the S18 ownership of the rename, configuration-only membership, the scoped-read grammar, the board boundary including its `repositories[]` field, the registry split, and the S4 edge, as planning state only, claiming neither M2 delivery nor milestone exit. | F-12, DEC-6 |
| AC-F12-2 | **Given** `status.md` compared with the base revision, **when** a line-retention comparison runs over the whole file, **then** every base line is present, in the same order, byte-identical, and every added line lies inside the one new dated section. | F-12, NFR-11, DEC-6 |
| AC-F13-1 | **Given** `cli-command-registry.md`, **when** the `projects` and `repos` rows are read, **then** exactly one `ados projects` row carries Delivery `M2-S11 (shipped in GH-288)` with Extended `M2-S18` describing the group spelling and the `--flat` retirement, and exactly one `ados repos` row carries Delivery `-` with Extended `M2-S18` (rename and alias) and `M3-S6` (hygiene verbs), marked not-delivered pending the superseding decision record and code change required by ODR-0003; no second `ados repos` Delivery row exists in any milestone table. | F-13, DEC-29 |
| AC-F13-2 | **Given** the registry, **when** COMMAND FAMILIES and the remaining rows are checked, **then** `projects` appears in the Operate family line, the boundary note names the two meanings and points at the rename rule, no name carries two Delivery rows, and every other row is byte-identical to the base revision. | F-13, NFR-1, DEC-29 |
| AC-F14-1 | **Given** the fourteen touched planning documents, **when** the corpus is searched for both names, **then** zero occurrences of `repos`/`repos list` denote a group and zero occurrences of `projects`/`projects list` denote the flat record set outside the time-scoped per-page disambiguation and statements recording delivered GH-288 facts; every Appendix B row is in the state the matrix requires. | F-14, NFR-12, RSK-1 |
| AC-F14-2 | **Given** the same corpus, **when** every page using the group meaning is read, **then** each carries at least once a time-scoped disambiguation referencing the rename rule — the verified minimum set being `backlog.md`, `m2/contracts.md`, `m2/commands/projects.md`, `m2/test-scenarios.md`, `m2/journeys.md`, and the new `status.md` section; every delivered GH-288 fact is present in its base form or carried to the location that owns the delivered surface; and no two touched pages give the two names contradictory meanings. | F-14, DM-2, NFR-12, RSK-1 |
| AC-F14-3 | **Given** the same corpus, **when** the terminology lock is checked, **then** zero statements affirm that the group contract is `projects.v1`, zero statements affirm that a group identity is `projectKey`, zero statements affirm that one spelling returns both shapes at one time, `groupKey` is the only group identity token, `repoKey` the only planned repository identity token, and the state layer's scope is called per-checkout and never a project scope. | F-14, NFR-13, DEC-19, DEC-22 |

### 17.2 Non-Functional

| ID | Criterion | Linked |
|----|-----------|--------|
| AC-NFR1-1 | **Given** the whole-change diff filtered to product files, **when** the changed-path list is inspected, **then** exactly 15 files change — 14 under `doc/planning/oss-tooling/**` (the 13 modified documents plus the new `milestones/m2/commands/repos.md`) and `scripts/checks/forbidden-literals.registry.json` — zero files change under `doc/spec/**`, `doc/overview/**`, `doc/guides/**`, `doc/templates/**`, `packages/**`, `tests/**`, `.opencode/**`, `.ai/**`, or any other `scripts/**` path, and `milestones/m1/commands/status.md` is byte-identical. | NFR-1 |
| AC-NFR2-1 | **Given** the `backlog.md` diff, **when** the preservation set is checked, **then** every heading except the two new entries is byte-identical, every story other than M2-S11, M2-S18, M2-S19, and M2-S4 is byte-identical, the M2-S4 diff is confined to its dependency line, the frontmatter, reading guide, cross-cutting principles, retirement note, closing separator, and `## Epic M3` heading are byte-identical, and no story code has been renamed, reordered, or removed. | NFR-2, F-4 |
| AC-NFR3-1 | **Given** the touched pack pages, **when** their status and claims are read, **then** `commands/repos.md` and `commands/projects.md` both carry `Status: Proposed (M2)`; zero occurrences attribute `repos`, project groups, workspace discovery, or cross-repository changes to a delivered surface; the registry marks `repos` not-delivered; the nine delivered facts are present and unaltered; the pack README's planned-until-exit statement survives verbatim; and no page is relabelled as a snapshot. | NFR-3, F-7, F-12, F-13 |
| AC-NFR4-1 | **Given** the branch head, **when** `scripts/checks/forbidden-literals.registry.json` is read and the guard runs, **then** `registered` holds exactly one more entry than at base `723454e4` (141 → 142), that entry is `doc/planning/oss-tooling/milestones/m2/commands/repos.md`, it sits inside the `m2/commands/` group with the surrounding order preserved, there are no duplicates, every other entry is byte-identical, and the guard reports zero unregistered-doc findings and zero violations. | NFR-4, DEC-15 |
| AC-NFR5-1 | **Given** the branch head, **when** `bash scripts/.tests/test-doc-distribution.sh` runs with the default `TMPDIR`, **then** it exits 0 and no planning document carries an `ados_distribution` marker. | NFR-5, DEC-16 |
| AC-NFR6-1 | **Given** the branch head, **when** the aggregate gate runs once with the default `TMPDIR` and once with a repository-filesystem `TMPDIR`, **then** (a) the repository-local full-suite run exits 0 and is authoritative, so any failure in it — including a repeated `TC-WIRE-002` timeout — is a delivery failure; (b) both invocations and results are recorded; (c) a default-run `ci-baseline-parity` failure and a default-run `TC-WIRE-002` timeout are each recorded and re-run and are excused only because the repository-local run is green on the same head; and (d) any other default-run failure is a delivery failure. | NFR-6, DEC-16, RSK-17 |
| AC-NFR7-1 | **Given** each touched file containing mermaid, **when** the structural read runs (fence count, fence tag, first body line keyword, heading association), **then** fence counts are even, every diagram fence is tagged `mermaid`, every first body line begins with an allowed keyword, `## C4 Level 1`, `## C4 Level 2`, and `## C4 Level 3` each appear exactly once, `## Key flows` holds exactly 8 `###` headings with one mermaid block each, and no validator, script, or gate is added. | NFR-7, RSK-18 |
| AC-NFR8-1 | **Given** the amended and new backlog entries, **when** each is diffed clause by clause against Appendix A, **then** 26 of 26 ticket clauses are present with unchanged meaning, 32 of 32 board-derived clauses are covered, the missing, added-to-ticket, and changed-meaning counts are each zero for ticket clauses, and the only differences are whitespace, line wrapping, and typographic normalisation. | NFR-8, F-1, F-2, F-3 |
| AC-NFR9-1 | **Given** the branch head, **when** the forbidden-literals guard runs, **then** (a) of the 14 planning documents this change touches, exactly 12 are literal-scanned (`milestones/README.md`, `milestones/m2/README.md`, `milestones/m2/architecture.md`, `milestones/m2/contracts.md`, `milestones/m2/commands/projects.md`, the new `milestones/m2/commands/repos.md`, `milestones/m2/commands/queue.md`, `milestones/m2/commands/board.md`, `milestones/m2/test-scenarios.md`, `milestones/m2/journeys.md`, `milestones/m2/entrypoint-delta.md`, `status.md`) and 2 are exempt (`backlog.md` and `cli-command-registry.md`, unregistered and present at `corpusBaseline`); (b) the guard reports zero violations and zero unregistered-doc findings, so none of the 12 scanned documents contains `ados`, `ADOS_`, or `~/.ados` and every command name carries the `<binary>` prefix; and (c) no private fleet, repository, host, hosted, or proprietary product name appears in new or changed text. | NFR-9, RSK-1 |
| AC-NFR10-1 | **Given** the touched documents, **when** their relative links and content are inspected, **then** zero relative links are broken and zero pack documents restate a story's acceptance block instead of referencing its code. | NFR-10 |
| AC-NFR11-1 | **Given** `status.md`, **when** the retention oracle runs over the whole file, **then** zero base lines are removed, reordered, or modified and every added line lies inside the new dated section. | NFR-11, F-12 |
| AC-NFR12-1 | **Given** the fourteen planning documents, **when** the naming-boundary and disambiguation scan runs, **then** the count of group-meaning `repos` occurrences is 0; the count of flat-meaning `projects` occurrences is 0 outside the time-scoped disambiguation and delivered-fact statements; the alias token appears only where the alias is defined or pointed at; each named page carries the disambiguation; and 100% of Appendix B rows hold their required meaning. | NFR-12, F-14, RSK-1 |
| AC-NFR13-1 | **Given** the same corpus, **when** the terminology lock runs, **then** the count of statements affirming that the group contract is `projects.v1` is 0; the count affirming a group identity is `projectKey` is 0; the count describing one spelling returning both shapes at one time is 0; the state layer's scope is never called a project scope; and the four mapping-clause tokens are described as repository checkouts wherever they are mentioned. | NFR-13, F-14, RSK-3, RSK-5 |

### 17.3 Definition of Done

- [ ] `backlog.md` carries M2-S11 with its delivered record, its state scoping, its collision criterion, and its shipped-surface acceptance criterion; M2-S18 as the single owner of the rename, the `--flat` alias, the field renames, the migration guide, configuration-only membership, the scoped grammar, and the decision record; M2-S19 with its ordering acceptance; M2-S4 depending on M2-S18; and one context paragraph, with the separator and `## Epic M3` intact (AC-F1-1, AC-F1-2, AC-F1-3, AC-F2-1, AC-F2-2, AC-F2-3, AC-F2-4, AC-F2-5, AC-F2-6, AC-F3-1, AC-F3-2, AC-F3-3, AC-F4-1, AC-F4-2, AC-F4-3, AC-F4-4, AC-NFR2-1).
- [ ] `milestones/m2/architecture.md` states the three-level model with workspace optionality visible, distinguishes the discovery workspace root from the state layer's `default` identifier, keeps the group-scoped overview flow, names one queue entry per member with the release rule in the cross-repository flow and the invariants, and holds its diagram structure (AC-F5-1, AC-F5-2, AC-F5-3, AC-F5-4, AC-NFR7-1).
- [ ] `milestones/m2/contracts.md` defines `repos.v1`, the retained delivered `projects.v1`, `project-groups.v1`, the single rename rule, the mapping clause, the configuration document, the aggregation clause, the queue/lane representation, and the change plan shape with its closeout and definition-of-done envelopes (AC-F6-1, AC-F6-2, AC-F6-3, AC-F6-4, AC-F6-5, AC-F6-6, AC-F6-7, AC-F6-8, AC-F6-9, AC-F3-4).
- [ ] `milestones/m2/commands/repos.md` exists with the delivered semantics, the `unbound` scope, the delivered error identities, the host-root STATE example with a pattern-valid key, `--help`/`--version` with no-state-read semantics, and the mapping clause; `commands/projects.md` is the group page with `project-groups.v1`, `groupKey`, member `daemonReachable`, aggregation and partial failure, the scoped grammar, and no orphan field; `commands/queue.md` and `commands/board.md` carry the scope grammar and the repository-key boundary with the board's `repositories[]` field; both command pages keep `Status: Proposed (M2)` (AC-F7-1, AC-F7-2, AC-F7-3, AC-F7-4, AC-F7-5, AC-F7-6, AC-F7-7, AC-F7-8, AC-F7-9, AC-NFR3-1).
- [ ] `test-scenarios.md` opens with S2 through S19, carries at least five S18 and five S19 seeds with one `Assert:` line each, asserts only declared envelopes, includes the undeclared-clone, CI-corroboration, dependency-ordering, and alias-shape seeds, and reconciles the two S11 seeds with `SC-M2-S11-02` prospective; `journeys.md`'s opening journey is group-scoped and disambiguated (AC-F8-1, AC-F8-2, AC-F8-3, AC-F8-4, AC-F8-5, AC-F8-6, AC-F9-1).
- [ ] `entrypoint-delta.md` records the split, keeps the GH-288 mount note, and phrases the reference-page move as pending S18 code work (AC-F10-1).
- [ ] `milestones/m2/README.md` lists the new page, maps S11 to the delivered payload, S18 to the group contract plus the configuration document plus the status delta plus the decision record, S19 to the change plan shape, drops the S4 advisory note, and reads S2 through S19; `milestones/README.md`'s M2 row links thirteen targets (AC-F11-1, AC-F11-2).
- [ ] `status.md` carries one new dated correction section under the retention oracle; `cli-command-registry.md` splits the two rows, keeps one Delivery row per name, states the ODR-0003 lock, adds `projects` to COMMAND FAMILIES, and keeps every other row byte-identical (AC-F12-1, AC-F12-2, AC-F13-1, AC-F13-2, AC-NFR11-1).
- [ ] The naming surface holds across every Appendix B location: zero group-meaning `repos` statements, zero flat-meaning `projects` statements outside the disambiguation and delivered facts, one normative rename rule, zero affirmations of the old identities, and the nine delivered facts present (AC-F14-1, AC-F14-2, AC-F14-3, AC-NFR12-1, AC-NFR13-1).
- [ ] Exactly 15 product files change, the single registry row is in position, the distribution guard exits 0 under the default `TMPDIR`, the forbidden-literals guard is green over exactly the twelve scanned planning documents with zero violations, and the authoritative repository-local-`TMPDIR` full `pnpm check` exits 0 with both aggregate runs recorded (AC-NFR1-1, AC-NFR4-1, AC-NFR5-1, AC-NFR6-1, AC-NFR8-1, AC-NFR9-1, AC-NFR10-1).
- [ ] This change delivered no M2 story, changed no product behaviour, command composition, entrypoint registration, delivered surface, current truth, or tracker ticket, and phase 7 recorded that the delivered surface requires no current-truth reconciliation (NG-1, NG-2, NG-5, NG-7, DEC-17).

## 18. ROLLOUT & CHANGE MANAGEMENT (HIGH-LEVEL)

One docs-only pull request against `main-tools` from base `723454e4`, correcting
the corpus on the existing branch. Recommended commit sequence: (1) contracts —
the identity split, the rename rule, the mapping clause, the configuration
document, aggregation, the queue representation, and the change plan shape;
(2) the backlog — M2-S11 delivered story restored, M2-S18 as the rename owner,
M2-S19 ordering, the M2-S4 edge, and the context paragraph; (3) the command
pages — `repos`, `projects`, `queue`, `board`; (4) architecture, scenarios,
journeys, and the entrypoint delta note; (5) the indices, the status correction,
the registry rows, and the registry registration. No feature flag, no migration,
no coordination window: the only adoption step is that M2-S18 and M2-S19 tickets
are created from the corrected entries, and M2-S18 authors its decision record
before its code change.

## 19. DATA MIGRATION / SEEDING (IF APPLICABLE)

N/A. No stored data, schema, index, or seed set changes. The only migration is
editorial: pages that meant the flat record set say `repos` for the planned
surface and keep `projects` for the delivered one. The delivered state layer, the
identity marker, the projects container, the host index, and the `unbound` scope
are untouched — which is why the mapping clause fixes them as repository
vocabulary and why no rename of them is planned. No deprecation alias is active,
because the rename this change documents has not shipped.

## 20. PRIVACY / COMPLIANCE REVIEW

None. The change touches public planning documents and adds no personal data,
telemetry, tracking, or credential path. The planning text names tracker kinds
generically, never a specific credentialed integration, and introduces no private
host, repository, or product name.

## 21. SECURITY REVIEW HIGHLIGHTS

No security impact. The change adds no runtime surface, permission, credential
flow, or executable content. The only security-adjacent statement is that tracker
kinds are configuration data and that mixed kinds are validated rather than
rejected, which introduces no new trust boundary. Published text must not include
secrets, hostnames, or internal URLs, which NFR-9 covers.

## 22. MAINTENANCE & OPERATIONS IMPACT

- The contract identity split and the single rename rule are the corpus's
  maintenance invariant: the group contract is `project-groups.v1`, the delivered
  flat contract is `projects.v1`, the planned flat contract is `repos.v1`, and any
  page that mentions them references the rule rather than restating it.
- The mapping clause is permanent: a future rename of the identity marker, the
  projects container, the host-index fields, or `--project-root` is a code change
  with a state-layout consequence, never a documentation edit.
- The pack remains planned-until-M2-exit; the command pages are proposals until
  their stories deliver, and the status section records this correction as plan
  state.
- M2-S18 owns the transition end to end: the decision record, the rename, the
  alias, the field renames, and the migration-guide update. M2-S19 owns the
  cross-repository lifecycle. Each delivery updates its backlog entry, pack rows,
  and the status snapshot at meaningful boundaries.
- The registry stays locked: the `repos` row moves to Delivery only after S18's
  superseding decision record and code change; until then it stays marked
  not-delivered, per ODR-0003.
- Current truth remains the record of delivered behaviour: the projects feature
  spec, the entrypoint spec, and the migration guide change when S18 ships, not
  when the plan says so.

## 23. GLOSSARY

| Term | Definition |
|------|------------|
| Repository | One git checkout; the delivery unit and the leaf of the model. Identified by its checkout identity (the git common dir marker) and, from M2-S18, by `repoKey` on the flat surface. |
| Project group | A named group of repositories that belong together, with membership declared in configuration. Identified by `groupKey`. |
| Workspace (discovery) | An optional persisted directory usable as a discovery root for a group's declared members; never mandatory, and distinct from the state layer's fixed `workspace` identifier `default`. |
| Member repository | A repository declared in a group's configuration. |
| Flat record set | The host-level list of managed checkouts with repository key, root, state location, daemon reachability, and handover state. Delivered as `projects list` (`projects.v1`); planned as `repos list` (`repos.v1`) from M2-S18. |
| Group surface | The project-level view listing groups with their members, health, and state, and accepting the scoped read argument. Produced by `projects list` from M2-S18 as `project-groups.v1`. |
| Rename rule | The one normative statement: from M2-S18, `projects list` enumerates groups and `repos list` enumerates the flat record set; the alias is `projects list --flat`, returning the delivered `projects.v1` payload, owned by M2-S18 and retired at the M3 boundary. Under the same rule: `projectKey → repoKey`, `data.projects[] → data.repos[]`, and `board.data.projects[] → board.data.repositories[]`. |
| Deprecation alias | The token `projects list --flat` that returns the delivered `projects.v1` payload during the transition. It is a different token from `projects list`, which enumerates groups from M2-S18. |
| Delivered flat payload | `projects.v1`: `data.projects[]` with `projectKey`, plus `hostIndexRevision`. Keeps this meaning permanently. |
| Group identity | `groupKey`: the field naming a group in `project-groups.v1` and in the configuration document. Never `projectKey`. |
| Repository vocabulary | The tokens that denote a repository checkout and keep that meaning permanently unless a code change renames them: `project-identity.json`, `<host root>/projects/<key>`, the host index's `projects[]`/`projectKey`, and `--project-root`. |
| Project configuration document | `<configDirectoryName>/projects.yaml`, schema `delivery.projects.groups.v1`, declaring groups with `groupKey`, optional `workspaceRoot`, and `members[]` (repository selector plus `trackerKind`). |
| Project-scoped read | A read narrowed to one group's members, expressed as `queue list --project <groupKey>` or `status --project <groupKey>`. Not the state layer's scope. |
| Per-checkout state scope | The state layer's scope: a host root plus one root per checkout, with the `unbound` scope outside any work tree. Never a project scope. |
| Classified partial result | A project-scoped read outcome in which one or more members are classified (`not-yet-supported`, `state-unavailable`, `unregistered`) while the readable members are returned at exit 0 with `partial` true and the degraded members named. |
| One queue entry per member | The representation of a cross-repository change: one queue entry per member keyed by that member's ref, with per-member dependency edges and a release rule that drops each member's lease while entries stay. |
| One review flow | One review run over the declared member pull-request set, with one verdict per member and each member reviewed once. |
| Cross-repository change | One change spanning member repositories of one group: one lifecycle, one spec and plan, one definition of done, a branch and pull request per member, one queue entry per member. |
| Slice | The part of a cross-repository change that belongs to one member repository. |
| Disambiguation (time-scoped) | The short sentence each page using the group meaning carries, dating the spellings and pointing at the rename rule instead of restating it. |
| Planned-until-exit | Pack convention: everything in a milestone pack is a proposal until the milestone exits, after which the pack is a snapshot. |
| Docs-only change | A change whose product files are documentation plus a data-only guard registry registration, with no behaviour, test, or tooling change. |

## 24. APPENDICES

### Appendix A — Clause oracle

#### A.1 Ticket clauses (26)

Preserved in substance; the oracle for AC-F2-1, AC-F3-1, and AC-NFR8-1.

| Clause | Source | Required substance | Spec requirement |
|---|---|---|---|
| S18-G | S18 Goal | A project is a configured group of repositories; the tooling can enumerate groups with their members and scope delivery views per project, with the workspace directory usable as an optional discovery root. | F-2 |
| S18-T1 | S18 Tasks | Project configuration declaring member repositories (any tracker adapter; mixed trackers remain valid configuration even if only GitHub is exercised initially). | F-2, F-6 |
| S18-T2 | S18 Tasks | Optional workspace-directory discovery root: register a directory, scan for managed clones inside; never required. | F-2, F-6 |
| S18-T3 | S18 Tasks | `projects list` renders groups with member repositories, health, and state (from M2-S18, that spelling is the group surface). | F-2, F-7 |
| S18-T4 | S18 Tasks | Project scoping for queue and status reads. | F-2, F-7 |
| S18-T5 | S18 Tasks | Naming boundary documented: `repos` = flat record set, `projects` = groups. | F-2, F-14 |
| S18-A1 | S18 AC | A project with two member repositories in one workspace directory is discoverable by registering that directory. | F-6, F-8 |
| S18-A2 | S18 AC | The same project configured with repositories in unrelated directories behaves identically. | F-5, F-6, F-8 |
| S18-A3 | S18 AC | `projects list` shows the group with both members and their state. | F-6, F-7 |
| S18-A4 | S18 AC | Queue and status accept a project scope. | F-6, F-7 |
| S18-A5 | S18 AC | A configuration mixing tracker kinds is accepted at validation time with the unimplemented member classified `not-yet-supported` rather than rejected silently. | F-2, F-6, DEC-12 |
| S18-D | S18 Depends | M2-S11. | F-2 |
| S19-G | S19 Goal | One change may span multiple repositories of one project: one lifecycle, one spec and plan, one definition of done, a branch and pull request per member. | F-3 |
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
| S11-2 | M2-S11 amendment | The delivered enumeration acceptance criterion keeps describing the shipped `projects list` surface. | F-1, DEC-11 |
| S11-3 | M2-S11 amendment | The entry records the rename transition: M2-S18 renames the flat surface to `repos list` with the `--flat` alias. | F-1, DEC-7, DEC-21 |

#### A.2 Board-derived clauses (32)

Covered by this revision; the oracle for AC-NFR8-1 and the DoD. "Board" means
the six-critic review board on PR #306 (blocking findings 1-6, should-fix 7-16,
cheap notes 17-18, decisions A-D), plus the re-verification follow-up N08, which
extends BRD-4 and adds no clause of its own.

| Clause | Source | Required substance | Spec requirement |
|---|---|---|---|
| BRD-1 | Board 1 / DEC-19 | The group contract is `project-groups.v1` with `data.groups[]`. | AC-F6-2 |
| BRD-2 | Board 1 / DEC-19 | `projects.v1` keeps the delivered flat record set and is never the group contract. | AC-F6-3 |
| BRD-3 | Board 1 / DEC-20 | `repos list --json` returns `repos.v1` with `data.repos[]` and `repoKey`. | AC-F6-1 |
| BRD-4 | Board 3 / DEC-21, re-verification N08 | One rename rule carrying the three field renames (`projectKey → repoKey`, `data.projects[] → data.repos[]`, `board.data.projects[] → board.data.repositories[]`); no text describes one spelling returning two shapes. | AC-F6-4, AC-F7-8 |
| BRD-5 | Board 3 / DEC-21 | The alias is `projects list --flat`, returning the delivered payload, owned by M2-S18, retired at the M3 boundary. | AC-F2-3, AC-F6-4 |
| BRD-6 | Board 3 / DEC-21 | A shape-asserting alias seed exists. | AC-F8-5 |
| BRD-7 | Board 3 / DEC-21 | S18 carries the migration-guide update task. | AC-F2-4 |
| BRD-8 | Board 2 | The mapping clause covers the marker, the container, the host-index fields, and `--project-root` and is carried in contracts and both pages. | AC-F6-5 |
| BRD-9 | Board 4 | A non-work-tree root is the `unbound` scope, never a failure; exit code preserved. | AC-F7-2 |
| BRD-10 | Board 4 | The delivered `projects.*` error identities are retained; a `repos.*` prefix change is S18 code work. | AC-F7-3 |
| BRD-11 | Board 4 | The STATE example is `<host root>/projects/<key>` with a `PROJECT_KEY_PATTERN` key. | AC-F7-4 |
| BRD-12 | Board 7 | `repos.md` lists `--help` and `--version` with no-state-read semantics. | AC-F7-1 |
| BRD-13 | Board 7 | `repos.md` restores the scope and `unbound` section. | AC-F7-2 |
| BRD-14 | Board 8 | The orphaned `daemonReachable.reason` paragraph is removed or moved to where the field exists. | AC-F7-5 |
| BRD-15 | Board 8 | Member health is carried as `members[].daemonReachable` on the page and in the contract. | AC-F7-5, AC-F6-2 |
| BRD-16 | Board 9 | The read grammar is `queue list --project <groupKey>`, added to `queue.md` synopsis and options. | AC-F7-9, AC-F2-5 |
| BRD-17 | Board 9 / DEC-25 | The status scope surface is pinned and named in the M2 README row; the M1 status page stays frozen. | AC-F7-9, AC-F11-1 |
| BRD-18 | Board 10 / DEC-23 | Membership is configuration-only; a scan only locates declared members; an undeclared-clone seed exists. | AC-F6-6, AC-F8-1 |
| BRD-19 | Board 13 / DEC-24 | Aggregation is defined once with merge order, classified partial failure, and not-yet-supported handling. | AC-F6-7 |
| BRD-20 | Board 12 / DEC-27 | The queue/lane representation is one queue entry per member, with the release rule, in contracts and architecture. | AC-F6-8, AC-F5-3 |
| BRD-21 | Board 11 | A per-member CI corroboration seed exists. | AC-F8-2 |
| BRD-22 | Board 11 | A dependency-ordering acceptance criterion exists. | AC-F3-3 |
| BRD-23 | Board 11 / DEC-31 | `SC-M2-S19-02` no longer asserts a retired `change.data.*` family; assertions use contracted envelopes. | AC-F8-3 |
| BRD-24 | Board 11 / DEC-31 | `closeout.data.members[]` is declared in contracts (or the assert re-pointed). | AC-F3-4, AC-F6-9 |
| BRD-25 | Board 11 / DEC-32 | "One review flow" is defined executably. | AC-F3-2 |
| BRD-26 | Board 14 / DEC-29 | The registry row splits; one Delivery row per name; the `repos` row is not-delivered pending the decision record and code change per ODR-0003. | AC-F13-1 |
| BRD-27 | Board 14 / DEC-29 | S18 carries the task to author the superseding decision record. | AC-F2-6 |
| BRD-28 | Board 14 | `projects` is added to COMMAND FAMILIES. | AC-F13-2 |
| BRD-29 | Board 15 / DEC-28 | M2-S4 depends on M2-S18 and the README advisory note is updated. | AC-F4-4, AC-F11-1 |
| BRD-30 | Board 16 | The scenario introduction reads "M2-S2 through M2-S19". | AC-F8-6 |
| BRD-31 | Board 17 | The architecture distinguishes the discovery workspace root from the `default` workspace identifier. | AC-F5-4 |
| BRD-32 | Board 18 | The reference-page move is phrased as pending S18 code work. | AC-F10-1 |

### Appendix B — Naming and identity matrix (consistency oracle)

Every row is a location the naming surface must hold in. "Flat" means the
location uses `repos`/`repos list` for the flat record set; "Group" means it uses
`projects`/`projects list` for a configured group from M2-S18; "Delivered"
means it records the shipped `projects list`/`projects.v1` behaviour. Three
classes may name the delivered flat surface without breaking the boundary: the
time-scoped per-page disambiguation, the delivered-fact statements, and the alias
definition.

| Location | What it must say | What it must not say |
|---|---|---|
| `backlog.md` M2-S11 | Delivered: shipped `projects list` enumeration AC, GH-288 record, state scoping, collision criterion; one sentence naming M2-S18 as the rename owner | A `repos list` acceptance criterion; a field-rename clause; any loss of the delivered record |
| `backlog.md` M2-S18 / M2-S19 | Group plus rename: the rename, the `--flat` alias, the field renames, the migration guide, config-only membership, the scoped grammar, the decision record; S19 ordering and CI corroboration | `repos` as a group; the `repos` rename inside M2-S11; an alias without a payload shape |
| `backlog.md` M2-S4 | Repository keys only: the board consumes the host index and depends on M2-S18 | A group-scoped board claim |
| `backlog.md` Epic M2 context paragraph | Both, by reference to the rename rule, plus configuration-only membership | A restatement of the alias mechanics |
| `m2/contracts.md` `repos.v1` | Flat: `data.repos[]`, `repoKey`, delivered record fields, the carried mapping clause | Group fields; `data.projects[]`; a delivered claim |
| `m2/contracts.md` `projects.v1` | Delivered: flat record set, `data.projects[]`, `projectKey`, `hostIndexRevision`; named as the alias payload | Any group field or group claim |
| `m2/contracts.md` `project-groups.v1` + configuration + aggregation + queue | Group: `data.groups[]`, `groupKey`, members with `daemonReachable`, config-only membership, classified partial failure, one queue entry per member, the release rule | `projectKey` as a group identity; a scan that admits clones; a whole-read failure for one member |
| `m2/architecture.md` | Both, by reference; configuration-only membership; one queue entry per member; the discovery-root versus `default` distinction | `projects list` reading the host index; the two workspace meanings collapsed |
| `m2/commands/repos.md` | Flat: delivered semantics, `unbound` at exit 0, `projects.*` identities, host-root STATE example, `--help`/`--version`, mapping clause | A `repos.*` identity as current truth; a non-work-tree failure; a group surface |
| `m2/commands/projects.md` | Group: `project-groups.v1`, `data.groups[]`, `groupKey`, member `daemonReachable`, aggregation, scoped grammar, `--flat` pointer, time-scoped disambiguation | The orphan reason paragraph; a group-scoped board claim; a restatement of the alias mechanics |
| `m2/commands/queue.md` | Scope grammar: `queue list --project <groupKey>` in synopsis and options | A group-scoped mutation |
| `m2/commands/board.md` | Repository keys: `--project` is a repository key, `repositories[]` (renamed from `projects[]`), repository-vocabulary refusal, M2-S11 attribution | Any group scope; the delivered-style `projects[]` field name; "the project model M2-S11 introduces" |
| `m2/test-scenarios.md` | S2-S19 intro; delivered/group/flat roles by seed; declared envelopes only; alias shape seed | `change.data.*`; a delivered surface asserted as `repos list` today |
| `m2/journeys.md` opening journey | Both, each name in its role, with the time-scoped disambiguation | A flat view without the disambiguation |
| `m2/entrypoint-delta.md` | Both families with M2-S18 ownership; retained GH-288 mount note; reference-page move pending S18 | The move as an effect of this change |
| `m2/README.md` contents and map rows | `repos.md` as the M2-S18 flat record set; S11 on delivered `projects.v1`; S18 on `project-groups.v1` + configuration + status delta + decision record; S19 on the plan shape; S4 without the advisory note; scenarios S2-S19 | Map rows conflating the two contracts; a group contract named `projects.v1` |
| `milestones/README.md` M2 row | Both pages linked (13 targets) | — |
| `cli-command-registry.md` rows and boundary note | One `projects` row (Delivery M2-S11 shipped) and one `repos` row (Delivery `-`, Extended M2-S18 and M3-S6, not-delivered pending ODR-0003); `projects` in COMMAND FAMILIES; the rename rule referenced | Two Delivery rows; a shipped `repos`; a group meaning for `repos` |
| `status.md` 2026-11-11 delivery snapshot | Delivered GH-288 facts, preserved byte-identical | Any reworded or removed delivery fact |
| `status.md` new correction section | The split, the rename rule, the ownership, configuration-only membership, the scoped grammar, the board boundary, the registry split, the S4 edge | Any contrary meaning; a delivery claim |
| `doc/spec/features/feature-projects.md`, `doc/spec/features/feature-cli-entrypoint.md`, `doc/guides/migrating-to-per-repository-state.md`, `doc/decisions/TDR-0022-multi-repository-workstation-state-scope.md` | Delivered truth for the shipped `projects list`; untouched by this change | Any edit here; a claim that current truth already says `repos list` |

### Appendix C — File manifest and change type

Verified against change base `723454e4`; 15 product files — 14 under
`doc/planning/oss-tooling/**` (13 modified plus 1 new) and the one registry row.

| # | Path | Change |
|---|---|---|
| 1 | `doc/planning/oss-tooling/backlog.md` | Restore M2-S11's delivered story; make M2-S18 the rename owner with its derived tasks and alias AC; add S19 ordering; declare the S4 edge; one context paragraph |
| 2 | `doc/planning/oss-tooling/milestones/m2/architecture.md` | Three-level context; discovery-root versus `default` sentence; group-scoped overview flow; cross-repository flow with the queue representation; boundary invariants |
| 3 | `doc/planning/oss-tooling/milestones/m2/contracts.md` | `repos.v1`; retained `projects.v1`; `project-groups.v1`; rename rule; mapping clause; configuration document; aggregation; queue/lane; change plan shape |
| 4 | `doc/planning/oss-tooling/milestones/m2/commands/repos.md` | **New** flat record-set page with delivered semantics, `unbound` scope, delivered error identities, host-root STATE example, help/version, mapping clause |
| 5 | `doc/planning/oss-tooling/milestones/m2/commands/projects.md` | Rewrite as the group page with `project-groups.v1`, `groupKey`, member `daemonReachable`, aggregation, scoped grammar |
| 6 | `doc/planning/oss-tooling/milestones/m2/commands/queue.md` | `queue list --project <groupKey>` in synopsis and options |
| 7 | `doc/planning/oss-tooling/milestones/m2/commands/board.md` | Repository-key boundary, repository-vocabulary envelope and refusal identity, corrected attribution |
| 8 | `doc/planning/oss-tooling/milestones/m2/test-scenarios.md` | S2-S19 intro; S18/S19 seed sets; declared-envelope assertions; alias seed; S11 seeds reconciled |
| 9 | `doc/planning/oss-tooling/milestones/m2/journeys.md` | Opening journey reconciled; time-scoped disambiguation |
| 10 | `doc/planning/oss-tooling/milestones/m2/entrypoint-delta.md` | Split, retained mount note, reference-page move as pending S18 code work |
| 11 | `doc/planning/oss-tooling/milestones/m2/README.md` | Contents rows; corrected map rows (S11, S18 with the status delta and decision record, S19, S4, scenarios) |
| 12 | `doc/planning/oss-tooling/milestones/README.md` | M2 index row gains `m2/commands/repos.md` |
| 13 | `doc/planning/oss-tooling/status.md` | One new dated correction section |
| 14 | `doc/planning/oss-tooling/cli-command-registry.md` | Split rows; one Delivery row per name; ODR-0003 lock; `projects` in COMMAND FAMILIES; boundary note |
| 15 | `scripts/checks/forbidden-literals.registry.json` | One registration for the new pack page |

### Appendix D — Gate and evidence record

| Evidence | How it is produced | Expected result |
|---|---|---|
| Distribution-marker guard | `bash scripts/.tests/test-doc-distribution.sh` with the default `TMPDIR` | exit 0; 0 markers added |
| Aggregate gate (authoritative) | repository-local `TMPDIR` full `pnpm check` | exit 0; any failure is a delivery failure |
| Aggregate gate (recorded) | `pnpm check` with the default `TMPDIR` | recorded; the two named default-only failures recorded, re-run, and excused only behind a green authoritative run on the same head |
| Forbidden-literals | the guard's own entry point | 142 registered entries (141 at base), 0 unregistered-doc findings, 0 violations, exactly 12 of 14 planning documents scanned, 2 exempt |
| Delivered-fact preservation | diff of the M2-S11 entry, the `projects.v1` section, the `repos` page, the delta note, the registry rows, and the 2026-11-11 snapshot against base `723454e4` | 9 of 9 delivered facts present; 0 reworded as plan |
| Contract identity split | corpus search for the group contract and the group identity | 0 affirmations that the group contract is `projects.v1`; 0 affirmations that a group identity is `projectKey`; the rename rule appears exactly once |
| Shape disambiguation | corpus search for `--flat` and for two-shape sentences | the alias token appears only where the alias is defined or pointed at; 0 sentences describing one spelling returning both shapes at one time |
| Clause fidelity | Appendix A.1 and A.2 diffed against the head backlog and corpus | 26 of 26 ticket clauses, 32 of 32 board clauses |
| Naming boundary | corpus search over the 14 planning documents plus the Appendix B walk | 0 group-meaning `repos`; 0 flat-meaning `projects` outside the disambiguation and delivered facts; the disambiguation on the six named pages |
| Terminology and vocabulary | corpus search for the four repository-vocabulary tokens and for "project scope" in state-layer prose | each token described as a repository checkout; 0 state-layer uses of "project scope" |
| Document structure | structural read of fence counts, tags, keyword lines, heading association | 0 failures, no new tooling |
| File containment | diff filtered to product files | exactly 15 files, none outside the manifest |
| Status retention | whole-file line comparison of `status.md` | 0 base lines changed; additions only in the new section |
| AC and procedure counts | id extraction from §17 plus the test-plan mapping | 56 functional + 13 NFR = 69 ACs, each with at least one oracle |

## 25. DOCUMENT HISTORY

| Version | Date | Author | Changes |
|---------|------|--------|---------|
| 1.4 | 2026-11-11 | @spec-writer | Review-board remediation. The six-critic external review board on PR #306 — CTO, API Integration Engineer, Domain Expert, QA Engineer, SRE, and Technical Writer — returned six blocking findings, ten should-fix findings, and two cheap notes against the delivered corpus, and its re-verification returned one further should-fix (N08). (1) Contracts are re-keyed: the group contract is `project-groups.v1` with `data.groups[]` and `groupKey` (DEC-19, DEC-22), the delivered flat contract keeps `projects.v1` with `data.projects[]` and `projectKey` (DEC-19), and the flat surface becomes `repos list`/`repos.v1`/`data.repos[]`/`repoKey` (DEC-20). (2) One rename rule is stated once, with `projects list --flat` as the different alias token returning the delivered payload, owned by M2-S18 and retired at the M3 boundary, carrying an S18 acceptance criterion, a shape-asserting seed, and the migration-guide task (DEC-21; AC-F2-3, AC-F2-4, AC-F6-4, AC-F8-5). (3) The repository-vocabulary mapping clause fixes the identity marker, the projects container, the host-index fields, and `--project-root` as repository checkouts (BRD-8; AC-F6-5). (4) `commands/repos.md` regains the delivered semantics: `unbound` at exit 0, the `projects.*` error identities, the host-root STATE example with a pattern-valid key, `--help`/`--version` with no-state-read semantics, and the scope section. (5) The board stays on the repository-key boundary and its M2-S11 attribution is corrected. (6) M2-S11 keeps the delivered story and its shipped-surface acceptance criterion; M2-S18 becomes the single owner of the rename, alias, field renames, migration guide, configuration-only membership, scoped grammar, and decision record; `SC-M2-S11-02` becomes prospective. (7) Membership is configuration-only at a declared path and format, with an undeclared-clone seed; aggregation is defined once with classified partial failure and not-yet-supported handling; the queue/lane representation is one entry per member with the release rule. (8) M2-S19 gains per-member CI corroboration, dependency ordering, `closeout.data.members[]`, a `verify gates` definition-of-done verdict, contracted-envelope assertions, and an executable "one review flow". (9) The registry row splits with one Delivery row per name under the ODR-0003 lock, `projects` joins COMMAND FAMILIES, M2-S4 depends on M2-S18, the scenario intro reads M2-S2 through M2-S19, and the two cheap notes land. (10) Sections, goals, NFRs, risks, data model, appendices, and the DoD are realigned; the AC set is renumbered to 69 (56 functional + 13 NFR); 14 new decisions (DEC-19..DEC-32) and a 32-clause board oracle (Appendix A.2) are added; the file manifest grows to 15 with `commands/queue.md` and `commands/board.md`. (11) Board re-verification follow-up N08: the single rename rule now names three field renames — `projectKey → repoKey`, `data.projects[] → data.repos[]`, and the board's repository list field `board.data.projects[] → board.data.repositories[]` — under the one rule in `contracts.md` (DEC-21, DM-7, BRD-4, AC-F6-4), with `commands/board.md` corrected to `repositories[]` (AC-F7-8, Appendix B). No second statement of the rule is added, the alias token `projects list --flat` is unchanged, and the AC count stays 69 (56 functional + 13 NFR). |
| 1.3 | 2026-11-11 | @spec-writer | Rebase correction after the branch was rebased onto `origin/main-tools` `723454e4`, which brought GH-288 / PR #305 into the base and changed the facts this specification was written on. (1) Base reference updated to `723454e4` in the frontmatter, §13, §17.3, §18, Appendix C, and Appendix D. (2) The "no delivered spec covers these surfaces" claims were replaced with the true state: the projects feature spec, the entrypoint spec, the migration guide, and TDR-0022 describe the shipped flat `projects list`; current truth keeps describing today's shipped behaviour until the rename ships. (3) §2.1 records the GH-288 base state: the M2-S11 delivery record, the delivered contract facts, the entrypoint mount, the registry shipment, and the 2026-11-11 delivery snapshot. (4) The per-page disambiguation sentence was added without changing the AC count, with GH-288 delivered facts preserved. (5) Counts verified against the rebased tree: 141 registry entries at base, 142 after the new page. |
| 1.2 | 2026-11-11 | @spec-writer | Remediated DoR iteration 2 plus one recorded delivery constraint: the M2-S4 advisory note is stated as an owned edit, and the forbidden-literals constraint became explicit (the guard scans only registered documents absent at `corpusBaseline`: nine registered planning documents plus the new page, with `backlog.md` and `cli-command-registry.md` exempt). AC set unchanged at 45. |
| 1.1 | 2026-11-11 | @spec-writer | Remediated DoR iteration 1: the repository-local-`TMPDIR` full-suite run became the authoritative gate with both runs recorded and the two default-only failures named; the advisory note became an owned edit; the containment accounting was corrected to 13 product files. AC set unchanged at 45. |
| 1.0 | 2026-11-11 | @spec-writer | Initial specification |

---

## AUTHORING GUIDELINES

- The GH-303 ticket body is the normative source for the M2-S11 amendment, the
  M2-S18 and M2-S19 ticket clauses, the blueprint targets, and the ticket
  acceptance list. The six-critic review board on PR #306 is the normative source
  for the 32 derived clauses in Appendix A.2, including decisions A-D, which are
  encoded as DEC-19 through DEC-22 and were not re-deliberated.
- Repository facts were read from the working tree at the change base
  `723454e4` and from the delivered corpus on the branch: the M2-S11 entry and
  its GH-288 record, the pack's contract sections and delivered contract facts,
  the two command pages, the queue and board pages, the seeds, the two index
  tables, the registry rows, the 2026-11-11 status snapshot, the delivered error
  identities and `unbound` semantics in the shipped contracts and the projects
  feature spec, and `PROJECT_KEY_PATTERN`.
- The review was treated as a correctness gate on the delivered corpus, not as a
  style preference: each blocking/should-fix finding and each cheap note has a
  derived clause in Appendix A.2 and at least one acceptance criterion, and no
  finding was answered by prose alone.
- Decisions A-D were encoded exactly as made: the group contract is
  `project-groups.v1` with `groupKey`; the flat surface is `repos list` /
  `repos.v1` / `repoKey`; the rename rule is stated once with
  `projects list --flat` as the alias; and `projects.v1` keeps its delivered
  flat meaning. The spec adds only the implementation-free details the findings
  required (the configuration document path and format, the aggregation
  vocabulary, the queue representation, the status scope surface, the board key
  vocabulary, and the registry lock statement), each recorded as a decision.
- Derived requirements are kept visibly separate from ticket text (Appendix A.1
  versus A.2, DEC-30), so a later reader can tell which clause came from the
  ticket and which from the board.
- The change is planned-not-delivered throughout: the rename, the alias, the
  field renames, configuration-only membership, the scoped grammar, and the
  cross-repository lifecycle are M2-S18 and M2-S19 work; the corpus says so on
  every page that could be misread.
- The template at `doc/templates/change-spec-template.md` governed structure;
  every section is present in order, and the Definition of Done lives under
  Section 17 so the mandated ordering is preserved.
- No implementation detail, code path, or step-by-step task appears; planned
  contracts are described as required shapes and behaviours, and the change's
  product files are named only to bound the edit.

## VALIDATION CHECKLIST

- [x] `change.ref` matches provided `workItemRef` (GH-303)
- [x] `owners` has at least one entry
- [x] `status` is "Proposed"
- [x] All sections present in order (1-25 + guidelines + checklist)
- [x] ID prefixes consistent and unique (F-, AC-, NFR-, RSK-, DEC-, DM-, BRD-)
- [x] Acceptance criteria reference at least one F-/NFR-/DM- ID and use Given/When/Then
- [x] NFRs include measurable values
- [x] Risks include Impact & Probability
- [x] No implementation details (no code-level file paths, no step-by-step tasks)
- [x] No content duplicated from linked docs
- [x] Front matter validates per front_matter_rules
