# GH-277 Code Review — Iteration 4

- **Status:** FAIL (artifact truth only — code, tests, and gates are accepted)
- **Mode:** local
- **Branch:** `fix/GH-277/harness-default-allowlist` (base `origin/main-tools`, merge-base `dbbc62cf`)
- **Remediation commit under review:** `9a23c8c2` — `fix(GH-277): cover host stdin early-close guard` (+ uncommitted doc-sync edit to `doc/spec/features/feature-harness-adapters.md`, expected)
- **Reviewed at:** 2026-11-10T07:11:33Z
- **Canonical artifact:** `review-iter-4.yaml`
- **Previous iterations:** `review-iter-1.yaml` (FAIL — 1 high / 4 low), `review-iter-2.yaml` (FAIL — 1 high / 1 low / 1 info), `review-iter-3.yaml` (FAIL — 1 high / 1 medium / 1 low)

## Verdict

**The product change is accepted.** All three iteration-3 findings are closed by
probe, the guard is covered non-vacuously, the host suites are deterministic, and the
aggregate gate is green.

The change is still **not PASS** because the remediation left the change spec's binding
Definition of Done (§17.1) stating pre-remediation facts: it binds "the test plan's 29
scenarios" / "all 29 TCs", "M-1..M-20", and "all four declared plan phases complete",
while the same commit re-scoped the plan to five phases and the test plan to 30
scenarios (TC-HDA-036) and M-21. Every AC and DoD condition is substantively met, but a
literal phase-10 `dod_check` against §17.1 now reads stale counts and a stale phase
count. This is a documentation/artifact-truth defect, **not a code defect**: do not
touch the guard or the tests; bump the spec to v1.6 and refresh two stale headers.

## R3-1 — verified closed

Spec v1.5 (`commit 9a23c8c2`) reconciles the review-mandated host-seam extension:

- §7.1 lists the child-stdin early-close guard at both seams and the fixture drain
  (`chg-GH-277-spec.md:196-197`).
- §7.2 no longer excludes the delivered starter/runner change; it excludes only
  lifecycle/timeout/kill-escalation/buffering/classifier changes and explicitly puts
  the guard in scope (`:215`).
- AC-F4-1 keeps its intent and now says the host spawn path stays the single
  child-process module and carries the guard (EPIPE benign, other stdin error → status
  127) (`:400`).
- §16 adds `packages/adapters/src/host/index.ts` as updated (DEC-7) (`:373`), §21 states
  the same correction (`:471`), NG-3 exempts the guard (`:119`), and DEC-7 records the
  review-mandated fix as adding no API/contract/failure code/process primitive (`:361`).
- The uncommitted doc-sync edit updates `feature-harness-adapters.md` §6 (both seams,
  EPIPE benign, other errors → status 127) and §8 (both new suites), plus the summary
  and `last_updated`.

No remaining "unchanged" claim about the host seams survives in the spec.

## R3-2 — verified closed

`TC-HDA-036` exists in test plan v1.6 and in two suites:

- `tests/behaviour/harness-host-stream.test.ts` — two real-child early-exit legs (streaming
  starter and one-shot runner) drive a 2 MiB prompt to a `process.execPath` child that
  never reads stdin (EPIPE), assert the close-classified result (`status 0`,
  `timedOut false`), empty uncaught/rejection collectors, no orphan, and no leaked
  `tmp/tmpdir/gh275-host-*` root.
- A dedicated module-mock suite (since removed after the CI root cause) — an isolated `node:child_process`
  module mock feeds a coded `EIO` stdin error and asserts the runner's exact
  `{ stdout: "", stderr: "", status: 127, timedOut: false }` and a single settled
  starter completion with `status 127`; the mock is restored in `afterEach` per
  `.ai/rules/typescript.md` §9. The suite was later removed with its
  process-global mock after it corrupted async spawn in CI.
