---
id: SPEC-CONFIG-LAYER
status: Current
created: 2026-10-30
last_updated: 2026-10-30
owners: ["engineering"]
service: delivery-os
summary: "The implemented seven-layer configuration system: ordered defaults, platform and repository sources, environment and CLI facts, a trusted draft-07 partial/final schema, an empty production catalog with typed extensions, source restrictions, reset and warning semantics, real origin evidence, the config inspection command in human and machine modes, and nine classified config errors."
links:
  related_changes: ["GH-173"]
  related_decisions: ["ADR-0003", "TDR-0003"]
---

# Feature: Configuration Layer and Inspection

## Overview

Configuration resolves from seven ordered layers into one validated, traceable tree. Resolution is pure in `@delivery-os/core`; acquisition of files, platform locations, repository roots, environment facts and legacy names lives behind the existing adapters and the runtime-aware CLI edge. The production ordinary catalog is empty, so a fresh installation resolves to `{}` until a consumer declares typed settings.

Every source is validated before it is merged, every effective value can report where it came from, and inspection through the `config` command uses the same serialization and redaction boundary as every other command. Configuration cannot rename the frozen brand identity, supply a credential from a repository file, or silently interpolate environment values into files.

The authoritative selection is [ADR-0003](../../decisions/ADR-0003-oss-monorepo-structure.md) DEC-4. [TDR-0003](../../decisions/TDR-0003-config-parser-schema-and-acquisition.md) records the YAML, schema, bootstrap and acquisition mechanics as a Proposed decision pending owner review; its machine approval flags are not human compatibility acceptance.

## Business Context

### Problem Statement

- **Problem:** Without one ordered and validated configuration model, operators and agents cannot explain which value wins, repository files can silently supply secrets, CI can read workstation settings, and configuration failures become unclassified crashes.
- **Affected Users:** Operators configuring a local installation, CI maintainers, command authors, and later consumers that need typed settings.
- **Business Impact:** Configuration is the input boundary for later credentials, providers and state. A weak boundary propagates unsafe defaults; a checked boundary keeps later consumers small and predictable.

### Goals

- Provide deterministic precedence across defaults, machine files, repository files, environment and explicit CLI flags.
- Validate every supplied layer and the final tree against one trusted schema before returning a snapshot.
- Preserve real source positions and ordered loaded/skipped evidence.
- Keep repository files from supplying secrets or machine paths and keep CI from reading ambient workstation configuration.
- Expose basic, debug and key lookup in human and machine modes through one redacted output path.
- Keep credential resolution, sidecar transport and remote mediation outside this feature.

## User Experience & Functionality

### Seven layers

| Priority | Layer | Source |
|---:|---|---|
| 1 | Defaults | Typed catalog declarations and the shipped defaults-position manifest |
| 2 | System | Linux ordered `XDG_CONFIG_DIRS` (default `/etc/xdg`), macOS `/Library/Application Support`, Windows `%PROGRAMDATA%` |
| 3 | User-global | Linux `XDG_CONFIG_HOME` or `~/.config`, macOS `~/Library/Application Support`, Windows `%APPDATA%` |
| 4 | Project-committed | `<repo>/<configDirectoryName>/config.yaml`, or the selected file |
| 5 | Project-local | `<repo>/<configDirectoryName>/config.local.yaml` |
| 6 | Environment | Catalog-declared names built from `<environmentPrefix>` and dotted paths |
| 7 | CLI | Catalog-declared flag mappings |

`<configDirectoryName>` and `<environmentPrefix>` are brand-derived parameters supplied by the frozen `BrandIdentity`; no product name is committed in this document. A selected file (`--config <path>`, then `<environmentPrefix>CONFIG`, then a recognized legacy selector) occupies the project-committed slot. It is not an eighth layer. The selected file's actual path and positions are reported.

### Discovery and CI controls

