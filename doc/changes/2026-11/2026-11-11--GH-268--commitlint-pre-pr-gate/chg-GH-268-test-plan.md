---
id: chg-GH-268-test-plan
status: Updated
created: 2026-11-11
last_updated: 2026-11-11
owners: ["engineering"]
service: delivery tooling (commit-message lint gate + committer/PM contract)
labels: ["hardening", "commitlint", "quality-gates", "delivery-automation"]
version_impact: minor
summary: "Verification plan for the pre-PR branch-range commit-message gate: per-commit diagnostics, remediation-mode aggregation, the nine-row terminal-condition/exit contract, the stated message contract in the committer and PM prompts, the conventional-subject resume-sync instruction, installer distribution, and documentation truth."
links:
  change_spec: ./chg-GH-268-spec.md
  implementation_plan: null   # awaited: ./chg-GH-268-plan.yaml
  testing_strategy: .ai/rules/testing-strategy.md
---

# Test Plan - Enforce commit-message lint before PR creation (recurring merge blocker)

## 1. Scope and Objectives

This plan verifies one additive, read-only quality gate (`scripts/lint-commit-range.sh`) whose verdict must equal the CI commitlint authority's verdict for the same branch range, and verifies the prompt/doc surfaces that state the message contract and wire the gate into the PM `quality_gates` phase. The behaviour under protection is: a malformed commit is caught locally with per-commit attribution before PR creation, the gate never passes without a real verdict, it mutates nothing and touches no network, and the automation that manufactured plain merge subjects stops doing so. The regressions that motivated the plan are GH-230 / PR #264, GH-237 / PR #265, and GH-240 / PR #267 — three lanes that lost a round-trip and a force-push to a purely mechanical history defect.

### 1.1 In Scope

- `scripts/lint-commit-range.sh`: base-resolution precedence, merge-base range derivation, verdict parity, per-commit diagnostics (DM-2), remediation-mode aggregation (DM-3), and the nine terminal conditions with their three exit codes (DM-1.a–i).
- The gate self-test suite `scripts/.tests/test-lint-commit-range.sh` and its fixtures, including the no-false-positive shapes (conventional-subject merge commit, plain merge subject, merged-upstream history outside the range).
- Read-only (`NFR-5`) and no-network (`NFR-4`) assertions over every terminal outcome.
- Committer and PM prompt contract statements (F-4, F-6), and the resume-sync instruction plus its assertion in the autonomous delivery prompt (F-5).
- Installer/uninstaller registration and suites (F-7).
- Documentation truth: `AGENTS.md`, the change-lifecycle `quality_gates` phase, the quality-gates/PR page, the autonomous-delivery page, the monorepo scaffold toolchain page, and the existing conformance guards (F-8, NFR-9).
- The dogfood run: this change's own branch range must pass the gate before `quality_gates` can complete.

### 1.2 Out of Scope & Known Gaps

- **Diff-shape confinement is not a permanent suite assertion.** `AC-NFR8-1` asserts a property of the change diff, and `.ai/rules/testing-strategy.md` forbids permanent suites from asserting against a moving base branch. It is verified at PR time (`TC-CONFINE-001`) plus permanent tree invariants (`TC-CONFINE-002`).
- **All 19 ACs are traced after the specification correction.** `AC-F3-5`, `AC-F3-6`, `AC-NFR4-1`, and `AC-NFR6-1` close the former gaps on `DM-1.h`, `DM-1.i`, `NFR-4`, and `NFR-6`. They map onto the TCs that already asserted the behaviour — `TC-COMMITLINT-009`, `TC-COMMITLINT-012`, `TC-COMMITLINT-021`, and `TC-COMMITLINT-015` — whose expected results were extended where the new criteria demand more than the original assertions (no duplicate TCs were added).
- **The runtime and bounded-output assertions are budgets, not benchmarks.** `TC-COMMITLINT-021` measures wall-clock time against the two documented budgets, and `TC-COMMITLINT-015` counts lines and excerpt widths; neither is a statistical performance profile, and a loaded runner is the accepted measurement risk (§8.1 TR-1).
- **Plain merge subjects are not rejected** (spec DEC-4 / OQ-1). `TC-COMMITLINT-004` asserts they *pass*, which is the parity contract, not an omission.
- **CI behaviour is not re-tested.** The `ts-commitlint` workflow is unchanged (`NG-1`); only its continued presence and shape are asserted (`TC-CONFINE-002`).
- **Adopter behaviour is tested in sandboxed temp projects,** not by installing into this repository.
- **No bash<4 / Windows shell coverage.** The repository requires bash≥4 (`AGENTS.md`, `.ai/rules/bash.md`).
- **No CDN/offline matrix for the commitlint binary.** Real-binary cases assume the pinned root dev dependency is installed; absence fails loudly (`TC-COMMITLINT-008` philosophy applied to the suite itself).

## 2. References

| Reference | Role |
|---|---|
| [`./chg-GH-268-spec.md`](./chg-GH-268-spec.md) | Source of truth: F-1…F-8, DM-1.a–i, DM-2, DM-3, NFR-1…NFR-10, AC-F1-1…AC-NFR8-1, DEC-1…DEC-9 |
| [`.ai/rules/testing-strategy.md`](../../../.ai/rules/testing-strategy.md) | Canonical strategy: layers, module→test mapping, invariant-test authoring rule |
| [`.ai/rules/bash.md`](../../../.ai/rules/bash.md) | Gate suite conventions: embedded harness, assertion helpers, exit-code contract, `require_cmd`, mockable wrappers |
| [`doc/templates/test-plan-template.md`](../../../templates/test-plan-template.md) | Structural template for this document |
| [`scripts/.tests/test-deliver-ticket.sh`](../../../../scripts/.tests/test-deliver-ticket.sh) | Harness style, prompt assertions (`TC-DT-08g`), temp-dir fixtures |
| [`scripts/.tests/test-install.sh`](../../../../scripts/.tests/test-install.sh) / [`test-uninstall.sh`](../../../../scripts/.tests/test-uninstall.sh) | Installer/uninstaller sandbox pattern |
| [`scripts/.tests/test-doc-distribution-modes.sh`](../../../../scripts/.tests/test-doc-distribution-modes.sh) | Synthetic-root mutation harness pattern (reused for assertion-strength probes) |
| [`scripts/checks/commitlint-authority.ts`](../../../../scripts/checks/commitlint-authority.ts) | Existing single-config + CI-authority invariant (must stay green) |
| [`scripts/checks/prompt-conformance.ts`](../../../../scripts/checks/prompt-conformance.ts) | Raw-git-write and forbidden-literal scan over lifecycle prompts |
| [`tests/checks/doc-conformance.test.ts`](../../../../tests/checks/doc-conformance.test.ts) | Current-truth phrase table scan |
| [`scripts/.tests/test-doc-distribution.sh`](../../../../scripts/.tests/test-doc-distribution.sh) | `ados_distribution` marker / install-set drift guard |
| [`AGENTS.md`](../../../../AGENTS.md), [`doc/guides/change-lifecycle.md`](../../../guides/change-lifecycle.md) | Delivery-process and lifecycle truth that must match the delivered behaviour |
| [`commitlint.config.js`](../../../../commitlint.config.js), [`.github/workflows/ci.yml`](../../../../.github/workflows/ci.yml), [`.husky/commit-msg`](../../../../.husky/commit-msg) | Unchanged surfaces asserted by confinement |

## 3. Coverage Overview

### 3.1 Functional Coverage (F-#, AC-#)

| AC ID | Requirement (abridged) | TC ID(s) | Status |
|---|---|---|---|
| AC-F1-1 | Malformed commit in range → non-zero + offending short SHA + rule id | TC-COMMITLINT-001, TC-COMMITLINT-013 | Covered |
| AC-F1-2 | Valid conventional range (incl. conventional-subject merge, upstream outside range) → pass, exit 0, no diagnostics | TC-COMMITLINT-002, TC-COMMITLINT-003, TC-COMMITLINT-004, TC-COMMITLINT-005, TC-COMMITLINT-006 | Covered |
| AC-F2-1 | One block per offender: short SHA, full SHA, rule id + line + bounded excerpt, oldest→newest | TC-COMMITLINT-013, TC-COMMITLINT-014, TC-COMMITLINT-015 | Covered |
| AC-F2-2 | 1–2 offenders → `SURGICAL REWORD`; ≥3 → `CONDENSE-TO-ONE`; per-commit counting; advisory only | TC-COMMITLINT-016, TC-COMMITLINT-017 | Covered |
| AC-F3-1 | Empty range → pass stating zero commits in range, exit 0 | TC-COMMITLINT-006 | Covered |
| AC-F3-2 | Unresolvable base override / configured base / merge-base → "unable to verify" exit, cause + hint, never a pass | TC-COMMITLINT-010, TC-COMMITLINT-011 | Covered |
| AC-F3-3 | Configured repo without usable binary → unable-to-verify naming the tool; no configuration → explicit skip exit 0 | TC-COMMITLINT-007, TC-COMMITLINT-008, TC-COMMITLINT-009 | Covered |
| AC-F3-4 | No network; working tree/index/refs/stash unchanged; every outcome maps to exactly one of three exit codes | TC-COMMITLINT-018, TC-COMMITLINT-019, TC-COMMITLINT-020 | Covered |
| AC-F3-5 | Configured commitlint cannot render a verdict (invalid config / execution failure) → `ERROR` exit 2 with cause + hint; never `FAIL`-with-violations, never `PASS` | TC-COMMITLINT-009 | Covered (assertions extended) |
| AC-F3-6 | Unknown argument / invalid base syntax → exit 2 with usage naming the accepted invocation and the offending argument; no range check | TC-COMMITLINT-012 | Covered (assertions extended) |
| AC-F4-1 | Committer + PM state subject rule, ≤100-char body/footer, no plain merge subject, both remediation modes — constraints, no raw git recipe | TC-PROMPT-001, TC-PROMPT-002, TC-PROMPT-003 | Covered |
| AC-F5-1 | Resume-sync emits a conventional-subject sync merge referencing the work item; assertion matches; no other section changes meaning | TC-PROMPT-004, TC-PROMPT-005, TC-PROMPT-006 | Covered |
| AC-F6-1 | `quality_gates` requires the range lint; remediation loop; unresolved error never recorded as pass; verdict recorded as PM-notes evidence | TC-PROMPT-002, TC-DOGFOOD-001 | Covered |
| AC-F6-2 | `AGENTS.md` states the gate as supplementary pre-PR gate; no new "run all quality gates" instruction; `/check` unchanged | TC-DOC-001 | Covered |
| AC-F7-1 | Gate present + executable after install, removed on uninstall, installer/uninstaller suites green | TC-DIST-001, TC-DIST-002, TC-DIST-003 | Covered |
| AC-F8-1 | Feature pages, lifecycle guide, `AGENTS.md` describe the delivered gate/contract; markers kept; no new conformance violation | TC-DOC-002, TC-DOC-003, TC-DOC-004, TC-DOC-005, TC-DOC-006, TC-DOC-007 | Covered |
| AC-NFR4-1 | ≤20-commit run ≤10 s, ≤100-commit run ≤60 s, zero network calls; suite asserts both budgets | TC-COMMITLINT-021, TC-COMMITLINT-019 | Covered (assertions extended) |
| AC-NFR6-1 | ≤20 rule lines per commit, excerpt ≤160 chars, ≤200 diagnostic lines, summary still reports offender count and distinct rules hit | TC-COMMITLINT-015 | Covered (assertions extended) |
| AC-NFR8-1 | No CI change, no hook enforcement, no rewrite/auto-fix automation, no change to `pnpm check`, `/check`, or `/check-fix` semantics, no CLI/MCP surface change, no commitlint config/rule change | TC-CONFINE-001, TC-CONFINE-002 | Covered (PR-time + tree invariants) |

### 3.2 Interface Coverage (API-#, EVT-#, DM-#)

`API-#` and `EVT-#` are N/A — spec §8.1/§8.2 state no HTTP or event surface is added.

| DM ID / row | Element | TC ID(s) | Status |
|---|---|---|---|
| DM-1 | Verdict record: outcome, exit code, base ref + resolution source, merge-base SHA, `HEAD` SHA, range count, offender count | TC-COMMITLINT-001, TC-COMMITLINT-006, TC-COMMITLINT-010, TC-COMMITLINT-013, TC-COMMITLINT-020 | Covered |
| DM-1.a | All commits satisfy configuration → PASS, exit 0, counted | TC-COMMITLINT-002 | Covered |
| DM-1.b | Empty range → PASS, zero commits, exit 0 | TC-COMMITLINT-006 | Covered |
| DM-1.c | ≥1 offending commit → FAIL, diagnostics + mode, exit 1 | TC-COMMITLINT-001, TC-COMMITLINT-016, TC-COMMITLINT-017 | Covered |
| DM-1.d | No commitlint configuration → SKIP, exit 0 | TC-COMMITLINT-007 | Covered |
| DM-1.e | Base override / configured base does not resolve → ERROR, exit 2 | TC-COMMITLINT-010 | Covered |
| DM-1.f | Merge-base undeterminable (unrelated / shallow) → ERROR, exit 2 | TC-COMMITLINT-011 | Covered |
| DM-1.g | Configuration present, binary unavailable → ERROR naming the tool, exit 2 | TC-COMMITLINT-008 | Covered |
| DM-1.h | Verdict cannot be rendered (invalid config, execution failure) → ERROR, exit 2 | TC-COMMITLINT-009 | Covered (AC-F3-5) |
| DM-1.i | Usage error (unknown argument, invalid base syntax) → ERROR, exit 2 | TC-COMMITLINT-012 | Covered (AC-F3-6) |
| DM-2 | Per-commit diagnostic block: short + full SHA, bounded subject, per-rule id + line + bounded excerpt, oldest→newest, deterministic | TC-COMMITLINT-013, TC-COMMITLINT-014, TC-COMMITLINT-015 | Covered |
| DM-3 | Remediation-mode rule: 1–2 → `SURGICAL REWORD`, ≥3 → `CONDENSE-TO-ONE`, counted per commit, advisory | TC-COMMITLINT-016, TC-COMMITLINT-017 | Covered |

