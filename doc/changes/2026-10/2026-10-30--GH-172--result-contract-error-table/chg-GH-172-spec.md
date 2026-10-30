---
change:
  ref: GH-172
  type: feat
  status: Proposed
  slug: result-contract-error-table
  title: "M0-S3: Result contract and error table"
  owners: ["Juliusz Ćwiąkalski"]
  service: delivery-os
  labels: ["oss-tooling", "contracts", "cli", "m0", "adr-0003"]
  version_impact: minor
  audience: mixed
  security_impact: medium
  risk_level: medium
  dependencies:
    internal:
      - "M0-S1 monorepo scaffold and toolchain (GH-170; merged to main-tools via PR #191) — six-package workspace, tier matrices, ambient guards, negative-fixture discipline, CI fast loop"
      - "M0-S2 branding seam (GH-171; merged to main-tools) — BrandIdentity parameter discipline; the forbidden-literal CI scan is live and binding on every artifact of this change"
      - "ADR-0003 — OSS Tooling Monorepo Structure (Accepted 2026-10-24, PR #163) — runtime-neutral contracts, package tiers"
      - "Man-page v0 planning truth (doc/planning/oss-tooling/cli-command-registry.md) — CommandResult fields, --json machine output always valid, exit-code projection {0, 1, 2} with the error table as source of truth"
      - "doc/spec tooling feature area — post-delivery reconciliation authors feature-result-contract.md (first-spec-only authoring)"
    external:
      - "GitHub Actions CI (existing runners; the new checks join the existing ts-* fast loop; no new job topology, no new vendors or services)"
---

# CHANGE SPECIFICATION

> **PURPOSE**: Deliver the single result contract every command speaks — a CommandResult envelope and an internal error table from which self-describing errors, exit codes, and machine-readable output are all derived — so that machines and AI agents can trust the output of any command even when it fails, and failures become classifiable data instead of exit-code folklore.

## 1. SUMMARY

This change delivers the M0-S3 result contract: the `CommandResult` envelope (schemaVersion, runId, exitCode, timing, and data or error) as the one shape every command returns, and the internal error table in the `core` `./contracts` subpath as the primary model of failure. Errors are self-describing for AI agents: a stable symbolic hierarchical code (`domain.reason.detail`, for example `provider.quota.exceeded`) plus structured fields on every error — category (`user` | `platform` | `transient` | `permanent`), `retryable`, `consequence` (`landed` | `not_landed` | `unknown`, with `unknown` first-class), and an action-first remediation hint. Exit codes are a projection of the error table in the standalone CLI only (0 success, 1 user-or-validation, 2 platform-or-provider), never hardcoded at call sites.

The command surface is exercised through `runCli(argv, streams)` — injectable standard-output and error streams, deterministic, testable in-process without spawning a process. Machine output under `--json` is always valid JSON, even on failure and even for a broken command: unclassifiable failures are contained by a fallback table entry whose consequence is `unknown`. A redaction chokepoint on the serialization path guarantees secrets never appear in any output. The error table is declared once as a machine-readable single source, so the acceptance criterion "error codes resolve to documented table entries" is mechanically testable rather than aspirational.

A short survey of AI-agent-facing error design (problem-details structures, RFC 9457 lineage; tool-use error guidance from major LLM tool-use surfaces) was conducted as a companion artifact in this change folder ([survey-agent-facing-error-design.md](survey-agent-facing-error-design.md)); its verdict validates the convention with recorded refinements (Section 15, DEC-10).

**Binding constraint carried from M0-S2 (GH-171):** the forbidden-literal CI scan is live. Zero hardcoded product tokens in new code; brand-dependent values (binary name, environment prefix) flow from `BrandIdentity` as parameters at a runtime-aware edge. No public product name is selected, proposed, or revealed anywhere in this change.

## 2. CONTEXT

### 2.1 Current State Snapshot

- The M0-S1 scaffold (GH-170) is merged to `main-tools`: six packages, tier matrices and cross-package rules enforced with negative fixtures, the ambient-global AST guard, and the additive binding CI fast loop beside the untouched bash stack.
- M0-S2 (GH-171) is merged to `main-tools`: the branding seam with the full twelve-value `BrandIdentity` in `core` `./contracts`, the pure resolver, and the forbidden-literal scan covering the full scope classes, binding in CI.
- `core` `./contracts` currently contains: the generic `Result<T, E>` discriminated envelope (internal computation result), the `BrandIdentity` type, and the two reserved brand-neutral telemetry schema names — types only, runtime-neutral and I/O-free.
- The `cli` package is placeholder tiers (surface entry, `#commands/*`, `#output/*`): types only, no command registration, no output machinery.
- There is no `CommandResult`, no error table, no `runCli` — this change is an additive, greenfield surface.
- Man-page v0 (planning truth) already prescribes the envelope fields exactly (schemaVersion, runId, exitCode, timing, data or error), `--json` machine output always valid even on failure, and the exit-code projection 0 success / 1 user-or-validation / 2 platform-or-provider with the error table as source of truth.
- The first command to consume the envelope lands in M0-S4 (`config`); M0-S5, M0-S10, M0-S11, and M0-S12 follow. No external consumers of the workspace packages exist yet.

### 2.2 Pain Points / Gaps

- Commands have no shared result contract: without one, each future command (M0-S4 onward) would invent its own success/failure shape, and consumers — human, machine, and AI agent — would face per-command folklore instead of one trustworthy envelope.
- Failures have no model: without an error table, failure identity degrades to exit codes and message strings; agents cannot reliably branch (retry? escalate? report?), and exit codes become per-call-site folklore instead of a projection of a classified table.
- Failure output is not guaranteed machine-readable: a crashing command today would emit nothing or garbage on the machine channel, breaking every automation that pipes `--json` output.
- Mutation consequence is invisible: no mechanism records whether a failed command's mutation landed — exactly the information an agent needs to distinguish a safe retry from a double-apply. `unknown` must be a first-class, honest answer.
- Output is not guaranteed secret-free: without a single redaction chokepoint, secret material (tokens, credentials read from the environment) could leak through error payloads or data fields.
- Nothing binds the documented error codes to the emitted ones: "error codes resolve to documented table entries" must be enforced by a test against a machine-readable single source, or it rots.

## 3. PROBLEM STATEMENT

Because the delivery tooling has no shared result contract and no model of failure, every command shipped from M0-S4 onward would define its own success/error shape, project ad-hoc exit codes at call sites, and emit unclassified prose on failure — leaving machines and AI agents unable to trust or act on output, unable to distinguish a safe retry from a double-apply (no mutation-consequence signal), at risk of secret leakage through unredacted payloads, and blocked by machine output that is not guaranteed valid JSON when things go wrong.

## 4. GOALS

