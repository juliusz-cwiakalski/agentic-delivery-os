---
ados_distribution: internal
id: SPEC-MONOREPO-SCAFFOLD-TOOLCHAIN
status: Current
created: 2026-10-29
last_updated: 2026-10-29
owners: ["engineering"]
service: delivery-os
summary: "The packages/ pnpm-workspace monorepo: six typed packages with declared subpaths and alias-based internal layering, one createRuntime composition root, mechanically enforced boundary matrices with negative fixtures, pinned pnpm/Bun and strict TypeScript toolchain, one aggregate check, dist-targeted exports with publint/attw, a pre-freeze publish guard with lockstep changesets, a fail-closed license registry, and additive binding TypeScript CI jobs beside the authoritative bash stack."
links:
  related_changes: ["GH-170"]
  related_decisions: ["ADR-0003"]
---

# Feature: Monorepo Scaffold and Toolchain

## Overview

The repository hosts a six-package pnpm workspace under `packages/` for the TypeScript delivery tooling, alongside the existing bash delivery stack. The workspace is **structure over content**: every declared package, subpath, export, boundary rule, fixture, and quality gate exists and is enforced, while engines, business logic, provider implementations, and drivers are intentionally absent (`empty-but-enforced`).

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
| `@delivery-os/core` | `.`, `./contracts`, `./state`, `./branding` | Runtime-neutral application services, contracts, state abstraction, branding seam |
| `@delivery-os/adapters` | `./gitlab`, `./jira`, `./github`, `./azure`, `./ci`, `./registry`, `./repo`, `./file`, `./host`, `./session`, `./legacy` | Tracker, VCS, CI, registry, and per-I/O adapters |
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

The signature is types-only. `RuntimeConfig`, `RuntimeAdapters`, `RuntimeStore`, `RuntimeClock`, and `Runtime` are placeholder contracts at scaffold; no implementation exists.

The `adapters` package's `./azure` subpath exists as an empty placeholder with no consumer.

### Internal layering (imports aliases)

Each package declares its internal layers as `imports` subpath aliases, so violations are caught in alias form and relative form alike:

| Package class | Aliases |
|---------------|---------|
| `core` | `#domain/*`, `#app/*`, `#config/*`, `#branding/*`, `#state/*`, `#contracts` |
| `adapters` | `#gitlab/*`, `#jira/*`, `#github/*`, `#azure/*`, `#ci/*`, `#io/*`, `#registry` |
| surfaces (`cli`, `mcp`, `opencode`) | `#commands/*`, `#output/*` |

`core` uses the ADR tier set `domain` / `app` / `config` / `branding` / `state`. The boundary configuration resolves aliases so an edge written with an alias and the same edge written relatively fail identically.

### Declared workspace entrypoints

Each package declares which entrypoints of its workspace dependencies it may import via the `workspaceImports` manifest field. The boundary rules read those declarations, so adding an allowed cross-package edge requires a manifest change and review.

| Importer | May import from `core` | May import from `adapters` |
|----------|------------------------|----------------------------|
| `adapters` | `./contracts` | — |
| `cli`, `mcp`, `opencode` | `.`, `./contracts`, `./state`, `./branding` | every declared adapters subpath |
| `testkit` | `.`, `./contracts` | every declared adapters subpath |

Deep imports into another package's `src/` or `dist/`, and relative paths escaping the package root, are forbidden.

### Boundary enforcement

`.dependency-cruiser.cjs` carries error-severity rules for:

- **Package matrix** — one rule per importer row: `core`, `adapters`, `cli`, `mcp`, and `opencode` cannot import forbidden sibling surfaces.
- **Core subpath permissions** — `adapters` may not import `core ./state`, `core ./branding`, or the core package root; `testkit` may not import undeclared core subpaths.
- **Deep and relative imports** — no `@delivery-os/<pkg>/(src|dist)/...` deep import and no relative import escaping the importer's package root.
- **Core tier matrix** — `domain`, `config`, `branding`, and `state` may import `./contracts` only; `app` may import `domain`, `config`, and `./contracts`, but not `branding` or `state` at scaffold.
- **Testkit dev edges** — production `src` never imports `testkit`; `testkit` imports `core` and `adapters`, never `cli`, `mcp`, or `opencode`.
- **Runtime-API confinement** — runtime imports are permitted only in the `core ./state` driver code, the adapter I/O subpaths, the `cli` build, and the `opencode` host integration.

