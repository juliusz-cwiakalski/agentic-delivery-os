---
id: chg-GH-78-test-plan
status: Proposed
created: 2026-06-28T06:52:27Z
last_updated: 2026-06-28T06:52:27Z
owners: ["Juliusz Ćwiąkalski"]
service: delivery-os
labels: ["docs", "process", "spec-coverage", "feature-specs", "gh-79"]
version_impact: minor
summary: "Spec-coverage gate and feature-spec debt reduction (GH-78 + GH-79) — verification plan for the doc-syncer coverage gate, plugin regen invariant, and 8 new feature specs."
links:
  change_spec: ./chg-GH-78-spec.md
  implementation_plan: ./chg-GH-78-plan.md
  testing_strategy: .ai/rules/testing-strategy.md
---

# Test Plan - Spec-coverage gate and feature-spec debt reduction (GH-78 + GH-79)

## 1. Scope and Objectives

This is a **documentation + process change** (no application code logic). There is no runtime to unit-test; "tests" are **verification checks** — grep-able content assertions on edited agent prompts/guides, existence/coverage/content checks on 8 new feature specs, a plugin-regeneration invariant, and the repo's existing shell test suite kept green.

Core behaviors to protect:

- **GH-78 (Part A):** the new "feature spec coverage" check exists in `@doc-syncer`'s Identify Impact step (with a `spec_coverage_gaps` report field), `@pm`'s `clarify_scope` is coverage-aware, `change-lifecycle.md` §7 documents the check, and the doc-syncer-**reports**/PM-**proposes**/human-**approves** handoff is enforced.
- **Plugin freshness invariant (NFR-7):** `.ados-claude/` is regenerated **iff** a `.opencode/` source was edited — for this change, only `agents/doc-syncer.md` and `agents/pm.md`.
- **GH-79 (Part B):** the 8 missing/partial feature specs exist in `doc/spec/features/` and each meets its per-spec coverage, cites authoritative sources, cross-links (never duplicates) canonical content, is honest about distribution (`ados_distribution: internal`), and is headed by the script (never hand-added).
- **No regressions:** the GH-67 distribution guard and all existing `test-*.sh` scripts stay green; `doc/spec/**` remains outside the guard's scan set.

### 1.1 In Scope

- Part A content checks on `.opencode/agent/doc-syncer.md`, `.opencode/agent/pm.md`, `doc/guides/change-lifecycle.md` (§7).
- Plugin regeneration invariant on `.ados-claude/` (NFR-7 / AC-F1-7).
- Part B existence + per-spec coverage + cross-link + marker + header checks for the 8 new feature specs.
- Regression: `bash scripts/.tests/test-doc-distribution.sh` and all `scripts/.tests/` + `tools/.tests/` test scripts.
- Static guard: `git diff --check`.

### 1.2 Out of Scope & Known Gaps

- Retroactive marking of the 8 **existing** feature specs (NG-5) — not asserted.
- Extending the GH-67 guard / `install.sh` to scan `doc/spec/**` (NG-4 / OUT) — by design the marker on new specs is honest-but-unenforced; `test-doc-distribution.sh` is asserted only to *stay green*, not to gain coverage.
- P3 minor agents (NG-2) and the installer spec GH-77 (NG-3) — not specced, not tested.
- `definition-of-ready.md` is an **optional** lightweight edit; it has no dedicated AC, so it carries no hard verification case (checked only as part of AC-F1-4 awareness, where present).
- Behavior of the coverage check *in operation* (a real change flowing through phases) is exercised only by inspection of the prompt text, not by running the agents.

## 2. References

- Change spec: [./chg-GH-78-spec.md](./chg-GH-78-spec.md) (AC-F1-1…7, AC-F3-1…9, AC-F4-1…2, AC-F5-1…2).
- Implementation plan: [./chg-GH-78-plan.md](./chg-GH-78-plan.md) (if present).
- Testing strategy: [.ai/rules/testing-strategy.md](../../../.ai/rules/testing-strategy.md).
- Authoritative sources referenced by checks: `AGENTS.md`, `.opencode/agent/{doc-syncer,pm,external-researcher}.md`, `.opencode/command/{review,review-deep,check,check-fix,commit,pr}.md`, `scripts/build-claude-plugin.sh`, `scripts/add-header-location.sh`, `doc/guides/change-lifecycle.md`, `doc/decisions/ODR-0001-classify-yaml-register-templates-redistributable.md`, `scripts/.tests/test-doc-distribution.sh`.
- Header format reference: [doc/spec/features/feature-license-header-script.md](../../../doc/spec/features/feature-license-script.md) (3-line copyright/MIT/`source:` block embedded in YAML frontmatter).

## 3. Coverage Overview

### 3.1 Functional Coverage (F-#, AC-#) — Traceability Matrix

| AC ID | Criterion (short) | TC ID(s) | How verified | Status |
|-------|-------------------|----------|--------------|--------|
| **AC-F1-1** | doc-syncer Identify Impact has feature-spec-coverage sub-check + `spec_coverage_gaps` field | TC-COVRGATE-001 | grep content checks on `.opencode/agent/doc-syncer.md` | Pending |
| **AC-F1-2** | doc-syncer **reports**, never creates spec/ticket; PM proposes; human approves | TC-COVRGATE-002 | grep handoff-rule phrases in doc-syncer prompt | Pending |
| **AC-F1-3** | PM de-noises: checks open issues, references existing tracker, no duplicate | TC-COVRGATE-003 | grep de-noising phrases in doc-syncer + pm prompts | Pending |
| **AC-F1-4** | pm.md clarify_scope mentions feature-spec coverage awareness | TC-COVRGATE-004 | grep coverage-awareness phrases in `.opencode/agent/pm.md` | Pending |
| **AC-F1-5** | change-lifecycle.md §7 documents the coverage check | TC-COVRGATE-005 | grep check phrases in §7 of guide | Pending |
| **AC-F1-6** | "feature area" operationally defined (warrants `feature-<slug>.md`) → falsifiable | TC-COVRGATE-006 | grep operational definition + manual falsifiability review | Pending |
| **AC-F1-7** | `.ados-claude/` regenerated via build script and current | TC-PLUGIN-001 | rebuild + `git diff --stat` shows only the 2 edited-agent outputs | Pending |
| **AC-F3-1** | all 8 target spec files exist | TC-FSPEC-001 | existence checks in `doc/spec/features/` | Pending |
| **AC-F3-2** | delivery-lifecycle covers 11-phase + PM orchestration + reopening + DoR/DoD, cites source | TC-FSPEC-002 | per-spec content grep on `feature-delivery-lifecycle.md` | Pending |
| **AC-F3-3** | agents-and-commands states model-config nuance (`claude.model` hint vs `opencode*.jsonc`) + references toolsmith | TC-FSPEC-003 | per-spec content grep on `feature-agents-and-commands.md` | Pending |
| **AC-F3-4** | decision-making covers process/framework + cross-links (not dup) `feature-decision-records.md` | TC-FSPEC-004 | per-spec content + cross-link grep | Pending |
| **AC-F3-5** | claude-plugin-generation covers gen/SSOT/idempotency/CI gate, cites build script | TC-FSPEC-005 | per-spec content grep on `feature-claude-plugin-generation.md` | Pending |
| **AC-F3-6** | quality-gates-and-pr covers `/check` `/check-fix` commit+PR + roles | TC-FSPEC-006 | per-spec content grep on `feature-quality-gates-and-pr.md` | Pending |
| **AC-F3-7** | doc-distribution-marker covers values/parser/install-set/5-mode/DM-2, cites ODR-0001+guard, cross-links GH-67 + GH-77 TBD | TC-FSPEC-007 | per-spec content + cross-link grep | Pending |
| **AC-F3-8** | local-code-review covers `/review` `/review-deep` + heuristics + remediation append + cross-links (not dup) remote spec | TC-FSPEC-008 | per-spec content + cross-link grep | Pending |
| **AC-F3-9** | external-researcher covers MCP routing + untrusted content + output contract, cites agent | TC-FSPEC-009 | per-spec content grep on `feature-external-researcher.md` | Pending |
| **AC-F4-1** | canonical lifecycle/convention/decision-record rules cross-linked, not restated | TC-HYGIENE-001 | negative grep (no restated branch/folder/phase rules) + manual review | Pending |
| **AC-F4-2** | where Draft guide vs prompt disagree, spec follows prompt + records follow-up note | TC-HYGIENE-002 | grep follow-up/`Draft`/discrepancy markers + manual review | Pending |
| **AC-F5-1** | each of 8 specs carries `ados_distribution: internal` | TC-HYGIENE-003, TC-HYGIENE-005 | positive grep (`internal`) + negative grep (no `redistributable`) | Pending |
| **AC-F5-2** | headers via `add-header-location.sh`, none hand-added | TC-HYGIENE-004 | header-format grep + idempotency re-run + single-header check | Pending |

