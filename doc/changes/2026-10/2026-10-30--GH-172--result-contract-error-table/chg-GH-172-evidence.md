# GH-172 — delivery evidence

Authoritative artifacts: [spec](./chg-GH-172-spec.md) v1.1,
[test plan](./chg-GH-172-test-plan.md) v1.2 (38 TCs),
[plan](./chg-GH-172-plan.md) v1.1 (7 phases), DoR verdict
[readiness iteration 2](./readiness-iter-2.md).

Branch: `feat/GH-172/result-contract-error-table`, based on `main-tools` @
`b3a00a9`. No pushes and no PR were created during delivery.

## Phase commits

| Phase | Commit | Message |
|-------|--------|---------|
| 1 | `dadab48` | `feat(GH-172): add CommandResult envelope contract and testkit conformance validator` |
| 2 | `bfaef7b` | `feat(GH-172): declare error table with fallback containment, classification, and exit projection` |
| 3 | `0527312` | `feat(GH-172): add runCli surface with serialization, containment, and outcome goldens` |
| 4 | `92d8f71` | `feat(GH-172): prove redaction chokepoint and confine brand reads to the edge seam` |
| 5 | `0d3352a` | `feat(GH-172): author documented error table with binding sync and exit-literal checks` |
| 6 | `a1e2070` | `feat(GH-172): enforce result contract boundaries and wire checks into CI fast loop` |
| 7 | this commit | `docs(GH-172): finalize result contract evidence, gates, and release reconciliation` |

Every phase was independently green at its commit boundary.

## Phase green criteria (observed)

| Phase | Commands | Result |
|-------|----------|--------|
| 1 | `bun test tests/structure/result-contract.test.ts`; `bun run scripts/checks/ambient-globals.ts`; `pnpm check` | 14 pass; exit 0; `pnpm check` exit 0 (263 tests) |
| 2 | `bun test tests/structure/error-table.test.ts tests/behaviour/error-classification.test.ts tests/behaviour/exit-projection.test.ts`; `pnpm check:boundaries`; `pnpm check` | 34 pass; exit 0; `pnpm check` exit 0 (297 tests) |
| 3 | `bun test tests/behaviour/run-cli.test.ts tests/golden`; `bun test tests/structure`; `pnpm check` | 42 pass; structure green; `pnpm check` exit 0 (340 tests) |
| 4 | `bun test tests/golden/redaction.test.ts tests/structure/cli-edge-seam.test.ts tests/structure/result-fixtures.test.ts`; `pnpm check` | 30 pass; `pnpm check` exit 0 (370 tests) |
| 5 | `bun run scripts/checks/error-table-sync.ts`; `bun run scripts/checks/exit-code-literals.ts`; `bun test tests/checks/error-table-sync.test.ts tests/checks/exit-code-literals.test.ts`; `pnpm check` | sync exit 0 (`entries=4 documented=4 S1=4 S3=14 corpus=13 ignored=35`); exit-literals exit 0 (34 files); 28 pass; `pnpm check` exit 0 (398 tests) |
| 6 | `bun test tests/boundaries`; `bun test tests/boundaries tests/checks/ci-checks.test.ts tests/checks/error-table-sync.test.ts tests/checks/exit-code-literals.test.ts`; `pnpm check` | 109 pass; 159 pass; `pnpm check` exit 0 (410 tests) |

## Final gate consolidation (HEAD)

| Gate | Result |
|------|--------|
| `bun test` (all layers, incl. `tests/golden`) | 410 pass, 0 fail, 1865 expectations, 34 files |
| `pnpm lint` / `pnpm format:check` | exit 0 |
| `pnpm typecheck` | exit 0 |
| `pnpm check` (five-step aggregate text unchanged) | exit 0 |
| `pnpm run check:boundaries` | depcruise clean (39 modules, 18 deps); ambient guard 8 files; workspace entrypoints clean |
| `bun run scripts/checks/error-table-sync.ts` | exit 0; non-zero per-level counts |
| `bun run scripts/checks/exit-code-literals.ts` | exit 0; 34 files; `tests/**` excluded by design |
| `bun run scripts/checks/forbidden-literals.ts` | exit 0; 5/5 scope classes; 0 violations |
| `bun run scripts/checks/ambient-globals.ts` | exit 0 |
| `bun run scripts/checks/ci-topology.ts` | exit 0; 7 bash + 16 TS jobs |
| `bun run scripts/checks/ci-bindingness.ts` | exit 0 |
| `bun run scripts/checks/ci-supply-chain.ts` | exit 0 |
| `bun run scripts/checks/license-audit.ts` | exit 0; no new dependency |
| `bun run scripts/checks/vulnerability-gate.ts` | exit 0; 0 high/critical |
| `bash scripts/.tests/test-*.sh` | 19/19 pass (one unrelated `test-ceo-loop.sh` flake on first run; immediate rerun 54/54 pass) |
| `bash tools/.tests/test-*.sh` | 3/3 CI-safe suites pass; the 3 paid/performance e2e suites are excluded exactly as CI excludes them |
| `git diff --name-only --diff-filter=D origin/main-tools...HEAD -- tests` | no deleted tests |
| `git diff --name-only origin/main-tools...HEAD -- pnpm-lock.yaml` | unchanged |
| New test files scanned for `.skip`/`.todo`/`.only`/`--filter`/`--passWithNoTests` | none |
| `git status --porcelain` | only the PM-owned `chg-GH-172-pm-notes.yaml` remains modified; it was never staged |

