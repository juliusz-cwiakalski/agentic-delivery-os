---
ados_distribution: project-generated
id: chg-GH-90-test-plan
status: Proposed
created: 2026-06-29
last_updated: 2026-06-29
owners: ["Juliusz Ćwiąkalski"]
service: inception-templates
labels: ["inception", "templates", "architecture", "module-governance"]
version_impact: minor
summary: "Template + guide change: turn the architecture overview from inventory into module governance (residence, layering, contracts, ownership, heuristics) and align the repo-analysis module map — verified by structural/content inspection + the doc-distribution gate."
links:
  change_spec: ./chg-GH-90-spec.md
  implementation_plan: ./chg-GH-90-plan.md   # pending — not yet authored at test-plan creation
  testing_strategy: .ai/rules/testing-strategy.md
---

# Test Plan - [inception:6] Architecture overview: module governance (residence, layering, contracts)

## 1. Scope and Objectives

This is an **additive template + guide documentation change** — no application code, no unit/integration/e2e tests apply. The core behavior to protect is the **AI-actionability** of the new module-governance sections: every section must be concrete enough for `@coder`/`@spec-writer` to place code and stub/mock boundaries deterministically, and the change must stay **purely additive** (no pre-existing section header or module-map column removed/renamed). The regression risk this plan guards against is governance prose that reads well but is not actionable, plus drift between the architecture-overview and repo-analysis governance fields, plus accidental loss of the `ados_distribution: redistributable` marker / license header that the CI gate enforces.

The verification approach is dictated by the repo testing strategy (`.ai/rules/testing-strategy.md`): `doc/**` and `doc/templates/**` changes are validated by **static/diff + content checks (manual)** plus the relevant **automated shell test** when a touched module has one. Here exactly one automated check applies — the doc-distribution drift guard (`scripts/.tests/test-doc-distribution.sh`).

### 1.1 In Scope

- `doc/templates/architecture-overview-template.md` — the five governance subsections (residence / layering / contracts / ownership / heuristics), their consolidated placement (DEC-5/OQ-2), and their AI-actionable examples.
- `doc/templates/repo-analysis-template.md` — module-map governance-column alignment (F-6/DM-6) and preservation of existing `Module | Responsibility` columns.
- `doc/guides/project-inception.md` Phase 3 — minimal governance reference (F-7).
- The doc-distribution gate passing on both modified templates (AC-NFR3-1).
- Backward-compatibility (additive-only) of the two templates (AC-NFR4-1).

### 1.2 Out of Scope & Known Gaps

- **No unit/integration/e2e tests** — there is no application code in this change; inventing fake code tests is explicitly out of scope.
- **Consistency touch-points** (`doc/templates/README.md` ~line 62 and `doc/documentation-handbook.md` §17) are **plan-sweep items, not spec ACs**. They are covered by a single low-priority **advisory, non-gating** TC (TC-ADV-001) only.
- **No automated structural validator** for "does section X contain a concrete example". The actionability bar is verified by manual inspection (TC-GOV-001..005, TC-AIACT-001) and red-team R1; no probe exists (and none is in scope per NG-2).
- **Formal contract-versioning / enforcement tooling** is out of scope (NG-1, NG-2) — not tested.

## 2. References

- Change spec: `./chg-GH-90-spec.md` (authoritative AC source: AC-F1-1 … AC-F7-1, AC-NFR1-1, AC-NFR3-1, AC-NFR4-1).
- Implementation plan: `./chg-GH-90-plan.md` (pending).
- Testing strategy: `.ai/rules/testing-strategy.md` (docs/templates → static/diff + content checks + manual verification).
- Templates under change: `doc/templates/architecture-overview-template.md`, `doc/templates/repo-analysis-template.md`.
- Guide under change: `doc/guides/project-inception.md` (Phase 3, "Tech stack & architecture").
- Gate script: `scripts/.tests/test-doc-distribution.sh` (the one automated check).
- Spec Appendix A (intended governance section content) and Appendix C (repo-analysis column spec) — concrete content targets for the inspection TCs.

## 3. Coverage Overview

