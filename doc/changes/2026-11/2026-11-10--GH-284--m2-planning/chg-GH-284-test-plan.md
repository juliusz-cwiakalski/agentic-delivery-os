---
id: chg-GH-284-test-plan
status: Proposed
version: 1.9
created: 2026-11-10T19:30:00Z
last_updated: 2026-11-10T08:05:00Z
owners: [engineering]
service: delivery-os-planning
labels: [change, docs]
version_impact: none
summary: "Docs-only verification of the M2 planning surface against spec v1.7: seven new backlog stories (S11-S17) with clause-level fidelity, two dependency amendments, fourteen status-header reconciliations plus one bounded two-sentence DESCRIPTION region on the entrypoint page, one dated M2 status snapshot with four pointer insertions under a whole-file line-retention oracle with base-anchored windows, and an Epic M2 insertion pinned inside the block before its `---` separator, the twelve-document milestones/m2 pack, and the milestone index row. 37 acceptance criteria are bound one-to-one to 37 test cases backed by 37 procedures (P01-P37) plus a P00 setup block; delivery containment expects 31 product files (30 planning + one forbidden-literals registry) and phase 7 adds the three reconciled current-truth docs, 34 total; clause fidelity runs a 79-row table built from the ticket's actual clause set, each run against base fab46636 before the change so the expected failures are falsifiable; header checks cover the proposal tail and preserved delivered clauses, the index row has twelve targets, the pack states its contents-table deviation, both aggregate-gate runs are recorded, and diagram headings are associated with their blocks. No product code, no test suite, and no tracker write."
links:
  change_spec: ./chg-GH-284-spec.md
  implementation_plan: ./chg-GH-284-plan.yaml
  testing_strategy: ../../../../.ai/rules/testing-strategy.md
---

# Test Plan - Plan M2: engine-first operations, multi-repo workstations, evidence inspection, and telemetry

## 1. Scope and Objectives

This change writes planning truth, so the risk is documentary and the oracle must be the diff: a story can lose a clause while looking complete, a header can be "reconciled" while the delivered engine prose is rewritten, a status snapshot can erase or reorder history, and a pack can exist without the contracts and scenarios a delivery agent needs. Every acceptance criterion is therefore bound to one runnable procedure with a stated expected result, and every preservation claim is a byte comparison or a whole-file line-retention comparison against `fab46636` rather than a reading impression. The plan was executed against the pre-change tree: the new-content procedures fail because the change is absent, while the preservation procedures pass as controls and carry mutation self-tests so a green control is not mistaken for evidence that the work is done.

### 1.1 In Scope

- `doc/planning/oss-tooling/backlog.md`: seven new M2 stories (S11-S17) inserted at the end of the Epic M2 block, after M2-S9's last content line and before the blank + `---` separator pair, the M2-S4 dependency amendment, the M2-S6 task-plus-dependency amendment, and byte-level preservation of every other entry including the separator and `## Epic M3` heading.
- `doc/planning/oss-tooling/milestones/m1/commands/`: status-header-only edits on the fourteen pages in spec Appendix B (proposal-tail scope plus preserved watchdog/extension clauses), plus one bounded DESCRIPTION region of at most two adjacent sentences on `entrypoint.md` (DEC-16).
- `doc/planning/oss-tooling/status.md`: one new dated `2026-11-10` section, four pointer insertions of at most three lines each, and whole-file line retention (no base line removed, reordered, or modified).
- `doc/planning/oss-tooling/milestones/m2/`: the twelve-document pack (README, architecture, contracts, test-scenarios, journeys, entrypoint delta, six command pages), with the README stating the deliberate no-man-page/no-interactions deviation while the contents table stays byte-identical.
- `doc/planning/oss-tooling/milestones/README.md`: one planned M2 index row with twelve linked targets and the M0/M1 rows untouched.
- Repository guards: `bash scripts/.tests/test-doc-distribution.sh`, `pnpm check`, the Appendix E structural diagram procedure, link resolution, and the forbidden-literals check. The twelve new pack documents are registered in `scripts/checks/forbidden-literals.registry.json` (the one permitted `scripts/` change), because the guard's `userFacingDocs` scope covers `doc/planning/**` and fails closed on unregistered docs (DEC-21). Phase 7 (`system_spec_update`) reconciles three current-truth docs — `doc/spec/features/feature-resident-daemon.md`, `doc/spec/features/feature-cli-entrypoint.md`, and `doc/overview/architecture-overview.md` — under a separate three-file budget (DEC-22).

### 1.2 Out of Scope & Known Gaps

- **G-1 — clause presence is mechanical; clause meaning is not.** AC-F1-2, AC-F2-2, and AC-NFR8-1 require no clause weakened, moved, merged, or changed in meaning. P02 runs a 61-row table for S11-S16 and P35 runs the full 79-row table (S11-S17 plus both amendments), each row an anchor derived from the ticket's actual clause set; a missing anchor fails with its clause id and short clause. The declared gap is only the semantic residue: an anchor proves the clause text exists, not that its normative force is unchanged. **Compensation:** the reviewer performs a paraphrase read of the seven entries and two amendments against GH-284 using the 79-row table as the checklist. Owner: `@reviewer` at phase 8.
- **G-2 — the default aggregate run is environment-sensitive; the repo-local run is normative.** `tests/checks/ci-baseline-parity.test.ts` runs `git clone --local`, which fails with a cross-device hardlink error when `tmpdir()` is on tmpfs (`/tmp` in this checkout). DEC-19 makes `mkdir -p "$REPO_ROOT/tmp/tmpdir" && TMPDIR="$REPO_ROOT/tmp/tmpdir" pnpm check` authoritative. P32 records both runs and classifies a default failure as environmental **only** when the sole failing test is `CI baseline parity (hermetic partial clone)`; any other default failure or any repo-local failure is a delivery failure. A missing pack registration fails the repo-local run before delivery; after the one-file registration it is expected to exit 0. Owner: `@runner` at phase 9.
- **G-3 — mermaid syntax validity is not testable here.** The repository has no mermaid validator (spec DEC-15). P33 adopts Appendix E v1.5: fence count, keyword first line, balanced fences, no block before a heading, exactly one diagram per C4 heading (`## C4 Level 1` style matched with `([^0-9]|$)`, committed form `## C4 Level 1: system context` (level digit + `: ` + subject)), and exactly one per `###` heading under `## Key flows` (six flows plus park/resume). Compliant subject-form and bare-heading fixtures pass `3/3,7/7,OK`; a level-1-without-diagram fixture reports `MISSING`. A syntax error that still satisfies those conditions would not be caught. **Compensation:** reviewer opens the rendered GitHub preview for the architecture document. Owner: `@reviewer`.
- **G-4 — private-name hygiene is partly judgment.** The forbidden-literals guard covers configured literals and now also fails closed on any `doc/planning/**` document absent from its `registered` list; P36 asserts the twelve pack registrations (sorted among themselves, duplicate-free, absent at baseline). The guard and seed scan still cannot enumerate every hosted, fleet, or proprietary name. **Compensation:** reviewer reads the added lines against spec NFR-9 and §7.2. Owner: `@reviewer`.
- **G-5 — "restated acceptance criteria" has a semantic residue.** P37 catches `- AC:` blocks and `**Given**` blocks; a paraphrase in prose is not machine-detectable. **Compensation:** reviewer reads the pack for any restated criterion and checks that it references story codes instead. Owner: `@reviewer`.
- **G-6 — header, proposal-tail, pointer, and entrypoint-region wording quality is approximated.** The checks ban `M1 planned`/`M1 milestone planned`, require delivered story codes plus GH references, ban a proposal tail without a named planned remainder, require the watchdog progress-signal and `SC-M1-14` clauses, the verify-gates/closeout extension attributions, and no `Current` claim on any reconciled header, require four pointers of at most three lines naming `2026-11-10`, and require the enumeration and not-registered statements to stay separate sentences; an ambiguously worded header or pointer can still pass the tokens. **Compensation:** the reviewer reads the fifteen edited headers, the four pointer insertions, and the corrected DESCRIPTION region once; F-5, F-6, F-7, and DEC-18 are the standards. Owner: `@reviewer`.
- **G-7 — `pnpm check` proves no-regression, not document correctness.** It can stay green while a story loses a clause. It is a containment gate only; the content procedures carry the requirements.
- **G-8 — passing preservation controls are not evidence of delivery.** P09, P10, P18, P29, P31, and P34 pass their retention or byte halves on the pre-change tree, and P36's guard half passes because nothing has changed yet. They become evidence only together with the non-vacuity guards and the diff-based procedures; the execution log labels them `PASS (control)`. The whole-file retention oracle replaces the earlier whole-section comparison, which could not coexist with the appended pointers this change requires: zero removals is necessary but not sufficient until additions appear inside the base-anchored four-window whitelist, so pointer-content judgment moves to G-6 rather than to a byte oracle.
- **G-9 — pack content quality is review, not a command.** The procedures prove the pack has the required headings, surfaces, scenario counts, and command sections; they do not prove the architecture is sound, the contracts are internally consistent, or a scenario is the right scenario. **Compensation:** the reviewer reads `architecture.md`, `contracts.md`, `test-scenarios.md`, and `journeys.md` against the ticket's blueprint brief and records the verdict; the story-to-artifact map in the README is the index for that read. Owner: `@reviewer`.
- **Not applicable:** unit, integration, contract-execution, E2E, performance, migration, telemetry, and security-surface testing. There is no runtime code path, schema, or emitted artifact. Per `.ai/rules/testing-strategy.md`, a docs-only change uses static/diff and content checks plus the repository guards, and adds no committed test code; NFR-1 forbids touching `tests/**` and `scripts/**` anyway.

## 2. References

| Reference | Role in this plan |
|---|---|
| [`chg-GH-284-spec.md`](./chg-GH-284-spec.md) v1.7 | Binding source: F-1..F-11, AC-F1-1..AC-NFR10-1 (37 ACs), NFR-1..NFR-10, DM-1..DM-4, DEC-1..DEC-22, RSK-1..RSK-10, Appendix B (page set), Appendix C (observed entrypoint), Appendix D (pack manifest), Appendix E (structural diagram procedure) |
| [`chg-GH-284-pm-notes.yaml`](./chg-GH-284-pm-notes.yaml) | Binding decisions: S17 scope, daemon resolution, 14+1 reconciliation shape, history handling, no distribution marker, index registration, and the v1.1 reopen that replaced the non-existent mermaid validator |
| GH-284 ticket (`juliusz-cwiakalski/agentic-delivery-os#284`) | Normative story text for the 79-row clause table (P02, P06, P35) and the S17 acceptance list; read at authoring time |
| [`.ai/rules/testing-strategy.md`](../../../../.ai/rules/testing-strategy.md) | Docs-only fallback: static/diff plus content checks; branch-diff checks belong to review, never to the permanent suite |
| [`backlog.md`](../../../planning/oss-tooling/backlog.md) | File under test (Epic M2 stories and preservation regions) |
| [`status.md`](../../../planning/oss-tooling/status.md) | File under test (snapshot, pointers, history) |
| [`milestones/README.md`](../../../planning/oss-tooling/milestones/README.md) | File under test (index row) and source of pack conventions |
| [`milestones/m1/commands/entrypoint.md`](../../../planning/oss-tooling/milestones/m1/commands/entrypoint.md) | File under test (composition sentence) and the page that points at the delta note |
| [`scripts/.tests/test-doc-distribution.sh`](../../../../scripts/.tests/test-doc-distribution.sh) | Distribution-marker guard (AC-NFR4-1) |
| [`scripts/checks/forbidden-literals.ts`](../../../../scripts/checks/forbidden-literals.ts) | Forbidden-literal guard (AC-NFR9-1) |
| `packages/*/dist` in this checkout | Built workspace, so `pnpm exec delivery-os --help` reflects the production composition used by P15 |
| [AGENTS.md](../../../../AGENTS.md) | Marker scope, branch model (`main-tools`), and docs-only delivery rules |

## 3. Coverage Overview

### 3.1 Functional Coverage (F-#, AC-#)

Forward traceability: every AC appears exactly once, and every TC maps to exactly one AC.

| AC ID | Requirement (condensed) | TC ID | Status |
|---|---|---|---|
| AC-F1-1 | Seven M2 stories land in order, separated from M2-S9 by a blank line | TC-M2PLAN-001 | Covered |
| AC-F1-2 | Clause table for S11-S16 is built from the ticket and every clause is present | TC-M2PLAN-002 | Covered |
| AC-F1-3 | Append-only placement inside the Epic M2 block, before the `---` separator, with hunk containment | TC-M2PLAN-003 | Covered |
| AC-F2-1 | S17 entry carries goal, six task clauses, seven content-checked ACs, and the full dependency set | TC-M2PLAN-004 | Covered |
| AC-F2-2 | S17 six task clauses are present and none is softened | TC-M2PLAN-005 | Covered |
| AC-F2-3 | S17 seven criteria are independently identifiable and their content is anchored | TC-M2PLAN-006 | Covered |
| AC-F3-1 | M2-S4 changes only its `- Depends on:` line | TC-M2PLAN-007 | Covered |
| AC-F3-2 | M2-S6 gains the telemetry task and dependency, nothing else | TC-M2PLAN-008 | Covered |
| AC-F4-1 | Existing headings, story codes, order, and the Epic M2 retirement note survive | TC-M2PLAN-009 | Covered |
| AC-F4-2 | Frontmatter, reading guide, and cross-cutting principles are byte-identical | TC-M2PLAN-010 | Covered |
| AC-F5-1 | No delivered command is still called planned; tails are scoped; delivered clauses survive; no header says Current | TC-M2PLAN-011 | Covered |
| AC-F5-2 | board, watchdog, and mcp name their owning future story | TC-M2PLAN-012 | Covered |
| AC-F5-3 | daemon header corrects reachability while the delivered engine body survives | TC-M2PLAN-013 | Covered |
| AC-F5-4 | Every reconciled page changes only in its status header; entrypoint changes one bounded region | TC-M2PLAN-014 | Covered |
| AC-F6-1 | Two adjacent DESCRIPTION sentences reconcile the composition and the absent set | TC-M2PLAN-015 | Covered |
| AC-F7-1 | The new dated status section states M1 delivery, the M2 planning state, and the early inputs | TC-M2PLAN-016 | Covered |
| AC-F7-2 | The four superseded statement groups each carry one appended pointer of at most three lines | TC-M2PLAN-017 | Covered |
| AC-F7-3 | Every base status line is retained and every added line is inside the new section or a pointer insertion | TC-M2PLAN-018 | Covered |
| AC-F8-1 | The M2 pack has the twelve documents, states the contents-table deviation, and leaves the table byte-identical | TC-M2PLAN-019 | Covered |
| AC-F8-2 | Architecture carries C4 L1/L2/L3, the six flows plus park/resume, and the deltas | TC-M2PLAN-020 | Covered |
| AC-F8-3 | Contracts cover every named M2 surface including the S17 additions | TC-M2PLAN-021 | Covered |
| AC-F8-4 | At least two SC-M2 scenarios exist for every story S2-S17, with the twelve mandatory scenarios | TC-M2PLAN-022 | Covered |
| AC-F8-5 | Journeys include the four operator journeys and the S17 cost-control journey | TC-M2PLAN-023 | Covered |
| AC-F9-1 | Six command pages carry the pack header, a bare name, and no working name | TC-M2PLAN-024 | Covered |
| AC-F9-2 | Each command page carries the required body sections and the family relationships | TC-M2PLAN-025 | Covered |
| AC-F10-1 | The entrypoint delta note records the observed composition, planned additions, and the daemon gap | TC-M2PLAN-026 | Covered |
| AC-F11-1 | The milestone index gains one planned M2 row with twelve linked targets and leaves the M0/M1 rows untouched | TC-M2PLAN-027 | Covered |
| AC-NFR1-1 | Delivery budget 31 files and phase-7 budget 3 files (34 total) | TC-M2PLAN-028 | Covered |
| AC-NFR2-1 | Every non-amended story body is byte-identical on the base, minimal, and full heads | TC-M2PLAN-029 | Covered |
| AC-NFR3-1 | Reconciled page bodies stay byte-identical and the entrypoint change is one bounded region | TC-M2PLAN-030 | Covered |
| AC-NFR4-1 | The doc-distribution guard stays green and no planning marker is added | TC-M2PLAN-031 | Covered |
| AC-NFR5-1 | Both aggregate-gate runs are recorded and only a lone ci-baseline-parity failure is environmental | TC-M2PLAN-032 | Covered |
| AC-NFR6-1 | The M2 diagrams satisfy the five structural conditions and each expected heading owns a diagram | TC-M2PLAN-033 | Covered |
| AC-NFR7-1 | The status retention oracle passes and all four pointer insertions are present | TC-M2PLAN-034 | Covered |
| AC-NFR8-1 | All 79 ticket clauses are present across the seven stories and both amendments | TC-M2PLAN-035 | Covered |
| AC-NFR9-1 | The forbidden-literals guard is clean and the twelve M2 documents are registered | TC-M2PLAN-036 | Covered |
| AC-NFR10-1 | No relative link is broken and no pack document restates an acceptance-criteria block | TC-M2PLAN-037 | Covered |

Coverage note: AC-F5-4, AC-F6-1, and AC-NFR3-1 deliberately share the entrypoint page but own distinct predicates — page hunk containment (P14), family-set/absent-set content plus the two-sentence bound (P15), and body-byte/bounded-region measurement (P30); the overlap is noted rather than counted as three independent surfaces.

Reverse traceability (no orphan test cases):

| TC ID | AC ID |
|---|---|
| TC-M2PLAN-001 | AC-F1-1 |
| TC-M2PLAN-002 | AC-F1-2 |
| TC-M2PLAN-003 | AC-F1-3 |
| TC-M2PLAN-004 | AC-F2-1 |
| TC-M2PLAN-005 | AC-F2-2 |
| TC-M2PLAN-006 | AC-F2-3 |
| TC-M2PLAN-007 | AC-F3-1 |
| TC-M2PLAN-008 | AC-F3-2 |
| TC-M2PLAN-009 | AC-F4-1 |
| TC-M2PLAN-010 | AC-F4-2 |
| TC-M2PLAN-011 | AC-F5-1 |
| TC-M2PLAN-012 | AC-F5-2 |
| TC-M2PLAN-013 | AC-F5-3 |
| TC-M2PLAN-014 | AC-F5-4 |
| TC-M2PLAN-015 | AC-F6-1 |
| TC-M2PLAN-016 | AC-F7-1 |
| TC-M2PLAN-017 | AC-F7-2 |
| TC-M2PLAN-018 | AC-F7-3 |
| TC-M2PLAN-019 | AC-F8-1 |
| TC-M2PLAN-020 | AC-F8-2 |
| TC-M2PLAN-021 | AC-F8-3 |
| TC-M2PLAN-022 | AC-F8-4 |
| TC-M2PLAN-023 | AC-F8-5 |
| TC-M2PLAN-024 | AC-F9-1 |
| TC-M2PLAN-025 | AC-F9-2 |
| TC-M2PLAN-026 | AC-F10-1 |
| TC-M2PLAN-027 | AC-F11-1 |
| TC-M2PLAN-028 | AC-NFR1-1 |
| TC-M2PLAN-029 | AC-NFR2-1 |
| TC-M2PLAN-030 | AC-NFR3-1 |
| TC-M2PLAN-031 | AC-NFR4-1 |
| TC-M2PLAN-032 | AC-NFR5-1 |
| TC-M2PLAN-033 | AC-NFR6-1 |
| TC-M2PLAN-034 | AC-NFR7-1 |
| TC-M2PLAN-035 | AC-NFR8-1 |
| TC-M2PLAN-036 | AC-NFR9-1 |
| TC-M2PLAN-037 | AC-NFR10-1 |

### 3.2 Interface Coverage (API-#, EVT-#, DM-#)

The spec declares no API or event surface (spec §8.1, §8.2). The four data-model elements are documentation shapes verified through the ACs that consume them:

| ID | Element | TC ID(s) | Notes |
|---|---|---|---|
| DM-1 | Backlog story entry (heading, Goal, Tasks, AC, Depends on) | TC-M2PLAN-001..008, TC-M2PLAN-029, TC-M2PLAN-035 | Shape in P01/P04; preservation in P29; fidelity in P35 |
| DM-2 | Command-page status header | TC-M2PLAN-011..014, TC-M2PLAN-030 | Phrase ban, attribution, remainder pointer, header-only containment |
| DM-3 | Milestone pack manifest (file set plus index row) | TC-M2PLAN-019, TC-M2PLAN-027 | Exact 12-file set and the M2 index row |
| DM-4 | Dated status snapshot section | TC-M2PLAN-016..018, TC-M2PLAN-034 | Content, four pointer insertions, and whole-file line retention |

API-# / EVT-#: none exist in the spec; nothing to cover.

### 3.3 Non-Functional Coverage (NFR-#)

| NFR ID | Requirement | TC ID | Status |
|---|---|---|---|
| NFR-1 | Docs-only containment | TC-M2PLAN-028 | Covered (31 delivery + 3 phase-7 = 34; DEC-21/DEC-22) |
| NFR-2 | Backlog preservation | TC-M2PLAN-003, TC-M2PLAN-007, TC-M2PLAN-008, TC-M2PLAN-009, TC-M2PLAN-010, TC-M2PLAN-029 | Covered (byte comparisons plus hunk confinement) |
| NFR-3 | Command-page containment | TC-M2PLAN-013, TC-M2PLAN-014, TC-M2PLAN-030 | Covered (hunk ranges, body bytes, bounded DESCRIPTION region) |
| NFR-4 | Doc-distribution guard | TC-M2PLAN-031 | Covered (guard execution) |
| NFR-5 | Aggregate gate | TC-M2PLAN-032 | Covered (both runs recorded; lone default parity failure classified, DEC-19) |
| NFR-6 | Diagram structure | TC-M2PLAN-033 | Covered (structure plus heading association; syntax gap G-3) |
| NFR-7 | Status history retention | TC-M2PLAN-017, TC-M2PLAN-018, TC-M2PLAN-034 | Covered (line retention, pointer whitelist, four pointer insertions) |
| NFR-8 | Story fidelity | TC-M2PLAN-002, TC-M2PLAN-005, TC-M2PLAN-035 | Covered by the 61/79-clause tables; meaning residue G-1 |
| NFR-9 | Public/OSS hygiene | TC-M2PLAN-036 | Covered (guard + twelve-path registration + read); residue G-4 |
| NFR-10 | Link integrity and non-duplication | TC-M2PLAN-037 | Covered by resolution plus pattern check; residue G-5 |

## 4. Test Types and Layers

Per `.ai/rules/testing-strategy.md`, a `doc/**` change is covered by **static/diff checks** and **content checks**, plus the repository doc guards. There is no applicable unit, integration, E2E, performance, or migration layer.

| Layer | What is executed | Where |
|---|---|---|
| Static/diff inspection | `git diff --name-only`, `git diff -U0`, `cmp`, `git show "$BASE:$BL"`, `awk` region extraction | Local worktree at branch HEAD vs `fab46636` |
| Content inspection | Heading/region predicates, anchor matrices, numbered-AC counts, index rows | Same |
| Guard execution | `bash scripts/.tests/test-doc-distribution.sh`, `pnpm check`, `bun run scripts/checks/forbidden-literals.ts` | Repository root |
| Structural diagram check | Fence inventory and heading inventory from spec Appendix E | `milestones/m2/**` |
| Manual review | Clause meaning (G-1), private names (G-4), restated criteria (G-5), header wording (G-6), mermaid rendering (G-3) | Reviewer |

**No test code, suite, or harness is added, and that is correct here.** The change has no runtime behaviour; every assertion is a property of the diff against a moving base, which the testing strategy assigns to review and PR-time gates rather than the permanent suite. NFR-1 forbids touching `tests/**`, `scripts/**`, and `.ai/**`, so committing a helper script would violate the change's own containment criterion.

Each procedure below was run against the pre-change tree. The new-content procedures fail because the change is absent; the preservation procedures pass as controls and carry self-tests or non-vacuity guards. Section 10 records the observed result per TC.

## 5. Test Scenarios

### 5.1 Scenario Index

| TC ID | Title | Scenario Type | Impact | Priority | AC | Layer |
|---|---|---|---|---|---|---|
| TC-M2PLAN-001 | Seven M2 stories land in order, separated from M2-S9 by a blank line | Happy Path | Critical | High | AC-F1-1 | Static/diff + content |
| TC-M2PLAN-002 | Clause table for S11-S16 is built from the ticket and every clause is present | Happy Path | Critical | High | AC-F1-2 | Static/diff + content |
| TC-M2PLAN-003 | Append-only placement inside the Epic M2 block, before the `---` separator, with hunk containment | Regression | Critical | High | AC-F1-3 | Static/diff + content |
| TC-M2PLAN-004 | S17 entry carries goal, six task clauses, seven content-checked ACs, and the full dependency set | Happy Path | Critical | High | AC-F2-1 | Static/diff + content |
| TC-M2PLAN-005 | S17 six task clauses are present and none is softened | Happy Path | Critical | High | AC-F2-2 | Static/diff + content |
| TC-M2PLAN-006 | S17 seven criteria are independently identifiable and their content is anchored | Happy Path | Important | High | AC-F2-3 | Static/diff + content |
| TC-M2PLAN-007 | M2-S4 changes only its `- Depends on:` line | Regression | Critical | High | AC-F3-1 | Static/diff + content |
| TC-M2PLAN-008 | M2-S6 gains the telemetry task and dependency, nothing else | Regression | Critical | High | AC-F3-2 | Static/diff + content |
| TC-M2PLAN-009 | Existing headings, story codes, order, and the Epic M2 retirement note survive | Regression | Critical | High | AC-F4-1 | Static/diff + content |
| TC-M2PLAN-010 | Frontmatter, reading guide, and cross-cutting principles are byte-identical | Regression | Critical | High | AC-F4-2 | Static/diff + content |
| TC-M2PLAN-011 | No delivered command is still called planned; tails are scoped; delivered clauses survive; no header says Current | Negative | Critical | High | AC-F5-1 | Static/diff + content |
| TC-M2PLAN-012 | board, watchdog, and mcp name their owning future story | Happy Path | Important | High | AC-F5-2 | Static/diff + content |
| TC-M2PLAN-013 | daemon header corrects reachability while the delivered engine body survives | Corner Case | Critical | High | AC-F5-3 | Static/diff + content |
| TC-M2PLAN-014 | Every reconciled page changes only in its status header; entrypoint changes one bounded region | Negative | Critical | High | AC-F5-4 | Static/diff + content |
| TC-M2PLAN-015 | Two adjacent DESCRIPTION sentences reconcile the composition and the absent set | Happy Path | Critical | High | AC-F6-1 | Static/diff + content |
| TC-M2PLAN-016 | The new dated status section states M1 delivery, the M2 planning state, and the early inputs | Happy Path | Critical | High | AC-F7-1 | Static/diff + content |
| TC-M2PLAN-017 | The four superseded statement groups each carry one appended pointer of at most three lines | Happy Path | Important | High | AC-F7-2 | Static/diff + content |
| TC-M2PLAN-018 | Every base status line is retained and every added line is inside the new section or a pointer insertion | Regression | Critical | High | AC-F7-3 | Static/diff + content |
| TC-M2PLAN-019 | The M2 pack has the twelve documents, states the contents-table deviation, and leaves the table byte-identical | Happy Path | Critical | High | AC-F8-1 | Static/diff + content |
| TC-M2PLAN-020 | Architecture carries C4 L1/L2/L3, the six flows plus park/resume, and the deltas | Happy Path | Critical | High | AC-F8-2 | Static/diff + content |
| TC-M2PLAN-021 | Contracts cover every named M2 surface including the S17 additions | Happy Path | Critical | High | AC-F8-3 | Static/diff + content |
| TC-M2PLAN-022 | At least two SC-M2 scenarios exist for every story S2-S17, with the twelve mandatory scenarios | Happy Path | Critical | High | AC-F8-4 | Static/diff + content |
| TC-M2PLAN-023 | Journeys include the four operator journeys and the S17 cost-control journey | Happy Path | Important | High | AC-F8-5 | Static/diff + content |
| TC-M2PLAN-024 | Six command pages carry the pack header, a bare name, and no working name | Happy Path | Critical | High | AC-F9-1 | Static/diff + content |
| TC-M2PLAN-025 | Each command page carries the required body sections and the family relationships | Happy Path | Critical | High | AC-F9-2 | Static/diff + content |
| TC-M2PLAN-026 | The entrypoint delta note records the observed composition, planned additions, and the daemon gap | Happy Path | Critical | High | AC-F10-1 | Static/diff + content |
| TC-M2PLAN-027 | The milestone index gains one planned M2 row with twelve linked targets and leaves the M0/M1 rows untouched | Happy Path | Important | High | AC-F11-1 | Static/diff + content |
| TC-M2PLAN-028 | Delivery budget 31 files and phase-7 budget 3 files (34 total) | Negative | Critical | High | AC-NFR1-1 | Static/diff + content |
| TC-M2PLAN-029 | Every non-amended story body is byte-identical on the base, minimal, and full heads | Regression | Critical | High | AC-NFR2-1 | Static/diff + content |
| TC-M2PLAN-030 | Reconciled page bodies stay byte-identical and the entrypoint change is one bounded region | Negative | Critical | High | AC-NFR3-1 | Static/diff + content |
| TC-M2PLAN-031 | The doc-distribution guard stays green and no planning marker is added | Regression | Important | Medium | AC-NFR4-1 | Guard |
| TC-M2PLAN-032 | Both aggregate-gate runs are recorded and only a lone ci-baseline-parity failure is environmental | Regression | Critical | High | AC-NFR5-1 | Guard |
| TC-M2PLAN-033 | The M2 diagrams satisfy the five structural conditions and each expected heading owns a diagram | Corner Case | Critical | High | AC-NFR6-1 | Structural |
| TC-M2PLAN-034 | The status retention oracle passes and all four pointer insertions are present | Regression | Critical | High | AC-NFR7-1 | Static/diff + content |
| TC-M2PLAN-035 | All 79 ticket clauses are present across the seven stories and both amendments | Corner Case | Critical | High | AC-NFR8-1 | Static/diff + content |
| TC-M2PLAN-036 | The forbidden-literals guard is clean and the twelve M2 documents are registered | Negative | Important | Medium | AC-NFR9-1 | Static/diff + content |
| TC-M2PLAN-037 | No relative link is broken and no pack document restates an acceptance-criteria block | Corner Case | Important | Medium | AC-NFR10-1 | Static/diff + content |

### 5.2 Scenario Details

#### TC-M2PLAN-001 - Seven M2 stories land in order, separated from M2-S9 by a blank line

**Scenario Type**: Happy Path
**Impact Level**: Critical
**Priority**: High
**Related IDs**: AC-F1-1, F-1, DM-1
**Test Type(s)**: Manual (static/diff and content inspection)
**Automation Level**: Semi-automated (uncommitted procedure)
**Target Layer / Location**: `doc/planning/oss-tooling/backlog.md`, Epic M2 block
**Tags**: @docs, @backlog

**Preconditions**:

- Worktree at `docs/GH-284/m2-planning`; `git` available; base commit `fab46636cc0b5abfbd22257711f594adc0af4660` fetched.
- Section 7.1 P00 has been run once in the same shell (base snapshots and helpers).

**Steps**:

1. Run procedure **P01** (Section 7.1).
2. Run **P03** for the block geometry: `blank_separation` must show a blank line after M2-S9 and then `### M2-S11`, and `separator_sequence=identical`.

**Expected Outcome**:

- `m2_story_headings=7 new_found=7/7 order=OK`; `shape_ok=7/7`; `blank_separation=OK`; `separator_sequence=identical`; exit 0.
- Each new entry carries `- Goal:`, `- Tasks:`, `- AC:`, `- Depends on:` and no `- Ticket:` line; S17 is the seventh and the block still closes with the `---` separator before `## Epic M3`.

**Notes / Clarifications**:

- Observed on the pre-change tree (2026-11-10, base `fab46636`, before any deliverable edit): `m2_story_headings=0 new_found=0/7 order=FAIL`; `shape_ok=0/7`; `blank_separation=FAIL (want blank then ### M2-S11; got [] then [---])`; `separator_sequence=identical`. The seven entries do not exist in the base tree.
- Result label for Section 10: **FAIL (change absent)**.

#### TC-M2PLAN-002 - Clause table for S11-S16 is built from the ticket and every clause is present

**Scenario Type**: Happy Path
**Impact Level**: Critical
**Priority**: High
**Related IDs**: AC-F1-2, F-1, NFR-8
**Test Type(s)**: Manual (static/diff and content inspection)
**Automation Level**: Semi-automated (uncommitted procedure)
**Target Layer / Location**: `backlog.md`, the six new entries vs the GH-284 clause table
**Tags**: @docs, @backlog, @fidelity

**Preconditions**:

- Worktree at `docs/GH-284/m2-planning`; `git` available; base commit `fab46636cc0b5abfbd22257711f594adc0af4660` fetched.
- Section 7.1 P00 has been run once in the same shell (base snapshots and helpers).

**Steps**:

1. Run procedure **P02** (Section 7.1). The table is the ticket's actual clause set (Goal, tasks, acceptance criteria, and dependencies), not the expected delivery text; a missing anchor prints its clause id and short clause.
2. Read each reported clause once against its GH-284 section; presence is mechanical, paraphrase judgment is the declared gap G-1.

**Expected Outcome**:

- `M2-S11 clauses=9/9`, `M2-S12 clauses=8/8`, `M2-S13 clauses=11/11`, `M2-S14 clauses=12/12`, `M2-S15 clauses=10/10`, `M2-S16 clauses=11/11`; `clause_scan: total=61 present=61 missing=0`; no `MISSING` lines; exit 0.

**Notes / Clarifications**:

- Observed on the pre-change tree (2026-11-10, base `fab46636`, before any deliverable edit): `M2-S11 clauses=0/9`, `M2-S12 clauses=0/8`, `M2-S13 clauses=0/11`, `M2-S14 clauses=0/12`, `M2-S15 clauses=0/10`, `M2-S16 clauses=0/11`; `clause_scan: total=61 present=0 missing=61`; 61 named `MISSING` lines, including `S11-AC1: disjoint phase state and queue entries` and `S12-AC2: resolved with a note and unresolved counts`. The oracle bites.
- Result label for Section 10: **FAIL (change absent; 61 clauses missing)**.

#### TC-M2PLAN-003 - Append-only placement inside the Epic M2 block, before the `---` separator, with hunk containment

**Scenario Type**: Regression
**Impact Level**: Critical
**Priority**: High
**Related IDs**: AC-F1-3, F-1, F-4, NFR-2
**Test Type(s)**: Manual (static/diff and content inspection)
**Automation Level**: Semi-automated (uncommitted procedure)
**Target Layer / Location**: `backlog.md` diff against `fab46636`
**Tags**: @docs, @diff, @containment

**Preconditions**:

- Worktree at `docs/GH-284/m2-planning`; `git` available; base commit `fab46636cc0b5abfbd22257711f594adc0af4660` fetched.
- Section 7.1 P00 has been run once in the same shell (base snapshots and helpers).

**Steps**:

1. Run procedure **P03** (Section 7.1). Two anchors serve different purposes: the **hunk window** is base-anchored (start = base M2-S9 last content + 1 = 1167; end = head `---` before `## Epic M3` − 1), while **blank separation is head-anchored** (locate `### M2-S9` in the head, walk to its last non-blank line before the next heading/separator, then require blank + `### M2-S11`).
2. Confirm `window_empty=no`, `separator_sequence=identical`, `blank_separation=OK`, `backlog_hunks>=1`, `non_vacuous=yes`, and `hunks: inside=N outside=0`; the classifier self-tests must print `4/4`.

**Expected Outcome**:

- `insertion window: start=base M2-S9 last content+1=1167 end=head separator-1=N window=1167:N` with `window_empty=no`; `separator_sequence=identical`; `blank_separation=OK (head M2-S9 last non-blank; next line blank; the line after that is ### M2-S11)`; `fixture_blank_separation=OK`; `backlog_hunks=N` with `N>=1`; every hunk inside one of the seven inserted entries or the two amended entries; `hunks: inside=N outside=0`; `hunk confinement OK`; `classifier_self_tests=4/4`; `insertion_below_separator=never`; exit 0.

**Notes / Clarifications**:

- Observed on the pre-change tree (2026-11-10, base `fab46636`, before any deliverable edit): `insertion window: start=base M2-S9 last content+1=1167 end=head separator-1=1167 window=1167:1167`; `window_empty=no`; `separator_sequence=identical`; `blank_separation=FAIL (head M2-S9 last non-blank=1166; got [] then [---])`; the conforming fixture prints `blank_separation=OK (head M2-S9 last non-blank=1167, blank=1168, M2-S11=1169)` and `fixture_blank_separation=OK`; `backlog_hunks=0`; `FAIL: no backlog hunk (change absent)`; `non_vacuous=no`; `classifier_self_tests=4/4`; `insertion_below_separator=never (negative fixture at separator+2 outside)`. The blank check now reads the head, so the M2-S6 amendment shift cannot break it.
- Result label for Section 10: **FAIL (vacuous: no hunk)**.

#### TC-M2PLAN-004 - S17 entry carries goal, six task clauses, seven content-checked ACs, and the full dependency set

**Scenario Type**: Happy Path
**Impact Level**: Critical
**Priority**: High
**Related IDs**: AC-F2-1, F-2, DM-1
**Test Type(s)**: Manual (static/diff and content inspection)
**Automation Level**: Semi-automated (uncommitted procedure)
**Target Layer / Location**: `backlog.md`, `### M2-S17` entry
**Tags**: @docs, @backlog, @s17

**Preconditions**:

- Worktree at `docs/GH-284/m2-planning`; `git` available; base commit `fab46636cc0b5abfbd22257711f594adc0af4660` fetched.
- Section 7.1 P00 has been run once in the same shell (base snapshots and helpers).

**Steps**:

1. Run procedures **P04** and **P06** (Section 7.1). P04 checks the story shape and dependencies; P06 checks each of the seven criteria by content anchor, not by count.
2. Read the dependency line and confirm `(#280)` is present as the owner-hold semantics, not a bare issue reference.

**Expected Outcome**:

- All four labels present; `depends: M1-S15 OK`, `M1-S18 OK`, `M1-S21 OK`, `M1-S22 OK`, `M2-S14 OK`, `#280 OK`; `ac_numbered_items=7/7`; `criteria_present=7/7` (including other-provider isolation, no state lost/duplicated, and auditable ledger events).

**Notes / Clarifications**:

- Observed on the pre-change tree (2026-11-10, base `fab46636`, before any deliverable edit): `S17=absent`; `criteria_present=0/7`. No S17 entry exists in the base tree.
- Result label for Section 10: **FAIL (change absent)**.

#### TC-M2PLAN-005 - S17 six task clauses are present and none is softened

**Scenario Type**: Happy Path
**Impact Level**: Critical
**Priority**: High
**Related IDs**: AC-F2-2, F-2, NFR-8
**Test Type(s)**: Manual (static/diff and content inspection)
**Automation Level**: Semi-automated (uncommitted procedure)
**Target Layer / Location**: `backlog.md`, S17 `- Tasks:` block
**Tags**: @docs, @backlog, @fidelity

**Preconditions**:

- Worktree at `docs/GH-284/m2-planning`; `git` available; base commit `fab46636cc0b5abfbd22257711f594adc0af4660` fetched.
- Section 7.1 P00 has been run once in the same shell (base snapshots and helpers).

**Steps**:

1. Run procedure **P05** (Section 7.1).
2. Read the six clauses once against the ticket and confirm none was moved into another story or reduced to a suggestion (declared gap G-1).

**Expected Outcome**:

- `clauses_present=6/6`; every named clause group `OK`; `softening may=ABSENT`; exit 0.

**Notes / Clarifications**:

- Observed on the pre-change tree (2026-11-10, base `fab46636`, before any deliverable edit): `S17=absent clauses_present=0/6`; `missing=6`.
- Result label for Section 10: **FAIL (change absent)**.

#### TC-M2PLAN-006 - S17 seven criteria are independently identifiable and their content is anchored

**Scenario Type**: Happy Path
**Impact Level**: Important
**Priority**: High
**Related IDs**: AC-F2-3, F-2, NFR-8
**Test Type(s)**: Manual (static/diff and content inspection)
**Automation Level**: Semi-automated (uncommitted procedure)
**Target Layer / Location**: `backlog.md`, S17 `- AC:` block
**Tags**: @docs, @backlog, @s17

**Preconditions**:

- Worktree at `docs/GH-284/m2-planning`; `git` available; base commit `fab46636cc0b5abfbd22257711f594adc0af4660` fetched.
- Section 7.1 P00 has been run once in the same shell (base snapshots and helpers).
- P02 has run in the same shell (it defines `clause_rows`).

**Steps**:

1. Run procedure **P06** (Section 7.1). It checks each of the seven ticket criteria by its content anchor in the `- AC:` block, then the numbered-list shape.
2. Confirm the three previously unanchored criteria are present: other providers keep running; no branch/artifact/queue state lost or duplicated; stop/park/resume auditable in status and brief.

**Expected Outcome**:

- `S17-AC1..S17-AC7 OK`; `criteria_present=7/7`; `ac_numbered_items=7/7`; `extra_criteria=0`; `duplicate_numbers=0`; `duplicate_self_test=detected`; `extra_self_test=detected (8 items, extra=1)`; exit 0.

**Notes / Clarifications**:

- Observed on the pre-change tree (2026-11-10, base `fab46636`, before any deliverable edit): `S17=absent criteria_present=0/7`; `ac_numbered_items=0/7`; `extra_criteria=0`; `duplicate_numbers=0`; `duplicate_self_test=detected`; `extra_self_test=detected (8 items, extra=1)`; all seven `MISSING` lines prove the oracle cannot be satisfied by a bare count.
- Result label for Section 10: **FAIL (change absent)**.

#### TC-M2PLAN-007 - M2-S4 changes only its `- Depends on:` line

**Scenario Type**: Regression
**Impact Level**: Critical
**Priority**: High
**Related IDs**: AC-F3-1, F-3, NFR-2
**Test Type(s)**: Manual (static/diff and content inspection)
**Automation Level**: Semi-automated (uncommitted procedure)
**Target Layer / Location**: `backlog.md`, `### M2-S4 Board` entry
**Tags**: @docs, @diff, @regression

**Preconditions**:

- Worktree at `docs/GH-284/m2-planning`; `git` available; base commit `fab46636cc0b5abfbd22257711f594adc0af4660` fetched.
- Section 7.1 P00 has been run once in the same shell (base snapshots and helpers).

**Steps**:

1. Run procedure **P07** (Section 7.1), which also runs a goal-mutation self-test.
2. Confirm the diff is exactly one `-` line and one `+` line, both the dependency line.

**Expected Outcome**:

- `changed_lines=2 unexpected_lines=0`; `depends=expected`; `M2-S4 shape OK`.
- Self-test: a one-word goal mutation yields `changed_lines=2 unexpected_lines=2`, proving the oracle flags non-dependency drift.

**Notes / Clarifications**:

- Observed on the pre-change tree (2026-11-10, base `fab46636`, before any deliverable edit): `changed_lines=0 unexpected_lines=0`; `depends=NOT expected (- Depends on: M1-S5, M1-S17.)`; `M2-S4 shape FAIL (no amendment)`. Self-test printed `changed_lines=2 unexpected_lines=2`, so the oracle fires.
- Result label for Section 10: **FAIL (no amendment; oracle self-test passes)**.

#### TC-M2PLAN-008 - M2-S6 gains the telemetry task and dependency, nothing else

**Scenario Type**: Regression
**Impact Level**: Critical
**Priority**: High
**Related IDs**: AC-F3-2, F-3, NFR-2
**Test Type(s)**: Manual (static/diff and content inspection)
**Automation Level**: Semi-automated (uncommitted procedure)
**Target Layer / Location**: `backlog.md`, `### M2-S6 Metrics and spend` entry
**Tags**: @docs, @diff, @regression

**Preconditions**:

- Worktree at `docs/GH-284/m2-planning`; `git` available; base commit `fab46636cc0b5abfbd22257711f594adc0af4660` fetched.
- Section 7.1 P00 has been run once in the same shell (base snapshots and helpers).
- P03 has run first (it builds the conforming-head fixture used by the identity proof).

**Steps**:

1. Run procedure **P08** (Section 7.1). It compares the `- AC:` line alone (`grep -m1`), not a 4-line capture that would include the changed dependency line.
2. Confirm the only changed lines are inside `- Tasks:` and on `- Depends on:`, and that heading, goal, and the `- AC:` line are byte-identical. The clause must be its own task line; appending it into an existing base task line modifies that line (`base_task_lines_missing=1`) and is non-conforming. The conforming fixture (P03) proves the own-line insertion and the shifted M2-S9 can coexist: `fixture_task_lines_missing=0`, `fixture_s6_task_lines=3->4`, `fixture_ac_identity=identical`, `fixture_p08=OK`.

**Expected Outcome**:

- `changed_lines` covers only Tasks/Depends; `tasks_clause=OK`; `depends=M2-S14 OK`; `heading=identical`; `base_task_lines_missing=0`; `- Goal: identical`; `- AC: identical`; `fixture_task_lines_missing=0`; `fixture_s6_task_lines=3->4`; `fixture_ac_identity=identical`; `fixture_p08=OK`.

**Notes / Clarifications**:

- Observed on the pre-change tree (2026-11-10, base `fab46636`, before any deliverable edit): `changed_lines=0`; `tasks_clause=MISSING`; `depends=M2-S14 MISSING`; `heading=identical`; `base_task_lines_missing=0`; `- Goal: identical`; `- AC: identical`; `fixture_task_lines_missing=0`; `fixture_s6_task_lines=3->4`; `fixture_ac_identity=identical`; `fixture_p08=OK`. The identity halves and the conforming-fixture proof pass; the amendment is absent.
- Result label for Section 10: **FAIL (no amendment; identity controls pass)**.

#### TC-M2PLAN-009 - Existing headings, story codes, order, and the Epic M2 retirement note survive

**Scenario Type**: Regression
**Impact Level**: Critical
**Priority**: High
**Related IDs**: AC-F4-1, F-4, NFR-2
**Test Type(s)**: Manual (static/diff and content inspection)
**Automation Level**: Semi-automated (uncommitted procedure)
**Target Layer / Location**: `backlog.md`, all `###` headings and the retirement note
**Tags**: @docs, @diff, @preservation

**Preconditions**:

- Worktree at `docs/GH-284/m2-planning`; `git` available; base commit `fab46636cc0b5abfbd22257711f594adc0af4660` fetched.
- Section 7.1 P00 has been run once in the same shell (base snapshots and helpers).

**Steps**:

1. Run procedure **P09** (Section 7.1).
2. Confirm `removed=0`, `unexpected=0`, `order=OK`, and `retirement_note=identical`.

**Expected Outcome**:

- `base_headings=67`; `head_headings=74`; `added=7`; `removed=0`; `unexpected=0`; `order=OK`; `retirement_note=identical`; `negative_control=detected`.

**Notes / Clarifications**:

- Observed on the pre-change tree (2026-11-10, base `fab46636`, before any deliverable edit): `base_headings=67 head_headings=67 added=0 removed=0 unexpected=0`; `retirement_note=identical`; `order=OK`; `negative_control=detected`. This is a passing preservation control on the pre-change tree. The separator/`## Epic M3` byte-and-position clause of AC-F4-1 is asserted by P03 (`separator_sequence=identical`); P09 keeps its heading/order/retirement-note oracle unchanged.
- Result label for Section 10: **PASS (control)**.

#### TC-M2PLAN-010 - Frontmatter, reading guide, and cross-cutting principles are byte-identical

**Scenario Type**: Regression
**Impact Level**: Critical
**Priority**: High
**Related IDs**: AC-F4-2, F-4, NFR-2
**Test Type(s)**: Manual (static/diff and content inspection)
**Automation Level**: Semi-automated (uncommitted procedure)
**Target Layer / Location**: `backlog.md`, three leading regions
**Tags**: @docs, @diff, @preservation

**Preconditions**:

- Worktree at `docs/GH-284/m2-planning`; `git` available; base commit `fab46636cc0b5abfbd22257711f594adc0af4660` fetched.
- Section 7.1 P00 has been run once in the same shell (base snapshots and helpers).

**Steps**:

1. Run procedure **P10** (Section 7.1).
2. Confirm all three `cmp` calls are silent.

**Expected Outcome**:

- `fm=byte-identical`; `rg=byte-identical`; `cc=byte-identical`.

**Notes / Clarifications**:

- Observed on the pre-change tree (2026-11-10, base `fab46636`, before any deliverable edit): `fm=byte-identical`; `rg=byte-identical`; `cc=byte-identical`. Passing control.
- Result label for Section 10: **PASS (control)**.

#### TC-M2PLAN-011 - No delivered command is still called planned; tails are scoped; delivered clauses survive; no header says Current

**Scenario Type**: Negative
**Impact Level**: Critical
**Priority**: High
**Related IDs**: AC-F5-1, F-5, DM-2, DEC-18
**Test Type(s)**: Manual (static/diff and content inspection)
**Automation Level**: Semi-automated (uncommitted procedure)
**Target Layer / Location**: `milestones/m1/commands/*.md`, 28 pages
**Tags**: @docs, @commands, @negative

**Preconditions**:

- Worktree at `docs/GH-284/m2-planning`; `git` available; base commit `fab46636cc0b5abfbd22257711f594adc0af4660` fetched.
- Section 7.1 P00 has been run once in the same shell (base snapshots and helpers).
- All 28 M1 command pages are present and Appendix B's 14-page reconciliation set is the audit target.

**Steps**:

1. Run procedure **P11** (Section 7.1).
2. Confirm `pages=28`, `forbidden_phrase_pages=0`, `header_attribution=14/14`, `tail_violations=0`, `current_violations=0`, `watchdog_m1s15=OK`, `watchdog_sc=OK`, `verify_gates_extension=OK`, `closeout_extension=OK`; the conforming fixture passes and a `Current` header on `doctor.md` is detected.

**Expected Outcome**:

- `pages=28`; `forbidden_phrase_pages=0`; `header_attribution=14/14`; `tail_violations=0` (no `Proposed contract`/`Proposed examples` without a named planned remainder); `current_violations=0` (no `Current` on any reconciled header); `watchdog_m1s15=OK`; `watchdog_sc=OK`; `verify_gates_extension=OK`; `closeout_extension=OK`; `fixture_conforming=PASS`; `fixture_current_negative=detected`.

**Notes / Clarifications**:

- Observed on the pre-change tree (2026-11-10, base `fab46636`, before any deliverable edit): `pages=28`; `M1_planned_hits=9`; `M1_milestone_planned_hits=2`; `forbidden_phrase_pages=11`; `header_attribution=2/14`; `tail_violations=11`; `current_violations=1` (`daemon.md Current claim`); `watchdog_m1s15=OK`; `watchdog_sc=OK`; `verify_gates_extension=OK`; `closeout_extension=OK`; conforming fixture `header_attribution=14/14`, `tail_violations=0`, `current_violations=0`, `fixture_conforming=PASS`; doctor-`Current` fixture `fixture_current_negative=detected`. The preserved clauses already pass; the headers, tails, and daemon `Current` claim do not.
- Result label for Section 10: **FAIL (15 drift pages, 11 tail violations, 1 Current claim)**.

#### TC-M2PLAN-012 - board, watchdog, and mcp name their owning future story

**Scenario Type**: Happy Path
**Impact Level**: Important
**Priority**: High
**Related IDs**: AC-F5-2, F-5, DEC-3
**Test Type(s)**: Manual (static/diff and content inspection)
**Automation Level**: Semi-automated (uncommitted procedure)
**Target Layer / Location**: `board.md`, `watchdog.md`, `mcp.md` headers
**Tags**: @docs, @commands, @pointers

**Preconditions**:

- Worktree at `docs/GH-284/m2-planning`; `git` available; base commit `fab46636cc0b5abfbd22257711f594adc0af4660` fetched.
- Section 7.1 P00 has been run once in the same shell (base snapshots and helpers).

**Steps**:

1. Run procedure **P12** (Section 7.1).
2. Read each header once to confirm the future story is presented as the owner of the remainder, not as the delivered story.

**Expected Outcome**:

- `board.md -> M2-S4 OK`; `watchdog.md -> M2-S2 OK`; `mcp.md -> M3-S2 OK`.

**Notes / Clarifications**:

- Observed on the pre-change tree (2026-11-10, base `fab46636`, before any deliverable edit): All three `MISSING`.
- Result label for Section 10: **FAIL (change absent)**.

#### TC-M2PLAN-013 - daemon header corrects reachability while the delivered engine body survives

**Scenario Type**: Corner Case
**Impact Level**: Critical
**Priority**: High
**Related IDs**: AC-F5-3, F-5, F-10, DEC-2
**Test Type(s)**: Manual (static/diff and content inspection)
**Automation Level**: Semi-automated (uncommitted procedure)
**Target Layer / Location**: `milestones/m1/commands/daemon.md`
**Tags**: @docs, @commands, @daemon

**Preconditions**:

- Worktree at `docs/GH-284/m2-planning`; `git` available; base commit `fab46636cc0b5abfbd22257711f594adc0af4660` fetched.
- Section 7.1 P00 has been run once in the same shell (base snapshots and helpers).

**Steps**:

1. Run procedure **P13** (Section 7.1).
2. Read the header once and confirm it attributes the engine and control protocol to M1-S18 (GH-238) and tracks registration in the M2 delta note, without rewriting the body.

**Expected Outcome**:

- `header M1-S18 OK`; `GH-238 OK`; `not mounted OK`; `entrypoint delta OK`; `header Current=ABSENT`; `daemon_body=byte-identical`.

**Notes / Clarifications**:

- Observed on the pre-change tree (2026-11-10, base `fab46636`, before any deliverable edit): `M1-S18 MISSING`; `GH-238 OK`; `not mounted MISSING`; `entrypoint delta MISSING`; `Current=PRESENT`; `daemon_body=byte-identical`. The header is the failing half; the body-identity check is a passing control until the header edit lands.
- Result label for Section 10: **FAIL (header); body preservation PASS (control)**.

#### TC-M2PLAN-014 - Every reconciled page changes only in its status header; entrypoint changes one bounded region

**Scenario Type**: Negative
**Impact Level**: Critical
**Priority**: High
**Related IDs**: AC-F5-4, F-5, NFR-3, DEC-13, DEC-16
**Test Type(s)**: Manual (static/diff and content inspection)
**Automation Level**: Semi-automated (uncommitted procedure)
**Target Layer / Location**: `milestones/m1/commands/`, 14 pages plus `entrypoint.md`
**Tags**: @docs, @diff, @containment

**Preconditions**:

- Worktree at `docs/GH-284/m2-planning`; `git` available; base commit `fab46636cc0b5abfbd22257711f594adc0af4660` fetched.
- Section 7.1 P00 has been run once in the same shell (base snapshots and helpers).
- P11 has run first (it defines the `NEED` page map used by this procedure).

**Steps**:

1. Run procedure **P14** (Section 7.1).
2. Confirm `changed_pages=14/14`, `total_hunks>=14`, every hunk inside the header region, and `entrypoint_hunks=1`; P15 supplies the bounded-region detail (`desc_hunks=1`, `outside_desc_hunks=0`, at most two adjacent sentences).

**Expected Outcome**:

- `changed_pages=14/14`; each page `inside=N outside=0`; `entrypoint_hunks=1`; `non_vacuous=yes`; `classifier_inside=OK`; `classifier_outside=OK`; and P15 reports `entrypoint_bound=OK`.

**Notes / Clarifications**:

- Observed on the pre-change tree (2026-11-10, base `fab46636`, before any deliverable edit): `changed_pages=0/14`; `total_hunks=0`; `entrypoint_hunks=0`; `classifier_inside=OK`; `classifier_outside=OK`; `non_vacuous=no`.
- Result label for Section 10: **FAIL (vacuous: no page changed)**.

#### TC-M2PLAN-015 - Two adjacent DESCRIPTION sentences reconcile the composition and the absent set

**Scenario Type**: Happy Path
**Impact Level**: Critical
**Priority**: High
**Related IDs**: AC-F6-1, F-6, NFR-3, DEC-8, DEC-16
**Test Type(s)**: Manual (static/diff and content inspection)
**Automation Level**: Semi-automated (uncommitted procedure)
**Target Layer / Location**: `milestones/m1/commands/entrypoint.md`, DESCRIPTION region
**Tags**: @docs, @commands, @entrypoint

**Preconditions**:

- Worktree at `docs/GH-284/m2-planning`; `git` available; base commit `fab46636cc0b5abfbd22257711f594adc0af4660` fetched.
- Section 7.1 P00 has been run once in the same shell (base snapshots and helpers).

**Steps**:

1. Run procedure **P15** (Section 7.1), which derives the family set from live root `--help`.
2. Confirm the enumeration and the not-registered statement remain two separate sentences (the extraction predicate stops at the first period), that the diff is one contiguous hunk over at most two adjacent sentences, and that every other byte of the page is identical.

**Expected Outcome**:

- `observed_families=16`; `enumerated_families=16`; `families_not_enumerated=` empty; `enumerated_not_observed=` empty; `not_registered: state/mcp/resident daemon OK`; `dispatch=not-claimed-absent OK`; `not_registered_extra_families=none`; `enumeration_contains_registration=OK`; `registration_contains_enumeration=OK`; `desc_hunks=1`; `outside_desc_hunks=0`; `sentences_removed=2`; `sentences_added=2`; `entrypoint_bound=OK`; `positive_two_sentence=OK`; `negative_merged=detected`.

**Notes / Clarifications**:

- Observed on the pre-change tree (2026-11-10, base `fab46636`, before any deliverable edit): `observed_families=16`; `enumerated_families=14`; `families_not_enumerated=coordinator dispatch`; `dispatch=claimed-not-registered (FAIL)`; `not_registered_extra_families= dispatch`; `desc_hunks=0`; `outside_desc_hunks=0`; `sentences_removed=0`; `sentences_added=0`; `entrypoint_bound=FAILED`; `positive_two_sentence=OK`; `negative_merged=detected`. The two-sentence oracle self-tests fire; the page is still pre-change.
- Result label for Section 10: **FAIL (composition unchanged)**.

#### TC-M2PLAN-016 - The new dated status section states M1 delivery, the M2 planning state, and the early inputs

**Scenario Type**: Happy Path
**Impact Level**: Critical
**Priority**: High
**Related IDs**: AC-F7-1, F-7, DEC-5, RSK-8
**Test Type(s)**: Manual (static/diff and content inspection)
**Automation Level**: Semi-automated (uncommitted procedure)
**Target Layer / Location**: `doc/planning/oss-tooling/status.md`, new `##` section
**Tags**: @docs, @status, @snapshot

**Preconditions**:

- Worktree at `docs/GH-284/m2-planning`; `git` available; base commit `fab46636cc0b5abfbd22257711f594adc0af4660` fetched.
- Section 7.1 P00 has been run once in the same shell (base snapshots and helpers).

**Steps**:

1. Run procedure **P16** (Section 7.1).
2. Confirm the section is dated `2026-11-10`, repeats that story delivery is not milestone exit, and names no M0/M1 exit. The `23 of 23` marker must match under a real alternation; the snapshot text must not contain a literal `|` inside that phrase.

**Expected Outcome**:

- `new_sections=1`; every marker `OK`, including `23 of 23` under the real alternation; `literal_pipe=ABSENT`; `exit_overclaim=ABSENT`; `alternation_self_test=OK`; echo of the section heading.

**Notes / Clarifications**:

- Observed on the pre-change tree (2026-11-10, base `fab46636`, before any deliverable edit): `new_sections=0`; `2026-11-10 section=absent`; `alternation_self_test=OK`; verdict FAIL. The self-test proves the fixed `23 of 23|23/23` alternation matches prose; the pre-change tree has no section to scan.
- Result label for Section 10: **FAIL (change absent)**.

#### TC-M2PLAN-017 - The four superseded statement groups each carry one appended pointer of at most three lines

**Scenario Type**: Happy Path
**Impact Level**: Important
**Priority**: High
**Related IDs**: AC-F7-2, F-7, NFR-7, DEC-5, DEC-16
**Test Type(s)**: Manual (static/diff and content inspection)
**Automation Level**: Semi-automated (uncommitted procedure)
**Target Layer / Location**: `status.md`, title, M0-exit paragraph, 2026-11-07 scheduling section, next-steps items 1-3
**Tags**: @docs, @status, @pointers

**Preconditions**:

- Worktree at `docs/GH-284/m2-planning`; `git` available; base commit `fab46636cc0b5abfbd22257711f594adc0af4660` fetched.
- Section 7.1 P00 has been run once in the same shell (base snapshots and helpers).

**Steps**:

1. Run procedure **P17** (Section 7.1).
2. Confirm each of the four groups carries exactly one pointer, that items 1-3 count as one group, and that no original line is removed, reordered, or modified (P18 supplies the retention oracle).

**Expected Outcome**:

- `title_base_retained=yes` and `title_pointer=yes`; `g2/g3/g4_bytes_retained=yes`; `g2_pointer=yes`; `g3_pointer=yes`; `g4_pointer=1/1`; each pointer is at most three non-blank lines and names `2026-11-10`.

**Notes / Clarifications**:

- Observed on the pre-change tree (2026-11-10, base `fab46636`, before any deliverable edit): All four groups retain their bytes (`yes`), but every pointer check is `no` and `g4_pointer=0/1`. Byte retention is a passing control; the four pointers are absent.
- Result label for Section 10: **FAIL (pointers absent); byte retention PASS (control)**.

#### TC-M2PLAN-018 - Every base status line is retained and every added line is inside the new section or a pointer insertion

**Scenario Type**: Regression
**Impact Level**: Critical
**Priority**: High
**Related IDs**: AC-F7-3, F-7, NFR-7, DEC-16
**Test Type(s)**: Manual (static/diff and content inspection)
**Automation Level**: Semi-automated (uncommitted procedure)
**Target Layer / Location**: `status.md` compared line by line with `fab46636`
**Tags**: @docs, @diff, @history

**Preconditions**:

- Worktree at `docs/GH-284/m2-planning`; `git` available; base commit `fab46636cc0b5abfbd22257711f594adc0af4660` fetched.
- Section 7.1 P00 has been run once in the same shell (base snapshots and helpers).

**Steps**:

1. Run procedure **P18** (Section 7.1), which uses whole-file line retention plus an added-line whitelist. The paragraph, scheduling-section, and items windows are anchored to the **base** statement ends and mapped through the insertion offset, so an appended pointer cannot become the last non-blank line and shift its own window (D6).
2. Confirm `removed_lines=0`, `added_lines>0`, `pointer_runs=4`, `pointer_windows=4`, `bad_runs=0`, that the three self-tests fire (`negative_modified=detected`, `negative_outside=detected`, `positive_pointer=permitted`), and that `reference_head_fixture=OK`.
3. Do not use a whole-section `cmp`; the oracle prints `oracle=whole-file-line-retention`.

**Expected Outcome**:

- `windows(base-anchored):` names the new-section range and the four base-anchored pointer windows; `removed_lines=0`; `added_lines>0`; `section_lines>0`; `pointer_runs=4`; `pointer_windows=4`; `bad_runs=0`; `retention_oracle=OK`; `oracle=whole-file-line-retention (whole-section cmp not used)`; the three self-tests report `detected`, `detected`, `permitted`; `reference_head_fixture=OK` with `reference_whitelist: section_lines=3 pointer_runs=4 pointer_windows=4 bad_runs=0`.

**Notes / Clarifications**:

- Observed on the pre-change tree (2026-11-10, base `fab46636`, before any deliverable edit): `windows(base-anchored): newsec=0..-1 title=2..4 paragraph=54..56 scheduling=148..150 items=101..103`; `removed_lines=0`; `added_lines=0`; `section_lines=0`; `pointer_runs=0`; `pointer_windows=0`; `bad_runs=0`; `retention_oracle=FAILED`; `oracle=whole-file-line-retention (whole-section cmp not used)`; `negative_modified=detected`; `negative_outside=detected`; `positive_pointer=permitted`; `reference_whitelist: section_lines=3 pointer_runs=4 pointer_windows=4 bad_runs=0`; `reference_head_fixture=OK`. Retention passes but the file has no addition; the reference fixture proves an appended pointer is counted by its base-anchored window rather than shifting it.
- Result label for Section 10: **FAIL (vacuous: no added line); retention PASS (control)**.

#### TC-M2PLAN-019 - The M2 pack has the twelve documents, states the contents-table deviation, and leaves the table byte-identical

**Scenario Type**: Happy Path
**Impact Level**: Critical
**Priority**: High
**Related IDs**: AC-F8-1, F-8, F-10, DM-3, DEC-20
**Test Type(s)**: Manual (static/diff and content inspection)
**Automation Level**: Semi-automated (uncommitted procedure)
**Target Layer / Location**: `milestones/m2/` tree, its `README.md`, and the `milestones/README.md` contents table
**Tags**: @docs, @pack

**Preconditions**:

- Worktree at `docs/GH-284/m2-planning`; `git` available; base commit `fab46636cc0b5abfbd22257711f594adc0af4660` fetched.
- Section 7.1 P00 has been run once in the same shell (base snapshots and helpers).

**Steps**:

1. Run procedure **P19** (Section 7.1).
2. Confirm `actual_files=12`, the README links all twelve with pack-relative targets (no parent-directory escape; the self-entry uses a row-shaped `| \`README.md\` |` pattern), `deviation_statement=OK` (no `man-page.md` or `interactions.md`; `entrypoint-delta.md` instead), and `pack_contents_table=byte-identical`.

**Expected Outcome**:

- `pack_files=12/12`; `actual_files=12 (expected 12)`; `readme_lists=12/12` via pack-relative links (no `../` escape); `readme_self_link_self_test=detected`; `deviation_statement=OK`; `pack_contents_table=byte-identical`.

**Notes / Clarifications**:

- Observed on the pre-change tree (2026-11-10, base `fab46636`, before any deliverable edit): `pack_files=0/12`; `actual_files=0`; `README=absent`; `readme_self_link_self_test=detected`; `pack_contents_table=byte-identical`. The table-identity half is a passing control; the pack and its deviation statement are absent.
- Result label for Section 10: **FAIL (change absent); table identity PASS (control)**.

#### TC-M2PLAN-020 - Architecture carries C4 L1/L2/L3, the six flows plus park/resume, and the deltas

**Scenario Type**: Happy Path
**Impact Level**: Critical
**Priority**: High
**Related IDs**: AC-F8-2, F-8
**Test Type(s)**: Manual (static/diff and content inspection)
**Automation Level**: Semi-automated (uncommitted procedure)
**Target Layer / Location**: `milestones/m2/architecture.md` headings
**Tags**: @docs, @pack, @diagrams

**Preconditions**:

- Worktree at `docs/GH-284/m2-planning`; `git` available; base commit `fab46636cc0b5abfbd22257711f594adc0af4660` fetched.
- Section 7.1 P00 has been run once in the same shell (base snapshots and helpers).

**Steps**:

1. Run procedure **P20** (Section 7.1).
2. Read the architecture once to confirm each flow heading is named for its subject and the boundary-invariants section closes the document.

**Expected Outcome**:

- C4 headings `3/3`; all seven flow headings `OK`; `persistence`, `concurrency`, `boundary invariants` `OK`.

**Notes / Clarifications**:

- Observed on the pre-change tree (2026-11-10, base `fab46636`, before any deliverable edit): `architecture=absent`.
- Result label for Section 10: **FAIL (change absent)**.

#### TC-M2PLAN-021 - Contracts cover every named M2 surface including the S17 additions

**Scenario Type**: Happy Path
**Impact Level**: Critical
**Priority**: High
**Related IDs**: AC-F8-3, F-8, DEC-10
**Test Type(s)**: Manual (static/diff and content inspection)
**Automation Level**: Semi-automated (uncommitted procedure)
**Target Layer / Location**: `milestones/m2/contracts.md`
**Tags**: @docs, @pack, @contracts

**Preconditions**:

- Worktree at `docs/GH-284/m2-planning`; `git` available; base commit `fab46636cc0b5abfbd22257711f594adc0af4660` fetched.
- Section 7.1 P00 has been run once in the same shell (base snapshots and helpers).

**Steps**:

1. Run procedure **P21** (Section 7.1).
2. Read each surface once and confirm the contract states shapes rather than restating story acceptance criteria.

**Expected Outcome**:

- `contract_markers_missing=0`; no `MISSING:` lines.

**Notes / Clarifications**:

- Observed on the pre-change tree (2026-11-10, base `fab46636`, before any deliverable edit): `contracts=absent`.
- Result label for Section 10: **FAIL (change absent)**.

#### TC-M2PLAN-022 - At least two SC-M2 scenarios exist for every story S2-S17, with the twelve mandatory scenarios

**Scenario Type**: Happy Path
**Impact Level**: Critical
**Priority**: High
**Related IDs**: AC-F8-4, F-8, DEC-10
**Test Type(s)**: Manual (static/diff and content inspection)
**Automation Level**: Semi-automated (uncommitted procedure)
**Target Layer / Location**: `milestones/m2/test-scenarios.md`
**Tags**: @docs, @pack, @scenarios

**Preconditions**:

- Worktree at `docs/GH-284/m2-planning`; `git` available; base commit `fab46636cc0b5abfbd22257711f594adc0af4660` fetched.
- Section 7.1 P00 has been run once in the same shell (base snapshots and helpers).

**Steps**:

1. Run procedure **P22** (Section 7.1). Derived testability requirement: each `### SC-M2-…` heading carries its story as `(M2-Sxx)` in the heading or a following `Story: M2-Sxx` line, matching the M1 convention.
2. Confirm `total_scenarios>=32` and `stories_below_two=0`.

**Expected Outcome**:

- `total_scenarios>=32`; every `S2..S17` count `>=2`; `stories_below_two=0`; all twelve mandatory anchors `OK`.

**Notes / Clarifications**:

- Observed on the pre-change tree (2026-11-10, base `fab46636`, before any deliverable edit): `test-scenarios=absent`.
- Result label for Section 10: **FAIL (change absent)**.

#### TC-M2PLAN-023 - Journeys include the four operator journeys and the S17 cost-control journey

**Scenario Type**: Happy Path
**Impact Level**: Important
**Priority**: High
**Related IDs**: AC-F8-5, F-8
**Test Type(s)**: Manual (static/diff and content inspection)
**Automation Level**: Semi-automated (uncommitted procedure)
**Target Layer / Location**: `milestones/m2/journeys.md`
**Tags**: @docs, @pack, @journeys

**Preconditions**:

- Worktree at `docs/GH-284/m2-planning`; `git` available; base commit `fab46636cc0b5abfbd22257711f594adc0af4660` fetched.
- Section 7.1 P00 has been run once in the same shell (base snapshots and helpers).

**Steps**:

1. Run procedure **P23** (Section 7.1).
2. Read the cost-control journey once and confirm both lanes remain visible while one parks and the other finishes.

**Expected Outcome**:

- `journey_headings>=5`; all five anchors `OK`; `cost-control resume OK`; `cost-control isolation OK`.

**Notes / Clarifications**:

- Observed on the pre-change tree (2026-11-10, base `fab46636`, before any deliverable edit): `journeys=absent`.
- Result label for Section 10: **FAIL (change absent)**.

#### TC-M2PLAN-024 - Six command pages carry the pack header, a bare name, and no working name

**Scenario Type**: Happy Path
**Impact Level**: Critical
**Priority**: High
**Related IDs**: AC-F9-1, F-9, DEC-14
**Test Type(s)**: Manual (static/diff and content inspection)
**Automation Level**: Semi-automated (uncommitted procedure)
**Target Layer / Location**: `milestones/m2/commands/{projects,attempts,events,spend,queue,board}.md`
**Tags**: @docs, @commands

**Preconditions**:

- Worktree at `docs/GH-284/m2-planning`; `git` available; base commit `fab46636cc0b5abfbd22257711f594adc0af4660` fetched.
- Section 7.1 P00 has been run once in the same shell (base snapshots and helpers).

**Steps**:

1. Run procedure **P24** (Section 7.1).
2. Confirm `Status: Proposed (M2)` is line 3 of each page and `<binary>` is used for every invocation prefix.

**Expected Outcome**:

- `command_headers=6/6`; the H1 matches the file stem (`# projects(1)`, `# attempts(1)`, and so on); no `ados` literal.

**Notes / Clarifications**:

- Observed on the pre-change tree (2026-11-10, base `fab46636`, before any deliverable edit): `command_headers=0/6`; all six files absent.
- Result label for Section 10: **FAIL (change absent)**.

#### TC-M2PLAN-025 - Each command page carries the required body sections and the family relationships

**Scenario Type**: Happy Path
**Impact Level**: Critical
**Priority**: High
**Related IDs**: AC-F9-2, F-9
**Test Type(s)**: Manual (static/diff and content inspection)
**Automation Level**: Semi-automated (uncommitted procedure)
**Target Layer / Location**: the six M2 command pages
**Tags**: @docs, @commands

**Preconditions**:

- Worktree at `docs/GH-284/m2-planning`; `git` available; base commit `fab46636cc0b5abfbd22257711f594adc0af4660` fetched.
- Section 7.1 P00 has been run once in the same shell (base snapshots and helpers).

**Steps**:

1. Run procedure **P25** (Section 7.1).
2. Read `attempts` once to confirm it is presented as a `dispatch` subfamily and `events` as the subscribe-taxonomy reference.

**Expected Outcome**:

- Every page `missing:` is empty; `attempts=dispatch subfamily OK`; `events=subscribe taxonomy OK`.

**Notes / Clarifications**:

- Observed on the pre-change tree (2026-11-10, base `fab46636`, before any deliverable edit): All six absent; both relationship checks `MISSING`.
- Result label for Section 10: **FAIL (change absent)**.

#### TC-M2PLAN-026 - The entrypoint delta note records the observed composition, planned additions, and the daemon gap

**Scenario Type**: Happy Path
**Impact Level**: Critical
**Priority**: High
**Related IDs**: AC-F10-1, F-10, DEC-2, DEC-12
**Test Type(s)**: Manual (static/diff and content inspection)
**Automation Level**: Semi-automated (uncommitted procedure)
**Target Layer / Location**: `milestones/m2/entrypoint-delta.md`
**Tags**: @docs, @pack, @entrypoint

**Preconditions**:

- Worktree at `docs/GH-284/m2-planning`; `git` available; base commit `fab46636cc0b5abfbd22257711f594adc0af4660` fetched.
- Section 7.1 P00 has been run once in the same shell (base snapshots and helpers).

**Steps**:

1. Run procedure **P26** (Section 7.1).
2. Confirm the invocations and exit codes match Appendix C and that wiring is stated as product work outside this change.

**Expected Outcome**:

- All ten markers `OK`, including `dispatch`, `coordinator`, `state`, `mcp`, `daemon`, `unknown flag`, `unexpected argument`, `exit 1`, `outside this`, `entrypoint.md`.

**Notes / Clarifications**:

- Observed on the pre-change tree (2026-11-10, base `fab46636`, before any deliverable edit): `delta=absent` on the pre-change tree; the conforming delta-note fixture prints all ten markers `OK`, including `entrypoint.md OK`.
- Result label for Section 10: **FAIL (change absent)**.

#### TC-M2PLAN-027 - The milestone index gains one planned M2 row with twelve linked targets and leaves the M0/M1 rows untouched

**Scenario Type**: Happy Path
**Impact Level**: Important
**Priority**: High
**Related IDs**: AC-F11-1, F-11, DM-3, DEC-20
**Test Type(s)**: Manual (static/diff and content inspection)
**Automation Level**: Semi-automated (uncommitted procedure)
**Target Layer / Location**: `milestones/README.md`, `## Index`
**Tags**: @docs, @pack, @index

**Preconditions**:

- Worktree at `docs/GH-284/m2-planning`; `git` available; base commit `fab46636cc0b5abfbd22257711f594adc0af4660` fetched.
- Section 7.1 P00 has been run once in the same shell (base snapshots and helpers).

**Steps**:

1. Run procedure **P27** (Section 7.1).
2. Confirm `m2_targets=12/12` (README, five pack-level documents, six command pages), `m2_row_marked_planned=yes`, and both older rows byte-identical.

**Expected Outcome**:

- `M2 row=present`; `m2_targets=12/12`; the twelve target lines; `m2_row_marked_planned=yes`; `M0 ... row=identical`; `M1 ... row=identical`.

**Notes / Clarifications**:

- Observed on the pre-change tree (2026-11-10, base `fab46636`, before any deliverable edit): `M2 row=absent`; `m2_targets=0/12`; both M0/M1 rows identical. Row absence is the failing half; row preservation is a passing control.
- Result label for Section 10: **FAIL (row absent); M0/M1 preservation PASS (control)**.

#### TC-M2PLAN-028 - Delivery budget 31 files and phase-7 budget 3 files (34 total)

**Scenario Type**: Negative
**Impact Level**: Critical
**Priority**: High
**Related IDs**: AC-NFR1-1, NFR-1, DEC-21, DEC-22
**Test Type(s)**: Manual (static/diff and content inspection)
**Automation Level**: Semi-automated (uncommitted procedure)
**Target Layer / Location**: delivery range vs whole-change diff, excluding `doc/changes/**`
**Tags**: @diff, @containment

**Preconditions**:

- Worktree at `docs/GH-284/m2-planning`; `git` available; base commit `fab46636cc0b5abfbd22257711f594adc0af4660` fetched.
- Section 7.1 P00 has been run once in the same shell (base snapshots and helpers).

**Steps**:

1. Run procedure **P28** (Section 7.1). The delivery budget is `BASE...DELIVERY_HEAD` (the last delivery commit before phase 7), or equivalently the whole change minus the three phase-7 paths; the whole-change budget includes the working tree.
2. Confirm delivery `product_files=31` (30 planning + 1 registry), phase-7 `spec_files=2`, `overview_files=1`, `phase7_extra=0`, `total_product_files=34`, zero forbidden roots, and the negative matcher fires on a fourth `doc/spec` path.

**Expected Outcome**:

- `product_files=31`; `planning_files=30`; `registry_files=1`; `outside_planning_outside_registry=0`; `forbidden_root_files=0`; `unexpected_planning_paths=0`; `spec_files=2`; `overview_files=1`; `phase7_files=3`; `phase7_extra=0`; `phase7_unknown_paths=0`; `total_product_files=34`; `matcher_self_test=OK`; `non_vacuous=yes`.

**Notes / Clarifications**:

- Observed on the current tree (delivery commits + registry committed, three phase-7 edits in the working tree): `delivery_range=whole change minus the three phase-7 paths (equals base..the last delivery commit before phase 7)`; `product_files=31`; `planning_files=30`; `registry_files=1`; `outside_planning_outside_registry=0`; `forbidden_root_files=0`; `unexpected_planning_paths=0`; phase-7 list is exactly `doc/overview/architecture-overview.md`, `doc/spec/features/feature-cli-entrypoint.md`, `doc/spec/features/feature-resident-daemon.md`; `spec_files=2`; `overview_files=1`; `phase7_files=3`; `phase7_extra=0`; `phase7_unknown_paths=0`; `total_product_files=34`; `matcher_self_test=OK`; `non_vacuous=yes`.
- Result label for Section 10: **PASS (delivery 31 + phase 7 3 = 34)**.

#### TC-M2PLAN-029 - Every non-amended story body is byte-identical on the base, minimal, and full heads

**Scenario Type**: Regression
**Impact Level**: Critical
**Priority**: High
**Related IDs**: AC-NFR2-1, NFR-2, F-4
**Test Type(s)**: Manual (static/diff and content inspection)
**Automation Level**: Semi-automated (uncommitted procedure)
**Target Layer / Location**: `backlog.md`, all stories except the seven new and two amended
**Tags**: @docs, @diff, @preservation

**Preconditions**:

- Worktree at `docs/GH-284/m2-planning`; `git` available; base commit `fab46636cc0b5abfbd22257711f594adc0af4660` fetched.
- Section 7.1 P00 has been run once in the same shell (base snapshots and helpers).

**Steps**:

1. Run procedure **P29** (Section 7.1). Its shared `entry()` bound now stops at `^---$` and `^## ` as well as `^### `, so the base M2-S9 entry ends at the block close instead of running into Epic M3.
2. Confirm the base control and all three heads report `65/65/0 order=OK`, and that the body/removed/reorder negatives are detected.

**Expected Outcome**:

- `real_head=PASS`, `base_control=PASS`, `minimal_head=PASS`, `full_head=PASS`; every run `stories_compared=65 identical=65 changed=0 order=OK`; `negative_body=detected`; `negative_removed=detected`; `negative_reordered=detected`.

**Notes / Clarifications**:

- Observed on the pre-change tree (2026-11-10, base `fab46636`, before any deliverable edit): `-- real head --` `stories_compared=65 identical=65 changed=0 order=OK` / `real_head=PASS`; `-- base control --` `65/65/0 order=OK` / `base_control=PASS`; `-- minimal stories-only head --` `65/65/0 order=OK` / `minimal_head=PASS`; `-- full amendment + stories head --` `65/65/0 order=OK` / `full_head=PASS`; `negative_body=detected`; `negative_removed=detected`; `negative_reordered=detected`.
- Result label for Section 10: **PASS (control)**.

#### TC-M2PLAN-030 - Reconciled page bodies stay byte-identical and the entrypoint change is one bounded region

**Scenario Type**: Negative
**Impact Level**: Critical
**Priority**: High
**Related IDs**: AC-NFR3-1, NFR-3, F-5, DEC-16
**Test Type(s)**: Manual (static/diff and content inspection)
**Automation Level**: Semi-automated (uncommitted procedure)
**Target Layer / Location**: 14 command-page bodies plus the `entrypoint.md` DESCRIPTION
**Tags**: @docs, @diff, @containment

**Preconditions**:

- Worktree at `docs/GH-284/m2-planning`; `git` available; base commit `fab46636cc0b5abfbd22257711f594adc0af4660` fetched.
- Section 7.1 P00 has been run once in the same shell (base snapshots and helpers).
- P11 has run first (it defines the `NEED` page map used by this procedure).

**Steps**:

1. Run procedure **P30** (Section 7.1).
2. Confirm all fourteen bodies are byte-identical and that the entrypoint region is one contiguous hunk over at most two adjacent sentences with every other byte identical.

**Expected Outcome**:

- `body_identical=14/14`; `desc_hunks=1`; `outside_desc_hunks=0`; `sentences_removed=2`; `sentences_added=2`; `entrypoint_bound=OK`.

**Notes / Clarifications**:

- Observed on the pre-change tree (2026-11-10, base `fab46636`, before any deliverable edit): `body_identical=14/14`; `desc_hunks=0`; `outside_desc_hunks=0`; `sentences_removed=0`; `sentences_added=0`; `entrypoint_bound=FAILED`. The fourteen-body half is a passing control; the entrypoint region is unchanged.
- Result label for Section 10: **FAIL (entrypoint region unchanged); body preservation PASS (control)**.

#### TC-M2PLAN-031 - The doc-distribution guard stays green and no planning marker is added

**Scenario Type**: Regression
**Impact Level**: Important
**Priority**: Medium
**Related IDs**: AC-NFR4-1, NFR-4, DEC-6
**Test Type(s)**: Manual (guard execution)
**Automation Level**: Semi-automated (existing guard)
**Target Layer / Location**: repository guard and `doc/planning/**`
**Tags**: @guard, @docs

**Preconditions**:

- Worktree at `docs/GH-284/m2-planning`; `git` available; base commit `fab46636cc0b5abfbd22257711f594adc0af4660` fetched.

**Steps**:

1. Run procedure **P31** (Section 7.1).

**Expected Outcome**:

- `guard_exit=0`; summary `no drift — 82 in-scope docs`; `planning_markers=0`.

**Notes / Clarifications**:

- Observed on the pre-change tree (2026-11-10, base `fab46636`, before any deliverable edit): `guard_exit=0`; `(guard-doc-distribution)[OK] no drift — 82 in-scope docs; install set matches ados_distribution markers`; `planning_markers=0`. Passing control.
- Result label for Section 10: **PASS (control)**.

#### TC-M2PLAN-032 - Both aggregate-gate runs are recorded and only a lone ci-baseline-parity failure is environmental

**Scenario Type**: Regression
**Impact Level**: Critical
**Priority**: High
**Related IDs**: AC-NFR5-1, NFR-5, DEC-19
**Test Type(s)**: Manual (guard execution)
**Automation Level**: Semi-automated (existing guard)
**Target Layer / Location**: repository root
**Tags**: @guard, @aggregate

**Preconditions**:

- Worktree at `docs/GH-284/m2-planning`; `git` available; base commit `fab46636cc0b5abfbd22257711f594adc0af4660` fetched.
- `pnpm install --frozen-lockfile` has completed and `packages/*/dist` is built (the checkout under test is already built).

**Steps**:

1. Run procedure **P32** (Section 7.1). It creates `"$(git rev-parse --show-toplevel)/tmp/tmpdir"`, runs `pnpm check` with the default `TMPDIR`, then runs it again with that repo-local `TMPDIR`, and records both exits.
2. Confirm the repo-local run exits 0; a default-run failure is environmental only when exactly one test fails and it is `CI baseline parity (hermetic partial clone)`.

**Expected Outcome**:

- `default_exit` and `repo_tmpdir_exit` both recorded; `repo_tmpdir_exit=0`; if `default_exit>0`, `default_failed_tests=1` and `default_failure_class=environmental (ci-baseline-parity only)`; `gate_verdict=PASS`.

**Notes / Clarifications**:

- Observed on the pre-change tree (2026-11-10, base `fab46636`, before any deliverable edit): Pre-change (registration missing): `default_exit=1`; `default_failed_tests=4`; `default_failure_class=delivery`; the four failures are `CI baseline parity (hermetic partial clone)` (cross-device in the default `/tmp`) plus the three forbidden-literals tests (`5/5 scope classes are scanned with 0 violations`; `rename drill document`; `legacy adapter confinement`); `repo_tmpdir_exit=1` (the repaired parity scan still fails on the unregistered pack, plus the three forbidden tests); `gate_verdict=FAIL`. Post-change with the one-file registration: repo-local exits 0, and a default failure is only the lone cross-device parity test, classified environmental.
- Result label for Section 10: **FAIL (registration missing; repo-local gate red)**.

#### TC-M2PLAN-033 - The M2 diagrams satisfy the five structural conditions and each expected heading owns a diagram

**Scenario Type**: Corner Case
**Impact Level**: Critical
**Priority**: High
**Related IDs**: AC-NFR6-1, NFR-6, RSK-9
**Test Type(s)**: Manual (structural procedure)
**Automation Level**: Semi-automated (uncommitted procedure)
**Target Layer / Location**: `milestones/m2/**/*.md`
**Tags**: @docs, @pack, @diagrams

**Preconditions**:

- Worktree at `docs/GH-284/m2-planning`; `git` available; base commit `fab46636cc0b5abfbd22257711f594adc0af4660` fetched.
- Section 7.1 P00 has been run once in the same shell (base snapshots and helpers).

**Steps**:

1. Run procedure **P33** (Section 7.1), which adopts Appendix E v1.5: tolerant C4 predicate, exactly one diagram per C4 heading before the next `##`, and exactly one per `###` heading under `## Key flows`.
2. Confirm `mermaid_fences>=10`, `keyword_and_fence_exit=0`, `c4_headings_with_diagrams=3/3`, `flow_headings_with_diagrams=7/7`, `heading_association=OK`, and both fixture self-tests (`fixture_good_metrics=3/3,7/7,OK`, `fixture_negative=detected`).

**Expected Outcome**:

- The committed form is `## C4 Level 1: system context` (level digit + `: ` + subject); the predicate `^## C4 Level $lvl([^0-9]|$)` also accepts a bare heading. `mermaid_fences>=10`; `keyword_and_fence_exit=0`; `c4_headings_with_diagrams=3/3` (exactly one block per level); `flow_headings_with_diagrams=7/7` (exactly one under each `## Key flows` → `###` heading); `heading_association=OK`; `fixture_good_metrics=3/3,7/7,OK`; `fixture_negative=detected`.

**Notes / Clarifications**:

- Observed on the pre-change tree (2026-11-10, base `fab46636`, before any deliverable edit): `FAIL: doc/planning/oss-tooling/milestones/m2 absent; mermaid fences=0 (<10); association=absent`; the compliant fixture still reports `fixture_good=OK` / `fixture_good_metrics=3/3,7/7,OK`, and the level-1-without-diagram fixture reports `C4 Level 1 has diagram=MISSING` / `fixture_negative=detected`.
- Result label for Section 10: **FAIL (change absent)**.

#### TC-M2PLAN-034 - The status retention oracle passes and all four pointer insertions are present

**Scenario Type**: Regression
**Impact Level**: Critical
**Priority**: High
**Related IDs**: AC-NFR7-1, NFR-7, F-7, DEC-16
**Test Type(s)**: Manual (static/diff and content inspection)
**Automation Level**: Semi-automated (uncommitted procedure)
**Target Layer / Location**: `status.md`, whole-file retention plus the four pointer groups
**Tags**: @docs, @diff, @history

**Preconditions**:

- Worktree at `docs/GH-284/m2-planning`; `git` available; base commit `fab46636cc0b5abfbd22257711f594adc0af4660` fetched.
- Section 7.1 P00 has been run once in the same shell (base snapshots and helpers).
- P18 has run first (it defines `retention_oracle`); P34 defines `ptr()` locally and runs alone otherwise.

**Steps**:

1. Run procedure **P34** (Section 7.1). It reuses P18's whole-file retention oracle and checks that all four pointer groups carry a pointer.
2. Confirm `retention_oracle=OK`, `oracle=whole-file-line-retention (whole-section cmp not used)`, and `pointer_groups=4/4`.

**Expected Outcome**:

- `retention_oracle=OK`; `oracle=whole-file-line-retention (whole-section cmp not used)`; `pointer_groups=4/4`; `sed_line_address_0_errors=0`; zero removed, reordered, or modified base lines; every added line inside the new section or one of the four pointer insertions.

**Notes / Clarifications**:

- Observed on the pre-change tree (2026-11-10, base `fab46636`, before any deliverable edit): `retention_oracle=FAILED`; `oracle=whole-file-line-retention (whole-section cmp not used)`; `pointer_groups=0/4`; `sed_line_address_0_errors=0`. Zero removals is a passing retention control; there are no additions or pointers yet, and the title group is addressable without a `sed` line-address-0 error.
- Result label for Section 10: **FAIL (change absent); retention PASS (control)**.

#### TC-M2PLAN-035 - All 79 ticket clauses are present across the seven stories and both amendments

**Scenario Type**: Corner Case
**Impact Level**: Critical
**Priority**: High
**Related IDs**: AC-NFR8-1, NFR-8, F-1, F-2
**Test Type(s)**: Manual (static/diff and content inspection)
**Automation Level**: Semi-automated (uncommitted procedure)
**Target Layer / Location**: the seven new story entries and the two amendments vs GH-284
**Tags**: @docs, @backlog, @fidelity

**Preconditions**:

- Worktree at `docs/GH-284/m2-planning`; `git` available; base commit `fab46636cc0b5abfbd22257711f594adc0af4660` fetched.
- Section 7.1 P00 has been run once in the same shell (base snapshots and helpers).
- P02 has run in the same shell (it defines the clause table and `clause_check`).

**Steps**:

1. Run **P02** first (it defines the ticket clause table and `clause_check`), then procedure **P35** (Section 7.1).
2. Confirm `missing_clauses=0`; every missing anchor is printed with its clause id and short clause. Complete the manual paraphrase read for the semantic residue (G-1).

**Expected Outcome**:

- `clause_scan: total=79 present=79 missing=0`; `missing_clauses=0`; `s17_missing_criteria=0`; `added_criteria=0`; `changed_meaning=0` by the recorded review checklist.

**Notes / Clarifications**:

- Observed on the pre-change tree (2026-11-10, base `fab46636`, before any deliverable edit): `clause_scan: total=79 present=0 missing=79`; `missing_clauses=79`; `s17_missing_criteria=7`; `added_criteria=0`; all 79 clause ids printed as `MISSING`, including `S11-AC1`, `S12-AC2`, `S13-AC1`, `S15-AC1`, `S15-AC2`, `S15-AC3`, `S16-AC1`, and `S17-AC3`/`AC4`/`AC6`. The oracle bites on the full clause set.
- Result label for Section 10: **FAIL (change absent; 79 clauses missing)**.

#### TC-M2PLAN-036 - The forbidden-literals guard is clean and the twelve M2 documents are registered

**Scenario Type**: Negative
**Impact Level**: Important
**Priority**: Medium
**Related IDs**: AC-NFR9-1, NFR-9, RSK-4, DEC-21
**Test Type(s)**: Manual (static/diff and content inspection)
**Automation Level**: Semi-automated (uncommitted procedure)
**Target Layer / Location**: `scripts/checks/forbidden-literals.registry.json`; `doc/planning/oss-tooling/` added lines
**Tags**: @guard, @docs, @literals

**Preconditions**:

- Worktree at `docs/GH-284/m2-planning`; `git` available; base commit `fab46636cc0b5abfbd22257711f594adc0af4660` fetched.
- Section 7.1 P00 has been run once in the same shell (base snapshots and helpers).

**Steps**:

1. Run procedure **P36** (Section 7.1). It asserts the twelve pack paths are present in `registered`, sorted among themselves, duplicate-free, and absent at the corpus baseline; then runs the guard and the added-line seed scan.
2. Read the added lines once for hosted, proprietary, fleet, repository, or product names that the configured literals do not cover (declared gap G-4).

