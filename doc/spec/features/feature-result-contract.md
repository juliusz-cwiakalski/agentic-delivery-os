---
id: SPEC-RESULT-CONTRACT
status: Current
created: 2026-10-30
last_updated: 2026-10-31
owners: ["engineering"]
service: delivery-os
summary: "The command-surface result contract: the CommandResult envelope in core ./contracts, the machine-readable error table as the single source of failure identity including the five provider-engine rows, the lint rows for pm-notes conformance, and the verify delivery-verdict row, the domain-kind to app-error-code to projection classification chain with exact-code provider classification, the standalone CLI {0, 1, 2} exit projection, the deterministic in-process runCli surface, the two-entry fallback containment, the serialization redaction chokepoint, the testkit conformance validator, and the binding docs/code sync and exit-literal invariants."
links:
  related_changes: ["GH-172", "GH-173", "GH-174", "GH-177", "GH-179", "GH-181", "GH-182", "GH-175"]
  related_decisions: ["ADR-0003", "TDR-0005"]
---

# Feature: Result Contract and Error Table

## Overview

Every command renders its outcome into one `CommandResult` envelope. The envelope carries `schemaVersion` (`delivery.result.v1` at v1), an opaque per-invocation `runId`, `exitCode`, `timing`, and exactly one of `data` or `error`. The generic `Result<T, E>` remains the internal computation result returned by engines; the envelope is the command-surface rendering of that result. Both contracts live in the runtime-neutral `@delivery-os/core/contracts` subpath as types and `as const` data only.

Failures are modelled by a machine-readable error table. Each table entry is the single source of an error's identity, its structured fields, and its exit-code projection class. Classification follows one chain: domain kind and, for multi-row kinds, exact code -> table entry -> exit-code projection class. Errors no entry classifies are contained by dedicated fallback entries, so machine output is valid on every outcome, including broken invocations and hostile handler bodies.

Exit codes exist only in the standalone CLI, where a projection class maps to `0`, `1`, or `2`. The command surface is exercised through the deterministic, in-process `runCli(argv, streams, deps)` entry point, which writes machine envelopes only under `--json` and human diagnostics only to the error stream. A single serialization chokepoint redacts every edge-registered secret value before any byte reaches an output stream.

The authoritative design decision for package placement and tiers is [ADR-0003](../../decisions/ADR-0003-oss-monorepo-structure.md). The surrounding workspace is described in [Monorepo Scaffold and Toolchain](feature-monorepo-scaffold-toolchain.md); the branding constraints on the surface are described in [Branding Seam and Working Name](feature-branding-seam.md).

## Business Context

### Problem Statement

- **Problem:** Without one result contract and one error model, every command invents its own output shape, failure vocabulary, and exit-code convention. Machines and agents cannot trust output on failure, retry decisions become guesses, and exit-code folklore spreads through call sites and documentation.
- **Affected Users:** Command consumers (operators, scripts, and AI agents), command authors, and every later surface that projects the same engines (MCP and host integrations).
- **Business Impact:** The contract is the substrate every later command, adapter error, and surface builds on. A weak or undocumented shape propagates to all of them; a documented, checked shape keeps failure handling stable as commands are added.

### Goals

- Provide one envelope shape for every command outcome, with exactly the prescribed fields and unambiguous `data`/`error` exclusivity.
- Make failure identity machine-readable: hierarchical app error codes plus category, retryability, consequence, and an action-first remediation hint.
- Keep exit codes a projection of the table in the standalone CLI only, fixed at `{0, 1, 2}`.
- Guarantee valid machine output on success, classified failure, unknown failure, and broken invocation.
- Keep the command surface deterministic and testable in process, with no process spawning.
- Redact registered secrets on the single serialization path, on success and failure alike.
- Bind the documented error table to the machine-readable source in both directions through a CI invariant.
- Respect the runtime-neutral contracts tier, the package boundary matrix, and the branding seam.

## User Experience & Functionality

### Capabilities