**Traceability rule:** every AC-# maps to ≥1 TC-#; every TC-# maps to ≥1 AC-# (the sole exception is TC-ADV-001, an advisory item explicitly authorized by PM as non-gating — see §8.3).

### 3.1 Functional Coverage (F-#, AC-#)

| AC ID | Description (short) | TC ID(s) | Status |
|-------|---------------------|----------|--------|
| AC-F1-1 | Module-residence rules table + rule + concrete example | TC-GOV-001, TC-GOV-006, TC-AIACT-001 | Covered |
| AC-F2-1 | Dependency-direction/layering matrix + downward-no-cycles invariant + example | TC-GOV-002, TC-GOV-006, TC-AIACT-001 | Covered |
| AC-F3-1 | Lightweight internal interface contracts (boundary+signature+return/error) + example | TC-GOV-003, TC-GOV-006, TC-AIACT-001 | Covered |
| AC-F4-1 | OPTIONAL feature→component ownership map, marked optional | TC-GOV-004, TC-GOV-006, TC-AIACT-001 | Covered |
| AC-F5-1 | Module-boundary heuristics with split/merge triggers | TC-GOV-005, TC-GOV-006, TC-AIACT-001 | Covered |
| AC-F6-1 | repo-analysis module-map aligns governance dims, preserves Module\|Responsibility | TC-ALGN-001, TC-COMPAT-001 | Covered |
| AC-F7-1 | Phase 3 references governance sections (no rewrite) | TC-INC-001 | Covered |
| AC-NFR1-1 | 5/5 governance sections each carry ≥1 concrete AI-actionable example | TC-AIACT-001 (+ TC-GOV-001..005) | Covered |
| AC-NFR3-1 | `bash scripts/.tests/test-doc-distribution.sh` exits 0; both templates keep marker + license header | TC-DIST-001 | Covered |
| AC-NFR4-1 | Additive-only diff; no pre-existing header/column removed or renamed | TC-COMPAT-001 (+ TC-ALGN-001 for Module\|Responsibility) | Covered |

**All 10 ACs are fully traced. No AC is left as TODO.**

### 3.2 Interface Coverage (API-#, EVT-#, DM-#)

No REST/HTTP (N/A) and no events (N/A) — documentation change. The "interfaces" are the structured tables/columns (DM-1..DM-7):

| DM ID | Element | TC ID(s) | Status |
|-------|---------|----------|--------|
| DM-1 | Residence-rule row (Capability type → Owning module/path) | TC-GOV-001 | Covered |
| DM-2 | Layering tier + allowed/forbidden matrix cell | TC-GOV-002 | Covered |
| DM-3 | Interface-contract row (boundary+operation+signature+return+error) | TC-GOV-003 | Covered |
| DM-4 | Ownership-map row (Feature → component(s), OPTIONAL) | TC-GOV-004 | Covered |
| DM-5 | Boundary-heuristic rule (split/merge/cohesion/coupling) | TC-GOV-005 | Covered |
| DM-6 | repo-analysis module-map governance columns (Residence hint, Layering tier, Interface-contract pointer) | TC-ALGN-001 | Covered |
| DM-7 | Existing Components table referenced, unchanged (additive) | TC-COMPAT-001 | Covered |

### 3.3 Non-Functional Coverage (NFR-#)

| NFR ID | Requirement | TC ID(s) | Status |
|--------|-------------|----------|--------|
| NFR-1 | AI-actionability — each section ≥1 concrete example (5/5) | TC-AIACT-001 (+ TC-GOV-001..005) | Covered |
| NFR-2 | Weight control — lean sections; ownership-map flagged OPTIONAL | TC-GOV-004, TC-GOV-006 | Covered (no dedicated AC; folded into placement/optional TCs) |
| NFR-3 | Doc-distribution gate — marker + license header retained | TC-DIST-001 | Covered |
| NFR-4 | Backward compatibility — purely additive | TC-COMPAT-001, TC-ALGN-001 | Covered |

## 4. Test Types and Layers

Per `.ai/rules/testing-strategy.md`, `doc/**` and `doc/templates/**` changes are validated by **static/diff + content checks (manual)**, with automated shell tests only where a touched module owns one. No unit/integration/e2e frameworks apply (no application code).

