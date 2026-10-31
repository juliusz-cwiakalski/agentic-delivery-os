---
id: chg-GH-185-test-plan
status: Proposed
created: 2026-10-31
last_updated: 2026-10-31
owners: ["Juliusz Ćwiąkalski"]
service: delivery-os autonomous delivery loop (bash era)
labels: ["documentation", "autonomous-delivery", "M0", "interim-mitigations"]
version_impact: none
summary: "Verify the documentation-only interim-mitigations change: docs-only diff scope, grounded knob/result/JOIN/pm-notes claims, one canonical rule body per mitigation, and green doc-distribution and doc-derived guards."
links:
  change_spec: ./chg-GH-185-spec.md
  implementation_plan: "./chg-GH-185-plan.md"
  testing_strategy: .ai/rules/testing-strategy.md
---

# Test Plan - M0-S16: Interim mitigations, docs and config only

## 1. Scope and Objectives

This plan protects a **documentation-only** change: four bash-era delivery-loop mitigations become discoverable and actionable by editing existing docs, with zero shell or code behavior changes. The primary integrity risks are (a) a diff that accidentally touches `scripts/**` or `tools/**`, (b) documentation that asserts knob names, defaults, result tokens, log lines, or ledgers that do not match the current scripts, (c) duplicated rule bodies that re-create drift, and (d) regressions in the repository's existing doc-derived guards. Verification is therefore a mix of diff-scope checks, grep assertions, guard runs, and reviewer grounding against the unchanged scripts.

### 1.1 In Scope

- Diff-scope negative constraint: no `scripts/**` or `tools/**` paths; all changed files under `doc/**`.
- Documentation content coverage for AC-F1-1, AC-F1-2, AC-F2-1, AC-F2-2, AC-F3-1, AC-F4-1, AC-F5-1.
- Grounding of every behavioral claim against `scripts/deliver-ticket.sh`, `scripts/ceo-loop.sh`, and `scripts/pm-liveness.sh`.
- Existing doc-derived guard runs: doc-distribution guard, result-tuple doc guard (and their negative-mode self-tests), inception doc-set consistency guard, plus the documented liveness-wording grep criterion.
- Markdown structure, rendering, cross-link resolution, and `ados_distribution` marker retention for the edited guides.

### 1.2 Out of Scope & Known Gaps

- No unit, integration, contract, E2E, or performance tests: there is no code change.
- No new automated guard scripts are introduced by this change (docs-only). Verification commands below are ad-hoc checks on the working tree, not new committed tests.
- The "Liveness wording" check is **not** implemented as a committed script today; the system spec records it as a *Grep* QA criterion (`doc/spec/features/feature-autonomous-delivery.md` — Quality Assurance Strategy, row "Liveness wording"). TC-MITIG-014 verifies it as a documented manual grep, not as an automated guard.
- No automated Mermaid or internal-link checker exists for the edited guides; rendering and anchor resolution are reviewed manually (TC-MITIG-015), consistent with `.ai/rules/testing-strategy.md` content checks.
- `doc/spec/features/feature-autonomous-delivery.md` is `internal` and is not in the doc-distribution guard's scanned DM-2 set; its configuration row is verified manually (TC-MITIG-005) and by the result-tuple guard (TC-MITIG-013).
- Script-side naming inaccuracies (`ceo-loop.sh` usage text, seconds-seam comment) are knowingly not fixed here (spec NG-1 / §7.3); the docs must document around them, not correct the scripts.

## 2. References

- Change specification: [chg-GH-185-spec.md](./chg-GH-185-spec.md) — ACs in §17, NFRs in §9, DM contracts in §8.3.
- Implementation plan: [chg-GH-185-plan.md](./chg-GH-185-plan.md) — its phases map to this plan's TCs.
- Repository testing strategy: [.ai/rules/testing-strategy.md](../../../../.ai/rules/testing-strategy.md) — static/diff checks, content checks, module-to-test mapping for `doc/**`.
- Canonical delivery-mechanics guide (edit target): [doc/guides/delivery-modes.md](../../../guides/delivery-modes.md).
- Canonical lifecycle guide (edit target): [doc/guides/change-lifecycle.md](../../../guides/change-lifecycle.md).
- Agents/commands guide (edit target): [doc/guides/opencode-agents-and-commands-guide.md](../../../guides/opencode-agents-and-commands-guide.md).
- System spec (edit target): [doc/spec/features/feature-autonomous-delivery.md](../../../spec/features/feature-autonomous-delivery.md) — §Quality Assurance Strategy, §Configuration, INV-DM-1..5.
- Documentation/subject scripts (unchanged): `scripts/deliver-ticket.sh`, `scripts/ceo-loop.sh`, `scripts/pm-liveness.sh`.
- Guard entry points: `.github/workflows/ci.yml` — `doc-distribution-guard`, `inception-doc-consistency`, `result-tuple-guard`.

## 3. Coverage Overview

Every acceptance criterion is covered by at least one scenario. There are no TODO/uncovered ACs.

### 3.1 Functional Coverage (F-#, AC-#)

| AC ID | Description | TC ID(s) | Verification mode | Status |
|-------|-------------|----------|-------------------|--------|
| AC-F1-1 | `noop-lane-permission` trigger, outcome, and recovery documented | TC-MITIG-003 | Manual review + grep | Covered |
| AC-F1-2 | Close-out permission-denial path distinguished from mid-run stall path | TC-MITIG-004 | Manual review + grep | Covered |
| AC-F2-1 | Ceo-loop knob is `CEO_LOOP_STUCK_MINUTES`; zero locations present `CEO_LOOP_STALL_MINUTES` as the loop knob; probe variable explained | TC-MITIG-005 | Automated grep + manual context review | Covered |
| AC-F2-2 | `DELIVER_STUCK_MINUTES`, defaults, multi-signal semantics, tuning, test-only seconds seams documented | TC-MITIG-006 | Manual review + grep | Covered |
| AC-F3-1 | `JOIN:` warning meaning, action, expected outcome, `--is-delivering`, stale self-healing documented | TC-MITIG-007 | Manual review + grep | Covered |
| AC-F4-1 | Exactly one canonical pm-notes authoring rule (who / when / who-not / why) with cross-links only elsewhere | TC-MITIG-008 | Manual review + grep | Covered |
| AC-F5-1 | Exactly one canonical rule body per mitigation; zero duplicated bodies | TC-MITIG-009, TC-MITIG-005 | Manual review + grep | Covered |
| AC-NFR1-1 | 0 changed paths under `scripts/**` and `tools/**`; 100% of changed files under `doc/**` | TC-MITIG-001, TC-MITIG-002 | Automated (git) | Covered |
| AC-NFR2-1 | Every behavioral claim matches current scripts; 0 future-engine claims written as current | TC-MITIG-010, TC-MITIG-011 | Manual grounding review + grep | Covered |
| AC-NFR3-1 | `bash scripts/.tests/test-doc-distribution.sh` passes | TC-MITIG-012 | Automated guard | Covered |
| AC-NFR6-1 | Existing doc-derived guards pass (result-tuple doc guard; liveness-wording grep criterion; structure checks) | TC-MITIG-013, TC-MITIG-014, TC-MITIG-015, TC-MITIG-016 | Automated guards + manual grep/render review | Covered |

**ACs that are review-only (or review-dominant) and how the reviewer verifies them:**