**AC coverage total: 20 / 20** (AC-F1-1…7 = 7; AC-F3-1…9 = 9; AC-F4-1…2 = 2; AC-F5-1…2 = 2).

### 3.2 Interface Coverage (API-#, EVT-#, DM-#)

No HTTP (§8.1 N/A) or event (§8.2 N/A) surfaces. Data-model items are conceptual/report-only:

| DM ID | Element | TC ID(s) | How verified |
|-------|---------|----------|--------------|
| DM-1 | "Feature area" (operational concept) | TC-COVRGATE-006 | operational-definition grep + falsifiability review |
| DM-2 | `spec_coverage_gaps` report field | TC-COVRGATE-001 | grep `spec_coverage_gaps` in doc-syncer prompt |

### 3.3 Non-Functional Coverage (NFR-#)

| NFR ID | Requirement | TC ID(s) | How verified |
|--------|-------------|----------|--------------|
| NFR-1 | Authoritative sourcing (8/8 specs cite ≥1 prompt/script/AGENTS.md) | TC-FSPEC-002…009, TC-HYGIENE-007 | per-spec source-citation grep + manual authoritative-source review |
| NFR-2 | No duplication (0 restated canonical rules) | TC-HYGIENE-001, TC-FSPEC-004, TC-FSPEC-008 | negative cross-link grep + manual review |
| NFR-3 | Distribution honesty (`internal` 8/8) | TC-HYGIENE-003, TC-HYGIENE-005, TC-REGRESS-001 | positive + negative marker grep; guard stays green |
| NFR-4 | No hand-added headers | TC-HYGIENE-004 | header-format + idempotency + single-occurrence checks |
| NFR-5 | Falsifiable coverage check | TC-COVRGATE-006 | operational definition present + reviewer names an area/confirms |
| NFR-6 | 11-phase accuracy (no "10-phase"; doc-syncer = phase 7) | TC-HYGIENE-006, TC-COVRGATE-005, TC-FSPEC-002 | scoped negative grep + positive phase-7 grep |
| NFR-7 | Plugin freshness (regenerate iff `.opencode/` edited) | TC-PLUGIN-001 | rebuild + diff-stat invariant |

## 4. Test Types and Layers

Per `.ai/rules/testing-strategy.md`, this `doc/**` + `.opencode/**` + `.ados-claude/**` change maps to:

- **Static/diff checks (always):** `git diff --check`; changed-file path/naming review. → TC-REGRESS-003.
- **Content checks (docs/templates):** grep-able traceability against ACs; markdown render review; link review; YAML frontmatter validity. → TC-COVRGATE-*, TC-FSPEC-*, TC-HYGIENE-*.
- **Automated shell/tool tests (when code changes):** Part A edits `.opencode/` (agent prompts) → regenerate plugin via `scripts/build-claude-plugin.sh` → invariant check. The change must not break existing `test-*.sh`. → TC-PLUGIN-001, TC-REGRESS-001, TC-REGRESS-002.
- **Manual verification:** authoring-from-behavior (F-4), falsifiability (NFR-5), cross-link intent (NFR-2) where automated grep is insufficient. → TC-HYGIENE-007, TC-COVRGATE-006 (manual portion), TC-HYGIENE-001/002 (manual portion).

No unit/integration/E2E framework applies (no application code). All automated checks are shell `rg`/`test`/script invocations run from the repo root.

## 5. Test Scenarios

### 5.1 Scenario Index

| TC ID | Title | Type | Level | Priority | AC Coverage |
|-------|-------|------|-------|----------|-------------|
| TC-COVRGATE-001 | doc-syncer has feature-spec-coverage sub-check + report field | Happy Path | Critical | High | AC-F1-1, DM-2 |
| TC-COVRGATE-002 | doc-syncer reports, never tickets (handoff rule) | Negative | Critical | High | AC-F1-2 |
| TC-COVRGATE-003 | PM de-noises follow-up (no duplicate tracker) | Corner Case | Important | Medium | AC-F1-3 |
| TC-COVRGATE-004 | pm.md clarify_scope is coverage-aware | Happy Path | Critical | High | AC-F1-4 |
| TC-COVRGATE-005 | change-lifecycle §7 documents the check | Happy Path | Important | Medium | AC-F1-5, NFR-6 |
| TC-COVRGATE-006 | "feature area" operationally defined + falsifiable | Corner Case | Important | Medium | AC-F1-6, DM-1, NFR-5 |
| TC-PLUGIN-001 | plugin regen touches only the 2 edited agents | Regression | Critical | High | AC-F1-7, NFR-7 |
| TC-FSPEC-001 | all 8 target spec files exist | Happy Path | Critical | High | AC-F3-1 |
| TC-FSPEC-002 | delivery-lifecycle spec coverage | Happy Path | Critical | High | AC-F3-2, NFR-1, NFR-6 |
| TC-FSPEC-003 | agents-and-commands spec coverage (model nuance) | Happy Path | Critical | High | AC-F3-3, NFR-1 |
| TC-FSPEC-004 | decision-making spec coverage + cross-link | Happy Path | Important | Medium | AC-F3-4, NFR-1, NFR-2 |
| TC-FSPEC-005 | claude-plugin-generation spec coverage | Happy Path | Important | Medium | AC-F3-5, NFR-1 |
| TC-FSPEC-006 | quality-gates-and-pr spec coverage | Happy Path | Important | Medium | AC-F3-6, NFR-1 |
| TC-FSPEC-007 | doc-distribution-marker spec coverage + cross-links | Happy Path | Important | Medium | AC-F3-7, NFR-1 |
| TC-FSPEC-008 | local-code-review spec coverage + cross-link | Happy Path | Important | Medium | AC-F3-8, NFR-1, NFR-2 |
| TC-FSPEC-009 | external-researcher spec coverage | Happy Path | Important | Medium | AC-F3-9, NFR-1 |
| TC-HYGIENE-001 | canonical rules cross-linked, not restated | Negative | Critical | High | AC-F4-1, NFR-2 |
| TC-HYGIENE-002 | prompt-wins + follow-up note on Draft discrepancies | Corner Case | Important | Medium | AC-F4-2 |
| TC-HYGIENE-003 | each new spec carries `ados_distribution: internal` | Happy Path | Critical | High | AC-F5-1, NFR-3 |
| TC-HYGIENE-004 | headers via script, none hand-added (idempotent) | Regression | Critical | High | AC-F5-2, NFR-4 |
| TC-HYGIENE-005 | marker honesty — no `redistributable` on new specs | Negative | Critical | High | AC-F5-1, NFR-3 |
| TC-HYGIENE-006 | 11-phase accuracy — no stale "10-phase"; doc-syncer phase 7 | Negative | Critical | High | NFR-6, AC-F3-2 |
| TC-HYGIENE-007 | specs read as authoritative, not idealized (manual) | Manual | Important | Medium | F-4, NFR-1 |
| TC-REGRESS-001 | GH-67 distribution guard stays green | Regression | Critical | High | NFR-3 (no break) |
| TC-REGRESS-002 | all repo `test-*.sh` stay green | Regression | Critical | High | (regression) |
| TC-REGRESS-003 | `git diff --check` clean | Regression | Important | Medium | (static guard) |

### 5.2 Scenario Details

#### TC-COVRGATE-001 - doc-syncer Identify Impact has feature-spec-coverage sub-check + report field

**Scenario Type**: Happy Path
**Impact Level**: Critical
**Priority**: High
**Related IDs**: F-1, AC-F1-1, DM-2
**Test Type(s)**: Manual (content)
**Automation Level**: Semi-automated
**Target Layer / Location**: `.opencode/agent/doc-syncer.md` (Identify Impact step)
**Tags**: @process, @doc-syncer, @gate

