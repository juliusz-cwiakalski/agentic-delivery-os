---
id: chg-GH-60-test-plan
status: Proposed
created: 2026-06-24T11:15:50Z
last_updated: 2026-06-24T11:15:50Z
owners: ["@cwiakalski"]
service: delivery-os
labels: [decision-records, documentation-framework, template]
version_impact: none
summary: "Give hard requirements (binary, non-negotiable constraints) a first-class place in decision records — separate from continuous decision drivers — so that an alternative can no longer 'win' on driver scores while silently violating a constraint."
links:
  change_spec: ./chg-GH-60-spec.md
  implementation_plan: ./chg-GH-60-plan.md
  testing_strategy: .ai/rules/testing-strategy.md
---

# Test Plan - Decision records: distinguish hard requirements (constraints) from drivers

## 1. Scope and Objectives

This change is a **documentation- and agent-prompt-framework change** — there is no source code, no runtime, no build, and no CI surface (NFR-4). Consequently the "tests" are **structural inspections and consistency checks**, not unit/integration/E2E test suites. Per the repo testing strategy (`.ai/rules/testing-strategy.md`), `doc/**` and `.opencode/**` artifacts map to the **static/diff + content-check** layer; for docs-only changes automated unit/integration tests are **N/A** and verification is performed via targeted structural inspection plus `git diff --check`.

The core invariant this plan protects is **section-order consistency**: the new "Constraints (Hard Requirements)" section must land in the *identical ordinal position* (immediately after *Problem Framing (Clarified)*, immediately before *Decision Drivers*) across all four artifacts that bake in the decision-record body structure — and it must do so without removing or reordering any existing section. The highest-value regression this plan catches is **silent drift** between those four sources (RSK-1, RSK-2).

Objectives:

- Confirm the new Constraints section, its entry schema, per-alternative compliance evaluation, and Decision-section attestation rules are present and correct in the template.
- Confirm the two commands and the architect agent carry the matching behavioral rules (elicitation step, overlap detection, summary field, rendering position, baked-in structure).
- Confirm the change is strictly additive (backward-compatible) and touches zero source/CI files.

### 1.1 In Scope

- Structural inspection of the five affected artifacts:
  - Decision-record template — `doc/templates/decision-record-template.md`
  - Management guide §6 — `doc/guides/decision-records-management.md`
  - `plan-decision` command — `.opencode/command/plan-decision.md`
  - `write-decision` command — `.opencode/command/write-decision.md`
  - `architect` agent — `.opencode/agent/architect.md`
- Cross-source section-order consistency (the four body-structure sources).
- Backward-compatibility (no existing section removed/reordered) and zero source/CI change.

### 1.2 Out of Scope & Known Gaps

- No unit, integration, contract, E2E, or performance tests — the change has no executable surface.
- No automated tests exist for docs/`.opencode` artifacts; per the testing-strategy fallback, automated tests are marked **N/A** and verification is manual/semi-automated structural inspection + `git diff --check`.
- No runtime execution of `/plan-decision` or `/write-decision` is exercised here; behavioral checks inspect the **prompt text** for the presence and correctness of the new rules, not an end-to-end agent run.
- Migration of existing decision records (none exist — NG-1, NFR-2).

## 2. References

| Reference | Location |
|-----------|----------|
| Change specification | `./chg-GH-60-spec.md` |
| Implementation plan | `./chg-GH-60-plan.md` (not yet authored at time of test-plan creation) |
| Testing strategy | `.ai/rules/testing-strategy.md` |
| Decision-record template | `doc/templates/decision-record-template.md` |
| Management guide | `doc/guides/decision-records-management.md` |
| `plan-decision` command | `.opencode/command/plan-decision.md` |
| `write-decision` command | `.opencode/command/write-decision.md` |
| `architect` agent | `.opencode/agent/architect.md` |

## 3. Coverage Overview

### 3.1 Functional Coverage (F-#, AC-#)

