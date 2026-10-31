---
id: GLOSSARY
status: Current
created: 2026-10-29
last_updated: 2026-10-31
owners: ["engineering"]
area: domain
document_classification: current-truth
links:
  related_decisions: ["ADR-0003"]
  related_changes: ["GH-170", "GH-171", "GH-172", "GH-173", "GH-174", "GH-179", "GH-181"]
summary: "Reader-friendly glossary of the monorepo scaffold, toolchain, boundary-enforcement, quality-gate, publish-path, branding-seam, result-contract, configuration-layer, state-layer, adapter-port, pm-notes, phase-transition, and delivery-registry terms used across the repository."
  related_decisions: ["ADR-0003", "ADR-0005"]
  related_changes: ["GH-170", "GH-171", "GH-172", "GH-173", "GH-174", "GH-181", "GH-188"]
summary: "Reader-friendly glossary of the monorepo scaffold, toolchain, boundary-enforcement, quality-gate, publish-path, branding-seam, result-contract, configuration-layer, state-layer, adapter-port, and provider-client-seed terms used across the repository."
---

# Glossary

_A broad, reader-friendly list of terms and acronyms. If a term names a domain model element, it belongs in the ubiquitous language instead (see `ubiquitous-language-template.md`). See the Documentation Handbook §9 for the glossary-vs-UL distinction._

## Terms