**Preconditions**:

- Part A delivery is complete (`.opencode/agent/doc-syncer.md` edited).
- Checks run from repo root with `rg` available.

**Steps**:

1. Assert the explicit sub-check label exists:
   `rg -n -i "feature spec coverage" .opencode/agent/doc-syncer.md` → ≥1 match.
2. Assert the report field exists (DM-2):
   `rg -n "spec_coverage_gaps" .opencode/agent/doc-syncer.md` → ≥1 match.
3. Assert the prompt looks for a spec under `doc/spec/features/`:
   `rg -n "doc/spec/features" .opencode/agent/doc-syncer.md` → ≥1 match.
4. Assert the `feature-<slug>.md` lookup pattern is referenced:
   `rg -n 'feature-' .opencode/agent/doc-syncer.md` → ≥1 match in the coverage-check context.

**Expected Outcome**:

- All four greps return ≥1 match; the Identify Impact step names a "feature spec coverage" sub-check, emits a `spec_coverage_gaps` structured-report field, and instructs looking for `doc/spec/features/feature-<slug>.md`.

**Notes / Clarifications**:

- The recommended grep-able anchor phrases the author SHOULD include: `feature spec coverage`, `spec_coverage_gaps`, and `doc/spec/features/feature-`. Exact wording is at author discretion; the four greps above must pass regardless of phrasing chosen.

---

#### TC-COVRGATE-002 - doc-syncer reports, never creates a spec or ticket

**Scenario Type**: Negative
**Impact Level**: Critical
**Priority**: High
**Related IDs**: F-1, AC-F1-2, DEC-6
**Test Type(s)**: Manual (content)
**Automation Level**: Semi-automated
**Target Layer / Location**: `.opencode/agent/doc-syncer.md` (handoff rule)
**Tags**: @process, @doc-syncer, @handoff

**Preconditions**:

- Part A delivery is complete.

**Steps**:

1. Assert doc-syncer's reporting-only posture (no ticket/spec creation):
   `rg -n -i -e "report" -e "reports" .opencode/agent/doc-syncer.md` → ≥1 match (reporting language present).
2. Assert the explicit prohibition on creating tickets:
   `rg -n -i -e "never create.*ticket" -e "does not create.*ticket" -e "must not create.*ticket" -e "report[^.]*ticket" .opencode/agent/doc-syncer.md` → ≥1 match capturing the "reports, does not ticket" rule.
3. Assert the proposal/approval split (PM proposes, human approves):
   `rg -n -i -e "pm.*propos" -e "propos.*follow-up" -e "human.*approv" -e "only.*human" .opencode/agent/doc-syncer.md` → ≥1 match (the handoff may be described in doc-syncer or solely in pm.md; this case passes if the handoff rule appears in doc-syncer, otherwise TC-COVRGATE-003/004 cover the pm.md side).

**Expected Outcome**:

- doc-syncer's text states it **reports** the gap and does **not** create a spec or ticket; ticket creation is gated on human approval (proposed by PM).

**Notes / Clarifications**:

- If the handoff rule is centralized only in `pm.md`, step 3 may be 0 matches in doc-syncer — that is acceptable as long as TC-COVRGATE-003 + TC-COVRGATE-004 establish the full PM-side handoff. Record which file holds each clause.

---

#### TC-COVRGATE-003 - PM de-noises the proposed follow-up (no duplicate tracker)

**Scenario Type**: Corner Case
**Impact Level**: Important
**Priority**: Medium
**Related IDs**: F-1, AC-F1-3, DEC-6
**Test Type(s)**: Manual (content)
**Automation Level**: Semi-automated
**Target Layer / Location**: `.opencode/agent/{doc-syncer,pm}.md`
**Tags**: @process, @pm, @handoff

**Preconditions**:

- Part A delivery is complete.

**Steps**:

1. Assert de-noising / existing-tracker-reference language across the two prompts:
   `rg -n -i -e "de-nois" -e "existing (issue|tracker|ticket)" -e "duplicate" -e "open issues" .opencode/agent/doc-syncer.md .opencode/agent/pm.md` → ≥1 match (combined).
2. Manual: confirm the de-noising rule is coherent — `@pm` checks open issues for an existing tracker (e.g., GH-79, GH-77) and references it rather than proposing a duplicate.

**Expected Outcome**:

- At least one prompt describes the de-noising step (check open trackers before proposing a new follow-up); manual review confirms the rule is unambiguous.

---

#### TC-COVRGATE-004 - pm.md clarify_scope is coverage-aware

**Scenario Type**: Happy Path
**Impact Level**: Critical
**Priority**: High
**Related IDs**: F-1, AC-F1-4
**Test Type(s)**: Manual (content)
**Automation Level**: Semi-automated
**Target Layer / Location**: `.opencode/agent/pm.md` (clarify_scope, step 3b)
**Tags**: @process, @pm, @intake

**Preconditions**:

- Part A delivery is complete.

**Steps**:

1. Assert coverage-awareness language exists in pm.md:
   `rg -n -i -e "spec coverage" -e "feature spec" -e "coverage gap" -e "has a spec" -e "no spec" .opencode/agent/pm.md` → ≥1 match.
2. (Optional) If `doc/guides/definition-of-now.md`/`definition-of-ready.md` was lightly edited for intake awareness, assert the same language appears there too — not a hard AC.

**Expected Outcome**:

- `pm.md` clarify_scope mentions verifying/awareness of feature-spec coverage for touched areas (records the gap; not a delivery blocker).

---

#### TC-COVRGATE-005 - change-lifecycle.md §7 documents the coverage check

**Scenario Type**: Happy Path
**Impact Level**: Important
**Priority**: Medium
**Related IDs**: F-1, AC-F1-5, NFR-6
**Test Type(s)**: Manual (content)
**Automation Level**: Semi-automated
**Target Layer / Location**: `doc/guides/change-lifecycle.md` (§7 system_spec_update)
**Tags**: @docs, @lifecycle

**Preconditions**:

- Part A delivery is complete.

**Steps**:

1. Assert the guide documents the check:
   `rg -n -i -e "spec coverage" -e "feature spec coverage" -e "spec_coverage_gaps" doc/guides/change-lifecycle.md` → ≥1 match.
2. Assert the matching section is system_spec_update (phase 7):
   `rg -n -i -e "system_spec_update" -e "phase 7" doc/guides/change-lifecycle.md` → ≥1 match, and the coverage-check match from step 1 falls at/after the phase-7 heading (manual confirmation).
3. Assert the guide states the **11**-phase model (NFR-6, cross-cuts with TC-HYGIENE-006):
   `rg -n -i "11-phase\|11 phase\|eleven-phase\|11\b.*phase" doc/guides/change-lifecycle.md` → ≥1 match; and `rg -n "10-phase" doc/guides/change-lifecycle.md` → 0 matches.

**Expected Outcome**:

- §7 system_spec_update documents the feature-spec-coverage check; the lifecycle count is 11 with doc-syncer at phase 7; no stale "10-phase" phrasing.

---

#### TC-COVRGATE-006 - "feature area" operationally defined and falsifiable

**Scenario Type**: Corner Case
**Impact Level**: Important
**Priority**: Medium
**Related IDs**: F-2, DM-1, AC-F1-6, NFR-5, DEC-5
**Test Type(s)**: Manual (content + reasoning)
**Automation Level**: Semi-automated
**Target Layer / Location**: `doc/guides/change-lifecycle.md`, `.opencode/agent/doc-syncer.md`, `.opencode/agent/pm.md`
**Tags**: @process, @gate, @falsifiability

**Preconditions**:

- Part A delivery is complete.

**Steps**:

1. Assert an operational definition exists somewhere in the Part A surface:
   `rg -n -i -e "feature area" -e "feature-<slug>" -e "warrants a" -e "warrants .feature-" doc/guides/change-lifecycle.md .opencode/agent/doc-syncer.md .opencode/agent/pm.md` → ≥1 match defining "feature area" as a capability that warrants a `doc/spec/features/feature-<slug>.md`.
2. **Manual falsifiability probe:** the reviewer names a real modified feature area (e.g., "the delivery lifecycle", "code review") and confirms whether a spec exists — the check must produce a determinate yes/no for any named area, not a subjective judgement.

