# GH-176 — Delivery evidence (M0-S7 `queue ready`, read-only)

Status: Phases 1–7 delivered on `feat/GH-176/queue-ready` (Phase 7 doc
reconciliation at `be722b2`). Review iteration-1 remediation R2.1–R2.7 is
recorded in the plan's "Remediation Iteration 2" section; review iteration-2
remediation R3.1–R3.6 is recorded below. No push, no PR, no merge.

Baseline: DoR iteration-6 READY (`f664b53`). Implementation plan v1.7
(review remediation iterations 2–3), spec v1.8, test plan v1.8.

## Phase commits

| Phase | Commit | Subject |
|---|---|---|
| 1 | `68f88ea` | `feat(GH-176): add queue-ready contract with pure evaluator and renderer` |
| 2 | `67c9d36` | `feat(GH-176): add queue ready command with grammar and status-read composition` |
| 3 | `352cacc` | `test(GH-176): prove readiness conditions and work-item identity resolution` |
| 4 | `296f285` | `test(GH-176): prove provider availability, close classification, and ranking` |
| 5 | `b8943af` | `test(GH-176): prove output bounds, provider caps, negative controls, and read-only determinism` |
| 6 | this commit | `docs(GH-176): record queue-ready changeset and delivery evidence with final battery` |
| 7 | `be722b2` | `docs(GH-176): add queue-ready spec and reconcile current-truth docs` |

## Delivered production surface

New: `packages/core/src/contracts/queue-ready.ts`,
`packages/core/src/domain/queue-ready.ts`,
`packages/core/src/domain/ci-result.ts`,
`packages/cli/src/commands/queue.ts`.

Modified: `contracts/index.ts`, `domain/index.ts`, `domain/status.ts`
(shared classifier import only), `core/src/index.ts`,
`cli/src/commands/status.ts` (`collectStatusFacts` extraction with the two
independent gates), `cli/src/commands/index.ts`, `cli/src/edge.ts`.

No new package, subpath, runtime-API location, adapter read, error-table row,
configuration key, state-schema change, or secret-read allowlist entry.

## TC coverage (38/38)

| TC | Phase | Suite | Status |
|---|---|---|---|
| 001, 002, 032, 033 | 2 | `queue-ready-command.test.ts` | PASS |
| 003, 004 | 1 | `queue-ready-conditions.test.ts` | PASS |
| 005 | 3 | `queue-ready-deps.test.ts` | PASS |
| 006, 007, 008 | 3 | `queue-ready-repo-tier-owner.test.ts` | PASS |
| 009, 010 | 3 | `queue-ready-ci.test.ts` | PASS |
| 011, 012 | 4 | `queue-ready-provider.test.ts` | PASS |
| 013, 014, 015, 016 | 4 | `queue-ready-close.test.ts` | PASS |
| 017 | 4 | `queue-ready-ranking.test.ts` | PASS |
| 018, 019, 020, 034, 035, 038 | 5 | `queue-ready-output.test.ts` | PASS |
| 021 | 5 | `queue-ready-negative-controls.test.ts` | PASS |
| 022, 023 | 5 | `queue-ready-readonly-determinism.test.ts` | PASS |
| 024 | 1 | `tests/structure/queue-ready-contract.test.ts` | PASS |
| 025, 026 | 1/2/5 | `tests/structure/queue-ready-imports.test.ts`, `cli-edge-seam`, `subpaths`, `content-inventory`, `secret-read-boundary`, `forbidden-literals` | PASS |
| 027 | 5 | `error-table`, `error-table-sync` (unchanged, green) | PASS |
| 028 | 6 | `queue-ready-corpus.test.ts` | PASS |
| 029 | 6 | `tests/golden/queue-ready.test.ts` | PASS |
| 030 | 6 | `queue-ready-performance.test.ts` | PASS |
| 031 | 6 | `queue-ready-live.test.ts` | SKIP by default (opt-in exactly `1` + credential) |
| 036, 037 | 3/6 | `queue-ready-identity.test.ts`, corpus | PASS |

37 TCs are green by default; TC-QREADY-031 is opt-in and was skipped in this
environment (no `ADOS_QUEUE_READY_LIVE=1` run and no credential supplied). It is
never counted as green in the default run.

