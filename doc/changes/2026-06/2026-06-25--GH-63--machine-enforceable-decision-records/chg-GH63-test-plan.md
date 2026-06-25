---
id: chg-GH63-test-plan
status: Proposed
created: 2026-06-25T17:10:00Z
last_updated: 2026-06-25T17:10:00Z
owners: ["@cwiakalski"]
service: delivery-os
labels: [decision-records, tooling, ci, json-schema, validation]
version_impact: none
summary: "Machine-enforceable decision-record quality — JSON Schemas for the landed GH-46 front matter and planning summaries, a stdlib-only validator CLI that turns the framework's rules into actionable failures, a deterministic index generator with a health report, a read-only /decision-index command, and a CI gate that blocks drift at PR time."
links:
  change_spec: ./chg-GH-63-spec.md
  implementation_plan: ./chg-GH-63-plan.md   # pending — not yet authored at test-planning time
  testing_strategy: .ai/rules/testing-strategy.md
---

# Test Plan - Machine-enforceable decision-record quality (JSON schemas, validator, index tool, CI gate)

## 1. Scope and Objectives

Unlike the GH-46/GH-60 decision-record changes (documentation/prompt-only, verified by structural inspection), **GH-63 introduces executable tooling**: two JSON Schema files under a new `schemas/` directory, two PATH-able `tools/` CLIs (`validate-decision-record`, `generate-decision-index`), a `/decision-index` command, a new CI job, and generated index output. Per `.ai/rules/testing-strategy.md`, `tools/<tool>` maps to `tools/.tests/test-<tool>.sh`, and the embedded Bash testing framework in `.ai/rules/bash.md` (assertions `assert_eq`/`assert_contains`/`assert_exit_code`, `run_test`, behavior/unit/integration categories) is the primary harness. CI-workflow and schema-of-truth assertions are **static inspection** (grep the YAML / schema JSON); determinism is proven by a two-run byte-diff; declarative↔imperative consistency is proven by a coverage check.

The core invariants this plan protects:

1. **Every in-scope §28.3 negative case is rejected** with an actionable error naming the record + field + rule (AC-GH63-5, NFR-8) — the central machine-enforcement guarantee.
2. **ADR-0001 + the template structure stay valid** (0 live records rejected; backward compatible — AC-GH63-1/4/14, NFR-2).
3. **The declarative schema and the imperative validator cannot silently drift** — every schema rule is hit by ≥1 validator test (AC-GH63-15, NFR-7, RSK-1).
4. **The index is deterministic** and its health report surfaces overdue reviews / missing deciders / missing metrics (AC-GH63-9/10, NFR-5).
5. **The CI gate is additive** (alongside `verify-claude-build`) and gates front-matter + index drift only — not the planning-summary over live docs (AC-GH63-12/13, DEC-3/6).
6. **The runtime stays stdlib-only** (no `jsonschema`, no `shellcheck` dependency — AC-GH63-8, SD-4, NFR-9).

Objectives: prove each of the 18 ACs with traceable, fixture-driven test cases; provide @coder unambiguous fixture names, target layers, and Given/When/Then so the `tools/.tests/test-*.sh` suites can be implemented without re-deriving requirements.

### 1.1 In Scope

- `schemas/decision-record-frontmatter.schema.json` and `schemas/decision-planning-summary.schema.json` (existence, draft 2020-12, nested-structure correctness, alias acceptance).
- `tools/validate-decision-record` — positive fixtures (exit 0); **one negative fixture + assertion per in-scope §28.3 case** (Appendix A rows 1,2,3,4,5,6,8,9,10); the verification-criteria heuristic (row 12).
- `tools/generate-decision-index` — determinism (two-run byte-identity); health-report dimensions (overdue reviews, missing deciders, missing metrics, future-field-aware waivers).
- `/decision-index` command — read-only w.r.t. records.
- `.github/workflows/ci.yml` — new gate job present, `verify-claude-build` preserved, path filter, gate scope (front-matter + index drift, not planning-summary over live docs).
- Migration linter — un-classified record valid as default R2; warnings, never rewrites.
- Schema-vs-validator coverage check (every schema rule hit; 0 uncovered).
- CLI convention compliance for both tools (`--help`/`--version`/`--dry-run`, exit codes, testable main guard, no `.sh` extension, embedded test framework).
- License headers exclusively from `scripts/add-header-location.sh`.
- Test suites `tools/.tests/test-validate-decision-record.sh` and `tools/.tests/test-generate-decision-index.sh` pass.

### 1.2 Out of Scope & Known Gaps

- **Deferred §28.3 cases** (Appendix A rows 7, 11, 13, 14) are owned by siblings GH-64/GH-65 and a future waiver/expiry field; they are verified only as a *disposition in the spec* (AC-GH63-7), not as validator rejections. NG-2/NG-3/NG-6.
- **Body-section order enforcement** beyond today's grep checks (NG-5) — not validated here.
- **`--strict` mode** (D-5) that promotes best-effort heuristics to hard errors — deferred.
- The raw decision-record **template file** (`doc/templates/decision-record-template.md`) contains `<...>` placeholders and is therefore not itself a validatable record; "the template validates" (AC-GH63-1/4) is interpreted as **schema↔template structural consistency + a template-instantiated valid record** (see OQ-GH63-2).
- Live `<decision_planning_summary>` instances do not persist under `doc/` (transient `/plan-decision` outputs); planning-summary correctness is proven by **synthetic fixtures under `tools/.tests/fixtures/`**, never by a CI pass over live docs (SD-3).

## 2. References