**Expected Outcome**:

- The definition is operational (tied to the existence of a `feature-<slug>.md`); the reviewer can falsify any F-1 invocation by naming the area and confirming spec presence/absence.

**Notes / Clarifications**:

- This is the NFR-5 falsifiability gate; the manual probe is the core evidence — grep only confirms the definition is present.

---

#### TC-PLUGIN-001 - plugin regeneration touches only the two edited agents

**Scenario Type**: Regression
**Impact Level**: Critical
**Priority**: High
**Related IDs**: F-1, AC-F1-7, NFR-7
**Test Type(s)**: Integration (build invariant)
**Automation Level**: Automated
**Target Layer / Location**: `scripts/build-claude-plugin.sh` → `.ados-claude/`
**Tags**: @plugin, @ci, @regression

**Preconditions**:

- Part A delivery is complete; `.ados-claude/` was regenerated and committed as part of this change.
- The baseline `.ados-claude/` (HEAD) is itself current (deterministic build output).
- Verify generated-path mapping by reading `scripts/build-claude-plugin.sh`: agents write to `.ados-claude/agents/<name>.md` (singular `agents/`); commands/skills write to `.ados-claude/skills/<name>/SKILL.md`. Editing `.opencode/agent/{doc-syncer,pm}.md` therefore affects exactly `.ados-claude/agents/doc-syncer.md` and `.ados-claude/agents/pm.md`.

**Steps**:

1. Capture current generated state:
   `git status --short -- .ados-claude/` → clean (committed baseline).
2. Re-run the generator:
   `scripts/build-claude-plugin.sh` → exits 0; reports agent/skill counts.
3. Diff the regenerated tree against HEAD:
   `git diff --stat -- .ados-claude/`
4. Assert the changed-file set is **exactly**:
   ```
   .ados-claude/agents/doc-syncer.md
   .ados-claude/agents/pm.md
   ```
   (no other `.ados-claude/agents/*`, no `.ados-claude/skills/**`, no `.ados-claude/.claude-plugin/plugin.json`).
5. Confirm the 1:1 invariant: `git diff --name-only -- .opencode/` lists `agent/doc-syncer.md` and `agent/pm.md` only — the `.ados-claude/` diff must equal this set under the `agents/<name>.md` mapping.

**Expected Outcome**:

- The diff-stat lists precisely the two edited agents; nothing else in `.ados-claude/` changed. This proves the build is deterministic and the regenerate-iff-`.opencode/`-edited invariant (NFR-7) holds.

**Notes / Clarifications**:

- If `git diff --stat` shows additional files, either (a) the baseline `.ados-claude/` was stale before this change (must be fixed first), or (b) the build became non-deterministic. Both are release blockers.

---

#### TC-FSPEC-001 - all 8 target feature spec files exist

**Scenario Type**: Happy Path
**Impact Level**: Critical
**Priority**: High
**Related IDs**: F-3, AC-F3-1
**Test Type(s)**: Manual (existence)
**Automation Level**: Automated
**Target Layer / Location**: `doc/spec/features/`
**Tags**: @docs, @specs

**Preconditions**:

- Part B delivery is complete.

**Steps**:

1. Assert each of the 8 target files exists (exact names from spec §5.1):
   ```bash
   for f in \
     feature-delivery-lifecycle \
     feature-agents-and-commands \
     feature-decision-making \
     feature-claude-plugin-generation \
     feature-quality-gates-and-pr \
     feature-doc-distribution-marker \
     feature-local-code-review \
     feature-external-researcher ; do
       test -f "doc/spec/features/$f.md" && echo "OK $f" || echo "MISSING $f"
   done
   ```
   → 8 × `OK`, 0 × `MISSING`.
2. Assert the directory now holds the expected 16 (8 existing + 8 new):
   `ls doc/spec/features/feature-*.md | wc -l` → ≥16 (exactly 16 unless other changes added more).

**Expected Outcome**:

- All 8 new files present; total feature-spec count is 16 (Appendix A).

---

#### TC-FSPEC-002 - feature-delivery-lifecycle.md covers 11-phase workflow + PM orchestration + reopening + DoR/DoD + cites source

**Scenario Type**: Happy Path
**Impact Level**: Critical
**Priority**: High
**Related IDs**: F-3.1, AC-F3-2, NFR-1, NFR-6
**Test Type(s)**: Manual (content)
**Automation Level**: Semi-automated
**Target Layer / Location**: `doc/spec/features/feature-delivery-lifecycle.md`
**Tags**: @docs, @specs, @lifecycle

**Preconditions**:

- `doc/spec/features/feature-delivery-lifecycle.md` exists (TC-FSPEC-001).

**Steps**:

1. Assert 11-phase coverage (NFR-6):
   `rg -n -i "11-phase|11 phase|eleven-phase|11\b.*phase" doc/spec/features/feature-delivery-lifecycle.md` → ≥1 match.
2. Assert PM orchestration:
   `rg -n -i -e "@pm" -e "PM orchestrat" -e "clarify_scope" -e "autopilot" doc/spec/features/feature-delivery-lifecycle.md` → ≥1 match.
3. Assert phase reopening:
   `rg -n -i -e "reopen" -e "reopening" doc/spec/features/feature-delivery-lifecycle.md` → ≥1 match.
4. Assert DoR/DoD gating:
   `rg -n -i -e "DoR|Definition of Ready" -e "DoD|Definition of Done" -e "dor_check" -e "dod_check" doc/spec/features/feature-delivery-lifecycle.md` → ≥1 match.
5. Assert authoritative source citation (NFR-1):
   `rg -n -i -e "AGENTS.md" -e "change-lifecycle" -e ".opencode/agent/" doc/spec/features/feature-delivery-lifecycle.md` → ≥1 match.

**Expected Outcome**:

- The spec covers the 11-phase workflow, PM orchestration, phase reopening, DoR/DoD gating, and cites ≥1 source from the F-3.1 source map.

---

#### TC-FSPEC-003 - feature-agents-and-commands.md states model-config nuance + references toolsmith

**Scenario Type**: Happy Path
**Impact Level**: Critical
**Priority**: High
**Related IDs**: F-3.2, AC-F3-3, NFR-1
**Test Type(s)**: Manual (content)
**Automation Level**: Semi-automated
**Target Layer / Location**: `doc/spec/features/feature-agents-and-commands.md`
**Tags**: @docs, @specs, @agents

**Preconditions**:

- `doc/spec/features/feature-agents-and-commands.md` exists (TC-FSPEC-001).

**Steps**:

1. Assert the `claude.model` Claude-Code-hint half of the nuance:
   `rg -n "claude\.model" doc/spec/features/feature-agents-and-commands.md` → ≥1 match.
2. Assert the build-script consumption:
   `rg -n -i -e "build-claude-plugin" -e "Claude-Code hint" -e "Claude Code.*hint" doc/spec/features/feature-agents-and-commands.md` → ≥1 match.
3. Assert the OpenCode-effective `opencode*.jsonc` half:
   `rg -n -i -e "opencode\*\.jsonc" -e "opencode.jsonc" -e "OpenCode-effective" doc/spec/features/feature-agents-and-commands.md` → ≥1 match.
4. Assert the two are presented as **independent** concerns (no conflation): manual confirmation that the spec does not state "claude.model sets the OpenCode model".
5. Assert toolsmith reference:
   `rg -n -i "toolsmith" doc/spec/features/feature-agents-and-commands.md` → ≥1 match.

**Expected Outcome**:

- The model-configuration nuance is stated precisely (F-3.2 note): `claude.model` is a Claude-Code-targeted hint consumed by `scripts/build-claude-plugin.sh`; the OpenCode-effective assignment lives in `opencode*.jsonc`; the two are independent. `@toolsmith` is referenced.

---

#### TC-FSPEC-004 - feature-decision-making.md covers process/framework + cross-links decision-records

**Scenario Type**: Happy Path
**Impact Level**: Important
**Priority**: Medium
**Related IDs**: F-3.3, AC-F3-4, NFR-1, NFR-2
**Test Type(s)**: Manual (content + cross-link)
**Automation Level**: Semi-automated
**Target Layer / Location**: `doc/spec/features/feature-decision-making.md`
**Tags**: @docs, @specs, @decisions

