---
change:
  ref: GH-170
  type: feat
  status: Proposed
  slug: monorepo-scaffold-toolchain
  title: "M0-S1: Six-package monorepo scaffold and toolchain (ADR-0003)"
  owners: ["Juliusz Ćwiąkalski"]
  service: delivery-os
  labels: ["oss-tooling", "monorepo", "m0", "toolchain", "adr-0003"]
  version_impact: minor
  audience: internal
  security_impact: low
  risk_level: medium
  dependencies:
    internal:
      - "ADR-0003 — OSS Tooling Monorepo Structure (Accepted 2026-10-24, PR #163)"
      - "Existing bash delivery stack (scripts/, tools/, existing CI jobs) — coexistence, untouched"
      - "doc/spec tooling feature area (post-delivery reconciliation)"
    external:
      - "pnpm (exact version pinned at scaffold)"
      - "Bun (most recent stable at delivery time, pinned)"
      - "TypeScript, Biome, commitlint, husky, dependency-cruiser, changesets (dev toolchain)"
---

# CHANGE SPECIFICATION

> **PURPOSE**: Stand up the six-package pnpm-workspace monorepo under `packages/` with its full, CI-verified toolchain so every later OSS story lands into a typed, boundary-enforced structure instead of accreting loose scripts — the first implementation step of ADR-0003 and the substrate for the whole tooling track.

## 1. SUMMARY

This change delivers the M0-S1 monorepo scaffold: six packages per ADR-0003 DEC-1 (`core` with subpaths `.`, `./contracts`, `./state`, `./branding` and one `createRuntime` composition-root signature; `adapters` with per-provider, `./registry`, and per-I/O subpaths; `cli`; `mcp`; `opencode`; and a private dev-only `testkit`), all `private: true` with a release-job publish guard. It wires the toolchain end to end — pinned pnpm with one lockfile, a pinned Bun with a four-copy equality check, ESM with one strict TypeScript base configuration, Biome, commitlint + husky, changesets fixed-group lockstep versioning, dist-targeted exports with publint/package-export checks — and makes the ADR-0003 DEC-2 boundary matrices mechanically enforced by dependency-cruiser over declared entrypoints, with a failing negative-test fixture for every forbidden edge.

Scope is **structure over content**: empty-but-enforced structure only (each declared subpath exists, exports resolve, boundary fixtures fail correctly, tests run green). No engines, no business logic, no driver implementations. Existing bash jobs stay untouched and authoritative (C-5/C-8 strangler); new TypeScript CI jobs are additive and binding.

## 2. CONTEXT

### 2.1 Current State Snapshot

