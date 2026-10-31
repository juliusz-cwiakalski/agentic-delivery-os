---
ados_distribution: internal
id: SPEC-MONOREPO-SCAFFOLD-TOOLCHAIN
status: Current
created: 2026-10-29
last_updated: 2026-10-31
owners: ["engineering"]
service: delivery-os
summary: "The packages/ pnpm-workspace monorepo: six typed packages with declared subpaths and alias-based internal layering, one createRuntime composition root, mechanically enforced boundary matrices with negative fixtures, the typed adapter-port substrate and secret-read boundary invariant, the durable local state layer, the provider engine and its confined quota transport, pinned pnpm/Bun and strict TypeScript toolchain, one aggregate check with CI-parity invariants, dist-targeted exports with publint/attw against the packed artifact, a pre-freeze publish guard with lockstep changesets, a fail-closed license registry, and additive binding TypeScript CI jobs beside the authoritative bash stack."
links:
  related_changes: ["GH-170", "GH-171", "GH-172", "GH-173", "GH-174", "GH-179", "GH-181", "GH-188", "GH-182"]
  related_decisions: ["ADR-0003", "ADR-0005"]
---

# Feature: Monorepo Scaffold and Toolchain

## Overview

The repository hosts a six-package pnpm workspace under `packages/` for the TypeScript delivery tooling, alongside the existing bash delivery stack. The workspace is **structure over content** for the remaining engines, business logic, and drivers: every declared package, subpath, export, boundary rule, fixture, and quality gate is enforced. The configuration and state tiers, the result contract, the adapter-era contracts, the pm-notes lint and phase-transition surface, the provider engine with its confined quota transport, and the Jira, GitLab, and GitHub client read slices are implemented and documented separately in [Configuration Layer and Inspection](feature-config-layer.md), [State Layer](feature-state-layer.md), [Result Contract and Error Table](feature-result-contract.md), [Adapter Ports, Credential Resolution, and Embedded Metadata](feature-adapter-ports.md), [PM-Notes Lint and Phase Transitions](feature-pm-notes-lint-and-phase-transitions.md), [Provider Engine](feature-provider-engine.md), and [Provider Client Seeds and Trap Catalogs](feature-provider-client-seeds.md); the remaining engines and the `azure` and `ci` provider subpaths are scaffold placeholders, and provider write operations are declared capability gaps.

The scaffold provides the substrate every later tooling story lands in. Its package matrix, core tier matrix, adapter subpaths, and runtime-API confinement rules are mechanical gates rather than prose, and every forbidden edge is proven by a failing negative fixture.

The authoritative design decision is [ADR-0003](../../decisions/ADR-0003-oss-monorepo-structure.md) (OSS tooling monorepo structure).

## Business Context

### Problem Statement

- **Problem:** Without a typed, boundary-enforced workspace, later tooling stories would accrete as loose scripts, duplicating surface logic and coupling adapters, state, and branding to the surfaces.
- **Affected Users:** Maintainers and AI agents implementing the tooling track; the bash delivery stack, which must keep working unchanged.
- **Business Impact:** Package and boundary precedent set here governs every later story; a weak scaffold propagates drift and makes the eventual publish path unsafe.

### Goals

- Provide a resolvable six-package workspace with declared entrypoints and one composition-root signature.
- Enforce the ADR-0003 dependency matrices mechanically, with a failing fixture per forbidden rule.
- Pin pnpm and Bun, keep the TypeScript configuration strict, and expose one aggregate quality entry point.
- Make the publish path safe before any artifact exists: private manifests, a release-job publish guard, and lockstep versioning.

## User Experience & Functionality

### Package set and entrypoints

