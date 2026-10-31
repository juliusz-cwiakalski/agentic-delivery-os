# Code Review Iteration 2 - GH-187

Verdict: PASS
Work Item: GH-187
Branch: feat/GH-187/license-registry-hardening
Base: origin/main-tools (c62cdb8)
Reviewed HEAD: 3dc6adb
Merge base: c62cdb8
Mode: local
Date: 2026-10-31
Iteration: 2

## Verdict Summary

PASS. All iteration-1 non-blocking findings are genuinely closed, and the
remediation introduced no product-behaviour, test-coverage, or gate regression.
TC-LICREG-024 now executes every one of the 84 declared deny-list cases through
`failuresForCase`, asserting a non-empty failure set for negatives (and the
declared `expectedReason` where present) and an empty set for the two control
extensions, with executed and unique-id counts equal to the declared 84. The
duplicate `blank` fixture is removed, `deniedSingles`/`unknownReferences` are now
consumed, `failuresForCase` is used, and every remaining `cases.json` key is
referenced. Plan Phase 6 is checked and its Execution Log row is Completed; the
test-plan section 10 log is populated.

No product surface changed since iteration 1: the registry, the audit, the
workflow, the lockfile, the manifests, and ADR-0003 are untouched, and the
enabling privacy-release repair is unchanged. Two low documentation nits and two
informational notes remain; none blocks quality gates, DoD, or PR.

## Dimension Verdicts

- A. Spec and plan compliance: PASS (iteration-1 gaps closed)
- B. Code correctness and security: PASS (no product change; prior verdict stands)
- C. Test quality and determinism: PASS (84/84 executed, 0 weakened)
- D. Repository conventions (.ai/rules/typescript.md, testing-strategy): PASS

## Finding Counts

- Blocker (critical/high): 0
- Minor (medium): 0
- Low: 2 (F-1, F-2)
- Info: 2 (F-3, F-4)

## Iteration-1 Finding Closure

| ID | Iter-1 severity | Status | Evidence |
|----|-----------------|--------|----------|
| F-1 | medium | CLOSED | TC-LICREG-024 drives all 84 declared cases via `failuresForCase`; negatives assert `failures.length > 0` (plus `expectedReason` where present), the two `failureExpected:false` controls assert `toEqual([])`; executed and unique-id counts equal 84. Fixture confirmed: 84 cases, 84 unique ids, group sum 84. |
| F-2 | medium | CLOSED | Test-plan section 10 populated (v1.6) with license 44/44, checks 331/331, full 1434/1434, seven invariant checks, 22/22 bash, doc-distribution 81, privacy-release 8/8. Pass/fail, file, and suite counts match freshness. Residual: expect-call figure (new F-1). |
| F-3 | low | CLOSED | `failuresForCase` is used (line 669); `biome check` on the changed tests is clean. |
| F-4 | low | CLOSED | `blank` removed from `cases.json` and both `LicenseCases` types; `deniedSingles`/`unknownReferences` asserted in TC-LICREG-024; all 21 remaining `cases.json` keys are referenced by a test. |
| F-5 | low | CLOSED | Plan tasks 6.1-6.5 checked; Execution Log row 6 Completed with commit d5db953; remediation note records F-1..F-7 dispositions. |
| F-6, F-7 | info | ACCEPTED | Informational; no code change required, unchanged. |
| F-8 | info | ACCEPTED | Enabling privacy-release repair unchanged since iteration 1 and still sound. |

## Acceptance Criteria Compliance

No product surface changed since iteration 1, so the iteration-1 AC verdicts stand.
Spot re-verification on this HEAD:

| AC group | Result | Evidence |
|----------|--------|----------|
| AC-F1-1..4 schema v3, floor, scope/schema fail-closed, policy notes | PASS | Registry schema 3, 20 deny ids, allow `[Apache-2.0, BSD-3-Clause, ISC, MIT]`, 16 entries; TC-LICREG-001..005, 031 |
| AC-F2-1..3 deny-before-allow, overlap, denied branches | PASS | TC-LICREG-006..010 |
| AC-F3-1..3 deny-list integrity and floor | PASS | TC-LICREG-011/012/013 (the 18 malformed and 25 removal cases now also executed in TC-024) |
| AC-F4-1..2 unregistered/unknown/non-asserted/non-allow-listed | PASS | TC-LICREG-015/016/017 |
| AC-F5-1..2 gate bindingness and suite completeness | PASS | TC-LICREG-020/021/024/029; workflow byte-unchanged; invariants exit 0 |
| AC-F6-1 live `MIT OR Apache-2.0` passes | PASS | TC-LICREG-018/019; live audit `OK` |

Ticket ACs and spec Appendix B remain satisfied. TDR-0007 remains `Proposed` and
ADR-0003 remains unedited.

## Plan Task Audit

