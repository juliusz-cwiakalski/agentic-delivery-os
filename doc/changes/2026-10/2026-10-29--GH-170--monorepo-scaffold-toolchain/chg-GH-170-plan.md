---
id: chg-GH-170-monorepo-scaffold-toolchain
status: Updated
created: 2026-10-29T00:00:00Z
last_updated: 2026-10-29T20:00:00Z
owners: ["Juliusz Ćwiąkalski"]
service: delivery-os
labels: ["oss-tooling", "monorepo", "m0", "toolchain", "adr-0003"]
links:
  change_spec: ./chg-GH-170-spec.md
  test_plan: ./chg-GH-170-test-plan.md
  adr: ../../../decisions/ADR-0003-oss-monorepo-structure.md
summary: >
  Stand up the six-package pnpm-workspace monorepo under packages/ with its full CI-verified
  toolchain — pinned pnpm + four-copy Bun pin, strict ESM TypeScript, Biome, commitlint + husky,
  changesets fixed group, dist-targeted exports with publint/attw, dependency-cruiser boundary
  enforcement of the ADR-0003 DEC-2 matrices with a failing negative fixture per forbidden rule,
  publish guard, license-registry seed with fail-closed audit, and additive binding TypeScript CI
  jobs beside the untouched bash stack. Structure over content: empty-but-enforced.
version_impact: minor
---

# IMPLEMENTATION PLAN — GH-170: M0-S1: Six-package monorepo scaffold and toolchain (ADR-0003)

## Context and Goals

This plan executes [chg-GH-170-spec.md](./chg-GH-170-spec.md) (v1.1) and is verified by [chg-GH-170-test-plan.md](./chg-GH-170-test-plan.md) (v1.3, 38 TCs). All scaffold-step decisions are resolved in spec §15.1 (DEC-1..DEC-11); none are re-opened here. The plan binds file paths, script names, CI job names, and task order — behavior targets come from the test plan and must not change (A-T1).

**Goals**: G-1 six-package enforced substrate · G-2 mechanical DEC-2 boundaries with per-rule failing fixtures · G-3 pinned CI-verified toolchain · G-4 safe publish path before any artifact · G-5 additive coexistence with the untouched bash stack.

**Recorded plan-stage note (spec §7.3, NG-8, Appendix A)**: cliffy (`@jsr/cliffy__command`) is the intended CLI argument framework for the **first later CLI-surface story**, governed at adoption by the ADR DEC-2 framework-confinement rule (framework confined to the `cli` package). It is **NOT a scaffold dependency** — it must not appear in any manifest; the content-inventory check (TC-SCAFFOLD-006) rejects CLI command registration at scaffold.

**Open questions carried in**: none from the spec (OQ-1 resolved → DEC-10). Test-plan OQ-T4 (commitlint on `push` events) is **resolved by this plan**: on `push`, commitlint runs over the merge-base range `origin/main-tools...HEAD`; on `pull_request`, against both the PR base and the delivery-branch base (task 5.3, job `ts-commitlint`). OQ-T3 (fast-loop duration) stays open per test plan: TC-SCAFFOLD-022 records duration and **reports** >10 min to the PM rather than failing.

**Pin policy (A-T6)**: exact versions are NOT invented in this plan. Phase 0 resolves them — exact pnpm version for `packageManager`, most recent stable Bun for the four pin copies (marksync `1.2.23` is the proven reference floor, not the pin; RSK-5 fallback: if newest stable misbehaves, pin the newest proven stable and record why) — and records them in the execution report. All TCs assert equality/shape, never a literal version.

## Scope

### In Scope

- F-1 six packages with all subpaths, placeholder content, one `createRuntime` signature; F-2 workspace foundation (pinned pnpm, one lockfile, isolation verification); F-3 four-copy Bun pin; F-4 strict ESM TS (tsc per DEC-1); F-5 imports-alias tiering (ADR tier names); F-6 dependency-cruiser boundary enforcement; F-7 negative fixtures per forbidden rule; F-8 Biome + commitlint + husky; F-9 five named checks + one aggregate; F-10 dist exports + publint/attw (DEC-11); F-11 publish guard; F-12 changesets fixed group; F-13 additive binding CI incl. vulnerability gate (C-10); F-14 ignore rules; DEC-10 license-registry seed + minimal fail-closed audit.
- All 38 TCs of the test plan, in the runner split it defines: `bun test` (structure/boundaries/behaviour/checks-mutation), `bun run scripts/checks/*.ts` (repository invariants), existing bash suites run-only.

### Out of Scope

- Spec §7.2 in full: branding values/rename drill (M0-S2), result contract (M0-S3), config layer (M0-S4), state drivers (M0-S5 — `node:sqlite` choice recorded in spec DEC-3 only), any engine/provider/MCP implementation, publication, cloud, cliffy wiring, any change to `.opencode/`, `.ados-claude/`, existing bash jobs/gates, installer registration. **PR creation is a separate later phase** — no task here creates the PR.

### Constraints