| Package | Declared entrypoints | Role |
|---------|----------------------|------|
| `@delivery-os/core` | `.`, `./contracts`, `./state`, `./branding`, `./provider` | Runtime-neutral application services, contracts, state layer, branding seam, and the pure provider engine |
| `@delivery-os/adapters` | `./gitlab`, `./jira`, `./github`, `./azure`, `./ci`, `./registry`, `./repo`, `./file`, `./host`, `./session`, `./legacy`, `./credentials`, `./provider-quota` | Tracker, VCS, CI, registry, per-I/O adapters, the environment-backed credential port, and the quota transport |
| `@delivery-os/cli` | `.` | Command-line surface |
| `@delivery-os/mcp` | `.` | MCP surface |
| `@delivery-os/opencode` | `.` | OpenCode host integration surface |
| `@delivery-os/testkit` | `.` | Private, dev-only test harness |

All six packages are `private: true`, `version: 0.0.0`, and ESM (`"type": "module"`).

`core` declares the single composition-root signature:

```ts
createRuntime(options: {
  config: RuntimeConfig;
  adapters: RuntimeAdapters;
  store: RuntimeStore;
  clock: RuntimeClock;
}): Runtime;
```

The composition-root signature remains types-only. `RuntimeConfig`, `RuntimeAdapters`, `RuntimeStore`, `RuntimeClock`, and `Runtime` are placeholder contracts; the configuration capability is exposed through the separate `resolveConfig` core entry and the CLI edge rather than through `createRuntime`.

The `adapters` package's `./azure` subpath exists as an empty placeholder with no consumer.

### Internal layering (imports aliases)

Each package declares its internal layers as `imports` subpath aliases, so violations are caught in alias form and relative form alike:

| Package class | Aliases |
|---------------|---------|
| `core` | `#domain/*`, `#app/*`, `#config/*`, `#branding/*`, `#state/*`, `#provider/*`, `#contracts` |
| `adapters` | `#gitlab/*`, `#jira/*`, `#github/*`, `#azure/*`, `#ci/*`, `#io/*`, `#registry`, `#credentials/*`, `#provider-quota/*` |
| surfaces (`cli`, `mcp`, `opencode`) | `#commands/*`, `#output/*` |

`core` uses the ADR tier set `domain` / `app` / `config` / `branding` / `state`, plus the runtime-neutral `provider` policy tier. The boundary configuration resolves aliases so an edge written with an alias and the same edge written relatively fail identically.

In `core`, `#contracts` is a conditional `imports` target: `types` → `./dist/contracts/index.d.ts` and `default` → `./dist/contracts/index.js`. Emitted declarations preserve the `#contracts` specifier, and the published package ships only `dist`, so the alias must resolve to built targets. A package-local `paths` mapping in `packages/core/tsconfig.json` resolves `#contracts` to `./src/contracts/index.ts`, so source typechecking works before a build exists. The remaining core aliases (`#domain/*`, `#app/*`, `#config/*`, `#branding/*`, `#state/*`, `#provider/*`) stay src-relative.

### Declared workspace entrypoints

Each package declares which entrypoints of its workspace dependencies it may import via the `workspaceImports` manifest field. `scripts/checks/workspace-entrypoints.ts` is the live gate for those declarations: it holds the expected matrix, rejects a manifest that declares more or fewer edges than the matrix allows, requires every declared edge to resolve to an existing export, rejects workspace dependencies absent from `workspaceImports`, and scans `packages/*/{src,test}` for undeclared `@delivery-os/*` imports. Adding an allowed cross-package edge therefore requires a manifest change and review.

| Importer | May import from `core` | May import from `adapters` |
|----------|------------------------|----------------------------|
| `adapters` | `./contracts` | — |
| `cli` | `.`, `./contracts`, `./state`, `./branding`, `./provider` | every declared adapters subpath |
| `mcp`, `opencode` | `.`, `./contracts`, `./state`, `./branding` | every declared adapters subpath |
| `testkit` | `.`, `./contracts` | every declared adapters subpath |

Deep imports into another package's `src/` or `dist/`, and relative paths escaping the package root, are forbidden.

### Boundary enforcement

`.dependency-cruiser.cjs` carries error-severity rules for:

- **Package matrix** — one rule per importer row: `core`, `adapters`, `cli`, `mcp`, and `opencode` cannot import forbidden sibling surfaces.
- **Core subpath permissions** — `adapters` may not import `core ./state`, `core ./branding`, or the core package root; `testkit` may not import undeclared core subpaths.
- **Deep and relative imports** — no `@delivery-os/<pkg>/(src|dist)/...` deep import and no relative import escaping the importer's package root.
- **Core tier matrix** — `domain`, `config`, `branding`, and `state` may import `./contracts` only; `app` may import `domain`, `config`, and `./contracts`, but not `branding` or `state` at scaffold; the `provider` tier is part of the ambient neutral set and composes core contracts with its own modules.
- **Testkit dev edges** — production `src` never imports `testkit`; `testkit` imports `core` and `adapters`, never `cli`, `mcp`, or `opencode`.
- **Runtime-API confinement** — runtime imports are permitted only in the `core` state driver edge (`packages/core/src/state/driver/`), the adapter I/O subpaths, the `cli` build, and the `opencode` host integration. The adapter exemption is the ADR I/O subpaths — `repo`, `file`, `host`, `session`, and `legacy` — plus the credential implementation at `credentials`, the provider client subpaths `github`, `gitlab`, and `jira`, and the provider quota transport at `provider-quota`, all as exact, reason-bearing entries for network I/O per the [ADR-0005](../../decisions/ADR-0005-runtime-confinement-provider-client-subpaths.md) reviewed-allowance precedent; the provider registry and the remaining adapter subpaths (`azure`, `ci`) are not exempt. Runtime-API confinement matches Node core-module imports; the ambient-globals guard separately bans runtime globals in the core neutral tiers, including the provider tier.
- **State-tier structure** — `tests/structure/state-imports.test.ts` is an AST detector over `packages/core/src/state/**`: the tier imports `#contracts` and its own modules only, and runtime API use appears only inside the driver edge, proven by synthetic forbidden-import and runtime-API controls.

Package-name specifiers resolve through each manifest's `exports` to built `dist` targets, so the cross-package rules match both forms: `packages/<pkg>/src/...` in-tree and `packages/<pkg>/dist/...` for package-name imports. A `couldNotResolve` catch-all fails any `@delivery-os/*` specifier that resolves to no declared package entrypoint, so an undeclared import fails by name even before a build exists.

`check:boundaries` runs four gates in order: `depcruise packages` against `.dependency-cruiser.cjs`, then `bun run scripts/checks/ambient-globals.ts`, then `bun run scripts/checks/workspace-entrypoints.ts`, then `bun run scripts/checks/secret-read-boundary.ts`. The dependency-cruiser rules are static row definitions; the package-name and declared-entrypoint gate is `workspace-entrypoints.ts`; the ambient secret-acquisition gate is `secret-read-boundary.ts`.

The cruise runs against the built tree: package-name specifiers resolve through each manifest's `exports` to `dist`, so `check:boundaries` requires a prior `pnpm build`. The `ts-boundaries` CI job builds before cruising, and `scripts/checks/boundary-ci-parity.ts` binds that ordering — it fails when the job omits the `pnpm build` step or places it after `pnpm check:boundaries`.

`bun run scripts/checks/ambient-globals.ts` is the AST guard for two rule ids:

- `ambient-globals-neutral-tiers` — the neutral set (`core` `.` entry, `core/src/contracts/**`, and `core/src/{domain,app,config,branding,provider}/**`) must not use ambient globals (`process`, `Bun`, `Deno`, timers, `fetch`) or ambient clock/randomness (`Date.now`, `Math.random`).
- `ambient-env-branding` — an environment read (`process.env` / `Bun.env`) inside the branding tier is classified under this rule.