### 3.3 Non-Functional Coverage (NFR-#)

| NFR ID | Threshold | TC ID(s) | Status |
|---|---|---|---|
| NFR-1 | 0 variance, stable ordering | TC-COMMITLINT-014 | Covered |
| NFR-2 | 0 silent passes across precondition scenarios | TC-COMMITLINT-007, TC-COMMITLINT-008, TC-COMMITLINT-009, TC-COMMITLINT-010, TC-COMMITLINT-011, TC-COMMITLINT-020 | Covered |
| NFR-3 | 0 false failures on valid conventional history | TC-COMMITLINT-002, TC-COMMITLINT-003, TC-COMMITLINT-004, TC-COMMITLINT-005 | Covered |
| NFR-4 | ≤10 s for ≤20 commits; ≤60 s for ≤100 commits; 0 network calls | TC-COMMITLINT-019, TC-COMMITLINT-021 | Covered (AC-NFR4-1) |
| NFR-5 | 0 working-tree, index, ref, or stash changes | TC-COMMITLINT-018 | Covered |
| NFR-6 | ≤20 rule lines/commit, ≤200 diagnostic lines, excerpt ≤160 chars | TC-COMMITLINT-015 | Covered (AC-NFR6-1) |
| NFR-7 | Exactly three codes with fixed meanings | TC-COMMITLINT-012, TC-COMMITLINT-020 | Covered |
| NFR-8 | 0 out-of-scope changes | TC-CONFINE-001, TC-CONFINE-002 | Covered (PR-time + tree invariants) |
| NFR-9 | Aggregate gate, prompt-conformance, doc-conformance, doc-distribution all green | TC-PROMPT-003, TC-DOC-006, TC-DOC-007 | Covered |
| NFR-10 | Every failing run names every offender by SHA with ≥1 rule id and line reference | TC-COMMITLINT-013 | Covered |

## 4. Test Types and Layers

| Layer | Framework / harness | Location | Used for |
|---|---|---|---|
| Bash behavior/integration suite | Embedded harness from `.ai/rules/bash.md` §11 (`run_test`, `assert_eq`, `assert_contains`, `assert_exit_code`, temp fixtures) | `scripts/.tests/test-lint-commit-range.sh` | All gate TCs (`TC-COMMITLINT-*`) |
| Bash fixture data | Committed message/config fixtures + generated temp git repositories | `scripts/.tests/fixtures/lint-commit-range/` and `mktemp -d` | Gate range/verdict/diagnostic TCs |
| Bash prompt suite | Existing embedded harness | `scripts/.tests/test-deliver-ticket.sh` | `TC-PROMPT-004`, `TC-PROMPT-005`, `TC-PROMPT-006` |
| Bash installer suites | Existing embedded harness + sandbox project | `scripts/.tests/test-install.sh`, `scripts/.tests/test-uninstall.sh` | `TC-DIST-001 through TC-DIST-003` |
| Static check (existing TS invariants) | `bun run scripts/checks/*.ts` | `scripts/checks/` | `TC-PROMPT-003`, `TC-CONFINE-002` |
| Static check (existing TS tests) | `bun test tests/checks/**` | `tests/checks/` | `TC-DOC-007` |
| Static check (doc guard) | `bash scripts/.tests/test-doc-distribution.sh` | `scripts/.tests/` | `TC-DOC-006` |
| Manual / PR-time review | Reviewer + evidence commands | PR diff, change artifacts | `TC-CONFINE-001`, parts of `TC-PROMPT-001/002`, `TC-DOC-001…005` |
| Performance (coarse budget) | Wall-clock measurement inside the bash suite | `scripts/.tests/test-lint-commit-range.sh` | `TC-COMMITLINT-021` |
| Aggregate gate | `pnpm check` (lint, format:check, typecheck, test, boundaries, prompt-conformance, help-guide-coverage, exports-parity) | repo root | `TC-DOC-007`, regression safety net for every TC |

Assertion vocabulary: "static check" = an exact-text or exit-code assertion run by a command; "manual" = a review step with recorded evidence; every scenario names its exact command and file.

## 5. Test Scenarios

### 5.1 Scenario Index

| TC ID | Title | Type | Level | Priority | AC Coverage |
|---|---|---|---|---|---|
| TC-COMMITLINT-001 | Malformed commit in range fails with attribution | Integration | Bash suite | High | AC-F1-1, AC-F2-1 |
| TC-COMMITLINT-002 | Clean conventional range passes | Integration | Bash suite | High | AC-F1-2 |
| TC-COMMITLINT-003 | Conventional-subject merge commit does not fail | Integration | Bash suite | High | AC-F1-2, NFR-3 |
| TC-COMMITLINT-004 | Plain merge subject passes (configuration parity) | Integration | Bash suite | High | AC-F1-2, DEC-4, NFR-3 |
| TC-COMMITLINT-005 | Merged-upstream offenders outside the range do not fail | Integration | Bash suite | High | AC-F1-2, NFR-3 |
| TC-COMMITLINT-006 | Empty range passes and states zero commits | Integration | Bash suite | High | AC-F3-1, DM-1.b |
| TC-COMMITLINT-007 | No commitlint configuration → explicit skip, exit 0 | Integration | Bash suite | Critical | AC-F3-3, DM-1.d |
| TC-COMMITLINT-008 | Configured repo without commitlint binary → error naming the tool | Integration | Bash suite | Critical | AC-F3-3, DM-1.g, NFR-2 |
| TC-COMMITLINT-009 | Invalid configuration → error, not a violation verdict | Integration | Bash suite | Important | AC-F3-5, DM-1.h, NFR-2 |
| TC-COMMITLINT-010 | Base resolution precedence and unresolvable base error | Integration | Bash suite | Critical | AC-F3-2, DM-1.e, DEC-7 |
| TC-COMMITLINT-011 | Undeterminable merge-base (unrelated and shallow history) errors | Integration | Bash suite | Critical | AC-F3-2, DM-1.f |
| TC-COMMITLINT-012 | Usage error, `--help`, and `--version` exit cleanly | Contract | Bash suite | Important | AC-F3-6, DM-1.i, NFR-7 |
| TC-COMMITLINT-013 | Per-commit diagnostic block content and oldest→newest ordering | Integration | Bash suite | High | AC-F2-1, DM-2, NFR-10 |
| TC-COMMITLINT-014 | Repeated runs are byte-identical (determinism) | Integration | Bash suite | Important | NFR-1, AC-F2-1 |
| TC-COMMITLINT-015 | Diagnostic output is bounded | Integration | Bash suite | Important | AC-NFR6-1, NFR-6 |
| TC-COMMITLINT-016 | Remediation mode thresholds: 1, 2, ≥3 offenders | Integration | Bash suite | High | AC-F2-2, DM-3 |
| TC-COMMITLINT-017 | Offenders counted per commit, not per violation | Integration | Bash suite | High | AC-F2-2, DM-3 |
| TC-COMMITLINT-018 | Read-only across every terminal outcome | Integration | Bash suite | Critical | AC-F3-4, NFR-5 |
| TC-COMMITLINT-019 | No network access on any path | Integration | Bash suite | Critical | AC-F3-4, AC-NFR4-1, NFR-4, DEC-7 |
| TC-COMMITLINT-020 | Exit-code matrix is exactly 0 / 1 / 2 | Contract | Bash suite | Critical | AC-F3-4, NFR-2, NFR-7 |
| TC-COMMITLINT-021 | Runtime budget for a 20-commit range | Performance | Bash suite | Low | AC-NFR4-1, NFR-4 |
| TC-PROMPT-001 | Committer prompt states the full message contract | Static check | Manual + static | High | AC-F4-1 |
| TC-PROMPT-002 | PM `quality_gates` requires the gate, loops, and records evidence | Static check | Manual + static | Critical | AC-F6-1, AC-F4-1 |
| TC-PROMPT-003 | Contract is constraints, not raw git recipes; conformance green | Static check | Automated | Critical | AC-F4-1, NFR-9 |
| TC-PROMPT-004 | Resume-sync emits a conventional-subject sync merge | Integration | Bash suite | High | AC-F5-1 |
| TC-PROMPT-005 | Resume-sync assertion matches the new instruction (strength-probed) | Integration | Bash suite | High | AC-F5-1 |
| TC-PROMPT-006 | No other prompt section changes meaning | Regression | Bash suite | Important | AC-F5-1, NFR-8 |
| TC-DOC-001 | `AGENTS.md` states a supplementary pre-PR gate; `/check` unchanged | Static check | Manual + static | High | AC-F6-2 |
| TC-DOC-002 | Quality-gates/PR page describes gate and contract | Static check | Manual | High | AC-F8-1 |
| TC-DOC-003 | Autonomous-delivery page reflects the instruction shape | Static check | Manual | Important | AC-F8-1 |
| TC-DOC-004 | Change-lifecycle `quality_gates` names the range lint | Static check | Manual | High | AC-F8-1 |
| TC-DOC-005 | Scaffold toolchain page keeps "CI is the authority", adds mirror | Static check | Manual | Important | AC-F8-1 |
| TC-DOC-006 | Distribution markers kept; doc-distribution guard green | Static check | Automated | Critical | AC-F8-1, NFR-9 |
| TC-DOC-007 | Aggregate conformance battery green | Static check | Automated | Critical | AC-F8-1, NFR-9 |
| TC-DIST-001 | Gate is registered and installed executable | Integration | Bash suite | Critical | AC-F7-1 |
| TC-DIST-002 | Gate is removed on uninstall | Integration | Bash suite | High | AC-F7-1 |
| TC-DIST-003 | Installer/uninstaller suites pass with the gate registered | Regression | Bash suite | High | AC-F7-1 |
| TC-CONFINE-001 | PR-time diff contains only in-scope files | Manual | PR-time review | Critical | AC-NFR8-1 |
| TC-CONFINE-002 | Unchanged surfaces stay unchanged (tree invariants) | Static check | Automated | Critical | AC-NFR8-1, NFR-8 |
| TC-DOGFOOD-001 | This change's own branch range passes and the verdict is recorded | Manual | Manual + gate run | Critical | AC-F6-1, AC-F1-1, AC-F3-4 |

### 5.2 Scenario Details

#### TC-COMMITLINT-001 - Malformed commit in range fails with attribution

