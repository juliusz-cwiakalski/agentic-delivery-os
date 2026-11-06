---
ados_distribution: internal
id: SPEC-RESULT-CONTRACT
status: Current
created: 2026-10-30
last_updated: 2026-11-06
owners: ["engineering"]
service: delivery-os
summary: "The command-surface result contract: the CommandResult envelope in core ./contracts, the machine-readable error table as the single source of failure identity including the nine state integrity rows, the five provider-engine rows, the lint rows for pm-notes conformance including the lint-document-unreadable row, the three verify delivery-verdict and gates rows, the four db session-administration rows, the four closeout rows, the five machine-readable delivery-plan rows, the three watchdog lane-safety rows, the six commit-primitive rows, the single doctor check-failure row, and the status collector-unavailable family row, the domain-kind to app-error-code to projection classification chain with exact-code provider, db, closeout, plan, watchdog, commit, status, and doctor classification, the adapter-local provider.payload.invalid projection, the standalone CLI {0, 1, 2} exit projection, the deterministic in-process runCli surface, the injected interactive-vs-scripted machine-output mode with the scripted trim and its --verbose override, the two-entry fallback containment, the serialization redaction chokepoint, the testkit envelope and scripted-projection validators, and the binding docs/code sync and exit-literal invariants."
links:
  related_changes: ["GH-172", "GH-173", "GH-174", "GH-177", "GH-179", "GH-181", "GH-182", "GH-175", "GH-176", "GH-180", "GH-183", "GH-178", "GH-222", "GH-221", "GH-226", "GH-227", "GH-228", "GH-229", "GH-223", "GH-224"]
  related_decisions: ["ADR-0003", "TDR-0005", "TDR-0008"]
---

# Feature: Result Contract and Error Table

## Overview

Every command renders its outcome into one `CommandResult` envelope. The envelope carries `schemaVersion` (`delivery.result.v1` at v1), an opaque per-invocation `runId`, `exitCode`, `timing`, and exactly one of `data` or `error`. The generic `Result<T, E>` remains the internal computation result returned by engines; the envelope is the command-surface rendering of that result. Both contracts live in the runtime-neutral `@delivery-os/core/contracts` subpath as types and `as const` data only.

Machine output has two rendering modes, selected by an injected stream-capability fact at the runtime-aware edge. Interactive mode renders the full five-key envelope. Scripted mode (piped or otherwise non-interactive) renders a one-line projection: a success line carries exactly `data`, and a failure line carries the `error` object plus a top-level `runId`; neither line carries `schemaVersion`, `exitCode`, or `timing`. The trimmed context fields remain durable in the command audit ledger. `--verbose` forces the full envelope in either mode, and `--pretty` affects indentation only and never re-expands a scripted line. The mode contract is owner-pinned; the full envelope is the interactive contract, and the scripted projection is the machine-consumer contract.

Failures are modelled by a machine-readable error table. Each table entry is the single source of an error's identity, its structured fields, and its exit-code projection class. Classification follows one chain: domain kind and, for multi-row kinds, exact code -> table entry -> exit-code projection class. Errors no entry classifies are contained by dedicated fallback entries, so machine output is valid on every outcome, including broken invocations and hostile handler bodies.