- **History**: the branch's FIRST commit `22aadb6` (owner-ordered docs wiring) must remain first — never rebase, amend, or reorder existing commits; all new work stacks on top.
- **Untouchable files**: the M0 `Ticket:` lines in `doc/planning/oss-tooling/backlog.md` and `doc/planning/oss-tooling/backlog-ranking.md` must NOT be modified by any task; existing bash job blocks in `.github/workflows/ci.yml` (`verify-claude-build`, `doc-distribution-guard`, `inception-doc-consistency`, `result-tuple-guard`, `mutation-sandbox`, `bash-tests`, `shellcheck`) are byte-untouched — additions only (RSK-2); `scripts/*.sh`, `tools/**`, `.opencode/**`, `.ados-claude/**` unchanged.
- **Provenance (DEC-9)**: any source file with code adapted/copied from `marksync-for-confluence` carries a comment noting the source path and its MIT license. Never copy marksync branding or Confluence domain logic. No ADOS license-header script runs on `packages/**` (header-managed paths don't include it).
- **Naming firewall (C-3/DEC-6)**: neutral `@delivery-os/*` scope; no product literals (`ados`, `ADOS_`, …) in any new file; the ignore glob for project-local config is brand-free.
- **Gates are binding**: no `continue-on-error`, no `|| true`, no `if: always()` on gate steps; failure output names the violated rule.
- **No license headers** on `doc/changes/**` artifacts (repo rule).

### Risks

- **RSK-1** (pnpm/Bun unavailable): task 0.1 verifies availability and installs from pins as the FIRST delivery step; result recorded.
- **RSK-2** (CI coexistence): additive jobs only; tasks 8.5/9.2 prove bash byte-equality and green suites (TC-SCAFFOLD-023/025).
- **RSK-3** (hook breaks agent commits): hook is warn-only, offline, non-mutating (tasks 5.2/5.4, TC-SCAFFOLD-027); CI commitlint is the authority.
- **RSK-4** (pnpm isolation assumption): task 0.6 verifies and RECORDS the result either way; boundary rules do not depend on it.
- **RSK-5** (defective newest Bun): pin-resolution fallback recorded in task 0.1.
- **RSK-6** (local/CI drift): exact pins + frozen-lockfile installs + pin-equality check (task 8.2).
- **RSK-T1..T8** (test plan): mitigated by the harness contract (task 4.4), temp-dir-only mutations, duration recording (9.1), and CI as authority for e2e TCs.

### Success Metrics

Spec §4.1 table, verified by: fresh-clone aggregate green 0 manual steps (TC-SCAFFOLD-001/022); 0 boundary violations (TC-SCAFFOLD-007–015); 0 unenforced rules (TC-SCAFFOLD-016); 4/4 Bun pin copies (TC-SCAFFOLD-017); 0 `src` exports targets (TC-SCAFFOLD-028); 0 pre-freeze publishes (TC-SCAFFOLD-031); bash jobs unchanged (TC-SCAFFOLD-023/025); alias+relative both caught (TC-SCAFFOLD-011/012).

## Phases

> **Delivery model**: `@coder` executes each phase, then triggers `@committer` with the phase's completion signal as intent hint. One commit per phase (split only if a phase exceeds ~800 changed lines — then one commit per task group, same prefix). The aggregate `check` is green from Phase 4 onward; earlier phases verify with their named commands.

### Phase 0: Environment verification and workspace foundation

**Goal**: RSK-1 closed, pins resolved and recorded, and the pnpm workspace skeleton (root manifest, workspace definition, pin files, lockfile, ignore rules) exists and verifies.

**Tasks**:

- [x] **0.1** Verify tool availability: `pnpm --version`, `bun --version` in the delivery environment; install if missing (pnpm via corepack reading `packageManager`, Bun via the official installer). Resolve pins per policy: exact pnpm version (latest stable, exact — no range), most recent stable Bun (floor: marksync `1.2.23`; RSK-5 fallback recorded if needed). Record both + install method in the execution report. (RSK-1, RSK-5, RSK-6)
- [x] **0.2** Create `.bun-version` (Bun pin copy 1, exact version string) and root `package.json`: `private: true`, `type: "module"`, neutral name (`delivery-os`), `packageManager: "pnpm@<0.1-resolved>"` (pnpm pin), `engines: { "bun": "<0.1-resolved>" }` (Bun pin copy 2). Empty `scripts` placeholder (filled in P2/P3).
- [x] **0.3** Create `pnpm-workspace.yaml` with `packages: ["packages/*"]` (exactly six packages from P1 on); no `.npmrc` hoisting/isolation-weakening settings — any deviation needs a recorded reason (F-2).
- [x] **0.4** `.gitignore` additions (additive only): workspace dependency dirs (`node_modules/` root and per package), build output (`dist/`, `packages/*/dist/`), local ephemeral state, and the project-local config glob exactly as ADR DEC-0003 DEC-1 specifies — brand-free, names no product (F-14; TC-SCAFFOLD-034 proves rename-survival).
- [x] **0.5** Create `bunfig.toml` setting the test root so `bun test` discovers `tests/**` and `packages/*/test/**` (A-T2; `.test.ts` naming for TS tests, distinct from bash `test-*.sh`).
- [x] **0.6** Author `scripts/checks/pnpm-foundation.ts` (TC-SCAFFOLD-002: exact `pnpm@x.y.z` pin, one committed lockfile, workspace lists the six packages, no isolation-weakening settings, root `private: true`) and `scripts/checks/ignore-rules.ts` (TC-SCAFFOLD-034: four coverage classes, brand-free glob, product-token scan, synthetic-rename simulation, `git check-ignore -v` probes).
- [x] **0.7** RSK-4 isolation probe: author `tests/behaviour/pnpm-isolation.test.ts` (TC-SCAFFOLD-003) — temp workspace copy, undeclared sibling import, install + typecheck; asserts and RECORDS the outcome. If isolation does not reject, the test records that as an explicit non-failing observation (boundary rules remain the sole gate); the recorded result goes into the execution report and PR description (spec §18).
- [x] **0.8** `pnpm install` → commit the single `pnpm-lock.yaml`; verify a clean re-install with `--frozen-lockfile` leaves `git status --porcelain` empty.

**Acceptance Criteria**:

- Must: AC-F2-1 (local half — reproducible frozen-lockfile install under the pinned manager), AC-F14-1.
- Should: AC-F3-1 pin copies 1+2 committed and shaped exactly (copies 3+4 land in P6/P8).

**Affected code areas**:

- `.bun-version`, `package.json`, `pnpm-workspace.yaml`, `pnpm-lock.yaml`, `.gitignore` (updated, additive), `bunfig.toml`, `scripts/checks/pnpm-foundation.ts`, `scripts/checks/ignore-rules.ts`, `tests/behaviour/pnpm-isolation.test.ts` (all new)

**System docs to update**:

- none (spec reconciliation is Phase 10)

**Tests**:

- `pnpm install --frozen-lockfile` (clean clone of the branch) → exit 0, clean tree
- `bun run scripts/checks/pnpm-foundation.ts` (six-package assertion green from P1)
- `bun run scripts/checks/ignore-rules.ts`
- `bun test tests/behaviour/pnpm-isolation.test.ts` → records RSK-4 result

**Completion signal**: `feat(GH-170): add pnpm workspace foundation with pinned pnpm and Bun`

---

### Phase 1: Six packages — manifests, subpaths, placeholder structure

**Goal**: G-1 structure half — all six packages exist with declared names, `private: true`, full subpath exports maps, `imports` alias maps, declared workspace entrypoints (DM-3), types-only placeholder sources, and the single `createRuntime` signature; structure tests green.

**Tasks**:

- [x] **1.1** Create the six package manifests under `packages/` — `@delivery-os/{core,adapters,cli,mcp,opencode,testkit}` — every one `private: true` (AC-F11-1), `type: "module"`, version `0.0.0` (pre-freeze placeholder, never published), `files: ["dist"]` on the five publishables. Exports maps (targets at `dist` + `types` condition per DM-2; files created by build in P6):
  - `core`: `.`, `./contracts`, `./state`, `./branding`
  - `adapters`: `./gitlab`, `./jira`, `./github`, `./azure` (empty placeholder per ADR DEC-6 — no consumer yet), `./ci`, `./registry`, `./repo`, `./file`, `./host`, `./session`, `./legacy`
  - `cli`, `mcp`, `opencode`, `testkit`: `.` only — recorded: no surface subpaths at scaffold (`mcp` manifest shape accommodates the `.mcpb` + Bun-or-Node entry form later per DEC-2; structure note only)
- [x] **1.2** Placeholder sources, types-only (empty-but-enforced; TC-SCAFFOLD-006 inventory governs): one module per declared subpath under `src/`; `core` tier dirs `src/{domain,app,config,branding,state}/` with one types-only placeholder each; `core/src/index.ts` declares exactly one `createRuntime({ config, adapters, store, clock })` composition-root signature — type declaration only, no implementation, no other package declares or wires one (TC-SCAFFOLD-005).
- [x] **1.3** `imports` alias maps (DEC-7; marksync mechanic, ADR vocabulary — never `infra`/`cli`/`shared`): `core` `#domain/*,#app/*,#config/*,#branding/*,#state/*` → `./src/<tier>/*.ts`; surfaces (`cli`,`mcp`,`opencode`) `#commands/*`, `#output/*` → `./src/{commands,output}/*.ts`; `adapters` `#gitlab/*,#jira/*,#github/*,#azure/*,#ci/*,#io/*,#registry` → per-module `src/` layout. No package outside `core` duplicates the core tier names.
- [x] **1.4** Declared workspace entrypoints (DM-3) via a brand-free custom manifest field `workspaceImports` (dependency name → allowed subpath list) — the same declarations the boundary rules and `workspace-entrypoints.ts` read: `adapters`→core `["./contracts"]`; `cli`/`mcp`/`opencode`→core `[".", "./contracts", "./state", "./branding"]` and →adapters (all eleven subpaths); `testkit`→core `[".", "./contracts"]`, →adapters (all) as `devDependencies` only; `core` declares none. Mirror as actual workspace deps (`workspace:*`) in the right fields (testkit only ever in `devDependencies`).
- [x] **1.5** Author structure tests: `tests/structure/create-runtime.test.ts` (TC-SCAFFOLD-005 — exactly one declaration, structural parameter-shape assertion, zero elsewhere), `tests/structure/content-inventory.test.ts` (TC-SCAFFOLD-006 — committed inventory `tests/structure/inventory.json` equals the actual file set; AST scan permits only types/re-exports/the one signature; no engine/driver markers), `tests/structure/subpaths.test.ts` (TC-SCAFFOLD-004 — inventory diff vs `exports` keys, missing AND extra fail; dist-resolution assertions activate once P6 build exists — annotated so until then).
- [x] **1.6** Author `scripts/checks/manifest-privacy.ts` (TC-SCAFFOLD-030 — exactly six manifests, all `private: true` boolean, no `publishConfig` override, root private).

**Acceptance Criteria**:

- Must: AC-F1-2, AC-F11-1; AC-F1-1 structure half (declared subpaths exist and resolve in-workspace).
- Should: TC-SCAFFOLD-004 dist-dependent assertions are wired and waiting on P6 build, not silently skipped.

**Affected code areas**:

- `packages/{core,adapters,cli,mcp,opencode,testkit}/package.json`, `packages/*/src/**` placeholder modules, `tests/structure/{subpaths,create-runtime,content-inventory}.test.ts`, `tests/structure/inventory.json`, `scripts/checks/manifest-privacy.ts` (all new)

**System docs to update**:

- none

**Tests**:

- `pnpm install` → workspace links resolve; `bun test tests/structure` (TC-SCAFFOLD-005/006 green; TC-SCAFFOLD-004 src-half green)
- `bun run scripts/checks/manifest-privacy.ts`; re-run `scripts/checks/pnpm-foundation.ts` (six-package assertion now green)

**Completion signal**: `feat(GH-170): scaffold six private packages with declared subpaths and createRuntime signature`

---

### Phase 2: Strict TypeScript configuration and solution typecheck

**Goal**: F-4/AC-F4-1 — one strict base config carrying the full ADR DEC-3 flag set (identical to the marksync-proven set), composite per-package configs, root solution typecheck; flag regressions fail by name.

**Tasks**:

- [x] **2.1** Create `tsconfig.base.json` with the full flag set: `strict`, `noUncheckedIndexedAccess`, `exactOptionalPropertyTypes`, `noUnusedLocals`, `noUnusedParameters`, `noImplicitReturns`, `noFallthroughCasesInSwitch`, `noImplicitOverride`, `noUncheckedSideEffectImports`, `verbatimModuleSyntax`, `isolatedModules`, `module: ESNext`, `moduleResolution: bundler`, `target: ESNext`, `declaration` + `declarationMap`, `forceConsistentCasingInFileNames`. Adapted from marksync `tsconfig.json` → provenance comment (MIT, source path). Record the `skipLibCheck: true` decision with reason (only escape hatch permitted, per TC-SCAFFOLD-019).
- [x] **2.2** Per-package `packages/*/tsconfig.json`: `extends` the base, `composite`, `outDir: dist`, `rootDir: src`, `include: src/**` — zero weakening overrides. Add `typescript` + `@types/bun` devDependencies (versions ≥ marksync floor: TS `^6.0.3`, `@types/bun` `^1.3.14`).
- [x] **2.3** Root solution `tsconfig.json` referencing all six package configs; add root + per-package `typecheck` scripts (`tsc --noEmit`); `pnpm typecheck` clean across all six.
- [x] **2.4** Author `scripts/checks/tsconfig-strictness.ts` (TC-SCAFFOLD-019 — asserts the exact flag set, extends-the-base with no weakening, solution references all six) and the TC-SCAFFOLD-020 mutation driver: probe source exercising each flag (indexed access, optional property, unused local, implicit return, switch fallthrough, side-effect import) under `tests/fixtures/tsconfig/**`; `bun test tests/checks` removes one flag at a time in a temp copy and asserts the check fails by name and the probe is real.

**Acceptance Criteria**:

- Must: AC-F4-1, NFR-5 — solution typecheck clean under the full set; any single-flag removal fails the check.
- Should: zero `@ts-expect-error` in scaffold sources.

**Affected code areas**:

- `tsconfig.base.json`, `tsconfig.json`, `packages/*/tsconfig.json`, root + package `typecheck` scripts, `scripts/checks/tsconfig-strictness.ts`, `tests/fixtures/tsconfig/**` (all new)

**System docs to update**:

- none

**Tests**:

- `pnpm typecheck` → exit 0
- `bun run scripts/checks/tsconfig-strictness.ts`; `bun test tests/checks` (tsconfig mutation cases)

**Completion signal**: `feat(GH-170): add strict TypeScript base config and solution typecheck`

---

### Phase 3: Biome, package scripts, and the single aggregate check

**Goal**: F-8/F-9/AC-F8-1 — one root Biome config owns format+lint; the five named checks exist at root and in all six packages; exactly one aggregate `check` chains them; the script surface is itself machine-checked.

**Tasks**:

- [x] **3.1** Create root `biome.json` (one config; lint + format only — the type checker owns type correctness, no duplicated rules). Add `@biomejs/biome` devDependency (floor `^2.5.2`).
- [x] **3.2** Add the script surface at root and in each of the six packages: `lint` (`biome lint .`), `format:check` (`biome format .`), `typecheck` (from P2), `test` (`bun test`), `check:boundaries` (`depcruise packages` + ambient guard — config lands in P4; script declared now, enforcing from P4), and the single aggregate `check` = `lint && format:check && typecheck && test && check:boundaries` in that order. No alternate aggregate names (`verify`, `ci`, `all`, `validate`, `precommit`), no bypass flags.
- [x] **3.3** Author `scripts/checks/script-surface.ts` (TC-SCAFFOLD-021 — five named checks present and non-empty at both levels; exactly one aggregate; order correct; alternates absent).
- [x] **3.4** Add `dependency-cruiser` devDependency (floor `^18.0.0`) so P4 has its runner; lockfile updated.

**Acceptance Criteria**:

- Must: AC-F8-1; NFR-1's local half (aggregate exists; green from P4 once boundaries enforce).
- Should: Biome format applied to all new TS sources (one `biome format --write` pass, no ongoing drift).

**Affected code areas**:

- `biome.json`, root + `packages/*/package.json` scripts, `scripts/checks/script-surface.ts` (new/updated)

**System docs to update**:

- none

**Tests**:

- `pnpm lint`, `pnpm format:check` → exit 0
- `bun run scripts/checks/script-surface.ts`

**Completion signal**: `feat(GH-170): add Biome and the single aggregate check script surface`

---

### Phase 4: Boundary rules, negative-fixture harness, and coverage meta-check

**Goal**: G-2/AC-F5-1, AC-F6-1, AC-F7-1, AC-F1-1 enforcement half — the full ADR DEC-2 rule set runs mechanically, catches alias AND relative forms, every forbidden rule has a failing fixture, and a rule without a fixture fails the check as unenforced.

**Tasks**:

- [x] **4.1** Create root `.dependency-cruiser.cjs` — adapted from marksync's config (provenance comment; `enhancedResolveOptions` block adapted: TS extensions, `exportsFields: ["exports"]`, `mainFields`, `conditionNames`; `doNotFollow` node_modules/`^^/dist`; default resolver follows the Node `imports` `#aliases`). One `forbidden` entry per importer class with the EXACT rule names the fixture registry keys on (test plan §4.1, mirrored verbatim): `matrix-core-importer`, `matrix-adapters-importer`, `matrix-cli-importer`, `matrix-mcp-importer`, `matrix-opencode-importer` — five importer rules, one per DEC-2 package-matrix row with forbidden cells; `matrix-adapters-importer` forbids `adapters`→`cli`/`mcp`/`opencode` via an allowed-set matcher (alias AND relative specifiers both fire it; the allowed `adapters`→`core ./contracts` edge stays clean), while the sixth importer row (`testkit`→surfaces) is owned by `testkit-no-surface-import` and each row's `→testkit` cell by `testkit-no-production-import`; `subpath-adapters-core-state`, `subpath-adapters-core-branding`, `subpath-undeclared` (whole-package root `.` and subpath-level forms); `no-deep-package-import`, `no-relative-cross-package-import`; `tier-domain-only-contracts`, `tier-config-only-contracts`, `tier-branding-only-contracts`, `tier-app-allowed-set`, `tier-state-allowed-set` (allowed-set form with `pathNot`; `./contracts` the only cross-tier import per A-T7); `testkit-no-production-import`, `testkit-no-surface-import`; `runtime-apis-confinement` — the allowlist is the ADR sentence verbatim: runtime APIs are permitted only in "the `core ./state` driver code, the adapter I/O subpaths, the CLI build, and the OpenCode host integration" (ADR-0003 DEC-2, "Additional rules", bullet 6, final sentence; enforced by the root dependency-cruiser configuration per "Enforcement is mechanical", bullet 5 — mirrored from test plan §4.1's ADR-verbatim scope contract). The CLI-build and OpenCode-host allowances are structural (build/host integration layers with no code at scaffold); their behavioral clean-cruise controls are deferred to the first story that adds such code (A-T9), while TC-SCAFFOLD-014 step 5 asserts the configured allowlist names all four locations. Any other location — the entire ambient neutrality set of task 4.2 — is forbidden. Subpath rules read the `workspaceImports` declarations from P1 (DM-3). Every forbidden rule is configured `severity: 'error'` — a `warn`-severity rule is treated as unenforced by TC-SCAFFOLD-016 (test plan §4.1).
- [x] **4.2** Author the ambient-globals AST guard `scripts/checks/ambient-globals.ts` with rule ids `ambient-globals-neutral-tiers` and `ambient-env-branding` — scope and bans taken from the binding ADR text (ADR-0003 DEC-2, "Additional rules", bullet 6 / C-9, neutrality sentence + branding sentence; "Enforcement is mechanical", bullet 6 — the same cells test plan §4.1 cites), never from directory intuition. `ambient-globals-neutral-tiers` covers the **neutral set** exactly — `packages/core/src/index.ts` (the `core` `.` entry module), `packages/core/src/contracts/**` (`./contracts`), and `packages/core/src/{domain,app,config,branding}/**` (the internal tiers implementing `.`; `branding` is the `./branding` module) — with the ban list verbatim: `bun:*`, `node:*` (specifier forms enforced by `runtime-apis-confinement` over the same set, TC-SCAFFOLD-014), `process`, `Bun`, `Deno`, ambient clock or randomness (`setTimeout`, `setInterval`, `Date.now`, `Math.random`), a filesystem or network global (`fetch`), or an ambient environment read (`process.env`, `Bun.env`). The guard asserts its own configured file scope equals the ADR neutral set — a guard scoped only to `core/src/{domain,app,config,branding}` (missing `./contracts` or the `.` entry) fails naming the missing path (TC-SCAFFOLD-015 step 1). `ambient-env-branding` unchanged: `process.env`/`Bun.env` banned in `core/src/branding` (the `./branding`-specific half of the same ADR bullet — "the module never reads `process.env` or `Bun.env`"). Wire it INTO `check:boundaries` after depcruise — part of the boundary gate, not an advisory lint (TC-SCAFFOLD-015).
- [x] **4.3** Author `scripts/checks/workspace-entrypoints.ts` (TC-SCAFFOLD-007 — extracts workspace imports from `packages/*/src/**` and tests, asserts package+subpath declared in `workspaceImports`, allowed edges resolve, every manifest permission is enforced by a rule).
- [x] **4.4** Author the negative-fixture harness `tests/boundaries/harness.ts` + fixtures per the §4 contract: `mkdtemp` workspace, materialize fixture packages, copy the PRODUCTION `.dependency-cruiser.cjs` verbatim, symlink fixture packages under temp `node_modules/@delivery-os/`, clean-cruise precondition (0 violations before injection), inject, re-cruise, pass = expected rule name in `summary.violations` + non-zero exit. No probe ever written into the live tree (RSK-T3). Fixture dirs `tests/boundaries/fixtures/{matrix-*,subpath-*,deep-import-*,relative-escape-*,tier-alias-*,tier-relative-*,testkit-*,runtime-apis-*,ambient-*}` covering TC-SCAFFOLD-008 (7 forbidden matrix cases — `cli`→`mcp`, `mcp`→`opencode`, `core`→`adapters`, `opencode`→`cli`, `adapters`→`cli` (alias), `adapters`→`opencode` (alias), `adapters`→`mcp` (relative); the three adapters cases must fire `matrix-adapters-importer` — plus allowed-cell controls: `adapters`→`core ./contracts` cruises clean (existing) and the NEW package-matrix `yes`-cell controls `cli`/`mcp`/`opencode`/`testkit`-src → `@delivery-os/adapters/registry`, each clean (fixture manifests declare `adapters` so the controls are declared imports; step 5)), TC-SCAFFOLD-009 (4 forbidden subpath cases — `./state`, `./branding`, whole-package root `.` undeclared, subpath-level undeclared — plus 15 allowed controls: `cli`/`mcp`/`opencode`→all four core subpaths (12), `testkit`→core `.`/`./contracts` (2), `adapters`→`./contracts` (1, existing); the `core ./state` control must stay clean even though the driver module imports runtime APIs — the driver's own imports are TC-014's allowlist, not the importer's rule), TC-SCAFFOLD-010 (deep + 2 relative escapes, target-path reporting), TC-SCAFFOLD-011 (7 forbidden alias edges — one per tier rule, incl. `tier-state-allowed-set` (`#state/*`→`#domain/*`) — + allowed controls), TC-SCAFFOLD-012 (same edges in relative form, same rule names), TC-SCAFFOLD-013 (8 violating probes — Case A production-import one per package `core`/`adapters`/`cli`/`mcp`/`opencode` (×5) + Case B surface-import ×3 (`cli`/`mcp`/`opencode`) — plus 2 passing dev-edge controls: Case C `packages/core/test/**`→`testkit` via `devDependencies` and NEW Case E root `e2e/m0.test.ts` + `bdd/m0.test.ts`→`@delivery-os/testkit` via root `devDependencies` (dev-edge table row 3; synthetic fixture — no root `e2e/`/`bdd/` dirs exist at scaffold, A-T10); Case D metadata-only: rule references the manifest field), TC-SCAFFOLD-014 (`node:fs` in domain, `bun:*` in config, `node:sqlite` outside state + 2 clean controls (`core/src/state`, adapter I/O subpath; CLI-build/OpenCode-host controls deferred per A-T9) + step-5 allowlist-shape assertion: the configured allowlist names all four ADR locations or fails), TC-SCAFFOLD-015 (37 failing cases — branding env ×2 (`process.env.X`/`Bun.env.X` → `ambient-env-branding`) + NEW Case C `process.env.X` in `core/src/contracts/result.ts` + NEW Case D banned global in `core/src/index.ts` ×2 (`process.env.X`, `fetch`) + Case E per-global-per-neutral-tier sweep: 8 banned identifier forms (`process`, `Bun`, `Deno`, `setTimeout`, `setInterval`, `Date.now`, `Math.random`, `fetch`) × 4 neutral tiers (`domain`, `app`, `config`, `branding`) = 32, each case individually registered — plus 2 controls (surface `cli/src`, `core/src/state`) and the step-1 scope assertion: the guard's configured scope equals the ADR-verbatim neutral set).
- [x] **4.5** Author the fixture registry `tests/boundaries/fixture-registry.json` (rule name → case list) + meta-check `tests/boundaries/fixture-coverage.test.ts` (TC-SCAFFOLD-016): every configured `forbidden[].name` AND both ambient rule ids have ≥1 case, each registered `severity: 'error'` (`warn` = unenforced); the ambient registry covers the full ADR-verbatim neutral set (TC-SCAFFOLD-016 step 5): `ambient-globals-neutral-tiers` carries registered cases for the `.` entry (`packages/core/src/index.ts`), `./contracts`, `domain`, `app`, `config`, and `branding` — including the `process.env`-in-`./contracts` case and the banned-global-in-`index.ts` case — and `ambient-env-branding` carries both the `process.env` and `Bun.env` branding cases; a registry missing the `./contracts` or `.`-entry ambient case is a distinct coverage failure, not masked by the `domain`/`app`/`config`/`branding` cases; the mandatory importer-rule set is asserted complete — `matrix-core-importer`, `matrix-adapters-importer`, `matrix-cli-importer`, `matrix-mcp-importer`, `matrix-opencode-importer` plus both `testkit-*` rules; `subpath-undeclared` carries TWO registered cases (whole-package root `.` + subpath-level miss); no orphan registry keys; expected-rule mode across the suite; deleted-fixture mutation (temp registry copy) fails the meta-check — including deletion of ONLY the `matrix-adapters-importer` case — proving it is not vacuous and the adapters row cannot silently drop out.
- [x] **4.6** Run the first fully green aggregate: `pnpm check` (lint → format → typecheck → test → boundaries) exit 0.

**Acceptance Criteria**:

- Must: AC-F5-1 (alias + relative forms both fail), AC-F6-1, AC-F7-1/NFR-3 (1+ fixture per rule; missing fixture fails), AC-F1-1 enforcement half.
- Should: fixture count stays proportional (rule-per-importer-class granularity, not per-edge explosion).

**Affected code areas**:

- `.dependency-cruiser.cjs`, `scripts/checks/ambient-globals.ts`, `scripts/checks/workspace-entrypoints.ts`, `tests/boundaries/{harness.ts,fixture-registry.json,fixture-coverage.test.ts,boundaries.test.ts}`, `tests/boundaries/fixtures/**` (all new); `check:boundaries` script finalized

**System docs to update**:

- none

**Tests**:

- `pnpm check:boundaries` → exit 0; `bun test tests/boundaries` → all fixture cases fire their declared rule
- `bun run scripts/checks/workspace-entrypoints.ts`; `pnpm check` green

**Completion signal**: `feat(GH-170): enforce DEC-2 boundary rules with negative fixtures and coverage meta-check`

---

### Phase 5: commitlint and husky commit-msg hook

**Goal**: F-8/AC-F8-2 — one root commitlint config; a local hook that is convenience only (offline, non-mutating, never blocks the ADOS agent commit flow); CI commitlint prepared as the authority.

**Tasks**:

- [x] **5.1** Create the single root `commitlint.config.js` (`@commitlint/config-conventional`; devDeps `@commitlint/cli` + config, floor `^21.2.0`). No package-level overrides.
- [x] **5.2** Add husky (floor `^9.1.7`): root `prepare` script (`husky`) and `.husky/commit-msg` that runs commitlint locally in **warn-only** mode — prints the violation, always exits 0, performs no network access, mutates neither the commit message nor the index nor any file (RSK-3/NFR-9; CI is the authority).
- [x] **5.3** Author `scripts/checks/commitlint-authority.ts` (TC-SCAFFOLD-026): exactly one root config, no overrides; the CI job runs commitlint against the delivery-branch base AND the PR base — **OQ-T4 resolution bound here**: `pull_request` → both ranges; `push` → merge-base range `origin/main-tools...HEAD`. Mutation: malformed message on a temp branch fails the invocation, conventional passes.
- [x] **5.4** Author `tests/behaviour/commit-msg-hook.test.ts` (TC-SCAFFOLD-027): scratch git repo — valid conventional commit succeeds; malformed commit is NOT blocked and mutates nothing (`git status --porcelain` unchanged apart from the commit); hook completes with networking disabled; bounded time.

**Acceptance Criteria**:

- Must: AC-F8-2/NFR-9 — hook offline, non-mutating, never blocks; authority is CI.
- Should: hook config ≤ ~5 lines (minimal surface for RSK-3).

**Affected code areas**:

- `commitlint.config.js`, `.husky/commit-msg`, root `package.json` (`prepare`), `scripts/checks/commitlint-authority.ts`, `tests/behaviour/commit-msg-hook.test.ts` (new)

**System docs to update**:

- none

**Tests**:

- `bun test tests/behaviour/commit-msg-hook.test.ts`
- `bun run scripts/checks/commitlint-authority.ts` (CI-job assertions complete in P8)

**Completion signal**: `feat(GH-170): add commitlint config and offline warn-only husky commit-msg hook`

---

### Phase 6: Build, exports discipline, publish guard, changesets fixed group

**Goal**: F-10/F-11/F-12 — AC-F10-1, AC-F11-2, AC-F12-1 — tsc builds to `dist`, exports resolve through `dist`+`types` with publint/attw (DEC-11), all-private manifests double-locked by a release-job publish guard, and the changesets fixed group covers exactly five publishables.

**Tasks**:

- [x] **6.1** Build per DEC-1: per-package `build` = `tsc` emit to `dist` (no bundler); root `build` runs all six via the workspace. TC-SCAFFOLD-004's dist-resolution assertions activate and pass (`bun test tests/structure`).
- [x] **6.2** Author `scripts/checks/exports-discipline.ts` (TC-SCAFFOLD-028): for the five publishables, every `exports` entry and condition resolves under `dist/`, none contains `src`, every entry has a `types` condition → `.d.ts` under `dist/`, top-level `main`/`module`/`types` follow the same rule, `type: "module"`, `files` restricts to `dist` (+readme/license).
- [x] **6.3** Add `publint` + `attw` (`@arethetypeswrong/cli`) devDependencies (pinned like all dev tooling); add the post-build exports check step: publint per publishable + `attw --pack .` per publishable with a **recorded allowance profile** (deliberate no-CJS-types results listed explicitly; any NEW unlisted finding fails — fail-on-unknown, same principle as the fixture registry). Local green now; CI job in P8 runs it after `build` (TC-SCAFFOLD-029). `testkit` excluded from publint/attw (A-T8).
- [x] **6.4** Create `.changeset/config.json`: exactly one `fixed` group = `@delivery-os/{core,adapters,cli,mcp,opencode}`; `testkit` in no group and not publishable via `privatePackages`. Add the `@changesets/cli` devDependency (pinned like all dev tooling; floor recorded in the execution report) so the config is operative — it is the `changesets` entry P7.1 enumerates in the license registry. Author `scripts/checks/changesets-group.ts` (TC-SCAFFOLD-032) and `scripts/checks/testkit-exclusion.ts` (TC-SCAFFOLD-033 — testkit in no `dependencies`/`peerDependencies`/`optionalDependencies` anywhere, `devDependencies` only, and itself dev-depends on core/adapters).
- [x] **6.5** Author `scripts/checks/publish-guard.ts` (TC-SCAFFOLD-031): fails when any intended-publishable is still `private: true` OR the branded scope is not applied (both failure reasons reachable and named); mutation cases under `tests/fixtures/publish-guard/**` driven from `bun test tests/checks` — live tree fails with "still private" (correct pre-freeze), one-flipped temp copy fails with "branded scope not applied", all-flipped + branded temp copy passes (guard is not unconditional).
- [x] **6.6** Create `.github/workflows/release.yml` (new file; NOT triggered pre-freeze — `workflow_dispatch` only): runs the publish guard BEFORE any publish step, unskippably (no `continue-on-error`/`|| true`/`if: always()`); carries the Bun pin as copy 4 (release build install step) — equality-checked in P8.

**Acceptance Criteria**:

- Must: AC-F10-1/NFR-6 (0 `src` targets, 100% dist+types, publint+attw+export check pass), AC-F11-2 (guard fails pre-freeze both ways, positioned before publish), AC-F12-1 (fixed group = exactly five).
- Should: attw allowance profile kept minimal and each allowance justified in the check config.

**Affected code areas**:

- root + `packages/*/package.json` (`build` script; root gains the `@changesets/cli` devDep in 6.4), `scripts/checks/{exports-discipline,changesets-group,testkit-exclusion,publish-guard}.ts`, `.changeset/config.json`, `.github/workflows/release.yml`, `tests/fixtures/publish-guard/**` (new)

**System docs to update**:

- none

**Tests**:

- `pnpm build` → `dist/` in all six; `bun test tests/structure` (TC-SCAFFOLD-004 fully green)
- `bun run scripts/checks/{exports-discipline,changesets-group,testkit-exclusion}.ts`; publint + attw per publishable → clean
- `bun test tests/checks` (publish-guard mutations)
- Live-tree `bun run scripts/checks/publish-guard.ts` → non-zero with "still private" (expected pre-freeze state)

**Completion signal**: `feat(GH-170): add dist build, exports checks, publish guard, and changesets fixed group`

---

### Phase 7: License registry seed and fail-closed audit

**Goal**: DEC-10/OQ-1 (resolved), C-2 — `doc/legal/dependency-licenses.yaml` covers the scaffold dev-toolchain dependency set; a minimal fail-closed audit joins the check suite; full registry policy stays in M0-S18.

**Tasks**:

- [x] **7.1** Seed `doc/legal/dependency-licenses.yaml` (machine-readable YAML per the audit schema — no free-form prose in required fields): enumerate every direct dev dependency from root + package manifests at execution time (TS, Biome, commitlint, husky, dependency-cruiser, publint, attw, changesets, @types/*…); each entry: package, version, SPDX license identifier, source `dev-dependency`, verdict field for the owner's C-2 determination at PR review (manual recording, per TC-SCAFFOLD-035 step 5).
- [x] **7.2** Author `scripts/checks/license-audit.ts` (TC-SCAFFOLD-035): scope = the committed lockfile/manifest dependency set (A-T5), not the installed tree; every direct dev dependency registered with an approved verdict; allow-list derived from approved verdicts; registry parses under the audit schema.
- [x] **7.3** Fail-closed proof: fixtures `tests/fixtures/license/**` + mutation driver in `bun test tests/checks` (TC-SCAFFOLD-036): unknown `LicenseRef-Proprietary` fails; known-but-non-allowlisted (`GPL-3.0-only`) fails; compound expressions are PARSED as SPDX expressions, never prefix/substring matched — an `OR` with any disallowed branch fails closed, `AND` requires all branches allowed; removed real entry fails; empty/missing license field fails. Every case exits non-zero naming package + expression + reason.

**Acceptance Criteria**:

- Must: TC-SCAFFOLD-035/036 green — no unaudited dependency from the first dependency onward (C-2/DEC-10).
- Should: registry entries carry the exact resolved versions from the lockfile (not ranges).

**Affected code areas**:

- `doc/legal/dependency-licenses.yaml`, `scripts/checks/license-audit.ts`, `tests/fixtures/license/**` (new)

**System docs to update**:

- none (note for Phase 10: flag in the PR that the ADR-0003 scaffold file list gains the registry — DEC-10 retrospective item)

**Tests**:

- `bun run scripts/checks/license-audit.ts` → exit 0
- `bun test tests/checks` (license mutation cases all fail closed)

**Completion signal**: `feat(GH-170): seed dependency license registry with fail-closed audit`

---

### Phase 8: CI fast loop — additive binding TypeScript jobs

**Goal**: F-13/AC-F13-1 — binding TypeScript jobs on the delivery branch beside byte-unchanged bash jobs; pin equality across all four Bun copies including the installed runtime; supply-chain hygiene (C-10).

**Tasks**:

- [x] **8.1** Additive jobs in `.github/workflows/ci.yml` (prefixed `ts-`, additions only — existing bash job blocks byte-untouched, RSK-2), each with its own frozen-lockfile install from the pins via SHA-pinned actions, job-scoped `permissions: contents: read`, no bypass constructs. Job set and order per test plan §4: `ts-fresh-clone` (TC-SCAFFOLD-001 — clone, install from `packageManager`/`.bun-version` only, frozen lockfile, clean tree, record versions), then parallel `ts-typecheck` / `ts-lint` / `ts-format` / `ts-test` / `ts-boundaries`, then `ts-build` → `ts-exports` (exports + publint + attw AFTER build — they consume `dist`; order constraint), then `ts-pins` → `ts-publish-guard` → `ts-license-audit` → `ts-vuln` → `ts-aggregate` (`pnpm check`, TC-SCAFFOLD-022) and `ts-commitlint` (TC-SCAFFOLD-026: PR-base + delivery-branch-base ranges on `pull_request`; merge-base range `origin/main-tools...HEAD` on `push` — OQ-T4 resolution). The CI matrix Bun version is pin copy 3.
- [x] **8.2** Author `scripts/checks/pin-equality.ts` (TC-SCAFFOLD-017): `.bun-version` as source of truth; compare engines field, CI matrix entry, release-build definition — all four identical, exact shape (no range/`latest`), never hardcoding a version; in CI additionally assert `bun --version` equals `.bun-version` (closes RSK-T2). Mutation cases `tests/fixtures/pins/**` (TC-SCAFFOLD-018): each of the four copies diverged, a range pin `~1.2.0`, and `latest` — every mutation fails naming location + both values.
- [x] **8.3** Author `scripts/checks/ci-topology.ts` (TC-SCAFFOLD-023): the seven existing bash job ids present and unmodified (diff vs base: additions only inside the file); new TS job set complete; triggers cover `pull_request` → `main-tools` and pushes to the delivery branch.
- [x] **8.4** Author `scripts/checks/ci-bindingness.ts` (TC-SCAFFOLD-024 — zero `continue-on-error`/`|| true`/`set +e`/`exit 0` wraps/`if: always()` in gate jobs; `continue-on-error` injection into a temp copy is caught), `scripts/checks/ci-supply-chain.ts` (TC-SCAFFOLD-038 — every `uses:` SHA-pinned incl. `actions/*`, least-privilege permissions, no `pull_request_target` + untrusted checkout; floating-tag mutation caught), `scripts/checks/vulnerability-gate.ts` (TC-SCAFFOLD-037 — `pnpm audit --audit-level high` over the committed lockfile, binding from the first dependency; fixture advisory mutation proves it can fail).
- [x] **8.5** RSK-2 proof: `git diff` vs `main-tools` base for `scripts/**` (excluding new `scripts/checks/`), `tools/**`, and the bash job blocks — zero changes; run the bash suites directly (`bash scripts/.tests/test-*.sh`, `bash tools/.tests/test-*.sh`) → green (TC-SCAFFOLD-025 local half).
- [x] **8.6** Wire every `scripts/checks/*` into the aggregate `check` or a named CI job — no orphan checks (TC-SCAFFOLD-021/TC-SCAFFOLD-023 wiring rule).

**Acceptance Criteria**:

- Must: AC-F13-1/NFR-8 (TS jobs binding, bash jobs byte-unchanged and green), AC-F3-1 (four-copy equality + installed-runtime check), AC-F2-1/AC-F9-1 CI halves, NFR-10.
- Should: single install per job with cache; fast loop lean (RSK-T4).

**Affected code areas**:

- `.github/workflows/ci.yml` (updated — additive), `scripts/checks/{pin-equality,ci-topology,ci-bindingness,ci-supply-chain,vulnerability-gate}.ts`, `tests/fixtures/pins/**` (new)

**System docs to update**:

- none

**Tests**:

- All new checks green locally: `bun run scripts/checks/{pin-equality,ci-topology,ci-bindingness,ci-supply-chain,vulnerability-gate}.ts`
- `bun test tests/checks` (pin + bindingness + supply-chain + vuln mutations)
- Push branch → observe the CI run (conclusions recorded in P9; TC-SCAFFOLD-023 step 5)

**Completion signal**: `ci(GH-170): add binding TypeScript fast-loop jobs beside untouched bash jobs`

---

### Phase 9: Full local verification and recording

**Goal**: NFR-1 end-to-end — fresh-clone → install → aggregate check green with zero manual steps; every verification result, resolved pin, duration, and deviation recorded; RSK-T3 clean-tree proof.

**Tasks**:

- [ ] **9.1** Fresh-clone simulation (TC-SCAFFOLD-001 + TC-SCAFFOLD-022 local): clone the branch into an empty temp dir, install pnpm/Bun from the pinned sources only, `pnpm install --frozen-lockfile` (clean `git status --porcelain` after), then `pnpm check` with no extra flags — all five chained steps run and pass, exit 0. Record wall-clock duration; if > 10 min, record and REPORT to the PM (OQ-T3 — do not fail). Assert `git status --porcelain` clean after the full suite (RSK-T3 — nothing under version control written during a run).
- [ ] **9.2** Bash non-regression, formal run (TC-SCAFFOLD-025): both existing suites green, byte-identical files, same job conclusions on the pushed branch.
- [ ] **9.3** Record the observed CI run for the branch push: every new TS job's conclusion + the untouched bash jobs' conclusions (TC-SCAFFOLD-023 step 5; CI observations for TC-SCAFFOLD-029/037).
- [ ] **9.4** Record final facts in the execution report and Execution Log below: resolved pnpm + Bun versions (+ install method), RSK-4 isolation verification result, aggregate duration, CI run reference, per-phase commit hashes, deviations (if any).

**Acceptance Criteria**:

- Must: AC-F2-1, AC-F9-1 fully verified end-to-end; all 38 TCs executed and their results recorded.
- Should: fresh-clone aggregate ≤ 10 min (provisional; re-baseline via PM if exceeded).

**Affected code areas**:

- none (verification + recording; execution-report content committed into this plan's Execution Log)

**System docs to update**:

- none

**Tests**:

- TC-SCAFFOLD-001, TC-SCAFFOLD-022 (local), TC-SCAFFOLD-025, CI observations for 023/029/037

**Completion signal**: `chore(GH-170): record fresh-clone verification, resolved pins, and durations`

---

### Phase 10: Finalize — spec reconciliation, version impact, DoD

**Goal**: Close the change — system spec reconciled with the scaffold, version impact recorded, Definition of Done checked. **No PR creation in this plan** (separate phase, per orchestrator).

**Tasks**:

- [ ] **10.1** Spec reconciliation and doc sync (lifecycle phase 7 via `/sync-docs GH-170` / `@doc-syncer` — every item below is `@doc-syncer` work, NOT `@coder` delivery work): `doc/spec/**` gains the monorepo scaffold in the tooling feature area; the architecture overview mentions the package graph; the TypeScript test layer joins `.ai/rules/testing-strategy.md` (A-T3). Flag the DEC-10 retrospective item at PR review: the ADR-0003 scaffold file list gains the license registry.
  - **10.1a** AGENTS.md repo-structure section: add `packages/` and the root workspace files (`pnpm-workspace.yaml`, `pnpm-lock.yaml`, `.bun-version`, `bunfig.toml`, `tsconfig.base.json`/`tsconfig.json`, `biome.json`, `.changeset/`) so agents know where new code belongs.
  - **10.1b** AGENTS.md `scripts/` convention: scoped exception note on the `scripts/` table row — `scripts/checks/*.ts` TypeScript invariant checks intentionally sit beside the `.sh` convention (A-T1); the bash `scripts/*.sh` convention itself and `.ai/rules/bash.md` are untouched.
  - **10.1c** `doc/overview/glossary.md`: add the scaffold terms already defined in the spec glossary — publish guard, negative fixture, aggregate check, tier alias, empty-but-enforced.
  - **10.1d** `doc/planning/oss-tooling/cli-command-registry.md`: verification pass over the M0-S1 row ("Six-package monorepo, pnpm + Bun, CI fast loop, publish guard") against the delivered reality; record any drift.
- [ ] **10.2** Version impact: **minor** — recorded via spec reconciliation + this plan's revision log. The repo root manifest and all packages stay `0.0.0` private pre-freeze (nothing publishes; guard active), so there is no released version number to bump; the changesets fixed group owns versioning from the freeze change onward.
- [ ] **10.3** DoD check: all 17 spec ACs (§17) green with TC evidence; all plan tasks checked; NFR-1..NFR-6, NFR-8..NFR-10 verified (NFR-7 deferred by spec §7.3/DEC-5); RSK-1..RSK-6 results recorded; no modifications to the protected files (first-commit history, backlog `Ticket:` lines, bash jobs, `.opencode/`, `.ados-claude/`).

**Acceptance Criteria**:

- Must: `doc/spec/**` reflects F-1..F-14; DoD reached; all spec §17 ACs satisfied.
- Should: retrospective inputs recorded (pins, isolation result, duration) per spec §18.

**Affected code areas**:

- none (documentation/release only)

**System docs to update**:

- `doc/spec/**` (updated — tooling feature area, package graph; via `@doc-syncer`)
- `.ai/rules/testing-strategy.md` (updated — TypeScript layer)
- `AGENTS.md` (updated via `@doc-syncer` — repo-structure section gains `packages/` + root workspace files, and the `scripts/` table row gains the scoped `scripts/checks/*.ts` exception note; 10.1a/10.1b)
- `doc/overview/glossary.md` (updated via `@doc-syncer` — scaffold terms: publish guard, negative fixture, aggregate check, tier alias, empty-but-enforced; 10.1c)
- `doc/planning/oss-tooling/cli-command-registry.md` (verified via `@doc-syncer` — M0-S1 row checked against delivered reality; 10.1d)

**Tests**:

- DoD walkthrough against §17 AC ↔ TC traceability table below

**Completion signal**: `docs(GH-170): reconcile system spec for monorepo scaffold`

---

## Test Scenarios

Full definitions: [chg-GH-170-test-plan.md](./chg-GH-170-test-plan.md) §5. **Traceability (phase → ACs → TCs)** — all 17 ACs and all 38 TCs covered:

| Phase | Spec ACs satisfied | Test-plan TCs |
|-------|--------------------|---------------|
| 0 — Workspace foundation | AC-F2-1 (local), AC-F14-1, (AC-F3-1 copies 1+2) | TC-SCAFFOLD-002, TC-SCAFFOLD-003, TC-SCAFFOLD-034 |
| 1 — Six packages | AC-F1-1 (structure), AC-F1-2, AC-F11-1 | TC-SCAFFOLD-004 (src half; dist half P6), TC-SCAFFOLD-005, TC-SCAFFOLD-006, TC-SCAFFOLD-030 |
| 2 — Strict TypeScript | AC-F4-1 | TC-SCAFFOLD-019, TC-SCAFFOLD-020 |
| 3 — Biome + scripts + aggregate | AC-F8-1, AC-F9-1 (scripts) | TC-SCAFFOLD-021 |
| 4 — Boundaries + fixtures | AC-F1-1 (enforcement), AC-F5-1, AC-F6-1, AC-F7-1 | TC-SCAFFOLD-007, TC-SCAFFOLD-008, TC-SCAFFOLD-009, TC-SCAFFOLD-010, TC-SCAFFOLD-011, TC-SCAFFOLD-012, TC-SCAFFOLD-013, TC-SCAFFOLD-014, TC-SCAFFOLD-015, TC-SCAFFOLD-016 |
| 5 — commitlint + husky | AC-F8-2 | TC-SCAFFOLD-026 (local half; CI half P8), TC-SCAFFOLD-027 |
| 6 — Build/exports/guard/changesets | AC-F10-1, AC-F11-2, AC-F12-1 | TC-SCAFFOLD-004 (dist half), TC-SCAFFOLD-028, TC-SCAFFOLD-029 (local half; CI half P8), TC-SCAFFOLD-031, TC-SCAFFOLD-032, TC-SCAFFOLD-033 |
| 7 — License registry + audit | DEC-10/C-2 (feeds AC-F13-1) | TC-SCAFFOLD-035, TC-SCAFFOLD-036 |
| 8 — CI fast loop | AC-F13-1, AC-F2-1 (CI), AC-F3-1 (full), AC-F9-1 (CI) | TC-SCAFFOLD-001, TC-SCAFFOLD-017, TC-SCAFFOLD-018, TC-SCAFFOLD-022, TC-SCAFFOLD-023, TC-SCAFFOLD-024, TC-SCAFFOLD-025 (CI half), TC-SCAFFOLD-026 (CI half), TC-SCAFFOLD-029 (CI half), TC-SCAFFOLD-037, TC-SCAFFOLD-038 |
| 9 — Full verification + recording | AC-F2-1, AC-F9-1 (e2e), AC-F13-1 (observed) | TC-SCAFFOLD-001, TC-SCAFFOLD-022, TC-SCAFFOLD-025, CI observations (023/029/037) |
| 10 — Finalize | all (DoD) | — (spec reconciliation + doc sync incl. AGENTS.md, glossary, cli-command-registry M0-S1 verification + DoD walkthrough) |

**Ticket-AC mapping** (spec §17): AC-1 → Phases 0+8+9 (TC-SCAFFOLD-001/017/022/023); AC-2 → Phases 1+4 (TC-SCAFFOLD-007–012, 016); AC-3 → Phases 1+6 (TC-SCAFFOLD-030/031/032). NFR-7 (CLI startup budget) is deferred by spec §7.3/DEC-5 — not a coverage gap.

## Artifacts and Links

| Artifact | Location | Type |
|----------|----------|------|
| Change specification (v1.1) | ./chg-GH-170-spec.md | Spec |
| Test plan (v1.3, 38 TCs) | ./chg-GH-170-test-plan.md | Test plan |
| Implementation plan | ./chg-GH-170-plan.md | Plan (this file) |
| Authoritative decision | [ADR-0003 — OSS Tooling Monorepo Structure](../../../decisions/ADR-0003-oss-monorepo-structure.md) | Decision record |
| Workspace foundation | `package.json`, `pnpm-workspace.yaml`, `pnpm-lock.yaml`, `.bun-version`, `.gitignore`, `bunfig.toml` | New/updated (P0) |
| Six packages | `packages/{core,adapters,cli,mcp,opencode,testkit}/**` | New (P1) |
| TS configs | `tsconfig.base.json`, `tsconfig.json`, `packages/*/tsconfig.json` | New (P2) |
| Biome + scripts | `biome.json`, root/package scripts | New (P3) |
| Boundary enforcement | `.dependency-cruiser.cjs`, `scripts/checks/ambient-globals.ts`, `scripts/checks/workspace-entrypoints.ts`, `tests/boundaries/**` | New (P4) |
| Commitlint + husky | `commitlint.config.js`, `.husky/commit-msg` | New (P5) |
| Publish path | `.changeset/config.json`, `.github/workflows/release.yml`, `scripts/checks/{exports-discipline,changesets-group,testkit-exclusion,publish-guard}.ts` | New (P6) |
| License registry | `doc/legal/dependency-licenses.yaml`, `scripts/checks/license-audit.ts` | New (P7) |
| CI fast loop | `.github/workflows/ci.yml` (additive), `scripts/checks/{pin-equality,ci-topology,ci-bindingness,ci-supply-chain,vulnerability-gate}.ts` | New/updated (P8) |
| Invariant checks | `scripts/checks/*.ts` (18 files: 17 TC-bound checks + the `ambient-globals.ts` guard wired into `check:boundaries`; `doc/changes/`-exempt, bash `scripts/*.sh` convention untouched) | New (P0–P8) |
| Reference (patterns only) | `marksync-for-confluence` — `package.json`, `tsconfig.json`, `.dependency-cruiser.cjs` | External (MIT; provenance notes per DEC-9) |

## Plan Revision Log

| Version | Date | Author | Changes |
|---------|------|--------|---------|
| 1.0 | 2026-10-29 | plan-writer | Initial plan — 11 phases (P0–P10); all 17 ACs and 38 TCs traced; OQ-T4 resolved (push-event commitlint = `origin/main-tools...HEAD` merge-base range); pins resolved at P0 per A-T6, not invented; boundary rules (P4) precede the CI boundary job (P8); fixture-coverage meta-check guards every rule incl. ambient ids. |
| 1.1 | 2026-10-29 | plan-writer | DoR iter-1 remediation (readiness-iter-1.md findings 1/2/3/7 mirrors): `matrix-adapters-importer` added to task 4.1 mirroring test plan v1.2 §4.1 verbatim (adapters→cli/mcp/opencode forbidden, alias + relative, `severity: 'error'`); task 4.4 fixture cases expanded (TC-008 adapters→surface cases + `./contracts` control; TC-009 whole-package root `.` case; TC-013 per-package probes); task 4.5 meta-check asserts the mandatory importer-rule set and the two `subpath-undeclared` cases incl. adapters-only deletion; P10 doc coverage expanded (10.1a–10.1d: AGENTS.md repo-structure + `scripts/checks/*.ts` exception note, glossary scaffold terms, cli-command-registry M0-S1 verification — all `@doc-syncer` lifecycle-phase-7 work); Artifacts count corrected 17→18 (`ambient-globals.ts` named); `@changesets/cli` devDep added to 6.4. TC count unchanged (38); Phase 4 traceability row unchanged; DEC range verified already DEC-1..DEC-11 (no stale ref in plan). |
| 1.2 | 2026-10-29 | plan-writer | DoR iter-2 remediation mirror (readiness-iter-2.md finding 1 + nits 3/4; test plan v1.3 §4.1): task 4.2 ambient-guard scope = ADR-0003 DEC-2 "Additional rules" bullet 6 neutrality set verbatim — `packages/core/src/index.ts` (the `.` entry) + `core/src/contracts/**` + `core/src/{domain,app,config,branding}/**` — with the ban list verbatim and the guard's self-scope assertion (TC-015 step 1); `ambient-env-branding` unchanged. Task 4.1 `runtime-apis-confinement` allowed set = the ADR sentence verbatim ("the `core ./state` driver code, the adapter I/O subpaths, the CLI build, and the OpenCode host integration"; CLI-build/OpenCode-host structural, behavioral controls deferred per A-T9, allowlist-shape asserted by TC-014 step 5); any other location forbidden. Task 4.4 mirrors test plan v1.3 counts: TC-008 7 forbidden + 4 new allowed-cell controls (cli/mcp/opencode/testkit-src→adapters/registry); TC-009 +15 allowed controls (surfaces→4 core subpaths, testkit→core `.`/`./contracts`, adapters→`./contracts`); TC-013 Case E root `e2e/`+`bdd/`→testkit passing fixture (synthetic, A-T10; 8 probes + 2 controls + 1 metadata); TC-014 allowlist-shape assertion; TC-015 Cases C+D + per-global sweep = 37 failing + 2 controls. Task 4.5 registry ambient expectations = full neutral set (TC-016 step 5). Test-plan references pinned to v1.3. Rule names unchanged; TC count unchanged (38); spec and test plan untouched. |

## Execution Log

| Phase | Status | Started | Completed | Commit | Notes |
|-------|--------|---------|-----------|--------|-------|
| 0 — Workspace foundation | COMPLETE | 2026-10-29T18:28Z | 2026-10-29T18:37Z | 8ee4430 | Pins resolved: pnpm 10.18.3 (preinstalled, exact), Bun 1.4.4 (official installer via `bun upgrade`). `pnpm install` + `--frozen-lockfile` exit 0, clean tree. `pnpm-foundation.ts`, `ignore-rules.ts` green. RSK-4 probe: undeclared workspace import REJECTED. Note: `pnpm-foundation.ts` treats an empty `packages/` as the transient pre-P1 state and enforces the six-package set from P1. |
| 1 — Six packages | COMPLETE | 2026-10-29T18:38Z | 2026-10-29T18:48Z | ff2c973 | Six private manifests, 25 types-only sources, full subpath/imports/workspaceImports maps, one `createRuntime` signature. `bun test tests/structure` 8 pass 0 fail (TC-004 dist half annotated pending P6 build); `manifest-privacy.ts` green; `pnpm-foundation.ts` six-package assertion green. `typescript@6.0.3` + `@types/bun@1.4.4` added here (AST structure tests need the compiler API; P2 reuses them). |
| 2 — Strict TypeScript | COMPLETE | 2026-10-29T18:49Z | 2026-10-29T19:02Z | 367599e | `tsconfig.base.json` carries all 17 asserted flags + declared `skipLibCheck` decision; six composite package configs; solution references all six. `pnpm typecheck` exit 0. `tsconfig-strictness.ts` green. `bun test tests/checks` 25 pass (17 flag-removal mutations, package-override mutation, 6 real tsc probes). |
| 3 — Biome + script surface | COMPLETE | 2026-10-29T19:03Z | 2026-10-29T19:12Z | b0e6492 | `biome.json` (preset recommended; fixture overrides only for intentional probe lint noise) + `@biomejs/biome@2.6.4`; five named scripts at root and in all six packages, one aggregate in the mandated order; `dependency-cruiser@18.7.0` installed for P4. `pnpm lint` + `pnpm format:check` exit 0 (62 files); `script-surface.ts` green; `pnpm test` 34 pass. `pnpm check` aggregate deferred to P4 (depcruise config lands there, as planned). |
| 4 — Boundaries + fixtures | COMPLETE | 2026-10-29T19:13Z | 2026-10-29T19:40Z | 35657b3 | `.dependency-cruiser.cjs` with 20 error-severity rule ids (5 matrix, 3 subpath, deep + 6 relative entries, 5 tier, 2 testkit, runtime confinement w/ ADR-verbatim 4-location allowlist); `ambient-globals.ts` (ADR neutral set, exported scope, branding rule id) wired into `check:boundaries`; `workspace-entrypoints.ts` green. Fixtures: 76 registered cases (39 depcruise + 37 ambient) + 19 clean-cruise controls; registry meta-check incl. targeted adapters deletion and warn-severity mutation. `bun test tests/boundaries` 101 pass; `pnpm check` green end-to-end (135 tests, 61s). Deviation: fixtures are committed case definitions materialized in `mkdtemp` (one temp dir per case) rather than one physical directory per case; behaviour and registry contract unchanged. `#contracts` alias added to core imports to make the TC-011 allowed-edge control resolvable. |
| 5 — commitlint + husky | COMPLETE | 2026-10-29T19:41Z | 2026-10-29T19:52Z | e350a73 | One root ESM `commitlint.config.js` (`@commitlint/config-conventional`), `@commitlint/cli@21.2.4`, `husky@9.1.7`, root `prepare`; `.husky/commit-msg` warns via the local binary (no `npx`/network) and ends `exit 0`. `commitlint-authority.ts` green (config + malformed/conventional mutation round-trip; CI-job assertions activate in P8). `bun test tests/behaviour/commit-msg-hook.test.ts` green: valid commit ok, malformed commit NOT blocked, hook offline under dead proxies, tree clean. |
| 6 — Build / exports / guard / changesets | COMPLETE | 2026-10-29T19:53Z | 2026-10-29T20:12Z | 1c16723 | `tsc` build emits `dist/` for all six; TC-004 dist assertions now active and green (structure walkers exclude `dist`). `exports-discipline.ts`, `changesets-group.ts`, `testkit-exclusion.ts` green. publint clean on all five; attw under the recorded `--profile esm-only` allowance (node10 + CJS-from-Node16 results are the deliberate no-CJS allowance; ESM/from-ESM and bundler are green). `.changeset/config.json` fixed group of five, `privatePackages: {version:false,tag:false}`, `@changesets/cli@3.0.3`. `publish-guard.ts` fails live with "still private" (expected); `bun test tests/checks` 29 pass incl. one-flip + all-flip/branded pass + release wiring. `release.yml` is `workflow_dispatch` only, guard job precedes publish via `needs`, Bun pin copy 4 = 1.4.4, actions SHA-pinned. |
| 7 — License registry + audit | COMPLETE | 2026-10-29T20:13Z | 2026-10-29T20:24Z | b31cc4b | `doc/legal/dependency-licenses.yaml` seeds all 11 direct external dev dependencies with exact versions, SPDX identifiers, `source: dev-dependency`, and approved verdicts (owner C-2 confirmation is a PR-review manual step); workspace `workspace:*` links are local and out of registry scope (A-T5). `license-audit.ts` parses SPDX with AND/OR/parentheses, fails closed on unknown refs, non-allow-listed branches, removed entries, and empty licenses; allow-list must equal the approved-verdict set. `bun test tests/checks/license-audit.test.ts` 9 pass. |
| 8 — CI fast loop | COMPLETE | 2026-10-29T20:26Z | 2026-10-29T21:05Z | self | 15 additive `ts-*` jobs in `ci.yml` (fresh-clone, invariants, typecheck, lint, format, test, boundaries, build→exports/publint/attw, pins, publish-guard test, license audit, vuln, aggregate, commitlint with PR-base + `origin/main-tools...HEAD` ranges). Bash job blocks byte-untouched (`ci-topology` diff = additions only). `pin-equality.ts` (four copies + CI runtime cross-check), `ci-topology.ts` (incl. no-orphan-check wiring), `ci-bindingness.ts`, `ci-supply-chain.ts`, `vulnerability-gate.ts` green; mutations in `tests/checks/ci-checks.test.ts` all fail by name. `bun test tests/checks` 48 pass; `pnpm audit` 0 high/critical. RSK-2: 22 CI-safe bash suites pass in a clean clone of the branch (3 paid-API/performance suites are excluded by the unchanged `bash-tests` job). Deviation: Bun pin copy 3 is a workflow-level `env.BUN_VERSION` (one CI copy) rather than a job matrix; pin-equality enforces it as the single CI location. Note: `test-ceo-loop.sh` fails only in the working tree because this very delivery's `.ai/local/delivery/delivering` marker is live; the same suite passes 54/54 in a clean clone. |

### Completion report format (filled by @coder at P9/P10)

```markdown
## GH-170 execution report
- Resolved pins: pnpm <exact> (install: <method>), Bun <exact> (install: <method>; RSK-5 fallback used: no|yes — <why>)
- RSK-4 pnpm isolation verification: <rejects undeclared imports | does NOT reject — recorded observation; boundary rules sole gate>
- Fresh-clone aggregate check: <duration>, exit 0; clean tree after suite: yes
- CI run: <URL or run id> — all ts-* jobs green; bash job conclusions unchanged
- Per phase: <phase> — commit <hash> <subject> | verification: <commands + exit codes> | deviations: none | <list>
- Deviations from plan: none | <item — reason — approval>
```
