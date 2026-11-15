---
id: chg-GH-322-test-plan
status: Updated
created: 2026-11-15
last_updated: 2026-11-15
owners: [Juliusz Ćwiąkalski]
service: delivery-os
labels: [bug, change]
version_impact: none
summary: "Verify that one absolute operator path in the GH-310 pm-notes is replaced by the repository-relative gate convention, the privacy-literals invariant returns to green, and every recorded outcome stays byte-identical."
links:
  change_spec: ./chg-GH-322-spec.md
  implementation_plan: ./chg-GH-322-plan.yaml
  testing_strategy: .ai/rules/testing-strategy.md
---

# Test Plan - Sanitize absolute user path in GH-310 pm-notes

## 1. Scope and Objectives

The change substitutes one committed evidence literal so the `privacy-literals` invariant stops failing on `main-tools`. Verification protects three things: the invariant's binding verdict (exit 0, 0 violations), the absence of any remaining absolute user path in the GH-310 change folder, and byte-identical preservation of every recorded verdict, count, hash, and phase timestamp. There is no application code, so every check is a command-level or diff-level observation recorded as evidence.

**In scope**: invariant exit code/count; absolute-path scan of the GH-310 folder; diff shape of the affected pm-notes; optional aggregate battery (best-effort); delivery-scope containment.
**Out of scope**: unit/integration/contract/E2E layers (no code path, per `.ai/rules/testing-strategy.md` docs-only fallback); runner temp-location semantics (`tmp/tmpdir` inside the tree — the check under test is static, spec RSK-1); any permanent `tests/**` suite for diff shape (strategy forbids permanent diff-against-moving-base assertions).

## 2. References

[`./chg-GH-322-spec.md`](./chg-GH-322-spec.md) (AC-F1-1…AC-F1-5, §17.1 DoD-1…DoD-5, F-1, NFR-1…NFR-5, DM-1) · [`./chg-GH-322-plan.yaml`](./chg-GH-322-plan.yaml) (single delivery phase, obligations 1.1–1.8) · [`.ai/rules/testing-strategy.md`](../../../../.ai/rules/testing-strategy.md) · [`.ai/memory/lessons/lesson-2026-001-ci-baseline-parity-tmpdir.md`](../../../../.ai/memory/lessons/lesson-2026-001-ci-baseline-parity-tmpdir.md) (the recorded repository-relative gate convention; the ticket uses the same shorthand for it) · affected artifact `doc/changes/2026-11/2026-11-14--GH-310--cross-repository-changes/chg-GH-310-pm-notes.yaml`.

## 3. Coverage Overview

### 3.1 Functional Coverage (F-#, AC-#)

| AC ID | Description | TC ID(s) | Status |
|-------|-------------|----------|--------|
| AC-F1-1 | Invariant exits 0 with 0 violations | TC-PRIV-001 | Planned |
| AC-F1-2 | No home-directory prefix remains in the GH-310 folder | TC-PRIV-002 | Planned |
| AC-F1-3 | One substituted value on one line; verdicts/counts/hashes/timestamps identical | TC-PRIV-003 | Planned |
| AC-F1-4 | Aggregate battery exits 0, no new failures (best-effort) | TC-PRIV-004 | Planned |
| AC-F1-5 | PR targets `main-tools`, stays open for merge authority, and touches no ticket artifact other than the GH-310 pm-notes line named in §7.1 and this change's own folder | TC-PRIV-005, TC-PRIV-006 | Planned |

F-1 is covered by TC-PRIV-001 (green), TC-PRIV-002 (no residual path), TC-PRIV-003 (no collateral edit).

### 3.2 Interface Coverage (API-#, EVT-#, DM-#)

| ID | Description | TC ID(s) | Status |
|----|-------------|----------|--------|
| DM-1 | Gate-evidence note text: one temp-root value replaced, structure/ordering intact | TC-PRIV-003 | Planned |
| API-# / EVT-# | N/A — no endpoints or events | — | N/A |

### 3.3 Non-Functional Coverage (NFR-#)

| NFR | Requirement | TC ID(s) | Status |
|-----|-------------|----------|--------|
| NFR-1 | Invariant passes (binding) | TC-PRIV-001 | Planned |
| NFR-2 | Diff containment: 1 line, 1 file, 0 bytes elsewhere | TC-PRIV-003 | Planned |
| NFR-3 | Aggregate battery unaffected (best-effort) | TC-PRIV-004 | Planned |
| NFR-4 | Scope containment: 0 source/prompt/workflow/spec files | TC-PRIV-006 | Planned |
| NFR-5 | 0 absolute user paths in the affected artifact | TC-PRIV-002 | Planned |

### 3.4 Definition of Done Coverage (spec §17.1)