- **G-1**: One result contract: every command returns the `CommandResult` envelope (schemaVersion, runId, exitCode, timing, and exactly one of data or error); the generic `Result<T, E>` remains the internal computation result, `CommandResult` is the command-surface envelope.
- **G-2**: One failure model: the internal error table (in `core` `./contracts`) is the single source of truth; failures are classified through the chain domain kind → app error code → exit-code projection.
- **G-3**: Self-describing errors for agents: stable symbolic hierarchical codes plus structured fields on every error — category (`user` | `platform` | `transient` | `permanent`), `retryable`, `consequence` (`landed` | `not_landed` | `unknown`, `unknown` first-class), and an action-first remediation hint.
- **G-4**: Exit codes are a projection of the table in the standalone CLI only — fixed at {0, 1, 2} per man-page v0, derived from table entries, never hardcoded per call site.
- **G-5**: A testable command surface: `runCli(argv, streams)` with injected output streams, deterministic, exercisable in-process without spawning a process.
- **G-6**: Machine output is always valid: under `--json`, every outcome — success, classified failure, unknown failure, broken command — emits a valid envelope.
- **G-7**: Secrets never appear in output: a single redaction chokepoint sits on the serialization path and covers success and failure payloads alike.
- **G-8**: Documented codes stay true: the error table is a machine-readable single source, and a binding sync check fails when an emitted code has no documented table entry (or vice versa).
- **G-9**: The delivered surface respects every binding constraint from M0-S1/M0-S2: zero forbidden literals, brand values as `BrandIdentity` parameters at a runtime-aware edge, runtime-neutral contracts, tier matrix green.

### 4.1 Success Metrics / KPIs

| Metric | Target |
|--------|--------|
| Outcomes under `--json` (success, classified failure, unknown failure, broken command) whose machine output parses as a valid envelope | 100% (golden suites) |
| Envelopes violating the field contract (missing schemaVersion/runId/exitCode/timing; both or neither of data/error) | 0 |
| Envelopes missing timing on failure paths | 0 |
| Emitted error codes that do not resolve to exactly one documented table entry | 0 (binding sync check) |
| Documented table entries that are not derivable from the machine-readable source | 0 (binding sync check) |
| Occurrences of planted secret material in any output stream | 0 (planted-secret golden tests, success and failure paths) |
| Exit codes outside {0, 1, 2} or not derived from the table | 0 |
| Exit-code constants written at command call sites outside the projection | 0 |
| `runCli` contract tests that require a spawned process | 0 |
| Forbidden product-token literals in new code | 0 (live M0-S2 scan) |
| Tier/boundary violations introduced by this change | 0 per PR |
| Regressions in existing gates, bash jobs, or the aggregate check | 0 |

### 4.2 Non-Goals

- **NG-1**: Command implementations — no real command ships here; `config` (M0-S4) is the first consumer.
- **NG-2**: Layered configuration (M0-S4), state drivers and persistence (M0-S5), the phase/lint and db commands (M0-S10/S11), adapter primitive ports (M0-S12).
- **NG-3**: Telemetry emission — the reserved brand-neutral schema names (EVT-1/EVT-2 from M0-S2) stay untouched; no event or metric is emitted by this change.
- **NG-4**: MCP or opencode plugin surface work — their result conventions are later projections over the same engines (M1-S7+); this change fixes only the standalone-CLI exit-code projection and leaves those surfaces out.
- **NG-5**: Human-facing help text, color, or terminal UX beyond what envelope emission requires.
- **NG-6**: Any naming decision — no public product name is selected, proposed, or revealed in any artifact (owner-gated, private, outside this repository); brand-dependent strings flow from `BrandIdentity`.
- **NG-7**: Cloud anything (ADR-0003 C-4); changes to the bash stack, `.opencode/`, `.ados-claude/` (C-5/C-6); weakening any existing gate (C-8).
- **NG-8**: The AI-agent-facing error design survey as a distributable doc — per PM decision it is a companion artifact inside this change folder; the validated convention lands in current-truth docs during system-spec reconciliation (phase 7).

## 5. FUNCTIONAL CAPABILITIES

| ID | Capability | Rationale |
|----|------------|-----------|
| F-1 | `CommandResult` envelope — the one result contract of every command | Ticket + man-page v0: machines and agents trust output even on failure; one shape, exactly the prescribed fields. |
| F-2 | Internal error table as the primary failure model (types in `core` `./contracts`) | Ticket: failures are classifiable instead of exit-code folklore; the table, not the call site, is the model. |
| F-3 | Self-describing errors: hierarchical symbolic codes + structured fields | Ticket: agents need stable identity plus category, retryability, consequence, and a remediation hint to act. |
| F-4 | Exit-code projection in the standalone CLI only, derived from the table | Ticket + man-page v0: {0, 1, 2} projected from table entries; the CLI is the only place the projection exists. |
| F-5 | `runCli(argv, streams)` — injectable, deterministic, testable without spawning a process | Ticket: the command surface must be exercisable as a unit. |
| F-6 | Machine output always valid — failure containment via the fallback table entry | Ticket AC: a broken command under `--json` still emits a valid envelope. |
| F-7 | Redaction chokepoint at the serialization edge | Ticket AC: secrets never appear in output; serialization belongs at edges, not in runtime-neutral contracts. |
| F-8 | Machine-readable error table as single source with a binding docs/code sync check | Ticket AC: error codes resolve to documented table entries — testably, not aspirationally. |
| F-9 | Boundary and branding conformance of the delivered surface | Binding M0-S1/M0-S2 constraints: zero forbidden literals, `BrandIdentity` parameters, runtime-neutral contracts, tier matrix. |

### 5.1 Capability Details