Exit codes exist only in the standalone CLI, where a projection class maps to `0`, `1`, or `2`. The command surface is exercised through the deterministic, in-process `runCli(argv, streams, deps)` entry point, which writes machine output only under `--json` and human diagnostics only to the error stream. A single serialization chokepoint redacts every edge-registered secret value before any byte reaches an output stream.

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
- **Machine-readable error table:** `ERROR_TABLE` in `core ./contracts` declares each failure entry once. `DOMAIN_KINDS` declares `provider`, `input`, `config`, `state`, `lint`, `verify`, `db`, `closeout`, `plan`, `watchdog`, `commit`, `status`, and `doctor`; `fallback` is the reserved two-segment containment namespace. The `state` kind carries nine identities, including the additive `state.storage.exhausted` and `state.store.unknown`. The `provider` kind carries the five provider-engine identities (`provider.quota.exceeded`, `provider.outage`, `provider.auth.rejected`, `provider.chain.empty`, `provider.chain.invalid`). The `lint` kind carries the five pm-notes conformance identities (`lint.notes.malformed`, `lint.keys.missing`, `lint.variant.unknown`, `lint.phases.incomplete`, `lint.target.missing`) plus the lint-surface unreadable identity (`lint.document.unreadable`). The `verify` kind carries three verify subcommand identities: `verify.ledger.incomplete` for `verify change`, and `verify.gates.failed` and `verify.gates.unavailable` for `verify gates`. The `db` kind carries the four session-administration identities (`db.opencode.unavailable`, `db.query.failed`, `db.delete.failed`, `db.reboot.live`). The `closeout` kind carries the four closeout identities (`closeout.target.unobserved`, `closeout.target.ambiguous`, `closeout.write.failed`, `closeout.branch.unsafe`). The `plan` kind carries the five machine-readable delivery plan identities (`plan.schema.invalid`, `plan.scope.undeclared-paths`, `plan.tier.unknown`, `plan.format.legacy-markdown`, `plan.artifact.missing`). The `watchdog` kind carries exactly the three lane-safety identities (`watchdog.checkout-dirty`, `watchdog.checkout-non-base`, `watchdog.signals-absent`). The `commit` kind carries exactly the six commit-primitive identities (`commit.staging-blocked-untracked`, `commit.commitlint-failed`, `commit.safety.secret-suspected`, `commit.safety.scan-unavailable`, `commit.atomic-abort`, `commit.session.context-refused`); a template fallback is success evidence (`messageSource: template`), never a failure row. The `status` kind carries the declared `status.collector.<id>.unavailable` family; the shipped closed collector-id set is `tracker`, and a family code naming an undeclared id is not recognized. The `doctor` kind carries exactly the one non-retryable user-validation identity (`doctor.check.failed`), raised only when the invoked wiring checks report at least one failure. Codes are unique and the table is total over valid declared failure discriminants, not one row per kind.
- **Self-describing errors:** Every error object carries `code`, `category`, `retryable`, `consequence`, `remediationHint`, and an optional non-identifying `summary`. An entry's `summary` supplies the default; non-config handlers may supply a more specific summary without changing identity. Config summaries always come from the table.
- **Classification chain:** A `(kind, code)` pair resolves only when the code belongs to that kind. Kind-only lookup requires exactly one matching entry (`provider`, `input`); `config`, `state`, `lint`, `verify`, `db`, `closeout`, `plan`, `watchdog`, `commit`, `status`, and `doctor` require a code. The provider kind carries five rows, so provider failures are classified by exact code and a no-code, undeclared-code, or wrong-kind provider failure is contained by `fallback.internal` rather than mapped to the first provider row. Missing, unknown, or wrong-kind config, state, lint, verify, db, closeout, plan, watchdog, commit, status, and doctor codes are contained by `fallback.internal`.
- **Adapter-local payload identity:** `provider.payload.invalid` is a distinct adapter-local read failure for a malformed or unparsable provider payload, and also for an authentication, transport, or server failure on a non-404 provider read. It is intentionally not an error-table row; the CLI classification recognizes the exact `(provider, provider.payload.invalid)` pair and projects it as `platform-provider` (exit `2`) with `consequence: unknown`, while the error-table sync check recognizes the literal without demanding a documented row. The `provider` domain kind here is the adapter-local provider-I/O identity, not the AI-model provider engine reserved by DEC-15/F-14; this entry adds no `DOMAIN_KINDS` member and no table row. It is never used for an explicit provider not-found, which has its own `closeout.target.unobserved` identity; a closeout target read that is `invalid` maps to this identity.
- **Status evidence identity:** The status digest adds no error-table row and no domain kind. Section failures are digest data, not envelope errors: `status` returns a success envelope with all six sections and exit `0` whenever it can assemble a digest, and only `fallback.invocation` or `fallback.internal` can fail the command. Section evidence carries an existing `config.*` or `state.*` code as `failureCode` when a classified failure occurred, and an adapter-local class such as `provider.payload.invalid` as `failureClass` when an adapter rejected a payload. A `failureClass` is never an error-table identity, and a code such as `provider.chain.invalid` is never used as a `failureClass` or `failureCode`. The consumer contract is in [Status Digest](feature-status-digest.md).
- **Board collector identity:** The `board` command adds one `status` domain kind and one documented family row, `status.collector.<id>.unavailable`. The family is the declared prefix `status.collector.` plus a lowercase collector-id slot plus the suffix `.unavailable`; the shipped closed collector-id set is `tracker`. The runtime classifier resolves the family shape to the documented entry with the family code preserved, and the sync check requires every recognized family code to name a declared id. A collector read that fails, is unconfigured, or lacks a credential makes the board return that classified error and exit `2`; the board withholds every gate rather than render a partial picture, and no fabricated gate or silent zero is produced. A rendered board is a success envelope with exit `0`. The board contract is in [Owner-Gate SLA](feature-owner-gate-sla.md).
- **Doctor check identity:** The `doctor` command adds one `doctor` domain kind and exactly one documented row, `doctor.check.failed` (user, non-retryable, `not_landed`, `user-validation` → exit `1`). An all-ok doctor run is a success envelope carrying the `delivery.doctor.v1` report as `data` and exit `0`; a run with at least one non-ok check is a failure envelope carrying that single identity, no `data`, and a deterministic summary naming every failing check with its verdict and fix hint in fixed area order. Check-level causes such as `doctor.check.<area>.unreachable` are check evidence, never table identities, and doctor unable to run outside per-check execution projects exit `2` through existing platform-category entries. The doctor contract is in [Doctor](feature-doctor.md).
- **Exit-code projection:** The CLI projection module maps `success` to `0`, `user-validation` to `1`, and `platform-provider` to `2`. An unknown projection class is rejected, never defaulted. The numeric code is derived from the class, never read from a table row.
- **Failure containment:** Broken invocations and unknown commands resolve through `fallback.invocation`; errors no entry classifies resolve through `fallback.internal`. Both containment entries are `consequence: unknown` and `retryable: false`, and their projection classes keep caller-fault and system-side failures on different exit codes.
- **Deterministic in-process surface:** `runCli(argv, streams, deps)` takes arguments, injected output and error streams, and injected dependencies (brand, clock, run-id factory, secrets, command program, mode fact, and optional audit seam). It returns the numeric exit code and never spawns a process, calls `process.exit`, or writes to real process streams.
- **Mode-aware machine rendering:** The surface reads an injected `mode` fact (`interactive` or `scripted`); when a caller omits it, `runCli` defaults to `interactive`, while the production composition resolves it from the injected stream capability (`scripted` unless the fact is `true`). In interactive mode the full envelope is written, indented. In scripted mode the surface writes exactly one minified line: `{"data":...}` on success (an explicit `{"data":{}}` for a void success) or `{"error":...,"runId":...}` on failure, with `runId` at the top level so consumers extract it without descending into the error object. `--verbose` forces the full envelope in any mode. `--pretty` is accepted in every mode and never re-expands the scripted line; the full envelope is always rendered indented.
- **Per-invocation audit capture:** When an audit seam is injected, the surface samples `startedAt` from the injected clock before parsing, computes the outcome first, then assembles the invocation facts (redacted command and arguments, exit code, timing, envelope `schemaVersion`, outcome class, scope, optional repo, optional claimed identity) and writes them through the state-backed audit writer. An audit-write failure is a classified diagnostic and never changes the outcome or exit code. The ledger contract is in [Command Audit Ledger](feature-audit-ledger.md).
- **Single redaction chokepoint:** The serialization module serializes the fully assembled envelope to one JSON document and redacts registered secret values first. The same redaction covers human diagnostics and every audit record field. Registered values are the non-empty, unique values read from an environment record at the runtime-aware edge.
- **Conformance validator:** `@delivery-os/testkit` exposes `assertEnvelopeContract(parsed)` for plain parsed JSON, `assertScriptedProjection(text)` for the scripted one-line projection, the `RULES` and `SCRIPTED_RULES` rule sets, and `loadGoldenCases(root)` for golden fixture discovery. The validators import `core ./contracts` only, never the CLI surface, so they can check bytes without a CLI object.
- **Binding invariants:** `error-table-sync` enforces table, source-reference, fixture, and documented-table agreement. `exit-code-literals` forbids call-site exit literals outside the projection module. Both run in the CI `ts-invariants` job and are exercised by mutation suites.
- **Boundary conformance:** Only the CLI surface entry may import the serialization module, and the exit projection may not be imported from `core`, `adapters`, `mcp`, or `opencode`. Both rules are registered in the dependency-boundary matrix with failing fixtures.

