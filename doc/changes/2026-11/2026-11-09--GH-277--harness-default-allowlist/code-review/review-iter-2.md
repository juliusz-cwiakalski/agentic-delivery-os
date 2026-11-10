# GH-277 Code Review — Iteration 2

- **Status:** FAIL
- **Mode:** local
- **Branch:** `fix/GH-277/harness-default-allowlist` (base `origin/main-tools`, merge-base `dbbc62cf`)
- **Remediation commit under review:** `bf5c918e` — `fix(GH-277): remediate review iteration 1 findings`
- **Reviewed at:** 2026-11-10T05:53:55Z
- **Canonical artifact:** `review-iter-2.yaml`
- **Previous iteration:** `review-iter-1.yaml` (FAIL — 1 high / 4 low)

## Verdict

**All five iteration-1 findings are verified fixed.** The functional repair is unchanged
and still correct: the shipped default declares `PATH`/`HOME` required, `TMPDIR` optional
and `DELIVERY_WORK_PATH` injected; the deny-by-default builder omits an absent optional
entry and still fails closed naming a required one; no ambient model variable is
forwarded or synthesized; and the pre-session `dispatch.session.spawn-failed` failure
carries a bounded `kind`/`code`/`field` detail. The remediation touched only `doc/` and
`tests/` files (no product code), so the iteration-1 functional acceptance verdict holds.

The delivered HEAD is nonetheless **not PASS**, because a test introduced by this change
is nondeterministic and makes the required aggregate gate flaky. This is **not** a
remediation regression — the flake predates `bf5c918e` — but it blocks a reliable green gate.

## Iteration-1 findings — verified closed

| Finding | Verdict | Probe evidence |
|---|---|---|
| F-1 (high) forbidden `ADOS_` literal in two current-truth docs | **FIXED** | `bun run scripts/checks/forbidden-literals.ts` → `5/5 scope classes scanned, 0 violations`; `grep OC_ADOS doc/spec` → no hits; `bun test tests/checks` → 635 pass / 0 fail (incl. `forbidden-literals` and the previously red `ci-baseline-parity` 1 pass). Doc reword reads "no ambient provider-model environment variable is mapped or forwarded" and is accurate against `packages/core/src/config/defaults.ts:58-64` (no model var in the default set). |
| F-2 (low) unused `optional-entry.yaml` fixture | **FIXED** | `tests/behaviour/harness-config.test.ts:542` now references it via `resolveFixture("optional-entry.yaml")` and asserts the resolved marker `{ name: SYNTHETIC_OPTIONAL_VARIABLE, optional: true }`. |
| F-3 (low) default-spawn fixture used system `tmpdir()` | **FIXED** | `tests/fixtures/harness/default-spawn.ts` now builds `TEMP_ROOT = join(process.cwd(), "tmp", "tmpdir")` (mkdir before `mkdtemp`), matching test-plan §6.2; plain `bun test` and the gated run both root repo-locally. |
| F-4 (low) `detailOf` clamp untested | **FIXED** | New dispatch-path case injects a `HarnessFailure` with a 300-char `field` through a real `dispatch` invocation and asserts single-line, `<= DISPATCH_MAX_ERROR_DETAIL_CHARS`, prefix intact and `field.length < 300` — genuinely exercises the clamp, not a hand-built object. |
| F-5 (low) P4 evidence missing commit hash | **FIXED** | `chg-GH-277-pm-notes.yaml:237` now reads "Plan phase 4 complete (commit e7699431 — changeset, TDR-0021, and the test-plan execution log)". Plan phases 1–4 all name their commits (014fdd6, 55ee7c3, 162fa7ec, e7699431). |

## Plan and artifact compliance

- `plan validate GH-277` → `verdict=valid`, `tier=full`, `readyForDevelopment=true`.
- Plan scope conformance: every path touched by `bf5c918e` falls inside a declared plan
  scope — `harness-config.test.ts` / `optional-entry.yaml` (phase 1),
  `default-spawn.ts` / `dispatch-harness-default-detail.test.ts` (phase 3),
  `feature-config-layer.md` / `feature-harness-adapters.md` (phase-4 → phase-7 handoff),
  and the change folder (always). **No SCOPE_DEVIATION.**
- Per-phase completion evidence: all four delivery phases carry a commit hash and a gate
  result. **No OPEN_PHASES / EVIDENCE_MISSING.**
- Spec v1.4 and test plan v1.4 present; spec compliance (AC coverage) unchanged from
  iteration 1. See N-2 for a test-plan bookkeeping nit.

## Blocking finding

### N-1 (high) — newly added spawn test is ~50% flaky; required gate nondeterministic