- **CommandResult envelope:** Every command returns `schemaVersion`, `runId`, `exitCode`, `timing`, and exactly one of `data` or `error`. A void success carries an explicit empty `data` object rather than an ambiguous both-absent shape.
- **Machine-readable error table:** `ERROR_TABLE` in `core ./contracts` declares each failure entry once. `DOMAIN_KINDS` declares `provider`, `input`, `config`, `state`, `lint`, and `verify`; `fallback` is the reserved two-segment containment namespace. The `provider` kind carries the five provider-engine identities (`provider.quota.exceeded`, `provider.outage`, `provider.auth.rejected`, `provider.chain.empty`, `provider.chain.invalid`). The `lint` kind carries the five pm-notes conformance identities (`lint.notes.malformed`, `lint.keys.missing`, `lint.variant.unknown`, `lint.phases.incomplete`, `lint.target.missing`). The `verify` kind carries the one delivery-verdict identity (`verify.ledger.incomplete`). Codes are unique and the table is total over valid declared failure discriminants, not one row per kind.
- **Self-describing errors:** Every error object carries `code`, `category`, `retryable`, `consequence`, `remediationHint`, and an optional non-identifying `summary`. An entry's `summary` supplies the default; non-config handlers may supply a more specific summary without changing identity. Config summaries always come from the table.
- **Classification chain:** A `(kind, code)` pair resolves only when the code belongs to that kind. Kind-only lookup requires exactly one matching entry (`provider`, `input`); `config`, `state`, `lint`, and `verify` require a code. The provider kind carries five rows, so provider failures are classified by exact code and a no-code, undeclared-code, or wrong-kind provider failure is contained by `fallback.internal` rather than mapped to the first provider row. Missing, unknown, or wrong-kind config, state, lint, and verify codes are contained by `fallback.internal`.
- **Status evidence identity:** The status digest adds no error-table row and no domain kind. Section failures are digest data, not envelope errors: `status` returns a success envelope with all six sections and exit `0` whenever it can assemble a digest, and only `fallback.invocation` or `fallback.internal` can fail the command. Section evidence carries an existing `config.*` or `state.*` code as `failureCode` when a classified failure occurred, and an adapter-local class such as `provider.payload.invalid` as `failureClass` when an adapter rejected a payload. A `failureClass` is never an error-table identity, and a code such as `provider.chain.invalid` is never used as a `failureClass` or `failureCode`. The consumer contract is in [Status Digest](feature-status-digest.md).
- **Exit-code projection:** The CLI projection module maps `success` to `0`, `user-validation` to `1`, and `platform-provider` to `2`. An unknown projection class is rejected, never defaulted. The numeric code is derived from the class, never read from a table row.
- **Failure containment:** Broken invocations and unknown commands resolve through `fallback.invocation`; errors no entry classifies resolve through `fallback.internal`. Both containment entries are `consequence: unknown` and `retryable: false`, and their projection classes keep caller-fault and system-side failures on different exit codes.
- **Deterministic in-process surface:** `runCli(argv, streams, deps)` takes arguments, injected output and error streams, and injected dependencies (brand, clock, run-id factory, secrets, command program). It returns the numeric exit code and never spawns a process, calls `process.exit`, or writes to real process streams.
- **Single redaction chokepoint:** The serialization module serializes the fully assembled envelope to one JSON document and redacts registered secret values first. The same redaction covers human diagnostics. Registered values are the non-empty, unique values read from an environment record at the runtime-aware edge.
- **Conformance validator:** `@delivery-os/testkit` exposes `assertEnvelopeContract(parsed)` for plain parsed JSON and `loadGoldenCases(root)` for golden fixture discovery. The validator imports `core ./contracts` only, never the CLI surface, so it can check bytes without a CLI object.
- **Binding invariants:** `error-table-sync` enforces table, source-reference, fixture, and documented-table agreement. `exit-code-literals` forbids call-site exit literals outside the projection module. Both run in the CI `ts-invariants` job and are exercised by mutation suites.
- **Boundary conformance:** Only the CLI surface entry may import the serialization module, and the exit projection may not be imported from `core`, `adapters`, `mcp`, or `opencode`. Both rules are registered in the dependency-boundary matrix with failing fixtures.

