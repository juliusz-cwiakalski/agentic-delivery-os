# Code Review — GH-242 (Iteration 2)

- **Work item:** GH-242 (M1-S20 — Agent integration: prompts consume the tooling)
- **Mode:** local
- **Branch:** `feat/GH-242/agent-integration`
- **Base:** `origin/main-tools` (merge-base `f87ec185`)
- **Reviewed HEAD:** `edd6d123` (working tree clean except the review-lifecycle `iteration: 2` bump in pm-notes `phases:`)
- **Remediation delta:** `git diff 7cb57f11..HEAD` — 13 files, +1318 / −181 (commits `97dad325` phase 11, `edd6d123` evidence)
- **Reviewer:** reviewer (iteration 2)
- **Status:** **PASS**

## 1. Summary

Phase 11 restores the regression protection deleted by `41c7e38d` and closes every iteration-1 finding without touching delivered product code, prompts, or specs. `tests/checks/ci-checks.test.ts` is back to the full 37-test invariant suite (687 lines) with a single, required one-line change to the GH-172 aggregate pin; the new prompt/help scan-wiring assertions now live in a separate `tests/checks/ci-wiring.test.ts`. `tests/checks/privacy-authoring.test.ts` is byte-identical to its pre-`41c7e38d` state (8 tests: TC-PRIVACY-018/019, F-8), `runAuthoring` is used again, and the non-pilot fixture scan moved to its own `tests/checks/fixture-privacy.test.ts`. The test-plan §7/§10 is populated and declares pm-notes authoritative, the change-folder helpers have direct behavioural tests, prompt-conformance negation is sentence-local with a mutant, and the `commit --phase --dry-run` preview is pinned to the DEC-4 union.

I re-ran every restored/affected suite and the full aggregate test battery: the targeted suites pass (39 + 25 + 17), `plan validate GH-242` exits 0, and `bun test` reports **6005 pass / 4 skip / 0 fail across 6009 tests / 683 files**. No weakened assertions, no scope drift, no new flakiness. Two informational residuals are noted; neither is blocking.

## 2. Iteration-1 findings — verification

| ID | Verdict | Evidence |
|----|---------|----------|
| F-1 | **Resolved** | `tests/checks/ci-checks.test.ts` = 687 lines / 37 tests, identical to pre-`41c7e38d` except line 576 (GH-172 aggregate pin updated to include the two new scans, matching the live `package.json` `check` script). All mutation classes present: pin equality four-copy divergence + rejected shapes, vulnerability-gate fixture advisory, ci-supply-chain floating tag, ci-topology DEC-7 fixtures A–G + job-id removal, ci-bindingness injected `continue-on-error`, GH-172/GH-181 bindings. `pin-equality` and `vulnerability-gate` are imported here again. New scan wiring is in `tests/checks/ci-wiring.test.ts` (2 tests). Re-run: `ci-checks`+`ci-wiring` = 39 pass / 0 fail. |
| F-2 | **Resolved** | `tests/checks/privacy-authoring.test.ts` is byte-identical to pre-`41c7e38d` (133 lines / 8 tests): TC-PRIVACY-018 (stdin-only record, class flag, empty/over-512 no digest, echo mutant), TC-PRIVACY-019 (both CI markers, no argv/env channel), F-8 positional rejection. `runAuthoring` is used (8 call sites). Non-pilot fixture scan is separate in `tests/checks/fixture-privacy.test.ts` (3 tests). `privacy-ci-wiring.test.ts` re-pins the suite filter to the restored authoring suite + moved fixture scan. Re-run: 25 pass / 0 fail (8 + 3 + 14). |
| F-3 | **Resolved** | Test-plan §7 statuses all `Implemented` / `Existing, updated` / `Existing, verified` (0 `To Implement` remain, 54 `Implemented` rows). §10 "Test Execution Log" is a populated family-level table (0 `Pending`), explicitly declaring the pm-notes `notes:` ledger the authoritative per-phase record with the raw-log tie-breaker. §7.4 records remediation coverage per finding. |
| F-4 | **Resolved** | New `tests/behaviour/change-folder-locate.test.ts` (9 tests) exercises `locateChangeFolder`/`relativeChangeFolder` over an in-memory read-only FS: month scan ascending (non-month ignored), folder scan ascending, exact `--<ref>--` token match (prefix/suffix/near-miss rejected), invalid ref, read-only non-mutation with call-order assertion, repo-relative prefix strip, trailing-separator trim, out-of-root pass-through, unresolved ref. Re-run: 9 pass / 0 fail. |
| F-5 | **Resolved** | `scripts/checks/prompt-conformance.ts` negation is sentence-local (`sentenceAt`), rule matches are examined per-occurrence (`matchesOf`), and forbidden/retired literals use `firstVisibleOccurrence`. New mutant `tests/fixtures/prompt-inventory/mutants/raw-git-negated.md` plus mutant tests prove a line with a negation in one sentence and a raw-git instruction in another is still caught, while a same-sentence prohibition stays exempt. `plan.no-progress` narrowed to singular `\bplan update\b(?!s)` to kill the documented `plan updates` plural false positive. Live scan clean; mutants suite 11 pass / 0 fail. |
| F-6 | **Resolved** | `tests/behaviour/commit-staging-scope.test.ts` adds an `F-6` case asserting `commit --phase delivery --dry-run` stages exactly the DEC-4 union (mapped plan-phase scope ∪ change folder), excludes the stray, and leaves HEAD/commit-count/status unchanged. Re-run: 3 pass / 0 fail. |