**Expected Outcome**:

- `registered_total=139`; `m2_registry_sorted=yes`; `m2_registry_duplicates=0`; `registry_m2=12/12`; `baseline_absent=12/12`; `registry_sorted_self_test=detected`; `registry_duplicate_self_test=detected`; `forbidden_exit=0`; `OK forbidden-literals: 5/5 scope classes scanned, 0 violations`; `unregistered_findings=0`; `seed_hits=0`; `non_vacuous=yes`.

**Notes / Clarifications**:

- Observed on the pre-change tree (2026-11-10, base `fab46636`, before any deliverable edit): `registered_total=127`; `m2_registry_sorted=yes`; `m2_registry_duplicates=0`; `registry_m2=0/12`; `baseline_absent=12/12`; `registry_sorted_self_test=detected`; `registry_duplicate_self_test=detected`; `forbidden_exit=1`; `unregistered_findings=12`; `added_lines=1665`; `seed_hits=0`; `non_vacuous=yes`. The guard fails closed on the twelve unregistered pack docs; only the registration is missing.
- Result label for Section 10: **FAIL (12 unregistered pack documents)**.

#### TC-M2PLAN-037 - No relative link is broken and no pack document restates an acceptance-criteria block

**Scenario Type**: Corner Case
**Impact Level**: Important
**Priority**: Medium
**Related IDs**: AC-NFR10-1, NFR-10, RSK-6
**Test Type(s)**: Manual (static/diff and content inspection)
**Automation Level**: Semi-automated (uncommitted procedure)
**Target Layer / Location**: all changed planning files and the M2 pack
**Tags**: @docs, @links, @non-duplication

**Preconditions**:

- Worktree at `docs/GH-284/m2-planning`; `git` available; base commit `fab46636cc0b5abfbd22257711f594adc0af4660` fetched.
- Section 7.1 P00 has been run once in the same shell (base snapshots and helpers).

**Steps**:

1. Run procedure **P37** (Section 7.1).
2. Read the pack once for paraphrased acceptance criteria, which the `- AC:`/`**Given**` predicate cannot see (declared gap G-5).

**Expected Outcome**:

- `broken_links=0`; `restated_ac_blocks=0`; `non_vacuous=yes`.

**Notes / Clarifications**:

- Observed on the pre-change tree (2026-11-10, base `fab46636`, before any deliverable edit): `changed_planning_files=0`; `broken_links=0`; `restated_ac_blocks=0`; `non_vacuous=no`.
- Result label for Section 10: **FAIL (vacuous: no changed file)**.

## 6. Environments and Test Data

| Aspect | Detail |
|---|---|
| Environment | Local developer worktree of this repository on branch `docs/GH-284/m2-planning`; no server, container, service, credential, or network dependency |
| Toolchain | `git` (diff and base snapshots), `bash`, `awk`, `grep`, `sed`, `comm`, `cmp`, `bun` (for the forbidden-literals guard), `pnpm` (aggregate gate and the built `delivery-os` entrypoint); all already required by the repository |
| Base revision | `fab46636cc0b5abfbd22257711f594adc0af4660` (= `origin/main-tools` at authoring time). Snapshots are materialised with `git show "$BASE:$BL"` so later base movement cannot silently widen the comparison |
| Test data | Base snapshots in `/tmp/gh284/base-*.md`; the changed files are read from the worktree; the family set for P15 comes from live root `--help`, not from a hardcoded list |
| Mutation fixtures | `/tmp`-only copies, never committed: an M2-S4 goal mutation (P07), a heading mutation (P09), a two-sentence versus merged-sentence DESCRIPTION pair (P15), and three status-retention fixtures (P18: modified line, outside append, valid pointer). Each proves the oracle fires and none is written into the repository |
| Guard scope | `test-doc-distribution.sh` scans `doc/guides/**` and a fixed standalone set; `doc/planning/**` is outside it and carries no marker, which is the expected state (DEC-6) |
| Isolation | Every procedure is read-only with respect to the repository: no writes outside `/tmp`, no branch, index, or file mutation. The planning files under test are never edited to make a check pass |
| Environment caveat | `/tmp` is tmpfs in this checkout, so the default `pnpm check` fails only in `ci-baseline-parity.test.ts` with a cross-device hardlink. P32 runs both the default and the DEC-19 repo-local form (`mkdir -p "$REPO_ROOT/tmp/tmpdir" && TMPDIR="$REPO_ROOT/tmp/tmpdir" pnpm check`) and classifies only that lone default failure as environmental (G-2) |
| Cleanup | `rm -rf /tmp/gh284 /tmp/gh284-*` |
| Evidence capture | The Section 10 log, the procedure output, and the guard summaries are pasted into the PR description per `.ai/rules/testing-strategy.md` |

## 7. Automation Plan and Implementation Mapping

### 7.1 Procedure Pack — How to Run, in Order

Run from the repository root on the branch head. Every procedure is uncommitted; nothing here may be added to `tests/**`, `scripts/**`, or `.ai/**` (AC-NFR1-1). P00 defines the helpers and base snapshots; the remaining blocks assume the same shell. Procedures are numbered in acceptance-criterion order (P01 = AC-F1-1, ... P37 = AC-NFR10-1), and Section 7.2 maps each TC to its block.

**P00 — materialise base snapshots and helpers**

```bash
set -uo pipefail
cd "$(git rev-parse --show-toplevel)"
BASE=fab46636cc0b5abfbd22257711f594adc0af4660
BL=doc/planning/oss-tooling/backlog.md
ST=doc/planning/oss-tooling/status.md
MR=doc/planning/oss-tooling/milestones/README.md
M1=doc/planning/oss-tooling/milestones/m1/commands
M2=doc/planning/oss-tooling/milestones/m2

entry() { awk -v h="$2" 'index($0,h)==1{f=1;print;next} f&&(/^### /||/^---$/||/^## /){exit} f{print}' "$1"; }
section() { awk -v h="$2" '$0==h{f=1;print;next} f&&/^## /{exit} f{print}' "$1"; }

mkdir -p /tmp/gh284
git show "$BASE:$BL" > /tmp/gh284/base-backlog.md
git show "$BASE:$ST" > /tmp/gh284/base-status.md
git show "$BASE:$MR" > /tmp/gh284/base-milestones-README.md
echo "base snapshots ready: $(wc -l < /tmp/gh284/base-backlog.md) backlog, $(wc -l < /tmp/gh284/base-status.md) status lines"
desc() { awk '/^## DESCRIPTION/{f=1;next} /^## /{f=0} f' "$1"; }
entrypoint_oracle() { # $1=base file, $2=head file
  local base="$1" head="$2"
  local hs he hunks outside rem add rs as
  hs=$(awk '/^## DESCRIPTION/{print NR+1; exit}' "$head")
  he=$(awk -v s="$hs" 'NR>=s && /^## /{print NR-1; exit}' "$head")
  hunks=$(diff -U0 "$base" "$head" | grep -cE '^@@' || true)
  outside=$(diff -U0 "$base" "$head" | sed -nE 's/^@@ -[0-9]+(,[0-9]+)? \+([0-9]+)(,([0-9]+))? @@.*/\2 \4/p' \
    | awk -v s="$hs" -v e="$he" '{c=$1; d=($2==""?1:$2); if (c<s || c+d-1>e) print}' | wc -l)
  rem=$(diff -U0 "$base" "$head" | grep '^-' | grep -v '^---' | sed 's/^-//' | tr '\n' ' ')
  add=$(diff -U0 "$base" "$head" | grep '^+' | grep -v '^+++' | sed 's/^+//' | tr '\n' ' ')
  rs=$(printf '%s' "$rem" | grep -oE '\.( |$)' | wc -l)
  as=$(printf '%s' "$add" | grep -oE '\.( |$)' | wc -l)
  echo "desc_region=head:$hs..$he desc_hunks=$hunks outside_desc_hunks=$outside sentences_removed=$rs sentences_added=$as"
  [ "$hunks" -eq 1 ] && [ "$outside" -eq 0 ] && [ "$rs" -ge 1 ] && [ "$rs" -le 2 ] && [ "$as" -eq "$rs" ]
}
```

**P01 — seven new story entries and their shape**

```bash
s9=$(grep -n '^### M2-S9 ' "$BL" | cut -d: -f1)
m3=$(grep -n '^## Epic M3' "$BL" | cut -d: -f1)
mapfile -t got < <(awk -v a="$s9" -v b="$m3" 'NR>a && NR<b && /^### /{print}' "$BL")
mapfile -t want < <(printf '%s\n' \
 '### M2-S11 Multi-repository workstations' \
 '### M2-S12 Evidence inspection and divergence resolution' \
 '### M2-S13 Public event taxonomy' \
 '### M2-S14 Harness telemetry v2' \
 '### M2-S15 Queue lifecycle completion' \
 '### M2-S16 Engine-first delivery operations' \
 '### M2-S17 Provider-aware peak pausing')
found=0; shape=0
for w in "${want[@]}"; do
  if printf '%s\n' "${got[@]}" | grep -Fxq "$w"; then found=$((found+1)); fi
  if grep -Fxq "$w" "$BL"; then
    e=$(entry "$BL" "$w")
    ok=1
    for lab in '- Goal:' '- Tasks:' '- AC:' '- Depends on:'; do printf '%s\n' "$e" | grep -q -- "$lab" || ok=0; done
    printf '%s\n' "$e" | grep -q -- '- Ticket:' && ok=0
    [ "$ok" -eq 1 ] && shape=$((shape+1))
  fi
done
order=FAIL; [ "${#got[@]}" -eq 7 ] && [ "$found" -eq 7 ] && order=OK
echo "m2_story_headings=$(( ${#got[@]} )) new_found=$found/7 order=$order"
echo "shape_ok=$shape/7 (Goal+Tasks+AC+Depends-on, no Ticket line)"
[ "$found" -eq 7 ] && [ "$shape" -eq 7 ] && echo "P01 verdict: PASS" || { echo "P01 verdict: FAIL (change absent)"; }
```

**P02 — ticket clause table for S11-S16**

```bash
# The table is the ticket's clause set, not the expected delivery text: every Goal,
# task, acceptance, and dependency clause carries an anchor. A missing anchor fails
# with its clause id and short clause (DOR finding 2).
clause_rows() { cat <<'CLAUSES'
S11-G1|M2-S11|multiple delivery.managed repositories.*first.class|multiple repos first-class
S11-T1|M2-S11|git common dir marker|per-repository state scoping from checkout identity
S11-T2|M2-S11|host.level index|host-level index
S11-T3|M2-S11|projects list.*repo key.*state location.*daemon reachability.*handover state|projects list fields
S11-T4|M2-S11|migration note.*single.store|migration note for single-store users
S11-T5|M2-S11|two checkouts.*same ref.*cannot observe each other|tests prove same-ref isolation
S11-AC1|M2-S11|disjoint phase state and queue entries|disjoint phase state and queue entries
S11-AC2|M2-S11|projects list.*without manual configuration|projects list enumerates without manual configuration
S11-D1|M2-S11|M0-S5.*M1-S17|depends on M0-S5 and M1-S17
S12-G1|M2-S12|dual.run evidence ledger.*inspectable.*actionable|evidence ledger inspectable and actionable
S12-T1|M2-S12|dispatch attempts.*--ref.*--limit.*token.*corroboration.*divergence.*timestamps.*harness|dispatch attempts read side
S12-T2|M2-S12|dual.run resolve.*local evidence|divergence resolution flow with local evidence
S12-T3|M2-S12|coverage and floor|coverage and floor reporting
S12-AC1|M2-S12|machine envelope|history retrievable as machine envelope
S12-AC2|M2-S12|resolved with a note.*unresolved|resolved with a note and unresolved counts
S12-AC3|M2-S12|local.evidence mode.*declared|local-evidence mode declared
S12-D1|M2-S12|M1-S9|depends on M1-S9
S13-G1|M2-S13|daemon subscribe surface.*versioned.*documented|versioned documented subscribe taxonomy
S13-T1|M2-S13|queue\.graph|queue.graph topic
S13-T2|M2-S13|dispatch\.attempt|dispatch.attempt topic
S13-T3|M2-S13|phase\.state|phase.state topic
S13-T4|M2-S13|blockers\.state|blockers.state topic
S13-T5|M2-S13|event kinds.*payloads.*ordering guarantees.*overflow.to.repoll|event kinds, payloads, ordering, overflow rule
S13-T6|M2-S13|contract tests per topic|contract tests per topic
S13-AC1|M2-S13|observes entry and dependency changes it can act on|client observes actionable entry/dependency changes
S13-AC2|M2-S13|version.*pinned by tests|taxonomy version pinned by tests
S13-AC3|M2-S13|overflow.*preserved for every topic|overflow behavior preserved per topic
S13-D1|M2-S13|M1-S18|depends on M1-S18
S14-G1|M2-S14|token, cost, and timing telemetry.*per ticket.*repository.*lane.*agent role.*model|per-ticket/repo/lane/role/model telemetry
S14-T1|M2-S14|opencode v2\.x\.y.*step frames|opencode v2.x.y step frames
S14-T2|M2-S14|session economics.*command.audit identity|attribution via session economics and audit identity
S14-T3|M2-S14|phase.transition.*stall.*restart timing|phase-transition, stall, restart timing
S14-T4|M2-S14|schema.versioned local event storage|schema-versioned local event storage
S14-T5|M2-S14|breakdowns per ticket.*repo.*lane.*agent.*model.*timing summaries|spend breakdowns and timing summaries
S14-T6|M2-S14|retro evidence pass.*morning brief|summaries to retro and brief
S14-AC1|M2-S14|tokens and cost per agent role and model.*phase timings|tokens/cost per role and model with phase timings
S14-AC2|M2-S14|reconciling.*within a declared tolerance|reconciles within declared tolerance
S14-AC3|M2-S14|retro evidence pass and brief cite|retro and brief cite the numbers
S14-AC4|M2-S14|telemetry absence.*classified outcome|telemetry absence classified
S14-D1|M2-S14|M1-S11.*M1-S15.*M1-S19.*M1-S22|depends on M1-S11, M1-S15, M1-S19, M1-S22
S15-G1|M2-S15|queue hygiene.*entries leave.*work lands or is abandoned|queue hygiene on landing or abandonment
S15-T1|M2-S15|removal/release with reasons|removal/release with reasons
S15-T2|M2-S15|automatic release on merge and closeout|automatic release on merge and closeout
S15-T3|M2-S15|dependency edge add/remove|dependency edge add/remove
S15-T4|M2-S15|single.flight per ref.*dispatch paths|single-flight per ref across dispatch paths
S15-T5|M2-S15|reconciliation of stale entries against tracker truth|stale-entry reconciliation against tracker truth
S15-AC1|M2-S15|after a squash merge and closeout.*queue entry is gone without manual action|auto removal without manual action
S15-AC2|M2-S15|refused with a classified error naming the holder|refusal with classified error naming holder
S15-AC3|M2-S15|stale entries.*reconcilable without editing state files|stale entries reconcilable without editing state
S15-D1|M2-S15|M1-S9.*M1-S17.*M1-S18|depends on M1-S9, M1-S17, M1-S18
S16-G1|M2-S16|day.to.day delivery.*typed engine.*shell stack.*fallback|engine-first delivery with documented shell fallback
S16-T1|M2-S16|operate dispatch through the engine|operate dispatch through the engine
S16-T2|M2-S16|provider windows and holds.*engine.visible|provider windows and holds as engine-visible data
S16-T3|M2-S16|pre.iteration hold hook.*lane economics|built on the pre-iteration hold hook and lane economics
S16-T4|M2-S16|periodic handover.gate evaluation.*per repository|periodic handover-gate evaluation per repository
S16-T5|M2-S16|deprecation pointers.*shell entry points|deprecation pointers from shell entry points
S16-AC1|M2-S16|consecutive engine dispatches with corroborated outcomes accrue|corroborated outcomes accrue in the summary
S16-AC2|M2-S16|handover evaluation.*per.condition status|handover evaluation reports per-condition status
S16-AC3|M2-S16|shell path remains usable and documented|shell path remains usable and documented
S16-AC4|M2-S16|per.repository and reversible|flip is per-repository and reversible
S16-D1|M2-S16|M1-S9.*M1-S18.*M1-S21.*#280|depends on M1-S9, M1-S18, M1-S21 and #280
S17-G1|M2-S17|peak.hour cost control.*per provider profile|peak-hour cost control per provider profile
S17-T1|M2-S17|provider profile.*dispatch admission.*lane and attempt records|profile nomination at admission recorded on lane and attempt
S17-T2|M2-S17|peak.window rules as data.*windows.*multipliers.*buffers|peak-window rules as data
S17-T3|M2-S17|bounded.grace stop.*park reason|bounded-grace stop with recorded park reason
S17-T4|M2-S17|automatic resume from preserved session state.*same branch.*never re.dispatch|resume from preserved state without re-dispatch
S17-T5|M2-S17|zero.spend assertion.*no model calls bill|zero-spend assertion through telemetry
S17-T6|M2-S17|daemon.absent.*iteration.start gating|daemon-absent iteration-start degradation
S17-AC1|M2-S17|nominated provider profile.*visible on lane and attempt records|nomination visible on lane and attempt records
S17-AC2|M2-S17|every in.flight lane using P.*bounded grace.*parked with reason.*peak.window.*window end|peak start parks every in-flight lane on P
S17-AC3|M2-S17|lanes using other providers are unaffected.*keep running|other providers unaffected and keep running
S17-AC4|M2-S17|no branch, artifact, or queue state is lost or duplicated|resume loses or duplicates no branch, artifact, or queue state
S17-AC5|M2-S17|zero billable model calls.*during its peak window|zero billable model calls during the window
S17-AC6|M2-S17|stop, park, and resume are auditable ledger events surfaced in status and brief|stop/park/resume auditable in status and brief
S17-AC7|M2-S17|daemon resident.*without it.*iteration.start gating.*difference declared|daemon-resident and daemon-absent declared difference
S17-D1|M2-S17|M1-S15.*M1-S18.*M1-S21.*M1-S22.*M2-S14.*#280|depends on M1-S15, M1-S18, M1-S21, M1-S22, M2-S14 and #280
S4-AMD1|M2-S4|Depends on: M1-S5, M1-S17, M2-S11|M2-S4 depends on M2-S11
S6-AMD1|M2-S6|consumes M2-S14 telemetry.*per.agent and per.model|M2-S6 consumes M2-S14 telemetry for per-agent/per-model facts
S6-AMD2|M2-S6|Depends on: M1-S19, M2-S3, M2-S14|M2-S6 depends on M2-S14
CLAUSES
}
for n in 4 6 11 12 13 14 15 16 17; do entry "$BL" "### M2-S$n " | tr '\n' ' ' > /tmp/gh284/cl$n.txt; done
clause_check() { # $1 = case pattern over M2-S11..M2-S17
  local pat="$1" total=0 present=0 missing=0 id story anchor clause txt
  while IFS='|' read -r id story anchor clause; do
    [ -z "$id" ] && continue
    [[ "$story" =~ $pat ]] || continue
    txt=$(cat "/tmp/gh284/cl${story#M2-S}.txt" 2>/dev/null)
    total=$((total+1))
    if printf '%s' "$txt" | grep -Eiq -- "$anchor"; then present=$((present+1)); else missing=$((missing+1)); echo "MISSING $id: $clause"; fi
  done < <(clause_rows)
  echo "clause_scan: total=$total present=$present missing=$missing"
  [ "$missing" -eq 0 ]
}
for st in 11 12 13 14 15 16; do
  c=0; pr=0
  while IFS='|' read -r id story anchor clause; do
    [ "$story" = "M2-S$st" ] || continue; c=$((c+1))
    printf '%s' "$(cat /tmp/gh284/cl$st.txt)" | grep -Eiq -- "$anchor" && pr=$((pr+1))
  done < <(clause_rows)
  echo "M2-S$st clauses=$pr/$c"
done
clause_check 'M2-S11|M2-S12|M2-S13|M2-S14|M2-S15|M2-S16' && echo "P02 verdict: PASS" || echo "P02 verdict: FAIL (clauses missing)"
```

**P03 — append-only hunk containment in the backlog**

```bash
range_of() { local h="$1"; local s n; s=$(grep -n -F "$h" "$BL" | cut -d: -f1); [ -z "$s" ] && { echo ""; return; }; n=$(awk -v s="$s" 'NR>s && /^#{2,3} /{print NR; exit}' "$BL"); echo "$s $(( ${n:-$((s+1))} - 1 ))"; }
r4=$(range_of '### M2-S4 Board'); r6=$(range_of '### M2-S6 Metrics and spend')
# Insertion window (DEC-17): the stories belong INSIDE the Epic M2 block.
#   start = the line after M2-S9's last content line in the BASE snapshot (1167);
#   end   = the head revision's `---` line that precedes `## Epic M3`, minus one.
s9b=$(grep -n '^### M2-S9 ' /tmp/gh284/base-backlog.md | cut -d: -f1)
s9last_base=$(awk -v s="$s9b" 'NR>s { if ($0 ~ /^---$/ || $0 ~ /^## /) exit; if (NF>0) l=NR } END{print l+0}' /tmp/gh284/base-backlog.md)
m3h=$(grep -n '^## Epic M3' "$BL" | cut -d: -f1)
sepline=$(awk -v m="$m3h" 'NR<m && /^---$/{l=NR} END{print l+0}' "$BL")
nes=$((s9last_base+1)); nee=$((sepline-1)); newwin="$nes:$nee"
echo "insertion window: start=base M2-S9 last content+1=$nes end=head separator-1=$nee window=$newwin"
[ "$nes" -le "$nee" ] && echo "window_empty=no" || echo "window_empty=yes"
# The block-closing separator sequence (`---`, blank, `## Epic M3`) must be unchanged in content and order.
m3b=$(grep -n '^## Epic M3' /tmp/gh284/base-backlog.md | cut -d: -f1)
sep_base=$(awk -v m="$m3b" 'NR<m && /^---$/{l=NR} END{print l+0}' /tmp/gh284/base-backlog.md)
base_seq=$(sed -n "${sep_base},$((sep_base+2))p" /tmp/gh284/base-backlog.md)
head_seq=$(sed -n "${sepline},$((sepline+2))p" "$BL")
[ "$base_seq" = "$head_seq" ] && echo "separator_sequence=identical" || { echo "separator_sequence=CHANGED"; printf '%s\n' "$head_seq"; }
# AC-F1-1 blank separation is HEAD-anchored: locate M2-S9 in the head, walk to
# its last non-blank line before the next heading/separator, then require blank + `### M2-S11`.
# (The hunk window above stays BASE-anchored on purpose: it marks where insertions may land.)
blank_sep_check() { # $1 = head file
  local f="$1" hs last l1 l2
  hs=$(grep -n '^### M2-S9 ' "$f" | cut -d: -f1)
  [ -z "$hs" ] && { echo "blank_separation=FAIL (M2-S9 absent in $f)"; return 1; }
  last=$(awk -v s="$hs" 'NR>s { if ($0 ~ /^---$/ || $0 ~ /^## / || $0 ~ /^### /) exit; if (NF>0) l=NR } END{print l+0}' "$f")
  l1=$(sed -n "$((last+1))p" "$f"); l2=$(sed -n "$((last+2))p" "$f")
  if [ -z "$l1" ] && printf '%s' "$l2" | grep -q '^### M2-S11 '; then
    echo "blank_separation=OK (head M2-S9 last non-blank=$last, blank=$((last+1)), M2-S11=$((last+2)))"; return 0
  else
    echo "blank_separation=FAIL (head M2-S9 last non-blank=$last; got [$l1] then [$l2])"; return 1
  fi
}
blank_sep_check "$BL" || true
# conforming-head fixture: M2-S6 gains one task line (line count +1), M2-S9 shifts,
# and M2-S11 is inserted after the existing blank line. Proves P03 and P08 can both pass.
cp /tmp/gh284/base-backlog.md /tmp/gh284/conforming-base.md
awk 'BEGIN{insec=0;done=0} /^### M2-S6 /{insec=1} insec && /^- AC:/ && !done {print "  consumes M2-S14 telemetry for per-agent and per-model facts;"; done=1} {print}' /tmp/gh284/conforming-base.md > /tmp/gh284/conforming-head-1.md
awk 'BEGIN{ins=0} /^### M2-S9 /{s=1} s && /^---$/ && !ins {print "### M2-S11 Multi-repository workstations"; print "- Goal: fixture goal."; print "- Tasks: fixture tasks."; print "- AC: fixture ac."; print "- Depends on: M0-S5, M1-S17."; ins=1} {print}' /tmp/gh284/conforming-head-1.md > /tmp/gh284/conforming-head.md
blank_sep_check /tmp/gh284/conforming-head.md && echo "fixture_blank_separation=OK" || echo "fixture_blank_separation=FAILED"
hunk_guard() { # $1..$n = "start:end" allowed ranges; hunk headers on stdin
  local -a R=("$@"); local inside=0 outside=0 h c d last ok i a b
  while IFS= read -r h; do
    case "$h" in '@@'*) ;; *) continue ;; esac
    c=$(printf '%s\n' "$h" | sed -E 's/^@@ -[0-9]+(,[0-9]+)? \+([0-9]+)(,([0-9]+))? @@.*/\2/')
    d=$(printf '%s\n' "$h" | sed -E 's/^@@ -[0-9]+(,[0-9]+)? \+([0-9]+)(,([0-9]+))? @@.*/\4/'); [ -z "$d" ] && d=1
    last=$(( c + d - 1 )); ok=0
    for r in "${R[@]}"; do a=${r%%:*}; b=${r##*:}; [ -n "$a" ] && [ -n "$b" ] || continue
      if [ "$d" -eq 0 ]; then [ "$c" -ge "$a" ] && [ "$c" -le "$b" ] && ok=1
      else [ "$c" -ge "$a" ] && [ "$last" -le "$b" ] && ok=1; fi
      [ "$ok" -eq 1 ] && break
    done
    [ "$ok" -eq 1 ] && inside=$((inside+1)) || { outside=$((outside+1)); echo "OUTSIDE: $h (added $c..$last)"; }
  done
  echo "hunks: inside=$inside outside=$outside"; [ "$outside" -eq 0 ]
}
hc=$(git diff -U0 "$BASE"...HEAD -- "$BL" | grep -cE '^@@' || true)
echo "backlog_hunks=$hc"
if [ "$hc" -ge 1 ]; then
  git diff -U0 "$BASE"...HEAD -- "$BL" | grep -E '^@@' | hunk_guard "${r4/ /:}" "${r6/ /:}" "$newwin" && echo "hunk confinement OK" || echo "hunk confinement FAILED"
  echo "non_vacuous=yes"
else
  echo "FAIL: no backlog hunk (change absent)"; echo "non_vacuous=no"
fi
# classifier self-tests: start-of-window and amended-entry hunks are inside; an insertion
# below the separator and a deletion of the separator line are outside.
tests_ok=0
printf '@@ -%d,0 +%d,1 @@\n' "$nes" "$nes" | hunk_guard "$newwin" >/dev/null && tests_ok=$((tests_ok+1))
printf '@@ -%d,1 +%d,1 @@\n' "${r4%% *}" "${r4%% *}" | hunk_guard "${r4/ /:}" >/dev/null && tests_ok=$((tests_ok+1))
printf '@@ -%d,0 +%d,1 @@\n' "$((sepline+2))" "$((sepline+2))" | hunk_guard "$newwin" >/dev/null || tests_ok=$((tests_ok+1))
printf '@@ -%d,1 +%d,0 @@\n' "$sepline" "$sepline" | hunk_guard "$newwin" >/dev/null || tests_ok=$((tests_ok+1))
echo "classifier_self_tests=$tests_ok/4"
echo "insertion_below_separator=never (negative fixture at separator+2 outside)"
[ "$hc" -ge 1 ] && echo "P03 verdict: PASS" || { echo "P03 verdict: FAIL (vacuous: no hunk)"; }
```

**P04 — S17 entry shape and dependency set**

```bash
h17=$(grep -m1 '^### M2-S17 ' "$BL" || true)
if [ -z "$h17" ]; then echo "S17=absent"; echo "P04 verdict: FAIL (change absent)"; else
  e=$(entry "$BL" "$h17")
  for lab in '- Goal:' '- Tasks:' '- AC:' '- Depends on:'; do printf '%s\n' "$e" | grep -q -- "$lab" && echo "$lab present" || echo "$lab MISSING"; done
  d=$(printf '%s\n' "$e" | grep -- '^- Depends on:')
  for t in M1-S15 M1-S18 M1-S21 M1-S22 M2-S14 '#280'; do printf '%s' "$d" | grep -Fq -- "$t" && echo "depends: $t OK" || echo "depends: $t MISSING"; done
  n=$(printf '%s\n' "$e" | awk '/^- AC:/{f=1;next} /^- Depends on:/{f=0} f&&/^[[:space:]]+[0-9]+\./{c++} END{print c+0}')
  echo "ac_numbered_items=$n/7"
fi
```

**P05 — S17 task-clause fidelity**

```bash
h17=$(grep -m1 '^### M2-S17 ' "$BL" || true)
if [ -z "$h17" ]; then echo "S17=absent clauses_present=0/6"; echo "missing=6" > /tmp/gh284/p05.env; else
  t=$(entry "$BL" "$h17" | awk '/^- Tasks:/{f=1} /^- AC:/{f=0} f{print}' | tr '\n' ' ')
  declare -A T
  T[profile-nomination]='provider profile'
  T[peak-rules-as-data]='peak-window|windows.*multipliers.*buffers|rules as data'
  T[park-bounded-grace]='bounded.grace.*park|park.*bounded.grace'
  T[resume-without-redispatch]='preserved session state.*resume|never re-dispatch|without re-dispatch'
  T[zero-spend]='zero-spend|zero spend|no model calls bill'
  T[daemon-absent]='daemon.absent.*iteration-start|iteration-start gating'
  c=0
  for k in "${!T[@]}"; do printf '%s' "$t" | grep -Eiq -- "${T[$k]}" && { c=$((c+1)); echo "clause $k OK"; } || echo "clause $k MISSING"; done
  printf '%s' "$t" | grep -Eiq '\bmay\b' && echo "softening may=PRESENT" || echo "softening may=ABSENT"
  echo "clauses_present=$c/6"
echo "missing=$((6-c))" > /tmp/gh284/p05.env
fi
```

**P06 — S17 seven criteria by content**

```bash
# self-tests always run: duplicate detection and an eighth numbered item
printf '   1. a\n   2. b\n   3. c\n   3. d\n' | sed -nE 's/^[[:space:]]+([0-9]+)\..*/\1/p' | sort | uniq -d | grep -qx 3 && echo "duplicate_self_test=detected" || echo "duplicate_self_test=FAILED"
printf '   1. a\n   2. b\n   3. c\n   4. d\n   5. e\n   6. f\n   7. g\n   8. h\n' | sed -nE 's/^[[:space:]]+([0-9]+)\..*/\1/p' > /tmp/gh284/extra-fixture.txt
xn=$(wc -l < /tmp/gh284/extra-fixture.txt)
echo "extra_self_test=$([ "$xn" -gt 7 ] && echo "detected ($xn items, extra=$((xn-7)))" || echo FAILED)"
h17=$(grep -m1 '^### M2-S17 ' "$BL" || true)
if [ -z "$h17" ]; then
  echo "S17=absent criteria_present=0/7"
  echo "ac_numbered_items=0/7"
  echo "extra_criteria=0"
  echo "duplicate_numbers=0"