### Outcome flows

- **Successful command:** The handler returns a result carrying `data`. The surface builds a success envelope with the success projection (`0`), redacts the payload, and writes the envelope to the injected output stream when `--json` is present.
- **Classified failure:** A handler raises a failure carrying a declared domain kind (and an exact code for multi-row kinds), or returns a result whose `error` carries one. The chain resolves the entry, the envelope carries the projected error object, the exit code comes from the entry's projection class (`1` or `2`), and timing is present on the failure path.
- **Containment:** A missing command, unknown command, unexpected argument, unknown flag, missing flag value, or conflicting flag pair resolves through `fallback.invocation` and exits `1`. A thrown value, rejected promise, malformed result, or otherwise unclassifiable failure resolves through `fallback.internal` and exits `2`. A serialization failure emits a `fallback.internal` envelope with exit code `2`.
- **Human output:** Machine envelopes appear only when `--json` is present. Failure diagnostics are prefixed with the brand binary name and written to the injected error stream; they contain no stack trace and never enter the machine envelope.
- **Agent consumption:** Consumers branch on `code`, `category`, and `retryable`, check `consequence` before any retry (`unknown` forbids a blind retry), and follow `remediationHint`. Prose fields add nuance; they are never identity.

### Envelope field contract

| Field | Presence | Contract |
|-------|----------|----------|
| `schemaVersion` | Always | Brand-neutral stable string; `delivery.result.v1` at v1; changes only on a breaking shape change. |
| `runId` | Always | Opaque per-invocation correlation id; generated at the runtime-aware edge; the contracts tier carries the field only. |
| `exitCode` | Always | Projected from the table (or the success class `0`); in `{0, 1, 2}`; the standalone CLI owns the projection. |
| `timing` | Always, success and failure | Measured timing facts; `totalMs` is the integer-millisecond run duration produced by the surface. |
| `data` | On success; exactly one of `data`/`error` | Success payload; an explicit empty object for void successes. |
| `error` | On failure; exactly one of `data`/`error` | The envelope error object; no stack traces and no raw diagnostics. |

A success envelope has exactly the keys `schemaVersion`, `runId`, `exitCode`, `timing`, and `data`. A failure envelope has exactly the keys `schemaVersion`, `runId`, `exitCode`, `timing`, and `error`. Extra or missing keys are contract violations.

### Error table entry contract

| Column | Contract |
|--------|----------|
| App error code | Stable symbolic `domain.reason.detail`; unique within the table; resolves to exactly one entry. The reserved two-segment `fallback` namespace admits exactly `fallback.invocation` and `fallback.internal`. |
| Domain kind | The engine-level failure classification that maps to this entry; a declared domain kind or the reserved `fallback` kind. |
| Category | Fixed enum: `user` \| `platform` \| `transient` \| `permanent`. |
| Retryable | Boolean; the explicit retry signal for agents. |
| Consequence | `landed` \| `not_landed` \| `unknown`; explicit per entry; `unknown` is mandatory on both fallback entries. |
| Remediation hint | Action-first, secret-free next-step guidance. |
| Projection class | `success` \| `user-validation` \| `platform-provider`; exactly one; yields the `{0, 1, 2}` exit code in the standalone CLI. |
| Summary | Optional non-identifying human-readable prose; never identity and never secret material. |

### Exit-code projection

| Exit code | Class | Derived from |
|-----------|-------|--------------|
| 0 | Success | The success projection; no table entry is required. |
| 1 | User-or-validation error | Entries whose projection class is `user-validation`, including `fallback.invocation` for broken invocations and unknown commands. |
| 2 | Platform-or-provider error | Entries whose projection class is `platform-provider`, including `fallback.internal` for unclassifiable failures. |

### Documented error table