- **F-1**: Every command returns a `CommandResult` envelope containing exactly the man-page v0 fields: `schemaVersion`, `runId`, `exitCode`, `timing`, and exactly one of `data` (success payload) or `error` (failure object) — never both, never neither. A void success carries an explicit empty data payload rather than an ambiguous both-absent shape. `schemaVersion` is a brand-neutral, stable string identifying the envelope schema (fixed at v1 introduction: `delivery.result.v1`, following the reserved schema-name lineage); it changes only on a breaking shape change. `runId` is an opaque, per-invocation correlation identifier generated at the runtime-aware edge (contracts carry the field; generation mechanics — clock, randomness — stay out of the runtime-neutral contracts). `timing` carries the run's measured timing facts (at minimum total duration) and is present on every envelope, success and failure alike. The envelope is declared in `core` `./contracts` alongside the generic `Result<T, E>`: `Result` remains the internal computation result returned by engines; `CommandResult` is the command-surface envelope a command's result is rendered into. Evolution is additive within `schemaVersion`; breaking shape changes require a new schema version (survey verdict 8).
- **F-2**: The error table is the primary model of failure: a declared, machine-readable set of entries in `core` `./contracts`, each entry defining an app error code, its domain kind, its structured fields (F-3), and its exit-code projection class (F-4). Errors raised by domain engines carry a domain kind and are classified through the chain: domain kind → app error code → exit-code projection class. An error that no entry classifies is contained by the fallback table entry (F-6). The contracts tier stays runtime-neutral and I/O-free: the table is data and types, not behavior; classification and rendering live at the surface tiers.
- **F-3**: Every error is self-describing for agents. Identity is a stable symbolic hierarchical app error code `domain.reason.detail` (for example `provider.quota.exceeded`) — not a URI, not an HTTP status (survey verdicts 2–3). Every error additionally carries structured fields: `category` — fixed at four values, `user` | `platform` | `transient` | `permanent` (responsibility and persistence of the failure); `retryable` — boolean, an explicit retry signal so agents branch without guessing; `consequence` — `landed` | `not_landed` | `unknown`, recording whether the attempted mutation landed, with `unknown` first-class and mandatory for the fallback entry (survey verdict 6: the surveyed designs' shared gap; this convention's contribution, motivated by retry safety); `remediationHint` — an action-first, non-secret hint of what the caller should try next (survey verdict 9); plus an optional non-identifying human-readable summary. Prose is never identity and never carries secret material.
- **F-4**: Exit codes exist only as the standalone CLI's projection of the table: 0 success; 1 user-or-validation error; 2 platform-or-provider error (man-page v0). Each table entry declares exactly one projection class; the numeric exit code is derived from the entry — never written as a literal at a command call site, and never numerically diversified beyond {0, 1, 2} (survey verdict 10: a small fixed projection plus structured fields beats a wide numeric vocabulary). No other surface projects exit codes.
- **F-5**: The command surface is exercised through `runCli(argv, streams)`: arguments in, injected standard-output and standard-error streams out, plus the resulting exit code. It is deterministic — identical argv and injected streams (and injected clock facts where timing is involved) yield identical output — and testable in-process without spawning a process. Machine envelopes are written to the injected standard-output stream; human-oriented diagnostics, where any exist, go to the injected error stream and never corrupt the machine channel. Brand-dependent strings (for example the binary name in usage text) are received as `BrandIdentity` parameters supplied at this runtime-aware edge — never ambient reads, never committed literals.
- **F-6**: Machine output under `--json` is always valid: success, classified failure, unknown failure, and broken command (unrecognized invocation, malformed arguments) all emit a valid envelope. Unclassifiable failures and broken commands are contained by the fallback table entry — its consequence is `unknown`, its class is user-or-validation (broken command) with the caller-directed remediation hint — so the machine channel never crashes, never emits a stack trace or raw diagnostics, and never emits non-JSON (survey verdict 11: diagnostics belong to human-oriented output and logs, never the machine envelope).
- **F-7**: A single redaction chokepoint sits on the serialization path — the edge where envelopes become output — and transforms or removes secret material before any byte reaches a stream. It covers the success `data` payload and the `error` object alike, on both failure and success paths. Contracts stay I/O-free; redaction is edge behavior with golden tests proving planted secrets (for example environment-sourced tokens) never survive into any output stream.
- **F-8**: The error table is declared once as a machine-readable single source; the documentation of the table (the entries a human or agent consults) is derived from — or validated against — that source by a binding sync check: every app error code emitted anywhere (code, docs, fixtures) resolves to exactly one documented table entry, and every documented entry exists in the source. Drift fails the CI fast loop. This makes the ticket's acceptance criterion "error codes resolve to documented table entries" mechanically true rather than a documentation aspiration.
- **F-9**: The delivered surface respects every binding constraint: zero forbidden product tokens in new code (the live M0-S2 scan is binding); brand-dependent values flow as `BrandIdentity` parameters at the runtime-aware edge; `core` `./contracts` gains types and data only — no I/O, no ambient environment, clock, or randomness reads; the `cli` tiers respect the existing tier matrix; every new forbidden boundary rule ships with its failing negative fixture; existing gates stay green.

## 6. USER & SYSTEM FLOWS

```
Flow 1 — Successful command
  An operator or agent runs a command with --json
    → the command's engines return Result<T, E> (ok)
    → the surface renders the CommandResult envelope (schemaVersion, runId,
      timing, data; exit code 0 via the success projection)
    → the redaction chokepoint scrubs the serialization path
    → a valid envelope is written to the injected stdout stream

Flow 2 — Classified failure
  A domain engine raises an error carrying a domain kind
    → the classification chain resolves it: domain kind → app error code
      → exactly one table entry (category, retryable, consequence,
        remediationHint, projection class)
    → the envelope carries the error object; the exit code is derived from
      the entry's projection class (1 or 2)
    → a valid envelope is emitted; timing is present on the failure path

Flow 3 — Unknown failure / broken command (containment)
  An error no table entry classifies — or a broken invocation
  (unknown command, malformed arguments) — occurs under --json
    → the fallback table entry contains it (consequence = unknown,
      caller-directed remediation hint)
    → a valid envelope is emitted on the machine channel; exit code per the
      fallback entry's projection class
    → diagnostics, if any, go to the human-oriented error stream only;
      no stack traces or raw errors in the machine envelope

Flow 4 — Agent consumption
  An AI agent reads the envelope
    → branches on the app error code, category, and retryable
    → checks consequence before any retry (unknown ⇒ no blind retry)
    → follows the remediation hint; prose fields aid nuance, never identity

Flow 5 — Error table evolution (docs/code sync)
  A contributor adds or edits a table entry
    → the machine-readable source changes; documentation is derived or
      re-validated
    → the binding sync check runs in the CI fast loop
    → any emitted code without a documented entry — or documented entry
      without a source — fails the check

Flow 6 — Branding discipline (standing constraint)
  The runtime-aware edge assembles BrandIdentity and injects streams
    → runCli renders brand-dependent strings from parameters
    → the forbidden-literal scan stays green: zero product tokens in code
```

## 7. SCOPE & BOUNDARIES

**Binding constraints on everything in scope:** (a) zero forbidden product tokens — brand values flow from `BrandIdentity` as parameters at a runtime-aware edge (live M0-S2 CI scan); (b) runtime neutrality — the contracts tier gains types and data only: no I/O, no ambient environment/clock/randomness reads; serialization and redaction belong at edges; (c) boundary rules — existing tier matrices hold; new forbidden rules require failing negative fixtures; no existing gate may be weakened.

### 7.1 In Scope