- Discovery starts at the current directory and stops at the first git root; linked-worktree `.git` files are supported. It never searches above that root.
- `--project-root <directory>` supplies an explicit bounded root even outside git. It does not enable a CI-disabled source.
- Only the root files are read, never intermediate or parent decoys.
- With `CI=true`, system, user-global and project-local sources are skipped as `ci-disabled` unless enabled independently by `--enable-system-config`, `--enable-user-config`, and `--enable-project-local-config`.
- A selected file makes project-local `selected-config` regardless of CI, root or local enablement, with no local read.
- Skip evidence is first-match and ordered: system and user-global (`ci-disabled`, then `missing`), project-committed (`no-git-root`, then `missing`, never when selected), project-local (`selected-config`, `ci-disabled`, `no-git-root`, `missing`). A skipped source is never read.
- A missing or unreadable selected file fails `config.value.invalid`; it is not reported as an optional skip.

### Schema and catalog

One trusted draft-07 schema is generated from the typed catalog. A recursively relaxed partial view validates each supplied layer; the final view enforces required fields after merge. The validator performs no coercion, does not remove unknown properties, and does not insert defaults.

- `$schema` and `reset` are recognized wrappers, validated and excluded from the effective tree. `$schema` never loads another schema.
- `x-` data is allowed in files as vendor data but does not create environment or CLI mappings.
- Unknown ordinary keys fail `config.key.unknown`; invalid types, directive shapes and disallowed null fail `config.value.invalid`.
- Explicit null requires catalog permission.
- The ordinary production catalog and defaults are empty. `workingName` is the separate required bootstrap descriptor, supplied before discovery and never a mutable config key.
- Typed extension catalogs exercise the same production resolver for required, nullable, defaulted, deprecated, nested, list, secret and machine-path fields. They are not production settings.

### Merge, reset, warnings and origins

Scalars and new collections replace lower values. Nested maps merge recursively when both sides are maps; lists replace as a whole, including element origins. `reset` paths are validated before setting and remove inherited descendant values and origins. Unaffected sibling origins survive.

Deprecated and shadowed inputs produce safe warnings that name the kind, layer and key, never the value. `--strict` converts any warning into `config.warning.strict` and returns no partial tree.

Origin grammar is exact:

- File layers: `layer=<layer> file=<path> line=<n>`.
- Built-in defaults: `layer=defaults file=core/src/config/defaults.ts line=<n>`, with the line verified against the typed source by the shipped manifest.
- Environment: `layer=environment env=<KEY>`.
- CLI: `layer=cli flag=<--flag>`.

File lines are the winning value node's real 1-based start line. Array elements retain their own positions; empty collections use their collection position; supported aliases use the referenced value position. Environment and CLI origins have no file or line. A source-less missing-required failure invents no line.

### Inspection command

`config`, `config debug`, `config --debug`, `config get <key>` and `config get <key> --show-origin` accept the global `--json`, selector/root flags and the strict/enable flags above.

Without `--json`:

- Basic success prints the effective tree as one JSON value.
- Debug success prints `{ "config": <tree>, "origins": { "<dottedKey>": "<origin>" }, "loadedFiles": ["<path>"], "skippedLayers": [{ "layer": "<layer>", "reason": "<reason>" }] }`.
- Get success prints the JSON value; with `--show-origin` it prints `{ "key": "<dottedKey>", "value": <value>, "origin": "<origin>" }`.
- Warnings and human failure diagnostics go to the error stream through the same redaction boundary.

With `--json`, the identical selected success payload is placed under `CommandResult.data`; one envelope is written, never a second bare document. Failures use `CommandResult.error` with no partial `data`. Secret values registered by the runtime edge are redacted from every mode before any byte is written. File-supplied secrets are rejected before merge rather than relying on redaction.

### Errors

Config failures carry `kind=config` and one exact code; all are `category=user`, `retryable=false`, `consequence=not_landed`, and project to `user-validation`/exit 1:

`config.file.malformed`, `config.key.unknown`, `config.environment.unmapped`, `config.value.invalid`, `config.interpolation.rejected`, `config.secret.forbidden`, `config.path.forbidden`, `config.reset.invalid`, and `config.warning.strict`.

The machine table in [Result Contract and Error Table](feature-result-contract.md) is the single identity source; the documented rows and machine rows are synchronized in both directions. Missing, unknown or wrong-kind config codes are safely contained as `fallback.internal`, never mapped to the first config row.

## Technical Architecture & Codebase Map

| Path | Responsibility |
|---|---|
| `packages/core/src/contracts/config.ts` | Plain JSON-compatible facts, layers, origins, skips, warnings and failure identity |
| `packages/core/src/config/catalog.ts` | Typed catalog, bootstrap descriptor and empty production catalog |
| `packages/core/src/config/schema.ts` | Trusted schema generation, partial/final compilation and safe invalid-key detection |
| `packages/core/src/config/defaults.ts` | Typed default extraction and empty production defaults |
| `packages/core/src/config/resolver.ts` | Pure seven-layer validation, merge, reset, restrictions, warnings and origins |
| `packages/core/src/config/provenance.ts` | Origin replacement, descendant removal and display grammar |
| `packages/adapters/src/file/yaml-parser.ts` | YAML 1.2 one-document parsing, bounds, positions and safe diagnostics |
| `packages/adapters/src/file/config-source.ts` | Platform paths, DM-2 eligibility, selected/root handling and loaded/skipped facts |
| `packages/adapters/src/repo/index.ts` | Bounded git/worktree root discovery |
| `packages/adapters/src/legacy/index.ts` | Pre-freeze environment/selector mapping with current names winning |
| `packages/cli/src/edge.ts` | Frozen bootstrap, source/legacy composition, secret registration and manifest injection |
| `packages/cli/src/commands/config.ts` | Basic/debug/get payload shaping and unknown-key failure |
| `packages/cli/src/output/serialize.ts` | Sole redacted output chokepoint |

Core configuration imports only its contracts and the trusted validator; it does not import branding, adapters, YAML or Node runtime helpers. YAML parsing and platform discovery stay in the file adapter. Adapters receive plain facts; no YAML document or validator type crosses the `ConfigSource` port. The CLI edge resolves `BrandIdentity` once, before discovery, and a file can never rename it or cause rediscovery.

## Security and Boundaries

- Environment values are compared by exact catalog mapping; unrelated prefixed names fail `config.environment.unmapped` rather than being ignored.
- In-file `{env:...}` and `${VAR:-default}` interpolation is rejected as `config.interpolation.rejected`.
- Catalog-designated secrets are environment-only; both repository layers and other non-environment sources fail `config.secret.forbidden` before merge. Defaults and CLI are checked as well.
- Catalog-designated machine paths are system/user-global only; other layers fail `config.path.forbidden`.
- The actual host `LOG_TOKENS` or `LOG_STREAM` switch causes a safe `config.value.invalid` before the YAML parser is constructed. The parser never forwards source text, snippets, stacks or raw summaries.
- The edge registers non-empty catalog-designated environment secrets before inspection. Redaction runs at the single serialization chokepoint.
- Disabled or selection-skipped sources are never read, including poisoned files present on disk.
- No credential, keyring, sidecar, transport or remote-mediated operation is implemented here. The M0-S12 story supplies one credential-resolution port later (environment-backed initially); a later sidecar may replace it. Direct and mediated adapters implement the same unchanged primitive ports, with mediated operations forwarded locally rather than receiving local credentials. That is a documentation-only adoption path for this change.

## Operational & Support

### Configuration and artifacts

The core build emits the trusted `config.schema.json`, the defaults-position manifest and source identity files into `dist/config`. The existing exports-parity check validates that the shipped schema, manifest and defaults source identity stay synchronized with the typed source. Packed consumers import the built core `.` entry and core `./contracts`, plus the existing adapters `./file`, `./repo` and `./legacy` entries; no `./config` core subpath or new adapter subpath exists.

