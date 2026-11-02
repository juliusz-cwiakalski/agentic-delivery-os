# Code Review — GH-178: M0-S9 verify gates v1 (Iteration 2)

- **Work item:** GH-178 — "M0-S9: verify gates v1"
- **Mode:** local (ADOS pipeline, re-review after remediation)
- **Branch:** `feat/GH-178/verify-gates-v1`
- **Base:** `origin/main-tools`
- **Reviewed revision:** HEAD `623017e` (remediation `a660a8a` → `971a68e` → `f962ad1` → `623017e`)
- **Artifacts:** spec v1.5 (36 ACs), test plan v1.5 (70 TCs), plan v1.5 (10 phases, 59 tasks; Phase 9 9/9 checked)
- **Prior review:** `review/review-iter-1.md` — FAIL with blocking F-1, F-2, F-3a–F-3e, F-4
- **Diff scope:** remediation touches one source file (`packages/core/src/domain/verify-gates.ts`) plus tests/fixtures and two EOF-whitespace artifact edits; no new exports, contracts, error rows, gates, or operations
- **Reviewed at:** 2026-10-31 (review iteration 2)

## Status: PASS

All four blocking findings from iteration 1 are genuinely closed with the evidence the binding test plan names, the previous non-blocking N-5/N-7 items folded into remediation are also fixed, `pnpm check` is green, and `git diff --check` is clean. No new critical or high-severity defects were introduced. Two low-severity residuals remain (carried forward as non-blocking follow-ups); neither blocks merge.

## Blocking findings

None. F-1, F-2, F-3a–F-3e, and F-4 are all closed.

## Closure verification of iteration-1 findings

### F-1 — [High] Non-finite/negative/absent squash surface → `squash-surface-unknown` — CLOSED

`surfaceCount` (`packages/core/src/domain/verify-gates.ts:983`) now returns `undefined` unless the value is finite and non-negative, and `squashGate` consumes that single normalized value for **both** the decision and the citation (`:1089-1090`, decision at `:1117-1121`). The old raw `request.commitCount`/`request.changedFileCount` comparisons are gone.

- `NaN`, `+Infinity`, `-Infinity`, `-1`, and `undefined` on either field → `fail` / `squash-surface-unknown` (`:1117-1118`).
- A real `0` still yields `squash-no-commits`/`squash-no-changes` (`:1120-1121`); positive finite counts pass.
- `count()` is finite-guarded via `boundedCount` (`:84`) so a non-finite value can never serialize as `NaN`/`Infinity`.
- CI/parity page denominators are guarded via `boundedPageCount` (`:96`); a non-finite `pageItemCount` maps to the at-limit page → `ci-truncated` / `unknown`, never a vacuous pass.

Regression tests (would fail on the pre-fix revision):
- `tests/behaviour/verify-gates-parity-squash.test.ts:250` — TC-038 cases for `NaN`, `±Infinity`, `-1`, absent on each field (9 cases), asserting exact reason, integer/non-negative counts, and citation omission.
- `tests/behaviour/verify-gates-ci.test.ts:88` — TC-070 non-finite page sizes never serialize a non-integer count and yield `ci-truncated`/`unknown`.

### F-2 — [High] Structured `EvaluateVerifyChange` (DM-15) not behaviour-tested — CLOSED

Direct `EvaluateVerifyChange`/`classifyVerifyChange` tests now exist:
- `tests/behaviour/verify-change-classification.test.ts:980` — malformed document terminal failure, missing pm-notes target terminal failure, full incomplete, LITE incomplete, missing-phase ordering (required-set order), absent-registry branch, platform vs user state categories, and wrapper shape/byte parity. Terminal-failure field shape is asserted explicitly (`variant: "unknown"`, empty arrays, `declaration {0,0}`, empty `registry`, document `kind`/`code`).
- `tests/behaviour/verify-change-state.test.ts:281` — real `EvaluateVerifyChange` over torn/permission state failures with DM-15 structured fields and identity category.
- `tests/behaviour/verify-gates-lifecycle.test.ts:205` — the gates handler is driven through its `readLifecycle` seam, so the actual `EvaluateVerifyChange` output feeds the lifecycle citation end to end for missing/malformed/state-failure inputs (no hand-built `lifecycle({...})` object for these cases).