| AC ID | Description (abridged) | TC ID(s) | Status |
|-------|------------------------|----------|--------|
| AC-GH60-1 | Constraints section exists immediately after Problem Framing, before Decision Drivers (template) | TC-GH60-001 | Covered |
| AC-GH60-2 | Constraint recorded with fields ID, Statement, Source, Verification, Negotiable | TC-GH60-002 | Covered |
| AC-GH60-3 | Per-alternative constraint-compliance evaluation with prose/matrix heuristic (default matrix) | TC-GH60-003 | Covered |
| AC-GH60-4 | Decision section attests compliance or documents accepted-risk exception (negotiable only) | TC-GH60-004 | Covered |
| AC-GH60-5 | plan-decision elicits hard requirements as a distinct step separate from drivers | TC-GH60-005 | Covered |
| AC-GH60-6 | plan-decision warns on driver/constraint overlap and requires categorization (soft warn) | TC-GH60-006 | Covered |
| AC-GH60-7 | Planning summary includes `hard_requirements` field distinct from `decision_drivers` | TC-GH60-007 | Covered |
| AC-GH60-8 | write-decision renders Constraints section; resulting order matches template exactly | TC-GH60-008 | Covered |
| AC-GH60-9 | Management guide §6 lists Constraints section in correct ordinal position | TC-GH60-009 | Covered |
| AC-GH60-10 | Constraints section + rules apply uniformly across ADR/PDR/TDR/BDR/ODR | TC-GH60-010 | Covered |
| AC-GH60-11 | Prior-structure decision record remains structurally valid (backward-compatible) | TC-GH60-011 | Covered |
| AC-GH60-12 | architect agent baked-in body structure includes Constraints in same ordinal position | TC-GH60-012 | Covered |

**AC coverage: 12 / 12 = 100%.**

| F ID | Capability | TC ID(s) |
|------|-----------|----------|
| F-1 | First-class Constraints section in template | TC-GH60-001 |
| F-2 | Per-alternative constraint-compliance evaluation | TC-GH60-003 |
| F-3 | Decision-section compliance attestation + accepted-risk exception path | TC-GH60-004 |
| F-4 | Hard-requirements elicitation as a distinct planning step | TC-GH60-005, TC-GH60-007 |
| F-5 | Driver/constraint overlap detection in planning | TC-GH60-006 |
| F-6 | Constraints rendering in the decision-record writer | TC-GH60-008 |
| F-7 | Uniform application across all five decision types | TC-GH60-010 |
| F-8 | Synchronized body structure across all authoring artifacts | TC-GH60-009, TC-GH60-012, TC-GH60-013 |

### 3.2 Interface Coverage (API-#, EVT-#, DM-#)

No REST/HTTP (§8.1 N/A) and no events/messages (§8.2 N/A). Only data-model elements apply.

| DM ID | Element | TC ID(s) |
|-------|---------|----------|
| DM-1 | Constraint entry fields (ID, Statement, Source, Verification, Negotiable) | TC-GH60-002 |
| DM-2 | `hard_requirements:` planning-summary field (distinct from `decision_drivers:`) | TC-GH60-007 |
| DM-3 | Constraint identifier scheme `C-1`, `C-2`, … | TC-GH60-003 |

### 3.3 Non-Functional Coverage (NFR-#)

| NFR ID | Requirement | TC ID(s) |
|--------|-------------|----------|
| NFR-1 | Section-order consistency across the 4 authoritative body-structure sources (4/4) | TC-GH60-001, TC-GH60-008, TC-GH60-012, TC-GH60-013 |
| NFR-2 | Backward compatibility — existing records valid; 0 migrations (0 exist) | TC-GH60-011 |
| NFR-3 | Uniformity across all 5 decision types (5/5) | TC-GH60-010 |
| NFR-4 | No runtime/build impact — 0 source-code, 0 CI changes | TC-GH60-014 |

## 4. Test Types and Layers

This change has **no executable code surface**. Per `.ai/rules/testing-strategy.md`, all affected modules (`doc/**` templates/guides and `.opencode/**` command/agent prompts) map to the **static/diff + content-check** layer. No unit/integration/E2E framework applies.