`bun run scripts/checks/ambient-globals.ts` is the AST guard for two rule ids:

- `ambient-globals-neutral-tiers` — the neutral set (`core` `.` entry, `core/src/contracts/**`, and `core/src/{domain,app,config,branding}/**`) must not use ambient globals (`process`, `Bun`, `Deno`, timers, `fetch`) or ambient clock/randomness (`Date.now`, `Math.random`).
- `ambient-env-branding` — an environment read (`process.env` / `Bun.env`) inside the branding tier is classified under this rule.

The guard runs as part of `check:boundaries`.

### Negative fixtures and coverage

Every forbidden rule has at least one registered negative fixture. The harness materializes a throwaway workspace per case in a temporary directory, copies the production boundary configuration verbatim, verifies the clean baseline, injects the forbidden edge, and asserts the named rule fires. Clean-cruise controls prove allowed edges stay green.

`tests/boundaries/fixture-coverage.test.ts` is the meta-check: it fails when a configured rule has no registered case, when a mandatory importer rule is missing, when either `subpath-undeclared` form is unregistered, or when the ambient registry does not cover the neutral set. A rule without a failing fixture is therefore unenforced.

### Toolchain and pins

| Concern | Current configuration |
|---------|-----------------------|
| Package manager | `pnpm@10.18.3` pinned in `packageManager`; one committed `pnpm-lock.yaml`; CI installs with `--frozen-lockfile` |
| Runtime/build | Bun `1.4.4` recorded in four copies: `.bun-version`, root `engines.bun`, CI `env.BUN_VERSION`, and the release workflow |
| Modules | ESM everywhere (`"type": "module"`, bundler module resolution) |
| Type checking | One `tsconfig.base.json` with the full ADR strict flag set; per-package composite configs; root solution `tsconfig.json` referencing all six packages |
| Lint/format | One root `biome.json` (recommended preset, 2-space, 100-column) |
| Commit messages | One root `commitlint.config.js` (Conventional Commits); CI commitlint is the authority |
| Local hook | `.husky/commit-msg` is offline, warn-only, non-mutating, and always exits 0 |
| Build | `tsc` emits declarations, maps, and JavaScript to each package's `dist/` |
| Boundaries | `dependency-cruiser` + the ambient-globals AST guard |

### Quality entry points

The five named scripts exist at the root and in all six packages:

1. `lint`
2. `format:check`
3. `typecheck`
4. `test`
5. `check:boundaries`

Exactly one aggregate `check` chains them in that order: `lint → format:check → typecheck → test → check:boundaries`. No alternate aggregate or bypass flag exists. `pnpm check` is the single green/red signal for the workspace.

### Build and exports discipline

- Builds emit to `dist/`.
- Every exports target points at `dist/` and carries a `types` condition; no target points at `src/`.
- The five publishable packages pass `publint` and `@arethetypeswrong/cli` under the recorded ESM-only profile.
- `scripts/checks/exports-discipline.ts` asserts the exports map and the `files` allowlist.

### Publish path

- All six manifests are private; no `publishConfig` override exists.
- `.changeset/config.json` defines one fixed group covering `core`, `adapters`, `cli`, `mcp`, and `opencode`; `testkit` is excluded from versioning, tagging, and every published dependency graph.
- `scripts/checks/publish-guard.ts` fails when an intended publishable is still private or the branded scope has not been applied. It passes only in the freeze configuration.
- `.github/workflows/release.yml` is manual (`workflow_dispatch`) only. The publish job depends on the guard job, so no publish can start pre-freeze.

### License registry

`doc/legal/dependency-licenses.yaml` records the direct external dev-dependency set with exact versions, SPDX identifiers, source, and approved verdicts, plus the allow-list. `scripts/checks/license-audit.ts` parses SPDX expressions (AND/OR/parentheses) and fails closed on unregistered dependencies, non-allow-listed branches, empty licenses, or a registry/allow-list mismatch.

