---
id: chg-GH-303-test-plan
status: Updated
version: 1.1
created: 2026-11-11T11:40:00Z
last_updated: 2026-11-11T12:40:00Z
owners: [engineering]
service: delivery-os-planning
labels: [change, docs, planning]
version_impact: none
summary: "Docs-only verification of the M2 domain-model amendment against spec v1.1: 33 functional and 12 non-functional acceptance criteria bound one-to-one to 45 test cases and 45 executable procedures (plus a P00 shared preamble) whose oracles are diff predicates, line-retention comparisons, section-scoped content scans, the Appendix B naming-boundary matrix with sentence-level semantic detectors, the two doc guards with their opposite TMPDIR requirements, the 139-to-140 forbidden-literals registration, and a structural mermaid read; thirteen product files change (twelve planning documents: 11 modified plus the new commands/repos.md, plus the guard registry row). Every procedure was run in a fresh shell against base 5372dbac and every changed procedure was also run against a conforming never-committed worktree fixture at 5372dbac with the thirteen changes applied, so each base-observed failure and each fixture-derived post-change expectation is recorded separately rather than assumed; the fixture is the source of the post-change literals (Epic M2 window opens at S17's last line + 1, context paragraph paragraph_lines=4, backlog headings 74 to 76, registry 139 to 140)."
links:
  change_spec: ./chg-GH-303-spec.md
  implementation_plan: ./chg-GH-303-plan.yaml
  testing_strategy: ../../../../.ai/rules/testing-strategy.md
---

# Test Plan - Amend the M2 plan: three-level domain model with project groups, optional workspaces, and cross-repository changes

## 1. Scope and Objectives

This change writes planning truth, so the risk is documentary and the only honest oracle is the diff: a story can lose a clause while reading complete, a rename can land on nine pages and miss the tenth, a "rewritten" page can quietly keep the meaning it was rewritten to remove, a status snapshot can rewrite history instead of appending to it, and a registry row can be added one line away from its sorted position and still pass a human glance. Every acceptance criterion is therefore bound to exactly one runnable procedure with a stated expected result, and every preservation claim is a byte comparison or a whole-file line-retention comparison against `5372dbac` rather than a reading impression.

The two properties this plan exists to protect are **the naming boundary** (`repos` enumerates managed checkouts, `projects` groups them) and **the retention of everything else** (M2-S11's state-scoping and collision clauses, every other backlog story, every earlier status snapshot, every registry row, the M0/M1 index rows, and the pack's planned-until-exit statement). The most likely regressions are a half-rename (spec RSK-1), a stray insertion below the Epic M2 separator (RSK-2), a `projects.v1` field that means two things (RSK-3), and a status snapshot that rewrites instead of appending (RSK-10).

The plan was executed against the pre-change tree before any product edit: every new-content procedure fails because the change is absent, every preservation procedure passes as a control, and every scan carries a mutation self-test so a green control is not mistaken for evidence that the work is done.

### 1.1 In Scope

- `doc/planning/oss-tooling/backlog.md`: the in-place M2-S11 amendment (rename to `repos list`, five reported fields, conditional deprecation alias, retained state-scoping/host-index/migration/test/collision clauses and the `- Depends on: M0-S5, M1-S17.` line), the M2-S18 and M2-S19 entries, and the one new Epic M2 context paragraph between the retirement note and `### M2-S2`.
- `doc/planning/oss-tooling/milestones/m2/architecture.md`: the three-level model in the C4 Level 1 context with workspace optionality visible in the diagram, the project-scoped `### Multi-repository overview` flow, the new `### Cross-repository change` flow, and four added boundary invariants — under the structural diagram read (fence balance, fence tag, keyword first line, C4 heading counts, 8 `###` headings under `## Key flows` each owning one block).
- `doc/planning/oss-tooling/milestones/m2/contracts.md`: `## repos.v1` (flat enumeration, owned by the amended M2-S11), the redefined `## projects.v1` group envelope with per-member fields and the project scope, the project configuration schema with mixed tracker kinds and the `not-yet-supported` classification, and the cross-repository change plan shape.
- `doc/planning/oss-tooling/milestones/m2/commands/repos.md` (**new**) and `commands/projects.md` (**rewritten in place**): the flat enumeration and the group surface as two pages, both keeping the exact header `Status: Proposed (M2)` and neither claiming registration at the root listing.
- `doc/planning/oss-tooling/milestones/m2/test-scenarios.md`: at least two `SC-M2-S18-*` and two `SC-M2-S19-*` seeds with exactly one `Assert:` line each, and both `SC-M2-S11-*` seeds amended to the `repos list` surface.
- `doc/planning/oss-tooling/milestones/m2/journeys.md`: the opening journey rewritten as a project-scoped morning overview (one member outside any shared directory, workspace optionality stated, same-ref disjointness kept).
- `doc/planning/oss-tooling/milestones/m2/entrypoint-delta.md`: the M2-planned additions split into `repos` (flat enumeration) and `projects` (group surface), and the mounting paragraph naming both families; the observed composition, the daemon gap with `#286`, and the snapshot statement preserved.
- `doc/planning/oss-tooling/milestones/m2/README.md` and `milestones/README.md`: the contents row for `commands/repos.md`, the story-to-artifact rows for M2-S18 and M2-S19 with the M2-S11 row pointing at `repos.v1`, and the M2 index row at thirteen targets with M0/M1 byte-identical.
- `doc/planning/oss-tooling/status.md`: one new dated planning section, under a whole-file line-retention oracle (no base line removed, reordered, or modified; additions confined to the one new section).
- `doc/planning/oss-tooling/cli-command-registry.md`: the `ados repos` M2 row, the redefined `ados projects` row, the reconciled M3-S6 row, and the replaced boundary note, with every other row byte-identical.
- `scripts/checks/forbidden-literals.registry.json`: exactly one added registration (139 → 140) between the `queue.md` and `spend.md` entries.
- Repository guards: `bash scripts/.tests/test-doc-distribution.sh` with the **default** `TMPDIR` (exit 0), `bun run scripts/checks/forbidden-literals.ts` (0 violations, 0 unregistered docs), and `pnpm check` with a **repository-local** `TMPDIR` (full suite, exit 0, authoritative), with both aggregate runs recorded and the two named default-only failures (`ci-baseline-parity` and the `TC-WIRE-002` timeout) excused only while the repository-local run is green on the same head.

### 1.2 Out of Scope & Known Gaps

- **G-1 — clause presence is mechanical; clause meaning is not.** AC-F2-1, AC-F3-1, and AC-NFR8-1 require 26 ticket clauses "with unchanged meaning". P03, P05, and P41 run a 26-row anchor table built from spec Appendix A; a missing anchor fails with its clause id and short clause. An anchor proves the clause text exists and its vocabulary survived, not that its normative force is identical. **Compensation:** `@readiness-reviewer` and `@reviewer` paraphrase-read the two new entries and the M2-S11 amendment against GH-303 using the 26-row table as the checklist. Owner: `@reviewer` at phase 8.
- **G-2 — the mixed-tracker rule is checked by vocabulary, not by semantics.** AC-F2-2 requires "accepted at validation time … classified not-yet-supported rather than rejected silently". P04 asserts the token `not-yet-supported`, the validation-time wording, the "rather than rejected" clause, and the absence of a softening phrase in both the S18 entry and the contracts. A grammatically inverted sentence reusing the tokens would pass. **Compensation:** the reviewer reads AC-F2-2's two locations once (RSK-4). Owner: `@reviewer`.
- **G-3 — mermaid syntax validity is not testable in this repository.** No validator exists and NFR-7 adds none. P40 proves structure only: fence counts even per touched file, every diagram fence tagged `mermaid`, every first body line starting with `flowchart`/`graph`/`sequenceDiagram`/`classDiagram`/`stateDiagram-v2`, `## C4 Level 1/2/3` exactly once each, and exactly 8 `###` headings under `## Key flows` each owning exactly one mermaid block (7 at base, one added). A syntactically broken diagram satisfying those conditions is not caught. **Compensation:** the reviewer opens the rendered GitHub preview of `architecture.md` (RSK-9). Owner: `@reviewer`.
- **G-4 — the naming-boundary scan is pattern-based.** P32 (forbidden half, Appendix B walked as 17 regions plus a corpus scan) and P45 (required half) match the vocabulary this plan knows. A page that says something flat about checkouts in words the matrix does not anticipate survives. **Compensation:** the reviewer walks Appendix B by hand and reads the diff of the twelve documents; the scan's scope is declared so the residue is bounded, not denied (RSK-1). Owner: `@reviewer`.
- **G-5 — status-section content quality is review.** P28 proves the new section exists, is unique, carries the six required anchors, and claims no delivery; P29/P44 prove nothing was removed, reordered, or modified and that additions sit inside it. Neither proves the prose is accurate. **Compensation:** the reviewer reads the new section against F-12 and DEC-6. Owner: `@reviewer`.
- **G-6 — the two guards have opposite `TMPDIR` requirements in this environment.** `scripts/.tests/test-doc-distribution.sh` needs the default `TMPDIR`; `pnpm check` needs a repository-filesystem `TMPDIR` because `tests/checks/ci-baseline-parity.test.ts` runs `git clone --local`, which fails with a cross-device hardlink when `tmpdir()` is tmpfs. P38 runs the distribution guard with `env -u TMPDIR`. P39 follows spec v1.1 AC-NFR6-1 exactly: the repository-local full-suite run is authoritative and must exit 0; both runs are recorded; a default-run `ci-baseline-parity` failure and a default-run `TC-WIRE-002` 5000 ms timeout are each recorded and re-run and are excused **only** while the repository-local run is green on the same head; any other default-run failure, or a `TC-WIRE-002` repeat inside the repository-local run, is a delivery failure (DEC-16, RSK-7). Owner: `@runner` at phase 9. **Observed at base:** the default-`TMPDIR` run exits 1 with exactly those two named failures (`CI baseline parity (hermetic partial clone)` and `TC-WIRE-002`), and the repository-local full-suite run exits 0; both are recorded, the standalone re-runs are recorded in P39's re-run record, and the pair is therefore classified `excused` rather than reclassified as environmental. A repeat of `TC-WIRE-002` inside the authoritative run is a delivery failure and must be escalated to the ticket owner as a gate defect.
- **G-7 — `pnpm check` proves no-regression, not document correctness.** It can stay green while a story loses a clause or a page keeps the wrong meaning. It is a containment gate; the content procedures carry the requirements.
- **G-8 — passing preservation controls are not evidence of delivery.** P29, P35, P38, P42, P43, and P44 pass their retention, guard, link, or soundness halves on the pre-change tree. They become evidence only together with the failing new-content procedures and the mutation self-tests; Section 10 labels them `PASS (control)`.
- **G-9 — prose quality of the architecture, contracts, journeys, and seeds is review, not a command.** The procedures prove required sections, fields, flows, counts, and one-`Assert:`-per-seed shape; they do not prove the design is coherent or that a seed is the right seed. **Compensation:** the reviewer reads `architecture.md`, `contracts.md`, `test-scenarios.md`, and `journeys.md` against the spec's Appendix B row descriptions. Owner: `@reviewer`.
- **G-10 — containment is decidable before the P5 commit.** P34 compares the base revision with the **working tree** (one-dot `git diff --name-only "$BASE" -- .`, plus untracked product files from `git ls-files --others --exclude-standard`), filtered to product files and compared against the 13-path manifest in both directions. That makes the P5 gate decidable at the boundary it gates and still non-vacuous (`product_files=0/13` is a missing deliverable). The committed range (`"$BASE"...HEAD`) is reported separately as a post-commit verification step, not as the gate. Every other containment check in this plan (forbidden roots, `other_scripts_changed`) uses the same base..worktree set.
- **Not applicable:** unit, integration, contract-execution, E2E, performance, migration, telemetry, and security-surface testing. There is no runtime code path, schema, or emitted artifact; the spec declares no API or event surface (spec §8.1, §8.2). Per `.ai/rules/testing-strategy.md`, a `doc/**` change uses static/diff and content checks plus the repository guards, and adds no committed test code — NFR-1 forbids touching `tests/**`, `.ai/**`, and any `scripts/**` path except the one registry row.

## 2. References

| Reference | Role in this plan |
|---|---|
| [`chg-GH-303-spec.md`](./chg-GH-303-spec.md) v1.1 | Binding source: F-1..F-14, 33 functional + 12 non-functional ACs (45), NFR-1..NFR-12, DM-1..DM-8, DEC-1..DEC-17, RSK-1..RSK-12, Appendix A (26-clause fidelity oracle), Appendix B (16-row naming matrix, walked as 17 regions), Appendix C (13-file manifest), Appendix D (gate evidence) |
| [`chg-GH-303-pm-notes.yaml`](./chg-GH-303-pm-notes.yaml) | Binding intake decisions: docs-only autonomous delivery, the `repos`/M3-S6 name resolution, the entrypoint-delta reading, the derived index and registry scope, the flat-envelope contract name, and the recorded repository facts (separator structure, guards, `TMPDIR` behaviour) |
| GH-303 ticket (`juliusz-cwiakalski/agentic-delivery-os#303`) | Normative story text transcribed into spec Appendix A; read at authoring time and re-read by the reviewer for the paraphrase pass (G-1) |
| [`.ai/rules/testing-strategy.md`](../../../../.ai/rules/testing-strategy.md) | Docs-only fallback: static/diff plus content checks; branch-diff checks belong to review and PR-time gates, never to the permanent suite |
| [`backlog.md`](../../../planning/oss-tooling/backlog.md) | File under test (M2-S11 amendment, M2-S18/M2-S19, context paragraph, preservation regions) |
| [`status.md`](../../../planning/oss-tooling/status.md) | File under test (new dated section under the line-retention oracle) |
| [`cli-command-registry.md`](../../../planning/oss-tooling/cli-command-registry.md) | File under test (rows, boundary note, row-level containment) |
| [`milestones/README.md`](../../../planning/oss-tooling/milestones/README.md) | File under test (M2 index row at thirteen targets; M0/M1 rows preserved) |
| [`milestones/m2/`](../../../planning/oss-tooling/milestones/m2/) | The pack: README, architecture, contracts, test-scenarios, journeys, entrypoint-delta, `commands/{projects,attempts,events,spend,queue,board}.md`, plus the new `commands/repos.md` |
| [`scripts/.tests/test-doc-distribution.sh`](../../../../scripts/.tests/test-doc-distribution.sh) | Distribution-marker guard (AC-NFR5-1); default `TMPDIR` required |
| [`scripts/checks/forbidden-literals.ts`](../../../../scripts/checks/forbidden-literals.ts) and [`forbidden-literals.registry.json`](../../../../scripts/checks/forbidden-literals.registry.json) | Forbidden-literal guard and the `registered` list that must grow 139 → 140 (AC-NFR4-1, AC-NFR9-1) |
| [AGENTS.md](../../../../AGENTS.md) | Branch model (`main-tools`), docs-only delivery rules, and the marker/registration conventions |

## 3. Coverage Overview

### 3.1 Functional Coverage (F-#, AC-#)

Forward traceability: every acceptance criterion appears exactly once, and every test case maps to exactly one acceptance criterion.

| AC ID | Requirement (condensed) | TC ID | Status |
|---|---|---|---|
| AC-F1-1 | M2-S11 amended in place: retained state-scoping/host-index/migration/test/collision clauses and depends line; goal, enumeration task, and enumeration AC name `repos list` with the five fields; conditional deprecation alias recorded | TC-M2DOM-001 | Covered |
| AC-F1-2 | Inside the amended entry: no `projects list` enumeration surface, no group-meaning `repos list`, and no retained clause weakened, merged, or moved | TC-M2DOM-002 | Covered |
| AC-F2-1 | `### M2-S18 Project groups` carries Goal/Tasks/AC/Depends-on and all 12 Appendix A clauses, with no `- Ticket:` line and no added criterion | TC-M2DOM-003 | Covered |
| AC-F2-2 | The mixed-tracker clause reads "accepted at validation time … not-yet-supported rather than rejected silently" in both the S18 entry and the contracts, with no softening | TC-M2DOM-004 | Covered |
| AC-F3-1 | `### M2-S19 Cross-repository changes` carries Goal/Tasks/AC/Depends-on with all 11 Appendix A clauses and `- Depends on: M2-S11, M2-S18, M1-S17.` | TC-M2DOM-005 | Covered |
| AC-F3-2 | The three S19 acceptance criteria are independently identifiable (one spec/two branches/two PRs/one review flow/closeout; per-member CI corroboration; failing member blocks the shared DoD and is named) | TC-M2DOM-006 | Covered |
| AC-F3-3 | The contracts' change plan shape covers all six S19 task clauses plus the shared DoD and per-member closeout | TC-M2DOM-007 | Covered |
| AC-F4-1 | The two new entries sit after M2-S17's last line, inside the block, before the blank line and `---` separator, with the separator sequence and `## Epic M3` byte-identical | TC-M2DOM-008 | Covered |
| AC-F4-2 | One new context paragraph between the retirement note and `### M2-S2` carries the three levels, the boundary, and the root-family consequence; frontmatter, reading guide, principles, note, and other stories byte-identical | TC-M2DOM-009 | Covered |
| AC-F4-3 | With zero context, every backlog hunk lies in the S11 entry, the context paragraph, or one of the two new entries | TC-M2DOM-010 | Covered |
| AC-F5-1 | C4 Level 1 presents repository, project, and workspace as three related levels with workspace optionality visible in the diagram and prose | TC-M2DOM-011 | Covered |
| AC-F5-2 | Architecture prose: membership declared in configuration, workspace never required, unrelated-directory projects identical, no member required inside a workspace | TC-M2DOM-012 | Covered |
| AC-F5-3 | The overview flow is project-scoped; `### Cross-repository change` exists; boundary invariants carry the naming boundary, declared membership, workspace optionality, and one lifecycle | TC-M2DOM-013 | Covered |
| AC-F6-1 | `repos.v1` is named, owned by M2-S11, and defines repo key, root, state location, daemon reachability with degradation reason, handover state, and host index revision | TC-M2DOM-014 | Covered |
| AC-F6-2 | `projects.v1` is the group envelope: group identity and name, members with repo key/root/tracker kind/state/health, optional workspace root, project scope for queue and status; no group-named key denotes a repository | TC-M2DOM-015 | Covered |
| AC-F6-3 | Project configuration schema: project, member repositories, tracker kind per member, optional workspace discovery root, mixed kinds valid at validation, `not-yet-supported` classification, no-workspace configuration valid and identical | TC-M2DOM-016 | Covered |
| AC-F6-4 | Cross-repository change plan shape declares members and slices, per-member branch and PR, per-member gates, one shared DoD, per-member closeout, dependency edges, and evidence enumerating every member PR | TC-M2DOM-017 | Covered |
| AC-F6-5 | Contracts state that consumers of `projects.v1` read the group envelope, and the M2-S4 map row carries the advisory note instead of a new dependency edge | TC-M2DOM-018 | Covered |
| AC-F7-1 | `commands/repos.md` carries the header, bare name, `repos list [--json]`, five fields, `repos[]` envelope, exit codes, an example, an error table, see-also links, and the rename note | TC-M2DOM-019 | Covered |
| AC-F7-2 | `commands/projects.md` is the group surface (members with health and state, project scope, pointers to `projects.v1` and the configuration schema, naming boundary) and never claims to enumerate checkouts | TC-M2DOM-020 | Covered |
| AC-F7-3 | Page split: the flat surface only on the `repos` page, the group surface only on the `projects` page, each pointing at its own contract, both planned and unregistered | TC-M2DOM-021 | Covered |
| AC-F8-1 | At least two `SC-M2-S18-*` and two `SC-M2-S19-*` seeds, one `Assert:` line each, covering discovery via a registered workspace directory, no-workspace equivalence, group listing, project-scoped queue and status, mixed-tracker classification, and the cross-repository lifecycle plus the failing-member block | TC-M2DOM-022 | Covered |
| AC-F8-2 | Both `SC-M2-S11-*` seeds use `repos list` (title, prose, assert line, five fields) and no seed asserts that `projects list` enumerates checkouts | TC-M2DOM-023 | Covered |
| AC-F9-1 | The opening journey is a project-scoped morning overview using `repos list` for the flat view and `projects list` for the group view, with scoped reads, workspace optionality stated, and same-ref disjointness | TC-M2DOM-024 | Covered |
| AC-F10-1 | The delta note lists `repos` (flat) and `projects` (group) as two additions, the mount paragraph names both families, `projects` is no longer the host overview, and the observed composition, daemon gap, and snapshot statement survive | TC-M2DOM-025 | Covered |
| AC-F11-1 | `m2/README.md` carries the `commands/repos.md` contents row, map rows for M2-S18 and M2-S19, the S11 row on `repos.v1`, and the unchanged planned-until-exit statement | TC-M2DOM-026 | Covered |
| AC-F11-2 | The `milestones/README.md` M2 row links thirteen targets including `m2/commands/repos.md`, with the M0 and M1 rows byte-identical | TC-M2DOM-027 | Covered |
| AC-F12-1 | One new dated status section records the three-level model, the S11 amendment with its transition note, S18/S19 with dependencies, the naming boundary with its registry reconciliation, and the corrected delta note, claiming no delivery or exit | TC-M2DOM-028 | Covered |
| AC-F12-2 | Every base `status.md` line is present, in order, byte-identical, and every added line lies inside the one new dated section | TC-M2DOM-029 | Covered |
| AC-F13-1 | Registry: the M2 `ados repos` row (flat enumeration, five fields, M2-S11), the `ados projects` row (group surface, M2-S18), the M3-S6 row attributing hygiene to `repos` subcommands delivered later, and a boundary note stating the naming boundary | TC-M2DOM-030 | Covered |
| AC-F13-2 | Only the `ados projects` row, the M3-S6 row, the boundary note, and the one added `ados repos` M2 row differ; every other row and the historical rename note are byte-identical | TC-M2DOM-031 | Covered |
| AC-F14-1 | Zero occurrences of `projects list`/`projects` denoting the flat enumeration and zero of `repos list`/`repos` denoting a group across the twelve documents; every Appendix B forbidden statement absent | TC-M2DOM-032 | Covered |
| AC-F14-2 | Every location that names both surfaces states the boundary once in the same terms and no two pages give the names contradictory meanings | TC-M2DOM-033 | Covered |
| AC-NFR1-1 | Exactly 13 product files change (12 planning incl. one new + 1 registry) and no file outside the manifest, with zero changes under `doc/spec`, `doc/overview`, `doc/guides`, `doc/templates`, `packages`, `tests`, `.opencode`, `.ai`, or other `scripts` paths | TC-M2DOM-034 | Covered |
| AC-NFR2-1 | Backlog preservation: all headings except the two new entries byte-identical, every story except M2-S11 byte-identical, frontmatter/reading guide/principles/retirement note/separator/`## Epic M3` byte-identical, 0 codes renamed, reordered, or removed | TC-M2DOM-035 | Covered |
| AC-NFR3-1 | Both command pages carry the exact header, zero delivered claims for the three planned surfaces, the pack's planned-until-exit statement verbatim, and no page relabelled as a snapshot | TC-M2DOM-036 | Covered |
| AC-NFR4-1 | `registered` grows 139 → 140 with `.../m2/commands/repos.md` between the `queue.md` and `spend.md` entries, no duplicates, and the guard reporting 0 unregistered docs and 0 violations | TC-M2DOM-037 | Covered |
| AC-NFR5-1 | `bash scripts/.tests/test-doc-distribution.sh` exits 0 under the default `TMPDIR`, and no planning document carries an `ados_distribution` marker | TC-M2DOM-038 | Covered |
| AC-NFR6-1 | Both aggregate runs recorded; the repository-local full-suite run is authoritative and must exit 0 (any failure there, including a repeated `TC-WIRE-002`, is a delivery failure); a default-run `ci-baseline-parity` failure and a default-run `TC-WIRE-002` timeout are each recorded, re-run, and excused only while the repository-local run is green on the same head; any other default-run failure is a delivery failure | TC-M2DOM-039 | Covered |
| AC-NFR7-1 | Structural diagram read: even fence counts, `mermaid` tags, allowed keyword first lines, C4 1/2/3 exactly once, and 8 `###` headings under `## Key flows` each owning one block, with no new tooling | TC-M2DOM-040 | Covered |
| AC-NFR8-1 | 26 of 26 ticket clauses present with unchanged meaning; 0 missing, 0 added, 0 changed in substance | TC-M2DOM-041 | Covered |
| AC-NFR9-1 | The forbidden-literals guard reports zero violations and no private fleet, repository, host, hosted, or proprietary name appears in new or changed text | TC-M2DOM-042 | Covered |
| AC-NFR10-1 | Zero broken relative links across the touched documents and zero pack documents restating a story's acceptance block | TC-M2DOM-043 | Covered |
| AC-NFR11-1 | In `status.md`: zero base lines removed, reordered, or modified; additions only inside the new section; a whole-file retention comparison; no whole-section `cmp` asserted | TC-M2DOM-044 | Covered |
| AC-NFR12-1 | Mechanical naming scan: 0 flat-`projects list` occurrences, 0 group-meaning `repos` occurrences, 100% of Appendix B's rows in their required state (16 rows, 17 regions) | TC-M2DOM-045 | Covered |

Coverage note — two deliberate splits where the spec states one property twice. **AC-F12-2 vs AC-NFR11-1:** both govern `status.md` line retention; TC-029 owns presence-and-order (nothing lost, additions confined to the derived new section) while TC-044 owns byte-identity, the confinement arithmetic, and the oracle's own soundness (four mutation fixtures proving a delete, a modify, a swap, and an outside insertion are each detected). Counting them as one surface would leave the oracle unproven. **AC-F3-3 vs AC-F6-4:** both name the contracts' cross-repository change plan shape; TC-007 traces each of the six S19 task clauses plus the shared DoD and per-member closeout into the contracts, while TC-017 asserts the shape's seven declared elements as fields. The overlap is declared rather than counted as two independent surfaces.

Reverse traceability (no orphan test cases):

| TC ID | AC ID | TC ID | AC ID |
|---|---|---|---|
| TC-M2DOM-001 | AC-F1-1 | TC-M2DOM-024 | AC-F9-1 |
| TC-M2DOM-002 | AC-F1-2 | TC-M2DOM-025 | AC-F10-1 |
| TC-M2DOM-003 | AC-F2-1 | TC-M2DOM-026 | AC-F11-1 |
| TC-M2DOM-004 | AC-F2-2 | TC-M2DOM-027 | AC-F11-2 |
| TC-M2DOM-005 | AC-F3-1 | TC-M2DOM-028 | AC-F12-1 |
| TC-M2DOM-006 | AC-F3-2 | TC-M2DOM-029 | AC-F12-2 |
| TC-M2DOM-007 | AC-F3-3 | TC-M2DOM-030 | AC-F13-1 |
| TC-M2DOM-008 | AC-F4-1 | TC-M2DOM-031 | AC-F13-2 |
| TC-M2DOM-009 | AC-F4-2 | TC-M2DOM-032 | AC-F14-1 |
| TC-M2DOM-010 | AC-F4-3 | TC-M2DOM-033 | AC-F14-2 |
| TC-M2DOM-011 | AC-F5-1 | TC-M2DOM-034 | AC-NFR1-1 |
| TC-M2DOM-012 | AC-F5-2 | TC-M2DOM-035 | AC-NFR2-1 |
| TC-M2DOM-013 | AC-F5-3 | TC-M2DOM-036 | AC-NFR3-1 |
| TC-M2DOM-014 | AC-F6-1 | TC-M2DOM-037 | AC-NFR4-1 |
| TC-M2DOM-015 | AC-F6-2 | TC-M2DOM-038 | AC-NFR5-1 |
| TC-M2DOM-016 | AC-F6-3 | TC-M2DOM-039 | AC-NFR6-1 |
| TC-M2DOM-017 | AC-F6-4 | TC-M2DOM-040 | AC-NFR7-1 |
| TC-M2DOM-018 | AC-F6-5 | TC-M2DOM-041 | AC-NFR8-1 |
| TC-M2DOM-019 | AC-F7-1 | TC-M2DOM-042 | AC-NFR9-1 |
| TC-M2DOM-020 | AC-F7-2 | TC-M2DOM-043 | AC-NFR10-1 |
| TC-M2DOM-021 | AC-F7-3 | TC-M2DOM-044 | AC-NFR11-1 |
| TC-M2DOM-022 | AC-F8-1 | TC-M2DOM-045 | AC-NFR12-1 |
| TC-M2DOM-023 | AC-F8-2 | — | — |

### 3.2 Interface Coverage (API-#, EVT-#, DM-#)

The spec declares no REST/HTTP endpoint and no event surface (spec §8.1, §8.2): both are explicitly N/A because nothing is delivered. The eight data-model elements are documentation shapes and are verified through the acceptance criteria that consume them.

| ID | Element | TC ID(s) | Notes |
|---|---|---|---|
| DM-1 | Backlog story entry (heading, Goal, Tasks, AC, Depends on; codes stable, file position not ordering) | TC-003, TC-005, TC-006, TC-035, TC-041 | Shape and clause fidelity in P03/P05/P06; preservation in P35; the 26-clause table in P41 |
| DM-2 | Domain level (mandatory/optional semantics of repository, project, workspace) | TC-011, TC-012, TC-013, TC-033 | C4 context, model prose, flows and invariants, boundary statement consistency |
| DM-3 | Project configuration document | TC-004, TC-015, TC-016 | Mixed tracker kinds, optional workspace root, `not-yet-supported` classification |
| DM-4 | `repos.v1` envelope (flat enumeration) | TC-014, TC-019, TC-021 | Contract section, page envelope keys, page split |
| DM-5 | `projects.v1` envelope (group surface) | TC-015, TC-020, TC-021, TC-024 | Group identity, per-member fields, project scope, journey usage |
| DM-6 | Cross-repository change plan shape | TC-007, TC-013, TC-017 | Task traceability, flow, declared fields |
| DM-7 | Scenario seed (`### SC-M2-<story>-<n>` with exactly one `Assert:`) | TC-022, TC-023 | Seed counts, per-seed assert count, S11 amendment |
| DM-8 | Command page (`Status:` header, NAME, SYNOPSIS, OPTIONS, OUTPUT, EXIT STATUS, examples, error table, see-also) | TC-019, TC-020, TC-021, TC-036 | Page structure, split, and planned-only status |

`API-#` / `EVT-#`: none exist in the spec; nothing to cover.

### 3.3 Non-Functional Coverage (NFR-#)

| NFR ID | Requirement | TC ID | Status |
|---|---|---|---|
| NFR-1 | Docs-only containment (13 files) | TC-034 | Covered (exact manifest, forbidden roots, worktree check) |
| NFR-2 | Backlog preservation and placement | TC-008, TC-009, TC-010, TC-035 | Covered (byte comparisons, hunk confinement, insertion window) |
| NFR-3 | Planned-not-delivered semantics | TC-019, TC-020, TC-021, TC-036 | Covered (exact headers, claim scan, verbatim pack statement); residue G-5 |
| NFR-4 | Forbidden-literals registration | TC-037, TC-042 | Covered (139 → 140, position, duplicates, guard output) |
| NFR-5 | Doc-distribution guard | TC-038 | Covered (default `TMPDIR`, zero planning markers) |
| NFR-6 | Aggregate gate | TC-039 | Covered (authoritative repository-local full suite, both runs recorded, the two named default-only failures recorded and re-run, any other failure a delivery failure; DEC-16); environment caveat G-6 |
| NFR-7 | Document structure (no new tooling) | TC-040 | Covered structurally; syntax residue G-3 |
| NFR-8 | Ticket clause fidelity | TC-003, TC-005, TC-041 | Covered by the 26-row table; meaning residue G-1 |
| NFR-9 | Public/OSS hygiene | TC-042 | Covered (guard plus added-line read); residue G-4 |
| NFR-10 | Link integrity and non-duplication | TC-043 | Covered by resolution plus pattern check; residue G-9 |
| NFR-11 | Status history retention | TC-029, TC-044 | Covered (line retention, confinement, four mutation fixtures) |
| NFR-12 | Naming-boundary consistency | TC-032, TC-033, TC-045 | Covered (forbidden half, boundary statements, required half + self-tests); residue G-4 |

## 4. Test Types and Layers

Per `.ai/rules/testing-strategy.md`, a `doc/**` change is covered by **static/diff checks** and **content checks**, plus the repository doc guards. No unit, integration, E2E, performance, or migration layer applies: the change has no runtime behaviour, no schema, and no emitted artifact.

| Layer | What is executed | Where |
|---|---|---|
| Static/diff inspection | `git diff --name-only`, `diff -U0`, `cmp`, `git show "$BASE:<path>"`, `awk` region extraction, line-retention comparison | Local worktree at branch HEAD vs `5372dbac` |
| Content inspection | Entry/section extraction with a heading-bounded `awk`, anchor tables, per-seed `Assert:` counts, index-row target counts, registry entry extraction | Same |
| Guard execution | `bash scripts/.tests/test-doc-distribution.sh` (default `TMPDIR`), `bun run scripts/checks/forbidden-literals.ts`, `pnpm check` (repository-local `TMPDIR`, plus the default-`TMPDIR` run recorded) | Repository root |
| Structural diagram check | Fence inventory, fence tag, keyword first line per block, C4 heading counts, `## Key flows` ownership — exactly the NFR-7 conditions, no validator | `milestones/m2/**`, `backlog.md`, `status.md`, `cli-command-registry.md` |
| Manual review | Clause meaning (G-1), mixed-tracker semantics (G-2), rendered diagrams (G-3), matrix residue (G-4), status prose (G-5), pack prose quality (G-9) | Reviewer |

**No test code, suite, or harness is added, and that is correct here.** Every assertion is a property of the diff against a moving base, which the testing strategy assigns to review and PR-time gates rather than the permanent suite; NFR-1 forbids touching `tests/**`, `.ai/**`, and any `scripts/**` path except the single registry row, so committing a helper script would violate the change's own containment criterion.

Each procedure in Section 7.1 was run in a fresh shell against the pre-change tree (`5372dbac`, branch HEAD `5a6cbf48`, no product edits) before this plan was published, and every changed procedure was also run against the conforming, never-committed worktree fixture. Section 5.2 records the base-observed output and the fixture-derived expectation per test case; Section 10 records both verdicts.

