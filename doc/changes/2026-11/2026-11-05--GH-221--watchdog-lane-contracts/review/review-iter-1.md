---
id: chg-GH-221-review-iter-1
status: PASS
reviewed_by: reviewer
iteration: 1
date: 2026-11-05
scope: full branch diff origin/main-tools...HEAD (13 commits, 56 files, +7079/-59)
---

# Review — GH-221 (Watchdog and lane contracts), iteration 1

## Verdict

**Status: PASS** — 0 blocker / 0 major / 4 minor / 3 notes. No artifact reopened; plan
phase 8 (post-review fixes) stays skipped; remediation phase NONE. Findings are
non-blocking quality debts, routed as follow-up candidates for the human PR gate or
M1-S15-adjacent work.

## Verification evidence (run read-only)

- Behaviour suites: preflight/teardown/memory 30 pass / 0 fail; liveness, envelope,
  exit, checks-not-runner, determinism, golden 36 pass / 0 fail.
- Structure + checks: watchdog-contract, watchdog-imports, error-table, sync —
  119 pass / 0 fail; `error-table-sync.ts` → entries=44 documented=44 OK.
- `bun test tests/boundaries` 135 pass / 0 fail; `pnpm typecheck` green;
  forbidden-literals registry includes the new feature spec.

## Dimension A — spec/plan compliance

- ACs 14/14 satisfied with evidence: AC-F1-1..3 (TC-010/011/012, real temp repos,
  exact codes/exits/evidence, byte-identical preflight snapshots); AC-F2-1..3
  (TC-020/021/022/023/030 — restore-on-every-exit, attributed-ref preservation,
  idempotent clean teardown, 6/6 matrix rows refused-or-restored); AC-F3-1
  (TC-024/025/026 — committed→reported, uncommitted→byte-identical preserved, four
  destructive negatives with clean `.ai/memory`-scoped git call logs); AC-F4-1/2
  (TC-040/042/043 — exit 2, no `verdict` key in payload, CPU facts classify absent);
  AC-F5-1..3 (TC-003/004/005/050–054 — 3 rows pinned order, 41→44 and +7→+10 exact,
  `{0,1,2}` totality, grammar→existing identities, zero `fallback.internal`);
  AC-F6-1/2 (TC-006/007/013/060 — no runner verbs/ports/imports, brand via seam).
- Binding decisions honored: no CPU field in `WatchdogSignals` (structural assert);
  checks-not-runner (static + runtime; git children sanctioned); memory verification
  inside teardown, never stages/commits/reverts/cleans `.ai/memory` (seam mutation
  surface exactly `checkout`, `update-ref`, guarded `rm`).
- M1-S1 boundary (TR-11) confirmed: no sourced `stalled`/`progressing` anywhere;
  `EXIT_MATRIX` marks both `reachable: false` with the GAP-T2/M1-S15 note; production
  edge wires zero signal sources (PIN-6).
- Error table machine/doc/corpora in two-way sync, counts exact, no loosened asserts.
- Plan tasks 1.1–6.3 + 9.1–9.3 done with done-artifacts; 7.1/7.2 closed by this
  review; 8 conditional-skip; 9.4 PM-owned. TC identities/assertions/exits un-reshaped
  (GAP-T4 honored).
- DEC-1 confirmed at this gate per plan 7.2 (memory-publish verification inside
  teardown; matches shipped-contract pack + AC evidence clause + memory conventions).
  The human PR gate should mirror the confirmation per spec §18.

## Dimension B — code quality findings

1. **[minor] Grammar widening vs recorded deviation** — `scripts/checks/error-table-sync.ts:73,81`
   and `tests/structure/error-table.test.ts:52` widened the code grammar
   (`[a-z][a-z0-9]*` → `[a-z][a-z0-9-]*`) though the three watchdog codes bypass via
   `RESERVED_TWO_SEGMENT_CODES`; pm-notes recorded "no general loosening". Resolution:
   keep the widening, amend the deviation record to declare it explicitly (PM
   decision 2026-11-05; behaviorally identical alternative was a revert).
2. **[minor] Porcelain path parsing can mis-quote exotic paths; `removePath` masks the miss** —
   `packages/adapters/src/git/watchdog.ts:104,183,257`: C-quoted paths / rename
   arrows from `--porcelain=v1` can make `rm --force` report removal of a path that
   remains on disk. Candidate: parse `-z` NUL-separated output.
3. **[minor] N+1 child processes in memory scan** — `packages/adapters/src/git/watchdog.ts:158`:
   one `git log` per tracked `.ai/memory` file; batch to a single walk or bound it.
4. **[minor] Partial-restoration reporting gap on mid-plan failure** —
   `packages/cli/src/commands/watchdog.ts:146–204`: a later-action failure envelope
   omits already-performed action entries (evidence-in-summary per PIN-1 would fix).
5. **[note] Residue removal ordered after checkout restore** —
   `packages/core/src/domain/watchdog.ts:202–232`: conflicting untracked residue makes
   checkout refuse (fail-closed, classified) instead of restore-then-remove. Optional reorder.
6. **[note] Predicate-level mutants in some behaviour suites** —
   `watchdog-teardown.test.ts`, `watchdog-preflight.test.ts`: prove discriminative
   power, not production wiring; consider source-level mutants next touch.
7. **[note] Single-declared-signal `progressing`** — corroboration required only for
   `stalled` (compliant with DEC-3/AC-F4-2); flag positive-side corroboration for M1-S15.

## Structured summary

```
Status: PASS
Remediation Phase: NONE
Findings Count: 7 (0 blocker / 0 major / 4 minor / 3 notes)
Plan Status: ALL_TASKS_DONE (1.1–6.3, 9.1–9.3; 7.1/7.2 closed here; 8 skip; 9.4 PM-owned)
Plan Gaps: none
Test Coverage Gaps: none (GAP-T1/T2 designed M1-S15 deferrals)
Next Step: PROCEED (record verdict; DoD 9.4; PR creation; DEC-1 confirmation at human PR gate)
```