- M-21 (remove both `child.stdin.on("error")` registrations → 4 failing tests) is
  recorded in test plan §7.3/§10; the code-review-independent shape is non-vacuous
  (without a handler the stream error is uncaught; without the `EPIPE` branch the close
  status would be replaced by 127).

Probe (this review, `TMPDIR=$PWD/tmp/tmpdir`):

```
host suites (2 files), 6 consecutive runs:   11 pass / 0 fail each run
stdin-error suite alone, 2 runs:             2 pass / 0 fail each
detail suite, 2 runs:                        12 pass / 0 fail each
leaked gh275-host-* / gh277-default-spawn-*: 0
```

## R3-3 — disposition accepted

`chg-GH-277-plan.yaml` now declares `tier.phases: [1,2,3,4,5]`; phase 5
("Review-iteration-3 remediation for the host child-stdin early-close guard") declares
the two host suites and the change folder, and `plan validate GH-277` →
`verdict=valid`, `tier=full`, `readyForDevelopment=true`. DEC-7 records the accepted
deviation for `packages/adapters/src/host/index.ts` in the spec §15 decision log, which
was R3-3's alternative disposition. Plan phases 1–4 keep commit + gate evidence; phase
5 is open (review_fix in progress) and has no completion note yet, as expected.

## Findings

### F-1 (medium) — the spec's binding DoD was not reconciled with the amended plan/test plan

- `chg-GH-277-spec.md:430` (§17.1 preamble) — "the test plan's 29 scenarios
  (`TC-HDA-001`..`TC-HDA-101`)".
- `chg-GH-277-spec.md:435` (DoD-2) — "all 29 TCs, `TC-HDA-001`..`TC-HDA-101`".
- `chg-GH-277-spec.md:437` (DoD-4) — "Mutation evidence M-1..M-20".
- `chg-GH-277-spec.md:444` (DoD-11) — "all four declared plan phases complete".
- `chg-GH-277-spec.md:599` — checklist repeats 29 TCs / M-1..M-20.
- `chg-GH-277-spec.md:374` — §16 names the edited host-stream suite but not the new
  module-mock suite (since removed).
- Contrast: test plan v1.6 has 30 scenarios and the TC-HDA-036 execution row
  (`chg-GH-277-test-plan.md:1948`), records M-21 (`:1976`), and the plan declares five
  phases (`chg-GH-277-plan.yaml` `tier.phases`). Test plan line 194's claim that the
  spec's DoD-1/DoD-2 claims are unaffected is false as written.

All conditions are substantively met (30/30 execution rows Pass, M-21 recorded,
AC-F4-1 Covered), so this is a wording/artifact-truth gap, not a delivery failure. Fix:
bump the spec to **v1.6** with 30 scenarios (29 spec-named + TC-HDA-036), M-1..M-21,
"all five declared plan phases", Phases 1–5 in the "Proven in" cells, the new suite in
§16, and a revision row.

### F-2 (low) — plan header still cites spec v1.3 / test plan v1.3 / four phases

`chg-GH-277-plan.yaml:5-19` says spec v1.3, DEC-1..DEC-6, test plan v1.3 with 29
scenarios, and "four delivery phases"; the file body is spec v1.5/DEC-7, test plan v1.6
with 30 scenarios, and five phases. Refresh the header in the same remediation.

### F-3 (low) — test-plan mutation range labels still stop at M-20

`chg-GH-277-test-plan.md:1952` heading "Mutation evidence (M-1..M-20)" and the
"M-1..M-20" phrases at `:194` and `:1898` while the table contains M-21 (`:1976`).
Change the labels to M-1..M-21.

### F-4 (low) — starter's non-EPIPE stdin branch does not stop the child