The handler does call the real evaluator (`packages/cli/src/commands/verify-gates.ts:118`), confirming the integration is exercised, not fabricated.

### F-3a — [High] TC-051 read budget / no-write / no-spawn — CLOSED

`tests/behaviour/verify-gates-read-budget.test.ts` records every injected seam and asserts exactly four provider reads (one each) at the declared limits, one lifecycle read through a guarded store, no `append`/`replaceDocument`/fence/`repairTornTail` calls, no `Bun.spawn`/`spawnSync`, no network, and byte-identical report/human/summary/exit replay. The guard fixtures are self-tested (`guardStore` throws on mutation, `createNoSpawnGuard` records `Bun.spawn`, `createNoNetworkGuard` rejects `fetch`).

### F-3b — [High] TC-059 live smoke + default no-live guard — CLOSED

- `tests/behaviour/verify-gates-live.test.ts` is now genuinely opt-in (`VERIFY_GATES_LIVE=1`, `describe.skip` by default), composes the real edge + environment credential port + fetch transport + real CI workflow, and asserts only structural invariants (five ordered gates, citation bounds, exit semantics) and secret-free stdout/stderr.
- `tests/checks/verify-gates-no-live-calls.test.ts` now scans the production edge (`edge.ts`, `verify.ts`, `verify-gates.ts`) and the default harness/facts modules for `fetch(` / `node:http(s)` / `Bun.connect`, self-tests the detector, and keeps the zero-call in-process assertion.

### F-3c — [High] TC-040/041/042 citation and summary negative controls — CLOSED

- `tests/structure/verify-gates-contract.test.ts` adds a citation-shape validator over the declared source/count/name/reason order, rejecting out-of-order counts/names, free-form `failureClass`, dual `failureCode`+`failureClass`, non-integer counts, over-cap names, and free-form reasons, plus a real-citation pass.
- `tests/behaviour/verify-gates-output.test.ts` adds the 9→8 name clamp with `omitted`, 120-char name and ref clamps, and a grammar checker proven to reject a zero alias (`counts=0`), a bare `counts=`, a bare `names=`, and an omitted segment, over the real output. It also adds the combined-maximum 4096-byte/6-line shrink (all five gate lines and both segments preserved) and distinct title/comment/commit/file/payload canaries asserted absent from machine and human stdout/stderr.
- The renderer no longer slices the block; it shrinks name lists while keeping exactly six lines (`renderVerifyGatesFailureSummary`, `:1250`).

### F-3d — [High] TC-058 corpus non-vacuity — CLOSED

The manifest (`tests/fixtures/verify-gates/corpus/cases.json`, 48 cases) now points each case at a real committed fixture under `corpus/fixtures/` (48 files), each with a unique canary and a per-case `squashSignals` expectation (empty or the ordered `draft=`,`mergeable=` pair). `tests/behaviour/verify-gates-corpus.test.ts` fails on empty/duplicate manifests, missing/unreadable/stale fixtures, stale reasons (now checked against the exact `VERIFY_GATES_REASONS` set), missing/fabricated squash signals, a pass declaration over a non-pass gate, any non-pass case that would emit success or exit 0, and a temp-copy missing a required case. Canary leakage into the report is checked.

### F-3e — [High] TC-063 pinned secret golden — CLOSED

`tests/behaviour/verify-gates-output.test.ts` now derives the expected `verify change` output from the committed golden bytes with a literal `changeRef` redaction replacement, never from a `redact()`-computed string. The JSON-escaping-sensitive secret (quote + backslash + newline) is asserted redacted on both the gates and change paths, and the golden suite compares committed bytes directly.

### F-4 — [High, iterative] `git diff --check` — CLOSED

`git diff --check origin/main-tools...HEAD` exits 0. The spec and test-plan edits in `a660a8a` remove only the trailing blank line at EOF (no content change).

## Non-blocking residuals (carried forward)