| Code | Domain kind | Category | Retryable | Consequence | Remediation hint | Projection class | Summary |
|------|-------------|----------|-----------|-------------|------------------|------------------|---------|
| fallback.invocation | fallback | user | false | unknown | Check the command name and arguments, then retry the invocation. | user-validation | The invocation could not be understood. |
| fallback.internal | fallback | platform | false | unknown | Inspect the diagnostics stream and report the failure if it persists. | platform-provider | The failure could not be classified. |
| provider.quota.exceeded | provider | transient | true | not_landed | Wait for the quota window to reset, then retry the operation. | platform-provider | The provider quota was exceeded. |
| provider.outage | provider | transient | true | not_landed | Retry after the provider becomes reachable; consult the announcement and park for the resume time. | platform-provider | The provider is unreachable. |
| provider.auth.rejected | provider | user | false | not_landed | Correct or replace the declared credential and retry. | user-validation | The provider rejected the credential. |
| provider.chain.empty | provider | user | false | not_landed | Declare a non-empty provider chain (or select one) and retry. | user-validation | No provider chain is declared. |
| provider.chain.invalid | provider | user | false | not_landed | Correct the named chain entries, ordering, or references and retry. | user-validation | The provider chain is invalid. |
| input.value.rejected | input | user | false | not_landed | Correct the rejected value and retry the command. | user-validation | The supplied value was rejected. |
| config.file.malformed | config | user | false | not_landed | Correct the named configuration source and retry. | user-validation | A configuration source is malformed. |
| config.key.unknown | config | user | false | not_landed | Remove or correct the unknown configuration key and retry. | user-validation | A configuration key is unknown. |
| config.environment.unmapped | config | user | false | not_landed | Remove or map the environment name and retry. | user-validation | An environment configuration name is unmapped. |
| config.value.invalid | config | user | false | not_landed | Correct the value to match the configuration schema and retry. | user-validation | A configuration value is invalid. |
| config.interpolation.rejected | config | user | false | not_landed | Use a typed environment override instead and retry. | user-validation | In-file interpolation is not supported. |
| config.secret.forbidden | config | user | false | not_landed | Move the secret to a supported environment source and retry. | user-validation | A secret was supplied from a forbidden source. |
| config.path.forbidden | config | user | false | not_landed | Move the machine path to a system or user-global source and retry. | user-validation | A machine path was supplied from a forbidden source. |
| config.reset.invalid | config | user | false | not_landed | Correct the reset paths and retry. | user-validation | A configuration reset is invalid. |
| config.warning.strict | config | user | false | not_landed | Resolve the named warning and retry. | user-validation | Strict configuration validation rejected a warning. |
| config.credential.missing | config | user | false | not_landed | Supply the credential through its declared environment source and retry. | user-validation | A required credential was not resolvable from its source. |
| state.store.torn | state | platform | false | not_landed | Inspect or restore the named state store; never treat it as empty. | platform-provider | The state store is torn. |
| state.schema.mismatch | state | platform | false | not_landed | Use a compatible tool version or migrate the store explicitly, then retry. | platform-provider | The state store schema version is not supported. |
| state.keys.missing | state | platform | false | not_landed | Verify the writing operation completed and inspect the named store; never substitute defaults. | platform-provider | A state read key-set assertion failed. |
| state.lock.busy | state | transient | true | not_landed | Wait for the current writer to release the state fence, then acquire and retry. | platform-provider | The state store is locked by another writer. |
| state.permission.denied | state | user | false | not_landed | Correct operating-system permissions on the named state path and retry. | user-validation | A state path permission requirement was not met. |
| state.write.failed | state | transient | true | not_landed | Resolve the underlying storage error and retry; the failed write or rebuild did not land, the ledger remains durable truth, and the index stays disposable. | platform-provider | A state write or index rebuild did not land. |
| state.level.unsupported | state | user | false | not_landed | Use a state level with an implemented driver; shared levels arrive with later stories. | user-validation | The requested state level has no implementation. |
| lint.notes.malformed | lint | user | false | not_landed | Correct the document so it conforms to the pm-notes schema (syntax, structure, and value types) and retry. | user-validation | The pm-notes document is malformed. |
| lint.keys.missing | lint | user | false | not_landed | Add the named required key(s) with a conforming value and retry. | user-validation | A required pm-notes key is missing. |
| lint.variant.unknown | lint | user | false | not_landed | Set `variant` to `full` or `lite` and retry. | user-validation | The pm-notes variant is unknown. |
| lint.phases.incomplete | lint | user | false | not_landed | Add the named missing required phase(s) of the declared variant or correct the declared variant. | user-validation | A required phase of the declared variant is missing. |
| lint.target.missing | lint | user | false | not_landed | pm-notes target only: initialize pm-notes for the named change ref or correct the reference (an absent registry target is a verified-empty pass, C-3). | user-validation | The pm-notes target is missing. |
| verify.ledger.incomplete | verify | user | false | not_landed | Complete the named required phases of the declared variant through the phase command, or correct the declaration, then re-run verify. | user-validation | The declared variant's required phases are not all completed. |