| Reference | Location |
|-----------|----------|
| Change specification (authoritative) | `./chg-GH-63-spec.md` — F-1…F-7, AC-GH63-1…18, NFR-1…9, DM-1…DM-4, RSK-1…8, SD-1…4, Appendix A |
| PM notes / decisions | `./chg-GH-63-pm-notes.yaml` |
| Ticket | `GH-63` (github.com/juliusz-cwiakalski/agentic-delivery-os/issues/63) |
| Implementation plan | `./chg-GH-63-plan.md` — *pending* (reconcile scenarios against it once authored) |
| Testing strategy | `.ai/rules/testing-strategy.md` |
| Bash rules + embedded test framework | `.ai/rules/bash.md` (§11 framework: `assert_eq`/`assert_contains`/`assert_exit_code`/`run_test`) |
| Tools convention | `doc/guides/tools-convention.md` (no `.sh`; `--help`/`--version`/`--dry-run`; semantic exit codes; `tools/.tests/test-<tool>.sh`) |
| Dogfood record (fixture source) | `doc/decisions/ADR-0001-decision-making-framework.md` |
| Decision-record template | `doc/templates/decision-record-template.md` |
| Current CI workflow | `.github/workflows/ci.yml` (one job: `verify-claude-build`) |
| Predecessor | GH-46 (PR #62) — landed the nested front matter this change schemas/validates |
| Sibling test-plan format references | `doc/changes/2026-06/2026-06-24--GH-60--decision-records-hard-requirements/chg-GH-60-test-plan.md`, `.../chg-GH-46-test-plan.md` |

## 3. Coverage Overview

### 3.1 Functional Coverage (Requirement/AC → Test Case IDs → Layer/Coverage)

| AC ID | Description (abridged) | TC ID(s) | Layer | Coverage |
|-------|------------------------|----------|-------|----------|
| AC-GH63-1 | Both schemas exist (draft 2020-12); ADR-0001 + template structure validate | TC-GH63-001, TC-GH63-004 | Static inspection + Unit (schema self-validity) | Covered |
| AC-GH63-2 | Front-matter schema documents GH-46 **nested** structure, not flat §17 sketch | TC-GH63-002 | Static inspection (schema JSON) | Covered |
| AC-GH63-3 | Planning-summary schema accepts generic + legacy alias blocks | TC-GH63-003 | Unit (fixture-driven) | Covered |
| AC-GH63-4 | ADR-0001 + template-instantiated + valid synthetic records validate clean (exit 0) | TC-GH63-004 | Unit (fixture-driven) | Covered |
| AC-GH63-5 | One HARD-FAIL rejection per in-scope §28.3 case (invalid decision_type; invalid status; impossible lifecycle transition incl. supersedes/superseded_by inconsistency; missing owners; missing decider for Accepted R2/R3; missing decision_date for Accepted; Accepted R3 without governance.reviewers; same factor as both constraint and driver) | TC-GH63-005 (case 1), TC-GH63-006 (case 2), TC-GH63-007 (case 3), TC-GH63-008 (case 4), TC-GH63-009 (case 5), TC-GH63-010 (case 6), TC-GH63-011 (case 10), TC-GH63-012 (case 8) | Unit/Integration (negative fixtures) | Covered (8 hard-fail TCs; case 9 non-negotiable-violation is a WARNING → AC-GH63-6/TC-013 per DEC-13/red-team C1) |
| AC-GH63-6 | Accepted record without non-empty `## Verification Criteria` → documented best-effort heuristic (labeled) | TC-GH63-014 | Unit (heuristic fixture) | Covered |
| AC-GH63-7 | Appendix A deferred cases each list rationale + owning sibling | TC-GH63-015 | Static inspection (spec Appendix A) | Covered |
| AC-GH63-8 | Validator runs stdlib-only (no `jsonschema`, no `shellcheck` dependency) | TC-GH63-016 | Static inspection + Behavior | Covered |
| AC-GH63-9 | `generate-decision-index` is byte-deterministic across two runs | TC-GH63-017 | Integration (two-run diff) | Covered |
| AC-GH63-10 | Health report flags overdue reviews, missing deciders, missing metrics, future-field-aware waiver (empty today) | TC-GH63-018 | Integration (health fixtures) | Covered |
| AC-GH63-11 | `/decision-index` regenerates index + health, read-only w.r.t. records | TC-GH63-019 | Static inspection + Behavior (hash before/after) | Covered |
| AC-GH63-12 | PR touching `doc/decisions/` or `schemas/` → new gate job runs both tools, failures block merge, `verify-claude-build` preserved | TC-GH63-020 | Static inspection (ci.yml) | Covered |
| AC-GH63-13 | CI gate runs front-matter validator + index drift; does NOT run planning-summary validator over live docs | TC-GH63-021 | Static inspection (ci.yml) | Covered |
| AC-GH63-14 | Un-classified record valid as default R2; migration linter warns, never rewrites | TC-GH63-022 | Unit + Behavior (hash before/after) | Covered |
| AC-GH63-15 | Every schema rule asserted by ≥1 validator test; coverage check reports 0 uncovered | TC-GH63-023 | Unit (meta/coverage) | Covered |
| AC-GH63-16 | Both tools follow tools-convention + bash.md (no `.sh`; `--help`/`--version`/`--dry-run`; exit codes; main guard; embedded framework) | TC-GH63-024, TC-GH63-025 | Behavior (CLI) + Static inspection | Covered |
| AC-GH63-17 | `bash tools/.tests/test-validate-decision-record.sh` and `.../test-generate-decision-index.sh` both pass | TC-GH63-026 | Aggregator (run suites) | Covered |
| AC-GH63-18 | License headers exclusively from `scripts/add-header-location.sh`; none hand-added | TC-GH63-027 | Static inspection (idempotent header run) | Covered |
| (cross-cutting) | Static/diff hygiene (`git diff --check`, JSON/YAML parse, executable bits) | TC-GH63-028 | Static/diff | Covered |

**AC coverage: 18 / 18 = 100%** (0 TODO). Every AC maps to ≥1 TC; every in-scope §28.3 case has a dedicated TC.

| F ID | Capability | TC ID(s) |
|------|-----------|----------|
| F-1 | Front-matter JSON Schema | TC-GH63-001, TC-GH63-002 |
| F-2 | Planning-summary JSON Schema | TC-GH63-001, TC-GH63-003 |
| F-3 | `validate-decision-record` CLI | TC-GH63-004…014, TC-GH63-016, TC-GH63-022, TC-GH63-024 |
| F-4 | `generate-decision-index` CLI | TC-GH63-017, TC-GH63-018, TC-GH63-025 |
| F-5 | `/decision-index` command | TC-GH63-019 |
| F-6 | CI gate | TC-GH63-020, TC-GH63-021 |
| F-7 | Backward-compatible migration linter | TC-GH63-022 |

### 3.2 Interface Coverage (API-#, EVT-#, DM-#)

No REST/HTTP (§8.1 N/A) and no events/messages (§8.2 N/A). Data-model coverage:

| DM ID | Element | TC ID(s) |
|-------|---------|----------|
| DM-1 | Front-matter nested field model (incl. rigor-aware required fields) | TC-GH63-002, TC-GH63-004, TC-GH63-009, TC-GH63-010, TC-GH63-011 |
| DM-2 | Planning-summary field model (generic + legacy alias; `hard_requirements` distinct from `decision_drivers`) | TC-GH63-003, TC-GH63-012, TC-GH63-013 |
| DM-3 | Index output model (ID/Type/Title/Status/Date/Owners + Health subsection) | TC-GH63-017, TC-GH63-018 |
| DM-4 | Default-rigor rule (absent `classification` → R2) | TC-GH63-022 |

### 3.3 Non-Functional Coverage (NFR-#)

| NFR ID | Requirement | TC ID(s) |
|--------|-------------|----------|
| NFR-1 | Git-native, no proprietary runtime, no network, no secrets | TC-GH63-016, TC-GH63-019, TC-GH63-027, TC-GH63-028 |
| NFR-2 | Backward compatibility (100% records valid; 0 rewrites; alias accepted; default R2) | TC-GH63-003, TC-GH63-004, TC-GH63-022 |
| NFR-3 | License headers via `scripts/add-header-location.sh` ONLY | TC-GH63-027 |
| NFR-4 | Tools follow tools-convention + bash.md | TC-GH63-024, TC-GH63-025, TC-GH63-026 |
| NFR-5 | Deterministic index output (byte-stable) | TC-GH63-017 |
| NFR-6 | CI gate fails on validation/index drift; path-filtered; `verify-claude-build` preserved | TC-GH63-020, TC-GH63-021 |
| NFR-7 | Declarative↔imperative consistency (every schema rule asserted; 0 uncovered) | TC-GH63-023 |
| NFR-8 | Actionable validation errors (record + field + rule; non-zero exit) | TC-GH63-005…013 |
| NFR-9 | Dependency-light runtime (no `jsonschema` pip; `shellcheck` absence tolerated) | TC-GH63-016 |

## 4. Test Types and Layers

GH-63 has a real executable surface, so most tests are **automated** under `tools/.tests/` using the embedded Bash framework (`.ai/rules/bash.md` §11). A few are static-inspection greps (CI YAML, schema JSON, spec Appendix A) and one is a meta coverage check.

- **Unit tests (fast, isolated, fixture-driven):** `tools/.tests/test-validate-decision-record.sh` — positive/negative fixtures under `tools/.tests/fixtures/`; assert exit codes + actionable error content via `assert_exit_code` / `assert_contains` / `assert_stderr_contains`. Covers AC-3,4,5,6,14 and the validator side of AC-15.
- **Integration tests (controlled corpus):** `tools/.tests/test-generate-decision-index.sh` — determinism (two-run `cmp`), health-report dimensions against a synthetic corpus. Covers AC-9,10.
- **Behavior tests (black-box CLI):** `--help`/`--version`/`--dry-run`, exit codes, main-guard sourcability, read-only-ness (record hash before/after) — for both tools and `/decision-index`. Covers AC-8,11,16.
- **Static/diff checks (always):** grep the schema JSON (nested vs flat), grep `.github/workflows/ci.yml` (job presence/scope/path-filter), grep spec Appendix A (deferred disposition), `scripts/add-header-location.sh` idempotency, `git diff --check`. Covers AC-1,2,7,12,13,18.
- **Meta/coverage check (AC-GH63-15):** a test that enumerates the schema rules and asserts each is exercised by ≥1 validator test; reports 0 uncovered.

Execution: from the repository root on branch `feat/GH-63/machine-enforceable-decision-records`. Fixtures are committed under `tools/.tests/fixtures/`. All corpus-mutating tests operate on a temp-dir copy (never on live `doc/decisions/`).

## 5. Test Scenarios

### 5.1 Scenario Index

| TC ID | Title | Type | Level | Priority | AC Coverage |
|-------|-------|------|-------|----------|-------------|
| TC-GH63-001 | Both schema files exist, valid draft 2020-12 JSON, self-valid | Static inspection + Unit | Critical | High | AC-1 |
| TC-GH63-002 | Front-matter schema documents nested GH-46 structure (not flat §17) | Static inspection | Critical | High | AC-2 |
| TC-GH63-003 | Planning-summary schema accepts generic + legacy alias fixtures | Unit | Critical | High | AC-3 |
| TC-GH63-004 | Validator accepts positive fixtures (ADR-0001, template-instantiated, synthetic) exit 0 | Unit | Critical | High | AC-1, AC-4 |
| TC-GH63-005 | Rejects invalid `decision_type` (§28.3 case 1) | Unit / Negative | Critical | High | AC-5 |
| TC-GH63-006 | Rejects invalid `status` (§28.3 case 2) | Unit / Negative | Critical | High | AC-5 |
| TC-GH63-007 | Rejects impossible lifecycle transition + supersedes/superseded_by inconsistency (§28.3 case 3) | Unit / Negative | Critical | High | AC-5 |
| TC-GH63-008 | Rejects missing `owners` (§28.3 case 4) | Unit / Negative | Critical | High | AC-5 |
| TC-GH63-009 | Rejects missing `governance.decider` for Accepted R2/R3 (§28.3 case 5) | Unit / Negative | Critical | High | AC-5 |
| TC-GH63-010 | Rejects missing `decision_date` for Accepted (§28.3 case 6) | Unit / Negative | Critical | High | AC-5 |
| TC-GH63-011 | Rejects Accepted R3 without non-empty `governance.reviewers` (§28.3 case 10) | Unit / Negative | Critical | High | AC-5 |
| TC-GH63-012 | Rejects same factor as both constraint and driver (planning-summary ∩ ≠ ∅) (§28.3 case 8) | Unit / Negative | Critical | High | AC-5 |
| TC-GH63-013 | WARNS on non-negotiable-constraint violation in chosen option (heuristic, exit 0) (§28.3 case 9) | Unit / Heuristic | Important | High | AC-6 |
| TC-GH63-014 | Accepted record without non-empty Verification Criteria → labeled heuristic (§28.3 case 12) | Unit / Edge | Important | Medium | AC-6 |
| TC-GH63-015 | Appendix A deferred cases each list rationale + owning sibling | Static inspection | Important | Medium | AC-7 |
| TC-GH63-016 | Validator runs stdlib-only (no `jsonschema`/`shellcheck` dependency) | Static inspection + Behavior | Critical | High | AC-8 |
| TC-GH63-017 | `generate-decision-index` is byte-deterministic across two runs | Integration | Critical | High | AC-9 |
| TC-GH63-018 | Health report flags overdue reviews, missing deciders, missing metrics, future-field-aware waiver (empty) | Integration | Critical | High | AC-10 |
| TC-GH63-019 | `/decision-index` regenerates index + health, read-only w.r.t. records | Behavior | Critical | High | AC-11 |
| TC-GH63-020 | CI gate: new job + `verify-claude-build` preserved + path filter + blocks merge | Static inspection | Critical | High | AC-12 |
| TC-GH63-021 | CI gate scope: front-matter validator + index drift; NOT planning-summary over live docs | Static inspection | Critical | High | AC-13 |
| TC-GH63-022 | Un-classified record valid as default R2; migration linter warns, never rewrites | Unit + Behavior | Important | High | AC-14 |
| TC-GH63-023 | Schema-vs-validator coverage: every schema rule hit; 0 uncovered | Unit (meta) | Critical | High | AC-15 |
| TC-GH63-024 | `validate-decision-record` CLI conventions (no `.sh`; `--help`/`--version`/`--dry-run`; exit codes; main guard; framework) | Behavior + Static | Important | High | AC-16 |
| TC-GH63-025 | `generate-decision-index` CLI conventions | Behavior + Static | Important | High | AC-16 |
| TC-GH63-026 | Both `tools/.tests/` suites pass via bash | Aggregator | Critical | High | AC-17 |
| TC-GH63-027 | License headers exclusively from `scripts/add-header-location.sh` | Static inspection | Important | Medium | AC-18 |
| TC-GH63-028 | Static/diff hygiene: `git diff --check` + JSON/YAML parse + executable bits | Static/diff | Important | High | (cross-cutting) |

### 5.2 Scenario Details

---

#### TC-GH63-001 - Both schema files exist, valid draft 2020-12 JSON, self-valid

**Scenario Type**: Happy Path
**Impact Level**: Critical
**Priority**: High
**Traceability (Related IDs)**: F-1, F-2, AC-GH63-1, NFR-1
**Test Type(s)**: Static inspection + Unit
**Automation Level**: Automated
**Target Layer / Location**: `schemas/decision-record-frontmatter.schema.json`, `schemas/decision-planning-summary.schema.json`; test in `tools/.tests/test-validate-decision-record.sh`
**Tags**: @backend, @schema

**Given/When/Then**:
- **Given** the new `schemas/` directory, **when** both schema files are parsed, **then** they are valid JSON, declare `draft 2020-12`, and both exist (front matter + planning summary).

**Preconditions**:

- Schemas authored (delivery phase 1).

**Steps**:

1. `ls schemas/decision-record-frontmatter.schema.json schemas/decision-planning-summary.schema.json` → both exist.
2. `jq -e '.["$schema"]' schemas/decision-record-frontmatter.schema.json` → contains `2020-12`.
3. `jq -e '.["$schema"]' schemas/decision-planning-summary.schema.json` → contains `2020-12`.
4. `jq empty schemas/decision-record-frontmatter.schema.json && jq empty schemas/decision-planning-summary.schema.json` → both parse (exit 0).

**Expected Result**:

- Both files present; both declare draft 2020-12; both are syntactically valid JSON (`jq empty` exit 0). Satisfies the "schemas exist for both front matter and planning summary" clause of AC-1.

---

#### TC-GH63-002 - Front-matter schema documents the GH-46 nested structure (not the flat §17 sketch)

**Scenario Type**: Regression
**Impact Level**: Critical
**Priority**: High
**Traceability (Related IDs)**: F-1, AC-GH63-2, SD-1, DEC-1, DM-1
**Test Type(s)**: Static inspection
**Automation Level**: Automated
**Target Layer / Location**: `schemas/decision-record-frontmatter.schema.json`; test in `tools/.tests/test-validate-decision-record.sh`
**Tags**: @backend, @schema

**Given/When/Then**:
- **Given** the front-matter schema, **when** its properties are read, **then** it defines nested `classification`/`governance`/`ai_assistance`/`revisit_triggers`/`links` and does **not** adopt the flat §17 top-level keys (`driver`, `decider`, `decision_domains`, `rigor_profile`, `specs`).

**Preconditions**:

- Schema authored per SD-1.

**Steps**:

1. `jq -e '.properties.classification' schemas/decision-record-frontmatter.schema.json` → present.
2. `jq -e '.properties.governance | .properties.ai_assistance | .properties.revisit_triggers | .properties.links' schemas/decision-record-frontmatter.schema.json` → all present.
3. `jq '.properties | keys[]' schemas/decision-record-frontmatter.schema.json | rg '^(driver|decider|decision_domains|rigor_profile|specs)$'` → **0 matches** (flat §17 sketch rejected).
4. Confirm `governance.decider`, `governance.reviewers`, `classification.rigor` are nested under their parents (not top-level).

**Expected Result**:

- Nested GH-46 blocks present; flat §17 top-level keys absent. This is the SD-1 correctness guard (RSK-8).

---

#### TC-GH63-003 - Planning-summary schema accepts generic + legacy alias fixtures

**Scenario Type**: Happy Path
**Impact Level**: Critical
**Priority**: High
**Traceability (Related IDs)**: F-2, AC-GH63-3, DM-2, NFR-2
**Test Type(s)**: Unit
**Automation Level**: Automated
**Target Layer / Location**: `tools/validate-decision-record` with `tools/.tests/fixtures/planning-summary/`; test in `tools/.tests/test-validate-decision-record.sh`
**Tags**: @backend, @schema

**Given/When/Then**:
- **Given** a generic `<decision_planning_summary>` block and a legacy `<technical_decision_planning_summary>`/`adr.*` block (fixtures), **when** validated, **then** both are accepted via the GH-46 alias mapping (exit 0).

**Preconditions**:

- Fixtures committed: `fixtures/planning-summary/generic-summary.json`, `fixtures/planning-summary/legacy-alias-summary.json`.

**Steps**:

1. `tools/validate-decision-record --summary fixtures/planning-summary/generic-summary.json` → exit 0.
2. `tools/validate-decision-record --summary fixtures/planning-summary/legacy-alias-summary.json` → exit 0.
3. Confirm the legacy fixture uses the `<technical_decision_planning_summary>` tag and `adr.*` field alias and is still accepted with no behavior change.

**Expected Result**:

- Both fixtures validate clean; the legacy alias path does not error (NFR-2 backward compatibility).

---

#### TC-GH63-004 - Validator accepts positive fixtures (ADR-0001, template-instantiated, synthetic) exit 0

**Scenario Type**: Happy Path
**Impact Level**: Critical
**Priority**: High
**Traceability (Related IDs)**: F-3, AC-GH63-1, AC-GH63-4, NFR-2
**Test Type(s)**: Unit
**Automation Level**: Automated
**Target Layer / Location**: `tools/validate-decision-record`; fixtures under `tools/.tests/fixtures/positive/`; test in `tools/.tests/test-validate-decision-record.sh`
**Tags**: @backend, @validator

**Given/When/Then**:
- **Given** valid fixtures, **when** `tools/validate-decision-record` runs, **then** it exits 0 and reports no errors.

**Preconditions**:

- Positive fixtures committed: a snapshot of `ADR-0001` (`fixtures/positive/adr-0001-snapshot.md`), a template-instantiated valid R2 record (`fixtures/positive/template-instantiated-r2.md`), an Accepted R2 with decider+decision_date (`fixtures/positive/accepted-r2-with-decider.md`), an Accepted R3 with non-empty reviewers (`fixtures/positive/accepted-r3-with-reviewers.md`).

**Steps**:

1. `tools/validate-decision-record fixtures/positive/adr-0001-snapshot.md` → exit 0, stderr empty of errors.
2. `tools/validate-decision-record fixtures/positive/template-instantiated-r2.md` → exit 0.
3. `tools/validate-decision-record fixtures/positive/accepted-r2-with-decider.md` → exit 0.
4. `tools/validate-decision-record fixtures/positive/accepted-r3-with-reviewers.md` → exit 0.
5. `tools/validate-decision-record <dir-with-all-positive-fixtures>` → exit 0 (directory mode).

**Expected Result**:

- All positive fixtures validate clean (exit 0). Notably ADR-0001 — `status: Proposed`, rigor R3, empty `reviewers: []`, null `decider`, null `decision_date` — validates because acceptance-gated fields are not required pre-Acceptance (see OQ-GH63-1). No live record is rejected (NFR-2).

**Notes / Clarifications**:

- "The template validates" is realized via the template-instantiated fixture; the raw template has `<...>` placeholders and is covered structurally by TC-GH63-001/002 (see OQ-GH63-2).

---

#### TC-GH63-005 - Rejects invalid `decision_type` (§28.3 case 1)

**Scenario Type**: Negative
**Impact Level**: Critical
**Priority**: High
**Traceability (Related IDs)**: F-3, AC-GH63-5 (Appendix A row 1), NFR-8
**Test Type(s)**: Unit
**Automation Level**: Automated
**Target Layer / Location**: `tools/validate-decision-record`; fixture `tools/.tests/fixtures/negative/invalid-decision-type.md`; test in `tools/.tests/test-validate-decision-record.sh`
**Tags**: @backend, @validator, @negative

**Given/When/Then**:
- **Given** a fixture whose `decision_type` is not in `{adr,pdr,tdr,bdr,odr}` (e.g., `arch`), **when** the validator runs, **then** it exits non-zero with an actionable error naming the record, the `decision_type` field, and the violated enum rule.

**Preconditions**:

- Fixture committed with `decision_type: arch` (or other out-of-enum value), all other fields valid.

**Steps**:

1. `tools/validate-decision-record fixtures/negative/invalid-decision-type.md; echo $?` → non-zero (≠ 0).
2. Capture stderr → `assert_contains` the record filename/id.
3. `assert_contains` the field `decision_type`.
4. `assert_contains` an enum/rule marker (e.g., `adr|pdr|tdr|bdr|odr`).

**Expected Result**:

- Non-zero exit; error names record + `decision_type` field + valid-values rule (NFR-8 actionable).

---

#### TC-GH63-006 - Rejects invalid `status` (§28.3 case 2)

**Scenario Type**: Negative
**Impact Level**: Critical
**Priority**: High
**Traceability (Related IDs)**: F-3, AC-GH63-5 (Appendix A row 2), NFR-8
**Test Type(s)**: Unit
**Automation Level**: Automated
**Target Layer / Location**: `tools/validate-decision-record`; fixture `tools/.tests/fixtures/negative/invalid-status.md`; test in `tools/.tests/test-validate-decision-record.sh`
**Tags**: @backend, @validator, @negative

**Given/When/Then**:
- **Given** a fixture whose `status` is not in `{Proposed, Under Review, Accepted, Deprecated, Superseded}` (e.g., `Done`), **when** the validator runs, **then** it exits non-zero naming the record, `status`, and the enum rule.

**Preconditions**:

- Fixture committed with an invalid `status`.

**Steps**:

1. Run validator on fixture → assert non-zero exit.
2. Capture stderr → `assert_contains` record id; `assert_contains` `status`; `assert_contains` a valid-status marker.

**Expected Result**:

- Non-zero exit; actionable error names record + `status` field + status enum.

---

#### TC-GH63-007 - Rejects impossible lifecycle transition + supersedes/superseded_by inconsistency (§28.3 case 3)

**Scenario Type**: Negative
**Impact Level**: Critical
**Priority**: High
**Traceability (Related IDs)**: F-3, AC-GH63-5 (Appendix A row 3), NFR-8
**Test Type(s)**: Unit
**Automation Level**: Automated
**Target Layer / Location**: `tools/validate-decision-record`; fixtures `tools/.tests/fixtures/negative/impossible-transition.md` and `tools/.tests/fixtures/negative/supersedes-mismatch.md`; test in `tools/.tests/test-validate-decision-record.sh`
**Tags**: @backend, @validator, @negative

**Given/When/Then**:
- **Given** (a) a record asserting an impossible lifecycle transition (e.g., `Accepted` regressing to `Proposed`, or a `Superseded` record with empty `superseded_by`), and (b) a `supersedes`/`superseded_by` inconsistency, **when** the validator runs, **then** each fixture exits non-zero with an actionable error naming the lifecycle/consistency rule.

**Preconditions**:

- Two fixtures committed: one with an impossible transition; one where `links.supersedes`/`links.superseded_by` disagree (e.g., A supersedes B but B's `superseded_by` does not list A).

**Steps**:

1. `tools/validate-decision-record fixtures/negative/impossible-transition.md` → non-zero exit; stderr names record + lifecycle rule.
2. `tools/validate-decision-record fixtures/negative/supersedes-mismatch.md` → non-zero exit; stderr names record + `supersedes`/`superseded_by` consistency rule.
3. Both errors are actionable (record id + field + rule).

**Expected Result**:

- Both sub-cases rejected (Appendix A row 3 spans both the transition and the consistency check).

---

#### TC-GH63-008 - Rejects missing `owners` (§28.3 case 4)

**Scenario Type**: Negative
**Impact Level**: Critical
**Priority**: High
**Traceability (Related IDs)**: F-3, AC-GH63-5 (Appendix A row 4), NFR-8
**Test Type(s)**: Unit
**Automation Level**: Automated
**Target Layer / Location**: `tools/validate-decision-record`; fixture `tools/.tests/fixtures/negative/missing-owners.md`; test in `tools/.tests/test-validate-decision-record.sh`
**Tags**: @backend, @validator, @negative

**Given/When/Then**:
- **Given** a record with an empty/absent `owners` array (minItems 1), **when** validated, **then** non-zero exit naming the record, `owners`, and the minItems rule.

**Preconditions**:

- Fixture committed with `owners: []` (or `owners` omitted).

**Steps**:

1. Run validator → non-zero exit.
2. stderr `assert_contains` record id; `assert_contains` `owners`; `assert_contains` a minItems/≥1 marker.

**Expected Result**:

- Rejected with actionable `owners` error.

---

#### TC-GH63-009 - Rejects missing `governance.decider` for Accepted R2/R3 (§28.3 case 5)

**Scenario Type**: Negative
**Impact Level**: Critical
**Priority**: High
**Traceability (Related IDs)**: F-3, AC-GH63-5 (Appendix A row 5), DM-1, NFR-8
**Test Type(s)**: Unit
**Automation Level**: Automated
**Target Layer / Location**: `tools/validate-decision-record`; fixture `tools/.tests/fixtures/negative/accepted-r2-missing-decider.md`; test in `tools/.tests/test-validate-decision-record.sh`
**Tags**: @backend, @validator, @negative

**Given/When/Then**:
- **Given** an **Accepted** record at rigor R2 (or R3) with `governance.decider` null/absent, **when** validated, **then** non-zero exit naming the record, `governance.decider`, and the "decider required for Accepted R2/R3" rule.

**Preconditions**:

- Fixture committed: `status: Accepted`, `classification.rigor: R2`, `decision_date` set, `governance.decider: null`.

**Steps**:

1. Run validator → non-zero exit.
2. stderr `assert_contains` record id; `assert_contains` `decider`; `assert_contains` `Accepted` (and/or R2/R3).

**Expected Result**:

- Rejected; actionable error ties the missing decider to the Accepted + rigor condition (DM-1).

---

#### TC-GH63-010 - Rejects missing `decision_date` for Accepted (§28.3 case 6)

**Scenario Type**: Negative
**Impact Level**: Critical
**Priority**: High
**Traceability (Related IDs)**: F-3, AC-GH63-5 (Appendix A row 6), DM-1, NFR-8
**Test Type(s)**: Unit
**Automation Level**: Automated
**Target Layer / Location**: `tools/validate-decision-record`; fixture `tools/.tests/fixtures/negative/accepted-missing-decision-date.md`; test in `tools/.tests/test-validate-decision-record.sh`
**Tags**: @backend, @validator, @negative

**Given/When/Then**:
- **Given** an **Accepted** record with `decision_date: null` (or absent), **when** validated, **then** non-zero exit naming the record, `decision_date`, and the "decision_date non-null when Accepted" rule.

**Preconditions**:

- Fixture committed: `status: Accepted`, `decision_date: null` (decider present to isolate the rule).

**Steps**:

1. Run validator → non-zero exit.
2. stderr `assert_contains` record id; `assert_contains` `decision_date`; `assert_contains` `Accepted`.

**Expected Result**:

- Rejected; actionable error names `decision_date` + Accepted rule.

---

#### TC-GH63-011 - Rejects Accepted R3 without non-empty `governance.reviewers` (§28.3 case 10)

**Scenario Type**: Negative
**Impact Level**: Critical
**Priority**: High
**Traceability (Related IDs)**: F-3, AC-GH63-5 (Appendix A row 10), DM-1, NFR-8
**Test Type(s)**: Unit
**Automation Level**: Automated
**Target Layer / Location**: `tools/validate-decision-record`; fixture `tools/.tests/fixtures/negative/accepted-r3-missing-reviewers.md`; test in `tools/.tests/test-validate-decision-record.sh`
**Tags**: @backend, @validator, @negative

**Given/When/Then**:
- **Given** an **Accepted** rigor-R3 record with empty `governance.reviewers`, **when** validated, **then** non-zero exit naming the record, `governance.reviewers`, and the "R3 requires reviewers" rule.

**Preconditions**:

- Fixture committed: `status: Accepted`, `classification.rigor: R3`, `governance.reviewers: []`, decider + decision_date present to isolate the rule.

**Steps**:

1. Run validator → non-zero exit.
2. stderr `assert_contains` record id; `assert_contains` `reviewers`; `assert_contains` `R3`.

**Expected Result**:

- Rejected; actionable error ties empty reviewers to R3.

**Notes / Clarifications**:

- The negative fixture is **Accepted** R3 (unambiguously failing under any interpretation). DM-1 phrases the reviewers rule as "required non-empty when rigor = R3" without a status qualifier, yet ADR-0001 (Proposed R3, empty reviewers) must pass per AC-1/AC-4 — see OQ-GH63-1. This TC's Accepted fixture avoids that ambiguity while still exercising the rule.

---

#### TC-GH63-012 - Rejects same factor as both constraint and driver (§28.3 case 8)

**Scenario Type**: Negative
**Impact Level**: Critical
**Priority**: High
**Traceability (Related IDs)**: F-3, AC-GH63-5 (Appendix A row 8), DM-2, NFR-8
**Test Type(s)**: Unit
**Automation Level**: Automated
**Target Layer / Location**: `tools/validate-decision-record` (planning-summary mode); fixture `tools/.tests/fixtures/negative/summary-constraint-driver-overlap.json`; test in `tools/.tests/test-validate-decision-record.sh`
**Tags**: @backend, @validator, @negative

**Given/When/Then**:
- **Given** a planning summary where `hard_requirements` and `decision_drivers` share ≥1 factor, **when** validated, **then** non-zero exit naming the summary, the overlap, and the "hard_requirements ∩ decision_drivers = ∅" rule.

**Preconditions**:

- Fixture committed: a `<decision_planning_summary>` (or alias) where the same factor string appears in both lists.

**Steps**:

1. `tools/validate-decision-record --summary fixtures/negative/summary-constraint-driver-overlap.json` → non-zero exit.
2. stderr `assert_contains` an overlap/constraint-driver rule marker; `assert_contains` the duplicated factor.

**Expected Result**:

- Rejected; actionable error surfaces the constraint/driver overlap (DM-2).

---

#### TC-GH63-013 - Detects non-negotiable-constraint violation in chosen option (best-effort) (§28.3 case 9)

**Scenario Type**: Negative
**Impact Level**: Important
**Priority**: High
**Traceability (Related IDs)**: F-3, AC-GH63-5 (Appendix A row 9, best-effort), DEC-10, RSK-6, NFR-8
**Test Type(s)**: Unit
**Automation Level**: Automated
**Target Layer / Location**: `tools/validate-decision-record` (planning-summary mode); fixture `tools/.tests/fixtures/negative/summary-non-negotiable-violation.json`; test in `tools/.tests/test-validate-decision-record.sh`
**Tags**: @backend, @validator, @negative

**Given/When/Then**:
- **Given** a planning summary whose chosen option violates a `negotiable: no` constraint (best-effort, using available compliance data), **when** validated, **then** the validator flags it (labeled best-effort) naming the constraint + chosen option.

**Preconditions**:

- Fixture committed: a summary with a non-negotiable constraint and a chosen-option compliance entry that violates it.

**Steps**:

1. Run validator in summary mode → it surfaces the violation (assert the output contains a best-effort/non-negotiable marker + the constraint id and the chosen option).
2. Confirm the finding is clearly labeled as best-effort (per DEC-10 / RSK-6), not a structural guarantee.

**Expected Result**:

- Violation detected, labeled best-effort/`[HEURISTIC]`/`[WARN]`, and the validator exits **0** (non-blocking warning per DEC-13 — case 9 is a WARNING, NOT a hard failure; red-team C1). This TC asserts the **detection + `[WARN]`/`[HEURISTIC]` labeling + actionable content (constraint id, chosen option) + exit code 0**, not a non-zero exit.

---

#### TC-GH63-014 - Accepted record without non-empty Verification Criteria → labeled heuristic (§28.3 case 12)

**Scenario Type**: Edge Case
**Impact Level**: Important
**Priority**: Medium
**Traceability (Related IDs)**: F-3, AC-GH63-6 (Appendix A row 12, heuristic), DEC-10, RSK-6
**Test Type(s)**: Unit
**Automation Level**: Automated
**Target Layer / Location**: `tools/validate-decision-record`; fixture `tools/.tests/fixtures/negative/accepted-missing-verification-criteria.md`; test in `tools/.tests/test-validate-decision-record.sh`
**Tags**: @backend, @validator, @heuristic

**Given/When/Then**:
- **Given** an **Accepted** record whose body lacks a non-empty `## Verification Criteria`, **when** the validator runs, **then** it reports this via the documented best-effort heuristic, clearly labeled as a heuristic (not a structural guarantee).

**Preconditions**:

- Fixture committed: `status: Accepted`, valid front matter, body with no `## Verification Criteria` (or an empty one).

**Steps**:

1. Run validator → capture combined output.
2. `assert_contains` output → `Verification Criteria`.
3. `assert_contains` output → a heuristic label (e.g., `heuristic` / `[HEURISTIC]` / `best-effort`).
4. `assert_not_contains` output → any claim that this is a structural/hard guarantee.

**Expected Result**:

- The heuristic fires and is labeled as such. (ADR-0001 is `Proposed`, so this heuristic does **not** fire on the dogfood — keeping TC-GH63-004 clean.)

---

#### TC-GH63-015 - Appendix A deferred cases each list rationale + owning sibling

**Scenario Type**: Happy Path
**Impact Level**: Important
**Priority**: Medium
**Traceability (Related IDs)**: AC-GH63-7, SD-2, DEC-2, RSK-3
**Test Type(s)**: Static inspection
**Automation Level**: Automated
**Target Layer / Location**: `doc/changes/2026-06/2026-06-25--GH-63--machine-enforceable-decision-records/chg-GH-63-spec.md` (Appendix A); test in `tools/.tests/test-validate-decision-record.sh`
**Tags**: @backend, @docs

**Given/When/Then**:
- **Given** the §28.3 negative-case disposition (Appendix A), **when** the DEFERRED rows are read, **then** each lists a rationale and the owning sibling ticket (GH-64 / GH-65 / future field).

**Preconditions**:

- Spec Appendix A authored (it is).

**Steps**:

1. `rg -n 'DEFERRED' chg-GH-63-spec.md` → expect 4 matches (rows 7, 11, 13, 14).
2. For each deferred row, confirm a rationale text and an owning reference: row 7 → `GH-64`; row 11 → `GH-65`; row 13 → future field / `GH-65`; row 14 → `GH-64`.
3. `rg -n 'GH-64|GH-65' chg-GH-63-spec.md` → owning siblings present against the deferred rows.

**Expected Result**:

- All 4 deferred cases carry rationale + owning sibling (satisfies the AC-7 "expectation gap" mitigation, RSK-3).

---

#### TC-GH63-016 - Validator runs stdlib-only (no `jsonschema`/`shellcheck`/network dependency)

**Scenario Type**: Negative
**Impact Level**: Critical
**Priority**: High
**Traceability (Related IDs)**: F-3, AC-GH63-8, SD-4, DEC-4, NFR-9
**Test Type(s)**: Static inspection + Behavior
**Automation Level**: Automated
**Target Layer / Location**: `tools/validate-decision-record`, `tools/generate-decision-index`; test in `tools/.tests/test-validate-decision-record.sh`
**Tags**: @backend, @runtime

**Given/When/Then**:
- **Given** CI's stock `ubuntu-latest` `python3` (no `jsonschema`) and no `shellcheck`, **when** the tools run, **then** they execute using stdlib only — 0 pip installs and no dependency on `shellcheck`/`jsonschema`.

**Preconditions**:

- Tools implemented (SD-4).

**Steps**:

1. `rg -n 'jsonschema|pip install|import jsonschema' tools/validate-decision-record tools/generate-decision-index` → **0** hard dependencies (any reference must be a comment/rationale, not an import/require).
2. `rg -n 'shellcheck' tools/validate-decision-record tools/generate-decision-index` → not required at runtime (absence tolerated, NFR-9).
3. **No network calls (DEC-14, red-team M3):** `rg -n '\bcurl\b|\bwget\b|_check_version|raw\.githubusercontent\.com' tools/validate-decision-record tools/generate-decision-index` → **0** matches (the tools omit the automatic version-check; they are repo-internal delivery tools, not standalone-installable utilities).
4. Behavior: run the validator against a positive fixture in an environment without `jsonschema`/`shellcheck` (the test runtime) → exit 0.

**Expected Result**:

- No `jsonschema`/pip dependency; no `shellcheck` requirement; validator runs to success on stdlib.

---

#### TC-GH63-017 - `generate-decision-index` is byte-deterministic across two runs

**Scenario Type**: Corner Case
**Impact Level**: Critical
**Priority**: High
**Traceability (Related IDs)**: F-4, AC-GH63-9, DM-3, NFR-5, RSK-5
**Test Type(s)**: Integration
**Automation Level**: Automated
**Target Layer / Location**: `tools/generate-decision-index`; test in `tools/.tests/test-generate-decision-index.sh`
**Tags**: @backend, @index

**Given/When/Then**:
- **Given** `tools/generate-decision-index`, **when** run twice against the same `doc/decisions/*.md` input set, **then** it produces byte-identical `00-index.md` output.

**Preconditions**:

- A fixture corpus copied to a temp dir (e.g., ADR-0001 + 1–2 synthetic records).

**Steps**:

1. Copy fixture corpus into `${TMPDIR}/corpus-a` and `${TMPDIR}/corpus-b`.
2. `tools/generate-decision-index --output "${TMPDIR}/a.md" "${TMPDIR}/corpus-a"`.
3. `tools/generate-decision-index --output "${TMPDIR}/b.md" "${TMPDIR}/corpus-b"`.
4. `cmp -s "${TMPDIR}/a.md" "${TMPDIR}/b.md"; echo $?` → `0` (byte-identical).
5. Re-run a third time against corpus-a → `cmp` with the first run → `0`.

**Expected Result**:

- `cmp` reports no differences across runs (NFR-5 byte-stability). This guards false-positive CI drift (RSK-5).

---

#### TC-GH63-018 - Health report flags overdue reviews, missing deciders, missing metrics, future-field-aware waiver (empty)

**Scenario Type**: Corner Case
**Impact Level**: Critical
**Priority**: High
**Traceability (Related IDs)**: F-4, AC-GH63-10, DM-3, DEC-11
**Test Type(s)**: Integration
**Automation Level**: Automated
**Target Layer / Location**: `tools/generate-decision-index`; fixtures under `tools/.tests/fixtures/health/`; test in `tools/.tests/test-generate-decision-index.sh`
**Tags**: @backend, @index, @health

**Given/When/Then**:
- **Given** `tools/generate-decision-index` scanning a synthetic corpus, **when** it emits the health subsection, **then** it flags overdue reviews, missing deciders (Accepted R2/R3 without `governance.decider`), missing metrics, and reports the future-field-aware waiver dimension (empty today).

**Preconditions**:

- Health fixtures committed: `fixtures/health/overdue-review.md` (`review_date` in the past), `fixtures/health/accepted-missing-decider.md` (Accepted R2, no decider), `fixtures/health/missing-metrics.md` (Accepted record, empty `links.metrics`).

**Steps**:

1. Build a temp corpus containing the three health fixtures.
2. Run `generate-decision-index` → capture the Health subsection.
3. `assert_contains` health output → overdue-review record id under an "overdue review" marker.
4. `assert_contains` → accepted-missing-decider record id under a "missing decider" marker.
5. `assert_contains` → missing-metrics record id under a "missing metrics" marker.
6. `assert_contains` → a waiver dimension heading/line that is **empty** (no open/expired waivers, since no waiver field is landed — DEC-11).

**Expected Result**:

- All four health dimensions present; waiver dimension present but empty. (Each dimension has its own fixture so a single regression is locatable.)

---

#### TC-GH63-019 - `/decision-index` regenerates index + health, read-only w.r.t. records

**Scenario Type**: Happy Path
**Impact Level**: Critical
**Priority**: High
**Traceability (Related IDs)**: F-5, AC-GH63-11, DEC-9, NFR-1
**Test Type(s)**: Static inspection + Behavior
**Automation Level**: Automated
**Target Layer / Location**: `.opencode/command/decision-index.md`, `tools/generate-decision-index`; test in `tools/.tests/test-generate-decision-index.sh`
**Tags**: @backend, @command

**Given/When/Then**:
- **Given** the `/decision-index` command, **when** invoked, **then** it regenerates the index + health report and does **not** mutate any decision record.

**Preconditions**:

- `/decision-index` command delivered (via `@toolsmith`); delegates to `generate-decision-index`.

**Steps**:

1. `ls .opencode/command/decision-index.md` → exists.
2. `rg -n 'generate-decision-index|read-only|does not (mutate|modify)' .opencode/command/decision-index.md` → delegates to the generator and documents read-only-ness.
3. Copy fixture corpus to `${TMPDIR}`; hash all record files (`sha256sum`).
4. Invoke the index generation (the command's effect) against the corpus.
5. Re-hash all record files → `assert_eq` before/after per record (0 bytes changed).
6. Confirm the index artifact was (re)written.

**Expected Result**:

- Command delegates to `generate-decision-index`; records are byte-unchanged (read-only w.r.t. records, DEC-9); only the index artifact changes.

---

#### TC-GH63-020 - CI gate: new job + `verify-claude-build` preserved + path filter + blocks merge

**Scenario Type**: Regression
**Impact Level**: Critical
**Priority**: High
**Traceability (Related IDs)**: F-6, AC-GH63-12, DEC-6, NFR-6
**Test Type(s)**: Static inspection
**Automation Level**: Automated
**Target Layer / Location**: `.github/workflows/ci.yml`; test in `tools/.tests/test-validate-decision-record.sh`
**Tags**: @backend, @ci

**Given/When/Then**:
- **Given** a PR touching `doc/decisions/` or `schemas/`, **when** CI runs, **then** a **new** gate job executes both tools, failures block merge, and the existing `verify-claude-build` job is preserved unchanged.

**Preconditions**:

- CI workflow updated (delivery phase 5).

**Steps**:

1. `rg -n 'verify-claude-build' .github/workflows/ci.yml` → the original job is still present and its steps/role unchanged.
2. `rg -n 'validate-decision-record' .github/workflows/ci.yml` → the new job invokes the validator.
3. `rg -n 'generate-decision-index' .github/workflows/ci.yml` → the new job invokes the index drift check.
4. Confirm a `paths:` / `paths-ignore` or `on.pull_request.paths` filter targeting `doc/decisions/` and `schemas/` (and the tools) — `rg -n 'doc/decisions/|schemas/|tools/' .github/workflows/ci.yml`.
5. Confirm the new job is a **separate job** (new job key), not a replacement of `verify-claude-build`.

**Expected Result**:

- `verify-claude-build` preserved; a distinct new job runs both tools; path filter present; the job's step(s) exit non-zero on failure → blocks merge (NFR-6, DEC-6).

---

#### TC-GH63-021 - CI gate scope: front-matter validator + index drift; NOT planning-summary over live docs

**Scenario Type**: Corner Case
**Impact Level**: Critical
**Priority**: High
**Traceability (Related IDs)**: F-6, AC-GH63-13, SD-3, DEC-3
**Test Type(s)**: Static inspection
**Automation Level**: Automated
**Target Layer / Location**: `.github/workflows/ci.yml`; test in `tools/.tests/test-validate-decision-record.sh`
**Tags**: @backend, @ci

**Given/When/Then**:
- **Given** the CI gate, **when** it runs, **then** it executes the front-matter validator over `doc/decisions/*.md` + schemas and the index drift check, and does **not** run the planning-summary validator over live docs.

**Preconditions**:

- CI workflow updated (delivery phase 5).

**Steps**:

1. `rg -n 'doc/decisions/\*\.md|validate-decision-record' .github/workflows/ci.yml` → front-matter validator invoked over the live corpus.
2. Confirm an index-drift step: `rg -n 'generate-decision-index|git diff.*00-index' .github/workflows/ci.yml` → regenerate + diff against committed `00-index.md`.
3. Confirm schema self-validity step present (`schemas/*.schema.json`).
4. `rg -n -- '--summary|planning-summary|decision_planning_summary' .github/workflows/ci.yml` → **0** invocations of the planning-summary validator over live docs (per SD-3).

**Expected Result**:

- Gate scope = front-matter validator + schema self-validity + index drift only; planning-summary validation is **not** CI-gated over live docs (its correctness proven by fixtures in TC-GH63-003/012/013).

---

#### TC-GH63-022 - Un-classified record valid as default R2; migration linter warns, never rewrites

**Scenario Type**: Regression
**Impact Level**: Important
**Priority**: High
**Traceability (Related IDs)**: F-7, AC-GH63-14, DM-4, NFR-2
**Test Type(s)**: Unit + Behavior
**Automation Level**: Automated
**Target Layer / Location**: `tools/validate-decision-record` (lint mode); fixture `tools/.tests/fixtures/positive/unclassified-r2.md`; test in `tools/.tests/test-validate-decision-record.sh`
**Tags**: @backend, @validator, @migration

**Given/When/Then**:
- **Given** an un-classified record (no `classification` block), **when** the validator runs, **then** it treats rigor as default R2 and the record remains valid (exit 0); the migration linter emits warnings and never rewrites the record.

**Preconditions**:

- Fixture committed: a valid record with **no** `classification` block.

**Steps**:

1. Hash the fixture file (`sha256sum`).
2. `tools/validate-decision-record fixtures/positive/unclassified-r2.md` → exit 0 (valid; rigor treated as R2 per DM-4).
3. `tools/validate-decision-record --lint fixtures/positive/unclassified-r2.md` → emits ≥1 warning (legacy/missing-classification shape), exit behavior per implementation.
4. Re-hash the fixture → `assert_eq` before/after (0 bytes changed — never rewritten, NFR-2/NG-7).

**Expected Result**:

- Un-classified record valid as R2; linter warns; file byte-unchanged (non-destructive migration).

---

#### TC-GH63-023 - Schema-vs-validator coverage: every schema rule hit; 0 uncovered

**Scenario Type**: Corner Case
**Impact Level**: Critical
**Priority**: High
**Traceability (Related IDs)**: F-1, F-3, AC-GH63-15, NFR-7, RSK-1
**Test Type(s)**: Unit (meta)
**Automation Level**: Automated
**Target Layer / Location**: `schemas/decision-record-frontmatter.schema.json` + `tools/.tests/test-validate-decision-record.sh`; coverage-check test in `tools/.tests/test-validate-decision-record.sh`
**Tags**: @backend, @coverage

**Given/When/Then**:
- **Given** the declarative schema and the imperative validator, **when** the test suite runs, **then** every schema rule is asserted by ≥1 validator test and the schema-vs-validator coverage check reports 0 uncovered rules.

**Preconditions**:

- A coverage map (schema rule → TC/fixture that exercises it) exists alongside the tests.

**Steps**:

1. Enumerate the schema rules (required fields, enums, patterns, cross-field/rigor rules, alias mapping).
2. For each rule, assert ≥1 validator test exercises it (the map references TC-GH63-004…014, 022).
3. Run the schema-vs-validator coverage check → `assert_eq "0" "<uncovered_count>"`.
4. `assert_exit_code 0` on the coverage check.

**Expected Result**:

- 0 uncovered schema rules (NFR-7). This is the primary declarative↔imperative drift guard (RSK-1).

**Notes / Clarifications**:

- The coverage map is maintained as test data; adding a schema rule without a validator test fails this TC — keeping schema and validator coupled.

---

#### TC-GH63-024 - `validate-decision-record` CLI conventions

**Scenario Type**: Happy Path
**Impact Level**: Important
**Priority**: High
**Traceability (Related IDs)**: F-3, AC-GH63-16, NFR-4
**Test Type(s)**: Behavior + Static inspection
**Automation Level**: Automated
**Target Layer / Location**: `tools/validate-decision-record`; test in `tools/.tests/test-validate-decision-record.sh`
**Tags**: @backend, @cli

**Given/When/Then**:
- **Given** `tools/validate-decision-record`, **when** inspected/invoked, **then** it follows tools-convention + bash.md: no `.sh` extension; `--help`/`--version`/`--dry-run`; semantic exit codes; testable main guard; embedded test framework.

**Preconditions**:

- Tool implemented.

**Steps**:

1. `ls tools/validate-decision-record` → exists; `[[ ! -x ... || ... ]]` — confirm it has **no `.sh`** extension and is executable.
2. `tools/validate-decision-record --help; echo $?` → exit 0; output contains `Usage:` and the doc link.
3. `tools/validate-decision-record --version; echo $?` → exit 0; output contains name + version.
4. `tools/validate-decision-record --dry-run <positive-fixture>; echo $?` → exit 0; output contains a `[DRY-RUN]` marker and makes no changes.
5. `tools/validate-decision-record --bogus 2>&1; echo $?` → non-zero exit (usage error).
6. `rg -n 'BASH_SOURCE\[0\] == "\$\{0\}"' tools/validate-decision-record` → testable main guard present.
7. `rg -n 'assert_eq|run_test|TEST_TAG' tools/.tests/test-validate-decision-record.sh` → embedded framework present.

**Expected Result**:

- All CLI-convention checks pass (NFR-4). Validates AC-16 for this tool.

---

#### TC-GH63-025 - `generate-decision-index` CLI conventions

**Scenario Type**: Happy Path
**Impact Level**: Important
**Priority**: High
**Traceability (Related IDs)**: F-4, AC-GH63-16, NFR-4
**Test Type(s)**: Behavior + Static inspection
**Automation Level**: Automated
**Target Layer / Location**: `tools/generate-decision-index`; test in `tools/.tests/test-generate-decision-index.sh`
**Tags**: @backend, @cli

**Given/When/Then**:
- **Given** `tools/generate-decision-index`, **when** inspected/invoked, **then** it follows tools-convention + bash.md (no `.sh`; `--help`/`--version`/`--dry-run`; exit codes; main guard; embedded framework).

**Preconditions**:

- Tool implemented.

**Steps**:

1. Confirm no `.sh` extension and executable.
2. `--help` → exit 0, `Usage:` + doc link.
3. `--version` → exit 0, name + version.
4. `--dry-run <corpus>` → exit 0, `[DRY-RUN]` marker, no file written.
5. Bad flag → non-zero usage exit.
6. Main guard grep present.
7. Embedded framework present in `tools/.tests/test-generate-decision-index.sh`.

**Expected Result**:

- All CLI-convention checks pass (NFR-4). Validates AC-16 for this tool.

---

#### TC-GH63-026 - Both `tools/.tests/` suites pass via bash

**Scenario Type**: Regression
**Impact Level**: Critical
**Priority**: High
**Traceability (Related IDs)**: F-3, F-4, AC-GH63-17, NFR-4
**Test Type(s)**: Aggregator
**Automation Level**: Automated
**Target Layer / Location**: `tools/.tests/test-validate-decision-record.sh`, `tools/.tests/test-generate-decision-index.sh`; also discoverable via `tools/test-all.sh`
**Tags**: @backend, @tests

**Given/When/Then**:
- **Given** the test suites, **when** run via `bash tools/.tests/test-validate-decision-record.sh` and `bash tools/.tests/test-generate-decision-index.sh`, **then** both pass (exit 0).

**Preconditions**:

- Both test files implemented.

**Steps**:

1. `bash tools/.tests/test-validate-decision-record.sh; echo $?` → `0`.
2. `bash tools/.tests/test-generate-decision-index.sh; echo $?` → `0`.
3. (Optional, cross-check) `bash tools/test-all.sh` → exit 0 and both suites enumerated.

**Expected Result**:

- Both suites green (AC-17). This is the execution gate referenced by the spec.

**Notes / Clarifications**:

- The spec names the files `test-<tool>.sh` (AC-17, F-3/F-4); `doc/guides/tools-convention.md` suggests a `-unit.sh` suffix. The spec is authoritative here; see OQ-GH63-4.

---

#### TC-GH63-027 - License headers exclusively from `scripts/add-header-location.sh`

**Scenario Type**: Regression
**Impact Level**: Important
**Priority**: Medium
**Traceability (Related IDs)**: AC-GH63-18, NFR-3
**Test Type(s)**: Static inspection
**Automation Level**: Automated
**Target Layer / Location**: `tools/validate-decision-record`, `tools/generate-decision-index`, `scripts/add-header-location.sh`; test in `tools/.tests/test-validate-decision-record.sh`
**Tags**: @backend, @headers

**Given/When/Then**:
- **Given** the new `tools/` scripts, **when** headers are applied, **then** license headers come exclusively from `scripts/add-header-location.sh` (tools qualify) and none are hand-added.

**Preconditions**:

- Headers applied via the script (AGENTS.md rule).

**Steps**:

1. Confirm `tools/` is a target of `scripts/add-header-location.sh` (`rg -n 'tools' scripts/add-header-location.sh`).
2. Snapshot the two new tools (`git diff` clean).
3. Run `scripts/add-header-location.sh tools` → `git status --porcelain tools/` → **empty** (headers already canonical → idempotent; none hand-added/divergent).
4. `rg -n 'Copyright \(c\) 2025-2026 Juliusz' tools/validate-decision-record tools/generate-decision-index` → canonical header present on both.

**Expected Result**:

- The header script is the sole mechanism; running it is a no-op (idempotent) → no hand-added headers (NFR-3).

---

#### TC-GH63-028 - Static/diff hygiene: `git diff --check` + JSON/YAML parse + executable bits

**Scenario Type**: Regression
**Impact Level**: Important
**Priority**: High
**Traceability (Related IDs)**: testing-strategy cross-cutting (supports all ACs), NFR-1
**Test Type(s)**: Static/diff
**Automation Level**: Automated
**Target Layer / Location**: repository root; test split across both `tools/.tests/` files
**Tags**: @backend, @build

**Given/When/Then**:
- **Given** the change delivered on the branch, **when** static hygiene is run, **then** `git diff --check` is clean, schema JSON parses, CI YAML parses, and the new tools are executable.

**Preconditions**:

- Change delivered on `feat/GH-63/machine-enforceable-decision-records`.

**Steps**:

1. `git diff --check` → no whitespace/conflict-marker errors.
2. `jq empty schemas/*.json` → all schema JSON parses.
3. Validate the CI YAML structurally without a `yaml` module (python3 3.14 ships none — SD-4/NFR-9): use `jq empty` is not YAML-validating either; instead run `python3 tools/.tests/_yaml_ok.py .github/workflows/ci.yml` where `_yaml_ok.py` is a tiny stdlib brace/indent sanity check, OR `actionlint` if present in CI, OR shell out to `python3 -c "import json,sys; ..."` after a deterministic yaml→json via the tool's own stdlib parser. **Do NOT use `import yaml`** (red-team m8).
4. `test -x tools/validate-decision-record && test -x tools/generate-decision-index` → both executable.
5. Front matter of ADR-0001 and the template still parses as YAML.

**Expected Result**:

- All static-hygiene gates pass. Required before completion per testing-strategy quality gates.

---

## 6. Environments and Test Data

- **Environment:** a single local repository checkout on branch `feat/GH-63/machine-enforceable-decision-records`, plus the CI `ubuntu-latest` runtime (stock `python3` 3.14.x + `jq` 1.8.x; **no** `jsonschema`, **no** `shellcheck` — SD-4/NFR-9). No staging/production.
- **Tools required:** `bash` ≥ 4, `jq`, `git`, `rg`/`grep`, `python3` (stdlib only), `cmp`. No test framework beyond the embedded one.
- **Test data (committed fixtures under `tools/.tests/fixtures/`):**
  - **Positive:** `adr-0001-snapshot.md`, `template-instantiated-r2.md`, `accepted-r2-with-decider.md`, `accepted-r3-with-reviewers.md`, `unclassified-r2.md`.
  - **Negative (one per in-scope §28.3 case):** `invalid-decision-type.md`, `invalid-status.md`, `impossible-transition.md`, `supersedes-mismatch.md`, `missing-owners.md`, `accepted-r2-missing-decider.md`, `accepted-missing-decision-date.md`, `accepted-r3-missing-reviewers.md`, `accepted-missing-verification-criteria.md`, plus planning-summary `summary-constraint-driver-overlap.json`, `summary-non-negotiable-violation.json`.
  - **Planning-summary positives:** `planning-summary/generic-summary.json`, `planning-summary/legacy-alias-summary.json`.
  - **Health:** `health/overdue-review.md`, `health/accepted-missing-decider.md`, `health/missing-metrics.md`.
  - **Coverage map:** schema-rule → TC mapping (test data for TC-GH63-023).
- **Isolation:** all corpus-mutating/index tests operate on a temp-dir copy (`${TMPDIR}`); no test mutates live `doc/decisions/` records. Read-only-ness is asserted via before/after hashes. Temp dirs are cleaned via the framework `trap`.

## 7. Automation Plan and Implementation Mapping

All TCs are implemented inside the two `tools/.tests/test-*.sh` suites using the embedded Bash framework, except where noted (static inspection can live in either suite or a shared helper). Status = **To Implement** (delivery has not started at test-planning time).

| TC ID | Test file (implementation) | Execution command (evidence) | Mocking | Status |
|-------|----------------------------|------------------------------|---------|--------|
| TC-GH63-001 | `tools/.tests/test-validate-decision-record.sh` | `jq` schema existence/parse/self-valid | none | To Implement |
| TC-GH63-002 | `tools/.tests/test-validate-decision-record.sh` | `jq`/`rg` schema nested-vs-flat | none | To Implement |
| TC-GH63-003 | `tools/.tests/test-validate-decision-record.sh` | `tools/validate-decision-record --summary <fixture>` | none | To Implement |
| TC-GH63-004 | `tools/.tests/test-validate-decision-record.sh` | `tools/validate-decision-record <positive fixtures>` | none | To Implement |
| TC-GH63-005 | `tools/.tests/test-validate-decision-record.sh` | run validator on `invalid-decision-type.md`; assert exit + stderr | none | To Implement |
| TC-GH63-006 | `tools/.tests/test-validate-decision-record.sh` | run on `invalid-status.md` | none | To Implement |
| TC-GH63-007 | `tools/.tests/test-validate-decision-record.sh` | run on `impossible-transition.md` + `supersedes-mismatch.md` | none | To Implement |
| TC-GH63-008 | `tools/.tests/test-validate-decision-record.sh` | run on `missing-owners.md` | none | To Implement |
| TC-GH63-009 | `tools/.tests/test-validate-decision-record.sh` | run on `accepted-r2-missing-decider.md` | none | To Implement |
| TC-GH63-010 | `tools/.tests/test-validate-decision-record.sh` | run on `accepted-missing-decision-date.md` | none | To Implement |
| TC-GH63-011 | `tools/.tests/test-validate-decision-record.sh` | run on `accepted-r3-missing-reviewers.md` | none | To Implement |
| TC-GH63-012 | `tools/.tests/test-validate-decision-record.sh` | `--summary summary-constraint-driver-overlap.json` | none | To Implement |
| TC-GH63-013 | `tools/.tests/test-validate-decision-record.sh` | `--summary summary-non-negotiable-violation.json` | none | To Implement |
| TC-GH63-014 | `tools/.tests/test-validate-decision-record.sh` | run on `accepted-missing-verification-criteria.md` | none | To Implement |
| TC-GH63-015 | `tools/.tests/test-validate-decision-record.sh` | `rg` spec Appendix A deferred rows | none | To Implement |
| TC-GH63-016 | `tools/.tests/test-validate-decision-record.sh` | `rg` tool source for forbidden deps + behavior run | none | To Implement |
| TC-GH63-017 | `tools/.tests/test-generate-decision-index.sh` | two `generate-decision-index` runs + `cmp` | none (temp-dir corpus) | To Implement |
| TC-GH63-018 | `tools/.tests/test-generate-decision-index.sh` | run on health fixture corpus; assert health lines | none (temp-dir corpus) | To Implement |
| TC-GH63-019 | `tools/.tests/test-generate-decision-index.sh` | `rg` command + before/after record hashes | none (temp-dir corpus) | To Implement |
| TC-GH63-020 | `tools/.tests/test-validate-decision-record.sh` | `rg` ci.yml job/filter | none | To Implement |
| TC-GH63-021 | `tools/.tests/test-validate-decision-record.sh` | `rg` ci.yml gate scope | none | To Implement |
| TC-GH63-022 | `tools/.tests/test-validate-decision-record.sh` | `--lint` on `unclassified-r2.md` + before/after hash | none | To Implement |
| TC-GH63-023 | `tools/.tests/test-validate-decision-record.sh` | run coverage check; `assert_eq "0"` uncovered | none | To Implement |
| TC-GH63-024 | `tools/.tests/test-validate-decision-record.sh` | `--help`/`--version`/`--dry-run`/bad-flag + greps | none | To Implement |
| TC-GH63-025 | `tools/.tests/test-generate-decision-index.sh` | `--help`/`--version`/`--dry-run`/bad-flag + greps | none | To Implement |
| TC-GH63-026 | aggregator (both suites) | `bash tools/.tests/test-validate-decision-record.sh && bash tools/.tests/test-generate-decision-index.sh` | none | To Implement |
| TC-GH63-027 | `tools/.tests/test-validate-decision-record.sh` | `scripts/add-header-location.sh tools` idempotency | none | To Implement |
| TC-GH63-028 | both suites | `git diff --check` + `jq empty` + YAML parse + `test -x` | none | To Implement |

**Mocking requirements:** none beyond temp-dir corpus isolation. Tools read local files only (NFR-1); no network/external command to mock.

## 8. Risks, Assumptions, and Open Questions

### 8.1 Risks

| Risk | Impact | Mitigation |
|------|--------|------------|
| **Declarative↔imperative drift** (schema and validator encode the same rules separately) — RSK-1 | High | TC-GH63-023 asserts every schema rule is hit + 0 uncovered; coverage map maintained as test data. |
| **`reviewers` rule wording vs ADR-0001** — DM-1 says "required non-empty when rigor=R3" (no status qualifier), but ADR-0001 (Proposed R3, empty reviewers) must pass per AC-1/AC-4 | High | TC-GH63-004 asserts ADR-0001 passes (AC-1/AC-4 authoritative); TC-GH63-011 uses an **Accepted** R3 fixture (unambiguous). Reconciliation tracked as OQ-GH63-1. |
| **Template-with-placeholders "validates"** — raw template has `<...>` placeholders, not a validatable record | Medium | Interpreted as schema↔template structural consistency (TC-001/002) + a template-instantiated fixture (TC-004). See OQ-GH63-2. |
| **Best-effort heuristics give a false sense of enforcement** (verification-criteria; non-negotiable-violation) — RSK-6 | Medium | TC-GH63-013/014 assert the **labeling** (heuristic/best-effort), not a structural guarantee; exit-code semantics deferred to OQ-GH63-3. |
| **Index non-determinism causes false-positive CI drift** — RSK-5 | High | TC-GH63-017 three-way `cmp` (byte-identity across runs). |
| **CI runtime lacks `jsonschema`/`shellcheck`** — RSK-4 | High | TC-GH63-016 greps for forbidden deps + behavior-runs on stdlib. |
| **Grep-based CI/spec assertions over/under-match** | Low | TCs scope greps to specific keys/rows and pair with ordinal/value assertions. |

### 8.2 Assumptions

- Engineering-repo profile; writes confined to `schemas/`, `tools/`, `tools/.tests/`, `.github/workflows/`, `doc/decisions/00-index.md`, `doc/tools/`, `.opencode/command/decision-index.md`, and feature/guide doc updates; no `doc/business/**`.
- ADR-0001 and the decision-record template faithfully represent the landed GH-46 nested front matter (SD-1) and are the authoritative fixtures.
- `python3` (stdlib) and `jq` are available in CI; `shellcheck`/`jsonschema` are not (NFR-9).
- Zero live `<decision_planning_summary>` instances persist under `doc/` (SD-3) → planning-summary correctness proven by fixtures.
- `/decision-index` and any `.opencode/` edits are tuned via `@toolsmith` per AGENTS.md.
- Acceptance-gated rigor rules (`decider`, `decision_date`, and — by interpretation — `reviewers`) are not required for `Proposed` records, so ADR-0001 (`Proposed`, R3, empty reviewers/decider, null decision_date) validates clean.

### 8.3 Open Questions

| ID | Question | Status / Owner |
|----|----------|----------------|
| OQ-GH63-1 | DM-1 phrases `governance.reviewers` as "required non-empty when rigor = R3" without a status qualifier, yet ADR-0001 is `Proposed` R3 with `reviewers: []` and must pass (AC-1/AC-4). Is the reviewers rule acceptance-gated (like the `decider` rule), or must ADR-0001's reviewers be populated before GH-63 merges? | **RESOLVED by DEC-12** — acceptance-gated: `reviewers` required non-empty only when `status=Accepted` AND `rigor=R3`. TC-004 (ADR-0001 passes) + TC-011 (Accepted R3 fixture) align. |
| OQ-GH63-2 | AC-1/AC-4 say "the decision-record template validates", but the raw template file contains `<...>` placeholders (invalid id/date values). Confirm the intended meaning is schema↔template structural consistency + a template-instantiated valid record (this plan's interpretation), not literal validation of the template file. | **RESOLVED** — schema↔template structural consistency + a template-instantiated fixture (TC-001/002/004); the raw placeholder template is not literal-validated. |
| OQ-GH63-3 | For the best-effort heuristics (TC-013 non-negotiable violation; TC-014 verification-criteria), what is the exit-code semantics — hard error, warning-only, or `--strict`-promoted (D-5)? | **RESOLVED by DEC-13** — non-blocking warnings (exit 0, `[WARN]`/`[HEURISTIC]` labeled); never fail the build. TC-013/014 updated to assert exit 0 + labeling. |
| OQ-GH63-4 | Test-file naming: the spec (AC-17, F-3/F-4) uses `tools/.tests/test-<tool>.sh`; `doc/guides/tools-convention.md` suggests `test-<tool>-unit.sh`. Which wins? | **RESOLVED** — the spec AC-17 is authoritative: `test-validate-decision-record.sh` and `test-generate-decision-index.sh` (no `-unit` suffix); `test-all.sh` matches `test-*.sh` either way. (A documented exception vs tools-convention §tests; non-blocking.) |
| OQ-GH63-5 | (Mirrors spec OQ-2) Should `/plan-decision` or `/write-decision` invoke the planning-summary validator inline, or keep it on-demand? Affects whether any live-doc gating is ever added. | Open (does not affect this plan — SD-3/DEC-16 keep planning-summary validation fixture-only + explicit-`--summary` regardless). |

## 9. Plan Revision Log

| Version | Date | Author | Changes |
|---------|------|--------|---------|
| 1.0 | 2026-06-25 | @test-plan-writer | Initial test plan authored from `chg-GH-63-spec.md`. 28 test cases; 18/18 ACs covered (100%); one TC per in-scope §28.3 case (Appendix A rows 1,2,3,4,5,6,8,9,10) plus the heuristic (row 12); DM-1..4, NFR-1..9, F-1..7 mapped; 5 open questions surfaced (incl. reviewers-rule status-gating and template-placeholder validation). |

## 10. Test Execution Log

| TC ID | Run Date | Result | Notes |
|-------|----------|--------|-------|
| _(populated during review/execution phase)_ | | | |
