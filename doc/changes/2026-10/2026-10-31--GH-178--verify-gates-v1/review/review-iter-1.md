# Code Review — GH-178: M0-S9 verify gates v1 (Iteration 1)

- **Work item:** GH-178 — "M0-S9: verify gates v1"
- **Mode:** local (ADOS pipeline, first review)
- **Branch:** `feat/GH-178/verify-gates-v1`
- **Base:** `origin/main-tools`
- **Reviewed revision:** `b289f80` (delivery `453aaaa` plus PM/docs commits through `b289f80`)
- **Artifacts:** spec v1.5 (36 ACs), test plan v1.5 (70 TCs), plan v1.4 (10 phases, 53/53 checked)
- **Diff scope:** 94 files, +12,553 / −144 (`git diff --stat origin/main-tools...HEAD`)
- **Reviewed at:** 2026-10-31 (review iteration 1)

## Status: FAIL

The five-gate design is faithfully implemented and the aggregate gate is green, but there is one real
non-vacuity/correctness defect in the squash surface check, and several plan/test-plan evidence
obligations are marked done while the specified tests do not exist. The product path through the
delivered GitHub adapter masks the correctness defect today; the domain contract still permits a
vacuous `squash-ready` and the test plan explicitly requires the protections that are missing.

## Blocking findings

### F-1 — [High] Non-finite surface counts can produce a vacuous `squash-ready`; negative counts are misclassified

**Location:** `packages/core/src/domain/verify-gates.ts:1101-1105` (decision), `:968-972`
(`surfaceCount`), `:80-83` (`count`)

**What is wrong:** The squash decision uses the raw `request.commitCount` / `request.changedFileCount`
values. The module already has a `surfaceCount` helper that treats non-finite/negative values as
absent, but it is used only for the citation counts, not for the pass/fail decision. As a result:

- `commitCount: NaN` (with `changedFileCount: 7`) → **`pass` / `squash-ready`**.
- `changedFileCount: NaN` (with `commitCount: 3`) → **`pass` / `squash-ready`**.
- `commitCount: -1` → `fail` `/` `squash-no-commits` instead of `squash-surface-unknown`.
- `changedFileCount: -1` → `fail` `/` `squash-no-changes` instead of `squash-surface-unknown`.

This directly violates DM-7 ("a non-finite or negative `commitCount`/`changedFileCount` is treated as
absent") and AC-F7-3 ("absent commit/file counts … fail `squash-surface-unknown`; unknown is never
mergeable and absent is never non-empty"). It also violates the core non-vacuity guarantee (G-3,
NFR-1) and the F-12 rule that a gate over an omitting/foreign provider must never fabricate a
non-empty surface. The GitHub adapter normalizes to finite non-negative values, so the delivered
GitHub path cannot reach it today, but `DeliveryRequest` is provider-agnostic and the evaluator is a
public `@delivery-os/core` export.

**Evidence (read-only evaluation):**

```text
NaN 7 => pass squash-ready
7 NaN => pass squash-ready
-1 7 => fail squash-no-commits
7 -1 => fail squash-no-changes
```

**Suggestion:** Validate the surface once and use the validated values for the decision, e.g.
`const commits = validSurface(request.commitCount)` where `validSurface` is `Number.isFinite(v) && v >= 0 ? v : undefined`,
then fail `squash-surface-unknown` when either is `undefined`, `squash-no-commits`/`squash-no-changes`
when `<= 0`, and use the same values for the citation. Add evaluator-level negative tests for
`NaN`, `Infinity`, and negative counts (TC-VGATES-038 / AC-F7-3). Also guard `count()` and the CI
`pageItemCount` with `Number.isFinite` so a non-finite injected count can never serialize as a
non-integer citation value.

### F-2 — [High] The structured ledger evaluator (DM-15) is not behaviour-tested; lifecycle gate tests inject synthetic evaluations

**Location:** `tests/behaviour/verify-gates-lifecycle.test.ts:44-56` and `:84-131` (hand-built
`lifecycle({...})` objects), `tests/fixtures/verify-gates/cases/facts.ts:62-82`, `packages/core/src/domain/verify-change.ts:222-355`

**What is wrong:** DM-15 / AC-F2-4 / TC-VGATES-062 require the citation’s variant, counts, ordered
missing phases, and registry evidence to come from the actual `EvaluateVerifyChange` evaluation on
every outcome (finished, partial, failed, state-unverified). The gate tests never call
`EvaluateVerifyChange`; they construct a `VerifyLedgerEvaluation` by hand with `lifecycle({...})`
and inject it into `facts.lifecycle.evaluation`. The only behavioural test of the evaluator is the
existing `classifyVerifyChange` suite, which always passes a ready document and therefore does not
exercise:

- the terminal document-failure branch (`document.ok === false`) that the gates handler relies on
  for malformed notes / a missing pm-notes target;
- the DM-15 failure-path field shape (empty arrays, zero declaration counts, `registry.present:false`);
- the `state-unverified` structured fields (the wrapper is exercised, but its structured fields are
  not asserted);
- the `registry === undefined` branch (currently dead in the handler, but part of the exported contract).

Plan task 4.1 explicitly required "wrapper/structured-field assertions in
`tests/behaviour/verify-change-classification.test.ts` and `tests/behaviour/verify-change-state.test.ts`";
those files are unchanged in the diff. Plan tasks 4.1/4.10/6.2 are checked without this evidence.
Because the gate is tested against a fabricated evaluation shape, the actual ledger-evaluation →
citation integration (the core of G-5/DEC-17) is unverified.

**Suggestion:** Add direct `EvaluateVerifyChange` tests for all four outcomes, including a malformed
document and a missing target, asserting the DM-15 field shape; add a wrapper-preservation control in
the verify-change suites; and add at least one lifecycle-gate test that drives the real
`EvaluateVerifyChange` output (e.g. through the gates handler’s `readLifecycle` seam) rather than a
hand-built object.

### F-3 — [High] Plan/test-plan evidence obligations are marked done but the specified tests are absent or weaker

