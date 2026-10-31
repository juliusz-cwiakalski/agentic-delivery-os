# GH-177 — delivery evidence

> **Status: implementation phases 1–6 complete; lifecycle phases 7–10 are not
> executed by `@coder`.** This artifact records only observed evidence. The
> final local battery below ran on the working HEAD `5894ef0` with a clean tree;
> this changeset and evidence file are the subsequent docs-only commit. No push,
> PR, merge, or owner-acceptance claim is made here.

Authoritative inputs: [spec](./chg-GH-177-spec.md) v1.2 (C-4 rows corrected to
the normative bash order at `a772bfb`; AC-V1..V14, C-1..C-8, DEC-1..11,
NFR-1..7), [test plan](./chg-GH-177-test-plan.md) v1.1 (21 TCs, §4.1 harness,
§4.2 non-vacuity), [plan](./chg-GH-177-plan.md) v1.1 (PIN-1..PIN-7, D1..D12,
Phases 1–10), [TDR-0005](../../../decisions/TDR-0005-delivery-result-enum-and-cli-exit-taxonomy.md)
(Proposed pending owner ratification).

Branch: `feat/GH-177/verify-change-exit-taxonomy`, cut from `main-tools`.

## Phase commits (Phases 1–6 only)

| Phase | Commit | Subject |
|-------|--------|---------|
| 1 | `4bd71c1` | `feat(GH-177): add delivery result contracts vocabulary with synchronized verify error row` |
| 2 | `24f2a79` | `feat(GH-177): add pure verify classifier with presence-tolerant registry read` |
| 3 | `45065ab` | `feat(GH-177): add verify change command with classification and rejection surfaces` |
| 4 | `b237a8e` | `test(GH-177): prove state-failure classification, envelope exit matrix, and determinism` |
| 5 | `5894ef0` | `test(GH-177): pin real-corpus classification and fail-closed bindings with full gate battery` |
| 6 | this docs commit | `docs(GH-177): record changeset and delivery evidence with final local battery` |

## Per-phase green criteria (observed)

| Phase | Focused commands | Result | `pnpm check` |
|-------|------------------|--------|--------------|
| 1 | `bun test tests/structure/delivery-result-contract.test.ts tests/structure/error-table.test.ts tests/checks/error-table-sync.test.ts tests/structure/content-inventory.test.ts tests/structure/port-contract-inventory.test.ts`; `bun run scripts/checks/error-table-sync.ts` | **96 pass / 0 fail**; sync `entries=27 documented=27 S1=36 S3=14 corpus=13 ignored=45` | exit 0 (**1015 tests**) |
| 2 | `bun test tests/behaviour/verify-change-classification.test.ts tests/structure/verify-imports.test.ts tests/behaviour/phase-registry.test.ts` | **48 pass / 0 fail** | exit 0 (**1049 tests**) |
| 3 | `bun test tests/behaviour/verify-change-classification.test.ts tests/behaviour/verify-change-rejections.test.ts tests/structure/cli-edge-seam.test.ts tests/structure/state-scope.test.ts tests/structure/verify-imports.test.ts`; ambient/forbidden/exit/workspace checks | **84 pass / 0 fail**; five invariant checks exit 0 | exit 0 (**1076 tests**) |
| 4 | `bun test tests/behaviour/verify-change-state.test.ts tests/behaviour/verify-envelope.test.ts` | **20 pass / 0 fail** | exit 0 (**1096 tests**) |
| 5 | focused 10-suite verify/structure batch; `bun test tests/boundaries`; five invariant checks | **176 pass / 0 fail**; boundaries **126 pass / 0 fail**; invariant checks exit 0 | exit 0 (**1106 tests**) |
| 6 | ordered final battery below | see gate table | exit 0 (**1106 tests**) |

TC-VERIFY-016/018/019 fail-closed controls were re-run at the Phase 5 boundary
inside their suites (missing/mutated bash reference, mutated C-4 table,
malformed/duplicated/absent error-table rows); the unchanged controls were green
in the same runs. No test was weakened.

## Final local battery (measured at `5894ef0`, clean tree)

| Gate | Command | Result |
|------|---------|--------|
| Install | `pnpm install --frozen-lockfile` | exit 0; lockfile unchanged |
| Focused verify suites | 10-suite batch (classification, rejections, state, envelope, corpus, delivery-result-contract, verify-imports, content-inventory, error-table, error-table-sync) | **176 pass / 0 fail**, 3202 expects |
| Aggregate | `pnpm check` | exit 0; **1106 pass / 0 fail**, 9070 expects, 105 files; lint, format, typecheck, tests, boundaries, exports-parity green |
| Error table | `bun run scripts/checks/error-table-sync.ts` | exit 0; `entries=27 documented=27` |
| Ambient | `bun run scripts/checks/ambient-globals.ts` | exit 0; 24 neutral-set files clean |
| Literals | `bun run scripts/checks/forbidden-literals.ts` | exit 0; 0 violations |
| Exit literals | `bun run scripts/checks/exit-code-literals.ts` | exit 0; projection module remains the only exit-digit owner |
| Entrypoints | `bun run scripts/checks/workspace-entrypoints.ts` | exit 0; declared edges resolve |
| Doc distribution | `bash scripts/.tests/test-doc-distribution.sh` | exit 0; no drift, 80 in-scope docs |
| Whitespace | `git diff --check` | exit 0 |
| Tree | `git status --porcelain` | empty before the Phase 6 docs commit |

## TC coverage map (21/21 implemented)