This table is the human- and agent-readable counterpart of `ERROR_TABLE`. The sync check requires each source entry to have exactly one documented row and each documented row to have exactly one source entry; the two fallback rows are included with no containment exemption.

### Failure containment semantics

Two containment entries cover distinct populations, and each population resolves through the entry matching its responsibility:

- **`fallback.invocation`** contains broken invocations and unknown commands: a missing command, a token starting with `-`, an unknown command name, an unexpected positional argument, an unknown flag, a missing flag value, or a conflicting flag pair. It is category `user`, `retryable: false`, `consequence: unknown`, projection class `user-validation` (exit `1`), with a caller-directed remediation hint.
- **`fallback.internal`** contains errors no table entry classifies: undeclared kinds, non-`Error` thrown values, rejected promises, malformed results, a handler whose definition disappears, and serialization failure. It is category `platform`, `retryable: false`, `consequence: unknown`, projection class `platform-provider` (exit `2`), with a remediation hint directing the caller to diagnostics.

Both entries carry `consequence: unknown` because containment never asserts that a mutation landed or did not land, and both carry `retryable: false` because an identical broken invocation fails identically and an unclassifiable failure with unknown consequence must not invite a blind retry. The remediation hint, not the retryable flag, directs the next step.

### Evolution discipline

Envelope changes are additive within `schemaVersion`; a breaking shape change requires a new schema version. A new table entry requires its structured fields, its projection class, and its documented row in the same change. Documentation drift fails closed in both directions: an emitted or referenced code without a documented row fails, and a documented row without a machine-readable entry fails.

## Technical Architecture & Codebase Map

### High-level design

The contract is split across three tiers. The runtime-neutral `core ./contracts` subpath declares the envelope types, the entry type, the declared domain kinds, and the table data. The CLI surface owns classification, containment, exit projection, serialization, and redaction. The private testkit validates envelope bytes. The split keeps I/O, clocks, randomness, and environment reads out of the contracts tier while letting the surface assemble and render outcomes.

### Core components and directory structure