- **AC-F1-1, AC-F1-2, AC-F2-2, AC-F3-1, AC-F4-1** require semantic completeness and correct operator guidance, not just token presence. The reviewer opens the named canonical section, checks each required element against the checklist in the corresponding TC, and re-reads the quoted script lines to confirm the guidance is grounded.
- **AC-NFR2-1** is review-only: the reviewer runs the grounding greps in TC-MITIG-010 and signs off that each documented claim matches the printed script lines; the evidence is recorded in §10.
- **AC-F5-1** is review-only for the "rule body vs cross-link" judgment; grep only enumerates occurrences. The reviewer applies the canonical-home table in TC-MITIG-009.
- **AC-NFR1-1 and AC-NFR3-1** are fully automated (git path scope and the doc-distribution guard). **AC-NFR6-1** is mostly automated (result-tuple guard, ancillary guards) but also includes the documented liveness grep (TC-MITIG-014) and the manual structure/render review (TC-MITIG-015); the reviewer records both in §10.

### 3.2 Interface Coverage (API-#, EVT-#, DM-#)

No HTTP endpoints or events (spec §8.1–§8.2). The following documented contracts are covered:

| ID | Interface / Contract | TC ID(s) |
|----|----------------------|----------|
| DM-1 | Stuck-minute configuration contract (`DELIVER_STUCK_MINUTES`, `CEO_LOOP_STUCK_MINUTES`, `CEO_LOOP_STALL_MINUTES` probe, seconds seams, multi-signal liveness) | TC-MITIG-005, TC-MITIG-006, TC-MITIG-010 |
| DM-2 | Permission-denial classification contract (`noop-lane-permission`, exit 1, corrected-prompt recovery) | TC-MITIG-003, TC-MITIG-004, TC-MITIG-010 |
| DM-3 | Single-flight / JOIN contract (`JOIN:` line, `--is-delivering`, stale self-healing, INV-DM-1/2) | TC-MITIG-007, TC-MITIG-010 |
| DM-4 | pm-notes ledger contract (PM-authored, phase-transition updates, `finished`/`partial`, verify-change input) | TC-MITIG-008, TC-MITIG-009, TC-MITIG-010 |

### 3.3 Non-Functional Coverage (NFR-#)

| NFR | Requirement | TC ID(s) | Notes |
|-----|-------------|----------|-------|
| NFR-1 | Docs/config-only diff | TC-MITIG-001, TC-MITIG-002 | Hard negative constraint; automated path-scope check |
| NFR-2 | Grounded documentation | TC-MITIG-003, TC-MITIG-004, TC-MITIG-005, TC-MITIG-006, TC-MITIG-007, TC-MITIG-008, TC-MITIG-010 | Manual grounding against unchanged scripts |
| NFR-3 | Distribution guard | TC-MITIG-012 | `bash scripts/.tests/test-doc-distribution.sh` |
| NFR-4 | No duplication | TC-MITIG-009 | One canonical home per mitigation |
| NFR-5 | Current-truth only | TC-MITIG-011 | Future engine references explicitly framed |
| NFR-6 | Existing doc-derived guards stay green | TC-MITIG-013, TC-MITIG-014, TC-MITIG-015, TC-MITIG-016 | Result-tuple, liveness-wording, structure, ancillary guards |

## 4. Test Types and Layers

Per `.ai/rules/testing-strategy.md`, a `doc/**`-only change maps to **static/diff + content checks**. No unit/integration/E2E/performance layer applies.

| Layer | Applies? | Method / location |
|-------|----------|-------------------|
| Static/diff | Yes | `git diff --name-only`, `git diff --check` against the merge base |
| Content — traceability | Yes | Reviewer checklist in §5.2 against the change spec |
| Content — markdown rendering | Yes | Manual render review (headings, tables, lists, code fences, Mermaid) |
| Content — links/paths | Yes | Manual resolution of changed cross-links and anchors |
| YAML syntax | Conditional | Only the process-state `doc/changes/**/chg-GH-185-pm-notes.yaml` is a `.yaml` file; validate it if committed (TC-MITIG-017) |
| Grep/content assertions | Yes | `rg` commands in TC-MITIG-003…007, 009, 010, 011, 014 |
| Automated shell doc guards | Yes | `scripts/.tests/test-doc-distribution.sh`, `test-deliver-ticket-result-tuples.sh`, `test-inception-doc-consistency.sh` (+ negative-mode self-tests) |
| Unit / Integration / Contract / E2E / Performance | No | No runtime code changes |
| TypeScript workspace checks | No | No `packages/**`, `tests/**`, or root TS config changes |

### 4.1 Existing Doc-Derived Guard Inventory

These are the repository's existing doc-related guards and the exact commands that run them.

| Guard | Exact command | What it scans / proves | Relevance |
|-------|---------------|------------------------|-----------|
| Doc-distribution drift guard | `bash scripts/.tests/test-doc-distribution.sh` | Every `doc/guides/*.md`, `doc/templates/**`, and standalone doc has a valid `ados_distribution` marker; marker-derived install set equals the sandbox install set | **AC-NFR3-1**; directly scans the three edited guides |
| Doc-distribution negative modes | `bash scripts/.tests/test-doc-distribution-modes.sh` | Self-tests the five distribution failure modes on a synthetic tree | Ancillary regression (TC-MITIG-016) |
| Result-tuple doc guard | `bash scripts/.tests/test-deliver-ticket-result-tuples.sh` | Scans `.opencode/agent/ceo.md`, `doc/guides/delivery-modes.md`, `doc/spec/features/feature-autonomous-delivery.md`; every detected result enumeration must include the full canonical `result=<…>` set derived from `scripts/deliver-ticket.sh` | **AC-NFR6-1**; directly scans two edited docs |
| Result-tuple negative modes | `bash scripts/.tests/test-deliver-ticket-result-tuples-modes.sh` | Self-tests each result-tuple guard failure mode on a synthetic tree | Ancillary regression (TC-MITIG-016) |
| Inception doc-set consistency guard | `bash scripts/.tests/test-inception-doc-consistency.sh` | Cross-surface terminology/matrix/index/structure checks for the inception doc set (guide, handbook, templates) | Part of the doc-guard battery; must stay green (TC-MITIG-016) |
| Liveness wording | Manual grep — criterion recorded in `doc/spec/features/feature-autonomous-delivery.md` §Quality Assurance Strategy (row "Liveness wording") | Docs describe multi-signal liveness (recursive session-tree traffic + git/worktree) with the 10-minute default, not the retired 30-minute/file-mtime heuristic | **AC-NFR6-1**; no committed script, verified by TC-MITIG-014 |
| Forbidden-literal scan | `bun run scripts/checks/forbidden-literals.ts` | Scans registered user-facing docs for the seed literals; this change adds no registered doc | Ancillary privacy/no-cloud regression (TC-MITIG-016) |
| Markdown rendering / Mermaid / anchors | Manual | Edited guides render cleanly and cross-link anchors resolve | **AC-NFR6-1** structure check (TC-MITIG-015) |

## 5. Test Scenarios

### 5.1 Scenario Index

