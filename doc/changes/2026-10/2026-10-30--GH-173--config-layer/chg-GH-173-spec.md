---
change:
  ref: GH-173
  type: feat
  status: Proposed
  slug: config-layer
  title: "M0-S4: Config layer (DEC-4)"
  owners: [engineering]
  service: delivery-os configuration
  labels: [change, planning]
  version_impact: minor
  audience: mixed
  security_impact: high
  risk_level: high
  dependencies:
    internal: [monorepo scaffold, branding seam, result contract]
    external: []
links:
  decisions: [ADR-0003, TDR-0003]
---

# CHANGE SPECIFICATION

> **PURPOSE**: Make configuration predictable, validated, traceable to its source, and safe to inspect without allowing repository files to supply secrets.

## 1. SUMMARY

Deliver the owner-accepted ADR-0003 DEC-4 seven-layer configuration model and a brand-derived CLI inspection surface. All resolution is fail-closed and shares the existing result/error and redaction contracts; credential resolution and consumers beyond configuration remain separate stories.

## 2. CONTEXT

### 2.1 Current State Snapshot

The workspace has a placeholder configuration tier but no ConfigSource port or configuration resolver. The branding seam provides `BrandIdentity` and its `configDirectoryName` and `environmentPrefix`; the CLI already supplies `CommandResult`, the error table, an in-process invocation surface, and a single output-redaction boundary. ADR-0003 DEC-4 defines the authoritative behavior; the command registry defines basic and debug inspection modes. Proposed TDR-0003 refines parser, validation, bootstrap, acquisition and classification mechanics without claiming human acceptance of the selection.

### 2.2 Pain Points / Gaps

- No shared precedence, discovery, validation, or origin contract exists for later consumers.
- A configuration failure could otherwise be mistaken for an internal crash; an unexplained value could conceal a higher-priority override.
- Repository-local secrets, ambient machine configuration in CI, and raw diagnostic output create avoidable exposure.

## 3. PROBLEM STATEMENT

Because configuration currently has only a placeholder and no unified resolver, operators and later consumers cannot determine which value wins or why, resulting in unsafe, non-reproducible configuration and unclassified failures.

## 4. GOALS

- **G-1**: Resolve seven layers deterministically with explicit provenance and bounded repository discovery.
- **G-2**: Validate each input and final output against one schema; reject unsafe or malformed inputs without partial success.
- **G-3**: Expose useful, redacted inspection and classified, machine-readable failures through the existing CLI contract.
- **G-4**: Keep configuration acquisition outside pure core logic and leave credential/mediated execution adoption possible without redesign.

### 4.1 Success Metrics / KPIs

| Metric | Target |
|--------|--------|
| DEC-4 precedence levels honored | 7/7 |
| Validated layer inputs and final tree | 100% of supplied layers and 1 merged result per resolution |
| File-backed displayed leaf values with real origin | 100% include actual positive line number |
| Secrets from repository-scoped layers accepted or leaked in output | 0 |
| Unclassified expected config failures | 0 |

### 4.2 Non-Goals

- **NG-1**: Credential resolution, keyrings, sidecar, provider routing, state storage, and other future configuration consumers.
- **NG-2**: Template/central `extends`, implicit directory inheritance, or restrict-only policy overlay.
- **NG-3**: Public product naming or changing the branding resolver's contract.

## 5. FUNCTIONAL CAPABILITIES

| ID | Capability | Rationale |
|----|------------|-----------|
| F-1 | Seven-layer precedence and deterministic merge | Predictable overrides across users and contexts. |
| F-2 | Platform and repository source discovery | Prevent accidental configuration from outside the active repository. |
| F-3 | One typed schema and fail-closed validation | Keep bad data out of the final tree. |
| F-4 | Source restrictions and typed environment mapping | Avoid secrets in working trees and implicit interpolation. |
| F-5 | Per-key provenance, warnings, and inspection | Make every effective value explainable. |
| F-6 | Classified config errors and redacted output | Preserve the existing machine and human result contract. |
| F-7 | Runtime-neutral resolution with a replaceable acquisition port | Allow future adapters without ambient reads in core. |

### 5.1 Capability Details