## 5. Test Scenarios

### 5.1 Scenario Index

| TC ID | Title | Scenario Type | Impact | Priority | AC | Layer |
|---|---|---|---|---|---|---|
| TC-M2DOM-001 | M2-S11 is amended in place: retained clauses, `repos list` with the five fields, and the transition note | Happy Path | Critical | High | AC-F1-1 | Static/diff + content |
| TC-M2DOM-002 | Inside the amended entry, no flat `projects list` survives and no retained clause was weakened, merged, or moved | Negative | Critical | High | AC-F1-2 | Static/diff + content |
| TC-M2DOM-003 | The M2-S18 entry carries its four labels and all twelve ticket clauses | Happy Path | Critical | High | AC-F2-1 | Static/diff + content |
| TC-M2DOM-004 | The mixed-tracker clause keeps "accepted at validation time … not-yet-supported" in the entry and in the contracts | Corner Case | Critical | High | AC-F2-2 | Static/diff + content |
| TC-M2DOM-005 | The M2-S19 entry carries its four labels and all eleven ticket clauses | Happy Path | Critical | High | AC-F3-1 | Static/diff + content |
| TC-M2DOM-006 | The three S19 acceptance criteria are independently identifiable and none is merged | Corner Case | Important | High | AC-F3-2 | Static/diff + content |
| TC-M2DOM-007 | Every S19 task clause and both shared rules resolve to a declared contract element | Happy Path | Critical | High | AC-F3-3 | Static/diff + content |
| TC-M2DOM-008 | The two new entries land inside the Epic M2 block before the blank line and `---` separator, which stay byte-identical | Regression | Critical | High | AC-F4-1 | Static/diff |
| TC-M2DOM-009 | One context paragraph sits between the retirement note and `### M2-S2`, and the surrounding regions are byte-identical | Happy Path | Critical | High | AC-F4-2 | Static/diff + content |
| TC-M2DOM-010 | Every zero-context backlog hunk lies inside the three permitted regions | Negative | Critical | High | AC-F4-3 | Static/diff |
| TC-M2DOM-011 | C4 Level 1 draws repository, project, and workspace with the workspace optional in the diagram itself | Happy Path | Critical | High | AC-F5-1 | Structural + content |
| TC-M2DOM-012 | The model prose declares membership, keeps the workspace optional, and makes unrelated-directory projects identical | Happy Path | Important | High | AC-F5-2 | Content |
| TC-M2DOM-013 | The overview flow is project-scoped, a cross-repository flow exists, and four invariants are stated | Happy Path | Critical | High | AC-F5-3 | Structural + content |
| TC-M2DOM-014 | `repos.v1` is named, owned by M2-S11, and defines the seven flat-enumeration fields | Happy Path | Critical | High | AC-F6-1 | Content |
| TC-M2DOM-015 | `projects.v1` is the group envelope and no group-named key denotes a repository | Negative | Critical | High | AC-F6-2 | Content |
| TC-M2DOM-016 | The configuration schema declares membership, a tracker kind per member, and an optional workspace root, with the mixed-kind rule intact | Happy Path | Critical | High | AC-F6-3 | Content |
| TC-M2DOM-017 | The change plan shape declares all seven cross-repository elements | Happy Path | Critical | High | AC-F6-4 | Content |
| TC-M2DOM-018 | The group envelope names its consumers and the M2-S4 map row carries the advisory note, not a dependency edge | Corner Case | Important | Medium | AC-F6-5 | Content |
| TC-M2DOM-019 | The new `repos` page is a complete flat-enumeration contract with a rename note | Happy Path | Critical | High | AC-F7-1 | Content |
| TC-M2DOM-020 | The rewritten `projects` page is the group surface and never claims to enumerate checkouts | Negative | Critical | High | AC-F7-2 | Content |
| TC-M2DOM-021 | The two command pages split the two surfaces and point at their own contracts | Corner Case | Critical | High | AC-F7-3 | Content |
| TC-M2DOM-022 | The S18 and S19 seeds exist, carry one `Assert:` each, and cover the required topics | Happy Path | Critical | High | AC-F8-1 | Content |
| TC-M2DOM-023 | Both S11 seeds move to `repos list` and no seed asserts a flat `projects list` | Negative | Critical | High | AC-F8-2 | Content |
| TC-M2DOM-024 | The opening journey is a project-scoped morning overview with one member outside any shared directory | Happy Path | Important | High | AC-F9-1 | Content |
| TC-M2DOM-025 | The delta note splits `repos` from `projects` and no longer calls `projects` the host overview | Negative | Critical | High | AC-F10-1 | Content |
| TC-M2DOM-026 | The pack README learns the new page and the two new stories, and keeps its planned statement | Happy Path | Important | High | AC-F11-1 | Content |
| TC-M2DOM-027 | The milestone M2 row reaches thirteen targets and the M0/M1 rows are untouched | Happy Path | Important | Medium | AC-F11-2 | Content |
| TC-M2DOM-028 | One new dated status section records the amendment as planning state and claims no delivery | Happy Path | Critical | High | AC-F12-1 | Content |
| TC-M2DOM-029 | Every base status line is retained in order and every addition sits in the new section | Regression | Critical | High | AC-F12-2 | Static/diff |
| TC-M2DOM-030 | The registry carries the reconciled `repos`, `projects`, and M3-S6 rows plus the new boundary note | Happy Path | Critical | High | AC-F13-1 | Content |
| TC-M2DOM-031 | The registry diff touches only four regions and leaves every other row byte-identical | Negative | Critical | High | AC-F13-2 | Static/diff |
| TC-M2DOM-032 | The forbidden half of the naming matrix holds: no flat `projects list` and no group-meaning `repos` survive | Negative | Critical | High | AC-F14-1 | Content scan |
| TC-M2DOM-033 | Every location naming both surfaces states the boundary once in the same terms | Corner Case | Important | High | AC-F14-2 | Content |
| TC-M2DOM-034 | Exactly thirteen product files change and nothing outside the manifest moves | Negative | Critical | High | AC-NFR1-1 | Static/diff |
| TC-M2DOM-035 | Backlog preservation: every other story, region, and code is untouched | Regression | Critical | High | AC-NFR2-1 | Static/diff |
| TC-M2DOM-036 | Both command pages stay `Status: Proposed (M2)` and nothing claims delivery | Negative | Critical | High | AC-NFR3-1 | Content |
| TC-M2DOM-037 | The registry grows by exactly one sorted row and the guard reports no unregistered doc | Happy Path | Critical | High | AC-NFR4-1 | Guard + content |
| TC-M2DOM-038 | The distribution guard passes under the default `TMPDIR` with no planning markers | Regression | Important | Medium | AC-NFR5-1 | Guard |
| TC-M2DOM-039 | Both aggregate-gate runs are recorded; the repository-local full suite is authoritative and only the two named default-only failures are excused behind a green local run | Regression | Critical | High | AC-NFR6-1 | Guard |
| TC-M2DOM-040 | The touched documents satisfy the structural diagram conditions, with eight key flows each owning one block | Corner Case | Critical | High | AC-NFR7-1 | Structural |
| TC-M2DOM-041 | All 26 ticket clauses are present with no addition and no omission | Corner Case | Critical | High | AC-NFR8-1 | Content |
| TC-M2DOM-042 | The forbidden-literals guard is clean and no private name was introduced | Negative | Important | Medium | AC-NFR9-1 | Guard |
| TC-M2DOM-043 | No relative link is broken and no pack document restates a story's acceptance block | Corner Case | Important | Medium | AC-NFR10-1 | Content |
| TC-M2DOM-044 | The retention oracle is sound: delete, modify, swap, and outside-insertion fixtures are each detected | Regression | Critical | High | AC-NFR11-1 | Static/diff |
| TC-M2DOM-045 | The required half of the naming matrix holds in all seventeen Appendix B locations | Negative | Critical | High | AC-NFR12-1 | Content scan |

### 5.2 Scenario Details

#### TC-M2DOM-001 - M2-S11 is amended in place: retained clauses, `repos list` with the five fields, and the transition note

**Scenario Type**: Happy Path
**Impact Level**: Critical
**Priority**: High
**Related IDs**: AC-F1-1, F-1, DM-1, DM-4, S11-1, S11-2, S11-3
**Test Type(s)**: Manual (static/diff and content inspection)
**Automation Level**: Semi-automated (uncommitted procedure)
**Target Layer / Location**: `doc/planning/oss-tooling/backlog.md`, the `### M2-S11 Multi-repository workstations` entry
**Tags**: @docs, @backlog, @rename

**Preconditions**:

- Worktree at branch HEAD of `docs/GH-303/project-groups-domain-model`; `bash`, `git`, `awk`, `grep`, `sed` available.
- Section 7.1 P00 has been run once in the same shell (base snapshots and the `entry()` extractor).

**Steps**:

1. Run **P01**: extract the M2-S11 entry, assert the five retained anchors, the exact `- Depends on: M0-S5, M1-S17.` line, the five `repos list` fields (on the squashed entry), the transition note, and the absence of the old "projects command … one CLI overview" goal.
2. Run the block in a fresh shell; `repos_list_fields` is matched after `squash()` so a wrapped line cannot fake a miss.

**Expected Outcome**:

- `retained_clauses=5/5`; `depends_line=exact`; `repos_list_fields=OK`; `transition_note=OK`; `goal_projects_command=ABSENT`; verdict `PASS`.

**Notes / Clarifications**:

- **Base-observed:** `retained_clauses=5/5`; `depends_line=exact`; `repos_list_fields=MISSING`; `transition_note=MISSING`; `goal_projects_command=PRESENT` → **FAIL**.
- **Fixture-derived post-change expectation:** all five lines as above → **PASS**. The v1.0 block matched the multi-line field list without squashing; the fixture and the squashed form make the anchor satisfiable on a wrapped entry.

#### TC-M2DOM-002 - Inside the amended entry, no flat `projects list` survives and no retained clause was weakened, merged, or moved

**Scenario Type**: Negative
**Impact Level**: Critical
**Priority**: High
**Related IDs**: AC-F1-2, F-1, NFR-8, NFR-12, DM-1
**Test Type(s)**: Manual (content scan)
**Automation Level**: Semi-automated (uncommitted procedure)
**Target Layer / Location**: `backlog.md`, the M2-S11 entry range only
**Tags**: @docs, @backlog, @naming

**Preconditions**:

- As TC-001; P00 has run in the same shell.

**Steps**:

1. Run **P02**: count **flat statements** inside the M2-S11 entry with the sentence-level `@flat` detector, not raw `projects list` occurrences. The entry is allowed (and required) to mention `projects list` in its transition clause ("if a flat `projects list` ships before …"); only a statement that attributes enumeration to `projects` is a survivor.
2. Assert at least one `repos list`, zero group-meaning `repos`, exactly one copy of the collision clause, and its presence inside the S11 entry.

**Expected Outcome**:

- `flat_projects_statements_in_entry=0`; `projects_list_raw_mentions>=1` (the transition note); `repos_list_in_entry>=1`; `group_meaning_repos_in_entry=0`; `collision_clause_copies=1`; `inside_s11=1`; verdict `PASS`.

**Notes / Clarifications**:

- **Base-observed:** `flat_projects_statements_in_entry=3` (goal, task, AC); `projects_list_raw_mentions=2`; `repos_list_in_entry=0` → **FAIL**.
- **Fixture-derived post-change expectation:** `flat_projects_statements_in_entry=0`; `projects_list_raw_mentions=2` (the mandated transition clause); `repos_list_in_entry=3` → **PASS**. A raw-occurrence ban would make AC-F1-1 and F-1 mutually unsatisfiable; the statement-level oracle is the correct reading of AC-F1-2.

#### TC-M2DOM-003 - The M2-S18 entry carries its four labels and all twelve ticket clauses

**Scenario Type**: Happy Path
**Impact Level**: Critical
**Priority**: High
**Related IDs**: AC-F2-1, F-2, NFR-8, DM-1, S18-G, S18-T1..T5, S18-A1..A5, S18-D
**Test Type(s)**: Manual (content inspection)
**Automation Level**: Semi-automated (uncommitted procedure)
**Target Layer / Location**: `backlog.md`, the `### M2-S18 Project groups` entry
**Tags**: @docs, @backlog, @s18, @fidelity

**Preconditions**:

- As TC-001. The 26-row anchor table is defined in P00 as `clause_rows()` and shared by P03, P05, P06, and P41.

**Steps**:

1. Run procedure **P03**: extract the S18 entry, flatten it with the wrap-tolerant `squash()` helper (a line-ending hyphen is joined before newlines become spaces), and test the twelve `M2-S18` rows of the anchor table.
2. Confirm the four labels are present and no `- Ticket:` line exists (the reading guide reserves that line for created stories).

**Expected Outcome**:

- `clauses_present=12/12`; `shape_labels=4/4`; `ticket_line=0`; no `MISSING` lines; verdict `PASS`.

**Notes / Clarifications**:

- Observed on the pre-change tree: `S18=absent`; `clauses_present=0/12`; verdict **FAIL (change absent)**. No M2-S18 entry exists in the base tree.
- The anchor table is the test-side transcription of spec Appendix A; it is the checklist the G-1 paraphrase read uses.

#### TC-M2DOM-004 - The mixed-tracker clause keeps "accepted at validation time … not-yet-supported" in the entry and in the contracts

**Scenario Type**: Corner Case
**Impact Level**: Critical
**Priority**: High
**Related IDs**: AC-F2-2, F-2, F-6, DEC-12, S18-T1, S18-A5
**Test Type(s)**: Manual (content inspection)
**Automation Level**: Semi-automated (uncommitted procedure)
**Target Layer / Location**: `backlog.md` S18 entry; `milestones/m2/contracts.md`
**Tags**: @docs, @fidelity, @risk-4

**Preconditions**:

- As TC-001.

**Steps**:

1. Run procedure **P04**: require `not-yet-supported` in both the S18 entry and `contracts.md`, require the validation-time wording and the "rather than rejected" clause in the entry, and forbid the softening phrases `trackers are not supported` / `mixed trackers are rejected` in either file.
2. Read the two clauses once against AC-F2-2 (declared residual G-2).

**Expected Outcome**:

- `s18_nyts>=1`; `contracts_nyts>=1`; `s18_validation=OK`; `s18_rather_than_rejected=OK`; `softening=ABSENT`; verdict `PASS`.

**Notes / Clarifications**:

- Observed on the pre-change tree: `s18_nyts=0 contracts_nyts=0`; `s18_validation=MISSING`; `s18_rather_than_rejected=MISSING`; `softening=ABSENT`; verdict **FAIL**. The softening ban is a passing control (the base says nothing at all), so it is the two required tokens that carry the gate.
- This is the RSK-4 mitigation: the clause is the one most easily softened to "not supported", so the classification token is checked in both places rather than once.

#### TC-M2DOM-005 - The M2-S19 entry carries its four labels and all eleven ticket clauses

**Scenario Type**: Happy Path
**Impact Level**: Critical
**Priority**: High
**Related IDs**: AC-F3-1, F-3, NFR-8, DM-1, S19-G, S19-T1..T6, S19-A1..A3, S19-D
**Test Type(s)**: Manual (content inspection)
**Automation Level**: Semi-automated (uncommitted procedure)
**Target Layer / Location**: `backlog.md`, the `### M2-S19 Cross-repository changes` entry
**Tags**: @docs, @backlog, @s19, @fidelity

**Preconditions**:

- As TC-001.

**Steps**:

1. Run procedure **P05**: extract S19, squash it, and test the eleven `M2-S19` rows of the anchor table, including the exact dependency line `- Depends on: M2-S11, M2-S18, M1-S17.`.
2. Confirm the four labels are present.

**Expected Outcome**:

- `clauses_present=11/11`; `shape_labels=4/4`; verdict `PASS`.

**Notes / Clarifications**:

- Observed on the pre-change tree: `S19=absent`; `clauses_present=0/11`; verdict **FAIL (change absent)**.

#### TC-M2DOM-006 - The three S19 acceptance criteria are independently identifiable and none is merged

**Scenario Type**: Corner Case
**Impact Level**: Important
**Priority**: High
**Related IDs**: AC-F3-2, F-3, NFR-8, S19-A1..A3
**Test Type(s)**: Manual (content inspection)
**Automation Level**: Semi-automated (uncommitted procedure)
**Target Layer / Location**: `backlog.md`, the S19 `- AC:` block
**Tags**: @docs, @backlog, @s19

**Preconditions**:

- As TC-001.

**Steps**:

1. Run procedure **P06**: count the indented numbered items in the S19 acceptance block and locate each of the three criteria by its own anchor (one spec/two branches; per-member corroboration; failing member named).
2. Confirm the count is exactly three, so a fourth criterion or a merged pair fails.

**Expected Outcome**:

- `numbered_items=3/3`; `a1>=1`; `a2>=1`; `a3>=1`; verdict `PASS`.

**Notes / Clarifications**:

- Observed on the pre-change tree: `S19=absent numbered_items=0/3`; verdict **FAIL (change absent)**. The number check alone would pass on an empty block, which is why each criterion also needs its own anchor.

#### TC-M2DOM-007 - Every S19 task clause and both shared rules resolve to a declared contract element

**Scenario Type**: Happy Path
**Impact Level**: Critical
**Priority**: High
**Related IDs**: AC-F3-3, F-3, F-6, DM-6, S19-T1..T6
**Test Type(s)**: Manual (content inspection)
**Automation Level**: Semi-automated (uncommitted procedure)
**Target Layer / Location**: `milestones/m2/contracts.md`
**Tags**: @docs, @contracts

**Preconditions**:

- As TC-001.

**Steps**:

1. Run procedure **P07**: for each of the six S19 task clauses, assert a contract anchor in `contracts.md` (members and slices; one lifecycle producing a branch and PR; per-member gates; branch cleanup with issue closure; dependency edges; evidence enumerating member PRs).
2. Confirm this is the forward direction (clause → contract); the declared shape's own field list is TC-017's job.

**Expected Outcome**:

- `s19_task_to_contract=6/6`; verdict `PASS`.

**Notes / Clarifications**:

- Observed on the pre-change tree: `contract MISSING: T1..T4, T6`; `s19_task_to_contract=1/6`; verdict **FAIL**. The single hit is `dependency edges`, which the base queue-lifecycle section already uses for a different purpose — a reminder that an anchor proves vocabulary, not intent (G-1).

#### TC-M2DOM-008 - The two new entries land inside the Epic M2 block before the blank line and `---` separator, which stay byte-identical

**Scenario Type**: Regression
**Impact Level**: Critical
**Priority**: High
**Related IDs**: AC-F4-1, F-4, NFR-2, DEC-8
**Test Type(s)**: Manual (static/diff)
**Automation Level**: Semi-automated (uncommitted procedure)
**Target Layer / Location**: `backlog.md`, Epic M2 block geometry
**Tags**: @docs, @diff, @placement

**Preconditions**:

- As TC-001.

**Steps**:

1. Run **P08**: `backlog_ranges()` derives `S17_LAST`, `SEP_LINE`, `M3_LINE`, `WS=S17_LAST+1`, and `WE=SEP_LINE-1` from the head. Compare the separator triple (`---`, blank line, `## Epic M3`) with the base snapshot, assert the blank line immediately before the separator, locate S18 and S19, and assert `WS <= s18 < s19 <= WE`.
2. Read the derived values; a literal post-change line number is never an expected value.

**Expected Outcome**:

- `window_empty=no`; `separator_sequence=identical`; `blank_line_before_separator=1`; `placement=inside-window`; verdict `PASS`.

**Notes / Clarifications**:

- **Base-observed (no product edit):** `s17_last=1285 separator=1287 epic_m3=1289 window=1286:1286`; `s18_line=absent s19_line=absent`; `placement=FAIL` → **FAIL (change absent)**.
- **Fixture-derived post-change expectation** (conforming, never-committed worktree at base `5372dbac` with the context paragraph, the S11 amendment, and S18/S19 applied): `s17_last=1293 separator=1310 epic_m3=1312 window=1294:1309`; `s18_line=1294 s19_line=1300`; `placement=inside-window` → **PASS**. The window is recomputed from the head, so a different conforming edit may legitimately produce different line numbers; `placement=inside-window` is the invariant.

#### TC-M2DOM-009 - One context paragraph sits between the retirement note and `### M2-S2`, and the surrounding regions are byte-identical

**Scenario Type**: Happy Path
**Impact Level**: Critical
**Priority**: High
**Related IDs**: AC-F4-2, F-4, NFR-2, DEC-4
**Test Type(s)**: Manual (static/diff and content inspection)
**Automation Level**: Semi-automated (uncommitted procedure)
**Target Layer / Location**: `backlog.md`, lines between the Epic M2 retirement note and `### M2-S2`
**Tags**: @docs, @backlog, @placement

**Preconditions**:

- As TC-001.

**Steps**:

1. Run **P09**: anchor the retirement note by its first line (`Note: the M1 redefinition moved the queue`) and its **last line** (`the gap is deliberate. M2 stories keep their codes.`), and anchor the next heading as `### M2-S2`. The context paragraph is the window `note_end+1 .. s2_line-1`; assert the note's byte identity against the base snapshot, `note_end+1 < s2_line`, `paragraph_lines>=1`, a blank line immediately after the note end and before `### M2-S2`, and the line numbers of the note's first/last lines unchanged from base.
2. Assert the paragraph names repository/project/workspace, the `repos`/`projects` boundary, and the root-family consequence; compare the frontmatter, reading guide, and cross-cutting principles with the base snapshot.

**Expected Outcome**:

- `note_start_line=anchored(...)`, `note_end_line=anchored(...)`; `retirement_note=OK`; `paragraph_lines>=1`; `paragraph_strictly_between=OK`; `blank_after_note=1`; `blank_before_s2=1`; `three_levels=OK`; `boundary=OK`; `root_family=OK`; `fm`/`rguide`/`cc` `byte-identical`; verdict `PASS`.

**Notes / Clarifications**:

- **Base-observed:** `retirement_note=1051..1054 context_paragraph=1055..1055 paragraph_lines=0`; the note, frontmatter, reading guide, and principles are already byte-identical; `paragraph_strictly_between=FAIL` → **FAIL (no context paragraph)**. The old window formula ("last non-empty line before M2-S2, plus one") collapsed onto the paragraph itself once a paragraph existed; the note's own last line is the stable anchor and is preserved by NFR-2, so it cannot drift.
- **Fixture-derived post-change expectation:** `retirement_note=1051..1054 context_paragraph=1055..1060 paragraph_lines=4 blank_after_note=1 blank_before_s2=1 paragraph_strictly_between=OK`; all three level/boundary/root-family anchors `OK` → **PASS**.

#### TC-M2DOM-010 - Every zero-context backlog hunk lies inside the three permitted regions

**Scenario Type**: Negative
**Impact Level**: Critical
**Priority**: High
**Related IDs**: AC-F4-3, F-4, NFR-2
**Test Type(s)**: Manual (static/diff)
**Automation Level**: Semi-automated (uncommitted procedure)
**Target Layer / Location**: `backlog.md` diff against `5372dbac`
**Tags**: @docs, @diff, @containment

**Preconditions**:

- As TC-001; P08 and P09 have run first (they compute the entry range, the paragraph window, and the insertion window).

**Steps**:

1. Run **P10**: classify every zero-context backlog hunk against three ranges derived from the head — the M2-S11 entry (`s11_line:s11_end`), the context paragraph (`note_end+1:s2_line-1`), and the insertion window (`s17_last+1:separator-1`). A hunk is inside only when its added range is wholly contained.
2. Require at least one hunk (`non_vacuous=yes`) and run the three classifier self-tests: a paragraph line is inside, a line two below the separator is outside, and the first window line is inside.
3. If the implementation carries per-block helpers, assert they are present: P10 uses the ranges from `backlog_ranges()` in P00, never a stale variable from another block.

**Expected Outcome**:

- `backlog_hunks>=1`; `hunks: inside=<n> outside=0`; `hunk confinement OK`; `non_vacuous=yes`; `classifier_self_tests=3/3`; verdict `PASS`.

**Notes / Clarifications**:

- **Base-observed:** `backlog_hunks=0`; `non_vacuous=no`; `classifier_self_tests=3/3` → **FAIL (vacuous)**, not a pass.
- **Fixture-derived post-change expectation:** `ranges=s11:1174:1191 context:1055:1060 window:1294:1309`; `backlog_hunks=6`; `hunks: inside=6 outside=0`; `non_vacuous=yes` → **PASS**. The ranges are derived, not quoted; the fixture's numbers are evidence of the conforming shape, not the only acceptable head.

#### TC-M2DOM-011 - C4 Level 1 draws repository, project, and workspace with the workspace optional in the diagram itself

**Scenario Type**: Happy Path
**Impact Level**: Critical
**Priority**: High
**Related IDs**: AC-F5-1, F-5, DM-2, RSK-8, DEC-9
**Test Type(s)**: Manual (structural and content inspection)
**Automation Level**: Semi-automated (uncommitted procedure)
**Target Layer / Location**: `milestones/m2/architecture.md`, `## C4 Level 1: system context`
**Tags**: @docs, @architecture, @mermaid

**Preconditions**:

- As TC-001.

**Steps**:

1. Run procedure **P11**: extract the `## C4 Level 1: system context` section, split its mermaid body from its prose, and require (a) `delivery unit`, (b) `group of repositories` or `configured group`, (c) the word `workspace` inside the fenced diagram, (d) `optional` inside the diagram in the same node label, and (e) no sentence claiming a workspace is required.
2. Confirm optionality is visible **in the diagram**, not only in prose (RSK-8).

**Expected Outcome**:

- `repository_as_delivery_unit=OK`; `project_as_group=OK`; `workspace_in_diagram=OK`; `workspace_optional_in_diagram=OK`; `workspace_mandatory_claim=ABSENT`; verdict `PASS`.

**Notes / Clarifications**:

- Observed on the pre-change tree: `repository_as_delivery_unit=MISSING`; `project_as_group=MISSING`; `workspace_in_diagram=MISSING`; `workspace_optional_in_diagram=MISSING`; `workspace_mandatory_claim=ABSENT`; verdict **FAIL**. The Level 1 section is 32 lines and already carries a `Host-level project index` node, so the file is present and the oracle is not reading an empty region — the three-level model genuinely is not there.

#### TC-M2DOM-012 - The model prose declares membership, keeps the workspace optional, and makes unrelated-directory projects identical

**Scenario Type**: Happy Path
**Impact Level**: Important
**Priority**: High
**Related IDs**: AC-F5-2, F-5, DM-2, DM-3, S18-A2
**Test Type(s)**: Manual (content inspection)
**Automation Level**: Semi-automated (uncommitted procedure)
**Target Layer / Location**: `milestones/m2/architecture.md`, model prose
**Tags**: @docs, @architecture

**Preconditions**:

- As TC-001.

**Steps**:

1. Run procedure **P12**: require `membership … declared in configuration`, `workspace … never required` (or `optional`), `unrelated director…`, and `identically`; forbid `must live inside a workspace` / `required to live inside`.
2. Confirm the four statements appear as declarations, not as questions or alternatives.

**Expected Outcome**:

- `membership_declared=OK`; `workspace_never_required=OK`; `unrelated_dirs=OK`; `identical_behaviour=OK`; `member_must_be_inside=ABSENT`; `unrelated director.*identically` matched; verdict `PASS`.

**Notes / Clarifications**:

- Observed on the pre-change tree: all four required anchors `MISSING`, the forbidding control `ABSENT`; verdict **FAIL**.

#### TC-M2DOM-013 - The overview flow is project-scoped, a cross-repository flow exists, and four invariants are stated

**Scenario Type**: Happy Path
**Impact Level**: Critical
**Priority**: High
**Related IDs**: AC-F5-3, F-5, DM-2, DM-6, DEC-9
**Test Type(s)**: Manual (structural and content inspection)
**Automation Level**: Semi-automated (uncommitted procedure)
**Target Layer / Location**: `milestones/m2/architecture.md`, `## Key flows` and `## Boundary invariants at M2 exit`
**Tags**: @docs, @architecture, @flows

**Preconditions**:

- As TC-001.

**Steps**:

1. Run procedure **P13**: in `### Multi-repository overview`, require `member`, `group`, and `workspace`; require a `### Cross-repository change` section containing at least one mermaid fence; and require four distinct invariants (naming boundary, declared membership, workspace optionality, one lifecycle per cross-repository change).
2. Confirm the overview no longer starts from a flat host list: the flow must name members of a group before per-member state.

**Expected Outcome**:

- overview mentions `member`, `group`, `workspace`; `cross_repo_flow_heading=present`; `cross_repo_mermaid>=1`; `invariants naming>=1 membership>=1 workspace>=1 lifecycle>=1`; verdict `PASS`.

**Notes / Clarifications**:

- Observed on the pre-change tree: `overview_mentions_member=0 group=0 workspace=0`; `cross_repo_flow_heading=absent cross_repo_mermaid=0`; `invariants naming=0 membership=0 workspace=0 lifecycle=0`; verdict **FAIL**. The base flow is a flat `projects list → resolve host index → repo key` walk, which is exactly what F-5 rewrites.

#### TC-M2DOM-014 - `repos.v1` is named, owned by M2-S11, and defines the seven flat-enumeration fields

**Scenario Type**: Happy Path
**Impact Level**: Critical
**Priority**: High
**Related IDs**: AC-F6-1, F-6, DM-4, DEC-3, RSK-12
**Test Type(s)**: Manual (content inspection)
**Automation Level**: Semi-automated (uncommitted procedure)
**Target Layer / Location**: `milestones/m2/contracts.md`, `## repos.v1`
**Tags**: @docs, @contracts

**Preconditions**:

- As TC-001.

**Steps**:

1. Run procedure **P14**: require the `## repos.v1` section, its `M2-S11` ownership, and seven field anchors — repo key, root, state location, daemon reachability, handover state, host index revision, degradation reason — plus `checkout identity` as the key's derivation.
2. Confirm the field set matches the S11 entry's five reported fields plus the two envelope extras (RSK-12: one name, one field set).

**Expected Outcome**:

- `repos_v1_section=present`; `owned_by_M2-S11=OK`; `repos_v1_fields=7/7`; verdict `PASS`.

**Notes / Clarifications**:

- Observed on the pre-change tree: `repos_v1_section=absent`; all eight anchors `MISSING`; `repos_v1_fields=0/7`; verdict **FAIL**. The base's flat contract is called `projects.v1`, which is the rename this change performs.

#### TC-M2DOM-015 - `projects.v1` is the group envelope and no group-named key denotes a repository

**Scenario Type**: Negative
**Impact Level**: Critical
**Priority**: High
**Related IDs**: AC-F6-2, F-6, DM-5, RSK-3
**Test Type(s)**: Manual (content inspection)
**Automation Level**: Semi-automated (uncommitted procedure)
**Target Layer / Location**: `milestones/m2/contracts.md`, `## projects.v1`
**Tags**: @docs, @contracts, @negative

**Preconditions**:

- As TC-001.

**Steps**:

1. Run procedure **P15**: within the `## projects.v1` section require `group`, `member`, a tracker-kind field, `health`, `workspace root`, and `project scop…`; require a group identity plus name; and forbid `projectKey … repository identity`.
2. Read the section once for the inverse direction — no member field denoting the group (declared residue in G-1's paraphrase pass).

**Expected Outcome**:

- all six group-field anchors `OK`; `group_named_key_denotes_repo=ABSENT`; `group_identity_name=OK`; verdict `PASS`.

**Notes / Clarifications**:

- Observed on the pre-change tree: `projects_v1_section=present` but every group anchor `MISSING` and `group_named_key_denotes_repo=PRESENT (violation)`; verdict **FAIL**. The base section is precisely the defect RSK-3 names: `projectKey` is "stable repository identity", so the group name still denotes a checkout.

#### TC-M2DOM-016 - The configuration schema declares membership, a tracker kind per member, and an optional workspace root, with the mixed-kind rule intact

**Scenario Type**: Happy Path
**Impact Level**: Critical
**Priority**: High
**Related IDs**: AC-F6-3, F-6, DM-3, DEC-12
**Test Type(s)**: Manual (content inspection)
**Automation Level**: Semi-automated (uncommitted procedure)
**Target Layer / Location**: `milestones/m2/contracts.md`, project configuration schema section
**Tags**: @docs, @contracts, @schema

**Preconditions**:

- As TC-001.

**Steps**:

1. Run procedure **P16**: locate a `## …configuration…` section and require eight anchors — member repositories, tracker kind, workspace, discovery root, mixed tracker, valid at validation, `not-yet-supported`, and the no-workspace equivalence.
2. Confirm the schema is documented as planned data, not as delivered configuration (DEC-13).

**Expected Outcome**:

- `fields=8/8`; verdict `PASS`.

**Notes / Clarifications**:

- Observed on the pre-change tree: `configuration_schema=absent`; `fields=0/8`; verdict **FAIL (change absent)**.

#### TC-M2DOM-017 - The change plan shape declares all seven cross-repository elements

**Scenario Type**: Happy Path
**Impact Level**: Critical
**Priority**: High
**Related IDs**: AC-F6-4, F-6, DM-6, DEC-13
**Test Type(s)**: Manual (content inspection)
**Automation Level**: Semi-automated (uncommitted procedure)
**Target Layer / Location**: `milestones/m2/contracts.md`, cross-repository change plan shape section
**Tags**: @docs, @contracts

**Preconditions**:

- As TC-001.

**Steps**:

1. Run procedure **P17**: locate the change-plan-shape section and require eight anchors covering members and slices, a branch, a pull request, per-member gates, one shared definition of done, branch cleanup with issue closure, dependency edges, and evidence enumerating member PRs.
2. Confirm the shape is a declaration (fields and rules), not a task list (the task list is the backlog entry, TC-005).

**Expected Outcome**:

- `elements=8/8`; verdict `PASS`.

**Notes / Clarifications**:

- Observed on the pre-change tree: `change_plan_shape=absent`; `elements=0/7`; verdict **FAIL (change absent)**.

#### TC-M2DOM-018 - The group envelope names its consumers and the M2-S4 map row carries the advisory note, not a dependency edge

**Scenario Type**: Corner Case
**Impact Level**: Important
**Priority**: Medium
**Related IDs**: AC-F6-5, F-6, F-11, DEC-14, NG-5
**Test Type(s)**: Manual (content inspection)
**Automation Level**: Semi-automated (uncommitted procedure)
**Target Layer / Location**: `milestones/m2/contracts.md`; `milestones/m2/README.md` story-to-artifact map
**Tags**: @docs, @contracts, @map

**Preconditions**:

- As TC-001.

**Steps**:

1. Run procedure **P18**: require a `consumers of projects.v1` statement in the contracts and the exact advisory phrase `(advisory: consumed at delivery; the owning story declares the edge)` on the `| M2-S4 ` map row — the same phrasing the M2-S3, M2-S5 and M2-S10 rows use — then confirm M2-S4's `- Depends on:` line is untouched (TC-035 covers the byte half).
2. Confirm the map row carries the convention rather than a new dependency edge, which NG-5 forbids.

**Expected Outcome**:

- `consumer_note=OK`; `s4_advisory=OK`; verdict `PASS`.

**Notes / Clarifications**:

- Observed on the pre-change tree: `consumer_note=MISSING`; `s4_advisory=MISSING`; verdict **FAIL**. The base M2-S4 row reads `| M2-S4 Board | multi-repository overview | projects.v1 | SC-M2-S4-01, SC-M2-S4-02 |` with no advisory note, and the contracts say nothing about consumers of the group envelope.

#### TC-M2DOM-019 - The new `repos` page is a complete flat-enumeration contract with a rename note

**Scenario Type**: Happy Path
**Impact Level**: Critical
**Priority**: High
**Related IDs**: AC-F7-1, F-7, DM-4, DM-8, DEC-10
**Test Type(s)**: Manual (content inspection)
**Automation Level**: Semi-automated (uncommitted procedure)
**Target Layer / Location**: `milestones/m2/commands/repos.md` (new file)
**Tags**: @docs, @commands, @new-file

**Preconditions**:

- As TC-001. P19 treats the file's absence as a first-class result rather than an error.

**Steps**:

1. Run **P19**: `$R` is defined by **P00** as `milestones/m2/commands/repos.md`; read it (or report `repos_md=absent`) and test the nine page conditions — exact `Status: Proposed (M2)`, bare `repos` NAME, `repos list [--json]` synopsis, `repos[]` envelope, `## EXIT STATUS`, `## ERRORS`, `## SEE ALSO`, `<binary>` prefix, and the rename note — plus the five flat-enumeration fields.
2. Run the block in a fresh shell as `source P00; source P19`; a missing `$R` must be reported as `repos_md=absent`, never read as an empty file.

**Expected Outcome**:

- `checks=9/9`; `fields=5/5`; verdict `PASS`.

**Notes / Clarifications**:

- **Base-observed:** `repos_md=absent`; `checks=0/9 fields=0/5` → **FAIL (change absent)**.
- **Fixture-derived post-change expectation:** a conforming `commands/repos.md` with the rename note on one line gives `checks=9/9 fields=5/5` → **PASS**. The v1.0 procedure referenced an undefined `$R`; `$R` (and `$PJ`) are now P00 variables and the block is executed in a fresh shell, so the recorded evidence can come from the published block.

#### TC-M2DOM-020 - The rewritten `projects` page is the group surface and never claims to enumerate checkouts

**Scenario Type**: Negative
**Impact Level**: Critical
**Priority**: High
**Related IDs**: AC-F7-2, F-7, DM-5, DM-8, DEC-10
**Test Type(s)**: Manual (content inspection)
**Automation Level**: Semi-automated (uncommitted procedure)
**Target Layer / Location**: `milestones/m2/commands/projects.md`
**Tags**: @docs, @commands, @negative

**Preconditions**:

- As TC-001.

**Steps**:

1. Run **P20**: `$PJ` is defined by **P00** as `milestones/m2/commands/projects.md`; test the seven page conditions (exact status header, bare `projects` NAME, group listing, project scope, `projects.v1` pointer, configuration pointer, naming boundary), the three output fields (member, health, state), and the flat-statement ban.
2. Run the block in a fresh shell as `source P00; source P20`.

**Expected Outcome**:

- `checks=7/7`; `fields=3/3`; `forbidden_flat_statements=0`; verdict `PASS`.

**Notes / Clarifications**:

- **Base-observed:** `checks=4/7 fields=1/3 forbidden_flat_statements=1` → **FAIL**.
- **Fixture-derived post-change expectation:** a rewritten group-surface page gives `checks=7/7 fields=3/3 forbidden_flat_statements=0` → **PASS**. The triage threshold is `checks<7`, matching the seven conditions the block actually counts.

#### TC-M2DOM-021 - The two command pages split the two surfaces and point at their own contracts

**Scenario Type**: Corner Case
**Impact Level**: Critical
**Priority**: High
**Related IDs**: AC-F7-3, F-7, F-14, NFR-3, DM-8
**Test Type(s)**: Manual (content inspection)
**Automation Level**: Semi-automated (uncommitted procedure)
**Target Layer / Location**: `milestones/m2/commands/repos.md` and `commands/projects.md`, compared
**Tags**: @docs, @commands, @split

**Preconditions**:

- As TC-001.

**Steps**:

1. Run **P21**: `$R` and `$PJ` are P00 variables. Assert the `repos` page carries `repos.v1` and no `projects[]`, the `projects` page carries `projects.v1` and no `repos.v1` or `repos[]`, both carry the exact status header, and both state that they are not yet registered.
2. Run the block in a fresh shell as `source P00; source P21`.

**Expected Outcome**:

- `repos_page: repos.v1>=1 projects[]=0 header=1 not_registered>=1`; `projects_page: projects.v1>=1 repos.v1=0 repos[]=0 header=1 not_registered>=1`; verdict `PASS`.

**Notes / Clarifications**:

- **Base-observed:** `repos_page` absent; `projects_page: projects.v1=2 repos.v1=0 repos[]=0 header=1 not_registered=1` → **FAIL**.
- **Fixture-derived post-change expectation:** `repos.v1=2 projects[]=0 header=1 not_registered=1` and `projects.v1=2 repos.v1=0 repos[]=0 header=1 not_registered=1` → **PASS**. The bare word `repos` may appear in the projects page's boundary sentence; the page split is tested on contract pointers and envelope keys, not on the word.

#### TC-M2DOM-022 - The S18 and S19 seeds exist, carry one `Assert:` each, and cover the required topics

**Scenario Type**: Happy Path
**Impact Level**: Critical
**Priority**: High
**Related IDs**: AC-F8-1, F-8, DM-7
**Test Type(s)**: Manual (content inspection)
**Automation Level**: Semi-automated (uncommitted procedure)
**Target Layer / Location**: `milestones/m2/test-scenarios.md`
**Tags**: @docs, @scenarios

**Preconditions**:

- As TC-001.

**Steps**:

1. Run procedure **P22**: count `### SC-M2-S18-*` and `### SC-M2-S19-*` headings (each ≥ 2), run the per-seed `Assert:` counter over every new seed and require exactly 1, then test ten topic anchors across the two seed groups.
2. Confirm the S18 topic set covers discovery via a registered workspace directory, no-workspace equivalence, group listing with members, project-scoped queue and status reads, and mixed-tracker classification; and the S19 set covers two branches/two PRs/one review flow/closeout plus a failing member blocking the shared DoD.

**Expected Outcome**:

- `s18_seeds>=2`; `s19_seeds>=2`; `assert_violations=0`; `coverage_anchors=10/10`; verdict `PASS`.

**Notes / Clarifications**:

- Observed on the pre-change tree: `s18_seeds=0 s19_seeds=0`; `assert_violations=0` (vacuous over an empty set, which is why the seed counts are asserted separately); `coverage_anchors=1/10`; verdict **FAIL**. The single hit is `closeout`, which the base file already uses for other stories.

#### TC-M2DOM-023 - Both S11 seeds move to `repos list` and no seed asserts a flat `projects list`

**Scenario Type**: Negative
**Impact Level**: Critical
**Priority**: High
**Related IDs**: AC-F8-2, F-8, F-14, DEC-11
**Test Type(s)**: Manual (content inspection)
**Automation Level**: Semi-automated (uncommitted procedure)
**Target Layer / Location**: `milestones/m2/test-scenarios.md`, `SC-M2-S11-01` and `SC-M2-S11-02`
**Tags**: @docs, @scenarios, @naming

**Preconditions**:

- As TC-001.

**Steps**:

1. Run procedure **P23**: require `repos list` and no `projects list` in `SC-M2-S11-01`'s `Assert:` line; require `repos list` in `SC-M2-S11-02`'s title and body; require the five flat fields across the two blocks; and scan all `Assert:` lines for a `projects list` line that still speaks of rows, enumeration, or checkouts.
2. Confirm DEC-11's extension: the first seed's assert line is amended even though the ticket names only the second.

**Expected Outcome**:

- `s11_01_assert_repos_list>=1`; `s11_01_assert_projects_list=0`; `s11_02_title_repos_list>=1`; `s11_02_body_repos_list>=1`; `assert_fields=5/5`; `flat_assert_survivors=0`; verdict `PASS`.

**Notes / Clarifications**:

- Observed on the pre-change tree: `s11_01_assert_repos_list=0 s11_01_assert_projects_list=1`; `s11_02_title_repos_list=0`; `s11_02_body_repos_list=0`; `assert_fields=5/5`; `flat_assert_survivors=1`; verdict **FAIL**. The five-field half passes at base — the fields never changed, only their owner's name — which is why the seed counts alone would have been misleading.

#### TC-M2DOM-024 - The opening journey is a project-scoped morning overview with one member outside any shared directory

**Scenario Type**: Happy Path
**Impact Level**: Important
**Priority**: High
**Related IDs**: AC-F9-1, F-9, DM-5
**Test Type(s)**: Manual (content inspection)
**Automation Level**: Semi-automated (uncommitted procedure)
**Target Layer / Location**: `milestones/m2/journeys.md`, the opening `## ` section
**Tags**: @docs, @journeys

**Preconditions**:

- As TC-001.

**Steps**:

1. Run procedure **P24**: take the first `## ` section (the opening journey), squash it, and require a project-scoped framing, a member outside any shared directory or workspace, `repos list` for the flat view, `projects list` for the group view, project-scoped `queue` and `status` reads, a statement that a project without a shared workspace reads identically, and same-ref disjointness.
2. Confirm the journey answers the operator's real question (what is running, what is waiting, what needs a decision) rather than restating the contract (G-9).

**Expected Outcome**:

- `project_scoped=OK`; `member_outside_shared_dir=OK`; `flat_view_repos_list=OK`; `group_view_projects_list=OK`; `scoped_reads=OK`; `workspace_optional_stated=OK`; `same_ref_disjoint=OK`; `journey_anchors=4/4`; verdict `PASS`.

**Notes / Clarifications**:

- Observed on the pre-change tree: `opening_journey_lines=15`; `project_scoped=OK`; `member_outside_shared_dir=MISSING`; `flat_view_repos_list=MISSING`; `group_view_projects_list=OK`; `scoped_reads=MISSING`; `workspace_optional_stated=MISSING`; `same_ref_disjoint=OK`; `journey_anchors=3/4`; verdict **FAIL**. The base journey already says "projects" and "same ref … disjoint", which is why two controls pass while the four rewritten properties are absent — a good example of why each property needs its own anchor.

#### TC-M2DOM-025 - The delta note splits `repos` from `projects` and no longer calls `projects` the host overview

**Scenario Type**: Negative
**Impact Level**: Critical
**Priority**: High
**Related IDs**: AC-F10-1, F-10, DEC-4
**Test Type(s)**: Manual (content inspection)
**Automation Level**: Semi-automated (uncommitted procedure)
**Target Layer / Location**: `milestones/m2/entrypoint-delta.md`, `## M2-planned additions` and `## Mounting a new command`
**Tags**: @docs, @entrypoint, @negative

**Preconditions**:

- As TC-001.

**Steps**:

1. Run procedure **P25**: require a `repos … flat enumeration` addition and a `projects … group` addition in the planned-additions section, require the mounting paragraph to name both families, and forbid `host overview` anywhere in the file.
2. Confirm the four preserved facts still read the same: sixteen registered families, `#286`, the M1-page snapshot statement, and the two observed daemon failures.

**Expected Outcome**:

- `repos_addition=OK`; `projects_addition=OK`; `mount_names_both=OK`; `host_overview_claims=0`; five `preserved … OK` lines; verdict `PASS`.

**Notes / Clarifications**:

- Observed on the pre-change tree: `repos_addition=MISSING`; `projects_addition=MISSING`; `mount_names_both=MISSING`; `host_overview_claims=1`; all five preservation checks `OK`; verdict **FAIL**. The surviving claim is line 40, ``- `projects` becomes a root family: the host overview of managed checkouts.`` — the sentence the change exists to correct, and the only one that can be replaced without touching the rest of the note.

#### TC-M2DOM-026 - The pack README learns the new page and the two new stories, and keeps its planned statement

**Scenario Type**: Happy Path
**Impact Level**: Important
**Priority**: High
**Related IDs**: AC-F11-1, F-11, F-14, DEC-5
**Test Type(s)**: Manual (content inspection)
**Automation Level**: Semi-automated (uncommitted procedure)
**Target Layer / Location**: `milestones/m2/README.md`, `## Pack contents` and `## Story-to-artifact map`
**Tags**: @docs, @index

**Preconditions**:

- As TC-001.

**Steps**:

1. Run procedure **P26**: count the contents-table data rows (12 at base → 13), require a `commands/repos.md` row, require `| M2-S18 ` and `| M2-S19 ` map rows, require `repos.v1` on the `| M2-S11 ` map row, and require the planned-until-exit sentence verbatim.
2. Confirm no row conflates the two surfaces (that is TC-032/TC-045's row-level question, answered against Appendix B).

**Expected Outcome**:

- `pack_rows=13/13`; `repos_row=OK`; `map_s18=OK`; `map_s19=OK`; `s11_row_repos_v1=OK`; `planned_until_exit=verbatim`; verdict `PASS`.

**Notes / Clarifications**:

- Observed on the pre-change tree: `pack_rows=12/13`; `repos_row=MISSING`; `map_s18=MISSING`; `map_s19=MISSING`; `s11_row_repos_v1=MISSING`; `planned_until_exit=verbatim`; verdict **FAIL**. The verbatim statement is a passing control (NFR-3 requires it to survive).

#### TC-M2DOM-027 - The milestone M2 row reaches thirteen targets and the M0/M1 rows are untouched

**Scenario Type**: Happy Path
**Impact Level**: Important
**Priority**: Medium
**Related IDs**: AC-F11-2, F-11, DEC-5
**Test Type(s)**: Manual (content inspection)
**Automation Level**: Semi-automated (uncommitted procedure)
**Target Layer / Location**: `milestones/README.md`, `## Index` M2 row
**Tags**: @docs, @index

**Preconditions**:

- As TC-001 (the base `milestones/README.md` is snapshotted in P00).

**Steps**:

1. Run procedure **P27**: count `](m2/` link targets on the `| M2 (` row (12 at base → 13), require `m2/commands/repos.md`, and compare the M0 and M1 rows against the base snapshot with string equality.
2. Confirm the row keeps the table formatting (one line, pipe-delimited), so a multi-line rewrite cannot hide a target.

**Expected Outcome**:

- `m2_targets=13/13`; `repos_target=OK`; `m0_row=byte-identical`; `m1_row=byte-identical`; verdict `PASS`.

**Notes / Clarifications**:

- Observed on the pre-change tree: `m2_targets=12/13`; `repos_target=MISSING`; `m0_row=byte-identical`; `m1_row=byte-identical`; verdict **FAIL**. Both preservation comparisons are passing controls.

#### TC-M2DOM-028 - One new dated status section records the amendment as planning state and claims no delivery

**Scenario Type**: Happy Path
**Impact Level**: Critical
**Priority**: High
**Related IDs**: AC-F12-1, F-12, DEC-6, RSK-5
**Test Type(s)**: Manual (content inspection)
**Automation Level**: Semi-automated (uncommitted procedure)
**Target Layer / Location**: `status.md`, the new dated section
**Tags**: @docs, @status

**Preconditions**:

- As TC-001 (the base `status.md` is snapshotted in P00).

**Steps**:

1. Run **P28**: `newsecs_of()` lists every `## ` heading in the head absent from the base snapshot. Require **exactly one** (`new_section_count=1`), require no `## ` heading after it (`headings_after_new_section=0`), and derive the heading from the head.
2. Require the heading to follow the file's existing form — title text followed by the parenthesised change date, `^## .+ \(2026-11-11\)$` — and test the six required anchors (three levels, `repos list`, deprecation alias, M2-S18, M2-S19, naming boundary) plus registry and entrypoint-delta coverage, with no delivery claim.

**Expected Outcome**:

- `new_section_count=1`; `new_section_heading=## GH-303 domain-model amendment (2026-11-11)` (the title text is free; the date form is enforced); `heading_form=title-plus-parenthesised-date`; `headings_after_new_section=0`; `section_anchors=6/6`; `delivery_claim=ABSENT`; verdict `PASS`.

**Notes / Clarifications**:

- **Base-observed:** `new_section_count=0 new_section_line=absent` → **FAIL (change absent)**.
- **Fixture-derived post-change expectation:** `new_section_count=1 new_section_line=214`, heading `## GH-303 domain-model amendment (2026-11-11)`, `section_anchors=6/6`, `headings_after_new_section=0` → **PASS**. The v1.0 procedure derived only the first new heading; the count and the "no heading after" assertion make a second new section or an out-of-section insertion fail (finding 16).
- The date is pinned in the file's existing convention (title first, date parenthesised), so the plan's date token is enforced without inventing a title.

#### TC-M2DOM-029 - Every base status line is retained in order and every addition sits in the new section

**Scenario Type**: Regression
**Impact Level**: Critical
**Priority**: High
**Related IDs**: AC-F12-2, F-12, NFR-11, DEC-6
**Test Type(s)**: Manual (static/diff)
**Automation Level**: Semi-automated (uncommitted procedure)
**Target Layer / Location**: `status.md` vs the base snapshot
**Tags**: @docs, @diff, @retention

**Preconditions**:

- As TC-001.

**Steps**:

1. Run **P29**: `diffstat()` counts removed and added lines for the whole file; `newsec_of()`/`newsec_count()` locate the new section; additions are classified against the boundary `new_section_line-1` (the single blank separator belongs to the section).
2. Pass conditions: `removed_lines=0`, `added_outside_section=0`, `new_section_count<=1`, and `headings_after_new_section=0`. Zero additions is a legitimate base control; two new sections fail.

**Expected Outcome**:

- `removed_lines=0`; `base_lines_retained=OK`; `additions_confined=OK`; verdict `PASS` (`PASS (control)` on the pre-change tree).

**Notes / Clarifications**:

- **Base-observed:** `removed_lines=0 additions=0 new_section_count=0`; `base_lines=212 head_lines=212` → **PASS (control)**.
- **Fixture-derived post-change expectation:** `removed_lines=0 additions=18 new_section_line=214 new_section_count=1 headings_after=0 added_outside_section=0`; `base_lines=212 head_lines=230` → **PASS**. Existence of the section is TC-028's oracle; TC-029 owns retention and confinement, so it stays a control at base while still rejecting a second section.

#### TC-M2DOM-030 - The registry carries the reconciled `repos`, `projects`, and M3-S6 rows plus the new boundary note

**Scenario Type**: Happy Path
**Impact Level**: Critical
**Priority**: High
**Related IDs**: AC-F13-1, F-13, DEC-2, NFR-3
**Test Type(s)**: Manual (content inspection)
**Automation Level**: Semi-automated (uncommitted procedure)
**Target Layer / Location**: `cli-command-registry.md`, M2 and M3 tables and the boundary note
**Tags**: @docs, @registry

**Preconditions**:

- As TC-001.

**Steps**:

1. Run procedure **P30**: extract the M2 section (between `### M2: ` and `### M3: `) and the M3 section, then require seven anchors — the M2 `ados repos` row exists and says flat enumeration with `M2-S11` and `daemon reachability`; the `ados projects` row says group and `member` with `M2-S18`; the M3-S6 row attributes the verbs to `repos` subcommands; the boundary note states the boundary.
2. Forbid the old `distinct surfaces, so the names never collide` note, which asserts the opposite relationship.

**Expected Outcome**:

- `registry_anchors=7/7`; `old_boundary_note=ABSENT`; verdict `PASS`.

**Notes / Clarifications**:

- Observed on the pre-change tree: `m2_repos_row=absent old_projects_meaning=1`; `old_boundary_note=PRESENT (violation)`; `registry_anchors=0/7`; verdict **FAIL**. The base registry is the contradictory state F-13 fixes: `ados projects` is "Workstation overview of managed checkouts" (M2-S11) and `ados repos` is M3-S6 hygiene in a separate family.

#### TC-M2DOM-031 - The registry diff touches only four regions and leaves every other row byte-identical

**Scenario Type**: Negative
**Impact Level**: Critical
**Priority**: High
**Related IDs**: AC-F13-2, NFR-1, F-13
**Test Type(s)**: Manual (static/diff)
**Automation Level**: Semi-automated (uncommitted procedure)
**Target Layer / Location**: `cli-command-registry.md` vs the base snapshot
**Tags**: @docs, @diff, @containment

**Preconditions**:

- As TC-001; the base registry is snapshotted in P00.

**Steps**:

1. Run procedure **P31**: diff base against head with zero context and classify every changed line by content — the `ados projects` row, an `ados repos` row (added M2 or reconciled M3), or the `Boundary note:` line. Anything else is printed as `OUTSIDE`.
2. Prove the classifier bites by mutating the `ados supervise` row in a `/tmp` copy and confirming the mutation is reported.

**Expected Outcome**:

- `changed_lines>=1`; `outside=0`; `fixture_outside>=1`; verdict `PASS`.

**Notes / Clarifications**:

- Observed on the pre-change tree: `changed_lines=0`; `hunks_classified=0 outside=0`; `fixture_outside=2 out_of_scope_changes=2`; verdict **FAIL (vacuous: no registry change)**. The fixture proves the classifier detects an out-of-scope row change; with no change at all the result is vacuous, and the procedure says so instead of passing.

#### TC-M2DOM-032 - The forbidden half of the naming matrix holds: no flat `projects list` and no group-meaning `repos` survive

**Scenario Type**: Negative
**Impact Level**: Critical
**Priority**: High
**Related IDs**: AC-F14-1, F-14, NFR-12, RSK-1
**Test Type(s)**: Manual (content scan)
**Automation Level**: Semi-automated (uncommitted procedure)
**Target Layer / Location**: the twelve planning documents, region-scoped per Appendix B row
**Tags**: @docs, @scan, @naming

**Preconditions**:

- As TC-001.

**Steps**:

1. Run **P32**: walk the 17 matrix regions. The forbidden field is either a literal ERE or a sentence-level mode: `@flat` flags a sentence that attributes enumeration to `projects` (enumeration vocabulary, a CLI/host overview, or the flat field set within the same sentence), `@group` flags a sentence that attributes group/member semantics to `repos` **without** an `enumerat` predicate before the next `projects` clause, and `@both` runs both. This is the design that lets the ticket-mandated S18 goal ("group of repositories … enumerate groups") and the boundary clause ("`repos` = flat enumeration, `projects` = groups") pass while still flagging a real survivor.
2. Before counting, require every region to be non-empty (`region=EMPTY` is a failure, never a vacuous `forbidden=0`). Run the self-tests: a flat `projects list` sentence is detected, a group-meaning `repos` sentence is detected, the required boundary sentence is **not** flagged, and the base `commands/board.md` text (unchanged by this change) is **not** flagged.
3. The `s11backlog` mode anchors on the three-hash `### M2-S11 ` heading; `s11seeds` anchors on the test-scenarios story section. The `newsec` region is empty at base and is reported as `EMPTY`, not as `OK`.

**Expected Outcome**:

- Every row `forbidden=0 OK`; `matrix_rows=17`; `regions_empty=0`; `rows_with_survivors=0/17`; `self_test_flat=detected`; `self_test_group=detected`; `self_test_boundary_allowed=OK`; `base_board_accepted=OK`; verdict `PASS`.

**Notes / Clarifications**:

- **Base-observed:** `rows_with_survivors=15/17` — nine survivor rows plus five `region=EMPTY` rows and `CMD-R region=NOFILE`. The two `projects list` occurrences in the M2-S11 entry are detected as flat statements (the task line and the AC), and the goal's "projects command … one CLI overview" is detected as a third; the base `projects.md` contributes three flat statements, and `CT-PV1`, `ARCH`, `TS-S11`, `JRN`, `EPD`, `M2RD`, and `REG` each contribute one literal survivor. Both direction self-tests are `detected`, and the required boundary sentence is not flagged. Verdict **FAIL**.
- **Fixture-derived post-change expectation:** `rows_with_survivors=0/17`, `regions_empty=0`, all four self-tests as above → **PASS**. This is the direct proof that the BL-18 detector is satisfiable on the ticket-verbatim S18/S19 text without rewording a clause.
- A planted violation still fails: the two injected sentences are reported, so a green head is evidence and not an inert scan.

#### TC-M2DOM-033 - Every location naming both surfaces states the boundary once in the same terms

**Scenario Type**: Corner Case
**Impact Level**: Important
**Priority**: High
**Related IDs**: AC-F14-2, F-14, DM-2, RSK-1
**Test Type(s)**: Manual (content inspection)
**Automation Level**: Semi-automated (uncommitted procedure)
**Target Layer / Location**: the six both-name prose locations (Epic M2 context paragraph, architecture, journey, delta note, registry, status); the two index rows are link-only and covered by TC-026/TC-027
**Tags**: @docs, @naming

**Preconditions**:

- As TC-001.

**Steps**:

1. Run **P33**: for each of the **six prose locations whose Appendix B row requires a relation statement** — the Epic M2 context paragraph, architecture, the opening journey, the entrypoint delta note, the registry, and the status section — require both names and a boundary statement (`flat enumeration`, `enumerates … (group|projects)`, or `repos … checkouts … projects … group`).
2. Treat the two index rows (`m2/README.md` and `milestones/README.md`) as link-only locations: Appendix B requires "Both pages linked (13 targets)" and the S11/S18/S19 map rows, not a boundary sentence. Their link and row coverage is checked by **P26/P27**, so P33 does not over-assert prose the spec does not ask for.

**Expected Outcome**:

- `boundary_locations=6/6`; verdict `PASS`.

**Notes / Clarifications**:

- **Base-observed:** `boundary_locations=0/6` — `ARCH projects=5`, `EPD projects=4`, `REG repos=8 projects=4`; every location names one side or both without the relationship. Verdict **FAIL**.
- **Fixture-derived post-change expectation:** all six `boundary=OK` → **PASS**. The v1.0 procedure required 8 locations and forced a boundary sentence into the two index rows, which F-11/AC-F11-1/2 do not require; the six prose locations are exactly the ones the spec makes say it.

#### TC-M2DOM-034 - Exactly thirteen product files change and nothing outside the manifest moves

**Scenario Type**: Negative
**Impact Level**: Critical
**Priority**: High
**Related IDs**: AC-NFR1-1, NFR-1, DEC-1, Appendix C
**Test Type(s)**: Manual (static/diff)
**Automation Level**: Semi-automated (uncommitted procedure)
**Target Layer / Location**: the branch diff filtered to product files
**Tags**: @docs, @diff, @containment

**Preconditions**:

- As TC-001. The manifest is the spec's Appendix C, embedded in P34.

**Steps**:

1. Run **P34**: build the changed product set from the **base..worktree** state — `git diff --name-only "$BASE" -- .` plus `git ls-files --others --exclude-standard` — drop `doc/changes/**`, and compare against the 13-path manifest in both directions. This is decidable before the P5 commit and does not require a clean worktree.
2. Report forbidden-root hits, any `scripts/` path other than the registry, and (separately, not as a gate) the committed range `"$BASE"...HEAD` as a post-commit verification step. A pending post-commit check is reported as `post_commit_check=pending`, never as a pass.

**Expected Outcome**:

- `product_files=13/13`; `expected_not_changed=0`; `unexpected_changed=` (empty); `other_scripts_changed=0`; `post_commit_check=pending` before the commit; verdict `PASS`.

**Notes / Clarifications**:

- **Base-observed:** `product_files=0/13`; `expected_not_changed=13`; verdict **FAIL (change absent or out of scope)**. Zero changed files is a missing deliverable, not containment.
- **Fixture-derived post-change expectation:** `product_files=13/13`; `expected_not_changed=0`; `unexpected_changed=`; `other_scripts_changed=0`; `post_commit_check=pending (no product commit yet; base..worktree is the gate)` → **PASS**. The v1.0 gate combined `"$BASE"...HEAD` with `git status --porcelain`, so it could not pass at the P5 boundary; the base..worktree form is both decidable and non-vacuous.

#### TC-M2DOM-035 - Backlog preservation: every other story, region, and code is untouched

**Scenario Type**: Regression
**Impact Level**: Critical
**Priority**: High
**Related IDs**: AC-NFR2-1, NFR-2, F-4
**Test Type(s)**: Manual (static/diff)
**Automation Level**: Semi-automated (uncommitted procedure)
**Target Layer / Location**: `backlog.md`, all entries and leading regions
**Tags**: @docs, @backlog, @preservation

**Preconditions**:

- As TC-001; P09 has run in the same shell (it materialises the `fm`, `rg`, `cc`, and retirement-note snapshots).

**Steps**:

1. Run **P35**: compare every base `### ` story except M2-S11 with its head counterpart; report `stories_kept`, `changed`, `removed`; compute `base_headings`/`head_headings`/`added`; list new headings and reject any that is not M2-S18 or M2-S19; verify base heading order; compare the frontmatter, reading guide, cross-cutting principles, and retirement-note regions byte-for-byte.
2. The verdict accepts the base control (`new_headings=0`) and the conforming head (`new_headings=2`, both S18/S19); any other new heading fails.

**Expected Outcome**:

- Conforming head: `stories_kept=73 changed=0 removed=0`; `base_headings=74 head_headings=76 added=2`; `new_headings=2`; `order=OK`; all four regions `byte-identical`; verdict `PASS`.
- Base: the same with `head_headings=74 added=0`, `new_headings=0` → `PASS (control)`.

**Notes / Clarifications**:

- **Base-observed:** `base_headings=74 head_headings=74 added=0`; `stories_kept=73 changed=0 removed=0`; `order=OK`; four regions `byte-identical` → **PASS (control)**.
- **Fixture-derived post-change expectation:** `base_headings=74 head_headings=76 added=2` → **PASS**. The v1.0 plan gate quoted `67/69`; those literals are wrong in both directions. The post-change expectation is **74 → 76**; the base observation is **74 → 74**. This plan records both, labelled.

#### TC-M2DOM-036 - Both command pages stay `Status: Proposed (M2)` and nothing claims delivery

**Scenario Type**: Negative
**Impact Level**: Critical
**Priority**: High
**Related IDs**: AC-NFR3-1, NFR-3, F-7, F-12, RSK-5
**Test Type(s)**: Manual (content inspection)
**Automation Level**: Semi-automated (uncommitted procedure)
**Target Layer / Location**: the two command pages, the pack README, and the touched corpus
**Tags**: @docs, @status, @negative

**Preconditions**:

- As TC-001.

**Steps**:

1. Run procedure **P36**: require the exact header line on both command pages, scan the eleven touched documents for delivered/current/shipped claims that also mention the three planned surfaces (excluding the legitimate M1 attributions), require the planned-until-exit sentence verbatim, and forbid snapshot relabelling in the two pages and the pack README.
2. Read the two headers once: "planned" must read as planned, not as a provisional label on delivered work.

**Expected Outcome**:

- `proposed_headers=2/2`; `delivered_claims=0`; `pack_statement=verbatim`; `snapshot_relabels=0`; verdict `PASS`.

**Notes / Clarifications**:

- Observed on the pre-change tree: `proposed_headers=1/2` (only `projects.md`; `repos.md` does not exist); `delivered_claims=0`; `pack_statement=verbatim`; `snapshot_relabels=0`; verdict **FAIL**. Three of the four predicates are passing controls, which is the point: the claim scan cannot regress silently while the missing page is the only failing half.

#### TC-M2DOM-037 - The registry grows by exactly one sorted row and the guard reports no unregistered doc

**Scenario Type**: Happy Path
**Impact Level**: Critical
**Priority**: High
**Related IDs**: AC-NFR4-1, NFR-4, DEC-15, RSK-6
**Test Type(s)**: Manual (guard execution and content inspection)
**Automation Level**: Semi-automated (uncommitted procedure)
**Target Layer / Location**: `scripts/checks/forbidden-literals.registry.json`
**Tags**: @docs, @guard, @registry

**Preconditions**:

- As TC-001; `bun` available; the base registry snapshot exists in `$SH`.

**Steps**:

1. Run **P37**: `reg_entries()` reads the `registered` array from an explicit file argument — the head registry and the base snapshot separately — so head and base counts cannot be confused. Require `registered=140`, `base_registered=139`, `delta=1`, no duplicates, the `repos.md` entry at `queue_index+1`, `spend` at `repos_index+1`, and 0 unregistered-doc findings from the guard.
2. Run `bun run scripts/checks/forbidden-literals.ts` from the repository root and require exit 0.

**Expected Outcome**:

- `registered=140 base_registered=139 delta=1`; `queue_row=88 repos_row=89 spend_row=90`; `position=between-queue-and-spend`; `duplicates=0`; `unregistered_findings=0`; verdict `PASS`.

**Notes / Clarifications**:

- **Base-observed:** `registered=139 base_registered=139 delta=0`; `queue_row=88 repos_row=absent spend_row=89`; `position=repos-not-registered` → **FAIL**.
- **Fixture-derived post-change expectation:** `registered=140 base_registered=139 delta=1`; `queue_row=88 repos_row=89 spend_row=90`; `position=between-queue-and-spend`; `duplicates=0`; `unregistered_findings=0`; the fixture run of the real guard reports `140 file(s), 0 violations` → **PASS**. The v1.0 `reg_entries` read `$REG` for both sides, so `base_registered` silently equalled the head count; the explicit file argument fixes it.

#### TC-M2DOM-038 - The distribution guard passes under the default `TMPDIR` with no planning markers

**Scenario Type**: Regression
**Impact Level**: Important
**Priority**: Medium
**Related IDs**: AC-NFR5-1, NFR-5, DEC-16
**Test Type(s)**: Guard execution
**Automation Level**: Automated (existing guard, no change)
**Target Layer / Location**: `bash scripts/.tests/test-doc-distribution.sh`
**Tags**: @guard, @docs-only

**Preconditions**:

- Repository root; default `TMPDIR` (unset in this shell, resolved to tmpfs). This guard must **not** run under a repository-local `TMPDIR` — the requirement is the opposite of P39's.

**Steps**:

1. Run `env -u TMPDIR bash scripts/.tests/test-doc-distribution.sh` and capture the exit code and the drift summary.
2. Count `ados_distribution` markers in the twelve planning documents (zero expected: `doc/planning/**` is outside the guard's scan set).

**Expected Outcome**:

- `dist_guard_exit=0`; the summary reports `no drift — 82 in-scope docs`; `planning_markers=0`; verdict `PASS`.

**Notes / Clarifications**:

- Observed on the pre-change tree: `dist_guard_exit=0`; `(guard-doc-distribution)[OK] no drift — 82 in-scope docs; install set matches ados_distribution markers`; `planning_markers=0`; verdict **PASS (control)**. It must stay 0 after the change; a 13th in-scope doc would mean a planning file was put in scope or marked by mistake.

#### TC-M2DOM-039 - Both aggregate-gate runs are recorded; the repository-local full suite is authoritative and only the two named default-only failures are excused behind a green local run

**Scenario Type**: Regression
**Impact Level**: Critical
**Priority**: High
**Related IDs**: AC-NFR6-1, NFR-6, DEC-16, RSK-7
**Test Type(s)**: Guard execution
**Automation Level**: Automated (existing gate, no change)
**Target Layer / Location**: `pnpm check` (default and repository-local `TMPDIR`)
**Tags**: @guard, @environment

**Preconditions**:

- Repository root; `pnpm` and `bun` available; `node_modules` installed; a repository-filesystem directory creatable at `<repo>/tmp/tmpdir` (git-ignored).

**Steps**:

1. Run **P39** with `RUN_GATES=1` for the two gate invocations: (a) the authoritative repository-local `TMPDIR` full-suite `pnpm check`; (b) the default-`TMPDIR` run. Both logs and exit codes are written under `$SH`.
2. Classify exactly as spec v1.1 AC-NFR6-1 requires:
   - (a) `repo_local_exit=0` is mandatory; **any** failure in the repository-local run, including a repeated `TC-WIRE-002`, is `delivery`.
   - (b) Both runs must be recorded (`recorded_local=yes`, `recorded_default=yes`).
   - (c) A default-run failure of `CI baseline parity` and a default-run `TC-WIRE-002` timeout are each recorded and re-run; they are excused **only** when every default failure is one of those two and the repository-local run is green on the same head. A recorded re-run entry is required (`p39-rerun.txt`); a missing entry is `missing-rerun`, not a pass.
   - (d) Any other default-run failure is `delivery`.
3. Run the classifier's four synthetic branches: both-green, excused pair, unexcused default failure, repository-local failure, and excused-pair-without-rerun (all recorded in the fixture log).

**Expected Outcome**:

- `repo_local_exit=0`; `recorded_local=yes`; `recorded_default=yes`; `default_failure_class=none` or `excused`; `rerun_recorded=yes` when `excused`; verdict `PASS`.

**Notes / Clarifications**:

- **Base-observed:** repository-local full-suite run exit 0 (`7133 pass`, `4 skip`, `0 fail`, `7137 tests` across `880` files); default run exit 1 with exactly `CI baseline parity (hermetic partial clone)` and `TC-WIRE-002 … timed out after 5000ms`. Both are recorded; the two named failures are re-run standalone (parity reproduces the cross-device clone; `TC-WIRE-002` is a 5 s timing sensitivity that passes inside the full repository-local suite) and the pair is classified **`excused`** only because `repo_local_exit=0`. Verdict **PASS (policy-conforming)**, not an environmental reclassification.
- **Synthetic classifier fixtures:** `none` → PASS, `excused` with rerun → PASS, unexcused default failure → FAIL (`delivery`), repository-local failure with a repeated `TC-WIRE-002` → FAIL (`delivery`), excused pair without a rerun record → FAIL (`missing-rerun`). The failure branches are therefore proven, not assumed.
- A repeat `TC-WIRE-002` inside the authoritative run is a delivery failure under AC-NFR6-1(a); the spec's default-run allowance never reaches the repository-local run.

#### TC-M2DOM-040 - The touched documents satisfy the structural diagram conditions, with eight key flows each owning one block

**Scenario Type**: Corner Case
**Impact Level**: Critical
**Priority**: High
**Related IDs**: AC-NFR7-1, NFR-7, RSK-9, DEC-9
**Test Type(s)**: Manual (structural inspection)
**Automation Level**: Semi-automated (uncommitted procedure)
**Target Layer / Location**: every touched document that contains fences: `architecture.md` (20 fences, 10 mermaid), `entrypoint-delta.md` (4), `commands/projects.md` (6), `cli-command-registry.md` (2), plus the new `commands/repos.md`
**Tags**: @docs, @mermaid, @structural

**Preconditions**:

- As TC-001.

**Steps**:

1. Run procedure **P40**: per file, count fences (must be even) and inventory each block as `tag|first-body-line`. Flag any untagged block whose first body line starts with a diagram keyword (an untagged diagram) and any `mermaid` block whose first line does not.
2. On `architecture.md`, require `## C4 Level 1`, `## C4 Level 2`, and `## C4 Level 3` exactly once each (matched with `([^0-9]|$)` so `Level 10` cannot satisfy it) and exactly 8 `###` headings under `## Key flows`, each followed by exactly one mermaid block.

**Expected Outcome**:

- Every file `fences=<even>` with `untagged_diagrams=0` and `bad_keywords=0`; `c4_headings=1/1/1`; `key_flows_headings=8/8`; `flow_ownership_bad=0`; verdict `PASS`.

**Notes / Clarifications**:

- Observed on the pre-change tree: all files even with `untagged_diagrams=0` and `bad_keywords=0`; `c4_headings=1/1/1`; `key_flows_headings=7/8`; `flow_ownership_bad=0`; verdict **FAIL**. The base has 20 fences and 10 mermaid blocks in `architecture.md`; the new cross-repository flow makes it 22 and 11. Every other condition is a passing control, so the single failing number is the flow count — exactly the structural consequence of F-5.
- No validator is invented (G-3); this is the same structural read the pack already uses, and it is the whole of NFR-7.

#### TC-M2DOM-041 - All 26 ticket clauses are present with no addition and no omission

**Scenario Type**: Corner Case
**Impact Level**: Critical
**Priority**: High
**Related IDs**: AC-NFR8-1, NFR-8, F-1, F-2, F-3, Appendix A
**Test Type(s)**: Manual (content inspection)
**Automation Level**: Semi-automated (uncommitted procedure)
**Target Layer / Location**: `backlog.md`, the three amended or new entries together
**Tags**: @docs, @fidelity

**Preconditions**:

- As TC-001; `clause_rows()` from P00.

**Steps**:

1. Run procedure **P41**: concatenate the S18, S19, and M2-S11 entries, squash the result, and run the full 26-row anchor table (12 S18 + 11 S19 + 3 S11-amendment rows). Print every missing id with its short clause.
2. Compare the reported total with 26 so a table edit that silently drops a row fails the scan.

**Expected Outcome**:

- `clause_scan: total=26 present=26 missing=0`; no `MISSING` lines; verdict `PASS`.

**Notes / Clarifications**:

- Observed on the pre-change tree: `clause_scan: total=26 present=1 missing=25`; verdict **FAIL**. The single hit is `S11-1`'s retained anchor (`git common dir marker … host-level index`), which exists at base — a control proving the table matches real text rather than the change's imagination.
- Row totals are counted by the table itself, so the earlier draft's pipe-delimited-row defect (an anchor containing `|` split a row and dropped `S19-T6`) was found by this run and fixed before publication.

#### TC-M2DOM-042 - The forbidden-literals guard is clean and no private name was introduced

**Scenario Type**: Negative
**Impact Level**: Important
**Priority**: Medium
**Related IDs**: AC-NFR9-1, NFR-9, RSK-1
**Test Type(s)**: Guard execution
**Automation Level**: Automated (existing guard, no change)
**Target Layer / Location**: `bun run scripts/checks/forbidden-literals.ts` and the added text
**Tags**: @guard, @privacy

**Preconditions**:

- Repository root; `bun` available; the registry change (TC-037) is in place before the final run.

**Steps**:

1. Run `bun run scripts/checks/forbidden-literals.ts` with all scope classes scanned; record the exit code, the class summary, and the violation count.
2. Read the added lines against spec NFR-9 and §7.2 for a private fleet, repository, host, hosted, or proprietary product name the guard's literal list cannot know (declared residue G-4).

**Expected Outcome**:

- `forbidden_exit=0`; `OK forbidden-literals: 5/5 scope classes scanned, 0 violations`; `violations=0`; verdict `PASS`.

**Notes / Clarifications**:

- Observed on the pre-change tree: `forbidden_exit=0`; `OK forbidden-literals: 5/5 scope classes scanned, 0 violations`; `userFacingDocs: 139 file(s)`; `violations=0`; verdict **PASS (control)**. After the change the same command must still exit 0 with `userFacingDocs: 140 file(s)` — an unregistered new page fails closed and would surface here as well as in P37.

#### TC-M2DOM-043 - No relative link is broken and no pack document restates a story's acceptance block

**Scenario Type**: Corner Case
**Impact Level**: Important
**Priority**: Medium
**Related IDs**: AC-NFR10-1, NFR-10
**Test Type(s)**: Manual (content inspection)
**Automation Level**: Semi-automated (uncommitted procedure)
**Target Layer / Location**: the twelve planning documents, relative link targets
**Tags**: @docs, @links

**Preconditions**:

- As TC-001.

**Steps**:

1. Run procedure **P43**: for each touched document, extract every `](target)` link, strip anchors, skip absolute URLs and `mailto:`, resolve the remainder against the file's directory, and report each missing target.
2. Count `- AC:` and `**Given**` blocks in the seven pack documents (zero expected: the pack references story codes instead of restating acceptance blocks).

**Expected Outcome**:

- `broken_links=0`; `restated_ac_blocks=0`; verdict `PASS`.

**Notes / Clarifications**:

- Observed on the pre-change tree: `broken_links=0`; `restated_ac_blocks=0`; verdict **PASS (control)**. The new `commands/repos.md` must resolve its own relative links (`../contracts.md`, `../architecture.md`, `../../../backlog.md`) and must be linked from both indices (TC-026/TC-027) — a page that exists but is unreachable fails there rather than here.
- A paraphrase of an acceptance criterion in prose is not machine-detectable; that residue is G-9.

#### TC-M2DOM-044 - The retention oracle is sound: delete, modify, swap, and outside-insertion fixtures are each detected

**Scenario Type**: Regression
**Impact Level**: Critical
**Priority**: High
**Related IDs**: AC-NFR11-1, NFR-11, F-12, RSK-10
**Test Type(s)**: Manual (static/diff)
**Automation Level**: Semi-automated (uncommitted procedure)
**Target Layer / Location**: `status.md` retention oracle plus `/tmp` fixtures
**Tags**: @docs, @diff, @oracle-soundness

**Preconditions**:

- As TC-001; the base `status.md` snapshot (212 lines) exists in `$SH`.

**Steps**:

1. Run **P44**: state the oracle (`whole-file-line-retention`, not a whole-section `cmp`), compute removed/modified and added counts for the real tree, then build a conforming fixture (base plus one appended dated section with a blank separator) and require `removed=0`, `added>0`, `outside=0`.
2. Derive four mutants from the conforming fixture — delete a base line, replace a base line, swap two adjacent base lines, insert a line before the new section — and require each to be detected.

**Expected Outcome**:

- Real tree: `removed_or_modified=0`; fixture: `conforming_fixture: removed=0 added=5 outside=0 verdict=OK`; each mutant flagged; verdict `PASS`.

**Notes / Clarifications**:

- **Base-observed and fixture-verified:** the conforming fixture is accepted (`removed=0`, `added=5`, `outside=0`), and all four mutants are detected (`delete=1`, `modify=1`, `swap=1`, `outside_hunks=1`). The real tree is `removed_or_modified=0`; on the conforming head the same oracle accepts 18 additions. Verdict **PASS**. No whole-section `cmp` appears anywhere in this plan.

#### TC-M2DOM-045 - The required half of the naming matrix holds in all seventeen Appendix B locations

**Scenario Type**: Negative
**Impact Level**: Critical
**Priority**: High
**Related IDs**: AC-NFR12-1, NFR-12, F-14, Appendix B
**Test Type(s)**: Manual (content scan)
**Automation Level**: Semi-automated (uncommitted procedure)
**Target Layer / Location**: the twelve planning documents, region-scoped per Appendix B row
**Tags**: @docs, @scan, @naming

**Preconditions**:

- As TC-001.

**Steps**:

1. Run **P45**: walk the same 17 regions; assert each region is non-empty and contains its required statement. The S19 region's required statement is `one lifecycle` (the S19 entry does not have to repeat `projects list`; Appendix B places the group statement in S18-T5), and the M2-S18/M2-S19 Appendix B row is split into `BL-18` and `BL-19`.
2. Run both fixtures: a conforming `## repos.v1` snippet passes; a snippet missing `repo key` is reported as missing.

**Expected Outcome**:

- `matrix_rows_required=17/17`; `regions_empty=0`; `positive_fixture=OK`; `negative_fixture=detected`; verdict `PASS`.

**Notes / Clarifications**:

- **Base-observed:** `matrix_rows_required=1/17` — only `JRN` passes (the old journey names `projects list`); `BL-S11` is now non-empty (`### M2-S11 ` anchor) and fails on content because its required `repos list` is absent; `positive_fixture=OK`; `negative_fixture=detected` → **FAIL**.
- **Fixture-derived post-change expectation:** `matrix_rows_required=17/17`, `regions_empty=0` → **PASS**. The S11 row is the change's most important location; it is now checked by both halves.

## 6. Environments and Test Data

| Aspect | Detail |
|---|---|
| Environment | Local developer worktree of this repository on branch `docs/GH-303/project-groups-domain-model`; no server, container, service, credential, or network dependency |
| Toolchain | `git` (diff and base snapshots), `bash`, `awk`, `grep`, `sed`, `diff`, `comm`, `cmp`, `bun` (guards and the workspace test suite), `pnpm` (aggregate gate); all already required by the repository |
| Base revision | `5372dbacb9c36e1d79d1e55873264155a53f44ff` (`origin/main-tools` at authoring time). Snapshots are materialised with `git show "$BASE:<path>"` so later base movement cannot silently widen a comparison |
| Branch head at authoring | `5a6cbf48` — specification, pm-notes, and the DoR record; **no product file is edited**, which is why every new-content procedure fails and every preservation procedure passes. The conforming fixture is a separate `git worktree` at base `5372dbac` with the thirteen changes applied and **never committed** (`/tmp/gh303/fx/repo`) |
| Files under test | 11 existing planning documents + 1 new (`milestones/m2/commands/repos.md`) + `scripts/checks/forbidden-literals.registry.json`; all paths in spec Appendix C |
| Test data | Base snapshots at `/tmp/gh303/base-{backlog,status,milestones-README,registry,forbidden}.{md,json}`, materialised with `git show 5372dbac:<path>`; head files read from the worktree; the conforming fixture lives only in `/tmp/gh303/fx/repo`; no fixture is ever written inside the repository |
| Mutation fixtures | `/tmp`-only, never committed: a flat-`projects list` sentence and a group-meaning `repos` sentence (P32, plus the required-boundary and base-`board.md` negative controls), a conforming `repos.v1` snippet and a deficient one (P45), a mutated `ados supervise` row (P31), a conforming status head and four mutants — delete, modify, swap, insert-outside (P44), and five synthetic P39 gate logs (both-green, excused pair, unexcused default failure, repository-local failure, excused pair without a rerun record) |
| Base-observed facts (measured at `5372dbac`, not assumed) | `backlog.md` 1454 lines: M2-S17 heading 1262, last content 1285, block-closing `---` 1287, `## Epic M3` 1289 → insertion window `1286:1286` (one blank line); M2-S11 entry 1169–1183; retirement note 1051–1054, context window 1055–1055 (`paragraph_lines=0`); `status.md` 212 lines with its last `##` heading at 187 and no new section; `milestones/README.md` M2 row 12 targets; `m2/README.md` 12 contents rows; `architecture.md` 20 fences / 10 mermaid / C4 1-1-1 / 7 key flows; `test-scenarios.md` 40 seeds and 40 `Assert:` lines; registry 139 entries with `m2/commands/queue.md` at index 88 and `spend.md` at 89; backlog `###` headings 74; `base_headings=74 head_headings=74 added=0` |
| Fixture-derived post-change expectations (measured on the conforming worktree, never committed) | `s17_last=1293 separator=1310 epic_m3=1312 window=1294:1309`, `s18_line=1294 s19_line=1300`, `placement=inside-window`; retirement note `1051..1054`, `context_paragraph=1055..1060`, `paragraph_lines=4`, `paragraph_strictly_between=OK`; backlog headings `74 → 76`, `added=2`; `status.md` `new_section_count=1` at line 214, `additions=18`, `removed=0`; registry `139 → 140`, `queue=88 repos=89 spend=90`; `architecture.md` 22 fences / 11 mermaid / 8 key flows; `repos.md` 4 fences; `product_files=13/13`; `boundary_locations=6/6`; `matrix_rows_required=17/17`, `rows_with_survivors=0/17`. These are evidence that the oracles are satisfiable; they are not universal literals, and the procedures recompute each range from the head. |
| Plan-gate token note | The plan's P1 gate expectation for P35 must be the fixture-derived `base_headings=74 head_headings=76 added=2` (base-observed `74/74/0`); `67/69` is not reproducible. For P08/P09 the post-change expectation is the invariant (`placement=inside-window`, `separator_sequence=identical`, `blank_line_before_separator=1`, `paragraph_lines>0`, `retirement_note=1051..1054`), because the separator and window are recomputed from the head; the base-only literals (`separator=1287 window=1286:1286`, `context_paragraph=1055..1055`) are labelled as base observations. |
| Guard scope | `test-doc-distribution.sh` scans `doc/guides/**` and a fixed standalone set (82 in-scope docs) and skips `doc/planning/**`; `forbidden-literals.ts` scans `doc/**` minus `doc/changes/**` and `doc/decisions/**` and fails closed on an unregistered new doc, so the new page needs exactly one registration |
| Isolation | Every procedure is read-only with respect to the repository: writes go to `/tmp/gh303` only, and no file under test is edited to make a check pass. `pnpm check` writes `tmp/tmpdir/` (git-ignored) as its `TMPDIR` |
| Environment caveat | `/tmp` is tmpfs in this checkout: the two doc guards have opposite `TMPDIR` requirements (G-6). P38 runs the distribution guard with `env -u TMPDIR`; P39 runs the aggregate gate twice and follows spec v1.1 AC-NFR6-1: the repository-local full suite is authoritative (exit 0; any failure there is a delivery failure), both runs are recorded, and only a recorded, re-run default-run `ci-baseline-parity` failure or `TC-WIRE-002` timeout is excused while the repository-local run is green on the same head |
| Cleanup | `rm -rf /tmp/gh303` and `rm -rf <repo>/tmp/tmpdir` |
| Evidence capture | The Section 10 log, the guard summaries, and the two gate results are pasted into the PR description per `.ai/rules/testing-strategy.md` |

## 7. Automation Plan and Implementation Mapping
### 7.1 Procedure Pack — How to Run, in Order

Run from the repository root on the branch head with `bash`. Every procedure is uncommitted and read-only with respect to the repository: it writes only under `/tmp/gh303`, never stages, never edits a file under test, and is never added to `tests/**`, `scripts/**`, or `.ai/**` (AC-NFR1-1). **P00 is a shared preamble**: it defines every path (`$BL`, `$ST`, `$MR`, `$M2`, `$A`, `$RG`, `$R`, `$PJ`, `$REG`, `$SH`), the extractors (`entry()`, `section()`, `story_section()`, `firstsec()`, `squash()`), the 26-clause table, `fence_blocks()`, the retention helpers (`diffstat()`, `newsecs_of()`, `newsec_of()`, `newsec_count()`), the derived backlog ranges (`backlog_ranges()`), and the naming-matrix helpers (`matrix_rows()`, `path_of()`, `region()`, `forbidden_hits()`, `forbidden_count()`). **Run each procedure in a fresh shell** as `bash -c 'source P00; source Pn'`; no block depends on another block's definitions, and every block starts with a loud guard that aborts if P00 is not loaded or if a helper it declares is missing. Procedure numbers match test-case numbers (`P01` = `TC-M2DOM-001`, … `P45` = `TC-M2DOM-045`); Section 7.2 maps each TC to its block.

**P00 — shared preamble: base snapshots, all helpers, derived ranges, and the 26-clause table**

```bash
# P00 — shared preamble: base snapshots, paths, extractors, derived facts.
# Every procedure begins by asserting the preamble is loaded, and helpers are
# defined here exactly once so no block depends on another block's definitions.
BASE=$(git rev-parse 5372dbac)
ROOT=$(git rev-parse --show-toplevel); cd "$ROOT" || exit 1
BL=doc/planning/oss-tooling/backlog.md
ST=doc/planning/oss-tooling/status.md
MR=doc/planning/oss-tooling/milestones/README.md
M2=doc/planning/oss-tooling/milestones/m2
REG=scripts/checks/forbidden-literals.registry.json
A="$M2/architecture.md"
RG=doc/planning/oss-tooling/cli-command-registry.md
R="$M2/commands/repos.md"
PJ="$M2/commands/projects.md"
SH=/tmp/gh303
mkdir -p "$SH"
P00_READY=gh303
require_p00() { [ "${P00_READY:-}" = "gh303" ] || { echo "FATAL: P00 preamble not loaded; run each block as bash -c \"\$(P00); \$(Pn)\"" >&2; exit 1; }; }
need() { local n; for n in "$@"; do case "$n" in
  entry|section|firstsec|squash|cnt|has|clause_rows|fence_blocks|diffstat|newsec_of|newsecs_of|newsec_count|matrix_rows|path_of|region|forbidden_hits|forbidden_count|backlog_ranges|story_section) command -v "$n" >/dev/null 2>&1 || { echo "FATAL: missing helper $n (P00)" >&2; exit 1; } ;;
  BASE|BL|ST|MR|M2|REG|A|RG|R|PJ|SH) [ -n "${!n:-}" ] || { echo "FATAL: missing variable $n (P00)" >&2; exit 1; } ;;
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

git show "$BASE:$BL" > "$SH/base-backlog.md"
git show "$BASE:$ST" > "$SH/base-status.md"
git show "$BASE:$MR" > "$SH/base-milestones-README.md"
git show "$BASE:doc/planning/oss-tooling/cli-command-registry.md" > "$SH/base-registry.md"
git show "$BASE:$REG" > "$SH/base-forbidden.json"
echo "base=$BASE base_backlog_lines=$(wc -l < "$SH/base-backlog.md") base_status_lines=$(wc -l < "$SH/base-status.md")"

clause_rows() { cat <<'CLAUSES'
S18-G|M2-S18|group of repositories.*enumerat|S18 goal: configured group of repositories, enumerable with members, workspace as optional discovery root
S18-T1|M2-S18|project configuration.*member repositor|S18 task 1: project configuration declaring member repositories, mixed trackers valid
S18-T2|M2-S18|workspace.directory discovery root|S18 task 2: optional workspace-directory discovery root, never required
S18-T3|M2-S18|projects list.*member repos.*health.*state|S18 task 3: projects list renders groups with members, health, state
S18-T4|M2-S18|project scop.*queue and status|S18 task 4: project scoping for queue and status reads
S18-T5|M2-S18|repos.*flat enumeration.*projects.*group|S18 task 5: naming boundary repos = flat enumeration, projects = groups
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
S11-2|M2-S11|repos list.*repo key.*root.*state location.*daemon reachability.*handover state|S11 amended: repos list reporting the five fields
S11-3|M2-S11|deprecation alias|S11 amendment transition note
CLAUSES
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

backlog_ranges() { # set the derived ranges from $BL on every call, never reused across blocks
  S11_LINE=$(grep -n '^### M2-S11 ' "$BL" | cut -d: -f1)
  S11_END=$(awk -v s="$S11_LINE" 'NR>s && /^#{2,3} /{print NR-1; exit}' "$BL")
  NOTE_S=$(grep -n '^Note: the M1 redefinition moved the queue' "$BL" | cut -d: -f1)
  NOTE_E=$(grep -n '^the gap is deliberate\. M2 stories keep their codes\.$' "$BL" | cut -d: -f1)
  S2_LINE=$(grep -n '^### M2-S2 ' "$BL" | cut -d: -f1)
  S17_LINE=$(grep -n '^### M2-S17 ' "$BL" | cut -d: -f1)
  S17_LAST=$(awk -v s="$S17_LINE" 'NR>s { if ($0 ~ /^---$/ || $0 ~ /^## / || $0 ~ /^### /) exit; if (NF>0) l=NR } END{print l+0}' "$BL")
  M3_LINE=$(grep -n '^## Epic M3' "$BL" | cut -d: -f1)
  SEP_LINE=$(awk -v m="$M3_LINE" 'NR<m && /^---$/{l=NR} END{print l+0}' "$BL")
  WS=$((S17_LAST+1)); WE=$((SEP_LINE-1))
}

forbidden_hits() { # stdin text; $1=flat|group|both; prints "TYPE<TAB>statement"
  awk -v mode="$1" '
  function norm(s,  t){ t=tolower(s); gsub(/[[:space:]]+/," ",t); return t }
  function flat(t){ return (t ~ /(^|[^a-z0-9])projects( list| command| surface)?[^.]{0,90}(enumerat|one (cli )?overview|host overview|lists? (every|all|each)|repo key|state location|daemon reachability|handover state)/) }
  function group(t,  rest,seg,p){ rest=t
    while (match(rest, /(^|[^a-z0-9])repos([^a-z0-9]|$)/)) {
      seg=substr(rest, RSTART, 90)
      p=index(seg,"projects"); if (p>0) seg=substr(seg,1,p-1)
      if (seg ~ /(^|[^a-z0-9])(group|grouping|member)/ && seg !~ /enumerat/) return 1
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
BL-S11|BL|s11backlog||repos list|@both
BL-18|BL|entry|### M2-S18 |projects list|@both
BL-19|BL|entry|### M2-S19 |one lifecycle|@both
BL-CTX|BL|para|ctx|repositor.*project.*workspace|@flat
CT-RV1|contracts|sect|## repos.v1|repo key|group identity
CT-PV1|contracts|sect|## projects.v1|member|projectKey.{0,40}repository identity
ARCH|architecture|whole||group of repositor|projects list.{0,60}host index
CMD-R|cmd-repos|whole||flat enumeration|projects\[\]
CMD-P|cmd-projects|whole||member|@flat
TS-S11|test-scenarios|s11seeds||repos list|@both
TS-NEW|test-scenarios|newgroup||group|@both
JRN|journeys|firstsec||projects list|@flat
EPD|entrypoint-delta|whole||flat enumeration|host overview
M2RD|m2-readme|whole||commands/repos.md|\| M2-S11 .{0,80}projects\.v1
MSRD|milestones-readme|m2row||m2/commands/repos.md|XXXNONE
REG|registry|whole||ados repos.{0,120}flat enumeration|distinct surfaces
STAT|status|newsec||naming boundary|@both
MATRIX
}
path_of() { case "$1" in
  BL) echo "$BL";; contracts) echo "$M2/contracts.md";; architecture) echo "$A";;
  cmd-repos) echo "$R";; cmd-projects) echo "$PJ";;
  test-scenarios) echo "$M2/test-scenarios.md";; journeys) echo "$M2/journeys.md";;
  entrypoint-delta) echo "$M2/entrypoint-delta.md";; m2-readme) echo "$M2/README.md";;
  milestones-readme) echo "$MR";; registry) echo "$RG";;
  status) echo "$ST";; *) echo "";; esac; }
region() { # $1=file $2=mode $3=arg
  [ -f "$1" ] || return 0
  case "$2" in
    whole) cat "$1" ;;
    entry) entry "$1" "$3" ;;
    sect) section "$1" "$3" ;;
    firstsec) firstsec "$1" ;;
    para) backlog_ranges; sed -n "$((NOTE_E+1)),$((S2_LINE-1))p" "$BL" ;;
    s11backlog) entry "$1" '### M2-S11 ' ;;
    s11seeds) story_section "$1" 'M2-S11' ;;
    newgroup) awk '/^## M2-S1[89] /{f=1} f&&/^## /&&!/^## M2-S1[89] /{f=0} f' "$1" ;;
    m2row) grep -E '^\| M2 \(' "$1" ;;
    newsec) local s; s=$(newsec_of "$SH/base-status.md" "$1"); [ -z "$s" ] && return 0; sed -n "${s},\$p" "$1" ;;
  esac
}
```

**P01 — M2-S11 retained clauses, `repos list` fields, and the transition note**

```bash
[ "${P00_READY:-}" = "gh303" ] || { echo "FATAL: P00 preamble not loaded; run each block in a fresh shell as 'source P00; source Pn'" >&2; exit 1; }
require_p00; need entry squash
e=$(entry "$BL" '### M2-S11 '); eq=$(printf '%s' "$e" | squash)
c=0; for a in 'git common dir marker' 'host.level index' 'migration note' 'cannot observe each other' 'disjoint phase state and queue entries'; do
  printf '%s' "$e" | grep -Eiq -- "$a" && c=$((c+1)) || echo "retained MISSING: $a"; done
echo "retained_clauses=$c/5"
printf '%s\n' "$e" | grep -Fxq -- '- Depends on: M0-S5, M1-S17.' && echo "depends_line=exact" || echo "depends_line=CHANGED"
printf '%s' "$eq" | grep -Eiq 'repos list.*repo key.*root.*state location.*daemon reachability.*handover state' && echo "repos_list_fields=OK" || echo "repos_list_fields=MISSING"
printf '%s' "$e" | grep -Eiq 'deprecation alias' && echo "transition_note=OK" || echo "transition_note=MISSING"
printf '%s' "$e" | grep -Eiq 'a projects command gives one CLI overview' && echo "goal_projects_command=PRESENT (must be ABSENT)" || echo "goal_projects_command=ABSENT"
[ "$c" -eq 5 ] && printf '%s' "$eq" | grep -Eiq 'repos list.*handover state' && printf '%s' "$e" | grep -Eiq 'deprecation alias' && echo "P01 verdict: PASS" || echo "P01 verdict: FAIL"
```

**P02 — naming inside the M2-S11 entry and the collision clause's single copy**

```bash
[ "${P00_READY:-}" = "gh303" ] || { echo "FATAL: P00 preamble not loaded; run each block in a fresh shell as 'source P00; source Pn'" >&2; exit 1; }
require_p00; need entry squash forbidden_hits
e=$(entry "$BL" '### M2-S11 ')
pl_flat=$(printf '%s' "$e" | squash | forbidden_hits flat | wc -l)
pl_raw=$(printf '%s' "$e" | grep -o 'projects list' | wc -l)
rl=$(printf '%s' "$e" | grep -o 'repos list' | wc -l)
rg=$(printf '%s' "$e" | squash | forbidden_hits group | wc -l)
moved=$(grep -c 'disjoint phase state and queue entries' "$BL")
s11=$(grep -n '^### M2-S11 ' "$BL" | cut -d: -f1)
s11e=$(awk -v s="$s11" 'NR>s && /^#{2,3} /{print NR-1; exit}' "$BL")
inside=$(sed -n "${s11},${s11e}p" "$BL" | grep -c 'disjoint phase state and queue entries')
echo "flat_projects_statements_in_entry=$pl_flat projects_list_raw_mentions=$pl_raw repos_list_in_entry=$rl group_meaning_repos_in_entry=$rg collision_clause_copies=$moved inside_s11=$inside"
[ "$pl_flat" -eq 0 ] && [ "$rl" -ge 1 ] && [ "$rg" -eq 0 ] && [ "$moved" -eq 1 ] && [ "$inside" -eq 1 ] && echo "P02 verdict: PASS" || echo "P02 verdict: FAIL"
```

**P03 — M2-S18 entry shape and its twelve ticket clauses**

```bash
[ "${P00_READY:-}" = "gh303" ] || { echo "FATAL: P00 preamble not loaded; run each block in a fresh shell as 'source P00; source Pn'" >&2; exit 1; }
h18=$(grep -m1 '^### M2-S18 ' "$BL" || true)
if [ -z "$h18" ]; then echo "S18=absent"; echo "clauses_present=0/12"; echo "P03 verdict: FAIL (change absent)"; else
  e18=$(entry "$BL" "$h18" | squash)
  ok=0; tot=0; miss=0
  while IFS='|' read -r id story anchor clause; do
    [ "$story" = "M2-S18" ] || continue; tot=$((tot+1))
    if printf '%s' "$e18" | grep -Eiq -- "$anchor"; then ok=$((ok+1)); else miss=$((miss+1)); echo "MISSING $id: $clause"; fi
  done < <(clause_rows)
  shape=0; for lab in '- Goal:' '- Tasks:' '- AC:' '- Depends on:'; do printf '%s\n' "$(entry "$BL" "$h18")" | grep -q -- "$lab" && shape=$((shape+1)); done
  tick=$(entry "$BL" "$h18" | grep -c -- '^- Ticket:')
  echo "clauses_present=$ok/$tot shape_labels=$shape/4 ticket_line=$tick"
  [ "$ok" -eq "$tot" ] && [ "$shape" -eq 4 ] && [ "$tick" -eq 0 ] && echo "P03 verdict: PASS" || echo "P03 verdict: FAIL"
fi
```

**P04 — mixed tracker kinds and the `not-yet-supported` classification**

```bash
[ "${P00_READY:-}" = "gh303" ] || { echo "FATAL: P00 preamble not loaded; run each block in a fresh shell as 'source P00; source Pn'" >&2; exit 1; }
h18=$(grep -m1 '^### M2-S18 ' "$BL" || true)
ct=$(mktemp); cp "$M2/contracts.md" "$ct"
s18=$( [ -n "$h18" ] && entry "$BL" "$h18" | squash || echo "")
echo "s18_nyts=$(printf '%s' "$s18" | grep -oic 'not-yet-supported' || true) contracts_nyts=$(grep -oic 'not-yet-supported' "$ct" || true)"
printf '%s' "$s18" | grep -Eiq 'mixing tracker kinds.*validation' && echo "s18_validation=OK" || echo "s18_validation=MISSING"
printf '%s' "$s18" | grep -Eiq 'rather than rejected' && echo "s18_rather_than_rejected=OK" || echo "s18_rather_than_rejected=MISSING"
grep -Eiq 'trackers? (are|is) not supported|mixed trackers are rejected' "$BL" "$ct" && echo "softening=PRESENT" || echo "softening=ABSENT"
a=$(printf '%s' "$s18" | grep -oic 'not-yet-supported' || true); b=$(grep -oic 'not-yet-supported' "$ct" || true)
[ "${a:-0}" -ge 1 ] && [ "${b:-0}" -ge 1 ] && echo "P04 verdict: PASS" || echo "P04 verdict: FAIL"
rm -f "$ct"
```

**P05 — M2-S19 entry shape and its eleven ticket clauses**

```bash
[ "${P00_READY:-}" = "gh303" ] || { echo "FATAL: P00 preamble not loaded; run each block in a fresh shell as 'source P00; source Pn'" >&2; exit 1; }
h19=$(grep -m1 '^### M2-S19 ' "$BL" || true)
if [ -z "$h19" ]; then echo "S19=absent"; echo "clauses_present=0/11"; echo "P05 verdict: FAIL (change absent)"; else
  e19=$(entry "$BL" "$h19" | squash); ok=0; tot=0
  while IFS='|' read -r id story anchor clause; do
    [ "$story" = "M2-S19" ] || continue; tot=$((tot+1))
    if printf '%s' "$e19" | grep -Eiq -- "$anchor"; then ok=$((ok+1)); else echo "MISSING $id: $clause"; fi
  done < <(clause_rows)
  shape=0; for lab in '- Goal:' '- Tasks:' '- AC:' '- Depends on:'; do entry "$BL" "$h19" | grep -q -- "$lab" && shape=$((shape+1)); done
  echo "clauses_present=$ok/$tot shape_labels=$shape/4"
  [ "$ok" -eq "$tot" ] && [ "$shape" -eq 4 ] && echo "P05 verdict: PASS" || echo "P05 verdict: FAIL"
fi
```

**P06 — the three S19 acceptance criteria as independent items**

```bash
[ "${P00_READY:-}" = "gh303" ] || { echo "FATAL: P00 preamble not loaded; run each block in a fresh shell as 'source P00; source Pn'" >&2; exit 1; }
h19=$(grep -m1 '^### M2-S19 ' "$BL" || true)
if [ -z "$h19" ]; then echo "S19=absent numbered_items=0/3"; echo "P06 verdict: FAIL (change absent)"; else
  ac=$(entry "$BL" "$h19" | awk '/^- AC:/{f=1;next} /^- Depends on:/{f=0} f')
  n=$(printf '%s\n' "$ac" | grep -cE '^[[:space:]]+[0-9]+\.')
  a1=$(printf '%s\n' "$ac" | grep -Eci 'one spec.*two branches')
  a2=$(printf '%s\n' "$ac" | grep -Eci 'corroborated.*per member')
  a3=$(printf '%s\n' "$ac" | grep -Eci 'failing member named|blocks the shared')
  echo "numbered_items=$n/3 a1=$a1 a2=$a2 a3=$a3"
  [ "$n" -eq 3 ] && [ "$a1" -ge 1 ] && [ "$a2" -ge 1 ] && [ "$a3" -ge 1 ] && echo "P06 verdict: PASS" || echo "P06 verdict: FAIL"
fi
```

**P07 — S19 task clauses traced into the contracts**

```bash
[ "${P00_READY:-}" = "gh303" ] || { echo "FATAL: P00 preamble not loaded; run each block in a fresh shell as 'source P00; source Pn'" >&2; exit 1; }
ct="$M2/contracts.md"
tbl() { cat <<'T'
T1|member repositor.*slices
T2|one lifecycle.*branch.*pull request
T3|per-member gates|per-repo gates
T4|branch cleanup.*issue closure
T5|dependency edges
T6|evidence.*(every member pull request|all member)
T
}
if [ -f "$ct" ]; then
  ok=0; tot=0
  while IFS='|' read -r id pat; do tot=$((tot+1)); grep -Eiq -- "$pat" "$ct" && { ok=$((ok+1)); } || echo "contract MISSING: $id"; done < <(tbl)
  echo "s19_task_to_contract=$ok/$tot"
  [ "$ok" -eq "$tot" ] && echo "P07 verdict: PASS" || echo "P07 verdict: FAIL"
else echo "contracts=absent"; echo "P07 verdict: FAIL"; fi
```

**P08 — insertion window inside the Epic M2 block and the separator sequence**

```bash
[ "${P00_READY:-}" = "gh303" ] || { echo "FATAL: P00 preamble not loaded; run each block in a fresh shell as 'source P00; source Pn'" >&2; exit 1; }
require_p00; need backlog_ranges
backlog_ranges
b3=$(grep -n '^## Epic M3' "$SH/base-backlog.md" | cut -d: -f1)
bsep=$(awk -v m="$b3" 'NR<m && /^---$/{l=NR} END{print l+0}' "$SH/base-backlog.md")
bseq=$(sed -n "${bsep},$((bsep+2))p" "$SH/base-backlog.md")
hseq=$(sed -n "${SEP_LINE},$((SEP_LINE+2))p" "$BL")
blank_before=$(awk -v s="$SEP_LINE" 'NR==s-1&&NF==0{c=1} END{print c+0}' "$BL")
p18=$(grep -n '^### M2-S18 ' "$BL" | cut -d: -f1 || true)
p19=$(grep -n '^### M2-S19 ' "$BL" | cut -d: -f1 || true)
echo "s17_last=$S17_LAST separator=$SEP_LINE epic_m3=$M3_LINE window=$WS:$WE"
[ "$WS" -le "$WE" ] && echo "window_empty=no ($((WE-WS+1)) line(s))" || echo "window_empty=yes"
[ "$bseq" = "$hseq" ] && echo "separator_sequence=identical" || echo "separator_sequence=CHANGED"
echo "blank_line_before_separator=$blank_before"
echo "s18_line=${p18:-absent} s19_line=${p19:-absent}"
if [ -n "$p18" ] && [ -n "$p19" ] && [ "$p18" -ge "$WS" ] && [ "$p19" -le "$WE" ] && [ "$p18" -lt "$p19" ]; then echo "placement=inside-window"; else echo "placement=FAIL"; fi
[ -n "$p18" ] && [ -n "$p19" ] && [ "$bseq" = "$hseq" ] && [ "$blank_before" -eq 1 ] && [ "$p18" -ge "$WS" ] && [ "$p19" -le "$WE" ] && [ "$p18" -lt "$p19" ] && echo "P08 verdict: PASS" || echo "P08 verdict: FAIL (change absent or misplaced)"
```

**P09 — the Epic M2 context paragraph and the preserved leading regions**

```bash
[ "${P00_READY:-}" = "gh303" ] || { echo "FATAL: P00 preamble not loaded; run each block in a fresh shell as 'source P00; source Pn'" >&2; exit 1; }
require_p00; need backlog_ranges squash
backlog_ranges
bNOTE_S=$(grep -n '^Note: the M1 redefinition moved the queue' "$SH/base-backlog.md" | cut -d: -f1)
bNOTE_E=$(grep -n '^the gap is deliberate\. M2 stories keep their codes\.$' "$SH/base-backlog.md" | cut -d: -f1)
[ -n "$NOTE_S" ] && [ "$NOTE_S" -eq "$bNOTE_S" ] && echo "note_start_line=anchored($NOTE_S)" || echo "note_start_line=SHIFTED"
[ -n "$NOTE_E" ] && [ "$NOTE_E" -eq "$bNOTE_E" ] && echo "note_end_line=anchored($NOTE_E)" || echo "note_end_line=SHIFTED"
awk -v s="$bNOTE_S" -v e="$bNOTE_E" 'NR>=s&&NR<=e' "$SH/base-backlog.md" > "$SH/note-b"
awk -v s="$NOTE_S" -v e="$NOTE_E" 'NR>=s&&NR<=e' "$BL" > "$SH/note-h"
cmp -s "$SH/note-b" "$SH/note-h" && echo "retirement_note=OK" || echo "retirement_note=CHANGED"
para=$(sed -n "$((NOTE_E+1)),$((S2_LINE-1))p" "$BL")
pl=$(printf '%s\n' "$para" | grep -c .)
blank_after_note=$(awk -v n="$((NOTE_E+1))" 'NR==n&&NF==0{c=1} END{print c+0}' "$BL")
blank_before_s2=$(awk -v n="$((S2_LINE-1))" 'NR==n&&NF==0{c=1} END{print c+0}' "$BL")
echo "retirement_note=${NOTE_S}..${NOTE_E} context_paragraph=$((NOTE_E+1))..$((S2_LINE-1)) paragraph_lines=$pl blank_after_note=$blank_after_note blank_before_s2=$blank_before_s2"
if [ "$((NOTE_E+1))" -lt "$S2_LINE" ] && [ "$pl" -ge 1 ] && [ "$blank_after_note" -eq 1 ] && [ "$blank_before_s2" -eq 1 ]; then echo "paragraph_strictly_between=OK"; else echo "paragraph_strictly_between=FAIL"; fi
printf '%s' "$para" | grep -Eiq 'repositor' && printf '%s' "$para" | grep -Eiq 'project' && printf '%s' "$para" | grep -Eiq 'workspace' && echo "three_levels=OK" || echo "three_levels=MISSING"
printf '%s' "$para" | grep -Eiq 'repos.*projects|projects.*repos' && echo "boundary=OK" || echo "boundary=MISSING"
printf '%s' "$para" | grep -Eiq 'root famil' && echo "root_family=OK" || echo "root_family=MISSING"
fm() { awk 'NR==1&&$0=="---"{f=1} f{print} f&&NR>1&&$0=="---"{exit}' "$1"; }
rguide() { awk '/^## Reading guide/{f=1} /^## Cross-cutting principles/{exit} f{print}' "$1"; }
cc() { awk '/^## Cross-cutting principles/{f=1} /^## Epic M0:/{exit} f{print}' "$1"; }
for r in fm rguide cc; do $r "$SH/base-backlog.md" > "$SH/$r-b"; $r "$BL" > "$SH/$r-h"; cmp -s "$SH/$r-b" "$SH/$r-h" && echo "$r=byte-identical" || echo "$r=CHANGED"; done
grep -Fq '## Epic M2: Ceremonies, measurement, and memory (months 3-6)' "$BL" && echo "epic_heading=OK" || echo "epic_heading=MISSING"
[ "$pl" -ge 1 ] && [ "$((NOTE_E+1))" -lt "$S2_LINE" ] && echo "P09 verdict: PASS" || echo "P09 verdict: FAIL (no context paragraph)"
```

**P10 — zero-context hunk confinement**

```bash
[ "${P00_READY:-}" = "gh303" ] || { echo "FATAL: P00 preamble not loaded; run each block in a fresh shell as 'source P00; source Pn'" >&2; exit 1; }
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
      [ "$ok" -eq 1 ] && break; done
    [ "$ok" -eq 1 ] && inside=$((inside+1)) || { outside=$((outside+1)); echo "OUTSIDE: $h (added $c..$last)"; }
  done
  echo "hunks: inside=$inside outside=$outside"; [ "$outside" -eq 0 ]; }
s11r="$S11_LINE:$S11_END"
ctxr="$((NOTE_E+1)):$((S2_LINE-1))"
echo "ranges=s11:$s11r context:$ctxr window:$WS:$WE"
hc=$(diff -U0 "$SH/base-backlog.md" "$BL" | grep -cE '^@@' || true)
echo "backlog_hunks=$hc"
if [ "$hc" -ge 1 ]; then
  diff -U0 "$SH/base-backlog.md" "$BL" | grep -E '^@@' | hunk_guard "$s11r" "$ctxr" "$WS:$WE" && echo "hunk confinement OK" || echo "hunk confinement FAILED"
  echo "non_vacuous=yes"
else echo "FAIL: no backlog hunk (change absent)"; echo "non_vacuous=no"; fi
t=0
printf '@@ -%d,0 +%d,1 @@\n' "$((NOTE_E+1))" "$((NOTE_E+1))" | hunk_guard "$ctxr" >/dev/null && t=$((t+1))
printf '@@ -%d,0 +%d,1 @@\n' "$((SEP_LINE+2))" "$((SEP_LINE+2))" | hunk_guard "$WS:$WE" >/dev/null || t=$((t+1))
printf '@@ -%d,0 +%d,1 @@\n' "$WS" "$WS" | hunk_guard "$WS:$WE" >/dev/null && t=$((t+1))
echo "classifier_self_tests=$t/3"
[ "$hc" -ge 1 ] && [ "$t" -eq 3 ] && echo "P10 verdict: PASS" || echo "P10 verdict: FAIL"
```

**P11 — C4 Level 1: three levels with the workspace optional in the diagram**

```bash
[ "${P00_READY:-}" = "gh303" ] || { echo "FATAL: P00 preamble not loaded; run each block in a fresh shell as 'source P00; source Pn'" >&2; exit 1; }
A="$M2/architecture.md"
l1=$(section "$A" '## C4 Level 1: system context')
diag=$(printf '%s\n' "$l1" | awk '/^```mermaid/{f=1;next} /^```/{f=0} f')
lsq=$(printf '%s' "$l1" | squash)
printf '%s' "$lsq" | grep -Eiq 'delivery unit' && echo "repository_as_delivery_unit=OK" || echo "repository_as_delivery_unit=MISSING"
printf '%s' "$lsq" | grep -Eiq 'group of repositor|configured group' && echo "project_as_group=OK" || echo "project_as_group=MISSING"
printf '%s' "$diag" | grep -Eiq 'workspace' && echo "workspace_in_diagram=OK" || echo "workspace_in_diagram=MISSING"
printf '%s' "$diag" | grep -Eiq 'workspace[^\n]*optional|optional[^\n]*workspace' && echo "workspace_optional_in_diagram=OK" || echo "workspace_optional_in_diagram=MISSING"
printf '%s' "$lsq" | grep -Eiq 'workspace[^.]{0,120}required' && echo "workspace_mandatory_claim=PRESENT (violation)" || echo "workspace_mandatory_claim=ABSENT"
printf '%s' "$lsq" | grep -Eiq 'group of repositor|configured group' && printf '%s' "$diag" | grep -Eiq 'workspace' && printf '%s' "$diag" | grep -Eiq 'optional' && echo "P11 verdict: PASS" || echo "P11 verdict: FAIL"
```

**P12 — model prose: declared membership, optional workspace, unrelated directories**

```bash
[ "${P00_READY:-}" = "gh303" ] || { echo "FATAL: P00 preamble not loaded; run each block in a fresh shell as 'source P00; source Pn'" >&2; exit 1; }
sq=$(cat "$A" | squash)
printf '%s' "$sq" | grep -Eiq 'membership (is )?declared in configuration|declared in configuration' && echo "membership_declared=OK" || echo "membership_declared=MISSING"
printf '%s' "$sq" | grep -Eiq 'workspace (is )?(never required|optional)|never (a )?required' && echo "workspace_never_required=OK" || echo "workspace_never_required=MISSING"
printf '%s' "$sq" | grep -Eiq 'unrelated director' && echo "unrelated_dirs=OK" || echo "unrelated_dirs=MISSING"
printf '%s' "$sq" | grep -Eiq 'identically' && echo "identical_behaviour=OK" || echo "identical_behaviour=MISSING"
printf '%s' "$sq" | grep -Eiq 'members? (must|shall) live inside a workspace|members? are required to live inside|a workspace is required' && echo "member_must_be_inside=PRESENT (violation)" || echo "member_must_be_inside=ABSENT"
printf '%s' "$sq" | grep -Eiq 'unrelated director.*identically' && echo "P12 verdict: PASS" || echo "P12 verdict: FAIL"
```

**P13 — the project-scoped overview flow, the cross-repository flow, and four invariants**

```bash
[ "${P00_READY:-}" = "gh303" ] || { echo "FATAL: P00 preamble not loaded; run each block in a fresh shell as 'source P00; source Pn'" >&2; exit 1; }
ov=$(section "$A" '### Multi-repository overview'); ovs=$(printf '%s' "$ov" | squash)
echo "overview_mentions_member=$(printf '%s' "$ovs" | grep -oic 'member' || true) group=$(printf '%s' "$ovs" | grep -oic 'group' || true) workspace=$(printf '%s' "$ovs" | grep -oic 'workspace' || true)"
xr=$(section "$A" '### Cross-repository change')
echo "cross_repo_flow_heading=$([ -n "$xr" ] && echo present || echo absent) cross_repo_mermaid=$(printf '%s\n' "$xr" | grep -c '^```mermaid' || true)"
inv=$(section "$A" '## Boundary invariants at M2 exit'); invs=$(printf '%s' "$inv" | squash)
i1=$(printf '%s' "$invs" | grep -Eic 'repos.*enumerat|naming boundary' || true)
i2=$(printf '%s' "$invs" | grep -Eic 'membership.*declar|declared in configuration' || true)
i3=$(printf '%s' "$invs" | grep -Eic 'workspace.*(optional|never required)' || true)
i4=$(printf '%s' "$invs" | grep -Eic 'one lifecycle|cross-repository change' || true)
echo "invariants naming=$i1 membership=$i2 workspace=$i3 lifecycle=$i4"
printf '%s' "$ovs" | grep -Eiq 'member' && printf '%s' "$ovs" | grep -Eiq 'group' && [ -n "$xr" ] && printf '%s\n' "$xr" | grep -q '^```mermaid' && [ "$i1" -ge 1 ] && [ "$i2" -ge 1 ] && [ "$i3" -ge 1 ] && [ "$i4" -ge 1 ] && echo "P13 verdict: PASS" || echo "P13 verdict: FAIL"
```

**P14 — `repos.v1` and its seven fields**

```bash
[ "${P00_READY:-}" = "gh303" ] || { echo "FATAL: P00 preamble not loaded; run each block in a fresh shell as 'source P00; source Pn'" >&2; exit 1; }
rv=$(section "$M2/contracts.md" '## repos.v1'); rvs=$(printf '%s' "$rv" | squash)
echo "repos_v1_section=$([ -n "$rv" ] && echo present || echo absent)"
printf '%s' "$rvs" | grep -Eiq 'M2-S11' && echo "owned_by_M2-S11=OK" || echo "owned_by_M2-S11=MISSING"
for f in 'repo key' 'root' 'state location' 'daemon reachability' 'handover state' 'host index revision' 'degradation reason' 'checkout identity'; do
  printf '%s' "$rvs" | grep -Eiq "$f" && echo "field $f OK" || echo "field $f MISSING"; done
n=$(for f in 'repo key' 'root' 'state location' 'daemon reachability' 'handover state' 'host index revision' 'degradation reason'; do printf '%s' "$rvs" | grep -Eiq "$f" && echo 1; done | wc -l)
echo "repos_v1_fields=$n/7"
[ -n "$rv" ] && [ "$n" -eq 7 ] && echo "P14 verdict: PASS" || echo "P14 verdict: FAIL"
```

**P15 — `projects.v1` as the group envelope**

```bash
[ "${P00_READY:-}" = "gh303" ] || { echo "FATAL: P00 preamble not loaded; run each block in a fresh shell as 'source P00; source Pn'" >&2; exit 1; }
pv=$(section "$M2/contracts.md" '## projects.v1'); pvs=$(printf '%s' "$pv" | squash)
echo "projects_v1_section=$([ -n "$pv" ] && echo present || echo absent)"
for f in 'group' 'member' 'tracker kind|trackerKind' 'health' 'workspace root' 'project scop'; do
  printf '%s' "$pvs" | grep -Eiq "$f" && echo "group_field $f OK" || echo "group_field $f MISSING"; done
printf '%s' "$pvs" | grep -Eiq 'projectKey.*repository identity|projectKey.*stable repository' && echo "group_named_key_denotes_repo=PRESENT (violation)" || echo "group_named_key_denotes_repo=ABSENT"
grep -Eiq 'group identity.*name|name.*group identity' "$M2/contracts.md" && echo "group_identity_name=OK" || echo "group_identity_name=MISSING"
if [ -n "$pv" ] && printf '%s' "$pvs" | grep -Eiq 'member' && printf '%s' "$pvs" | grep -Eiq 'health' && printf '%s' "$pvs" | grep -Eiq 'workspace root' && ! printf '%s' "$pvs" | grep -Eiq 'projectKey.*repository identity'; then echo "P15 verdict: PASS"; else echo "P15 verdict: FAIL"; fi
```

**P16 — the project configuration schema**

```bash
[ "${P00_READY:-}" = "gh303" ] || { echo "FATAL: P00 preamble not loaded; run each block in a fresh shell as 'source P00; source Pn'" >&2; exit 1; }
ct="$M2/contracts.md"
cfgs=$(grep -nE '^## .*(configuration|config schema)' "$ct" | head -1 | cut -d: -f1)
if [ -z "$cfgs" ]; then echo "configuration_schema=absent"; echo "fields=0/8"; echo "P16 verdict: FAIL (change absent)"; else
  hdr=$(sed -n "${cfgs}p" "$ct"); cfg=$(section "$ct" "$hdr" | squash); n=0
  for f in 'member repositor' 'tracker kind' 'workspace' 'discovery root' 'mixed tracker' 'valid at validation' 'not-yet-supported' 'without any workspace|no workspace'; do
    printf '%s' "$cfg" | grep -Eiq "$f" && n=$((n+1)) || echo "schema field MISSING: $f"; done
  echo "fields=$n/8"
  [ "$n" -eq 8 ] && echo "P16 verdict: PASS" || echo "P16 verdict: FAIL"; fi
```

**P17 — the cross-repository change plan shape**

```bash
[ "${P00_READY:-}" = "gh303" ] || { echo "FATAL: P00 preamble not loaded; run each block in a fresh shell as 'source P00; source Pn'" >&2; exit 1; }
require_p00; need section squash
ct="$M2/contracts.md"
xr=$(grep -nE '^## .*(Cross-repository change|change plan shape|Cross-repository)' "$ct" | head -1 | cut -d: -f1)
if [ -z "$xr" ]; then echo "change_plan_shape=absent"; echo "elements=0/7"; echo "P17 verdict: FAIL (change absent)"; else
  hdr=$(sed -n "${xr}p" "$ct"); body=$(section "$ct" "$hdr" | squash); n=0
  for f in 'member repositor.*slices' 'branch' 'pull request' 'per-member gates' 'definition of done' 'branch cleanup.*issue closure' 'dependency edges' 'evidence.*(every member|all member)'; do
    printf '%s' "$body" | grep -Eiq "$f" && n=$((n+1)) || echo "plan-shape element MISSING: $f"; done
  echo "elements=$n/8"
  [ "$n" -eq 8 ] && echo "P17 verdict: PASS" || echo "P17 verdict: FAIL"; fi
```

**P18 — group-envelope consumers and the M2-S4 advisory note**

```bash
[ "${P00_READY:-}" = "gh303" ] || { echo "FATAL: P00 preamble not loaded; run each block in a fresh shell as 'source P00; source Pn'" >&2; exit 1; }
ct="$M2/contracts.md"
printf '%s' "$(cat "$ct" | squash)" | grep -Eiq 'consumers? of .?projects\.v1' && echo "consumer_note=OK" || echo "consumer_note=MISSING"
s4row=$(grep -E '^\| M2-S4 ' "$M2/README.md")
printf '%s' "$s4row" | grep -Fiq '(advisory: consumed at delivery; the owning story declares the edge)' && echo "s4_advisory=OK" || echo "s4_advisory=MISSING"
printf '%s' "$(cat "$ct" | squash)" | grep -Eiq 'consumers? of .?projects\.v1' && printf '%s' "$s4row" | grep -Fiq '(advisory: consumed at delivery; the owning story declares the edge)' && echo "P18 verdict: PASS" || echo "P18 verdict: FAIL"
```

**P19 — the new `commands/repos.md` page**

```bash
[ "${P00_READY:-}" = "gh303" ] || { echo "FATAL: P00 preamble not loaded; run each block in a fresh shell as 'source P00; source Pn'" >&2; exit 1; }
if [ ! -f "$R" ]; then echo "repos_md=absent"; echo "checks=0/9 fields=0/5"; echo "P19 verdict: FAIL (change absent)"; else
  n=0
  grep -Fxq 'Status: Proposed (M2)' "$R" && n=$((n+1)) || echo "MISSING status header"
  grep -Eiq '^`repos`' "$R" && n=$((n+1)) || echo "MISSING bare NAME"
  grep -Eiq 'repos list \[--json\]' "$R" && n=$((n+1)) || echo "MISSING synopsis"
  grep -q 'repos\[\]' "$R" && n=$((n+1)) || echo "MISSING repos[] envelope"
  grep -q '^## EXIT STATUS' "$R" && n=$((n+1)) || echo "MISSING EXIT STATUS"
  grep -q '^## ERRORS' "$R" && n=$((n+1)) || echo "MISSING ERRORS"
  grep -q '^## SEE ALSO' "$R" && n=$((n+1)) || echo "MISSING SEE ALSO"
  grep -q '<binary>' "$R" && n=$((n+1)) || echo "MISSING invocation prefix"
  grep -Eiq 'previously documented as .?projects list|rename' "$R" && n=$((n+1)) || echo "MISSING rename note"
  fields=0; for f in 'repo key|repoKey' 'root' 'state location|stateLocation' 'daemon reachability|daemonReachable' 'handover state|handoverState'; do
    grep -Eiq "$f" "$R" && fields=$((fields+1)); done
  echo "checks=$n/9 fields=$fields/5"
  [ "$n" -eq 9 ] && [ "$fields" -eq 5 ] && echo "P19 verdict: PASS" || echo "P19 verdict: FAIL"; fi
```

**P20 — the rewritten `commands/projects.md` page**

```bash
[ "${P00_READY:-}" = "gh303" ] || { echo "FATAL: P00 preamble not loaded; run each block in a fresh shell as 'source P00; source Pn'" >&2; exit 1; }
n=0
grep -Fxq 'Status: Proposed (M2)' "$PJ" && n=$((n+1)) || echo "MISSING status header"
grep -Eiq '^`projects`' "$PJ" && n=$((n+1)) || echo "MISSING bare NAME"
grep -Eiq 'projects list' "$PJ" && n=$((n+1)) || echo "MISSING group listing"
grep -Eiq 'project scop' "$PJ" && n=$((n+1)) || echo "MISSING project scope"
grep -Eiq 'projects\.v1' "$PJ" && n=$((n+1)) || echo "MISSING projects.v1 pointer"
grep -Eiq 'configuration schema|configuration' "$PJ" && n=$((n+1)) || echo "MISSING configuration pointer"
grep -Eiq 'naming boundary|repos.*enumerat' "$PJ" && n=$((n+1)) || echo "MISSING naming boundary"
fields=0; for f in 'member' 'health' 'state'; do grep -Eiq "$f" "$PJ" && fields=$((fields+1)); done
bad=$(grep -Eic '(projects|projects list)[^.]{0,80}(enumerat|overview)[^.]{0,80}checkout|one overview of every delivery-managed checkout' "$PJ" || true)
echo "checks=$n/7 fields=$fields/3 forbidden_flat_statements=$bad"
[ "$n" -eq 7 ] && [ "$fields" -eq 3 ] && [ "$bad" -eq 0 ] && echo "P20 verdict: PASS" || echo "P20 verdict: FAIL"
```

**P21 — the two command pages compared**

```bash
[ "${P00_READY:-}" = "gh303" ] || { echo "FATAL: P00 preamble not loaded; run each block in a fresh shell as 'source P00; source Pn'" >&2; exit 1; }
r1=0; [ -f "$R" ] && r1=$(grep -c 'repos\.v1' "$R" || true)
r2=0; [ -f "$R" ] && r2=$(grep -c 'projects\[\]' "$R" || true)
p1=$(grep -c 'projects\.v1' "$PJ"); p2=$(grep -c 'repos\.v1' "$PJ"); p3=$(grep -c 'repos\[\]' "$PJ")
h1=$([ -f "$R" ] && grep -Fxq 'Status: Proposed (M2)' "$R" && echo 1 || echo 0); h2=$(grep -Fxq 'Status: Proposed (M2)' "$PJ" && echo 1 || echo 0)
n1=0; [ -f "$R" ] && n1=$(grep -Eic 'not yet registered|not registered' "$R"); n2=$(grep -Eic 'not yet registered|not registered' "$PJ")
echo "repos_page: repos.v1=$r1 projects[]=$r2 header=$h1 not_registered=$n1"
echo "projects_page: projects.v1=$p1 repos.v1=$p2 repos[]=$p3 header=$h2 not_registered=$n2"
[ "$r1" -ge 1 ] && [ "$r2" -eq 0 ] && [ "$p1" -ge 1 ] && [ "$p2" -eq 0 ] && [ "$p3" -eq 0 ] && [ "$h1" -eq 1 ] && [ "$h2" -eq 1 ] && [ "$n1" -ge 1 ] && [ "$n2" -ge 1 ] && echo "P21 verdict: PASS" || echo "P21 verdict: FAIL"
```

**P22 — S18 and S19 seeds, per-seed assert counts, and topic coverage**

```bash
[ "${P00_READY:-}" = "gh303" ] || { echo "FATAL: P00 preamble not loaded; run each block in a fresh shell as 'source P00; source Pn'" >&2; exit 1; }
TS="$M2/test-scenarios.md"
seed_asserts() { awk -v id="$2" 'index($0,"### "id)==1{f=1;next} f&&/^#{2,3} /{exit} f&&/^Assert:/{c++} END{print c+0}' "$1"; }
s18n=$(grep -c '^### SC-M2-S18-' "$TS" || true); s19n=$(grep -c '^### SC-M2-S19-' "$TS" || true)
echo "s18_seeds=$s18n s19_seeds=$s19n"
bad=0
for id in $(grep -oE '^### (SC-M2-S1[89]-[0-9]+)' "$TS" | awk '{print $2}'); do
  a=$(seed_asserts "$TS" "$id"); [ "$a" -eq 1 ] || { echo "ASSERT COUNT $id=$a"; bad=$((bad+1)); }; done
echo "assert_violations=$bad"
sq=$(cat "$TS" | squash); n=0
for f in 'workspace director.*register|register.*workspace director' 'without a workspace|unrelated director' 'projects list.*member' 'project[ -]scop.*queue and status' 'mixing tracker kinds|mixed tracker' 'not-yet-supported' 'two branches|two PRs' 'one review flow' 'closeout' 'failing.*shared definition of done|blocks the shared'; do
  printf '%s' "$sq" | grep -Eiq "$f" && n=$((n+1)) || echo "topic MISSING: $f"; done
echo "coverage_anchors=$n/10"
[ "$s18n" -ge 2 ] && [ "$s19n" -ge 2 ] && [ "$bad" -eq 0 ] && [ "$n" -eq 10 ] && echo "P22 verdict: PASS" || echo "P22 verdict: FAIL"
```

**P23 — the two S11 seeds**

```bash
[ "${P00_READY:-}" = "gh303" ] || { echo "FATAL: P00 preamble not loaded; run each block in a fresh shell as 'source P00; source Pn'" >&2; exit 1; }
TS="$M2/test-scenarios.md"
a1=$(awk '/^### SC-M2-S11-01/{f=1;next} f&&/^#{2,3} /{exit} f&&/^Assert:/{print}' "$TS")
t2=$(grep -m1 '^### SC-M2-S11-02' "$TS")
b2=$(awk '/^### SC-M2-S11-02/{f=1;next} f&&/^#{2,3} /{exit} f{print}' "$TS")
echo "s11_01_assert_repos_list=$(printf '%s' "$a1" | grep -c 'repos list' || true) s11_01_assert_projects_list=$(printf '%s' "$a1" | grep -c 'projects list' || true)"
echo "s11_02_title_repos_list=$(printf '%s' "$t2" | grep -c 'repos list' || true) s11_02_body_repos_list=$(printf '%s' "$b2" | grep -c 'repos list' || true)"
fields=0; for f in 'repo key' 'root' 'state location' 'daemon reachability' 'handover state'; do printf '%s\n%s' "$b2" "$a1" | grep -Eiq "$f" && fields=$((fields+1)); done
echo "assert_fields=$fields/5"
bad=$(grep -E '^Assert:.*projects list' "$TS" | grep -Eic 'row|enumerat|checkout' || true)
echo "flat_assert_survivors=$bad"
[ "$(printf '%s' "$a1" | grep -c 'repos list' || true)" -ge 1 ] && [ "$(printf '%s' "$a1" | grep -c 'projects list' || true)" -eq 0 ] && [ "$(printf '%s' "$t2" | grep -c 'repos list' || true)" -ge 1 ] && [ "$fields" -eq 5 ] && [ "$bad" -eq 0 ] && echo "P23 verdict: PASS" || echo "P23 verdict: FAIL"
```

**P24 — the opening journey**

```bash
[ "${P00_READY:-}" = "gh303" ] || { echo "FATAL: P00 preamble not loaded; run each block in a fresh shell as 'source P00; source Pn'" >&2; exit 1; }
J="$M2/journeys.md"
j1=$(firstsec "$J"); j1s=$(printf '%s' "$j1" | squash)
echo "opening_journey_lines=$(printf '%s\n' "$j1" | wc -l)"
printf '%s' "$j1s" | grep -Eiq 'project' && echo "project_scoped=OK" || echo "project_scoped=MISSING"
printf '%s' "$j1s" | grep -Eiq 'outside' && printf '%s' "$j1s" | grep -Eiq 'workspace|shared director' && echo "member_outside_shared_dir=OK" || echo "member_outside_shared_dir=MISSING"
printf '%s' "$j1s" | grep -Eiq 'repos list' && echo "flat_view_repos_list=OK" || echo "flat_view_repos_list=MISSING"
printf '%s' "$j1s" | grep -Eiq 'projects list' && echo "group_view_projects_list=OK" || echo "group_view_projects_list=MISSING"
printf '%s' "$j1s" | grep -Eiq 'queue' && printf '%s' "$j1s" | grep -Eiq 'status' && printf '%s' "$j1s" | grep -Eiq 'scope' && echo "scoped_reads=OK" || echo "scoped_reads=MISSING"
printf '%s' "$j1s" | grep -Eiq 'without a shared workspace|no shared workspace|reads identically' && echo "workspace_optional_stated=OK" || echo "workspace_optional_stated=MISSING"
printf '%s' "$j1s" | grep -Eiq 'same ref' && printf '%s' "$j1s" | grep -Eiq 'disjoint' && echo "same_ref_disjoint=OK" || echo "same_ref_disjoint=MISSING"
n=0; for p in 'project' 'repos list' 'projects list' 'disjoint'; do printf '%s' "$j1s" | grep -Eiq "$p" && n=$((n+1)); done
echo "journey_anchors=$n/4"
[ "$n" -eq 4 ] && printf '%s' "$j1s" | grep -Eiq 'outside' && printf '%s' "$j1s" | grep -Eiq 'identical|without a shared workspace' && echo "P24 verdict: PASS" || echo "P24 verdict: FAIL"
```

**P25 — the entrypoint delta note**

```bash
[ "${P00_READY:-}" = "gh303" ] || { echo "FATAL: P00 preamble not loaded; run each block in a fresh shell as 'source P00; source Pn'" >&2; exit 1; }
EPD="$M2/entrypoint-delta.md"
add=$(section "$EPD" '## M2-planned additions'); adds=$(printf '%s' "$add" | squash)
mount=$(section "$EPD" '## Mounting a new command'); mounts=$(printf '%s' "$mount" | squash)
printf '%s' "$adds" | grep -Eiq '`repos`.{0,120}(flat enumeration|enumerat)' && echo "repos_addition=OK" || echo "repos_addition=MISSING"
printf '%s' "$adds" | grep -Eiq '`projects`.{0,160}(group|member)' && echo "projects_addition=OK" || echo "projects_addition=MISSING"
printf '%s' "$mounts" | grep -Eiq 'repos' && printf '%s' "$mounts" | grep -Eiq 'projects' && echo "mount_names_both=OK" || echo "mount_names_both=MISSING"
grep -Eic 'host overview of managed checkouts|host overview' "$EPD" | sed 's/^/host_overview_claims=/'
for t in 'Sixteen families' '#286' 'milestone snapshot' 'unknown flag' 'unexpected argument'; do grep -Fq "$t" "$EPD" && echo "preserved $t OK" || echo "preserved $t MISSING"; done
ho=$(grep -Eic 'host overview' "$EPD" || true)
printf '%s' "$adds" | grep -Eiq 'flat enumeration' && printf '%s' "$adds" | grep -Eiq 'group' && [ "$ho" -eq 0 ] && echo "P25 verdict: PASS" || echo "P25 verdict: FAIL"
```

**P26 — the pack README contents row and map rows**

```bash
[ "${P00_READY:-}" = "gh303" ] || { echo "FATAL: P00 preamble not loaded; run each block in a fresh shell as 'source P00; source Pn'" >&2; exit 1; }
MRD="$M2/README.md"
rows=$(section "$MRD" '## Pack contents' | grep -cE '^\| \[|^\| `')
echo "pack_rows=$rows/13"
section "$MRD" '## Pack contents' | grep -q 'commands/repos.md' && echo "repos_row=OK" || echo "repos_row=MISSING"
grep -qE '^\| M2-S18 ' "$MRD" && echo "map_s18=OK" || echo "map_s18=MISSING"
grep -qE '^\| M2-S19 ' "$MRD" && echo "map_s19=OK" || echo "map_s19=MISSING"
grep -E '^\| M2-S11 ' "$MRD" | grep -q 'repos.v1' && echo "s11_row_repos_v1=OK" || echo "s11_row_repos_v1=MISSING"
b=$(grep -m1 'planned until M2 exit' "$SH/../gh303/base-milestones-README.md" 2>/dev/null || true)
grep -Fq 'Everything in this pack is **planned until M2 exit**' "$MRD" && echo "planned_until_exit=verbatim" || echo "planned_until_exit=CHANGED"
[ "$rows" -eq 13 ] && grep -qE '^\| M2-S18 ' "$MRD" && grep -qE '^\| M2-S19 ' "$MRD" && grep -E '^\| M2-S11 ' "$MRD" | grep -q 'repos.v1' && echo "P26 verdict: PASS" || echo "P26 verdict: FAIL"
```

**P27 — the milestone M2 index row**

```bash
[ "${P00_READY:-}" = "gh303" ] || { echo "FATAL: P00 preamble not loaded; run each block in a fresh shell as 'source P00; source Pn'" >&2; exit 1; }
m2row=$(grep -E '^\| M2 \(' "$MR")
echo "m2_targets=$(printf '%s' "$m2row" | grep -o '](m2/' | wc -l)/13"
printf '%s' "$m2row" | grep -q 'm2/commands/repos.md' && echo "repos_target=OK" || echo "repos_target=MISSING"
m0b=$(grep -E '^\| M0 \(' "$SH/base-milestones-README.md"); m0h=$(grep -E '^\| M0 \(' "$MR")
m1b=$(grep -E '^\| M1 \(' "$SH/base-milestones-README.md"); m1h=$(grep -E '^\| M1 \(' "$MR")
[ "$m0b" = "$m0h" ] && echo "m0_row=byte-identical" || echo "m0_row=CHANGED"
[ "$m1b" = "$m1h" ] && echo "m1_row=byte-identical" || echo "m1_row=CHANGED"
n=$(printf '%s' "$m2row" | grep -o '](m2/' | wc -l)
[ "$n" -eq 13 ] && printf '%s' "$m2row" | grep -q 'm2/commands/repos.md' && [ "$m0b" = "$m0h" ] && [ "$m1b" = "$m1h" ] && echo "P27 verdict: PASS" || echo "P27 verdict: FAIL"
```

**P28 — the new dated status section**

```bash
[ "${P00_READY:-}" = "gh303" ] || { echo "FATAL: P00 preamble not loaded; run each block in a fresh shell as 'source P00; source Pn'" >&2; exit 1; }
require_p00; need newsec_of newsec_count squash
ncount=$(newsec_count "$SH/base-status.md" "$ST")
ns=$(newsec_of "$SH/base-status.md" "$ST")
lastbase=$(grep -n '^## ' "$SH/base-status.md" | tail -1 | cut -d: -f1)
echo "new_section_count=$ncount new_section_line=${ns:-absent} base_last_heading=$lastbase"
if [ -z "$ns" ]; then echo "new_section=absent"; echo "P28 verdict: FAIL (change absent)"; else
  hdr=$(sed -n "${ns}p" "$ST"); body=$(awk -v s="$ns" 'NR>=s{f=1} f&&NR>s&&/^## /{exit} f' "$ST" | squash)
  echo "new_section_heading=$hdr"
  printf '%s' "$hdr" | grep -Eq '^## .+ \(2026-11-11\)$' && echo "heading_form=title-plus-parenthesised-date" || echo "heading_form=UNEXPECTED"
  after=$(awk -v s="$ns" 'NR>s && /^## /{c++} END{print c+0}' "$ST")
  echo "headings_after_new_section=$after"
  for p in 'three.level|repositor.*project.*workspace' 'M2-S11' 'repos list' 'deprecation alias' 'M2-S18' 'M2-S19' 'naming boundary' 'registry' 'entrypoint delta|entrypoint-delta'; do
    printf '%s' "$body" | grep -Eiq "$p" && echo "section anchor OK: $p" || echo "section anchor MISSING: $p"; done
  printf '%s' "$body" | grep -Eiq 'M2 (has )?exit(ed)? complete|milestone exit complete|delivered by M2-S1[89]' && echo "delivery_claim=PRESENT (violation)" || echo "delivery_claim=ABSENT"
  n=0; for p in 'three.level|repositor.*project.*workspace' 'repos list' 'deprecation alias' 'M2-S18' 'M2-S19' 'naming boundary'; do printf '%s' "$body" | grep -Eiq "$p" && n=$((n+1)); done
  echo "section_anchors=$n/6"
  [ "$ncount" -eq 1 ] && [ "$after" -eq 0 ] && printf '%s' "$hdr" | grep -Eq '^## .+ \(2026-11-11\)$' && [ "$n" -eq 6 ] && echo "P28 verdict: PASS" || echo "P28 verdict: FAIL"; fi
```

**P29 — status line retention: presence, order, and confinement**

```bash
[ "${P00_READY:-}" = "gh303" ] || { echo "FATAL: P00 preamble not loaded; run each block in a fresh shell as 'source P00; source Pn'" >&2; exit 1; }
require_p00; need diffstat newsec_of newsec_count
read -r rem add <<< "$(diffstat "$SH/base-status.md" "$ST")"
ncount=$(newsec_count "$SH/base-status.md" "$ST")
ns=$(newsec_of "$SH/base-status.md" "$ST")
if [ -z "$ns" ]; then out=$add; else
  out=$(diff -U0 "$SH/base-status.md" "$ST" | grep -E '^@@' | sed -E 's/^@@ -[0-9]+(,[0-9]+)? \+([0-9]+)(,([0-9]+))? @@.*/\2 \4/' | awk -v s="$((ns-1))" '{c=$1; d=($2==""?1:$2); if (c<s) print}' | wc -l)
fi
after=$(awk -v s="${ns:-999999}" 'NR>s && /^## /{c++} END{print c+0}' "$ST")
echo "removed_lines=$rem additions=$add new_section_line=${ns:-absent} new_section_count=$ncount headings_after=${after} added_outside_section=$out"
echo "base_lines=$(wc -l < "$SH/base-status.md") head_lines=$(wc -l < "$ST")"
[ "$rem" -eq 0 ] && echo "base_lines_retained=OK" || echo "base_lines_retained=FAILED ($rem removed/modified/reordered)"
[ "$out" -eq 0 ] && echo "additions_confined=OK" || echo "additions_confined=FAILED ($out hunk(s) before the new section)"
[ "$rem" -eq 0 ] && [ "$out" -eq 0 ] && [ "$ncount" -le 1 ] && [ "$after" -eq 0 ] && echo "P29 verdict: PASS (control or conforming)" || echo "P29 verdict: FAIL"
```

**P30 — the command registry rows and boundary note**

```bash
[ "${P00_READY:-}" = "gh303" ] || { echo "FATAL: P00 preamble not loaded; run each block in a fresh shell as 'source P00; source Pn'" >&2; exit 1; }
RG="$PWD/doc/planning/oss-tooling/cli-command-registry.md"
m2sec=$(awk '/^### M2: /{f=1} /^### M3: /{f=0} f' "$RG")
m3sec=$(awk '/^### M3: /{f=1} /^### M4: /{f=0} f' "$RG")
repo2=$(printf '%s\n' "$m2sec" | grep -E '^\| `ados repos` ')
projrow=$(printf '%s\n' "$m2sec" | grep -E '^\| `ados projects` ')
hyg=$(printf '%s\n' "$m3sec" | grep -E '^\| `ados repos` ')
bound=$(grep -m1 '^Boundary note:' "$RG")
oldm=$(printf '%s' "$projrow" | grep -ic 'workstation overview' || true)
echo "m2_repos_row=$([ -n "$repo2" ] && echo present || echo absent) old_projects_meaning=$oldm"
n=0
[ -n "$repo2" ] && printf '%s' "$repo2" | grep -Eiq 'flat enumeration' && n=$((n+1))
[ -n "$repo2" ] && printf '%s' "$repo2" | grep -Eiq 'M2-S11' && n=$((n+1))
printf '%s' "$repo2" | grep -Eiq 'daemon reachability' && n=$((n+1))
printf '%s' "$projrow" | grep -Eiq 'group' && n=$((n+1))
printf '%s' "$projrow" | grep -Eiq 'member' && printf '%s' "$projrow" | grep -Eiq 'M2-S18' && n=$((n+1))
printf '%s' "$hyg" | grep -Eiq 'subcommand' && printf '%s' "$hyg" | grep -Eiq 'M3-S6' && n=$((n+1))
printf '%s' "$bound" | grep -Eiq 'enumerat.*group|naming boundary|`repos` = flat' && n=$((n+1))
printf '%s' "$bound" | grep -Eiq 'distinct surfaces' && echo "old_boundary_note=PRESENT (violation)" || echo "old_boundary_note=ABSENT"
echo "registry_anchors=$n/7"
[ "$n" -eq 7 ] && echo "P30 verdict: PASS" || echo "P30 verdict: FAIL"
```

**P31 — registry diff containment**

```bash
[ "${P00_READY:-}" = "gh303" ] || { echo "FATAL: P00 preamble not loaded; run each block in a fresh shell as 'source P00; source Pn'" >&2; exit 1; }
classify() { # $1 = changed line text
  case "$1" in
    '| `ados projects` '*) echo allowed ;;
    '| `ados repos` '*Clone*) echo allowed ;;
    '| `ados repos` '*flat*|*Enumeration*) echo allowed ;;
    'Boundary note:'*) echo allowed ;;
    '| `ados repos` '*hygiene*) echo allowed ;;
    *) echo OTHER ;;
  esac
}
changed=$(diff -U0 "$SH/base-registry.md" "$RG" | grep -E '^[-+]' | grep -vE '^(---|\+\+\+)' | wc -l)
echo "changed_lines=$changed"
diff -U0 "$SH/base-registry.md" "$RG" | grep -E '^[-+]' | grep -vE '^(---|\+\+\+)' | sed -E 's/^[-+]//' | while IFS= read -r line; do
  case "$line" in
    '| `ados projects` '*) echo "allowed: projects row" ;;
    '| `ados repos` '*) echo "allowed: repos row" ;;
    'Boundary note:'*) echo "allowed: boundary note" ;;
    *) echo "OUTSIDE: $line" ;;
  esac