**R-1 — [Low] Failure-summary byte bound is compared in UTF-16 code units, not UTF-8 bytes.** `renderVerifyGatesFailureSummary` (`packages/core/src/domain/verify-gates.ts:1250`) and the new TC-042 fixture compare `string.length` against `VERIFY_GATES_MAX_SUMMARY_BYTES` (4096), while AC-F8-2/NFR-5 say "bytes". For the realistic ASCII job/branch/label/ref content the bound holds; a multibyte name list could exceed 4096 UTF-8 bytes while staying under 4096 code units. Same class as the already-deferred N-8; not reachable via the delivered GitHub path. Suggest `Buffer.byteLength` when hardening, or record the char-count interpretation in the spec.

**R-2 — [Low] N-1..N-4, N-6, N-8, N-9 remain deferred follow-ups.** The iteration-1 non-blocking placement/precedence/citation-shape/byte-bound items outside the remediation scope are not regressions and remain owner-assigned follow-ups as recorded in the plan. N-5 and N-7 were folded into this remediation and are fixed.

## Spec and plan compliance audit

**Gate rules, contracts, command surface, read-only/tier/boundary/privacy — PASS (unchanged from iteration 1).** The remediation touched one source file with no new exports, error rows, fields, gates, reasons, sources, counts, name kinds, adapter operations, subpaths, or runtime locations. `dependency-cruiser` (120 modules), `ambient-globals` (39 files), `workspace-entrypoints`, `secret-read-boundary` (103 files, 4 allowlisted), and `exports-parity` (5 publishables) all pass.

**Plan task audit — COMPLETE.** Phase 9 has nine checked tasks (9.1–9.9), each mapping one-to-one to a blocking finding and to the binding TC whose evidence now exists in the named file. The review-remediation map in the plan matches the code/tests. No task is checked on plan text alone.

**Traceability — PASS.** The new/expanded tests close TC-038, TC-040/041/042, TC-051, TC-057/058, TC-059, TC-063, TC-070, and TC-013/015/062. Coverage remains 36/36 ACs and 70/70 TCs.

## Test quality audit

- **Regression strength:** The F-1 negative cases assert the exact reason and citation omission and would fail on the pre-fix raw-comparison code; the F-3e expectation is independent of `redact()`; the corpus meta-test is non-vacuous (real per-case fixtures, canaries, signals, temp-copy missing-case control).
- **Determinism / no live calls:** Default suites inject pure facts/harness and perform zero network calls; the live smoke is skipped unless `VERIFY_GATES_LIVE=1`; the no-live check additionally scans the edge/harness sources.
- **No vacuous passes:** The read-budget recorder, the citation-shape validator, and the corpus completeness/non-vacuity checks all have self-tested negative controls.

## Evidence collected

| Check | Result |
|---|---|
| Focused remediation battery (`verify-gates-*`, `verify-change-*`, no-live-calls, golden) | 116 pass, 1 skip, 0 fail (1513 expectations) |
| Broader focused battery (+ `tests/structure/verify-gates-*`) | 190 pass, 1 skip, 0 fail (2831 expectations) |
| `pnpm check` (lint, format, typecheck, `pnpm test`, boundaries, exports-parity) | PASS — 1769 pass, 3 skip, 0 fail (16,406 expectations; 167 files) |
| `pnpm lint` / `pnpm format:check` | exit 0 / exit 0 (15 warnings, 5 infos, no errors) |
| `pnpm check:boundaries` | PASS — depcruise 120 modules, ambient 39, entrypoints, secret-read 103 files |
| `pnpm exports-parity` | PASS — 5 publishables |
| `git diff --check origin/main-tools...HEAD` | PASS — exit 0 |
| `git status --porcelain` after full build/tests | clean |
| Source remediation footprint | 1 file, no new exported symbols |

## Next step

`PROCEED`. All blocking findings are closed and the aggregate gate is green. Two low-severity residuals (R-1 summary byte-vs-char bound; R-2 the already-deferred N-1..N-4/N-6/N-8/N-9 follow-ups) are non-blocking. Continue to the quality-gates / dod_check phases; do not merge without the human PR approval step.

Status: PASS
