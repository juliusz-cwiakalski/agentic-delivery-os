---
id: chg-GH-309-test-plan
status: Proposed
created: 2026-11-14
last_updated: 2026-11-14
owners: [Juliusz Ćwiąkalski]
service: delivery-os
labels: [milestone-m2, cli, projects, multi-repository, naming-boundary]
version_impact: minor
summary: "Verification strategy for M2-S18 project groups: configuration-document load and classified validation, workspace discovery with configuration-only membership, the project-groups.v1 group surface, the shared aggregation clause, group-scoped queue/status reads, the repos/projects rename with the projects list --flat byte-compat alias, envelope conformance, read-only preservation, registration/docs, and the review-time gates (superseding decision record, scope conformance, quality battery)."
links:
  change_spec: ./chg-GH-309-spec.md
  implementation_plan: ./chg-GH-309-plan.yaml
  testing_strategy: .ai/rules/testing-strategy.md
---

# Test Plan - M2-S18: Project groups (M2)

## 1. Scope and Objectives

This change is a **TypeScript workspace CLI behavior change**: it makes a project mean a configured group of repositories — declared in a validated configuration document (`<configDirectoryName>/projects.yaml`, schema `delivery.projects.groups.v1`), enumerated as groups with member health and state under `project-groups.v1`, and usable as a delivery-read scope (`queue list --project`, `status --project`) — with an optional workspace discovery root, and delivers the naming boundary as code: `repos list` becomes the flat record set under `repos.v1` (field renames `projectKey → repoKey`, `data.projects[] → data.repos[]`, `repos.*` error identities), `projects list` becomes the group surface, and `projects list --flat` keeps the delivered flat payload reachable as the deprecation alias until the M3 boundary.

The core behaviors to protect are, in descending risk order: **membership containment** (a scan never admits an undeclared clone — configuration is the sole source of membership, an absolute invariant, NFR-4/C-4/RSK-4); **fail-closed configuration** (an unreadable or contradictory document is a classified error, never a silently empty group — a degraded read cannot masquerade as a healthy empty project, NFR-5); **alias byte-compatibility** (the `--flat` alias returns the delivered `projects.v1` payload *unchanged* — any field or shape drift fails review, C-2/RSK-1); **envelope continuity** (five-field `delivery.result.v1`, all new keys under `data`, zero `ok`/`command` fields — contracts win over pack snippets, C-1/DEC-5/RSK-5); and **read-only preservation** (exactly the two delivered permitted side effects, nothing else, NFR-2). The motivating regressions are: a rename that breaks the delivered flat consumers without a working alias; a workspace scan that grows a group beyond its declaration; a corrupt configuration silently rendering as an empty project; and a documentation-only rename that moves the registry row without the superseding decision record (ODR-0003 DC-4).

### 1.1 In Scope

- Configuration document load and validation (schema `delivery.projects.groups.v1` happy path; classified errors `projects.config-invalid`, `projects.scope-unavailable` exit 2, `projects.unknown-group` exit 1; zero silent-empty outcomes; absent/empty configuration as valid empty listing).
- Workspace discovery: registered `workspaceRoot` locates declared members; no-workspace parity 1:1; an undeclared clone inside the workspace is never admitted (scenario seeds SC-M2-S18-01/02/06).
- Group surface envelope: `project-groups.v1` shape (data.groups[] with `groupKey`, `name`, optional `workspaceRoot`, `members[]` with `repoKey`/`root`/`trackerKind`/`state`/`health`/`daemonReachable` closed reasons), membership in declared order, text-rendering determinism (seed SC-M2-S18-03).
- Mixed tracker kinds: accepted at validation, classified `not-yet-supported`, contribute no records, never fail the read (seed SC-M2-S18-05).
- Aggregation clause: closed per-member outcome vocabulary; one `state-unavailable` member → exit 0 with `data.partial` true and `data.degradedMembers[]`; readable members still returned (seed SC-M2-S18-07).
- Group-scoped reads: `queue list --project <groupKey>` and `status --project <groupKey>` return only the group's work; unknown group refused; the board is never group-scoped (seed SC-M2-S18-04).
- The rename: `repos list` under `repos.v1` (renamed fields, sorted text table, `unbound` rule, `repos.*` identities); alias `projects list --flat --json` byte-compat with the delivered payload; default `projects list --json` → `project-groups.v1` (seed SC-M2-S18-08); the OQ-2 `--flat --project` combination refusal as expected behavior pending plan pinning.
- Envelope conformance across every delivered envelope (five-field shape, keys under `data`, zero `ok`/`command`).
- Read-only preservation on group and flat reads (exactly the two permitted side effects).
- Registration and docs: `repos` at the root `--help` with its reference page; migration guide speaking the delivered vocabulary.
- Review-time/manual gates: the superseding decision record before rename code lands (register inspection + commit-order review); changed-scope conformance (no M2-S19 mechanics, no board change, no alias retirement, no new tracker adapter).
- Quality gate battery: `TMPDIR=$PWD/tmp/tmpdir pnpm check` green before the PR opens.

### 1.2 Out of Scope & Known Gaps

- **No cross-repository change mechanics and no queue-and-lane representation are tested into existence** (NG-1/NG-2/DEC-4, C-5): TC-GRPBOUND-003 asserts their absence at review time.
- **The board surface itself is not tested** — it is not delivered (M2-S4 mounts it, DEC-3). Only the *absence* of a group-scoped board claim and the repository-key meaning of `board --project` are asserted (TC-GRPSREAD-003). The board's `repositories[]` field name binds M2-S4's future delivery and is untestable here.
- **No alias retirement and no new tracker adapters** (NG-4/NG-5): `not-yet-supported` classification is tested as declared configuration behavior only; no second adapter implementation is exercised.
- **Current-truth feature-spec flips are phase 7 work** (DEC-1/NG-6, C-6): this plan tests delivered behavior; the delivery diff must not contain pre-flipped current-truth docs (review-time, TC-GRPBOUND-003).
- **MCP surface parity is unspecified by the spec** (§16 lists CLI families only, while a delivered projects MCP scope exists in repo truth — `tests/behaviour/projects-scope-mcp.test.ts`): raised as open question TP-Q1 (Section 8.3); no TC covers MCP because no AC claims it. If the plan pins MCP scope, this test plan reconciles.
- **DoD-17 (PR posture) and NFR-7 (commit hygiene) are lifecycle evidence, not test scenarios**: the commit-message range gate (`./scripts/lint-commit-range.sh --base <base>`) at phase 9 and the PR record at phase 11 own them (recorded in pm-notes). They are named here explicitly so the DoR gate does not read them as coverage gaps.
- **DoD-15 is the roll-up condition**, satisfied by the coverage matrix in Section 3 (all Covered) plus execution evidence in Section 10 and phase pm-notes; it has no TC of its own.
- Known constraint accepted per testing-strategy rules: permanent suites must never assert a branch diff, so "no forbidden area changed" (C-5/DoD-14) and "decision record precedes rename code" (C-3/DoD-11) are enforced as review-time checks (TC-GRPBOUND-003, TC-GRPDR-001), not permanent suites.

## 2. References

- Change specification: `./chg-GH-309-spec.md` — ACs AC-F1-1…AC-NFR6-1 (§17); DoD-1…DoD-17 (§17.1); F-1…F-10; DM-1…DM-5; NFR-1…NFR-7; NG-1…NG-8; RSK-1…RSK-7; DEC-1…DEC-7; OQ-1…OQ-3 with proposed resolutions (§14); constraint register C-1…C-7 (Appendix C); ticket AC mapping (Appendix B).
- Implementation plan: `./chg-GH-309-plan.yaml` — **pending** (phase 4 of the lifecycle). This plan constrains it: the plan must (a) pin OQ-1/OQ-2/OQ-3 (this plan asserts the proposed resolutions until then — Section 8.3); (b) pin the exact test-suite file names (Section 7 proposes homes); (c) declare the superseding decision record as an artifact-phase deliverable landing before any rename phase (C-3); (d) keep `projects list --flat` byte-compat verification in the rename phase's scope (C-2).
- Testing strategy: `.ai/rules/testing-strategy.md` (bun:test under `tests/**/*.test.ts`; aggregate `pnpm check`; invariant-test authoring — assert tree/state, never a moving-base diff; goldens updated deliberately).
- TypeScript rules: `.ai/rules/typescript.md` (§9 test authoring — injected fakes over `mock.module`, deterministic tests, normalized goldens, no ambient `$HOME`).
- PM notes: `./chg-GH-309-pm-notes.yaml` (DEC-2 decision-record sequencing; phase 7 documentation impacts; delivery conventions per DEC-7).
- Milestone scenario seeds: `doc/planning/oss-tooling/milestones/m2/test-scenarios.md` — SC-M2-S18-01…08, inherited **by name** (spec Appendix B); reconciliation notes where seed wording needs precision are carried in the owning TCs.
- Superseding decision record: to land in `doc/decisions/` via `@decision-advisor` during the artifact phases (untracked at test-plan time; TC-GRPDR-001 enforces its existence before rename code).
- Naming-freeze rule: `doc/decisions/ODR-0003-*.md` (DC-4: superseding record plus code change; never a documentation-only rename).
- Delivered baseline contracts: current-truth `doc/spec/features/feature-projects.md` (delivered flat surface, `projects.*` identities, `unbound` scope, the two permitted side effects) — the pre-rename truth the alias must preserve byte-compatibly (C-2) and the flat surface's errors must move away from (F-7).
- Existing suite precedent: `tests/behaviour/projects-*.test.ts` (GH-288 list contract, identity, daemon reachability, help, migration, scope isolation, MCP scope), `tests/structure/error-table.test.ts` (pins the three `projects.*` identities — TC-PROJ-* IDs belong to GH-288 and are not reused here), and fixture helpers `tests/fixtures/projects/` (temp git repositories, host fixtures, identity markers, host-index readers, tree snapshots for write audits).

## 3. Coverage Overview

