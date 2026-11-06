---
id: chg-GH-223-test-plan
status: Updated
created: 2026-11-06
last_updated: 2026-11-06
owners: ["engineering"]
service: delivery-os
labels: ["m1", "audit", "state-layer", "cli"]
version_impact: minor
summary: "Traceable coverage for GH-223 command audit ledger and agent identity (spec v1.1): exactly one durable record per invocation across every outcome class, UTC startedAt from the injected clock, monotonic auditSeq with in-band skipped-ordinal detection, claimed-identity capture with the explicit claimed marker and no inference, owner-pinned scripted-output trim with top-level runId on failure lines and interactive preservation, durable store-managed chaining key with cross-process verification, bounded filtered reads over startedAt/scope/repo, redaction-chokepoint hygiene, and classified audit-write degradation that never changes the command outcome."
links:
  change_spec: ./chg-GH-223-spec.md
  implementation_plan: null
  testing_strategy: .ai/rules/testing-strategy.md
---

# Test Plan - M1-S22: Command audit ledger and agent identity

## 1. Scope and Objectives

This plan protects the delivery engine's new history guarantee: every command invocation through the command surface leaves exactly one durable, schema-validated audit record carrying runId, command, redacted arguments, exit code, timing, outcome class, `scope`, `repo`, `startedAt` (UTC start from the injected clock), `auditSeq` (the audit consumer's monotonic per-store ordinal), and claimed identity when present. It also protects the owner-pinned scripted-output amendment (one minified `{"data":...}`/`{"error":...}` line, with `runId` as a top-level key of failure lines), the durable store-managed chaining key that makes altered records detectable even when their unkeyed checksum is recomputed and keeps cross-process verification free of false breaks, the bounded/filtered read surface (including the `startedAt` time window and in-band skipped-ordinal findings), and the redaction chokepoint that must guard record content exactly as it guards output streams.

The data and security risks this plan primarily guards are: missing or duplicate records that make history untrustworthy; an undetectable failed append because no ordinal gap survives it; unredacted secrets persisted forever; inferred identities presented as if claimed; a trim that silently drops context with no ledger to hold it; a chaining key that is regenerated per process and false-flags earlier records; a chain that false-flags legitimate salvage or fails to flag a recomputed-checksum edit; an unbounded dump that exposes every historical command line; and an audit-write failure that either corrupts or misreports the command's own outcome.

Regressions protected: the M0-S3 envelope contract in interactive mode, error-table contents and bidirectional sync, text (non-`--json`) output, the single serialization/redaction chokepoint, the state layer's verified-read, fence, classification, salvage, and evidence discipline, and the no-spawn deterministic in-process test surface.

### 1.1 In Scope

- Exactly-one audit-record semantics for success, void success, classified failure (user and platform), unknown failure, and broken invocation (unknown command/flag, missing flag value, conflicting flags).
- Full v1.1 record field set: `runId`, `command`, `arguments`, `exitCode`, `timing`, `outcomeClass`, `scope`, `repo`, `startedAt`, `auditSeq`, `agentIdentity`, `chainValue`; envelope-context retention; additive-kind composition inside `delivery.state.v1` under the store-scoped key `audit.invocations`.
- `startedAt` from the injected clock (UTC, the same clock that measures `timing`), recorded exactly once per invocation and distinct on re-runs; never an ambient clock read.
- `auditSeq` as the audit consumer's monotonic per-store ordinal assigned at append time inside the shared audit fence; monotonicity across interleaved non-audit kinds; in-band skipped-ordinal findings after a failed append.
- Idempotent re-runs producing a second record under a new runId with a distinct `startedAt` and a later `auditSeq`; no deduplication or overwrite.
- Agent-identity consumption: seam-named environment variable read as injected edge data; presence decided on the trimmed value (absent, empty, and whitespace-only all count as absent); a present value recorded verbatim with the explicit attribution-kind marker `claimed`; claimed-not-proven semantics.
- Scripted-mode trim for success, void success, classified failure, unknown failure, and broken invocation; failure lines carry `runId` as a top-level key and full error-table fields; interactive envelopes remain byte-conformant; `--verbose` full-envelope override; `--pretty` indentation-only; single-line discipline on the current machine channel (the future multi-event `--watch` rule is a forward contract, see §1.2).
- Golden fixtures and testkit conformance validator extended to both modes, preserving the no-case-without-golden rule and the no-skip path; the scripted failure key set is `error` + top-level `runId`.
- Keyed hash chaining with the durable store-managed key artifact: generated once on the store's first audit append, persisted under least-privilege permissions (0600) and verified on open, reused across later edges/processes; clean verification, interleaved non-audit kinds, alteration detection including recomputed unkeyed checksums, position-naming evidence, key exclusion from ledger record payloads/configuration/ambient environment/lane environments, chain anchoring, and continuity across terminal-tail repair and guided salvage.
- Bounded, filtered read surface: exact-match `scope` and `repo` filters (repo-null records excluded from repo-constrained results only), `startedAt` time-window filter, command/outcome filters, explicit bound, in-band truncation, in-band skipped-ordinal findings, `input.value.rejected` refusal for missing/invalid bounds or filters, verified reads, no fence acquisition, no writes, torn/unknown classification without silent zeros.
- Redaction-chokepoint hygiene for record content across all outcome classes, including an edge-registered secret embedded in arguments and in the identity value; unregistered values remain outside the guarantee.
- Audit-write failure semantics: classified, loud diagnostics degradation that never changes the command's outcome or exit code, with no partial record; a later successful append's `auditSeq` proves the omission.
- No new error-table rows and no error-table drift; no new CLI audit command; tier and boundary conformance.

### 1.2 Out of Scope & Known Gaps