- **F-1**: In increasing priority: built-in defaults, system, user-global, project committed, project local, environment, CLI flags. Maps merge recursively; scalars overwrite; lists replace in full, with no implicit append/union. Higher-layer `reset: [dotted.paths]` removes inherited values and descendant origins before the same layer's values apply; a reset is not itself a resolved value. The same inputs yield the same resolved values and origins. Production ordinary defaults and catalog are initially empty: full merge semantics are exercised with typed extension/test catalogs, not invented production settings.
- **F-2**: The project committed and gitignored project-local sources reside at the git root under the brand's `configDirectoryName` as `config.yaml` and `config.local.yaml`. From cwd, discovery stops at the git root and never searches above; v1 loads only at that root, not intermediate directories. Outside git without an explicit project root or selected file, both project layers are skipped (`no-git-root`); an explicit `--project-root` bounds deliberate discovery to the given root and never above it. Optional missing sources are reported as skipped, not errors. On `CI=true`, system, user-global, and project-local sources default to skipped (`ci-disabled`), unless each is explicitly re-enabled by its own flag; other layers remain enabled. A selected file takes the project-committed slot and skips project-local (`selected-config`), including under CI, outside git and when project-local is re-enabled; it never enables CI-disabled system/user layers. Missing or unreadable selected files fail `config.value.invalid`, not optional discovery. The single skip-reason precedence in DM-2 governs every overlap; disabled or selection-skipped sources are never read.
- **F-3**: One draft-07 JSON Schema derived from a typed catalog governs each partial layer and merged result. The partial view recursively relaxes required fields; final validation enforces effective required fields. No coercion, unknown-property removal or default insertion. `$schema` and `reset` are recognized, validated and excluded from the effective tree; `$schema` never loads another schema. Unknown ordinary keys fail, while `x-` vendor data is allowed in files without implicitly creating an environment/CLI mapping. `null` requires explicit schema permission. Validate interpolation and source restrictions for **each supplied layer before merge**, including shadowed/reset values; never return a partial result. The production ordinary catalog/defaults are empty; the separate bootstrap descriptor requires `workingName` as a supplied string without a default. Typed extension/test catalogs (including `x-test`) prove required/nullable/defaulted/deprecated, nested, list, secret and machine-path behavior through the production algorithm. Every default-bearing catalog field has a typed default; required environment-only secrets receive none. Future consumer keys require explicit catalog extensions.
- **F-4**: The runtime-aware edge supplies `ResolverInput.workingName`, reads the neutral `DELIVERY_OS_WORKING_NAME` override and resolves/fixes `BrandIdentity` **once before discovery**; absent/invalid input uses the established echo-free branding failure. The working name is bootstrap-only, never a mutable config key: files cannot rename it or trigger rediscovery. Exactly the recognized neutral override, brand-derived `${environmentPrefix}CONFIG` selector, and recognized legacy mappings are excluded before curated env-key validation, even if a resulting prefix overlaps the neutral override; unrelated unmapped prefixed keys still fail. Only catalog-typed environment names map to fields, with `__` as nesting separator; unknown/unmapped names and type conversion fail. In-file `{env:...}` and `${VAR:-default}` are rejected. Secret-designated fields are environment-only, including rejection from both repository layers regardless of `--strict`; machine-specific paths are system/user-global only. Both restrictions also apply to other disallowed layers, including defaults and CLI.
- **F-5**: Basic config inspection displays the merged tree as plain JSON in human mode; debug/`--debug` exposes key, redacted value and winning origin plus loaded/skipped evidence. `config get <key> --show-origin` shows the same winning origin; an unknown key fails rather than returning empty output. Deprecated and shadowed values warn safely; `--strict` classifies those warnings as errors. File leaf origins use the winning value node's true 1-based start line, array elements retain their own positions, empty collections their collection position, and supported aliases their referenced value position; map containers retain their own source position only while they remain effective. Whole-list replacement replaces element origins, recursive merging retains unaffected leaf origins, and reset removes descendant origins. Default line origins come from a shipped position manifest verified against the typed defaults source (including line-insertion drift); empty production defaults expose no fictitious origin. Bootstrap/env/flag facts and errors lacking an actual node never invent file/line positions.
- **F-6**: Nine dedicated hierarchical config codes classify expected failures; the config failure discriminant includes both `kind=config` and an exact code (plus safe location). Exact code classification verifies its kind; existing singleton provider/input kind-only classification remains valid, while a multi-row kind without a code is ambiguous. Unknown/missing/mismatched config codes in thrown or returned failures are safely contained through `fallback.internal` rather than misclassified as the first config row. The CLI retains success 0, user-validation 1 and platform-provider 2. Human diagnostics use the existing error stream; `--json` emits exactly one `CommandResult` envelope. All streams and modes traverse the existing redaction chokepoint. Parser/validator errors use safe constructed summaries and never forward snippets, input data, stacks or untrusted summaries; prohibited file secrets must not rely on pre-registration to stay hidden.
- **F-7**: `ConfigSource` and plain JSON-compatible source facts, per-node positions/source identity or safe failures live in core `./contracts`; no YAML/Ajv types or raw source documents cross this port. A pure core resolver and catalog/schema helpers are exposed through the existing core `.` entry (no new public `./config` subpath). A filesystem/platform/environment source and line-preserving YAML parser live behind the existing adapters `./file` entry; git-root detection lives behind adapters `./repo` or is supplied as a root fact. The CLI edge composes branding, file and legacy sources, then invokes the core API; core never imports adapters or branding. The legacy `./legacy` source maps pre-freeze names to current ones with current inputs winning collisions, and routes its once-per-process warning through an injected safe sink and the CLI output chokepoint, not a console default. M0-S12 later owns the single credential-resolution port (environment-backed initially; a later sidecar may implement it); direct and remote mediated adapters later implement the **same unchanged primitive ports**, with mediated operations forwarded over local transport rather than receiving local credentials. GH-173 supplies only non-secret configuration facts and locations: no credential reads, caching, transport or sidecar behavior.

## 6. USER & SYSTEM FLOWS

1. **Normal**: Runtime edge supplies a bootstrap working name and neutral override → unchanged branding resolver runs once → fixed identity drives eligible source acquisition → every partial layer is validated and restrictions applied → resets/merges apply in priority order → final schema validation → caller receives resolved values, origins, and loaded/skipped evidence.
2. **Inspection**: Operator requests basic, debug, or key-with-origin → same resolved snapshot → redacted human JSON/extended JSON or `--json` result envelope; missing/disabled layers remain explainable in debug.
3. **Failure**: Invalid file, env input, restriction, or strict-mode warning → no partially resolved output → classified error, safe diagnostic and projected exit status; `--json` still returns a valid error envelope.

## 7. SCOPE & BOUNDARIES

### 7.1 In Scope

- All DEC-4 levels, platform paths, provenance, discovery, schema validation, strict warnings, source restrictions, CLI inspection and error-table integration.
- YAML 1.2 single mapping document with unique string keys, JSON-compatible values, no executable/custom tags or YAML 1.1 merge semantics; cyclic/non-JSON inputs fail closed and alias expansion is bounded. Multiline, flow, sequence and alias provenance is part of the contract.
- A pure resolver, ConfigSource port, runtime-aware source acquisition, and legacy input compatibility within existing boundary rules.