| Path | Component | Responsibility |
|------|-----------|----------------|
| `packages/core/src/contracts/result.ts` | Envelope contract | `CommandResult` success/failure types, `CommandResultError`, `RunTiming`, category/consequence/projection enums, and `RESULT_SCHEMA_VERSION`. |
| `packages/core/src/contracts/error-table.ts` | Error table | `DOMAIN_KINDS`, `ERROR_TABLE`, the entry type, and the reserved fallback code constants. |
| `packages/core/src/contracts/index.ts` | Shared language | Exports the envelope and table declarations beside the unchanged `Result<T, E>`. |
| `packages/cli/src/classify.ts` | Classification | `resolveAppErrorCode`, `classifyDomainKind`, and `classifyThrown` implement the chain and containment step. |
| `packages/cli/src/projection.ts` | Exit projection | `projectExitCode` maps a projection class to `{0, 1, 2}` and rejects unknown classes. |
| `packages/cli/src/index.ts` | Command surface | `runCli`, invocation parsing, outcome rendering, top-level containment, and diagnostics. |
| `packages/cli/src/edge.ts` | Runtime-aware edge | `registerEdgeSecrets` and `createProductionDependencies` assemble production defaults from injected data. |
| `packages/cli/src/output/serialize.ts` | Serialization and redaction | `redact`, `serializeEnvelope`, and `writeOutput` are the single stream-write and redaction path. |
| `packages/testkit/src/result-conformance.ts` | Conformance validator | `RULES`, `assertEnvelopeContract`, and `loadGoldenCases` validate parsed envelopes and discover golden cases. |
| `scripts/checks/error-table-sync.ts` | Table invariant | Validates the table, source references, fixtures, and documented table in three recognizer levels. |
| `scripts/checks/exit-code-literals.ts` | Exit-literal invariant | Forbids call-site exit literals outside the projection module and restricts projection digits to `{0, 1, 2}`. |

### Key types and functions

```ts
type CommandResult<TData = unknown> =
  | { schemaVersion: "delivery.result.v1"; runId: string; exitCode: number; timing: RunTiming; data: TData }
  | { schemaVersion: "delivery.result.v1"; runId: string; exitCode: number; timing: RunTiming; error: CommandResultError };

function runCli(
  argv: readonly string[],
  streams: CliStreams,
  deps: CliDependencies,
): Promise<number>;
```

`CliDependencies` carries the injected `brand`, `clock`, `newRunId`, `secrets`, and `program`. `CommandProgram` maps command names to `CommandDefinition` values containing a handler and optional flag, required-value, and conflict metadata. Handlers receive a `CommandInvocation` with the command name, parsed flags, remaining argv tokens, and the brand identity.

### Data architecture

The surface determines the outcome, measures `timing`, generates a `runId`, projects the `exitCode` from the outcome, and assembles exactly one of `data` or `error`. The error object is a pure projection of one table entry; non-config handlers may replace the summary with a non-empty string. Config failures always use the table summary, including malformed config discriminants safely contained by `fallback.internal`. The table is `as const` data with no behaviour. The documented table in this spec is the checked S2 surface.

### API and interface contracts

- **`runCli(argv, streams, deps)`** returns the numeric exit code. It emits the machine envelope only when `argv` contains `--json`. It always emits a failure diagnostic to the error stream when a failure outcome has a message or summary. It is deterministic for identical `argv` and injected dependencies.
- **`writeOutput(streams, envelope, diagnostic, secrets, emitEnvelope)`** is the only function in the delivered surface that calls a stream write. It redacts the envelope and the diagnostic before writing.
- **`assertEnvelopeContract(parsed)`** returns an array of violations covering key sets, mandatory fields, exclusivity, exit-code range, schema version, run-id opacity, timing, and error enum values.
- **`loadGoldenCases(root)`** discovers `*/argv.json` cases and requires `injected.json`, `meta.json`, and `stdout.json`; a case with no golden fails rather than being skipped, and there is no auto-accept path.

## Non-Functional Requirements

| Concern | Current guarantee |
|---------|-------------------|
| Runtime neutrality | The contracts tier declares types and `as const` data only; no I/O, ambient environment, clock, randomness, or runtime-API imports. |
| Machine-output validity | Every outcome class under `--json` emits exactly one valid envelope: success, classified failure, unknown failure, and broken invocation. |
| Exclusivity and mandatory fields | A success envelope never carries `error`; a failure envelope never carries `data`; all four mandatory fields are present on every path. |
| Timing | `timing.totalMs` is present on success and failure paths. |
| Redaction | Planted secrets do not survive into any output stream; the chokepoint covers `data`, `error`, and diagnostics. Values never registered at the edge are outside the guarantee. |
| Exit projection | Exit codes stay in `{0, 1, 2}`; each entry has exactly one projection class; call-site exit literals outside the projection are forbidden. |
| Determinism | Identical argv and injected dependencies yield identical output; no test spawns a process. |
| Documentation binding | Every emitted or referenced code resolves to exactly one documented row and every documented row to exactly one source entry. |
| Boundaries and branding | The serialization entry point and projection rules hold; brand strings are parameters from the edge; new code carries no forbidden product tokens. |

