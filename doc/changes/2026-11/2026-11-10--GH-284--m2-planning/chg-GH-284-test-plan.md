---
id: chg-GH-284-test-plan
status: Proposed
version: 1.0
created: 2026-11-10T19:30:00Z
last_updated: 2026-11-10T19:30:00Z
owners: [engineering]
service: delivery-os-planning
labels: [change, docs]
version_impact: none
summary: "Docs-only verification of the M2 planning surface: seven new backlog stories (S11-S17) with clause-level fidelity, two dependency amendments, fourteen status-header reconciliations plus one entrypoint sentence, one dated M2 status snapshot with four appended pointers and byte-identical history, the twelve-document milestones/m2 pack, and the milestone index row. 37 acceptance criteria are bound one-to-one to 37 test cases backed by 37 procedures (P01-P37) plus a P00 setup block, each run against base fab46636 before the change so the expected failures are falsifiable; preservation criteria carry byte-level controls and negative self-tests. No product code, no test suite, and no tracker write."
links:
  change_spec: ./chg-GH-284-spec.md
  implementation_plan: ./chg-GH-284-plan.yaml
  testing_strategy: ../../../../.ai/rules/testing-strategy.md
---

# Test Plan - Plan M2: engine-first operations, multi-repo workstations, evidence inspection, and telemetry

## 1. Scope and Objectives

This change writes planning truth, so the risk is documentary and the oracle must be the diff: a story can lose a clause while looking complete, a header can be "reconciled" while the delivered engine prose is rewritten, a status snapshot can erase history, and a pack can exist without the contracts and scenarios a delivery agent needs. Every acceptance criterion is therefore bound to one runnable procedure with a stated expected result, and every preservation claim is a byte comparison against `fab46636` rather than a reading impression. The plan was executed against the pre-change tree: the new-content procedures fail because the change is absent, while the preservation procedures pass as controls and carry mutation self-tests so a green control is not mistaken for evidence that the work is done.

### 1.1 In Scope

- `doc/planning/oss-tooling/backlog.md`: seven new M2 stories (S11-S17), the M2-S4 dependency amendment, the M2-S6 task-plus-dependency amendment, and byte-level preservation of every other entry.
- `doc/planning/oss-tooling/milestones/m1/commands/`: status-header-only edits on the fourteen pages in spec Appendix B, plus the single composition-sentence correction on `entrypoint.md`.
- `doc/planning/oss-tooling/status.md`: one new dated `2026-11-10` section, four appended pointer groups, and byte-identical dated history.
- `doc/planning/oss-tooling/milestones/m2/`: the twelve-document pack (README, architecture, contracts, test-scenarios, journeys, entrypoint delta, six command pages).
- `doc/planning/oss-tooling/milestones/README.md`: one planned M2 index row with the M0/M1 rows untouched.
- Repository guards: `bash scripts/.tests/test-doc-distribution.sh`, `pnpm check`, the Appendix E structural diagram procedure, link resolution, and the forbidden-literals check.

### 1.2 Out of Scope & Known Gaps

- **G-1 — clause meaning is not fully machine-decidable.** AC-F1-2, AC-F2-2, and AC-NFR8-1 require "no clause weakened, moved, merged, or changed in meaning". P02/P05 prove the presence of 87 named anchors; they cannot prove that a sentence still carries the same normative force. **Compensation:** the reviewer performs a clause-by-clause read of the seven entries against GH-284 using the anchor matrix as the checklist, and records the verdict in the PR; the matrix makes a silent drop visible because each ticket clause has at least one anchor. Owner: `@reviewer` at phase 8.
- **G-2 — the aggregate gate is environment-sensitive.** `tests/checks/ci-baseline-parity.test.ts` runs `git clone --local`, which fails with a cross-device hardlink error when `tmpdir()` is on a different filesystem (`/tmp` is tmpfs in this checkout). This is pre-existing and unrelated to the change. **Compensation:** P32 records the default run and a `TMPDIR`-on-repository-filesystem re-run; CI is the authoritative gate. Owner: `@runner` at phase 9.
- **G-3 — mermaid syntax validity is not testable here.** The repository has no mermaid validator (spec DEC-15), so AC-NFR6-1 is proven structurally by P33: fence count, keyword first line, balanced fences, required headings, and the 3+6+1 inventory. A syntax error that still satisfies those conditions would not be caught. **Compensation:** reviewer opens the rendered GitHub preview for the architecture document. Owner: `@reviewer`.
- **G-4 — private-name hygiene is partly judgment.** The forbidden-literals guard covers configured literals and the seed scan covers `ados`/`ADOS_`/`~/.ados`; it cannot enumerate every hosted, fleet, or proprietary name. **Compensation:** reviewer reads the added lines against spec NFR-9 and §7.2. Owner: `@reviewer`.
- **G-5 — "restated acceptance criteria" has a semantic residue.** P37 catches `- AC:` blocks and `**Given**` blocks; a paraphrase in prose is not machine-detectable. **Compensation:** reviewer reads the pack for any restated criterion and checks that it references story codes instead. Owner: `@reviewer`.
- **G-6 — header wording quality is approximated.** The checks ban `M1 planned`/`M1 milestone planned` and require delivered story codes plus GH references, but an ambiguous header can pass the tokens. **Compensation:** the reviewer reads the fifteen edited headers once; the spec's reconciliation rule (F-5) is the standard. Owner: `@reviewer`.
- **G-7 — `pnpm check` proves no-regression, not document correctness.** It can stay green while a story loses a clause. It is a containment gate only; the content procedures carry the requirements.
- **G-8 — passing preservation controls are not evidence of delivery.** P09, P10, P18, P29, P31, and P34 pass on the pre-change tree, and P36's guard half passes because nothing has changed yet. They become evidence only together with the non-vacuity guards and the diff-based procedures; the execution log labels them `PASS (control)`.
- **G-9 — pack content quality is review, not a command.** The procedures prove the pack has the required headings, surfaces, scenario counts, and command sections; they do not prove the architecture is sound, the contracts are internally consistent, or a scenario is the right scenario. **Compensation:** the reviewer reads `architecture.md`, `contracts.md`, `test-scenarios.md`, and `journeys.md` against the ticket's blueprint brief and records the verdict; the story-to-artifact map in the README is the index for that read. Owner: `@reviewer`.
- **Not applicable:** unit, integration, contract-execution, E2E, performance, migration, telemetry, and security-surface testing. There is no runtime code path, schema, or emitted artifact. Per `.ai/rules/testing-strategy.md`, a docs-only change uses static/diff and content checks plus the repository guards, and adds no committed test code; NFR-1 forbids touching `tests/**` and `scripts/**` anyway.

## 2. References

| Reference | Role in this plan |
|---|---|
| [`chg-GH-284-spec.md`](./chg-GH-284-spec.md) v1.1 | Binding source: F-1..F-11, AC-F1-1..AC-NFR10-1 (37 ACs), NFR-1..NFR-10, DM-1..DM-4, DEC-1..DEC-15, RSK-1..RSK-10, Appendix B (page set), Appendix C (observed entrypoint), Appendix D (pack manifest), Appendix E (structural diagram procedure) |
| [`chg-GH-284-pm-notes.yaml`](./chg-GH-284-pm-notes.yaml) | Binding decisions: S17 scope, daemon resolution, 14+1 reconciliation shape, history handling, no distribution marker, index registration, and the v1.1 reopen that replaced the non-existent mermaid validator |
| GH-284 ticket (`juliusz-cwiakalski/agentic-delivery-os#284`) | Normative story text for the clause anchors in P02/P05 and the S17 acceptance list; read at authoring time |
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
| AC-F1-1 | Seven new M2 stories land in order with the story shape | TC-M2PLAN-001 | Covered |
| AC-F1-2 | Clause anchors for S11-S16 are present in each story entry | TC-M2PLAN-002 | Covered |
| AC-F1-3 | Append-only placement and hunk containment in the backlog | TC-M2PLAN-003 | Covered |
| AC-F2-1 | S17 entry carries goal, six task clauses, seven ACs, and the full dependency set | TC-M2PLAN-004 | Covered |
| AC-F2-2 | S17 six task clauses are present and none is softened | TC-M2PLAN-005 | Covered |
| AC-F2-3 | S17 acceptance block keeps seven independently identifiable criteria | TC-M2PLAN-006 | Covered |
| AC-F3-1 | M2-S4 changes only its `- Depends on:` line | TC-M2PLAN-007 | Covered |
| AC-F3-2 | M2-S6 gains the telemetry task and dependency, nothing else | TC-M2PLAN-008 | Covered |
| AC-F4-1 | Existing headings, story codes, order, and the Epic M2 retirement note survive | TC-M2PLAN-009 | Covered |
| AC-F4-2 | Frontmatter, reading guide, and cross-cutting principles are byte-identical | TC-M2PLAN-010 | Covered |
| AC-F5-1 | No delivered command is still called planned; the fourteen pages name delivered truth | TC-M2PLAN-011 | Covered |
| AC-F5-2 | board, watchdog, and mcp name their owning future story | TC-M2PLAN-012 | Covered |
| AC-F5-3 | daemon header corrects reachability while the delivered engine body survives | TC-M2PLAN-013 | Covered |
| AC-F5-4 | Every reconciled page changes only in its status header; entrypoint changes one sentence | TC-M2PLAN-014 | Covered |
| AC-F6-1 | The entrypoint page lists exactly the sixteen observed families and names the absent ones | TC-M2PLAN-015 | Covered |
| AC-F7-1 | The new dated status section states M1 delivery, the M2 planning state, and the early inputs | TC-M2PLAN-016 | Covered |
| AC-F7-2 | The four superseded statement groups carry appended pointers and keep their bytes | TC-M2PLAN-017 | Covered |
| AC-F7-3 | Every dated historical status section is byte-identical | TC-M2PLAN-018 | Covered |
| AC-F8-1 | The M2 pack contains exactly the twelve documents and the README maps each one | TC-M2PLAN-019 | Covered |
| AC-F8-2 | Architecture carries C4 L1/L2/L3, the six flows plus park/resume, and the deltas | TC-M2PLAN-020 | Covered |
| AC-F8-3 | Contracts cover every named M2 surface including the S17 additions | TC-M2PLAN-021 | Covered |
| AC-F8-4 | At least two SC-M2 scenarios exist for every story S2-S17, with the twelve mandatory scenarios | TC-M2PLAN-022 | Covered |
| AC-F8-5 | Journeys include the four operator journeys and the S17 cost-control journey | TC-M2PLAN-023 | Covered |
| AC-F9-1 | Six command pages carry the pack header, a bare name, and no working name | TC-M2PLAN-024 | Covered |
| AC-F9-2 | Each command page carries the required body sections and the family relationships | TC-M2PLAN-025 | Covered |
| AC-F10-1 | The entrypoint delta note records the observed composition, planned additions, and the daemon gap | TC-M2PLAN-026 | Covered |
| AC-F11-1 | The milestone index gains one planned M2 row and leaves the M0/M1 rows untouched | TC-M2PLAN-027 | Covered |
| AC-NFR1-1 | Every product file changed is under the planning corpus, with zero code, test, tooling, or spec paths | TC-M2PLAN-028 | Covered |
| AC-NFR2-1 | Every non-amended story body is byte-identical to the base revision | TC-M2PLAN-029 | Covered |
| AC-NFR3-1 | Reconciled page bodies stay byte-identical and the entrypoint changes exactly one sentence | TC-M2PLAN-030 | Covered |
| AC-NFR4-1 | The doc-distribution guard stays green and no planning marker is added | TC-M2PLAN-031 | Covered |
| AC-NFR5-1 | The aggregate gate exits 0 on the branch head | TC-M2PLAN-032 | Covered |
| AC-NFR6-1 | The M2 diagrams satisfy the five structural conditions and the 3+6+1 inventory | TC-M2PLAN-033 | Covered |
| AC-NFR7-1 | Dated history and the original pointer-group sentences stay byte-identical | TC-M2PLAN-034 | Covered |
| AC-NFR8-1 | Clause fidelity counts are zero missing, zero added, zero changed meaning | TC-M2PLAN-035 | Covered |
| AC-NFR9-1 | No forbidden or private literal is introduced by the change | TC-M2PLAN-036 | Covered |
| AC-NFR10-1 | No relative link is broken and no pack document restates an acceptance-criteria block | TC-M2PLAN-037 | Covered |

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
| DM-4 | Dated status snapshot section | TC-M2PLAN-016..018, TC-M2PLAN-034 | Content, pointers, and byte-identical history |

API-# / EVT-#: none exist in the spec; nothing to cover.

### 3.3 Non-Functional Coverage (NFR-#)

