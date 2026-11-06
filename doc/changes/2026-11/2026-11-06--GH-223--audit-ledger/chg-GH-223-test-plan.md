---
id: chg-GH-223-test-plan
status: Proposed
created: 2026-11-06
last_updated: 2026-11-06
owners: ["engineering"]
service: delivery-os
labels: ["m1", "audit", "state-layer", "cli"]
version_impact: minor
summary: "Traceable coverage for GH-223 command audit ledger and agent identity: exactly one durable record per invocation across every outcome class, claimed-identity capture without inference, owner-pinned scripted-output trim with interactive preservation, keyed tamper-evident chaining with salvage continuity, bounded filtered reads, redaction-chokepoint hygiene, and classified audit-write degradation that never changes the command outcome."
links:
  change_spec: ./chg-GH-223-spec.md
  implementation_plan: null
  testing_strategy: .ai/rules/testing-strategy.md
---

# Test Plan - M1-S22: Command audit ledger and agent identity

## 1. Scope and Objectives

This plan protects the delivery engine's new history guarantee: every command invocation through the command surface leaves exactly one durable, schema-validated audit record carrying runId, command, redacted arguments, exit code, timing, outcome class, scope/repo, and claimed identity when present. It also protects the owner-pinned scripted-output amendment (one minified `{"data":...}`/`{"error":...}` line, with errors keeping runId), the keyed hash chain that makes altered records detectable even when their unkeyed checksum is recomputed, the bounded/filtered read surface for retro and auditor consumers, and the redaction chokepoint that must guard record content exactly as it guards output streams.

The data and security risks this plan primarily guards are: missing or duplicate records that make history untrustworthy; unredacted secrets persisted forever; inferred identities presented as if claimed; a trim that silently drops context with no ledger to hold it; a chain that false-flags legitimate salvage or fails to flag a recomputed-checksum edit; an unbounded dump that exposes every historical command line; and an audit-write failure that either corrupts or misreports the command's own outcome.

Regressions protected: the M0-S3 envelope contract in interactive mode, error-table contents and bidirectional sync, text (non-`--json`) output, the single serialization/redaction chokepoint, the state layer's verified-read, fence, classification, salvage, and evidence discipline, and the no-spawn deterministic in-process test surface.

### 1.1 In Scope

- Exactly-one audit-record semantics for success, void success, classified failure (user and platform), unknown failure, and broken invocation (unknown command/flag, missing flag value, conflicting flags).
- Full record field set, envelope-context retention, scope/repo capture, additive-kind composition inside `delivery.state.v1`, and store-scoped key behaviour.
- Idempotent re-runs producing a second record under a new runId; no deduplication or overwrite.
- Agent-identity consumption: seam-named environment variable read as injected edge data, verbatim capture when present and non-empty, absent-never-inferred, claimed-not-proven semantics.
- Scripted-mode trim for success, void success, classified failure, unknown failure, and broken invocation; error lines keep runId and full error-table fields; interactive envelopes remain byte-conformant; `--verbose` full-envelope override; `--pretty` indentation-only; single-line discipline on the current machine channel (the future multi-event `--watch` rule is a forward contract, see §1.2).
- Golden fixtures and testkit conformance validator extended to both modes, preserving the no-case-without-golden rule and the no-skip path.
- Keyed hash chaining: clean verification, interleaved non-audit kinds, alteration detection including recomputed unkeyed checksums, position-naming evidence, key exclusion from ledger bytes/records/lane-visible surfaces, chain anchoring, and continuity across terminal-tail repair and guided salvage.
- Bounded, filtered read surface: scope/command/outcome filters, explicit bound, in-band truncation, verified reads, no fence acquisition, no writes, torn/unknown classification without silent zeros.
- Redaction-chokepoint hygiene for record content across all outcome classes, including a registered secret embedded in arguments and in the identity value.
- Audit-write failure semantics: classified, loud diagnostics degradation that never changes the command's outcome or exit code, with no partial record.
- No new error-table rows and no error-table drift; no new CLI audit command; tier and boundary conformance.

### 1.2 Out of Scope & Known Gaps

- [OUT] The harness-adapter spawn-side setter of the identity variable and the harness-plugin rendering into agent shells (spec NG-1, DEC-3). Tests model the declared lane environment as fixture data.
- [OUT] The retro pipeline (M1-S8), spend read side (M1-S19), coordinator exit evidence (M1-S20), and any other consumer of the read surface (spec NG-2).
- [OUT] A user-facing CLI audit-reading command (spec NG-3, DEC-6). The read surface is library-only.
- [OUT] Tamper prevention, authenticated identity, multi-user/remote threat models, cryptographic non-repudiation, and key rotation/escrow (spec NG-4, §7.3).
- [OUT] Retention, pruning, compaction, backup/restore, migration, or a state schema-version bump (spec NG-5, NG-6, §19).
- [OUT] MCP surface changes; the MCP projection is untouched by the CLI's scripted-mode rendering (spec §7.2).
- [OUT] Real process spawning, real process streams, real disk exhaustion, or host-capacity tests. Every case runs in process with injected clock, run-id factory, environment, mode fact, secrets, and named state-edge fault points.
- [OUT] Windows ACL execution. Permission assertions remain POSIX-only; no Linux run claims Windows verification.
- [OUT] Performance/load characteristics of audit reads or chain verification.
- **Forward contract:** stream outputs (a future `--watch`) stay line-delimited in every mode (F-3/DEC-2). No stream command ships in this story, so only the current single-invocation line discipline is asserted; the multi-event stream rule is inherited by the later command that introduces it.
- **Known gap (spec-level):** the time-window filter required by F-5/AC-F5-1 has no timestamp field in the specified record set. TC-GH223-028 covers the other filters and truncation; the time-window half is marked TODO in §3.1/§3.3 and raised as OQ-T5 for spec reopening.

## 2. References

- **Change specification**: [chg-GH-223-spec.md](./chg-GH-223-spec.md) — capabilities F-1..F-6, AC-F1-1..AC-F6-1, NFR-1..NFR-9, DEC-1..DEC-8, Appendix B test-plan handoff.
- **Change PM notes**: [chg-GH-223-pm-notes.yaml](./chg-GH-223-pm-notes.yaml) — scope resolution (consume-only identity), dependency verification, doc-sync obligations.
- **Seeded milestone scenario**: [doc/planning/oss-tooling/milestones/m1/test-scenarios.md](../../../planning/oss-tooling/milestones/m1/test-scenarios.md) — SC-M1-23 (stable id; inherited and extended here).
- **Current system truth — result contract**: [doc/spec/features/feature-result-contract.md](../../../spec/features/feature-result-contract.md) — envelope field contract, exit projection, redaction chokepoint, golden/conformance tooling, containment.
- **Current system truth — state layer**: [doc/spec/features/feature-state-layer.md](../../../spec/features/feature-state-layer.md) — public port, additive kinds, artifact boundaries, verified reads, fences, salvage/repair, evidence model, forever retention.
- **Current system truth — branding seam**: [doc/spec/features/feature-branding-seam.md](../../../spec/features/feature-branding-seam.md) — `environmentPrefix` derivation and forbidden-literal constraints.
- **Testing strategy**: [.ai/rules/testing-strategy.md](../../../../.ai/rules/testing-strategy.md) — layers, module mapping, conventions, quality gates.
- **TypeScript rules**: [.ai/rules/typescript.md](../../../../.ai/rules/typescript.md) — bun:test authoring, workspace boundaries, error contract.
- **State test harness**: `tests/fixtures/state/harness.ts` — `createTestEdge` (`arm`, `armExhaustion`), `makeIdentity`, `openStore`, `withinFence`, `ledgerText`, `ledgerBytes`, `ledgerDigest`, `independentChecksum`, `salvageTail`.
- **Result/golden harness**: `tests/golden/helpers.ts`, `packages/testkit/src/result-conformance.ts` — `runCase`, `runDescriptor`, `bufferSink`, `loadGoldenCases`, `assertEnvelopeContract`, `RULES`.
- **Runtime edge and fault points**: `packages/cli/src/edge.ts` (environment facts as data), `packages/cli/src/index.ts` (`CliDependencies`), `packages/core/src/state/edge.ts` (`StateEdgeFaultPoint`).
- **Existing suites to extend or guard**: `tests/golden/envelope-success.test.ts`, `tests/golden/envelope-failure.test.ts`, `tests/golden/broken-command.test.ts`, `tests/golden/redaction.test.ts`, `tests/golden/timing.test.ts`, `tests/structure/result-contract.test.ts`, `tests/structure/result-fixtures.test.ts`, `tests/structure/cli-edge-seam.test.ts`, `tests/structure/state-imports.test.ts`, `tests/structure/state-scope.test.ts`, `tests/checks/error-table-sync.test.ts`, `tests/structure/error-table.test.ts`, `tests/checks/forbidden-literals.test.ts`.

## 3. Coverage Overview

### 3.1 Functional Coverage (F-#, AC-#)

| AC ID | Description | TC ID(s) | Status |
|-------|-------------|----------|--------|
| AC-F1-1 | Exactly one audit record per invocation in any outcome class, carrying runId, command (raw tokens for broken invocations), arguments, exit code, timing, outcome class, scope/repo, and claimed identity when provided; envelope context retained | TC-GH223-001, TC-GH223-002, TC-GH223-003, TC-GH223-004, TC-GH223-005, TC-GH223-008, TC-GH223-009, TC-GH223-010, TC-GH223-022 | Covered |
| AC-F1-2 | Identical re-run appends a second record with a new runId; no deduplication or overwrite | TC-GH223-006, TC-GH223-022 | Covered |
| AC-F1-3 | Malformed audit entry classifies as an existing state identity; pre-existing records remain verified-readable and unchanged; no silent byte drop; explicit salvage preserves the damaged region as evidence; retention forever | TC-GH223-007 | Covered |
| AC-F2-1 | Seam-named identity variable present → value captured verbatim as claimed attribution, recorded as claimed not proven | TC-GH223-011, TC-GH223-013, TC-GH223-022 | Covered |
| AC-F2-2 | Identity variable absent → no identity and nothing inferred from user, host, session, or any other signal | TC-GH223-012, TC-GH223-022 | Covered |
| AC-F3-1 | Scripted `--json` success → exactly one minified `{"data":...}` line with no schemaVersion, runId, or timing; audit retains them; process exit code carries status | TC-GH223-014, TC-GH223-015, TC-GH223-022 | Covered |
| AC-F3-2 | Scripted `--json` failure → exactly one minified `{"error":...}` line with full error-table fields and runId as correlation key; audit retains schemaVersion, runId, timing | TC-GH223-016, TC-GH223-017, TC-GH223-022 | Covered |
| AC-F3-3 | Interactive terminal keeps the full M0-S3 envelope unchanged; documented override forces the full envelope in either mode; pretty flag affects indentation only | TC-GH223-018, TC-GH223-019 | Covered |
| AC-F3-4 | Golden and conformance suites extended to both modes; interactive cases use envelope rules; scripted cases use scripted-projection rules; every case keeps its golden with no skip path | TC-GH223-020, TC-GH223-021 | Covered |
| AC-F4-1 | Altered record (including recomputed unkeyed checksum) flagged as a chain break naming record position, never payload/checksum bytes; undetectable alteration unachievable within trust model | TC-GH223-024, TC-GH223-025, TC-GH223-033 | Covered |
| AC-F4-2 | Chaining key appears nowhere in lane environment, ledger bytes, or any record field; exists only as an injected value at the runtime edge | TC-GH223-026 | Covered |
| AC-F4-3 | After terminal-tail repair or guided salvage, chain verifies continuously over the surviving sequence; reported removal is not a break; next record chains from the last surviving audit record | TC-GH223-027 | Covered |
| AC-F5-1 | Bounded, filtered read returns verified matching records within the bound, reports truncation in-band, acquires no fence, writes nothing, classifies torn/unknown without silent zeros, no unbounded dump path | TC-GH223-028, TC-GH223-029, TC-GH223-030, TC-GH223-034 | Covered (partial: time-window filter TODO — see OQ-T5) |
| AC-F6-1 | Planted registered secrets, including one in command arguments, never appear in any record field on any outcome class; arguments reach the ledger only through the redaction chokepoint | TC-GH223-031, TC-GH223-032 | Covered |

Every acceptance criterion has at least one automated case. AC-F5-1 is covered for scope/command/outcome filters, bounds, truncation, fence/write discipline, and torn/unknown classification; its time-window filter cannot be asserted as written because the specified record set has no timestamp (OQ-T5).

### 3.2 Interface Coverage (API-#, EVT-#, DM-#)

