---
id: SPEC-CONFIG-LAYER
status: Current
created: 2026-10-30
last_updated: 2026-11-19
owners: ["engineering"]
service: delivery-os
ados_distribution: internal
summary: "The implemented seven-layer configuration system: ordered defaults, platform and repository sources, environment and CLI facts, a trusted draft-07 partial/final schema, the typed provider catalog branch with dynamic-name record maps (including the spend-ceiling budgets branch) and shipped overridable defaults, per-repository provider policy over the five layers that can declare a provider value, the typed commit branch with the phase-commit disable key, the typed merge branch (freshness bound, declared gate set, deploy expectations), the typed verify branch (the declared suite-to-job map), the typed metrics branch (the burn-rate threshold declaration), the typed harness branch (selected kind, declared integration mode with its origin, execution kind, store locations reconciled with the harness data directory and its store override, deny-by-default environment allowlist with a variable-only optional marker), the typed lane branch (liveness interval and restart budget), the typed queue branch (lease TTL and per-condition-type park recheck), the typed daemon branch (eleven cadence, transport, and socket keys), the typed coordinator branch (six supervision policy keys), and the typed poll branch (per-platform base, maximum, and minimum spacing), source restrictions, reset and warning semantics, real origin evidence, the config inspection command in human and machine modes, the per-layer prior-identity read fallback for the two repository-owned layers, and nine classified config errors."
links:
  related_changes: ["GH-173", "GH-181", "GH-182", "GH-175", "GH-176", "GH-227", "GH-224", "GH-225", "GH-251", "GH-233", "GH-234", "GH-235", "GH-237", "GH-238", "GH-241", "GH-277", "GH-280", "GH-286", "GH-288", "GH-300", "GH-320", "GH-299", "GH-335", "GH-350"]
  related_decisions: ["ADR-0003", "ADR-0008", "TDR-0003", "TDR-0021", "TDR-0042", "PDR-0006", "TDR-0057"]
---

# Feature: Configuration Layer and Inspection

## Overview

Configuration resolves from seven ordered layers into one validated, traceable tree. Resolution is pure in `@delivery-os/core`; acquisition of files, platform locations, repository roots, environment facts and legacy names lives behind the existing adapters and the runtime-aware CLI edge. The production ordinary catalog declares the typed `provider`, `commit`, `merge`, `verify`, `metrics`, `harness`, `lane`, `queue`, `daemon`, `coordinator`, and `poll` branches; unrelated configuration resolves to `{}` until a consumer declares typed settings.

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

### Prior-identity fallback

When the invoking identity declares a prior identity (the `jaiship` bin declares the pre-freeze working name; the compatibility alias declares none), the two repository-owned layers consider the prior identity's file as a second candidate:

| Layer | Candidate order | Both present | Explicit selection |
|---|---|---|---|
| Project-committed | current `<repo>/<configDirectoryName>/config.yaml` → prior `<repo>/<priorConfigDirectoryName>/config.yaml` → delivered `missing` skip | current file read; prior reported `config-skipped` | the selected file occupies the slot; no layer falls back |
| Project-local | current `<repo>/<configDirectoryName>/config.local.yaml` → prior `<repo>/<priorConfigDirectoryName>/config.local.yaml` → delivered `missing` skip | current file read; prior reported `config-skipped` | `selected-config` skip, no fallback |

The current file wins whenever it exists and the prior file is then reported **not used**; the prior file is read (as that same layer, with its real path recorded as the loaded file **and as the origin of every value it supplies**) only when the current file is absent. Machine-global layers never fall back, because the transitional claim is about artifacts the product created in a workspace. The fallback is strictly read-only — no write, copy, move, or deletion ever targets the prior directory — and is **not** a configuration warning, so `--strict` is unchanged and a prior read cannot become `config.warning.strict`. Skips, error codes, and warning kinds are unchanged.

The fallback is exercised by the delivered **composition-time acquisition**: the production composition resolves the daemon and lane settings over one read-only project-configuration acquisition before any handler runs, so every composed invocation performs it and `status --json` exercises the prior read without the change adding an acquisition to any command. The read reports itself once per source kind per composed program through the prior-identity fallback notice (`prior-identity-fallback`, reasons `config-read` and `config-skipped`) on stderr in every mode including `--json`, never in a payload and with no exit-code change. The notice survives a composition that then fails: the composition hands each notice line it already produced to the entrypoint's containment outcome, so an invalid working-name override that still reads the prior file emits its `config-read` line before `fallback.internal` answers at exit `2`, with the delivered summary and a clean payload. The operator-facing description is the [Local Install and Prior-Identity Transition](../../../guides/local-install.md) guide.

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
- Top-level `x-` keys are allowed in files as vendor data but do not create environment or CLI mappings.
- Unknown ordinary keys fail `config.key.unknown`; invalid types, directive shapes and disallowed null fail `config.value.invalid`.
- Explicit null requires catalog permission.
- The ordinary production catalog declares the typed `provider`, `commit`, `merge`, `verify`, `harness`, `lane`, `queue`, `daemon`, `coordinator`, and `poll` branches. The provider branch's dynamic-name maps (`provider.credentials`, `provider.entries`, `provider.chains`, `provider.profiles.profiles`, `provider.profiles.watch`, `provider.budgets`) use the additive `record` field kind: every child name is arbitrary and every child value is validated against the declared shape, while fixed branches keep exact unknown-key discipline.
- `workingName` is the separate required bootstrap descriptor, supplied before discovery and never a mutable config key.
- Typed extension catalogs exercise the same production resolver for required, nullable, defaulted, deprecated, nested, list, secret and machine-path fields. They are not production settings.