`bun run scripts/checks/secret-read-boundary.ts` is the AST guard for ambient secret acquisition across every workspace package production source (`packages/<pkg>/src/**` TypeScript, excluding `dist` and `node_modules`). Ambient environment access is permitted only in an enumerated allowlist. The v1 allowlist has four exact entries: the credential implementation directory (`packages/adapters/src/credentials`, class `credential-material`), the state driver runtime edge (`packages/core/src/state/driver/runtime-edge.ts`, class `configuration-environment-source`, for Windows owner-identity resolution in icacls ACL verification), and two pre-existing configuration environment readers (`packages/adapters/src/file/yaml-parser.ts` and `packages/adapters/src/legacy/index.ts`, class `configuration-environment-source`). Exactly one entry may be `credential-material`, and every entry carries a reason. Wildcards, prefixes, absolute paths, trailing separators, duplicate paths, and missing targets fail registry validation; an empty scan scope fails closed, so the gate cannot pass vacuously. The check detects `process.env`, `Bun.env`, and `Deno.env` property reads; element access to `env` or an ambient global by string-literal key; element access with a computed or template-literal key on `process`, `Bun`, `Deno`, or `globalThis`, which fails closed because a non-literal key cannot be checked statically; runtime imports of `process` or `bun`; and aliased ambient globals, while ignoring identifier positions such as property names, import specifiers, and type declarations. It runs in `check:boundaries` and as a binding step in the CI `ts-invariants` job; the behavior is documented in [Adapter Ports, Credential Resolution, and Embedded Metadata](feature-adapter-ports.md).

### Negative fixtures and coverage

Every forbidden rule has at least one registered negative fixture. The harness materializes a throwaway workspace per case in a temporary directory, copies the production boundary configuration verbatim, verifies the clean baseline, injects the forbidden edge, and asserts the named rule fires. Clean-cruise controls prove allowed edges stay green.

Fixture resolution mirrors production: fixture manifests point every `exports` target at `./dist`, and the harness materializes `dist` placeholder files, so package-name probes travel the same `exports`→`dist` path as the live tree. Forbidden edges are probed in package-name and relative-source form; clean-cruise controls prove allowed package-name edges stay green. The provider quota transport has a clean control, and the runtime-neutral provider core is the negative fixture for the new confinement admission.

`tests/boundaries/fixture-coverage.test.ts` is the meta-check: it fails when a configured rule has no registered case, when a mandatory importer rule is missing, when either `subpath-undeclared` form is unregistered, or when the ambient registry does not cover the neutral set. A rule without a failing fixture is therefore unenforced.

### Toolchain and pins

| Concern | Current configuration |
|---------|-----------------------|
| Package manager | `pnpm@10.18.3` pinned in `packageManager`; one committed `pnpm-lock.yaml`; CI installs with `--frozen-lockfile` |
| Runtime/build | Bun `1.4.4` recorded in four copies: `.bun-version`, root `engines.bun`, CI `env.BUN_VERSION`, and the release workflow |
| Modules | ESM everywhere (`"type": "module"`, bundler module resolution); relative source imports use explicit `.js` specifiers so emitted declarations resolve under `node16` ESM in the packed artifact |
| Type checking | One `tsconfig.base.json` with the full ADR strict flag set; per-package composite configs; root solution `tsconfig.json` referencing all six packages; a `tests/types/tsconfig.json` type-probe project chained into the root `typecheck` |
| Lint/format | One root `biome.json` (recommended preset, 2-space, 100-column) |
| Commit messages | One root `commitlint.config.js` (Conventional Commits); CI commitlint is the authority |
| Local hook | `.husky/commit-msg` is offline, warn-only, non-mutating, and always exits 0 |
| Build | `tsc` emits declarations, maps, and JavaScript to each package's `dist/` |
| Boundaries | `dependency-cruiser`, the ambient-globals AST guard, the workspace-entrypoints check, and the secret-read boundary check, chained in `check:boundaries` |

### Quality entry points

The five named scripts exist at the root and in all six packages:

1. `lint`
2. `format:check`
3. `typecheck`
4. `test`
5. `check:boundaries`

Exactly one aggregate `check` chains them in that order: `lint → format:check → typecheck → test → check:boundaries`, then appends the packed-exports invariant `bun run scripts/checks/exports-parity.ts` at the workspace root. No alternate aggregate or bypass flag exists. `pnpm check` is the single green/red signal for the workspace.