### Outcome flows

- **Successful command:** The handler returns a result carrying `data`. The surface builds a success envelope with the success projection (`0`), redacts the payload, and writes the envelope to the injected output stream when `--json` is present. In interactive mode it writes the full indented envelope; in scripted mode it writes one minified `{"data":...}` line (an explicit `{"data":{}}` for a void success).
- **Classified failure:** A handler raises a failure carrying a declared domain kind (and an exact code for multi-row kinds), or returns a result whose `error` carries one. The chain resolves the entry, the envelope carries the projected error object, the exit code comes from the entry's projection class (`1` or `2`), and timing is present on the failure path. In interactive mode the full envelope is written; in scripted mode one minified line carries the `error` object with the full error-table fields plus a top-level `runId`.
- **Mode override:** `--verbose` forces the full envelope in either mode. `--pretty` never re-expands a scripted line; the full envelope is always indented.
- **Containment:** A missing command, unknown command, unexpected argument, unknown flag, missing flag value, or conflicting flag pair resolves through `fallback.invocation` and exits `1`. A thrown value, rejected promise, malformed result, or otherwise unclassifiable failure resolves through `fallback.internal` and exits `2`. A serialization failure emits a `fallback.internal` envelope with exit code `2`. A broken invocation follows the same mode-aware rendering as any other failure.
- **Audited invocation:** When the audit seam is injected, the outcome is computed first and the audit record is written afterwards. A successful audit write leaves the output untouched; a failed audit write emits its classified diagnostic on the error stream and leaves the outcome and exit code unchanged. The same path covers success, void success, classified failure, unknown failure, and broken invocation.
- **Human output:** Machine output appears only when `--json` is present. Failure diagnostics are prefixed with the brand binary name and written to the injected error stream; they contain no stack trace and never enter the machine output.
- **Agent consumption:** Consumers read the process exit code for status, branch on `code`, `category`, and `retryable`, check `consequence` before any retry (`unknown` forbids a blind retry), and follow `remediationHint`. On a scripted failure line, `runId` at the top level is the correlation key. Prose fields add nuance; they are never identity.

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

The table above describes the full envelope. Scripted machine output is a projection of it, and field presence is mode-dependent:

| Mode | Success output | Failure output | Keys present |
|------|----------------|----------------|--------------|
| Interactive | Full envelope, indented | Full envelope, indented | Exactly the five envelope keys (`schemaVersion`, `runId`, `exitCode`, `timing`, and `data` or `error`). |
| Scripted | One minified line: `{"data":...}` | One minified line: `{"error":{...},"runId":"..."}` | Success: exactly `data`. Failure: exactly `error` and top-level `runId`. |
| Either with `--verbose` | Full envelope, indented | Full envelope, indented | Exactly the five envelope keys. |