### 7.2 Out of Scope

- [OUT] Credential resolution (M0-S12), keyring sources, sidecar or mediated adapter implementation.
- [OUT] Provider/state-specific fields and consumption beyond established brand input; machine-path and secret restrictions must nevertheless be testable via schema fixtures.
- [OUT] New HTTP endpoints, event emissions, template `extends`, or restrict-only overlays.
- [OUT] Changes to the bash delivery stack or public product naming.

### 7.3 Deferred / Maybe-Later

- Explicit `extends` with cycle detection and provenance; restrict-only managed policy; new typed keys added alongside their actual consumers.
- Mediated execution behind unchanged primitive ports when credential-resolution and remote-adapter stories are delivered.

## 8. INTERFACES & INTEGRATION CONTRACTS

### 8.1 REST / HTTP Endpoints

None.

### 8.2 Events / Messages

None; source warnings and inspection output are invocation diagnostics, not new persisted events.

### 8.3 Data Model Impact

| ID | Element | Contract |
|----|---------|----------|
| DM-1 | Resolved configuration | Schema-valid effective ordinary tree (initially `{}`), with effective leaf/collection origins; bootstrap identity and reserved directives/metadata are not resolved config values. |
| DM-2 | Source evidence | Ordered loaded-file records and one skipped-layer reason per inapplicable source, determined by the precedence matrix below (`missing`, `ci-disabled`, `no-git-root`, `selected-config`); real per-node source positions remain attached to plain facts through resolution. |
| DM-3 | ConfigSource | Core `./contracts` port for ordered JSON-compatible values and per-node positions/source identity or safe parse failure; no raw parser/text, YAML/Ajv types or ambient source access in core. Existing adapters `./file` supplies filesystem/platform/environment facts, `./repo` supplies repository-root facts, and `./legacy` supplies compatible legacy facts. |
| DM-4 | Schema/catalog | One generated draft-07 schema from the typed catalog for partial-layer and final checks; separate required `workingName` bootstrap descriptor; initially empty ordinary production catalog/defaults. A synthetic `x-test` typed extension and other test catalogs exercise the same resolver but are not published production settings. Catalog metadata specifies env conversion, source restrictions, default, required/nullable and deprecation. |

**DM-2 skip-reason precedence (first matching condition per layer, before any read):** A selected file means the effective `--config` selection or, absent that, a recognized brand-derived/legacy selector. An explicit project root means `--project-root`; it supplies a bounded root even outside git but never enables a CI-disabled source. For a layer that passes all preceding conditions, an absent optional source reports `missing`; otherwise it is loaded. Selected-file absence/unreadability instead fails `config.value.invalid`. Defaults, environment and CLI are not optional file layers and have no skip reason here.

| Layer | First match → reason | Next match → reason | Next match → reason | Eligible outcome |
|-------|----------------------|---------------------|---------------------|------------------|
| System | `CI=true` and no `--enable-system-config` → `ci-disabled` | Optional source absent → `missing` | — | Read system source. |
| User-global | `CI=true` and no `--enable-user-config` → `ci-disabled` | Optional source absent → `missing` | — | Read user-global source. |
| Project-committed | No selected file and neither git root nor explicit project root → `no-git-root` | No selected file and optional root source absent → `missing` | — | Read selected file if selected, otherwise root committed source; selected-file errors fail, not skip. |
| Project-local | Selected file, regardless of CI, root or local enable flag → `selected-config` | `CI=true` and no `--enable-project-local-config` → `ci-disabled` | Neither git root nor explicit project root → `no-git-root`; otherwise absent optional root source → `missing` | Read only root local source. |

Thus CI plus selection reports `selected-config` for project-local and `ci-disabled` for system/user unless each is independently re-enabled. CI outside git without selection/root reports `ci-disabled` for local (not `no-git-root`); without CI it reports `no-git-root`. An explicit root changes only root eligibility: it cannot override CI or selection. No skip condition permits reading its source, including a disabled source that exists on disk.

**Origin grammar (observable strings)**: file-backed layers use `layer=<layer> file=<path> line=<n>` with layer `system`, `user-global`, `project-committed`, or `project-local`; a selected config uses the `project-committed` slot and its actual selected file. Built-in defaults use `layer=defaults file=core/src/config/defaults.ts line=<n>` (the DEC-4 prescribed display label, with a manifest-verified actual line); environment uses `layer=environment env=<KEY>`; CLI uses `layer=cli flag=<--flag>`. Environment/CLI labels have no file or line; every displayed effective leaf/collection has one winning origin. A source-less final missing-required error does not invent a positive line. No sensitive value is present in an origin label.

**Published schema contract**: The canonical ordinary schema is generated from one typed catalog as draft-07, with `type: object`, no unrecognized ordinary properties, and `x-` extension properties allowed. Input wrappers accept `$schema` metadata and `reset` dotted-path array, validate their shapes, and exclude both from the effective tree. The recursively optional partial view and strict final view share field types; a production baseline with no ordinary fields resolves to `{}`. Schema value and catalog/resolver helpers are publicly accessible through core `.` and the generated JSON schema artifact ships with packed core for local editor/CI references; `$schema` is a local metadata reference, never a dynamic fetch or a promise of a hosted URL. Input `$schema` cannot change the validator. Validator accepts only trusted generated schemas: no remote refs, async loading, executable input, input coercion, property removal, inserted defaults or diagnostic logger.