done > "$SH/p31.txt"
out=$(grep -c '^OUTSIDE' "$SH/p31.txt" || true); ins=$(grep -c '^allowed' "$SH/p31.txt" || true)
echo "hunks_classified=$ins outside=$out"
# fixture: an unrelated row change must be flagged
cp "$RG" "$SH/reg-mut.md"
sed -i 's/^| `ados supervise` | Supervision battery/| `ados supervise` | Supervision battery, MUTATED/' "$SH/reg-mut.md"
diff -U0 "$SH/base-registry.md" "$SH/reg-mut.md" | grep -E '^[-+]' | grep -vE '^(---|\+\+\+)' | sed -E 's/^[-+]//' | while IFS= read -r line; do
  case "$line" in '| `ados projects` '*) ;; '| `ados repos` '*) ;; 'Boundary note:'*) ;; *) echo "OUTSIDE: $line" ;; esac
done > "$SH/p31-mut.txt"
mut=$(grep -c '^OUTSIDE' "$SH/p31-mut.txt" || true)
echo "fixture_outside=$mut out_of_scope_changes=$(grep -c . "$SH/p31-mut.txt" || true)"
[ "$changed" -ge 1 ] && [ "$out" -eq 0 ] && [ "$mut" -ge 1 ] && echo "P31 verdict: PASS" || { [ "$changed" -eq 0 ] && echo "P31 verdict: FAIL (vacuous: no registry change)"; }
```

**P32 — the naming matrix, forbidden half (sentence-level detectors), with self-tests**

> The forbidden field is a literal ERE or `@flat`/`@group`/`@both`. The sentence-level modes are what let the ticket-mandated S18 goal and boundary clause pass while a statement that attributes enumeration to `projects`, or group semantics to `repos`, is still flagged. Each matrix region is required to be non-empty before it is counted, and the self-tests cover both directions plus the two negative controls (the required boundary sentence and the unchanged base `commands/board.md`).

```bash
[ "${P00_READY:-}" = "gh303" ] || { echo "FATAL: P00 preamble not loaded; run each block in a fresh shell as 'source P00; source Pn'" >&2; exit 1; }
require_p00; need matrix_rows path_of region forbidden_hits forbidden_count backlog_ranges
echo "-- P32: forbidden-statement half --"
p32fail=0; p32empty=0; rows=0
while IFS='|' read -r id palias mode arg req forb; do
  [ -z "$id" ] && continue; rows=$((rows+1))
  f=$(path_of "$palias")
  if [ ! -f "$f" ]; then echo "$id region=NOFILE"; p32fail=$((p32fail+1)); continue; fi
  txt=$(region "$f" "$mode" "$arg" | squash)
  if [ -z "$txt" ]; then echo "$id region=EMPTY"; p32empty=$((p32empty+1)); p32fail=$((p32fail+1)); continue; fi
  if [ "$forb" = "XXXNONE" ]; then echo "$id forbidden=none-required region=OK"; continue; fi
  c=$(forbidden_count "$txt" "$forb")
  if [ "$c" -eq 0 ]; then echo "$id forbidden=0 OK"; else
    echo "$id forbidden=$c SURVIVOR"
    case "$forb" in @*) printf '%s' "$txt" | forbidden_hits "${forb#@}" | sed 's/^/    /' ;; *) printf '%s' "$txt" | grep -Eoi -- "$forb" | sed 's/^/    /' ;; esac
    p32fail=$((p32fail+1)); fi