The scripted projection never carries `schemaVersion`, `exitCode`, or `timing`; the process exit code carries status, and the audit record carries the trimmed context (the envelope `schemaVersion` is retained there as `resultSchemaVersion`). On a scripted failure line the `error` object keeps every contracted error field (`code`, `category`, `retryable`, `consequence`, optional `summary`, and `remediationHint`); `runId` sits beside it at the top level, never nested inside `error`. `--pretty` affects indentation only: with `--verbose` the full envelope is indented, and without it a scripted line stays one minified line. Stream outputs (a future `--watch`) stay line-delimited in every mode.

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
| state.store.torn | state | platform | false | not_landed | Inspect the named state store and use the explicit salvage operation as a separate step to truncate a torn tail; never treat the store as empty. | platform-provider | The state store is torn. |
| state.schema.mismatch | state | platform | false | not_landed | Use a compatible tool version or migrate the store explicitly, then retry. | platform-provider | The state store schema version is not supported. |
| state.keys.missing | state | platform | false | not_landed | Verify the writing operation completed and inspect the named store; never substitute defaults. | platform-provider | A state read key-set assertion failed. |
| state.lock.busy | state | transient | true | not_landed | Wait for the current writer to release the state fence, then acquire and retry. | platform-provider | The state store is locked by another writer. |
| state.permission.denied | state | user | false | not_landed | Correct operating-system permissions on the named state path and retry. | user-validation | A state path permission requirement was not met. |
| state.write.failed | state | transient | true | not_landed | Resolve the underlying storage error other than exhaustion and retry; the failed write or rebuild did not land, the ledger remains durable truth, and the index stays disposable. | platform-provider | A state write or index rebuild did not land. |
| state.storage.exhausted | state | transient | true | not_landed | Free storage space on the named state path and retry; the write did not land and the ledger remains at its last valid frame. | platform-provider | The storage backing the state store is exhausted. |
| state.store.unknown | state | platform | false | not_landed | Declare the record kind and payload schema at the validated boundary, or use a compatible tool version, then retry. | platform-provider | A record kind or payload schema is not declared at the validated boundary. |
| state.level.unsupported | state | user | false | not_landed | Use a state level with an implemented driver; shared levels arrive with later stories. | user-validation | The requested state level has no implementation. |
| lint.notes.malformed | lint | user | false | not_landed | Correct the document so it conforms to the pm-notes schema (syntax, structure, and value types) and retry. | user-validation | The pm-notes document is malformed. |
| lint.keys.missing | lint | user | false | not_landed | Add the named required key(s) with a conforming value and retry. | user-validation | A required pm-notes key is missing. |
| lint.variant.unknown | lint | user | false | not_landed | Set `variant` to `full` or `lite` and retry. | user-validation | The pm-notes variant is unknown. |
| lint.phases.incomplete | lint | user | false | not_landed | Add the named missing required phase(s) of the declared variant or correct the declared variant. | user-validation | A required phase of the declared variant is missing. |
| lint.target.missing | lint | user | false | not_landed | pm-notes target only: initialize pm-notes for the named change ref or correct the reference (an absent registry target is a verified-empty pass, C-3). | user-validation | The pm-notes target is missing. |
| lint.document.unreadable | lint | platform | false | not_landed | Restore the named document's readability and encoding, then re-run lint; the document was not evaluated. | platform-provider | A lint target document could not be read or decoded. |
| verify.ledger.incomplete | verify | user | false | not_landed | Complete the named required phases of the declared variant through the phase command, or correct the declaration, then re-run verify. | user-validation | The declared variant's required phases are not all completed. |
| db.opencode.unavailable | db | platform | false | not_landed | Install or repair the opencode CLI so opencode db path resolves. | platform-provider | The opencode session database is unavailable. |
| db.query.failed | db | platform | true | not_landed | Retry the failed query and verify the session store is readable. | platform-provider | A session database query failed. |
| db.delete.failed | db | transient | true | not_landed | Retry the prune; failed rows remain and are selected again. | platform-provider | A session delete did not land. |
| db.reboot.live | db | transient | true | not_landed | Wait until the live window is empty or stop the opencode host, then retry. | platform-provider | A live session is using the database. |
| closeout.target.unobserved | closeout | user | false | not_landed | Verify the work item ref; a provider not-found means the item does not exist. A payload/parse failure is `provider.payload.invalid`, and access or credential failures keep their own identities. | user-validation | The closeout target work item was not observed (provider not-found). |
| closeout.target.ambiguous | closeout | user | false | not_landed | Disambiguate the delivery request or local branch for the work item, then retry. | user-validation | More than one closeout target matched. |
| closeout.write.failed | closeout | transient | true | unknown | Inspect the failed operation evidence and retry; completed operations are persisted and idempotent. | platform-provider | A closeout provider write did not land. |
| closeout.branch.unsafe | closeout | user | false | not_landed | Resolve the named checkout, worktree, protected-ref, or merged-head condition, then retry. | user-validation | Branch cleanup or checkout restore was refused for safety. |
| verify.gates.failed | verify | user | false | not_landed | Resolve the named failing gate evidence (lifecycle, CI, push parity, owner gate, or squash preflight) and re-run the gates. | user-validation | One or more merge gates did not pass. |
| verify.gates.unavailable | verify | platform | false | not_landed | Restore access to the named gate-evidence source and re-run the gates; the gates were not fully evaluated. | platform-provider | Merge-gate evidence could not be read. |
| plan.schema.invalid | plan | user | false | not_landed | Correct the named plan phase and field to match the declared plan schema, then re-run `plan validate`. | user-validation | The plan document does not conform to the plan schema. |
| plan.scope.undeclared-paths | plan | user | false | not_landed | Declare the named path in a phase scope or revert the out-of-scope change, then re-run `plan diff`. | user-validation | Actual changes fall outside the declared plan scope. |
| plan.tier.unknown | plan | user | false | not_landed | Declare a known ceremony tier or extend the known-tier vocabulary, then re-run `plan validate`. | user-validation | The plan declares an unknown ceremony tier. |
| plan.format.legacy-markdown | plan | user | false | not_landed | Rewrite the plan as `chg-<ref>-plan.yaml` to make it schema-valid; legacy markdown stays readable during the transition. | user-validation | The plan is a legacy markdown document, not a schema-valid YAML plan. |
| plan.artifact.missing | plan | user | false | not_landed | Author `chg-<ref>-plan.yaml` (or a legacy `chg-<ref>-plan.md`) for the named change ref, then re-run the command. | user-validation | No plan artifact exists for the change ref. |
| watchdog.checkout-dirty | watchdog | user | false | not_landed | Commit or discard the named uncommitted changes, then re-run the lane preflight. | user-validation | The lane checkout is dirty. |
| watchdog.checkout-non-base | watchdog | user | false | not_landed | Check out the lane's declared base (or correct the declaration), then re-run the lane preflight. | user-validation | The lane checkout is not on its declared base. |
| watchdog.signals-absent | watchdog | platform | true | not_landed | Restore the declared progress-signal sources, then retry; without them the answer is unknown. | platform-provider | No liveness signal sources are available; the answer is unknown. |
| commit.staging-blocked-untracked | commit | user | false | not_landed | Stage or remove the pending material outside the declared scope, or expand the change scope, then retry the commit. | user-validation | Nothing stageable remains for the requested commit. |
| commit.commitlint-failed | commit | user | false | not_landed | Reconcile the repository commitlint configuration with the commit type table (or correct the message), then retry. | user-validation | Neither the generated message nor the deterministic template satisfied commitlint. |
| commit.safety.secret-suspected | commit | user | false | not_landed | Review the named finding class and path, remove or gitignore the suspected material, then retry; never blind-retry. | user-validation | The secret scan flagged candidate content or a filename on suspicion. |
| commit.safety.scan-unavailable | commit | platform | true | not_landed | Restore the deterministic safety scanner and retry; nothing was staged or committed. | platform-provider | The deterministic safety scan could not run. |
| commit.atomic-abort | commit | platform | true | not_landed | Retry the completion; the clean abort restored both the ledger and the commit to neither-landed, and a re-run converges. | platform-provider | The atomic phase completion aborted and restored both sides. |
| commit.session.context-refused | commit | user | false | not_landed | Invoke the commit primitive from outside the delivery session (agents invoke it from a plain shell or subagent boundary). | user-validation | The commit primitive refused to run inside a delivery session. |
| status.collector.tracker.unavailable | status | platform | false | not_landed | Restore access to the named collector source and re-run the board; the board withheld its gates rather than display a partial picture. | platform-provider | The named board collector is unavailable. |
| doctor.check.failed | doctor | user | false | not_landed | Resolve each named failing check using its fix hint, then re-run doctor. | user-validation | One or more wiring checks failed. |