- The `CommandResult` envelope contract in `core` `./contracts` — exactly the man-page v0 fields, data/error mutual exclusivity, timing on all paths (F-1).
- The declaration of the relationship: generic `Result<T, E>` stays the internal computation result; `CommandResult` is the command-surface envelope (F-1, DM-1).
- The internal error table as a machine-readable single source in `core` `./contracts`: entries with app error code, domain kind, category, retryable, consequence, remediation hint, projection class, and non-identifying summary; including the fallback entry with consequence `unknown` (F-2, F-3, F-8).
- The classification chain (domain kind → app error code → exit-code projection class) and the exit-code projection {0, 1, 2} in the standalone CLI only, derived from table entries (F-2, F-4).
- `runCli(argv, streams)` with injected standard-output and error streams, deterministic, in-process testable, machine envelopes on the output stream and human diagnostics on the error stream (F-5).
- Failure containment: machine output always valid under `--json`, including broken commands; no diagnostics or stack traces in the machine envelope (F-6).
- The redaction chokepoint on the serialization path, covering success and failure payloads (F-7).
- The binding docs/code sync check for the error table (F-8).
- Unit and golden tests: success and failure envelope goldens, classification-chain unit tests, planted-secret redaction goldens, broken-command containment golden, determinism/in-process `runCli` tests, projection derivation tests (per ticket AC).
- The AI-agent-facing error design survey as a companion artifact in this change folder (already authored: [survey-agent-facing-error-design.md](survey-agent-facing-error-design.md)); its verdicts validate the convention and are incorporated here (DEC-10).
- Boundary and branding conformance for all of the above, with negative fixtures for any new forbidden rule (F-9).
- Post-delivery system-spec reconciliation inputs: `feature-result-contract.md` is authored during phase 7 (first-spec-only).

### 7.2 Out of Scope

- [OUT] Command implementations (first real command: `config`, M0-S4); command-name lock (M0-S17).
- [OUT] Layered configuration, per-key provenance (M0-S4); state drivers and persistence (M0-S5); phase/lint (M0-S10); db admin (M0-S11); adapter primitive ports (M0-S12).
- [OUT] Telemetry emission or any use of the reserved schema names beyond leaving them untouched.
- [OUT] MCP / opencode plugin result conventions (later projections over the same engines; M1-S7+).
- [OUT] Any public product name decision, candidate name, or name reveal in any artifact (owner-gated, private, outside this repository).
- [OUT] Human-facing terminal UX (colors, progress, interactivity) beyond envelope emission.
- [OUT] Promoting the error-design survey into the distributable doc set (companion artifact only; the validated convention reaches current-truth docs via phase 7).
- [OUT] Cloud names, designs, or code (C-4); changes to the bash stack, `.opencode/`, `.ados-claude/` (C-5/C-6); weakening or relaxing any existing gate, scan, or boundary rule (C-8).

### 7.3 Deferred / Maybe-Later

- **Consequence propagation contracts**: how engines declare `landed` / `not_landed` for specific mutation-bearing failures beyond table-level defaults — refined by the first mutating command (M0-S10 `phase` is the first write path).
- **Retry-delay signaling**: a structured retry-delay hint for transient entries (survey verdict 5 lineage) — added when a consumer needs it; the `retryable` boolean suffices at v1.
- **Localized or audience-specific remediation hints**: single hint string at v1.
- **Envelope schema registry**: if more schema names accumulate, a consolidated schema registry — not needed at one envelope.

## 8. INTERFACES & INTEGRATION CONTRACTS

### 8.1 REST / HTTP Endpoints

N/A — no HTTP surface in this change. The envelope is a process-surface contract; transport status coupling is explicitly rejected (survey verdict 3).

### 8.2 Events / Messages

N/A — no events or messages are emitted. The reserved brand-neutral telemetry schema names (EVT-1/EVT-2 from M0-S2) are untouched; no emission path exists.

### 8.3 Data Model Impact

| ID | Element | Description |
|----|---------|-------------|
| DM-1 | `CommandResult` envelope (in `core` `./contracts`) | The command-surface result contract: `schemaVersion` (stable brand-neutral string, `delivery.result.v1` at v1), `runId` (opaque per-invocation correlation id, generated at the runtime-aware edge), `exitCode`, `timing` (present on every path; at minimum total duration), and exactly one of `data` or `error`. Generic `Result<T, E>` remains the internal computation result; the envelope is the surface rendering. Evolution additive within `schemaVersion`; breaking shape change ⇒ new version. |
| DM-2 | Envelope error object | `code` (app error code, DM-4), `category` (`user` | `platform` | `transient` | `permanent`), `retryable` (boolean), `consequence` (`landed` | `not_landed` | `unknown`; `unknown` first-class), `remediationHint` (action-first, secret-free), optional non-identifying `summary`. Prose is never identity. |
| DM-3 | Error table entry | The table's declared row shape: app error code, domain kind, category, retryable, consequence, remediation hint, exit-code projection class (`success` | `user-validation` | `platform-provider`), non-identifying summary. Declared once as a machine-readable single source (F-8); includes the fallback entry (consequence `unknown`). |
| DM-4 | App error code format | Stable symbolic hierarchical code `domain.reason.detail` (for example `provider.quota.exceeded`); resolves to exactly one table entry; documented table derived from the machine-readable source. |

### 8.4 External Integrations

None. No new vendors, services, or network surfaces. The new checks (golden suites, sync check, projection tests) join the existing CI fast loop; no new job topology.

### 8.5 Backward Compatibility

Fully additive. No external consumers of the workspace packages exist; the placeholder `cli` tiers gain their first real surface. The generic `Result<T, E>` is unchanged — existing and future engines keep returning it; only the surface rendering is new. The bash stack, existing gates, and the aggregate check are untouched. No published artifact exists; nothing to deprecate. The `schemaVersion` field is present from day one so future breaking envelope changes have a versioning channel.

## 9. NON-FUNCTIONAL REQUIREMENTS (NFRs)

| ID | Requirement | Threshold |
|----|-------------|-----------|
| NFR-1 | Runtime neutrality of the contracts tier: I/O operations, ambient environment/clock/randomness reads, or runtime-API imports in the envelope and error-table declarations | 0, enforced by the existing boundary and ambient suites every PR |
| NFR-2 | Envelope validity under `--json` across all outcome classes (success, classified failure, unknown failure, broken command) | 100% of golden-suite outcomes parse as valid JSON matching DM-1 |
| NFR-3 | Field-contract violations: missing `schemaVersion`/`runId`/`exitCode`/`timing`; both or neither of `data`/`error` present | 0 in all golden and unit suites |
| NFR-4 | Timing presence on failure paths | 100% of failure envelopes carry `timing` |
| NFR-5 | Secret material in any output stream (planted-secret golden tests on success and failure paths) | 0 occurrences; the chokepoint covers `data` and `error` alike |
| NFR-6 | Emitted app error codes resolving to exactly one documented table entry (and documented entries existing in the machine-readable source) | 100%; the sync check is binding in the CI fast loop and fails on drift in either direction |
| NFR-7 | Exit-code projection: codes outside {0, 1, 2}; table entries without exactly one projection class; exit-code literals at command call sites outside the projection | 0 / 0 / 0 |
| NFR-8 | `runCli` testability: contract tests requiring a spawned process; nondeterministic output given identical argv + injected streams (+ injected clock facts) | 0 spawned-process tests; output deterministic |
| NFR-9 | Forbidden product-token literals in new code; brand-derived strings not sourced from `BrandIdentity` parameters at the runtime-aware edge | 0 (live M0-S2 scan binding); 0 ambient brand derivations |
| NFR-10 | Tier/boundary violations introduced; regressions in existing gates, bash jobs, or the aggregate check | 0 per PR; no regression; aggregate check green |