`packages/adapters/src/host/index.ts:271-276` ends the channel and completes
`{ status: 127 }` but does not kill the child, unlike the runner (`:79-84`, which calls
`child.kill()`). A post-acquisition non-EPIPE stdin error therefore resolves the session
while the child can keep running until it exits; the isolated EIO leg asserts only the
result, not an absent child. EPIPE is unaffected (close path ends the process). Optional
hardening: call `kill()` before `complete` (idempotent), or document the difference and
assert `killed` in the EIO leg.

### F-5 (info) — commit body lost the TC id to the commit primitive's ref sanitizer

Commit `9a23c8c2` body reads "(TC-)" because `stripInventedRefs`
(`packages/core/src/domain/commit-message.ts:21`, `TRACKER_REF =
/\b[A-Z][A-Z0-9]*-\d+\b/g`) strips `HDA-036` from `TC-HDA-036`; a read-only probe
reproduces `"Cover the guard (TC-HDA-036)" → "Cover the guard (TC-)"`. Pre-existing
primitive behavior, not introduced by GH-277: cite the TC id in the PR description /
pm-notes and open a follow-up to preserve `TC-*` ids.

### F-6 (info) — doc-sync file is outside every plan-phase scope

Phase 5 scope covers the two suites and the change folder; the uncommitted
`doc/spec/features/feature-harness-adapters.md` edit will be staged by the phase
boundary commit and reported as `scopeDrift` because no phase scope lists it. Add it to
phase 5 `scope.files` or record the accepted drift.

## Plan and artifact compliance

- `plan validate GH-277` → `verdict=valid`, `tier=full`, `readyForDevelopment=true`.
- `lint GH-277` → pm-notes `class: conforms`.
- `verify change GH-277` → `result=partial`, `missing=review_fix,quality_gates,dod_check,pr_creation`
  — expected at this lifecycle point.
- Plan phases 1–4: completion notes exist with commit hashes and gate results; phase 5
  is declared and open pending this review's PASS.
- **Spec compliance: FAIL** (F-1: binding §17.1 contradicts the amended plan/test plan).
- **Plan compliance: PASS** (phase 5 declared, validate valid; F-6 is an info-level
  staging-scope note).

## Gates run this iteration

| Gate | Result |
|---|---|
| `bun test tests/behaviour/harness-host-stream.test.ts` (+ a since-removed module-mock suite) ×6, `TMPDIR=$PWD/tmp/tmpdir` | **11 pass / 0 fail** every run; 0 leaked roots ✅ |
| `bun test tests/behaviour/dispatch-harness-default-detail.test.ts` ×2 | **12 pass / 0 fail** each ✅ |
| `bun run scripts/checks/forbidden-literals.ts` | 5/5 scope classes, **0 violations** ✅ |
| `pnpm typecheck` | exit 0 ✅ |
| `pnpm check:boundaries` | exit 0 — 356 modules / 1041 deps; ambient-globals, entrypoints, secret-read clean ✅ |
| `TMPDIR=$PWD/tmp/tmpdir pnpm check` | **exit 0 — 6618 pass / 4 skip / 0 fail across 783 files**; 60 pre-existing lint warnings; no EPIPE/unhandled lines ✅ |
| Tree state after gates | branch `fix/GH-277/harness-default-allowlist`; only the expected uncommitted doc-sync edit ✅ |

## Next step

`EXECUTE_REMEDIATION_PHASE` — no product-code change. Bump the change spec to v1.6 for
§17.1 (30 scenarios incl. TC-HDA-036, M-1..M-21, five declared phases, Phases 1–5,
validation checklist) and add the isolated host-stdin-error suite to §16 (F-1); refresh
the plan header (F-2) and the test-plan M-1..M-21 labels (F-3); optionally mirror the
runner's kill in the starter's non-EPIPE branch (F-4); record the commit-body TC-id
stripping in the PR/pm-notes and open a follow-up (F-5); add the doc-sync file to phase 5
scope or record the accepted drift (F-6). R3-1, R3-2 and R3-3 are closed; the guard,
TC-HDA-036, plan phase 5, and every gate are accepted.
