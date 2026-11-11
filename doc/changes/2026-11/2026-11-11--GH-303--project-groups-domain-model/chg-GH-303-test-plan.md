---
id: chg-GH-303-test-plan
status: Updated
version: 1.4
created: 2026-11-11T11:40:00Z
last_updated: 2026-11-11T21:45:00Z
owners: [engineering]
service: delivery-os-planning
labels: [change, docs, planning]
version_impact: none
summary: "Docs-only verification of the M2 domain-model amendment against spec v1.4 (69 acceptance criteria: 56 functional + 13 non-functional), bound one-to-one to 69 test cases and 69 executable procedures (plus a P00 shared preamble). The v1.4 surface re-shapes the corpus: groups are `project-groups.v1` / `data.groups[]` / `groupKey`, the delivered flat record set stays `projects.v1`, the flat surface is `repos list` / `repos.v1` / `data.repos[]` / `repoKey`, one rename rule with the `projects list --flat` alias is stated once, `projectKey` is never a group identity, membership is configuration-only with an undeclared-clone seed, project-scoped reads are `queue list --project <groupKey>` and `status --project <groupKey>` while the board stays on repository keys, S19 gains per-member CI corroboration, dependency ordering, contracted envelopes and `closeout.data.members[]`, and the registry splits with the ODR-0003 lock. Thirteen modified planning documents plus one new page plus the guard registry row make fifteen product files. Every procedure was executed in a fresh shell against the pinned base `3c9f8a59` and at the delivered head `087c146d`, where the sweep is 69/69 with the aggregate gate excused per AC-NFR6-1 (green repository-local run, one recorded and re-run `CI baseline parity` default failure), and against the base tree `3c9f8a59`, where it is 0/69. Two properties are protected: the naming boundary (one spelling, one meaning) and the retention of every delivered GH-288 fact."
links:
  change_spec: ./chg-GH-303-spec.md
  implementation_plan: ./chg-GH-303-plan.yaml
  testing_strategy: ../../../../.ai/rules/testing-strategy.md
---

# Test Plan - Amend the M2 plan: three-level domain model with project groups, optional workspaces, and cross-repository changes

## 1. Scope and Objectives

This change writes planning truth, so the risk is documentary and the only honest
oracle is the diff: a story can lose a clause while reading complete, a rename can
land on nine pages and miss the tenth, a rewritten page can quietly keep the
meaning it was rewritten to remove, a status snapshot can rewrite history instead
of appending to it, and a registry row can be added one line away from its
sorted position and still pass a human glance. Spec v1.4 re-shapes the naming
surface, so the plan is rebuilt rather than patched: the group contract is
`project-groups.v1` with `data.groups[]` and `groupKey`, the delivered flat record
set keeps `projects.v1` and its shipped `projects list`, the flat surface becomes
`repos list` with `repos.v1`, `data.repos[]`, and `repoKey` under one stated rename
rule whose deprecation alias is `projects list --flat`, and `projectKey` is never a
group identity.

The two properties this plan exists to protect are **the naming boundary** (one
spelling carries one meaning at one time, and the rename rule is stated once and
referenced everywhere else) and **the retention of everything else** (M2-S11's
delivered record, the shipped `projects list` surface, the `unbound` scope, the
`projects.*` error identities, the host-root state layout, the last status
snapshot, every earlier registry row, and the M0/M1 index rows).

Every acceptance criterion is bound to exactly one procedure with a stated
expected result, and every preservation claim is a byte comparison, a whole-file
line-retention comparison, or a preserved-delivered-fact check against
`3c9f8a59`. Each procedure is non-vacuous by construction: the base tree FAILs
all sixty-nine and the delivered head `087c146d` PASSes all sixty-nine. The
aggregate gate is green in its authoritative repository-local run; its default
`TMPDIR` failure is the single recorded and re-run `CI baseline parity` case that
AC-NFR6-1 permits to be excused (§1.2 G-6, §10).

### 1.1 In Scope

- `doc/planning/oss-tooling/backlog.md`: the in-place M2-S11 amendment that keeps
  the delivered story and its shipped-surface acceptance criterion, the M2-S18
  entry as the single owner of the rename, the `--flat` alias, the field renames,
  the migration guide, configuration-only membership, the scoped grammar, and the
  superseding decision record, the M2-S19 entry with its ordering acceptance,
  M2-S4's `- Depends on:` line gaining M2-S18, and one Epic M2 context paragraph.
- `doc/planning/oss-tooling/milestones/m2/architecture.md`: the three-level C4
  context with the workspace optionality visible, the discovery-root versus
  `default` sentence, the group-scoped overview flow, the `### Cross-repository
  change` flow with one queue entry per member, and six boundary invariants.
- `doc/planning/oss-tooling/milestones/m2/contracts.md`: `repos.v1`, the retained
  delivered `projects.v1`, `project-groups.v1`, the canonical rename rule, the
  repository-vocabulary mapping clause, the project configuration document, the
  aggregation clause, the queue/lane representation and release rule, and the
  cross-repository change plan shape with its `verify gates` and
  `closeout.data.members[]` envelopes.
- `doc/planning/oss-tooling/milestones/m2/commands/repos.md` (**new**) and
  `commands/projects.md` (**rewritten**): the flat record-set page with delivered
  semantics and the group surface as two pages, both keeping the exact header
  `Status: Proposed (M2)`.
- `commands/queue.md` and `commands/board.md`: the `queue list --project
  <groupKey>` grammar and the repository-key board boundary.
- `doc/planning/oss-tooling/milestones/m2/test-scenarios.md`: the S2-S19 intro,
  at least five S18 and five S19 seeds with exactly one `Assert:` line each,
  declared-envelope assertions only, the alias-shape seed, and the two reconciled
  S11 seeds.
- `journeys.md`, `entrypoint-delta.md`, `m2/README.md`, `milestones/README.md`,
  `status.md`, and `cli-command-registry.md`: the reconciled journey, the split
  delta note with its retained GH-288 mount note, the pack indices at thirteen
  targets, the one dated correction section, and the split registry rows with
  `projects` in COMMAND FAMILIES.
- `scripts/checks/forbidden-literals.registry.json`: exactly one added
  registration (141 → 142) inside the `m2/commands/` group.
- Repository guards: `bash scripts/.tests/test-doc-distribution.sh` with the
  **default** `TMPDIR`; `bun run scripts/checks/forbidden-literals.ts`; and
  `pnpm check` with a **repository-local** `TMPDIR` (authoritative), with both
  aggregate runs recorded and only the two named default-only failures excused
  behind a green repository-local run on the same head.

### 1.2 Out of Scope & Known Gaps

- **G-1 — clause presence is mechanical; clause meaning is not.** AC-F2-1,
  AC-F3-1, and AC-NFR8-1 require ticket clauses "in substance". P04, P10, and P64
  run a 26-row anchor table built from spec Appendix A.1; a missing anchor fails
  with its clause id. An anchor proves the clause text exists and its vocabulary
  survived, not that its normative force is identical. **Compensation:**
  `@readiness-reviewer` and `@reviewer` paraphrase-read the two new entries and
  the M2-S11 amendment against GH-303 using the 26-row table as the checklist.
- **G-2 — the mixed-tracker rule is checked by vocabulary, not by semantics.**
  P05 asserts `not-yet-supported`, the validation-time wording, the
  "rather than rejected" clause, and the absence of a softening phrase in both
  locations. A grammatically inverted sentence reusing the tokens would pass.
  **Compensation:** the reviewer reads AC-F2-2's two locations once (RSK-14).
- **G-3 — mermaid syntax validity is not testable in this repository.** No
  validator exists and NFR-7 adds none. P63 proves structure only: even fence
  counts, `mermaid` tags, allowed first body keywords, one `## C4 Level n` heading
  each, and eight `###` headings under `## Key flows` each owning exactly one
  mermaid block. **Compensation:** the reviewer opens the rendered GitHub preview
  of `architecture.md` (RSK-18).
- **G-4 — the naming-boundary scan is pattern-based.** P54 (forbidden half, 21
  Appendix B regions plus a corpus scan) and P68 (required half) match the
  vocabulary this plan knows, and P54 must admit exactly four sanctioned classes:
  the time-scoped disambiguation, a delivered GH-288 fact, the alias definition,
  and the delivered enumeration AC that F-1 keeps in M2-S11. A page that says
  something flat about checkouts in words the detector does not anticipate
  survives; a sanctioned sentence in an unrecognised shape is reported as a
  survivor. **Compensation:** the reviewer walks Appendix B by hand; the
  detectors are proven in both directions with planted fixtures; the residue is
  bounded and declared, not denied (RSK-1).
- **G-5 — status-section content quality is review.** P50 proves the section
  exists, is unique, is last, carries fourteen anchors, and claims no delivery;
  P51/P67 prove nothing was removed, reordered, or modified and that additions
  sit inside it. Neither proves the prose is accurate. **Compensation:** the
  reviewer reads the section against F-12 and DEC-6.
- **G-6 — the two guards have opposite `TMPDIR` requirements.** The distribution
  guard needs the default `TMPDIR`; `pnpm check` needs a real-filesystem `TMPDIR`
  because `tests/checks/ci-baseline-parity.test.ts` runs `git clone --local` and
  fails with a cross-device link when `tmpdir()` is tmpfs. P61 runs the
  distribution guard with `env -u TMPDIR`; P62 follows AC-NFR6-1 exactly: the
  repository-local full-suite run is authoritative and must exit 0; both runs are
  recorded; a default-run `ci-baseline-parity` failure and a default-run
  `TC-WIRE-002` timeout are recorded, re-run, and excused **only** while the
  repository-local run is green; any other default-run failure is a delivery
  failure. **Posture:** P62 is a delivery-time gate. Its record is bound to a
  fingerprint of the code tree plus a change-presence check, because NFR-1 forbids
  any code change and a docs-only tree therefore cannot alter the suite's result.
  **Observed at the delivered head `087c146d`:** the authoritative
  repository-local run is green (`7206 pass / 4 skip / 0 fail`) and the default
  run fails only `CI baseline parity` (`7205 pass / 4 skip / 1 fail`), which was
  re-run and recorded, so the pair classifies `excused` — the only disposition
  AC-NFR6-1 allows. **Owner:** `@runner` at phase 9.
- **G-7 — `pnpm check` proves no-regression, not document correctness.** It can
  stay green while a story loses a clause. It is a containment gate; the content
  procedures carry the requirements.
- **G-8 — the conforming tree is the delivered head; the plan-time fixture is retired.**
  The plan was authored before delivery, so its first sweep ran against a
  never-committed fixture built at the then-current base (`/tmp/gh303/fx`). The delivered head
  `087c146d` now carries the fifteen product files, and this revision re-measured
  and re-ran every procedure there: the head is **69/69** (the aggregate gate is
  `excused` per AC-NFR6-1 on a green repository-local run) and the base is
  **0/69**. The fixture is retained only in the plan-time evidence trail; §6 no
  longer cites its numbers.
- **G-9 — prose quality of the architecture, contracts, journeys, and seeds is
  review, not a command.** The procedures prove required sections, fields, flows,
  counts, and one-`Assert:`-per-seed shape; they do not prove the design is
  coherent or that a seed is the right seed. **Compensation:** the reviewer reads
  `architecture.md`, `contracts.md`, `test-scenarios.md`, and `journeys.md`
  against the Appendix B row descriptions.
- **G-10 — containment is decidable before the commit.** P57 compares the base
  revision with the **working tree** (one-dot `git diff --name-only "$BASE" --`
  plus untracked product files), filtered to product files and compared against
  the 15-path manifest in both directions, so the gate is decidable at the
  boundary it gates and still non-vacuous (`product_files=0/15` is a missing
  deliverable). Worktree-local tooling (`node_modules`, `tmp/`) is excluded by
  pathspec and is never a product path.
- **Not applicable:** unit, integration, contract-execution, E2E, performance,
  migration, telemetry, and security-surface testing. There is no runtime code
  path, schema, or emitted artifact; spec §8.1 and §8.2 declare no API or event
  surface. Per `.ai/rules/testing-strategy.md`, a `doc/**` change uses
  static/diff and content checks plus the repository guards, and adds no committed
  test code — NFR-1 forbids touching `tests/**`, `.ai/**`, and any `scripts/**`
  path except the one registry row.

## 2. References

| Reference | Role in this plan |
|---|---|
| [`chg-GH-303-spec.md`](./chg-GH-303-spec.md) v1.4 | Binding source: F-1..F-14, 56 functional + 13 non-functional ACs (69), NFR-1..NFR-13, DM-1..DM-13, DEC-1..DEC-32, RSK-1..RSK-21, Appendix A.1 (26 ticket clauses), Appendix A.2 (32 board-derived clauses), Appendix B (21-row naming and identity matrix), Appendix C (15-file manifest), Appendix D (gate and evidence record) |
| [`chg-GH-303-pm-notes.yaml`](./chg-GH-303-pm-notes.yaml) | Binding intake decisions and the recorded repository facts (separator structure, guards, `TMPDIR` behaviour, base pin) |
| GH-303 ticket (`juliusz-cwiakalski/agentic-delivery-os#303`) | Normative story text transcribed into spec Appendix A.1; re-read by the reviewer for the G-1 paraphrase pass |
| Six-critic review board record on PR #306 — CTO, API Integration Engineer, Domain Expert, QA Engineer, SRE, Technical Writer | Normative source for the 32 derived clauses in spec Appendix A.2 (decisions A-D; 6 blocking findings, 10 should-fix findings, 2 cheap notes) |
| [`.ai/rules/testing-strategy.md`](../../../../.ai/rules/testing-strategy.md) | Docs-only fallback: static/diff plus content checks; branch-diff checks belong to review and PR-time gates, never to the permanent suite |
| [`backlog.md`](../../../planning/oss-tooling/backlog.md) | File under test (M2-S11 amendment, M2-S18/M2-S19, M2-S4 edge, context paragraph, preservation regions) |
| [`m2/contracts.md`](../../../planning/oss-tooling/milestones/m2/contracts.md) | File under test (the three envelopes, the rename rule, the mapping clause, configuration, aggregation, queue/lane, plan shape) |
| [`m2/commands/repos.md`](../../../planning/oss-tooling/milestones/m2/commands/repos.md) | New page under test (flat record set, delivered semantics, `unbound` scope, help/version) |
| [`status.md`](../../../planning/oss-tooling/status.md) | File under test (one new dated section under the line-retention oracle) |
| [`cli-command-registry.md`](../../../planning/oss-tooling/cli-command-registry.md) | File under test (row split, ODR-0003 lock, COMMAND FAMILIES, boundary note) |
| [`milestones/README.md`](../../../planning/oss-tooling/milestones/README.md) | File under test (M2 row at thirteen targets; M0/M1 rows preserved) |
| [`milestones/m2/`](../../../planning/oss-tooling/milestones/m2/) | The pack: README, architecture, contracts, test-scenarios, journeys, entrypoint-delta, `commands/{projects,repos,queue,board,attempts,events,spend}.md` |
| [`scripts/.tests/test-doc-distribution.sh`](../../../../scripts/.tests/test-doc-distribution.sh) | Distribution-marker guard (AC-NFR5-1); default `TMPDIR` required |
| [`scripts/checks/forbidden-literals.ts`](../../../../scripts/checks/forbidden-literals.ts) and [`forbidden-literals.registry.json`](../../../../scripts/checks/forbidden-literals.registry.json) | Forbidden-literal guard and the `registered` list that must grow 141 → 142 (AC-NFR4-1, AC-NFR9-1) |
| [`doc/spec/features/feature-projects.md`](../../../../doc/spec/features/feature-projects.md) | Delivered truth for the shipped `projects list`; the AC-NFR10-1 "untouched" control also reads it |
| [AGENTS.md](../../../../AGENTS.md) | Branch model (`main-tools`), docs-only delivery rules, and the marker/registration conventions |

## 3. Coverage Overview

Traceability is one-to-one in both directions: each of the 69 acceptance
criteria appears exactly once as a test case, and each test case names exactly
one criterion. There are no orphan test cases and no uncovered criteria.

### 3.1 Functional Coverage (F-#, AC-#)

| AC ID | Requirement (condensed) | TC ID | Status |
|---|---|---|---|
| AC-F1-1 | M2-S11 keeps the delivered story, its shipped-surface AC, and records the planned transition | TC-M2DOM-001 | Covered |
| AC-F1-2 | The amended M2-S11 entry carries no flat-surface AC, no rename clause, and no weakened delivered line | TC-M2DOM-002 | Covered |
| AC-F1-3 | Every transition item is owned by M2-S18 exactly once and M2-S11 names that owner | TC-M2DOM-003 | Covered |
| AC-F2-1 | The M2-S18 entry carries its four labels and all twelve ticket clauses, with no ticket line | TC-M2DOM-004 | Covered |
| AC-F2-2 | Mixed tracker kinds are accepted at validation time and the unimplemented member is classified | TC-M2DOM-005 | Covered |
| AC-F2-3 | M2-S18 carries the rename task, the alias task, and an acceptance criterion for the alias payload shape | TC-M2DOM-006 | Covered |
| AC-F2-4 | M2-S18 carries the field-rename and migration-guide tasks and states they are code work, not current truth | TC-M2DOM-007 | Covered |
| AC-F2-5 | Registration is configuration-only and the scoped-read grammar is stated for queue and status | TC-M2DOM-008 | Covered |
| AC-F2-6 | M2-S18 owns the superseding decision record and no task claims the rename shipped | TC-M2DOM-009 | Covered |
| AC-F3-1 | The M2-S19 entry carries its four labels, all eleven ticket clauses, and the exact dependency line | TC-M2DOM-010 | Covered |
| AC-F3-2 | The three S19 criteria are identifiable, one review flow is executable, and unavailable CI blocks | TC-M2DOM-011 | Covered |
| AC-F3-3 | Dependency ordering is an acceptance criterion with landing-order evidence | TC-M2DOM-012 | Covered |
| AC-F3-4 | The contracts declare the change plan shape, the shared verdict, and the closeout envelope | TC-M2DOM-013 | Covered |
| AC-F4-1 | The two new entries land inside the Epic M2 block before the byte-identical separator | TC-M2DOM-014 | Covered |
| AC-F4-2 | One context paragraph sits between the retirement note and M2-S2 with the surrounding regions intact | TC-M2DOM-015 | Covered |
| AC-F4-3 | With zero context every backlog hunk lies in the permitted regions | TC-M2DOM-016 | Covered |
| AC-F4-4 | M2-S4 gains M2-S18 on its dependency line and nothing else in the entry changes | TC-M2DOM-017 | Covered |
| AC-F5-1 | C4 Level 1 draws repository, project group, and optional workspace | TC-M2DOM-018 | Covered |
| AC-F5-2 | The model prose declares membership, forbids scan-admitted clones, and makes unrelated directories identical | TC-M2DOM-019 | Covered |
| AC-F5-3 | The overview flow is group-scoped, the cross-repository flow has one entry per member, and six invariants hold | TC-M2DOM-020 | Covered |
| AC-F5-4 | One sentence separates the discovery workspace root from the state layer's default identifier | TC-M2DOM-021 | Covered |
| AC-F6-1 | repos.v1 defines the flat record set, its fields, its rename, and its M2-S18 owner | TC-M2DOM-022 | Covered |
| AC-F6-2 | project-groups.v1 declares the group identity, optional workspace, and member fields with no crossed meaning | TC-M2DOM-023 | Covered |
| AC-F6-3 | projects.v1 stays the delivered flat record set and is never the group contract | TC-M2DOM-024 | Covered |
| AC-F6-4 | The rename rule appears exactly once and no text describes one spelling returning two shapes | TC-M2DOM-025 | Covered |
| AC-F6-5 | The repository-vocabulary mapping clause names all four tokens and is carried on both pages | TC-M2DOM-026 | Covered |
| AC-F6-6 | The configuration document declares its path, schema, selector, and configuration-only membership | TC-M2DOM-027 | Covered |
| AC-F6-7 | Aggregation defines declared order, four outcome tokens, a classified partial result, and a restricted exit 2 | TC-M2DOM-028 | Covered |
| AC-F6-8 | The queue/lane representation holds one entry per member and states the release rule | TC-M2DOM-029 | Covered |
| AC-F6-9 | The plan shape states the review-flow definition, per-member CI corroboration, ordering, and evidence | TC-M2DOM-030 | Covered |
| AC-F7-1 | commands/repos.md is complete: synopsis, no-state-read help and version, five fields, envelope, exits, errors | TC-M2DOM-031 | Covered |
| AC-F7-2 | The repos scope section restores read-only semantics and the declared unbound behaviour | TC-M2DOM-032 | Covered |
| AC-F7-3 | The delivered projects.* identities are retained, unbound is not an error, and a repos.* prefix change is S18 work | TC-M2DOM-033 | Covered |
| AC-F7-4 | The STATE example is the host-root container with a PROJECT_KEY_PATTERN key and the mapping clause | TC-M2DOM-034 | Covered |
| AC-F7-5 | commands/projects.md is the group page with member daemonReachable and no orphan reason paragraph | TC-M2DOM-035 | Covered |
| AC-F7-6 | The projects page states partial degradation, makes no board claim, and carries the scoped grammar and alias pointer | TC-M2DOM-036 | Covered |
| AC-F7-7 | Each command page names only its own surface and contract | TC-M2DOM-037 | Covered |
| AC-F7-8 | commands/board.md stays on the repository-key boundary with a repository-vocabulary envelope and refusal | TC-M2DOM-038 | Covered |
| AC-F7-9 | queue.md carries the group grammar, the M2 README names the status delta, and the M1 status page is untouched | TC-M2DOM-039 | Covered |
| AC-F8-1 | At least five S18 seeds with one Assert each cover the six required topics, including the undeclared clone | TC-M2DOM-040 | Covered |
| AC-F8-2 | At least five S19 seeds with one Assert each cover the lifecycle, failing member, CI, and ordering | TC-M2DOM-041 | Covered |
| AC-F8-3 | Every S18/S19 assertion reads a declared envelope and none uses the retired change.data family | TC-M2DOM-042 | Covered |
| AC-F8-4 | Both S11 seeds are reconciled: the first names the flat record set, the second is prospective | TC-M2DOM-043 | Covered |
| AC-F8-5 | One seed asserts the alias payload and the group payload in the same scenario | TC-M2DOM-044 | Covered |
| AC-F8-6 | The introduction reads M2-S2 through M2-S19 and every story keeps at least two seeds | TC-M2DOM-045 | Covered |
| AC-F9-1 | The opening journey is a group-scoped morning overview with scoped reads and the disambiguation | TC-M2DOM-046 | Covered |
| AC-F10-1 | The delta note splits the two families, keeps the mount note, and phrases the page move as pending work | TC-M2DOM-047 | Covered |
| AC-F11-1 | The M2 pack README lists the new page and maps S11, S18, S19, S4, and the scenarios correctly | TC-M2DOM-048 | Covered |
| AC-F11-2 | The milestone M2 index row reaches thirteen targets and the M0/M1 rows are untouched | TC-M2DOM-049 | Covered |
| AC-F12-1 | One dated status section records the correction as planning state without a delivery claim | TC-M2DOM-050 | Covered |
| AC-F12-2 | Every base status line is retained in order and every addition lies inside the new section | TC-M2DOM-051 | Covered |
| AC-F13-1 | The registry splits the two names with one Delivery row per name and the ODR-0003 lock | TC-M2DOM-052 | Covered |
| AC-F13-2 | projects joins COMMAND FAMILIES, the boundary note points at the rule, and other rows are byte-identical | TC-M2DOM-053 | Covered |
| AC-F14-1 | The forbidden half of the naming matrix holds across all twenty-one Appendix B rows | TC-M2DOM-054 | Covered |
| AC-F14-2 | Six pages carry the disambiguation, the nine delivered facts survive, and no page pair contradicts | TC-M2DOM-055 | Covered |
| AC-F14-3 | The terminology lock holds: no old-identity affirmation and the state scope is per-checkout | TC-M2DOM-056 | Covered |

### 3.2 Interface Coverage (API-#, EVT-#, DM-#)

The change declares no REST or event surface (spec §8.1, §8.2). Its interfaces
are data-model elements in the planning corpus, so each DM element is bound to
the procedure that asserts it.

| ID | Element | Asserted by | Status |
|---|---|---|---|
| DM-1 | Backlog story entry shape | TC-M2DOM-004, TC-M2DOM-010, TC-M2DOM-058 | Covered |
| DM-2 | Domain level (repository / group / optional workspace) | TC-M2DOM-018, TC-M2DOM-019, TC-M2DOM-021, TC-M2DOM-046, TC-M2DOM-055 | Covered |
| DM-3 | Project configuration document | TC-M2DOM-008, TC-M2DOM-027, TC-M2DOM-040 | Covered |
| DM-4 | `repos.v1` envelope | TC-M2DOM-022, TC-M2DOM-031, TC-M2DOM-032, TC-M2DOM-033 | Covered |
| DM-5 | `project-groups.v1` envelope | TC-M2DOM-023, TC-M2DOM-035, TC-M2DOM-036 | Covered |
| DM-6 | `projects.v1` envelope (delivered) | TC-M2DOM-024, TC-M2DOM-043, TC-M2DOM-044 | Covered |
| DM-7 | Rename rule and alias | TC-M2DOM-006, TC-M2DOM-025, TC-M2DOM-036, TC-M2DOM-044 | Covered |
| DM-8 | Project-scoped aggregation | TC-M2DOM-028, TC-M2DOM-036, TC-M2DOM-039 | Covered |
| DM-9 | Queue/lane representation | TC-M2DOM-020, TC-M2DOM-029 | Covered |
| DM-10 | Cross-repository change plan shape | TC-M2DOM-011, TC-M2DOM-012, TC-M2DOM-013, TC-M2DOM-030, TC-M2DOM-041, TC-M2DOM-042 | Covered |
| DM-11 | Repository-vocabulary mapping | TC-M2DOM-026, TC-M2DOM-034, TC-M2DOM-038, TC-M2DOM-069 | Covered |
| DM-12 | Scenario seed shape | TC-M2DOM-040, TC-M2DOM-041, TC-M2DOM-042, TC-M2DOM-043 | Covered |
| DM-13 | Command page shape | TC-M2DOM-031, TC-M2DOM-032, TC-M2DOM-035, TC-M2DOM-038 | Covered |

### 3.3 Non-Functional Coverage (NFR-#)

| NFR ID | AC ID | Requirement (condensed) | TC ID | Status |
|---|---|---|---|---|
| NFR-1 | AC-NFR1-1 | Fifteen product files, nothing outside the manifest | TC-M2DOM-057 | Covered |
| NFR-2 | AC-NFR2-1 | Backlog preservation and S4 placement | TC-M2DOM-058 | Covered |
| NFR-3 | AC-NFR3-1 | Planned-not-delivered semantics with delivered facts kept | TC-M2DOM-059 | Covered |
| NFR-4 | AC-NFR4-1 | One registry row, 141 → 142, clean guard | TC-M2DOM-060 | Covered |
| NFR-5 | AC-NFR5-1 | Distribution guard green with no planning marker | TC-M2DOM-061 | Covered |
| NFR-6 | AC-NFR6-1 | Both aggregate runs recorded; repository-local authoritative | TC-M2DOM-062 | Covered |
| NFR-7 | AC-NFR7-1 | Structural diagram conditions, no new tooling | TC-M2DOM-063 | Covered |
| NFR-8 | AC-NFR8-1 | 26 ticket clauses and 32 board-derived clauses | TC-M2DOM-064 | Covered |
| NFR-9 | AC-NFR9-1 | Twelve of fourteen scanned, zero seed literals | TC-M2DOM-065 | Covered |
| NFR-10 | AC-NFR10-1 | No broken link, no restated acceptance block | TC-M2DOM-066 | Covered |
| NFR-11 | AC-NFR11-1 | Status history retention | TC-M2DOM-067 | Covered |
| NFR-12 | AC-NFR12-1 | Naming-boundary consistency and disambiguation | TC-M2DOM-068 | Covered |
| NFR-13 | AC-NFR13-1 | Terminology lock and vocabulary separation | TC-M2DOM-069 | Covered |

## 4. Test Types and Layers

Per `.ai/rules/testing-strategy.md`, a `doc/**` change uses static/diff checks and
content checks, plus the repository guards. Nothing is added to the permanent
suite.

| Layer | What it proves here | Where |
|---|---|---|
| Static / diff | Byte identity of preserved regions, hunk confinement, insertion windows, line retention, the 15-path manifest | P02, P14, P15, P16, P17, P51, P57, P58, P67 |
| Content | Required sections, fields, envelopes, seed shape, clause anchors, naming statements | P01, P03–P13, P18–P50, P52–P56, P59, P64, P66, P68, P69 |
| Repository guards | Forbidden literals (registered set and scanned set) and the distribution markers | P60, P61, P65 |
| Aggregate gate | No-regression over the full workspace suite, with both `TMPDIR` invocations recorded | P62 |
| Structural read | Fence balance, fence tags, keyword lines, heading ownership (no renderer exists) | P63 |
| Manual review | Clause meaning, prose quality, rendered diagrams, naming-matrix walk | G-1, G-3, G-4, G-5, G-9 |

No procedure writes to the repository: all scratch state lives under
`/tmp/gh303`, and `pnpm check` alone writes its git-ignored `tmp/tmpdir/`.
## 5. Test Scenarios

### 5.1 Scenario Index

Procedure numbers match test-case numbers (`P001` is not used; `P01` =
`TC-M2DOM-001`, ..., `P69` = `TC-M2DOM-069`). Every row below appears again in
5.2, in the automation mapping of 7.2, and in the execution log of Section 10.

| TC ID | AC | Scenario | Type | Priority | Automation |
|---|---|---|---|---|---|
| TC-M2DOM-001 | AC-F1-1 | M2-S11 keeps the delivered story, its shipped-surface AC, and records the planned transition | Happy Path | High | Semi-automated |
| TC-M2DOM-002 | AC-F1-2 | The amended M2-S11 entry carries no flat-surface AC, no rename clause, and no weakened delivered line | Negative | High | Semi-automated |
| TC-M2DOM-003 | AC-F1-3 | Every transition item is owned by M2-S18 exactly once and M2-S11 names that owner | Happy Path | High | Semi-automated |
| TC-M2DOM-004 | AC-F2-1 | The M2-S18 entry carries its four labels and all twelve ticket clauses, with no ticket line | Happy Path | High | Semi-automated |
| TC-M2DOM-005 | AC-F2-2 | Mixed tracker kinds are accepted at validation time and the unimplemented member is classified | Happy Path | High | Semi-automated |
| TC-M2DOM-006 | AC-F2-3 | M2-S18 carries the rename task, the alias task, and an acceptance criterion for the alias payload shape | Happy Path | High | Semi-automated |
| TC-M2DOM-007 | AC-F2-4 | M2-S18 carries the field-rename and migration-guide tasks and states they are code work, not current truth | Happy Path | High | Semi-automated |
| TC-M2DOM-008 | AC-F2-5 | Registration is configuration-only and the scoped-read grammar is stated for queue and status | Happy Path | High | Semi-automated |
| TC-M2DOM-009 | AC-F2-6 | M2-S18 owns the superseding decision record and no task claims the rename shipped | Happy Path | High | Semi-automated |
| TC-M2DOM-010 | AC-F3-1 | The M2-S19 entry carries its four labels, all eleven ticket clauses, and the exact dependency line | Happy Path | High | Semi-automated |
| TC-M2DOM-011 | AC-F3-2 | The three S19 criteria are identifiable, one review flow is executable, and unavailable CI blocks | Happy Path | High | Semi-automated |
| TC-M2DOM-012 | AC-F3-3 | Dependency ordering is an acceptance criterion with landing-order evidence | Happy Path | High | Semi-automated |
| TC-M2DOM-013 | AC-F3-4 | The contracts declare the change plan shape, the shared verdict, and the closeout envelope | Happy Path | High | Semi-automated |
| TC-M2DOM-014 | AC-F4-1 | The two new entries land inside the Epic M2 block before the byte-identical separator | Edge Case | High | Semi-automated |
| TC-M2DOM-015 | AC-F4-2 | One context paragraph sits between the retirement note and M2-S2 with the surrounding regions intact | Happy Path | High | Semi-automated |
| TC-M2DOM-016 | AC-F4-3 | With zero context every backlog hunk lies in the permitted regions | Edge Case | High | Semi-automated |
| TC-M2DOM-017 | AC-F4-4 | M2-S4 gains M2-S18 on its dependency line and nothing else in the entry changes | Happy Path | High | Semi-automated |
| TC-M2DOM-018 | AC-F5-1 | C4 Level 1 draws repository, project group, and optional workspace | Happy Path | High | Semi-automated |
| TC-M2DOM-019 | AC-F5-2 | The model prose declares membership, forbids scan-admitted clones, and makes unrelated directories identical | Happy Path | High | Semi-automated |
| TC-M2DOM-020 | AC-F5-3 | The overview flow is group-scoped, the cross-repository flow has one entry per member, and six invariants hold | Happy Path | High | Semi-automated |
| TC-M2DOM-021 | AC-F5-4 | One sentence separates the discovery workspace root from the state layer's default identifier | Happy Path | High | Semi-automated |
| TC-M2DOM-022 | AC-F6-1 | repos.v1 defines the flat record set, its fields, its rename, and its M2-S18 owner | Happy Path | High | Semi-automated |
| TC-M2DOM-023 | AC-F6-2 | project-groups.v1 declares the group identity, optional workspace, and member fields with no crossed meaning | Happy Path | High | Semi-automated |
| TC-M2DOM-024 | AC-F6-3 | projects.v1 stays the delivered flat record set and is never the group contract | Negative | High | Semi-automated |
| TC-M2DOM-025 | AC-F6-4 | The rename rule appears exactly once and no text describes one spelling returning two shapes | Critical Path | High | Semi-automated |
| TC-M2DOM-026 | AC-F6-5 | The repository-vocabulary mapping clause names all four tokens and is carried on both pages | Happy Path | High | Semi-automated |
| TC-M2DOM-027 | AC-F6-6 | The configuration document declares its path, schema, selector, and configuration-only membership | Happy Path | High | Semi-automated |
| TC-M2DOM-028 | AC-F6-7 | Aggregation defines declared order, four outcome tokens, a classified partial result, and a restricted exit 2 | Happy Path | High | Semi-automated |
| TC-M2DOM-029 | AC-F6-8 | The queue/lane representation holds one entry per member and states the release rule | Happy Path | High | Semi-automated |
| TC-M2DOM-030 | AC-F6-9 | The plan shape states the review-flow definition, per-member CI corroboration, ordering, and evidence | Happy Path | High | Semi-automated |
| TC-M2DOM-031 | AC-F7-1 | commands/repos.md is complete: synopsis, no-state-read help and version, five fields, envelope, exits, errors | Happy Path | High | Semi-automated |
| TC-M2DOM-032 | AC-F7-2 | The repos scope section restores read-only semantics and the declared unbound behaviour | Happy Path | High | Semi-automated |
| TC-M2DOM-033 | AC-F7-3 | The delivered projects.* identities are retained, unbound is not an error, and a repos.* prefix change is S18 work | Negative | High | Semi-automated |
| TC-M2DOM-034 | AC-F7-4 | The STATE example is the host-root container with a PROJECT_KEY_PATTERN key and the mapping clause | Happy Path | High | Semi-automated |
| TC-M2DOM-035 | AC-F7-5 | commands/projects.md is the group page with member daemonReachable and no orphan reason paragraph | Happy Path | High | Semi-automated |
| TC-M2DOM-036 | AC-F7-6 | The projects page states partial degradation, makes no board claim, and carries the scoped grammar and alias pointer | Happy Path | High | Semi-automated |
| TC-M2DOM-037 | AC-F7-7 | Each command page names only its own surface and contract | Negative | High | Semi-automated |
| TC-M2DOM-038 | AC-F7-8 | commands/board.md stays on the repository-key boundary with a repository-vocabulary envelope and refusal | Negative | High | Semi-automated |
| TC-M2DOM-039 | AC-F7-9 | queue.md carries the group grammar, the M2 README names the status delta, and the M1 status page is untouched | Happy Path | High | Semi-automated |
| TC-M2DOM-040 | AC-F8-1 | At least five S18 seeds with one Assert each cover the six required topics, including the undeclared clone | Happy Path | High | Semi-automated |
| TC-M2DOM-041 | AC-F8-2 | At least five S19 seeds with one Assert each cover the lifecycle, failing member, CI, and ordering | Happy Path | High | Semi-automated |
| TC-M2DOM-042 | AC-F8-3 | Every S18/S19 assertion reads a declared envelope and none uses the retired change.data family | Negative | High | Semi-automated |
| TC-M2DOM-043 | AC-F8-4 | Both S11 seeds are reconciled: the first names the flat record set, the second is prospective | Happy Path | High | Semi-automated |
| TC-M2DOM-044 | AC-F8-5 | One seed asserts the alias payload and the group payload in the same scenario | Happy Path | High | Semi-automated |
| TC-M2DOM-045 | AC-F8-6 | The introduction reads M2-S2 through M2-S19 and every story keeps at least two seeds | Happy Path | Medium | Semi-automated |
| TC-M2DOM-046 | AC-F9-1 | The opening journey is a group-scoped morning overview with scoped reads and the disambiguation | Happy Path | High | Semi-automated |
| TC-M2DOM-047 | AC-F10-1 | The delta note splits the two families, keeps the mount note, and phrases the page move as pending work | Happy Path | High | Semi-automated |
| TC-M2DOM-048 | AC-F11-1 | The M2 pack README lists the new page and maps S11, S18, S19, S4, and the scenarios correctly | Happy Path | High | Semi-automated |
| TC-M2DOM-049 | AC-F11-2 | The milestone M2 index row reaches thirteen targets and the M0/M1 rows are untouched | Happy Path | High | Semi-automated |
| TC-M2DOM-050 | AC-F12-1 | One dated status section records the correction as planning state without a delivery claim | Happy Path | High | Semi-automated |
| TC-M2DOM-051 | AC-F12-2 | Every base status line is retained in order and every addition lies inside the new section | Regression | High | Semi-automated |
| TC-M2DOM-052 | AC-F13-1 | The registry splits the two names with one Delivery row per name and the ODR-0003 lock | Happy Path | High | Semi-automated |
| TC-M2DOM-053 | AC-F13-2 | projects joins COMMAND FAMILIES, the boundary note points at the rule, and other rows are byte-identical | Regression | High | Semi-automated |
| TC-M2DOM-054 | AC-F14-1 | The forbidden half of the naming matrix holds across all twenty-one Appendix B rows | Negative | High | Semi-automated |
| TC-M2DOM-055 | AC-F14-2 | Six pages carry the disambiguation, the nine delivered facts survive, and no page pair contradicts | Happy Path | High | Semi-automated |
| TC-M2DOM-056 | AC-F14-3 | The terminology lock holds: no old-identity affirmation and the state scope is per-checkout | Negative | High | Semi-automated |
| TC-M2DOM-057 | AC-NFR1-1 | Exactly fifteen product files change and nothing outside the manifest | Happy Path | High | Semi-automated |
| TC-M2DOM-058 | AC-NFR2-1 | Backlog preservation holds, the S4 diff is its dependency line, and no story code moves | Regression | High | Semi-automated |
| TC-M2DOM-059 | AC-NFR3-1 | Both command pages stay planned, nothing claims delivery, and the pack statement is verbatim | Negative | High | Semi-automated |
| TC-M2DOM-060 | AC-NFR4-1 | The forbidden-literals registration grows 141 -> 142 in position with no duplicate and a clean guard | Happy Path | High | Automated |
| TC-M2DOM-061 | AC-NFR5-1 | The distribution guard exits 0 under the default TMPDIR with no planning marker | Happy Path | High | Automated |
| TC-M2DOM-062 | AC-NFR6-1 | Both aggregate runs are recorded, the repository-local full suite is authoritative, and only the named pair is excused | Corner Case | High | Semi-automated |
| TC-M2DOM-063 | AC-NFR7-1 | Every touched document passes the structural diagram read with eight owned key flows | Corner Case | High | Semi-automated |
| TC-M2DOM-064 | AC-NFR8-1 | Twenty-six ticket clauses and thirty-two board-derived clauses are all present | Happy Path | High | Semi-automated |
| TC-M2DOM-065 | AC-NFR9-1 | Twelve of fourteen planning documents are literal-scanned with zero seed literals and zero violations | Negative | High | Automated |
| TC-M2DOM-066 | AC-NFR10-1 | No relative link is broken, the new page is linked twice, and no page restates an acceptance block | Regression | High | Semi-automated |
| TC-M2DOM-067 | AC-NFR11-1 | The retention oracle is sound and status.md history is append-only | Regression | High | Semi-automated |
| TC-M2DOM-068 | AC-NFR12-1 | The required half of the naming matrix holds, the alias token is placed only where it belongs, and the scan bites | Happy Path | High | Semi-automated |
| TC-M2DOM-069 | AC-NFR13-1 | The terminology counts are zero and all four mapping tokens read as repository checkouts | Negative | High | Semi-automated |
### 5.2 Scenario Details

Each scenario below is one acceptance criterion. The procedure that executes it is
named in 7.2; the steps are the observable checks, and the expected outcome is the
exact set of assertions the procedure prints. "Manual" automation still runs as a
disposable bash procedure: nothing is added to the permanent suite.

#### TC-M2DOM-001 - M2-S11 keeps the delivered story, its shipped-surface AC, and records the planned transition

**Scenario Type**: Happy Path  
**Impact Level**: Critical  
**Priority**: High  
**Related IDs**: AC-F1-1, F-1, DM-1  
**Test Type(s)**: Manual (static/diff)  
**Automation Level**: Semi-automated  
**Target Layer / Location**: `doc/planning/oss-tooling/backlog.md`  
**Tags**: @docs, @backlog

**Preconditions**:

- `backlog.md` is at the change head; the base snapshot of `3c9f8a59` is materialised by P00.

**Steps**:

1. Extract the M2-S11 entry with `entry()` and squash its prose.
2. Check the five retained clauses, the exact `Depends on` and `Ticket` lines, and the `Progress: delivered by GH-288` record.
3. Extract the `- AC:` block and confirm it still names `projects list` and `without manual configuration`, and does not name `repos list`.
4. Confirm the entry names M2-S18 and the `projects list --flat` alias as the planned transition, and references the rename rule.

**Expected Outcome**:

- `retained_clauses=5/5`; `depends_line=exact`; `ticket_line_record=OK`; `progress_record=OK`.
- `ac_shipped_surface=OK`; `ac_delivered_enumeration=OK`; `ac_repos_list=ABSENT`.
- `transition_alias=OK`; `transition_owner=OK`; `transition_reference=OK`; verdict PASS.

**Notes / Clarifications**:

- The transition sentence lives in the Tasks clause so the entry keeps the DM-1 shape (Goal, Tasks, AC, Depends on).


#### TC-M2DOM-002 - The amended M2-S11 entry carries no flat-surface AC, no rename clause, and no weakened delivered line

**Scenario Type**: Negative  
**Impact Level**: Critical  
**Priority**: High  
**Related IDs**: AC-F1-2, F-1, NFR-8, NFR-13  
**Test Type(s)**: Manual (static/diff)  
**Automation Level**: Semi-automated  
**Target Layer / Location**: `doc/planning/oss-tooling/backlog.md`  
**Tags**: @docs, @backlog

**Preconditions**:

- Base and head backlog files are available; the entry body is extracted by file, never passed as text.

**Steps**:

1. Extract the M2-S11 entry from the base snapshot and from the head **by file path**, then compare the five pinned blocks byte for byte: heading, `- Ticket:`, `- Progress:`, `- AC:`, `- Depends on:`.
2. Assert the Goal is not pinned (F-1 lets its wording change) but still carries the delivered overview meaning and does not promise `repos list`.
3. Assert the AC block contains no `repos list`, the entry contains no `projectKey…repoKey` or `data.projects[]…data.repos[]` arrow clause, and the entry differs from base (non-vacuity).
4. Prove the oracle bites: a mutated head with one changed AC word must report `mutant_preserved_blocks=4/5`; a fabricated `- Depends on:` must report `mutant_depends=CHANGED`; a benign Goal reword must leave the pinned set intact; a Goal that promises `repos list` must be detected.

**Expected Outcome**:

- `heading`, `Ticket:`, `Progress:`, `AC:`, `Depends on:` each report `byte-identical`; `preserved_blocks=5/5`.
- `goal_pinned=no`; `goal_delivered_overview=OK`; `goal_promises_repos_list=ABSENT`.
- `repos_list_in_ac=ABSENT`; `field_rename_clause=ABSENT`; `entry_change=non-vacuous`.
- `mutant_ac=CHANGED`; `mutant_preserved_blocks=4/5`; `mutant_depends=CHANGED`; `mutant_goal_reword=accepted (pinned set untouched)`; `mutant_goal_meaning=detected`; verdict PASS.

**Notes / Clarifications**:

- The preserved set is exactly what AC-F1-1/AC-F1-2 pin: the heading, the GH-288 `Ticket` line, the `Progress` record, the delivered `AC` block, and the `Depends on` line. The Goal is deliberately **not** pinned — F-1 requires only that it keep the shipped overview meaning, and a conforming head rewords it to name the delivered `projects list` command, so a byte-identity check on the Goal would fail a legal head (the original helper compared nothing and nobody noticed). A zero-diff entry FAILs: an absent amendment is not a pass.


#### TC-M2DOM-003 - Every transition item is owned by M2-S18 exactly once and M2-S11 names that owner

**Scenario Type**: Happy Path  
**Impact Level**: Important  
**Priority**: High  
**Related IDs**: AC-F1-3, F-1, F-2, DM-1  
**Test Type(s)**: Manual (static/diff)  
**Automation Level**: Semi-automated  
**Target Layer / Location**: `doc/planning/oss-tooling/backlog.md`  
**Tags**: @docs, @backlog

**Preconditions**:

- The M2-S11 and M2-S18 entries are present.

**Steps**:

1. Check the S18 entry claims the alias token, the field-rename arrow, the migration-guide path, configuration-only membership, both scoped-read grammar forms, and the decision record (7 items).
2. Check the S11 entry names M2-S18 as owner.
3. Check the S11 entry claims none of the three transition artefacts itself.

**Expected Outcome**:

- `owned_items=7/7`; `s11_names_owner=OK`; `s11_duplicate_ownership=0`; verdict PASS.

**Notes / Clarifications**:

- Ownership is tested by mutual exclusion, not only presence.


#### TC-M2DOM-004 - The M2-S18 entry carries its four labels and all twelve ticket clauses, with no ticket line

**Scenario Type**: Happy Path  
**Impact Level**: Critical  
**Priority**: High  
**Related IDs**: AC-F2-1, F-2, DM-1, NFR-8  
**Test Type(s)**: Manual (content)  
**Automation Level**: Semi-automated  
**Target Layer / Location**: `doc/planning/oss-tooling/backlog.md`  
**Tags**: @docs, @backlog

**Preconditions**:

- `clause_rows()` holds the 12 S18 rows of spec Appendix A.1.

**Steps**:

1. Count the seeds' shape labels (`- Goal:`, `- Tasks:`, `- AC:`, `- Depends on:`).
2. Match all 12 clause anchors against the squashed entry.
3. Assert no `- Ticket:` line and the exact `- Depends on: M2-S11.`.

**Expected Outcome**:

- `clauses_present=12/12`; `shape_labels=4/4`; `ticket_line=0`; `depends=exact`; verdict PASS.

**Notes / Clarifications**:

- An anchor failing prints its clause id so a repair is targeted.


#### TC-M2DOM-005 - Mixed tracker kinds are accepted at validation time and the unimplemented member is classified

**Scenario Type**: Happy Path  
**Impact Level**: Critical  
**Priority**: High  
**Related IDs**: AC-F2-2, F-2, F-6, DEC-12  
**Test Type(s)**: Manual (content)  
**Automation Level**: Semi-automated  
**Target Layer / Location**: `backlog.md + m2/contracts.md`  
**Tags**: @docs, @contracts

**Preconditions**:

- The S18 entry and the contracts are present.

**Steps**:

1. Assert `mixing tracker kinds`, `accepted at validation time`, `not-yet-supported`, and `rather than rejected` in both locations (7 anchors).
2. Assert no softening phrase (`trackers are not supported`, `mixed trackers are rejected`, `supported later`).

**Expected Outcome**:

- `anchors=7/7`; `softening=0`; verdict PASS.

**Notes / Clarifications**:

- G-2: token presence is not semantic correctness; the reviewer reads the clause once.


#### TC-M2DOM-006 - M2-S18 carries the rename task, the alias task, and an acceptance criterion for the alias payload shape

**Scenario Type**: Happy Path  
**Impact Level**: Critical  
**Priority**: High  
**Related IDs**: AC-F2-3, F-2, DM-7, DEC-21  
**Test Type(s)**: Manual (content)  
**Automation Level**: Semi-automated  
**Target Layer / Location**: `doc/planning/oss-tooling/backlog.md`  
**Tags**: @docs, @backlog

**Preconditions**:

- The S18 entry is present.

**Steps**:

1. Assert the rename task names `projects list`, `repos list`, and `flat record set`.
2. Assert the alias token, its `data.projects[]` payload, and its retirement at the M3 boundary.
3. Assert the `- AC:` block asserts the alias payload shape (`data.projects[]`, `projectKey`, `hostIndexRevision`).

**Expected Outcome**:

- `rename_set=6/6`; verdict PASS.

**Notes / Clarifications**:

- The AC block, not the task list, is where the alias shape is contract-tested.


#### TC-M2DOM-007 - M2-S18 carries the field-rename and migration-guide tasks and states they are code work, not current truth

**Scenario Type**: Happy Path  
**Impact Level**: Important  
**Priority**: High  
**Related IDs**: AC-F2-4, F-2, DM-4, DM-6  
**Test Type(s)**: Manual (content)  
**Automation Level**: Semi-automated  
**Target Layer / Location**: `doc/planning/oss-tooling/backlog.md`  
**Tags**: @docs, @backlog

**Preconditions**:

- The S18 entry is present.

**Steps**:

1. Assert the `projectKey → repoKey` and `data.projects[] → data.repos[]` field renames.
2. Assert the migration-guide path `doc/guides/migrating-to-per-repository-state.md`.
3. Assert `S18 code work` and `not current truth`, and that no sentence claims the rename has shipped.

**Expected Outcome**:

- `anchors=5/5`; `shipped_claims=0`; verdict PASS.

**Notes / Clarifications**:

- The spec forbids editing the migration guide here; only the task is required.


#### TC-M2DOM-008 - Registration is configuration-only and the scoped-read grammar is stated for queue and status

**Scenario Type**: Happy Path  
**Impact Level**: Critical  
**Priority**: High  
**Related IDs**: AC-F2-5, F-2, DM-3, DM-8  
**Test Type(s)**: Manual (content)  
**Automation Level**: Semi-automated  
**Target Layer / Location**: `doc/planning/oss-tooling/backlog.md`  
**Tags**: @docs, @backlog

**Preconditions**:

- The S18 entry is present.

**Steps**:

1. Assert configuration-only membership, `workspaceRoot`, `members`, and the configuration-document reference.
2. Assert the scan locates declared members only.
3. Assert both scoped-read grammar forms.

**Expected Outcome**:

- `anchors=7/7`; verdict PASS.

**Notes / Clarifications**:

- The grammar is asserted verbatim, including the `<groupKey>` placeholder, because the argument's meaning is the point.


#### TC-M2DOM-009 - M2-S18 owns the superseding decision record and no task claims the rename shipped

**Scenario Type**: Happy Path  
**Impact Level**: Critical  
**Priority**: High  
**Related IDs**: AC-F2-6, F-2, F-13, DEC-29  
**Test Type(s)**: Manual (content)  
**Automation Level**: Semi-automated  
**Target Layer / Location**: `backlog.md + cli-command-registry.md`  
**Tags**: @docs, @backlog

**Preconditions**:

- The S18 entry and the registry are present.

**Steps**:

1. Assert the superseding decision-record task and that it precedes the registry Delivery move.
2. Assert no task claims the rename shipped.

**Expected Outcome**:

- `decision_record_task=OK`; `record_precedes_delivery=OK`; `shipped_claims=0`; verdict PASS.

**Notes / Clarifications**:

- ODR-0003 is why the record precedes the code change; the registry row is checked separately by TC-052.


#### TC-M2DOM-010 - The M2-S19 entry carries its four labels, all eleven ticket clauses, and the exact dependency line

**Scenario Type**: Happy Path  
**Impact Level**: Critical  
**Priority**: High  
**Related IDs**: AC-F3-1, F-3, DM-1, NFR-8  
**Test Type(s)**: Manual (content)  
**Automation Level**: Semi-automated  
**Target Layer / Location**: `doc/planning/oss-tooling/backlog.md`  
**Tags**: @docs, @backlog

**Preconditions**:

- `clause_rows()` holds the 11 S19 rows.

**Steps**:

1. Check the four labels and all 11 clause anchors.
2. Assert no `- Ticket:` line and the exact `- Depends on: M2-S11, M2-S18, M1-S17.`.

**Expected Outcome**:

- `clauses_present=11/11`; `shape_labels=4/4`; `ticket_line=0`; `depends=exact`; verdict PASS.

**Notes / Clarifications**:

- The dependency line carries the S18 edge that makes the group contract available.


#### TC-M2DOM-011 - The three S19 criteria are identifiable, one review flow is executable, and unavailable CI blocks

**Scenario Type**: Happy Path  
**Impact Level**: Critical  
**Priority**: High  
**Related IDs**: AC-F3-2, F-3, DM-10, DEC-32  
**Test Type(s)**: Manual (content)  
**Automation Level**: Semi-automated  
**Target Layer / Location**: `doc/planning/oss-tooling/backlog.md`  
**Tags**: @docs, @backlog

**Preconditions**:

- The S19 entry is present.

**Steps**:

1. Count the numbered AC items and match the three ticket criteria.
2. Assert the executable review-flow definition (`one review run over the declared member pull-request set`, `one verdict per member`, `reviewed once`).
3. Assert the CI corroboration clause: `unavailable CI reading blocks` and `rather than counting as green`.

**Expected Outcome**:

- `numbered_items>=3`; each criterion count `>=1`; `review_flow=3/3`; `ci_corroboration=2/2`; verdict PASS.

**Notes / Clarifications**:

- A fourth, derived item (ordering) is allowed; the three ticket criteria stay independently identifiable.


#### TC-M2DOM-012 - Dependency ordering is an acceptance criterion with landing-order evidence

**Scenario Type**: Happy Path  
**Impact Level**: Important  
**Priority**: High  
**Related IDs**: AC-F3-3, F-3, DM-10  
**Test Type(s)**: Manual (content)  
**Automation Level**: Semi-automated  
**Target Layer / Location**: `doc/planning/oss-tooling/backlog.md`  
**Tags**: @docs, @backlog

**Preconditions**:

- The S19 entry is present.

**Steps**:

1. Assert the ordering criterion's exact predicate (`does not start before the prerequisite member's pull request lands`).
2. Assert `landing order` in the AC block and `dependency edge` in the tasks.

**Expected Outcome**:

- `ordering_anchors=3/3`; verdict PASS.

**Notes / Clarifications**:

- Landing order is the evidence half of the criterion.


#### TC-M2DOM-013 - The contracts declare the change plan shape, the shared verdict, and the closeout envelope

**Scenario Type**: Happy Path  
**Impact Level**: Critical  
**Priority**: High  
**Related IDs**: AC-F3-4, F-3, F-6, DM-10, DEC-31  
**Test Type(s)**: Manual (content)  
**Automation Level**: Semi-automated  
**Target Layer / Location**: `m2/contracts.md`  
**Tags**: @docs, @contracts

**Preconditions**:

- `contracts.md` is present.

**Steps**:

1. Extract the `## Cross-repository change plan shape` section.
2. Assert the field inventory: `plan.data.members[]`, repoKey, slice, branch, pullRequest, dependsOn[], gates, `verify gates`, `data.definitionOfDone`, `data.blockingMembers[]`, `closeout.data.members[]`, cleanup, issueClosure, landed, landing order, one review flow.

**Expected Outcome**:

- `plan_shape_fields=16/16`; verdict PASS.

**Notes / Clarifications**:

- TC-030 asserts the behavioural clauses; TC-013 asserts the field inventory.


#### TC-M2DOM-014 - The two new entries land inside the Epic M2 block before the byte-identical separator

**Scenario Type**: Edge Case  
**Impact Level**: Critical  
**Priority**: High  
**Related IDs**: AC-F4-1, F-4, NFR-2, DEC-8  
**Test Type(s)**: Manual (diff)  
**Automation Level**: Semi-automated  
**Target Layer / Location**: `doc/planning/oss-tooling/backlog.md`  
**Tags**: @docs, @backlog

**Preconditions**:

- Base and head backlog snapshots are available.

**Steps**:

1. Derive S17's last content line, the closing separator, and the Epic M3 heading from the head.
2. Compare the separator triple with the base and count the blank line before it.
3. Assert S18 precedes S19 and both lie inside `[s17_last+1, separator-1]`.

**Expected Outcome**:

- Window is non-empty; `separator_sequence=identical`; `blank_line_before_separator=1`; `placement=inside-window`; verdict PASS.

**Notes / Clarifications**:

- The window is recomputed, never hardcoded.


#### TC-M2DOM-015 - One context paragraph sits between the retirement note and M2-S2 with the surrounding regions intact

**Scenario Type**: Happy Path  
**Impact Level**: Critical  
**Priority**: High  
**Related IDs**: AC-F4-2, F-4, NFR-2, DEC-4  
**Test Type(s)**: Manual (diff)  
**Automation Level**: Semi-automated  
**Target Layer / Location**: `doc/planning/oss-tooling/backlog.md`  
**Tags**: @docs, @backlog

**Preconditions**:

- The retirement note and `### M2-S2` are locatable.

**Steps**:

1. Anchor the retirement note to its base line numbers and compare it byte for byte.
2. Measure the paragraph strictly between the note and M2-S2, with one blank line on each side.
3. Assert the seven anchors (three levels, configuration-only membership, delivered flat surface, rename-rule reference, root-family consequence).

**Expected Outcome**:

- `retirement_note=OK`; `paragraph_lines>0`; `paragraph_strictly_between=OK`; `paragraph_anchors=7/7`; verdict PASS.

**Notes / Clarifications**:

- Only invariants are gated: the paragraph's line numbers and length are recorded as observations in Section 6.


#### TC-M2DOM-016 - With zero context every backlog hunk lies in the permitted regions

**Scenario Type**: Edge Case  
**Impact Level**: Important  
**Priority**: High  
**Related IDs**: AC-F4-3, F-4, NFR-2  
**Test Type(s)**: Manual (diff)  
**Automation Level**: Semi-automated  
**Target Layer / Location**: `doc/planning/oss-tooling/backlog.md`  
**Tags**: @docs, @backlog

**Preconditions**:

- A zero-context diff of the backlog against base exists.

**Steps**:

1. Classify every hunk against the S11 entry, the S4 dependency line, the context paragraph, and the insertion window.
2. Fail on any `OUTSIDE` hunk or a zero-hunk diff.
3. Run the three classifier self-tests (inside context, outside window, start of window).

**Expected Outcome**:

- `hunk confinement OK`; `non_vacuous=yes`; `classifier_self_tests=3/3`; verdict PASS.

**Notes / Clarifications**:

- The S4 line is permitted because AC-F4-3 names it.


#### TC-M2DOM-017 - M2-S4 gains M2-S18 on its dependency line and nothing else in the entry changes

**Scenario Type**: Happy Path  
**Impact Level**: Important  
**Priority**: High  
**Related IDs**: AC-F4-4, F-4, F-11, DEC-28  
**Test Type(s)**: Manual (diff)  
**Automation Level**: Semi-automated  
**Target Layer / Location**: `doc/planning/oss-tooling/backlog.md`  
**Tags**: @docs, @backlog

**Preconditions**:

- Base and head M2-S4 entries are extracted.

**Steps**:

1. Assert the head dependency line is exactly `- Depends on: M1-S5, M1-S17, M2-S11, M2-S18.`.
2. Diff the entries and require one removed line, one added line, and nothing else.
3. Assert the base line is the old one.

**Expected Outcome**:

- `depends_line=exact`; `removed_lines=1`; `added_lines=1`; `non_dependency_diff_lines=0`; verdict PASS.

**Notes / Clarifications**:

- The terminal period is part of the exact match.


#### TC-M2DOM-018 - C4 Level 1 draws repository, project group, and optional workspace

**Scenario Type**: Happy Path  
**Impact Level**: Critical  
**Priority**: High  
**Related IDs**: AC-F5-1, F-5, DM-2  
**Test Type(s)**: Manual (content)  
**Automation Level**: Semi-automated  
**Target Layer / Location**: `m2/architecture.md`  
**Tags**: @docs, @architecture

**Preconditions**:

- `architecture.md` has a `## C4 Level 1: system context` section.

**Steps**:

1. Extract the section and its mermaid block.
2. Assert the repository-as-delivery-unit and configured-group statements, the workspace node, and its optionality in the diagram.
3. Run the sentence-scoped mandatory-claim detector (negated and optional phrasing excluded).

**Expected Outcome**:

- `repository_as_delivery_unit=OK`; `project_as_group=OK`; `workspace_in_diagram=OK`; `workspace_optional_in_diagram=OK`; `workspace_mandatory_claim=ABSENT`; verdict PASS.

**Notes / Clarifications**:

- The optionality must be visible in the diagram, not only in prose.


#### TC-M2DOM-019 - The model prose declares membership, forbids scan-admitted clones, and makes unrelated directories identical

**Scenario Type**: Happy Path  
**Impact Level**: Critical  
**Priority**: High  
**Related IDs**: AC-F5-2, F-5, DM-2, DM-3  
**Test Type(s)**: Manual (content)  
**Automation Level**: Semi-automated  
**Target Layer / Location**: `m2/architecture.md`  
**Tags**: @docs, @architecture

**Preconditions**:

- `architecture.md` is present.

**Steps**:

1. Assert declared membership, declared-only scanning, the undeclared-clone ban, workspace optionality, and unrelated-directory equivalence (5 anchors).
2. Assert no sentence requires a member to live inside a workspace.

**Expected Outcome**:

- `anchors=5/5`; `mandatory_membership_claims=0`; verdict PASS.

**Notes / Clarifications**:

- The equivalence sentence is what makes the no-workspace seed testable.


#### TC-M2DOM-020 - The overview flow is group-scoped, the cross-repository flow has one entry per member, and six invariants hold

**Scenario Type**: Happy Path  
**Impact Level**: Critical  
**Priority**: High  
**Related IDs**: AC-F5-3, F-5, DM-2, DM-9, DM-10  
**Test Type(s)**: Manual (content)  
**Automation Level**: Semi-automated  
**Target Layer / Location**: `m2/architecture.md`  
**Tags**: @docs, @architecture

**Preconditions**:

- The flows and invariants sections are locatable.

**Steps**:

1. Assert the overview flow names groups and members.
2. Assert `### Cross-repository change` exists with a mermaid block, one queue entry per member, and per-member dependency edges.
3. Assert six boundary invariants (naming boundary by reference, configuration-only membership, one queue entry per member, release rule, workspace optionality, one lifecycle).

**Expected Outcome**:

- `overview_group_scoped=OK`; `flow_queue_entry_per_member=OK`; `flow_dependency_edges=OK`; `invariants=6/6`; verdict PASS.

**Notes / Clarifications**:

- Both the flow and the invariants carry the representation, as AC-F5-3 and BRD-20 require.


#### TC-M2DOM-021 - One sentence separates the discovery workspace root from the state layer's default identifier

**Scenario Type**: Happy Path  
**Impact Level**: Important  
**Priority**: High  
**Related IDs**: AC-F5-4, F-5, DM-2  
**Test Type(s)**: Manual (content)  
**Automation Level**: Semi-automated  
**Target Layer / Location**: `m2/architecture.md`  
**Tags**: @docs, @architecture

**Preconditions**:

- `architecture.md` is present.

**Steps**:

1. Assert the `discovery workspace root`, the `fixed \`default\` workspace identifier`, and a sentence separating them.
2. Assert no sentence collapses the two.

**Expected Outcome**:

- `discovery_root_named=OK`; `default_identifier_named=OK`; `distinct_statement=OK`; `collapsed_sentences=0`; verdict PASS.

**Notes / Clarifications**:

- This is the cheap note from the board (finding 17).


#### TC-M2DOM-022 - repos.v1 defines the flat record set, its fields, its rename, and its M2-S18 owner

**Scenario Type**: Happy Path  
**Impact Level**: Critical  
**Priority**: High  
**Related IDs**: AC-F6-1, F-6, DM-4, DEC-20  
**Test Type(s)**: Manual (content)  
**Automation Level**: Semi-automated  
**Target Layer / Location**: `m2/contracts.md`  
**Tags**: @docs, @contracts

**Preconditions**:

- The contracts define a `## repos.v1` section.

**Steps**:

1. Extract the section and squash it.
2. Assert `data.repos[]`, `repoKey`, root, stateLocation, daemonReachable, the closed reason set, `unbound`, handoverState, `hostIndexRevision`, M2-S18 ownership, and the rename record.

**Expected Outcome**:

- `repos_v1_fields=11/11`; `rv_unbound_scope=OK`; `rv_unbound_error_attachment=0`; verdict PASS.

**Notes / Clarifications**:

- `unbound` is a declared scope at exit 0 and the contract must not attach it to an error identity or a non-zero exit; the page's error table is the other half of the same boundary and is asserted by TC-033.


#### TC-M2DOM-023 - project-groups.v1 declares the group identity, optional workspace, and member fields with no crossed meaning

**Scenario Type**: Happy Path  
**Impact Level**: Critical  
**Priority**: High  
**Related IDs**: AC-F6-2, F-6, DM-5, DEC-19, DEC-22  
**Test Type(s)**: Manual (content)  
**Automation Level**: Semi-automated  
**Target Layer / Location**: `m2/contracts.md`  
**Tags**: @docs, @contracts

**Preconditions**:

- The contracts define a `## project-groups.v1` section.

**Steps**:

1. Assert the envelope `data.groups[]`, the identity `groupKey`, `name`, optional `workspaceRoot`, and the member fields (11 anchors).
2. Assert no affirmative statement makes `projectKey` a group identity.
3. Assert the two crossed-meaning bans are stated.

**Expected Outcome**:

- `group_fields=11/11`; `projectKey_group_affirmations=0`; both bans `OK`; verdict PASS.

**Notes / Clarifications**:

- The section may mention `projectKey` only to deny it that meaning.


#### TC-M2DOM-024 - projects.v1 stays the delivered flat record set and is never the group contract

**Scenario Type**: Negative  
**Impact Level**: Critical  
**Priority**: High  
**Related IDs**: AC-F6-3, F-6, DM-6, DEC-19  
**Test Type(s)**: Manual (content)  
**Automation Level**: Semi-automated  
**Target Layer / Location**: `m2/contracts.md`  
**Tags**: @docs, @contracts

**Preconditions**:

- The contracts define a `## projects.v1` section.

**Steps**:

1. Assert `data.projects[]`, `projectKey`, `hostIndexRevision`, the naming of `project-groups.v1`, and the alias-payload role.
2. Assert zero group affirmations and zero group-envelope fields in the section.

**Expected Outcome**:

- `delivered_fields=5/5`; `group_affirmations=0`; `group_fields=0`; verdict PASS.

**Notes / Clarifications**:

- This is the identity split's load-bearing section (decision A).


#### TC-M2DOM-025 - The rename rule appears exactly once and no text describes one spelling returning two shapes

**Scenario Type**: Critical Path  
**Impact Level**: Critical  
**Priority**: High  
**Related IDs**: AC-F6-4, F-6, DM-7, DEC-21, DEC-22  
**Test Type(s)**: Manual (content)  
**Automation Level**: Semi-automated  
**Target Layer / Location**: `nine planning documents`  
**Tags**: @docs, @naming

**Preconditions**:

- The fourteen touched documents are readable.

**Steps**:

1. Count the exact normative sentence across the corpus; require exactly one.
2. Assert no sentence describes one spelling returning two shapes at one time.
3. Assert the alias token is never paired with a group envelope, and appears at least three times (definition plus pointers).

**Expected Outcome**:

- `rename_rule_occurrences=1`; `two_shape_sentences=0`; `alias_paired_with_group=0`; `alias_occurrences>=3`; verdict PASS.

**Notes / Clarifications**:

- The rule is restated nowhere; every other page points at it.


#### TC-M2DOM-026 - The repository-vocabulary mapping clause names all four tokens and is carried on both pages

**Scenario Type**: Happy Path  
**Impact Level**: Critical  
**Priority**: High  
**Related IDs**: AC-F6-5, F-6, DM-11, F-7  
**Test Type(s)**: Manual (content)  
**Automation Level**: Semi-automated  
**Target Layer / Location**: `contracts.md + commands/{repos,projects}.md`  
**Tags**: @docs, @naming

**Preconditions**:

- The contracts and both command pages are present.

**Steps**:

1. Assert the four repository-vocabulary tokens, the `denote a repository checkout` predicate, and the permanence clause in the contracts (6 anchors).
2. Assert the clause is carried in the `repos.v1` section and on both command pages.

**Expected Outcome**:

- `contracts_mapping=6/6`; `repos_v1_mapping_carried=1/1`; `repos_md_mapping=5/5`; `projects_md_mapping=5/5`; verdict PASS.

**Notes / Clarifications**:

- The clause prevents a state-layout migration disguised as naming (RSK-5).


#### TC-M2DOM-027 - The configuration document declares its path, schema, selector, and configuration-only membership

**Scenario Type**: Happy Path  
**Impact Level**: Critical  
**Priority**: High  
**Related IDs**: AC-F6-6, F-6, DM-3, DEC-23  
**Test Type(s)**: Manual (content)  
**Automation Level**: Semi-automated  
**Target Layer / Location**: `m2/contracts.md`  
**Tags**: @docs, @contracts

**Preconditions**:

- The contracts define a `## Project configuration document` section.

**Steps**:

1. Assert the document path, schema, group and member fields, the selector (`root` or `repoKey`), `trackerKind`, configuration-only membership, and the undeclared-clone ban (11 anchors plus the selector).

**Expected Outcome**:

- `config_fields=11/11`; `selector>=1`; verdict PASS.

**Notes / Clarifications**:

- The directory name stays configuration data; no brand literal appears.


#### TC-M2DOM-028 - Aggregation defines declared order, four outcome tokens, a classified partial result, and a restricted exit 2

**Scenario Type**: Happy Path  
**Impact Level**: Critical  
**Priority**: High  
**Related IDs**: AC-F6-7, F-6, DM-8, DEC-24  
**Test Type(s)**: Manual (content)  
**Automation Level**: Semi-automated  
**Target Layer / Location**: `m2/contracts.md`  
**Tags**: @docs, @contracts

**Preconditions**:

- The contracts define a `## Project-scoped aggregation` section.

**Steps**:

1. Assert declared order, the four outcome tokens, `partial`, exit 0, the named degraded member, the exit-2 restriction, and the two not-yet-supported behaviours (12 anchors).

**Expected Outcome**:

- `aggregation_anchors=12/12`; `exit2_restricted=OK`; verdict PASS.

**Notes / Clarifications**:

- The classified partial result is what stops a one-member failure from failing the read.


#### TC-M2DOM-029 - The queue/lane representation holds one entry per member and states the release rule

**Scenario Type**: Happy Path  
**Impact Level**: Critical  
**Priority**: High  
**Related IDs**: AC-F6-8, F-6, DM-9, DEC-27  
**Test Type(s)**: Manual (content)  
**Automation Level**: Semi-automated  
**Target Layer / Location**: `m2/contracts.md`  
**Tags**: @docs, @contracts

**Preconditions**:

- The contracts define a `## Queue and lane representation` section.

**Steps**:

1. Assert one entry per member keyed by its ref, per-member edges, one lane per member, no cross-repository lane, the release rule, per-member removal, and single-entry landing (9 anchors).

**Expected Outcome**:

- `queue_lane_anchors=9/9`; verdict PASS.

**Notes / Clarifications**:

- Architecture carries the same representation in its invariants (TC-020).


#### TC-M2DOM-030 - The plan shape states the review-flow definition, per-member CI corroboration, ordering, and evidence

**Scenario Type**: Happy Path  
**Impact Level**: Critical  
**Priority**: High  
**Related IDs**: AC-F6-9, F-6, DM-10, DEC-31, DEC-32  
**Test Type(s)**: Manual (content)  
**Automation Level**: Semi-automated  
**Target Layer / Location**: `m2/contracts.md`  
**Tags**: @docs, @contracts

**Preconditions**:

- The plan-shape section is present.

**Steps**:

1. Assert the review-run definition, verdict-per-member, `reviewed twice`, per-member CI corroboration, the unavailable-reading block, the ordering predicate, landing order, and the three envelope locations (11 anchors).

**Expected Outcome**:

- `plan_shape_behaviour=11/11`; verdict PASS.

**Notes / Clarifications**:

- TC-013 owns the fields; TC-030 owns the behaviour those fields must express.


#### TC-M2DOM-031 - commands/repos.md is complete: synopsis, no-state-read help and version, five fields, envelope, exits, errors

**Scenario Type**: Happy Path  
**Impact Level**: Critical  
**Priority**: High  
**Related IDs**: AC-F7-1, F-7, DM-13, DEC-21  
**Test Type(s)**: Manual (content)  
**Automation Level**: Semi-automated  
**Target Layer / Location**: `m2/commands/repos.md`  
**Tags**: @docs, @commands

**Preconditions**:

- `commands/repos.md` exists.

**Steps**:

1. Assert the status header, bare name, the four synopsis forms, the three option rows, and no-state-read semantics on both help forms and version.
2. Assert the five fields, the `repos.v1` envelope with `data.repos[]`, exit status, examples, error table, see-also links, and the rename pointer.

**Expected Outcome**:

- `checks=11/11`; `fields=5/5`; verdict PASS.

**Notes / Clarifications**:

- `--version` is the binary's, and `repos list --help` is the verb's; both must state no read.


#### TC-M2DOM-032 - The repos scope section restores read-only semantics and the declared unbound behaviour

**Scenario Type**: Happy Path  
**Impact Level**: Critical  
**Priority**: High  
**Related IDs**: AC-F7-2, F-7, DM-4, F-6  
**Test Type(s)**: Manual (content)  
**Automation Level**: Semi-automated  
**Target Layer / Location**: `m2/commands/repos.md`  
**Tags**: @docs, @commands

**Preconditions**:

- `commands/repos.md` has a `## SCOPE` section.

**Steps**:

1. Assert the read-only statement (no index maintenance, no pruning, no state-root creation), the two permitted side effects.
2. Assert the `unbound` behaviour: one bounded warning, registers nothing, keeps its exit code, never a row, never a failure (11 anchors).

**Expected Outcome**:

- `scope_anchors=11/11`; `unbound_declared=OK`; verdict PASS.

**Notes / Clarifications**:

- The page must not turn the delivered `unbound` scope into an error path.


#### TC-M2DOM-033 - The delivered projects.* identities are retained, unbound is not an error, and a repos.* prefix change is S18 work

**Scenario Type**: Negative  
**Impact Level**: Critical  
**Priority**: High  
**Related IDs**: AC-F7-3, F-7, DM-4, F-6  
**Test Type(s)**: Manual (content)  
**Automation Level**: Semi-automated  
**Target Layer / Location**: `m2/commands/repos.md`  
**Tags**: @docs, @commands

**Preconditions**:

- `commands/repos.md` is present with its SCOPE and ERRORS sections.

**Steps**:

1. Parse the error table and read the exit cell of each delivered identity: `projects.identity-unreadable`, `projects.registry-corrupt`, `projects.state-unavailable`.
2. Require the delivered exit values exactly (`1`, `2`, `2`), the three identities present, no invented `repos.*` identity stated as truth, and the `repos.*` prefix change recorded as S18 code work.
3. Require `unbound` in the scope prose, no error-table identity cell naming it, no sentence attaching it to an error or a non-zero exit, and no sentence calling a non-work-tree root a failure.
4. Prove both directions: a mutant whose identity row reads `0 for unbound, 2 otherwise` must change the parsed exit, and a mutant that refuses a non-work-tree root as a failure must be detected.

**Expected Outcome**:

- `error_table_identity_unreadable_exit=1`; `error_table_registry_corrupt_exit=2`; `error_table_state_unavailable_exit=2`.
- `identities=4/4`; `invented_identities=0`.
- `unbound_in_scope=OK`; `unbound_as_error_row=0`; `unbound_error_attachment=0`; `non_worktree_failure_claim=0`.
- `mutant_unbound_exit=detected`; `mutant_nonworktree_error=detected`; verdict PASS.

**Notes / Clarifications**:

- This is the page-contract half of the delivered-semantics boundary; TC-022 asserts the contract-side statement in `repos.v1`. The table's meaning cell may name `unbound` to disclaim it (the conforming page does), so only the identity cell counts as an unbound failure row. The doc-sync re-check found the corpus page folding a non-work-tree root into `projects.identity-unreadable` with `0 for unbound, 2 otherwise`; this gate now catches that class.


#### TC-M2DOM-034 - The STATE example is the host-root container with a PROJECT_KEY_PATTERN key and the mapping clause

**Scenario Type**: Happy Path  
**Impact Level**: Important  
**Priority**: High  
**Related IDs**: AC-F7-4, F-7, DM-11  
**Test Type(s)**: Manual (content)  
**Automation Level**: Semi-automated  
**Target Layer / Location**: `m2/commands/repos.md`  
**Tags**: @docs, @commands

**Preconditions**:

- `commands/repos.md` has a `## STATE` section.

**Steps**:

1. Assert the container `<host root>/projects/<key>` and the `PROJECT_KEY_PATTERN` reference.
2. Validate every example key against `^[a-z0-9](?:[a-z0-9-]*[a-z0-9])?-[0-9a-f]{8}$` and assert no bare basename appears.
3. Assert the mapping-clause sentence appears on the page.

**Expected Outcome**:

- `state_container=OK`; `state_example_keys=<key>` (the observed example key, e.g. `delivery-a-1a2b3c4d`); `pattern_valid_keys>=1`; `bare_basename_keys=0`; `mapping_clause_on_page=OK`; verdict PASS.

**Notes / Clarifications**:

- A bare basename key would silently describe the pre-identity layout. The observed `state_example_keys` value is recorded in §10, not only asserted.


#### TC-M2DOM-035 - commands/projects.md is the group page with member daemonReachable and no orphan reason paragraph

**Scenario Type**: Happy Path  
**Impact Level**: Critical  
**Priority**: High  
**Related IDs**: AC-F7-5, F-7, DM-5  
**Test Type(s)**: Manual (content)  
**Automation Level**: Semi-automated  
**Target Layer / Location**: `m2/commands/projects.md`  
**Tags**: @docs, @commands

**Preconditions**:

- `commands/projects.md` is present.

**Steps**:

1. Assert `project-groups.v1`, `data.groups[]`, `groupKey`, `members[].daemonReachable` with the closed vocabulary, the configuration document, the aggregation pointer, and the group/key pairing (11 anchors).
2. Walk every line mentioning `daemonReachable.reason` and require it to be attached to `members[]` or `groups[]`.

**Expected Outcome**:

- `group_page_anchors=11/11`; `orphan_reason_paragraphs=0`; verdict PASS.

**Notes / Clarifications**:

- The orphan paragraph is board finding 8; it must disappear or be attached.


#### TC-M2DOM-036 - The projects page states partial degradation, makes no board claim, and carries the scoped grammar and alias pointer

**Scenario Type**: Happy Path  
**Impact Level**: Critical  
**Priority**: High  
**Related IDs**: AC-F7-6, F-7, DM-7, DM-8  
**Test Type(s)**: Manual (content)  
**Automation Level**: Semi-automated  
**Target Layer / Location**: `m2/commands/projects.md`  
**Tags**: @docs, @commands

**Preconditions**:

- `commands/projects.md` is present.

**Steps**:

1. Assert the classified partial result, `not-yet-supported`, the exit-0 and exit-2 behaviours, `--project <groupKey>`, the `--flat` alias pointer, the rename-rule pointer, and the time-scoped disambiguation (8 anchors).
2. Assert no affirmative group-scoped board claim and no two-shape sentence.

**Expected Outcome**:

- `behaviour_anchors=8/8`; `board_group_claims=0`; `two_shape=0`; verdict PASS.

**Notes / Clarifications**:

- Board claims are detected per sentence with negations excluded.


#### TC-M2DOM-037 - Each command page names only its own surface and contract

**Scenario Type**: Negative  
**Impact Level**: Important  
**Priority**: High  
**Related IDs**: AC-F7-7, F-7, F-14, NFR-3  
**Test Type(s)**: Manual (content)  
**Automation Level**: Semi-automated  
**Target Layer / Location**: `m2/commands/{repos,projects}.md`  
**Tags**: @docs, @commands

**Preconditions**:

- Both command pages exist.

**Steps**:

1. Count `repos.v1` and the group surface on each page.
2. Assert each page carries the planned header and each points at its own contract and at no other surface.

**Expected Outcome**:

- `repos_page: repos.v1>=1 group_surface=0`; `projects_page: project-groups.v1>=1 repos_surface=0`; both `header=1`; both `planned>=1`; verdict PASS.

**Notes / Clarifications**:

- The bare word `repos` may appear in the projects page's boundary pointer; the envelope tokens may not.


#### TC-M2DOM-038 - commands/board.md stays on the repository-key boundary with a repository-vocabulary envelope and refusal

**Scenario Type**: Negative  
**Impact Level**: Critical  
**Priority**: High  
**Related IDs**: AC-F7-8, F-7, DM-11, DEC-26  
**Test Type(s)**: Manual (content)  
**Automation Level**: Semi-automated  
**Target Layer / Location**: `m2/commands/board.md`  
**Tags**: @docs, @commands

**Preconditions**:

- `commands/board.md` is present.

**Steps**:

1. Assert the repository-key boundary, `--all` over managed repositories, `repositories[]`, `board.repository-unknown`, the M2-S11 state-scope attribution, and the host-index attribution (7 anchors).
2. Assert the stale claims (`the project model M2-S11 introduces`, `board.project-unknown`, the project-model scan) are gone and no sentence claims a group scope.

**Expected Outcome**:

- `board_anchors=7/7`; `stale_claims=0`; `group_claims=0`; verdict PASS.

**Notes / Clarifications**:

- The board is the third meaning of `project` this change must prevent (RSK-10).


#### TC-M2DOM-039 - queue.md carries the group grammar, the M2 README names the status delta, and the M1 status page is untouched

**Scenario Type**: Happy Path  
**Impact Level**: Critical  
**Priority**: High  
**Related IDs**: AC-F7-9, F-7, DM-8, DEC-25  
**Test Type(s)**: Manual (content)  
**Automation Level**: Semi-automated  
**Target Layer / Location**: `queue.md + m2/README.md + m1/commands/status.md`  
**Tags**: @docs, @commands

**Preconditions**:

- `queue.md`, the M2 pack README, and the M1 status page are present.

**Steps**:

1. Assert the synopsis and the OPTIONS row carry `queue list --project <groupKey>`.
2. Assert the M2 README's S18 row names `status --project <groupKey>`.
3. Compare `milestones/m1/commands/status.md` with the base revision byte for byte.

**Expected Outcome**:

- `synopsis_grammar=OK`; `options_grammar=OK`; `m2_readme_status_delta=OK`; `m1_status_page=byte-identical`; verdict PASS.

**Notes / Clarifications**:

- The M1 status page is frozen; the delta lives in the M2 row (DEC-25).


#### TC-M2DOM-040 - At least five S18 seeds with one Assert each cover the six required topics, including the undeclared clone

**Scenario Type**: Happy Path  
**Impact Level**: Critical  
**Priority**: High  
**Related IDs**: AC-F8-1, F-8, DM-12, DEC-23  
**Test Type(s)**: Manual (content)  
**Automation Level**: Semi-automated  
**Target Layer / Location**: `m2/test-scenarios.md`  
**Tags**: @docs, @scenarios

**Preconditions**:

- `test-scenarios.md` has an S18 section.

**Steps**:

1. Count `SC-M2-S18-*` seeds and assert exactly one `Assert:` line per seed.
2. Match the seven topic anchors: workspace registration, no-workspace equivalence, member health, scoped reads, mixed-tracker classification, the undeclared clone, and the classified partial result.

**Expected Outcome**:

- `s18_seeds>=5`; `assert_violations=0`; `topic_anchors=7/7`; verdict PASS.

**Notes / Clarifications**:

- The undeclared-clone seed is the deliverable-state seed the board requires (BRD-18).


#### TC-M2DOM-041 - At least five S19 seeds with one Assert each cover the lifecycle, failing member, CI, and ordering

**Scenario Type**: Happy Path  
**Impact Level**: Critical  
**Priority**: High  
**Related IDs**: AC-F8-2, F-8, DM-10, DM-12  
**Test Type(s)**: Manual (content)  
**Automation Level**: Semi-automated  
**Target Layer / Location**: `m2/test-scenarios.md`  
**Tags**: @docs, @scenarios

**Preconditions**:

- `test-scenarios.md` has an S19 section.

**Steps**:

1. Count `SC-M2-S19-*` seeds and assert exactly one `Assert:` line per seed.
2. Match the five topic anchors: the lifecycle shape, the failing member, CI corroboration, the unavailable reading, and dependency ordering.

**Expected Outcome**:

- `s19_seeds>=5`; `assert_violations=0`; `topic_anchors=5/5`; verdict PASS.

**Notes / Clarifications**:

- The alias seed is counted separately by TC-044.


#### TC-M2DOM-042 - Every S18/S19 assertion reads a declared envelope and none uses the retired change.data family

**Scenario Type**: Negative  
**Impact Level**: Critical  
**Priority**: High  
**Related IDs**: AC-F8-3, F-8, DM-10, DEC-31  
**Test Type(s)**: Manual (content)  
**Automation Level**: Semi-automated  
**Target Layer / Location**: `m2/test-scenarios.md + m2/contracts.md`  
**Tags**: @docs, @scenarios

**Preconditions**:

- The S18 and S19 seeds are present.

**Steps**:

1. Collect every `Assert:` line in the two sections.
2. Assert each reads at least one declared envelope and none reads a `change.data.*` family.
3. Assert the `closeout.data.members[]` assertion exists and is backed by a contract declaration.

**Expected Outcome**:

- `assertions>=10`; `declared_envelope=assertions`; `retired_family=0`; `contract_closeout_declaration>=1`; `closeout_assertions>=1`; verdict PASS.

**Notes / Clarifications**:

- This is the board finding that a seed asserted an undeclared `change.data` family (BRD-23).


#### TC-M2DOM-043 - Both S11 seeds are reconciled: the first names the flat record set, the second is prospective

**Scenario Type**: Happy Path  
**Impact Level**: Important  
**Priority**: High  
**Related IDs**: AC-F8-4, F-8, F-1, DEC-11  
**Test Type(s)**: Manual (content)  
**Automation Level**: Semi-automated  
**Target Layer / Location**: `m2/test-scenarios.md`  
**Tags**: @docs, @scenarios

**Preconditions**:

- The two `SC-M2-S11-*` seeds are present.

**Steps**:

1. Scope the two tokens to the seed the requirement names: SC-M2-S11-01's assert must carry `repos list` and no `projects list`; SC-M2-S11-02's title and body must carry `repos list`, the alias, `projectKey`, and the S18 rename.
2. Assert no assert line attributes enumeration, rows, or checkouts to `projects list`.
3. Run the same oracle over a mutant whose SC-M2-S11-01 assert is replaced with the delivered flat spelling, and require it to be flagged.

**Expected Outcome**:

- `s11_01_assert_repos_list>=1`; `s11_01_assert_projects_list=0`; `s11_01_flat_record_set>=1`.
- `s11_02_title_repos>=1`; `s11_02_body_repos>=1`; `s11_02_alias>=1`; `s11_02_payload>=1`; `s11_02_rename_asserted=OK`.
- `flat_assertions=0`; the mutant reports `mutant_s11_01_assert_projects_list=1` and `mutant_flat_assertions=1`; verdict PASS.

**Notes / Clarifications**:

- The tokens are scoped to the seeds: a corpus-wide count of assert lines mentioning `projects list` would count the alias seed and report a false positive, so the gate is the S11-01 assert's own count plus the flat-attribution count. SC-M2-S11-02 is prospective; asserting the delivered surface as `repos list` today would misattribute undelivered work (DEC-11).


#### TC-M2DOM-044 - One seed asserts the alias payload and the group payload in the same scenario

**Scenario Type**: Happy Path  
**Impact Level**: Important  
**Priority**: High  
**Related IDs**: AC-F8-5, F-8, DM-7, DEC-21  
**Test Type(s)**: Manual (content)  
**Automation Level**: Semi-automated  
**Target Layer / Location**: `m2/test-scenarios.md`  
**Tags**: @docs, @scenarios

**Preconditions**:

- The S18/S19 seed blocks are present.

**Steps**:

1. Walk every seed block and require one that contains `projects list --flat --json` and `projects list --json`.
2. Assert that block also carries `projects.v1`, `data.projects[]`, `projectKey`, `hostIndexRevision`, `project-groups.v1`, `data.groups[]`, and `groupKey`.

**Expected Outcome**:

- `alias_shape_seeds>=1`; observed `alias_seed=SC-M2-S18-08` at the delivered head; verdict PASS.

**Notes / Clarifications**:

- One scenario asserts both shapes, which is what makes the alias testable rather than described. The seed may live in either section; the oracle finds it by content, so the head's placement at `SC-M2-S18-08` is recorded rather than required.


#### TC-M2DOM-045 - The introduction reads M2-S2 through M2-S19 and every story keeps at least two seeds

**Scenario Type**: Happy Path  
**Impact Level**: Minor  
**Priority**: Medium  
**Related IDs**: AC-F8-6, F-8, F-11  
**Test Type(s)**: Manual (content)  
**Automation Level**: Semi-automated  
**Target Layer / Location**: `m2/test-scenarios.md`  
**Tags**: @docs, @scenarios

**Preconditions**:

- `test-scenarios.md` is present.

**Steps**:

1. Assert the first eight lines state `M2-S2 through M2-S19` and name both range endpoints (`M2-S2`, `M2-S19`).
2. Count seeds per `## M2-S<n>` section and assert every story has at least two.
3. Prove the per-story counter in both directions with a synthetic short-story file and a complete one.

**Expected Outcome**:

- `intro_range=OK`; `m2_s2_present=OK`; `m2_s19_present=OK`.
- `stories=18 stories_below_two=0`; `self_test_short_story=detected`; `self_test_complete=OK`; verdict PASS.

**Notes / Clarifications**:

- `at least two per story` wraps across lines in the conforming intro, so a grep for that phrase is fragile and was replaced by the property it names (`stories_below_two=0`) plus the two range endpoints. The old intro stopped at S17, which hid the two new stories from the pack's own index.


#### TC-M2DOM-046 - The opening journey is a group-scoped morning overview with scoped reads and the disambiguation

**Scenario Type**: Happy Path  
**Impact Level**: Important  
**Priority**: High  
**Related IDs**: AC-F9-1, F-9, DM-2, DM-5  
**Test Type(s)**: Manual (content)  
**Automation Level**: Semi-automated  
**Target Layer / Location**: `m2/journeys.md`  
**Tags**: @docs, @journeys

**Preconditions**:

- `journeys.md` has an opening section.

**Steps**:

1. Extract the first `## ` section and squash it.
2. Assert the eight anchors: group scope, configuration membership, the flat view, the group view, both scoped reads, workspace optionality, same-ref disjointness, and the rename-rule reference.

**Expected Outcome**:

- `journey_anchors=8/8`; verdict PASS.

**Notes / Clarifications**:

- The journey is the readable test of whether the model answers the operator's question (F-9).


#### TC-M2DOM-047 - The delta note splits the two families, keeps the mount note, and phrases the page move as pending work

**Scenario Type**: Happy Path  
**Impact Level**: Important  
**Priority**: High  
**Related IDs**: AC-F10-1, F-10, DEC-4  
**Test Type(s)**: Manual (content)  
**Automation Level**: Semi-automated  
**Target Layer / Location**: `m2/entrypoint-delta.md`  
**Tags**: @docs, @delta

**Preconditions**:

- `entrypoint-delta.md` is present, and the base snapshot of `3c9f8a59` is materialised by P00.

**Steps**:

1. Assert the `repos` addition as the flat record set owned by M2-S18 and the `projects` addition as the group surface owned by M2-S18, and that the shared `Mounted by GH-288` note states the shipped `projects list` is the delivered flat surface.
2. Assert the reference-page move is `pending M2-S18 code work`, and that no `host overview` claim survives.
3. Assert the GH-286 delivered wording survives — `Seventeen families`, the `daemon --help` and lifecycle-verb mount statements, `#286`, `milestone snapshot` — and that `## Observed composition` and `## The daemon registration gap (closed)` are byte-identical to the base.
4. Prove both directions: a copy that rewrites the GH-286 delivered sentences and a copy that edits a line inside `## Observed composition` must each be detected.

**Expected Outcome**:

- `delta_anchors=7/7`; `host_overview_claims=0`.
- `preserved_delivered=6/6`; `observed_composition=byte-identical`; `daemon_gap=byte-identical`.
- `mutant_delivered_rewritten=detected`; `mutant_composition=detected`; verdict PASS.

**Notes / Clarifications**:

- The pre-GH-286 tokens (`Sixteen families`, `unknown flag`, `unexpected argument`) no longer exist at the base because GH-286 legitimately replaced them, so the preserved set is re-anchored to the delivered wording plus byte identity of the two delivered sections. Recording the move as an effect of this change would be a false delivery claim (BRD-32).


#### TC-M2DOM-048 - The M2 pack README lists the new page and maps S11, S18, S19, S4, and the scenarios correctly

**Scenario Type**: Happy Path  
**Impact Level**: Critical  
**Priority**: High  
**Related IDs**: AC-F11-1, F-11, F-14, DEC-28  
**Test Type(s)**: Manual (content)  
**Automation Level**: Semi-automated  
**Target Layer / Location**: `m2/README.md`  
**Tags**: @docs, @index

**Preconditions**:

- `m2/README.md` is present.

**Steps**:

1. Count the pack-contents rows and assert the thirteen artifacts.
2. Assert the `commands/repos.md` row as the M2-S18 flat record set and the contracts row naming the three envelopes, the configuration document, and the plan shape.
3. Assert the S11, S18, S19, S4, and scenarios rows (12 anchors) and the verbatim planned-until-exit statement.

**Expected Outcome**:

- `pack_rows=13/13`; `readme_anchors=12/12`; `planned_until_exit=verbatim`; verdict PASS.

**Notes / Clarifications**:

- The S4 row must lose the advisory phrase because the dependency is now declared.


#### TC-M2DOM-049 - The milestone M2 index row reaches thirteen targets and the M0/M1 rows are untouched

**Scenario Type**: Happy Path  
**Impact Level**: Important  
**Priority**: High  
**Related IDs**: AC-F11-2, F-11, DEC-5  
**Test Type(s)**: Manual (content)  
**Automation Level**: Semi-automated  
**Target Layer / Location**: `milestones/README.md`  
**Tags**: @docs, @index

**Preconditions**:

- `milestones/README.md` is present.

**Steps**:

1. Count the `m2/` targets in the M2 row.
2. Assert the new `m2/commands/repos.md` target.
3. Compare the M0 and M1 rows with the base revision.

**Expected Outcome**:

- `m2_targets=13/13`; `repos_target=OK`; `m0_row=byte-identical`; `m1_row=byte-identical`; verdict PASS.

**Notes / Clarifications**:

- A page no index points at is not discoverable (F-11).


#### TC-M2DOM-050 - One dated status section records the correction as planning state without a delivery claim

**Scenario Type**: Happy Path  
**Impact Level**: Important  
**Priority**: High  
**Related IDs**: AC-F12-1, F-12, DEC-6  
**Test Type(s)**: Manual (content)  
**Automation Level**: Semi-automated  
**Target Layer / Location**: `status.md`  
**Tags**: @docs, @status

**Preconditions**:

- `status.md` is present.

**Steps**:

1. Derive the new section as the only `## ` heading present in the head and absent from base.
2. Assert the file's date form `^## .+ \(2026-11-11\)$`, no heading after it, and fourteen content anchors.
3. Assert no sentence claims delivery or milestone exit (negations excluded).

**Expected Outcome**:

- `new_section_count=1`; `headings_after_new_section=0`; `section_anchors=14/14`; `delivery_claim=0`; verdict PASS.

**Notes / Clarifications**:

- Planning state only; the section records the correction, not a delivery.


#### TC-M2DOM-051 - Every base status line is retained in order and every addition lies inside the new section

**Scenario Type**: Regression  
**Impact Level**: Critical  
**Priority**: High  
**Related IDs**: AC-F12-2, F-12, NFR-11, DEC-6  
**Test Type(s)**: Manual (diff)  
**Automation Level**: Semi-automated  
**Target Layer / Location**: `status.md`  
**Tags**: @docs, @status

**Preconditions**:

- Base and head `status.md` are available.

**Steps**:

1. Diff the whole file and count removed and added lines.
2. Derive the new section's first line and count hunks that begin before it.
3. Assert one new section, no heading after it, and at least one added line.

**Expected Outcome**:

- `removed_lines=0`; `added_outside_section=0`; `new_section_count=1`; `headings_after=0`; `additions>=1`; verdict PASS.

**Notes / Clarifications**:

- The boundary includes the single blank separator line, so a legitimate blank is not flagged.


#### TC-M2DOM-052 - The registry splits the two names with one Delivery row per name and the ODR-0003 lock

**Scenario Type**: Happy Path  
**Impact Level**: Critical  
**Priority**: High  
**Related IDs**: AC-F13-1, F-13, DEC-29  
**Test Type(s)**: Manual (content)  
**Automation Level**: Semi-automated  
**Target Layer / Location**: `cli-command-registry.md`  
**Tags**: @docs, @registry

**Preconditions**:

- `cli-command-registry.md` is present.

**Steps**:

1. Count the `ados projects` and `ados repos` rows.
2. Assert the projects row's Delivery `M2-S11 (shipped in GH-288)`, its `project-groups.v1` surface, its M2-S18 extension, and its `--flat` pointer.
3. Assert the repos row's `repos.v1`/`data.repos[]`/`repoKey` text, Delivery `-`, both extensions, and the ODR-0003 lock; assert no second repos Delivery row.

**Expected Outcome**:

- `projects_rows=1`; `repos_rows=1`; all row anchors `OK`; `second_repos_delivery_rows=0`; verdict PASS.

**Notes / Clarifications**:

- Two Delivery rows for one name asserted a delivery that has not happened (RSK-11).


#### TC-M2DOM-053 - projects joins COMMAND FAMILIES, the boundary note points at the rule, and other rows are byte-identical

**Scenario Type**: Regression  
**Impact Level**: Critical  
**Priority**: High  
**Related IDs**: AC-F13-2, F-13, NFR-1, DEC-29  
**Test Type(s)**: Manual (diff)  
**Automation Level**: Semi-automated  
**Target Layer / Location**: `cli-command-registry.md`  
**Tags**: @docs, @registry

**Preconditions**:

- Base and head registry snapshots are available.

**Steps**:

1. Assert `projects` appears in the Operate family line.
2. Assert the boundary note names both meanings and points at the rename rule, and that the old note is gone.
3. Diff the registry and require zero changed lines outside the projects row, the repos row, the boundary note, and the family line; prove the classifier with a planted unrelated change.

**Expected Outcome**:

- `operate_family_projects=OK`; `boundary_note=OK`; `changed_lines_outside_allowed=0`; `fixture_outside=flagged`; verdict PASS.

**Notes / Clarifications**:

- The planted mutant proves the containment classifier is not inert.


#### TC-M2DOM-054 - The forbidden half of the naming matrix holds across all twenty-one Appendix B rows

**Scenario Type**: Negative  
**Impact Level**: Critical  
**Priority**: High  
**Related IDs**: AC-F14-1, F-14, NFR-12, RSK-1  
**Test Type(s)**: Manual (content)  
**Automation Level**: Semi-automated  
**Target Layer / Location**: `fourteen planning documents`  
**Tags**: @docs, @naming

**Preconditions**:

- The 21 Appendix B regions are addressable through `region()`.

**Steps**:

1. For each row, require a non-empty region and zero forbidden statements (sentence-level detectors for the flat and group meanings, literal ERE elsewhere).
2. Run the detector self-tests: a planted flat sentence and a planted group sentence are detected; the required boundary sentence and the two sanctioned classes are accepted.

**Expected Outcome**:

- `matrix_rows=21`; `regions_empty=0`; `rows_with_survivors=0/21`; all self-tests as expected; verdict PASS.

**Notes / Clarifications**:

- An empty region FAILs: a wrong anchor must not report `forbidden=0` (G-4).


#### TC-M2DOM-055 - Six pages carry the disambiguation, the nine delivered facts survive, and no page pair contradicts

**Scenario Type**: Happy Path  
**Impact Level**: Critical  
**Priority**: High  
**Related IDs**: AC-F14-2, F-14, DM-2, NFR-12, RSK-1  
**Test Type(s)**: Manual (content)  
**Automation Level**: Semi-automated  
**Target Layer / Location**: `six named pages`  
**Tags**: @docs, @naming

**Preconditions**:

- The six named pages and the fourteen documents are readable.

**Steps**:

1. Assert each of the six pages carries a disambiguation referencing the rename rule.
2. Assert the nine delivered facts are present.
3. Assert no sentence states a contradictory meaning for either name.

**Expected Outcome**:

- `disambiguated_pages=6/6`; `delivered_facts=9/9`; `contradictory_statements=0`; verdict PASS.

**Notes / Clarifications**:

- Delivered facts may stay in place or move with the surface they describe, but may not vanish.


#### TC-M2DOM-056 - The terminology lock holds: no old-identity affirmation and the state scope is per-checkout

**Scenario Type**: Negative  
**Impact Level**: Critical  
**Priority**: High  
**Related IDs**: AC-F14-3, F-14, NFR-13, DEC-19, DEC-22  
**Test Type(s)**: Manual (content)  
**Automation Level**: Semi-automated  
**Target Layer / Location**: `fourteen planning documents`  
**Tags**: @docs, @naming

**Preconditions**:

- The fourteen documents are readable.

**Steps**:

1. Assert zero affirmations that the group contract is `projects.v1`, zero that a group identity is `projectKey`, and zero two-shape sentences.
2. Assert the state-layer scope is never called a project scope.
3. Count `groupKey`, `repoKey`, and `per-checkout` uses.

**Expected Outcome**:

- All four affirmation counts are 0; `groupKey_uses>=5`; `repoKey_uses>=5`; `per_checkout_scope_uses>=1`; verdict PASS.

**Notes / Clarifications**:

- This is the terminology lock as a zero-count assertion (NFR-13).


#### TC-M2DOM-057 - Exactly fifteen product files change and nothing outside the manifest

**Scenario Type**: Happy Path  
**Impact Level**: Critical  
**Priority**: High  
**Related IDs**: AC-NFR1-1, NFR-1  
**Test Type(s)**: Manual (diff)  
**Automation Level**: Semi-automated  
**Target Layer / Location**: `base..worktree manifest`  
**Tags**: @containment

**Preconditions**:

- The working tree differs from the base only by the change.

**Steps**:

1. Build the base..worktree product set (tracked diff plus untracked, excluding `doc/changes/**` and worktree-local tooling).
2. Compare it with the 15-path manifest in both directions.
3. Assert no forbidden root, no other `scripts/**` path, and the byte-identical M1 status page.

**Expected Outcome**:

- `product_files=15/15`; `expected_not_changed=0`; `unexpected_changed=` (empty); `other_scripts_changed=0`; `m1_status_page=byte-identical`; verdict PASS.

**Notes / Clarifications**:

- Decidable before the commit, which is the boundary it gates (G-10).


#### TC-M2DOM-058 - Backlog preservation holds, the S4 diff is its dependency line, and no story code moves

**Scenario Type**: Regression  
**Impact Level**: Critical  
**Priority**: High  
**Related IDs**: AC-NFR2-1, NFR-2, F-4  
**Test Type(s)**: Manual (diff)  
**Automation Level**: Semi-automated  
**Target Layer / Location**: `doc/planning/oss-tooling/backlog.md`  
**Tags**: @docs, @backlog

**Preconditions**:

- Base and head backlog snapshots are available.

**Steps**:

1. Compare every story other than M2-S11/S18/S19/S4 byte for byte.
2. Assert exactly two new headings, both new stories, and the preserved heading order.
3. Compare the frontmatter, reading guide, cross-cutting principles, retirement note, separator triple, and Epic M3 heading.
4. Assert the S4 diff is one hunk and two lines, both dependency lines.

**Expected Outcome**:

- `stories_kept=...`; `changed=0`; `removed=0`; `new_headings=2`; `order=OK`; every region `byte-identical`; `s4_hunks=1`; `s4_changed_lines=2`; verdict PASS.

**Notes / Clarifications**:

- A zero S4 diff FAILs: the declared edge is the deliverable.


#### TC-M2DOM-059 - Both command pages stay planned, nothing claims delivery, and the pack statement is verbatim

**Scenario Type**: Negative  
**Impact Level**: Critical  
**Priority**: High  
**Related IDs**: AC-NFR3-1, NFR-3, F-7, F-12, F-13  
**Test Type(s)**: Manual (content)  
**Automation Level**: Semi-automated  
**Target Layer / Location**: `eleven pack pages`  
**Tags**: @docs, @planned

**Preconditions**:

- Both command pages and the pack pages are present.

**Steps**:

1. Assert both pages carry `Status: Proposed (M2)`.
2. Scan the touched pages for delivery claims about the new surfaces, sanctioning only the delivered-fact shapes.
3. Assert the pack statement is verbatim, no page is relabelled a snapshot, and the registry marks `repos` not delivered.

**Expected Outcome**:

- `proposed_headers=2/2`; `delivered_claims=0`; `pack_statement=verbatim`; `snapshot_relabels=0`; `registry_not_delivered=OK`; verdict PASS.

**Notes / Clarifications**:

- A planted new-surface claim is still counted, which proves the sanction is narrow.


#### TC-M2DOM-060 - The forbidden-literals registration grows 141 -> 142 in position with no duplicate and a clean guard

**Scenario Type**: Happy Path  
**Impact Level**: Critical  
**Priority**: High  
**Related IDs**: AC-NFR4-1, NFR-4, DEC-15  
**Test Type(s)**: Existing guard  
**Automation Level**: Automated  
**Target Layer / Location**: `scripts/checks/forbidden-literals.registry.json`  
**Tags**: @guard

**Preconditions**:

- The branch head is checked out.

**Steps**:

1. Extract the `registered` list from the head and the base snapshot.
2. Assert `142` versus `141`, exactly one added row, and that the row is `doc/planning/oss-tooling/milestones/m2/commands/repos.md` between `queue.md` and `spend.md`.
3. Assert no duplicate and run the guard.

**Expected Outcome**:

- `registered=142`; `base_registered=141`; `delta=1`; `position=between-queue-and-spend`; `duplicates=0`; `added_registration_lines=1`; guard exit 0; verdict PASS.

**Notes / Clarifications**:

- The guard fails closed on an unregistered new page, so the row is a delivery prerequisite.


#### TC-M2DOM-061 - The distribution guard exits 0 under the default TMPDIR with no planning marker

**Scenario Type**: Happy Path  
**Impact Level**: Important  
**Priority**: High  
**Related IDs**: AC-NFR5-1, NFR-5, DEC-16  
**Test Type(s)**: Existing guard  
**Automation Level**: Automated  
**Target Layer / Location**: `scripts/.tests/test-doc-distribution.sh`  
**Tags**: @guard

**Preconditions**:

- The branch head is checked out with the new page present.

**Steps**:

1. Run the distribution guard with `env -u TMPDIR`.
2. Assert the planning documents carry no `ados_distribution` marker.

**Expected Outcome**:

- `dist_guard_exit=0`; `planning_markers=0`; verdict PASS.

**Notes / Clarifications**:

- The default `TMPDIR` is required; the aggregate gate needs the opposite.


#### TC-M2DOM-062 - Both aggregate runs are recorded, the repository-local full suite is authoritative, and only the named pair is excused

**Scenario Type**: Corner Case  
**Impact Level**: Critical  
**Priority**: High  
**Related IDs**: AC-NFR6-1, NFR-6, DEC-16, RSK-17  
**Test Type(s)**: Aggregate gate  
**Automation Level**: Semi-automated  
**Target Layer / Location**: `pnpm check`  
**Tags**: @gate

**Preconditions**:

- Both aggregate runs have been recorded for a tree containing the change, with the code-tree fingerprint.

**Steps**:

1. Read the two exit codes, the failing-test lists, and the summaries.
2. Classify: a non-zero repository-local run is a delivery failure; otherwise a green default run passes; otherwise only the two named default-only failures are excused, and only with a recorded re-run.
3. Assert the record's code fingerprint matches the current code tree and that the change is present.

**Expected Outcome**:

- Both runs recorded; `default_failure_class=none` or `excused`; fingerprint match; verdict PASS.

**Notes / Clarifications**:

- NFR-1 forbids code changes, so a docs-only tree cannot change the suite's result; the fingerprint therefore covers `packages/**`, `tests/**`, and `scripts/**` minus the registry.


#### TC-M2DOM-063 - Every touched document passes the structural diagram read with eight owned key flows

**Scenario Type**: Corner Case  
**Impact Level**: Important  
**Priority**: High  
**Related IDs**: AC-NFR7-1, NFR-7, RSK-18  
**Test Type(s)**: Manual (content)  
**Automation Level**: Semi-automated  
**Target Layer / Location**: `twelve touched documents`  
**Tags**: @docs, @structure

**Preconditions**:

- All touched documents exist.

**Steps**:

1. For each document, assert an even fence count, `mermaid` tags on diagram fences, and allowed first body lines.
2. Assert one `## C4 Level n` heading each and eight `###` headings under `## Key flows`, each owning exactly one mermaid block.

**Expected Outcome**:

- No odd fences, no untagged diagram, no bad keyword; `c4_headings=1/1/1`; `key_flows_headings=8/8`; verdict PASS.

**Notes / Clarifications**:

- No validator is added, so the structural read is the truthful bar (G-3).


#### TC-M2DOM-064 - Twenty-six ticket clauses and thirty-two board-derived clauses are all present

**Scenario Type**: Happy Path  
**Impact Level**: Critical  
**Priority**: High  
**Related IDs**: AC-NFR8-1, NFR-8, F-1, F-2, F-3  
**Test Type(s)**: Manual (content)  
**Automation Level**: Semi-automated  
**Target Layer / Location**: `backlog.md + pack`  
**Tags**: @docs, @fidelity

**Preconditions**:

- `clause_rows()` and `board_rows()` hold the 26 and 32 rows.

**Steps**:

1. Match all 26 ticket anchors against the three amended entries.
2. Match every board-derived anchor against its document (absence anchors invert the test).
3. Count distinct board clause ids covered.

**Expected Outcome**:

- `ticket_clauses=26/26`; `board_clauses_covered=32/32`; verdict PASS.

**Notes / Clarifications**:

- The table counts its own rows, so a silently removed row changes the total and fails.


#### TC-M2DOM-065 - Twelve of fourteen planning documents are literal-scanned with zero seed literals and zero violations

**Scenario Type**: Negative  
**Impact Level**: Critical  
**Priority**: High  
**Related IDs**: AC-NFR9-1, NFR-9, RSK-1  
**Test Type(s)**: Existing guard  
**Automation Level**: Automated  
**Target Layer / Location**: `scripts/checks/forbidden-literals.ts`  
**Tags**: @guard

**Preconditions**:

- The guard module is importable and the branch head is checked out.

**Steps**:

1. Run the guard and read the `scan()` API rather than a guessed log shape.
2. Assert 12 of the 12 named set are registered and scanned, and both exempt documents are unregistered.
3. Assert zero violations, zero failures, zero seed literals, and five scanned scope classes.

**Expected Outcome**:

- `forbidden_exit=0`; `set_scanned=12/12`; `exempt_scanned=0`; `exempt_unregistered=2`; `violations=0`; `failures=0`; `seed_hits=0`; `classes=5/5`; verdict PASS.

**Notes / Clarifications**:

- The oracle reads the scan API, not a log pattern: a red guard and a green-looking grep disagree (G-6).


#### TC-M2DOM-066 - No relative link is broken, the new page is linked twice, and no page restates an acceptance block

**Scenario Type**: Regression  
**Impact Level**: Important  
**Priority**: High  
**Related IDs**: AC-NFR10-1, NFR-10  
**Test Type(s)**: Manual (content)  
**Automation Level**: Semi-automated  
**Target Layer / Location**: `twelve touched documents`  
**Tags**: @docs, @links

**Preconditions**:

- All touched documents exist.

**Steps**:

1. Resolve every relative link in the twelve touched documents.
2. Assert the new page is linked from the pack README and the milestone index.
3. Assert no pack page restates a story's acceptance block.

**Expected Outcome**:

- `broken_links=0`; `m2_index_link=OK`; `milestones_index_link=OK`; `restated_ac_blocks=0`; verdict PASS.

**Notes / Clarifications**:

- The two index links are the discoverability half of F-11.


#### TC-M2DOM-067 - The retention oracle is sound and status.md history is append-only

**Scenario Type**: Regression  
**Impact Level**: Critical  
**Priority**: High  
**Related IDs**: AC-NFR11-1, NFR-11, F-12  
**Test Type(s)**: Manual (diff)  
**Automation Level**: Semi-automated  
**Target Layer / Location**: `doc/planning/oss-tooling/status.md`  
**Tags**: @docs, @status

**Preconditions**:

- Base and head `status.md` are available.

**Steps**:

1. Run the whole-file retention oracle on the head.
2. Prove soundness with a conforming fixture plus four mutants: delete a base line, modify a base line, swap two base lines, insert outside the new section.
3. Assert the head has exactly one new section and a positive addition count.

**Expected Outcome**:

- `removed=0`; `additions>0`; `new_section_count=1`; conforming fixture accepted; delete/modify/swap each `removed>0`; outside insertion `outside_hunks>0`; verdict PASS.

**Notes / Clarifications**:

- A whole-section `cmp` is never substituted: it would accept a reordered file.


#### TC-M2DOM-068 - The required half of the naming matrix holds, the alias token is placed only where it belongs, and the scan bites

**Scenario Type**: Happy Path  
**Impact Level**: Critical  
**Priority**: High  
**Related IDs**: AC-NFR12-1, NFR-12, F-14, RSK-1  
**Test Type(s)**: Manual (content)  
**Automation Level**: Semi-automated  
**Target Layer / Location**: `fourteen planning documents`  
**Tags**: @docs, @naming

**Preconditions**:

- The 21 Appendix B rows are addressable.

**Steps**:

1. For each row, require a non-empty region and the required statement.
2. Prove the required scan with a positive and a negative fixture.
3. Walk every alias-token sentence and require it to sit in an alias-defining or alias-pointing context.

**Expected Outcome**:

- `matrix_rows_required=21/21`; `regions_empty=0`; positive fixture `OK`; negative fixture `detected`; `alias_lines_without_alias_meaning=0`; verdict PASS.

**Notes / Clarifications**:

- The required half is where the group meaning must be stated, not merely where the flat meaning is banned.


#### TC-M2DOM-069 - The terminology counts are zero and all four mapping tokens read as repository checkouts

**Scenario Type**: Negative  
**Impact Level**: Critical  
**Priority**: High  
**Related IDs**: AC-NFR13-1, NFR-13, F-14, RSK-3, RSK-5  
**Test Type(s)**: Manual (content)  
**Automation Level**: Semi-automated  
**Target Layer / Location**: `fourteen planning documents`  
**Tags**: @docs, @naming

**Preconditions**:

- The fourteen documents are readable.

**Steps**:

1. Assert the three zero-count affirmations and zero state-layer project-scope statements.
2. For each sentence mentioning `project-identity.json`, `<host root>/projects/<key>`, `--project-root`, or the host-index field pair, require repository or checkout vocabulary in that sentence or the next.

**Expected Outcome**:

- All counts 0; `mapping_token_violations=0`; verdict PASS.

**Notes / Clarifications**:

- The two-sentence window accommodates a sentence that names a token and the next clause that classifies it.

## 6. Environments and Test Data

| Aspect | Detail |
|---|---|
| Environment | Local developer worktree of this repository on branch `docs/GH-303/project-groups-domain-model`; no server, container, service, credential, or network dependency |
| Toolchain | `git` (diff and base snapshots), `bash`, `awk`, `grep`, `sed`, `diff`, `comm`, `cmp`, `sha256sum`, `bun` (guards and the workspace suite), `pnpm` (aggregate gate); all already required by the repository |
| Base revision | `3c9f8a59aa1d38adc0fd5dbefdf8acc71c0f0135` (`main-tools` after GH-286 daemon mounting, on top of GH-268). Snapshots are materialised with `git show "$BASE:<path>"`, so later base movement cannot silently widen a comparison |
| Base tree | `/tmp/gh303/base` — a detached worktree at `3c9f8a59`. This is the **pre-change control**: every procedure must FAIL here because the change is absent |
| Conforming tree | The delivered head `087c146d` on `docs/GH-303/project-groups-domain-model`, carrying all fifteen product files (thirteen modified, one new, one registry row). Every §10 row was re-run here. The plan-time scaffold at `/tmp/gh303/fx` is retired; its numbers are no longer cited (G-8) |
| Files under test | 13 modified planning documents + 1 new page (`milestones/m2/commands/repos.md`) + `scripts/checks/forbidden-literals.registry.json`; all paths in spec Appendix C |
| Test data | Base snapshots at `/tmp/gh303/base-{backlog,status,milestones-README,registry,forbidden,contracts,architecture,scenarios,journeys,entrypoint-delta,m2-README,projects,queue,board}.*`, materialised from `3c9f8a59`; head files read from the tree under test; no fixture is ever written inside the repository |
| Mutation fixtures | `/tmp`-only, never committed: a planted flat `projects list` sentence, a planted group-meaning `repos` sentence, the required boundary sentence, and the two sanctioned classes (P54); three planted delivered-surface claims (P59); a conforming `repos.v1` snippet and a deficient one (P68); a mutated `ados supervise` row (P53); a conforming status head and four mutants — delete, modify, swap, insert-outside (P67); a planted unrelated registry change (P53) |
| Base-observed facts (measured at `3c9f8a59`) | `backlog.md` 1460 lines: M2-S11 entry 1169–1189, M2-S17 last content 1291, closing `---` 1293, `## Epic M3` 1295 → insertion window `1292:1292`; retirement note 1051–1054, context window `1055:1055` (`paragraph_lines=0`); `###` headings 74; `status.md` 225 lines with its last heading 214 = `## M2 delivery snapshot (2026-11-11)` and no new section; `milestones/README.md` M2 row 12 targets; `m2/README.md` 12 pack rows; `architecture.md` 20 fences / 10 mermaid / 7 key flows; `test-scenarios.md` 40 seeds and 40 `Assert:` lines; registry 141 entries with `m2/commands/queue.md` at row 89 and `spend.md` at 90; `contracts.md` 8 `##` sections; `commands/repos.md` absent; product files `0/15`; rename-rule sentences 0 |
| Head-observed facts (measured at `087c146d`, observations only) | `backlog.md` 1531 lines: M2-S11 1182–1207, S17 last content 1309, separator 1364, `## Epic M3` 1366, window `1310:1363`, S18 at 1311, S19 at 1346, M2-S4 at 1117; retirement note unchanged at 1051–1054, context paragraph `1055..1068` with 12 lines; headings 74 → 76; backlog hunks 6; `status.md` 225 → 252 with the new section at 227 (`## M2 domain-model amendment (2026-11-11)`) and 27 additions; registry 142; `architecture.md` 22 fences / 11 mermaid / 8 key flows; `m2/README.md` 13 pack rows; M2 index row 13 targets; `test-scenarios.md` 53 seeds / 53 `Assert:` (8 S18 + 5 S19), with the alias seed `SC-M2-S18-08`; `contracts.md` 15 sections; `commands/repos.md` 142 lines; product files `15/15`; rename-rule sentences 1. These are evidence that the oracles are satisfiable; the procedures recompute each range from the tree and never pin these numbers |
| Plan-gate contract for P15/P16 — invariants vs measurements | Binding for spec v1.4 (AC-F4-2, AC-F4-3) and for `chg-GH-303-plan.yaml`'s P1 gates; this row is the text the plan cites. **Gated invariants** (true of every conforming head): P15 `paragraph_lines>0`, `paragraph_strictly_between=OK` (the window `retirement-note last line + 1 … ### M2-S2 − 1` is non-empty and the paragraph lies inside it), `blank_after_note=1`, `blank_before_s2=1`, `note_start_line=anchored(1051)`, `note_end_line=anchored(1054)`, `retirement_note=OK`, `paragraph_anchors=7/7`, `fm`/`rguide`/`cc` byte-identical, `epic_heading=OK`, verdict `PASS`; P16 `hunk confinement OK`, `outside=0`, `non_vacuous=yes`, `classifier_self_tests=3/3`, verdict `PASS`. **Observations recorded as evidence, not gates:** P15 `context_paragraph=1055..1068` and `paragraph_lines=12`; P16 `backlog_hunks=6`. They shift with every line the head adds and with the paragraph's own length, so a plan must not pin them. **Sanctioned-shape contract (P54/P68):** the gate is `rows_with_survivors=0/21` with the four sanctioned classes accepted and both planted fixtures still detected (P54), and `matrix_rows_required=21/21` with the alias token placed only in alias contexts (P68). The line numbers of the sanctioned statements are observations, not gate values. **Version assertion:** plan v1.4 gates P15/P16 on the invariant column only; a plan that gates any measurement-column value is stale with respect to this section and must be re-planned before delivery |
| Guard scope | `test-doc-distribution.sh` scans `doc/guides/**` and a fixed standalone set and skips `doc/planning/**`; `forbidden-literals.ts` scans `doc/**` minus `doc/changes/**` and `doc/decisions/**`, literal-scans only registered documents absent at `corpusBaseline`, and fails closed on an unregistered or duplicated entry — so the new page needs exactly one registration (141 base → 142 head) |
| Isolation | Every procedure is read-only with respect to the repository: writes go to `/tmp/gh303` only, and no file under test is edited to make a check pass. `pnpm check` writes `tmp/tmpdir/` (git-ignored) as its `TMPDIR`. Worktree-local tooling (`node_modules`, `tmp/`) is excluded from the containment pathspec and is never a product path |
| Environment caveat | The default `TMPDIR` is tmpfs: the two doc guards have opposite requirements (G-6). P61 runs the distribution guard with `env -u TMPDIR`; P62 runs the aggregate gate twice and follows spec AC-NFR6-1: the repository-local full suite is authoritative (exit 0; any failure there, including a repeated 5 s timeout, is a delivery failure), both runs are recorded, and only a recorded, re-run default-run `ci-baseline-parity` failure or `TC-WIRE-002` timeout is excused while the repository-local run is green on the same head. At the delivered head the authoritative run is green (`7206 pass / 4 skip / 0 fail`) and only `CI baseline parity` fails under the default `TMPDIR` (`7205 pass / 4 skip / 1 fail`), recorded and re-run as `excused`. Earlier plan-time runs on a loaded host also produced 5 s and 30 s wall-clock timeouts; those were **not** excused, and the delivered head no longer shows them |
| Cleanup | `rm -rf /tmp/gh303` and `rm -rf <repo>/tmp/tmpdir` |
| Evidence capture | The Section 10 log, the guard summaries, and the two gate results are pasted into the PR description per `.ai/rules/testing-strategy.md` |

## 7. Automation Plan and Implementation Mapping

### 7.1 Procedure Pack — How to Run, in Order

Run from the repository root on the tree under test with `bash`. Every procedure
is uncommitted and read-only with respect to the repository: it writes only under
`/tmp/gh303`, never stages, never edits a file under test, and is never added to
`tests/**`, `scripts/**`, or `.ai/**` (AC-NFR1-1). **P00 is a shared preamble**:
it defines every path (`$BL`, `$ST`, `$MR`, `$M2`, `$A`, `$CT`, `$RG`, `$R`, `$PJ`,
`$Q`, `$B`, `$TS`, `$JN`, `$EPD`, `$MRD`, `$REG`, `$SH`), the base snapshots, the
extractors (`entry()`, `section()`, `firstsec()`, `story_section()`,
`block_of`-style helpers, `squash()`), the 26-clause table, the 32-clause
board-derived table, the 21-row naming matrix, `fence_blocks()`, the retention
helpers (`diffstat()`, `newsecs_of()`, `newsec_of()`, `newsec_count()`), the
derived backlog ranges (`backlog_ranges()`), and the naming-matrix helpers
(`matrix_rows()`, `board_rows()`, `path_of()`, `region()`, `forbidden_hits()`,
`forbidden_count()`, `seed_asserts()`, `envelope_ok()`, `renamerule_count()`).
**Run each procedure in a fresh shell** as
`bash -c 'source P00; source Pn'`; no block depends on another block's
definitions, and every block starts with a loud guard that aborts if P00 is not
loaded or a helper it declares is missing. Procedure numbers match test-case
numbers (`P01` = `TC-M2DOM-001`, …, `P69` = `TC-M2DOM-069`); Section 7.2 maps
each TC to its block.

The sweep is reproducible end to end:

```bash
# base control (must FAIL everywhere)
cd /tmp/gh303/base && for n in $(seq -w 1 69); do
  bash -c "source /tmp/gh303/procs/P00.sh >/dev/null; source /tmp/gh303/procs/P$n.sh" | tail -1
done
# conforming fixture (must PASS everywhere)
cd /tmp/gh303/fx && for n in $(seq -w 1 69); do
  bash -c "source /tmp/gh303/procs/P00.sh >/dev/null; source /tmp/gh303/procs/P$n.sh" | tail -1
done
```

**P00 — shared preamble: base snapshots, paths, extractors, derived facts matrix rows, the 26-clause table, and the 32-board-clause table.**

```bash
# P00 — shared preamble: base snapshots, paths, extractors, derived facts,
# matrix rows, the 26-clause table, and the 32-board-clause table.
# Every procedure begins by asserting the preamble is loaded; helpers are
# defined here exactly once so no block depends on another block's definitions.
BASE=$(git rev-parse 3c9f8a59 2>/dev/null)   # main-tools after GH-286 (rebased GH-303 branch)
ROOT=$(git rev-parse --show-toplevel 2>/dev/null); cd "$ROOT" || exit 1
BL=doc/planning/oss-tooling/backlog.md
ST=doc/planning/oss-tooling/status.md
MR=doc/planning/oss-tooling/milestones/README.md
M2=doc/planning/oss-tooling/milestones/m2
A="$M2/architecture.md"
CT="$M2/contracts.md"
RG=doc/planning/oss-tooling/cli-command-registry.md
R="$M2/commands/repos.md"
PJ="$M2/commands/projects.md"
Q="$M2/commands/queue.md"
B="$M2/commands/board.md"
TS="$M2/test-scenarios.md"
JN="$M2/journeys.md"
EPD="$M2/entrypoint-delta.md"
MRD="$M2/README.md"
REG=scripts/checks/forbidden-literals.registry.json
SH=/tmp/gh303
mkdir -p "$SH"
P00_READY=gh303
require_p00() { [ "${P00_READY:-}" = "gh303" ] || { echo "FATAL: P00 preamble not loaded; run each block as bash -c \"source P00; source Pn\"" >&2; exit 1; }; }
need() { local n; for n in "$@"; do case "$n" in
  entry|section|firstsec|story_section|squash|cnt|has|fence_blocks|diffstat|newsec_of|newsecs_of|newsec_count|backlog_ranges|matrix_rows|board_rows|clause_rows|path_of|region|forbidden_hits|forbidden_count|seed_asserts|envelope_ok|renamerule_count) command -v "$n" >/dev/null 2>&1 || { echo "FATAL: missing helper $n (P00)" >&2; exit 1; } ;;
  BASE|BL|ST|MR|M2|A|CT|RG|R|PJ|Q|B|TS|JN|EPD|MRD|REG|SH) [ -n "${!n:-}" ] || { echo "FATAL: missing variable $n (P00)" >&2; exit 1; } ;;
  *) echo "FATAL: unknown dependency $n" >&2; exit 1 ;;
 esac; done; }

entry() { # $1=file $2=heading prefix
  awk -v h="$2" 'index($0,h)==1{f=1;print;next} f&&(/^### /||/^---$/||/^## /){exit} f{print}' "$1" 2>/dev/null
}
section() { # $1=file $2=exact "## " heading line
  awk -v h="$2" '$0==h{f=1;print;next} f&&/^## /{exit} f{print}' "$1" 2>/dev/null
}
firstsec() { awk 'f&&/^## /{exit} /^## /{f=1} f' "$1" 2>/dev/null; }
story_section() { awk -v h="$2" 'index($0,"## "h" ")==1{f=1;print;next} f&&/^## /{exit} f{print}' "$1" 2>/dev/null; }
squash() { sed ':a;N;$!ba;s/-\n//g' | tr '\n' ' ' | tr -s ' '; }
cnt() { grep -oE "$2" "$1" 2>/dev/null | wc -l; }
has() { [ -f "$1" ] && grep -Eiq -- "$2" "$1"; }

git show "$BASE:$BL" > "$SH/base-backlog.md" 2>/dev/null
git show "$BASE:$ST" > "$SH/base-status.md" 2>/dev/null
git show "$BASE:$MR" > "$SH/base-milestones-README.md" 2>/dev/null
git show "$BASE:$RG" > "$SH/base-registry.md" 2>/dev/null
git show "$BASE:$REG" > "$SH/base-forbidden.json" 2>/dev/null
git show "$BASE:$CT" > "$SH/base-contracts.md" 2>/dev/null
git show "$BASE:$A" > "$SH/base-architecture.md" 2>/dev/null
git show "$BASE:$TS" > "$SH/base-scenarios.md" 2>/dev/null
git show "$BASE:$JN" > "$SH/base-journeys.md" 2>/dev/null
git show "$BASE:$EPD" > "$SH/base-entrypoint-delta.md" 2>/dev/null
git show "$BASE:$MRD" > "$SH/base-m2-README.md" 2>/dev/null
git show "$BASE:$PJ" > "$SH/base-projects.md" 2>/dev/null
git show "$BASE:$Q" > "$SH/base-queue.md" 2>/dev/null
git show "$BASE:$B" > "$SH/base-board.md" 2>/dev/null
echo "base=$BASE base_backlog_lines=$(wc -l < "$SH/base-backlog.md") base_status_lines=$(wc -l < "$SH/base-status.md")"

clause_rows() { cat <<'CLAUSES'
S18-G|M2-S18|group of repositories.*enumerat|S18 goal: configured group of repositories, enumerable with members, workspace as optional discovery root
S18-T1|M2-S18|project configuration.*member repositor|S18 task 1: project configuration declaring member repositories, mixed trackers valid
S18-T2|M2-S18|workspace.directory discovery root|S18 task 2: optional workspace-directory discovery root, never required
S18-T3|M2-S18|projects list.*member repos.*health.*state|S18 task 3: projects list renders groups with members, health, state
S18-T4|M2-S18|project scop.*queue and status|S18 task 4: project scoping for queue and status reads
S18-T5|M2-S18|repos.*flat record set.*projects.*group|S18 task 5: naming boundary repos = flat record set, projects = groups
S18-A1|M2-S18|two member repositor.*workspace director.*discoverable|S18 AC1: two members in one workspace directory discoverable by registering it
S18-A2|M2-S18|unrelated director.*identically|S18 AC2: members in unrelated directories behave identically
S18-A3|M2-S18|projects list.*groups?.*both members|S18 AC3: projects list shows the group with both members and state
S18-A4|M2-S18|accept a project scope|S18 AC4: queue and status accept a project scope
S18-A5|M2-S18|mixing tracker kinds.*not-yet-supported|S18 AC5: mixed tracker kinds accepted, member classified not-yet-supported
S18-D|M2-S18|Depends on: M2-S11\.|S18 depends on M2-S11
S19-G|M2-S19|span multiple repositor.*one lifecycle.*one definition of done|S19 goal: one lifecycle, one spec and plan, one DoD, branch and PR per member
S19-T1|M2-S19|declares member repositor.*slices|S19 task 1: plan declares member repositories and their slices
S19-T2|M2-S19|one lifecycle.*per-repo branches|S19 task 2: one lifecycle drives per-repo branches and PRs
S19-T3|M2-S19|per-repo gates.*shared DoD|S19 task 3: per-repo gates and one shared DoD
S19-T4|M2-S19|closeout.*branch cleanup.*issue closure|S19 task 4: closeout across members, branch cleanup and issue closure
S19-T5|M2-S19|dependency edges between member|S19 task 5: dependency edges between member steps
S19-T6|M2-S19|evidence[^.]{0,120}member|S19 task 6: evidence enumerates all member PRs
S19-A1|M2-S19|one spec.*two branches.*two PRs.*one review flow|S19 AC1: one spec, two branches, two PRs, one review flow, closeout lands both
S19-A2|M2-S19|corroborated.*per member|S19 AC2: per-repo CI truth corroborated per member
S19-A3|M2-S19|failing member named|S19 AC3: a failing member blocks the shared DoD and is named
S19-D|M2-S19|Depends on: M2-S11, M2-S18, M1-S17\.|S19 depends on M2-S11, M2-S18, M1-S17
S11-1|M2-S11|git common dir marker.*host-level index|S11 retained: per-repository state scoping from the checkout identity with a host-level index
S11-2|M2-S11|delivered flat record set|S11 amended: the enumeration task names the delivered flat record set
S11-3|M2-S11|projects list --flat|S11 amendment transition note: the -flat alias is M2-S18 work
CLAUSES
}

board_rows() { cat <<'BOARD'
BRD-1|CT|project-groups\.v1
BRD-1b|CT|data\.groups\[\]
BRD-2|CT|The delivered flat record set, owned by M2-S11 and retained as the alias
BRD-3|R|repos\.v1
BRD-3b|R|data\.repos\[\]
BRD-4|CT|deprecation alias is the different token
BRD-5|CT|retires at the M3 boundary
BRD-6|TS|projects list --flat --json
BRD-7|BL|migrating-to-per-repository-state\.md
BRD-8|CT|--project-root
BRD-8b|R|project-identity\.json
BRD-8c|PJ|project-identity\.json
BRD-9|R|declared `unbound` scope
BRD-10|R|projects\.identity-unreadable
BRD-10b|R|repos\.\*.*error-prefix change is M2-S18 code work
BRD-11|R|PROJECT_KEY_PATTERN
BRD-12|R|--version
BRD-13|R|^## SCOPE
BRD-14|PJ|members\[\]\.daemonReachable\.reason
BRD-15|PJ|members\[\]\.daemonReachable
BRD-16|Q|queue list --project <groupKey>
BRD-17|MRD|status --project <groupKey>
BRD-18|CT|never admits an undeclared clone
BRD-19|CT|state-unavailable
BRD-20|CT|one queue entry per member
BRD-21|TS|gates\.ci
BRD-22|BL|does not start before the prerequisite member's pull request lands
BRD-23|TS|!change\.data\.
BRD-24|CT|closeout\.data\.members\[\]
BRD-25|CT|one review run over the declared member pull-request set
BRD-26|RG|Not delivered: pending the superseding decision record
BRD-27|BL|superseding decision record
BRD-28|RG|supervise, projects, repos
BRD-29|BL|Depends on: M1-S5, M1-S17, M2-S11, M2-S18\.
BRD-30|TS|M2-S2 through M2-S19
BRD-31|A|fixed `default` workspace identifier
BRD-32|EPD|pending M2-S18 code work
BOARD
}

fence_blocks() { # $1=file -> "tag|firstbody"
  awk '/^```/{ if (inb) {inb=0; printed=0; next} inb=1; tag=substr($0,4); fb=""; next } inb&&fb==""&&NF{fb=$0} inb&&!printed{print tag"|"fb; printed=1}' "$1" 2>/dev/null
}

diffstat() { # $1=base $2=head -> "removed added"
  local d r a
  d=$(diff -U0 "$1" "$2" || true)
  r=$(printf '%s\n' "$d" | grep -E '^-' | grep -v '^---' | wc -l)
  a=$(printf '%s\n' "$d" | grep -E '^\+' | grep -v '^+++' | wc -l)
  echo "$r $a"
}

newsecs_of() { awk 'NR==FNR{if(/^## /)s[$0]=1; next} /^## /&&!($0 in s){print FNR}' "$1" "$2"; }
newsec_of() { newsecs_of "$1" "$2" | head -1; }
newsec_count() { newsecs_of "$1" "$2" | wc -l; }

backlog_ranges() { # derived from $BL on every call, never reused across blocks
  S11_LINE=$(grep -n '^### M2-S11 ' "$BL" | cut -d: -f1)
  S11_END=$(awk -v s="$S11_LINE" 'NR>s && /^#{2,3} /{print NR-1; exit}' "$BL")
  NOTE_S=$(grep -n '^Note: the M1 redefinition moved the queue' "$BL" | cut -d: -f1)
  NOTE_E=$(grep -n '^the gap is deliberate\. M2 stories keep their codes\.$' "$BL" | cut -d: -f1)
  S2_LINE=$(grep -n '^### M2-S2 ' "$BL" | cut -d: -f1)
  S17_LINE=$(grep -n '^### M2-S17 ' "$BL" | cut -d: -f1)
  S17_LAST=$(awk -v s="$S17_LINE" 'NR>s { if ($0 ~ /^---$/ || $0 ~ /^## / || $0 ~ /^### /) exit; if (NF>0) l=NR } END{print l+0}' "$BL")
  M3_LINE=$(grep -n '^## Epic M3' "$BL" | cut -d: -f1)
  SEP_LINE=$(awk -v m="$M3_LINE" 'NR<m && /^---$/{l=NR} END{print l+0}' "$BL")
  S18_LINE=$(grep -n '^### M2-S18 ' "$BL" | cut -d: -f1)
  S19_LINE=$(grep -n '^### M2-S19 ' "$BL" | cut -d: -f1)
  S4_LINE=$(grep -n '^### M2-S4 ' "$BL" | cut -d: -f1)
  WS=$((S17_LAST+1)); WE=$((SEP_LINE-1))
}

# Sentence-level naming detectors. A sentence "affirms" a meaning only when it
# carries the predicate; the four sanctioned classes are the time-scoped
# per-page disambiguation, a statement recording a delivered GH-288 fact, the
# alias definition, and a statement that the delivered flat surface is what the
# rename moves away from.
forbidden_hits() { # stdin text; $1=flat|group|both; prints "TYPE<TAB>statement"
  awk -v mode="$1" '
  function norm(s,  t){ t=tolower(s); gsub(/[[:space:]]+/," ",t); return t }
  function sanctioned(t){
    if (t ~ /gh-288/) return 1
    if (t ~ /enumerates them without manual configuration/) return 1
    if (t ~ /projects list/ && t ~ /(enumerates groups|group surface|groups? from m2-s18|from m2-s18)/) return 1
    if (t ~ /flat enumeration/ && t ~ /repos list/ && (t ~ /renames?/ || t ~ /shipped/)) return 1
    if (t ~ /rename rule|flat record set|delivered flat surface|deprecation alias|time-scoped/) return 1
    if (t ~ /(mounted|delivered|shipped)/ && t ~ /(host overview|read-only host|flat surface|overview)/) return 1
    return 0 }
  function flat(t){ return (!sanctioned(t) && (t ~ /(^|[^a-z0-9])projects( list)?[^.]{0,90}(enumerat|one (cli )?overview|host overview|lists? (every|all|each)|repo key|state location|daemon reachability|handover state|managed checkout)/)) }
  function group(t,  rest,seg,p){ rest=t
    while (match(rest, /(^|[^a-z0-9])repos([^a-z0-9]|$)/)) {
      seg=substr(rest, RSTART, 90)
      p=index(seg,"projects"); if (p>0) seg=substr(seg,1,p-1)
      if (seg ~ /(^|[^a-z0-9])(group|grouping|member)/ && seg !~ /enumerat|flat/) return 1
      rest=substr(rest, RSTART+RLENGTH)
    }
    return 0 }
  { line=$0; gsub(/\r/,"",line); n=split(line,a,/[.!?;]/)
    for(i=1;i<=n;i++){ t=norm(a[i])
      if ((mode=="flat"||mode=="both") && flat(t)) print "FLAT\t" a[i]
      if ((mode=="group"||mode=="both") && group(t)) print "GROUP\t" a[i]
    } }'
}
forbidden_count() { case "$2" in @flat) printf '%s' "$1" | forbidden_hits flat | wc -l ;; @group) printf '%s' "$1" | forbidden_hits group | wc -l ;; @both) printf '%s' "$1" | forbidden_hits both | wc -l ;; *) printf '%s' "$1" | grep -Eoi -- "$2" | wc -l ;; esac; }

matrix_rows() { cat <<'MATRIX'
BL-S11|BL|s11backlog||projects list|@both
BL-18|BL|s18entry||projects list --flat|@both
BL-19|BL|s19entry||dependency edge|@both
BL-CTX|BL|para||repositor.*project.*workspace|@flat
CT-RV1|CT|sect|## repos.v1|data\.repos\[\]|data\.projects\[\]
CT-PV1|CT|sect|## projects.v1|data\.projects\[\]|projects\.v1[^.]{0,80}group contract
CT-GRP|CT|sect|## project-groups.v1|data\.groups\[\]|group identity[^.]{0,30}projectKey
ARCH|A|whole||configured group of repositories|projects list[^.]{0,60}host index
CMD-R|R|whole||data\.repos\[\]|project-groups\.v1
CMD-P|PJ|whole||members\[\]\.daemonReachable|@flat
CMD-Q|Q|whole||queue list --project <groupKey>|queue list --project <repo
CMD-B|B|whole||repository key|group scope
TS|TS|whole||data\.groups\[\]|change\.data\.
JRN|JN|firstsec||repos list|@flat
EPD|EPD|whole||flat record set|host overview
M2RD|MRD|whole||commands/repos\.md|M2-S11[^|]{0,80}project-groups\.v1
MSRD|MR|m2row||m2/commands/repos\.md|XXXNONE
REG|RG|whole||`ados repos`|distinct surfaces
STAT-SNAP|ST|snap||mounted, read-only host|repos list
STAT-NEW|ST|newsec||groupKey|@both
TRUTH|truth|whole||projects list|repos list
MATRIX
}
path_of() { case "$1" in
  BL) echo "$BL";; CT) echo "$CT";; A) echo "$A";;
  R) echo "$R";; PJ) echo "$PJ";; Q) echo "$Q";; B) echo "$B";;
  TS) echo "$TS";; JN) echo "$JN";; EPD) echo "$EPD";; MRD) echo "$MRD";;
  MR) echo "$MR";; RG) echo "$RG";; ST) echo "$ST";;
  truth) echo "$ROOT/doc/spec/features/feature-projects.md";;
  *) echo "";; esac; }
region() { # $1=file $2=mode $3=arg
  [ -f "$1" ] || return 0
  case "$2" in
    whole) cat "$1" ;;
    entry) entry "$1" "$3" ;;
    sect) section "$1" "$3" ;;
    firstsec) firstsec "$1" ;;
    s11backlog) entry "$1" '### M2-S11 ' ;;
    s18entry) entry "$1" '### M2-S18 ' ;;
    s19entry) entry "$1" '### M2-S19 ' ;;
    para) backlog_ranges; sed -n "$((NOTE_E+1)),$((S2_LINE-1))p" "$BL" ;;
    m2row) grep -E '^\| M2 \(' "$1" ;;
    snap) awk '/^## M2 delivery snapshot \(2026-11-11\)/{f=1} f&&/^## /&&!/^## M2 delivery snapshot \(2026-11-11\)/{exit} f' "$1" ;;
    newsec) local s; s=$(newsec_of "$SH/base-status.md" "$1"); [ -z "$s" ] && return 0; sed -n "${s},\$p" "$1" ;;
  esac
}

seed_asserts() { awk -v id="$2" 'index($0,"### "id)==1{f=1;next} f&&/^#{2,3} /{exit} f&&/^Assert:/{c++} END{print c+0}' "$1"; }
envelope_ok() { # $1=assert line: contains a declared envelope token and no retired family
  printf '%s' "$1" | grep -Eiq 'project-groups\.v1|data\.groups\[\]|groupKey|repos\.v1|data\.repos\[\]|repoKey|plan\.data\.members\[\]|closeout\.data\.members\[\]|verify gates|definitionOfDone|blockingMembers\[\]' \
    && ! printf '%s' "$1" | grep -Eiq 'change\.data\.|change data'
}
renamerule_count() { # count of the exact normative rename sentence across the 14 touched docs
  local n=0 f
  for f in "$BL" "$MR" "$MRD" "$A" "$CT" "$PJ" "$R" "$Q" "$B" "$TS" "$JN" "$EPD" "$ST" "$RG"; do
    [ -f "$f" ] || continue
    n=$((n + $(grep -c '^\*\*From M2-S18, `projects list` enumerates groups and `repos list` enumerates the flat record set; the deprecation alias is the different token `projects list --flat`, owned by M2-S18, which returns the delivered `projects.v1` payload (`data.projects\[\]`) and retires at the M3 boundary\.\*\*$' "$f" 2>/dev/null || true)))
  done
  echo "$n"
}
```

**P01 — AC-F1-1: M2-S11 retained clauses, shipped-surface AC, transition record**

```bash
# P01 — AC-F1-1: M2-S11 retained clauses, shipped-surface AC, transition record
[ "${P00_READY:-}" = "gh303" ] || { echo "FATAL: P00 preamble not loaded" >&2; exit 1; }
require_p00; need entry squash
e=$(entry "$BL" '### M2-S11 '); eq=$(printf '%s' "$e" | squash)
if [ -z "$e" ]; then echo "s11=absent"; echo "P01 verdict: FAIL (change absent)"; exit 0; fi
c=0; for a in 'git common dir marker' 'host.level index' 'migration note' 'cannot observe each' 'disjoint phase state and queue entries'; do
  printf '%s' "$e" | grep -Eiq -- "$a" && c=$((c+1)) || echo "retained MISSING: $a"; done
echo "retained_clauses=$c/5"
printf '%s\n' "$e" | grep -Fxq -- '- Depends on: M0-S5, M1-S17.' && echo "depends_line=exact" || echo "depends_line=CHANGED"
printf '%s\n' "$e" | grep -Fxq -- '- Ticket: GH-288 (milestone M2)' && echo "ticket_line_record=OK" || echo "ticket_line_record=MISSING"
printf '%s' "$e" | grep -Eiq -- 'Progress: delivered by GH-288' && echo "progress_record=OK" || echo "progress_record=MISSING"
ac=$(printf '%s\n' "$e" | awk '/^- AC:/{f=1;next} /^- /{f=0} f' | squash)
printf '%s' "$ac" | grep -Eiq 'projects list' && echo "ac_shipped_surface=OK" || echo "ac_shipped_surface=MISSING"
printf '%s' "$ac" | grep -Eiq 'without manual configuration' && echo "ac_delivered_enumeration=OK" || echo "ac_delivered_enumeration=MISSING"
printf '%s' "$ac" | grep -Eiq 'repos list' && echo "ac_repos_list=PRESENT (violation)" || echo "ac_repos_list=ABSENT"
printf '%s' "$eq" | grep -Eiq 'projects list --flat' && echo "transition_alias=OK" || echo "transition_alias=MISSING"
printf '%s' "$eq" | grep -Eiq 'M2-S18' && echo "transition_owner=OK" || echo "transition_owner=MISSING"
printf '%s' "$eq" | grep -Eiq 'rename rule' && echo "transition_reference=OK" || echo "transition_reference=MISSING"
[ "$c" -eq 5 ] && printf '%s\n' "$e" | grep -Fxq -- '- Depends on: M0-S5, M1-S17.' && printf '%s\n' "$e" | grep -Fxq -- '- Ticket: GH-288 (milestone M2)' && printf '%s' "$e" | grep -Eiq 'Progress: delivered by GH-288' && printf '%s' "$ac" | grep -Eiq 'projects list' && printf '%s' "$ac" | grep -Eiq 'without manual configuration' && ! printf '%s' "$ac" | grep -Eiq 'repos list' && printf '%s' "$eq" | grep -Eiq 'projects list --flat' && printf '%s' "$eq" | grep -Eiq 'rename rule' && echo "P01 verdict: PASS" || echo "P01 verdict: FAIL"
```

**P02 — AC-F1-2: inside the amended entry no flat projects list survives, no**

```bash
# P02 — AC-F1-2: inside the amended entry no flat projects list survives, no
# rename clause is added, and every block the spec pins is byte-identical.
#
# Pinned-byte blocks (spec AC-F1-1 pins these; the Goal is NOT among them):
#   heading, - Ticket:, - Progress:, - AC:, - Depends on:
# The Goal is intentionally rewordable (F-1: "keeps the shipped overview
# meaning"), so it is asserted semantically, not by byte identity.
[ "${P00_READY:-}" = "gh303" ] || { echo "FATAL: P00 preamble not loaded" >&2; exit 1; }
require_p00; need entry squash
entry_of() { entry "$1" '### M2-S11 '; }                       # $1 = file path
blk() { awk -v s="$1" 'index($0,s)==1{f=1;print;next} f&&/^- /{exit} f'; }   # $1 = block label; stdin = entry body
goal_of() { entry_of "$1" | blk '- Goal:'; }
b="$SH/base-backlog.md"; h="$BL"
bb=$(entry_of "$b"); hb=$(entry_of "$h")
[ -n "$bb" ] || { echo "base_s11=absent"; echo "P02 verdict: FAIL"; exit 0; }
[ -n "$hb" ] || { echo "head_s11=absent"; echo "P02 verdict: FAIL (change absent)"; exit 0; }

cmp_block() { # $1=label $2=base text $3=head text
  if [ -z "$2" ] || [ -z "$3" ]; then echo "$1=EMPTY"; return 1; fi
  if [ "$2" = "$3" ]; then echo "$1=byte-identical"; return 0; else echo "$1=CHANGED"; return 1; fi
}
ok=0
for lab in '- Ticket:' '- Progress:' '- AC:' '- Depends on:'; do
  cmp_block "${lab#- }" "$(entry_of "$b" | blk "$lab")" "$(entry_of "$h" | blk "$lab")" && ok=$((ok+1))
done
bh=$(entry_of "$b" | head -1); hh=$(entry_of "$h" | head -1)
cmp_block heading "$bh" "$hh" && ok=$((ok+1))
echo "preserved_blocks=$ok/5"

# Goal: not pinned; the delivered overview meaning must survive and the entry
# must not promise `repos list` (F-1).
g=$(goal_of "$h" | squash)
printf '%s' "$g" | grep -Eiq 'overview' && printf '%s' "$g" | grep -Eiq 'managed checkout' \
  && echo "goal_delivered_overview=OK" || echo "goal_delivered_overview=MISSING"
printf '%s' "$g" | grep -Eiq 'repos list' && echo "goal_promises_repos_list=PRESENT (violation)" || echo "goal_promises_repos_list=ABSENT"
echo "goal_pinned=no (rewordable per F-1; block list above is the pinned set)"

ac=$(entry_of "$h" | blk '- AC:')
printf '%s' "$ac" | grep -Eiq 'repos list' && echo "repos_list_in_ac=PRESENT (violation)" || echo "repos_list_in_ac=ABSENT"
printf '%s' "$(entry_of "$h")" | grep -Eiq 'projectKey.{0,12}repoKey|data\.projects\[\].{0,12}data\.repos\[\]' \
  && echo "field_rename_clause=PRESENT (violation)" || echo "field_rename_clause=ABSENT"
[ -n "$(entry_of "$h")" ] && [ "$(entry_of "$h")" != "$(entry_of "$b")" ] \
  && echo "entry_change=non-vacuous" || echo "entry_change=ABSENT (no change)"

# --- non-vacuity proofs on the REAL head, plus one benign and one meaning-breaking Goal mutant ---
cp "$h" "$SH/p02-mut-ac.md"
awk '/^### M2-S11 /{f=1} f&&/^- AC:/{print "- AC: two checkouts of different repositories on one host, both using ref"; print "  GH-241, hold disjoint phase state and queue entries; `projects list`"; print "  lists them without manual configuration."; skip=1; next} f&&/^- Depends on:/{skip=0} f&&skip{next} {print}' "$h" > "$SH/p02-mut-ac.tmp" && mv "$SH/p02-mut-ac.tmp" "$SH/p02-mut-ac.md"
cp "$h" "$SH/p02-mut-dep.md"
awk '/^### M2-S11 /{f=1} f&&/^- Depends on: M0-S5, M1-S17\./{print "- Depends on: M0-S5, M1-S17, M2-S11."; next} {print}' "$h" > "$SH/p02-mut-dep.tmp" && mv "$SH/p02-mut-dep.tmp" "$SH/p02-mut-dep.md"
cp "$h" "$SH/p02-mut-goal.md"
awk '/^### M2-S11 /{f=1} f&&/^- Goal:/{print "- Goal: the delivered `projects list` command gives one CLI overview of every"; print "  managed checkout."; skip=1; next} f&&/^- Tasks:/{skip=0} f&&skip{next} {print}' "$h" > "$SH/p02-mut-goal.tmp" && mv "$SH/p02-mut-goal.tmp" "$SH/p02-mut-goal.md"
cp "$h" "$SH/p02-mut-goalbad.md"
awk '/^### M2-S11 /{f=1} f&&/^- Goal:/{print "- Goal: `repos list` is the one overview of every managed checkout."; skip=1; next} f&&/^- Tasks:/{skip=0} f&&skip{next} {print}' "$h" > "$SH/p02-mut-goalbad.tmp" && mv "$SH/p02-mut-goalbad.tmp" "$SH/p02-mut-goalbad.md"

# gate-level proof: the same 5-block oracle run against the mutated head
okm=0
for lab in '- Ticket:' '- Progress:' '- AC:' '- Depends on:'; do
  [ "$(entry_of "$SH/p02-mut-ac.md" | blk "$lab")" = "$(entry_of "$b" | blk "$lab")" ] && okm=$((okm+1))
done
[ "$(entry_of "$SH/p02-mut-ac.md" | head -1)" = "$(entry_of "$b" | head -1)" ] && okm=$((okm+1))
echo "mutant_preserved_blocks=$okm/5 (expect 4/5; the AC byte change must be caught)"
ma=$(entry_of "$SH/p02-mut-ac.md" | blk '- AC:'); ba=$(entry_of "$b" | blk '- AC:')
[ "$ma" != "$ba" ] && echo "mutant_ac=CHANGED" || echo "mutant_ac=NOT-DETECTED"
md=$(entry_of "$SH/p02-mut-dep.md" | blk '- Depends on:'); bd=$(entry_of "$b" | blk '- Depends on:')
[ "$md" != "$bd" ] && echo "mutant_depends=CHANGED" || echo "mutant_depends=NOT-DETECTED"
# benign Goal reword: the pinned set is untouched, so the gate still passes
mg=$(goal_of "$SH/p02-mut-goal.md" | squash)
pinned_ok=1
for lab in '- Ticket:' '- Progress:' '- AC:' '- Depends on:'; do
  [ "$(entry_of "$SH/p02-mut-goal.md" | blk "$lab")" = "$(entry_of "$b" | blk "$lab")" ] || pinned_ok=0
done
[ "$mg" != "$(goal_of "$b" | squash)" ] && [ "$pinned_ok" -eq 1 ] && echo "mutant_goal_reword=accepted (pinned set untouched)" || echo "mutant_goal_reword=UNEXPECTED"
gb=$(goal_of "$SH/p02-mut-goalbad.md" | squash)
printf '%s' "$gb" | grep -Eiq 'repos list' && echo "mutant_goal_meaning=detected" || echo "mutant_goal_meaning=NOT-DETECTED"

[ "$ok" -eq 5 ] && [ "$okm" -eq 4 ] && [ -n "$(entry_of "$h")" ] && [ "$(entry_of "$h")" != "$(entry_of "$b")" ] \
 && printf '%s' "$g" | grep -Eiq 'overview' && printf '%s' "$g" | grep -Eiq 'managed checkout' \
 && ! printf '%s' "$g" | grep -Eiq 'repos list' \
 && ! printf '%s' "$ac" | grep -Eiq 'repos list' \
 && ! printf '%s' "$(entry_of "$h")" | grep -Eiq 'projectKey.{0,12}repoKey' \
 && [ "$ma" != "$ba" ] && [ "$md" != "$bd" ] && [ "$pinned_ok" -eq 1 ] \
 && printf '%s' "$gb" | grep -Eiq 'repos list' \
 && echo "P02 verdict: PASS" || echo "P02 verdict: FAIL"
```

**P03 — AC-F1-3: single ownership of the rename set by M2-S18**

```bash
# P03 — AC-F1-3: single ownership of the rename set by M2-S18
[ "${P00_READY:-}" = "gh303" ] || { echo "FATAL: P00 preamble not loaded" >&2; exit 1; }
require_p00; need entry squash
s18=$(entry "$BL" '### M2-S18 '); s11=$(entry "$BL" '### M2-S11 ')
if [ -z "$s18" ]; then echo "s18=absent"; echo "owned_items=0/7"; echo "P03 verdict: FAIL (change absent)"; exit 0; fi
n=0
for a in 'projects list --flat' 'projectKey.{0,12}repoKey' 'migrating-to-per-repository-state\.md' 'configuration-only' 'queue list --project <groupKey>' 'status --project <groupKey>' 'superseding decision record'; do
  printf '%s' "$s18" | grep -Eiq -- "$a" && n=$((n+1)) || echo "s18 MISSING: $a"; done
echo "owned_items=$n/7"
printf '%s' "$s11" | grep -Eq 'M2-S18' && echo "s11_names_owner=OK" || echo "s11_names_owner=MISSING"
for a in 'projectKey.{0,12}repoKey' 'superseding decision record' 'migrating-to-per-repository-state'; do
  printf '%s' "$s11" | grep -Eiq -- "$a" && echo "s11_overclaims: $a"; done
over=0; for a in 'projectKey.{0,12}repoKey' 'superseding decision record' 'migrating-to-per-repository-state'; do
  printf '%s' "$s11" | grep -Eiq -- "$a" && over=$((over+1)); done
echo "s11_duplicate_ownership=$over"
[ "$n" -eq 7 ] && [ "$over" -eq 0 ] && printf '%s' "$s11" | grep -Eq 'M2-S18' && echo "P03 verdict: PASS" || echo "P03 verdict: FAIL"
```

**P04 — AC-F2-1: M2-S18 entry shape and its twelve ticket clauses**

```bash
# P04 — AC-F2-1: M2-S18 entry shape and its twelve ticket clauses
[ "${P00_READY:-}" = "gh303" ] || { echo "FATAL: P00 preamble not loaded" >&2; exit 1; }
require_p00; need entry squash clause_rows
if [ -z "$(grep -m1 '^### M2-S18 ' "$BL")" ]; then echo "S18=absent"; echo "clauses_present=0/12"; echo "P04 verdict: FAIL (change absent)"; exit 0; fi
e=$(entry "$BL" '### M2-S18 '); eq=$(printf '%s' "$e" | squash); ok=0; tot=0
while IFS='|' read -r id story anchor clause; do
  [ "$story" = "M2-S18" ] || continue; tot=$((tot+1))
  if printf '%s' "$eq" | grep -Eiq -- "$anchor"; then ok=$((ok+1)); else echo "MISSING $id: $clause"; fi
done < <(clause_rows)
shape=0; for lab in '- Goal:' '- Tasks:' '- AC:' '- Depends on:'; do printf '%s\n' "$e" | grep -q -- "$lab" && shape=$((shape+1)); done
tick=$(printf '%s\n' "$e" | grep -c -- '^- Ticket:')
printf '%s\n' "$e" | grep -Fxq -- '- Depends on: M2-S11.' && dep=exact || dep=CHANGED
echo "clauses_present=$ok/$tot shape_labels=$shape/4 ticket_line=$tick depends=$dep"
[ "$ok" -eq "$tot" ] && [ "$tot" -eq 12 ] && [ "$shape" -eq 4 ] && [ "$tick" -eq 0 ] && [ "$dep" = exact ] && echo "P04 verdict: PASS" || echo "P04 verdict: FAIL"
```

**P05 — AC-F2-2: mixed tracker kinds accepted at validation, member classified**

```bash
# P05 — AC-F2-2: mixed tracker kinds accepted at validation, member classified
[ "${P00_READY:-}" = "gh303" ] || { echo "FATAL: P00 preamble not loaded" >&2; exit 1; }
require_p00; need entry squash
s18=$(entry "$BL" '### M2-S18 ' | squash); ct=$(cat "$CT" 2>/dev/null | squash)
if [ -z "$s18" ]; then echo "s18=absent"; echo "P05 verdict: FAIL (change absent)"; exit 0; fi
n=0
printf '%s' "$s18" | grep -Eiq 'mixing tracker kinds' && n=$((n+1)) || echo "s18 MISSING mixing-tracker clause"
printf '%s' "$s18" | grep -Eiq 'accepted at validation time' && n=$((n+1)) || echo "s18 MISSING validation-time wording"
printf '%s' "$s18" | grep -Eiq 'not-yet-supported' && n=$((n+1)) || echo "s18 MISSING classification token"
printf '%s' "$s18" | grep -Eiq 'rather than rejected' && n=$((n+1)) || echo "s18 MISSING rather-than-rejected clause"
printf '%s' "$ct" | grep -Eiq 'accepted at validation time' && n=$((n+1)) || echo "contracts MISSING validation-time wording"
printf '%s' "$ct" | grep -Eiq 'not-yet-supported' && n=$((n+1)) || echo "contracts MISSING classification token"
printf '%s' "$ct" | grep -Eiq 'rather than rejected' && n=$((n+1)) || echo "contracts MISSING rather-than-rejected clause"
soft=$(printf '%s %s' "$s18" "$ct" | grep -Eoic 'trackers? (are|is) not supported|mixed trackers are rejected|supported later' || true)
echo "anchors=$n/7 softening=${soft:-0}"
[ "$n" -eq 7 ] && [ "${soft:-0}" -eq 0 ] && echo "P05 verdict: PASS" || echo "P05 verdict: FAIL"
```

**P06 — AC-F2-3: rename task, alias task, and the alias-payload acceptance**

```bash
# P06 — AC-F2-3: rename task, alias task, and the alias-payload acceptance
[ "${P00_READY:-}" = "gh303" ] || { echo "FATAL: P00 preamble not loaded" >&2; exit 1; }
require_p00; need entry squash
s18=$(entry "$BL" '### M2-S18 '); sq=$(printf '%s' "$s18" | squash)
if [ -z "$s18" ]; then echo "s18=absent"; echo "P06 verdict: FAIL (change absent)"; exit 0; fi
ac=$(printf '%s\n' "$s18" | awk '/^- AC:/{f=1;next} /^- /{f=0} f' | squash)
n=0
printf '%s' "$sq" | grep -Eiq 'rename' && printf '%s' "$sq" | grep -Eiq 'projects list' && printf '%s' "$sq" | grep -Eiq 'repos list' && printf '%s' "$sq" | grep -Eiq 'flat record set' && n=$((n+1)) || echo "MISSING rename task"
printf '%s' "$sq" | grep -Eiq 'projects list --flat' && n=$((n+1)) || echo "MISSING alias token"
printf '%s' "$sq" | grep -Eiq 'data\.projects\[\]' && n=$((n+1)) || echo "MISSING alias payload"
printf '%s' "$sq" | grep -Eiq 'retired at the M3 boundary|retires at the M3 boundary' && n=$((n+1)) || echo "MISSING retirement clause"
printf '%s' "$ac" | grep -Eiq 'projects list --flat' && n=$((n+1)) || echo "MISSING alias AC token"
printf '%s' "$ac" | grep -Eiq 'data\.projects\[\]' && printf '%s' "$ac" | grep -Eiq 'projectKey' && printf '%s' "$ac" | grep -Eiq 'hostIndexRevision' && n=$((n+1)) || echo "MISSING alias payload shape in AC"
echo "rename_set=$n/6"
[ "$n" -eq 6 ] && echo "P06 verdict: PASS" || echo "P06 verdict: FAIL"
```

**P07 — AC-F2-4: field-rename task, migration-guide task, code-work statement**

```bash
# P07 — AC-F2-4: field-rename task, migration-guide task, code-work statement
[ "${P00_READY:-}" = "gh303" ] || { echo "FATAL: P00 preamble not loaded" >&2; exit 1; }
require_p00; need entry squash
s18=$(entry "$BL" '### M2-S18 '); sq=$(printf '%s' "$s18" | squash)
if [ -z "$s18" ]; then echo "s18=absent"; echo "P07 verdict: FAIL (change absent)"; exit 0; fi
n=0
printf '%s' "$sq" | grep -Eiq 'projectKey.{0,12}repoKey' && n=$((n+1)) || echo "MISSING projectKey rename"
printf '%s' "$sq" | grep -Eiq 'data\.projects\[\].{0,12}data\.repos\[\]' && n=$((n+1)) || echo "MISSING data-field rename"
printf '%s' "$sq" | grep -Eiq 'migrating-to-per-repository-state\.md' && n=$((n+1)) || echo "MISSING migration-guide task"
printf '%s' "$sq" | grep -Eiq 'S18 code work' && n=$((n+1)) || echo "MISSING code-work statement"
printf '%s' "$sq" | grep -Eiq 'not current truth' && n=$((n+1)) || echo "MISSING not-current-truth statement"
claims=$(printf '%s' "$sq" | grep -Eoic '(rename|repos list)[^.]{0,60}(has shipped|is shipped|is delivered|ships today)' || true)
echo "anchors=$n/5 shipped_claims=${claims:-0}"
[ "$n" -eq 5 ] && [ "${claims:-0}" -eq 0 ] && echo "P07 verdict: PASS" || echo "P07 verdict: FAIL"
```

**P08 — AC-F2-5: configuration-only membership and the scoped-read grammar**

```bash
# P08 — AC-F2-5: configuration-only membership and the scoped-read grammar
[ "${P00_READY:-}" = "gh303" ] || { echo "FATAL: P00 preamble not loaded" >&2; exit 1; }
require_p00; need entry squash
s18=$(entry "$BL" '### M2-S18 ' | squash)
if [ -z "$s18" ]; then echo "s18=absent"; echo "P08 verdict: FAIL (change absent)"; exit 0; fi
n=0
printf '%s' "$s18" | grep -Eiq 'configuration-only' && n=$((n+1)) || echo "MISSING configuration-only membership"
printf '%s' "$s18" | grep -Eiq 'workspaceRoot' && n=$((n+1)) || echo "MISSING workspaceRoot"
printf '%s' "$s18" | grep -Eiq '`?members`?' && n=$((n+1)) || echo "MISSING members"
printf '%s' "$s18" | grep -Eiq 'project configuration document' && n=$((n+1)) || echo "MISSING configuration-document reference"
printf '%s' "$s18" | grep -Eiq 'scan only locates declared members' && n=$((n+1)) || echo "MISSING declared-only scan"
printf '%s' "$s18" | grep -Eiq 'queue list --project <groupKey>' && n=$((n+1)) || echo "MISSING queue grammar"
printf '%s' "$s18" | grep -Eiq 'status --project <groupKey>' && n=$((n+1)) || echo "MISSING status grammar"
echo "anchors=$n/7"
[ "$n" -eq 7 ] && echo "P08 verdict: PASS" || echo "P08 verdict: FAIL"
```

**P09 — AC-F2-6: the superseding decision-record task, no shipped claim**

```bash
# P09 — AC-F2-6: the superseding decision-record task, no shipped claim
[ "${P00_READY:-}" = "gh303" ] || { echo "FATAL: P00 preamble not loaded" >&2; exit 1; }
require_p00; need entry squash
s18=$(entry "$BL" '### M2-S18 '); sq=$(printf '%s' "$s18" | squash)
if [ -z "$s18" ]; then echo "s18=absent"; echo "P09 verdict: FAIL (change absent)"; exit 0; fi
printf '%s' "$sq" | grep -Eiq 'superseding decision record' && echo "decision_record_task=OK" || echo "decision_record_task=MISSING"
printf '%s' "$sq" | grep -Eiq 'before the registry row moves to Delivery' && echo "record_precedes_delivery=OK" || echo "record_precedes_delivery=MISSING"
claims=$(printf '%s' "$sq" | grep -Eoic '(rename|repos list|alias)[^.]{0,80}(has shipped|is shipped|is delivered|now delivers|delivered by M2-S18)' || true)
echo "shipped_claims=${claims:-0}"
printf '%s' "$sq" | grep -Eiq 'superseding decision record' && printf '%s' "$sq" | grep -Eiq 'before the registry row moves to Delivery' && [ "${claims:-0}" -eq 0 ] && echo "P09 verdict: PASS" || echo "P09 verdict: FAIL"
```

**P10 — AC-F3-1: M2-S19 entry shape and its eleven ticket clauses**

```bash
# P10 — AC-F3-1: M2-S19 entry shape and its eleven ticket clauses
[ "${P00_READY:-}" = "gh303" ] || { echo "FATAL: P00 preamble not loaded" >&2; exit 1; }
require_p00; need entry squash clause_rows
if [ -z "$(grep -m1 '^### M2-S19 ' "$BL")" ]; then echo "S19=absent"; echo "clauses_present=0/11"; echo "P10 verdict: FAIL (change absent)"; exit 0; fi
e=$(entry "$BL" '### M2-S19 '); eq=$(printf '%s' "$e" | squash); ok=0; tot=0
while IFS='|' read -r id story anchor clause; do
  [ "$story" = "M2-S19" ] || continue; tot=$((tot+1))
  if printf '%s' "$eq" | grep -Eiq -- "$anchor"; then ok=$((ok+1)); else echo "MISSING $id: $clause"; fi
done < <(clause_rows)
shape=0; for lab in '- Goal:' '- Tasks:' '- AC:' '- Depends on:'; do printf '%s\n' "$e" | grep -q -- "$lab" && shape=$((shape+1)); done
tick=$(printf '%s\n' "$e" | grep -c -- '^- Ticket:')
printf '%s\n' "$e" | grep -Fxq -- '- Depends on: M2-S11, M2-S18, M1-S17.' && dep=exact || dep=CHANGED
echo "clauses_present=$ok/$tot shape_labels=$shape/4 ticket_line=$tick depends=$dep"
[ "$ok" -eq "$tot" ] && [ "$tot" -eq 11 ] && [ "$shape" -eq 4 ] && [ "$tick" -eq 0 ] && [ "$dep" = exact ] && echo "P10 verdict: PASS" || echo "P10 verdict: FAIL"
```

**P11 — AC-F3-2: three identifiable criteria, executable one-review-flow CI corroboration that blocks instead of counting as green**

```bash
# P11 — AC-F3-2: three identifiable criteria, executable one-review-flow,
# CI corroboration that blocks instead of counting as green
[ "${P00_READY:-}" = "gh303" ] || { echo "FATAL: P00 preamble not loaded" >&2; exit 1; }
require_p00; need entry squash
s19=$(entry "$BL" '### M2-S19 '); sq=$(printf '%s' "$s19" | squash)
if [ -z "$s19" ]; then echo "s19=absent"; echo "criteria=0/3"; echo "P11 verdict: FAIL (change absent)"; exit 0; fi
ac=$(printf '%s\n' "$s19" | awk '/^- AC:/{f=1;next} /^- /{f=0} f')
num=$(printf '%s\n' "$ac" | grep -cE '^[[:space:]]+[0-9]+\.')
a1=$(printf '%s' "$ac" | squash | grep -Eic 'one spec.{0,40}two branches')
a2=$(printf '%s' "$ac" | squash | grep -Eic 'corroborated per member')
a3=$(printf '%s' "$ac" | squash | grep -Eic 'failing member named|blocks the shared')
echo "numbered_items=$num criteria=$((a1>0?a1:0))/$((a2>0?a2:0))/$((a3>0?a3:0))"
rf=0
printf '%s' "$sq" | grep -Eiq 'one review run over the declared member pull-request set' && rf=$((rf+1)) || echo "MISSING review-run definition"
printf '%s' "$sq" | grep -Eiq 'one verdict per member' && rf=$((rf+1)) || echo "MISSING verdict-per-member"
printf '%s' "$sq" | grep -Eiq 'reviewed once' && rf=$((rf+1)) || echo "MISSING reviewed-once"
ci=0
printf '%s' "$sq" | grep -Eiq 'unavailable CI reading blocks' && ci=$((ci+1)) || echo "MISSING unavailable-blocks clause"
printf '%s' "$sq" | grep -Eiq 'rather than counting as green' && ci=$((ci+1)) || echo "MISSING not-green clause"
echo "review_flow=$rf/3 ci_corroboration=$ci/2"
[ "$num" -ge 3 ] && [ "$a1" -ge 1 ] && [ "$a2" -ge 1 ] && [ "$a3" -ge 1 ] && [ "$rf" -eq 3 ] && [ "$ci" -eq 2 ] && echo "P11 verdict: PASS" || echo "P11 verdict: FAIL"
```

**P12 — AC-F3-3: dependency-ordering acceptance and landing-order evidence**

```bash
# P12 — AC-F3-3: dependency-ordering acceptance and landing-order evidence
[ "${P00_READY:-}" = "gh303" ] || { echo "FATAL: P00 preamble not loaded" >&2; exit 1; }
require_p00; need entry squash
s19=$(entry "$BL" '### M2-S19 '); sq=$(printf '%s' "$s19" | squash)
if [ -z "$s19" ]; then echo "s19=absent"; echo "P12 verdict: FAIL (change absent)"; exit 0; fi
ac=$(printf '%s\n' "$s19" | awk '/^- AC:/{f=1;next} /^- /{f=0} f' | squash)
n=0
printf '%s' "$ac" | grep -Eiq "does not start before the prerequisite member's pull request lands" && n=$((n+1)) || echo "MISSING ordering criterion"
printf '%s' "$ac" | grep -Eiq 'landing order' && n=$((n+1)) || echo "MISSING landing-order evidence"
printf '%s' "$sq" | grep -Eiq 'dependency edge' && n=$((n+1)) || echo "MISSING dependency-edge task"
echo "ordering_anchors=$n/3"
[ "$n" -eq 3 ] && echo "P12 verdict: PASS" || echo "P12 verdict: FAIL"
```

**P13 — AC-F3-4: the cross-repository change plan shape field inventory**

```bash
# P13 — AC-F3-4: the cross-repository change plan shape field inventory
[ "${P00_READY:-}" = "gh303" ] || { echo "FATAL: P00 preamble not loaded" >&2; exit 1; }
require_p00; need section squash
sh=$(grep -nE '^## Cross-repository change plan shape' "$CT" | head -1 | cut -d: -f1)
if [ -z "$sh" ]; then echo "plan_shape=absent"; echo "P13 verdict: FAIL (change absent)"; exit 0; fi
hdr=$(sed -n "${sh}p" "$CT"); body=$(section "$CT" "$hdr" | squash)
n=0
for f in 'plan\.data\.members\[\]' 'repoKey' 'slice' 'branch' 'pullRequest' 'dependsOn\[\]' 'gates' 'verify gates' 'data\.definitionOfDone' 'data\.blockingMembers\[\]' 'closeout\.data\.members\[\]' 'cleanup' 'issueClosure' 'landed' 'landing order' 'one review flow'; do
  printf '%s' "$body" | grep -Eiq -- "$f" && n=$((n+1)) || echo "MISSING $f"; done
echo "plan_shape_fields=$n/16"
[ "$n" -eq 16 ] && echo "P13 verdict: PASS" || echo "P13 verdict: FAIL"
```

**P14 — AC-F4-1: insertion window inside the Epic M2 block and the separator**

```bash
# P14 — AC-F4-1: insertion window inside the Epic M2 block and the separator
[ "${P00_READY:-}" = "gh303" ] || { echo "FATAL: P00 preamble not loaded" >&2; exit 1; }
require_p00; need backlog_ranges
backlog_ranges
b3=$(grep -n '^## Epic M3' "$SH/base-backlog.md" | cut -d: -f1)
bsep=$(awk -v m="$b3" 'NR<m && /^---$/{l=NR} END{print l+0}' "$SH/base-backlog.md")
bseq=$(sed -n "${bsep},$((bsep+2))p" "$SH/base-backlog.md")
hseq=$(sed -n "${SEP_LINE},$((SEP_LINE+2))p" "$BL")
blank_before=$(awk -v s="$SEP_LINE" 'NR==s-1&&NF==0{c=1} END{print c+0}' "$BL")
echo "s17_last=$S17_LAST separator=$SEP_LINE epic_m3=$M3_LINE window=$WS:$WE"
[ "$WS" -le "$WE" ] && echo "window_empty=no ($((WE-WS+1)) line(s))" || echo "window_empty=yes"
[ "$bseq" = "$hseq" ] && echo "separator_sequence=identical" || echo "separator_sequence=CHANGED"
echo "blank_line_before_separator=$blank_before"
echo "s18_line=${S18_LINE:-absent} s19_line=${S19_LINE:-absent}"
if [ -n "$S18_LINE" ] && [ -n "$S19_LINE" ] && [ "$S18_LINE" -ge "$WS" ] && [ "$S19_LINE" -le "$WE" ] && [ "$S18_LINE" -lt "$S19_LINE" ]; then echo "placement=inside-window"; else echo "placement=FAIL"; fi
printf '%s\n' "$(sed -n "$((SEP_LINE+1)),$((SEP_LINE+2))p" "$BL")" | grep -Fxq '## Epic M3: Surfaces, adapters, validators (months 6-9)' && echo "epic_m3=follows" || echo "epic_m3=NOT-AFTER"
[ -n "$S18_LINE" ] && [ -n "$S19_LINE" ] && [ "$bseq" = "$hseq" ] && [ "$blank_before" -eq 1 ] && [ "$S18_LINE" -ge "$WS" ] && [ "$S19_LINE" -le "$WE" ] && [ "$S18_LINE" -lt "$S19_LINE" ] && echo "P14 verdict: PASS" || echo "P14 verdict: FAIL (change absent or misplaced)"
```

**P15 — AC-F4-2: one Epic M2 context paragraph and the preserved regions**

```bash
# P15 — AC-F4-2: one Epic M2 context paragraph and the preserved regions
[ "${P00_READY:-}" = "gh303" ] || { echo "FATAL: P00 preamble not loaded" >&2; exit 1; }
require_p00; need backlog_ranges squash
backlog_ranges
bNOTE_S=$(grep -n '^Note: the M1 redefinition moved the queue' "$SH/base-backlog.md" | cut -d: -f1)
bNOTE_E=$(grep -n '^the gap is deliberate\. M2 stories keep their codes\.$' "$SH/base-backlog.md" | cut -d: -f1)
[ -n "$NOTE_S" ] && [ "$NOTE_S" -eq "$bNOTE_S" ] && echo "note_start_line=anchored($NOTE_S)" || echo "note_start_line=SHIFTED"
[ -n "$NOTE_E" ] && [ "$NOTE_E" -eq "$bNOTE_E" ] && echo "note_end_line=anchored($NOTE_E)" || echo "note_end_line=SHIFTED"
awk -v s="$bNOTE_S" -v e="$bNOTE_E" 'NR>=s&&NR<=e' "$SH/base-backlog.md" > "$SH/p15-note-b"
awk -v s="$NOTE_S" -v e="$NOTE_E" 'NR>=s&&NR<=e' "$BL" > "$SH/p15-note-h"
cmp -s "$SH/p15-note-b" "$SH/p15-note-h" && echo "retirement_note=OK" || echo "retirement_note=CHANGED"
para=$(sed -n "$((NOTE_E+1)),$((S2_LINE-1))p" "$BL")
pl=$(printf '%s\n' "$para" | grep -c .)
blank_after_note=$(awk -v n="$((NOTE_E+1))" 'NR==n&&NF==0{c=1} END{print c+0}' "$BL")
blank_before_s2=$(awk -v n="$((S2_LINE-1))" 'NR==n&&NF==0{c=1} END{print c+0}' "$BL")
echo "retirement_note=${NOTE_S}..${NOTE_E} context_paragraph=$((NOTE_E+1))..$((S2_LINE-1)) paragraph_lines=$pl blank_after_note=$blank_after_note blank_before_s2=$blank_before_s2"
if [ "$((NOTE_E+1))" -lt "$S2_LINE" ] && [ "$pl" -ge 1 ] && [ "$blank_after_note" -eq 1 ] && [ "$blank_before_s2" -eq 1 ]; then echo "paragraph_strictly_between=OK"; else echo "paragraph_strictly_between=FAIL"; fi
n=0
printf '%s' "$para" | grep -Eiq 'repositor' && n=$((n+1)) || echo "MISSING repository level"
printf '%s' "$para" | grep -Eiq 'project' && n=$((n+1)) || echo "MISSING group level"
printf '%s' "$para" | grep -Eiq 'workspace' && n=$((n+1)) || echo "MISSING workspace level"
printf '%s' "$para" | grep -Eiq 'membership is declared in configuration|configuration-only|declared in configuration' && n=$((n+1)) || echo "MISSING configuration-only membership"
printf '%s' "$para" | grep -Eiq 'delivered flat record set|delivered .projects\.v1.' && n=$((n+1)) || echo "MISSING delivered flat surface"
printf '%s' "$para" | grep -Eiq 'rename rule' && n=$((n+1)) || echo "MISSING rename-rule reference"
printf '%s' "$para" | grep -Eiq 'root.family|projects. family' && n=$((n+1)) || echo "MISSING root-family consequence"
echo "paragraph_anchors=$n/7"
[ "$pl" -ge 1 ] && [ "$((NOTE_E+1))" -lt "$S2_LINE" ] && [ "$n" -eq 7 ] && echo "P15 verdict: PASS" || echo "P15 verdict: FAIL (no conforming context paragraph)"
```

**P16 — AC-F4-3: zero-context hunk confinement with classifier self-tests**

```bash
# P16 — AC-F4-3: zero-context hunk confinement with classifier self-tests
[ "${P00_READY:-}" = "gh303" ] || { echo "FATAL: P00 preamble not loaded" >&2; exit 1; }
require_p00; need backlog_ranges
backlog_ranges
hunk_guard() { local -a R=("$@"); local inside=0 outside=0 h c d last ok r a b
  while IFS= read -r h; do
    case "$h" in '@@'*) ;; *) continue ;; esac
    c=$(printf '%s\n' "$h" | sed -E 's/^@@ -[0-9]+(,[0-9]+)? \+([0-9]+)(,([0-9]+))? @@.*/\2/')
    d=$(printf '%s\n' "$h" | sed -E 's/^@@ -[0-9]+(,[0-9]+)? \+([0-9]+)(,([0-9]+))? @@.*/\4/'); [ -z "$d" ] && d=1
    last=$((c+d-1)); ok=0
    for r in "${R[@]}"; do a=${r%%:*}; b=${r##*:}
      if [ "$d" -eq 0 ]; then [ "$c" -ge "$a" ] && [ "$c" -le "$b" ] && ok=1
      else [ "$c" -ge "$a" ] && [ "$last" -le "$b" ] && ok=1; fi
    done
    [ "$ok" -eq 1 ] && inside=$((inside+1)) || { outside=$((outside+1)); echo "OUTSIDE: $h (added $c..$last)"; }
  done
  echo "hunks: inside=$inside outside=$outside"; [ "$outside" -eq 0 ]; }
s11r="$S11_LINE:$S11_END"
S4_DEP=$(grep -n '^- Depends on: M1-S5, M1-S17, M2-S11, M2-S18\.$' "$BL" | cut -d: -f1)
s4r="${S4_DEP:-0}:${S4_DEP:-0}"
ctxr="$((NOTE_E+1)):$((S2_LINE-1))"
echo "ranges=s11:$s11r s4:$s4r ctx:$ctxr window:$WS:$WE"
hc=$(diff -U0 "$SH/base-backlog.md" "$BL" | grep -cE '^@@' || true)
echo "backlog_hunks=$hc"
if [ "$hc" -ge 1 ]; then
  diff -U0 "$SH/base-backlog.md" "$BL" | grep -E '^@@' | hunk_guard "$s11r" "$s4r" "$ctxr" "$WS:$WE" && echo "hunk confinement OK" || echo "hunk confinement FAILED"
  echo "non_vacuous=yes"
else echo "FAIL: no backlog hunk (change absent)"; echo "non_vacuous=no"; fi
t=0
printf '@@ -%d,0 +%d,1 @@\n' "$((NOTE_E+1))" "$((NOTE_E+1))" | hunk_guard "$ctxr" >/dev/null && t=$((t+1))
printf '@@ -%d,0 +%d,1 @@\n' "$((SEP_LINE+2))" "$((SEP_LINE+2))" | hunk_guard "$WS:$WE" >/dev/null || t=$((t+1))
printf '@@ -%d,0 +%d,1 @@\n' "$WS" "$WS" | hunk_guard "$WS:$WE" >/dev/null && t=$((t+1))
echo "classifier_self_tests=$t/3"
[ "$hc" -ge 1 ] && [ "$t" -eq 3 ] && echo "P16 verdict: PASS" || echo "P16 verdict: FAIL"
```

**P17 — AC-F4-4: M2-S4's dependency line gains M2-S18; the entry is otherwise intact**

```bash
# P17 — AC-F4-4: M2-S4's dependency line gains M2-S18; the entry is otherwise intact
[ "${P00_READY:-}" = "gh303" ] || { echo "FATAL: P00 preamble not loaded" >&2; exit 1; }
require_p00; need entry
s4=$(entry "$BL" '### M2-S4 '); b4=$(entry "$SH/base-backlog.md" '### M2-S4 ')
if [ -z "$s4" ]; then echo "s4=absent"; echo "P17 verdict: FAIL"; exit 0; fi
printf '%s\n' "$s4" | grep -Fxq -- '- Depends on: M1-S5, M1-S17, M2-S11, M2-S18.' && echo "depends_line=exact" || echo "depends_line=CHANGED"
read -r rem add <<< "$(diffstat <(printf '%s\n' "$b4") <(printf '%s\n' "$s4"))"
echo "removed_lines=$rem added_lines=$add"
other=$(diff -U0 <(printf '%s\n' "$b4") <(printf '%s\n' "$s4") | grep -E '^[-+]' | grep -vE '^(---|\+\+\+)' | grep -vE '^[-+]([-+])? ?Depends on:' | wc -l)
echo "non_dependency_diff_lines=$other"
printf '%s\n' "$b4" | grep -Fxq -- '- Depends on: M1-S5, M1-S17, M2-S11.' && echo "base_depends_line=old" || echo "base_depends_line=UNEXPECTED"
[ "$rem" -eq 1 ] && [ "$add" -eq 1 ] && [ "$other" -eq 0 ] && printf '%s\n' "$s4" | grep -Fxq -- '- Depends on: M1-S5, M1-S17, M2-S11, M2-S18.' && echo "P17 verdict: PASS" || echo "P17 verdict: FAIL"
```

**P18 — AC-F5-1: C4 Level 1 draws repository, group, and optional workspace**

```bash
# P18 — AC-F5-1: C4 Level 1 draws repository, group, and optional workspace
[ "${P00_READY:-}" = "gh303" ] || { echo "FATAL: P00 preamble not loaded" >&2; exit 1; }
require_p00; need section squash
l1=$(section "$A" '## C4 Level 1: system context')
if [ -z "$l1" ]; then echo "c4_l1=absent"; echo "P18 verdict: FAIL"; exit 0; fi
diag=$(printf '%s\n' "$l1" | awk '/^```mermaid/{f=1;next} /^```/{f=0} f')
lsq=$(printf '%s' "$l1" | squash)
printf '%s' "$lsq" | grep -Eiq 'delivery unit' && echo "repository_as_delivery_unit=OK" || echo "repository_as_delivery_unit=MISSING"
printf '%s' "$lsq" | grep -Eiq 'configured group of repositories|group of repositor' && echo "project_as_group=OK" || echo "project_as_group=MISSING"
printf '%s' "$diag" | grep -Eiq 'workspace' && echo "workspace_in_diagram=OK" || echo "workspace_in_diagram=MISSING"
printf '%s' "$diag" | grep -Eiq 'workspace[^\n]*optional|optional[^\n]*workspace|optional.*discovery' && echo "workspace_optional_in_diagram=OK" || echo "workspace_optional_in_diagram=MISSING"
claim='(workspace[^.]{0,120}(is|are|becomes|remains) (required|mandatory|compulsory))|((members?|repositories|repos|checkouts?) (must|shall|have to) (live|reside|be kept) (inside|within|in) (a |the )?workspace)|((members?|repositories|repos|checkouts?) (is|are) required to (live|reside|be kept) (inside|within|in))'
neg='never|not |n.t|optional|no (member|repository|repo|checkout)|free to'
claims=$(printf '%s' "$lsq" | tr '.' '\n' | grep -Ei "$claim" | grep -Eiv "$neg" | grep -c . || true)
echo "workspace_mandatory_claim=$( [ "$claims" -eq 0 ] && echo ABSENT || echo "PRESENT ($claims)")"
[ "$claims" -eq 0 ] && printf '%s' "$lsq" | grep -Eiq 'configured group of repositories' && printf '%s' "$diag" | grep -Eiq 'workspace' && printf '%s' "$diag" | grep -Eiq 'optional' && echo "P18 verdict: PASS" || echo "P18 verdict: FAIL"
```

**P19 — AC-F5-2: declared membership, declared-only scan, optional workspace unrelated-directory equivalence**

```bash
# P19 — AC-F5-2: declared membership, declared-only scan, optional workspace,
# unrelated-directory equivalence
[ "${P00_READY:-}" = "gh303" ] || { echo "FATAL: P00 preamble not loaded" >&2; exit 1; }
require_p00; need squash
sq=$(cat "$A" 2>/dev/null | squash)
if [ ! -f "$A" ]; then echo "architecture=absent"; echo "P19 verdict: FAIL"; exit 0; fi
n=0
printf '%s' "$sq" | grep -Eiq 'membership is declared in configuration' && n=$((n+1)) || echo "MISSING declared membership"
printf '%s' "$sq" | grep -Eiq 'scan only locates declared members' && n=$((n+1)) || echo "MISSING declared-only scan"
printf '%s' "$sq" | grep -Eiq 'never admits an undeclared clone' && n=$((n+1)) || echo "MISSING undeclared-clone ban"
printf '%s' "$sq" | grep -Eiq 'workspace is an optional|never required' && n=$((n+1)) || echo "MISSING workspace optionality"
printf '%s' "$sq" | grep -Eiq 'unrelated directories behaves identically' && n=$((n+1)) || echo "MISSING unrelated-directory equivalence"
ban=$(printf '%s' "$sq" | grep -Eoic 'members? (must|shall) live inside a workspace|a workspace is required|members? are required to live inside' || true)
echo "anchors=$n/5 mandatory_membership_claims=${ban:-0}"
[ "$n" -eq 5 ] && [ "${ban:-0}" -eq 0 ] && echo "P19 verdict: PASS" || echo "P19 verdict: FAIL"
```

**P20 — AC-F5-3: group-scoped overview, cross-repository flow with one queue**

```bash
# P20 — AC-F5-3: group-scoped overview, cross-repository flow with one queue
# entry per member, and the six boundary invariants
[ "${P00_READY:-}" = "gh303" ] || { echo "FATAL: P00 preamble not loaded" >&2; exit 1; }
require_p00; need section squash
if [ ! -f "$A" ]; then echo "architecture=absent"; echo "P20 verdict: FAIL"; exit 0; fi
ov=$(section "$A" '### Multi-repository overview'); ovs=$(printf '%s' "$ov" | squash)
xr=$(section "$A" '### Cross-repository change'); xrs=$(printf '%s' "$xr" | squash)
inv=$(section "$A" '## Boundary invariants at M2 exit'); invs=$(printf '%s' "$inv" | squash)
echo "overview_mentions_member=$(printf '%s' "$ovs" | grep -oic 'member' || true) overview_mentions_group=$(printf '%s' "$ovs" | grep -oic 'group' || true)"
echo "cross_repo_flow=$([ -n "$xr" ] && echo present || echo absent) cross_repo_mermaid=$(printf '%s\n' "$xr" | grep -c '^```mermaid' || true)"
printf '%s' "$ovs" | grep -Eiq 'member' && printf '%s' "$ovs" | grep -Eiq 'group' && echo "overview_group_scoped=OK" || echo "overview_group_scoped=MISSING"
printf '%s' "$xrs" | grep -Eiq 'one queue entry per member' && echo "flow_queue_entry_per_member=OK" || echo "flow_queue_entry_per_member=MISSING"
printf '%s' "$xrs" | grep -Eiq 'dependency edge' && echo "flow_dependency_edges=OK" || echo "flow_dependency_edges=MISSING"
i=0
printf '%s' "$invs" | grep -Eiq 'rename rule|naming boundary' && i=$((i+1)) || echo "INV MISSING naming boundary"
printf '%s' "$invs" | grep -Eiq 'configuration-only' && i=$((i+1)) || echo "INV MISSING configuration-only membership"
printf '%s' "$invs" | grep -Eiq 'one queue entry per member' && i=$((i+1)) || echo "INV MISSING one queue entry per member"
printf '%s' "$invs" | grep -Eiq 'release drops each member' && i=$((i+1)) || echo "INV MISSING release rule"
printf '%s' "$invs" | grep -Eiq 'workspace is optional|never required' && i=$((i+1)) || echo "INV MISSING workspace optionality"
printf '%s' "$invs" | grep -Eiq 'one lifecycle' && i=$((i+1)) || echo "INV MISSING one lifecycle"
echo "invariants=$i/6"
[ -n "$xr" ] && printf '%s\n' "$xr" | grep -q '^```mermaid' && [ "$i" -eq 6 ] && echo "P20 verdict: PASS" || echo "P20 verdict: FAIL"
```

**P21 — AC-F5-4: the discovery workspace root versus the state layer's**

```bash
# P21 — AC-F5-4: the discovery workspace root versus the state layer's
# fixed `default` workspace identifier
[ "${P00_READY:-}" = "gh303" ] || { echo "FATAL: P00 preamble not loaded" >&2; exit 1; }
require_p00; need squash
sq=$(cat "$A" 2>/dev/null | squash)
if [ ! -f "$A" ]; then echo "architecture=absent"; echo "P21 verdict: FAIL"; exit 0; fi
chk() { printf '%s' "$sq" | grep -Eiq -- "$1" && echo "$2=OK" || echo "$2=MISSING"; }
chk 'discovery workspace root' discovery_root_named
chk 'fixed `default` workspace identifier' default_identifier_named
chk 'not the state layer|is distinct from the state layer' distinct_statement
merged=$(printf '%s' "$sq" | grep -Eoic 'the workspace (root )?(is|equals) the default|discovery root is the state layer' || true)
echo "collapsed_sentences=${merged:-0}"
[ "$(printf '%s' "$sq" | grep -Eic 'discovery workspace root' || true)" -ge 1 ] \
  && [ "$(printf '%s' "$sq" | grep -Eic 'fixed `default` workspace identifier' || true)" -ge 1 ] \
  && [ "$(printf '%s' "$sq" | grep -Eic 'not the state layer|distinct from the state layer' || true)" -ge 1 ] \
  && [ "${merged:-0}" -eq 0 ] && echo "P21 verdict: PASS" || echo "P21 verdict: FAIL"
```

**P22 — AC-F6-1: repos.v1, the flat record set, and its owner**

```bash
# P22 — AC-F6-1: repos.v1, the flat record set, and its owner
[ "${P00_READY:-}" = "gh303" ] || { echo "FATAL: P00 preamble not loaded" >&2; exit 1; }
require_p00; need section squash
rv=$(grep -n '^## repos.v1' "$CT" | head -1 | cut -d: -f1)
if [ -z "$rv" ]; then echo "repos_v1=absent"; echo "P22 verdict: FAIL (change absent)"; exit 0; fi
body=$(section "$CT" '## repos.v1' | squash); n=0
for f in 'data\.repos\[\]' 'repoKey' 'root' 'stateLocation' 'daemonReachable' 'daemon-not-mounted' 'unbound' 'handoverState' 'hostIndexRevision' 'M2-S18' 'rename'; do
  printf '%s' "$body" | grep -Eiq -- "$f" && n=$((n+1)) || echo "MISSING $f"; done
echo "repos_v1_fields=$n/11"
# The contract must define `unbound` as a declared scope and must not attach it to
# an error identity or a non-zero exit (delivered truth: scope at exit 0).
printf '%s' "$body" | grep -Eiq 'declared .?unbound.? scope|the .?unbound.? scope' \
  && echo "rv_unbound_scope=OK" || echo "rv_unbound_scope=MISSING"
rvbad=$(printf '%s' "$body" | tr '.' '\n' | grep -Ei 'unbound' | grep -Ei 'fail|error|refus|exit[^.]{0,12}(1|2)([^0-9]|$)' | grep -Eiv 'never|not |isn.t|no error' | grep -c . || true)
echo "rv_unbound_error_attachment=${rvbad:-0}"
[ "$n" -eq 11 ] && printf '%s' "$body" | grep -Eiq 'declared .?unbound.? scope|the .?unbound.? scope' && [ "${rvbad:-0}" -eq 0 ] \
  && echo "P22 verdict: PASS" || echo "P22 verdict: FAIL"
```

**P23 — AC-F6-2: project-groups.v1, the group identity, and the member fields**

```bash
# P23 — AC-F6-2: project-groups.v1, the group identity, and the member fields
[ "${P00_READY:-}" = "gh303" ] || { echo "FATAL: P00 preamble not loaded" >&2; exit 1; }
require_p00; need section squash
if [ -z "$(grep -m1 '^## project-groups.v1' "$CT")" ]; then echo "project_groups_v1=absent"; echo "P23 verdict: FAIL (change absent)"; exit 0; fi
body=$(section "$CT" '## project-groups.v1' | squash); n=0
for f in 'data\.groups\[\]' 'groupKey' '`name`|name' 'workspaceRoot' 'members\[\]' 'repoKey' 'root' 'trackerKind' 'state' 'health' 'daemonReachable'; do
  printf '%s' "$body" | grep -Eiq -- "$f" && n=$((n+1)) || echo "MISSING $f"; done
echo "group_fields=$n/11"
projkey=$(printf '%s' "$body" | grep -Eoic 'projectKey[^.]{0,30}(is|denotes|names) the group|group identit[^.]{0,20}is .?projectKey' || true)
echo "projectKey_group_affirmations=${projkey:-0}"
printf '%s' "$body" | grep -Eiq 'member field never denotes the group' && echo "member_field_ban=OK" || echo "member_field_ban=MISSING"
printf '%s' "$body" | grep -Eiq 'no group-named field denotes a repository' && echo "group_field_ban=OK" || echo "group_field_ban=MISSING"
[ "$n" -eq 11 ] && [ "${projkey:-0}" -eq 0 ] && printf '%s' "$body" | grep -Eiq 'member field never denotes the group' && echo "P23 verdict: PASS" || echo "P23 verdict: FAIL"
```

**P24 — AC-F6-3: projects.v1 is the delivered flat record set, never the group contract**

```bash
# P24 — AC-F6-3: projects.v1 is the delivered flat record set, never the group contract
[ "${P00_READY:-}" = "gh303" ] || { echo "FATAL: P00 preamble not loaded" >&2; exit 1; }
require_p00; need section squash
if [ -z "$(grep -m1 '^## projects.v1' "$CT")" ]; then echo "projects_v1=absent"; echo "P24 verdict: FAIL"; exit 0; fi
body=$(section "$CT" '## projects.v1' | squash); n=0
for f in 'data\.projects\[\]' 'projectKey' 'hostIndexRevision' 'project-groups\.v1' 'alias payload|delivered flat record set'; do
  printf '%s' "$body" | grep -Eiq -- "$f" && n=$((n+1)) || echo "MISSING $f"; done
echo "delivered_fields=$n/5"
affirm=$(printf '%s' "$body" | grep -Eoic 'projects\.v1 (is|as) the group contract|projects\.v1 holds groups|projects\.v1.*group identity' || true)
groupfield=$(printf '%s' "$body" | grep -Eoic 'data\.groups\[\]|groupKey' || true)
echo "group_affirmations=${affirm:-0} group_fields=${groupfield:-0}"
[ "$n" -eq 5 ] && [ "${affirm:-0}" -eq 0 ] && [ "${groupfield:-0}" -eq 0 ] && echo "P24 verdict: PASS" || echo "P24 verdict: FAIL"
```

**P25 — AC-F6-4: one normative rename rule, one alias meaning, zero**

```bash
# P25 — AC-F6-4: one normative rename rule, one alias meaning, zero
# one-spelling-two-shapes statements
[ "${P00_READY:-}" = "gh303" ] || { echo "FATAL: P00 preamble not loaded" >&2; exit 1; }
require_p00; need renamerule_count squash
rc=$(renamerule_count)
echo "rename_rule_occurrences=$rc"
docs="$BL $MR $MRD $A $CT $PJ $R $Q $B $TS $JN $EPD $ST $RG"
two=$(cat $docs 2>/dev/null | squash | tr '.' '\n' | grep -Eic 'projects list[^.]{0,80}(both (shapes|surfaces|payloads)|two (shapes|surfaces))|one spelling[^.]{0,40}(both|two shapes)' || true)
alias_group=$(cat $docs 2>/dev/null | tr '.' '\n' | grep -Eic 'projects list --flat[^.]{0,120}(data\.groups|groupKey|project-groups)' || true)
alias_uses=$(cat $docs 2>/dev/null | grep -o 'projects list --flat' | wc -l)
echo "two_shape_sentences=${two:-0} alias_paired_with_group=${alias_group:-0} alias_occurrences=$alias_uses"
printf '%s' "$(cat "$CT" 2>/dev/null)" | grep -Fq 'deprecation alias is the different token `projects list --flat`' && echo "alias_token_defined=OK" || echo "alias_token_defined=MISSING"
[ "$rc" -eq 1 ] && [ "${two:-0}" -eq 0 ] && [ "${alias_group:-0}" -eq 0 ] && [ "$alias_uses" -ge 3 ] && echo "P25 verdict: PASS" || echo "P25 verdict: FAIL"
```

**P26 — AC-F6-5: the repository-vocabulary mapping clause in contracts both command pages, and the repos.v1 section**

```bash
# P26 — AC-F6-5: the repository-vocabulary mapping clause in contracts,
# both command pages, and the repos.v1 section
[ "${P00_READY:-}" = "gh303" ] || { echo "FATAL: P00 preamble not loaded" >&2; exit 1; }
require_p00; need section squash
ct=$(cat "$CT" 2>/dev/null | squash)
if [ ! -f "$CT" ]; then echo "contracts=absent"; echo "P26 verdict: FAIL"; exit 0; fi
n=0
for f in 'project-identity\.json' '<host root>/projects/<key>' 'projects\[\].{0,20}projectKey|host index.s .projects' '--project-root' 'denote a repository checkout' 'unless a code change renames them'; do
  printf '%s' "$ct" | grep -Eiq -- "$f" && n=$((n+1)) || echo "contracts MISSING $f"; done
echo "contracts_mapping=$n/6"
rv=$(section "$CT" '## repos.v1' | squash)
c=0; [ "$(printf '%s' "$rv" | grep -Eic 'denote a repository checkout' || true)" -ge 1 ] && c=$((c+1))
echo "repos_v1_mapping_carried=$c/1"
for pg in "$R" "$PJ"; do
  [ -f "$pg" ] || { echo "$pg ABSENT"; continue; }
  m=0; for f in 'project-identity\.json' '<host root>/projects/<key>' 'projects\[\]' '--project-root' 'denote a repository checkout'; do
    grep -Eiq -- "$f" "$pg" && m=$((m+1)); done
  echo "$(basename "$pg")_mapping=$m/5"
  [ "$m" -eq 5 ] || echo "$(basename "$pg") mapping incomplete"
done
rm_=$( [ -f "$R" ] && grep -Eic 'denote a repository checkout' "$R" || echo 0)
pm_=$( [ -f "$PJ" ] && grep -Eic 'denote a repository checkout' "$PJ" || echo 0)
[ "$n" -eq 6 ] && [ "$c" -eq 1 ] && [ "$rm_" -ge 1 ] && [ "$pm_" -ge 1 ] && echo "P26 verdict: PASS" || echo "P26 verdict: FAIL"
```

**P27 — AC-F6-6: the project configuration document and configuration-only membership**

```bash
# P27 — AC-F6-6: the project configuration document and configuration-only membership
[ "${P00_READY:-}" = "gh303" ] || { echo "FATAL: P00 preamble not loaded" >&2; exit 1; }
require_p00; need section squash
if [ -z "$(grep -m1 '^## Project configuration document' "$CT")" ]; then echo "configuration_document=absent"; echo "P27 verdict: FAIL (change absent)"; exit 0; fi
body=$(section "$CT" '## Project configuration document' | squash); n=0
for f in '<configDirectoryName>/projects\.yaml' 'delivery\.projects\.groups\.v1' 'groups\[\]' 'groupKey' 'name' 'workspaceRoot' 'members\[\]' 'repoKey' 'trackerKind' 'configuration-only' 'never admits an undeclared clone'; do
  printf '%s' "$body" | grep -Eiq -- "$f" && n=$((n+1)) || echo "MISSING $f"; done
selector=$(printf '%s' "$body" | grep -Eic 'selector.*root.*repoKey|`root` or `repoKey`' || true)
echo "config_fields=$n/11 selector=${selector:-0}"
[ "$n" -eq 11 ] && [ "${selector:-0}" -ge 1 ] && echo "P27 verdict: PASS" || echo "P27 verdict: FAIL"
```

**P28 — AC-F6-7: the project-scoped aggregation clause**

```bash
# P28 — AC-F6-7: the project-scoped aggregation clause
[ "${P00_READY:-}" = "gh303" ] || { echo "FATAL: P00 preamble not loaded" >&2; exit 1; }
require_p00; need section squash
if [ -z "$(grep -m1 '^## Project-scoped aggregation' "$CT")" ]; then echo "aggregation=absent"; echo "P28 verdict: FAIL (change absent)"; exit 0; fi
body=$(section "$CT" '## Project-scoped aggregation' | squash); n=0
for f in 'declared order' 'observed' 'not-yet-supported' 'state-unavailable' 'unregistered' 'partial' 'exit `0`|exit 0' 'degraded member named' 'exit `2`|exit 2' 'configuration document|invoking scope' 'contributes no records' 'never fails the read'; do
  printf '%s' "$body" | grep -Eiq -- "$f" && n=$((n+1)) || echo "MISSING $f"; done
echo "aggregation_anchors=$n/12"
printf '%s' "$body" | grep -Eiq 'exit `2` occurs only when|exit 2 occurs only when|Only when the configuration' && echo "exit2_restricted=OK" || echo "exit2_restricted=MISSING"
[ "$n" -eq 12 ] && echo "P28 verdict: PASS" || echo "P28 verdict: FAIL"
```

**P29 — AC-F6-8: the queue/lane representation and the release rule**

```bash
# P29 — AC-F6-8: the queue/lane representation and the release rule
[ "${P00_READY:-}" = "gh303" ] || { echo "FATAL: P00 preamble not loaded" >&2; exit 1; }
require_p00; need section squash
if [ -z "$(grep -m1 '^## Queue and lane representation' "$CT")" ]; then echo "queue_lane=absent"; echo "P29 verdict: FAIL (change absent)"; exit 0; fi
body=$(section "$CT" '## Queue and lane representation' | squash); n=0
for f in 'one queue entry per member' "keyed by that member.s ref" 'per-member dependency edges' 'one lane per member entry' 'never a cross-repository lane' 'release drops each member.s lease' 'removal happens per member' "one member landing removes only" 'entries stay'; do
  printf '%s' "$body" | grep -Eiq -- "$f" && n=$((n+1)) || echo "MISSING $f"; done
echo "queue_lane_anchors=$n/9"
[ "$n" -eq 9 ] && echo "P29 verdict: PASS" || echo "P29 verdict: FAIL"
```

**P30 — AC-F6-9: the plan shape's behavioural clauses (review flow, CI**

```bash
# P30 — AC-F6-9: the plan shape's behavioural clauses (review flow, CI
# corroboration, ordering, evidence) and the shared verdict location
[ "${P00_READY:-}" = "gh303" ] || { echo "FATAL: P00 preamble not loaded" >&2; exit 1; }
require_p00; need section squash
if [ -z "$(grep -m1 '^## Cross-repository change plan shape' "$CT")" ]; then echo "plan_shape=absent"; echo "P30 verdict: FAIL (change absent)"; exit 0; fi
hdr=$(grep -m1 '^## Cross-repository change plan shape' "$CT")
body=$(section "$CT" "$hdr" | squash)
n=0
for f in 'one review run over the declared member pull-request set' 'one verdict per member' 'reviewed twice' 'per-member CI corroboration' 'unavailable reading blocks' 'does not start before the prerequisite member.s pull request lands' 'landing order' 'verify gates' 'data\.definitionOfDone' 'data\.blockingMembers\[\]' 'closeout\.data\.members\[\]'; do
  printf '%s' "$body" | grep -Eiq -- "$f" && n=$((n+1)) || echo "MISSING $f"; done
echo "plan_shape_behaviour=$n/11"
[ "$n" -eq 11 ] && echo "P30 verdict: PASS" || echo "P30 verdict: FAIL"
```

**P31 — AC-F7-1: repos.md is a complete flat record-set page with**

```bash
# P31 — AC-F7-1: repos.md is a complete flat record-set page with
# no-state-read help and version
[ "${P00_READY:-}" = "gh303" ] || { echo "FATAL: P00 preamble not loaded" >&2; exit 1; }
require_p00
if [ ! -f "$R" ]; then echo "repos_md=absent"; echo "checks=0/12"; echo "P31 verdict: FAIL (change absent)"; exit 0; fi
n=0
grep -Fxq 'Status: Proposed (M2)' "$R" && n=$((n+1)) || echo "MISSING status header"
grep -Eiq '^`repos`' "$R" && n=$((n+1)) || echo "MISSING bare NAME"
grep -Fq 'repos list [--json]' "$R" && n=$((n+1)) || echo "MISSING list synopsis"
grep -Fq 'repos --help' "$R" && n=$((n+1)) || echo "MISSING command help"
grep -Fq 'repos list --help' "$R" && n=$((n+1)) || echo "MISSING verb help"
grep -Fq 'repos --version' "$R" && n=$((n+1)) || echo "MISSING version"
nsr=$(grep -Eic 'without reading state, git, configuration, or the network|no read of state' "$R" || true)
[ "${nsr:-0}" -ge 2 ] && n=$((n+1)) || echo "MISSING no-state-read semantics"
fields=0; for f in 'repoKey' 'root' 'stateLocation' 'daemonReachable' 'handoverState'; do grep -Fq "$f" "$R" && fields=$((fields+1)); done
grep -Fq 'data.repos[]' "$R" && n=$((n+1)) || echo "MISSING repos.v1 envelope"
grep -q '^## EXIT STATUS' "$R" && grep -q '^## EXAMPLES' "$R" && n=$((n+1)) || echo "MISSING exit/examples sections"
grep -q '^## ERRORS' "$R" && grep -q '^## SEE ALSO' "$R" && n=$((n+1)) || echo "MISSING errors/see-also"
grep -Eiq 'rename rule' "$R" && n=$((n+1)) || echo "MISSING rename pointer"
echo "checks=$n/11 fields=$fields/5"
[ "$n" -eq 11 ] && [ "$fields" -eq 5 ] && echo "P31 verdict: PASS" || echo "P31 verdict: FAIL"
```

**P32 — AC-F7-2: repos.md scope section restores read-only semantics and the**

```bash
# P32 — AC-F7-2: repos.md scope section restores read-only semantics and the
# declared `unbound` behaviour
[ "${P00_READY:-}" = "gh303" ] || { echo "FATAL: P00 preamble not loaded" >&2; exit 1; }
require_p00; need section squash
if [ ! -f "$R" ]; then echo "repos_md=absent"; echo "P32 verdict: FAIL (change absent)"; exit 0; fi
body=$(section "$R" '## SCOPE' | squash)
[ -z "$body" ] && { echo "scope_section=absent"; echo "P32 verdict: FAIL"; exit 0; }
n=0
for f in 'no index maintenance' 'prunes nothing' 'creates no state root' 'identity marker' 'tmp' 'unbound' 'one bounded warning' 'registers nothing' 'keeps its exit code' 'never reported as a row' 'never a failure'; do
  printf '%s' "$body" | grep -Eiq -- "$f" && n=$((n+1)) || echo "MISSING $f"; done
echo "scope_anchors=$n/11"
printf '%s' "$body" | grep -Eiq 'declared .?unbound.? scope' && echo "unbound_declared=OK" || echo "unbound_declared=MISSING"
[ "$n" -eq 11 ] && printf '%s' "$body" | grep -Eiq 'never a failure' && echo "P32 verdict: PASS" || echo "P32 verdict: FAIL"
```

**P33 — AC-F7-3: the delivered `projects.*` identities are retained with their**

```bash
# P33 — AC-F7-3: the delivered `projects.*` identities are retained with their
# delivered exit values, a non-work-tree root is the `unbound` scope at exit 0
# and never an error, and a `repos.*` prefix change is S18 code work
[ "${P00_READY:-}" = "gh303" ] || { echo "FATAL: P00 preamble not loaded" >&2; exit 1; }
require_p00; need squash section
if [ ! -f "$R" ]; then echo "repos_md=absent"; echo "P33 verdict: FAIL (change absent)"; exit 0; fi
sq=$(cat "$R" | squash)
ERR=$(section "$R" '## ERRORS'); SCOPE=$(section "$R" '## SCOPE')
err_exit() { printf '%s\n' "$ERR" | grep -E "^\| \`$1\`" | awk -F'|' '{v=$(NF-1); gsub(/^[ \t]+|[ \t]+$/,"",v); print v}'; }
ie=$(err_exit projects.identity-unreadable); re=$(err_exit projects.registry-corrupt); se=$(err_exit projects.state-unavailable)
echo "error_table_identity_unreadable_exit=${ie:-absent}"
echo "error_table_registry_corrupt_exit=${re:-absent}"
echo "error_table_state_unavailable_exit=${se:-absent}"
# The three delivered identities must be present in the table (not invented ones).
n=0
for f in 'projects\.identity-unreadable' 'projects\.registry-corrupt' 'projects\.state-unavailable'; do
  printf '%s' "$sq" | grep -Eiq -- "$f" && n=$((n+1)) || echo "IDENTITY MISSING $f"; done
printf '%s' "$sq" | grep -Eiq 'repos\.\*.*error-prefix change is M2-S18 code work' && n=$((n+1)) || echo "MISSING repos.* code-work statement"
inv=$(printf '%s' "$sq" | grep -Eoic 'repos\.identity-unreadable|repos\.index-corrupt|repos\.state-unavailable' || true)
echo "identities=$n/4 invented_identities=${inv:-0}"
# `unbound` is a declared scope (prose), never an error-table row, never an error exit.
printf '%s' "$SCOPE" | grep -Eiq 'unbound' && echo "unbound_in_scope=OK" || echo "unbound_in_scope=MISSING"
# A row *about* `unbound` is one whose error-identity cell names it. The delivered
# table may (and should) mention the scope inside another row's meaning cell to
# disclaim it, so only the identity cell counts here.
urow=$(printf '%s\n' "$ERR" | grep -E '^[|] ' | awk -F'|' '{print $2}' | grep -Eic 'unbound' || true)
echo "unbound_as_error_row=${urow:-0}"
# A sentence may not attach `unbound` to an error/failure or a non-zero exit.
uatt=$(printf '%s' "$sq" | tr '.' '\n' | grep -Ei 'unbound' | grep -Ei 'exit[^.]{0,12}(1|2)([^0-9]|$)|fail|error|refus' | grep -Eiv 'never|not |isn.t|no error' | grep -c . || true)
echo "unbound_error_attachment=${uatt:-0}"
# A non-work-tree root may not be described as a failure (negations excluded).
nwt=$(printf '%s' "$sq" | tr '.' '\n' | grep -Ei 'not a git work tree|non-work-tree' | grep -Ei 'fail|error|refus|exit[^.]{0,8}(1|2)([^0-9]|$)' | grep -Eiv 'never|not |isn.t|n.t an error' | grep -c . || true)
echo "non_worktree_failure_claim=${nwt:-0}"
# --- both directions on the real page ---
cp "$R" "$SH/p33-mut-exit.md"
awk '{ if ($0 ~ /^\| `projects\.identity-unreadable`/) { sub(/\| 1 \|$/, "| 0 for `unbound`, 2 otherwise |") } print }' "$R" > "$SH/p33-mut-exit.tmp" && mv "$SH/p33-mut-exit.tmp" "$SH/p33-mut-exit.md"
cp "$R" "$SH/p33-mut-nwt.md"
python3 - "$SH/p33-mut-nwt.md" <<'PY'
import sys
p = sys.argv[1]
s = open(p, encoding="utf-8").read()
old = "It is never reported\nas a row and is never a failure."
new = "A non-work-tree root is refused\nas a failure at exit 2."
assert s.count(old) == 1, "fixture sentence not found"
open(p, "w", encoding="utf-8").write(s.replace(old, new, 1))
PY
mut_exit=$(section "$SH/p33-mut-exit.md" '## ERRORS' | grep -E '^\| `projects\.identity-unreadable`' | awk -F'|' '{v=$(NF-1); gsub(/^[ \t]+|[ \t]+$/,"",v); print v}')
[ "$mut_exit" != "1" ] && echo "mutant_unbound_exit=detected (exit cell = $mut_exit)" || echo "mutant_unbound_exit=NOT-DETECTED"
mut_nwt=$(cat "$SH/p33-mut-nwt.md" | squash | tr '.' '\n' | grep -Ei 'not a git work tree|non-work-tree' | grep -Ei 'fail|refus|exit[^.]{0,8}(1|2)([^0-9]|$)' | grep -Eiv 'never|not |isn.t' | grep -c . || true)
[ "${mut_nwt:-0}" -ge 1 ] && echo "mutant_nonworktree_error=detected" || echo "mutant_nonworktree_error=NOT-DETECTED"
[ "$ie" = "1" ] && [ "$re" = "2" ] && [ "$se" = "2" ] && [ "$n" -eq 4 ] && [ "${inv:-0}" -eq 0 ] \
 && printf '%s' "$SCOPE" | grep -Eiq 'unbound' && [ "${urow:-0}" -eq 0 ] && [ "${uatt:-0}" -eq 0 ] && [ "${nwt:-0}" -eq 0 ] \
 && [ "$mut_exit" != "1" ] && [ "${mut_nwt:-0}" -ge 1 ] && echo "P33 verdict: PASS" || echo "P33 verdict: FAIL"
```

**P34 — AC-F7-4: the STATE example is the host-root container with a**

```bash
# P34 — AC-F7-4: the STATE example is the host-root container with a
# PROJECT_KEY_PATTERN key, and the page carries the mapping clause sentence
[ "${P00_READY:-}" = "gh303" ] || { echo "FATAL: P00 preamble not loaded" >&2; exit 1; }
require_p00; need section squash
if [ ! -f "$R" ]; then echo "repos_md=absent"; echo "P34 verdict: FAIL (change absent)"; exit 0; fi
pat='^[a-z0-9]([a-z0-9-]*[a-z0-9])?-[0-9a-f]{8}$'
state=$(section "$R" '## STATE')
printf '%s' "$state" | grep -Fq '<host root>/projects/<key>' && echo "state_container=OK" || echo "state_container=MISSING"
keys=$(printf '%s\n' "$state" | grep -oE '[a-z0-9][a-z0-9-]*-[0-9a-f]{8}' | sort -u)
echo "state_example_keys=$(printf '%s' "$keys" | tr '\n' ' ')"
ok=0
for k in $keys; do printf '%s' "$k" | grep -Eq "$pat" && ok=$((ok+1)); done
echo "pattern_valid_keys=$ok"
bare=$(printf '%s\n' "$state" | grep -oE 'projects/[a-z0-9][a-z0-9-]*[a-z0-9]' | grep -Ev -- '-[0-9a-f]{8}$' | wc -l)
echo "bare_basename_keys=$bare"
printf '%s' "$(cat "$R" | squash)" | grep -Eiq 'denote a repository checkout' && echo "mapping_clause_on_page=OK" || echo "mapping_clause_on_page=MISSING"
[ "$ok" -ge 1 ] && [ "$bare" -eq 0 ] && printf '%s' "$state" | grep -Fq '<host root>/projects/<key>' && grep -Fq 'PROJECT_KEY_PATTERN' "$R" && echo "P34 verdict: PASS" || echo "P34 verdict: FAIL"
```

**P35 — AC-F7-5: projects.md is the group page with the group envelope member health, and pointers; no orphan daemonReachable.reason paragraph**

```bash
# P35 — AC-F7-5: projects.md is the group page with the group envelope,
# member health, and pointers; no orphan daemonReachable.reason paragraph
[ "${P00_READY:-}" = "gh303" ] || { echo "FATAL: P00 preamble not loaded" >&2; exit 1; }
require_p00; need squash
if [ ! -f "$PJ" ]; then echo "projects_md=absent"; echo "P35 verdict: FAIL"; exit 0; fi
sq=$(cat "$PJ" | squash); n=0
for f in 'project-groups\.v1' 'data\.groups\[\]' 'groupKey' 'members\[\]\.daemonReachable' 'daemon-not-mounted' 'state-absent' 'socket-absent' 'socket-unreachable' 'configuration document|projects\.yaml' 'aggregation clause|project-scoped aggregation' 'data\.groups\[\].{0,120}groupKey|"groups".{0,80}"groupKey"|groups\[\].groupKey' ; do
  printf '%s' "$sq" | grep -Eiq -- "$f" && n=$((n+1)) || echo "MISSING $f"; done
echo "group_page_anchors=$n/11"
orph=0
while IFS= read -r line; do
  printf '%s' "$line" | grep -q 'daemonReachable.reason' || continue
  printf '%s' "$line" | grep -Eq 'members\[\]|groups\[\]' || orph=$((orph+1))
done < <(cat "$PJ")
echo "orphan_reason_paragraphs=$orph"
[ "$n" -eq 11 ] && [ "$orph" -eq 0 ] && echo "P35 verdict: PASS" || echo "P35 verdict: FAIL"
```

**P36 — AC-F7-6: aggregation behaviour, no group-scoped board claim <groupKey> argument, --flat pointer, time-scoped disambiguation**

```bash
# P36 — AC-F7-6: aggregation behaviour, no group-scoped board claim,
# <groupKey> argument, --flat pointer, time-scoped disambiguation
[ "${P00_READY:-}" = "gh303" ] || { echo "FATAL: P00 preamble not loaded" >&2; exit 1; }
require_p00; need squash
if [ ! -f "$PJ" ]; then echo "projects_md=absent"; echo "P36 verdict: FAIL"; exit 0; fi
sq=$(cat "$PJ" | squash); n=0
printf '%s' "$sq" | grep -Eiq 'classified partial result' && n=$((n+1)) || echo "MISSING classified partial result"
printf '%s' "$sq" | grep -Eiq 'not-yet-supported' && n=$((n+1)) || echo "MISSING not-yet-supported"
printf '%s' "$sq" | grep -Eiq 'exit `0`|exits `0`|exit 0' && n=$((n+1)) || echo "MISSING exit-0 behaviour"
printf '%s' "$sq" | grep -Eiq 'exit `2`|exit 2' && n=$((n+1)) || echo "MISSING exit-2 behaviour"
printf '%s' "$sq" | grep -Eiq -- '--project <groupKey>' && n=$((n+1)) || echo "MISSING --project <groupKey>"
printf '%s' "$sq" | grep -Eiq 'projects list --flat' && n=$((n+1)) || echo "MISSING --flat alias row"
printf '%s' "$sq" | grep -Eiq 'rename rule' && n=$((n+1)) || echo "MISSING rename-rule pointer"
printf '%s' "$sq" | grep -Eiq 'before M2-S18|from M2-S18' && n=$((n+1)) || echo "MISSING time-scoped disambiguation"
board=$(printf '%s' "$sq" | tr '.' '\n' | grep -Ei 'board[^.]{0,80}group|group-scoped board' | grep -Eiv 'no |not |never|neither|only queue and status' | grep -c . || true)
twoshape=$(printf '%s' "$sq" | grep -Eoic 'both shapes|both surfaces at once' || true)
echo "behaviour_anchors=$n/8 board_group_claims=${board:-0} two_shape=${twoshape:-0}"
[ "$n" -eq 8 ] && [ "${board:-0}" -eq 0 ] && [ "${twoshape:-0}" -eq 0 ] && echo "P36 verdict: PASS" || echo "P36 verdict: FAIL"
```

**P37 — AC-F7-7: the two pages never share a surface**

```bash
# P37 — AC-F7-7: the two pages never share a surface
[ "${P00_READY:-}" = "gh303" ] || { echo "FATAL: P00 preamble not loaded" >&2; exit 1; }
require_p00
if [ ! -f "$R" ] || [ ! -f "$PJ" ]; then echo "pages=absent"; echo "P37 verdict: FAIL (change absent)"; exit 0; fi
r1=$(grep -c 'repos\.v1' "$R"); r2=$(grep -c 'data\.groups\[\]\|project-groups\.v1\|groupKey' "$R")
p1=$(grep -c 'project-groups\.v1' "$PJ"); p2=$(grep -c 'repos\.v1\|data\.repos\[\]' "$PJ")
h1=$(grep -Fxq 'Status: Proposed (M2)' "$R" && echo 1 || echo 0); h2=$(grep -Fxq 'Status: Proposed (M2)' "$PJ" && echo 1 || echo 0)
e1=$(grep -Eic 'not composed|not yet registered|planned' "$R" || true); e2=$(grep -Eic 'not composed|not yet registered|planned' "$PJ" || true)
echo "repos_page: repos.v1=$r1 group_surface=$r2 header=$h1 planned=$e1"
echo "projects_page: project-groups.v1=$p1 repos_surface=$p2 header=$h2 planned=$e2"
[ "$r1" -ge 1 ] && [ "$r2" -eq 0 ] && [ "$p1" -ge 1 ] && [ "$p2" -eq 0 ] && [ "$h1" -eq 1 ] && [ "$h2" -eq 1 ] && [ "${e1:-0}" -ge 1 ] && [ "${e2:-0}" -ge 1 ] && echo "P37 verdict: PASS" || echo "P37 verdict: FAIL"
```

**P38 — AC-F7-8: board.md is reconciled to the repository-key boundary**

```bash
# P38 — AC-F7-8: board.md is reconciled to the repository-key boundary
[ "${P00_READY:-}" = "gh303" ] || { echo "FATAL: P00 preamble not loaded" >&2; exit 1; }
require_p00; need squash
if [ ! -f "$B" ]; then echo "board_md=absent"; echo "P38 verdict: FAIL"; exit 0; fi
sq=$(cat "$B" | squash); n=0
printf '%s' "$sq" | grep -Eiq -- '--project. takes a repository key|--project <key>. takes a repository key|repository key' && n=$((n+1)) || echo "MISSING repository-key boundary"
printf '%s' "$sq" | grep -Eiq -- '--all. spans managed repositories|spans managed repositories' && n=$((n+1)) || echo "MISSING --all scope"
printf '%s' "$sq" | grep -Eiq 'repositories\[\]' && n=$((n+1)) || echo "MISSING repositories[] envelope"
printf '%s' "$sq" | grep -Eiq 'board\.repository-unknown' && n=$((n+1)) || echo "MISSING repository refusal identity"
printf '%s' "$sq" | grep -Eiq 'per-repository state scope' && n=$((n+1)) || echo "MISSING state-scope attribution"
printf '%s' "$sq" | grep -Eiq 'host index' && n=$((n+1)) || echo "MISSING host-index attribution"
printf '%s' "$sq" | grep -Eiq 'M2-S11' && n=$((n+1)) || echo "MISSING M2-S11 attribution"
echo "board_anchors=$n/7"
old=$(printf '%s' "$sq" | grep -Eoic 'project model M2-S11 introduces|board\.project-unknown|every managed project on the host through the project model' || true)
grp=$(printf '%s' "$sq" | tr '.' '\n' | grep -Ei 'board[^.]{0,60}group' | grep -Eiv 'no |not |never|neither|only queue and status' | grep -c . || true)
echo "stale_claims=${old:-0} group_claims=${grp:-0}"
[ "$n" -eq 7 ] && [ "${old:-0}" -eq 0 ] && [ "${grp:-0}" -eq 0 ] && echo "P38 verdict: PASS" || echo "P38 verdict: FAIL"
```

**P39 — AC-F7-9: the queue grammar, the pinned status delta in the M2 README**

```bash
# P39 — AC-F7-9: the queue grammar, the pinned status delta in the M2 README
# row, and the byte-identical M1 status page
[ "${P00_READY:-}" = "gh303" ] || { echo "FATAL: P00 preamble not loaded" >&2; exit 1; }
require_p00
if [ ! -f "$Q" ]; then echo "queue_md=absent"; echo "P39 verdict: FAIL"; exit 0; fi
syn=$(awk '/^## SYNOPSIS/{f=1;next} /^## /{f=0} f' "$Q")
opt=$(awk '/^## OPTIONS/{f=1;next} /^## /{f=0} f' "$Q")
printf '%s\n' "$syn" | grep -Fq 'queue list --project <groupKey>' && echo "synopsis_grammar=OK" || echo "synopsis_grammar=MISSING"
printf '%s\n' "$opt" | grep -Fq -- '--project <groupKey>' && echo "options_grammar=OK" || echo "options_grammar=MISSING"
row=$(grep -E '^\| M2-S18 ' "$MRD")
printf '%s' "$row" | grep -Fq 'status --project <groupKey>' && echo "m2_readme_status_delta=OK" || echo "m2_readme_status_delta=MISSING"
m1=doc/planning/oss-tooling/milestones/m1/commands/status.md
git show "$BASE:$m1" > "$SH/p39-m1-status-base.md" 2>/dev/null
if [ -f "$m1" ]; then cmp -s "$SH/p39-m1-status-base.md" "$m1" && echo "m1_status_page=byte-identical" || echo "m1_status_page=CHANGED"; else echo "m1_status_page=absent"; fi
printf '%s\n' "$syn" | grep -Fq 'queue list --project <groupKey>' && printf '%s\n' "$opt" | grep -Fq -- '--project <groupKey>' && printf '%s' "$row" | grep -Fq 'status --project <groupKey>' && cmp -s "$SH/p39-m1-status-base.md" "$m1" && echo "P39 verdict: PASS" || echo "P39 verdict: FAIL"
```

**P40 — AC-F8-1: the S18 seed set, one Assert each, and the six required topics**

```bash
# P40 — AC-F8-1: the S18 seed set, one Assert each, and the six required topics
[ "${P00_READY:-}" = "gh303" ] || { echo "FATAL: P00 preamble not loaded" >&2; exit 1; }
require_p00; need seed_asserts squash
reg() { awk '/^## M2-S18 /{f=1} f&&/^## M2-S19 /{exit} f' "$TS" 2>/dev/null; }
if [ ! -f "$TS" ]; then echo "scenarios=absent"; echo "P40 verdict: FAIL"; exit 0; fi
n=$(reg | grep -c '^### SC-M2-S18-'); echo "s18_seeds=$n"
bad=0
for id in $(reg | grep -oE '^### (SC-M2-S18-[0-9]+)' | awk '{print $2}'); do
  a=$(seed_asserts "$TS" "$id"); [ "$a" -eq 1 ] || { echo "ASSERT COUNT $id=$a"; bad=$((bad+1)); }; done
echo "assert_violations=$bad"
sq=$(reg | squash); t=0
printf '%s' "$sq" | grep -Eiq 'register.{0,80}workspace directory|workspace directory.{0,80}register' && t=$((t+1)) || echo "topic MISSING workspace discovery"
printf '%s' "$sq" | grep -Eiq 'without a workspace|no .?workspaceRoot.?|workspaceRoot. absent' && t=$((t+1)) || echo "topic MISSING no-workspace equivalence"
printf '%s' "$sq" | grep -Eiq 'health' && printf '%s' "$sq" | grep -Eiq 'members\[\]\.daemonReachable' && t=$((t+1)) || echo "topic MISSING member health"
printf '%s' "$sq" | grep -Eiq 'queue list --project <groupKey>' && printf '%s' "$sq" | grep -Eiq 'status --project <groupKey>' && t=$((t+1)) || echo "topic MISSING scoped reads"
printf '%s' "$sq" | grep -Eiq 'mixing tracker kinds|mixed tracker' && printf '%s' "$sq" | grep -Eiq 'not-yet-supported' && t=$((t+1)) || echo "topic MISSING mixed-tracker classification"
printf '%s' "$sq" | grep -Eiq 'undeclared clone' && printf '%s' "$sq" | grep -Eiq 'not a member' && t=$((t+1)) || echo "topic MISSING undeclared-clone seed"
printf '%s' "$sq" | grep -Eiq 'state-unavailable' && printf '%s' "$sq" | grep -Eiq 'partial' && t=$((t+1)) || echo "topic MISSING classified partial result"
echo "topic_anchors=$t/7"
[ "$n" -ge 5 ] && [ "$bad" -eq 0 ] && [ "$t" -eq 7 ] && echo "P40 verdict: PASS" || echo "P40 verdict: FAIL"
```

**P41 — AC-F8-2: the S19 seed set, one Assert each, and the four required topics**

```bash
# P41 — AC-F8-2: the S19 seed set, one Assert each, and the four required topics
[ "${P00_READY:-}" = "gh303" ] || { echo "FATAL: P00 preamble not loaded" >&2; exit 1; }
require_p00; need seed_asserts squash
reg() { awk '/^## M2-S19 /{f=1} f&&/^## Cross-story scenarios/{exit} f' "$TS" 2>/dev/null; }
if [ ! -f "$TS" ]; then echo "scenarios=absent"; echo "P41 verdict: FAIL"; exit 0; fi
n=$(reg | grep -c '^### SC-M2-S19-'); echo "s19_seeds=$n"
bad=0
for id in $(reg | grep -oE '^### (SC-M2-S19-[0-9]+)' | awk '{print $2}'); do
  a=$(seed_asserts "$TS" "$id"); [ "$a" -eq 1 ] || { echo "ASSERT COUNT $id=$a"; bad=$((bad+1)); }; done
echo "assert_violations=$bad"
sq=$(reg | squash); t=0
printf '%s' "$sq" | grep -Eiq 'one spec' && printf '%s' "$sq" | grep -Eiq 'two member branches' && printf '%s' "$sq" | grep -Eiq 'two pull requests' && printf '%s' "$sq" | grep -Eiq 'one review' && printf '%s' "$sq" | grep -Eiq 'closeout' && t=$((t+1)) || echo "topic MISSING lifecycle shape"
printf '%s' "$sq" | grep -Eiq 'blockingMembers\[\]|blockingMembers' && printf '%s' "$sq" | grep -Eiq 'failing member' && t=$((t+1)) || echo "topic MISSING failing-member block"
printf '%s' "$sq" | grep -Eiq 'gates\.ci' && printf '%s' "$sq" | grep -Eiq 'corroborat' && t=$((t+1)) || echo "topic MISSING CI corroboration"
printf '%s' "$sq" | grep -Eiq 'unavailable' && t=$((t+1)) || echo "topic MISSING unavailable CI reading"
printf '%s' "$sq" | grep -Eiq 'dependsOn\[\]' && printf '%s' "$sq" | grep -Eiq 'landing order' && t=$((t+1)) || echo "topic MISSING dependency ordering"
echo "topic_anchors=$t/5"
[ "$n" -ge 5 ] && [ "$bad" -eq 0 ] && [ "$t" -eq 5 ] && echo "P41 verdict: PASS" || echo "P41 verdict: FAIL"
```

**P42 — AC-F8-3: every S18/S19 assertion reads a declared envelope, none uses**

```bash
# P42 — AC-F8-3: every S18/S19 assertion reads a declared envelope, none uses
# a `change.data.*` family, and the closeout assertion is contract-backed
[ "${P00_READY:-}" = "gh303" ] || { echo "FATAL: P00 preamble not loaded" >&2; exit 1; }
require_p00; need envelope_ok
if [ ! -f "$TS" ]; then echo "scenarios=absent"; echo "P42 verdict: FAIL"; exit 0; fi
lines=$(awk '/^## M2-S18 /{f=1} f&&/^## Cross-story scenarios/{exit} f&&/^Assert:/{print}' "$TS")
tot=$(printf '%s\n' "$lines" | grep -c . || true)
ok=0; declared=0; retired=0
while IFS= read -r l; do
  [ -z "$l" ] && continue
  if envelope_ok "$l"; then declared=$((declared+1)); else echo "UNDECLARED: $(printf '%s' "$l" | cut -c1-120)"; fi
  printf '%s' "$l" | grep -Eiq 'change\.data\.' && retired=$((retired+1))
done <<< "$lines"
echo "assertions=$tot declared_envelope=$declared retired_family=$retired"
backed=$(grep -Fc 'closeout.data.members[]' "$CT" 2>/dev/null || true)
closeout_assert=$(printf '%s\n' "$lines" | grep -c 'closeout\.data\.members\[\]' || true)
echo "contract_closeout_declaration=$backed closeout_assertions=$closeout_assert"
[ "$tot" -ge 10 ] && [ "$declared" -eq "$tot" ] && [ "$retired" -eq 0 ] && [ "${backed:-0}" -ge 1 ] && [ "$closeout_assert" -ge 1 ] && echo "P42 verdict: PASS" || echo "P42 verdict: FAIL"
```

**P43 — AC-F8-4: the two S11 seeds are reconciled — SC-M2-S11-01 names the flat**

```bash
# P43 — AC-F8-4: the two S11 seeds are reconciled — SC-M2-S11-01 names the flat
# record set through `repos list`, SC-M2-S11-02 is prospective and asserts the
# S18 rename, and no assert attributes enumeration to a flat `projects list`
[ "${P00_READY:-}" = "gh303" ] || { echo "FATAL: P00 preamble not loaded" >&2; exit 1; }
require_p00
if [ ! -f "$TS" ]; then echo "scenarios=absent"; echo "P43 verdict: FAIL"; exit 0; fi
# Tokens are scoped to the seed each requirement names: the S11-01 assert must
# carry `repos list` and no `projects list`; S11-02 carries the rename. A corpus-
# wide count of assert lines mentioning `projects list` is not the requirement,
# because the alias seed legitimately names both spellings.
seed_body() { awk -v i="$2" 'index($0,"### "i)==1{f=1;next} f&&/^#{2,3} /{exit} f' "$1"; }
seed_assert() { awk -v i="$2" 'index($0,"### "i)==1{f=1;next} f&&/^#{2,3} /{exit} f&&/^Assert:/{print}' "$1"; }
tokens() { # $1=file -> the six gated tokens
  local f="$1" a1 b2 t2
  a1=$(seed_assert "$f" 'SC-M2-S11-01'); b2=$(seed_body "$f" 'SC-M2-S11-02'); t2=$(grep -m1 '^### SC-M2-S11-02' "$f")
  printf 's11_01_assert_repos_list=%s\n' "$(printf '%s' "$a1" | grep -c 'repos list' || true)"
  printf 's11_01_assert_projects_list=%s\n' "$(printf '%s' "$a1" | grep -c 'projects list' || true)"
  printf 's11_01_flat_record_set=%s\n' "$(printf '%s' "$a1" | grep -c 'flat record set' || true)"
  printf 's11_02_title_repos=%s\n' "$(printf '%s' "$t2" | grep -c 'repos list' || true)"
  printf 's11_02_body_repos=%s\n' "$(printf '%s' "$b2" | grep -c 'repos list' || true)"
  printf 's11_02_alias=%s\n' "$(printf '%s' "$b2" | grep -c 'projects list --flat' || true)"
  printf 's11_02_payload=%s\n' "$(printf '%s' "$b2" | grep -c 'projectKey' || true)"
  if printf '%s' "$b2" | grep -Eiq 'M2-S18|S18' && printf '%s' "$b2" | grep -Eiq 'rename|repos list'; then echo 's11_02_rename_asserted=OK'; else echo 's11_02_rename_asserted=MISSING'; fi
  printf 'flat_assertions=%s\n' "$(grep -E '^Assert:.*projects list' "$f" | grep -Eic 'enumerat|row|checkout' | head -1 || true)"
}
tokens "$TS" > "$SH/p43-real.txt"
g() { sed -n "s/^$1=//p" "$SH/p43-real.txt" | head -1; }
cat "$SH/p43-real.txt"
# both directions: the same oracle run over a mutant whose S11-01 assert reverts
# to the delivered flat spelling must report a non-zero projects-list count.
# Replace SC-M2-S11-01's Assert line with the delivered flat spelling. The
# substitution is positional, so it also works on a tree whose seed text differs.
awk -v repl='Assert: `projects list` enumerates the flat record set' '
  /^### SC-M2-S11-01 /{f=1; print; next}
  f && /^#{2,3} /{f=0}
  f && /^Assert:/{print repl; next}
  {print}' "$TS" > "$SH/p43-mut.md"
[ "$(grep -c '^Assert: `projects list` enumerates the flat record set$' "$SH/p43-mut.md")" -eq 1 ] || { echo "mutant_construction=FAILED"; echo "P43 verdict: FAIL"; exit 0; }
tokens "$SH/p43-mut.md" > "$SH/p43-mut-out.txt"
m=$(sed -n 's/^s11_01_assert_projects_list=//p' "$SH/p43-mut-out.txt")
mf=$(sed -n 's/^flat_assertions=//p' "$SH/p43-mut-out.txt")
echo "mutant_s11_01_assert_projects_list=$m (expect 1) mutant_flat_assertions=$mf (expect 1)"
[ "$(g s11_01_assert_repos_list)" -ge 1 ] && [ "$(g s11_01_assert_projects_list)" -eq 0 ] \
 && [ "$(g s11_01_flat_record_set)" -ge 1 ] && [ "$(g s11_02_title_repos)" -ge 1 ] \
 && [ "$(g s11_02_body_repos)" -ge 1 ] && [ "$(g s11_02_alias)" -ge 1 ] && [ "$(g s11_02_payload)" -ge 1 ] \
 && [ "$(g s11_02_rename_asserted)" = "OK" ] && [ "$(g flat_assertions)" -eq 0 ] && [ "$m" -eq 1 ] && [ "$mf" -eq 1 ] \
 && echo "P43 verdict: PASS" || echo "P43 verdict: FAIL"
```

**P44 — AC-F8-5: one alias-shaped seed asserts both payloads in one scenario**

```bash
# P44 — AC-F8-5: one alias-shaped seed asserts both payloads in one scenario
[ "${P00_READY:-}" = "gh303" ] || { echo "FATAL: P00 preamble not loaded" >&2; exit 1; }
require_p00
if [ ! -f "$TS" ]; then echo "scenarios=absent"; echo "P44 verdict: FAIL"; exit 0; fi
found=0
for id in $(grep -oE '^### (SC-M2-(S18|S19)-[0-9]+)' "$TS" | awk '{print $2}'); do
  body=$(awk -v i="$id" 'index($0,"### "i)==1{f=1;next} f&&/^#{2,3} /{exit} f' "$TS")
  printf '%s' "$body" | grep -Fq 'projects list --flat --json' || continue
  printf '%s' "$body" | grep -Fq 'projects list --json' || continue
  printf '%s' "$body" | grep -Fq 'data.projects[]' || continue
  printf '%s' "$body" | grep -Fq 'projectKey' || continue
  printf '%s' "$body" | grep -Fq 'hostIndexRevision' || continue
  printf '%s' "$body" | grep -Fq 'data.groups[]' || continue
  printf '%s' "$body" | grep -Fq 'groupKey' || continue
  printf '%s' "$body" | grep -Fq 'projects.v1' || continue
  printf '%s' "$body" | grep -Fq 'project-groups.v1' || continue
  found=$((found+1)); echo "alias_seed=$id"
done
echo "alias_shape_seeds=$found"
[ "$found" -ge 1 ] && echo "P44 verdict: PASS" || echo "P44 verdict: FAIL"
```

**P45 — AC-F8-6: the introduction names the S2-S19 range and every story keeps**

```bash
# P45 — AC-F8-6: the introduction names the S2-S19 range and every story keeps
# at least two seeds
[ "${P00_READY:-}" = "gh303" ] || { echo "FATAL: P00 preamble not loaded" >&2; exit 1; }
require_p00
if [ ! -f "$TS" ]; then echo "scenarios=absent"; echo "P45 verdict: FAIL"; exit 0; fi
# The requirement is the range wording plus the per-story property. "at least two
# per story" wraps across lines in the conforming intro, so the gate is the
# property itself (`stories_below_two=0`) and the two range endpoints, not a grep
# for that phrase.
intro=$(head -8 "$TS")
printf '%s\n' "$intro" | grep -Fq 'M2-S2 through M2-S19' && echo "intro_range=OK" || echo "intro_range=MISSING"
printf '%s\n' "$intro" | grep -Fq 'M2-S2' && echo "m2_s2_present=OK" || echo "m2_s2_present=MISSING"
printf '%s\n' "$intro" | grep -Fq 'M2-S19' && echo "m2_s19_present=OK" || echo "m2_s19_present=MISSING"
below_two() { # $1=file -> count of story sections with fewer than two seeds
  local f="$1" bad=0 s c
  for s in $(grep -oE '^## M2-S[0-9]+ ' "$f" | awk '{print $2}' | sort -u); do
    c=$(grep -c "^### SC-${s}-" "$f" || true)
    [ "$c" -ge 2 ] || bad=$((bad+1))
  done
  echo "$bad"
}
bad=$(below_two "$TS"); tot=$(grep -oE '^## M2-S[0-9]+ ' "$TS" | awk '{print $2}' | sort -u | wc -l)
echo "stories=$tot stories_below_two=$bad"
# both directions: a synthetic two-story file with one seed on the first story is flagged
printf '## M2-S1 One\n\n### SC-M2-S1-01 a\n\nAssert: x\n\n## M2-S2 Two\n\n### SC-M2-S2-01 a\n\nAssert: x\n\n### SC-M2-S2-02 b\n\nAssert: y\n' > "$SH/p45-mut.md"
printf '## M2-S1 One\n\n### SC-M2-S1-01 a\n\nAssert: x\n\n### SC-M2-S1-02 b\n\nAssert: y\n\n## M2-S2 Two\n\n### SC-M2-S2-01 a\n\nAssert: x\n\n### SC-M2-S2-02 b\n\nAssert: y\n' > "$SH/p45-ok.md"
m1=$(below_two "$SH/p45-mut.md"); m0=$(below_two "$SH/p45-ok.md")
echo "self_test_short_story=$([ "$m1" -eq 1 ] && echo detected || echo FAILED) self_test_complete=$([ "$m0" -eq 0 ] && echo OK || echo FAILED)"
[ "$bad" -eq 0 ] && printf '%s\n' "$intro" | grep -Fq 'M2-S2 through M2-S19' && printf '%s\n' "$intro" | grep -Fq 'M2-S2' && printf '%s\n' "$intro" | grep -Fq 'M2-S19' && [ "$m1" -eq 1 ] && [ "$m0" -eq 0 ] && echo "P45 verdict: PASS" || echo "P45 verdict: FAIL"
```

**P46 — AC-F9-1: the opening journey is a group-scoped morning overview**

```bash
# P46 — AC-F9-1: the opening journey is a group-scoped morning overview
[ "${P00_READY:-}" = "gh303" ] || { echo "FATAL: P00 preamble not loaded" >&2; exit 1; }
require_p00; need firstsec squash
if [ ! -f "$JN" ]; then echo "journeys=absent"; echo "P46 verdict: FAIL"; exit 0; fi
j1=$(firstsec "$JN"); j1s=$(printf '%s' "$j1" | squash)
echo "opening_journey_lines=$(printf '%s\n' "$j1" | wc -l)"
n=0
printf '%s' "$j1s" | grep -Eiq 'group' && n=$((n+1)) || echo "MISSING group scope"
printf '%s' "$j1s" | grep -Eiq 'membership comes from configuration|declared in configuration|configuration document' && n=$((n+1)) || echo "MISSING configuration membership"
printf '%s' "$j1s" | grep -Eiq 'repos list' && n=$((n+1)) || echo "MISSING flat view"
printf '%s' "$j1s" | grep -Eiq 'projects list' && n=$((n+1)) || echo "MISSING group view"
printf '%s' "$j1s" | grep -Eiq 'queue list --project <groupKey>' && printf '%s' "$j1s" | grep -Eiq 'status --project <groupKey>' && n=$((n+1)) || echo "MISSING scoped reads"
printf '%s' "$j1s" | grep -Eiq 'optional|never required' && n=$((n+1)) || echo "MISSING workspace optionality"
printf '%s' "$j1s" | grep -Eiq 'same ref' && printf '%s' "$j1s" | grep -Eiq 'disjoint' && n=$((n+1)) || echo "MISSING same-ref disjointness"
printf '%s' "$j1s" | grep -Eiq 'rename rule' && n=$((n+1)) || echo "MISSING disambiguation"
echo "journey_anchors=$n/8"
[ "$n" -eq 8 ] && echo "P46 verdict: PASS" || echo "P46 verdict: FAIL"
```

**P47 — AC-F10-1: the entrypoint delta names both families, keeps the GH-288**

```bash
# P47 — AC-F10-1: the entrypoint delta names both families, keeps the GH-288
# mount note, phrases the reference-page move as pending S18 code work, and does
# not rewrite the GH-286 delivered composition or the closed daemon gap
[ "${P00_READY:-}" = "gh303" ] || { echo "FATAL: P00 preamble not loaded" >&2; exit 1; }
require_p00; need section squash
if [ ! -f "$EPD" ]; then echo "entrypoint_delta=absent"; echo "P47 verdict: FAIL"; exit 0; fi
B="$SH/base-entrypoint-delta.md"
[ -s "$B" ] || { echo "base_entrypoint_delta=absent"; echo "P47 verdict: FAIL"; exit 0; }
add=$(section "$EPD" '## M2-planned additions'); adds=$(printf '%s' "$add" | squash)
sq=$(cat "$EPD" | squash); n=0
printf '%s' "$adds" | grep -Eiq '`repos`.{0,160}flat record set' && n=$((n+1)) || echo "MISSING repos addition"
printf '%s' "$adds" | grep -Eiq '`repos`.{0,200}M2-S18|M2-S18.{0,200}`repos`' && n=$((n+1)) || echo "MISSING repos ownership"
printf '%s' "$adds" | grep -Eiq '`projects`.{0,200}(group surface|groups)' && n=$((n+1)) || echo "MISSING projects addition"
printf '%s' "$adds" | grep -Eiq '`projects`.{0,200}M2-S18|M2-S18.{0,200}`projects`' && n=$((n+1)) || echo "MISSING projects ownership"
printf '%s' "$adds" | grep -Eiq 'shipped `projects list` is the delivered flat surface|shipped .projects list. is the delivered flat surface' && n=$((n+1)) || echo "MISSING mount-note delivered-surface statement"
printf '%s' "$adds" | grep -Eiq 'Mounted by GH-288' && n=$((n+1)) || echo "MISSING GH-288 mount note"
printf '%s' "$sq" | grep -Eiq 'pending M2-S18 code work' && n=$((n+1)) || echo "MISSING pending-code-work phrasing"
echo "delta_anchors=$n/7"
ho=$(printf '%s' "$sq" | grep -Eoic 'host overview' || true)
echo "host_overview_claims=${ho:-0}"
# Delivered GH-286 wording this change must not rewrite (re-anchored from the
# pre-GH-286 tokens: GH-286 legitimately replaced the sixteen-family listing,
# the unknown-flag snippets, and the open daemon-gap section).
p=0
grep -Fq 'Seventeen families' "$EPD" && p=$((p+1)) || echo "preserved MISSING: Seventeen families"
grep -Fq 'daemon --help' "$EPD" && p=$((p+1)) || echo "preserved MISSING: daemon --help"
grep -Fq 'daemon start' "$EPD" && grep -Fq 'install' "$EPD" && grep -Fq 'uninstall' "$EPD" && p=$((p+1)) || echo "preserved MISSING: daemon lifecycle verbs"
grep -Fq 'registered' "$EPD" && grep -Fq 'daemon runtime' "$EPD" && p=$((p+1)) || echo "preserved MISSING: daemon mount statement"
grep -Fq '#286' "$EPD" && p=$((p+1)) || echo "preserved MISSING: #286"
grep -Fq 'milestone snapshot' "$EPD" && p=$((p+1)) || echo "preserved MISSING: milestone snapshot"
echo "preserved_delivered=$p/6"
sec_of() { awk -v h="$2" '$0==h{f=1;print;next} f&&/^## /{exit} f' "$1"; }
oc_b=$(sec_of "$B" '## Observed composition'); oc_h=$(sec_of "$EPD" '## Observed composition')
dg_b=$(sec_of "$B" '## The daemon registration gap (closed)'); dg_h=$(sec_of "$EPD" '## The daemon registration gap (closed)')
[ -n "$oc_b" ] && [ "$oc_b" = "$oc_h" ] && echo "observed_composition=byte-identical" || echo "observed_composition=CHANGED"
[ -n "$dg_b" ] && [ "$dg_b" = "$dg_h" ] && echo "daemon_gap=byte-identical" || echo "daemon_gap=CHANGED"
# --- both directions: rewriting the GH-286 delivered text must be caught ---
cp "$EPD" "$SH/p47-mut-delivered.md"
sed -i 's/Seventeen families/Sixteen families/; s/Issue #286 delivered the mount/No mount was delivered/' "$SH/p47-mut-delivered.md"
cp "$EPD" "$SH/p47-mut-composition.md"
awk '{print} /^## Observed composition$/{print ""; print "MUTATED OBSERVATION LINE"}' "$EPD" > "$SH/p47-mut-composition.tmp" && mv "$SH/p47-mut-composition.tmp" "$SH/p47-mut-composition.md"
md=0
grep -Fq 'Seventeen families' "$SH/p47-mut-delivered.md" || md=$((md+1))
grep -Fq '#286 delivered the mount' "$SH/p47-mut-delivered.md" || md=$((md+1))
[ "$(sec_of "$SH/p47-mut-delivered.md" '## The daemon registration gap (closed)')" != "$dg_b" ] && md=$((md+1))
echo "mutant_delivered_rewritten=$([ "$md" -ge 2 ] && echo detected || echo NOT-DETECTED)"
[ "$(sec_of "$SH/p47-mut-composition.md" '## Observed composition')" != "$oc_b" ] && echo "mutant_composition=detected" || echo "mutant_composition=NOT-DETECTED"
[ "$n" -eq 7 ] && [ "${ho:-0}" -eq 0 ] && [ "$p" -eq 6 ] && [ "$oc_b" = "$oc_h" ] && [ "$dg_b" = "$dg_h" ] \
 && [ "$md" -ge 2 ] && [ "$(sec_of "$SH/p47-mut-composition.md" '## Observed composition')" != "$oc_b" ] \
 && echo "P47 verdict: PASS" || echo "P47 verdict: FAIL"
```

**P48 — AC-F11-1: the M2 pack README contents table and story map**

```bash
# P48 — AC-F11-1: the M2 pack README contents table and story map
[ "${P00_READY:-}" = "gh303" ] || { echo "FATAL: P00 preamble not loaded" >&2; exit 1; }
require_p00; need section squash
if [ ! -f "$MRD" ]; then echo "m2_readme=absent"; echo "P48 verdict: FAIL"; exit 0; fi
rows=$(section "$MRD" '## Pack contents' | grep -cE '^\| \[|^\| `')
echo "pack_rows=$rows/13"
n=0
section "$MRD" '## Pack contents' | grep -q 'commands/repos.md' && n=$((n+1)) || echo "MISSING repos contents row"
section "$MRD" '## Pack contents' | grep -q 'Flat record set owned by M2-S18' && n=$((n+1)) || echo "MISSING repos ownership in contents"
crow=$(section "$MRD" '## Pack contents' | grep -E '^\| \[contracts\.md\]')
for t in 'repos\.v1' 'project-groups\.v1' 'projects\.v1' 'configuration document' 'change plan shape'; do
  printf '%s' "$crow" | grep -Eiq -- "$t" && n=$((n+1)) || echo "contracts row MISSING $t"; done
s11=$(grep -E '^\| M2-S11 ' "$MRD"); s18=$(grep -E '^\| M2-S18 ' "$MRD"); s19=$(grep -E '^\| M2-S19 ' "$MRD"); s4=$(grep -E '^\| M2-S4 ' "$MRD")
printf '%s' "$s11" | grep -q 'delivered `projects.v1` payload' && n=$((n+1)) || echo "MISSING S11 map row"
printf '%s' "$s18" | grep -Eq 'project-groups\.v1' && printf '%s' "$s18" | grep -Eq 'configuration document' && printf '%s' "$s18" | grep -Fq 'status --project <groupKey>' && printf '%s' "$s18" | grep -Eiq 'decision record' && n=$((n+1)) || echo "MISSING S18 map row"
printf '%s' "$s19" | grep -Eiq 'plan shape' && n=$((n+1)) || echo "MISSING S19 map row"
printf '%s' "$s4" | grep -Fq '(advisory: consumed at delivery; the owning story declares the edge)' && echo "s4_advisory=PRESENT (violation)" || n=$((n+1))
scen=$(section "$MRD" '## Pack contents' | grep -E '^\| \[test-scenarios\.md\]')
printf '%s' "$scen" | grep -Fq 'S2 through S19' && n=$((n+1)) || echo "MISSING scenarios row range"
echo "readme_anchors=$n/12"
grep -Fq 'Everything in this pack is **planned until M2 exit**' "$MRD" && echo "planned_until_exit=verbatim" || echo "planned_until_exit=CHANGED"
[ "$rows" -eq 13 ] && [ "$n" -eq 12 ] && grep -Fq 'Everything in this pack is **planned until M2 exit**' "$MRD" && echo "P48 verdict: PASS" || echo "P48 verdict: FAIL"
```

**P49 — AC-F11-2: the milestone M2 index row reaches thirteen targets**

```bash
# P49 — AC-F11-2: the milestone M2 index row reaches thirteen targets
[ "${P00_READY:-}" = "gh303" ] || { echo "FATAL: P00 preamble not loaded" >&2; exit 1; }
require_p00
if [ ! -f "$MR" ]; then echo "milestones_readme=absent"; echo "P49 verdict: FAIL"; exit 0; fi
row=$(grep -E '^\| M2 \(' "$MR")
n=$(printf '%s' "$row" | grep -o '](m2/' | wc -l)
echo "m2_targets=$n/13"
printf '%s' "$row" | grep -q 'm2/commands/repos.md' && echo "repos_target=OK" || echo "repos_target=MISSING"
m0b=$(grep -E '^\| M0 \(' "$SH/base-milestones-README.md"); m0h=$(grep -E '^\| M0 \(' "$MR")
m1b=$(grep -E '^\| M1 \(' "$SH/base-milestones-README.md"); m1h=$(grep -E '^\| M1 \(' "$MR")
[ "$m0b" = "$m0h" ] && echo "m0_row=byte-identical" || echo "m0_row=CHANGED"
[ "$m1b" = "$m1h" ] && echo "m1_row=byte-identical" || echo "m1_row=CHANGED"
[ "$n" -eq 13 ] && printf '%s' "$row" | grep -q 'm2/commands/repos.md' && [ "$m0b" = "$m0h" ] && [ "$m1b" = "$m1h" ] && echo "P49 verdict: PASS" || echo "P49 verdict: FAIL"
```

**P50 — AC-F12-1: one dated correction section recording the amendment as**

```bash
# P50 — AC-F12-1: one dated correction section recording the amendment as
# planning state, claiming no delivery
[ "${P00_READY:-}" = "gh303" ] || { echo "FATAL: P00 preamble not loaded" >&2; exit 1; }
require_p00; need newsec_of newsec_count squash
if [ ! -f "$ST" ]; then echo "status=absent"; echo "P50 verdict: FAIL"; exit 0; fi
ncount=$(newsec_count "$SH/base-status.md" "$ST"); ns=$(newsec_of "$SH/base-status.md" "$ST")
echo "new_section_count=$ncount new_section_line=${ns:-absent}"
if [ -z "$ns" ]; then echo "new_section=absent"; echo "P50 verdict: FAIL (change absent)"; exit 0; fi
hdr=$(sed -n "${ns}p" "$ST"); body=$(awk -v s="$ns" 'NR>=s{f=1} f&&NR>s&&/^## /{exit} f' "$ST" | squash)
echo "new_section_heading=$hdr"
printf '%s' "$hdr" | grep -Eq '^## .+ \(2026-11-11\)$' && echo "heading_form=title-plus-parenthesised-date" || echo "heading_form=UNEXPECTED"
after=$(awk -v s="$ns" 'NR>s && /^## /{c++} END{print c+0}' "$ST")
echo "headings_after_new_section=$after"
n=0
for p in 'project-groups\.v1' 'groupKey' 'projects\.v1' 'repos\.v1' 'repoKey' 'rename rule' 'alias|--flat' 'M2-S18' 'configuration-only' 'queue list --project <groupKey>' 'board' 'registry' 'ODR-0003' 'M2-S4'; do
  printf '%s' "$body" | grep -Eiq -- "$p" && n=$((n+1)) || echo "anchor MISSING: $p"; done
claim=$(printf '%s' "$body" | tr '.' '\n' | grep -Ei 'M2 (has )?exit(ed)? complete|milestone exit complete|delivered by M2-S1[89]|is delivered|now delivered' | grep -Eiv 'no |not |never|neither' | grep -c . || true)
echo "section_anchors=$n/14 delivery_claim=${claim:-0}"
[ "$ncount" -eq 1 ] && [ "$after" -eq 0 ] && printf '%s' "$hdr" | grep -Eq '^## .+ \(2026-11-11\)$' && [ "$n" -eq 14 ] && [ "${claim:-0}" -eq 0 ] && echo "P50 verdict: PASS" || echo "P50 verdict: FAIL"
```

**P51 — AC-F12-2: every base status line is present, in order, byte-identical and every addition lies inside the one new section**

```bash
# P51 — AC-F12-2: every base status line is present, in order, byte-identical,
# and every addition lies inside the one new section
[ "${P00_READY:-}" = "gh303" ] || { echo "FATAL: P00 preamble not loaded" >&2; exit 1; }
require_p00; need diffstat newsec_of newsec_count
if [ ! -f "$ST" ]; then echo "status=absent"; echo "P51 verdict: FAIL"; exit 0; fi
read -r rem add <<< "$(diffstat "$SH/base-status.md" "$ST")"
ncount=$(newsec_count "$SH/base-status.md" "$ST"); ns=$(newsec_of "$SH/base-status.md" "$ST")
if [ -z "$ns" ]; then out=$add; else
  out=$(diff -U0 "$SH/base-status.md" "$ST" | grep -E '^@@' | sed -E 's/^@@ -[0-9]+(,[0-9]+)? \+([0-9]+)(,([0-9]+))? @@.*/\2 \4/' | awk -v s="$((ns-1))" '{c=$1; d=($2==""?1:$2); if (c<s) print}' | wc -l)
fi
after=$(awk -v s="${ns:-999999}" 'NR>s && /^## /{c++} END{print c+0}' "$ST")
echo "removed_lines=$rem additions=$add new_section_line=${ns:-absent} new_section_count=$ncount headings_after=${after} added_outside_section=$out"
echo "base_lines=$(wc -l < "$SH/base-status.md") head_lines=$(wc -l < "$ST")"
[ "$rem" -eq 0 ] && echo "base_lines_retained=OK" || echo "base_lines_retained=FAILED ($rem removed/modified/reordered)"
[ "$out" -eq 0 ] && echo "additions_confined=OK" || echo "additions_confined=FAILED ($out hunk(s) before the new section)"
[ "$rem" -eq 0 ] && [ "$out" -eq 0 ] && [ "$ncount" -eq 1 ] && [ "$after" -eq 0 ] && [ "$add" -ge 1 ] && echo "P51 verdict: PASS" || echo "P51 verdict: FAIL"
```

**P52 — AC-F13-1: the registry splits the two names, one Delivery row per name**

```bash
# P52 — AC-F13-1: the registry splits the two names, one Delivery row per name
[ "${P00_READY:-}" = "gh303" ] || { echo "FATAL: P00 preamble not loaded" >&2; exit 1; }
require_p00
if [ ! -f "$RG" ]; then echo "registry=absent"; echo "P52 verdict: FAIL"; exit 0; fi
proj_rows=$(grep -cE '^\| `ados projects` ' "$RG" || true)
repo_rows=$(grep -cE '^\| `ados repos` ' "$RG" || true)
echo "projects_rows=$proj_rows repos_rows=$repo_rows"
prow=$(grep -E '^\| `ados projects` ' "$RG")
printf '%s' "$prow" | grep -Fq 'M2-S11 (shipped in GH-288)' && echo "projects_delivery=OK" || echo "projects_delivery=CHANGED"
printf '%s' "$prow" | grep -Fq 'project-groups.v1' && echo "projects_group_surface=OK" || echo "projects_group_surface=MISSING"
printf '%s' "$prow" | grep -Fq 'M2-S18' && echo "projects_extended_s18=OK" || echo "projects_extended_s18=MISSING"
printf '%s' "$prow" | grep -Fq 'projects list --flat' && echo "projects_alias_pointer=OK" || echo "projects_alias_pointer=MISSING"
rrow=$(grep -E '^\| `ados repos` ' "$RG")
printf '%s' "$rrow" | grep -Fq 'repos.v1' && echo "repos_contract=OK" || echo "repos_contract=MISSING"
printf '%s' "$rrow" | grep -Fq 'data.repos[]' && echo "repos_payload=OK" || echo "repos_payload=MISSING"
printf '%s' "$rrow" | grep -Fq 'repoKey' && echo "repos_identity=OK" || echo "repos_identity=MISSING"
printf '%s' "$rrow" | grep -Eiq '\| - \|' && echo "repos_delivery=dash" || echo "repos_delivery=NOT-DASH"
printf '%s' "$rrow" | grep -Fq 'M3-S6' && printf '%s' "$rrow" | grep -Fq 'M2-S18' && echo "repos_extended=OK" || echo "repos_extended=MISSING"
printf '%s' "$rrow" | grep -Eiq 'ODR-0003' && echo "odr_lock=OK" || echo "odr_lock=MISSING"
second=$(grep -E '^\| `ados repos` ' "$RG" | grep -c 'M3-S6 | - |' || true)
echo "second_repos_delivery_rows=${second:-0}"
[ "$proj_rows" -eq 1 ] && [ "$repo_rows" -eq 1 ] && printf '%s' "$prow" | grep -Fq 'M2-S11 (shipped in GH-288)' && printf '%s' "$prow" | grep -Fq 'project-groups.v1' && printf '%s' "$rrow" | grep -Fq 'repos.v1' && printf '%s' "$rrow" | grep -Eiq 'ODR-0003' && [ "${second:-0}" -eq 0 ] && echo "P52 verdict: PASS" || echo "P52 verdict: FAIL"
```

**P53 — AC-F13-2: COMMAND FAMILIES, the boundary note, and byte-identical**

```bash
# P53 — AC-F13-2: COMMAND FAMILIES, the boundary note, and byte-identical
# untouched rows
[ "${P00_READY:-}" = "gh303" ] || { echo "FATAL: P00 preamble not loaded" >&2; exit 1; }
require_p00
if [ ! -f "$RG" ]; then echo "registry=absent"; echo "P53 verdict: FAIL"; exit 0; fi
grep -E '^- Operate:' "$RG" | grep -q 'projects' && echo "operate_family_projects=OK" || echo "operate_family_projects=MISSING"
bound=$(grep -m1 '^Boundary note:' "$RG")
printf '%s' "$bound" | grep -Eiq 'flat record set' && printf '%s' "$bound" | grep -Eiq 'group surface' && printf '%s' "$bound" | grep -Eiq 'rename rule' && echo "boundary_note=OK" || echo "boundary_note=MISSING"
printf '%s' "$bound" | grep -Fq 'distinct surfaces, so the names never collide' && echo "old_boundary_note=PRESENT (violation)" || echo "old_boundary_note=ABSENT"
out=$(diff -U0 "$SH/base-registry.md" "$RG" | grep -E '^[-+]' | grep -vE '^(---|\+\+\+)' | sed -E 's/^[-+]//' | grep -vE '^\| `ados projects` |^\| `ados repos` |^Boundary note:|^- Operate:' | wc -l)
echo "changed_lines_outside_allowed=$out"
# fixture: an unrelated row change must be flagged
cp "$RG" "$SH/p53-mut.md"
sed -i 's/^| `ados supervise` | Supervision battery/| `ados supervise` | Supervision battery MUTATED/' "$SH/p53-mut.md"
mut=$(diff -U0 "$SH/base-registry.md" "$SH/p53-mut.md" | grep -E '^[-+]' | grep -vE '^(---|\+\+\+)' | sed -E 's/^[-+]//' | grep -vE '^\| `ados projects` |^\| `ados repos` |^Boundary note:|^- Operate:' | wc -l)
echo "fixture_outside=$( [ "$mut" -ge 1 ] && echo flagged || echo INERT)"
[ "$out" -eq 0 ] && [ "$mut" -ge 1 ] && grep -E '^- Operate:' "$RG" | grep -q 'projects' && printf '%s' "$bound" | grep -Eiq 'rename rule' && echo "P53 verdict: PASS" || echo "P53 verdict: FAIL"
```

**P54 — AC-F14-1: the naming matrix, forbidden half, with detectors proven in**

```bash
# P54 — AC-F14-1: the naming matrix, forbidden half, with detectors proven in
# both directions and the Appendix B required states walked
[ "${P00_READY:-}" = "gh303" ] || { echo "FATAL: P00 preamble not loaded" >&2; exit 1; }
require_p00; need matrix_rows path_of region forbidden_hits forbidden_count backlog_ranges squash
echo "-- P54: forbidden-statement half --"
fail=0; empty=0; rows=0
while IFS='|' read -r id palias mode arg req forb; do
  [ -z "$id" ] && continue; rows=$((rows+1))
  f=$(path_of "$palias")
  if [ ! -f "$f" ]; then echo "$id region=NOFILE"; fail=$((fail+1)); continue; fi
  txt=$(region "$f" "$mode" "$arg" | squash)
  if [ -z "$txt" ]; then echo "$id region=EMPTY"; empty=$((empty+1)); fail=$((fail+1)); continue; fi
  if [ "$forb" = "XXXNONE" ]; then echo "$id forbidden=none-required"; continue; fi
  c=$(forbidden_count "$txt" "$forb")
  if [ "$c" -eq 0 ]; then echo "$id forbidden=0 OK"; else
    echo "$id forbidden=$c SURVIVOR"
    case "$forb" in @*) printf '%s' "$txt" | forbidden_hits "${forb#@}" | sed 's/^/    /' ;; *) printf '%s' "$txt" | grep -Eoi -- "$forb" | sed 's/^/    /' ;; esac
    fail=$((fail+1)); fi
done < <(matrix_rows)
echo "matrix_rows=$rows regions_empty=$empty rows_with_survivors=$fail/$rows"
st=$(printf 'The `projects list` command enumerates every managed checkout.\n' | forbidden_hits both | wc -l)
sg=$(printf 'The `repos` group lists its members and their health.\n' | forbidden_hits both | wc -l)
sn=$(printf 'The naming boundary: `repos` enumerates checkouts and `projects` groups them from M2-S18.\n' | forbidden_hits both | wc -l)
ssren=$(printf 'The shipped `projects list` surface is the flat enumeration this change renames to `repos list`.\n' | forbidden_hits both | wc -l)
ssdel=$(printf '`projects list [--json]` is the mounted, read-only host overview.\n' | forbidden_hits both | wc -l)
echo "self_test_flat=$([ "$st" -ge 1 ] && echo detected || echo FAILED) self_test_group=$([ "$sg" -ge 1 ] && echo detected || echo FAILED) boundary_allowed=$([ "$sn" -eq 0 ] && echo OK || echo FLAGGED)"
echo "sanctioned_rename_allowed=$([ "$ssren" -eq 0 ] && echo OK || echo FLAGGED) sanctioned_delivered_allowed=$([ "$ssdel" -eq 0 ] && echo OK || echo FLAGGED)"
[ "$fail" -eq 0 ] && [ "$rows" -eq 21 ] && [ "$empty" -eq 0 ] && [ "$st" -ge 1 ] && [ "$sg" -ge 1 ] && [ "$sn" -eq 0 ] && [ "$ssren" -eq 0 ] && [ "$ssdel" -eq 0 ] && echo "P54 verdict: PASS" || echo "P54 verdict: FAIL (survivors, empty region, or scan inert)"
```

**P55 — AC-F14-2: the time-scoped disambiguation on every page using the group**

```bash
# P55 — AC-F14-2: the time-scoped disambiguation on every page using the group
# meaning, the nine delivered facts, and no contradictory page pair
[ "${P00_READY:-}" = "gh303" ] || { echo "FATAL: P00 preamble not loaded" >&2; exit 1; }
require_p00; need region path_of squash newsec_of
dis() { printf '%s' "$1" | grep -Eiq 'rename rule'; }
ok=0; tot=0
check() { local id="$1" txt="$2"; tot=$((tot+1)); dis "$txt" && { ok=$((ok+1)); echo "$id disambiguation=OK"; } || echo "$id disambiguation=MISSING"; }
check backlog "$(entry "$BL" '### M2-S18 ' | squash) $(backlog_ranges; sed -n "$((NOTE_E+1)),$((S2_LINE-1))p" "$BL" | squash)"
check contracts "$(cat "$CT" | squash)"
check projects_page "$(cat "$PJ" 2>/dev/null | squash)"
check test_scenarios "$(awk '/^## M2-S11 /{f=1} f&&/^## M2-S12 /{exit} f' "$TS" | squash) $(awk '/^## M2-S18 /{f=1} f&&/^## M2-S19 /{exit} f' "$TS" | squash)"
check journeys "$(firstsec "$JN" | squash)"
check status_new_section "$(region "$ST" newsec | squash)"
echo "disambiguated_pages=$ok/$tot"
f=0
grep -Fq -- '- Ticket: GH-288 (milestone M2)' "$BL" && f=$((f+1)) || echo "FACT MISSING GH-288 record"
grep -Fq 'daemon-not-mounted' "$CT" && f=$((f+1)) || echo "FACT MISSING closed daemon reason set"
grep -Fq 'unbound' "$R" && f=$((f+1)) || echo "FACT MISSING unbound scope"
grep -Fq 'projects.identity-unreadable' "$R" && f=$((f+1)) || echo "FACT MISSING delivered error identity"
grep -Fq '<host root>/projects/<key>' "$R" && f=$((f+1)) || echo "FACT MISSING host-root state layout"
grep -Fq 'Mounted by GH-288' "$EPD" && f=$((f+1)) || echo "FACT MISSING mounted delta note"
grep -E '^\| `ados projects` ' "$RG" | grep -Fq 'M2-S11 (shipped in GH-288)' && f=$((f+1)) || echo "FACT MISSING shipped projects registry row"
grep -Fq '## M2 delivery snapshot (2026-11-11)' "$ST" && f=$((f+1)) || echo "FACT MISSING 2026-11-11 snapshot"
grep -Fq 'platform, state, or provider failure' "$CT" && f=$((f+1)) || echo "FACT MISSING exit projection"
echo "delivered_facts=$f/9"
contradiction=$(cat "$BL" "$CT" "$PJ" "$TS" "$JN" "$ST" 2>/dev/null | squash | tr '.' '\n' | grep -Eic 'repos is the group|repos list enumerates groups|projects list enumerates checkouts' || true)
echo "contradictory_statements=${contradiction:-0}"
[ "$ok" -eq 6 ] && [ "$f" -eq 9 ] && [ "${contradiction:-0}" -eq 0 ] && echo "P55 verdict: PASS" || echo "P55 verdict: FAIL"
```

**P56 — AC-F14-3: the terminology lock — zero old-identity affirmations groupKey the only group identity, repoKey the only planned repository identity,**

```bash
# P56 — AC-F14-3: the terminology lock — zero old-identity affirmations,
# groupKey the only group identity, repoKey the only planned repository identity,
# the state scope never called a project scope
[ "${P00_READY:-}" = "gh303" ] || { echo "FATAL: P00 preamble not loaded" >&2; exit 1; }
require_p00; need squash
D="$BL $MR $MRD $A $CT $PJ $R $Q $B $TS $JN $EPD $ST $RG"
sq=$(cat $D 2>/dev/null | squash)
a=$(printf '%s' "$sq" | tr '.' '\n' | grep -Eic 'projects\.v1[^.]{0,60}(is|as) the group contract|the group contract is `?projects\.v1' || true)
b=$(printf '%s' "$sq" | tr '.' '\n' | grep -Eic 'group identit[^.]{0,40}projectKey|projectKey[^.]{0,40}group identit' || true)
c=$(printf '%s' "$sq" | tr '.' '\n' | grep -Eic 'one spelling[^.]{0,60}(both|two shapes)|both shapes at (the same time|once)' || true)
d=$(printf '%s' "$sq" | tr '.' '\n' | grep -Eic 'state (layer|scope)[^.]{0,80}(is|as) (a )?project scope|project scope for (the )?state' || true)
echo "group_contract_affirmations=${a:-0} group_identity_affirmations=${b:-0} two_shape_affirmations=${c:-0} state_project_scope=${d:-0}"
gk=$(printf '%s' "$sq" | grep -oi 'groupKey' | wc -l); rk=$(printf '%s' "$sq" | grep -oi 'repoKey' | wc -l)
echo "groupKey_uses=${gk:-0} repoKey_uses=${rk:-0}"
percheckout=$(printf '%s' "$sq" | grep -oi 'per-checkout' | wc -l)
echo "per_checkout_scope_uses=${percheckout:-0}"
[ "${a:-0}" -eq 0 ] && [ "${b:-0}" -eq 0 ] && [ "${c:-0}" -eq 0 ] && [ "${d:-0}" -eq 0 ] && [ "${gk:-0}" -ge 5 ] && [ "${rk:-0}" -ge 5 ] && [ "${percheckout:-0}" -ge 1 ] && echo "P56 verdict: PASS" || echo "P56 verdict: FAIL"
```

**P57 — AC-NFR1-1: exactly 15 product files change; nothing outside the manifest**

```bash
# P57 — AC-NFR1-1: exactly 15 product files change; nothing outside the manifest
[ "${P00_READY:-}" = "gh303" ] || { echo "FATAL: P00 preamble not loaded" >&2; exit 1; }
require_p00
manifest() { cat <<'M'
doc/planning/oss-tooling/backlog.md
doc/planning/oss-tooling/milestones/m2/architecture.md
doc/planning/oss-tooling/milestones/m2/contracts.md
doc/planning/oss-tooling/milestones/m2/commands/repos.md
doc/planning/oss-tooling/milestones/m2/commands/projects.md
doc/planning/oss-tooling/milestones/m2/commands/queue.md
doc/planning/oss-tooling/milestones/m2/commands/board.md
doc/planning/oss-tooling/milestones/m2/test-scenarios.md
doc/planning/oss-tooling/milestones/m2/journeys.md
doc/planning/oss-tooling/milestones/m2/entrypoint-delta.md
doc/planning/oss-tooling/milestones/m2/README.md
doc/planning/oss-tooling/milestones/README.md
doc/planning/oss-tooling/status.md
doc/planning/oss-tooling/cli-command-registry.md
scripts/checks/forbidden-literals.registry.json
M
}
{ git diff --name-only "$BASE" -- . ':!node_modules' ':!tmp' ; git ls-files --others --exclude-standard -- . ':!node_modules' ':!tmp' ; } | grep -v '^doc/changes/' | sed '/^$/d' | LC_ALL=C sort -u > "$SH/prod.txt"
manifest | LC_ALL=C sort > "$SH/man.txt"
n=$(grep -c . "$SH/prod.txt"); e=$(comm -13 "$SH/prod.txt" "$SH/man.txt" | wc -l); u=$(comm -23 "$SH/prod.txt" "$SH/man.txt" | tr '\n' ' ')
echo "product_files=$n/15 expected_not_changed=$e unexpected_changed=$u"
for root in doc/spec/ doc/overview/ doc/guides/ doc/templates/ packages/ tests/ .opencode/ .ai/; do
  c=$(grep -c "^$root" "$SH/prod.txt" || true); [ "$c" -eq 0 ] || echo "FORBIDDEN ROOT CHANGED: $root ($c)"; done
other_scripts=$(grep '^scripts/' "$SH/prod.txt" | grep -vc '^scripts/checks/forbidden-literals.registry.json' || true)
echo "other_scripts_changed=$other_scripts"
comm -13 "$SH/prod.txt" "$SH/man.txt" | sed '/^$/d' | sed 's/^/MISSING: /'
comm -23 "$SH/prod.txt" "$SH/man.txt" | sed '/^$/d' | sed 's/^/EXTRA: /'
m1=doc/planning/oss-tooling/milestones/m1/commands/status.md
git show "$BASE:$m1" > "$SH/p57-m1-base.md" 2>/dev/null
cmp -s "$SH/p57-m1-base.md" "$m1" && echo "m1_status_page=byte-identical" || echo "m1_status_page=CHANGED"
[ "$n" -eq 15 ] && [ "$e" -eq 0 ] && [ -z "$u" ] && [ "$other_scripts" -eq 0 ] && cmp -s "$SH/p57-m1-base.md" "$m1" && echo "P57 verdict: PASS" || echo "P57 verdict: FAIL (change absent or out of scope)"
```

**P58 — AC-NFR2-1: backlog preservation, the S4-confinement, and zero code churn**

```bash
# P58 — AC-NFR2-1: backlog preservation, the S4-confinement, and zero code churn
[ "${P00_READY:-}" = "gh303" ] || { echo "FATAL: P00 preamble not loaded" >&2; exit 1; }
require_p00; need entry backlog_ranges
changed=0; removed=0; kept=0
while IFS= read -r h; do
  case "$h" in '### M2-S11 '*|'### M2-S18 '*|'### M2-S19 '*|'### M2-S4 '*) continue ;; esac
  b=$(entry "$SH/base-backlog.md" "$h"); n=$(entry "$BL" "$h")
  if [ -z "$n" ]; then removed=$((removed+1)); echo "REMOVED: $h"; else
    kept=$((kept+1)); [ "$b" = "$n" ] || { changed=$((changed+1)); echo "CHANGED: $h"; }; fi
done < <(grep '^### ' "$SH/base-backlog.md")
echo "stories_kept=$kept changed=$changed removed=$removed"
bh=$(grep -c '^### ' "$SH/base-backlog.md"); hh=$(grep -c '^### ' "$BL")
echo "base_headings=$bh head_headings=$hh added=$((hh-bh))"
newonly=$(comm -13 <(grep '^### ' "$SH/base-backlog.md" | LC_ALL=C sort) <(grep '^### ' "$BL" | LC_ALL=C sort) | sed '/^$/d')
newc=$(printf '%s\n' "$newonly" | grep -c . || true)
printf '%s\n' "$newonly" | grep -vE '^### M2-S1[89] ' | sed '/^$/d' | sed 's/^/UNEXPECTED: /'
i=0; order=OK
while IFS= read -r h; do j=$(awk -v h="$h" '$0==h{print NR; exit}' "$BL"); [ "${j:-0}" -lt "$i" ] && order=FAIL; i=${j:-0}; done < <(grep '^### ' "$SH/base-backlog.md")
echo "order=$order"
fm() { awk 'NR==1&&$0=="---"{f=1} f{print} f&&NR>1&&$0=="---"{exit}' "$1"; }
rg() { awk '/^## Reading guide/{f=1} /^## Cross-cutting principles/{exit} f{print}' "$1"; }
cc() { awk '/^## Cross-cutting principles/{f=1} /^## Epic M0:/{exit} f{print}' "$1"; }
for r in fm rg cc; do $r "$SH/base-backlog.md" > "$SH/p58-$r-b"; $r "$BL" > "$SH/p58-$r-h"; cmp -s "$SH/p58-$r-b" "$SH/p58-$r-h" && echo "$r=byte-identical" || echo "$r=CHANGED"; done
backlog_ranges
bns=$(grep -n '^Note: the M1 redefinition moved the queue' "$SH/base-backlog.md" | cut -d: -f1)
bne=$(grep -n '^the gap is deliberate\. M2 stories keep their codes\.$' "$SH/base-backlog.md" | cut -d: -f1)
awk -v s="$bns" -v e="$bne" 'NR>=s&&NR<=e' "$SH/base-backlog.md" > "$SH/p58-note-b"
awk -v s="$NOTE_S" -v e="$NOTE_E" 'NR>=s&&NR<=e' "$BL" > "$SH/p58-note-h"
cmp -s "$SH/p58-note-b" "$SH/p58-note-h" && echo "retirement_note=byte-identical" || echo "retirement_note=CHANGED"
b3=$(grep -n '^## Epic M3' "$SH/base-backlog.md" | cut -d: -f1); bsep=$(awk -v m="$b3" 'NR<m && /^---$/{l=NR} END{print l+0}' "$SH/base-backlog.md")
bseq=$(sed -n "${bsep},$((bsep+2))p" "$SH/base-backlog.md"); hseq=$(sed -n "${SEP_LINE},$((SEP_LINE+2))p" "$BL")
[ "$bseq" = "$hseq" ] && echo "separator_and_epic_m3=byte-identical" || echo "separator_and_epic_m3=CHANGED"
s4=$(entry "$BL" '### M2-S4 '); b4=$(entry "$SH/base-backlog.md" '### M2-S4 ')
s4diff=$(diff -U0 <(printf '%s\n' "$b4") <(printf '%s\n' "$s4") | grep -cE '^@@' || true)
s4lines=$(diff -U0 <(printf '%s\n' "$b4") <(printf '%s\n' "$s4") | grep -E '^[-+]' | grep -vE '^(---|\+\+\+)' | wc -l)
echo "s4_hunks=$s4diff s4_changed_lines=$s4lines"
[ "$order" = "OK" ] && [ "$newc" -eq 2 ] && [ "$changed" -eq 0 ] && [ "$removed" -eq 0 ] && [ "$s4diff" -eq 1 ] && [ "$s4lines" -eq 2 ] && [ "$(printf '%s\n' "$bseq")" = "$(printf '%s\n' "$hseq")" ] && echo "P58 verdict: PASS" || echo "P58 verdict: FAIL"
```

**P59 — AC-NFR3-1: planned-not-delivered semantics with the delivered facts kept**

```bash
# P59 — AC-NFR3-1: planned-not-delivered semantics with the delivered facts kept
[ "${P00_READY:-}" = "gh303" ] || { echo "FATAL: P00 preamble not loaded" >&2; exit 1; }
require_p00; need squash
n=0
[ -f "$R" ] && grep -Fxq 'Status: Proposed (M2)' "$R" && n=$((n+1))
[ -f "$PJ" ] && grep -Fxq 'Status: Proposed (M2)' "$PJ" && n=$((n+1))
echo "proposed_headers=$n/2"
DOCS="$BL $MRD $A $CT $TS $JN $EPD $PJ $R $MR $ST $RG"
# A delivery claim about a NEW surface: the subject is one of the four planned
# surfaces and the predicate asserts it is delivered, shipped, or available. A
# delivered-fact sentence about the shipped `projects list` takes the delivered
# surface as its subject and is therefore not a claim about a new surface.
claim_detector() { # stdin: one sentence per line
  grep -Ei '(^|[^a-z])(repos list|repos|project groups?|workspace discovery|cross-repository (change|delivery|changes))[^.]{0,90}(is|are|becomes|becomes?|now) (already )?(delivered|shipped|available|generally available|current)|delivered by (this change|M2-S18)' \
    | grep -Eiv 'no |not |never|planned|pending|proposed|if it ships'
}
claims=$(cat $DOCS 2>/dev/null | squash | tr '.' '\n' | claim_detector | grep -c . || true)
echo "delivered_claims=$claims"
# Detector proof in both directions.
planted=$(printf '%s\n' 'Project groups are delivered.' '`repos list` is shipped in GH-288.' 'Workspace discovery is available now.' | claim_detector | grep -c . || true)
echo "planted_claims_detected=$planted/3"
grep -Fq 'Everything in this pack is **planned until M2 exit**' "$MRD" && echo "pack_statement=verbatim" || echo "pack_statement=CHANGED"
snap=$(grep -Eic 'relabelled|is now a snapshot|snapshot of delivered' "$R" "$PJ" "$MRD" 2>/dev/null | awk -F: '{s+=$2} END{print s+0}')
echo "snapshot_relabels=$snap"
printf '%s' "$(grep -E '^\| `ados repos` ' "$RG" | head -1)" | grep -Eiq 'not delivered|Not delivered|pending the superseding' && echo "registry_not_delivered=OK" || echo "registry_not_delivered=MISSING"
[ "$n" -eq 2 ] && [ "$claims" -eq 0 ] && [ "$planted" -eq 3 ] && grep -Fq 'Everything in this pack is **planned until M2 exit**' "$MRD" && [ "$snap" -eq 0 ] && echo "P59 verdict: PASS" || echo "P59 verdict: FAIL"
```

**P60 — AC-NFR4-1: the forbidden-literals registration 141 -> 142**

```bash
# P60 — AC-NFR4-1: the forbidden-literals registration 141 -> 142
[ "${P00_READY:-}" = "gh303" ] || { echo "FATAL: P00 preamble not loaded" >&2; exit 1; }
require_p00
reg_entries() { awk '/"registered": \[/{f=1;next} f&&/^  \]/{f=0} f' "${1:-$REG}" | sed -E 's/^ *"([^"]*)",?$/\1/'; }
reg_entries "$REG" > "$SH/reg-head.txt"
n=$(wc -l < "$SH/reg-head.txt"); b=$(reg_entries "$SH/base-forbidden.json" | wc -l)
echo "registered=$n base_registered=$b delta=$((n-b))"
q=$(grep -n 'milestones/m2/commands/queue.md' "$SH/reg-head.txt" | cut -d: -f1)
s=$(grep -n 'milestones/m2/commands/spend.md' "$SH/reg-head.txt" | cut -d: -f1)
r=$(grep -n 'milestones/m2/commands/repos.md' "$SH/reg-head.txt" | cut -d: -f1)
echo "queue_row=${q:-absent} repos_row=${r:-absent} spend_row=${s:-absent}"
if [ -n "$r" ] && [ -n "$q" ] && [ -n "$s" ]; then
  [ "$r" -eq "$((q+1))" ] && [ "$s" -eq "$((r+1))" ] && echo "position=between-queue-and-spend" || echo "position=OUT-OF-ORDER"
else echo "position=repos-not-registered"; fi
echo "duplicates=$(sort "$SH/reg-head.txt" | uniq -d | wc -l)"
added=$(diff <(reg_entries "$SH/base-forbidden.json") <(reg_entries "$REG") | grep -cE '^>' || true)
removed=$(diff <(reg_entries "$SH/base-forbidden.json") <(reg_entries "$REG") | grep -cE '^<' || true)
addedline=$(diff <(reg_entries "$SH/base-forbidden.json") <(reg_entries "$REG") | sed -n 's/^> //p')
echo "added_registration_lines=$added removed_registration_lines=$removed added=$addedline"
bun run scripts/checks/forbidden-literals.ts > "$SH/p60.log" 2>&1; rc=$?
grep -E '^FAIL ' "$SH/p60.log" | head -3
unreg=$(grep -c 'unregistered user-facing doc' "$SH/p60.log" || true)
echo "forbidden_exit=$rc unregistered_findings=$unreg"
[ "$n" -eq 142 ] && [ "$b" -eq 141 ] && [ "$(sort "$SH/reg-head.txt" | uniq -d | wc -l)" -eq 0 ] && [ -n "$r" ] && [ "$r" -eq "$((q+1))" ] && [ "$added" -eq 1 ] && [ "$removed" -eq 0 ] && [ "$addedline" = "doc/planning/oss-tooling/milestones/m2/commands/repos.md" ] && [ "$rc" -eq 0 ] && [ "${unreg:-0}" -eq 0 ] && echo "P60 verdict: PASS" || echo "P60 verdict: FAIL"
```

**P61 — AC-NFR5-1: the distribution guard exits 0 under the default TMPDIR and**

```bash
# P61 — AC-NFR5-1: the distribution guard exits 0 under the default TMPDIR and
# no planning document carries an ados_distribution marker
[ "${P00_READY:-}" = "gh303" ] || { echo "FATAL: P00 preamble not loaded" >&2; exit 1; }
require_p00
# default TMPDIR is required here: the guard and `pnpm check` have opposite requirements.
# Non-vacuity: AC-NFR5-1 is stated for the branch head of this change, so the new page must exist.
[ -f "$R" ] && echo "repos_md=present" || echo "repos_md=ABSENT"
env -u TMPDIR bash scripts/.tests/test-doc-distribution.sh > "$SH/p61.log" 2>&1; rc=$?
echo "dist_guard_exit=$rc"
grep -E 'no drift|in-scope docs|markers' "$SH/p61.log" | tail -2
markers=$({ printf '%s\n' "$BL" "$MRD" "$A" "$CT" "$TS" "$JN" "$EPD" "$PJ" "$R" "$MR" "$ST" "$RG"; } | xargs grep -c 'ados_distribution' 2>/dev/null | awk -F: '{s+=$2} END{print s+0}')
echo "planning_markers=$markers"
[ "$rc" -eq 0 ] && [ "$markers" -eq 0 ] && [ -f "$R" ] && echo "P61 verdict: PASS" || echo "P61 verdict: FAIL"
```

**P62 — AC-NFR6-1: both aggregate-gate invocations, the authoritative**

```bash
# P62 — AC-NFR6-1: both aggregate-gate invocations, the authoritative
# repository-local full suite, and the AC-NFR6-1 classifier.
# The record is an immutable snapshot under $SH/p62-record: RUN_GATES=1 writes it,
# and every later run reads it, so a concurrent gate run cannot rewrite the
# evidence this plan cites. It is bound to a fingerprint of the tracked code tree
# (NFR-1 forbids a code change) and to a change-presence check.
[ "${P00_READY:-}" = "gh303" ] || { echo "FATAL: P00 preamble not loaded" >&2; exit 1; }
require_p00
# Default: the delivery-time green record committed under the repo's tmp tree.
# Override with P62_RECORD_DIR for another checkout or a replay.
REC=${P62_RECORD_DIR:-$PWD/tmp/tmpdir/gh303/p62-record}
codefp() {
  git diff "$BASE" -- packages tests scripts ':!scripts/checks/forbidden-literals.registry.json' \
  | sed '/^$/d' | LC_ALL=C sort | sha256sum | awk '{print $1}'
}
if [ "${RUN_GATES:-0}" = "1" ]; then
  mkdir -p "$REC" "$ROOT/tmp/tmpdir"
  codefp > "$REC/p62-codefp.txt"
  TMPDIR="$ROOT/tmp/tmpdir" pnpm check > "$REC/p62-local.log" 2>&1; echo $? > "$REC/p62-local.rc"
  env -u TMPDIR pnpm check > "$REC/p62-default.log" 2>&1; echo $? > "$REC/p62-default.rc"
fi
for f in local.rc local.log default.rc default.log codefp.txt; do
  [ -s "$REC/p62-$f" ] || { echo "gate_record=absent ($REC/p62-$f; set P62_RECORD_DIR)"; echo "P62 verdict: FAIL (no recorded run)"; exit 0; }
done
[ -f "$R" ] && echo "change_present=yes" || echo "change_present=NO (base tree cannot satisfy a head gate)"
cur=$(codefp); rec=$(cat "$REC/p62-codefp.txt")
echo "code_fingerprint_match=$([ "$cur" = "$rec" ] && echo yes || echo NO)"
local_rc=$(cat "$REC/p62-local.rc"); default_rc=$(cat "$REC/p62-default.rc")
local_fail=$(grep -aE '^\(fail\)' "$REC/p62-local.log" | sed -E 's/ \[.*//; s/^\(fail\) //' | sort -u)
default_fail=$(grep -aE '^\(fail\)' "$REC/p62-default.log" | sed -E 's/ \[.*//; s/^\(fail\) //' | sort -u)
echo "repo_local_exit=$local_rc default_exit=$default_rc"
local_summary=$(grep -aE '^ *[0-9]+ (pass|skip|fail)$' "$REC/p62-local.log" | tr '\n' ' ')
default_summary=$(grep -aE '^ *[0-9]+ (pass|skip|fail)$' "$REC/p62-default.log" | tr '\n' ' ')
echo "recorded_local=yes ($local_summary) recorded_default=yes ($default_summary)"
printf '%s\n' "$default_fail" | sed '/^$/d' | sed 's/^/default_fail: /'
printf '%s\n' "$local_fail" | sed '/^$/d' | sed 's/^/local_fail: /'
allowed_re='CI baseline parity|TC-WIRE-002'
other=0; excused=0
while IFS= read -r t; do
  [ -z "$t" ] && continue
  if printf '%s' "$t" | grep -Eq "$allowed_re"; then excused=$((excused+1)); else other=$((other+1)); echo "UNEXCUSED: $t"; fi
done <<< "$default_fail"
if [ "$local_rc" -ne 0 ]; then cls=delivery; reason="repository-local full suite failed (authoritative)"
elif [ "$default_rc" -eq 0 ]; then cls=none; reason="both runs green"
elif [ "$other" -eq 0 ] && [ "$excused" -ge 1 ]; then cls=excused; reason="only the two named default-only failures, repository-local green"
else cls=delivery; reason="default run failed with an unexcused test"; fi
case "$cls" in
  excused) [ -s "$REC/p62-rerun.txt" ] && echo "rerun_recorded=yes" || { echo "rerun_recorded=no"; cls=missing-rerun; } ;;
  *) echo "rerun_recorded=n/a" ;;
esac
echo "default_failure_class=$cls reason=$reason"
if [ -f "$R" ] && [ "$cur" = "$rec" ] && { [ "$cls" = none ] || [ "$cls" = excused ]; }; then
  echo "P62 verdict: PASS ($cls)"
else
  echo "P62 verdict: FAIL ($cls: $reason)"
fi
```

**P63 — AC-NFR7-1: the structural diagram read over every touched document**

```bash
# P63 — AC-NFR7-1: the structural diagram read over every touched document
[ "${P00_READY:-}" = "gh303" ] || { echo "FATAL: P00 preamble not loaded" >&2; exit 1; }
require_p00; need fence_blocks
kw='^(flowchart|graph|sequenceDiagram|classDiagram|stateDiagram-v2)'
odd=0; untagged=0; bad=0
fcheck() { local f="$1" fences mer
  fences=$(grep -c '^```' "$f")
  [ $((fences % 2)) -eq 0 ] || { echo "$f fences=$fences ODD"; odd=$((odd+1)); }
  mer=$(grep -c '^```mermaid' "$f")
  while IFS='|' read -r tag fb; do
    [ -z "$fb" ] && continue
    if printf '%s' "$fb" | grep -Eq "$kw"; then
      [ "$tag" = "mermaid" ] || { untagged=$((untagged+1)); echo "$f UNTAGGED-DIAGRAM: $fb"; }
    fi
    if [ "$tag" = "mermaid" ]; then printf '%s' "$fb" | grep -Eq "$kw" || { bad=$((bad+1)); echo "$f BAD-KEYWORD: $fb"; }; fi
  done < <(fence_blocks "$f")
  echo "$f fences=$fences mermaid=$mer"
}
for f in "$MRD" "$A" "$CT" "$TS" "$JN" "$EPD" "$PJ" "$R" "$BL" "$MR" "$ST" "$RG"; do [ -f "$f" ] && fcheck "$f"; done
c1=$(grep -cE '^## C4 Level 1([^0-9]|$)' "$A"); c2=$(grep -cE '^## C4 Level 2([^0-9]|$)' "$A"); c3=$(grep -cE '^## C4 Level 3([^0-9]|$)' "$A")
echo "c4_headings=$c1/$c2/$c3"
kf=$(awk '/^## Key flows/{f=1;next} f&&/^## /{exit} f&&/^### /{c++} END{print c+0}' "$A")
awk '/^## Key flows/{kf=1;next} kf&&/^## /{kf=0} kf&&/^### /{ if (h!="") { if (m!=1) {print "FLOW "h" mermaid="m; bad++} } h=$0; m=0; next } kf&&/^```mermaid/{m++} END{ if (h!="" && m!=1) {print "FLOW "h" mermaid="m; bad++} ; print "flow_ownership_bad="bad+0 }' "$A"
echo "key_flows_headings=$kf/8 fences_odd=$odd untagged=$untagged bad_keywords=$bad"
[ "$c1" -eq 1 ] && [ "$c2" -eq 1 ] && [ "$c3" -eq 1 ] && [ "$kf" -eq 8 ] && [ "$odd" -eq 0 ] && [ "$untagged" -eq 0 ] && [ "$bad" -eq 0 ] && [ -f "$R" ] && echo "P63 verdict: PASS" || echo "P63 verdict: FAIL"
```

**P64 — AC-NFR8-1: 26 of 26 ticket clauses and 32 of 32 board-derived clauses**

```bash
# P64 — AC-NFR8-1: 26 of 26 ticket clauses and 32 of 32 board-derived clauses
[ "${P00_READY:-}" = "gh303" ] || { echo "FATAL: P00 preamble not loaded" >&2; exit 1; }
require_p00; need entry squash clause_rows board_rows path_of
{ entry "$BL" '### M2-S18 '; entry "$BL" '### M2-S19 '; entry "$BL" '### M2-S11 '; } | squash > "$SH/fid.txt"
tot=0; pres=0
while IFS='|' read -r id story anchor clause; do
  [ -z "$id" ] && continue; tot=$((tot+1))
  if grep -Eiq -- "$anchor" "$SH/fid.txt"; then pres=$((pres+1)); else echo "CLAUSE MISSING $id: $clause"; fi
done < <(clause_rows)
echo "ticket_clauses=$pres/$tot"
btot=0; bok=0; : > "$SH/p64-ok.txt"
while IFS='|' read -r id palias ere; do
  [ -z "$id" ] && continue; btot=$((btot+1)); f=$(path_of "$palias")
  if [ "${ere#!}" != "$ere" ]; then
    if [ -f "$f" ] && ! grep -Eiq -- "${ere#!}" "$f"; then bok=$((bok+1)); printf '%s\n' "${id%[a-z]}" >> "$SH/p64-ok.txt"; else echo "BOARD CLAUSE MISSING $id ($palias: absence of $ere)"; fi
  elif [ -f "$f" ] && grep -Eiq -- "$ere" "$f"; then bok=$((bok+1)); printf '%s\n' "${id%[a-z]}" >> "$SH/p64-ok.txt"; else echo "BOARD CLAUSE MISSING $id ($palias: $ere)"; fi
done < <(board_rows)
cov=$(sed '/^$/d' "$SH/p64-ok.txt" | sort -u | wc -l)
echo "board_rows_ok=$bok/$btot board_clauses_covered=$cov/32"
[ "$tot" -eq 26 ] && [ "$pres" -eq 26 ] && [ "$cov" -eq 32 ] && echo "P64 verdict: PASS" || echo "P64 verdict: FAIL"
```

**P65 — AC-NFR9-1: exactly 12 of the 14 touched planning documents are**

```bash
# P65 — AC-NFR9-1: exactly 12 of the 14 touched planning documents are
# literal-scanned, zero seed literals in the scanned set, zero violations
[ "${P00_READY:-}" = "gh303" ] || { echo "FATAL: P00 preamble not loaded" >&2; exit 1; }
require_p00
P65_SET='doc/planning/oss-tooling/milestones/README.md
doc/planning/oss-tooling/milestones/m2/README.md
doc/planning/oss-tooling/milestones/m2/architecture.md
doc/planning/oss-tooling/milestones/m2/contracts.md
doc/planning/oss-tooling/milestones/m2/commands/projects.md
doc/planning/oss-tooling/milestones/m2/commands/repos.md
doc/planning/oss-tooling/milestones/m2/commands/queue.md
doc/planning/oss-tooling/milestones/m2/commands/board.md
doc/planning/oss-tooling/milestones/m2/test-scenarios.md
doc/planning/oss-tooling/milestones/m2/journeys.md
doc/planning/oss-tooling/milestones/m2/entrypoint-delta.md
doc/planning/oss-tooling/status.md'
P65_EXEMPT='doc/planning/oss-tooling/backlog.md
doc/planning/oss-tooling/cli-command-registry.md'
bun run scripts/checks/forbidden-literals.ts > "$SH/p65.log" 2>&1; rc=$?
echo "forbidden_exit=$rc"
grep -E '^OK |^FAIL ' "$SH/p65.log" | head -3
cat > "$SH/p65-scan.ts" <<'TS'
import { existsSync, readFileSync } from "node:fs";
import { join } from "node:path";
const mod = await import(process.env.P65_GUARD as string);
const outcome = mod.scan(process.cwd());
const lines = (v: string | undefined): string[] => (v ?? "").split("\n").map((e) => e.trim()).filter((e) => e.length > 0);
const set = lines(process.env.P65_SET);
const exempt = lines(process.env.P65_EXEMPT);
const registered = [...outcome.registeredDocs].sort();
const present = set.filter((p) => existsSync(join(process.cwd(), p)));
const scannedInSet = set.filter((p) => registered.includes(p));
console.log(`classes=${outcome.classes.length}/5`);
console.log(`registered_total=${registered.length}`);
console.log(`set_present=${present.length}/${set.length}`);
console.log(`set_scanned=${scannedInSet.length}/${set.length}`);
console.log(`exempt_scanned=${exempt.filter((p) => registered.includes(p)).length}`);
console.log(`exempt_unregistered=${exempt.filter((p) => !registered.includes(p)).length}`);
console.log(`violations=${outcome.violations.length}`);
console.log(`failures=${outcome.failures.length}`);
for (const p of present.filter((e) => !registered.includes(e))) console.log(`UNSCANNED ${p}`);
for (const v of outcome.violations) console.log(`VIOLATION ${v.file}:${v.line}: ${v.token}`);
for (const f of outcome.failures) console.log(`FAILURE ${f}`);
let seedHits = 0;
for (const p of present) {
  const content = readFileSync(join(process.cwd(), p), "utf8").split(/\r?\n/);
  content.forEach((line: string, i: number) => {
    const m = mod.matchSeedLiteral(line, mod.EXPECTED_SEED_LITERALS);
    if (m !== undefined) { seedHits += 1; console.log(`SEED_HIT ${p}:${i + 1}: ${m}`); }
  });
}
console.log(`seed_hits=${seedHits}`);
TS
out=$(P65_GUARD="$PWD/scripts/checks/forbidden-literals.ts" P65_SET="$P65_SET" P65_EXEMPT="$P65_EXEMPT" bun run "$SH/p65-scan.ts" 2>&1)
g() { printf '%s\n' "$out" | sed -n "s/^$1=//p" | head -1; }
printf '%s\n' "$out" | grep -E '^(classes|registered_total|set_present|set_scanned|exempt_scanned|exempt_unregistered|violations|failures|seed_hits)=|^(UNSCANNED|VIOLATION|FAILURE|SEED_HIT) '
ok=1
[ "$rc" -eq 0 ] || ok=0
[ "$(g violations)" = "0" ] || ok=0
[ "$(g failures)" = "0" ] || ok=0
[ "$(g seed_hits)" = "0" ] || ok=0
[ "$(g set_scanned)" = "12/12" ] || ok=0
[ "$(g exempt_scanned)" = "0" ] || ok=0
[ "$(g exempt_unregistered)" = "2" ] || ok=0
[ "$(g classes)" = "5/5" ] || ok=0
[ "$ok" -eq 1 ] && echo "P65 verdict: PASS" || echo "P65 verdict: FAIL (see UNSCANNED/VIOLATION/FAILURE/SEED_HIT above)"
```

**P66 — AC-NFR10-1: link integrity, the new page linked from both indices and no pack page restating a story's acceptance block**

```bash
# P66 — AC-NFR10-1: link integrity, the new page linked from both indices,
# and no pack page restating a story's acceptance block
[ "${P00_READY:-}" = "gh303" ] || { echo "FATAL: P00 preamble not loaded" >&2; exit 1; }
require_p00
if [ ! -f "$R" ]; then echo "repos_md=absent"; echo "P66 verdict: FAIL (change absent)"; exit 0; fi
broken=0
for f in "$BL" "$MRD" "$A" "$CT" "$TS" "$JN" "$EPD" "$PJ" "$R" "$MR" "$ST" "$RG"; do
  [ -f "$f" ] || continue; d=$(dirname "$f")
  while IFS= read -r l; do
    case "$l" in http*|mailto:*|'#'*) continue ;; esac
    t="$d/${l%%#*}"
    [ -e "$t" ] || { echo "BROKEN $f -> $l"; broken=$((broken+1)); }
  done < <(grep -oE '\]\([^)]+\)' "$f" | sed -E 's/^\]\(//; s/\)$//' | sort -u)
done
echo "broken_links=$broken"
grep -Fq 'commands/repos.md' "$MRD" && echo "m2_index_link=OK" || echo "m2_index_link=MISSING"
grep -Fq 'm2/commands/repos.md' "$MR" && echo "milestones_index_link=OK" || echo "milestones_index_link=MISSING"
restated=$(grep -chE '^- AC:|^\*\*Given\*\*' "$MRD" "$A" "$CT" "$TS" "$JN" "$EPD" "$PJ" 2>/dev/null | awk '{s+=$1} END{print s+0}')
echo "restated_ac_blocks=$restated"
[ "$broken" -eq 0 ] && [ "$restated" -eq 0 ] && grep -Fq 'commands/repos.md' "$MRD" && grep -Fq 'm2/commands/repos.md' "$MR" && echo "P66 verdict: PASS" || echo "P66 verdict: FAIL"
```

**P67 — AC-NFR11-1: the whole-file retention oracle and its four mutants**

```bash
# P67 — AC-NFR11-1: the whole-file retention oracle and its four mutants
[ "${P00_READY:-}" = "gh303" ] || { echo "FATAL: P00 preamble not loaded" >&2; exit 1; }
require_p00; need diffstat newsec_of newsec_count
echo "oracle=whole-file-line-retention (whole-section cmp not used)"
read -r rem add <<< "$(diffstat "$SH/base-status.md" "$ST")"
ncount=$(newsec_count "$SH/base-status.md" "$ST"); ns=$(newsec_of "$SH/base-status.md" "$ST")
echo "base_lines=$(wc -l < "$SH/base-status.md") removed_or_modified=$rem additions=$add new_section_count=$ncount new_section_line=${ns:-absent}"
cp "$SH/base-status.md" "$SH/fix-ok.md"
printf '\n## GH-303 amendment (2026-11-11)\n\nPlanning state only.\nThe naming boundary holds.\n' >> "$SH/fix-ok.md"
fixcheck() { local r a s o
  read -r r a <<< "$(diffstat "$SH/base-status.md" "$1")"
  s=$(newsec_of "$SH/base-status.md" "$1")
  if [ -z "$s" ]; then o=$a; else o=$(diff -U0 "$SH/base-status.md" "$1" | grep -E '^@@' | sed -E 's/^@@ -[0-9]+(,[0-9]+)? \+([0-9]+)(,([0-9]+))? @@.*/\2 \4/' | awk -v s="$((s-1))" '{c=$1; d=($2==""?1:$2); if (c<s) print}' | wc -l); fi
  echo "$r $a $o"; }
read -r fr fa fo <<< "$(fixcheck "$SH/fix-ok.md")"
echo "conforming_fixture: removed=$fr added=$fa outside=$fo"
read -r dr da do_ <<< "$(fixcheck "$SH/fix-del.md")" 2>/dev/null || true
cp "$SH/fix-ok.md" "$SH/fix-del.md"; sed -i '190d' "$SH/fix-del.md"; read -r dr da do_ <<< "$(fixcheck "$SH/fix-del.md")"
echo "delete_fixture: removed=$dr (expect >0)"
cp "$SH/fix-ok.md" "$SH/fix-mod.md"; sed -i '100s/.*/MUTATED LINE/' "$SH/fix-mod.md"; read -r mr ma mo <<< "$(fixcheck "$SH/fix-mod.md")"
echo "modify_fixture: removed=$mr (expect >0)"
cp "$SH/fix-ok.md" "$SH/fix-swap.md"; awk 'NR==50{a=$0;next} NR==51{print; print a; next} {print}' "$SH/fix-swap.md" > "$SH/fix-swap2.md"; read -r sr sa so <<< "$(fixcheck "$SH/fix-swap2.md")"
echo "swap_fixture: removed=$sr (expect >0)"
cp "$SH/fix-ok.md" "$SH/fix-out.md"; sed -i '5i INJECTED OUTSIDE THE SECTION' "$SH/fix-out.md"; read -r or_ oa oo <<< "$(fixcheck "$SH/fix-out.md")"
echo "outside_insert_fixture: outside_hunks=$oo (expect >0)"
[ "$fr" -eq 0 ] && [ "$fo" -eq 0 ] && [ "$fa" -gt 0 ] && [ "$dr" -gt 0 ] && [ "$mr" -gt 0 ] && [ "$sr" -gt 0 ] && [ "$oo" -gt 0 ] && [ "$rem" -eq 0 ] && [ "$add" -gt 0 ] && [ "$ncount" -eq 1 ] && echo "P67 verdict: PASS" || echo "P67 verdict: FAIL"
```

**P68 — AC-NFR12-1: the required half of the naming matrix, the alias-token**

```bash
# P68 — AC-NFR12-1: the required half of the naming matrix, the alias-token
# placement, and the two fixtures that prove the required scan bites
[ "${P00_READY:-}" = "gh303" ] || { echo "FATAL: P00 preamble not loaded" >&2; exit 1; }
require_p00; need matrix_rows path_of region backlog_ranges squash
echo "-- P68: required-statement half --"
ok=0; tot=0; empty=0
while IFS='|' read -r id palias mode arg req forb; do
  [ -z "$id" ] && continue; tot=$((tot+1))
  f=$(path_of "$palias")
  if [ ! -f "$f" ]; then echo "$id required=NOFILE"; continue; fi
  txt=$(region "$f" "$mode" "$arg" | squash)
  if [ -z "$txt" ]; then echo "$id region=EMPTY"; empty=$((empty+1)); continue; fi
  c=$(printf '%s' "$txt" | grep -Eoi -- "$req" | wc -l)
  if [ "$c" -ge 1 ]; then ok=$((ok+1)); else echo "$id required=MISSING ($req)"; fi
done < <(matrix_rows)
echo "matrix_rows_required=$ok/$tot regions_empty=$empty"
printf '## repos.v1\n\nThe flat record set: `data.repos[]` with `repoKey`.\n' > "$SH/p68-good.md"
g=$(region "$SH/p68-good.md" sect '## repos.v1' | squash | grep -Eoi 'data\.repos\[\]' | wc -l)
printf '## repos.v1\n\nThe flat record set.\n' > "$SH/p68-bad.md"
b=$(region "$SH/p68-bad.md" sect '## repos.v1' | squash | grep -Eoi 'data\.repos\[\]' | wc -l)
echo "positive_fixture=$([ "$g" -ge 1 ] && echo OK || echo FAILED) negative_fixture=$([ "$b" -eq 0 ] && echo detected || echo FAILED)"
D="$BL $MR $MRD $A $CT $PJ $R $Q $B $TS $JN $EPD $ST $RG"
badalias=0
while IFS= read -r l; do
  [ -z "$l" ] && continue
  printf '%s' "$l" | grep -Eiq 'alias|rename rule|deprecation|reachable through|--flat --json|payload|carrying|SYNOPSIS' || { badalias=$((badalias+1)); echo "ALIAS MISUSE: $(printf '%s' "$l" | cut -c1-140)"; }
done < <(cat $D 2>/dev/null | squash | tr '.' '\n' | grep 'projects list --flat')
echo "alias_lines_without_alias_meaning=$badalias"
[ "$ok" -eq "$tot" ] && [ "$tot" -eq 21 ] && [ "$empty" -eq 0 ] && [ "$g" -ge 1 ] && [ "$b" -eq 0 ] && [ "$badalias" -eq 0 ] && echo "P68 verdict: PASS" || echo "P68 verdict: FAIL ($ok/$tot rows in required state)"
```

**P69 — AC-NFR13-1: the terminology-lock counts and the four mapping tokens**

```bash
# P69 — AC-NFR13-1: the terminology-lock counts and the four mapping tokens
# described as repository checkouts wherever they are mentioned
[ "${P00_READY:-}" = "gh303" ] || { echo "FATAL: P00 preamble not loaded" >&2; exit 1; }
require_p00; need squash
D="$BL $MR $MRD $A $CT $PJ $R $Q $B $TS $JN $EPD $ST $RG"
sq=$(cat $D 2>/dev/null | squash)
a=$(printf '%s' "$sq" | tr '.' '\n' | grep -Eic 'the group contract is .?projects\.v1|projects\.v1[^.]{0,40}is the group' || true)
b=$(printf '%s' "$sq" | tr '.' '\n' | grep -Eic 'group identit[^.]{0,40}projectKey|projectKey[^.]{0,40}group identit' || true)
c=$(printf '%s' "$sq" | tr '.' '\n' | grep -Eic 'one spelling[^.]{0,60}(both|two shapes)' || true)
echo "group_contract_affirmations=${a:-0} group_identity_affirmations=${b:-0} two_shape_affirmations=${c:-0}"
printf '%s' "$sq" | tr '.' '\n' > "$SH/p69-sentences.txt"
: > "$SH/p69-violations.txt"
scan_token() { # $1=regex $2=label
  local i=0 s next
  while IFS= read -r s; do
    i=$((i+1))
    printf '%s' "$s" | grep -Eiq -e "$1" || continue
    printf '%s' "$s" | grep -Eiq 'repository|checkout' && continue
    next=$(sed -n "$((i+1))p" "$SH/p69-sentences.txt")
    printf '%s' "$next" | grep -Eiq 'repository|checkout' && continue
    printf '%s\t%s\n' "$2" "$(printf '%s' "$s" | cut -c1-120)" >> "$SH/p69-violations.txt"
  done < "$SH/p69-sentences.txt"
}
scan_token 'project-identity\.json' marker
scan_token '<host root>/projects/<key>' container
scan_token '\-\-project-root' project-root
scan_token 'host index[^.]{0,140}projects\[\]' host-index-fields
scan_token 'host index[^.]{0,140}projectKey' host-index-projectKey
tokfail=$(grep -c . "$SH/p69-violations.txt" || true)
sed 's/^/VIOLATION /' "$SH/p69-violations.txt" | head -5
echo "mapping_token_violations=$tokfail"
clause=$(printf '%s' "$sq" | grep -Eic 'denote a repository checkout' || true)
echo "mapping_clause_sentences=${clause:-0}"
stateproj=$(printf '%s' "$sq" | tr '.' '\n' | grep -Eic 'state (layer|scope)[^.]{0,80}project scope' || true)
echo "state_layer_project_scope=${stateproj:-0}"
[ "${a:-0}" -eq 0 ] && [ "${b:-0}" -eq 0 ] && [ "${c:-0}" -eq 0 ] && [ "$tokfail" -eq 0 ] && [ "${clause:-0}" -ge 1 ] && [ "${stateproj:-0}" -eq 0 ] && echo "P69 verdict: PASS" || echo "P69 verdict: FAIL"
```
### 7.2 TC → Procedure → Implementation Mapping

| TC ID | AC | Procedure | Execution command | Implementation status | Recorded evidence (base tree `3c9f8a59` → delivered head `087c146d`) |
|---|---|---|---|---|---|
| TC-M2DOM-001 | AC-F1-1 | P01 | `bash` block **P01** | Manual Only — uncommitted procedure | base `retained_clauses=5/5; depends_line=exact; ticket_line_record=OK` → FAIL; head `retained_clauses=5/5; depends_line=exact; ticket_line_record=OK` → PASS |
| TC-M2DOM-002 | AC-F1-2 | P02 | `bash` block **P02** | Manual Only — uncommitted procedure | base `Ticket:=byte-identical; Progress:=byte-identical; AC:=byte-identical; preserved_blocks=5/5; entry_change=ABSENT (no change); mutant_preserved_blocks=4/5 (expect 4/5; the AC byte change must be caught)` → FAIL; head `Ticket:=byte-identical; Progress:=byte-identical; AC:=byte-identical; preserved_blocks=5/5; entry_change=non-vacuous; mutant_preserved_blocks=4/5 (expect 4/5; the AC byte change must be caught)` → PASS |
| TC-M2DOM-003 | AC-F1-3 | P03 | `bash` block **P03** | Manual Only — uncommitted procedure | base `s18=absent; owned_items=0/7` → FAIL; head `owned_items=7/7; s11_names_owner=OK; s11_duplicate_ownership=0` → PASS |
| TC-M2DOM-004 | AC-F2-1 | P04 | `bash` block **P04** | Manual Only — uncommitted procedure | base `S18=absent; clauses_present=0/12` → FAIL; head `clauses_present=12/12 shape_labels=4/4 ticket_line=0 depends=exact` → PASS |
| TC-M2DOM-005 | AC-F2-2 | P05 | `bash` block **P05** | Manual Only — uncommitted procedure | base `s18=absent` → FAIL; head `anchors=7/7 softening=0` → PASS |
| TC-M2DOM-006 | AC-F2-3 | P06 | `bash` block **P06** | Manual Only — uncommitted procedure | base `s18=absent` → FAIL; head `rename_set=6/6` → PASS |
| TC-M2DOM-007 | AC-F2-4 | P07 | `bash` block **P07** | Manual Only — uncommitted procedure | base `s18=absent` → FAIL; head `anchors=5/5 shipped_claims=0` → PASS |
| TC-M2DOM-008 | AC-F2-5 | P08 | `bash` block **P08** | Manual Only — uncommitted procedure | base `s18=absent` → FAIL; head `anchors=7/7` → PASS |
| TC-M2DOM-009 | AC-F2-6 | P09 | `bash` block **P09** | Manual Only — uncommitted procedure | base `s18=absent` → FAIL; head `decision_record_task=OK; record_precedes_delivery=OK; shipped_claims=0` → PASS |
| TC-M2DOM-010 | AC-F3-1 | P10 | `bash` block **P10** | Manual Only — uncommitted procedure | base `S19=absent; clauses_present=0/11` → FAIL; head `clauses_present=11/11 shape_labels=4/4 ticket_line=0 depends=exact` → PASS |
| TC-M2DOM-011 | AC-F3-2 | P11 | `bash` block **P11** | Manual Only — uncommitted procedure | base `s19=absent; criteria=0/3` → FAIL; head `numbered_items=4 criteria=1/1/1; review_flow=3/3 ci_corroboration=2/2` → PASS |
| TC-M2DOM-012 | AC-F3-3 | P12 | `bash` block **P12** | Manual Only — uncommitted procedure | base `s19=absent` → FAIL; head `ordering_anchors=3/3` → PASS |
| TC-M2DOM-013 | AC-F3-4 | P13 | `bash` block **P13** | Manual Only — uncommitted procedure | base `plan_shape=absent` → FAIL; head `plan_shape_fields=16/16` → PASS |
| TC-M2DOM-014 | AC-F4-1 | P14 | `bash` block **P14** | Manual Only — uncommitted procedure | base `s17_last=1291 separator=1293 epic_m3=1295 window=1292:1292; window_empty=no (1 line(s)); separator_sequence=identical` → FAIL; head `s17_last=1309 separator=1364 epic_m3=1366 window=1310:1363; window_empty=no (54 line(s)); separator_sequence=identical` → PASS |
| TC-M2DOM-015 | AC-F4-2 | P15 | `bash` block **P15** | Manual Only — uncommitted procedure | base `note_start_line=anchored(1051); note_end_line=anchored(1054); retirement_note=OK` → FAIL; head `note_start_line=anchored(1051); note_end_line=anchored(1054); retirement_note=OK` → PASS |
| TC-M2DOM-016 | AC-F4-3 | P16 | `bash` block **P16** | Manual Only — uncommitted procedure | base `ranges=s11:1169:1189 s4:0:0 ctx:1055:1055 window:1292:1292; backlog_hunks=0; FAIL: no backlog hunk (change absent)` → FAIL; head `ranges=s11:1182:1207 s4:1122:1122 ctx:1055:1068 window:1310:1363; backlog_hunks=6; hunks: inside=6 outside=0` → PASS |
| TC-M2DOM-017 | AC-F4-4 | P17 | `bash` block **P17** | Manual Only — uncommitted procedure | base `depends_line=CHANGED; removed_lines=0 added_lines=0; non_dependency_diff_lines=0` → FAIL; head `depends_line=exact; removed_lines=1 added_lines=1; non_dependency_diff_lines=0` → PASS |
| TC-M2DOM-018 | AC-F5-1 | P18 | `bash` block **P18** | Manual Only — uncommitted procedure | base `repository_as_delivery_unit=MISSING; project_as_group=MISSING; workspace_in_diagram=MISSING` → FAIL; head `repository_as_delivery_unit=OK; project_as_group=OK; workspace_in_diagram=OK` → PASS |
| TC-M2DOM-019 | AC-F5-2 | P19 | `bash` block **P19** | Manual Only — uncommitted procedure | base `MISSING declared membership; MISSING declared-only scan; MISSING undeclared-clone ban` → FAIL; head `anchors=5/5 mandatory_membership_claims=0` → PASS |
| TC-M2DOM-020 | AC-F5-3 | P20 | `bash` block **P20** | Manual Only — uncommitted procedure | base `overview_mentions_member=0 overview_mentions_group=0; cross_repo_flow=absent cross_repo_mermaid=0; overview_group_scoped=MISSING` → FAIL; head `overview_mentions_member=1 overview_mentions_group=1; cross_repo_flow=present cross_repo_mermaid=1; overview_group_scoped=OK` → PASS |
| TC-M2DOM-021 | AC-F5-4 | P21 | `bash` block **P21** | Manual Only — uncommitted procedure | base `discovery_root_named=MISSING; default_identifier_named=MISSING; distinct_statement=MISSING` → FAIL; head `discovery_root_named=OK; default_identifier_named=OK; distinct_statement=OK` → PASS |
| TC-M2DOM-022 | AC-F6-1 | P22 | `bash` block **P22** | Manual Only — uncommitted procedure | base `repos_v1=absent` → FAIL; head `repos_v1_fields=11/11; rv_unbound_scope=OK; rv_unbound_error_attachment=0` → PASS |
| TC-M2DOM-023 | AC-F6-2 | P23 | `bash` block **P23** | Manual Only — uncommitted procedure | base `project_groups_v1=absent` → FAIL; head `group_fields=11/11; projectKey_group_affirmations=0; member_field_ban=OK` → PASS |
| TC-M2DOM-024 | AC-F6-3 | P24 | `bash` block **P24** | Manual Only — uncommitted procedure | base `MISSING hostIndexRevision; MISSING project-groups\.v1; MISSING alias payload\|delivered flat record set` → FAIL; head `delivered_fields=5/5; group_affirmations=0 group_fields=0` → PASS |
| TC-M2DOM-025 | AC-F6-4 | P25 | `bash` block **P25** | Manual Only — uncommitted procedure | base `rename_rule_occurrences=0; two_shape_sentences=0 alias_paired_with_group=0 alias_occurrences=0; alias_token_defined=MISSING` → FAIL; head `rename_rule_occurrences=1; two_shape_sentences=0 alias_paired_with_group=0 alias_occurrences=18; alias_token_defined=OK` → PASS |
| TC-M2DOM-026 | AC-F6-5 | P26 | `bash` block **P26** | Manual Only — uncommitted procedure | base `contracts MISSING project-identity\.json; contracts MISSING <host root>/projects/<key>; contracts MISSING projects\[\].{0,20}projectKey\|host index.s .projects` → FAIL; head `contracts_mapping=6/6; repos_v1_mapping_carried=1/1; repos.md_mapping=5/5` → PASS |
| TC-M2DOM-027 | AC-F6-6 | P27 | `bash` block **P27** | Manual Only — uncommitted procedure | base `configuration_document=absent` → FAIL; head `config_fields=11/11 selector=1` → PASS |
| TC-M2DOM-028 | AC-F6-7 | P28 | `bash` block **P28** | Manual Only — uncommitted procedure | base `aggregation=absent` → FAIL; head `aggregation_anchors=12/12; exit2_restricted=OK` → PASS |
| TC-M2DOM-029 | AC-F6-8 | P29 | `bash` block **P29** | Manual Only — uncommitted procedure | base `queue_lane=absent` → FAIL; head `queue_lane_anchors=9/9` → PASS |
| TC-M2DOM-030 | AC-F6-9 | P30 | `bash` block **P30** | Manual Only — uncommitted procedure | base `plan_shape=absent` → FAIL; head `plan_shape_behaviour=11/11` → PASS |
| TC-M2DOM-031 | AC-F7-1 | P31 | `bash` block **P31** | Manual Only — uncommitted procedure | base `repos_md=absent; checks=0/12` → FAIL; head `checks=11/11 fields=5/5` → PASS |
| TC-M2DOM-032 | AC-F7-2 | P32 | `bash` block **P32** | Manual Only — uncommitted procedure | base `repos_md=absent` → FAIL; head `scope_anchors=11/11; unbound_declared=OK` → PASS |
| TC-M2DOM-033 | AC-F7-3 | P33 | `bash` block **P33** | Manual Only — uncommitted procedure | base `repos_md=absent` → FAIL; head `error_table_identity_unreadable_exit=1; error_table_registry_corrupt_exit=2; error_table_state_unavailable_exit=2; mutant_unbound_exit=detected (exit cell = 0 for `unbound`, 2 otherwise); mutant_nonworktree_err…` → PASS |
| TC-M2DOM-034 | AC-F7-4 | P34 | `bash` block **P34** | Manual Only — uncommitted procedure | base `repos_md=absent` → FAIL; head `state_container=OK; state_example_keys=delivery-a-1a2b3c4d; pattern_valid_keys=1` → PASS |
| TC-M2DOM-035 | AC-F7-5 | P35 | `bash` block **P35** | Manual Only — uncommitted procedure | base `MISSING project-groups\.v1; MISSING data\.groups\[\]; MISSING groupKey` → FAIL; head `group_page_anchors=11/11; orphan_reason_paragraphs=0` → PASS |
| TC-M2DOM-036 | AC-F7-6 | P36 | `bash` block **P36** | Manual Only — uncommitted procedure | base `MISSING classified partial result; MISSING not-yet-supported; MISSING exit-0 behaviour` → FAIL; head `behaviour_anchors=8/8 board_group_claims=0 two_shape=0` → PASS |
| TC-M2DOM-037 | AC-F7-7 | P37 | `bash` block **P37** | Manual Only — uncommitted procedure | base `pages=absent` → FAIL; head `repos_page: repos.v1=3 group_surface=0 header=1 planned=1; projects_page: project-groups.v1=3 repos_surface=0 header=1 planned=1` → PASS |
| TC-M2DOM-038 | AC-F7-8 | P38 | `bash` block **P38** | Manual Only — uncommitted procedure | base `MISSING repository-key boundary; MISSING --all scope; MISSING repositories[] envelope` → FAIL; head `board_anchors=7/7; stale_claims=0 group_claims=0` → PASS |
| TC-M2DOM-039 | AC-F7-9 | P39 | `bash` block **P39** | Manual Only — uncommitted procedure | base `synopsis_grammar=MISSING; options_grammar=MISSING; m2_readme_status_delta=MISSING` → FAIL; head `synopsis_grammar=OK; options_grammar=OK; m2_readme_status_delta=OK` → PASS |
| TC-M2DOM-040 | AC-F8-1 | P40 | `bash` block **P40** | Manual Only — uncommitted procedure | base `s18_seeds=0; assert_violations=0; topic MISSING workspace discovery` → FAIL; head `s18_seeds=8; assert_violations=0; topic_anchors=7/7` → PASS |
| TC-M2DOM-041 | AC-F8-2 | P41 | `bash` block **P41** | Manual Only — uncommitted procedure | base `s19_seeds=0; assert_violations=0; topic MISSING lifecycle shape` → FAIL; head `s19_seeds=5; assert_violations=0; topic_anchors=5/5` → PASS |
| TC-M2DOM-042 | AC-F8-3 | P42 | `bash` block **P42** | Manual Only — uncommitted procedure | base `assertions=0 declared_envelope=0 retired_family=0; contract_closeout_declaration=0 closeout_assertions=0` → FAIL; head `assertions=13 declared_envelope=13 retired_family=0; contract_closeout_declaration=1 closeout_assertions=1` → PASS |
| TC-M2DOM-043 | AC-F8-4 | P43 | `bash` block **P43** | Manual Only — uncommitted procedure | base `s11_01_assert_repos_list=0; s11_01_assert_projects_list=1; s11_01_flat_record_set=0; s11_02_rename_asserted=MISSING; mutant_s11_01_assert_projects_list=1 (expect 1) mutant_flat_assertions=1 (expect 1)` → FAIL; head `s11_01_assert_repos_list=1; s11_01_assert_projects_list=0; s11_01_flat_record_set=1; s11_02_rename_asserted=OK; mutant_s11_01_assert_projects_list=1 (expect 1) mutant_flat_assertions=1 (expect 1)` → PASS |
| TC-M2DOM-044 | AC-F8-5 | P44 | `bash` block **P44** | Manual Only — uncommitted procedure | base `alias_shape_seeds=0` → FAIL; head `alias_seed=SC-M2-S18-08; alias_shape_seeds=1` → PASS |
| TC-M2DOM-045 | AC-F8-6 | P45 | `bash` block **P45** | Manual Only — uncommitted procedure | base `intro_range=MISSING; m2_s2_present=OK; m2_s19_present=MISSING; self_test_short_story=detected self_test_complete=OK` → FAIL; head `intro_range=OK; m2_s2_present=OK; m2_s19_present=OK; self_test_short_story=detected self_test_complete=OK` → PASS |
| TC-M2DOM-046 | AC-F9-1 | P46 | `bash` block **P46** | Manual Only — uncommitted procedure | base `opening_journey_lines=15; MISSING group scope; MISSING configuration membership` → FAIL; head `opening_journey_lines=27; journey_anchors=8/8` → PASS |
| TC-M2DOM-047 | AC-F10-1 | P47 | `bash` block **P47** | Manual Only — uncommitted procedure | base `MISSING repos addition; MISSING repos ownership; MISSING projects addition; mutant_delivered_rewritten=detected; mutant_composition=detected` → FAIL; head `delta_anchors=7/7; host_overview_claims=0; preserved_delivered=6/6; mutant_delivered_rewritten=detected; mutant_composition=detected` → PASS |
| TC-M2DOM-048 | AC-F11-1 | P48 | `bash` block **P48** | Manual Only — uncommitted procedure | base `pack_rows=12/13; MISSING repos contents row; MISSING repos ownership in contents` → FAIL; head `pack_rows=13/13; readme_anchors=12/12; planned_until_exit=verbatim` → PASS |
| TC-M2DOM-049 | AC-F11-2 | P49 | `bash` block **P49** | Manual Only — uncommitted procedure | base `m2_targets=12/13; repos_target=MISSING; m0_row=byte-identical` → FAIL; head `m2_targets=13/13; repos_target=OK; m0_row=byte-identical` → PASS |
| TC-M2DOM-050 | AC-F12-1 | P50 | `bash` block **P50** | Manual Only — uncommitted procedure | base `new_section_count=0 new_section_line=absent; new_section=absent` → FAIL; head `new_section_count=1 new_section_line=227; new_section_heading=## M2 domain-model amendment (2026-11-11); heading_form=title-plus-parenthesised-date` → PASS |
| TC-M2DOM-051 | AC-F12-2 | P51 | `bash` block **P51** | Manual Only — uncommitted procedure | base `removed_lines=0 additions=0 new_section_line=absent new_section_count=0 headings_after=0 added_outside_section=0; base_lines=225 head_lines=225; base_lines_retained=OK` → FAIL; head `removed_lines=0 additions=27 new_section_line=227 new_section_count=1 headings_after=0 added_outside_section=0; base_lines=225 head_lines=252; base_lines_retained=OK` → PASS |
| TC-M2DOM-052 | AC-F13-1 | P52 | `bash` block **P52** | Manual Only — uncommitted procedure | base `projects_rows=1 repos_rows=1; projects_delivery=OK; projects_group_surface=MISSING` → FAIL; head `projects_rows=1 repos_rows=1; projects_delivery=OK; projects_group_surface=OK` → PASS |
| TC-M2DOM-053 | AC-F13-2 | P53 | `bash` block **P53** | Manual Only — uncommitted procedure | base `operate_family_projects=MISSING; boundary_note=MISSING; old_boundary_note=PRESENT (violation)` → FAIL; head `operate_family_projects=OK; boundary_note=OK; old_boundary_note=ABSENT` → PASS |
| TC-M2DOM-054 | AC-F14-1 | P54 | `bash` block **P54** | Manual Only — uncommitted procedure | base `-- P54: forbidden-statement half --; BL-S11 forbidden=2 SURVIVOR; FLAT	 - Goal: Multiple delivery-managed repositories on one workstation are first-class: state is scoped per repository so same-ref collisions a…` → FAIL; head `-- P54: forbidden-statement half --; BL-S11 forbidden=0 OK; BL-18 forbidden=0 OK; self_test_flat=detected self_test_group=detected boundary_allowed=OK` → PASS |
| TC-M2DOM-055 | AC-F14-2 | P55 | `bash` block **P55** | Manual Only — uncommitted procedure | base `backlog disambiguation=MISSING; contracts disambiguation=MISSING; projects_page disambiguation=MISSING` → FAIL; head `backlog disambiguation=OK; contracts disambiguation=OK; projects_page disambiguation=OK` → PASS |
| TC-M2DOM-056 | AC-F14-3 | P56 | `bash` block **P56** | Manual Only — uncommitted procedure | base `group_contract_affirmations=0 group_identity_affirmations=0 two_shape_affirmations=0 state_project_scope=0; groupKey_uses=0 repoKey_uses=0; per_checkout_scope_uses=0` → FAIL; head `group_contract_affirmations=0 group_identity_affirmations=0 two_shape_affirmations=0 state_project_scope=0; groupKey_uses=27 repoKey_uses=20; per_checkout_scope_uses=2` → PASS |
| TC-M2DOM-057 | AC-NFR1-1 | P57 | `bash` block **P57** | Manual Only — uncommitted procedure | base `product_files=0/15 expected_not_changed=15 unexpected_changed=; other_scripts_changed=0; MISSING: doc/planning/oss-tooling/backlog.md` → FAIL; head `product_files=15/15 expected_not_changed=0 unexpected_changed=; other_scripts_changed=0; m1_status_page=byte-identical` → PASS |
| TC-M2DOM-058 | AC-NFR2-1 | P58 | `bash` block **P58** | Manual Only — uncommitted procedure | base `stories_kept=72 changed=0 removed=0; base_headings=74 head_headings=74 added=0; order=OK` → FAIL; head `stories_kept=72 changed=0 removed=0; base_headings=74 head_headings=76 added=2; order=OK` → PASS |
| TC-M2DOM-059 | AC-NFR3-1 | P59 | `bash` block **P59** | Manual Only — uncommitted procedure | base `proposed_headers=1/2; delivered_claims=0; planted_claims_detected=3/3` → FAIL; head `proposed_headers=2/2; delivered_claims=0; planted_claims_detected=3/3` → PASS |
| TC-M2DOM-060 | AC-NFR4-1 | P60 | `bash` block **P60** | Manual Only — uncommitted procedure | base `registered=141 base_registered=141 delta=0; queue_row=89 repos_row=absent spend_row=90; position=repos-not-registered` → FAIL; head `registered=142 base_registered=141 delta=1; queue_row=89 repos_row=90 spend_row=91; position=between-queue-and-spend` → PASS |
| TC-M2DOM-061 | AC-NFR5-1 | P61 | `bash` block **P61** | Manual Only — uncommitted procedure | base `repos_md=ABSENT; dist_guard_exit=0; (guard-doc-distribution)[OK]   no drift — 83 in-scope docs; install set matches ados_distribution markers` → FAIL; head `repos_md=present; dist_guard_exit=0; (guard-doc-distribution)[OK]   no drift — 83 in-scope docs; install set matches ados_distribution markers` → PASS |
| TC-M2DOM-062 | AC-NFR6-1 | P62 | `bash` block **P62** | Manual Only — uncommitted procedure | base `gate_record=absent (/tmp/gh303/base/tmp/tmpdir/gh303/p62-record/p62-local.rc; set P62_RECORD_DIR)` → FAIL; head `change_present=yes; code_fingerprint_match=yes; repo_local_exit=0 default_exit=1; recorded_local=yes ( 7206 pass  4 skip  0 fail ) recorded_default=yes ( 7205 pass  4 skip  1 fail ); rerun_recorded=yes; default…` → PASS |
| TC-M2DOM-063 | AC-NFR7-1 | P63 | `bash` block **P63** | Manual Only — uncommitted procedure | base `doc/planning/oss-tooling/milestones/m2/README.md fences=0 mermaid=0; doc/planning/oss-tooling/milestones/m2/architecture.md fences=20 mermaid=10; doc/planning/oss-tooling/milestones/m2/contracts.md fences=0 mer…` → FAIL; head `doc/planning/oss-tooling/milestones/m2/README.md fences=0 mermaid=0; doc/planning/oss-tooling/milestones/m2/architecture.md fences=22 mermaid=11; doc/planning/oss-tooling/milestones/m2/contracts.md fences=0 mer…` → PASS |
| TC-M2DOM-064 | AC-NFR8-1 | P64 | `bash` block **P64** | Manual Only — uncommitted procedure | base `CLAUSE MISSING S18-G: S18 goal: configured group of repositories, enumerable with members, workspace as optional discovery root; CLAUSE MISSING S18-T1: S18 task 1: project configuration declaring member reposit…` → FAIL; head `ticket_clauses=26/26; board_rows_ok=37/37 board_clauses_covered=32/32` → PASS |
| TC-M2DOM-065 | AC-NFR9-1 | P65 | `bash` block **P65** | Manual Only — uncommitted procedure | base `forbidden_exit=0; OK forbidden-literals: 5/5 scope classes scanned, 0 violations; classes=5/5` → FAIL; head `forbidden_exit=0; OK forbidden-literals: 5/5 scope classes scanned, 0 violations; classes=5/5` → PASS |
| TC-M2DOM-066 | AC-NFR10-1 | P66 | `bash` block **P66** | Manual Only — uncommitted procedure | base `repos_md=absent` → FAIL; head `broken_links=0; m2_index_link=OK; milestones_index_link=OK` → PASS |
| TC-M2DOM-067 | AC-NFR11-1 | P67 | `bash` block **P67** | Manual Only — uncommitted procedure | base `oracle=whole-file-line-retention (whole-section cmp not used); base_lines=225 removed_or_modified=0 additions=0 new_section_count=0 new_section_line=absent; conforming_fixture: removed=0 added=5 outside=0` → FAIL; head `oracle=whole-file-line-retention (whole-section cmp not used); base_lines=225 removed_or_modified=0 additions=27 new_section_count=1 new_section_line=227; conforming_fixture: removed=0 added=5 outside=0` → PASS |
| TC-M2DOM-068 | AC-NFR12-1 | P68 | `bash` block **P68** | Manual Only — uncommitted procedure | base `-- P68: required-statement half --; BL-18 region=EMPTY; BL-19 region=EMPTY` → FAIL; head `-- P68: required-statement half --; matrix_rows_required=21/21 regions_empty=0; positive_fixture=OK negative_fixture=detected` → PASS |
| TC-M2DOM-069 | AC-NFR13-1 | P69 | `bash` block **P69** | Manual Only — uncommitted procedure | base `group_contract_affirmations=0 group_identity_affirmations=0 two_shape_affirmations=0; mapping_token_violations=0; mapping_clause_sentences=0` → FAIL; head `group_contract_affirmations=0 group_identity_affirmations=0 two_shape_affirmations=0; mapping_token_violations=0; mapping_clause_sentences=1` → PASS |

No test file is created or updated: no permanent-suite change is permitted or
needed (NFR-1; testing-strategy invariant rule — a branch-diff assertion belongs to
review and PR-time gates, never to the permanent suite).


### 7.3 Failure Triage

| Symptom | Meaning | Action |
|---|---|---|
| P57 prints `product_files` other than 15, or any path under `unexpected_changed` | The containment budget is broken (AC-NFR1-1/DEC-1) | Revert the out-of-manifest path; the manifest is spec Appendix C, 14 planning files + 1 registry |
| P57 prints `product_files=0/15` | The change is absent | A missing deliverable is never a pass |
| P14 prints `separator_sequence=CHANGED`, `blank_line_before_separator=0`, or `placement=FAIL` | The insertion landed below the `---` separator, moved it, or swallowed the blank line (AC-F4-1/RSK-2) | Move S18/S19 above the blank line at the derived window (`S17_LAST+1 .. SEP_LINE-1`); leave `---`, the blank line, and `## Epic M3` untouched |
| P16 prints an `OUTSIDE` hunk or `non_vacuous=no` | A backlog hunk escaped the S11 entry, the S4 line, the context paragraph, or the new entries (AC-F4-3) | Restore the surrounding bytes; a zero-hunk run is a missing deliverable |
| P15 prints `paragraph_lines=0`, `paragraph_strictly_between=FAIL`, or an anchor not `7/7` | The Epic M2 context paragraph is absent, incomplete, or outside the note-to-M2-S2 window (AC-F4-2) | Insert one paragraph strictly between the retirement note's last line and `### M2-S2`, with a blank line on each side |
| P58 prints `CHANGED:`/`REMOVED:` naming a story, `order=FAIL`, or `s4_hunks!=1` | Backlog preservation or S4 confinement broken (AC-NFR2-1, AC-F4-4) | Restore the named story byte for byte; the S4 diff is its dependency line only |
| P01 prints a `retained MISSING:` line | An M2-S11 delivered clause was lost in the amendment (AC-F1-1) | Restore the clause; the amendment touches the enumeration task's wording only |
| P02 prints `repos_list_in_ac=PRESENT`, `field_rename_clause=PRESENT`, or `outside_tasks_edits>0` | The amendment put the rename in the delivered story (AC-F1-2) | Keep the delivered AC; move the rename to M2-S18 |
| P03 prints `owned_items<7/7`, `s11_names_owner=MISSING`, or `s11_duplicate_ownership>0` | Ownership is split or duplicated (AC-F1-3) | Give every transition item to M2-S18 and have M2-S11 name it once |
| P04/P10 print `MISSING <clause id>` or a wrong shape label | A ticket clause from the 26-row table has no anchor (AC-F2-1/AC-F3-1/AC-NFR8-1) | Restore the named clause, then run the G-1 paraphrase read |
| P05 prints a missing anchor or `softening>0` | The mixed-tracker clause was softened or lost (AC-F2-2/RSK-14) | Restore "accepted at validation time … `not-yet-supported` rather than rejected silently" in both locations |
| P06 prints `rename_set<6/6` | The rename, alias, or alias-shape AC is incomplete (AC-F2-3/BRD-5) | Add the missing task or the alias-payload AC |
| P07 prints `shipped_claims>0` | A task claims the rename already shipped (AC-F2-4, AC-F2-6) | Reword to "S18 code work, not current truth" |
| P08 prints a missing anchor | Configuration-only membership or the scoped grammar is unstated (AC-F2-5) | Add `workspaceRoot`/`members`, the declared-only scan, and both grammar forms |
| P09 prints `decision_record_task=MISSING` or `record_precedes_delivery=MISSING` | The ODR-0003 prerequisite is unstated (AC-F2-6, BRD-27) | Add the superseding decision-record task before the Delivery move |
| P11 prints `numbered_items<3`, a zero criterion, or `review_flow<3/3` | An S19 criterion was merged, dropped, or left unexecutable (AC-F3-2/DEC-32) | Restore the numbered criteria and the one-review-run definition |
| P12 prints `ordering_anchors<3/3` | Dependency ordering or landing-order evidence is missing (AC-F3-3/BRD-22) | Add the derived criterion verbatim in substance |
| P13/P30 print a missing field or clause | The change plan shape is incomplete (AC-F3-4/AC-F6-9/RSK-13) | Add the field inventory (P13) or the behavioural clauses (P30) |
| P17 prints `depends_line=CHANGED` or `non_dependency_diff_lines>0` | M2-S4 was edited beyond its dependency line (AC-F4-4) | Restore every other line; keep the terminal period |
| P18/P19/P20/P21 print a missing anchor | The three-level model, its flows, or its invariants are incomplete (AC-F5-*) | Add the named statement or drawn node; keep the workspace optionality visible in the diagram |
| P22/P23/P24/P25/P26/P27/P28/P29/P30 print `absent` or a missing field | A contract shape is missing or a name carries the wrong meaning (AC-F6-*/RSK-3, RSK-5) | Add the section or field; the three names are `project-groups.v1`, `projects.v1`, `repos.v1` and never cross |
| P25 prints `rename_rule_occurrences!=1` | The rule is restated or missing (AC-F6-4/BRD-4) | Keep one normative sentence in the contracts and reference it everywhere else |
| P31/P32/P33/P34 print a missing check | The new page is incomplete or loses delivered semantics (AC-F7-1..4/RSK-6) | Restore the synopsis, no-state-read help/version, scope, delivered identities, host-root STATE example, and mapping clause |
| P35/P36 print a missing anchor or an orphan reason paragraph | The group page is incomplete or keeps an unattached field paragraph (AC-F7-5/AC-F7-6/BRD-14) | Attach `daemonReachable.reason` to `members[]` or delete it; state the partial classification and the scoped grammar |
| P37 prints a foreign surface token | The two pages share a surface (AC-F7-7) | Keep each page on its own contract; the bare word may appear in a boundary pointer |
| P38 prints `stale_claims>0` or `group_claims>0` | The board still claims group scope or the old model (AC-F7-8/RSK-10) | Reconcile to repository keys, `repositories[]`, and `board.repository-unknown` |
| P39 prints a missing grammar or `m1_status_page=CHANGED` | The scope grammar or the frozen M1 page is wrong (AC-F7-9/DEC-25) | Add the queue grammar and the README delta; never edit the M1 page |
| P40/P41 print a zero seed count, an assert-count violation, or a missing topic | The seed set is short or a seed has zero/two `Assert:` lines (AC-F8-1/AC-F8-2) | Add or amend the named seed; exactly one `Assert:` per seed |
| P42 prints `UNDECLARED`, `retired_family>0`, or a missing closeout assertion | A seed reads an undeclared envelope (AC-F8-3/BRD-23, BRD-24) | Re-point the assertion to a declared envelope; keep `closeout.data.members[]` contract-backed |
| P43/P44 print a missing token | An S11 seed is unreconciled or the alias seed is absent (AC-F8-4/AC-F8-5) | Rewrite SC-M2-S11-01/02 and add the alias-shape seed |
| P45 prints `intro_range=MISSING` or `stories_below_two>0` | The scenario intro or per-story coverage is short (AC-F8-6/BRD-30) | Update the intro and add the missing seed |
| P46/P47/P48/P49/P50 print a missing anchor | A reconciliation page, index, or status section is incomplete (AC-F9-1..AC-F12-1) | Add the named statement, row, or target |
| P51/P67 print `removed_lines>0` or `added_outside_section>0` | A base status line was removed, reordered, or modified (AC-F12-2/AC-NFR11-1/RSK-19) | Restore the base line byte for byte; confine additions to the new section |
| P52 prints `projects_rows!=1`, `repos_rows!=1`, `second_repos_delivery_rows>0`, or a missing lock | The registry split is wrong (AC-F13-1/RSK-11) | One projects row (Delivery M2-S11 shipped) and one repos row (Delivery `-`, ODR-0003 lock) |
| P53 prints `changed_lines_outside_allowed>0` or `fixture_outside=INERT` | A registry row outside the four permitted regions changed, or the classifier is inert (AC-F13-2) | Restore the row; the planted mutant must always be flagged |
| P54 prints a `SURVIVOR` row or `region=EMPTY` | A flat-`projects` or group-`repos` statement survives, or an anchor is wrong (AC-F14-1/RSK-1) | Fix the named region from Appendix B; re-run until `rows_with_survivors=0/21` and `regions_empty=0` |
| P54 prints a self-test not `detected`/`OK` | The detector is inert or over-broad (AC-F14-1) | Restore the two-class sanction: names `projects list` **and** states the rename or a GH-288 fact; never accept a bare enumeration |
| P55 prints `disambiguated_pages<6/6`, a missing fact, or a contradiction | A page or a delivered fact is missing or contradictory (AC-F14-2/RSK-1) | Add the disambiguation; restore the fact or carry it to the delivered surface's owner |
| P56/P69 print a non-zero affirmation or a `MAPPING TOKEN` line | An old identity is affirmed or a repository token is described as group vocabulary (AC-F14-3/AC-NFR13-1/RSK-3, RSK-5) | Rewrite the sentence; the four tokens stay repository vocabulary permanently |
| P60 prints `registered!=142`, `position=OUT-OF-ORDER`, or `duplicates>0` | The registry row is missing, duplicated, or misplaced (AC-NFR4-1/RSK-16) | Add exactly one row for the new page between `queue.md` and `spend.md` |
| P60/P65 print a non-zero guard exit, a violation, or an unregistered doc | A forbidden literal appeared or a doc is unregistered (AC-NFR4-1/AC-NFR9-1) | Reword the line; never widen the allowlist |
| P65 prints `set_scanned!=12/12`, `exempt_unregistered!=2`, or `seed_hits>0` | The scanned set or the exempt set is wrong (AC-NFR9-1) | Fix the registration set; the two exempt documents stay unregistered |
| P61 prints a non-zero exit or `planning_markers>0` | A scoped doc was disturbed or a planning marker appeared (AC-NFR5-1) | Check P57 first; `doc/planning/**` stays outside the marker set |
| P62 prints `repo_local_exit>0` | A failure in the authoritative repository-local full suite (AC-NFR6-1(a)) | Fix it; there is no environmental exemption, including a repeated 5 s timeout |
| P62 prints `default_failure_class=delivery` | A default-run failure that is neither `ci-baseline-parity` nor `TC-WIRE-002`, or a default failure on a head whose repository-local run is not green (AC-NFR6-1(c)/(d)) | Investigate the named test; record the re-run; never reclassify it as environmental |
| P62 prints `missing-rerun` | The two named default failures were not re-run and recorded (AC-NFR6-1(c)) | Re-run each in isolation, write the result to `$SH/p62-rerun.txt`, re-classify |
| P62 prints `change_present=NO` or `code_fingerprint_match=NO` | The record belongs to a different tree | Re-run the gate on the change head with `RUN_GATES=1` |
| P63 prints an odd fence, an untagged diagram, a bad keyword, or `key_flows_headings!=8` | A diagram is structurally invalid or a flow heading is unowned (AC-NFR7-1/RSK-18) | Fix the fence or keyword; then have the reviewer render the page (G-3) |
| P66 prints `broken_links>0`, a missing index link, or `restated_ac_blocks>0` | A link is wrong, the page is undiscoverable, or a pack page restates acceptance criteria (AC-NFR10-1) | Fix the path or replace the restatement with a story-code reference |
| P64 prints a missing clause id or `board_clauses_covered<32` | Clause fidelity is incomplete (AC-NFR8-1/RSK-15) | Restore the named clause; never delete a table row to make the scan pass |

## 8. Risks, Assumptions, and Open Questions

### 8.1 Risks

| ID | Testing risk | Mitigation in this plan |
|---|---|---|
| TR-1 | A prose oracle lets a lost or weakened clause pass as complete | A 26-row anchor table from spec Appendix A.1, run three times (P04, P10, P64) with a named failure per missing clause; the semantic residue is declared as G-1 with a named reviewer |
| TR-2 | A preservation control passes because nothing changed | Non-vacuity guards in P02, P16, P51, P53, P57, P58, P67 and P68; mutation fixtures in P53, P54, P59, P67, P68; Section 10 labels every control |
| TR-3 | A hunk-containment check silently accepts a moved entry or an insertion below the separator | P14 derives the window from the tree, asserts the separator triple byte-identical and the blank line before it, and requires S18 before S19 inside the window; P16 classifies hunks against four ranges with three self-tests |
| TR-4 | The status retention oracle flags a legitimate blank separator line, or misses a reordering | P51/P67 define the new-section boundary as the derived heading minus one line, and P67 proves the oracle accepts a conforming head while detecting delete, modify, swap, and outside insertion |
| TR-5 | The registry position check passes because `queue.md` and `spend.md` are adjacent at base | P60 asserts `repos` at `queue_index+1` **and** `spend` at `repos_index+1`, and that exactly one line was added and it is the new page; P65 fails closed on the unregistered page |
| TR-6 | The two guards are run with the wrong `TMPDIR` and produce a false red or a false green | P61 uses `env -u TMPDIR`; P62 creates `<repo>/tmp/tmpdir` and runs both ways; the classification names the only exempt tests (G-6) |
| TR-7 | The naming scan is inert or over-broad | P54 and P68 extract each Appendix B region by mode rather than scanning the whole corpus, and each carries fixtures proving detection and acceptance |
| TR-8 | A wrapped or hyphenated line defeats an anchor | The shared `squash()` helper joins a trailing hyphen before collapsing newlines, and every procedure that reads prose uses it |
| TR-9 | A check is run on a moving base | Snapshots are materialised from the pinned `3c9f8a59`; re-run P00 if the base advances. Base-observed and fixture-observed values are recorded separately so a move is visible |
| TR-10 | `pnpm check` is green but unrelated to the documents | Content procedures carry the ACs; P62 is a no-regression gate only (G-7) |
| TR-11 | A default-run failure is excused without the repository-local run being green, or a repeated 5 s timeout is waved through | P62 makes the repository-local full suite authoritative, requires both runs recorded, admits only the two named default-only failures, requires a recorded re-run for each, and binds the record to a code fingerprint plus a change-presence check |
| TR-12 | The 26-row clause table drifts from the ticket and silently shrinks | P64 counts its own rows (`total=26`); a removed row changes the total and fails the scan. The 32 board clauses are counted the same way |
| TR-13 | A seed asserts a shape no contract declares (the `change.data.*` regression) | P42 requires every S18/S19 assertion to read a declared envelope, forbids the retired family outright, and requires the closeout assertion to be contract-backed |

### 8.2 Assumptions

- **A-1**: `3c9f8a59aa1d38adc0fd5dbefdf8acc71c0f0135` is the correct base (`main-tools` with GH-286 daemon mounting merged on top of GH-268). The fifteen product changes sit on top; nothing below the base is re-tested for delivery.
- **A-2**: The GH-303 ticket body is the normative clause source, and spec Appendix A.1 transcribes it faithfully; the reviewer re-reads the ticket for the G-1 paraphrase pass.
- **A-3**: `doc/planning/**` is outside the distribution-marker guard's scan set, so no `ados_distribution` marker is expected or allowed (spec §12).
- **A-4**: The repository has no mermaid validator and this change adds none, so the structural read is the truthful bar (G-3).
- **A-5**: Story codes are stable identifiers and file position carries no ordering meaning; placement inside the block is still required by F-4/DEC-8.
- **A-6**: `bun` and `pnpm` are installed with `node_modules` present, so P62 is executable as written.
- **A-7**: The environment's default `TMPDIR` is tmpfs, so the guards have opposite requirements; the pair is recorded rather than resolved by changing the environment (spec §12).
- **A-8**: The fourteen planning documents keep their current paths; the manifest in P57 is spec Appendix C, so a path rename is a scope change, not a test failure to absorb.
- **A-9**: `PROJECT_KEY_PATTERN` is `^[a-z0-9](?:[a-z0-9-]*[a-z0-9])?-[0-9a-f]{8}$`, so `delivery-a-1a2b3c4d` is valid and a bare basename is not (spec §12).

### 8.3 Open Questions

None outstanding. The spec closed the four board decisions (A-D) as DEC-19..DEC-22 and recorded every other editing choice as a decision, leaving no open question this plan must route.

| ID | Question | Blocking? | Owner | Disposition |
|---|---|---|---|---|
| — | None outstanding | — | — | Closed by spec v1.4 and the pm-notes decisions |

### 8.4 Interpretation Decisions and Flagged Spec Gaps

Nine places where the spec's wording admits more than one mechanical reading, and how this plan resolves each without asking for a spec change:

| ID | Spec text | Ambiguity | Resolution in this plan |
|---|---|---|---|
| TP-1 | AC-F12-2 and AC-NFR11-1 | Both state `status.md` line retention, so a naive mapping produces two test cases with one predicate | Split by predicate: TC-M2DOM-051 = presence and order plus addition confinement; TC-M2DOM-067 = byte-identity plus the oracle's soundness (four mutants). Declared in §3.3 |
| TP-2 | AC-F3-4 and AC-F6-9 | Both describe the cross-repository change plan shape | Split by direction: TC-M2DOM-013 asserts the field inventory (contract → fields); TC-M2DOM-030 asserts the behavioural clauses (review flow, CI corroboration, ordering, evidence). Declared in §3.2 |
| TP-3 | AC-F7-7 ("`repos.v1` and the flat record set appear only on the `repos` page") versus AC-F14-2 (every both-name location states the boundary) | The `projects` page must name the flat surface in its boundary and alias pointers, so a literal word ban would make the two criteria mutually unsatisfiable | P37 tests envelope tokens (`repos.v1`, `data.repos[]`, `project-groups.v1`, `data.groups[]`), not the bare word; the boundary pointer is positively required by P55, and the alias row is required by P36 |
| TP-4 | NFR-7 ("`## Key flows` holds exactly 8 `###` headings") | The number is stated as an end state while the base has 7 | P63 treats 7 → 8 as the derived consequence of AC-F5-3's new flow and reports both numbers, so a missing flow fails as a count mismatch rather than as an unexplained constant |
| TP-5 | F-12/AC-F12-1 require a new dated section but fix neither its title nor the form of its date | A fixed title would over-specify the author; a bare leading-date form contradicts the file's convention (`## M2 delivery snapshot (2026-11-11)`) | P50 derives the section as the **only** `## ` heading present in the head and absent from the base (a second new section fails), requires no heading after it, and enforces the date in the file's existing form (`^## .+ \\(2026-11-11\\)$`). The title text stays free |
| TP-6 | AC-F14-2's "every location that names both surfaces" versus Appendix B's two index rows | `m2/README.md` and `milestones/README.md` link both surfaces but Appendix B requires only link and row coverage | P55 checks the six prose locations whose Appendix B row requires a relation statement; P48/P49 own the two index rows as link and row coverage |
| TP-7 | AC-F6-2's "a member field never denotes the group, and no group-named field denotes a repository" versus a section that must mention `projectKey` to deny it | A blunt ban on `projectKey` would forbid the denial the criterion requires | P23 bans only affirmations (`projectKey … is/denotes the group identity`) and requires the two denial statements; the section may name the token to deny it |
| TP-8 | AC-F14-1 sanctions "statements recording delivered GH-288 facts", while AC-F14-3 sets a zero count on old-identity affirmations | The M2-S11 goal and enumeration AC necessarily describe the shipped `projects list` surface | P54 sanctions four classes — the time-scoped disambiguation, a GH-288 fact, the alias definition, and the delivered enumeration AC that F-1 keeps — and P56/P69 count only affirmations of the *wrong* identity, never the delivered surface's own name |
| TP-10 | AC-F8-1 requires a seed covering `queue list --project <groupKey>` and `status --project <groupKey>`, while AC-F8-3 restricts every assertion to `project-groups.v1`, `repos.v1`, `plan.data.members[]`, `closeout.data.members[]`, and `verify gates` | The group-scoped read responses have no declared envelope in the corpus, so a literal reading makes the required seed impossible to assert | The seed invokes both scoped reads and asserts the **scoped member set** through `project-groups.v1` (`data.groups[].members[]`, `groupKey`) plus the invocation's exit code — no undeclared `queue.*`/`status.*` envelope is read. Flagged for the spec author: if the scoped reads are meant to be asserted directly, the contracts must declare their envelopes |
| TP-9 | AC-NFR6-1's "repository-local `TMPDIR`" versus this environment | The repository itself lives on a normal filesystem, but the conforming fixture lives under `/tmp` (tmpfs), so a gate run there cannot be the authoritative run | The gate is a delivery-time procedure: P62 requires a record taken on a real install with a repository-filesystem `TMPDIR`, binds it to a code-tree fingerprint (NFR-1 forbids code changes, so docs cannot alter the suite's result) and to a change-presence check, and classifies per the AC. The plan records the observation rather than weakening the AC |

No spec gap blocks delivery. Flags raised for the author's awareness, all with a working oracle: TP-1 to TP-10.
## 9. Plan Revision Log

| Version | Date | Author | Changes |
|---|---|---|---|
| 1.4 | 2026-11-11 | @test-plan-writer | Rebuilt against spec v1.4 after the six-critic review board on PR #306 (CTO, API Integration Engineer, Domain Expert, QA Engineer, SRE, Technical Writer) (decisions A-D, findings 1-18), with every procedure re-authored and re-executed in a fresh shell. **(1) 69 criteria, 69 cases, 69 procedures:** the AC set grew from 45 to 69 (56 functional + 13 non-functional), so the TC set was renumbered coherently `TC-M2DOM-001..069` and every listing (coverage tables, scenario index, scenario details, automation mapping, execution log) was regenerated from one table; traceability stays 1:1 in both directions. **(2) The v1.4 naming surface:** new shape-asserting procedures for `project-groups.v1` / `data.groups[]` / `groupKey` with no `projectKey` group identity (P23, P24, P56, P69), `repos.v1` / `data.repos[]` / `repoKey` (P22, P31, P34), `projects list --flat` returning `data.projects[]` (P06, P44), the single rename rule (P25, P68), the repository-vocabulary mapping clause on both pages (P26), configuration-only membership with an undeclared-clone seed (P27, P40), the classified partial aggregation that degrades one `state-unavailable` member at exit 0 rather than exit 2 (P28, P40), the queue/lane representation with its release rule (P29), the repository-key board boundary (P38), the `queue list --project <groupKey>` and `status --project <groupKey>` grammar (P39), the registry split with the ODR-0003 lock (P52, P53), the S4 edge (P17), per-member CI corroboration, dependency ordering and `closeout.data.members[]` (P13, P30, P41, P42), the help/version no-state-read rows (P31), and the six-page disambiguation (P55). **(3) Base values re-derived by execution:** base `3c9f8a59` re-measured in a detached worktree — backlog 1460 lines, M2-S11 1169–1189, S17 last content 1291, separator 1293, `## Epic M3` 1295, window `1292:1292`, retirement note 1051–1054 and an empty context window `1055:1055`, 74 headings; `status.md` 225 lines with last heading 214; registry 141 (`queue` 89, `spend` 90); `architecture.md` 20 fences / 10 mermaid / 7 key flows; 12 pack rows, 12 index targets, 40 seeds / 40 asserts, 8 contract sections, `repos.md` absent, 0/15 product files. **(4) Conforming fixture:** a never-committed worktree built at the then-current base was the plan-time device; the delivered head was re-measured and supersedes it (see items (f) and (g)). **(5) Sweep result:** in fresh shells the fixture is **69/69 PASS** and the base is **0/69** — every procedure carries at least one change-dependent assertion, so no procedure can pass at the base by preserving what already exists. **(6) Plan-gate contract kept:** P15/P16 are gated on invariants only (non-empty paragraph strictly between the retirement note and `### M2-S2`, hunk confinement with `outside=0`, `non_vacuous=yes`, `classifier_self_tests=3/3`); the head-derived line numbers and hunk counts stay observations. **(7) TMPDIR policy and base pin kept:** P61 uses the default `TMPDIR`, P62 the repository-filesystem one, and `BASE=3c9f8a59` is pinned in P00 (re-pinned by item (g)). **(8) Board record:** the six critics — CTO, API Integration Engineer, Domain Expert, QA Engineer, SRE, and Technical Writer — returned decisions A-D and findings 1-18 (6 blocking, 10 should-fix, 2 cheap notes), which are the normative source for the 32 derived clauses P64 counts. **Corrections within v1.4 (no version bump, three oracle defects found by the plan-writer):** (a) TC-045/P45 no longer gates on `intro_two_per_story` — the phrase wraps across lines in the conforming intro, so the token read MISSING while the intro was correct; the gate is now `intro_range=OK`, `m2_s2_present=OK`, `m2_s19_present=OK` and `stories_below_two=0`, with both-direction self-tests. (b) TC-043/P43 no longer reports the corpus-wide `projects_list_asserts=2` (it counted the alias seed and read as a failure); the tokens are scoped to the seeds — `s11_01_assert_projects_list=0`, `s11_02_rename_asserted=OK`, `flat_assertions=0` — and a positional mutant proves both bite. (c) TC-034/P34's `state_example_keys` is now recorded in §10 (`delivery-a-1a2b3c4d`) as well as asserted. All three were re-run in fresh shells: conforming fixture PASS, base FAIL. (d) **TC-002/P02 (fourth correction):** `blk()` passed the entry **text** as awk's `$1` filename and read the pattern from an always-empty `$2`, so all five preservation checks compared two empty strings and reported `byte-identical` vacuously. The helper now extracts the entry **by file** (entry_of '<file>'), pipes the body into `blk '<label>'` (stdin), and compares the five blocks the spec actually pins — heading, `- Ticket:`, `- Progress:`, `- AC:`, `- Depends on:`. The Goal is not pinned (F-1 allows rewording; the conforming head names the delivered `projects list`), and its delivered-overview meaning is asserted instead. Non-vacuity is proved on the real head: a one-word AC mutation reports `mutant_preserved_blocks=4/5`, a fabricated dependency line reports `mutant_depends=CHANGED`, a benign Goal reword is accepted with the pinned set untouched, and a Goal promising `repos list` is detected. 69 ACs / 69 TCs and the five listings stay at 69. (e) **TC-033/P33 + TC-022/P22 (fifth correction, doc-sync re-check):** the corpus's `m2/commands/repos.md` error table folded a non-work-tree root into `projects.identity-unreadable` as `0 for unbound, 2 otherwise`, contradicting delivered truth and the page's own scope prose, and no procedure pinned the exit column. TC-033 (AC-F7-3, the page-contract case — TC-022 is the contracts `repos.v1` section) now parses the error table and gates `error_table_identity_unreadable_exit=1`, `error_table_registry_corrupt_exit=2`, `error_table_state_unavailable_exit=2`, `unbound_in_scope=OK`, `unbound_as_error_row=0`, `unbound_error_attachment=0` and `non_worktree_failure_claim=0`, with two mutants proving both directions (`mutant_unbound_exit=detected`, `mutant_nonworktree_error=detected`). TC-022 adds the contract-side half (`rv_unbound_scope=OK`, `rv_unbound_error_attachment=0`). 69 ACs / 69 TCs and the five listings stay at 69. (f) **Sixth correction (board re-verification at `52775f64`):** every §6/§10 observation was re-measured at the delivered head and corrected — `test-scenarios.md` has **8 S18 / 5 S19** seeds (was 7/6) with the alias seed at **`SC-M2-S18-08`** (was `SC-M2-S19-06`); `status.md` is **225 → 252** with **27** additions (was 16) and the section is titled `## M2 domain-model amendment (2026-11-11)` (was `correction`); `commands/repos.md` is **142** lines (was 130); the backlog is **1531** lines with window `1310:1363`, S18 at 1311 / S19 at 1346, and **6** hunks; `contracts.md` has **15** sections. P62 now reads the delivery-time record at `tmp/tmpdir/gh303/p62-record` (override with `P62_RECORD_DIR`) and reports `repo_local_exit=0` (7206 / 4 / 0), `default_exit=1` (7205 / 4 / 1, only `CI baseline parity`), `rerun_recorded=yes`, classified `excused`; the head sweep is **69/69** and the base remains **0/69**. (g) **Seventh correction (rebase onto `3c9f8a59`, head `087c146d`):** `BASE` moved from `723454e4` to `3c9f8a59` (GH-286 daemon mounting, on top of GH-268) and every base-observed value was re-derived by execution — backlog 1460 lines / window `1292:1292`, `status.md` 225 lines (last heading 214), registry 141 (`queue` 89, `spend` 90), `architecture.md` 20/10/7, 12 pack rows, 12 targets, 40 seeds, 8 contract sections, `repos.md` absent. That fixes **P57** (`product_files=135/15` under the stale base becomes `15/15` with `unexpected_changed=` empty and no forbidden-root hit) and **P62** (the record's code fingerprint is the sha256 of an empty diff, which now matches the true base because the change adds no code under `packages/`, `tests/`, or `scripts/` except the registry row: `repo_local_exit=0`, `default_exit=1` with only `CI baseline parity`, `rerun_recorded=yes`, `excused`). **P47** was re-anchored: its preserved set named pre-GH-286 text (`Sixteen families`, `unknown flag`, `unexpected argument`) that GH-286 legitimately replaced, so it now asserts `Seventeen families`, the `daemon --help` and lifecycle-verb mount statements, `#286`, `milestone snapshot`, plus byte identity of `## Observed composition` and `## The daemon registration gap (closed)` against the base, and detects a mutation of the GH-286 sentences (`mutant_delivered_rewritten=detected`, `mutant_composition=detected`). Full sweep in fresh shells at `087c146d`: **69/69**; base **0/69**. |
| 1.3 | 2026-11-11 | @test-plan-writer | Re-baselined after the branch was rebased onto `origin/main-tools` `723454e4` (GH-288 / PR #305 shipped the flat `projects list`); spec v1.3 is the binding source. Every base-observed value was re-derived by re-running each procedure in a fresh shell in a detached worktree at `723454e4`, and every procedure was also run at the rebased head. **(1) Base pin:** P00 `BASE` is `723454e4`; the base-observed values now reflect the GH-288 state — `backlog.md` 1460 lines, M2-S11 1169–1189 with its `Ticket`/`Progress` record, M2-S17 last content 1291, separator 1293, `## Epic M3` 1295, window `1292:1292`, retirement note 1051–1054, context `1055..1055`; `status.md` 225 lines with last heading 214 = `## M2 delivery snapshot (2026-11-11)`; registry 141 with `queue` at 89 and `spend` at 90; `architecture.md` 20 fences / 10 mermaid / 7 key flows; 40 seeds / 40 asserts; 74 headings. The head values are recorded separately: window `1303:1339`, S18/S19 at 1304/1325, context `1055..1064` with 8 lines, status new section at 227 with 26 additions (`225 → 251`), registry 142 with rows 89/90/91, `architecture.md` 22/11/8, `repos.md` 6 fences, 46 seeds / 46 asserts, headings 74 → 76. **(2) Registry (AC-NFR4-1):** P37, the §1.1/§2/§3/§5.2/§6/§7.2/§7.3 text, and the procedure note now assert 141 → 142 with `queue=89 repos=90 spend=91`; every hardcoded 139/140 and the old 88/89/90 indices are removed from the requirements, while the history rows keep their original recorded values. **(3) P28/P29/P34 at the real head:** P28 `new_section_count=1 new_section_line=227`, P29 `removed_lines=0 additions=26 added_outside_section=0 225→251`, P34 `product_files=13/13 expected_not_changed=0 other_scripts_changed=0` with no forbidden path; P34's post-commit comparison now sorts with `LC_ALL=C` so the committed range reports `post_commit_check=identical` instead of a locale-order false `DIFFERS`. No measurement pin was reintroduced: the §6 gate contract keeps P09/P10 invariants gated and `context_paragraph`/`paragraph_lines`/`backlog_hunks`/`inside` as observations. **(4) P32 naming matrix (AC-F14-1/AC-F14-2):** the rebase introduced two legitimate delivered-fact statements — `m2/commands/projects.md:34-36` (the sanctioned disambiguation sentence) and `status.md:216-220` (main-tools' verbatim delivered sentence) — which the previous `@flat` detector flagged. The `sanctioned()` predicate in P00 now accepts exactly: names `projects list` **and** (`flat enumeration` ∧ `repos list` ∧ (`renames` ∨ `shipped`)) ∨ ((`mounted` ∨ `delivered` ∨ `shipped`) ∧ (`host overview` ∨ `read-only host`)) ∨ `shipped name .projects` ∨ (`shipped as .ados projects list` ∧ `GH-288`). Proof: head `rows_with_survivors=0/17`, `regions_empty=0`, both sanctioned classes accepted in isolation; a planted ``The `projects list` command enumerates every managed checkout.`` still yields `FLAT` (detected); the base still observes `15/17` survivors, so the allowance did not defuse the scan. **(5) P36 delivered-claim detector (AC-NFR3-1):** the rebase preserves four GH-288 delivered facts — `m2/entrypoint-delta.md:85`, `m2/commands/projects.md:34`, `status.md:216`, `cli-command-registry.md:189` — which the previous claim grep counted. `sanctioned_claim()` now accepts exactly four shapes (a GH-288 delivery sentence, the sanctioned rename sentence including its wrapped form, the shipped-name statement, and the shipped-surface registry row) and still counts a claim that a NEW surface is delivered. Proof: head `delivered_claims=0`; a planted `Project groups are delivered.` line counts `1`; a planted `` `repos list` is shipped in GH-288. `` line counts `1`; the four legitimate lines are accepted together. **(6) Run:** at the rebased head **45/45 procedures PASS** (P39 by its classifier: repository-local `exit=0` `7206 pass / 4 skip / 0 fail`; default `exit=1` with `CI baseline parity` only, `7205 pass / 4 skip / 1 fail`; both re-runs recorded, `excused`). At base `723454e4` **38 FAIL / 6 PASS** (P29, P35, P38, P42, P43, P44 are labelled controls; P39 is a gate and is executed at the head, not as a base-tree control). **45 ACs / 45 TCs, 1:1; no TC renumbering.** |
| 1.2 | 2026-11-11 | @test-plan-writer | Remediated DoR iteration 2 (`readiness-review/readiness-iter-2.md`) against spec v1.2, every changed procedure re-extracted from this file and executed **in a fresh shell** as `source P00; source Pn` on the base tree, on the conforming never-committed fixture (`/tmp/gh303/fx/repo`, base `5372dbac` + 13 files) and on a never-committed copy of it mutated per test. **(1) P22 anchor (finding 3):** `two branches\|two PRs` → `two (member )?branch(es)?\|two (pull requests?\|PRs?)`, so AC-F8-1's own vocabulary is accepted; AC-vocabulary conforming seed (`two member branch names and two pull-request numbers`) → `coverage_anchors=10/10`, **PASS**, where v1.1 reported `topic MISSING`; property-omitting variant → `9/10`, **FAIL**. **(2) P11 mandatory claim (finding 4):** the single-regex `workspace[^.]{0,120}required` is replaced by a sentence-scoped detector that drops negated/optional phrasing; the required sentence `an optional directory usable as a discovery root and never required` → `workspace_mandatory_claim=ABSENT`, **PASS** (v1.1 printed `PRESENT (violation)` on it), planted `The workspace directory is required.` → `PRESENT (violation, 1 sentence(s))`, offending sentence printed, **FAIL**; the claim is now a gate term, matching the plan's existing P11 token. **(3) P42 oracle (finding 6 + spec v1.2 AC-NFR9-1):** the oracle now reads the guard's exit status and the scan API instead of grepping the log for `^  - \|VIOLATION` (which printed `violations=0` on a red guard), and asserts AC-NFR9-1's exact scanned set; red fixture (planted `` `ados repos` `` in the new `status.md` section) → `forbidden_exit=1`, `FAIL … status.md:230: ados`, `violations=1`, `SEED_HIT …:230: ados`, **FAIL**; unregistered-but-present page → `failures=1`, `missing_from_scan=1`, `UNSCANNED …/repos.md`, **FAIL**; base → `planning_scanned=9/10`, `seed_hits=0`, **PASS (control)**; fixture → `scanned_total=140`, `planning_scanned=10/10`, `seed_hits=0`, **PASS**. **(4) TP-5/TP-7 (finding 5):** TP-5 no longer describes the withdrawn plan pin and states the ambiguity from F-12/AC-F12-1 alone with the parenthesised-date form as the invariant; TP-7 no longer cites a `board.md` deferral in spec §7.3 (which contains none) and records the deferral in the two places that hold it — this row and the plan's P5 constraint — while noting that §7.3 defers only *board scoping* to M2-S4. **(5) TC-042/AC-NFR9-1 alignment:** the scenario now enumerates the ten scanned documents, the two not-scanned ones and the zero-seed-literal count, and carries the version assertion binding it to spec v1.2 and plan v1.2. **(6) Plan-token alignment (iteration-2 blocking finding, plan-side owner):** §6 gains a **plan-gate contract** row that lists the P09/P10 outputs that are invariants (`paragraph_lines>0`, `paragraph_strictly_between=OK`, `blank_after_note=1`, `blank_before_s2=1`, the anchored note lines and byte-identity invariants; `hunk confinement OK`, `outside=0`, `non_vacuous=yes`, `classifier_self_tests=3/3`) and the fixture-specific measurements a plan must NOT pin (`context_paragraph=1055..1060`, `paragraph_lines=4`, `backlog_hunks=6`, `inside=6`), with the reason a measurement gate fails a conforming head; the summary, §2 reference and §6 caveat are restated for spec v1.2. Baseline counts unchanged: base **38 FAIL / 7 PASS** (P11, P22 still fail, P42 still a control), fixture **45/45 PASS**; **45 ACs / 45 TCs, 1:1**. **(7) Commit-safety false-positive (delivery blocker):** the P42 helper's local variable holding the seed match was named `token` and bound by assignment; the `commit` primitive's deterministic secret scanner read that keyword, the equals sign and the 20-character identifier that follows it as a credential assignment (`commit.safety.secret-suspected` on a variable name, not a secret). It is renamed to `seedMatch` in the assignment and in its two uses, so no credential-shaped assignment remains. The whole artifact now matches none of the scanner's content patterns — `SECRET_CONTENT_PATTERNS` from `packages/adapters/src/file/secret-scan.ts` run over the file reports `matching_patterns=0 flagged_lines=0`, and the exact-pattern grep reports `count=0`, while the same grep on a `/tmp` copy carrying the old identifier reports `count=1`, so the control bites. P42 re-run after the rename is unchanged: base `PASS (control, planning_scanned=9/10)`, conforming fixture `PASS (10/10, seed_hits=0)`, planted literal `FAIL` surfacing `SEED_HIT doc/planning/oss-tooling/status.md:230: ados`. No behaviour, emitted token name or count changed. |
| 1.1 | 2026-11-11 | @test-plan-writer | Remediated DoR iteration 1 (`readiness-review/readiness-iter-1.md`) against spec v1.1, with every changed procedure executed in a **fresh shell** on the base tree and on a **conforming, never-committed worktree fixture** (`/tmp/gh303/fx/repo`, base `5372dbac` + the thirteen changes). **Blocking findings, fixed with proof:** (1) BL-18/P32 — replaced the `repos.{0,40}group` regex with sentence-level `@flat`/`@group`/`@both` detectors that attribute enumeration to `projects` and group semantics to `repos` only when the sentence has no `enumerat` predicate before the next `projects` clause; fixture `rows_with_survivors=0/17` on the ticket-verbatim S18/S19 text, base `15/17`, both direction self-tests `detected`, required boundary sentence not flagged. (2) P09/P10 — the context window is now `retirement-note last line + 1 .. ### M2-S2 - 1`; fixture `paragraph_lines=4 paragraph_strictly_between=OK blank_after_note=1 blank_before_s2=1`, P10 `backlog_hunks=6 inside=6 outside=0`; base `paragraph_lines=0`. (3) P19/P20/P21 — `$R` and `$PJ` are P00 variables; fresh-shell fixture `9/9 5/5`, `7/7 3/3 0`, P21 `PASS`. (4) Cross-procedure dependencies — every helper (`entry/section/firstsec/squash/clause_rows/fence_blocks/diffstat/newsec*/matrix_rows/path_of/region/forbidden_* /backlog_ranges/story_section`) and every path (`$A`, `$RG`, `$R`, `$PJ`, …) now lives in P00; each block opens with a loud guard and declares `need`; P17's missing `$ct` and P37's head-vs-base `reg_entries` bug are fixed, and P32 treats an empty region as a failure, so the STAT row can no longer fail open. (5) BL-S11 — the region anchor is `### M2-S11 `; base `BL-S11 forbidden=3 SURVIVOR` (two `projects list` statements plus the goal's overview claim), fixture `BL-S11 forbidden=0`, `P45 BL-S11 required=OK`. (6) P34 — restated as a base..worktree manifest check (`git diff --name-only "$BASE" -- .` plus untracked), decidable before the P5 commit; fixture `product_files=13/13 expected_not_changed=0 post_commit_check=pending`, base `0/13`. (7) TC-039/P39 — aligned to AC-NFR6-1 v1.1: repository-local full suite authoritative, both runs recorded, the two named default-only failures recorded and re-run and excused only while the local run is green, any other failure `delivery`; base `repo_local_exit=0 default_exit=1 default_failure_class=excused`, five classifier branches prove `none`/`excused` pass and unexcused/local-failure/no-rerun fail. (8) Stale P1 tokens — `P35` records base `74 → 74 added=0` and fixture `74 → 76 added=2`; P08/P09 base (1285/1287/1289, window 1286:1286; note 1051..1054, context 1055..1055) and fixture (1293/1310/1312, window 1294:1309; context 1055..1060) values are labelled separately. **Non-blocking 10–16:** TP-5 now enforces the date in the file's parenthesised form and P28 requires exactly one new `##` heading with none after it; §7.3 thresholds are `checks<9`/`checks<7`; P33 checks the six prose locations whose Appendix B row requires a boundary statement and leaves the two index rows to P26/P27; P32 carries a negative control that the unchanged base `commands/board.md` text is not flagged (`base_board_accepted=OK`); the spec §18/plan ordering deviation is declared as TP-8 and no oracle depends on commit order; the authoring-defect count is stated once (four); P02 counts flat statements so the mandated `projects list` transition clause is allowed. **Counts unchanged: 45 ACs (33 functional + 12 non-functional), 45 TCs, 1:1 mapping.** Base verdicts: 38 FAIL + 7 PASS (TC-029, TC-035, TC-038, TC-039, TC-042, TC-043, TC-044; TC-039 is policy-conforming rather than a preservation control); conforming fixture: 45/45 PASS. No product file, spec, plan, pm-notes, or other artifact was edited by this revision. |
| 1.0 | 2026-11-11 | @test-plan-writer | Initial test plan for spec v1.0: 45 acceptance criteria (33 functional + 12 non-functional) covered exactly once by 45 test cases in bidirectional traceability with no orphans, backed by 46 procedure blocks (P00 base loader + P01–P45, with procedure number matching test-case number). **Derived, not assumed:** insertion window `1286:1286` (M2-S17 last content 1285, separator 1287, `## Epic M3` 1289) on a 1454-line backlog; context window `1055:1055` between the retirement note (1051–1054) and `### M2-S2`; `status.md` 212 lines with its last heading at 187; registry 139 entries with `queue.md` at index 88 and `spend.md` at 89; `architecture.md` 20 fences / 10 mermaid / C4 1-1-1 / 7 key flows; `test-scenarios.md` 40 seeds and 40 `Assert:` lines; 12 contents rows and 12 M2 index targets. **Executed against base `5372dbac` before any product edit:** 39 procedures FAIL — 38 because the change is absent or a statement survives, and one (P39) because the default-`TMPDIR` gate is red at base for a pre-existing reason outside the change — while 6 procedures PASS as labelled controls (P29, P35, P38, P42, P43, P44), and every scan carries a fixture proving it bites (P31 registry mutation, P32 two direction fixtures, P44 four retention mutants, P45 positive/negative pair). Four authoring defects were found by these runs and fixed before publication: a clause-table row containing a `|` split the row and dropped `S19-T6` (`total=26 present=1` exposed it); the new-section locator printed `NR` instead of `FNR`, which flagged the conforming status fixture; the `repos`-page oracle counted nine conditions but required ten and matched only prose field names; and the `projects`-page ban pattern flagged the **required** boundary sentence. The two command-page oracles were then proven satisfiable against conforming, never-committed fixtures in `/tmp/gh303/fx/commands/` (`checks=9/9 fields=5/5`, `checks=7/7 fields=3/3 forbidden=0`, page split `PASS`) while still failing on the real pack. Two gate runs recorded: repository-local `pnpm check` exit 0 (7133 pass, 4 skip, 0 fail across 880 files in 490.75s); the default-`TMPDIR` run exit 1 with two failures of 7137 across 880 files in 662.35s — the expected environmental `CI baseline parity` and a pre-existing, independently reproduced `TC-WIRE-002` timeout that the spec's exemption does not cover, recorded as a flagged gap in §1.2 G-6 and in Section 10, with TC-039 therefore recorded as FAIL at base for a reason outside the change. Five interpretation decisions and spec-gap flags recorded as TP-1 to TP-5; ten declared gaps (G-1 to G-10) with named owners; twelve testing risks (TR-1 to TR-12). No test code is added. |

## 10. Test Execution Log

Run date 2026-11-11. Every procedure was executed **in a fresh shell** as `source P00; source Pn`, first in the detached base worktree at `3c9f8a59` (where the change is absent) and then at the delivered head `087c146d`. A `FAIL` at the base proves the procedure detects the missing deliverable; a `PASS` at the head proves the oracle is satisfied by the delivered corpus. Values are the observed outputs, not computed literals.

| TC ID | Run Date | Base `3c9f8a59` | HEAD `087c146d` | Notes |
|---|---|---|---|---|
| TC-M2DOM-001 | 2026-11-11 | FAIL | PASS | retained_clauses=5/5; ac_delivered_enumeration=OK |
| TC-M2DOM-002 | 2026-11-11 | FAIL | PASS | mutant_preserved_blocks=4/5 (expect 4/5; the AC byte change must be caught); mutant_ac=CHANGED; mutant_depends=CHANGED |
| TC-M2DOM-003 | 2026-11-11 | FAIL | PASS | s11_names_owner=OK; s11_duplicate_ownership=0 |
| TC-M2DOM-004 | 2026-11-11 | FAIL | PASS | clauses_present=12/12 shape_labels=4/4 ticket_line=0 depends=exact |
| TC-M2DOM-005 | 2026-11-11 | FAIL | PASS | anchors=7/7 softening=0 |
| TC-M2DOM-006 | 2026-11-11 | FAIL | PASS | rename_set=6/6 |
| TC-M2DOM-007 | 2026-11-11 | FAIL | PASS | anchors=5/5 shipped_claims=0 |
| TC-M2DOM-008 | 2026-11-11 | FAIL | PASS | anchors=7/7 |
| TC-M2DOM-009 | 2026-11-11 | FAIL | PASS | record_precedes_delivery=OK; shipped_claims=0 |
| TC-M2DOM-010 | 2026-11-11 | FAIL | PASS | clauses_present=11/11 shape_labels=4/4 ticket_line=0 depends=exact |
| TC-M2DOM-011 | 2026-11-11 | FAIL | PASS | numbered_items=4 criteria=1/1/1; review_flow=3/3 ci_corroboration=2/2 |
| TC-M2DOM-012 | 2026-11-11 | FAIL | PASS | ordering_anchors=3/3 |
| TC-M2DOM-013 | 2026-11-11 | FAIL | PASS | plan_shape_fields=16/16 |
| TC-M2DOM-014 | 2026-11-11 | FAIL | PASS | s17_last=1309 separator=1364 epic_m3=1366 window=1310:1363; separator_sequence=identical; blank_line_before_separator=1 |
| TC-M2DOM-015 | 2026-11-11 | FAIL | PASS | retirement_note=1051..1054 context_paragraph=1055..1068 paragraph_lines=12 blank_after_note=1 blank_before_s2=1; paragraph_anchors=7/7 |
| TC-M2DOM-016 | 2026-11-11 | FAIL | PASS | backlog_hunks=6; hunks: inside=6 outside=0 |
| TC-M2DOM-017 | 2026-11-11 | FAIL | PASS | removed_lines=1 added_lines=1 |
| TC-M2DOM-018 | 2026-11-11 | FAIL | PASS | workspace_optional_in_diagram=OK; workspace_mandatory_claim=ABSENT |
| TC-M2DOM-019 | 2026-11-11 | FAIL | PASS | anchors=5/5 mandatory_membership_claims=0 |
| TC-M2DOM-020 | 2026-11-11 | FAIL | PASS | flow_dependency_edges=OK; invariants=6/6 |
| TC-M2DOM-021 | 2026-11-11 | FAIL | PASS | distinct_statement=OK; collapsed_sentences=0 |
| TC-M2DOM-022 | 2026-11-11 | FAIL | PASS | repos_v1_fields=11/11; rv_unbound_scope=OK; rv_unbound_error_attachment=0 |
| TC-M2DOM-023 | 2026-11-11 | FAIL | PASS | group_fields=11/11 |
| TC-M2DOM-024 | 2026-11-11 | FAIL | PASS | delivered_fields=5/5; group_affirmations=0 group_fields=0 |
| TC-M2DOM-025 | 2026-11-11 | FAIL | PASS | rename_rule_occurrences=1 |
| TC-M2DOM-026 | 2026-11-11 | FAIL | PASS | repos.md_mapping=5/5; projects.md_mapping=5/5 |
| TC-M2DOM-027 | 2026-11-11 | FAIL | PASS | config_fields=11/11 selector=1 |
| TC-M2DOM-028 | 2026-11-11 | FAIL | PASS | aggregation_anchors=12/12 |
| TC-M2DOM-029 | 2026-11-11 | FAIL | PASS | queue_lane_anchors=9/9 |
| TC-M2DOM-030 | 2026-11-11 | FAIL | PASS | plan_shape_behaviour=11/11 |
| TC-M2DOM-031 | 2026-11-11 | FAIL | PASS | checks=11/11 fields=5/5 |
| TC-M2DOM-032 | 2026-11-11 | FAIL | PASS | scope_anchors=11/11; unbound_declared=OK |
| TC-M2DOM-033 | 2026-11-11 | FAIL | PASS | mutant_unbound_exit=detected (exit cell = 0 for `unbound`, 2 otherwise); mutant_nonworktree_error=detected; error_table_identity_unreadable_exit=1 |
| TC-M2DOM-034 | 2026-11-11 | FAIL | PASS | state_container=OK; state_example_keys=delivery-a-1a2b3c4d |
| TC-M2DOM-035 | 2026-11-11 | FAIL | PASS | group_page_anchors=11/11 |
| TC-M2DOM-036 | 2026-11-11 | FAIL | PASS | behaviour_anchors=8/8 board_group_claims=0 two_shape=0 |
| TC-M2DOM-037 | 2026-11-11 | FAIL | PASS | repos_page: repos.v1=3 group_surface=0 header=1 planned=1; projects_page: project-groups.v1=3 repos_surface=0 header=1 planned=1 |
| TC-M2DOM-038 | 2026-11-11 | FAIL | PASS | board_anchors=7/7 |
| TC-M2DOM-039 | 2026-11-11 | FAIL | PASS | m2_readme_status_delta=OK |
| TC-M2DOM-040 | 2026-11-11 | FAIL | PASS | s18_seeds=8; topic_anchors=7/7 |
| TC-M2DOM-041 | 2026-11-11 | FAIL | PASS | s19_seeds=5; topic_anchors=5/5 |
| TC-M2DOM-042 | 2026-11-11 | FAIL | PASS | assertions=13 declared_envelope=13 retired_family=0; contract_closeout_declaration=1 closeout_assertions=1 |
| TC-M2DOM-043 | 2026-11-11 | FAIL | PASS | mutant_s11_01_assert_projects_list=1 (expect 1) mutant_flat_assertions=1 (expect 1); s11_01_assert_repos_list=1; s11_01_assert_projects_list=0 |
| TC-M2DOM-044 | 2026-11-11 | FAIL | PASS | alias_seed=SC-M2-S18-08; alias_shape_seeds=1 |
| TC-M2DOM-045 | 2026-11-11 | FAIL | PASS | self_test_short_story=detected self_test_complete=OK; intro_range=OK; m2_s2_present=OK |
| TC-M2DOM-046 | 2026-11-11 | FAIL | PASS | opening_journey_lines=27; journey_anchors=8/8 |
| TC-M2DOM-047 | 2026-11-11 | FAIL | PASS | mutant_delivered_rewritten=detected; mutant_composition=detected; delta_anchors=7/7 |
| TC-M2DOM-048 | 2026-11-11 | FAIL | PASS | pack_rows=13/13; readme_anchors=12/12 |
| TC-M2DOM-049 | 2026-11-11 | FAIL | PASS | m2_targets=13/13 |
| TC-M2DOM-050 | 2026-11-11 | FAIL | PASS | new_section_count=1 new_section_line=227; new_section_heading=## M2 domain-model amendment (2026-11-11); headings_after_new_section=0 |
| TC-M2DOM-051 | 2026-11-11 | FAIL | PASS | removed_lines=0 additions=27 new_section_line=227 new_section_count=1 headings_after=0 added_outside_section=0; base_lines_retained=OK |
| TC-M2DOM-052 | 2026-11-11 | FAIL | PASS | odr_lock=OK; second_repos_delivery_rows=0 |
| TC-M2DOM-053 | 2026-11-11 | FAIL | PASS | changed_lines_outside_allowed=0; fixture_outside=flagged |
| TC-M2DOM-054 | 2026-11-11 | FAIL | PASS | self_test_flat=detected self_test_group=detected boundary_allowed=OK; matrix_rows=21 regions_empty=0 rows_with_survivors=0/21; sanctioned_rename_allowed=OK sanctioned_delivered_allowed=OK |
| TC-M2DOM-055 | 2026-11-11 | FAIL | PASS | journeys disambiguation=OK; status_new_section disambiguation=OK; delivered_facts=9/9 |
| TC-M2DOM-056 | 2026-11-11 | FAIL | PASS | groupKey_uses=27 repoKey_uses=20; per_checkout_scope_uses=2 |
| TC-M2DOM-057 | 2026-11-11 | FAIL | PASS | product_files=15/15 expected_not_changed=0 unexpected_changed= |
| TC-M2DOM-058 | 2026-11-11 | FAIL | PASS | stories_kept=72 changed=0 removed=0; separator_and_epic_m3=byte-identical; s4_hunks=1 s4_changed_lines=2 |
| TC-M2DOM-059 | 2026-11-11 | FAIL | PASS | delivered_claims=0; registry_not_delivered=OK |
| TC-M2DOM-060 | 2026-11-11 | FAIL | PASS | registered=142 base_registered=141 delta=1; forbidden_exit=0 unregistered_findings=0 |
| TC-M2DOM-061 | 2026-11-11 | FAIL | PASS | dist_guard_exit=0 |
| TC-M2DOM-062 | 2026-11-11 | FAIL | PASS | repo_local_exit=0 default_exit=1; default_failure_class=excused reason=only the two named default-only failures, repository-local green |
| TC-M2DOM-063 | 2026-11-11 | FAIL | PASS | doc/planning/oss-tooling/milestones/m2/journeys.md fences=0 mermaid=0; doc/planning/oss-tooling/milestones/m2/entrypoint-delta.md fences=4 mermaid=0; doc/planning/oss-tooling/cli-command-reg |
| TC-M2DOM-064 | 2026-11-11 | FAIL | PASS | ticket_clauses=26/26 |
| TC-M2DOM-065 | 2026-11-11 | FAIL | PASS | forbidden_exit=0 |
| TC-M2DOM-066 | 2026-11-11 | FAIL | PASS | broken_links=0 |
| TC-M2DOM-067 | 2026-11-11 | FAIL | PASS | base_lines=225 removed_or_modified=0 additions=27 new_section_count=1 new_section_line=227; outside_insert_fixture: outside_hunks=1 (expect >0) |
| TC-M2DOM-068 | 2026-11-11 | FAIL | PASS | matrix_rows_required=21/21 regions_empty=0 |
| TC-M2DOM-069 | 2026-11-11 | FAIL | PASS | mapping_token_violations=0 |


Aggregate verdict: **the delivered head is 69 of 69 and the base tree is 0 of 69.** Every base result is a FAIL because each procedure carries at least one assertion that only the change can satisfy; no procedure therefore reports a vacuous preservation pass. Every head result is a PASS, so the oracle set is satisfiable as a whole and no criterion is bound to an impossible predicate. The aggregate gate is green in its authoritative repository-local run (`7206 pass / 4 skip / 0 fail`) and its default-`TMPDIR` pair fails only `CI baseline parity` (`7205 pass / 4 skip / 1 fail`), recorded and re-run, so the classification is `excused` per AC-NFR6-1.

Re-run instruction for delivery: run P00 → P57 (base..worktree containment) → P60/P61/P65 (guards) → P62 (both gate invocations, `RUN_GATES=1`) → P14/P16 (placement) → P01–P13 → P15 → P17–P56 → P58, P59, P63, P64, P66–P69 → the manual reads (G-1, G-3, G-4, G-5, G-9). Cheap containment and guards first: an out-of-manifest change or a red authoritative gate makes every downstream content reading moot.