### Repository hygiene

`.gitignore` covers workspace dependency directories, root and per-package build output, local ephemeral state, and the project-local config via a brand-free glob that names no product.

### CI coexistence

The existing bash jobs remain byte-unchanged and authoritative. Fifteen additive `ts-*` jobs run beside them as binding gates:

`ts-fresh-clone`, `ts-invariants`, `ts-typecheck`, `ts-lint`, `ts-format`, `ts-test`, `ts-boundaries`, `ts-build`, `ts-exports`, `ts-pins`, `ts-publish-guard`, `ts-license-audit`, `ts-vuln`, `ts-aggregate`, `ts-commitlint`.

No gate uses `continue-on-error`, `|| true`, `set +e`, or an `exit 0` wrap; `scripts/checks/ci-bindingness.ts` rejects those constructs. Actions are SHA-pinned, permissions are job-scoped, and the vulnerability gate fails on any high or critical advisory.

## Technical Architecture & Codebase Map

| Path | Responsibility |
|------|----------------|
| `packages/*/package.json` | Manifests: exports, imports aliases, `workspaceImports`, scripts, privacy |
| `packages/*/tsconfig.json` | Composite configs extending the strict base |
| `packages/core/src/index.ts` | The `createRuntime` composition-root signature |
| `packages/*/src/**` | Placeholder sources and internal tier directories |
| `package.json` | Workspace root: pinned `packageManager`, five named scripts, aggregate `check`, dev toolchain |
| `pnpm-workspace.yaml` | Workspace globs (`packages/*`) |
| `tsconfig.base.json` / `tsconfig.json` | Strict base flags / solution references |
| `.dependency-cruiser.cjs` | Package, subpath, tier, testkit, and runtime-API rules |
| `scripts/checks/*.ts` | Repository invariant checks run with Bun |
| `tests/structure/**` | Inventory, subpath, exports, and `createRuntime` assertions |
| `tests/boundaries/**` | Negative fixtures, controls, and the fixture-coverage meta-check |
| `tests/behaviour/**` | pnpm isolation and commit-msg hook behaviour |
| `tests/checks/**` | Mutation and contract tests for `scripts/checks/*.ts` |
| `.changeset/config.json` | Lockstep fixed group and private-package policy |
| `.github/workflows/ci.yml` | Untouched bash jobs plus the additive `ts-*` fast loop |
| `.github/workflows/release.yml` | Manual pre-freeze publish guard and publish path |
| `doc/legal/dependency-licenses.yaml` | License verdict registry and allow-list |

### Package graph

```text
cli, mcp, opencode ──> core (., ./contracts, ./state, ./branding)
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
| NFR-6 | Exports discipline for the five publishables | `dist` + `types` only; publint and attw pass |
| NFR-7 | CI bindingness | No advisory job, bypass flag, or error-swallowing construct |
| NFR-8 | Bash stack | No regression; bash jobs remain authoritative |
| NFR-9 | Local commit-msg hook | Offline, non-mutating, never blocks an agent commit |
| NFR-10 | Dependency risk | 0 high/critical advisories; every direct dev dependency licensed and registered |

## Quality Assurance Strategy

| Level | Scope | Mechanism |
|-------|-------|-----------|
| Unit/structure | Package inventory, subpaths, exports, `createRuntime` | `bun test tests/structure` |
| Boundary | Every forbidden rule, alias and relative form | `bun test tests/boundaries` with the `mkdtemp` harness |
| Fixture coverage | Rule-to-fixture completeness | `tests/boundaries/fixture-coverage.test.ts` |
| Invariants | Manifests, pins, CI topology, bindingness, supply chain, exports, licenses | `bun run scripts/checks/*.ts` and mutation tests under `tests/checks/**` |
| Behaviour | pnpm isolation, commit-msg hook | `bun test tests/behaviour` |
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
- **Glossary:** [doc/overview/glossary.md](../../overview/glossary.md) — scaffold terms.
- **Change record:** `doc/changes/2026-10/2026-10-29--GH-170--monorepo-scaffold-toolchain/`.