### Inspection workflow

1. Resolve once with the frozen brand and injected runtime facts.
2. Use `config debug` to see loaded and skipped evidence plus every effective origin.
3. Use `config get <key> --show-origin` to compare a value with its winning origin.
4. Use `--strict` in CI or automation when deprecated or shadowed input must stop the run.
5. Use `--json` only when a machine envelope is required; human mode prints the same selected payload as plain JSON.

### Cost and limitations

Configuration adds the proposed Ajv and YAML runtime dependencies recorded in the dependency registry; owner license/TDR review gates merge/adoption. The ordinary catalog is intentionally empty, so no production setting or default is invented by this feature. File interpolation, credentials and sidecar behavior are not available.

## Quality Assurance Strategy

| Level | Scope | Evidence |
|---|---|---|
| Behaviour | Seven winners, merge/reset, schema, restrictions, provenance, parser, sources, legacy | `tests/behaviour/config-*.test.ts`, `tests/behaviour/legacy-adapter.test.ts` |
| CLI/golden | Basic/debug/get, human and machine payloads, redaction and canaries | `tests/behaviour/config-cli.test.ts`, `tests/golden/config-output.test.ts` |
| Structure | Inventory, root API, no public config subpath, import confinement | `tests/structure/config-contract.test.ts`, `tests/structure/content-inventory.test.ts`, `tests/boundaries/**` |
| Checks | Default/schema artifact parity, error rows, license closure | `tests/checks/config-default-positions.test.ts`, `tests/checks/error-table-sync.test.ts`, `tests/checks/license-audit.test.ts` |
| Packed | Node/Bun packed consumers and artifact presence | `tests/checks/packed-config.test.ts` |

## Dependencies & Risks

- **Depends on** the branding seam for `BrandIdentity` values and the frozen working-name edge.
- **Depends on** the result contract for envelope, error identity, exit projection and the sole redaction boundary.
- **Depends on** the monorepo scaffold for package tiers, boundary rules, runtime-API confinement and the aggregate check.
- **Risk — unsafe repository input:** mitigated by per-layer restrictions before merge, environment-only secrets and no interpolation.
- **Risk — CI reads workstation configuration:** mitigated by `CI=true` defaults, independent enable flags and zero skipped reads.
- **Risk — untraceable values:** mitigated by per-node origins, the shipped defaults manifest and origin replacement rules.
- **Risk — parser diagnostics:** mitigated by safe constructed failures, host-switch guard and no parser text crossing the port.
- **Risk — dependency compatibility:** Proposed TDR-0003 and the truthful runtime-closure license registry require owner acceptance before merge/adoption.
- **Deferred:** credential resolution, keyring/sidecar, provider routing and state storage are owned by M0-S12 and later consumers.

## Glossary & References

| Term | Definition |
|---|---|
| ConfigSource | Plain-JSON acquisition port for ordered source facts; not a credential resolver. |
| Layer | One named precedence level in the seven-level chain. |
| DM-2 | The first-match skip-reason matrix: `selected-config`, `ci-disabled`, `no-git-root`, `missing`. |
| Effective tree | The validated tree after all layers and resets, excluding bootstrap and directives. |
| Origin | The winning source label for an effective leaf or collection. |
| Selected file | The `--config`/environment/legacy file occupying project-committed priority. |

See also: [Result Contract and Error Table](feature-result-contract.md), [Branding Seam and Working Name](feature-branding-seam.md), [Monorepo Scaffold and Toolchain](feature-monorepo-scaffold-toolchain.md), [ADR-0003](../../decisions/ADR-0003-oss-monorepo-structure.md), [TDR-0003](../../decisions/TDR-0003-config-parser-schema-and-acquisition.md), and the [repository glossary](../../overview/glossary.md).