| DoD | Done condition (abridged from spec §17.1) | Covering TC(s) / verifying step | Status |
|-----|------------------------------------------|---------------------------------|--------|
| DoD-1 | All five §17 acceptance criteria satisfied, each with its command output excerpt and exit code recorded | TC-PRIV-001…TC-PRIV-006, evidenced in §10 of this plan and in the pm-notes `notes:` entries | Planned |
| DoD-2 | Exactly one substituted token on one line of the GH-310 pm-notes; verdicts, counts, commit hashes, and phase timestamps byte-identical | TC-PRIV-003 (masked diff, `1`/`1` numstat, `git diff --check` clean, `delivery-os lint GH-310` conforms) | Planned |
| DoD-3 | Neither this change's artifacts nor its plan contain an absolute user path | TC-PRIV-002 method applied to this change folder — `grep -rInE '/(home\|Users)/[A-Za-z0-9._-]+/' doc/changes/2026-11/2026-11-15--GH-322--sanitize-gh310-pm-notes/` returns no match — plus review-time inspection of every artifact and the plan; recorded as an evidence step in §10 (no dedicated TC) | Planned |
| DoD-4 | Exactly one delivery commit, created through the `commit` primitive, subject `fix(GH-322): sanitize absolute user path in GH-310 pm-notes` | TC-PRIV-005 step (3): `git log --format=%s origin/main-tools..HEAD` shows exactly one commit bearing that subject and no second delivery commit | Planned |
| DoD-5 | A pull request is open against `main-tools` with merge authority left to the CEO, and no other ticket is touched | TC-PRIV-005 steps (1)–(2) (PR base and open state) and TC-PRIV-006 (changed-file set limited to the §7.1 paths) | Planned |

## 4. Test Types and Layers

Layer 1 static/diff checks (`git diff --check`, changed-file review) and Layer 2 content checks (traceability, `delivery-os lint` conformance, path review, YAML parse as a secondary sanity step) apply per `.ai/rules/testing-strategy.md`. Unit / Integration / Contract / E2E / Performance / N/A — no code or behaviour changes. All checks are manual command executions with captured stdout and exit codes.

## 5. Test Scenarios

### 5.1 Scenario Index

| TC ID | Title | Type | Level | Priority | AC Coverage |
|-------|-------|------|-------|----------|-------------|
| TC-PRIV-001 | Privacy-literals invariant is green | Happy Path | Static | High | AC-F1-1, NFR-1 |
| TC-PRIV-002 | No absolute user path left in GH-310 folder | Negative | Content | High | AC-F1-2, NFR-5 |
| TC-PRIV-003 | Diff is exactly one substituted token on one line | Regression | Diff | High | AC-F1-3, NFR-2, DM-1 |
| TC-PRIV-004 | Aggregate battery green (best-effort) | Happy Path | Static | Low | AC-F1-4, NFR-3 |
| TC-PRIV-005 | PR targets `main-tools`, stays open, one delivery commit | Happy Path | Manual | High | AC-F1-5, §17.1 DoD-4, DoD-5 |
| TC-PRIV-006 | Scope contains no code/prompt/spec files | Regression | Diff | High | AC-F1-5, NFR-4 |

### 5.2 Scenario Details

#### TC-PRIV-001 - Privacy-literals invariant is green

**Scenario Type**: Happy Path · **Impact Level**: Critical · **Priority**: High
**Related IDs**: F-1, AC-F1-1, NFR-1 · **Test Type(s)**: Static · **Automation Level**: Semi-automated · **Target Layer**: repository root, `scripts/checks/privacy-literals.ts` · **Tags**: @check, @ci
**Preconditions**: Branch `fix/GH-322/sanitize-gh310-pm-notes` with the sanitizing edit applied; dependencies installed.
**Steps**: (1) `bun run scripts/checks/privacy-literals.ts; echo "exit=$?"`.
**Expected Outcome**: exit `0`; stdout contains `OK privacy-literals:` and `0 violation(s)`; no `private.absolute-user-path` violation reported (previously fingerprint `c796b58bf3a81320` at the GH-310 pm-notes :279).

#### TC-PRIV-002 - No absolute user path left in GH-310 folder

**Scenario Type**: Negative · **Impact Level**: Critical · **Priority**: High
**Related IDs**: F-1, AC-F1-2, NFR-5 · **Test Type(s)**: Static · **Automation Level**: Automated · **Target Layer**: `doc/changes/2026-11/2026-11-14--GH-310--cross-repository-changes/` · **Tags**: @privacy
**Preconditions**: Same as TC-PRIV-001.
**Steps**: (1) `grep -rInE '/(home|Users)/[A-Za-z0-9._-]+/' doc/changes/2026-11/2026-11-14--GH-310--cross-repository-changes/; echo "exit=$?"`.
**Expected Outcome**: no output, grep exit `1` — no home-directory-rooted absolute path remains; any match fails the check with file and line named.