The root `typecheck` runs `pnpm -r typecheck` and then compiles the `tests/types/tsconfig.json` type-probe project, so compile-time contract probes outside the package graph fail the aggregate. The root `typecheck` and `test` scripts each declare a `pnpm build` prerequisite (`pretypecheck` and `pretest`). The aggregate therefore builds every package before it typechecks and tests, so package-name specifiers, emitted declarations, and conditional `imports` aliases resolve against built `dist` targets. `check:boundaries` runs after them, so the aggregate cruises the built tree it just produced; `exports-parity` then packs each publishable from the same `dist/`.

### Build and exports discipline

- Builds emit to `dist/`.
- Every exports target points at `dist/` and carries a `types` condition; no target points at `src/`.
- Relative imports between source files name the emitted file explicitly: `./result.js` for `src/result.ts`. TypeScript preserves the specifier in the emitted declarations, and the packed tarball is consumed under `node16` ESM resolution, where an extensionless relative specifier in a declaration does not resolve. Bundler-mode workspace typechecking accepts both forms and therefore does not prove pack resolution.
- The five publishable packages pass `publint` in the `ts-exports` job and `@arethetypeswrong/cli` under the recorded ESM-only profile against the packed artifact (`attw --pack . --profile esm-only`), not only the unpacked workspace tree.
- `scripts/checks/exports-discipline.ts` asserts the exports map and the `files` allowlist.
- `scripts/checks/exports-parity.ts` runs `attw --pack . --profile esm-only` for each publishable package against its built `dist/` and fails closed when `dist/` is missing, so a declaration graph that resolves only in the workspace fails the aggregate check.

### Publish path

- All six manifests are private; no `publishConfig` override exists.
- `.changeset/config.json` defines one fixed group covering `core`, `adapters`, `cli`, `mcp`, and `opencode`; `testkit` is excluded from versioning, tagging, and every published dependency graph.
- `scripts/checks/publish-guard.ts` fails when an intended publishable is still private or the branded scope has not been applied. It passes only in the freeze configuration.
- `.github/workflows/release.yml` is manual (`workflow_dispatch`) only. The publish job depends on the guard job, so no publish can start pre-freeze.

### License registry

`doc/legal/dependency-licenses.yaml` records direct external development and runtime uses plus the locked runtime closure, with exact resolved versions, SPDX identifiers, owners, dependency fields, and proposed approved verdicts, plus the allow-list. `scripts/checks/license-audit.ts` parses SPDX expressions (AND/OR/parentheses) and fails closed on unregistered uses, non-allow-listed branches, empty licenses, conflicting or missing versions, or a registry/allow-list mismatch.

### Repository hygiene

`.gitignore` covers workspace dependency directories, root and per-package build output, local ephemeral state, and the project-local config via a brand-free glob that names no product.

### CI coexistence

The existing bash jobs remain byte-unchanged and authoritative. Sixteen additive `ts-*` jobs run beside them as binding gates:

`ts-fresh-clone`, `ts-invariants`, `ts-typecheck`, `ts-lint`, `ts-format`, `ts-test`, `ts-boundaries`, `ts-build`, `ts-exports`, `ts-pins`, `ts-publish-guard`, `ts-license-audit`, `ts-vuln`, `ts-aggregate`, `ts-commitlint`, `ts-forbidden-literals`.

`ts-boundaries` builds before it cruises, and `ts-invariants` runs `scripts/checks/boundary-ci-parity.ts`, `scripts/checks/secret-read-boundary.ts`, and the other static invariants, so the two CI jobs stay ordered the way the local gates are.

The `ts-forbidden-literals` brand scan is specified in [feature-branding-seam.md](feature-branding-seam.md).

All `ts-*` jobs check out full history (`fetch-depth: 0`), so jobs that read a recorded commit SHA or a remote-tracking ref resolve it in CI.

No gate uses `continue-on-error`, `|| true`, `set +e`, or an `exit 0` wrap; `scripts/checks/ci-bindingness.ts` rejects those constructs. Actions are SHA-pinned, permissions are job-scoped, and the vulnerability gate fails on any high or critical advisory.