**Scenario Type**: Happy Path (for the gate's purpose) / Negative for the commit
**Impact Level**: Critical
**Priority**: High
**Related IDs**: F-1, F-2, AC-F1-1, AC-F2-1, DM-1.c, DM-2, NFR-2
**Test Type(s)**: Integration
**Automation Level**: Automated
**Target Layer / Location**: `scripts/.tests/test-lint-commit-range.sh` — `test_bad_body_commit_fails`
**Tags**: @bash, @gate, @negative

**Preconditions**:
- Fixture `FX-BAD-BODY`: temp repository with `commitlint.config.js` extending `@commitlint/config-conventional`, base branch `main` with one seed commit, feature branch `feat/GH-268/fixture` with one commit whose message is a valid conventional subject plus one body line of 140 characters (`msg-bad-body.txt`).

**Steps**:
1. `cd` into the fixture in a subshell and run `PATH="${REPO_ROOT}/node_modules/.bin:${PATH}" "${REPO_ROOT}/scripts/lint-commit-range.sh" --base main`, capturing stdout, stderr and `$?`.
2. Extract the offending commit's short SHA (`git rev-parse --short HEAD`) and full SHA.
3. Assert exit code `1`; assert stdout contains the short SHA and the full SHA; assert stdout contains `body-max-line-length`.
4. Assert the violation is reported as `FAIL`, not `ERROR` (`assert_not_contains "${out}" "ERROR"`), and that `SURGICAL REWORD` appears.

**Expected Outcome**:
- Then the gate exits non-zero with a violation verdict, and the offending commit's short SHA and the violated rule id appear in the output (AC-F1-1).
- Then no pass verdict (`PASS`) is emitted anywhere in the output (NFR-2 anti-silent-pass).

**Postconditions**: Fixture repository is deleted by the suite teardown.

**Notes / Clarifications**: This is the ticket's original acceptance shape and must hold with the real pinned commitlint binary, not a stub.

#### TC-COMMITLINT-002 - Clean conventional range passes

**Scenario Type**: Happy Path
**Impact Level**: Critical
**Priority**: High
**Related IDs**: F-1, AC-F1-2, DM-1.a, NFR-3
**Test Type(s)**: Integration
**Automation Level**: Automated
**Target Layer / Location**: `scripts/.tests/test-lint-commit-range.sh` — `test_clean_range_passes`
**Tags**: @bash, @gate, @positive

**Preconditions**:
- Fixture `FX-CLEAN`: feature branch with two valid conventional commits (`feat(GH-268): …`, `test(GH-268): …`), each with body lines ≤100 characters.

**Steps**:
1. Run the gate with `--base main` from the fixture root.
2. Assert exit code `0`, stdout contains `PASS`, contains the commit count `2`, and contains no rule id (`assert_not_contains "${out}" "body-max-line-length"`).
3. Assert no `FAIL`/`ERROR` token appears in stdout or stderr.

**Expected Outcome**:
- Then the report is a pass with the range count, exit success, and zero diagnostics (AC-F1-2, DM-1.a).

#### TC-COMMITLINT-003 - Conventional-subject merge commit does not fail

**Scenario Type**: Edge Case
**Impact Level**: Critical
**Priority**: High
**Related IDs**: F-1, AC-F1-2, NFR-3, DEC-4, RSK-1
**Test Type(s)**: Integration
**Automation Level**: Automated
**Target Layer / Location**: `scripts/.tests/test-lint-commit-range.sh` — `test_conventional_merge_commit_passes`
**Tags**: @bash, @gate, @parity

**Preconditions**:
- Fixture `FX-MERGE-CONV`: `main` advanced by one commit after the feature branch point; the feature branch merges it with `git merge --no-ff -m "chore(GH-268): sync with main"`.

**Steps**:
1. Confirm the fixture history really contains a two-parent commit (`git rev-list --merges main..HEAD` is non-empty).
2. Run the gate with `--base main`.
3. Assert exit code `0` and `PASS` in stdout.

**Expected Outcome**:
- Then a conventional-subject merge commit inside the range lints clean and cannot be a false positive (NFR-3, RSK-1 fixture-proven parity).

#### TC-COMMITLINT-004 - Plain merge subject passes (configuration parity)

**Scenario Type**: Corner Case
**Impact Level**: Critical
**Priority**: High
**Related IDs**: F-1, AC-F1-2, NFR-3, DEC-4, RSK-3, OQ-1
**Test Type(s)**: Integration
**Automation Level**: Automated
**Target Layer / Location**: `scripts/.tests/test-lint-commit-range.sh` — `test_plain_merge_subject_passes`
**Tags**: @bash, @gate, @parity

**Preconditions**:
- Fixture `FX-MERGE-PLAIN`: feature branch merges an advanced `main` with the default plain subject `Merge remote-tracking branch 'origin/main'`.

**Steps**:
1. Assert the fixture's HEAD is a merge whose subject matches `^Merge ` (precondition guard; otherwise the test is vacuous and must fail).
2. Run the gate with `--base main`.
3. Assert exit code `0`, `PASS` present, and no rule id reference to the merge subject.
4. Cross-check parity by running the authority's own range form directly — `commitlint --from "$(git merge-base main HEAD)" --to HEAD --verbose` — and assert it also exits `0`.

**Expected Outcome**:
- Then the gate accepts the plain merge subject exactly as the configuration does (DEC-4: parity over an extra rule), and the cross-check proves the gate is neither stricter nor looser.

**Notes / Clarifications**: The step-4 cross-check is the parity oracle for the whole suite; it is the only place the test asserts against the committed configuration rather than a hardcoded expectation.

#### TC-COMMITLINT-005 - Merged-upstream offenders outside the range do not fail

**Scenario Type**: Edge Case
**Impact Level**: Critical
**Priority**: High
**Related IDs**: F-1, AC-F1-2, NFR-3, DM-1.a
**Test Type(s)**: Integration
**Automation Level**: Automated
**Target Layer / Location**: `scripts/.tests/test-lint-commit-range.sh` — `test_upstream_history_outside_range_ignored`
**Tags**: @bash, @gate, @parity

**Preconditions**:
- Fixture `FX-UPSTREAM-DIRTY`: `main` gains a commit with a non-conventional subject (`msg-wip.txt`: `wip stuff`, plus an over-long body line); the feature branch merges `main` and then adds two valid conventional commits.

**Steps**:
1. Assert the merge-base of `main` and `HEAD` is the pre-merge commit and that the bad commit is an ancestor of `HEAD` (`git merge-base --is-ancestor "${bad_sha}" HEAD`) — precondition guard.
2. Run the gate with `--base main`.
3. Assert exit code `0`, `PASS` present, and the bad upstream SHA absent from stdout.
4. Assert the reported commit count equals `git rev-list --count "$(git merge-base main HEAD)..HEAD"`.

**Expected Outcome**:
- Then only the change's own commits are judged: merged-upstream history is never re-litigated (AC-F1-2, spec §5.1 F-1 range semantics).

#### TC-COMMITLINT-006 - Empty range passes and states zero commits

**Scenario Type**: Edge Case
**Impact Level**: Important
**Priority**: High
**Related IDs**: F-3, AC-F3-1, DM-1.b
**Test Type(s)**: Integration
**Automation Level**: Automated
**Target Layer / Location**: `scripts/.tests/test-lint-commit-range.sh` — `test_empty_range_passes_zero_commits`
**Tags**: @bash, @gate, @edge

**Preconditions**:
- Fixture `FX-EMPTY`: branch `feat/GH-268/empty` created at the tip of `main`, no additional commits.

**Steps**:
1. Assert `git rev-parse main^{commit}` equals `git rev-parse HEAD^{commit}` (precondition guard).
2. Run the gate with `--base main`.
3. Assert exit code `0`; assert stdout contains `PASS` and an explicit zero-count statement (assert a match on `0 commit` — case-insensitive — or the documented equivalent phrase).

**Expected Outcome**:
- Then the gate reports a pass that explicitly states zero commits were in range and exits success (AC-F3-1, DM-1.b). A bare `PASS` with no count is a failure of this TC.

#### TC-COMMITLINT-007 - No commitlint configuration → explicit skip, exit 0

**Scenario Type**: Negative (safety) / Edge Case
**Impact Level**: Critical
**Priority**: Critical
**Related IDs**: F-3, F-7, AC-F3-3, DM-1.d, NFR-2, DEC-6
**Test Type(s)**: Integration
**Automation Level**: Automated
**Target Layer / Location**: `scripts/.tests/test-lint-commit-range.sh` — `test_skip_without_config`, `test_alt_config_name_is_configured`
**Tags**: @bash, @gate, @adopter

**Preconditions**:
- Fixture `FX-NO-CONFIG`: temp repository containing none of the recognized configuration filenames (`commitlint.config.{js,cjs,mjs,ts}`, `.commitlintrc`, `.commitlintrc.json`, `.commitlintrc.yaml`, `.commitlintrc.yml`), with one deliberately malformed commit in range.
- Fixture `FX-ALT-CONFIG`: same history but with `.commitlintrc.json` containing `{"extends": ["@commitlint/config-conventional"]}`.

**Steps**:
1. Run the gate in `FX-NO-CONFIG` with `--base main`; assert exit code `0`; assert stdout contains `SKIP`; assert stdout states the reason (a match on `no commitlint configuration` or the documented equivalent); assert stdout contains no `PASS` verdict token.
2. Repeat with a malformed commit present (already in the fixture) and assert the gate still skips rather than failing — a skip is not a violation.
3. Run the gate in `FX-ALT-CONFIG`; assert it does **not** skip and exits `1` naming the violated rule (proves the configuration-detection list is not limited to `commitlint.config.js`).

**Expected Outcome**:
- Then a project with no commitlint configuration gets an explicit, reasoned skip with exit success (DM-1.d), and a project configured through an alternate filename is treated as configured (AC-F3-3, DEC-6).

**Notes / Clarifications**: Step 3 is the non-vacuity guard for step 1: without it, a gate that always skips would pass this TC.

#### TC-COMMITLINT-008 - Configured repo without commitlint binary → error naming the tool

**Scenario Type**: Negative
**Impact Level**: Critical
**Priority**: Critical
**Related IDs**: F-3, AC-F3-3, DM-1.g, NFR-2, RSK-2, DEC-6
**Test Type(s)**: Integration
**Automation Level**: Automated
**Target Layer / Location**: `scripts/.tests/test-lint-commit-range.sh` — `test_error_when_binary_unavailable`
**Tags**: @bash, @gate, @fail-closed

**Preconditions**:
- Fixture `FX-CLEAN` (configuration present, valid commits).
- A scrubbed `PATH` containing only the shell builtins' directory and coreutils/git (e.g. `PATH="/usr/local/bin:/usr/bin:/bin"`) with a guard that `command -v commitlint` fails there; no `node_modules/.bin` entry.

**Steps**:
1. Assert the scrub is effective: `PATH="${scrubbed}" command -v commitlint` exits non-zero (precondition guard).
2. Run the gate under `PATH="${scrubbed}"`; capture output and exit code.
3. Assert exit code `2`; assert output contains `ERROR` and the word `commitlint` (the missing tool is named); assert output contains an install remediation hint (a match on `install` or the documented equivalent); assert output contains no `PASS`.
4. Assert a *configured* repository is never reported as `SKIP` here.

**Expected Outcome**:
- Then a configured project with a broken environment fails loudly with the "unable to verify" code and an actionable hint (AC-F3-3, DM-1.g, RSK-2) — never a silent pass.

#### TC-COMMITLINT-009 - Invalid configuration → error, not a violation verdict

**Scenario Type**: Negative
**Impact Level**: Important
**Priority**: Important
**Related IDs**: F-3, AC-F3-5, DM-1.h, NFR-2, DM-1.c distinction
**Test Type(s)**: Integration
**Automation Level**: Automated
**Target Layer / Location**: `scripts/.tests/test-lint-commit-range.sh` — `test_invalid_config_is_error`
**Tags**: @bash, @gate, @fail-closed

**Preconditions**:
- Fixture `FX-BAD-CONFIG`: a temp repository whose `commitlint.config.js` is copied from the committed fixture `commitlint.config.invalid.txt` (invalid JavaScript module text) so the linter cannot render a verdict.

**Steps**:
1. Run the gate with `--base main`; capture output and exit code.
2. Assert exit code `2` and that the output contains `ERROR`.
3. Assert the output does **not** present the failure as a message violation: no `SURGICAL REWORD` / `CONDENSE-TO-ONE` mode line and no rule-id/line-number diagnostic pair.
4. Assert the output carries a remediation hint (a match on `config` plus `install`/`fix`/`valid` wording, or the documented equivalent).
5. Assert the outcome triad of AC-F3-5 explicitly: the output contains no `PASS` token and no `FAIL` violation verdict, only `ERROR` — in both `stdout` and `stderr` (the failing verdict line is mirrored to stderr, spec §10).
6. Repeat steps 1–5 for the **execution-failure** sub-case of AC-F3-5: prepend a shim directory to `PATH` whose `commitlint` executable exits `3` with a transport-free error message and no parseable problems (`fake-commitlint-exec-failure.sh`); assert the gate still reports `ERROR`/exit `2` with a cause and a remediation hint, never `FAIL` with diagnostics and never `PASS`.

**Expected Outcome**:
- Then an unusable configuration is reported as "unable to verify" with its cause, not as a commit-message defect (DM-1.h): an environment fault must not be mistaken for a violation (RSK-2).
- Then the `ERROR`-not-`FAIL`-not-`PASS` triad holds on both streams and for both sub-cases — invalid configuration and execution failure (AC-F3-5), so a caller capturing one stream cannot misread the outcome.

**Notes / Clarifications**: Covered by AC-F3-5 (added by the specification correction). The invalid config fixture is committed as `.txt` and copied to `commitlint.config.js` inside the temp repo so `biome lint`/`format:check` never parse intentionally broken JavaScript; the execution-failure shim is a `.sh` fixture used only through `PATH`, never installed into the repository's `node_modules/.bin`.

#### TC-COMMITLINT-010 - Base resolution precedence and unresolvable base error

**Scenario Type**: Negative / Contract
**Impact Level**: Critical
**Priority**: Critical
**Related IDs**: F-3, AC-F3-2, DM-1.e, DM-1 (base ref + resolution source), DEC-7, RSK-2
**Test Type(s)**: Integration
**Automation Level**: Automated
**Target Layer / Location**: `scripts/.tests/test-lint-commit-range.sh` — `test_base_override_precedence`, `test_configured_base_resolves`, `test_unresolvable_base_override_errors`, `test_unresolvable_configured_base_errors`
**Tags**: @bash, @gate, @precondition

**Preconditions**:
- Fixture `FX-REMOTE-TRACKING`: local branch `main` at SHA `M1`, and `refs/remotes/origin/main` set with `git update-ref` to a different SHA `M2` (no network, no remote configured). Branch range contains one valid commit and one malformed commit.
- Fixture `FX-CONFIG-BASE`: `.ai/agent/pr-instructions.md` containing a `- **Default base branch**: \`integration\`` line, with branch `integration` present.
- Environment override variable as established by the lifecycle (`ADOS_BASE_BRANCH`).

**Steps**:
1. Run with `--base main` while `ADOS_BASE_BRANCH=integration`: assert the report names `main` as the base (explicit override wins) and that the merge-base equals `git merge-base main HEAD`.
2. Run with no `--base` and `ADOS_BASE_BRANCH=main`: assert the report names `main` (environment override) and the same merge-base.
3. Run with no `--base` and no environment override in `FX-CONFIG-BASE`: assert the report names `integration` (project configuration).
4. In `FX-REMOTE-TRACKING`, run with `--base main`: assert the report's resolved base commit is `M2` (remote-tracking ref preferred when it exists) — verified by asserting the reported merge-base equals `git merge-base refs/remotes/origin/main HEAD`, not `git merge-base main HEAD`.
5. Run with `--base no-such-branch` and separately with `ADOS_BASE_BRANCH=no-such-branch`: assert exit code `2`, output contains `ERROR`, the offending ref name, and a remediation hint (a match on `fetch` or `--base` or the documented equivalent); assert no `PASS`.

**Expected Outcome**:
- Then base resolution follows the fixed precedence override → project configuration → documented default, prefers the remote-tracking ref, and any unresolvable base is a loud "unable to verify" (AC-F3-2, DM-1.e, DEC-7).

**Notes / Clarifications**: The exact environment variable and configuration file names are not pinned by the spec; this TC assumes the lifecycle's established `ADOS_BASE_BRANCH` + `pr-instructions.md` semantics (see OQ-2 in §8.3). Update only the variable names if planning pins different ones — the assertions themselves stay.

#### TC-COMMITLINT-011 - Undeterminable merge-base (unrelated and shallow history) errors

**Scenario Type**: Negative
**Impact Level**: Critical
**Priority**: Critical
**Related IDs**: F-3, AC-F3-2, DM-1.f, NFR-2, RSK-2
**Test Type(s)**: Integration
**Automation Level**: Automated
**Target Layer / Location**: `scripts/.tests/test-lint-commit-range.sh` — `test_unrelated_history_errors`, `test_shallow_history_errors`
**Tags**: @bash, @gate, @precondition

**Preconditions**:
- Fixture `FX-UNRELATED`: repository where `git checkout --orphan unrelated` produced a branch with no common ancestor with the feature branch.
- Fixture `FX-SHALLOW`: shallow clone of a local source repository created with `git clone --depth 1 "file://${_test_tmpdir}/src" dest` (local transport only, no network), where the base branch tip is outside the shallow boundary.

**Steps**:
1. In `FX-UNRELATED`, pre-assert `git merge-base HEAD unrelated` exits non-zero.
2. Run the gate with `--base unrelated`; assert exit code `2`, `ERROR` present, a cause statement mentioning the missing common ancestor or merge-base, and a remediation hint; assert no `PASS`.
3. In `FX-SHALLOW`, pre-assert `.git/shallow` exists.
4. Run the gate with the base branch named; assert exit code `2`, `ERROR` present, and a remediation hint (a match on `fetch`/`unshallow`/`depth` or the documented equivalent); assert no `PASS`.

**Expected Outcome**:
- Then an undeterminable merge-base is never treated as an empty range or a pass (AC-F3-2, DM-1.f) — the failure mode most likely to produce a silent pass.

#### TC-COMMITLINT-012 - Usage error, `--help`, and `--version` exit cleanly

**Scenario Type**: Negative / Contract
**Impact Level**: Important
**Priority**: Important
**Related IDs**: F-1 (identity and invocation), AC-F3-6, DM-1.i, NFR-7, bash rules §4/§10.5
**Test Type(s)**: Contract
**Automation Level**: Automated
**Target Layer / Location**: `scripts/.tests/test-lint-commit-range.sh` — `test_unknown_argument_usage_error`, `test_help_and_version`
**Tags**: @bash, @gate, @contract

**Preconditions**: Repository root; script present and executable.

**Steps**:
1. Run `./scripts/lint-commit-range.sh --nonsense`; assert exit code `2`; assert stderr contains `Usage:` and the offending argument.
2. Run with `--base` and no value; assert exit code `2` and a usage message.
3. Run `--help`; assert exit code `0`, stdout contains `Usage:`, the documented invocation, and the three exit codes with their meanings.
4. Run `--version`; assert exit code `0` and a semantic-version-shaped token (assert a match on `^[0-9]+\.[0-9]+\.[0-9]+`).
5. Static assertion over the script text: the only numeric literals passed to `exit` are `0`, `1`, and `2` (assert a `grep -oE 'exit [[:digit:]]+'` result set equals exactly that set).
6. Assert the usage-error output names the **accepted invocation**, not only the word `Usage:`: `--nonsense` and the valueless `--base` runs must both print the documented form (`./scripts/lint-commit-range.sh [--base REF]`) alongside the offending argument (AC-F3-6).
7. Assert **no range check** is performed on a usage error: run the same `--nonsense` invocation with `GIT_TRACE=1` and assert the trace contains no `rev-list`, `merge-base`, `rev-parse`, or `for-each-ref` invocation, and that the output contains no commit count, short SHA, or merge-base line (AC-F3-6).
8. Assert the invalid-base-syntax variant is a usage error, not a base-resolution error: a malformed ref (for example `--base --not-a-ref` or `--base ''`) exits `2` with usage text and no `ERROR` cause/hint block reserved for `DM-1.e`.

**Expected Outcome**:
- Then usage problems are exit `2` with usage text, help/version are exit `0`, and the script cannot leak an undocumented exit code (DM-1.i, NFR-7).
- Then a malformed or unknown argument is rejected before any history is consulted: the output names the accepted invocation and the offending argument, and no range check runs (AC-F3-6).

#### TC-COMMITLINT-013 - Per-commit diagnostic block content and oldest→newest ordering

**Scenario Type**: Negative
**Impact Level**: Critical
**Priority**: High
**Related IDs**: F-2, AC-F1-1, AC-F2-1, DM-2, NFR-1, NFR-10
**Test Type(s)**: Integration
**Automation Level**: Automated
**Target Layer / Location**: `scripts/.tests/test-lint-commit-range.sh` — `test_diagnostics_per_commit_and_ordering`
**Tags**: @bash, @gate, @diagnostics

**Preconditions**:
- Fixture `FX-MULTI` branch `three-offenders`: three commits, in order, each defective in a distinct way — (a) body line over 100 chars, (b) footer line over 100 chars, (c) non-conventional subject (`msg-wip.txt`). Two valid commits interspersed.

**Steps**:
1. Compute the expected order: `git rev-list --reverse "$(git merge-base main HEAD)..HEAD"`.
2. Run the gate; assert exit code `1`.
3. For each offending commit, assert stdout contains `git rev-parse --short "${sha}"` and the full `"${sha}"`, and at least one rule id from `{body-max-line-length, footer-max-line-length, type-empty, subject-empty, type-enum}` with an integer line number (`assert_match 'line[= ]+[0-9]+'`).
4. Assert the positions of the three short SHAs in stdout are strictly increasing in oldest→newest order (record `grep -n` offsets, compare numerically).
5. Assert each offending commit has exactly one block header (count `FAIL` occurrences equals the offender count) and that valid commits are never named.
6. Assert the summary counts: commits in range, offending commits (`3`), and distinct rules hit (≥2).

**Expected Outcome**:
- Then every offender gets exactly one attributed block with short SHA, full SHA, rule id, line number and a bounded excerpt, ordered oldest→newest deterministically (AC-F2-1, DM-2, NFR-10).

#### TC-COMMITLINT-014 - Repeated runs are byte-identical (determinism)

**Scenario Type**: Regression / Edge Case
**Impact Level**: Important
**Priority**: Important
**Related IDs**: NFR-1, AC-F2-1
**Test Type(s)**: Integration
**Automation Level**: Automated
**Target Layer / Location**: `scripts/.tests/test-lint-commit-range.sh` — `test_determinism_repeated_runs`
**Tags**: @bash, @gate, @determinism

**Preconditions**: Fixture `FX-MULTI` branch `three-offenders`; environment pinned (`LC_ALL=C`, `TZ=UTC`).

**Steps**:
1. Run the gate three times, capturing each stdout to separate files and each exit code.
2. Assert all three exit codes are `1`.
3. Assert `cmp -s run1.out run2.out` and `cmp -s run2.out run3.out` succeed (byte-identical).
4. Assert ordering stability by comparing `grep -n` offsets across runs.

**Expected Outcome**:
- Then the same range, configuration and tool version produce identical diagnostics and the same exit code (NFR-1: 0 variance).

**Notes / Clarifications**: This TC assumes the report carries no timestamps or durations; if delivery planning adds them, they must go to a verbose-only channel so the default verdict stays stable (see §8.2).

#### TC-COMMITLINT-015 - Diagnostic output is bounded

**Scenario Type**: Corner Case
**Impact Level**: Important
**Priority**: Important
**Related IDs**: F-2, AC-NFR6-1, NFR-6, DM-2
**Test Type(s)**: Integration
**Automation Level**: Automated
**Target Layer / Location**: `scripts/.tests/test-lint-commit-range.sh` — `test_output_is_bounded`
**Tags**: @bash, @gate, @bounded-output

**Preconditions**:
- Fixture `FX-MANY-VIOLATIONS`: one commit whose body has 30 lines of 200 characters each (30 violations in a single commit), plus a second commit with a non-conventional subject.

**Steps**:
1. Run the gate; assert exit code `1`; assert exactly `2` offender blocks (per-commit counting).
2. Assert the rule lines attributable to the first commit are ≤20 (count lines matching `line[= ]+[0-9]+` between the first and second block headers).
3. Assert the total diagnostic line count is ≤200 (`wc -l`).
4. Assert every excerpt is ≤160 characters: extract the text after the last ` · ` separator on diagnostic lines and assert `awk` length ≤160.
5. Assert the **summary is still informative** under bounding (AC-NFR6-1): the summary block reports the offending-commit count (`2`) and the distinct-rules-hit count (≥2), so truncation never destroys the aggregate verdict.
6. Assert the bound applies per commit, not only in total: for each block, count rule lines between consecutive block headers and assert each count is ≤20 (the first commit is the pathological one; the second must also satisfy the bound).

**Expected Outcome**:
- Then a pathological commit cannot flood a log: ≤20 rule lines per commit, ≤200 diagnostic lines total, excerpt ≤160 characters (NFR-6), while still naming the commit (NFR-10).
- Then bounding does not cost the aggregate signal: the summary still reports the offending-commit count and the distinct rules hit (AC-NFR6-1).

**Notes / Clarifications**: Exact template separators are not pinned by the spec (OQ-3). If the implementation uses a different separator, adapt the extraction only — the bounds are the contract.

#### TC-COMMITLINT-016 - Remediation mode thresholds: 1, 2, ≥3 offenders

**Scenario Type**: Edge Case
**Impact Level**: Critical
**Priority**: High
**Related IDs**: F-2, AC-F2-2, DM-3, DEC-9, NFR-5
**Test Type(s)**: Integration
**Automation Level**: Automated
**Target Layer / Location**: `scripts/.tests/test-lint-commit-range.sh` — `test_mode_surgical_one`, `test_mode_surgical_two`, `test_mode_condense_three`
**Tags**: @bash, @gate, @remediation

**Preconditions**:
- Fixture `FX-MULTI` branches `one-offender`, `two-offenders`, `three-offenders` (each offender a distinct commit; other commits valid).

**Steps**:
1. Run the gate on `one-offender`; assert exit `1`, `SURGICAL REWORD` present, `CONDENSE-TO-ONE` absent.
2. Run on `two-offenders`; assert exit `1`, `SURGICAL REWORD` present, `CONDENSE-TO-ONE` absent, reported offender count `2`.
3. Run on `three-offenders`; assert exit `1`, `CONDENSE-TO-ONE` present, `SURGICAL REWORD` absent, reported offender count `3`.
4. After all three runs, assert the branch SHAs of the fixture are unchanged (`git rev-parse HEAD` before/after) — the mode line is advisory only and performs no rewrite.

**Expected Outcome**:
- Then 1–2 offenders name `SURGICAL REWORD`, ≥3 name `CONDENSE-TO-ONE`, offenders are counted per commit, and nothing is rewritten (AC-F2-2, DM-3, DEC-9, NFR-5).

#### TC-COMMITLINT-017 - Offenders counted per commit, not per violation

**Scenario Type**: Corner Case
**Impact Level**: Important
**Priority**: High
**Related IDs**: F-2, AC-F2-2, DM-3
**Test Type(s)**: Integration
**Automation Level**: Automated
**Target Layer / Location**: `scripts/.tests/test-lint-commit-range.sh` — `test_offender_count_per_commit`
**Tags**: @bash, @gate, @remediation

**Preconditions**:
- Fixture `FX-MULTI` branch `two-commits-many-violations`: two offending commits, the first breaking three rules (non-conventional subject plus over-long body and footer lines), the second breaking one.

**Steps**:
1. Run the gate; assert exit code `1`.
2. Assert the reported offender count is `2` and the reported distinct-rule count is ≥3 (proving the two counters are independent).
3. Assert `SURGICAL REWORD` is named (2 offenders, not 4 violations) and `CONDENSE-TO-ONE` is absent.

**Expected Outcome**:
- Then a single commit with three bad lines counts once, so a single multi-rule commit never triggers condense-to-one (AC-F2-2, DM-3, DEC-9).

#### TC-COMMITLINT-018 - Read-only across every terminal outcome

**Scenario Type**: Negative / Contract
**Impact Level**: Critical
**Priority**: Critical
**Related IDs**: F-1, F-3, AC-F3-4, NFR-5, DEC-7
**Test Type(s)**: Integration
**Automation Level**: Automated
**Target Layer / Location**: `scripts/.tests/test-lint-commit-range.sh` — `test_read_only_all_outcomes`
**Tags**: @bash, @gate, @read-only

**Preconditions**: Fixtures for all four outcome classes: `FX-CLEAN` (pass), `FX-BAD-BODY` (fail), `FX-NO-CONFIG` (skip), `FX-CLEAN` with scrubbed `PATH` (error).

**Steps**:
1. Implement the snapshot helper in the suite: `_repo_state()` prints, for one repository, (a) `git status --porcelain=v1 -z`, (b) `git for-each-ref --format='%(refname) %(objectname)' | LC_ALL=C sort`, (c) `sha256sum .git/index` (or `git ls-files -s` as a content-level index digest), (d) `git stash list`, (e) `git rev-parse HEAD`, (f) `git diff --stat` — each stage hashed into one digest.
2. For each of the four outcome fixtures: capture `_repo_state` before, run the gate, capture `_repo_state` after, assert the digests are equal.
3. Assert no new file appears anywhere in the fixture (compare a sorted `find . -path ./.git -prune -o -type f -print` listing before/after).
4. Assert the reported `HEAD` SHA equals the pre-run `HEAD` SHA and that `git fsck --no-progress --connectivity-only` still exits `0` (no ref corruption).

**Expected Outcome**:
- Then the gate mutates nothing — no working-tree, index, ref, or stash change and no created files — on pass, fail, skip, and error paths alike (AC-F3-4, NFR-5).

#### TC-COMMITLINT-019 - No network access on any path

**Scenario Type**: Negative / Contract
**Impact Level**: Critical
**Priority**: Critical
**Related IDs**: F-1, F-3, AC-F3-4, AC-NFR4-1, NFR-4, DEC-7, spec §8.1, §21
**Test Type(s)**: Integration
**Automation Level**: Automated
**Target Layer / Location**: `scripts/.tests/test-lint-commit-range.sh` — `test_no_network_access`
**Tags**: @bash, @gate, @no-network

**Preconditions**:
- Fixture `FX-CLEAN`; a poison-bin directory containing executable shims named `curl`, `wget`, `ssh`, `scp`, `nc`, `git-remote-https`, `git-remote-http` that each `printf '%s\n' "$0" >> "${NETWORK_MARKER}"` and exit `1`.

**Steps** (three independent assertions; all three must hold):
1. **Static guard.** `grep -nE '(^|[[:space:];|&(])(curl|wget|nc|ssh|scp|git[[:space:]]+(fetch|pull|push|clone|ls-remote|remote[[:space:]]+update))([[:space:]]|$)' scripts/lint-commit-range.sh` returns no executable line; any occurrence inside a quoted remediation-hint string is allowed only when the same line is a `printf`/heredoc hint (assert the match is not a command position). Record the exact grep and its output as evidence.
2. **Poison-path run.** Run the gate with `PATH="${poison_bin}:${REPO_ROOT}/node_modules/.bin:${PATH}"`, `NETWORK_MARKER` pointing at a temp file, `GIT_TERMINAL_PROMPT=0`, `GIT_ASKPASS=/bin/false`; assert exit code `0` and that `NETWORK_MARKER` does not exist (no shim executed). Repeat for the fail and error fixtures.
3. **Git trace scan.** Run the gate with `GIT_TRACE=1 GIT_TRACE2_EVENT=""`; assert the trace contains no line matching the transport alternation `fetch`, `push`, `ls-remote`, `clone`, or `git-remote-*`.

**Expected Outcome**:
- Then no invocation touches the network: no network tool is executed, and git performs no transport operation (AC-F3-4, AC-NFR4-1 zero-network clause, NFR-4, DEC-7).

**Notes / Clarifications**: The remediation hint for an unfetched base legitimately *mentions* `git fetch`; assertion 1 must distinguish a printed hint from an executed command — the recommended implementation keeps hints inside quoted strings passed to a logger.

#### TC-COMMITLINT-020 - Exit-code matrix is exactly 0 / 1 / 2

**Scenario Type**: Contract
**Impact Level**: Critical
**Priority**: Critical
**Related IDs**: F-3, AC-F3-4, DM-1.a–i, NFR-2, NFR-7
**Test Type(s)**: Contract
**Automation Level**: Automated
**Target Layer / Location**: `scripts/.tests/test-lint-commit-range.sh` — `test_exit_code_matrix`
**Tags**: @bash, @gate, @contract

**Preconditions**: All precondition fixtures from §6.

**Steps**:
1. Run a table-driven matrix over every DM-1 row and record `actual_exit`: a→`0` (`FX-CLEAN`), b→`0` (`FX-EMPTY`), c→`1` (`FX-BAD-BODY`), d→`0` (`FX-NO-CONFIG`), e→`2` (unresolvable `--base`), f→`2` (`FX-UNRELATED`), g→`2` (scrubbed `PATH`), h→`2` (`FX-BAD-CONFIG`), i→`2` (`--nonsense`).
2. Assert every row matches and that the collected set of observed codes is exactly `{0,1,2}`.
3. For the failing and error rows, assert the verdict line appears on **both** stdout and stderr (spec §10: the failing side's signal is on stderr too).
4. Assert `0` and `2` rows never emit a `FAIL` violation verdict, and `1` rows never emit `PASS`.

**Expected Outcome**:
- Then exactly three codes with fixed meanings are observed, every terminal condition maps to one row, and no outcome is a silent pass (AC-F3-4, DM-1, NFR-2, NFR-7).

#### TC-COMMITLINT-021 - Runtime budget for a 20-commit range

**Scenario Type**: Performance
**Impact Level**: Minor
**Priority**: Low
**Related IDs**: F-1, F-3, AC-NFR4-1, NFR-4, RSK-4
**Test Type(s)**: Performance
**Automation Level**: Automated
**Target Layer / Location**: `scripts/.tests/test-lint-commit-range.sh` — `test_runtime_budget_20_commits`, `test_runtime_budget_100_commits`
**Tags**: @bash, @gate, @perf

**Preconditions**: Fixture `FX-20`: 20 valid conventional commits on the feature branch; fixture `FX-100`: 100 valid conventional commits on the feature branch; real commitlint binary available.

**Steps**:
1. Record `start=$SECONDS` (or `date +%s%N`) immediately before the run.
2. Run the gate with `--base main`; record elapsed time and exit code `0`.
3. Assert elapsed ≤10 seconds.
4. Guard non-vacuity: assert the reported commit count is `20`.
5. Repeat steps 1–4 on `FX-100`, asserting the reported commit count is `100` and the elapsed time is ≤60 seconds (AC-NFR4-1 second budget).
6. Assert the zero-network clause of AC-NFR4-1 on the reference runs: the same invocation completes with the poison-`PATH` shims in place and `NETWORK_MARKER` absent, and the `GIT_TRACE` capture shows no transport verb (`TC-COMMITLINT-019` owns the full no-network assertion; this step ties it to the timed reference runs).

**Expected Outcome**:
- Then a ≤20-commit range completes within the 10-second budget on a developer machine (NFR-4).
- Then the ≤100-commit range completes within the 60-second budget, and neither timed run performs a network call (AC-NFR4-1).

**Notes / Clarifications**: Coarse budget, not a benchmark; a loaded CI runner can approach it. If it flakes, raise the *measurement* margin in the harness (e.g. assert ≤10 s three-times-median), never the spec threshold (see §8.1).

#### TC-PROMPT-001 - Committer prompt states the full message contract

**Scenario Type**: Happy Path
**Impact Level**: High
**Priority**: High
**Related IDs**: F-4, AC-F4-1, G-4, NFR-9
**Test Type(s)**: Manual
**Automation Level**: Semi-automated
**Target Layer / Location**: `.opencode/agent/committer.md`; evidence via `grep -niE` recorded in the plan/pm-notes
**Tags**: @prompt, @contract

**Preconditions**: Committer prompt updated by the change.

**Steps**:
1. Read `.opencode/agent/committer.md` end to end.
2. Assert it states the **subject** rule: a conventional header that carries the work item reference (assert text matches a conventional-header shape such as a `type(scope): summary` header and contains the work-item reference requirement).
3. Assert it states the **line-length** rule: body and footer lines stay within 100 characters (assert a match on `100`).
4. Assert it states the **merge** rule: a sync must not leave a plain `Merge remote-tracking branch ...` subject; a sync carries a conventional subject or is integrated without a merge commit (assert the literal `Merge remote-tracking branch` appears in a prohibiting sentence).
5. Assert it states **both remediation modes**: surgical reword for one or two offenders and condense-to-one for many (assert both `SURGICAL REWORD` and `CONDENSE-TO-ONE`, or their prose equivalents, appear).
6. Assert the statements are constraints on the artifact, not recipes: no raw write command is taught (see `TC-PROMPT-003`).
7. Record the four grep commands and their hits as phase evidence.

**Expected Outcome**:
- Then an agent reading only the committer prompt can comply with the contract before committing (AC-F4-1, G-4).

#### TC-PROMPT-002 - PM `quality_gates` requires the gate, loops, and records evidence

**Scenario Type**: Happy Path
**Impact Level**: Critical
**Priority**: Critical
**Related IDs**: F-6, AC-F6-1, F-4, AC-F4-1, G-1, NFR-2, DEC-8
**Test Type(s)**: Manual
**Automation Level**: Semi-automated
**Target Layer / Location**: `.opencode/agent/pm.md` — `quality_gates` step (current text: step 9, "Run builds/tests via `@runner`; fix via `@fixer` if needed")
**Tags**: @prompt, @lifecycle

**Preconditions**: PM prompt updated by the change.

**Steps**:
1. Locate the `quality_gates` step in `.opencode/agent/pm.md` and assert it names the range lint explicitly (`lint-commit-range` or the documented invocation `./scripts/lint-commit-range.sh`).
2. Assert the step requires the lint **before the phase may be completed** (assert a sentence coupling the lint to `phase complete GH-268 quality_gates`).
3. Assert the remediation loop is stated: a violation is remediated in the named mode (`SURGICAL REWORD` / `CONDENSE-TO-ONE`) and the gate is re-run.
4. Assert the never-waive rule: an unresolved "unable to verify"/ERROR outcome is never recorded as a pass and blocks phase completion (assert a sentence containing `unable to verify` or `ERROR` together with `never`/`must not`/`blocks`).
5. Assert the evidence requirement: the verdict (outcome, commit count, offender count, and mode when failing) is recorded as a PM-notes evidence entry (assert a sentence naming `pm-notes` or `notes:`).
6. Assert the skill/rules aren't contradicted: the step still routes build/test/lint through `@runner` and fixes through `@fixer`, so no delivery-semantics change is implied (NFR-8).

**Expected Outcome**:
- Then the phase cannot complete on an unresolved error, and the completion claim is inspectable later (AC-F6-1, F-6, DEC-8).

#### TC-PROMPT-003 - Contract is constraints, not raw git recipes; conformance green

**Scenario Type**: Negative / Regression
**Impact Level**: Critical
**Priority**: Critical
**Related IDs**: F-4, AC-F4-1, NFR-9, RSK-5, prompt-conformance rules
**Test Type(s)**: Static check
**Automation Level**: Automated
**Target Layer / Location**: `scripts/checks/prompt-conformance.ts`, `tests/fixtures/prompt-inventory/lifecycle.json`, `.opencode/agent/committer.md`, `.opencode/agent/pm.md`
**Tags**: @conformance, @prompt

**Preconditions**: Prompt edits applied.

**Steps**:
1. Run `bun run scripts/checks/prompt-conformance.ts` (equivalently `pnpm check:prompt`); assert exit `0` and no finding lines on stderr.
2. Assert the committer inventory entry's forbidden literals still hold: `.opencode/agent/committer.md` contains no `git add` and no `git commit` (the inventory already pins these; a raw-write recipe would fail step 1).
3. Assert the contract addition itself teaches no write command: `grep -nE '\bgit[[:space:]]+(rebase|reset|commit[[:space:]]+--amend|push[[:space:]]+--force|filter-branch|reflog[[:space:]]+delete)' .opencode/agent/committer.md .opencode/agent/pm.md` returns no line outside a negation sentence.
4. Assert the PM step does not hand-edit phase state and still uses `phase complete` (assert `phase complete` present, assert no timestamp/`completed_at` edit instruction).

**Expected Outcome**:
- Then the contract is stated as artifact constraints and the conformance scan stays green, so a hardening change does not turn the aggregate gate red (AC-F4-1, NFR-9, RSK-5).

#### TC-PROMPT-004 - Resume-sync emits a conventional-subject sync merge

**Scenario Type**: Happy Path
**Impact Level**: High
**Priority**: High
**Related IDs**: F-5, AC-F5-1, G-5, DEC-5
**Test Type(s)**: Integration
**Automation Level**: Automated
**Target Layer / Location**: `scripts/.tests/test-deliver-ticket.sh` — updated `test_prompt_merge_main_on_resume` (current assertion: `assert_contains "${prompt}" "git merge origin/main"` at line ~1001); `scripts/deliver-ticket.sh` — `build_delivery_prompt` "Resume Sync" block (currently `git fetch origin ${base_branch}` / `git merge origin/${base_branch}`)
**Tags**: @bash, @prompt, @autonomous-delivery

**Preconditions**: Prompt builder and its suite updated together (spec §22 coupling rule).

**Steps**:
1. In the suite, set `ADOS_BASE_BRANCH="main"` and call `build_delivery_prompt "GH-268" "feat/test-branch"`.
2. Extract every line matching `^[[:space:]]*git merge` from the prompt.
3. Assert exactly one merge line exists, and that it contains a `-m` (or `--message`) with a conventional subject referencing the work item: `assert_match ' git merge .*-m [^|]*(chore|build|ci)\(GH-268\)' "${line}"`.
4. Assert no bare merge remains: `printf '%s' "${prompt}" | grep -cE 'git merge[[:space:]]+origin/[^[:space:]]+[[:space:]]*$'` equals `0`.
5. Assert the fetch instruction is preserved (`assert_contains "${prompt}" "git fetch origin main"`).

**Expected Outcome**:
- Then the emitted instruction produces a sync merge whose subject is conventional and references the work item, instead of a plain merge subject (AC-F5-1, G-5).

**Notes / Clarifications**: The exact conventional type (`chore`/`build`/`ci`) is an implementation choice; the assertion accepts the documented set. If planning pins one type, narrow the regex to it.

#### TC-PROMPT-005 - Resume-sync assertion matches the new instruction (strength-probed)

**Scenario Type**: Regression
**Impact Level**: High
**Priority**: High
**Related IDs**: F-5, AC-F5-1, DEC-5
**Test Type(s)**: Integration
**Automation Level**: Automated
**Target Layer / Location**: `scripts/.tests/test-deliver-ticket.sh` — `test_prompt_merge_main_on_resume`
**Tags**: @bash, @prompt, @test-the-test

**Preconditions**: `TC-PROMPT-004` fixture state.

**Steps**:
1. Run `bash scripts/.tests/test-deliver-ticket.sh`; assert exit `0` and that the summary reports all tests passed.
2. Assert the suite's assertion text was actually updated: `grep -n 'git merge' scripts/.tests/test-deliver-ticket.sh` shows the new shape (a `-m`/conventional-subject assertion and a negative assertion for the bare form).
3. **Assertion-strength probe** (safe, no delivery-tree mutation): copy the repository to `"${_test_tmpdir}/repo-copy"` with `cp -a`, revert the merge instruction in the copy to the bare form (`sed -i 's#git merge --no-ff origin/main -m .*#git merge origin/main#' "${copy}/scripts/deliver-ticket.sh"`), run the suite from the copy, and assert it **fails**.
4. Delete the copy; assert the delivery tree is unchanged (`git status --porcelain` empty).

**Expected Outcome**:
- Then the assertion test matches the new instruction and is proven non-vacuous: reverting the instruction makes the suite red (AC-F5-1).

**Notes / Clarifications**: The probe mutates only a throwaway copy — never the delivery branch — and is the only way to show the assertion has teeth.

#### TC-PROMPT-006 - No other prompt section changes meaning

**Scenario Type**: Regression
**Impact Level**: Important
**Priority**: Important
**Related IDs**: F-5, AC-F5-1, NFR-8
**Test Type(s)**: Regression
**Automation Level**: Automated
**Target Layer / Location**: `scripts/.tests/test-deliver-ticket.sh` (full suite), plus a review of the prompt diff
**Tags**: @bash, @prompt, @regression

**Preconditions**: Prompt changed only in the Resume Sync / quality-gates instruction text.

**Steps**:
1. Run `bash scripts/.tests/test-deliver-ticket.sh`; assert exit `0` (single-ticket rule, 11-phase reference, no-auto-merge, result classification, liveness tests all stay green).
2. Review the prompt diff: assert the changed hunks are confined to the Resume Sync instruction and the quality-gates instruction; assert no change to state detection, PR-open handling, merge-authority, or result-classification text.
3. Assert delivery orchestration is untouched: `git diff --stat -- scripts/deliver-ticket.sh` touches no function outside `build_delivery_prompt` (record the diffstat as evidence).

**Expected Outcome**:
- Then only the instruction shape changes; delivery orchestration, single-flight, liveness and result classification keep their meaning (AC-F5-1, NFR-8).

#### TC-DOC-001 - `AGENTS.md` states a supplementary pre-PR gate; `/check` unchanged

**Scenario Type**: Happy Path
**Impact Level**: High
**Priority**: High
**Related IDs**: F-6, F-8, AC-F6-2, NFR-8, DEC-8
**Test Type(s)**: Static check
**Automation Level**: Semi-automated
**Target Layer / Location**: `AGENTS.md` (delivery process table, Commands table, delivery-infrastructure notes)
**Tags**: @docs, @process

**Preconditions**: `AGENTS.md` updated.

**Steps**:
1. Assert `AGENTS.md` mentions the gate (`grep -n 'lint-commit-range' AGENTS.md` returns ≥1 line) and that the sentence also qualifies it as a lifecycle/supplementary pre-PR gate (assert the same line or its sentence contains `supplementary`, `pre-PR`, or `lifecycle`).
2. Assert the gate is placed in the `quality_gates` context, not the general quality-gates command context: the mention must not appear in the `/check` or `/check-fix` row.
3. Assert `/check` and `/check-fix` rows are unchanged in meaning: `AGENTS.md` still contains `| /check | Run quality gates (no fixes) |` and `| /check-fix | Run quality gates and fix failures |`.
4. Assert no new "run all quality gates" instruction was introduced: no line instructs running a repository-wide gates script for this purpose (assert no `scripts/quality-gates.sh` mention, and that `pnpm check` is still described as the aggregate working-tree gate).
5. Assert the distribution-registration note still holds (delivery scripts registered in `ADOS_DELIVERY_SCRIPTS`) and now covers the gate.

**Expected Outcome**:
- Then a reader learns the gate's lifecycle placement without any change to `/check`'s resolution contract or behaviour (AC-F6-2, DEC-8).

#### TC-DOC-002 - Quality-gates/PR page describes gate and contract

**Scenario Type**: Happy Path
**Impact Level**: High
**Priority**: High
**Related IDs**: F-8, AC-F8-1, Appendix C row 1
**Test Type(s)**: Manual
**Automation Level**: Manual
**Target Layer / Location**: `doc/spec/features/feature-quality-gates-and-pr.md`
**Tags**: @docs, @spec

**Preconditions**: Doc-syncer reconciliation complete (or delivery-phase edit, per Appendix C).

**Steps**:
1. Assert the page describes the branch-range pre-PR gate: purpose, invocation (`./scripts/lint-commit-range.sh [--base REF]`, where REF is a git ref), exit contract (0/1/2, with skip on 0), and its relationship to the CI authority (mirror, not replacement) — matching the delivered script's `--help`.
2. Assert it states the committer contract: conventional subject with work-item reference, body/footer lines ≤100 characters, no plain merge subject, both remediation modes.
3. Assert it does not claim the gate rejects plain merge subjects (would contradict DEC-4/`TC-COMMITLINT-004`).
4. Assert front matter keeps `ados_distribution: internal` and `status: Current`, and `last_updated` moves to the change date.

**Expected Outcome**:
- Then the feature page states what was delivered, and no statement contradicts the gate's measured behaviour (AC-F8-1).

#### TC-DOC-003 - Autonomous-delivery page reflects the instruction shape

**Scenario Type**: Happy Path
**Impact Level**: Important
**Priority**: Important
**Related IDs**: F-8, F-5, AC-F8-1, Appendix C row 2
**Test Type(s)**: Manual
**Automation Level**: Manual
**Target Layer / Location**: `doc/spec/features/feature-autonomous-delivery.md`
**Tags**: @docs, @spec

**Preconditions**: Prompt change delivered.

**Steps**:
1. Assert the page states that the resume-sync step produces a conventional-subject sync merge referencing the work item (and no longer a plain merge subject).
2. Assert it still states `deliver-ticket.sh` does not merge to the base branch and that merge authority is unchanged (no contradiction with the existing invariants).
3. Assert `ados_distribution: internal` retained and `related_changes` gains `GH-268`.

**Expected Outcome**:
- Then the page's summary of the delivery prompt matches the emitted prompt text verified by `TC-PROMPT-004` (AC-F8-1).

#### TC-DOC-004 - Change-lifecycle `quality_gates` names the range lint

**Scenario Type**: Happy Path
**Impact Level**: High
**Priority**: High
**Related IDs**: F-6, F-8, AC-F8-1, Appendix C row 4
**Test Type(s)**: Manual
**Automation Level**: Semi-automated
**Target Layer / Location**: `doc/guides/change-lifecycle.md` §9 `quality_gates` (Actions + Exit criteria)
**Tags**: @docs, @guide

**Preconditions**: Guide updated.

**Steps**:
1. Assert §9's **Actions** name the range lint explicitly (`grep -n 'lint-commit-range' doc/guides/change-lifecycle.md` returns a line inside the `quality_gates` section).
2. Assert §9's **Exit criteria** add the range-lint condition (a clean range verdict, or a recorded skip for a repository without commitlint configuration).
3. Assert the never-waive rule is stated: an unresolved unable-to-verify outcome is not a pass.
4. Assert the phase's owner (`@pm` → `@runner` → `@fixer`) and the diagram are unchanged in meaning; `ados_distribution: redistributable` retained.

**Expected Outcome**:
- Then the guide's phase description matches the wiring the PM prompt mandates (AC-F8-1, F-6).

#### TC-DOC-005 - Scaffold toolchain page keeps "CI is the authority", adds mirror

**Scenario Type**: Edge Case
**Impact Level**: Important
**Priority**: Important
**Related IDs**: F-8, AC-F8-1, Appendix C row 3, DEC-1, DEC-4
**Test Type(s)**: Manual
**Automation Level**: Manual
**Target Layer / Location**: `doc/spec/features/feature-monorepo-scaffold-toolchain.md` — the commitlint authority statement
**Tags**: @docs, @spec, @parity

**Preconditions**: Doc-syncer reconciliation complete.

**Steps**:
1. Assert the page still states that CI commitlint is the authority (assert the authority sentence survives; no "replaced by" wording).
2. Assert it names the local pre-PR range gate as a mirror of that authority.
3. Assert `bun run scripts/checks/commitlint-authority.ts` still exits `0` after the edit (the page edit must not touch the config or workflow the invariant pins).

**Expected Outcome**:
- Then "CI commitlint is the authority" stays true and the mirror relationship is documented (AC-F8-1, DEC-1).

#### TC-DOC-006 - Distribution markers kept; doc-distribution guard green

**Scenario Type**: Regression
**Impact Level**: Critical
**Priority**: Critical
**Related IDs**: F-8, AC-F8-1, NFR-9, Appendix C row 8, `ados_distribution` policy
**Test Type(s)**: Static check
**Automation Level**: Automated
**Target Layer / Location**: `doc/spec/features/*`, `doc/guides/change-lifecycle.md`, `AGENTS.md`; `scripts/.tests/test-doc-distribution.sh`
**Tags**: @docs, @conformance, @distribution

**Preconditions**: All doc edits applied.

**Steps**:
1. Assert every touched `doc/**` file still carries an `ados_distribution` marker with a valid enum value (`redistributable` | `internal` | `project-generated`); assert no new marker block was added outside existing front matter.
2. Assert no new documentation area was created (no new top-level folder under `doc/`), so no new marker class is introduced.
3. Run `bash scripts/.tests/test-doc-distribution.sh`; assert exit `0` with no `::error::` lines.
4. Assert `AGENTS.md` (non-distributed root doc) was not given a marker (it has none today).

**Expected Outcome**:
- Then the doc-distribution guard stays green and every touched doc keeps its existing distribution class (AC-F8-1, NFR-9).

#### TC-DOC-007 - Aggregate conformance battery green

**Scenario Type**: Regression
**Impact Level**: Critical
**Priority**: Critical
**Related IDs**: F-8, AC-F8-1, NFR-9, RSK-5, AGENTS.md `pnpm check` definition
**Test Type(s)**: Static check
**Automation Level**: Automated
**Target Layer / Location**: repo root — `pnpm check` and its members
**Tags**: @conformance, @aggregate

**Preconditions**: All change files applied; dependencies installed; `pnpm build` done (implicitly, `pretest`).

**Steps**:
1. Run `bun test tests/checks/doc-conformance.test.ts`; assert exit `0` (current-truth phrase table still satisfied).
2. Run `bun run scripts/checks/prompt-conformance.ts` (`pnpm check:prompt`); assert exit `0`.
3. Run `bun run scripts/checks/help-guide-coverage.ts` (`pnpm check:help`); assert exit `0` (the new script is not a prompt-required CLI command; the inventory must not gain a bogus entry).
4. Run `bash scripts/.tests/test-doc-distribution.sh`; assert exit `0`.
5. Run `pnpm check`; assert exit `0` end to end (lint, format:check, typecheck, test — including `bash`-adjacent TS suites —, check:boundaries, prompt-conformance, help-guide-coverage, exports-parity).
6. Assert `git diff --check` exits `0` (no whitespace/conflict markers in the change).

**Expected Outcome**:
- Then no new conformance violation appears and the aggregate local gate is green against the edited prompts, scripts, and docs (AC-F8-1, NFR-9).

**Notes / Clarifications**: `pnpm check` does **not** include the new gate by design (NG-5, DEC-8); `TC-CONFINE-002` asserts that.

#### TC-DIST-001 - Gate is registered and installed executable

**Scenario Type**: Happy Path
**Impact Level**: Critical
**Priority**: Critical
**Related IDs**: F-7, AC-F7-1, DEC-6, Appendix C row 7
**Test Type(s)**: Integration
**Automation Level**: Automated
**Target Layer / Location**: `scripts/install.sh` — `ADOS_DELIVERY_SCRIPTS` (currently `opencode-session.sh`, `deliver-ticket.sh`, `scripts/lib/dispatch-authority.sh`, `batch-deliver.sh`, `ceo-loop.sh`, `pm-liveness.sh`); `scripts/.tests/test-install.sh`
**Tags**: @installer, @distribution

**Preconditions**: Installer test sandbox source tree (existing `test-install.sh` fixture pattern).

**Steps**:
1. Static assertion: `ADOS_DELIVERY_SCRIPTS` in `scripts/install.sh` contains `"scripts/lint-commit-range.sh"` (assert the literal inside the array block).
2. In the suite, run `install_local_files "${source_dir}"` against a temp project and assert `scripts/lint-commit-range.sh` exists and is executable (`[[ -x ... ]]`).
3. Assert the installed file is byte-identical to the source (`cmp -s`), matching the `copy_updatable_file` (always-track-upstream) contract.
4. Assert a re-install updates a locally modified installed copy (updatable-file semantics), consistent with the other delivery scripts.

**Expected Outcome**:
- Then an adopting project receives the gate with the other delivery scripts and it is runnable (AC-F7-1, F-7).

#### TC-DIST-002 - Gate is removed on uninstall

**Scenario Type**: Negative (lifecycle) / Happy Path
**Impact Level**: High
**Priority**: High
**Related IDs**: F-7, AC-F7-1
**Test Type(s)**: Integration
**Automation Level**: Automated
**Target Layer / Location**: `scripts/uninstall.sh` — the unconditional delivery-script removal list (currently at ~line 428); `scripts/.tests/test-uninstall.sh`
**Tags**: @installer, @distribution

**Preconditions**: Installed sandbox project containing the gate.

**Steps**:
1. Static assertion: the uninstall delivery-file list contains `"scripts/lint-commit-range.sh"`.
2. In the suite, install into a temp project, then run the local uninstall path; assert `scripts/lint-commit-range.sh` is removed (`assert_file_not_exists`).
3. Assert an unrelated user file under `scripts/` survives (no over-broad removal), and that the empty-directory cleanup still behaves.
4. Assert `--dry-run` uninstall reports the gate but does not remove it.

**Expected Outcome**:
- Then the gate is removed on uninstall without collateral removal, and dry-run remains non-destructive (AC-F7-1).

#### TC-DIST-003 - Installer/uninstaller suites pass with the gate registered

**Scenario Type**: Regression
**Impact Level**: High
**Priority**: High
**Related IDs**: F-7, AC-F7-1, NFR-9
**Test Type(s)**: Regression
**Automation Level**: Automated
**Target Layer / Location**: `scripts/.tests/test-install.sh`, `scripts/.tests/test-uninstall.sh`
**Tags**: @installer, @regression

**Preconditions**: Registry edits applied.

**Steps**:
1. Run `bash scripts/.tests/test-install.sh`; assert exit `0` and all-passed summary.
2. Run `bash scripts/.tests/test-uninstall.sh`; assert exit `0` and all-passed summary.
3. Run `bash scripts/.tests/test-doc-distribution.sh`; assert exit `0` (the install set drift guard derives membership from markers plus the delivery arrays).

**Expected Outcome**:
- Then both suites pass with the gate registered, and the derived install-set guard stays green (AC-F7-1).

#### TC-CONFINE-001 - PR-time diff contains only in-scope files

**Scenario Type**: Negative (scope) / Contract
**Impact Level**: Critical
**Priority**: Critical
**Related IDs**: NFR-8, AC-NFR8-1, NG-1…NG-6, RSK-7, DEC-2, DEC-3, DEC-5, DEC-8
**Test Type(s)**: Manual
**Automation Level**: Manual
**Target Layer / Location**: PR diff at review time (`@reviewer`), evidence recorded in the review verdict / pm-notes
**Tags**: @review, @confinement

**Preconditions**: Delivery complete; base branch resolvable locally.

**Steps**:
1. Run `git diff --name-only "$(git merge-base main-tools HEAD)"...HEAD` and classify every path against the allowlist: `scripts/lint-commit-range.sh`, `scripts/.tests/test-lint-commit-range.sh` (+ its fixtures), `scripts/deliver-ticket.sh`, `scripts/.tests/test-deliver-ticket.sh`, `scripts/install.sh`, `scripts/uninstall.sh`, `scripts/.tests/test-install.sh`, `scripts/.tests/test-uninstall.sh`, `.opencode/agent/committer.md`, `.opencode/agent/pm.md`, `AGENTS.md`, `doc/guides/change-lifecycle.md`, `doc/spec/features/feature-quality-gates-and-pr.md`, `doc/spec/features/feature-autonomous-delivery.md`, `doc/spec/features/feature-monorepo-scaffold-toolchain.md`, and the change folder itself.
2. Assert **no** path under `.github/workflows/`, `.husky/`, `commitlint.config.js` (or any `.commitlintrc*`), `packages/**`, `pnpm-workspace.yaml`, `package.json` (unless only the new script's presence requires none), or `scripts/quality-gates.sh` appears.
3. Assert no history-rewrite/auto-fix automation was added: no new script or prompt step that runs `rebase`, `reset`, `commit --amend`, `filter-branch`, `push --force`, or squash sequences (grep the diff for those literals in executable positions).
4. Assert the commit-message lint is absent from the `check` script chain (`grep -n 'lint-commit-range' package.json` returns nothing).
5. Record the path list and the greps as review evidence.

**Expected Outcome**:
- Then the change is confined to the declared surfaces: no CI change, no hook enforcement, no rewrite automation, no `pnpm check`/`/check`/`/check-fix` semantic change, no CLI/MCP surface change, no commitlint configuration change (AC-NFR8-1).

**Notes / Clarifications**: Deliberately PR-time (see §1.2): a permanent suite asserting this against a moving base would fail every later delivery (`.ai/rules/testing-strategy.md`, invariant-test authoring).

#### TC-CONFINE-002 - Unchanged surfaces stay unchanged (tree invariants)

**Scenario Type**: Regression
**Impact Level**: Critical
**Priority**: Critical
**Related IDs**: NFR-8, AC-NFR8-1, DEC-2, DEC-6, DEC-8
**Test Type(s)**: Static check
**Automation Level**: Automated
**Target Layer / Location**: `scripts/checks/commitlint-authority.ts`, `.husky/commit-msg`, `package.json`, `scripts/checks/exports-parity.ts`
**Tags**: @conformance, @confinement

**Preconditions**: Change applied.

**Steps**:
1. Run `bun run scripts/checks/commitlint-authority.ts`; assert exit `0` — exactly one root config extending `@commitlint/config-conventional`, no package-level override, and the CI `ts-commitlint` job still present with its base-range invocations.
2. Assert the hook stays warn-only: `.husky/commit-msg` contains an unconditional success path and no non-zero exit (`grep -nE 'exit[[:space:]]+[1-9]' .husky/commit-msg` returns nothing; assert the documented warn-only statement is present).
3. Assert the gate is not wired into the aggregate gate: the `check` script in `package.json` does not reference `lint-commit-range`, and no `scripts/quality-gates.sh` exists (`test ! -e scripts/quality-gates.sh`).
4. Run `bun run scripts/checks/exports-parity.ts`; assert exit `0` (no product-surface/export drift).
5. Run `bun test tests/checks` in full; assert exit `0` (no existing invariant test regressed).

**Expected Outcome**:
- Then the commitlint authority, the warn-only hook, the aggregate gate's scope, and the product export surface are provably unchanged (AC-NFR8-1).

#### TC-DOGFOOD-001 - This change's own branch range passes and the verdict is recorded

**Scenario Type**: Happy Path (self-application)
**Impact Level**: Critical
**Priority**: Critical
**Related IDs**: F-6, AC-F6-1, AC-F1-1, AC-F3-4, spec §18 (rollout: self-applies), §10 telemetry
**Test Type(s)**: Manual
**Automation Level**: Semi-automated
**Target Layer / Location**: This change's branch `chore/GH-268/commitlint-pre-pr-gate`; `doc/changes/2026-11/2026-11-11--GH-268--commitlint-pre-pr-gate/chg-GH-268-pm-notes.yaml`
**Tags**: @dogfood, @lifecycle, @evidence

**Preconditions**:
- The gate script and the PM/committer prompt wiring are delivered (gate exists in the tree before the phase completion claim).
- The delivery base branch is resolvable locally (fetched when the branch was created or synced). If it is not, that is `DM-1.e` — fetch it and re-run, never waive.

**Steps**:
1. From the repository root run `./scripts/lint-commit-range.sh --base <delivery base>` on the change branch; capture stdout/stderr and `$?`.
2. Assert exit code `0` and a `PASS` verdict naming the commit count in range.
3. If it fails, apply the mode the gate names (`SURGICAL REWORD` for 1–2 offenders, `CONDENSE-TO-ONE` for ≥3), re-run until `PASS` — the phase may not complete on `FAIL` and may not waive `ERROR`.
4. Record the verdict as a pm-notes evidence entry: outcome, commit count, offender count (`0`), and the mode (`none`), naming the gate. Evidence command: `grep -n 'lint-commit-range' doc/changes/2026-11/2026-11-11--GH-268--commitlint-pre-pr-gate/chg-GH-268-pm-notes.yaml`.
5. Run `phase complete GH-268 quality_gates` only after step 2/3 reaches `PASS` and step 4 is recorded.

**Expected Outcome**:
- Then the change self-applies: its own history satisfies the configuration before `quality_gates` completes, and the completion claim carries an inspectable verdict (AC-F6-1, AC-F1-1, spec §18).

**Notes / Clarifications**: This is also the parity check against CI: the same range is re-linted by `ts-commitlint` on the PR, so a green dogfood run and a red CI job would be a defect in this change (RSK-1).

## 6. Environments and Test Data

### 6.1 Environments

| Environment | Purpose | Requirements |
|---|---|---|
| Developer/CI Linux (bash ≥4) | All bash suites, `pnpm check` | `git` ≥2.30, `bash` ≥4, `pnpm` 10.18.3, Bun 1.4.4, installed root dev dependencies (real `commitlint` binary at `node_modules/.bin/commitlint`) |
| Temp filesystem (`mktemp -d`) | Every fixture repository | Writable `TMPDIR`; deleted on suite teardown |
| Sandbox install target | `TC-DIST-*` | Temp project directory seeded by the installer-suite pattern |
| PR-time review | `TC-CONFINE-001`, `TC-DOGFOOD-001` | Local clone with the delivery base branch fetched |

No network is required by any scenario. `FX-SHALLOW` uses `file://` clone from a local source only.

### 6.2 Fixture repositories

All fixtures are created per test by helper functions in the suite (`_new_repo`, `_commit`, `_merge`), each under `_test_tmpdir`. Common setup for every fixture:

```bash
git init -q -b main "${repo}"
git -C "${repo}" config user.email "test@example.invalid"
git -C "${repo}" config user.name  "Fixture Bot"
git -C "${repo}" config commit.gpgsign false
git -C "${repo}" config core.hooksPath /dev/null
export LC_ALL=C TZ=UTC
```

| Fixture | Shape | Feeds |
|---|---|---|
| `FX-CLEAN` | config + 2 valid conventional commits on a feature branch | TC-COMMITLINT-002, TC-COMMITLINT-008 (precondition), TC-COMMITLINT-018 (pass), TC-COMMITLINT-020 (row a) |
| `FX-BAD-BODY` | 1 commit: valid subject + 140-char body line | TC-COMMITLINT-001, TC-COMMITLINT-013, TC-COMMITLINT-020 (row c) |
| `FX-BAD-FOOTER` | 1 commit: valid subject + 130-char `Refs:` footer line | TC-COMMITLINT-013 |
| `FX-MULTI` | branches `one-offender`, `two-offenders`, `three-offenders`, `two-commits-many-violations` | TC-COMMITLINT-013, TC-COMMITLINT-014, TC-COMMITLINT-016, TC-COMMITLINT-017 |
| `FX-MANY-VIOLATIONS` | 1 commit with 30×200-char body lines + 1 non-conventional commit | TC-COMMITLINT-015 |
| `FX-MERGE-CONV` | `main` advanced; feature merges with `--no-ff -m "chore(GH-268): sync with main"` | TC-COMMITLINT-003 |
| `FX-MERGE-PLAIN` | merge with the default `Merge remote-tracking branch 'origin/main'` subject | TC-COMMITLINT-004 |
| `FX-UPSTREAM-DIRTY` | `main` carries a non-conventional commit with an over-long body; feature merges it and adds valid commits | TC-COMMITLINT-005 |
| `FX-EMPTY` | branch created at `main` tip, zero extra commits | TC-COMMITLINT-006, TC-COMMITLINT-020 (row b) |
| `FX-NO-CONFIG` | no recognized commitlint config file; contains a malformed commit | TC-COMMITLINT-007, TC-COMMITLINT-018 (skip), TC-COMMITLINT-020 (row d) |
| `FX-ALT-CONFIG` | `.commitlintrc.json` + malformed commit | TC-COMMITLINT-007 (non-vacuity), TC-COMMITLINT-020 |
| `FX-BAD-CONFIG` | `commitlint.config.js` copied from `commitlint.config.invalid.txt` | TC-COMMITLINT-009, TC-COMMITLINT-020 (row h) |
| `FX-REMOTE-TRACKING` | local `main` at M1, `refs/remotes/origin/main` at M2 via `update-ref` | TC-COMMITLINT-010 |
| `FX-CONFIG-BASE` | `.ai/agent/pr-instructions.md` with `Default base branch: integration` | TC-COMMITLINT-010 |
| `FX-UNRELATED` | orphan branch with no common ancestor | TC-COMMITLINT-011, TC-COMMITLINT-020 (row f) |
| `FX-SHALLOW` | `git clone --depth 1 file://…` clone | TC-COMMITLINT-011 |
| `FX-20` | 20 valid conventional commits | TC-COMMITLINT-021 |
| `FX-100` | 100 valid conventional commits (generated in a loop with `git commit --allow-empty -F`) | TC-COMMITLINT-021 |
| Poison bin | shims for `curl`, `wget`, `ssh`, `scp`, `nc`, `git-remote-https`, `git-remote-http` writing to `NETWORK_MARKER` | TC-COMMITLINT-019 |

Committed fixture data lives in `scripts/.tests/fixtures/lint-commit-range/`:

| File | Content | Note |
|---|---|---|
| `msg-valid.txt` | `feat(GH-268): …` + ≤100-char body | |
| `msg-bad-body.txt` | valid subject + one 140-char body line | |
| `msg-bad-footer.txt` | valid subject + one 130-char footer line | |
| `msg-merge-conventional.txt` | `chore(GH-268): sync with main` | used with `git merge --no-ff -F` |
| `msg-merge-plain.txt` | `Merge remote-tracking branch 'origin/main'` | parity fixture |
| `msg-wip.txt` | `wip stuff` + over-long body | upstream-dirty and offender fixtures |
| `commitlint.config.valid.txt` | `export default { extends: ["@commitlint/config-conventional"] };` | copied to `commitlint.config.js` when a fixture needs an explicitly valid config |
| `commitlint.config.invalid.txt` | syntactically invalid module text | **`.txt` on purpose** — a `.js` here would be parsed by `biome lint`/`format:check` and turn the aggregate gate red |
| `fake-commitlint-exec-failure.sh` | shim that exits `3` with an error on stderr and no parseable problems | `DM-1.h` execution-failure sub-case of `TC-COMMITLINT-009`; reached only through `PATH`, never installed into `node_modules/.bin` |

Binary availability per case:

| Case | Binary resolution |
|---|---|
| Real-binary cases (TC-COMMITLINT-001…005, 013…017, 021) | `PATH="${REPO_ROOT}/node_modules/.bin:${PATH}"`; suite fails loudly with "run `pnpm install`" if `command -v commitlint` fails (never a silent skip) |
| Missing-binary case (TC-COMMITLINT-008, TC-COMMITLINT-018 error, TC-COMMITLINT-020 row g) | `PATH` scrubbed to `/usr/local/bin:/usr/bin:/bin` with a precondition guard asserting `command -v commitlint` fails |
| Skip case (TC-COMMITLINT-007) | No config file; binary presence irrelevant |

### 6.3 Isolation and cleanup

- One temp directory per test via the harness `_test_setup`; removed in `_test_teardown` (trap on `EXIT`).
- Repository-local git config only (`git -C`), never `--global`; no user git configuration is read or written.
- `LC_ALL=C` and `TZ=UTC` exported per test so ordering, sorting, and message formatting are stable.
- Committed fixtures are read-only inputs; every mutation happens inside the temp repo.
- No test writes into the delivery worktree; the only "copy and mutate" step (`TC-PROMPT-005`) operates on `cp -a` in `_test_tmpdir` and asserts `git status --porcelain` is empty afterwards.

### 6.4 Read-only and no-network instrumentation (AC-F3-4)

| Property | Instrumentation | Assertion |
|---|---|---|
| Read-only: working tree + index | `git status --porcelain=v1 -z` + `git ls-files -s` digest before/after | digests equal |
| Read-only: refs | `git for-each-ref --format='%(refname) %(objectname)'` sorted + hashed | digests equal |
| Read-only: stash | `git stash list` | identical (normally empty) |
| Read-only: no created files | sorted `find . -path ./.git -prune -o -type f -print` | identical listing |
| Read-only: history integrity | `git fsck --no-progress --connectivity-only` after each run | exit `0` |
| No network (runtime) | poison-bin shims for `curl`, `wget`, `ssh`, `scp`, `nc`, `git-remote-https`, `git-remote-http` writing to `NETWORK_MARKER` | marker file never created; gate exit unchanged |
| No network (git-level) | `GIT_TRACE=1` capture | no line matching the transport alternation `fetch`, `push`, `ls-remote`, `clone`, or `git-remote-*` |
| No network (static) | `grep -nE` over `scripts/lint-commit-range.sh` for the process names `curl`, `wget`, `nc`, `ssh`, `scp` and for `git` followed by `fetch`, `pull`, `push`, `clone`, or `ls-remote` | no match in a command position; hint text allowed only inside quoted strings |

All four outcome classes (pass, fail, skip, error) are exercised for the read-only and no-network properties; a single-path check would not satisfy `NFR-5`/`NFR-2`.

## 7. Automation Plan and Implementation Mapping

| TC ID | Test file | Execution command | Implementation status |
|---|---|---|---|
| TC-COMMITLINT-001 through TC-COMMITLINT-021 | `scripts/.tests/test-lint-commit-range.sh` (new) + `scripts/.tests/fixtures/lint-commit-range/` (new) | `bash scripts/.tests/test-lint-commit-range.sh` | To Implement |
| TC-PROMPT-001, TC-PROMPT-002 | `.opencode/agent/committer.md`, `.opencode/agent/pm.md` (edited) | `grep -niE 'surgical reword' .opencode/agent/committer.md` (evidence recorded) | To Implement (content) / Manual verify |
| TC-PROMPT-003 | existing `scripts/checks/prompt-conformance.ts` + inventory; prompt edits | `pnpm check:prompt` | Existing – No Change (check); content edited |
| TC-PROMPT-004, TC-PROMPT-005 | `scripts/deliver-ticket.sh`, `scripts/.tests/test-deliver-ticket.sh` (edited) | `bash scripts/.tests/test-deliver-ticket.sh` | Existing – Update |
| TC-PROMPT-006 | `scripts/.tests/test-deliver-ticket.sh` (full suite) | `bash scripts/.tests/test-deliver-ticket.sh` | Existing – Update (regression) |
| TC-DOC-001 | `AGENTS.md` (edited) | `grep -n 'lint-commit-range' AGENTS.md` + reading | To Implement (content) / Manual verify |
| TC-DOC-002…005 | `doc/spec/features/*` (3 pages), `doc/guides/change-lifecycle.md` (edited) | reading + `grep -n 'lint-commit-range'` | To Implement (content) / Manual verify |
| TC-DOC-006 | markers in touched docs; `scripts/.tests/test-doc-distribution.sh` | `bash scripts/.tests/test-doc-distribution.sh` | Existing – No Change (guard) |
| TC-DOC-007 | `tests/checks/doc-conformance.test.ts`; `pnpm check` | `bun test tests/checks/doc-conformance.test.ts`, `pnpm check:prompt`, `pnpm check:help`, `pnpm check`, `git diff --check` | Existing – No Change |
| TC-DIST-001, TC-DIST-002 | `scripts/install.sh` (`ADOS_DELIVERY_SCRIPTS`), `scripts/uninstall.sh` (delivery list), `scripts/.tests/test-install.sh`, `scripts/.tests/test-uninstall.sh` (edited) | `bash scripts/.tests/test-install.sh`, `bash scripts/.tests/test-uninstall.sh` | Existing – Update |
| TC-DIST-003 | same suites | both commands above | Existing – Update (regression) |
| TC-CONFINE-001 | PR diff review (`@reviewer`) | `git diff --name-only "$(git merge-base main-tools HEAD)"...HEAD` + greps | Manual Only (PR-time) |
| TC-CONFINE-002 | `scripts/checks/commitlint-authority.ts`, `.husky/commit-msg`, `package.json`, `scripts/checks/exports-parity.ts`, `tests/checks/**` | `bun run scripts/checks/commitlint-authority.ts`, `bun run scripts/checks/exports-parity.ts`, `bun test tests/checks` | Existing – No Change |
| TC-DOGFOOD-001 | `chg-GH-268-pm-notes.yaml` evidence | `./scripts/lint-commit-range.sh --base <delivery base>`; then `phase complete GH-268 quality_gates` | Manual + gate run |

Mocking requirements:

- **No mocking of git.** Every gate scenario uses a real temporary repository; the gate's contract is about real history.
- **No mocking of commitlint for content assertions.** Real pinned binary for `TC-COMMITLINT-001…005`, `013…017`, `021`; the parity cross-check in `TC-COMMITLINT-004` runs the CLI directly.
- **PATH poisoning only** is used to simulate a missing binary (`TC-COMMITLINT-008`) and to detect network attempts (`TC-COMMITLINT-019`); the suite never patches the script's internals.
- **No stubbed commitlint output** — if the implementation parses a specific output format, format fidelity must be proven against the real binary (see OQ-1 in §8.3) rather than a hand-written stub.

Failure-injection coverage (does the suite catch a broken gate?): the negative assertions above are the guard — a gate that always passes fails `TC-COMMITLINT-001`; a gate that always fails fails `TC-COMMITLINT-002…006`; a gate that skips unconditionally fails `TC-COMMITLINT-007` step 3; a gate that verifies nothing fails `TC-COMMITLINT-010/011/020`; a gate that mutates fails `TC-COMMITLINT-018`; a gate that fetches fails `TC-COMMITLINT-019`.

## 8. Risks, Assumptions, and Open Questions

### 8.1 Risks

| ID | Risk | Impact | Mitigation in this plan |
|---|---|---|---|
| TR-1 | Runtime assertion (`TC-COMMITLINT-021`) flakes on a loaded runner | L | Assert a 10 s budget on a 20-commit fixture; if it flakes, use a median of three runs in the harness and never change the spec threshold |
| TR-2 | Fixture drift from the real configuration (rules, default ignores) turns parity fixtures into false expectations | M | `TC-COMMITLINT-004` step 4 cross-checks against the CLI itself; `commitlint-authority.ts` keeps a single pinned config |
| TR-3 | Real-binary dependency makes the new suite fail on a machine without `pnpm install` | M | Fail loudly with an install hint (consistent with the gate's own `DM-1.g` posture); the aggregate gate runs after install, so CI is unaffected |
| TR-4 | Assertions on diagnostic line grammar break if the implementation chooses different separators | M | Assertions target semantics (short SHA, full SHA, rule id, `line=N`, bounded length) and are localized in one helper (`_assert_diagnostic_block`) |
| TR-5 | `FX-SHALLOW` fixture is sensitive to git version behaviour around `file://` clone depth | L | Precondition guard asserts `.git/shallow` exists; if the guard fails the test fails loudly rather than passing vacuously |
| TR-6 | The prompt/doc phrase assertions are brittle if final wording differs | M | Assertions use semantic regexes (e.g. a sentence containing the gate name *and* `supplementary`/`pre-PR`) rather than full sentences; exact phrases confirmed at implementation |
| TR-7 | `TC-PROMPT-005`'s mutation probe could touch the delivery tree if written carelessly | H | Probe runs only inside `cp -a` under `_test_tmpdir`; step 4 asserts `git status --porcelain` is empty afterwards |
| TR-8 | Dogfood run blocked by an unfetched base, misread as a gate defect | M | Explicit step: `DM-1.e` means fetch and re-run; never waive (`AC-F6-1`); recorded as the phase's first evidence item |
| TR-9 | Committed fixture files accidentally linted by `biome`/`format:check` | M | Invalid-JS fixture ships as `.txt`; message fixtures are `.txt`; only valid JS may be committed as `.js` |

### 8.2 Assumptions

- The gate resolves the commitlint binary through `PATH` (`command -v`, per `.ai/rules/bash.md` §8), so `PATH` injection selects the binary and PATH scrubbing simulates absence. If the implementation instead hardcodes `./node_modules/.bin/commitlint`, `TC-COMMITLINT-008` and `TC-DIST-*` need the documented override seam (see OQ-2).
- Configuration discovery covers at least `commitlint.config.{js,cjs,mjs,ts}` and `.commitlintrc{,.json,.yaml,.yml}`, matching `scripts/checks/commitlint-authority.ts`'s candidate list (`TC-COMMITLINT-007` step 3).
- The base-branch configuration is the lifecycle's established mechanism: `ADOS_BASE_BRANCH` → `pr-instructions.md` `Default base branch` → default `main` (`scripts/deliver-ticket.sh::detect_base_branch`).
- Default (non-verbose) report output carries no timestamps or durations, so determinism (`TC-COMMITLINT-014`) is byte equality rather than a normalized comparison.
- `commitlint --from MERGE_BASE --to HEAD` is the authority-equivalent range invocation used for the parity oracle (`TC-COMMITLINT-004`).
- bash ≥4, GNU coreutils, and a POSIX `awk`/`sed` are available (repository baseline).
- Test fixtures may use `git update-ref` to fabricate a remote-tracking ref; no remote is configured and no network is used.

### 8.3 Open Questions

| ID | Question | Blocks | Owner / note |
|---|---|---|---|
| OQ-1 | The spec does not pin **which commitlint output format** the gate consumes nor how it distinguishes `DM-1.c` (violations) from `DM-1.h` (execution/config failure). Tests need that boundary to assert reliably. | Test-fixture fidelity (not the gate's behaviour contract) | `@plan-writer` / delivery planning: pin invocation + parse contract (recommended: run the CLI per commit or over the range with a machine-parseable formatter, and treat non-zero-with-no-parsed-problems as `DM-1.h`). Until then, `TC-COMMITLINT-009` asserts the distinction by observable behaviour only. |
| OQ-2 | The spec says "the project's configured delivery base branch (with the established environment override)" without naming the variable or file; and it does not state the binary-resolution mechanism. | `TC-COMMITLINT-010`, `TC-COMMITLINT-008` exact inputs | Reuse `ADOS_BASE_BRANCH` + `pr-instructions.md` + default `main`, and PATH-based `require_cmd commitlint`; if planning pins a different seam, update only the variable names in those TCs. |
| OQ-3 | The exact diagnostic line template (`FAIL SHORT_SHA (FULL_SHA) · rule=RULE_ID line=N · EXCERPT`) appears only as an example in spec §6 Flow 2, not as a normative grammar. | Nothing (assertions target semantics) | Delivery planning may pin a template; the bounds in `NFR-6` and the fields in `DM-2` are the contract. |
| OQ-4 | Spec OQ-1 (plain merge subjects as a hard failure) remains open and non-blocking. | Nothing | `TC-COMMITLINT-004` pins today's parity behaviour; if OQ-1 is later decided differently, that TC changes with the configuration, not with the gate. |
| OQ-5 | Whether the `/check` resolution contract requires an `AGENTS.md` quality-gates command for adopters. | `TC-DOC-001` step 4 | Spec DEC-8/NG-5 say no; the test asserts the absence of a new "run all quality gates" instruction. |
| OQ-6 | Does the suite need a documented escape hatch for environments where the real commitlint binary cannot be installed (e.g. offline sandboxes)? | CI ergonomics | Recommendation: no silent skip (fail closed, matching the gate's own philosophy); if an escape hatch is added it must print an explicit `SKIP` and the aggregate gate must not depend on it. |

## 9. Plan Revision Log

| Version | Date | Author | Changes |
|---|---|---|---|
| 0.1 | 2026-11-11 | @test-plan-writer | Initial test plan derived from `chg-GH-268-spec.md` v1.0: 40 TCs covering AC-F1-1…AC-NFR8-1, DM-1.a–i, DM-2, DM-3, NFR-1…NFR-10, fixture matrix, read-only/no-network instrumentation, conformance battery, and the dogfood gate run. |
| 0.2 | 2026-11-11 | @test-plan-writer | Re-traced against `chg-GH-268-spec.md` v1.1 (19 ACs): mapped the four appended criteria onto the existing TCs (`AC-F3-5` → `TC-COMMITLINT-009`, `AC-F3-6` → `TC-COMMITLINT-012`, `AC-NFR4-1` → `TC-COMMITLINT-021` + `TC-COMMITLINT-019`, `AC-NFR6-1` → `TC-COMMITLINT-015`), extended those four TCs' steps/expected results with the assertions the new criteria add (including the `DM-1.h` execution-failure sub-case via a PATH shim, the no-range-check assertion for usage errors, the second runtime budget, and the summary-informativeness assertion), added `FX-100`, and removed the resolved `OQ-4` traceability item (OQ-5…7 renumbered to OQ-4…6). No TC id was added, removed, or renumbered. |

## 10. Test Execution Log

Populated during execution (delivery + `quality_gates` + review). One row per TC or per grouped run; evidence = command + exit code + short output excerpt.

| TC ID | Run Date | Result | Evidence / Notes |
|---|---|---|---|
| TC-COMMITLINT-001 through TC-COMMITLINT-021 | — | Not run | `bash scripts/.tests/test-lint-commit-range.sh` |
| TC-PROMPT-001 through TC-PROMPT-006 | — | Not run | grep evidence + `bash scripts/.tests/test-deliver-ticket.sh` |
| TC-DOC-001 through TC-DOC-007 | — | Not run | greps + `bash scripts/.tests/test-doc-distribution.sh` + `pnpm check` |
| TC-DIST-001 through TC-DIST-003 | — | Not run | `bash scripts/.tests/test-install.sh`, `bash scripts/.tests/test-uninstall.sh` |
| TC-CONFINE-001 | — | Not run | PR-time diff review |
| TC-CONFINE-002 | — | Not run | `bun run scripts/checks/commitlint-authority.ts`, `exports-parity.ts`, `bun test tests/checks` |
| TC-DOGFOOD-001 | — | Not run | `./scripts/lint-commit-range.sh --base <delivery base>`; verdict recorded in pm-notes |
