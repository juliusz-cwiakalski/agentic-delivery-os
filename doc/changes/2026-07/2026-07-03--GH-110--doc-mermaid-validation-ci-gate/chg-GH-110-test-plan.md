---
id: chg-GH-110-test-plan
status: Proposed
created: 2026-07-03T00:00:00Z
last_updated: 2026-07-03T00:00:00Z
owners: ["Juliusz Ćwiąkalski"]
service: doc-validation
labels: ["ci", "docs", "mermaid", "guard", "drift-detection", "epic-107"]
version_impact: minor
summary: "Verification plan for the first automated guardrail over doc/** — a headless mermaid render validator, a doc-path-scoped CI workflow, a diagrams rule (all Mermaid families allowed, including C4), and an authoring self-check wired into three doc-authoring agent prompts. The executable test surface is the bash validator and its embedded test; the workflow/rule/agent edits are verified by inspection/CI."
links:
  change_spec: ./chg-GH-110-spec.md
  implementation_plan: ./chg-GH-110-plan.md   # authored at phase 4 (not yet present at test-planning time)
  testing_strategy: .ai/rules/testing-strategy.md
---

# Test Plan - Doc & mermaid validation CI gate

## 1. Scope and Objectives

This plan verifies GH-110: `scripts/validate-mermaid.sh` becomes the first automated check over `doc/**` renderability — it extracts every ```` ```mermaid ```` fenced block across the doc scan roots and renders each headless via `mmdc`, failing non-zero on any parse/render failure with a precise message (file + block index + first error). Around it sit three verified-by-inspection deliverables: a dedicated doc-path-scoped CI workflow, a diagrams rule, and a 1–2-line self-check in three doc-authoring agent prompts.

The core behavior to protect is the **render contract (NFR-5)**: a block passes **iff** its `mmdc` headless render exits 0. GitHub renders all Mermaid families, including C4 (DEC-8 — verified during PR #123 review), so the validator is render-only and applies no keyword guard.

Three integrity risks drive the plan: (1) the validator must be **mockable and Chromium-free** in the fast `scripts/test-all.sh` suite — `mmdc`/puppeteer/Chromium is heavy and flaky, so every render-dependent test injects a deterministic fake via `MMDC_CMD` and no test requires a real Chromium download (NFR-6 §10 testability; RSK-1); (2) the **failure message must be specific 3/3** — file path + block index + first error on every failure, or a broken block is not actionable in CI logs (NFR-4); and (3) the validator must **pass the current repo as the green baseline** before the gate is enabled (NFR-1, §18 ROLLOUT step 1).

This change was motivated by a render incident: a gate-approved architecture doc shipped a mermaid block that does not render — it passed authoring, the inception gate, PR review, and CI because nothing inspects doc renderability. The render validator is the gate that defect class must never pass again.

### 1.1 In Scope

- **The validator (executable test surface)** — `scripts/validate-mermaid.sh` (NEW) and `scripts/.tests/test-validate-mermaid.sh` (NEW, auto-discovered by `scripts/test-all.sh`). Covers the render check, the `MMDC_CMD` mock seam, `--if-present` local opt-in, `--help`/`--version`, documented exit codes, determinism, and failure-message specificity.
- **CI gate (inspection)** — `.github/workflows/docs-mermaid-validate.yml` (NEW): verified by inspection for `paths:` filter, job `docs (mermaid validate)`, `permissions: contents: read`, no `pull_request_target`, no deploy, mmdc install + validator run; `.github/workflows/ci.yml` unchanged (DEC-1).
- **Diagrams rule (inspection)** — `.ai/rules/diagrams.md` (NEW) for the statement that all Mermaid families are allowed (including C4) + render-gate self-check; `.ai/rules/README.md` index row; `.ai/rules/diagrams.md` carries **no** `ados_distribution` marker (DEC-5).
- **Authoring self-check (inspection + build invariant)** — `.opencode/agent/{spec-writer,doc-syncer,bootstrapper}.md` reference `.ai/rules/diagrams.md` + self-check (F-4); `.ados-claude/` regenerated fresh (DEC-2; CI `verify-claude-build` enforces).
- **Green baseline (mmdc-gated)** — a separate, mmdc-gated assertion that the validator passes the real repo doc tree, so it never enters the Chromium-free fast suite.

### 1.2 Out of Scope & Known Gaps

- **Markdownlint** config + job — explicit non-goal (NG-1 / DEC-6); not tested.
- **Re-rendering diagrams to committed image assets** (NG-2); non-goal.
- **Re-authoring existing blocks** (NG-3) — the validator passes the current repo as-is; no block is rewritten.
- **Redistributing** the validator or `.ai/rules/diagrams.md` to adopters (NG-4) — repo-internal; not tested.
- **CI gate firing (now executable, not eyeball-only)** — the GitHub Actions job's *structural validity* (trigger/paths/job/permissions/install+run/no-`continue-on-error`) is verified by an **automated** test (TC-CI-003: grep structural assertions + `actionlint` when available) in `scripts/.tests/test-docs-mermaid-workflow.sh`; the *runtime* "broken block fails the PR" behavior is the validator's own behavior (TC-MMD-001), which this well-formed job runs. A live workflow run is still out of scope (not triggerable here), but the malformed-workflow silent-pass class is now caught structurally. `.github/workflows/ci.yml` unchanged (DEC-1).
- **Extending the self-check to `plan-writer`/`test-plan-writer`** — outside the PM-designated candidate set (DEC-4); CI covers `changes/**` regardless.
- **`doc/spec/features/feature-doc-mermaid-validation.md`** — authored at phase 7 by `@doc-syncer` (PM decision #5); not part of this test plan (no spec coverage gate exists for it yet at phase 3).

## 2. References

| Ref | Document | Relevance |
|-----|----------|-----------|
| Spec | [./chg-GH-110-spec.md](./chg-GH-110-spec.md) | Authoritative requirements: F-1–F-4 (§5), DM-1–DM-3 (§8.3), NFR-1–NFR-6 (§9), DEC-1–DEC-8 (§15), AC-F1-1…AC-F4-1 (§17 A–E). |
| Strategy | [.ai/rules/testing-strategy.md](../../../.ai/rules/testing-strategy.md) | Canonical test layers/types; `scripts/<script>.sh` → `bash scripts/.tests/test-<script>.sh`; mixed changes run all applicable layers. |
| Bash rules | [.ai/rules/bash.md](../../../.ai/rules/bash.md) | §10 testability (DI via env, mockable wrappers, testable main guard, exit-code contract) and §11 embedded test framework (shebang, strict mode, `run_test`, assertions, `print_summary` exit code) — the script **and** its test MUST follow this. |
| Template | [doc/templates/test-plan-template.md](../../../doc/templates/test-plan-template.md) | Structural skeleton for this file. |
| Sibling plan | [../2026-06-25--GH-67--marker-driven-doc-distribution/chg-GH-67-test-plan.md](../../2026-06/2026-06-25--GH-67--marker-driven-doc-distribution/chg-GH-67-test-plan.md) | Closest sibling: a bash guard + embedded test with env-injected mocks and inspection-only process checks; tone/structure reference. |
| Convention | [doc/guides/unified-change-convention-tracker-agnostic-specification.md](../../../doc/guides/unified-change-convention-tracker-agnostic-specification.md) | `workItemRef` / folder / branch naming. |
| Target code | `scripts/validate-mermaid.sh`, `scripts/.tests/test-validate-mermaid.sh` | Primary executable deliverable + its test. |
| Target CI | `.github/workflows/docs-mermaid-validate.yml`, `.github/workflows/ci.yml` | New gate (unchanged `ci.yml`). |
| Implementation plan | ./chg-GH-110-plan.md | Authored at phase 4; TCs reconcile against it once present. |

## 3. Coverage Overview

Every spec §17 acceptance criterion is traced below. Spec §17 enumerates **9 ACs** (`AC-F1-1 … AC-F4-1`) grouped A–E; all 9 are covered — no gaps. `DM-1`, `DM-2`, `DM-3` and `NFR-1 … NFR-6` are covered in §3.2 / §3.3. DEC-8 (C4 allowed; render-only contract) governs the validator's behavior.

> **Testability rule (governs the whole plan):** the fast `scripts/test-all.sh` suite MUST NOT require a real Chromium/puppeteer download. Every render-dependent case injects a deterministic fake `mmdc` via the `MMDC_CMD` env seam (NFR-6 §10.1/§10.3). No network at test time. The only mmdc-requiring case (`TC-BASE-001`, the green-baseline run over the real repo) is mmdc-gated and CI-only.

### 3.1 Functional Coverage (F-#, AC-#) — Traceability Matrix

| AC ID | Criterion (given/when/then, condensed) | TC ID(s) | How verified | Status |
|-------|----------------------------------------|----------|--------------|--------|
| AC-F1-1 | Broken mermaid block ⇒ non-zero + message naming file, block index, first error | TC-MMD-001, TC-MMD-009 | Bash integration (mock mmdc fail) | Pending |
| AC-F1-2 | Valid block ⇒ exit 0 | TC-MMD-002, TC-BASE-001 | Bash integration (mock mmdc ok) + mmdc-gated baseline | Pending |
| AC-F1-3 | `test-validate-mermaid.sh` runs & passes; script follows bash.md (ShellCheck-clean, exit codes, `MMDC_CMD` injection, `--if-present`/`--help`/`--version`) | TC-MMD-003, TC-MMD-004, TC-MMD-011 | Bash behavior + unit (env injection) | Pending |
| AC-F2-1 | Workflow exists; `paths:` filter; job `docs (mermaid validate)`; `permissions: contents: read`; no `pull_request_target`; no deploy; installs mmdc; runs validator | TC-CI-001, TC-CI-003 | Inspection (YAML) + **automated structural test** | Pending |
| AC-F2-2 | PR with broken block fails the job; `ci.yml` unchanged | TC-CI-001, TC-CI-002, TC-CI-003 | Inspection + regression (ci.yml diff) + structural test | Pending |
| AC-F3-1 | `diagrams.md` states all Mermaid families allowed (incl. C4) and lists common families (`flowchart`, `sequenceDiagram`, `stateDiagram-v2`, `classDiagram`) | TC-RULE-001 | Inspection (content grep) | Pending |
| AC-F3-2 | `diagrams.md` allows all families (incl. C4) and references the render gate | TC-RULE-002 | Inspection (content grep) | Pending |
| AC-F3-3 | `.ai/rules/README.md` has `diagrams.md` index row; `.ai/rules/diagrams.md` carries **no** `ados_distribution` marker | TC-RULE-003 | Inspection (content grep) | Pending |
| AC-F4-1 | `spec-writer`/`doc-syncer`/`bootstrapper` each reference `.ai/rules/diagrams.md` + self-check; `.ados-claude/` regenerated fresh | TC-AGENT-001, TC-AGENT-002 | Inspection (content grep) + build invariant | Pending |

**AC coverage total: 9 / 9.** (AC#5 / DEC-3 is a review/release flag surfaced in the PR description — not a runtime AC; intentionally absent from this matrix per spec §17 E.)

### 3.2 Interface Coverage (API-#, EVT-#, DM-#)

No REST/HTTP (spec §8.1 N/A) or event (§8.2 N/A) surfaces. Data-model coverage:

| DM ID | Contract | TC ID(s) | Status |
|-------|----------|----------|--------|
| DM-1 | Validator exit-code contract — success (0), usage error (2), missing-`mmdc`-when-required (3), render failure (4); a block passes iff its mmdc render exits 0 (DEC-8 — render-only); `mmdc` via injectable `MMDC_CMD` | TC-MMD-011 | Covered |
| DM-2 | Scan-root set — union `{doc, decisions, changes, inception, .ai}` over `.md`, **excluding git-ignored paths (notably `.ai/local/` ephemeral scratch)**; in this repo `doc/**` subsumes the first three; mirrors the CI `paths:` filter | TC-BASE-001, TC-CI-001, TC-CI-003 | Covered |
| DM-3 | Rule content model — statement that all Mermaid families are allowed (including C4) + render-gate self-check in `.ai/rules/diagrams.md` | TC-RULE-001, TC-RULE-002 | Covered |

### 3.3 Non-Functional Coverage (NFR-#)

| NFR ID | Requirement | Threshold | TC ID(s) | Status |
|--------|-------------|-----------|----------|--------|
| NFR-1 | Validator determinism — fixed repo state ⇒ fixed verdict, no time/randomness/ordering dependence | 100% reproducible; sorted file order | TC-MMD-004, TC-MMD-010, TC-BASE-001 | Covered |
| NFR-2 | CI runtime — full repo doc-set validation on `ubuntu-latest` | < 120s wall-clock | TC-CI-001 (caching step present) | **CI-only observation** — not a fast-suite assertion (cannot be asserted locally); observed on real PR runs |
| NFR-3 | Local opt-in safety — `--if-present` never hard-fails on a missing tool; CI is mandatory | Local without mmdc exits 0 (skip) | TC-MMD-007 | Covered |
| NFR-4 | Failure-message specificity — every failure has file + block index + first error (3/3) | 3/3 on every failure | TC-MMD-001, TC-MMD-009 | Covered |
| NFR-5 | Render contract — passes iff mmdc render exits 0 (render-only; DEC-8) | Render-only | TC-MMD-002, TC-MMD-001 | Covered |
| NFR-6 | `bash.md` conformance — ShellCheck-clean, shfmt; strict mode + traps; context-tagged logging; `MMDC_CMD` injection; embedded framework; testable main guard; documented exit codes; `--if-present`/`--help`/`--version` | All §18 checklist items | TC-MMD-003, TC-MMD-004, TC-MMD-011 | Covered |

## 4. Test Types and Layers

Per `.ai/rules/testing-strategy.md` (and `.ai/rules/bash.md` §10–§11 for shell). This change spans `scripts/` (executable), `.github/` (CI), `.ai/rules/` + `.opencode/` + `.ados-claude/` (content). Layers map as:

| Layer | Type | Framework / location | Pattern | Used here |
|-------|------|----------------------|---------|-----------|
| Shell automation | Automated (validator test) | `scripts/.tests/test-validate-mermaid.sh` (NEW) | `bash scripts/.tests/test-validate-mermaid.sh`; embedded framework per bash.md §11 (`run_test`, `assert_*`, `print_summary` exit code, `trap`-based teardown in `mktemp -d`); auto-discovered by `scripts/test-all.sh` | **Primary deliverable** |
| Static/diff | Manual inspection | `git diff --check`; content grep on workflow, rule, README, agent prompts; `git diff` on `ci.yml` | n/a | CI wiring, rule, agents, plugin freshness |
| Content | Manual | YAML structure review (workflow); markdown render review (diagrams.md); README index review | n/a | Inspection-only ACs |
| Integration (CI-only) | mmdc-gated | the validator run over the real repo doc tree | gated on real `mmdc` presence; **never** in the fast suite | Green baseline |

**Conventions honored:** test file is `test-validate-mermaid.sh` in the adjacent `.tests/`; narrow changed-module check first; the fast suite stays Chromium-free via `MMDC_CMD` mocks; evidence recorded in §10. Determinism (NFR-1) means every automated case runs in an isolated `mktemp -d` with no network.

**Why inspection-only for workflow/rule/agents:** the CI workflow runs the same validator already covered by `TC-MMD-*`; the rule and agent prompts are prose whose value is authoring-time guidance, not runtime behavior. Per the testing-strategy fallback, content/static checks (grep + `git diff --check`) are the appropriate layer for those surfaces, with CI's `verify-claude-build` job as the automated freshness enforcer for `.ados-claude/`.

## 5. Test Scenarios

### 5.1 Scenario Index

| TC ID | Title | Type | Priority | AC Coverage |
|-------|-------|------|----------|-------------|
| TC-MMD-001 | Broken mermaid block fails with precise message (mock mmdc fail) | Negative | High | AC-F1-1, NFR-4 |
| TC-MMD-002 | Valid block passes (mock mmdc ok) | Happy Path | High | AC-F1-2, NFR-5 |
| TC-MMD-003 | Test harness + script bash.md conformance | Regression | High | AC-F1-3, NFR-6 |
| TC-MMD-004 | `MMDC_CMD` dependency injection (no Chromium) | Corner Case | High | AC-F1-3, NFR-6, NFR-1 |
| TC-MMD-007 | Valid block passes under `--if-present` when mmdc absent | Corner Case | High | NFR-3 |
| TC-MMD-009 | Failure-message completeness 3/3 (file + block index + first error) | Corner Case | High | AC-F1-1, NFR-4 |
| TC-MMD-010 | Determinism — identical verdict across runs; sorted file order | Corner Case | Medium | NFR-1 |
| TC-MMD-011 | Documented exit codes reachable & distinct (bash.md contract) | Behavior | Medium | DM-1, NFR-6 |
| TC-CI-001 | `docs-mermaid-validate.yml` inspection — benign, doc-path-scoped | Regression | High | AC-F2-1, AC-F2-2, DEC-1, NFR-2 |
| TC-CI-002 | `ci.yml` unchanged (DEC-1) | Regression | Medium | AC-F2-2, DEC-1 |
| TC-CI-003 | **Workflow structural validity** (grep assertions + `actionlint`) — executable, catches malformed-trigger silent-pass | Negative | High | AC-F2-1, AC-F2-2, DEC-1 |
| TC-RULE-001 | `diagrams.md` states all families allowed + lists common ones | Happy Path | Medium | AC-F3-1, DM-3 |
| TC-RULE-002 | `diagrams.md` allows C4 + references the render gate | Happy Path | Medium | AC-F3-2, DM-3 |
| TC-RULE-003 | README index row present; `diagrams.md` carries NO marker (DEC-5) | Negative | Medium | AC-F3-3, DEC-5 |
| TC-AGENT-001 | 3 agents reference `diagrams.md` + self-check | Regression | Medium | AC-F4-1, DEC-4 |
| TC-AGENT-002 | `.ados-claude/` regenerated fresh (build invariant) | Regression | High | AC-F4-1, DEC-2 |
| TC-BASE-001 | Validator passes real repo doc tree as green baseline (mmdc-gated) | Regression | High | AC-F1-2, DM-2, NFR-1 |

**Totals:** 17 test cases — 8 validator behavior/unit (`TC-MMD-*`), 3 CI (`TC-CI-001` inspection, `TC-CI-002` diff, `TC-CI-003` **automated structural**), 3 rule (`TC-RULE-*`), 2 agent/plugin (`TC-AGENT-*`), 1 mmdc-gated baseline (`TC-BASE-001`). All `TC-MMD-*` are fully Chromium-free (mocked `MMDC_CMD`). Two executable test files: `scripts/.tests/test-validate-mermaid.sh` (validator) and `scripts/.tests/test-docs-mermaid-workflow.sh` (CI structural).

### 5.2 Scenario Details

#### TC-MMD-001 - Broken mermaid block fails with precise message (mock mmdc fail)

**Scenario Type**: Negative
**Impact Level**: Critical
**Priority**: High
**Related IDs**: F-1, AC-F1-1, DM-1, NFR-4
**Test Type(s)**: Integration
**Automation Level**: Automated
**Target Layer / Location**: `scripts/.tests/test-validate-mermaid.sh`
**Tags**: @backend, @validator, @mermaid

**Preconditions**:
- `scripts/validate-mermaid.sh` exists and is sourceable (testable main guard, bash.md §10.4).
- A deterministic fake `mmdc` shim is injected via `MMDC_CMD` that exits non-zero and prints a parse error line on its stderr (no real Chromium/puppeteer).
- A throwaway fixture tree (`mktemp -d`) with one `.md` file containing exactly one syntactically broken ```` ```mermaid ```` block.

**Steps**:
1. Build a fixture `.md` with a malformed mermaid block (e.g., an unclosed `graph` directive / unmatched bracket).
2. Set `MMDC_CMD` to the fake shim that exits non-zero with a controlled error line.
3. Invoke the validator (or its render function) over the fixture.
4. Capture exit code and stderr/stdout.

**Expected Outcome**:
- Validator exits non-zero.
- Output names the offending **file path** and the **block index**, and surfaces the **first error** (the shim's error line) — all three present (NFR-4).
- On the same fixture with the block repaired (valid), the validator exits 0 (no false positive).

**Notes / Clarifications**:
- Prefer a deterministic mock over relying on a real `mmdc` parse failure, so the test is reproducible and Chromium-free (testability rule §3).

---

#### TC-MMD-002 - Valid block passes (mock mmdc ok)

**Scenario Type**: Happy Path
**Impact Level**: Critical
**Priority**: High
**Related IDs**: F-1, AC-F1-2, NFR-5
**Test Type(s)**: Integration
**Automation Level**: Automated
**Target Layer / Location**: `scripts/.tests/test-validate-mermaid.sh`
**Tags**: @backend, @validator, @mermaid

**Preconditions**:
- Fake `mmdc` shim via `MMDC_CMD` that exits 0.
- Fixture `.md` with one valid block (e.g., a `flowchart` diagram).

**Steps**:
1. Build the valid-block fixture.
2. Set `MMDC_CMD` to the success shim.
3. Run the validator over the fixture.

**Expected Outcome**:
- Validator exits 0 (AC-F1-2). A block with a clean render passes (NFR-5).

---

#### TC-MMD-003 - Test harness + script bash.md conformance

**Scenario Type**: Regression
**Impact Level**: Critical
**Priority**: High
**Related IDs**: F-1, AC-F1-3, NFR-6
**Test Type(s)**: Behavior
**Automation Level**: Automated
**Target Layer / Location**: `scripts/.tests/test-validate-mermaid.sh` + `scripts/validate-mermaid.sh`
**Tags**: @backend, @validator, @conformance

**Preconditions**:
- Both files delivered.

**Steps**:
1. Run `bash scripts/.tests/test-validate-mermaid.sh` directly → exit 0 (`print_summary` returns non-zero on any failure).
2. Run `bash scripts/test-all.sh` → the validator test is auto-discovered and passes (naming convention `test-*.sh` in `.tests/`).
3. Behavior: `scripts/validate-mermaid.sh --help` exits 0 and prints a `Usage:` message; `--version` exits 0 and prints a version string.
4. Static: run `shellcheck scripts/validate-mermaid.sh scripts/.tests/test-validate-mermaid.sh` → clean (warnings only as documented inline disables); `shfmt -i 2 -ci -bn -d` → no diff.
5. Static: confirm strict mode (`set -Eeuo pipefail`), traps (ERR/EXIT/INT/TERM), context-tagged logging, and a testable main guard are present in the script.

**Expected Outcome**:
- All checks pass (AC-F1-3 / NFR-6). The script and test conform to bash.md §1, §5, §10.4, §11.

---

#### TC-MMD-004 - `MMDC_CMD` dependency injection (no Chromium)

**Scenario Type**: Corner Case
**Impact Level**: Critical
**Priority**: High
**Related IDs**: F-1, AC-F1-3, NFR-6, NFR-1
**Test Type(s)**: Unit
**Automation Level**: Automated
**Target Layer / Location**: `scripts/.tests/test-validate-mermaid.sh`
**Tags**: @backend, @validator, @testability

**Preconditions**:
- The script reads `MMDC_CMD` from env with a sane default (e.g. `readonly MMDC_CMD="${MMDC_CMD:-mmdc}"`, bash.md §10.1) and invokes `mmdc` only through that indirection (§10.3 mockable wrapper).

**Steps**:
1. Write a fake `mmdc` shim to a temp path that exits 0 and echoes a fixed marker.
2. Set `MMDC_CMD` to the shim path; run the render path on a valid fixture.
3. Assert the shim (not a real `mmdc`) was invoked (its marker appears / a spy counter increments).
4. Repeat with a shim that exits non-zero and assert the validator treats it as a render failure (deterministic, no network, no Chromium download).

**Expected Outcome**:
- `MMDC_CMD` fully controls the render dependency; the test is deterministic and Chromium-free. This is the testability seam that makes the whole `TC-MMD-*` fast suite possible (NFR-6 §10; testability rule §3).

---

#### TC-MMD-007 - Valid block passes under `--if-present` when mmdc absent

**Scenario Type**: Corner Case
**Impact Level**: Critical
**Priority**: High
**Related IDs**: F-1, NFR-3
**Test Type(s)**: Integration
**Automation Level**: Automated
**Target Layer / Location**: `scripts/.tests/test-validate-mermaid.sh`
**Tags**: @backend, @validator, @if-present

**Preconditions**:
- `mmdc` absent; validator invoked with `--if-present`.
- Fixture `.md` with one valid block.

**Steps**:
1. Build the valid fixture.
2. Run `validate-mermaid.sh --if-present <fixture>` with `mmdc` absent.
3. Capture exit code and output.

**Expected Outcome**:
- Validator exits **0** with a skip notice (render skipped because `mmdc` is absent). `--if-present` never hard-fails a local run on a missing tool (NFR-3).

---

#### TC-MMD-009 - Failure-message completeness 3/3 (file + block index + first error)

**Scenario Type**: Corner Case
**Impact Level**: Critical
**Priority**: High
**Related IDs**: F-1, AC-F1-1, NFR-4
**Test Type(s)**: Integration
**Automation Level**: Automated
**Target Layer / Location**: `scripts/.tests/test-validate-mermaid.sh`
**Tags**: @backend, @validator, @message

**Preconditions**:
- A render-fail fixture (mock mmdc non-zero).

**Steps**:
1. **Render-fail message:** run on the render-fail fixture; assert the message contains (a) the file path, (b) the block index, and (c) the first error line — all three.
2. **Multi-block indexing:** build a fixture with two blocks that both fail; assert both block indices are reported, proving indexing is per-block, not per-file.

**Expected Outcome**:
- Every failure message is 3/3 complete (NFR-4). Block indexing is correct for multi-block files.

---

#### TC-MMD-010 - Determinism — identical verdict across runs; sorted file order

**Scenario Type**: Corner Case
**Impact Level**: Important
**Priority**: Medium
**Related IDs**: F-1, NFR-1
**Test Type(s)**: Integration
**Automation Level**: Automated
**Target Layer / Location**: `scripts/.tests/test-validate-mermaid.sh`
**Tags**: @backend, @validator, @determinism

**Preconditions**:
- A fixture tree with several `.md` files (mixed pass/fail), determinstic mock `mmdc`.

**Steps**:
1. Run the validator 3× back-to-back on the same fixture.
2. Capture exit code + the ordered list of reported findings each run.
3. Inspect the file-enumeration order is **sorted** (no reliance on filesystem `readdir` order).

**Expected Outcome**:
- All 3 runs produce identical exit code + identical findings list; enumeration is sorted. No time/randomness/ordering dependence (NFR-1).

---

#### TC-MMD-011 - Documented exit codes reachable & distinct (bash.md contract)

**Scenario Type**: Behavior
**Impact Level**: Important
**Priority**: Medium
**Related IDs**: DM-1, NFR-6
**Test Type(s)**: Behavior
**Automation Level**: Automated
**Target Layer / Location**: `scripts/.tests/test-validate-mermaid.sh`
**Tags**: @backend, @validator, @exit-codes

**Preconditions**:
- The script documents exit codes per bash.md §10.5 / §16 header: success (0), usage error (2), missing-`mmdc`-when-required (3), render failure (4).

**Steps**:
1. **Usage error:** invoke with an invalid flag → assert exit 2.
2. **Missing-mmdc-when-required:** invoke **without** `--if-present` and with `mmdc` absent → assert exit 3 (distinct from a render failure).
3. **Render failure:** mock mmdc non-zero → assert exit 4 (TC-MMD-001 path).
4. **Success:** valid block → 0.
5. Static: confirm the header comment documents each code.

**Expected Outcome**:
- Each documented exit code (0/2/3/4) is reachable and distinct; the header documents them (DM-1 / NFR-6). The missing-`mmdc`-when-required code is the one that distinguishes "tool not installed" from "tool ran and failed."

---

#### TC-CI-001 - `docs-mermaid-validate.yml` inspection — benign, doc-path-scoped

**Scenario Type**: Regression
**Impact Level**: Critical
**Priority**: High
**Related IDs**: F-2, AC-F2-1, AC-F2-2, DEC-1, NFR-2
**Test Type(s)**: Manual (content/YAML)
**Automation Level**: Semi-automated
**Target Layer / Location**: `.github/workflows/docs-mermaid-validate.yml`
**Tags**: @ci, @guard, @inspection

**Preconditions**:
- The workflow file is delivered.

**Steps**:
1. Assert the file exists and triggers `on: pull_request` (pull_request only — DEC-1/spec F-2) with a `paths:` filter covering `[doc/**, decisions/**, changes/**, inception/**, .ai/rules/**, scripts/validate-mermaid.sh, .github/workflows/**]` (DM-2 alignment; `.ai/local/` excluded).
2. Assert a job named `docs (mermaid validate)` on `runs-on: ubuntu-latest`.
3. Assert `permissions: contents: read` and **no** `pull_request_target` (no secret-surface widening) and **no** deploy step.
4. Assert a step installs `@mermaid-js/mermaid-cli` (`mmdc`) and a step runs `scripts/validate-mermaid.sh`; assert no `continue-on-error`/`|| true` (a non-zero exit fails the PR).
5. (NFR-2 — CI-only) note the Chromium-caching step is present to keep the run < 120s; not asserted in the fast suite.

**Expected Outcome**:
- The workflow is benign, doc-path-scoped, installs mmdc, runs the validator, and blocks merge on failure (AC-F2-1). The runtime "broken block fails the PR" behavior is the validator's own behavior (TC-MMD-001), run by this job.

---

#### TC-CI-002 - `ci.yml` unchanged (DEC-1)

**Scenario Type**: Regression
**Impact Level**: Important
**Priority**: Medium
**Related IDs**: F-2, AC-F2-2, DEC-1
**Test Type(s)**: Manual (diff)
**Automation Level**: Semi-automated
**Target Layer / Location**: `.github/workflows/ci.yml`
**Tags**: @ci, @regression

**Preconditions**:
- Delivery complete.

**Steps**:
1. `git diff --stat -- .github/workflows/ci.yml` → empty (the gate is a **separate** workflow, DEC-1).

**Expected Outcome**:
- `ci.yml` is byte-for-byte unchanged; no blast-radius widening of the existing CI (AC-F2-2).

---

#### TC-CI-003 - Workflow structural validity (grep assertions + actionlint) — executable

**Scenario Type**: Negative
**Impact Level**: Critical
**Priority**: High
**Related IDs**: F-2, AC-F2-1, AC-F2-2, DEC-1
**Test Type(s)**: Behavior (structural)
**Automation Level**: Automated
**Target Layer / Location**: `scripts/.tests/test-docs-mermaid-workflow.sh` (NEW — auto-discovered by `scripts/test-all.sh`)
**Tags**: @ci, @guard, @structural, @actionlint

**Preconditions**:
- `.github/workflows/docs-mermaid-validate.yml` is delivered.

**Why this exists (DoR iter-1 Major)**: AC#2 (the gate actually firing) was previously verified by eyeball-only YAML inspection, so a malformed workflow (bad `paths:` glob, trigger-syntax error, stray `continue-on-error`, misplaced `permissions:`) could pass silently and never fire. This test makes the gate's *structural* validity an executable assertion.

**Steps**:
1. **Required-present (grep):** assert the workflow contains `on:`, `pull_request`, a `paths:` filter, the job name `docs (mermaid validate)`, `runs-on: ubuntu-latest`, `permissions: contents: read`, an mmdc/`@mermaid-js/mermaid-cli` install step, and a `validate-mermaid.sh` run step.
2. **Forbidden-absent (grep):** assert the workflow does NOT contain `pull_request_target`, `continue-on-error`, `|| true`, or a deploy step.
3. **actionlint (when available):** if `actionlint` is on `PATH` (or downloadable), run it on the file; a non-zero `actionlint` exit is a failure. If unavailable, record a skip notice (the grep assertions in 1–2 are the portable baseline).
4. **YAML parse-ability (when a YAML tool is available):** confirm the file parses as valid YAML (catches indentation/syntax corruption that grep cannot).

**Expected Outcome**:
- All required structural elements present; all forbidden elements absent; the file is syntactically valid (and `actionlint`-clean when the tool is present). This closes the malformed-workflow silent-pass gap (AC-F2-1/F2-2). A live workflow run remains out of scope, but the validator behavior it runs is proven by TC-MMD-001.

**Notes / Clarifications**:
- Portable baseline = grep assertions (steps 1–2); `actionlint`/YAML-parse are enhancements gated on tool availability (the test self-adapts and never hard-fails solely because `actionlint` is absent).

---

#### TC-RULE-001 - `diagrams.md` states all families allowed + lists common ones

**Scenario Type**: Happy Path
**Impact Level**: Important
**Priority**: Medium
**Related IDs**: F-3, AC-F3-1, DM-3
**Test Type(s)**: Manual (content)
**Automation Level**: Semi-automated
**Target Layer / Location**: `.ai/rules/diagrams.md`
**Tags**: @docs, @rule, @inspection

**Preconditions**:
- `.ai/rules/diagrams.md` is delivered.

**Steps**:
1. `rg -n -e "flowchart" -e "sequenceDiagram" -e "stateDiagram-v2" -e "classDiagram" .ai/rules/diagrams.md` → all four present.
2. `rg -n -i -e "all Mermaid families" -e "allowed" .ai/rules/diagrams.md` → a statement that all families are allowed (including C4).

**Expected Outcome**:
- The rule names the common families and states all Mermaid families are allowed, including C4 (AC-F3-1 / DM-3).

---

#### TC-RULE-002 - `diagrams.md` allows C4 + references the render gate

**Scenario Type**: Happy Path
**Impact Level**: Important
**Priority**: Medium
**Related IDs**: F-3, AC-F3-2, DM-3
**Test Type(s)**: Manual (content)
**Automation Level**: Semi-automated
**Target Layer / Location**: `.ai/rules/diagrams.md`
**Tags**: @docs, @rule, @c4, @inspection

**Preconditions**:
- `.ai/rules/diagrams.md` is delivered.

**Steps**:
1. `rg -n -e "C4Context" -e "C4Container" -e "C4Component" .ai/rules/diagrams.md` → C4 families named as **allowed** (not avoided).
2. `rg -n -e "validate-mermaid" .ai/rules/diagrams.md` → the render-gate self-check present.

**Expected Outcome**:
- The rule allows C4 (DEC-8) and references the render gate (`scripts/validate-mermaid.sh`) (AC-F3-2 / DM-3).

---

#### TC-RULE-003 - README index row present; `diagrams.md` carries NO marker (DEC-5)

**Scenario Type**: Negative
**Impact Level**: Important
**Priority**: Medium
**Related IDs**: F-3, AC-F3-3, DEC-5
**Test Type(s)**: Manual (content)
**Automation Level**: Semi-automated
**Target Layer / Location**: `.ai/rules/README.md`, `.ai/rules/diagrams.md`
**Tags**: @docs, @rule, @marker, @inspection

**Preconditions**:
- Both files delivered.

**Steps**:
1. `rg -n "diagrams\.md" .ai/rules/README.md` → ≥1 match (index row added).
2. `rg -n "ados_distribution" .ai/rules/diagrams.md` → **0 matches** (individual rule files are not in the GH-67 DM-2 scan set; only `.ai/rules/README.md` is marker-scanned — DEC-5).
3. Regression: `bash scripts/.tests/test-doc-distribution.sh` → exit 0 (adding an unmarked rule file does not break the distribution guard).

**Expected Outcome**:
- README has the index row; `diagrams.md` is intentionally unmarked and the distribution guard stays green (AC-F3-3 / DEC-5).

---

#### TC-AGENT-001 - 3 agents reference `diagrams.md` + self-check

**Scenario Type**: Regression
**Impact Level**: Important
**Priority**: Medium
**Related IDs**: F-4, AC-F4-1, DEC-4
**Test Type(s)**: Manual (content)
**Automation Level**: Semi-automated
**Target Layer / Location**: `.opencode/agent/{spec-writer,doc-syncer,bootstrapper}.md`
**Tags**: @docs, @agents, @inspection

**Preconditions**:
- The three agent prompts are edited.

**Steps**:
1. For each of `spec-writer`, `doc-syncer`, `bootstrapper`:
   `rg -n -e "diagrams\.md" -e "\.ai/rules/diagrams" .opencode/agent/<agent>.md` → ≥1 match (rule reference).
2. For each, assert the self-check is present:
   `rg -n -i -e "validate-mermaid" -e "validate.*mermaid" .opencode/agent/<agent>.md` → ≥1 match (run the validator, which renders each mermaid block via mmdc).
3. Negative: confirm the excluded agents (`decision-advisor`, `editor`, `meeting-organizer`) are **not** edited (DEC-4 candidate set).

**Expected Outcome**:
- Each of the three chosen agents carries a concise (1–2 line) rule reference + self-check; the excluded three are untouched (AC-F4-1 / DEC-4).

---

#### TC-AGENT-002 - `.ados-claude/` regenerated fresh (build invariant)

**Scenario Type**: Regression
**Impact Level**: Critical
**Priority**: High
**Related IDs**: F-4, AC-F4-1, DEC-2
**Test Type(s)**: Integration (build invariant)
**Automation Level**: Automated
**Target Layer / Location**: `scripts/build-claude-plugin.sh` → `.ados-claude/`
**Tags**: @plugin, @ci, @regression

**Preconditions**:
- The three `.opencode/agent/*.md` edits are committed and `.ados-claude/` was regenerated and committed alongside (DEC-2).
- Baseline `.ados-claude/` is itself current (deterministic build).

**Steps**:
1. `git status --short -- .ados-claude/` → clean (committed baseline).
2. Re-run `scripts/build-claude-plugin.sh` → exit 0.
3. `git diff --stat -- .ados-claude/` → empty (regeneration is a no-op; the committed plugin is current).
4. Confirm the changed-agent set under the build mapping equals the 3 edited agents (`.ados-claude/agents/{spec-writer,doc-syncer,bootstrapper}.md`), no other drift.

**Expected Outcome**:
- The plugin is fresh and deterministic; CI's `verify-claude-build` job will pass (AC-F4-1 / DEC-2). A non-empty diff means either a stale baseline or non-deterministic build — both are release blockers.

---

#### TC-BASE-001 - Validator passes real repo doc tree as green baseline (mmdc-gated)

**Scenario Type**: Regression
**Impact Level**: Critical
**Priority**: High
**Related IDs**: F-1, AC-F1-2, DM-2, NFR-1
**Test Type(s)**: Integration
**Automation Level**: Automated
**Target Layer / Location**: `scripts/validate-mermaid.sh` over the real repo (CI-only / mmdc-gated)
**Tags**: @backend, @validator, @baseline, @ci

**Preconditions**:
- A real `mmdc` is installed (this case is **mmdc-gated**: it is skipped in the fast `scripts/test-all.sh` suite and runs only in CI or when `mmdc` is present).

**Steps**:
1. Gate: if `mmdc` is not on `PATH` (and `MMDC_CMD` unset), **skip** with a notice (do not fail the fast suite).
2. Otherwise run `scripts/validate-mermaid.sh` over the real DM-2 scan roots (`doc/**`, `.ai/**/*.md`).
3. Capture exit code + the count of blocks rendered.

**Expected Outcome**:
- Exit 0 — the current repo is the green baseline (§18 ROLLOUT step 1; NFR-1). All existing mermaid blocks render. This is the heavier, mmdc-requiring assertion that is deliberately kept out of the Chromium-free fast suite; the test gates itself so `scripts/test-all.sh` stays green on a tool-less runner.

**Notes / Clarifications**:
- Implementation guidance for `@coder`: the test should self-skip when `mmdc` is absent (e.g. guard on `command -v mmdc`) so it never breaks local `test-all.sh`. CI always installs `mmdc`, so the baseline runs there. An alternative is to keep this as a documented CI-only step rather than a self-skipping test — either is acceptable provided the fast suite is Chromium-free (record choice in §8.3).

## 6. Environments and Test Data

**Environment:** single `ubuntu-latest` GitHub Actions runner for CI (matches NFR-2). Local dev: any bash ≥4 on Linux/macOS. **No network at test time** — all fast-suite cases run offline against fixtures; the only network use in the whole change is the `mmdc`/Chromium *install* at CI job setup (not during validation).

**Isolation strategy:** every automated `TC-MMD-*` case uses a `mktemp -d` throwaway tree and a temp fake `mmdc` shim (mirrors `test-install.sh`/`test-doc-distribution.sh` `trap '_test_teardown' EXIT`). Fixtures never mutate the real repo. The green-baseline case (`TC-BASE-001`) is the only one that touches the real doc tree, and it self-skips without `mmdc`.

**Test data / fixtures:**
- **Fake `mmdc` shim:** a small temp script referenced via `MMDC_CMD` that exits 0 (success) or non-zero with a controlled error line (failure). No real Chromium is downloaded by any fast-suite test.
- **Mermaid block fixtures:** hand-built `.md` files in temp, one per case — a malformed/broken block (TC-MMD-001), a valid `flowchart` block (TC-MMD-002/007), a multi-block file for indexing (TC-MMD-009), and a multi-file tree for determinism (TC-MMD-010).

**mmdc-mocking strategy (governs the whole suite):** the script exposes `MMDC_CMD` (env-overridable, bash.md §10.1) as the sole render seam and invokes `mmdc` only through a mockable wrapper (§10.3). Tests inject a deterministic shim — they never shell out to a real `mmdc`. This keeps the fast `scripts/test-all.sh` suite Chromium-free and deterministic, while the real-render baseline (TC-BASE-001) is mmdc-gated and CI-only.

## 7. Automation Plan and Implementation Mapping

| TC ID(s) | File | Action | Execution command | Mocking | Status |
|----------|------|--------|-------------------|---------|--------|
| TC-MMD-001…011 (subset) | `scripts/.tests/test-validate-mermaid.sh` | **New** | `bash scripts/.tests/test-validate-mermaid.sh` | `MMDC_CMD` fake shim (success/fail); temp `.md` fixtures | To Implement |
| TC-MMD-003 (conformance) | `scripts/validate-mermaid.sh`, `scripts/.tests/test-validate-mermaid.sh` | **New** | `shellcheck …`; `shfmt -i 2 -ci -bn -d …`; `--help`/`--version` behavior | n/a | To Implement |
| TC-BASE-001 | `scripts/.tests/test-validate-mermaid.sh` (self-skipping) | **New** (mmdc-gated) | run via `scripts/test-all.sh`; self-skips without `mmdc`; CI runs it for real | real `mmdc` (CI only); self-skip locally | To Implement |
| TC-CI-001 | `.github/workflows/docs-mermaid-validate.yml` | **New** | content/YAML inspection (`rg`, manual read) | n/a | Manual Only |
| TC-CI-002 | `.github/workflows/ci.yml` | **No new file** | `git diff --stat -- .github/workflows/ci.yml` (expect empty) | n/a | Manual Only |
| TC-CI-003 | `scripts/.tests/test-docs-mermaid-workflow.sh` | **New** | `bash scripts/.tests/test-docs-mermaid-workflow.sh` (grep structural + `actionlint` when present + YAML parse when present); auto-discovered by `scripts/test-all.sh` | n/a | To Implement |
| TC-RULE-001/002 | `.ai/rules/diagrams.md` | **New** | content grep | n/a | Manual Only |
| TC-RULE-003 | `.ai/rules/README.md`, `.ai/rules/diagrams.md` | **Update / New** | content grep + `bash scripts/.tests/test-doc-distribution.sh` | n/a | Manual Only |
| TC-AGENT-001 | `.opencode/agent/{spec-writer,doc-syncer,bootstrapper}.md` | **Update** | content grep | n/a | Manual Only |
| TC-AGENT-002 | `scripts/build-claude-plugin.sh` → `.ados-claude/` | **Regen** | rebuild + `git diff --stat -- .ados-claude/` (expect empty) | n/a | To Implement |

**New files (3):** `scripts/validate-mermaid.sh`, `scripts/.tests/test-validate-mermaid.sh`, `scripts/.tests/test-docs-mermaid-workflow.sh`.
**Updated files:** `.ai/rules/README.md` (index row), `.opencode/agent/{spec-writer,doc-syncer,bootstrapper}.md`, `.ados-claude/agents/{spec-writer,doc-syncer,bootstrapper}.md` (regenerated).
**Inspection-only (no test file):** CI workflow human-read (TC-CI-001), ci.yml-diff (TC-CI-002), diagrams-rule/README content greps (TC-RULE-001/002/003), agent-prompt greps (TC-AGENT-001). The *structural* validity of the workflow is automated (TC-CI-003); the CI `verify-claude-build` job is the automated enforcer for TC-AGENT-002 freshness.

## 8. Risks, Assumptions, and Open Questions

### 8.1 Risks

| ID | Testing risk | Impact | Probability | Mitigation |
|----|--------------|--------|-------------|------------|
| TR-1 | A test requires a real Chromium download → fast suite becomes slow/flaky/networked | H | M | `MMDC_CMD` mock seam is mandatory (TC-MMD-004); TC-BASE-001 self-skips without `mmdc`. Testability rule §3 forbids real Chromium in the fast suite. |
| TR-2 | Render contract drifts (block passes that should fail) | H | L | TC-MMD-001/002 pin the render pass/fail boundary; TC-MMD-011 pins the exit-code contract (0/2/3/4). |
| TR-3 | Render-only gate misses a class a keyword gate would catch | M | L | Acceptable by design (DEC-8): GitHub renders C4 (owner-verified), so no keyword guard is applied; the render gate is the contract. |
| TR-4 | Failure message missing one element (file/index/error) → not actionable in CI (NFR-4) | M | M | TC-MMD-009 asserts 3/3 + multi-block indexing. |
| TR-5 | Green baseline breaks because a real block fails to render in `mmdc` (false positive, RSK-3) | M | L | TC-BASE-001 is the gate; if it fails, the block is re-authored or `mmdc` is pinned/upgraded before enabling the gate (§18 step 1). |

### 8.2 Assumptions

- `mmdc` is mockable purely via `MMDC_CMD` (bash.md §10.1/§10.3); the script invokes it through a single wrapper function and reads block content into it in a way a shim can satisfy.
- The green baseline (TC-BASE-001) is expected to pass; if any existing block fails to render, that is a delivery finding, not a test-plan error.
- `scripts/test-all.sh` auto-discovers `scripts/.tests/test-validate-mermaid.sh` by naming convention (no aggregator edit needed — spec §12 assumption).
- The CI `verify-claude-build` job already enforces `.ados-claude/` freshness, so TC-AGENT-002 is corroborated by an existing gate.

### 8.3 Open Questions

| ID | Question | Blocking? | Owner | Notes |
|----|----------|-----------|-------|-------|
| OQ-TP-2 | Should TC-BASE-001 be a self-skipping test in `test-validate-mermaid.sh`, or a documented CI-only step outside the test file? | No | `@coder` | Either keeps the fast suite Chromium-free. Self-skipping is preferred (single source of truth), but a CI-only step is acceptable. |
| OQ-TP-3 | Block index base: 0-based or 1-based? | No | `@coder` | TC-MMD-009 asserts the index is correct and consistent for a multi-block file; either base is fine if documented. (Resolved: 1-based.) |

## 9. Plan Revision Log

| Version | Date | Author | Changes |
|---------|------|--------|---------|
| 1.0 | 2026-07-03T00:00:00Z | @test-plan-writer | Initial test plan for GH-110. 20 TCs (12 `TC-MMD-*`, 2 `TC-CI-*`, 3 `TC-RULE-*`, 2 `TC-AGENT-*`, 1 `TC-BASE-001`); full AC/DM/NFR/DEC traceability; primary deliverable = `scripts/.tests/test-validate-mermaid.sh`. Encodes DEC-7 dual-check (render + C4 keyword guard) as the AND-semantics truth table (TC-MMD-012); pins the Chromium-free `MMDC_CMD` mock strategy; mmdc-gates the green baseline. |
| 1.1 | 2026-07-03 | @pm (DoR iter-1 remediation) | DoR NOT_READY fixes: (Major) added TC-CI-003 — **executable** workflow structural test (`scripts/.tests/test-docs-mermaid-workflow.sh`, grep + `actionlint` + YAML-parse) so AC#2's gate-firing is no longer eyeball-only; (Minors) DM-2 excludes git-ignored `.ai/local/`; NFR-2 reframed as CI-only observation; TC-CI-001 trigger hedge fixed (pull_request only); added TC-RULE-004 drift-guard (script default denylist == `diagrams.md` C4 keywords, DEC-7). Totals now 22 TCs / 3 executable test files. |
| 1.2 | 2026-07-04 | @coder (PR #123 review) | Review-driven reversal (DEC-8): GitHub renders Mermaid C4 (owner-verified), so DEC-7's keyword guard is removed and the validator is RENDER-ONLY. Removed TC-MMD-005/006/008/012 and TC-RULE-004 (C4/keyword drift guard). Updated TC-MMD-009 (render-only message 3/3), TC-MMD-010 (determinism via render failures), TC-MMD-011 (exit codes 0/2/3/4 only), TC-RULE-001/002 (all families allowed incl. C4). Removed OQ-TP-1 (`RENDER_SAFE_DENYLIST`). NFR-5 → render contract; DM-1 → exit codes 0/2/3/4. Totals now 17 TCs. AC count 9 (was 10; removed AC-F1-4). |

## 10. Test Execution Log

| TC ID | Run Date | Result | Notes |
|-------|----------|--------|-------|
| _not yet executed — populate during delivery (phase 6) and quality gates (phase 9)_ | | | |