## Technical Architecture & Codebase Map

| Path | Responsibility |
|------|----------------|
| `packages/*/package.json` | Manifests: exports, imports aliases, `workspaceImports`, scripts, privacy |
| `packages/*/tsconfig.json` | Composite configs extending the strict base |
| `packages/core/src/index.ts` | The `createRuntime` composition-root signature |
| `packages/core/src/contracts/**` | Result, error-table, configuration, adapter-port, capability, credential, provider, and envelope contracts (types and `as const` data only) |
| `packages/*/src/**` | Internal tier directories; the configuration and state tiers, result contracts, adapter ports, the credential implementation, the envelope codec, file/repo/legacy adapters, pm-notes parsing, delivery-registry records, the provider engine and quota transport, the CLI inspection/lint/phase/provider commands, and the three provider client read slices carry implemented code, while the remaining engines and the `azure` and `ci` provider subpaths are placeholders and provider write operations are declared gaps |
| `packages/core/src/provider/**` | Pure provider validation, chain resolution, peak/quota evaluation, condition combination, park/announcement projection, the re-evaluation loop, and engine composition |
| `packages/adapters/src/provider-quota/index.ts` | Injectable quota transport and native-fetch production wrapper at the declared `./provider-quota` subpath |
| `packages/adapters/src/credentials/index.ts` | Environment-backed credential port implementation at the declared `./credentials` subpath |
| `packages/adapters/src/io/envelope-codec.ts` | Pure adapter-internal metadata envelope codec |
| `package.json` | Workspace root: pinned `packageManager`, five named scripts, aggregate `check`, dev toolchain |
| `pnpm-workspace.yaml` | Workspace globs (`packages/*`) |
| `tsconfig.base.json` / `tsconfig.json` | Strict base flags / solution references |
| `.dependency-cruiser.cjs` | Package, subpath, tier, testkit, and runtime-API rules |
| `scripts/checks/*.ts` | Repository invariant checks run with Bun |
| `tests/structure/**` | Inventory, subpath, exports, contract-surface, and `createRuntime` assertions |
| `tests/types/**` | Compile-time contract probes chained into the root `typecheck` |
| `tests/boundaries/**` | Negative fixtures, controls, and the fixture-coverage meta-check |
| `tests/behaviour/**` | pnpm isolation, commit-msg hook, adapter-port, credential, envelope, pm-notes lint, corpus, phase, delivery-registry, and provider-engine behaviour |
| `tests/checks/**` | Mutation and contract tests for `scripts/checks/*.ts` |
| `.changeset/config.json` | Lockstep fixed group and private-package policy |
| `.github/workflows/ci.yml` | Untouched bash jobs plus the additive `ts-*` fast loop |
| `.github/workflows/release.yml` | Manual pre-freeze publish guard and publish path |
| `doc/legal/dependency-licenses.yaml` | License verdict registry and allow-list |

### Package graph

```text
cli               ──> core (., ./contracts, ./state, ./branding, ./provider)
                  └─> adapters (every declared subpath)
mcp, opencode     ──> core (., ./contracts, ./state, ./branding)
                  └─> adapters (every declared subpath)

adapters          ──> core ./contracts

testkit (dev-only) ──> core (., ./contracts)
                   └─> adapters (every declared subpath)

core              ──> no workspace dependencies
```

`testkit` is a dev-only leaf: production sources never import it, and it is excluded from the publish line.

## Non-Functional Requirements