- **Static/diff checks (always):** `git diff --check` for whitespace/conflict markers; changed-file path/naming review.
- **Content/structural checks (docs + `.opencode`):** targeted `grep`/read inspection confirming section presence, ordinal position, field names, and behavioral-rule wording across the five artifacts.
- **Cross-source consistency check:** extract and compare the top-level body-section order from the four authoritative sources.
- **No automated test framework is created or run** for this change (per testing-strategy fallback: docs-only → automated tests N/A → manual/semi-automated verification + `git diff --check`).

Execution: all checks run from the repository root on the working tree of branch `feat/GH-60/decision-records-hard-requirements`. No environment beyond a local checkout with `git` and `grep`/`rg` is required.

## 5. Test Scenarios

### 5.1 Scenario Index

| TC ID | Title | Type | Level | Priority | AC Coverage |
|-------|-------|------|-------|----------|-------------|
| TC-GH60-001 | Template — Constraints section in correct ordinal position | Structural inspection | Critical | High | AC-GH60-1 |
| TC-GH60-002 | Template — constraint entry field set (ID/Statement/Source/Verification/Negotiable) | Structural inspection | Critical | High | AC-GH60-2 |
| TC-GH60-003 | Template — per-alternative compliance evaluation + C-n identifier scheme | Structural inspection | Critical | High | AC-GH60-3 |
| TC-GH60-004 | Template — Decision-section attestation + accepted-risk exception (negotiable only) | Behavioral inspection | Critical | High | AC-GH60-4 |
| TC-GH60-005 | plan-decision — hard requirements elicited as a distinct step | Behavioral inspection | Critical | High | AC-GH60-5 |
| TC-GH60-006 | plan-decision — driver/constraint overlap detection (soft warn, categorize) | Behavioral inspection | Important | High | AC-GH60-6 |
| TC-GH60-007 | plan-decision — planning summary `hard_requirements` distinct from `decision_drivers` | Structural inspection | Critical | High | AC-GH60-7 |
| TC-GH60-008 | write-decision — renders Constraints section in template-exact order | Behavioral inspection | Critical | High | AC-GH60-8 |
| TC-GH60-009 | Management guide §6 — Constraints listed in correct ordinal position | Structural inspection | Important | Medium | AC-GH60-9 |
| TC-GH60-010 | Cross-type uniformity — Constraints applies to all 5 types | Structural inspection | Important | Medium | AC-GH60-10 |
| TC-GH60-011 | Backward compatibility — no existing section removed/reordered | Regression | Critical | High | AC-GH60-11 |
| TC-GH60-012 | architect agent — baked-in body structure includes Constraints | Structural inspection | Critical | High | AC-GH60-12 |
| TC-GH60-013 | Cross-source consistency — section order identical across 4 sources | Consistency check | Critical | High | NFR-1 (synthesis) |
| TC-GH60-014 | Static hygiene — `git diff --check` clean, zero source/CI files changed | Static/diff check | Important | High | NFR-4 |

### 5.2 Scenario Details

#### TC-GH60-001 - Template — Constraints section in correct ordinal position

**Scenario Type**: Corner Case
**Impact Level**: Critical
**Priority**: High
**Related IDs**: AC-GH60-1, F-1, NFR-1
**Test Type(s)**: Manual
**Automation Level**: Semi-automated
**Target Layer / Location**: `doc/templates/decision-record-template.md`
**Tags**: @docs, @template

**Preconditions**:

- The change is implemented on branch `feat/GH-60/decision-records-hard-requirements`.

**Steps**:

1. Extract the top-level (`##`) body headings in order:
   `grep -nE '^## ' doc/templates/decision-record-template.md`
2. Locate the "Constraints (Hard Requirements)" heading.
3. Confirm its two neighbors.

**Expected Outcome**:

- A `## Constraints (Hard Requirements)` heading is present.
- It appears **immediately after** `## Problem Framing (Clarified)` and **immediately before** `## Decision Drivers`.
- Verification one-liner:
  `grep -nE '^## (Problem Framing|Constraints|Decision Drivers)' doc/templates/decision-record-template.md` prints the three headings in exactly that order, on consecutive (no intervening `##`) line numbers.

**Notes / Clarifications**:

