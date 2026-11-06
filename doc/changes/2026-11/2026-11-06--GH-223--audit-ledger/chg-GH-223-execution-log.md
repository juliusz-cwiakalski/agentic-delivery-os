# GH-223 delivery execution log

Plan: `chg-GH-223-plan.yaml` (delivery.plan.v1, rev 2). Spec: `chg-GH-223-spec.md` v1.4.
Test plan: `chg-GH-223-test-plan.md` (50 TCs).

All commands ran on branch `feat/GH-223/audit-ledger`. The workspace test
runtime is Bun; the aggregate gate is `pnpm check`.

## Phase 1 — audit vocabulary and boundary declaration

Commit: `5c8fb220` — `feat(GH-223): declare audit record vocabulary and artifact boundary`

- `bun test tests/structure/audit-contract.test.ts tests/structure/state-contract.test.ts tests/structure/content-inventory.test.ts tests/structure/port-contract-inventory.test.ts` — 40 pass, 0 fail.
- `pnpm typecheck` — all packages done.
- `git diff --check` — clean.

## Phase 2 — state-tier audit consumer, chain, key artifact, read surface

Commit: `dcb478a5` — `feat(GH-223): land audit consumer with two-phase append, chain, and key artifact`

- `bun test` over the 17 P2 audit behaviour suites + `audit-contract`, `audit-imports`, `audit-surface`, `state-contract`, `state-imports`, `state-scope` — 115 pass, 0 fail.
- `bun run scripts/checks/error-table-sync.ts` — 0 drift (`entries=52 documented=52`).
- `bun test tests/behaviour/state-torn.test.ts tests/behaviour/state-salvage.test.ts` — 30 pass, 0 fail (GH-222 regression green).
- `pnpm typecheck` — all packages done.
- `git diff --check` — clean.

## Phase 3 — CLI audit capture and agent identity

Commit: `d244ba40` — `feat(GH-223): audit every CLI invocation and capture claimed agent identity`

- `bun test` over `audit-outcomes`, `audit-identity`, `audit-timestamp`, `audit-write-failure`, `audit-ordinal-gap`, `audit-reservation-orphan`, `audit-reservation-failure`, `audit-redaction`, `cli-edge-seam` — 46 pass, 0 fail.
- `bun test tests/behaviour/audit-ledger.test.ts` (runCli halves) — 9 pass, 0 fail.
- `bun run scripts/checks/error-table-sync.ts` — 0 drift.
- `pnpm typecheck` — all packages done.
- `git diff --check` — clean.

## Phase 4 — scripted trim, conformance validator, goldens

Commit: `fadfa368` — `feat(GH-223): activate scripted-mode trim with both-mode conformance and goldens`

- `bun test tests/golden` — 103 pass, 0 fail (both modes, no skipped case).
- `bun test` over `scripted-trim`, `envelope-mode`, `envelope-scripted`, `audit-scenario-m1-23`, `scripted-projection`, `result-contract`, `result-fixtures`, `content-inventory` — 57 pass, 0 fail.
- `pnpm typecheck` — all packages done (after fixing the `CommandResult` union narrowing in the scripted renderer).
- `git diff --check` — clean.

## Phase 5 — invariant sweep and cross-tier guards

Commit: `c83aa0a6` — `test(GH-223): complete invariant sweep and cross-tier contract guards`

- `bun test tests/structure tests/boundaries tests/checks` — 943 pass, 5 fail at first run:
  - 4 failures were the privacy-literals gate (a test-plan prose token `user/home/host`
    tripped the absolute-user-path rule) plus the two wiring tests that shell the
    privacy command. The test-plan wording was corrected to `user, home, host, and
    session` (no contract change); `pnpm check:privacy-literals` then reported
    0 violations.
  - 1 failure was `state-ledger.test.ts` pinning the exact public port surface; the
    additive `readStoreArtifact`/`ensureStoreArtifact` capability was added to the
    expected surface.
  - `privacy-release.test.ts` needed the Phase 6 changeset and a base refresh;
    `ci-baseline-parity.test.ts` uses `git clone --local` into the OS temp dir and
    fails cross-device here, passing with `TMPDIR=<repo>/tmp/tmpdir`. Both are green
    in the Phase 6 aggregate run.
