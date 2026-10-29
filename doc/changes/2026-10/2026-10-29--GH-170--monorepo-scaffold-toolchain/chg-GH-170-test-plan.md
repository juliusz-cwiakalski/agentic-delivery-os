---
id: chg-GH-170-test-plan
status: Updated
created: 2026-10-29T00:00:00Z
last_updated: 2026-10-29T16:33:38Z
owners: ["Juliusz Ćwiąkalski"]
service: delivery-os
labels: ["oss-tooling", "monorepo", "m0", "toolchain", "adr-0003"]
version_impact: minor
summary: "Verify the six-package pnpm monorepo scaffold as structure-over-content: every declared subpath and export resolves, every ADR-0003 DEC-2 forbidden edge is mechanically rejected and proven by a failing negative fixture, pins and gates are enforced, and the aggregate check is green from a fresh clone beside an untouched bash CI stack."
links:
  change_spec: ./chg-GH-170-spec.md
  implementation_plan: null
  testing_strategy: ../../../../.ai/rules/testing-strategy.md
---

# Test Plan - M0-S1: Six-package monorepo scaffold and toolchain (ADR-0003)

## 1. Scope and Objectives

This scaffold ships no business behavior, so the tests do not test business behavior. They prove three things, and only three: **structure** (every declared subpath exists, every export resolves, one `createRuntime` signature, nothing else), **enforcement** (every ADR-0003 DEC-2 forbidden edge is rejected, each with a failing fixture, in both alias and relative form), and **CI green** (one aggregate `check` from a fresh clone, binding, beside the untouched bash stack).

The integrity risks guarded here are silent boundary decay (a rule that no longer fires), unenforced rules (a rule with no fixture), accidental pre-freeze publication, `src`-targeted exports, pin drift between local and CI, and a TypeScript pipeline that weakens or shadows the existing bash gates.

### 1.1 In Scope

- Workspace structure and resolution: six packages, all F-1 subpaths, `createRuntime` declared exactly once, empty-but-enforced content policy.
- Boundary enforcement and its negative-fixture proof for every forbidden rule family (package matrix, core subpath permissions, core tiers in alias *and* relative form, testkit dev edges, runtime-API confinement incl. ambient globals).
- Toolchain invariants: pnpm pin + single lockfile, four-copy Bun pin equality, strict TS flag set, script surface with exactly one aggregate `check`, exports discipline (`dist` + `types`), publint/attw/package-export checks.
- Publish safety: six `private: true` manifests, pre-freeze publish guard, changesets fixed group of exactly five.
- CI properties: additive binding TypeScript jobs, bindingness (no `continue-on-error`, no `|| true`, no advisory job), bash jobs byte-unchanged and green, SHA-pinned actions with job-scoped permissions.
- DEC-10 license-registry seed and minimal fail-closed audit; the vulnerability gate (NFR-10); ignore-rule additions (F-14).
- Fresh-clone e2e: clone → install → aggregate check (ticket AC-1).

### 1.2 Out of Scope & Known Gaps

- [OUT] Business behavior, engines, provider adapters, ports beyond the placeholder `createRuntime` signature — none exist (spec §5.1, NG-1..NG-5).
- [OUT] Branding values, forbidden-literal test, rename drill (NG-1/M0-S2). `./branding` is tested as structure only.
- [OUT] Result contract, config layer, state drivers (NG-2..NG-4). Driver *choice* (`node:sqlite`) is a recorded decision, not a testable artifact.
- [OUT] Publication, `.mcpb` packaging mechanics, binary build (NG-6; DEC-2 records form only).
- [OUT] Internals of existing bash scripts/tools — they are treated as an untouched, authoritative black box (NG-9). Only their non-regression is asserted.
- [OUT] NFR-7 CLI startup budget — no binary exists at scaffold; explicitly deferred by spec §7.3 and DEC-5 to the first release smoke.
- [OUT] Runtime-portability smoke, packed-artifact import test, Node import smoke — deferred by spec §7.3 to the first contract content.
- [RESOLVED — OQ-T1, closed 2026-10-29] `attw` (`@arethetypeswrong/cli`) is required by spec v1.1 (F-10, AC-F10-1, NFR-6) and DEC-11, as well as ADR-0003 DEC-3. TC-SCAFFOLD-029 now asserts publint + attw + the package-export check in one job that runs after `build`. No coverage gap remains.

## 2. References

- **Change specification**: [chg-GH-170-spec.md](./chg-GH-170-spec.md) — F-1..F-14, DM-1..DM-4, NFR-1..NFR-10, RSK-1..RSK-6, DEC-1..DEC-10, AC-F1-1..AC-F14-1, §17 ticket-AC mapping.
- **Implementation plan**: `./chg-GH-170-plan.md` (authored in the following phase, delivery_planning) — task/phase IDs are bound there; TC IDs here are behaviour-bound and do not depend on task numbering.
- **Testing strategy**: [.ai/rules/testing-strategy.md](../../../../.ai/rules/testing-strategy.md) — canonical for docs and bash layers; the TypeScript layer is defined in §4 of this plan (A-T3).
- **Authoritative decision**: [ADR-0003 — OSS Tooling Monorepo Structure](../../../decisions/ADR-0003-oss-monorepo-structure.md) — DEC-1 (package set), DEC-2 (matrices + fixtures + enforcement), DEC-3 (toolchain, pins, exports, publint, attw), C-2/C-7/C-10 (license registry, publish guard, supply chain).
- **Repo conventions**: [AGENTS.md](../../../../AGENTS.md) — branch model, license-header rule (`doc/changes/` gets none), bash test layout `scripts/.tests/` + `tools/.tests/`.
- **Reference implementation (patterns only)**: `marksync-for-confluence` — `bun test` harness, `bunfig.toml` test root, `package.json` `imports` aliases, `.dependency-cruiser.cjs` alias-resolving rules and its ephemeral negative-probe pattern (adapted here to temp-dir fixtures).

## 3. Coverage Overview

### 3.1 Functional Coverage (F-#, AC-#)

| AC ID | Description (abbreviated) | TC ID(s) | Status |
|-------|---------------------------|----------|--------|
| AC-F2-1 | Fresh clone installs reproducibly from the committed lockfile under the pinned package manager | TC-SCAFFOLD-001, TC-SCAFFOLD-002 | Covered |
| AC-F9-1 | One aggregate check passes lint/format/typecheck/test/boundary green, no manual steps, no bypass | TC-SCAFFOLD-022, TC-SCAFFOLD-021 | Covered |
| AC-F13-1 | TS fast-loop jobs binding; existing bash jobs run unchanged and authoritative | TC-SCAFFOLD-023, TC-SCAFFOLD-024, TC-SCAFFOLD-025 | Covered |
| AC-F3-1 | Four Bun pin copies identical; check fails on divergence | TC-SCAFFOLD-017, TC-SCAFFOLD-018 | Covered |
| AC-F1-1 | Declared subpath resolves; undeclared subpath (e.g. `adapters`→`core ./state`) rejected | TC-SCAFFOLD-007, TC-SCAFFOLD-009 | Covered |
| AC-F1-2 | Every subpath exists, every export resolves, `createRuntime` once, no engines/business/drivers | TC-SCAFFOLD-004, TC-SCAFFOLD-005, TC-SCAFFOLD-006 | Covered |
| AC-F5-1 | Tier violation fails in alias form **and** relative form | TC-SCAFFOLD-011, TC-SCAFFOLD-012 | Covered |
| AC-F6-1 | Forbidden cross-package edge (e.g. `cli`→`mcp`, deep/relative escape) fails the build | TC-SCAFFOLD-008, TC-SCAFFOLD-010, TC-SCAFFOLD-014 | Covered |
| AC-F7-1 | Every forbidden rule has ≥1 failing fixture; a rule without one fails the check | TC-SCAFFOLD-013, TC-SCAFFOLD-016 | Covered |
| AC-F4-1 | Solution typecheck clean under the full strict flag set; fails on flag regression | TC-SCAFFOLD-019, TC-SCAFFOLD-020 | Covered |
| AC-F8-1 | Five named scripts at root and per package; exactly one aggregate check | TC-SCAFFOLD-021 | Covered |
| AC-F8-2 | Hook offline, non-mutating; CI commitlint is sole authority | TC-SCAFFOLD-026, TC-SCAFFOLD-027 | Covered |
| AC-F10-1 | Exports → `dist` + `types`, never `src`; publint + attw + package-export check pass | TC-SCAFFOLD-028, TC-SCAFFOLD-029 | Covered |
| AC-F11-1 | All six manifests `private: true` | TC-SCAFFOLD-030 | Covered (script check) |
| AC-F11-2 | Publish guard fails pre-freeze; nothing published | TC-SCAFFOLD-031 | Covered |
| AC-F12-1 | Fixed group = exactly five publishables, `testkit` excluded | TC-SCAFFOLD-032, TC-SCAFFOLD-033 | Covered |
| AC-F14-1 | Ignore rules cover workspace deps, dist, local state, brand-free config glob | TC-SCAFFOLD-034 | Covered (script check) |

**Capability coverage** (no AC left unlinked): F-1 → 004/005/006/007; F-2 → 001/002/003; F-3 → 017/018; F-4 → 019/020; F-5 → 011/012; F-6 → 007/008/009/010/014/015; F-7 → 013/016; F-8 → 021/024/026/027; F-9 → 021/022; F-10 → 004/028/029; F-11 → 030/031; F-12 → 032/033; F-13 → 023/024/025/037/038; F-14 → 034.

**Ticket AC coverage** (spec §17 mapping):

| Ticket AC | Verified by | Notes |
|-----------|-------------|-------|
| AC-1 fresh clone green | TC-SCAFFOLD-001, 017, 022, 023 | Install, pin, aggregate check, CI parity — one chain, no manual steps |
| AC-2 forbidden edge blocked | TC-SCAFFOLD-007, 008, 009, 010, 011, 012, 016 | Both alias and relative form; fixture proves the rule fires |
| AC-3 publish blocked pre-freeze | TC-SCAFFOLD-030, 031, 032 | Manifest lock + release-job guard + fixed-group shape |

**Verification-by-inspection ACs (justified).** AC-F11-1 and AC-F14-1 assert repository file invariants with no runtime code path; they are verified by deterministic **script checks** (TC-SCAFFOLD-030, 034) rather than unit tests — a unit test would add a framework dependency without adding signal. AC-F12-1 (TC-032) is likewise a config-shape assertion. All three checks exit non-zero on violation and are wired into the aggregate check, so they are gates, not review notes.