**CLI contract and payloads**: `config` (or `config get <key>` / `config debug`) accepts global `--json`, `--config <path>`, and `--project-root <directory>` plus `--strict`; `config --debug` aliases `config debug`, and `config get <key> --show-origin` requests the origin. `--config` wins over `${environmentPrefix}CONFIG`; a selected missing/unreadable file fails `config.value.invalid` without an invented line. Under `CI=true` the deliberate per-layer re-enable flags `--enable-system-config`, `--enable-user-config`, `--enable-project-local-config` enable only their named disabled layers. Selector/root/strict/debug/json/origin/enable flags control resolution or presentation, not ordinary catalog values. CLI flag values for ordinary fields exist only when a typed catalog explicitly declares their mappings; arbitrary extension env/CLI keys are not inferred from `x-` files. Without `--json`, basic success is the JSON effective tree (initially `{}`); debug success is a JSON object `{ "config": <tree>, "origins": { "<dottedKey>": "<origin>" }, "loadedFiles": ["<path>"], "skippedLayers": [{ "layer": "<layer>", "reason": "<reason>" }] }`, where `origins` maps every displayed effective leaf/collection to its winning origin and the same tree supplies each value. Get success without origin is the JSON value; with origin it is `{ "key": "<dottedKey>", "value": <value>, "origin": "<origin>" }`. With `--json`, the identical success payload (basic tree, debug object, get value/object) goes under `CommandResult.data`, never as a bare second JSON document; failures use `CommandResult.error` and have no partial `data`. All these payloads and human diagnostics pass through one redaction boundary.

**Platform path contract** (each path uses the injected brand-derived directory name, not a hardcoded product):

| Platform | System | User-global |
|----------|--------|-------------|
| Linux | First existing `$XDG_CONFIG_DIRS/<product>/config.yaml` in directory order, default `/etc/xdg/<product>/config.yaml` | `$XDG_CONFIG_HOME/<product>/config.yaml`, default `$HOME/.config/<product>/config.yaml` |
| macOS | `/Library/Application Support/<product>/config.yaml` | `$HOME/Library/Application Support/<product>/config.yaml` |
| Windows | `%PROGRAMDATA%/<product>/config.yaml` | `%APPDATA%/<product>/config.yaml` |

The platform table is a location contract only; XDG variables affect Linux only. `<product>` denotes the branding-derived configuration directory component at the platform location, not a second naming algorithm. Explicit selection occupies the project-committed slot at its existing priority; project-local reports `selected-config` (also under CI and outside git), not `ci-disabled` or `no-git-root`. It does not enable CI-disabled system/user layers, bypass schema/source restrictions, or introduce an eighth precedence layer. Its file location and origin remain explicit and reported.

**Config error-table extension**: all rows below are `domain kind=config`, `category=user`, `retryable=false`, `consequence=not_landed`, `projection class=user-validation` (standalone exit 1); each has the shown action-first, non-secret remediation and summary. Codes are identities, not exception messages. These exact rows must be present in the result contract's documented table and its machine table in this change; both-direction sync remains binding.

| Code | Trigger | Remediation hint | Summary |
|------|---------|------------------|---------|
| config.file.malformed | Invalid YAML/file syntax | Correct the named configuration source and retry. | A configuration source is malformed. |
| config.key.unknown | Unknown file/CLI key | Remove or correct the unknown configuration key and retry. | A configuration key is unknown. |
| config.environment.unmapped | Unmapped prefixed environment name | Remove or map the environment name and retry. | An environment configuration name is unmapped. |
| config.value.invalid | Invalid type, conversion, or schema value including disallowed null | Correct the value to match the configuration schema and retry. | A configuration value is invalid. |
| config.interpolation.rejected | In-file environment interpolation | Use a typed environment override instead and retry. | In-file interpolation is not supported. |
| config.secret.forbidden | Secret field supplied outside environment, including either repository layer | Move the secret to a supported environment source and retry. | A secret was supplied from a forbidden source. |
| config.path.forbidden | Machine-specific path outside system/user-global | Move the machine path to a system or user-global source and retry. | A machine path was supplied from a forbidden source. |
| config.reset.invalid | Invalid reset target or reset directive | Correct the reset paths and retry. | A configuration reset is invalid. |
| config.warning.strict | Deprecated/shadowed warning escalated under strict mode | Resolve the named warning and retry. | Strict configuration validation rejected a warning. |

The classification discriminator is `(kind, code)`: all nine codes round-trip exactly with `kind=config`, and each code's domain prefix remains `config`. Kind-only lookup is permitted only when exactly one table entry has that kind (existing provider/input regression); a kind-only multi-row lookup is ambiguous and cannot select its first row. Missing, unknown or wrong-kind config codes from returned or thrown failures contain through `fallback.internal`, without an uncaught surface error. The table remains total over declared valid failure discriminants, not one entry per kind. No raw secret, interpolation payload, offending value, parser snippet or untrusted summary enters an error; unknown failures use existing containment. Invalid bootstrap brand input retains the established branding failure contract.

### 8.4 External Integrations