| NFR ID | Requirement | TC ID | Status |
|---|---|---|---|
| NFR-1 | Docs-only containment | TC-M2PLAN-028 | Covered (diff shape) |
| NFR-2 | Backlog preservation | TC-M2PLAN-003, TC-M2PLAN-007, TC-M2PLAN-008, TC-M2PLAN-009, TC-M2PLAN-010, TC-M2PLAN-029 | Covered (byte comparisons plus hunk confinement) |
| NFR-3 | Command-page containment | TC-M2PLAN-013, TC-M2PLAN-014, TC-M2PLAN-030 | Covered (hunk ranges plus body bytes) |
| NFR-4 | Doc-distribution guard | TC-M2PLAN-031 | Covered (guard execution) |
| NFR-5 | Aggregate gate | TC-M2PLAN-032 | Covered (gate execution; environment caveat G-2) |
| NFR-6 | Diagram structure | TC-M2PLAN-033 | Covered (structural procedure; syntax gap G-3) |
| NFR-7 | Status history integrity | TC-M2PLAN-017, TC-M2PLAN-018, TC-M2PLAN-034 | Covered (byte comparisons plus retained sentences) |
| NFR-8 | Story fidelity | TC-M2PLAN-002, TC-M2PLAN-005, TC-M2PLAN-035 | Covered mechanically; meaning residue G-1 |
| NFR-9 | Public/OSS hygiene | TC-M2PLAN-036 | Covered by guard plus read; residue G-4 |
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
| TC-M2PLAN-001 | Seven new M2 stories land in order with the story shape | Happy Path | Critical | High | AC-F1-1 | Static/diff + content |
| TC-M2PLAN-002 | Clause anchors for S11-S16 are present in each story entry | Happy Path | Critical | High | AC-F1-2 | Static/diff + content |
| TC-M2PLAN-003 | Append-only placement and hunk containment in the backlog | Regression | Critical | High | AC-F1-3 | Static/diff + content |
| TC-M2PLAN-004 | S17 entry carries goal, six task clauses, seven ACs, and the full dependency set | Happy Path | Critical | High | AC-F2-1 | Static/diff + content |
| TC-M2PLAN-005 | S17 six task clauses are present and none is softened | Happy Path | Critical | High | AC-F2-2 | Static/diff + content |
| TC-M2PLAN-006 | S17 acceptance block keeps seven independently identifiable criteria | Happy Path | Important | High | AC-F2-3 | Static/diff + content |
| TC-M2PLAN-007 | M2-S4 changes only its `- Depends on:` line | Regression | Critical | High | AC-F3-1 | Static/diff + content |
| TC-M2PLAN-008 | M2-S6 gains the telemetry task and dependency, nothing else | Regression | Critical | High | AC-F3-2 | Static/diff + content |
| TC-M2PLAN-009 | Existing headings, story codes, order, and the Epic M2 retirement note survive | Regression | Critical | High | AC-F4-1 | Static/diff + content |
| TC-M2PLAN-010 | Frontmatter, reading guide, and cross-cutting principles are byte-identical | Regression | Critical | High | AC-F4-2 | Static/diff + content |
| TC-M2PLAN-011 | No delivered command is still called planned; the fourteen pages name delivered truth | Negative | Critical | High | AC-F5-1 | Static/diff + content |
| TC-M2PLAN-012 | board, watchdog, and mcp name their owning future story | Happy Path | Important | High | AC-F5-2 | Static/diff + content |
| TC-M2PLAN-013 | daemon header corrects reachability while the delivered engine body survives | Corner Case | Critical | High | AC-F5-3 | Static/diff + content |
| TC-M2PLAN-014 | Every reconciled page changes only in its status header; entrypoint changes one sentence | Negative | Critical | High | AC-F5-4 | Static/diff + content |
| TC-M2PLAN-015 | The entrypoint page lists exactly the sixteen observed families and names the absent ones | Happy Path | Critical | High | AC-F6-1 | Static/diff + content |
| TC-M2PLAN-016 | The new dated status section states M1 delivery, the M2 planning state, and the early inputs | Happy Path | Critical | High | AC-F7-1 | Static/diff + content |
| TC-M2PLAN-017 | The four superseded statement groups carry appended pointers and keep their bytes | Happy Path | Important | High | AC-F7-2 | Static/diff + content |
| TC-M2PLAN-018 | Every dated historical status section is byte-identical | Regression | Critical | High | AC-F7-3 | Static/diff + content |
| TC-M2PLAN-019 | The M2 pack contains exactly the twelve documents and the README maps each one | Happy Path | Critical | High | AC-F8-1 | Static/diff + content |
| TC-M2PLAN-020 | Architecture carries C4 L1/L2/L3, the six flows plus park/resume, and the deltas | Happy Path | Critical | High | AC-F8-2 | Static/diff + content |
| TC-M2PLAN-021 | Contracts cover every named M2 surface including the S17 additions | Happy Path | Critical | High | AC-F8-3 | Static/diff + content |
| TC-M2PLAN-022 | At least two SC-M2 scenarios exist for every story S2-S17, with the twelve mandatory scenarios | Happy Path | Critical | High | AC-F8-4 | Static/diff + content |
| TC-M2PLAN-023 | Journeys include the four operator journeys and the S17 cost-control journey | Happy Path | Important | High | AC-F8-5 | Static/diff + content |
| TC-M2PLAN-024 | Six command pages carry the pack header, a bare name, and no working name | Happy Path | Critical | High | AC-F9-1 | Static/diff + content |
| TC-M2PLAN-025 | Each command page carries the required body sections and the family relationships | Happy Path | Critical | High | AC-F9-2 | Static/diff + content |
| TC-M2PLAN-026 | The entrypoint delta note records the observed composition, planned additions, and the daemon gap | Happy Path | Critical | High | AC-F10-1 | Static/diff + content |
| TC-M2PLAN-027 | The milestone index gains one planned M2 row and leaves the M0/M1 rows untouched | Happy Path | Important | High | AC-F11-1 | Static/diff + content |
| TC-M2PLAN-028 | Every product file changed is under the planning corpus, with zero code, test, tooling, or spec paths | Negative | Critical | High | AC-NFR1-1 | Static/diff + content |
| TC-M2PLAN-029 | Every non-amended story body is byte-identical to the base revision | Regression | Critical | High | AC-NFR2-1 | Static/diff + content |
| TC-M2PLAN-030 | Reconciled page bodies stay byte-identical and the entrypoint changes exactly one sentence | Negative | Critical | High | AC-NFR3-1 | Static/diff + content |
| TC-M2PLAN-031 | The doc-distribution guard stays green and no planning marker is added | Regression | Important | Medium | AC-NFR4-1 | Guard |
| TC-M2PLAN-032 | The aggregate gate exits 0 on the branch head | Regression | Critical | High | AC-NFR5-1 | Guard |
| TC-M2PLAN-033 | The M2 diagrams satisfy the five structural conditions and the 3+6+1 inventory | Corner Case | Critical | High | AC-NFR6-1 | Structural |
| TC-M2PLAN-034 | Dated history and the original pointer-group sentences stay byte-identical | Regression | Critical | High | AC-NFR7-1 | Static/diff + content |
| TC-M2PLAN-035 | Clause fidelity counts are zero missing, zero added, zero changed meaning | Corner Case | Critical | High | AC-NFR8-1 | Static/diff + content |
| TC-M2PLAN-036 | No forbidden or private literal is introduced by the change | Negative | Important | Medium | AC-NFR9-1 | Static/diff + content |
| TC-M2PLAN-037 | No relative link is broken and no pack document restates an acceptance-criteria block | Corner Case | Important | Medium | AC-NFR10-1 | Static/diff + content |

### 5.2 Scenario Details

#### TC-M2PLAN-001 - Seven new M2 stories land in order with the story shape

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
2. Read the seven headings once and confirm each is a sibling `###` entry inside Epic M2, after `### M2-S9` and before `## Epic M3`.

**Expected Outcome**:

- `m2_story_headings=7 new_found=7/7 order=OK`; `shape_ok=7/7`; exit 0.
- Each new entry carries `- Goal:`, `- Tasks:`, `- AC:`, `- Depends on:` and no `- Ticket:` line.

**Notes / Clarifications**:

- Observed on the pre-change tree (2026-11-10, base `fab46636`, before any deliverable edit): `m2_story_headings=0 new_found=0/7 order=FAIL`; `shape_ok=0/7`; verdict FAIL. The seven entries do not exist in the base tree.
- Result label for Section 10: **FAIL (change absent)**.

#### TC-M2PLAN-002 - Clause anchors for S11-S16 are present in each story entry

**Scenario Type**: Happy Path
**Impact Level**: Critical
**Priority**: High
**Related IDs**: AC-F1-2, F-1, NFR-8
**Test Type(s)**: Manual (static/diff and content inspection)
**Automation Level**: Semi-automated (uncommitted procedure)
**Target Layer / Location**: `backlog.md`, the six new entries
**Tags**: @docs, @backlog, @fidelity

**Preconditions**:

- Worktree at `docs/GH-284/m2-planning`; `git` available; base commit `fab46636cc0b5abfbd22257711f594adc0af4660` fetched.
- Section 7.1 P00 has been run once in the same shell (base snapshots and helpers).

**Steps**:

1. Run procedure **P02** (Section 7.1).
2. Read each story once against its GH-284 section and confirm no anchor is present only as a negation; the anchor matrix proves presence, the read proves meaning (declared gap G-1).

**Expected Outcome**:

- `clauses_present=81/81`; each `M2-S11`..`M2-S16` line reports `anchors=n/n`; exit 0.

**Notes / Clarifications**:

- Observed on the pre-change tree (2026-11-10, base `fab46636`, before any deliverable edit): `M2-S11=0/10`, `M2-S12=0/15`, `M2-S13=0/11`, `M2-S14=0/21`, `M2-S15=0/12`, `M2-S16=0/12`; `clauses_present=0/81`; verdict FAIL.
- Result label for Section 10: **FAIL (change absent)**.

#### TC-M2PLAN-003 - Append-only placement and hunk containment in the backlog

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

1. Run procedure **P03** (Section 7.1).
2. Confirm `backlog_hunks>=1`, `non_vacuous=yes`, and `hunks: inside=N outside=0`; the classifier self-tests must print `2/2` first.

**Expected Outcome**:

- `backlog_hunks=N` with `N>=1`; every hunk inside one of the seven new entries or the two amended entries; `hunks: inside=N outside=0`; `hunk confinement OK`; `classifier_self_tests=2/2`; exit 0.

**Notes / Clarifications**:

- Observed on the pre-change tree (2026-11-10, base `fab46636`, before any deliverable edit): `backlog_hunks=0`; `FAIL: no backlog hunk (change absent)`; `non_vacuous=no`; `classifier_self_tests=2/2`. The classifier is proven live; the tree has nothing to classify yet.
- Result label for Section 10: **FAIL (vacuous: no hunk)**.

#### TC-M2PLAN-004 - S17 entry carries goal, six task clauses, seven ACs, and the full dependency set

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

1. Run procedure **P04** (Section 7.1).
2. Read the dependency line and confirm `(#280)` is present as the owner-hold semantics, not a bare issue reference.

**Expected Outcome**:

- All four labels present; `depends: M1-S15 OK`, `M1-S18 OK`, `M1-S21 OK`, `M1-S22 OK`, `M2-S14 OK`, `#280 OK`; `ac_numbered_items=7/7`.

**Notes / Clarifications**:

- Observed on the pre-change tree (2026-11-10, base `fab46636`, before any deliverable edit): `S17=absent`; verdict FAIL. No S17 entry exists in the base tree.
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

#### TC-M2PLAN-006 - S17 acceptance block keeps seven independently identifiable criteria

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

**Steps**:

1. Run procedure **P06** (Section 7.1).
2. Read the block and confirm it is `- AC:` followed by an indented numbered list, not one inline sentence.

**Expected Outcome**:

- `ac_items=7/7`; `duplicate_numbers=0`; each item is a distinct `1.`..`7.` line; exit 0.

**Notes / Clarifications**:

- Observed on the pre-change tree (2026-11-10, base `fab46636`, before any deliverable edit): `S17=absent ac_items=0/7`; `ac_items=0`.
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

**Steps**:

1. Run procedure **P08** (Section 7.1).
2. Confirm the only changed lines are inside `- Tasks:` and on `- Depends on:`, and that heading, goal, and `- AC:` are byte-identical.

**Expected Outcome**:

- `changed_lines` covers only Tasks/Depends; `tasks_clause=OK`; `depends=M2-S14 OK`; `heading=identical`; `base_task_lines_missing=0`; `- Goal: identical`; `- AC: identical`.