This table is the human- and agent-readable counterpart of `ERROR_TABLE`. The sync check requires each source entry to have exactly one documented row and each documented row to have exactly one source entry; the two fallback rows are included with no containment exemption. The table declares 60 identities across the declared kinds. For closeout target reads, an authentication, transport, or server failure on a non-404 provider response maps to the adapter-local `provider.payload.invalid` identity; a credential-port resolution failure remains `config.credential.missing`.

The `state` domain kind declares nine rows. `state.storage.exhausted` (transient, retryable) classifies a full-disk or settled-quota write failure that never landed; `state.store.unknown` (platform, non-retryable) classifies a record kind or payload schema that is undeclared at a validated boundary and is distinct from the version-scoped `state.schema.mismatch`. Two existing rows carry text-only remediation refinements: `state.write.failed` is scoped to storage errors other than exhaustion, and `state.store.torn` points at the explicit salvage operation as a separate step (the salvage pointer lives in the guidance text, never in read evidence). Every state failure keeps consequence `not_landed`, and every state row is triggerable by a real behaviour, not only declared.

### Failure containment semantics

Two containment entries cover distinct populations, and each population resolves through the entry matching its responsibility:

- **`fallback.invocation`** contains broken invocations and unknown commands: a missing command, a token starting with `-`, an unknown command name, an unexpected positional argument, an unknown flag, a missing flag value, or a conflicting flag pair. It is category `user`, `retryable: false`, `consequence: unknown`, projection class `user-validation` (exit `1`), with a caller-directed remediation hint.
- **`fallback.internal`** contains errors no table entry classifies: undeclared kinds, non-`Error` thrown values, rejected promises, malformed results, a handler whose definition disappears, and serialization failure. It is category `platform`, `retryable: false`, `consequence: unknown`, projection class `platform-provider` (exit `2`), with a remediation hint directing the caller to diagnostics.

Both entries carry `consequence: unknown` because containment never asserts that a mutation landed or did not land, and both carry `retryable: false` because an identical broken invocation fails identically and an unclassifiable failure with unknown consequence must not invite a blind retry. The remediation hint, not the retryable flag, directs the next step.

### Evolution discipline