| TC ID | Title | Type | Level | Priority | AC Coverage |
|-------|-------|------|-------|----------|-------------|
| TC-MITIG-001 | Diff is docs-only (no `scripts/**` or `tools/**`) | Negative | Static/diff | Must | AC-NFR1-1 |
| TC-MITIG-002 | Diff hygiene (`git diff --check`) | Regression | Static/diff | Must | AC-NFR1-1 |
| TC-MITIG-003 | Permission-denial recognition and recovery documented | Happy Path | Content | Must | AC-F1-1 |
| TC-MITIG-004 | Close-out denial vs mid-run stall distinguished | Edge Case | Content | Must | AC-F1-2 |
| TC-MITIG-005 | Ceo-loop knob corrected; stale knob presented nowhere as the loop knob | Negative | Content/grep | Must | AC-F2-1, AC-F5-1 |
| TC-MITIG-006 | Stuck-minute defaults, semantics, tuning, test-only seconds documented | Happy Path | Content | Must | AC-F2-2 |
| TC-MITIG-007 | JOIN warning operator contract documented | Happy Path | Content | Must | AC-F3-1 |
| TC-MITIG-008 | Canonical pm-notes authoring rule documented | Happy Path | Content | Must | AC-F4-1, AC-F5-1 |
| TC-MITIG-009 | Exactly one canonical rule body per mitigation | Negative | Content/grep | Must | AC-F5-1 |
| TC-MITIG-010 | Behavioral claims grounded in current scripts | Happy Path | Content | Must | AC-NFR2-1 |
| TC-MITIG-011 | No future engine behavior written as current | Negative | Content | Must | AC-NFR2-1 |
| TC-MITIG-012 | Doc-distribution guard passes | Regression | Automated guard | Must | AC-NFR3-1 |
| TC-MITIG-013 | Result-tuple doc guard (and modes) stays green | Regression | Automated guard | Must | AC-NFR6-1 |
| TC-MITIG-014 | Liveness-wording grep criterion satisfied | Regression | Content/grep | Must | AC-NFR6-1 |
| TC-MITIG-015 | Markdown structure, rendering, and cross-link integrity | Regression | Content | Must | AC-NFR6-1 |
| TC-MITIG-016 | Ancillary doc-guard battery stays green | Regression | Automated guard | Should | AC-NFR6-1 |
| TC-MITIG-017 | Process-state YAML syntax (`chg-GH-185-pm-notes.yaml`) | Regression | Content/YAML | Should | NFR-1 (testing-strategy content check) |

### 5.2 Scenario Details

#### TC-MITIG-001 - Diff is docs-only (no `scripts/**` or `tools/**`)

**Objective**: Prove the hard negative constraint: the change diff contains zero paths under `scripts/**` and `tools/**`, and 100% of changed files are under `doc/**`.
**Scenario Type**: Negative
**Impact Level**: Critical
**Priority**: Must
**Related IDs**: NFR-1, AC-NFR1-1
**Test Type(s)**: Static / diff
**Automation Level**: Automated
**Target Layer / Location**: Repository diff vs `origin/main-tools`
**Tags**: @diff, @docs-only

**Preconditions**:
- Branch `docs/GH-185/interim-mitigations-docs-config` checked out.
- `origin/main-tools` is fetched (or a local `main-tools` ref exists).
- No unintended uncommitted files.

**Steps**:
1. `git fetch origin main-tools` (skip if the ref is already current).
2. `BASE="$(git merge-base origin/main-tools HEAD)"`; record `$BASE`.
3. Enumerate committed changes: `git diff --name-only "$BASE"...HEAD`.
4. Enumerate uncommitted changes (if any): `git diff --name-only "$BASE"` and `git status --porcelain`.
5. Assert every changed path matches `^doc/`.
6. Assert no changed path matches `^(scripts|tools)/`.
7. Assert no changed path matches `^\.ai/local/` (ephemeral state is out of scope).
8. Assert no added file (`git diff --name-status "$BASE"...HEAD | rg '^A'`) introduces a new non-`doc/**` file.

Suggested assertion helpers (verification only — no code changes):
```bash
BASE="$(git merge-base origin/main-tools HEAD)"
changed="$(git diff --name-only "$BASE"...HEAD)"
printf '%s\n' "$changed" | rg -n '^(scripts|tools)/' && echo 'FAIL: forbidden path' || echo 'OK: no scripts/tools paths'
printf '%s\n' "$changed" | rg -vn '^doc/' && echo 'FAIL: non-doc path' || echo 'OK: all changed files under doc/'
```

**Expected Outcome**:
- Zero changed paths under `scripts/**` and `tools/**`.
- All changed paths under `doc/**` (including `doc/guides/**`, `doc/spec/features/**`, `doc/changes/**`).
- No `.ai/local/**` changes.

**Notes / Clarifications**:
- The change spec, test plan, implementation plan (none), and pm-notes are all under `doc/changes/**`, so they satisfy the constraint.
- If the working tree contains orchestration scratch files outside `doc/**`, they must not be committed; the diff check is the authoritative gate.

#### TC-MITIG-002 - Diff hygiene (`git diff --check`)

**Objective**: Ensure the change introduces no whitespace errors or conflict markers.
**Scenario Type**: Regression
**Impact Level**: Minor
**Priority**: Must
**Related IDs**: NFR-1, AC-NFR1-1; `.ai/rules/testing-strategy.md` static/diff checks
**Test Type(s)**: Static / diff
**Automation Level**: Automated
**Target Layer / Location**: Repository diff
**Tags**: @diff, @hygiene

**Preconditions**:
- Same branch/base as TC-MITIG-001.

**Steps**:
1. `BASE="$(git merge-base origin/main-tools HEAD)"`.
2. Run `git diff --check "$BASE"...HEAD`.
3. If working-tree edits exist before commit, also run `git diff --check`.

**Expected Outcome**:
- Exit code 0; no trailing whitespace, space-before-tab, or conflict-marker diagnostics.

**Notes / Clarifications**:
- This is the repository's baseline static check for all changes; it applies even when no tests are added.

#### TC-MITIG-003 - Permission-denial recognition and recovery documented

**Objective**: Confirm the docs state the `noop-lane-permission` trigger, outcome, recognition surface, and practical recovery path, all matching current script behavior.
**Scenario Type**: Happy Path
**Impact Level**: Critical
**Priority**: Must
**Related IDs**: F-1, DM-2, NFR-2, AC-F1-1
**Test Type(s)**: Manual / content + grep
**Automation Level**: Manual (grep-assisted)
**Target Layer / Location**: `doc/guides/delivery-modes.md` (consolidated interim-mitigations subsection beside classification/recovery content)
**Tags**: @docs, @permission-denial

**Preconditions**:
- `doc/guides/delivery-modes.md` edited.
- Unchanged `scripts/deliver-ticket.sh` available for grounding.

**Steps**:
1. `rg -n 'noop-lane-permission' doc/guides/delivery-modes.md`.
2. Read the mitigation section and check for all four required elements:
   - **Trigger**: zero branch commits **and** a headless permission auto-reject signature in the per-ticket lane log.
   - **Outcome**: result `noop-lane-permission`, exit 1, script guidance "re-dispatch with a corrected prompt".
   - **Recognition**: where an operator looks (delivery summary result token; per-ticket lane log).
   - **Recovery**: what "a corrected prompt" means in practice (re-scope / provide permission out-of-band per operator policy, then re-dispatch).
3. Ground the claims:
   ```bash
   rg -n 'noop-lane-permission|re-dispatch with a corrected prompt|headless permission' scripts/deliver-ticket.sh
   ```
4. Compare the documented classification/exit/guidance text with the script output lines (result printer, decision arm, failed log line, help text).
5. Confirm the classification table's `noop-lane-permission` row is still consistent and, if it now cross-links to the mitigation section, the link resolves (TC-MITIG-015).

**Expected Outcome**:
- All four elements are present in the canonical mitigation content and match `scripts/deliver-ticket.sh`.
- No statement contradicts the script (e.g., no claim that the result exits 0 or that the lane log is not involved).

**Notes / Clarifications**:
- Record the grounding commands and result summary in §10.

#### TC-MITIG-004 - Close-out denial vs mid-run stall distinguished