**Notes / Clarifications**:

- Observed on the pre-change tree (2026-11-10, base `fab46636`, before any deliverable edit): `changed_lines=0`; `tasks_clause=MISSING`; `depends=M2-S14 MISSING`; `heading=identical`; `base_task_lines_missing=0`; `- Goal: identical`; `- AC: identical`. The identity halves are a passing control; the amendment is absent.
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

- Observed on the pre-change tree (2026-11-10, base `fab46636`, before any deliverable edit): `base_headings=67 head_headings=67 added=0 removed=0 unexpected=0`; `retirement_note=identical`; `order=OK`; `negative_control=detected`. This is a passing preservation control on the pre-change tree; the non-vacuity half is supplied by P01 and by the mutation control.
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

#### TC-M2PLAN-011 - No delivered command is still called planned; the fourteen pages name delivered truth

**Scenario Type**: Negative
**Impact Level**: Critical
**Priority**: High
**Related IDs**: AC-F5-1, F-5, DM-2
**Test Type(s)**: Manual (static/diff and content inspection)
**Automation Level**: Semi-automated (uncommitted procedure)
**Target Layer / Location**: `milestones/m1/commands/*.md`, 28 pages
**Tags**: @docs, @commands, @negative

**Preconditions**:

- Worktree at `docs/GH-284/m2-planning`; `git` available; base commit `fab46636cc0b5abfbd22257711f594adc0af4660` fetched.
- Section 7.1 P00 has been run once in the same shell (base snapshots and helpers).
- P11 has run first (it defines the `NEED` page map used by this procedure).

**Steps**:

1. Run procedure **P11** (Section 7.1).
2. Confirm `pages=28`, `forbidden_phrase_pages=0`, and `header_attribution=14/14` (story code and GH reference in the header region).

**Expected Outcome**:

- `pages=28`; `forbidden_phrase_pages=0`; `header_attribution=14/14`; no `missing:` lines.

**Notes / Clarifications**:

- Observed on the pre-change tree (2026-11-10, base `fab46636`, before any deliverable edit): `pages=28`; `M1_planned_hits=9`; `M1_milestone_planned_hits=2`; `forbidden_phrase_pages=11`; `header_attribution=2/14` (`plan.md` and `commit.md` already carry their GH references but still contain `M1 milestone planned`). Missing tokens printed for the other twelve pages.
- Result label for Section 10: **FAIL (15 drift pages)**.

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

#### TC-M2PLAN-014 - Every reconciled page changes only in its status header; entrypoint changes one sentence

**Scenario Type**: Negative
**Impact Level**: Critical
**Priority**: High
**Related IDs**: AC-F5-4, F-5, NFR-3, DEC-13
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
2. Confirm `changed_pages=14/14`, `total_hunks>=14`, every hunk inside the header region, and `entrypoint_hunks=1`; the classifier self-tests must print `OK` first.

**Expected Outcome**:

- `changed_pages=14/14`; each page `inside=N outside=0`; `entrypoint_hunks=1`; `non_vacuous=yes`; `classifier_inside=OK`; `classifier_outside=OK`.

**Notes / Clarifications**:

- Observed on the pre-change tree (2026-11-10, base `fab46636`, before any deliverable edit): `changed_pages=0/14`; `total_hunks=0`; `entrypoint_hunks=0`; `classifier_inside=OK`; `classifier_outside=OK`; `non_vacuous=no`.
- Result label for Section 10: **FAIL (vacuous: no page changed)**.

#### TC-M2PLAN-015 - The entrypoint page lists exactly the sixteen observed families and names the absent ones

**Scenario Type**: Happy Path
**Impact Level**: Critical
**Priority**: High
**Related IDs**: AC-F6-1, F-6, NFR-3, DEC-8
**Test Type(s)**: Manual (static/diff and content inspection)
**Automation Level**: Semi-automated (uncommitted procedure)
**Target Layer / Location**: `milestones/m1/commands/entrypoint.md`, DESCRIPTION
**Tags**: @docs, @commands, @entrypoint

**Preconditions**:

- Worktree at `docs/GH-284/m2-planning`; `git` available; base commit `fab46636cc0b5abfbd22257711f594adc0af4660` fetched.
- Section 7.1 P00 has been run once in the same shell (base snapshots and helpers).

**Steps**:

1. Run procedure **P15** (Section 7.1), which derives the family set from live root `--help`.
2. Confirm the composed list has 16 names, `families_not_composed` is empty, `dispatch` is not in the not-registered clause, and the description diff is exactly one replaced sentence.

**Expected Outcome**:

- `observed_families=16`; `composed_families=16`; `families_not_composed=` (empty); `not_registered: state/mcp/resident daemon OK`; `dispatch=not-claimed-absent OK`; `description_changed_sentence_lines=2` (one removed plus one added sentence, no other).

**Notes / Clarifications**:

- Observed on the pre-change tree (2026-11-10, base `fab46636`, before any deliverable edit): `observed_families=16`; `composed_families=14`; `families_not_composed=coordinator dispatch`; `dispatch=claimed-not-registered (FAIL)`; `description_changed_sentence_lines=0`.
- Result label for Section 10: **FAIL (composition sentence unchanged)**.

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
2. Confirm the section is dated `2026-11-10`, repeats that story delivery is not milestone exit, and names no M0/M1 exit.

**Expected Outcome**:

- `new_sections=1`; every marker `OK`; `exit_overclaim=ABSENT`; echo of the section heading.

**Notes / Clarifications**:

- Observed on the pre-change tree (2026-11-10, base `fab46636`, before any deliverable edit): `new_sections=0`; `2026-11-10 section=absent`; verdict FAIL.
- Result label for Section 10: **FAIL (change absent)**.

#### TC-M2PLAN-017 - The four superseded statement groups carry appended pointers and keep their bytes

**Scenario Type**: Happy Path
**Impact Level**: Important
**Priority**: High
**Related IDs**: AC-F7-2, F-7, NFR-7, DEC-5
**Test Type(s)**: Manual (static/diff and content inspection)
**Automation Level**: Semi-automated (uncommitted procedure)
**Target Layer / Location**: `status.md`, title, M0-exit paragraph, 2026-11-07 scheduling section, next-steps items 1-3
**Tags**: @docs, @status, @pointers

**Preconditions**:

- Worktree at `docs/GH-284/m2-planning`; `git` available; base commit `fab46636cc0b5abfbd22257711f594adc0af4660` fetched.
- Section 7.1 P00 has been run once in the same shell (base snapshots and helpers).

**Steps**:

1. Run procedure **P17** (Section 7.1).
2. Read each pointer once and confirm it sits adjacent to the statement rather than inside the original sentence.

**Expected Outcome**:

- `title_base_retained=yes` and `title_pointer=yes`; `g2/g3/g4_bytes_retained=yes`; `g2_pointer=yes`; `g3_pointer=yes`; `g4_pointers=3/3`.

**Notes / Clarifications**:

- Observed on the pre-change tree (2026-11-10, base `fab46636`, before any deliverable edit): All four groups retain their bytes (`yes`), but every pointer check is `no` and `g4_pointers=0/3`. Byte retention is a passing control; the pointers are absent.
- Result label for Section 10: **FAIL (pointers absent); byte retention PASS (control)**.

#### TC-M2PLAN-018 - Every dated historical status section is byte-identical

**Scenario Type**: Regression
**Impact Level**: Critical
**Priority**: High
**Related IDs**: AC-F7-3, F-7, NFR-7
**Test Type(s)**: Manual (static/diff and content inspection)
**Automation Level**: Semi-automated (uncommitted procedure)
**Target Layer / Location**: `status.md`, all seven base `##` sections
**Tags**: @docs, @diff, @history

**Preconditions**:

- Worktree at `docs/GH-284/m2-planning`; `git` available; base commit `fab46636cc0b5abfbd22257711f594adc0af4660` fetched.
- Section 7.1 P00 has been run once in the same shell (base snapshots and helpers).

**Steps**:

1. Run procedure **P18** (Section 7.1).
2. Confirm no `CHANGED:` line and that the only added section is the new dated M2 section.

**Expected Outcome**:

- `sections_identical=7/7`; the new section is the only `##` heading not present in the base snapshot.

**Notes / Clarifications**:

- Observed on the pre-change tree (2026-11-10, base `fab46636`, before any deliverable edit): `sections_identical=7/7`. Passing control on the pre-change tree.
- Result label for Section 10: **PASS (control)**.

#### TC-M2PLAN-019 - The M2 pack contains exactly the twelve documents and the README maps each one

**Scenario Type**: Happy Path
**Impact Level**: Critical
**Priority**: High
**Related IDs**: AC-F8-1, F-8, F-10, DM-3
**Test Type(s)**: Manual (static/diff and content inspection)
**Automation Level**: Semi-automated (uncommitted procedure)
**Target Layer / Location**: `milestones/m2/` tree and `README.md`
**Tags**: @docs, @pack

**Preconditions**:

- Worktree at `docs/GH-284/m2-planning`; `git` available; base commit `fab46636cc0b5abfbd22257711f594adc0af4660` fetched.
- Section 7.1 P00 has been run once in the same shell (base snapshots and helpers).

**Steps**:

1. Run procedure **P19** (Section 7.1).
2. Confirm `actual_files=12`, no extra file, and the README lists all twelve with a story-to-artifact map.

**Expected Outcome**:

- `pack_files=12/12`; `actual_files=12 (expected 12)`; `readme_lists=12/12`; `story_map_entries>=1`.

**Notes / Clarifications**:

- Observed on the pre-change tree (2026-11-10, base `fab46636`, before any deliverable edit): `pack_files=0/12`; `actual_files=0`; `README=absent`.
- Result label for Section 10: **FAIL (change absent)**.

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

- All eleven markers `OK`, including `dispatch`, `coordinator`, `state`, `mcp`, `daemon`, `unknown flag`, `unexpected argument`, `exit 1`, `outside this`, `entrypoint.md`.

**Notes / Clarifications**:

- Observed on the pre-change tree (2026-11-10, base `fab46636`, before any deliverable edit): `delta=absent`.
- Result label for Section 10: **FAIL (change absent)**.

#### TC-M2PLAN-027 - The milestone index gains one planned M2 row and leaves the M0/M1 rows untouched

**Scenario Type**: Happy Path
**Impact Level**: Important
**Priority**: High
**Related IDs**: AC-F11-1, F-11, DM-3
**Test Type(s)**: Manual (static/diff and content inspection)
**Automation Level**: Semi-automated (uncommitted procedure)
**Target Layer / Location**: `milestones/README.md`, `## Index`
**Tags**: @docs, @pack, @index

**Preconditions**:

- Worktree at `docs/GH-284/m2-planning`; `git` available; base commit `fab46636cc0b5abfbd22257711f594adc0af4660` fetched.
- Section 7.1 P00 has been run once in the same shell (base snapshots and helpers).

**Steps**:

1. Run procedure **P27** (Section 7.1).
2. Confirm the row links `m2/README.md` and each artifact, and that the milestone label is marked planned.

**Expected Outcome**:

- `M2 row=present`; every artifact link found; `m2_row_marked_planned=yes`; `M0 ... row=identical`; `M1 ... row=identical`.

**Notes / Clarifications**:

- Observed on the pre-change tree (2026-11-10, base `fab46636`, before any deliverable edit): `M2 row=absent`; `m2_row_marked_planned=no`; both M0/M1 rows identical. Row absence is the failing half; row preservation is a passing control.
- Result label for Section 10: **FAIL (row absent); M0/M1 preservation PASS (control)**.

#### TC-M2PLAN-028 - Every product file changed is under the planning corpus, with zero code, test, tooling, or spec paths

**Scenario Type**: Negative
**Impact Level**: Critical
**Priority**: High
**Related IDs**: AC-NFR1-1, NFR-1
**Test Type(s)**: Manual (static/diff and content inspection)
**Automation Level**: Semi-automated (uncommitted procedure)
**Target Layer / Location**: branch diff vs `fab46636`, excluding `doc/changes/**`
**Tags**: @diff, @containment

**Preconditions**:

- Worktree at `docs/GH-284/m2-planning`; `git` available; base commit `fab46636cc0b5abfbd22257711f594adc0af4660` fetched.
- Section 7.1 P00 has been run once in the same shell (base snapshots and helpers).

**Steps**:

1. Run procedure **P28** (Section 7.1).
2. Confirm the changed set is exactly the five planned groups (backlog, status, milestone index, 15 M1 command pages, 12 M2 pack documents) and nothing else.

**Expected Outcome**:

- `product_files=30`; `forbidden_root_files=0`; `outside_planning=0`; `unexpected_paths=0`; `non_vacuous=yes`; `matcher_self_test=OK`.

**Notes / Clarifications**:

- Observed on the pre-change tree (2026-11-10, base `fab46636`, before any deliverable edit): `product_files=0`; `forbidden_root_files=0`; `outside_planning=0`; `unexpected_paths=0`; `non_vacuous=no (no product file changed)`. Zero is a containment pass but not evidence the change exists; hence FAIL for non-vacuity.
- Result label for Section 10: **FAIL (vacuous: no product file changed)**.

#### TC-M2PLAN-029 - Every non-amended story body is byte-identical to the base revision

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

1. Run procedure **P29** (Section 7.1).
2. Confirm `stories_compared=65`, `changed=0`, and no `body CHANGED:` line.

**Expected Outcome**:

- `stories_compared=65 identical=65 changed=0`.

**Notes / Clarifications**:

- Observed on the pre-change tree (2026-11-10, base `fab46636`, before any deliverable edit): `stories_compared=65 identical=65 changed=0`. Passing control.
- Result label for Section 10: **PASS (control)**.

#### TC-M2PLAN-030 - Reconciled page bodies stay byte-identical and the entrypoint changes exactly one sentence

**Scenario Type**: Negative
**Impact Level**: Critical
**Priority**: High
**Related IDs**: AC-NFR3-1, NFR-3, F-5
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
2. Confirm all fourteen bodies are byte-identical and that the entrypoint description differs by exactly one replaced sentence (two diff lines).

**Expected Outcome**:

- `body_identical=14/14`; `description_changed_sentence_lines=2`; the changed sentence is the composition sentence and no other sentence differs.

**Notes / Clarifications**:

- Observed on the pre-change tree (2026-11-10, base `fab46636`, before any deliverable edit): `body_identical=14/14`; `description_changed_sentence_lines=0`; `one_sentence_mutation=applied`.
- Result label for Section 10: **FAIL (entrypoint sentence unchanged); body preservation PASS (control)**.

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

#### TC-M2PLAN-032 - The aggregate gate exits 0 on the branch head

**Scenario Type**: Regression
**Impact Level**: Critical
**Priority**: High
**Related IDs**: AC-NFR5-1, NFR-5
**Test Type(s)**: Manual (guard execution)
**Automation Level**: Semi-automated (existing guard)
**Target Layer / Location**: repository root
**Tags**: @guard, @aggregate

**Preconditions**:

- Worktree at `docs/GH-284/m2-planning`; `git` available; base commit `fab46636cc0b5abfbd22257711f594adc0af4660` fetched.
- `pnpm install --frozen-lockfile` has completed and `packages/*/dist` is built (the checkout under test is already built).

**Steps**:

1. Run procedure **P32** (Section 7.1). If the default `/tmp` run is red only in `tests/checks/ci-baseline-parity.test.ts` with a cross-device hardlink error, re-run with `TMPDIR` on the repository filesystem and record both results (declared gap G-2).

**Expected Outcome**:

- `pnpm_check_exit=0` and `tmpdir_check_exit=0`; lint, format:check, typecheck, test, boundaries, prompt conformance, help-guide coverage, and exports parity complete.
- The default run may exit 1 only from the pre-existing cross-device clone in `tests/checks/ci-baseline-parity.test.ts`; the `TMPDIR` re-run is the authoritative result (G-2).

**Notes / Clarifications**:

- Observed on the pre-change tree (2026-11-10, base `fab46636`, before any deliverable edit): Default run: `pnpm_check_exit=1`; `7132 pass`, `1 fail`, `Ran 7137 tests across 880 files [346.56s]`; the sole failure is `CI baseline parity (hermetic partial clone) > a depth-1 checkout fails closed and the baseline fetch is the remedy`, caused by `git clone --local` failing with a cross-device link. Lint, format:check, and typecheck passed; the boundary, prompt, help, and exports stages did not run in that attempt. `TMPDIR`-corrected run: `tmpdir_check_exit=0`; `7133 pass`, `0 fail`, `Ran 7137 tests across 880 files [385.27s]`; `check:boundaries`, `prompt-conformance` (5 prompts clean), `help-guide-coverage`, and `exports-parity` all pass.
- Result label for Section 10: **PASS (TMPDIR-corrected); default run FAIL (pre-existing environment, G-2)**.

#### TC-M2PLAN-033 - The M2 diagrams satisfy the five structural conditions and the 3+6+1 inventory

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

1. Run procedure **P33** (Section 7.1), the Appendix E procedure plus the flow inventory.
2. Confirm `mermaid_fences>=10`, `keyword_and_fence_exit=0`, `c4_headings=3`, `key_flow_headings=6`, `park_resume_headings=1`.

**Expected Outcome**:

- `mermaid_fences>=10`; `keyword_and_fence_exit=0`; `c4_headings=3/3`; `key_flow_headings=6/6`; `park_resume_headings=1/1`; `inventory=c4:3/3 flows:6/6 park:1/1`.

**Notes / Clarifications**:

- Observed on the pre-change tree (2026-11-10, base `fab46636`, before any deliverable edit): `FAIL: doc/planning/oss-tooling/milestones/m2 absent; mermaid fences=0 (<10)`; `inventory=c4:0/3 flows:0/6 park:0/1`.
- Result label for Section 10: **FAIL (change absent)**.

#### TC-M2PLAN-034 - Dated history and the original pointer-group sentences stay byte-identical

**Scenario Type**: Regression
**Impact Level**: Critical
**Priority**: High
**Related IDs**: AC-NFR7-1, NFR-7, F-7
**Test Type(s)**: Manual (static/diff and content inspection)
**Automation Level**: Semi-automated (uncommitted procedure)
**Target Layer / Location**: `status.md`, seven sections and four original sentences
**Tags**: @docs, @diff, @history

**Preconditions**:

- Worktree at `docs/GH-284/m2-planning`; `git` available; base commit `fab46636cc0b5abfbd22257711f594adc0af4660` fetched.
- Section 7.1 P00 has been run once in the same shell (base snapshots and helpers).

**Steps**:

1. Run procedure **P34** (Section 7.1).

**Expected Outcome**:

- `dated_sections_identical=7/7`; `group_sentences_retained=4/4`.

**Notes / Clarifications**:

- Observed on the pre-change tree (2026-11-10, base `fab46636`, before any deliverable edit): `dated_sections_identical=7/7`; `group_sentences_retained=4/4`. Passing control.
- Result label for Section 10: **PASS (control)**.

#### TC-M2PLAN-035 - Clause fidelity counts are zero missing, zero added, zero changed meaning

**Scenario Type**: Corner Case
**Impact Level**: Critical
**Priority**: High
**Related IDs**: AC-NFR8-1, NFR-8, F-1, F-2
**Test Type(s)**: Manual (static/diff and content inspection)
**Automation Level**: Semi-automated (uncommitted procedure)
**Target Layer / Location**: the seven new story entries vs GH-284
**Tags**: @docs, @backlog, @fidelity

**Preconditions**:

- Worktree at `docs/GH-284/m2-planning`; `git` available; base commit `fab46636cc0b5abfbd22257711f594adc0af4660` fetched.
- Section 7.1 P00 has been run once in the same shell (base snapshots and helpers).
- P02, P05, and P06 have run in the same shell (P35 aggregates their counts).

**Steps**:

1. Run **P02**, **P05**, and **P06** first, then procedure **P35** (Section 7.1).
2. Complete the manual clause-by-clause read: the anchor matrix cannot detect a clause that was reworded into a weaker meaning (declared gap G-1).

**Expected Outcome**:

- `missing_clauses=0`; `added_criteria=0` (exactly seven S17 items and no invented criterion); `changed_meaning=0` by the recorded review checklist.

**Notes / Clarifications**:

- Observed on the pre-change tree (2026-11-10, base `fab46636`, before any deliverable edit): `P02 missing=81 total=81`; `P05 missing=6`; `P06 ac_items=0`; `missing_clauses=87`; `added_criteria=n/a (S17 absent)`; `changed_meaning=manual clause-by-clause review (declared gap G-1)`; verdict FAIL.
- Result label for Section 10: **FAIL (change absent; 87 missing anchors)**.

#### TC-M2PLAN-036 - No forbidden or private literal is introduced by the change

**Scenario Type**: Negative
**Impact Level**: Important
**Priority**: Medium
**Related IDs**: AC-NFR9-1, NFR-9, RSK-4
**Test Type(s)**: Manual (static/diff and content inspection)
**Automation Level**: Semi-automated (uncommitted procedure)
**Target Layer / Location**: `doc/planning/oss-tooling/` added lines; forbidden-literals guard
**Tags**: @guard, @docs, @literals

**Preconditions**:

- Worktree at `docs/GH-284/m2-planning`; `git` available; base commit `fab46636cc0b5abfbd22257711f594adc0af4660` fetched.
- Section 7.1 P00 has been run once in the same shell (base snapshots and helpers).

**Steps**:

1. Run procedure **P36** (Section 7.1).
2. Read the added lines once for hosted, proprietary, fleet, repository, or product names that the configured literals do not cover (declared gap G-4).

**Expected Outcome**:

- `forbidden_exit=0`; `OK forbidden-literals: 5/5 scope classes scanned, 0 violations`; `seed_hits=0`; `non_vacuous=yes`.

**Notes / Clarifications**:

- Observed on the pre-change tree (2026-11-10, base `fab46636`, before any deliverable edit): `forbidden_exit=0`; `OK forbidden-literals: 5/5 scope classes scanned, 0 violations`; `added_lines=0`; `seed_hits=0`; `non_vacuous=no`. Zero violations is a passing guard control; the added-line scan is vacuous until the change lands.
- Result label for Section 10: **PASS (guard control); FAIL (vacuous scan)**.

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
| Mutation fixtures | `/tmp`-only copies, never committed: an M2-S4 goal mutation (P07), a heading mutation (P09), an entrypoint sentence mutation (P30). Each proves the oracle fires and none is written into the repository |
| Guard scope | `test-doc-distribution.sh` scans `doc/guides/**` and a fixed standalone set; `doc/planning/**` is outside it and carries no marker, which is the expected state (DEC-6) |
| Isolation | Every procedure is read-only with respect to the repository: no writes outside `/tmp`, no branch, index, or file mutation. The planning files under test are never edited to make a check pass |
| Environment caveat | `/tmp` is tmpfs in this checkout, so `git clone --local` in `tests/checks/ci-baseline-parity.test.ts` fails with `cross-device link`. P32 records this pre-existing condition and a `TMPDIR`-corrected re-run (declared gap G-2) |
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

entry() { awk -v h="$2" 'index($0,h)==1{f=1;print;next} f&&/^### /{exit} f{print}' "$1"; }
section() { awk -v h="$2" '$0==h{f=1;print;next} f&&/^## /{exit} f{print}' "$1"; }

mkdir -p /tmp/gh284
git show "$BASE:$BL" > /tmp/gh284/base-backlog.md
git show "$BASE:$ST" > /tmp/gh284/base-status.md
git show "$BASE:$MR" > /tmp/gh284/base-milestones-README.md
echo "base snapshots ready: $(wc -l < /tmp/gh284/base-backlog.md) backlog, $(wc -l < /tmp/gh284/base-status.md) status lines"
desc() { awk '/^## DESCRIPTION/{f=1;next} /^## /{f=0} f' "$1"; }
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

**P02 — clause anchors for S11-S16**

```bash
declare -A A
A[S11]='git common dir|host-level index|projects list|repo key|state location|daemon reachability|handover state|migration|same[ -]ref|cannot observe each other'
A[S12]='dispatch attempts|--ref|--limit|token|corroboration|divergence|timestamps|harness|dual-run resolve|local evidence|mode|machine envelope|unresolved|coverage|floor'
A[S13]='queue\.graph|dispatch\.attempt|phase\.state|blockers\.state|event kinds|payload|ordering|overflow|repoll|versioned|contract tests'
A[S14]='opencode v2|step frames|session economics|command-audit|M1-S15|M1-S22|phase-transition|stall|restart|schema-versioned|spend|per ticket|repository|lane|agent role|model|retro|morning brief|tolerance|telemetry absence|classified'
A[S15]='release|removal|reasons|automatic release|merge|closeout|dependency edge|single-flight|per ref|dispatch paths|stale|tracker truth'
A[S16]='engine|shell|provider windows|holds|pre-iteration hold hook|lane economics|handover-gate evaluation|per-condition|shell path|deprecation|per-repository|reversible'
tot=0; pres=0
for s in S11 S12 S13 S14 S15 S16; do
  h=$(grep -m1 -E "^### M2-$s " "$BL" || true); e=""
  [ -n "$h" ] && e=$(entry "$BL" "$h" | tr '\n' ' ')
  n=0; c=0
  IFS='|' read -ra pats <<< "${A[$s]}"
  for p in "${pats[@]}"; do n=$((n+1)); printf '%s' "$e" | grep -Eiq -- "$p" && c=$((c+1)); done
  echo "M2-$s anchors=$c/$n"; tot=$((tot+n)); pres=$((pres+c))
done
echo "clauses_present=$pres/$tot"
echo "missing=$((tot-pres)) total=$tot" > /tmp/gh284/p02.env
[ "$pres" -eq "$tot" ] && echo "P02 verdict: PASS" || { echo "P02 verdict: FAIL (stories absent)"; }
```