Envelope changes are additive within `schemaVersion`; a breaking shape change requires a new schema version. A new table entry requires its structured fields, its projection class, and its documented row in the same change. Documentation drift fails closed in both directions: an emitted or referenced code without a documented row fails, and a documented row without a machine-readable entry fails.

The scripted projection is a rendering contract over the unchanged envelope, not a second envelope shape. New commands inherit it through the surface and must not reimplement or bypass it. Interactive output remains byte-identical to the five-key envelope contract; scripted consumer code relies on the process exit code for status, top-level `runId` on failure for correlation, and the command audit ledger for context. Golden fixtures and the conformance validator extend to both modes; a golden case with no golden or a skipped case is a failure, and there is no auto-accept path.

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
| `packages/cli/src/index.ts` | Command surface | `runCli`, invocation parsing, outcome rendering, mode-aware machine output, `startedAt` sampling, best-effort audit capture, top-level containment, and diagnostics. |
| `packages/cli/src/edge.ts` | Runtime-aware edge | `registerEdgeSecrets`, `resolveCliMode`, `resolveAgentIdentity`, `createCliAudit`, and `createProductionDependencies` assemble production defaults from injected data. |
| `packages/cli/src/output/serialize.ts` | Serialization and redaction | `redact`, `serializeEnvelope`, `serializeScriptedLine`, and `writeOutput` are the single stream-write and redaction path; `writeOutput` selects the full envelope or the scripted projection from the injected mode and `--verbose`. |
| `packages/testkit/src/result-conformance.ts` | Conformance validator | `RULES`, `SCRIPTED_RULES`, `assertEnvelopeContract`, `assertScriptedProjection`, and `loadGoldenCases` validate parsed envelopes, scripted projections, and golden cases. |
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

`CliDependencies` carries the injected `brand`, `clock`, `newRunId`, `secrets`, `program`, optional `mode` (`interactive` when omitted), and optional `audit` seam. The audit seam carries the invocation scope, optional repo, optional claimed identity, and a `record(facts)` writer; when it is absent the run is not audited. `CommandProgram` maps command names to `CommandDefinition` values containing a handler and optional flag, required-value, and conflict metadata. Handlers receive a `CommandInvocation` with the command name, parsed flags, remaining argv tokens, and the brand identity.

### Data architecture

The surface determines the outcome, measures `timing`, generates a `runId`, projects the `exitCode` from the outcome, and assembles exactly one of `data` or `error`. The error object is a pure projection of one table entry; non-config handlers may replace the summary with a non-empty string. Config failures always use the table summary, including malformed config discriminants safely contained by `fallback.internal`. The table is `as const` data with no behaviour. The documented table in this spec is the checked S2 surface.

### API and interface contracts

- **`runCli(argv, streams, deps)`** returns the numeric exit code. It emits machine output only when `argv` contains `--json`, using the injected mode: the full envelope in interactive mode, the one-line scripted projection in scripted mode. It always emits a failure diagnostic to the error stream when a failure outcome has a message or summary, plus a classified diagnostic when an injected audit write fails. It is deterministic for identical `argv` and injected dependencies.
- **`writeOutput(streams, envelope, diagnostic, secrets, emitEnvelope, options)`** is the only function in the delivered surface that calls a stream write. It redacts the envelope, the diagnostic, and any human payload before writing, selects the full envelope or the scripted projection from `options.mode` and `options.verbose === true`, and treats `options.pretty` as indentation-only.
- **`assertEnvelopeContract(parsed)`** returns an array of violations covering key sets, mandatory fields, exclusivity, exit-code range, schema version, run-id opacity, timing, and error enum values.
- **`assertScriptedProjection(text)`** returns an array of scripted-projection violations covering the one-line rule, plain-object shape, `data`/`error` exclusivity, the exact success key set (`data`), the exact failure key set (`error` plus top-level `runId`), absent `schemaVersion`/`exitCode`/`timing`, and the full error field set with no nested `runId`.
- **`loadGoldenCases(root)`** discovers `*/argv.json` cases and requires `injected.json`, `meta.json`, and `stdout.json`; a case with no golden fails rather than being skipped, and there is no auto-accept path. The injected facts carry the mode (`interactive` when omitted), and a case's `meta.json` mode must agree with it.

## Non-Functional Requirements

| Concern | Current guarantee |
|---------|-------------------|
| Runtime neutrality | The contracts tier declares types and `as const` data only; no I/O, ambient environment, clock, randomness, or runtime-API imports. |
| Machine-output validity | Every outcome class under `--json` emits exactly one valid output: the full envelope in interactive mode, or exactly one scripted line in scripted mode, for success, classified failure, unknown failure, and broken invocation. |
| Exclusivity and mandatory fields | A success output never carries `error`; a failure output never carries `data`; the full envelope carries all four mandatory fields on every path, and the scripted failure line carries `error` plus top-level `runId`. |
| Timing | `timing.totalMs` is present on the full envelope on success and failure paths; scripted lines omit timing, and the audit record retains it. |
| Mode discipline | Scripted success lines carry exactly `data`; scripted failure lines carry the full error object plus top-level `runId`; neither carries `schemaVersion`, `exitCode`, or `timing`; interactive envelopes stay byte-conformant; `--verbose` restores the full envelope and `--pretty` never re-expands the trim. |
| Redaction | Planted secrets do not survive into any output stream or audit record field; the chokepoint covers `data`, `error`, diagnostics, and audit arguments/identity. Values never registered at the edge are outside the guarantee. |
| Exit projection | Exit codes stay in `{0, 1, 2}`; each entry has exactly one projection class; call-site exit literals outside the projection are forbidden. |
| Audit independence | An injected audit write never changes the command outcome or exit code; its failure appears only as a classified diagnostic. |
| Determinism | Identical argv and injected dependencies yield identical output; no test spawns a process. |
| Documentation binding | Every emitted or referenced code resolves to exactly one documented row and every documented row to exactly one source entry. |
| Boundaries and branding | The serialization entry point and projection rules hold; brand strings are parameters from the edge; new code carries no forbidden product tokens. |