**Preconditions**:

- `doc/spec/features/feature-decision-making.md` exists (TC-FSPEC-001).

**Steps**:

1. Assert process/framework coverage (not just records):
   `rg -n -i -e "rigor" -e "decision kernel" -e "classification" -e "decision mode" -e "AI-authority" doc/spec/features/feature-decision-making.md` → ≥1 match.
2. Assert cross-link to the records spec:
   `rg -n "feature-decision-records\.md" doc/spec/features/feature-decision-making.md` → ≥1 match.
3. Assert non-duplication (the records content is named/linked, not restated): manual confirmation the spec does not re-list the ADR/PDR/TDR/BDR/ODR record-type definitions verbatim.

**Expected Outcome**:

- The spec covers the decision-making process/framework and cross-links (does not duplicate) `feature-decision-records.md`.

---

#### TC-FSPEC-005 - feature-claude-plugin-generation.md covers gen/SSOT/idempotency/CI gate + cites build script

**Scenario Type**: Happy Path
**Impact Level**: Important
**Priority**: Medium
**Related IDs**: F-3.4, AC-F3-5, NFR-1
**Test Type(s)**: Manual (content)
**Automation Level**: Semi-automated
**Target Layer / Location**: `doc/spec/features/feature-claude-plugin-generation.md`
**Tags**: @docs, @specs, @plugin

**Preconditions**:

- `doc/spec/features/feature-claude-plugin-generation.md` exists (TC-FSPEC-001).

**Steps**:

1. Assert build-script citation:
   `rg -n "build-claude-plugin\.sh" doc/spec/features/feature-claude-plugin-generation.md` → ≥1 match.
2. Assert single-source-of-truth language:
   `rg -n -i -e "single source of truth" -e "source of truth" doc/spec/features/feature-claude-plugin-generation.md` → ≥1 match.
3. Assert idempotency:
   `rg -n -i "idempoten" doc/spec/features/feature-claude-plugin-generation.md` → ≥1 match.
4. Assert CI freshness gate:
   `rg -n -i -e "freshness" -e "CI" -e "stale" doc/spec/features/feature-claude-plugin-generation.md` → ≥1 match.

**Expected Outcome**:

- The spec covers `.opencode/`→`.ados-claude/` generation, single source of truth, idempotency, and the CI freshness gate, citing `scripts/build-claude-plugin.sh`.

---

#### TC-FSPEC-006 - feature-quality-gates-and-pr.md covers check/check-fix + commit/PR + roles

**Scenario Type**: Happy Path
**Impact Level**: Important
**Priority**: Medium
**Related IDs**: F-3.5, AC-F3-6, NFR-1
**Test Type(s)**: Manual (content)
**Automation Level**: Semi-automated
**Target Layer / Location**: `doc/spec/features/feature-quality-gates-and-pr.md`
**Tags**: @docs, @specs, @quality

**Preconditions**:

- `doc/spec/features/feature-quality-gates-and-pr.md` exists (TC-FSPEC-001).

**Steps**:

1. Assert quality-gate commands:
   `rg -n -e "/check\b" -e "/check-fix" doc/spec/features/feature-quality-gates-and-pr.md` → ≥1 match (ideally both).
2. Assert commit + PR workflow:
   `rg -n -i -e "/commit\b" -e "/pr\b" -e "commit workflow" -e "PR workflow" doc/spec/features/feature-quality-gates-and-pr.md` → ≥1 match.
3. Assert role coverage:
   `rg -n -i -e "runner" -e "fixer" -e "committer" -e "pr-manager" doc/spec/features/feature-quality-gates-and-pr.md` → ≥1 match (ideally all four).

**Expected Outcome**:

- The spec covers `/check`, `/check-fix`, the commit + PR workflow, and the runner/fixer/committer/pr-manager roles.

---

#### TC-FSPEC-007 - feature-doc-distribution-marker.md covers marker system + cites ODR-0001/guard + cross-links GH-67/GH-77-TBD

**Scenario Type**: Happy Path
**Impact Level**: Important
**Priority**: Medium
**Related IDs**: F-3.6, AC-F3-7, NFR-1
**Test Type(s)**: Manual (content + cross-link)
**Automation Level**: Semi-automated
**Target Layer / Location**: `doc/spec/features/feature-doc-distribution-marker.md`
**Tags**: @docs, @specs, @marker

**Preconditions**:

- `doc/spec/features/feature-doc-distribution-marker.md` exists (TC-FSPEC-001).

**Steps**:

1. Assert marker values:
   `rg -n -i -e "redistributable" -e "internal" -e "project-generated" doc/spec/features/feature-doc-distribution-marker.md` → ≥1 match (ideally all three as the value set).
2. Assert two-path parser:
   `rg -n -i -e "two-path" -e "two path" -e "parser" doc/spec/features/feature-doc-distribution-marker.md` → ≥1 match.
3. Assert derived install set:
   `rg -n -i -e "install set" -e "derived" doc/spec/features/feature-doc-distribution-marker.md` → ≥1 match.
4. Assert 5-mode drift guard:
   `rg -n -i -e "5-mode" -e "five-mode" -e "drift guard" -e "guard" doc/spec/features/feature-doc-distribution-marker.md` → ≥1 match.
5. Assert DM-2 scope:
   `rg -n -i "DM-2" doc/spec/features/feature-doc-distribution-marker.md` → ≥1 match.
6. Assert ODR-0001 + guard citation:
   `rg -n "ODR-0001" doc/spec/features/feature-doc-distribution-marker.md` → ≥1 match;
   `rg -n "test-doc-distribution" doc/spec/features/feature-doc-distribution-marker.md` → ≥1 match.
7. Assert GH-67 cross-link and GH-77-TBD:
   `rg -n "GH-67" doc/spec/features/feature-doc-distribution-marker.md` → ≥1 match;
   `rg -n -i -e "GH-77" -e "out of scope" -e "TBD" doc/spec/features/feature-doc-distribution-marker.md` → ≥1 match.

**Expected Outcome**:

- The spec covers marker values, two-path parser, derived install set, 5-mode guard, and DM-2 scope; cites ODR-0001 and the guard; cross-links GH-67 and marks GH-77 TBD/out-of-scope.

---

#### TC-FSPEC-008 - feature-local-code-review.md covers review/review-deep + heuristics + remediation append + cross-links remote

**Scenario Type**: Happy Path
**Impact Level**: Important
**Priority**: Medium
**Related IDs**: F-3.7, AC-F3-8, NFR-1, NFR-2, DEC-7
**Test Type(s)**: Manual (content + cross-link)
**Automation Level**: Semi-automated
**Target Layer / Location**: `doc/spec/features/feature-local-code-review.md`
**Tags**: @docs, @specs, @review

**Preconditions**:

- `doc/spec/features/feature-local-code-review.md` exists (TC-FSPEC-001).

**Steps**:

1. Assert command coverage:
   `rg -n -e "/review\b" -e "/review-deep" doc/spec/features/feature-local-code-review.md` → ≥1 match (ideally both).
2. Assert spec/plan compliance + heuristics:
   `rg -n -i -e "heuristic" -e "spec compliance" -e "plan compliance" -e "code quality" doc/spec/features/feature-local-code-review.md` → ≥1 match.
3. Assert remediation-phase append:
   `rg -n -i -e "remediation" -e "review_fix" -e "phase 8" -e "append" doc/spec/features/feature-local-code-review.md` → ≥1 match.
4. Assert cross-link to the remote spec (companion, not duplicate — DEC-7):
   `rg -n "feature-remote-code-review\.md" doc/spec/features/feature-local-code-review.md` → ≥1 match.

**Expected Outcome**:

- The spec covers `/review`, `/review-deep`, spec/plan compliance + heuristics, the remediation-phase append, and cross-links (does not duplicate) `feature-remote-code-review.md`.

---

#### TC-FSPEC-009 - feature-external-researcher.md covers MCP routing + untrusted content + output contract + cites agent

**Scenario Type**: Happy Path
**Impact Level**: Important
**Priority**: Medium
**Related IDs**: F-3.8, AC-F3-9, NFR-1
**Test Type(s)**: Manual (content)
**Automation Level**: Semi-automated
**Target Layer / Location**: `doc/spec/features/feature-external-researcher.md`
**Tags**: @docs, @specs, @research