- [OUT] The harness-adapter spawn-side setter of the identity variable and the harness-plugin rendering into agent shells (spec NG-1, DEC-3). Tests model the declared lane environment as fixture data.
- [OUT] The retro pipeline (M1-S8), spend read side (M1-S19), coordinator exit evidence (M1-S20), and any other consumer of the read surface (spec NG-2).
- [OUT] A user-facing CLI audit-reading command (spec NG-3, DEC-6). The read surface is library-only.
- [OUT] Tamper prevention, authenticated identity, multi-user/remote threat models, cryptographic non-repudiation, and key rotation/escrow (spec NG-4, §7.3).
- [OUT] Retention, pruning, compaction, backup/restore, migration, or a state schema-version bump (spec NG-5, NG-6, §19).
- [OUT] MCP surface changes; the MCP projection is untouched by the CLI's scripted-mode rendering (spec §7.2).
- [OUT] Real process spawning, real process streams, real disk exhaustion, or host-capacity tests. Every case runs in process with injected clock, run-id factory, environment, mode fact, secrets, and named state-edge fault points. Cross-process key continuity is modeled by reopening the same temp store with a fresh edge/store instance, not by spawning a process.
- [OUT] Windows ACL execution. Permission assertions (including the key artifact's 0600) remain POSIX-only; no Linux run claims Windows verification.
- [OUT] Performance/load characteristics of audit reads or chain verification.
- **Forward contract:** stream outputs (a future `--watch`) stay line-delimited in every mode (F-3/DEC-2). No stream command ships in this story, so only the current single-invocation line discipline is asserted; the multi-event stream rule is inherited by the later command that introduces it.
- **v1.1 gap watch:** the spec's v1.1 amendment resolves the v1.0 time-window and sequence-gap findings. New v1.1 details that remain unpinned (auditSeq allocation durability, key-artifact missing/corrupt semantics, `startedAt` serialization/time-window/bound-0 boundaries, salvage-caused ordinal gaps) are recorded in §8.3; the blocking one is called out for PM.

## 2. References

- **Change specification (v1.1)**: [chg-GH-223-spec.md](./chg-GH-223-spec.md) — capabilities F-1..F-6, AC-F1-1..AC-F6-1 including v1.1's AC-F1-4, NFR-1..NFR-9, DM-1..DM-5, DEC-1..DEC-8, OQ-4..OQ-14 resolutions, Appendix B test-plan handoff.
- **Change PM notes**: [chg-GH-223-pm-notes.yaml](./chg-GH-223-pm-notes.yaml) — scope resolution (consume-only identity), dependency verification, doc-sync obligations.
- **Seeded milestone scenario**: [doc/planning/oss-tooling/milestones/m1/test-scenarios.md](../../../planning/oss-tooling/milestones/m1/test-scenarios.md) — SC-M1-23 (stable id; inherited and extended here).
- **Current system truth — result contract**: [doc/spec/features/feature-result-contract.md](../../../spec/features/feature-result-contract.md) — envelope field contract, exit projection, redaction chokepoint, golden/conformance tooling, containment.
- **Current system truth — state layer**: [doc/spec/features/feature-state-layer.md](../../../spec/features/feature-state-layer.md) — public port, additive kinds, artifact boundaries, verified reads, fences, salvage/repair, evidence model, forever retention.
- **Current system truth — branding seam**: [doc/spec/features/feature-branding-seam.md](../../../spec/features/feature-branding-seam.md) — `environmentPrefix` derivation and forbidden-literal constraints.
- **Testing strategy**: [.ai/rules/testing-strategy.md](../../../../.ai/rules/testing-strategy.md) — layers, module mapping, conventions, quality gates.
- **TypeScript rules**: [.ai/rules/typescript.md](../../../../.ai/rules/typescript.md) — bun:test authoring, workspace boundaries, error contract.
- **State test harness**: `tests/fixtures/state/harness.ts` — `createTestEdge` (`arm`, `armExhaustion`), `makeIdentity`, `openStore`, `withinFence`, `ledgerText`, `ledgerBytes`, `ledgerDigest`, `independentChecksum`, `salvageTail`. v1.1 adds key-artifact and audit-ordinal helpers (names fixed at delivery).
- **Result/golden harness**: `tests/golden/helpers.ts`, `packages/testkit/src/result-conformance.ts` — `runCase`, `runDescriptor`, `bufferSink`, `loadGoldenCases`, `assertEnvelopeContract`, `RULES`.
- **Runtime edge and fault points**: `packages/cli/src/edge.ts` (environment facts as data), `packages/cli/src/index.ts` (`CliDependencies`), `packages/core/src/state/edge.ts` (`StateEdgeFaultPoint`).
- **Existing suites to extend or guard**: `tests/golden/envelope-success.test.ts`, `tests/golden/envelope-failure.test.ts`, `tests/golden/broken-command.test.ts`, `tests/golden/redaction.test.ts`, `tests/golden/timing.test.ts`, `tests/structure/result-contract.test.ts`, `tests/structure/result-fixtures.test.ts`, `tests/structure/cli-edge-seam.test.ts`, `tests/structure/state-imports.test.ts`, `tests/structure/state-scope.test.ts`, `tests/checks/error-table-sync.test.ts`, `tests/structure/error-table.test.ts`, `tests/checks/forbidden-literals.test.ts`.

## 3. Coverage Overview

### 3.1 Functional Coverage (F-#, AC-#)

| AC ID | Description | TC ID(s) | Status |
|-------|-------------|----------|--------|
| AC-F1-1 | Exactly one audit record per invocation in any outcome class, carrying runId, command (raw tokens for broken invocations), arguments, exit code, timing, outcome class, `scope`, `repo` (when targeted), `startedAt`, `auditSeq`, and claimed identity when provided; envelope context retained | TC-GH223-001, TC-GH223-002, TC-GH223-003, TC-GH223-004, TC-GH223-005, TC-GH223-008, TC-GH223-009, TC-GH223-010, TC-GH223-022, TC-GH223-035, TC-GH223-036, TC-GH223-039 | Covered |
| AC-F1-2 | Identical re-run appends a second record with a new runId; no deduplication or overwrite; the v1.1 timestamp and ordinal are distinct too | TC-GH223-006, TC-GH223-022, TC-GH223-036 | Covered |
| AC-F1-3 | Malformed audit entry classifies as an existing state identity; pre-existing records remain verified-readable and unchanged; no silent byte drop; explicit salvage preserves the damaged region as evidence; retention forever | TC-GH223-007 | Covered |
| AC-F1-4 | `startedAt` is the invocation's UTC wall-clock start taken from the injected clock (never ambient), recorded exactly once per invocation; a re-run records its own distinct `startedAt` | TC-GH223-035, TC-GH223-036, TC-GH223-041 | Covered |
| AC-F2-1 | Seam-named identity variable present with a non-empty trimmed value → value captured verbatim with the explicit attribution-kind marker `claimed`, recorded as claimed not proven | TC-GH223-011, TC-GH223-013, TC-GH223-022 | Covered |
| AC-F2-2 | Identity variable absent, empty, or whitespace-only → no identity and nothing inferred from user, host, session, or any other signal | TC-GH223-012, TC-GH223-022 | Covered |
| AC-F3-1 | Scripted `--json` success → exactly one minified `{"data":...}` line with no schemaVersion, runId, or timing; audit retains them; process exit code carries status | TC-GH223-014, TC-GH223-015, TC-GH223-022 | Covered |
| AC-F3-2 | Scripted `--json` failure → exactly one minified line carrying the full `error` object plus `runId` as a top-level key; audit retains schemaVersion, runId, timing | TC-GH223-016, TC-GH223-017, TC-GH223-022 | Covered |
| AC-F3-3 | Interactive terminal keeps the full M0-S3 envelope unchanged; documented override forces the full envelope in either mode; pretty flag affects indentation only | TC-GH223-018, TC-GH223-019 | Covered |
| AC-F3-4 | Golden and conformance suites extended to both modes; interactive cases use envelope rules; scripted cases use scripted-projection rules (including top-level runId on failure); every case keeps its golden with no skip path | TC-GH223-020, TC-GH223-021 | Covered |
| AC-F4-1 | Altered record (including recomputed unkeyed checksum) flagged as a chain break naming record position, never payload/checksum bytes; undetectable alteration unachievable within trust model | TC-GH223-024, TC-GH223-025, TC-GH223-033 | Covered |
| AC-F4-2 | Chaining key appears nowhere in lane environment, ledger record payloads, configuration, ambient environment, or any record field; exists only as durable store-managed 0600 key material plus runtime-edge-injected data; earlier-process records verify from a later process with zero false chain-break flags | TC-GH223-026, TC-GH223-037, TC-GH223-038 | Covered |
| AC-F4-3 | After terminal-tail repair or guided salvage, chain verifies continuously over the surviving sequence; reported removal is not a break; next record chains from the last surviving audit record | TC-GH223-027 | Covered |
| AC-F5-1 | Bounded, filtered read returns verified matching records within the bound (exact `scope`/`repo`, `startedAt` time window, command/outcome class), reports truncation in-band, reports skipped `auditSeq` ordinals in-band, refuses missing/invalid bounds or filters with `input.value.rejected`, acquires no fence, writes nothing, classifies torn/unknown without silent zeros, no unbounded dump path | TC-GH223-028, TC-GH223-029, TC-GH223-030, TC-GH223-034, TC-GH223-039, TC-GH223-040, TC-GH223-041, TC-GH223-042 | Covered |
| AC-F6-1 | Edge-registered secret values, including one in command arguments, never appear in any record field on any outcome class; arguments reach the ledger only through the redaction chokepoint; unregistered values are outside the guarantee | TC-GH223-031, TC-GH223-032 | Covered |

Every acceptance criterion has at least one automated case. All 15 ACs (including v1.1's AC-F1-4) are covered.

### 3.2 Interface Coverage (API-#, EVT-#, DM-#)

| Interface ID | Description | TC ID(s) | Status |
|--------------|-------------|----------|--------|
| EVT-1 | Audit invocation record: one additive classified record (`audit.invocation`, schema `delivery.audit.invocation.v1`, key `audit.invocations`) per invocation through the public state port under the shared audit fence, carrying the full v1.1 field set and chain value, never secrets/chaining key/evidence bytes | TC-GH223-001, TC-GH223-002, TC-GH223-003, TC-GH223-004, TC-GH223-005, TC-GH223-006, TC-GH223-007, TC-GH223-008, TC-GH223-022, TC-GH223-035, TC-GH223-036, TC-GH223-039 | Covered |
| DM-1 | Audit invocation record kind and payload schema inside `delivery.state.v1`: kind `audit.invocation`, schema `delivery.audit.invocation.v1`, key `audit.invocations`, with fields `runId`, `command`, `arguments`, `exitCode`, `timing`, `outcomeClass`, `scope`, `repo`, `startedAt`, `auditSeq`, `agentIdentity`, `chainValue`; validated by an artifact boundary with declared kinds, schema identity, required fields, and closed vocabularies | TC-GH223-005, TC-GH223-008, TC-GH223-034, TC-GH223-035, TC-GH223-036 | Covered |
| DM-2 | Chain value covering the previous audit record's chain value and the new record's audited content; verification recomputes over the verified sequence; key never stored in a record | TC-GH223-023, TC-GH223-024, TC-GH223-025, TC-GH223-026, TC-GH223-027, TC-GH223-037, TC-GH223-038 | Covered |
| DM-3 | Claimed identity field: verbatim seam-named variable value plus the explicit `claimed` attribution-kind marker when the trimmed value is non-empty; absent, empty, and whitespace-only are absent; attribution only | TC-GH223-011, TC-GH223-012, TC-GH223-013, TC-GH223-022 | Covered |
| DM-4 | Stream-capability mode fact injected at the runtime-aware edge and consumed by the mode contract; part of golden-fixture injected facts | TC-GH223-018, TC-GH223-019, TC-GH223-020 | Covered |
| DM-5 | Durable store-managed chaining-key artifact: generated once at the runtime edge on the store's first audit append, persisted through the public port with 0600 permissions, verified on open, read by every later process; never exported to configuration, ambient environment, lane environments, or record payloads | TC-GH223-026, TC-GH223-037, TC-GH223-038 | Covered |

### 3.3 Non-Functional Coverage (NFR-#)

| NFR ID | Requirement | TC ID(s) | Status |
|--------|-------------|----------|--------|
| NFR-1 | Exactly one record per invocation across all outcome classes; 0 missing, 0 duplicates; re-runs distinguished by runId; failed-append omissions detectable via the audit-sequence ordinal | TC-GH223-001, TC-GH223-002, TC-GH223-003, TC-GH223-004, TC-GH223-006, TC-GH223-009, TC-GH223-010, TC-GH223-022, TC-GH223-035, TC-GH223-036, TC-GH223-039 | Covered |
| NFR-2 | Edge-registered secret values never appear in any record field on any outcome class; unregistered values are outside the guarantee | TC-GH223-031, TC-GH223-032 | Covered |
| NFR-3 | 100% of alteration mutations flagged as chain breaks naming position; 0 false verified verdicts; 0 false chain-break flags on cross-process verification of unaltered history | TC-GH223-023, TC-GH223-024, TC-GH223-025, TC-GH223-027, TC-GH223-038 | Covered |
| NFR-4 | Chaining key never enters lane environments, ledger record payloads, configuration, ambient environment, or any record field; durable key material spans processes without false flags | TC-GH223-026, TC-GH223-037, TC-GH223-038 | Covered |
| NFR-5 | Identity captured verbatim when present (non-empty after trimming); 0 inferred identities; 0 empty-valued identity fields when absent, empty, or whitespace-only | TC-GH223-011, TC-GH223-012, TC-GH223-013, TC-GH223-022 | Covered |
| NFR-6 | Scripted success lines carry exactly `data`; scripted failure lines carry `error` with full fields plus top-level `runId`; exactly one line per invocation; interactive envelopes byte-conform | TC-GH223-014, TC-GH223-015, TC-GH223-016, TC-GH223-017, TC-GH223-018, TC-GH223-019, TC-GH223-020, TC-GH223-021, TC-GH223-022 | Covered |
| NFR-7 | Every read query honors its declared bound, reports truncation in-band, and refuses missing/invalid bounds or filters; 0 unbounded dump paths | TC-GH223-028, TC-GH223-029, TC-GH223-030, TC-GH223-040, TC-GH223-041, TC-GH223-042 | Covered |
| NFR-8 | Malformed entries classify without silent loss; salvage preserves; retention forever; no prune/delete/compaction path | TC-GH223-007, TC-GH223-027 | Covered |
| NFR-9 | Contracts runtime-neutral; audit consumer composes the public state port only; state tier never imports branding; no new runtime-API location or driver discriminant; error-table sync untouched | TC-GH223-008, TC-GH223-013, TC-GH223-033, TC-GH223-034 | Covered |


## 4. Test Types and Layers

All cases are automated `bun:test` suites under `tests/**/*.test.ts`; no case is manual. The repository maps `packages/**` changes to `bun test tests/structure tests/behaviour`, the boundary suite, golden suites, and `pnpm typecheck`; the audit ledger touches all of those layers.

- **Pure unit tier** — runtime-neutral modules driven directly with in-memory values and byte strings: audit record assembly from a normalized invocation fact (including `startedAt` conversion and `auditSeq` assignment), payload validation against the exact `delivery.audit.invocation.v1` vocabulary, chain-link computation and verification over a record sequence, filter matching (scope/repo/time window), bound/truncation arithmetic, skipped-ordinal detection, and the scripted-projection validator. No filesystem, no CLI.
- **Integration tier (in-process surface + temp store)** — `runCli` with buffer streams, injected clock/run-id/environment/mode/secrets and an audit write port built over a real temporary state directory with the production node edge wrapped by `createTestEdge`. This is where exactly-one semantics, timestamp/ordinal capture, identity capture, trim rendering against the ledger, chain verification, durable key creation/reuse, cross-edge verification, salvage continuity, read-surface behaviour including time-window/repo filters and skipped-ordinal findings, and audit-write failure are exercised. Cross-process continuity is modeled by reopening the same temp store with a fresh store/edge instance.
- **Golden tier** — `tests/golden/**` byte-for-byte cases, now carrying a mode fact and an audit store per run. Interactive cases retain the existing M0-S3 goldens as interactive cases; scripted cases add per-outcome-class goldens, with failure lines carrying top-level `runId`. Every discovered case requires its golden; there is no skip or auto-accept path.
- **Structure / contract / boundary tier** — `tests/structure/**`, `tests/checks/**`, `tests/boundaries/**`: exact audit-kind/schema/key declarations, tier imports, absence of a CLI audit command, absence of an unbounded dump export, key-artifact permissions and exclusion, no ambient clock/environment reads, and error-table non-drift.
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
| TC-GH223-005 | Audit record field set, exact vocabulary, scope/repo, and boundary schema | Happy Path | Unit + Integration | Automated | Critical | AC-F1-1, AC-F1-4 |
| TC-GH223-006 | Identical re-run appends a second record distinguished by runId, startedAt, and auditSeq | Happy Path | Integration | Automated | Critical | AC-F1-2, AC-F1-4 |
| TC-GH223-007 | Malformed audit entry is classified, preserved, and salvaged without data loss | Edge Case | Integration | Automated | Critical | AC-F1-3 |
| TC-GH223-008 | Audit records are an additive kind (`audit.invocation`) within `delivery.state.v1` and interleave safely | Edge Case | Contract + Integration | Automated | High | AC-F1-1 |
| TC-GH223-009 | Generic audit-write fault degrades loudly without changing the command outcome | Negative | Integration | Automated | Critical | AC-F1-1 |
| TC-GH223-010 | Shared-fence contention and exhaustion audit-write failures leave the outcome unchanged with no partial record | Negative | Integration | Automated | Critical | AC-F1-1 |
| TC-GH223-011 | Identity present is recorded verbatim with the explicit `claimed` marker | Happy Path | Integration | Automated | High | AC-F2-1 |
| TC-GH223-012 | Identity absent, empty, or whitespace-only is never inferred | Edge Case | Integration | Automated | High | AC-F2-2 |
| TC-GH223-013 | Identity variable is seam-named, trimmed for presence, and read as injected edge data | Contract | Structure + Check | Automated | High | AC-F2-1, AC-F2-2 |
| TC-GH223-014 | Scripted success renders one minified `{"data":...}` line without trimmed context | Happy Path | Integration + Golden | Automated | Critical | AC-F3-1 |
| TC-GH223-015 | Scripted void success renders `{"data":{}}` exactly | Edge Case | Integration + Golden | Automated | High | AC-F3-1 |
| TC-GH223-016 | Scripted classified failure renders one minified line with top-level runId and full error fields | Negative | Integration + Golden | Automated | Critical | AC-F3-2 |
| TC-GH223-017 | Scripted unknown and broken-invocation failures follow the same top-level-runId projection | Negative | Integration + Golden | Automated | High | AC-F3-2 |
| TC-GH223-018 | Interactive mode keeps the full M0-S3 envelope byte-for-byte | Regression | Integration + Golden | Automated | Critical | AC-F3-3 |
| TC-GH223-019 | `--verbose` forces the full envelope; `--pretty` affects indentation only; stream line discipline | Edge Case | Integration | Automated | High | AC-F3-3 |
| TC-GH223-020 | Golden suites cover both modes with no case without a golden and no skip path | Contract | Golden + Structure | Automated | Critical | AC-F3-4 |
| TC-GH223-021 | Conformance validator enforces scripted-projection rules (error + top-level runId) with negative controls | Contract | Unit + Structure | Automated | High | AC-F3-4 |
| TC-GH223-022 | SC-M1-23: scripted invocation is audited and trimmed end-to-end | Happy Path | Integration | Automated | Critical | AC-F1-1, AC-F1-2, AC-F1-4, AC-F2-1, AC-F2-2, AC-F3-1, AC-F3-2, AC-F6-1 |
| TC-GH223-023 | Clean chain verifies; interleaved non-audit kinds neither break nor participate; auditSeq is monotonic | Happy Path | Unit + Integration | Automated | Critical | AC-F1-1, AC-F4-1 |
| TC-GH223-024 | Altered record with recomputed unkeyed checksum is flagged with position | Negative | Integration | Automated | Critical | AC-F4-1 |
| TC-GH223-025 | Mutation matrix: every alteration is flagged; no false verified verdicts | Negative | Integration | Automated | Critical | AC-F4-1 |
| TC-GH223-026 | Chaining key never enters lane environment, record payloads, config, or ambient env | Negative | Integration + Check | Automated | Critical | AC-F4-2 |
| TC-GH223-027 | Salvage and terminal-tail repair keep chain continuity; reported removals are not breaks | Corner Case | Integration | Automated | Critical | AC-F4-3 |
| TC-GH223-028 | Bounded reads with scope/repo/time-window filters return verified matches and report truncation in-band | Happy Path | Integration | Automated | High | AC-F5-1 |
| TC-GH223-029 | No unbounded dump path exists through the read surface | Negative | Structure | Automated | Critical | AC-F5-1 |
| TC-GH223-030 | Read surface classifies torn/unknown without silent zeros and writes nothing | Negative | Integration | Automated | Critical | AC-F5-1 |
| TC-GH223-031 | Edge-registered secrets in arguments never reach any audit record field | Negative | Integration | Automated | Critical | AC-F6-1 |
| TC-GH223-032 | Record content passes the single redaction chokepoint; no secondary serialization path | Negative | Integration + Structure | Automated | Critical | AC-F6-1 |
| TC-GH223-033 | No new error-table rows; sync passes; chain breaks and ordinal gaps are evidence not codes | Contract | Contract + Check | Automated | High | AC-F4-1, NFR-9 |
| TC-GH223-034 | Tier and boundary conformance; audit read is library-only; exact audit vocabulary | Contract | Structure + Boundary | Automated | High | AC-F5-1, NFR-9 |
| TC-GH223-035 | `startedAt` is the injected clock's UTC start, recorded exactly once and never ambient | Happy Path | Unit + Integration | Automated | Critical | AC-F1-4 |
| TC-GH223-036 | Re-run records a distinct `startedAt` and an advanced `auditSeq` | Happy Path | Integration | Automated | Critical | AC-F1-2, AC-F1-4 |
| TC-GH223-037 | Durable chaining-key artifact is created once, persisted 0600, verified on open, and never exported | Happy Path | Integration + Check | Automated | Critical | AC-F4-2 |
| TC-GH223-038 | Cross-process chain verification has zero false chain-break flags | Happy Path | Integration | Automated | Critical | AC-F4-2 |
| TC-GH223-039 | Failed append leaves a skipped `auditSeq` reported in-band while the command outcome is unchanged | Negative | Integration | Automated | Critical | AC-F1-1, AC-F5-1 |
| TC-GH223-040 | Missing or invalid bound/filter refuses with `input.value.rejected` | Negative | Integration + Contract | Automated | High | AC-F5-1 |
| TC-GH223-041 | `startedAt` time-window filter returns only records inside the window | Happy Path | Integration | Automated | High | AC-F1-4, AC-F5-1 |
| TC-GH223-042 | Exact scope/repo filter semantics with repo-null exclusion | Edge Case | Integration | Automated | High | AC-F5-1 |

### 5.2 Scenario Details

#### TC-GH223-001 - Success and void success append exactly one full audit record

**Scenario Type**: Happy Path
**Impact Level**: Critical
**Priority**: Critical
**Related IDs**: F-1, F-6, AC-F1-1, AC-F1-4, EVT-1, DM-1, NFR-1
**Test Type(s)**: Integration
**Automation Level**: Automated
**Target Layer / Location**: `tests/behaviour/audit-ledger.test.ts` (new); `tests/fixtures/state/harness.ts` (extend with audit-store helpers)
**Tags**: @backend, @audit, @state, @cli

**Preconditions**:

- A temp audit store opened through the public state port with `createTestEdge`.
- A synthetic command program whose handler returns `{ data: { message: "all good", count: 2 } }`.
- A void-success program returning `{ data: {} }` (the repository's explicit empty-success form).
- Each invocation uses its own injected clock start tick (`1000`, `2000`, `3000`), run ids `run-gh223-0001`..`run-gh223-0003`, synthetic brand, no secrets.

**Steps**:

1. Run the data command with `--json` through `runCli` with buffer streams and the audit deps.
2. Run the void-success command with `--json` in a second invocation with run id `run-gh223-0002`.
3. Run the data command in text mode (no `--json`) with run id `run-gh223-0003`.
4. Read the store's verified records and filter the `audit.invocation` kind.
5. For each run, inspect the record: runId, command, arguments, exit code, timing, outcome class, `scope`, `repo`, `startedAt`, `auditSeq`, identity presence, and chain presence.

**Expected Outcome**:

- Each of the three invocations produced exactly one audit record; no invocation produced zero or two.
- The success records carry runId, the resolved command name, the full argv arguments, exit code `0`, `timing.totalMs` equal to the tick delta, outcome class `success`, the store/workspace `scope`, `startedAt` equal to the invocation's start tick as a UTC instant, an `auditSeq` of `1`, `2`, `3` in invocation order, and the envelope's schemaVersion (retained as context).
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

- Each classified failure produces exactly one record, carrying the failure's exit code and the projected outcome class (`user-validation` for the user failure, `platform-provider` for the platform failure), plus the v1.1 `startedAt` and `auditSeq` fields.
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
- The record still carries runId, command, timing, exit code, `scope`, `startedAt`, and `auditSeq`.

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
- The record carries the invocation failure's exit code, outcome class, timing, `scope`, `startedAt`, `auditSeq`, and runId.
- Redaction still applies to the raw tokens (verified separately in TC-GH223-031).

---

#### TC-GH223-005 - Audit record field set, scope/repo, and boundary schema

**Scenario Type**: Happy Path
**Impact Level**: Critical
**Priority**: Critical
**Related IDs**: F-1, F-6, AC-F1-1, AC-F1-4, EVT-1, DM-1, NFR-1, NFR-9
**Test Type(s)**: Unit, Integration
**Automation Level**: Automated
**Target Layer / Location**: `tests/behaviour/audit-ledger.test.ts` (unit assembly) and `tests/structure/audit-contract.test.ts` (new, declaration shape)
**Tags**: @backend, @audit, @contract, @state

**Preconditions**:

- The delivered audit vocabulary exposed as runtime-neutral data: kind `audit.invocation`, payload schema `delivery.audit.invocation.v1`, store-scoped key `audit.invocations`, and payload fields `runId`, `command`, `arguments`, `exitCode`, `timing`, `outcomeClass`, `scope`, `repo`, `startedAt`, `auditSeq`, `agentIdentity`, `chainValue`.
- A store identity with a workspace `scope` and a synthetic `repo` target.
- A synthetic command that declares a repository target; injected clock start tick `5000`.

**Steps**:

1. Assemble a record from a normalized invocation fact in a pure unit case; assert the field set and closed vocabularies against the delivered declaration.
2. Write the record through the artifact boundary in an integration case; assert it is admitted under the `audit.invocation` kind and `delivery.audit.invocation.v1` schema.
3. Read it back and assert every required field is present and exact, including `scope`, `repo`, `startedAt`, and `auditSeq`.
4. Attempt writes with a missing required field, an undeclared outcome-class value, a wrong schema identity, and a `repo` of the wrong type.

**Expected Outcome**:

- The record carries the exact field set: `runId`, `command`/raw tokens, redacted `arguments`, `exitCode`, `timing`, `outcomeClass`, `scope`, `repo` when targeted, `startedAt` (the injected start tick as a UTC instant), `auditSeq` (monotonic per-store ordinal), `agentIdentity` when present, and `chainValue`.
- The record kind is `audit.invocation`, its payload schema is `delivery.audit.invocation.v1`, and it is stored under the `audit.invocations` key.
- Envelope context fields (schemaVersion, runId, exitCode, timing) are retained in the record.
- The artifact boundary refuses the nonconforming writes as `state.store.unknown` with consequence `not_landed`; nothing lands and no field is defaulted.
- `scope` and `repo` are copied from the injected facts exactly; they are never derived from the host or ambient environment. `repo` is absent (not null/empty) when the command has no target.

---

#### TC-GH223-006 - Identical re-run appends a second record distinguished by runId, startedAt, and auditSeq

**Scenario Type**: Happy Path
**Impact Level**: Critical
**Priority**: Critical
**Related IDs**: F-1, AC-F1-2, AC-F1-4, EVT-1, NFR-1
**Test Type(s)**: Integration
**Automation Level**: Automated
**Target Layer / Location**: `tests/behaviour/audit-ledger.test.ts`
**Tags**: @backend, @audit, @idempotency

**Preconditions**:

- A temp audit store.
- The same command and argv run twice with distinct run ids (`run-gh223-0101`, `run-gh223-0102`) and distinct injected start ticks (`1000`, `2000`).

**Steps**:

1. Run the identical invocation twice.
2. Read all audit records.
3. Compare record count, runIds, `startedAt`, `auditSeq`, sequences, and audited content.

**Expected Outcome**:

- Exactly two records exist; neither is deduplicated, updated, or overwritten.
- The records are distinguishable by runId; both carry the same command and argv, but distinct runIds, `startedAt` values (each the corresponding start tick), and `auditSeq` values (`1`, then `2`).
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

- A temp store seeded with three valid audit records (`audit.invocation` / `delivery.audit.invocation.v1`), then three malformed fixtures: (a) a tail entry with broken framing, (b) a tail entry with a failing checksum, (c) an `audit.invocation` entry whose payload violates the audit boundary's declared schema (missing required field or undeclared outcome-class value) appended through the raw store so the state layer frames it cleanly.
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
- The audit record kind `audit.invocation`, payload schema `delivery.audit.invocation.v1`, under the store-scoped key `audit.invocations`.

**Steps**:

1. Open the pre-existing store without migration.
2. Append audit records interleaved with another consumer's records.
3. Read all records and the audit subset.
4. Assert the store schema version is unchanged and the `audit.invocation` kind is additive.
5. Assert `auditSeq` advances `1..N` across the audit records despite the interleaved non-audit kinds.

**Expected Outcome**:

- Existing stores open unchanged; no schema bump, migration, backfill, or reinterpretation occurs.
- Audit records are identifiable as `audit.invocation` under the `audit.invocations` key; other-kind records are untouched.
- Interleaved records do not corrupt either consumer's read; the audit chain ignores non-audit kinds, and `auditSeq` remains monotonic with no gaps.
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
- The failed append's skipped `auditSeq` and the read-surface finding are asserted by TC-GH223-039; this case stays focused on the generic-fault degradation and outcome independence.

---

#### TC-GH223-010 - Shared-fence contention and exhaustion audit-write failures leave the outcome unchanged with no partial record

**Scenario Type**: Negative
**Impact Level**: Critical
**Priority**: Critical
**Related IDs**: F-1, AC-F1-1, AC-F5-1, NFR-1; DEC-8
**Test Type(s)**: Integration
**Automation Level**: Automated
**Target Layer / Location**: `tests/behaviour/audit-write-failure.test.ts`
**Tags**: @backend, @audit, @state, @degradation, @fault-injection

**Preconditions**:

- Two fault fixtures: (a) the single shared audit fence is held by another token/store instance so the audit append cannot acquire it (`state.lock.busy`); (b) the edge is armed with `armExhaustion(["append-before-flush"])` so the append raises the distinguishable exhaustion failure (`state.storage.exhausted`).
- A synthetic success command with a known exit code, run three times (before, during, after the fault).

**Steps**:

1. Run invocation 1 successfully; record its `auditSeq`.
2. In fixture (a), hold the shared audit fence, run invocation 2, assert the outcome and diagnostics, then release.
3. In fixture (b), arm exhaustion, run invocation 2, assert the outcome and diagnostics, then disarm.
4. Run invocation 3 successfully in each fixture.
5. Snapshot the ledger before and after each failed attempt; read verified records and the audit ordinals.

**Expected Outcome**:

- In both cases the command still succeeds with exit code `0` and its normal `data` line; the audit failure never changes the command's outcome.
- The diagnostics carry the classified state identity (`state.lock.busy`, `state.storage.exhausted`) loudly, with no payload or checksum bytes.
- The ledger is byte-identical before and after the failed append; no partial frame exists.
- Exactly-once holds only for invocations whose audit write succeeds; the degraded invocation is explicitly recorded as zero records, not as a fabricated record.
- Invocation 3's `auditSeq` skips the failed invocation's ordinal, proving the omission; the verified read reports the skipped ordinal in-band (the full read-surface assertion is TC-GH223-039).

**Notes / Clarifications**:

- One shared fence serializes the whole audit domain (F-1/OQ-11); a per-key fence model is not tested. The fence-contention case uses a second store instance holding the shared fence, not a handler-held per-key fence.
- The "failed attempt consumes an ordinal" behavior depends on the durable `auditSeq` allocation noted in §8.3 (NEW-GAP-1); if the spec's allocation mechanism is pinned differently, this case is revised with it.

---

#### TC-GH223-011 - Identity present is recorded verbatim with the explicit `claimed` marker

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
- The delivered `agentIdentity` shape carrying the verbatim value plus the explicit attribution-kind marker `claimed`.
- A synthetic success command, run once with the identity and once without it for comparison.

**Steps**:

1. Run the command with the identity-bearing environment injected through the edge.
2. Read the audit record.
3. Compare the recorded value with the injected value exactly.
4. Assert the `agentIdentity` field carries the `claimed` marker and no `verified`, `authenticated`, or provenance-upgraded marker; assert no value is derived from user, host, or session.
5. Run the same command without the identity and assert the outcome, exit code, and scope are unchanged.

**Expected Outcome**:

- The record carries the exact injected value, byte-for-byte; no trimming, casing, or slugging alters the recorded claim.
- The `agentIdentity` field carries the explicit attribution-kind marker `claimed`, so the value is always distinguishable from a future proven identity; no `verified` or `authenticated` marker is present.
- Identity does not alter the command outcome, exit code, or scope; the with-identity and without-identity runs match on those facts.
- The record still verifies within the chain.

**Notes / Clarifications**:

- OQ-T7 is resolved in spec v1.1: the record uses `agentIdentity` with the explicit `claimed` marker. The test asserts the marker and rejects any verification marker.

---

#### TC-GH223-012 - Identity absent, empty, or whitespace-only is never inferred

**Scenario Type**: Edge Case
**Impact Level**: Important
**Priority**: High
**Related IDs**: F-2, AC-F2-2, DM-3, NFR-5
**Test Type(s)**: Integration
**Automation Level**: Automated
**Target Layer / Location**: `tests/behaviour/audit-identity.test.ts`
**Tags**: @backend, @audit, @identity, @privacy

**Preconditions**:

- Three environments: (a) identity variable absent; (b) identity variable present but an empty string; (c) identity variable present but whitespace-only.
- An injected user/home/host/session fact set that would make inference possible if the implementation tried (`USER=operator`, hostname, `SESSION_ID`, `PWD`).

**Steps**:

1. Run the command under each environment.
2. Read each audit record.
3. Assert no `agentIdentity` field is present and no identity-like value appears anywhere in the record.
4. Compare the three records' non-identity fields to confirm the rest of the record is unaffected.

**Expected Outcome**:

- Absent, empty, and whitespace-only all count as absent: the record carries no identity and nothing is inferred from user, host, session, working directory, or any other signal.
- No empty-valued or whitespace-valued `agentIdentity` field is recorded.
- The rest of the record (runId, command, arguments, exit code, timing, outcome class, `scope`/`repo`, `startedAt`, `auditSeq`, chain) is complete and identical in shape across the three cases.

**Notes / Clarifications**:

- OQ-T10 is resolved in spec v1.1: trimming is used only for the presence decision; absent, empty, and whitespace-only are absent, and no empty-valued identity is recorded.

---

#### TC-GH223-013 - Identity variable is seam-named, trimmed for presence, and read as injected edge data

**Scenario Type**: Contract
**Impact Level**: Important
**Priority**: High
**Related IDs**: F-2, AC-F2-1, AC-F2-2, NFR-5, NFR-9; DEC-3
**Test Type(s)**: Contract, Structure, Check
**Automation Level**: Automated
**Target Layer / Location**: `tests/structure/audit-contract.test.ts` (new); `tests/structure/cli-edge-seam.test.ts` (existing — update); `tests/checks/forbidden-literals.test.ts` (existing — guard)
**Tags**: @backend, @audit, @branding, @structure

**Preconditions**:

- The branding seam's derived `environmentPrefix` for the synthetic brand.
- The delivered identity-variable suffix constant exported from the audit/contracts surface.
- The delivered `agentIdentity` vocabulary with the `claimed` attribution-kind marker.

**Steps**:

1. Assert the identity variable name equals `environmentPrefix` plus the declared suffix; no product token is hardcoded.
2. Assert the CLI and state source trees contain no ambient `process.env`/`Bun.env` read; the identity arrives through the injected environment record at the edge.
3. Assert the presence decision trims only for presence (empty and whitespace-only are absent) while the recorded present value is unmodified; assert the `agentIdentity` vocabulary uses the `claimed` marker.
4. Assert the state tier does not import branding (naming is resolved at the edge, not in the store).
5. Run the forbidden-literal scan over the changed source and fixtures.

**Expected Outcome**:

- The variable name is derived, not literal; changing the brand prefix changes the variable name.
- No ambient environment read exists in `packages/cli/src` or `packages/core/src/state`; the temp-copy mutation controls in the existing seam test still fail by file and line.
- The identity value is passed as data into the audit write path; no ambient probe occurs inside the surface or state tier; trimming never alters the recorded claim.
- The `claimed` marker is the only attribution kind; no verified/authenticated vocabulary exists.
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
- The audit record for the same run carries the trimmed fields (schemaVersion, runId, timing, exit code), the v1.1 `startedAt`/`auditSeq` fields, and the invocation facts; the result `data` payload is not required in the record, and the runId correlates the line to the record.
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

#### TC-GH223-016 - Scripted classified failure renders one minified line with top-level runId and full error fields

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
2. Assert stdout is exactly one line and parses as an object whose top-level key set is exactly `error` and `runId`.
3. Assert the `error` object contains `code`, `category`, `retryable`, `consequence`, and `remediationHint`, and does not contain a nested `runId`.
4. Assert the top-level `runId` is a non-empty string equal to the audit record's runId; assert the line contains no `schemaVersion`, `exitCode`, or `timing`.
5. Compare the error fields with the error-table entry and assert the run's exit code matches the projection.

**Expected Outcome**:

- One minified line per invocation with top-level keys `error` and `runId`, byte-identical to its golden.
- Full error-table fields are preserved in `error`, and `runId` is a top-level correlation key that agents can extract without descending into the error object.
- The trimmed context fields are absent from the line and retained in the audit record.
- The exit code remains the machine-readable status projection.

**Notes / Clarifications**:

- OQ-T1 is resolved in spec v1.1: `runId` is a top-level key of the minified error line, beside the `error` object. The test rejects a nested `runId` and a missing top-level `runId`.

---

#### TC-GH223-017 - Scripted unknown and broken-invocation failures follow the same top-level-runId projection

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
2. Assert one line, exact top-level key set `error` + `runId`, full error fields inside `error`, and the top-level runId.
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
- New scripted-projection rules: exactly one line; success has exactly `data`; failure has exactly `error` + top-level `runId`; the `error` object keeps the full error-table fields and carries no nested `runId`; trimmed tokens absent.

**Steps**:

1. Validate a conforming scripted success line and a conforming scripted failure line (top-level `error` + `runId`): zero violations.
2. Feed negative controls: two lines, pretty-indented JSON, success with `schemaVersion`/`runId`/`timing`/`exitCode`, success with a top-level `runId`, failure without a top-level runId, failure with `runId` nested only inside `error`, failure with a missing error field, failure with a top-level `runId` but no `error`, `data` and `error` together, an empty line.
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
**Related IDs**: F-1, F-2, F-3, F-6, AC-F1-1, AC-F1-2, AC-F1-4, AC-F2-1, AC-F2-2, AC-F3-1, AC-F3-2, AC-F6-1, NFR-1, NFR-2, NFR-5, NFR-6; SC-M1-23
**Test Type(s)**: Integration
**Automation Level**: Automated
**Target Layer / Location**: `tests/behaviour/audit-scenario-m1-23.test.ts` (new); `tests/fixtures/result/programs/lanes-list.json` (new stand-in program)
**Tags**: @backend, @audit, @cli, @seeded-scenario, @end-to-end

**Preconditions**:

- A stand-in command program `lanes list --json` (the real `lanes` command ships in a later M1 story; the program stands in for it, per the GH-222 stand-in precedent).
- A declared lane shell environment carrying the seam-named identity variable with a role+lane value (e.g., `pm-lane-7`) and no chaining key.
- A temp audit store, scripted mode fact, injected clock/run-id, and a planted edge-registered secret passed as an argument value.

**Steps**:

1. Run `lanes list --json` through the in-process surface with the lane environment.
2. Assert stdout is one minified `{"data":...}` line without schemaVersion, runId, or timing, and the exit code is `0`.
3. Read the audit records; assert exactly one, with runId, command, redacted args, exit, timing, `startedAt`, `auditSeq`, and `agentIdentity` with the `claimed` marker.
4. Re-run the identical invocation with a new run id and a later start tick; assert a second record with a new runId, a distinct `startedAt`, and the next `auditSeq`.
5. Run a failing variant and assert the error line has top-level `runId` and full error fields.
6. Run a variant without the identity variable, and separately with an empty/whitespace-only value; assert the record carries no identity and no inference.
7. Search every record and the machine output for the planted edge-registered secret values.

**Expected Outcome**:

- Exactly one audit record per invocation; the trimmed fields live only in the record.
- Identity is captured verbatim with the `claimed` marker when present; absent, empty, and whitespace-only are absent and never inferred.
- Re-run yields a second record with a new runId, distinct `startedAt`, and a later `auditSeq`; no deduplication.
- Failure lines keep `runId` as a top-level correlation key.
- No edge-registered secret appears in any record field or on the machine channel.
- The case reads as the seeded scenario's Given/When/Then and cites SC-M1-23 in its describe/title text.

---

#### TC-GH223-023 - Clean chain verifies; interleaved non-audit kinds neither break nor participate; auditSeq is monotonic

**Scenario Type**: Happy Path
**Impact Level**: Critical
**Priority**: Critical
**Related IDs**: F-1, F-4, AC-F1-1, AC-F4-1, DM-2, NFR-1, NFR-3
**Test Type(s)**: Unit, Integration
**Automation Level**: Automated
**Target Layer / Location**: `tests/behaviour/audit-chain.test.ts` (new)
**Tags**: @backend, @audit, @chain, @state

**Preconditions**:

- A deterministic in-memory key fixture for the pure unit half; the integration half uses the store's generated durable key artifact.
- A temp store with audit records interleaved with records of another kind; all audit appends go through the shared audit fence.
- A pure in-memory sequence fixture for the unit half.

**Steps**:

1. Append five audit records with other-kind records between them; assert `auditSeq` values `1..5`.
2. Verify the chain; assert a verified verdict with the record count and no breaks.
3. Recompute expected links with the independent oracle defined for the algorithm pinned at delivery (or, if the algorithm stays behind an opaque helper, assert the behavioural properties: determinism, key sensitivity, previous-link sensitivity, and content sensitivity).
4. Repeat with a fresh store whose first record is an audit record, and with a store that already has other-kind records; assert the first audit record anchors correctly in both.
5. Append a sixth audit record after the interleaved tail; assert its `auditSeq` is `6` and it chains from the fifth audit record, not from the intervening kind.

**Expected Outcome**:

- The clean chain verifies with zero breaks over the audit-record subsequence in ledger order.
- Interleaved non-audit kinds neither break nor participate; their content is not covered by the audit chain.
- The first audit record anchors the chain on any store, including a store with pre-existing other-kind records.
- `auditSeq` is monotonic `1..6` across the audit records despite the interleaved kinds.
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

#### TC-GH223-026 - Chaining key never enters lane environment, record payloads, configuration, or ambient env

**Scenario Type**: Negative
**Impact Level**: Critical
**Priority**: Critical
**Related IDs**: F-4, AC-F4-2, DM-2, DM-5, NFR-4; RSK-3
**Test Type(s)**: Integration, Check
**Automation Level**: Automated
**Target Layer / Location**: `tests/behaviour/audit-key-exclusion.test.ts` (new); `tests/fixtures/audit/lane-environment.json` (new)
**Tags**: @backend, @audit, @chain, @security, @key-exclusion

**Preconditions**:

- A declared lane environment fixture carrying only its declared variables (including the identity variable) and explicitly not the chaining key.
- A temp store populated with audit records under the generated durable key artifact.
- The delivered key-artifact path/name constant and a helper to read the artifact in the test (single-user trust model).

**Steps**:

1. Inspect the lane environment fixture and the configuration/ambient-environment surfaces; assert the key's name and value are absent.
2. Read the key artifact via the delivered helper; assert it is non-empty and that the key value is the one used by verification.
3. Read the raw ledger bytes and walk every audit record's JSON; assert no field equals or contains the key value (including obvious hex/base64 encodings).
4. Assert the rendered/reported surfaces produced by this story (diagnostics, evidence, read views) contain no key value.
5. Assert the key exists only in the store-managed artifact and the runtime-edge-injected data, not in any record, configuration value, or environment map.

**Expected Outcome**:

- The chaining key appears nowhere in the lane environment, ledger record payloads, configuration, ambient environment, any record field, or any lane-visible surface rendered by this story.
- Verification succeeds using the store-managed key, proving the key was actually used rather than absent.
- Two negative controls: planting the key value in a temp copy of a record is detected by the exclusion search (proving the search is non-vacuous); replacing the key artifact with a different key makes verification fail (proving key sensitivity).

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
- The next audit record chains from the last surviving audit record and carries an `auditSeq` greater than the last surviving record's ordinal. Whether a salvage-removed ordinal also appears as an in-band gap finding is pinned by NEW-GAP-4; the chain-continuity assertion here does not depend on it.
- The alteration control still breaks, proving the continuity path does not suppress real breaks.
- Retention/evidence discipline holds: no payload or checksum bytes in break or salvage evidence.

---

#### TC-GH223-028 - Bounded reads with scope/repo/time-window filters return verified matches and report truncation in-band

**Scenario Type**: Happy Path
**Impact Level**: Important
**Priority**: High
**Related IDs**: F-5, AC-F5-1, NFR-7
**Test Type(s)**: Integration
**Automation Level**: Automated
**Target Layer / Location**: `tests/behaviour/audit-read.test.ts` (new)
**Tags**: @backend, @audit, @read-surface, @bounds

**Preconditions**:

- A temp audit store with at least ten audit records spanning several commands, all three outcome classes, two `scope` values, and a mix of `repo` values including repo-absent records, plus interleaved non-audit records.
- Each record carries a distinct `startedAt`; the fixture uses a known set of start ticks (for example `1000`, `2000`, `3000`, `4000`).
- A read-surface fixture declaring filters and a bound.

**Steps**:

1. Query by the store's recorded `scope` (match) and by a deliberately different scope (no match); assert only matching audit records return, all verified.
2. Query by command and by outcome class; assert exact match sets and no non-audit records.
3. Query with a `startedAt` time window that contains some records and excludes others; assert only records inside the window return.
4. Query with a bound smaller than the match count; assert the result is clipped to the bound and reports truncation in-band with the returned count and an indication that more matches exist.
5. Query with a bound larger than the match count; assert no truncation flag.
6. Snapshot the ledger and store directory before and after each query; assert no fence was acquired and nothing was written.

**Expected Outcome**:

- Results contain verified records only, matching every declared filter (`scope`, `startedAt` window, command, outcome class); non-audit kinds and non-matching records never leak in.
- The `startedAt` time-window filter returns exactly the records whose timestamp falls inside the declared window.
- Truncation is reported in-band whenever the bound clips; it is never silently applied.
- Reads acquire no fence, write nothing, and leave the ledger and directory byte-identical.
- The returned evidence names counts and positions only.

**Notes / Clarifications**:

- OQ-T5 is resolved in spec v1.1: the record carries `startedAt` and the time-window filter operates on it. OQ-T11 is resolved: `scope`/`repo` match exactly; repo-absent records are excluded only from repo-constrained results.
- The window-boundary inclusivity rule and the exact `startedAt` encoding are pinned at delivery (NEW-GAP-3); this case uses interior windows that avoid the boundary. TC-GH223-041 covers the time window in depth and TC-GH223-042 covers scope/repo exactness; TC-GH223-040 covers missing/invalid refusal.
- The store's derived index is current before each query, so "writes nothing" is asserted against a no-rebuild read; a rebuild-on-read is a deviation (TR-12).

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
- An unknown-payload fixture: an `audit.invocation` record whose payload violates the delivered `delivery.audit.invocation.v1` schema declaration.
- A verified-empty store.

**Steps**:

1. Query each fixture through the read surface, including one query with a `scope`/`repo` filter and a bound.
2. Assert the failure identity and evidence for torn and unknown.
3. Assert no empty list, zero count, or defaulted value is returned as a success; assert filters do not mask the classification into an empty match set.
4. Read the verified-empty store and assert an explicit verified-empty verdict, distinct from torn and unknown.
5. Snapshot ledger bytes before and after each read.

**Expected Outcome**:

- Torn and unknown conditions are classified with the existing state identities, store path, and position; no silent zeros.
- Filters do not mask torn/unknown classification: a filtered query on a torn store fails classified rather than returning an empty result.
- Verified-empty is distinct from both and is explicitly marked.
- Reads write nothing and never trigger repair or salvage.
- Evidence carries paths/positions/counts only.

---

#### TC-GH223-031 - Edge-registered secrets in arguments never reach any audit record field

**Scenario Type**: Negative
**Impact Level**: Critical
**Priority**: Critical
**Related IDs**: F-6, F-1, AC-F6-1, NFR-2
**Test Type(s)**: Integration
**Automation Level**: Automated
**Target Layer / Location**: `tests/behaviour/audit-redaction.test.ts` (new); `tests/golden/redaction.test.ts` (existing — extend scripted mode)
**Tags**: @backend, @audit, @redaction, @security, @privacy

**Preconditions**:

- Two edge-registered secret values (obviously fake tokens), one passed as an argument value and one embedded inside a longer argument string.
- A command program that succeeds, one that fails classified, and one broken-invocation fixture, each carrying a registered secret in argv.
- An unregistered canary value that looks secret-shaped but is not registered at the edge, used to prove the guarantee's boundary.
- Secrets registered at the edge through the existing secret registration seam.

**Steps**:

1. Run each fixture.
2. Read every audit record and serialize each record's JSON.
3. Search for each edge-registered secret value and for obvious encodings.
4. Assert the arguments are present with `[redacted]` substitutions where the edge-registered secrets occurred, and that the unregistered canary remains verbatim (the guarantee is scoped to edge-registered values).
5. Assert the machine output and diagnostics are also secret-free.

**Expected Outcome**:

- No edge-registered secret value appears in any field of any audit record, on success, failure, or broken invocation.
- Arguments reach the ledger only through the redaction chokepoint; the redaction marker is present where secrets occurred.
- Unregistered values are not claimed as redacted (the guarantee stays scoped to the non-empty, unique values registered at the edge).
- The machine channel and diagnostics remain secret-free.

**Notes / Clarifications**:

- OQ-T9 is resolved in spec v1.1: "no secret patterns" means no edge-registered secret value survives into any record field. No broader pattern scan is invented.

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
- An identity value that is itself an edge-registered secret (an edge case proving all record fields are redacted, not only arguments).

**Steps**:

1. Assert structurally that audit record content is passed through the same redaction function before persistence; no second sanitizer or raw serializer writes record payloads.
2. Run a command whose identity value and one argument are edge-registered secrets.
3. Read the record and assert both are redacted.
4. Assert the chokepoint remains the only stream-write site and the only record-content sanitizer; mutation control adds a second raw writer and fails.

**Expected Outcome**:

- Record content is redacted by the single chokepoint; identity and arguments are both covered when edge-registered.
- No secondary serialization/redaction path is introduced for audit writes.
- The existing single-write-site invariant still holds.
- Mutation control proves the structural guard is non-vacuous.

---

#### TC-GH223-033 - No new error-table rows; sync passes; chain breaks and ordinal gaps are evidence not codes

**Scenario Type**: Contract
**Impact Level**: Important
**Priority**: High
**Related IDs**: F-4, AC-F4-1, AC-F5-1, NFR-9; DEC-7, OQ-2
**Test Type(s)**: Contract, Check
**Automation Level**: Automated
**Target Layer / Location**: `tests/checks/error-table-sync.test.ts` (existing — no change expected); `tests/structure/error-table.test.ts` (existing — no change expected); `tests/behaviour/audit-chain.test.ts` (verdict shape)
**Tags**: @contract, @error-table, @audit, @chain

**Preconditions**:

- The machine and documented error tables at the change base.
- The audit chain verification verdict type and the read-surface gap/refusal verdict types.

**Steps**:

1. Run the bidirectional error-table sync check and assert zero drift.
2. Assert the error table contains no audit-, chain-, or ordinal-gap-domain identities and no audit-specific rows; audit failures resolve only to the existing state identities or the existing `input.value.rejected` row for read-surface refusals.
3. Assert every audit/state failure raised by the audit path uses an existing identity (`state.store.torn`, `state.store.unknown`, `state.lock.busy`, `state.storage.exhausted`, `state.write.failed`, `state.permission.denied`), and read-surface refusals use `input.value.rejected`.
4. Assert a chain break is surfaced as a verification verdict/evidence with remediation guidance, not as an `AppErrorCode` table lookup; assert a skipped `auditSeq` is an in-band read-surface finding, not an error code.
5. Mutation control: drop or add a row in a temp copy and assert the sync check fails.

**Expected Outcome**:

- The tables remain in bidirectional sync with zero drift; no audit-, chain-, or ordinal-gap-domain identities are introduced.
- Chain breaks, record gaps, and skipped-ordinal findings are read-surface verdicts/evidence; read-surface refusals reuse `input.value.rejected`.
- Every audit-path state failure reuses an existing state identity.
- The mutation control proves the sync check is non-vacuous for the touched surface.

---

#### TC-GH223-034 - Tier and boundary conformance; audit read is library-only; exact audit vocabulary

**Scenario Type**: Contract
**Impact Level**: Important
**Priority**: High
**Related IDs**: F-5, AC-F5-1, NFR-9, DM-1, DM-5; DEC-5, DEC-6; NG-3
**Test Type(s)**: Structure, Boundary
**Automation Level**: Automated
**Target Layer / Location**: `tests/structure/audit-contract.test.ts` (new), `tests/structure/audit-imports.test.ts` (new), `tests/structure/audit-surface.test.ts` (new); `tests/boundaries` when any import edge changes
**Tags**: @structure, @boundary, @audit, @architecture

**Preconditions**:

- The delivered audit modules, contracts, state modules, CLI command registry, and key-artifact module.

**Steps**:

1. Assert the audit record/chain vocabulary lives in runtime-neutral contracts (types/data only; no I/O, clock, randomness, or environment access).
2. Assert the audit consumer imports the public state port and its own modules only; no driver module, no runtime-API location, no driver discriminant. The key artifact is persisted through the public port, not through a new runtime API.
3. Assert `packages/core/src/state/**` does not import branding; identity naming is resolved at the edge.
4. Assert no audit CLI command is registered in `packages/cli/src/commands/**` and no command name for audit appears in the program registry.
5. Assert the audit identity type does not appear in `packages/core/src/contracts/credentials.ts`, the config resolver, or any policy/authorization module; it is confined to audit record and read types. Assert the chaining-key type is confined to the state/edge modules and is not exported through the runtime-neutral contracts.
6. Run `bun test tests/boundaries` if any package/subpath edge changed.

**Expected Outcome**:

- Contracts stay runtime-neutral; the audit consumer composes only the public state port; the state tier stays branding-free.
- No new runtime-API location, driver discriminant, or CLI audit command exists; the key artifact uses the existing port.
- The identity vocabulary is not wired into authorization/credential paths; the chaining-key type stays out of contracts.
- Boundary rules and fixture coverage remain green.

---

#### TC-GH223-035 - `startedAt` is the injected clock's UTC start, recorded exactly once and never ambient

**Scenario Type**: Happy Path
**Impact Level**: Critical
**Priority**: Critical
**Related IDs**: F-1, AC-F1-1, AC-F1-4, DM-1, NFR-1
**Test Type(s)**: Unit, Integration
**Automation Level**: Automated
**Target Layer / Location**: `tests/behaviour/audit-timestamp.test.ts` (new); `tests/structure/audit-contract.test.ts` (ambient-clock scan)
**Tags**: @backend, @audit, @timestamp, @clock

**Preconditions**:

- A temp audit store with the production edge wrapped by `createTestEdge` and an injected clock whose start tick is `1000` and finish tick is `1013`.
- A synthetic success command.
- A pure record-assembly fixture carrying `startedAtMs: 1000`.
- The delivered `startedAt` encoding helper/constant.

**Steps**:

1. Run the command through `runCli`; read the audit record.
2. Assert the record has exactly one `startedAt` field.
3. Assert `startedAt` denotes the injected start tick (`1000` ms since epoch) as a UTC instant, and that `timing.totalMs` is `13` (the separate timing value).
4. Re-read the record and assert `startedAt` is stable.
5. Scan the audit assembly/write modules for ambient clock reads (`Date.now`, `new Date()` without the injected value, `performance.now`); assert none; the value comes from the injected clock.
6. Mutation control: a temp-copy module using `Date.now()` is detected by the scan.

**Expected Outcome**:

- `startedAt` is the invocation's start instant from the injected clock, expressed in UTC, recorded exactly once.
- It is the start tick, not the finish tick; `timing` continues to use both ticks.
- No ambient clock read exists in the audit path; the injected clock is the only source.
- Re-reads return the same `startedAt`.

**Notes / Clarifications**:

- The spec pins the instant semantics (UTC start from the injected clock), not the exact serialization. The test compares the parsed instant with the injected tick and requires a UTC encoding; the concrete encoding is pinned at delivery (NEW-GAP-3).

---

#### TC-GH223-036 - Re-run records a distinct `startedAt` and an advanced `auditSeq`

**Scenario Type**: Happy Path
**Impact Level**: Critical
**Priority**: Critical
**Related IDs**: F-1, AC-F1-2, AC-F1-4, NFR-1
**Test Type(s)**: Integration
**Automation Level**: Automated
**Target Layer / Location**: `tests/behaviour/audit-timestamp.test.ts`
**Tags**: @backend, @audit, @timestamp, @idempotency

**Preconditions**:

- A temp audit store.
- The same command and argv run twice with distinct run ids (`run-gh223-0201`, `run-gh223-0202`) and distinct injected start ticks (`1000`, `2000`).

**Steps**:

1. Run the identical invocation twice.
2. Read both audit records.
3. Assert each record's `startedAt` equals its own start tick as a UTC instant.
4. Assert the two `startedAt` values are distinct and the two `auditSeq` values are `1` and `2`.
5. Assert the runIds are distinct and neither record overwrote the other.

**Expected Outcome**:

- The re-run records its own distinct `startedAt`; no timestamp is reused or defaulted.
- `auditSeq` advances monotonically (`1`, then `2`) and remains gap-free when both appends succeed.
- The records remain distinguishable by runId and are not deduplicated.

**Notes / Clarifications**:

- The failed-append case (where an ordinal is skipped) is TC-GH223-039 and depends on NEW-GAP-1's durable allocation.

---

#### TC-GH223-037 - Durable chaining-key artifact is created once, persisted 0600, verified on open, and never exported

**Scenario Type**: Happy Path
**Impact Level**: Critical
**Priority**: Critical
**Related IDs**: F-4, AC-F4-2, DM-5, NFR-4; RSK-3
**Test Type(s)**: Integration, Check
**Automation Level**: Automated
**Target Layer / Location**: `tests/behaviour/audit-key-artifact.test.ts` (new); `tests/fixtures/state/harness.ts` (key-artifact helpers)
**Tags**: @backend, @audit, @chain, @security, @key-artifact

**Preconditions**:

- A POSIX temp store with no prior audit append.
- The delivered key-artifact path/name constant and read helper.
- A synthetic success command.

**Steps**:

1. Run one invocation; assert exactly one key artifact exists, it is non-empty, and its file mode is `0600` (directory `0700`).
2. Read the artifact bytes; run a second invocation; assert the artifact bytes and modification identity are unchanged (the key was created once, not regenerated).
3. Open a second store/edge instance over the same temp root; verify the audit chain; assert verification succeeds with the same artifact.
4. Walk every record payload, the configuration snapshot, the ambient environment map, and the lane environment fixture; assert the key value and obvious encodings are absent.
5. Negative controls: a copy with a different key artifact makes verification fail; a copy with the artifact removed exercises the delivered "verified on open" failure behavior (pinned by NEW-GAP-2).

**Expected Outcome**:

- The key artifact is created once on the store's first audit append and persisted through the public port under least-privilege permissions (`0600` file / `0700` directory).
- Later appends and later store/edge instances reuse the same artifact; the key is never regenerated.
- The key never appears in record payloads, configuration, ambient environment, or lane environment.
- Verification succeeds across the reopened store/edge; a different key fails.

**Notes / Clarifications**:

- "Verified on open" is specified as a requirement but the missing/corrupt-artifact failure mode is not pinned (NEW-GAP-2). This case asserts creation, permissions, reuse, and the successful verification path; the failure-mode assertion is added when the spec pins it.

---

#### TC-GH223-038 - Cross-process chain verification has zero false chain-break flags

**Scenario Type**: Happy Path
**Impact Level**: Critical
**Priority**: Critical
**Related IDs**: F-4, AC-F4-2, DM-5, NFR-3, NFR-4
**Test Type(s)**: Integration
**Automation Level**: Automated
**Target Layer / Location**: `tests/behaviour/audit-chain-cross-process.test.ts` (new)
**Tags**: @backend, @audit, @chain, @cross-process

**Preconditions**:

- A temp store written by edge/store instance A (three audit records).
- Fresh edge/store instances B and C over the same temp root (cross-process modeled without spawning).
- The store-managed key artifact from A.

**Steps**:

1. Write three audit records with instance A; close/dispose A.
2. Open instance B; verify the chain over A's records; assert zero breaks and zero false chain-break flags.
3. Append a fourth audit record with B; assert it chains from A's third record and carries `auditSeq` 4.
4. Open instance C; verify all four records; assert zero breaks.
5. Negative control: a copy whose key artifact is replaced with a different key fails verification; the unmodified store still passes.

**Expected Outcome**:

- Records written by an earlier instance verify from a later instance with zero false chain-break flags.
- The durable key artifact is reused, not regenerated; the chain is continuous across the instance boundary.
- A different key fails verification (key sensitivity), proving the cross-instance pass is not vacuous.
- No process is spawned; the case exercises the durable artifact and fresh store/edge instances.

**Notes / Clarifications**:

- This is the v1.1 cross-process continuity case required by AC-F4-2/Appendix B. It uses fresh store/edge instances over the same temp root, consistent with the repository's no-spawn rule.

---

#### TC-GH223-039 - Failed append leaves a skipped `auditSeq` reported in-band while the command outcome is unchanged

**Scenario Type**: Negative
**Impact Level**: Critical
**Priority**: Critical
**Related IDs**: F-1, F-5, AC-F1-1, AC-F5-1, NFR-1; DEC-8
**Test Type(s)**: Integration
**Automation Level**: Automated
**Target Layer / Location**: `tests/behaviour/audit-ordinal-gap.test.ts` (new)
**Tags**: @backend, @audit, @ordinal, @degradation

**Preconditions**:

- A temp audit store and a synthetic success command.
- Three sequential invocations: invocation 1 succeeds, invocation 2's audit append is armed with a generic fault at `append-before-flush`, invocation 3 succeeds.
- The delivered `auditSeq` allocation behavior (see NEW-GAP-1).

**Steps**:

1. Run invocation 1; read the record; assert `auditSeq` is `1`.
2. Arm the generic append fault; run invocation 2; assert the command still succeeds with exit code `0`, its `data` line is emitted, the diagnostics carry `state.write.failed`, and no audit record landed.
3. Disarm; run invocation 3; read the records.
4. Assert the audit ordinals are `1` and `3` — ordinal `2` is skipped — and invocation 3's record is otherwise complete.
5. Query the read surface; assert an in-band finding names the skipped ordinal `2`, and that no error-table row/code is introduced.
6. Assert the read acquires no fence and writes nothing.

**Expected Outcome**:

- The failed append leaves no partial record and does not change the command's outcome or exit code.
- The next successful append carries a later ordinal (`3`), proving the omission.
- The verified read reports the skipped ordinal `2` in-band; the finding is evidence, not an error-table identity.
- Exactly-once holds for invocations whose audit write succeeds; the degraded invocation is explicitly absent.

**Notes / Clarifications**:

- **Blocking dependency:** the mechanism by which a failed append consumes an ordinal is not specified. If the ordinal is derived from the last verified record, no gap appears and this case cannot pass. NEW-GAP-1 requires the spec to pin a durable ordinal allocation (for example a store-managed counter artifact advanced inside the shared fence before the write) or to revise DEC-8. This case fails loudly until that is pinned; it is not silently relaxed.

---

#### TC-GH223-040 - Missing or invalid bound/filter refuses with `input.value.rejected`

**Scenario Type**: Negative
**Impact Level**: Critical
**Priority**: High
**Related IDs**: F-5, AC-F5-1, NFR-7; DEC-7
**Test Type(s)**: Integration, Contract
**Automation Level**: Automated
**Target Layer / Location**: `tests/behaviour/audit-read-refusal.test.ts` (new)
**Tags**: @backend, @audit, @read-surface, @validation

**Preconditions**:

- A temp audit store with several audit records.
- The existing `input.value.rejected` error-table entry.

**Steps**:

1. Query with the bound omitted.
2. Query with each clearly invalid bound: a negative number, a non-integer, a non-number. Probe bound `0` separately and record whether the delivered validator refuses it or treats it as an empty bound.
3. Query with each invalid filter: an unknown outcome class, a malformed/absent `startedAt` window, a window whose start is after its end, a non-string `scope`/`repo`.
4. Assert each refusal is classified `input.value.rejected` (user/validation identity) and matches the existing table entry; no records are returned.
5. Assert no fence is acquired, nothing is written, and no new error-table row exists.
6. Negative control: an equivalent valid query succeeds, proving the refusal is specific.

**Expected Outcome**:

- Missing or invalid bounds and filter values are refused with the existing `input.value.rejected` identity — no new table row, no silent unbounded result.
- Negative, non-integer, and non-number bounds refuse; bound `0` either refuses or returns an explicit empty result, never the full ledger.
- Refusals return no records and write nothing.
- A valid query with the same filters/bound succeeds, proving the validator is not vacuous.

**Notes / Clarifications**:

- OQ-T3 is resolved in spec v1.1: `input.value.rejected` is the refusal identity. The exact validation boundary (which malformed values are rejected, including whether bound `0` is invalid) is pinned at delivery; the cases above are the enumerated obvious classes and the 0 probe records the delivered rule.

---

#### TC-GH223-041 - `startedAt` time-window filter returns only records inside the window

**Scenario Type**: Happy Path
**Impact Level**: Important
**Priority**: High
**Related IDs**: F-5, AC-F1-4, AC-F5-1, NFR-7
**Test Type(s)**: Integration
**Automation Level**: Automated
**Target Layer / Location**: `tests/behaviour/audit-read-time-window.test.ts` (new)
**Tags**: @backend, @audit, @read-surface, @time-window

**Preconditions**:

- A temp store with audit records whose `startedAt` values are `1000`, `2000`, `3000`, and `4000` ms, plus interleaved non-audit records.
- A read-surface fixture declaring a `startedAt` window and a bound.

**Steps**:

1. Query the window `[1500, 3500]`; assert only the `2000` and `3000` records return.
2. Query `[0, 500]` and `[4500, 5000]`; assert each returns an explicit verified-empty result, not an error or a silent zero.
3. Query with the window plus a `scope` filter and a bound; assert the filters compose and truncation is reported in-band.
4. Record the delivered boundary rule for records exactly on a window edge (inclusive/exclusive); use interior windows for the core assertions and one boundary probe.

**Expected Outcome**:

- The time-window filter operates on `startedAt` and returns exactly the records inside the window.
- Empty windows return verified-empty, not torn/unknown and not an error.
- The window composes with `scope` and the bound; truncation stays in-band.
- The boundary rule is recorded and applied consistently.

**Notes / Clarifications**:

- Boundary inclusivity and the exact `startedAt` encoding are not pinned (NEW-GAP-3); the core assertions use interior windows, and one boundary probe records the delivered rule.

---

#### TC-GH223-042 - Exact scope/repo filter semantics with repo-null exclusion

**Scenario Type**: Edge Case
**Impact Level**: Important
**Priority**: High
**Related IDs**: F-5, AC-F5-1, NFR-7
**Test Type(s)**: Integration
**Automation Level**: Automated
**Target Layer / Location**: `tests/behaviour/audit-read.test.ts`
**Tags**: @backend, @audit, @read-surface, @filters

**Preconditions**:

- A temp store with four audit records: (A, repo R1), (A, repo absent), (B, repo R2), (A, repo R2).
- Exact-match filter fixture values.

**Steps**:

1. Query `scope = A`; assert A/R1, A/absent, and A/R2 return; B is excluded.
2. Query `scope = A, repo = R1`; assert only A/R1 returns; A/absent and A/R2 are excluded.
3. Query `repo = R2` without a scope; assert A/R2 and B/R2 return; repo-absent records are excluded.
4. Query `scope = a` (different case) and `repo = R` (prefix); assert exact comparison returns no records.
5. Query unfiltered (with a bound); assert repo-absent records remain reachable.

**Expected Outcome**:

- `scope` and `repo` match by exact comparison; case and prefix near-matches do not match.
- Repo-absent records are excluded only from repo-constrained results and remain reachable through unfiltered or scope-constrained queries.
- The filter results are verified audit records only; no non-audit kinds leak in.

**Notes / Clarifications**:

- OQ-T11 is resolved in spec v1.1: exact-match semantics with repo-null exclusion from repo-constrained results only.

---

### 5.3 Seeded Scenario Inheritance (SC-M1-23)

The milestone pack's SC-M1-23 ("every invocation audited; scripted output trimmed") is the seeded scenario for M1-S22 and is inherited, not restated as a new scenario id. Its Given/When/Then maps to TC-GH223-022, which is the end-to-end case (scripted `lanes list --json` through a lane shell carrying the identity convention; exactly one audit record with runId, command, redacted args, exit, timing, `startedAt`, `auditSeq`, and `agentIdentity`; one minified `{"data":...}` line; the failure line keeps `runId` as a top-level key; identity present with the `claimed` marker and absent-never-inferred; re-run yields a second record with a new runId and distinct timestamp/ordinal; no edge-registered secret in the record). The scenario's assertion families are extended by the rest of this plan:

| SC-M1-23 assertion family | Inheriting / extending TCs |
|---------------------------|----------------------------|
| Exactly one audit record per invocation | TC-GH223-001, TC-GH223-002, TC-GH223-003, TC-GH223-004, TC-GH223-022 |
| Record carries runId, command, redacted args, exit, timing, `startedAt`, `auditSeq`, identity | TC-GH223-005, TC-GH223-011, TC-GH223-022, TC-GH223-035, TC-GH223-036 |
| Scripted success is one minified `{"data":...}` line without schemaVersion/runId/timing | TC-GH223-014, TC-GH223-015, TC-GH223-022 |
| Error line keeps runId as a top-level key | TC-GH223-016, TC-GH223-017, TC-GH223-022 |
| Identity captured when present with the `claimed` marker | TC-GH223-011, TC-GH223-013, TC-GH223-022 |
| Absent, empty, and whitespace-only identity are never inferred | TC-GH223-012, TC-GH223-022 |
| Re-run produces a second record with a new runId, distinct `startedAt`, and later `auditSeq` | TC-GH223-006, TC-GH223-022, TC-GH223-036 |
| No edge-registered secret patterns in the record | TC-GH223-031, TC-GH223-032, TC-GH223-022 |
| Extensions beyond the seeded text: all outcome classes, interactive/override modes, golden/conformance both modes, durable key/cross-process continuity, ordinal-gap detection, salvage continuity, bounded reads with time-window/scope/repo/refusal | TC-GH223-007..010, TC-GH223-018..021, TC-GH223-023..034, TC-GH223-037..042 |

Rules honored here:

- The scenario id `SC-M1-23` is stable and cited verbatim in the test titles/describes of TC-GH223-022.
- Divergence after delivery is a defect, not a test-plan choice. The stand-in `lanes list` program is the only substitution; it exists because the real command ships later, and it preserves the scenario's shape (`lanes list --json` through an agent shell).
- The seeded scenario's "no secret patterns" wording is resolved by OQ-T9: tests assert no edge-registered secret value survives into any record field; a broader pattern scan is not invented.

## 6. Environments and Test Data

- **Runtime**: Bun pinned by `.bun-version`; `bun test` (or `pnpm test`) for `tests/**/*.test.ts`. No external services, no network, no process spawning, no real process streams.
- **Directories**: every audit store lives under a per-test `mkdtempSync` root labelled with the `gh223-` prefix; teardown removes it recursively. No test writes the repository tree, the user state directory, or the live ledger.
- **State fixtures**: `tests/fixtures/state/harness.ts` supplies `createTestEdge` (`arm`, `armExhaustion`, `disarm`, `raised`, mutable clock), `makeIdentity`, `openStore`, `withinFence`, `ledgerPath`, `ledgerText`, `ledgerLines`, `ledgerBytes`, `ledgerDigest`, `independentChecksum`, `digestPaths`, `listStoreFiles`, `quarantineDirectory`, `quarantineFiles`, `salvageTail`. v1.1 adds audit helpers: `makeAuditStore`, `seedAuditRecords`, `auditRecordsOf`, `auditOrdinals`, `mutateAuditRecord`, `tamperWithRecomputedChecksum`, `assertNoChainBreak`, `keyArtifactPath`, `readKeyArtifact`, `keyArtifactMode`, `reopenStore`, and `chainVerdict` (names fixed at delivery).
- **CLI fixtures**: `tests/golden/helpers.ts` supplies `runCase`, `runDescriptor`, `bufferSink`, `programFor`, `loadProgram`, `SYNTHETIC_BRAND`. This change extends the injected fact type with `mode` (interactive/scripted), `environment` (string map), and `startTicks`/`startedAt` fixtures; each golden run creates its own temp audit store, and the store generates its own key artifact, so no fixture directory is a live store and no key is committed.
- **New audit fixtures**: `tests/fixtures/audit/cases.json` (outcome/identity/time-window/scope/repo/bounds matrix), `tests/fixtures/audit/mutations.json` (declarative tamper matrix), and `tests/fixtures/audit/lane-environment.json` (declared lane variables only). A second unit-only key fixture may live in `tests/fixtures/audit/chain-keys.json` for the pure chain half; integration cases read the store-generated artifact. Fixtures are never named `*.test.ts`.
- **Golden fixtures**: existing `tests/fixtures/result/envelopes/**` cases gain `mode` in `injected.json`/`meta.json` and remain interactive goldens. New scripted cases: `scripted-success-data`, `scripted-success-void`, `scripted-classified-user`, `scripted-classified-platform`, `scripted-unknown-failure`, `scripted-broken-unknown-command`, `scripted-broken-unknown-flag`, `scripted-broken-missing-value`, `scripted-broken-conflicting-flags`. Scripted failure goldens carry the top-level key set `{"error":..., "runId":...}`. Every case keeps a `stdout.json`; no case may be skipped.
- **Stand-in program**: `tests/fixtures/result/programs/lanes-list.json` models `lanes list --json` for SC-M1-23; it returns a deterministic data payload and declares no real `lanes` behaviour.
- **Identity variable**: name = `SYNTHETIC_BRAND.environmentPrefix` + the delivered suffix constant; values are obviously fake (`pm-lane-7`, `qa-lane-3`) and never derived from the host. The record stores `agentIdentity` as the verbatim value plus the `claimed` marker; absent, empty, and whitespace-only environments are separate fixtures.
- **Chaining key**: durable store-managed key material generated at the runtime edge on the first audit append and persisted as a `0600` artifact; it is not injected from configuration or the environment. Tests read the artifact through the delivered helper (single-user trust model). A second, different key artifact is used for the negative control; no real key is committed.
- **Secrets**: obviously fake edge-registered tokens matching the `planted-fake-` prefix; registered at the edge through the existing secret-registration seam. An unregistered canary is included to prove the guarantee's boundary. No real credentials or user data.
- **Fault injection**: only named `StateEdgeFaultPoint` values. `append-before-flush` is used with generic `arm` (write failure) and `armExhaustion` (storage exhaustion); shared-fence contention is produced by holding the audit fence from a second store instance; salvage/repair use the existing operations. Tests assert both the resulting outcome and that the intended point was raised, so a typo fails loudly rather than passing vacuously.
- **Platform**: permission assertions (including the key artifact's `0600` and the state directory's `0700`) remain POSIX-only with the existing platform conditional; no Linux run claims Windows ACL verification.
- **Isolation**: each case gets a fresh store, clock, run-id factory, environment record, and generated key artifact; mutation-style structural checks copy into a temp root before mutating. Cross-process cases reopen the same temp root with a fresh store/edge instance; no process is spawned.

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
| TC-GH223-035 | `tests/behaviour/audit-timestamp.test.ts`, `tests/structure/audit-contract.test.ts` | `bun test tests/behaviour/audit-timestamp.test.ts tests/structure/audit-contract.test.ts` | New |
| TC-GH223-036 | `tests/behaviour/audit-timestamp.test.ts` | same | New |
| TC-GH223-037 | `tests/behaviour/audit-key-artifact.test.ts`, `tests/fixtures/state/harness.ts` | `bun test tests/behaviour/audit-key-artifact.test.ts` | New |
| TC-GH223-038 | `tests/behaviour/audit-chain-cross-process.test.ts` | `bun test tests/behaviour/audit-chain-cross-process.test.ts` | New |
| TC-GH223-039 | `tests/behaviour/audit-ordinal-gap.test.ts` | `bun test tests/behaviour/audit-ordinal-gap.test.ts` | New |
| TC-GH223-040 | `tests/behaviour/audit-read-refusal.test.ts`, `tests/checks/error-table-sync.test.ts` | `bun test tests/behaviour/audit-read-refusal.test.ts tests/checks/error-table-sync.test.ts` | New + Existing – No Change |
| TC-GH223-041 | `tests/behaviour/audit-read-time-window.test.ts` | `bun test tests/behaviour/audit-read-time-window.test.ts` | New |
| TC-GH223-042 | `tests/behaviour/audit-read.test.ts` | same | New |

Companion suites touched by new exports, fixtures, or mode metadata but carrying no new case ids:

| Suite | Role |
|-------|------|
| `tests/structure/result-contract.test.ts` | Extend the validator rule bijection for scripted rules (top-level `runId` on failure); keep interactive rules intact. |
| `tests/structure/result-fixtures.test.ts` | Validate the new `mode`/`environment`/`startTicks` metadata and the new scripted fixture cases; keep hygiene checks. |
| `tests/golden/timing.test.ts` | Assert scripted success lines carry no timing and interactive lines still do; audit records still carry `timing` and `startedAt`. |
| `tests/golden/redaction.test.ts` | Run the existing redaction cases in both modes; scripted lines stay secret-free. |
| `tests/golden/envelope-failure.test.ts` | Keep the existing interactive cases byte-identical; scripted failure goldens (with top-level `runId`) live in `tests/golden/envelope-scripted.test.ts`. |
| `tests/structure/envelope-contract.test.ts` | Envelope shape and key set remain the M0-S3 contract; no new keys. |
| `tests/structure/delivery-result-contract.test.ts` | Result contract types remain runtime-neutral; audit vocabulary does not leak into the envelope. |
| `tests/structure/state-contract.test.ts`, `tests/structure/state-imports.test.ts`, `tests/structure/state-scope.test.ts` | New audit state modules and the key-artifact module obey contract-only imports, no branding, no new runtime API. |
| `tests/structure/cli-edge-seam.test.ts` | No ambient environment or clock read; identity/mode/key-generation facts arrive as injected data; single stream-write site unchanged. |
| `tests/checks/error-table-sync.test.ts`, `tests/structure/error-table.test.ts` | No row changes; `input.value.rejected` remains the only refusal identity; sync stays green. |
| `tests/checks/forbidden-literals.test.ts` | New source/docs contain no hardcoded product token. |
| `tests/boundaries` | Run if any package/subpath import edge or `workspaceImports` entry changes. |
| `tests/behaviour/state-torn.test.ts`, `state-salvage.test.ts`, `state-salvage-invariants.test.ts`, `state-index.test.ts`, `state-storage-exhausted.test.ts` | M0-S5/GH-222 regressions; expected to pass unchanged. |

Fixture/corpus updates required (delivery-blocking, no new TC ids):

- `tests/fixtures/result/envelopes/**/injected.json` — add `mode`, `environment` (empty for identity-absent cases), and `startTicks`; do not add a chaining key (the key is store-managed and generated per temp store).
- `tests/fixtures/result/envelopes/**/meta.json` — add `mode` and keep `outcome`; update the fixture-hygiene expectations.
- `tests/fixtures/result/envelope-key-set.json` — add the scripted success key set (`data`) and the scripted failure key set (`error` + `runId`) beside the existing interactive sets.
- `tests/fixtures/result/programs/lanes-list.json` — the SC-M1-23 stand-in.
- `tests/fixtures/state/harness.ts` — audit/key-artifact/ordinal helpers listed in §6.
- `tests/fixtures/audit/**` — cases (including time-window/scope/repo), mutations, lane environment; a unit-only key fixture if needed.
- Goldens are regenerated deliberately with the explicit test command; never by blanket rewrite. Existing interactive goldens must remain byte-identical unless the change intentionally amends them; scripted failure goldens must carry top-level `runId`.

### 7.1 Unit vs Integration Split

- **Pure unit**: the record-assembly field mapping and payload validation half of TC-GH223-005; the `startedAt` conversion half of TC-GH223-035; the chain-link computation and verification half of TC-GH223-023; filter matching (scope/repo/time window), bound/truncation arithmetic, and skipped-ordinal detection in TC-GH223-028, TC-GH223-039, TC-GH223-041, TC-GH223-042; the scripted-projection validator in TC-GH223-021.
- **Integration (in-process `runCli` + temp store)**: TC-GH223-001..004, 006, 007, 009..012, 014..019, 022..028, 030..032, 035..042.
- **Golden**: TC-GH223-014..018, 020 (and the existing cases updated by 016/017).
- **Structure / contract / check / boundary**: TC-GH223-008, 013, 020, 021, 029, 032, 033, 034, 037, 040.

### 7.2 Execution Strategy and Quality Gates

During delivery (fail fast, narrow first):

1. `bun test tests/behaviour/audit-ledger.test.ts tests/behaviour/audit-outcomes.test.ts tests/behaviour/audit-identity.test.ts tests/behaviour/audit-timestamp.test.ts`
2. `bun test tests/behaviour/audit-write-failure.test.ts tests/behaviour/audit-malformed.test.ts tests/behaviour/audit-ordinal-gap.test.ts`
3. `bun test tests/behaviour/scripted-trim.test.ts tests/behaviour/envelope-mode.test.ts tests/golden/envelope-scripted.test.ts`
4. `bun test tests/behaviour/audit-chain.test.ts tests/behaviour/audit-chain-mutations.test.ts tests/behaviour/audit-chain-salvage.test.ts tests/behaviour/audit-key-exclusion.test.ts tests/behaviour/audit-key-artifact.test.ts tests/behaviour/audit-chain-cross-process.test.ts`
5. `bun test tests/behaviour/audit-read.test.ts tests/behaviour/audit-read-refusal.test.ts tests/behaviour/audit-read-time-window.test.ts tests/behaviour/audit-redaction.test.ts tests/behaviour/audit-scenario-m1-23.test.ts`
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
| TR-1 | **`auditSeq` allocation durability is unspecified:** if the ordinal is derived from the last verified record (or kept only in process memory), a failed append may leave no gap or may leave a gap only within one process, and AC-F5-1/NFR-1/DEC-8's per-store skipped-ordinal requirement and TC-GH223-039 cannot be guaranteed | H | NEW-GAP-1: pin a durable per-store ordinal allocation (for example a store-managed counter artifact advanced inside the shared fence before the write) or revise DEC-8. TC-GH223-039 fails loudly until pinned; it is not silently relaxed. |
| TR-2 | The key artifact's "verified on open" failure mode (missing/corrupt artifact) is not specified | M | NEW-GAP-2: TC-GH223-037 asserts creation, `0600`, reuse, and successful verification; the failure-mode assertion is added when the spec pins refuse/regenerate/classify semantics. |
| TR-3 | `startedAt` serialization, time-window boundary inclusivity, and bound-0 semantics are not pinned | M | NEW-GAP-3: TC-GH223-035/040/041 assert instant equality, UTC encoding, interior windows, and the 0 probe; one boundary probe records the delivered rule. |
| TR-4 | A salvage-removed audit record creates an `auditSeq` gap that may be indistinguishable from a failed-append omission | M | NEW-GAP-4: TC-GH223-027 asserts chain continuity and a monotonic next ordinal; the gap-finding distinction is not asserted until pinned. |
| TR-5 | Extending golden injected facts (mode/environment/startTicks) breaks existing byte goldens or the fixture-hygiene checks | M | Default existing cases to interactive and keep their stdout byte-identical; update `result-fixtures.test.ts` deliberately; regenerate goldens only with the explicit command. |
| TR-6 | Chain algorithm drift makes an independent oracle impossible | L | Assert behaviour, not algorithm: same key + sequence verifies, different key fails, altered content fails, forged chain fails. If delivery pins the primitive, add an independent oracle in `tests/fixtures/audit/`; if it stays opaque, keep the behavioural assertions and do not duplicate an unpinned algorithm. |
| TR-7 | Salvage/repair false positives erode trust in chain-break flags | M | TC-GH223-027 exercises both operations, asserts the reported removal is not a break, and includes a genuine alteration control so continuity does not suppress real breaks. |
| TR-8 | Audit payload field names and outcome-class vocabulary churn between plan and delivery | M | Tests bind to the delivered runtime-neutral constants and assert semantic equality with the envelope projection; a field rename changes constants, not assertions. |
| TR-9 | A handler-held shared fence could cause an audit append to fail `state.lock.busy` and be misread as an external contention | M | OQ-T8 is resolved as one shared audit fence; TC-GH223-010's contention case uses a second store instance holding the shared fence, and distinguishes it from a handler-held-fence scenario recorded as a delivery-time clarification. |
| TR-10 | Test isolation failures (shared temp store, ambient env/clock, real streams) create flaky or cross-contaminated results | L | Fresh temp root, clock, run-id factory, environment, and generated key per case; no-spawn guard; structure tests forbid ambient env and clock reads. |
| TR-11 | The redaction chokepoint lives in the CLI serializer, while the audit write persists in the state tier; sharing it could create a second serialization path or a tier violation | H | Redact the invocation fact on the CLI side before handing it to the audit write port; keep one redaction function (shared through a runtime-neutral module only if needed); TC-GH223-032's structure guard forbids a second raw writer, and TC-GH223-034 keeps the state tier branding-free. |
| TR-12 | The state layer's verified read may rebuild the derived index (a write), while F-5/AC-F5-1 says the audit read writes nothing | M | TC-GH223-028/041/042 seed a store whose derived index is current, then assert the ledger and directory are byte-identical across queries. A rebuild-on-read would surface as a deviation, not be waived; the delivery can read the ledger without an index rebuild. |
| TR-13 | The key artifact's persistence path/API is not pinned (public-port document vs a new store-managed artifact write path) | M | NEW-GAP-5: TC-GH223-037 uses the delivered path constant; TC-GH223-034 asserts no new runtime-API location. The delivery pins the artifact write through the existing port. |

### 8.2 Assumptions

- **ASM-1**: M0-S3 (result contract, redaction chokepoint, deterministic in-process surface, golden and conformance tooling) and M0-S5 (state layer: ledger truth, verified reads, fences, classification, salvage, additive kinds, artifact boundaries) are delivered at the change base (spec v1.1 verified at HEAD `94036965`), as the spec assumes.
- **ASM-2**: `CliDependencies`/the runtime edge can be extended with an injected environment record, a stream-capability mode fact, a `startedAt` clock fact, and an audit write port without introducing an ambient read; `tests/structure/cli-edge-seam.test.ts` is updated in the same change to keep the no-ambient-read invariant.
- **ASM-3**: The audit kind is additive within `delivery.state.v1`; no migration, schema bump, or new driver discriminant is required.
- **ASM-4**: The chaining key is durable store-managed key material generated at the runtime edge and persisted as a `0600` artifact; tests read the artifact through the delivered helper (single-user trust model). The algorithm is verified behaviourally, not pinned to a specific primitive.
- **ASM-5**: The golden runner can create a temp audit store per case and extend `injected.json` with mode/environment/startTicks facts while keeping existing interactive goldens byte-identical.
- **ASM-6**: `lanes list` is represented by a stand-in program for SC-M1-23 because the real command ships later; the scenario's id and Given/When/Then shape are preserved (GH-222 stand-in precedent).
- **ASM-7**: Every case runs in process; no process spawning, real streams, real clock, or real state directory. Cross-process key continuity is modeled by reopening the same temp root with fresh store/edge instances.
- **ASM-8**: The error table is unchanged; all audit-path state failures reuse existing state identities, and read-surface refusals reuse `input.value.rejected`.
- **ASM-9**: The declared lane environment is fixture data; this story does not build or render a lane environment (NG-1).
- **ASM-10**: The CLI side redacts the invocation fact (arguments, raw tokens, identity) before handing it to the audit write port; the state tier never imports the CLI serializer. If the redaction function is shared through a runtime-neutral module, it remains the single chokepoint and no second serialization path is introduced.
- **ASM-11**: The injected clock used for `timing` is the same clock that supplies `startedAt`; the runtime edge already carries it.
- **ASM-12**: The audit consumer assigns `auditSeq` from a durable per-store ordinal allocation inside the shared audit fence; the exact allocation mechanism is NEW-GAP-1 and must be pinned before TC-GH223-039 can pass.
- **ASM-13**: The key artifact path/name is exposed as a delivered constant; the test reads it through a helper, not by hardcoding a state-directory layout.
- **ASM-14**: `scope` is the store/workspace scope identity and `repo` is the target repository value or absent; both are exact-match filter operands.

### 8.3 Open Questions

**Resolved by spec v1.1 (no open OQ-T items remain):**

| Test-plan item | Spec resolution | Effect on this plan |
|----------------|-----------------|---------------------|
| OQ-T1 | OQ-4: `runId` is a top-level key of the minified failure line, beside `error` | TC-GH223-016/017/021/022 now assert the top-level key set `error` + `runId` and reject a nested-only runId |
| OQ-T2 | OQ-5: durable store-managed chaining-key artifact (DM-5), generated once on first append, persisted `0600`, read by later processes; per-process key rejected | TC-GH223-026 reworked; TC-GH223-037/038 added; the v1.0 placeholder is removed |
| OQ-T3 | OQ-6: missing/invalid bound or filter refuses with the existing `input.value.rejected` | TC-GH223-028 updated; TC-GH223-040 added |
| OQ-T4 | OQ-7: kind `audit.invocation`, schema `delivery.audit.invocation.v1`, key `audit.invocations`, field names pinned | TC-GH223-005/008/034 updated; exact vocabulary used throughout |
| OQ-T5 | OQ-8: `startedAt` (UTC, injected clock) added; new AC-F1-4; time-window filter operates on it | TC-GH223-035/036/041 added; TC-GH223-028's time-window gap is closed |
| OQ-T6 | OQ-9: DEC-8 narrowed to the audit consumer's `auditSeq`, with skipped ordinals reported as in-band read-surface findings; state port unchanged | TC-GH223-010 reworked; TC-GH223-039 added |
| OQ-T7 | OQ-10: `agentIdentity` carries the verbatim value plus the explicit `claimed` marker | TC-GH223-011/013 updated; the marker is asserted |
| OQ-T8 | OQ-11: one shared fence over the whole audit domain | TC-GH223-010 reworked to the shared-fence model |
| OQ-T9 | OQ-12: "no secret patterns" means no edge-registered secret value per the chokepoint guarantee | TC-GH223-031/032/022 wording updated |
| OQ-T10 | OQ-13: absent, empty, and whitespace-only all count as absent; trimming decides presence only | TC-GH223-012/013 updated to three absent cases |
| OQ-T11 | OQ-14: `scope`/`repo` exact-match semantics; repo-absent records excluded only from repo-constrained results | TC-GH223-028/042 updated |

**New gaps found while reconciling to v1.1:**

| ID | Gap | Blocking? | Owner / resolution path |
|----|-----|-----------|--------------------------|
| NEW-GAP-1 | **`auditSeq` allocation durability is not specified.** "Assigned at append time inside the shared fence" does not say how a failed append still consumes an ordinal, or where the allocation lives. If the ordinal derives from the last verified record, no gap appears. If it is kept only in process memory, a same-process retry can show a gap while a later process reuses the failed ordinal, breaking the per-store guarantee. Either way, AC-F5-1/NFR-1/DEC-8's skipped-ordinal requirement (and TC-GH223-039's cross-process intent) cannot be guaranteed. | **Yes — spec reopening required** | `@pm`/`@spec-writer`: pin a durable per-store ordinal allocation (for example a store-managed counter artifact advanced inside the shared fence before the write, or an equivalent pre-allocation/rollback rule), or revise DEC-8/AC-F5-1/NFR-1. TC-GH223-039 fails loudly until then; it is not silently relaxed. |
| NEW-GAP-2 | The key artifact's "verified on open" failure semantics are not pinned (missing, corrupt, wrong-permission artifact: refuse? regenerate? classify?). | No — happy-path creation/permissions/reuse are testable | Delivery/spec pins the failure behavior; TC-GH223-037 adds the negative assertion then. |
| NEW-GAP-3 | The exact `startedAt` serialization (ISO 8601 string vs epoch number), the time-window boundary inclusivity rule, and whether a bound of `0` is invalid or an empty bound are not pinned. | No — instant equality, interior windows, and the 0 probe are testable | Delivery pins the encoding, boundary rule, and bound-0 semantics; TC-GH223-035/040/041 assert the instant, record the boundary probe, and record the 0 rule. |
| NEW-GAP-4 | A salvage-removed audit record creates an `auditSeq` gap. The spec says a skipped ordinal is "evidence of an omitted or failed append"; it does not say whether a salvage-reported removal is suppressed, annotated, or reported as a gap. | No — chain continuity is testable independently | `@pm`/spec writer or delivery pins the interaction; TC-GH223-027 asserts chain continuity and monotonic ordinal, TC-GH223-039 covers the failed-append gap. |
| NEW-GAP-5 | The key artifact's persistence path/API through the public port is not pinned (derived-document replace vs a store-managed artifact write). | No — tests use a delivered path constant | Delivery pins it while honoring "no new runtime-API location"; TC-GH223-034 guards the tier. |

**Explicit gaps for PM:** the v1.0 blocking gaps (OQ-T5 timestamp, OQ-T6 sequence-gap claim) are resolved by spec v1.1. One new blocking gap remains: **NEW-GAP-1, the durable `auditSeq` allocation mechanism**, without which TC-GH223-039 and the DEC-8 skipped-ordinal guarantee cannot be tested as written. NEW-GAP-2..5 are non-blocking delivery pins. No acceptance criterion is wholly untestable; AC-F1-4 and AC-F5-1 are fully covered once NEW-GAP-1 is pinned.

## 9. Plan Revision Log

| Version | Date | Author | Changes |
|---------|------|--------|---------|
| 1.0 | 2026-11-06 | @test-plan-writer | Initial plan: 34 story-local cases (`TC-GH223-*`) covering the then-current AC set (AC-F1-1..AC-F6-1), EVT-1, DM-1..4, NFR-1..9, and the inherited SC-M1-23 seeded scenario; both output modes, chain tamper-evidence/salvage continuity, bounded reads, and audit-write degradation. Records two spec gaps for PM: OQ-T5 (time-window filter without a timestamp) and OQ-T6 (sequence-gap detection). |
| 1.1 | 2026-11-06 | @test-plan-writer | Reconcile to spec v1.1 (commit `94036965`): add AC-F1-4 and TC-GH223-035..042 (42 cases total, 15 ACs); add `startedAt`/`auditSeq` to the record field set; rework DEC-8 to the shared-fence, skipped-ordinal model (TC-010/039); add durable store-managed key artifact, `0600` permissions, and cross-process verification (TC-037/038); update `runId` to a top-level failure-line key (TC-016/017/021/022); make the time-window filter over `startedAt` real and add `input.value.rejected` refusal (TC-028/040/041); pin the exact vocabulary and exact scope/repo filters (TC-005/008/034/042); update identity to the `claimed` marker and empty/whitespace-absent rules (TC-011/012/013); mark OQ-T1..T11 resolved; record NEW-GAP-1 (blocking `auditSeq` allocation durability) and NEW-GAP-2..5 (non-blocking pins). |

## 10. Test Execution Log

Populated during execution. Each row records the TC id, run date, result, and the command or note that produced it. A skip is recorded with its reason and never counts as a pass.

| TC ID | Run Date | Result | Notes |
|-------|----------|--------|-------|
| — | — | — | Not yet executed (plan reconciled to spec v1.1; 42 cases proposed). |