No vendor API. Proposed TDR-0003 conditionally selects `yaml@2.9.1` at the adapters `./file` runtime boundary for node ranges/real line counting, and `Ajv@8.20.0` for pure core trusted-schema validation. YAML text is interpreted as one YAML 1.2 mapping document; duplicate/non-string keys, unsupported custom/executable tags, YAML 1.1 merge semantics, non-JSON/cyclic values, and unbounded alias expansion fail closed. Node-selected YAML entry may print raw tokens independently of log level: if either actual host `LOG_TOKENS` or `LOG_STREAM` is non-empty, reject safely as `config.value.invalid` **before parsing**, without mutating host environment, intercepting global console or exposing source text. Parser logging and snippet diagnostics and validator logging are disabled. No parser entry or Node-specific validator helper enters runtime-neutral core. Proposed runtime dependency rows and any allow-list changes require truthful runtime/direct/transitive closure and multi-use accounting and fail-closed license checks; `yaml` is currently a direct development dependency, Ajv is currently only transitive, and the Ajv closure includes `fast-deep-equal@3.1.3` (MIT), `fast-uri@3.1.9` (BSD-3-Clause), `json-schema-traverse@1.0.0` (MIT), and `require-from-string@2.0.2` (MIT). Existing registry approval flags on a feature branch are **proposed**, not human compatibility approval. Human license/decision acceptance gates merge/adoption at owner PR review, **not** specification, branch implementation, or opening the unmerged PR; packed Node/Bun portability and mechanical/license checks still must pass before PR handoff. If runtime code generation is prohibited by actual host evidence, revisit the TDR selection with `@decision-advisor`, not an unreviewed alternative.

### 8.5 Backward Compatibility

Pre-freeze prefix/directory inputs flow through the existing legacy compatibility seam with exactly one warning per process when encountered, zero otherwise. No new legacy names are introduced. `--json` remains the GH-172 envelope and `{0,1,2}` projection; the new plain/extended JSON outputs apply only without `--json`. The brand identity contract stays unchanged. Adding a new config code requires the matching documented table row in the same delivery.

## 9. NON-FUNCTIONAL REQUIREMENTS (NFRs)

| ID | Requirement | Threshold |
|----|-------------|-----------|
| NFR-1 | Purity and deterministic resolution | 0 ambient environment/filesystem/clock reads in resolver and contracts; identical injected inputs yield identical output and origins in 100% of repeat tests. |
| NFR-2 | Validation and fail-closed behavior | 100% of present layers and 1 merged tree validated; 0 partially applied malformed sources. |
| NFR-3 | Provenance accuracy | 100% of effective file/default leaves and array elements carry actual source positions; 0 invented file/line fields for bootstrap/env/CLI or source-less errors; 100% of default source manifest drift mutations fail. |
| NFR-4 | Secret hygiene | 0 secret values accepted from non-environment layers; 0 registered environment or **unregistered prohibited file** canary values in stdout/stderr for success and parse/schema/restriction/strict failure, including escaped/multiline cases. |
| NFR-5 | Error and documentation alignment | 9/9 distinct config codes exactly round-trip with their kind and have one machine and one documented row; wrong/missing codes safely contain; existing singleton kinds still classify; standalone exits restricted to {0,1,2}. |
| NFR-6 | Boundary and regression safety | 0 tier/brand-literal/license-gate violations; all existing binding TypeScript and bash checks remain green. |
| NFR-7 | Inspection completeness | 100% of debug results list loaded files and every skipped applicable layer with reason; 100% of shown effective leaves have one origin. |
| NFR-8 | Parser diagnostic containment | 2/2 upstream debug switches reject before parse and expose 0 source-text canaries; 0 input snippets/stacks in parser/validator diagnostics. |
| NFR-9 | Runtime and artifact compatibility | Node and Bun imports of packed core/config succeed; shipped schema/default-position artifact parity checks pass; 0 ambient/core-tier violations. |

## 10. TELEMETRY & OBSERVABILITY REQUIREMENTS

Debug inspection exposes loaded/skipped source evidence and per-key provenance without exposing secret values. Existing `CommandResult` includes run ID and timing on both success and failure; config error identity is the error-table code. No new event schema or external telemetry sink is introduced.

## 11. RISKS & MITIGATIONS

| ID | Risk | Impact | Probability | Mitigation | Residual Risk |
|----|------|--------|-------------|------------|---------------|
| RSK-1 | Parsed YAML loses true line positions | H | M | Require actual node locations, aliases and multiline/flow/list/reset checks; shipped default position manifest rejects drift. | L |
| RSK-2 | Secret reaches diagnostics or local file | H | M | Restrict every source before merge; construct safe errors without snippets and test unregistered prohibited file secrets plus all redacted outputs. | L; malformed input is guarded by text suppression even without registration |
| RSK-3 | Config codes drift from documented error table | H | M | Require same-change documented rows and binding bidirectional sync. | L |
| RSK-4 | CI consumes workstation configuration | H | L | Disable three ambient layers on `CI=true`; apply DM-2's selected-local reason first and independent system/user enable flags; never read skipped sources. | L |
| RSK-5 | Brand bootstrapping creates circular/unapproved default | M | M | Take working-name input at runtime-aware edge through existing branding seam; fail closed on invalid input. | L |
| RSK-6 | Upstream parser diagnostic switches print raw source | H | M | Fail safely before parsing when either upstream switch is set; test both with unregistered canaries. | L |
| RSK-7 | Proposed parser/validator runtime closure lacks human compatibility acceptance | H | M | Truthfully account for runtime and closure licenses on branch, pass mechanical checks and present Proposed TDR/dependencies at human PR review; no merge/adoption without acceptance. | M pending owner review |

## 12. ASSUMPTIONS

- ADR-0003 DEC-4 is the accepted authority where the ticket's shorter wording omits CI project-local disabling; GH-172 is authoritative for numeric exits.
- Bootstrap identity is separate from the empty ordinary production catalog; fixture catalogs exercise defaults, secrets and paths without promising provider/state settings.
- TDR-0003 is Proposed; its conditional selection may be delivered to an open PR without implying human acceptance.

## 13. DEPENDENCIES