### Provider catalog branch

The provider branch is the first ordinary production setting. It declares:

- `provider.defaultChain`: the chain used when `--chain` is omitted; absent by default.
- `provider.credentials.<name>.sourceKey`: a `literal` key name or an `environment-prefixed` suffix; a credential reference, never secret material.
- `provider.entries.<name>`: a required `class` (`subscription` or `pay-per-token`), an `enabled` flag defaulting to `true`, an optional `peak` window in a declared IANA zone (its `timezone` value defaults to `UTC`), and an optional `quota` policy.
- `provider.chains.<name>`: a required non-empty `entries` list and an `allowPaidFallback` boolean defaulting to `false`.
- `provider.profiles`: the model-profile branch (GH-234). It declares dynamic-name `tiers` and `profiles` maps, a `preferenceChain`, a `pacing` block (ordered `goalPriorities`, `rungs`, tail threshold), a `watch` map keyed by provider name, and optional `envRecord` grammar overrides. Profiles reference declared providers and credentials; the branch ships empty (`provider.profiles: {}`), so no profile, chain, rung, or threshold is invented. The model is specified in [Provider Profiles and Watching](feature-provider-profiles.md).
- `provider.budgets`: the spend-ceiling branch (GH-350). It is a dynamic-name record map whose children are declared budgets, and it ships empty, so no ceiling is invented. The shape is:

| Key | Type | Default | Semantics |
|---|---|---|---|
| `provider.budgets.<name>.enabled` | boolean | `true` | A disabled budget is inert: no spend read, no condition, no announcement. |
| `provider.budgets.<name>.scope` | `ticket` or `window` | required | `ticket` measures the whole work-item ref; `window` measures the trailing span ending at the evaluation instant. |
| `provider.budgets.<name>.basis` | `cost` or `tokens` | required | The measured figure, from the delivered spend fold; `cost` is harness-reported units and is never re-priced. |
| `provider.budgets.<name>.ceiling` | positive number | required | A measurement at or above the ceiling is a crossing. |
| `provider.budgets.<name>.windowSeconds` | positive integer | required iff `scope` is `window`; refused on `ticket` | The trailing span in seconds. |
| `provider.budgets.<name>.entries` | non-empty list of declared descriptor names | absent means every declared entry | Restricts which entries the budget governs. |

Budget validation is fail-closed and names the offending field: an unknown `scope` or `basis`, a non-positive or non-integer `ceiling` or `windowSeconds`, a `windowSeconds` on a `ticket` scope (or its absence on a `window` scope), an entry naming no declared descriptor, an empty `entries` list, or an unknown child key fails with `provider.chain.invalid`, and no partial evaluation, park, announcement or spend read escapes. A wrong-typed child is the configuration layer's own `config.value.invalid` before the provider rules run. The evaluation semantics, the park/refusal split and the one-read injected totals port are specified in [Provider Engine](feature-provider-engine.md).

The shipped defaults declare one concrete subscription descriptor, `provider.entries.zai-coding-plan`, with an enabled UTC peak window of `06:00–10:00` and a `7200`-second buffer, and an enabled quota policy against the public Z.AI quota endpoint with credential reference `zai`. The matching `provider.credentials.zai` entry declares a `literal` source key named `ZAI_API_KEY`. `provider.chains` ships empty and `provider.defaultChain` is absent, so a fresh installation fails closed until an operator declares a chain. Every shipped value is overridable per layer and reports its origin through `config debug`.

The full field contract, evaluation semantics, and defaults are documented in [Provider Engine](feature-provider-engine.md); provider semantic-validation failures surface as `provider.chain.invalid` or `provider.chain.empty` from the provider engine, while schema-level configuration failures remain the configuration layer's classified errors.

### Per-repository provider policy

"Per-project provider overrides" is answered by the repository-owned layers, not by a project-keyed branch. A provider policy element — a descriptor, a chain, a profile, a watch target, or a budget — resolves through the same layered resolver as every other setting. Five layers can declare a provider value; the environment and CLI layers remain resolver layers but carry no declared provider node:

| Priority | Layer | Source |
|---:|---|---|
| 1 | Defaults | Typed catalog declarations and the shipped defaults manifest |
| 2 | System | Platform configuration directories |
| 3 | User-global | Operator configuration directory |
| 4 | Project-committed | `<repo>/<configDirectoryName>/config.yaml`, or the selected file |
| 5 | Project-local | `<repo>/<configDirectoryName>/config.local.yaml` |

The highest declaring layer wins for each value; project-local beats project-committed; record maps merge by child name, so a lower layer's sibling values survive; lists replace whole, including a chain's `entries` and a budget's `entries`; `reset` removes inherited descendants; and every effective value reports its exact winning origin. Origin grammar is unchanged: a file value reports `layer=<layer> file=<path> line=<n>`, and `config debug` / `config get <key> --show-origin` expose the same truth for the provider subtree as for any other key.