else
  e=$(entry "$BL" "$h17")
  acblock=$(printf '%s\n' "$e" | awk '/^- AC:/{f=1;next} /^- Depends on:/{f=0} f' | tr '\n' ' ')
  c=0; pr=0
  while IFS='|' read -r id story anchor clause; do
    case "$id" in S17-AC*) c=$((c+1)); if printf '%s' "$acblock" | grep -Eiq -- "$anchor"; then pr=$((pr+1)); echo "$id OK"; else echo "$id MISSING: $clause"; fi ;; esac
  done < <(clause_rows)
  echo "criteria_present=$pr/7"
  printf '%s\n' "$e" | awk '/^- AC:/{f=1;next} /^- Depends on:/{f=0} f' | sed -nE 's/^[[:space:]]+([0-9]+)\..*/\1/p' > /tmp/gh284/s17-ac.txt
  ni=$(wc -l < /tmp/gh284/s17-ac.txt)
  echo "ac_numbered_items=$ni/7"
  echo "extra_criteria=$([ "$ni" -gt 7 ] && echo $((ni-7)) || echo 0)"
  echo "duplicate_numbers=$(sort /tmp/gh284/s17-ac.txt | uniq -d | wc -l)"
fi
```

**P07 — M2-S4 depends-line-only diff**

```bash
s4_oracle() { # $1 base file, $2 head file
  local b h d changed unexpected
  b=$(entry "$1" '### M2-S4 Board'); h=$(entry "$2" '### M2-S4 Board')
  [ -z "$h" ] && { echo "M2-S4=absent"; return 1; }
  d=$(diff <(printf '%s\n' "$b") <(printf '%s\n' "$h") || true)
  changed=$(printf '%s\n' "$d" | grep -cE '^[<>]' || true)
  unexpected=$(printf '%s\n' "$d" | grep -E '^[<>]' | grep -vc -- '- Depends on:' || true)
  echo "changed_lines=$changed unexpected_lines=$unexpected"
  printf '%s\n' "$h" | grep -Fxq -- '- Depends on: M1-S5, M1-S17, M2-S11' && echo "depends=expected" || echo "depends=NOT expected ($(printf '%s\n' "$h" | grep -- '^- Depends on:'))"
  [ "$changed" -eq 2 ] && [ "$unexpected" -eq 0 ]
}
s4_oracle /tmp/gh284/base-backlog.md "$BL" && echo "M2-S4 shape OK" || echo "M2-S4 shape FAIL (no amendment)"
# self-test: a one-word goal change must be flagged as unexpected
sed '/^### M2-S4 Board/,/^### M2-S5 / s/^\(- Goal: The fleet on one screen\)/\1, mutated/' "$BL" > /tmp/gh284/mut-s4.md
echo "-- self-test (goal mutated):"; s4_oracle /tmp/gh284/base-backlog.md /tmp/gh284/mut-s4.md
```

**P08 — M2-S6 tasks-plus-dependency diff**

```bash
h6=$(grep -m1 '^### M2-S6 ' "$BL" || true)
if [ -z "$h6" ]; then echo "M2-S6=absent"; else
  b=$(entry /tmp/gh284/base-backlog.md '### M2-S6 Metrics and spend'); h=$(entry "$BL" '### M2-S6 Metrics and spend')
  d=$(diff <(printf '%s\n' "$b") <(printf '%s\n' "$h") || true)
  echo "changed_lines=$(printf '%s\n' "$d" | grep -cE '^[<>]' || true)"
  printf '%s' "$h" | awk '/^- Tasks:/{f=1} /^- AC:/{f=0} f{print}' | grep -Eiq 'M2-S14.*telemetry|telemetry.*M2-S14' && echo "tasks_clause=OK" || echo "tasks_clause=MISSING"
  printf '%s\n' "$h" | grep -- '^- Depends on:' | grep -Fq 'M2-S14' && echo "depends=M2-S14 OK" || echo "depends=M2-S14 MISSING"
  # heading identity
  [ "$(printf '%s\n' "$b" | head -1)" = "$(printf '%s\n' "$h" | head -1)" ] && echo "heading=identical" || echo "heading=CHANGED"
  # every base task line survives (insertion may be anywhere)
  printf '%s\n' "$b" | awk '/^- Tasks:/{f=1;next} /^- AC:/{f=0} f' | sed '/^[[:space:]]*$/d' | LC_ALL=C sort > /tmp/gh284/t8-base.txt
  printf '%s\n' "$h" | awk '/^- Tasks:/{f=1;next} /^- AC:/{f=0} f' | sed '/^[[:space:]]*$/d' | LC_ALL=C sort > /tmp/gh284/t8-head.txt
  echo "base_task_lines_missing=$(comm -23 /tmp/gh284/t8-base.txt /tmp/gh284/t8-head.txt | wc -l)"
  # identity controls: the label's own line only (a 4-line capture would include the changed depends line)
  for lab in '- Goal:' '- AC:'; do
    bb=$(printf '%s\n' "$b" | grep -m1 -- "$lab"); hh=$(printf '%s\n' "$h" | grep -m1 -- "$lab")
    [ -n "$bb" ] && [ "$bb" = "$hh" ] && echo "$lab identical" || echo "$lab CHANGED"
  done
fi

# fixture proof for the same conforming head built by P03: S6 task lines survive and the AC line is identical
tasks_of() { awk '/^### M2-S6 /{s=1;next} s&&/^### /{exit} s&&/^- Tasks:/{f=1;next} s&&/^- AC:/{f=0} f' "$1"; }
if [ -f /tmp/gh284/conforming-head.md ]; then
  tasks_of /tmp/gh284/conforming-base.md | sed '/^[[:space:]]*$/d' | LC_ALL=C sort > /tmp/gh284/fix-t-base.txt
  tasks_of /tmp/gh284/conforming-head.md | sed '/^[[:space:]]*$/d' | LC_ALL=C sort > /tmp/gh284/fix-t-head.txt
  fm=$(comm -23 /tmp/gh284/fix-t-base.txt /tmp/gh284/fix-t-head.txt | wc -l)
  fab=$(grep -m1 -- '^- AC:' /tmp/gh284/conforming-base.md); fah=$(grep -m1 -- '^- AC:' /tmp/gh284/conforming-head.md)
  echo "fixture_task_lines_missing=$fm"
  fb=$(tasks_of /tmp/gh284/conforming-base.md | grep -c '[^[:space:]]'); fh=$(tasks_of /tmp/gh284/conforming-head.md | grep -c '[^[:space:]]')
  echo "fixture_s6_task_lines=$fb->$fh"
  [ "$fab" = "$fah" ] && echo "fixture_ac_identity=identical" || echo "fixture_ac_identity=CHANGED"
  [ "$fm" -eq 0 ] && [ "$fab" = "$fah" ] && echo "fixture_p08=OK" || echo "fixture_p08=FAILED"
else echo "fixture_p08=SKIPPED (run P03 first)"; fi
```

**P09 — headings, codes, order, and retirement note**

```bash
grep '^### ' /tmp/gh284/base-backlog.md | LC_ALL=C sort > /tmp/gh284/h-base.txt
grep '^### ' "$BL" | LC_ALL=C sort > /tmp/gh284/h-head.txt
base_h=$(cat /tmp/gh284/h-base.txt); head_h=$(cat /tmp/gh284/h-head.txt)
newonly=$(comm -13 /tmp/gh284/h-base.txt /tmp/gh284/h-head.txt)
dangling=$(printf '%s\n' "$newonly" | grep -vE '^### M2-S(11|12|13|14|15|16|17) ' | sed '/^$/d' | wc -l)
removed=$(comm -23 /tmp/gh284/h-base.txt /tmp/gh284/h-head.txt | wc -l)
echo "base_headings=$(printf '%s\n' "$base_h" | wc -l) head_headings=$(printf '%s\n' "$head_h" | wc -l) added=$(( $(printf '%s\n' "$newonly" | sed '/^$/d' | wc -l) )) removed=$removed unexpected=$dangling"
rel() { awk '/^Note: the M1 redefinition moved the queue/{f=1} f{print} f&&/M2 stories keep their codes\./{exit}' "$1"; }
rel /tmp/gh284/base-backlog.md > /tmp/gh284/rel-base.txt; rel "$BL" > /tmp/gh284/rel-head.txt
cmp -s /tmp/gh284/rel-base.txt /tmp/gh284/rel-head.txt && echo "retirement_note=identical" || echo "retirement_note=CHANGED"
# original relative order of base headings preserved in head?
mapfile -t bh < <(grep '^### ' /tmp/gh284/base-backlog.md); i=0; order=OK
for h in "${bh[@]}"; do j=$(awk -v h="$h" '$0==h{print NR; exit}' "$BL"); [ "$j" -lt "$i" ] && order=FAIL; i=$j; done
echo "order=$order"
# mutation self-test
sed 's/^### M2-S3 Ceremony runner/### M2-S3 Ceremony runner (mut)/' "$BL" > /tmp/gh284/mut-heading.md
grep '^### ' /tmp/gh284/mut-heading.md | LC_ALL=C sort > /tmp/gh284/h-mut.txt; comm -13 /tmp/gh284/h-base.txt /tmp/gh284/h-mut.txt | sed '/^$/d' | grep -q 'Ceremony runner (mut)' && echo "negative_control=detected" || echo "negative_control=FAILED"
```

**P10 — frontmatter, reading guide, cross-cutting principles**

```bash
fm() { awk 'NR==1&&$0=="---"{f=1} f{print} f&&NR>1&&$0=="---"{exit}' "$1"; }
rg() { awk '/^## Reading guide/{f=1} /^## Cross-cutting principles/{exit} f{print}' "$1"; }
cc() { awk '/^## Cross-cutting principles/{f=1} /^## Epic M0:/{exit} f{print}' "$1"; }
for r in fm rg cc; do $r /tmp/gh284/base-backlog.md > /tmp/gh284/$r-base.txt; $r "$BL" > /tmp/gh284/$r-head.txt; cmp -s /tmp/gh284/$r-base.txt /tmp/gh284/$r-head.txt && echo "$r=byte-identical" || echo "$r=CHANGED"; done
```

**P11 — header truth, proposal tail, preserved clauses, no Current**

```bash
echo "pages=$(ls "$M1"/*.md | wc -l)"
echo "M1_planned_hits=$(grep -l 'M1 planned' "$M1"/*.md | wc -l) M1_milestone_planned_hits=$(grep -l 'M1 milestone planned' "$M1"/*.md | wc -l)"
declare -A NEED=(
 [board.md]='M1-S5 GH-229' [doctor.md]='M1-S3 GH-224' [mcp.md]='M1-S7 GH-231' [state.md]='M1-S2 GH-222'
 [merge.md]='M1-S4 GH-225' [verify-deploy.md]='M1-S4 GH-225' [watchdog.md]='M1-S1 GH-221' [blockers.md]='M1-S16 GH-230'
 [retro.md]='M1-S8 GH-232' [commit.md]='M1-S14 GH-227' [plan.md]='M1-S13 GH-226' [verify-gates.md]='M1-S4 GH-225'
 [closeout.md]='M1-S12 GH-240' [daemon.md]='M1-S18 GH-238')
declare -A REM=([board.md]='M2-S4' [watchdog.md]='M2-S2' [mcp.md]='M3-S2')
p11_check() { # $1 = m1 commands dir
  local M="$1" p hdr hdrf miss has_tail has_rem WD vg co ok=0 tail_viol=0 current_viol=0
  for p in "${!NEED[@]}"; do
    hdr=$(awk '/^## /{exit} {print}' "$M/$p"); hdrf=$(printf '%s' "$hdr" | tr '\n' ' ')
    miss=""; for tok in ${NEED[$p]}; do printf '%s' "$hdr" | grep -Fq -- "$tok" || miss="$miss $tok"; done
    [ -z "$miss" ] && ok=$((ok+1)) || echo "$p missing:$miss"
    printf '%s' "$hdrf" | grep -Eiq '(^|[^A-Za-z])Current([^A-Za-z]|$)' && { current_viol=$((current_viol+1)); echo "$p Current claim (violation)"; }
    has_tail=0; printf '%s' "$hdrf" | grep -Eiq 'Proposed[[:space:]]+(contract|examples)' && has_tail=1
    has_rem=0; [ -n "${REM[$p]:-}" ] && printf '%s' "$hdrf" | grep -Fq -- "${REM[$p]}" && has_rem=1
    if [ "$has_tail" -eq 1 ] && [ "$has_rem" -eq 0 ]; then tail_viol=$((tail_viol+1)); echo "$p tail without remainder (violation)"; fi
    if [ -n "${REM[$p]:-}" ] && [ "$has_rem" -eq 0 ]; then echo "$p remainder missing"; fi
  done
  echo "header_attribution=$ok/14 forbidden_phrase_pages=$(( $(grep -l 'M1 planned' "$M"/*.md | wc -l) + $(grep -l 'M1 milestone planned' "$M"/*.md | wc -l) ))"
  echo "tail_violations=$tail_viol current_violations=$current_viol"
  WD=$(awk '/^## /{exit} {print}' "$M/watchdog.md" | tr '\n' ' ')
  printf '%s' "$WD" | grep -Fq 'M1-S15 adds progress signals' && echo "watchdog_m1s15=OK" || echo "watchdog_m1s15=MISSING"
  printf '%s' "$WD" | grep -Fq 'SC-M1-14' && echo "watchdog_sc=OK" || echo "watchdog_sc=MISSING"
  vg=$(awk '/^## /{exit} {print}' "$M/verify-gates.md" | tr '\n' ' '); printf '%s' "$vg" | grep -q 'M1-S4' && printf '%s' "$vg" | grep -Eiq 'extend|extension' && echo "verify_gates_extension=OK" || echo "verify_gates_extension=MISSING"
  co=$(awk '/^## /{exit} {print}' "$M/closeout.md" | tr '\n' ' '); printf '%s' "$co" | grep -q 'M1-S12' && printf '%s' "$co" | grep -Eiq 'expand|expansion' && echo "closeout_extension=OK" || echo "closeout_extension=MISSING"
  [ "$ok" -eq 14 ] && [ "$tail_viol" -eq 0 ] && [ "$current_viol" -eq 0 ] && [ "$(grep -l 'M1 planned' "$M"/*.md | wc -l)" -eq 0 ] && [ "$(grep -l 'M1 milestone planned' "$M"/*.md | wc -l)" -eq 0 ]
}
p11_check "$M1" && echo "real_headers=PASS" || echo "real_headers=FAIL"
# conforming fixture from the readiness sweep, if present
if [ -d /tmp/sb/doc/planning/oss-tooling/milestones/m1/commands ]; then
  p11_check /tmp/sb/doc/planning/oss-tooling/milestones/m1/commands && echo "fixture_conforming=PASS" || echo "fixture_conforming=FAIL"
  rm -rf /tmp/gh284/p11-neg; cp -r /tmp/sb/doc/planning/oss-tooling/milestones/m1/commands /tmp/gh284/p11-neg
  sed -i '3s/.*/Status: Current (GH-224); Delivered M1-S3./' /tmp/gh284/p11-neg/doctor.md
  p11_check /tmp/gh284/p11-neg > /tmp/gh284/p11-neg.out || true
  grep -q 'doctor.md Current claim (violation)' /tmp/gh284/p11-neg.out && grep -q 'current_violations=1' /tmp/gh284/p11-neg.out && echo "fixture_current_negative=detected" || echo "fixture_current_negative=FAILED"
else echo "fixture_conforming=SKIPPED (no /tmp/sb)"; fi
```

**P12 — remainder pointers on board/watchdog/mcp**

```bash
for pair in 'board.md M2-S4' 'watchdog.md M2-S2' 'mcp.md M3-S2'; do p=${pair%% *}; t=${pair##* }; hdr=$(awk '/^## /{exit} {print}' "$M1/$p"); printf '%s' "$hdr" | grep -Fq -- "$t" && echo "$p -> $t OK" || echo "$p -> $t MISSING"; done
```

**P13 — daemon header and body preservation**

```bash
hdr=$(awk '/^## /{exit} {print}' "$M1/daemon.md")
for t in 'M1-S18' 'GH-238' 'not mounted' 'entrypoint delta'; do printf '%s' "$hdr" | grep -Fiq -- "$t" && echo "header $t OK" || echo "header $t MISSING"; done
printf '%s' "$hdr" | grep -Fq 'Current' && echo "header Current=PRESENT (forbidden)" || echo "header Current=ABSENT"
body() { awk 'f{print} /^## /{f=1;print}' "$1"; }
git show "$BASE:$M1/daemon.md" > /tmp/gh284/base-daemon.md
cmp -s <(body /tmp/gh284/base-daemon.md) <(body "$M1/daemon.md") && echo "daemon_body=byte-identical" || echo "daemon_body=CHANGED"
```

**P14 — status-header-only hunk containment**

```bash
page_guard() { # $1 page path
  local f="$1" hend h c d last inside=0 outside=0
  hend=$(awk '/^## /{print NR; exit}' "$f"); [ -z "$hend" ] && hend=99999
  while IFS= read -r h; do
    case "$h" in '@@'*) ;; *) continue ;; esac
    c=$(printf '%s\n' "$h" | sed -E 's/^@@ -[0-9]+(,[0-9]+)? \+([0-9]+)(,([0-9]+))? @@.*/\2/')
    d=$(printf '%s\n' "$h" | sed -E 's/^@@ -[0-9]+(,[0-9]+)? \+([0-9]+)(,([0-9]+))? @@.*/\4/'); [ -z "$d" ] && d=1
    last=$(( c + d - 1 ))
    if [ "$c" -ge 1 ] && [ "$last" -le "$hend" ]; then inside=$((inside+1)); else outside=$((outside+1)); echo "OUTSIDE $f: $h (header 1..$hend)"; fi
  done
  echo "$inside $outside"
}
changed_pages=0; total_hunks=0; bad=0
for p in "${!NEED[@]}"; do
  n=$(git diff -U0 "$BASE"...HEAD -- "$M1/$p" | grep -cE '^@@' || true); total_hunks=$((total_hunks+n))
  if [ "$n" -ge 1 ]; then changed_pages=$((changed_pages+1)); res=$(git diff -U0 "$BASE"...HEAD -- "$M1/$p" | grep -E '^@@' | page_guard "$M1/$p"); echo "$p $res"; fi
done
echo "changed_pages=$changed_pages/14 total_hunks=$total_hunks"
# entrypoint: exactly one changed sentence
dd=$(git diff -U0 "$BASE"...HEAD -- "$M1/entrypoint.md" | grep -cE '^@@' || true); echo "entrypoint_hunks=$dd"
# classifier self-test
hend=$(awk '/^## /{print NR; exit}' "$M1/board.md")
printf '@@ -3,1 +3,1 @@\n' | page_guard "$M1/board.md" | tail -1 | grep -q ' 0$' && echo "classifier_inside=OK" || echo "classifier_inside=FAIL"
printf '@@ -%d,1 +%d,1 @@\n' "$((hend+2))" "$((hend+2))" | page_guard "$M1/board.md" | tail -1 | grep -q ' 1$' && echo "classifier_outside=OK" || echo "classifier_outside=FAIL"
[ "$changed_pages" -ge 1 ] && echo "non_vacuous=yes" || echo "non_vacuous=no (no page changed)"
```

**P15 — entrypoint composition and absent set**

```bash
pnpm exec delivery-os --help > /tmp/gh284/help.txt 2>&1
awk '/^Commands:/{f=1;next} f&&NF{print $1}' /tmp/gh284/help.txt | LC_ALL=C sort -u > /tmp/gh284/families.txt
echo "observed_families=$(wc -l < /tmp/gh284/families.txt)"
flat=$(desc "$M1/entrypoint.md" | tr '\n' ' ' | sed 's/  */ /g')
comp=$(printf '%s' "$flat" | sed -E 's/.*command set: ([^.]*)\. .*/\1/')
printf '%s' "$comp" | grep -oE '`[a-z-]+`' | tr -d '`' | LC_ALL=C sort -u > /tmp/gh284/composed.txt
echo "enumerated_families=$(wc -l < /tmp/gh284/composed.txt): $(tr '\n' ' ' < /tmp/gh284/composed.txt)"
echo "families_not_enumerated=$(comm -23 /tmp/gh284/families.txt /tmp/gh284/composed.txt | tr '\n' ' ')"
echo "enumerated_not_observed=$(comm -13 /tmp/gh284/families.txt /tmp/gh284/composed.txt | tr '\n' ' ')"
notreg=$(printf '%s' "$flat" | tr '.' '\n' | grep -i 'not registered' | head -1)
printf '%s' "$notreg" | grep -Eiq '`state`' && echo "not_registered: state OK" || echo "not_registered: state MISSING"
printf '%s' "$notreg" | grep -Eiq '`mcp`' && echo "not_registered: mcp OK" || echo "not_registered: mcp MISSING"
printf '%s' "$notreg" | grep -Eiq 'resident daemon' && echo "not_registered: resident daemon OK" || echo "not_registered: resident daemon MISSING"
printf '%s' "$notreg" | grep -Eiq '`dispatch`' && echo "dispatch=claimed-not-registered (FAIL)" || echo "dispatch=not-claimed-absent OK"
printf '%s' "$comp" | grep -Eiq 'not registered' && echo "enumeration_contains_registration=FAIL" || echo "enumeration_contains_registration=OK"
printf '%s' "$notreg" | grep -Eiq '`retro`' && echo "registration_contains_enumeration=FAIL" || echo "registration_contains_enumeration=OK"
extra=""; for f in $(cat /tmp/gh284/families.txt); do case "$f" in state|mcp) ;; *) printf '%s' "$notreg" | grep -Eiq "\`$f\`" && extra="$extra $f" ;; esac; done
echo "not_registered_extra_families=${extra:-none}"
git show "$BASE:$M1/entrypoint.md" > /tmp/gh284/base-entrypoint.md
if entrypoint_oracle /tmp/gh284/base-entrypoint.md "$M1/entrypoint.md"; then eb=1; else eb=0; fi
echo "entrypoint_bound=$([ "$eb" -eq 1 ] && echo OK || echo FAILED) (one contiguous hunk, <=2 adjacent sentences)"
# two-sentence oracle self-tests on synthetic DESCRIPTION pairs
printf '## DESCRIPTION\nIt composes exactly the command set: `a`, `b`. `state` is not registered.\n## OPTIONS\n' > /tmp/gh284/f-good-base.md
printf '## DESCRIPTION\nIt composes exactly the command set: `a`, `b`, `dispatch`, `coordinator`. `state`, `mcp`, and the resident daemon are not registered.\n## OPTIONS\n' > /tmp/gh284/f-good-head.md
entrypoint_oracle /tmp/gh284/f-good-base.md /tmp/gh284/f-good-head.md >/dev/null && echo "positive_two_sentence=OK" || echo "positive_two_sentence=FAILED"
printf '## DESCRIPTION\nIt composes exactly the command set: `a`, `b`, `dispatch`, `coordinator`, and `state` are not registered.\n## OPTIONS\n' > /tmp/gh284/f-merged-head.md
entrypoint_oracle /tmp/gh284/f-good-base.md /tmp/gh284/f-merged-head.md >/dev/null && echo "negative_merged=NOT detected" || echo "negative_merged=detected"
[ "$(wc -l < /tmp/gh284/composed.txt)" -eq 16 ] && [ -z "$(comm -23 /tmp/gh284/families.txt /tmp/gh284/composed.txt)" ] && [ -z "$(comm -13 /tmp/gh284/families.txt /tmp/gh284/composed.txt)" ] && [ "$extra" = "" ] && printf '%s' "$notreg" | grep -Eiq '`state`' && printf '%s' "$notreg" | grep -Eiq '`mcp`' && printf '%s' "$notreg" | grep -Eiq 'resident daemon' && ! printf '%s' "$notreg" | grep -Eiq '`dispatch`' && [ "$eb" -eq 1 ] && echo "P15 verdict: PASS" || echo "P15 verdict: FAIL (change absent)"
```

**P16 — new dated M2 status snapshot**

```bash
maps=(); while IFS= read -r h; do grep -Fxq "$h" /tmp/gh284/base-status.md || maps+=("$h"); done < <(grep '^## ' "$ST")
echo "new_sections=${#maps[@]}"
sec=""; for h in "${maps[@]}"; do printf '%s' "$h" | grep -q '2026-11-10' && sec="$h"; done
if [ -z "$sec" ]; then echo "2026-11-10 section=absent"; echo "P16 verdict: FAIL (change absent)"; else
  body=$(section "$ST" "$sec" | tr '\n' ' ')
  for t in '23 of 23|23/23' 'S2.S10|S2–S10' 'S11.S17|S11–S17' 'S1' 'retired' 'M2-S4' 'M2-S6' '#268' '#280' 'maintenance' 'not milestone exit'; do printf '%s' "$body" | grep -Eiq -- "$t" && echo "$t OK" || echo "$t MISSING"; done
  printf '%s' "$body" | grep -Fq '23 of 23|23/23' && echo "literal_pipe=PRESENT (FAIL)" || echo "literal_pipe=ABSENT"
  printf '%s' "$body" | grep -Eiq 'milestone exit (met|complete|achieved)' && echo "exit_overclaim=PRESENT (FAIL)" || echo "exit_overclaim=ABSENT"