**P03 — append-only hunk containment in the backlog**

```bash
range_of() { local h="$1"; local s n; s=$(grep -n -F "$h" "$BL" | cut -d: -f1); [ -z "$s" ] && { echo ""; return; }; n=$(awk -v s="$s" 'NR>s && /^#{2,3} /{print NR; exit}' "$BL"); echo "$s $(( ${n:-$((s+1))} - 1 ))"; }
# allowed regions: the two amended entries plus the insertion window after M2-S9
r4=$(range_of '### M2-S4 Board'); r6=$(range_of '### M2-S6 Metrics and spend')
s9e=$(range_of '### M2-S9 Memory conventions in bootstrap templates')
echo "amended regions: M2-S4=[${r4:-absent}] M2-S6=[${r6:-absent}] M2-S9=[${s9e:-absent}] epicM3_line=$m3"
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
  s9end=${s9e##* }; newwin="$((s9end+1)):$((m3-1))"
  git diff -U0 "$BASE"...HEAD -- "$BL" | grep -E '^@@' | hunk_guard "${r4/ /:}" "${r6/ /:}" "$newwin" && echo "hunk confinement OK" || echo "hunk confinement FAILED"
  echo "non_vacuous=yes"
else
  echo "FAIL: no backlog hunk (change absent)"; echo "non_vacuous=no"
fi
# matcher self-tests (synthetic hunk headers)
tests_ok=0
printf '@@ -%d,1 +%d,1 @@\n' "${r4%% *}" "${r4%% *}" | hunk_guard "${r4/ /:}" >/dev/null && tests_ok=$((tests_ok+1))
printf '@@ -%d,1 +%d,1 @@\n' "$m3" "$m3" | hunk_guard "${r4/ /:}" >/dev/null || tests_ok=$((tests_ok+1))
echo "classifier_self_tests=$tests_ok/2"
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

**P06 — S17 seven independently identifiable acceptance criteria**

```bash
h17=$(grep -m1 '^### M2-S17 ' "$BL" || true)
if [ -z "$h17" ]; then echo "S17=absent ac_items=0/7"; echo "ac_items=0" > /tmp/gh284/p06.env; else
  e=$(entry "$BL" "$h17")
  printf '%s\n' "$e" | awk '/^- AC:/{f=1;next} /^- Depends on:/{f=0} f' | grep -nE '^[[:space:]]+[1-7]\. ' | tee /tmp/gh284/s17-ac.txt
  echo "ac_items=$(wc -l < /tmp/gh284/s17-ac.txt)/7"
  dup=$(awk '{print $1}' /tmp/gh284/s17-ac.txt | sort | uniq -d | wc -l); echo "duplicate_numbers=$dup"
echo "ac_items=$(wc -l < /tmp/gh284/s17-ac.txt)" > /tmp/gh284/p06.env
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
  # identity controls: heading, goal, AC
  for lab in '- Goal:' '- AC:'; do
    bb=$(printf '%s\n' "$b" | grep -A3 -- "$lab" | head -4); hh=$(printf '%s\n' "$h" | grep -A3 -- "$lab" | head -4)
    [ "$bb" = "$hh" ] && echo "$lab identical" || echo "$lab CHANGED"
  done
fi
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

**P11 — false planned claims and delivered attribution**

```bash
echo "pages=$(ls "$M1"/*.md | wc -l)"
echo "M1_planned_hits=$(grep -l 'M1 planned' "$M1"/*.md | wc -l) M1_milestone_planned_hits=$(grep -l 'M1 milestone planned' "$M1"/*.md | wc -l)"
declare -A NEED=(
 [board.md]='M1-S5 GH-229' [doctor.md]='M1-S3 GH-224' [mcp.md]='M1-S7 GH-231' [state.md]='M1-S2 GH-222'
 [merge.md]='M1-S4 GH-225' [verify-deploy.md]='M1-S4 GH-225' [watchdog.md]='M1-S1 GH-221' [blockers.md]='M1-S16 GH-230'
 [retro.md]='M1-S8 GH-232' [commit.md]='M1-S14 GH-227' [plan.md]='M1-S13 GH-226' [verify-gates.md]='M1-S4 GH-225'
 [closeout.md]='M1-S12 GH-240' [daemon.md]='M1-S18 GH-238')
ok=0
for p in "${!NEED[@]}"; do
  hdr=$(awk '/^## /{exit} {print}' "$M1/$p")
  miss=""
  for tok in ${NEED[$p]}; do printf '%s' "$hdr" | grep -Fq -- "$tok" || miss="$miss $tok"; done
  [ -z "$miss" ] && ok=$((ok+1)) || echo "$p missing:$miss"
done
echo "header_attribution=$ok/14 forbidden_phrase_pages=$(( $(grep -l 'M1 planned' "$M1"/*.md | wc -l) + $(grep -l 'M1 milestone planned' "$M1"/*.md | wc -l) ))"
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

**P15 — entrypoint composition sentence**

```bash
pnpm exec delivery-os --help > /tmp/gh284/help.txt 2>&1
awk '/^Commands:/{f=1;next} f&&NF{print $1}' /tmp/gh284/help.txt | LC_ALL=C sort -u > /tmp/gh284/families.txt
echo "observed_families=$(wc -l < /tmp/gh284/families.txt)"
flat=$(desc "$M1/entrypoint.md" | tr '\n' ' ' | sed 's/  */ /g')
comp=$(printf '%s' "$flat" | sed -E 's/.*command set: ([^.]*)\. .*/\1/')
printf '%s' "$comp" | grep -oE '`[a-z-]+`' | tr -d '`' | LC_ALL=C sort -u > /tmp/gh284/composed.txt
echo "composed_families=$(wc -l < /tmp/gh284/composed.txt): $(tr '\n' ' ' < /tmp/gh284/composed.txt)"
echo "families_not_composed=$(comm -23 /tmp/gh284/families.txt /tmp/gh284/composed.txt | tr '\n' ' ')"
notreg=$(printf '%s' "$flat" | tr '.' '\n' | grep -i 'not registered' | head -1)
printf '%s' "$notreg" | grep -Eiq '`state`' && echo "not_registered: state OK" || echo "not_registered: state MISSING"
printf '%s' "$notreg" | grep -Eiq '`mcp`' && echo "not_registered: mcp OK" || echo "not_registered: mcp MISSING"
printf '%s' "$notreg" | grep -Eiq 'resident daemon' && echo "not_registered: resident daemon OK" || echo "not_registered: resident daemon MISSING"
printf '%s' "$notreg" | grep -Eiq '`dispatch`' && echo "dispatch=claimed-not-registered (FAIL)" || echo "dispatch=not-claimed-absent OK"
git show "$BASE:$M1/entrypoint.md" > /tmp/gh284/base-entrypoint.md
desc /tmp/gh284/base-entrypoint.md > /tmp/gh284/desc-base.txt; desc "$M1/entrypoint.md" > /tmp/gh284/desc-head.txt
echo "description_changed_sentence_lines=$(diff <(tr '. ' '\n' < /tmp/gh284/desc-base.txt | sed '/^$/d') <(tr '. ' '\n' < /tmp/gh284/desc-head.txt | sed '/^$/d') | grep -cE '^[<>]' || true)"
```

**P16 — new dated M2 status snapshot**

```bash
maps=(); while IFS= read -r h; do grep -Fxq "$h" /tmp/gh284/base-status.md || maps+=("$h"); done < <(grep '^## ' "$ST")
echo "new_sections=${#maps[@]}"
sec=""; for h in "${maps[@]}"; do printf '%s' "$h" | grep -q '2026-11-10' && sec="$h"; done
if [ -z "$sec" ]; then echo "2026-11-10 section=absent"; echo "P16 verdict: FAIL (change absent)"; else
  body=$(section "$ST" "$sec" | tr '\n' ' ')
  for t in '23 of 23\|23/23' 'S2.S10' 'S11.S17' 'S1' 'retired' 'M2-S4' 'M2-S6' '#268' '#280' 'maintenance' 'not milestone exit'; do printf '%s' "$body" | grep -Eiq -- "$t" && echo "$t OK" || echo "$t MISSING"; done
  printf '%s' "$body" | grep -Eiq 'milestone exit (met|complete|achieved)' && echo "exit_overclaim=PRESENT (FAIL)" || echo "exit_overclaim=ABSENT"
fi
```

**P17 — four superseded statement groups and their pointers**

```bash
ptr() { printf '%s' "$1" | grep -q '2026-11-10'; }
# G1 title framing
b1=$(head -1 /tmp/gh284/base-status.md); h1=$(head -1 "$ST")
echo "title_base_retained=$(printf '%s' "$h1" | grep -Fq -- "$b1" && echo yes || echo no)"
echo "title_pointer=$(ptr "$(sed -n '1,4p' "$ST")" && echo yes || echo no)"
# G2 M1 delivery starts now
g2s=$(grep -n 'M1 delivery starts now and runs beside' /tmp/gh284/base-status.md | cut -d: -f1)
g2=$(printf '%s\n' "$g2s"); bs=$(sed -n "${g2s},$((g2s+5))p" /tmp/gh284/base-status.md)
echo "g2_bytes_retained=$(grep -Fq -- "$bs" "$ST" && echo yes || echo no)"
pos=$(grep -n -F 'M1 delivery starts now and runs beside' "$ST" | head -1 | cut -d: -f1)
echo "g2_pointer=$(ptr "$(sed -n "${pos},$((pos+8))p" "$ST")" && echo yes || echo no)"
# G3 2026-11-07 scheduling section
h3='## M1 delivery: scheduling engine delivered (2026-11-07)'
section "$ST" "$h3" > /tmp/gh284/g3.txt
g3b=0; grep -Fq -- "$(cat /tmp/gh284/g3.txt)" "$ST" && g3b=1
echo "g3_bytes_retained=$([ "$g3b" -eq 1 ] && echo yes || echo no)"
echo "g3_pointer=$(ptr "$(cat /tmp/gh284/g3.txt)" && echo yes || echo no)"
# G4 items 1-3 proposed next steps
awk '/^1\. \*\*Start the dual-run pilot now\*\*/{f=1} /^4\. \*\*Memory consolidation pass\*\*/{f=0} f' /tmp/gh284/base-status.md > /tmp/gh284/g4.txt
g4b=0; grep -Fq -- "$(cat /tmp/gh284/g4.txt)" "$ST" && g4b=1
echo "g4_bytes_retained=$([ "$g4b" -eq 1 ] && echo yes || echo no)"
g4p=0; for i in 1 2 3; do p=$(grep -n -E "^$i\. \*\*" "$ST" | head -1 | cut -d: -f1); [ -n "$p" ] && ptr "$(sed -n "${p},$((p+12))p" "$ST")" && g4p=$((g4p+1)); done
echo "g4_pointers=$g4p/3"
```

**P18 — dated historical sections byte-identical**

```bash
tot=0; ident=0
while IFS= read -r h; do
  tot=$((tot+1)); section /tmp/gh284/base-status.md "$h" > /tmp/gh284/s-b.txt; section "$ST" "$h" > /tmp/gh284/s-h.txt
  cmp -s /tmp/gh284/s-b.txt /tmp/gh284/s-h.txt && ident=$((ident+1)) || echo "CHANGED: $h"
done < <(grep '^## ' /tmp/gh284/base-status.md)
echo "sections_identical=$ident/$tot"
```

**P19 — M2 pack file set and README map**

```bash
wantfiles=(README.md architecture.md contracts.md test-scenarios.md journeys.md entrypoint-delta.md commands/projects.md commands/attempts.md commands/events.md commands/spend.md commands/queue.md commands/board.md)
have=0
for f in "${wantfiles[@]}"; do [ -f "$M2/$f" ] && have=$((have+1)); done
actual=0; [ -d "$M2" ] && actual=$(find "$M2" -type f | wc -l)
echo "pack_files=$have/12 actual_files=$actual (expected 12)"
if [ -f "$M2/README.md" ]; then
  listed=0; for f in "${wantfiles[@]}"; do grep -Fq "$(basename "$f")" "$M2/README.md" && listed=$((listed+1)); done
  echo "readme_lists=$listed/12 story_map_entries=$(grep -cE 'M2-S[0-9]+' "$M2/README.md")"