## Quality Assurance Strategy

### Testing approach

| Level | Location | Scope |
|-------|----------|-------|
| Behaviour | `tests/behaviour/error-classification.test.ts`, `exit-projection.test.ts`, `run-cli.test.ts`, `closeout-output.test.ts`, `scripted-trim.test.ts`, `envelope-mode.test.ts` | Classification totality and containment, projection derivation, invocation parsing, stream split, determinism, the closeout identity projection, both-mode rendering, `--verbose`/`--pretty` behavior, and audit-outcome independence. |
| Golden | `tests/golden/*.test.ts` with fixtures under `tests/fixtures/result/envelopes/**` | Captured stdout/stderr against recorded envelopes for success, void success, classified failure, unknown failure, broken commands, and planted secrets, in interactive and scripted modes. |
| Structure | `tests/structure/result-contract.test.ts`, `error-table.test.ts`, `result-fixtures.test.ts`, `cli-edge-seam.test.ts`, `scripted-projection.test.ts` | Envelope and table shape, fixture integrity and mode metadata, edge seam, scripted-projection rule coverage, and no-spawn guarantees. |
| Checks | `tests/checks/error-table-sync.test.ts`, `exit-code-literals.test.ts` | Mutation suites for both invariants: drift in either direction, fail-closed documentation, per-form exit literals, and non-vacuity. |
| Boundaries | `tests/boundaries/**` | Failing fixtures for the serializer-entry and projection-ownership rules, with clean controls. |

### Test data and scenarios

Golden cases are directories under `tests/fixtures/result/envelopes/` containing `argv.json`, `injected.json`, `meta.json`, `stdout.json`, and optional `stderr.txt`. The injected facts include a two-tick clock, a fixed run id, a brand identity, a program name, optional secrets, an optional environment record, optional start ticks, and the mode (`interactive` when omitted). Interactive cases keep the existing full-envelope goldens; scripted cases add per-outcome-class one-line goldens, and a failure golden carries top-level `runId`. The code corpora under `tests/fixtures/result/code-corpora/` are the explicit Level C input for the sync check: each row declares whether its text is recognized and whether every recognized code resolves. The corpora are excluded from the S3 filesystem scan and fed to the check by name.

## Operational & Support

### Configuration

The surface has no ambient configuration reads. Callers inject brand values, clock facts, a run-id factory, registered secrets, the command program, the mode fact, and an optional audit seam. `createProductionDependencies` supplies production defaults for the epoch-millisecond UTC clock, the run id, the registered secrets (from the injected environment record), the mode fact resolved from the injected stream capability (an omitted fact resolves to `scripted`), and the state-backed audit seam over the state directory derived from the branding state-directory name; every fact remains injectable and overridable. `--json` selects machine output; without it, generic successful runs write nothing, the opt-in configuration command prints its selected payload as plain JSON, and failures write only the human diagnostic. Machine-output mode is selected by an injected stream-capability fact; `--verbose` is the only full-envelope override, and `--pretty` is indentation-only. Configuration-specific payloads and safe warnings are documented in [Configuration Layer and Inspection](feature-config-layer.md); the audit ledger is documented in [Command Audit Ledger](feature-audit-ledger.md).

### Observability