**Objective**: Confirm the docs clearly separate the permission close-out path from the mid-run permission-prompt stall path, with different remedies.
**Scenario Type**: Edge Case
**Impact Level**: Important
**Priority**: Must
**Related IDs**: F-1, DM-2, AC-F1-2
**Test Type(s)**: Manual / content + grep
**Automation Level**: Manual (grep-assisted)
**Target Layer / Location**: `doc/guides/delivery-modes.md`
**Tags**: @docs, @permission-denial, @stall

**Preconditions**:
- Same as TC-MITIG-003.

**Steps**:
1. `rg -n 'mid-run|stuck|kill-and-restart|noop-lane-permission' doc/guides/delivery-modes.md`.
2. Locate the explicit contrast. Confirm the close-out path is described as: clean PM exit → 0 branch commits + auto-reject signature → `noop-lane-permission` (exit 1) → re-dispatch with a corrected prompt.
3. Confirm the mid-run path is described as: live session goes silent → stuck detection via multi-signal liveness → kill-and-restart the session.
4. Confirm the docs state that these are **different mechanisms with different remedies** (not the same thing twice).

**Expected Outcome**:
- Both paths are present and explicitly distinguished; the remedies are not conflated.

**Notes / Clarifications**:
- Ground the mid-run path against the liveness watchdog references in `scripts/deliver-ticket.sh` and `scripts/pm-liveness.sh`.

#### TC-MITIG-005 - Ceo-loop knob corrected; stale knob presented nowhere as the loop knob

**Objective**: Prove `CEO_LOOP_STUCK_MINUTES` (default 10) is the documented ceo-loop knob everywhere the loop threshold is presented, that no edited doc presents `CEO_LOOP_STALL_MINUTES` as the ceo-loop knob, and that the pm-liveness probe variable is explained where the probe is described.
**Scenario Type**: Negative
**Impact Level**: Critical
**Priority**: Must
**Related IDs**: F-2, F-5, DM-1, AC-F2-1, AC-F5-1
**Test Type(s)**: Content / grep
**Automation Level**: Semi-automated (grep assertions + manual context confirmation)
**Target Layer / Location**: `doc/guides/delivery-modes.md` (ceo-loop config table, liveness prose, troubleshooting row) and `doc/spec/features/feature-autonomous-delivery.md` (configuration table)
**Tags**: @docs, @config, @knob-names

**Preconditions**:
- Both docs edited.
- Unchanged scripts available.

**Steps**:
1. Extract the ceo-loop configuration table block and inspect it:
   ```bash
   awk '/^### `ceo-loop.sh`/{f=1} f && /^### `deliver-ticket.sh`/{f=0} f' doc/guides/delivery-modes.md
   ```
2. Assert the block names `CEO_LOOP_STUCK_MINUTES` with default `10` as the loop stuck threshold.
3. Assert the block does not present `CEO_LOOP_STALL_MINUTES` as the ceo-loop knob.
4. Enumerate every stale-name occurrence in the edited docs:
   ```bash
   rg -n 'CEO_LOOP_STALL_MINUTES' doc/guides/delivery-modes.md doc/spec/features/feature-autonomous-delivery.md
   ```
   For each hit, confirm the surrounding text identifies it as the **pm-liveness probe** variable, the wrapper-alignment behavior, or the known `ceo-loop.sh` usage-text misname — never as the ceo-loop threshold.
5. Confirm the correct name is present where expected:
   ```bash
   rg -n 'CEO_LOOP_STUCK_MINUTES' doc/guides/delivery-modes.md doc/spec/features/feature-autonomous-delivery.md
   ```
   Expect at least one ceo-loop configuration row per file and the troubleshooting guidance in the guide.
6. Ground the names against the unchanged scripts:
   ```bash
   rg -n 'STUCK_MINUTES|STALL_MINUTES' scripts/ceo-loop.sh scripts/pm-liveness.sh
   ```
   Confirm `ceo-loop.sh` reads `CEO_LOOP_STUCK_MINUTES` (default 10), exports `CEO_LOOP_STALL_MINUTES` to the probe aligned to its own threshold, and that `pm-liveness.sh` reads `CEO_LOOP_STALL_MINUTES` (default 10).
7. Confirm the docs explicitly record that `ceo-loop.sh --help` still prints the stale name as a known bash-era rough edge (spec RSK-3 / §7.3), rather than implying the script was fixed.

**Expected Outcome**:
- The ceo-loop configuration row and troubleshooting content name `CEO_LOOP_STUCK_MINUTES` with default 10.
- Zero edited-doc locations present `CEO_LOOP_STALL_MINUTES` as the ceo-loop knob.
- Every remaining `CEO_LOOP_STALL_MINUTES` occurrence is clearly a pm-liveness probe / wrapper-alignment / known-misname explanation.
- The system-spec configuration row is corrected to `CEO_LOOP_STUCK_MINUTES`.

**Notes / Clarifications**:
- `ceo-loop.sh` usage text still says `CEO_LOOP_STALL_MINUTES`; the docs must name this rough edge, not silently conflict with it.
- The system spec is `internal` and outside the doc-distribution scan; this TC is its primary verification.

#### TC-MITIG-006 - Stuck-minute defaults, semantics, tuning, test-only seconds documented

**Objective**: Confirm the docs state the true deliver-ticket knobs, defaults, multi-signal liveness semantics, tuning guidance, and that seconds-level overrides are test-only.
**Scenario Type**: Happy Path
**Impact Level**: Critical
**Priority**: Must
**Related IDs**: F-2, DM-1, NFR-2, AC-F2-2
**Test Type(s)**: Manual / content + grep
**Automation Level**: Manual (grep-assisted)
**Target Layer / Location**: `doc/guides/delivery-modes.md` configuration/tuning content
**Tags**: @docs, @config, @liveness

**Preconditions**:
- `doc/guides/delivery-modes.md` edited.
- Unchanged scripts available.