## Gate consolidation

Focused queue-ready/golden suites (18 files):

- Phase 1: 82 pass / 0 fail.
- Phase 2: 95 pass / 0 fail (status suites included).
- Phase 3: 36 pass / 0 fail.
- Phase 4: 35 pass / 0 fail.
- Phase 5: 164 pass / 0 fail (`tests/structure tests/checks tests/boundaries`
  included in the battery).
- Phase 6: 165 pass / 1 skip / 0 fail (all queue-ready + golden; live skipped).

Full battery on the delivery HEAD (before this evidence commit):

- `pnpm install --frozen-lockfile` — OK.
- `pnpm check` — **1778 pass / 3 skip / 0 fail**; lint, format, typecheck,
  tests, boundaries, and exports parity all green.
- `bun run scripts/checks/{error-table-sync,forbidden-literals,ambient-globals,exit-code-literals,workspace-entrypoints}.ts` — all OK.
- `bash scripts/.tests/test-doc-distribution.sh` — OK (81 in-scope docs, no drift).
- `git diff --check` — clean.
- Focused logs: `.ai/local/gh-176-phase{1..6}-*.log` (never staged).

Measured bounds: the evaluator-produced canonical golden payload serializes to
9 920 bytes (≤65 536); the derived human digest has 6 lines (≤16) and is 609
bytes (≤4 096). The pure evaluator at cap size measured a median of ~0.29 ms
(≤50 ms; Bun 1.4.4, linux/x64).

## Review iteration-1 remediation (R2.1–R2.7)

Review `code-review/review-iter-1.yaml` returned FAIL (0 blocker / 2 major /
3 minor / 3 info). F-1..F-6 are fixed and covered by the suites; F-7 is the
retained defensive evidence-cap branch; F-8 is spec-only/PM-owned and was not
edited by `@coder`.

Final remediation battery on `89cdfc6` (clean tree; logs under
`.ai/local/r2.7-*.log`, never staged):

- `pnpm install --frozen-lockfile` — OK.
- Focused suites (output/corpus/ranking/ci/golden) — 63 pass / 0 fail.
- `bun test` — 1786 pass / 3 skip / 0 fail.
- `pnpm check` — 1786 pass / 3 skip / 0 fail.
- Five invariant checks — all OK: `error-table-sync` (31/31), `forbidden-literals`
  (5/5 scope classes, 0 violations), `ambient-globals` (40 neutral-set files),
  `exit-code-literals` (101 files), `workspace-entrypoints`.
- `bash scripts/.tests/test-doc-distribution.sh` — no drift (81 in-scope docs).
- `git diff --check` clean; `git status --porcelain` clean; no push. TC-QREADY-031
  remains opt-in and skipped without the live switch and credential.

Non-ASCII bound margins: the CJK cap fixture's raw projected content measured
31 265 UTF-16 code units / 90 785 UTF-8 bytes before reduction and 29 919
code units / 65 439 bytes after (128 → 28 relations), with `value-clamped` and
no verdict change. The doc sync is confirmed at `be722b2`.

## Review iteration-2 remediation (R3.1–R3.6)

`code-review/review-iter-2.yaml` returned FAIL (0 blocker / 1 major / 3 minor /
1 info; F-9..F-13). F-1, F-3, F-4, F-5, F-6, and F-8 stay closed; F-7 remains
accepted with no action.