## Quality Assurance Strategy

### Testing approach

| Level | Location | Scope |
|-------|----------|-------|
| Behaviour | `tests/behaviour/error-classification.test.ts`, `exit-projection.test.ts`, `run-cli.test.ts` | Classification totality and containment, projection derivation, invocation parsing, stream split, and determinism. |
| Golden | `tests/golden/*.test.ts` with fixtures under `tests/fixtures/result/envelopes/**` | Captured stdout/stderr against recorded envelopes for success, void success, classified failure, unknown failure, broken commands, and planted secrets. |
| Structure | `tests/structure/result-contract.test.ts`, `error-table.test.ts`, `result-fixtures.test.ts`, `cli-edge-seam.test.ts` | Envelope and table shape, fixture integrity, edge seam, and no-spawn guarantees. |
| Checks | `tests/checks/error-table-sync.test.ts`, `exit-code-literals.test.ts` | Mutation suites for both invariants: drift in either direction, fail-closed documentation, per-form exit literals, and non-vacuity. |
| Boundaries | `tests/boundaries/**` | Failing fixtures for the serializer-entry and projection-ownership rules, with clean controls. |

### Test data and scenarios

Golden cases are directories under `tests/fixtures/result/envelopes/` containing `argv.json`, `injected.json`, `meta.json`, `stdout.json`, and optional `stderr.txt`. The injected facts include a two-tick clock, a fixed run id, a brand identity, a program name, and optional secrets. The code corpora under `tests/fixtures/result/code-corpora/` are the explicit Level C input for the sync check: each row declares whether its text is recognized and whether every recognized code resolves. The corpora are excluded from the S3 filesystem scan and fed to the check by name.

## Operational & Support

### Configuration

The surface has no ambient configuration reads. Callers inject brand values, clock facts, a run-id factory, registered secrets, and the command program. `createProductionDependencies` supplies production defaults for the clock and run id and registers secrets from an environment record handed in as data. `--json` selects machine output; without it, generic successful runs write nothing, the opt-in configuration command prints its selected payload as plain JSON, and failures write only the human diagnostic. Configuration-specific payloads and safe warnings are documented in [Configuration Layer and Inspection](feature-config-layer.md).

### Observability

The envelope is the observability surface. `runId` correlates machine and human output for one invocation, and `timing.totalMs` exposes duration on every path. Failure diagnostics name the entry code or handler reason and are written to the injected error stream. The invariants fail with messages naming the offending code, entry, file, surface, or fixture row.

### Cost and infrastructure

The result surface itself adds no runtime dependency or new CI job. Configuration resolution and acquisition declare separate proposed runtime dependencies, governed by the locked runtime-closure registry and owner review before merge/adoption. The result golden, behaviour, structure, and check suites run inside the existing workspace test and invariant steps. The error-table sync check reads the live tree without writing to it.

## Dependencies & Risks