- The section may be explicitly empty when a decision has no hard requirements; emptiness guidance is a content concern, not a position concern — position is what this TC asserts.

---

#### TC-GH60-002 - Template — constraint entry field set

**Scenario Type**: Happy Path
**Impact Level**: Critical
**Priority**: High
**Related IDs**: AC-GH60-2, DM-1, F-1
**Test Type(s)**: Manual
**Automation Level**: Semi-automated
**Target Layer / Location**: `doc/templates/decision-record-template.md` (Constraints section)
**Tags**: @docs, @template

**Preconditions**:

- TC-GH60-001 passes (Constraints section exists).

**Steps**:

1. Read the Constraints section of the template.
2. Confirm each constraint entry documents the five required fields.
3. Confirm the enumerated value sets are documented:
   `grep -nE 'Source|Verification|Negotiable' doc/templates/decision-record-template.md`

**Expected Outcome**:

- Each constraint entry template shows exactly these fields: **ID**, **Statement**, **Source**, **Verification**, **Negotiable**.
- Source domain documented as ∈ {regulatory, contractual, prior decision, AC, internal standard}.
- Verification domain documented as ∈ {test, audit, code review, architect sign-off, demonstration}.
- Negotiable documented as ∈ {yes, no}.
- All five field labels appear within the Constraints section region.

---

#### TC-GH60-003 - Template — per-alternative compliance evaluation + C-n identifier scheme

**Scenario Type**: Happy Path
**Impact Level**: Critical
**Priority**: High
**Related IDs**: AC-GH60-3, F-2, DM-3
**Test Type(s)**: Manual
**Automation Level**: Semi-automated
**Target Layer / Location**: `doc/templates/decision-record-template.md` (Alternatives Considered section)
**Tags**: @docs, @template

**Preconditions**:

- TC-GH60-001 and TC-GH60-002 pass.

**Steps**:

1. Read the "Alternatives Considered" section guidance in the template.
2. Confirm the compliance-evaluation requirement and the prose-vs-matrix heuristic.
3. Confirm the constraint identifier scheme is documented/used for cross-reference:
   `grep -nE 'C-[0-9]|compliance|matrix|prose' doc/templates/decision-record-template.md`

**Expected Outcome**:

- Every alternative is required to include an **explicit constraint-compliance evaluation** (not only pros/cons against drivers).
- The readability heuristic is documented: choose **prose** (1–2 sentences/alternative) when all satisfy constraints or few violations need explanation; choose **matrix** (constraints × alternatives) when ≥3 constraints have mixed compliance or prose would exceed ~3 sentences/alternative; **default to matrix when unsure**.
- Table-stakes constraints (all alternatives satisfy) get a brief acknowledgment rather than per-alternative listing.
- Constraints use compact identifiers **`C-1`, `C-2`, …** so Alternatives and Decision can cross-reference them.

---

#### TC-GH60-004 - Template — Decision-section attestation + accepted-risk exception

**Scenario Type**: Edge Case
**Impact Level**: Critical
**Priority**: High
**Related IDs**: AC-GH60-4, F-3
**Test Type(s)**: Manual
**Automation Level**: Semi-automated
**Target Layer / Location**: `doc/templates/decision-record-template.md` (Decision section)
**Tags**: @docs, @template

**Preconditions**:

- TC-GH60-001 passes.

**Steps**:

1. Read the "Decision" section guidance in the template.
2. Confirm the compliance-attestation rule and the exception gating.

**Expected Outcome**:

- The Decision section **must explicitly attest** that the chosen alternative satisfies every constraint.
- For any unsatisfied constraint, an **accepted-risk exception** is documented.
- An exception is permitted **only** for constraints marked `negotiable: yes`.
- A non-negotiable constraint (`negotiable: no`) that the chosen alternative violates is **disqualifying** and must not be waved through.

---

#### TC-GH60-005 - plan-decision — hard requirements elicited as a distinct step

**Scenario Type**: Happy Path
**Impact Level**: Critical
**Priority**: High
**Related IDs**: AC-GH60-5, F-4
**Test Type(s)**: Manual
**Automation Level**: Semi-automated
**Target Layer / Location**: `.opencode/command/plan-decision.md`
**Tags**: @opencode, @command