**Preconditions**:

- `doc/spec/features/feature-external-researcher.md` exists (TC-FSPEC-001).

**Steps**:

1. Assert MCP tool routing (at least one named provider):
   `rg -n -i -e "context7" -e "deepwiki" -e "perplexity" -e "web-search" doc/spec/features/feature-external-researcher.md` → ≥1 match.
2. Assert untrusted-content handling:
   `rg -n -i -e "untrusted" -e "trust" -e "verif" doc/spec/features/feature-external-researcher.md` → ≥1 match.
3. Assert output contract:
   `rg -n -i -e "output" -e "process" -e "result" doc/spec/features/feature-external-researcher.md` → ≥1 match.
4. Assert authoritative agent citation:
   `rg -n "external-researcher\.md" doc/spec/features/feature-external-researcher.md` → ≥1 match (or a reference to `.opencode/agent/external-researcher.md`).

**Expected Outcome**:

- The spec covers MCP tool routing, untrusted-content handling, and the output contract, citing `.opencode/agent/external-researcher.md`.

---

#### TC-HYGIENE-001 - canonical lifecycle/convention/decision-record rules are cross-linked, not restated

**Scenario Type**: Negative
**Impact Level**: Critical
**Priority**: High
**Related IDs**: F-4, AC-F4-1, NFR-2, DEC-3
**Test Type(s)**: Manual (negative content)
**Automation Level**: Semi-automated
**Target Layer / Location**: the 8 new specs in `doc/spec/features/`
**Tags**: @docs, @hygiene, @cross-link

**Preconditions**:

- The 8 new specs exist (TC-FSPEC-001).

**Steps**:

1. Define the new-specs glob:
   `NEW="doc/spec/features/feature-{delivery-lifecycle,agents-and-commands,decision-making,claude-plugin-generation,quality-gates-and-pr,doc-distribution-marker,local-code-review,external-researcher}.md"`
2. Assert no restated **branch-naming** convention (the canonical pattern lives in `change-lifecycle.md` / the unified-convention guide):
   `rg -n -e "feat/<workItemRef>" -e "<type>/<workItemRef>/<slug>" -e "<changeType>/<workItemRef>" $NEW` → 0 matches.
3. Assert no restated **change-folder** convention:
   `rg -n "doc/changes/YYYY-MM" $NEW` → 0 matches.
4. Assert no restated **phase-enumeration** table (cross-link instead — the delivery-lifecycle spec may summarize "11 phases" but should not re-enumerate all 11 phases as a standalone table duplicating AGENTS.md; manual confirmation).
5. Assert each spec **does** link/names a canonical source (positive cross-link evidence):
   `rg -n -i -e "change-lifecycle" -e "AGENTS.md" -e "unified-change-convention" -e "feature-decision-records" -e "feature-remote-code-review" $NEW` → ≥1 match per spec (manual per-spec check).

**Expected Outcome**:

- 0 restated branch/folder/phase rules; every spec cross-links (names + links) its canonical source instead of restating it.

**Notes / Clarifications**:

- Step 4 (phase-enumeration) is judgment-based; the reviewer confirms the delivery-lifecycle spec points to AGENTS.md/change-lifecycle.md for the full table rather than duplicating it.

---

#### TC-HYGIENE-002 - prompt-wins + follow-up note on Draft-guide discrepancies

**Scenario Type**: Corner Case
**Impact Level**: Important
**Priority**: Medium
**Related IDs**: F-4, AC-F4-2
**Test Type(s)**: Manual (content + reasoning)
**Automation Level**: Semi-automated
**Target Layer / Location**: the 8 new specs in `doc/spec/features/`
**Tags**: @docs, @hygiene, @accuracy

**Preconditions**:

- The 8 new specs exist (TC-FSPEC-001).

**Steps**:

1. Assert follow-up / discrepancy-note language exists where a `status: Draft` guide is cited:
   `rg -n -i -e "follow-up" -e "prompt wins" -e "status: Draft" -e "discrepanc" -e "diverg" $NEW` → ≥1 match across the new specs (not every spec need have one, but the set should surface flagged discrepancies).
