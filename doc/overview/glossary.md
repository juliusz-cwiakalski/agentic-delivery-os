---
id: GLOSSARY
status: Current
created: 2026-10-29
last_updated: 2026-10-30
owners: ["engineering"]
area: domain
document_classification: current-truth
links:
  related_decisions: ["ADR-0003"]
  related_changes: ["GH-170", "GH-171", "GH-172", "GH-173", "GH-174"]
summary: "Reader-friendly glossary of the monorepo scaffold, toolchain, boundary-enforcement, quality-gate, publish-path, branding-seam, result-contract, configuration-layer, and state-layer terms used across the repository."
---

# Glossary

_A broad, reader-friendly list of terms and acronyms. If a term names a domain model element, it belongs in the ubiquitous language instead (see `ubiquitous-language-template.md`). See the Documentation Handbook §9 for the glossary-vs-UL distinction._

## Terms

| Term / acronym | Definition | Category | Related UL term |
|---|---|---|---|
| Aggregate check | The single quality entry point `check` that chains `lint`, `format:check`, `typecheck`, `test`, and `check:boundaries` in that order. It exists at the workspace root and in every package; at the root it also appends the packed-exports parity check. No alternate aggregate or bypass flag exists. | Quality | — |
| App error code | Stable symbolic hierarchical failure identity `domain.reason.detail` (for example `provider.quota.exceeded`) that resolves to exactly one error-table entry. Prose is never identity. | Result contract | — |
| Brand-free glob | An ignore pattern that matches the project-local configuration path without naming any product, so it keeps matching after a rename. | Repository hygiene | — |
| Branding seam | The single place where the working name enters and all name-derived values leave: the pure resolver in `core ./branding` plus its resolver-input contract. Every other component receives brand values as parameters. | Branding | — |
| Changesets fixed group | The changesets configuration that versions `core`, `adapters`, `cli`, `mcp`, and `opencode` on one shared version line. `testkit` is excluded from the group and from every published dependency graph. | Release | — |
| CI parity check | An invariant that binds a local gate to the way CI executes it instead of duplicating its logic. `boundary-ci-parity` requires `ts-boundaries` to build before cruising (the boundary rules resolve package names through built `dist`), and `exports-parity` runs `attw --pack` per publishable so declarations must resolve inside the packed artifact. | Quality | — |
| Classification chain | The path from an engine failure to a table entry: domain kind -> app error code -> exit-code projection class. | Result contract | — |
| CommandResult envelope | The one result contract of every command: `schemaVersion`, `runId`, `exitCode`, `timing`, and exactly one of `data` or `error`. The generic `Result<T, E>` remains the internal computation result; the envelope is the command-surface rendering. | Result contract | — |
| Composition root | The single `createRuntime({ config, adapters, store, clock })` entry declared in `core` `.`; surfaces call it instead of wiring engines themselves. The signature remains declaration-only; configuration is exposed through the separate resolver and CLI edge. | Architecture | [feature-config-layer.md](../spec/features/feature-config-layer.md) |
| Consequence | Structured error field recording whether the attempted mutation landed: `landed`, `not_landed`, or `unknown`. `unknown` is first-class and mandatory on the two fallback entries. | Result contract | — |
| Corpus baseline | The fixed commit SHA recorded in the forbidden-literal registry that anchors the user-facing-doc membership rule. A doc absent at the baseline must be registered; an unreachable baseline fails the scan closed. | Branding | — |
| Declared entrypoint | A subpath a package lists in its exports map, and which an importer must declare in its `workspaceImports` manifest field before importing. | Boundaries | — |
| Domain kind | The engine-level failure classification a domain engine attaches to an error; the first link of the classification chain. Declared kinds are `provider`, `input`, `config`, and `state`, beside the reserved `fallback` containment kind. | Result contract | — |
| Empty-but-enforced | Scaffold content policy for the remaining engines, business logic, provider implementations, and drivers: structure, exports, rules, fixtures, and green tests exist. The configuration and state tiers carry implemented code. | Scaffold | [feature-config-layer.md](../spec/features/feature-config-layer.md) |
| Error table | The internal, machine-readable, single-source set of failure entries from which error identity, structured fields, and exit-code projection are all derived. Declared once in `core ./contracts` as data and types. | Result contract | — |
| Exit-code projection | The standalone CLI's mapping of table entries to `{0, 1, 2}`: `success` -> 0, `user-validation` -> 1, `platform-provider` -> 2. The only place exit codes exist. | Result contract | — |
| Fail-closed audit | A check that fails when required evidence is missing or ambiguous rather than passing by default. The license audit fails on an unregistered direct/runtime/transitive use, an empty license, or a disallowed SPDX branch. | Quality | — |
| Fallback entries | The two containment rows: `fallback.invocation` for broken invocations and unknown commands (category `user`, exit 1) and `fallback.internal` for unclassifiable failures (category `platform`, exit 2). Both are `consequence: unknown` and `retryable: false`. | Result contract | — |
| Fixture-coverage meta-check | The test that fails when any configured boundary rule lacks a registered failing fixture, when a mandatory importer rule is missing, or when the ambient-global rule set is not covered. | Testing | — |
| Forbidden-literal scan | The CI-binding check (`ts-forbidden-literals`) that fails when a seed literal appears in a DEC-8 scope class outside the DEC-8 allowlist, naming the file and token. The registry is its authority. | Branding | — |
| Four-copy pin check | The CI equality check across `.bun-version`, the root `engines.bun` field, the CI `env.BUN_VERSION`, and the release workflow. `.bun-version` is the source of truth. | Toolchain | — |
| Golden test | A test asserting captured output against a recorded fixture. The result contract uses goldens for success, void success, classified failure, unknown failure, broken commands, and planted-secret envelopes. | Testing | — |
| Legacy compatibility adapter | The `adapters ./legacy` subpath: maps pre-freeze-prefixed environment facts and the pre-freeze config directory to current names received as parameters, warning once per process. It never imports branding. | Branding | — |
| Lockstep versioning | One version line for the five publishable packages via the changesets fixed group; no package versions independently. | Release | — |
| Machine output | The `--json` channel: always exactly one valid envelope on every outcome, with no diagnostics. Written to the injected output stream. | Result contract | — |
| Negative fixture | A test that deliberately introduces a forbidden edge and asserts the named boundary rule fails it. A rule without a negative fixture is unenforced and fails the meta-check. | Testing | — |
| Package matrix | The table of which packages may import which other packages. Forbidden edges are enforced by dependency-cruiser, one rule per importer row; declared edges are enforced by the workspace-entrypoints check. | Boundaries | — |
| Publish guard | The release-job check that fails when an intended publishable package is still `private: true` or the branded scope has not been applied. The publish job cannot start unless the guard passes. | Release | — |
| Redaction chokepoint | The single serialization-path control that replaces every edge-registered secret value with `[redacted]` before any byte reaches an output stream, on success and failure payloads and on human diagnostics alike. Values never registered at the edge are outside the guarantee. | Result contract | — |
| Remediation hint | Action-first, secret-free guidance on what the caller should try next; prose, never identity. | Result contract | — |
| Rename drill | The documented RD-1..RD-11 procedure that replaces branding values and the legacy mapping in a temporary copy, runs the full verification battery, and proves a rename is one seam swap. It runs before release and whenever branding changes. | Branding | — |
| runId | Opaque per-invocation correlation identifier generated at the runtime-aware edge; present in every envelope. | Result contract | — |
| Runtime-API confinement | The rule that runtime imports are permitted only in the `core ./state` driver code, the adapter I/O subpaths (`repo`, `file`, `host`, `session`, `legacy`), the `cli` build, and the `opencode` host integration. | Boundaries | — |
| schemaVersion | The brand-neutral stable string identifying the envelope schema (`delivery.result.v1` at v1); changes only on a breaking shape change. | Result contract | — |
| Seed literal set | The three legacy tokens already public in the repository — the lowercase product token, its uppercase environment-prefix form, and its home-directory config path. It is the scan's searched set and grows by one literal per frozen name. | Branding | — |
| SPDX expression | A machine-readable license expression such as `MIT OR Apache-2.0`. The audit parses `AND`/`OR`/parentheses and fails closed on any disallowed branch. | Legal | — |
| Subpath | A package entrypoint declared in its exports map (for example `core ./contracts`). Cross-package imports use the package name plus a declared subpath; deep `src`/`dist` imports are forbidden. | Boundaries | — |
| Sync check | The binding invariant that every emitted or referenced app error code resolves to exactly one documented table entry and every documented entry exists in the machine-readable source; drift in either direction fails the CI fast loop. | Result contract | — |
| Tier alias (imports alias) | A package-internal layer name declared as a Node `imports` subpath alias (for example `#domain/*` in `core`). The boundary checker resolves aliases, so a forbidden edge fails in alias form and relative form alike. | Boundaries | — |
| Working name | The config-driven name from which all twelve brand values are derived. It is data supplied at a runtime-aware edge and is never a committed literal. | Branding | — |
| Workspace-entrypoints check | The `check:boundaries` stage (`scripts/checks/workspace-entrypoints.ts`) that enforces `workspaceImports`: declarations must match the expected matrix, every declared edge must resolve to a real export, and no `packages/*/{src,test}` file may import an undeclared `@delivery-os/*` subpath. | Boundaries | — |
| `workspaceImports` | The manifest field where each package declares the workspace-dependency entrypoints it may import. The workspace-entrypoints check enforces these declarations, so a new allowed edge requires a manifest change and review. | Boundaries | — |
| Configuration layer | One of the seven ordered configuration sources: defaults, system, user-global, project-committed, project-local, environment, and CLI. | Configuration | [feature-config-layer.md](../spec/features/feature-config-layer.md) |
| ConfigSource | Plain-JSON acquisition port carrying ordered source values, positions and safe failures; not a credential resolver. | Configuration | [feature-config-layer.md](../spec/features/feature-config-layer.md) |
| DM-2 | The configuration skip-reason first-match matrix: `selected-config`, `ci-disabled`, `no-git-root`, `missing`. | Configuration | [feature-config-layer.md](../spec/features/feature-config-layer.md) |
| Origin | The winning source label for an effective configuration leaf or collection. | Configuration | [feature-config-layer.md](../spec/features/feature-config-layer.md) |
| JSONL ledger | The append-only, schema-versioned, line-delimited JSON store that is the single durable truth of a state store. Every mutation is first a ledger record; derived documents and indexes are rebuildable projections. | State | [feature-state-layer.md](../spec/features/feature-state-layer.md) |
| State fence (lock token) | The single-writer lock for a state store: acquisition binds a caller-supplied token by exclusively creating a lock file, and a second acquisition fails `state.lock.busy`. Writes require the acquired handle; reads never do. | State | [feature-state-layer.md](../spec/features/feature-state-layer.md) |
| State level | The store scope declared in the injected identity. `local` is implemented; `project` and `global` are declared and fail `state.level.unsupported` with no filesystem effect until implemented. | State | [feature-state-layer.md](../spec/features/feature-state-layer.md) |
| Torn state | A state store that fails verification of framing, terminal completeness, sequence continuity, checksum, or index/ledger agreement. It is classified and reported, never read as empty or stale. | State | [feature-state-layer.md](../spec/features/feature-state-layer.md) |
| Verified-empty | Explicit evidence that a state store is absent or holds zero records. It satisfies only an empty key-set declaration; a non-empty declaration fails `state.keys.missing`. Verified-empty and torn are never conflated. | State | [feature-state-layer.md](../spec/features/feature-state-layer.md) |