| Interface ID | Description | TC ID(s) | Status |
|--------------|-------------|----------|--------|
| EVT-1 | Audit invocation record: one additive classified record per invocation through the public state port, carrying the full field set and chain value, never secrets/chaining key/evidence bytes | TC-GH223-001, TC-GH223-002, TC-GH223-003, TC-GH223-004, TC-GH223-005, TC-GH223-006, TC-GH223-007, TC-GH223-008, TC-GH223-022 | Covered |
| DM-1 | Audit invocation record kind and payload schema inside `delivery.state.v1` under one store-scoped key, validated by an artifact boundary with declared kinds, schema identity, required fields, and closed vocabularies | TC-GH223-005, TC-GH223-008, TC-GH223-034 | Covered |
| DM-2 | Chain value covering the previous audit record's chain value and the new record's audited content; verification recomputes over the verified sequence; key never stored | TC-GH223-023, TC-GH223-024, TC-GH223-025, TC-GH223-026, TC-GH223-027 | Covered |
| DM-3 | Claimed identity field: verbatim seam-named variable value when present and non-empty; absent otherwise; attribution only | TC-GH223-011, TC-GH223-012, TC-GH223-013, TC-GH223-022 | Covered |
| DM-4 | Stream-capability mode fact injected at the runtime-aware edge and consumed by the mode contract; part of golden-fixture injected facts | TC-GH223-018, TC-GH223-019, TC-GH223-020 | Covered |

### 3.3 Non-Functional Coverage (NFR-#)

| NFR ID | Requirement | TC ID(s) | Status |
|--------|-------------|----------|--------|
| NFR-1 | Exactly one record per invocation across all outcome classes; 0 missing, 0 duplicates; re-runs distinguished by runId | TC-GH223-001, TC-GH223-002, TC-GH223-003, TC-GH223-004, TC-GH223-006, TC-GH223-009, TC-GH223-010, TC-GH223-022 | Covered |
| NFR-2 | Registered secret values never appear in any record field on any outcome class | TC-GH223-031, TC-GH223-032 | Covered |
| NFR-3 | 100% of alteration mutations flagged as chain breaks naming position; 0 false verified verdicts | TC-GH223-023, TC-GH223-024, TC-GH223-025, TC-GH223-027 | Covered |
| NFR-4 | Chaining key never enters lane environments, ledger bytes, or any record field | TC-GH223-026 | Covered |
| NFR-5 | Identity captured verbatim when present; 0 inferred identities when absent | TC-GH223-011, TC-GH223-012, TC-GH223-013, TC-GH223-022 | Covered |
| NFR-6 | Scripted success lines carry exactly `data`; scripted failure lines carry `error` with full fields plus runId; exactly one line per invocation; interactive envelopes byte-conform | TC-GH223-014, TC-GH223-015, TC-GH223-016, TC-GH223-017, TC-GH223-018, TC-GH223-019, TC-GH223-020, TC-GH223-021, TC-GH223-022 | Covered |
| NFR-7 | Every read query honors its declared bound and reports truncation in-band; 0 unbounded dump paths | TC-GH223-028, TC-GH223-029, TC-GH223-030 | Covered (bound/filters/truncation; time-window filter TODO per OQ-T5) |
| NFR-8 | Malformed entries classify without silent loss; salvage preserves; retention forever; no prune/delete/compaction path | TC-GH223-007, TC-GH223-027 | Covered |
| NFR-9 | Contracts runtime-neutral; audit consumer composes the public state port only; state tier never imports branding; no new runtime-API location or driver discriminant; error-table sync untouched | TC-GH223-008, TC-GH223-013, TC-GH223-033, TC-GH223-034 | Covered |

## 4. Test Types and Layers

All cases are automated `bun:test` suites under `tests/**/*.test.ts`; no case is manual. The repository maps `packages/**` changes to `bun test tests/structure tests/behaviour`, the boundary suite, golden suites, and `pnpm typecheck`; the audit ledger touches all of those layers.

- **Pure unit tier** — runtime-neutral modules driven directly with in-memory values and byte strings: audit record assembly from a normalized invocation fact, payload validation, chain-link computation and verification over a record sequence, filter matching, bound/truncation arithmetic, and the scripted-projection validator. No filesystem, no CLI.
- **Integration tier (in-process surface + temp store)** — `runCli` with buffer streams, injected clock/run-id/environment/mode/secrets and an audit write port built over a real temporary state directory with the production node edge wrapped by `createTestEdge`. This is where exactly-one semantics, identity capture, trim rendering against the ledger, chain verification, salvage continuity, read-surface behaviour, and audit-write failure are exercised.
- **Golden tier** — `tests/golden/**` byte-for-byte cases, now carrying a mode fact and an audit store per run. Interactive cases retain the existing M0-S3 goldens as interactive cases; scripted cases add per-outcome-class goldens. Every discovered case requires its golden; there is no skip or auto-accept path.
- **Structure / contract / boundary tier** — `tests/structure/**`, `tests/checks/**`, `tests/boundaries/**`: record-kind declarations, tier imports, absence of a CLI audit command, absence of an unbounded dump export, identity-variable naming through the branding seam, no ambient environment reads, and error-table non-drift.
- **Static/diff** — `git diff --check` plus the existing naming/path and forbidden-literal scans.

Determinism rules: no process spawning, no real clock, no ambient environment read, no real process streams, no network, and no writes outside a per-test temp root. The no-spawn guard in `tests/fixtures/result/no-spawn-guard.ts` is installed around representative `runCli` cases.

## 5. Test Scenarios

### 5.1 Scenario Index

| TC ID | Title | Type | Tier | Automation | Priority | AC Coverage |
|-------|-------|------|------|------------|----------|-------------|
| TC-GH223-001 | Success and void success append exactly one full audit record | Happy Path | Integration | Automated | Critical | AC-F1-1 |
| TC-GH223-002 | Classified user/platform failures append exactly one record with the projected outcome class | Negative | Integration | Automated | Critical | AC-F1-1 |
| TC-GH223-003 | Unknown failures append exactly one record | Negative | Integration | Automated | Critical | AC-F1-1 |
| TC-GH223-004 | Broken invocations append exactly one record with raw argv tokens | Negative | Integration | Automated | Critical | AC-F1-1 |
| TC-GH223-005 | Audit record field set, scope/repo, and boundary schema | Happy Path | Unit + Integration | Automated | Critical | AC-F1-1 |
| TC-GH223-006 | Identical re-run appends a second record distinguished by runId | Happy Path | Integration | Automated | Critical | AC-F1-2 |
| TC-GH223-007 | Malformed audit entry is classified, preserved, and salvaged without data loss | Edge Case | Integration | Automated | Critical | AC-F1-3 |
| TC-GH223-008 | Audit records are an additive kind within `delivery.state.v1` and interleave safely | Edge Case | Contract + Integration | Automated | High | AC-F1-1 |
| TC-GH223-009 | Generic audit-write fault degrades loudly without changing the command outcome | Negative | Integration | Automated | Critical | AC-F1-1 |
| TC-GH223-010 | Fence-busy and exhaustion audit-write failures leave the outcome unchanged with no partial record | Negative | Integration | Automated | Critical | AC-F1-1 |
| TC-GH223-011 | Identity present is recorded verbatim as claimed attribution | Happy Path | Integration | Automated | High | AC-F2-1 |
| TC-GH223-012 | Identity absent or empty is never inferred | Edge Case | Integration | Automated | High | AC-F2-2 |
| TC-GH223-013 | Identity variable is seam-named and read as injected edge data | Contract | Structure + Check | Automated | High | AC-F2-1 |
| TC-GH223-014 | Scripted success renders one minified `{"data":...}` line without trimmed context | Happy Path | Integration + Golden | Automated | Critical | AC-F3-1 |
| TC-GH223-015 | Scripted void success renders `{"data":{}}` exactly | Edge Case | Integration + Golden | Automated | High | AC-F3-1 |
| TC-GH223-016 | Scripted classified failure renders one minified `{"error":...}` line with runId and full error fields | Negative | Integration + Golden | Automated | Critical | AC-F3-2 |
| TC-GH223-017 | Scripted unknown and broken-invocation failures follow the same projection | Negative | Integration + Golden | Automated | High | AC-F3-2 |
| TC-GH223-018 | Interactive mode keeps the full M0-S3 envelope byte-for-byte | Regression | Integration + Golden | Automated | Critical | AC-F3-3 |
| TC-GH223-019 | `--verbose` forces the full envelope; `--pretty` affects indentation only; stream line discipline | Edge Case | Integration | Automated | High | AC-F3-3 |
| TC-GH223-020 | Golden suites cover both modes with no case without a golden and no skip path | Contract | Golden + Structure | Automated | Critical | AC-F3-4 |
| TC-GH223-021 | Conformance validator enforces scripted-projection rules with negative controls | Contract | Unit + Structure | Automated | High | AC-F3-4 |
| TC-GH223-022 | SC-M1-23: scripted invocation is audited and trimmed end-to-end | Happy Path | Integration | Automated | Critical | AC-F1-1, AC-F1-2, AC-F2-1, AC-F2-2, AC-F3-1, AC-F3-2, AC-F6-1 |
| TC-GH223-023 | Clean chain verifies; interleaved non-audit kinds neither break nor participate | Happy Path | Unit + Integration | Automated | Critical | AC-F4-1 |
| TC-GH223-024 | Altered record with recomputed unkeyed checksum is flagged with position | Negative | Integration | Automated | Critical | AC-F4-1 |
| TC-GH223-025 | Mutation matrix: every alteration is flagged; no false verified verdicts | Negative | Integration | Automated | Critical | AC-F4-1 |
| TC-GH223-026 | Chaining key never enters lane environment, ledger bytes, or records | Negative | Integration + Check | Automated | Critical | AC-F4-2 |
| TC-GH223-027 | Salvage and terminal-tail repair keep chain continuity; reported removals are not breaks | Corner Case | Integration | Automated | Critical | AC-F4-3 |
| TC-GH223-028 | Bounded filtered reads return verified matches and report truncation in-band | Happy Path | Integration | Automated | High | AC-F5-1 |
| TC-GH223-029 | No unbounded dump path exists through the read surface | Negative | Structure | Automated | Critical | AC-F5-1 |
| TC-GH223-030 | Read surface classifies torn/unknown without silent zeros and writes nothing | Negative | Integration | Automated | Critical | AC-F5-1 |
| TC-GH223-031 | Planted secrets in arguments never reach any audit record field | Negative | Integration | Automated | Critical | AC-F6-1 |
| TC-GH223-032 | Record content passes the single redaction chokepoint; no secondary serialization path | Negative | Integration + Structure | Automated | Critical | AC-F6-1 |
| TC-GH223-033 | No new error-table rows; sync passes; chain breaks are evidence not codes | Contract | Contract + Check | Automated | High | AC-F4-1, NFR-9 |
| TC-GH223-034 | Tier and boundary conformance; audit read is library-only | Contract | Structure + Boundary | Automated | High | AC-F5-1, NFR-9 |

### 5.2 Scenario Details

#### TC-GH223-001 - Success and void success append exactly one full audit record

**Scenario Type**: Happy Path
**Impact Level**: Critical
**Priority**: Critical
**Related IDs**: F-1, F-6, AC-F1-1, EVT-1, DM-1, NFR-1
**Test Type(s)**: Integration
**Automation Level**: Automated
**Target Layer / Location**: `tests/behaviour/audit-ledger.test.ts` (new); `tests/fixtures/state/harness.ts` (extend with audit-store helpers)
**Tags**: @backend, @audit, @state, @cli

**Preconditions**:

- A temp audit store opened through the public state port with `createTestEdge`.
- A synthetic command program whose handler returns `{ data: { message: "all good", count: 2 } }`.
- A void-success program returning `{ data: {} }` (the repository's explicit empty-success form).
- Injected clock ticks `[1000, 1013]`, run-id factory `run-gh223-0001`, synthetic brand, no secrets.

**Steps**:

1. Run the data command with `--json` through `runCli` with buffer streams and the audit deps.
2. Run the void-success command with `--json` in a second invocation with run id `run-gh223-0002`.
3. Run the data command in text mode (no `--json`) with run id `run-gh223-0003`.
4. Read the store's verified records and filter the audit kind.
5. For each run, inspect the record: runId, command, arguments, exit code, timing, outcome class, scope/repo, identity presence, and chain presence.

**Expected Outcome**:

- Each of the three invocations produced exactly one audit record; no invocation produced zero or two.
- The success records carry runId, the resolved command name, the full argv arguments, exit code `0`, `timing.totalMs` equal to the tick delta, outcome class `success`, the store/workspace scope, and the envelope's schemaVersion (retained as context).
- The text-mode invocation is audited exactly like the `--json` invocation; auditing is not tied to the machine channel.
- No record contains the chaining key. The record's own chain value and the store's framing checksum are present as required; no evidence text leaks payload or checksum bytes beyond the audited arguments.

**Postconditions**:

- Temp root removed.

---

#### TC-GH223-002 - Classified user/platform failures append exactly one record with the projected outcome class

**Scenario Type**: Negative
**Impact Level**: Critical
**Priority**: Critical
**Related IDs**: F-1, AC-F1-1, EVT-1, DM-1, NFR-1
**Test Type(s)**: Integration
**Automation Level**: Automated
**Target Layer / Location**: `tests/behaviour/audit-outcomes.test.ts` (new, outcome-class matrix)
**Tags**: @backend, @audit, @classification

**Preconditions**:

- A temp audit store and a synthetic program with descriptors for a classified user failure (`input.value.rejected`) and a classified platform failure (a declared platform table entry).
- Both failures resolve through the existing error table; no new rows are used.

**Steps**:

1. Run each failing command with `--json`.
2. Assert the process exit code and the envelope error identity per case.
3. Read the audit records and assert exactly one per run.
4. Compare each record's outcome class with the exit projection class produced by the run.

**Expected Outcome**:

- Each classified failure produces exactly one record, carrying the failure's exit code and the projected outcome class (`user-validation` for the user failure, `platform-provider` for the platform failure).
- The record's exit code and outcome class agree with the rendered failure and its envelope context (schemaVersion, runId, exitCode, timing); the error is never treated as a missing record.
- The record's arguments and command are the failing invocation's own, not a neighbouring run's.

---

#### TC-GH223-003 - Unknown failures append exactly one record

**Scenario Type**: Negative
**Impact Level**: Critical
**Priority**: Critical
**Related IDs**: F-1, AC-F1-1, EVT-1, DM-1, NFR-1
**Test Type(s)**: Integration
**Automation Level**: Automated
**Target Layer / Location**: `tests/behaviour/audit-outcomes.test.ts`
**Tags**: @backend, @audit, @classification

**Preconditions**:

- Descriptors for a thrown non-`Error` value, a rejected promise, and a result of an unknown kind, each resolving to the existing containment/fallback identities.

**Steps**:

1. Run each descriptor with `--json`.
2. Assert each run fails with the expected fallback/unknown classification and exit code.
3. Read the audit records for the three runs.
4. Assert one record per run and compare the record's outcome class and exit code with the rendered failure.

**Expected Outcome**:

- Unknown failures are audited exactly once, with the same outcome class and exit code the machine output carried.
- No thrown value's message, stack, or partial assembly payload leaks into the record beyond the redacted arguments.
- The record still carries runId, command, timing, exit code, and scope.

---

#### TC-GH223-004 - Broken invocations append exactly one record with raw argv tokens

**Scenario Type**: Negative
**Impact Level**: Critical
**Priority**: Critical
**Related IDs**: F-1, AC-F1-1, EVT-1, DM-1, NFR-1
**Test Type(s)**: Integration
**Automation Level**: Automated
**Target Layer / Location**: `tests/behaviour/audit-outcomes.test.ts`
**Tags**: @backend, @audit, @invocation

**Preconditions**:

- Four broken-invocation fixtures: unknown command, unknown flag, flag missing its value, conflicting flags.
- No command handler resolves for any of them.

**Steps**:

1. Run each fixture through `runCli`.
2. Assert `fallback.invocation` and exit code `1`.
3. Read the audit records.
4. Inspect the command/arguments portion of each record.

**Expected Outcome**:

- Each broken invocation appends exactly one record.
- The record preserves the raw argv tokens (the original flags, values, and positionals) and does not invent a resolved command name.
- The record carries the invocation failure's exit code, outcome class, timing, scope, and runId.
- Redaction still applies to the raw tokens (verified separately in TC-GH223-031).

---

#### TC-GH223-005 - Audit record field set, scope/repo, and boundary schema

**Scenario Type**: Happy Path
**Impact Level**: Critical
**Priority**: Critical
**Related IDs**: F-1, F-6, AC-F1-1, EVT-1, DM-1, NFR-1, NFR-9
**Test Type(s)**: Unit, Integration
**Automation Level**: Automated
**Target Layer / Location**: `tests/behaviour/audit-ledger.test.ts` (unit assembly) and `tests/structure/audit-contract.test.ts` (new, declaration shape)
**Tags**: @backend, @audit, @contract, @state

**Preconditions**:

- The delivered audit payload schema identity, field names, and closed vocabularies exposed as runtime-neutral data from the contracts/state surface.
- A store identity with a workspace scope and a synthetic repository target.
- A synthetic command that declares a repository target.

**Steps**:

1. Assemble a record from a normalized invocation fact in a pure unit case; assert the field set against the delivered declaration.
2. Write the record through the artifact boundary in an integration case; assert it is admitted.
3. Read it back and assert every required field is present and exact, including scope and repo.
4. Attempt writes with a missing required field, an undeclared outcome-class value, and a wrong schema identity.

**Expected Outcome**:

- The record carries all contracted fields: runId, command/raw tokens, redacted arguments, exit code, timing, outcome class, scope, repo when targeted, claimed identity when provided, and the chain value.
- Envelope context fields (schemaVersion, runId, exitCode, timing) are retained in the record.
- The artifact boundary refuses the three nonconforming writes as `state.store.unknown` with consequence `not_landed`; nothing lands and no field is defaulted.
- Scope and repo are copied from the injected facts exactly; they are never derived from the host or ambient environment.

---

#### TC-GH223-006 - Identical re-run appends a second record distinguished by runId

**Scenario Type**: Happy Path
**Impact Level**: Critical
**Priority**: Critical
**Related IDs**: F-1, AC-F1-2, EVT-1, NFR-1
**Test Type(s)**: Integration
**Automation Level**: Automated
**Target Layer / Location**: `tests/behaviour/audit-ledger.test.ts`
**Tags**: @backend, @audit, @idempotency

**Preconditions**:

- A temp audit store.
- The same command and argv run twice with distinct run ids (`run-gh223-0101`, `run-gh223-0102`) and distinct clock ticks.

**Steps**:

1. Run the identical invocation twice.
2. Read all audit records.
3. Compare record count, runIds, sequences, and audited content.

**Expected Outcome**:

- Exactly two records exist; neither is deduplicated, updated, or overwritten.
- The records are distinguishable by runId alone; both carry the same command and argv, but distinct runIds, timings, and ledger positions.
- Both records verify; the second record's chain links to the first.

---

#### TC-GH223-007 - Malformed audit entry is classified, preserved, and salvaged without data loss

**Scenario Type**: Edge Case
**Impact Level**: Critical
**Priority**: Critical
**Related IDs**: F-1, F-5, AC-F1-3, NFR-8
**Test Type(s)**: Integration
**Automation Level**: Automated
**Target Layer / Location**: `tests/behaviour/audit-malformed.test.ts` (new); reuse `tests/behaviour/state-salvage.test.ts` patterns
**Tags**: @backend, @audit, @state, @salvage

**Preconditions**:

- A temp store seeded with three valid audit records, then three malformed fixtures: (a) a tail entry with broken framing, (b) a tail entry with a failing checksum, (c) an audit-kind entry whose payload violates the audit boundary's declared schema (missing required field or undeclared outcome-class value) appended through the raw store so the state layer frames it cleanly.
- The torn fixtures are verified to fail before salvage.

**Steps**:

1. Snapshot the ledger bytes and the pre-existing records for each fixture.
2. Perform a verified audit read on fixtures (a) and (b); assert the classified torn failure and its identity.
3. Perform a verified audit read on fixture (c); assert the artifact boundary classifies it as `state.store.unknown` with the record position.
4. Assert the valid prefix's byte digest is unchanged, the pre-salvage torn read returned no values, and no record was deleted or rewritten.
5. Invoke the explicit salvage operation on the torn fixtures on a fenced handle.
6. Read the post-salvage ledger and the quarantined evidence; assert the unknown-payload record is still present as evidence (no delete path).

**Expected Outcome**:

- The malformed entry classifies through an existing state identity: torn for fixtures (a)/(b), `state.store.unknown` at the artifact boundary for fixture (c). Neither is an empty record set or a silent zero. Before salvage the torn read fails; after salvage every pre-existing record is verified-readable and unchanged.
- No pre-existing audit record is lost or altered by classification; the valid prefix's digest is unchanged, and the unknown-payload record remains in the ledger as evidence (no silent drop, no delete path).
- For the torn fixtures, the malformed region is preserved as evidence by the explicit salvage path (quarantine), the quarantined bytes are readable as evidence, and the operation reports the truncation position and extent.
- Retention remains forever; no prune, delete, or compaction path is introduced.

---

#### TC-GH223-008 - Audit records are an additive kind within `delivery.state.v1` and interleave safely

**Scenario Type**: Edge Case
**Impact Level**: Important
**Priority**: High
**Related IDs**: F-1, AC-F1-1, EVT-1, DM-1, NFR-9
**Test Type(s)**: Contract, Integration
**Automation Level**: Automated
**Target Layer / Location**: `tests/structure/audit-contract.test.ts` (new) and `tests/behaviour/audit-ledger.test.ts`
**Tags**: @backend, @audit, @state, @contract

**Preconditions**:

- A store already containing records of another consumer kind (e.g., a phase transition or closeout outcome) under `delivery.state.v1`.
- An audit record kind from the `delivery.audit.*` family.

**Steps**:

1. Open the pre-existing store without migration.
2. Append audit records interleaved with another consumer's records.
3. Read all records and the audit subset.
4. Assert the store schema version is unchanged and the audit kind is additive.

**Expected Outcome**:

- Existing stores open unchanged; no schema bump, migration, backfill, or reinterpretation occurs.
- Audit records are identifiable as their own kind under one store-scoped key; other-kind records are untouched.
- Interleaved records do not corrupt either consumer's read; the audit chain ignores non-audit kinds.
- No new runtime-API location or driver discriminant is introduced (asserted structurally in TC-GH223-034).

---

#### TC-GH223-009 - Generic audit-write fault degrades loudly without changing the command outcome

**Scenario Type**: Negative
**Impact Level**: Critical
**Priority**: Critical
**Related IDs**: F-1, AC-F1-1, NFR-1; DEC-8
**Test Type(s)**: Integration
**Automation Level**: Automated
**Target Layer / Location**: `tests/behaviour/audit-write-failure.test.ts` (new)
**Tags**: @backend, @audit, @state, @degradation

**Preconditions**:

- A temp audit store whose edge is armed with a generic fault at the audit append's pre-commit point (`append-before-flush` proposed; the delivered point name is binding).
- A synthetic success command and a synthetic failure command, each with a known exit code.

**Steps**:

1. Arm the generic append fault.
2. Run a succeeding command and a failing command with `--json`.
3. Assert the returned exit code, stdout machine line, and stderr diagnostics.
4. Disarm and assert the edge recorded the intended point as raised.
5. Read the audit records.

**Expected Outcome**:

- Both commands keep their own outcome and exit code: success stays `0` and its `data` line is emitted; failure stays its classified code and its `error` line is emitted.
- The audit failure is loud on the diagnostics stream with an existing state identity (`state.write.failed` for a generic write fault), never a silent drop.
- No audit record lands and no partial record is observable.
- The fault point assertion proves the degradation came from the injected append failure, not from an unrelated path.

---

#### TC-GH223-010 - Fence-busy and exhaustion audit-write failures leave the outcome unchanged with no partial record

**Scenario Type**: Negative
**Impact Level**: Critical
**Priority**: Critical
**Related IDs**: F-1, AC-F1-1, NFR-1; DEC-8
**Test Type(s)**: Integration
**Automation Level**: Automated
**Target Layer / Location**: `tests/behaviour/audit-write-failure.test.ts`
**Tags**: @backend, @audit, @state, @degradation, @fault-injection

**Preconditions**:

- Two fault fixtures: (a) a fence held by another token so the audit append cannot acquire its fence (`state.lock.busy`); (b) the edge armed with `armExhaustion(["append-before-flush"])` so the append raises the distinguishable exhaustion failure (`state.storage.exhausted`).
- A synthetic success command with a known exit code.

**Steps**:

1. In fixture (a), hold the fence, run the command, assert the outcome and diagnostics, then release.
2. In fixture (b), arm exhaustion, run the same command, assert the outcome and diagnostics, then disarm.
3. Snapshot the ledger before and after each attempt.
4. Read verified records after each attempt.

**Expected Outcome**:

- In both cases the command still succeeds with exit code `0` and its normal `data` line; the audit failure never changes the command's outcome.
- The diagnostics carry the classified state identity (`state.lock.busy`, `state.storage.exhausted`) loudly, with no payload or checksum bytes.
- The ledger is byte-identical before and after the failed append; no partial frame exists.
- Exactly-once holds only for invocations whose audit write succeeds; the degraded path is explicitly recorded as zero records, not as a fabricated record.

**Notes / Clarifications**:

- The "omission detectable as a sequence discontinuity on the next verified read" claim (DEC-8) has no specified detection mechanism; TC-GH223-010 asserts the testable half (outcome unchanged, loud classification, no partial record). See OQ-T6.

---

#### TC-GH223-011 - Identity present is recorded verbatim as claimed attribution

**Scenario Type**: Happy Path
**Impact Level**: Important
**Priority**: High
**Related IDs**: F-2, AC-F2-1, DM-3, NFR-5
**Test Type(s)**: Integration
**Automation Level**: Automated
**Target Layer / Location**: `tests/behaviour/audit-identity.test.ts` (new)
**Tags**: @backend, @audit, @identity

**Preconditions**:

- An injected environment record carrying the seam-named identity variable with value `pm-lane-7` (role + lane shape).
- A second case with a value containing punctuation, mixed case, and Unicode to prove verbatim capture rather than normalization.
- A synthetic success command, run once with the identity and once without it for comparison.

**Steps**:

1. Run the command with the identity-bearing environment injected through the edge.
2. Read the audit record.
3. Compare the recorded identity with the injected value exactly.
4. Inspect the record for verified/authenticated markers or any value derived from user, host, or session.
5. Run the same command without the identity and assert the outcome, exit code, and scope are unchanged.

**Expected Outcome**:

- The record carries the exact injected value, byte-for-byte; no trimming, casing, or slugging occurs.
- The identity is presented under the delivered claimed-attribution field/vocabulary (a claimed marker if one is delivered; otherwise the audit identity field with no verification marker). No `verified`, `authenticated`, or provenance-upgraded marker is present.
- Identity does not alter the command outcome, exit code, or scope; the with-identity and without-identity runs match on those facts.
- The record still verifies within the chain.

**Notes / Clarifications**:

- The spec requires the record to show identity "as attribution only" but does not pin a machine-readable marker. The assertion is verbatim capture plus absence of verification markers; the marker vocabulary is confirmed at delivery (OQ-T7).

---

#### TC-GH223-012 - Identity absent or empty is never inferred

**Scenario Type**: Edge Case
**Impact Level**: Important
**Priority**: High
**Related IDs**: F-2, AC-F2-2, DM-3, NFR-5
**Test Type(s)**: Integration
**Automation Level**: Automated
**Target Layer / Location**: `tests/behaviour/audit-identity.test.ts`
**Tags**: @backend, @audit, @identity, @privacy

**Preconditions**:

- Two environments: (a) identity variable absent; (b) identity variable present but an empty string.
- An injected user/home/host/session fact set that would make inference possible if the implementation tried (`USER=operator`, hostname, `SESSION_ID`, `PWD`).

**Steps**:

1. Run the command under each environment.
2. Read each audit record.
3. Assert no identity field is present and no identity-like value appears anywhere in the record.
4. Compare the three records' non-identity fields to confirm the rest of the record is unaffected.

**Expected Outcome**:

- Absent and empty values produce records with no identity and no inference from user, host, session, working directory, or any other signal.
- The rest of the record (runId, command, arguments, exit code, timing, outcome class, scope/repo, chain) is complete and identical in shape across the two cases.

**Notes / Clarifications**:

- A whitespace-only value is non-empty as written, so the spec's "present and non-empty" rule does not say to treat it as absent. Its verbatim-capture semantics are unspecified; this case does not assert them (OQ-T10).

---

#### TC-GH223-013 - Identity variable is seam-named and read as injected edge data

**Scenario Type**: Contract
**Impact Level**: Important
**Priority**: High
**Related IDs**: F-2, AC-F2-1, NFR-5, NFR-9; DEC-3
**Test Type(s)**: Contract, Structure, Check
**Automation Level**: Automated
**Target Layer / Location**: `tests/structure/audit-contract.test.ts` (new); `tests/structure/cli-edge-seam.test.ts` (existing — update); `tests/checks/forbidden-literals.test.ts` (existing — guard)
**Tags**: @backend, @audit, @branding, @structure

**Preconditions**:

- The branding seam's derived `environmentPrefix` for the synthetic brand.
- The delivered identity-variable suffix constant exported from the audit/contracts surface.

**Steps**:

1. Assert the identity variable name equals `environmentPrefix` plus the declared suffix; no product token is hardcoded.
2. Assert the CLI and state source trees contain no ambient `process.env`/`Bun.env` read; the identity arrives through the injected environment record at the edge.
3. Assert the state tier does not import branding (naming is resolved at the edge, not in the store).
4. Run the forbidden-literal scan over the changed source and fixtures.

**Expected Outcome**:

- The variable name is derived, not literal; changing the brand prefix changes the variable name.
- No ambient environment read exists in `packages/cli/src` or `packages/core/src/state`; the temp-copy mutation controls in the existing seam test still fail by file and line.
- The identity value is passed as data into the audit write path; no ambient probe occurs inside the surface or state tier.
- The forbidden-literal scan is clean; no new registered user-facing docs are introduced (NG-7).

---

#### TC-GH223-014 - Scripted success renders one minified `{"data":...}` line without trimmed context

**Scenario Type**: Happy Path
**Impact Level**: Critical
**Priority**: Critical
**Related IDs**: F-3, F-1, AC-F3-1, NFR-6, DM-4
**Test Type(s)**: Integration, Golden
**Automation Level**: Automated
**Target Layer / Location**: `tests/behaviour/scripted-trim.test.ts` (new); `tests/golden/envelope-scripted.test.ts` (new)
**Tags**: @backend, @cli, @output, @golden

**Preconditions**:

- A scripted (non-interactive) stream-capability fact injected at the edge.
- A success command with data `{ message: "all good", count: 2 }` and a golden case `scripted-success-data`.
- An audit store available to the run.

**Steps**:

1. Run the command with `--json` under the scripted mode fact.
2. Assert stdout is exactly one line ending in a newline.
3. Parse the line and assert its key set is exactly `data`.
4. Assert the line contains none of `schemaVersion`, `runId`, `exitCode`, or `timing`, and no pretty indentation.
5. Assert the process exit code is `0` and the audit record retains all four trimmed context fields.

**Expected Outcome**:

- Stdout is one minified `{"data":{...}}` line, byte-identical to the golden.
- The key set is exactly `data`; the trimmed tokens are absent, and the line has no newline inside it.
- Status is carried by the process exit code, not the line.
- The audit record for the same run carries the trimmed fields (schemaVersion, runId, timing, exit code) and the invocation facts; the result `data` payload is not required in the record, and the runId correlates the line to the record.
- The no-spawn guard records zero violations.

---

#### TC-GH223-015 - Scripted void success renders `{"data":{}}` exactly

**Scenario Type**: Edge Case
**Impact Level**: Important
**Priority**: High
**Related IDs**: F-3, AC-F3-1, NFR-6
**Test Type(s)**: Integration, Golden
**Automation Level**: Automated
**Target Layer / Location**: `tests/behaviour/scripted-trim.test.ts`; `tests/golden/envelope-scripted.test.ts`
**Tags**: @backend, @cli, @output, @golden

**Preconditions**:

- A void-success command returning the explicit empty payload.
- Scripted mode fact and the `scripted-success-void` golden.

**Steps**:

1. Run the void command with `--json` in scripted mode.
2. Assert stdout equals the golden and is exactly one line.
3. Assert the parsed payload is an empty object, not `null` or an absent `data`.

**Expected Outcome**:

- Stdout is exactly `{"data":{}}` plus the single trailing newline.
- No context token or diagnostic appears on the machine channel.
- The audit record carries outcome class `success` and exit code `0` for the void run; the machine line's empty `data` object is the trim's explicit void form.

---

#### TC-GH223-016 - Scripted classified failure renders one minified `{"error":...}` line with runId and full error fields

**Scenario Type**: Negative
**Impact Level**: Critical
**Priority**: Critical
**Related IDs**: F-3, F-1, AC-F3-2, NFR-6
**Test Type(s)**: Integration, Golden
**Automation Level**: Automated
**Target Layer / Location**: `tests/behaviour/scripted-trim.test.ts`; `tests/golden/envelope-scripted.test.ts`; `tests/golden/envelope-failure.test.ts` (existing — keep interactive cases; scripted cases live in the scripted suite)
**Tags**: @backend, @cli, @output, @error-contract

**Preconditions**:

- Classified user and platform failure programs.
- Scripted mode fact and goldens `scripted-classified-user`, `scripted-classified-platform`.

**Steps**:

1. Run each failure with `--json` in scripted mode.
2. Assert stdout is exactly one line and parses as an object whose key set is exactly `error`.
3. Assert the error object contains `code`, `category`, `retryable`, `consequence`, and `remediationHint`; assert the single line carries `runId` (inside the error object per the AC reading, or alongside it if delivery pins that shape).
4. Assert the line contains no `schemaVersion`, `exitCode`, or `timing`.
5. Compare the error fields with the error-table entry and assert the run's exit code matches the projection.

**Expected Outcome**:

- One minified `{"error":{...}}` line per invocation, byte-identical to its golden.
- Full error-table fields are preserved and the `runId` correlation key is present.
- The trimmed context fields are absent from the line and retained in the audit record.
- The exit code remains the machine-readable status projection.

**Notes / Clarifications**:

- AC-F3-2 reads runId as carried by the error object; the spec's assumption (§12) leaves open "within or alongside". The test accepts the delivered placement but requires the runId to be present in the single line (OQ-T1).

---

#### TC-GH223-017 - Scripted unknown and broken-invocation failures follow the same projection

**Scenario Type**: Negative
**Impact Level**: Important
**Priority**: High
**Related IDs**: F-3, AC-F3-2, NFR-6
**Test Type(s)**: Integration, Golden
**Automation Level**: Automated
**Target Layer / Location**: `tests/behaviour/scripted-trim.test.ts`; `tests/golden/envelope-scripted.test.ts`; `tests/golden/broken-command.test.ts` (existing — keep interactive cases; scripted cases live in the scripted suite)
**Tags**: @backend, @cli, @output, @invocation

**Preconditions**:

- An unknown-failure descriptor and the four broken-invocation fixtures.
- Scripted mode fact and goldens `scripted-unknown-failure`, `scripted-broken-unknown-command`, `scripted-broken-unknown-flag`, `scripted-broken-missing-value`, `scripted-broken-conflicting-flags`.

**Steps**:

1. Run each fixture with `--json` in scripted mode.
2. Assert one line, exact `error` key set, full error fields, and runId present in the single line.
3. Assert no stack marker, absolute path, or raw diagnostic appears on stdout.
4. Assert each run's audit record exists and retains the trimmed context.

**Expected Outcome**:

- Unknown and broken-invocation failures use the same scripted projection as classified failures; there is no full-envelope escape for hard failures.
- Containment holds: no stack, path, or raw thrown value leaks onto the machine channel.
- Every run is audited exactly once.

---

#### TC-GH223-018 - Interactive mode keeps the full M0-S3 envelope byte-for-byte

**Scenario Type**: Regression
**Impact Level**: Critical
**Priority**: Critical
**Related IDs**: F-3, AC-F3-3, NFR-6, DM-4
**Test Type(s)**: Integration, Golden
**Automation Level**: Automated
**Target Layer / Location**: `tests/behaviour/envelope-mode.test.ts` (new); `tests/golden/envelope-success.test.ts`, `tests/golden/envelope-failure.test.ts`, `tests/golden/broken-command.test.ts` (existing — mode metadata, interactive goldens remain authoritative)
**Tags**: @backend, @cli, @output, @golden, @regression

**Preconditions**:

- The existing M0-S3 goldens for success-data, success-void, classified-user, classified-platform, unknown-failure, and the broken-invocation cases, marked interactive.
- An interactive stream-capability fact.

**Steps**:

1. Run each existing case under the interactive fact.
2. Assert stdout byte equality with the existing golden (all five keys, pretty indentation, trailing newline).
3. Assert `assertEnvelopeContract(JSON.parse(stdout))` returns no violations.
4. Assert the audit record still exists for each run and retains the same context.

**Expected Outcome**:

- Interactive output is unchanged: the full M0-S3 envelope with exactly the contracted key set and formatting.
- Extra or missing keys remain contract violations; no scripted rule is applied to interactive output.
- Auditing does not perturb the interactive bytes.

---

#### TC-GH223-019 - `--verbose` forces the full envelope; `--pretty` affects indentation only; stream line discipline

**Scenario Type**: Edge Case
**Impact Level**: Important
**Priority**: High
**Related IDs**: F-3, AC-F3-3, NFR-6
**Test Type(s)**: Integration
**Automation Level**: Automated
**Target Layer / Location**: `tests/behaviour/envelope-mode.test.ts`
**Tags**: @backend, @cli, @output, @flags

**Preconditions**:

- A success command and a failure command.
- Scripted and interactive mode facts.
- Flag fixtures: `--json` alone, `--json --verbose`, `--json --pretty`, `--json --verbose --pretty`, and a text-mode run with `--pretty`.

**Steps**:

1. In scripted mode, run `--json --verbose` and assert the full five-key envelope appears.
2. In interactive mode, run `--json --verbose` and assert the same full envelope (no divergence).
3. In scripted mode, run `--json --pretty` and assert the line stays a single minified `data`/`error` line; indentation is not re-expanded.
4. Run `--json --verbose --pretty` and assert the full envelope is pretty-indented.
5. Run text mode with `--pretty` and assert non-`--json` behaviour is unchanged.
6. For each trimmed scripted output, assert exactly one line; for each full-envelope output, assert one complete contracted JSON document (pretty-indented where applicable) with a single trailing newline.
7. Iterate the registered command program and assert the override and pretty flags are accepted for every command (or consumed globally before command parsing); no command rejects them as unknown.

**Expected Outcome**:

- `--verbose` restores the full envelope in both modes, including the trimmed tokens.
- `--pretty` never re-expands a trimmed scripted line; it only affects indentation where the full envelope is already selected.
- Text output is untouched.
- The override and pretty flags remain available in every command's flag surface; no command rejects them as unknown (§22).
- The trim is applied only to the machine channel; diagnostics stay on stderr.

---

#### TC-GH223-020 - Golden suites cover both modes with no case without a golden and no skip path

**Scenario Type**: Contract
**Impact Level**: Critical
**Priority**: Critical
**Related IDs**: F-3, AC-F3-4, NFR-6, DM-4
**Test Type(s)**: Golden, Structure
**Automation Level**: Automated
**Target Layer / Location**: `tests/golden/envelope-scripted.test.ts` (new); `tests/structure/result-fixtures.test.ts` (existing — update for mode metadata); `tests/structure/result-contract.test.ts` (existing — discovery)
**Tags**: @golden, @contract, @structure

**Preconditions**:

- Every golden case directory contains `argv.json`, `injected.json`, `meta.json`, and a `stdout.json` (plus optional `stderr.txt`).
- `injected.json` carries the mode fact; `meta.json` records mode and outcome class.

**Steps**:

1. Discover all cases with `loadGoldenCases`.
2. Assert every case declares a supported mode and outcome class.
3. Assert both interactive and scripted cases exist, with scripted coverage for success, void success, classified user, classified platform, unknown failure, and each broken-invocation class.
4. Assert no case lacks a golden file; assert the discovery function throws rather than skipping when a golden is missing (mutation control: a temp copy with `stdout.json` removed).
5. Assert no auto-accept or update path exists.

**Expected Outcome**:

- Both modes are represented and every case keeps a required golden.
- A missing golden fails discovery loudly; no case is skipped or silently regenerated.
- The fixture metadata is internally consistent (mode, outcome, secrets flag).
- The existing no-product-token, no-timestamp, and synthetic-brand hygiene checks still pass.

---

#### TC-GH223-021 - Conformance validator enforces scripted-projection rules with negative controls

**Scenario Type**: Contract
**Impact Level**: Important
**Priority**: High
**Related IDs**: F-3, AC-F3-4, NFR-6
**Test Type(s)**: Unit, Structure
**Automation Level**: Automated
**Target Layer / Location**: `tests/structure/scripted-projection.test.ts` (new); `packages/testkit/src/result-conformance.ts` (extend)
**Tags**: @testkit, @contract, @structure, @output

**Preconditions**:

- The existing `assertEnvelopeContract` interactive rules remain unchanged.
- New scripted-projection rules: exactly one line, exact success/failure key set, success has only `data`, failure has only `error`, error keeps full fields plus runId, trimmed tokens absent.

**Steps**:

1. Validate a conforming scripted success line and a conforming scripted failure line: zero violations.
2. Feed negative controls: two lines, pretty-indented JSON, success with `schemaVersion`/`runId`/`timing`/`exitCode`, failure without runId, failure with a missing error field, `data` and `error` together, an empty line.
3. Assert each control produces the expected rule id and field.
4. Assert every declared rule has at least one failing control (rule-to-control bijection), mirroring the existing interactive rule discipline.

**Expected Outcome**:

- Scripted conformance is enforced by named rules, not by ad hoc assertions in golden tests.
- Every rule is non-vacuous: a deliberately bad line fails with a specific rule id.
- Interactive rules still pass their existing bijection test; the two rule sets do not suppress each other.

---

#### TC-GH223-022 - SC-M1-23: scripted invocation is audited and trimmed end-to-end

**Scenario Type**: Happy Path
**Impact Level**: Critical
**Priority**: Critical
**Related IDs**: F-1, F-2, F-3, F-6, AC-F1-1, AC-F1-2, AC-F2-1, AC-F2-2, AC-F3-1, AC-F3-2, AC-F6-1, NFR-1, NFR-2, NFR-5, NFR-6; SC-M1-23
**Test Type(s)**: Integration
**Automation Level**: Automated
**Target Layer / Location**: `tests/behaviour/audit-scenario-m1-23.test.ts` (new); `tests/fixtures/result/programs/lanes-list.json` (new stand-in program)
**Tags**: @backend, @audit, @cli, @seeded-scenario, @end-to-end

**Preconditions**:

- A stand-in command program `lanes list --json` (the real `lanes` command ships in a later M1 story; the program stands in for it, per the GH-222 stand-in precedent).
- A declared lane shell environment carrying the seam-named identity variable with a role+lane value (e.g., `pm-lane-7`) and no chaining key.
- A temp audit store, scripted mode fact, injected clock/run-id, and a planted registered secret passed as an argument value.

**Steps**:

1. Run `lanes list --json` through the in-process surface with the lane environment.
2. Assert stdout is one minified `{"data":...}` line without schemaVersion, runId, or timing, and the exit code is `0`.
3. Read the audit records; assert exactly one, with runId, command, redacted args, exit, timing, and identity.
4. Re-run the identical invocation with a new run id; assert a second record with a new runId.
5. Run a failing variant and assert the error line keeps runId and full error fields.
6. Run a variant without the identity variable and assert the record carries no identity and no inference.
7. Search every record and the machine output for the planted registered secret values.

**Expected Outcome**:

- Exactly one audit record per invocation; the trimmed fields live only in the record.
- Identity is captured verbatim when present and absent-never-inferred when the variable is missing.
- Re-run yields a second record with a new runId; no deduplication.
- Failure lines keep runId as the correlation key.
- No planted registered secret appears in any record field or on the machine channel.
- The case reads as the seeded scenario's Given/When/Then and cites SC-M1-23 in its describe/title text.

---

#### TC-GH223-023 - Clean chain verifies; interleaved non-audit kinds neither break nor participate

**Scenario Type**: Happy Path
**Impact Level**: Critical
**Priority**: Critical
**Related IDs**: F-4, AC-F4-1, DM-2, NFR-3
**Test Type(s)**: Unit, Integration
**Automation Level**: Automated
**Target Layer / Location**: `tests/behaviour/audit-chain.test.ts` (new)
**Tags**: @backend, @audit, @chain, @state

**Preconditions**:

- A deterministic injected chaining key fixture (`planted-fake-chain-key-0001`).
- A temp store with audit records interleaved with records of another kind.
- A pure in-memory sequence fixture for the unit half.

**Steps**:

1. Append five audit records with other-kind records between them.
2. Verify the chain; assert a verified verdict with the record count and no breaks.
3. Recompute expected links with the independent oracle defined for the algorithm pinned at delivery (or, if the algorithm stays behind an opaque helper, assert the behavioural properties: determinism, key sensitivity, previous-link sensitivity, and content sensitivity).
4. Repeat with a fresh store whose first record is an audit record, and with a store that already has other-kind records; assert the first audit record anchors correctly in both.
5. Append a sixth audit record after the interleaved tail; assert it chains from the fifth audit record, not from the intervening kind.

**Expected Outcome**:

- The clean chain verifies with zero breaks over the audit-record subsequence in ledger order.
- Interleaved non-audit kinds neither break nor participate; their content is not covered by the audit chain.
- The first audit record anchors the chain on any store, including a store with pre-existing other-kind records.
- Verification is deterministic and repeatable; no wall clock or ambient value participates.

---

#### TC-GH223-024 - Altered record with recomputed unkeyed checksum is flagged with position

**Scenario Type**: Negative
**Impact Level**: Critical
**Priority**: Critical
**Related IDs**: F-4, AC-F4-1, DM-2, NFR-3
**Test Type(s)**: Integration
**Automation Level**: Automated
**Target Layer / Location**: `tests/behaviour/audit-chain.test.ts`
**Tags**: @backend, @audit, @chain, @tamper

**Preconditions**:

- A verified clean audit ledger.
- A mutation helper that edits an audit record's audited content (for example the command arguments), recomputes the state layer's unkeyed checksum so the store still reads as framing/checksum-clean, and leaves the chain value unchanged.

**Steps**:

1. Verify the clean ledger: zero breaks.
2. Apply the mutation at a known audit position (not the first).
3. Verify again.
4. Inspect the break evidence.
5. Assert records before the break remain verified-readable.

**Expected Outcome**:

- The mutation is flagged as a chain break naming the record position; the unkeyed checksum being recomputed does not produce a false "verified" verdict.
- Evidence names the position only — never payload content or checksum bytes.
- Records before the break remain verified-readable; no data loss is introduced by verification.
- The wording/report expresses "cannot alter undetectably", not "cannot alter".

---

#### TC-GH223-025 - Mutation matrix: every alteration is flagged; no false verified verdicts

**Scenario Type**: Negative
**Impact Level**: Critical
**Priority**: Critical
**Related IDs**: F-4, AC-F4-1, DM-2, NFR-3
**Test Type(s)**: Integration
**Automation Level**: Automated
**Target Layer / Location**: `tests/behaviour/audit-chain-mutations.test.ts` (new); `tests/fixtures/audit/mutations.json` (new declarative matrix)
**Tags**: @backend, @audit, @chain, @mutation

**Preconditions**:

- A clean five-record audit ledger and a declarative mutation matrix: payload edit with recomputed checksum; chain-value edit; record deletion; record reordering; record duplication with a new sequence; splicing a record from another store; changing the previous connection; corrupting a field without recomputing the checksum (state-layer torn, expected as a different identity).

**Steps**:

1. For each mutation, start from a fresh copy of the clean ledger.
2. Apply the mutation, verify the state layer's read, then verify the audit chain.
3. Record whether the outcome is verified, a chain break with position, or a state-level classification.
4. Run the clean control last and assert it still verifies.

**Expected Outcome**:

- Every content/chain mutation is flagged: either as a chain break naming the position or, for a state-layer framing/checksum break, as the existing torn identity. No mutation yields a false "verified" verdict.
- The clean control verifies, proving the matrix is not vacuously failing.
- Each mutation's expected class is declared in the fixture, so a silent change in behaviour fails loudly.
- Evidence hygiene holds for every failure path.

**Notes / Clarifications**:

- A mutation that corrupts a record without recomputing the unkeyed checksum is expected to be caught by the state layer as the existing torn identity before chain verification. That is defense in depth, not a false "verified" verdict. NFR-3's "flagged as chain breaks" wording is read as "detected", with the chain break specifically required for the recomputed-checksum and chain-forgery classes that the state layer cannot see (AC-F4-1).

---

#### TC-GH223-026 - Chaining key never enters lane environment, ledger bytes, or records

**Scenario Type**: Negative
**Impact Level**: Critical
**Priority**: Critical
**Related IDs**: F-4, AC-F4-2, DM-2, NFR-4; RSK-3
**Test Type(s)**: Integration, Check
**Automation Level**: Automated
**Target Layer / Location**: `tests/behaviour/audit-key-exclusion.test.ts` (new); `tests/fixtures/audit/lane-environment.json` (new)
**Tags**: @backend, @audit, @chain, @security, @key-exclusion

**Preconditions**:

- A declared lane environment fixture carrying only its declared variables (including the identity variable) and explicitly not the chaining key.
- An injected chaining key with a distinctive planted value.
- A temp store populated with audit records.

**Steps**:

1. Inspect the lane environment fixture and assert the key's name and value are absent.
2. Read the raw ledger bytes and assert the key's value (and its obvious encodings) does not appear.
3. Walk every audit record's JSON and assert no field equals or contains the key value.
4. Assert the rendered/reported surfaces produced by this story (diagnostics, evidence, read views) contain no key value.
5. Assert the key is only present in the injected edge/deps fact, not in a serialized record.

**Expected Outcome**:

- The chaining key appears nowhere in the lane environment, ledger bytes, any record field, or any lane-visible surface rendered by this story.
- Verification succeeds using the injected key, proving the key was actually used rather than absent.
- Two negative controls: planting the key value in a temp copy of a record is detected by the exclusion search (proving the search is non-vacuous); replacing the key with a different key makes verification fail (proving key sensitivity).

---

#### TC-GH223-027 - Salvage and terminal-tail repair keep chain continuity; reported removals are not breaks

**Scenario Type**: Corner Case
**Impact Level**: Critical
**Priority**: Critical
**Related IDs**: F-4, AC-F4-3, NFR-3, NFR-8; DEC-4; RSK-2
**Test Type(s)**: Integration
**Automation Level**: Automated
**Target Layer / Location**: `tests/behaviour/audit-chain-salvage.test.ts` (new)
**Tags**: @backend, @audit, @chain, @salvage, @repair

**Preconditions**:

- Two fixtures derived from the same clean audit ledger: (a) a terminal-tail tear after an audit record, repaired with `repairTornTail`; (b) a terminal-tail tear salvaged with the explicit `salvage` operation.
- The operations' own evidence reports the removal (position/extent).

**Steps**:

1. Verify the clean prefix chain before the tear.
2. Apply repair in fixture (a); read the evidence and verify the chain.
3. Apply salvage in fixture (b); read the evidence and verify the chain.
4. Assert the reported removal is not a chain break and the surviving audit sequence verifies continuously.
5. Append a new audit record after each operation and verify it chains from the last surviving audit record.
6. Assert a genuinely altered surviving record still breaks (control).

**Expected Outcome**:

- Both operations report their removal in their own evidence; chain verification treats the removal as expected, not as tampering.
- The surviving audit sequence verifies continuously; no re-anchoring failure arises.
- The next audit record chains from the last surviving audit record.
- The alteration control still breaks, proving the continuity path does not suppress real breaks.
- Retention/evidence discipline holds: no payload or checksum bytes in break or salvage evidence.

---

#### TC-GH223-028 - Bounded filtered reads return verified matches and report truncation in-band

**Scenario Type**: Happy Path
**Impact Level**: Important
**Priority**: High
**Related IDs**: F-5, AC-F5-1, NFR-7
**Test Type(s)**: Integration
**Automation Level**: Automated
**Target Layer / Location**: `tests/behaviour/audit-read.test.ts` (new)
**Tags**: @backend, @audit, @read-surface, @bounds

**Preconditions**:

- A temp audit store with at least ten audit records spanning several commands and all three outcome classes, plus interleaved non-audit records.
- A read-surface fixture declaring filters and a bound.

**Steps**:

1. Query by the store's recorded scope (match) and by a deliberately different scope (no match); assert only matching audit records return, all verified.
2. Query by command and by outcome class; assert exact match sets and no non-audit records.
3. Query with a bound smaller than the match count; assert the result is clipped to the bound and reports truncation in-band with the returned count and an indication that more matches exist.
4. Query with a bound larger than the match count; assert no truncation flag.
5. Snapshot the ledger and store directory before and after each query; assert no fence was acquired and nothing was written.

**Expected Outcome**:

- Results contain verified records only, matching every declared filter; non-audit kinds and non-matching records never leak in.
- Truncation is reported in-band whenever the bound clips; it is never silently applied.
- Reads acquire no fence, write nothing, and leave the ledger and directory byte-identical.
- The returned evidence names counts and positions only.

**Notes / Clarifications**:

- The time-window filter is not asserted because no timestamp field exists in the specified record set (OQ-T5). The scope filter is exercised with a matching and a deliberately non-matching scope; whether the surface is store-scoped or multi-store is pinned at delivery (OQ-T11). The store's derived index is current before each query, so "writes nothing" is asserted against a no-rebuild read; a rebuild-on-read is a deviation (TR-12). Once the spec pins a timestamp, add a time-window case here and update AC-F5-1's status.

---

#### TC-GH223-029 - No unbounded dump path exists through the read surface

**Scenario Type**: Negative
**Impact Level**: Critical
**Priority**: Critical
**Related IDs**: F-5, AC-F5-1, NFR-7; DEC-6
**Test Type(s)**: Structure
**Automation Level**: Automated
**Target Layer / Location**: `tests/structure/audit-surface.test.ts` (new)
**Tags**: @structure, @audit, @read-surface, @bounds

**Preconditions**:

- The exported read-surface type declarations and module entry points.

**Steps**:

1. Parse the read-surface module and assert the bound is a required field (no optional bound, no default that means "all").
2. Assert there is no exported function named or shaped as `readAll`, `dump`, `exportAll`, or an equivalent that returns the full ledger without a bound.
3. Assert the only way to obtain audit history is through the bounded query function(s).
4. Assert the module exposes no CLI command registration (covered further in TC-GH223-034).
5. Mutation control: a temp copy adding an unbounded `readAll` export must fail the check.

**Expected Outcome**:

- A bound is mandatory at the type and runtime surface; there is no code path that returns the full ledger.
- No unbounded dump export exists; the mutation control proves the detector fires.
- The read surface remains library-only; no command is registered.

---

#### TC-GH223-030 - Read surface classifies torn/unknown without silent zeros and writes nothing

**Scenario Type**: Negative
**Impact Level**: Critical
**Priority**: Critical
**Related IDs**: F-5, AC-F5-1, NFR-7
**Test Type(s)**: Integration
**Automation Level**: Automated
**Target Layer / Location**: `tests/behaviour/audit-read.test.ts`
**Tags**: @backend, @audit, @read-surface, @classification

**Preconditions**:

- A torn ledger fixture (broken framing beyond the valid prefix).
- An unknown-payload fixture: an audit-kind record whose payload violates the delivered audit schema declaration.
- A verified-empty store.

**Steps**:

1. Query each fixture through the read surface.
2. Assert the failure identity and evidence for torn and unknown.
3. Assert no empty list, zero count, or defaulted value is returned as a success.
4. Read the verified-empty store and assert an explicit verified-empty verdict, distinct from torn and unknown.
5. Snapshot ledger bytes before and after each read.

**Expected Outcome**:

- Torn and unknown conditions are classified with the existing state identities, store path, and position; no silent zeros.
- Verified-empty is distinct from both and is explicitly marked.
- Reads write nothing and never trigger repair or salvage.
- Evidence carries paths/positions/counts only.

---

#### TC-GH223-031 - Planted secrets in arguments never reach any audit record field

**Scenario Type**: Negative
**Impact Level**: Critical
**Priority**: Critical
**Related IDs**: F-6, F-1, AC-F6-1, NFR-2
**Test Type(s)**: Integration
**Automation Level**: Automated
**Target Layer / Location**: `tests/behaviour/audit-redaction.test.ts` (new); `tests/golden/redaction.test.ts` (existing — extend scripted mode)
**Tags**: @backend, @audit, @redaction, @security, @privacy

**Preconditions**:

- Two planted registered secrets (obviously fake tokens), one passed as an argument value and one embedded inside a longer argument string.
- A command program that succeeds, one that fails classified, and one broken-invocation fixture, each carrying a secret in argv.
- An unregistered canary value that looks secret-shaped but is not registered, used to prove the guarantee's boundary.
- Secrets registered at the edge through the existing secret registration seam.

**Steps**:

1. Run each fixture.
2. Read every audit record and serialize each record's JSON.
3. Search for each planted secret value and for obvious encodings.
4. Assert the arguments are present with `[redacted]` substitutions where the registered secrets occurred, and that the unregistered canary remains verbatim (the guarantee is scoped to registered values).
5. Assert the machine output and diagnostics are also secret-free.

**Expected Outcome**:

- No planted secret value appears in any field of any audit record, on success, failure, or broken invocation.
- Arguments reach the ledger only through the redaction chokepoint; the redaction marker is present where secrets occurred.
- Unregistered values are not claimed as redacted (the guarantee stays scoped to registered secrets).
- The machine channel and diagnostics remain secret-free.

---

#### TC-GH223-032 - Record content passes the single redaction chokepoint; no secondary serialization path

**Scenario Type**: Negative
**Impact Level**: Critical
**Priority**: Critical
**Related IDs**: F-6, AC-F6-1, NFR-2; §21
**Test Type(s)**: Integration, Structure
**Automation Level**: Automated
**Target Layer / Location**: `tests/behaviour/audit-redaction.test.ts`; `tests/structure/audit-imports.test.ts` (new)
**Tags**: @backend, @audit, @redaction, @structure, @security

**Preconditions**:

- The delivered audit write path and the existing `packages/cli/src/output/serialize.ts` chokepoint.
- An identity value that is itself a registered secret (an edge case proving all record fields are redacted, not only arguments).

**Steps**:

1. Assert structurally that audit record content is passed through the same redaction function before persistence; no second sanitizer or raw serializer writes record payloads.
2. Run a command whose identity value and one argument are registered secrets.
3. Read the record and assert both are redacted.
4. Assert the chokepoint remains the only stream-write site and the only record-content sanitizer; mutation control adds a second raw writer and fails.

**Expected Outcome**:

- Record content is redacted by the single chokepoint; identity and arguments are both covered.
- No secondary serialization/redaction path is introduced for audit writes.
- The existing single-write-site invariant still holds.
- Mutation control proves the structural guard is non-vacuous.

---

#### TC-GH223-033 - No new error-table rows; sync passes; chain breaks are evidence not codes

**Scenario Type**: Contract
**Impact Level**: Important
**Priority**: High
**Related IDs**: F-4, AC-F4-1, NFR-9; DEC-7, OQ-2
**Test Type(s)**: Contract, Check
**Automation Level**: Automated
**Target Layer / Location**: `tests/checks/error-table-sync.test.ts` (existing — no change expected); `tests/structure/error-table.test.ts` (existing — no change expected); `tests/behaviour/audit-chain.test.ts` (verdict shape)
**Tags**: @contract, @error-table, @audit, @chain

**Preconditions**:

- The machine and documented error tables at the change base.
- The audit chain verification verdict type.

**Steps**:

1. Run the bidirectional error-table sync check and assert zero drift.
2. Assert the error table contains no audit- or chain-domain identities and no audit-specific rows; audit failures resolve only to the existing state identities.
3. Assert every audit/state failure raised by the audit path uses an existing identity (`state.store.torn`, `state.store.unknown`, `state.lock.busy`, `state.storage.exhausted`, `state.write.failed`, `state.permission.denied`).
4. Assert a chain break is surfaced as a verification verdict/evidence with remediation guidance, not as an `AppErrorCode` table lookup.
5. Mutation control: drop or add a row in a temp copy and assert the sync check fails.

**Expected Outcome**:

- The tables remain in bidirectional sync with zero drift; no audit- or chain-domain identities are introduced.
- Chain breaks and record gaps are not error-table identities; they are read-surface verdicts/evidence.
- Every audit-path failure reuses an existing state identity.
- The mutation control proves the sync check is non-vacuous for the touched surface.

---

#### TC-GH223-034 - Tier and boundary conformance; audit read is library-only

**Scenario Type**: Contract
**Impact Level**: Important
**Priority**: High
**Related IDs**: F-5, AC-F5-1, NFR-9, DM-1; DEC-5, DEC-6; NG-3
**Test Type(s)**: Structure, Boundary
**Automation Level**: Automated
**Target Layer / Location**: `tests/structure/audit-contract.test.ts` (new), `tests/structure/audit-imports.test.ts` (new), `tests/structure/audit-surface.test.ts` (new); `tests/boundaries` when any import edge changes
**Tags**: @structure, @boundary, @audit, @architecture

**Preconditions**:

- The delivered audit modules, contracts, state modules, and CLI command registry.

**Steps**:

1. Assert the audit record/chain vocabulary lives in runtime-neutral contracts (types/data only; no I/O, clock, randomness, or environment access).
2. Assert the audit consumer imports the public state port and its own modules only; no driver module, no runtime-API location, no driver discriminant.
3. Assert `packages/core/src/state/**` does not import branding; identity naming is resolved at the edge.
4. Assert no audit CLI command is registered in `packages/cli/src/commands/**` and no command name for audit appears in the program registry.
5. Assert the audit identity type does not appear in `packages/core/src/contracts/credentials.ts`, the config resolver, or any policy/authorization module; it is confined to audit record and read types.
6. Run `bun test tests/boundaries` if any package/subpath edge changed.

**Expected Outcome**:

- Contracts stay runtime-neutral; the audit consumer composes only the public state port; the state tier stays branding-free.
- No new runtime-API location, driver discriminant, or CLI audit command exists.
- The identity vocabulary is not wired into authorization/credential paths.
- Boundary rules and fixture coverage remain green.

---

### 5.3 Seeded Scenario Inheritance (SC-M1-23)

The milestone pack's SC-M1-23 ("every invocation audited; scripted output trimmed") is the seeded scenario for M1-S22 and is inherited, not restated as a new scenario id. Its Given/When/Then maps to TC-GH223-022, which is the end-to-end case (scripted `lanes list --json` through a lane shell carrying the identity convention; exactly one audit record; one minified `{"data":...}` line; error line keeps runId; identity present/absent; re-run yields a second record with a new runId; no secret patterns in the record). The scenario's assertion families are extended by the rest of this plan:

| SC-M1-23 assertion family | Inheriting / extending TCs |
|---------------------------|----------------------------|
| Exactly one audit record per invocation | TC-GH223-001, TC-GH223-002, TC-GH223-003, TC-GH223-004, TC-GH223-022 |
| Record carries runId, command, redacted args, exit, timing, identity | TC-GH223-005, TC-GH223-011, TC-GH223-022 |
| Scripted success is one minified `{"data":...}` line without schemaVersion/runId/timing | TC-GH223-014, TC-GH223-015, TC-GH223-022 |
| Error line keeps runId | TC-GH223-016, TC-GH223-017, TC-GH223-022 |
| Identity captured when present | TC-GH223-011, TC-GH223-013, TC-GH223-022 |
| Absent-never-inferred identity | TC-GH223-012, TC-GH223-022 |
| Re-run produces a second record with a new runId | TC-GH223-006, TC-GH223-022 |
| No secret patterns in the record | TC-GH223-031, TC-GH223-032, TC-GH223-022 |
| Extensions beyond the seeded text: all outcome classes, interactive/override modes, golden/conformance both modes, chain tamper-evidence and salvage continuity, bounded reads, audit-write degradation | TC-GH223-007..010, TC-GH223-018..021, TC-GH223-023..034 |

Rules honored here:

- The scenario id `SC-M1-23` is stable and cited verbatim in the test titles/describes of TC-GH223-022.
- Divergence after delivery is a defect, not a test-plan choice. The stand-in `lanes list` program is the only substitution; it exists because the real command ships later, and it preserves the scenario's shape (`lanes list --json` through an agent shell).
- The seeded scenario's "no secret patterns" wording is interpreted as the spec's registered-secret guarantee (F-6): tests assert planted registered secrets are absent. A broader pattern scan is not invented (OQ-T9).

## 6. Environments and Test Data

- **Runtime**: Bun pinned by `.bun-version`; `bun test` (or `pnpm test`) for `tests/**/*.test.ts`. No external services, no network, no process spawning, no real process streams.
- **Directories**: every audit store lives under a per-test `mkdtempSync` root labelled with the `gh223-` prefix; teardown removes it recursively. No test writes the repository tree, the user state directory, or the live ledger.
- **State fixtures**: `tests/fixtures/state/harness.ts` supplies `createTestEdge` (`arm`, `armExhaustion`, `disarm`, `raised`, mutable clock), `makeIdentity`, `openStore`, `withinFence`, `ledgerPath`, `ledgerText`, `ledgerLines`, `ledgerBytes`, `ledgerDigest`, `independentChecksum`, `digestPaths`, `listStoreFiles`, `quarantineDirectory`, `quarantineFiles`, `salvageTail`. This change adds audit helpers: `makeAuditStore`, `seedAuditRecords`, `auditRecordsOf`, `mutateAuditRecord`, `tamperWithRecomputedChecksum`, `assertNoChainBreak`, and `chainVerdict` (names fixed at delivery).
- **CLI fixtures**: `tests/golden/helpers.ts` supplies `runCase`, `runDescriptor`, `bufferSink`, `programFor`, `loadProgram`, `SYNTHETIC_BRAND`. This change extends the injected fact type with `mode` (interactive/scripted), `environment` (string map), and `chainingKey`; each golden run creates its own temp audit store, so no fixture directory is a live store.
- **New audit fixtures**: `tests/fixtures/audit/cases.json` (outcome/identity/bounds matrix), `tests/fixtures/audit/mutations.json` (declarative tamper matrix), `tests/fixtures/audit/lane-environment.json` (declared lane variables only), `tests/fixtures/audit/chain-keys.json` (obviously fake key material). Fixtures are never named `*.test.ts`.
- **Golden fixtures**: existing `tests/fixtures/result/envelopes/**` cases gain `mode` in `injected.json`/`meta.json` and remain interactive goldens. New scripted cases: `scripted-success-data`, `scripted-success-void`, `scripted-classified-user`, `scripted-classified-platform`, `scripted-unknown-failure`, `scripted-broken-unknown-command`, `scripted-broken-unknown-flag`, `scripted-broken-missing-value`, `scripted-broken-conflicting-flags`. Every case keeps a `stdout.json`; no case may be skipped.
- **Stand-in program**: `tests/fixtures/result/programs/lanes-list.json` models `lanes list --json` for SC-M1-23; it returns a deterministic data payload and declares no real `lanes` behaviour.
- **Identity variable**: name = `SYNTHETIC_BRAND.environmentPrefix` + the delivered suffix constant; values are obviously fake (`pm-lane-7`, `qa-lane-3`) and never derived from the host.
- **Chaining key**: injected fixture value (for example `planted-fake-chain-key-0001`), deterministic per test, never written to a fixture that lands in the ledger. A second key fixture is used for the negative control.
- **Planted secrets**: obviously fake tokens matching the `planted-fake-` prefix; registered at the edge through the existing secret-registration seam. No real credentials or user data.
- **Fault injection**: only named `StateEdgeFaultPoint` values. `append-before-flush` is used with generic `arm` (write failure) and `armExhaustion` (storage exhaustion); fence contention is produced by holding a fence with another token; salvage/repair use the existing operations. Tests assert both the resulting outcome and that the intended point was raised, so a typo fails loudly rather than passing vacuously.
- **Platform**: permission assertions remain POSIX-only with the existing platform conditional; no Linux run claims Windows ACL verification.
- **Isolation**: each case gets a fresh store, clock, run-id factory, environment record, and key; mutation-style structural checks copy into a temp root before mutating.

## 7. Automation Plan and Implementation Mapping

| TC ID | Test file | Command | Implementation status |
|-------|-----------|---------|-----------------------|
| TC-GH223-001 | `tests/behaviour/audit-ledger.test.ts` | `bun test tests/behaviour/audit-ledger.test.ts` | New |
| TC-GH223-002 | `tests/behaviour/audit-outcomes.test.ts` | `bun test tests/behaviour/audit-outcomes.test.ts` | New |
| TC-GH223-003 | `tests/behaviour/audit-outcomes.test.ts` | same | New |
| TC-GH223-004 | `tests/behaviour/audit-outcomes.test.ts` | same | New |
| TC-GH223-005 | `tests/behaviour/audit-ledger.test.ts`, `tests/structure/audit-contract.test.ts` | `bun test tests/behaviour/audit-ledger.test.ts tests/structure/audit-contract.test.ts` | New |
| TC-GH223-006 | `tests/behaviour/audit-ledger.test.ts` | same | New |
| TC-GH223-007 | `tests/behaviour/audit-malformed.test.ts` | `bun test tests/behaviour/audit-malformed.test.ts` | New |
| TC-GH223-008 | `tests/structure/audit-contract.test.ts`, `tests/behaviour/audit-ledger.test.ts` | same | New |
| TC-GH223-009 | `tests/behaviour/audit-write-failure.test.ts` | `bun test tests/behaviour/audit-write-failure.test.ts` | New |
| TC-GH223-010 | `tests/behaviour/audit-write-failure.test.ts` | same | New |
| TC-GH223-011 | `tests/behaviour/audit-identity.test.ts` | `bun test tests/behaviour/audit-identity.test.ts` | New |
| TC-GH223-012 | `tests/behaviour/audit-identity.test.ts` | same | New |
| TC-GH223-013 | `tests/structure/audit-contract.test.ts`, `tests/structure/cli-edge-seam.test.ts`, `tests/checks/forbidden-literals.test.ts` | `bun test tests/structure/audit-contract.test.ts tests/structure/cli-edge-seam.test.ts tests/checks/forbidden-literals.test.ts` | New + Existing – Update |
| TC-GH223-014 | `tests/behaviour/scripted-trim.test.ts`, `tests/golden/envelope-scripted.test.ts` | `bun test tests/behaviour/scripted-trim.test.ts tests/golden/envelope-scripted.test.ts` | New |
| TC-GH223-015 | `tests/behaviour/scripted-trim.test.ts`, `tests/golden/envelope-scripted.test.ts` | same | New |
| TC-GH223-016 | `tests/behaviour/scripted-trim.test.ts`, `tests/golden/envelope-scripted.test.ts`, `tests/golden/envelope-failure.test.ts` | same + `bun test tests/golden/envelope-failure.test.ts` | New + Existing – Update (mode metadata only) |
| TC-GH223-017 | `tests/behaviour/scripted-trim.test.ts`, `tests/golden/envelope-scripted.test.ts`, `tests/golden/broken-command.test.ts` | same + `bun test tests/golden/broken-command.test.ts` | New + Existing – Update (mode metadata only) |
| TC-GH223-018 | `tests/behaviour/envelope-mode.test.ts`, `tests/golden/envelope-success.test.ts`, `tests/golden/envelope-failure.test.ts` | `bun test tests/behaviour/envelope-mode.test.ts tests/golden/envelope-success.test.ts tests/golden/envelope-failure.test.ts` | New + Existing – Update |
| TC-GH223-019 | `tests/behaviour/envelope-mode.test.ts` | same | New |
| TC-GH223-020 | `tests/golden/envelope-scripted.test.ts`, `tests/structure/result-fixtures.test.ts`, `tests/structure/result-contract.test.ts` | `bun test tests/golden/envelope-scripted.test.ts tests/structure/result-fixtures.test.ts tests/structure/result-contract.test.ts` | New + Existing – Update |
| TC-GH223-021 | `tests/structure/scripted-projection.test.ts`, `tests/structure/result-contract.test.ts` | `bun test tests/structure/scripted-projection.test.ts tests/structure/result-contract.test.ts` | New + Existing – Update |
| TC-GH223-022 | `tests/behaviour/audit-scenario-m1-23.test.ts`, `tests/fixtures/result/programs/lanes-list.json` | `bun test tests/behaviour/audit-scenario-m1-23.test.ts` | New |
| TC-GH223-023 | `tests/behaviour/audit-chain.test.ts` | `bun test tests/behaviour/audit-chain.test.ts` | New |
| TC-GH223-024 | `tests/behaviour/audit-chain.test.ts` | same | New |
| TC-GH223-025 | `tests/behaviour/audit-chain-mutations.test.ts`, `tests/fixtures/audit/mutations.json` | `bun test tests/behaviour/audit-chain-mutations.test.ts` | New |
| TC-GH223-026 | `tests/behaviour/audit-key-exclusion.test.ts`, `tests/fixtures/audit/lane-environment.json` | `bun test tests/behaviour/audit-key-exclusion.test.ts` | New |
| TC-GH223-027 | `tests/behaviour/audit-chain-salvage.test.ts` | `bun test tests/behaviour/audit-chain-salvage.test.ts` | New |
| TC-GH223-028 | `tests/behaviour/audit-read.test.ts` | `bun test tests/behaviour/audit-read.test.ts` | New |
| TC-GH223-029 | `tests/structure/audit-surface.test.ts` | `bun test tests/structure/audit-surface.test.ts` | New |
| TC-GH223-030 | `tests/behaviour/audit-read.test.ts` | same | New |
| TC-GH223-031 | `tests/behaviour/audit-redaction.test.ts`, `tests/golden/redaction.test.ts` | `bun test tests/behaviour/audit-redaction.test.ts tests/golden/redaction.test.ts` | New + Existing – Update |
| TC-GH223-032 | `tests/behaviour/audit-redaction.test.ts`, `tests/structure/audit-imports.test.ts` | `bun test tests/behaviour/audit-redaction.test.ts tests/structure/audit-imports.test.ts` | New |
| TC-GH223-033 | `tests/checks/error-table-sync.test.ts`, `tests/structure/error-table.test.ts`, `tests/behaviour/audit-chain.test.ts` | `bun test tests/checks/error-table-sync.test.ts tests/structure/error-table.test.ts tests/behaviour/audit-chain.test.ts` | Existing – No Change (sync/table) + New (verdict shape) |
| TC-GH223-034 | `tests/structure/audit-contract.test.ts`, `tests/structure/audit-imports.test.ts`, `tests/structure/audit-surface.test.ts`, `tests/boundaries` | `bun test tests/structure/audit-contract.test.ts tests/structure/audit-imports.test.ts tests/structure/audit-surface.test.ts tests/boundaries` | New + Existing – Update |

Companion suites touched by new exports, fixtures, or mode metadata but carrying no new case ids:

| Suite | Role |
|-------|------|
| `tests/structure/result-contract.test.ts` | Extend the validator rule bijection for scripted rules; keep interactive rules intact. |
| `tests/structure/result-fixtures.test.ts` | Validate the new `mode` metadata and the new scripted fixture cases; keep hygiene checks. |
| `tests/golden/timing.test.ts` | Assert scripted success lines carry no timing and interactive lines still do. |
| `tests/golden/redaction.test.ts` | Run the existing redaction cases in both modes; scripted lines stay secret-free. |
| `tests/structure/envelope-contract.test.ts` | Envelope shape and key set remain the M0-S3 contract; no new keys. |
| `tests/structure/delivery-result-contract.test.ts` | Result contract types remain runtime-neutral; audit vocabulary does not leak into the envelope. |
| `tests/structure/state-contract.test.ts`, `tests/structure/state-imports.test.ts`, `tests/structure/state-scope.test.ts` | New audit state modules obey contract-only imports, no branding, no new runtime API. |
| `tests/structure/cli-edge-seam.test.ts` | No ambient environment read; identity/mode/key arrive as injected data; single stream-write site unchanged. |
| `tests/checks/error-table-sync.test.ts`, `tests/structure/error-table.test.ts` | No row changes; sync stays green. |
| `tests/checks/forbidden-literals.test.ts` | New source/docs contain no hardcoded product token. |
| `tests/boundaries` | Run if any package/subpath import edge or `workspaceImports` entry changes. |
| `tests/behaviour/state-torn.test.ts`, `state-salvage.test.ts`, `state-salvage-invariants.test.ts`, `state-index.test.ts`, `state-storage-exhausted.test.ts` | M0-S5/GH-222 regressions; expected to pass unchanged. |

Fixture/corpus updates required (delivery-blocking, no new TC ids):

- `tests/fixtures/result/envelopes/**/injected.json` — add `mode`, `environment` (empty for identity-absent cases), and a fake `chainingKey` where the harness needs it; the key must never appear in a `stdout.json` or any ledger-shaped golden.
- `tests/fixtures/result/envelopes/**/meta.json` — add `mode` and keep `outcome`; update the fixture-hygiene expectations.
- `tests/fixtures/result/envelope-key-set.json` — add the scripted success key set (`data`) and the scripted failure key set (`error`) beside the existing interactive sets.
- `tests/fixtures/result/programs/lanes-list.json` — the SC-M1-23 stand-in.
- `tests/fixtures/state/harness.ts` — audit-store helpers listed in §6.
- `tests/fixtures/audit/**` — cases, mutations, lane environment, chain keys.
- Goldens are regenerated deliberately with the explicit test command; never by blanket rewrite. Existing interactive goldens must remain byte-identical unless the change intentionally amends them.

### 7.1 Unit vs Integration Split

- **Pure unit**: the record-assembly field mapping and payload validation half of TC-GH223-005; the chain-link computation and verification half of TC-GH223-023; filter matching and bound/truncation arithmetic in TC-GH223-028; the scripted-projection validator in TC-GH223-021.
- **Integration (in-process `runCli` + temp store)**: TC-GH223-001..004, 006, 007, 009..012, 014..019, 022..028, 030..032.
- **Golden**: TC-GH223-014..018, 020 (and the existing cases updated by 016/017).
- **Structure / contract / check / boundary**: TC-GH223-008, 013, 020, 021, 029, 032, 033, 034.

### 7.2 Execution Strategy and Quality Gates

During delivery (fail fast, narrow first):

1. `bun test tests/behaviour/audit-ledger.test.ts tests/behaviour/audit-outcomes.test.ts tests/behaviour/audit-identity.test.ts`
2. `bun test tests/behaviour/audit-write-failure.test.ts tests/behaviour/audit-malformed.test.ts`
3. `bun test tests/behaviour/scripted-trim.test.ts tests/behaviour/envelope-mode.test.ts tests/golden/envelope-scripted.test.ts`
4. `bun test tests/behaviour/audit-chain.test.ts tests/behaviour/audit-chain-mutations.test.ts tests/behaviour/audit-chain-salvage.test.ts tests/behaviour/audit-key-exclusion.test.ts`
5. `bun test tests/behaviour/audit-read.test.ts tests/behaviour/audit-redaction.test.ts tests/behaviour/audit-scenario-m1-23.test.ts`
6. `bun test tests/structure/audit-contract.test.ts tests/structure/audit-imports.test.ts tests/structure/audit-surface.test.ts tests/structure/scripted-projection.test.ts`

In the `quality_gates` phase (phase 9), the required evidence is:

- **Aggregate gate**: `pnpm check` (lint → format:check → typecheck → test → check:boundaries) — the single completion entry point.
- **Golden tier**: `bun test tests/golden` — both modes, all existing and new cases, no skipped case.
- **Behaviour tier**: `bun test tests/behaviour` — all audit suites plus untouched state/result consumers.
- **Structure/boundary**: `bun test tests/structure tests/boundaries` — contracts, imports, scope, CLI seam, no audit command, no unbounded dump.
- **Error-table sync (binding)**: `bun run scripts/checks/error-table-sync.ts` exits 0 with zero drift, plus `bun test tests/checks/error-table-sync.test.ts`.
- **Security scans**: `bun test tests/checks/forbidden-literals.test.ts` and `git diff --check`.
- **No-spawn guard**: representative `runCli` cases install and restore the guard; zero violations recorded.
- Any platform conditional skip must be recorded in §10 with the reason; a skip is not a pass. Windows ACL behaviour is not claimed by this run.

## 8. Risks, Assumptions, and Open Questions

### 8.1 Risks

| ID | Risk | Impact | Mitigation |
|----|------|--------|------------|
| TR-1 | F-5/AC-F5-1 requires a time-window filter, but the specified record set has no timestamp; the filter cannot be tested or implemented as written | H | Raise OQ-T5 for spec reopening (add a timestamp field or drop the filter). TC-GH223-028 covers the remaining filters; AC-F5-1 is marked partial until pinned. |
| TR-2 | DEC-8 claims an omitted audit record is detectable as a "sequence discontinuity", but the public port derives the next sequence from the verified ledger length, so a failed append leaves no gap | M | TC-GH223-010 asserts the testable half (outcome unchanged, loud classification, no partial record). OQ-T6 names the missing detection mechanism; do not invent a sentinel record. |
| TR-3 | The audit append has no dedicated named fault point, so the failure cases cannot be injected deterministically | H | Compose the existing `append-before-flush` point through the audit store's edge; assert the point was raised. If delivery adds an audit-specific pre-commit point, bind TC-GH223-009/010 to it in revision. |
| TR-4 | Extending golden injected facts (mode/environment/key) breaks existing byte goldens or the fixture-hygiene checks | M | Default existing cases to interactive and keep their stdout byte-identical; update `result-fixtures.test.ts` deliberately; regenerate goldens only with the explicit command. |
| TR-5 | "Record shows identity as attribution only" has no machine-checkable marker | M | TC-GH223-011 asserts verbatim capture and absence of verification markers; TC-GH223-034 asserts identity is not imported by credential/auth modules. OQ-T7 pins the marker if the delivery adds one. |
| TR-6 | Chain algorithm drift makes an independent oracle impossible | L | Assert behaviour, not algorithm: same key + sequence verifies, different key fails, altered content fails, forged chain fails. If delivery pins the primitive, add an independent oracle in `tests/fixtures/audit/`; if it stays opaque, keep the behavioural assertions and do not duplicate an unpinned algorithm. |
| TR-7 | Salvage/repair false positives erode trust in chain-break flags | M | TC-GH223-027 exercises both operations, asserts the reported removal is not a break, and includes a genuine alteration control so continuity does not suppress real breaks. |
| TR-8 | Audit payload field names and outcome-class vocabulary churn between plan and delivery | M | Tests bind to the delivered runtime-neutral constants and assert semantic equality with the envelope projection; a field rename changes constants, not assertions. |
| TR-9 | A second fence acquisition for the audit append contends with a handler-held fence (`state.lock.busy`) | M | OQ-T8 asks delivery to pin fence reuse/separation. TC-GH223-010's fence-busy case distinguishes an injected write-path contention from an unexpected self-contention. |
| TR-10 | Test isolation failures (shared temp store, ambient env, real streams) create flaky or cross-contaminated results | L | Fresh temp root, clock, run-id factory, environment, and key per case; no-spawn guard; structure test forbids ambient env reads. |
| TR-11 | The redaction chokepoint lives in the CLI serializer, while the audit write persists in the state tier; sharing it could create a second serialization path or a tier violation | H | Redact the invocation fact on the CLI side before handing it to the audit write port; keep one redaction function (shared through a runtime-neutral module only if needed); TC-GH223-032's structure guard forbids a second raw writer, and TC-GH223-034 keeps the state tier branding-free. |
| TR-12 | The state layer's verified read may rebuild the derived index (a write), while F-5/AC-F5-1 says the audit read writes nothing | M | TC-GH223-028 seeds a store whose derived index is current, then asserts the ledger and directory are byte-identical across queries. A rebuild-on-read would surface as a deviation, not be waived; the delivery can read the ledger without an index rebuild. |

### 8.2 Assumptions

- **ASM-1**: M0-S3 (result contract, redaction chokepoint, deterministic in-process surface, golden and conformance tooling) and M0-S5 (state layer: ledger truth, verified reads, fences, classification, salvage, additive kinds, artifact boundaries) are delivered at the change base (HEAD `f13f5cf9`), as the spec assumes.
- **ASM-2**: `CliDependencies`/the runtime edge can be extended with an injected environment record, a stream-capability mode fact, and an audit write port without introducing an ambient read; `tests/structure/cli-edge-seam.test.ts` is updated in the same change to keep the no-ambient-read invariant.
- **ASM-3**: The audit kind is additive within `delivery.state.v1`; no migration, schema bump, or new driver discriminant is required.
- **ASM-4**: The chaining key can be injected deterministically for tests; the algorithm is verified behaviourally, not pinned to a specific primitive.
- **ASM-5**: The golden runner can create a temp audit store per case and extend `injected.json` with mode/environment/key facts while keeping existing interactive goldens byte-identical.
- **ASM-6**: `lanes list` is represented by a stand-in program for SC-M1-23 because the real command ships later; the scenario's id and Given/When/Then shape are preserved (GH-222 stand-in precedent).
- **ASM-7**: Every case runs in process; no process spawning, real streams, real clock, or real state directory.
- **ASM-8**: The error table is unchanged; all audit-path failures reuse existing state identities.
- **ASM-9**: The declared lane environment is fixture data; this story does not build or render a lane environment (NG-1).
- **ASM-10**: The CLI side redacts the invocation fact (arguments, raw tokens, identity) before handing it to the audit write port; the state tier never imports the CLI serializer. If the redaction function is shared through a runtime-neutral module, it remains the single chokepoint and no second serialization path is introduced.

### 8.3 Open Questions

| ID | Question | Blocking? | Owner / resolution path |
|----|----------|-----------|--------------------------|
| OQ-T1 | Is `runId` inside the scripted error object or alongside it in the single line? AC-F3-2 says the error object carries it; spec §12 says the placement is pinned at delivery. | No — TC-GH223-016 asserts presence in the line and records the delivered placement | Delivery plan/coder pins the rendering; test plan revised only if the shape differs from the AC reading |
| OQ-T2 | The chaining key is described as coming through the "configuration/secret boundary", but the configuration resolver currently rejects secret values (`config.secret.forbidden`). Is the key a credential-port resolution or a new declared secret-boundary key? | No for tests (injected directly), yes for delivery evidence | Delivery plan pins the source; AC-F4-2's evidence must show the key never enters lane surfaces either way |
| OQ-T3 | What is the refusal shape when a read query omits the bound or supplies an invalid one (throw, classified failure, or type-only impossibility)? | No — TC-GH223-029 asserts a required type and no unbounded export | Delivery pins the runtime shape; if omission is representable, add a case here |
| OQ-T4 | What are the exact audit payload field names and the closed outcome-class vocabulary values? | No — tests bind to delivered constants and assert semantic equality | Delivery pins them in the contracts/state surface; this plan's assertions stay semantic |
| OQ-T5 | **F-5/AC-F5-1 requires filtering by time window, but no timestamp field exists in the specified record set (runId, command, args, exit, timing, outcome class, scope/repo, identity).** | **Yes — spec reopening required** | `@pm`/`@spec-writer`: either add `startedAt`/`recordedAt` (and its semantics/format) to the audit record, or remove the time-window filter from F-5/AC-F5-1. TC-GH223-028's time-window half is TODO until then. |
| OQ-T6 | **DEC-8 says an omitted audit record is detectable as a "sequence discontinuity" on the next verified read, but the public port derives the next sequence from the verified ledger length (`packages/core/src/state/index.ts`), so a failed append leaves no gap.** | **Yes for the DEC-8 observability claim; no for the AC set** | `@pm`/`@spec-writer`: pin an audit-specific ordinal/gap marker, or narrow the DEC-8 wording to "the omission is not observable through the ledger" (and rely on the loud diagnostic). TC-GH223-010 asserts only the testable half. |
| OQ-T7 | What machine-readable marker shows identity as "claimed, not proven" (a `claimed` field, a view label, or documentation only)? | No — verbatim capture and absent inference are testable regardless | Delivery pins the vocabulary; TC-GH223-011/034 are updated if a marker lands |
| OQ-T8 | Does the audit append acquire its own fence, or reuse a fence already held by the command handler? What happens when the handler holds the store's fence? | No for the ACs; yes for a stable failure taxonomy | Delivery plan pins the fence strategy; TC-GH223-010 distinguishes injected contention from self-contention |
| OQ-T9 | SC-M1-23 says "no secret patterns in the record"; F-6 guarantees only registered secret values. Is a broader pattern scan intended? | No — spec F-6 is authoritative | PM/spec writer confirms wording; tests assert registered secrets only, not an invented pattern list |
| OQ-T10 | Is a whitespace-only identity value "present and non-empty" (recorded verbatim) or treated as absent? | No — TC-GH223-012 asserts absent and empty only | Delivery pins the empty-value rule; add a case here if whitespace is defined as empty |
| OQ-T11 | Is the read surface store-scoped (so "filter by scope" is the store identity) or multi-store (so one query spans workspace scopes)? | No — TC-GH223-028 exercises a matching and a non-matching scope either way | Delivery pins the surface shape; if it is multi-store, seed a second store in TC-GH223-028 |

**Explicit gaps for PM:** AC-F5-1 (and F-5) is underspecified as written because the time-window filter has no timestamp field — this needs a specification reopening, not a test workaround. DEC-8's "sequence discontinuity" detection is also underspecified, though it does not block any AC. The whitespace-only identity value is a minor unpinned edge (OQ-T10). No acceptance criterion is wholly untestable; AC-F5-1 is partially untestable until OQ-T5 is resolved.

## 9. Plan Revision Log

| Version | Date | Author | Changes |
|---------|------|--------|---------|
| 1.0 | 2026-11-06 | @test-plan-writer | Initial plan: 34 story-local cases (`TC-GH223-*`) covering all 14 ACs (AC-F1-1..AC-F6-1), EVT-1, DM-1..4, NFR-1..9, and the inherited SC-M1-23 seeded scenario; both output modes, chain tamper-evidence/salvage continuity, bounded reads, and audit-write degradation. Records two spec gaps for PM: OQ-T5 (time-window filter without a timestamp) and OQ-T6 (DEC-8 discontinuity detection). |

## 10. Test Execution Log

Populated during execution. Each row records the TC id, run date, result, and the command or note that produced it. A skip is recorded with its reason and never counts as a pass.

| TC ID | Run Date | Result | Notes |
|-------|----------|--------|-------|
| — | — | — | Not yet executed (plan proposed). |
