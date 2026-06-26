---
id: chg-GH-67-test-plan
status: Updated
created: 2026-06-25T09:48:57Z
last_updated: 2026-06-25T16:05:00Z
owners: ["Juliusz Ćwiąkalski"]
service: doc-distribution
labels: ["ci", "docs", "install", "guard", "odr-0001"]
version_impact: minor
summary: "Make the redistribution decision travel with each document via an in-file marker (frontmatter key for .md; top-level key for .yaml), derive the local-install set from that marker instead of a hand-maintained allowlist, and add a CI guard that fails on any drift — eliminating the entire class of 'redistributable doc silently not installed' omissions."
links:
  change_spec: ./chg-GH-67-spec.md
  implementation_plan: ./chg-GH-67-plan.md
  testing_strategy: .ai/rules/testing-strategy.md
---

# Test Plan - Marker-driven doc distribution with install-manifest drift guard

## 1. Scope and Objectives

This plan verifies GH-67: the `ados_distribution` frontmatter marker becomes the single source of truth for what ADOS redistributes, `scripts/install.sh` derives the local-install set from that marker (with recursive template copy), and a new `scripts/.tests/test-doc-distribution.sh` guard makes drift impossible to merge. The core behavior to protect is **classification/install-set agreement**: every redistributable doc installs, no internal doc leaks out, and any future drift fails CI.

Two integrity risks drive the plan: (1) the **marker parser is fragile and two-path** — for `.md` files frontmatter blocks mix `# Copyright` comment lines and real keys (the handbook has both), and a doc's *body* may contain the literal string `ados_distribution: foo`; the parser must read only the first `---`-delimited frontmatter block. For the 4 `.yaml` register templates there is **no frontmatter block** (one would break `yaml.safe_load()` multi-doc consumers); the marker is a **top-level key** `^ados_distribution:` matched at column 0 (an indented/nested occurrence must NOT match). So the parser must be a robust two-path reader (spec OQ-1 / RSK-1, NFR-4 forbids a YAML library); and (2) the **guard must be a true drift detector**, not a tautology — it must independently derive the install set from markers and compare against what `install.sh` *actually* copies, so a glob/manifest bug in `install.sh` is caught rather than masked.

This change was motivated by a silent-omission regression: `decision-making.md` (a primary redistributable guide) shipped in PR #62 but was never added to the manifest, so it would not install into any adopting project — and neither red-team round caught it. The guard is the gate that class of error must never pass again.

### 1.1 In Scope