Several plan tasks are checked `[x]` while the named evidence does not exist or does not implement
the scenario. This matters because the test plan is declared binding ("where its prose lags the spec,
the test plan and the spec are the oracle") and the plan’s final acceptance trace claims every AC
closes on passing TCs.

**F-3a — TC-VGATES-051 read budget / no-write / no-spawn / retry / pagination.**
`tests/behaviour/verify-gates-owner-composition.test.ts:174-180` only asserts deterministic pure
evaluation and canary absence. The plan (§4.1) and task 5.6 require a read-only/read-budget recorder
that fails on a write, fence, spawn, retry, pagination, or fifth outbound GET. There is no such
recorder in the new suites. The code is structurally read-only (the runtime interface exposes only
reads), but the binding evidence is missing.

**F-3b — TC-VGATES-059 opt-in live smoke is not live.**
`tests/behaviour/verify-gates-live.test.ts:11-31` evaluates synthetic `baseFacts()` and asserts
`overall === "pass"`; it does not run against this repository, a credential, or the real edge, and
does not assert exit semantics or secret-free output. TC-VGATES-059 step 3 and spec §18 require a
live, credentialed structural run. The no-live guard
(`tests/checks/verify-gates-no-live-calls.test.ts:19-28`) installs `globalThis.fetch` around one
in-process harness run; it does not scan the production/verify-gates edge or default suites for
`fetch`/`node:https`/`Bun.connect` as TC-059 step 1 requires.

**F-3c — TC-VGATES-040/041/042 citation and summary negative controls.**
There is no citation validator and no negative-control fixture for a 9-name list without `omitted`, an
out-of-order list, a >120-char name clamp, an identity-ref clamp, a free-form `failureClass`, or the
summary grammar violations (zero alias, bare `counts=`/`names=`, omitted segment). The output suite
asserts the positive grammar and one `counts=- names=-` line; it does not implement the negative
controls named by the test plan and task 6.5. The canary is only the `WorkItem.title`
(`tests/fixtures/verify-gates/cases/facts.ts:56`), so the "no raw payload/title/comment/commit/file
content" assertion is only weakly exercised.

**F-3d — TC-VGATES-058 corpus builder-manifest deviation weakens the completeness oracle.**
`tests/fixtures/verify-gates/corpus/cases.json` adds a `builder` field and fixes every `fixture` to
`"cases.json"`. `tests/behaviour/verify-gates-corpus.test.ts:301-308` therefore verifies only that the
manifest itself exists; the "every case fixture exists and is readable" check is vacuous, and the
per-case fixture/canary/mutation-assertion model from the test plan is not present. The manifest also
carries no `squash-signals` expectation, so the plan/test-plan requirement that every squash case
asserts the manifest-declared two-token/empty signal rule is absent (`tests/behaviour/verify-gates-corpus.test.ts:373-383`).
The negative controls are limited to an empty/duplicate manifest and one wrong-verdict case; there is
no temp-copy missing-case control, no fabricated/missing squash-signal control, and no
fail/unknown-would-emit-success/data/exit-0 control. The `validate` stale-reason check also accepts
any `ci-*`/`lifecycle-*` string (it would be caught later by execution, but the meta-check itself is
weak).

**F-3e — Task 6.3 planted-secret golden.**
`tests/golden/verify-gates.test.ts:56-59` pins the `verify change` human output for a no-secret
fixture. The JSON-escaping-sensitive secret control lives in
`tests/behaviour/verify-gates-output.test.ts:151-195`, but its expected string is computed with the
same `redact()` helper rather than a pre-change golden under the secret. The secret-absence assertion
is meaningful, but the "byte-identical pre-change bytes under a JSON-escaping-sensitive secret"
evidence required by task 6.3 is not actually pinned.

**Suggestion:** Implement the missing TC-051/059/040/041/042/058 evidence or explicitly re-scope the
plan/test-plan with owner-assigned deferrals; do not mark the tasks `[x]` until the named assertions
exist. In particular, add the read-budget recorder, a real credentialed live smoke, the citation and
summary negative controls, and restore a per-case committed fixture (or explicitly document and
justify the builder-manifest deviation in the test plan with a replacement completeness oracle).

## Non-blocking findings

**N-1 — [Low] `VerifyLedgerEvaluation` lives in the domain tier, not `core ./contracts`.**
Spec §8.5/§16 say `core ./contracts` gains the additive read/evaluation contracts including
`VerifyLedgerEvaluation`; it is defined in `packages/core/src/domain/verify-change.ts:222-242`. Plan
task 4.1 permits the domain location, and the symbol is re-exported from the package root, so this is
a documented placement choice rather than a tier violation. Align the spec/plan wording or move the
type-only contract into `contracts` if the tier rule is meant literally.

**N-2 — [Low] "First unknown gate" precedence is implemented as a scan across all unknown gates.**
`verifyGatesUnknownIdentity` (`packages/core/src/domain/verify-gates.ts:1285-1299`) skips an unknown
gate with no resolvable `failureCode` and continues to a later unknown gate. Section 8.3 says "use the
first unknown gate … if its citation carries a failureCode … otherwise `verify.gates.unavailable`".
The scan is what makes the reachable credential path exit `1` (`config.credential.missing`) as
AC-F11-1 requires, because the CI gate’s list-failure citation does not carry the code. Keep the
behaviour but record the interpretation ("first resolvable unknown-gate identity") in the spec and
feature doc.

**N-3 — [Low] A `failureCode` is attached to a `read` source for a partial lifecycle.**
`packages/core/src/domain/verify-gates.ts:347-353` (and the test at
`tests/behaviour/verify-gates-lifecycle.test.ts:79`) put `verify.ledger.incomplete` on
`pm-notes:read`. DM-5/F-8 describe `failureCode` as belonging to failed sources. It is harmless for
the overall projection (partial is a definitive `fail`, not `unknown`), but the citation shape is
slightly outside the documented "failed source carries failureCode" reading. Either move the code to a
failed/derived source or widen DM-5 to state that a read source may carry the underlying classification
of a partial verdict.

**N-4 — [Low] The CI gate does not cite the open-PR list when that read is the failing prerequisite.**
For a list 404 / read failure, the CI gate returns `head-unresolved` or an unknown, citing only
`repository-ci-workflow` + `github-delivery-request-detail:not-attempted` +
`github-check-runs:not-attempted` (`packages/cli/src/commands/verify-gates.ts:434-470` and
`packages/core/src/domain/verify-gates.ts:434-487`). The declared CI source set excludes
`github-delivery-request-list`, so the actual cause is not named. The feature doc documents the CI
list-404 → `head-unresolved` rule, but the citation cannot show why. Consider declaring the list as a
fourth CI source or documenting this as a deliberate evidence gap.

**N-5 — [Low] Failure-summary byte truncation can cut a gate line.**
`renderVerifyGatesFailureSummary` (`packages/core/src/domain/verify-gates.ts:1226-1244`) joins the six
lines and slices at 4096 bytes. Under the declared maxima (CI with 8 failed + 8 pending + 8 missing
names of 120 chars, plus 64-hex SHAs, a 120-char branch, and two 120-char owner labels) the rendered
block can exceed 4096 and the slice can drop/cut the trailing gate line, violating AC-F8-2's "exactly
one line per gate". No fixture covers the combined maximum. Truncate per-line (clamp the names lists)
or add a maximal fixture and assert the surviving line shape.

**N-6 — [Low] Human lifecycle variant is inferred from a magic `required === 6`.**
`humanLineFor` (`packages/core/src/domain/verify-gates.ts:1259`) derives `variant=lite` when the
required count is 6, rather than carrying the effective variant from `VerifyLedgerEvaluation`. It is
correct for the current full (11) and LITE (6) sets, but it is not contract-driven and will silently
misreport if the LITE set changes. Carry the variant in the citation identity or a dedicated field.

**N-7 — [Low] CI page-size counts are not finite-guarded.**
`count()` (`packages/core/src/domain/verify-gates.ts:80-83`) clamps with `Math.max(0, Math.trunc(v))`,
which yields `NaN` for `NaN` and `Infinity` for `Infinity`; a non-finite injected `pageItemCount`
could produce a non-integer citation count. The adapter supplies a real page size, so this is a
hardening item, not a reachable GitHub bug.

**N-8 — [Low] Workflow byte bound uses string length, not UTF-8 bytes.**
`packages/adapters/src/file/ci-workflow.ts:48` compares `text.length` (UTF-16 code units) with
`VERIFY_GATES_WORKFLOW_MAX_BYTES`. A multibyte workflow can exceed 256 KiB in bytes while passing the
check. Use `Buffer.byteLength` (or the file adapter’s byte-safe read) to enforce the declared byte cap.

**N-9 — [Low] Markdown style:** `doc/spec/features/feature-result-contract.md` ends with
`See also: …` immediately followed by `## Related` with no blank line (the adapter-ports doc has one).
ATX headings can interrupt a paragraph, so this is cosmetic.

## Spec and plan compliance audit

**Gate rules and mapping — PASS.** The five gates, fixed order, per-gate source/count/name/reason
declarations, and the verdict/reason mapping match Appendix A and Section 8.3. I verified the
non-vacuous paths: invalid/empty/duplicate/over-cap expected set (`ci-expected-jobs-invalid`), zero
runs (`ci-no-runs`), all-skipped including an extra non-expected success (`ci-all-skipped`), red
(`ci-failed`), canceled/pending, 100-run truncation (`ci-truncated`), missing jobs, unknown run state
(`ci-failed`), unresolved head, matched detail 404 for CI/parity/squash (`head-unresolved` + source
`absent`), check-run 404 (`unknown` `read-failed` + source `absent`), at-limit open-PR closure with
and without a match, `branch-mismatch`, `no-open-pr`, detached `branch-unresolved`, owner-label
presence, and the squash conditions (not open/draft/wrong base/conflicting/not-mergeable/unknown
mergeability/zero/absent surface). The `provider.not-found` read result is adapter-local and mapped
per read; no error-table row was added.

**Contracts and additive fields — PASS with N-1.** The two `verify` rows exist and are synchronized
with the documented table (`error-table-sync: entries=33 documented=33`). The four optional
`DeliveryRequest` fields are added with absence semantics, and the GitHub normalization implements
the documented mergeability precedence, including `mergeable === true` + blocked/dirty. The closed
adapter operation set, subpath exports, and contract inventory are unchanged; no new package,
subpath, entrypoint, workspace edge, or dependency exists.

**Command surface and output — PASS with N-2/N-3/N-5.** One `verify` definition dispatches
`change`/`gates` after grammar validation; a missing/empty ref is `input.value.rejected`; a third
positional or unknown flag is `fallback.invocation`; `verify change` keeps the redact-then-serialize
path because `humanText` returns `undefined` for non-`gates` targets. The six-line human success and
the six-line bounded failure summary with mandatory `counts=`/`names=` segments render as specified
for the tested fixtures. Error/exit projection matches the matrix (`verify.gates.failed` → 1,
`verify.gates.unavailable` → 2, classified unknown reuses the resolvable identity).

**Read-only / tier / boundary / privacy — PASS.** `dependency-cruiser`, `ambient-globals`,
`workspace-entrypoints`, `secret-read-boundary` (4 allowlisted entries), `forbidden-literals` (0
violations), `privacy-literals` (0 violations), and `test-doc-distribution` (81 in-scope docs) all
pass. The new code performs no write, fence, merge, auto-merge, or spawn; provider access is
read-only and credential-port-only; the domain imports only `#contracts` and `./verify-change.js`.

**Documentation — PASS.** The new `doc/spec/features/feature-verify-gates.md` (`ados_distribution:
internal`) accurately describes the implemented gate rules, target resolution, read-specific 404
mapping, citations, exits, bounds, and limitations; it is registered in the forbidden-literal
registry and the index/glossary/guides/feature specs from Appendix H are reconciled. I verified the
real `.github/workflows/ci.yml` yields 23 unique display names through `readCiWorkflowJobNames`.

**Plan task audit — PARTIAL.** All 53 tasks are checked, but F-2/F-3 identify evidence that the task
text requires and the repository does not contain (notably 4.1's verify-change assertions, 5.6's
read budget/no-spawn, 6.2's corpus non-vacuity/fabricated-signal controls, 6.3's secret-bearing
`verify change` golden, and 6.5's renderer negative controls).

## Test quality audit

- **Positive:** The suite is extensive and fast; the 70-TC traceability table is structurally
  complete; the pure evaluator, CLI harness, goldens, corpus, trap replay, and structure suites all
  pass (`bun test`: 1738 pass / 2 skip / 0 fail). The ticket’s three negative cases (red pipeline,
  missing job, vacuous green) are first-class CI-gate tests, and the at-limit/detail-404/check-run-404
  cases are covered in both the pure and command paths.
- **Determinism:** Replay tests exist for the report/summary/human/exit paths; the domain uses
  contract arrays for ordering and no clock/randomness/ambient access.
- **No live calls:** Default suites inject the pure facts/harness and never reach the network; the
  guard test proves `globalThis.fetch` rejection, but the guard only wraps one harness run (F-3b).
- **Non-vacuity / builder manifest:** The corpus’s `builder` + self-referential `fixture` design
  weakens the fixture existence/canary/mutation checks and omits per-case `squash-signals`
  expectations (F-3d). This is the coder’s acknowledged builder-manifest deviation; it does weaken
  the test plan’s corpus oracle.
- **Traceability claims:** The test plan says "all seventy TCs are automated" and "no assertion is
  deferred"; F-2/F-3 show that several named assertions are not automated in the specified form.

## Evidence collected

| Check | Result |
|---|---|
| `bun test` (full suite) | 1738 pass, 2 skip, 0 fail, 16,192 expectations |
| Focused verify-gates suites (corpus, CI, parity/squash, lifecycle, output, golden) | 60 pass, 0 fail |
| Structure/check batteries (contract, imports, exports, gate facts, error table, trap catalog, content inventory, cli seam, error-table sync, no-live-calls) | 125 pass, 0 fail |
| `pnpm typecheck` (including build/exports-parity and root type probes) | PASS |
| `pnpm lint` | Completed; 15 warnings / 5 infos, no errors |
| `pnpm format:check` | PASS |
| `pnpm check:boundaries` (depcruise + ambient + entrypoints + secret-read) | PASS |
| `bun run scripts/checks/forbidden-literals.ts` | PASS — 0 violations |
| `bun run scripts/checks/privacy-literals.ts` | PASS — 0 violations |
| `bun run scripts/checks/error-table-sync.ts` | PASS — entries=33 documented=33 |
| `bash scripts/.tests/test-doc-distribution.sh` | PASS — 81 in-scope docs, no drift |
| Real `.github/workflows/ci.yml` expected-job read | `read`, 23 names, 23 unique |
| `git diff --check origin/main-tools...HEAD` | **FAIL** — `chg-GH-178-spec.md:953` and `chg-GH-178-test-plan.md:2423`: new blank line at EOF |
| Read-only NaN/negative surface evaluation | NaN → `pass`/`squash-ready`; `-1` → `squash-no-commits` (see F-1) |

## Next step

`CALL_CODER` / remediation phase required before merge:

1. Fix F-1 (finite/non-negative surface decision + evaluator-level negative tests) and add the
   `count()`/`pageItemCount` finite guard.
2. Implement F-2’s `EvaluateVerifyChange`/wrapper structured-field tests and at least one real
   evaluator-driven lifecycle-gate case.
3. Implement or explicitly re-scope with owner-assigned deferrals the F-3 evidence: read-budget/
   no-spawn recorder, real live smoke, citation/summary negative controls, and a per-case corpus
   fixture/canary or a documented replacement completeness oracle.
4. Remove the trailing blank lines at EOF in the spec and test plan so `git diff --check` is clean.
5. Re-run `pnpm check` and this review; do not merge on the current revision.

Status: FAIL