done < <(matrix_rows)
echo "matrix_rows=$rows regions_empty=$p32empty rows_with_survivors=$p32fail/$rows"
st=$(printf 'The `projects list` command enumerates every managed checkout.\n' | forbidden_hits both | wc -l)
sg=$(printf 'The `repos` group lists its members and their health.\n' | forbidden_hits both | wc -l)
sn=$(printf 'The naming boundary: `repos` enumerates checkouts, `projects` groups them.\n' | forbidden_hits both | wc -l)
b0=$(cat "$M2/commands/board.md" | squash | forbidden_hits both | wc -l)
echo "self_test_flat=$([ "$st" -ge 1 ] && echo detected || echo FAILED) self_test_group=$([ "$sg" -ge 1 ] && echo detected || echo FAILED) self_test_boundary_allowed=$([ "$sn" -eq 0 ] && echo OK || echo FAILED) base_board_accepted=$([ "$b0" -eq 0 ] && echo OK || echo FLAGGED)"
[ "$p32fail" -eq 0 ] && [ "$rows" -eq 17 ] && [ "$p32empty" -eq 0 ] && [ "$st" -ge 1 ] && [ "$sg" -ge 1 ] && [ "$sn" -eq 0 ] && [ "$b0" -eq 0 ] && echo "P32 verdict: PASS" || echo "P32 verdict: FAIL (survivors, empty region, or scan inert)"
```

**P33 — boundary statements at the six both-name prose locations**

```bash
[ "${P00_READY:-}" = "gh303" ] || { echo "FATAL: P00 preamble not loaded; run each block in a fresh shell as 'source P00; source Pn'" >&2; exit 1; }
require_p00; need matrix_rows path_of region squash
both_rows() { cat <<'B'
BL-CTX|BL|para|ctx
ARCH|architecture|whole|
JRN|journeys|firstsec|
EPD|entrypoint-delta|whole|
REG|registry|whole|
STAT|status|newsec
B
}
ok=0; tot=0
while IFS='|' read -r id palias mode arg; do
  [ -z "$id" ] && continue; tot=$((tot+1))
  f=$(path_of "$palias"); txt=$(region "$f" "$mode" "$arg" | squash)
  r=$(printf '%s' "$txt" | grep -oiE '(^|[^a-z0-9])repos([^a-z0-9]|$)' | wc -l)
  p=$(printf '%s' "$txt" | grep -oiE '(^|[^a-z0-9])projects([^a-z0-9]|$)' | wc -l)
  b=$(printf '%s' "$txt" | grep -Eoi 'flat enumeration|enumerat[^.]{0,60}(group|projects)|repos[^.]{0,40}(checkout|flat)[^.]{0,80}projects[^.]{0,40}group|projects[^.]{0,40}group[^.]{0,80}repos' | wc -l)
  if [ "$r" -ge 1 ] && [ "$p" -ge 1 ] && [ "$b" -ge 1 ]; then ok=$((ok+1)); echo "$id boundary=OK"; else echo "$id repos=$r projects=$p boundary=$b"; fi
