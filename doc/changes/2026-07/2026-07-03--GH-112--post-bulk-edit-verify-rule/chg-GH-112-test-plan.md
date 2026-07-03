---
id: chg-GH-112-test-plan
status: Updated
created: 2026-07-03T03:15:00Z
last_updated: 2026-07-03T04:15:00Z
owners: ["Juliusz Ćwiąkalski"]
service: ai-rules
labels: ["rules", "agents", "doc-distribution", "guard"]
version_impact: patch
summary: "Codify a standing implementation rule (.ai/rules/bulk-edit-verify.md) that requires every implementation agent to verify (diff-stat + targeted grep incl. a substring-overlap check + a typecheck/compile gate) the results of any bulk/tree-wide edit BEFORE committing, with a clean-revert recovery contract; wire it into the rules README index + @coder/@pm load-sections; regenerate the .ados-claude mirrors; and make it distribution-truthful (header + ados_distribution: redistributable + installer entry + drift-guard entry)."
links:
  change_spec: ./chg-GH-112-spec.md
  implementation_plan: ./chg-GH-112-plan.md
  testing_strategy: .ai/rules/testing-strategy.md
---

# Test Plan - Post-bulk-edit verify rule (grep/diff verify before commit)

## 1. Scope and Objectives

This plan verifies GH-112: a new standalone implementation rule — `.ai/rules/bulk-edit-verify.md` — becomes a **standing, loadable, distribution-truthful** rule (not ad-hoc agent behavior). The rule defines a bulk-edit trigger, a three-part MUST verify-before-commit gate (diff-stat, targeted grep, typecheck/compile), a substring-overlap pre-check, and a clean-revert recovery contract; it is surfaced via the `.ai/rules/README.md` index and load-references in `@coder`/`@pm`; and its `redistributable` marker is made honest by mirroring the README's end-to-end treatment (license header, marker, installer entry, drift-guard entry).

The core behavior to protect is **distribution correctness**: a bare `redistributable` marker on a file that is neither installed nor drift-guarded is exactly the drift class the GH-67 guard exists to catch. Three integrity risks drive the plan: (1) the **list-triple sync** — `scripts/install.sh` `ADOS_UPDATABLE_FILES`, `scripts/.tests/test-doc-distribution.sh` `STANDALONE_DOCS`, and `scripts/uninstall.sh` `ADOS_LOCAL_STANDALONE_DOCS` are independent hand-synced copies (ODR-0001; uninstall mirrors them via its own "MUST stay in sync" comment); the new path must land in **all three** with byte-identical strings. Of the three pairs, only the **install↔guard** pair is observed by guard mode 5 (derived-set drift) — the **install↔uninstall** pair has **no automated backstop**, so AC-F6-6 is verified by grep+diff inspection, not by the guard; (2) the **substring-overlap hazard** in any bulk edit of the lists themselves (the rule under test, ironically); and (3) **generated-plugin freshness** — editing `.opencode/agent/{coder,pm}.md` obligates a `.ados-claude/` regeneration, or the repo's staleness CI check fails.

This change is a **docs + static-config** change: there is **no application code**, so per `.ai/rules/testing-strategy.md` there are **no unit/integration behavior tests for app logic**. Verification is layered as: static/diff checks, content checks (deterministic `grep`/inspection anchored on the spec-mandated semantic content), and the existing automated shell gates (the drift guard + the generated-plugin build). The drift guard `scripts/.tests/test-doc-distribution.sh` is an **executable test that MUST stay green** — it is the primary automated gate for this change.

### 1.1 In Scope

- **The new rule file** — `.ai/rules/bulk-edit-verify.md`: trigger (F-1), three-part verify gate (F-2), substring-overlap check (F-3), clean-revert recovery (F-4), `#115` cross-link (AC-F1-2).
- **Discovery & agent loading** (F-5): `.ai/rules/README.md` index row; `@coder` + `@pm` load-references; `@reviewer` auto-discovery (no dedicated change — boundary).
- **Distribution truthfulness** (F-6): license header via `scripts/add-header-location.sh`; `ados_distribution: redistributable` marker; one `ADOS_UPDATABLE_FILES` entry; one `STANDALONE_DOCS` entry; one `ADOS_LOCAL_STANDALONE_DOCS` (uninstall) entry; drift guard green.
- **Generated mirrors** (NFR-5): `.ados-claude/agents/{coder,pm}.md` regenerated + committed.
- **Static gates**: `git diff --check`; additive-only (no existing entry removed).

### 1.2 Out of Scope & Known Gaps

- **No app-logic tests** — the rule is a static document; there is no runtime behavior to unit-test (spec NG-4: no hard gate mechanically enforces the verify step; it remains prompt-level — residual risk RSK-3).
- **Existing rule files** (`bash.md`, `installer.md`, `testing-strategy.md`) inconsistent header/marker status — explicitly out of scope (spec NG-3).
- **`@fixer` loading the rule** — deferred (spec §7.3 / OQ-1); baseline = coder + pm + README index.
- **`feature-ai-rules.md` spec** — advisory coverage gap (spec OQ-2); not a delivery blocker.

## 2. References

| Ref | Document | Relevance |
|-----|----------|-----------|
| Spec | `./chg-GH-112-spec.md` | Authoritative requirements: §5 capabilities (F-1..F-6), §8.3 data model (DM-1..DM-4), §9 NFRs (NFR-1..NFR-5), §17 acceptance criteria (15 ACs, all Given/When/Then). |
| Strategy | `.ai/rules/testing-strategy.md` | Canonical test layers: docs/templates → static/diff + content checks; `scripts/` → `bash scripts/.tests/test-<name>.sh`; fallback rule for docs-only changes (manual verification + `git diff --check`). |
| Bash rules | `.ai/rules/bash.md` | Shell conventions (load alongside strategy per its §Scope) — applies to the installer/guard list edits. |
| Drift guard | `scripts/.tests/test-doc-distribution.sh` | The executable gate. Read fully: 5 failure modes + `get_marker()` self-tests; `STANDALONE_DOCS` (L71-77) is where the new entry lands; mode 5 (derived-set drift) is the install↔guard list backstop. **Does NOT observe `uninstall.sh`.** |
| Installer | `scripts/install.sh` | `ADOS_UPDATABLE_FILES` (L98-107) is where the new entry lands; `get_marker()` (L670-713) is the two-path parser shared with the guard. |
| Uninstaller | `scripts/uninstall.sh` | `ADOS_LOCAL_STANDALONE_DOCS` (L103-109) is the third list the new entry must land in; its "MUST stay in sync with install.sh's standalone manifest" comment (L101-102) is the documented invariant. NOT observed by the drift guard — install↔uninstall drift is a manual (grep+diff) check only (AC-F6-6 / TC-DIST-007). |
| CI | `.github/workflows/ci.yml` | `verify-claude-build` job (generated-plugin freshness: `build-claude-plugin.sh` then `git diff --cached --exit-code .ados-claude/`); `doc-distribution-guard` job runs the guard + negative-modes harness. |
| Header script | `scripts/add-header-location.sh` | Sole sanctioned header mechanism (spec §2.1, AGENTS.md). Produces the 3-line MIT header + `source:` line. Agents must never add headers by hand. |
| Precedent | `doc/changes/2026-06/2026-06-25--GH-67--marker-driven-doc-distribution/chg-GH-67-test-plan.md` | Style/depth model for a doc-distribution change; this plan mirrors its layering and traceability approach. |
| Decision | `doc/decisions/ODR-0001` | `ADOS_UPDATABLE_FILES` ⟷ `STANDALONE_DOCS` are independent hand-synced copies; mode 5 catches their drift. |
| PM notes | `./chg-GH-112-pm-notes.yaml` | Settled decisions DEC-1/DEC-2/DEC-3 (mirror README treatment; standalone file; coder+pm load-set). |