## TC coverage

All 37 automated TCs are implemented and green:

- Envelope: TC-RESULT-001, TC-RESULT-002, TC-RESULT-003, TC-RESULT-004,
  TC-RESULT-005, TC-RESULT-006.
- Table: TC-TABLE-001, TC-TABLE-002, TC-TABLE-003, TC-TABLE-004.
- Classification: TC-CLASSIFY-001, TC-CLASSIFY-002.
- Exit projection: TC-EXIT-001, TC-EXIT-002, TC-EXIT-003.
- Surface: TC-RUNCLI-001, TC-RUNCLI-002, TC-RUNCLI-003, TC-RUNCLI-004.
- Containment: TC-CONTAIN-001, TC-CONTAIN-002, TC-CONTAIN-003.
- Redaction: TC-REDACT-001, TC-REDACT-002, TC-REDACT-003, TC-REDACT-004.
- Sync: TC-SYNC-001, TC-SYNC-002, TC-SYNC-003, TC-SYNC-004, TC-SYNC-005,
  TC-SYNC-006.
- Boundaries/regression: TC-BOUNDARY-001, TC-BOUNDARY-002, TC-BOUNDARY-003,
  TC-BOUNDARY-004, TC-BOUNDARY-005.

TC-REVIEW-001 remains the manual PR-review item (hint quality, DEC-13 fallback
values, evolution discipline, dynamic stream-write review, gate integrity, no
product name).

## Deviations (with justification)

1. **Workspace build prerequisite.** Package-name imports of `core ./contracts`
   require built `dist` declarations/JS for `tsc`, Bun runtime resolution, and
   depcruise. Root `pretypecheck` and `pretest` scripts now run `pnpm build`
   before those named gates. The five-step aggregate `check` string is unchanged;
   no gate is relaxed. Without this, the first cross-package import would fail
   typecheck/tests/depcruise on a fresh clone.
2. **Golden byte-exactness.** `biome.json` disables the formatter for
   `tests/fixtures/result/envelopes/**` only. `biome format --write` otherwise
   collapses short arrays, changing the serializer's exact bytes. Linting of
   fixtures is unchanged; goldens remain byte-exact.
3. **`ambient-env-cli` vehicle.** The plan's D2 named a dependency-cruiser rule for
   `process.env`/`Bun.env`, but dependency-cruiser inspects import graphs, not
   identifiers. Enforcement is an AST structure scan with temp-copy mutations in
   `tests/structure/cli-edge-seam.test.ts`, applied to **all** CLI modules
   including `edge.ts` (no exception path, per D2). The edge receives environment
   facts as injected data.
4. **CI wiring moved one phase earlier.** Task 5.6 said not to wire the checks
   yet, but the existing `ci-topology` invariant requires every
   `scripts/checks/*.ts` to be invoked by a named job; Phase 5 could not be green
   otherwise. The two additive lines in the existing `ts-invariants` step landed
   in Phase 5; Phase 6 still delivers the boundary rules and CI assertions.
5. **Existing CI assertion updated.** `tests/checks/ci-checks.test.ts` previously
   required the `ts-invariants` block to be byte-identical to `main-tools`. It now
   requires every base line to remain present plus the two new check lines, and
   still asserts the diff has no removed lines. This is additive, not a
   weakening.
6. **Registered the new user-facing doc.** `scripts/checks/forbidden-literals.registry.json`
   registers `doc/spec/features/feature-result-contract.md`; the scan fails closed
   for a new doc absent at the corpus baseline. The scan's scope classes and
   allowlist were not changed.
7. **No doc-distribution marker on the feature doc.** Verified out of the drift
   guard's scope (D11); `test-doc-distribution.sh` and its negative-mode suite are
   green.
8. **`test-ceo-loop.sh` flake.** First full bash run failed two unrelated
   `ceo_is_stuck` cases; an immediate rerun passed 54/54. No GH-172 file touches
   that surface.

## Contract questions discovered

None blocking. The plan's task 5.6 versus the existing `ci-topology` wiring rule
was the only internal contradiction; it was resolved by wiring the two additive
lines in Phase 5 (deviation 4).