## 10. TELEMETRY & OBSERVABILITY REQUIREMENTS

No product telemetry is emitted; the reserved schema names stay untouched (NG-3). The envelope itself is the observability surface: `runId` enables correlation across a command invocation's human and machine outputs, and `timing` makes duration visible on every path. Check observability = CI: the sync check and golden suites fail with messages naming the offending code, entry, or fixture so an agent can place the fix without archaeology.

## 11. RISKS & MITIGATIONS

| ID | Risk | Impact | Probability | Mitigation | Residual Risk |
|----|------|--------|-------------|------------|---------------|
| RSK-1 | The envelope or error-object shape is wrong in a way that cascades — M0-S4/S5/S10/S11/S12 all consume this contract | H | M | Man-page v0 already fixes the field set; survey validates the error convention; `schemaVersion` gives a breaking-change channel from day one; DoR gate reviews the contract before delivery; evolution rule (additive within a version) recorded (DEC-9) | Medium |
| RSK-2 | Error-table docs and code drift, resurrecting "exit-code folklore" as documentation folklore | M | M | Machine-readable table as single source; binding two-directional sync check in the CI fast loop (NFR-6); doc derivation during phase 7 | Low |
| RSK-3 | The redaction chokepoint is bypassed (a surface writes a stream without it) and secrets leak | H | L | Single chokepoint on the serialization path; planted-secret golden tests on success and failure paths; review asserts no direct stream writes outside the chokepoint (NFR-5) | Low–Medium |
| RSK-4 | Exit-code folklore re-emerges: per-call-site codes or numeric diversification beyond {0, 1, 2} | M | M | Projection derived only from table entries; NFR-7 forbids call-site exit-code literals; survey verdict 10 records the principle; reviewer checks it | Low |
| RSK-5 | A crash path escapes containment (failure before envelope construction) and breaks the always-valid guarantee | M | M | Containment is a top-level `runCli` responsibility wrapping all command execution; broken-command golden test proves a valid fallback envelope (AC-F6-1); unknown-failure mapping to the fallback entry is unit-tested | Low–Medium |
| RSK-6 | Product-token leakage into the new CLI surface (usage text, output strings) violating the M0-S2 naming firewall | M | L | Live forbidden-literal scan is binding; brand strings received as `BrandIdentity` parameters at the runtime-aware edge; NFR-9 | Low |
| RSK-7 | `consequence: unknown` is overused as a lazy default on classifiable failures, eroding agent trust in the field | M | L | Table entries require explicit consequence values; `unknown` is reserved for the fallback entry and genuinely indeterminate outcomes; review and table-entry authoring discipline | Low |
| RSK-8 | Scope creep: envelope work balloons into config/state/command implementation | M | L | NG-1/NG-2 fix the boundary; the change delivers the contract plus a testable surface; first real command is M0-S4 | Low |

## 12. ASSUMPTIONS

- M0-S1 and M0-S2 are merged and green (`main-tools` @ b3a00a9 includes the GH-171 merge); the tier matrices, ambient guards, and the forbidden-literal scan are active as described.
- No external consumers of the workspace packages exist, so the greenfield additive surface breaks nothing.
- Man-page v0 remains planning truth; the M0-S17 command-name lock does not affect the envelope or error-table contracts (they are name-free).
- Engines throughout the workspace keep returning the generic `Result<T, E>`; adopting the envelope happens at surface tiers, not by rewriting engines.
- No new runtime dependencies are required; if delivery planning discovers one, the license-registry gate (fail-closed) applies in the same change.
- The first consuming command (`config`, M0-S4) lands after this change, so v1 contract refinement is still cheap; the DoR gate (phase 5) is the last cheap checkpoint.

## 13. DEPENDENCIES

| Direction | Item | Notes |
|-----------|------|-------|
| Depends on | M0-S1 scaffold (GH-170, merged) | Workspace, tier matrices, ambient guards, negative-fixture harness, CI fast loop. |
| Depends on | M0-S2 branding seam (GH-171, merged) | `BrandIdentity` parameter discipline; the live forbidden-literal scan is a binding constraint on every artifact of this change. |
| Depends on | ADR-0003 | Runtime-neutral contracts placement, package tiers, C-4/C-5/C-6/C-8 constraints. |
| Depends on | Man-page v0 (doc/planning/oss-tooling/cli-command-registry.md) | Prescribes the envelope fields, `--json` always-valid machine output, and the {0, 1, 2} exit-code projection with the table as source of truth. |
| Depends on | Repository testing strategy | Golden-test, mutation-test, and fixture rules for repository checks. |
| Depends on | Companion survey (survey-agent-facing-error-design.md, this folder) | Validates/refines the error-code convention; verdicts incorporated (DEC-10). |
| Blocks | M0-S4 config layer | First command consumer; emits envelopes through `runCli`. |
| Blocks | M0-S5 state layer | State operations classify failures through the table. |
| Blocks | M0-S10 lint + phase | Phase is the first mutation-bearing write path; consequence semantics become load-bearing. |
| Blocks | M0-S11 db admin | Admin commands emit envelopes; dry-run defaults ride the classification chain. |
| Blocks | M0-S12 adapter primitive ports | Port errors classify into the table; embedded metadata stays outside this envelope. |

## 14. OPEN QUESTIONS

None at spec time. The questions surfaced at clarify_scope were resolved: the envelope JSON details (schemaVersion value, runId format, exact shapes) are fixed here as design decisions within the spec-writer's remit per PM planning (DEC-1, DEC-8, DM-1); the survey's home (companion artifact vs. new doc area) was decided by PM (DEC-10); exit-code values come from man-page v0. Remaining mechanics (fixture organization, exact check wiring) are technical and reversible, owned by delivery planning within the contracts fixed here.

## 15. DECISION LOG