**Preconditions**:

- The command prompt has been updated (via `@toolsmith`).

**Steps**:

1. Read the elicitation phases of `plan-decision`.
2. Confirm a dedicated hard-requirements step exists **separate** from the decision-drivers step.

**Expected Outcome**:

- A distinct step elicits **hard requirements** as a separate factor class, performed separately from the decision-driver step.
- Hard requirements are not folded into the context/problem-framing step nor into the drivers step.
- Verification: `grep -niE 'hard requirement|hard_requirements|constraint' .opencode/command/plan-decision.md` shows the dedicated elicitation instruction.

---

#### TC-GH60-006 - plan-decision — driver/constraint overlap detection

**Scenario Type**: Edge Case
**Impact Level**: Important
**Priority**: High
**Related IDs**: AC-GH60-6, F-5
**Test Type(s)**: Manual
**Automation Level**: Manual
**Target Layer / Location**: `.opencode/command/plan-decision.md`
**Tags**: @opencode, @command

**Preconditions**:

- TC-GH60-005 passes.

**Steps**:

1. Read the planning flow in `plan-decision`.
2. Locate the overlap-detection rule.

**Expected Outcome**:

- When the **same factor** is captured as both a driver and a constraint, the command **warns** and **requires the author to categorize it into exactly one bucket** before proceeding.
- The warning is a **soft warning** that surfaces the conflict and asks for a decision — it is **not** a hard block that halts the session.
- Each factor ends up in exactly one bucket (driver XOR constraint).

---

#### TC-GH60-007 - plan-decision — planning summary `hard_requirements` field

**Scenario Type**: Structural inspection
**Impact Level**: Critical
**Priority**: High
**Related IDs**: AC-GH60-7, DM-2, F-4
**Test Type(s)**: Manual
**Automation Level**: Semi-automated
**Target Layer / Location**: `.opencode/command/plan-decision.md` (`<technical_decision_planning_summary>`)
**Tags**: @opencode, @command

**Preconditions**:

- TC-GH60-005 passes.

**Steps**:

1. Locate the `<technical_decision_planning_summary>` template in the command.
2. Confirm a `hard_requirements:` field is defined and is distinct from `decision_drivers:`.

**Expected Outcome**:

- The summary schema includes a `hard_requirements:` list.
- That list is **separate** from the existing `decision_drivers:` list (two distinct keys).
- Verification: `grep -nE 'hard_requirements|decision_drivers' .opencode/command/plan-decision.md` shows both keys, with `hard_requirements:` appearing as its own field.

---

#### TC-GH60-008 - write-decision — renders Constraints section in template-exact order

**Scenario Type**: Happy Path
**Impact Level**: Critical
**Priority**: High
**Related IDs**: AC-GH60-8, F-6, NFR-1
**Test Type(s)**: Manual
**Automation Level**: Semi-automated
**Target Layer / Location**: `.opencode/command/write-decision.md` (`<decision_structure>`)
**Tags**: @opencode, @command

**Preconditions**:

- TC-GH60-001 passes (template defines the canonical order).

**Steps**:

1. Read the `<decision_structure>` and embedded template in `write-decision`.
2. Confirm it reads `hard_requirements:` from the planning summary and renders the Constraints section.
3. Confirm the rendered section order matches the template.

**Expected Outcome**:

- The command consumes the `hard_requirements:` field from the planning summary.
- It renders a `## Constraints (Hard Requirements)` section at the position defined by F-1 (after Problem Framing, before Decision Drivers).
- The full top-level section order produced matches the template exactly (see TC-GH60-013 for the canonical list).
- Verification: `grep -nE '## (Problem Framing|Constraints|Decision Drivers)' .opencode/command/write-decision.md` shows the three in that order.

---

#### TC-GH60-009 - Management guide §6 — Constraints listed in correct ordinal position