The envelope is the observability surface. `runId` correlates machine and human output for one invocation, and `timing.totalMs` exposes duration on every path. In scripted mode the line keeps `runId` only on a failure; the audit record retains `runId`, `resultSchemaVersion`, `exitCode`, and `timing` for every audited invocation. Failure diagnostics name the entry code or handler reason and are written to the injected error stream; an audit-write failure adds its classified state identity to that stream. The invariants fail with messages naming the offending code, entry, file, surface, or fixture row.

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
- **Consumed by** the queue-ready ready-set ([Queue Ready](feature-queue-ready.md)) for the envelope, the redaction path, and error-identity reuse: grammar rejection uses the existing `input.value.rejected`, containment uses `fallback.internal`, and source read failures are condition evidence rather than new rows. Queue ready adds no error-table row or domain kind.
- **Consumed by** the owner-gate SLA board ([Owner-Gate SLA](feature-owner-gate-sla.md)) for the envelope and redaction path, the `status` domain kind, the collector-unavailable family identity, and the exit-`2` projection when a required collector is unavailable. The board adds exactly one documented family row.
- **Consumed by** session database administration ([Session Database Administration](feature-session-database-admin.md)) for the `db` domain kind, the four `db.*` rows, exact-code classification, the envelope, and the redaction path.
- **Consumed by** the closeout transaction ([feature-closeout.md](feature-closeout.md)) for the `closeout` domain kind, the four `closeout.*` rows, exact-code closeout classification, the adapter-local payload identity, and the envelope/redaction path.
- **Consumed by** the watchdog check family ([Watchdog and Lane Contracts](feature-watchdog-lane-contracts.md)) for the `watchdog` domain kind, the three `watchdog.*` rows, exact-code classification, and the envelope/redaction path.
- **Consumed by** the doctor diagnostic ([Doctor](feature-doctor.md)) for the `doctor` domain kind, the single `doctor.check.failed` row, exact-code classification, the failure-envelope/no-`data` exclusivity, the deterministic multi-finding summary, and the envelope/redaction path. Doctor unable to run outside per-check execution reuses existing platform-category containment.
- **Consumed by** verify change and exit taxonomy ([feature-verify-change-and-exit-taxonomy.md](feature-verify-change-and-exit-taxonomy.md)) and verify gates ([feature-verify-gates.md](feature-verify-gates.md)) for the `verify` domain kind and its three rows, the delivery-result token projection, and the non-zero exit guarantee.
- **Consumed by** the machine-readable plan schema and command family ([Machine-Readable Delivery Plan Schema](feature-plan-schema.md)) for the `plan` domain kind, the five `plan.*` rows, the `lint.document.unreadable` row, exact-code plan classification, the envelope, and the verdict-to-exit projection.
- **Consumed by** the commit primitive ([Commit Primitive](feature-commit-primitive.md)) for the `commit` domain kind, the six `commit.*` rows, exact-code commit classification, the envelope for the `commit` surface and the `phase complete` extension, and the rule that a template fallback is success evidence rather than a failure row.
- **Consumed by** the command audit ledger ([Command Audit Ledger](feature-audit-ledger.md)) for the envelope's `schemaVersion`, `runId`, `exitCode`, `timing`, and outcome projection, the redaction chokepoint for record fields, and the scripted-mode contract that the ledger's retained context fields make safe.
- **Depends on** [ADR-0003](../../decisions/ADR-0003-oss-monorepo-structure.md) for runtime-neutral contract placement, package boundaries, and gate stability.
- **Risk — contract cascade:** Every later command and surface consumes the envelope. Mitigation: the field set is fixed at v1, `schemaVersion` provides a breaking-change channel, and evolution is additive within a version.
- **Risk — scripted-consumer breakage:** Scripted output does not carry `schemaVersion`, `exitCode`, or `timing`. Mitigation: the process exit code carries status, a scripted failure keeps top-level `runId`, the audit record retains the trimmed context, `--verbose` restores the full envelope, and both modes are pinned by goldens and the conformance validator.
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
| Machine output | The `--json` channel: one valid output on every outcome, with no diagnostics. In interactive mode it is the full envelope; in scripted mode it is one minified projection line. |
| Interactive mode | The machine-output mode for a terminal stream: the full five-key envelope, indented. |
| Scripted mode | The machine-output mode for a non-interactive stream: one minified `{"data":...}` success line or one `{"error":...,"runId":...}` failure line, with `schemaVersion`, `exitCode`, and `timing` omitted. |
| Trim | The scripted-mode removal of `schemaVersion`, `exitCode`, and `timing` from machine output; the same values remain in the command audit record. |
| `resultSchemaVersion` | The audit invocation record's retained copy of the envelope's `schemaVersion` at invocation time. |
| Sync check | The binding invariant that every emitted code and every documented row agree in both directions. |
| schemaVersion | The brand-neutral stable envelope schema identifier; `delivery.result.v1` at v1. |
| runId | Opaque per-invocation correlation identifier generated at the runtime-aware edge. |

See also: [glossary](../../overview/glossary.md) for repository-wide terms, [feature-monorepo-scaffold-toolchain.md](feature-monorepo-scaffold-toolchain.md), [feature-branding-seam.md](feature-branding-seam.md), [feature-session-database-admin.md](feature-session-database-admin.md), [feature-closeout.md](feature-closeout.md), [feature-watchdog-lane-contracts.md](feature-watchdog-lane-contracts.md), [feature-owner-gate-sla.md](feature-owner-gate-sla.md), [feature-verify-gates.md](feature-verify-gates.md), [feature-audit-ledger.md](feature-audit-ledger.md), and [ADR-0003](../../decisions/ADR-0003-oss-monorepo-structure.md).
## Related
- [Command Audit Ledger](feature-audit-ledger.md) retains the envelope's context fields and owns the record the scripted trim relies on.
- [Verify Gates](feature-verify-gates.md) adds the `verify.gates.failed` and `verify.gates.unavailable` identities.
- [Owner-Gate SLA](feature-owner-gate-sla.md) adds the `status` kind and the `status.collector.<id>.unavailable` family row used by the board.
- [Watchdog and Lane Contracts](feature-watchdog-lane-contracts.md) adds the `watchdog` kind with `watchdog.checkout-dirty`, `watchdog.checkout-non-base`, and `watchdog.signals-absent`.
- [Commit Primitive](feature-commit-primitive.md) adds the `commit` kind with `commit.staging-blocked-untracked`, `commit.commitlint-failed`, `commit.safety.secret-suspected`, `commit.safety.scan-unavailable`, `commit.atomic-abort`, and `commit.session.context-refused`.
- [Doctor](feature-doctor.md) adds the `doctor` kind with the single `doctor.check.failed` row and the deterministic failing-check summary.