| ID | Decision | Rationale | Date |
|----|----------|-----------|------|
| DEC-1 | The generic `Result<T, E>` remains the internal computation result; `CommandResult` is a separate command-surface envelope. No replacement or reshaping of `Result`. | Ticket frames CommandResult as the command envelope; `Result<T, E>` is already in `core` `./contracts` serving engines. Two named concepts with a declared rendering relationship avoid overloading one type with computation and transport concerns. | 2026-10-30 |
| DEC-2 | The internal error table is the primary model; types and entries live in `core` `./contracts`; exit codes are a projection in the standalone CLI only. | Ticket + man-page v0. The table-not-call-site principle is what makes failures classifiable and the projection testable. | 2026-10-30 |
| DEC-3 | Error identity is a stable symbolic hierarchical app error code (`domain.reason.detail`); no URI identity, no HTTP-status coupling, no numeric diversification. | Ticket's convention; survey verdicts 2, 3, 10 (adapt/reject the RFC 9457 URI and status elements; keep a small fixed exit projection). A process surface must not require network dereference for diagnosis. | 2026-10-30 |
| DEC-4 | Structured fields fixed on every error: `category` (`user` | `platform` | `transient` | `permanent`), `retryable`, `consequence` (`landed` | `not_landed` | `unknown`), `remediationHint` (action-first). | Ticket; category enum fixed at four values and hints made action-first per survey verdicts 4 and 9. Fixed fields (rather than open extension maps) at v1 keep the shape reliably machine-branchable (survey verdict 8, adapted). | 2026-10-30 |
| DEC-5 | `consequence` records whether the attempted mutation landed, with `unknown` first-class; the fallback table entry mandates `unknown`. | Survey finding 5: no surveyed design makes consequence first-class — the retry-safety gap. `unknown` is the honest state for unclassifiable and indeterminate outcomes (ticket: "unknown is first-class"). | 2026-10-30 |
| DEC-6 | `runCli(argv, streams)` receives injected standard-output and error streams, is deterministic, and is testable in-process without spawning a process; machine envelopes go to the output stream, human diagnostics to the error stream. | Ticket. Injection is what makes the surface testable and keeps determinism; the channel split protects the always-valid machine guarantee (F-5/F-6). | 2026-10-30 |
| DEC-7 | Machine output is always valid via top-level containment: unclassifiable failures and broken commands are contained by the fallback table entry; diagnostics and stack traces never enter the machine envelope. | Ticket AC ("a broken command under --json still emits a valid envelope"); survey verdicts 7 and 11 (errors-as-data; no raw diagnostics in machine output). | 2026-10-30 |
| DEC-8 | `schemaVersion` is a brand-neutral stable string, fixed at `delivery.result.v1` for v1; `runId` is an opaque per-invocation identifier generated at the runtime-aware edge. | PM planning delegated envelope JSON details to this spec. The value follows the reserved schema-name lineage (`delivery.event.v1`); edge generation keeps the contracts tier free of clock/randomness (NFR-1). | 2026-10-30 |
| DEC-9 | Envelope evolution is additive within a `schemaVersion`; breaking shape changes require a new schema version. | Survey verdict 8 (structured extension-channel lineage); gives every downstream consumer a stable evolution contract from day one. | 2026-10-30 |
| DEC-10 | The AI-agent-facing error design survey is authored as a companion artifact inside this change folder (not a distributable doc); its verdict (convention validated; refinements: action-first hints, category enum fixed at four values, consequence retained as the novel element, additive evolution) is incorporated into this spec. | PM decision 2026-10-30 — avoids one-off research notes entering the distributable doc set and their `ados_distribution` obligations; the validated convention lands in current-truth docs via phase 7. | 2026-10-30 |
| DEC-11 | A single redaction chokepoint sits on the serialization path; contracts stay I/O-free; the sync check for the error table is binding in the CI fast loop. | Ticket ACs (secrets never in output; codes resolve to documented entries). Runtime neutrality (ADR-0003) places redaction at edges; a binding check is the only way the documentation criterion stays true (F-7, F-8). | 2026-10-30 |
| DEC-12 | `change.type = feat` | Adds the result-contract and error-table capability — new behavior on a greenfield surface, not a refactor of existing behavior. | 2026-10-30 |

## 16. AFFECTED COMPONENTS (HIGH-LEVEL)

| Component | Impact |
|-----------|--------|
| `core` `./contracts` subpath | New — `CommandResult` envelope, envelope error object, error-table entry types, app error code format, fallback entry; `Result<T, E>` unchanged; stays runtime-neutral and I/O-free |
| `cli` surface/commands/output tiers | New — `runCli(argv, streams)`, classification chain, exit-code projection, serialization with the redaction chokepoint; placeholder tiers gain their first real surface |
| Workspace tests (`tests/**`) | New — golden suites (success, failure, broken command, planted-secret), classification-chain and projection unit tests, in-process `runCli` determinism tests, sync check |
| CI fast loop | Updated — the sync check and golden suites join the existing `ts-*` jobs; no new job topology |
| `doc/spec/**` | Reconciled post-delivery — `feature-result-contract.md` authored during phase 7 (first-spec-only) |
| Man-page v0 (doc/planning/oss-tooling/cli-command-registry.md) | Unchanged — remains planning truth; already consistent with this spec |
| Companion survey (this folder) | Referenced — validates the convention; not part of the distributable doc set |
| `packages/adapters`, `packages/mcp`, `packages/opencode`, bash stack, `.opencode/`, `.ados-claude/` | Untouched |

## 17. ACCEPTANCE CRITERIA

Ticket AC coverage: ticket AC-1 (unit and golden tests) → AC-F1-3, AC-F3-1, AC-F4-1, AC-F5-1, AC-F5-2, AC-F7-1; ticket AC-2 (broken command under `--json` still emits a valid envelope) → AC-F6-1, AC-F6-2; ticket AC-3 (secrets never appear in output) → AC-F7-1, AC-F7-2; ticket AC-4 (error codes resolve to documented table entries) → AC-F3-1, AC-F8-1. Change-added edge-case criteria: AC-F1-1, AC-F1-2, AC-F2-1, AC-F2-2, AC-F3-2, AC-F9-1.