- **Manual content checks (primary):** open each changed template/guide, verify each governance section is present, correctly placed, and carries a concrete AI-actionable example. Given/When/Then inspection steps per TC.
- **Markdown rendering review:** headings/lists/tables/code-fences render correctly (folded into each inspection TC's expected outcome).
- **Automated shell test (one):** `bash scripts/.tests/test-doc-distribution.sh` (TC-DIST-001) — the doc-distribution drift guard, the only automated gate and the only CI-blocking check.
- **Static/diff check:** `git diff --check` (whitespace/conflict-marker guard) and the additive-only diff review (TC-COMPAT-001).

**Verification methods used in this plan:** Manual-inspection, Automated-script, Backward-compat-diff. Each TC declares its method.

## 5. Test Scenarios

### 5.1 Scenario Index

| TC ID | Title | Verification Method | Impact | Priority | AC Coverage |
|-------|-------|---------------------|--------|----------|-------------|
| TC-GOV-001 | Module-residence rules section with AI-actionable example | Manual-inspection | Important | High | AC-F1-1, AC-NFR1-1 |
| TC-GOV-002 | Dependency-direction/layering matrix with downward-only invariant | Manual-inspection | Important | High | AC-F2-1, AC-NFR1-1 |
| TC-GOV-003 | Lightweight internal interface contracts table | Manual-inspection | Important | High | AC-F3-1, AC-NFR1-1 |
| TC-GOV-004 | Feature→component ownership map marked OPTIONAL | Manual-inspection | Important | Medium | AC-F4-1 |
| TC-GOV-005 | Module-boundary heuristics with split/merge triggers | Manual-inspection | Important | High | AC-F5-1, AC-NFR1-1 |
| TC-GOV-006 | Consolidated Module governance block placement (DEC-5/OQ-2) | Manual-inspection | Critical | High | AC-F1-1..AC-F5-1 |
| TC-ALGN-001 | repo-analysis module-map governance columns aligned | Manual-inspection | Important | High | AC-F6-1, AC-NFR4-1 |
| TC-INC-001 | Phase 3 references governance sections (no rewrite) | Manual-inspection | Important | Medium | AC-F7-1 |
| TC-AIACT-001 | All five governance sections carry ≥1 concrete example (5/5) | Manual-inspection | Critical | High | AC-NFR1-1 |
| TC-DIST-001 | Doc-distribution gate exits 0 | Automated-script | Critical | High | AC-NFR3-1 |
| TC-COMPAT-001 | Additive-only backward compatibility (no removed/renamed headers or columns) | Backward-compat-diff | Critical | High | AC-NFR4-1 |
| TC-ADV-001 | (Advisory, non-gating) Consistency touch-points reviewed | Manual-inspection | Minor | Low | RSK-4 (plan-sweep; **not a spec AC**) |

**Totals:** 12 scenarios — 9 Manual-inspection, 1 Automated-script, 1 Backward-compat-diff, 1 Advisory (manual).

### 5.2 Scenario Details

#### TC-GOV-001 - Module-residence rules section with AI-actionable example

**Scenario Type**: Happy Path
**Impact Level**: Important
**Priority**: High
**Related IDs**: F-1, AC-F1-1, DM-1, NFR-1, DEC-6
**Test Type(s)**: Manual
**Automation Level**: Manual
**Verification Method**: Manual-inspection
**Target Layer / Location**: `doc/templates/architecture-overview-template.md` → Module governance § → Residence subsection
**Tags**: @docs, @templates, @architecture

**Preconditions**:

- `architecture-overview-template.md` has been updated with the Module governance block (DEC-5).

**Steps**:

1. Open `doc/templates/architecture-overview-template.md`.
2. Locate the module-residence rules subsection within the consolidated Module governance block.
3. Confirm a table with columns `Capability type` | `Owning module / path pattern` (and optional `Notes`) exists.
4. Confirm a one-line placement rule is present.
5. Confirm ≥1 concrete example row resolves a capability type to a path (e.g. "new API endpoint → `src/api/`").

**Expected Outcome**:

- **Given** the architecture-overview template, **when** a reader looks for module-residence rules, **then** a capability-type → owning-module/path-pattern table + one-line rule + concrete example all exist and are machine-readable.
- The example is concrete enough to drive a placement decision (not vague prose).

**Notes / Clarifications**:

- Concrete content target is spec Appendix A.1.

#### TC-GOV-002 - Dependency-direction/layering matrix with downward-only invariant

**Scenario Type**: Happy Path
**Impact Level**: Important
**Priority**: High
**Related IDs**: F-2, AC-F2-1, DM-2, NFR-1, DEC-4
**Test Type(s)**: Manual
**Automation Level**: Manual
**Verification Method**: Manual-inspection
**Target Layer / Location**: `doc/templates/architecture-overview-template.md` → Module governance § → Layering subsection
**Tags**: @docs, @templates, @architecture

**Preconditions**:

- The layering subsection has been added to the Module governance block.

**Steps**:

1. Open `architecture-overview-template.md`; find the dependency-direction/layering subsection.
2. Confirm named tiers are listed in tier order (default example: presentation → application → domain → infrastructure).
3. Confirm an allowed/forbidden dependency matrix between the tiers exists.
4. Confirm the dependency-direction invariant is stated: dependencies point DOWN the tier list; no upward or sideways cycles.
5. Confirm a concrete example is present (e.g. "API layer may import domain layer; domain layer may NOT import API layer").
6. Confirm tier names are flagged as an adaptable example, not a mandated ADOS architecture.

**Expected Outcome**:

- **Given** the template, **when** checked for a dependency-direction/layering section, **then** an allowed/forbidden matrix between named layers exists with the stated downward-only, no-cycles invariant and a concrete example.
- The section carries an "adapt to your architecture" note (DEC-4).

#### TC-GOV-003 - Lightweight internal interface contracts table

**Scenario Type**: Happy Path
**Impact Level**: Important
**Priority**: High
**Related IDs**: F-3, AC-F3-1, DM-3, NFR-1, DEC-2
**Test Type(s)**: Manual
**Automation Level**: Manual
**Verification Method**: Manual-inspection
**Target Layer / Location**: `doc/templates/architecture-overview-template.md` → Module governance § → Interface contracts subsection
**Tags**: @docs, @templates, @architecture

**Preconditions**:

- The interface-contracts subsection has been added.

**Steps**:

1. Open `architecture-overview-template.md`; find the internal interface contracts subsection.
2. Confirm a table with columns capturing Boundary (A→B) | Operation | Signature | Returns | Errors exists.
3. Confirm ≥1 concrete example row is present (e.g. cart → inventory: `checkAvailability(sku, qty)` → `AvailabilityResult{ available: bool, onHand: int }`; error `ItemNotFound`).
4. Confirm a scope note restricts the contract to signature + return/error shape only (not a versioned registry).

**Expected Outcome**:

- **Given** the template, **when** checked for internal interface contracts, **then** lightweight named-boundary contracts exist (boundary + signature + return/error shape) with the concrete example, sufficient to stub/mock a boundary.

#### TC-GOV-004 - Feature→component ownership map marked OPTIONAL

**Scenario Type**: Corner Case
**Impact Level**: Important
**Priority**: Medium
**Related IDs**: F-4, AC-F4-1, DM-4, DEC-3, NFR-2
**Test Type(s)**: Manual
**Automation Level**: Manual
**Verification Method**: Manual-inspection
**Target Layer / Location**: `doc/templates/architecture-overview-template.md` → Module governance § → Ownership-map subsection
**Tags**: @docs, @templates, @architecture

**Preconditions**:

- The ownership-map subsection has been added.

**Steps**:

1. Open `architecture-overview-template.md`; find the feature→component ownership-map subsection.
2. Confirm a Feature → owning component(s) table exists.
3. Confirm the subsection is **clearly marked OPTIONAL/conditional** (e.g. an explicit "Omit for small repos where the Components table suffices" note — DEC-3).
4. Confirm ≥1 concrete example (e.g. Checkout → cart, inventory, pricing).

**Expected Outcome**:

- **Given** the template, **when** checked for a feature→component ownership map, **then** an OPTIONAL/conditional map exists and is clearly marked optional for small repos (satisfies NFR-2 weight control).

#### TC-GOV-005 - Module-boundary heuristics with split/merge triggers

**Scenario Type**: Happy Path
**Impact Level**: Important
**Priority**: High
**Related IDs**: F-5, AC-F5-1, DM-5, NFR-1, OQ-1
**Test Type(s)**: Manual
**Automation Level**: Manual
**Verification Method**: Manual-inspection
**Target Layer / Location**: `doc/templates/architecture-overview-template.md` → Module governance § → Heuristics subsection
**Tags**: @docs, @templates, @architecture

**Preconditions**:

- The boundary-heuristics subsection has been added.

**Steps**:

1. Open `architecture-overview-template.md`; find the module-boundary heuristics subsection.
2. Confirm ≥1 split trigger exists (e.g. "a module with > N responsibilities / > 1 reason to change → split by responsibility").
3. Confirm the split threshold ships as a `<N>` placeholder with an example value in parentheses (OQ-1 resolution, e.g. "> 3 responsibilities").
4. Confirm ≥1 merge/cohesion/coupling trigger exists (e.g. "two modules that always change together → consider merging"; "high cohesion within a module, low coupling across modules").

**Expected Outcome**:

- **Given** the template, **when** checked for module-boundary heuristics, **then** concrete cohesion/coupling split/merge triggers exist, including the `<N>`-with-example split threshold.

#### TC-GOV-006 - Consolidated Module governance block placement (DEC-5/OQ-2)

**Scenario Type**: Corner Case
**Impact Level**: Critical
**Priority**: High
**Related IDs**: F-1, F-2, F-3, F-4, F-5, AC-F1-1, AC-F2-1, AC-F3-1, AC-F4-1, AC-F5-1, DEC-5, OQ-2, NFR-2
**Test Type(s)**: Manual
**Automation Level**: Manual
**Verification Method**: Manual-inspection
**Target Layer / Location**: `doc/templates/architecture-overview-template.md` (section ordering)
**Tags**: @docs, @templates, @architecture

**Preconditions**:

- The Module governance block has been inserted into the template.

**Steps**:

1. Open `architecture-overview-template.md`.
2. Confirm a single consolidated governance block exists (one parent heading, e.g. `## Module governance`) rather than five interleaved top-level sections.
3. Confirm that block is positioned **after** the `## Components` table and **before** the `## Data flow` section.
4. Confirm the block contains subsections for: residence, layering, contracts, ownership-map (OPTIONAL), and heuristics.
5. Confirm each subsection is tight (≈ table + 1–2-line rule + concrete example) — not bloated (NFR-2).

**Expected Outcome**:

- **Given** the architecture-overview template, **when** its section ordering is inspected, **then** one consolidated governance block sits after the Components table and before Data flow, containing the five governance subsections.

**Notes / Clarifications**:

- Placement is a PM-locked design decision (DEC-5 / OQ-2); this TC verifies, not debates, it.

#### TC-ALGN-001 - repo-analysis module-map governance columns aligned

**Scenario Type**: Happy Path
**Impact Level**: Important
**Priority**: High
**Related IDs**: F-6, AC-F6-1, DM-6, DM-1, DM-2, DM-3, NFR-4, DEC-5
**Test Type(s)**: Manual
**Automation Level**: Manual
**Verification Method**: Manual-inspection
**Target Layer / Location**: `doc/templates/repo-analysis-template.md` → Module / component map
**Tags**: @docs, @templates, @architecture

**Preconditions**:

- `repo-analysis-template.md` module/component map has been aligned.

**Steps**:

1. Open `repo-analysis-template.md`; locate the `## Module / component map` section.
2. Confirm the original `Module` and `Responsibility` columns are still present and first.
3. Confirm three governance columns are appended: a **Residence hint**, a **Layering tier**, and an **Interface-contract pointer**.
4. Confirm the new column names mirror the architecture-overview governance field names (DM-1/2/3 ↔ DM-6 — prevents drift, RSK-3).
5. Confirm the existing confidence discipline of the template still applies (low-confidence governance inferences flagged for human confirmation).

**Expected Outcome**:

- **Given** the repo-analysis template's module/component map, **when** checked, **then** its columns align with the architecture-overview governance dimensions while preserving the existing `Module | Responsibility` columns.

#### TC-INC-001 - Phase 3 references governance sections (no rewrite)

**Scenario Type**: Happy Path
**Impact Level**: Important
**Priority**: Medium
**Related IDs**: F-7, AC-F7-1
**Test Type(s)**: Manual
**Automation Level**: Manual
**Verification Method**: Manual-inspection
**Target Layer / Location**: `doc/guides/project-inception.md` → Phase 3 (Tech stack & architecture)
**Tags**: @docs, @guide, @inception

**Preconditions**:

- `project-inception.md` Phase 3 has been minimally amended.

**Steps**:

1. Open `project-inception.md`; navigate to `### Phase 3 — Tech stack & architecture`.
2. Confirm the architecture activity (activity 4) and/or the Outputs references the new governance sections (residence / layering / contracts / ownership / heuristics).
3. Confirm the amendment is **minimal/additive** — Phase 3 is not rewritten (NG-4); pre-existing activities, anti-sycophancy technique, human gate, and outputs remain.

**Expected Outcome**:

- **Given** `project-inception.md` Phase 3, **when** checked, **then** it references the governance sections without rewriting the phase.

#### TC-AIACT-001 - All five governance sections carry ≥1 concrete example (5/5)

**Scenario Type**: Regression
**Impact Level**: Critical
**Priority**: High
**Related IDs**: NFR-1, AC-NFR1-1, F-1, F-2, F-3, F-4, F-5, DEC-6, RSK-2
**Test Type(s)**: Manual
**Automation Level**: Manual
**Verification Method**: Manual-inspection
**Target Layer / Location**: `doc/templates/architecture-overview-template.md` → Module governance § (all subsections)
**Tags**: @docs, @templates, @architecture

**Preconditions**:

- All five governance subsections exist (TC-GOV-001..005 pass).

**Steps**:

1. Open `architecture-overview-template.md`; enumerate the five governance subsections (residence, layering, contracts, ownership, heuristics).
2. For each subsection, confirm ≥1 concrete placeholder example usable as a placement or mock/stub decision is present (not vague prose).
3. Tally the count; assert 5/5.
4. (Red-team R1) have a reviewer role-play `@coder`/`@spec-writer`: can each example alone drive a placement or mock decision?

**Expected Outcome**:

- **Given** the five governance sections, **when** an AI agent applies them, **then** each section contains ≥1 concrete placeholder example usable as a placement or mock/stub decision — **5/5**.
- This is the actionability audit (the change's core success criterion, DEC-6); red-team R1 specifically probes it.

**Notes / Clarifications**:

- Aggregates TC-GOV-001..005 into the single "5/5" pass criterion required by AC-NFR1-1.

#### TC-DIST-001 - Doc-distribution gate exits 0

**Scenario Type**: Happy Path
**Impact Level**: Critical
**Priority**: High
**Related IDs**: NFR-3, AC-NFR3-1, F-1, F-6
**Test Type(s)**: Manual
**Automation Level**: Automated
**Verification Method**: Automated-script
**Target Layer / Location**: `scripts/.tests/test-doc-distribution.sh` (scans `doc/templates/**`)
**Tags**: @docs, @ci, @gate

**Preconditions**:

- Both modified templates retain `ados_distribution: redistributable` and their license header block.
- Repository root is the working directory; bash ≥ 4 available.

**Steps**:

1. From the repo root, run exactly: `bash scripts/.tests/test-doc-distribution.sh`
2. Capture the exit code.

**Expected Outcome**:

- Exit code **0**.
- Stdout/stderr includes `(guard-doc-distribution)[OK]   no drift … install set matches ados_distribution markers`.
- The gate's modes 1 & 2 confirm both templates carry a valid `ados_distribution: redistributable` marker (and the license-header block remains per the redistributable contract).

**Notes / Clarifications**:

- Baseline confirmed: the gate currently exits 0 on the green tree (76 in-scope docs). This TC asserts it stays 0 after the change.
- This is the **only** CI-blocking automated check for this change.

#### TC-COMPAT-001 - Additive-only backward compatibility (no removed/renamed headers or columns)

**Scenario Type**: Regression
**Impact Level**: Critical
**Priority**: High
**Related IDs**: NFR-4, AC-NFR4-1, DM-6, DM-7, F-6
**Test Type(s)**: Manual
**Automation Level**: Semi-automated
**Verification Method**: Backward-compat-diff
**Target Layer / Location**: `doc/templates/architecture-overview-template.md`, `doc/templates/repo-analysis-template.md`, `doc/guides/project-inception.md`
**Tags**: @docs, @regression

**Preconditions**:

- The change is committed on branch `docs/GH-90/architecture-module-governance`; `origin/main` holds the pre-change versions.

**Steps**:

1. From the repo root, run: `git diff --check` and assert a clean result (no whitespace errors / conflict markers).
2. Run: `git diff origin/main -- doc/templates/architecture-overview-template.md doc/templates/repo-analysis-template.md doc/guides/project-inception.md`
3. In the architecture-overview diff, confirm every pre-existing `## ` section header (System context, Container diagram, Components, Data flow, External dependencies, Deployment topology, Key architectural decisions, Known constraints) is still present — only **new** headers (`## Module governance` + its subsections) are additions.
4. In the repo-analysis diff, confirm the module-map header row still contains the `Module` and `Responsibility` columns (new columns appended to the right; none removed or renamed).
5. Confirm no pre-existing row/cell was deleted or had its column renamed.

**Expected Outcome**:

- **Given** the modified templates compared to their pre-change versions, **when** diffed, **then** all pre-existing section headers and the module-map's `Module | Responsibility` columns remain — additions only; nothing removed or renamed.

#### TC-ADV-001 - (Advisory, non-gating) Consistency touch-points reviewed

**Scenario Type**: Regression
**Impact Level**: Minor
**Priority**: Low
**Related IDs**: RSK-4 (plan-sweep item; **not a spec AC**)
**Test Type(s)**: Manual
**Automation Level**: Manual
**Verification Method**: Manual-inspection
**Target Layer / Location**: `doc/templates/README.md` (~line 62), `doc/documentation-handbook.md` §17 (Template Index)
**Tags**: @docs, @advisory

**Preconditions**:

- Governance sections shipped in the architecture-overview template.

**Steps**:

1. Open `doc/templates/README.md` around line 62 (architecture-overview one-liner).
2. Open `doc/documentation-handbook.md` §17 (Template Index → architecture-overview row).
3. Decide whether either should mention "module governance"; update **only if needed** for consistency.

**Expected Outcome**:

- Touch-points were considered; if updated, they are consistent with the new governance sections.

**Notes / Clarifications**:

- **NON-GATING.** These are plan-sweep items (RSK-4), **not spec ACs**. This TC does **not** block delivery. It is the sole TC in this plan that does not trace to a spec AC; included as advisory per PM authorization (see §8.3).

## 6. Environments and Test Data

- **Environment:** local-dev (docs authoring worktree on branch `docs/GH-90/architecture-module-governance`). The automated gate additionally runs in CI.
- **Test data:** none. Templates are scaffolds with placeholder examples; no fixtures or seed data are required.
- **Isolation strategy:** all checks are read-only inspections + a read-mostly gate; no shared state is mutated. The gate creates and cleans up its own sandbox temp dirs internally.
- **Tooling:** `bash` ≥ 4 (required by the gate for `shopt globstar`), `git` for the diff/backward-compat TC.

## 7. Automation Plan and Implementation Mapping

| TC ID | Test file / command | Implementation status | Notes |
|-------|---------------------|-----------------------|-------|
| TC-GOV-001 | Manual inspection of `architecture-overview-template.md` | Manual Only | No automation (NG-2) |
| TC-GOV-002 | Manual inspection of `architecture-overview-template.md` | Manual Only | — |
| TC-GOV-003 | Manual inspection of `architecture-overview-template.md` | Manual Only | — |
| TC-GOV-004 | Manual inspection of `architecture-overview-template.md` | Manual Only | — |
| TC-GOV-005 | Manual inspection of `architecture-overview-template.md` | Manual Only | `<N>` placeholder verified here (OQ-1) |
| TC-GOV-006 | Manual inspection of section ordering | Manual Only | Verifies DEC-5/OQ-2 |
| TC-ALGN-001 | Manual inspection of `repo-analysis-template.md` | Manual Only | — |
| TC-INC-001 | Manual inspection of `project-inception.md` Phase 3 | Manual Only | — |
| TC-AIACT-001 | Manual 5/5 audit + red-team R1 | Manual Only | Aggregates GOV-001..005 |
| TC-DIST-001 | `bash scripts/.tests/test-doc-distribution.sh` | **Existing – No Change** | Expected exit 0; the only automated gate |
| TC-COMPAT-001 | `git diff origin/main -- <files>` + `git diff --check` | Semi-automated | Manual interpretation of the additive-only assertion |
| TC-ADV-001 | Manual review of README ~L62 + handbook §17 | Manual Only | **Non-gating**; update only if needed |

**Mocking requirements:** none (no code under test).

## 8. Risks, Assumptions, and Open Questions

### 8.1 Risks

| ID | Risk | Mitigation |
|----|------|------------|
| TR-1 | Governance prose reads well but is not actionable (the core entropy risk) | TC-AIACT-001 mandates the 5/5 concrete-example bar + red-team R1 actionability role-play |
| TR-2 | Manual inspections are subjective / easy to rubber-stamp | Each inspection TC has explicit Given/When/Then + a named concrete example to look for; TC-GOV-006 + TC-COMPAT-001 add structural (placement / diff) objectivity |
| TR-3 | Drift between architecture-overview and repo-analysis governance fields | TC-ALGN-001 asserts shared field names (DM-1/2/3 ↔ DM-6) |
| TR-4 | The single automated gate (TC-DIST-001) could mask a content defect | It only covers marker/header invariants; content correctness relies on the manual TCs — explicitly an accepted residual risk |
| TR-5 | Backward-compat regression (a pre-existing header/column dropped) | TC-COMPAT-001 diffs against `origin/main` and enumerates the headers/columns that must survive |

### 8.2 Assumptions

- The repo testing strategy (`docs/templates → manual verification + `git diff --check``) is the correct test approach; no unit/integration/e2e tests are warranted.
- The doc-distribution gate remains the sole CI-blocking check; no new automated validator is introduced (NG-2).
- `origin/main` is a faithful representation of the pre-change templates for the backward-compat diff (TC-COMPAT-001).
- Red-team **R1 (pre-delivery)** is the chosen validation gate for the AI-actionability bar; **R2 (post-delivery)** verifies shipped templates (per spec §18).

### 8.3 Open Questions

| ID | Question | Blocking? | Owner |
|----|----------|-----------|-------|
| OQ-T1 | TC-ADV-001 does not trace to a spec AC (it traces to RSK-4 / the plan sweep). Is an advisory, non-gating TC acceptable, or should the consistency touch-points be promoted to a real AC? | **Non-blocking** — PM pre-authorized the advisory TC. Recorded for transparency against the "no orphan TC" rule. | PM |
| OQ-T2 | Should the additive-only backward-compat assertion (TC-COMPAT-001) be automated (e.g. a grep that no `^## ` header or `Module`/`Responsibility` column appears only as a `-` deletion)? | Non-blocking. Currently semi-automated (manual interpretation). Automation would belong to a follow-on, not this change (NG-2). | @plan-writer |

## 9. Plan Revision Log

| Version | Date | Author | Changes |
|---------|------|--------|---------|
| 1.0 | 2026-06-29 | `@test-plan-writer` | Initial test plan — 12 scenarios tracing all 10 spec ACs (AC-F1-1…AC-F7-1, AC-NFR1-1, AC-NFR3-1, AC-NFR4-1); 9 manual-inspection + 1 automated-script + 1 backward-compat-diff + 1 advisory. |

## 10. Test Execution Log

| TC ID | Run Date | Result | Notes |
|-------|----------|--------|-------|
| TC-DIST-001 | 2026-06-29 | PASS (baseline) | Pre-change baseline: `bash scripts/.tests/test-doc-distribution.sh` → exit 0 ("76 in-scope docs; install set matches"). Re-run required after implementation. |
| _all others_ | — | _Not yet executed_ | Pending implementation of the template/guide changes. |