### 3.2 Interface Coverage (API-#, EVT-#, DM-#)

No REST/EVT surfaces exist at scaffold (spec §8.1, §8.2).

| Interface ID | Description | TC ID(s) | Status |
|--------------|-------------|----------|--------|
| DM-1 | Workspace foundation: workspace globs, private root manifest, exact `packageManager`, one committed lockfile | TC-SCAFFOLD-001, 002, 034 | Covered |
| DM-2 | Exports maps as public contract (`dist` + `types`, never `src`) | TC-SCAFFOLD-004, 028, 029 | Covered |
| DM-3 | Declared entrypoints per importer, read by the boundary rules | TC-SCAFFOLD-007, 011 | Covered |
| DM-4 | Runtime/toolchain pins (four Bun copies + pnpm pin) | TC-SCAFFOLD-017, 018, 002 | Covered |

### 3.3 Non-Functional Coverage (NFR-#)

| NFR ID | Requirement | TC ID(s) | Status |
|--------|-------------|----------|--------|
| NFR-1 | Fresh-clone fast loop, 0 manual steps (duration provisional ≤10 min) | TC-SCAFFOLD-022 | Covered; duration recorded, re-baselined per OQ-T3 |
| NFR-2 | 0 boundary violations per PR | TC-SCAFFOLD-007, 008, 009, 010, 011, 012, 014, 015 | Covered |
| NFR-3 | 1+ failing fixture per forbidden rule; missing fixture fails | TC-SCAFFOLD-016 | Covered |
| NFR-4 | Pin equality (4 Bun copies + pnpm pin + frozen lockfile) | TC-SCAFFOLD-001, 002, 017, 018 | Covered |
| NFR-5 | Solution typecheck clean under full strict flag set | TC-SCAFFOLD-019, 020 | Covered |
| NFR-6 | Exports discipline, 100% `dist` + `types`, publint + attw pass | TC-SCAFFOLD-028, 029 | Covered |
| NFR-7 | CLI startup ≤ 200 ms | — | **Deferred** — no binary at scaffold; measured at first release smoke (spec §7.3, DEC-5). Not a gap. |
| NFR-8 | Existing bash test/CI results no regression; still authoritative | TC-SCAFFOLD-023, 025 | Covered |
| NFR-9 | Commit-msg hook offline, non-mutating, never blocks | TC-SCAFFOLD-027 | Covered |
| NFR-10 | Vulnerability gate: 0 high/critical on the new dependency set | TC-SCAFFOLD-037 | Covered |

## 4. Test Types and Layers

Two runners, deliberately separated. **`bun test`** owns everything that needs a TypeScript runtime, fixtures, or assertions (structure, boundary fixtures, isolation probe). **`bun run scripts/checks/*.ts`** owns repository invariants where the "assertion" is really "a gate that must exit non-zero" (pins, exports, publish guard, license audit, CI topology, ignores). **`bash scripts/.tests/test-*.sh` / `bash tools/.tests/test-*.sh`** remains the existing bash layer and is only *run*, never extended, by this change.

| Layer | Runner / invocation | Location | Covers |
|-------|--------------------|----------|--------|
| Bun unit/smoke tests | `bun test tests/structure` | `tests/structure/**` | 004–007 |
| Boundary negative-fixture suite | `bun test tests/boundaries` | `tests/boundaries/**` + `tests/boundaries/fixtures/**` | 008–016 |
| Repository invariant checks | `bun run scripts/checks/*.ts` | `scripts/checks/*.ts` (A-T1) | 002, 017–021, 026, 028, 030–038 |
| Mutation checks (negative probes) | same check, mutated temp copy | temp dirs only | 018, 020, 031 (guard), 036 |
| Local behaviour probe | `bun test` + git in a scratch repo | `tests/behaviour/**` | 003, 027 |
| CI job check | workflow YAML static assertions + observed run | `.github/workflows/ci.yml` | 023, 024, 025, 038 |
| e2e-clone | CI job (`fresh-clone`) and the documented local sequence | repo root | 001, 022 |
| Bash non-regression | `bash scripts/.tests/test-*.sh`, `bash tools/.tests/test-*.sh` | unchanged | 025 |
| Manual | PR review (license verdicts, C-2 determination) | — | 035 (verdict recording only) |