**Scenario Type**: Structural inspection
**Impact Level**: Important
**Priority**: Medium
**Related IDs**: AC-GH60-9, F-8
**Test Type(s)**: Manual
**Automation Level**: Semi-automated
**Target Layer / Location**: `doc/guides/decision-records-management.md` (§6 Required Sections)
**Tags**: @docs, @guide

**Preconditions**:

- None.

**Steps**:

1. Read §6 "Required Sections" of the management guide.
2. Confirm the Constraints section is listed and in the correct ordinal position.

**Expected Outcome**:

- §6 lists "Constraints (Hard Requirements)" between *Problem Framing* and *Decision Drivers*.
- Verification: `grep -nE 'Problem Framing|Constraints|Decision Drivers' doc/guides/decision-records-management.md` shows the three terms in that relative order within the §6 list.
- §9 "Agent Integration" is reviewed for consistency (no contradiction with the new step).

---

#### TC-GH60-010 - Cross-type uniformity — Constraints applies to all 5 types

**Scenario Type**: Corner Case
**Impact Level**: Important
**Priority**: Medium
**Related IDs**: AC-GH60-10, F-7, NFR-3
**Test Type(s)**: Manual
**Automation Level**: Manual
**Target Layer / Location**: `doc/templates/decision-record-template.md`, `doc/guides/decision-records-management.md`
**Tags**: @docs, @template, @guide

**Preconditions**:

- TC-GH60-001 passes.

**Steps**:

1. Confirm all five decision types (ADR, PDR, TDR, BDR, ODR) share the single template/body structure.
2. Confirm no type opts out of the Constraints section and no type adds type-only constraint behavior.

**Expected Outcome**:

- The Constraints section and its rules apply **identically** regardless of the decision type prefix.
- No per-type structural variant exists that would omit or alter the Constraints section for any of the five types (5/5).

---

#### TC-GH60-011 - Backward compatibility — no existing section removed/reordered

**Scenario Type**: Regression
**Impact Level**: Critical
**Priority**: High
**Related IDs**: AC-GH60-11, NFR-2, NG-2
**Test Type(s)**: Manual
**Automation Level**: Semi-automated
**Target Layer / Location**: `doc/templates/decision-record-template.md` (whole body)
**Tags**: @docs, @template

**Preconditions**:

- The baseline (pre-change) heading list is known from the spec's "Current State Snapshot" (Context → Problem Framing → Decision Drivers → Mental Models & Techniques → Alternatives → Decision → Trade-offs & Consequences → … → References).

**Steps**:

1. `git diff feat/GH-60/decision-records-hard-requirements~..feat/GH-60/decision-records-hard-requirements -- doc/templates/decision-record-template.md` (or compare against `main`).
2. Confirm the diff is **strictly additive** for the body structure.

**Expected Outcome**:

- No existing top-level section is removed.
- No existing top-level section is reordered (Context, Problem Framing, Decision Drivers, Mental Models, Alternatives, Decision, Trade-offs, …, References all remain in their original relative order).
- The only structural delta is the **insertion** of the Constraints section and tightened authoring text within Alternatives/Decision.
- A decision record authored under the prior structure remains structurally valid without modification (0 migrations; 0 exist today).

---

#### TC-GH60-012 - architect agent — baked-in body structure includes Constraints

**Scenario Type**: Structural inspection
**Impact Level**: Critical
**Priority**: High
**Related IDs**: AC-GH60-12, F-8, NFR-1
**Test Type(s)**: Manual
**Automation Level**: Semi-automated
**Target Layer / Location**: `.opencode/agent/architect.md` (decision-record body structure)
**Tags**: @opencode, @agent

**Preconditions**:

- The agent prompt has been updated (via `@toolsmith`).

**Steps**:

1. Read the baked-in decision-record body structure in `architect.md`.
2. Confirm the Constraints section is present in the same ordinal position as the template.

**Expected Outcome**:

- The architect's baked-in body structure lists `## Constraints (Hard Requirements)` between `## Problem Framing (Clarified)` and `## Decision Drivers`.
- Verification: `grep -nE '## (Problem Framing|Constraints|Decision Drivers)' .opencode/agent/architect.md` shows the three in that order.

---