fi
# alternation self-test: the old escaped form never matched prose; the real alternation does
printf 'M1 delivered 23 of 23 stories through the lifecycle\n' > /tmp/gh284/p16-fixture.md
grep -Eiq '23 of 23|23/23' /tmp/gh284/p16-fixture.md && echo "alternation_self_test=OK" || echo "alternation_self_test=FAILED"
```

**P17 — four pointer insertions**

```bash
ptr() { printf '%s' "$1" | grep -q '2026-11-10'; }
base_title=$(head -1 /tmp/gh284/base-status.md); head_title=$(head -1 "$ST")
echo "title_base_retained=$(printf '%s' "$head_title" | grep -Fq -- "$base_title" && echo yes || echo no)"
echo "title_pointer=$(ptr "$(sed -n '1,4p' "$ST")" && echo yes || echo no)"
g2s=$(grep -n 'M1 delivery starts now and runs beside' /tmp/gh284/base-status.md | cut -d: -f1)
bs=$(sed -n "${g2s},$((g2s+5))p" /tmp/gh284/base-status.md)
echo "g2_bytes_retained=$(grep -Fq -- "$bs" "$ST" && echo yes || echo no)"
pos=$(grep -n -F 'M1 delivery starts now and runs beside' "$ST" | head -1 | cut -d: -f1)
echo "g2_pointer=$(ptr "$(sed -n "${pos},$((pos+8))p" "$ST")" && echo yes || echo no)"
h3='## M1 delivery: scheduling engine delivered (2026-11-07)'
section "$ST" "$h3" > /tmp/gh284/g3.txt
g3b=0; grep -Fq -- "$(cat /tmp/gh284/g3.txt)" "$ST" && g3b=1
echo "g3_bytes_retained=$([ "$g3b" -eq 1 ] && echo yes || echo no)"
echo "g3_pointer=$(ptr "$(cat /tmp/gh284/g3.txt)" && echo yes || echo no)"
awk '/^1\. \*\*Start the dual-run pilot now\*\*/{f=1} /^4\. \*\*Memory consolidation pass\*\*/{f=0} f' /tmp/gh284/base-status.md > /tmp/gh284/g4.txt
g4b=0; grep -Fq -- "$(cat /tmp/gh284/g4.txt)" "$ST" && g4b=1
echo "g4_bytes_retained=$([ "$g4b" -eq 1 ] && echo yes || echo no)"
g4p=0; g4s=$(grep -n '3\. \*\*M1 delivery start\*\*' "$ST" | cut -d: -f1); g4e=$(grep -n '^4\. \*\*Memory consolidation pass' "$ST" | cut -d: -f1)
[ -n "$g4s" ] && [ -n "$g4e" ] && ptr "$(sed -n "${g4s},$((g4e-1))p" "$ST")" && g4p=1
echo "g4_pointer=$g4p/1"
```

**P18 — whole-file line retention**

```bash
head_line_for_base() { # $1=base $2=head $3=base line; pure insertions only (retention precondition)
  local b="$3" off
  off=$(diff -U0 "$1" "$2" | sed -nE 's/^@@ -([0-9]+)(,([0-9]+))? \+([0-9]+)(,([0-9]+))? @@.*/\1 \6/p' \
    | awk -v b="$b" '{a=$1+0; d=($2==""?1:$2); if (a < b) s+=d} END{print s+0}')
  echo $(( b + off ))
}
retention_oracle() { # $1=base file, $2=head file
  local base="$1" head="$2" removed added newsec newsec_end
  removed=$(diff --old-line-format='%L' --new-line-format='' --unchanged-line-format='' "$base" "$head" | wc -l)
  added=$(diff --old-line-format='' --new-line-format='%L' --unchanged-line-format='' "$base" "$head" | wc -l)
  newsec=$(grep -n '^## .*2026-11-10' "$head" | head -1 | cut -d: -f1)
  if [ -n "$newsec" ]; then newsec_end=$(awk -v s="$newsec" 'NR>s && /^## /{print NR-1; exit}' "$head"); [ -z "$newsec_end" ] && newsec_end=$(wc -l < "$head"); else newsec=0; newsec_end=-1; fi
  # Pointer windows are anchored to the BASE statement ends and mapped through the
  # insertion offset, so an appended pointer cannot become the "last non-blank line"
  # and shift its own window past itself (D6).
  local bp bp2 bpe bg3 bg3e bg3last bg4 bg4e hpe hg3 hg4
  bp2=$(grep -n 'M1 delivery starts now and runs beside' "$base" | head -1 | cut -d: -f1)
  bpe=$(awk -v s="${bp2:-1}" 'NR>=s && NF==0{print NR-1; exit}' "$base"); [ -z "$bpe" ] && bpe=${bp2:-0}
  bg3=$(grep -n '^## M1 delivery: scheduling engine delivered (2026-11-07)' "$base" | cut -d: -f1)
  bg3e=$(awk -v s="${bg3:-1}" 'NR>s && /^## /{print NR-1; exit}' "$base")
  bg3last=$(awk -v s="${bg3:-1}" -v e="${bg3e:-0}" 'NR>=s && NR<=e && NF>0{l=NR} END{print l+0}' "$base")
  bg4=$(grep -n '^4\. \*\*Memory consolidation pass' "$base" | head -1 | cut -d: -f1)
  bg4e=$(awk -v s="${bg4:-1}" 'NR<s && NF>0{l=NR} END{print l+0}' "$base")
  hpe=$(head_line_for_base "$base" "$head" "$bpe")
  hg3=$(head_line_for_base "$base" "$head" "$bg3last")
  hg4=$(head_line_for_base "$base" "$head" "$bg4e")
  local w1s=2 w1e=4 w2s w2e w3s w3e w4s w4e
  w2s=$((hpe+1)); w2e=$((hpe+3)); w3s=$((hg3+1)); w3e=$((hg3+3)); w4s=$((hg4+1)); w4e=$((hg4+3))
  echo "windows(base-anchored): newsec=${newsec:-0}..${newsec_end} title=$w1s..$w1e paragraph=$w2s..$w2e scheduling=$w3s..$w3e items=$w4s..$w4e"
  local -a alines; mapfile -t alines < <(diff -U0 "$base" "$head" | awk '
    /^@@/ { l=$0; sub(/^@@ -[0-9]+(,[0-9]+)? \+/,"",l); sub(/ .*/,"",l); sub(/,.*/,"",l); c=l+0; next }
    /^\+/ && !/^\+\+\+/ { print c; c++ }')
  local -a runs=(); local start prev n a b len text nonblank ws we w
  if [ ${#alines[@]} -gt 0 ]; then
    start=${alines[0]}; prev=$start
    for n in "${alines[@]:1}"; do
      if [ "$n" -eq "$((prev+1))" ]; then prev=$n; else runs+=("$start:$prev"); start=$n; prev=$n; fi
    done
    runs+=("$start:$prev")
  fi
  # pointer runs: at most 3 non-blank text lines (a separator blank line does not count)
  local section_lines=0 pointer_runs=0 bad_runs=0 in; declare -A hit=()
  for r in "${runs[@]}"; do
    a=${r%%:*}; b=${r##*:}; len=$(( b - a + 1 )); in=0
    if [ "$newsec" -gt 0 ] && [ "$a" -ge "$newsec" ] && [ "$b" -le "$newsec_end" ]; then section_lines=$((section_lines+len)); in=1
    else
      for w in "$w1s:$w1e" "$w2s:$w2e" "$w3s:$w3e" "$w4s:$w4e"; do
        ws=${w%%:*}; we=${w##*:}
        if [ "$a" -ge "$ws" ] && [ "$b" -le "$we" ] && [ "$len" -le 4 ]; then
          text=$(sed -n "${a},${b}p" "$head"); nonblank=$(printf '%s\n' "$text" | grep -c '[^[:space:]]')
          if [ "$nonblank" -le 3 ] && printf '%s' "$text" | grep -q '2026-11-10'; then pointer_runs=$((pointer_runs+1)); hit[$w]=1; in=1; fi
        fi
        [ "$in" -eq 1 ] && break
      done
    fi
    [ "$in" -eq 0 ] && { bad_runs=$((bad_runs+1)); echo "OUTSIDE: added lines $a..$b"; }
  done
  local pointer_windows=${#hit[@]}
  echo "retention: removed_lines=$removed added_lines=$added"
  echo "whitelist: section_lines=$section_lines pointer_runs=$pointer_runs pointer_windows=$pointer_windows bad_runs=$bad_runs"
  [ "$removed" -eq 0 ] && [ "$added" -gt 0 ] && [ "$bad_runs" -eq 0 ] && [ "$pointer_runs" -eq 4 ] && [ "$pointer_windows" -eq 4 ] && [ "$section_lines" -gt 0 ]
}
if retention_oracle /tmp/gh284/base-status.md "$ST"; then ro=1; else ro=0; fi
echo "retention_oracle=$([ "$ro" -eq 1 ] && echo OK || echo FAILED)"
echo "oracle=whole-file-line-retention (whole-section cmp not used)"
# self-tests: modified base line and outside append are rejected; a <=3-line title pointer is accepted
sed 's/^Date: 2026-11-01/Date: 2026-11-02/' /tmp/gh284/base-status.md > /tmp/gh284/f-mod.md
retention_oracle /tmp/gh284/base-status.md /tmp/gh284/f-mod.md > /tmp/gh284/st-mod.txt; grep -q 'removed_lines=1' /tmp/gh284/st-mod.txt && echo "negative_modified=detected" || echo "negative_modified=FAILED"
cp /tmp/gh284/base-status.md /tmp/gh284/f-out.md; echo "random line" >> /tmp/gh284/f-out.md
retention_oracle /tmp/gh284/base-status.md /tmp/gh284/f-out.md > /tmp/gh284/st-out.txt; grep -q 'bad_runs=1' /tmp/gh284/st-out.txt && echo "negative_outside=detected" || echo "negative_outside=FAILED"
cp /tmp/gh284/base-status.md /tmp/gh284/f-ptr.md; sed -i '2i See the 2026-11-10 M2 planning snapshot.' /tmp/gh284/f-ptr.md
retention_oracle /tmp/gh284/base-status.md /tmp/gh284/f-ptr.md > /tmp/gh284/st-ptr.txt; grep -q 'pointer_runs=1' /tmp/gh284/st-ptr.txt && echo "positive_pointer=permitted" || echo "positive_pointer=FAILED"
# reference-shaped head fixture: four pointers plus a new dated section; must be accepted
cp /tmp/gh284/base-status.md /tmp/gh284/f-ref.md
p2b=$(grep -n 'M1 delivery starts now and runs beside' /tmp/gh284/f-ref.md | head -1 | cut -d: -f1)
p2e=$(awk -v s="$p2b" 'NR>=s && NF==0{print NR-1; exit}' /tmp/gh284/f-ref.md)
g3b=$(grep -n '^## M1 delivery: scheduling engine delivered (2026-11-07)' /tmp/gh284/f-ref.md | cut -d: -f1)
g3e=$(awk -v s="$g3b" 'NR>s && /^## /{print NR-1; exit}' /tmp/gh284/f-ref.md)
g3l=$(awk -v s="$g3b" -v e="$g3e" 'NR>=s && NR<=e && NF>0{l=NR} END{print l+0}' /tmp/gh284/f-ref.md)
g4b=$(grep -n '^4\. \*\*Memory consolidation pass' /tmp/gh284/f-ref.md | cut -d: -f1)
g4e=$(awk -v s="$g4b" 'NR<s && NF>0{l=NR} END{print l+0}' /tmp/gh284/f-ref.md)
for spec in "$g3l:See the 2026-11-10 M2 planning snapshot." "$g4e:See the 2026-11-10 M2 planning snapshot." "$p2e:See the 2026-11-10 M2 planning snapshot." "1:M2 planning snapshot pointer: see 2026-11-10."; do
  ln=${spec%%:*}; txt=${spec#*:}; sed -i "$((ln+1))i $txt" /tmp/gh284/f-ref.md
done
printf '## M2 planning snapshot (2026-11-10)\n\nM1 delivered 23 of 23 stories.\n' >> /tmp/gh284/f-ref.md
retention_oracle /tmp/gh284/base-status.md /tmp/gh284/f-ref.md > /tmp/gh284/st-ref.txt
sed -n 's/^whitelist: /reference_whitelist: /p' /tmp/gh284/st-ref.txt
grep -q 'pointer_runs=4' /tmp/gh284/st-ref.txt && grep -q 'pointer_windows=4' /tmp/gh284/st-ref.txt && grep -q 'bad_runs=0' /tmp/gh284/st-ref.txt && echo "reference_head_fixture=OK" || { echo "reference_head_fixture=FAILED"; cat /tmp/gh284/st-ref.txt; }
[ "$ro" -eq 1 ] && echo "P18 verdict: PASS" || echo "P18 verdict: FAIL (vacuous: no added line)"
```

**P19 — pack set, README deviation, table identity**

```bash
wantfiles=(README.md architecture.md contracts.md test-scenarios.md journeys.md entrypoint-delta.md commands/projects.md commands/attempts.md commands/events.md commands/spend.md commands/queue.md commands/board.md)
have=0
for f in "${wantfiles[@]}"; do [ -f "$M2/$f" ] && have=$((have+1)); done
actual=0; [ -d "$M2" ] && actual=$(find "$M2" -type f | wc -l)
echo "pack_files=$have/12 actual_files=$actual (expected 12)"
check_readme_link() { # $1 readme, $2 target; no parent-directory escape
  if [ "$2" = README.md ]; then
    grep -Eq '^\|[[:space:]]*`?README\.md`?[[:space:]]*\|' "$1" || grep -Eq '\]\(\./README\.md\)|\]\(README\.md\)' "$1"
  else
    grep -Eq "\]\((\./)?$2\)" "$1"
  fi
}
if [ -f "$M2/README.md" ]; then
  listed=0; for f in "${wantfiles[@]}"; do check_readme_link "$M2/README.md" "$f" && listed=$((listed+1)); done
  echo "readme_lists=$listed/12 story_map_entries=$(grep -cE 'M2-S[0-9]+' "$M2/README.md")"
  dev=0
  grep -Eiq 'man-page\.md' "$M2/README.md" && grep -Eiq 'interactions\.md' "$M2/README.md" && grep -Eiq 'entrypoint-delta\.md' "$M2/README.md" && grep -Eiq 'deviat|deliberate' "$M2/README.md" && dev=1
  echo "deviation_statement=$([ "$dev" -eq 1 ] && echo OK || echo MISSING)"
else echo "README=absent"; fi
# self-test: a parent-escape link must not satisfy the self-entry
printf '| `README.md` | map |\n' > /tmp/gh284/readme-good.md
printf '| [x](../README.md) |\n' > /tmp/gh284/readme-bad.md
check_readme_link /tmp/gh284/readme-good.md README.md && check_readme_link /tmp/gh284/readme-bad.md README.md && echo "readme_self_link_self_test=FAILED" || echo "readme_self_link_self_test=detected"
table() { awk '/^## Pack contents/{f=1} /^## Conventions/{exit} f' "$1"; }
git show "$BASE:$MR" > /tmp/gh284/base-milestones-README.md
table /tmp/gh284/base-milestones-README.md > /tmp/gh284/tbl-b.txt; table "$MR" > /tmp/gh284/tbl-h.txt
cmp -s /tmp/gh284/tbl-b.txt /tmp/gh284/tbl-h.txt && echo "pack_contents_table=byte-identical" || echo "pack_contents_table=CHANGED"
```

**P20 — architecture levels and flows**

```bash
if [ ! -f "$M2/architecture.md" ]; then echo "architecture=absent"; else
  f="$M2/architecture.md"
  for t in 'C4 Level 1' 'C4 Level 2' 'C4 Level 3'; do grep -Eq "^## .*$t" "$f" && echo "heading $t OK" || echo "heading $t MISSING"; done
  for t in 'multi.repo|Multi-repository' 'divergence' 'telemetry attribution' 'auto.release' 'single.flight' 'handover.gate' 'park|resume'; do grep -Eiq "^#{2,3} .*($t)" "$f" && echo "flow heading $t OK" || echo "flow heading $t MISSING"; done
  for t in 'persistence' 'concurrency' 'boundary invariants'; do grep -Eiq "^#{2,3} .*$t" "$f" && echo "delta $t OK" || echo "delta $t MISSING"; done
fi
```

**P21 — contracts surfaces**

```bash
if [ ! -f "$M2/contracts.md" ]; then echo "contracts=absent"; else
  f="$M2/contracts.md"; miss=0; flat=$(tr '\n' ' ' < "$f")
  for t in 'projects\.v1' 'attempts\.v1' 'queue\.graph' 'dispatch\.attempt' 'phase\.state' 'blockers\.state' 'event kinds' 'payload' 'ordering' 'overflow.*repoll' 'telemetry\.v1' 'ticket' 'repository' 'lane' 'agent role' 'model' 'phase timing' 'tolerance' 'release.*reason|reason.*release' 'remove.*reason|reason.*remove' 'dependency edge' 'single.flight' 'spend.*v2' 'providerProfile|provider profile' 'peak.window.*schema|schema.*peak.window' 'peak-window' 'owner-hold' 'until' 'resume event'; do
    printf '%s' "$flat" | grep -Eiq -- "$t" && miss=$((miss)) || { echo "MISSING: $t"; miss=$((miss+1)); }
  done
  echo "contract_markers_missing=$miss"
fi
```

**P22 — SC-M2 scenario inventory**

```bash
if [ ! -f "$M2/test-scenarios.md" ]; then echo "test-scenarios=absent"; else
  f="$M2/test-scenarios.md"
  echo "scenario_headings=$(grep -c '^### SC-M2-' "$f")"
  low=0
  for s in 2 3 4 5 6 7 8 9 10 11 12 13 14 15 16 17; do
    c=$(awk -v s="M2-S$s" '
      /^### SC-M2-/{h=$0; nxt=""; getline nxt; blob=h " " nxt; if (blob ~ ("(^|[^0-9])" s "([^0-9]|$)")) c++; next}
      END{print c+0}' "$f")
    echo "S$s=$c"; [ "$c" -ge 2 ] || low=$((low+1))
  done
  echo "stories_below_two=$low total_scenarios=$(grep -c '^### SC-M2-' "$f")"
  for t in 'same.ref' 'local.evidence' 'topic contract|contract compliance' 'tolerance' 'auto.release' 'single.flight' 'per.condition|per condition' 'park.*peak|peak.*park' 'other provider|provider isolation' 'resume.*state|state loss' 'zero.spend' 'daemon.absent'; do
    tr '\n' ' ' < "$f" | grep -Eiq -- "$t" && echo "mandatory $t OK" || echo "mandatory $t MISSING"
  done
fi
```

**P23 — journeys**

```bash
if [ ! -f "$M2/journeys.md" ]; then echo "journeys=absent"; else
  f="$M2/journeys.md"
  echo "journey_headings=$(grep -c '^## ' "$f")"
  for t in 'multi.repo.*morning|morning.*multi.repo' 'evidence.*handover|handover.*evidence' 'retro.*telemetry|telemetry.*retro' 'steer' 'peak.*park|cost.control'; do
    grep -Eiq -- "$t" "$f" && echo "$t OK" || echo "$t MISSING"
  done
  grep -Eiq 'resume' "$f" && echo "cost-control resume OK" || echo "cost-control resume MISSING"
  grep -Eiq 'other provider|another provider' "$f" && echo "cost-control isolation OK" || echo "cost-control isolation MISSING"
fi
```

**P24 — six command page headers**

```bash
cmds=(projects attempts events spend queue board); ok=0
for c in "${cmds[@]}"; do f="$M2/commands/$c.md"; [ -f "$f" ] || { echo "$c absent"; continue; }
  s=$(sed -n '3p' "$f"); h=$(head -1 "$f")
  [ "$s" = 'Status: Proposed (M2)' ] && [ "$h" = "# $c(1)" ] && grep -Fq '<binary>' "$f" && ! grep -Fq 'ados' "$f" && { ok=$((ok+1)); echo "$c header OK"; } || echo "$c header FAIL (h1='$h' status='$s')"
done
echo "command_headers=$ok/6"
```

**P25 — six command page bodies**

```bash
cmds=(projects attempts events spend queue board)
for c in "${cmds[@]}"; do f="$M2/commands/$c.md"; [ -f "$f" ] || { echo "$c absent"; continue; }
  miss=""; flat=$(tr '\n' ' ' < "$f"); for t in SYNOPSIS OPTIONS 'OUTPUT' 'EXIT STATUS' EXAMPLES 'ERROR' 'SEE ALSO' 'envelope'; do printf '%s' "$flat" | grep -Fq -- "$t" || miss="$miss $t"; done
  echo "$c missing:$miss"
done
[ -f "$M2/commands/attempts.md" ] && grep -Eiq 'dispatch.*subfamily|subfamily.*dispatch' "$M2/commands/attempts.md" && echo "attempts=dispatch subfamily OK" || echo "attempts=dispatch subfamily MISSING"
[ -f "$M2/commands/events.md" ] && grep -Eiq 'subscribe.*taxonomy' "$M2/commands/events.md" && echo "events=subscribe taxonomy OK" || echo "events=subscribe taxonomy MISSING"
```

**P26 — entrypoint delta note**

```bash
f="$M2/entrypoint-delta.md"
if [ ! -f "$f" ]; then echo "delta=absent"; else
  flat=$(tr '\n' ' ' < "$f")
  for t in 'dispatch' 'coordinator' 'state' 'mcp' 'daemon' 'unknown flag' 'unexpected argument' 'exit 1' 'outside this' 'entrypoint.md'; do printf '%s' "$flat" | grep -Fiq -- "$t" && echo "$t OK" || echo "$t MISSING"; done
fi
```

**P27 — twelve-target index row**

```bash
rowline=$(grep -n 'm2/README\.md' "$MR" | head -1 | cut -d: -f1)
if [ -z "$rowline" ]; then echo "M2 row=absent"; echo "m2_targets=0/12"; else
  line=$(sed -n "${rowline}p" "$MR")
  printf '%s' "$line" | grep -oE 'm2/[A-Za-z0-9_./-]+\.md' | sort -u > /tmp/gh284/m2-targets.txt
  echo "m2_targets=$(wc -l < /tmp/gh284/m2-targets.txt)/12"
  tr '\n' ' ' < /tmp/gh284/m2-targets.txt; echo
  for a in README.md architecture.md contracts.md test-scenarios.md journeys.md entrypoint-delta.md commands/projects.md commands/attempts.md commands/events.md commands/spend.md commands/queue.md commands/board.md; do
    grep -Fq "m2/$a" /tmp/gh284/m2-targets.txt || echo "target missing m2/$a"
  done
  grep -Eiq 'M2.*planned|planned.*M2' "$MR" && echo "m2_row_marked_planned=yes" || echo "m2_row_marked_planned=no"
fi
for row in 'M0 (trust substrate' 'M1 (delivery engine'; do b=$(grep -F "$row" /tmp/gh284/base-milestones-README.md); h=$(grep -F "$row" "$MR"); [ "$b" = "$h" ] && echo "$row row=identical" || echo "$row row=CHANGED"; done
```

**P28 — two-budget product-file containment**

```bash
PHASE7=(
 doc/spec/features/feature-cli-entrypoint.md
 doc/spec/features/feature-resident-daemon.md
 doc/overview/architecture-overview.md
)
printf '%s\n' "${PHASE7[@]}" | LC_ALL=C sort > /tmp/gh284/phase7-known.txt
# Whole change includes the working tree (base commit vs current files).
git diff --name-only "$BASE" -- . ':(exclude)doc/changes/**' | sort -u > /tmp/gh284/whole.txt
# Delivery budget = base..the last delivery commit before phase 7. When that commit is not
# supplied via DELIVERY_HEAD, it is exactly the whole change minus the three phase-7 paths.
if [ -n "${DELIVERY_HEAD:-}" ]; then
  git diff --name-only "$BASE"...$DELIVERY_HEAD -- . ':(exclude)doc/changes/**' | sort -u > /tmp/gh284/delivery.txt
  src="BASE...DELIVERY_HEAD ($DELIVERY_HEAD)"
else
  comm -23 /tmp/gh284/whole.txt /tmp/gh284/phase7-known.txt > /tmp/gh284/delivery.txt
  src="whole change minus the three phase-7 paths (equals base..the last delivery commit before phase 7)"
fi
comm -23 /tmp/gh284/whole.txt /tmp/gh284/delivery.txt > /tmp/gh284/phase7.txt
echo "delivery_range=$src"
echo "----- delivery budget -----"; cat /tmp/gh284/delivery.txt
n=$(wc -l < /tmp/gh284/delivery.txt); echo "product_files=$n"
planning=$(grep -c '^doc/planning/oss-tooling/' /tmp/gh284/delivery.txt || true)
registry=$(grep -c '^scripts/checks/forbidden-literals\.registry\.json$' /tmp/gh284/delivery.txt || true)
outside=$(grep -vcE '^doc/planning/oss-tooling/|^scripts/checks/forbidden-literals\.registry\.json$' /tmp/gh284/delivery.txt || true)
echo "planning_files=$planning registry_files=$registry outside_planning_outside_registry=$outside"
forbidden=$(grep -vE '^doc/planning/oss-tooling/|^scripts/checks/forbidden-literals\.registry\.json$' /tmp/gh284/delivery.txt | grep -cE '^(packages|tests|scripts|doc/spec|doc/overview|\.opencode|\.ai)/|(^|/)(package\.json|pnpm-lock\.yaml|tsconfig.*\.json|biome\.json|bunfig\.toml|\.dependency-cruiser\.cjs)$' || true)
echo "forbidden_root_files=$forbidden"
unexpected=$(grep '^doc/planning/oss-tooling/' /tmp/gh284/delivery.txt | grep -vcE '^doc/planning/oss-tooling/(backlog\.md|status\.md|milestones/README\.md|milestones/m1/commands/[a-z-]+\.md|milestones/m2/)' || true)
echo "unexpected_planning_paths=$unexpected"
echo "----- phase-7 budget -----"; cat /tmp/gh284/phase7.txt
spec_files=$(grep -c '^doc/spec/' /tmp/gh284/phase7.txt || true)
overview_files=$(grep -c '^doc/overview/' /tmp/gh284/phase7.txt || true)
phase7_total=$(wc -l < /tmp/gh284/phase7.txt)
phase7_extra=$(( phase7_total - 3 ))
phase7_unknown=$(comm -23 /tmp/gh284/phase7.txt /tmp/gh284/phase7-known.txt | wc -l)
echo "spec_files=$spec_files overview_files=$overview_files"
echo "phase7_files=$phase7_total phase7_extra=$phase7_extra phase7_unknown_paths=$phase7_unknown"
total=$(wc -l < /tmp/gh284/whole.txt); echo "total_product_files=$total"
# negative matcher: a fourth doc/spec path is outside the allowed three
printf '%s\n' 'doc/spec/features/feature-resident-daemon.md' 'doc/spec/features/feature-other.md' | LC_ALL=C sort | comm -23 - /tmp/gh284/phase7-known.txt | grep -q '^doc/spec/' && echo "matcher_self_test=OK"
[ "$total" -ge 1 ] && echo "non_vacuous=yes" || echo "non_vacuous=no (no product file changed)"
```

**P29 — per-story body preservation**

```bash
# entry() now also stops at ^---$ and ^## (the M2-S9 block close), so the base and head
# M2-S9 entries both end at the blank before the separator instead of running into Epic M3.
p29_check() { # $1 = head file; returns 0 only when every non-amended story body matches in order
  local head="$1" tot=0 ident=0 changed=0 order=OK prev=0 h code ln
  while IFS= read -r h; do
    code=$(printf '%s' "$h" | sed -E 's/^### (M[0-9]-S[0-9]+).*/\1/')
    [ -n "${AMEND[$code]:-}" ] && continue
    [ -n "${NEW[$code]:-}" ] && continue
    ln=$(grep -n -F -- "$h" "$head" | head -1 | cut -d: -f1)
    if [ -z "$ln" ]; then changed=$((changed+1)); echo "heading missing: $h"; continue; fi
    [ "$ln" -gt "$prev" ] || order=FAIL
    prev=$ln
    tot=$((tot+1))
    entry /tmp/gh284/base-backlog.md "$h" > /tmp/gh284/e-b.txt; entry "$head" "$h" > /tmp/gh284/e-h.txt
    if cmp -s /tmp/gh284/e-b.txt /tmp/gh284/e-h.txt; then ident=$((ident+1)); else changed=$((changed+1)); echo "body CHANGED: $h"; fi
  done < <(grep '^### ' /tmp/gh284/base-backlog.md)
  echo "stories_compared=$tot identical=$ident changed=$changed order=$order"
  [ "$changed" -eq 0 ] && [ "$order" = OK ]
}
declare -A AMEND=([M2-S4]=1 [M2-S6]=1); declare -A NEW=([M2-S11]=1 [M2-S12]=1 [M2-S13]=1 [M2-S14]=1 [M2-S15]=1 [M2-S16]=1 [M2-S17]=1)
# Build the three heads the review used: minimal (stories only), full (stories + S4/S6 amendments),
# and reorder/removal/body mutants for the negative controls.
python3 - /tmp/gh284/base-backlog.md <<'PYFIX'
import sys
base = open(sys.argv[1]).read()
def block(code):
    ls = base.splitlines(keepends=True)
    st = next(i for i, l in enumerate(ls) if l.startswith(f"### {code} "))
    en = next((i for i in range(st+1, len(ls)) if ls[i].startswith("### ")), len(ls))
    return ls, st, en
stories = """### M2-S11 Multi-repository workstations
- Goal: fixture goal.
- Tasks: fixture tasks.
- AC: fixture ac.
- Depends on: M0-S5, M1-S17.
### M2-S12 Evidence inspection and divergence resolution
- Goal: fixture goal.
- Tasks: fixture tasks.
- AC: fixture ac.
- Depends on: M1-S9.
### M2-S13 Public event taxonomy
- Goal: fixture goal.
- Tasks: fixture tasks.
- AC: fixture ac.
- Depends on: M1-S18.
### M2-S14 Harness telemetry v2
- Goal: fixture goal.
- Tasks: fixture tasks.
- AC: fixture ac.
- Depends on: M1-S11, M1-S15, M1-S19, M1-S22.
### M2-S15 Queue lifecycle completion
- Goal: fixture goal.
- Tasks: fixture tasks.
- AC: fixture ac.
- Depends on: M1-S9, M1-S17, M1-S18.
### M2-S16 Engine-first delivery operations
- Goal: fixture goal.
- Tasks: fixture tasks.
- AC: fixture ac.
- Depends on: M1-S9, M1-S18, M1-S21, #280.
### M2-S17 Provider-aware peak pausing
- Goal: fixture goal.
- Tasks: fixture tasks.
- AC: fixture ac.
- Depends on: M1-S15, M1-S18, M1-S21, M1-S22, M2-S14, #280.
"""
def insert_stories(text):
    out=[]; s9=False; ins=False
    for line in text.splitlines(keepends=True):
        if line.startswith("### M2-S9 "): s9=True
        if s9 and line.rstrip()=="---" and not ins:
            out.extend(stories.splitlines(keepends=True)); ins=True
        out.append(line)
    return "".join(out)
minimal = insert_stories(base)
full = base.replace("- Depends on: M1-S5, M1-S17.\n", "- Depends on: M1-S5, M1-S17, M2-S11.\n")
ls=full.splitlines(keepends=True); out=[]; insec=False; done=False
for line in ls:
    if line.startswith("### M2-S6 "): insec=True
    if insec and line.startswith("- AC:") and not done:
        out.append("  consumes M2-S14 telemetry for per-agent and per-model facts;\n"); done=True
    out.append(line)
full = "".join(out).replace("- Depends on: M1-S19, M2-S3.\n", "- Depends on: M1-S19, M2-S3, M2-S14.\n")
full = insert_stories(full)
changed = base.replace("- Goal: Ceremonies become", "- Goal: Ceremonies become (mutated)")
ls, st, en = block("M2-S3")
removed = "".join(ls[:st] + ls[en:])
ls, st2, en2 = block("M2-S2")
rest = ls[:st2] + ls[en2:]
st3 = next(i for i, l in enumerate(rest) if l.startswith("### M2-S3 "))
en3 = next((i for i in range(st3+1, len(rest)) if rest[i].startswith("### ")), len(rest))
reordered = "".join(rest[:en3] + ls[st2:en2] + rest[en3:])
open("/tmp/gh284/head-min.md","w").write(minimal)
open("/tmp/gh284/head-full.md","w").write(full)
open("/tmp/gh284/head-changed.md","w").write(changed)
open("/tmp/gh284/head-removed.md","w").write(removed)
open("/tmp/gh284/head-reordered.md","w").write(reordered)
PYFIX
echo "-- real head --"; p29_check "$BL" && echo "real_head=PASS" || echo "real_head=FAIL"
echo "-- base control --"; p29_check /tmp/gh284/base-backlog.md && echo "base_control=PASS" || echo "base_control=FAIL"
echo "-- minimal stories-only head --"; p29_check /tmp/gh284/head-min.md && echo "minimal_head=PASS" || echo "minimal_head=FAIL"
echo "-- full amendment + stories head --"; p29_check /tmp/gh284/head-full.md && echo "full_head=PASS" || echo "full_head=FAIL"
echo "-- negatives --"
p29_check /tmp/gh284/head-changed.md >/tmp/gh284/p29-neg1.txt || true; grep -q 'changed=1' /tmp/gh284/p29-neg1.txt && echo "negative_body=detected" || echo "negative_body=FAILED"
p29_check /tmp/gh284/head-removed.md >/tmp/gh284/p29-neg2.txt || true; grep -Eq 'heading missing|changed=1' /tmp/gh284/p29-neg2.txt && echo "negative_removed=detected" || echo "negative_removed=FAILED"
p29_check /tmp/gh284/head-reordered.md >/tmp/gh284/p29-neg3.txt || true; grep -q 'order=FAIL' /tmp/gh284/p29-neg3.txt && echo "negative_reordered=detected" || echo "negative_reordered=FAILED"
```

**P30 — body byte identity and bounded entrypoint region**

```bash
body() { awk 'f{print} /^## /{f=1;print}' "$1"; }
ident=0
for p in "${!NEED[@]}"; do git show "$BASE:$M1/$p" > /tmp/gh284/b.md; cmp -s <(body /tmp/gh284/b.md) <(body "$M1/$p") && ident=$((ident+1)) || echo "$p BODY CHANGED"; done
echo "body_identical=$ident/14"
git show "$BASE:$M1/entrypoint.md" > /tmp/gh284/base-entrypoint.md
if entrypoint_oracle /tmp/gh284/base-entrypoint.md "$M1/entrypoint.md"; then eb=1; else eb=0; fi
echo "entrypoint_bound=$([ "$eb" -eq 1 ] && echo OK || echo FAILED) (one contiguous hunk, <=2 adjacent sentences, every other byte identical)"
[ "$ident" -eq 14 ] && [ "$eb" -eq 1 ] && echo "P30 verdict: PASS" || echo "P30 verdict: FAIL (entrypoint region not changed)"
```

**P31 — doc-distribution guard**

```bash
bash scripts/.tests/test-doc-distribution.sh > /tmp/gh284/guard.log 2>&1; echo "guard_exit=$?"
tail -1 /tmp/gh284/guard.log
echo "planning_markers=$(grep -rl '^ados_distribution' doc/planning/ | wc -l)"
```

**P32 — two aggregate-gate runs and classification**

```bash
REPO_ROOT=$(git rev-parse --show-toplevel)
TMPDIR_REPO="$REPO_ROOT/tmp/tmpdir"
mkdir -p "$TMPDIR_REPO"
pnpm check > /tmp/gh284/pnpm-default.log 2>&1; d=$?
TMPDIR="$TMPDIR_REPO" pnpm check > /tmp/gh284/pnpm-tmpdir.log 2>&1; t=$?
dfail=$(grep -c '^(fail)' /tmp/gh284/pnpm-default.log || true)
dnames=$(grep '^(fail)' /tmp/gh284/pnpm-default.log | sed 's/^(fail) //' | cut -c1-120 | tr '\n' ';')
dfailonly=0
[ "$dfail" -eq 1 ] && grep -q '^(fail) CI baseline parity' /tmp/gh284/pnpm-default.log && dfailonly=1
dclass=delivery
if [ "$d" -ne 0 ] && [ "$dfailonly" -eq 1 ]; then dclass='environmental (ci-baseline-parity only)'; fi
if [ "$d" -eq 0 ]; then dclass='none'; fi
echo "default_exit=$d default_failed_tests=$dfail default_failure_class=$dclass"
[ -n "$dnames" ] && echo "default_failures=$dnames"
echo "repo_tmpdir_exit=$t"
[ "$d" -eq 0 ] || [ "$dfailonly" -eq 1 ] && [ "$t" -eq 0 ] && echo "gate_verdict=PASS" || echo "gate_verdict=FAIL"
rm -rf "$TMPDIR_REPO"
```

**P33 — structural and heading association**

```bash
diagram_assoc() { # $1 = root
  local root="$1" files count c4good=0 fn fgood fbad own heads lvl
  files=$(find "$root" -name '*.md')
  count=$(grep -h '^```mermaid' $files | wc -l); echo "mermaid_fences=$count"
  [ "$count" -ge 10 ] || echo "FAIL: $count mermaid fences, need >= 10"
  # The committed heading form is `## C4 Level 1: system context` (level digit, colon, subject); the predicate tolerates a bare heading.
  for lvl in 1 2 3; do
    heads=$(grep -hE "^## C4 Level $lvl([^0-9]|$)" $files | wc -l)
    own=$(awk -v want="$lvl" '
      FNR==1 { inside=0 }
      $0 ~ "^## C4 Level " want "([^0-9]|$)" { inside=1; seen=0; next }
      /^## / { inside=0 }
      /^```mermaid/ { if (inside) seen++ }
      END { print seen+0 }' $files)
    if [ "$heads" -eq 1 ] && [ "$own" -eq 1 ]; then c4good=$((c4good+1)); echo "C4 Level $lvl has diagram=OK (heads=$heads own=$own)"; else echo "C4 Level $lvl has diagram=MISSING (heads=$heads own=$own)"; fi
  done
  echo "c4_headings_with_diagrams=$c4good/3"
  read -r fn fgood fbad <<< "$(awk '
    FNR==1 { insec=0 }
    /^## Key flows/ { insec=1; next }
    /^## / { insec=0 }
    insec && /^### / { n++; own[n]=0; next }
    insec && /^```mermaid/ { if (n) own[n]++ }
    END { good=0; bad=0; for(i=1;i<=n;i++){ if(own[i]==1) good++; else bad++ } printf "%d %d %d\n", n+0, good+0, bad+0 }' $files)"
  echo "flow_headings=${fn:-0}"
  echo "flow_headings_with_diagrams=${fgood:-0}/${fn:-0}"
  [ "${fn:-0}" -eq 7 ] && [ "${fgood:-0}" -eq 7 ] && echo "flow_section=OK" || echo "flow_section=FAIL"
  if awk '/^#{1,6} /{seen=1} /^```mermaid/{if(!seen){bad=1}} END{exit (bad?1:0)}' $files; then orphan=OK; else orphan=FAIL; fi
  if [ "$c4good" -eq 3 ] && [ "${fn:-0}" -eq 7 ] && [ "${fgood:-0}" -eq 7 ] && [ "$orphan" = OK ]; then echo "heading_association=OK"; return 0; else echo "heading_association=FAIL (c4=$c4good/3 flows=${fgood:-0}/${fn:-0} orphan=$orphan)"; return 1; fi
}
if [ ! -d "$M2" ]; then echo "FAIL: $M2 absent; mermaid fences=0 (<10); association=absent"; else
  files=$(find "$M2" -name '*.md')
  awk '
    FNR==1 && open { printf "FAIL unclosed fence in %s\n", prev; bad=1; open=0 }
    /^```mermaid/ { open=1; prev=FILENAME; getline
      if ($0 !~ /^(flowchart|graph|sequenceDiagram|classDiagram|stateDiagram-v2)([ \t]|$)/) { printf "FAIL keyword %s:%d: %s\n", FILENAME, FNR, $0; bad=1 }
      next }
    /^```/ { open=0 }
    END { if (open) { printf "FAIL unclosed fence in %s\n", prev; bad=1 } exit bad }
  ' $files; echo "keyword_and_fence_exit=$?"
  diagram_assoc "$M2" || true
fi
# compliant fixture: subject form on L1/L3, bare heading on L2; seven flows under ## Key flows
emit() { printf '%s\n\n```mermaid\nflowchart LR\n  A-->B\n```\n\n' "$1"; }
mkdir -p /tmp/gh284/p33-good /tmp/gh284/p33-bad
{
  emit "## C4 Level 1: system context"
  emit "## C4 Level 2"
  emit "## C4 Level 3: components"
  printf '## Key flows\n\n'
  emit "### Multi-repository overview"
  emit "### Attempt-history inspection and divergence resolution"
  emit "### Telemetry attribution"
  emit "### Queue auto-release after merge and closeout"
  emit "### Single-flight refusal across dispatch paths"
  emit "### Handover-gate evaluation"
  emit "### S17 park and resume"
} > /tmp/gh284/p33-good/architecture.md
{
  emit "## C4 Level 2: containers"
  emit "## C4 Level 3: components"
  printf '## Key flows\n\n'
  emit "### Multi-repository overview"
  emit "### Attempt-history inspection and divergence resolution"
  emit "### Telemetry attribution"
  emit "### Queue auto-release after merge and closeout"
  emit "### Single-flight refusal across dispatch paths"
  emit "### Handover-gate evaluation"
  emit "### S17 park and resume"
} > /tmp/gh284/p33-bad/architecture.md
printf '## C4 Level 1: system context\n\nNo diagram here.\n\n' >> /tmp/gh284/p33-bad/architecture.md
if diagram_assoc /tmp/gh284/p33-good > /tmp/gh284/p33-good.out; then echo "fixture_good=OK"; else echo "fixture_good=FAILED"; fi
grep -q 'c4_headings_with_diagrams=3/3' /tmp/gh284/p33-good.out && grep -q 'flow_headings_with_diagrams=7/7' /tmp/gh284/p33-good.out && grep -q 'heading_association=OK' /tmp/gh284/p33-good.out && echo "fixture_good_metrics=3/3,7/7,OK" || echo "fixture_good_metrics=FAILED"
diagram_assoc /tmp/gh284/p33-bad > /tmp/gh284/p33-bad.out || true
grep -q 'C4 Level 1 has diagram=MISSING' /tmp/gh284/p33-bad.out && echo "fixture_negative=detected" || echo "fixture_negative=FAILED"
```

**P34 — retention oracle and four pointer insertions**

```bash
ptr() { printf '%s' "$1" | grep -q '2026-11-10'; }
if ! declare -f retention_oracle >/dev/null; then echo "FAIL: run P18 first (defines retention_oracle)"; else
  if retention_oracle /tmp/gh284/base-status.md "$ST"; then ro=1; else ro=0; fi
  echo "oracle=whole-file-line-retention (whole-section cmp not used)"
  echo "retention_oracle=$([ "$ro" -eq 1 ] && echo OK || echo FAILED)"
fi
pcount=0; : > /tmp/gh284/p34.err
g2e=$(grep -n 'remains the critical path for M0 exit\.' "$ST" | head -1 | cut -d: -f1)
g3e=$(awk '/^## M1 delivery: scheduling engine delivered \(2026-11-07\)/{f=1} f&&/^## /&&!/scheduling engine delivered/{print NR-1; exit}' "$ST")
g4e=$(grep -n '^4\. \*\*Memory consolidation pass' "$ST" | head -1 | cut -d: -f1)
[ -n "$g4e" ] && g4e=$((g4e-1))
for e in 1 "$g2e" "$g3e" "$g4e"; do
  [ -z "$e" ] && continue
  start=$(( e > 1 ? e - 1 : 1 ))
  ptr "$(sed -n "${start},$((e+4))p" "$ST" 2>>/tmp/gh284/p34.err)" && pcount=$((pcount+1))
done
echo "pointer_groups=$pcount/4"
echo "sed_line_address_0_errors=$(grep -c 'line address 0' /tmp/gh284/p34.err || true)"
[ "${ro:-0}" -eq 1 ] && [ "$pcount" -eq 4 ] && echo "P34 verdict: PASS" || echo "P34 verdict: FAIL (change absent)"
```

**P35 — 79-clause fidelity**

```bash
if ! declare -f clause_check >/dev/null; then echo "FAIL: run P02 first (defines clause_rows/clause_check)"; else
  if clause_check 'M2-S11|M2-S12|M2-S13|M2-S14|M2-S15|M2-S16|M2-S17|M2-S4|M2-S6' > /tmp/gh284/clause-all.txt; then m=0; else m=$(sed -n 's/.*missing=//p' /tmp/gh284/clause-all.txt); fi
  cat /tmp/gh284/clause-all.txt
  echo "missing_clauses=$m"
  echo "s17_missing_criteria=$(grep -cE '^MISSING S17-AC' /tmp/gh284/clause-all.txt)"
  ni=$(entry "$BL" '### M2-S17 ' | awk '/^- AC:/{f=1;next} /^- Depends on:/{f=0} f' | grep -cE '^[[:space:]]+[0-9]+\. ' || true)
  echo "added_criteria=$([ "${ni:-0}" -gt 7 ] && echo $((ni-7)) || echo 0)"
  echo "changed_meaning=manual clause-by-clause review (declared gap G-1)"
fi
```

**P36 — forbidden literals and pack registration**

```bash
REG=scripts/checks/forbidden-literals.registry.json
BASELINE=$(python3 - "$REG" <<'PYJ'
import json,sys
print(json.load(open(sys.argv[1]))["corpusBaseline"])
PYJ
)
python3 - "$REG" <<'PYJ' > /tmp/gh284/registered.txt
import json,sys
for p in json.load(open(sys.argv[1]))["registered"]:
    print(p)
PYJ
echo "registered_total=$(wc -l < /tmp/gh284/registered.txt)"
# The twelve ADDED entries, in registry order, must be sorted and unique. Pre-existing
# entries are not reordered (the base registry itself is not globally sorted).
M2FILES=(README.md architecture.md contracts.md test-scenarios.md journeys.md entrypoint-delta.md commands/projects.md commands/attempts.md commands/events.md commands/spend.md commands/queue.md commands/board.md)
printf '%s\n' "${M2FILES[@]}" | sed 's|^|doc/planning/oss-tooling/milestones/m2/|' | LC_ALL=C sort > /tmp/gh284/m2-expected.txt
grep '^doc/planning/oss-tooling/milestones/m2/' /tmp/gh284/registered.txt > /tmp/gh284/m2-seq.txt || true
echo "m2_registry_sorted=$(LC_ALL=C sort -c /tmp/gh284/m2-seq.txt 2>/dev/null && echo yes || echo no)"
echo "m2_registry_duplicates=$(LC_ALL=C sort /tmp/gh284/m2-seq.txt | uniq -d | wc -l)"
present=0; absent=0
for p in $(cat /tmp/gh284/m2-expected.txt); do
  grep -Fxq "$p" /tmp/gh284/registered.txt && present=$((present+1)) || echo "unregistered: $p"
  git cat-file -e "$BASELINE:$p" 2>/dev/null && echo "present at baseline: $p" || absent=$((absent+1))
done
echo "registry_m2=$present/12 baseline_absent=$absent/12"
# self-tests: an inverted pair is caught; a duplicated entry is caught
cp /tmp/gh284/m2-expected.txt /tmp/gh284/m2-good.txt
awk 'NR==1{a=$0;next} NR==2{print;print a;next} {print}' /tmp/gh284/m2-expected.txt > /tmp/gh284/m2-bad.txt
LC_ALL=C sort -c /tmp/gh284/m2-bad.txt 2>/dev/null && echo "registry_sorted_self_test=FAILED" || echo "registry_sorted_self_test=detected"
cp /tmp/gh284/m2-expected.txt /tmp/gh284/m2-dup.txt; head -1 /tmp/gh284/m2-expected.txt >> /tmp/gh284/m2-dup.txt
[ "$(LC_ALL=C sort /tmp/gh284/m2-dup.txt | uniq -d | wc -l)" -gt 0 ] && echo "registry_duplicate_self_test=detected" || echo "registry_duplicate_self_test=FAILED"
bun run scripts/checks/forbidden-literals.ts > /tmp/gh284/fl.log 2>&1; fe=$?
echo "forbidden_exit=$fe"
grep -E '^OK forbidden-literals' /tmp/gh284/fl.log | tail -1
echo "unregistered_findings=$(grep -c 'unregistered user-facing doc' /tmp/gh284/fl.log || true)"
added=$(git diff -U0 "$BASE"...HEAD -- doc/planning/oss-tooling/ | grep -c '^+' || true)
echo "added_lines=$added"
hits=0; while IFS= read -r line; do printf '%s' "$line" | grep -qE '(^|[^A-Za-z])ados([^A-Za-z]|$)|ADOS_|~/\.ados' && hits=$((hits+1)); done < <(git diff -U0 "$BASE"...HEAD -- doc/planning/oss-tooling/ | grep '^+' | grep -v '^+++')
echo "seed_hits=$hits non_vacuous=$([ "$added" -ge 1 ] && echo yes || echo no)"
```

**P37 — link integrity and non-duplication**

```bash
changed=$(git diff --name-only "$BASE"...HEAD -- doc/planning/oss-tooling/ | wc -l); echo "changed_planning_files=$changed"
broken=0
files=$( { git diff --name-only "$BASE"...HEAD -- doc/planning/oss-tooling/; find "$M2" -name '*.md' 2>/dev/null; } | sort -u )
for f in $files; do
  dir=$(dirname "$f")
  grep -oE '\]\([^)#]+' "$f" | sed 's/^](//' | grep -vE '^(https?:|mailto:)' | while read -r t; do [ -e "$dir/$t" ] || [ -e "$t" ] || echo "BROKEN $f -> $t"; done
done > /tmp/gh284/broken-links.txt; broken=$(wc -l < /tmp/gh284/broken-links.txt); echo "broken_links=$broken"
restated=$(grep -rlE '^- AC:|\*\*Given\*\*' doc/planning/oss-tooling/milestones/m2 2>/dev/null | wc -l); echo "restated_ac_blocks=$restated"
echo "non_vacuous=$([ "$changed" -ge 1 ] && echo yes || echo no)"

echo; echo "##### done"
```

**Recommended order:** P00 → P28 (containment) → P31 → P32 → P36 → P11 → P14/P15/P30 (page and entrypoint containment) → P01..P10 → P16..P18 → P19..P27 → P29 → P33..P35 → P37 → the manual reads (G-1, G-3, G-4, G-5, G-6). Cheap containment and guards first: an out-of-planning change or an escaped header hunk makes every downstream content reading moot.

### 7.2 TC → Procedure → Implementation Mapping

| TC ID | AC | Procedure(s) | Execution command | Implementation status | Recorded evidence |
|---|---|---|---|---|---|
| TC-M2PLAN-001 | AC-F1-1 | P01 | `bash` block **P01** (Section 7.1) | Manual Only — uncommitted procedure | `m2_story_headings=0 new_found=0/7 order=FAIL`; `shape_ok=0/7`; `blank_separation=FAIL (want blank then ### M2-S11; got [] then [---])`; `separator_sequence=identical`. |
| TC-M2PLAN-002 | AC-F1-2 | P02 | `bash` block **P02** (Section 7.1) | Manual Only — uncommitted procedure | `M2-S11 clauses=0/9`, `M2-S12 clauses=0/8`, `M2-S13 clauses=0/11`, `M2-S14 clauses=0/12`, `M2-S15 clauses=0/10`, `M2-S16 clauses=0/11`; `clause_scan: total=61 present=0 missing=61`; 61 named `MISSING` lines, including `S11-AC1: disjoint phase state and queue entries` and `S12-AC2: resolved with a note and unresolved counts`. |
| TC-M2PLAN-003 | AC-F1-3 | P03 | `bash` block **P03** (Section 7.1) | Manual Only — uncommitted procedure | `insertion window: start=base M2-S9 last content+1=1167 end=head separator-1=1167 window=1167:1167`; `window_empty=no`; `separator_sequence=identical`; `blank_separation=FAIL (head M2-S9 last non-blank=1166; got [] then [---])`; the conforming fixture prints `blank_separation=OK (head M2-S9 last non-blank=1167, blank=1168, M2-S11=1169)` and `fixture_blank_separation=OK`; `backlog_hunks=0`; `FAIL: no backlog hunk (change absent)`; `non_vacuous=no`; `classifier_self_tests=4/4`; `insertion_below_separator=never (negative fixture at separator+2 outside)`. |
| TC-M2PLAN-004 | AC-F2-1 | P04 | `bash` block **P04** (Section 7.1) | Manual Only — uncommitted procedure | `S17=absent`; `criteria_present=0/7`. |
| TC-M2PLAN-005 | AC-F2-2 | P05 | `bash` block **P05** (Section 7.1) | Manual Only — uncommitted procedure | `S17=absent clauses_present=0/6`; `missing=6`. |
| TC-M2PLAN-006 | AC-F2-3 | P06 | `bash` block **P06** (Section 7.1) | Manual Only — uncommitted procedure | `S17=absent criteria_present=0/7`; `ac_numbered_items=0/7`; `extra_criteria=0`; `duplicate_numbers=0`; `duplicate_self_test=detected`; `extra_self_test=detected (8 items, extra=1)`; all seven `MISSING` lines prove the oracle cannot be satisfied by a bare count. |
| TC-M2PLAN-007 | AC-F3-1 | P07 | `bash` block **P07** (Section 7.1) | Manual Only — uncommitted procedure | `changed_lines=0 unexpected_lines=0`; `depends=NOT expected (- Depends on: M1-S5, M1-S17. |
| TC-M2PLAN-008 | AC-F3-2 | P08 | `bash` block **P08** (Section 7.1) | Manual Only — uncommitted procedure | `changed_lines=0`; `tasks_clause=MISSING`; `depends=M2-S14 MISSING`; `heading=identical`; `base_task_lines_missing=0`; `- Goal: identical`; `- AC: identical`; `fixture_task_lines_missing=0`; `fixture_s6_task_lines=3->4`; `fixture_ac_identity=identical`; `fixture_p08=OK`. |
| TC-M2PLAN-009 | AC-F4-1 | P09 | `bash` block **P09** (Section 7.1) | Manual Only — uncommitted procedure | `base_headings=67 head_headings=67 added=0 removed=0 unexpected=0`; `retirement_note=identical`; `order=OK`; `negative_control=detected`. |
| TC-M2PLAN-010 | AC-F4-2 | P10 | `bash` block **P10** (Section 7.1) | Manual Only — uncommitted procedure | `fm=byte-identical`; `rg=byte-identical`; `cc=byte-identical`. |
| TC-M2PLAN-011 | AC-F5-1 | P11 | `bash` block **P11** (Section 7.1) | Manual Only — uncommitted procedure | `pages=28`; `M1_planned_hits=9`; `M1_milestone_planned_hits=2`; `forbidden_phrase_pages=11`; `header_attribution=2/14`; `tail_violations=11`; `current_violations=1` (`daemon. |
| TC-M2PLAN-012 | AC-F5-2 | P12 | `bash` block **P12** (Section 7.1) | Manual Only — uncommitted procedure | All three `MISSING`. |
| TC-M2PLAN-013 | AC-F5-3 | P13 | `bash` block **P13** (Section 7.1) | Manual Only — uncommitted procedure | `M1-S18 MISSING`; `GH-238 OK`; `not mounted MISSING`; `entrypoint delta MISSING`; `Current=PRESENT`; `daemon_body=byte-identical`. |
| TC-M2PLAN-014 | AC-F5-4 | P14 | `bash` block **P14** (Section 7.1) | Manual Only — uncommitted procedure | `changed_pages=0/14`; `total_hunks=0`; `entrypoint_hunks=0`; `classifier_inside=OK`; `classifier_outside=OK`; `non_vacuous=no`. |
| TC-M2PLAN-015 | AC-F6-1 | P15 | `bash` block **P15** (Section 7.1) | Manual Only — uncommitted procedure | `observed_families=16`; `enumerated_families=14`; `families_not_enumerated=coordinator dispatch`; `dispatch=claimed-not-registered (FAIL)`; `not_registered_extra_families= dispatch`; `desc_hunks=0`; `outside_desc_hunks=0`; `sentences_removed=0`; `sentences_added=0`; `entrypoint_bound=FAILED`; `positive_two_sentence=OK`; `negative_merged=detected`. |
| TC-M2PLAN-016 | AC-F7-1 | P16 | `bash` block **P16** (Section 7.1) | Manual Only — uncommitted procedure | `new_sections=0`; `2026-11-10 section=absent`; `alternation_self_test=OK`; verdict FAIL. |
| TC-M2PLAN-017 | AC-F7-2 | P17 | `bash` block **P17** (Section 7.1) | Manual Only — uncommitted procedure | All four groups retain their bytes (`yes`), but every pointer check is `no` and `g4_pointer=0/1`. |
| TC-M2PLAN-018 | AC-F7-3 | P18 | `bash` block **P18** (Section 7.1) | Manual Only — uncommitted procedure | `windows(base-anchored): newsec=0. |
| TC-M2PLAN-019 | AC-F8-1 | P19 | `bash` block **P19** (Section 7.1) | Manual Only — uncommitted procedure | `pack_files=0/12`; `actual_files=0`; `README=absent`; `readme_self_link_self_test=detected`; `pack_contents_table=byte-identical`. |
| TC-M2PLAN-020 | AC-F8-2 | P20 | `bash` block **P20** (Section 7.1) | Manual Only — uncommitted procedure | `architecture=absent`. |
| TC-M2PLAN-021 | AC-F8-3 | P21 | `bash` block **P21** (Section 7.1) | Manual Only — uncommitted procedure | `contracts=absent`. |
| TC-M2PLAN-022 | AC-F8-4 | P22 | `bash` block **P22** (Section 7.1) | Manual Only — uncommitted procedure | `test-scenarios=absent`. |
| TC-M2PLAN-023 | AC-F8-5 | P23 | `bash` block **P23** (Section 7.1) | Manual Only — uncommitted procedure | `journeys=absent`. |
| TC-M2PLAN-024 | AC-F9-1 | P24 | `bash` block **P24** (Section 7.1) | Manual Only — uncommitted procedure | `command_headers=0/6`; all six files absent. |
| TC-M2PLAN-025 | AC-F9-2 | P25 | `bash` block **P25** (Section 7.1) | Manual Only — uncommitted procedure | All six absent; both relationship checks `MISSING`. |
| TC-M2PLAN-026 | AC-F10-1 | P26 | `bash` block **P26** (Section 7.1) | Manual Only — uncommitted procedure | `delta=absent` on the pre-change tree; the conforming delta-note fixture prints all ten markers `OK`, including `entrypoint. |
| TC-M2PLAN-027 | AC-F11-1 | P27 | `bash` block **P27** (Section 7.1) | Manual Only — uncommitted procedure | `M2 row=absent`; `m2_targets=0/12`; both M0/M1 rows identical. |
| TC-M2PLAN-028 | AC-NFR1-1 | P28 | `bash` block **P28** (Section 7.1) | Manual Only — uncommitted procedure | `delivery_range=whole change minus the three phase-7 paths (equals base. |
| TC-M2PLAN-029 | AC-NFR2-1 | P29 | `bash` block **P29** (Section 7.1) | Manual Only — uncommitted procedure | `-- real head --` `stories_compared=65 identical=65 changed=0 order=OK` / `real_head=PASS`; `-- base control --` `65/65/0 order=OK` / `base_control=PASS`; `-- minimal stories-only head --` `65/65/0 order=OK` / `minimal_head=PASS`; `-- full amendment + stories head --` `65/65/0 order=OK` / `full_head=PASS`; `negative_body=detected`; `negative_removed=detected`; `negative_reordered=detected`. |
| TC-M2PLAN-030 | AC-NFR3-1 | P30 | `bash` block **P30** (Section 7.1) | Manual Only — uncommitted procedure | `body_identical=14/14`; `desc_hunks=0`; `outside_desc_hunks=0`; `sentences_removed=0`; `sentences_added=0`; `entrypoint_bound=FAILED`. |
| TC-M2PLAN-031 | AC-NFR4-1 | P31 | `bash scripts/.tests/test-doc-distribution.sh` | Existing guard — no change | guard summary and `exit=0` |
| TC-M2PLAN-032 | AC-NFR5-1 | P32 | `mkdir -p "$(git rev-parse --show-toplevel)/tmp/tmpdir" && TMPDIR="$(git rev-parse --show-toplevel)/tmp/tmpdir" pnpm check` | Existing guard — no change | `pnpm check` exit code and the last successful stage |
| TC-M2PLAN-033 | AC-NFR6-1 | P33 | `bash` block **P33** (Section 7.1) | Manual Only — uncommitted procedure | `FAIL: doc/planning/oss-tooling/milestones/m2 absent; mermaid fences=0 (<10); association=absent`; the compliant fixture still reports `fixture_good=OK` / `fixture_good_metrics=3/3,7/7,OK`, and the level-1-without-diagram fixture reports `C4 Level 1 has diagram=MISSING` / `fixture_negative=detected`. |
| TC-M2PLAN-034 | AC-NFR7-1 | P34 | `bash` block **P34** (Section 7.1) | Manual Only — uncommitted procedure | `retention_oracle=FAILED`; `oracle=whole-file-line-retention (whole-section cmp not used)`; `pointer_groups=0/4`; `sed_line_address_0_errors=0`. |
| TC-M2PLAN-035 | AC-NFR8-1 | P35 | `bash` block **P35** (Section 7.1) | Manual Only — uncommitted procedure | `clause_scan: total=79 present=0 missing=79`; `missing_clauses=79`; `s17_missing_criteria=7`; `added_criteria=0`; all 79 clause ids printed as `MISSING`, including `S11-AC1`, `S12-AC2`, `S13-AC1`, `S15-AC1`, `S15-AC2`, `S15-AC3`, `S16-AC1`, and `S17-AC3`/`AC4`/`AC6`. |
| TC-M2PLAN-036 | AC-NFR9-1 | P36 | `bun run scripts/checks/forbidden-literals.ts` + added-line scan | Existing guard plus uncommitted scan | `0 violations`, `seed_hits=0` |
| TC-M2PLAN-037 | AC-NFR10-1 | P37 | `bash` block **P37** (Section 7.1) | Manual Only — uncommitted procedure | `changed_planning_files=0`; `broken_links=0`; `restated_ac_blocks=0`; `non_vacuous=no`. |

No test file is created or updated: no permanent-suite change is permitted or needed (NFR-1; testing-strategy invariant rule).

### 7.3 Failure Triage

| Symptom | Meaning | Action |
|---|---|---|
| P28 prints delivery `product_files` other than 31, `registry_files` other than 1, or `phase7_extra` other than 0 | The delivery budget (30 planning + 1 registry) or the phase-7 three-file budget is wrong (AC-NFR1-1/DEC-22) | Keep delivery at 31 and phase 7 at exactly the three named current-truth docs; revert any other path. |
| P28 prints `outside_planning_outside_registry>0`, `forbidden_root_files>0`, or `phase7_unknown_paths>0` | Containment broken in either budget (AC-NFR1-1) | Stop. Revert the out-of-scope path; only the three named phase-7 docs may sit under `doc/spec`/`doc/overview`. |
| P28 prints `non_vacuous=no` | The change is absent, not contained | This is a missing deliverable, not a pass. |
| P14/P30 print any `OUTSIDE` hunk or a body mismatch | A reconciled page changed outside its status header (AC-F5-4/AC-NFR3-1) | Restore the body byte for byte; only the header region may differ. |
| P15/P30 print `desc_hunks` other than 1, `outside_desc_hunks>0`, or sentence counts outside 1-2 | The entrypoint edit is broader than one contiguous region of at most two adjacent sentences (AC-F5-4/AC-F6-1) | Restore every other byte; keep the enumeration and registration statements separate and confined to that region. |
| P14 prints `entrypoint_hunks` other than 1 | The entrypoint edit is broader than one hunk (AC-F5-4) | Restore the page to one contiguous DESCRIPTION hunk; P15 then proves the at-most-two-sentence bound. |
| P11 still prints `forbidden_phrase_pages>0` or `tail_violations>0` | A delivered story is still called planned, or a proposal tail survives without a named planned remainder (AC-F5-1/DEC-18) | Reword the header; drop the tail unless the header names its planned remainder. |
| P11 prints `watchdog_m1s15=MISSING`, `watchdog_sc=MISSING`, `verify_gates_extension=MISSING`, or `closeout_extension=MISSING` | A true delivered clause was deleted (AC-F5-1) | Restore the preserved clause; only false status fragments may change (Appendix B). |
| P11 prints `header_attribution<14/14` | A reconciled header lacks the delivered story code or its GH reference | Add the missing attribution; Appendix B gives the expected pair. |
| P12 prints `MISSING` | A remainder lost its owner | Point `board` at M2-S4, `watchdog` at M2-S2, `mcp` at M3-S2. |
| P13 prints `Current=PRESENT` or a missing header token | The daemon page still overclaims reachability (AC-F5-3) | State engine delivered by M1-S18 (GH-238), command not mounted, registration in the M2 delta note. |
| P09/P10/P29 show any changed heading, body, or region | Backlog preservation broken (AC-F4-1/AC-F4-2/AC-NFR2-1) | Restore the region byte for byte; the message names the story or region. |
| P03 prints `OUTSIDE`, `separator_sequence=CHANGED`, or `non_vacuous=no` | A backlog hunk escaped the inserted/amended entries, the insertion fell below the `---` separator, or no hunk exists | Move the insertion inside the Epic M2 block before the separator; a zero-hunk run is a missing deliverable. |
| P07/P08 print `unexpected_lines>0` or a changed Goal/AC | An amendment touched more than the allowed lines (AC-F3-1/AC-F3-2) | Restore the untouched lines byte for byte. |
| P02/P35 print `MISSING` with a clause id | A ticket clause from the 61/79-row table has no anchor in the story (AC-F1-2/AC-NFR8-1) | Restore the named clause; the id and short clause are printed. Then run the paraphrase read (G-1). |
| P35 prints `missing_clauses>0` | Fidelity is incomplete (AC-NFR8-1) | Restore the missing clause anchors; do not add a criterion. |
| P01 prints `shape_ok<7/7` | A story lacks Goal/Tasks/AC/Depends-on or gained a Ticket line (AC-F1-1) | Add the missing line; remove the Ticket line (no ticket exists yet). |
| P04/P06 print a missing dependency or fewer than seven ACs | The S17 entry is incomplete (AC-F2-1/AC-F2-3) | Restore the six dependencies and the seven-item numbered list. |
| P16 prints `2026-11-10 section=absent` or a marker `MISSING` | The status snapshot is absent or incomplete (AC-F7-1) | Add the section; include 23/23 under a real alternation (no literal `|` in the phrase), the M2 state, #268/#280, and the maintenance convention. |
| P17 prints a pointer `no` or `g4_pointer=0/1` | A superseded statement group lacks its one appended pointer (AC-F7-2) | Insert one pointer of at most three non-blank lines after the group (items 1-3 are one group), naming `2026-11-10`; do not rewrite original lines. |
| P18/P34 print `removed_lines>0`, `bad_runs>0`, `pointer_runs<4`, or `pointer_windows<4` | A base line was removed, reordered, or modified, or an addition sits outside the base-anchored whitelist (AC-F7-3/AC-NFR7-1) | Restore the base line byte for byte; confine additions to the new dated section or one of the four base-anchored pointer windows. Never substitute a whole-section `cmp`. |
| P34 prints `sed_line_address_0_errors>0` or `pointer_groups<4` because the title group is unreachable | The start address was not clamped to line 1 (D7) | Use `start=$(( e > 1 ? e - 1 : 1 ))` so the title group is addressable. |
| P19/P20/P21/P22/P23 print `absent` or a missing marker | A pack document is missing or incomplete (AC-F8-*) | Add the document or the named section; keep the file set at exactly twelve. |
| P19 prints `deviation_statement=MISSING` or `pack_contents_table=CHANGED` | The README does not state the deliberate no-man-page/no-interactions deviation, or the contents table was edited (AC-F8-1/DEC-20) | State the deviation in `milestones/m2/README.md`; leave the table byte-identical. |
| P27 prints `m2_targets<12` | The M2 row does not link all twelve artifacts (AC-F11-1) | Add the missing target; keep the M0/M1 rows untouched. |
| P22 prints `stories_below_two>0` or `total_scenarios<32` | Scenario coverage is short (AC-F8-4) | Add scenarios for the named story; keep the twelve mandatory anchors. |
| P24/P25 print a header or section failure | A command contract is not man-page complete (AC-F9-1/AC-F9-2) | Restore `Status: Proposed (M2)`, `<binary>`, and the seven sections. |
| P26 prints a missing marker | The delta note lacks evidence or the outside-scope statement (AC-F10-1) | Add the observed invocation, exit code, and the pointer sentence. |
| P27 prints `M2 row=absent` or a missing artifact | The pack is not discoverable (AC-F11-1) | Add one planned row linking the README and every artifact; leave M0/M1 rows alone. |
| P31 is non-zero or prints drift | A scoped doc was disturbed | Check P28 first; the diff usually escaped planning. |
| P32 prints `default_failure_class=delivery`, or `repo_tmpdir_exit>0` | A non-environmental gate failure (AC-NFR5-1/DEC-19) | Fix the failure; only a lone `ci-baseline-parity` default failure is environmental. |
| P32 dies with `ENOENT`/`mkdtemp` | The repo-local `TMPDIR` directory was not created | Keep `mkdir -p "$TMPDIR_REPO"` before the repo-local run; the path is `"$REPO_ROOT/tmp/tmpdir"`. |
| P33 prints a fence failure, `heading_association=FAIL`, or a `has diagram=MISSING` line | A diagram is structurally invalid or sits under the wrong heading (AC-NFR6-1) | Fix the fence or move the block under the expected C4/flow heading; then have the reviewer render it (G-3). |
| P36 prints `registry_m2<12` or `unregistered_findings>0` | A pack doc is missing from `registered` (AC-NFR9-1/DEC-21) | Add the twelve `doc/planning/oss-tooling/milestones/m2/**` paths to the registry, sorted among themselves and duplicate-free. |
| P36 prints `seed_hits>0` or a guard literal violation | A forbidden literal was introduced (AC-NFR9-1) | Reword the line; never widen the allowlist. |
| P37 prints `broken_links>0` or `restated_ac_blocks>0` | A link is broken or a pack restates ACs (AC-NFR10-1) | Fix the path or replace the restatement with a story-code reference. |

## 8. Risks, Assumptions, and Open Questions

### 8.1 Risks

| ID | Testing risk | Mitigation in this plan |
|---|---|---|
| TR-1 | A prose oracle lets a lost clause pass as complete | A 79-row table built from the ticket's actual clause set (P02 runs S11-S16; P35 runs all 79) with a named failure per missing clause, plus the paraphrase read (G-1) |
| TR-2 | A preservation control passes because nothing changed | Non-vacuity guards in P03/P14/P18/P28/P34/P36/P37 and mutation controls in P07/P09/P15/P18; the execution log labels controls |
| TR-3 | A hunk-containment check silently accepts the next heading line, a moved entry, or an insertion below the separator | P03 derives the start from the base M2-S9 last content line and the end from the head `---` before Epic M3, checks the separator sequence, and runs a below-separator negative fixture; P14 compares page hunks and P30 compares body bytes independently |
| TR-4 | The entrypoint check hardcodes a family list and drifts from the product | P15 derives the set from live root `--help` |
| TR-5 | The history oracle reverts to a whole-section `cmp`, which cannot coexist with permitted pointer insertions | P18/P34 use whole-file line retention plus an added-line whitelist; a removed, reordered, or modified base line fails |
| TR-6 | `pnpm check` is green but unrelated to the documents | Content procedures carry the ACs; P32 is a no-regression gate only (G-7) |
| TR-7 | The guard's `userFacingDocs` scope covers `doc/planning/**` and fails closed, so a missing registration can be misread as a literal violation | P36 separates registration assertions from the guard result; P31 still records the distribution guard's narrower path set |
| TR-11 | A default gate failure is excused as environmental when another test also failed | P32 records both exits and all failing test names; classification requires exactly one failure and it must be `CI baseline parity` (DEC-19) |
| TR-12 | The clause table drifts from the ticket and silently shrinks | The table is the ticket's 79 clauses (7 Goals, 36 task clauses, 26 acceptance clauses, 7 dependencies, 3 amendment clauses); P02/P35 print per-story totals and each missing id |
| TR-8 | The diagram check proves structure, not parseability | G-3 records the limit and assigns a rendered-preview read to the reviewer |
| TR-9 | A check is run on a moving base | Three-dot diff plus snapshots from the pinned base `fab46636`; re-materialise in P00 if the base advances |
| TR-10 | A retention oracle that only counts removals accepts a pointer appended in the wrong place, or a head-anchored window shifts past the pointer it should count | Base-anchored whitelist windows (new section plus four pointer windows), `pointer_runs=4`, `pointer_windows=4`, three self-tests, and a reference-shaped-head fixture; the reviewer confirms pointer wording (G-6) |

### 8.2 Assumptions

- **A-1**: `fab46636cc0b5abfbd22257711f594adc0af4660` is the correct base (branch created from `origin/main-tools`; spec and pm-notes are the only commits on top).
- **A-2**: The built workspace in this checkout reflects the production composition, so `pnpm exec delivery-os --help` is valid evidence for P15.
- **A-3**: `doc/planning/**` is outside the distribution guard's scan set and no marker is expected (DEC-6).
- **A-4**: The repository has no mermaid validator, so structural checking is the truthful bar (DEC-15).
- **A-5**: The ticket body is the normative clause source; GH-284 is readable at authoring and review time.
- **A-6**: Story codes are stable identifiers and file position carries no ordering meaning; append-only placement is still required by F-1/DEC-9.
- **A-7**: The pack author will make each scenario's story mapping countable via `(M2-Sxx)` in the heading or a `Story:` line (derived testability requirement, matching the M1 convention).
- **A-8**: `pnpm check` on CI runs on one filesystem; the local `/tmp` limitation in G-2 does not exist in CI.

### 8.3 Open Questions

None. The spec closed its single open verification (daemon wiring) as DEC-2 with Appendix C evidence, and every ambiguity is a recorded decision. The residual judgment points are declared gaps G-1, G-3, G-4, G-5, G-6, and G-9 with a named owner; G-2 is an environment caveat, G-7 a scope limit, and G-8 an interpretation guard. None is an open question.

| ID | Question | Blocking? | Owner | Disposition |
|---|---|---|---|---|
| — | None outstanding | — | — | Closed by spec v1.5 and the pm-notes decisions |

## 9. Plan Revision Log

| Version | Date | Author | Changes |
|---|---|---|---|
| 1.0 | 2026-11-10 | @test-plan-writer | Initial test plan for spec v1.1: 37 ACs covered exactly once by 37 TCs (bidirectional traceability, no orphans), 38 procedure blocks (P00 base plus P01-P37), all 37 procedures run against base `fab46636` with observed results recorded (including both `pnpm check` runs), six pure preservation controls (P09, P10, P18, P29, P31, P34), partial controls recorded against P13, P17, P27, P30 and P36, non-vacuity labels on P03/P14/P28/P36/P37, the doc-distribution guard, the aggregate gate, the Appendix E structural diagram check, link and non-duplication checks, failure triage, and nine declared gaps with named owners. |
| 1.1 | 2026-11-10 | @test-plan-writer | Reopened and aligned to spec v1.2 (DEC-16). **D1:** P03 now derives the M2 insertion window from two sources — start from the base snapshot's M2-S9 end (1170) and end from the head `## Epic M3` line minus one — and the classifier self-tests grow to 3/3; observed window `1170:1169` (empty before the change) and `backlog_hunks=0`, so the verdict stays `FAIL (vacuous)`. **D2:** P16 uses a real ERE alternation `23 of 23|23/23`, adds a `literal_pipe` prohibition and an `alternation_self_test=OK`; observed `new_sections=0`, `FAIL`. **D3:** P15/P30 implement the two-sentence bound: exactly 16 enumerated families, exactly `state`/`mcp`/resident daemon absent, separate sentences, one contiguous DESCRIPTION hunk with at most two adjacent sentences and every other byte identical; two-sentence and merged-sentence fixtures prove the oracle; observed `desc_hunks=0`, `enumerated_families=14`, `FAIL`. **D4:** P18/P34 replace the whole-section `cmp` with whole-file line retention plus an added-line whitelist (new section plus four pointer windows, ≤3 non-blank lines each); observed `removed_lines=0`, `added_lines=0`, self-tests `detected/detected/permitted`, `FAIL (vacuous)`. Traceability stays 37 ACs / 37 TCs / 38 procedure blocks; G-6 and G-8 reworded for the new mechanisms. |
| 1.2 | 2026-11-10 | @test-plan-writer | Reopened and aligned to spec v1.3 (DEC-17). **D5:** P03 now pins the insertion inside the Epic M2 block: start is the base M2-S9 last content line + 1 (1167), end is the head `---` line before `## Epic M3` minus 1; it asserts `separator_sequence=identical`, adds a below-separator negative fixture and a separator-deletion probe (`classifier_self_tests=4/4`), and observed `window=1167:1167`, `window_empty=no`, `separator_sequence=identical`, `backlog_hunks=0`, `FAIL (vacuous)`. **D6:** P18 re-anchors the paragraph/scheduling/items windows to the base statement ends and maps them through the insertion offset, so an appended pointer cannot become the `last non-blank` line and shift its own window; observed pre-change `pointer_runs=0`, `bad_runs=0`, and a reference-shaped-head fixture with `reference_whitelist: section_lines=3 pointer_runs=4 pointer_windows=4 bad_runs=0`, `reference_head_fixture=OK`. **D7:** P34 clamps the title-group start to 1; observed `pointer_groups=0/4` with `sed_line_address_0_errors=0`. Traceability stays 37 ACs / 37 TCs / 38 procedure blocks; TC003/TC018/TC034 and G-8/TR-3/TR-10 updated. |
| 1.3 | 2026-11-10 | @test-plan-writer | DoR iteration-1 remediation against spec v1.4. **F2:** P02/P35 run a 79-row clause table built from GH-284's actual clause set (61 rows for S11-S16; 79 including S17 and both amendments), with a named `MISSING` record per clause; observed `clause_scan: total=79 present=0 missing=79`, `missing_clauses=79`, `s17_missing_criteria=7`. **Changed ACs:** P06 checks the seven S17 criteria by content (`criteria_present`); P11 asserts the proposal-tail rule and preserves `watchdog`'s `M1-S15 adds progress signals`/`SC-M1-14` plus verify-gates/closeout extension attributions (`tail_violations=11` pre-change, both preservation checks already OK); P19 asserts the README deviation statement and contents-table identity; P27 asserts twelve linked targets; P32 runs and records both gate invocations with lone-parity classification; P33 proves heading association for each C4/flow heading; P03 asserts the blank line before M2-S11 (`blank_separation=FAIL` pre-change). **Minor:** P34 defines `ptr()` locally (runs alone; `sed_line_address_0_errors=0`). Traceability stays 37 ACs / 37 TCs / 38 procedure blocks; G-1/G-2/G-3/G-6 reworded. |
| 1.4 | 2026-11-10 | @test-plan-writer | DoR iteration-2 remediation against spec v1.5. **F1 (blocking):** P33 adopts Appendix E v1.5's C4 predicate `^## C4 Level $lvl([^0-9]|$)` in both the count and ownership awk, prescribes the committed heading form `## C4 Level 1: system context` (level digit + `: ` + subject), and proves exactly one block per C4 heading and seven per `## Key flows`; fixtures mixed subject/bare headings report `c4_headings_with_diagrams=3/3`, `flow_headings_with_diagrams=7/7`, `heading_association=OK`, while the level-1-without-diagram fixture reports `MISSING`/`fixture_negative=detected`. **Minors:** P06 evidence now uses `ac_numbered_items` (not `ac_items`); item counting uses `[0-9]+` so an eighth item is caught (`extra_self_test=detected (8 items, extra=1)`), duplicate numbers are derived from the criterion number (`duplicate_self_test=detected` on a duplicated `3.`); TC-011 has its own precondition; P19 requires pack-relative README links and proves a `../README.md` self-link is rejected (`readme_self_link_self_test=detected`). Traceability stays 37 ACs / 37 TCs / 38 procedure blocks; G-3 updated. |
| 1.5 | 2026-11-10 | @test-plan-writer | Delivery-blocking contradiction fix. **P03:** blank separation is now **head-anchored** — locate `### M2-S9` in the head, walk to its last non-blank line before the next heading/separator, then require blank + `### M2-S11`; the hunk window stays base-anchored. Pre-change observed `blank_separation=FAIL (head M2-S9 last non-blank=1166; got [] then [---])`; the conforming fixture (M2-S6 gains one task line, M2-S9 shifts by one, M2-S11 inserted after the blank) observes `blank_separation=OK (head M2-S9 last non-blank=1167, blank=1168, M2-S11=1169)`. **P08:** `- AC:` identity now compares the line alone (`grep -m1`), so the changed depends line cannot poison it; pre-change `- AC: identical`, `base_task_lines_missing=0`, and the fixture observes `fixture_task_lines_missing=0`, `fixture_s6_task_lines=3->4`, `fixture_ac_identity=identical`, `fixture_p08=OK`. The two procedures can now pass together on a conforming head. Traceability stays 37 ACs / 37 TCs / 38 procedure blocks. |
| 1.6 | 2026-11-10 | @test-plan-writer | Post-DoR P1 halt: P29 was the third mutually-unsatisfiable gate. **P29:** the shared `entry()` bound now stops at `^---$` and `^## ` as well as `^### `, so the base M2-S9 entry ends at the block close instead of running into Epic M3. Observed: real head, base control, minimal stories-only head, and full amendment+stories head all `stories_compared=65 identical=65 changed=0 order=OK`; negatives `negative_body=detected`, `negative_removed=detected`, `negative_reordered=detected`. **Minors:** TC-008 now states the own-line task shape is the only conforming one (appending into an existing base line gives `base_task_lines_missing=1`); TC-001/TC-003 already consume P03's head-anchored parenthetical, so no stale P1 wording is repeated; this log records the P1 halt and the P29 fix. Traceability stays 37 ACs / 37 TCs / 38 procedure blocks. |
| 1.7 | 2026-11-10 | @test-plan-writer | P4 satisfiability fix. **P26:** the delta-note loop's last token changed from `entrypoint\.md` to `entrypoint.md` (`grep -Fiq` is fixed-string, so the old token required a literal backslash). Conforming fixture `/tmp/sb/.../m2/entrypoint-delta.md` now prints all ten markers `OK`: dispatch, coordinator, state, mcp, daemon, unknown flag, unexpected argument, exit 1, outside this, **entrypoint.md OK**; pre-change real tree remains `delta=absent`. **TC-026** count corrected from eleven to ten. **P11** now bans `Current` on every reconciled header (not only via P13's daemon check); pre-change `current_violations=1` (`daemon.md`), conforming fixture `current_violations=0` / `fixture_conforming=PASS`, and a `Status: Current (GH-224)` doctor fixture yields `doctor.md Current claim (violation)` / `current_violations=1` / `fixture_current_negative=detected`. Traceability stays 37 ACs / 37 TCs / 38 procedure blocks; G-6 updated. |
| 1.8 | 2026-11-10 | @test-plan-writer | P6 halt: forbidden-literals registration. **P28:** expects exactly 31 product files — 30 under `doc/planning/oss-tooling/**` plus `scripts/checks/forbidden-literals.registry.json` — and reports the shape `product_files=31 planning_files=30 registry_files=1 outside_planning_outside_registry=0`; current tree observes `30/30/0/0` (registry missing). **P36:** asserts the twelve `milestones/m2/**` paths are in `registered`, sorted among themselves, duplicate-free, and absent at the corpus baseline; current tree observes `registry_m2=0/12`, `m2_registry_sorted=yes`, `m2_registry_duplicates=0`, `baseline_absent=12/12`, `forbidden_exit=1`, `unregistered_findings=12`; the sorted/duplicate self-tests are `detected`. **P32:** the repo-local run is expected to exit 0 once the registration lands; the lone default-run `ci-baseline-parity` failure remains the only environmental exemption. Traceability stays 37 ACs / 37 TCs / 38 procedure blocks; G-2/G-4/TR-7 updated. |
| 1.9 | 2026-11-10 | @test-plan-writer | Spec v1.7 (DEC-22) two-budget containment. **P28:** the delivery budget is now `BASE...DELIVERY_HEAD` — or equivalently the whole change minus the three phase-7 paths — and is expected at 31 files (30 planning + 1 registry); the phase-7 budget is exactly the three reconciled current-truth docs (`doc/spec/features/feature-resident-daemon.md`, `doc/spec/features/feature-cli-entrypoint.md`, `doc/overview/architecture-overview.md`), giving `spec_files=2`, `overview_files=1`, `phase7_extra=0`, `total_product_files=34`. Current tree observes `product_files=31`, `planning_files=30`, `registry_files=1`, `outside_planning_outside_registry=0`, `forbidden_root_files=0`, `unexpected_planning_paths=0`, `spec_files=2`, `overview_files=1`, `phase7_files=3`, `phase7_extra=0`, `phase7_unknown_paths=0`, `total_product_files=34`, `matcher_self_test=OK`. Negative rule extended to `doc/overview/**`; a fourth `doc/spec` path is caught. Traceability stays 37 ACs / 37 TCs / 38 procedure blocks; NFR-1 row and triage updated. |

## 10. Test Execution Log

Run date 2026-11-10 against base `fab46636` on branch `docs/GH-284/m2-planning`. Most rows record the first pre-change run (`FAIL` proves the procedure detects the missing deliverable; `PASS (control)` proves a preservation property). TC-M2PLAN-028 was re-run on the current tree after delivery, when the registry and the three phase-7 edits exist, to measure the two-budget split.

| TC ID | Run Date | Result | Notes |
|---|---|---|---|
| TC-M2PLAN-001 | 2026-11-10 | FAIL (change absent) | `m2_story_headings=0 new_found=0/7 order=FAIL`; `shape_ok=0/7`; `blank_separation=FAIL (want blank then ### M2-S11; got [] then [---])`; `separator_sequence=identical`. The seven entries do not exist in the base tree. |
| TC-M2PLAN-002 | 2026-11-10 | FAIL (change absent; 61 clauses missing) | `M2-S11 clauses=0/9`, `M2-S12 clauses=0/8`, `M2-S13 clauses=0/11`, `M2-S14 clauses=0/12`, `M2-S15 clauses=0/10`, `M2-S16 clauses=0/11`; `clause_scan: total=61 present=0 missing=61`; 61 named `MISSING` lines, including `S11-AC1: disjoint phase state and queue entries` and `S12-AC2: resolved with a note and unresolved counts`. The oracle bites. |
| TC-M2PLAN-003 | 2026-11-10 | FAIL (vacuous: no hunk) | `insertion window: start=base M2-S9 last content+1=1167 end=head separator-1=1167 window=1167:1167`; `window_empty=no`; `separator_sequence=identical`; `blank_separation=FAIL (head M2-S9 last non-blank=1166; got [] then [---])`; the conforming fixture prints `blank_separation=OK (head M2-S9 last non-blank=1167, blank=1168, M2-S11=1169)` and `fixture_blank_separation=OK`; `backlog_hunks=0`; `FAIL: no backlog hunk (change absent)`; `non_vacuous=no`; `classifier_self_tests=4/4`; `insertion_below_separator=never (negative fixture at separator+2 outside)`. The blank check now reads the head, so the M2-S6 amendment shift cannot break it. |
| TC-M2PLAN-004 | 2026-11-10 | FAIL (change absent) | `S17=absent`; `criteria_present=0/7`. No S17 entry exists in the base tree. |
| TC-M2PLAN-005 | 2026-11-10 | FAIL (change absent) | `S17=absent clauses_present=0/6`; `missing=6`. |
| TC-M2PLAN-006 | 2026-11-10 | FAIL (change absent) | `S17=absent criteria_present=0/7`; `ac_numbered_items=0/7`; `extra_criteria=0`; `duplicate_numbers=0`; `duplicate_self_test=detected`; `extra_self_test=detected (8 items, extra=1)`; all seven `MISSING` lines prove the oracle cannot be satisfied by a bare count. |
| TC-M2PLAN-007 | 2026-11-10 | FAIL (no amendment; oracle self-test passes) | `changed_lines=0 unexpected_lines=0`; `depends=NOT expected (- Depends on: M1-S5, M1-S17.)`; `M2-S4 shape FAIL (no amendment)`. Self-test printed `changed_lines=2 unexpected_lines=2`, so the oracle fires. |
| TC-M2PLAN-008 | 2026-11-10 | FAIL (no amendment; identity controls pass) | `changed_lines=0`; `tasks_clause=MISSING`; `depends=M2-S14 MISSING`; `heading=identical`; `base_task_lines_missing=0`; `- Goal: identical`; `- AC: identical`; `fixture_task_lines_missing=0`; `fixture_s6_task_lines=3->4`; `fixture_ac_identity=identical`; `fixture_p08=OK`. The identity halves and the conforming-fixture proof pass; the amendment is absent. |
| TC-M2PLAN-009 | 2026-11-10 | PASS (control) | `base_headings=67 head_headings=67 added=0 removed=0 unexpected=0`; `retirement_note=identical`; `order=OK`; `negative_control=detected`. This is a passing preservation control on the pre-change tree. The separator/`## Epic M3` byte-and-position clause of AC-F4-1 is asserted by P03 (`separator_sequence=identical`); P09 keeps its heading/order/retirement-note oracle unchanged. |
| TC-M2PLAN-010 | 2026-11-10 | PASS (control) | `fm=byte-identical`; `rg=byte-identical`; `cc=byte-identical`. Passing control. |
| TC-M2PLAN-011 | 2026-11-10 | FAIL (15 drift pages, 11 tail violations, 1 Current claim) | `pages=28`; `M1_planned_hits=9`; `M1_milestone_planned_hits=2`; `forbidden_phrase_pages=11`; `header_attribution=2/14`; `tail_violations=11`; `current_violations=1` (`daemon.md Current claim`); `watchdog_m1s15=OK`; `watchdog_sc=OK`; `verify_gates_extension=OK`; `closeout_extension=OK`; conforming fixture `header_attribution=14/14`, `tail_violations=0`, `current_violations=0`, `fixture_conforming=PASS`; doctor-`Current` fixture `fixture_current_negative=detected`. The preserved clauses already pass; the headers, tails, and daemon `Current` claim do not. |
| TC-M2PLAN-012 | 2026-11-10 | FAIL (change absent) | All three `MISSING`. |
| TC-M2PLAN-013 | 2026-11-10 | FAIL (header); body preservation PASS (control) | `M1-S18 MISSING`; `GH-238 OK`; `not mounted MISSING`; `entrypoint delta MISSING`; `Current=PRESENT`; `daemon_body=byte-identical`. The header is the failing half; the body-identity check is a passing control until the header edit lands. |
| TC-M2PLAN-014 | 2026-11-10 | FAIL (vacuous: no page changed) | `changed_pages=0/14`; `total_hunks=0`; `entrypoint_hunks=0`; `classifier_inside=OK`; `classifier_outside=OK`; `non_vacuous=no`. |
| TC-M2PLAN-015 | 2026-11-10 | FAIL (composition unchanged) | `observed_families=16`; `enumerated_families=14`; `families_not_enumerated=coordinator dispatch`; `dispatch=claimed-not-registered (FAIL)`; `not_registered_extra_families= dispatch`; `desc_hunks=0`; `outside_desc_hunks=0`; `sentences_removed=0`; `sentences_added=0`; `entrypoint_bound=FAILED`; `positive_two_sentence=OK`; `negative_merged=detected`. The two-sentence oracle self-tests fire; the page is still pre-change. |
| TC-M2PLAN-016 | 2026-11-10 | FAIL (change absent) | `new_sections=0`; `2026-11-10 section=absent`; `alternation_self_test=OK`; verdict FAIL. The self-test proves the fixed `23 of 23\|23/23` alternation matches prose; the pre-change tree has no section to scan. |
| TC-M2PLAN-017 | 2026-11-10 | FAIL (pointers absent); byte retention PASS (control) | All four groups retain their bytes (`yes`), but every pointer check is `no` and `g4_pointer=0/1`. Byte retention is a passing control; the four pointers are absent. |
| TC-M2PLAN-018 | 2026-11-10 | FAIL (vacuous: no added line); retention PASS (control) | `windows(base-anchored): newsec=0..-1 title=2..4 paragraph=54..56 scheduling=148..150 items=101..103`; `removed_lines=0`; `added_lines=0`; `section_lines=0`; `pointer_runs=0`; `pointer_windows=0`; `bad_runs=0`; `retention_oracle=FAILED`; `oracle=whole-file-line-retention (whole-section cmp not used)`; `negative_modified=detected`; `negative_outside=detected`; `positive_pointer=permitted`; `reference_whitelist: section_lines=3 pointer_runs=4 pointer_windows=4 bad_runs=0`; `reference_head_fixture=OK`. Retention passes but the file has no addition; the reference fixture proves an appended pointer is counted by its base-anchored window rather than shifting it. |
| TC-M2PLAN-019 | 2026-11-10 | FAIL (change absent); table identity PASS (control) | `pack_files=0/12`; `actual_files=0`; `README=absent`; `readme_self_link_self_test=detected`; `pack_contents_table=byte-identical`. The table-identity half is a passing control; the pack and its deviation statement are absent. |
| TC-M2PLAN-020 | 2026-11-10 | FAIL (change absent) | `architecture=absent`. |
| TC-M2PLAN-021 | 2026-11-10 | FAIL (change absent) | `contracts=absent`. |
| TC-M2PLAN-022 | 2026-11-10 | FAIL (change absent) | `test-scenarios=absent`. |
| TC-M2PLAN-023 | 2026-11-10 | FAIL (change absent) | `journeys=absent`. |
| TC-M2PLAN-024 | 2026-11-10 | FAIL (change absent) | `command_headers=0/6`; all six files absent. |
| TC-M2PLAN-025 | 2026-11-10 | FAIL (change absent) | All six absent; both relationship checks `MISSING`. |
| TC-M2PLAN-026 | 2026-11-10 | FAIL (change absent) | `delta=absent` on the pre-change tree; the conforming delta-note fixture prints all ten markers `OK`, including `entrypoint.md OK`. |
| TC-M2PLAN-027 | 2026-11-10 | FAIL (row absent); M0/M1 preservation PASS (control) | `M2 row=absent`; `m2_targets=0/12`; both M0/M1 rows identical. Row absence is the failing half; row preservation is a passing control. |
| TC-M2PLAN-028 | 2026-11-10 | PASS (delivery 31 + phase 7 3 = 34) | `delivery_range=whole change minus the three phase-7 paths (equals base..the last delivery commit before phase 7)`; `product_files=31`; `planning_files=30`; `registry_files=1`; `outside_planning_outside_registry=0`; `forbidden_root_files=0`; `unexpected_planning_paths=0`; phase-7 list is exactly `doc/overview/architecture-overview.md`, `doc/spec/features/feature-cli-entrypoint.md`, `doc/spec/features/feature-resident-daemon.md`; `spec_files=2`; `overview_files=1`; `phase7_files=3`; `phase7_extra=0`; `phase7_unknown_paths=0`; `total_product_files=34`; `matcher_self_test=OK`; `non_vacuous=yes`. |
| TC-M2PLAN-029 | 2026-11-10 | PASS (control) | `-- real head --` `stories_compared=65 identical=65 changed=0 order=OK` / `real_head=PASS`; `-- base control --` `65/65/0 order=OK` / `base_control=PASS`; `-- minimal stories-only head --` `65/65/0 order=OK` / `minimal_head=PASS`; `-- full amendment + stories head --` `65/65/0 order=OK` / `full_head=PASS`; `negative_body=detected`; `negative_removed=detected`; `negative_reordered=detected`. |
| TC-M2PLAN-030 | 2026-11-10 | FAIL (entrypoint region unchanged); body preservation PASS (control) | `body_identical=14/14`; `desc_hunks=0`; `outside_desc_hunks=0`; `sentences_removed=0`; `sentences_added=0`; `entrypoint_bound=FAILED`. The fourteen-body half is a passing control; the entrypoint region is unchanged. |
| TC-M2PLAN-031 | 2026-11-10 | PASS (control) | `guard_exit=0`; `(guard-doc-distribution)[OK] no drift — 82 in-scope docs; install set matches ados_distribution markers`; `planning_markers=0`. Passing control. |
| TC-M2PLAN-032 | 2026-11-10 | FAIL (registration missing; repo-local gate red) | Pre-change (registration missing): `default_exit=1`; `default_failed_tests=4`; `default_failure_class=delivery`; the four failures are `CI baseline parity (hermetic partial clone)` (cross-device in the default `/tmp`) plus the three forbidden-literals tests (`5/5 scope classes are scanned with 0 violations`; `rename drill document`; `legacy adapter confinement`); `repo_tmpdir_exit=1` (the repaired parity scan still fails on the unregistered pack, plus the three forbidden tests); `gate_verdict=FAIL`. Post-change with the one-file registration: repo-local exits 0, and a default failure is only the lone cross-device parity test, classified environmental. |
| TC-M2PLAN-033 | 2026-11-10 | FAIL (change absent) | `FAIL: doc/planning/oss-tooling/milestones/m2 absent; mermaid fences=0 (<10); association=absent`; the compliant fixture still reports `fixture_good=OK` / `fixture_good_metrics=3/3,7/7,OK`, and the level-1-without-diagram fixture reports `C4 Level 1 has diagram=MISSING` / `fixture_negative=detected`. |
| TC-M2PLAN-034 | 2026-11-10 | FAIL (change absent); retention PASS (control) | `retention_oracle=FAILED`; `oracle=whole-file-line-retention (whole-section cmp not used)`; `pointer_groups=0/4`; `sed_line_address_0_errors=0`. Zero removals is a passing retention control; there are no additions or pointers yet, and the title group is addressable without a `sed` line-address-0 error. |
| TC-M2PLAN-035 | 2026-11-10 | FAIL (change absent; 79 clauses missing) | `clause_scan: total=79 present=0 missing=79`; `missing_clauses=79`; `s17_missing_criteria=7`; `added_criteria=0`; all 79 clause ids printed as `MISSING`, including `S11-AC1`, `S12-AC2`, `S13-AC1`, `S15-AC1`, `S15-AC2`, `S15-AC3`, `S16-AC1`, and `S17-AC3`/`AC4`/`AC6`. The oracle bites on the full clause set. |
| TC-M2PLAN-036 | 2026-11-10 | FAIL (12 unregistered pack documents) | `registered_total=127`; `m2_registry_sorted=yes`; `m2_registry_duplicates=0`; `registry_m2=0/12`; `baseline_absent=12/12`; `registry_sorted_self_test=detected`; `registry_duplicate_self_test=detected`; `forbidden_exit=1`; `unregistered_findings=12`; `added_lines=1665`; `seed_hits=0`; `non_vacuous=yes`. The guard fails closed on the twelve unregistered pack docs; only the registration is missing. |
| TC-M2PLAN-037 | 2026-11-10 | FAIL (vacuous: no changed file) | `changed_planning_files=0`; `broken_links=0`; `restated_ac_blocks=0`; `non_vacuous=no`. |