- `tests/behaviour/dispatch-harness-default-detail.test.ts:311` — TC-HDA-035 "supplying
  HOME makes the same failure disappear".
- Root cause: `packages/adapters/src/host/index.ts:251-252` (session starter) and `:65-66`
  (runner) write the prompt with `child.stdin?.end(options.stdin, "utf8")` and register
  **no** `child.stdin.on("error", ...)` handler. The synthetic child
  (`tests/fixtures/harness/default-spawn.ts:57-69`) never reads stdin, writes its two JSONL
  lines and calls `process.exit(0)`; when it exits before the parent's write flushes, the
  pipe is closed and the write raises an unhandled `EPIPE`, which bun reports as the
  running test failing.

Evidence (reproduced repeatedly, delivered HEAD, `TMPDIR=$PWD/tmp/tmpdir`):

```
single suite, clean tree:      16 / 30 failed   (then 8 / 16 after clearing leftovers)
multi-suite batch:              3 / 6  failed
pre-remediation fixture:        5 / 12 vs HEAD 4 / 12 (interleaved)  → pre-existing, not a remediation regression
failure:  error: EPIPE: broken pipe, write  at node:events (emitError / emitErrorNT)
```

The uncaught exception also bypasses the `finally` dispose blocks, leaking one
`tmp/tmpdir/gh277-default-spawn-*` root per failing run (8 leaked dirs after 8/16 failures).

Impact: `pnpm check` runs `pnpm test`, so the mandatory aggregate gate (NFR-9, DoD-12) is
nondeterministic at the delivered HEAD and the recorded P4 "green aggregate" is not
reproducible. The iteration-1 gate note ("bun test on all touched suites — pass") was a
single-run observation of a ~50% flake.

**Fix (recommended, durable):** add a no-op/classified `child.stdin?.on("error", ...)`
handler at both write sites in `packages/adapters/src/host/index.ts`, so an early-exiting
harness child yields a classified spawn failure rather than an uncaught crash — this also
hardens the production path when a real `opencode` child exits before reading its prompt.
**Minimal test-only alternative:** make the synthetic script drain stdin before exiting
(`process.stdin.resume()` + exit on `end`). Then run the suite ~20× and confirm zero
failures and no leaked `tmp/tmpdir/gh277-*` dirs, and re-run the aggregate gate.

## Non-blocking findings

- **N-2 (low)** The remediation added TC-HDA-034 step 7 ("Dispatch-path clamp",
  `chg-GH-277-test-plan.md:1199`) but left the test plan at `version: 1.4` /
  `last_updated: 2026-11-09T09:40:00Z` with no §Revision History row for the post-1.4
  change. Bump to 1.5 and record the step-7 addition.
- **N-3 (info)** Disclosed remediation-commit deviation (`bf5c918e`): the commit primitive
  was invoked through its command runtime with an agent-authored draft passed through the
  `harnessOneShot` transport seam instead of a generated message or the template.
  **Assessment: acceptable as a one-off.** The primitive still owned staging, the
  deterministic safety scan, ref/type/scope validation, commitlint and telemetry, so no raw
  git write occurred and the commit shape/scope are correct; only message-provenance
  fidelity is lost (telemetry records `transport=harness-one-shot` / `messageSource=model`
  for an authored message). It is not recorded in pm-notes — add a phase-8 note; prefer the
  template fallback (truthful `messageSource: template`) for future remediation commits.

## Gates run this iteration

- `bun run scripts/checks/forbidden-literals.ts` → 0 violations (5/5 classes). ✅
- `bun test tests/checks` → 635 pass / 0 fail (incl. `forbidden-literals`, `ci-baseline-parity`). ✅
- Touched behaviour/structure/golden suites (8 files) → 82 pass / 0 fail. ✅
- `pnpm typecheck`, `pnpm lint` (exit 0), `pnpm format:check` (exit 0),
  `pnpm check:boundaries`, `pnpm check:prompt`, `pnpm check:help`,
  `bun run scripts/checks/exports-parity.ts`, `pnpm check:privacy-literals` → all green. ✅
- `bun test tests/behaviour/dispatch-harness-default-detail.test.ts` → **flaky (~50%)** ❌ (N-1)
- `plan validate GH-277` → valid. ✅

## Next step

`EXECUTE_REMEDIATION_PHASE` — fix N-1 (guard `child.stdin` errors or drain stdin in the
synthetic child), re-run the detail suite ~20× for a stable 0-fail, clear leaked
`tmp/tmpdir/gh277-*` roots, then re-run `TMPDIR=$PWD/tmp/tmpdir pnpm check`. Address N-2
(test-plan 1.5 bump) and record N-3 in pm-notes. **No iteration-1 finding needs rework and
no product-code behaviour change is required for the blocking defect.**
