# GH-174 — delivery evidence

> **Finalization status: COMPLETE (all gates green).** The full Phase 10
> `pnpm check` battery was re-run to completion at HEAD `b4a01d4` on 2026-10-30
> and is green in every stage: lint, format, typecheck (six packages), the full
> **627 tests / 0 fail / 62 files** suite, boundaries, and exports-parity 5/5.
> The gate red observed earlier at `2232300` was an unrelated host-load flake in
> `tests/checks/exports-parity.test.ts` ("a packed declaration that stops
> resolving fails the gate by name" exceeding its 5000 ms default timeout), not a
> product defect; it was cleared by giving that packed-resolution case an
> explicit 30 s timeout in `b4a01d4` (`test(GH-174)`), after which the aggregate
> gate went green. Targeted finalize re-verification (doc-distribution,
> changesets-group, `git diff --check`) passed before the finalize commit.

Authoritative artifacts: [spec](./chg-GH-174-spec.md) v1.1,
[test plan](./chg-GH-174-test-plan.md) v1.1 (25 TCs),
[plan](./chg-GH-174-plan.md) v1.1 (10 phases), DoR verdict
[readiness iteration 1 — NOT_READY](./readiness-review/readiness-iter-1.md)
and [readiness iteration 2 — READY](./readiness-review/readiness-iter-2.md).
Review artifacts: [review iteration 1](./review/review-iter-1.md) (FINDINGS),
[review iteration 2](./review/review-iter-2.md) (executor fix verification,
not an independent PASS).

Branch: `feat/GH-174/state-layer`, based on `main-tools` @ `d306c20`. The Phase 10
changeset and this evidence file are committed and pushed with the finalize
commit; no PR was created and no merge was performed.

## Phase commits

| Phase | Commit | Message |
|-------|--------|---------|
| 1 | `dbab409` | `feat(GH-174): record storage-engine TDR, state vocabulary, and synchronized state error rows` |
| 2 | `776c525` | `feat(GH-174): add driver-neutral state port with JSONL ledger truth and key-set reads` |
| 3 | `d8d7844` | `feat(GH-174): add sqlite derived index driver with both-kind conformance parity` |
| 4 | `c658cc9` | `feat(GH-174): detect and classify torn state with verified-empty evidence and bounded repair` |
| 5 | `0b79d06` | `feat(GH-174): enforce single-writer fences, staleness recovery, and crash-safe atomic replace` |
| 6 | `f71d19d` | `feat(GH-174): apply and enforce least-privilege state permissions with windows ACL contract` |
| 7 | `8e5c22e` | `feat(GH-174): register state feature docs with boundary and packing evidence` |
| 8/9 | `2232300` | `fix(GH-174): close state-layer review findings in index, integrity, and ACL checks` |
| — | `b4a01d4` | `test(GH-174): raise packed-resolution exports-parity case timeout for host-load resilience` (flake-resilience fix; clears the unrelated 5 s timeout so the aggregate gate is green) |
| 10 | finalize commit (`chore(GH-174): finalize state layer delivery with changeset and evidence`) | Phase 10 changeset, evidence, and plan status committed and pushed |

Every phase 1–9 was independently green at its commit boundary. `b4a01d4`
(flake-resilience fix) is the HEAD on which the full Phase 10 battery was measured
green, and the Phase 10 finalize commit carries only documentation and changeset
changes.

## Phase green criteria (observed)

| Phase | Commands | Result |
|-------|----------|--------|
| 1 | focused error-table/classification/sync suites; `error-table-sync`; `license-audit`; `vulnerability-gate`; `pnpm check` | 19 + 21 + 28 pass; sync `entries=20 documented=20`; `pnpm check` exit 0 (526 tests) |
| 2 | state ledger/keys/contract/scope/conformance suites; `ambient-globals`; `check:boundaries`; `pnpm check` | 6 ledger, 5 keys, 8 contract, 4 scope, 5 conformance pass; `pnpm check` exit 0 (555 tests) |
| 3 | `state-index` + conformance; `pnpm check` | 7 index tests pass; parity 2/2 `{jsonl, sqlite}`; `pnpm check` exit 0 (562 tests) |
| 4 | `state-torn` / `state-evidence` / conformance; `pnpm check` | 15 torn + 7 evidence pass; parity 2/2 with torn cases; `pnpm check` exit 0 (584 tests) |
| 5 | atomic-replace/fence/evidence/conformance; `pnpm check` | 8 replace + 8 fence pass; parity 2/2 over nine cases; `pnpm check` exit 0 (600 tests) |
| 6 | `state-permissions`; `pnpm check` | 7 permission tests pass (POSIX matrix exact bits; Windows branch platform-conditional); `pnpm check` exit 0 (607 tests) |
| 7 | state/imports/scope/packed/error-classification; repository checks; `pnpm check` | `pnpm check` exit 0 (623 tests/62 files); depcruise clean; error-table-sync, forbidden-literals, license, vulnerability, ci-topology green |

## Final gate consolidation (HEAD `b4a01d4`, measured 2026-10-30)

| Gate | Result |
|------|--------|
| `pnpm install --frozen-lockfile` | exit 0; lockfile up to date |
| `pnpm build` | exit 0; six packages built |
| Focused state suites (`state-*` + `packed-state`) | **99 pass / 0 fail**, 537 expectations, 14 files |
| `bun test` (all layers) | **627 pass / 0 fail**, 3723 expectations, 62 files |
| `pnpm check` (six stages) | **exit 0 — green.** Lint (✓), format (✓), typecheck (✓ six packages), tests (**627 pass / 0 fail / 62 files**, test-stage wall ≈ 258 s under load), boundaries (✓ depcruise 64 modules / 76 dependencies), exports-parity (✓ 5/5). The earlier 5000 ms `exports-parity` timeout is cleared by the explicit 30 s timeout in `b4a01d4` |
| `pnpm run check:boundaries` | exit 0; depcruise 64 modules / 76 dependencies, no violations; ambient-globals 15 files; workspace entrypoints clean |
| `bun run scripts/checks/exports-parity.ts` | exit 0; 5/5 publishables pass `attw --pack --profile esm-only` |
| `bun run scripts/checks/error-table-sync.ts` | exit 0; `entries=20 documented=20 S1=24 S3=14 corpus=13 ignored=39` |
| `bun run scripts/checks/forbidden-literals.ts` | exit 0; 5/5 scope classes, 0 violations; `feature-state-layer.md` registered |
| `bun run scripts/checks/ambient-globals.ts` | exit 0; 15 neutral-set files clean |
| `bun run scripts/checks/workspace-entrypoints.ts` | exit 0 |
| `bun run scripts/checks/license-audit.ts` | exit 0 |
| `bun run scripts/checks/vulnerability-gate.ts` | exit 0; 0 high/critical advisories |
| `bun run scripts/checks/ci-topology.ts` | exit 0; 7 bash jobs intact, 16 TS jobs present |
| `bun run scripts/checks/ci-bindingness.ts` | exit 0 |
| `bun run scripts/checks/ci-supply-chain.ts` | exit 0 |
| `bun run scripts/checks/changesets-group.ts` | exit 0; exactly one fixed group of five, testkit excluded |
| `bun run scripts/checks/pin-equality.ts` | exit 0 |
| `bun run scripts/checks/pnpm-foundation.ts` | exit 0 |
| `bun run scripts/checks/manifest-privacy.ts` | exit 0 |
| `bun run scripts/checks/script-surface.ts` | exit 0 |
| `bun run scripts/checks/testkit-exclusion.ts` | exit 0 |
| `bun run scripts/checks/tsconfig-strictness.ts` | exit 0 |
| `bun run scripts/checks/commitlint-authority.ts` | exit 0 |
| `bun run scripts/checks/ignore-rules.ts` | exit 0 |
| `bun run scripts/checks/exports-discipline.ts` | exit 0 |
| `bun run scripts/checks/boundary-ci-parity.ts` | exit 0 |
| `bun run scripts/checks/publish-guard.ts` | exit 1 **by design pre-freeze** (all five publishables still `private: true`); release-only gate, unchanged from `main-tools`, not part of the delivery battery |
| `bash scripts/.tests/test-*.sh` (all suites) | **19/19 pass** |
| `bash tools/.tests/test-*.sh` (CI-safe: e2e-providers/e2e-suite/performance excluded exactly as CI excludes them) | **3/3 pass** |
| `bash scripts/.tests/test-doc-distribution.sh` | exit 0; no drift — 80 in-scope docs; install set matches markers (re-run on the finalize content) |
| `bun run scripts/checks/changesets-group.ts` | exit 0; exactly one fixed group of five, testkit excluded, new state changeset consistent (re-run on the finalize content) |
| `git diff --check` / staged whitespace preflight | exit 0 (re-run on the finalize content) |
| `git diff --name-only origin/main-tools...HEAD` protected paths (`.ai/local/`, `tmp/`, `.opencode/`, `.ados-claude/`, `scripts/*.sh`, `tools/**`) | clean — no changes |
| Deleted tests / `pnpm-lock.yaml` | none deleted; lockfile unchanged |
| `git status --porcelain` | clean after the finalize commit; only the three finalize artifacts (changeset, plan, evidence) were staged |

No unrun gate is recorded as passing. Every gate above was observed green; the
earlier `exports-parity` timeout is recorded only as history, cleared in
`b4a01d4`.

## TC coverage

All 24 automated TCs are implemented and green; 25/25 are accounted for:

- Identity/levels/scope: TC-STATE-001, TC-STATE-003, TC-STATE-004, TC-STATE-023.
- Ledger/key-set: TC-STATE-005, TC-STATE-006, TC-STATE-009, TC-STATE-011.
- Index/parity: TC-STATE-002, TC-STATE-007, TC-STATE-021.
- Torn/repair/evidence: TC-STATE-008, TC-STATE-010, TC-STATE-024.
- Atomicity/fences: TC-STATE-012, TC-STATE-013, TC-STATE-014, TC-STATE-015.
- Permissions: TC-STATE-016, TC-STATE-017 (POSIX hard-gated; Windows branch platform-conditional).
- Failure identity: TC-STATE-018, TC-STATE-019, TC-STATE-020.
- Boundaries/scope: TC-STATE-022.
- TC-REVIEW-001 → **pending lifecycle `review_fix` (`@reviewer`)**. No independent
  review PASS is claimed (`review/review-iter-2.md` is an executor fix check).

## Phase 8 findings and Phase 9 fixes

| ID | Severity | Finding | Fix (regression) |
|----|----------|---------|------------------|
| F-1 | medium | Payload-only index divergence passed agreement and served forged index values | Agreement now compares `payload`; `state-index.test.ts` payload-divergence regression |
| F-2 | medium | `checkIntegrity()` bypassed the open-time fail-closed verdict | Returns the construction-time `failure` first; permission and level regressions in `state-permissions` / `state-contract` |
| F-3 | medium | Windows foreign-grant matcher's `\\\\` matched two backslashes, missing `BUILTIN\Users` | Extracted `hasForeignAclGrant()` with one-backslash expression; synthetic matcher regression on every platform |
| F-4 | low | `repairTornTail()` truncated before reading an unsupported store header | Header verdict precedes truncation; byte-equality regression in `state-torn` |
| F-5 | low | TDR-0004 recovery wording and feature-doc divergence bullet were stale | TDR §3/§4 amended; feature-doc bullet separates torn classes from rebuild/`state.write.failed` |
| F-6 | low (hygiene) | Four unused test imports | Removed; `biome lint` no longer reports state test files |
| F-7 | low (traceability) | Phase 7 boxes/Execution Log/Phase 6 commit cell stale | Plan reconciled (Phase 7 rows, `f71d19d`) |

## Rollback

The change is a fully additive substrate. Reverting the single delivery branch
(or the eventual PR) removes the contracts rows + `state` vocabulary, the
`core ./state` tier, tests/fixtures, docs/registry/changeset, and the TDR
together; there is no migration and no persisted operator data. Never revert
one side of the error-table sync (machine `ERROR_TABLE` rows and the documented
rows in `doc/spec/features/feature-result-contract.md` must move together), and
re-run the repository gates after any rollback. No bash-stack, `.opencode/**`,
`.ados-claude/**`, `scripts/*.sh`, or `tools/**` file is touched.

## Open items

1. **Windows ACL owner-environment run (spec OQ-2).** The POSIX matrix is
   hard-gated on Linux CI; the `win32` branch is executable but not verified on
   a Windows host. An owner-environment run is required before any
   public-release readiness claim. No Windows verification is claimed here.
2. **TDR-0004 remains Proposed.** The engine selections and runtime support
   matrix are presented for owner confirmation at PR review; no engineering
   acceptance is claimed by this evidence.

The Phase 10 finalization gate is cleared: `b4a01d4` rides the explicit 30 s
timeout for the packed-resolution exports-parity case, and the full `pnpm check`
battery is green at that HEAD. `publish-guard` remains a pre-freeze release gate,
expected red until the freeze configuration lands, and is not part of the
delivery battery.
