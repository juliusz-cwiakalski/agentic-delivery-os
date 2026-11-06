---
id: chg-GH-251-test-plan
status: Updated
created: 2026-11-06T17:05:00Z
last_updated: 2026-11-06T19:35:00Z
owners: [engineering]
service: delivery infrastructure (CI shell-suite gate + file-adapter input limits)
labels: [change, review, hardening]
version_impact: minor
summary: "Prove the two GH-251 repairs rather than assert them: a suite-aggregation runner that fails the CI shell-suite job iff any discovered suite fails or cannot run (proved by a committed, self-verifying negative control that also fails if the runner is made green on a failing suite), and byte-accurate UTF-8 enforcement of the 1048576-byte source limit at all three parser check sites (one YAML configuration check site, two pm-notes document check sites) with five boundary fixture classes per site, unchanged error identities, and zero behavior change beyond the two repairs (including the DEC-7 scoped ci-topology allowance, pinned by non-vacuity negative fixtures). 26 named TCs cover all 9 acceptance criteria, DM-1/DM-2, and all 10 NFRs; quality-gate evidence is captured locally (pnpm check, bash suites) and in the PR's green CI run."
links:
  change_spec: ./chg-GH-251-spec.md
  implementation_plan: ./chg-GH-251-plan.yaml
  testing_strategy: ../../../../.ai/rules/testing-strategy.md
---

# Test Plan - GH-251: shell-suite CI failure propagation + byte-accurate input limit

## 1. Scope and Objectives

This plan protects two claims that are currently false, and it protects them the way the repository protects every control: by exercising the failure path inside an otherwise green run.

**Claim one — a green `bash-tests` job means every shell suite passed.** Today the job calls `find ... -exec bash {} \;`; a non-zero child makes only the `-exec` predicate false, so a failing suite can leave the job green while the job comment says the opposite. The plan therefore tests an explicit aggregation contract (DM-2) twice over: as a runner behaviour (all-passing → non-zero exit only on failure, every suite executed exactly once, discovery scope identical to today, an unrunnable suite counted as failure) and as a committed negative control that plants a deliberately failing synthetic suite, invokes the same runner the workflow invokes, observes a non-zero exit, and passes — while failing itself if a runner could ever be made green by that failing suite (NFR-1, NFR-2). The control's execution in the PR's green CI run is the acceptance evidence for AC-F3-1 (DEC-6).

**Claim two — the 1048576-byte source limit is enforced in bytes.** Both parsers compare `text.length` (UTF-16 code units) against a byte-named constant, so multibyte-heavy sources can consume up to roughly four times the byte budget while passing a bounded-input control whose name promises byte enforcement (NFR-TOOL-005). The plan pins the exact boundary at all three check sites — one YAML configuration check site plus both pm-notes document check sites — with the five fixture classes of F-6, including the decisive case where the code-unit count is at or under the limit but the UTF-8 byte count is over. Every over-limit case must keep today's exact error identity; every at-or-under case must parse exactly as today.

**Everything else must not move.** The plan treats scope confinement as a testable property: no error identities, limit value, other parser, other engine, other workflow job, or the adjacent verify-gates same-class instance may change (AC-G6-1, DEC-4, DEC-5), and the standing gates (binding `ts-*` jobs, guard jobs, commitlint, CI topology/bindingness invariants) must stay green against the modified workflow.

### 1.1 In Scope