| ID | Criterion | Linked |
|----|-----------|--------|
| AC-F1-1 | **Given** any completed command run, **when** its `CommandResult` envelope is inspected, **then** it contains exactly the fields `schemaVersion`, `runId`, `exitCode`, `timing`, and exactly one of `data` or `error` — never both, never neither — and a void success carries an explicit empty data payload. | F-1, DM-1, NFR-3 |
| AC-F1-2 | **Given** a command run that fails (classified or unknown), **when** its envelope is inspected, **then** `timing` is present and reflects the measured run duration. | F-1, NFR-4 |
| AC-F1-3 | **Given** a command run under `--json` that succeeds, **when** its machine output is captured, **then** it matches the golden success envelope fixture: valid JSON, all fields present, exit code 0. | F-1, F-6, NFR-2 |
| AC-F2-1 | **Given** the `core` `./contracts` surface, **when** inspected, **then** the generic `Result<T, E>` is unchanged as the internal computation result, `CommandResult` is declared as the command-surface envelope, and neither carries I/O, ambient environment, clock, or randomness dependencies. | F-2, DM-1, NFR-1 |
| AC-F2-2 | **Given** the internal error table, **when** any entry is inspected, **then** it carries the full row shape — app error code, domain kind, category, retryable, consequence, remediation hint, exit-code projection class, non-identifying summary — and each entry maps to exactly one projection class. | F-2, DM-3, NFR-7 |
| AC-F3-1 | **Given** an error raised by a domain engine, **when** the classification chain resolves it (domain kind → app error code → exit-code projection class), **then** the resulting code is a stable symbolic hierarchical code that resolves to exactly one documented table entry. | F-3, DM-4, NFR-6 |
| AC-F3-2 | **Given** an error that no table entry classifies, **when** its envelope is built, **then** the fallback table entry is applied — consequence `unknown`, caller-directed remediation hint, projection class per the fallback definition — and **given** table entries for mutation-bearing failures, **when** inspected, **then** each states consequence explicitly as `landed`, `not_landed`, or `unknown`. | F-3, DM-2, DM-3 |
| AC-F4-1 | **Given** the error table, **when** exit codes are computed for any outcome, **then** every code is in {0, 1, 2} per the fixed classes (0 success; 1 user-or-validation; 2 platform-or-provider), derived from table entries — and **when** command call sites are inspected, **then** no exit-code constant exists outside the projection. | F-4, NFR-7 |
| AC-F5-1 | **Given** `runCli` invoked with argv and injected streams, **when** it executes a command to completion, **then** it writes deterministic output to the injected streams and returns the exit code, without spawning a process. | F-5, NFR-8 |
| AC-F5-2 | **Given** the `runCli` contract tests, **when** executed, **then** they run in-process (zero spawned processes), and identical argv plus identical injected streams (and clock facts) yield identical output. | F-5, NFR-8 |
| AC-F6-1 | **Given** a broken invocation (unknown command or malformed arguments) under `--json`, **when** `runCli` executes, **then** it still emits a valid envelope whose error resolves to a documented table entry with a caller-directed remediation hint, instead of crashing or emitting non-JSON. | F-6, NFR-2 |
| AC-F6-2 | **Given** any failure outcome under `--json`, **when** the machine channel is inspected, **then** it contains no stack traces or raw diagnostics — diagnostics, if any, appear only on the human-oriented error stream. | F-6, DEC-7 |
| AC-F7-1 | **Given** success and failure payloads that would carry planted secret material (for example environment-sourced tokens), **when** the envelopes are serialized for output, **then** the redaction chokepoint removes or transforms the material such that no secret appears in any output stream, proven by golden tests on both paths. | F-7, NFR-5 |
| AC-F7-2 | **Given** the delivered surface code, **when** reviewed, **then** no output stream is written outside the redaction chokepoint's serialization path, and remediation hints and summaries are secret-free by construction. | F-7, NFR-5 |
| AC-F8-1 | **Given** the machine-readable error table as single source, **when** the binding sync check runs, **then** every app error code referenced in code, docs, and fixtures resolves to exactly one documented table entry, every documented entry exists in the source, and drift in either direction fails the CI fast loop. | F-8, NFR-6 |
| AC-F9-1 | **Given** the forbidden-literal scan and the boundary suites, **when** they run on the delivered change, **then** zero product-token literals appear in new code, brand-dependent strings flow from `BrandIdentity` parameters at the runtime-aware edge, the contracts tier remains I/O-free, the tier matrix is green, and every new forbidden boundary rule has its failing negative fixture. | F-9, NFR-9, NFR-10 |

## 18. ROLLOUT & CHANGE MANAGEMENT (HIGH-LEVEL)

- Single PR targeting `main-tools`; branch `feat/GH-172/result-contract-error-table`; one conventional commit per plan phase.
- Fully additive greenfield surface; the bash stack, existing gates, and user-facing behavior are unchanged; no data migration. Reversal is a single PR revert.
- The contract is the stability promise to M0-S4/S5/S10/S11/S12 — the DoR gate (phase 5) reviews spec + test plan + plan against the ticket before any delivery begins.
- Post-delivery, phase 7 authors `feature-result-contract.md` (first-spec-only) and derives the human-readable error-table documentation from the machine-readable source; the sync check keeps them honest from then on.
- The companion survey stays a change-folder artifact; its validated convention reaches current-truth docs only via phase 7.

## 19. DATA MIGRATION / SEEDING (IF APPLICABLE)

N/A — no persisted data is created, moved, or migrated. The envelope is emitted per invocation; nothing is stored. State persistence arrives with M0-S5.

## 20. PRIVACY / COMPLIANCE REVIEW

The redaction chokepoint is the privacy-relevant control of this change: envelopes may carry command-derived payloads, and secret material (environment-sourced tokens, credentials) must never reach an output stream — covered on success and failure paths by planted-secret golden tests (NFR-5). Remediation hints and summaries are secret-free by construction. No telemetry, no network surfaces, no user data at rest. Cloud prohibitions (C-4) and privacy obligations attaching to later persisted events (M0-S5 onward) are unaffected.

## 21. SECURITY REVIEW HIGHLIGHTS

- **Secret containment** is the headline security property: one chokepoint, both payload kinds, both outcome classes, proven by adversarial golden tests (F-7, AC-F7-1, AC-F7-2).
- **No diagnostics in machine output**: stack traces and raw errors never enter the `--json` channel, removing an information-disclosure path to automated consumers (F-6).
- **Branding firewall holds**: zero product tokens; brand strings are `BrandIdentity` parameters at the runtime-aware edge; the live M0-S2 scan is binding on every artifact (NFR-9).
- **Contracts stay I/O-free**: the envelope and table cannot become environment-probing or exfiltration surfaces (NFR-1).
- No new dependencies, secrets, or credentials; new checks join the existing CI posture (binding, no bypass constructs).

## 22. MAINTENANCE & OPERATIONS IMPACT

- The error table grows by reviewed change: each new entry needs its code, structured fields, projection class, and documentation — the sync check enforces completeness automatically.
- `schemaVersion` evolution is a stability promise: additive changes within v1 are free; breaking shape changes require a new version and consumer review.
- Downstream stories (M0-S4+) inherit the contract; reshaping envelope or table semantics later is a breaking-contract change requiring explicit review (RSK-1).
- Golden fixtures become living artifacts: envelope goldens are updated only with deliberate contract changes, never incidentally.
- CI cost grows slightly (golden suites + sync check in the existing fast loop); keep failure messages precise so agents can place fixes without archaeology.

## 23. GLOSSARY