## Acronyms

_Expand every acronym at first use; keep the expanded list here._

| Acronym | Expansion | First-use location |
|---|---|---|
| ADR | Architecture Decision Record | `doc/decisions/` |
| AST | Abstract Syntax Tree | `scripts/checks/ambient-globals.ts` |
| attw | `@arethetypeswrong/cli` | `scripts/checks/exports-parity.ts` |
| CI | Continuous Integration | `.github/workflows/ci.yml` |
| CLI | Command-Line Interface | `packages/cli/` |
| ESM | ECMAScript Modules | `packages/*/package.json` |
| MCP | Model Context Protocol | `packages/mcp/` |
| SPDX | Software Package Data Exchange | `doc/legal/dependency-licenses.yaml` |

## See also

- `ubiquitous-language.md` (when the project adopts a ubiquitous language)
- [Monorepo Scaffold and Toolchain](../spec/features/feature-monorepo-scaffold-toolchain.md)
- [Branding Seam and Working Name](../spec/features/feature-branding-seam.md)
- [Result Contract and Error Table](../spec/features/feature-result-contract.md)
- [Configuration Layer and Inspection](../spec/features/feature-config-layer.md)
- [State Layer](../spec/features/feature-state-layer.md)
- [ADR-0003 — OSS Tooling Monorepo Structure](../decisions/ADR-0003-oss-monorepo-structure.md)
