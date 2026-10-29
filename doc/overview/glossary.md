---
id: GLOSSARY
status: Current
created: 2026-10-29
last_updated: 2026-10-29
owners: ["engineering"]
area: domain
document_classification: current-truth
links:
  related_decisions: ["ADR-0003"]
  related_changes: ["GH-170"]
summary: "Reader-friendly glossary of the monorepo scaffold, toolchain, boundary-enforcement, quality-gate, and publish-path terms used across the repository."
---

# Glossary

_A broad, reader-friendly list of terms and acronyms. If a term names a domain model element, it belongs in the ubiquitous language instead (see `ubiquitous-language-template.md`). See the Documentation Handbook §9 for the glossary-vs-UL distinction._

## Terms

| Term / acronym | Definition | Category | Related UL term |
|---|---|---|---|
| Aggregate check | The single quality entry point `check` that chains `lint`, `format:check`, `typecheck`, `test`, and `check:boundaries` in that order. It exists at the workspace root and in every package; no alternate aggregate or bypass flag exists. | Quality | — |
| Brand-free glob | An ignore pattern that matches the project-local configuration path without naming any product, so it keeps matching after a rename. | Repository hygiene | — |
| Changesets fixed group | The changesets configuration that versions `core`, `adapters`, `cli`, `mcp`, and `opencode` on one shared version line. `testkit` is excluded from the group and from every published dependency graph. | Release | — |
| Composition root | The single `createRuntime({ config, adapters, store, clock })` entry declared in `core` `.`; surfaces call it instead of wiring engines themselves. The scaffold declares the signature only. | Architecture | — |
| Declared entrypoint | A subpath a package lists in its exports map, and which an importer must declare in its `workspaceImports` manifest field before importing. | Boundaries | — |
| Empty-but-enforced | Scaffold content policy: structure, exports, rules, fixtures, and green tests exist, while engines, business logic, provider implementations, and drivers are absent. | Scaffold | — |
| Fail-closed audit | A check that fails when required evidence is missing or ambiguous rather than passing by default. The license audit fails on an unregistered dependency, an empty license, or a disallowed SPDX branch. | Quality | — |
| Fixture-coverage meta-check | The test that fails when any configured boundary rule lacks a registered failing fixture, when a mandatory importer rule is missing, or when the ambient-global rule set is not covered. | Testing | — |
| Four-copy pin check | The CI equality check across `.bun-version`, the root `engines.bun` field, the CI `env.BUN_VERSION`, and the release workflow. `.bun-version` is the source of truth. | Toolchain | — |
| Lockstep versioning | One version line for the five publishable packages via the changesets fixed group; no package versions independently. | Release | — |
| Negative fixture | A test that deliberately introduces a forbidden edge and asserts the named boundary rule fails it. A rule without a negative fixture is unenforced and fails the meta-check. | Testing | — |
| Package matrix | The table of which packages may import which other packages. Forbidden edges are enforced by dependency-cruiser, one rule per importer row; declared edges are enforced by the workspace-entrypoints check. | Boundaries | — |
| Publish guard | The release-job check that fails when an intended publishable package is still `private: true` or the branded scope has not been applied. The publish job cannot start unless the guard passes. | Release | — |
| Runtime-API confinement | The rule that runtime imports are permitted only in the `core ./state` driver code, the adapter I/O subpaths (`repo`, `file`, `host`, `session`, `legacy`), the `cli` build, and the `opencode` host integration. | Boundaries | — |
| SPDX expression | A machine-readable license expression such as `MIT OR Apache-2.0`. The audit parses `AND`/`OR`/parentheses and fails closed on any disallowed branch. | Legal | — |
| Subpath | A package entrypoint declared in its exports map (for example `core ./contracts`). Cross-package imports use the package name plus a declared subpath; deep `src`/`dist` imports are forbidden. | Boundaries | — |
| Tier alias (imports alias) | A package-internal layer name declared as a Node `imports` subpath alias (for example `#domain/*` in `core`). The boundary checker resolves aliases, so a forbidden edge fails in alias form and relative form alike. | Boundaries | — |
| Workspace-entrypoints check | The `check:boundaries` stage (`scripts/checks/workspace-entrypoints.ts`) that enforces `workspaceImports`: declarations must match the expected matrix, every declared edge must resolve to a real export, and no `packages/*/{src,test}` file may import an undeclared `@delivery-os/*` subpath. | Boundaries | — |
| `workspaceImports` | The manifest field where each package declares the workspace-dependency entrypoints it may import. The workspace-entrypoints check enforces these declarations, so a new allowed edge requires a manifest change and review. | Boundaries | — |

## Acronyms

_Expand every acronym at first use; keep the expanded list here._

| Acronym | Expansion | First-use location |
|---|---|---|
| ADR | Architecture Decision Record | `doc/decisions/` |
| AST | Abstract Syntax Tree | `scripts/checks/ambient-globals.ts` |
| CI | Continuous Integration | `.github/workflows/ci.yml` |
| CLI | Command-Line Interface | `packages/cli/` |
| ESM | ECMAScript Modules | `packages/*/package.json` |
| MCP | Model Context Protocol | `packages/mcp/` |
| SPDX | Software Package Data Exchange | `doc/legal/dependency-licenses.yaml` |

## See also

- `ubiquitous-language.md` (when the project adopts a ubiquitous language)
- [Monorepo Scaffold and Toolchain](../spec/features/feature-monorepo-scaffold-toolchain.md)
- [ADR-0003 — OSS Tooling Monorepo Structure](../decisions/ADR-0003-oss-monorepo-structure.md)