A repository-layer provider document is validated before it is merged, like every other layer, so a wrong-typed or unknown provider element refuses with the delivered `config.*` identity, and a semantically invalid element refuses the provider's `provider.chain.invalid` naming the offending field. Either way the run fails and never falls back to a machine-global value. Because the environment and CLI layers declare no provider node, a provider-shaped environment name refuses `config.environment.unmapped`, a provider-shaped flag refuses `config.key.unknown`, and this feature introduces no environment variable and no flag.

Under `CI=true` the project-committed document is the CI-visible provider policy: it is read, and project-local is reported `ci-disabled` with no read of it, unless `--enable-project-local-config` enables that layer independently. A selected configuration file (`--config <path>`, then the brand's selector variable, then a recognised legacy selector) occupies the project-committed slot and makes project-local `selected-config` with no local read; it is not an eighth layer.

One policy spanning several checkouts of one project is not expressible through these layers: each checkout resolves its own documents, and no key reads another checkout's policy. That is a declared boundary owned by the future project registry, and no `provider.projects.*` branch, key, state kind, command, or error identity exists in this feature. The product decision is recorded in [PDR-0006](../../decisions/PDR-0006-per-project-provider-policy-repository-config-layers.md) and the budget branch in [TDR-0057](../../decisions/TDR-0057-budget-ceilings-park-before-spend-injected-spend-totals.md).

The status digest consumes the resolved provider branch through the ordinary configuration resolver: `provider.defaultChain`, `provider.chains`, and `provider.entries`. It adds no configuration key, no tracker, VCS, CI, or repository-addressing branch, and no status-specific cap or threshold setting. Status reads the branch and never writes configuration; repository addressing comes from the checkout's `origin` remote. The consumer contract is in [Status Digest](feature-status-digest.md).

### Commit catalog branch

The commit branch is the second ordinary production setting. It declares one key:

- `commit.phaseCommit`: a boolean, defaulting to `true`, that decides whether `phase complete` lands the ledger transition and the conventional commit atomically for the project. Setting it to `false` records the transition alone with the durable basis `config-disabled`; the per-call `--no-commit` flag never overrides an explicit project disable.

The consumer contract, including the per-call opt-out and the convergence evidence, is in [Commit Primitive](feature-commit-primitive.md).

### Merge, reset, warnings and origins

Scalars and new collections replace lower values. Nested maps merge recursively when both sides are maps; lists replace as a whole, including element origins. `reset` paths are validated before setting and remove inherited descendant values and origins. Unaffected sibling origins survive. The provider branch follows the same rules: its record maps merge by child name, chain entry lists replace as a whole, and a reset removes inherited provider values.

Deprecated and shadowed inputs produce safe warnings that name the kind, layer and key, never the value. `--strict` converts any warning into `config.warning.strict` and returns no partial tree. Recognized legacy environment and selector names map to current names; the legacy adapter emits at most one safe compatibility notice per process, and that notice goes to the error stream.

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
- An unknown `get` key fails `config.key.unknown`; it never prints an empty success payload.
- Warnings and human failure diagnostics go to the error stream through the same redaction boundary.

With `--json`, the identical selected success payload is placed under `CommandResult.data`; one envelope is written, never a second bare document. Failures use `CommandResult.error` with no partial `data`. Secret values registered by the runtime edge are redacted from every mode before any byte is written. Catalog-designated secrets supplied by files are rejected before merge rather than relying on redaction.

### Errors

Config failures carry `kind=config`, one exact code, and optional safe location metadata (`layer`, `key`, `file`, `line`); source text, values and exceptions never enter a failure. All are `category=user`, `retryable=false`, `consequence=not_landed`, and project to `user-validation`/exit 1:

`config.file.malformed`, `config.key.unknown`, `config.environment.unmapped`, `config.value.invalid`, `config.interpolation.rejected`, `config.secret.forbidden`, `config.path.forbidden`, `config.reset.invalid`, and `config.warning.strict`. The credential port adds its own `config.credential.missing` row under the same domain kind; it is a credential-resolution failure, not a configuration-layer failure (see [Adapter Ports, Credential Resolution, and Embedded Metadata](feature-adapter-ports.md)).

The machine table in [Result Contract and Error Table](feature-result-contract.md) is the single identity source; the documented rows and machine rows are synchronized in both directions. Missing, unknown or wrong-kind config codes are safely contained as `fallback.internal`, never mapped to the first config row.

## Technical Architecture & Codebase Map

| Path | Responsibility |
|---|---|
| `packages/core/src/contracts/config.ts` | Plain JSON-compatible facts, layers, origins, skips, warnings and failure identity |
| `packages/core/src/config/catalog.ts` | Typed catalog, bootstrap descriptor, the production `provider`, `commit`, `merge`, `verify`, `harness`, `lane`, `queue`, `daemon`, `coordinator`, and `poll` branches, the `record` field kind for dynamic-name maps, and the lane- and coordinator-branch projections into typed settings |
| `packages/core/src/config/harness.ts` | Pure validation and projection of the resolved `harness` branch into typed settings (kind, execution kind, store paths, environment allowlist) with configuration-path origin evidence |
| `packages/core/src/config/schema.ts` | Trusted schema generation, partial/final compilation and safe invalid-key detection |
| `packages/core/src/config/defaults.ts` | Typed default extraction and the shipped overridable defaults, including the `harness`, `lane`, `queue`, `daemon`, and `coordinator` branches |
| `packages/core/src/config/resolver.ts` | Pure seven-layer validation, merge, reset, restrictions, warnings and origins |
| `packages/core/src/config/provenance.ts` | Origin replacement, descendant removal and display grammar |
| `packages/adapters/src/file/yaml-parser.ts` | YAML 1.2 one-document parsing, bounds, positions and safe diagnostics |
| `packages/adapters/src/file/config-source.ts` | Platform paths, DM-2 eligibility, per-layer prior-identity candidate ordering, selected/root handling and loaded/skipped/prior facts |
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
- The YAML parser rejects a source whose UTF-8 byte length exceeds 1048576 (`MAX_SOURCE_BYTES`) as `config.file.malformed`, and bounds nodes/depth/aliases at 2048/64/100. The source-size limit is measured in bytes, not UTF-16 code units.
- The edge registers non-empty catalog-designated environment secrets before inspection. Redaction runs at the single serialization chokepoint.
- Disabled or selection-skipped sources are never read, including poisoned files present on disk.
- No credential, keyring, sidecar, transport or remote-mediated operation is implemented in this feature. Credential resolution is the separate credential-resolution port in [Adapter Ports, Credential Resolution, and Embedded Metadata](feature-adapter-ports.md): one environment-backed implementation at the adapters `./credentials` subpath, with a later sidecar able to supply another implementation. Later direct and mediated adapters implement the same unchanged primitive ports, with mediated operations forwarded locally rather than receiving local credentials; that adoption path is documentation-only in this feature.

## Operational & Support

### Configuration and artifacts

The core build emits `config.schema.json`, `defaults-positions.json` and `schema-sources.json` into `dist/config`. The existing exports-parity check validates that the shipped schema, defaults-position manifest and schema-source hashes stay synchronized with the typed source. Packed consumers import the built core `.` entry and core `./contracts`, plus the existing adapters `./file`, `./repo` and `./legacy` entries; configuration adds no `./config` core subpath and no adapter subpath of its own. The provider engine consumes the same resolver and declares its own core `./provider` and adapters `./provider-quota` entrypoints, documented in [Provider Engine](feature-provider-engine.md). Credential resolution ships separately as the adapters `./credentials` entry documented in [Adapter Ports, Credential Resolution, and Embedded Metadata](feature-adapter-ports.md).

### Inspection workflow

1. Resolve once with the frozen brand and injected runtime facts.
2. Use `config debug` to see loaded and skipped evidence plus every effective origin.
3. Use `config get <key> --show-origin` to compare a value with its winning origin.
4. Use `--strict` in CI or automation when deprecated or shadowed input must stop the run.
5. Use `--json` only when a machine envelope is required; human mode prints the same selected payload as plain JSON.

### Cost and limitations

Configuration adds the proposed Ajv and YAML runtime dependencies recorded in the dependency registry; owner license/TDR review gates merge/adoption. The `provider`, `commit`, `merge`, `verify`, `harness`, `lane`, `queue`, `daemon`, `coordinator`, and `poll` branches are the ordinary production catalogs currently declared; the provider branch's Z.AI descriptor and credential reference ship as overridable defaults with no chain enabled, the commit branch ships `commit.phaseCommit` defaulting to `true`, the lane branch ships the `30000` ms cadence and `3` restart bound, and the coordinator branch ships the six supervision policy values. File interpolation, credential resolution through configuration, and sidecar behavior are not available here; credential resolution is the separate port documented in [Adapter Ports, Credential Resolution, and Embedded Metadata](feature-adapter-ports.md).

## Quality Assurance Strategy

| Level | Scope | Evidence |
|---|---|---|
| Behaviour | Seven winners, merge/reset, schema, restrictions, provenance, parser, sources, legacy, lane defaults and validation, the per-layer prior-identity fallback, and the classified fallback notice | `tests/behaviour/config-*.test.ts`, `tests/behaviour/legacy-adapter.test.ts`, `tests/behaviour/economics-budget-config.test.ts`, `tests/behaviour/prior-identity-config-fallback.test.ts`, `tests/behaviour/prior-identity-notice.test.ts` |
| CLI/golden | Basic/debug/get, human and machine payloads, redaction and canaries | `tests/behaviour/config-cli.test.ts`, `tests/golden/config-output.test.ts` |
| Structure | Inventory, root API, no public config subpath, import confinement | `tests/structure/config-contract.test.ts`, `tests/structure/content-inventory.test.ts`, `tests/boundaries/**` |
| Checks | Default/schema artifact parity, error rows, license closure, and the fallback's hermeticity (no read or write of the operator's real home or state root) | `tests/checks/config-default-positions.test.ts`, `tests/checks/error-table-sync.test.ts`, `tests/checks/license-audit.test.ts`, `tests/checks/prior-identity-hermetic.test.ts` |
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
- **Consumed by** the provider engine ([Provider Engine](feature-provider-engine.md)) for descriptors, credential references, chains, and shipped defaults.
- **Consumed by** the status digest ([Status Digest](feature-status-digest.md)) for the resolved provider branch only; status adds no keys.
- **Consumed by** the queue-ready ready-set ([Queue Ready](feature-queue-ready.md)) for the resolved provider branch only; it adds no keys and no queue-readiness settings.
- **Consumed by** the commit primitive ([Commit Primitive](feature-commit-primitive.md)) for the resolved `commit.phaseCommit` key that decides whether a phase completion lands its commit atomically.
- **Consumed by** the doctor diagnostic ([Doctor](feature-doctor.md)) for the resolved provider branch only, read tolerantly so a resolution failure becomes provider-check evidence; doctor adds no keys and no doctor configuration branch.
- **Consumed by** coordinator supervision ([Coordinator Supervision](feature-coordinator-supervision.md)) for the resolved `coordinator` branch; the six values are policy data and the branch reuses the existing configuration identities.
- **Consumed by** verify gates ([Verify Gates](feature-verify-gates.md)) for the one `verify.suite-map` node, read from the project-committed document alone rather than from a resolved merged tree.
- **Consumed by** the metrics report ([Metrics Report and Burn-Rate Alarms](feature-metrics.md)) for the one `metrics.burn-rate` node, read from the project-committed document alone rather than from a resolved merged tree. The node declares the threshold, basis, and window of the burn-rate alarm; absent means undeclared and no default threshold exists.
- **Separate capability:** credential resolution is the port documented in [Adapter Ports, Credential Resolution, and Embedded Metadata](feature-adapter-ports.md); keyring sources and sidecar transport remain later capabilities, and state storage is the separate [State Layer](feature-state-layer.md).