2. **Manual:** confirm that where a cited guide (e.g., `change-lifecycle.md`, `definition-of-ready.md`, `decision-making.md`) disagrees with a prompt, the spec follows the prompt and records the discrepancy as a follow-up note rather than silently choosing one. (Concrete expected discrepancy: the GH-79 ticket's stale "10-phase / phase-6 doc-syncer" phrasing → specs use 11 phases per DEC-4 — see TC-HYGIENE-006.)

**Expected Outcome**:

- Discrepancies are surfaced as follow-up notes; the prompt is treated as truth on conflict.

---

#### TC-HYGIENE-003 - each of the 8 new specs carries `ados_distribution: internal`

**Scenario Type**: Happy Path
**Impact Level**: Critical
**Priority**: High
**Related IDs**: F-5, AC-F5-1, NFR-3, DEC-2
**Test Type(s)**: Manual (content)
**Automation Level**: Automated
**Target Layer / Location**: the 8 new specs in `doc/spec/features/`
**Tags**: @docs, @hygiene, @marker

**Preconditions**:

- The 8 new specs exist (TC-FSPEC-001).

**Steps**:

1. Assert each spec declares the marker at top-level of its YAML frontmatter:
   ```bash
   for f in feature-delivery-lifecycle feature-agents-and-commands feature-decision-making \
            feature-claude-plugin-generation feature-quality-gates-and-pr \
            feature-doc-distribution-marker feature-local-code-review feature-external-researcher ; do
       echo "== $f =="
       rg -n "^ados_distribution: internal" "doc/spec/features/$f.md" || echo "MISSING internal on $f"
   done
   ```
   → 8 × match, 0 × `MISSING`.
2. Confirm the marker lives inside the single frontmatter block (not a second `---` doc) so `yaml.safe_load()` consumers stay valid — manual spot-check.

**Expected Outcome**:

- All 8 new specs carry `ados_distribution: internal` in frontmatter.

**Notes / Clarifications**:

- `internal` is the honest value: feature-spec content is not redistributed (`install.sh` creates only an empty `doc/spec/features/` stub), so `redistributable` would be a false claim (DEC-2). The complementary "no `redistributable`" check is TC-HYGIENE-005.

---

#### TC-HYGIENE-004 - headers applied via the script, none hand-added (idempotent)

**Scenario Type**: Regression
**Impact Level**: Critical
**Priority**: High
**Related IDs**: F-5, AC-F5-2, NFR-4, DEC-8
**Test Type(s)**: Integration (header invariant)
**Automation Level**: Automated
**Target Layer / Location**: `scripts/add-header-location.sh` → the 8 new specs
**Tags**: @docs, @hygiene, @headers

**Preconditions**:

- The 8 new specs exist and were headed via `scripts/add-header-location.sh <explicit-file>`.
- Reference header format (from `feature-license-header-script.md`): a 3-line block embedded in YAML frontmatter —
  `# Copyright (c) 2025-2026 Juliusz Ćwiąkalski (...)` / `# MIT License - see LICENSE file for full terms` / `source: https://github.com/juliusz-cwiakalski/agentic-delivery-os/blob/main/<path>`.

**Steps**:

1. Assert the script-format header is present (exactly once) in each new spec:
   ```bash
   for f in feature-delivery-lifecycle feature-agents-and-commands feature-decision-making \
            feature-claude-plugin-generation feature-quality-gates-and-pr \
            feature-doc-distribution-marker feature-local-code-review feature-external-researcher ; do
       c=$(rg -c "^# Copyright \(c\) 2025-2026 Juliusz" "doc/spec/features/$f.md")
       [ "$c" -eq 1 ] && echo "OK $f" || echo "BAD($c) $f"
   done
   ```
   → 8 × `OK`.
2. Assert the `source:` line points at the correct path (script-derived, not hand-typed):
   `rg -n "^source: https://github.com/juliusz-cwiakalski/agentic-delivery-os/blob/main/doc/spec/features/" $NEW` → ≥8 matches (one per spec, correct path).
3. Assert idempotency — re-running the script produces **no** diff:
   ```bash
   for f in feature-delivery-lifecycle feature-agents-and-commands feature-decision-making \
            feature-claude-plugin-generation feature-quality-gates-and-pr \
            feature-doc-distribution-marker feature-local-code-review feature-external-researcher ; do
       scripts/add-header-location.sh "doc/spec/features/$f.md" >/dev/null 2>&1
   done
   git diff --stat -- doc/spec/features/
   ```
   → empty diff (the script is idempotent; AI did not hand-add or hand-edit a header).

**Expected Outcome**:

- Each new spec has exactly one script-format header with the correct `source:` URL; re-running the script changes nothing (proves the header was script-applied, not hand-added).

**Notes / Clarifications**:

- A non-empty diff in step 3 means either a hand-edited header or a format drift — both violate NFR-4 / DEC-8 and are release blockers.

---

#### TC-HYGIENE-005 - marker honesty — no new spec claims `redistributable`

**Scenario Type**: Negative
**Impact Level**: Critical
**Priority**: High
**Related IDs**: F-5, AC-F5-1, NFR-3, DEC-2
**Test Type(s)**: Manual (negative content)
**Automation Level**: Automated
**Target Layer / Location**: the 8 new specs in `doc/spec/features/`
**Tags**: @docs, @hygiene, @marker

**Preconditions**:

- The 8 new specs exist (TC-FSPEC-001).

**Steps**:

1. Assert none of the 8 new specs carries `redistributable` as its own marker:
   ```bash
   rg -n "^ados_distribution: redistributable" \
     doc/spec/features/feature-delivery-lifecycle.md \
     doc/spec/features/feature-agents-and-commands.md \
     doc/spec/features/feature-decision-making.md \
     doc/spec/features/feature-claude-plugin-generation.md \
     doc/spec/features/feature-quality-gates-and-pr.md \
     doc/spec/features/feature-doc-distribution-marker.md \
     doc/spec/features/feature-local-code-review.md \
     doc/spec/features/feature-external-researcher.md
   ```
   → 0 matches (exit code 1).
2. (Note: `feature-doc-distribution-marker.md` legitimately *mentions* the word `redistributable` when documenting the value set — that is in body prose, not as the spec's own `ados_distribution:` value. Step 1 anchors on `^ados_distribution: redistributable`, so body mentions do not trigger.)

**Expected Outcome**:

- Zero new specs declare `redistributable`; all declare `internal` (cross-check TC-HYGIENE-003).

---

#### TC-HYGIENE-006 - 11-phase accuracy — no stale "10-phase"; doc-syncer at phase 7

**Scenario Type**: Negative
**Impact Level**: Critical
**Priority**: High
**Related IDs**: NFR-6, AC-F3-2, DEC-4
**Test Type(s)**: Manual (negative + positive content)
**Automation Level**: Automated
**Target Layer / Location**: the 8 new specs (scoped) + `doc/guides/change-lifecycle.md`
**Tags**: @docs, @hygiene, @lifecycle

**Preconditions**:

- The 8 new specs exist (TC-FSPEC-001).

**Steps**:

1. Assert no new spec contains the stale phrasing (scoped to the 8 new files only — old change artifacts legitimately retain historical "10-phase" text and are out of scope):
   ```bash
   rg -n -e "10-phase" -e "phase 6 doc-syncer" -e "phases 8 \+ 9-10" \
     doc/spec/features/feature-delivery-lifecycle.md \
     doc/spec/features/feature-agents-and-commands.md \
     doc/spec/features/feature-decision-making.md \
     doc/spec/features/feature-claude-plugin-generation.md \
     doc/spec/features/feature-quality-gates-and-pr.md \
     doc/spec/features/feature-doc-distribution-marker.md \
     doc/spec/features/feature-local-code-review.md \
     doc/spec/features/feature-external-researcher.md
   ```
   → 0 matches.
2. Assert the delivery-lifecycle spec places doc-syncer/system_spec_update at phase 7:
   `rg -n -i -e "phase 7" -e "system_spec_update" doc/spec/features/feature-delivery-lifecycle.md` → ≥1 match.
3. Assert the guide is consistent (cross-check with TC-COVRGATE-005 step 3).

**Expected Outcome**:

- The new specs use the canonical 11-phase model with doc-syncer at phase 7; none repeat the ticket's stale "10-phase / phase-6 doc-syncer" phrasing.

---

#### TC-HYGIENE-007 - specs read as authoritative, not idealized (manual review)

**Scenario Type**: Manual
**Impact Level**: Important
**Priority**: Medium
**Related IDs**: F-4, NFR-1, RSK-1
**Test Type(s)**: Manual
**Automation Level**: Manual
**Target Layer / Location**: the 8 new specs vs their authoritative sources
**Tags**: @docs, @review

**Preconditions**:

- The 8 new specs exist (TC-FSPEC-001).

**Steps**:

1. For each of the 8 specs, the reviewer opens the spec alongside its authoritative source(s) from the F-3.1…F-3.8 source map and confirms behavioral claims match the **actual prompt/script/AGENTS.md** (not an idealized `status: Draft` guide).
2. Spot-check the highest-risk cases: (a) `feature-delivery-lifecycle.md` phase numbering vs `AGENTS.md` 11-phase table; (b) `feature-agents-and-commands.md` model-config nuance vs `scripts/build-claude-plugin.sh` + `opencode*.jsonc`; (c) `feature-doc-distribution-marker.md` DM-2 scope vs `scripts/.tests/test-doc-distribution.sh` scan set.

**Expected Outcome**:

- Reviewer confirms each spec is authored from actual behavior; no idealized/contradicted claims; flagged discrepancies are recorded as follow-ups (TC-HYGIENE-002).

**Notes / Clarifications**:

- This is the RSK-1 mitigation evidence; no automated grep can substitute.

---

#### TC-REGRESS-001 - GH-67 distribution guard stays green

**Scenario Type**: Regression
**Impact Level**: Critical
**Priority**: High
**Related IDs**: NFR-3 (no break), §8.5 backward compatibility
**Test Type(s)**: Integration (shell test)
**Automation Level**: Automated
**Target Layer / Location**: `scripts/.tests/test-doc-distribution.sh`
**Tags**: @regression, @marker, @ci

**Preconditions**:

- Part B delivery is complete (8 new specs added with `internal` markers under `doc/spec/**`).

**Steps**:

1. `bash scripts/.tests/test-doc-distribution.sh` → exit 0 (PASS).

**Expected Outcome**:

- The guard passes. Because `doc/spec/**` is **outside** the guard's DM-2 scan set (it scans `doc/guides`, `doc/templates/**`, and the 5 standalone docs), adding `ados_distribution: internal` to feature specs is a no-op for this test. A failure would indicate an unintended scan-set change.

**Notes / Clarifications**:

- This case explicitly asserts the **no-break** invariant (NG-4 / §8.5), not new coverage.

---

#### TC-REGRESS-002 - all repo `test-*.sh` scripts stay green

**Scenario Type**: Regression
**Impact Level**: Critical
**Priority**: High
**Related IDs**: testing-strategy §"Quality gates"
**Test Type(s)**: Integration (shell suite)
**Automation Level**: Automated
**Target Layer / Location**: `scripts/.tests/test-*.sh`, `tools/.tests/test-*.sh`
**Tags**: @regression, @ci

**Preconditions**:

- Full delivery (Parts A + B + plugin regen) is complete.

**Steps**:

1. Run all script tests:
   ```bash
   for t in scripts/.tests/test-*.sh ; do echo "== $t ==" ; bash "$t" >/tmp/$(basename "$t").log 2>&1 && echo PASS || echo "FAIL($?)"; done
   ```
   Expected set (current inventory): `test-add-header-location.sh`, `test-build-claude-plugin.sh`, `test-doc-distribution-modes.sh`, `test-doc-distribution.sh`, `test-inception-doc-consistency.sh`, `test-install-zclaude.sh`, `test-install.sh`, `test-uninstall.sh` → all PASS.
2. Run all tool tests:
   ```bash
   for t in tools/.tests/test-*.sh ; do echo "== $t ==" ; bash "$t" >/tmp/$(basename "$t").log 2>&1 && echo PASS || echo "FAIL($?)"; done
   ```
   Expected set: `test-text-to-image-e2e-providers.sh`, `test-text-to-image-e2e-suite.sh`, `test-text-to-image-integration.sh`, `test-text-to-image-performance.sh`, `test-text-to-image-unit.sh`, `test-zclaude-unit` → PASS or SKIP-with-reason for tests requiring external credentials/providers (document any SKIP).

**Expected Outcome**:

- No regression: every script test PASSes; every tool test PASSes or is explicitly documented as SKIP (e.g., missing provider API key). The documentation/process change must break none.

**Notes / Clarifications**:

- `test-build-claude-plugin.sh` is the most relevant to this change (Part A edits `.opencode/`); confirm it specifically PASSes after regen. Text-to-image E2E tests may legitimately SKIP without provider credentials — record the reason.

---

#### TC-REGRESS-003 - `git diff --check` is clean

**Scenario Type**: Regression
**Impact Level**: Important
**Priority**: Medium
**Related IDs**: testing-strategy §"Static/diff checks"
**Test Type(s)**: Static
**Automation Level**: Automated
**Target Layer / Location**: repo working tree
**Tags**: @regression, @static

**Preconditions**:

- All delivery edits are staged/committed on the branch.

**Steps**:

1. `git diff --check` (against the branch tip / merge-base as appropriate) → no whitespace errors, no conflict markers.

**Expected Outcome**:

- Clean; no trailing-whitespace or conflict-marker violations across the diff.

---

## 6. Environments and Test Data

- **Environment:** local-dev clone on branch `feat/GH-78/feature-spec-coverage-gate-and-debt`; `rg` (ripgrep) and `bash` available; `git` working tree.
- **Test data:** none generated. All assertions read repo files directly. `/tmp/*.log` outputs from TC-REGRESS-002 are ephemeral and need no cleanup beyond the test run.
- **Isolation:** no shared state; no network required except optional text-to-image provider E2E (SKIP-able). Plugin regen (TC-PLUGIN-001) mutates `.ados-claude/` but only to the committed baseline state.

## 7. Automation Plan and Implementation Mapping

| TC ID | Implementation status | Execution command | Mocking | Notes |
|-------|-----------------------|-------------------|---------|-------|
| TC-COVRGATE-001 | Manual Only (grep) | `rg -n "spec_coverage_gaps\|feature spec coverage\|doc/spec/features" .opencode/agent/doc-syncer.md` | None | Semi-automated; record match lines |
| TC-COVRGATE-002 | Manual Only (grep) | `rg -n -i "never create.*ticket\|does not create.*ticket" .opencode/agent/doc-syncer.md` | None | Pair with TC-COVRGATE-003/004 if rule is in pm.md |
| TC-COVRGATE-003 | Manual Only (grep + review) | `rg -n -i "de-nois\|existing (issue\|tracker)\|duplicate" .opencode/agent/{doc-syncer,pm}.md` | None | — |
| TC-COVRGATE-004 | Manual Only (grep) | `rg -n -i "spec coverage\|feature spec\|coverage gap" .opencode/agent/pm.md` | None | — |
| TC-COVRGATE-005 | Manual Only (grep) | `rg -n -i "spec coverage\|spec_coverage_gaps" doc/guides/change-lifecycle.md` | None | Confirm §7 placement manually |
| TC-COVRGATE-006 | Manual Only (grep + reasoning) | `rg -n -i "feature area\|feature-<slug>\|warrants" doc/guides/change-lifecycle.md .opencode/agent/{doc-syncer,pm}.md` | None | Manual falsifiability probe is core |
| TC-PLUGIN-001 | Existing – No Change (script) | `scripts/build-claude-plugin.sh && git diff --stat -- .ados-claude/` | None | Diff-stat must equal `agents/{doc-syncer,pm}.md` |
| TC-FSPEC-001 | Manual Only (existence) | `test -f doc/spec/features/feature-<name>.md` loop | None | — |
| TC-FSPEC-002…009 | Manual Only (per-spec grep) | see each scenario's steps | None | One grep-pack per spec |
| TC-HYGIENE-001 | Manual Only (negative grep) | `rg -n "feat/<workItemRef>\|doc/changes/YYYY-MM" $NEW` (expect 0) | None | Manual cross-link confirmation |
| TC-HYGIENE-002 | Manual Only (grep + review) | `rg -n -i "follow-up\|prompt wins\|status: Draft\|discrepanc" $NEW` | None | — |
| TC-HYGIENE-003 | Manual Only (grep) | per-file `rg -n "^ados_distribution: internal"` | None | 8 × match |
| TC-HYGIENE-004 | Existing – No Change (script) | `scripts/add-header-location.sh <file>` re-run + `git diff --stat` | None | Idempotency = empty diff |
| TC-HYGIENE-005 | Manual Only (negative grep) | `rg -n "^ados_distribution: redistributable" $NEW` (expect 0) | None | — |
| TC-HYGIENE-006 | Manual Only (negative + positive grep) | scoped `rg -n "10-phase\|phase 6 doc-syncer" $NEW` (expect 0) | None | Scoped to 8 new specs |
| TC-HYGIENE-007 | Manual Only | reviewer reads spec vs source | N/A | RSK-1 evidence |
| TC-REGRESS-001 | Existing – No Change | `bash scripts/.tests/test-doc-distribution.sh` | None | Must stay PASS |
| TC-REGRESS-002 | Existing – No Change | loop `bash scripts/.tests/test-*.sh` + `tools/.tests/test-*.sh` | None | Document any SKIP |
| TC-REGRESS-003 | Existing – No Change | `git diff --check` | None | — |

## 8. Risks, Assumptions, and Open Questions

### 8.1 Risks

- **RSK-T1 (grep fragility):** content checks depend on the author choosing grep-able phrasing. **Mitigation:** each TC-COVRGATE/TC-FSPEC case lists recommended anchor phrases; the case passes on any wording that satisfies the grep, and the author is told the anchors up front.
- **RSK-T2 (plugin baseline staleness):** TC-PLUGIN-001 assumes the committed `.ados-claude/` baseline is current before this change; a stale baseline would surface as extra diff files. **Mitigation:** the case treats any extra diff as a release blocker to investigate, not auto-pass.
- **RSK-T3 (marker in body vs frontmatter):** `feature-doc-distribution-marker.md` legitimately mentions `redistributable` in prose; the negative marker check anchors on `^ados_distribution: redistributable` to avoid false positives.
- **RSK-T4 (manual review backlog):** several core cases (F-4 authoring-from-behavior, NFR-5 falsifiability) are manual-only and cannot be CI-gated. **Mitigation:** record reviewer + date in the execution log; the DoR/DoD gates reference this plan.

### 8.2 Assumptions

- The 8 new specs are headed via `scripts/add-header-location.sh <explicit-file>` (idempotent) — no header automation covers `doc/spec/**` by default.
- The guard's DM-2 scan set excludes `doc/spec/**` (confirmed by reading `scripts/.tests/test-doc-distribution.sh` and spec §2.1); adding `ados_distribution: internal` there is a no-op for the guard.
- The build is deterministic (no timestamps/randomness in generated headers), so `git diff --stat` after rebuild reflects only genuinely changed sources.
- Old change artifacts (e.g., `doc/changes/2026-03/...`) legitimately retain historical "10-phase" text; the negative grep in TC-HYGIENE-006 is scoped to the 8 new specs only.

### 8.3 Open Questions

| ID | Question | Blocking? | Owner |
|----|----------|-----------|-------|
| OQ-T1 | Should any of the per-spec content checks (TC-FSPEC-002…009) be promoted into a repo CI script to prevent future drift? | No | @pm (deferred — mirrors spec OQ-1/OQ-2) |
| OQ-T2 | If `definition-of-ready.md` gets the optional lightweight edit (Part A), should it carry its own AC/check? | No | @spec-writer (currently none — covered informally via TC-COVRGATE-004) |

## 9. Plan Revision Log

| Version | Date | Author | Changes |
|---------|------|--------|---------|
| 1.0 | 2026-06-28 | @test-plan-writer | Initial test plan for GH-78 (combined GH-78 + GH-79): 26 scenarios, 20/20 ACs covered. |

## 10. Test Execution Log

| TC ID | Run Date | Result | Notes |
|-------|----------|--------|-------|
| _(populated during delivery by @coder / @reviewer / @runner)_ | | | |