- Suite-aggregation runner contract: discovery scope unchanged (every `.tests/test-*.sh`, with today's `tmp/` and e2e/performance exclusions), per-suite execution exactly once, explicit child-status aggregation, non-zero exit if and only if at least one discovered suite failed or could not run, per-suite names in the log on both pass and failure (F-1, F-2, DM-2, NFR-1, NFR-5, NFR-10).
- Committed, self-verifying negative control against the same runner, executed in the PR's green CI run, hermetic, non-recursive, leaving no repository state (F-3, NFR-2, NFR-9, DEC-2, DEC-6).
- Workflow wiring of the repaired `bash-tests` job and the corrected job comment (F-1, F-7).
- The DEC-7 scoped ci-topology allowance and its non-vacuity fixtures: removed `ci.yml` lines ignored only inside the `bash-tests` execution block (`run:` step content) and that job's comment lines; removals anywhere else stay fatal; bash/ts job-presence loops stay fatal (F-8, AC-F8-1, NFR-6, RSK-7).
- Byte-accurate UTF-8 source-size enforcement at the YAML configuration parser's one check site and both pm-notes document parser check sites, with the constant name, the 1048576 value, and all error identities preserved (F-4, F-5, DM-1, NFR-3, NFR-4, DEC-1, DEC-4).
- Five boundary fixture classes per check site: exactly-at-limit in bytes (accepted), one byte over (rejected), one byte under (accepted), char-count-at-or-under-limit-but-bytes-over multibyte (rejected), all-ASCII at the limit (accepted) (F-6, AC-F4-1, AC-F5-1, AC-F6-1).
- Accepted-at-limit parse equivalence (the same document parses to the same facts/values as today) and unchanged existing parser suites (NFR-5, §8.5).
- Purity of the byte-length computation: no runtime-specific API, no ambient global, no new dependency edge (F-4, NFR-7).
- Documentation truth for the two in-change records (phase-4 baseline note and its FSE-05 row; the workflow job comment) (F-7, AC-F7-1).
- Local and CI quality-gate evidence: `pnpm check`, the full bash suite run through the new runner, `git diff --check`, shellcheck, and the three CI workflow invariant checks plus commitlint (NFR-6, testing strategy).

### 1.2 Out of Scope & Known Gaps

- [OUT] OPEN-Q15 human part (privacy hashed-class population, configured private-literal coverage) and support-environment scope (NG-1, NG-2).
- [OUT] The adjacent chars-vs-bytes instance on `VERIFY_GATES_MAX_SUMMARY_BYTES`; it must remain untouched and is asserted untouched, not tested for behavior (NG-3, DEC-5).
- [OUT] Any change to error identities, the limit value, parser grammar/features, or renaming the limit to characters (NG-4, DEC-1, DEC-4).
- [OUT] Any change to binding `ts-*` jobs, guard jobs, or other workflow jobs (NG-5).
- [OUT] Rewriting existing suites or changing suite semantics; discovery scope broadening; timeouts/parallelism (NG-6).
- [OUT] Broader CI hardening (mutable legacy action references, etc.) (NG-7).
- [GAP-1 — RESOLVED BY PLAN] `chg-GH-251-plan.yaml` exists and maps the 26 TCs onto delivery phases 1–5, including the runner path (`scripts/run-bash-suites.sh`), control path (`scripts/.tests/test-bash-suite-aggregation-modes.sh`), and byte-length helper anchors in the two parser files. It does not reshape any pinned outcome, identity, discovery rule, or traceability. All 26 TCs now carry execution evidence in §10, including AC-F3-1's PR CI evidence (TC-CIPROP-013, COMPLETED).
- [GAP-2 — CI topology additions-only invariant versus the required workflow replacement — RESOLVED IN SPEC v1.1] This was the plan's verified blocker: `scripts/checks/ci-topology.ts` failed on *any* removed `.github/workflows/ci.yml` line versus `origin/main-tools`, and the incorrect job comment is itself a removed line. Spec v1.1 resolves it upstream with the change-scoped allowance DEC-7 (F-8, AC-F8-1, NFR-6 reworded, RSK-7 registered): removals are ignored only in the `bash-tests` execution block (`run:` step content) and that job's comment lines, while removals elsewhere and bash/ts job-presence enforcement stay fatal, proved non-vacuous by committed negative fixtures. The resolution matches what this plan proposed; TC-CIPROP-015 pins the fixture set and TC-CIPROP-014 keeps the standing gates honest.
- [GAP-3 — runner invocation seam for the control is delivery-bound] The control must invoke "the same runner the workflow invokes" against a synthetic tree. Either the control copies the runner into a temp tree preserving its root-resolution layout (the `test-delivery-mutation-sandbox.sh` precedent) or the runner accepts a scoped root. Both satisfy F-3; the plan pins the observable outcome, not the seam (OQ-2).
- [GAP-4 — byte-length helper location is delivery-bound] Reuse-via-import of the core code-point→UTF-8 pattern or local replication is delivery latitude (F-4, §14). TC-UTF8LIMIT-007 anchors on the file named in the §7 mapping.
- [GAP-5 — NFR-9's "≤ 5 % of job wall time" is observational] The control's ≤ 60 s bound is asserted locally; the runner-overhead share is recorded as a before/after CI wall-time observation rather than a hermetic assertion (OQ-4).
- [OUT] Lone-surrogate and invalid-UTF-16 inputs: the reference pattern counts a lone surrogate as 3 bytes (replacement encoding), which is identical for any reasonable implementation, so no boundary class is added for it; it is not a spec requirement and is not asserted.

## 2. References

- **Change specification**: [chg-GH-251-spec.md](./chg-GH-251-spec.md) (v1.1) — G-1..G-6, F-1..F-8, AC-F1-1, AC-F2-1, AC-F3-1, AC-F4-1, AC-F5-1, AC-F6-1, AC-F7-1, AC-F8-1, AC-G6-1, NFR-1..NFR-10, DM-1, DM-2, RSK-1..RSK-7, DEC-1..DEC-7, Appendix A (ticket traceability), Appendix B (check-site inventory), Appendix C (doc register), Appendix D (normative anchors).
- **PM notes**: [chg-GH-251-pm-notes.yaml](./chg-GH-251-pm-notes.yaml) — verified defect locations, the phase-4 finding, the negative-control precedent list, the AC-1 interpretation note.
- **Testing strategy**: [.ai/rules/testing-strategy.md](../../../../.ai/rules/testing-strategy.md) — layer map, `test-*.sh` convention, module-to-test mapping, invariant-test authoring, gate battery.
- **TypeScript rules**: [.ai/rules/typescript.md](../../../../.ai/rules/typescript.md) — purity, layering, `bun:test` authoring, no `any`/`!`/casts, determinism.
- **Bash rules**: [.ai/rules/bash.md](../../../../.ai/rules/bash.md) — script conventions for the runner and control.
- **CI workflow and invariants**: [.github/workflows/ci.yml](../../../../.github/workflows/ci.yml) (`bash-tests` job; `ts-invariants`), `scripts/checks/ci-topology.ts`, `scripts/checks/ci-bindingness.ts`, `scripts/checks/ci-supply-chain.ts`, `scripts/checks/script-surface.ts`, `tests/checks/ci-checks.test.ts`.
- **Negative-control precedents**: `scripts/.tests/test-doc-distribution-modes.sh` (synthetic tree + failure-mode injection + non-zero assertion), `scripts/.tests/test-delivery-mutation-sandbox.sh` (mutated copy must fail, unmutated copy must pass, no tracked-file mutation), `scripts/.tests/test-deliver-ticket-result-tuples-modes.sh`.
- **Parser repair surface**: `packages/adapters/src/file/yaml-parser.ts` (one size check), `packages/adapters/src/file/pm-notes-parser.ts` (size checks in `parsePmNotesText` and `stagePmNotesPhaseEntry`), reference pattern `packages/core/src/domain/queue-ready.ts` (`utf8ByteLength`, pure, no `TextEncoder`/`Buffer`), error identities `packages/core/src/contracts/config.ts` (`config.file.malformed`) and `packages/core/src/contracts/pm-notes.ts` (`PmNotesParseFailure`).
- **Existing parser suites**: `tests/behaviour/config-parser.test.ts` (TC-CONFIG-007/010/012/013/017/021), `tests/behaviour/pm-notes-corpus.test.ts`, `tests/behaviour/phase-*.test.ts` (stage path via `tests/behaviour/phase-support.ts`).
- **Documentation targets**: `doc/inception/analysis/phase-4-quality-baseline.md` (CI finding section), `doc/inception/analysis/fse-audit.md` (FSE-05 row), and the corrected `bash-tests` job comment.
- **System spec truth**: `doc/spec/nonfunctional.md` (NFR-TOOL-005), `doc/spec/features/feature-monorepo-scaffold-toolchain.md` (bash-jobs sentence, phase-7 reconciliation only), ADR-0003 C-8.

## 3. Coverage Overview

### 3.1 Functional Coverage (F-#, AC-#)

| AC ID | Criterion (short) | TC IDs | Status |
|-------|-------------------|--------|--------|
| AC-F1-1 | Job fails iff at least one discovered suite fails or cannot run; all-passing stays green | TC-CIPROP-001, TC-CIPROP-002, TC-CIPROP-003, TC-CIPROP-006, TC-CIPROP-012, TC-CIPROP-013 | Covered |
| AC-F2-1 | Every discovered suite executed exactly once, outcomes aggregated and named, non-zero exactly on failure | TC-CIPROP-001, TC-CIPROP-002, TC-CIPROP-003, TC-CIPROP-004, TC-CIPROP-005, TC-CIPROP-007, TC-CIPROP-012 | Covered |
| AC-F3-1 | Committed negative control proves propagation in the green CI run; control fails if the runner could pass a failing suite | TC-CIPROP-008, TC-CIPROP-009, TC-CIPROP-010, TC-CIPROP-011, TC-CIPROP-013 | Covered |
| AC-F4-1 | YAML parser: five boundary classes decided by bytes, fail-closed, identity unchanged | TC-UTF8LIMIT-001, TC-UTF8LIMIT-004, TC-UTF8LIMIT-005, TC-UTF8LIMIT-006 | Covered |
| AC-F5-1 | pm-notes parser: same five classes at both check sites, identities unchanged | TC-UTF8LIMIT-002, TC-UTF8LIMIT-003, TC-UTF8LIMIT-004, TC-UTF8LIMIT-005, TC-UTF8LIMIT-006 | Covered |
| AC-F6-1 | Boundary coverage exists for both parsers, every check site, all five classes, decision and identity asserted explicitly | TC-UTF8LIMIT-001, TC-UTF8LIMIT-002, TC-UTF8LIMIT-003, TC-UTF8LIMIT-004, TC-UTF8LIMIT-005 | Covered |
| AC-F7-1 | Baseline note + FSE-05 row record the repair; job comment states the aggregation contract, no false `set -e` claim | TC-DOC-001, TC-CIPROP-012 | Covered |
| AC-F8-1 | Negative fixture set: the DEC-7 allowance ignores removals only in the `bash-tests` execution block/comment; removals elsewhere and bash/ts job-id removals still fail; fixtures prove non-generalization | TC-CIPROP-015, TC-CIPROP-014 | Covered |
| AC-G6-1 | Behavior changes confined to the two repairs; identities, limit value, other parsers/jobs, verify-gates summary untouched | TC-SCOPE-001, TC-CIPROP-014, TC-CIPROP-015, TC-UTF8LIMIT-007, TC-UTF8LIMIT-008, TC-QUAL-001 | Covered |

| Capability | TC IDs |
|---|---|
| F-1 explicit child-suite aggregation | TC-CIPROP-001..007, TC-CIPROP-012 |
| F-2 reusable runner contract (DM-2) | TC-CIPROP-001..007, TC-CIPROP-011 |
| F-3 synthetic failing-suite negative control | TC-CIPROP-008..011, TC-CIPROP-013 |
| F-4 YAML byte accuracy | TC-UTF8LIMIT-001, TC-UTF8LIMIT-004..006 |
| F-5 pm-notes byte accuracy (both sites) | TC-UTF8LIMIT-002, TC-UTF8LIMIT-003, TC-UTF8LIMIT-004..006 |
| F-6 multibyte + boundary coverage | TC-UTF8LIMIT-001..005 |
| F-7 documentation truth | TC-DOC-001, TC-CIPROP-012 |
| F-8 scoped ci-topology allowance (DEC-7) | TC-CIPROP-015, TC-CIPROP-014 |

### 3.2 Interface Coverage (API-#, EVT-#, DM-#)

| ID | Element | TC IDs | Notes |
|----|---------|--------|-------|
| DM-1 | Source-size limit contract (byte-accurate, fail-closed, same value/name/identities) | TC-UTF8LIMIT-001, TC-UTF8LIMIT-002, TC-UTF8LIMIT-003, TC-UTF8LIMIT-004, TC-UTF8LIMIT-005, TC-UTF8LIMIT-006 | Value and name are pinned behaviorally (at-limit accepted, one-over rejected) and by diff review (TC-SCOPE-001) |
| DM-2 | Suite-aggregation result contract (non-zero iff a discovered suite failed or could not run) | TC-CIPROP-001, TC-CIPROP-002, TC-CIPROP-003, TC-CIPROP-006, TC-CIPROP-007, TC-CIPROP-008, TC-CIPROP-009 | Same contract exercised by the job wiring (TC-CIPROP-012) and the control |
| API-# / EVT-# | N/A — no network endpoint and no event contract is added or changed (§8.1, §8.2) | — | — |

### 3.3 Non-Functional Coverage (NFR-#)

| NFR | Requirement (short) | TC IDs | Status |
|-----|---------------------|--------|--------|
| NFR-1 | Propagation soundness across outcome combinations | TC-CIPROP-001, TC-CIPROP-002, TC-CIPROP-003, TC-CIPROP-004, TC-CIPROP-006, TC-CIPROP-007, TC-CIPROP-012 | Covered |
| NFR-2 | Negative control self-verification (0 false-green control outcomes) | TC-CIPROP-008, TC-CIPROP-009, TC-CIPROP-013 | Covered |
| NFR-3 | Byte accuracy, 0 divergence vs reference byte counts | TC-UTF8LIMIT-001, TC-UTF8LIMIT-002, TC-UTF8LIMIT-003, TC-UTF8LIMIT-004 | Covered |
| NFR-4 | Fail-closed rejection with stable identity (0 identity changes) | TC-UTF8LIMIT-005, TC-SCOPE-001 | Covered |
| NFR-5 | Existing-suite integrity (100 % pass, 0 missed/duplicated) | TC-CIPROP-004, TC-CIPROP-005, TC-CIPROP-007, TC-UTF8LIMIT-008, TC-QUAL-001 | Covered (local full run + PR CI run) |
| NFR-6 | Workflow invariant integrity (CI topology under its DEC-7 scoped allowance, bindingness, commitlint) | TC-CIPROP-014, TC-CIPROP-015, TC-QUAL-001 | Covered — 0 allowance generalizations; non-vacuity negative fixtures green |
| NFR-7 | Purity of the byte-length computation | TC-UTF8LIMIT-007 | Covered |
| NFR-8 | Scope confinement (including the DEC-7 allowance as part of repair 1's landing) | TC-SCOPE-001, TC-CIPROP-015, TC-QUAL-001 | Covered |
| NFR-9 | Runtime budget (control ≤ 60 s; runner overhead ≤ 5 % of job wall time) | TC-CIPROP-010, TC-CIPROP-011, TC-QUAL-001 | Partially covered: ≤ 60 s asserted; overhead share is observational (OQ-4) |
| NFR-10 | Diagnosability (every failing suite named) | TC-CIPROP-002, TC-CIPROP-003, TC-CIPROP-008, TC-CIPROP-011 | Covered |

## 4. Test Types and Layers

- **Bash behavioural tests (primary for repair 1):** plain `bash` suites under `scripts/.tests/test-*.sh`, `set -Eeuo pipefail`, deterministic `mktemp -d` trees, `trap` cleanup, no network, no sleeps, no clock/random input. Each suite prints `[PASS]`/`[FAIL]` lines and exits non-zero on any failed assertion. These suites are discovered by both the new runner and the CI job.
- **Static/tree checks (bash):** assertions against the current tree (workflow text, script existence/executability), never against a diff to a moving base branch (testing-strategy invariant rule).
- **TypeScript behaviour tests (primary for repair 2):** `bun:test` suites under `tests/behaviour/`, run by `bun test` (repo root discovery per `bunfig.toml`). Generated boundary inputs, no committed multi-megabyte blobs. Official reference byte counts come from `Buffer.byteLength(text, "utf8")` inside the test; parser decisions come from the real exported functions.
- **Invariant checks:** `bun run scripts/checks/ci-topology.ts` (under its DEC-7 scoped allowance, with non-vacuity negative fixtures), `ci-bindingness.ts`, `ci-supply-chain.ts`, `script-surface.ts`, `error-table-sync.ts`, `ambient-globals.ts`; mutation/negative fixtures under `tests/checks/**` and `tests/boundaries/**`.
- **Integration / CI E2E (evidence layer):** GitHub Actions `bash-tests` job on the PR; the job log is the demonstration evidence for AC-F3-1 and the whole-suite pass evidence for NFR-5.
- **Manual review:** documentation truth (TC-DOC-001) and scope confinement (TC-SCOPE-001), recorded with commands and outcomes in §10.
- **Performance:** bounded-runtime observation for the runner and control (TC-CIPROP-010, TC-QUAL-001); no load/soak testing.

## 5. Test Scenarios

### 5.1 Scenario Index

| TC ID | Title | Type | Level | Priority | AC Coverage |
|-------|-------|------|-------|----------|-------------|
| TC-CIPROP-001 | All-passing discovered set exits zero and names every suite | Happy Path | Unit | High | AC-F1-1, AC-F2-1, NFR-1, NFR-10 |
| TC-CIPROP-002 | One failing suite fails the runner and is named | Negative | Unit | High | AC-F1-1, AC-F2-1, NFR-1, NFR-10 |
| TC-CIPROP-003 | Multiple failing suites are all named and aggregated | Negative | Unit | High | AC-F1-1, AC-F2-1, NFR-1, NFR-10 |
| TC-CIPROP-004 | Every discovered suite runs exactly once even after a failure | Regression | Unit | High | AC-F2-1, NFR-5 |
| TC-CIPROP-005 | Discovery scope matches today's find expression, including exclusions | Contract | Unit | High | AC-F2-1, NFR-5 |
| TC-CIPROP-006 | A suite that cannot be executed counts as a failure | Corner Case | Unit | High | AC-F1-1, NFR-1 |
| TC-CIPROP-007 | Zero discovered suites exits zero; non-vacuity is guarded elsewhere | Edge Case | Unit | Medium | AC-F2-1, NFR-1, NFR-5 |
| TC-CIPROP-008 | The committed negative control proves propagation and passes green | Happy Path | Integration | High | AC-F3-1, NFR-2, NFR-10 |
| TC-CIPROP-009 | The control fails when the runner is made green on a failing suite | Negative | Integration | High | AC-F3-1, NFR-2 |
| TC-CIPROP-010 | The control is hermetic, clean, and bounded in runtime | Regression | Integration | High | AC-F3-1, NFR-9 |
| TC-CIPROP-011 | Nested invocation is scoped: no recursion, one synthetic suite | Corner Case | Integration | High | AC-F3-1, NFR-9, NFR-10 |
| TC-CIPROP-012 | The bash-tests job invokes the runner, not find -exec, and states the real contract | Contract | Integration | High | AC-F1-1, AC-F2-1, AC-F7-1 |
| TC-CIPROP-013 | PR CI run demonstrates propagation end to end (evidence recorded) | Happy Path | E2E | High | AC-F1-1, AC-F3-1, NFR-2, NFR-5 |
| TC-CIPROP-014 | CI topology, bindingness, supply-chain invariants and commitlint stay green | Regression | Integration | High | AC-G6-1, NFR-6 |
| TC-CIPROP-015 | Scoped ci-topology allowance is minimal and non-vacuous (negative fixtures) | Negative | Integration | High | AC-F8-1, NFR-6, RSK-7 |
| TC-UTF8LIMIT-001 | YAML check site: five-class byte boundary matrix | Edge Case | Unit | High | AC-F4-1, AC-F6-1, NFR-3, NFR-4 |
| TC-UTF8LIMIT-002 | pm-notes parse site: five-class byte boundary matrix | Edge Case | Unit | High | AC-F5-1, AC-F6-1, NFR-3, NFR-4 |
| TC-UTF8LIMIT-003 | pm-notes stage site: five-class byte boundary matrix | Edge Case | Unit | High | AC-F5-1, AC-F6-1, NFR-3, NFR-4 |
| TC-UTF8LIMIT-004 | Every boundary fixture self-verifies its byte and code-unit counts | Contract | Unit | High | AC-F4-1, AC-F6-1, NFR-3 |
| TC-UTF8LIMIT-005 | Over-limit identities are exactly today's at every site | Regression | Unit | High | AC-F4-1, AC-F5-1, AC-F6-1, NFR-4 |
| TC-UTF8LIMIT-006 | Accepted-at-limit sources parse identically to today | Regression | Unit | Medium | AC-F4-1, AC-F5-1, NFR-3 |
| TC-UTF8LIMIT-007 | Byte-length computation is pure; no new boundary edges | Contract | Unit | High | AC-G6-1, NFR-7 |
| TC-UTF8LIMIT-008 | Existing parser suites and non-limit behavior are unchanged | Regression | Integration | High | AC-G6-1, NFR-5, NFR-8 |
| TC-DOC-001 | Baseline note, FSE-05 row, and job comment tell the post-repair truth | Happy Path | Manual | High | AC-F7-1 |
| TC-SCOPE-001 | Change confinement: only the two repairs and their evidence move | Regression | Manual | High | AC-G6-1, NFR-4, NFR-8 |
| TC-QUAL-001 | Local gate battery and shell hygiene are green before delivery closes | Regression | Integration | High | NFR-5, NFR-6, NFR-8, NFR-9 |

### 5.2 Scenario Details

#### TC-CIPROP-001 - All-passing discovered set exits zero and names every suite

**Scenario Type**: Happy Path
**Impact Level**: Critical
**Priority**: High
**Related IDs**: F-1, F-2, DM-2, AC-F1-1, AC-F2-1, NFR-1, NFR-10
**Test Type(s)**: Unit
**Automation Level**: Automated
**Target Layer / Location**: `scripts/.tests/test-bash-suite-aggregation.sh` (runner contract suite), invoking the runner under `scripts/`
**Tags**: @bash, @ci, @aggregation

**Preconditions**:

- Runner implemented and invocable against a scoped root or copied tree (§7 mapping, GAP-3).
- A synthetic tree containing two or three passing suites (`test-*.sh` under a `.tests/` directory), each exiting 0 and writing a marker file.

**Steps**:

1. Build the synthetic tree in a temp directory; record the expected suite paths.
2. Invoke the runner against it, capturing stdout, stderr, and the exit code.
3. Assert the exit code is 0.
4. Assert the log names every suite path at least once with a pass marker.
5. Assert the aggregate summary reports the same count as the expected suite set.

**Expected Outcome**:

- Exit code 0; no suite reported as failed.
- Every suite path appears in the log (attribution by name, not just a count).
- No duplicate execution (each marker file written exactly once; reinforced by TC-CIPROP-004).

**Postconditions**:

- Temp tree removed by the suite's `trap`.

#### TC-CIPROP-002 - One failing suite fails the runner and is named

**Scenario Type**: Negative
**Impact Level**: Critical
**Priority**: High
**Related IDs**: F-1, F-2, DM-2, AC-F1-1, AC-F2-1, NFR-1, NFR-10
**Test Type(s)**: Unit
**Automation Level**: Automated
**Target Layer / Location**: `scripts/.tests/test-bash-suite-aggregation.sh`
**Tags**: @bash, @ci, @aggregation, @negative

**Preconditions**:

- Synthetic tree with two passing suites and one deliberately failing suite (`exit 1`), placed so discovery order puts a passing suite both before and after the failing one.

**Steps**:

1. Invoke the runner from a parent shell that does **not** use `set -e` (so the non-zero status must be intrinsic, never an artefact of the caller).
2. Capture the exit code.
3. Assert the exit code is non-zero (any non-zero value is acceptable; the contract is "failed", not a specific code).
4. Assert the log names the failing suite path explicitly.
5. Assert the log does not classify the failing suite as skipped.

**Expected Outcome**:

- Non-zero exit without depending on the caller's `set -e`.
- Failing suite named; diagnostics actionable without a local re-run (NFR-10).

#### TC-CIPROP-003 - Multiple failing suites are all named and aggregated

**Scenario Type**: Negative
**Impact Level**: Important
**Priority**: High
**Related IDs**: F-1, AC-F1-1, AC-F2-1, NFR-1, NFR-10
**Test Type(s)**: Unit
**Automation Level**: Automated
**Target Layer / Location**: `scripts/.tests/test-bash-suite-aggregation.sh`
**Tags**: @bash, @ci, @aggregation, @negative

**Preconditions**:

- Synthetic tree with two failing suites (distinct names, distinct failure modes: explicit `exit 1` and a failing assertion helper) plus one passing suite.

**Steps**:

1. Invoke the runner; capture output and exit code.
2. Assert non-zero exit.
3. Assert both failing suite paths appear in the failure reporting.
4. Assert the passing suite is reported as passing, not as failed.

**Expected Outcome**:

- Aggregation reports every failure (not only the first), with correct per-suite attribution.

#### TC-CIPROP-004 - Every discovered suite runs exactly once even after a failure

**Scenario Type**: Regression
**Impact Level**: Critical
**Priority**: High
**Related IDs**: F-1, AC-F2-1, NFR-5
**Test Type(s)**: Unit
**Automation Level**: Automated
**Target Layer / Location**: `scripts/.tests/test-bash-suite-aggregation.sh`
**Tags**: @bash, @ci, @aggregation

**Preconditions**:

- Synthetic tree with three suites where the first discovered suite fails; each suite appends one line to its own counter file.

**Steps**:

1. Invoke the runner once.
2. Assert the exit code is non-zero.
3. Assert every counter file contains exactly one line (all three suites executed despite the early failure).
4. Repeat with the failing suite last; assert the same exactly-once property.

**Expected Outcome**:

- No short-circuit, no duplicate execution; the aggregate is computed from all suites, not from the first failing one.

#### TC-CIPROP-005 - Discovery scope matches today's find expression, including exclusions

**Scenario Type**: Contract
**Impact Level**: Critical
**Priority**: High
**Related IDs**: F-1, F-2, AC-F2-1, NFR-5, RSK-4
**Test Type(s)**: Contract
**Automation Level**: Automated
**Target Layer / Location**: `scripts/.tests/test-bash-suite-aggregation.sh`
**Tags**: @bash, @ci, @discovery

**Preconditions**:

- Synthetic tree containing: a nested `a/.tests/test-one.sh`; `scripts/.tests/test-two.sh`; `tools/.tests/test-three.sh`; `tmp/.tests/test-excluded.sh`; `x/.tests/test-e2e-providers.sh`; `x/.tests/test-e2e-suite.sh`; `x/.tests/test-performance.sh`; `x/.tests/helper.sh` (does not match `test-*.sh`); `x/.tests/test-other.sh.bak`.

**Steps**:

1. Establish the expected set with an independent `find . -path '*/.tests/test-*.sh' -not -path './tmp/*' -not -name '*e2e-providers*' -not -name '*e2e-suite*' -not -name '*performance*'` executed in the same tree (today's exact expression, including its top-level-`tmp` quirk).
2. Obtain the runner's discovered set from its per-suite log lines (or its documented list output).
3. Assert set equality and deterministic ordering across two consecutive runs.
4. Assert the excluded paths appear zero times in the runner log.

**Expected Outcome**:

- Discovery is byte-for-byte equivalent to today's expression at the set level: same members, same exclusions, no new scope and no missed suite.

**Notes / Clarifications**:

- Scope parity is the contract; broadening discovery (e.g., adding `-type f` or extra exclusions) is out of scope and would be a review finding even if "safer".

#### TC-CIPROP-006 - A suite that cannot be executed counts as a failure

**Scenario Type**: Corner Case
**Impact Level**: Critical
**Priority**: High
**Related IDs**: F-1, F-2, AC-F1-1, NFR-1
**Test Type(s)**: Unit
**Automation Level**: Automated
**Target Layer / Location**: `scripts/.tests/test-bash-suite-aggregation.sh`
**Tags**: @bash, @ci, @aggregation, @fail-closed

**Preconditions**:

- Synthetic tree with one passing suite and one discovered path that cannot run: a dangling symlink named `test-unrunnable.sh` (and, additionally, a matched path whose interpreter invocation fails).

**Steps**:

1. Invoke the runner; capture output and exit code.
2. Assert the exit code is non-zero.
3. Assert the unrunnable path is reported as failed/unrunnable, not skipped or silently ignored.
4. Assert the passing suite is still reported as passing.

**Expected Outcome**:

- "Cannot run" is a failure, never a skip (fail-closed, F-1). This is the case a non-aggregating `-exec` traversal would hide.

#### TC-CIPROP-007 - Zero discovered suites exits zero; non-vacuity is guarded elsewhere

**Scenario Type**: Edge Case
**Impact Level**: Important
**Priority**: Medium
**Related IDs**: F-1, F-2, AC-F2-1, NFR-1, NFR-5
**Test Type(s)**: Unit
**Automation Level**: Automated
**Target Layer / Location**: `scripts/.tests/test-bash-suite-aggregation.sh`
**Tags**: @bash, @ci, @aggregation

**Preconditions**:

- An empty temp root with no `.tests/` directory.

**Steps**:

1. Invoke the runner against the empty root.
2. Assert exit code 0 and a summary that states zero suites were discovered (no fabricated pass list).
3. Separately assert non-vacuity of the *real* repository discovery through TC-CIPROP-005 (fixture parity) and TC-CIPROP-013 (CI log names the known suite set).

**Expected Outcome**:

- Zero-suite behaviour follows DM-2 literally (nothing failed ⇒ success) while a silent discovery regression cannot hide: the real discovery set is pinned by the parity fixtures and the CI log evidence.

**Notes / Clarifications**:

- A runtime minimum-count guard is deliberately **not** required: it would be new behaviour beyond the two repairs (AC-G6-1). If delivery adds one voluntarily, this TC must be updated and the addition justified as a contract change.

#### TC-CIPROP-008 - The committed negative control proves propagation and passes green

**Scenario Type**: Happy Path
**Impact Level**: Critical
**Priority**: High
**Related IDs**: F-3, AC-F3-1, NFR-2, NFR-10, DEC-2, DEC-6
**Test Type(s)**: Integration
**Automation Level**: Automated
**Target Layer / Location**: `scripts/.tests/test-bash-suite-aggregation-modes.sh` (the committed control)
**Tags**: @bash, @ci, @negative-control

**Preconditions**:

- The control exists as a discovered `test-*.sh` suite and constructs its synthetic tree at runtime.

**Steps**:

1. Run the control directly (`bash scripts/.tests/test-bash-suite-aggregation-modes.sh`); assert exit 0.
2. Assert it plants exactly one deliberately failing synthetic suite outside any real `.tests/` directory.
3. Assert it invokes the same runner artifact the workflow invokes.
4. Assert it observes a non-zero runner exit and converts that into a `[PASS]` verdict.
5. Assert its output is self-describing: planted suite path, observed runner exit, verdict.

**Expected Outcome**:

- The control passes only because propagation worked; a reader of the output can tell what was planted, what exit was observed, and why the verdict followed.

#### TC-CIPROP-009 - The control fails when the runner is made green on a failing suite

**Scenario Type**: Negative
**Impact Level**: Critical
**Priority**: High
**Related IDs**: F-3, AC-F3-1, NFR-2
**Test Type(s)**: Integration
**Automation Level**: Automated
**Target Layer / Location**: `scripts/.tests/test-bash-suite-aggregation-modes.sh`
**Tags**: @bash, @ci, @negative-control, @self-verifying

**Preconditions**:

- The control accepts an optional runner-path override (test seam, documented in its header) or otherwise exercises a mutated runner copy.

**Steps**:

1. Provide an always-zero stub "runner" (it executes nothing and exits 0) and run the control against it in a temp tree.
2. Assert the control exits non-zero and reports that the expected failure did not propagate.
3. Provide a stub that fails only when it feels like it (exits 0 on the planted failing suite, non-zero elsewhere) and assert the control still fails.
4. Restore the real runner and assert the control passes (guarding against an always-failing control).

**Expected Outcome**:

- A runner that could be made green by a failing suite makes the control itself fail (NFR-2); an always-failing control cannot pass vacuously.

**Notes / Clarifications**:

- Mirrors `test-doc-distribution-modes.sh` (inject the defect, assert the guard fires) and `test-delivery-mutation-sandbox.sh` (unmutated copy must pass).

#### TC-CIPROP-010 - The control is hermetic, clean, and bounded in runtime

**Scenario Type**: Regression
**Impact Level**: Important
**Priority**: High
**Related IDs**: F-3, AC-F3-1, NFR-9
**Test Type(s)**: Integration
**Automation Level**: Automated
**Target Layer / Location**: `scripts/.tests/test-bash-suite-aggregation-modes.sh`
**Tags**: @bash, @ci, @hermetic

**Preconditions**:

- Clean worktree at the start of the run.

**Steps**:

1. Record `git status --porcelain` and the checksums of the runner and the control before the run.
2. Run the control; capture wall time.
3. Record `git status --porcelain` afterwards; assert identical.
4. Assert the temp tree is gone after exit (including on failure paths via `trap`).
5. Assert no committed or worktree path matching `test-*` contains the planted failing-suite marker.
6. Assert wall time is within 60 seconds (NFR-9).

**Expected Outcome**:

- No tracked-file mutation, no leftover state, no fake suite discoverable by the real runner, bounded runtime.

#### TC-CIPROP-011 - Nested invocation is scoped: no recursion, one synthetic suite

**Scenario Type**: Corner Case
**Impact Level**: Critical
**Priority**: High
**Related IDs**: F-3, AC-F3-1, NFR-9, NFR-10
**Test Type(s)**: Integration
**Automation Level**: Automated
**Target Layer / Location**: `scripts/.tests/test-bash-suite-aggregation-modes.sh`
**Tags**: @bash, @ci, @negative-control

**Preconditions**:

- The control's synthetic root contains only the planted failing suite (no copy of the control, no real repository suites).

**Steps**:

1. Inspect (or assert programmatically) that the synthetic root's discovered set is exactly one suite and that its name is the planted one.
2. Run the control with a bounded timeout; assert it terminates with exit 0.
3. Assert the nested runner's log shows exactly one executed suite.
4. Assert the control cannot see the repository's real suite set (e.g., no repo suite name appears in the nested log).

**Expected Outcome**:

- Single-level nesting, bounded work, no recursion; the control proves propagation without inflating CI time.

#### TC-CIPROP-012 - The bash-tests job invokes the runner, not find -exec, and states the real contract

**Scenario Type**: Contract
**Impact Level**: Critical
**Priority**: High
**Related IDs**: F-1, F-2, F-7, AC-F1-1, AC-F2-1, AC-F7-1, DM-2
**Test Type(s)**: Contract
**Automation Level**: Automated
**Target Layer / Location**: `scripts/.tests/test-bash-suite-aggregation.sh` (tree assertion) plus review of `.github/workflows/ci.yml`
**Tags**: @bash, @ci, @workflow

**Preconditions**:

- Workflow edited (subject to GAP-2 / OQ-1).

**Steps**:

1. Parse `.github/workflows/ci.yml` and locate the `bash-tests` job's suite-execution step.
2. Assert the step invokes the runner script (by path) and that the repository contains that script as an executable file.
3. Assert the workflow text contains no `-exec bash` invocation for suite execution.
4. Assert the job comment states the aggregation contract (runner aggregates child statuses; failure of any suite fails the job) and contains no claim that `set -e` fails the job on the first failing suite.
5. Assert the three CI-safe exclusions still apply at the aggregation layer (validated behaviourally by TC-CIPROP-005).

**Expected Outcome**:

- The job's text and behaviour agree: the runner is the single aggregation truth, and the comment no longer documents a property the invocation does not have.

**Notes / Clarifications**:

- The comment assertion is shared with TC-DOC-001 (AC-F7-1); the workflow-text assertion is the tree invariant, never a diff-against-base assertion.

#### TC-CIPROP-013 - PR CI run demonstrates propagation end to end (evidence recorded)

**Scenario Type**: Happy Path
**Impact Level**: Critical
**Priority**: High
**Related IDs**: F-3, AC-F1-1, AC-F3-1, NFR-2, NFR-5, DEC-6
**Test Type(s)**: E2E
**Automation Level**: Manual
**Target Layer / Location**: GitHub Actions `bash-tests` job on the GH-251 PR (juliusz-cwiakalski/agentic-delivery-os)
**Tags**: @ci, @evidence

**Preconditions**:

- PR opened against `main-tools` with the change branch.

**Steps**:

1. Open the `bash-tests` job log of the PR's green run.
2. Confirm every discovered suite is reported by name and the job concludes success.
3. Confirm the control suite ran (by name) and printed: the planted suite, the observed non-zero runner exit, and its `[PASS]` verdict.
4. Confirm the log names no real repository suite as failed or skipped.
5. Record the run URL, job name, commit SHA, and the control's verdict lines in §10.

**Expected Outcome**:

- The green run itself demonstrates that a synthetic failing bash suite fails the runner (AC-F3-1 evidence shape, DEC-6). Optionally supplemented by a red demonstration run on the branch; not required.

#### TC-CIPROP-014 - CI topology, bindingness, supply-chain invariants and commitlint stay green

**Scenario Type**: Regression
**Impact Level**: Critical
**Priority**: High
**Related IDs**: AC-G6-1, NFR-6, RSK-2, DEC-7
**Test Type(s)**: Integration / Regression
**Automation Level**: Automated
**Target Layer / Location**: `scripts/checks/ci-topology.ts`, `scripts/checks/ci-bindingness.ts`, `scripts/checks/ci-supply-chain.ts`, `scripts/checks/script-surface.ts`; PR `ts-invariants` and `ts-commitlint` jobs; mutation coverage in `tests/checks/ci-checks.test.ts`
**Tags**: @ci, @invariants

**Preconditions**:

- Workflow modified; `origin/main-tools` fetched.

**Steps**:

1. Run `bun run scripts/checks/ci-topology.ts`, `ci-bindingness.ts`, `ci-supply-chain.ts`, and `script-surface.ts`; assert all exit 0.
2. Run `bun test tests/checks/ci-checks.test.ts`; assert green, including the new DEC-7 allowance fixtures owned by TC-CIPROP-015 (a passing check must still fail its mutation fixtures).
3. Assert `ts-commitlint` passes on the branch's commit messages.
4. Confirm no other workflow job was modified (see TC-SCOPE-001).

**Expected Outcome**:

- Every standing structural gate is green against the modified workflow, and the invariant checks are no weaker than before: the DEC-7 scoped allowance is the only relaxation, and it is negative-fixture-guarded (TC-CIPROP-015).

**Notes / Clarifications**:

- OQ-1 was resolved upstream in spec v1.1 (DEC-7, F-8, AC-F8-1, NFR-6 reworded): the required `ci.yml` removals are admitted only inside the `bash-tests` execution block and that job's comment lines. This TC keeps the standing gates honest; TC-CIPROP-015 proves the allowance does not generalize.

#### TC-CIPROP-015 - Scoped ci-topology allowance is minimal and non-vacuous (negative fixtures)

**Scenario Type**: Negative
**Impact Level**: Critical
**Priority**: High
**Related IDs**: F-8, AC-F8-1, NFR-6, DEC-7, RSK-7
**Test Type(s)**: Unit / Contract
**Automation Level**: Automated
**Target Layer / Location**: `tests/checks/ci-checks.test.ts` (new allowance fixtures) against `scripts/checks/ci-topology.ts`; PR `ts-invariants`
**Tags**: @ci, @invariants, @negative

**Preconditions**:

- `ci-topology` implements the DEC-7 allowance: removed `ci.yml` lines are ignored only inside the `bash-tests` job's execution block (`run:` step content) and that job's comment lines; all other removal and job-presence rules are unchanged.
- The removal rule is exercisable without a moving base branch: either the check exposes a pure `{baseText, headText} → violations` seam used by the fixtures, or the fixtures build a git-backed temp tree (the probe precedent). Neither shape changes production behaviour.

**Steps**:

1. Fixture A (allowance fires): base workflow versus head with the `bash-tests` execution-block lines and that job's comment lines replaced by the runner invocation → assert no "removes a base line" violation for those lines, while the job is still present and still invokes the runner.
2. Fixture B (does not generalize): remove one line from another job's step (e.g. `ts-invariants` or a sibling bash job) → assert the check fails naming that removed line.
3. Fixture C (job-presence fatal): delete the whole `bash-tests` job → assert the check fails naming the missing bash job.
4. Fixture D (job-id fatal): remove or rename a `ts-*` job id, and separately a bash job id other than `bash-tests` → assert the check fails naming the missing job in both cases.
5. Fixture E (boundary precision): remove a line immediately adjacent to — but outside — the allowed execution block/comments → assert the check still fails.
6. Non-vacuity: assert Fixture A fails when the allowance is disabled (fixture-level toggle or a mutated copy of the check), proving the fixture genuinely exercises the allowance instead of passing through another path.
7. Run the live check against the actual modified workflow; assert exit 0 and that the check exposes no bypass flag or "skip diff" switch.

**Expected Outcome**:

- The only relaxation is the DEC-7 allowance; any removal outside the `bash-tests` execution block/comment and any job-id change is still fatal. The committed fixtures make the allowance non-vacuous (0 allowance generalizations — the NFR-6 threshold).

**Notes / Clarifications**:

- This TC is the executable form of AC-F8-1 and the test-side answer to spec RSK-7 (precedent concern): a future widening of the allowance fails Fixtures B–E, and deleting the fixtures is a review-blocking diff caught by TC-SCOPE-001.
- Fixtures assert the rule over committed base/head text (or a git-backed temp tree), never a diff against the moving `origin/main-tools` base inside the permanent suite (testing-strategy invariant rule).

#### TC-UTF8LIMIT-001 - YAML check site: five-class byte boundary matrix

**Scenario Type**: Edge Case
**Impact Level**: Critical
**Priority**: High
**Related IDs**: F-4, F-6, DM-1, AC-F4-1, AC-F6-1, NFR-3, NFR-4
**Test Type(s)**: Unit
**Automation Level**: Automated
**Target Layer / Location**: `tests/behaviour/config-parser.test.ts` (`parseConfigYaml` from `@delivery-os/adapters/file`)
**Tags**: @ts, @parser, @boundary

**Preconditions**:

- Deterministic fixture builder producing a valid minimal YAML document (`x-test: ok` plus comment padding) whose UTF-8 byte length is a requested target; target 1048576.

**Steps**:

1. Build a valid document of exactly 1048576 bytes containing multibyte characters; assert `parseConfigYaml(...).ok === true` and the parsed facts equal the unpadded document's facts.
2. Build the same document at 1048577 bytes; assert `ok === false` and `error.code === "config.file.malformed"`.
3. Build the same document at 1048575 bytes; assert `ok === true`.
4. Build a multibyte document whose `text.length` (UTF-16 code units) is ≤ 1048576 while its UTF-8 bytes are > 1048576; assert `ok === false` with the same identity — and assert the precondition (`text.length <= 1048576 < byteLength`) so the case provably discriminates bytes from code units.
5. Build an all-ASCII document of exactly 1048576 bytes; assert `ok === true` (unchanged versus today).

**Expected Outcome**:

- Bytes, never code units, decide all five cases; at-or-under parses as today; over-limit is rejected fail-closed with today's identity.

#### TC-UTF8LIMIT-002 - pm-notes parse site: five-class byte boundary matrix

**Scenario Type**: Edge Case
**Impact Level**: Critical
**Priority**: High
**Related IDs**: F-5, F-6, DM-1, AC-F5-1, AC-F6-1, NFR-3, NFR-4
**Test Type(s)**: Unit
**Automation Level**: Automated
**Target Layer / Location**: New `tests/behaviour/pm-notes-source-limits.test.ts` (`parsePmNotesText` from `@delivery-os/adapters/file`)
**Tags**: @ts, @parser, @boundary, @pm-notes

**Preconditions**:

- Deterministic builder producing a valid pm-notes-shaped document (`change_id`, `title`, `phases:` plus comment padding) at a requested byte length.

**Steps**:

1. Exactly 1048576 bytes with multibyte content → `ok === true` with the expected parsed value.
2. 1048577 bytes → `ok === false`, `reason === "malformed"`, `parseFailure.class === "syntax"`, `parseFailure.location` equal to the supplied file argument.
3. 1048575 bytes → `ok === true`.
4. Code units ≤ 1048576 but bytes > 1048576 → rejected with the same identity; assert the discriminating precondition.
5. All-ASCII at exactly 1048576 bytes → `ok === true`.

**Expected Outcome**:

- Identical byte-accurate, fail-closed behavior at the parse site with the unchanged `PmNotesParseFailure` shape.

#### TC-UTF8LIMIT-003 - pm-notes stage site: five-class byte boundary matrix

**Scenario Type**: Edge Case
**Impact Level**: Critical
**Priority**: High
**Related IDs**: F-5, F-6, DM-1, AC-F5-1, AC-F6-1, NFR-3, NFR-4
**Test Type(s)**: Unit
**Automation Level**: Automated
**Target Layer / Location**: `tests/behaviour/pm-notes-source-limits.test.ts` (`stagePmNotesPhaseEntry` from `@delivery-os/adapters/file`)
**Tags**: @ts, @parser, @boundary, @pm-notes, @write-path

**Preconditions**:

- Same builder; the document contains a `phases` map with the target phase entry and a valid edit object (`started`/`completed`).

**Steps**:

1. Exactly 1048576 bytes with multibyte content → `ok === true`; the staged text reflects the edit (proves the parse/stage path proceeded normally).
2. 1048577 bytes → `ok === false`, `parseFailure` = `{ class: "syntax", location: "document" }`.
3. 1048575 bytes → `ok === true`.
4. Code units ≤ 1048576 but bytes > 1048576 → rejected with the same `{ class: "syntax", location: "document" }` identity; assert the discriminating precondition.
5. All-ASCII at exactly 1048576 bytes → `ok === true`.

**Expected Outcome**:

- The second pm-notes check site is byte-accurate too, with its own unchanged failure shape (distinct from the parse site: `location: "document"`).

#### TC-UTF8LIMIT-004 - Every boundary fixture self-verifies its byte and code-unit counts

**Scenario Type**: Contract
**Impact Level**: Critical
**Priority**: High
**Related IDs**: F-6, AC-F4-1, AC-F5-1, AC-F6-1, NFR-3
**Test Type(s)**: Contract
**Automation Level**: Automated
**Target Layer / Location**: Both parser test files (shared helper)
**Tags**: @ts, @parser, @boundary, @self-verifying

**Preconditions**:

- The fixture builder is shared by TC-UTF8LIMIT-001..003.

**Steps**:

1. For every fixture in every matrix, assert `Buffer.byteLength(text, "utf8")` equals the intended class target (1048576, 1048577, 1048575, or > 1048576).
2. Assert `text.length` equals the intended code-unit property for each class (in particular, the fourth class asserts `text.length <= 1048576`).
3. Assert the builder fails loudly (throws/asserts) if a requested target is unreachable with the chosen padding, instead of silently producing a near-miss.
4. Assert the three matrices together cover `3 sites × 5 classes = 15` explicit boundary cases (a completeness count that cannot silently shrink).

**Expected Outcome**:

- No boundary test can pass vacuously because its fixture was not actually at the boundary; the class set is complete and mechanically countable.

#### TC-UTF8LIMIT-005 - Over-limit identities are exactly today's at every site

**Scenario Type**: Regression
**Impact Level**: Critical
**Priority**: High
**Related IDs**: F-4, F-5, AC-F4-1, AC-F5-1, NFR-4, DEC-4
**Test Type(s)**: Unit
**Automation Level**: Automated
**Target Layer / Location**: Both parser test files; `bun run scripts/checks/error-table-sync.ts`
**Tags**: @ts, @parser, @identity

**Preconditions**:

- Over-limit fixtures from the three matrices.

**Steps**:

1. For the YAML site, assert deep equality with `{ ok: false, error: { kind: "config", code: "config.file.malformed", layer, file } }` — including the *absence* of a `line` field.
2. For the pm-notes parse site, assert deep equality with `{ ok: false, reason: "malformed", file, parseFailure: { class: "syntax", location: file } }`.
3. For the pm-notes stage site, assert deep equality with `{ ok: false, parseFailure: { class: "syntax", location: "document" } }`.
4. Assert no new error code string is introduced (no `size`/`limit`-specific code anywhere in the failure objects).
5. Run the error-table sync check and assert green, proving the documented table and the emitted identities still agree in both directions.

**Expected Outcome**:

- The repair changes measurement, not taxonomy: zero identity changes (DEC-4, NFR-4).

#### TC-UTF8LIMIT-006 - Accepted-at-limit sources parse identically to today

**Scenario Type**: Regression
**Impact Level**: Important
**Priority**: Medium
**Related IDs**: AC-F4-1, AC-F5-1, NFR-3
**Test Type(s)**: Unit
**Automation Level**: Automated
**Target Layer / Location**: Both parser test files
**Tags**: @ts, @parser, @regression

**Preconditions**:

- The accepted fixtures and their unpadded twins (same content, no padding).

**Steps**:

1. For each accepted class (exact-limit multibyte, one-under, ASCII-at-limit), assert the parsed facts/value deep-equals the unpadded document's parsed facts/value.
2. For the stage site, assert the staged text differs from the input only in the edited phase entry (padding preserved verbatim).
3. Assert no warning/diagnostic surface changed for accepted documents.

**Expected Outcome**:

- Tightening the limit changed no accepted-input behavior; sources at or under the limit behave exactly as before (§8.5).

#### TC-UTF8LIMIT-007 - Byte-length computation is pure; no new boundary edges

**Scenario Type**: Contract
**Impact Level**: Critical
**Priority**: High
**Related IDs**: F-4, AC-G6-1, NFR-7
**Test Type(s)**: Unit
**Automation Level**: Automated
**Target Layer / Location**: The byte-length helper named in §7 (shared/imported or local) + `bun test tests/boundaries` + `bun run scripts/checks/ambient-globals.ts`
**Tags**: @ts, @parser, @purity

**Preconditions**:

- The helper's location is recorded in the §7 mapping (GAP-4).

**Steps**:

1. Assert the helper's defining module has no `node:` or `bun:` import specifiers (source assertion over that file).
2. Assert the helper's body contains none of `TextEncoder`, `Buffer`, `encodeURIComponent`, `process`, `Bun`, `Math.random` (source-token assertion limited to the helper function).
3. Assert the helper computes from code points (presence of `codePointAt` and 1/2/3/4-byte branches) so the pattern remains the documented one.
4. Run `bun test tests/boundaries` and `bun run scripts/checks/ambient-globals.ts`; assert green.
5. Assert `pnpm check:boundaries` reports no new dependency edge (if the core helper is imported, the edge is declared and fixture-covered).

**Expected Outcome**:

- The computation stays runtime-neutral and pure; no ambient global enters a neutral tier; any new edge is declared and boundary-covered rather than silently allowed.

**Notes / Clarifications**:

- The existing ambient-globals guard covers only core neutral tiers and does not ban `TextEncoder`/`Buffer`, so the explicit source assertion is the enforcement for the adapter-side helper.

#### TC-UTF8LIMIT-008 - Existing parser suites and non-limit behavior are unchanged

**Scenario Type**: Regression
**Impact Level**: Critical
**Priority**: High
**Related IDs**: AC-G6-1, NFR-5, NFR-8
**Test Type(s)**: Integration
**Automation Level**: Automated
**Target Layer / Location**: `bun test tests/behaviour/config-parser.test.ts tests/behaviour/pm-notes-corpus.test.ts tests/behaviour/phase-transitions.test.ts tests/behaviour/phase-idempotency.test.ts tests/behaviour/phase-envelope.test.ts tests/behaviour/phase-rejections.test.ts`
**Tags**: @ts, @regression

**Preconditions**:

- Parser repair landed.

**Steps**:

1. Run the existing suites above; assert green with no assertion rewrites in their existing cases.
2. Assert no existing test case was deleted or weakened (reviewed diff of the touched test files).
3. Assert non-limit limits still behave: node/depth/alias bounds, unique-keys, unsupported tags, multi-document rejection, host-switch guard.
4. Assert the second parser's node/depth/alias behavior and the stage path's key-preservation behavior are unchanged.

**Expected Outcome**:

- Only the size measurement changed; every other parser guard and every existing expectation is intact.

#### TC-DOC-001 - Baseline note, FSE-05 row, and job comment tell the post-repair truth

**Scenario Type**: Happy Path
**Impact Level**: Important
**Priority**: High
**Related IDs**: F-7, AC-F7-1
**Test Type(s)**: Manual
**Automation Level**: Manual
**Target Layer / Location**: `doc/inception/analysis/phase-4-quality-baseline.md` (CI finding section), `doc/inception/analysis/fse-audit.md` (FSE-05 row), `.github/workflows/ci.yml` (bash-tests comment)
**Tags**: @docs, @review

**Preconditions**:

- Repair and workflow edits landed.

**Steps**:

1. Read the phase-4 CI finding section: it must record the finding as repaired, describing the aggregation runner and the negative control, and must not still say the gap is open.
2. Read the FSE-05 row: it must no longer assert that shell CI uses non-aggregating `find -exec` without correction.
3. Read the `bash-tests` job comment: it must state that the runner executes every suite and aggregates child statuses, and must not claim that `set -e` fails the job on a failing suite.
4. Cross-check that no other statement in those two documents now contradicts the landed behaviour.
5. Confirm the still-stale phase-7 reconciliation points are registered (Appendix C) rather than silently expanded in this change.

**Expected Outcome**:

- The in-change documentation records the repair as landed and the job comment documents the real contract.

#### TC-SCOPE-001 - Change confinement: only the two repairs and their evidence move

**Scenario Type**: Regression
**Impact Level**: Critical
**Priority**: High
**Related IDs**: AC-G6-1, NFR-4, NFR-8, DEC-4, DEC-5, NG-1..NG-7
**Test Type(s)**: Manual
**Automation Level**: Manual
**Target Layer / Location**: Whole diff (`git diff --name-only origin/main-tools...HEAD`, `git diff --stat`, per-file review)
**Tags**: @review, @scope

**Preconditions**:

- Delivery branch with all phase commits.

**Steps**:

1. List changed files and classify each as: runner, control, test evidence, workflow `bash-tests` job, the DEC-7 scoped ci-topology allowance and its negative fixtures, one of the two parser files, their test files, the two documentation records, or the changeset (if any). Assert nothing is unclassified.
2. Assert `packages/core/src/domain/verify-gates.ts` is untouched and `VERIFY_GATES_MAX_SUMMARY_BYTES` behavior is unchanged (DEC-5).
3. Assert no error-table entry changed and no error code was added/renamed.
4. Assert the limit constant name and value are unchanged (still `MAX_SOURCE_BYTES` = `1_048_576`) and no rename-to-characters occurred.
5. Assert no other invariant check changed (`ci-topology`'s DEC-7 allowance and its fixtures are the only invariant change), no other parser, engine, package, or workflow job changed, and `ts-*` jobs, guard jobs, and commitlint definitions are byte-identical.
6. Assert `scripts/install.sh`'s `ADOS_DELIVERY_SCRIPTS` / `ADOS_DELIVERY_TOOLS` arrays are unchanged (the runner and control are repo-internal CI automation, not user-installed delivery infrastructure).
7. Assert no privacy/support-environment/OPEN-Q15-human work slipped in.

**Expected Outcome**:

- Behaviour changes are confined to the two repairs; the diff contains no opportunistic edits (AC-G6-1).

#### TC-QUAL-001 - Local gate battery and shell hygiene are green before delivery closes

**Scenario Type**: Regression
**Impact Level**: Critical
**Priority**: High
**Related IDs**: NFR-5, NFR-6, NFR-8, NFR-9
**Test Type(s)**: Integration
**Automation Level**: Automated (commands) + Manual (evidence recording)
**Target Layer / Location**: Repository root
**Tags**: @gates, @bash, @ts

**Preconditions**:

- All repairs and tests implemented; dependencies installed (`pnpm install --frozen-lockfile`).

**Steps**:

1. Run `pnpm check`; assert green (lint, format:check, typecheck, test, check:boundaries).
2. Run the full local bash battery through the new runner (`bash scripts/run-bash-suites.sh` or the delivery-bound equivalent) and assert it exits 0 and reports the complete discovered set (all `scripts/.tests` and `tools/.tests` suites, minus the documented CI exclusions).
3. Run `git diff --check`; assert no whitespace errors or conflict markers.
4. Run `shellcheck -S error` on the new runner and control (or confirm the CI `shellcheck` job is green on the branch); run `bash -n` on both; assert both scripts are executable.
5. Record runner wall time and control wall time (NFR-9 evidence) and compare the `bash-tests` job duration with a comparable pre-change run to summarize the overhead share (observational, OQ-4).
6. Record the command, exit code, and a one-line summary for each step in §10.

**Expected Outcome**:

- The full local battery is green before the PR, and the recorded evidence covers both repairs plus the standing gates.

## 6. Environments and Test Data

- **Local environment:** Linux, bash ≥ 5 with `set -Eeuo pipefail`, `jq`, `git`, Bash test suites require no Bun; TypeScript suites require Bun 1.4.4 and `pnpm install --frozen-lockfile`. No network, no `$HOME` dependence, no real clock, no sleeps.
- **CI environment:** GitHub Actions `ubuntu-latest`, `bash-tests` job (Checkout + `jq` install + suite execution), `ts-*` jobs for the TypeScript battery. Action versions are unchanged by this change.
- **Synthetic suite trees (repair 1):** created at runtime under `mktemp -d`, containing only fixture suites with controlled exit codes and marker writes; removed by `trap` in every path. The negative control's tree is separate from any real `.tests/` directory so the real job can never discover the planted failing suite (asserted by TC-CIPROP-010).
- **Boundary documents (repair 2):** generated deterministically in-test from a minimal valid document plus padding of known UTF-8 widths (`a` = 1 byte, `é` = 2 bytes, `€` = 3 bytes, `😀` = 4 bytes) to hit exact byte targets. No multi-megabyte blob is committed: generation keeps the fixture exactly at the boundary and reviewable, and every generated fixture asserts its own byte and code-unit counts before use (TC-UTF8LIMIT-004). Commentary lines are used for padding so the document stays valid and node-count guards are unaffected.
- **Reference byte counts:** `Buffer.byteLength(text, "utf8")` inside the tests (tests are allowed Node/Bun APIs; the *production* computation is not). This is the independent oracle for NFR-3.
- **Isolation:** no test mutates a tracked file; the control and the runner suites operate on temp trees only; the TypeScript suites construct documents in memory. Deterministic ordering is asserted for discovery and for fixture generation.
- **Failure artifacts:** none committed. CI logs are the artifact; the PR run link is recorded in §10.

## 7. Automation Plan and Implementation Mapping

| TC ID | Test file (create/update) | Execution command | Seams / mocks | Status |
|-------|---------------------------|-------------------|---------------|--------|
| TC-CIPROP-001 | `scripts/.tests/test-bash-suite-aggregation.sh` (new) | `bash scripts/.tests/test-bash-suite-aggregation.sh` | Temp root / copied runner tree (GAP-3) | To Implement |
| TC-CIPROP-002 | same | same | Temp root with failing suite | To Implement |
| TC-CIPROP-003 | same | same | Temp root with two failing suites | To Implement |
| TC-CIPROP-004 | same | same | Per-suite marker counters | To Implement |
| TC-CIPROP-005 | same | same | Fixture tree + independent `find` oracle | To Implement |
| TC-CIPROP-006 | same | same | Dangling symlink fixture | To Implement |
| TC-CIPROP-007 | same | same | Empty temp root | To Implement |
| TC-CIPROP-008 | `scripts/.tests/test-bash-suite-aggregation-modes.sh` (new, the committed control) | `bash scripts/.tests/test-bash-suite-aggregation-modes.sh` | Synthetic tree + the same runner artifact | To Implement |
| TC-CIPROP-009 | same | same | Runner-path override / mutated stub runner (documented seam) | To Implement |
| TC-CIPROP-010 | same | same | `git status` + checksum before/after; `trap` cleanup | To Implement |
| TC-CIPROP-011 | same | same | Synthetic root with exactly one planted suite | To Implement |
| TC-CIPROP-012 | `scripts/.tests/test-bash-suite-aggregation.sh` (static section) | `bash scripts/.tests/test-bash-suite-aggregation.sh` | Reads `.github/workflows/ci.yml` and the runner path | To Implement |
| TC-CIPROP-013 | No new file — CI evidence recorded in §10 | PR run → `bash-tests` job log | GitHub Actions | Completed — CI evidence in §10 |
| TC-CIPROP-014 | No new file — `scripts/checks/ci-topology.ts` gains the DEC-7 scoped allowance; existing checks and their mutation tests | `bun run scripts/checks/ci-topology.ts && bun run scripts/checks/ci-bindingness.ts && bun run scripts/checks/ci-supply-chain.ts && bun run scripts/checks/script-surface.ts`; `bun test tests/checks/ci-checks.test.ts` | `origin/main-tools` present | Existing — Update |
| TC-CIPROP-015 | `tests/checks/ci-checks.test.ts` (new allowance fixtures) | `bun test tests/checks/ci-checks.test.ts` | Committed base/head workflow texts (or a git-backed temp tree) | To Implement |
| TC-UTF8LIMIT-001 | `tests/behaviour/config-parser.test.ts` (update) | `bun test tests/behaviour/config-parser.test.ts` | Generated boundary fixtures | Existing — Update |
| TC-UTF8LIMIT-002 | `tests/behaviour/pm-notes-source-limits.test.ts` (new) | `bun test tests/behaviour/pm-notes-source-limits.test.ts` | Generated boundary fixtures | To Implement |
| TC-UTF8LIMIT-003 | same | same | Generated boundary fixtures + valid phase edit | To Implement |
| TC-UTF8LIMIT-004 | shared helper inside the two parser test files (or `tests/fixtures/source-limits/harness.ts`) | both commands above | `Buffer.byteLength` oracle | To Implement |
| TC-UTF8LIMIT-005 | both parser test files; `bun run scripts/checks/error-table-sync.ts` | both commands above + the check | Deep-equality on failure objects | To Implement |
| TC-UTF8LIMIT-006 | both parser test files | both commands above | Unpadded twin documents | To Implement |
| TC-UTF8LIMIT-007 | new assertion in `tests/structure/` (e.g. `tests/structure/source-limit-purity.test.ts`) + existing checks | `bun test tests/structure/source-limit-purity.test.ts`; `bun test tests/boundaries`; `bun run scripts/checks/ambient-globals.ts` | Source read of the helper module whose path is recorded in this mapping at delivery planning | To Implement |
| TC-UTF8LIMIT-008 | no new file — existing suites | `bun test tests/behaviour` (targeted files listed in the scenario) | none | Existing — No Change |
| TC-DOC-001 | no test file | Manual review with `git diff` + file reads | none | Manual Only |
| TC-SCOPE-001 | no test file | `git diff --name-only origin/main-tools...HEAD`, `git diff --stat` | none | Manual Only |
| TC-QUAL-001 | no test file | `pnpm check`; `bash scripts/run-bash-suites.sh`; `git diff --check`; `shellcheck -S error` and `bash -n` on the new runner and control | none | Manual/Automated evidence |

**Delivery-bound artifacts to name in `chg-GH-251-plan.yaml`** (names below are proposals, not requirements):

- Suite-aggregation runner: proposal `scripts/run-bash-suites.sh` (invoked by the `bash-tests` job).
- Runner contract suite: proposal `scripts/.tests/test-bash-suite-aggregation.sh`.
- Committed negative control: proposal `scripts/.tests/test-bash-suite-aggregation-modes.sh` (this is the AC-F3-1 evidence vehicle).
- Byte-length helper: shared import of the core code-point→UTF-8 pattern or a local pure helper in the adapters file tier; the exact path must be recorded so TC-UTF8LIMIT-007 has a stable anchor.

## 8. Risks, Assumptions, and Open Questions

### 8.1 Risks

| ID | Risk | Impact | Mitigation |
|----|------|--------|------------|
| TR-1 | The DEC-7 allowance is implemented too broadly (e.g. whole-file removals or job-id removals admitted), weakening the topology invariant | H | TC-CIPROP-015 Fixtures B–E fail any generalization; TC-CIPROP-014 keeps the standing gates and their mutation fixtures green; the allowance is reviewer-flagged (RSK-7) |
| TR-2 | The negative control is itself false-green (passes even if the runner is unsound) or flaky | M | TC-CIPROP-009 asserts both counterfactual directions; TC-CIPROP-008 asserts the real direction; the control runs in every CI run so flakiness is immediately visible |
| TR-3 | Discovery drift while extracting the runner (missed, duplicated, or newly included suites) | M | TC-CIPROP-005 pins set equality against today's `find`; TC-CIPROP-004 pins exactly-once; TC-CIPROP-013 confirms the real set in CI |
| TR-4 | The control's nested runner invocation recurses or inflates CI time | M | TC-CIPROP-011 pins single-level scope and a bounded timeout; TC-CIPROP-010 asserts ≤ 60 s |
| TR-5 | 1 MiB accepted fixtures slow `bun test` noticeably | M | Rejected cases short-circuit before parsing; accepted cases are three per site; TC-QUAL-001 records wall time; fixtures are generated, not committed |
| TR-6 | Error identity drift hides behind "same code, different shape" (e.g., a new `line` field or a new `reason`) | M | TC-UTF8LIMIT-005 uses deep equality, not code-only assertions |
| TR-7 | A boundary test passes vacuously because its fixture is near but not at the boundary | M | TC-UTF8LIMIT-004 asserts every fixture's byte and code-unit counts and the 15-case completeness count |
| TR-8 | The purity requirement is unenforced by existing guards (adapters are outside the ambient-globals scope; `TextEncoder`/`Buffer` are not banned) | M | TC-UTF8LIMIT-007 adds the explicit source assertion for the helper |
| TR-9 | Documentation edits drift back to describing the old behaviour, or the phase-7 items are expanded in this change | L | TC-DOC-001 checks the two in-change records and confirms the remaining points stay registered |
| TR-10 | Scope creep into the adjacent verify-gates instance or OPEN-Q15 human part | L | TC-SCOPE-001 classifies every changed file and pins the untouched surfaces |
| TR-11 | The ci-topology allowance sets precedent for relaxing repository invariants (spec RSK-7) | M | Minimal scope asserted by TC-CIPROP-015 (one job's execution block plus its comment lines); the relaxation is recorded as change-scoped DEC-7 and placed on the open-PR human review agenda |

### 8.2 Assumptions

- **A-1:** The runner is repo-internal CI automation invoked from the repository root; its public contract is "exit non-zero iff a discovered suite failed or could not run" (DM-2), not a CLI grammar. The control may reach it through a copied tree or a scoped-root seam (GAP-3).
- **A-2:** For all well-formed strings, UTF-8 byte length ≥ UTF-16 code-unit length, so byte enforcement can only tighten acceptance. No previously rejected source can become accepted, and the only behaviour change is the intended rejection of multibyte sources over the byte budget.
- **A-3:** Tests run on Linux with bash ≥ 5; the suites use only `mktemp`, `git`, `sha256sum`/`cksum`, `find`, and coreutils already required by the existing suites. macOS/BSD behaviour is not asserted (CI is Ubuntu).
- **A-4:** Suite paths in this repository contain no spaces or newlines; the runner is not required to handle them, and the fixtures do not introduce them.
- **A-5:** `pnpm check` does not execute bash suites, so bash evidence is the runner invocation (local) plus the `bash-tests` job (CI); both are recorded separately.
- **A-6:** Parsing a 1 MiB valid document completes fast enough (well under a second each in Bun); if not, the accepted-class construction may be optimized without dropping any class.
- **A-7:** The error-table sync check and the documented error table are the authority for error identities; no new code is permitted by this repair (DEC-4).
- **A-8:** The runner and the control are **not** user-installed delivery infrastructure, so `scripts/install.sh`'s delivery arrays must not gain entries (TC-SCOPE-001 step 6).
- **A-9:** Zero discovered suites exits 0 (DM-2 read literally); non-vacuity is protected by fixture parity and CI log evidence rather than by an unrequested runtime guard (TC-CIPROP-007).
- **A-10:** The negative-control suite may be executed twice in the `bash-tests` job (once by discovery, once by any explicit step), following the accepted `test-delivery-mutation-sandbox.sh` / `test-doc-distribution-modes.sh` precedent; it must remain fast and idempotent.

### 8.3 Open Questions

| ID | Question | Blocking? | Owner | Recommended resolution |
|----|----------|-----------|-------|------------------------|
| OQ-1 | **RESOLVED in spec v1.1 (DEC-7, F-8, AC-F8-1, NFR-6).** The ci-topology additions-only rule forbade the required `ci.yml` removals. The spec adopts this plan's proposed resolution: removed lines are ignored only inside the `bash-tests` execution block and that job's comment lines; removals elsewhere and bash/ts job-presence enforcement stay fatal; non-vacuity is proved by committed negative fixtures. | No — resolved upstream | @spec-writer (upstream); @plan-writer implements TC-CIPROP-015 | Implement exactly as scoped and do not widen; TC-CIPROP-015 pins non-generalization (Fixtures B–E) and TC-CIPROP-014 keeps the standing gates honest. |
| OQ-2 | Which seam lets the control invoke "the same runner" against a synthetic tree: a copied tree preserving root resolution, or a scoped root argument to the runner? | No — delivery-bound | @plan-writer | Prefer the copied-tree precedent (`test-delivery-mutation-sandbox.sh`), which adds no runtime surface to the runner. |
| OQ-3 | Is the byte-length computation imported from core or replicated locally? | No — delivery-bound | @plan-writer | Follow purity/layering rules; either is acceptable, but record the path so TC-UTF8LIMIT-007 has a stable anchor. Importing from core's domain may create an adapters→core edge (allowed) but must be boundary-declared. |
| OQ-4 | NFR-9's "runner aggregation overhead ≤ 5 % of job wall time" cannot be asserted hermetically. Is observational before/after CI duration evidence acceptable? | No | @pm | Accept observational evidence recorded in §10; the hard, testable bound is the control's ≤ 60 s. |

## 9. Plan Revision Log

| Version | Date | Author | Changes |
|---------|------|--------|---------|
| 1.0 | 2026-11-06 | @test-plan-writer | Initial test plan for GH-251. 25 TCs: 14 for failure-propagation (runner contract, negative control, workflow wiring, CI evidence, invariants), 8 for byte-accurate input limits (three sites × five boundary classes plus self-verification, identity stability, parse equivalence, purity, existing-suite regression), 3 for documentation truth, scope confinement, and the local gate battery. Records GAP-2/OQ-1: the CI topology additions-only invariant fails on the required `ci.yml` removal (verified by probe), blocking delivery planning. |
| 1.1 | 2026-11-06 | @test-plan-writer | Reconcile to spec v1.1 (open-item resolution): OQ-1 and GAP-2 closed upstream by the change-scoped DEC-7 allowance (F-8, AC-F8-1, NFR-6 reworded, RSK-7); new TC-CIPROP-015 pins the non-vacuity negative-fixture set (allowance fires; removal outside the execution block fails; whole-job removal fails; bash/ts job-id loops fatal; boundary precision; non-vacuity by disabled allowance), TC-CIPROP-014 notes/status updated; AC-F8-1 added to §3.1 (9 ACs, all covered) and F-8 to the capability map; NFR-6/NFR-8 coverage rows, §4 invariant layer, §7 mapping, scope classification (TC-SCOPE-001), and the risk table (TR-1 rewritten, TR-11 added for RSK-7) updated; counts 25→26 TCs. |
| 1.2 | 2026-11-06 | @test-plan-writer | Record AC-F3-1 / DEC-6 evidence at plan task 4.4: TC-CIPROP-013 flipped to COMPLETED from the PR #257 green `bash-tests` run (job 128105591655, head `e7b5bcaa`), with canonical run URLs (normalized from the pr-manager report), the 7/7 control verdict lines verbatim, 24/24 suite aggregate, and the temp-child-log caveat; §7 status flipped to Completed; GAP-1 notes execution evidence complete. All 26 TCs now have §10 evidence. |

## 10. Test Execution Log

Populated during delivery (phases 6 and 9) and at PR creation (phase 11). One row per executed TC, with the command, result, and evidence location (local log path or CI run URL). TC-CIPROP-013 must carry the PR run URL, job name, commit SHA, and the control's verdict lines.

| TC ID | Run Date | Result | Notes / Evidence |
|-------|----------|--------|------------------|
| TC-CIPROP-001..007, TC-CIPROP-012 | 2026-11-06 | PASS | `bash scripts/.tests/test-bash-suite-aggregation.sh` — 8/8 (runner contract, discovery parity, unrunnable-is-failure, workflow wiring). |
| TC-CIPROP-008..011 | 2026-11-06 | PASS | `bash scripts/.tests/test-bash-suite-aggregation-modes.sh` — green propagation path, always-zero and selective-runner counterfactuals, restored-runner non-vacuity, hermetic status/checksum equality, 0 s bounded runtime. |
| TC-CIPROP-013 | 2026-11-06 | PASS — COMPLETED | PR #257 green `bash-tests` job (id 128105591655) at head `e7b5bcaa`; control verdicts 7/7 `[PASS]`; 24 suites discovered / 24 passed / 0 failed. Full run URLs, job fields, verbatim verdict lines, and the temp-log caveat in the AC-F3-1 / DEC-6 evidence block below. |
| TC-CIPROP-014 | 2026-11-06 | PASS | `bun test tests/checks/ci-checks.test.ts` 35/35; `ci-topology`, `ci-bindingness`, `ci-supply-chain`, `script-surface` all exit 0. |
| TC-CIPROP-015 | 2026-11-06 | PASS | DEC-7 fixtures A-E and disabled-allowance non-vacuity inside the same 35/35 `ci-checks` run; live tree green under the allowance. |
| TC-UTF8LIMIT-001..003 | 2026-11-06 | PASS | `bun test tests/behaviour/config-parser.test.ts tests/behaviour/pm-notes-source-limits.test.ts` — 25/25; 3 sites x 5 boundary classes, exact identities, accepted-at-limit equivalence. |
| TC-UTF8LIMIT-004 | 2026-11-06 | PASS | Same 25/25 run: every fixture self-verifies `Buffer.byteLength`/`text.length`; completeness count 15; unreachable targets throw. |
| TC-UTF8LIMIT-005 | 2026-11-06 | PASS | Deep-equality over-limit objects at all three sites; `bun run scripts/checks/error-table-sync.ts` green (60 entries). |
| TC-UTF8LIMIT-006 | 2026-11-06 | PASS | Accepted classes deep-equal their unpadded twins; stage text preserves padding verbatim. |
| TC-UTF8LIMIT-007 | 2026-11-06 | PASS | `bun test tests/structure/source-limit-purity.test.ts` 4/4; `pnpm check:boundaries` green (203 modules). |
| TC-UTF8LIMIT-008 | 2026-11-06 | PASS | `bun test tests/behaviour/pm-notes-corpus.test.ts tests/behaviour/phase-transitions.test.ts tests/behaviour/phase-idempotency.test.ts tests/behaviour/phase-envelope.test.ts tests/behaviour/phase-rejections.test.ts` — 51/51, no assertion rewrites. |
| TC-DOC-001 | 2026-11-06 | PASS | Phase-4 baseline CI section and FSE-04/FSE-05/FSE-08 rows updated; fse-audit FSE-04/FSE-05 updated; `bash-tests` comment states the runner contract with no `set -e` fail-fast claim. |
| TC-SCOPE-001 | 2026-11-06 | PASS | Full diff classified below; `packages/core/src/domain/verify-gates.ts` untouched; no error-table change; `MAX_SOURCE_BYTES` name/value unchanged; `scripts/install.sh` arrays untouched; ci-topology is the only invariant change. |
| TC-QUAL-001 | 2026-11-06 | PASS | `pnpm check` exit 0 (3799 tests, 4 skip, 0 fail); `bash scripts/run-bash-suites.sh` 24/24 exit 0; `git diff --check` clean; `bash -n` clean; `shellcheck -S error` 0.10.0 clean on the runner and both suites. |

**AC-F3-1 / DEC-6 evidence (TC-CIPROP-013 — COMPLETED):**

- **PR:** #257 — https://github.com/juliusz-cwiakalski/agentic-delivery-os/pull/257 (base `main-tools`).
- **PR CI run:** completed / success, all 23 jobs green — https://github.com/juliusz-cwiakalski/agentic-delivery-os/actions/runs/42279824959 (URL normalized from pr-manager report; run id 42279824959 is the stable identifier).
- **Companion push-event run:** https://github.com/juliusz-cwiakalski/agentic-delivery-os/actions/runs/42279710912 (URL normalized from pr-manager report; run id 42279710912 is the stable identifier).
- **Head SHA:** `e7b5bcaa57e612f2924c2391396cffc07ec85e44`.
- **Job:** "Bash test suites" (`bash-tests`), job id `128105591655` — verdict success.
- **Aggregate:** discovered 24 suites; 24 passed; 0 failed. This is the first real `bash-tests` run to pass 24/24, live confirmation of the F-2 remediation — the suite that previously could not pass in CI now passes.
- **Control verdict lines (verbatim from the job log):**

```
(bash-suite-aggregation-control)[PASS] green path: propagation demonstrated and verdict printed
(bash-suite-aggregation-control)[PASS] counterfactual: an always-zero runner makes the control fail
(bash-suite-aggregation-control)[PASS] counterfactual: a runner green on the planted suite makes the control fail
(bash-suite-aggregation-control)[PASS] counterfactual: the restored real runner makes the control pass
(bash-suite-aggregation-control)[PASS] hermetic: worktree status and checksums identical, no leaked marker
(bash-suite-aggregation-control)[PASS] bounded runtime: 0s (limit 60s)
(bash-suite-aggregation-control)[PASS] negative control passed
```

- **Caveat:** the planted suite's `[FAIL]` line lives only in the control's temp child log (echoed on failure); the green-path assertion certifies propagation, and the two counterfactual stubs prove the control cannot pass if the runner goes green on the planted suite.

**Scope classification (TC-SCOPE-001):** runner (`scripts/run-bash-suites.sh`);
control and runner tests (`scripts/.tests/test-bash-suite-aggregation.sh`,
`scripts/.tests/test-bash-suite-aggregation-modes.sh`); workflow `bash-tests`
job (`.github/workflows/ci.yml`); DEC-7 allowance and fixtures
(`scripts/checks/ci-topology.ts`, `tests/checks/ci-checks.test.ts`,
`tests/checks/privacy-ci-wiring.test.ts`,
`tests/checks/privacy-release.test.ts`); parser
files (`packages/adapters/src/file/yaml-parser.ts`,
`packages/adapters/src/file/pm-notes-parser.ts`); parser tests
(`tests/behaviour/config-parser.test.ts`,
`tests/behaviour/pm-notes-source-limits.test.ts`,
`tests/fixtures/source-limits/harness.ts`,
`tests/structure/source-limit-purity.test.ts`); documentation
(`doc/inception/analysis/phase-4-quality-baseline.md`,
`doc/inception/analysis/fse-audit.md`); changeset
(`.changeset/gh-251-ci-failure-propagation-minor.md`); change artifacts. Nothing
unclassified.

**Spec-reconciliation handoff (phase 7, not delivery):** NFR-TOOL-005 gap line;
scaffold toolchain feature page "bash jobs remain byte-unchanged" sentence;
config-layer parser-limit wording; Q15/Q19 pointers if required; and the DEC-7
invariant allowance for reviewer visibility (RSK-7).