## Glossary & References

| Term | Definition |
|---|---|
| ConfigSource | Plain-JSON acquisition port for ordered source facts; not a credential resolver. |
| Layer | One named precedence level in the seven-level chain. |
| DM-2 | The first-match skip-reason matrix: `selected-config`, `ci-disabled`, `no-git-root`, `missing`. |
| Effective tree | The validated tree after all layers and resets, excluding bootstrap and directives. |
| Origin | The winning source label for an effective leaf or collection. |
| Selected file | The `--config`/environment/legacy file occupying project-committed priority. |
| Lane branch | The typed `lane.liveness-interval` and `lane.restart-budget` policy data with shipped defaults and existing configuration identities. |
| Queue branch | The typed `queue.lease-ttl` and `queue.park-recheck.<condition-type>` policy data with shipped defaults and existing configuration identities. |
| Coordinator branch | The typed `coordinator.stuck-window`, `coordinator.kill-grace`, `coordinator.restart-budget`, `coordinator.resume-context-limit`, `coordinator.collection-interval`, and `coordinator.progress-bound` policy data with shipped defaults and existing configuration identities. |
| Metrics branch | The typed `metrics.burn-rate` threshold declaration (positive `threshold`, `cost` or `tokens` `basis`, 1..90-day `window`) with no default; absent means undeclared and every defect is refused `config.value.invalid` before any read. |

