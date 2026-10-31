# Delivery Evidence — GH-175 (M0-S6 status v1)

This record contains only executed evidence. Unrun checks are marked as such.

## Phase commits

| Phase | Commit | Completion signal |
|---|---|---|
| 1 | `d65a7e5a5` | `feat(GH-175): add status digest contracts with pure aggregator and renderer` |
| 2 | `32c843f4b` | `feat(GH-175): add bounded GitHub collection reads with trap coverage` |
| 3 | `3aa9b1ba7` | `feat(GH-175): add origin repository binding and local PM-context read` |
| 4 | `978d7b311` | `feat(GH-175): add status command with runtime composition and human digest hook` |
| 5 | `807223255` | `test(GH-175): prove collector truthfulness, negative controls, and read-only determinism` |
| 6 | `aa6a6d1e9` | `docs(GH-175): record status changeset and delivery evidence with final battery` |

Phase 7 is the `@doc-syncer` handoff and was not executed by `@coder`.

Commit-message reword note: three commits were reworded message-only to satisfy
commitlint's 100-character body rule; every tree is byte-identical. The phase
SHAs above and elsewhere in this record are the post-reword SHAs. Full old→new
map: `234a766`→`0e06be96d`, `3cb79f6`→`d3412e014`, `7d4389a`→`c89bb05af`,
`d56401c`→`d65a7e5a5`, `d5c2d71`→`32c843f4b`, `58290d0`→`3aa9b1ba7`,
`a5bce0d`→`978d7b311`, `9c64fba`→`807223255`, `a77dde7`→`aa6a6d1e9`,
`9053aa2`→`3057d184b`, `94166ea`→`4298bf8bc`, `1df7659`→`7b6679899`,
`7688690`→`47fe1563f`. `commitlint --from origin/main-tools --to HEAD` exits 0.

## Gate consolidation

Focused gates run per phase:

- Phase 1: `bun test` on the six named suites (70 pass); `ambient-globals`,
  `workspace-entrypoints`, `forbidden-literals`, `exit-code-literals` exit 0.
- Phase 2: `bun test` on the seven named suites (43 pass); three invariant
  checks exit 0; `pnpm typecheck` (workspace + `tests/types`) green.
- Phase 3: `bun test` on the six named suites (81 pass); three invariant checks
  exit 0; `secret-read-boundary` and `privacy-literals` green.
- Phase 4: `bun test` on the named suites (100 pass); four invariant checks exit
  0; `pnpm check` green except the pre-existing `TC-RELEASE-001` GH-184
  changeset invariant.
- Phase 5: status suites (70 pass); `bun test tests/structure tests/checks
  tests/boundaries` (688 pass, same single pre-existing failure); five invariant
  checks exit 0; `git diff --check` clean.
- Phase 6: `pnpm check` ran 1579 tests: 1576 pass, 1 fail (the pre-existing
  `TC-RELEASE-001` GH-184 changeset invariant), 2 skipped (opt-in live smoke).
  `bun test` on the corpus/golden/performance/live suites: 15 pass, 2 skip,
  0 fail. Five invariant checks exit 0; `bash scripts/.tests/test-doc-
  distribution.sh` exit 0; `git diff --check` clean.

The `TC-RELEASE-001` failure is pre-existing and unrelated: it hardcodes
`origin/main-tools` and the GH-184 changeset, which is already present in that
base. It cannot pass on this branch without editing an unrelated test; it is
reported, not silenced.

## TC / AC / NFR coverage

All 33 TCs are implemented at their pinned locations. All 24 ACs and all 10
NFRs are covered by the committed suites; no AC or NFR is deferred.

- TC-STATUS-001/002/005/006/007 — `status-command.test.ts`, `status-output.test.ts`
- TC-STATUS-003/004/008 — `status-section-states.test.ts`, `status-contract.test.ts`
- TC-STATUS-009..015 — `status-tracker.test.ts`, `status-changes-ci.test.ts`
- TC-STATUS-016..019 — `status-providers-parked.test.ts`
- TC-STATUS-020/021 — `status-repository.test.ts`, `github-collection.test.ts`, `status-command.test.ts`
- TC-STATUS-022 — `trap-catalog.test.ts`, `provider-surface.test.ts`, `port-contract-inventory.test.ts`, `github-trap.test.ts`
- TC-STATUS-023/024/025 — `status-negative-controls.test.ts`, `status-readonly-determinism.test.ts`
- TC-STATUS-026/027/028/029 — `status-imports.test.ts`, `cli-edge-seam.test.ts`, `secret-read-boundary.test.ts`, `forbidden-literals.test.ts`, `error-table-sync.test.ts`
- TC-STATUS-030/031/032/033 — `status-corpus.test.ts`, `status-digest.test.ts`, `status-live.test.ts` (opt-in), `status-performance.test.ts`

## OQ-T8 measurement environment

- Runtime: Bun 1.4.4 (recorded by `status-performance.test.ts`).
- Platform: linux/x64.
- Method: warm-up once, median of five pure `aggregateStatus` runs over
  cap-sized facts. The measured median is printed by the suite.
- The 50 ms spec bound is not relaxed; the test fails if the median exceeds it.

## Rollback

The change is fully additive. A single revert of this PR removes the status
contracts/domain/command/adapters/tests/fixtures/changeset/evidence together. No
data cleanup is required: status writes nothing. Never revert one side of a
documented-table or inventory change without the other.

## Owner-facing notes

- The provider-config identity pin is `failureCode: "config.value.invalid"` +
  reason `provider-chain-unresolved` + no `failureClass` for a chain/config
  validation failure; a resolution failure is `config-invalid` + the relevant
  `config.*` code.
- The check-runs read is one bounded page at `per_page=20`; the raw page size
  drives `source-truncated`, while at most eight runs are rendered.
- The human digest is brand-derived and deterministic; the machine digest is the
  full `delivery.status.v1` structure within the 64 KiB `data` bound.
- A formatter override scoped to `tests/fixtures/status/golden/**` keeps the
  committed golden digest byte-identical to the runtime output. It mirrors the
  existing envelope-golden override and changes no product behavior.
- One mechanical privacy correction was applied to the test plan: the
  credential-shaped example URL was replaced with an equivalent userinfo
  description so the live privacy guard stays green. No TC, AC, bound, state,
  reason, or assertion changed.
