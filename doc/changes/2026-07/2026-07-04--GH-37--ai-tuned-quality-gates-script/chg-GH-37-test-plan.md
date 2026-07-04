---
id: chg-GH-37-test-plan
status: Proposed
created: 2026-07-04T01:34:23Z
last_updated: 2026-07-04T01:34:23Z
owners: ["Juliusz Ćwiąkalski"]
service: delivery-os
labels: ["quality-gates", "scripts", "docs", "runner", "phase-9"]
version_impact: minor
summary: "AI-tuned quality-gates runner script + operator guide (GH-37) — verification plan for scripts/quality-gates.sh orchestrator contract (resolution, per-gate reporting, exit codes, AI-actionable output, arg handling, determinism/perf/stdlib), its auto-discovered bash test suite, the redistributable guide, the AGENTS.md resolution wiring, and the no-regression invariants."
links:
  change_spec: ./chg-GH-37-spec.md
  implementation_plan: ./chg-GH-37-plan.md
  testing_strategy: .ai/rules/testing-strategy.md
---

# Test Plan - AI-tuned quality-gates runner script + operator guide (close the /check dangling dependency)

## 1. Scope and Objectives

This is a **bash script + docs change**. The core deliverable under test is a new orchestrator, `scripts/quality-gates.sh`, plus its bash contract suite `scripts/.tests/test-quality-gates.sh`, a redistributable operator guide, an `AGENTS.md` resolution declaration, and a surgical reconciliation of the feature spec. Verification therefore mixes **behavioral shell tests** (the runner's contract — exit codes, per-gate reporting, arg handling, determinism, performance, stdlib-only), **content/hygiene checks** (the guide, the AGENTS.md declaration, the spec reconciliation, the header convention), and **regression invariants** (GH-67 drift guard, plugin freshness, shellcheck).

Core behaviors to protect:

- **The runner contract (F-1..F-4):** `scripts/quality-gates.sh` exists and is executable; on a clean tree with no args it runs the built-in default gate set, reports every gate as PASS with AI-actionable structured output (stable name / status / duration), and exits 0. On any gate failure it reports that gate as FAIL with a log pointer + short excerpt using stable machine-parseable prefixes, and exits non-zero. **There is no third exit-code state.** The default set **invokes** (does not reimplement) the repo's real gates: `scripts/test-all.sh`, the GH-67 doc-distribution drift guard, the plugin-freshness check (`build-claude-plugin.sh` idempotency), and `git diff --check`.
- **The regression guard (AC-F1-4, RSK-4) — the most important case:** a deliberately failing gate injected via a hermetic test fixture must be reported as failed (with log pointer + excerpt) **and** must drive a non-zero overall exit. The runner must never mask a gate failure into a false-green.
- **Discovery, extensibility, and args (F-3, F-4):** the gate set is resolved from the `AGENTS.md` declaration (preferred) else a documented built-in default; projects add/override gates via the extension point without editing the script's core. Args follow the honest contract resolved in OQ-1: `all` (default) + named-gate selection now; `fast`/`slow` documented as future; unknown selectors tolerated (warned/ignored), never a hard crash that masks failures.
- **AI-actionable output (F-2, OQ-2):** each gate entry carries stable fields; failures carry a log pointer to the canonical output dir `tmp/quality-gates/<YYYY-MM-DD>/` (mirrored by `@runner` under `tmp/run-logs-runner/<YYYY-MM-DD>/` as for any command) and a bounded excerpt with stable prefixes/tags.
- **Test suite + guide + wiring + reconciliation (F-5..F-8):** the contract suite exists, follows the `test-*.sh` convention, is auto-discovered by `scripts/test-all.sh` and CI `bash-tests`; the guide declares `ados_distribution: redistributable`; `AGENTS.md` carries the minimal honest declaration; the feature spec is reconciled surgically.
- **No regression:** the GH-67 drift guard, the plugin-freshness invariant, and shellcheck (`error` severity) stay green. `.ados-claude/` is regenerated **iff** a `.opencode/` source changed.

### 1.1 In Scope

- Behavioral shell tests of `scripts/quality-gates.sh` (exit codes, per-gate reporting, default-set invocation, arg handling, determinism, performance, stdlib-only), run via the embedded test framework in `.ai/rules/bash.md` §11.
- The regression-guard negative case (injected failing gate → reported + non-zero exit), hermetic via a temp fixture + the extension-point/env seam.
- Content/hygiene checks on `doc/guides/quality-gates.md`, `AGENTS.md`, `doc/spec/features/feature-quality-gates-and-pr.md`, and the `scripts/*.sh` header convention (OQ-3).
- Regression invariants: `bash scripts/.tests/test-doc-distribution.sh`, plugin freshness (`scripts/build-claude-plugin.sh` idempotency + `git diff` on `.ados-claude/`), `shellcheck` (`error` severity), `git diff --check`, and all existing `test-*.sh` suites.

### 1.2 Out of Scope & Known Gaps

- The deferred policies — hard-NFR enforcement and config-vs-code early gate (NG-2) — are **not** asserted here; they belong to the proposed companion ticket.
- The `ados check` CLI (epic #49) and the test-execution evidence gate (#93) — separate tickets; not tested.
- A full `fast`/`slow` partition — by DEC-4 / OQ-1 only `all` + named-gate is implemented; `fast`/`slow` are documented as future and not behaviorally implemented.
- Rewriting `/check`/`/check-fix` command definitions beyond making resolution succeed (NG-5) — the commands' delegation is unchanged.
- The text-to-image e2e/performance tool suites (`tools/.tests/test-text-to-image-e2e-*.sh`, `test-text-to-image-performance.sh`) are pre-existing external-failure suites excluded from CI `bash-tests`; they are not part of this change's regression surface and are documented as SKIP where encountered.
- `shellcheck` may not be installed locally; it is asserted as an "if present" local check with CI authoritative (see TC-QGATES-018).

## 2. References

- Change spec: [./chg-GH-37-spec.md](./chg-GH-37-spec.md) — 24 ACs: AC-F1-1..4, AC-F2-1..2, AC-F3-1..2, AC-F4-1..3, AC-F5-1..2, AC-F6-1..2, AC-F7-1..2, AC-F8-1..4, AC-NFR1-1, AC-NFR2-1, AC-NFR4-1.
- Implementation plan: [./chg-GH-37-plan.md](./chg-GH-37-plan.md) (pending at authoring time).
- Testing strategy: [.ai/rules/testing-strategy.md](../../../.ai/rules/testing-strategy.md).
- Bash conventions (runner + test suite must conform): [.ai/rules/bash.md](../../../.ai/rules/bash.md) — esp. §1 (strict mode/traps), §5 (LOG_TAG), §10 (testability: env injection, mockable wrappers, testable main guard, exit-code contract), §11 (embedded test framework), §16 (reference skeleton).
- Authoritative sources referenced by checks: `AGENTS.md`, `.opencode/command/check.md` (§`<resolution>`), `scripts/test-all.sh`, `scripts/.tests/test-doc-distribution.sh`, `scripts/build-claude-plugin.sh`, `scripts/add-header-location.sh` (`DEFAULT_PATHS`), `doc/spec/features/feature-quality-gates-and-pr.md` (the spec being made real), `.github/workflows/ci.yml` (`bash-tests`, `shellcheck` jobs).
- PM-resolved decisions baked into expectations: **OQ-1** (arg contract = `all` default + named-gate now; `fast`/`slow` future; unknown selectors tolerated); **OQ-2** (canonical output dir `tmp/quality-gates/<YYYY-MM-DD>/`); **OQ-3** (`scripts/quality-gates.sh` uses a descriptive comment header, **no** hand-added license block).

## 3. Coverage Overview

### 3.1 Functional Coverage (F-#, AC-#) — Traceability Matrix

| AC ID | Criterion (short) | TC ID(s) | How verified | Status |
|-------|-------------------|----------|--------------|--------|
| **AC-F1-1** | `scripts/quality-gates.sh` exists + is executable | TC-QGATES-001 | `test -x` + bash.md-conformance (descriptive header, no license block) | Pending |
| **AC-F1-2** | Clean tree, no args → exit 0, all gates PASS, AI-actionable structured output | TC-QGATES-002 | behavioral: run runner on clean tree, assert exit 0 + per-gate PASS summary | Pending |
| **AC-F1-3** | Built-in default set **invokes** (not reimplements) ≥ test-all, doc-distribution guard, plugin-freshness, `git diff --check` | TC-QGATES-003 | static: default-set registry references the 4 real gate identifiers; behavioral: a single named real gate is observed to be invoked | Pending |
| **AC-F1-4** | Deliberately failing gate (fixture) → reported as FAIL (log pointer + excerpt) **and** non-zero exit | TC-QGATES-004 | regression-guard: inject failing gate via hermetic fixture, assert non-zero exit + FAIL report | Pending |
| **AC-F2-1** | Each gate entry has stable name, pass/fail status, duration | TC-QGATES-002 | assert summary lines match the stable per-gate field shape | Pending |
| **AC-F2-2** | Failing gate → log pointer + short excerpt with stable machine-parseable prefixes/tags | TC-QGATES-004 | assert failure line carries log pointer + bounded excerpt + stable prefix/tag | Pending |
| **AC-F3-1** | `AGENTS.md` declaration honored (preferred); else documented built-in default | TC-QGATES-007 | behavioral: AGENTS.md-seeded set vs fallback default both resolve correctly | Pending |
| **AC-F3-2** | Project gate added via extension point takes effect without editing the script core | TC-QGATES-008 | behavioral: inject project gate via extension seam, assert it runs per documented precedence | Pending |
| **AC-F4-1** | No args → runs all (default = `all`) | TC-QGATES-002 | asserted as part of the clean-run case | Pending |
| **AC-F4-2** | Named gates → run only those; unknown selectors tolerated (no hard crash masking failures) | TC-QGATES-005 | behavioral: named-gate subset run + unknown-selector tolerance | Pending |
| **AC-F4-3** | `--help`/usage documents `[fast|slow|all|<gate>...]` taxonomy (implemented vs future) | TC-QGATES-006 | behavioral: `--help` output content assertions | Pending |
| **AC-F5-1** | `test-quality-gates.sh` exists, executable, follows `test-*.sh` convention, proves the contract (incl. regression-guard negative case) | TC-QGATES-009 | existence + convention + the suite itself passing | Pending |
| **AC-F5-2** | Suite auto-discovered by `test-all.sh` + CI `bash-tests` (no manual wiring) | TC-QGATES-010 | `scripts/test-all.sh` picks it up; CI `find … -exec` path matches | Pending |
| **AC-F6-1** | `doc/guides/quality-gates.md` exists + declares `ados_distribution: redistributable` | TC-QGATES-011 | existence + frontmatter marker grep | Pending |
| **AC-F6-2** | Guide documents running (direct + `/check`), declaring in `AGENTS.md`, adding a project gate, AI-tuned output contract, exit codes, log locations | TC-QGATES-012 | content grep across the 6 required topics | Pending |
| **AC-F7-1** | `/check` → `@runner` → `scripts/quality-gates.sh` end-to-end on clean tree → resolves, runs, logs under `tmp/run-logs-runner/`, returns structured summary | TC-QGATES-013 | end-to-end resolution-path trace + log-location + summary assertions | Pending |
| **AC-F7-2** | `AGENTS.md` carries minimal honest declaration (no invented gates) | TC-QGATES-014 | content grep: declaration present + names only real gates | Pending |
| **AC-F8-1** | `feature-quality-gates-and-pr.md` reconciled surgically (component table, NFR-1, Testing Approach; no unrelated edits) | TC-QGATES-015 | content grep + scoped diff review | Pending |
| **AC-F8-2** | GH-67 doc-distribution drift guard stays green (new guide carries marker) | TC-QGATES-016 | `bash scripts/.tests/test-doc-distribution.sh` → exit 0 | Pending |
| **AC-F8-3** | `.ados-claude/` regenerated via `build-claude-plugin.sh` **iff** `.opencode/` changed, else untouched | TC-QGATES-017 | rebuild + `git diff --stat -- .ados-claude/` invariant | Pending |
| **AC-F8-4** | Plugin-freshness check + `shellcheck` (`error` severity) stay green | TC-QGATES-018 | plugin-freshness gate run + shellcheck (if present; CI authoritative) | Pending |
| **AC-NFR1-1** | Same repo state, run twice → same pass/fail verdict + gate ordering (deterministic) | TC-QGATES-019 | behavioral: two runs, diff summaries' verdict + gate order == identical | Pending |
| **AC-NFR2-1** | Orchestrator overhead (dispatch + reporting) < 2s wall-clock; completes within sum of gate durations (no gratuitous re-runs) | TC-QGATES-020 | behavioral: time a fast-fixture gate set; assert overhead < 2s | Pending |
| **AC-NFR4-1** | Orchestrator depends only on Bash 4.0+ stdlib; test suite needs no network | TC-QGATES-021 | static: no non-stdlib deps in the orchestrator's own code path; suite runs offline | Pending |

**AC coverage total: 24 / 24** (AC-F1-1..4 = 4; AC-F2-1..2 = 2; AC-F3-1..2 = 2; AC-F4-1..3 = 3; AC-F5-1..2 = 2; AC-F6-1..2 = 2; AC-F7-1..2 = 2; AC-F8-1..4 = 4; AC-NFR1-1/2-1/4-1 = 3).

### 3.2 Interface Coverage (API-#, EVT-#, DM-#)

No HTTP (§8.1 N/A) or event (§8.2 N/A) surfaces. Data-model items are CLI/report-only:

| DM ID | Element | TC ID(s) | How verified |
|-------|---------|----------|--------------|
| DM-1 | Per-gate report record `{name, status, duration, [on fail] log pointer + excerpt}` | TC-QGATES-002 (fields on pass), TC-QGATES-004 (failure fields) | summary-line shape assertions |
| DM-2 | `AGENTS.md` gate declaration (machine-resolvable) | TC-QGATES-007, TC-QGATES-014 | resolution-honored behavior + declaration content |
| DM-3 | Exit-code contract (0 ⇔ all pass; non-zero ⇔ ≥1 fail; no third state) | TC-QGATES-002 (0), TC-QGATES-004 (non-zero), TC-QGATES-005 (no crash masking) | exit-code assertions |

### 3.3 Non-Functional Coverage (NFR-#)

| NFR ID | Requirement | TC ID(s) | How verified |
|--------|-------------|----------|--------------|
| NFR-1 | Determinism (same verdict + gate order across runs) | TC-QGATES-019 | two-run equivalence |
| NFR-2 | Performance (orchestrator overhead < 2s; no gratuitous re-runs) | TC-QGATES-020 | timed fast-fixture run |
| NFR-3 | Exit-code contract (exactly two outcomes) | TC-QGATES-002, TC-QGATES-004, TC-QGATES-005 | exit-code assertions across pass/fail/tolerant paths |
| NFR-4 | Dependencies — orchestrator stdlib-only; suite needs no network | TC-QGATES-021 | static dep audit + offline suite run |
| NFR-5 | AI-actionability — 4/4 fields per gate + stable prefixes | TC-QGATES-002, TC-QGATES-004 | field-shape + prefix assertions |
| NFR-6 | Bash conventions + shellcheck (`error`) cleanliness | TC-QGATES-001 (bash.md conformance), TC-QGATES-009 (suite convention), TC-QGATES-018 (shellcheck) | conformance + lint |
| NFR-7 | CI/test wiring with no manual registration | TC-QGATES-010 | auto-discovery by `test-all.sh` + CI path |
| NFR-8 | Guide distribution honesty (`redistributable`; guard green) | TC-QGATES-011, TC-QGATES-016 | marker + drift guard |

## 4. Test Types and Layers

Per `.ai/rules/testing-strategy.md`, this `scripts/**` + `doc/**` change maps to:

- **Behavioral shell tests (the runner contract, F-1..F-4, NFR-1/2/3/4/5):** `scripts/.tests/test-quality-gates.sh` using the embedded framework in `.ai/rules/bash.md` §11. The suite **sources** the runner (testable main guard, §10.4) for pure-logic unit cases and **invokes** the runner as a subprocess for behavior cases (exit code, stdout/stderr, log files). Hermetic isolation via `mktemp -d` + an EXIT trap; the extension-point/env seam (§10.1) lets tests inject fixture gate sets without touching the real repo tree. → TC-QGATES-001..008, TC-QGATES-019..021 (the suite's own cases), and TC-QGATES-009 (the suite's existence/convention).
- **Content/hygiene checks (docs + AGENTS.md + spec, F-6/F-7/F-8-1):** grep-able traceability against ACs; YAML frontmatter validity (`ados_distribution` marker); markdown render + link review; scoped diff review for the spec reconciliation; header-convention check (OQ-3). → TC-QGATES-011..015.
- **Static/diff checks (always):** `git diff --check`; changed-file path/naming review. → folded into TC-QGATES-018 / TC-QGATES-016.
- **Regression invariants (F-8-2..4):** existing shell suites (`test-doc-distribution.sh`, all `test-*.sh`), the plugin-freshness build invariant, and shellcheck (`error`). → TC-QGATES-016, TC-QGATES-017, TC-QGATES-018.

No unit/integration/E2E framework beyond bash applies. The runner has no HTTP/event surface. All automated checks are shell `bash`/`rg`/`test`/`git` invocations run from the repo root.

## 5. Test Scenarios

### 5.1 Scenario Index

| TC ID | Title | Type | Level | Priority | AC Coverage |
|-------|-------|------|-------|----------|-------------|
| TC-QGATES-001 | Runner exists, executable, bash.md-conformant (descriptive header, no license block) | Happy Path | Critical | High | AC-F1-1 |
| TC-QGATES-002 | Clean tree, no args → exit 0, all gates PASS, structured per-gate output (name/status/duration); default = `all` | Happy Path | Critical | High | AC-F1-2, AC-F2-1, AC-F4-1, DM-1, DM-3 |
| TC-QGATES-003 | Built-in default set invokes (not reimplements) the 4 real gates | Happy Path | Critical | High | AC-F1-3 |
| TC-QGATES-004 | Regression guard: injected failing gate → reported (log pointer + excerpt + stable prefixes) + non-zero exit | Negative | Critical | High | AC-F1-4, AC-F2-2, DM-1, DM-3 |
| TC-QGATES-005 | Named-gate selection runs only those; unknown selectors tolerated (no hard crash masking failures) | Corner Case | Critical | High | AC-F4-2, DM-3 |
| TC-QGATES-006 | `--help`/usage documents the `[fast|slow|all|<gate>...]` taxonomy (implemented vs future) | Happy Path | Important | Medium | AC-F4-3 |
| TC-QGATES-007 | `AGENTS.md` gate declaration honored (preferred); else documented built-in default | Happy Path | Critical | High | AC-F3-1, DM-2 |
| TC-QGATES-008 | Extension point: project gate takes effect without editing the script core | Corner Case | Important | Medium | AC-F3-2 |
| TC-QGATES-009 | Contract suite exists, executable, follows `test-*.sh` convention, proves the contract incl. regression-guard | Regression | Critical | High | AC-F5-1 |
| TC-QGATES-010 | Suite auto-discovered by `test-all.sh` + CI `bash-tests` (no manual wiring) | Regression | Critical | High | AC-F5-2 |
| TC-QGATES-011 | Operator guide exists + declares `ados_distribution: redistributable` | Happy Path | Critical | High | AC-F6-1, NFR-8 |
| TC-QGATES-012 | Guide documents running/declaring/extending/output/exit-codes/log-locations | Happy Path | Important | Medium | AC-F6-2 |
| TC-QGATES-013 | `/check` → `@runner` → `scripts/quality-gates.sh` end-to-end on clean tree (resolves, runs, logs, summary) | Happy Path | Critical | High | AC-F7-1, NFR-1 |
| TC-QGATES-014 | `AGENTS.md` carries minimal honest declaration (names real runner/gate set; no invented gates) | Happy Path | Critical | High | AC-F7-2, DM-2 |
| TC-QGATES-015 | `feature-quality-gates-and-pr.md` reconciled surgically (component table, NFR-1, Testing Approach) | Regression | Important | Medium | AC-F8-1 |
| TC-QGATES-016 | GH-67 doc-distribution drift guard stays green | Regression | Critical | High | AC-F8-2, NFR-8 |
| TC-QGATES-017 | `.ados-claude/` freshness invariant (regenerated iff `.opencode/` changed) | Regression | Critical | High | AC-F8-3 |
| TC-QGATES-018 | Plugin-freshness check + shellcheck (`error`) stay green | Regression | Critical | High | AC-F8-4, NFR-6 |
| TC-QGATES-019 | Determinism: run twice → same verdict + identical gate ordering | Edge Case | Critical | High | AC-NFR1-1, NFR-1 |
| TC-QGATES-020 | Performance: orchestrator overhead (dispatch + reporting) < 2s; no gratuitous re-runs | Performance | Important | Medium | AC-NFR2-1, NFR-2 |
| TC-QGATES-021 | Stdlib-only: orchestrator depends only on Bash 4.0+ stdlib; test suite needs no network | Edge Case | Critical | High | AC-NFR4-1, NFR-4 |

### 5.2 Scenario Details

#### TC-QGATES-001 - Runner exists, executable, bash.md-conformant (descriptive header, no license block)

**Scenario Type**: Happy Path
**Impact Level**: Critical
**Priority**: High
**Related IDs**: F-1, AC-F1-1, NFR-6, RSK-8, OQ-3, DEC-5
**Test Type(s)**: Unit (static)
**Automation Level**: Automated
**Target Layer / Location**: `scripts/quality-gates.sh` (file)
**Tags**: @backend, @scripts, @convention

**Preconditions**:

- Delivery created `scripts/quality-gates.sh`.
- Checks run from repo root; `bash` and `test` available.

**Steps**:

1. Assert the file exists and is executable:
   `test -f scripts/quality-gates.sh && test -x scripts/quality-gates.sh` → both true.
2. Assert the shebang and strict mode (bash.md §1):
   `head -1 scripts/quality-gates.sh` → `#!/usr/bin/env bash`;
   `rg -n 'set -Eeuo pipefail' scripts/quality-gates.sh` → ≥1 match.
3. Assert a testable main guard (bash.md §10.4):
   `rg -n 'BASH_SOURCE\[0\]'\''\s*==\s*'\''"\$\{0\}"' scripts/quality-gates.sh` → ≥1 match.
4. Assert a descriptive comment header (OQ-3 / bash.md §1, §14) — a purpose/usage block at the top of the file:
   `rg -n -i -e 'quality.gates' -e 'usage:' -e 'exit code' scripts/quality-gates.sh` → ≥1 match within the header comment block.
5. Assert **no** hand-added license/copyright block (AGENTS.md forbids it; `scripts/` is not an `add-header-location.sh` default path — RSK-8):
   `rg -n -e '^# Copyright \(c\)' -e 'MIT License - see LICENSE' scripts/quality-gates.sh` → 0 matches.
6. Assert a stable `LOG_TAG` (bash.md §5):
   `rg -n 'readonly LOG_TAG=' scripts/quality-gates.sh` → ≥1 match.

**Expected Outcome**:

- The runner exists and is executable; it conforms to `.ai/rules/bash.md` (shebang, strict mode, testable main guard, stable `LOG_TAG`) and uses a descriptive comment header with **no** hand-added license block (OQ-3 / DEC-5).

**Notes / Clarifications**:

- This case also closes RSK-8 (header-convention ambiguity). The same checks apply to `scripts/.tests/test-quality-gates.sh` (covered structurally by TC-QGATES-009's convention assertion).

---

#### TC-QGATES-002 - Clean tree, no args → exit 0, all gates PASS, structured per-gate output (name/status/duration); default = `all`

**Scenario Type**: Happy Path
**Impact Level**: Critical
**Priority**: High
**Related IDs**: F-1, F-2, F-4, AC-F1-2, AC-F2-1, AC-F4-1, DM-1, DM-3, NFR-3, NFR-5
**Test Type(s)**: Behavior (subprocess)
**Automation Level**: Automated
**Target Layer / Location**: `scripts/.tests/test-quality-gates.sh` → `scripts/quality-gates.sh` (invoked)
**Tags**: @backend, @scripts, @runner

**Preconditions**:

- The repo tree is clean (`git status --porcelain` empty; no uncommitted whitespace errors) so the real default gates pass.
- Test runs from repo root. (If the real default gates are too slow/heavy for a unit case, the suite may instead exercise the **extension seam** with a set of trivial PASS gates — but the canonical clean-tree run must still be verified at least once manually/in CI.)

**Steps**:

1. Invoke the runner with no args and capture stdout/stderr/exit:
   ```bash
   set +e; scripts/quality-gates.sh >"$OUT" 2>"$ERR"; rc=$?; set -e
   ```
2. Assert exit code == 0 (DM-3 / NFR-3): `assert_exit_code 0 "$rc"`.
3. Assert the summary reports an overall PASS:
   `rg -n -i -e 'PASS' -e 'all .*pass' "$OUT"` → ≥1 match.
4. Assert each gate entry carries the three stable fields (DM-1 / NFR-5) — stable name, status, duration — by matching the per-gate summary line shape emitted by the runner (the suite asserts the documented prefix/tag, e.g. a `(quality-gates)` tag plus a per-gate `name=… status=… duration=…` triple, or the equivalent stable machine-parseable form the author documents in the guide):
   for each expected default gate, `rg -n "<gate-name>.*status=PASS.*duration=" "$OUT"` → ≥1 match.
5. Assert no gate is reported as FAIL on a clean tree:
   `rg -n -i 'status=FAIL' "$OUT"` → 0 matches.
6. Assert default = `all` (AC-F4-1): with no args, **every** default gate appears in the summary (cross-check the default-set registry proven in TC-QGATES-003).

**Expected Outcome**:

- Exit 0; an AI-actionable summary on stdout where every default gate is reported PASS with stable name/status/duration fields; no FAIL entries; no args ⇒ the full default set ran (default = `all`).

**Notes / Clarifications**:

- The exact field syntax is the author's choice but MUST be stable and documented in the guide (TC-QGATES-012) and asserted identically here. The suite should pin the chosen syntax so future drift is caught.

---

#### TC-QGATES-003 - Built-in default set invokes (not reimplements) the 4 real gates

**Scenario Type**: Happy Path
**Impact Level**: Critical
**Priority**: High
**Related IDs**: F-1, F-3, AC-F1-3, NG-1, RSK-1, RSK-9
**Test Type(s)**: Unit (static) + Behavior
**Automation Level**: Automated
**Target Layer / Location**: `scripts/quality-gates.sh` (default-set registry) + a single named-gate run
**Tags**: @backend, @scripts, @gates

**Preconditions**:

- The runner defines its built-in default gate set (the registry consulted when `AGENTS.md` declares nothing).

**Steps**:

1. Assert the default-set registry references — i.e. **invokes**, not reimplements — the 4 real gates (NG-1 / RSK-1):
   - test aggregation: `rg -n 'test-all\.sh' scripts/quality-gates.sh` → ≥1 match;
   - doc-distribution guard: `rg -n 'test-doc-distribution\.sh' scripts/quality-gates.sh` → ≥1 match;
   - plugin freshness: `rg -n 'build-claude-plugin\.sh' scripts/quality-gates.sh` → ≥1 match;
   - whitespace hygiene: `rg -n 'git diff --check' scripts/quality-gates.sh` → ≥1 match.
2. Assert the runner does **not** reimplement test discovery (NG-1): `rg -n -e 'find .*\.tests' -e 'for t in.*test-\*' scripts/quality-gates.sh` → 0 matches in the orchestrator's own gate logic (the runner delegates to `test-all.sh`, which is the single source of truth).
3. Behavioral spot-check (RSK-9 — default set mirrors real CI gates): invoke the runner selecting a single fast named real gate (e.g. the `git diff --check` gate) and assert that gate is reported in the summary:
   ```bash
   set +e; scripts/quality-gates.sh "<whitespace-gate-name>" >"$OUT" 2>"$ERR"; rc=$?; set -e
   ```
   `rg -n "<whitespace-gate-name>.*status=" "$OUT"` → ≥1 match; `rc` == 0 on a clean tree.

**Expected Outcome**:

- The default registry names all four real gates; the runner delegates rather than rediscovering; a named real gate is observable in the run output.

**Notes / Clarifications**:

- RSK-9 (default-set vs CI drift) is mitigated here: the static check pins the 4 real gate identifiers. If the author renames a gate, the test and the guide (TC-QGATES-012) must move together.

---

#### TC-QGATES-004 - Regression guard: injected failing gate → reported (log pointer + excerpt + stable prefixes) + non-zero exit

**Scenario Type**: Negative
**Impact Level**: Critical
**Priority**: High
**Related IDs**: F-1, F-2, AC-F1-4, AC-F2-2, DM-1, DM-3, NFR-3, NFR-5, RSK-4, OQ-2
**Test Type(s)**: Behavior (subprocess, hermetic fixture)
**Automation Level**: Automated
**Target Layer / Location**: `scripts/.tests/test-quality-gates.sh` (regression-guard case)
**Tags**: @backend, @scripts, @regression, @hermetic

**Preconditions**:

- The runner exposes an extension/env seam (bash.md §10.1) that lets the suite inject a **fixture gate set** without editing the script's core or touching the real repo tree.
- A hermetic temp working area is created via `mktemp -d` and removed in the EXIT trap (no state leakage).

**Steps**:

1. Build a fixture: a temp gate script that prints a recognizable failure line and exits non-zero, e.g.
   ```bash
   printf '#!/usr/bin/env bash\necho "DELIBERATE_FAILURE_MARKER boom"\nexit 7\n' > "$TMPDIR/fail-gate.sh"; chmod +x "$TMPDIR/fail-gate.sh"
   ```
2. Inject the fixture gate set via the documented extension seam (env var or fixture file — same mechanism proven in TC-QGATES-008), pointing the runner at the temp gate set.
3. Run the runner against the fixture set and capture stdout/stderr/exit:
   ```bash
   set +e; <env-seam>="$TMPDIR/gateset" scripts/quality-gates.sh >"$OUT" 2>"$ERR"; rc=$?; set -e
   ```
4. Assert **non-zero exit** (DM-3 / NFR-3 / RSK-4 — failure never masked): `[[ $rc -ne 0 ]]`.
5. Assert the failing gate is **named** as FAIL with the stable prefix/tag (AC-F1-4 / AC-F2-2 / NFR-5):
   `rg -n -e 'FAIL' -e 'status=FAIL' "$OUT"` → ≥1 match naming the fixture gate.
6. Assert a **log pointer** to the canonical output dir (OQ-2) is emitted:
   `rg -n "tmp/quality-gates/[0-9]{4}-[0-9]{2}-[0-9]{2}/" "$OUT"` → ≥1 match.
7. Assert the **canonical log file actually exists** and contains the gate's output (OQ-2 — runner writes `tmp/quality-gates/<YYYY-MM-DD>/`):
   resolve the pointer from step 6 and `test -f` it; `rg -n 'DELIBERATE_FAILURE_MARKER' "<resolved-log>"` → ≥1 match.
8. Assert a **short failure excerpt** with a stable machine-parseable prefix is included in the summary (AC-F2-2 / NFR-5), and that it is **bounded** (not the entire log dumped):
   `rg -n 'DELIBERATE_FAILURE_MARKER' "$OUT"` → ≥1 match within a bounded excerpt block.
9. Assert the fixture's non-zero code surfaced (not translated to a generic "1") where the runner documents per-gate exit codes — optional strength check if the contract exposes it.
10. Assert no real-repo state was mutated: `git status --porcelain` unchanged after the run (hermetic).

**Expected Outcome**:

- The runner exits non-zero; the summary names the fixture gate as FAIL with a stable prefix/tag; a log pointer to `tmp/quality-gates/<YYYY-MM-DD>/` is emitted and the pointed-to log file exists and contains the gate's output; a bounded excerpt appears in the summary; the real repo tree is untouched.

**Notes / Clarifications**:

- This is the single most important case (AC-F1-4 / RSK-4): it is the proof the runner cannot produce a false-green. The fixture must be hermetic — never inject into the real default set or the committed `AGENTS.md`. The canonical-dir assertion (steps 6–7) bakes in OQ-2.

---

#### TC-QGATES-005 - Named-gate selection runs only those; unknown selectors tolerated (no hard crash masking failures)

**Scenario Type**: Corner Case
**Impact Level**: Critical
**Priority**: High
**Related IDs**: F-4, AC-F4-2, DM-3, NFR-3, OQ-1, RSK-2
**Test Type(s)**: Behavior (subprocess)
**Automation Level**: Automated
**Target Layer / Location**: `scripts/.tests/test-quality-gates.sh` (arg-handling cases)
**Tags**: @backend, @scripts, @args

**Preconditions**:

- The runner exposes the extension seam so the suite can use a fixture gate set of ≥2 named gates (e.g. `alpha`, `beta`) without touching the real default set.

**Steps**:

1. Inject a fixture gate set of two PASS gates (`alpha`, `beta`).
2. Select only `alpha`:
   ```bash
   set +e; <env-seam>="$TMPDIR/gateset" scripts/quality-gates.sh alpha >"$OUT" 2>"$ERR"; rc=$?; set -e
   ```
3. Assert exit 0 and that **only** `alpha` is reported (named-gate subset — AC-F4-2):
   `rg -n 'alpha' "$OUT"` → ≥1 match; `rg -n 'beta' "$OUT"` → 0 matches.
4. Tolerance case (OQ-1 / RSK-2): pass an **unknown** selector alongside a known one:
   ```bash
   set +e; <env-seam>="$TMPDIR/gateset" scripts/quality-gates.sh alpha not-a-real-gate >"$OUT" 2>"$ERR"; rc=$?; set -e
   ```
5. Assert the unknown selector does **not** cause a hard crash that masks a real result: `rc` is 0 (the known gate ran and passed), and a warning/notice about the unknown selector is emitted to stderr/stdout (documented semantics — warned/ignored, never fatal):
   `rg -n -i -e 'unknown' -e 'not found' -e 'ignor' "$OUT" "$ERR"` → ≥1 match referencing `not-a-real-gate`.
6. Critical sub-assertion (DM-3 / RSK-4): confirm tolerance never masks a **failure**. Re-run step 4 but with the fixture's `alpha` set to fail; assert `rc` is **non-zero** (the unknown selector did not turn a failure into a green):
   ```bash
   # (make alpha fail in the fixture, then re-run step 4's invocation)
   [[ $rc -ne 0 ]]
   ```

**Expected Outcome**:

- Named-gate selection runs exactly the named subset; unknown selectors are warned/ignored, never crash; tolerance never converts a real failure into exit 0.

**Notes / Clarifications**:

- Step 6 is the safety-critical half of AC-F4-2: tolerance must be **non-masking**. This pairs with TC-QGATES-004 to close RSK-2/RSK-4.

---

#### TC-QGATES-006 - `--help`/usage documents the `[fast|slow|all|<gate>...]` taxonomy (implemented vs future)

**Scenario Type**: Happy Path
**Impact Level**: Important
**Priority**: Medium
**Related IDs**: F-4, AC-F4-3, OQ-1, DEC-4
**Test Type(s)**: Behavior (subprocess)
**Automation Level**: Automated
**Target Layer / Location**: `scripts/.tests/test-quality-gates.sh` → `scripts/quality-gates.sh --help`
**Tags**: @backend, @scripts, @args

**Preconditions**:

- The runner supports `-h|--help` (bash.md §4).

**Steps**:

1. Invoke help and capture output:
   ```bash
   set +e; scripts/quality-gates.sh --help >"$OUT" 2>"$ERR"; rc=$?; set -e
   ```
2. Assert `--help` exits 0 (bash.md §4): `assert_exit_code 0 "$rc"`.
3. Assert the taxonomy is documented (AC-F4-3) — the implemented selectors `all` and named-gate, plus the args the `/check` command forwards:
   `rg -n -i -e '\ball\b' -e 'named' -e '<gate>' "$OUT"` → ≥1 match.
4. Assert the `fast`/`slow` partition is documented **honestly as future** (OQ-1 / DEC-4 — not silently implemented):
   `rg -n -i -e 'fast' -e 'slow' "$OUT"` → ≥1 match, **and** nearby language marks them future/deferred (e.g. `rg -n -i -e 'future' -e 'deferred' -e 'not yet' -e 'planned' "$OUT"` ≥1 match in the same help block).
5. Assert exit-code semantics are documented (bash.md §14 / DM-3): `rg -n -i -e 'exit' -e '0 .* pass' -e 'non-zero' "$OUT"` → ≥1 match.

**Expected Outcome**:

- `--help` exits 0 and documents: `all` (default) + named-gate selection as implemented; `fast`/`slow` as future; the exit-code contract.

---

#### TC-QGATES-007 - `AGENTS.md` gate declaration honored (preferred); else documented built-in default

**Scenario Type**: Happy Path
**Impact Level**: Critical
**Priority**: High
**Related IDs**: F-3, AC-F3-1, DM-2, DEC-3
**Test Type(s)**: Behavior (subprocess, fixture)
**Automation Level**: Automated
**Target Layer / Location**: `scripts/.tests/test-quality-gates.sh` (resolution cases)
**Tags**: @backend, @scripts, @discovery

**Preconditions**:

- The runner's resolution mirrors `/check` §`<resolution>` step 1: read `AGENTS.md` for an explicit declaration; else fall back to the built-in default set.
- The suite can point the resolver at a fixture `AGENTS.md` (or fixture declaration) via the env seam.

**Steps**:

1. **Preferred path:** seed a fixture `AGENTS.md`-style declaration naming a fixture gate `declared-gate`; point the resolver at it via the seam; run the runner with no args.
   - Assert `declared-gate` is run and reported: `rg -n 'declared-gate' "$OUT"` → ≥1 match.
2. **Fallback path:** with the resolver pointed at a fixture that declares **nothing**, run the runner with no args.
   - Assert the built-in default set is used instead: the real default gates (per TC-QGATES-003's registry) appear — or, in a hermetic variant, a fixture-stubbed default set is used and reported.
3. Assert precedence is unambiguous: when a declaration exists, the fallback default is **not** also layered on top unless the documented precedence says so (manual confirmation of the documented rule).

**Expected Outcome**:

- The declaration in `AGENTS.md` (DM-2) is honored when present; otherwise the documented built-in default set is used. Precedence matches the documented rule.

**Notes / Clarifications**:

- This case is resolution-logic-focused; the real `AGENTS.md` declaration content is proven in TC-QGATES-014. Together they close RSK-3 (dangling-dependency reintroduced via declaration/script disagreement).

---

#### TC-QGATES-008 - Extension point: project gate takes effect without editing the script core

**Scenario Type**: Corner Case
**Impact Level**: Important
**Priority**: Medium
**Related IDs**: F-3, AC-F3-2
**Test Type(s)**: Behavior (subprocess, fixture)
**Automation Level**: Automated
**Target Layer / Location**: `scripts/.tests/test-quality-gates.sh` (extension case)
**Tags**: @backend, @scripts, @extensibility

**Preconditions**:

- The runner exposes a documented extension point (the same seam used by TC-QGATES-004/005) for adding/overriding a gate without editing core logic.

**Steps**:

1. Add a project gate `project-only-gate` via the extension point **only** (no edit to `scripts/quality-gates.sh`).
2. Run the runner with no args (or selecting the project gate).
3. Assert the project gate runs and is reported per documented precedence:
   `rg -n 'project-only-gate' "$OUT"` → ≥1 match.
4. Assert the script's source is **unchanged** by the addition (the extension is declarative/external): `git diff --stat -- scripts/quality-gates.sh` → empty (the gate was added via config/declaration, not a code edit).
5. Assert an **override** takes effect per documented precedence: if the project gate overrides a built-in name, the project version is the one that runs (manual/behavioral confirmation of the documented precedence rule).

**Expected Outcome**:

- A project gate added via the extension point runs without editing the script's core, honoring documented precedence.

---

#### TC-QGATES-009 - Contract suite exists, executable, follows `test-*.sh` convention, proves the contract incl. regression-guard

**Scenario Type**: Regression
**Impact Level**: Critical
**Priority**: High
**Related IDs**: F-5, AC-F5-1, NFR-6
**Test Type(s)**: Integration (shell suite)
**Automation Level**: Automated
**Target Layer / Location**: `scripts/.tests/test-quality-gates.sh`
**Tags**: @backend, @scripts, @ci

**Preconditions**:

- Delivery created `scripts/.tests/test-quality-gates.sh`.

**Steps**:

1. Assert the suite exists and is executable, following the `test-*.sh` naming/placement convention (bash.md §3):
   `test -f scripts/.tests/test-quality-gates.sh && test -x scripts/.tests/test-quality-gates.sh` → both true.
2. Assert it conforms to bash.md §1 (strict mode + traps) and §11 (embedded framework / clear pass-fail summary):
   `rg -n 'set -Eeuo pipefail' scripts/.tests/test-quality-gates.sh` → ≥1 match.
3. Run the suite and assert it passes:
   ```bash
   bash scripts/.tests/test-quality-gates.sh
   ```
   → exit 0; the suite prints a PASS summary.
4. Assert the suite **proves the contract** (AC-F5-1) by naming the cases it contains — resolution, per-gate reporting, exit codes, AI-actionable output, arg handling, **and** the regression-guard negative case (the TC-QGATES-004 behavior):
   `rg -n -i -e 'fail' -e 'exit' -e 'report' -e 'arg' -e 'output' scripts/.tests/test-quality-gates.sh` → ≥1 match per concept area (manual confirmation the suite actually exercises each, not merely mentions them).

**Expected Outcome**:

- The suite exists, is executable, follows the convention, conforms to bash.md, passes, and demonstrably covers resolution/reporting/exit/output/args + the regression-guard negative case.

---

#### TC-QGATES-010 - Suite auto-discovered by `test-all.sh` + CI `bash-tests` (no manual wiring)

**Scenario Type**: Regression
**Impact Level**: Critical
**Priority**: High
**Related IDs**: F-5, AC-F5-2, NFR-7
**Test Type(s)**: Integration (aggregator)
**Automation Level**: Automated
**Target Layer / Location**: `scripts/test-all.sh` + `.github/workflows/ci.yml` (`bash-tests`)
**Tags**: @backend, @scripts, @ci

**Preconditions**:

- TC-QGATES-009 holds (the suite exists, executable, passing).

**Steps**:

1. Assert `scripts/test-all.sh` discovers the new suite with no manual wiring — it uses `find … -path '*/.tests/*' -name 'test-*.sh' -perm -u+x` (bash.md §12.1):
   ```bash
   find scripts -type f -path '*/.tests/*' -name 'test-*.sh' -perm -u+x | grep 'test-quality-gates.sh'
   ```
   → ≥1 match (the aggregator's own discovery glob finds it).
2. Run the aggregator and confirm the new suite is listed and executed:
   ```bash
   bash scripts/test-all.sh 2>&1 | rg -n 'test-quality-gates'
   ```
   → ≥1 match (the `[INFO] (test-all) running …/test-quality-gates.sh` line), and the aggregator exits 0.
3. Assert the CI `bash-tests` discovery rule covers it (no manual CI edit) — `.github/workflows/ci.yml` runs `find . -path '*/.tests/test-*.sh' -not -path './tmp/*' -not -name '*e2e-providers*' -not -name '*e2e-suite*' -not -name '*performance*' -print -exec bash {} \;`:
   confirm the new suite is **not** excluded by any of those filters (it is under `scripts/.tests/`, not `./tmp/`, and its name matches none of the text-to-image exclusions) — manual confirmation against the workflow.

**Expected Outcome**:

- The new suite is auto-discovered by `scripts/test-all.sh` and by the CI `bash-tests` `find … -exec` rule with zero manual wiring (NFR-7).

---

#### TC-QGATES-011 - Operator guide exists + declares `ados_distribution: redistributable`

**Scenario Type**: Happy Path
**Impact Level**: Critical
**Priority**: High
**Related IDs**: F-6, AC-F6-1, NFR-8, RSK-5
**Test Type(s)**: Manual (content)
**Automation Level**: Automated
**Target Layer / Location**: `doc/guides/quality-gates.md`
**Tags**: @docs, @guide, @marker

**Preconditions**:

- Delivery created `doc/guides/quality-gates.md`.

**Steps**:

1. Assert the guide exists: `test -f doc/guides/quality-gates.md` → true.
2. Assert the frontmatter declares the marker (NFR-8 / DEC-5 — the guide is generic/reusable, so `redistributable` is honest):
   `rg -n '^ados_distribution: redistributable' doc/guides/quality-gates.md` → exactly 1 match, inside the single frontmatter block.
3. Assert no second `---` block was introduced (the GH-67 two-path parser reads only the first `.md` frontmatter block):
   manual spot-check that the marker sits within the opening `---`…`---` block.

**Expected Outcome**:

- The guide exists and carries `ados_distribution: redistributable` in its frontmatter (RSK-5 mitigation — the drift guard will therefore stay green; proven in TC-QGATES-016).

---

#### TC-QGATES-012 - Guide documents running/declaring/extending/output/exit-codes/log-locations

**Scenario Type**: Happy Path
**Impact Level**: Important
**Priority**: Medium
**Related IDs**: F-6, AC-F6-2, OQ-2
**Test Type(s)**: Manual (content)
**Automation Level**: Semi-automated
**Target Layer / Location**: `doc/guides/quality-gates.md`
**Tags**: @docs, @guide

**Preconditions**:

- TC-QGATES-011 holds (the guide exists).

**Steps**:

1. Assert **how to run gates** — directly and via `/check`:
   `rg -n -i -e '/check' -e 'quality-gates\.sh' doc/guides/quality-gates.md` → ≥1 match covering both invocation paths.
2. Assert **declaring the gate set / runner in `AGENTS.md`**:
   `rg -n -i -e 'AGENTS\.md' -e 'declare' doc/guides/quality-gates.md` → ≥1 match.
3. Assert **adding a project-specific gate** via the extension point:
   `rg -n -i -e 'extension' -e 'project.*gate' -e 'add.*gate' doc/guides/quality-gates.md` → ≥1 match.
4. Assert the **AI-tuned output contract** (fields + prefixes):
   `rg -n -i -e 'name' -e 'status' -e 'duration' -e 'excerpt' -e 'log pointer' doc/guides/quality-gates.md` → ≥1 match per field area.
5. Assert **exit-code semantics** (DM-3):
   `rg -n -i -e 'exit code' -e 'exit 0' -e 'non-zero' doc/guides/quality-gates.md` → ≥1 match.
6. Assert **log locations**, including the canonical dir (OQ-2) and the `@runner` mirror convention:
   `rg -n -i -e 'tmp/quality-gates' -e 'tmp/run-logs-runner' doc/guides/quality-gates.md` → ≥1 match (ideally both).
7. Assert the guide **cross-links** (does not duplicate) `feature-quality-gates-and-pr.md`, `.ai/rules/bash.md`, and the change-lifecycle guide:
   `rg -n -e 'feature-quality-gates-and-pr' -e 'bash\.md' -e 'change-lifecycle' doc/guides/quality-gates.md` → ≥1 match each.

**Expected Outcome**:

- The guide documents running (direct + `/check`), declaring in `AGENTS.md`, adding a project gate, the AI-tuned output contract, exit codes, and log locations (incl. `tmp/quality-gates/<date>/` + `@runner` mirror), and cross-links the canonical sources.

---

#### TC-QGATES-013 - `/check` → `@runner` → `scripts/quality-gates.sh` end-to-end on clean tree (resolves, runs, logs, summary)

**Scenario Type**: Happy Path
**Impact Level**: Critical
**Priority**: High
**Related IDs**: F-7, AC-F7-1, NFR-1, DM-2, RSK-3
**Test Type(s)**: Integration (resolution path) / Manual
**Automation Level**: Semi-automated
**Target Layer / Location**: `.opencode/command/check.md` §`<resolution>` → `@runner` → `scripts/quality-gates.sh`
**Tags**: @process, @runner, @resolution

**Preconditions**:

- Delivery complete: `AGENTS.md` declares the runner/gate set (TC-QGATES-014) and `scripts/quality-gates.sh` exists (TC-QGATES-001).
- The repo tree is clean.

**Steps**:

1. Trace the resolution contract (`.opencode/command/check.md` §`<resolution>`) end-to-end:
   - step 1: `AGENTS.md` declares the runner/gate set → the resolver reads it (proven present by TC-QGATES-014);
   - step 2: the declared path resolves to the real `scripts/quality-gates.sh` (existence proven by TC-QGATES-001);
   - step 3: args pass through (proven by TC-QGATES-005/006);
   - step 4: execution runs from repo root.
2. Run the resolution path (or simulate it deterministically by invoking the resolved command from repo root) and capture the structured summary:
   ```bash
   set +e; scripts/quality-gates.sh >"$OUT" 2>"$ERR"; rc=$?; set -e
   ```
3. Assert the runner resolves and runs the real runner on a clean tree → exit 0, structured summary returned (AC-F7-1): `assert_exit_code 0 "$rc"` and `rg -n -i 'PASS' "$OUT"` → ≥1 match.
4. Assert logs land under the `@runner` convention: the runner writes the canonical `tmp/quality-gates/<YYYY-MM-DD>/` (OQ-2, proven in TC-QGATES-004 steps 6–7); `@runner` mirrors command output under `tmp/run-logs-runner/<YYYY-MM-DD>/` as it does for any command. Confirm the canonical dir is `tmp/quality-gates/<date>/` and that the `/check` contract's expected mirror location is documented (TC-QGATES-012 step 6):
   `test -d tmp/quality-gates/"$(date -u +%F)"` → true after a run (or assert the pointer in `$OUT` resolves to that dir).

**Expected Outcome**:

- The `/check` → `@runner` → `scripts/quality-gates.sh` path resolves and runs the real runner on a clean tree, returns a structured summary, and lands logs at the canonical `tmp/quality-gates/<date>/` location (mirrored by `@runner` under `tmp/run-logs-runner/<date>/`).

**Notes / Clarifications**:

- This is the G-1/NFR-1 outcome made concrete: "deterministic resolution" is now a lived property, not a fallback. RSK-3 is closed by TC-QGATES-007 + TC-QGATES-014 + this case together.

---

#### TC-QGATES-014 - `AGENTS.md` carries minimal honest declaration (names real runner/gate set; no invented gates)

**Scenario Type**: Happy Path
**Impact Level**: Critical
**Priority**: High
**Related IDs**: F-7, AC-F7-2, DM-2, DEC-3
**Test Type(s)**: Manual (content)
**Automation Level**: Semi-automated
**Target Layer / Location**: `AGENTS.md`
**Tags**: @docs, @agents-md, @resolution

**Preconditions**:

- Delivery wired `AGENTS.md` with the declaration (F-7).

**Steps**:

1. Assert `AGENTS.md` now carries an explicit quality-gates runner/gate-set declaration (the resolution contract step 1 reads this):
   `rg -n -i -e 'quality-gates' -e 'quality gates' -e 'scripts/quality-gates\.sh' AGENTS.md` → ≥1 match naming the runner.
2. Assert the declaration names the **real** script path (DEC-3 — makes NFR-1 a lived property):
   `rg -n 'scripts/quality-gates\.sh' AGENTS.md` → ≥1 match.
3. Assert the declaration is **honest** — it does not invent gates that do not exist. Manual confirmation: every gate the declaration names is a real gate present in the repo (the 4 default gates per TC-QGATES-003, or a documented project gate); no phantom gates.
4. Assert minimality (DEC-3 — "minimal honest declaration"): the addition is scoped (a short clause/line), not a re-implementation of the gate set or a duplicate of the guide.

**Expected Outcome**:

- `AGENTS.md` carries a minimal, honest declaration naming `scripts/quality-gates.sh` and (if enumerated) only real gates.

---

#### TC-QGATES-015 - `feature-quality-gates-and-pr.md` reconciled surgically (component table, NFR-1, Testing Approach)

**Scenario Type**: Regression
**Impact Level**: Important
**Priority**: Medium
**Related IDs**: F-8, AC-F8-1, DEC-6
**Test Type(s)**: Manual (content + scoped diff)
**Automation Level**: Semi-automated
**Target Layer / Location**: `doc/spec/features/feature-quality-gates-and-pr.md`
**Tags**: @docs, @spec, @reconciliation

**Preconditions**:

- Delivery reconciled the feature spec surgically (F-8 / DEC-6).

**Steps**:

1. Assert the Core Components table now includes the runner:
   `rg -n 'scripts/quality-gates\.sh' doc/spec/features/feature-quality-gates-and-pr.md` → ≥1 match in the component-table context.
2. Assert NFR-1 ("deterministic resolution") language reflects the now-real runner + the `AGENTS.md` declaration (no longer asserts a missing file):
   `rg -n -i -e 'AGENTS\.md' -e 'scripts/quality-gates\.sh' doc/spec/features/feature-quality-gates-and-pr.md` → ≥1 match associated with the resolution/NFR-1 area (manual confirmation).
3. Assert the Testing Approach references the automated suite (moved off "Manual"-only):
   `rg -n -i -e 'automated' -e 'test-quality-gates' -e 'test suite' doc/spec/features/feature-quality-gates-and-pr.md` → ≥1 match in the testing-approach context.
4. Assert **no unrelated edits** (DEC-6 — surgical): `git diff --stat -- doc/spec/features/feature-quality-gates-and-pr.md` is small and scoped; manual review confirms only component-table/NFR-1/Testing-Approach changes, no capability-semantics change and no unrelated prose churn.

**Expected Outcome**:

- The feature spec's component table includes the runner, NFR-1 reflects the real runner + declaration, the Testing Approach references the automated suite, and the diff is surgical with no unrelated edits.

---

#### TC-QGATES-016 - GH-67 doc-distribution drift guard stays green

**Scenario Type**: Regression
**Impact Level**: Critical
**Priority**: High
**Related IDs**: F-8, AC-F8-2, NFR-8, RSK-5
**Test Type(s)**: Integration (shell test)
**Automation Level**: Automated
**Target Layer / Location**: `scripts/.tests/test-doc-distribution.sh`
**Tags**: @regression, @marker, @ci

**Preconditions**:

- The new guide exists with `ados_distribution: redistributable` (TC-QGATES-011).

**Steps**:

1. Run the guard:
   ```bash
   bash scripts/.tests/test-doc-distribution.sh
   ```
   → exit 0 (PASS).

**Expected Outcome**:

- The guard passes. Because the new guide carries `redistributable` (TC-QGATES-011) and is under the guard's DM-2 scan set (`doc/guides/*.md`), it is correctly included in the derived install set — no missing-marker, no redistributable-not-installed, no derived-set drift. A failure would indicate the marker is missing/invalid or the install set drifted.

**Notes / Clarifications**:

- This is the no-break + new-coverage assertion (AC-F8-2 / NFR-8 / RSK-5). The guard's 5 modes are independently exercised by `test-doc-distribution-modes.sh` (unchanged by this change).

---

#### TC-QGATES-017 - `.ados-claude/` freshness invariant (regenerated iff `.opencode/` changed)

**Scenario Type**: Regression
**Impact Level**: Critical
**Priority**: High
**Related IDs**: F-8, AC-F8-3, RSK-7
**Test Type(s)**: Integration (build invariant)
**Automation Level**: Automated
**Target Layer / Location**: `scripts/build-claude-plugin.sh` → `.ados-claude/`
**Tags**: @regression, @plugin, @ci

**Preconditions**:

- The committed `.ados-claude/` baseline is current (deterministic build output).
- The change's `.opencode/` edit surface is known: per spec §7.1/§16, **no** `.opencode/` source is expected to change (the `/check`,`/check-fix` commands are unchanged — NG-5). If that holds, `.ados-claude/` must be **untouched**; if any `.opencode/` source did change, `.ados-claude/` must have been regenerated to match.

**Steps**:

1. Capture the committed state: `git status --short -- .ados-claude/` → clean.
2. Determine the `.opencode/` edit surface for this change:
   `git diff --name-only <merge-base> HEAD -- .opencode/` → the set of edited sources (expected: empty per NG-5).
3. Re-run the generator:
   ```bash
   scripts/build-claude-plugin.sh
   ```
   → exits 0.
4. Diff the regenerated tree: `git diff --stat -- .ados-claude/`.
5. Assert the 1:1 invariant (AC-F8-3 / RSK-7):
   - **if** step 2 is empty (no `.opencode/` edit) → step 4 must be **empty** (`.ados-claude/` untouched; needless regeneration is a violation);
   - **if** step 2 is non-empty → step 4 must list exactly the generated counterparts of the edited sources (e.g. `.opencode/agent/x.md` → `.ados-claude/agents/x.md`), no more.

**Expected Outcome**:

- `.ados-claude/` is regenerated **iff** a `.opencode/` source changed; the diff-stat is empty when no source changed, and exactly mirrors the edited sources when one did.

**Notes / Clarifications**:

- A non-empty diff in the "no `.opencode/` edit" branch means either a stale baseline or a non-deterministic build — both are release blockers.

---

#### TC-QGATES-018 - Plugin-freshness check + shellcheck (`error`) stay green

**Scenario Type**: Regression
**Impact Level**: Critical
**Priority**: High
**Related IDs**: F-8, AC-F8-4, NFR-6
**Test Type(s)**: Integration (shell test + lint)
**Automation Level**: Automated
**Target Layer / Location**: plugin-freshness gate + `shellcheck`
**Tags**: @regression, @lint, @ci

**Preconditions**:

- The new script + suite are committed; the plugin baseline is current (TC-QGATES-017).

**Steps**:

1. **Plugin freshness** (one of the default gates; also a CI job `verify-claude-build`): run the build and assert `.ados-claude/` is clean afterward:
   ```bash
   scripts/build-claude-plugin.sh && git diff --quiet -- .ados-claude/
   ```
   → exit 0 (the generated plugin is current). (This overlaps TC-QGATES-017's mechanics; here it is asserted as a **gate** that must stay green.)
2. **shellcheck** at `error` severity (the CI gate). Run locally **if `shellcheck` is installed**:
   ```bash
   if command -v shellcheck >/dev/null 2>&1; then
     shellcheck -S error scripts/quality-gates.sh scripts/.tests/test-quality-gates.sh
   else
     echo "shellcheck not installed locally — CI authoritative (ludeeus/action-shellcheck@master, severity=error)"
   fi
   ```
   → exit 0 when present.
3. Confirm the new files are **not** under an ignored path: CI's shellcheck uses `ignore_paths: node_modules .git .ados-claude tmp`; `scripts/quality-gates.sh` and `scripts/.tests/test-quality-gates.sh` are scanned (manual confirmation).

**Expected Outcome**:

- The plugin-freshness gate is green; shellcheck (`error` severity) is clean on the new script + suite (locally when installed; CI authoritative otherwise).

**Notes / Clarifications**:

- `shellcheck` is CI-authoritative (it may be absent locally). The "if present" structure avoids a false local failure while keeping the CI gate the source of truth. text-to-image e2e/perf suites are excluded from CI `bash-tests` by the workflow's `-not -name` filters and are not part of this regression surface.

---

#### TC-QGATES-019 - Determinism: run twice → same verdict + identical gate ordering

**Scenario Type**: Edge Case
**Impact Level**: Critical
**Priority**: High
**Related IDs**: F-1, AC-NFR1-1, NFR-1, RSK-9
**Test Type(s)**: Behavior (subprocess)
**Automation Level**: Automated
**Target Layer / Location**: `scripts/.tests/test-quality-gates.sh` (determinism case)
**Tags**: @backend, @scripts, @determinism

**Preconditions**:

- The repo state is stable between the two runs (no concurrent mutation).

**Steps**:

1. Run the runner twice (canonically on a clean tree, or hermetically against a fixture gate set for speed), capturing each summary:
   ```bash
   scripts/quality-gates.sh >"$RUN1" 2>/dev/null || true
   scripts/quality-gates.sh >"$RUN2" 2>/dev/null || true
   ```
2. Assert the **verdict** is identical: both runs report the same overall PASS/FAIL and the same per-gate pass/fail statuses. (Durations may legitimately vary, so compare the verdict + status fields, not the raw duration values.)
3. Assert the **gate ordering** is identical: extract the ordered list of gate names from each summary and assert equality:
   ```bash
   diff <(extract_gate_names <"$RUN1") <(extract_gate_names <"$RUN2")
   ```
   → empty (no ordering difference).
4. Assert no time/randomness dependence: the runner does not shuffle gates, does not consult the wall clock for ordering, and does not short-circuit on transient state (manual confirmation against the script; the two-run equivalence is the behavioral proof).

**Expected Outcome**:

- Two runs of the same repo state yield the same pass/fail verdict and the same gate ordering (NFR-1 / AC-NFR1-1).

---

#### TC-QGATES-020 - Performance: orchestrator overhead (dispatch + reporting) < 2s; no gratuitous re-runs

**Scenario Type**: Performance
**Impact Level**: Important
**Priority**: Medium
**Related IDs**: F-1, AC-NFR2-1, NFR-2
**Test Type(s)**: Performance (timed)
**Automation Level**: Automated
**Target Layer / Location**: `scripts/.tests/test-quality-gates.sh` (perf case)
**Tags**: @backend, @scripts, @perf

**Preconditions**:

- The runner exposes the extension seam so the suite can inject a set of **trivial fast gates** (e.g. `exit 0` stubs), isolating orchestrator overhead from the real gates' cost.

**Steps**:

1. Inject a fixture gate set of N trivial PASS gates (e.g. N=10) via the extension seam.
2. Time a full run and compute the per-gate dispatch+report overhead:
   ```bash
   start=$(date +%s.%N); scripts/quality-gates.sh >"$OUT" 2>/dev/null; end=$(date +%s.%N)
   overhead=$(awk -v s="$start" -v e="$end" -v n=10 'BEGIN{print e-s}')
   ```
3. Assert the **orchestrator overhead** (dispatch + reporting, excluding the gates' own runtime which is ~0 for trivial stubs) is < 2s wall-clock (NFR-2): `awk -v o="$overhead" 'BEGIN{exit !(o < 2)}'`.
4. Assert **no gratuitous re-runs**: each gate appears exactly once in the summary (the runner does not run any gate twice):
   for each fixture gate, count occurrences in `$OUT` and assert == 1.

**Expected Outcome**:

- Orchestrator overhead is < 2s wall-clock for dispatch + reporting, and no gate is run more than once (NFR-2 / AC-NFR2-1).

**Notes / Clarifications**:

- Using trivial stub gates isolates the orchestrator's own cost from the real gates (test-all, build-claude-plugin) which dominate a real run. The "< 2s" threshold is generous for stdlib bash dispatch; the real intent is "negligible vs the gates".

---

#### TC-QGATES-021 - Stdlib-only: orchestrator depends only on Bash 4.0+ stdlib; test suite needs no network

**Scenario Type**: Edge Case
**Impact Level**: Critical
**Priority**: High
**Related IDs**: F-1, AC-NFR4-1, NFR-4
**Test Type(s)**: Unit (static) + Behavior (offline)
**Automation Level**: Automated
**Target Layer / Location**: `scripts/quality-gates.sh` (static) + `scripts/.tests/test-quality-gates.sh` (offline run)
**Tags**: @backend, @scripts, @stdlib

**Preconditions**:

- The runner is the orchestrator under test (the gates it delegates to may use `jq` etc.; NFR-4 scopes stdlib-only to the **orchestrator's own** code path, allowing what the gates already require).

**Steps**:

1. Assert the orchestrator's own code introduces **no** non-stdlib runtime dependency. Static audit the script for external-tool calls in the orchestrator's dispatch/reporting path (excluding delegation wrappers that hand off to the gates):
   `rg -n -e '\bcurl\b' -e '\bwget\b' -e '\bjq\b' -e '\bpython' -e '\bnode\b' -e '\bruby\b' -e '\bawk\b' scripts/quality-gates.sh` → review each hit; `curl`/`wget`/`python`/`node`/`ruby` → 0 matches in the orchestrator's own logic (delegation wrappers that pass through to a gate are allowed). (`awk`/`jq` for summary shaping are permissible only if bounded; manual confirmation they do not add a new hard runtime dep beyond what gates already require.)
2. Assert a `require_cmd`/`command -v` check, if present, gates only tools the gates themselves need (not a new orchestrator-only dep): manual confirmation.
3. Assert the **test suite needs no network**: run the suite with network egress unavailable (or simply confirm by inspection that no test issues a network call). Practically, run the suite offline:
   ```bash
   bash scripts/.tests/test-quality-gates.sh
   ```
   → exit 0 with no network access required (the suite uses only `mktemp`/`bash`/`git`/`rg`-or-`grep` locally and the fixture gates are local scripts).
4. Assert Bash 4.0+ features used (e.g. associative arrays, `mapfile`) are gated by the bash.md §1 capability check where relevant (the suite runs under the CI `ubuntu-latest` bash, which is 4+/5+).

**Expected Outcome**:

- The orchestrator's own code path depends only on Bash 4.0+ stdlib (no new runtime deps beyond what the gates already require); the test suite runs to green with no network access (NFR-4 / AC-NFR4-1).

---

## 6. Environments and Test Data

- **Environment:** local-dev clone on branch `feat/GH-37/ai-tuned-quality-gates-script`; `bash` ≥ 4.0, `git`, `rg` (ripgrep) available; `shellcheck` optional (CI authoritative); `jq` available (required by some existing suites). CI runs on `ubuntu-latest` (`.github/workflows/ci.yml`).
- **Test data:** no persisted data. Behavioral cases generate **ephemeral fixtures** under `mktemp -d` (fixture gate scripts, fixture gate-set declarations, fixture `AGENTS.md`-style declarations) removed in an EXIT trap (bash.md §11.1 / `test-doc-distribution.sh` cleanup pattern). Log artifacts land under git-ignored `tmp/quality-gates/<YYYY-MM-DD>/` and need no cleanup beyond the test run.
- **Isolation:** hermetic. The regression-guard (TC-QGATES-004), arg-handling (TC-QGATES-005), discovery (TC-QGATES-007), extensibility (TC-QGATES-008), determinism (TC-QGATES-019), and perf (TC-QGATES-020) cases inject fixture gate sets via the extension/env seam — they never mutate the committed `AGENTS.md`, the real default set, or the repo tree. Each case asserts `git status --porcelain` is unchanged after the run. No network is required (NFR-4).

## 7. Automation Plan and Implementation Mapping

| TC ID | Implementation status | Execution command | Mocking | Notes |
|-------|-----------------------|-------------------|---------|-------|
| TC-QGATES-001 | To Implement (static case in suite) | `test -x` + `rg` on `scripts/quality-gates.sh` | None | Closes RSK-8 (header convention) |
| TC-QGATES-002 | To Implement (behavior case in suite) | `scripts/quality-gates.sh >$OUT 2>$ERR`; assert exit 0 + field shape | None (clean tree) or trivial PASS fixture gates | Pin the documented field syntax |
| TC-QGATES-003 | To Implement (static + behavior in suite) | `rg` default-set registry + named real-gate run | None | NG-1: delegates, does not reimplement |
| TC-QGATES-004 | To Implement (regression-guard case in suite) | inject failing fixture gate via seam; run; assert non-zero exit + FAIL + log pointer + excerpt | Fixture failing gate (temp script) | Most important case; hermetic |
| TC-QGATES-005 | To Implement (arg-handling cases in suite) | named-gate run + unknown-selector tolerance + non-masking fail | Fixture gate set | Step 6 = non-masking safety |
| TC-QGATES-006 | To Implement (behavior case in suite) | `scripts/quality-gates.sh --help`; content assertions | None | OQ-1 honesty (`fast`/`slow` future) |
| TC-QGATES-007 | To Implement (resolution cases in suite) | fixture `AGENTS.md`-declaration vs fallback default | Fixture declaration | DEC-3 precedence |
| TC-QGATES-008 | To Implement (extension case in suite) | add project gate via seam; run; assert + `git diff` empty on core | Fixture project gate | No core edit |
| TC-QGATES-009 | To Implement (the suite itself) | `bash scripts/.tests/test-quality-gates.sh` | per internal cases | AC-F5-1 contract coverage |
| TC-QGATES-010 | Existing – No Change (aggregator) | `bash scripts/test-all.sh` + CI `find … -exec` path check | None | NFR-7 no manual wiring |
| TC-QGATES-011 | Manual Only (content) | `test -f` + `rg '^ados_distribution: redistributable'` | None | NFR-8 |
| TC-QGATES-012 | Manual Only (content) | per-topic `rg` on guide | None | 6 topics + cross-links |
| TC-QGATES-013 | Semi-automated (resolution trace) | invoke resolved runner from repo root; assert summary + canonical log dir | None (clean tree) | OQ-2 canonical dir |
| TC-QGATES-014 | Manual Only (content) | `rg` declaration in `AGENTS.md` + honesty review | None | DEC-3 minimal & honest |
| TC-QGATES-015 | Manual Only (content + scoped diff) | `rg` on spec + `git diff --stat` | None | DEC-6 surgical |
| TC-QGATES-016 | Existing – No Change | `bash scripts/.tests/test-doc-distribution.sh` | None | Must stay PASS |
| TC-QGATES-017 | Existing – No Change (build invariant) | `scripts/build-claude-plugin.sh && git diff --stat -- .ados-claude/` | None | 1:1 iff `.opencode/` changed |
| TC-QGATES-018 | Existing – No Change (gate + lint) | plugin-freshness run + `shellcheck -S error` (if present) | None | CI authoritative for shellcheck |
| TC-QGATES-019 | To Implement (determinism case in suite) | two runs; diff verdict + gate-name order | None or fixture gate set | NFR-1 |
| TC-QGATES-020 | To Implement (perf case in suite) | time a trivial-fixture-gate run; assert overhead < 2s | Trivial PASS fixture gates | NFR-2 |
| TC-QGATES-021 | To Implement (static + offline in suite) | `rg` dep audit + offline `bash scripts/.tests/test-quality-gates.sh` | None | NFR-4 stdlib-only |

**Suite home:** all "To Implement" cases live in `scripts/.tests/test-quality-gates.sh`, sourced/invoked per the embedded framework (bash.md §11). The runner is sourced for pure-logic unit cases and invoked as a subprocess for behavior cases.

## 8. Risks, Assumptions, and Open Questions

### 8.1 Risks

- **RSK-T1 (fixture-seam fragility):** the hermetic cases (TC-QGATES-004/005/007/008/019/020) depend on the runner exposing a clean extension/env seam (bash.md §10.1). **Mitigation:** the seam is itself a deliverable (F-3/F-4); TC-QGATES-008 proves it works; if the author chooses a different injection mechanism, the suite and these steps move together.
- **RSK-T2 (field-syntax drift):** TC-QGATES-002/004 assert a stable per-gate field shape; if the author later changes the syntax, the suite must update in lockstep or it false-fails. **Mitigation:** the suite pins the chosen syntax and the guide (TC-QGATES-012) documents it as the contract.
- **RSK-T3 (clean-tree flakiness):** TC-QGATES-002/013 run the real default gates on the actual repo; a transiently-dirty tree (e.g. an uncommitted `tmp/` artifact) could flip a gate. **Mitigation:** preconditions require `git status --porcelain` clean; the suite prefers fixture-gate variants for speed and reserves the real clean-tree run for CI/manual verification.
- **RSK-T4 (shellcheck absence locally):** TC-QGATES-018 cannot fail locally if `shellcheck` is absent. **Mitigation:** "if present" structure with CI authoritative; CI is the source of truth.
- **RSK-T5 (perf measurement noise):** TC-QGATES-020's < 2s threshold is generous but wall-clock timing is noisy on shared CI runners. **Mitigation:** trivial-stub gates isolate orchestrator cost; the threshold has wide margin.

### 8.2 Assumptions

- The runner is designed for testability per bash.md §10 (env-injectable settings, mockable wrappers, testable main guard) — the hermetic cases rely on this.
- The canonical output dir is `tmp/quality-gates/<YYYY-MM-DD>/` (OQ-2, PM-resolved); `@runner` mirrors under `tmp/run-logs-runner/<YYYY-MM-DD>/` as for any command (out of the runner script's direct responsibility, asserted via documentation in TC-QGATES-012/013).
- The arg contract is `all` (default) + named-gate now, with `fast`/`slow` documented as future (OQ-1/DEC-4); unknown selectors are tolerated (warned/ignored), never a hard crash that masks failures.
- `scripts/quality-gates.sh` uses a descriptive comment header with no hand-added license block (OQ-3/DEC-5); `scripts/` is not an `add-header-location.sh` default path.
- CI `bash-tests` auto-discovers `*/.tests/test-*.sh` (excluding `./tmp/*` and the text-to-image e2e/perf suites) — confirmed in `.github/workflows/ci.yml`; the new suite needs no manual CI wiring (NFR-7).
- No `.opencode/` source changes in this change (NG-5 — commands unchanged), so `.ados-claude/` is expected untouched (TC-QGATES-017 "empty-diff" branch).

### 8.3 Open Questions

| ID | Question | Blocking? | Owner |
|----|----------|-----------|-------|
| OQ-T1 | What exact per-gate field syntax will the runner emit (e.g. `name=… status=… duration=…` vs. a tagged multi-line block)? The suite (TC-QGATES-002/004) and guide (TC-QGATES-012) must pin the same form. | No (resolved at delivery; spec leaves it to the author) | @coder |
| OQ-T2 | Should TC-QGATES-020's perf threshold be tightened below 2s once baseline measurements exist, or kept generous? | No | @pm (deferred) |
| OQ-T3 | Is the real clean-tree default-gate run (TC-QGATES-002/013) fast enough for the unit suite, or should the suite always use fixture gates and reserve the real run for CI? | No | @coder (delivery-time decision) |

## 9. Plan Revision Log

| Version | Date | Author | Changes |
|---------|------|--------|---------|
| 1.0 | 2026-07-04 | @test-plan-writer | Initial test plan for GH-37: 21 scenarios, 24/24 ACs covered (100%); behavioral bash suite + content/hygiene + regression invariants. PM decisions OQ-1/OQ-2/OQ-3 baked into expectations. |

## 10. Test Execution Log

| TC ID | Run Date | Result | Notes |
|-------|----------|--------|-------|
| _(populated during delivery by @coder / @reviewer / @runner)_ | | | |

---

## Minimum Quality Gates Before Completion

The change is **not done** until all of the following are green (per `.ai/rules/testing-strategy.md` "Quality gates" + this plan):

- [ ] **TC-QGATES-009** — `bash scripts/.tests/test-quality-gates.sh` passes (the new contract suite: resolution, per-gate reporting, exit codes, AI-actionable output, arg handling, **and** the regression-guard negative case AC-F1-4).
- [ ] **TC-QGATES-010** — `bash scripts/test-all.sh` passes (the new suite is auto-discovered; no manual wiring) and all existing `scripts/.tests/test-*.sh` + CI-safe `tools/.tests/test-*.sh` stay green.
- [ ] **TC-QGATES-016** — `bash scripts/.tests/test-doc-distribution.sh` exits 0 (GH-67 drift guard green; new guide carries `redistributable`).
- [ ] **TC-QGATES-017** — `scripts/build-claude-plugin.sh && git diff --quiet -- .ados-claude/` succeeds (plugin freshness; regenerated iff `.opencode/` changed).
- [ ] **TC-QGATES-018** — plugin-freshness gate green **and** `shellcheck -S error` clean on `scripts/quality-gates.sh` + `scripts/.tests/test-quality-gates.sh` (CI authoritative; local "if present").
- [ ] **TC-QGATES-001 / 011 / 014 / 015** — static/convention checks pass: runner exists + bash.md-conformant + descriptive header (no license block); guide exists with `redistributable`; `AGENTS.md` declaration honest; feature spec reconciled surgically.
- [ ] **Static guard** — `git diff --check` clean (no whitespace/conflict-marker violations across the diff).
- [ ] **Traceability** — every AC-F\*/AC-NFR\* in the spec is covered by ≥1 TC above (24/24 in §3.1); no AC left without a case or an explicit TODO.