## 3. New-regression audit (remediation)

- **No weakened assertions.** `privacy-authoring.test.ts` is byte-identical to the base; `ci-checks.test.ts` differs from base only by the required aggregate-pin line. New tests are additive.
- **No scope drift.** All changed paths are inside phase-11's declared `scope.files`/`scope.folders`. The only non-test/doc file touched is `scripts/checks/prompt-conformance.ts` (a repo-invariant check tool, not delivered product code). No `packages/**`, `.opencode/**`, or `doc/spec/**` files changed. `tests/checks/privacy-support.ts` is over-declared in scope but unmodified (harmless).
- **Aggregate gate health.** Full `bun test` (with absolute repo-local `TMPDIR`): 6005 pass / 4 skip / 0 fail, 6009 tests, 683 files, exit 0 — matches the pm-notes claim verbatim. `tests/types` typecheck exit 0. `plan validate GH-242` exit 0. `prompt-conformance` (5 prompts clean) and `help-guide-coverage` (all commands covered) green.
- **Flakiness / determinism.** No flaky suites observed; latency/perf and determinism suites (pilot, capsule-latency, status/queue performance) passed inside the full run. No time-dependent or ordering assertions introduced.
- **Evidence integrity.** Phase-11 pm-notes `notes:` entry names the phase, commit `97dad325`, and the observed test result; Committed as `edd6d123`.

## 4. Non-blocking findings

| ID | Severity | Evidence | Note |
|----|----------|----------|------|
| NB-1 | info | `scripts/checks/prompt-conformance.ts` `isNegated(text, index)` | Negation remains whole-sentence, not positional: a negation word *after* the offending token in the same sentence (e.g. `Run git add, then never commit.`) still exempts `git add`. This is exactly the "sentence-local" resolution F-5 permitted and is strictly better than the prior whole-line skip; not a regression. Optional future refinement: require the negation to precede the token. |
| NB-2 | info | `scripts/checks/prompt-conformance.ts` `plan.no-progress` | The plural `plan updates` no longer matches (deliberate, documented fix for the legitimate noun phrase in `pm.md`'s review step). The singular instruction phrase `plan update` and the other alternatives are still caught. Acceptable, documented trade-off. |

## 5. Verdict

**PASS.** All six iteration-1 findings are resolved with executable evidence; remediation introduced no weakened tests, scope drift, or gate regressions, and the full aggregate test battery is green. Two informational residuals (NB-1, NB-2) are accepted trade-offs, not blockers.

**Next step:** `PROCEED` (quality gates → DoD check). Iteration-1 findings stay closed; do not reopen without new evidence.