done < <(both_rows)
echo "boundary_locations=$ok/$tot"
echo "index_rows_checked_by=P26/P27 (link-only locations; no boundary sentence required by Appendix B)"
[ "$ok" -eq "$tot" ] && [ "$tot" -eq 6 ] && echo "P33 verdict: PASS" || echo "P33 verdict: FAIL"
```

**P34 — product-file containment on the base..worktree manifest**

> The gate is the **base..worktree** set (`git diff --name-only "$BASE" -- .` plus untracked product files), so it is decidable at the P5 boundary; the committed range is reported separately as `post_commit_check` and is not the gate.

```bash
[ "${P00_READY:-}" = "gh303" ] || { echo "FATAL: P00 preamble not loaded; run each block in a fresh shell as 'source P00; source Pn'" >&2; exit 1; }
require_p00
manifest() { cat <<'M'
doc/planning/oss-tooling/backlog.md
doc/planning/oss-tooling/milestones/m2/architecture.md
doc/planning/oss-tooling/milestones/m2/contracts.md
doc/planning/oss-tooling/milestones/m2/commands/repos.md
doc/planning/oss-tooling/milestones/m2/commands/projects.md
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
# Base..working-tree manifest check: decidable before the P5 commit.
{ git diff --name-only "$BASE" -- . ; git ls-files --others --exclude-standard ; } | grep -v '^doc/changes/' | sed '/^$/d' | LC_ALL=C sort -u > "$SH/prod.txt"
manifest | LC_ALL=C sort > "$SH/man.txt"
echo "product_files=$(grep -c . "$SH/prod.txt")/13"
echo "expected_not_changed=$(comm -13 "$SH/prod.txt" "$SH/man.txt" | wc -l)"
echo "unexpected_changed=$(comm -23 "$SH/prod.txt" "$SH/man.txt" | tr '\n' ' ')"
for root in doc/spec/ doc/overview/ doc/guides/ doc/templates/ packages/ tests/ .opencode/ .ai/; do
  n=$(grep -c "^$root" "$SH/prod.txt" || true); [ "$n" -eq 0 ] || echo "FORBIDDEN ROOT CHANGED: $root ($n)"; done
other_scripts=$(grep '^scripts/' "$SH/prod.txt" | grep -vc '^scripts/checks/forbidden-literals.registry.json' || true)
echo "other_scripts_changed=$other_scripts"
# Post-commit verification (reported, not gated here): the committed range must reproduce the same set.
head_diff=$(git diff --name-only "$BASE"...HEAD 2>/dev/null | grep -v '^doc/changes/' | sed '/^$/d' | sort -u)
if [ -z "$head_diff" ]; then echo "post_commit_check=pending (no product commit yet; base..worktree is the gate)"; else
  echo "post_commit_check=$(diff <(printf '%s\n' "$head_diff") "$SH/prod.txt" >/dev/null && echo identical || echo DIFFERS)"; fi
n=$(grep -c . "$SH/prod.txt"); e=$(comm -13 "$SH/prod.txt" "$SH/man.txt" | wc -l); u=$(comm -23 "$SH/prod.txt" "$SH/man.txt" | wc -l)
[ "$n" -eq 13 ] && [ "$e" -eq 0 ] && [ "$u" -eq 0 ] && [ "$other_scripts" -eq 0 ] && ! grep -qE '^doc/(spec|overview|guides|templates)/|^packages/|^tests/|^\.opencode/|^\.ai/' "$SH/prod.txt" && echo "P34 verdict: PASS" || echo "P34 verdict: FAIL (change absent or out of scope)"
```

**P35 — backlog preservation and heading order**

```bash
[ "${P00_READY:-}" = "gh303" ] || { echo "FATAL: P00 preamble not loaded; run each block in a fresh shell as 'source P00; source Pn'" >&2; exit 1; }
require_p00; need entry backlog_ranges
compare_stories() { # $1 base $2 head
  local changed=0 removed=0 kept=0 h b n
  while IFS= read -r h; do
    case "$h" in '### M2-S11 '*) continue ;; esac
    b=$(entry "$1" "$h"); n=$(entry "$2" "$h")
    if [ -z "$n" ]; then removed=$((removed+1)); echo "REMOVED: $h"; else
      kept=$((kept+1)); [ "$b" = "$n" ] || { changed=$((changed+1)); echo "CHANGED: $h"; }
    fi
  done < <(grep '^### ' "$1")
  echo "stories_kept=$kept changed=$changed removed=$removed"
}
echo "-- real head --"; compare_stories "$SH/base-backlog.md" "$BL"
bh=$(grep -c '^### ' "$SH/base-backlog.md"); hh=$(grep -c '^### ' "$BL")
echo "base_headings=$bh head_headings=$hh added=$((hh-bh))"
newonly=$(comm -13 <(grep '^### ' "$SH/base-backlog.md" | LC_ALL=C sort) <(grep '^### ' "$BL" | LC_ALL=C sort) | sed '/^$/d')
echo "new_headings=$(printf '%s\n' "$newonly" | grep -c . || true)"
printf '%s\n' "$newonly" | grep -vE '^### M2-S1[89] ' | sed '/^$/d' | sed 's/^/UNEXPECTED: /'
i=0; order=OK
while IFS= read -r h; do j=$(awk -v h="$h" '$0==h{print NR; exit}' "$BL"); [ "${j:-0}" -lt "$i" ] && order=FAIL; i=${j:-0}; done < <(grep '^### ' "$SH/base-backlog.md")
echo "order=$order"
fm() { awk 'NR==1&&$0=="---"{f=1} f{print} f&&NR>1&&$0=="---"{exit}' "$1"; }
rg() { awk '/^## Reading guide/{f=1} /^## Cross-cutting principles/{exit} f{print}' "$1"; }
cc() { awk '/^## Cross-cutting principles/{f=1} /^## Epic M0:/{exit} f{print}' "$1"; }
note() { awk -v s="$1" -v e="$2" 'NR>=s&&NR<=e' "$BL"; }
for r in fm rg cc; do $r "$SH/base-backlog.md" > "$SH/p35-$r-b"; $r "$BL" > "$SH/p35-$r-h"; cmp -s "$SH/p35-$r-b" "$SH/p35-$r-h" && echo "$r=byte-identical" || echo "$r=CHANGED"; done
bns=$(grep -n '^Note: the M1 redefinition moved the queue' "$SH/base-backlog.md" | cut -d: -f1)
bne=$(grep -n '^the gap is deliberate\. M2 stories keep their codes\.$' "$SH/base-backlog.md" | cut -d: -f1)
backlog_ranges
awk -v s="$bns" -v e="$bne" 'NR>=s&&NR<=e' "$SH/base-backlog.md" > "$SH/p35-note-b"
awk -v s="$NOTE_S" -v e="$NOTE_E" 'NR>=s&&NR<=e' "$BL" > "$SH/p35-note-h"
cmp -s "$SH/p35-note-b" "$SH/p35-note-h" && echo "retirement_note=byte-identical" || echo "retirement_note=CHANGED"
newc=$(printf '%s\n' "$newonly" | sed '/^$/d' | wc -l)
[ "$order" = "OK" ] && [ "$newc" -eq 2 ] && echo "P35 verdict: PASS" || { [ "$newc" -eq 0 ] && echo "P35 verdict: PASS (control: no new story yet)"; } || echo "P35 verdict: FAIL"
```

**P36 — planned-not-delivered semantics**

```bash
[ "${P00_READY:-}" = "gh303" ] || { echo "FATAL: P00 preamble not loaded; run each block in a fresh shell as 'source P00; source Pn'" >&2; exit 1; }
n=0; [ -f "$M2/commands/repos.md" ] && grep -Fxq 'Status: Proposed (M2)' "$M2/commands/repos.md" && n=$((n+1))
grep -Fxq 'Status: Proposed (M2)' "$M2/commands/projects.md" && n=$((n+1))
echo "proposed_headers=$n/2"
DOCS="$(printf '%s\n' "$BL" "$M2/README.md" "$M2/architecture.md" "$M2/contracts.md" "$M2/test-scenarios.md" "$M2/journeys.md" "$M2/entrypoint-delta.md" "$M2/commands/projects.md" "$MR" "$ST" "$PWD/doc/planning/oss-tooling/cli-command-registry.md")"
[ -f "$M2/commands/repos.md" ] && DOCS="$DOCS
$M2/commands/repos.md"
claims=$(grep -rnE '(^|[^a-z])(delivered|is current|shipped|now generally available)' $DOCS 2>/dev/null | grep -iE 'repos|projects|project group|workspace discovery|cross-repository' | grep -viE 'delivered (engine|coordinator|family|baseline|queue|lanes|status|verify|merge|closeout|dispatch|spend|retro|milestone|surfaces)|delivered in|delivered by M1|M1 delivered|delivered M1' | wc -l)
echo "delivered_claims=$claims"
grep -Fq 'Everything in this pack is **planned until M2 exit**' "$M2/README.md" && echo "pack_statement=verbatim" || echo "pack_statement=CHANGED"
snap=$(grep -Eic 'relabelled|is now a snapshot|snapshot of delivered' "$M2/commands/projects.md" "$M2/README.md" | awk -F: '{s+=$2} END{print s+0}')
echo "snapshot_relabels=$snap"
[ "$n" -eq 2 ] && [ "$claims" -eq 0 ] && grep -Fq 'Everything in this pack is **planned until M2 exit**' "$M2/README.md" && [ "$snap" -eq 0 ] && echo "P36 verdict: PASS" || echo "P36 verdict: FAIL"
```

**P37 — the forbidden-literals registration 139 → 140**

```bash
[ "${P00_READY:-}" = "gh303" ] || { echo "FATAL: P00 preamble not loaded; run each block in a fresh shell as 'source P00; source Pn'" >&2; exit 1; }
require_p00; need cnt
reg_entries() { awk '/"registered": \[/{f=1;next} f&&/^  \]/{f=0} f' "${1:-$REG}" | sed -E 's/^ *"([^"]*)",?$/\1/'; }
reg_entries "$REG" > "$SH/reg-head.txt"
n=$(wc -l < "$SH/reg-head.txt"); b=$(reg_entries "$SH/base-forbidden.json" | wc -l)
echo "registered=$n base_registered=$b delta=$((n-b))"
q=$(grep -n 'milestones/m2/commands/queue.md' "$SH/reg-head.txt" | cut -d: -f1)
s=$(grep -n 'milestones/m2/commands/spend.md' "$SH/reg-head.txt" | cut -d: -f1)
r=$(grep -n 'milestones/m2/commands/repos.md' "$SH/reg-head.txt" | cut -d: -f1)
echo "queue_row=${q:-absent} repos_row=${r:-absent} spend_row=${s:-absent}"
if [ -n "$r" ] && [ -n "$q" ] && [ -n "$s" ]; then
  [ "$r" -eq "$((q+1))" ] && [ "$s" -eq "$((r+1))" ] && echo "position=between-queue-and-spend" || echo "position=OUT-OF-ORDER"; else echo "position=repos-not-registered"; fi
echo "duplicates=$(sort "$SH/reg-head.txt" | uniq -d | wc -l)"
g_one=$(bun run scripts/checks/forbidden-literals.ts 2>&1 | grep -c 'unregistered user-facing doc' || true)
echo "unregistered_findings=$g_one"
[ "$n" -eq 140 ] && [ "$b" -eq 139 ] && [ "$(sort "$SH/reg-head.txt" | uniq -d | wc -l)" -eq 0 ] && [ -n "$r" ] && [ "$r" -eq "$((q+1))" ] && [ "$g_one" -eq 0 ] && echo "P37 verdict: PASS" || echo "P37 verdict: FAIL"
```

**P38 — the distribution guard under the default `TMPDIR`**

```bash
[ "${P00_READY:-}" = "gh303" ] || { echo "FATAL: P00 preamble not loaded; run each block in a fresh shell as 'source P00; source Pn'" >&2; exit 1; }
# default TMPDIR is required here: the guard and `pnpm check` have opposite requirements
env -u TMPDIR bash scripts/.tests/test-doc-distribution.sh > "$SH/p38.log" 2>&1; rc=$?
echo "dist_guard_exit=$rc"
grep -E 'no drift|markers' "$SH/p38.log" | tail -2
markers=$({ printf '%s\n' "$BL" "$M2/README.md" "$M2/architecture.md" "$M2/contracts.md" "$M2/test-scenarios.md" "$M2/journeys.md" "$M2/entrypoint-delta.md" "$M2/commands/projects.md" "$MR" "$ST"; } | xargs grep -c 'ados_distribution' 2>/dev/null | awk -F: '{s+=$2} END{print s+0}')
echo "planning_markers=$markers"
[ "$rc" -eq 0 ] && [ "$markers" -eq 0 ] && echo "P38 verdict: PASS (control)" || echo "P38 verdict: FAIL"
```

**P39 — both aggregate-gate invocations and the AC-NFR6-1 v1.1 classifier**

> Run with `RUN_GATES=1` for the two real invocations (it writes `$SH/p39-{local,default}.{rc,log}`); the classifier reads those files and the re-run record `$SH/p39-rerun.txt`. `P39_FIXTURE_DIR=/tmp/gh303/p39fix/<case>` points it at a synthetic log set, which is how the five classifier branches (`none`, `excused`, unexcused, repository-local failure, missing rerun) are proven without re-running the gate.

```bash
[ "${P00_READY:-}" = "gh303" ] || { echo "FATAL: P00 preamble not loaded; run each block in a fresh shell as 'source P00; source Pn'" >&2; exit 1; }
require_p00
# Policy (spec v1.1 AC-NFR6-1 / NFR-6 / DEC-16):
#  (a) the repository-local full-suite run is authoritative: exit 0 required;
#      any failure there, including a repeated TC-WIRE-002 timeout, is a delivery failure;
#  (b) both runs are recorded;
#  (c) a default-run ci-baseline-parity failure and a default-run TC-WIRE-002 timeout
#      are recorded and re-run, and are excused only while the repository-local run is
#      green on the same head;
#  (d) any other default-run failure is a delivery failure.
GATE_DIR=${P39_FIXTURE_DIR:-$SH}
if [ "${RUN_GATES:-0}" = "1" ]; then
  REPO_ROOT=$(git rev-parse --show-toplevel); mkdir -p "$REPO_ROOT/tmp/tmpdir"
  TMPDIR="$REPO_ROOT/tmp/tmpdir" pnpm check > "$SH/p39-local.log" 2>&1; echo $? > "$SH/p39-local.rc"
  env -u TMPDIR pnpm check > "$SH/p39-default.log" 2>&1; echo $? > "$SH/p39-default.rc"