See also: [Local Install and Prior-Identity Transition](../../../guides/local-install.md), [Provider Engine](feature-provider-engine.md), [Result Contract and Error Table](feature-result-contract.md), [Adapter Ports, Credential Resolution, and Embedded Metadata](feature-adapter-ports.md), [Branding Seam and Working Name](feature-branding-seam.md), [Monorepo Scaffold and Toolchain](feature-monorepo-scaffold-toolchain.md), [Session Lifecycle Economics](feature-session-lifecycle-economics.md), [Scheduling Engine](feature-scheduling-engine.md), [ADR-0003](../../decisions/ADR-0003-oss-monorepo-structure.md), [TDR-0003](../../decisions/TDR-0003-config-parser-schema-and-acquisition.md), and the [repository glossary](../../overview/glossary.md).

## The merge configuration branch

The production catalog declares a typed `merge` branch:

| Key | Shape | Default | Semantics |
|---|---|---|---|
| `merge.gate-freshness` | number (seconds) | `1800` | The declared verification-age bound; at-bound is stale (`>=`). A declared value that is not a finite non-negative number is refused `config.value.invalid`; the default applies only when the key is absent. |
| `merge.gates` | `{ schemaVersion, entries[] }` | absent | A schema-versioned declared gate set. An entry declares `id`, `recipe`, `surface`, optional `class`, and optional `job`. Declared sets replace the default wholesale and are validated semantically: unsupported versions, omitted built-ins, reserved-id redefinitions, duplicates, malformed entries, and extra fields are refused as `config.value.invalid`. |
| `merge.deploy-expectations` | `{ steps?, artifacts? }` | absent | The declared deploy expectation set for `verify deploy`; absent means the verdict can never be `verified`. A shape that is not an object, or whose present `steps` and `artifacts` are not string lists, is refused `config.value.invalid`. |

Every merge key reports its own per-value origin evidence, and a declared list replaces the earlier list. See
[Merge and Verify Deploy](feature-merge-verify-deploy.md).

## The verify configuration branch

The production catalog declares a typed `verify` branch with one key:

| Key | Shape | Default | Semantics |
|---|---|---|---|
| `verify.suite-map` | `{ schemaVersion, jobs[], local }` | absent | The declared suite-to-job map (schema `delivery.verify.suite-map.v1`). `jobs[]` entries carry exactly `job` (a single-line printable expected-check-run name, 1..120 characters: no C0 control, no DEL or C1 control, no U+2028 or U+2029 line or paragraph separator, no Unicode `Cf` format control, and no leading or trailing whitespace, matched exactly; each `job` value is unique) and `suites` (1..32 suite identifiers); `local` is 1..32 suite identifiers. A suite identifier matches `^[a-z][a-z0-9-]*$` at 1..64 characters and is unique within one list; at most 64 `jobs[]` entries are allowed. Absent means undeclared and no default map is invented. Every defect is refused `config.value.invalid` before any read. |

The branch constrains whole-document validity only for consumers that resolve the
merged tree; it is not a validator for this node, because it cannot express the
identifier grammar, the length and cap bounds, or list uniqueness, and the gates
surface never consumes its whole-document outcome for the map. The gates surface
reads exactly that node from the project-committed document alone — never from
the merged layer tree and never from a system, user-global, project-local,
environment, or CLI source — by one bounded resolution attempt: at most one
stat-class existence probe plus at most one bounded content read, and zero
content reads when neither a selected nor a committed path exists. A selection
naming a missing or unreadable path is the unusable-selector `config.value.invalid`
refusal, never the undeclared parity path; an unreadable, unparseable, or
defective-node document refuses before any gates source read; a parsed document
without the node is undeclared; and a schema or semantic defect outside the node
is not interpreted. The declaration is consumed by [Verify Gates](feature-verify-gates.md).

## The metrics configuration branch

The production catalog declares a typed `metrics` branch with one key:

| Key | Shape | Default | Semantics |
|---|---|---|---|
| `metrics.burn-rate` | `{ threshold, basis, window }` | absent | The burn-rate threshold declaration (schema `delivery.metrics.burn-rate.v1`). `threshold` is a positive number, `basis` is `cost` or `tokens`, and `window` is `<positive-integer>d` at 1..90 days. Absent means undeclared and no default threshold is invented. Every defect — a non-mapping node, a missing or non-positive threshold, an unknown basis, or a non-conforming or out-of-range window — is refused `config.value.invalid` before any telemetry, log, ceremony, transition, or corpus read. |

Like the `verify` branch, the catalog branch constrains whole-document validity for
consumers that resolve the merged tree; it is not the validator for this node,
because it cannot express the positive-threshold rule or the window grammar. The
metrics report reads exactly that node from the project-committed document alone —
never from the merged layer tree and never from a system, user-global,
project-local, environment, or CLI source — by one bounded acquisition. An absent
node is the undeclared parity path, a present but unreadable or unparseable
document refuses before any read, and a defect outside the node is not
interpreted. The declaration is consumed by
[Metrics Report and Burn-Rate Alarms](feature-metrics.md).

## The harness configuration branch

The production catalog declares a typed `harness` branch. It carries harness
selection, execution environment, store locations, and the declared
deny-by-default environment allowlist.

| Key | Shape | Default | Semantics |
|---|---|---|---|
| `harness.kind` | string | `opencode` | Selected harness; the closed set is `opencode` and `claude-code`. An unknown value is `config.value.invalid` naming `harness.kind`; no adapter is constructed and no kind is silently defaulted. |
| `harness.execution.kind` | string | `host` | Execution-environment kind; the closed set is `host`. An unknown value is `config.value.invalid` naming `harness.execution.kind`. |
| `harness.mode` | string | `per-invocation-private-server` | The declared integration mode; the closed set is `per-invocation-private-server` (`--standalone`), `managed-background-service` (`service ...`), and `running-server-client` (`--server`/`api`). Omitted resolves the default with the `defaults` origin and a declared value resolves `configured`; an unknown or wrong-typed value is `config.value.invalid` naming `harness.mode` and is never silently defaulted. Only the default may run; any other declared mode refuses `harness.mode.unavailable` naming the requested and the available mode. |
| `harness.stores.opencode.databasePath` | string | `~/.local/share/opencode/opencode.db` | Read-only opencode session-store location, reconciled with the harness's own data directory. A leading `~/` is expanded at the runtime-aware edge against the injected home directory, and the harness's observed `OPENCODE_DB` override wins when the injected environment record carries it (core reads no ambient environment). A non-string or empty path is `config.value.invalid`; an absent resolved path is a classified capture outcome, never an empty capture. |
| `harness.stores.claude-code.sessionDirectory` | string | `.local/state/claude-code` | Read-only Claude Code session-file directory. A non-string or empty path is `config.value.invalid`. |
| `harness.environment` | array of `{ name, optional? }` or `{ name, credentialRef }` | `PATH`, `HOME`, and `DELIVERY_WORK_PATH` required; `TMPDIR` optional | The complete child-environment allowlist. A variable entry carries a name plus the additive `optional` boolean; a credential entry carries a name plus a credential reference. Absent or `false` `optional` means required, so an absent value fails the spawn closed with `harness.spawn.variable-missing` naming the variable in `field`; `true` means an absent value is omitted and a present value is forwarded. The marker is variable-only: a credential entry carrying it, a non-boolean marker, an extra key, or an unknown key is `config.value.invalid`, and a literal `value` field is `config.secret.forbidden`. The shipped default declares `PATH`, `HOME`, and the injected `DELIVERY_WORK_PATH` as required and `TMPDIR` as optional; it declares no model variable, so model selection belongs to the harness's own configuration and no ambient provider-model environment variable is mapped or forwarded. |