#### TC-GH60-013 - Cross-source consistency — section order identical across 4 sources

**Scenario Type**: Corner Case
**Impact Level**: Critical
**Priority**: High
**Related IDs**: NFR-1, F-8, RSK-1, RSK-2
**Test Type(s)**: Manual
**Automation Level**: Semi-automated
**Target Layer / Location**: template + guide §6 + write-decision + architect (the four body-structure sources)
**Tags**: @docs, @opencode, @template, @guide

**Preconditions**:

- TC-GH60-001, TC-GH60-008, TC-GH60-009, TC-GH60-012 pass individually.

**Steps**:

1. From each of the four authoritative sources, extract the top-level body-section order around the insertion point:
   - `grep -nE '^## (Context|Problem Framing|Constraints|Decision Drivers|Mental Models|Alternatives Considered|Decision)' doc/templates/decision-record-template.md`
   - `grep -nE 'Problem Framing|Constraints|Decision Drivers|Alternatives' doc/guides/decision-records-management.md`
   - `grep -nE 'Problem Framing|Constraints|Decision Drivers|Alternatives' .opencode/command/write-decision.md`
   - `grep -nE 'Problem Framing|Constraints|Decision Drivers|Alternatives' .opencode/agent/architect.md`
2. Compare the relative order of the key sequence across all four.

**Expected Outcome**:

- All four sources agree on the identical ordinal position for Constraints: **Context → Problem Framing → Constraints (Hard Requirements) → Decision Drivers → …** (Constraints sits between Problem Framing and Decision Drivers in every source).
- Count of sources in agreement = **4 / 4** (template, guide §6, write-decision structure/embedded template, architect body structure).
- This is the primary drift guard for RSK-1/RSK-2.

**Notes / Clarifications**:

- `plan-decision` is the *elicitation* source, not a body-structure source; it is therefore excluded from the 4-source consistency count (it is covered by AC-GH60-5/6/7). NFR-1 names exactly these four sources.

---

#### TC-GH60-014 - Static hygiene — `git diff --check` clean, zero source/CI files changed

**Scenario Type**: Regression
**Impact Level**: Important
**Priority**: High
**Related IDs**: NFR-4, NG-2 (scope boundary)
**Test Type(s)**: Manual
**Automation Level**: Semi-automated
**Target Layer / Location**: repository root (git working tree)
**Tags**: @docs, @ci

**Preconditions**:

- All implementation edits for GH-60 are staged/committed on the branch.

**Steps**:

1. Run `git diff --check` (and `git diff --cached --check`) — expect no whitespace/conflict-marker errors.
2. List every file changed by the change:
   `git diff --name-only $(git merge-base HEAD main)..HEAD`
3. Inspect the changed-paths list for any source/CI file.

**Expected Outcome**:

- `git diff --check` reports clean (no output).
- The changed-file set contains **only** documentation/`.opencode` artifacts (the five affected artifacts, plus this change's own `doc/changes/...` artifacts) and **zero** source-code, build, or CI/configuration files.
- NFR-4 satisfied: 0 source-code changes; 0 CI/build configuration changes.

## 6. Environments and Test Data

- **Environment:** a single local repository checkout on branch `feat/GH-60/decision-records-hard-requirements`. No test, staging, or runtime environment is required (no executable surface).
- **Tools required:** `git`, `grep` (or `rg`). No test framework, no language runtime.
- **Test data:** none generated. Inspections read the in-repo artifact text directly. No fixtures, no teardown, no isolation strategy needed beyond the git branch itself.

## 7. Automation Plan and Implementation Mapping

Per the repo testing strategy, `doc/**` and `.opencode/**` artifacts have **no automated test suite**; verification is manual/semi-automated structural inspection. Each TC below is therefore implemented as a documented manual/semi-automated check (grep one-liner + human judgment), not as a test file.

| TC ID | Implementation | Execution command (evidence) | Status |
|-------|----------------|------------------------------|--------|
| TC-GH60-001 | Manual structural inspection | `grep -nE '^## (Problem Framing|Constraints|Decision Drivers)' doc/templates/decision-record-template.md` | To Verify |
| TC-GH60-002 | Manual structural inspection | `grep -nE 'Source\|Verification\|Negotiable' doc/templates/decision-record-template.md` | To Verify |
| TC-GH60-003 | Manual structural inspection | `grep -nE 'C-[0-9]\|compliance\|matrix\|prose' doc/templates/decision-record-template.md` | To Verify |
| TC-GH60-004 | Manual content review | read Decision section guidance | To Verify |
| TC-GH60-005 | Manual behavioral inspection | `grep -niE 'hard requirement\|hard_requirements\|constraint' .opencode/command/plan-decision.md` | To Verify |
| TC-GH60-006 | Manual behavioral inspection | read plan-decision overlap rule | To Verify |
| TC-GH60-007 | Manual structural inspection | `grep -nE 'hard_requirements\|decision_drivers' .opencode/command/plan-decision.md` | To Verify |
| TC-GH60-008 | Manual behavioral inspection | `grep -nE '## (Problem Framing|Constraints|Decision Drivers)' .opencode/command/write-decision.md` | To Verify |
| TC-GH60-009 | Manual structural inspection | `grep -nE 'Problem Framing\|Constraints\|Decision Drivers' doc/guides/decision-records-management.md` | To Verify |
| TC-GH60-010 | Manual content review | confirm single shared template, no per-type opt-out | To Verify |
| TC-GH60-011 | Manual regression diff | `git diff <base>..HEAD -- doc/templates/decision-record-template.md` | To Verify |
| TC-GH60-012 | Manual structural inspection | `grep -nE '## (Problem Framing|Constraints|Decision Drivers)' .opencode/agent/architect.md` | To Verify |
| TC-GH60-013 | Manual cross-source consistency | four `grep` commands (see TC steps) | To Verify |
| TC-GH60-014 | Static/diff gate | `git diff --check` + `git diff --name-only <base>..HEAD` | To Verify |

**Mocking requirements:** none — no runtime, no I/O to mock.
**Automation note:** automated unit/integration tests are **N/A** for this change per the testing-strategy fallback for docs-only changes.

## 8. Risks, Assumptions, and Open Questions

### 8.1 Risks

| Risk | Impact | Mitigation |
|------|--------|------------|
| The four body-structure sources drift (e.g., writer omits Constraints while the template includes it) — RSK-1 | High | TC-GH60-013 enforces 4/4 agreement; TC-GH60-001/008/009/012 assert each source individually. |
| Behavioral rules (elicitation/overlap/attestation) are present in wording but subtly wrong (e.g., hard block instead of soft warn) | Medium | TC-GH60-004/005/006 require human judgment on rule semantics, not just keyword presence. |
| A grep one-liner passes on a coincidental unrelated match | Low | TCs scope greps to heading context + require the ordinal-position assertion, not bare keyword hits. |

### 8.2 Assumptions

- The pre-change body-section order is identical across the four authoritative sources (spec §12 assumption); this change updates all four rather than reconciling pre-existing drift.
- The five affected artifacts are exactly those listed in §1.1; no sixth artifact bakes in the body structure (an agent audit in DEC-9 confirmed `@spec-writer`/`@plan-writer` do not).
- Verification runs against the committed working tree of the feature branch (implementation not yet authored at test-plan creation time).

### 8.3 Open Questions

| ID | Question | Status |
|----|----------|--------|
| OQ-GH60-1 | None — all spec open questions (OQ-1) were resolved at authoring time; plan-file (`chg-GH-60-plan.md`) is not yet authored, so implementation task sequencing is TBD but does not block this test plan. | Open (non-blocking) |

## 9. Plan Revision Log

| Version | Date | Author | Changes |
|---------|------|--------|---------|
| 1.0 | 2026-06-24 | @test-plan-writer | Initial test plan authored from `chg-GH-60-spec.md`. 14 test cases; 12/12 ACs covered (100%); NFR-1/2/3/4 and DM-1/2/3 mapped. |

## 10. Test Execution Log

| TC ID | Run Date | Result | Notes |
|-------|----------|--------|-------|
| _(execution pending implementation)_ | | | |