else echo "README=absent"; fi
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
  for t in 'dispatch' 'coordinator' 'state' 'mcp' 'daemon' 'unknown flag' 'unexpected argument' 'exit 1' 'outside this' 'entrypoint\.md'; do printf '%s' "$flat" | grep -Fiq -- "$t" && echo "$t OK" || echo "$t MISSING"; done
fi
```

**P27 — milestone index registration**

```bash
if grep -q 'm2/README.md' "$MR"; then echo "M2 row=present"; else echo "M2 row=absent"; fi
grep -Fq 'm2/README.md' "$MR" && for a in architecture.md contracts.md test-scenarios.md journeys.md entrypoint-delta.md; do grep -Fq "m2/$a" "$MR" || echo "row missing m2/$a"; done
grep -Fq 'm2/README.md' "$MR" && for a in projects attempts events spend queue board; do { grep -Fq "m2/commands/$a.md" "$MR" || grep -Fq "m2/$a.md" "$MR"; } || echo "row missing m2/commands/$a.md"; done
grep -Eiq 'M2.*planned|planned.*M2' "$MR" && echo "m2_row_marked_planned=yes" || echo "m2_row_marked_planned=no"
for row in 'M0 (trust substrate' 'M1 (delivery engine'; do b=$(grep -F "$row" /tmp/gh284/base-milestones-README.md); h=$(grep -F "$row" "$MR"); [ "$b" = "$h" ] && echo "$row row=identical" || echo "$row row=CHANGED"; done
```

**P28 — product-file containment**

```bash
git diff --name-only "$BASE"...HEAD -- . ':(exclude)doc/changes/**' | sort | tee /tmp/gh284/product-files.txt
n=$(wc -l < /tmp/gh284/product-files.txt); echo "product_files=$n"
bad=$(grep -cE '^(packages|tests|scripts|doc/spec|\.opencode|\.ai)/|(^|/)(package\.json|pnpm-lock\.yaml|tsconfig.*\.json|biome\.json|bunfig\.toml|\.dependency-cruiser\.cjs)$' /tmp/gh284/product-files.txt || true)
echo "forbidden_root_files=$bad"
outside=$(grep -vc '^doc/planning/oss-tooling/' /tmp/gh284/product-files.txt || true); echo "outside_planning=$outside"
unexpected=$(grep -vcE '^doc/planning/oss-tooling/(backlog\.md|status\.md|milestones/README\.md|milestones/m1/commands/[a-z-]+\.md|milestones/m2/)' /tmp/gh284/product-files.txt || true); echo "unexpected_paths=$unexpected"
printf '%s\n' 'packages/core/src/x.ts' 'doc/planning/oss-tooling/backlog.md' | grep -cE '^(packages|tests|scripts|doc/spec|\.opencode|\.ai)/' >/dev/null && echo "matcher_self_test=OK"
[ "$n" -ge 1 ] && echo "non_vacuous=yes" || echo "non_vacuous=no (no product file changed)"
```

**P29 — per-story body preservation**

```bash
declare -A AMEND=([M2-S4]=1 [M2-S6]=1); declare -A NEW=([M2-S11]=1 [M2-S12]=1 [M2-S13]=1 [M2-S14]=1 [M2-S15]=1 [M2-S16]=1 [M2-S17]=1)
tot=0; ident=0; changed=0
while IFS= read -r h; do
  code=$(printf '%s' "$h" | sed -E 's/^### (M[0-9]-S[0-9]+).*/\1/')
  [ -n "${AMEND[$code]:-}" ] && continue
  [ -n "${NEW[$code]:-}" ] && continue
  tot=$((tot+1))
  grep -Fxq "$h" "$BL" || { changed=$((changed+1)); echo "heading missing: $h"; continue; }
  entry /tmp/gh284/base-backlog.md "$h" > /tmp/gh284/e-b.txt; entry "$BL" "$h" > /tmp/gh284/e-h.txt
  cmp -s /tmp/gh284/e-b.txt /tmp/gh284/e-h.txt && ident=$((ident+1)) || { changed=$((changed+1)); echo "body CHANGED: $h"; }
done < <(grep '^### ' /tmp/gh284/base-backlog.md)
echo "stories_compared=$tot identical=$ident changed=$changed"
```

**P30 — body byte identity and one-sentence entrypoint bound**

```bash
body() { awk 'f{print} /^## /{f=1;print}' "$1"; }
ident=0
for p in "${!NEED[@]}"; do git show "$BASE:$M1/$p" > /tmp/gh284/b.md; cmp -s <(body /tmp/gh284/b.md) <(body "$M1/$p") && ident=$((ident+1)) || echo "$p BODY CHANGED"; done
echo "body_identical=$ident/14"
desc() { awk '/^## DESCRIPTION/{f=1;next} /^## /{f=0} f' "$1"; }
git show "$BASE:$M1/entrypoint.md" > /tmp/gh284/base-entrypoint.md
desc /tmp/gh284/base-entrypoint.md > /tmp/gh284/desc-base.txt; desc "$M1/entrypoint.md" > /tmp/gh284/desc-head.txt
sdiff=0
if ! cmp -s /tmp/gh284/desc-base.txt /tmp/gh284/desc-head.txt; then
  sdiff=$(diff <(tr '. ' '\n' < /tmp/gh284/desc-base.txt | sed '/^$/d') <(tr '. ' '\n' < /tmp/gh284/desc-head.txt | sed '/^$/d') | grep -cE '^[<>]' || true)
fi
echo "description_changed_sentence_lines=$sdiff"
# self-test
sed '/^## DESCRIPTION/,/^## OPTIONS/ s/`dispatch`, and the resident daemon/`dispatch`, `coordinator`, and the resident daemon/' /tmp/gh284/base-entrypoint.md > /tmp/gh284/mut-entrypoint.md
desc /tmp/gh284/mut-entrypoint.md > /tmp/gh284/desc-mut.txt
[ "$(grep -c 'coordinator' /tmp/gh284/desc-mut.txt)" -ge 1 ] && echo "one_sentence_mutation=applied" || echo "one_sentence_mutation=FAILED"
[ "$sdiff" -ge 2 ] && echo "P30 verdict: PASS" || echo "P30 verdict: FAIL (entrypoint sentence not changed)"
```

**P31 — doc-distribution guard**

```bash
bash scripts/.tests/test-doc-distribution.sh > /tmp/gh284/guard.log 2>&1; echo "guard_exit=$?"
tail -1 /tmp/gh284/guard.log
echo "planning_markers=$(grep -rl '^ados_distribution' doc/planning/ | wc -l)"
```

**P32 — aggregate pnpm check**

```bash
# Default run: records the environment as-is.
pnpm check; echo "pnpm_check_exit=$?"

# Same-filesystem tmpdir: the authoritative re-run when /tmp is a different filesystem.
TMPDIR="$(git rev-parse --show-toplevel)/../.tmp-gh284"
mkdir -p "$TMPDIR"
TMPDIR="$TMPDIR" pnpm check; echo "tmpdir_check_exit=$?"
```

**P33 — structural diagram check**

```bash
if [ ! -d "$M2" ]; then echo "FAIL: $M2 absent; mermaid fences=0 (<10)"; echo "c4_headings=0/3 key_flow_headings=0/6 park_resume_headings=0/1 inventory=c4:0/3 flows:0/6 park:0/1"; else
  files=$(find "$M2" -name '*.md')
  count=$(grep -h '^```mermaid' $files | wc -l); echo "mermaid_fences=$count"
  [ "$count" -ge 10 ] || echo "FAIL: $count mermaid fences, need >= 10"
  awk '
    FNR==1 && open { printf "FAIL unclosed fence in %s\n", prev; bad=1; open=0 }
    /^```mermaid/ { open=1; prev=FILENAME; getline
      if ($0 !~ /^(flowchart|graph|sequenceDiagram|classDiagram|stateDiagram-v2)([ \t]|$)/) { printf "FAIL keyword %s:%d: %s\n", FILENAME, FNR, $0; bad=1 }
      next }
    /^```/ { open=0 }
    END { if (open) { printf "FAIL unclosed fence in %s\n", prev; bad=1 } exit bad }
  ' $files; echo "keyword_and_fence_exit=$?"
  c4=$(grep -hE '^#{2,3} C4 Level [123]' $files | wc -l); echo "c4_headings=$c4/3"
  parks=$(grep -hEi '^#{2,3} .*park' $files | wc -l); echo "park_resume_headings=$parks/1"
  flows=$(grep -hEi '^#{2,3} .*(multi.repo|divergence|telemetry attribution|auto.release|single.flight|handover.gate)' $files | wc -l); echo "key_flow_headings=$flows/6"
  echo "inventory=c4:$c4/3 flows:$flows/6 park:$parks/1"
fi
```

**P34 — history and original pointer-group sentences**

```bash
ident=0; tot=0
while IFS= read -r h; do tot=$((tot+1)); section /tmp/gh284/base-status.md "$h" > /tmp/gh284/s-b.txt; section "$ST" "$h" > /tmp/gh284/s-h.txt; cmp -s /tmp/gh284/s-b.txt /tmp/gh284/s-h.txt && ident=$((ident+1)); done < <(grep '^## ' /tmp/gh284/base-status.md)
echo "dated_sections_identical=$ident/$tot"
sen=0; for lit in 'M0 stories delivered, milestone exit pending' 'M1 delivery starts now and runs beside' 'M1-S17 (GH-237) delivered the daemon-free scheduling engine' '1. **Start the dual-run pilot now**'; do grep -Fq -- "$lit" "$ST" && sen=$((sen+1)); done
echo "group_sentences_retained=$sen/4"
```

**P35 — clause-count aggregate**

```bash
b02=$(cat /tmp/gh284/p02.env 2>/dev/null || echo "missing=? total=?"); b05=$(cat /tmp/gh284/p05.env 2>/dev/null || echo "missing=?")
b06=$(cat /tmp/gh284/p06.env 2>/dev/null || echo "ac_items=?")
echo "P02 $b02"; echo "P05 $b05"; echo "P06 $b06"
m2=$(printf '%s' "$b02" | sed -n 's/.*missing=\([0-9]*\).*/\1/p'); m5=$(printf '%s' "$b05" | sed -n 's/missing=\([0-9]*\)/\1/p')
missing=$(( ${m2:-0} + ${m5:-0} ))
echo "missing_clauses=$missing added_criteria=$([ -f "$M2" ] && echo "review P06 (must be exactly 7 items, no extra)" || echo "n/a (S17 absent)")"
echo "changed_meaning=manual clause-by-clause review (declared gap G-1)"
[ "$missing" -eq 0 ] && echo "P35 verdict: PASS" || echo "P35 verdict: FAIL"
```

**P36 — forbidden and private literals**

```bash
bun run scripts/checks/forbidden-literals.ts > /tmp/gh284/fl.log 2>&1; echo "forbidden_exit=$?"; grep -E '^OK forbidden-literals' /tmp/gh284/fl.log | tail -1
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

**Recommended order:** P00 → P28 (containment) → P31 → P32 → P36 → P11 → P14/P30 (page containment) → P01..P10 → P16..P18 → P19..P27 → P29 → P33..P35 → P37 → the manual reads (G-1, G-3, G-4, G-5, G-6). Cheap containment and guards first: an out-of-planning change or an escaped header hunk makes every downstream content reading moot.

### 7.2 TC → Procedure → Implementation Mapping