- **Depends on** the monorepo scaffold ([feature-monorepo-scaffold-toolchain.md](feature-monorepo-scaffold-toolchain.md)) for package tiers, boundary enforcement, the ambient guard, and the aggregate check.
- **Depends on** the branding seam ([feature-branding-seam.md](feature-branding-seam.md)) for `BrandIdentity` parameter discipline and the forbidden-literal scan.
- **Consumed by** the configuration layer ([feature-config-layer.md](feature-config-layer.md)) for envelope, error identity and the sole redaction path.
- **Consumed by** the provider engine ([feature-provider-engine.md](feature-provider-engine.md)) for the five provider identities, exact-code provider classification, announcement-code-bearing error summaries, and envelope rendering.
- **Consumed by** pm-notes lint and phase transitions ([feature-pm-notes-lint-and-phase-transitions.md](feature-pm-notes-lint-and-phase-transitions.md)) for the five `lint` identities, exit projection, and envelope rendering.
- **Consumed by** the adapter port substrate ([feature-adapter-ports.md](feature-adapter-ports.md)) for the `config.credential.missing` credential-failure identity and the redaction boundary.
- **Consumed by** the status digest ([Status Digest](feature-status-digest.md)) for the envelope, the redaction path, and the rule that section failures are digest data reusing existing identities rather than new rows.
- **Consumed by** verify change and exit taxonomy ([feature-verify-change-and-exit-taxonomy.md](feature-verify-change-and-exit-taxonomy.md)) for the `verify` domain kind and row, the delivery-result token projection, and the non-zero exit guarantee.
- **Depends on** [ADR-0003](../../decisions/ADR-0003-oss-monorepo-structure.md) for runtime-neutral contract placement, package boundaries, and gate stability.
- **Risk — contract cascade:** Every later command and surface consumes the envelope. Mitigation: the field set is fixed at v1, `schemaVersion` provides a breaking-change channel, and evolution is additive within a version.
- **Risk — documentation drift:** The documented table can diverge from the source. Mitigation: the sync check fails closed in both directions and includes the fallback rows.
- **Risk — redaction bypass:** A surface could write a stream without the chokepoint. Mitigation: one serialization entry point, a boundary rule, and planted-secret goldens.
- **Risk — exit-code folklore:** Call sites could reintroduce numeric exit codes. Mitigation: the projection module owns the digits and the exit-literal invariant rejects call-site literals.
- **Risk — containment escape:** A crash before envelope construction could break the always-valid guarantee. Mitigation: top-level containment in `runCli` and a serialization-failure fallback.
- **Risk — consequence overuse:** `unknown` could become a lazy default. Mitigation: entries declare `consequence` explicitly; `unknown` is mandatory only for the two containment entries.

## Glossary & References

| Term | Definition |
|------|------------|
| CommandResult envelope | The one result contract of every command: `schemaVersion`, `runId`, `exitCode`, `timing`, and exactly one of `data` or `error`. |
| `Result<T, E>` | The generic internal computation result in `core ./contracts`; engines return it and surfaces render it into the envelope. |
| Error table | The machine-readable, single-source set of failure entries from which identity, structured fields, and projection are derived. |
| App error code | Stable symbolic hierarchical identity `domain.reason.detail` that resolves to exactly one table entry. |
| Domain kind | The engine-level failure classification; the first link of the chain. |
| Classification chain | Domain kind -> app error code -> table entry -> exit-code projection class. |
| Exit-code projection | The standalone CLI mapping of projection classes to `{0, 1, 2}`; the only place exit codes exist. |
| Consequence | Whether the attempted mutation landed: `landed`, `not_landed`, or `unknown`; `unknown` is first-class and mandatory on the containment entries. |
| Remediation hint | Action-first, secret-free guidance on what the caller should try next; prose, never identity. |
| Fallback entries | `fallback.invocation` for broken invocations and unknown commands; `fallback.internal` for unclassifiable failures; both `consequence: unknown`, `retryable: false`. |
| Redaction chokepoint | The single serialization-path control that transforms registered secret values before any byte reaches a stream. |
| Machine output | The `--json` channel: always one valid envelope on every outcome, with no diagnostics. |
| Sync check | The binding invariant that every emitted code and every documented row agree in both directions. |
| schemaVersion | The brand-neutral stable envelope schema identifier; `delivery.result.v1` at v1. |
| runId | Opaque per-invocation correlation identifier generated at the runtime-aware edge. |

See also: [glossary](../../overview/glossary.md) for repository-wide terms, [feature-monorepo-scaffold-toolchain.md](feature-monorepo-scaffold-toolchain.md), [feature-branding-seam.md](feature-branding-seam.md), and [ADR-0003](../../decisions/ADR-0003-oss-monorepo-structure.md).