- **The guard** — `scripts/.tests/test-doc-distribution.sh` (NEW), with 5 failure modes: (1) missing marker, (2) redistributable-not-installed, (3) internal-installed, (4) derived-set drift, (5) invalid marker value (PM-decided OQ-2). Includes POSIX **two-path** parser unit self-tests (`.md` frontmatter path + `.yaml` top-level-key path).
- **Marker presence on every in-scope doc** — positive assertion that all 54 docs (15 guides, 25 md-templates, 4 yaml-templates, 5 blueprints, 5 standalone) carry a valid marker (spec §8.3 classification table, verified: 50 redistributable + 1 project-generated + 3 internal; PR #74 review C3 reclassified `doc/decisions/00-index.md`).
- **`scripts/install.sh` behaviors** — marker-derived guide set; recursive template install (`*.md` + `*.yaml` + `blueprints/**`); internal guides excluded; idempotent re-run.
- **`scripts/.tests/test-install.sh`** (UPDATE) — include `decision-making.md` in mock + assertions; add blueprints/`*.yaml` install assertions.
- **`scripts/.tests/test-uninstall.sh`** (UPDATE) — stale fixture `system-dependencies.md` → `ados-tools-system-dependencies.md`.
- **`.github/workflows/ci.yml`** (UPDATE) — wire the guard as a merge-blocking step.
- **Process/reviewer hooks** (manual inspection) — `AGENTS.md`, `.ai/agent/pm-instructions.md`, `.ai/agent/code-review-instructions.md`; header hygiene (`AC-F5-1`); global-install path untouched (`NFR-3`).

### 1.2 Out of Scope & Known Gaps

- Global-install path (only the **local** doc-distribution path is in scope — `NG-5`, `NFR-3`).
- `tools/` redistribution and `doc/tools/*` guides (`NG-2`).
- Applying `project-generated` markers to `AGENTS.md`, `pm-instructions.md`, `doc/spec/**`, `doc/overview/**`, `doc/changes/**`, individual `doc/decisions/*` records (`NG-1`, `NG-3`). These remain **unmarked** and the guard must NOT scan them (boundary test `TC-DIST-014`).
- A manifest UI; markdown/rendering tooling (`NG-4`, `NG-6`).
- **OQ-TP-1 — RESOLVED (red-team MAJ-3):** the spec §13 assumption states "`copy_updatable_file` is create-if-absent and idempotent", but the current code (`copy_file_with_diff`) **content-syncs** updatable files (overwrites when content differs). **PM decision: content-sync is intended** — upstream docs/templates are pristine references; "non-destructive" means no loss of adopter *working* files (only re-sync of upstream), and the adopter convention "copy a template to a working file before filling it in" is the data-loss mitigation. See §8.3 and `TC-INST-005`.

## 2. References

| Ref | Document | Relevance |
|-----|----------|-----------|
| Spec | `./chg-GH-67-spec.md` | Authoritative requirements: §8.3 classification table (54 docs), §9 NFRs, §17 acceptance criteria. |
| Strategy | `.ai/rules/testing-strategy.md` | Canonical test layers/types; `scripts/` → `bash scripts/.tests/test-<name>.sh`. |
| Bash rules | `.ai/rules/bash.md` | Shell conventions for the guard and updated tests (load alongside strategy per its §Scope). |
| Convention | `doc/guides/unified-change-convention-tracker-agnostic-specification.md` | `workItemRef` / folder / branch naming. |
| Template | `doc/templates/test-plan-template.md` | Structural skeleton for this file. |
| Decision | `doc/decisions/` **ODR-0001** (Accepted) | Classifies the 4 `*.yaml` register templates `redistributable` (DEC-1). |
| Target code | `scripts/install.sh` | `ADOS_UPDATABLE_FILES` (L76–99), template glob (L677), `copy_updatable_file`/`copy_file_with_diff` (L234–293). |
| Target CI | `.github/workflows/ci.yml` | Where the guard step is wired (currently 41 lines, only an idempotency check). |
| Implementation plan | `./chg-GH-67-plan.md` | Phased delivery plan; TCs originally derived from spec and now reconciled against the plan. |

## 3. Coverage Overview

Every spec §17 acceptance criterion is traced below. Spec §17 enumerates **19 ACs** (`AC-F1-1 … AC-F7-2`); all 19 are covered — no gaps. (`DM-1`, `DM-2`, `NFR-1 … NFR-5` are covered in §3.2 / §3.3.)

### 3.1 Functional Coverage (F-#, AC-#)

| AC ID | Description (given/when/then, condensed) | TC ID(s) | Status |
|-------|------------------------------------------|----------|--------|
| AC-F1-1 | All 15 guides carry a marker matching Table A (12 redistributable, 3 internal) | TC-DIST-001, TC-DIST-004 | Covered |
| AC-F1-2 | All 25 `*.md` + 4 `*.yaml` + 5 blueprints carry `redistributable` | TC-DIST-002, TC-DIST-004, TC-DIST-018 | Covered |
| AC-F1-3 | All 5 standalone docs carry a valid marker (4 `redistributable`; `doc/decisions/00-index.md` `project-generated` per PR #74 review C3) | TC-DIST-003, TC-DIST-004 | Covered |
| AC-F1-4 | In-scope doc lacking marker ⇒ guard exits non-zero naming the file | TC-DIST-005 | Covered |
| AC-F2-1 | Installed guide set = 12 redistributable-marked guides (derived, not hand-listed) | TC-INST-001, TC-DIST-010 | Covered |
| AC-F2-2 | Templates installed recursively: `*.md` AND `*.yaml` AND `blueprints/**` | TC-INST-002, TC-DIST-013 | Covered |
| AC-F2-3 | The 3 internal guides are NOT installed | TC-INST-003, TC-DIST-011 | Covered |
| AC-F2-4 | `decision-making.md` + `decision-records-management.md` both install | TC-INST-004 | Covered |
| AC-F3-1 | redistributable doc not in install-derived set ⇒ guard fails (mode: redistributable-not-installed) | TC-DIST-010 | Covered |
| AC-F3-2 | internal doc present in install set ⇒ guard fails (mode: internal-installed) | TC-DIST-011 | Covered |
| AC-F3-3 | install-derived set ≠ marker-derived set ⇒ guard fails (mode: derived-set drift) | TC-DIST-012 | Covered |
| AC-F3-4 | Guard scans BOTH `*.md` AND `*.yaml` (and `blueprints/**`) | TC-DIST-013 | Covered |
| AC-F3-5 | `ci.yml` runs the guard on push/PR; non-zero exit blocks merge | TC-PROC-001 | Covered |
| AC-F4-1 | `AGENTS.md` + `pm-instructions.md` state marker mandatory + guard-must-pass | TC-PROC-002, TC-PROC-003 | Covered |
| AC-F4-2 | `code-review-instructions.md` has the marker/guard checklist item | TC-PROC-004 | Covered |
| AC-F6-1 | Re-run `install.sh --local` is idempotent and non-destructive | TC-INST-005 | Covered (content-sync contract — OQ-TP-1 resolved) |
| AC-F5-1 | No hand-added license headers; headers via `add-header-location.sh` only; `.ados-claude` regenerated only if `.opencode` edited | TC-PROC-005 | Covered |
| AC-F7-1 | `test-install.sh` mock + assertions include `decision-making.md` | TC-INST-006 | Covered |
| AC-F7-2 | `test-uninstall.sh` uses `ados-tools-system-dependencies.md` (not stale `system-dependencies.md`) | TC-UNINST-001 | Covered |

> **PM-added 5th failure mode (invalid marker value, OQ-2):** traced via `TC-DIST-006`. Resolves spec risk RSK-6 (marker typo silently misclassifies).

### 3.2 Interface Coverage (API-#, EVT-#, DM-#)

No REST/HTTP (spec §8.1 N/A) or event (§8.2 N/A) surfaces. Data-model coverage:

| DM ID | Contract | TC ID(s) | Status |
|-------|----------|----------|--------|
| DM-1 | `ados_distribution` scalar key — for `.md` inside the first frontmatter block; for `.yaml` a top-level key (`^ados_distribution:` at col 0). Closed enum `{redistributable, internal, project-generated}`; present on every in-scope doc; authoritative for install + guard | TC-DIST-001, TC-DIST-002, TC-DIST-003, TC-DIST-005, TC-DIST-006, TC-DIST-007, TC-DIST-008, TC-DIST-009, TC-DIST-018, TC-INST-003 | Covered |
| DM-2 | Closed set of in-scope file classes (guides, templates md, templates yaml, blueprints, handbook, 00-index, decisions stubs, rules index); everything outside is not scanned | TC-DIST-001, TC-DIST-002, TC-DIST-003, TC-DIST-004, TC-DIST-014, TC-DIST-018 | Covered |

### 3.3 Non-Functional Coverage (NFR-#)

| NFR ID | Requirement | Threshold | TC ID(s) | Status |
|--------|-------------|-----------|----------|--------|
| NFR-1 | Guard determinism — same repo state ⇒ same verdict across runs | 100% reproducible | TC-DIST-012, TC-DIST-015 | Covered |
| NFR-2 | Guard + local install performance over ~54 files | < 5 s wall-clock; no network | TC-DIST-016 | Covered |
| NFR-3 | Boundary — only local path changes; global-install untouched | Zero edits to global behavior | TC-PROC-005, TC-PROC-006 | Covered |
| NFR-4 | Zero new runtime dependencies for the guard | Pure POSIX (bash/git/grep/sed/awk); no npm/pip/YAML lib | TC-DIST-007, TC-DIST-008, TC-DIST-009, TC-DIST-017, TC-DIST-018 | Covered |
| NFR-5 | Idempotency — re-run `install.sh --local` is non-destructive | Two runs converge to identical, deterministic end state; project-specific working files preserved; no deletions (content-sync contract — OQ-TP-1 resolved) | TC-INST-005 | Covered |

## 4. Test Types and Layers

Per `.ai/rules/testing-strategy.md` (and `.ai/rules/bash.md` for shell). This repo has no unit/integration framework beyond embedded bash test harnesses; layers map as:

| Layer | Type | Framework / location | Pattern | Used here |
|-------|------|----------------------|---------|-----------|
| Shell automation | Automated (guard) | `scripts/.tests/test-doc-distribution.sh` (NEW) | `bash scripts/.tests/test-doc-distribution.sh`; embedded assertions (mirror `test-install.sh`/`test-uninstall.sh` harness: `assert_eq`/`assert_contains`/`assert_exit_code`, trap-based teardown in temp dirs) | Primary deliverable |
| Shell automation | Automated (install) | `scripts/.tests/test-install.sh` (UPDATE) | `bash scripts/.tests/test-install.sh`; mock ADOS source via `ADOS_SOURCE_DIR` + `create_mock_ados_source` + `create_mock_project` | Drive-by + new template-install assertions |
| Shell automation | Automated (uninstall) | `scripts/.tests/test-uninstall.sh` (UPDATE) | `bash scripts/.tests/test-uninstall.sh` | Drive-by fixture rename |
| Static/diff | Manual inspection | `git diff --check`; `grep`-driven content checks on `AGENTS.md`, `pm-instructions.md`, `code-review-instructions.md`, `ci.yml` | n/a | Hooks + CI wiring + NFR-3 |
| Content | Manual | Markdown / YAML frontmatter spot review; link review for changed docs | n/a | Marker edits, header hygiene |

**Conventions honored:** test files are `test-*.sh` in adjacent `.tests/`; narrow changed-module checks first; evidence recorded in §10. Determinism requirement (NFR-1) means every automated case runs in an isolated `mktemp -d` with no network and no real install into another repo.

## 5. Test Scenarios

### 5.1 Scenario Index

| TC ID | Title | Type | Priority | AC Coverage |
|-------|-------|------|----------|-------------|
| TC-DIST-001 | All 15 guides carry correct marker (Table A) | Regression | High | AC-F1-1, DM-1, DM-2 |
| TC-DIST-002 | All templates (md+yaml+blueprints) carry redistributable | Regression | High | AC-F1-2, DM-1, DM-2 |
| TC-DIST-003 | All 5 standalone docs carry a valid marker (4 redistributable + 1 project-generated) | Regression | High | AC-F1-3, DM-1, DM-2 |
| TC-DIST-004 | 54/54 in-scope docs carry a valid marker (aggregate) | Happy Path | High | AC-F1-1/2/3 |
| TC-DIST-005 | Failure mode 1 — missing marker ⇒ guard fails naming file | Negative | High | AC-F1-4, DM-1 |
| TC-DIST-006 | Failure mode 5 — invalid marker value ⇒ guard fails | Negative | High | OQ-2 / RSK-6, DM-1 |
| TC-DIST-007 | Parser ignores `ados_distribution:` in doc body (OQ-1) | Corner Case | High | NFR-4, RSK-1, OQ-1 |
| TC-DIST-008 | Parser handles mixed frontmatter (comments + keys) | Corner Case | High | NFR-4, RSK-1 |
| TC-DIST-009 | Parser handles missing frontmatter gracefully | Corner Case | Medium | NFR-4, RSK-1 |
| TC-DIST-010 | Failure mode 2 — redistributable-not-installed ⇒ fail | Negative | High | AC-F3-1, AC-F2-1 |
| TC-DIST-011 | Failure mode 3 — internal-installed ⇒ fail | Negative | High | AC-F3-2, AC-F2-3 |
| TC-DIST-012 | Failure mode 4 — derived-set drift ⇒ fail | Negative | High | AC-F3-3, NFR-1 |
| TC-DIST-013 | Guard scans md AND yaml AND blueprints templates | Corner Case | High | AC-F3-4 |
| TC-DIST-014 | Guard does NOT scan out-of-scope dirs (boundary) | Negative | High | DM-2, RSK-2 |
| TC-DIST-015 | Determinism — identical verdict across N runs | Corner Case | Medium | NFR-1 |
| TC-DIST-016 | Performance — guard + local install < 5 s, no network | Performance | Medium | NFR-2 |
| TC-DIST-017 | Zero new runtime deps — pure POSIX, no npm/pip/yq | Corner Case | Medium | NFR-4 |
| TC-DIST-018 | YAML register: top-level key parsed (pos+neg+indented) | Corner Case | High | AC-F1-2, DM-1, DM-2, NFR-4 |
| TC-INST-001 | Installed guide set = 12 redistributable-marked guides | Happy Path | High | AC-F2-1 |
| TC-INST-002 | Templates install recursively (md+yaml+blueprints) | Happy Path | High | AC-F2-2 |
| TC-INST-003 | The 3 internal guides are not installed | Negative | High | AC-F2-3 |
| TC-INST-004 | decision-making + decision-records both install | Regression | High | AC-F2-4 |
| TC-INST-005 | Re-run install --local is idempotent/non-destructive | Corner Case | High | AC-F6-1, NFR-5 |
| TC-INST-006 | test-install.sh includes decision-making.md (drive-by) | Regression | High | AC-F7-1 |
| TC-INST-007 | test-install.sh asserts blueprints + yaml now install | Regression | Medium | AC-F2-2 |
| TC-UNINST-001 | test-uninstall.sh fixture renamed (drive-by) | Regression | Medium | AC-F7-2 |
| TC-PROC-001 | ci.yml runs the guard; failure blocks merge | Regression | High | AC-F3-5 |
| TC-PROC-002 | AGENTS.md states marker mandatory + guard-must-pass | Regression | Medium | AC-F4-1 |
| TC-PROC-003 | pm-instructions.md states marker mandatory + guard-must-pass | Regression | Medium | AC-F4-1 |
| TC-PROC-004 | code-review-instructions.md has marker/guard checklist item | Regression | Medium | AC-F4-2 |
| TC-PROC-005 | No hand-added headers; .ados-claude regenerated only if .opencode edited | Regression | Medium | AC-F5-1, NFR-3 |
| TC-PROC-006 | Global-install path unchanged (NFR-3) | Regression | Medium | NFR-3 |

**Totals:** 32 test cases — 18 guard/marker (`TC-DIST-*`), 8 install/uninstall (`TC-INST-*` / `TC-UNINST-*`), 6 process/CI/NFR (`TC-PROC-*`). Of these, 5 are the mandated failure modes (`TC-DIST-005/006/010/011/012`).

### 5.2 Scenario Details

#### TC-DIST-001 - All 15 guides carry correct marker (Table A)

**Scenario Type**: Regression
**Impact Level**: Critical
**Priority**: High
**Related IDs**: AC-F1-1, F-1, F-5, DM-1, DM-2
**Test Type(s)**: Integration
**Automation Level**: Automated
**Target Layer / Location**: `scripts/.tests/test-doc-distribution.sh`
**Tags**: @backend, @guard, @docs

**Preconditions**:
- Marker application phase delivered: all 15 `doc/guides/*.md` carry `ados_distribution`.
- Guard helper enumerates the DM-2 "guides" class via `doc/guides/*.md`.

**Steps**:
1. Guard scans `doc/guides/*.md`, parses each file's `ados_distribution` value.
2. Assert the classified set equals Table A: exactly `change-lifecycle, claude-code-setup, copywriting, decision-making, decision-records-management, external-researcher-setup, meeting-preparation-and-summarization, onboarding-existing-project, opencode-agents-and-commands-guide, opencode-model-configuration, pr-platform-integration, unified-change-convention-tracker-agnostic-specification` are `redistributable` (12) and `adding-tool-support, ados-tools-system-dependencies, tools-convention` are `internal` (3).

**Expected Outcome**:
- Guide classification matches Table A exactly (12 redistributable / 3 internal). Guard exits 0 on the current repo.

#### TC-DIST-002 - All templates (md+yaml+blueprints) carry redistributable

**Scenario Type**: Regression
**Impact Level**: Critical
**Priority**: High
**Related IDs**: AC-F1-2, F-1, F-5, DM-1, DM-2
**Test Type(s)**: Integration
**Automation Level**: Automated
**Target Layer / Location**: `scripts/.tests/test-doc-distribution.sh`
**Tags**: @backend, @guard, @docs

**Preconditions**:
- Markers applied to all 25 `doc/templates/*.md`, 4 `doc/templates/*.yaml`, 5 `doc/templates/blueprints/**`.

**Steps**:
1. Guard enumerates templates across all three sub-globs (`*.md`, `*.yaml`, `blueprints/**`).
2. Assert every enumerated template parses to `redistributable` — via the **two-path parser**: the 25 `*.md` + 5 `blueprints/*.md` are read from the first `---` frontmatter block; the 4 `*.yaml` are read from the **top-level key** `^ados_distribution:` (no frontmatter block, per §8.2). Each class exercises its respective read path.
3. Assert counts: 25 + 4 + 5 = 34, all `redistributable`.

**Expected Outcome**:
- All 34 template files are `redistributable`; counts match (25/4/5); both read paths (`.md` frontmatter and `.yaml` top-level key) produce the value.

#### TC-DIST-003 - All 5 standalone docs carry a valid marker

**Scenario Type**: Regression
**Impact Level**: Critical
**Priority**: High
**Related IDs**: AC-F1-3, F-1, F-5, DM-1, DM-2
**Test Type(s)**: Integration
**Automation Level**: Automated
**Target Layer / Location**: `scripts/.tests/test-doc-distribution.sh`
**Tags**: @backend, @guard, @docs

**Preconditions**:
- Markers applied to `doc/documentation-handbook.md`, `doc/00-index.md`, `doc/decisions/README.md`, `doc/decisions/00-index.md`, `.ai/rules/README.md`.

**Steps**:
1. Guard parses the explicit standalone-doc scan list (these live outside the globbed classes).
2. Assert each parses to a valid marker: 4 `redistributable` + `doc/decisions/00-index.md` `project-generated` (PR #74 review C3).

**Expected Outcome**:
- All 5 standalone docs carry a valid marker (4 redistributable, 1 project-generated).

#### TC-DIST-004 - 54/54 in-scope docs carry a valid marker (aggregate)

**Scenario Type**: Happy Path
**Impact Level**: Critical
**Priority**: High
**Related IDs**: AC-F1-1, AC-F1-2, AC-F1-3, F-1, F-5, DM-2
**Test Type(s)**: Integration
**Automation Level**: Automated
**Target Layer / Location**: `scripts/.tests/test-doc-distribution.sh`
**Tags**: @backend, @guard, @docs

**Preconditions**:
- Full marker application delivered.

**Steps**:
1. Guard enumerates the union of all DM-2 classes (guides + templates md/yaml/blueprints + 5 standalone).
2. Assert the enumerated total == 54 and every file has a marker in the closed enum.
3. Assert split == 50 `redistributable` + 1 `project-generated` + 3 `internal` (spec Appendix A; PR #74 review C3).

**Expected Outcome**:
- 54/54 in-scope docs carry a valid marker; 50 redistributable / 1 project-generated / 3 internal. This is the explicit "marker on every doc" positive assertion (overlaps failure mode 1, but stated as a positive gate).

#### TC-DIST-005 - Failure mode 1 — missing marker ⇒ guard fails naming file

**Scenario Type**: Negative
**Impact Level**: Critical
**Priority**: High
**Related IDs**: AC-F1-4, F-1, F-3, DM-1
**Test Type(s)**: Integration
**Automation Level**: Automated
**Target Layer / Location**: `scripts/.tests/test-doc-distribution.sh`
**Tags**: @backend, @guard

**Preconditions**:
- A throwaway fixture tree (or a temp copy of one DM-2 class) where exactly one file is missing the marker.

**Steps**:
1. Build a fixture with one in-scope file lacking `ados_distribution`.
2. Run the guard over the fixture.
3. Capture exit code and stderr/stdout.

**Expected Outcome**:
- Guard exits non-zero.
- Output names the offending file and the failed condition ("missing marker").
- On the fixture with the marker restored, the guard exits 0 (no false positive).

#### TC-DIST-006 - Failure mode 5 — invalid marker value ⇒ guard fails

**Scenario Type**: Negative
**Impact Level**: Critical
**Priority**: High
**Related IDs**: OQ-2 (PM-decided: yes), RSK-6, DM-1, F-3
**Test Type(s)**: Integration
**Automation Level**: Automated
**Target Layer / Location**: `scripts/.tests/test-doc-distribution.sh`
**Tags**: @backend, @guard

**Preconditions**:
- OQ-2 resolved PM-decided: the guard rejects unknown enum values. Fixture contains a file with `ados_distribution: redistibutable` (typo) and another with an arbitrary value.

**Steps**:
1. Build a fixture with a file whose marker value ∉ `{redistributable, internal, project-generated}`.
2. Run the guard.
3. Capture exit code and output.

**Expected Outcome**:
- Guard exits non-zero, treated identically to a missing marker (per OQ-2 decision), naming the file and the invalid value. Resolves RSK-6 (typo silently misclassifies).

#### TC-DIST-007 - Parser ignores `ados_distribution:` in doc body (OQ-1)

**Scenario Type**: Corner Case
**Impact Level**: Critical
**Priority**: High
**Related IDs**: NFR-4, RSK-1, OQ-1, DM-1
**Test Type(s)**: Unit
**Automation Level**: Automated
**Target Layer / Location**: `scripts/.tests/test-doc-distribution.sh` (parser self-test)
**Tags**: @backend, @guard, @parser

**Preconditions**:
- A pure POSIX `ados_parse_distribution_marker()` helper exists and is unit-tested in isolation.

**Steps**:
1. Create a fixture doc whose **first frontmatter block** has a valid marker, but whose **body** (after the closing `---`) contains the literal line `ados_distribution: foo`.
2. Call the parser on the fixture.
3. Assert it returns the frontmatter value, NOT `foo`.

**Expected Outcome**:
- Parser reads only the first frontmatter block delimited by the opening and next `---`. A body occurrence is never misread. This is the explicit robust-parsing unit assertion demanded for OQ-1/RSK-1.

**Notes / Clarifications**:
- Edge variants to also assert in the same unit group: (a) marker is the last key before the closing `---`; (b) marker preceded only by `#` comment lines; (c) multiple `---` separators later in the body.
- These are the `.md`-path members of the **parser self-test group** (4 `.md` cases across TC-DIST-007/008/009: body-contains-marker-string, second frontmatter block, commented marker line, mixed frontmatter, no-frontmatter). The **5th self-test** is the `.yaml` top-level-key path (positive + negative + indented/nested), covered by `TC-DIST-018` — both paths must be self-tested.

#### TC-DIST-008 - Parser handles mixed frontmatter (comments + keys)

**Scenario Type**: Corner Case
**Impact Level**: Critical
**Priority**: High
**Related IDs**: NFR-4, RSK-1, DM-1
**Test Type(s)**: Unit
**Automation Level**: Automated
**Target Layer / Location**: `scripts/.tests/test-doc-distribution.sh`
**Tags**: @backend, @guard, @parser

**Preconditions**:
- Helper available. The real `doc/documentation-handbook.md` frontmatter mixes `# Copyright`/`# MIT License`/`source:` lines with real keys (`id`, `status`, `owners`, `summary`).

**Steps**:
1. Build a fixture replicating the handbook's mixed frontmatter (comment lines + real keys + the new `ados_distribution:` key).
2. Parse it.

**Expected Outcome**:
- Parser returns the correct value despite `#` comment lines and interleaved real YAML keys. Specifically verify against the actual `doc/documentation-handbook.md` (the highest-risk file per RSK-1).

#### TC-DIST-009 - Parser handles missing-frontmatter `.md` gracefully

**Scenario Type**: Corner Case
**Impact Level**: Important
**Priority**: Medium
**Related IDs**: NFR-4, RSK-1, DM-1
**Test Type(s)**: Unit
**Automation Level**: Automated
**Target Layer / Location**: `scripts/.tests/test-doc-distribution.sh` (parser self-test)
**Tags**: @backend, @guard, @parser

**Preconditions**:
- Helper available. Two-path parser keyed on extension (see §8.2).

**Steps**:
1. Build a `.md` fixture with **no** `---` frontmatter block (body only).
2. Parse it via the `.md` path.

**Expected Outcome**:
- Parser returns an empty/"missing" sentinel (does NOT crash, does NOT match a body line). The guard then treats it as the "missing marker" failure mode for that file.

**Notes / Clarifications**:
- This is the `.md`-path degrade-safe case. **For `.yaml` files, "no frontmatter block" is the NORMAL state**, not a failure — the marker is a top-level key, not frontmatter. A `.yaml` lacking `ados_distribution:` at the top level is a *missing-key* failure covered by `TC-DIST-018` (negative).

#### TC-DIST-010 - Failure mode 2 — redistributable-not-installed ⇒ fail

**Scenario Type**: Negative
**Impact Level**: Critical
**Priority**: High
**Related IDs**: AC-F3-1, AC-F2-1, F-3
**Test Type(s)**: Integration
**Automation Level**: Automated
**Target Layer / Location**: `scripts/.tests/test-doc-distribution.sh`
**Tags**: @backend, @guard

**Preconditions**:
- Fixture/sandbox where the marker-derived set names a `redistributable` doc that the install-derived set omits.

**Steps**:
1. Derive the marker set (redistributable docs) and the install-derived set (what `install.sh` actually copies — see §6 oracle approach).
2. Inject a discrepancy: a redistributable doc absent from the install set.
3. Run the guard's directional check.

**Expected Outcome**:
- Guard fails with the "redistributable-not-installed" condition, naming the doc.

#### TC-DIST-011 - Failure mode 3 — internal-installed ⇒ fail

**Scenario Type**: Negative
**Impact Level**: Critical
**Priority**: High
**Related IDs**: AC-F3-2, AC-F2-3, F-3, DM-1
**Test Type(s)**: Integration
**Automation Level**: Automated
**Target Layer / Location**: `scripts/.tests/test-doc-distribution.sh`
**Tags**: @backend, @guard

**Preconditions**:
- Fixture/sandbox where an `internal`-marked doc appears in the install-derived set.

**Steps**:
1. Derive the install set; mark one guide `internal`.
2. Run the guard's directional check.

**Expected Outcome**:
- Guard fails with the "internal-installed" condition, naming the doc. (This is the guard that would have caught a wrong-inclusion the hand-list never could — spec §3 / Flow 3.)

#### TC-DIST-012 - Failure mode 4 — derived-set drift ⇒ fail

**Scenario Type**: Negative
**Impact Level**: Critical
**Priority**: High
**Related IDs**: AC-F3-3, F-3, NFR-1
**Test Type(s)**: Integration
**Automation Level**: Automated
**Target Layer / Location**: `scripts/.tests/test-doc-distribution.sh`
**Tags**: @backend, @guard

**Preconditions**:
- The guard can compute both (a) the marker-derived expected install set and (b) the install-derived actual set, independently (see §6).

**Steps**:
1. Compute set (a) from markers + DM-2 globs.
2. Compute set (b) from a sandbox `install.sh --local` run (enumerate installed redistributable files).
3. Force drift (e.g., remove one file from the install set) and assert failure.
4. On the green repo, assert (a) == (b).

**Expected Outcome**:
- Any inequality ⇒ non-zero exit with the "derived-set drift" condition and the symmetric diff of the two sets. On the real repo, (a) == (b) (50 files — `doc/decisions/00-index.md` is `project-generated` and excluded from the install set per PR #74 review C3; was 51 before). This is the drift detector — it must be an **independent oracle**, not the same computation install.sh uses, or a glob bug in `install.sh` would be masked.

#### TC-DIST-013 - Guard scans md AND yaml AND blueprints templates

**Scenario Type**: Corner Case
**Impact Level**: Critical
**Priority**: High
**Related IDs**: AC-F3-4, AC-F2-2, F-3, F-5
**Test Type(s)**: Integration
**Automation Level**: Automated
**Target Layer / Location**: `scripts/.tests/test-doc-distribution.sh`
**Tags**: @backend, @guard

**Preconditions**:
- All template sub-classes present and marked.

**Steps**:
1. Enumerate the guard's scanned template set.
2. Assert it includes files from `doc/templates/*.md`, `doc/templates/*.yaml`, AND `doc/templates/blueprints/**` (per ODR-0001 / DEC-1).

**Expected Outcome**:
- The guard's enumerated template set spans all three sub-globs (so a future glob regression, e.g. dropping `*.yaml`, is caught).

#### TC-DIST-014 - Guard does NOT scan out-of-scope dirs (boundary)

**Scenario Type**: Negative
**Impact Level**: Critical
**Priority**: High
**Related IDs**: DM-2, RSK-2, F-3
**Test Type(s)**: Integration
**Automation Level**: Automated
**Target Layer / Location**: `scripts/.tests/test-doc-distribution.sh`
**Tags**: @backend, @guard

**Preconditions**:
- The guard enumerates only DM-2 classes.

**Steps**:
1. Assert the guard's candidate set is a **subset of the defined DM-2 doc classes** (guides, templates md/yaml, blueprints, handbook, `00-index`, decision stubs `README.md`/`00-index.md`, rules index) — i.e. every enumerated path must fall under one of the DM-2 globs/paths. This is the positive form of the boundary invariant; it deliberately does **not** enumerate every excluded dir (the live tree contains dirs like `doc/content/`, `doc/quality/`, `doc/planning/` that aren't individually named but are trivially excluded by the subset check).
2. As corroboration, confirm the guard passes on the current repo despite out-of-scope areas (`doc/changes/**`, `doc/spec/**`, `doc/overview/**`, individual `doc/decisions/*` records, `AGENTS.md`, `pm-instructions.md`, `tools/**`) containing legitimately unmarked `project-generated` files (RSK-2 mitigation).

**Expected Outcome**:
- Guard candidate set ⊆ DM-2; out-of-scope files are never flagged. Prevents the "scope too broad" failure mode (RSK-2).

#### TC-DIST-015 - Determinism — identical verdict across N runs

**Scenario Type**: Corner Case
**Impact Level**: Important
**Priority**: Medium
**Related IDs**: NFR-1, F-3
**Test Type(s)**: Integration
**Automation Level**: Automated
**Target Layer / Location**: `scripts/.tests/test-doc-distribution.sh`
**Tags**: @backend, @guard, @perf

**Preconditions**:
- Repo in green state.

**Steps**:
1. Run the guard 3× back-to-back on the same checkout.
2. Capture exit code + the sorted list of reported files each run.

**Expected Outcome**:
- All runs identical (same exit code, same file list). No time/randomness/ordering dependence (NFR-1).

#### TC-DIST-016 - Performance — guard + local install < 5 s, no network

**Scenario Type**: Performance
**Impact Level**: Important
**Priority**: Medium
**Related IDs**: NFR-2, F-3
**Test Type(s)**: Performance
**Automation Level**: Automated
**Target Layer / Location**: `scripts/.tests/test-doc-distribution.sh` + `scripts/.tests/test-install.sh`
**Tags**: @backend, @guard, @perf

**Preconditions**:
- CI runner environment (`ubuntu-latest`).

**Steps**:
1. Time the guard over the ~54 in-scope files.
2. Optionally time a sandbox `install.sh --local`.
3. Confirm no network calls (e.g., run with network disabled / assert no `curl`/`git fetch`/`wget` invocations in the guard path).

**Expected Outcome**:
- Guard completes < 5 s wall-clock; zero network calls (NFR-2).

#### TC-DIST-017 - Zero new runtime deps — pure POSIX, no npm/pip/yq

**Scenario Type**: Corner Case
**Impact Level**: Important
**Priority**: Medium
**Related IDs**: NFR-4, F-3
**Test Type(s)**: Unit
**Automation Level**: Automated
**Target Layer / Location**: `scripts/.tests/test-doc-distribution.sh`
**Tags**: @backend, @guard

**Preconditions**:
- Guard implemented.

**Steps**:
1. Static-scan the guard for external tool invocations.
2. Assert it only uses POSIX/bash tools available on a base runner: `bash`, `git`, `grep`, `sed`, `awk`, coreutils. Assert it does NOT invoke `yq`/`python`/`ruby`/`node`/`npm`/`pip`.

**Expected Outcome**:
- No new runtime dependency (NFR-4). The marker parser is pure awk/sed/grep (or equivalent bash), not a YAML library.

#### TC-DIST-018 - YAML register template: top-level key parsed correctly (pos + neg + indented)

**Scenario Type**: Corner Case
**Impact Level**: Critical
**Priority**: High
**Related IDs**: AC-F1-2, F-1, F-5, DM-1, DM-2, NFR-4
**Test Type(s)**: Unit
**Automation Level**: Automated
**Target Layer / Location**: `scripts/.tests/test-doc-distribution.sh` (parser self-test)
**Tags**: @backend, @guard, @parser, @yaml

**Preconditions**:
- Two-path parser keyed on extension (§8.2). The 4 `doc/templates/*.yaml` register templates carry the marker as a **top-level key** at line 1 (`^ados_distribution: redistributable`) and have **no** `---` frontmatter block — a frontmatter block would break `yaml.safe_load()` multi-doc consumers.

**Steps**:
1. **Positive:** parse a `.yaml` fixture whose line 1 is `ados_distribution: redistributable` (followed by a normal YAML body). Assert the `.yaml` path returns `redistributable`.
2. **Negative (missing key):** parse a `.yaml` fixture with no `ados_distribution:` top-level key. Assert it returns the "missing" sentinel (the guard treats it as a missing-marker failure for that file).
3. **Negative (indented/nested key):** parse a `.yaml` fixture where the key appears but **indented** (e.g. two spaces: `  ados_distribution: redistributable`) or nested under a parent mapping. Assert the parser does **NOT** match it — only `^ados_distribution:` at column 0 is a top-level key.

**Expected Outcome**:
- `.yaml` top-level key is read when present at column 0; a nested/indented occurrence is ignored (no false positive from a key under another document section); absence is flagged missing. This pins the two-path parser's YAML branch (the 5th parser self-test).

#### TC-INST-001 - Installed guide set = 12 redistributable-marked guides

**Scenario Type**: Happy Path
**Impact Level**: Critical
**Priority**: High
**Related IDs**: AC-F2-1, F-2
**Test Type(s)**: Integration
**Automation Level**: Automated
**Target Layer / Location**: `scripts/.tests/test-install.sh`
**Tags**: @backend, @install

**Preconditions**:
- `install.sh` derives the guide set from markers (hand-list guide entries removed).
- Mock ADOS source built via `create_mock_ados_source` with markers on guide fixtures.

**Steps**:
1. Run `install_local_files` into a mock project.
2. Enumerate installed `doc/guides/*.md`.
3. Assert the installed guide set == the 12 redistributable-marked guides (Table A), and that the hand-list is no longer the source of truth (no hard-coded guide array drives the result).

**Expected Outcome**:
- Exactly the 12 redistributable guides install; derivation is marker-driven (AC-F2-1).

#### TC-INST-002 - Templates install recursively (md+yaml+blueprints)

**Scenario Type**: Happy Path
**Impact Level**: Critical
**Priority**: High
**Related IDs**: AC-F2-2, F-2, F-5, DEC-1/DEC-2
**Test Type(s)**: Integration
**Automation Level**: Automated
**Target Layer / Location**: `scripts/.tests/test-install.sh`
**Tags**: @backend, @install

**Preconditions**:
- Template copy changed from non-recursive `doc/templates/*.md` to recursive `doc/templates/**` covering `*.md` + `*.yaml` + `blueprints/**`.

**Steps**:
1. Run `install_local_files` with a source containing `*.md`, `*.yaml`, and `blueprints/**` files.
2. Assert all three classes land in the target `doc/templates/` (incl. a `doc/templates/blueprints/` subdir and the 4 `*.yaml` registers).

**Expected Outcome**:
- blueprints and the 4 YAML registers install (closes the documented gaps; ODR-0001 / DEC-1).

#### TC-INST-003 - The 3 internal guides are not installed

**Scenario Type**: Negative
**Impact Level**: Critical
**Priority**: High
**Related IDs**: AC-F2-3, F-2, DM-1
**Test Type(s)**: Integration
**Automation Level**: Automated
**Target Layer / Location**: `scripts/.tests/test-install.sh`
**Tags**: @backend, @install

**Preconditions**:
- `adding-tool-support.md`, `ados-tools-system-dependencies.md`, `tools-convention.md` marked `internal`.

**Steps**:
1. Run `install_local_files`.
2. Assert none of the 3 internal guides appears under `doc/guides/` in the target.

**Expected Outcome**:
- 0 of the 3 internal guides installed.

#### TC-INST-004 - decision-making + decision-records both install

**Scenario Type**: Regression
**Impact Level**: Critical
**Priority**: High
**Related IDs**: AC-F2-4, F-2
**Test Type(s)**: Integration
**Automation Level**: Automated
**Target Layer / Location**: `scripts/.tests/test-install.sh`
**Tags**: @backend, @install

**Preconditions**:
- Both guides marked redistributable.

**Steps**:
1. Run `install_local_files`.
2. Assert `doc/guides/decision-making.md` and `doc/guides/decision-records-management.md` both exist in the target.

**Expected Outcome**:
- Both install. This directly closes the #62 silent-omission that motivated GH-67 (`decision-making.md` was never in the manifest).

#### TC-INST-005 - Re-run install --local is idempotent/non-destructive

**Scenario Type**: Corner Case
**Impact Level**: Critical
**Priority**: High
**Related IDs**: AC-F6-1, F-6, NFR-5
**Test Type(s)**: Integration
**Automation Level**: Automated
**Target Layer / Location**: `scripts/.tests/test-install.sh`
**Tags**: @backend, @install

**Preconditions**:
- A project dir that already ran `install.sh --local` once. Project-specific files present (`pm-instructions.md`). See OQ-TP-1 for the contract nuance.

**Steps**:
1. Run `install_local_files` once; record the target tree + `git`-tracked state.
2. Run `install_local_files` a second time on the same target (same upstream content).
3. Assert: (a) re-running **converges to an identical, deterministic result** — the post-run target tree is byte-for-byte equal after run 2 as after run 1 (content-sync settles; the assertion is *deterministic convergence*, NOT "files left untouched"); (b) project-specific working files (`pm-instructions.md`, `ADOS_PROJECT_FILES`) are preserved (not overwritten/deleted); (c) no file is deleted; (d) new additive files (blueprints, `*.yaml`, `decision-making.md`) appear if absent.

**Expected Outcome**:
- Two runs converge to the **same deterministic end state** (run 1 and run 2 produce identical target trees); project-specific files preserved; no deletions; additive files appear if absent. Counters show identical-content files are not re-synced on the second run (no spurious `_updated`) — content-sync converges, it does not churn (NFR-5 / AC-F6-1, content-sync contract per the OQ-TP-1 resolution).

**Notes / Clarifications**:
- The actual `copy_file_with_diff` **content-syncs** updatable files (overwrites when content differs, skips when identical). Per the **OQ-TP-1 resolution (red-team MAJ-3)** this is the intended contract: upstream docs/templates are pristine references; "non-destructive" = no loss of adopter *working* files (only re-sync of upstream). The idempotency assertion is therefore *deterministic convergence*, not "files left untouched". **Adopter mitigation:** the convention "copy a template to a working file before filling it in" is what protects adopter data from content-sync overwrites.

#### TC-INST-006 - test-install.sh includes decision-making.md (drive-by)

**Scenario Type**: Regression
**Impact Level**: Important
**Priority**: High
**Related IDs**: AC-F7-1, F-7
**Test Type(s)**: Integration
**Automation Level**: Automated
**Target Layer / Location**: `scripts/.tests/test-install.sh`
**Tags**: @backend, @install, @regression

**Preconditions**:
- `test-install.sh` updated.

**Steps**:
1. Inspect `create_mock_ados_source` (~L188–199): assert `doc/guides/decision-making.md` is created in the mock source (it was omitted — latent drift).
2. Inspect `test_local_install_creates_guides` (~L758–782): assert an `assert_file_exists` for `decision-making.md`.

**Expected Outcome**:
- `decision-making.md` present in both the mock source and the install assertions (AC-F7-1).

#### TC-INST-007 - test-install.sh asserts blueprints + yaml now install

**Scenario Type**: Regression
**Impact Level**: Important
**Priority**: Medium
**Related IDs**: AC-F2-2, F-2
**Test Type(s)**: Integration
**Automation Level**: Automated
**Target Layer / Location**: `scripts/.tests/test-install.sh`
**Tags**: @backend, @install, @regression

**Preconditions**:
- `test-install.sh` updated.

**Steps**:
1. Extend the mock source to include `doc/templates/blueprints/*.md` and `doc/templates/*.yaml`.
2. Add assertions that these install into the target (they previously did not).

**Expected Outcome**:
- Install test now guards the new recursive template classes; a future regression that drops them fails the install test too.

#### TC-UNINST-001 - test-uninstall.sh fixture renamed (drive-by)

**Scenario Type**: Regression
**Impact Level**: Minor
**Priority**: Medium
**Related IDs**: AC-F7-2, F-7
**Test Type(s)**: Integration
**Automation Level**: Automated
**Target Layer / Location**: `scripts/.tests/test-uninstall.sh`
**Tags**: @backend, @uninstall, @regression

**Preconditions**:
- `test-uninstall.sh` updated.

**Steps**:
1. Inspect `create_mock_ados_project` (~L209) and `test_local_uninstall_removes_guides` (~L497): assert the fixture/expectation uses `ados-tools-system-dependencies.md` (the current guide name), not the stale `system-dependencies.md`.

**Expected Outcome**:
- No stale `system-dependencies.md` reference remains; the uninstall test references the real guide name (AC-F7-2).

#### TC-PROC-001 - ci.yml runs the guard; failure blocks merge

**Scenario Type**: Regression
**Impact Level**: Critical
**Priority**: High
**Related IDs**: AC-F3-5, F-3
**Test Type(s)**: Manual
**Automation Level**: Semi-automated
**Target Layer / Location**: `.github/workflows/ci.yml`
**Tags**: @ci, @guard

**Preconditions**:
- `ci.yml` updated to run the guard.

**Steps**:
1. Read `.github/workflows/ci.yml`: assert a step runs `bash scripts/.tests/test-doc-distribution.sh` on `push` (branches `main`, `feat/**`, `fix/**`) and `pull_request` (to `main`).
2. Confirm the step's non-zero exit blocks the job (no `continue-on-error`, no `|| true`).
3. Optionally trigger the workflow on a branch with an intentional marker removal and confirm the run fails.

**Expected Outcome**:
- The guard is a merge gate (AC-F3-5). The pre-existing `# Future: Add additional quality gates here` placeholder is replaced by the real step.

#### TC-PROC-002 - AGENTS.md states marker mandatory + guard-must-pass

**Scenario Type**: Regression
**Impact Level**: Important
**Priority**: Medium
**Related IDs**: AC-F4-1, F-4
**Test Type(s)**: Manual
**Automation Level**: Semi-automated
**Target Layer / Location**: `AGENTS.md`
**Tags**: @docs, @process

**Preconditions**:
- `AGENTS.md` updated.

**Steps**:
1. Read `AGENTS.md`: assert text stating any new/changed doc under `doc/` MUST declare `ados_distribution`, and that a change introducing a redistributable doc MUST pass `test-doc-distribution.sh`.

**Expected Outcome**:
- Both requirements present in `AGENTS.md` (AC-F4-1).

#### TC-PROC-003 - pm-instructions.md states marker mandatory + guard-must-pass

**Scenario Type**: Regression
**Impact Level**: Important
**Priority**: Medium
**Related IDs**: AC-F4-1, F-4
**Test Type(s)**: Manual
**Automation Level**: Semi-automated
**Target Layer / Location**: `.ai/agent/pm-instructions.md`
**Tags**: @docs, @process

**Preconditions**:
- `pm-instructions.md` updated.

**Steps**:
1. Read `.ai/agent/pm-instructions.md`: assert the same two requirements as TC-PROC-002 (marker mandatory for new/changed docs under `doc/`; guard must pass for redistributable docs).

**Expected Outcome**:
- Both requirements present (AC-F4-1).

#### TC-PROC-004 - code-review-instructions.md has marker/guard checklist item

**Scenario Type**: Regression
**Impact Level**: Important
**Priority**: Medium
**Related IDs**: AC-F4-2, F-4
**Test Type(s)**: Manual
**Automation Level**: Semi-automated
**Target Layer / Location**: `.ai/agent/code-review-instructions.md`
**Tags**: @docs, @process, @review

**Preconditions**:
- `code-review-instructions.md` updated.

**Steps**:
1. Read `.ai/agent/code-review-instructions.md`: assert a checklist item requiring verification of the `ados_distribution` marker (present + correct value) for new/changed docs under `doc/guides|templates` or the handbook, and confirmation the guard passes when the doc is `redistributable`.

**Expected Outcome**:
- Checklist item present and correctly scoped (AC-F4-2). This is the gate neither #62 red-team round had.

#### TC-PROC-005 - No hand-added headers; .ados-claude regenerated only if .opencode edited

**Scenario Type**: Regression
**Impact Level**: Important
**Priority**: Medium
**Related IDs**: AC-F5-1, F-5, NFR-3
**Test Type(s)**: Manual
**Automation Level**: Semi-automated
**Target Layer / Location**: repo diff
**Tags**: @docs, @process

**Preconditions**:
- Delivery complete.

**Steps**:
1. `git diff` the change: assert no copyright/license header lines are hand-added to the 54 in-scope docs (the marker is inserted into existing frontmatter; headers stay managed solely by `scripts/add-header-location.sh` on configured paths).
2. Assert `.ados-claude/` is unchanged (no `.opencode/` file edited in this change → no regeneration expected).

**Expected Outcome**:
- Marker-only edits to docs; no header churn; `.ados-claude/` untouched (AC-F5-1, NFR-3).

#### TC-PROC-006 - Global-install path unchanged (NFR-3)

**Scenario Type**: Regression
**Impact Level**: Important
**Priority**: Medium
**Related IDs**: NFR-3, F-2
**Test Type(s)**: Manual
**Automation Level**: Semi-automated
**Target Layer / Location**: `scripts/install.sh`
**Tags**: @backend, @install, @review

**Preconditions**:
- Delivery complete.

**Steps**:
1. `git diff scripts/install.sh`: assert changes are confined to the **local** doc-distribution path (`install_local_files`, the manifest/template glob, the shared marker parser). Assert `install_global_files` / `do_global_install` are untouched.

**Expected Outcome**:
- Zero edits to global-install behavior (NFR-3).

## 6. Environments and Test Data

**Environment:** single `ubuntu-latest` GitHub Actions runner (matches CI). Local dev: any bash ≥4 on Linux/macOS. No network required (NFR-2); all tests run offline against the repo checkout.

**Isolation strategy:** every automated case uses a `mktemp -d` throwaway tree (mirrors `test-install.sh`/`test-uninstall.sh` `trap '_test_teardown' EXIT`). The guard's self-tests build synthetic fixtures in temp; they never mutate the real repo.

**Test data / fixtures:**
- **Mock ADOS source** (`create_mock_ados_source`, updated): must now include the `ados_distribution` marker on fixture files, `decision-making.md`, plus `blueprints/*` and `*.yaml` template fixtures (`*.yaml` fixture markers use the **top-level-key** form, not frontmatter, to mirror real register files). Marker values on fixtures must let TC-INST-003 exercise the `internal` exclusion path.
- **Parser unit fixtures** (TC-DIST-007/008/009 + TC-DIST-018): hand-built strings covering **BOTH** paths — `.md` frontmatter cases (body-occurrence trap, handbook's mixed comment+key block, no-frontmatter file) and the `.yaml` top-level-key path (positive line-1 key, missing-key, indented/nested-key non-match).
- **Negative-mode fixtures** (TC-DIST-005/006/010/011/012): derived by taking a green fixture and mutating exactly one attribute (remove marker / typo marker / drop a redistributable from the install set / add an internal to the install set).

**Install-set oracle (drift detection) — chosen approach & why it can't drift from `install.sh`:**

The guard's drift detector (TC-DIST-010/011/012) requires **two independently-derived sets**:

1. **Marker-derived expected set** — the set of redistributable docs, computed by the guard from markers + the DM-2 glob roots (`doc/guides/*.md`, `doc/templates/**`, standalone list). This is the *specification* of what should install.
2. **Install-derived actual set** — what `install.sh` *actually* copies, obtained by running `install_local_files` into a fresh temp target (sandbox) and enumerating the redistributable files present. This is the *behavior*.

The guard asserts set (1) == set (2), plus the two directional sub-invariants (redistributable⊆installed; internal∩installed=∅). **This is deliberately an independent oracle**: if the guard instead sourced the *same* derivation function `install.sh` uses, a glob bug (e.g. `install.sh` dropping `*.yaml`) would be mirrored in both sides and never caught — the drift detector would become a tautology. By deriving (1) purely from markers+globs and (2) from an actual sandbox install, any divergence between "spec" and "behavior" fails.

The one component that **must** be shared (not duplicated) is the marker **parser** itself: a single pure POSIX function `ados_parse_distribution_marker()` is authored once, unit-tested by TC-DIST-007/008/009, and used by both `install.sh` (to derive the guide set) and the guard (to derive set 1). Sharing the *parser* prevents parse-rule drift; keeping the *set-derivation* independent is what makes the drift test meaningful. This split is recorded as a delivery constraint for `@plan-writer`/`@coder`.

## 7. Automation Plan and Implementation Mapping

| TC ID(s) | File | Action | Execution command | Mocking | Status |
|----------|------|--------|-------------------|---------|--------|
| TC-DIST-001…018 | `scripts/.tests/test-doc-distribution.sh` | **New** | `bash scripts/.tests/test-doc-distribution.sh` | Temp fixtures; sandbox `install.sh --local` for oracle; shared `ados_parse_distribution_marker()` sourced from `install.sh` (or a tiny sourced lib) | To Implement |
| TC-DIST-007/008/009 + TC-DIST-018 | (within above) | New — two-path parser unit self-tests (`.md` frontmatter + `.yaml` top-level key) | (same) | Hand-built `.md` frontmatter strings + `.yaml` top-level-key strings (positive / negative / indented) | To Implement |
| TC-INST-001…004, TC-INST-007 | `scripts/.tests/test-install.sh` | **Update** | `bash scripts/.tests/test-install.sh` | Extend `create_mock_ados_source` (markers, `decision-making.md`, blueprints, yaml) + new assertions | Existing – Update |
| TC-INST-005 | `scripts/.tests/test-install.sh` | **Update** (new case) | (same) | Two-run idempotency harness in temp project | To Implement |
| TC-INST-006 | `scripts/.tests/test-install.sh` | **Update** | (same) | Add `decision-making.md` to mock (~L188) + assertion (~L758) | Existing – Update |
| TC-UNINST-001 | `scripts/.tests/test-uninstall.sh` | **Update** | `bash scripts/.tests/test-uninstall.sh` | Rename fixture ~L209 + assertion ~L497 | Existing – Update |
| TC-PROC-001 | `.github/workflows/ci.yml` | **Update** | CI; locally `bash scripts/.tests/test-doc-distribution.sh` | n/a | To Implement |
| TC-PROC-002/003/004 | `AGENTS.md`, `.ai/agent/pm-instructions.md`, `.ai/agent/code-review-instructions.md` | **Update** | `grep`-based content assertion (manual) | n/a | Manual Only |
| TC-PROC-005/006 | repo diff / `scripts/install.sh` | **No new file** | `git diff --check`; targeted `git diff` review | n/a | Manual Only |

**New files (1):** `scripts/.tests/test-doc-distribution.sh`.
**Updated files:** `scripts/.tests/test-install.sh`, `scripts/.tests/test-uninstall.sh`, `.github/workflows/ci.yml`.
**Manual-only (no test file):** process/reviewer hooks + header/global-path diff checks (TC-PROC-002…006). These align with the strategy's "docs → static/diff + content checks" mapping.

## 8. Risks, Assumptions, and Open Questions

### 8.1 Risks

| ID | Testing risk | Impact | Probability | Mitigation |
|----|--------------|--------|-------------|------------|
| TR-1 | Parser misreads mixed frontmatter (handbook) or a body `ados_distribution:` line ⇒ false green on the whole guard | H | M | TC-DIST-007/008/009 are mandatory unit self-tests authored *before* the guard's integration checks; the parser is a single shared, tested function (§6). |
| TR-2 | Drift detector is tautological (guard + install.sh share set-derivation) ⇒ glob bug masked | H | M | Oracle approach (§6): marker-derived expected set vs sandbox-derived actual set, independent computations. |
| TR-3 | Guard scope too broad ⇒ fails on legitimately unmarked `project-generated` files (RSK-2) | M | M | TC-DIST-014 asserts the closed DM-2 scope and that the guard passes on the current repo. |
| TR-4 | Negative-mode fixtures not isolated from the real repo ⇒ a real marker removal ships | M | L | All mutation tests run in `mktemp -d` fixtures; the guard run against the real checkout is a separate positive assertion (TC-DIST-004). |
| TR-5 | OQ-2 (invalid-marker rejection) under-tested ⇒ typo misclassification slips (RSK-6) | M | L | TC-DIST-006 explicitly asserts the 5th failure mode. |
| TR-6 | Idempotency contract ambiguity (OQ-TP-1) ⇒ TC-INST-005 asserts the wrong thing | M | L | **Resolved (red-team MAJ-3):** contract pinned to content-sync; TC-INST-005 now asserts deterministic convergence, not "files untouched" (see OQ-TP-1). Probability downgraded to L. |

### 8.2 Assumptions

- **Two-path parser keyed on file extension (PM-decided after red-team CRIT-1).** The 50 in-scope `.md` files (15 guides + 25 md-templates + 5 blueprints + 5 standalone) already have a frontmatter block; the marker is *inserted* into the first `---`-delimited block. The 4 `doc/templates/*.yaml` register templates have **no** frontmatter block (a `---` block would break `yaml.safe_load()` multi-doc consumers); their marker is a **top-level key** `^ados_distribution:` placed at line 1 (an indented/nested occurrence must NOT match). Same closed enum, two read paths — the spec's "all docs have frontmatter" statement (§2.1/§12) is superseded by this finding for the `.yaml` class.
- `ubuntu-latest` provides bash, git, grep, sed, awk, coreutils with no extra setup (NFR-4).
- `create_mock_ados_source`/`create_mock_project`/`ADOS_SOURCE_DIR` override remains the supported injection point for `install_local_files` (verified in `test-install.sh`).
- The 4 `*.yaml` register templates contain no private/repo-specific refs (ODR-0001 C-3) — not re-verified by tests; out of test scope.

### 8.3 Open Questions

| ID | Question | Blocking? | Owner | Notes |
|----|----------|-----------|-------|-------|
| OQ-TP-1 ✅ RESOLVED | **Idempotency contract.** Spec §13 says `copy_updatable_file` is "create-if-absent and idempotent", but the code (`copy_file_with_diff`) **content-syncs** updatable files (overwrites when content differs). | ~~Yes~~ Resolved | `@pm` | **PM decision (red-team MAJ-3):** content-sync is the intended behavior — templates/handbook are pristine upstream references; adopters copy them to a working file before filling in. "Non-destructive" = no loss of adopter *working* files (`ADOS_PROJECT_FILES`); only re-sync of upstream docs/templates. **NO install-behavior change.** `TC-INST-005` stays as written and now asserts *deterministic convergence* (two runs → identical tree), not "files untouched". Adopter mitigation: "copy a template to a working file before filling it in". |
| OQ-TP-2 | Should the shared parser live in `install.sh` (sourced) or a tiny sourced lib (`scripts/.ados-dist.sh`) used by both `install.sh` and the guard? | No | `@plan-writer` | Affects §6 "shared parser" but not test outcomes; either is acceptable provided it is *one* function. (Must implement the **two-path** logic — `.md` frontmatter + `.yaml` top-level key — per CRIT-1.) |
| OQ-TP-3 | Confirm OQ-2 (reject invalid marker value) is PM-decided "yes" — the request states it is; this plan treats it as decided. If reversed, delete TC-DIST-006 and downgrade RSK-6 acceptance. | No | `@pm` | Treated as resolved per the task brief. |

## 9. Plan Revision Log

| Version | Date | Author | Changes |
|---------|------|--------|---------|
| 1.0 | 2026-06-25T09:48:57Z | @test-plan-writer | Initial test plan for GH-67. 31 TCs; full AC/DM/NFR traceability; primary deliverable = `scripts/.tests/test-doc-distribution.sh` (5 failure modes + POSIX parser self-tests). |
| 1.1 | 2026-06-25T16:05:00Z | @test-plan-writer | Red-team remediation. **CRIT-1:** corrected the false "all 54 docs have frontmatter" assumption — 50 `.md` use frontmatter, 4 `.yaml` use a top-level key (`^ados_distribution:`, no `---` block); added `TC-DIST-018` (YAML top-level key: pos + missing + indented/non-match); reframed `TC-DIST-009` (`.md`-only); added `.yaml` path as the 5th parser self-test; updated `TC-DIST-002` to cover both paths. **MAJ-3:** resolved `OQ-TP-1` — content-sync is intended; `TC-INST-005` now asserts deterministic convergence + adopter-mitigation note. **MIN-1:** linked `implementation_plan` to the now-authored `chg-GH-67-plan.md`. **MIN-3:** `TC-DIST-014` reframed to a positive subset assertion. Totals now 32 TCs (18 `TC-DIST-*`); 19/19 ACs still covered. |

## 10. Test Execution Log

| TC ID | Run Date | Result | Notes |
|-------|----------|--------|-------|
| _not yet executed — populate during delivery (phase 5) and quality gates (phase 8)_ | | | |