#### TC-PRIV-003 - Diff is exactly one substituted token on one line

**Scenario Type**: Regression · **Impact Level**: Critical · **Priority**: High
**Related IDs**: F-1, AC-F1-3, NFR-2, DM-1 · **Test Type(s)**: Manual (diff review) · **Automation Level**: Semi-automated · **Target Layer**: `chg-GH-310-pm-notes.yaml` vs `origin/main-tools` · **Tags**: @diff, @evidence
**Preconditions**: Sanitizing commit present on the branch.
**Steps**: (1) `git diff --numstat -- <GH-310 pm-notes path>`; (2) `git diff -U0 -- <same path> | grep '^[-+]' | grep -v '^[-+][-+]' | wc -l`; (3) compare removed vs added line with the temp-root token masked in both; (4) `git diff --check`; (5) `PATH="$PWD/node_modules/.bin:$PATH" pnpm exec delivery-os lint GH-310; echo "exit=$?"` — the authoritative conformance surface for a pm-notes document; (6) optional secondary sanity: confirm the surrounding YAML still parses and no paragraph re-wrapped.
**Expected Outcome**: numstat `1	1	<path>`; step 2 prints `2`; masked remainder identical (only the `TMPDIR` value differs, home-rooted prefix → `$PWD/tmp/tmpdir`); no verdict string, pass/skip/fail count, file count, commit hash, or phase timestamp altered; `git diff --check` reports no whitespace/conflict-marker findings; step 5 exits `0` and prints `"target": "pm-notes"` with `"evidence": { "class": "conforms" … }` (variant `full`) — the document still conforms to the pm-notes schema, so a schema-level regression that plain YAML parsing would miss cannot pass unnoticed, and no lint error or non-conforming verdict is reported.

#### TC-PRIV-004 - Aggregate battery green (best-effort)

**Scenario Type**: Happy Path · **Impact Level**: Minor · **Priority**: Low
**Related IDs**: AC-F1-4, NFR-3 · **Test Type(s)**: Manual · **Automation Level**: Manual · **Target Layer**: repository-root aggregate gate · **Tags**: @gate, @best-effort
**Preconditions**: TC-PRIV-001 green; run feasible within the delivery window.
**Steps**: (1) `TMPDIR=$PWD/tmp/tmpdir GIT_CONFIG_COUNT=1 GIT_CONFIG_KEY_0=commit.gpgsign GIT_CONFIG_VALUE_0=false pnpm check; echo "exit=$?"`.
**Expected Outcome**: exit `0`, no new failure. A skip is acceptable and recorded in §10 with its reason; this scenario never overrides TC-PRIV-001, which stays binding.

#### TC-PRIV-005 - PR targets `main-tools`, stays open, one delivery commit

**Scenario Type**: Happy Path · **Impact Level**: Important · **Priority**: High
**Related IDs**: AC-F1-5, DoD-4, DoD-5 · **Test Type(s)**: Manual · **Automation Level**: Manual · **Target Layer**: GitHub PR and branch commit range · **Tags**: @delivery
**Preconditions**: Commits pushed; PR created by the PR phase.
**Steps**: (1) inspect the PR base branch and state; (2) `git log --oneline origin/main-tools..HEAD`; (3) `git log --format=%s origin/main-tools..HEAD`.
**Expected Outcome**: base is `main-tools`; PR stays open for merge authority; every listed commit belongs to GH-322. Step (3) evidences DoD-4: exactly one delivery commit bears the subject `fix(GH-322): sanitize absolute user path in GH-310 pm-notes`, and no second delivery commit exists.

#### TC-PRIV-006 - Scope contains no code/prompt/spec files

**Scenario Type**: Regression · **Impact Level**: Important · **Priority**: High
**Related IDs**: AC-F1-5, NFR-4, DoD-5 · **Test Type(s)**: Manual (diff review) · **Automation Level**: Automated · **Target Layer**: branch range vs `origin/main-tools` · **Tags**: @scope, @diff
**Preconditions**: Branch committed.
**Steps**: (1) `git diff --name-only origin/main-tools...HEAD`; (2) reconcile every listed path against the AC-F1-5 carve-out.
**Expected Outcome**: the delivered change touches no ticket artifact other than the GH-310 pm-notes line named in spec §7.1 (`doc/changes/2026-11/2026-11-14--GH-310--cross-repository-changes/chg-GH-310-pm-notes.yaml`, line 279 only) and this change's own folder (`doc/changes/2026-11/2026-11-15--GH-322--sanitize-gh310-pm-notes/`); nothing else is listed — zero files under `packages/`, `tests/`, `scripts/`, `.opencode/`, `.github/`, `doc/spec/`, `.ai/`, or any other change folder.
**Notes / Clarifications**: The expected outcome restates spec §17 AC-F1-5 verbatim ("touches no ticket artifact other than the GH-310 pm-notes line named in §7.1 and this change's own folder"); the GH-310 line is the one product edit the change exists to make, so it is in scope by construction, not an exception.