| TC ID | AC | Procedure(s) | Execution command | Implementation status | Recorded evidence |
|---|---|---|---|---|---|
| TC-M2PLAN-001 | AC-F1-1 | P01 | `bash` block **P01** (Section 7.1) | Manual Only — uncommitted procedure | `m2_story_headings=0 new_found=0/7 order=FAIL`; `shape_ok=0/7`; verdict FAIL. |
| TC-M2PLAN-002 | AC-F1-2 | P02 | `bash` block **P02** (Section 7.1) | Manual Only — uncommitted procedure | `M2-S11=0/10`, `M2-S12=0/15`, `M2-S13=0/11`, `M2-S14=0/21`, `M2-S15=0/12`, `M2-S16=0/12`; `clauses_present=0/81`; verdict FAIL. |
| TC-M2PLAN-003 | AC-F1-3 | P03 | `bash` block **P03** (Section 7.1) | Manual Only — uncommitted procedure | `backlog_hunks=0`; `FAIL: no backlog hunk (change absent)`; `non_vacuous=no`; `classifier_self_tests=2/2`. |
| TC-M2PLAN-004 | AC-F2-1 | P04 | `bash` block **P04** (Section 7.1) | Manual Only — uncommitted procedure | `S17=absent`; verdict FAIL. |
| TC-M2PLAN-005 | AC-F2-2 | P05 | `bash` block **P05** (Section 7.1) | Manual Only — uncommitted procedure | `S17=absent clauses_present=0/6`; `missing=6`. |
| TC-M2PLAN-006 | AC-F2-3 | P06 | `bash` block **P06** (Section 7.1) | Manual Only — uncommitted procedure | `S17=absent ac_items=0/7`; `ac_items=0`. |
| TC-M2PLAN-007 | AC-F3-1 | P07 | `bash` block **P07** (Section 7.1) | Manual Only — uncommitted procedure | `changed_lines=0 unexpected_lines=0`; `depends=NOT expected (- Depends on: M1-S5, M1-S17. |
| TC-M2PLAN-008 | AC-F3-2 | P08 | `bash` block **P08** (Section 7.1) | Manual Only — uncommitted procedure | `changed_lines=0`; `tasks_clause=MISSING`; `depends=M2-S14 MISSING`; `heading=identical`; `base_task_lines_missing=0`; `- Goal: identical`; `- AC: identical`. |
| TC-M2PLAN-009 | AC-F4-1 | P09 | `bash` block **P09** (Section 7.1) | Manual Only — uncommitted procedure | `base_headings=67 head_headings=67 added=0 removed=0 unexpected=0`; `retirement_note=identical`; `order=OK`; `negative_control=detected`. |
| TC-M2PLAN-010 | AC-F4-2 | P10 | `bash` block **P10** (Section 7.1) | Manual Only — uncommitted procedure | `fm=byte-identical`; `rg=byte-identical`; `cc=byte-identical`. |
| TC-M2PLAN-011 | AC-F5-1 | P11 | `bash` block **P11** (Section 7.1) | Manual Only — uncommitted procedure | `pages=28`; `M1_planned_hits=9`; `M1_milestone_planned_hits=2`; `forbidden_phrase_pages=11`; `header_attribution=2/14` (`plan. |
| TC-M2PLAN-012 | AC-F5-2 | P12 | `bash` block **P12** (Section 7.1) | Manual Only — uncommitted procedure | All three `MISSING`. |
| TC-M2PLAN-013 | AC-F5-3 | P13 | `bash` block **P13** (Section 7.1) | Manual Only — uncommitted procedure | `M1-S18 MISSING`; `GH-238 OK`; `not mounted MISSING`; `entrypoint delta MISSING`; `Current=PRESENT`; `daemon_body=byte-identical`. |
| TC-M2PLAN-014 | AC-F5-4 | P14 | `bash` block **P14** (Section 7.1) | Manual Only — uncommitted procedure | `changed_pages=0/14`; `total_hunks=0`; `entrypoint_hunks=0`; `classifier_inside=OK`; `classifier_outside=OK`; `non_vacuous=no`. |
| TC-M2PLAN-015 | AC-F6-1 | P15 | `bash` block **P15** (Section 7.1) | Manual Only — uncommitted procedure | `observed_families=16`; `composed_families=14`; `families_not_composed=coordinator dispatch`; `dispatch=claimed-not-registered (FAIL)`; `description_changed_sentence_lines=0`. |
| TC-M2PLAN-016 | AC-F7-1 | P16 | `bash` block **P16** (Section 7.1) | Manual Only — uncommitted procedure | `new_sections=0`; `2026-11-10 section=absent`; verdict FAIL. |
| TC-M2PLAN-017 | AC-F7-2 | P17 | `bash` block **P17** (Section 7.1) | Manual Only — uncommitted procedure | All four groups retain their bytes (`yes`), but every pointer check is `no` and `g4_pointers=0/3`. |
| TC-M2PLAN-018 | AC-F7-3 | P18 | `bash` block **P18** (Section 7.1) | Manual Only — uncommitted procedure | `sections_identical=7/7`. |
| TC-M2PLAN-019 | AC-F8-1 | P19 | `bash` block **P19** (Section 7.1) | Manual Only — uncommitted procedure | `pack_files=0/12`; `actual_files=0`; `README=absent`. |
| TC-M2PLAN-020 | AC-F8-2 | P20 | `bash` block **P20** (Section 7.1) | Manual Only — uncommitted procedure | `architecture=absent`. |
| TC-M2PLAN-021 | AC-F8-3 | P21 | `bash` block **P21** (Section 7.1) | Manual Only — uncommitted procedure | `contracts=absent`. |
| TC-M2PLAN-022 | AC-F8-4 | P22 | `bash` block **P22** (Section 7.1) | Manual Only — uncommitted procedure | `test-scenarios=absent`. |
| TC-M2PLAN-023 | AC-F8-5 | P23 | `bash` block **P23** (Section 7.1) | Manual Only — uncommitted procedure | `journeys=absent`. |
| TC-M2PLAN-024 | AC-F9-1 | P24 | `bash` block **P24** (Section 7.1) | Manual Only — uncommitted procedure | `command_headers=0/6`; all six files absent. |
| TC-M2PLAN-025 | AC-F9-2 | P25 | `bash` block **P25** (Section 7.1) | Manual Only — uncommitted procedure | All six absent; both relationship checks `MISSING`. |
| TC-M2PLAN-026 | AC-F10-1 | P26 | `bash` block **P26** (Section 7.1) | Manual Only — uncommitted procedure | `delta=absent`. |
| TC-M2PLAN-027 | AC-F11-1 | P27 | `bash` block **P27** (Section 7.1) | Manual Only — uncommitted procedure | `M2 row=absent`; `m2_row_marked_planned=no`; both M0/M1 rows identical. |
| TC-M2PLAN-028 | AC-NFR1-1 | P28 | `bash` block **P28** (Section 7.1) | Manual Only — uncommitted procedure | `product_files=0`; `forbidden_root_files=0`; `outside_planning=0`; `unexpected_paths=0`; `non_vacuous=no (no product file changed)`. |
| TC-M2PLAN-029 | AC-NFR2-1 | P29 | `bash` block **P29** (Section 7.1) | Manual Only — uncommitted procedure | `stories_compared=65 identical=65 changed=0`. |
| TC-M2PLAN-030 | AC-NFR3-1 | P30 | `bash` block **P30** (Section 7.1) | Manual Only — uncommitted procedure | `body_identical=14/14`; `description_changed_sentence_lines=0`; `one_sentence_mutation=applied`. |
| TC-M2PLAN-031 | AC-NFR4-1 | P31 | `bash scripts/.tests/test-doc-distribution.sh` | Existing guard — no change | guard summary and `exit=0` |
| TC-M2PLAN-032 | AC-NFR5-1 | P32 | `TMPDIR="$(git rev-parse --show-toplevel)/../.tmp-gh284" pnpm check` | Existing guard — no change | `pnpm check` exit code and the last successful stage |
| TC-M2PLAN-033 | AC-NFR6-1 | P33 | `bash` block **P33** (Section 7.1) | Manual Only — uncommitted procedure | `FAIL: doc/planning/oss-tooling/milestones/m2 absent; mermaid fences=0 (<10)`; `inventory=c4:0/3 flows:0/6 park:0/1`. |
| TC-M2PLAN-034 | AC-NFR7-1 | P34 | `bash` block **P34** (Section 7.1) | Manual Only — uncommitted procedure | `dated_sections_identical=7/7`; `group_sentences_retained=4/4`. |
| TC-M2PLAN-035 | AC-NFR8-1 | P35 | `bash` block **P35** (Section 7.1) | Manual Only — uncommitted procedure | `P02 missing=81 total=81`; `P05 missing=6`; `P06 ac_items=0`; `missing_clauses=87`; `added_criteria=n/a (S17 absent)`; `changed_meaning=manual clause-by-clause review (declared gap G-1)`; verdict FAIL. |
| TC-M2PLAN-036 | AC-NFR9-1 | P36 | `bun run scripts/checks/forbidden-literals.ts` + added-line scan | Existing guard plus uncommitted scan | `0 violations`, `seed_hits=0` |
| TC-M2PLAN-037 | AC-NFR10-1 | P37 | `bash` block **P37** (Section 7.1) | Manual Only — uncommitted procedure | `changed_planning_files=0`; `broken_links=0`; `restated_ac_blocks=0`; `non_vacuous=no`. |

No test file is created or updated: no permanent-suite change is permitted or needed (NFR-1; testing-strategy invariant rule).

### 7.3 Failure Triage

| Symptom | Meaning | Action |
|---|---|---|
| P28 prints any path outside `doc/planning/oss-tooling/` or under a forbidden root | Containment broken (AC-NFR1-1) | Stop. Revert the out-of-scope path; do not rationalise it as incidental. Re-run P28. |
| P28 prints `non_vacuous=no` | The change is absent, not contained | This is a missing deliverable, not a pass. |
| P14/P30 print any `OUTSIDE` hunk or a body mismatch | A reconciled page changed outside its status header (AC-F5-4/AC-NFR3-1) | Restore the body byte for byte; only the header region may differ. |
| P14 prints `entrypoint_hunks` other than 1 | The entrypoint edit is broader than one sentence (AC-F6-1) | Restore every other sentence and keep exactly the composition sentence. |
| P11 still prints `forbidden_phrase_pages>0` | A delivered story is still called planned (AC-F5-1) | Reword the header; never re-label a delivered story as planned. |
| P11 prints `header_attribution<14/14` | A reconciled header lacks the delivered story code or its GH reference | Add the missing attribution; Appendix B gives the expected pair. |
| P12 prints `MISSING` | A remainder lost its owner | Point `board` at M2-S4, `watchdog` at M2-S2, `mcp` at M3-S2. |
| P13 prints `Current=PRESENT` or a missing header token | The daemon page still overclaims reachability (AC-F5-3) | State engine delivered by M1-S18 (GH-238), command not mounted, registration in the M2 delta note. |
| P09/P10/P29 show any changed heading, body, or region | Backlog preservation broken (AC-F4-1/AC-F4-2/AC-NFR2-1) | Restore the region byte for byte; the message names the story or region. |
| P03 prints `OUTSIDE` or `non_vacuous=no` | A backlog hunk escaped the new/amended entries, or no hunk exists | Revert the escaping hunk; a zero-hunk run is a missing deliverable. |
| P07/P08 print `unexpected_lines>0` or a changed Goal/AC | An amendment touched more than the allowed lines (AC-F3-1/AC-F3-2) | Restore the untouched lines byte for byte. |
| P02/P05 print `MISSING` | A ticket clause has no anchor in the story (AC-F1-2/AC-F2-2) | Restore the clause; then run the manual read (G-1). |
| P35 prints `missing_clauses>0` | Fidelity is incomplete (AC-NFR8-1) | Restore the missing clause anchors; do not add a criterion. |
| P01 prints `shape_ok<7/7` | A story lacks Goal/Tasks/AC/Depends-on or gained a Ticket line (AC-F1-1) | Add the missing line; remove the Ticket line (no ticket exists yet). |
| P04/P06 print a missing dependency or fewer than seven ACs | The S17 entry is incomplete (AC-F2-1/AC-F2-3) | Restore the six dependencies and the seven-item numbered list. |
| P16 prints `2026-11-10 section=absent` or a marker `MISSING` | The status snapshot is absent or incomplete (AC-F7-1) | Add the section; include 23/23, the M2 state, #268/#280, and the maintenance convention. |
| P17 prints a pointer `no` | A superseded statement still stands unqualified (AC-F7-2) | Append a pointer naming the 2026-11-10 section; do not rewrite the original sentence. |
| P18/P34 print `CHANGED` or `<7/7` | Dated history moved (AC-F7-3/AC-NFR7-1) | Restore the section bytes exactly; a reflow is a failure. |
| P19/P20/P21/P22/P23 print `absent` or a missing marker | A pack document is missing or incomplete (AC-F8-*) | Add the document or the named section; keep the file set at exactly twelve. |
| P22 prints `stories_below_two>0` or `total_scenarios<32` | Scenario coverage is short (AC-F8-4) | Add scenarios for the named story; keep the twelve mandatory anchors. |
| P24/P25 print a header or section failure | A command contract is not man-page complete (AC-F9-1/AC-F9-2) | Restore `Status: Proposed (M2)`, `<binary>`, and the seven sections. |
| P26 prints a missing marker | The delta note lacks evidence or the outside-scope statement (AC-F10-1) | Add the observed invocation, exit code, and the pointer sentence. |
| P27 prints `M2 row=absent` or a missing artifact | The pack is not discoverable (AC-F11-1) | Add one planned row linking the README and every artifact; leave M0/M1 rows alone. |
| P31 is non-zero or prints drift | A scoped doc was disturbed | Check P28 first; the diff usually escaped planning. |
| P32 fails only in `ci-baseline-parity.test.ts` with a cross-device error | Pre-existing environment limitation (G-2) | Re-run with `TMPDIR` on the repository filesystem; record both runs. |
| P33 prints a fence or heading failure | The structural diagram contract is unmet (AC-NFR6-1) | Fix the fence or heading; then have the reviewer render the diagram (G-3). |
| P36 prints `seed_hits>0` or a guard violation | A forbidden literal was introduced (AC-NFR9-1) | Reword the line; never add an allowlist entry (that touches `scripts/**`). |
| P37 prints `broken_links>0` or `restated_ac_blocks>0` | A link is broken or a pack restates ACs (AC-NFR10-1) | Fix the path or replace the restatement with a story-code reference. |