**Fixture harness contract (used by 008–015).** Each case runs in a throwaway workspace under `mkdtemp`: (1) the harness materialises `packages/*/` from the fixture directory, (2) copies the **production** `.dependency-cruiser.cjs` verbatim into the temp root, (3) symlinks fixture packages into the temp `node_modules/@delivery-os/` so package-name and subpath imports resolve exactly as in the real workspace, (4) runs `depcruise packages --output-type json` with `cwd` = temp root. A case passes when the **expected rule name** appears in `summary.violations` and the process exits non-zero. Before injecting the violation the harness cruises the clean fixture and requires zero violations, so an over-broad rule cannot pass by failing everything. No probe is ever written into the live tree (deliberate divergence from marksync's ephemeral `src/` probe; see RSK-T3).

**Rule granularity** (keeps fixture count proportional): one `forbidden` entry per importer class — package matrix per importer package, core tiers per tier (allowed set expressed with `pathNot`), subpath permissions per importer, plus testkit edges, runtime confinement, and the ambient-global guard. Every such entry needs ≥1 fixture case (TC-016).

**CI invocation order** (matters: exports, publint, and attw read `dist`): `install` → `typecheck` / `lint` / `format:check` / `test` / `boundaries` (parallel, after install) → `build` → `exports` + `publint` + `attw` → `pins` → `publish-guard` → `license-audit` → `vulnerability-gate` → aggregate `check`. Each job runs its own install with the frozen lockfile; no job depends on artefacts from another job's workspace.

### 4.1 Forbidden Rule → Fixture → TC Matrix

Rule names below are the names the root configuration must use; the fixture registry keys on them (TC-016), so a rename without a fixture update fails the check.

| Rule family | Rule name(s) | Violating case(s) | TC |
|-------------|--------------|-------------------|-----|
| Package matrix | `matrix-core-importer`, `matrix-cli-importer`, `matrix-mcp-importer`, `matrix-opencode-importer` | `cli`→`mcp`; `mcp`→`opencode`; `core`→`adapters`; `opencode`→`cli` | 008 |
| Core subpath permissions | `subpath-adapters-core-state`, `subpath-adapters-core-branding`, `subpath-undeclared` | `adapters`→`core ./state`; `adapters`→`core ./branding`; importer→subpath absent from its declaration | 009 |
| Deep / relative cross-package | `no-deep-package-import`, `no-relative-cross-package-import` | `@delivery-os/core/src/domain/x`; `../../core/src/domain/x`; `../../../adapters/src/registry` | 010 |
| Core tiers — alias form | `tier-domain-only-contracts`, `tier-config-only-contracts`, `tier-branding-only-contracts`, `tier-app-allowed-set`, `tier-state-allowed-set` | `#domain/*`→`#app/*`; `#domain/*`→`#state/*`; `#config/*`→`#domain/*`; `#branding/*`→`#app/*`; `#app/*`→`#branding/*`; `#app/*`→`#state/*` | 011 |
| Core tiers — relative form | same five rule names | identical edges written as `../app/...`, `./state/...`, `../../branding/...` | 012 |
| testkit dev edges | `testkit-no-production-import`, `testkit-no-surface-import` | `packages/cli/src/x.ts`→`testkit`; `testkit/src/x.ts`→`cli`; (control: `packages/*/test/*.test.ts`→`testkit` clean) | 013 |
| Runtime-API confinement | `runtime-apis-confinement` | `node:fs` in `core/src/domain`; `bun:*` in `core/src/config`; `node:sqlite` outside `core/src/state` | 014 |
| Ambient globals | `ambient-globals-neutral-tiers`, `ambient-env-branding` | `process.env.X` / `Bun.env.X` in `core/src/branding`; `process`, `Bun`, `Deno`, `setTimeout`, `fetch` in `domain`/`app`/`config`/`branding` | 015 |

## 5. Test Scenarios

### 5.1 Scenario Index

| TC ID | Title | Type | Impact | Priority | AC Coverage |
|-------|-------|------|--------|----------|-------------|
| TC-SCAFFOLD-001 | Fresh-clone install from committed lockfile (e2e-clone) | Happy Path | Critical | High | AC-F2-1, NFR-4 |
| TC-SCAFFOLD-002 | pnpm pin, single lockfile, no isolation-weakening settings | Script check | Critical | High | AC-F2-1, DM-1, DM-4 |
| TC-SCAFFOLD-003 | pnpm isolation rejects an undeclared workspace import | Edge Case | Important | Medium | F-2, RSK-4 |
| TC-SCAFFOLD-004 | Declared subpaths exist and every export resolves from `dist` | Happy Path | Critical | High | AC-F1-2, DM-2 |
| TC-SCAFFOLD-005 | `createRuntime` declared exactly once | Happy Path | Critical | High | AC-F1-2 |
| TC-SCAFFOLD-006 | Empty-but-enforced content inventory | Negative | Critical | High | AC-F1-2 |
| TC-SCAFFOLD-007 | Declared-entrypoint check: allowed edges resolve, undeclared edges recorded | Happy Path | Critical | High | AC-F1-1, DM-3 |
| TC-SCAFFOLD-008 | Negative fixtures: package matrix edges | Negative | Critical | High | AC-F6-1, NFR-2 |
| TC-SCAFFOLD-009 | Negative fixtures: core subpath permissions (`adapters`→`./state`, `./branding`) | Negative | Critical | High | AC-F1-1, NFR-2 |
| TC-SCAFFOLD-010 | Negative fixtures: deep and relative cross-package imports | Negative | Critical | High | AC-F6-1, NFR-2 |
| TC-SCAFFOLD-011 | Negative fixtures: core tier violations, alias form | Negative | Critical | High | AC-F5-1, NFR-2 |
| TC-SCAFFOLD-012 | Negative fixtures: core tier violations, relative form | Negative | Critical | High | AC-F5-1, NFR-2 |
| TC-SCAFFOLD-013 | Negative fixtures: testkit dev edges + passing control | Negative | Critical | High | AC-F7-1, NFR-2 |
| TC-SCAFFOLD-014 | Negative fixtures: runtime-API confinement | Negative | Critical | High | AC-F6-1, NFR-2 |
| TC-SCAFFOLD-015 | Negative fixtures: ambient globals in neutral tiers | Negative | Critical | High | AC-F6-1, NFR-2 |
| TC-SCAFFOLD-016 | Fixture-coverage meta-check + positive controls | Negative | Critical | High | AC-F7-1, NFR-3 |
| TC-SCAFFOLD-017 | Bun four-copy pin equality (incl. installed-runtime cross-check) | Happy Path | Critical | High | AC-F3-1, NFR-4, DM-4 |
| TC-SCAFFOLD-018 | Pin-equality check fails on any divergence | Negative | Critical | High | AC-F3-1 |
| TC-SCAFFOLD-019 | Strict TS flag set asserted; solution typecheck clean | Happy Path | Critical | High | AC-F4-1, NFR-5 |
| TC-SCAFFOLD-020 | Typecheck fails on strict-flag regression | Negative | Important | High | AC-F4-1 |
| TC-SCAFFOLD-021 | Script surface: five named checks at both levels, one aggregate | Happy Path | Critical | High | AC-F8-1, F-9 |
| TC-SCAFFOLD-022 | Aggregate check green on a fresh clone, no bypass flags (e2e-clone) | Happy Path | Critical | High | AC-F9-1, NFR-1 |
| TC-SCAFFOLD-023 | CI topology: binding TS jobs beside byte-unchanged bash jobs | Happy Path | Critical | High | AC-F13-1, NFR-8 |
| TC-SCAFFOLD-024 | CI gate bindingness scan | Negative | Critical | High | AC-F13-1, F-8 |
| TC-SCAFFOLD-025 | Bash non-regression: existing suites and jobs unchanged and green | Regression | Critical | High | NFR-8, AC-F13-1 |
| TC-SCAFFOLD-026 | Commitlint is the CI authority | Happy Path | Important | High | AC-F8-2 |
| TC-SCAFFOLD-027 | Commit-msg hook: offline, non-mutating, non-blocking | Edge Case | Important | High | AC-F8-2, NFR-9 |
| TC-SCAFFOLD-028 | Exports discipline: `dist` + `types`, never `src` | Script check | Critical | High | AC-F10-1, NFR-6, DM-2 |
| TC-SCAFFOLD-029 | publint + attw + package-export check pass for the five publishables | Happy Path | Critical | High | AC-F10-1, NFR-6 |
| TC-SCAFFOLD-030 | All six manifests declare `private: true` | Script check | Critical | High | AC-F11-1 |
| TC-SCAFFOLD-031 | Publish guard fails pre-freeze and is wired unskippably | Negative | Critical | High | AC-F11-2 |
| TC-SCAFFOLD-032 | Changesets fixed group covers exactly five publishables | Script check | Critical | High | AC-F12-1 |
| TC-SCAFFOLD-033 | `testkit` absent from every published dependency graph | Script check | Important | High | AC-F12-1, F-12 |
| TC-SCAFFOLD-034 | Ignore rules incl. brand-free project-local glob | Script check | Important | High | AC-F14-1, DM-1 |
| TC-SCAFFOLD-035 | License registry seed covers the scaffold dev-dependency set | Script check | Critical | High | DEC-10, C-2 |
| TC-SCAFFOLD-036 | License audit fails closed (unknown, non-allowlisted, compound) | Negative | Critical | High | DEC-10, F-13 |
| TC-SCAFFOLD-037 | Vulnerability gate on the scaffold dependency set | Script check | Important | High | NFR-10, F-13 |
| TC-SCAFFOLD-038 | CI supply-chain hygiene: SHA-pinned actions, job-scoped permissions | Script check | Important | Medium | F-13, C-10 |

### 5.2 Scenario Details

#### TC-SCAFFOLD-001 - Fresh-clone install from committed lockfile (e2e-clone)

**Scenario Type**: Happy Path
**Impact Level**: Critical
**Priority**: High
**Related IDs**: F-2, AC-F2-1, DM-1, DM-4, NFR-4, NFR-1
**Test Type(s)**: E2E
**Automation Level**: Automated
**Target Layer / Location**: CI job `fresh-clone`; local equivalent is the documented clone-install sequence
**Tags**: @e2e-clone, @install, @ci

**Preconditions**:
- Branch pushed with `pnpm-lock.yaml` committed and `.npmrc`/workspace files present.
- Runner has network access to the registry (install only).

**Steps**:
1. Clone the branch into an empty directory (no pre-existing `node_modules`, no global workspace state).
2. Install pnpm and Bun from the pinned sources only (`packageManager` field, `.bun-version`); no version overrides.
3. Run `pnpm install --frozen-lockfile`.
4. Verify the install exits 0, produces one lockfile, and mutates no committed file (`git status --porcelain` empty).
5. Record the resolved pnpm/Bun versions in the change/PR (spec §18).

**Expected Outcome**:
- Install succeeds from the committed lockfile with zero manual steps and no lockfile rewrite.
- Working tree is clean after install.
- Resolved versions match the recorded pins.

#### TC-SCAFFOLD-002 - pnpm pin, single lockfile, no isolation-weakening settings

**Scenario Type**: Happy Path
**Impact Level**: Critical
**Priority**: High
**Related IDs**: F-2, AC-F2-1, DM-1, DM-4, NFR-4
**Test Type(s)**: Script check
**Automation Level**: Automated
**Target Layer / Location**: `scripts/checks/pnpm-foundation.ts`; root `package.json`, `.npmrc`, workspace file
**Tags**: @pin, @workspace, @gate

**Preconditions**:
- Root manifest and workspace definition committed.

**Steps**:
1. Assert root `package.json` `packageManager` is an exact `pnpm@x.y.z` pin (no range, no `latest`, no caret/tilde).
2. Assert exactly one `pnpm-lock.yaml` exists in the repo and it is committed (not git-ignored).
3. Assert the workspace definition lists the six packages and no others.
4. Assert no `hoist-pattern`, `shamefully-hoist`, or `node-linker` setting weakens isolation, and no `.npmrc` entry disables the frozen-lockfile behaviour.

**Expected Outcome**:
- Check exits 0; any violation exits non-zero with the offending field named.
- Root manifest declares `private: true`.

#### TC-SCAFFOLD-003 - pnpm isolation rejects an undeclared workspace import

**Scenario Type**: Edge Case
**Impact Level**: Important
**Priority**: Medium
**Related IDs**: F-2, RSK-4, NFR-2
**Test Type(s)**: Integration
**Automation Level**: Automated (temp workspace)
**Target Layer / Location**: `tests/behaviour/pnpm-isolation.test.ts`
**Tags**: @isolation, @assumption, @record

**Preconditions**:
- A temp copy of the workspace with a package whose manifest does **not** declare a workspace dependency it imports.

**Steps**:
1. Copy the workspace skeleton to a temp dir; add a source file importing an undeclared sibling package.
2. Run `pnpm install --frozen-lockfile=false --ignore-scripts` then the package's typecheck/build.
3. Record whether resolution fails.
4. Record the observed result in the change/PR as the ADR ASSUMPTION verification (spec §18, ADR DEC-2).

**Expected Outcome**:
- The undeclared import fails to resolve (install or build) — assumption confirmed.
- If isolation does **not** reject it, the test records that as an explicit, non-failing observation and the boundary rules remain the sole gate (ADR: the rules do not depend on isolation). Result must be recorded, not silently skipped.

#### TC-SCAFFOLD-004 - Declared subpaths exist and every export resolves from `dist`

**Scenario Type**: Happy Path
**Impact Level**: Critical
**Priority**: High
**Related IDs**: F-1, F-10, AC-F1-2, DM-2
**Test Type(s)**: Integration
**Automation Level**: Automated
**Target Layer / Location**: `tests/structure/subpaths.test.ts`; `packages/*` manifests + `dist`
**Tags**: @structure, @exports, @build

**Preconditions**:
- `pnpm build` has run (exports resolve through `dist`).

**Steps**:
1. Read the expected subpath inventory: `core` → `.`, `./contracts`, `./state`, `./branding`; `adapters` → `./gitlab`, `./jira`, `./github`, `./azure`, `./ci`, `./registry`, `./repo`, `./file`, `./host`, `./session`, `./legacy`; `cli`, `mcp`, `opencode`, `testkit` → `.` (plus any surface subpaths the plan declares).
2. Diff the inventory against each package's `exports` keys; fail on missing **and** on extra keys.
3. Assert each declared subpath maps to an existing file in `dist`, and that `git ls-files` shows a source file for it (no export pointing at a non-existent placeholder).
4. Dynamically import every declared subpath through its package name and assert it loads.

**Expected Outcome**:
- Every declared subpath exists and imports successfully.
- No undeclared subpath is exported; no exported subpath lacks a file.

#### TC-SCAFFOLD-005 - `createRuntime` declared exactly once

**Scenario Type**: Happy Path
**Impact Level**: Critical
**Priority**: High
**Related IDs**: F-1, AC-F1-2
**Test Type(s)**: Unit
**Automation Level**: Automated
**Target Layer / Location**: `tests/structure/create-runtime.test.ts`; `packages/core/src/**`
**Tags**: @structure, @composition-root

**Preconditions**:
- Core sources committed.

**Steps**:
1. Scan `packages/core/src/**` for a `createRuntime` declaration (exported function/const signature).
2. Assert exactly one declaration exists, in the composition-root module, exported from `core` `.`.
3. Assert its parameter shape accepts `{ config, adapters, store, clock }` (structural type assertion, not implementation).
4. Assert no other package declares a `createRuntime` and no package wires adapters itself.

**Expected Outcome**:
- Exactly one declaration, exported once, signature matches the spec.
- Zero declarations elsewhere; calling it is not required (no implementation yet).

#### TC-SCAFFOLD-006 - Empty-but-enforced content inventory

**Scenario Type**: Negative
**Impact Level**: Critical
**Priority**: High
**Related IDs**: F-1, AC-F1-2
**Test Type(s)**: Unit
**Automation Level**: Automated
**Target Layer / Location**: `tests/structure/content-inventory.test.ts`; inventory manifest + AST scan
**Tags**: @structure, @empty-but-enforced

**Preconditions**:
- Package sources committed.

**Steps**:
1. Read the declared file inventory (one list per package) from the structure check's manifest.
2. Assert the actual source file set equals the inventory — any extra file fails.
3. AST-scan every inventoried file: only type declarations, re-exports, and the single `createRuntime` signature are permitted; fail on any other callable export or top-level side-effecting statement.
4. Assert no engine/driver markers: no `node:sqlite`/SQLite driver import, no provider SDK dependency in any manifest, no `.mcpb` server entry, no CLI command registration.

**Expected Outcome**:
- File set matches the inventory; no executable content beyond the declared signature.
- Any added implementation file or callable export fails with the file path named.
- Inventory completeness is a review obligation at PR (RSK-T7).

#### TC-SCAFFOLD-007 - Declared-entrypoint check: allowed edges resolve, undeclared edges recorded

**Scenario Type**: Happy Path
**Impact Level**: Critical
**Priority**: High
**Related IDs**: F-1, F-6, AC-F1-1, DM-3, NFR-2
**Test Type(s)**: Script check
**Automation Level**: Automated
**Target Layer / Location**: `scripts/checks/workspace-entrypoints.ts`
**Tags**: @manifest, @declared-entrypoints, @gate

**Preconditions**:
- All six manifests and the boundary configuration committed.

**Steps**:
1. Extract every workspace import from `packages/*/src/**` and test files.
2. For each, assert the imported package **and** subpath appear in the importer's declared entrypoints (the same declarations the boundary rules read).
3. Assert allowed edges resolve: `adapters`→`core ./contracts`; `cli`/`mcp`/`opencode`→`core .`, `./contracts`, `./state`, `./branding`; every surface→`adapters`; `testkit`→`core`, `adapters`.
4. Assert every workspace dependency in each manifest is actually importable from that package's declared set (no manifest permission that no rule enforces).

**Expected Outcome**:
- All present imports are declared; all declarations resolve.
- Exit non-zero naming the importer and the offending subpath when a declaration is missing.

#### TC-SCAFFOLD-008 - Negative fixtures: package matrix edges

**Scenario Type**: Negative
**Impact Level**: Critical
**Priority**: High
**Related IDs**: F-6, F-7, AC-F6-1, NFR-2
**Test Type(s)**: Negative fixture
**Automation Level**: Automated
**Target Layer / Location**: `tests/boundaries/fixtures/matrix-*/`
**Tags**: @boundary, @negative-fixture, @matrix

**Preconditions**:
- Fixture harness per §4.

**Steps**:
1. For each case — `cli`→`mcp`, `mcp`→`opencode`, `core`→`adapters`, `opencode`→`cli` — materialise the fixture workspace and cruise clean (expect 0 violations).
2. Inject the violating import in alias form.
3. Re-cruise and parse `summary.violations`.

**Expected Outcome**:
- Clean cruise: 0 violations.
- After injection: the matching `matrix-…-importer` rule for that importer fires, `from`/`to` name the fixture paths, and the process exits non-zero.

#### TC-SCAFFOLD-009 - Negative fixtures: core subpath permissions

**Scenario Type**: Negative
**Impact Level**: Critical
**Priority**: High
**Related IDs**: F-1, F-6, F-7, AC-F1-1, NFR-2
**Test Type(s)**: Negative fixture
**Automation Level**: Automated
**Target Layer / Location**: `tests/boundaries/fixtures/subpath-*/`
**Tags**: @boundary, @negative-fixture, @subpath

**Preconditions**:
- Fixture harness per §4.

**Steps**:
1. Cases: `adapters`→`@delivery-os/core/state`, `adapters`→`@delivery-os/core/branding`, and an importer importing a subpath absent from its declaration.
2. For each, cruise clean, inject the import, re-cruise.
3. Also assert the allowed counterpart (`adapters`→`@delivery-os/core/contracts`) cruises clean after injection into a control fixture.

**Expected Outcome**:
- Each forbidden case fires `subpath-adapters-core-state` / `subpath-adapters-core-branding` / `subpath-undeclared`.
- The allowed control stays clean; no rule fires on `./contracts`.

#### TC-SCAFFOLD-010 - Negative fixtures: deep and relative cross-package imports

**Scenario Type**: Negative
**Impact Level**: Critical
**Priority**: High
**Related IDs**: F-6, F-7, AC-F6-1, NFR-2
**Test Type(s)**: Negative fixture
**Automation Level**: Automated
**Target Layer / Location**: `tests/boundaries/fixtures/deep-import-*/`, `relative-escape-*/`
**Tags**: @boundary, @negative-fixture, @deep-import

**Preconditions**:
- Fixture harness per §4.

**Steps**:
1. Cases: deep package-name import (`@delivery-os/core/src/domain/x`), relative escape (`../../core/src/domain/x`), relative escape into a sibling surface (`../../../adapters/src/registry`).
2. Cruise clean, inject, re-cruise per case.
3. Assert the rule reports the resolving target path, not just the specifier string.

**Expected Outcome**:
- `no-deep-package-import` and `no-relative-cross-package-import` fire respectively; exit non-zero.
- Reports identify the escaping target so the fix can be placed without archaeology.

#### TC-SCAFFOLD-011 - Negative fixtures: core tier violations, alias form

**Scenario Type**: Negative
**Impact Level**: Critical
**Priority**: High
**Related IDs**: F-5, F-7, AC-F5-1, NFR-2
**Test Type(s)**: Negative fixture
**Automation Level**: Automated
**Target Layer / Location**: `tests/boundaries/fixtures/tier-alias-*/`
**Tags**: @boundary, @negative-fixture, @tier-alias

**Preconditions**:
- Core `package.json` `imports` aliases exist for `domain`/`app`/`config`/`branding`/`state` (ADR DEC-7 tier names, not marksync's).
- Fixture harness per §4.

**Steps**:
1. Assert the alias map is present and resolves (`#domain/*`, `#app/*`, `#config/*`, `#branding/*`, `#state/*`) and uses the ADR tier names only.
2. For each forbidden alias edge (`#domain/*`→`#app/*`, `#domain/*`→`#state/*`, `#config/*`→`#domain/*`, `#branding/*`→`#app/*`, `#app/*`→`#branding/*`, `#app/*`→`#state/*`): cruise clean, inject the alias import, re-cruise.
3. Assert the allowed edges (`#domain/*`→`#contracts`, `#app/*`→`#domain/*`) stay clean in a control fixture.

**Expected Outcome**:
- Each injected alias edge fires its tier rule; exit non-zero.
- Allowed edges remain clean — proving the rule is scoped, not blanket.

#### TC-SCAFFOLD-012 - Negative fixtures: core tier violations, relative form

**Scenario Type**: Negative
**Impact Level**: Critical
**Priority**: High
**Related IDs**: F-5, F-7, AC-F5-1, NFR-2
**Test Type(s)**: Negative fixture
**Automation Level**: Automated
**Target Layer / Location**: `tests/boundaries/fixtures/tier-relative-*/`
**Tags**: @boundary, @negative-fixture, @tier-relative

**Preconditions**:
- Same rules as TC-011; this case asserts the resolver catches the same edges without aliases.

**Steps**:
1. Write each forbidden edge from TC-011 as a relative import (`../app/x`, `../../branding/x`, `./state/x`, `../../../domain/x`).
2. Cruise clean, inject, re-cruise per case.
3. Assert the fired rule name is identical to the alias-form rule name (one rule per tier, form-independent).

**Expected Outcome**:
- Every relative-form edge fires the same tier rule as its alias counterpart.
- A config change that only handles aliases fails this scenario.

#### TC-SCAFFOLD-013 - Negative fixtures: testkit dev edges

**Scenario Type**: Negative
**Impact Level**: Critical
**Priority**: High
**Related IDs**: F-6, F-7, F-12, AC-F7-1, NFR-2
**Test Type(s)**: Negative fixture
**Automation Level**: Automated
**Target Layer / Location**: `tests/boundaries/fixtures/testkit-*/`
**Tags**: @boundary, @negative-fixture, @testkit

**Preconditions**:
- Fixture harness per §4; fixture manifests can declare `devDependencies`.

**Steps**:
1. Case A: `packages/cli/src/**` imports `testkit` → expect `testkit-no-production-import`.
2. Case B: `testkit/src/**` imports `cli` (a surface) → expect `testkit-no-surface-import`.
3. Case C (control): `packages/core/test/**` imports `testkit` with `testkit` in `devDependencies` → expect 0 violations.
4. Case D: a publishable manifest lists `testkit` in `dependencies`/`peerDependencies` → covered by TC-033; here assert the rule configuration references the same manifest field.

**Expected Outcome**:
- A and B fail with the expected rule; C is clean.
- The passing control proves the dev-edge allowance is real, not aspirational.

#### TC-SCAFFOLD-014 - Negative fixtures: runtime-API confinement

**Scenario Type**: Negative
**Impact Level**: Critical
**Priority**: High
**Related IDs**: F-6, F-7, AC-F6-1, NFR-2
**Test Type(s)**: Negative fixture
**Automation Level**: Automated
**Target Layer / Location**: `tests/boundaries/fixtures/runtime-apis-*/`
**Tags**: @boundary, @negative-fixture, @runtime-neutral

**Preconditions**:
- Fixture harness per §4.

**Steps**:
1. Inject `node:fs` into a `core/src/domain` fixture → expect `runtime-apis-confinement`.
2. Inject `bun:*` into a `core/src/config` fixture → expect the same rule.
3. Inject `node:sqlite` into `core/src/app` (outside `./state`) → expect the same rule.
4. Control: `node:*` inside `core/src/state` and inside an adapter I/O subpath → expect 0 violations.

**Expected Outcome**:
- All three violations fire; both controls stay clean.
- Confirms confinement is by subpath/directory, not by package.

#### TC-SCAFFOLD-015 - Negative fixtures: ambient globals in neutral tiers

**Scenario Type**: Negative
**Impact Level**: Critical
**Priority**: High
**Related IDs**: F-6, F-7, AC-F6-1, NFR-2
**Test Type(s)**: Negative fixture
**Automation Level**: Automated
**Target Layer / Location**: `tests/boundaries/fixtures/ambient-*/`; ambient-global guard (AST/lint)
**Tags**: @boundary, @negative-fixture, @ambient-globals

**Preconditions**:
- The ambient-global guard exists (dependency-cruiser cannot see a global — ADR DEC-2 requires an AST/lint guard).

**Steps**:
1. Inject `process.env.X` into `core/src/branding` → expect `ambient-env-branding`.
2. Inject `Bun.env.X` into the same fixture → expect the same rule.
3. Inject `process`, `Bun`, `Deno`, `setTimeout`, `fetch` (one per fixture file) into `core/src/domain`, `core/src/app`, `core/src/config` → expect `ambient-globals-neutral-tiers`.
4. Control: `process.env` in a surface fixture and in `core/src/state` → expect 0 violations.

**Expected Outcome**:
- Every ambient-global case fires; controls stay clean.
- The guard runs as part of the boundary check (not a separate advisory lint).

#### TC-SCAFFOLD-016 - Fixture-coverage meta-check + positive controls

**Scenario Type**: Negative
**Impact Level**: Critical
**Priority**: High
**Related IDs**: F-7, AC-F7-1, NFR-3
**Test Type(s)**: Negative fixture / meta-check
**Automation Level**: Automated
**Target Layer / Location**: `tests/boundaries/fixture-coverage.test.ts`
**Tags**: @boundary, @meta-check, @unenforced-rule

**Preconditions**:
- Root boundary configuration and the fixture registry committed.

**Steps**:
1. Load the production `.dependency-cruiser.cjs` and enumerate every `forbidden[].name`.
2. Load the fixture registry (rule name → fixture case(s)); require every configured rule to have ≥1 case and every registry key to exist in the config (no orphan fixtures).
3. Assert the ambient-global guard's rule ids are in the same registry.
4. Run the whole suite in "expected-rule" mode and assert every case fires its declared rule (no case that silently stops firing).
5. Delete one fixture (in a temp copy of the registry) and assert the meta-check fails.

**Expected Outcome**:
- Check fails naming any rule without a fixture ("unenforced"), any orphan fixture, and any case whose rule stopped firing.
- Step 5 proves the meta-check itself is not vacuous.
- Exit non-zero in every failure mode.

#### TC-SCAFFOLD-017 - Bun four-copy pin equality

**Scenario Type**: Happy Path
**Impact Level**: Critical
**Priority**: High
**Related IDs**: F-3, AC-F3-1, NFR-4, DM-4
**Test Type(s)**: Script check
**Automation Level**: Automated
**Target Layer / Location**: `scripts/checks/pin-equality.ts`; `.bun-version`, root `package.json` engines, CI matrix, release build
**Tags**: @pin, @gate, @ci

**Preconditions**:
- All four pin copies committed.

**Steps**:
1. Read `.bun-version` as the single source of truth (exact version string, no range, no `latest`).
2. Extract the pin from the `engines.bun` field, the CI matrix entry, and the release-build definition.
3. Compare all four; report every divergence by location.
4. In CI, additionally assert `bun --version` (the runtime actually installed) equals `.bun-version` — closing the "all four copies wrong identically" hole (RSK-T2).

**Expected Outcome**:
- All four copies identical and equal to the installed runtime; exit 0.
- Check never hardcodes a version — it compares copies, so a reviewed bump passes once all four move together.

#### TC-SCAFFOLD-018 - Pin-equality check fails on any divergence

**Scenario Type**: Negative
**Impact Level**: Critical
**Priority**: High
**Related IDs**: F-3, AC-F3-1, NFR-4
**Test Type(s)**: Script check (mutation)
**Automation Level**: Automated
**Target Layer / Location**: temp copy of the four pin sources
**Tags**: @pin, @negative, @gate

**Preconditions**:
- TC-017 passes on the live tree.

**Steps**:
1. Copy the pin sources to a temp dir; mutate exactly one copy (e.g. patch-bump the CI matrix entry only).
2. Run the pin check against the temp tree.
3. Repeat for each of the four locations plus a range-valued pin (`~1.2.0`) and a `latest` value.

**Expected Outcome**:
- Every mutation exits non-zero and names the diverging location and both values.
- No mutation passes.

#### TC-SCAFFOLD-019 - Strict TS flag set asserted; solution typecheck clean

**Scenario Type**: Happy Path
**Impact Level**: Critical
**Priority**: High
**Related IDs**: F-4, AC-F4-1, NFR-5
**Test Type(s)**: Script check + build
**Automation Level**: Automated
**Target Layer / Location**: `scripts/checks/tsconfig-strictness.ts`; `tsconfig.base.json`, `tsconfig.json`, per-package configs
**Tags**: @typescript, @strict, @gate

**Preconditions**:
- Base and per-package configs committed; `pnpm install` done.

**Steps**:
1. Assert the base config sets the full ADR DEC-3 flag set: `strict`, `noUncheckedIndexedAccess`, `exactOptionalPropertyTypes`, `noUnusedLocals`, `noUnusedParameters`, `noImplicitReturns`, `noFallthroughCasesInSwitch`, `noImplicitOverride`, `noUncheckedSideEffectImports`, `verbatimModuleSyntax`, `isolatedModules`, bundler module resolution, `declaration` + declaration maps, `module: ESNext`/`type: module`.
2. Assert each package config extends the base (no flag overrides that weaken it) and the root solution config references all six packages.
3. Run `pnpm typecheck` (no-emit, solution-wide).

**Expected Outcome**:
- Flag set matches exactly; no weakening override; zero `@ts-expect-error`/`skipLibCheck` escape hatches that mask errors (strict `skipLibCheck` decision recorded if used).
- Solution typecheck exits 0 across all six packages.

#### TC-SCAFFOLD-020 - Typecheck fails on strict-flag regression

**Scenario Type**: Negative
**Impact Level**: Important
**Priority**: High
**Related IDs**: F-4, AC-F4-1, NFR-5
**Test Type(s)**: Script check (mutation)
**Automation Level**: Automated
**Target Layer / Location**: temp copy of the config tree + a probe source file
**Tags**: @typescript, @negative, @gate

**Preconditions**:
- A probe file exercising each flag (indexed access, optional property, unused local, implicit return, switch fallthrough, side-effect import).

**Steps**:
1. In a temp copy, remove one flag at a time and run the strictness check + typecheck.
2. Restore the flag and confirm the probe fails typecheck again (the probe is real, not vacuous).
3. Assert the strictness check flags the removal even when typecheck still passes.

**Expected Outcome**:
- Removing any single flag fails the strictness check by name.
- The probe proves each flag is actually enforced, not merely declared.

#### TC-SCAFFOLD-021 - Script surface: five named checks at both levels, one aggregate

**Scenario Type**: Happy Path
**Impact Level**: Critical
**Priority**: High
**Related IDs**: F-8, F-9, AC-F8-1
**Test Type(s)**: Script check
**Automation Level**: Automated
**Target Layer / Location**: `scripts/checks/script-surface.ts`; root + six package manifests
**Tags**: @scripts, @aggregate-check, @gate

**Preconditions**:
- All manifests committed.

**Steps**:
1. Assert at root and in each of the six packages: `lint`, `format:check` (format check), `typecheck`, `test`, `check:boundaries` exist and are non-empty.
2. Assert exactly one aggregate script exists (`check`) and it chains lint → format check → typecheck → test → boundaries, in that order, with no `|| true`, no `continue-on-error`, no optional flags.
3. Assert no alternate aggregate name exists (`verify`, `ci`, `all`, `validate`, `precommit`) that also chains the five.

**Expected Outcome**:
- Five named checks present at both levels; exactly one aggregate; ordering correct; exit non-zero listing any missing/duplicate/alternate.

#### TC-SCAFFOLD-022 - Aggregate check green on a fresh clone, no bypass flags

**Scenario Type**: Happy Path
**Impact Level**: Critical
**Priority**: High
**Related IDs**: F-9, F-8, AC-F9-1, NFR-1
**Test Type(s)**: E2E
**Automation Level**: Automated
**Target Layer / Location**: CI job `aggregate-check`; local reproduction after TC-001
**Tags**: @e2e-clone, @aggregate-check, @ci

**Preconditions**:
- TC-001 install succeeded on the same clone.

**Steps**:
1. Run `pnpm check` from the repository root of the fresh clone, with no extra flags and no env overrides.
2. Verify all five chained steps run (parse the output; a skipped step is a failure).
3. Verify exit code 0 and record wall-clock duration.

**Expected Outcome**:
- All five steps execute and pass; exit 0.
- Duration recorded; a provisional >10 min is reported to the PM for re-baselining (OQ-T3) rather than silently ignored.
- No bypass flag, no `--no-verify`, no filter narrowing the run.

#### TC-SCAFFOLD-023 - CI topology: binding TS jobs beside byte-unchanged bash jobs

**Scenario Type**: Happy Path
**Impact Level**: Critical
**Priority**: High
**Related IDs**: F-13, AC-F13-1, NFR-8
**Test Type(s)**: CI job check
**Automation Level**: Automated
**Target Layer / Location**: `scripts/checks/ci-topology.ts`; `.github/workflows/ci.yml`
**Tags**: @ci, @topology, @bash-regression

**Preconditions**:
- Workflow updated; base branch (`main-tools`) available for diffing.

**Steps**:
1. Assert the pre-existing job ids are all present and unchanged in trigger scope: `verify-claude-build`, `doc-distribution-guard`, `inception-doc-consistency`, `result-tuple-guard`, `mutation-sandbox`, `bash-tests`, `shellcheck`.
2. Diff the workflow against the base; assert no removed or modified line inside those job blocks (additions only).
3. Assert the new TS jobs exist and cover: install (frozen lockfile), typecheck, lint, format check, test, boundaries, aggregate check, pins, exports/publint, publish guard, license audit, vulnerability gate.
4. Assert the new jobs run on `pull_request` targeting `main-tools` and on pushes to the delivery branch.
5. Observe one real CI run on the PR and record each job's conclusion.

**Expected Outcome**:
- Bash job set intact and unmodified; TS jobs present, triggered, and individually visible.
- Observed run shows all jobs green and no job silently skipped.

#### TC-SCAFFOLD-024 - CI gate bindingness scan

**Scenario Type**: Negative
**Impact Level**: Critical
**Priority**: High
**Related IDs**: F-8, F-13, AC-F13-1
**Test Type(s)**: CI job check (mutation)
**Automation Level**: Automated
**Target Layer / Location**: `scripts/checks/ci-bindingness.ts`; workflow YAML
**Tags**: @ci, @binding, @no-advisory

**Preconditions**:
- Workflow committed.

**Steps**:
1. Scan every gate job for `continue-on-error`, `|| true`, `set +e`, `exit 0` wrapping after a failure, and `if: always()` on the gate step.
2. Assert every gate job's step exits non-zero on failure and no job is marked advisory/informational.
3. Mutation check: in a temp copy, add `continue-on-error: true` to the boundaries job and assert the scan fails.

**Expected Outcome**:
- Zero advisory/bypass constructs in gate jobs.
- The mutation is caught with the job and line named.

#### TC-SCAFFOLD-025 - Bash non-regression: existing suites and jobs unchanged and green

**Scenario Type**: Regression
**Impact Level**: Critical
**Priority**: High
**Related IDs**: NFR-8, AC-F13-1, RSK-2
**Test Type(s)**: Regression
**Automation Level**: Automated
**Target Layer / Location**: `scripts/.tests/`, `tools/.tests/`; existing CI jobs
**Tags**: @bash, @regression, @authoritative

**Preconditions**:
- Change applied on a branch from `main-tools`.

**Steps**:
1. `git diff --stat` against the base for `scripts/**` (excluding new monorepo checks in `scripts/checks/`) and `tools/**`: assert zero changes to existing bash scripts and tests.
2. Run the existing suites: `bash scripts/.tests/test-*.sh` and `bash tools/.tests/test-*.sh` (or the `bash-tests` CI job).
3. Verify the `shellcheck`, `bash-tests`, `doc-distribution-guard`, `mutation-sandbox`, `result-tuple-guard`, `inception-doc-consistency`, `verify-claude-build` jobs pass on the change PR.

**Expected Outcome**:
- No existing bash file modified; no bash job weakened.
- All existing suites and jobs pass unchanged (byte-identical content, same conclusions).

#### TC-SCAFFOLD-026 - Commitlint is the CI authority

**Scenario Type**: Happy Path
**Impact Level**: Important
**Priority**: High
**Related IDs**: F-8, AC-F8-2
**Test Type(s)**: Script check + CI job check
**Automation Level**: Automated
**Target Layer / Location**: `scripts/checks/commitlint-authority.ts`; root commitlint config; CI job
**Tags**: @commitlint, @ci-authority

**Preconditions**:
- Root commitlint config and CI job committed.

**Steps**:
1. Assert exactly one root commitlint config exists and no package-level config overrides it.
2. Assert a CI job runs commitlint against the delivery-branch base **and** the PR base (two invocations, or one invocation with both ranges).
3. Assert the job is binding (covered also by TC-024) and not limited to a local-hook-only path.
4. Mutation check: a non-conventional commit message on a temp branch fails the CI invocation; a conventional one passes.

**Expected Outcome**:
- CI commitlint rejects a malformed message and accepts a well-formed one.
- Local hook absence does not weaken the gate (authority is CI).

#### TC-SCAFFOLD-027 - Commit-msg hook: offline, non-mutating, non-blocking

**Scenario Type**: Edge Case
**Impact Level**: Important
**Priority**: High
**Related IDs**: F-8, AC-F8-2, NFR-9, RSK-3
**Test Type(s)**: Integration
**Automation Level**: Automated (scratch repo)
**Target Layer / Location**: `tests/behaviour/commit-msg-hook.test.ts`; `.husky/`
**Tags**: @hook, @offline, @non-mutating

**Preconditions**:
- Hook installed via `prepare`; a scratch git repo (not the working repo).

**Steps**:
1. In the scratch repo, stage a change and commit with a valid conventional message; assert success.
2. Commit with a malformed message: assert the hook cannot block the ADOS flow (documented behaviour: warn or pass, with CI as authority) and that no file in the commit was modified.
3. Run the hook with networking disabled (no DNS/registry access); assert it still completes.
4. Assert the hook mutates nothing: `git status --porcelain` unchanged apart from the intended commit, no files rewritten.

**Expected Outcome**:
- Hook completes offline, in bounded time, without altering commit content or the index.
- Hook never fails an agent commit (NFR-9); CI remains the sole authority (TC-026).

#### TC-SCAFFOLD-028 - Exports discipline: `dist` + `types`, never `src`

**Scenario Type**: Happy Path
**Impact Level**: Critical
**Priority**: High
**Related IDs**: F-10, AC-F10-1, NFR-6, DM-2
**Test Type(s)**: Script check
**Automation Level**: Automated
**Target Layer / Location**: `scripts/checks/exports-discipline.ts`; six manifests
**Tags**: @exports, @dist, @gate

**Preconditions**:
- Manifests committed; build artefacts available for existence assertions.

**Steps**:
1. For each of the five publishable packages, walk every `exports` entry and every condition.
2. Assert each target resolves under `dist/` and none contains `src`.
3. Assert each entry has a `types` condition pointing at a `.d.ts` under `dist/`.
4. Assert `main`/`module`/`types` top-level fields (if present) follow the same rule.
5. Assert the package declares `type: "module"` and `files` restricts publishing to `dist` (+ readme/license).

**Expected Outcome**:
- 100% of targets under `dist` with `types`; zero `src` targets.
- Exit non-zero listing each offending package/condition.

#### TC-SCAFFOLD-029 - publint + attw + package-export check pass for the five publishables

**Scenario Type**: Happy Path
**Impact Level**: Critical
**Priority**: High
**Related IDs**: F-10, AC-F10-1, NFR-6, DEC-11
**Test Type(s)**: Contract
**Automation Level**: Automated
**Target Layer / Location**: CI job `exports-publint`, after `build`; `publint`, `attw` (`@arethetypeswrong/cli`), and the package-export check (TC-028)
**Tags**: @exports, @publint, @attw, @packaging

**Preconditions**:
- `pnpm build` completed for all five publishable packages (`testkit` excluded — it never publishes).
- Both tools consume built output: `publint` inspects the packaged manifest/exports, and `attw` packs the package and resolves its declared `exports` types. Both therefore run **after** `build`; neither may run against a missing, stale, or partial `dist`.

**Steps**:
1. Run `publint` against `core`, `adapters`, `cli`, `mcp`, `opencode`.
2. Run `attw` against the same five: for each package, pack it and analyse the declared `exports` (e.g. `pnpm --filter <pkg> exec attw --pack .`). Assert attw reports **no type-resolution problems** for any declared entrypoint or condition — no missing types, no CJS/ESM masquerading, no false-ESM, no internal-resolution errors.
3. Run the package-export check (TC-028) and the resolution smoke (TC-004) for the same five.
4. Assert `testkit` is excluded from all three checks.

**Expected Outcome**:
- publint reports no errors for all five; attw reports no type-resolution problems for all five; export check and resolution smoke pass.
- Any `src` target, missing `types` condition, unresolvable declaration, or attw finding not covered by an explicitly recorded allowance (see Notes) fails the job.

**Notes / Clarifications**:
- `attw` resolution expectations for ESM-only packages: a "no CJS types" result for a mode the package deliberately does not support must be expressed as a recorded allowance or a named `attw` profile in the check configuration — never silently ignored, and a newly appearing unlisted finding fails the job (same fail-on-unknown principle as the fixture registry in TC-016).
- `attw` is pinned like every other dev-toolchain dependency and is enumerated by the license-registry seed through TC-035's manifest walk.
- Deviation from ADR-0003 DEC-3 is closed: spec v1.1 F-10/AC-F10-1/NFR-6 and DEC-11 name publint + attw + package-export check (formerly OQ-T1).

#### TC-SCAFFOLD-030 - All six manifests declare `private: true`

**Scenario Type**: Happy Path
**Impact Level**: Critical
**Priority**: High
**Related IDs**: F-11, AC-F11-1
**Test Type(s)**: Script check
**Automation Level**: Automated
**Target Layer / Location**: `scripts/checks/manifest-privacy.ts`
**Tags**: @publish-guard, @private, @gate

**Preconditions**:
- Six manifests committed.

**Steps**:
1. Enumerate `packages/*/package.json`; require exactly six.
2. Assert each has `private: true` (boolean, not string).
3. Assert no manifest has `publishConfig` overriding privacy or an access field that would enable a publish.
4. Assert the root manifest is `private: true`.

**Expected Outcome**:
- All six packages and the root are private; exit 0.
- Any missing/false `private` exits non-zero naming the package.
- Justification: repository invariant with no code path — a script check is the correct instrument, not a unit test.

#### TC-SCAFFOLD-031 - Publish guard fails pre-freeze and is wired unskippably

**Scenario Type**: Negative
**Impact Level**: Critical
**Priority**: High
**Related IDs**: F-11, AC-F11-2, C-7
**Test Type(s)**: Script check (mutation) + CI job check
**Automation Level**: Automated
**Target Layer / Location**: `scripts/checks/publish-guard.ts`; release job
**Tags**: @publish-guard, @negative, @release

**Preconditions**:
- Publish guard script and release job committed.

**Steps**:
1. Run the guard on the live tree (all private, neutral scope) → expect failure with the "still private" reason (this is the correct pre-freeze outcome).
2. In a temp copy, flip one intended-publishable package to `private: false` while keeping the neutral scope → expect failure with the "branded scope not applied" reason.
3. In a temp copy, flip all five and apply a branded scope → expect success (proves the guard is not unconditional).
4. Assert the release job invokes the guard before any publish step and cannot continue on its failure (no `continue-on-error`, no `|| true`, no `if: always()`), and that it runs before the publish command.

**Expected Outcome**:
- Guard fails pre-freeze for both reasons, passes only in the freeze configuration, and is positioned before publish.
- A guard that is present but skippable fails step 4.

#### TC-SCAFFOLD-032 - Changesets fixed group covers exactly five publishables

**Scenario Type**: Happy Path
**Impact Level**: Critical
**Priority**: High
**Related IDs**: F-12, AC-F12-1
**Test Type(s)**: Script check
**Automation Level**: Automated
**Target Layer / Location**: `scripts/checks/changesets-group.ts`; `.changeset/config.json`
**Tags**: @changesets, @lockstep, @gate

**Preconditions**:
- Changesets config committed.

**Steps**:
1. Read `.changeset/config.json`; assert `fixed` contains exactly one group.
2. Assert the group is exactly `@delivery-os/core`, `@delivery-os/adapters`, `@delivery-os/cli`, `@delivery-os/mcp`, `@delivery-os/opencode`.
3. Assert `testkit` appears in no fixed group and in no `ignore` list that would imply publication.
4. Assert `privatePackages` settings cannot cause `testkit` to version or publish.

**Expected Outcome**:
- Exactly one fixed group of five; `testkit` excluded everywhere; exit 0.
- Any sixth member or a missing member exits non-zero naming the package.

#### TC-SCAFFOLD-033 - `testkit` absent from every published dependency graph

**Scenario Type**: Happy Path
**Impact Level**: Important
**Priority**: High
**Related IDs**: F-12, AC-F12-1
**Test Type(s)**: Script check
**Automation Level**: Automated
**Target Layer / Location**: `scripts/checks/testkit-exclusion.ts`
**Tags**: @testkit, @publish-graph, @gate

**Preconditions**:
- Six manifests committed.

**Steps**:
1. Assert no publishable manifest lists `testkit` in `dependencies`, `peerDependencies`, or `optionalDependencies`.
2. Assert `testkit` appears only in `devDependencies` (root and/or per package).
3. Assert `testkit` itself declares `core`/`adapters` as `devDependencies` (it never publishes, so nothing may depend on it).

**Expected Outcome**:
- `testkit` appears in no published dependency field anywhere.
- Violation names the manifest and field.

#### TC-SCAFFOLD-034 - Ignore rules incl. brand-free project-local glob

**Scenario Type**: Happy Path
**Impact Level**: Important
**Priority**: High
**Related IDs**: F-14, AC-F14-1, DM-1, C-3
**Test Type(s)**: Script check
**Automation Level**: Automated
**Target Layer / Location**: `scripts/checks/ignore-rules.ts`; `.gitignore`
**Tags**: @hygiene, @rename-safe, @gate

**Preconditions**:
- `.gitignore` updated.

**Steps**:
1. Assert ignore coverage exists for: workspace dependency dirs (`node_modules` per package/root), build output (root + `packages/*/dist`), local ephemeral state, and the project-local config path.
2. Assert the project-local config pattern is a glob, not a literal product name; scan the added lines for the product-name seed tokens (`ados`, `ADOS_`, `~/.ados`) and fail on any match.
3. Simulate the rename: apply a synthetic product name to the pattern in a temp copy and assert the pattern still matches the same path shape (brand-free proof).
4. Confirm ignore behaviour with `git check-ignore -v` on representative paths (dist, node_modules, local state, config dir).

**Expected Outcome**:
- All four coverage classes present; brand-free glob matches under a renamed product.
- Any product literal in the added ignore lines fails with the line named.
- Justification: file-invariant assertion — script check, not unit test.

#### TC-SCAFFOLD-035 - License registry seed covers the scaffold dev-dependency set

**Scenario Type**: Happy Path
**Impact Level**: Critical
**Priority**: High
**Related IDs**: F-13, DEC-10, C-2, OQ-1
**Test Type(s)**: Script check
**Automation Level**: Automated
**Target Layer / Location**: `scripts/checks/license-audit.ts`; `doc/legal/dependency-licenses.yaml`
**Tags**: @license, @registry, @compliance

**Preconditions**:
- Registry seeded per DEC-10; lockfile committed.

**Steps**:
1. Enumerate every direct dev dependency from the root and package manifests.
2. Assert each has an explicit registry entry with a license identifier, a source (`dev-dependency`), and a verdict.
3. Assert each entry's license is on the registry allow-list.
4. Assert the registry is machine-readable YAML that parses under the audit's schema (no free-form prose in required fields).
5. Record the owner's C-2 license verdict at PR review (manual determination recorded, not automated).

**Expected Outcome**:
- Every direct dev dependency is registered and allow-listed; audit exits 0.
- A dependency present in the manifests but absent from the registry fails.
- Registry scope is the lockfile/manifest set (DEC-10 wording), not the installed tree — recorded as A-T5.

#### TC-SCAFFOLD-036 - License audit fails closed (unknown, non-allowlisted, compound)

**Scenario Type**: Negative
**Impact Level**: Critical
**Priority**: High
**Related IDs**: F-13, DEC-10
**Test Type(s)**: Script check (mutation)
**Automation Level**: Automated
**Target Layer / Location**: temp copies of registry + lockfile fixtures
**Tags**: @license, @fail-closed, @negative

**Preconditions**:
- TC-035 passes on the live tree.

**Steps**:
1. Add a fixture lockfile entry with license `LicenseRef-Proprietary` (unknown) → expect failure.
2. Add an entry with a known but non-allowlisted license (e.g. `GPL-3.0-only`) → expect failure.
3. Add a compound expression (`MIT OR GPL-3.0-only`, and `MIT AND Apache-2.0`) → expect the audit to evaluate the expression, not a prefix/substring; `OR` with a disallowed branch fails closed.
4. Remove a registry entry for a real dependency → expect failure.
5. Add an entry with an empty/missing license field → expect failure.

**Expected Outcome**:
- Every case exits non-zero with the package, expression, and reason named; no case degrades to a warning.
- Compound expressions are parsed, not string-matched (a `MIT OR GPL-3.0-only` must not pass on the `MIT` prefix).

#### TC-SCAFFOLD-037 - Vulnerability gate on the scaffold dependency set

**Scenario Type**: Happy Path
**Impact Level**: Important
**Priority**: High
**Related IDs**: F-13, NFR-10, C-10
**Test Type(s)**: Script check / CI job check
**Automation Level**: Automated
**Target Layer / Location**: `scripts/checks/vulnerability-gate.ts`; CI job
**Tags**: @security, @audit, @ci

**Preconditions**:
- Lockfile committed; audit advisory database reachable in CI.

**Steps**:
1. Run the audit against the committed lockfile at `--audit-level high`.
2. Assert the gate fails on any high/critical finding and that the job is binding (no `continue-on-error`).
3. Assert the gate is wired from the first dependency (present in this PR's CI, not deferred).
4. Mutation check: inject a fixture advisory record into a temp audit input and assert the gate fails.

**Expected Outcome**:
- 0 high/critical findings; gate exits 0 and is binding.
- The mutation proves the gate can fail (not a no-op).

#### TC-SCAFFOLD-038 - CI supply-chain hygiene: SHA-pinned actions, job-scoped permissions

**Scenario Type**: Happy Path
**Impact Level**: Important
**Priority**: Medium
**Related IDs**: F-13, C-10
**Test Type(s)**: CI job check
**Automation Level**: Automated
**Target Layer / Location**: `scripts/checks/ci-supply-chain.ts`; workflow YAML
**Tags**: @security, @ci, @pins

**Preconditions**:
- Workflow updated.

**Steps**:
1. Assert every `uses:` in new jobs is pinned to a full commit SHA (allowed: first-party `actions/*` — still SHA-pinned per C-10).
2. Assert every new job declares explicit least-privilege `permissions` (`contents: read` unless more is justified).
3. Assert no job uses `pull_request_target` with checkout of untrusted code, and no secrets are exposed to fork PRs.
4. Mutation check: replace one SHA with a floating tag in a temp copy and assert the scan fails.

**Expected Outcome**:
- All actions SHA-pinned, permissions scoped, no privileged-fork exposure.
- Floating tag detected by name and line.

## 6. Environments and Test Data

### 6.1 Environments

| Environment | Requirements | Notes |
|-------------|--------------|-------|
| Local dev (delivery) | pnpm (pinned version) + Bun (pinned) + git + network for install | RSK-1; verify availability as the first delivery step. Tests themselves run offline after install. |
| CI (GitHub Actions, `ubuntu-latest`) | pnpm + Bun installed from `packageManager` / `.bun-version` via SHA-pinned actions; network for install and the vulnerability gate | Authoritative for TC-001, 022, 023, 025, 029, 037 |
| Scratch git repo (temp) | git only, no network | TC-003 (isolation probe), 027 (hook behaviour) |
| Fixture workspace (temp) | Bun + `depcruise` from `node_modules`; no network | TC-008–016 |

### 6.2 Test Data

| Data | Source | Lifecycle |
|------|--------|-----------|
| Subpath + file inventory | Committed structure manifest (declared by delivery) | Read-only |
| Boundary fixtures | `tests/boundaries/fixtures/**` (committed, one dir per rule case) | Read-only; copied to temp |
| Rule registry (rule name → fixtures) | Committed in `tests/boundaries/` | Read-only; temp copy for the meta-check mutation |
| Mutated pin/config/registry trees | Generated per run in `mkdtemp` | Deleted at test end; never in-tree |
| License fixtures (unknown / non-allowlisted / compound) | `tests/fixtures/license/**` | Read-only |
| CI workflow (temp copies for mutations) | `.github/workflows/ci.yml` | Read-only; temp copy for mutation checks |

### 6.3 Isolation Strategy

- Every mutation-style test copies the minimal input set into a temp dir; **nothing under version control is written during a test run** (`git status` must be clean after the full suite — asserted in TC-022).
- Boundary cases never probe the live tree (contrast with marksync's ephemeral `src/` probe, which needs load-bearing cleanup and collides under parallel runs).
- Tests requiring network are only install-time (TC-001, 022) and the vulnerability gate (TC-037); everything else runs offline.
- Fixture workspaces are self-contained: local `node_modules` symlinks, no real registry install.

## 7. Automation Plan and Implementation Mapping

All TCs are automated except the manual verdict recording in TC-035. Paths marked † are the assumed location; delivery planning may bind different filenames, but the TC behaviour and its assertion target must not change (A-T1).

| TC ID | Test file / artefact | Execution command | Mocking / mutations | Status |
|-------|----------------------|-------------------|---------------------|--------|
| TC-SCAFFOLD-001 | CI job `fresh-clone` | clone → install (CI) / documented local sequence | none | To Implement |
| TC-SCAFFOLD-002 | `scripts/checks/pnpm-foundation.ts` † | `bun run scripts/checks/pnpm-foundation.ts` | none | To Implement |
| TC-SCAFFOLD-003 | `tests/behaviour/pnpm-isolation.test.ts` † | `bun test tests/behaviour/pnpm-isolation.test.ts` | temp workspace; undeclared import | To Implement |
| TC-SCAFFOLD-004 | `tests/structure/subpaths.test.ts` † | `bun test tests/structure` | none (requires `build`) | To Implement |
| TC-SCAFFOLD-005 | `tests/structure/create-runtime.test.ts` † | `bun test tests/structure` | none | To Implement |
| TC-SCAFFOLD-006 | `tests/structure/content-inventory.test.ts` † | `bun test tests/structure` | AST scan; inventory manifest | To Implement |
| TC-SCAFFOLD-007 | `scripts/checks/workspace-entrypoints.ts` † | `bun run scripts/checks/workspace-entrypoints.ts` | none | To Implement |
| TC-SCAFFOLD-008 | `tests/boundaries/fixtures/matrix-*`, `boundaries.test.ts` | `bun test tests/boundaries` | temp fixture workspace; injected import | To Implement |
| TC-SCAFFOLD-009 | `tests/boundaries/fixtures/subpath-*` | `bun test tests/boundaries` | temp fixture workspace | To Implement |
| TC-SCAFFOLD-010 | `tests/boundaries/fixtures/deep-import-*`, `relative-escape-*` | `bun test tests/boundaries` | temp fixture workspace | To Implement |
| TC-SCAFFOLD-011 | `tests/boundaries/fixtures/tier-alias-*` | `bun test tests/boundaries` | temp fixture workspace | To Implement |
| TC-SCAFFOLD-012 | `tests/boundaries/fixtures/tier-relative-*` | `bun test tests/boundaries` | temp fixture workspace | To Implement |
| TC-SCAFFOLD-013 | `tests/boundaries/fixtures/testkit-*` | `bun test tests/boundaries` | temp fixture workspace + control | To Implement |
| TC-SCAFFOLD-014 | `tests/boundaries/fixtures/runtime-apis-*` | `bun test tests/boundaries` | temp fixture workspace + control | To Implement |
| TC-SCAFFOLD-015 | `tests/boundaries/fixtures/ambient-*` | `bun test tests/boundaries` | temp fixture workspace + control | To Implement |
| TC-SCAFFOLD-016 | `tests/boundaries/fixture-coverage.test.ts` † | `bun test tests/boundaries` | temp registry with a deleted fixture | To Implement |
| TC-SCAFFOLD-017 | `scripts/checks/pin-equality.ts` † | `bun run scripts/checks/pin-equality.ts` | none; CI adds runtime cross-check | To Implement |
| TC-SCAFFOLD-018 | `tests/fixtures/pins/**` + pin check | `bun test tests/checks` (mutation driver) | each of 4 copies mutated; range/`latest` | To Implement |
| TC-SCAFFOLD-019 | `scripts/checks/tsconfig-strictness.ts` † | `bun run scripts/checks/tsconfig-strictness.ts` + `pnpm typecheck` | none | To Implement |
| TC-SCAFFOLD-020 | `tests/fixtures/tsconfig/**` + probe sources | `bun test tests/checks` | one flag removed per case | To Implement |
| TC-SCAFFOLD-021 | `scripts/checks/script-surface.ts` † | `bun run scripts/checks/script-surface.ts` | none | To Implement |
| TC-SCAFFOLD-022 | CI job `aggregate-check` | `pnpm check` (fresh clone) | none | To Implement |
| TC-SCAFFOLD-023 | `scripts/checks/ci-topology.ts` † | `bun run scripts/checks/ci-topology.ts` | none; observed CI run recorded | To Implement |
| TC-SCAFFOLD-024 | `scripts/checks/ci-bindingness.ts` † | `bun run scripts/checks/ci-bindingness.ts` | `continue-on-error` injected in temp copy | To Implement |
| TC-SCAFFOLD-025 | existing bash suites + jobs | `bash scripts/.tests/test-*.sh`, `bash tools/.tests/test-*.sh` | none | Existing – No Change |
| TC-SCAFFOLD-026 | `scripts/checks/commitlint-authority.ts` † | `bun run scripts/checks/commitlint-authority.ts` | malformed/valid commit message in temp repo | To Implement |
| TC-SCAFFOLD-027 | `tests/behaviour/commit-msg-hook.test.ts` † | `bun test tests/behaviour` | scratch repo, network disabled | To Implement |
| TC-SCAFFOLD-028 | `scripts/checks/exports-discipline.ts` † | `bun run scripts/checks/exports-discipline.ts` | none (requires `build`) | To Implement |
| TC-SCAFFOLD-029 | CI job `exports-publint` (after `build`) | `pnpm build && publint` + `attw --pack .` (per package, five publishables) | none | To Implement |
| TC-SCAFFOLD-030 | `scripts/checks/manifest-privacy.ts` † | `bun run scripts/checks/manifest-privacy.ts` | none | To Implement |
| TC-SCAFFOLD-031 | `scripts/checks/publish-guard.ts` † + `tests/fixtures/publish-guard/**` | `bun test tests/checks` + guard invocation | private flips + branded scope applied | To Implement |
| TC-SCAFFOLD-032 | `scripts/checks/changesets-group.ts` † | `bun run scripts/checks/changesets-group.ts` | none | To Implement |
| TC-SCAFFOLD-033 | `scripts/checks/testkit-exclusion.ts` † | `bun run scripts/checks/testkit-exclusion.ts` | none | To Implement |
| TC-SCAFFOLD-034 | `scripts/checks/ignore-rules.ts` † | `bun run scripts/checks/ignore-rules.ts` | synthetic rename in temp copy | To Implement |
| TC-SCAFFOLD-035 | `scripts/checks/license-audit.ts` † + registry | `bun run scripts/checks/license-audit.ts` | none; manual verdict at PR review | To Implement |
| TC-SCAFFOLD-036 | `tests/fixtures/license/**` + audit | `bun test tests/checks` | unknown / non-allowlisted / compound / missing | To Implement |
| TC-SCAFFOLD-037 | `scripts/checks/vulnerability-gate.ts` † | `bun run scripts/checks/vulnerability-gate.ts` | fixture advisory record | To Implement |
| TC-SCAFFOLD-038 | `scripts/checks/ci-supply-chain.ts` † | `bun run scripts/checks/ci-supply-chain.ts` | floating tag in temp copy | To Implement |

**Aggregate wiring**: every `scripts/checks/*` check above is invoked by the aggregate `check` or by a named CI job listed in TC-023 — a check that exists but is invoked by nothing fails TC-021/TC-023.

**Execution order**: (1) static/invariant checks (002, 017, 019, 021, 028, 030, 032, 033, 034, 035, 038); (2) structure tests after build (004, 005, 006, 007); (3) boundary suite (008–016); (4) mutation checks (018, 020, 024, 031, 036, 037-mutation); (5) e2e-clone (001 → 022); (6) CI observation (023, 025, 029); (7) hook/isolation probes (003, 027).

## 8. Risks, Assumptions, and Open Questions

### 8.1 Risks

| ID | Risk | Impact | Probability | Mitigation |
|----|------|--------|-------------|------------|
| RSK-T1 | Fixture harness resolution drift: fixtures do not resolve like the real workspace (false "rule fires", or a rule that cannot fire at all) | H | M | Verbatim production config; symlinked fixture packages under `node_modules/@delivery-os/`; clean-cruise precondition + allowed-edge controls (TC-016) |
| RSK-T2 | Pin check is self-referential: all four copies could be wrong identically and pass | M | L | TC-017 step 4 asserts the installed runtime equals `.bun-version` in CI |
| RSK-T3 | Mutation-style checks accidentally mutate the live tree and poison later runs | M | L | Temp-dir copies only; no in-tree probes; TC-022 asserts a clean `git status` after the suite |
| RSK-T4 | New CI jobs push the fast loop past the provisional ≤10 min (NFR-1) | M | M | Single install job + cache; duration recorded at TC-022; re-baseline per spec (OQ-T3) |
| RSK-T5 | Bash non-regression masked by job flakiness or an early-exiting job | H | L | Baseline job set asserted structurally (TC-023), suites run directly (TC-025) |
| RSK-T6 | License audit scope mismatch (installed tree vs lockfile; platform-conditional entries) produces false pass/fail | M | M | Audit reads the committed lockfile per DEC-10; fixture-driven negative cases (TC-036) |
| RSK-T7 | "Empty-but-enforced" inventory passes while real logic hides inside an inventoried file | M | L | AST check for callable exports and top-level side effects (TC-006); inventory review at PR; residual risk recorded |
| RSK-T8 | pnpm/Bun unavailable in the delivery environment (spec RSK-1) blocks local execution | M | M | Verify availability first; CI is authoritative for 001/022/023/025/029/037 |

### 8.2 Assumptions

- **A-T1** — Invariant checks live at `scripts/checks/*.ts` and are run by `bun`; the repo's `scripts/*.sh` bash convention is unchanged and applies to bash automation only. Final paths are bound by the delivery plan without changing TC behaviour.
- **A-T2** — `bun test` is the TypeScript test runner (spec, marksync pattern); `bunfig.toml` sets the test root so `tests/**` and `packages/*/test/**` are discovered; `.test.ts` is the naming convention for TS tests (distinct from the bash `test-*.sh` convention).
- **A-T3** — `.ai/rules/testing-strategy.md` covers docs/bash layers only; this plan defines the TypeScript layer, and phase 7 (`@doc-syncer`) extends the strategy file with it. Until then this plan is the TS-layer reference.
- **A-T4** — CI is GitHub Actions on `ubuntu-latest`; pnpm/Bun are installed by SHA-pinned actions reading `packageManager` and `.bun-version`.
- **A-T5** — The license audit scope is the committed lockfile/manifest dependency set (DEC-10 wording), not the installed tree; the registry is seeded from the same set.
- **A-T6** — Pin values are fixed at delivery time; TCs assert equality and shape, never a specific version.
- **A-T7** — `app` reaches state ports through `core ./contracts`, so `app → ./state` is forbidden at scaffold; the tier rule set is therefore "allowed set" based, with `./contracts` the only cross-tier import.
- **A-T8** — `testkit` is excluded from publint and attw (never publishes) but included in typecheck/test/boundaries.

### 8.3 Open Questions

| ID | Question | Context | Status | Owner |
|----|----------|---------|--------|-------|
| OQ-T1 | Is `attw` required? | **Resolved 2026-10-29** — spec v1.1 adds attw: F-10, AC-F10-1, NFR-6, and DEC-11 all name publint + attw + package-export check. TC-029 asserts all three in the post-`build` `exports-publint` job, so the ADR-0003 DEC-3 deviation is closed. | Resolved — no open action | @spec-writer (spec v1.1 / DEC-11) |
| OQ-T2 | NFR-7 (CLI startup ≤200 ms) has no measurable target at scaffold | No binary exists; spec §7.3 and DEC-5 defer measurement to the first release smoke | Resolved as deferred (not a coverage gap) | — |
| OQ-T3 | Should the first CI run fail when the fast loop exceeds the provisional 10 min? | Spec calls the threshold provisional and re-baselined after first runs | Open — TC-022 records duration and reports >10 min instead of failing until re-baselined | @pm |
| OQ-T4 | Commitlint "against the delivery-branch base and the PR base": on `push` events there is no PR base | TC-026 requires both invocations to exist; the push-event fallback (e.g. merge-base with `origin/main-tools`) is a delivery-plan detail | Open — non-blocking | Delivery planning |

## 9. Plan Revision Log

| Version | Date | Author | Changes |
|---------|------|--------|---------|
| 1.0 | 2026-10-29 | @test-plan-writer | Initial plan: 38 TCs across structure, boundary fixtures, toolchain pins, CI bindingness, publish path, hygiene, and DEC-10 license audit; all 17 ACs and 3 ticket ACs traced |
| 1.1 | 2026-10-29 | @test-plan-writer | OQ-T1 resolved: `attw` (`@arethetypeswrong/cli`) added to TC-SCAFFOLD-029 plus its index row, the AC-F10-1 / NFR-6 coverage rows, the §1.1 scope bullet, the §2 ADR reference, the §4 CI invocation order, the §7 automation map and assumption A-T8, per spec v1.1 (F-10, AC-F10-1, NFR-6) and DEC-11. TC count unchanged at 38; no other TC modified |

## 10. Test Execution Log

| TC ID | Run Date | Result | Notes |
|-------|----------|--------|-------|
| — | — | — | Not yet executed; scaffold not implemented |
