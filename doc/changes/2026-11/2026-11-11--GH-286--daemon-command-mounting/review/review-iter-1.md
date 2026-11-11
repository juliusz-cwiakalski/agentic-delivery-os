# Review — GH-286 — iteration 1

- **Status:** FAIL
- **Date:** 2026-11-11
- **Reviewer:** `@reviewer` (local ADOS mode)
- **Branch:** `feat/GH-286/daemon-command-mounting` vs `origin/main-tools`
- **Artifacts:** spec v1.3 (50 ACs), test plan v1.4 (55 TCs), plan v1.4.

## Summary

The mount, the one-scope resolution, the install identity, the pid guard and the per-projection degradation are implemented well and documented accurately. The blocking failure is the detached-start readiness proof: the poll accepts any existing `acquired` record, so a start after a crash reports success with the crash victim's pid, a start whose child records nothing still reports success, and a legitimate `taken-over` acquisition is reported as a timeout. Two declared acceptance criteria (AC-F2-2, AC-NFR-6) and one NFR (NFR-9) are false in the production shape, and two critical negative cases (TC-037/038) are not actually asserted.

## Evidence run

| Check | Result |
|---|---|
| 15 new GH-286 suites (`--max-concurrency 4`) | 156 pass, 0 fail |
| Five delivered guard suites | green |
| help-guide-coverage / forbidden-literals / privacy-literals / ambient-globals / prompt-conformance | all exit 0 |
| `plan validate` | valid, readyForDevelopment true |
| Full battery (`bun test --max-concurrency 4`) | 7255 pass, 4 skip, 1 fail — `ci-baseline-parity` cross-device clone; passes with `TMPDIR=$PWD/tmp/tmpdir` |
| Two probe scripts against the real runtime | F-1 reproduced |

The default-concurrency timeouts are environmental (one hard failure is the cross-device clone), so no GH-286 defect is hiding there. The defect that is hiding is in a cell no suite exercises.

## AC matrix (50)

47 PASS, 3 PARTIAL, 1 FAIL (AC-F2-2). Detailed matrix in the reviewer report; the load-bearing rows:

| AC | Verdict | Note |
|---|---|---|
| AC-F2-1 | PARTIAL | argv/env/binding-last/waits proven, but a pre-existing stale `acquired` record yields a receipt with the old pid (spawned 987, receipt 111) |
| AC-F2-2 | **FAIL** | child records nothing + stale record → start returns success at exit 0 |
| AC-F2-8 | PARTIAL | implementation ordering correct; the only proof (TC-037) is vacuous |
| AC-F2-9 | PARTIAL | TC-038 never counts terminal instance records; the mutant is a tautology |
| AC-F4-4 | PARTIAL | configured values proven only via injected settings; `readDaemonConfiguration` untested |
| AC-NFR-2 | PARTIAL | p95-within-10% clause not measured; watch clause not awaited |
| AC-NFR-3 | PARTIAL | cancellation split not measured; no real-signal case |
| AC-NFR-6 | PARTIAL | `already-running` only holds in the in-process shape |

## Blocking findings

### F-1 — detached readiness poll has no tie to the spawn

`packages/cli/src/daemon-compose.ts:690-760` matches `instance.latest?.operation === "acquired"` without comparing it to the pre-spawn record or the spawn time. Consequences (all reproduced with the real runtime):
1. A crashed daemon leaves `acquired`; the next start returns success at the first 50 ms poll with the dead pid → AC-F2-2 FAIL.
2. A legitimate takeover appends `taken-over`, which is never accepted → start times out while the daemon is resident.
3. A bare start against a live daemon reports success with the live pid instead of `daemon.already-running` → AC-NFR-6/NFR-9 fail, and `already-running`/`takeover-refused` become unreachable from the shipped binary.

**Fix:** read the latest instance before `spawnDetached`; refuse `daemon.already-running` when it is live; accept a record whose instanceId differs from the pre-spawn value (or whose `recordedAt` ≥ spawn time) and whose operation is `acquired` or `taken-over`; add both cells to the start tests.

### F-2 — TC-037 is vacuous

`tests/behaviour/daemon-foreground-lifetime.test.ts:238-289`: the "failing store" delegates straight through and the verdict accepts success or failure. **Fix:** refuse only the terminal append, assert the delivered identity, no data, listeners removed, latest durable record still `acquired`, one append attempt.

### F-3 — TC-038 does not count terminal records

`tests/behaviour/daemon-foreground-lifetime.test.ts:268-316`, `tests/checks/daemon-mutants.test.ts:497-545`: asserts only `latest.operation`; the mutant has a dead guard (`... ? 1 : 1`). **Fix:** count terminal instance records and assert exactly one; make the mutant produce two.

## Medium findings (remediate in the same pass)

- **F-4** — the mutant suite's non-vacuity claim holds for only five controls; the rest assert tautologies over fixture-local functions. Either execute the mutated module for each control or replace the scans with production-level assertions and downgrade the header claim.
- **F-5** — the DM-4 predicate is re-implemented in the tests (`.ai/rules/typescript.md` §9). Export it with `nowMs`/`lockStalenessMs` injection so the boundary cells exercise production code.
- **F-6** — the read-cost test's watch clause is not awaited; the p95 clause is unmeasured; AC-NFR-3's cancellation split is unmeasured.
- **F-7** — `production.ts:427-460` `readDaemonConfiguration` is untested; a *resolved* invalid `daemon` branch composes the refusing runtime while `queue`/`lanes` keep `daemon-unreachable` — an undeclared divergence.
- **F-8** — `doc/spec/features/feature-config-layer.md:387-389` says the owner-hold marker is not relocated by the scope; after this change it is. Qualify the "no override and no home fails" sentence to the resolver/daemon family.
- **F-11** — `install` inspects the supervisor twice (compose-time and inside `installSupervisor`).
- **F-12** — the detached start receipt folds `readDaemonStatus` without the composed heartbeat interval/staleness, so a non-default `daemon.lock-staleness` can make the receipt disagree with `status`/`queue`/`lanes`.
- **F-13** — with no home but an absolute state-dir override, `supervisorConfigDirectoryFor` yields `/.config`; the fail-closed rule is not mirrored for the config root.
- **F-14** — `tests/fixtures/daemon/mount-golden/{normalize.ts,status-unreachable.json}` are imported by no test.
- **F-15** — test hygiene: empty `finally {}`, `require()` in ESM, unused `Bun.file` binding, `void x` unused-import silencers, `as never as` casts.

## Low / accepted

- **F-9 — commit hygiene (accepted, recorded).** All 25 commits use the commit primitive's deterministic template subject. The primitive is the only permitted write path (AGENTS.md), the template fallback is its documented behaviour when no summary transport is configured, and the branch is unpushed. Rewriting 25 primitive-generated commits by hand is not authorised; the change semantics will be carried by the PR description instead. Recorded as a known limitation of phase-mode commits in this repository, not as a code defect.
- **F-10 — scope deviation (declare, not revert).** Nine reconciled docs are outside phase-7 `scope.files`; all reverse a now-false claim and are accurate. The spec §16 list and the plan's phase-7 scope must be extended so the declaration matches the delivered work.

## Documentation

Comprehensive and — with F-8 — accurate. F-1 also invalidates two documentation claims (a bare start reaches a durable `acquired` instance; `already-running` is the live-start outcome) until it is fixed.

## Next

`CALL_CODER`: fix F-1, F-2, F-3, F-4, F-5, F-6, F-7, F-8, F-11..F-15; extend the spec/plan declarations for F-7/F-10/F-13; then re-run `@doc-syncer` and re-review.