## 3. Coverage Overview

Every spec §17 acceptance criterion is traced below. Spec §17 enumerates **15 ACs** (`AC-F1-1 … AC-F6-6`); all 15 are covered — no gaps. (`DM-1..DM-4`, `NFR-1..NFR-5` are covered in §3.2 / §3.3.)

### 3.1 Functional Coverage (F-#, AC-#)

| AC ID | Description (given/when/then, condensed) | TC ID(s) | Status |
|-------|------------------------------------------|----------|--------|
| AC-F1-1 | `bulk-edit-verify.md` exists + states trigger (multi-file edit / regex·sed·replaceAll / find-and-replace over glob) | TC-RULE-001 | Covered |
| AC-F2-1 | Three-part verify gate phrased **MUST** before commit: (a) `git diff --stat`, (b) targeted grep, (c) typecheck/compile for code | TC-RULE-002 | Covered |
| AC-F3-1 | Substring-overlap section: grep identifiers **containing** A; word-boundary/anchored/scoped remedy; stated for **both** pre- and post-substitution | TC-RULE-003 | Covered |
| AC-F4-1 | Recovery: **MUST** revert (`git checkout -- <paths>`) + re-apply safe substitutions; **prohibition** on in-place counter-edits | TC-RULE-004 | Covered |
| AC-F1-2 | One-way cross-link reference to **#115** | TC-RULE-005 | Covered |
| AC-F5-1 | `@coder` references the bulk-edit-verify rule (directly or via README discovery protocol) | TC-DISC-001 | Covered (verification nuance — OQ-TP-1) |
| AC-F5-2 | `@pm` references the bulk-edit-verify rule (for when PM implements directly) | TC-DISC-002 | Covered (verification nuance — OQ-TP-1) |
| AC-F5-3 | `.ai/rules/README.md` index has a row for `bulk-edit-verify.md` (task/context + description) | TC-DISC-003 | Covered |
| AC-F6-1 | Standard 3-line MIT license header present (via sanctioned script, never by hand) | TC-DIST-001 | Covered |
| AC-F6-2 | Frontmatter declares `ados_distribution: redistributable` | TC-DIST-002 | Covered |
| AC-F6-3 | `scripts/install.sh` `ADOS_UPDATABLE_FILES` contains one entry for the new rule path | TC-DIST-003 | Covered |
| AC-F6-4 | `STANDALONE_DOCS` contains one entry identical to the installer entry | TC-DIST-004 | Covered |
| AC-F6-5 | `bash scripts/.tests/test-doc-distribution.sh` exits 0 (green) | TC-DIST-005 | Covered |
| AC-F6-6 | `scripts/uninstall.sh` `ADOS_LOCAL_STANDALONE_DOCS` contains one entry for the new rule path, byte-identical to the install (DM-2) and guard (DM-3) entries | TC-DIST-007 | Covered |
| AC-F5-4 | `.ados-claude/agents/` mirrors current (regenerated + committed alongside source edits) | TC-DISC-004 | Covered |

### 3.2 Interface Coverage (API-#, EVT-#, DM-#)

No REST/HTTP (spec §8.1 N/A) or event (§8.2 N/A) surfaces. Data-model coverage (static list/array edits):

| DM ID | Contract | TC ID(s) | Status |
|-------|----------|----------|--------|
| DM-1 | `.ai/rules/README.md` index table — one new row (task/context, file name, description); no schema change | TC-DISC-003 | Covered |
| DM-2 | `scripts/install.sh` `ADOS_UPDATABLE_FILES` — one new string entry (the new rule path) appended | TC-DIST-003, TC-GATE-002 | Covered |
| DM-3 | `scripts/.tests/test-doc-distribution.sh` `STANDALONE_DOCS` — one new string entry mirroring DM-2 | TC-DIST-004, TC-GATE-002 | Covered |
| DM-4 | `scripts/uninstall.sh` `ADOS_LOCAL_STANDALONE_DOCS` — one new string entry mirroring DM-2/DM-3 | TC-DIST-007, TC-GATE-002 | Covered |

### 3.3 Non-Functional Coverage (NFR-#)

| NFR ID | Requirement | Threshold | TC ID(s) | Status |
|--------|-------------|-----------|----------|--------|
| NFR-1 | Rule loadability / clarity — valid Markdown; verify gate phrased imperative **MUST** (not SHOULD/MAY) | MUST present; renders cleanly | TC-RULE-002, TC-GATE-003 | Covered |
| NFR-2 | Distribution correctness — drift guard green with the rule present + marked `redistributable` | `test-doc-distribution.sh` exit 0 | TC-DIST-005 | Covered |
| NFR-3 | Rule conciseness — bounded length, single-topic, no redundancy | Density consistent with existing rule files | TC-GATE-003 | Covered (manual judgment) |
| NFR-4 | List-TRIPLE synchronization — installer + guard + uninstall lists each carry exactly one new entry with **identical** path strings | All three `== 1`; byte-identical quoted string across install+guard+uninstall; install↔guard mode 5 backstop (install↔uninstall NOT guarded — verified by grep+diff) | TC-DIST-003, TC-DIST-004, TC-DIST-007 | Covered |
| NFR-5 | Generated-plugin freshness — `.ados-claude/agents/` mirrors regenerated + committed | build → `git diff --cached --exit-code .ados-claude/` exit 0 | TC-DISC-004 | Covered |

## 4. Test Types and Layers

Per `.ai/rules/testing-strategy.md` (and `.ai/rules/bash.md` for the shell list edits). This is a docs + static-config change — **no app-logic tests**. Layers map as:

| Layer | Type | Framework / location | Pattern | Used here |
|-------|------|----------------------|---------|-----------|
| Automated shell gate | Automated (existing) | `scripts/.tests/test-doc-distribution.sh` | `bash scripts/.tests/test-doc-distribution.sh` → exit 0 | Primary gate (AC-F6-5 / NFR-2) |
| Automated shell gate | Automated (existing) | `scripts/.tests/test-doc-distribution-modes.sh` | `bash scripts/.tests/test-doc-distribution-modes.sh` → exit 0 | Regression — new `STANDALONE_DOCS` entry must not break negative-mode harness |
| Automated tool gate | Automated (existing CI) | `scripts/build-claude-plugin.sh` + `git diff` | build → stage `.ados-claude/` → assert no diff | Generated-plugin freshness (AC-F5-4 / NFR-5) |
| Static/diff | Semi-automated | `git diff --check` | whitespace/conflict-marker guard | Always (TC-GATE-001) |
| Content | Semi-automated | `grep`/`test -f` content assertions on the rule, README, agent files, installer, guard, uninstaller | deterministic patterns (§5.2) | Rule content + discovery + distribution wiring |
| Content | Manual | Markdown render review; conciseness judgment; header-provenance check | n/a | NFR-1/NFR-3 + header-via-script (TC-GATE-003, TC-DIST-001) |