fi
for f in local.rc local.log default.rc default.log; do
  [ -s "$GATE_DIR/p39-$f" ] || { echo "FATAL: missing or empty $GATE_DIR/p39-$f; run P39 with RUN_GATES=1" >&2; exit 1; }
done
local_rc=$(cat "$GATE_DIR/p39-local.rc"); default_rc=$(cat "$GATE_DIR/p39-default.rc")
local_fail=$(grep -E '^\(fail\)' "$GATE_DIR/p39-local.log" | sed -E 's/ \[.*//; s/^\(fail\) //' | sort -u)
default_fail=$(grep -E '^\(fail\)' "$GATE_DIR/p39-default.log" | sed -E 's/ \[.*//; s/^\(fail\) //' | sort -u)
echo "repo_local_exit=$local_rc default_exit=$default_rc"
echo "local_failed_tests=$(printf '%s\n' "$local_fail" | grep -c . || true) default_failed_tests=$(printf '%s\n' "$default_fail" | grep -c . || true)"
printf '%s\n' "$default_fail" | sed '/^$/d' | sed 's/^/default_fail: /'
local_summary=$(grep -E '^ *[0-9]+ (pass|skip|fail)$' "$GATE_DIR/p39-local.log" | tr '\n' ' ')
default_summary=$(grep -E '^ *[0-9]+ (pass|skip|fail)$' "$GATE_DIR/p39-default.log" | tr '\n' ' ')
echo "recorded_local=yes ($local_summary) recorded_default=yes ($default_summary)"
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
echo "default_failure_class=$cls reason=$reason"
builtin=/dev/null
if [ "$cls" = "excused" ]; then
  rerun=$(cat "$GATE_DIR/p39-rerun.txt" 2>/dev/null || true)
  if [ -z "$rerun" ]; then echo "rerun_recorded=no"; cls=missing-rerun; else echo "rerun_recorded=yes ($(printf '%s' "$rerun" | tr '\n' ';'))"; fi
else echo "rerun_recorded=n/a"; fi
[ "$cls" = "none" ] || [ "$cls" = "excused" ] && echo "P39 verdict: PASS ($cls)" || echo "P39 verdict: FAIL ($cls: $reason)"
```

**P40 — the structural diagram read**

```bash
[ "${P00_READY:-}" = "gh303" ] || { echo "FATAL: P00 preamble not loaded; run each block in a fresh shell as 'source P00; source Pn'" >&2; exit 1; }
kw='^(flowchart|graph|sequenceDiagram|classDiagram|stateDiagram-v2)'
fcheck() { local f="$1" fences mer untagged bad first
  fences=$(grep -c '^```' "$f"); mer=$(grep -c '^```mermaid' "$f"); untagged=0; bad=0
  [ $((fences % 2)) -eq 0 ] && echo "$f fences=$fences even" || echo "$f fences=$fences ODD"
  while IFS='|' read -r tag fb; do
    [ -z "$fb" ] && continue
    if printf '%s' "$fb" | grep -Eq "$kw"; then
      [ "$tag" = "mermaid" ] || { untagged=$((untagged+1)); echo "$f UNTAGGED-DIAGRAM: $fb"; }
    fi
    if [ "$tag" = "mermaid" ]; then
      printf '%s' "$fb" | grep -Eq "$kw" || { bad=$((bad+1)); echo "$f BAD-KEYWORD: $fb"; }
    fi
  done < <(fence_blocks "$f")
  echo "$f mermaid=$mer untagged_diagrams=$untagged bad_keywords=$bad"
}
for f in "$M2/README.md" "$M2/architecture.md" "$M2/contracts.md" "$M2/test-scenarios.md" "$M2/journeys.md" "$M2/entrypoint-delta.md" "$M2/commands/projects.md" "$BL" "$MR" "$ST" "$PWD/doc/planning/oss-tooling/cli-command-registry.md" "$M2/commands/repos.md"; do [ -f "$f" ] && fcheck "$f"; done
c1=$(grep -cE '^## C4 Level 1([^0-9]|$)' "$A"); c2=$(grep -cE '^## C4 Level 2([^0-9]|$)' "$A"); c3=$(grep -cE '^## C4 Level 3([^0-9]|$)' "$A")
echo "c4_headings=$c1/$c2/$c3"
kf=$(awk '/^## Key flows/{f=1;next} f&&/^## /{exit} f&&/^### /{c++} END{print c+0}' "$A")
echo "key_flows_headings=$kf/8"
ownfail=0
for h in $(awk '/^## Key flows/{f=1;next} f&&/^## /{exit} f&&/^### /{print}' "$A" | sed 's/^### //; s/ /%20/g'); do :; done
ownfail=$(awk '/^## Key flows/{kf=1;next} kf&&/^## /{kf=0} kf&&/^### /{ if (h!="") { if (m!=1) {print "FLOW "h" mermaid="m; bad++} } h=$0; m=0; next } kf&&/^```mermaid/{m++} END{ if (h!="" && m!=1) {print "FLOW "h" mermaid="m; bad++} ; print "flow_ownership_bad="bad+0 }' "$A")
echo "$ownfail"
[ "$c1" -eq 1 ] && [ "$c2" -eq 1 ] && [ "$c3" -eq 1 ] && [ "$kf" -eq 8 ] && echo "P40 verdict: PASS" || echo "P40 verdict: FAIL"
```

**P41 — the 26-clause fidelity scan**

```bash
[ "${P00_READY:-}" = "gh303" ] || { echo "FATAL: P00 preamble not loaded; run each block in a fresh shell as 'source P00; source Pn'" >&2; exit 1; }
cat > "$SH/e18.txt" <<'E'
E
{ entry "$BL" '### M2-S18 '; entry "$BL" '### M2-S19 '; entry "$BL" '### M2-S11 '; } | squash > "$SH/fid.txt"
tot=0; pres=0
while IFS='|' read -r id story anchor clause; do
  [ -z "$id" ] && continue; tot=$((tot+1))
  if grep -Eiq -- "$anchor" "$SH/fid.txt"; then pres=$((pres+1)); else echo "MISSING $id: $clause"; fi
done < <(clause_rows)
echo "clause_scan: total=$tot present=$pres missing=$((tot-pres))"
[ "$tot" -eq 26 ] && [ "$pres" -eq 26 ] && echo "P41 verdict: PASS" || echo "P41 verdict: FAIL"
```

**P42 — the forbidden-literals guard**

```bash
[ "${P00_READY:-}" = "gh303" ] || { echo "FATAL: P00 preamble not loaded; run each block in a fresh shell as 'source P00; source Pn'" >&2; exit 1; }
bun run scripts/checks/forbidden-literals.ts > "$SH/p42.log" 2>&1; rc=$?
echo "forbidden_exit=$rc"
grep -E '^OK forbidden-literals|violation' "$SH/p42.log" | head -3
echo "violations=$(grep -cE '^  - |VIOLATION' "$SH/p42.log" || true)"
[ "$rc" -eq 0 ] && echo "P42 verdict: PASS (control)" || echo "P42 verdict: FAIL"
```

**P43 — relative links and restated acceptance blocks**

```bash
[ "${P00_READY:-}" = "gh303" ] || { echo "FATAL: P00 preamble not loaded; run each block in a fresh shell as 'source P00; source Pn'" >&2; exit 1; }
broken=0
for f in "$BL" "$M2/README.md" "$M2/architecture.md" "$M2/contracts.md" "$M2/test-scenarios.md" "$M2/journeys.md" "$M2/entrypoint-delta.md" "$M2/commands/projects.md" "$M2/commands/repos.md" "$MR" "$ST" "$PWD/doc/planning/oss-tooling/cli-command-registry.md"; do
  [ -f "$f" ] || continue; d=$(dirname "$f")
  while IFS= read -r l; do
    case "$l" in http*|mailto:*|'#'*) continue ;; esac
    t="$d/${l%%#*}"
    [ -e "$t" ] || { echo "BROKEN $f -> $l"; broken=$((broken+1)); }
  done < <(grep -oE '\]\([^)]+\)' "$f" | sed -E 's/^\]\(//; s/\)$//' | sort -u)
done
echo "broken_links=$broken"
restated=$(grep -chE '^- AC:|^\*\*Given\*\*' "$M2/README.md" "$M2/architecture.md" "$M2/contracts.md" "$M2/test-scenarios.md" "$M2/journeys.md" "$M2/entrypoint-delta.md" "$M2/commands/projects.md" 2>/dev/null | awk '{s+=$1} END{print s+0}')
echo "restated_ac_blocks=$restated"
[ "$broken" -eq 0 ] && [ "$restated" -eq 0 ] && echo "P43 verdict: PASS (control)" || echo "P43 verdict: FAIL"
```

**P44 — retention-oracle soundness with four mutants**

```bash
[ "${P00_READY:-}" = "gh303" ] || { echo "FATAL: P00 preamble not loaded; run each block in a fresh shell as 'source P00; source Pn'" >&2; exit 1; }
require_p00; need diffstat newsec_of newsec_count
echo "oracle=whole-file-line-retention (whole-section cmp not used)"
read -r rem add <<< "$(diffstat "$SH/base-status.md" "$ST")"
echo "base_lines=$(wc -l < "$SH/base-status.md") retained=$(wc -l < "$SH/base-status.md") removed_or_modified=$rem additions=$add"
cp "$SH/base-status.md" "$SH/fix-ok.md"
printf '\n## GH-303 amendment (2026-11-11)\n\nPlanning state only.\nThe naming boundary holds.\n' >> "$SH/fix-ok.md"
fixcheck() { local r a s o
  read -r r a <<< "$(diffstat "$SH/base-status.md" "$1")"
  s=$(newsec_of "$SH/base-status.md" "$1")
  if [ -z "$s" ]; then o=$a; else o=$(diff -U0 "$SH/base-status.md" "$1" | grep -E '^@@' | sed -E 's/^@@ -[0-9]+(,[0-9]+)? \+([0-9]+)(,([0-9]+))? @@.*/\2 \4/' | awk -v s="$((s-1))" '{c=$1; d=($2==""?1:$2); if (c<s) print}' | wc -l); fi
  echo "$r $a $o"; }
read -r fr fa fo <<< "$(fixcheck "$SH/fix-ok.md")"
echo "conforming_fixture: removed=$fr added=$fa outside=$fo verdict=$([ "$fr" -eq 0 ] && [ "$fo" -eq 0 ] && [ "$fa" -gt 0 ] && echo OK || echo FAILED)"
cp "$SH/fix-ok.md" "$SH/fix-del.md"; sed -i '190d' "$SH/fix-del.md"
read -r dr da do_ <<< "$(fixcheck "$SH/fix-del.md")"; echo "delete_fixture: removed=$dr (expect >0)"
cp "$SH/fix-ok.md" "$SH/fix-mod.md"; sed -i '100s/.*/MUTATED LINE/' "$SH/fix-mod.md"
read -r mr ma mo <<< "$(fixcheck "$SH/fix-mod.md")"; echo "modify_fixture: removed=$mr (expect >0)"
cp "$SH/fix-ok.md" "$SH/fix-swap.md"; awk 'NR==50{a=$0;next} NR==51{print; print a; next} {print}' "$SH/fix-swap.md" > "$SH/fix-swap2.md"
read -r sr sa so <<< "$(fixcheck "$SH/fix-swap2.md")"; echo "swap_fixture: removed=$sr (expect >0)"
cp "$SH/fix-ok.md" "$SH/fix-out.md"; sed -i '5i INJECTED OUTSIDE THE SECTION' "$SH/fix-out.md"
read -r or_ oa oo <<< "$(fixcheck "$SH/fix-out.md")"; echo "outside_insert_fixture: outside_hunks=$oo (expect >0)"
[ "$fr" -eq 0 ] && [ "$fo" -eq 0 ] && [ "$fa" -gt 0 ] && [ "$dr" -gt 0 ] && [ "$mr" -gt 0 ] && [ "$sr" -gt 0 ] && [ "$oo" -gt 0 ] && [ "$rem" -eq 0 ] && echo "P44 verdict: PASS" || echo "P44 verdict: FAIL"
```

**P45 — the naming matrix, required half, with two fixtures**

> Uses the `matrix_rows()`, `path_of()`, and `region()` helpers defined in **P00**. Every region must be non-empty, and the S19 row requires `one lifecycle` because Appendix B places the group statement in S18-T5.

```bash
[ "${P00_READY:-}" = "gh303" ] || { echo "FATAL: P00 preamble not loaded; run each block in a fresh shell as 'source P00; source Pn'" >&2; exit 1; }
require_p00; need matrix_rows path_of region backlog_ranges
echo "-- P45: required-statement half --"
p45ok=0; p45tot=0; p45empty=0
while IFS='|' read -r id palias mode arg req forb; do
  [ -z "$id" ] && continue; p45tot=$((p45tot+1))
  f=$(path_of "$palias")
  if [ ! -f "$f" ]; then echo "$id required=NOFILE"; continue; fi
  txt=$(region "$f" "$mode" "$arg" | squash)
  if [ -z "$txt" ]; then echo "$id required=EMPTY"; p45empty=$((p45empty+1)); continue; fi
  c=$(printf '%s' "$txt" | grep -Eoi -- "$req" | wc -l)
  if [ "$c" -ge 1 ]; then p45ok=$((p45ok+1)); echo "$id required=OK"; else echo "$id required=MISSING"; fi
done < <(matrix_rows)
echo "matrix_rows_required=$p45ok/$p45tot regions_empty=$p45empty"
printf '## repos.v1\n\nThe flat enumeration contract: repo key, root, state location.\n' > "$SH/fix-good.md"
g=$(region "$SH/fix-good.md" sect '## repos.v1' | squash | grep -Eoi 'repo key' | wc -l)
printf '## repos.v1\n\nThe enumeration contract.\n' > "$SH/fix-bad.md"
b=$(region "$SH/fix-bad.md" sect '## repos.v1' | squash | grep -Eoi 'repo key' | wc -l)
echo "positive_fixture=$([ "$g" -ge 1 ] && echo OK || echo FAILED) negative_fixture=$([ "$b" -eq 0 ] && echo detected || echo FAILED)"
[ "$p45ok" -eq "$p45tot" ] && [ "$p45tot" -eq 17 ] && [ "$p45empty" -eq 0 ] && [ "$g" -ge 1 ] && [ "$b" -eq 0 ] && echo "P45 verdict: PASS" || echo "P45 verdict: FAIL ($p45ok/$p45tot rows in required state)"
```

### 7.2 TC → Procedure → Implementation Mapping

| TC ID | AC | Procedure | Execution command | Implementation status | Recorded evidence (base tree and conforming fixture) |
|---|---|---|---|---|---|
| TC-M2DOM-001 | AC-F1-1 | P01 | `bash` block **P01** | Manual Only — uncommitted procedure | base `retained_clauses=5/5 depends_line=exact repos_list_fields=MISSING transition_note=MISSING goal_projects_command=PRESENT` → FAIL; fixture `5/5 exact OK OK ABSENT` → PASS |
| TC-M2DOM-002 | AC-F1-2 | P02 | `bash` block **P02** | Manual Only — uncommitted procedure | base `flat_projects_statements_in_entry=3 raw=2 repos_list_in_entry=0` → FAIL; fixture `flat=0 raw=2 repos_list=3 group_meaning=0` → PASS |
| TC-M2DOM-003 | AC-F2-1 | P03 | `bash` block **P03** | Manual Only — uncommitted procedure | base `S18=absent clauses_present=0/12` → FAIL; fixture `12/12 shape_labels=4/4 ticket_line=0` → PASS |
| TC-M2DOM-004 | AC-F2-2 | P04 | `bash` block **P04** | Manual Only — uncommitted procedure | base `s18_nyts=0 contracts_nyts=0 validation MISSING rather_than_rejected MISSING softening ABSENT` → FAIL; fixture `1/1 validation OK rather_than_rejected OK softening ABSENT` → PASS |
| TC-M2DOM-005 | AC-F3-1 | P05 | `bash` block **P05** | Manual Only — uncommitted procedure | base `S19=absent clauses_present=0/11` → FAIL; fixture `11/11 shape_labels=4/4` → PASS |
| TC-M2DOM-006 | AC-F3-2 | P06 | `bash` block **P06** | Manual Only — uncommitted procedure | base `S19=absent numbered_items=0/3` → FAIL; fixture `3/3 a1=1 a2=1 a3=1` → PASS |
| TC-M2DOM-007 | AC-F3-3 | P07 | `bash` block **P07** | Manual Only — uncommitted procedure | base `contract MISSING T1,T2,T3,T4,T6; s19_task_to_contract=1/6` → FAIL; fixture `6/6` → PASS |
| TC-M2DOM-008 | AC-F4-1 | P08 | `bash` block **P08** | Manual Only — uncommitted procedure | base `s17_last=1285 separator=1287 epic_m3=1289 window=1286:1286; s18_line=absent s19_line=absent; placement=FAIL` → FAIL; fixture `s17_last=1293 separator=1310 epic_m3=1312 window=1294:1309; s18=1294 s19=1300; placement=inside-window` → PASS |
| TC-M2DOM-009 | AC-F4-2 | P09 | `bash` block **P09** | Manual Only — uncommitted procedure | base `retirement_note=1051..1054 context=1055..1055 paragraph_lines=0 paragraph_strictly_between=FAIL` → FAIL; fixture `context=1055..1060 paragraph_lines=4 strictly_between=OK levels/boundary/root=OK` → PASS |
| TC-M2DOM-010 | AC-F4-3 | P10 | `bash` block **P10** | Manual Only — uncommitted procedure | base `backlog_hunks=0 non_vacuous=no self_tests=3/3` → FAIL (vacuous); fixture `ranges s11 1174:1191 context 1055:1060 window 1294:1309; hunks=6 inside=6 outside=0` → PASS |
| TC-M2DOM-011 | AC-F5-1 | P11 | `bash` block **P11** | Manual Only — uncommitted procedure | base `repository_as_delivery_unit=MISSING project_as_group=MISSING workspace=MISSING optional=MISSING` → FAIL; fixture all four `OK`, mandatory claim `ABSENT` → PASS |
| TC-M2DOM-012 | AC-F5-2 | P12 | `bash` block **P12** | Manual Only — uncommitted procedure | base four anchors `MISSING` → FAIL; fixture `membership/never-required/unrelated/identically=OK; member_must_be_inside=ABSENT` → PASS |
| TC-M2DOM-013 | AC-F5-3 | P13 | `bash` block **P13** | Manual Only — uncommitted procedure | base `overview member=0 group=0 workspace=0; cross_repo=absent; invariants 0/0/0/0` → FAIL; fixture `1/1/1; present mermaid=7; invariants 1/1/1/1` → PASS |
| TC-M2DOM-014 | AC-F6-1 | P14 | `bash` block **P14** | Manual Only — uncommitted procedure | base `repos_v1=absent fields=0/7` → FAIL; fixture `present owned=OK fields=7/7` → PASS |
| TC-M2DOM-015 | AC-F6-2 | P15 | `bash` block **P15** | Manual Only — uncommitted procedure | base six anchors `MISSING`; `group_named_key_denotes_repo=PRESENT` → FAIL; fixture all six `OK`, violation `ABSENT` → PASS |
| TC-M2DOM-016 | AC-F6-3 | P16 | `bash` block **P16** | Manual Only — uncommitted procedure | base `configuration_schema=absent fields=0/8` → FAIL; fixture `8/8` → PASS |
| TC-M2DOM-017 | AC-F6-4 | P17 | `bash` block **P17** | Manual Only — uncommitted procedure | base `change_plan_shape=absent elements=0/7` → FAIL; fixture `elements=8/8` → PASS |
| TC-M2DOM-018 | AC-F6-5 | P18 | `bash` block **P18** | Manual Only — uncommitted procedure | base `consumer_note=MISSING s4_advisory=MISSING` → FAIL; fixture both `OK` → PASS |
| TC-M2DOM-019 | AC-F7-1 | P19 | `bash` block **P19** | Manual Only — uncommitted procedure | base `repos_md=absent checks=0/9 fields=0/5` → FAIL; fixture `9/9 5/5` → PASS |
| TC-M2DOM-020 | AC-F7-2 | P20 | `bash` block **P20** | Manual Only — uncommitted procedure | base `checks=4/7 fields=1/3 forbidden=1` → FAIL; fixture `7/7 3/3 0` → PASS |
| TC-M2DOM-021 | AC-F7-3 | P21 | `bash` block **P21** | Manual Only — uncommitted procedure | base `repos_page absent; projects_page projects.v1=2 repos.v1=0 repos[]=0 header=1` → FAIL; fixture `repos.v1=2 projects[]=0 header=1 not_registered=1` both pages → PASS |
| TC-M2DOM-022 | AC-F8-1 | P22 | `bash` block **P22** | Manual Only — uncommitted procedure | base `s18_seeds=0 s19_seeds=0 coverage=1/10` → FAIL; fixture `3/2 seeds asserts=0 coverage=10/10` → PASS |
| TC-M2DOM-023 | AC-F8-2 | P23 | `bash` block **P23** | Manual Only — uncommitted procedure | base `s11_01 repos=0 projects=1; title/body repos=0; flat_survivors=1` → FAIL; fixture `repos=1 projects=0; title=1 body=2; fields=5/5; survivors=0` → PASS |
| TC-M2DOM-024 | AC-F9-1 | P24 | `bash` block **P24** | Manual Only — uncommitted procedure | base `journey=15 lines anchors=3/4; four anchors MISSING` → FAIL; fixture `20 lines anchors=4/4 all OK` → PASS |
| TC-M2DOM-025 | AC-F10-1 | P25 | `bash` block **P25** | Manual Only — uncommitted procedure | base `additions/mount=MISSING host_overview_claims=1` → FAIL; fixture `repos/projects/mount OK host_overview_claims=0 five preserved` → PASS |
| TC-M2DOM-026 | AC-F11-1 | P26 | `bash` block **P26** | Manual Only — uncommitted procedure | base `pack_rows=12/13 four rows MISSING` → FAIL; fixture `13/13 all rows OK planned_until_exit=verbatim` → PASS |
| TC-M2DOM-027 | AC-F11-2 | P27 | `bash` block **P27** | Manual Only — uncommitted procedure | base `m2_targets=12/13 repos_target=MISSING` → FAIL; fixture `13/13 repos_target=OK M0/M1 byte-identical` → PASS |
| TC-M2DOM-028 | AC-F12-1 | P28 | `bash` block **P28** | Manual Only — uncommitted procedure | base `new_section_count=0 new_section_line=absent` → FAIL; fixture `count=1 line=214 heading ## ... (2026-11-11) anchors=6/6 headings_after=0` → PASS |
| TC-M2DOM-029 | AC-F12-2 | P29 | `bash` block **P29** | Manual Only — uncommitted procedure | base `removed=0 additions=0 count=0` → PASS (control); fixture `removed=0 additions=18 line=214 count=1 headings_after=0 outside=0` → PASS |
| TC-M2DOM-030 | AC-F13-1 | P30 | `bash` block **P30** | Manual Only — uncommitted procedure | base `m2_repos=absent old_projects=1 old_boundary=PRESENT anchors=0/7` → FAIL; fixture `m2_repos=present old_projects=0 old_boundary=ABSENT anchors=7/7` → PASS |
| TC-M2DOM-031 | AC-F13-2 | P31 | `bash` block **P31** | Manual Only — uncommitted procedure | base `changed_lines=0 outside=0 fixture_outside=2` → FAIL (vacuous); fixture `changed=7 outside=0 fixture_outside=2` → PASS |
| TC-M2DOM-032 | AC-F14-1 | P32 | `bash` block **P32** | Manual Only — uncommitted procedure | base `rows_with_survivors=15/17 regions_empty=5; both self-tests detected` → FAIL; fixture `0/17 regions_empty=0; flat/group detected, boundary allowed, base board accepted` → PASS |
| TC-M2DOM-033 | AC-F14-2 | P33 | `bash` block **P33** | Manual Only — uncommitted procedure | base `boundary_locations=0/6 (ARCH projects=5, EPD projects=4, REG repos=8 projects=4)` → FAIL; fixture `6/6` → PASS |
| TC-M2DOM-034 | AC-NFR1-1 | P34 | `bash` block **P34** | Manual Only — uncommitted procedure | base `product_files=0/13 expected_not_changed=13` → FAIL; fixture `13/13 expected_not_changed=0 other_scripts=0 post_commit=pending` → PASS |
| TC-M2DOM-035 | AC-NFR2-1 | P35 | `bash` block **P35** | Manual Only — uncommitted procedure | base `stories_kept=73; base_headings=74 head_headings=74 added=0; order=OK` → PASS (control); fixture `base_headings=74 head_headings=76 added=2; new_headings=2; order=OK` → PASS |
| TC-M2DOM-036 | AC-NFR3-1 | P36 | `bash` block **P36** | Manual Only — uncommitted procedure | base `proposed_headers=1/2 delivered_claims=0 pack_statement=verbatim relabels=0` → FAIL; fixture `2/2 0 verbatim 0` → PASS |
| TC-M2DOM-037 | AC-NFR4-1 | P37 | `bash` block **P37** + `bun run scripts/checks/forbidden-literals.ts` | Manual Only — uncommitted procedure | base `registered=139 base=139 delta=0 repos_row=absent position=repos-not-registered` → FAIL; fixture `140/139 delta=1 rows 88/89/90 position=between-queue-and-spend duplicates=0 unregistered=0` → PASS |
| TC-M2DOM-038 | AC-NFR5-1 | P38 | `env -u TMPDIR bash scripts/.tests/test-doc-distribution.sh` | Existing guard — no change | base `dist_guard_exit=0 no drift 82 in-scope docs planning_markers=0` → PASS (control); unchanged guard |
| TC-M2DOM-039 | AC-NFR6-1 | P39 | `mkdir -p <repo>/tmp/tmpdir && TMPDIR=<repo>/tmp/tmpdir pnpm check` and `env -u TMPDIR pnpm check` | Existing gate — no change | base repository-local `exit=0` (7133 pass, 4 skip, 0 fail, 7137 tests, 880 files, 480.99s); default `exit=1` (7131 pass, 4 skip, 2 fail, 678.41s) with `CI baseline parity` + `TC-WIRE-002` (`timed out after 5000ms`), both re-run and recorded → `default_failure_class=excused` → PASS (policy-conforming); classifier fixtures `none`/`excused` PASS, unexcused/repository-local-failure/missing-rerun FAIL |
| TC-M2DOM-040 | AC-NFR7-1 | P40 | `bash` block **P40** | Manual Only — uncommitted procedure | base `c4=1/1/1 key_flows=7/8 ownership=0 all fences even` → FAIL; fixture `c4=1/1/1 key_flows=8/8 ownership=0 architecture 22 fences/11 mermaid repos.md 4 fences` → PASS |
| TC-M2DOM-041 | AC-NFR8-1 | P41 | `bash` block **P41** | Manual Only — uncommitted procedure | base `clause_scan total=26 present=1 missing=25` → FAIL; fixture `26/26 missing=0` → PASS |
| TC-M2DOM-042 | AC-NFR9-1 | P42 | `bun run scripts/checks/forbidden-literals.ts` | Existing guard — no change | base `forbidden_exit=0 5/5 scope classes 0 violations userFacingDocs=139` → PASS (control); fixture guard `140 file(s), 0 violations` |
| TC-M2DOM-043 | AC-NFR10-1 | P43 | `bash` block **P43** | Manual Only — uncommitted procedure | base `broken_links=0 restated_ac_blocks=0` → PASS (control); fixture same |
| TC-M2DOM-044 | AC-NFR11-1 | P44 | `bash` block **P44** | Manual Only — uncommitted procedure | base `oracle=whole-file-line-retention; conforming fixture OK; delete/modify/swap=1; outside=1` → PASS; fixture real tree `removed=0 additions=18` accepted |
| TC-M2DOM-045 | AC-NFR12-1 | P45 | `bash` block **P45** | Manual Only — uncommitted procedure | base `matrix_rows_required=1/17` → FAIL; fixture `17/17 regions_empty=0 positive=OK negative=detected` → PASS |

No test file is created or updated: no permanent-suite change is permitted or needed (NFR-1; testing-strategy invariant rule — a branch-diff assertion belongs to review and PR-time gates, never to the permanent suite).

### 7.3 Failure Triage

| Symptom | Meaning | Action |
|---|---|---|
| P34 prints `product_files` other than 13, or any path in `unexpected_changed` | The containment budget is broken (AC-NFR1-1/DEC-1) | Revert the out-of-manifest path; the manifest is spec Appendix C, 12 planning files + 1 registry |
| P34 prints `post_commit_check=DIFFERS` after the commit | The committed range does not reproduce the base..worktree product set | Reconcile the commit: the gate is the base..worktree set, and the committed range is the post-commit verification step |
| P34 prints emptiness (`product_files=0/13`) or `unexpected_changed` is non-empty | The change is absent, or an out-of-manifest path is in the base..worktree set | A missing deliverable is never a pass; revert the named out-of-manifest path |
| P08 prints `separator_sequence=CHANGED`, `blank_line_before_separator=0`, or `placement=FAIL` | The insertion landed below the `---` separator, moved it, or swallowed the blank line (AC-F4-1/RSK-2) | Move S18/S19 above the blank line at the derived window (`s17_last+1 .. separator-1`); leave `---`, the blank line, and `## Epic M3` untouched |
| P10 prints an `OUTSIDE` hunk or `non_vacuous=no` | A backlog hunk escaped the S11 entry, the context paragraph, or the new entries (AC-F4-3) | Restore the surrounding bytes; a zero-hunk run is a missing deliverable |
| P09 prints `paragraph_lines=0`, `paragraph_strictly_between=FAIL`, or a missing level | The Epic M2 context paragraph is absent, incomplete, or outside the note-to-M2-S2 window (AC-F4-2) | Insert exactly one paragraph whose non-empty lines lie strictly between the retirement note's last line and `### M2-S2`, with a blank line on each side, naming repository/project/workspace, the boundary, and the root-family consequence |
| P35 prints `CHANGED:`/`REMOVED:` naming a story, or `order=FAIL` | Backlog preservation broken (AC-NFR2-1) | Restore the named story byte for byte; only M2-S11 may change and only S18/S19 may be added |
| P01 prints a `retained MISSING:` line | An M2-S11 state-scoping, host-index, migration, test, or collision clause was lost in the rename (AC-F1-1) | Restore the clause; the rename touches the name, the enumeration task, and the enumeration AC only |
| P02 prints `flat_projects_statements_in_entry>0`, `group_meaning_repos_in_entry>0`, or `collision_clause_copies>1` | A flat statement survives inside the amended entry, or the collision clause was duplicated into another story (AC-F1-2) | Rewrite the statement to `repos list`; the raw `projects list` mention in the mandated transition clause is allowed; keep the collision clause in M2-S11 only |
| P03/P05 print `MISSING <clause id>` | A ticket clause from the 26-row table has no anchor (AC-F2-1/AC-F3-1/AC-NFR8-1) | Restore the named clause; the id and short clause are printed, then run the G-1 paraphrase read |
| P41 prints `missing>0` or `total≠26` | Fidelity is incomplete or the table shrank | Restore the anchors; never delete a table row to make the scan pass |
| P04 prints `s18_validation=MISSING`, `s18_rather_than_rejected=MISSING`, a zero `nyts` count, or `softening=PRESENT` | The mixed-tracker clause was softened or lost (AC-F2-2/RSK-4) | Restore "accepted at validation time with the unimplemented member classified not-yet-supported rather than rejected silently" in both the entry and the contracts |
| P06 prints `numbered_items≠3` or a zero criterion count | An S19 criterion was merged, dropped, or added (AC-F3-2) | Restore three independent numbered items |
| P11 prints `project_as_group=MISSING`, `workspace_in_diagram=MISSING`, or `workspace_optional_in_diagram=MISSING` | The three-level model is asserted but not drawn (AC-F5-1/RSK-8) | Put repository, project, and workspace in the Level 1 diagram with the workspace's optionality visible in the node label or edge |
| P12/P13 print a missing anchor | Model prose, a flow, or an invariant is incomplete (AC-F5-2/AC-F5-3) | Add the named statement; keep the overview flow project-scoped and the cross-repository flow present |
| P14/P15/P16/P17 print `absent` or a missing field | A contract shape is missing or a field carries the wrong meaning (AC-F6-*/RSK-3, RSK-12) | Add the section or the field; `repos.v1` is the flat envelope, `projects.v1` the group envelope, and no group-named key may denote a repository |
| P18 prints `consumer_note=MISSING` or `s4_advisory=MISSING` | The group envelope's consumers are unstated or the M2-S4 row was given a dependency edge (AC-F6-5/DEC-14) | Add the consumer sentence and the advisory note; do not edit M2-S4's `- Depends on:` line (NG-5) |
| P19 prints `repos_md=absent` or `checks<9` | The new contract page is missing or incomplete (AC-F7-1) | Create `commands/repos.md` with the header, name, synopsis, five fields, `repos[]`, exit status, example, error table, see-also, and the rename note |
| P20 prints `checks<7` or `forbidden_flat_statements>0` | `projects.md` still describes checkouts (AC-F7-2) | Rewrite it as the group surface; remove every "enumerates checkouts" statement |
| P21 prints `repos.v1>0` on the projects page or `projects[]>0` on the repos page | The two pages share one surface (AC-F7-3) | Keep each page on its own contract; the bare word `repos` may appear only in the boundary sentence |
| P22/P23 print a zero seed count, `assert_violations>0`, or a missing topic | The seed set is short, a seed has zero or two `Assert:` lines, or a required topic is uncovered (AC-F8-1/AC-F8-2) | Add or amend the named seed; exactly one `Assert:` per seed; the S11 seeds read `repos list` |
| P24 prints a missing journey anchor | The opening journey was not rewritten (AC-F9-1) | Rewrite it project-scoped with one member outside any shared directory, `repos list` for the flat view, `projects list` for the group view, scoped reads, and the two equivalence statements |
| P25 prints `host_overview_claims>0` or a missing addition | `entrypoint-delta.md` still calls `projects` the host overview (AC-F10-1) | Split the additions into `repos` (flat) and `projects` (group) and name both in the mounting paragraph |
| P26/P27 print a short count or a missing row | The new page or the two new stories are not discoverable (AC-F11-1/AC-F11-2) | Add the contents row, the two map rows, the S11 `repos.v1` pointer, and the thirteenth index target; leave M0/M1 rows alone |
| P28 prints `new_section=absent`, a missing anchor, or `delivery_claim=PRESENT` | The status snapshot is absent, incomplete, or overclaims (AC-F12-1/RSK-5) | Add exactly one dated section recording planning state only |
| P29/P44 print `removed_lines>0`, `added_outside_section>0`, or a mutant that is not detected | A base status line was removed, reordered, or modified, an addition escaped the new section, or the oracle is unsound (AC-F12-2/AC-NFR11-1/RSK-10) | Restore the base line byte for byte; confine additions to the new section (its boundary includes the single blank separator line). Never substitute a whole-section `cmp` |
| P30 prints `old_boundary_note=PRESENT` or `registry_anchors<7` | The registry still assigns the two names to the old meanings (AC-F13-1/RSK-11) | Add the M2 `ados repos` row, rewrite `ados projects` as the group surface, reconcile M3-S6 as later `repos` subcommands, and replace the boundary note |
| P31 prints an `OUTSIDE:` line or `fixture_outside=0` | A registry row outside the four permitted regions changed, or the classifier is inert (AC-F13-2) | Restore the named row; the fixture must always report at least one `OUTSIDE` |
| P32 prints a `SURVIVOR` row or `region=EMPTY` | A flat-`projects list` or group-meaning-`repos` statement survives, or a region anchor is wrong so the scan is vacuous (AC-F14-1/RSK-1) | Fix the named location using Appendix B's required statement; an empty region fails instead of reporting `forbidden=0`; re-run until `rows_with_survivors=0/17` and `regions_empty=0` |
| P33 prints `boundary_locations<6/6` | A prose location naming both surfaces does not state the relationship (AC-F14-2); the two index rows are link-only and are checked by P26/P27 | State it once in the same terms: `repos` enumerates checkouts, `projects` groups them |
| P45 prints a `required=MISSING` row or `required=EMPTY` | An Appendix B location lacks its required statement, or its region anchor is empty (AC-NFR12-1) | Add the required statement for that region; keep the matrix at 16 rows / 17 regions (`BL-18` + `BL-19` split) |
| P36 prints `proposed_headers<2`, `delivered_claims>0`, `pack_statement=CHANGED`, or `snapshot_relabels>0` | A page overclaims or lost its planned status (AC-NFR3-1/RSK-5) | Restore the exact header, remove the delivery claim, keep the pack statement verbatim, and do not relabel a page as a snapshot |
| P37 prints `registered≠140`, `position=repos-not-registered`, `position=OUT-OF-ORDER`, or `duplicates>0` | The registry row is missing, duplicated, or misplaced (AC-NFR4-1/RSK-6) | Add exactly one row `doc/planning/oss-tooling/milestones/m2/commands/repos.md` between the `queue.md` and `spend.md` entries |
| P38 prints a non-zero exit | A scoped doc was disturbed or a planning marker appeared (AC-NFR5-1) | Check P34 first; `doc/planning/**` must stay outside the marker set |
| P39 prints `repo_local_exit>0` | A failure in the authoritative repository-local full suite (AC-NFR6-1(a)) | Fix it; the repository-local run has no environmental exemption, and a repeated `TC-WIRE-002` there is a delivery failure |
| P39 prints `default_failure_class=delivery` | A default-run failure that is neither `ci-baseline-parity` nor `TC-WIRE-002`, or a default failure on a head whose repository-local run is not green (AC-NFR6-1(c)/(d)) | Investigate the named test; record the re-run; never reclassify it as environmental (G-6, TR-11). The two named default-only failures are excused only with `repo_local_exit=0` and a `p39-rerun.txt` record |
| P39 prints `missing-rerun` for an excused pair | The two named default failures were not re-run and recorded (AC-NFR6-1(c)) | Re-run each in isolation, write the result to `$SH/p39-rerun.txt`, and re-classify |
| P39 dies with `ENOENT`/`mkdtemp` | The repository-local `TMPDIR` directory was not created | Keep `mkdir -p "$REPO_ROOT/tmp/tmpdir"` before the repository-local run |
| P40 prints an odd fence count, `UNTAGGED-DIAGRAM`, `BAD-KEYWORD`, `c4_headings≠1/1/1`, or `key_flows_headings≠8` | A diagram is structurally invalid or a flow heading is unowned (AC-NFR7-1/RSK-9) | Fix the fence or the keyword line; keep one mermaid block per flow heading, then have the reviewer render the page (G-3) |
| P42 prints a non-zero exit or a violation | A forbidden literal appeared or a doc is unregistered (AC-NFR9-1) | Reword the line; never widen the allowlist |
| P43 prints `broken_links>0` or `restated_ac_blocks>0` | A link is wrong or a pack page restates acceptance criteria (AC-NFR10-1) | Fix the path or replace the restatement with a story-code reference |