| Term / acronym | Definition | Category | Related UL term |
|---|---|---|---|
| Adapter capability declaration | Typed data on the adapter contract naming the operations and metadata carrier kinds an adapter supports, plus explicit gap records for what it does not. An unlisted operation is unsupported; parity is never implied. | Adapter contracts | [feature-adapter-ports.md](../spec/features/feature-adapter-ports.md) |
| Aggregate check | The single quality entry point `check` that chains `lint`, `format:check`, `typecheck`, `test`, and `check:boundaries` in that order. It exists at the workspace root and in every package; at the root it also appends the packed-exports parity check. No alternate aggregate or bypass flag exists. | Quality | — |
| App error code | Stable symbolic hierarchical failure identity `domain.reason.detail` (for example `provider.quota.exceeded`) that resolves to exactly one error-table entry. Prose is never identity. | Result contract | — |
| Brand-free glob | An ignore pattern that matches the project-local configuration path without naming any product, so it keeps matching after a rename. | Repository hygiene | — |
| Branding seam | The single place where the working name enters and all name-derived values leave: the pure resolver in `core ./branding` plus its resolver-input contract. Every other component receives brand values as parameters. | Branding | — |
| Carrier | The adapter-chosen, capability-flagged form the metadata envelope takes inside a provider artifact: an invisible comment block, a provider custom field, or a compact inline marker. | Adapter contracts | [feature-adapter-ports.md](../spec/features/feature-adapter-ports.md) |
| Change variant | The lifecycle shape a pm-notes document declares through the optional `variant` key: `full` or `lite`. Absence means `full`; omission never yields LITE. | Delivery state | [feature-pm-notes-lint-and-phase-transitions.md](../spec/features/feature-pm-notes-lint-and-phase-transitions.md) |
| Changesets fixed group | The changesets configuration that versions `core`, `adapters`, `cli`, `mcp`, and `opencode` on one shared version line. `testkit` is excluded from the group and from every published dependency graph. | Release | — |
| Client seed | The first real provider client implementation behind the primitive ports for one provider, scoped to the operations its consuming stories need. | Adapter contracts | [feature-provider-client-seeds.md](../spec/features/feature-provider-client-seeds.md) |
| Credential reference | A declared mapping from an external system's auth method to its source key: a literal key or an environment-prefixed key derived from the branding seam. Resolved to secret material only through the credential port. | Adapter contracts | [feature-adapter-ports.md](../spec/features/feature-adapter-ports.md) |
| Credential port | The single `CredentialPort` in `core ./contracts`: `resolve(reference)` returns secret material or the classified `config.credential.missing` failure. It exposes no implementation mode, so the environment-backed implementation and a future sidecar share one interface. | Adapter contracts | [feature-adapter-ports.md](../spec/features/feature-adapter-ports.md) |
| CI parity check | An invariant that binds a local gate to the way CI executes it instead of duplicating its logic. `boundary-ci-parity` requires `ts-boundaries` to build before cruising (the boundary rules resolve package names through built `dist`), and `exports-parity` runs `attw --pack` per publishable so declarations must resolve inside the packed artifact. | Quality | — |
| Classification chain | The path from an engine failure to a table entry: domain kind -> app error code -> exit-code projection class. | Result contract | — |
| CommandResult envelope | The one result contract of every command: `schemaVersion`, `runId`, `exitCode`, `timing`, and exactly one of `data` or `error`. The generic `Result<T, E>` remains the internal computation result; the envelope is the command-surface rendering. | Result contract | — |
| Composition root | The single `createRuntime({ config, adapters, store, clock })` entry declared in `core` `.`; surfaces call it instead of wiring engines themselves. The signature remains declaration-only; configuration is exposed through the separate resolver and CLI edge. | Architecture | [feature-config-layer.md](../spec/features/feature-config-layer.md) |
| Consequence | Structured error field recording whether the attempted mutation landed: `landed`, `not_landed`, or `unknown`. `unknown` is first-class and mandatory on the two fallback entries. | Result contract | — |
| Corpus baseline | The fixed commit SHA recorded in the forbidden-literal registry that anchors the user-facing-doc membership rule. A doc absent at the baseline must be registered; an unreachable baseline fails the scan closed. | Branding | — |
| Corpus boundary | The pm-notes corpus accepted by the conformance fixture: every pm-notes document under change folders dated 2026-10 or later, minus an explicit exclusion manifest of repo-relative POSIX paths. The manifest names one known-unparseable historical artifact, and a guard keeps it from growing silently; legacy-era documents stay outside the corpus but remain schema-bound at write time. | Testing | [feature-pm-notes-lint-and-phase-transitions.md](../spec/features/feature-pm-notes-lint-and-phase-transitions.md) |
| Declared entrypoint | A subpath a package lists in its exports map, and which an importer must declare in its `workspaceImports` manifest field before importing. | Boundaries | — |
| Delivery registry | The state-layer consumer that records phase transitions: schema version `delivery.registry.v1`, one `phase.transition` record per landing under a per-change record key, with fenced appends and verified reads through the state port. | Delivery state | [feature-pm-notes-lint-and-phase-transitions.md](../spec/features/feature-pm-notes-lint-and-phase-transitions.md) |
| Domain kind | The engine-level failure classification a domain engine attaches to an error; the first link of the classification chain. Declared kinds are `provider`, `input`, `config`, `state`, and `lint`, beside the reserved `fallback` containment kind. | Result contract | — |
| Empty-but-enforced | Scaffold content policy for the remaining engines, business logic, provider implementations, and drivers: structure, exports, rules, fixtures, and green tests exist. The configuration and state tiers, result contract, adapter contract substrate, and pm-notes lint/phase-transition surface carry implemented code. | Scaffold | [feature-monorepo-scaffold-toolchain.md](../spec/features/feature-monorepo-scaffold-toolchain.md) |
| Domain kind | The engine-level failure classification a domain engine attaches to an error; the first link of the classification chain. Declared kinds are `provider`, `input`, `config`, and `state`, beside the reserved `fallback` containment kind. | Result contract | — |
| Empty-but-enforced | Scaffold content policy for the remaining engines, business logic, and drivers: structure, exports, rules, fixtures, and green tests exist. The configuration and state tiers, result contract, adapter contract substrate, and the three provider client read slices carry implemented code. | Scaffold | [feature-monorepo-scaffold-toolchain.md](../spec/features/feature-monorepo-scaffold-toolchain.md) |
| Error table | The internal, machine-readable, single-source set of failure entries from which error identity, structured fields, and exit-code projection are all derived. Declared once in `core ./contracts` as data and types. | Result contract | — |
| Exit-code projection | The standalone CLI's mapping of table entries to `{0, 1, 2}`: `success` -> 0, `user-validation` -> 1, `platform-provider` -> 2. The only place exit codes exist. | Result contract | — |
| Fail-closed audit | A check that fails when required evidence is missing or ambiguous rather than passing by default. The license audit fails on an unregistered direct/runtime/transitive use, an empty license, or a disallowed SPDX branch. | Quality | — |
| Fallback entries | The two containment rows: `fallback.invocation` for broken invocations and unknown commands (category `user`, exit 1) and `fallback.internal` for unclassifiable failures (category `platform`, exit 2). Both are `consequence: unknown` and `retryable: false`. | Result contract | — |
| Fixture-coverage meta-check | The test that fails when any configured boundary rule lacks a registered failing fixture, when a mandatory importer rule is missing, or when the ambient-global rule set is not covered. | Testing | — |
| Fixture provenance | The marker on a committed provider fixture or trap catalog naming its synthetic origin and date, distinguishing it from a live capture. | Testing | [feature-provider-client-seeds.md](../spec/features/feature-provider-client-seeds.md) |
| Forbidden-literal scan | The CI-binding check (`ts-forbidden-literals`) that fails when a seed literal appears in a DEC-8 scope class outside the DEC-8 allowlist, naming the file and token. The registry is its authority. | Branding | — |
| Four-copy pin check | The CI equality check across `.bun-version`, the root `engines.bun` field, the CI `env.BUN_VERSION`, and the release workflow. `.bun-version` is the source of truth. | Toolchain | — |
| Golden test | A test asserting captured output against a recorded fixture. The result contract uses goldens for success, void success, classified failure, unknown failure, broken commands, and planted-secret envelopes. | Testing | — |
| Graceful degradation | The metadata read path's response to unreadable metadata: the primitive view returns with account-based heuristic provenance and visible degradation evidence naming a mechanically detectable reason (`missing`, `malformed`, `wrong-kind`, or `unknown-version`), never a flow failure. | Adapter contracts | [feature-adapter-ports.md](../spec/features/feature-adapter-ports.md) |
| Legacy compatibility adapter | The `adapters ./legacy` subpath: maps pre-freeze-prefixed environment facts and the pre-freeze config directory to current names received as parameters, warning once per process. It never imports branding. | Branding | — |
| Lint vs verify | Two distinct evidence checks: lint validates document conformance (parseability, required keys and value types, variant and required phases) and is read-only; verify assesses evidence against reality. Lint output never substitutes for verify. | Quality | [feature-pm-notes-lint-and-phase-transitions.md](../spec/features/feature-pm-notes-lint-and-phase-transitions.md) |
| LITE | The explicitly declared compressed change variant. Its required phase set is the pinned six — `clarify_scope`, `specification`, `delivery`, `quality_gates`, `dod_check`, `pr_creation`; phase keys beyond the set remain allowed and opaque. | Delivery state | [feature-pm-notes-lint-and-phase-transitions.md](../spec/features/feature-pm-notes-lint-and-phase-transitions.md) |
| Lockstep versioning | One version line for the five publishable packages via the changesets fixed group; no package versions independently. | Release | — |
| Machine output | The `--json` channel: always exactly one valid envelope on every outcome, with no diagnostics. Written to the injected output stream. | Result contract | — |
| Metadata envelope | The versioned `delivery.metadata.v1` data contract embedded in provider artifacts: a schema identifier, a closed v1 payload carrying comment provenance and delivery linkage, and a 2048-byte serialized bound. Its pure codec is an adapter-internal module. | Adapter contracts | [feature-adapter-ports.md](../spec/features/feature-adapter-ports.md) |
| Negative fixture | A test that deliberately introduces a forbidden edge and asserts the named boundary rule fails it. A rule without a negative fixture is unenforced and fails the meta-check. | Testing | — |
| Primitive port | A typed, provider-agnostic contract in `core ./contracts` for one catalogue primitive, keyed by its globally unique PascalCase name; adapters implement behind it. | Adapter contracts | [feature-adapter-ports.md](../spec/features/feature-adapter-ports.md) |
| Package matrix | The table of which packages may import which other packages. Forbidden edges are enforced by dependency-cruiser, one rule per importer row; declared edges are enforced by the workspace-entrypoints check. | Boundaries | — |
| Phase ledger | The append-only record of `phase.transition` landings for a change: change ref, phase id, operation (`complete` or `reopen`), timestamp, outcome, and a reopen-only reason. No-op transitions append nothing; the last record for a change carries the full verified history. | Delivery state | [feature-pm-notes-lint-and-phase-transitions.md](../spec/features/feature-pm-notes-lint-and-phase-transitions.md) |
| Phase write path | The `phase` command family (`list`, `complete`, `reopen`) — the only schema-validated, idempotent path that changes phase state. Grammar is validated first, the staged document is linted before mutation, and a landing appends the ledger record, writes the pm-notes entry, and replaces the derived projection. | Delivery state | [feature-pm-notes-lint-and-phase-transitions.md](../spec/features/feature-pm-notes-lint-and-phase-transitions.md) |
| Phase-state projection | The derived `phase-state.<REF>.json` document: a byte-stable pure fold of verified transition records (`started` and `completed` per phase), atomically replaced and rebuildable from the ledger. It is disposable; the ledger is truth. | Delivery state | [feature-pm-notes-lint-and-phase-transitions.md](../spec/features/feature-pm-notes-lint-and-phase-transitions.md) |
| `phase.transition` | The registry record kind appended on each landing: change ref, phase id, operation (`complete` or `reopen`), timestamp, outcome, and a reopen-only reason; the landed payload also carries the change's verified history. No-op transitions append nothing. | Delivery state | [feature-pm-notes-lint-and-phase-transitions.md](../spec/features/feature-pm-notes-lint-and-phase-transitions.md) |
| pm-notes | The per-change delivery-state YAML document `chg-<ref>-pm-notes.yaml`: required top-level `change_id`, `title`, `delivery_mode`, and `phases`, optional typed keys and collections, and opaque extra keys that are preserved and never schema-validated. | Delivery state | [feature-pm-notes-lint-and-phase-transitions.md](../spec/features/feature-pm-notes-lint-and-phase-transitions.md) |
| Publish guard | The release-job check that fails when an intended publishable package is still `private: true` or the branded scope has not been applied. The publish job cannot start unless the guard passes. | Release | — |
| Redaction chokepoint | The single serialization-path control that replaces every edge-registered secret value with `[redacted]` before any byte reaches an output stream, on success and failure payloads and on human diagnostics alike. Values never registered at the edge are outside the guarantee. | Result contract | — |
| Remediation hint | Action-first, secret-free guidance on what the caller should try next; prose, never identity. | Result contract | — |
| Rename drill | The documented RD-1..RD-11 procedure that replaces branding values and the legacy mapping in a temporary copy, runs the full verification battery, and proves a rename is one seam swap. It runs before release and whenever branding changes. | Branding | — |
| runId | Opaque per-invocation correlation identifier generated at the runtime-aware edge; present in every envelope. | Result contract | — |
| Runtime-API confinement | The rule that runtime imports are permitted only in the `core` state driver edge (`packages/core/src/state/driver/`), the adapter I/O subpaths (`repo`, `file`, `host`, `session`, `legacy`, `credentials`), the provider client subpaths (`github`, `gitlab`, `jira`) as exact, reason-bearing entries, the `cli` build, and the `opencode` host integration. The provider registry and remaining adapter subpaths stay non-I/O; the credential subpath is the only one that may resolve secret material. | Boundaries | — |
| schemaVersion | The brand-neutral stable string identifying the envelope schema (`delivery.result.v1` at v1); changes only on a breaking shape change. | Result contract | — |
| Secret-read boundary | The mechanically enforced property that ambient environment access in workspace package production sources occurs only in the enumerated allowlist: the credential implementation, the state driver runtime edge, and the two configuration environment readers. `secret-read-boundary.ts` enforces it in `check:boundaries` and CI. | Adapter contracts | [feature-adapter-ports.md](../spec/features/feature-adapter-ports.md) |
| Seed literal set | The three legacy tokens already public in the repository — the lowercase product token, its uppercase environment-prefix form, and its home-directory config path. It is the scan's searched set and grows by one literal per frozen name. | Branding | — |
| SPDX expression | A machine-readable license expression such as `MIT OR Apache-2.0`. The audit parses `AND`/`OR`/parentheses and fails closed on any disallowed branch. | Legal | — |
| Subpath | A package entrypoint declared in its exports map (for example `core ./contracts`). Cross-package imports use the package name plus a declared subpath; deep `src`/`dist` imports are forbidden. | Boundaries | — |
| Sync check | The binding invariant that every emitted or referenced app error code resolves to exactly one documented table entry and every documented entry exists in the machine-readable source; drift in either direction fails the CI fast loop. | Result contract | — |
| Tier alias (imports alias) | A package-internal layer name declared as a Node `imports` subpath alias (for example `#domain/*` in `core`). The boundary checker resolves aliases, so a forbidden edge fails in alias form and relative form alike. | Boundaries | — |
| Trap catalog | A named, data-reviewable set of entries pairing a provider quirk with the expected normalized outcome and its fixture; the durable record of each normalization rule. | Adapter contracts | [feature-provider-client-seeds.md](../spec/features/feature-provider-client-seeds.md) |
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
- [Adapter Ports, Credential Resolution, and Embedded Metadata](../spec/features/feature-adapter-ports.md)
- [Provider Client Seeds and Trap Catalogs](../spec/features/feature-provider-client-seeds.md)
- [State Layer](../spec/features/feature-state-layer.md)
- [PM-Notes Lint and Phase Transitions](../spec/features/feature-pm-notes-lint-and-phase-transitions.md)
- [ADR-0003 — OSS Tooling Monorepo Structure](../decisions/ADR-0003-oss-monorepo-structure.md)