## 8. Risks, Assumptions, and Open Questions

### 8.1 Risks

| ID | Testing risk | Mitigation in this plan |
|---|---|---|
| TR-1 | A prose oracle lets a lost clause pass as complete | 87 mechanical anchors (P02/P05) plus the recorded clause-by-clause read (G-1) |
| TR-2 | A preservation control passes because nothing changed | Non-vacuity guards in P03/P14/P28/P36/P37 and mutation controls in P07/P09/P30; the execution log labels controls |
| TR-3 | A hunk-containment check silently accepts the next heading line or a moved entry | P03 derives ranges from the headings and stops at the next `##`/`###`; P14/P30 compare body bytes independently |
| TR-4 | The entrypoint check hardcodes a family list and drifts from the product | P15 derives the set from live root `--help` |
| TR-5 | History "byte identity" is replaced by a normalised grep | P18/P34 use `cmp` on extracted sections; a reflow fails |
| TR-6 | `pnpm check` is green but unrelated to the documents | Content procedures carry the ACs; P32 is a no-regression gate only (G-7) |
| TR-7 | The guard is silent on `doc/planning/**`, so "guard green" is misread as full hygiene | P31 records the guard's path set and P36 scans added lines with the production matcher |
| TR-8 | The diagram check proves structure, not parseability | G-3 records the limit and assigns a rendered-preview read to the reviewer |
| TR-9 | A check is run on a moving base | Three-dot diff plus snapshots from the pinned base `fab46636`; re-materialise in P00 if the base advances |

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
| — | None outstanding | — | — | Closed by spec v1.1 and the pm-notes decisions |

## 9. Plan Revision Log

| Version | Date | Author | Changes |
|---|---|---|---|
| 1.0 | 2026-11-10 | @test-plan-writer | Initial test plan for spec v1.1: 37 ACs covered exactly once by 37 TCs (bidirectional traceability, no orphans), 38 procedure blocks (P00 base plus P01-P37), all 37 procedures run against base `fab46636` with observed results recorded (including both `pnpm check` runs), six pure preservation controls (P09, P10, P18, P29, P31, P34), partial controls recorded against P13, P17, P27, P30 and P36, non-vacuity labels on P03/P14/P28/P36/P37, the doc-distribution guard, the aggregate gate, the Appendix E structural diagram check, link and non-duplication checks, failure triage, and nine declared gaps with named owners. |

## 10. Test Execution Log

Run date 2026-11-10 against base `fab46636` on branch `docs/GH-284/m2-planning` (pre-change tree). `FAIL` proves the procedure detects the missing deliverable; `PASS (control)` proves a preservation property that must survive the change.

| TC ID | Run Date | Result | Notes |
|---|---|---|---|
| TC-M2PLAN-001 | 2026-11-10 | FAIL (change absent) | `m2_story_headings=0 new_found=0/7 order=FAIL`; `shape_ok=0/7`; verdict FAIL. The seven entries do not exist in the base tree. |
| TC-M2PLAN-002 | 2026-11-10 | FAIL (change absent) | `M2-S11=0/10`, `M2-S12=0/15`, `M2-S13=0/11`, `M2-S14=0/21`, `M2-S15=0/12`, `M2-S16=0/12`; `clauses_present=0/81`; verdict FAIL. |
| TC-M2PLAN-003 | 2026-11-10 | FAIL (vacuous: no hunk) | `backlog_hunks=0`; `FAIL: no backlog hunk (change absent)`; `non_vacuous=no`; `classifier_self_tests=2/2`. The classifier is proven live; the tree has nothing to classify yet. |
| TC-M2PLAN-004 | 2026-11-10 | FAIL (change absent) | `S17=absent`; verdict FAIL. No S17 entry exists in the base tree. |
| TC-M2PLAN-005 | 2026-11-10 | FAIL (change absent) | `S17=absent clauses_present=0/6`; `missing=6`. |
| TC-M2PLAN-006 | 2026-11-10 | FAIL (change absent) | `S17=absent ac_items=0/7`; `ac_items=0`. |
| TC-M2PLAN-007 | 2026-11-10 | FAIL (no amendment; oracle self-test passes) | `changed_lines=0 unexpected_lines=0`; `depends=NOT expected (- Depends on: M1-S5, M1-S17.)`; `M2-S4 shape FAIL (no amendment)`. Self-test printed `changed_lines=2 unexpected_lines=2`, so the oracle fires. |
| TC-M2PLAN-008 | 2026-11-10 | FAIL (no amendment; identity controls pass) | `changed_lines=0`; `tasks_clause=MISSING`; `depends=M2-S14 MISSING`; `heading=identical`; `base_task_lines_missing=0`; `- Goal: identical`; `- AC: identical`. The identity halves are a passing control; the amendment is absent. |
| TC-M2PLAN-009 | 2026-11-10 | PASS (control) | `base_headings=67 head_headings=67 added=0 removed=0 unexpected=0`; `retirement_note=identical`; `order=OK`; `negative_control=detected`. This is a passing preservation control on the pre-change tree; the non-vacuity half is supplied by P01 and by the mutation control. |
| TC-M2PLAN-010 | 2026-11-10 | PASS (control) | `fm=byte-identical`; `rg=byte-identical`; `cc=byte-identical`. Passing control. |
| TC-M2PLAN-011 | 2026-11-10 | FAIL (15 drift pages) | `pages=28`; `M1_planned_hits=9`; `M1_milestone_planned_hits=2`; `forbidden_phrase_pages=11`; `header_attribution=2/14` (`plan.md` and `commit.md` already carry their GH references but still contain `M1 milestone planned`). Missing tokens printed for the other twelve pages. |
| TC-M2PLAN-012 | 2026-11-10 | FAIL (change absent) | All three `MISSING`. |
| TC-M2PLAN-013 | 2026-11-10 | FAIL (header); body preservation PASS (control) | `M1-S18 MISSING`; `GH-238 OK`; `not mounted MISSING`; `entrypoint delta MISSING`; `Current=PRESENT`; `daemon_body=byte-identical`. The header is the failing half; the body-identity check is a passing control until the header edit lands. |
| TC-M2PLAN-014 | 2026-11-10 | FAIL (vacuous: no page changed) | `changed_pages=0/14`; `total_hunks=0`; `entrypoint_hunks=0`; `classifier_inside=OK`; `classifier_outside=OK`; `non_vacuous=no`. |
| TC-M2PLAN-015 | 2026-11-10 | FAIL (composition sentence unchanged) | `observed_families=16`; `composed_families=14`; `families_not_composed=coordinator dispatch`; `dispatch=claimed-not-registered (FAIL)`; `description_changed_sentence_lines=0`. |
| TC-M2PLAN-016 | 2026-11-10 | FAIL (change absent) | `new_sections=0`; `2026-11-10 section=absent`; verdict FAIL. |
| TC-M2PLAN-017 | 2026-11-10 | FAIL (pointers absent); byte retention PASS (control) | All four groups retain their bytes (`yes`), but every pointer check is `no` and `g4_pointers=0/3`. Byte retention is a passing control; the pointers are absent. |
| TC-M2PLAN-018 | 2026-11-10 | PASS (control) | `sections_identical=7/7`. Passing control on the pre-change tree. |
| TC-M2PLAN-019 | 2026-11-10 | FAIL (change absent) | `pack_files=0/12`; `actual_files=0`; `README=absent`. |
| TC-M2PLAN-020 | 2026-11-10 | FAIL (change absent) | `architecture=absent`. |
| TC-M2PLAN-021 | 2026-11-10 | FAIL (change absent) | `contracts=absent`. |
| TC-M2PLAN-022 | 2026-11-10 | FAIL (change absent) | `test-scenarios=absent`. |
| TC-M2PLAN-023 | 2026-11-10 | FAIL (change absent) | `journeys=absent`. |
| TC-M2PLAN-024 | 2026-11-10 | FAIL (change absent) | `command_headers=0/6`; all six files absent. |
| TC-M2PLAN-025 | 2026-11-10 | FAIL (change absent) | All six absent; both relationship checks `MISSING`. |
| TC-M2PLAN-026 | 2026-11-10 | FAIL (change absent) | `delta=absent`. |
| TC-M2PLAN-027 | 2026-11-10 | FAIL (row absent); M0/M1 preservation PASS (control) | `M2 row=absent`; `m2_row_marked_planned=no`; both M0/M1 rows identical. Row absence is the failing half; row preservation is a passing control. |
| TC-M2PLAN-028 | 2026-11-10 | FAIL (vacuous: no product file changed) | `product_files=0`; `forbidden_root_files=0`; `outside_planning=0`; `unexpected_paths=0`; `non_vacuous=no (no product file changed)`. Zero is a containment pass but not evidence the change exists; hence FAIL for non-vacuity. |
| TC-M2PLAN-029 | 2026-11-10 | PASS (control) | `stories_compared=65 identical=65 changed=0`. Passing control. |
| TC-M2PLAN-030 | 2026-11-10 | FAIL (entrypoint sentence unchanged); body preservation PASS (control) | `body_identical=14/14`; `description_changed_sentence_lines=0`; `one_sentence_mutation=applied`. |
| TC-M2PLAN-031 | 2026-11-10 | PASS (control) | `guard_exit=0`; `(guard-doc-distribution)[OK] no drift — 82 in-scope docs; install set matches ados_distribution markers`; `planning_markers=0`. Passing control. |
| TC-M2PLAN-032 | 2026-11-10 | PASS (TMPDIR-corrected); default run FAIL (pre-existing environment, G-2) | Default run: `pnpm_check_exit=1`; `7132 pass`, `1 fail`, `Ran 7137 tests across 880 files [346.56s]`; the sole failure is `CI baseline parity (hermetic partial clone) > a depth-1 checkout fails closed and the baseline fetch is the remedy`, caused by `git clone --local` failing with a cross-device link. Lint, format:check, and typecheck passed; the boundary, prompt, help, and exports stages did not run in that attempt. `TMPDIR`-corrected run: `tmpdir_check_exit=0`; `7133 pass`, `0 fail`, `Ran 7137 tests across 880 files [385.27s]`; `check:boundaries`, `prompt-conformance` (5 prompts clean), `help-guide-coverage`, and `exports-parity` all pass. |
| TC-M2PLAN-033 | 2026-11-10 | FAIL (change absent) | `FAIL: doc/planning/oss-tooling/milestones/m2 absent; mermaid fences=0 (<10)`; `inventory=c4:0/3 flows:0/6 park:0/1`. |
| TC-M2PLAN-034 | 2026-11-10 | PASS (control) | `dated_sections_identical=7/7`; `group_sentences_retained=4/4`. Passing control. |
| TC-M2PLAN-035 | 2026-11-10 | FAIL (change absent; 87 missing anchors) | `P02 missing=81 total=81`; `P05 missing=6`; `P06 ac_items=0`; `missing_clauses=87`; `added_criteria=n/a (S17 absent)`; `changed_meaning=manual clause-by-clause review (declared gap G-1)`; verdict FAIL. |
| TC-M2PLAN-036 | 2026-11-10 | PASS (guard control); FAIL (vacuous scan) | `forbidden_exit=0`; `OK forbidden-literals: 5/5 scope classes scanned, 0 violations`; `added_lines=0`; `seed_hits=0`; `non_vacuous=no`. Zero violations is a passing guard control; the added-line scan is vacuous until the change lands. |
| TC-M2PLAN-037 | 2026-11-10 | FAIL (vacuous: no changed file) | `changed_planning_files=0`; `broken_links=0`; `restated_ac_blocks=0`; `non_vacuous=no`. |