**Steps**:
1. `rg -n 'DELIVER_STUCK_MINUTES|--stuck-minutes|multi-signal|session-message traffic|git/worktree|DELIVER_STUCK_SECONDS' doc/guides/delivery-modes.md`.
2. Confirm all of the following are documented:
   - `DELIVER_STUCK_MINUTES` default `10` and `--stuck-minutes` flag override for `deliver-ticket.sh`.
   - Multi-signal liveness: session-message traffic is primary, git/worktree activity is secondary; a session is stalled only when both signals are quiet for the threshold.
   - Tuning guidance: raise the threshold for legitimately long reasoning steps; too-low values kill healthy sessions and cause restarts.
   - Seconds-level overrides (`DELIVER_STUCK_SECONDS`, ceo-loop's internal seconds seam) are test-only accelerators, not operator knobs.
3. Ground against the scripts:
   ```bash
   rg -n 'DELIVER_STUCK_MINUTES|--stuck-minutes|DELIVER_STUCK_SECONDS' scripts/deliver-ticket.sh
   rg -n 'session-message traffic|git/worktree|DEFAULT_STALL_MINUTES' scripts/pm-liveness.sh
   ```
4. Confirm no operator-facing text presents the seconds seam as a supported knob.

**Expected Outcome**:
- All required elements are present and consistent with the scripts.
- Defaults are stated as `10`; the flag is `--stuck-minutes`; multi-signal semantics match `pm-liveness.sh`.

#### TC-MITIG-007 - JOIN warning operator contract documented

**Objective**: Confirm the docs explain the `JOIN:` line's meaning, prescribe the action, state the expected outcome, and mention the probe and stale-state self-healing.
**Scenario Type**: Happy Path
**Impact Level**: Critical
**Priority**: Must
**Related IDs**: F-3, DM-3, AC-F3-1
**Test Type(s)**: Manual / content + grep
**Automation Level**: Manual (grep-assisted)
**Target Layer / Location**: `doc/guides/delivery-modes.md` mitigation subsection
**Tags**: @docs, @join, @single-flight

**Preconditions**:
- `doc/guides/delivery-modes.md` edited.
- Unchanged `scripts/deliver-ticket.sh` available.

**Steps**:
1. `rg -n 'JOIN: live delivery|--is-delivering|single-flight|same classified result|do not kill|stale' doc/guides/delivery-modes.md`.
2. Confirm the docs state:
   - **Meaning**: a live single-flight owner exists for the same ticket in this repo working tree; the second invocation joins and waits.
   - **Action**: wait for the owner; do not kill it; do not start a parallel delivery for the same ticket in the same working tree (INV-DM-2).
   - **Expected outcome**: the joiner returns the same classified result as the owner.
   - **Supporting probes**: `--is-delivering [REF]`; stale-PID state self-heals rather than blocking a legitimate new owner.
3. Ground against the script:
   ```bash
   rg -n 'JOIN: live delivery|--is-delivering|JOIN: owner' scripts/deliver-ticket.sh
   ```
4. Confirm the doc quotes only the generic line shape (placeholder REF/PID) and does not instruct operators to hand-edit or delete runtime state files.

**Expected Outcome**:
- All five elements are present; no instruction to inspect or delete `.ai/local/delivery/` state manually.
- The quoted JOIN line shape matches the script's emitted text.

#### TC-MITIG-008 - Canonical pm-notes authoring rule documented

**Objective**: Confirm exactly one canonical section states who authors pm-notes, when, who must not, and why, with other surfaces cross-linking only.
**Scenario Type**: Happy Path
**Impact Level**: Critical
**Priority**: Must
**Related IDs**: F-4, DM-4, AC-F4-1, AC-F5-1
**Test Type(s)**: Manual / content + grep
**Automation Level**: Manual (grep-assisted)
**Target Layer / Location**: `doc/guides/change-lifecycle.md` §PM Notes Structure; cross-links in `doc/guides/opencode-agents-and-commands-guide.md` and `doc/guides/delivery-modes.md`
**Tags**: @docs, @pm-notes, @ledger

**Preconditions**:
- `doc/guides/change-lifecycle.md`, `doc/guides/opencode-agents-and-commands-guide.md`, and `doc/guides/delivery-modes.md` edited.

**Steps**:
1. Extract the canonical section:
   ```bash
   awk '/^## PM Notes Structure/{f=1} f && /^## / && !/^## PM Notes Structure/{f=0} f' doc/guides/change-lifecycle.md
   ```
2. Confirm all four required statements:
   - **Who**: the PM (`@pm`) is the sole author.
   - **When**: at phase transitions, validated and updated before each commit, including retro notes on every phase reopening.
   - **Who must not**: delivery agents (e.g., `@coder`) and other delegates do not author or hand-edit pm-notes; they report outcomes to the PM.
   - **Why**: completeness drives `finished` (exit 0) vs `partial` (exit 1) classification; merge verification reads PM finalization; future verify-change consumes it as its ledger input, explicitly framed as not yet landed.
3. Confirm the "PM Notes are Mandatory" bullet in `doc/guides/opencode-agents-and-commands-guide.md` is a one-line pointer to the canonical rule and does not restate the body:
   ```bash
   rg -n 'PM Notes are Mandatory|pm-notes|change-lifecycle' doc/guides/opencode-agents-and-commands-guide.md
   ```
4. Confirm the modes-guide classification context (`finished`/`partial`) cross-links to the rule without restating it:
   ```bash
   rg -n 'finished|partial|pm-notes|change-lifecycle' doc/guides/delivery-modes.md
   ```

**Expected Outcome**:
- Exactly one canonical rule section exists (change-lifecycle).
- Both other surfaces contain a pointer/cross-link only, with no duplicated rule body.
- The future verify-change reference is explicitly framed as not yet landed (see TC-MITIG-011).

#### TC-MITIG-009 - Exactly one canonical rule body per mitigation

**Objective**: Verify AC-F5-1: each of the four mitigations has exactly one canonical rule body; all other mentions are cross-links, with zero duplicated rule bodies.
**Scenario Type**: Negative
**Impact Level**: Critical
**Priority**: Must
**Related IDs**: F-5, NFR-4, AC-F5-1
**Test Type(s)**: Content / grep
**Automation Level**: Manual (grep-assisted)
**Target Layer / Location**: All four edited docs
**Tags**: @docs, @consolidation, @no-duplication

**Preconditions**:
- All four docs edited.
- The canonical-home mapping is known.

**Canonical homes under test**:

| Mitigation | Canonical home | Permitted non-canonical mentions |
|------------|----------------|----------------------------------|
| F-1 permission denial | `doc/guides/delivery-modes.md` mitigation subsection | Classification table row / cross-link |
| F-2 stuck minutes | `doc/guides/delivery-modes.md` configuration/tuning content | One factual config row in the system spec; batched-guide references if already present (unchanged) |
| F-3 JOIN warning | `doc/guides/delivery-modes.md` mitigation subsection | Recovery-semantics rows / flow diagram / cross-link |
| F-4 pm-notes rule | `doc/guides/change-lifecycle.md` §PM Notes Structure | One-line pointer in the agents guide; cross-link in the modes guide |

**Steps**:
1. Enumerate distinctive rule phrases across the edited docs:
   ```bash
   rg -n 'sole author|re-dispatch with a corrected prompt|do not kill|same classified result|CEO_LOOP_STUCK_MINUTES' doc/guides doc/spec/features/feature-autonomous-delivery.md
   ```
2. For each mitigation, confirm the **full prescriptive body** appears once, in its canonical home.
3. Confirm every other mention is a short cross-link of the form `[text](path#anchor)` or a one-line pointer, not a restatement of the rule.
4. Confirm the system-spec `CEO_LOOP_STUCK_MINUTES` row is a single factual configuration row (DEC-5), not a duplicate of the tuning/semantics prose.
5. Confirm no new standalone mitigation guide was added:
   ```bash
   git diff --name-status "$(git merge-base origin/main-tools HEAD)"...HEAD
   ```
   Expect only `M` entries for the four target docs (plus `A` entries under `doc/changes/**` for artifacts); no new `doc/guides/*mitigation*` file.

**Expected Outcome**:
- Exactly one canonical body per mitigation.
- Zero duplicated rule bodies; all secondary mentions are cross-links/pointers.
- No new standalone mitigation guide file.

**Notes / Clarifications**:
- The factual system-spec configuration row for F-2 is explicitly permitted by DEC-5 and is not a "rule body" duplicate. The reviewer judges duplication by whether the guidance/tuning/rationale is restated, not by whether the knob name appears.

#### TC-MITIG-010 - Behavioral claims grounded in current scripts

**Objective**: Verify every behavioral claim in the four mitigation sections matches the current scripts: result tokens, knob names, defaults, log-line shape, and pm-notes classification.
**Scenario Type**: Happy Path
**Impact Level**: Critical
**Priority**: Must
**Related IDs**: F-1, F-2, F-3, F-4, NFR-2, AC-NFR2-1
**Test Type(s)**: Manual / content + grep
**Automation Level**: Manual (grep-assisted)
**Target Layer / Location**: The four edited docs vs `scripts/deliver-ticket.sh`, `scripts/ceo-loop.sh`, `scripts/pm-liveness.sh`
**Tags**: @docs, @grounding

**Preconditions**:
- Docs edited.
- Scripts unchanged on the branch.

**Steps**:
1. Run the grounding commands and compare each documented claim:
   ```bash
   rg -n 'noop-lane-permission|re-dispatch with a corrected prompt' scripts/deliver-ticket.sh
   rg -n 'STUCK_MINUTES|STALL_MINUTES' scripts/ceo-loop.sh scripts/deliver-ticket.sh scripts/pm-liveness.sh
   rg -n -- '--stuck-minutes' scripts/deliver-ticket.sh
   rg -n 'JOIN: live delivery|--is-delivering' scripts/deliver-ticket.sh
   rg -n 'finished|partial|pm-notes|pm_notes' scripts/deliver-ticket.sh
   rg -n 'DEFAULT_STALL_MINUTES' scripts/pm-liveness.sh
   ```
2. For each documented claim, tick it against the script line(s):
   - Result token `noop-lane-permission`, exit 1, "re-dispatch with a corrected prompt".
   - `DELIVER_STUCK_MINUTES` default 10 and `--stuck-minutes`.
   - `CEO_LOOP_STUCK_MINUTES` default 10; `CEO_LOOP_STALL_MINUTES` is the probe variable aligned by wrappers.
   - `JOIN: live delivery for <REF> (pid=…); waiting` shape; `--is-delivering`; stale self-healing.
   - `finished`/`partial` driven by pm-notes completeness.
3. Record each command and a one-line result summary in §10.
4. Flag any claim that cannot be matched to a current script line as a defect (blocking).

**Expected Outcome**:
- 100% of documented behavioral claims match current script behavior.
- Zero claims describe behavior that does not exist today.
- Evidence is recorded in the execution log.

#### TC-MITIG-011 - No future engine behavior written as current

**Objective**: Verify NFR-5 / AC-NFR2-1: no statement presents future engine behavior (`verify-change` M0-S8, `ados lint` / `ados phase` M0-S10) as current; forward references are explicitly framed as not yet landed.
**Scenario Type**: Negative
**Impact Level**: Important
**Priority**: Must
**Related IDs**: NFR-5, AC-NFR2-1
**Test Type(s)**: Manual / content + grep
**Automation Level**: Manual (grep-assisted)
**Target Layer / Location**: `doc/guides/delivery-modes.md`, `doc/guides/change-lifecycle.md`
**Tags**: @docs, @current-truth

**Preconditions**:
- Edited docs available.

**Steps**:
1. `rg -n 'ados lint|ados phase|verify-change|M0-S8|M0-S10|future|not yet|will consume|has not landed' doc/guides/delivery-modes.md doc/guides/change-lifecycle.md`.
2. For every future-engine mention, confirm the surrounding sentence explicitly frames it as future/not-yet-landed (e.g., "until `ados lint` / `ados phase` land", "will consume", "not yet available").
3. Confirm no sentence states that verify-change, `ados lint`, or `ados phase` currently enforce or read anything.
4. Confirm the pm-notes rule says ledger integrity is process-enforced **today** and names the future consumer only as forward context.

**Expected Outcome**:
- Zero future-as-current statements.
- All forward references are explicitly framed.

#### TC-MITIG-012 - Doc-distribution guard passes

**Objective**: Verify the doc-distribution drift guard passes on the change branch and the edited guides retain valid `ados_distribution` markers.
**Scenario Type**: Regression
**Impact Level**: Critical
**Priority**: Must
**Related IDs**: NFR-3, AC-NFR3-1
**Test Type(s)**: Automated guard
**Automation Level**: Automated
**Target Layer / Location**: `scripts/.tests/test-doc-distribution.sh`
**Tags**: @guard, @distribution

**Preconditions**:
- Changes committed or present in the working tree.
- `bash` >= 4 with `globstar` (the guard aborts on macOS bash 3.2).
- `git` available; no network required.

**Steps**:
1. Confirm the edited guides still declare `ados_distribution`:
   ```bash
   rg -n 'ados_distribution' doc/guides/delivery-modes.md doc/guides/change-lifecycle.md doc/guides/opencode-agents-and-commands-guide.md
   ```
   Expect `redistributable` for all three.
2. Run the guard:
   ```bash
   bash scripts/.tests/test-doc-distribution.sh
   ```
3. Record the exit code and any `::error::` annotations.

**Expected Outcome**:
- Guard exits 0.
- Edited guides keep valid markers; no install-set drift.

**Notes / Clarifications**:
- The guard scans all `doc/guides/*.md`; it does not scan `doc/spec/features/**`, so the system-spec edit is not covered here.

#### TC-MITIG-013 - Result-tuple doc guard (and modes) stays green

**Objective**: Verify the existing result-tuple doc guard still passes after editing `delivery-modes.md` and the system spec, and that its negative-mode self-tests stay green.
**Scenario Type**: Regression
**Impact Level**: Critical
**Priority**: Must
**Related IDs**: F-5, NFR-6, AC-NFR6-1
**Test Type(s)**: Automated guard
**Automation Level**: Automated
**Target Layer / Location**: `scripts/.tests/test-deliver-ticket-result-tuples.sh`, `scripts/.tests/test-deliver-ticket-result-tuples-modes.sh`
**Tags**: @guard, @result-tuples

**Preconditions**:
- Docs edited; scripts unchanged.
- `git`, `bash`, `awk` available; the guard is offline.

**Steps**:
1. Run the primary guard:
   ```bash
   bash scripts/.tests/test-deliver-ticket-result-tuples.sh
   ```
2. Run the negative-mode self-tests:
   ```bash
   bash scripts/.tests/test-deliver-ticket-result-tuples-modes.sh
   ```
3. If the primary guard fails, inspect the reported unit and confirm whether a new enumeration was introduced by the mitigation text (a unit with ≥4 distinct result tokens must include the full canonical set). Reword the prose rather than weakening the guard.
4. Record exit codes and output summaries in §10.

**Expected Outcome**:
- Both commands exit 0.
- The edited `delivery-modes.md` and `feature-autonomous-delivery.md` still contain complete result enumerations.

**Notes / Clarifications**:
- The guard scans `.opencode/agent/ceo.md`, `doc/guides/delivery-modes.md`, and `doc/spec/features/feature-autonomous-delivery.md`.
- New mitigation prose that lists several result tokens in one bullet/line can create a false enumeration; keep such lists either complete or in plain prose.

#### TC-MITIG-014 - Liveness-wording grep criterion satisfied

**Objective**: Verify the documented liveness-wording criterion: the docs describe multi-signal liveness with the 10-minute default and do not present the retired 30-minute/file-mtime heuristic as current.
**Scenario Type**: Regression
**Impact Level**: Important
**Priority**: Must
**Related IDs**: NFR-6, AC-NFR6-1
**Test Type(s)**: Content / grep
**Automation Level**: Manual (grep-assisted)
**Target Layer / Location**: `doc/guides/delivery-modes.md`, `doc/spec/features/feature-autonomous-delivery.md`
**Tags**: @docs, @liveness, @guard-criterion

**Preconditions**:
- No committed script implements this check; the criterion is recorded as a *Grep* QA row in the feature spec's Quality Assurance Strategy.
- Docs edited.

**Steps**:
1. Confirm the multi-signal wording is present:
   ```bash
   rg -n 'multi-signal|session-message traffic|git/worktree' doc/guides/delivery-modes.md doc/spec/features/feature-autonomous-delivery.md
   ```
   Expect the primary signal (recursive session-tree message traffic) and the secondary signal (git/worktree activity), with a 10-minute default.
2. Confirm historical 30-minute/file-mtime mentions are framed as retired, not current:
   ```bash
   rg -n '30-minute|file-mtime|file-based|30/file' doc/guides/delivery-modes.md doc/spec/features/feature-autonomous-delivery.md
   ```
   Any hit must be explicit history (e.g., "was 30/file-based … now 10/multi-signal"), never a current-behavior claim.
3. Confirm the 10-minute default is stated for both wrappers (the system spec config row and the guide's config table).

**Expected Outcome**:
- Docs describe multi-signal liveness with the 10-minute default.
- Zero current-behavior claims using the retired 30-minute/file-mtime heuristic.

**Notes / Clarifications**:
- Because there is no committed script, the reviewer records the grep commands and a sign-off in §10. If the team later automates this criterion, that belongs to a shell-allowed change, not this one.

#### TC-MITIG-015 - Markdown structure, rendering, and cross-link integrity

**Objective**: Verify the edited docs render cleanly, keep their structure, and all changed cross-links/anchors resolve.
**Scenario Type**: Regression
**Impact Level**: Important
**Priority**: Must
**Related IDs**: NFR-6, AC-NFR6-1; `.ai/rules/testing-strategy.md` content checks
**Test Type(s)**: Manual / content
**Automation Level**: Manual
**Target Layer / Location**: The four edited docs
**Tags**: @docs, @markdown, @links

**Preconditions**:
- Docs edited.
- A Markdown renderer/preview available (GitHub preview, editor preview, or equivalent).

**Steps**:
1. Render each edited doc and inspect headings, tables, lists, code fences, and Mermaid blocks for breakage.
2. Confirm no duplicated or accidentally merged headings, especially around the new mitigation subsection and the pm-notes section.
3. Enumerate changed internal links and open each target:
   ```bash
   rg -n '\]\([^)]*\.md#' doc/guides/delivery-modes.md doc/guides/change-lifecycle.md doc/guides/opencode-agents-and-commands-guide.md
   ```
4. Confirm each anchor resolves to the intended heading (GitHub slug rules) and each path exists.
5. Confirm frontmatter remains intact and the three guides retain their `ados_distribution` markers (also covered by TC-MITIG-012).
6. Confirm the system-spec table row edit did not break the surrounding table (column count, pipe escaping).

**Expected Outcome**:
- All four docs render cleanly.
- Cross-links and anchors resolve; no broken paths.
- Frontmatter and markers intact; tables well-formed.

**Notes / Clarifications**:
- The repository has no automated Mermaid/link checker for these guides; this manual review is the structure check required by NFR-6 / AC-NFR6-1.

#### TC-MITIG-016 - Ancillary doc-guard battery stays green

**Objective**: Run the remaining repository doc guards and negative-mode self-tests to confirm the edits caused no cross-doc regression.
**Scenario Type**: Regression
**Impact Level**: Minor
**Priority**: Should
**Related IDs**: NFR-6, AC-NFR6-1
**Test Type(s)**: Automated guard
**Automation Level**: Automated
**Target Layer / Location**: `scripts/.tests/`, `scripts/checks/`
**Tags**: @guard, @regression

**Preconditions**:
- `bash` >= 4; optional `bun` for the forbidden-literal scan.

**Steps**:
1. Run the inception doc-set consistency guard:
   ```bash
   bash scripts/.tests/test-inception-doc-consistency.sh
   ```
2. Run the doc-distribution negative-mode self-tests:
   ```bash
   bash scripts/.tests/test-doc-distribution-modes.sh
   ```
3. Run the forbidden-literal scan (optional if `bun` is unavailable):
   ```bash
   bun run scripts/checks/forbidden-literals.ts
   ```
4. Record exit codes in §10.

**Expected Outcome**:
- All commands exit 0.
- No cross-doc terminology, index, structure, or forbidden-literal regression.

**Notes / Clarifications**:
- The forbidden-literal scan only scans registered user-facing docs; this change adds no registered doc and edits unregistered guides, so a clean result is expected. If `bun` is unavailable, record the skip; this TC is Should-priority and not an AC blocker.

#### TC-MITIG-017 - Process-state YAML syntax (`chg-GH-185-pm-notes.yaml`)

**Objective**: Validate the only `.yaml` file touched by the branch (the PM's process-state ledger) so the testing strategy's YAML content check is satisfied. This is orchestration state, not a deliverable of the change.
**Scenario Type**: Regression
**Impact Level**: Minor
**Priority**: Should
**Related IDs**: NFR-1 (docs-only scope); `.ai/rules/testing-strategy.md` YAML syntax content check
**Test Type(s)**: Content / YAML
**Automation Level**: Semi-automated
**Target Layer / Location**: `doc/changes/2026-10/2026-10-31--GH-185--interim-mitigations-docs-config/chg-GH-185-pm-notes.yaml`
**Tags**: @yaml, @artifact-hygiene

**Preconditions**:
- The change's pm-notes file is committed or present in the working tree.
- A YAML parser is available (`python3` + PyYAML, `ruby -ryaml`, or `yq`).

**Steps**:
1. Parse the file with an available YAML parser, for example:
   ```bash
   python3 -c 'import yaml,sys; yaml.safe_load(open(sys.argv[1]))' \
     doc/changes/2026-10/2026-10-31--GH-185--interim-mitigations-docs-config/chg-GH-185-pm-notes.yaml
   ```
   Alternate: `ruby -ryaml -e 'YAML.load_file(ARGV[0])' doc/changes/2026-10/2026-10-31--GH-185--interim-mitigations-docs-config/chg-GH-185-pm-notes.yaml` or `yq e '.' doc/changes/2026-10/2026-10-31--GH-185--interim-mitigations-docs-config/chg-GH-185-pm-notes.yaml`.
2. Confirm the parse exits 0 and the top-level structure remains a single mapping (no accidental multi-document YAML).
3. Record the command and result in §10.

**Expected Outcome**:
- The pm-notes file parses as valid YAML with a single document.
- No deliverable Markdown file is affected by this check.

**Notes / Clarifications**:
- The change spec's deliverables are Markdown; the pm-notes schema itself is enforced by the PM workflow. This scenario only guards against a malformed committed ledger.
- If no YAML parser is available, record the skip; it is Should-priority and not an AC blocker.

## 6. Environments and Test Data

- **Environment**: local developer checkout or CI runner. Requirements: `git`, `bash` >= 4 (with `globstar` for the doc-distribution guard), `rg` (ripgrep), `awk`, `sed`; optional `bun` for TC-MITIG-016 and an optional YAML parser (PyYAML, Ruby Psych, or `yq`) for TC-MITIG-017. No network is required for the guards; `git fetch` for TC-MITIG-001 is the only optional network step.
- **Base reference**: `origin/main-tools` (merge base at plan time: `f6c8d18`). If the remote ref is unavailable, use the local `main-tools` ref and record it.
- **Test data**: none. This is a docs-only change; no fixtures, databases, credentials, or synthetic trees are needed. The guards create their own temporary sandboxes and clean up on exit.
- **Isolation**: guard runs are read-only against the repository (the doc-distribution guard uses a temp sandbox install; the result-tuple negative modes use temp trees). No repository mutation is expected. If a guard mutates tracked files, that is a defect to report.
- **No environment variables** need to be set for the required checks. Do not set `RESULT_TUPLE_SCAN_ROOT` / `ADOS_GUARD_ROOT` for the production runs; those seams are for the guards' own negative-mode tests.

## 7. Automation Plan and Implementation Mapping

No new test files or code are created by this change. The required checks are existing guards plus ad-hoc verification commands recorded in this plan.

| TC ID | Artifact / test file | Execution command | Implementation status |
|-------|----------------------|-------------------|-----------------------|
| TC-MITIG-001 | None (inline git) | `BASE=$(git merge-base origin/main-tools HEAD); git diff --name-only "$BASE"...HEAD` + `rg` assertions | Existing – No Change (ad-hoc) |
| TC-MITIG-002 | None (inline git) | `git diff --check "$BASE"...HEAD` | Existing – No Change (ad-hoc) |
| TC-MITIG-003 | Reviewer checklist in §5.2 | `rg -n 'noop-lane-permission' doc/guides/delivery-modes.md` + script grounding | Manual Only |
| TC-MITIG-004 | Reviewer checklist in §5.2 | `rg -n 'mid-run\|stuck\|kill-and-restart' doc/guides/delivery-modes.md` | Manual Only |
| TC-MITIG-005 | Reviewer checklist in §5.2 | `rg -n 'CEO_LOOP_(STUCK\|STALL)_MINUTES' …` + awk table extraction | Manual Only (grep-assisted) |
| TC-MITIG-006 | Reviewer checklist in §5.2 | `rg -n 'DELIVER_STUCK_MINUTES\|--stuck-minutes\|multi-signal' …` | Manual Only (grep-assisted) |
| TC-MITIG-007 | Reviewer checklist in §5.2 | `rg -n 'JOIN: live delivery\|--is-delivering' …` | Manual Only (grep-assisted) |
| TC-MITIG-008 | Reviewer checklist in §5.2 | awk PM Notes section extraction + `rg` pointer check | Manual Only (grep-assisted) |
| TC-MITIG-009 | Reviewer checklist in §5.2 | Occurrence inventory in TC-MITIG-009 steps 1–5 (`rg` phrase scan + `git diff --name-status`) | Manual Only (grep-assisted) |
| TC-MITIG-010 | Reviewer checklist + §10 evidence | Grounding grep block in §5.2 | Manual Only (grep-assisted) |
| TC-MITIG-011 | Reviewer checklist in §5.2 | `rg -n 'ados lint\|ados phase\|verify-change' …` | Manual Only (grep-assisted) |
| TC-MITIG-012 | `scripts/.tests/test-doc-distribution.sh` | `bash scripts/.tests/test-doc-distribution.sh` | Existing – No Change |
| TC-MITIG-013 | `scripts/.tests/test-deliver-ticket-result-tuples.sh` and `…-modes.sh` | `bash scripts/.tests/test-deliver-ticket-result-tuples.sh`; `bash scripts/.tests/test-deliver-ticket-result-tuples-modes.sh` | Existing – No Change |
| TC-MITIG-014 | None (documented grep criterion in the feature spec) | `rg -n 'multi-signal\|session-message traffic\|git/worktree' …` | Manual Only |
| TC-MITIG-015 | None (manual render review) | Render preview + `rg -n '\]\([^)]*\.md#' …` | Manual Only |
| TC-MITIG-016 | `scripts/.tests/test-inception-doc-consistency.sh`, `…doc-distribution-modes.sh`, `scripts/checks/forbidden-literals.ts` | Commands in §5.2 | Existing – No Change |
| TC-MITIG-017 | `doc/changes/…/chg-GH-185-pm-notes.yaml` (process state) | YAML parser command in §5.2 | Manual Only (semi-automated) |

**Recommendation for execution order**: TC-MITIG-001/002 (scope and hygiene) first; then TC-MITIG-012/013 (guards) early so content edits can be adjusted before the manual review; then TC-MITIG-003…011, 014, 015; finally TC-MITIG-016/017.

## 8. Risks, Assumptions, and Open Questions

### 8.1 Risks

| ID | Risk | Impact | Mitigation |
|----|------|--------|------------|
| RSK-T1 | Grep assertions are brittle because authors may phrase the mitigation content differently from the illustrative phrases in this plan. | M | Treat the greps as an occurrence inventory, not exact-prose tests; the reviewer confirms each required element semantically. The ACs, not the grep strings, define pass/fail. |
| RSK-T2 | New mitigation prose lists several result tokens in one bullet/line, creating a false result-tuple enumeration and failing TC-MITIG-013. | M | Run TC-MITIG-013 early; keep partial result-token mentions in plain prose or include the full canonical set in any enumeration-style unit. |
| RSK-T3 | The "Liveness wording" guard has no committed script, so it can be silently skipped. | M | TC-MITIG-014 is a required manual check; record the grep commands and sign-off in §10. |
| RSK-T4 | Doc-distribution guard aborts on macOS bash 3.2 (`globstar` unsupported). | L | Run under bash >= 4 / the CI container; the guard fails loudly rather than under-scanning. |
| RSK-T5 | Cross-link anchors break if section headings are renamed during editing. | M | TC-MITIG-015 resolves every changed anchor; run it after the final wording pass. |
| RSK-T6 | The system-spec row is `internal` and outside the doc-distribution scan, so a stale knob name there could ship. | M | TC-MITIG-005 explicitly verifies the system-spec row; TC-MITIG-013 also scans the file for result enumerations. |
| RSK-T7 | Review approval is mistaken for automated coverage of semantic ACs. | M | §3.1 explicitly lists the review-only ACs and the reviewer verification method; §10 records the evidence. |

### 8.2 Assumptions

- The base branch for diff comparison is `main-tools`; `origin/main-tools` is fetchable.
- The implementation plan ([chg-GH-185-plan.md](./chg-GH-185-plan.md)) landed after this plan was authored (delivery lifecycle order: spec → test plan → plan); this test plan derives from the change spec, and its TCs map onto the plan's phases.
- All four target docs are edited in place; no new doc files are added (spec DEC-1 / DEC-2).
- The scripts (`deliver-ticket.sh`, `ceo-loop.sh`, `pm-liveness.sh`) are unchanged by this change, so they are stable grounding references.
- `rg`, `awk`, and `bash` >= 4 are available in the verification environment.
- The reviewer has repository access to run the guards and inspect the scripts.

### 8.3 Open Questions

| ID | Question | Blocking? | Owner / resolution |
|----|----------|-----------|--------------------|
| OQ-T1 | Should the pm-notes cross-links target a specific stable anchor? | No | Author chooses the anchor; TC-MITIG-015 verifies it resolves. |
| OQ-T2 | Should the liveness-wording criterion be automated? | No | Out of scope for this docs-only change; consider a shell-allowed maintenance change. |
| OQ-T3 | Is the factual system-spec configuration row acceptable as a non-duplicate mention of the stuck knob? | No | Yes — DEC-5 permits the one-row factual correction; TC-MITIG-009 distinguishes a config fact from a duplicated rule body. |

## 9. Plan Revision Log

| Version | Date | Author | Changes |
|---------|------|--------|---------|
| 1.0 | 2026-10-31 | @test-plan-writer | Initial test plan derived from `chg-GH-185-spec.md`; 17 scenarios covering all 11 ACs; guard inventory and exact commands recorded. |

## 10. Test Execution Log

Populated during delivery / phase 9 quality gates and at review. Record the command, exit code, and a one-line result summary for each scenario.

| TC ID | Run Date | Result | Notes / Evidence |
|-------|----------|--------|------------------|
| TC-MITIG-001 | | | |
| TC-MITIG-002 | | | |
| TC-MITIG-003 | | | |
| TC-MITIG-004 | | | |
| TC-MITIG-005 | | | |
| TC-MITIG-006 | | | |
| TC-MITIG-007 | | | |
| TC-MITIG-008 | | | |
| TC-MITIG-009 | | | |
| TC-MITIG-010 | | | |
| TC-MITIG-011 | | | |
| TC-MITIG-012 | | | |
| TC-MITIG-013 | | | |
| TC-MITIG-014 | | | |
| TC-MITIG-015 | | | |
| TC-MITIG-016 | | | |
| TC-MITIG-017 | | | |