An absent branch resolves to the shipped defaults with `defaults` origins. A
declared branch validates against the closed kinds and store-path rules; an
unknown branch key fails exact-key discipline. Credential references resolve
through the credential port at use time and never carry secret material in
configuration. The optional marker is the supported way to declare a variable
that may legitimately be absent, and it never applies to a credential entry. The
configured-kind registry separately validates that exactly
the two shipped harness kinds are registered, so a vocabulary drift fails
instead of defaulting. See [Harness Adapters](feature-harness-adapters.md).

## The lane configuration branch

The production catalog declares a typed `lane` branch. It carries the lane
liveness cadence and the per-delivery restart bound as policy data.

| Key | Shape | Default | Semantics |
|---|---|---|---|
| `lane.liveness-interval` | integer milliseconds | `30000` | The lane liveness evaluation cadence. The value must be an integer greater than `0`; a non-integer, zero, or negative value is `config.value.invalid` naming the key. |
| `lane.restart-budget` | integer restarts per delivery | `3` | The per-delivery restart bound. The value must be an integer greater than or equal to `0`; `0` is the valid admit-no-restarts policy. A non-integer or negative value is `config.value.invalid` naming the key. |

An absent `lane` branch resolves to both shipped defaults with `defaults`
origins. An unknown key under `lane` fails `config.key.unknown`; invalid input
never silently falls back to the default. Each default is declared once in the
defaults layer. The values are policy data: resolving the branch starts no
scheduler, and the restart gate reads the bound at evaluation time rather than
capturing it at construction. See
[Session Lifecycle Economics](feature-session-lifecycle-economics.md).

## Related

- [Harness Adapters](feature-harness-adapters.md) adds the typed `harness` branch (selected kind, execution kind, store locations, deny-by-default environment allowlist); a literal value in an allowlist entry is rejected by `config.secret.forbidden`.
- [Session Lifecycle Economics](feature-session-lifecycle-economics.md) documents the `lane` branch (liveness interval and restart budget) and consumes the resolved values as policy data.

## The queue configuration branch

The production catalog declares a typed `queue` branch. It carries the lease
staleness bound and the per-condition-type park recheck cadence as policy data.

| Key | Shape | Default | Semantics |
|---|---|---|---|
| `queue.lease-ttl` | integer milliseconds | `90000` | The lease staleness bound: a lease whose heartbeat age is at or beyond it is takeover-eligible. Renewal cadence is derived as `max(1000 ms, floor(ttl / 3))` and is not a key. The value must be an integer greater than `0`; a non-integer, zero, or negative value is `config.value.invalid` naming `queue.lease-ttl`. |
| `queue.park-recheck` | record of integer milliseconds | `provider-window: 60000`, `provider-quota: 300000`, `preemption: 60000` | A dynamic-name record whose valid child names are the closed park condition-type set `{provider-window, provider-quota, preemption}`, never the cause set. A child outside the set is `config.key.unknown`; a non-integer, zero, or negative value is `config.value.invalid`, both naming the full key (`queue.park-recheck.<type>`). An omitted child keeps its shipped default. |

An absent `queue` branch resolves to the shipped defaults with `defaults`
origins, and an unknown key under `queue` fails `config.key.unknown`. The values
are policy data: resolving the branch starts no scheduler and no background
process, the claim reads the TTL at claim time, and the release path resolves
`queue.park-recheck.<condition-type>` when it creates a park. The park pass
re-evaluates an active park only after the interval recorded on that park has
elapsed, so tuning the key changes resume timing for parks created afterwards
with no code change. Deploy expectations are not a `queue` key;
they are the delivered `merge.deploy-expectations`. No capacity, bandwidth,
concurrency, or CI-slot key is declared or reserved. See
[Scheduling Engine](feature-scheduling-engine.md).

## Related

- [Harness Adapters](feature-harness-adapters.md) adds the typed `harness` branch (selected kind, execution kind, store locations, deny-by-default environment allowlist); a literal value in an allowlist entry is rejected by `config.secret.forbidden`.
- [Session Lifecycle Economics](feature-session-lifecycle-economics.md) documents the `lane` branch (liveness interval and restart budget) and consumes the resolved values as policy data.
- [Scheduling Engine](feature-scheduling-engine.md) documents the `queue` branch (lease TTL and per-condition-type park recheck) and consumes the resolved values as policy data.

## The daemon configuration branch

The typed `daemon` branch carries eleven keys with shipped defaults. An absent
branch resolves to the defaults with `defaults` origins. An unknown key is
`config.key.unknown`; a non-integer, zero, or negative interval or bound is
`config.value.invalid` naming the key. No invalid input silently falls back.

