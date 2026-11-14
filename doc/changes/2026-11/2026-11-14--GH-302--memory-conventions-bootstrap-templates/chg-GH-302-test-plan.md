---
id: chg-GH-302-test-plan
status: Proposed
created: 2026-11-14
last_updated: 2026-11-14
owners: [Juliusz Ćwiąkalski]
service: delivery-os
labels: [milestone-m2, memory, bootstrap, documentation]
version_impact: minor
summary: "Verification strategy for wiring memory conventions into bootstrap Phase 5 templates: docs/templates/prompt change with no runtime code — automated template/content invariants (bun:test + bash guards), existing conformance/distribution gates, and an explicit manual checklist for the live-bootstrap behaviors automation cannot reach."
links:
  change_spec: ./chg-GH-302-spec.md
  implementation_plan: ./chg-GH-302-plan.yaml
  testing_strategy: .ai/rules/testing-strategy.md
---

# Test Plan - M2-S9: Memory conventions in bootstrap templates (M2)

## 1. Scope and Objectives

This change is a **docs/templates/prompt change with no runtime code**: it wires the agent-memory learning loop (memory tree scaffold, AGENTS.md kernel section, coordinator capture/promotion rules, retro-note conventions, a documentation-only manual doctor checklist) into bootstrap Phase 5 via `.opencode/agent/bootstrapper.md`, `.opencode/command/bootstrap.md`, `doc/guides/project-inception.md`, new templates under `doc/templates/**`, the aligned concept `doc/planning/concepts/memory-practices.md`, and the landing of `doc/decisions/PDR-0004-memory-practices-concept-repo-internal.md` beside its already-committed index row.