Every one of the sixteen §17 acceptance criteria is covered; no AC is left as TODO. DoD-15 is satisfied by this matrix plus execution evidence (Section 10, phase pm-notes).

### 3.1 Functional Coverage (F-#, AC-#)

| AC ID | Description (abbreviated) | TC ID(s) | Status |
|-------|---------------------------|----------|--------|
| AC-F1-1 | Mixed tracker kinds accepted; unimplemented member classified `not-yet-supported`, no records, read never fails (seed SC-M2-S18-05) | TC-GRPSURF-003, TC-GRPDOC-001 | Covered |
| AC-F2-1 | Classified configuration failures — `projects.config-invalid` / `projects.scope-unavailable` exit 2 / `projects.unknown-group` exit 1; never silent-empty | TC-GRPDOC-002, TC-GRPDOC-003, TC-GRPDOC-004, TC-GRPDOC-005 | Covered |
| AC-F3-1 | Same group without `workspaceRoot` reads identically; only `workspaceRoot` absent (seed SC-M2-S18-02) | TC-GRPWORK-002 | Covered |
| AC-F3-2 | Undeclared clone inside `workspaceRoot` is not a member (seed SC-M2-S18-06) | TC-GRPWORK-003 | Covered |
| AC-F4-1 | Registered workspace locates both declared members (seed SC-M2-S18-01) | TC-GRPWORK-001 | Covered |
| AC-F4-2 | Group listing carries member `health` + `daemonReachable` closed reasons (seed SC-M2-S18-03) | TC-GRPSURF-001, TC-GRPSURF-002 | Covered |
| AC-F5-1 | One `state-unavailable` member → exit 0, `data.partial` true, `data.degradedMembers[]`; readable members returned (seed SC-M2-S18-07) | TC-GRPAGG-001, TC-GRPAGG-002 | Covered |
| AC-F6-1 | `queue list --project` / `status --project` return only the group's work at exit 0 (seed SC-M2-S18-04) | TC-GRPSREAD-001, TC-GRPSREAD-002 | Covered |
| AC-F7-1 | Alias returns delivered `projects.v1` unchanged; default returns `project-groups.v1` (seed SC-M2-S18-08) | TC-GRPREN-003, TC-GRPREN-004, TC-GRPREN-005 | Covered |
| AC-F7-2 | `repos list --json` returns `repos.v1` (exact fields, sorted table, `unbound` rule, `repos.*` identities) | TC-GRPREN-001, TC-GRPREN-002 | Covered |
| AC-F8-1 | Naming boundary holds everywhere; permanent repository vocabulary unchanged; board stays repository-keyed | TC-GRPBOUND-001, TC-GRPBOUND-002, TC-GRPSREAD-003 | Covered |
| AC-F9-1 | `repos` at root `--help` with reference page; migration guide speaks delivered vocabulary | TC-GRPREG-001, TC-GRPREG-002 | Covered |
| AC-F10-1 | Superseding decision record exists before rename code; registry row moves only with the code change | TC-GRPDR-001 | Covered |
| AC-NFR1-1 | Every delivered envelope: five-field `delivery.result.v1`, new keys under `data`, zero `ok`/`command` | TC-GRPENV-001 | Covered |
| AC-NFR2-1 | Group and flat reads exhibit exactly the two permitted side effects | TC-GRPRO-001 | Covered |
| AC-NFR6-1 | `TMPDIR=$PWD/tmp/tmpdir pnpm check` green before PR opens | TC-GRPGATE-001 | Covered |

### 3.2 Interface Coverage (API-#, EVT-#, DM-#)

No HTTP/API or event interfaces exist in this change (spec §8.1/§8.2: N/A — CLI surfaces only; group-scoped reads emit no events). Data-model surfaces:

| ID | Element | TC ID(s) | Status |
|----|---------|----------|--------|
| DM-1 | Project configuration document (`delivery.projects.groups.v1`: `groups[]` / `groupKey` / `name` / optional `workspaceRoot` / `members[]` with selector + `trackerKind`) | TC-GRPDOC-001, TC-GRPDOC-002 | Covered |
| DM-2 | Group envelope `project-groups.v1` (data.groups[] member fields; `data.partial` / `data.degradedMembers[]`) | TC-GRPSURF-001, TC-GRPAGG-001, TC-GRPREN-004 | Covered |
| DM-3 | Flat envelope `repos.v1` (data.repos[] renamed record shape + `hostIndexRevision`) | TC-GRPREN-001, TC-GRPREN-002 | Covered |
| DM-4 | Alias payload `projects.v1` (delivered flat payload, returned unchanged; no group field) | TC-GRPREN-003 | Covered |
| DM-5 | Aggregation outcome vocabulary (`observed` / `not-yet-supported` / `state-unavailable` / `unregistered`) + closed daemon reasons | TC-GRPAGG-002, TC-GRPSURF-001 | Covered |

### 3.3 Non-Functional Coverage (NFR-#)

| NFR ID | Requirement | TC ID(s) | Status |
|--------|-------------|----------|--------|
| NFR-1 | Envelope continuity: five-field shape, keys under `data`, zero `ok`/`command` | TC-GRPENV-001 | Covered |
| NFR-2 | Read-only preservation: exactly the two permitted side effects | TC-GRPRO-001 | Covered |
| NFR-3 | Determinism: byte-identical text over unchanged state; member order = declared order | TC-GRPSURF-002 | Covered |
| NFR-4 | Membership containment: scans locate declared members only; workspace parity 1:1 | TC-GRPWORK-002, TC-GRPWORK-003 | Covered |
| NFR-5 | Classification fidelity: configuration failures never silent | TC-GRPDOC-002, TC-GRPDOC-003, TC-GRPDOC-005 | Covered |
| NFR-6 | `TMPDIR=$PWD/tmp/tmpdir pnpm check` green before PR | TC-GRPGATE-001 | Covered |
| NFR-7 | Commit hygiene (conventional subjects, body/footer ≤100 chars) | Lifecycle gate — phase 9 commit-message range gate + commit primitive; recorded in pm-notes. Not a TC by design (see §1.2) | Covered (gate evidence) |

## 4. Test Types and Layers

Per `.ai/rules/testing-strategy.md`, this is a TypeScript workspace behavior change: the primary layers are **bun:test behaviour suites** (CLI surfaces exercised through the production harness with fixture git repositories) and **bun:test structure/contract suites** (envelope shape, error table, entrypoint composition), plus the aggregate gate and a small review-time layer for the two gates a permanent suite legally cannot assert.

- **Behaviour suites (bun:test):** `tests/behaviour/**` — configuration load/validation, workspace discovery, group surface, aggregation, scoped reads, rename/alias, read-only audit. The GH-288 precedent (`tests/behaviour/projects-list-contract.test.ts`, `projects-identity.test.ts`, `projects-daemon-reachability.test.ts`, `projects-help.test.ts`) is the pattern. Fixture helpers are reused from `tests/fixtures/projects/` (temp repositories, host fixtures, identity markers, host-index readers, `snapshotTree`/`snapshotDifferences` for write audits, `APPROVED_BASE` tmp/tmpdir isolation). Daemon reachability states are produced by socket/state presence manipulation (GH-288 precedent), never by a live daemon.
- **Structure/contract suites (bun:test):** `tests/structure/**` — error-table rows for the new identities (extends `tests/structure/error-table.test.ts`, which pins the delivered `projects.*` rows), envelope-shape conformance, root-family composition (extends the composition tests that pin the root family set), naming-boundary content checks.
- **Aggregate gate (no new code):** `TMPDIR=$PWD/tmp/tmpdir pnpm check` = lint → format:check → typecheck → test → boundaries → exports parity, per pm-notes/DEC-7. Narrow suites (`bun test <path>`) during iteration per testing-strategy.
- **Review-time/manual layer:** decision-record register inspection + commit-order review (TC-GRPDR-001); changed-scope conformance against §7.2 (TC-GRPBOUND-003). Both exist because `.ai/rules/testing-strategy.md` forbids permanent suites from asserting branch diffs; they are executed once at the delivery gate and logged in Section 10.
- **Unit-vs-CLI boundary:** pure configuration-validation logic may be unit-tested through injected fakes where a seam exists; every user-visible behavior in this plan is asserted through the delivered CLI surface (envelope in, envelope out), matching the GH-288 harness style. Suite file names in Section 7 are the proposed homes — the implementation plan pins them; the assertion contracts bind regardless of final placement.

## 5. Test Scenarios

### 5.1 Scenario Index