| Task | Finding | Commit | Outcome |
|---|---|---|---|
| R3.1 | F-9 (major) | `b8292a6` | Byte-aware total renderer: `QUEUE_READY_MAX_HUMAN_SEGMENT_BYTES` (32), owner/name 128 and branch 256 UTF-8 bytes, ≤400-byte candidate lines, reverse-rank line drop marked `+more`; astral-8 and over-budget fixtures. |
| R3.2 | F-10 (minor) | `0f0000f` | Evaluator-produced canonical golden, separate unknown-close evaluator payload, DM-1/DM-2 validator and 8 corrupted-twins. |
| R3.3 | F-11 (minor) | `02207ce` | Rank/index sentinels and an exact survivor oracle for relations-before-labels, last-ranked-first, highest-index-first, stop-at-first-fit; three mutations fail by name. |
| R3.4 | F-12 (minor) | `e83baf6` | `classifyPipelineRuns` removed from both barrels; `ci-result.ts` and the direct imports still own it; public queue-ready additions pinned to the two functions. |
| R3.5 | F-13 (info) | `ca53a68` | Baseline moved to plan v1.7 / spec v1.8 / test plan v1.8; this remediation record added; stale version text removed. |
| R3.6 | closing battery | `0eb97da` | Focused core 66 pass; focused queue-ready 177 pass / 1 skip; `bun test` and `pnpm check` 2065 pass / 3 skip / 0 fail; five invariant checks and doc-distribution green; `git diff --check` clean; tree clean at `ca53a68`. |

Final remediation battery on `ca53a68` (logs under
`.ai/local/gh-176-r3.6-*.log`, never staged):

- Focused core suites (output/corpus/golden/contract) — 66 pass / 0 fail.
- Focused queue-ready suites (17 files) — 177 pass / 1 skip / 0 fail.
- `bun test` — 2065 pass / 3 skip / 0 fail (182 files, 20 007 `expect()` calls).
- `pnpm check` — 2065 pass / 3 skip / 0 fail; lint, format, typecheck, tests,
  boundaries, and exports parity green.
- Five invariant checks — `error-table-sync` 35/35, `forbidden-literals`
  (18 user-facing docs, 0 violations), `ambient-globals` 42 neutral-set files,
  `exit-code-literals` 104 files, `workspace-entrypoints`.
- `bash scripts/.tests/test-doc-distribution.sh` — no drift (81 in-scope docs).
- `git diff --check` clean; `git status --porcelain` clean before this evidence
  update; no push, no amend.

Measured human maxima: the astral-8 worst case renders 2 891 UTF-8 bytes over
10 lines (payload 22 108 bytes, header plus summary 603 bytes, maximum
candidate line 283 bytes, maximum provider segment 29 bytes) with exit 0 and no
`value-clamped`. The synthetic over-budget brand renders 3 989 bytes over 5
lines: 3 highest-ranked candidates survive and 5 trailing lines drop in reverse
rank order, with the payload unchanged (`truncated:false`, `reasons:[]`).
The CJK byte-budget payload reduces to 65 376 bytes with `value-clamped`:
ranks 8→3 lose all 16 relations, rank 2 loses 5, rank 1 and every label survive.

The R3 doc-sync handoff is complete at `58319b1` (R2 doc-sync `b8809d6`); no "pending doc-syncer re-run"
state remains in this evidence.

## Delivery-bound resolutions (RES-1..RES-8)

- RES-1: unobserved/unattempted tracker evidence is exactly one
  `{source:"tracker", reason:"work-item-unobserved"}` record, evaluated before
  signal availability; no synthetic tracker `read-failed`.
- RES-2: `deps-satisfied` carries exactly one record; target-derived detail is
  `done:<n>; open:<n>; unknown:<n>` summing to the total `blocked-by` target
  count, with no target refs.
- RES-3: no live-switch constant exists under `packages/**`; the literal is
  bound only by `tests/fixtures/queue-ready/harness.ts` and gates on exactly
  `"1"`.
- RES-4: parser bound is 33 positionals; 32 refs reach the handler and are
  rejected as `input.value.rejected`; 33 refs are rejected by the parser as
  `fallback.invocation`.
- RES-5: provider evidence is exactly the case record then
  `{source:"provider-config", reason:"engine-not-run"}`; configuration precedes
  the park fold; park failures stay `provider-parks`/`state-unreadable`.
- RES-6: candidate observation is candidate-set-scoped; `blocked-by` targets
  are observed-work-item-set-scoped; exact case-insensitive full-value match
  first, unique all-ASCII-digit suffix bridge second; no coercion; full values
  before projection.
- RES-7: nine provider-derived projection caps plus the 32-UTF-8-byte human
  segment are output-only; every projected identity is `entityId`-only with no
  `systemName`; one `value-clamped` in group 2; deterministic
  relation-then-label byte-budget reduction.