| Direction | Item | Notes |
|-----------|------|-------|
| Depends on | M0-S1 / GH-170 | Runtime-neutral tier and license/boundary gates. |
| Depends on | M0-S2 / GH-171 | Brand-derived paths, env prefix, compatibility seam. |
| Depends on | M0-S3 / GH-172 | Envelope, error table, exit projection and redaction. |
| Blocks | M0-S12 / GH-181, M0-S16 / GH-185, subsequent config consumers | Credential resolution itself is M0-S12, not part of this change. |

## 14. OPEN QUESTIONS

No blocker to test planning, branch delivery, or opening an unmerged PR. **OQ-1 (human PR-review gate, not a delivery blocker):** Will the owner accept Proposed TDR-0003 and the exact runtime license/closure compatibility determination, including BSD-3-Clause? Decision needed: consult `@decision-advisor` if the proposed selection is rejected or must change; owner acceptance is required before merge/adoption, not before PR. Mechanical dependency/closure, security and Node/Bun portability evidence must be supplied at PR handoff, not assumed here.

## 15. DECISION LOG

| ID | Decision | Rationale | Date |
|----|----------|-----------|------|
| DEC-1 | Follow ADR-0003 DEC-4 seven-layer behavior including CI project-local exclusion. | Owner-approved authority; PM clarify_scope recorded the ticket/ADR difference. | 2026-10-30 |
| DEC-2 | Map dedicated config codes to GH-172's user-validation projection (exit 1), not a new numeric exit. | Existing binding result contract supersedes earlier distinct-exit wording. | 2026-10-30 |
| DEC-3 | Take path and env names from GH-171 `BrandIdentity`, never a literal working name. | Existing branding seam and naming firewall. | 2026-10-30 |
| DEC-4 | Human basic/debug JSON and machine `--json` envelope are distinct presentations of the same redacted resolution. | Reconciles the command registry with the delivered result contract. | 2026-10-30 |
| DEC-5 | Encode PM-confirmed bootstrap-only identity, empty ordinary catalog/defaults and selected-file committed-slot behavior; incorporate conditional TDR-0003 parser/port/classifier proposal without marking it Accepted. | Removes test-planning ambiguity while leaving R2 and license acceptance with the human owner at PR review. | 2026-10-30 |

## 16. AFFECTED COMPONENTS (HIGH-LEVEL)

| Component | Impact |
|-----------|--------|
| Core configuration and contract surface | New resolver, catalog/schema and acquisition contract. |
| Runtime-aware CLI and I/O/legacy adapter surfaces | New configuration inspection and source acquisition behavior. |
| Result contract documentation and error catalog | Extended with dedicated config entries in lockstep. |
| User-facing system documentation | Current configuration behavior and brand-neutral naming documented after delivery. |

## 17. ACCEPTANCE CRITERIA

