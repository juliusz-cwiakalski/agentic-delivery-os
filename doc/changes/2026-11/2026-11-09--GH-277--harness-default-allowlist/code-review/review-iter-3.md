# GH-277 Code Review — Iteration 3

- **Status:** FAIL
- **Mode:** local
- **Branch:** `fix/GH-277/harness-default-allowlist` (base `origin/main-tools`, merge-base `dbbc62cf`)
- **Remediation commit under review:** `79167c6c` — `fix(GH-277): handle early child stdin close without EPIPE`
- **Reviewed at:** 2026-11-10T06:27:56Z
- **Canonical artifact:** `review-iter-3.yaml`
- **Previous iterations:** `review-iter-1.yaml` (FAIL — 1 high / 4 low), `review-iter-2.yaml` (FAIL — 1 high / 1 low / 1 info)

## Verdict

**The N-1 fix is verified and the code is accepted.** Both host seams now observe
`child.stdin` before writing the prompt, the synthetic child drains stdin, and independent
probes reproduce a clean result: the detail suite ran 20/20 green with no leaked roots; a
control probe keeping the pre-fix shape raised `EPIPE` 8/8, while the delivered seams
returned status 0 5/5 with no uncaught error. N-2 and N-3 are closed, and no regression
appears in typecheck, boundaries, or the aggregate gate.

The change is still **not PASS** because the remediation reached beyond the change's own
spec: `packages/adapters/src/host/index.ts` is an explicit `[OUT]` item in spec v1.4
(§7.2, "changes to the streaming starter, the one-shot runner") and is described as
unchanged by AC-F4-1 and §21, and neither the spec, the test-plan file inventory, nor the
plan phase scopes were amended for the review-mandated extension. The new stdin-error
branches are also untested because the fixture now drains stdin. Both are artifact and
coverage gaps, **not code defects**: the guard must be kept, the spec/test plan amended,
and a guard test added.

## N-1 — verified fixed

Root cause in iteration 2: `child.stdin?.end(options.stdin, "utf8")` at both seams with no
stdin error handler; an early-exiting child closed the pipe and the write raised an
unhandled `EPIPE`.

Delivered fix (`79167c6c`, `packages/adapters/src/host/index.ts`):

- `isEarlyExitStdinError` (`:31-34`) recognises `EPIPE`.
- Runner handler at `:79-83` — attached before the write; `EPIPE` ignored (the `close`
  handler resolves the real status), any other stdin error kills the child and resolves
  `{ status: 127, timedOut: false }`, mirroring the existing spawn-error path.
- Starter handler at `:271-275` — same guard; non-`EPIPE` ends the channel and completes
  `{ status: 127 }`; `complete()` is idempotent, so a later `close` cannot double-resolve.
- Fixture `tests/fixtures/harness/default-spawn.ts:78-81` drains stdin (`once("end")`,
  `once("error")`, `resume()`) with a 2 s unref'd fallback, so exit no longer races the
  write.

Independent probe evidence (this review, clean tree, `TMPDIR=$PWD/tmp/tmpdir`):

```
detail suite loop, 20 iterations:        20 pass / 0 fail (12 tests each run)
leaked tmp/tmpdir/gh277-default-spawn-*: 0
control (pre-fix shape, no stdin guard): EPIPE uncaught 8 / 8
delivered seams, 2 MiB prompt to /bin/true:
  runner  status 0, no uncaught             5 / 5
  starter status 0, no uncaught             5 / 5
aggregate gate, no EPIPE/unhandled lines:  6614 pass / 4 skip / 0 fail, 782 files
```

The `EPIPE` race is gone at the source (guard) and at the fixture (drain); the fix is
durable rather than test-only, which is the right call for the production path when a real
`opencode` child exits before reading its prompt.

## N-2 / N-3 — verified closed

| Finding | Verdict | Evidence |
|---|---|---|
| N-2 (low) test-plan bookkeeping | **FIXED** | `chg-GH-277-test-plan.md:4` `version: 1.5`; `:6` `last_updated: 2026-11-10T06:05:00Z`; §Revision History row 1.5 at `:1841` records TC-HDA-034 step 7 and the N-1 determinism evidence; front-matter summary updated to "Plan v1.5". |
| N-3 (info) commit-provenance deviation | **RECORDED** | `chg-GH-277-pm-notes.yaml` phase-8 entry records the authored-draft `harnessOneShot` transport, the lost `messageSource: model` fidelity, the standing preference for the template fallback, and the reset-soft re-invocation of the unpushed local commit. Disclosed, acceptable, not a defect. |

## Blocking and non-blocking findings

### R3-1 (high) — spec v1.4 explicitly excludes the delivered host-seam change

- `chg-GH-277-spec.md:213` — §7.2 `[OUT] Changes to the harness session port, the streaming
  starter, the one-shot runner, or the classifier.`