| Key | Shape | Default | Semantics |
|---|---|---|---|
| `daemon.heartbeat-interval` | integer milliseconds | `5000` | Heartbeat write cadence. |
| `daemon.heartbeat-cycle` | integer milliseconds | `60000` | Collection cycle used for the typed-question surfacing bound and dashboard staleness. |
| `daemon.lock-staleness` | integer milliseconds | `30000` | A lock whose heartbeat age is at or beyond this bound is stale and takeover-eligible. Distinct from the state fence staleness window. |
| `daemon.poll-interval` | integer milliseconds | `60000` | Bounded fallback wake interval when poke and event-log tail are unavailable. |
| `daemon.watch-poll-interval` | integer milliseconds | `5000` | State polling cadence for a watch in declared degraded mode. |
| `daemon.response-timeout` | integer milliseconds | `2000` | Bounded response timeout before a CLI falls back to state. |
| `daemon.subscription-buffer` | integer frames | `256` | Per-subscription bounded frame buffer and the per-connection subscription-count capacity bound; overflow or over-cap refuses/degrades that subscriber. |
| `daemon.frame-max-bytes` | integer bytes | `65536` | Maximum accepted control frame size. |
| `daemon.reconcile-max-lanes` | integer lanes | `200` | Reconciliation bound; excess lanes are reported truncated, never silently dropped. |
| `daemon.transport` | enum | `unix` | `unix` and `stdio` are implemented; `tcp`, `tls`, `ssh`, and `container-pipe` are declared but not delivered and are refused with `config.value.invalid` naming the implemented set. |
| `daemon.socket-path` | string path | `<state-dir>/daemon.sock` | Must resolve inside the state directory; an outside path is `config.value.invalid`. The literal value appears in envelopes and only as the normalized `<state-dir>/daemon.sock` placeholder in goldens. |

## The coordinator configuration branch

The production catalog declares a typed `coordinator` branch. It carries six
integer keys with shipped defaults. An absent branch resolves to the defaults
with `defaults` origins; an unknown key is `config.key.unknown`; a wrong type or
an out-of-domain value is `config.value.invalid` naming the key. The values are
policy data: resolving the branch starts no supervisor.

| Key | Shape | Default | Semantics |
|---|---|---|---|
| `coordinator.stuck-window` | integer milliseconds | `600000` | Time after an expectation before a no-progress coordinator is stuck. Must be greater than `0`. |
| `coordinator.kill-grace` | integer milliseconds | `20000` | TERM-to-SIGKILL grace for the coordinator process tree. Must be greater than `0`. |
| `coordinator.restart-budget` | integer restarts per epoch | `10` | Restart bound for one budget epoch; `0` is the valid admit-no-restart policy. Must be greater than or equal to `0`. |
| `coordinator.resume-context-limit` | integer tokens | `100000` | Context size at or above which a fresh spawn is preferred. Must be greater than `0`. |
| `coordinator.collection-interval` | integer milliseconds | `30000` | One supervision collection cycle and the base of the 2x lease-age fallback. Must be greater than `0`. |
| `coordinator.progress-bound` | integer milliseconds | `300000` | Liveness window in which positive sourced progress vetoes a stuck verdict. Must be greater than `0`. |

The lane keys `lane.liveness-interval` and `lane.restart-budget` are neither
reused nor aliased. See [Coordinator Supervision](feature-coordinator-supervision.md).

## The poll configuration branch

The typed `poll` branch is a dynamic-name record over the closed platform set
`{github, gitlab, jira}`. Each platform object carries `base-interval`,
`max-interval`, and `min-spacing` as integer milliseconds, defaulting to
`5000`, `60000`, and `1000`. An unknown platform or key is `config.key.unknown`;
a non-integer, zero, or negative value, or a `base-interval` above
`max-interval`, is `config.value.invalid`. A one-shot read is not subject to the
resident backoff state and reads once.

The state-directory scope is the process-environment variable
`<PREFIX>_STATE_DIR`, formed from the brand `environmentPrefix` — whose single
trailing `_` is the prefix separator — plus `STATE_DIR`. The name carries exactly
one underscore between prefix and suffix, so a double-separator spelling is not
honoured and leaves the default in effect. An explicitly set absolute value wins
outright and is never merged with the default; a non-absolute value is
`config.value.invalid`. The default when the variable is unset is
`<home>/<brand.stateDirectoryName>`. No `--state-dir` flag and no
state-directory configuration key exist.

The rule is implemented once, in the app-tier state-scope policy
(`packages/core/src/app/state-scope.ts`), and every surface consumes it. The
resolved directory is the **host root**: the delivery store and every other
project-owned artifact lives under `<host root>/projects/<project key>`, and
the owner-hold marker and the host index stay at the host root. The store honours
the override. The daemon composition consumes the same policy: its store, lock,
settings, socket, and supervisor scope are the project state root, and an
unresolvable host root — no override and no home — is the classified scope
refusal, so the mounted family answers `config.value.invalid` instead of deriving
a root-level path. The supervisor unit writes
its `Environment=` binding under the same name, so the installed unit and the
policy agree on the scope. See [Resident Dispatch
Daemon](feature-resident-daemon.md) and [Repositories and the Host
Overview](feature-projects.md). The owner-hold marker is resolved at the host
root; its contract is in [Scheduling Engine](feature-scheduling-engine.md).