| ID | Criterion | Linked |
|----|-----------|--------|
| AC-F1-1 | **Given** seven conflicting layers, **when** resolving, **then** priority follows defaults < system < user-global < committed < local < environment < CLI, maps merge recursively, scalars replace, lists replace wholly, and each winner has its source. | F-1, DM-1 |
| AC-F1-2 | **Given** a lower value and a higher `reset` of its dotted path, **when** resolving, **then** the inherited value is cleared; invalid reset paths fail classified validation and no partial result is returned. | F-1, F-3 |
| AC-F2-1 | **Given** each supported platform and its optional system/user locations, **when** discovering, **then** the documented platform table and Linux XDG defaults/order are respected, and absent sources are reported skipped. | F-2, DM-2 |
| AC-F2-2 | **Given** a nested cwd inside git or outside git without selection, **when** discovering, **then** only root repository files are eligible and nothing above git or explicit project root is read; outside git without an explicit root both project layers report `no-git-root` when CI does not take precedence, while other enabled layers still resolve. | F-2, DM-2 |
| AC-F2-3 | **Given** `CI=true` with or without git root, explicit project root or selected file, **when** resolving, **then** system/user report `ci-disabled` unless their own flags re-enable them; project-local reports `selected-config` if selected, otherwise `ci-disabled` unless its own flag re-enables it (then `no-git-root` outside git without explicit root, or `missing` when absent at an eligible root); no skipped source is read or implicitly enabled. | F-2, DM-2 |
| AC-F2-4 | **Given** both `--config` and a brand-derived or legacy environment selector, optionally with `CI=true`, explicit project root or local enable flag, **when** resolving inside or outside git, **then** `--config` wins at committed priority, project-local reports `selected-config` before CI/root/missing checks and is never read, a missing/unreadable selected file fails `config.value.invalid`, and neither selector bypasses restrictions or enables CI-disabled system/user sources. | F-2, F-4, DM-2 |
| AC-F3-1 | **Given** any malformed file, **when** resolving or running config inspection, **then** the file is not partially applied and a dedicated `config.file.malformed` classified error names the layer and real line where available, never an unhandled crash; `--json` emits a valid error envelope with exit 1. | F-3, F-6, NFR-2 |
| AC-F3-2 | **Given** an unknown key, invalid type/null, reserved `$schema` or `reset`, or `x-` extension, **when** validating each partial layer and the final tree, **then** only permitted metadata/directives/extensions pass, invalid inputs get dedicated codes, and metadata/directives do not become resolved keys. | F-3, DM-4 |
| AC-F3-3 | **Given** an empty ordinary production catalog and defaults, plus typed extension/test catalogs with required/nullable/defaulted/deprecated/secret/path fields, **when** resolving, **then** production yields `{}`, fixture defaults and final required validation operate on the production algorithm, and no bootstrap name or fixture setting appears as a production ordinary key. | F-1, F-3, DM-4 |
| AC-F3-4 | **Given** valid and invalid YAML 1.2 inputs with multiline, flow, sequence, aliases, duplicate/non-string keys, unsupported tags, cyclic or excessive alias expansion, **when** parsing, **then** supported JSON-compatible values retain real per-node positions and unsupported forms fail closed with safe layer/position diagnostics. | F-3, F-5 |
| AC-F3-5 | **Given** the same trusted catalog, **when** validating partial layers and final result or publishing the packed schema, **then** the recursively optional partial view permits cross-layer required values, the final view enforces them, `$schema` cannot select an external validator, coercion/default insertion/remote refs are absent, and the shipped JSON artifact matches the public core schema value. | F-3, DM-4, NFR-9 |
| AC-F4-1 | **Given** a typed, nested environment name and an unmapped prefixed name, **when** resolving, **then** only the mapped `__` path converts to its schema type and the unmapped name fails `config.environment.unmapped`; file interpolation in either documented form fails `config.interpolation.rejected`. | F-4 |
| AC-F4-2 | **Given** a canary secret field in each repository source, including gitignored local, or in another non-environment layer, **when** resolving with or without `--strict`, **then** it fails `config.secret.forbidden`; a schema-declared machine path outside system/user-global fails `config.path.forbidden`. | F-4, NFR-4 |
| AC-F4-3 | **Given** a valid supplied bootstrap name, a neutral override, brand-derived selector and unmapped prefixed names (including a prefix overlapping the neutral override), **when** starting resolution, **then** branding runs once before discovery and is frozen, exactly the recognized bootstrap/selector inputs are excluded from env mapping, and unmapped prefixed names still fail; absent/invalid bootstrap fails through the branding contract. | F-4, F-7 |
| AC-F5-1 | **Given** file-backed and default effective leaves, **when** inspecting via `config debug` or `config get <key> --show-origin`, **then** each displays its real source file and positive line; environment/CLI winners show only env/flag labels; loaded and skipped reasons appear in debug. | F-5, DM-2, NFR-3 |
| AC-F5-2 | **Given** a deprecated or shadowed value, **when** resolving, **then** a safe warning is emitted; under `--strict` the same condition yields `config.warning.strict` rather than a silently accepted value. | F-5, F-6 |
| AC-F5-3 | **Given** nested maps, sequences, empty collections, aliases, reset and a typed default fixture, **when** values win or are replaced, **then** leaf, array-element and collection origins use the winning value node's actual line, aliases use referenced positions, reset removes descendants, and a line insertion in the defaults source invalidates the shipped position manifest rather than reporting a stale line. | F-5, DM-2, NFR-3 |
| AC-F6-1 | **Given** config basic/debug/get success and classified failure, **when** run without `--json`, **then** basic outputs a plain redacted JSON tree, debug outputs redacted extended JSON with per-key origins and loaded/skipped lists, get outputs its redacted value and optionally origin; failures use the human diagnostic stream. | F-5, F-6 |
| AC-F6-2 | **Given** the same outcomes with `--json`, **when** rendered, **then** exactly one GH-172 `CommandResult` envelope has the corresponding basic/debug/get success data or classified error, projected exit in {0,1,2}, and no registered environment or unregistered prohibited file canary secret in any output stream, including escaped/multiline cases. | F-6, NFR-4, NFR-5 |
| AC-F6-3 | **Given** all nine config codes and existing singleton kinds, **when** classifying returned or thrown failures and comparing machine/documented catalogs, **then** every exact `(kind,code)` has one matching complete row and exit 1, singleton kind-only behavior remains valid, missing/unknown/mismatched codes contain as `fallback.internal`, ambiguous kind-only input never selects a first row, and bidirectional drift fails. | F-6, NFR-5 |
| AC-F6-4 | **Given** non-empty host `LOG_TOKENS` or `LOG_STREAM` and an unregistered source-text canary, **when** attempting to read configuration, **then** each switch yields safe `config.value.invalid` before the YAML parser runs, and no parser tokens, raw snippets, stack or canary bytes appear in any output. | F-3, F-6, NFR-8 |
| AC-F6-5 | **Given** unregistered prohibited file secrets in malformed, schema-invalid, forbidden-source and strict-warning inputs, **when** emitting human/basic/debug/get or `--json` failures, **then** none is exposed in stdout/stderr, no partial data is returned, and safe constructed error fields carry no untrusted summary or offending value. | F-4, F-6, NFR-4 |
| AC-F7-1 | **Given** injected source facts and branding identity, **when** resolving in different runtime contexts, **then** core returns identical results without ambient reads; name-derived paths and environment prefix come only from the unchanged branding seam. | F-7, NFR-1 |
| AC-F7-2 | **Given** legacy config names alongside current names, **when** acquired, **then** current names win collisions, mapping occurs through the compatible source port, the structured warning reaches the redacted output path once per process (zero if unused), and no credential-resolution or remote execution is invoked. | F-7 |
| AC-F7-3 | **Given** the public core API, core contracts, existing adapter entries and a packed artifact, **when** consumed under Node and Bun, **then** the resolver/schema and plain ConfigSource contract import without new package subpaths, ambient core reads, YAML/Node parser imports in core, or unsupported dependencies; the schema/default artifacts remain available and parity-checked. | F-7, NFR-9 |

## 18. ROLLOUT & CHANGE MANAGEMENT (HIGH-LEVEL)

Ship configuration inspection and shared resolution together with the schema and matching documented error catalog; preserve existing bash workflows. Later consumers adopt the same resolver as their typed keys are introduced. Proposed TDR-0003 and truthful dependency/closure/license evidence accompany the open PR; mechanical checks must pass before handoff. Human compatibility and R2 acceptance gate merge/adoption, not branch work or PR creation. No PR merge is part of this change-spec handoff.