The core behavior to protect is **convention fidelity**: the scaffolded conventions must mirror the current-truth kernel (the "Agent memory" section of this repository's AGENTS.md) exactly — no invented record schema (NG-2), no memory tooling (NG-1), no doctor automation (NG-3), no ceremony invention (NG-5) — while bootstrap containment (the Phase 5 write allowlist) is extended by exactly the memory tree root and stays textually identical across the three carriers that state it (feature spec, bootstrapper prompt, inception guide). The integrity risks are drift between the scaffold, kernel, and instruction wiring (RSK-2); allowlist over-extension (RSK-3); distribution-marker drift (RSK-5); and prompt-conformance regressions (RSK-6). The motivating regressions are: a bootstrapped project receiving a tree shape that diverges from what GH-301 will define; a kernel section that invents typed-record fields; and a scaffold written outside the allowlist.

### 1.1 In Scope

- Automated template-shape and content-class invariants for the new memory templates (scaffold seeds, kernel section reference, coordinator capture/promotion content, retro-note conventions, manual doctor checklist, adoption checklist) — including the `ados_distribution` marker requirement.
- Cross-carrier consistency checks: write-allowlist identity across `doc/spec/features/feature-bootstrapper.md`, `.opencode/agent/bootstrapper.md`, and `doc/guides/project-inception.md`; Phase 6 readiness enumeration of memory artifacts; memory templates indexed in `doc/templates/README.md`.
- Concept alignment checks: `doc/planning/concepts/memory-practices.md` adoption checklist corrected to the scaffolded tree shape (DEC-2); its kernel template section consistent with F-2; PDR-0004 file + index row + spec-reference consistency.
- Negative invariants demanded by the spec: no executable memory-doctor/lint component (NG-1/NG-3/DEC-3); scaffold provisions exactly the current-truth tree set and NOT preferences/retro-archive areas (DEC-2); installed convention carriers stay self-contained per PDR-0004/DEC-6 (no `doc/planning/concepts` references inside installed carriers).
- Existing aggregate gates: `pnpm check` (incl. `check:prompt`, `check:help`, doc-conformance suite), `bash scripts/.tests/test-doc-distribution.sh`, and the generated-plugin regeneration check.
- Manual verification of the behaviors automation cannot reach: live bootstrap of a real project through Phase 5/6, resume-after-interruption, and generated-artifact budget measurement.

### 1.2 Out of Scope & Known Gaps

- **No memory tooling, lint, or doctor automation is tested into existence** (NG-1/NG-3): TC-MEMDOCT-002 asserts their *absence*; GH-301 owns replacing that guard when tooling lands legitimately.
- **No runtime bootstrap engine exists to integration-test**: Phase 5 is a human-executable workflow (prompt + guide), not code in `packages/**`. The scaffold's runtime behavior (actual file creation in a target project) is verified by the manual checklist (TC-MEMRESUME-002, TC-MEMBUDGET-002), not by automated E2E.
- **This repository's own `.ai/memory` tree is not modified or linted by this change** (NG-4); its health is GH-301's concern.
- **Retro ceremony mechanics** (M2-S3/M2-S10) and **retrofit automation** for previously bootstrapped projects (NG-6) are out of scope and untested here.
- **Change-capsule mechanics** (`events.jsonl`, candidates) are referenced, not modified; their existing suites are untouched.
- Known gap accepted per testing-strategy fallback rules: permanent suites must never assert a branch diff (`.ai/rules/testing-strategy.md`, invariant-test authoring), so "this change touches no forbidden area" (NG-4, NG-5) is enforced as a review-time changed-file check (TC-MEMSCAF-004, TC-MEMWIRE-004), not a permanent suite.

## 2. References

- Change specification: `./chg-GH-302-spec.md` (ACs AC-F1-1…AC-NFR4-1; F-1…F-7; DM-1…DM-3; NFR-1…NFR-6; NG-1…NG-6; DEC-1…DEC-6; constraint register C-1…C-6)
- Implementation plan: `./chg-GH-302-plan.yaml` — **pending** (phase 4 of the lifecycle); this plan constrains it: the delivery phase covering the F-6 concept alignment must declare `doc/decisions/**` in its scope so PDR-0004's file lands with its already-committed index row (pm-notes DEFER contract, TC-MEMALIGN-003)
- Testing strategy: `.ai/rules/testing-strategy.md` (module→test mapping: `doc/**` and `doc/templates/**` → static/diff + content checks; bash test naming `test-*.sh` in adjacent `.tests/`; bun:test under `tests/<layer>/`)
- PM notes: `./chg-GH-302-pm-notes.yaml` (DEC-1/DEC-5 binding decisions; gate convention `TMPDIR=$PWD/tmp/tmpdir pnpm check`; PDR-0004 landing mechanics)
- Milestone scenario seeds: `doc/planning/oss-tooling/milestones/m2/test-scenarios.md` — SC-M2-S9-01, SC-M2-S9-02 (inherited and reconciled, see Section 5.2 notes and Section 8)
- Current-truth source mirrored by the scaffold: the "Agent memory" section of this repository's `AGENTS.md`
- Decision record: `doc/decisions/PDR-0004-memory-practices-concept-repo-internal.md` (untracked at test-plan time; lands during delivery) + committed index row in `doc/decisions/00-index.md`
- Bootstrap contract surfaces: `doc/spec/features/feature-bootstrapper.md` (§Write allowlist, Phase 5 outputs, NFR table), `.opencode/agent/bootstrapper.md` (`<write_allowlist>` block, Phase 5/6 sections), `doc/guides/project-inception.md` (Phase 5 authority detail, Phase 6 readiness)
- Concept doc: `doc/planning/concepts/memory-practices.md` (Draft, 2026-10-26; kernel template section; "Bootstrapping a project" adoption checklist)

## 3. Coverage Overview

### 3.1 Functional Coverage (F-#, AC-#)

| AC ID | Description (abbreviated) | TC ID(s) | Status |
|-------|---------------------------|----------|--------|
| AC-F1-1 | Scaffold exists after Phase 5 with exactly the current-truth tree set (index, per-agent entry points, lessons, tacit), seeded empty (seed SC-M2-S9-01) | TC-MEMSCAF-001, TC-MEMSCAF-002, TC-MEMSCAF-003, TC-MEMRESUME-002 | Covered |
| AC-F2-1 | AGENTS.md kernel section carries the source content classes, no record-schema fields | TC-MEMKERN-001, TC-MEMKERN-002, TC-MEMKERN-003 | Covered |
| AC-F3-1 | Coordinator instructions state capture bar + promotion path; retro conventions reference, not duplicate (seed SC-M2-S9-02) | TC-MEMWIRE-001, TC-MEMWIRE-002, TC-MEMWIRE-003 | Covered |
| AC-F4-1 | Retro handling prescribed by documentation alone — append-only notes + generated index, no ceremony/command/executable | TC-MEMWIRE-003, TC-MEMWIRE-004 | Covered |
| AC-F5-1 | Doctor executes as documented manual checklist (six audit areas), no script/gate/package change | TC-MEMDOCT-001, TC-MEMDOCT-002 | Covered |
| AC-F6-1 | Meta-learning reference agrees with scaffold on tree shape, caps, capture bar — zero contradictions | TC-MEMALIGN-001, TC-MEMALIGN-002, TC-MEMALIGN-003 | Covered |
| AC-F7-1 | Allowlist extended by exactly `.ai/memory/**`; identical text across the three carriers; out-of-allowlist confirmation rule unchanged | TC-MEMCONT-001, TC-MEMCONT-002 | Covered |
| AC-F7-2 | Phase 6 readiness fails and reopens when memory artifacts are incomplete | TC-MEMCONT-003, TC-MEMRESUME-002 | Covered |
| AC-F1-2 | Interrupted Phase 5 resume completes scaffold without duplication/overwrite | TC-MEMRESUME-001, TC-MEMRESUME-002 | Covered |
| AC-NFR2-1 | Generated per-agent entry points ≤ ~150 lines; memory index ≤ 200 lines | TC-MEMBUDGET-001, TC-MEMBUDGET-002 | Covered |
| AC-NFR4-1 | Prompt conformance, help/reference checks, doc-distribution test all pass with zero drift | TC-MEMCONF-001, TC-MEMCONF-002, TC-MEMCONF-003 | Covered |

Every AC is covered; no AC is left as TODO.

### 3.2 Interface Coverage (API-#, EVT-#, DM-#)

No API/EVT interfaces exist in this change (spec §8.1/§8.2: N/A). Data-model surfaces:

| ID | Element | TC ID(s) | Status |
|----|---------|----------|--------|
| DM-1 | Bootstrapped memory tree shape (index, `agents/<agent>/README.md` per resident role, `lessons/`, `tacit/`; ephemeral excluded) | TC-MEMSCAF-001, TC-MEMSCAF-002 | Covered |
| DM-2 | Generated kernel section shape (10 content classes, no record-schema fields) | TC-MEMKERN-001, TC-MEMKERN-002 | Covered |
| DM-3 | Retro-note convention shape (append-only notes + generated index; referenced, not duplicated) | TC-MEMWIRE-003 | Covered |

### 3.3 Non-Functional Coverage (NFR-#)

| NFR ID | Requirement | TC ID(s) | Status |
|--------|-------------|----------|--------|
| NFR-1 | Zero convention drift vs current-truth kernel; no invented fields | TC-MEMKERN-003 (manual fidelity review), TC-MEMKERN-002, TC-MEMALIGN-002 | Covered |
| NFR-2 | Budget caps mirrored in scaffold and checklist (~150 / ≤200; kernel ~200-line guidance) | TC-MEMBUDGET-001, TC-MEMBUDGET-002, TC-MEMDOCT-001 | Covered |
| NFR-3 | Phase 5 gains no additional human gates or interview questions | TC-MEMFLOW-001 | Covered |
| NFR-4 | Conformance: prompt scans, help/reference checks, doc-distribution gate green | TC-MEMCONF-001, TC-MEMCONF-002, TC-MEMCONF-003 | Covered |
| NFR-5 | Resume idempotency: no duplicated entry points, no silent overwrite | TC-MEMRESUME-001, TC-MEMRESUME-002 | Covered |
| NFR-6 | `TMPDIR=$PWD/tmp/tmpdir pnpm check` green before PR opens | TC-MEMCONF-001 | Covered |

## 4. Test Types and Layers

Per `.ai/rules/testing-strategy.md`, this is a docs/templates change: the primary layers are **static/diff checks** and **content checks**, escalated with two automated invariant suites where risk requires it.

- **TypeScript content-invariant suite (bun:test):** `tests/structure/memory-bootstrap-templates.test.ts` (new, To Implement) — template-set shape, content classes, negative invariants, budget caps, PDR-0004 record consistency. Follows the repo precedent `tests/checks/decision-record.test.ts` (record + index + spec-reference assertions). Runs under `bun test` / `pnpm test`; no fixtures, read-only against the working tree.
- **Bash cross-doc consistency guard:** `scripts/.tests/test-inception-doc-consistency.sh` (existing, To Update) — gains a memory-wiring check: allowlist identity + golden entry-set across the three carriers, Phase 6 readiness enumeration, and memory templates indexed in `doc/templates/README.md` (its existing self-containment pattern is reused for the PDR-0004 self-containment rule).
- **Existing aggregate gates (no change):** `pnpm check` = `lint → format:check → typecheck → test → check:boundaries → scripts/checks/prompt-conformance.ts (check:prompt) → scripts/checks/help-guide-coverage.ts (check:help) → exports-parity`. The bun test tier includes `tests/checks/doc-conformance.test.ts` (current-truth phrase table) and `tests/checks/prompt-conformance.test.ts`, which together enforce current-state prompt authoring on the edited bootstrapper/bootstrap prompts. Execution convention: `TMPDIR=$PWD/tmp/tmpdir pnpm check` (pm-notes).
- **Existing distribution drift guard (no change):** `bash scripts/.tests/test-doc-distribution.sh` — derives the expected install set from `ados_distribution` markers and compares against a real sandbox `install.sh --local` run; every new template must carry its marker or the guard fails with `missing-marker` / `redistributable-not-installed`.
- **Existing plugin-regeneration guard (no change):** `bash scripts/.tests/test-build-claude-plugin.sh` + CI staleness check — generated `.ados-claude/**` output must be regenerated with the source prompt change.
- **Manual layer:** live bootstrap dry-run of a real target project (Phase 5 → Phase 6 gate → tree inspection → budget measurement → resume-after-interruption), the kernel-fidelity review against the source kernel section, and review-time changed-file checks for NG-4/NG-5. Covered by the manual checklist in Section 6 and TC-MEMRESUME-002, TC-MEMBUDGET-002, TC-MEMKERN-003, TC-MEMSCAF-004, TC-MEMWIRE-004.

## 5. Test Scenarios

### 5.1 Scenario Index

| TC ID | Title | Type | Level | Priority | AC Coverage |
|-------|-------|------|-------|----------|-------------|
| TC-MEMSCAF-001 | Scaffold declares exactly the current-truth tree set | Happy Path | Automated | High | AC-F1-1, DM-1 (seed SC-M2-S9-01) |
| TC-MEMSCAF-002 | Scaffold does not provision preferences/retro-archive areas | Negative | Automated | High | AC-F1-1 (DEC-2, OQ-1) |
| TC-MEMSCAF-003 | Entry-point READMEs state the capture bar and read/write policy | Happy Path | Automated | High | AC-F1-1 (seed SC-M2-S9-01) |
| TC-MEMSCAF-004 | Delivering change does not modify this repo's `.ai/memory/**` | Negative | Manual (review) | Medium | NG-4 |
| TC-MEMKERN-001 | Kernel section template carries all ten content classes | Happy Path | Automated | High | AC-F2-1, DM-2 |
| TC-MEMKERN-002 | Kernel section contains no record-schema fields | Negative | Automated | Critical | AC-F2-1 (NG-2, DEC-1) |
| TC-MEMKERN-003 | Kernel fidelity review vs source kernel section | Regression | Manual | High | AC-F2-1, NFR-1 |
| TC-MEMWIRE-001 | Coordinator instructions state capture bar and promotion path | Happy Path | Automated | High | AC-F3-1 (seed SC-M2-S9-02) |
| TC-MEMWIRE-002 | Companion instruction files carry per-role memory expectations | Happy Path | Automated | Medium | AC-F3-1 |
| TC-MEMWIRE-003 | Retro-note conventions are docs-only, append-only, referencing | Happy Path | Automated | High | AC-F3-1, AC-F4-1, DM-3 (seed SC-M2-S9-02) |
| TC-MEMWIRE-004 | No retro ceremony command/executable shipped | Negative | Manual (review) | Medium | AC-F4-1 (NG-5, DEC-4) |
| TC-MEMDOCT-001 | Manual doctor checklist covers the six audit areas and its manual-until-lint status | Happy Path | Automated | High | AC-F5-1, NFR-2 |
| TC-MEMDOCT-002 | No executable memory-doctor/lint component exists | Negative | Automated | Critical | AC-F5-1 (NG-1, NG-3, DEC-3) |
| TC-MEMALIGN-001 | Concept adoption checklist corrected to the scaffolded tree shape | Regression | Automated | High | AC-F6-1 (DEC-2) |
| TC-MEMALIGN-002 | Concept kernel template section consistent with F-2 content classes | Regression | Automated | Medium | AC-F6-1, NFR-1 |
| TC-MEMALIGN-003 | PDR-0004 file, index row, and spec references are consistent | Happy Path | Automated | High | AC-F6-1 (DEC-6, PDR-0004) |
| TC-MEMCONT-001 | Allowlist text identical across the three carriers; confirmation rule unchanged | Happy Path | Automated | Critical | AC-F7-1 |
| TC-MEMCONT-002 | Golden allowlist entry-set: exactly the canonical set plus `.ai/memory/**` | Negative | Automated | Critical | AC-F7-1 (RSK-3) |
| TC-MEMCONT-003 | Phase 6 readiness enumerates memory artifacts and fails on incompleteness | Happy Path | Semi-automated | High | AC-F7-2 |
| TC-MEMRESUME-001 | Resume semantics for the memory scaffold stated in prompt and guide | Edge Case | Semi-automated | High | AC-F1-2, NFR-5 |
| TC-MEMRESUME-002 | Live bootstrap dry-run: tree, kernel, readiness gate, resume, budgets | Happy Path | Manual | High | AC-F1-1, AC-F1-2, AC-F7-2, AC-NFR2-1 (seed SC-M2-S9-01 E2E) |
| TC-MEMBUDGET-001 | Scaffold seed templates are within budget caps | Edge Case | Automated | Medium | AC-NFR2-1, NFR-2 |
| TC-MEMBUDGET-002 | Generated scaffold budgets measured via doctor checklist | Edge Case | Manual | Medium | AC-NFR2-1 |
| TC-MEMFLOW-001 | Phase 5 gate count and interview questions unchanged | Regression | Semi-automated | Medium | NFR-3 |
| TC-MEMCONF-001 | Aggregate gate `TMPDIR=$PWD/tmp/tmpdir pnpm check` green | Regression | Automated | Critical | AC-NFR4-1, NFR-6 |
| TC-MEMCONF-002 | Doc-distribution drift guard passes with zero drift | Regression | Automated | Critical | AC-NFR4-1 (C-3) |
| TC-MEMCONF-003 | Generated plugin output regenerated with the source prompt change | Regression | Automated | Medium | AC-NFR4-1 (C-4, RSK-6) |

### 5.2 Scenario Details

#### TC-MEMSCAF-001 - Scaffold declares exactly the current-truth tree set

**Scenario Type**: Happy Path
**Impact Level**: Critical
**Priority**: High
**Related IDs**: F-1, AC-F1-1, DM-1, NFR-1 (seed SC-M2-S9-01)
**Test Type(s)**: Unit (content invariant)
**Automation Level**: Automated
**Target Layer / Location**: `tests/structure/memory-bootstrap-templates.test.ts` reading `doc/templates/**` (memory scaffold templates) and `.opencode/agent/bootstrapper.md` (Phase 5 memory block)
**Tags**: @bun, @templates, @docs

**Preconditions**:

- The memory scaffold templates exist under `doc/templates/**` with `ados_distribution` markers.
- The bootstrapper prompt's Phase 5 section names the memory artifacts it creates.

**Steps**:

1. Read the memory scaffold template set; collect the declared scaffold elements.
2. Assert the declared set equals the current-truth tree set: memory index entry point (`.ai/memory/README.md` pattern), one per-agent entry-point README per resident agent role (`.ai/memory/agents/<agent>/README.md` pattern), the lessons area (`.ai/memory/lessons/`), and the tacit area (`.ai/memory/tacit/`).
3. Assert the bootstrapper prompt's Phase 5 memory block names exactly these artifacts and that seeding is structural (empty; conventions, not records).
4. Assert ephemeral state (`.ai/local/**`) is declared outside the committed tree.

**Expected Outcome**:

- The declared scaffold set matches the canonical list exactly; every canonical element has a template carrier; nothing extra is declared.

**Notes / Clarifications**:

- This is the automated, template-level form of seed SC-M2-S9-01 ("the bootstrapped tree lists the memory index, the lessons area, and one entry point per agent role"); the end-to-end runtime observation is TC-MEMRESUME-002.
- Anchor filenames are fixed when the plan names the template files; the suite's canonical list is updated deliberately at that point (recorded in the revision log), not per-edit.

#### TC-MEMSCAF-002 - Scaffold does not provision preferences/retro-archive areas

**Scenario Type**: Negative
**Impact Level**: Critical
**Priority**: High
**Related IDs**: F-1, AC-F1-1, DM-1 (DEC-2, OQ-1 resolution)
**Test Type(s)**: Unit (negative content invariant)
**Automation Level**: Automated
**Target Layer / Location**: `tests/structure/memory-bootstrap-templates.test.ts`
**Tags**: @bun, @templates, @docs

**Preconditions**:

- TC-MEMSCAF-001's canonical tree set is pinned.

**Steps**:

1. Assert no scaffold template or Phase 5 prompt instruction provisions a `preferences/` area or a retro-archive area.
2. Assert the corrected adoption checklist (see TC-MEMALIGN-001) and the scaffold agree: areas beyond index / per-agent entry points / lessons / tacit are absent from the bootstrap provisioning surface.

**Expected Outcome**:

- Zero occurrences of the deferred areas anywhere in the scaffold-declaration surface (templates + prompt Phase 5 memory block).

**Notes / Clarifications**:

- Encodes the DEC-2 resolution of OQ-1; GH-301 owns revisiting the full committed tree.

#### TC-MEMSCAF-003 - Entry-point READMEs state the capture bar and read/write policy

**Scenario Type**: Happy Path
**Impact Level**: Important
**Priority**: High
**Related IDs**: F-1, AC-F1-1, NFR-1 (seed SC-M2-S9-01: "each with the capture bar stated")
**Test Type(s)**: Unit (content invariant)
**Automation Level**: Automated
**Target Layer / Location**: `tests/structure/memory-bootstrap-templates.test.ts`
**Tags**: @bun, @templates

**Preconditions**:

- The per-agent entry-point README template exists.

**Steps**:

1. Read the per-agent entry-point README template.
2. Assert it states the capture bar (repeat mistake, review catch, repeated correction, verified outcome, repeated workflow) and the read/write policy (read own entry point at session start; write own folder only; shared surfaces are consolidation-owned).

**Expected Outcome**:

- The template carries both content classes in business language, mirroring the source kernel.

#### TC-MEMSCAF-004 - Delivering change does not modify this repo's `.ai/memory/**`

**Scenario Type**: Negative
**Impact Level**: Important
**Priority**: Medium
**Related IDs**: NG-4
**Test Type(s)**: Manual (review-time changed-file check)
**Automation Level**: Manual
**Target Layer / Location**: Review checklist (changed-file list of the PR against `main-tools`)
**Tags**: @manual, @review

**Preconditions**:

- Feature branch `feat/GH-302/memory-conventions-bootstrap-templates` cut from `main-tools`.

**Steps**:

1. At review time, list the change's files (`git diff --name-only <base>...HEAD`).
2. Assert no path under `.ai/memory/**` appears.

**Expected Outcome**:

- Zero changes to this repository's own memory tree in the PR.

**Notes / Clarifications**:

- Review-time by design: `.ai/rules/testing-strategy.md` forbids permanent suites from asserting branch diffs. Note for the PM: the spec states this tree "does not exist yet" (NG-4 parenthetical, Context 2.1), but repo truth is that it exists and is tracked (created by GH-204, present in base commit 92b64753) — see Section 8.3; the constraint itself remains valid and now guards a populated tree.

#### TC-MEMKERN-001 - Kernel section template carries all ten content classes

**Scenario Type**: Happy Path
**Impact Level**: Critical
**Priority**: High
**Related IDs**: F-2, AC-F2-1, DM-2
**Test Type(s)**: Unit (content invariant)
**Automation Level**: Automated
**Target Layer / Location**: `tests/structure/memory-bootstrap-templates.test.ts` reading the kernel-section template/reference under `doc/templates/**`
**Tags**: @bun, @templates

**Preconditions**:

- The kernel-section template exists (the carrier Phase 5 uses to render the AGENTS.md memory section).

**Steps**:

1. Read the kernel-section template.
2. Assert each of the ten content classes from DM-2 is present: (1) canonical + ephemeral locations; (2) read policy (entry point at session start, just-in-time topic reads); (3) capture bar; (4) write ownership (own folder only, consolidation-owned shared surfaces); (5) evidence bar; (6) supersede-never-rewrite; (7) reviewer-independence exclusion; (8) budget caps; (9) promotion handoff routing; (10) change-capsule completion (referenced only).
3. Assert it references the installed conventions rather than duplicating them (presence of a routing reference to the memory index/convention material).

**Expected Outcome**:

- All ten classes present; content classes are asserted by stable anchor phrases agreed at implementation, not by fragile prose matching.

#### TC-MEMKERN-002 - Kernel section contains no record-schema fields

**Scenario Type**: Negative
**Impact Level**: Critical
**Priority**: High
**Related IDs**: F-2, AC-F2-1, DM-2, NG-2, DEC-1 (constraint C-1)
**Test Type(s)**: Unit (negative content invariant)
**Automation Level**: Automated
**Target Layer / Location**: `tests/structure/memory-bootstrap-templates.test.ts`
**Tags**: @bun, @templates

**Preconditions**:

- TC-MEMKERN-001 passes.

**Steps**:

1. Read the kernel-section template and the scaffold seed templates.
2. Assert none of them declares a record schema — none of the typed-record fields `id`, `kind`, `scope`, `provenance`, `trust`, `validity`, `status` is presented as a required record field or a schema table.
3. Assert the only record properties stated are the current-truth ones (dated, evidence-linked, supersede-never-rewrite).

**Expected Outcome**:

- No schema declaration exists in any memory template.

**Notes / Clarifications**:

- Fragility note: the words themselves can legitimately appear in prose (e.g., "status: Proposed"); the assertion keys on schema-shaped constructs (field lists/tables presented as record requirements), and the anchor is chosen at implementation to be precise. DEC-1 makes this the binding mirror constraint; a violation here is a spec-level breach (NFR-1).

#### TC-MEMKERN-003 - Kernel fidelity review vs source kernel section

**Scenario Type**: Regression
**Impact Level**: Critical
**Priority**: High
**Related IDs**: F-2, AC-F2-1, NFR-1 (Success Metrics: "mirrors source, no invented fields")
**Test Type(s)**: Manual (traceability/fidelity review)
**Automation Level**: Manual
**Target Layer / Location**: Review checklist; source = "Agent memory" section of `AGENTS.md`; target = kernel-section template + generated-shape documentation
**Tags**: @manual, @review

**Preconditions**:

- TC-MEMKERN-001/002 pass.

**Steps**:

1. Side-by-side compare the kernel-section template's content classes against the source "Agent memory" section.
2. Record the verdict "mirrors source, no invented fields" in the review notes (per spec Success Metrics).

**Expected Outcome**:

- Zero drift findings; semantic fidelity confirmed where greps cannot reach (wording quality, emphasis, routing correctness).

#### TC-MEMWIRE-001 - Coordinator instructions state capture bar and promotion path

**Scenario Type**: Happy Path
**Impact Level**: Critical
**Priority**: High
**Related IDs**: F-3, AC-F3-1 (seed SC-M2-S9-02)
**Test Type(s)**: Unit (content invariant)
**Automation Level**: Automated
**Target Layer / Location**: `tests/structure/memory-bootstrap-templates.test.ts` reading the coordinator-instructions template (the carrier Phase 5 renders into the installed `.ai/agent/pm-instructions.md`)
**Tags**: @bun, @templates

**Preconditions**:

- The coordinator-instructions template carries the memory wiring.

**Steps**:

1. Read the coordinator-instructions template.
2. Assert it states the capture bar and the promotion path (candidates route to exactly one home; coordinator owns curation/consolidation mandate).

**Expected Outcome**:

- Both rules present in the installed coordinator carrier.

**Notes / Clarifications**:

- Seed reconciliation: SC-M2-S9-02's "coordinator instructions contain the capture bar and the promotion path" is asserted here; the seed's retro clause is reconciled in TC-MEMWIRE-003.

#### TC-MEMWIRE-002 - Companion instruction files carry per-role memory expectations

**Scenario Type**: Happy Path
**Impact Level**: Important
**Priority**: Medium
**Related IDs**: F-3, AC-F3-1
**Test Type(s)**: Unit (content invariant)
**Automation Level**: Automated
**Target Layer / Location**: `tests/structure/memory-bootstrap-templates.test.ts` reading the companion installed instruction templates (PR/MR, decision, code-review)
**Tags**: @bun, @templates

**Preconditions**:

- Companion instruction templates carry per-role memory expectations.

**Steps**:

1. Read each companion instruction template.
2. Assert the per-role memory expectations are present (read own entry point, write own folder, no cross-agent memory edits) and that they reference the kernel rather than restating it (no duplicated capture-bar/promotion-path text).

**Expected Outcome**:

- Consistent per-role expectations; reference-not-restate holds.

#### TC-MEMWIRE-003 - Retro-note conventions are docs-only, append-only, referencing

**Scenario Type**: Happy Path
**Impact Level**: Important
**Priority**: High
**Related IDs**: F-4, AC-F3-1, AC-F4-1, DM-3 (seed SC-M2-S9-02, reconciled)
**Test Type(s)**: Unit (content invariant)
**Automation Level**: Automated
**Target Layer / Location**: `tests/structure/memory-bootstrap-templates.test.ts` reading the retro-note conventions template
**Tags**: @bun, @templates

**Preconditions**:

- The retro-note conventions template exists in the installed template set.

**Steps**:

1. Read the retro-note conventions template.
2. Assert it prescribes append-only retro notes with a generated index, by documentation alone.
3. Assert it references the capture bar and the promotion path rather than duplicating them.

**Expected Outcome**:

- The convention carrier is complete and non-duplicative.

**Notes / Clarifications**:

- **Seed reconciliation (SC-M2-S9-02)**: the seed reads "…and the retro ceremony references both rather than duplicating them." This change ships **no ceremony** (NG-5, DEC-4; the ceremony runner is M2-S3 and the registry M2-S10). Per the milestone pack's reconciliation rule and the spec's AC-F3-1, the assertion is applied to the **retro-note conventions** in place of the ceremony; the seed's original wording is retained here for traceability. The same reconciliation applies when M2-S3 lands: its ceremony must adopt these conventions and reference, not duplicate.

#### TC-MEMWIRE-004 - No retro ceremony command/executable shipped

**Scenario Type**: Negative
**Impact Level**: Important
**Priority**: Medium
**Related IDs**: F-4, AC-F4-1, NG-5, DEC-4
**Test Type(s)**: Manual (review-time changed-file check)
**Automation Level**: Manual
**Target Layer / Location**: Review checklist (changed-file list of the PR)
**Tags**: @manual, @review

**Preconditions**:

- Feature branch cut from `main-tools`.

**Steps**:

1. At review time, list the change's files.
2. Assert the change adds no executable artifact for retro ceremonies: no files under `scripts/`, `tools/`, or `packages/**`, and no command/agent definition changes beyond the two prompt files in scope.

**Expected Outcome**:

- Retro wiring is carried only by documentation (templates, kernel, instructions).

#### TC-MEMDOCT-001 - Manual doctor checklist covers the six audit areas and its manual-until-lint status

**Scenario Type**: Happy Path
**Impact Level**: Important
**Priority**: High
**Related IDs**: F-5, AC-F5-1, NFR-2
**Test Type(s)**: Unit (content invariant)
**Automation Level**: Automated
**Target Layer / Location**: `tests/structure/memory-bootstrap-templates.test.ts` reading the manual doctor checklist template
**Tags**: @bun, @templates

**Preconditions**:

- The doctor checklist template exists in the installed set.

**Steps**:

1. Read the doctor checklist template.
2. Assert all six audit areas are covered: index coverage; budget caps (~150 lines per agent entry point, ≤200 for the index); dangling references; contradictions; derivable-content heuristics; secret-pattern scan.
3. Assert it states explicitly that it is manual until memory lint lands in the gates (GH-301), and prescribes a cadence (per-retro or periodic audit) while performing nothing.

**Expected Outcome**:

- The checklist is complete, honest about its manual status, and action-prescribing only.

#### TC-MEMDOCT-002 - No executable memory-doctor/lint component exists

**Scenario Type**: Negative
**Impact Level**: Critical
**Priority**: High
**Related IDs**: F-5, AC-F5-1, NG-1, NG-3, DEC-3
**Test Type(s)**: Unit (structural negative invariant)
**Automation Level**: Automated
**Target Layer / Location**: `tests/structure/memory-bootstrap-templates.test.ts` scanning `scripts/`, `tools/`, `packages/**`, and root `package.json` scripts
**Tags**: @bun, @structure

**Preconditions**:

- Green baseline (today: the only doctor is the unrelated `delivery-os doctor` CLI command in `packages/cli/src/commands/doctor.ts`, which has no memory scope).

**Steps**:

1. Scan `scripts/` and `tools/` file paths and `packages/**` module names for memory-doctor or memory-lint identifiers (patterns `memory[-_](doctor|lint)`, `memoryDoctor`, `memoryLint`).
2. Assert zero matches, and that `package.json` registers no memory-lint script.
3. Assert the existing `doctor` command surface is unchanged in memory scope (no memory checks added to it).

**Expected Outcome**:

- The doctor exists only as documentation; no gate, script, or package code implements it.

**Notes / Clarifications**:

- Deliberate-scope note: this negative guard is expected to be **replaced/updated by GH-301** when memory lint lands legitimately; the suite carries a comment naming GH-301 as the owner of that revision so the update is conscious, not accidental.

#### TC-MEMALIGN-001 - Concept adoption checklist corrected to the scaffolded tree shape

**Scenario Type**: Regression
**Impact Level**: Important
**Priority**: High
**Related IDs**: F-6, AC-F6-1, DM-1 (DEC-2)
**Test Type(s)**: Unit (content invariant)
**Automation Level**: Automated
**Target Layer / Location**: `tests/structure/memory-bootstrap-templates.test.ts` reading `doc/planning/concepts/memory-practices.md` (§"Bootstrapping a project")
**Tags**: @bun, @docs

**Preconditions**:

- The concept doc is aligned per F-6/DEC-2 (currently its checklist names "lessons, tacit, preferences, agents, retro" — the drift DEC-2 corrects).

**Steps**:

1. Read the adoption checklist section of `doc/planning/concepts/memory-practices.md`.
2. Assert it provisions exactly the current-truth set (index, per-agent entry points, lessons, tacit) — matching TC-MEMSCAF-001's canonical list.
3. Assert the deferred areas (`preferences`, retro archive) no longer appear as provisioning targets.

**Expected Outcome**:

- Concept checklist and scaffold agree on tree shape; zero contradictions (AC-F6-1).

#### TC-MEMALIGN-002 - Concept kernel template section consistent with F-2 content classes

**Scenario Type**: Regression
**Impact Level**: Medium
**Priority**: Medium
**Related IDs**: F-6, AC-F6-1, NFR-1
**Test Type(s)**: Unit (content invariant)
**Automation Level**: Automated
**Target Layer / Location**: `tests/structure/memory-bootstrap-templates.test.ts` reading the concept's "AGENTS.md kernel rules" template section
**Tags**: @bun, @docs

**Preconditions**:

- The concept's kernel template section is aligned with F-2.

**Steps**:

1. Read the concept's kernel template section.
2. Assert it stays consistent with TC-MEMKERN-001's content classes (locations, read policy, capture bar, curation/promotion, evidence, supersession) and contains no record-schema fields.
3. Assert its budget guidance matches NFR-2 (entry points ~150; kernel ~200-line guidance).

**Expected Outcome**:

- No contradiction between the concept's kernel template and the shipped kernel-section template on tree shape, caps, or capture bar.

#### TC-MEMALIGN-003 - PDR-0004 file, index row, and spec references are consistent

**Scenario Type**: Happy Path
**Impact Level**: Important
**Priority**: High
**Related IDs**: F-6, AC-F6-1, DEC-6, PDR-0004
**Test Type(s)**: Unit (record consistency invariant)
**Automation Level**: Automated
**Target Layer / Location**: `tests/structure/memory-bootstrap-templates.test.ts` reading `doc/decisions/PDR-0004-memory-practices-concept-repo-internal.md`, `doc/decisions/00-index.md`, and `chg-GH-302-spec.md` — follows the `tests/checks/decision-record.test.ts` pattern
**Tags**: @bun, @decisions

**Preconditions**:

- The delivery phase whose declared scope covers `doc/decisions/**` has landed the PDR file (pm-notes DEFER contract: the index row is already committed; the file is untracked at test-plan time).

**Steps**:

1. Assert the PDR file exists and carries its id and status in front matter.
2. Assert the committed index row links the exact filename (`[PDR-0004](PDR-0004-memory-practices-concept-repo-internal.md)`).
3. Assert `chg-GH-302-spec.md` references PDR-0004 in OQ-2 and DEC-6, and that the PDR records the repo-internal disposition (install surface unchanged; installed conventions self-contained).

**Expected Outcome**:

- File, index, and spec references agree; the DEC-6 self-containment rule is traceable to its record.

**Notes / Clarifications**:

- This test intentionally fails until the file lands — it enforces the pm-notes contract that the F-6 concept-alignment phase must declare `doc/decisions/**` in its scope. Constraint C-5: the concept doc sits in the license-header placement scope (`doc/planning/concepts/`), verified by the existing header tooling (`scripts/add-header-location.sh`, `bash scripts/.tests/test-add-header-location.sh`).

#### TC-MEMCONT-001 - Allowlist text identical across the three carriers; confirmation rule unchanged

**Scenario Type**: Happy Path
**Impact Level**: Critical
**Priority**: High
**Related IDs**: F-7, AC-F7-1, NFR-4
**Test Type(s)**: Content check (cross-carrier consistency guard)
**Automation Level**: Automated
**Target Layer / Location**: `scripts/.tests/test-inception-doc-consistency.sh` — new Check 7 (memory wiring consistency), reading `doc/spec/features/feature-bootstrapper.md` (§Write allowlist), `.opencode/agent/bootstrapper.md` (`<write_allowlist>` block), and `doc/guides/project-inception.md` (Phase 5 authority detail)
**Tags**: @bash-guard, @docs, @prompts

**Preconditions**:

- All three carriers state the extended allowlist (spec GAP-5 fix delivered in the same change).

**Steps**:

1. Extract the backticked path entries from each carrier's allowlist section (normalize across bullet-list and table formats).
2. Assert the three entry sets are identical.
3. Assert the out-of-allowlist confirmation sentence ("This path is outside the standard ADOS write allowlist. Proceed? [y/N]") appears unchanged in all three carriers.

**Expected Outcome**:

- One allowlist, three identical statements; the explicit-confirmation rule untouched (RSK-3 mitigation).

**Notes / Clarifications**:

- The inception guide must enumerate the same entry set (not just prose) for this guard to be enforceable — that enumeration is an intended deliverable of the change.

#### TC-MEMCONT-002 - Golden allowlist entry-set: exactly the canonical set plus `.ai/memory/**`

**Scenario Type**: Negative
**Impact Level**: Critical
**Priority**: High
**Related IDs**: F-7, AC-F7-1, RSK-3
**Test Type(s)**: Content check (tree invariant / golden set)
**Automation Level**: Automated
**Target Layer / Location**: `scripts/.tests/test-inception-doc-consistency.sh` — Check 7 (same extraction as TC-MEMCONT-001)
**Tags**: @bash-guard, @docs

**Preconditions**:

- The canonical post-change allowlist entry set is pinned in the guard (the 21 current entries plus `.ai/memory/**`).

**Steps**:

1. Compare the extracted entry set against the pinned golden set.
2. Fail on any entry added beyond `.ai/memory/**` or any entry removed.

**Expected Outcome**:

- The extension is exactly the memory tree root and nothing broader.

**Notes / Clarifications**:

- Golden sets are updated deliberately in review per `.ai/rules/testing-strategy.md` (invariant-test authoring): any future allowlist change must consciously update the pinned set. The golden set lives only in this guard to avoid double maintenance.

#### TC-MEMCONT-003 - Phase 6 readiness enumerates memory artifacts and fails on incompleteness

**Scenario Type**: Happy Path
**Impact Level**: High
**Priority**: High
**Related IDs**: F-1, F-7, AC-F7-2
**Test Type(s)**: Content check + manual confirmation
**Automation Level**: Semi-automated
**Target Layer / Location**: `scripts/.tests/test-inception-doc-consistency.sh` — Check 7, reading the Phase 6 readiness sections of `.opencode/agent/bootstrapper.md` and `doc/guides/project-inception.md`
**Tags**: @bash-guard, @docs, @prompts, @manual

**Preconditions**:

- Phase 5 memory wiring is specified in both carriers.

**Steps**:

1. Assert both carriers' Phase 6 readiness verification enumerates the memory artifacts (index, per-agent entry points, lessons, tacit — the F-1 set).
2. Assert the stated failure mode matches AC-F7-2: incomplete memory artifacts → readiness fails and reopens the gap rather than signing off.
3. Manual confirmation: the readiness failure path is exercised in the live dry-run (TC-MEMRESUME-002, step 4).

**Expected Outcome**:

- An incomplete scaffold cannot pass Phase 6 on paper or in the dry-run.

#### TC-MEMRESUME-001 - Resume semantics for the memory scaffold stated in prompt and guide

**Scenario Type**: Edge Case
**Impact Level**: High
**Priority**: High
**Related IDs**: F-1, AC-F1-2, NFR-5
**Test Type(s)**: Content check + manual companion
**Automation Level**: Semi-automated
**Target Layer / Location**: `tests/structure/memory-bootstrap-templates.test.ts` (prompt/guide resume text) + TC-MEMRESUME-002 (live behavior)
**Tags**: @bun, @docs, @manual

**Preconditions**:

- The bootstrapper prompt's resume semantics cover the new memory artifacts.

**Steps**:

1. Assert the bootstrapper prompt's resume/Phase 5 instructions define completion-without-duplication semantics for memory artifacts (create-if-absent; never overwrite human-approved files).
2. Assert the inception guide's Phase 5/resume authority detail states the same semantics.

**Expected Outcome**:

- Resume-after-interruption behavior is specified in both carriers and exercised live in TC-MEMRESUME-002 (step 5).

#### TC-MEMRESUME-002 - Live bootstrap dry-run: tree, kernel, readiness gate, resume, budgets

**Scenario Type**: Happy Path
**Impact Level**: Critical
**Priority**: High
**Related IDs**: F-1, AC-F1-1, AC-F1-2, AC-F7-2, AC-NFR2-1, NFR-3, NFR-5 (seed SC-M2-S9-01 end-to-end)
**Test Type(s)**: Manual (E2E workflow)
**Automation Level**: Manual
**Target Layer / Location**: A scratch target project outside this repository; executed per `doc/guides/project-inception.md` Phase 5 → Phase 6
**Tags**: @manual, @e2e

**Preconditions**:

- Delivered templates and prompts are present (change landed locally).
- A scratch directory simulating an adopter project.

**Steps**:

1. Run inception through Phase 5 in the scratch project; approve the human gate (verify: gate count and interview questions unchanged — NFR-3 observation).
2. List the project's committed tree: assert the memory scaffold exists with exactly the current-truth set, seeded empty (seed SC-M2-S9-01, end-to-end form).
3. Read the generated AGENTS.md: kernel section present with the ten content classes; no record-schema fields.
4. Negative probe: delete one memory artifact, run Phase 6 readiness — assert readiness fails and reopens (AC-F7-2); restore the artifact.
5. Resume probe: interrupt a Phase 5 run mid-scaffold, resume — assert completion without duplicated entry points and without overwriting the approved AGENTS.md (AC-F1-2, NFR-5).
6. Budget measurement: line-count the generated entry points and index (feeds TC-MEMBUDGET-002).
7. Record results in the Test Execution Log (Section 10) and the pm-notes evidence.

**Expected Outcome**:

- The learning loop is present and gates behave as specified in a real project; automation gaps are closed by this checklist.

#### TC-MEMBUDGET-001 - Scaffold seed templates are within budget caps

**Scenario Type**: Edge Case
**Impact Level**: Medium
**Priority**: Medium
**Related IDs**: NFR-2, AC-NFR2-1
**Test Type(s)**: Unit (metric assertion)
**Automation Level**: Automated
**Target Layer / Location**: `tests/structure/memory-bootstrap-templates.test.ts` (line counts of the scaffold templates)
**Tags**: @bun, @templates

**Preconditions**:

- TC-MEMSCAF-001 identifies the entry-point and index templates.

**Steps**:

1. Count lines of each per-agent entry-point template: assert ≤ 150.
2. Count lines of the memory index template: assert ≤ 200.

**Expected Outcome**:

- All seed templates within caps, so generated artifacts start within caps.

**Notes / Clarifications**:

- The spec's "~150 lines" is executed as ≤ 150 (the tilde is prose tolerance; the executable cap is the number). Generated-artifact measurement is TC-MEMBUDGET-002.

#### TC-MEMBUDGET-002 - Generated scaffold budgets measured via doctor checklist

**Scenario Type**: Edge Case
**Impact Level**: Medium
**Priority**: Medium
**Related IDs**: NFR-2, AC-NFR2-1, F-5
**Test Type(s)**: Manual (generated-artifact measurement)
**Automation Level**: Manual
**Target Layer / Location**: TC-MEMRESUME-002 step 6, using the manual doctor checklist's budget section as the measuring stick
**Tags**: @manual

**Preconditions**:

- TC-MEMRESUME-002 produced a generated scaffold.

**Steps**:

1. Apply the doctor checklist's budget-cap audit to the generated files.
2. Record measurements in the execution log.

**Expected Outcome**:

- Generated entry points ≤ ~150 lines; index ≤ 200 lines; the checklist's own instructions proved sufficient to perform the audit.

#### TC-MEMFLOW-001 - Phase 5 gate count and interview questions unchanged

**Scenario Type**: Regression
**Impact Level**: Medium
**Priority**: Medium
**Related IDs**: NFR-3
**Test Type(s)**: Content check + manual confirmation
**Automation Level**: Semi-automated
**Target Layer / Location**: `scripts/.tests/test-inception-doc-consistency.sh` (guide structure — existing Check 6 already asserts 8 phases) + `tests/structure/memory-bootstrap-templates.test.ts` (prompt interview surface)
**Tags**: @bash-guard, @bun, @manual

**Preconditions**:

- Phase 5 memory block added to the prompt and guide.

**Steps**:

1. Existing guard: guide still has exactly 8 phase sections (Check 6 unchanged and green).
2. Assert the bootstrapper prompt adds zero new interview questions for memory artifacts and states that the single Phase 5 human approval covers the memory artifacts.
3. Manual confirmation during TC-MEMRESUME-002 step 1.

**Expected Outcome**:

- No new gates, no new interactive steps.

#### TC-MEMCONF-001 - Aggregate gate `TMPDIR=$PWD/tmp/tmpdir pnpm check` green

**Scenario Type**: Regression
**Impact Level**: Critical
**Priority**: High
**Related IDs**: AC-NFR4-1, NFR-6, C-4
**Test Type(s)**: Command execution (aggregate gate)
**Automation Level**: Automated
**Target Layer / Location**: Repository root: `pnpm check` (lint, format, typecheck, bun test incl. `tests/checks/doc-conformance.test.ts` + `tests/checks/prompt-conformance.test.ts`, boundaries, `check:prompt`, `check:help`, exports-parity)
**Tags**: @gates

**Preconditions**:

- All prompt and doc edits are in the working tree.

**Steps**:

1. Run `TMPDIR=$PWD/tmp/tmpdir pnpm check`.
2. While iterating, use narrow commands first per testing strategy: `bun run scripts/checks/prompt-conformance.ts`, `bun run scripts/checks/help-guide-coverage.ts`, `bun test tests/checks/doc-conformance.test.ts`, `bun test tests/structure/memory-bootstrap-templates.test.ts`.

**Expected Outcome**:

- Aggregate green: prompt conformance (current-truth phrase table; no evolution-history phrasing in the edited bootstrapper/bootstrap prompts), help/reference checks, and all suites pass.

#### TC-MEMCONF-002 - Doc-distribution drift guard passes with zero drift

**Scenario Type**: Regression
**Impact Level**: Critical
**Priority**: High
**Related IDs**: AC-NFR4-1, NFR-4, C-3
**Test Type(s)**: Command execution (distribution drift guard)
**Automation Level**: Automated
**Target Layer / Location**: `bash scripts/.tests/test-doc-distribution.sh` (marker-derived expected set vs real sandbox `install.sh --local` run); companion mode test `bash scripts/.tests/test-doc-distribution-modes.sh`
**Tags**: @bash-guard, @gates

**Preconditions**:

- Every new/changed distributable doc carries `ados_distribution` inside its existing frontmatter block (never a new `---` block for `.md`).

**Steps**:

1. Run the guard.
2. On failure, fix the marker or install-set classification at authoring time (failure modes: missing-marker, invalid-enum-value, redistributable-not-installed, internal-installed, derived-set drift).

**Expected Outcome**:

- Zero drift; all new memory templates classified and installed correctly.

#### TC-MEMCONF-003 - Generated plugin output regenerated with the source prompt change

**Scenario Type**: Regression
**Impact Level**: Medium
**Priority**: Medium
**Related IDs**: AC-NFR4-1, C-4, RSK-6
**Test Type(s)**: Command execution + CI staleness check
**Automation Level**: Automated
**Target Layer / Location**: `bash scripts/build-claude-plugin.sh` then `bash scripts/.tests/test-build-claude-plugin.sh`; committed together with the `.opencode/**` source change (CI fails on stale output)
**Tags**: @bash-guard, @gates

**Preconditions**:

- `.opencode/agent/bootstrapper.md` and/or `.opencode/command/bootstrap.md` changed.

**Steps**:

1. Run the build script.
2. Run its test suite; commit source + regenerated `.ados-claude/**` together (never hand-edit generated files).

**Expected Outcome**:

- Generated plugin output current; consumers see the added memory responsibility with no drift.

## 6. Environments and Test Data

- **Local dev (primary):** this repository on branch `feat/GH-302/memory-conventions-bootstrap-templates` (cut from `main-tools` @ 92b64753). All bun:bash gates run locally; aggregate gate convention: `TMPDIR=$PWD/tmp/tmpdir pnpm check` (create `tmp/tmpdir` if absent; it is workspace-local scratch, never committed).
- **Sandbox install (distribution guard):** `test-doc-distribution.sh` creates its own sandbox and runs `install.sh --local`; no environment preparation needed beyond bash ≥ 4.
- **Scratch target project (manual layer):** an empty directory outside this repository simulating an adopter, used only by TC-MEMRESUME-002/TC-MEMBUDGET-002; disposable, no cleanup obligations beyond deletion.
- **Test data:** none synthesized — all automated assertions are read-only against committed tree content (templates, prompts, guide, feature spec, decision records, concept doc). Isolation strategy: no suite writes to the tree; the negative structural scan (TC-MEMDOCT-002) is read-only; permanent suites assert tree invariants, never branch diffs (testing-strategy rule).
- **CI:** the existing workflow runs the bun tiers and the distribution guard on PRs; the commit-range gate (`scripts/lint-commit-range.sh`) applies at phase 9 per repo conventions.

## 7. Automation Plan and Implementation Mapping

| TC ID(s) | Test file / command | Framework | Execution command | Status |
|----------|--------------------|-----------|-------------------|--------|
| TC-MEMSCAF-001/002/003, TC-MEMKERN-001/002, TC-MEMWIRE-001/002/003, TC-MEMDOCT-001/002, TC-MEMALIGN-001/002/003, TC-MEMBUDGET-001, TC-MEMRESUME-001, TC-MEMFLOW-001 (part) | `tests/structure/memory-bootstrap-templates.test.ts` — **new file** (bun:test; read-only tree assertions; no fixtures needed) | bun:test | `bun test tests/structure/memory-bootstrap-templates.test.ts` | To Implement |
| TC-MEMCONT-001/002/003, TC-MEMFLOW-001 (guide part) | `scripts/.tests/test-inception-doc-consistency.sh` — **extend** with Check 7 (memory wiring: allowlist identity, golden entry-set, Phase 6 readiness enumeration) and add the new memory templates to Check 4's index list | bash (`test-*.sh` convention) | `bash scripts/.tests/test-inception-doc-consistency.sh` | Existing – Update |
| TC-MEMCONF-001 | `pnpm check` aggregate (incl. `check:prompt`, `check:help`, doc-conformance suite) | pnpm/bun | `TMPDIR=$PWD/tmp/tmpdir pnpm check` | Existing – No Change |
| TC-MEMCONF-002 | `scripts/.tests/test-doc-distribution.sh` (+ `test-doc-distribution-modes.sh` companion) | bash | `bash scripts/.tests/test-doc-distribution.sh` | Existing – No Change |
| TC-MEMCONF-003 | `scripts/build-claude-plugin.sh` + `scripts/.tests/test-build-claude-plugin.sh` | bash | `bash scripts/build-claude-plugin.sh && bash scripts/.tests/test-build-claude-plugin.sh` | Existing – No Change |
| TC-MEMALIGN-003 (header rule C-5) | `scripts/add-header-location.sh` scope + `scripts/.tests/test-add-header-location.sh` | bash | `bash scripts/.tests/test-add-header-location.sh` | Existing – No Change |
| TC-MEMKERN-003, TC-MEMSCAF-004, TC-MEMWIRE-004 | Review checklist (changed-file review, fidelity side-by-side) | manual | review of the PR vs `main-tools` | Manual Only |
| TC-MEMRESUME-002, TC-MEMBUDGET-002, TC-MEMFLOW-001 (manual part), TC-MEMCONT-003 (manual part) | Live bootstrap dry-run checklist (Section 5.2, TC-MEMRESUME-002) | manual | scratch-project inception walkthrough | Manual Only |

New automated coverage totals: **1 new bun:test file** (~16 test cases across the listed TCs) + **1 extended bash guard** (1 new check block + 1 index-list extension). No other suite changes; `pnpm check` and the distribution guard pick up the new content automatically.

## 8. Risks, Assumptions, and Open Questions

### 8.1 Risks

- **Negative-grep fragility (TC-MEMKERN-002):** record-schema field names can appear innocently in prose. Mitigation: anchor the assertion on schema-shaped constructs (field lists/tables declared as record requirements), choose exact anchors at implementation, and keep the positive class assertions (TC-MEMKERN-001) as the primary guard.
- **Guard expiry (TC-MEMDOCT-002):** the "no memory lint anywhere" invariant becomes wrong when GH-301 lands tooling legitimately. Mitigation: the suite comment names GH-301 as the owner of the deliberate update.
- **Golden-set maintenance (TC-MEMCONT-002):** pinning the full allowlist set makes unrelated allowlist changes fail the guard. Mitigation: deliberate-update rule per testing strategy (review consciously regenerates the golden set); the guard error message names the pinned-set location.
- **Carrier-format drift (TC-MEMCONT-001):** the three allowlist statements use different Markdown shapes (bullet list vs table vs prose+list). Mitigation: extraction normalizes backticked path tokens; the guide is required to enumerate the set.
- **Anchor renames:** TC anchors reference template filenames that the plan (phase 4) will finalize; a rename requires a deliberate suite update (recorded in Section 9), not a silent one.
- **Manual-layer cost:** TC-MEMRESUME-002 is the only full E2E; skipping it leaves AC-F1-2/AC-F7-2 runtime claims unverified. Mitigation: it is a listed DoD evidence item for the delivery phase.

### 8.2 Assumptions

- The AGENTS.md "Agent memory" section remains the current-truth source through delivery (spec Assumptions).
- The plan (phase 4) declares the F-6 concept-alignment phase scope to include `doc/decisions/**` so PDR-0004's file lands with its committed index row (pm-notes DEFER contract); TC-MEMALIGN-003 enforces this.
- New memory templates are classified `redistributable` (they ship in the install set); if any template is instead `internal`, the distribution guard — not this plan — is the arbiter, and the TC-MEMCONF-002 verdict records it.
- The doctor checklist ships as a template under `doc/templates/**` (installed set) per spec F-5 "ships with the installed set"; exact filenames are fixed by the plan.
- `pnpm check` remains the aggregate gate and its composition is unchanged by this change (no package/CLI code changes allowed by NG-3).

### 8.3 Open Questions

| ID | Question | Blocking | Owner |
|----|----------|----------|-------|
| OQ-TP-1 | **Spec factual correction needed (reported to PM):** the spec states this repository's own `.ai/memory` tree "does not exist yet" (Context 2.1, NG-4 parenthetical, Assumptions), but repo truth is that `.ai/memory/**` exists, is tracked, and is present in the branch base 92b64753 (created by GH-204 on 2026-11-07; populated with per-agent entry points and lessons). No AC depends on the false premise; all ACs remain testable, and NG-4's constraint ("do not modify this repo's tree") stays valid and is enforced by TC-MEMSCAF-004. Disposition options: (a) reopen specification phase for a Context/NG-4 wording fix, or (b) record the correction in pm-notes and let the DoR gate accept with the note. | No (test plan proceeds; all ACs testable) | PM / owner |
| OQ-TP-2 | Exact template filenames and the per-agent entry-point carrier pattern (one generic template parameterized by role vs one file per role) are fixed by the plan; the bun suite's anchors are pinned at implementation and any later rename is a deliberate suite update. | No (resolved during delivery phase 1) | plan-writer / coder |
| OQ-TP-3 | Confirm the manual doctor checklist's carrier is a `doc/templates/**` template (not a guide page), per F-5 "installed set". If the plan places it in `doc/guides/**`, TC-MEMDOCT-001/TC-MEMBUDGET-002 anchors move accordingly and the distribution classification is re-evaluated. | No (resolved during delivery phase 1) | plan-writer |

## 9. Plan Revision Log

| Version | Date | Author | Changes |
|---------|------|--------|---------|
| 1.0 | 2026-11-14 | test-plan-writer (GLM-5.3-Flash) | Initial test plan from `chg-GH-302-spec.md` v1.0: 27 TCs covering all 11 ACs; inherited and reconciled seeds SC-M2-S9-01/02; proposed `tests/structure/memory-bootstrap-templates.test.ts` (new) and Check 7 extension of `scripts/.tests/test-inception-doc-consistency.sh`; reported the `.ai/memory` repo-truth discrepancy (OQ-TP-1) without modifying the spec |

## 10. Test Execution Log

| TC ID | Run Date | Result | Notes |
|-------|----------|--------|-------|
| — | — | — | Populated during delivery (phases 6–9) and at the manual dry-run (TC-MEMRESUME-002); aggregate-gate verdicts are also recorded as pm-notes `notes:` entries per repo conventions |