- `bun test tests/behaviour` — 1694 pass, 4 skipped, 1 fail (`state-ledger` port
  surface, fixed as above); re-run of the touched file is green.
- `bun run scripts/checks/error-table-sync.ts` — 0 drift.
- `bun run scripts/checks/exit-code-literals.ts` — no call-site exit literals outside
  the projection module.
- `git diff --check` — clean.

## Phase 6 — finalize

Commit: `2dc30291` — `chore(GH-223): finalize delivery evidence and changeset`
Merge: `aa4ca9ee` — `Merge branch 'main-tools' into feat/GH-223/audit-ledger`
(the branch was cut from `c6699302`; the base had advanced to `47270b37`, so the
base was merged before the aggregate gate to keep the release-diff checks honest).

- `pnpm check` (with `TMPDIR=<repo>/tmp/tmpdir`) — **exit 0**: lint, format,
  typecheck, 3276 tests passing / 4 skipped / 0 failing across 326 files,
  boundaries (`no dependency violations`), ambient-globals, workspace-entrypoints,
  secret-read-boundary, and exports parity all green.
- `bash scripts/.tests/test-doc-distribution.sh` — no drift (81 in-scope docs).
- `bun run scripts/checks/changesets-group.ts` — exactly one fixed group of five;
  testkit excluded.
- `bun test tests/checks/privacy-release.test.ts` — 7 pass, 0 fail (after the
  base merge restored the two pre-existing changesets).

There is no executable `plan validate` entrypoint in this checkout (the `plan`
command ships as an injected in-process runtime); the plan YAML was kept
untouched and schema-shaped, and the DoR gate validated it before delivery.


## Deviations from the plan

1. **`schemaId` payload marker.** Both audit payloads carry the self-describing
   `schemaId` required by the reusable artifact boundary (the closeout precedent).
   The audited invocation field set remains the specified 13 fields and the
   reservation payload remains `{auditSeq, runId, chainValue}`; `schemaId` is the
   structural declaration marker, not a fourteenth audited field. Tests assert the
   audited sets exactly and permit the marker explicitly.
2. **Store artifact capability shape.** Task 2.1's additive facade capability is
   `readStoreArtifact` / `ensureStoreArtifact` on `StateStorePort`, implemented in
   the facade, with one new runtime-edge hook (`randomHex`) in
   `driver/runtime-edge.ts`; no schema bump, no driver discriminant, and no runtime
   API outside the driver edge.
3. **Inventory bookkeeping.** `tests/structure/inventory.json` had to gain
   `core/src/contracts/audit.ts` and `core/src/state/audit.ts`; the plan declared
   `content-inventory.test.ts` but not the inventory data file. This is a required
   invariant-test companion, not a scope expansion.
4. **Public port surface pin.** `tests/behaviour/state-ledger.test.ts` (not named in
   the plan) pins the exact port member list; the two additive methods were added to
   its expected surface.
5. **Test-plan hygiene fix.** One prose token in the test plan tripped the
   privacy-literals absolute-user-path rule; the wording was corrected without any
   contract change.
6. **Mode fact default.** `CliDependencies.mode` defaults to `interactive` so the
   historical M0-S3 goldens remain byte-identical; scripted mode is injected at the
   edge and exercised by the new suites.
7. **CI baseline parity locally** requires `TMPDIR` inside the repository because
   `git clone --local` hardlinks across devices; the aggregate gate is run with
   `TMPDIR=<repo>/tmp/tmpdir`.
8. **Base refresh before the final gate.** The branch was cut from `c6699302`
   while `main-tools` had advanced to `47270b37` (GH-228/GH-229). A merge was
   required for the release-diff invariant (pre-existing changesets byte-identical)
   to hold; the four textual conflicts (`contracts/index.ts`, port inventory,
   golden redaction suite, source inventory) were resolved by keeping both sides
   and regenerating the two inventories from the live tree.