| Term | Definition |
|------|------------|
| CommandResult envelope | The one result contract of every command: schemaVersion, runId, exitCode, timing, and exactly one of data or error. |
| `Result<T, E>` | The pre-existing generic internal computation result in `core` `./contracts`; unchanged by this change; engines return it, surfaces render it into the envelope. |
| Error table | The internal, machine-readable, single-source set of failure entries; the primary model from which error identity, structured fields, and exit-code projection are all derived. |
| App error code | Stable symbolic hierarchical error identity `domain.reason.detail` (for example `provider.quota.exceeded`); resolves to exactly one table entry. |
| Domain kind | The failure classification a domain engine attaches to an error; the first link of the classification chain. |
| Classification chain | domain kind → app error code → exit-code projection class; the path from an engine failure to a table entry. |
| Exit-code projection | The standalone CLI's mapping of table entries to {0, 1, 2}: 0 success; 1 user-or-validation; 2 platform-or-provider. The only place exit codes exist. |
| Consequence | Structured field recording whether the attempted mutation landed: `landed` | `not_landed` | `unknown`; `unknown` is first-class and mandatory on the fallback entry. |
| Remediation hint | Action-first, secret-free guidance on what the caller should try next; prose, never identity. |
| Fallback entry | The table entry containing unclassifiable failures and broken commands; consequence `unknown`; keeps machine output always valid. |
| runCli(argv, streams) | The testable command-surface entry point: arguments in, injected standard-output and error streams out, exit code returned; deterministic; no process spawning in tests. |
| Redaction chokepoint | The single serialization-path control that removes or transforms secret material before any byte reaches an output stream. |
| Machine output | The `--json` channel: always a valid envelope, on every outcome, with no diagnostics; written to the injected output stream. |
| Golden test | A test asserting captured output against a recorded fixture; used here for success, failure, broken-command, and planted-secret envelopes. |
| Sync check | The binding CI check that every emitted app error code resolves to exactly one documented table entry and every documented entry exists in the machine-readable source. |
| schemaVersion | The brand-neutral stable string identifying the envelope schema (`delivery.result.v1` at v1); changes only on a breaking shape change. |
| runId | Opaque per-invocation correlation identifier, generated at the runtime-aware edge; present in every envelope. |

## 24. APPENDICES

### Appendix A — Envelope field contract (man-page v0, verbatim field set)

| Field | Presence | Contract |
|-------|----------|----------|
| `schemaVersion` | Always | Brand-neutral stable string; `delivery.result.v1` at v1; changes only on breaking shape change. |
| `runId` | Always | Opaque per-invocation correlation id; generated at the runtime-aware edge; contracts carry the field only. |
| `exitCode` | Always | Projected from the table (or success class 0); in {0, 1, 2}; standalone CLI only. |
| `timing` | Always (success and failure) | Measured timing facts; at minimum total duration. |
| `data` | On success (exactly one of data/error) | Success payload; explicit empty payload for void successes. |
| `error` | On failure (exactly one of data/error) | The envelope error object (DM-2); no stack traces, no raw diagnostics. |

### Appendix B — Error table entry contract

| Column | Contract |
|--------|----------|
| App error code | Stable symbolic `domain.reason.detail`; unique within the table; resolves to exactly one entry. |
| Domain kind | The engine-level failure classification that maps to this entry. |
| Category | Fixed enum: `user` | `platform` | `transient` | `permanent`. |
| Retryable | Boolean; explicit retry signal for agents. |
| Consequence | `landed` | `not_landed` | `unknown`; explicit per entry; `unknown` mandatory on the fallback entry. |
| Remediation hint | Action-first, secret-free next-step guidance. |
| Projection class | `success` | `user-validation` | `platform-provider`; exactly one; yields the {0, 1, 2} exit code in the standalone CLI. |
| Summary | Optional non-identifying human-readable prose; never identity, never secret material. |

### Appendix C — Exit-code projection (man-page v0)

| Exit code | Class | Derived from |
|-----------|-------|--------------|
| 0 | Success | The success projection (no table entry required). |
| 1 | User-or-validation error | Entries whose projection class is `user-validation` (includes the fallback entry for broken commands). |
| 2 | Platform-or-provider error | Entries whose projection class is `platform-provider`. |

### Appendix D — Companion survey (reference)

[survey-agent-facing-error-design.md](survey-agent-facing-error-design.md) (this folder) surveys RFC 9457 problem details, the Google error-model lineage, BSD `sysexits`, and LLM tool-use error guidance (Anthropic, OpenAI, MCP). Verdict: the convention specified here stands validated; refinements incorporated — action-first remediation hints, category enum fixed at four values, `consequence` retained as the convention's novel contribution (no surveyed design provides it), additive envelope evolution within `schemaVersion`; URI identity, HTTP-status coupling, and diagnostics-in-machine-output rejected. Verdicts attach to structural elements, not vendor payload versions.

### Appendix E — References

- Issue #172 — M0-S3: Result contract and error table (goal, tasks, ACs; verbatim per backlog M0-S3).
- Backlog, Epic M0, story M0-S3 (doc/planning/oss-tooling/backlog.md).
- Man-page v0 (doc/planning/oss-tooling/cli-command-registry.md) — envelope fields, `--json` always-valid, exit-status projection.
- ADR-0003 — OSS Tooling Monorepo Structure (runtime-neutral contracts, tiers, C-3/C-4/C-5/C-6/C-8).
- M0-S2 branding seam (GH-171 spec and merged delivery) — `BrandIdentity`, forbidden-literal scan.
- Current-truth baseline: doc/spec/features/feature-monorepo-scaffold-toolchain.md, doc/spec/features/feature-branding-seam.md.
- PM planning notes (chg-GH-172-pm-notes.yaml) — decisions, current-truth state, AC edge cases.
- Companion survey: survey-agent-facing-error-design.md (this folder).

## 25. DOCUMENT HISTORY

| Version | Date | Author | Changes |
|---------|------|--------|---------|
| 1.0 | 2026-10-30 | @spec-writer | Initial specification |

---

## AUTHORING GUIDELINES

- Sources: issue #172 body (identical to backlog M0-S3, cross-checked per pm-notes), man-page v0 (envelope fields, always-valid `--json`, exit-code projection — taken as planning truth), chg-GH-172-pm-notes.yaml (decisions, current-truth state, binding M0-S2 constraint, AC edge cases), current code state (`core` `./contracts`: `Result<T, E>` + `BrandIdentity` + reserved schema names; `cli` placeholder tiers), and the companion survey already authored in this folder (verdicts incorporated rather than re-derived).
- Envelope JSON details (schemaVersion value, runId format, channel split) were delegated to this spec by PM planning and are fixed here (DEC-8, DEC-6). No public product name appears anywhere; brand-dependent values are referenced only as `BrandIdentity` parameters. Format and rigor follow the GH-171 sibling spec.
- No content was invented beyond the delegated contract decisions; all remaining shape mechanics (fixture organization, exact check wiring) are explicitly left to delivery planning.

## VALIDATION CHECKLIST

- [x] `change.ref` matches provided `workItemRef` (GH-172)
- [x] `owners` has at least one entry
- [x] `status` is "Proposed"
- [x] All sections present in order (1-25 + guidelines + checklist)
- [x] ID prefixes consistent and unique (F-1..F-9, DM-1..DM-4, NFR-1..NFR-10, RSK-1..RSK-8, DEC-1..DEC-12, AC-*)
- [x] Acceptance criteria reference at least one F-/NFR-/DM- ID and use Given/When/Then
- [x] NFRs include measurable values
- [x] Risks include Impact & Probability
- [x] No implementation details (no file-level code paths, no step-by-step tasks)
- [x] No content duplicated from linked docs (survey referenced, not duplicated)
- [x] Front matter validates per front_matter_rules