**Conventions honored:** evidence recorded in §10; narrow changed-module checks first; docs-only content checks are `grep`-driven and deterministic where the spec mandates specific semantic anchors (trigger dimensions, MUST phrasing, `#115`, the rule filename, the quoted path string). The only **committed** executable test files touched by this change are the two existing guard scripts (one new entry each); **no new test file is authored** — content checks are run as one-off verification commands during quality gates (per the strategy's docs → content-checks mapping).

## 5. Test Scenarios

### 5.1 Scenario Index

| TC ID | Title | Type | Priority | AC Coverage |
|-------|-------|------|----------|-------------|
| TC-RULE-001 | Rule file exists + trigger definition (3 dimensions) | Happy Path | High | AC-F1-1, F-1 |
| TC-RULE-002 | Three-part verify gate, MUST, before commit | Happy Path | High | AC-F2-1, NFR-1 |
| TC-RULE-003 | Substring-overlap check, both pre/post stages | Corner Case | High | AC-F3-1 |
| TC-RULE-004 | Clean-revert recovery contract + counter-edit prohibition | Negative | High | AC-F4-1 |
| TC-RULE-005 | One-way cross-link to #115 | Regression | Medium | AC-F1-2 |
| TC-DISC-001 | @coder load-reference to the rule | Regression | High | AC-F5-1 |
| TC-DISC-002 | @pm load-reference to the rule | Regression | High | AC-F5-2 |
| TC-DISC-003 | README index row for bulk-edit-verify.md | Happy Path | High | AC-F5-3, DM-1 |
| TC-DISC-004 | Generated .ados-claude mirrors current | Regression | High | AC-F5-4, NFR-5 |
| TC-DISC-005 | @reviewer auto-discovery unaffected (boundary) | Regression | Low | F-5 (no-change claim) |
| TC-DIST-001 | License header (3 lines) present via script | Happy Path | High | AC-F6-1 |
| TC-DIST-002 | ados_distribution: redistributable marker valid | Happy Path | High | AC-F6-2 |
| TC-DIST-003 | install.sh ADOS_UPDATABLE_FILES entry (exactly one) | Happy Path | High | AC-F6-3, DM-2 |
| TC-DIST-004 | Guard STANDALONE_DOCS entry + 3-way list identity | Happy Path | High | AC-F6-4, DM-3, NFR-4 |
| TC-DIST-005 | Drift guard exits 0 (green) | Happy Path | High | AC-F6-5, NFR-2, NFR-4 |
| TC-DIST-006 | Negative-mode guard harness stays green | Regression | Medium | NFR-2 (regression) |
| TC-DIST-007 | uninstall.sh ADOS_LOCAL_STANDALONE_DOCS entry + 3-way byte-identity | Happy Path | High | AC-F6-6, DM-4, NFR-4 |
| TC-GATE-001 | git diff --check clean (whitespace/conflict) | Regression | High | (static gate) |
| TC-GATE-002 | Additive-only — no existing entry removed; counts +1 | Regression | High | DM-2, DM-3, DM-1 |
| TC-GATE-003 | Markdown validity + conciseness | Corner Case | Medium | NFR-1, NFR-3 |
| TC-GATE-004 | No hand-added headers outside sanctioned paths | Regression | Low | (process hygiene) |

**Totals:** 21 test cases — 5 rule content (`TC-RULE-*`), 5 discovery/loading (`TC-DISC-*`), 7 distribution (`TC-DIST-*`), 4 static/cross-cutting (`TC-GATE-*`). Of these, the executable automated gates are `TC-DIST-005`, `TC-DIST-006`, `TC-DISC-004`, `TC-GATE-001`; the remainder are deterministic `grep`/inspection content checks (semi-automated) or manual judgment.

### 5.2 Scenario Details

#### TC-RULE-001 - Rule file exists + trigger definition (3 dimensions)

**Scenario Type**: Happy Path
**Impact Level**: Critical
**Priority**: High
**Related IDs**: AC-F1-1, F-1
**Test Type(s)**: Manual
**Automation Level**: Semi-automated
**Target Layer / Location**: `.ai/rules/bulk-edit-verify.md`
**Tags**: @docs, @rules

**Preconditions**:
- The rule file has been authored (delivery phase).

**Steps**:
1. Assert the file exists:
   `test -f .ai/rules/bulk-edit-verify.md`  → exit 0.
2. Assert the trigger states the **multi-file edit** dimension:
   `grep -Eiq 'multi-file|more than one file|>1 file' .ai/rules/bulk-edit-verify.md`  → exit 0.
3. Assert the trigger states the **regex/sed/replaceAll substitution** dimension:
   `grep -Eiq 'sed|replaceAll|regex|substitut' .ai/rules/bulk-edit-verify.md`  → exit 0.
4. Assert the trigger states the **find-and-replace over a glob** dimension:
   `grep -Eiq 'find.and.replace|glob' .ai/rules/bulk-edit-verify.md`  → exit 0.

**Expected Outcome**:
- File exists and the trigger section names all three activation conditions (multi-file, substitution, globbed find-and-replace). The trigger is phrased as an objective condition (spec §5.1 F-1).

#### TC-RULE-002 - Three-part verify gate, MUST, before commit

**Scenario Type**: Happy Path
**Impact Level**: Critical
**Priority**: High
**Related IDs**: AC-F2-1, F-2, NFR-1
**Test Type(s)**: Manual
**Automation Level**: Semi-automated
**Target Layer / Location**: `.ai/rules/bulk-edit-verify.md`
**Tags**: @docs, @rules

**Preconditions**:
- Rule authored.

**Steps**:
1. Assert the verify gate is phrased as imperative **MUST** (NFR-1: not SHOULD/MAY):
   `grep -Ec '\bMUST\b' .ai/rules/bulk-edit-verify.md`  → ≥ 1 (expect ≥ 3 occurrences across verify/overlap/recovery).
2. Assert part (a) — `git diff --stat` to confirm the intended file set:
   `grep -Fq 'git diff --stat' .ai/rules/bulk-edit-verify.md`  → exit 0.
3. Assert part (b) — targeted grep for the substituted token:
   `grep -Eiq 'grep' .ai/rules/bulk-edit-verify.md`  → exit 0.
4. Assert part (c) — typecheck/compile gate for code:
   `grep -Eiq 'typecheck|type-check|compile|build gate' .ai/rules/bulk-edit-verify.md`  → exit 0.
5. Assert the gate is executed **before** commit:
   `grep -Eiq 'before committ|prior to committ|before .*commit' .ai/rules/bulk-edit-verify.md`  → exit 0.

**Expected Outcome**:
- The verify section is a MUST, executed before commit, naming all three parts (diff-stat, targeted grep, typecheck/compile).

#### TC-RULE-003 - Substring-overlap check, both pre/post stages

**Scenario Type**: Corner Case
**Impact Level**: Critical
**Priority**: High
**Related IDs**: AC-F3-1, F-3
**Test Type(s)**: Manual
**Automation Level**: Semi-automated
**Target Layer / Location**: `.ai/rules/bulk-edit-verify.md`
**Tags**: @docs, @rules

**Preconditions**:
- Rule authored.

**Steps**:
1. Assert explicit instruction to grep for identifiers **containing** token A:
   `grep -Eiq 'containing|substring|longer identifier' .ai/rules/bulk-edit-verify.md`  → exit 0.
2. Assert the remedy — word-boundary/anchored patterns or scoped paths:
   `grep -Eiq 'word.?boundar|anchored' .ai/rules/bulk-edit-verify.md`  → exit 0  **and**
   `grep -Eiq 'scoped|scope the|narrow' .ai/rules/bulk-edit-verify.md`  → exit 0.
3. Assert the check is stated for the **pre-substitution (planning)** stage:
   `grep -Eiq 'pre-substitut|before substitut|planning' .ai/rules/bulk-edit-verify.md`  → exit 0.
4. Assert the check is stated for the **post-substitution (verify)** stage:
   `grep -Eiq 'post-substitut|after substitut|verif' .ai/rules/bulk-edit-verify.md`  → exit 0.

**Expected Outcome**:
- The substring-overlap hazard is named, the containing-grep technique is prescribed, the safe-substitution remedy is given, and the check is required at both stages (spec §5.1 F-3). This is the highest-value addition (G-2).

#### TC-RULE-004 - Clean-revert recovery contract + counter-edit prohibition

**Scenario Type**: Negative
**Impact Level**: Critical
**Priority**: High
**Related IDs**: AC-F4-1, F-4
**Test Type(s)**: Manual
**Automation Level**: Semi-automated
**Target Layer / Location**: `.ai/rules/bulk-edit-verify.md`
**Tags**: @docs, @rules

**Preconditions**:
- Rule authored.

**Steps**:
1. Assert the recovery uses `git checkout` to revert the uncommitted edit:
   `grep -Eq 'git checkout' .ai/rules/bulk-edit-verify.md`  → exit 0  **and**
   `grep -Eiq 'revert' .ai/rules/bulk-edit-verify.md`  → exit 0.
2. Assert re-apply with safe substitutions:
   `grep -Eiq 're-apply|reapply' .ai/rules/bulk-edit-verify.md`  → exit 0.
3. Assert an explicit **prohibition** on in-place counter-edits:
   `grep -Eiq 'counter-edit|counter edit|in-place|in place' .ai/rules/bulk-edit-verify.md`  → exit 0  **and**
   `grep -Eq 'MUST NOT|must not' .ai/rules/bulk-edit-verify.md`  → exit 0.

**Expected Outcome**:
- The recovery contract is a MUST to revert + re-apply, with an explicit MUST-NOT on in-place counter-edits (spec §5.1 F-4; the failure mode that compounds damage).

#### TC-RULE-005 - One-way cross-link to #115

**Scenario Type**: Regression
**Impact Level**: Minor
**Priority**: Medium
**Related IDs**: AC-F1-2, F-1
**Test Type(s)**: Manual
**Automation Level**: Semi-automated
**Target Layer / Location**: `.ai/rules/bulk-edit-verify.md`
**Tags**: @docs, @rules

**Preconditions**:
- Rule authored.

**Steps**:
1. `grep -Fc '#115' .ai/rules/bulk-edit-verify.md`  → ≥ 1.

**Expected Outcome**:
- The rule contains a one-way reference to #115 (large-artifact authoring policy). Creates no delivery dependency (spec §7.1, §13).

#### TC-DISC-001 - @coder load-reference to the rule

**Scenario Type**: Regression
**Impact Level**: Critical
**Priority**: High
**Related IDs**: AC-F5-1, F-5
**Test Type(s)**: Manual
**Automation Level**: Semi-automated
**Target Layer / Location**: `.opencode/agent/coder.md`
**Tags**: @agents, @rules

**Preconditions**:
- `coder.md` rule-loading section updated. (Baseline: `coder.md` currently has **zero** `bulk-edit-verify` references — confirmed.)

**Steps**:
1. Assert a direct named reference (preferred form):
   `grep -Fc 'bulk-edit-verify' .opencode/agent/coder.md`  → ≥ 1.

**Expected Outcome**:
- `@coder`'s rule-loading section references the bulk-edit-verify rule so the rule is loaded before any multi-file edit (G-4 effectiveness).

**Notes / Clarifications**:
- AC-F5-1 allows "directly **or** via the README index discovery protocol". The **direct named reference is strongly preferred** because it is unambiguous, maximally effective (G-4), and deterministically testable. If the implementation instead relies **purely** on the README-discovery protocol (coder.md loads `.ai/rules/README.md` generically without naming the rule), this single grep is insufficient — see **OQ-TP-1**; in that case TC-DISC-001 reduces to a joint assertion with TC-DISC-003 (README row present) **plus** a generic `.ai/rules/README.md` load-reference in `coder.md`. The plan-writer/coder should pick the direct form to keep this AC mechanically verifiable.

#### TC-DISC-002 - @pm load-reference to the rule

**Scenario Type**: Regression
**Impact Level**: Important
**Priority**: High
**Related IDs**: AC-F5-2, F-5
**Test Type(s)**: Manual
**Automation Level**: Semi-automated
**Target Layer / Location**: `.opencode/agent/pm.md`
**Tags**: @agents, @rules

**Preconditions**:
- `pm.md` rule-loading section updated. (Baseline: `pm.md` currently has **zero** `bulk-edit-verify` references — confirmed.) Note `pm.md` declares PM does not implement directly; the reference is conditional ("when PM implements directly").

**Steps**:
1. `grep -Fc 'bulk-edit-verify' .opencode/agent/pm.md`  → ≥ 1.

**Expected Outcome**:
- `@pm` references the rule for the case where PM implements directly (spec §5.1 F-5).

**Notes / Clarifications**:
- Same direct-vs-discovery nuance as TC-DISC-001 (OQ-TP-1); direct named reference preferred.

#### TC-DISC-003 - README index row for bulk-edit-verify.md

**Scenario Type**: Happy Path
**Impact Level**: Critical
**Priority**: High
**Related IDs**: AC-F5-3, F-5, DM-1
**Test Type(s)**: Manual
**Automation Level**: Semi-automated
**Target Layer / Location**: `.ai/rules/README.md`
**Tags**: @docs, @rules

**Preconditions**:
- README index updated. (Baseline: 3 data rows — bash, installer, testing-strategy.)

**Steps**:
1. Assert the rule filename appears in the index:
   `grep -Fc 'bulk-edit-verify.md' .ai/rules/README.md`  → ≥ 1.
2. Assert it is a real table row (task/context + file + description columns):
   `grep -Eq '\|.*bulk-edit-verify\.md.*\|' .ai/rules/README.md`  → exit 0.

**Expected Outcome**:
- The discovery index surfaces the rule so the README-driven load protocol (`.ai/rules/README.md` "How agents use rules") finds it (spec §5.1 F-5, DM-1).

#### TC-DISC-004 - Generated .ados-claude mirrors current

**Scenario Type**: Regression
**Impact Level**: Critical
**Priority**: High
**Related IDs**: AC-F5-4, F-5, NFR-5
**Test Type(s)**: Manual
**Automation Level**: Automated
**Target Layer / Location**: `scripts/build-claude-plugin.sh` → `.ados-claude/`
**Tags**: @ci, @agents

**Preconditions**:
- `.opencode/agent/{coder,pm}.md` source edits delivered.

**Steps**:
1. Regenerate from source:
   `bash scripts/build-claude-plugin.sh`  → exit 0.
2. Stage the generated tree (mirrors the CI job so untracked/added/removed files are detected):
   `git add -A .ados-claude/`
3. Assert freshness — no diff after regeneration:
   `git diff --cached --exit-code .ados-claude/`  → exit 0.
4. Assert the mirrors actually carry the rule reference:
   `grep -Fq 'bulk-edit-verify' .ados-claude/agents/coder.md`  → exit 0  **and**
   `grep -Fq 'bulk-edit-verify' .ados-claude/agents/pm.md`  → exit 0.

**Expected Outcome**:
- The generated plugin is current (NFR-5). This is the exact check the `verify-claude-build` CI job performs (`ci.yml` L20-36): it runs `build-claude-plugin.sh`, stages `.ados-claude/`, and fails on any cached diff. The mirrors must never be hand-edited.

#### TC-DISC-005 - @reviewer auto-discovery unaffected (boundary)

**Scenario Type**: Regression
**Impact Level**: Minor
**Priority**: Low
**Related IDs**: F-5
**Test Type(s)**: Manual
**Automation Level**: Semi-automated
**Target Layer / Location**: `.opencode/agent/reviewer.md`
**Tags**: @agents, @rules

**Preconditions**:
- Delivery complete (reviewer.md is NOT edited by this change).

**Steps**:
1. Assert `@reviewer` still loads `.ai/rules/` via its pre-flight (no regression; spec §5.1 F-5 / §12 assumption):
   `grep -Fq '.ai/rules/' .opencode/agent/reviewer.md`  → exit 0.
2. Confirm `git diff --name-only` does **not** list `.opencode/agent/reviewer.md` (no dedicated reviewer change needed — it discovers the rule through the index).

**Expected Outcome**:
- The reviewer auto-discovery path is intact; the new rule is surfaced during review without a dedicated reviewer edit (spec DEC-3 / §12).

#### TC-DIST-001 - License header (3 lines) present via script

**Scenario Type**: Happy Path
**Impact Level**: Critical
**Priority**: High
**Related IDs**: AC-F6-1, F-6
**Test Type(s)**: Manual
**Automation Level**: Semi-automated
**Target Layer / Location**: `.ai/rules/bulk-edit-verify.md` (header by `scripts/add-header-location.sh`)
**Tags**: @docs, @distribution

**Preconditions**:
- Header applied via `scripts/add-header-location.sh .ai/rules/bulk-edit-verify.md` (never by hand — AGENTS.md).

**Steps**:
1. Assert the 3-line MIT header is present and matches the script's exact output (mirror `.ai/rules/README.md`):
   `grep -c '^# Copyright (c) 2025-2026 Juliusz' .ai/rules/bulk-edit-verify.md`  → == 1.
   `grep -c '^# MIT License - see LICENSE file for full terms' .ai/rules/bulk-edit-verify.md`  → == 1.
   `grep -c "^source: https://github.com/juliusz-cwiakalski/agentic-delivery-os/blob/main/.ai/rules/bulk-edit-verify.md" .ai/rules/bulk-edit-verify.md`  → == 1.
2. Provenance check (manual): re-run `scripts/add-header-location.sh .ai/rules/bulk-edit-verify.md` and assert it is idempotent (`git diff` shows no change) — confirms the header was applied by the sanctioned script, not hand-typed (which could drift from the canonical form).

**Expected Outcome**:
- The standard 3-line header + `source:` line are present and byte-match the script output (AC-F6-1). Agents must never hand-add headers.

#### TC-DIST-002 - ados_distribution: redistributable marker valid

**Scenario Type**: Happy Path
**Impact Level**: Critical
**Priority**: High
**Related IDs**: AC-F6-2, F-6, NFR-2
**Test Type(s)**: Manual
**Automation Level**: Semi-automated
**Target Layer / Location**: `.ai/rules/bulk-edit-verify.md` (frontmatter)
**Tags**: @docs, @distribution

**Preconditions**:
- Marker added inside the first `---` frontmatter block (the `.md` parser path; mirrors README).

**Steps**:
1. Assert the marker is present in frontmatter (allow optional quotes, which the guard's `get_marker()` strips):
   `grep -Eq '^ados_distribution:[[:space:]]*"?redistributable"?$' .ai/rules/bulk-edit-verify.md`  → exit 0.
2. (Authoritative enum check is the guard itself — TC-DIST-005. The marker is a valid enum value `{redistributable|internal|project-generated}`; an invalid/typo value fails guard mode 2.)

**Expected Outcome**:
- The file declares `ados_distribution: redistributable` (AC-F6-2). The guard parses it via the two-path `.md` frontmatter reader and classifies it as installed (mode 3) — proven end-to-end by TC-DIST-005.

#### TC-DIST-003 - install.sh ADOS_UPDATABLE_FILES entry (exactly one)

**Scenario Type**: Happy Path
**Impact Level**: Critical
**Priority**: High
**Related IDs**: AC-F6-3, F-6, DM-2, NFR-4
**Test Type(s)**: Manual
**Automation Level**: Semi-automated
**Target Layer / Location**: `scripts/install.sh` (`ADOS_UPDATABLE_FILES`, L98-107)
**Tags**: @install, @distribution

**Preconditions**:
- Installer list updated. (Baseline: 4 entries — `doc/documentation-handbook.md`, `doc/00-index.md`, `doc/decisions/README.md`, `.ai/rules/README.md`.)

**Steps**:
1. Assert exactly one quoted entry for the new rule path:
   `grep -Ec '"\.ai/rules/bulk-edit-verify\.md"' scripts/install.sh`  → == 1.

**Expected Outcome**:
- One (not zero, not duplicated) entry in `ADOS_UPDATABLE_FILES` (AC-F6-3 / DM-2). This makes the `redistributable` marker truthful — the file is actually installed on the next `install.sh --local` (spec DEC-1 / Appendix A).

#### TC-DIST-004 - Guard STANDALONE_DOCS entry + 3-way list identity

**Scenario Type**: Happy Path
**Impact Level**: Critical
**Priority**: High
**Related IDs**: AC-F6-4, F-6, DM-3, NFR-4
**Test Type(s)**: Manual
**Automation Level**: Semi-automated
**Target Layer / Location**: `scripts/.tests/test-doc-distribution.sh` (`STANDALONE_DOCS`, L71-77)
**Tags**: @guard, @distribution

**Preconditions**:
- Guard scan list updated. (Baseline: 5 entries.)

**Steps**:
1. Assert exactly one quoted entry in the guard's `STANDALONE_DOCS`:
   `grep -Ec '"\.ai/rules/bulk-edit-verify\.md"' scripts/.tests/test-doc-distribution.sh`  → == 1.
2. Assert the quoted path string is **byte-identical across all THREE lists** (NFR-4 list-triple sync — install + guard + uninstall):
   ```
   diff <(grep -oE '"\.ai/rules/bulk-edit-verify\.md"' scripts/install.sh | sort -u) \
        <(grep -oE '"\.ai/rules/bulk-edit-verify\.md"' scripts/.tests/test-doc-distribution.sh | sort -u)
   diff <(grep -oE '"\.ai/rules/bulk-edit-verify\.md"' scripts/install.sh | sort -u) \
        <(grep -oE '"\.ai/rules/bulk-edit-verify\.md"' scripts/uninstall.sh | sort -u)
   ```
   → both `diff`s produce no output (the three quoted strings are identical). The primary 3-way identity assertion is jointly owned by TC-DIST-007.

**Expected Outcome**:
- The guard scan list carries one entry, identical to the installer and uninstaller entries (AC-F6-4 / DM-3 / NFR-4). The three lists are independent hand-synced copies (ODR-0001 + uninstall's "MUST stay in sync" comment); guard mode 5 (derived-set drift) is the independent backstop for the **install↔guard** pair only — the **install↔uninstall** pair has no automated backstop and is verified by the `diff` above (exercised on the real repo by TC-DIST-005 for install↔guard, and by the manual grep+diff here + TC-DIST-007 for uninstall).

#### TC-DIST-005 - Drift guard exits 0 (green)

**Scenario Type**: Happy Path
**Impact Level**: Critical
**Priority**: High
**Related IDs**: AC-F6-5, F-6, NFR-2, NFR-4
**Test Type(s)**: Integration
**Automation Level**: Automated
**Target Layer / Location**: `scripts/.tests/test-doc-distribution.sh`
**Tags**: @backend, @guard, @ci

**Preconditions**:
- All F-6 wiring delivered: marker (TC-DIST-002), installer entry (TC-DIST-003), guard entry (TC-DIST-004).

**Steps**:
1. Run the guard against the real checkout:
   `bash scripts/.tests/test-doc-distribution.sh`  → exit 0.
2. Confirm it reports the new in-scope doc (the DM-2 total grows by one; e.g. previously N docs → N+1) with no `::error::` annotations and no failure mode tripped.

**Expected Outcome**:
- Guard exits 0: no missing/invalid marker (modes 1/2), the new redistributable doc IS installed (mode 3), no internal doc leaks (mode 4), and the marker-derived set equals the sandbox install set (mode 5 — the install↔guard list-sync backstop; the install↔uninstall pair is NOT guard-observed, see TC-DIST-007). This is the headline PASS criterion (AC-F6-5 / NFR-2) and the wired CI gate (`doc-distribution-guard` job).

#### TC-DIST-006 - Negative-mode guard harness stays green

**Scenario Type**: Regression
**Impact Level**: Important
**Priority**: Medium
**Related IDs**: NFR-2
**Test Type(s)**: Integration
**Automation Level**: Automated
**Target Layer / Location**: `scripts/.tests/test-doc-distribution-modes.sh`
**Tags**: @backend, @guard, @ci

**Preconditions**:
- The new `STANDALONE_DOCS` entry is in place.

**Steps**:
1. Run the committed negative-mode self-tests:
   `bash scripts/.tests/test-doc-distribution-modes.sh`  → exit 0.

**Expected Outcome**:
- The 5 failure modes still fire correctly on synthetic trees (the new list entry does not break the harness). This is the second step of the `doc-distribution-guard` CI job; a regression that silently disables a mode must not go green.

#### TC-DIST-007 - uninstall.sh ADOS_LOCAL_STANDALONE_DOCS entry + 3-way byte-identity

**Scenario Type**: Happy Path
**Impact Level**: Critical
**Priority**: High
**Related IDs**: AC-F6-6, F-6, DM-4, NFR-4
**Test Type(s)**: Manual
**Automation Level**: Semi-automated
**Target Layer / Location**: `scripts/uninstall.sh` (`ADOS_LOCAL_STANDALONE_DOCS`, L103-109)
**Tags**: @uninstall, @distribution

**Preconditions**:
- Uninstaller list updated. (Baseline: 5 entries — mirrors the guard's `STANDALONE_DOCS`: `doc/documentation-handbook.md`, `doc/00-index.md`, `doc/decisions/README.md`, `doc/decisions/00-index.md`, `.ai/rules/README.md`.)
- Install entry (TC-DIST-003) and guard entry (TC-DIST-004) already delivered, so the cross-list comparison is meaningful.

**Steps**:
1. Assert exactly one quoted entry in the uninstaller's `ADOS_LOCAL_STANDALONE_DOCS`:
   `grep -Ec '"\.ai/rules/bulk-edit-verify\.md"' scripts/uninstall.sh`  → == 1.
2. Assert the quoted path string is **byte-identical across all THREE lists** (NFR-4 list-triple sync). Two equivalent assertions; either (or both) may be used:
   - **3-way `diff`** — extract each quoted occurrence from install / guard / uninstall and diff pairwise:
     ```
     a=$(grep -oE '"\.ai/rules/bulk-edit-verify\.md"' scripts/install.sh | sort -u)
     b=$(grep -oE '"\.ai/rules/bulk-edit-verify\.md"' scripts/.tests/test-doc-distribution.sh | sort -u)
     c=$(grep -oE '"\.ai/rules/bulk-edit-verify\.md"' scripts/uninstall.sh | sort -u)
     diff <(printf '%s\n' "$a") <(printf '%s\n' "$b") && diff <(printf '%s\n' "$a") <(printf '%s\n' "$c")
     ```
     → no output from either diff (all three identical).
   - **Count assertion** — the exact quoted path appears exactly once in each of the three files (3 matching lines total):
     `grep -E '"\.ai/rules/bulk-edit-verify\.md"' scripts/install.sh scripts/.tests/test-doc-distribution.sh scripts/uninstall.sh | wc -l`  → `== 3` (one match per file).

**Expected Outcome**:
- The uninstaller's `ADOS_LOCAL_STANDALONE_DOCS` carries one entry, byte-identical to the install (DM-2) and guard (DM-3) entries (AC-F6-6 / DM-4 / NFR-4). All three lists carry exactly one occurrence each of the identical quoted string.

**Postconditions** (optional):
- The install↔uninstall pair remains in sync; the uninstaller's "This list MUST stay in sync with install.sh's standalone manifest" comment (uninstall.sh L101-102) is the documented invariant.

**Notes / Clarifications** (optional):
- **No automated backstop.** The drift guard (`test-doc-distribution.sh`) observes only `install.sh` `ADOS_UPDATABLE_FILES` ⟷ `STANDALONE_DOCS` (mode 5); it does **not** read `uninstall.sh`. Therefore AC-F6-6 / the install↔uninstall half of NFR-4 is verified by this grep+diff inspection only — there is no install/uninstall symmetry test in CI today. If such a guard mode were added later, this TC would fold into it; until then it is a semi-automated content check run during quality gates.

#### TC-GATE-001 - git diff --check clean (whitespace/conflict)

**Scenario Type**: Regression
**Impact Level**: Important
**Priority**: High
**Related IDs**: (static gate — testing-strategy.md layer 1)
**Test Type(s)**: Manual
**Automation Level**: Automated
**Target Layer / Location**: repo working tree
**Tags**: @ci, @static

**Preconditions**:
- Delivery complete.

**Steps**:
1. `git diff --check`  → exit 0 (no trailing whitespace, no conflict markers).

**Expected Outcome**:
- Clean static/diff baseline (testing-strategy.md "Static/diff checks (always)").

#### TC-GATE-002 - Additive-only — no existing entry removed; counts +1

**Scenario Type**: Regression
**Impact Level**: Critical
**Priority**: High
**Related IDs**: DM-1, DM-2, DM-3, DM-4
**Test Type(s)**: Manual
**Automation Level**: Semi-automated
**Target Layer / Location**: `scripts/install.sh`, `scripts/.tests/test-doc-distribution.sh`, `scripts/uninstall.sh`, `.ai/rules/README.md`
**Tags**: @regression

**Preconditions**:
- Delivery complete.

**Steps**:
1. Assert all pre-existing `ADOS_UPDATABLE_FILES` entries survive (installer list grew by exactly one — was 4, now 5):
   `grep -Fq '"doc/documentation-handbook.md"' scripts/install.sh` && `grep -Fq '"doc/00-index.md"' scripts/install.sh` && `grep -Fq '"doc/decisions/README.md"' scripts/install.sh` && `grep -Fq '".ai/rules/README.md"' scripts/install.sh`  → all exit 0.
2. Assert all pre-existing `STANDALONE_DOCS` entries survive (guard list grew by exactly one — was 5, now 6):
   `grep -Fq '"doc/documentation-handbook.md"' scripts/.tests/test-doc-distribution.sh` && `grep -Fq '"doc/00-index.md"' scripts/.tests/test-doc-distribution.sh` && `grep -Fq '"doc/decisions/README.md"' scripts/.tests/test-doc-distribution.sh` && `grep -Fq '"doc/decisions/00-index.md"' scripts/.tests/test-doc-distribution.sh` && `grep -Fq '".ai/rules/README.md"' scripts/.tests/test-doc-distribution.sh`  → all exit 0.
3. Assert all pre-existing `ADOS_LOCAL_STANDALONE_DOCS` entries survive (uninstaller list grew by exactly one — was 5, now 6):
   `grep -Fq '"doc/documentation-handbook.md"' scripts/uninstall.sh` && `grep -Fq '"doc/00-index.md"' scripts/uninstall.sh` && `grep -Fq '"doc/decisions/README.md"' scripts/uninstall.sh` && `grep -Fq '"doc/decisions/00-index.md"' scripts/uninstall.sh` && `grep -Fq '".ai/rules/README.md"' scripts/uninstall.sh`  → all exit 0.
4. Assert the README index still lists the 3 pre-existing rules (bash, installer, testing-strategy) plus the new one:
   `grep -Fc 'bash.md' .ai/rules/README.md` ≥ 1 && `grep -Fc 'installer.md' .ai/rules/README.md` ≥ 1 && `grep -Fc 'testing-strategy.md' .ai/rules/README.md` ≥ 1  → all pass.

**Expected Outcome**:
- The change is purely additive (spec §8.5 Backward Compatibility): no existing rule, list entry, or index row removed/renamed — across all three distribution lists. Catches an accidental list-clobber during the edit.

#### TC-GATE-003 - Markdown validity + conciseness

**Scenario Type**: Corner Case
**Impact Level**: Important
**Priority**: Medium
**Related IDs**: NFR-1, NFR-3
**Test Type(s)**: Manual
**Automation Level**: Manual
**Target Layer / Location**: `.ai/rules/bulk-edit-verify.md`
**Tags**: @docs

**Preconditions**:
- Rule authored.

**Steps**:
1. Render review (manual): confirm all headings, lists, tables, and code fences render as valid standard Markdown (NFR-1 loadability).
2. Conciseness sanity (NFR-3): `wc -l .ai/rules/bulk-edit-verify.md` — density should be consistent with the existing concise rule files (e.g. `testing-strategy.md` ≈ 48 lines, `README.md` ≈ 39 lines). `bash.md` (≈980 lines) is an outlier, not the model. Flag if the new rule balloons well beyond single-topic density.

**Expected Outcome**:
- The rule is valid Markdown, single-topic, non-redundant, and token-cost-bounded for agent context (NFR-3).

#### TC-GATE-004 - No hand-added headers outside sanctioned paths

**Scenario Type**: Regression
**Impact Level**: Minor
**Priority**: Low
**Related IDs**: (process hygiene — AGENTS.md header policy)
**Test Type(s)**: Manual
**Automation Level**: Manual
**Target Layer / Location**: repo diff
**Tags**: @docs, @process

**Preconditions**:
- Delivery complete.

**Steps**:
1. `git diff`: assert no license-header lines are hand-added to non-sanctioned paths — in particular **not** to `doc/changes/**` (change artifacts are temporary working files; AGENTS.md: headers NOT required there). The only NEW header is on `.ai/rules/bulk-edit-verify.md` (sanctioned `.ai/rules/` path, applied by the script — TC-DIST-001). Edits to `.opencode/agent/{coder,pm}.md` retain their existing script-managed headers.
2. Confirm the header on the new rule came from `add-header-location.sh` (idempotent re-run — TC-DIST-001 step 2), not a hand edit.

**Expected Outcome**:
- Header hygiene intact; mirrors the GH-67 process discipline (agents never add headers by hand).

## 6. Environments and Test Data

**Environment:** any bash ≥ 4 on Linux/macOS (the guard and installer require bash ≥ 4 — `shopt globstar`; both scripts fail loudly on bash 3.2). CI: `ubuntu-latest` (matches the `doc-distribution-guard` + `verify-claude-build` jobs). No network required.

**Isolation strategy:** all executable gates are read-only against the repo checkout (the guard's sandbox install uses `mktemp -d` internally and cleans up via its EXIT/INT/TERM trap). Content checks are non-mutating `grep`/`test`. No fixtures are authored for this change — the new rule is a real in-scope doc verified by the existing guard.

**Test data / fixtures:** none new. The change adds one real path to three existing arrays and one real row to an existing table; the guard's existing self-tests (`get_marker()` 7 `.md` + 4 `.yaml` cases) already cover the `.md` frontmatter parser path the new rule exercises — no new parser test is needed.

## 7. Automation Plan and Implementation Mapping

| TC ID(s) | File | Action | Execution command | Mocking | Status |
|----------|------|--------|-------------------|---------|--------|
| TC-DIST-005 | `scripts/.tests/test-doc-distribution.sh` | **Existing – Update** (one new `STANDALONE_DOCS` entry) | `bash scripts/.tests/test-doc-distribution.sh` → exit 0 | none (read-only over checkout; internal sandbox) | To Implement (the list edit) |
| TC-DIST-006 | `scripts/.tests/test-doc-distribution-modes.sh` | **Existing – No Change** | `bash scripts/.tests/test-doc-distribution-modes.sh` → exit 0 | synthetic tree via `ADOS_GUARD_ROOT` | Existing – No Change |
| TC-DISC-004 | `scripts/build-claude-plugin.sh` → `.ados-claude/` | **Existing – Run** (regenerate after agent edits) | `bash scripts/build-claude-plugin.sh && git add -A .ados-claude/ && git diff --cached --exit-code .ados-claude/` | none | To Implement (regenerate + commit) |
| TC-DIST-003 | `scripts/install.sh` | **Existing – Update** (one new `ADOS_UPDATABLE_FILES` entry) | `grep -Ec '"\.ai/rules/bulk-edit-verify\.md"' scripts/install.sh` → == 1 | none | To Implement (the list edit) |
| TC-DIST-007 | `scripts/uninstall.sh` | **Existing – Update** (one new `ADOS_LOCAL_STANDALONE_DOCS` entry) | `grep -Ec '"\.ai/rules/bulk-edit-verify\.md"' scripts/uninstall.sh` → == 1 + 3-way `diff` of quoted strings (install/guard/uninstall) | none | To Implement (the list edit) |
| TC-RULE-001…005 | `.ai/rules/bulk-edit-verify.md` | **New** (content) | deterministic `grep`/`test -f` (§5.2) | none | Manual Only (content checks) |
| TC-DISC-001/002/003 | `.opencode/agent/{coder,pm}.md`, `.ai/rules/README.md` | **Update** (load-refs + index row) | `grep -Fc 'bulk-edit-verify' …` | none | To Implement |
| TC-DISC-005 | `.opencode/agent/reviewer.md` | **No Change** | `grep -Fq '.ai/rules/' reviewer.md` | none | Existing – No Change |
| TC-DIST-001/002 | `.ai/rules/bulk-edit-verify.md` (header + marker) | **New** (via `add-header-location.sh` + frontmatter) | `grep` header/marker patterns (§5.2) | none | To Implement |
| TC-DIST-004 | `scripts/.tests/test-doc-distribution.sh` | (same edit as TC-DIST-005) | `grep -Ec …` + 3-way `diff` of quoted strings (install/guard/uninstall) | none | To Implement |
| TC-GATE-001 | repo tree | **No file** | `git diff --check` | none | Manual Only |
| TC-GATE-002 | installer + guard + README | (same edits) | `grep -Fq` anchor checks | none | Manual Only |
| TC-GATE-003/004 | rule + repo diff | **No file** | render review + `git diff` | none | Manual Only |

**New executable test files:** none. **Updated executable files:** `scripts/install.sh` (+1 list entry), `scripts/.tests/test-doc-distribution.sh` (+1 list entry), `scripts/uninstall.sh` (+1 list entry). **New content file:** `.ai/rules/bulk-edit-verify.md`. **Regenerated artifacts:** `.ados-claude/agents/{coder,pm}.md`. **Manual-only (no test file):** all `TC-RULE-*` / `TC-GATE-*` content + static checks — these align with the strategy's "docs → static/diff + content checks" mapping and the fallback rule (docs-only ⇒ manual verification + `git diff --check`).

## 8. Risks, Assumptions, and Open Questions

### 8.1 Risks

| ID | Testing risk | Impact | Probability | Mitigation |
|----|--------------|--------|-------------|------------|
| TR-1 | New `STANDALONE_DOCS` entry added before a valid `redistributable` marker exists ⇒ guard fails mode 1/2 (spec RSK-1) | H | M | TC-DIST-002 + TC-DIST-005 assert marker present + guard green; the marker, header, and both list entries ship in one change (spec §18). |
| TR-2 | The three list entries drift (different path string) ⇒ for the install↔guard pair guard mode 5 fires (spec RSK-2); for the install↔uninstall pair there is **no** automated backstop | M | M | TC-DIST-004 + TC-DIST-007 assert byte-identical quoted strings across all three; mode 5 is the install↔guard backstop (TC-DIST-005); the install↔uninstall pair relies on TC-DIST-007's grep+diff. |
| TR-3 | AC-F5-1/F5-2 verification is ambiguous ("directly or via README discovery") ⇒ a passing implementation fails the grep (false negative) | M | M | OQ-TP-1: recommend the direct named reference; document the fallback joint assertion. |
| TR-4 | `.ados-claude/` mirrors not regenerated ⇒ generated-plugin CI fails (spec RSK-4) | M | L | TC-DISC-004 reproduces the exact CI check locally before push. |
| TR-5 | The rule's semantic content is judged present by grep but is semantically weak (e.g. mentions "grep" without the containing-identifier technique) ⇒ AC-F3-1 mechanically green but substantively thin | M | M | TC-RULE-003 anchors on the specific technique (`containing`/`substring`/`longer identifier`) + both stages; NFR-3 conciseness review (TC-GATE-003) catches padding. |
| TR-6 | A future maintainer updates `install.sh`/`STANDALONE_DOCS` but forgets `uninstall.sh` `ADOS_LOCAL_STANDALONE_DOCS` ⇒ install/uninstall silently drift (no CI catches it) | M | M | TC-DIST-007 + TC-DIST-004 encode the 3-way byte-identity check as a recurring quality-gate step; uninstall.sh's "MUST stay in sync" comment (L101-102) is the documented invariant. Residual: no hard CI gate today (see OQ-TP-3). |

### 8.2 Assumptions

- The new rule uses the `.md` frontmatter marker path (mirrors `.ai/rules/README.md`), not the `.yaml` top-level-key path. The guard's existing `get_marker()` `.md` self-tests already cover this parser branch.
- `add-header-location.sh` produces the canonical 3-line header + `source:` line (verified against `.ai/rules/README.md`); the new rule's header must byte-match it.
- The `verify-claude-build` CI job is the authoritative freshness oracle; reproducing it locally (`build` → stage → `git diff --cached --exit-code`) is equivalent.
- Baseline counts (pre-change): `ADOS_UPDATABLE_FILES` = 4; `STANDALONE_DOCS` = 5; `ADOS_LOCAL_STANDALONE_DOCS` = 5; README index data rows = 3; `coder.md`/`pm.md` `bulk-edit-verify` references = 0 (all confirmed at plan authoring).

### 8.3 Open Questions

| ID | Question | Blocking? | Owner | Notes |
|----|----------|-----------|-------|-------|
| OQ-TP-1 | Should the `@coder`/`@pm` load-reference name `bulk-edit-verify` directly, or rely purely on the README-discovery protocol (AC-F5-1/2 "directly **or** via …")? | No (test-design) | `@plan-writer` / `@coder` | **Recommendation: direct named reference.** It is unambiguous, maximally effective (spec G-4), and keeps TC-DISC-001/002 mechanically verifiable. If the pure-discovery form is chosen, relax those TCs to: (a) a generic `.ai/rules/README.md` load-reference in the agent file **plus** (b) the README row (TC-DISC-003). Surfaced for the DoR gate. |
| OQ-TP-2 | Hard line-count bound for NFR-3 (conciseness)? | No | `@coder` | No fixed threshold given; TC-GATE-003 uses the concise existing rules as the density model and flags ballooning. Human/reviewer judgment applies. |
| OQ-TP-3 | Should the drift guard gain a mode that observes `uninstall.sh` `ADOS_LOCAL_STANDALONE_DOCS` (an install/uninstall symmetry test)? | No (out of scope for GH-112) | `@pm` (follow-up) | Today the guard observes only install↔guard (mode 5); the install↔uninstall pair is covered only by TC-DIST-007's grep+diff (TR-6 residual). A dedicated symmetry mode would close the gap mechanically. Advisory; not a blocker for this change — re-surface if uninstall drift recurs. |

## 9. Plan Revision Log

| Version | Date | Author | Changes |
|---------|------|--------|---------|
| 1.0 | 2026-07-03T03:15:00Z | @test-plan-writer | Initial test plan for GH-112. 20 TCs; full AC (14/14) + DM (3/3) + NFR (5/5) traceability. Layered per `.ai/rules/testing-strategy.md`: automated shell gates (drift guard + generated-plugin build) + deterministic `grep` content checks + static `git diff --check`. Primary automated gate = `bash scripts/.tests/test-doc-distribution.sh` (must exit 0). OQ-TP-1 flags the AC-F5-1/2 direct-vs-discovery verification nuance. |
| 1.1 | 2026-07-03T03:45:00Z | @test-plan-writer | DoR-iter-1 amendment. The spec now defines a THIRD distribution list — `scripts/uninstall.sh` `ADOS_LOCAL_STANDALONE_DOCS` (DM-4) — so the new rule must land there too. Added **TC-DIST-007** (AC-F6-6 / DM-4): uninstall entry `grep -Ec == 1` + 3-way byte-identity assertion across install/guard/uninstall. Broadened NFR-4 from list-pair → list-triple sync (TC-DIST-004 + TC-DIST-007 own the 3-way `diff`). Added DM-4 row; AC-F6-6 row; updated traceability (15/15 ACs, 4/4 DMs). Cleaned the stale "implementation plan not yet authored" note (Finding 3) now that `./chg-GH-112-plan.md` exists. Noted the install↔uninstall pair has **no** automated backstop (guard observes install↔guard only) — AC-F6-6 verified by grep+diff with uninstall.sh's "MUST stay in sync" comment as the documented invariant (new TR-6 + OQ-TP-3). |
| 1.2 | 2026-07-03T04:15:00Z | @test-plan-writer | DoR-iter-3 path-typo fix (singular→plural). The generated-mirror directory is `.ados-claude/agents/` (plural), not `.ados-claude/agent/` (singular — the singular dir does not exist on disk; the `.opencode/agent/` singular dir is the OpenCode *source*, which is correctly left singular). Corrected all 6 occurrences of the singular form: 2 are **executable greps** in **TC-DISC-004** step 4 (`grep -Fq 'bulk-edit-verify' .ados-claude/agents/{coder,pm}.md`) that would FALSE-FAIL against a correctly delivered change (grep on a nonexistent path returns non-zero), plus 4 prose occurrences (§1.1 scope, AC-F5-4 / NFR-5 coverage rows, §7 regenerated-artifacts note). No scenario logic, TC-IDs, or coverage claims changed; only path spelling made distribution-truthful. |

## 10. Test Execution Log

| TC ID | Run Date | Result | Notes |
|-------|----------|--------|-------|
| _not yet executed — populate during delivery (phase 6) and quality gates (phase 9)_ | | | |

---

## PASS Criterion (summary)

The change PASSES when **all** of the following hold:

1. **All 15 ACs verified** — every AC → its TC(s) green (§3.1 traceability, no TODO/blank cells).
2. **Drift guard green** — `bash scripts/.tests/test-doc-distribution.sh` exits 0 (AC-F6-5 / NFR-2).
3. **Negative-mode guard green** — `bash scripts/.tests/test-doc-distribution-modes.sh` exits 0 (regression).
4. **No `git diff --check` issues** — whitespace/conflict clean (TC-GATE-001).
5. **Generated plugin fresh** — `bash scripts/build-claude-plugin.sh && git add -A .ados-claude/ && git diff --cached --exit-code .ados-claude/` exits 0 (AC-F5-4 / NFR-5).
6. **Uninstall list entry present + 3-way byte-identical** — `scripts/uninstall.sh` `ADOS_LOCAL_STANDALONE_DOCS` contains exactly one entry for `.ai/rules/bulk-edit-verify.md` (AC-F6-6 / DM-4), and the quoted strings in `install.sh` `ADOS_UPDATABLE_FILES`, the guard `STANDALONE_DOCS`, AND `uninstall.sh` `ADOS_LOCAL_STANDALONE_DOCS` are byte-identical (3-way `diff` clean / `grep -c == 3` across the three files) (NFR-4 / TC-DIST-004 + TC-DIST-007).

> **Unguarded pair note (AC-F6-6 verification method).** The drift guard observes **only** the install↔guard pair (mode 5). The **install↔uninstall** pair is **NOT** observed by any automated test today — there is no install/uninstall symmetry test in CI. Consequently AC-F6-6 (and the install↔uninstall half of NFR-4) is verified by the grep+diff inspection in TC-DIST-007, with `scripts/uninstall.sh`'s "This list MUST stay in sync with install.sh's standalone manifest" comment (L101-102) as the documented invariant. If such a guard mode were added later (OQ-TP-3), AC-F6-6 would fold into it; until then it is a semi-automated content check run during quality gates.