## 6. Environments and Test Data

Local worktree at the repository root, branch `fix/GH-322/sanitize-gh310-pm-notes`, base `origin/main-tools`. Test data is the committed GH-310 pm-notes file itself; no fixtures, mocks, or cleanup. The optional gate run uses the repository-relative temp root `tmp/tmpdir` and disables commit signing; that convention is recorded in `.ai/memory/lessons/lesson-2026-001-ci-baseline-parity-tmpdir.md`, which the ticket uses as shorthand. No shared or staging environment.

## 7. Automation Plan and Implementation Mapping

| TC ID | Execution command / artifact | Status |
|-------|------------------------------|--------|
| TC-PRIV-001 | `bun run scripts/checks/privacy-literals.ts` — stdout + exit code into §10 | Manual Only (no test file) |
| TC-PRIV-002 | `grep -rInE '/(home\|Users)/[A-Za-z0-9._-]+/' <GH-310 folder>` | Manual Only |
| TC-PRIV-003 | `git diff --numstat` / `git diff -U0` + `git diff --check` + `delivery-os lint GH-310` (exit 0, `evidence.class: conforms`; optional YAML parse) | Manual Only (review-time) |
| TC-PRIV-004 | `TMPDIR=$PWD/tmp/tmpdir … pnpm check` (best-effort) | Manual Only |
| TC-PRIV-005 | PR inspection + `git log --oneline origin/main-tools..HEAD` + `git log --format=%s origin/main-tools..HEAD` | Manual Only |
| TC-PRIV-006 | `git diff --name-only origin/main-tools...HEAD` | Manual Only |

No test files are created or updated: the change touches no code, and permanent diff-against-base assertions are excluded by the testing strategy. Evidence is recorded in §10. TC-PRIV-003's lint step is the authoritative conformance surface for the affected pm-notes document — `delivery-os lint GH-310` is read-only and currently returns exit 0 with `evidence.class: conforms` — while YAML parsing is kept only as a secondary sanity check.

## 8. Risks, Assumptions, and Open Questions

- **Risks**: gate cost may make TC-PRIV-004 infeasible → best-effort, subordinate to TC-PRIV-001; an editor reflow would add diff noise → TC-PRIV-003 fails on any extra changed line; only the affected folder is scanned → spec RSK-3 baseline (4070 files, no other violation) plus the unmodified check remain authoritative.
- **Assumptions**: the single reported violation is the only CI blocker; `main-tools` stays the integration branch and PR target; `tmp/tmpdir` is the accepted recorded-gate convention (recorded in `.ai/memory/lessons/lesson-2026-001-ci-baseline-parity-tmpdir.md`).
- **Open Questions**: none — spec §14 records no open questions.

## 9. Plan Revision Log

| Version | Date | Author | Changes |
|---------|------|--------|---------|
| 1.0 | 2026-11-15 | @test-plan-writer (delegated by @pm) | Initial test plan for the one-literal sanitizing fix-forward |
| 1.1 | 2026-11-15 | @test-plan-writer (delegated by @pm) | DoR iteration 1 remediation: N-1 — `links.implementation_plan` points at `./chg-GH-322-plan.yaml` and the plan is cited in §2; N-2 — TC-PRIV-003 step (5) now prescribes `delivery-os lint GH-310` (exit 0, `evidence.class: conforms`) as the authoritative conformance surface, with YAML parsing demoted to an optional secondary check; N-3 — gate-convention attribution corrected from `AGENTS.md` to `.ai/memory/lessons/lesson-2026-001-ci-baseline-parity-tmpdir.md` in §2, §6, and §8; AC-F1-5 wording realigned with spec v1.1 including the §7.1 carve-out (§3.1, TC-PRIV-006); new §3.4 maps spec §17.1 DoD-1…DoD-5 to covering TCs/verifying steps, with DoD-4 verified by TC-PRIV-005 step (3) and DoD-5 by TC-PRIV-005 steps (1)–(2) plus TC-PRIV-006 |

## 10. Test Execution Log

| TC ID | Run Date | Result | Notes |
|-------|----------|--------|-------|
| — | — | Not yet executed | Populate during delivery with command output excerpts and exit codes |