- RES-8: provider config failures are mapped by the read's own `reason`
  (`config-invalid` vs `provider-chain-unresolved`), never blanket
  `!config.ok`; failure details use the pinned `failureCode`/`failureClass`
  form.

## Deviations and notes

1. **Changeset landed in Phase 2 (planned for Phase 6).** The permanent release
   invariant (`tests/checks/privacy-release.test.ts`) requires exactly one
   changeset as soon as a publishable path changes, so it could not stay green
   at the Phase 2–5 gates otherwise. `.changeset/queue-ready-minor.md` lists the
   five lockstep packages as `minor`; no versions were hand-bumped. Phase 6.5
   therefore reduces to evidence authoring.
2. **Malformed PM-context fixture is `malformed.yaml.txt`.** Biome parses
   `.yaml` fixtures and rejects intentionally invalid YAML; the repository
   already uses `*.yaml.txt` for unparseable fixtures. The adapter read path is
   extension-agnostic; the test asserts `local-context-malformed`.
3. **Synthetic evidence-cap and byte-budget cases.** The delivered cap set
   cannot produce a third evidence record (the deps condition is single-record;
   only `provider-available` reaches two) nor a payload above 65 536 bytes, so
   those branches are implemented defensively. Tests assert the contract bounds
   and renderer `+more` behaviour; they do not claim the evaluator reached those
   branches from legal input.
4. **Provider fixtures are committed JSON snapshots** interpreted into injected
   verified park views; the state harness guards the read-only park-fold read.
   No park bytes are written.
5. **Corpus is a typed case table** (`tests/fixtures/queue-ready/corpus/cases.ts`)
   plus the committed `corpus/source-failures-degraded/case.json`, which the test
   plan explicitly permits ("a committed `case.json` or a typed case in
   `cases.ts`"). The meta-check covers every condition state, close class, named
   source failure, identity row, cap row, and Appendix G example.
6. **Golden is evaluator-produced and DM-1/DM-2 valid.** Review iteration-2
   F-10 corrected the earlier hand-built fixture: `canonicalPayload()` is now
   `evaluateQueueReady(canonicalFacts())` and carries `merge-ready`,
   `review-pending`, `new-start`, and `not-ready` with one clamped provider ref
   (`value-clamped`). `new-start` and `unknown` close classes cannot coexist in
   one read-scoped payload, so `canonicalUnknownCloseFacts()` is a second
   evaluator-produced fact set whose failed pulls read yields `unknown` for
   every observed, ready candidate and `pr-association-unknown` last in
   `reasons`. The golden test validates both payloads against DM-1/DM-2 and
   rejects eight corrupted twins; the human golden is rendered from the same
   canonical payload.
7. **`collectStatusFacts` extraction is behaviour-preserving.** The two
   independent gates are preserved (issues/pulls on binding observed; check-runs
   additionally on a resolved HEAD SHA); the status suites and golden digest are
   green. `not-ready-ci-unresolved` (`S S S S ? S`) is reachable.

## Pre-existing failures

None observed. Every default `pnpm check` run in Phases 1–6 was green on the
delivery HEAD.

## Rollback

The change is fully additive. Revert the phase commits (or the single PR) to
remove contracts/domain/command/tests/fixtures/goldens/changeset/evidence
together. `queue ready` wrote nothing, so no data cleanup is required. Do not
revert one side of an inventory or documented-table change without the other.

## Phase 7 completion (`be722b2`)

`@doc-syncer` completed the documentation/spec reconciliation in `be722b2`:
authored and registered `doc/spec/features/feature-queue-ready.md`; reconciled
`feature-status-digest.md`, `feature-provider-engine.md`, `feature-state-layer.md`,
`feature-config-layer.md`, `feature-result-contract.md`,
`feature-monorepo-scaffold-toolchain.md`,
`doc/planning/oss-tooling/cli-command-registry.md`, `doc/overview/glossary.md`,
and `doc/00-index.md`; and added the feature doc to the forbidden-literals
`registered` list with the allowlist unchanged at five entries.
`bun run scripts/checks/forbidden-literals.ts`,
`bun run scripts/checks/error-table-sync.ts`, and
`bash scripts/.tests/test-doc-distribution.sh` are green on that commit.