## 8. Risks, Assumptions, and Open Questions

### 8.1 Risks

| ID | Testing risk | Mitigation in this plan |
|---|---|---|
| TR-1 | A prose oracle lets a lost or weakened clause pass as complete | A 26-row anchor table built from spec Appendix A, run three times (P03 per entry, P05, and P41 over all three entries) with a named failure per missing clause; the semantic residue is declared as G-1 with a named reviewer |
| TR-2 | A preservation control passes because nothing changed | Non-vacuity guards in P10, P31, and P34, four mutation fixtures in P44, two scan self-tests in P32, and two fixtures in P45; Section 10 labels every control |
| TR-3 | A hunk-containment check silently accepts a moved entry or an insertion below the separator | P08 derives the insertion window from the tree (S17's last content line + 1 to the head separator − 1), asserts the separator triple byte-identical, asserts the blank line before it, and requires S18 before S19 inside the window; P10 classifies hunks against three ranges with three self-tests |
| TR-4 | The status retention oracle flags a legitimate blank separator line, or misses a reordering | P29/P44 define the new-section boundary as the derived heading minus one line, and P44 proves the oracle accepts a conforming head while detecting delete, modify, swap, and outside insertion |
| TR-5 | The registry position check passes because `queue.md` and `spend.md` are adjacent at base | P37 asserts `repos` sits at `queue_index+1` **and** `spend` at `repos_index+1`, so a row appended at the end fails, and P42 fails closed on the unregistered page |
| TR-6 | The two guards are run with the wrong `TMPDIR` and produce a false red or a false green | P38 uses `env -u TMPDIR`; P39 creates `<repo>/tmp/tmpdir` and runs both ways; the classification rule names the only exempt test (G-6) |
| TR-7 | The naming scan is inert or over-broad | P32 and P45 extract each Appendix B region by mode rather than scanning the whole corpus, and each carries fixtures proving detection and acceptance |
| TR-8 | A wrapped or hyphenated line defeats an anchor | The shared `squash()` helper joins a trailing hyphen before collapsing newlines, and every procedure that reads prose uses it |
| TR-9 | A check is run on a moving base | Snapshots are materialised from the pinned `5372dbac`; re-run P00 if the base advances before delivery |
| TR-10 | `pnpm check` is green but unrelated to the documents | Content procedures carry the ACs; P39 is a no-regression gate only (G-7) |
| TR-11 | A default-run failure is excused without the repository-local run being green, or a `TC-WIRE-002` repeat inside the authoritative run is waved through | P39 makes the repository-local full suite authoritative (exit 0; any failure, including a repeated `TC-WIRE-002`, is `delivery`), requires both runs recorded, admits only the two named default-only failures, requires a recorded re-run for each, and excuses them only while the repository-local run is green on the same head. The classifier's five synthetic branches prove each disposition |
| TR-12 | The 26-row clause table drifts from the ticket and silently shrinks | P41 counts its own rows (`total=26`); a row removed from the table changes the total and fails the scan |

### 8.2 Assumptions

- **A-1**: `5372dbacb9c36e1d79d1e55873264155a53f44ff` is the correct base (the branch was created from `origin/main-tools`; only the specification and pm-notes commits sit on top).
- **A-2**: The GH-303 ticket body is the normative clause source, and spec Appendix A transcribes it faithfully; the reviewer re-reads the ticket for the G-1 paraphrase pass.
- **A-3**: `doc/planning/**` is outside the distribution-marker guard's scan set, so no `ados_distribution` marker is expected or allowed (spec §12).
- **A-4**: The repository has no mermaid validator and this change adds none, so the structural read is the truthful bar (G-3).
- **A-5**: Story codes are stable identifiers and file position carries no ordering meaning; placement inside the block is still required by F-4/DEC-8.
- **A-6**: `bun` and `pnpm` are installed with `node_modules` present, and the workspace builds, so P39 is executable as written.
- **A-7**: The environment's default `TMPDIR` is tmpfs; the opposite guard requirements are recorded rather than resolved by changing the environment for the repository (spec §12).
- **A-8**: The twelve planning documents keep their current paths; the manifest in P34 is the spec's Appendix C, so a path rename would be a scope change, not a test failure to absorb.

### 8.3 Open Questions

None. The spec closed its two ticket ambiguities as DEC-2 and DEC-4 and recorded every other editing choice as a decision.

| ID | Question | Blocking? | Owner | Disposition |
|---|---|---|---|---|
| — | None outstanding | — | — | Closed by spec v1.1 and the pm-notes decisions |

### 8.4 Interpretation Decisions and Flagged Spec Gaps

Eight places where the spec's wording admits more than one mechanical reading, and how this plan resolves each without asking for a spec change:

| ID | Spec text | Ambiguity | Resolution in this plan |
|---|---|---|---|
| TP-1 | AC-F12-2 and AC-NFR11-1 | Both state `status.md` line retention, so a naive mapping produces two test cases with one predicate | Split by predicate: TC-029 = presence and order plus addition confinement; TC-044 = byte-identity plus the oracle's soundness (four mutants) and the "no whole-section `cmp`" clause. Declared in the §3.1 coverage note |
| TP-2 | AC-F3-3 and AC-F6-4 | Both describe the cross-repository change plan shape in `contracts.md` | Split by direction: TC-007 traces the six S19 task clauses (clause → contract); TC-017 asserts the shape's seven declared elements (contract → fields). Declared in the §3.1 coverage note |
| TP-3 | AC-F7-3 ("the flat enumeration appears only on the `repos` page") versus AC-F14-2 (every both-name location states the boundary) | The `projects` page must name `repos` in its boundary sentence, so a literal word ban would make the two criteria mutually unsatisfiable | P21 tests contract pointers and envelope keys (`repos.v1`, `repos[]`, `projects.v1`, `projects[]`), not the bare word; the boundary sentence is positively required by P33 |
| TP-4 | NFR-7 ("`## Key flows` holds exactly 8 `###` headings") | The number is stated as an end state while the base has 7 | The plan treats 7 → 8 as the derived consequence of AC-F5-3's new flow and records both numbers (P40), so a missing flow fails as a count mismatch rather than as an unexplained constant |
| TP-5 | F-12/AC-F12-1 require a new dated section but do not fix its title; the plan's TP-5 pin names only the leading date token `2026-11-11` | A fixed title would over-specify the author; a leading-date form contradicts the file's convention (`## M2 planning snapshot (2026-11-10)`) | P28 derives the section as the **only** `## ` heading present in the head and absent from the base (a second new section fails), requires no heading after it, and enforces the date in the file's existing form: title first, date parenthesised, `^## .+ \(2026-11-11\)$`. The title text stays free |

| TP-6 | AC-F14-2 ("every location that names both surfaces states the boundary") versus Appendix B's two index rows | `m2/README.md` and `milestones/README.md` link both surfaces but Appendix B requires only "Both pages linked (13 targets)" and the map rows; forcing a boundary sentence into a link table would over-assert prose the spec does not ask for | P33 checks the six **prose** locations whose Appendix B row requires a relation statement, and P26/P27 own the two index rows as link and row coverage. The boundary rule is still stated in every prose location that names both |
| TP-7 | AC-F6-2's group-envelope rule versus `commands/board.md`'s existing `projects[]` field | `board.md` is **not** in this change's 13-file manifest and is not edited; its pre-existing `projects[]` field means "project keys included in the board" and is not the redefined `projects.v1` group envelope | P15's `projectKey`/repository-identity ban is scoped to the `## projects.v1` section of `contracts.md`; P32 carries a negative control that the base `commands/board.md` text is **not** flagged (`base_board_accepted=OK`). The page's reconciliation is a deferred item owned by S4/S18 (spec §7.3), not a defect of this change |
| TP-8 | Spec §18's recommended five-commit sequence versus the plan's P4-before-P5 ordering | The spec's sequence puts the registry row in the last commit with the indices and status; the plan puts it in P4 because the forbidden-literals guard fails closed on an unregistered new doc, creating a real guard-red window otherwise | The plan's ordering constraint is authoritative for execution; P34's base..worktree manifest and P37's position check are commit-order independent, so no oracle assumes the spec's sequence. The spec/plan wording reconciliation belongs to the plan artifact, not to this test plan |

No spec gap blocks delivery. Flags raised for the author's awareness, all with a working oracle: TP-1 to TP-8 above.

## 9. Plan Revision Log

| Version | Date | Author | Changes |
|---|---|---|---|
| 1.1 | 2026-11-11 | @test-plan-writer | Remediated DoR iteration 1 (`readiness-review/readiness-iter-1.md`) against spec v1.1, with every changed procedure executed in a **fresh shell** on the base tree and on a **conforming, never-committed worktree fixture** (`/tmp/gh303/fx/repo`, base `5372dbac` + the thirteen changes). **Blocking findings, fixed with proof:** (1) BL-18/P32 — replaced the `repos.{0,40}group` regex with sentence-level `@flat`/`@group`/`@both` detectors that attribute enumeration to `projects` and group semantics to `repos` only when the sentence has no `enumerat` predicate before the next `projects` clause; fixture `rows_with_survivors=0/17` on the ticket-verbatim S18/S19 text, base `15/17`, both direction self-tests `detected`, required boundary sentence not flagged. (2) P09/P10 — the context window is now `retirement-note last line + 1 .. ### M2-S2 - 1`; fixture `paragraph_lines=4 paragraph_strictly_between=OK blank_after_note=1 blank_before_s2=1`, P10 `backlog_hunks=6 inside=6 outside=0`; base `paragraph_lines=0`. (3) P19/P20/P21 — `$R` and `$PJ` are P00 variables; fresh-shell fixture `9/9 5/5`, `7/7 3/3 0`, P21 `PASS`. (4) Cross-procedure dependencies — every helper (`entry/section/firstsec/squash/clause_rows/fence_blocks/diffstat/newsec*/matrix_rows/path_of/region/forbidden_* /backlog_ranges/story_section`) and every path (`$A`, `$RG`, `$R`, `$PJ`, …) now lives in P00; each block opens with a loud guard and declares `need`; P17's missing `$ct` and P37's head-vs-base `reg_entries` bug are fixed, and P32 treats an empty region as a failure, so the STAT row can no longer fail open. (5) BL-S11 — the region anchor is `### M2-S11 `; base `BL-S11 forbidden=3 SURVIVOR` (two `projects list` statements plus the goal's overview claim), fixture `BL-S11 forbidden=0`, `P45 BL-S11 required=OK`. (6) P34 — restated as a base..worktree manifest check (`git diff --name-only "$BASE" -- .` plus untracked), decidable before the P5 commit; fixture `product_files=13/13 expected_not_changed=0 post_commit_check=pending`, base `0/13`. (7) TC-039/P39 — aligned to AC-NFR6-1 v1.1: repository-local full suite authoritative, both runs recorded, the two named default-only failures recorded and re-run and excused only while the local run is green, any other failure `delivery`; base `repo_local_exit=0 default_exit=1 default_failure_class=excused`, five classifier branches prove `none`/`excused` pass and unexcused/local-failure/no-rerun fail. (8) Stale P1 tokens — `P35` records base `74 → 74 added=0` and fixture `74 → 76 added=2`; P08/P09 base (1285/1287/1289, window 1286:1286; note 1051..1054, context 1055..1055) and fixture (1293/1310/1312, window 1294:1309; context 1055..1060) values are labelled separately. **Non-blocking 10–16:** TP-5 now enforces the date in the file's parenthesised form and P28 requires exactly one new `##` heading with none after it; §7.3 thresholds are `checks<9`/`checks<7`; P33 checks the six prose locations whose Appendix B row requires a boundary statement and leaves the two index rows to P26/P27; P32 carries a negative control that the unchanged base `commands/board.md` text is not flagged (`base_board_accepted=OK`); the spec §18/plan ordering deviation is declared as TP-8 and no oracle depends on commit order; the authoring-defect count is stated once (four); P02 counts flat statements so the mandated `projects list` transition clause is allowed. **Counts unchanged: 45 ACs (33 functional + 12 non-functional), 45 TCs, 1:1 mapping.** Base verdicts: 38 FAIL + 7 PASS (TC-029, TC-035, TC-038, TC-039, TC-042, TC-043, TC-044; TC-039 is policy-conforming rather than a preservation control); conforming fixture: 45/45 PASS. No product file, spec, plan, pm-notes, or other artifact was edited by this revision. |
| 1.0 | 2026-11-11 | @test-plan-writer | Initial test plan for spec v1.0: 45 acceptance criteria (33 functional + 12 non-functional) covered exactly once by 45 test cases in bidirectional traceability with no orphans, backed by 46 procedure blocks (P00 base loader + P01–P45, with procedure number matching test-case number). **Derived, not assumed:** insertion window `1286:1286` (M2-S17 last content 1285, separator 1287, `## Epic M3` 1289) on a 1454-line backlog; context window `1055:1055` between the retirement note (1051–1054) and `### M2-S2`; `status.md` 212 lines with its last heading at 187; registry 139 entries with `queue.md` at index 88 and `spend.md` at 89; `architecture.md` 20 fences / 10 mermaid / C4 1-1-1 / 7 key flows; `test-scenarios.md` 40 seeds and 40 `Assert:` lines; 12 contents rows and 12 M2 index targets. **Executed against base `5372dbac` before any product edit:** 39 procedures FAIL — 38 because the change is absent or a statement survives, and one (P39) because the default-`TMPDIR` gate is red at base for a pre-existing reason outside the change — while 6 procedures PASS as labelled controls (P29, P35, P38, P42, P43, P44), and every scan carries a fixture proving it bites (P31 registry mutation, P32 two direction fixtures, P44 four retention mutants, P45 positive/negative pair). Four authoring defects were found by these runs and fixed before publication: a clause-table row containing a `|` split the row and dropped `S19-T6` (`total=26 present=1` exposed it); the new-section locator printed `NR` instead of `FNR`, which flagged the conforming status fixture; the `repos`-page oracle counted nine conditions but required ten and matched only prose field names; and the `projects`-page ban pattern flagged the **required** boundary sentence. The two command-page oracles were then proven satisfiable against conforming, never-committed fixtures in `/tmp/gh303/fx/commands/` (`checks=9/9 fields=5/5`, `checks=7/7 fields=3/3 forbidden=0`, page split `PASS`) while still failing on the real pack. Two gate runs recorded: repository-local `pnpm check` exit 0 (7133 pass, 4 skip, 0 fail across 880 files in 490.75s); the default-`TMPDIR` run exit 1 with two failures of 7137 across 880 files in 662.35s — the expected environmental `CI baseline parity` and a pre-existing, independently reproduced `TC-WIRE-002` timeout that the spec's exemption does not cover, recorded as a flagged gap in §1.2 G-6 and in Section 10, with TC-039 therefore recorded as FAIL at base for a reason outside the change. Five interpretation decisions and spec-gap flags recorded as TP-1 to TP-5; ten declared gaps (G-1 to G-10) with named owners; twelve testing risks (TR-1 to TR-12). No test code is added. |

## 10. Test Execution Log

Run date 2026-11-11 against base `5372dbacb9c36e1d79d1e55873264155a53f44ff` on branch `docs/GH-303/project-groups-domain-model` (head `5a6cbf48`, specification/pm-notes/DoR commits only, **no product file edited**). Every procedure was executed **in a fresh shell** as `source P00; source Pn`; the aggregate gate is a separate pair of runs (P39), and every changed procedure was also run against the **conforming, never-committed worktree fixture** at `/tmp/gh303/fx/repo` (base `5372dbac` plus the thirteen changes). A `FAIL` on the base tree proves the procedure detects the missing deliverable; a `PASS` on the fixture proves the oracle is satisfiable on a conforming head; a `PASS (control)` proves a preservation property that must survive the change. The fixture is not committed and is not a deliverable.

| TC ID | Run Date | Result | Notes |
|---|---|---|---|
| TC-M2DOM-001 | 2026-11-11 | FAIL (base); PASS (fixture) | base `retained_clauses=5/5 depends_line=exact repos_list_fields=MISSING transition_note=MISSING goal_projects_command=PRESENT`; fixture `repos_list_fields=OK transition_note=OK goal_projects_command=ABSENT` |
| TC-M2DOM-002 | 2026-11-11 | FAIL (base); PASS (fixture) | base `flat_projects_statements_in_entry=3 projects_list_raw_mentions=2 repos_list_in_entry=0`; fixture `flat=0 raw=2 repos_list=3 group_meaning=0 collision_copies=1 inside_s11=1` |
| TC-M2DOM-003 | 2026-11-11 | FAIL (base); PASS (fixture) | base `S18=absent clauses_present=0/12`; fixture `clauses_present=12/12 shape_labels=4/4 ticket_line=0` |
| TC-M2DOM-004 | 2026-11-11 | FAIL (base); PASS (fixture) | base `s18_nyts=0 contracts_nyts=0 validation=MISSING rather_than_rejected=MISSING softening=ABSENT`; fixture `1/1 validation=OK rather_than_rejected=OK softening=ABSENT` |
| TC-M2DOM-005 | 2026-11-11 | FAIL (base); PASS (fixture) | base `S19=absent clauses_present=0/11`; fixture `clauses_present=11/11 shape_labels=4/4` |
| TC-M2DOM-006 | 2026-11-11 | FAIL (base); PASS (fixture) | base `S19=absent numbered_items=0/3`; fixture `numbered_items=3/3 a1=1 a2=1 a3=1` |
| TC-M2DOM-007 | 2026-11-11 | FAIL (base); PASS (fixture) | base `contract MISSING: T1,T2,T3,T4,T6; s19_task_to_contract=1/6`; fixture `s19_task_to_contract=6/6` |
| TC-M2DOM-008 | 2026-11-11 | FAIL (base); PASS (fixture) | base `s17_last=1285 separator=1287 epic_m3=1289 window=1286:1286; s18/s19 absent; placement=FAIL`; fixture `s17_last=1293 separator=1310 epic_m3=1312 window=1294:1309; s18=1294 s19=1300; placement=inside-window; separator_sequence=identical; blank_before=1` |
| TC-M2DOM-009 | 2026-11-11 | FAIL (base); PASS (fixture) | base `retirement_note=1051..1054 context=1055..1055 paragraph_lines=0 paragraph_strictly_between=FAIL`; fixture `context=1055..1060 paragraph_lines=4 strictly_between=OK blank_after_note=1 blank_before_s2=1 levels/boundary/root=OK; fm/rguide/cc byte-identical` |
| TC-M2DOM-010 | 2026-11-11 | FAIL (base, vacuous); PASS (fixture) | base `backlog_hunks=0 non_vacuous=no classifier_self_tests=3/3`; fixture `ranges s11:1174:1191 context:1055:1060 window:1294:1309; backlog_hunks=6; inside=6 outside=0; non_vacuous=yes` |
| TC-M2DOM-011 | 2026-11-11 | FAIL (base); PASS (fixture) | base `repository_as_delivery_unit=MISSING project_as_group=MISSING workspace_in_diagram=MISSING workspace_optional=MISSING`; fixture all four `OK`, `workspace_mandatory_claim=ABSENT` |
| TC-M2DOM-012 | 2026-11-11 | FAIL (base); PASS (fixture) | base four anchors `MISSING member_must_be_inside=ABSENT`; fixture `membership_declared/workspace_never_required/unrelated_dirs/identical_behaviour=OK member_must_be_inside=ABSENT` |
| TC-M2DOM-013 | 2026-11-11 | FAIL (base); PASS (fixture) | base `overview member=0 group=0 workspace=0; cross_repo=absent; invariants 0/0/0/0`; fixture `1/1/1; cross_repo present mermaid=7; invariants 1/1/1/1` |
| TC-M2DOM-014 | 2026-11-11 | FAIL (base); PASS (fixture) | base `repos_v1_section=absent repos_v1_fields=0/7`; fixture `present owned_by_M2-S11=OK fields=7/7` |
| TC-M2DOM-015 | 2026-11-11 | FAIL (base); PASS (fixture) | base six group anchors `MISSING`; `group_named_key_denotes_repo=PRESENT`; fixture all six `OK`, violation `ABSENT` |
| TC-M2DOM-016 | 2026-11-11 | FAIL (base); PASS (fixture) | base `configuration_schema=absent fields=0/8`; fixture `fields=8/8` |
| TC-M2DOM-017 | 2026-11-11 | FAIL (base); PASS (fixture) | base `change_plan_shape=absent elements=0/7`; fixture `elements=8/8` (the shape has eight checked anchors) |
| TC-M2DOM-018 | 2026-11-11 | FAIL (base); PASS (fixture) | base `consumer_note=MISSING s4_advisory=MISSING`; fixture `consumer_note=OK s4_advisory=OK` |
| TC-M2DOM-019 | 2026-11-11 | FAIL (base); PASS (fixture) | base `repos_md=absent checks=0/9 fields=0/5`; fixture `checks=9/9 fields=5/5` |
| TC-M2DOM-020 | 2026-11-11 | FAIL (base); PASS (fixture) | base `checks=4/7 fields=1/3 forbidden_flat_statements=1`; fixture `checks=7/7 fields=3/3 forbidden_flat_statements=0` |
| TC-M2DOM-021 | 2026-11-11 | FAIL (base); PASS (fixture) | base `repos_page=absent; projects_page projects.v1=2 repos.v1=0 repos[]=0 header=1 not_registered=1`; fixture `repos.v1=2 projects[]=0 header=1 not_registered=1` both pages |
| TC-M2DOM-022 | 2026-11-11 | FAIL (base); PASS (fixture) | base `s18_seeds=0 s19_seeds=0 assert_violations=0 coverage_anchors=1/10`; fixture `s18_seeds=3 s19_seeds=2 assert_violations=0 coverage_anchors=10/10` |
| TC-M2DOM-023 | 2026-11-11 | FAIL (base); PASS (fixture) | base `s11_01 repos=0 projects=1; s11_02 title/body repos=0; assert_fields=5/5; flat_assert_survivors=1`; fixture `s11_01 repos=1 projects=0; s11_02 title=1 body=2; fields=5/5; survivors=0` |
| TC-M2DOM-024 | 2026-11-11 | FAIL (base); PASS (fixture) | base `opening_journey_lines=15 journey_anchors=3/4` with four anchors `MISSING`; fixture `20 lines anchors=4/4` all anchors `OK` |
| TC-M2DOM-025 | 2026-11-11 | FAIL (base); PASS (fixture) | base `repos_addition/projects_addition/mount_names_both=MISSING; host_overview_claims=1`; fixture `repos/projects/mount=OK host_overview_claims=0` and five preserved tokens `OK` |
| TC-M2DOM-026 | 2026-11-11 | FAIL (base); PASS (fixture) | base `pack_rows=12/13 four rows MISSING planned_until_exit=verbatim`; fixture `pack_rows=13/13 repos/map_s18/map_s19/s11_row=OK planned_until_exit=verbatim` |
| TC-M2DOM-027 | 2026-11-11 | FAIL (base); PASS (fixture) | base `m2_targets=12/13 repos_target=MISSING`; fixture `m2_targets=13/13 repos_target=OK m0/m1 byte-identical` |
| TC-M2DOM-028 | 2026-11-11 | FAIL (base); PASS (fixture) | base `new_section_count=0 new_section_line=absent`; fixture `count=1 line=214 heading=## GH-303 domain-model amendment (2026-11-11) heading_form=title-plus-parenthesised-date headings_after=0 anchors=6/6 delivery_claim=ABSENT` |
| TC-M2DOM-029 | 2026-11-11 | PASS (control); PASS (fixture) | base `removed_lines=0 additions=0 count=0 outside=0`; fixture `removed=0 additions=18 line=214 count=1 headings_after=0 outside=0; base_lines=212 head_lines=230` |
| TC-M2DOM-030 | 2026-11-11 | FAIL (base); PASS (fixture) | base `m2_repos_row=absent old_projects_meaning=1 old_boundary_note=PRESENT anchors=0/7`; fixture `m2_repos_row=present old_projects_meaning=0 old_boundary_note=ABSENT anchors=7/7` |
| TC-M2DOM-031 | 2026-11-11 | FAIL (base, vacuous); PASS (fixture) | base `changed_lines=0 outside=0 fixture_outside=2`; fixture `changed_lines=7 outside=0 fixture_outside=2` |
| TC-M2DOM-032 | 2026-11-11 | FAIL (base); PASS (fixture) | base `rows_with_survivors=15/17 regions_empty=5; self_test_flat/group=detected`; fixture `0/17 regions_empty=0; flat/group detected, boundary_allowed=OK, base_board_accepted=OK` |
| TC-M2DOM-033 | 2026-11-11 | FAIL (base); PASS (fixture) | base `boundary_locations=0/6 (ARCH projects=5, EPD projects=4, REG repos=8 projects=4)`; fixture `6/6` |
| TC-M2DOM-034 | 2026-11-11 | FAIL (base); PASS (fixture) | base `product_files=0/13 expected_not_changed=13 unexpected= other_scripts=0`; fixture `13/13 expected_not_changed=0 unexpected= other_scripts=0 post_commit_check=pending` |
| TC-M2DOM-035 | 2026-11-11 | PASS (control); PASS (fixture) | base `stories_kept=73 changed=0 removed=0; base_headings=74 head_headings=74 added=0; order=OK`; fixture `base_headings=74 head_headings=76 added=2 new_headings=2 order=OK`, four regions `byte-identical` |
| TC-M2DOM-036 | 2026-11-11 | FAIL (base); PASS (fixture) | base `proposed_headers=1/2 delivered_claims=0 pack_statement=verbatim snapshot_relabels=0`; fixture `2/2 0 verbatim 0` |
| TC-M2DOM-037 | 2026-11-11 | FAIL (base); PASS (fixture) | base `registered=139 base_registered=139 delta=0 queue=88 repos=absent spend=89 position=repos-not-registered`; fixture `140/139 delta=1 queue=88 repos=89 spend=90 position=between-queue-and-spend duplicates=0 unregistered=0` |
| TC-M2DOM-038 | 2026-11-11 | PASS (control) | `dist_guard_exit=0`; `no drift — 82 in-scope docs`; `planning_markers=0` |
| TC-M2DOM-039 | 2026-11-11 | PASS (policy-conforming at base); classifier fixtures PASS | base repository-local `exit=0` (7133 pass, 4 skip, 0 fail, 7137 tests, 880 files, 480.99s); default `exit=1` (7131 pass, 4 skip, 2 fail, 678.41s) with `CI baseline parity (hermetic partial clone)` and `TC-WIRE-002` (`timed out after 5000ms`), both recorded and re-run → `default_failure_class=excused` with `repo_local_exit=0`; classifier branches `none`/`excused` PASS, unexcused/repository-local-failure/no-rerun FAIL |
| TC-M2DOM-040 | 2026-11-11 | FAIL (base); PASS (fixture) | base `c4=1/1/1 key_flows=7/8 ownership=0`; fixture `c4=1/1/1 key_flows=8/8 ownership=0`, architecture `22 fences / 11 mermaid`, `repos.md 4 fences` |
| TC-M2DOM-041 | 2026-11-11 | FAIL (base); PASS (fixture) | base `clause_scan: total=26 present=1 missing=25`; fixture `total=26 present=26 missing=0` |
| TC-M2DOM-042 | 2026-11-11 | PASS (control) | `forbidden_exit=0`; `5/5 scope classes scanned, 0 violations`; base `userFacingDocs: 139`, fixture `140 file(s)` |
| TC-M2DOM-043 | 2026-11-11 | PASS (control) | `broken_links=0`; `restated_ac_blocks=0` (base and fixture) |
| TC-M2DOM-044 | 2026-11-11 | PASS | `oracle=whole-file-line-retention`; conforming fixture `removed=0 added=5 outside=0`; delete/modify/swap `removed=1`; outside_insert `outside_hunks=1`; real base/fixture `removed_or_modified=0` |
| TC-M2DOM-045 | 2026-11-11 | FAIL (base); PASS (fixture) | base `matrix_rows_required=1/17`; fixture `17/17 regions_empty=0 positive_fixture=OK negative_fixture=detected` |

Aggregate verdict: **38 of 45 procedures FAIL on the base tree** — every one because the change is absent, because a statement the change must remove survives, or because a new-content region is empty — and **7 PASS as labelled controls/policy-conforming** (TC-029, TC-035, TC-038, TC-039, TC-042, TC-043, TC-044). **On the conforming fixture, 45 of 45 procedures PASS** (P39 by its classifier, whose five synthetic branches include the failure dispositions). No procedure passes by accident: every scan, classifier, and retention oracle carries at least one fixture proving it detects the defect it targets, and every changed procedure was run on a conforming head before publication.

Re-run instruction for delivery: run P00 → P34 (base..worktree containment) → P37/P38/P42 (guards) → P39 (both gate invocations, `RUN_GATES=1`) → P08/P10 (placement) → P01–P07, P09 → P11–P33 → P35, P40, P41, P43–P45 → the manual reads (G-1, G-2, G-3, G-4, G-5, G-9). Cheap containment and guards first: an out-of-manifest change or a red authoritative gate makes every downstream content reading moot.