**Definition of Done — open-PR handoff (not merge/adoption):** All 25 ACs have passing, traceable evidence, including the DM-2 skip-reason matrix, and all nine NFR thresholds have applicable measured evidence. Executable negative controls pass for disabled/selected-source non-reads, root bounds, malformed/shadowed/forbidden input, unregistered and registered secret canaries, parser switches, source-position/default-manifest drift, schema/error-table parity, and boundary/ambient regressions; positive controls remain green. The empty production catalog/defaults and fixture behavior, shipped packed schema/default-position artifacts and isolated Node/Bun consumption are verified. Current configuration, result/error, branding/scaffold and relevant index/glossary documentation is synchronized with delivered behavior and error rows. Independent review passes (or findings are fixed and re-reviewed), applicable local quality, license/security, packaging and existing bash gates pass, and minor release intent is recorded. An open unmerged PR targets `main-tools` with all `ts-*`, `bash-tests` and other required CI jobs green on the pushed HEAD. Proposed TDR-0003 and truthful runtime/closure license evidence are presented for human review; **human TDR and license compatibility acceptance is required only before merge/adoption**, not for this handoff. No passing evidence or owner acceptance is claimed by this specification.

## 19. DATA MIGRATION / SEEDING (IF APPLICABLE)

No persisted-state migration. Pre-freeze config names are read by the established compatibility adapter with a single process warning; no automatic rewriting of user configuration.

## 20. PRIVACY / COMPLIANCE REVIEW

Configuration may contain sensitive operator data. Neither registered environment secrets nor unregistered prohibited file-secret values may appear in value displays, origins, loaded/skipped evidence or errors; suppress raw input/snippets even on early parse failure. Paths and environment variable names are source metadata disclosed only through requested inspection/diagnostics. Proposed runtime dependency and full locked closure/usage require accurate registry accounting, allow-list proposals and mechanical checks before PR; human C-2 compatibility determination and acceptance occur at owner PR review before merge/adoption. Green mechanical checks alone do not approve licenses.

## 21. SECURITY REVIEW HIGHLIGHTS

Fail closed on malformed and unknown inputs; never execute repository config or interpolate environment into files. Secret fields require environment input regardless of repository tracking or strictness; prohibit shadowed bad sources before merge. Either upstream YAML diagnostic switch set must fail safely before parsing. Never forward raw parser/validator diagnostic content. CI cannot silently load workstation sources. All output uses the established redaction chokepoint; credential-resolution/sidecar concerns are explicitly outside this boundary.

## 22. MAINTENANCE & OPERATIONS IMPACT

Operators gain traceable debug output, predictable strict validation and stable codes. Maintain one typed schema/catalog and synchronized error documentation as consumers grow; retain real origin lines across parser upgrades. Source-acquisition portability and brand-rename checks remain binding.

## 23. GLOSSARY

| Term | Definition |
|------|------------|
| Layer | One named precedence level in the seven-level configuration chain. |
| ConfigSource | Contract for externally acquired configuration source facts; not a credential resolver. |
| Origin | Winning layer and true file line or environment/flag identity for one effective key. |
| Repository-scoped | Any configuration source in the repository working tree, tracked or not. |
| Strict | Invocation mode that escalates deprecated/shadowed warnings to errors. |

## 24. APPENDICES

Sources: issue GH-173; accepted ADR-0003 DEC-4; Proposed TDR-0003 refinements 1–8 and PM-confirmed mechanics; GH-173 PM clarify_scope record; current branding seam, result contract and monorepo scaffold specifications; CLI command registry's config surface; credential-sidecar concept's compatibility section.

| Requested coverage | Acceptance evidence | Boundary |
|--------------------|---------------------|----------|
| Ticket AC1: malformed config produces coded error, not crash | AC-F3-1, AC-F3-4, AC-F6-3, AC-F6-4 | Classified validation exit 1; no partial output or raw parser diagnostics. |
| Ticket AC2: debug names file and real line for each file-backed key | AC-F5-1, AC-F5-3 | Empty production defaults have no fabricated leaf; fixture defaults and files prove actual lines. |
| CEO scope reminder: future mediated mode without credential implementation | AC-F7-1, AC-F7-2, AC-F7-3 | M0-S12 credential port and later remote adapters remain separate; primitive ports unchanged. |

## 25. DOCUMENT HISTORY

| Version | Date | Author | Changes |
|---------|------|--------|---------|
| 1.0 | 2026-10-30 | Change Spec Writer | Initial GH-173 specification. |
| 1.1 | 2026-10-30 | Change Spec Writer | Incorporated Proposed TDR-0003 refinements, PM-confirmed bootstrap/selector/catalog mechanics, security and governance gates. |
| 1.2 | 2026-10-30T07:08:41Z | Change Spec Writer | DoR iteration 1: defined deterministic skip-reason precedence and open-PR Definition of Done without changing AC IDs or owner acceptance timing. |

---

## AUTHORING GUIDELINES

Grounded in the issue, owner-accepted DEC-4, existing contracts and the **Proposed** TDR-0003; future consumer-specific fields are intentionally not invented. Exact default origin label is reproduced only as a user-visible contract, not an implementation instruction. Human acceptance of the proposed selection and dependency compatibility is reserved for owner PR review; it is not a blocker to the open PR.

## VALIDATION CHECKLIST

- [x] Ref, owner, Proposed status and required sections are present in order.
- [x] Unique capability, model, risk, decision and acceptance IDs; every AC is Given/When/Then and linked.
- [x] Measurable NFRs, risk impact/probability/mitigations/residuals, and explicit out-of-scope items.
- [x] Both issue criteria and the full DEC-4 behavior have testable coverage; no credential implementation or provider catalog promised.
- [x] No implementation tasks, merge templates, or source-edit instructions in this artifact.