- ADOS delivers its own changes with a bash stack: `scripts/` (delivery automation), `tools/` (PATH utilities), `.opencode/` (canonical agent and command definitions — the product), and `doc/`. There is no Node/TypeScript structure anywhere in the repository.
- ADR-0003 (Accepted 2026-10-24 via PR #163) decided the OSS tooling shape: a root `packages/` pnpm workspace with six packages, Bun pinned as runtime and build target, one lockstep publish line, layered boundaries, and a wrapper-based strangler from the bash stack. It is authoritative for this change.
- The backlog (M0-S1, ticket GH-170) makes this scaffold the first OSS delivery: every later M0 story — M0-S2 branding, M0-S3 result contract, M0-S4 config layer, M0-S5 state — depends on this substrate. Package boundaries set precedent for everything after.
- The owner directive of 2026-10-29 designates the owner's sibling repository `marksync-for-confluence` (MIT, same owner) as the reference for in-package structure and toolchain detail: patterns and code may be adapted; branding and Confluence domain logic must not be copied; ADR-0003 remains binding.
- CI today runs only the bash jobs; PRs target `main-tools`.

### 2.2 Pain Points / Gaps

- The OSS tooling (TypeScript CLI + MCP + OpenCode surface) has **no home**: no manifests, no lockfile, no typecheck, no CI entry for TypeScript work.
- Without a scaffold now, each later M0 story would invent its own structure, and boundary rules (surfaces ↔ core, adapters ↔ core, testkit dev edges) would be prose rather than mechanical gates.
- The naming firewall (C-3) needs its structural seams in place from day one — neutral package scope, no product literals — before any content exists to violate it.
- The publish path (lockstep group, dist exports, publish guard) must exist before the first accidental artifact can ship; after the naming freeze it is a migration program.

## 3. PROBLEM STATEMENT

Because the repository has no typed monorepo substrate, every planned OSS tooling story (branding seam, result contract, configuration layer, state layer, engines) has nowhere to land and would accrete as loose scripts without enforceable package, subpath, and tier boundaries — reproducing exactly the surface drift, provider leakage, and persistence coupling that ADR-0003 exists to prevent, and leaving the future rename and publish path unmanaged.

## 4. GOALS

- **G-1**: The six-package workspace per ADR-0003 DEC-1 exists, resolves, and is green: every declared subpath exists, every export resolves, and one `createRuntime` composition-root signature is declared in `core` — with no business content.
- **G-2**: Boundaries are mechanically enforced: the DEC-2 package matrix, core subpath permissions, core internal tier matrix, testkit dev-edge table, and runtime-API confinement rules run in the boundary check, each forbidden edge proven by a failing negative fixture.
- **G-3**: The toolchain is pinned and CI-verified: pinned pnpm with one lockfile, Bun pinned to the most recent stable with a four-copy equality check, ESM everywhere, one strict TypeScript base configuration.
- **G-4**: The publish path is safe before any artifact exists: all six packages `private: true`, a release-job publish guard that fails on a pre-freeze publish, and the changesets fixed group covering exactly the five intended publishables.
- **G-5**: Coexistence holds: the bash stack is untouched and authoritative, new TypeScript CI jobs are additive and binding, and the scaffold is reversible by reverting one PR.

### 4.1 Success Metrics / KPIs

| Metric | Target |
|--------|--------|
| Fresh clone → install → aggregate check, in CI, with no manual steps | green, 0 manual steps |
| Dependency-graph violations across the DEC-2 matrices (every PR) | 0 |
| Forbidden boundary rules without a failing negative fixture | 0 (a rule without a fixture is unenforced and fails the check) |
| Bun pin copies identical (`.bun-version`, engines field, CI matrix, release build) | 4/4, every PR |
| Exports targets pointing at `src` | 0 |
| Packages published pre-freeze | 0 (guard active) |
| Existing bash CI job results | no regression, still authoritative |
| Boundary-check failures in alias form vs relative form | caught in both forms |

### 4.2 Non-Goals

- **NG-1**: Branding module values, the forbidden-literal test, and the rename drill (M0-S2). The `./branding` subpath exists as structure only.
- **NG-2**: Result/error contract and stable error table content (M0-S3).
- **NG-3**: Configuration layer/resolver (M0-S4).
- **NG-4**: State drivers, JSONL/SQLite implementations, lock fencing (M0-S5). The non-Bun driver choice is recorded now (DEC-3 below); its implementation is M0-S5.
- **NG-5**: Any engine, port implementation, or adapter/provider implementation.
- **NG-6**: Publication of any package (blocked on the naming freeze; guard active).
- **NG-7**: Cloud anything (C-4).
- **NG-8**: CLI framework wiring — cliffy is a plan-stage note only, not a scaffold dependency.
- **NG-9**: Replacing, weakening, or modifying existing bash jobs, tools, or gates.
- **NG-10**: Changes to `.opencode/`, `.ados-claude/`, or any existing directory layout (C-5/C-6; DEC-7 additive rule).

## 5. FUNCTIONAL CAPABILITIES

| ID | Capability | Rationale |
|----|------------|-----------|
| F-1 | Six-package workspace structure per ADR DEC-1 | The substrate every later story lands in; package boundaries are the precedent. |
| F-2 | pnpm workspace foundation: pinned `packageManager`, one lockfile | Dependency isolation is the intended second enforcement layer (ADR DEC-3; assumption verified at scaffold). |
| F-3 | Bun runtime pin with four-copy equality check | Deterministic runtime/build target; C-7 requires pin equality. |
| F-4 | ESM-everywhere strict TypeScript toolchain | One base config, per-package configs, root solution; the ADR DEC-3 flag set (identical to the marksync-proven set). |
| F-5 | In-package tier boundaries via alias-based layering | marksync-verified mechanic so the boundary checker catches violations in both alias and relative form; tier names from the ADR set. |
| F-6 | Cross-package boundary enforcement | dependency-cruiser over declared entrypoints + workspace isolation: package matrix, core subpath permissions, runtime-API confinement. |
| F-7 | Negative-fixture proof for every forbidden edge | "A rule without a failing fixture is unenforced" (ADR DEC-2). |
| F-8 | Quality gates: Biome (one root config), commitlint + husky, binding scripts | Deterministic quality floor; CI commitlint is the authority, the hook is convenience. |
| F-9 | Package scripts with ONE aggregate check | `lint`, `format check`, `typecheck`, `test`, `boundary check`, and a single `check` chaining them — per package and at root. |
| F-10 | Build + exports discipline | Builds produce `dist`; every exports target points at `dist` with a `types` condition, never `src`; publint + package-export checks. |
| F-11 | Publish guard with all-private manifests | Blocks an accidental pre-freeze publish twice: at the manifest and at the release job (C-7, ADR DEC-1/DEC-3). |
| F-12 | Lockstep versioning group (changesets fixed group) | Five intended publishables share one version line; `testkit` excluded. |
| F-13 | CI fast loop wired to the delivery branch, additive to bash | Binding TypeScript jobs beside the untouched, authoritative bash jobs (C-5/C-8). |
| F-14 | Repository hygiene: ignore rules per ADR DEC-1 | Workspace deps, build output, local state, and the project-local config via a brand-free glob. |

### 5.1 Capability Details

- **F-1**: The workspace contains exactly six packages. `core` exposes `.` (application service API surface and the single `createRuntime({ config, adapters, store, clock })` composition-root signature — declared once, no implementation), `./contracts`, `./state`, and `./branding`, with the internal tier structure `domain` / `app` / `config` / `branding` / `state` per the ADR tree. `adapters` declares the per-provider subpaths (`./gitlab`, `./jira`, `./github`, `./azure`, `./ci`), `./registry`, and the per-I/O subpaths (`./repo`, `./file`, `./host`, `./session`, `./legacy`) — the `./azure` subpath stays empty per ADR DEC-6 (no consumer yet). `cli`, `mcp`, and `opencode` are sibling surface packages; `testkit` is private and dev-only. All content is placeholder: empty-but-enforced.
- **F-2**: One workspace definition, one root manifest with the exact pnpm version pinned, one committed lockfile. No hoisting settings that weaken isolation; any deviation requires a recorded reason (ADR DEC-2). The isolated-dependency-graph assumption is verified at scaffold.
- **F-3**: The Bun version — most recent stable at delivery time — is recorded identically in four places (`.bun-version`, the engines field, the CI matrix, the release build) and a CI check fails on inequality. marksync's `1.2.23` is the reference floor, not the ADOS pin.
- **F-4**: ESM everywhere. One strict base configuration carries the full ADR DEC-3 flag set — which equals the marksync-proven set — including `strict`, `noUncheckedIndexedAccess`, `exactOptionalPropertyTypes`, `noUnusedLocals`/`noUnusedParameters`, `noImplicitReturns`, `noFallthroughCasesInSwitch`, `noImplicitOverride`, `noUncheckedSideEffectImports`, `verbatimModuleSyntax`, `isolatedModules`, bundler module resolution, declarations + maps, with composite per-package configs and a root solution typecheck. `core`'s neutral tiers get no runtime-supplied globals.
- **F-5**: Each package declares its internal layering through subpath aliases (the marksync `imports` mechanic): `core` uses the ADR tier names `domain` / `app` / `config` / `branding` / `state` — **not** marksync's `infra`/`cli`/`shared`; surfaces and adapters declare simpler layerings (e.g., commands/output; per-provider modules) designed at delivery planning, consistent with the ADR matrices and never duplicating the core tier matrix. The boundary configuration resolves aliases so violations are caught in alias form and relative form alike.
- **F-6**: One root boundary configuration checks: the package matrix (who may import whom), core subpath permissions (e.g., `adapters` → `core ./contracts` yes; `adapters` → `core ./state` and `core ./branding` no), core internal tiers, the testkit dev-edge table, and runtime-API confinement (runtime imports and ambient globals only where the ADR allows). Cross-package deep imports, including relative imports escaping a package root, are forbidden.
- **F-7**: Every forbidden rule carries at least one negative fixture that demonstrates the edge failing — including a cross-package relative import, an `adapters → core ./state` import, a core tier violation, a sibling-surface import, a runtime-API import in a neutral tier, and a testkit dev-edge violation. A rule without a failing fixture fails the check as unenforced.
- **F-8**: One root Biome configuration owns format and lint; the type checker owns type correctness (no duplicate). One root commitlint configuration plus a local commit-msg hook; CI runs commitlint against the delivery-branch base and the PR base and is the authority. Gates are binding: no advisory boundary job, no error-swallowing, no continue-on-error.
- **F-9**: The aggregate `check` is the single green/red signal for the scaffold; it chains the five named checks and exists at root and per package. No other aggregate entry point is created.
- **F-10**: Builds emit to `dist` per package; every declared entrypoint resolves through `dist` with a `types` condition; `src` is never an exported target. publint and a package-export check run for the five intended publishable packages.
- **F-11**: All six manifests carry `private: true`. The release job runs a publish guard that fails when an intended-publishable package is still private or when the branded scope has not been applied. The freeze change (much later) flips privacy, applies the branded scope, and removes the guard in one reviewed change.
- **F-12**: The changesets fixed group covers exactly `core`, `adapters`, `cli`, `mcp`, `opencode`; `testkit` is excluded from the group and from every published dependency graph.
- **F-13**: New binding CI jobs on the delivery branch: frozen-lockfile install, typecheck, Biome lint + format check, tests, boundary negative tests, the aggregate check, pin-equality checks, exports/publint checks, the publish guard, the vulnerability gate (C-10 — applicable from the first dependency), and the minimal license-registry audit (DEC-10). Existing bash jobs run unchanged and remain authoritative.
- **F-14**: Ignore rules gain: workspace dependency directories, build output (root and per-package `dist`), local ephemeral state, and the project-local config location matched by a brand-free glob that names no product (per ADR DEC-1; the rename drill asserts it still matches after a rename).

## 6. USER & SYSTEM FLOWS

```
Flow 1 — Fresh clone, green substrate (ticket AC-1)
  Contributor/agent clones the delivery branch
    → workspace install with committed lockfile (pinned pnpm, enforced)
    → ONE aggregate check: lint, format check, typecheck, test, boundary check
    → green in CI; no manual steps; bash jobs ran unchanged beside it

Flow 2 — Forbidden edge attempted (ticket AC-2)
  A package imports an undeclared subpath (e.g., adapters → core ./state)
  or a tier violation is written (alias or relative form)
    → boundary check fails in CI with the specific rule
    → the matching negative fixture proves the rule fires
    → merge blocked; no advisory bypass exists

Flow 3 — Publish attempt before the freeze (ticket AC-3)
  Release job runs while any intended-publishable package is private
  or the branded scope is not applied
    → publish guard fails the release job
    → nothing is published; manifest privacy is the second lock
```

## 7. SCOPE & BOUNDARIES

### 7.1 In Scope

- Six packages under `packages/` per ADR DEC-1, with all subpaths declared, exports resolvable, and placeholder content only (empty-but-enforced).
- Root workspace foundation: workspace definition, private root manifest with pinned `packageManager`, one lockfile, runtime pin files (four-copy Bun pin), base + solution TypeScript configs, one root Biome config, one root commitlint config, one root boundary configuration, and the per-package manifests/configs.
- Boundary enforcement: package matrix, core subpath permissions, core internal tier matrix, testkit dev edges, runtime-API confinement — each rule with a failing negative fixture.
- Quality toolchain and scripts: Biome; commitlint + husky commit-msg hook (hook = convenience, CI = authority); per-package + root `lint`, format check, `typecheck`, `test`, boundary check, and one aggregate `check`.
- Build/exports discipline: `dist` output, exports with `types` condition and never `src`, publint + package-export checks.
- Publish safety: all six packages `private: true`; release-job publish guard; changesets fixed group (five publishables, `testkit` excluded).
- CI fast loop: additive, binding TypeScript jobs on the delivery branch, including the vulnerability gate (C-10), the minimal license-registry audit (DEC-10), and pin-equality checks; bash jobs untouched.
- License registry seed (DEC-10/OQ-1): `doc/legal/dependency-licenses.yaml` with entries covering the scaffold dev-toolchain dependency set plus the minimal fail-closed license audit in the CI fast loop; full registry policy and gate hardening stay in M0-S18.
- Ignore-rule additions per ADR DEC-1, including the brand-free project-local config glob.
- In-package alias-based layering per package class (core tiers from the ADR set; simpler maps for surfaces/adapters).
- Recording the resolved scaffold-step decisions (Section 15.1) required by ADR-0003's implementation plan.

### 7.2 Out of Scope

- [OUT] Branding values, working name, forbidden-literal test, rename drill (M0-S2).
- [OUT] Result envelope, internal error table, stable codes (M0-S3).
- [OUT] Configuration schema, resolver, precedence, provenance (M0-S4).
- [OUT] State drivers, JSONL/SQLite, writer lock, migrations (M0-S5) — the non-Bun driver choice is recorded, not implemented.
- [OUT] Any engine, port implementation, provider adapter implementation, or MCP server implementation.
- [OUT] Publication of any package; removing `private: true`; applying a branded scope.
- [OUT] Cloud names, designs, or code (C-4).
- [OUT] CLI argument-framework wiring (cliffy — see 7.3).
- [OUT] Replacing, weakening, or wrapping existing bash jobs/gates; any `.opencode/` or `.ados-claude/` change; moving any existing directory.
- [OUT] Distribution registration in the installer (no artifacts exist yet; C-7 registration lands with the first artifacts).

### 7.3 Deferred / Maybe-Later

- **CLI framework**: cliffy (`@jsr/cliffy__command`) is the candidate CLI argument framework for a later story. **Plan-stage note only**: delivery planning should record it as the intended choice for the first CLI surface work; it MUST NOT appear as a scaffold dependency. When adopted, the argument-framework confinement rule (ADR DEC-2: framework confined to the `cli` package) governs it.
- **Runtime-portability smoke, packed-artifact import test, Node import smoke** (ADR DEC-3 CI set): their meaningful form depends on real contract content; delivered with the first core contracts content (M0-S2/M0-S3) unless delivery planning pulls placeholder versions earlier.
- **License-registry full policy and gate hardening** (M0-S18): deny-list enforcement detail, SBOM/notices integration, per-entry review-date governance, and registry tooling — the registry seed and minimal fail-closed audit are in scope (DEC-10).
- **Binary smoke / CLI startup measurement**: no binary exists at scaffold; the budget is recorded now (DEC-5), measured at first release.
- **Signature/SBOM/notices/provenance release gates** (C-2/C-10): release-time work; nothing is released at scaffold.

## 8. INTERFACES & INTEGRATION CONTRACTS

### 8.1 REST / HTTP Endpoints

N/A — no HTTP surface at scaffold.

### 8.2 Events / Messages

N/A — no event envelope at scaffold (M0-S3/M0-S5).

### 8.3 Data Model Impact

| ID | Element | Description |
|----|---------|-------------|
| DM-1 | Workspace foundation | Workspace definition + private root manifest declaring the workspace globs and the exact pinned package-manager version; one committed lockfile is the reproducibility contract. |
| DM-2 | Exports maps | Each package's declared entrypoints are the public contract: targets at `dist` with a `types` condition; `src` never exported. |
| DM-3 | Declared entrypoints per importer | Each package declares which entrypoints of its workspace dependencies it may import; the boundary rules read these declarations, so a new allowed edge requires a manifest change and review. |
| DM-4 | Runtime/toolchain pins | The Bun pin recorded identically in four copies; the pnpm pin in the root manifest — equality-checked in CI every PR. |

### 8.4 External Integrations

- GitHub Actions CI: new additive TypeScript jobs beside existing bash jobs (delivery branch; SHA-pinned actions and job-scoped permissions per C-10).
- Registry access for dev-toolchain dependencies at install time (pinned lockfile; no runtime dependencies at scaffold).
- marksync-for-confluence (owner's sibling repository, MIT): pattern/code reference per the 2026-10-29 owner directive; any copied source file carries a provenance note and license notice per ADR DEC-9; branding and Confluence domain logic never copied.

### 8.5 Backward Compatibility

Fully additive (ADR DEC-7): nothing moves, nothing is renamed, no existing job or gate changes. The bash stack remains the authoritative delivery engine. Reversal is a single PR revert (ADR rollback statement); no user-facing artifact ships, so no consumer is affected.

## 9. NON-FUNCTIONAL REQUIREMENTS (NFRs)

| ID | Requirement | Threshold |
|----|-------------|-----------|
| NFR-1 | Fresh-clone fast loop: install + aggregate check reproducible in CI with zero manual steps | green, 0 manual steps; fast-loop duration provisional ≤ 10 min, re-baselined after the first runs |
| NFR-2 | Boundary violations across all DEC-2 matrices (per PR) | 0 |
| NFR-3 | Negative-fixture coverage of forbidden rules | 1+ failing fixture per rule; 100%; missing fixture fails the check |
| NFR-4 | Pin equality (4 Bun copies + pnpm pin + frozen lockfile) | identical, verified every PR |
| NFR-5 | Solution typecheck clean under the full ADR DEC-3 strict flag set | clean, every PR |
| NFR-6 | Exports discipline for the five publishable packages | 0 targets at `src`; 100% `dist` + `types`; publint + package-export checks pass |
| NFR-7 | CLI startup budget (provisional placeholder; measured at first release smoke) | ≤ 200 ms invocation-to-first-output, placeholder pending measurement |
| NFR-8 | Existing bash test/CI results | no regression; bash jobs remain authoritative on every PR |
| NFR-9 | Local commit-msg hook behavior | offline, non-mutating, never blocks the ADOS agent commit flow; CI commitlint is the sole authority |
| NFR-10 | Vulnerability gate on the new dependency set (C-10) | 0 high/critical findings, every PR |

## 10. TELEMETRY & OBSERVABILITY REQUIREMENTS

N/A for product telemetry (nothing emits at scaffold). Observability = CI: every gate is binding (no advisory jobs, no error-swallowing, no continue-on-error), and job failure names the violated rule so an agent can place the fix without archaeology.

## 11. RISKS & MITIGATIONS

| ID | Risk | Impact | Probability | Mitigation | Residual Risk |
|----|------|--------|-------------|------------|---------------|
| RSK-1 | pnpm/Bun not installed or unreachable in the delivery/CI environment | M | M | Check availability as the first delivery step; pins are plain versions installable everywhere; record actual resolved pins in the change | Low |
| RSK-2 | Dual bash + TypeScript CI coexistence breaks or slows CI | M | M | Strictly additive jobs; bash jobs byte-untouched; fast loop kept lean (NFR-1); failures isolated per job | Low |
| RSK-3 | husky commit-msg hook breaks AI-agent commit flow | M | L | Hook is convenience only and offline (NFR-9); CI commitlint is the authority; hook config minimal | Low |
| RSK-4 | pnpm isolation does not reject undeclared cross-package imports as assumed (ADR ASSUMPTION) | M | L | dependency-cruiser over declared entrypoints remains the primary gate regardless; verify isolation at scaffold and record the result; no hoisting without a recorded reason | Low–Medium |
| RSK-5 | "Most recent stable Bun" resolution at delivery picks a defective release | L | L | marksync's pinned `1.2.23` is a proven reference floor; if the latest stable misbehaves, pin the newest proven stable and record why | Low |
| RSK-6 | Toolchain drift between local and CI (versions, lockfile) | M | M | Exact `packageManager` pin, frozen-lockfile CI install, four-copy Bun equality check (NFR-4) | Low |

## 12. ASSUMPTIONS

- pnpm's isolated dependency layout rejects undeclared cross-package imports at install/build time (ADR ASSUMPTION — verified at scaffold; the boundary rules do not depend on it).
- The latest stable Bun and the pinned pnpm are installable in both the delivery environment and CI (RSK-1).
- marksync-for-confluence is the owner's sibling repository under MIT; per the owner directive its patterns/code may be adapted, subject to the ADR DEC-9 provenance rule for any copied source file.
- No external library consumers exist before publication (ADR evidence), so all-private, ESM-only placeholder packages carry no consumer risk.
- Package scope `@delivery-os/*` is an internal, pre-freeze placeholder; the working/product name arrives via the branding module in M0-S2 and the scope is renamed at the freeze.

## 13. DEPENDENCIES

| Direction | Item | Notes |
|-----------|------|-------|
| Depends on | ADR-0003 (Accepted 2026-10-24) | Authoritative for package set, matrices, toolchain, publish path. |
| Depends on | Existing bash delivery stack + CI | Coexistence baseline; untouched and authoritative (C-5/C-8). |
| Depends on | `main-tools` branch model | PR target per AGENTS.md; CI fast loop wired to the delivery branch. |
| Blocks | M0-S2 (GH-171) branding seam | Needs the workspace, boundary gates, and `./branding` structure. |
| Blocks | M0-S3 result contract, M0-S4 config layer, M0-S5 state layer | Each lands into this substrate. |
| Blocks | Every later OSS story (M0+) | No story lands outside the enforced structure. |

## 14. OPEN QUESTIONS

| ID | Question | Context | Status |
|----|----------|---------|--------|
| OQ-1 | Should M0-S1 seed the committed license registry with entries for the scaffold dev-toolchain dependencies, or defer all registry work to M0-S18? | ADR-0003's scaffold stop condition lists "a dependency has no license-registry entry", but the registry itself is the M0-S18 story and M0-S1 task lists omit it. Either resolution is defensible; the conflict must be resolved before delivery. | Decided 2026-10-29 → DEC-10: M0-S1 seeds the minimal registry + minimal fail-closed audit; M0-S18 keeps policy/hardening (`@decision-advisor`) |

No other open questions: all scaffold-step decisions are resolved by the PM (Section 15.1), and pin values are fixed at delivery time by recorded policy.

## 15. DECISION LOG

| ID | Decision | Rationale | Date |
|----|----------|-----------|------|
| DEC-1 | Build tool: `tsc` (no-emit typecheck + emit to `dist`) | marksync-proven path; satisfies ADR DEC-3 ("tsdown or tsc — the scaffold chooses one"); avoids an extra build tool before a bundling need exists; a later reviewed change can adopt a bundler | 2026-10-29 |
| DEC-2 | MCP v1 artifact form: published package with a `.mcpb` manifest; Bun-or-Node entry | ADR DEC-3 wording; no server implementation in M0-S1; installer registration lands with the first real artifact (C-7) | 2026-10-29 |
| DEC-3 | Non-Bun SQLite driver fallback: `node:sqlite` where the supported Node version provides it | ADR DEC-3 primary wording; C-9 makes "no recorded non-Bun driver path at scaffold" a stop condition, so the choice is recorded now; implementation is M0-S5 | 2026-10-29 |
| DEC-4 | Bun pin = most recent stable at delivery time; four-copy equality | ADR DEC-3 policy; marksync `1.2.23` is the reference floor, not the ADOS pin; bumping is a reviewed change, never floating | 2026-10-29 |
| DEC-5 | CLI startup budget: provisional placeholder ≤ 200 ms (NFR-7), measured at first release smoke | ADR DEC-3 requires the budget set at scaffold; no binary exists yet, so the value is explicitly provisional and re-baselined by reviewed change | 2026-10-29 |
| DEC-6 | Neutral internal package scope `@delivery-os/*` (e.g., `@delivery-os/core`) pre-name-freeze | C-3 naming firewall: no product literals outside the branding module; consistent with the ADR service name `delivery-os`; branded scope applied at the freeze in one reviewed rename | 2026-10-29 |
| DEC-7 | In-package layering via imports subpath aliases; ADR tier names with marksync mechanics | marksync-verified mechanic (boundary checker resolves Node imports aliases — catches alias AND relative forms); tier names adapted to the ADR DEC-2 set (`domain`/`app`/`config`/`branding`/`state`), NOT marksync's `infra`/`cli`/`shared` | 2026-10-29 |
| DEC-8 | Vulnerability gate included in scaffold CI; license-registry audit deferred pending OQ-1 | C-10 becomes applicable the moment dependencies exist; the registry itself is M0-S18, and its seeding scope is OQ-1 | 2026-10-29 |
| DEC-9 | `change.type = feat` | Adds the monorepo substrate and its CI — the first implementation capability of ADR-0003, not a refactor of existing behavior | 2026-10-29 |
| DEC-10 | Seed the license registry in M0-S1: `doc/legal/dependency-licenses.yaml` covers the scaffold dev-toolchain dependency set (explicit entries for direct dependencies; the audit fails closed on any lockfile license not covered by the registry allow-list, compound expressions included) and a minimal license-registry audit joins the CI fast loop. Owner PR review of the scaffold records the license verdicts (C-2 human determination). M0-S18 keeps full registry policy, deny-list hardening, SBOM/notices, and per-entry review-date governance. Supersedes the deferral clause of DEC-8. | ADR-0003's scaffold stop condition ("a dependency has no license-registry entry") is binding; deferral would need an owner waiver of an R3 constraint and opens a several-story unaudited window the backlog-ranking note itself warns against ("the gate should exist before the dependency count grows further"; M0-S18 is a floater); the seed is small, mechanical, and dev-only; M0-S18 becomes pure hardening; mechanical fail-closed enforcement beats a tracked waiver in a solo-owner + AI-agent flow. Flag at PR review for the ADR-0003 post-scaffold retrospective (scaffold file list gains the registry). | 2026-10-29 |

### 15.1 Resolved scaffold-step decisions (chosen values + rationale)

ADR-0003 delegates six scaffold-step choices to this change. All are resolved by the PM (planning session, 2026-10-29) and recorded here as binding inputs to delivery planning.

| # | Choice (ADR-0003 locus) | Chosen value | Chosen vs adapted — rationale |
|---|--------------------------|--------------|-------------------------------|
| 1 | Build tool (DEC-3: "tsdown or tsc") | **tsc** — no-emit typecheck + emit to `dist` | **Chosen-from-marksync**: marksync runs `tsc --noEmit` for typecheck and `tsc` emit for output; the same path satisfies the ADR with zero additional tools. tsdown rejected at scaffold: no bundling need exists yet; adoption later is a reviewed, additive change. Matches the ADR option set exactly. |
| 2 | MCP v1 artifact form (DEC-3) | **Published package with `.mcpb` manifest; Bun-or-Node entry** | **Adopted from the ADR's primary wording** (package + `.mcpb`; binary/Node entry optional). No server implementation in M0-S1; the form only fixes what the manifest and entry declaration must accommodate. |
| 3 | Non-Bun SQLite driver fallback (DEC-3; C-9 stop condition) | **`node:sqlite`** where the supported Node version provides it | **Adopted from the ADR's primary wording** (built-in before an external driver, avoiding a license-registry dependency for the fallback). C-9 requires the path recorded at scaffold; the implementation, port wiring, and degraded-mode behavior are M0-S5. |
| 4 | Bun pin (DEC-3: most recent stable at scaffold) | **Most recent stable Bun at delivery time**, recorded in four copies with CI equality | **Adapted from marksync**: marksync's exact pin (1.2.23) is evidence the pattern works but is deliberately NOT the ADOS pin — the ADR demands the newest stable at scaffold. Reference floor retained as RSK-5 mitigation. |
| 5 | CLI startup budget (DEC-3: budget set at scaffold) | **Provisional ≤ 200 ms** (NFR-7), measured at first release smoke | **Placeholder by necessity**: no binary exists at scaffold. ADR requires a recorded budget now; the value is explicitly provisional and re-baselined by a reviewed change after first measurement. |
| 6 | Pre-freeze package scope (C-3 naming firewall; DEC-8) | **`@delivery-os/*`** neutral internal scope | **Chosen vs alternatives**: `ados`-based scope violates C-3 (public names not frozen; tooling must not hardcode the name); a fully generic `@workspace/*` was the ADR's example, but `@delivery-os` aligns with the ADR's own service name, stays brand-free, and reads better for agents. Working name comes from the branding module at M0-S2; the branded scope replaces this at the freeze. |

**marksync reuse boundary** (owner directive + ADR DEC-9): reuse the toolchain patterns — strict flag set, script layout (`lint`, format check, `typecheck`, `test`, boundary check, aggregate `check`), imports-alias mechanic with alias-resolving boundary rules, ESM module layout, dist+types exports, exact runtime pin. Adapt the tier vocabulary to the ADR set and design per-package alias maps (core tiers; commands/output for surfaces; per-provider modules for adapters) consistent with the ADR matrices. Never copy marksync branding or Confluence domain logic; MIT provenance rules apply to any copied source file.

## 16. AFFECTED COMPONENTS (HIGH-LEVEL)

| Component | Impact |
|-----------|--------|
| `packages/**` (six packages, all subpaths) | New — placeholder structure, manifests, configs, fixtures, green tests |
| Root workspace files (workspace definition, root manifest + lockfile, TS base/solution configs, Biome/commitlint/boundary configs, runtime pin file) | New — as named in ADR DEC-1/DEC-7 |
| `.gitignore` | Updated — additive entries per ADR DEC-1 |
| CI workflow | Updated — additive binding TypeScript jobs; bash jobs untouched |
| `scripts/`, `tools/`, existing bash tests | Untouched — authoritative (C-5/C-8) |
| `.opencode/`, `.ados-claude/` | Untouched (C-6) |
| `doc/spec/**` | Reconciled post-delivery (tooling feature area for the monorepo scaffold) |

## 17. ACCEPTANCE CRITERIA

Ticket AC coverage: ticket AC-1 → AC-F2-1, AC-F9-1, AC-F13-1, AC-F3-1; ticket AC-2 → AC-F1-1, AC-F5-1, AC-F6-1, AC-F7-1; ticket AC-3 → AC-F11-1, AC-F11-2, AC-F12-1.

| ID | Criterion | Linked |
|----|-----------|--------|
| AC-F2-1 | **Given** a fresh clone of the delivery branch, **when** the workspace install runs, **then** it completes reproducibly from the committed lockfile under the pinned package manager with zero manual steps. | F-2, NFR-4 |
| AC-F9-1 | **Given** a fresh clone, **when** the single aggregate check runs in CI, **then** lint, format check, typecheck, test, and boundary check all pass green with no manual steps and no bypass flags. | F-9, F-8, NFR-1 |
| AC-F13-1 | **Given** a pull request targeting the delivery branch, **when** CI runs, **then** the new TypeScript fast-loop jobs execute bindingly and every existing bash job runs unchanged and remains authoritative. | F-13, NFR-8 |
| AC-F3-1 | **Given** the four recorded Bun pin copies (pin file, engines field, CI matrix, release build), **when** the pin-equality check runs, **then** all four are identical to the recorded pin and the check fails on any divergence. | F-3, NFR-4 |
| AC-F1-1 | **Given** the six-package workspace, **when** a package imports a subpath declared for it, **then** the import resolves; and **when** any package imports a subpath not declared for it (e.g., `adapters` → `core ./state`), **then** the boundary check rejects it. | F-1, F-6, NFR-2 |
| AC-F1-2 | **Given** the scaffold content, **when** the structure is inspected, **then** every declared subpath exists, every export resolves, the `createRuntime` composition-root signature is declared exactly once in `core`, and no engines, business logic, or driver implementations are present (empty-but-enforced). | F-1, F-10 |
| AC-F5-1 | **Given** the in-package tier aliases, **when** a forbidden tier edge is written in alias form and **when** the same edge is written in relative form, **then** the boundary check fails in both forms. | F-5, NFR-2, NFR-3 |
| AC-F6-1 | **Given** the ADR DEC-2 package matrix, **when** a forbidden cross-package edge is introduced (for example `cli` → `mcp`, or a deep/relative import escaping a package root), **then** the boundary check fails the build. | F-6, NFR-2 |
| AC-F7-1 | **Given** every forbidden rule in the boundary configuration, **when** the negative-fixture suite runs, **then** each rule demonstrates at least one failing import, and **when** any rule lacks a failing fixture, **then** the check fails that rule as unenforced. | F-7, NFR-3 |
| AC-F4-1 | **Given** the strict TypeScript flag set required by ADR DEC-3 (identical to the marksync-proven set), **when** the solution typecheck runs, **then** it is clean across all packages with the full flag set and fails on any flag regression. | F-4, NFR-5 |
| AC-F8-1 | **Given** any package and the workspace root, **when** their scripts are inspected, **then** lint, format check, typecheck, test, and boundary check exist at both levels, and exactly one aggregate check chains them with no alternate aggregate path. | F-8, F-9 |
| AC-F8-2 | **Given** a commit made by the ADOS delivery flow, **when** the local commit-msg hook runs, **then** it completes offline without altering the commit, and CI commitlint (against the delivery-branch base and PR base) is the sole authority. | F-8, NFR-9 |
| AC-F10-1 | **Given** each publishable package build, **when** the exports discipline checks run, **then** every exports target points at `dist` with a `types` condition, none points at `src`, and publint plus the package-export check pass. | F-10, NFR-6 |
| AC-F11-1 | **Given** the six package manifests, **when** inspected, **then** all six declare `private: true`. | F-11 |
| AC-F11-2 | **Given** a release-job run before the naming freeze, **when** any intended-publishable package is still private or the branded scope has not been applied, **then** the publish guard fails the release job and nothing is published. | F-11 |
| AC-F12-1 | **Given** the changesets configuration, **when** inspected, **then** the fixed group covers exactly the five intended publishable packages and excludes `testkit`. | F-12 |
| AC-F14-1 | **Given** the root ignore rules, **when** inspected, **then** they cover workspace dependency directories, build output (root and per-package), local ephemeral state, and the project-local config via a brand-free glob that matches without naming any product. | F-14, DM-1 |

## 18. ROLLOUT & CHANGE MANAGEMENT (HIGH-LEVEL)

- Single PR targeting `main-tools`; branch `feat/GH-170/monorepo-scaffold-toolchain`.
- Fully additive: the bash stack, install paths, and user-facing behavior are unchanged; no data migration is involved (ADR rollback statement: revert the scaffold PR and nothing of consequence existed).
- No communication burden beyond the PR: no user-facing artifact ships. Post-delivery, `doc/spec/**` gains the monorepo scaffold feature area and the architecture overview mentions the package graph.
- The first retrospective checkpoint for ADR-0003 follows this scaffold (ADR governance note); record the pnpm-isolation verification result and actual resolved pins in the change/PR.

## 19. DATA MIGRATION / SEEDING (IF APPLICABLE)

N/A — no persisted data. Local ephemeral state locations are covered by new ignore entries only; nothing is created, moved, or migrated.

## 20. PRIVACY / COMPLIANCE REVIEW

N/A — no user data, no telemetry, no sinks, no network surfaces at scaffold. C-11 obligations attach to the state layer (M0-S5) and first persisted events, not to this change. The brand-free ignore glob is a C-3/naming-firewall measure recorded here for the later rename drill.

## 21. SECURITY REVIEW HIGHLIGHTS

- Supply-chain baseline applied where it first becomes applicable: exact package-manager pin, frozen-lockfile CI installs, four-copy runtime-pin equality (C-7), SHA-pinned Actions with job-scoped permissions, and the vulnerability gate on the new dependency set (C-10).
- Publish guard ensures no artifact can ship pre-freeze, doubly locked (manifest privacy + release job).
- No secrets, no credentials, no runtime dependencies at scaffold; dev toolchain only.
- Local commit-msg hook is offline and non-mutating; it can never become a supply or exfiltration path.

## 22. MAINTENANCE & OPERATIONS IMPACT

- Two pinned toolchains (pnpm, Bun): bumps are reviewed changes, never floating; CI equality checks enforce this permanently.
- Boundary rules must grow with the structure: every newly forbidden edge ships with its failing fixture in the same change (DEC-2 discipline).
- Single-source root configs (one Biome, one boundary configuration, one TS base) — per-package configs stay thin and derived.
- The aggregate check is the single quality entry point; keeping the fast loop honest (NFR-1) prevents route-arounds as content grows.
- CI cost grows with the matrix; watch fast-loop duration and move liveness work to separate jobs, never to advisory gates.

## 23. GLOSSARY

| Term | Definition |
|------|------------|
| Strangler pattern | New engines run beside the bash stack; wrappers delegate only after per-engine parity (ADR DEC-7). |
| Publish guard | Release-job check that fails if an intended-publishable package is still `private: true` or the branded scope is not applied (C-7, ADR DEC-1). |
| Lockstep versioning | One version line for the five publishable packages via a changesets fixed group; `testkit` excluded. |
| Negative fixture | A test that deliberately commits a forbidden edge and asserts the boundary rule fails it; a rule without one is unenforced. |
| Declared entrypoint | A subpath a package lists in its exports map and that importers must declare in their manifests to import. |
| pnpm isolation | pnpm's dependency layout where a package can only resolve what it declares — the intended second enforcement layer (ADR assumption, verified at scaffold). |
| Brand-free glob | An ignore pattern matching the project-local config path without naming any product, so it survives a rename. |
| Four-copy pin check | CI equality check across `.bun-version`, the engines field, the CI matrix, and the release build (C-7). |
| Aggregate check | The single chained quality entry point (`check`) covering lint, format, typecheck, test, and boundaries. |
| Tier alias (imports alias) | Package-internal layer names declared as subpath aliases so the boundary checker resolves and enforces them in alias and relative form (marksync-proven mechanic). |
| Empty-but-enforced | Scaffold content policy: structure, exports, rules, fixtures, and green tests exist; no engines, business logic, or driver implementations. |
| marksync reference | The owner's sibling MIT repository used per the 2026-10-29 owner directive as the pattern/code reference for in-package structure and toolchain detail. |

## 24. APPENDICES

### Appendix A — marksync reuse/adapt/reject map

| Disposition | Items |
|-------------|-------|
| Reuse (patterns; code adaptable with provenance) | Strict TypeScript flag set (equals the ADR DEC-3 set); script layout (`lint`, format check, `typecheck`, `test`, boundary check, aggregate `check`, per-package + root); imports-alias layering with alias-resolving boundary rules; ESM module layout (`type: module`, bundler resolution); exports at `dist` + types; exact runtime pin discipline. |
| Adapt | Tier names → the ADR set (`domain`/`app`/`config`/`branding`/`state`), not marksync's `infra`/`cli`/`shared`; single-package boundary rules → the full ADR DEC-2 matrix + subpath permissions + testkit dev edges + fixtures; alias maps designed per package class (core tiers; commands/output for surfaces; per-provider modules for adapters). |
| Reject | marksync branding and Confluence domain logic (owner directive); MIT license assumptions (ADOS is Apache-2.0); the single-package `src/` tree; the four-rule boundary configuration treated as complete; silent malformed-input handling patterns. |
| Plan-stage note | cliffy (`@jsr/cliffy__command`) — intended CLI framework for later CLI surface work; not a scaffold dependency (NG-8). |

### Appendix B — ADR-0003 constraint applicability at scaffold

| Constraint | Scaffold obligation |
|------------|---------------------|
| C-1 | One OSS monorepo, additive in this repository; no cloud. |
| C-2 | Registry seeded with the scaffold dev-toolchain set and a minimal fail-closed audit in CI (DEC-10); full policy/deny-list, notices, and SBOM gates are M0-S18/release-time work. |
| C-3 | Neutral `@delivery-os/*` scope; no product literals anywhere outside the (future) branding module; brand-free ignore glob laid now. |
| C-4 | No cloud names/designs/code. |
| C-5 | Additive `packages/`; existing layout and bash authority untouched. |
| C-6 | `.opencode/`/`.ados-claude/` untouched. |
| C-7 | Pins (pnpm + four-copy Bun) with CI equality; publish guard active; installer registration deferred until artifacts exist. |
| C-8 | No existing gate weakened; new gates binding. |
| C-9 | Runtime-neutral core tiers by structure (confinement rules + fixtures now); non-Bun driver path recorded (DEC-3 above); portability smokes deferred to first content (7.3). |
| C-10 | SHA-pinned actions, job-scoped permissions, vulnerability gate from first dependency. |
| C-11 | Not applicable yet (no persisted data); attaches at M0-S5. |

### Appendix C — References

- ADR-0003 — OSS Tooling Monorepo Structure (authoritative; DEC-1, DEC-2, DEC-3, DEC-7, DEC-8, DEC-9; constraints C-1..C-11; implementation plan step 1; scaffold stop conditions).
- Backlog, Epic M0, story M0-S1 (ticket GH-170) — goal, tasks, ACs.
- CLI command registry, foundation stories table — M0-S1 row.
- PM planning summary and pm-notes (2026-10-29) — owner directive, resolved scaffold-step decisions, risks.
- marksync-for-confluence — reference files per owner directive: package manifest (module type, engines pin, exports, aliases, scripts, dev dependencies), TypeScript config (flag set), boundary configuration (forbidden-rule pattern with alias resolution).

## 25. DOCUMENT HISTORY

| Version | Date | Author | Changes |
|---------|------|--------|---------|
| 1.0 | 2026-10-29 | @spec-writer | Initial specification (fresh authoring after an interrupted earlier attempt; nothing was previously written) |

---

## AUTHORING GUIDELINES

- Sources: ADR-0003 (authoritative, read in full), backlog M0-S1, cli-command-registry M0-S1 row, PM planning summary with the 2026-10-29 owner directive, and the existing pm-notes for this change. Format conventions follow a recent repo spec (GH-151).
- All scaffold-step decisions were resolved by the PM in planning; they are recorded with chosen-vs-adapted rationale rather than re-opened. No decision was invented here.
- The one unresolved conflict (license-registry stop condition vs M0-S18 story split) is captured as OQ-1 for `@decision-advisor` rather than silently resolved.
- Scope discipline: scaffold is structure-over-content; anything requiring real content (contracts, config, state, branding values, drivers) is explicitly out of scope with its owning story.
- No license headers: `doc/changes/` artifacts are temporary working files and never receive headers.

## VALIDATION CHECKLIST

- [x] `change.ref` matches provided `workItemRef` (GH-170)
- [x] `owners` has at least one entry
- [x] `status` is "Proposed"
- [x] All sections present in order (1-25 + guidelines + checklist)
- [x] ID prefixes consistent and unique (F-1..F-14, DM-1..DM-4, NFR-1..NFR-10, RSK-1..RSK-6, OQ-1, DEC-1..DEC-10, AC-*)
- [x] Acceptance criteria reference at least one F-/NFR-/DM- ID and use Given/When/Then
- [x] NFRs include measurable values
- [x] Risks include Impact & Probability
- [x] No implementation details (no code-level file paths, no step-by-step tasks)
- [x] No content duplicated from linked docs (ADR cited, not restated)
- [x] Front matter validates per front_matter_rules
- [x] All three ticket ACs covered and mapped (see Section 17 coverage note)