- `chg-GH-277-spec.md:395` — AC-F4-1 requires "the single host child-process site is
  unchanged."
- `chg-GH-277-spec.md:466` — §21 repeats "The single host child-process site ... [is]
  unchanged."
- `chg-GH-277-spec.md` §7.1/§16 and `chg-GH-277-test-plan.md` §7.1 product-code inventory
  do not list `packages/adapters/src/host/index.ts`.

The extension is justified (review-iteration-2 mandate) and disclosed (commit body,
pm-notes), and the invariants AC-F4-1 protects — one child-process site, environment as
data, no ambient read — still hold. But the binding artifacts were not reconciled: the
spec now contradicts the tree, AC-F4-1 as written is not satisfied (DoD-1 binds all 29 ACs),
and `doc/spec/features/feature-harness-adapters.md` §6 still describes the seams without
the stdin early-exit observation (DoD-9). **Do not revert the guard** — amend the spec to
v1.5 (§7.1, §16, AC-F4-1, §21, §7.2, §15), update the test-plan file inventory, and re-run
the phase-7 doc-sync.

### R3-2 (medium) — the new stdin-error branches are untested

`packages/adapters/src/host/index.ts:79` and `:271` add two classification branches
(`EPIPE` ignored; other stdin errors → status 127). With the fixture draining stdin, no
suite reaches either branch (`tests/behaviour/harness-host-stream.test.ts` passes no stdin),
and test plan v1.5 explicitly keeps the coverage rows unchanged. Add a regression case to
`tests/behaviour/harness-host-stream.test.ts` (and a runner case): child exits without
reading stdin, prompt larger than the pipe buffer, assert no uncaught error and the
classified status; record it in §6.4 and the revision row. My probe shows this is
deterministic (control 8/8 EPIPE, guarded 5/5 clean).

### R3-3 (low) — mechanical plan SCOPE_DEVIATION, disclosed and accepted

`packages/adapters/src/host/index.ts` is outside every declared plan phase scope (P1
core/production, P2 dispatch, P3 tests, P4 release/docs). Justified by the review mandate
and disclosed in the commit body and pm-notes; `plan validate` stays valid. If the plan is
refreshed, append a small remediation phase or amend P3's scope; otherwise carry the
accepted deviation in the spec §15 decision log.

## Plan and artifact compliance

- `plan validate GH-277` → `verdict=valid`, `tier=full`, `readyForDevelopment=true`.
- All four delivery phases retain commit + gate evidence. No OPEN_PHASES / EVIDENCE_MISSING.
- `lint GH-277` → pm-notes `class: conforms`.
- `verify change GH-277` → `result=partial` with `missing=review_fix,quality_gates,dod_check,pr_creation`
  — expected at this point in the lifecycle.
- **Spec compliance: FAIL** (R3-1: AC-F4-1 / §7.2 contradicted).
- **Plan compliance: PASS** with a disclosed, accepted SCOPE_DEVIATION (R3-3).

## Gates run this iteration

| Gate | Result |
|---|---|
| `bun test tests/behaviour/dispatch-harness-default-detail.test.ts` ×20, `TMPDIR=$PWD/tmp/tmpdir` | **20 pass / 0 fail**; 0 leaked spawn roots ✅ |
| Control probe (pre-fix shape) | uncaught `EPIPE` 8/8 ✅ (proves the fix is meaningful) |
| Delivered seams EPIPE probe (2 MiB to `/bin/true`) | runner 5/5 + starter 5/5 status 0, no uncaught ✅ |
| `pnpm typecheck` | exit 0 ✅ |
| `pnpm check:boundaries` | exit 0 (356 modules, 1041 dependencies; ambient-globals/entrypoints/secret-read clean) ✅ |
| `TMPDIR=$PWD/tmp/tmpdir pnpm check` | **exit 0 — 6614 pass / 4 skip / 0 fail, 782 files**; lint 60 pre-existing warnings (none on `host/index.ts`), format, prompt-conformance, help coverage, exports-parity all green; no EPIPE/unhandled lines ✅ |
| `plan validate GH-277` | valid / readyForDevelopment ✅ |
| Tree state after gates | branch `fix/GH-277/harness-default-allowlist`, `git status --porcelain` clean (probe files removed) ✅ |

## Next step

`EXECUTE_REMEDIATION_PHASE` — keep the adapter guard; amend the change spec to v1.5 for the
review-mandated host-seam stdin observation and update the test-plan file inventory (R3-1);
add the guard regression test and record it (R3-2); record the accepted plan deviation
(R3-3); re-run the phase-7 doc-sync for `feature-harness-adapters.md` §6 and the aggregate
gate. N-1, N-2, and N-3 are closed and no earlier finding needs rework.