| TC ID | Title | Type | Level | Priority | AC Coverage |
|-------|-------|------|-------|----------|-------------|
| TC-GRPDOC-001 | Configuration document loads per `delivery.projects.groups.v1` (declared fields only; OQ-1 key rules) | Happy Path | Automated | High | AC-F1-1, DoD-1, DM-1 |
| TC-GRPDOC-002 | Contradictory configuration → `projects.config-invalid`, never silent-empty | Negative | Automated | Critical | AC-F2-1, DoD-2, NFR-5 |
| TC-GRPDOC-003 | Unreadable document or scope → `projects.scope-unavailable` at exit 2 | Negative | Automated | Critical | AC-F2-1, DoD-2 |
| TC-GRPDOC-004 | Unknown group key refused at exit 1 with `projects.unknown-group` | Negative | Automated | High | AC-F2-1, DoD-2, F-6 |
| TC-GRPDOC-005 | Absent or empty configuration → valid empty group listing at exit 0 | Edge Case | Automated | High | AC-F2-1, DoD-2, NFR-5 |
| TC-GRPWORK-001 | Registered workspace locates both declared members (SC-M2-S18-01) | Happy Path | Automated | High | AC-F4-1, DoD-3 |
| TC-GRPWORK-002 | Same group without a workspace reads identically — 1:1 parity (SC-M2-S18-02) | Regression | Automated | High | AC-F3-1, DoD-3, NFR-4 |
| TC-GRPWORK-003 | Undeclared clone inside the workspace is never admitted (SC-M2-S18-06) | Negative | Automated | Critical | AC-F3-2, DoD-3, NFR-4, C-4 |
| TC-GRPSURF-001 | `project-groups.v1` envelope shape: member fields, declared order, closed daemon reasons (SC-M2-S18-03) | Happy Path | Automated | Critical | AC-F4-2, DoD-4, DM-2, DM-5 |
| TC-GRPSURF-002 | Determinism: byte-identical text over unchanged state; declared member order | Regression | Automated | High | AC-F4-2, DoD-4, NFR-3 |
| TC-GRPSURF-003 | Mixed tracker kinds classified `not-yet-supported`, never rejected (SC-M2-S18-05) | Happy Path | Automated | Critical | AC-F1-1, DoD-5 |
| TC-GRPAGG-001 | One degraded member yields classified partial result at exit 0 (SC-M2-S18-07) | Edge Case | Automated | Critical | AC-F5-1, DoD-6, DM-2 |
| TC-GRPAGG-002 | Aggregation outcome vocabulary is closed; every member resolves to exactly one outcome | Contract | Automated | High | AC-F5-1, DoD-6, DM-5, OQ-3 |
| TC-GRPSREAD-001 | Group-scoped queue and status reads accept the group key (SC-M2-S18-04) | Happy Path | Automated | Critical | AC-F6-1, DoD-7 |
| TC-GRPSREAD-002 | Scoped reads return only the group's work — no non-member envelope read | Negative | Automated | High | AC-F6-1, DoD-7 |
| TC-GRPSREAD-003 | Board is never group-scoped — no group scope shipped | Negative | Semi-automated | High | AC-F8-1, DoD-7, NG-3 |
| TC-GRPREN-001 | `repos list --json` returns `repos.v1` with exact renamed fields; sorted table; `unbound` rule | Happy Path | Automated | Critical | AC-F7-2, DoD-8, DM-3 |
| TC-GRPREN-002 | Flat-surface errors carry the `repos.*` identities with unchanged exit meanings | Regression | Automated | Critical | AC-F7-2, DoD-8 |
| TC-GRPREN-003 | Alias `projects list --flat --json` returns the delivered `projects.v1` payload unchanged (C-2) | Regression | Automated | Critical | AC-F7-1, DoD-8, DM-4, C-2 |
| TC-GRPREN-004 | Default `projects list --json` returns `project-groups.v1`, not the flat payload (SC-M2-S18-08) | Regression | Automated | Critical | AC-F7-1, DoD-8, DM-2 |
| TC-GRPREN-005 | `--flat --project` combination refused as mutually exclusive at exit 1 (OQ-2, pinned at delivery planning) | Edge Case | Automated | Medium | DoD-8, OQ-2, AC-F7-1 |
| TC-GRPENV-001 | Every delivered envelope: five-field `delivery.result.v1`, keys under `data`, zero `ok`/`command` | Contract | Automated | Critical | AC-NFR1-1, DoD-12, C-1 |
| TC-GRPRO-001 | Group and flat reads perform exactly the two permitted side effects | Negative | Automated | Critical | AC-NFR2-1, DoD-13, NFR-2, C-4 |
| TC-GRPBOUND-001 | Naming boundary consistent across surfaces, help, and docs | Regression | Semi-automated | High | AC-F8-1, DoD-9, F-8 |
| TC-GRPBOUND-002 | Permanent repository vocabulary unchanged (marker, container, host index, `--project-root`) | Regression | Automated | High | AC-F8-1, DoD-9 |
| TC-GRPBOUND-003 | Changed-scope conformance: no M2-S19 mechanics, no board change, no alias retirement, no new adapter, no pre-flipped current-truth docs | Negative | Manual (review) | High | DoD-14, C-5, C-6 |
| TC-GRPREG-001 | `repos` registered at the root listing with help entry and reference page | Happy Path | Automated | High | AC-F9-1, DoD-10, F-9 |
| TC-GRPREG-002 | Migration guide speaks the delivered vocabulary; migration stays one-step operator-run | Regression | Automated | High | AC-F9-1, DoD-10 |
| TC-GRPDR-001 | Superseding decision record exists before rename code; registry row moves only with the code change | Negative | Manual (review) | Critical | AC-F10-1, DoD-11, C-3, DEC-2 |
| TC-GRPGATE-001 | Aggregate gate `TMPDIR=$PWD/tmp/tmpdir pnpm check` green before the PR opens | Regression | Automated | Critical | AC-NFR6-1, DoD-16, NFR-6, C-7 |

### 5.2 Scenario Details

#### TC-GRPDOC-001 - Configuration document loads per `delivery.projects.groups.v1`

**Scenario Type**: Happy Path
**Impact Level**: Critical
**Priority**: High
**Related IDs**: F-1, DoD-1, DM-1, AC-F1-1 (OQ-1 proposed resolution)
**Test Type(s)**: Unit + Integration (configuration load through the delivered surface)
**Automation Level**: Automated
**Target Layer / Location**: `tests/behaviour/projects-config.test.ts` (To Implement — name pinned by plan), reusing `tests/fixtures/projects/` helpers
**Tags**: @bun, @behaviour, @projects

**Preconditions**:

- A fixture host with one or more managed checkouts (existing fixture helpers).
- A valid `<configDirectoryName>/projects.yaml` written beside the delivered project-committed configuration file (brand-derived directory, DEC-6).

**Steps**:

1. Write a configuration declaring one group with two members — one selected by `root`, one by `repoKey` — each with a `trackerKind`, plus a `name` and a `workspaceRoot`.
2. Load the configuration through the delivered group surface (`projects list --json`).
3. Assert the load succeeds: both members resolve with their declared selectors and tracker kinds.
4. Assert schema conformance: only the declared fields are consumed (`groups[]`, `groupKey`, `name`, optional `workspaceRoot`, `members[]` with a `root` or `repoKey` selector plus `trackerKind`); no invented field is required or honored.
5. Assert the OQ-1 proposed rules hold: duplicate group keys and self-contradictory member declarations are classified `projects.config-invalid` (paired with TC-GRPDOC-002); a non-empty host-unique `groupKey` loads.

**Expected Outcome**:

- The document loads as declared; membership comes from configuration only; the schema is contracts-verbatim (RSK-3 guard).

**Notes / Clarifications**:

- OQ-1 (groupKey format/uniqueness) is **pinned at delivery planning**; this TC asserts the spec's proposed resolution. A plan decision that differs forces a test-plan reconciliation (Section 9), never a silent drift.

#### TC-GRPDOC-002 - Contradictory configuration → `projects.config-invalid`, never silent-empty

**Scenario Type**: Negative
**Impact Level**: Critical
**Priority**: High
**Related IDs**: F-2, AC-F2-1, DoD-2, NFR-5, DM-1
**Test Type(s)**: Integration (negative path through the delivered surface)
**Automation Level**: Automated
**Target Layer / Location**: `tests/behaviour/projects-config.test.ts` (To Implement)
**Tags**: @bun, @behaviour, @projects

**Preconditions**:

- TC-GRPDOC-001's valid-document baseline exists for contrast.

**Steps**:

1. Write configuration documents that each violate content or schema: duplicate `groupKey` values; a member with neither selector; a member with both selectors where the plan's pinned rule treats that as contradictory; a group with an empty `members[]` where the schema forbids it (each case per the pinned OQ-1 rules); a structurally broken YAML document.
2. Run a group-scoped read against each variant.
3. Assert every variant fails with the classified identity `projects.config-invalid` — never exit 0 with an empty group listing; assert the envelope's error carries the identity and the exit code per the pinned projection.
4. Assert zero silent-empty outcomes across all variants (NFR-5 threshold: 100% classified).

**Expected Outcome**:

- 100% of contradictory/unreadable-by-schema configurations produce `projects.config-invalid`; no variant renders as a healthy empty project.

**Notes / Clarifications**:

- This is the fail-closed security property (§21): a degraded read cannot masquerade as a healthy empty project. The exact refusal-vs-exit-2 split for "unreadable" belongs to TC-GRPDOC-003.

#### TC-GRPDOC-003 - Unreadable document or scope → `projects.scope-unavailable` at exit 2

**Scenario Type**: Negative
**Impact Level**: Critical
**Priority**: High
**Related IDs**: F-2, AC-F2-1, DoD-2
**Test Type(s)**: Integration (negative path)
**Automation Level**: Automated
**Target Layer / Location**: `tests/behaviour/projects-config.test.ts` (To Implement)
**Tags**: @bun, @behaviour, @projects

**Preconditions**:

- Fixture host present; permissions manipulable on the fixture tree (temp directories, no `$HOME` dependence).

**Steps**:

1. Make `<configDirectoryName>/projects.yaml` unreadable (permission or missing-parent manipulation on the fixture tree).
2. Run a group-scoped read; assert `projects.scope-unavailable` at exit 2.
3. Make the invoking scope unreadable (fixture manipulation of the invoking checkout's scope resolution).
4. Run a group-scoped read; assert the same classified identity at exit 2.
5. Assert the boundary against TC-GRPDOC-002: unreadable (cannot be read at all) → exit 2; readable-but-invalid (can be read, fails validation) → `projects.config-invalid`.

**Expected Outcome**:

- Both unreadable conditions classify as `projects.scope-unavailable` at exit 2; the config-invalid/scope-unavailable boundary is stable across variants.

#### TC-GRPDOC-004 - Unknown group key refused at exit 1 with `projects.unknown-group`

**Scenario Type**: Negative
**Impact Level**: Important
**Priority**: High
**Related IDs**: F-2, F-6, AC-F2-1, DoD-2
**Test Type(s)**: Integration (negative path)
**Automation Level**: Automated
**Target Layer / Location**: `tests/behaviour/projects-config.test.ts` (To Implement; exercised through `queue list --project` / `status --project` and `projects list --project`)
**Tags**: @bun, @behaviour, @projects, @queue, @status

**Preconditions**:

- A valid configuration with one configured group (so the refusal is about the key, not the configuration).

**Steps**:

1. Run `projects list --project does-not-exist --json`; assert refusal with `projects.unknown-group` at exit 1.
2. Run `queue list --project does-not-exist` and `status --project does-not-exist`; assert the same identity and exit code on every group-scoped read (one refusal rule, all surfaces).

**Expected Outcome**:

- A requested group key that is not configured is refused at exit 1 on every group-scoped surface; no surface invents a partial or empty success.

#### TC-GRPDOC-005 - Absent or empty configuration → valid empty group listing at exit 0

**Scenario Type**: Edge Case
**Impact Level**: Important
**Priority**: High
**Related IDs**: F-2, AC-F2-1 (contrast case), DoD-2, NFR-5 (§18 adoption behavior)
**Test Type(s)**: Integration (edge path)
**Automation Level**: Automated
**Target Layer / Location**: `tests/behaviour/projects-config.test.ts` (To Implement)
**Tags**: @bun, @behaviour, @projects

**Preconditions**:

- Fixture host with no `projects.yaml` at all; second variant with an empty `groups[]` document.

**Steps**:

1. Run `projects list --json` with no configuration document present; assert exit 0 with a valid empty group listing (`data.groups[]` empty) — absence is adopted-as-empty per spec §18, not an error.
2. Repeat with an empty `groups[]` document; assert the same outcome.
3. Assert the contrast with TC-GRPDOC-002: absence/emptiness is legitimate zero-group truth, whereas a readable-but-invalid document must never render as this same empty success.

**Expected Outcome**:

- Opt-in adoption holds: unconfigured hosts get a valid empty listing at exit 0; the silent-empty prohibition applies only to configurations that exist but cannot be honestly read or validated.

#### TC-GRPWORK-001 - Registered workspace locates both declared members (SC-M2-S18-01)

**Scenario Type**: Happy Path
**Impact Level**: Critical
**Priority**: High
**Related IDs**: F-3, F-4, AC-F4-1, DoD-3, DM-2 (seed SC-M2-S18-01)
**Test Type(s)**: Integration (CLI surface over fixture repositories)
**Automation Level**: Automated
**Target Layer / Location**: `tests/behaviour/projects-groups-list.test.ts` (To Implement), using `createRepository`/`cloneRepository` fixture helpers
**Tags**: @bun, @behaviour, @projects

**Preconditions**:

- Two managed member checkouts cloned inside one fixture directory.
- A configuration declaring one group naming both members, with that directory as `workspaceRoot`.

**Steps**:

1. Register the directory as the group's `workspaceRoot` per the configuration document.
2. Run `projects list --json`.
3. Assert `project-groups.v1` returns `data.groups[]` whose single group carries both declared member `repoKey` values, with `workspaceRoot` present.

**Expected Outcome**:

- The scan locates exactly the two declared clones inside the registered root; the group lists both with their keys (ticket AC1).

#### TC-GRPWORK-002 - Same group without a workspace reads identically — 1:1 parity (SC-M2-S18-02)

**Scenario Type**: Regression
**Impact Level**: Critical
**Priority**: High
**Related IDs**: F-3, F-4, AC-F3-1, DoD-3, NFR-4, DM-2 (seed SC-M2-S18-02)
**Test Type(s)**: Integration (parity comparison)
**Automation Level**: Automated
**Target Layer / Location**: `tests/behaviour/projects-groups-list.test.ts` (To Implement)
**Tags**: @bun, @behaviour, @projects

**Preconditions**:

- The same two-member group configured with member checkouts in unrelated directories and **no** `workspaceRoot`.

**Steps**:

1. Run `projects list --project <groupKey> --json`.
2. Assert the same members, health, and state appear as in the registered case (TC-GRPWORK-001's member set), with only `workspaceRoot` absent and `groupKey` unchanged.
3. Assert no scan ran: nothing is inferred from directories (member resolution identical to configuration-only resolution).

**Expected Outcome**:

- 1:1 parity with and without a workspace; the workspace is a convenience, never a requirement (ticket AC2).

#### TC-GRPWORK-003 - Undeclared clone inside the workspace is never admitted (SC-M2-S18-06)

**Scenario Type**: Negative
**Impact Level**: Critical
**Priority**: High
**Related IDs**: F-3, F-4, AC-F3-2, DoD-3, NFR-4, C-4 (seed SC-M2-S18-06; RSK-4)
**Test Type(s)**: Integration (negative containment probe)
**Automation Level**: Automated
**Target Layer / Location**: `tests/behaviour/projects-groups-list.test.ts` (To Implement)
**Tags**: @bun, @behaviour, @projects, @security

**Preconditions**:

- TC-GRPWORK-001's workspace, plus one additional managed clone inside the same directory that the configuration does **not** declare.

**Steps**:

1. Run `projects list --json`.
2. Assert `data.groups[].members[]` lists only the declared members; the undeclared clone appears nowhere in the envelope.
3. Repeat the probe with the undeclared clone placed in a nested subdirectory of the workspace (scan-depth independence of the containment invariant).

**Expected Outcome**:

- Configuration-only membership holds absolutely: 0 undeclared clones admitted in any variant (ticket-level KPI: 0 in every scenario).

**Notes / Clarifications**:

- This is the security-relevant invariant (§21, RSK-4): a workspace registration cannot enlarge a group beyond its declared configuration. If the plan's OQ-1 pinning affects member-declaration shapes, this TC's fixture updates with the reconciliation.

#### TC-GRPSURF-001 - `project-groups.v1` envelope shape: member fields, declared order, closed daemon reasons (SC-M2-S18-03)

**Scenario Type**: Happy Path
**Impact Level**: Critical
**Priority**: High
**Related IDs**: F-4, AC-F4-2, DoD-4, DM-2, DM-5 (seed SC-M2-S18-03)
**Test Type(s)**: Contract (envelope shape)
**Automation Level**: Automated
**Target Layer / Location**: `tests/structure/projects-groups-envelope.test.ts` (To Implement) + behaviour surface in `tests/behaviour/projects-groups-list.test.ts`
**Tags**: @bun, @contract, @projects

**Preconditions**:

- A configuration with one group whose two members differ in daemon reachability (one reachable, one unreachable with a known closed reason — produced by socket/state fixture manipulation, GH-288 precedent).
- Members declared in a distinctive configuration order (not sorted order) to expose order drift.

**Steps**:

1. Run `projects list --json`.
2. Assert each `data.groups[]` entry carries exactly `groupKey`, `name`, optional `workspaceRoot`, and `members[]`.
3. Assert each `members[]` entry carries exactly `repoKey`, `root`, `trackerKind`, `state`, `health`, and `daemonReachable`.
4. Assert member order equals the configuration declared order (no sorting, no scan-order leakage).
5. Assert every member entry carries `health` and `daemonReachable`; the unreachable member's `daemonReachable` carries a closed reason from the delivered vocabulary (`daemon-not-mounted`, `state-absent`, `socket-absent`, `socket-unreachable` — first applicable reason wins, in that order).
6. Assert text output renders the group block with the declared columns (`group`, `member`, `tracker`, `state`, `health`, `daemon`).

**Expected Outcome**:

- The group envelope matches DM-2 exactly — no extra fields, no missing fields; health and reachability always present; the daemon reason vocabulary stays closed (ticket AC3).

#### TC-GRPSURF-002 - Determinism: byte-identical text over unchanged state; declared member order

**Scenario Type**: Regression
**Impact Level**: Important
**Priority**: High
**Related IDs**: F-4, AC-F4-2, DoD-4, NFR-3
**Test Type(s)**: Regression (determinism)
**Automation Level**: Automated
**Target Layer / Location**: `tests/behaviour/projects-groups-list.test.ts` (To Implement)
**Tags**: @bun, @behaviour, @projects

**Preconditions**:

- TC-GRPSURF-001's fixture state, held unchanged between runs.

**Steps**:

1. Run `projects list` (text form) twice over unchanged state; assert the two outputs are byte-identical.
2. Run `projects list --json` twice; assert the `data` payloads are identical (compare with `runId`/`timing` normalized — those envelope fields legitimately vary per invocation; NFR-3's byte-identical threshold applies to the text rendering).
3. Reorder members in the configuration; rerun; assert the envelope's member order follows the new declared order (order is configuration-driven, 100% of reads).

**Expected Outcome**:

- Two runs over unchanged state are byte-identical in text; member order is always the declared order.

#### TC-GRPSURF-003 - Mixed tracker kinds classified `not-yet-supported`, never rejected (SC-M2-S18-05)

**Scenario Type**: Happy Path
**Impact Level**: Critical
**Priority**: High
**Related IDs**: F-1, F-2, F-5, AC-F1-1, DoD-5, DM-5 (seed SC-M2-S18-05)
**Test Type(s)**: Integration (validation + classification)
**Automation Level**: Automated
**Target Layer / Location**: `tests/behaviour/projects-groups-list.test.ts` (To Implement)
**Tags**: @bun, @behaviour, @projects

**Preconditions**:

- A configuration mixing tracker kinds where at least one member's kind has no implemented adapter (only GitHub is exercised initially, NG-5).

**Steps**:

1. Validate the configuration through the delivered surface.
2. Run `projects list --json`.
3. Assert the configuration is accepted (no validation refusal for the unimplemented kind).
4. Assert the unimplemented member is classified `not-yet-supported` in `data.groups[].members[].health` and contributes no records (no queue/status rows, no read failure).
5. Assert the read exits 0 and the other members are unaffected.

**Expected Outcome**:

- Mixed tracker kinds are valid declarative configuration; the unimplemented kind narrows nothing — it is classified, never rejected silently (ticket AC5).

#### TC-GRPAGG-001 - One degraded member yields classified partial result at exit 0 (SC-M2-S18-07)

**Scenario Type**: Edge Case
**Impact Level**: Critical
**Priority**: High
**Related IDs**: F-5, AC-F5-1, DoD-6, DM-2, DM-5 (seed SC-M2-S18-07)
**Test Type(s)**: Integration (aggregation clause)
**Automation Level**: Automated
**Target Layer / Location**: `tests/behaviour/projects-groups-list.test.ts` (To Implement; the same clause exercised on scoped reads in `tests/behaviour/queue-status-project-scope.test.ts`)
**Tags**: @bun, @behaviour, @projects

**Preconditions**:

- A two-member group: one member with per-repository state `state-unavailable` (fixture-produced), one readable member.

**Steps**:

1. Run a group-scoped read (`projects list --project <groupKey> --json`, then the same clause via `queue list --project` / `status --project`).
2. Assert exit 0 with a classified partial result: `data.partial` true.
3. Assert `data.degradedMembers[]` names exactly the degraded member by `repoKey` and its outcome (`state-unavailable`).
4. Assert the readable members are still returned in `data.groups[]` / the read's records.

**Expected Outcome**:

- One degraded member degrades the result, never fails it: exit 0, partial true, degraded member named, readable members delivered (RSK-7 guard: the clause is one definition applied to every group-scoped read).

#### TC-GRPAGG-002 - Aggregation outcome vocabulary is closed; every member resolves to exactly one outcome

**Scenario Type**: Contract
**Impact Level**: Important
**Priority**: High
**Related IDs**: F-5, AC-F5-1, DoD-6, DM-5, OQ-3 (health value set)
**Test Type(s)**: Contract (vocabulary pinning)
**Automation Level**: Automated
**Target Layer / Location**: `tests/structure/projects-groups-envelope.test.ts` (To Implement)
**Tags**: @bun, @contract, @projects

**Preconditions**:

- Fixture members exercisable into each outcome condition where reachable (`observed`; `not-yet-supported` via tracker kind; `state-unavailable` via state fixture; `unregistered` via a declared member with no managed checkout).

**Steps**:

1. For each outcome condition, run a group-scoped read and assert the member resolves to exactly one outcome of the closed set `observed`, `not-yet-supported`, `state-unavailable`, `unregistered` (DM-5) — no fourth value, no empty resolution.
2. Assert the member `health` value set on group entries stays closed per the pinned OQ-3 resolution: a closed health vocabulary declared with the group contract, with `not-yet-supported` mandatory for unimplemented tracker kinds (pinnable like the delivered daemon-reason vocabulary).
3. Assert `unregistered` classification behavior matches the pinned clause (a declared member whose checkout cannot be located classifies; it does not silently vanish from `members[]`).

**Expected Outcome**:

- Every member resolves to exactly one closed outcome on every group-scoped read; the health vocabulary is closed and contract-testable.

**Notes / Clarifications**:

- OQ-3 (member `health` value set) is **pinned at delivery planning**; this TC asserts the proposed resolution (closed vocabulary declared with the group contract, `not-yet-supported` mandatory). A plan decision that differs forces reconciliation (Section 9).
- `unregistered` fixture behavior (declared-but-absent checkout) is derived from the closed outcome set in DM-5/F-5; the exact rendering follows the pinned aggregation contract in the plan.

#### TC-GRPSREAD-001 - Group-scoped queue and status reads accept the group key (SC-M2-S18-04)

**Scenario Type**: Happy Path
**Impact Level**: Critical
**Priority**: High
**Related IDs**: F-5, F-6, AC-F6-1, DoD-7, DM-5 (seed SC-M2-S18-04)
**Test Type(s)**: Integration (CLI surface)
**Automation Level**: Automated
**Target Layer / Location**: `tests/behaviour/queue-status-project-scope.test.ts` (To Implement)
**Tags**: @bun, @behaviour, @queue, @status

**Preconditions**:

- A configured group whose members carry running, waiting, and parked work (fixture-produced queue/state content).

**Steps**:

1. Run `queue list --project <groupKey>`; assert exit 0 and that the read returns only that group's work (members' running/waiting/parked entries).
2. Run `status --project <groupKey>`; assert exit 0 and group-only content.
3. Assert the aggregation clause governs both reads (outcome vocabulary per TC-GRPAGG-002; degradation per TC-GRPAGG-001 where applicable).

**Expected Outcome**:

- Both scoped reads accept the group key and exit 0, answering what the project has running, waiting, and parked (ticket AC4).

#### TC-GRPSREAD-002 - Scoped reads return only the group's work — no non-member envelope read

**Scenario Type**: Negative
**Impact Level**: Important
**Priority**: High
**Related IDs**: F-5, F-6, AC-F6-1, DoD-7
**Test Type(s)**: Integration (isolation probe)
**Automation Level**: Automated
**Target Layer / Location**: `tests/behaviour/queue-status-project-scope.test.ts` (To Implement)
**Tags**: @bun, @behaviour, @queue, @status

**Preconditions**:

- TC-GRPSREAD-001's group, plus a second repository outside the group carrying its own work.

**Steps**:

1. Run `queue list --project <groupKey>` and `status --project <groupKey>`.
2. Assert no non-member repository's work appears in either result (seed SC-M2-S18-04's "no undeclared `queue.*` or `status.*` envelope is read", reconciled: the assertion is on returned records, since the seed's wording conflates the `projects list` output with the scoped reads — see Notes).
3. Assert the unscoped forms (`queue list`, `status` without `--project`) are unchanged — the grammar is additive (no regression to the delivered repository-scoped reads).

**Expected Outcome**:

- Group scoping filters exactly to the group; repository-scoped behavior is unchanged.

**Notes / Clarifications**:

- Seed reconciliation: SC-M2-S18-04's Assert sentence references `projects list --json` returning `project-groups.v1`, which belongs to the group-surface seeds (SC-01/03). The scoped-read substance (both reads return only the group's work; both exit 0; no non-member envelope read) is asserted here; the `projects list` group payload is TC-GRPSURF-001/TC-GRPREN-004.

#### TC-GRPSREAD-003 - Board is never group-scoped — no group scope shipped

**Scenario Type**: Negative
**Impact Level**: Important
**Priority**: High
**Related IDs**: F-8, AC-F8-1, DoD-7, NG-3, DEC-3
**Test Type(s)**: Structural scan + manual confirmation
**Automation Level**: Semi-automated
**Target Layer / Location**: `tests/structure/naming-boundary.test.ts` (To Implement — scan of the delivered command definitions and help text) + review confirmation
**Tags**: @bun, @structure, @review

**Preconditions**:

- The delivered tree after the rename phases.

**Steps**:

1. Scan the delivered command definitions and help/reference text for any group-scoped board claim: `board` gains no `--project`-takes-groupKey semantics, no group-scope flag, and no documentation claiming the board is group-scoped.
2. Assert `board --project` remains documented/treated as a repository key wherever the board appears.
3. Manual confirmation at review: the changed-scope check (TC-GRPBOUND-003) shows no board surface change in the delivery diff.

**Expected Outcome**:

- No group-scoped board exists or is claimed anywhere; the board resolution (DEC-3) holds in code and docs.

#### TC-GRPREN-001 - `repos list --json` returns `repos.v1` with exact renamed fields; sorted table; `unbound` rule

**Scenario Type**: Happy Path
**Impact Level**: Critical
**Priority**: High
**Related IDs**: F-7, AC-F7-2, DoD-8, DM-3, NFR-3
**Test Type(s)**: Contract (envelope + text table)
**Automation Level**: Automated
**Target Layer / Location**: `tests/behaviour/repos-list-contract.test.ts` (To Implement), mirroring `tests/behaviour/projects-list-contract.test.ts`
**Tags**: @bun, @behaviour, @repos

**Preconditions**:

- A fixture host with managed checkouts (GH-288 fixture patterns), including an invocation outside any git work tree for the `unbound` case.

**Steps**:

1. Run `repos list --json`.
2. Assert `repos.v1`: `data.repos[]` where each entry carries exactly `repoKey`, `root`, `stateLocation`, `daemonReachable`, and `handoverState`, plus `hostIndexRevision` at the data level.
3. Assert the renamed fields: `repoKey` (no `projectKey`), `data.repos[]` (no `data.projects[]`).
4. Run `repos list` (text form); assert the table is sorted by repo key.
5. Run `repos list` outside any git work tree; assert the declared `unbound` scope (one bounded warning, never an error, never a listed row) is preserved.

**Expected Outcome**:

- The flat record set is reachable under its delivered name with exactly the renamed contract; determinism and the unbound rule carry over unchanged.

#### TC-GRPREN-002 - Flat-surface errors carry the `repos.*` identities with unchanged exit meanings

**Scenario Type**: Regression
**Impact Level**: Critical
**Priority**: High
**Related IDs**: F-7, AC-F7-2, DoD-8
**Test Type(s)**: Contract (error table) + Integration (refusals)
**Automation Level**: Automated
**Target Layer / Location**: `tests/structure/error-table.test.ts` (Existing – Update: add the `repos.*` rows alongside the pinned `projects.*` rows) + `tests/behaviour/repos-list-contract.test.ts` (refusal probes)
**Tags**: @bun, @contract, @repos

**Preconditions**:

- Fixture manipulable to produce each delivered flat-surface failure: unreadable identity marker, corrupt registry/store, unavailable state location.

**Steps**:

1. Update the error-table suite: the `repos` kind declares exactly `repos.identity-unreadable` (exit 1), `repos.registry-corrupt` (exit 2), and `repos.state-unavailable` (exit 2) — registry-synced rows per the error contract.
2. Probe each failure through `repos list` on the fixture host; assert the delivered identities and exit codes (0 produced / 1 refused / 2 platform-or-state unchanged).
3. Assert the old `projects.*` identities no longer fire on the flat surface post-rename (the prefix moved with the code), while the group surface's own identities (`projects.config-invalid`, `projects.unknown-group`, `projects.scope-unavailable`) are untouched by this move.

**Expected Outcome**:

- The flat surface's errors are classified under `repos.*` with unchanged exit meanings; no identity is duplicated across prefixes.

#### TC-GRPREN-003 - Alias `projects list --flat --json` returns the delivered `projects.v1` payload unchanged (C-2)

**Scenario Type**: Regression
**Impact Level**: Critical
**Priority**: High
**Related IDs**: F-7, AC-F7-1, DoD-8, DM-4, C-2 (seed SC-M2-S18-08, alias half)
**Test Type(s)**: Contract (byte-compat against the delivered shape)
**Automation Level**: Automated
**Target Layer / Location**: `tests/behaviour/projects-flat-alias.test.ts` (To Implement), with a committed golden fixture of the delivered payload shape (normalized per `.ai/rules/typescript.md` golden rules)
**Tags**: @bun, @behaviour, @projects

**Preconditions**:

- A fixture host fixed at test-authoring time; a golden capturing the **delivered** (pre-rename) `projects.v1` payload shape on that fixture: `data.projects[]` with `projectKey`, `root`, `stateLocation`, `daemonReachable`, `handoverState`, plus `hostIndexRevision` — and no group field, no group claim.

**Steps**:

1. Run `projects list --flat --json` on the fixture host.
2. Assert the payload matches the golden: identical field set, identical values on the fixed fixture, `runId`/`timing` normalized (golden rules) — byte-compat against the delivered shape, not merely "shape-compatible".
3. Assert the absence negatives: no `groupKey`, no `data.groups[]`, no `data.repos[]`, no `repoKey` anywhere in the alias payload.
4. Assert text output of `projects list --flat` matches the delivered text table shape (sorted by project key, pre-rename columns).

**Expected Outcome**:

- Consumers of the delivered flat surface keep working across the rename: the alias is the delivered payload, unchanged (C-2: any field or shape drift fails review).

**Notes / Clarifications**:

- The golden is regenerated only deliberately with an explicit command, per testing-strategy golden rules; a regeneration that changes field sets is a C-2 violation, not a fixture refresh.

#### TC-GRPREN-004 - Default `projects list --json` returns `project-groups.v1`, not the flat payload (SC-M2-S18-08)

**Scenario Type**: Regression
**Impact Level**: Critical
**Priority**: High
**Related IDs**: F-4, F-7, AC-F7-1, DoD-8, DM-2 (seed SC-M2-S18-08, group half)
**Test Type(s)**: Contract (default-form disambiguation)
**Automation Level**: Automated
**Target Layer / Location**: `tests/behaviour/projects-groups-list.test.ts` (To Implement)
**Tags**: @bun, @behaviour, @projects

**Preconditions**:

- TC-GRPREN-003's fixture host with both a configuration document and managed checkouts.

**Steps**:

1. Run `projects list --json` (no flags).
2. Assert `project-groups.v1`: `data.groups[]` with `groupKey` — and none of the flat payload's markers (`data.projects[]`, `projectKey`).
3. Assert the three synopsis forms are distinct on one host: default → groups; `--flat` → delivered flat payload (TC-GRPREN-003); `--project <groupKey>` → the one scoped group (TC-GRPWORK-001 pattern).

**Expected Outcome**:

- After the rename, the default meaning is groups; the flat set remains reachable only through the alias or `repos list` (ticket AC6).

#### TC-GRPREN-005 - `--flat --project` combination refused as mutually exclusive at exit 1 (OQ-2, pinned at delivery planning)

**Scenario Type**: Edge Case
**Impact Level**: Minor
**Priority**: Medium
**Related IDs**: F-7, AC-F7-1 (boundary), DoD-8, OQ-2, C-2
**Test Type(s)**: Integration (flag-combination edge)
**Automation Level**: Automated
**Target Layer / Location**: `tests/behaviour/projects-flat-alias.test.ts` (To Implement)
**Tags**: @bun, @behaviour, @projects

**Preconditions**:

- A valid configuration with at least one configured group (so the refusal is about the combination, not the key).

**Steps**:

1. Run `projects list --flat --project <groupKey> --json`.
2. Assert the expected behavior per the OQ-2 proposed resolution: the combination is refused as mutually exclusive at exit 1 — the alias takes no group scoping.
3. Assert the refusal identity is the pinned one from the plan (expected: the alias's own refusal classification; if the plan pins a distinct identity, this TC reconciles).

**Expected Outcome**:

- The undefined combination is classified, never silently coerced to one of the three synopsis forms.

**Notes / Clarifications**:

- **Flagged pending plan pinning:** the spec's pack defines three separate synopsis forms and never the combination; the proposed resolution (mutually-exclusive refusal at exit 1) is asserted here as expected behavior. OQ-2 is **pinned at delivery planning** — a plan decision that differs (e.g., alias-wins precedence) forces a test-plan reconciliation (Section 9), never a silent drift.

#### TC-GRPENV-001 - Every delivered envelope: five-field `delivery.result.v1`, keys under `data`, zero `ok`/`command`

**Scenario Type**: Contract
**Impact Level**: Critical
**Priority**: High
**Related IDs**: NFR-1, AC-NFR1-1, DoD-12, C-1, DEC-5, DM-2, DM-3, DM-4
**Test Type(s)**: Contract (envelope conformance across all delivered envelopes of this change)
**Automation Level**: Automated
**Target Layer / Location**: `tests/structure/projects-groups-envelope.test.ts` (To Implement), asserting over the delivered envelopes produced by the behaviour suites' harness runs
**Tags**: @bun, @contract, @envelope

**Preconditions**:

- The behaviour suites produce at least one delivered envelope per new/renamed surface form (group list default, `--project`, `--flat`, `repos list`, scoped queue, scoped status, each classified failure).

**Steps**:

1. For every captured envelope of this change's surfaces: assert exactly the delivered five-field `delivery.result.v1` shape (`schemaVersion`, `runId`, `exitCode`, `timing`, `data`, plus `error` on failure).
2. Assert all new keys live under `data` (including `data.partial` and `data.degradedMembers[]`); zero new top-level keys.
3. Assert zero occurrences of `ok` or `command` fields anywhere in the delivered envelopes (C-1/DEC-5: contracts win over pack example snippets).

**Expected Outcome**:

- Envelope continuity holds: 0 new top-level envelope keys, 0 `ok`/`command` fields, every new key under `data` (Success Metrics thresholds).

#### TC-GRPRO-001 - Group and flat reads perform exactly the two permitted side effects

**Scenario Type**: Negative
**Impact Level**: Critical
**Priority**: High
**Related IDs**: NFR-2, AC-NFR2-1, DoD-13, C-4
**Test Type(s)**: Integration (write audit via tree snapshots)
**Automation Level**: Automated
**Target Layer / Location**: `tests/behaviour/projects-read-only-audit.test.ts` (To Implement — extends the GH-288 side-effect audit pattern), using `snapshotTree`/`snapshotDifferences` from `tests/fixtures/projects/host-root.ts`
**Tags**: @bun, @behaviour, @projects, @read-only

**Preconditions**:

- Fixture host with configuration, workspace, members, and both reachability states; tree snapshot machinery in place.

**Steps**:

1. Snapshot the host tree. Run `projects list` (group surface, each form: default, `--project`, `--flat`) and `repos list`; snapshot again.
2. Assert the diff contains exactly the two delivered permitted side effects and nothing else: the create-once identity marker (only where a checkout lacks one) and removal of a leftover `*.tmp` store sibling by the read-only store handle.
3. Repeat across the failure paths exercised in TC-GRPDOC-002/003 (config-invalid, scope-unavailable): reads that fail classified must also write nothing beyond the permitted set.
4. Assert no index maintenance, no prune, no store-content write, no workspace-scan write into any checkout.

**Expected Outcome**:

- Exactly the two permitted side effects; 0 other writes on every group and flat read, success or classified failure.

#### TC-GRPBOUND-001 - Naming boundary consistent across surfaces, help, and docs

**Scenario Type**: Regression
**Impact Level**: Important
**Priority**: High
**Related IDs**: F-8, AC-F8-1, DoD-9
**Test Type(s)**: Content check (automated anchors) + manual semantic review
**Automation Level**: Semi-automated
**Target Layer / Location**: `tests/structure/naming-boundary.test.ts` (To Implement — content anchors over help text, reference pages, and the delivered docs) + review checklist
**Tags**: @bun, @structure, @docs, @review

**Preconditions**:

- The rename phases have landed; root help and reference pages are delivered.

**Steps**:

1. Automated anchors: assert `repos` is described as the flat record set and `projects` as groups everywhere both names appear (root help entries, both reference pages, migration guide).
2. Assert no surface or doc states the pre-rename meaning (`projects` = flat record set) as current behavior.
3. Manual semantic review at the delivery gate: wording quality and boundary correctness where anchors cannot reach (per the review checklist), recorded in Section 10.

**Expected Outcome**:

- One naming boundary, stated consistently; zero pre-rename meaning claims left as current truth in delivered surfaces.

#### TC-GRPBOUND-002 - Permanent repository vocabulary unchanged (marker, container, host index, `--project-root`)

**Scenario Type**: Regression
**Impact Level**: Important
**Priority**: High
**Related IDs**: F-8, AC-F8-1, DoD-9, NG-8
**Test Type(s)**: Structural + content invariant
**Automation Level**: Automated
**Target Layer / Location**: `tests/structure/naming-boundary.test.ts` (To Implement), plus existing state-scope suites staying green (`tests/structure/projects-state-scope-policy.test.ts`)
**Tags**: @bun, @structure, @projects

**Preconditions**:

- Delivered tree after the rename phases.

**Steps**:

1. Assert the identity marker's semantics are untouched (create-once, same location/mode — existing marker suites stay green unchanged).
2. Assert the `<host root>/projects/<key>` container and the host index's `projects[]`/`projectKey` fields keep their repository meaning (host-index fixtures and their readers unchanged).
3. Assert the `--project-root` flag still denotes a repository checkout wherever it is declared.
4. Assert no state file, index entry, or store layout was renamed, rewritten, or moved by the change (spec §19: no data migration).

**Expected Outcome**:

- The permanent repository vocabulary survives the rename byte-for-byte in behavior; the boundary moved only the command/field names the rename rule names.

#### TC-GRPBOUND-003 - Changed-scope conformance: no M2-S19 mechanics, no board change, no alias retirement, no new adapter, no pre-flipped current-truth docs

**Scenario Type**: Negative
**Impact Level**: Important
**Priority**: High
**Related IDs**: DoD-14, C-5, C-6, NG-1..NG-8, DEC-1, DEC-3, DEC-4
**Test Type(s)**: Manual (review-time changed-file check)
**Automation Level**: Manual
**Target Layer / Location**: Review checklist (changed-file list of the PR against `main-tools`, at every delivery phase's gate)
**Tags**: @manual, @review

**Preconditions**:

- Feature branch `feat/GH-309/project-groups` cut from `main-tools`.

**Steps**:

1. At review time, list the change's files (`git diff --name-only <base>...HEAD`).
2. Assert none of the forbidden areas appear: no cross-repository change mechanics or queue-and-lane representation (NG-1/NG-2/DEC-4); no board surface change (NG-3/DEC-3); no alias retirement (NG-4); no new tracker adapter (NG-5); no state-layer, host-index, identity-marker, or envelope-shape rework (NG-8).
3. Assert current-truth feature specs are not pre-flipped in the delivery diff (C-6/DEC-1: they flip in phase 7).

**Expected Outcome**:

- The delivered diff stays inside §7.1; every exclusion of §7.2 holds.

**Notes / Clarifications**:

- Review-time by design: `.ai/rules/testing-strategy.md` forbids permanent suites from asserting branch diffs. This is DoD-14's verification ("every delivery phase's gate").

#### TC-GRPREG-001 - `repos` registered at the root listing with help entry and reference page

**Scenario Type**: Happy Path
**Impact Level**: Important
**Priority**: High
**Related IDs**: F-9, AC-F9-1, DoD-10
**Test Type(s)**: Integration (root help) + structural (composition)
**Automation Level**: Automated
**Target Layer / Location**: `tests/behaviour/projects-help.test.ts` pattern (Existing – Update or sibling To Implement: `repos-help` coverage); root-family composition test (Existing – Update: the composition suite pinning the root family set gains `repos`)
**Tags**: @bun, @behaviour, @structure, @help

**Preconditions**:

- The entrypoint delta has landed (prompt-set entry, edge composition, help entries, reference page).

**Steps**:

1. Run the root `--help`; assert `repos` appears as a registered root family alongside `projects` (family count grows by exactly one — the nineteenth observed families plus `repos`).
2. Assert `repos` carries its help entry and its reference page (per the delivered mounting pattern and the `check:help` reference-page requirement).
3. Assert the composition registers the `repos` family in the delivered mounting pattern (prompt-set entry, composition, help).

**Expected Outcome**:

- `repos` is reachable and discoverable at the root listing, with help and a reference page; the `check:help` gate stays green.

#### TC-GRPREG-002 - Migration guide speaks the delivered vocabulary; migration stays one-step operator-run

**Scenario Type**: Regression
**Impact Level**: Important
**Priority**: High
**Related IDs**: F-9, F-8, AC-F9-1, DoD-10
**Test Type(s)**: Content check (vocabulary anchors)
**Automation Level**: Automated
**Target Layer / Location**: `tests/structure/naming-boundary.test.ts` (To Implement), reading the per-repository state migration guide (`doc/guides/migrating-to-per-repository-state.md` per pm-notes phase 7 impacts)
**Tags**: @bun, @structure, @docs

**Preconditions**:

- The migration-guide update has landed (ticket derived task d).

**Steps**:

1. Assert the guide names the flat enumeration by its delivered name (`repos list`) and documents the group surface (`projects list`) and the alias (`projects list --flat`) — all three vocabulary items present, no pre-rename naming presented as current.
2. Assert the guide keeps stating that migration is one-step and operator-run (unchanged procedure, refreshed naming only).
3. Assert the superseding decision record and the alias are referenced as the transition path (Rsk-1 mitigation visibility).

**Expected Outcome**:

- The operator-facing transition documentation matches the delivered surfaces; no stale pre-rename vocabulary remains as current instruction.

#### TC-GRPDR-001 - Superseding decision record exists before rename code; registry row moves only with the code change

**Scenario Type**: Negative
**Impact Level**: Critical
**Priority**: High
**Related IDs**: F-10, AC-F10-1, DoD-11, C-3, DEC-2
**Test Type(s)**: Manual (register inspection + commit-order review at the delivery gate)
**Automation Level**: Manual
**Target Layer / Location**: Decision register (`doc/decisions/` index + record file) and the change branch's commit order; verified at the delivery gate
**Tags**: @manual, @review, @governance

**Preconditions**:

- Artifact phases complete; the superseding record authored via `@decision-advisor` (untracked at test-plan time by design).

**Steps**:

1. Inspect the decision register: the superseding decision record for the `repos` name exists (file + index row), supersedes the ODR-0003 row per DC-4, and predates every rename-code commit on the branch.
2. Review the commit order: no rename code (command move, field renames, alias, `repos.*` identities) lands before the record's commit; the registry `repos` row moves to Delivery in the same change as the code (DEC-2), never by a documentation-only edit.
3. Record the verdict in Section 10 and the pm-notes evidence; a failed inspection reopens the owning artifact/delivery phase (DoD framing rule 1).

**Expected Outcome**:

- The rename is lawful under ODR-0003 DC-4: superseding record first, code change with it, registry row moving only with both.

**Notes / Clarifications**:

- **Classified per the delegation as a review-time/manual evidence item, not an automated test**: the gating fact is a commit-order property of the delivery branch, which permanent suites cannot assert (testing-strategy invariant rules). This is the pre-delivery gate (DoD framing rule 1): a delivery phase that starts without the record fails this DoD.

#### TC-GRPGATE-001 - Aggregate gate `TMPDIR=$PWD/tmp/tmpdir pnpm check` green before the PR opens

**Scenario Type**: Regression
**Impact Level**: Critical
**Priority**: High
**Related IDs**: NFR-6, AC-NFR6-1, DoD-16, C-7
**Test Type(s)**: Gate battery (aggregate)
**Automation Level**: Automated
**Target Layer / Location**: Repository root — `TMPDIR=$PWD/tmp/tmpdir pnpm check` (lint → format:check → typecheck → test → boundaries → exports parity)
**Tags**: @gate, @ci

**Preconditions**:

- All implementation phases complete at the delivered HEAD.

**Steps**:

1. Run `TMPDIR=$PWD/tmp/tmpdir pnpm check` at the delivered HEAD before the PR opens.
2. Record the run and result in pm-notes `notes:` (DoD-16 evidence convention).
3. On failure: remediate in the named mode and re-run to green; an unresolved failure blocks the PR (never recorded as a pass).

**Expected Outcome**:

- The full gate battery is green at the delivered HEAD before the PR opens, recorded per pm-notes conventions.

## 6. Environments and Test Data

- **Environment:** local development only — pnpm + Bun workspace, no staging/CI-only surface. The gate convention is `TMPDIR=$PWD/tmp/tmpdir pnpm check` (pm-notes/DEC-7); suites isolate their own state via the fixture helpers' `APPROVED_BASE` (`tmp/tmpdir`) pattern and never touch `$HOME` or a real user state directory (state-fixture guard precedent in `tests/fixtures/projects/state-scope.ts`).
- **Test data — repositories:** temp git repositories built per case via `tests/fixtures/projects/temp-repos.ts` (`createRepository`, `createBareOrigin`, `seedOrigin`, `cloneRepository`, `addWorktree`); identity markers seeded/manipulated via `tests/fixtures/projects/markers.ts`; host fixtures and host-index readers via `host-root.ts`/`host-index.ts`; the production harness via `production.ts`. No network access; no live daemon — reachability states (`reachable`, `daemon-not-mounted`, `state-absent`, `socket-absent`, `socket-unreachable`) are produced by socket/state presence manipulation per the GH-288 reachability-suite precedent.
- **Test data — configuration documents:** written per case as fixture data (never named `*.test.ts`): valid two-member documents, mixed-tracker documents, contradictory variants (duplicate keys, selector violations), structurally broken YAML, empty `groups[]`, and absent-document cases. The `<configDirectoryName>` resolves through the brand-derived configuration directory (DEC-6) — suite assertions use the branding seam's working name, never a hardcoded product name.
- **Isolation strategy:** every case builds a scratch host root under the temp base; `snapshotTree`/`snapshotDifferences`/`hostRootFingerprint` provide the write-audit and unchanged-state baselines; no cross-case ordering dependencies (deterministic per `.ai/rules/typescript.md` §9). Cleanup removes the fixture tree per case.
- **Goldens:** the alias byte-compat golden (TC-GRPREN-003) is committed, normalized (no absolute paths, timestamps, or `runId`/`timing`), and regenerated only by an explicit command with review-visible diffs.

## 7. Automation Plan and Implementation Mapping

Proposed homes below; the implementation plan pins exact file names (this plan's assertion contracts bind regardless of placement). Execution during iteration: `bun test <path>`; final verification via TC-GRPGATE-001.

| TC ID | Test file (proposed) | Execution command | Mocking requirements | Status |
|-------|----------------------|-------------------|----------------------|--------|
| TC-GRPDOC-001..005 | `tests/behaviour/projects-config.test.ts` | `bun test tests/behaviour/projects-config.test.ts` | Fixture config documents; no `mock.module` (injected fakes only) | To Implement |
| TC-GRPWORK-001..003 | `tests/behaviour/projects-groups-list.test.ts` | `bun test tests/behaviour/projects-groups-list.test.ts` | Fixture repos/workspace via `tests/fixtures/projects/` helpers | To Implement |
| TC-GRPSURF-001..003, TC-GRPAGG-001, TC-GRPREN-004 | `tests/behaviour/projects-groups-list.test.ts` + `tests/structure/projects-groups-envelope.test.ts` | `bun test tests/behaviour/projects-groups-list.test.ts && bun test tests/structure/projects-groups-envelope.test.ts` | Reachability/state fixtures; normalized-envelope comparison | To Implement |
| TC-GRPAGG-002 | `tests/structure/projects-groups-envelope.test.ts` | `bun test tests/structure/projects-groups-envelope.test.ts` | Outcome-condition fixtures; closed-vocabulary assertion | To Implement |
| TC-GRPSREAD-001..002 | `tests/behaviour/queue-status-project-scope.test.ts` | `bun test tests/behaviour/queue-status-project-scope.test.ts` | Fixture queue/status content per member | To Implement |
| TC-GRPSREAD-003 | `tests/structure/naming-boundary.test.ts` (scan) + review confirmation | `bun test tests/structure/naming-boundary.test.ts` | None (tree scan) | To Implement + Manual step |
| TC-GRPREN-001..002 | `tests/behaviour/repos-list-contract.test.ts` + `tests/structure/error-table.test.ts` (update) | `bun test tests/behaviour/repos-list-contract.test.ts && bun test tests/structure/error-table.test.ts` | Failure-path fixtures (marker/registry/state) | To Implement; error-table rows Existing – Update |
| TC-GRPREN-003..005 | `tests/behaviour/projects-flat-alias.test.ts` | `bun test tests/behaviour/projects-flat-alias.test.ts` | Committed normalized golden of the delivered `projects.v1` shape | To Implement |
| TC-GRPENV-001 | `tests/structure/projects-groups-envelope.test.ts` | `bun test tests/structure/projects-groups-envelope.test.ts` | Envelopes captured from the behaviour harness runs | To Implement |
| TC-GRPRO-001 | `tests/behaviour/projects-read-only-audit.test.ts` | `bun test tests/behaviour/projects-read-only-audit.test.ts` | `snapshotTree`/`snapshotDifferences` host-root snapshots | To Implement (extends GH-288 audit pattern) |
| TC-GRPBOUND-001..002 | `tests/structure/naming-boundary.test.ts` | `bun test tests/structure/naming-boundary.test.ts` | Content anchors over help/reference/guide texts | To Implement |
| TC-GRPBOUND-003 | Review checklist (changed-file list) | `git diff --name-only <base>...HEAD` at the delivery gate | None | Manual Only |
| TC-GRPREG-001 | Root-help behaviour suite + root-family composition suite (update) | `bun test tests/behaviour/ && bun test tests/structure/` (targeted) | None (delivered entrypoint) | Existing – Update / To Implement (plan decides split) |
| TC-GRPREG-002 | `tests/structure/naming-boundary.test.ts` (guide anchors) | `bun test tests/structure/naming-boundary.test.ts` | None | To Implement |
| TC-GRPDR-001 | Decision register + commit-order inspection | Manual inspection at the delivery gate (record in Section 10 + pm-notes) | None | Manual Only |
| TC-GRPGATE-001 | Aggregate gate, repository root | `TMPDIR=$PWD/tmp/tmpdir pnpm check` | None | Existing gate — run, no new code |

## 8. Risks, Assumptions, and Open Questions

### 8.1 Risks

- **Alias golden drift (RSK-1/C-2):** the byte-compat golden could be "refreshed" into legitimizing drift. Mitigation: golden regeneration only via an explicit command, reviewed diffs, and TC-GRPREN-003's absence-negatives (no group fields in the alias payload) catching semantic drift even if a golden is regenerated carelessly.
- **Determinism assertion target confusion (NFR-3):** byte-identical applies to the **text** rendering; JSON envelopes legitimately vary in `runId`/`timing`. Mitigation: TC-GRPSURF-002 states the normalization explicitly so the suite does not over- or under-assert.
- **Ambient state pollution in the read-only audit:** a write escaping into a real user state directory would be invisible to a host-root-only snapshot. Mitigation: the state-fixture guard precedent (`guardStateFingerprint` pattern, `APPROVED_BASE`) asserting the real state directory's fingerprint is unchanged across audited runs.
- **OQ pinning drift (OQ-1/2/3):** the plan could pin resolutions that differ from this plan's asserted proposals. Mitigation: the reconciliation rule in Section 8.3/9 — a differing pin forces a revision-log entry and TC updates, never silent divergence.
- **Fixture complexity for aggregation outcomes:** `unregistered` (declared-but-absent checkout) and `state-unavailable` states must be produced without inventing behavior. Mitigation: outcomes are driven through delivered surface observations only; the exact `unregistered` rendering follows the plan's pinned aggregation contract (TC-GRPAGG-002 notes).

### 8.2 Assumptions

- The delivered GH-288 baseline (two-layer state scope, identity marker, host index, delivered `projects.v1` payload) remains stable through this change (spec §12) — the alias golden and the parity assertions depend on it.
- The fixture helper set in `tests/fixtures/projects/` (temp repos, markers, host fixtures, snapshots) is sufficient without new fixture infrastructure; any gap is a small extension of the existing helpers, not a new harness.
- Suite file names proposed in Section 7 are the homes; the implementation plan pins them. Assertion contracts are what bind.
- The board remains undelivered through this change, so TC-GRPSREAD-003 scans definitions/docs rather than exercising board behavior.
- Error-identity additions follow the registry-synced error contract (code table + registry updated together; the binding check stays green).

### 8.3 Open Questions

| ID | Question | Status | Owner |
|----|----------|--------|-------|
| OQ-1 | `groupKey` format/uniqueness constraints and duplicate-declaration handling | **Pinned at delivery planning.** This plan asserts the spec's proposed resolution (non-empty host-unique keys; duplicates and self-contradictory member declarations → `projects.config-invalid`; no new public key pattern) in TC-GRPDOC-001/002. A differing plan pin forces test-plan reconciliation via Section 9 | Plan-writer |
| OQ-2 | `projects list --flat --project <groupKey>` combination behavior | **Pinned at delivery planning.** This plan asserts the proposed resolution (mutually-exclusive refusal, exit 1) in TC-GRPREN-005 as expected behavior, flagged there. A differing plan pin (e.g., alias-wins) forces reconciliation | Plan-writer |
| OQ-3 | Member `health` value set on group entries | **Pinned at delivery planning.** This plan asserts the proposed resolution (closed health vocabulary declared with the group contract; `not-yet-supported` mandatory for unimplemented kinds) in TC-GRPAGG-002. A differing plan pin forces reconciliation | Plan-writer |
| TP-Q1 | Does the group surface / `--project` scoping extend to the delivered MCP scope? Repo truth has a projects MCP scope (`tests/behaviour/projects-scope-mcp.test.ts`), but spec §16 lists CLI families only and no AC claims MCP parity | Open — **non-blocking for this plan** (no TC covers MCP; none is required by any AC). The plan should pin the MCP-surface expectation; if it declares MCP scope, this test plan reconciles with added TCs | Plan-writer |
| TP-Q2 | Exact refusal identity for the OQ-2 combination refusal (a dedicated identity vs. a generic one) | Open — resolved by the plan's pinning of OQ-2; TC-GRPREN-005 asserts whichever identity the plan pins | Plan-writer |

## 9. Plan Revision Log

| Version | Date | Author | Changes |
|---------|------|--------|---------|
| 1.0 | 2026-11-14 | test-plan-writer (GLM-5.3-Flash) | Initial test plan: 30 TCs across 12 families covering all sixteen §17 ACs, DoD-1..DoD-17 (DoD-15 roll-up, DoD-17 lifecycle), DM-1..DM-5, NFR-1..NFR-7 (NFR-7 as gate evidence), the eight inherited scenario seeds SC-M2-S18-01..08 (by name), OQ-1..OQ-3 asserted at proposed resolutions pending plan pinning, and two review-time gates (decision record, scope conformance) per testing-strategy invariant rules |
| 1.1 | 2026-11-14 | test-plan-writer (GLM-5.3-Flash) | Plan pins reconciled per §9 rule — OQ-3 health vocabulary EXTENDED (concretization, not divergence): the plan pins the closed member `health` value set as `healthy \| degraded \| state-unavailable \| not-yet-supported \| unregistered`. Mapping to the DM-5 aggregation outcomes: the three non-`observed` outcomes map to same-named health values; `observed` splits into `healthy`/`degraded`; the fifth value (`unregistered`) extends the pack example because TC-GRPAGG-002 requires unregistered members to stay classified in `members[]`. The health-asserting TCs (TC-GRPAGG-002, TC-GRPSURF-001, TC-GRPSURF-002, TC-GRPSURF-003) already align — no TC rewrite; contract tests pin exactly this set |
| 1.2 | 2026-11-14 | test-plan-writer (GLM-5.3-Flash) | Plan pins reconciled per §9 rule — OQ-2/TP-Q2 refusal identity PINNED: `projects list --flat` combined with `--project <groupKey>` is mutually exclusive and refused at exit 1 under the shared delivered user-validation identity `input.value.rejected`; no new `projects.*` identity is invented for the grammar refusal. TC-GRPREN-005 asserted the refusal behavior; the expected error identity is recorded as `input.value.rejected` and the test asserts the identity too (assertion extension carried by this row; no TC/coverage row rewritten in this pass) |
| 1.3 | 2026-11-14 | test-plan-writer (GLM-5.3-Flash) | OQ-1 pinned exactly as this plan's TCs already assert: non-empty, host-unique `groupKey`; duplicates and the four self-contradictory member declaration cases → `projects.config-invalid`. No TC change needed; logged for completeness |
| 1.4 | 2026-11-14 | test-plan-writer (GLM-5.3-Flash) | TP-Q1 (MCP parity) resolved by PM — closed: no MCP parity work in this change; `tests/behaviour/projects-scope-mcp.test.ts` is state-root parity only. Consistent with §1.2 (no TC covers MCP because no AC claims it); logged so the DoR gate sees the open question closed |

**Reconciliation rule:** when the implementation plan pins OQ-1/OQ-2/OQ-3, names the suite files, or declares MCP scope (TP-Q1) differently from this plan's asserted expectations, this test plan MUST be revised (new row above; affected TCs updated) before the DoR gate passes — never left to drift silently.

## 10. Test Execution Log

Populated during delivery (phases 6/9/10). Review-time items and the gate are logged here and mirrored into phase pm-notes `notes:` evidence per DoD conventions.

| TC ID | Run Date | Result | Notes |
|-------|----------|--------|-------|
| — | — | — | No executions yet; plan authored at phase 3 (test_planning) |