| TC | Suite | Executing command | Phase | Result |
|----|-------|-------------------|-------|--------|
| TC-VERIFY-001 | `tests/behaviour/verify-change-classification.test.ts` | `bun test tests/behaviour/verify-change-classification.test.ts` | 2 (pure) → 3 complete | PASS |
| TC-VERIFY-002 | same | same | 2 → 3 | PASS |
| TC-VERIFY-003 | same | same | 2 → 3 | PASS |
| TC-VERIFY-004 | same | same | 2 → 3 | PASS |
| TC-VERIFY-005 | same + `tests/fixtures/state/harness.ts` | same | 2 → 3 | PASS |
| TC-VERIFY-006 | `tests/behaviour/verify-corpus.test.ts` | `bun test tests/behaviour/verify-corpus.test.ts` | 5 | PASS |
| TC-VERIFY-007 | `tests/behaviour/verify-change-rejections.test.ts` + `tests/fixtures/verify/malformed/**` | `bun test tests/behaviour/verify-change-rejections.test.ts` | 3 | PASS |
| TC-VERIFY-008 | same | same | 3 | PASS |
| TC-VERIFY-009 | same | same | 3 | PASS |
| TC-VERIFY-010 | `tests/behaviour/verify-change-state.test.ts` + state harness | `bun test tests/behaviour/verify-change-state.test.ts` | 4 | PASS |
| TC-VERIFY-011 | `tests/behaviour/verify-change-rejections.test.ts` | same | 3 | PASS |
| TC-VERIFY-012 | `tests/behaviour/verify-envelope.test.ts` | `bun test tests/behaviour/verify-envelope.test.ts` | 4 | PASS |
| TC-VERIFY-013 | same | same | 4 | PASS |
| TC-VERIFY-014 | same + `tests/structure/verify-imports.test.ts` | both suites | 2 + 4 | PASS |
| TC-VERIFY-015 | `tests/behaviour/verify-envelope.test.ts` | same | 4 | PASS |
| TC-VERIFY-016 | `tests/structure/delivery-result-contract.test.ts` | `bun test tests/structure/delivery-result-contract.test.ts` | 1; re-proof 5 | PASS |
| TC-VERIFY-017 | same | same | 1 | PASS |
| TC-VERIFY-018 | same | same | 1; re-proof 5 | PASS |
| TC-VERIFY-019 | `tests/structure/error-table.test.ts`, `tests/checks/error-table-sync.test.ts` | both suites + sync check | 1; re-proof 5 | PASS |
| TC-VERIFY-020 | `tests/structure/verify-imports.test.ts`, `cli-edge-seam`, `content-inventory`, `state-scope`, `inventory.json` | corresponding suites | 1–5 | PASS |
| TC-VERIFY-021 | `tests/structure/verify-imports.test.ts` (gate pins + seeded probes), existing `tests/boundaries/**` | `bun test tests/boundaries` + five invariant checks | per-phase, complete 5 | PASS |

AC coverage: all AC-V1..V14 and NFR-1..NFR-7 are covered by the rows above; no
deferred TC and no orphaned AC.

## Deviations from the plan (all additive, no TC reshaped)

1. **Spec C-4 row order (`a772bfb`, PM-owned).** The delivery blocker was a
   documented-table order contradiction: bash and `DELIVERY_RESULT_TOKENS` list
   `failed` before `finished`, while the C-4 table listed `finished` first.
   PM/user resolved it by reordering the two rows at `a772bfb`; TC-VERIFY-016/018
   then passed unchanged, including the reordered-rows mutation control.
2. **`tests/fixtures/ports/v1-contract-inventory.json` (Phase 1, task 1.6).**
   This pre-existing binding fixture pins the whole `core ./contracts` export
   surface; adding `delivery-result.ts` required adding the module and its eight
   exports both in the fixture and in `index.ts`'s list. No test semantics
   changed; TC-PORT-001 stays bidirectional.
3. **`biome.json` override (Phase 3, task 3.4).** Added a formatter/linter
   override for `tests/fixtures/verify/malformed/**` so intentionally invalid
   YAML fixtures are neither reformatted into valid documents nor linted (the
   existing `tests/fixtures/config/yaml/malformed.yaml` override is the
   precedent). Production files are unaffected.
4. **TC-VERIFY-021 location.** The gate pins and seeded probes live in
   `tests/structure/verify-imports.test.ts` (the plan's Phase 5 file list did not
   require a new boundary fixture; D7 forbids a new rule). `tests/boundaries/**`
   remains untouched and green.
5. **TC-VERIFY-016/018/019 re-proof (Phase 5, task 5.2)** was executed by
   re-running the existing suites at the Phase 5 boundary rather than adding a
   duplicate test; the recorded results are in the per-phase table.

## Rollback

The change is fully additive. A single-PR revert removes the contracts module and
the one error row, the classifier, the tolerant read, the command, the tests and
fixtures, this changeset, and this evidence artifact. No data cleanup is needed
(verify wrote nothing). Never roll back one side of the error-table sync; re-run
the baseline checks after any rollback.

## Owner-facing notes

- **TDR-0005 is Proposed.** The `state-unverified` token projects to exit `2`
  (platform-provider), the single documented deviation from bash's exit `1`;
  token parity is the dual-run unit. Owner ratification at PR review is pending.
- **PIN-1..PIN-7 are delivery-bound spellings** (reachable-subset derivation,
  `recordCount` semantics, `overlaidPhases` order, `detail` spelling, staged API,
  tolerant-read name, runtime/command spellings). The owner may amend them at
  review; no behaviour, identity, token, exit, or summary grammar changes without
  a plan revision.
- **Phases 7–10 (review, conditional remediation, doc sync, finalize/PR) are
  PM-scheduled and were not executed here.** No push or PR was performed.