- Checked and delivered: 1.1-5.4 and now 6.1-6.5.
- OPEN_TASKS: 7.x (review, this iteration) and 8.x (finalization) — expected.
- DONE_BUT_UNCHECKED: none.
- CHECKED_BUT_MISSING: none.
- Plan Status: delivery and doc-sync complete; finalization outstanding.

## Checks Executed

| Check | Result |
|-------|--------|
| `git diff --name-only d5db953...HEAD -- scripts doc/legal .github pnpm-lock.yaml package.json 'packages/*/package.json' doc/decisions` | empty — no product/CI/lockfile/manifest/decision change since iteration 1 |
| `bun test tests/checks/license-*.test.ts tests/checks/privacy-release.test.ts` | PASS — 52 pass, 0 fail (44 license + 8 privacy) |
| `bun test tests/checks` | PASS — 331 pass, 0 fail, 29 files |
| `bun test` (== `pnpm test`) | PASS — 1434 pass, 0 fail, 133 files, 13181 expect calls |
| `bun run scripts/checks/license-audit.ts` | PASS — `OK license-audit: ...`, exit 0 |
| `bun run scripts/checks/{ci-topology,ci-bindingness,ci-supply-chain,script-surface,pin-equality,vulnerability-gate}.ts` | PASS — all exit 0 |
| `bash scripts/.tests/test-doc-distribution.sh` | PASS — 81 in-scope docs, no drift |
| `rg 'test\.(skip|only|todo)' tests/checks/license-*.test.ts` | none |
| `pnpm exec biome check` on changed tests | clean (no warning) |
| deny-list fixture counts | 84 cases, 84 unique ids, group sum 84 |

## Base Repair Assessment (tests/checks/privacy-release.test.ts)

Unchanged since iteration 1. The base-relative `expectedAdded` still requires exactly
the GH-184 changeset when the base lacks it and none when the base already carries it,
while rejecting any other added path and any modified/deleted changeset and failing
loudly on a missing `origin/main-tools`. The original on-branch guarantee and release
guard are preserved. No action.

## Findings

### F-1 [low] Test-plan section 10 expect-call count is stale

Location: `doc/changes/2026-10/2026-10-31--GH-187--license-registry-hardening/chg-GH-187-test-plan.md:1384` (also the v1.6 revision row at line 1374)

Section 10 records the full run as "1434 pass / 0 fail across 133 files, 13062 expect
calls"; a fresh `bun test` on this HEAD reports the same 1434 tests across 133 files
with **13181** expect calls. Pass/fail, file, and suite counts are correct; the
expect-call figure looks captured before the TC-LICREG-024 loop landed. Replace 13062
with the current 13181 (or omit it / pin the run commit).

### F-2 [low] Plan still cites test plan v1.5 after the v1.6 bump

Location: `doc/changes/2026-10/2026-10-31--GH-187--license-registry-hardening/chg-GH-187-plan.md:27` (also lines 43-49 and RSK-P2 line 137)

The test plan is now v1.6 (row 1.6 in 3dc6adb), but the plan still refers to "test plan
v1.5" in seven current-state references (Context line 27, lines 43-49, RSK-P2 line 137;
the eighth v1.5 mention is a legitimate historical revision-log row) and has no Plan
Revision Log row for the iteration-1 remediation that changed Phase 6 status and added
the remediation section. Bookkeeping drift only. Update the citations to v1.6 and add a
short revision row.

### F-3 [info] Test plan still cites spec v1.3 while the spec is v1.4

Location: `doc/changes/2026-10/2026-10-31--GH-187--license-registry-hardening/chg-GH-187-test-plan.md:58` (also line 53 and several TC notes)

Pre-existing (present in iteration 1, not introduced by this remediation). Optional
cleanup when next touching the test plan.

### F-4 [info] TC-LICREG-024 asserts failure presence, not per-case class token

Location: `tests/checks/license-policy.test.ts:668`

The loop drives every case and asserts fail/control, but does not assert each case's
`classToken` (only fixture-wide vocabulary membership). Class-specific proof remains in
TC-LICREG-007/008/009/011/012/013/016/017, so coverage is not reduced; the test-plan
step-4 requirement (executed == declared, one assertion per case) is met. Optional
strengthening only.

## Notes

- Working tree is clean; both remediation commits are present (`5485abb` tests/fixtures/
  plan, `3dc6adb` docs/test-plan/review artifacts/pm-notes).
- No `.changeset` entry, SBOM, notice, or checksum artifact was introduced.
- The remediation did not edit `scripts/checks/license-audit.ts`, the registry, the
  workflow, the lockfile, the manifests, TDR-0007, or ADR-0003.

## Next Step

PROCEED. The change is ready for quality gates, DoD, and PR. F-1 and F-2 are trivial
documentation corrections and are non-blocking; F-3 and F-4 are optional.