| ID | Requirement | Threshold |
|----|-------------|-----------|
| NFR-1 | Fresh-clone fast loop: install plus aggregate check | Green in CI with zero manual steps |
| NFR-2 | Boundary violations across the ADR matrices | 0 per pull request |
| NFR-3 | Negative-fixture coverage of forbidden rules | 1+ failing fixture per rule; missing fixture fails the check |
| NFR-4 | Pin equality (four Bun copies plus the pnpm pin) | Identical; checked every pull request |
| NFR-5 | Solution typecheck under the full strict flag set | Clean every pull request |
| NFR-6 | Exports discipline for the five publishables | `dist` + `types` only; publint and `attw --pack` pass against built `dist` |
| NFR-7 | CI bindingness | No advisory job, bypass flag, or error-swallowing construct |
| NFR-8 | Bash stack | No regression; bash jobs remain authoritative |
| NFR-9 | Local commit-msg hook | Offline, non-mutating, never blocks an agent commit |
| NFR-10 | Dependency risk | 0 high/critical advisories; every direct development/runtime use and locked runtime closure entry licensed and registered |

## Quality Assurance Strategy

| Level | Scope | Mechanism |
|-------|-------|-----------|
| Unit/structure | Package inventory, subpaths, exports, `createRuntime` | `bun test tests/structure` |
| Boundary | Every forbidden rule, alias and relative form, on production resolution | `bun test tests/boundaries` with the `mkdtemp` harness; `check:boundaries` for the gate |
| Fixture coverage | Rule-to-fixture completeness | `tests/boundaries/fixture-coverage.test.ts` |
| Invariants | Manifests, pins, CI topology, bindingness, supply chain, exports, packed-exports parity, boundary build/cruise parity, licenses, result-contract table sync, exit literals, secret-read boundary | `bun run scripts/checks/*.ts`, the aggregate check, and mutation tests under `tests/checks/**` |
| Type level | Contract typing probes outside the package graph | `tests/types/tsconfig.json` through the root `typecheck` |
| Behaviour | pnpm isolation, commit-msg hook, adapter ports, credentials, envelope round-trip and degradation, pm-notes lint, corpus acceptance, phase transitions, and delivery-registry records | `bun test tests/behaviour` |
| Aggregate | The whole workspace | `pnpm check` |

## Dependencies & Risks

- **Authoritative decision:** [ADR-0003](../../decisions/ADR-0003-oss-monorepo-structure.md).
- **Coexistence:** the bash delivery stack (`scripts/*.sh`, `tools/`, existing CI jobs) remains the authoritative delivery engine until later parity work.
- **Toolchain drift:** exact pnpm pin, committed lockfile, frozen-lockfile installs, and the four-copy Bun equality check keep local and CI environments aligned.
- **Fixture discipline:** adding a forbidden edge or a boundary rule requires a matching failing fixture in the same change; the meta-check rejects an unenforced rule.
- **Pre-freeze safety:** publication is blocked by manifest privacy and the release-job guard; the freeze change flips privacy, applies the branded scope, and removes the guard in one reviewed change.

## Related Documentation

- **Decision record:** [ADR-0003 — OSS Tooling Monorepo Structure](../../decisions/ADR-0003-oss-monorepo-structure.md).
- **Repository conventions:** [AGENTS.md](../../../AGENTS.md) — repo structure, `scripts/` and `tools/` conventions, running tests.
- **Testing rules:** [.ai/rules/testing-strategy.md](../../../.ai/rules/testing-strategy.md) — TypeScript test layer and aggregate check.
- **Configuration capability:** [Configuration Layer and Inspection](feature-config-layer.md).
- **Result capability:** [Result Contract and Error Table](feature-result-contract.md).
- **Adapter contract substrate:** [Adapter Ports, Credential Resolution, and Embedded Metadata](feature-adapter-ports.md).
- **State capability:** [State Layer](feature-state-layer.md).
- **Provider capability:** [Provider Engine](feature-provider-engine.md).
- **PM-notes and phase capability:** [PM-Notes Lint and Phase Transitions](feature-pm-notes-lint-and-phase-transitions.md).
- **Glossary:** [doc/overview/glossary.md](../../overview/glossary.md) — scaffold terms.
- **Change record:** `doc/changes/2026-10/2026-10-29--GH-170--monorepo-scaffold-toolchain/`.
- **Provider engine change record:** `doc/changes/2026-10/2026-10-31--GH-182--provider-v1/`.
