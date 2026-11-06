---
id: chg-GH-223-test-plan
status: Updated
created: 2026-11-06
last_updated: 2026-11-06
owners: ["engineering"]
service: delivery-os
labels: ["m1", "audit", "state-layer", "cli"]
version_impact: minor
summary: "Traceable coverage for GH-223 command audit ledger and agent identity (spec v1.4): exactly one audit.invocation record per invocation across every outcome class (reservations are a distinct internal kind and never counted), the reservation-first two-phase append with a durable per-store auditSeq, a three-field reservation payload {auditSeq, runId, chainValue}, a 13-field invocation payload including resultSchemaVersion, both failure modes (orphan reservation vs failed reservation), and a continuous chain over reservation and invocation records, durable store-managed chain-key.<workspace>.json with pinned open-failure identities, UTC epoch-millisecond startedAt with inclusive [from,to] time-window filters and unbounded omitted sides, claimed-identity capture with the explicit claimed marker, owner-pinned scripted-output trim with top-level runId on failure lines, bounded filtered reads with fold-from-ledger orphan findings, redaction-chokepoint hygiene, and classified audit-write degradation that never changes the command outcome."
links:
  change_spec: ./chg-GH-223-spec.md
  implementation_plan: ./chg-GH-223-plan.yaml
  testing_strategy: .ai/rules/testing-strategy.md
---

# Test Plan - M1-S22: Command audit ledger and agent identity

## 1. Scope and Objectives

This plan protects the delivery engine's new history guarantee: every command invocation through the command surface leaves exactly one durable `audit.invocation` record carrying runId, command, redacted arguments, exit code, timing, outcome class, `scope`, `repo`, `startedAt` (integer epoch milliseconds UTC from the injected clock), `auditSeq` (consumed by its durable `audit.reservation`), and claimed identity when present. The reservation-first two-phase append is the mechanism that makes ordinal consumption durable; reservations are a distinct internal kind, never counted as invocation records. The plan also protects the owner-pinned scripted-output amendment (one minified `{"data":...}`/`{"error":...}` line, with `runId` as a top-level key of failure lines), the continuous chain over both audit kinds with a durable `chain-key.<workspace>.json` artifact (including its pinned open-failure identities), the bounded/filtered read surface (inclusive `startedAt` time window, exact scope/repo/command filters, in-band truncation and reservation-orphan findings), and the redaction chokepoint that must guard record content exactly as it guards output streams.

The data and security risks this plan primarily guards are: missing or duplicate invocation records that make history untrustworthy; an ordinal consumed with no durable evidence because the reservation or invocation half failed; unredacted secrets persisted forever; inferred identities presented as if claimed; a trim that silently drops context with no ledger to hold it; a chaining key that is regenerated per process, is missing/corrupt, or false-flags earlier records; a chain that false-flags legitimate salvage or fails to flag a recomputed-checksum edit to either kind; an unbounded dump that exposes every historical command line; and an audit-write failure that either corrupts or misreports the command's own outcome.

Regressions protected: the M0-S3 envelope contract in interactive mode, error-table contents and bidirectional sync, text (non-`--json`) output, the single serialization/redaction chokepoint, the state layer's verified-read, fence, classification, salvage, and evidence discipline, and the no-spawn deterministic in-process test surface.

### 1.1 In Scope

- Exactly-one `audit.invocation` semantics for success, void success, classified failure (user and platform), unknown failure, and broken invocation (unknown command/flag, missing flag value, conflicting flags); reservations are a distinct internal kind and are never counted.
- Reservation-first two-phase append under one shared-fence acquisition: one `audit.reservation` (`delivery.audit.reservation.v1`, payload `{auditSeq, runId, chainValue}`, with no invocation metadata) immediately before one `audit.invocation` (`delivery.audit.invocation.v1`) carrying the same `auditSeq`; ordinal allocation from verified ledger truth (highest reservation ordinal + 1); both failure modes — orphan reservation (gap evidence) and failed reservation (nothing consumed, no gap claimed).
- Full v1.4 invocation field set (13 fields): `runId`, `command`, `arguments`, `exitCode`, `timing`, `resultSchemaVersion`, `outcomeClass`, `scope`, `repo`, `startedAt`, `auditSeq`, `agentIdentity`, `chainValue`; `resultSchemaVersion` carries the rendered envelope's `schemaVersion` value at invocation time (`delivery.result.v1`) and is DISTINCT from the record's own payload schema id `delivery.audit.invocation.v1`; additive composition inside `delivery.state.v1` under the store-scoped key `audit.invocations`.
- `startedAt` as integer epoch milliseconds UTC from the injected clock (the same clock that measures `timing`), recorded exactly once per invocation and distinct on re-runs; never an ambient clock read.
- `auditSeq` as the durable per-store ordinal consumed by its reservation; identical in the reservation and invocation frames; monotonic across interleaved non-audit kinds; in-band reservation-orphan findings after a failed invocation append; no gap when the reservation itself fails.
- Idempotent re-runs producing a second invocation record under a new runId with its own reservation, a distinct `startedAt`, and a later `auditSeq`; no deduplication or overwrite.
- Agent-identity consumption: seam-named environment variable read as injected edge data; presence decided on the trimmed value (absent, empty, and whitespace-only all count as absent); a present value recorded verbatim with the explicit attribution-kind marker `claimed`; claimed-not-proven semantics.
- Scripted-mode trim for success, void success, classified failure, unknown failure, and broken invocation; failure lines carry `runId` as a top-level key and full error-table fields; interactive envelopes remain byte-conformant; `--verbose` full-envelope override; `--pretty` indentation-only; single-line discipline on the current machine channel (the future multi-event `--watch` rule is a forward contract, see §1.2).
- Golden fixtures and testkit conformance validator extended to both modes, preserving the no-case-without-golden rule and the no-skip path; the scripted failure key set is `error` + top-level `runId`.
- Keyed hash chaining over the continuous audit-domain sequence covering BOTH `audit.reservation` and `audit.invocation` records: durable `chain-key.<workspace>.json` created once on the first audit append, `0600`, verified on open, reused across later edges/processes; clean verification, interleaved non-audit kinds, alteration detection for both kinds including recomputed unkeyed checksums, position-naming evidence, key exclusion from ledger record payloads/configuration/ambient environment/lane environments, chain anchoring, and continuity across terminal-tail repair and guided salvage.
- Key-artifact open-failure identities: absent on a non-first open → `state.keys.missing`; corrupt/unparsable → the `state.store.torn` family; wrong permission bits → `state.permission.denied`; no new error-table rows.
- Bounded, filtered read surface: exact-match `scope`, `repo`, and command filters (command matches the recorded token exactly, including raw first tokens for broken invocations; repo-null records excluded from repo-constrained results only), inclusive `[from, to]` `startedAt` time window with an omitted side unbounded, outcome-class filter, explicit bound, in-band truncation, in-band reservation-orphan findings folded from verified ledger truth, `input.value.rejected` refusal for missing/invalid bounds or filters, verified reads, no fence acquisition, no writes, torn/unknown classification without silent zeros.
- Redaction-chokepoint hygiene for record content across all outcome classes, including an edge-registered secret embedded in arguments and in the identity value; unregistered values remain outside the guarantee; reservation payloads carry no arguments/outcome/identity.
- Audit-write failure semantics: classified, loud diagnostics degradation that never changes the command's outcome or exit code; reservation-orphan evidence when the invocation append fails; nothing consumed and no gap claimed when the reservation append fails; no partial frame.
- No new error-table rows and no error-table drift; no new CLI audit command; tier and boundary conformance; no new runtime-API location for the key artifact.

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
- **v1.4 convergence note:** spec v1.2 resolved the five iteration-3 gaps (OQ-15..OQ-19); spec v1.3 resolved MR-1 by adding `chainValue` to the reservation payload (`{auditSeq, runId, chainValue}`); spec v1.4 adds `resultSchemaVersion` as the 13th invocation field and pins exact-match command filtering (OQ-21). No open OQ item remains and no blocking gap remains; see §8.3/§8.4.

## 2. References

- **Change specification (v1.4)**: [chg-GH-223-spec.md](./chg-GH-223-spec.md) — capabilities F-1..F-6, AC-F1-1..AC-F6-1 (15 ACs), NFR-1..NFR-9, EVT-1/EVT-2, DM-1..DM-6, DEC-1..DEC-8, OQ-4..OQ-21 resolutions, Appendix B test-plan handoff.
- **Change PM notes**: [chg-GH-223-pm-notes.yaml](./chg-GH-223-pm-notes.yaml) — scope resolution (consume-only identity), dependency verification, doc-sync obligations.
- **Seeded milestone scenario**: [doc/planning/oss-tooling/milestones/m1/test-scenarios.md](../../../planning/oss-tooling/milestones/m1/test-scenarios.md) — SC-M1-23 (stable id; inherited and extended here).
- **Current system truth — result contract**: [doc/spec/features/feature-result-contract.md](../../../spec/features/feature-result-contract.md) — envelope field contract, exit projection, redaction chokepoint, golden/conformance tooling, containment.
- **Current system truth — state layer**: [doc/spec/features/feature-state-layer.md](../../../spec/features/feature-state-layer.md) — public port, additive kinds, artifact boundaries, verified reads, fences, salvage/repair, evidence model, forever retention.
- **Current system truth — branding seam**: [doc/spec/features/feature-branding-seam.md](../../../spec/features/feature-branding-seam.md) — `environmentPrefix` derivation and forbidden-literal constraints.
- **Testing strategy**: [.ai/rules/testing-strategy.md](../../../../.ai/rules/testing-strategy.md) — layers, module mapping, conventions, quality gates.
- **TypeScript rules**: [.ai/rules/typescript.md](../../../../.ai/rules/typescript.md) — bun:test authoring, workspace boundaries, error contract.
- **State test harness**: `tests/fixtures/state/harness.ts` — `createTestEdge` (`arm`, `armExhaustion`), `makeIdentity`, `openStore`, `withinFence`, `ledgerText`, `ledgerBytes`, `ledgerDigest`, `independentChecksum`, `salvageTail`. v1.2 adds reservation, key-artifact (`chain-key.<workspace>.json`), and audit-ordinal helpers (names fixed at delivery).
- **Result/golden harness**: `tests/golden/helpers.ts`, `packages/testkit/src/result-conformance.ts` — `runCase`, `runDescriptor`, `bufferSink`, `loadGoldenCases`, `assertEnvelopeContract`, `RULES`.
- **Runtime edge and fault points**: `packages/cli/src/edge.ts` (environment facts as data), `packages/cli/src/index.ts` (`CliDependencies`), `packages/core/src/state/edge.ts` (`StateEdgeFaultPoint`).
- **Existing suites to extend or guard**: `tests/golden/envelope-success.test.ts`, `tests/golden/envelope-failure.test.ts`, `tests/golden/broken-command.test.ts`, `tests/golden/redaction.test.ts`, `tests/golden/timing.test.ts`, `tests/structure/result-contract.test.ts`, `tests/structure/result-fixtures.test.ts`, `tests/structure/cli-edge-seam.test.ts`, `tests/structure/state-imports.test.ts`, `tests/structure/state-scope.test.ts`, `tests/checks/error-table-sync.test.ts`, `tests/structure/error-table.test.ts`, `tests/checks/forbidden-literals.test.ts`.

## 3. Coverage Overview

### 3.1 Functional Coverage (F-#, AC-#)

| AC ID | Description | TC ID(s) | Status |
|-------|-------------|----------|--------|
| AC-F1-1 | Exactly one `audit.invocation` record per invocation in any outcome class, carrying runId, command (raw tokens for broken invocations), arguments, exit code, timing, `resultSchemaVersion` (the rendered envelope's `schemaVersion`, distinct from the record payload schema id), outcome class, `scope`, `repo` (when targeted), integer-epoch-ms `startedAt`, the `auditSeq` consumed by its durable reservation, claimed identity when provided, and `chainValue`; reservations are a distinct internal kind and are never counted as invocation records | TC-GH223-001, TC-GH223-002, TC-GH223-003, TC-GH223-004, TC-GH223-005, TC-GH223-008, TC-GH223-009, TC-GH223-010, TC-GH223-022, TC-GH223-035, TC-GH223-036, TC-GH223-039, TC-GH223-043, TC-GH223-044 | Covered |
| AC-F1-2 | Identical re-run appends a second invocation record with a new runId; no deduplication or overwrite; the second run has its own reservation, a distinct `startedAt`, and a later `auditSeq` | TC-GH223-006, TC-GH223-022, TC-GH223-036 | Covered |
| AC-F1-3 | Malformed audit entry classifies as an existing state identity; pre-existing records remain verified-readable and unchanged; no silent byte drop; explicit salvage preserves the damaged region as evidence; retention forever | TC-GH223-007 | Covered |
| AC-F1-4 | `startedAt` is the invocation's integer epoch-millisecond UTC start taken from the injected clock (never ambient), recorded exactly once per invocation; a re-run records its own distinct `startedAt` | TC-GH223-035, TC-GH223-036, TC-GH223-041 | Covered |
| AC-F2-1 | Seam-named identity variable present with a non-empty trimmed value → value captured verbatim with the explicit attribution-kind marker `claimed`, recorded as claimed not proven | TC-GH223-011, TC-GH223-013, TC-GH223-022 | Covered |
| AC-F2-2 | Identity variable absent, empty, or whitespace-only → no identity and nothing inferred from user, host, session, or any other signal | TC-GH223-012, TC-GH223-022 | Covered |
| AC-F3-1 | Scripted `--json` success → exactly one minified `{"data":...}` line with no schemaVersion, runId, or timing; the audit record retains them, with the envelope schemaVersion retained as `resultSchemaVersion`; process exit code carries status | TC-GH223-014, TC-GH223-015, TC-GH223-022 | Covered |
| AC-F3-2 | Scripted `--json` failure → exactly one minified line carrying the full `error` object plus `runId` as a top-level key; the audit record retains schemaVersion (as `resultSchemaVersion`), runId, and timing | TC-GH223-016, TC-GH223-017, TC-GH223-022 | Covered |
| AC-F3-3 | Interactive terminal keeps the full M0-S3 envelope unchanged; documented override forces the full envelope in either mode; pretty flag affects indentation only | TC-GH223-018, TC-GH223-019 | Covered |
| AC-F3-4 | Golden and conformance suites extended to both modes; interactive cases use envelope rules; scripted cases use scripted-projection rules (including top-level runId on failure); every case keeps its golden with no skip path | TC-GH223-020, TC-GH223-021 | Covered |
| AC-F4-1 | Altered audit-domain record (reservation or invocation, including an orphaned reservation edited with a recomputed unkeyed checksum) flagged as a chain break naming record position, never payload/checksum bytes; undetectable alteration unachievable within trust model | TC-GH223-024, TC-GH223-025, TC-GH223-033, TC-GH223-045, TC-GH223-049 | Covered |
| AC-F4-2 | Chaining key appears nowhere in lane environment, ledger record payloads, configuration, ambient environment, or any record field; exists only as durable store-managed `chain-key.<workspace>.json` (`0600`) plus runtime-edge-injected data; earlier-process records verify from a later process with zero false chain-break flags; pinned open failures reuse existing identities | TC-GH223-026, TC-GH223-037, TC-GH223-038, TC-GH223-047 | Covered |
| AC-F4-3 | After terminal-tail repair or guided salvage (byte-contiguous, kind-agnostic removal of trailing invocations AND reservations wholesale), chain verifies continuously over the surviving audit-domain sequence; reported removal is not a break; next record chains from the last surviving one; a last-valid-frame reservation survives as the DEC-8 finding | TC-GH223-027, TC-GH223-048 | Covered |
| AC-F5-1 | Bounded, filtered read returns verified matching records within the bound (exact `scope`/`repo`/command, inclusive `[from, to]` `startedAt` window with unbounded omitted side, outcome class), reports truncation in-band, reports any reservation with no matching invocation as the in-band skipped-ordinal finding, refuses missing/invalid bounds or filters with `input.value.rejected`, acquires no fence, writes nothing, classifies torn/unknown without silent zeros, no unbounded dump path | TC-GH223-028, TC-GH223-029, TC-GH223-030, TC-GH223-034, TC-GH223-039, TC-GH223-040, TC-GH223-041, TC-GH223-042, TC-GH223-043, TC-GH223-046, TC-GH223-050 | Covered |
| AC-F6-1 | Edge-registered secret values, including one in command arguments, never appear in any record field on any outcome class; arguments reach the ledger only through the redaction chokepoint; reservation payloads carry no arguments/outcome/identity; unregistered values are outside the guarantee | TC-GH223-031, TC-GH223-032 | Covered |

Every acceptance criterion has at least one automated case. All 15 ACs (including AC-F1-4) are represented, with v1.2's reservation-orphan, failed-reservation, both-kind chain, rebuild, key-open-failure, and surviving-tail scenarios added. AC-F4-1 is fully covered, including the orphan-reservation alteration case (TC-GH223-049).

### 3.2 Interface Coverage (API-#, EVT-#, DM-#)

| Interface ID | Description | TC ID(s) | Status |
|--------------|-------------|----------|--------|
| EVT-1 | Audit invocation record: `audit.invocation` / `delivery.audit.invocation.v1` under `audit.invocations`, appended second in the reservation-first two-phase append under the shared audit fence; carries the full v1.4 13-field set (including `resultSchemaVersion`) and chain value; never secrets/chaining key/evidence bytes | TC-GH223-001, TC-GH223-002, TC-GH223-003, TC-GH223-004, TC-GH223-005, TC-GH223-006, TC-GH223-007, TC-GH223-008, TC-GH223-022, TC-GH223-035, TC-GH223-036, TC-GH223-039, TC-GH223-043, TC-GH223-044, TC-GH223-048 | Covered |
| EVT-2 | Audit reservation record: `audit.reservation` / `delivery.audit.reservation.v1` under the same key family, appended first under the shared audit fence; payload `{auditSeq, runId, chainValue}` (no invocation metadata); a chain participant; an orphan is the DEC-8 finding | TC-GH223-001, TC-GH223-002, TC-GH223-003, TC-GH223-004, TC-GH223-005, TC-GH223-006, TC-GH223-007, TC-GH223-008, TC-GH223-022, TC-GH223-039, TC-GH223-043, TC-GH223-044, TC-GH223-048, TC-GH223-049 | Covered |
| DM-1 | Audit invocation record kind: `audit.invocation`, schema `delivery.audit.invocation.v1`, key `audit.invocations`, 13 fields `runId`, `command`, `arguments`, `exitCode`, `timing`, `resultSchemaVersion` (rendered envelope schemaVersion; distinct from the payload schema id), `outcomeClass`, `scope`, `repo`, `startedAt`, `auditSeq`, `agentIdentity`, `chainValue`; validated by one boundary declaring both audit kinds | TC-GH223-005, TC-GH223-008, TC-GH223-034, TC-GH223-035, TC-GH223-036 | Covered |
| DM-2 | Chain value covering the previous audit-domain record (reservation or invocation) and the new record's audited content; verification recomputes over the verified sequence; key never stored in a record | TC-GH223-023, TC-GH223-024, TC-GH223-025, TC-GH223-026, TC-GH223-027, TC-GH223-037, TC-GH223-038, TC-GH223-045, TC-GH223-049 | Covered |
| DM-3 | Claimed identity field: verbatim seam-named variable value plus the explicit `claimed` marker when the trimmed value is non-empty; absent, empty, and whitespace-only are absent; attribution only | TC-GH223-011, TC-GH223-012, TC-GH223-013, TC-GH223-022 | Covered |
| DM-4 | Stream-capability mode fact injected at the runtime-aware edge and consumed by the mode contract; part of golden-fixture injected facts | TC-GH223-018, TC-GH223-019, TC-GH223-020 | Covered |
| DM-5 | Durable `chain-key.<workspace>.json` store-layout artifact: generated once at the runtime edge on the first audit append, persisted through the port's store-managed artifact path with `0600`, verified on open, read by every later process; open failures reuse existing identities (`state.keys.missing`, `state.store.torn` family, `state.permission.denied`); never exported to configuration, ambient environment, lane environments, or record payloads | TC-GH223-026, TC-GH223-037, TC-GH223-038, TC-GH223-047 | Covered |
| DM-6 | Audit reservation record kind: `audit.reservation`, schema `delivery.audit.reservation.v1`, same key family; payload `{auditSeq, runId, chainValue}` (no invocation metadata); appended first in the two-phase append; a chain participant; orphan is the DEC-8 finding | TC-GH223-005, TC-GH223-008, TC-GH223-034, TC-GH223-043, TC-GH223-044, TC-GH223-048, TC-GH223-049 | Covered |

### 3.3 Non-Functional Coverage (NFR-#)

| NFR ID | Requirement | TC ID(s) | Status |
|--------|-------------|----------|--------|
| NFR-1 | Exactly one `audit.invocation` per invocation across all outcome classes; reservations never counted; durable ordinal consumption via the two-phase append; 100% of reservation-orphan omissions detected, including after a derived-document rebuild; 0 gap findings when the reservation itself fails | TC-GH223-001, TC-GH223-002, TC-GH223-003, TC-GH223-004, TC-GH223-006, TC-GH223-009, TC-GH223-010, TC-GH223-022, TC-GH223-035, TC-GH223-036, TC-GH223-039, TC-GH223-043, TC-GH223-044, TC-GH223-046 | Covered |
| NFR-2 | Edge-registered secret values never appear in any record field on any outcome class; reservation payloads carry no arguments/outcome/identity; unregistered values are outside the guarantee | TC-GH223-031, TC-GH223-032 | Covered |
| NFR-3 | 100% of alteration mutations (reservation or invocation, including orphaned reservations) flagged as chain breaks naming position; 0 false verified verdicts; 0 false chain-break flags on cross-process verification of unaltered history | TC-GH223-023, TC-GH223-024, TC-GH223-025, TC-GH223-027, TC-GH223-038, TC-GH223-045, TC-GH223-049 | Covered |
| NFR-4 | Chaining key never enters lane environments, ledger record payloads, configuration, ambient environment, or any record field; durable `chain-key.<workspace>.json` spans processes without false flags; open failures reuse existing identities | TC-GH223-026, TC-GH223-037, TC-GH223-038, TC-GH223-047 | Covered |
| NFR-5 | Identity captured verbatim when present (non-empty after trimming); 0 inferred identities; 0 empty-valued identity fields when absent, empty, or whitespace-only | TC-GH223-011, TC-GH223-012, TC-GH223-013, TC-GH223-022 | Covered |
| NFR-6 | Scripted success lines carry exactly `data`; scripted failure lines carry `error` with full fields plus top-level `runId`; exactly one line per invocation; interactive envelopes byte-conform | TC-GH223-014, TC-GH223-015, TC-GH223-016, TC-GH223-017, TC-GH223-018, TC-GH223-019, TC-GH223-020, TC-GH223-021, TC-GH223-022 | Covered |
| NFR-7 | Every read query honors its declared bound, reports truncation in-band, and refuses missing/invalid bounds or filters; 0 unbounded dump paths | TC-GH223-028, TC-GH223-029, TC-GH223-030, TC-GH223-040, TC-GH223-041, TC-GH223-042, TC-GH223-050 | Covered |
| NFR-8 | Malformed entries classify without silent loss; salvage removes trailing records and reservations wholesale; a last-valid-frame reservation survives as evidence; retention forever; no prune/delete/compaction path | TC-GH223-007, TC-GH223-027, TC-GH223-048 | Covered |
| NFR-9 | Contracts runtime-neutral; audit consumer composes the public state port only; state tier never imports branding; key artifact uses the store-layout path, not a new runtime-API location; no driver discriminant; error-table sync untouched | TC-GH223-008, TC-GH223-013, TC-GH223-033, TC-GH223-034, TC-GH223-037, TC-GH223-047 | Covered |


## 4. Test Types and Layers

All cases are automated `bun:test` suites under `tests/**/*.test.ts`; no case is manual. The repository maps `packages/**` changes to `bun test tests/structure tests/behaviour`, the boundary suite, golden suites, and `pnpm typecheck`; the audit ledger touches all of those layers.

- **Pure unit tier** — runtime-neutral modules driven directly with in-memory values and byte strings: invocation/reservation record assembly (including `startedAt` integer-epoch-ms conversion and `auditSeq` pairing), payload validation against the exact `delivery.audit.invocation.v1` and `delivery.audit.reservation.v1` vocabularies, chain-link computation and verification over a mixed reservation/invocation sequence, filter matching (scope/repo/inclusive time window), bound/truncation arithmetic, reservation-orphan detection, and the scripted-projection validator. No filesystem, no CLI.
- **Integration tier (in-process surface + temp store)** — `runCli` with buffer streams, injected clock/run-id/environment/mode/secrets and an audit write port built over a real temporary state directory with the production node edge wrapped by `createTestEdge`. This is where the two-phase append under one fence acquisition, exactly-one invocation counting, timestamp/ordinal capture, identity capture, trim rendering against the ledger, both-kind chain verification, durable key creation/reuse and open failures, cross-edge verification, salvage continuity, read-surface behaviour including time-window/repo/command-exact filters and reservation-orphan findings, and both audit-write failure modes are exercised. Cross-process continuity is modeled by reopening the same temp store with a fresh store/edge instance.
- **Golden tier** — `tests/golden/**` byte-for-byte cases, now carrying a mode fact and an audit store per run. Interactive cases retain the existing M0-S3 goldens as interactive cases; scripted cases add per-outcome-class goldens, with failure lines carrying top-level `runId`. Every discovered case requires its golden; there is no skip or auto-accept path.
- **Structure / contract / boundary tier** — `tests/structure/**`, `tests/checks/**`, `tests/boundaries/**`: exact audit-kind/schema/key declarations for both kinds, the `chain-key.<workspace>.json` store-layout path, tier imports, absence of a CLI audit command, absence of an unbounded dump export, key-artifact permissions/exclusion/open-failure identities, no ambient clock/environment reads, and error-table non-drift.
- **Static/diff** — `git diff --check` plus the existing naming/path and forbidden-literal scans.

Determinism rules: no process spawning, no real clock, no ambient environment read, no real process streams, no network, and no writes outside a per-test temp root. The no-spawn guard in `tests/fixtures/result/no-spawn-guard.ts` is installed around representative `runCli` cases.

## 5. Test Scenarios

### 5.1 Scenario Index

| TC ID | Title | Type | Tier | Automation | Priority | AC Coverage |
|-------|-------|------|------|------------|----------|-------------|
| TC-GH223-001 | Success and void success append one invocation record plus its reservation | Happy Path | Integration | Automated | Critical | AC-F1-1 |
| TC-GH223-002 | Classified user/platform failures append one invocation record plus its reservation | Negative | Integration | Automated | Critical | AC-F1-1 |
| TC-GH223-003 | Unknown failures append one invocation record plus its reservation | Negative | Integration | Automated | Critical | AC-F1-1 |
| TC-GH223-004 | Broken invocations append one invocation record plus its reservation with raw argv tokens | Negative | Integration | Automated | Critical | AC-F1-1 |
| TC-GH223-005 | Invocation/reservation field sets, exact vocabulary, two-phase order, and reservation payload hygiene | Happy Path | Unit + Integration | Automated | Critical | AC-F1-1, AC-F1-4 |
| TC-GH223-006 | Identical re-run appends a second invocation/reservation pair with a new runId and later ordinal | Happy Path | Integration | Automated | Critical | AC-F1-2, AC-F1-4 |
| TC-GH223-007 | Malformed reservation or invocation entry is classified, preserved, and salvaged without data loss | Edge Case | Integration | Automated | Critical | AC-F1-3 |
| TC-GH223-008 | Both audit kinds are additive within `delivery.state.v1` and interleave safely | Edge Case | Contract + Integration | Automated | High | AC-F1-1 |
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
| TC-GH223-022 | SC-M1-23: scripted invocation is audited and trimmed end-to-end (invocation + reservation pair) | Happy Path | Integration | Automated | Critical | AC-F1-1, AC-F1-2, AC-F1-4, AC-F2-1, AC-F2-2, AC-F3-1, AC-F3-2, AC-F6-1 |
| TC-GH223-023 | Clean chain verifies across reservation and invocation records; interleaved non-audit kinds do not participate | Happy Path | Unit + Integration | Automated | Critical | AC-F1-1, AC-F4-1 |
| TC-GH223-024 | Altered invocation record with recomputed unkeyed checksum is flagged with position | Negative | Integration | Automated | Critical | AC-F4-1 |
| TC-GH223-025 | Mutation matrix across both audit kinds: every alteration is flagged; no false verified verdicts | Negative | Integration | Automated | Critical | AC-F4-1 |
| TC-GH223-026 | Chaining key never enters lane environment, record payloads, config, or ambient env (both kinds) | Negative | Integration + Check | Automated | Critical | AC-F4-2 |
| TC-GH223-027 | Salvage/repair remove trailing invocations and reservations wholesale; reported removals are not breaks | Corner Case | Integration | Automated | Critical | AC-F4-3 |
| TC-GH223-028 | Bounded reads with scope/repo/inclusive-time-window filters return verified matches and report truncation in-band | Happy Path | Integration | Automated | High | AC-F5-1 |
| TC-GH223-029 | No unbounded dump path exists through the read surface | Negative | Structure | Automated | Critical | AC-F5-1 |
| TC-GH223-030 | Read surface classifies torn/unknown without silent zeros and writes nothing | Negative | Integration | Automated | Critical | AC-F5-1 |
| TC-GH223-031 | Edge-registered secrets in arguments never reach any audit record field | Negative | Integration | Automated | Critical | AC-F6-1 |
| TC-GH223-032 | Record content passes the single redaction chokepoint; no secondary serialization path | Negative | Integration + Structure | Automated | Critical | AC-F6-1 |
| TC-GH223-033 | No new error-table rows; key open failures and orphan findings reuse existing identities | Contract | Contract + Check | Automated | High | AC-F4-1, NFR-9 |
| TC-GH223-034 | Tier/boundary conformance; audit read is library-only; key artifact uses the store-layout path | Contract | Structure + Boundary | Automated | High | AC-F5-1, NFR-9 |
| TC-GH223-035 | `startedAt` is the injected clock's integer epoch-millisecond UTC start, recorded exactly once | Happy Path | Unit + Integration | Automated | Critical | AC-F1-4 |
| TC-GH223-036 | Re-run records a distinct `startedAt` and an advanced `auditSeq` | Happy Path | Integration | Automated | Critical | AC-F1-2, AC-F1-4 |
| TC-GH223-037 | `chain-key.<workspace>.json` is created once, persisted 0600, verified on open, and never exported | Happy Path | Integration + Check | Automated | Critical | AC-F4-2 |
| TC-GH223-038 | Cross-process chain verification has zero false chain-break flags | Happy Path | Integration | Automated | Critical | AC-F4-2 |
| TC-GH223-039 | Two-phase append failure matrix: orphan reservation vs failed reservation | Negative | Integration | Automated | Critical | AC-F1-1, AC-F5-1 |
| TC-GH223-040 | Missing or invalid bound/filter refuses with `input.value.rejected` | Negative | Integration + Contract | Automated | High | AC-F5-1 |
| TC-GH223-041 | `startedAt` time window is inclusive `[from,to]` with an omitted side unbounded | Happy Path | Integration | Automated | High | AC-F1-4, AC-F5-1 |
| TC-GH223-042 | Exact scope/repo filter semantics with repo-null exclusion | Edge Case | Integration | Automated | High | AC-F5-1 |
| TC-GH223-043 | Reservation-orphan scenario: invocation append fails after the reservation lands | Negative | Integration | Automated | Critical | AC-F1-1, AC-F5-1 |
| TC-GH223-044 | Reservation-failure scenario: reservation append fails, nothing consumed, no gap claimed | Negative | Integration | Automated | Critical | AC-F1-1 |
| TC-GH223-045 | Altered reservation record with recomputed checksum is flagged as a chain break with position | Negative | Integration | Automated | Critical | AC-F4-1 |
| TC-GH223-046 | Derived-document rebuild preserves the reservation-orphan finding | Corner Case | Integration | Automated | Critical | AC-F5-1 |
| TC-GH223-047 | Key-artifact open failures reuse existing state identities | Negative | Integration + Contract | Automated | Critical | AC-F4-2, NFR-9 |
| TC-GH223-048 | Surviving-tail reservation after salvage remains the DEC-8 finding | Corner Case | Integration | Automated | Critical | AC-F4-3, AC-F5-1 |
| TC-GH223-049 | Altered orphan reservation is flagged as a chain break with position | Negative | Integration | Automated | Critical | AC-F4-1 |
| TC-GH223-050 | Command filter exact-matches raw-token broken invocations | Edge Case | Integration | Automated | High | AC-F5-1 |

### 5.2 Scenario Details

#### TC-GH223-001 - Success and void success append one invocation record plus its reservation

**Scenario Type**: Happy Path
**Impact Level**: Critical
**Priority**: Critical
**Related IDs**: F-1, F-6, AC-F1-1, AC-F1-4, EVT-1, EVT-2, DM-1, DM-6, NFR-1
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
4. Read the store's verified records; group by kind and by runId.
5. For each run, assert the two-frame sequence: one `audit.reservation` immediately followed by one `audit.invocation`, sharing the same `auditSeq`.
6. Assert the invocation count is exactly one per run (reservations are not counted); assert the reservation payload key set is exactly `{auditSeq, runId, chainValue}`.
7. Inspect each invocation's exact 13-field set: `runId`, `command`, `arguments`, `exitCode`, `timing`, `resultSchemaVersion`, `outcomeClass`, `scope`, `repo`, `startedAt`, `auditSeq`, `agentIdentity`, `chainValue`.

**Expected Outcome**:

- Each of the three invocations produced exactly one `audit.invocation` record and exactly one `audit.reservation` record; no invocation produced zero or two invocation records.
- Each reservation immediately precedes its invocation and both carry the same `auditSeq` (`1`, `2`, `3` in invocation order); the reservation payload contains `auditSeq`, `runId`, and `chainValue`; it contains no invocation metadata.
- The invocation records carry the exact 13-field set: runId, the resolved command name, the full argv arguments, exit code `0`, `timing.totalMs` equal to the tick delta, `resultSchemaVersion` equal to the rendered envelope's `schemaVersion` (`delivery.result.v1`) and explicitly distinct from the record's payload schema id `delivery.audit.invocation.v1`, outcome class `success`, the store/workspace `scope`, `startedAt` equal to the invocation's start tick as an integer epoch-millisecond UTC value, `auditSeq`, `agentIdentity` when present, and `chainValue`.
- The text-mode invocation is audited exactly like the `--json` invocation; auditing is not tied to the machine channel.
- No record contains the chaining key. Each audit-domain record's own chain value and the store's framing checksum are present as required; no evidence text leaks payload or checksum bytes beyond the audited arguments.

**Postconditions**:

- Temp root removed.

---

#### TC-GH223-002 - Classified user/platform failures append one invocation record plus its reservation

**Scenario Type**: Negative
**Impact Level**: Critical
**Priority**: Critical
**Related IDs**: F-1, AC-F1-1, EVT-1, EVT-2, DM-1, DM-6, NFR-1
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
3. Read the audit records and assert exactly one `audit.invocation` and one preceding `audit.reservation` per run, sharing the same `auditSeq`.
4. Assert the reservation payload contains `auditSeq`, `runId`, and `chainValue`, and no invocation metadata.
5. Compare each invocation's outcome class with the exit projection class produced by the run.

**Expected Outcome**:

- Each classified failure produces exactly one invocation record and one reservation, carrying the failure's exit code and the projected outcome class (`user-validation` for the user failure, `platform-provider` for the platform failure), plus the v1.2 `startedAt` and `auditSeq` fields.
- The invocation's exit code and outcome class agree with the rendered failure and its envelope context (schemaVersion, runId, exitCode, timing); the error is never treated as a missing record.
- The reservation carries no arguments, outcome, or identity; it is ordinal and chain-link evidence only, with no invocation metadata.
- The invocation's arguments and command are the failing invocation's own, not a neighbouring run's.

---

#### TC-GH223-003 - Unknown failures append one invocation record plus its reservation

**Scenario Type**: Negative
**Impact Level**: Critical
**Priority**: Critical
**Related IDs**: F-1, AC-F1-1, EVT-1, EVT-2, DM-1, DM-6, NFR-1
**Test Type(s)**: Integration
**Automation Level**: Automated
**Target Layer / Location**: `tests/behaviour/audit-outcomes.test.ts`
**Tags**: @backend, @audit, @classification

**Preconditions**:

- Descriptors for a thrown non-`Error` value, a rejected promise, and a result of an unknown kind, each resolving to the existing containment/fallback identities.

**Steps**:

1. Run each descriptor with `--json`.
2. Assert each run fails with the expected fallback/unknown classification and exit code.
3. Read the audit records for the three runs; assert one invocation and one preceding reservation per run, same `auditSeq`.
4. Assert the reservation payload is exactly `{auditSeq, runId, chainValue}` with no invocation metadata.
5. Compare the invocation's outcome class and exit code with the rendered failure.

**Expected Outcome**:

- Unknown failures are audited with exactly one invocation record and one reservation each, with the same outcome class and exit code the machine output carried.
- No thrown value's message, stack, or partial assembly payload leaks into either record beyond the redacted arguments; the reservation carries no such content at all.
- The invocation still carries runId, command, timing, exit code, `scope`, integer-epoch-ms `startedAt`, and `auditSeq`.

---

#### TC-GH223-004 - Broken invocations append one invocation record plus its reservation with raw argv tokens

**Scenario Type**: Negative
**Impact Level**: Critical
**Priority**: Critical
**Related IDs**: F-1, AC-F1-1, EVT-1, EVT-2, DM-1, DM-6, NFR-1
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
3. Read the audit records; assert one invocation and one preceding reservation per run, same `auditSeq`.
4. Inspect the command/arguments portion of each invocation and assert the reservation has no command/arguments field.

**Expected Outcome**:

- Each broken invocation appends exactly one invocation record and one reservation (two frames, same ordinal); it does not append a second invocation record.
- The invocation preserves the raw argv tokens (the original flags, values, and positionals) and does not invent a resolved command name.
- The invocation carries the invocation failure's exit code, outcome class, timing, `scope`, integer-epoch-ms `startedAt`, `auditSeq`, and runId; the reservation carries `{auditSeq, runId, chainValue}` and no invocation metadata.
- Redaction still applies to the raw tokens (verified separately in TC-GH223-031).

---

#### TC-GH223-005 - Invocation/reservation field sets, exact vocabulary, two-phase order, and reservation payload hygiene

**Scenario Type**: Happy Path
**Impact Level**: Critical
**Priority**: Critical
**Related IDs**: F-1, F-6, AC-F1-1, AC-F1-4, EVT-1, EVT-2, DM-1, DM-6, NFR-1, NFR-9
**Test Type(s)**: Unit, Integration
**Automation Level**: Automated
**Target Layer / Location**: `tests/behaviour/audit-ledger.test.ts` (unit assembly) and `tests/structure/audit-contract.test.ts` (new, declaration shape)
**Tags**: @backend, @audit, @contract, @state

**Preconditions**:

- The delivered audit vocabulary exposed as runtime-neutral data: `audit.invocation` / `delivery.audit.invocation.v1` with 13 fields `runId`, `command`, `arguments`, `exitCode`, `timing`, `resultSchemaVersion`, `outcomeClass`, `scope`, `repo`, `startedAt`, `auditSeq`, `agentIdentity`, `chainValue`; `audit.reservation` / `delivery.audit.reservation.v1` with fields `auditSeq`, `runId`, `chainValue` (and no invocation metadata); both under the `audit.invocations` key family.
- A store identity with a workspace `scope` and a synthetic `repo` target.
- A synthetic command that declares a repository target; injected clock start tick `5000`.
- A call-order spy wrapping the public port (records `acquireFence`, `readRecords`, `append`, `releaseFence` order).

**Steps**:

1. Assemble an invocation record and its reservation from a normalized invocation fact in a pure unit case; assert each field set and closed vocabulary against the delivered declarations.
2. Assert the reservation payload has exactly three keys `auditSeq`, `runId`, and `chainValue`; assert `chainValue` is present and non-empty, and that no `arguments`, `command`, `exitCode`, `outcomeClass`, `scope`, `repo`, `startedAt`, or `agentIdentity` appears.
3. Write the pair through the artifact boundary in an integration case; assert both kinds are admitted under their schemas and share the same `auditSeq`.
4. Read the pair back and assert every required field is present and exact, including `scope`, `repo`, integer-epoch-ms `startedAt`, the shared `auditSeq`, and both `chainValue` links. Assert link alternation: the reservation's `chainValue` chains from the preceding audit-domain record (or the store chain anchor when it is the first record), and the invocation's `chainValue` chains from its reservation.
5. Assert the ordered call subsequence under one fence acquisition: `acquireFence` once → `readRecords` (ordinal allocation from verified ledger truth) → `append(audit.reservation)` → `append(audit.invocation)` → `releaseFence`; unrelated reads may interleave but no second fence is acquired.
6. Attempt writes with a missing required field, an undeclared outcome-class value, a wrong schema identity, a `repo` of the wrong type, and a reservation carrying an extra `arguments` field.

**Expected Outcome**:

- The invocation record carries the exact 13-field set: `runId`, `command`/raw tokens, redacted `arguments`, `exitCode`, `timing`, `resultSchemaVersion` (the rendered envelope's schemaVersion, distinct from the payload schema id), `outcomeClass`, `scope`, `repo` when targeted, integer-epoch-ms `startedAt`, `auditSeq`, `agentIdentity` when present, and `chainValue`.
- The reservation record carries `auditSeq`, `runId`, and `chainValue`; it contains no arguments, outcome, identity, or any other invocation metadata. The production assembly emits exactly the three keys; additionally attempt a boundary write with an extra `arguments` field and record whether the delivered boundary refuses it (invocation metadata is not permitted).
- Both kinds are stored under the `audit.invocations` key family; the reservation immediately precedes the invocation and both carry the same ordinal.
- Link alternation holds: reservation → preceding audit-domain record (or anchor), invocation → its reservation; the first audit-domain record chains from the store chain anchor.
- The call order proves one fence acquisition and ordinal allocation from verified ledger truth before the two appends; no second fence is acquired.
- The artifact boundary refuses the nonconforming writes as `state.store.unknown` with consequence `not_landed`; nothing lands and no field is defaulted.
- `scope` and `repo` are copied from the injected facts exactly; they are never derived from the host or ambient environment. `repo` is absent (not null/empty) when the command has no target.

---

#### TC-GH223-006 - Identical re-run appends a second invocation/reservation pair with a new runId and later ordinal

**Scenario Type**: Happy Path
**Impact Level**: Critical
**Priority**: Critical
**Related IDs**: F-1, AC-F1-2, AC-F1-4, EVT-1, EVT-2, DM-1, DM-6, NFR-1
**Test Type(s)**: Integration
**Automation Level**: Automated
**Target Layer / Location**: `tests/behaviour/audit-ledger.test.ts`
**Tags**: @backend, @audit, @idempotency

**Preconditions**:

- A temp audit store.
- The same command and argv run twice with distinct run ids (`run-gh223-0101`, `run-gh223-0102`) and distinct injected start ticks (`1000`, `2000`).

**Steps**:

1. Run the identical invocation twice.
2. Read all audit records; group by kind and runId.
3. Assert two invocation records (one per run) and two reservations, each reservation immediately preceding its invocation and sharing the run's `auditSeq`.
4. Assert the ordinals are `1` then `2`; assert the reservation ordinals match the invocation ordinals.
5. Compare runIds, `startedAt`, and audited content.

**Expected Outcome**:

- Exactly two invocation records and two reservations exist; neither invocation is deduplicated, updated, or overwritten, and reservations are not counted as invocation records.
- The pairs are distinguishable by runId; both invocations carry the same command and argv, but distinct runIds, `startedAt` values (each the corresponding start tick), and `auditSeq` values (`1`, then `2`).
- Each reservation carries `{auditSeq, runId, chainValue}` and shares its invocation's ordinal.
- The chain is continuous: reservation 1 → invocation 1 → reservation 2 → invocation 2.

---

#### TC-GH223-007 - Malformed reservation or invocation entry is classified, preserved, and salvaged without data loss

**Scenario Type**: Edge Case
**Impact Level**: Critical
**Priority**: Critical
**Related IDs**: F-1, F-5, AC-F1-3, EVT-1, EVT-2, DM-1, DM-6, NFR-8
**Test Type(s)**: Integration
**Automation Level**: Automated
**Target Layer / Location**: `tests/behaviour/audit-malformed.test.ts` (new); reuse `tests/behaviour/state-salvage.test.ts` patterns
**Tags**: @backend, @audit, @state, @salvage

**Preconditions**:

- A temp store seeded with three valid audit-domain pairs (reservation + invocation), then malformed fixtures: (a) a tail invocation with broken framing, (b) a tail invocation with a failing checksum, (c) an `audit.invocation` whose payload violates the audit boundary's declared schema (missing required field or undeclared outcome-class value) appended through the raw store so the state layer frames it cleanly, and (d) a malformed `audit.reservation` tail (broken framing or failing checksum).
- The torn fixtures are verified to fail before salvage.

**Steps**:

1. Snapshot the ledger bytes and the pre-existing records for each fixture.
2. Perform a verified audit read on fixtures (a), (b), and (d); assert the classified torn failure and its identity.
3. Perform a verified audit read on fixture (c); assert the artifact boundary classifies it as `state.store.unknown` with the record position.
4. Assert the valid prefix's byte digest is unchanged, the pre-salvage torn read returned no values, and no record was deleted or rewritten.
5. Invoke the explicit salvage operation on the torn fixtures on a fenced handle.
6. Read the post-salvage ledger and the quarantined evidence; assert the unknown-payload record is still present as evidence (no delete path).

**Expected Outcome**:

- The malformed entry classifies through an existing state identity: torn for fixtures (a)/(b)/(d), `state.store.unknown` at the artifact boundary for fixture (c). Neither is an empty record set or a silent zero. Before salvage the torn read fails; after salvage every pre-existing record is verified-readable and unchanged.
- No pre-existing audit-domain record (reservation or invocation) is lost or altered by classification; the valid prefix's digest is unchanged, and the unknown-payload record remains in the ledger as evidence (no silent drop, no delete path).
- For the torn fixtures, the malformed region is preserved as evidence by the explicit salvage path (quarantine), the quarantined bytes are readable as evidence, and the operation reports the truncation position and extent.
- Retention remains forever; no prune, delete, or compaction path is introduced.

---

#### TC-GH223-008 - Both audit kinds are additive within `delivery.state.v1` and interleave safely

**Scenario Type**: Edge Case
**Impact Level**: Important
**Priority**: High
**Related IDs**: F-1, AC-F1-1, EVT-1, EVT-2, DM-1, DM-6, NFR-9
**Test Type(s)**: Contract, Integration
**Automation Level**: Automated
**Target Layer / Location**: `tests/structure/audit-contract.test.ts` (new) and `tests/behaviour/audit-ledger.test.ts`
**Tags**: @backend, @audit, @state, @contract

**Preconditions**:

- A store already containing records of another consumer kind (e.g., a phase transition or closeout outcome) under `delivery.state.v1`.
- The two audit kinds: `audit.invocation` / `delivery.audit.invocation.v1` and `audit.reservation` / `delivery.audit.reservation.v1`, under the `audit.invocations` key family.

**Steps**:

1. Open the pre-existing store without migration.
2. Append audit-domain pairs (reservation then invocation) interleaved with another consumer's records.
3. Read all records and the audit-domain subset.
4. Assert the store schema version is unchanged and both audit kinds are additive.
5. Assert the `auditSeq` pairing (`1..N`) holds across the pairs despite the interleaved non-audit kinds.

**Expected Outcome**:

- Existing stores open unchanged; no schema bump, migration, backfill, or reinterpretation occurs.
- Both `audit.invocation` and `audit.reservation` are identifiable under the `audit.invocations` key family; other-kind records are untouched.
- Interleaved records do not corrupt either consumer's read; the audit chain ignores non-audit kinds, and each reservation/invocation pair shares a monotonic `auditSeq` with no gap.
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
- A second temp store with a torn ledger tail (broken framing) and no successful audit append.

**Steps**:

1. Arm the generic append fault.
2. Run a succeeding command and a failing command with `--json`.
3. Assert the returned exit code, stdout machine line, and stderr diagnostics.
4. Disarm and assert the edge recorded the intended point as raised.
5. Read the audit records; assert no reservation or invocation landed and no partial frame was added.
6. Run a command against the torn-ledger store; assert the command keeps its own outcome and exit code, the diagnostics carry `state.store.torn`, and no reservation/invocation is appended.

**Expected Outcome**:

- Both commands keep their own outcome and exit code: success stays `0` and its `data` line is emitted; failure stays its classified code and its `error` line is emitted.
- The audit failure is loud on the diagnostics stream with an existing state identity (`state.write.failed` for a generic write fault, `state.store.torn` for a torn ledger at ordinal allocation), never a silent drop.
- No audit record lands and no partial record is observable; the torn store is not modified by the failed audit path.
- The fault point assertion proves the degradation came from the injected append failure, not from an unrelated path.
- The two-phase failure modes are asserted by TC-GH223-039/043/044; this case stays focused on generic-fault/torn-store degradation and outcome independence.

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

- Three fault fixtures: (a) the single shared audit fence is held by another token/store instance so the audit append cannot acquire it (`state.lock.busy`); (b) the edge is armed with `armExhaustion(["append-before-flush"])` on the reservation append (`state.storage.exhausted`); (c) the edge raises exhaustion only on the invocation append after the reservation lands (second-append fault).
- A synthetic success command with a known exit code, run three times (before, during, after the fault) per fixture.

**Steps**:

1. Run invocation 1 successfully; record its pair's `auditSeq`.
2. In fixture (a), hold the shared audit fence, run invocation 2, assert the outcome and diagnostics, then release.
3. In fixture (b), arm exhaustion on the reservation append, run invocation 2, assert the outcome and diagnostics, then disarm.
4. In fixture (c), arm the second-append exhaustion, run invocation 2; assert the outcome and diagnostics, then disarm.
5. Run invocation 3 successfully in each fixture.
6. Snapshot the ledger before and after each failed attempt; read verified records, audit pairs, and reservation orphans.

**Expected Outcome**:

- In all three cases the command still succeeds with exit code `0` and its normal `data` line; the audit failure never changes the command's outcome.
- The diagnostics carry the classified state identity (`state.lock.busy`, `state.storage.exhausted`) loudly, with no payload or checksum bytes.
- For fixtures (a) and (b), the ledger is byte-identical before and after the failed attempt; for fixture (c), it contains exactly the landed reservation and no partial invocation frame.
- Fixtures (a) and (b) consume nothing: no reservation, no invocation, and no gap finding; invocation 3's pair reuses the would-be ordinal.
- Fixture (c) lands the reservation and loses the invocation: the orphan is the DEC-8 finding; invocation 3's pair advances past it.
- Exactly-once counts invocation records only; the degraded invocation is explicitly absent.

**Notes / Clarifications**:

- One shared fence serializes the whole audit domain (F-1/OQ-11); a per-key fence model is not tested. The fence-contention case uses a second store instance holding the shared fence, not a handler-held per-key fence.
- TC-GH223-039/043/044 isolate the two-phase failure matrix in depth; this case keeps the shared-fence contention and exhaustion variants.

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

- OQ-10 is resolved in spec v1.1/v1.2: the record uses `agentIdentity` with the explicit `claimed` marker. The test asserts the marker and rejects any verification marker.

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
- An injected user, home, host, and session fact set that would make inference possible if the implementation tried (`USER=operator`, hostname, `SESSION_ID`, `PWD`).

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

- OQ-13 is resolved in spec v1.1/v1.2: trimming is used only for the presence decision; absent, empty, and whitespace-only are absent, and no empty-valued identity is recorded.

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
5. Assert the process exit code is `0`; assert the audit record retains the trimmed context fields, with the envelope's `schemaVersion` retained as the record's `resultSchemaVersion` field (not as the payload schema id `delivery.audit.invocation.v1`).

**Expected Outcome**:

- Stdout is one minified `{"data":{...}}` line, byte-identical to the golden.
- The key set is exactly `data`; the trimmed tokens are absent, and the line has no newline inside it.
- Status is carried by the process exit code, not the line.
- The audit record for the same run carries the exact 13-field invocation payload (`runId`, `command`, `arguments`, `exitCode`, `timing`, `resultSchemaVersion`, `outcomeClass`, `scope`, `repo`, `startedAt`, `auditSeq`, `agentIdentity`, `chainValue`): the trimmed context fields are retained as `resultSchemaVersion` (envelope `schemaVersion`, `delivery.result.v1`), `runId`, and `timing`/`exitCode`; `resultSchemaVersion` is distinct from the payload schema id `delivery.audit.invocation.v1`. The result `data` payload is not required in the record, and the runId correlates the line to the record.
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
- The trimmed context fields are absent from the line and retained in the audit record, with the envelope schemaVersion retained as `resultSchemaVersion` (distinct from the payload schema id).
- The exit code remains the machine-readable status projection.

**Notes / Clarifications**:

- OQ-4 is resolved in spec v1.1/v1.2: `runId` is a top-level key of the minified error line, beside the `error` object. The test rejects a nested `runId` and a missing top-level `runId`.

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
3. Read the audit records; assert exactly one `audit.invocation` and one immediately preceding `audit.reservation` with the same `auditSeq`, plus runId, command, redacted args, exit, timing, `resultSchemaVersion` (the rendered envelope schemaVersion, distinct from the payload schema id), integer-epoch-ms `startedAt`, and `agentIdentity` with the `claimed` marker. Assert the reservation payload is exactly `{auditSeq, runId, chainValue}` with no invocation metadata.
4. Re-run the identical invocation with a new run id and a later start tick; assert a second invocation/reservation pair with a new runId, a distinct `startedAt`, and the next `auditSeq`.
5. Run a failing variant and assert the error line has top-level `runId` and full error fields; assert the failing invocation still has its reservation.
6. Run a variant without the identity variable, and separately with an empty/whitespace-only value; assert the invocation carries no identity and no inference, and the reservation carries none either.
7. Search every record and the machine output for the planted edge-registered secret values.

**Expected Outcome**:

- Exactly one `audit.invocation` per invocation (reservations are not counted); each invocation has exactly one reservation, immediately preceding it, with the same `auditSeq`.
- The trimmed fields live only in the invocation record; the reservation is ordinal and chain-link evidence only.
- Identity is captured verbatim with the `claimed` marker when present; absent, empty, and whitespace-only are absent and never inferred.
- Re-run yields a second pair with a new runId, distinct `startedAt`, and a later `auditSeq`; no deduplication.
- Failure lines keep `runId` as a top-level correlation key.
- No edge-registered secret appears in any record field or on the machine channel.
- The case reads as the seeded scenario's Given/When/Then and cites SC-M1-23 in its describe/title text.

---

#### TC-GH223-023 - Clean chain verifies across reservation and invocation records; interleaved non-audit kinds do not participate

**Scenario Type**: Happy Path
**Impact Level**: Critical
**Priority**: Critical
**Related IDs**: F-1, F-4, AC-F1-1, AC-F4-1, DM-2, EVT-1, EVT-2, NFR-1, NFR-3
**Test Type(s)**: Unit, Integration
**Automation Level**: Automated
**Target Layer / Location**: `tests/behaviour/audit-chain.test.ts` (new)
**Tags**: @backend, @audit, @chain, @state

**Preconditions**:

- A deterministic in-memory key fixture for the pure unit half; the integration half uses the store's generated durable key artifact.
- A temp store with audit-domain pairs interleaved with records of another kind; all audit appends go through the shared audit fence.
- A pure in-memory sequence fixture for the unit half.

**Steps**:

1. Append five audit-domain pairs (reservation then invocation) with other-kind records between pairs; assert each pair shares an `auditSeq` (`1..5`).
2. Verify the chain over the full audit-domain sequence; assert a verified verdict with the record count and no breaks.
3. Recompute expected links with the independent oracle defined for the algorithm pinned at delivery (or, if the algorithm stays behind an opaque helper, assert the behavioural properties: determinism, key sensitivity, previous-link sensitivity, and content sensitivity) across both kinds.
4. Repeat with a fresh store whose first audit-domain record is a reservation, and with a store that already has other-kind records; assert the first audit-domain record anchors correctly in both.
5. Append a sixth pair after the interleaved tail; assert its reservation and invocation share `auditSeq` `6`, the reservation chains from the fifth invocation (the preceding audit-domain record), and the invocation chains from its reservation, not from the intervening kind.

**Expected Outcome**:

- The clean chain verifies with zero breaks over the continuous reservation + invocation sequence in ledger order.
- Interleaved non-audit kinds neither break nor participate; their content is not covered by the audit chain.
- Link alternation holds: each reservation chains from the preceding audit-domain record (of either kind), each invocation chains from its reservation, and the first audit-domain record (the first reservation) chains from the store chain anchor, including on a store with pre-existing other-kind records.
- Each reservation/invocation pair shares the same `auditSeq`; ordinals are `1..6` across the pairs despite the interleaved kinds.
- Verification is deterministic and repeatable; no wall clock or ambient value participates.

---

#### TC-GH223-024 - Altered invocation record with recomputed unkeyed checksum is flagged with position

**Scenario Type**: Negative
**Impact Level**: Critical
**Priority**: Critical
**Related IDs**: F-4, AC-F4-1, DM-1, DM-2, NFR-3
**Test Type(s)**: Integration
**Automation Level**: Automated
**Target Layer / Location**: `tests/behaviour/audit-chain.test.ts`
**Tags**: @backend, @audit, @chain, @tamper

**Preconditions**:

- A verified clean audit ledger containing reservation/invocation pairs.
- A mutation helper that edits an *invocation* record's audited content (for example the command arguments), recomputes the state layer's unkeyed checksum so the store still reads as framing/checksum-clean, and leaves the chain value unchanged.

**Steps**:

1. Verify the clean ledger: zero breaks.
2. Apply the mutation to an invocation record at a known audit position (not the first).
3. Verify again.
4. Inspect the break evidence.
5. Assert records before the break remain verified-readable.

**Expected Outcome**:

- The invocation mutation is flagged as a chain break naming the record position; the unkeyed checksum being recomputed does not produce a false "verified" verdict.
- Evidence names the position only — never payload content or checksum bytes.
- Records before the break remain verified-readable; no data loss is introduced by verification.
- The wording/report expresses "cannot alter undetectably", not "cannot alter". The reservation-alteration counterpart is TC-GH223-045.

---

#### TC-GH223-025 - Mutation matrix across both audit kinds: every alteration is flagged; no false verified verdicts

**Scenario Type**: Negative
**Impact Level**: Critical
**Priority**: Critical
**Related IDs**: F-4, AC-F4-1, DM-1, DM-2, DM-6, EVT-1, EVT-2, NFR-3
**Test Type(s)**: Integration
**Automation Level**: Automated
**Target Layer / Location**: `tests/behaviour/audit-chain-mutations.test.ts` (new); `tests/fixtures/audit/mutations.json` (new declarative matrix)
**Tags**: @backend, @audit, @chain, @mutation

**Preconditions**:

- A clean ten-record audit-domain ledger (five reservation/invocation pairs) and a declarative mutation matrix covering both kinds: reservation payload edit with recomputed checksum; invocation payload edit with recomputed checksum; chain-value edit; reservation deletion; invocation deletion (a state-layer sequence gap, expected as torn before chain verification); reservation reordering; invocation reordering; pair duplication with new sequences; splicing a record from another store; changing the previous connection; altering one side of the reservation/invocation ordinal pair; corrupting a field without recomputing the checksum (state-layer torn, expected as a different identity).

**Steps**:

1. For each mutation, start from a fresh copy of the clean ledger.
2. Apply the mutation, verify the state layer's read, then verify the audit chain and the orphan finding.
3. Record whether the outcome is verified, a chain break with position, an orphan finding, or a state-level classification.
4. Run the clean control last and assert it still verifies with no orphan finding.

**Expected Outcome**:

- Every content/chain mutation is flagged: a chain break naming the position, an orphan-reservation finding, or (for a framing/checksum break) the existing torn identity. No mutation yields a false "verified" verdict.
- Reservation and invocation alterations are equally detectable; a tampered reservation is not a blind spot.
- The clean control verifies with zero breaks and zero orphan findings, proving the matrix is not vacuously failing.
- Each mutation's expected class is declared in the fixture, so a silent change in behaviour fails loudly.
- Evidence hygiene holds for every failure path.

**Notes / Clarifications**:

- A mutation that corrupts a record without recomputing the unkeyed checksum is expected to be caught by the state layer as the existing torn identity before chain verification. That is defense in depth, not a false "verified" verdict. NFR-3's "flagged as chain breaks" wording is read as "detected", with the chain break specifically required for the recomputed-checksum and chain-forgery classes that the state layer cannot see (AC-F4-1).
- Deletion/reordering mutations break the state layer's contiguous sequence and are expected to classify as `state.store.torn` before chain verification; they are not chain breaks. Chain-level mutations that keep framing/checksum/sequence valid (payload edits with recomputed checksums, chain-value edits, valid-sequence splicing, ordinal mismatch) are chain breaks. The reservation-orphan finding is tested on a valid ledger in TC-GH223-043/048, not by deleting a record.

---

#### TC-GH223-026 - Chaining key never enters lane environment, record payloads, configuration, or ambient env (both kinds)

**Scenario Type**: Negative
**Impact Level**: Critical
**Priority**: Critical
**Related IDs**: F-4, AC-F4-2, DM-1, DM-2, DM-5, DM-6, NFR-4; RSK-3
**Test Type(s)**: Integration, Check
**Automation Level**: Automated
**Target Layer / Location**: `tests/behaviour/audit-key-exclusion.test.ts` (new); `tests/fixtures/audit/lane-environment.json` (new)
**Tags**: @backend, @audit, @chain, @security, @key-exclusion

**Preconditions**:

- A declared lane environment fixture carrying only its declared variables (including the identity variable) and explicitly not the chaining key.
- A temp store populated with reservation/invocation pairs under the generated `chain-key.<workspace>.json` artifact.
- The delivered key-artifact path constant and a helper to read the artifact in the test (single-user trust model).

**Steps**:

1. Inspect the lane environment fixture and the configuration/ambient-environment surfaces; assert the key's name and value are absent.
2. Read the key artifact via the delivered helper; assert it is non-empty and that the key value is the one used by verification.
3. Read the raw ledger bytes and walk every audit-domain record's JSON (reservation and invocation); assert no field equals or contains the key value (including obvious hex/base64 encodings).
4. Assert the rendered/reported surfaces produced by this story (diagnostics, evidence, read views) contain no key value.
5. Assert the key exists only in the store-managed `chain-key.<workspace>.json` artifact and the runtime-edge-injected data, not in any record, configuration value, or environment map.

**Expected Outcome**:

- The chaining key appears nowhere in the lane environment, ledger record payloads (either kind), configuration, ambient environment, any record field, or any lane-visible surface rendered by this story.
- Verification succeeds using the store-managed key, proving the key was actually used rather than absent.
- Two negative controls: planting the key value in a temp copy of a record is detected by the exclusion search (proving the search is non-vacuous); replacing the key artifact with a different key makes verification fail (proving key sensitivity).

---

#### TC-GH223-027 - Salvage/repair remove trailing invocations and reservations wholesale; reported removals are not breaks

**Scenario Type**: Corner Case
**Impact Level**: Critical
**Priority**: Critical
**Related IDs**: F-4, AC-F4-3, DM-1, DM-6, EVT-1, EVT-2, NFR-3, NFR-8; DEC-4; RSK-2
**Test Type(s)**: Integration
**Automation Level**: Automated
**Target Layer / Location**: `tests/behaviour/audit-chain-salvage.test.ts` (new)
**Tags**: @backend, @audit, @chain, @salvage, @repair

**Preconditions**:

- Clean audit-domain pairs; two fixtures: (a) a terminal-tail tear after an invocation record, repaired with `repairTornTail`; (b) a terminal-tail tear after an invocation record, salvaged with the explicit `salvage` operation; (c) a store whose last valid frame is a reservation (its invocation torn or never landed).
- The operations' own evidence reports the removal (position/extent).

**Steps**:

1. Verify the clean prefix chain before the tear.
2. Apply repair in fixture (a); read the evidence and verify the chain.
3. Apply salvage in fixture (b); read the evidence and verify the chain.
4. Assert the reported removal is byte-contiguous and kind-agnostic: no partial invocation or reservation frame survives; the surviving sequence verifies continuously.
5. Append a new audit-domain pair after each operation and verify the reservation chains from the last surviving audit-domain record, then the invocation chains from the reservation.
6. In fixture (c), assert the surviving reservation is the DEC-8 orphan finding, not silently dropped; assert the next pair's ordinal is greater than the surviving reservation's ordinal.
7. Assert a genuinely altered surviving record still breaks (control).

**Expected Outcome**:

- Both operations report their removal in their own evidence; chain verification treats the removal as expected, not as tampering.
- The removal takes trailing invocations and reservations wholesale; no partial frame of either kind survives, and the surviving audit-domain sequence verifies continuously with no re-anchoring failure.
- The next audit-domain pair chains from the last surviving record.
- In fixture (c), the reservation that is the last valid frame survives as the in-band orphan finding and is never silently dropped; the next ordinal is greater than the surviving reservation's ordinal.
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

- A temp audit store with at least ten invocation records (each with its reservation) spanning several commands, all three outcome classes, two `scope` values, and a mix of `repo` values including repo-absent records, plus interleaved non-audit records.
- Each invocation carries a distinct integer-epoch-ms `startedAt`; the fixture uses a known set of start ticks (for example `1000`, `2000`, `3000`, `4000`).
- A read-surface fixture declaring filters and a bound.

**Steps**:

1. Query by the store's recorded `scope` (match) and by a deliberately different scope (no match); assert only matching invocation records return, all verified.
2. Query by command and by outcome class; assert exact match sets and no non-audit or reservation records.
3. Query with an inclusive `[from, to]` `startedAt` window that contains some records and excludes others; assert only records inside the window return.
4. Query with only `from` (unbounded `to`) and only `to` (unbounded `from`); assert each side omits the bound correctly.
5. Query with a bound smaller than the match count; assert the result is clipped to the bound and reports truncation in-band with the returned count and an indication that more matches exist.
6. Query with a bound larger than the match count; assert no truncation flag.
7. Snapshot the ledger and store directory before and after each query; assert no fence was acquired and nothing was written.

**Expected Outcome**:

- Results contain verified invocation records only, matching every declared filter (`scope`, inclusive `startedAt` window, command, outcome class); non-audit kinds, reservations, and non-matching records never leak in.
- The `startedAt` time-window filter uses inclusive bounds; a record exactly at `from` or `to` is included, and an omitted side is unbounded.
- Truncation is reported in-band whenever the bound clips; it is never silently applied.
- Reads acquire no fence, write nothing, and leave the ledger and directory byte-identical.
- The returned evidence names counts and positions only.

**Notes / Clarifications**:

- OQ-T5/OQ-17 is resolved in spec v1.2: `startedAt` is integer epoch milliseconds UTC; window bounds are inclusive `[from, to]` and an omitted side is unbounded. OQ-T11/OQ-14 is resolved: `scope`/`repo` match exactly; repo-absent records are excluded only from repo-constrained results.
- TC-GH223-041 covers the time window and boundary probes in depth; TC-GH223-042 covers scope/repo exactness; TC-GH223-040 covers missing/invalid refusal.
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
2. Read every audit record (both kinds) and serialize each record's JSON.
3. Search for each edge-registered secret value and for obvious encodings.
4. Assert the arguments are present with `[redacted]` substitutions where the edge-registered secrets occurred, and that the unregistered canary remains verbatim (the guarantee is scoped to edge-registered values).
5. Assert the machine output and diagnostics are also secret-free.

**Expected Outcome**:

- No edge-registered secret value appears in any field of any audit record, on success, failure, or broken invocation.
- Arguments reach the ledger only through the redaction chokepoint; the redaction marker is present where secrets occurred.
- Unregistered values are not claimed as redacted (the guarantee stays scoped to the non-empty, unique values registered at the edge).
- The machine channel and diagnostics remain secret-free.

**Notes / Clarifications**:

- OQ-12 is resolved in spec v1.1/v1.2: "no secret patterns" means no edge-registered secret value survives into any record field. No broader pattern scan is invented.

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

#### TC-GH223-033 - No new error-table rows; key open failures and orphan findings reuse existing identities

**Scenario Type**: Contract
**Impact Level**: Important
**Priority**: High
**Related IDs**: F-4, AC-F4-1, AC-F4-2, AC-F5-1, NFR-9; DEC-7, OQ-2
**Test Type(s)**: Contract, Check
**Automation Level**: Automated
**Target Layer / Location**: `tests/checks/error-table-sync.test.ts` (existing — no change expected); `tests/structure/error-table.test.ts` (existing — no change expected); `tests/behaviour/audit-chain.test.ts` (verdict shape)
**Tags**: @contract, @error-table, @audit, @chain

**Preconditions**:

- The machine and documented error tables at the change base.
- The audit chain verification verdict type, the key-open-failure identities, and the read-surface gap/refusal verdict types.

**Steps**:

1. Run the bidirectional error-table sync check and assert zero drift.
2. Assert the error table contains no audit-, chain-, key-artifact-, or reservation-orphan-domain identities and no audit-specific rows; audit failures resolve only to the existing state identities or the existing `input.value.rejected` row for read-surface refusals.
3. Assert every audit/state failure raised by the audit path uses an existing identity (`state.store.torn`, `state.store.unknown`, `state.lock.busy`, `state.storage.exhausted`, `state.write.failed`, `state.permission.denied`, `state.keys.missing`), and read-surface refusals use `input.value.rejected`.
4. Assert the key-artifact open failures use `state.keys.missing`, the `state.store.torn` family, and `state.permission.denied` — no new rows.
5. Assert a chain break is surfaced as a verification verdict/evidence with remediation guidance, not as an `AppErrorCode` table lookup; assert a reservation orphan is an in-band read-surface finding, not an error code.
6. Mutation control: drop or add a row in a temp copy and assert the sync check fails.

**Expected Outcome**:

- The tables remain in bidirectional sync with zero drift; no audit-, chain-, key-artifact-, or orphan-domain identities are introduced.
- Chain breaks, record gaps, and reservation-orphan findings are read-surface verdicts/evidence; read-surface refusals reuse `input.value.rejected`.
- Every audit-path state failure reuses an existing state identity, including the three key-artifact open-failure classes.
- The mutation control proves the sync check is non-vacuous for the touched surface.

---

#### TC-GH223-034 - Tier/boundary conformance; audit read is library-only; key artifact uses the store-layout path

**Scenario Type**: Contract
**Impact Level**: Important
**Priority**: High
**Related IDs**: F-5, AC-F5-1, NFR-9, DM-1, DM-5, DM-6; DEC-5, DEC-6; NG-3
**Test Type(s)**: Structure, Boundary
**Automation Level**: Automated
**Target Layer / Location**: `tests/structure/audit-contract.test.ts` (new), `tests/structure/audit-imports.test.ts` (new), `tests/structure/audit-surface.test.ts` (new); `tests/boundaries` when any import edge changes
**Tags**: @structure, @boundary, @audit, @architecture

**Preconditions**:

- The delivered audit modules, contracts, state modules, CLI command registry, and key-artifact module.
- The delivered key-artifact path constant for `chain-key.<workspace>.json`.

**Steps**:

1. Assert the audit record/chain vocabulary lives in runtime-neutral contracts (types/data only; no I/O, clock, randomness, or environment access), declaring both `audit.invocation` and `audit.reservation`.
2. Assert the audit consumer imports the public state port and its own modules only; no driver module, no runtime-API location, no driver discriminant. The key artifact is the store-layout `chain-key.<workspace>.json` member created/read through the port's store-managed artifact path, not a new runtime API.
3. Assert `packages/core/src/state/**` does not import branding; identity naming is resolved at the edge.
4. Assert no audit CLI command is registered in `packages/cli/src/commands/**` and no command name for audit appears in the program registry.
5. Assert the audit identity type does not appear in `packages/core/src/contracts/credentials.ts`, the config resolver, or any policy/authorization module; it is confined to audit record and read types. Assert the chaining-key type is confined to the state/edge modules and is not exported through the runtime-neutral contracts.
6. Assert the key-artifact path matches the store-layout family (`chain-key.<workspace>.json` beside `header.<workspace>.json` and `fence.<workspace>.lock`) and is not a documents-path or driver-specific path.
7. Run `bun test tests/boundaries` if any package/subpath edge changed.

**Expected Outcome**:

- Contracts stay runtime-neutral; the audit consumer composes only the public state port; the state tier stays branding-free.
- No new runtime-API location, driver discriminant, or CLI audit command exists; the key artifact uses the store-layout path through the port.
- The identity vocabulary is not wired into authorization/credential paths; the chaining-key type stays out of contracts.
- Boundary rules and fixture coverage remain green.

---

#### TC-GH223-035 - `startedAt` is the injected clock's integer epoch-millisecond UTC start, recorded exactly once

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

**Steps**:

1. Run the command through `runCli`; read the invocation record.
2. Assert the record has exactly one `startedAt` field.
3. Assert `startedAt` is the integer `1000` (epoch milliseconds UTC), not a date string or a floating-point value; assert `timing.totalMs` is `13` (the separate timing value).
4. Re-read the record and assert `startedAt` is stable.
5. Scan the audit assembly/write modules for ambient clock reads (`Date.now`, `new Date()` without the injected value, `performance.now`); assert none; the value comes from the injected clock.
6. Mutation control: a temp-copy module using `Date.now()` is detected by the scan.

**Expected Outcome**:

- `startedAt` is the invocation's start instant from the injected clock as an integer epoch-millisecond UTC value, recorded exactly once.
- It is the start tick, not the finish tick; `timing` continues to use both ticks.
- No ambient clock read exists in the audit path; the injected clock is the only source.
- Re-reads return the same `startedAt`.

**Notes / Clarifications**:

- OQ-17 is resolved in spec v1.2: `startedAt` is integer epoch milliseconds UTC, the same discipline as `timing.totalMs`. No serialization ambiguity remains.

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
2. Read the invocation records and their reservations.
3. Assert each invocation's `startedAt` is the integer epoch-millisecond value of its own start tick (`1000`, `2000`).
4. Assert the two `startedAt` values are distinct and the two reservation/invocation pairs carry `auditSeq` `1` and `2`.
5. Assert the runIds are distinct and neither pair overwrote the other.

**Expected Outcome**:

- The re-run records its own distinct integer-epoch-ms `startedAt`; no timestamp is reused or defaulted.
- `auditSeq` advances monotonically (`1`, then `2`) and remains gap-free when both reservation/invocation pairs succeed.
- The invocation records remain distinguishable by runId and are not deduplicated.

**Notes / Clarifications**:

- The failed-append case (where an ordinal is consumed but the invocation is absent) is TC-GH223-039/043; the failed-reservation case (nothing consumed) is TC-GH223-044. Both are pinned by v1.2's reservation-first mechanism.

---

#### TC-GH223-037 - `chain-key.<workspace>.json` is created once, persisted 0600, verified on open, and never exported

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
- The delivered `chain-key.<workspace>.json` path constant and read helper.
- A synthetic success command.
- Copies of the store for the three open-failure fixtures.

**Steps**:

1. Run one invocation; assert exactly one `chain-key.<workspace>.json` artifact exists, it is non-empty, and its file mode is `0600` (directory `0700`).
2. Read the artifact bytes; run a second invocation; assert the artifact bytes and modification identity are unchanged (the key was created once, not regenerated).
3. Open a second store/edge instance over the same temp root; verify the audit-domain chain (reservations and invocations); assert verification succeeds with the same artifact.
4. Walk both record kinds' payloads, the configuration snapshot, the ambient environment map, and the lane environment fixture; assert the key value and obvious encodings are absent.
5. **Open-failure fixtures:** (a) remove the artifact from a store that already has audit records (non-first open) and assert the audit path fails `state.keys.missing`; (b) truncate/corrupt the artifact and assert the failure is in the `state.store.torn` family; (c) change the artifact mode away from `0600` and assert `state.permission.denied` (POSIX only).
6. Negative control: a copy with a different key artifact makes verification fail; the unmodified store still passes.

**Expected Outcome**:

- The key artifact is created once on the store's first audit append as the store-layout `chain-key.<workspace>.json`, under least-privilege permissions (`0600` file / `0700` directory).
- Later appends and later store/edge instances reuse the same artifact; the key is never regenerated.
- The key never appears in either record kind's payloads, configuration, ambient environment, or lane environment.
- Open failures reuse existing identities: absent on a non-first open → `state.keys.missing`; corrupt/unparsable → the `state.store.torn` family; wrong permission bits → `state.permission.denied`. No new error-table row is introduced.
- Verification succeeds across the reopened store/edge; a different key fails.

**Notes / Clarifications**:

- OQ-16/OQ-19 are resolved in spec v1.2: the artifact is `chain-key.<workspace>.json` in the store-layout family, and the three open-failure identities are pinned to existing state rows. TC-GH223-047 isolates the three failure cases; TC-GH223-033 keeps the no-drift assertion.

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

- A temp store written by edge/store instance A (three reservation/invocation pairs).
- Fresh edge/store instances B and C over the same temp root (cross-process modeled without spawning).
- The store-managed `chain-key.<workspace>.json` artifact from A.

**Steps**:

1. Write three audit-domain pairs with instance A; close/dispose A.
2. Open instance B; verify the chain over A's reservation and invocation records; assert zero breaks and zero false chain-break flags.
3. Append a fourth pair with B; assert its reservation chains from A's third invocation, the invocation chains from the reservation, and the pair carries `auditSeq` 4.
4. Open instance C; verify all four pairs; assert zero breaks.
5. Negative control: a copy whose key artifact is replaced with a different key fails verification; the unmodified store still passes.

**Expected Outcome**:

- Records written by an earlier instance (both kinds) verify from a later instance with zero false chain-break flags.
- The durable key artifact is reused, not regenerated; the chain is continuous across the instance boundary.
- A different key fails verification (key sensitivity), proving the cross-instance pass is not vacuous.
- No process is spawned; the case exercises the durable artifact and fresh store/edge instances.

**Notes / Clarifications**:

- This is the v1.2 cross-process continuity case required by AC-F4-2/Appendix B. It uses fresh store/edge instances over the same temp root, consistent with the repository's no-spawn rule.

---

#### TC-GH223-039 - Two-phase append failure matrix: orphan reservation vs failed reservation

**Scenario Type**: Negative
**Impact Level**: Critical
**Priority**: Critical
**Related IDs**: F-1, F-5, AC-F1-1, AC-F5-1, DM-1, DM-6, EVT-1, EVT-2, NFR-1; DEC-8
**Test Type(s)**: Integration
**Automation Level**: Automated
**Target Layer / Location**: `tests/behaviour/audit-ordinal-gap.test.ts` (new)
**Tags**: @backend, @audit, @ordinal, @degradation

**Preconditions**:

- A temp audit store and a synthetic success command.
- Two fixtures: (a) the invocation append fails after its reservation lands; (b) the reservation append itself fails (nothing consumed).
- A second-append fault wrapper over `createTestEdge` that raises `append-before-flush` only on the invocation append for fixture (a), and on the reservation append for fixture (b).

**Steps**:

1. **Fixture (a), orphan reservation:** run invocation 1 successfully; assert its pair uses `auditSeq` `1`. Arm the second-append fault. Run invocation 2; assert the command still succeeds with exit code `0`, its `data` line is emitted, the diagnostics carry the classified state identity, no invocation record landed, and the reservation with `auditSeq` `2`, runId 2, and a `chainValue` is present. Disarm.
2. Query the read surface; assert an in-band finding names the orphaned reservation's `auditSeq` `2` and runId, and that no error-table row/code is introduced.
3. Run invocation 3; assert its pair uses `auditSeq` `3`, proving the ordinal advanced past the orphan.
4. **Fixture (b), failed reservation:** run invocation 1 successfully (`auditSeq` `1`). Arm the first-append fault. Run invocation 2; assert the command still succeeds with exit code `0`, the diagnostics carry the classified state identity, and neither a reservation nor an invocation landed. Disarm.
5. Query the read surface; assert there is no orphan finding (nothing was consumed). Run invocation 3; assert its pair uses `auditSeq` `2` — the failed attempt's ordinal was reallocated, with no gap.
6. In both fixtures, assert no partial frame survives and the read acquires no fence and writes nothing.

**Expected Outcome**:

- **Scenario (a):** the reservation lands, the invocation is absent, and the reservation orphan is the durable skipped-ordinal finding; the next pair's ordinal is `3`; the command outcome and exit code are unchanged.
- **Scenario (b):** the reservation itself fails, nothing is consumed, no gap finding is reported, and the next pair reuses ordinal `2`; the command outcome and exit code are unchanged.
- Both failures are loud with an existing state identity; neither introduces an error-table row.
- Exactly-once counts invocation records only; the degraded invocation is explicitly absent in (a) and fully absent in (b).

**Notes / Clarifications**:

- OQ-15 resolves the former ordinal-durability gap: the two-phase append makes ordinal consumption durable ledger truth, so both failure modes are now testable. The second-append fault wrapper is a test-only edge decorator; no process is spawned. TC-GH223-043/044 isolate each scenario in depth.

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
3. Query with each invalid filter: an unknown outcome class, a malformed/non-integer `startedAt` bound, a window whose start is after its end, a non-string `scope`/`repo`. An entirely omitted window is **valid** (unfiltered on time) and must not be listed as invalid.
4. Assert each refusal is classified `input.value.rejected` (user/validation identity) and matches the existing table entry; no records are returned.
5. Assert no fence is acquired, nothing is written, and no new error-table row exists.
6. Negative control: an equivalent valid query succeeds, proving the refusal is specific.

**Expected Outcome**:

- Missing or invalid bounds and filter values are refused with the existing `input.value.rejected` identity — no new table row, no silent unbounded result.
- Negative, non-integer, and non-number bounds refuse; bound `0` either refuses or returns an explicit empty result, never the full ledger.
- Refusals return no records and write nothing.
- A valid query with the same filters/bound succeeds, proving the validator is not vacuous.

**Notes / Clarifications**:

- OQ-6/OQ-T3 is resolved in spec v1.2: `input.value.rejected` is the refusal identity. The exact validation boundary (which malformed values are rejected, including whether bound `0` is invalid) is pinned at delivery; the cases above are the enumerated obvious classes and the 0 probe records the delivered rule.

---

#### TC-GH223-041 - `startedAt` time window is inclusive `[from,to]` with an omitted side unbounded

**Scenario Type**: Happy Path
**Impact Level**: Important
**Priority**: High
**Related IDs**: F-5, AC-F1-4, AC-F5-1, NFR-7
**Test Type(s)**: Integration
**Automation Level**: Automated
**Target Layer / Location**: `tests/behaviour/audit-read-time-window.test.ts` (new)
**Tags**: @backend, @audit, @read-surface, @time-window

**Preconditions**:

- A temp store with invocation records whose integer-epoch-ms `startedAt` values are `1000`, `2000`, `3000`, and `4000`, each with its reservation, plus interleaved non-audit records.
- A read-surface fixture declaring a `startedAt` window and a bound.

**Steps**:

1. Query the inclusive window `[2000, 3000]`; assert the `2000` and `3000` records return (both boundary records included) and `1000`/`4000` do not.
2. Query `[1001, 2999]`; assert only the `2000` record returns, proving inclusive boundaries in practice.
3. Query `[0, 500]` and `[4500, 5000]`; assert each returns an explicit verified-empty result, not an error or a silent zero.
4. Query with only `from = 2500`; assert `3000` and `4000` return (unbounded `to`). Query with only `to = 2500`; assert `1000` and `2000` return (unbounded `from`).
5. Query with the window plus a `scope` filter and a bound; assert the filters compose and truncation is reported in-band.

**Expected Outcome**:

- The time-window filter operates on integer-epoch-ms `startedAt` with inclusive `[from, to]` bounds; records exactly at either boundary are included.
- An omitted `from` or `to` is unbounded on that side; a query with neither is unfiltered on the time dimension.
- Empty windows return verified-empty, not torn/unknown and not an error.
- The window composes with `scope` and the bound; truncation stays in-band.
- Reservations never appear as results; only invocation records are filtered.

**Notes / Clarifications**:

- OQ-17 is resolved in spec v1.2: inclusive `[from, to]`, omitted side unbounded, integer epoch milliseconds UTC. No boundary-rule ambiguity remains.

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

- A temp store with four invocation records (each with its reservation): (A, repo R1), (A, repo absent), (B, repo R2), (A, repo R2).
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
- The filter results are verified invocation records only; reservations and non-audit kinds never leak in.

**Notes / Clarifications**:

- OQ-14/OQ-T11 is resolved in spec v1.2: exact-match semantics with repo-null exclusion from repo-constrained results only.

---

#### TC-GH223-043 - Reservation-orphan scenario: invocation append fails after the reservation lands

**Scenario Type**: Negative
**Impact Level**: Critical
**Priority**: Critical
**Related IDs**: F-1, F-5, AC-F1-1, AC-F5-1, DM-6, EVT-2, NFR-1; DEC-8
**Test Type(s)**: Integration
**Automation Level**: Automated
**Target Layer / Location**: `tests/behaviour/audit-reservation-orphan.test.ts` (new)
**Tags**: @backend, @audit, @reservation, @ordinal

**Preconditions**:

- A temp audit store and a synthetic success command.
- A second-append fault wrapper over `createTestEdge` that raises `append-before-flush` only on the invocation append, leaving the reservation append untouched.
- Invocation 1 succeeds; invocation 2's invocation append fails; invocation 3 succeeds.

**Steps**:

1. Run invocation 1; assert its reservation/invocation pair uses `auditSeq` `1`.
2. Arm the second-append fault; run invocation 2; assert the command succeeds with exit code `0`, its `data` line is emitted, the diagnostics carry `state.write.failed`, no invocation record landed, and the reservation with `auditSeq` `2`, runId 2, and a `chainValue` is present.
3. Assert the reservation payload is `{auditSeq, runId, chainValue}`: `chainValue` is present and non-empty; there are **no invocation metadata** fields — no arguments, no outcome, no identity. Assert the reservation's `chainValue` chains from the preceding audit-domain record and the invocation (when present) chains from its reservation.
4. Disarm; query the read surface unfiltered; assert the in-band finding names the orphaned reservation's `auditSeq` `2` and runId 2. Repeat with a `scope`/`repo`/`startedAt` filter that matches no invocation; assert the orphan finding is still reported (findings are not filtered).
5. Verify the chain over the surviving audit-domain sequence; assert zero breaks — the orphan is a finding, not a chain break; assert the orphan's own `chainValue` is what keeps it alteration-detected.
6. Run invocation 3; assert its pair uses `auditSeq` `3`, proving the ordinal advanced past the orphan.
7. Assert exactly one `audit.invocation` exists for invocations 1 and 3 and none for invocation 2; assert no partial invocation frame survives.
8. Assert no error-table row/code is introduced; the read acquires no fence and writes nothing.

**Expected Outcome**:

- The reservation lands and the invocation is absent: the reservation orphan is the durable DEC-8 skipped-ordinal finding, naming `auditSeq` 2 and the runId; it is reported even when the query filters would match no invocation record.
- The reservation carries `{auditSeq, runId, chainValue}` and no invocation metadata (no args, no outcome, no identity); its `chainValue` is required and chains from the preceding audit-domain record.
- The command's outcome and exit code are unchanged; the failure is loud with `state.write.failed`.
- The chain verifies over the surviving sequence; the orphan is not a chain break, and its own `chainValue` preserves alteration detection.
- The next pair's ordinal is `3`; exactly-one counts invocation records only, so the degraded invocation is explicitly absent.
- No partial frame, no new error-table row, no read-side fence or write.

**Notes / Clarifications**:

- This isolates scenario (a) of DEC-8; TC-GH223-039 covers the decision matrix and TC-GH223-044 covers scenario (b). The fault wrapper is test-only edge decoration; no process is spawned.

---

#### TC-GH223-044 - Reservation-failure scenario: reservation append fails, nothing consumed, no gap claimed

**Scenario Type**: Negative
**Impact Level**: Critical
**Priority**: Critical
**Related IDs**: F-1, AC-F1-1, DM-6, EVT-2, NFR-1; DEC-8
**Test Type(s)**: Integration
**Automation Level**: Automated
**Target Layer / Location**: `tests/behaviour/audit-reservation-failure.test.ts` (new)
**Tags**: @backend, @audit, @reservation, @ordinal

**Preconditions**:

- A temp audit store and a synthetic success command.
- A first-append fault wrapper over `createTestEdge` that raises `append-before-flush` on the reservation append.
- Invocation 1 succeeds; invocation 2's reservation append fails; invocation 3 succeeds.

**Steps**:

1. Run invocation 1; assert its pair uses `auditSeq` `1`.
2. Arm the first-append fault; run invocation 2; assert the command succeeds with exit code `0`, its `data` line is emitted, the diagnostics carry `state.write.failed`, and neither a reservation nor an invocation landed.
3. Disarm; query the read surface; assert there is **no** orphan finding and no skipped-ordinal finding.
4. Run invocation 3; assert its pair uses `auditSeq` `2` — the failed attempt consumed nothing, so the ordinal was reallocated with no gap.
5. Assert no error-table row/code is introduced and no partial frame survives.

**Expected Outcome**:

- The reservation itself fails: nothing is consumed, no gap is claimed, and the read surface reports no orphan.
- The command's outcome and exit code are unchanged; the failure is loud with `state.write.failed`.
- The next pair reuses `auditSeq` `2`, proving the ordinal was not consumed.
- Exactly-one counts invocation records only; the degraded invocation is fully absent.

**Notes / Clarifications**:

- This isolates scenario (b) of DEC-8; TC-GH223-039 covers the decision matrix and TC-GH223-043 covers scenario (a). The test must not assert a gap finding here.

---

#### TC-GH223-045 - Altered reservation record with recomputed checksum is flagged as a chain break with position

**Scenario Type**: Negative
**Impact Level**: Critical
**Priority**: Critical
**Related IDs**: F-4, AC-F4-1, DM-2, DM-6, EVT-2, NFR-3
**Test Type(s)**: Integration
**Automation Level**: Automated
**Target Layer / Location**: `tests/behaviour/audit-chain-reservation.test.ts` (new)
**Tags**: @backend, @audit, @chain, @tamper, @reservation

**Preconditions**:

- A verified clean audit ledger containing reservation/invocation pairs; each reservation payload is `{auditSeq, runId, chainValue}`.
- A mutation helper that edits a *reservation* record's payload (e.g. `auditSeq` or `runId`), recomputes the state layer's unkeyed checksum so the store still reads as framing/checksum-clean, and leaves the reservation's `chainValue` unchanged.

**Steps**:

1. Verify the clean ledger: zero breaks; assert each reservation carries `{auditSeq, runId, chainValue}`.
2. Apply the reservation mutation at a known audit position (not the first).
3. Verify again; inspect the break evidence.
4. Assert records before the break remain verified-readable.
5. Repeat with a mutation that makes the reservation's `auditSeq` differ from its invocation's `auditSeq`; assert the chain breaks at the altered reservation.
6. Run the clean control last and assert it still verifies.

**Expected Outcome**:

- The reservation mutation is flagged as a chain break naming the reservation position; the reservation's own stored `chainValue` is the link that breaks, so a tampered reservation is as detectable as a tampered invocation.
- The unkeyed checksum being recomputed does not produce a false "verified" verdict.
- Evidence names the position only — never payload content or checksum bytes.
- Records before the break remain verified-readable; the clean control verifies.

**Notes / Clarifications**:

- TC-GH223-024 is the invocation-record counterpart; TC-GH223-049 is the orphan-reservation counterpart. Together they cover both audit kinds and the orphan state. The chain is a continuous link sequence across reservation and invocation records, with invocation links chaining from their reservations.

---

#### TC-GH223-046 - Derived-document rebuild preserves the reservation-orphan finding

**Scenario Type**: Corner Case
**Impact Level**: Critical
**Priority**: Critical
**Related IDs**: F-5, AC-F5-1, DM-6, EVT-2, NFR-1, NFR-8; DEC-8
**Test Type(s)**: Integration
**Automation Level**: Automated
**Target Layer / Location**: `tests/behaviour/audit-rebuild-orphan.test.ts` (new)
**Tags**: @backend, @audit, @read-surface, @rebuild

**Preconditions**:

- A temp store containing a reservation orphan (scenario (a)) and a valid derived index.
- Helpers to delete and corrupt the derived index/documents without touching the ledger.

**Steps**:

1. Create the orphan reservation via the second-append fault; assert the read surface reports the finding.
2. Delete the derived index (and any derived documents), then perform a fresh verified read; assert the orphan finding is still reported with the same `auditSeq`/runId.
3. Corrupt the derived index, then perform a verified read; assert the rebuild occurs from the ledger and the finding persists.
4. Reopen the store with a fresh store/edge instance; assert the finding persists.
5. Assert no derived document carries ordinal truth and the read added no audit record/fence.

**Expected Outcome**:

- The orphan finding is folded from verified ledger truth on every read; deleting or corrupting a derived document does not lose it.
- A rebuilt store reports the same orphan `auditSeq`/runId.
- Nothing derived carries ordinal truth; the ledger remains the source.
- The read acquires no fence and writes no audit record (index rebuild, if any, is a derived write and is reported separately per TR-12).

**Notes / Clarifications**:

- This is the v1.2 rebuild-durability assertion: reservation and invocation records are both ledger truth, so gap evidence survives derived-document rebuild by construction.

---

#### TC-GH223-047 - Key-artifact open failures reuse existing state identities

**Scenario Type**: Negative
**Impact Level**: Critical
**Priority**: Critical
**Related IDs**: F-4, AC-F4-2, DM-5, NFR-4, NFR-9; DEC-7
**Test Type(s)**: Integration, Contract
**Automation Level**: Automated
**Target Layer / Location**: `tests/behaviour/audit-key-open-failures.test.ts` (new); `tests/fixtures/state/harness.ts`
**Tags**: @backend, @audit, @chain, @security, @key-artifact

**Preconditions**:

- Three copies of a store that already has audit-domain records and a valid `chain-key.<workspace>.json` artifact, plus one empty store with no prior audit append for the first-append creation check.
- POSIX permissions available for the wrong-bits fixture.

**Steps**:

1. **Absent on non-first open:** remove the artifact from copy (a); open/read the store; assert `state.keys.missing`. Assert that a store with no audit records still creates the artifact on its first audit append (creation unchanged); a bare open does not create it.
2. **Corrupt/unparsable:** truncate or replace the artifact with invalid bytes in copy (b); open/read; assert the failure is in the `state.store.torn` family.
3. **Wrong permission bits:** change the artifact mode away from `0600` in copy (c); open/read; assert `state.permission.denied` (POSIX only; record the platform conditional).
4. Assert none of the three failures introduces a new error-table row; assert the valid copy still verifies.
5. Run the error-table sync check and assert zero drift (TC-GH223-033 owns the broader no-drift assertion).

**Expected Outcome**:

- Absent on a non-first open → `state.keys.missing`; corrupt/unparsable → `state.store.torn` family; wrong bits → `state.permission.denied`.
- All three reuse existing state identities; no new rows.
- First-open creation is unchanged; a valid artifact still verifies.
- The failures are classified and loud, not silent.

**Notes / Clarifications**:

- OQ-16 resolves the key-open-failure semantics. TC-GH223-037 covers creation, `0600`, reuse, and successful verification; this case isolates the three open failures.

---

#### TC-GH223-048 - Surviving-tail reservation after salvage remains the DEC-8 finding

**Scenario Type**: Corner Case
**Impact Level**: Critical
**Priority**: Critical
**Related IDs**: F-4, F-5, AC-F4-3, AC-F5-1, DM-6, EVT-2, NFR-8; DEC-8
**Test Type(s)**: Integration
**Automation Level**: Automated
**Target Layer / Location**: `tests/behaviour/audit-salvage-reservation.test.ts` (new)
**Tags**: @backend, @audit, @salvage, @reservation, @ordinal

**Preconditions**:

- A store with valid audit-domain pairs, then a reservation whose invocation is torn or never landed, so the reservation is the last valid frame.
- The explicit `salvage` operation and its evidence.

**Steps**:

1. Verify the chain over the valid prefix; assert the pre-salvage torn read classifies.
2. Invoke `salvage`; read the operation evidence (truncation position/extent).
3. Assert the reservation survives as the last valid frame; assert no partial invocation frame survives.
4. Query the read surface; assert the surviving reservation is reported as the DEC-8 orphan finding naming its `auditSeq`/runId.
5. Verify the chain over the surviving sequence; assert the reported removal is not a chain break and verification is continuous.
6. Append a new pair; assert its `auditSeq` is greater than the surviving reservation's ordinal and it chains from the surviving reservation.
7. Assert the reservation is never silently dropped by a read.

**Expected Outcome**:

- Salvage removes trailing invocations and reservations wholesale but leaves the last-valid-frame reservation intact.
- The surviving reservation is durable gap evidence, reported in-band by the read surface; it is never silently dropped.
- Chain verification is continuous over the surviving sequence; the reported removal is not a break.
- The next pair chains from the surviving reservation and uses a greater ordinal.

**Notes / Clarifications**:

- This isolates the OQ-18 corollary pinned in v1.2; TC-GH223-027 covers wholesale removal and repair continuity.

---

#### TC-GH223-049 - Altered orphan reservation is flagged as a chain break with position

**Scenario Type**: Negative
**Impact Level**: Critical
**Priority**: Critical
**Related IDs**: F-4, AC-F4-1, DM-2, DM-6, EVT-2, NFR-3
**Test Type(s)**: Integration
**Automation Level**: Automated
**Target Layer / Location**: `tests/behaviour/audit-chain-reservation-orphan.test.ts` (new)
**Tags**: @backend, @audit, @chain, @tamper, @reservation

**Preconditions**:

- A store with an orphan reservation (reservation landed, its invocation absent) and no following audit-domain record.
- The orphan reservation payload carries `{auditSeq, runId, chainValue}`, with `chainValue` chaining from the preceding audit-domain record (or the store chain anchor if it is the first record).
- A mutation helper that edits the orphan reservation's `auditSeq`/`runId`, recomputes the state layer's unkeyed checksum, and leaves the reservation's `chainValue` untouched.

**Steps**:

1. Verify the clean ledger; assert the orphan finding is reported and the reservation's `chainValue` is present.
2. Apply the mutation to the orphan reservation.
3. Verify the chain again.
4. Assert the alteration is flagged as a chain break naming the reservation position; assert no false "verified" verdict.
5. Assert the finding/evidence names the position only — never payload or checksum bytes.
6. Run the clean control last and assert it verifies with the original orphan finding.

**Expected Outcome**:

- The altered orphan reservation is flagged as a chain break naming its position; the reservation's own stored `chainValue` is the keyed evidence, so an orphan is as tamper-evident as a paired reservation.
- The orphan finding remains durable, but the tamper is flagged rather than accepted as verified.
- Evidence names positions only.

**Notes / Clarifications**:

- OQ-20 (v1.3) resolves the former MR-1: the reservation payload is `{auditSeq, runId, chainValue}`, so an orphan reservation remains alteration-detected. TC-GH223-045 covers the paired reservation; this case covers the orphan.

---

#### TC-GH223-050 - Command filter exact-matches raw-token broken invocations

**Scenario Type**: Edge Case
**Impact Level**: Important
**Priority**: High
**Related IDs**: F-5, AC-F5-1, NFR-7; OQ-21
**Test Type(s)**: Integration
**Automation Level**: Automated
**Target Layer / Location**: `tests/behaviour/audit-read-command-filter.test.ts` (new)
**Tags**: @backend, @audit, @read-surface, @filters

**Preconditions**:

- A temp store with invocation records for successful commands `status` and `status-extra`.
- Broken-invocation records whose recorded `command` is the raw first token: `--wat` (leading-dash token) and `unknown-cmd` (unknown command).
- A read-surface fixture declaring a command filter and a bound.

**Steps**:

1. Query `command = "status"`; assert only the `status` record returns, not `status-extra`.
2. Query `command = "status-extra"`; assert only that record returns.
3. Query `command = "stat"` (prefix) and `command = "Status"` (case difference); assert each returns no records, proving exact match with no normalization or wildcard.
4. Query `command = "--wat"`; assert the broken-invocation record whose recorded raw first token is `--wat` returns.
5. Query `command = "unknown-cmd"`; assert that broken-invocation record returns.
6. Compose the command filter with a `scope` filter and a bound; assert the filters compose and truncation stays in-band.

**Expected Outcome**:

- The command filter matches the recorded command token exactly; no prefix, case folding, inference, or wildcard behavior.
- Raw first tokens recorded for broken invocations are filterable by their recorded token, including a leading `-`.
- No non-matching invocation, reservation, or non-audit record leaks into the result.
- The filter composes with `scope` and the bound; truncation is reported in-band.

**Notes / Clarifications**:

- OQ-21 is resolved in spec v1.4: command filtering is exact against the recorded token, including raw-token broken invocations.

---

### 5.3 Seeded Scenario Inheritance (SC-M1-23)

The milestone pack's SC-M1-23 ("every invocation audited; scripted output trimmed") is the seeded scenario for M1-S22 and is inherited, not restated as a new scenario id. Its Given/When/Then maps to TC-GH223-022, which is the end-to-end case (scripted `lanes list --json` through a lane shell carrying the identity convention; exactly one `audit.invocation` plus its preceding `audit.reservation` with the same ordinal; one minified `{"data":...}` line; the failure line keeps `runId` as a top-level key; identity present with the `claimed` marker and absent-never-inferred; re-run yields a second pair with a new runId and distinct integer-epoch-ms timestamp/ordinal; no edge-registered secret in either record). The scenario's assertion families are extended by the rest of this plan:

| SC-M1-23 assertion family | Inheriting / extending TCs |
|---------------------------|----------------------------|
| Exactly one `audit.invocation` per invocation (reservations never counted) | TC-GH223-001, TC-GH223-002, TC-GH223-003, TC-GH223-004, TC-GH223-022 |
| Record carries runId, command, redacted args, exit, timing, `resultSchemaVersion`, integer-epoch-ms `startedAt`, `auditSeq`, identity | TC-GH223-001, TC-GH223-005, TC-GH223-011, TC-GH223-014, TC-GH223-022, TC-GH223-035, TC-GH223-036 |
| Scripted success is one minified `{"data":...}` line without schemaVersion/runId/timing | TC-GH223-014, TC-GH223-015, TC-GH223-022 |
| Error line keeps runId as a top-level key | TC-GH223-016, TC-GH223-017, TC-GH223-022 |
| Identity captured when present with the `claimed` marker | TC-GH223-011, TC-GH223-013, TC-GH223-022 |
| Absent, empty, and whitespace-only identity are never inferred | TC-GH223-012, TC-GH223-022 |
| Re-run produces a second pair with a new runId, distinct `startedAt`, and later `auditSeq` | TC-GH223-006, TC-GH223-022, TC-GH223-036 |
| No edge-registered secret patterns in either record | TC-GH223-031, TC-GH223-032, TC-GH223-022 |
| Extensions beyond the seeded text: all outcome classes, interactive/override modes, golden/conformance both modes, two-phase reservation/ordinal failure modes, both-kind chain, durable key/open failures, rebuild durability, salvage-tail reservation, bounded reads with time-window/scope/repo/command-exact/refusal | TC-GH223-007..010, TC-GH223-018..021, TC-GH223-023..034, TC-GH223-037..050 |

Rules honored here:

- The scenario id `SC-M1-23` is stable and cited verbatim in the test titles/describes of TC-GH223-022.
- Divergence after delivery is a defect, not a test-plan choice. The stand-in `lanes list` program is the only substitution; it exists because the real command ships later, and it preserves the scenario's shape (`lanes list --json` through an agent shell).
- The seeded scenario's "no secret patterns" wording is resolved by OQ-T9/OQ-12: tests assert no edge-registered secret value survives into any record field; a broader pattern scan is not invented.

## 6. Environments and Test Data

- **Runtime**: Bun pinned by `.bun-version`; `bun test` (or `pnpm test`) for `tests/**/*.test.ts`. No external services, no network, no process spawning, no real process streams.
- **Directories**: every audit store lives under a per-test `mkdtempSync` root labelled with the `gh223-` prefix; teardown removes it recursively. No test writes the repository tree, the user state directory, or the live ledger.
- **State fixtures**: `tests/fixtures/state/harness.ts` supplies `createTestEdge` (`arm`, `armExhaustion`, `disarm`, `raised`, mutable clock), `makeIdentity`, `openStore`, `withinFence`, `ledgerPath`, `ledgerText`, `ledgerLines`, `ledgerBytes`, `ledgerDigest`, `independentChecksum`, `digestPaths`, `listStoreFiles`, `quarantineDirectory`, `quarantineFiles`, `salvageTail`. v1.2 adds audit helpers: `makeAuditStore`, `seedAuditPairs`, `auditRecordsOf`, `auditPairs`, `reservationOrphans`, `mutateAuditRecord`, `tamperWithRecomputedChecksum`, `assertNoChainBreak`, `keyArtifactPath` (`chain-key.<workspace>.json`), `readKeyArtifact`, `keyArtifactMode`, `removeKeyArtifact`, `corruptKeyArtifact`, `chmodKeyArtifact`, `reopenStore`, `armSecondAppendFault`, and `chainVerdict` (names fixed at delivery).
- **CLI fixtures**: `tests/golden/helpers.ts` supplies `runCase`, `runDescriptor`, `bufferSink`, `programFor`, `loadProgram`, `SYNTHETIC_BRAND`. This change extends the injected fact type with `mode` (interactive/scripted), `environment` (string map), and `startTicks`/`startedAt` fixtures; each golden run creates its own temp audit store, and the store generates its own `chain-key.<workspace>.json`, so no fixture directory is a live store and no key is committed.
- **New audit fixtures**: `tests/fixtures/audit/cases.json` (outcome/identity/time-window/scope/repo/bounds matrix), `tests/fixtures/audit/mutations.json` (declarative tamper matrix covering both kinds), `tests/fixtures/audit/reservations.json` (reservation orphan/failed-reservation cases), `tests/fixtures/audit/key-open-failures.json` (absent/corrupt/wrong-bits fixture descriptors), and `tests/fixtures/audit/lane-environment.json` (declared lane variables only). A unit-only key fixture may live in `tests/fixtures/audit/chain-keys.json` for the pure chain half; integration cases read the store-generated artifact. Fixtures are never named `*.test.ts`.
- **Golden fixtures**: existing `tests/fixtures/result/envelopes/**` cases gain `mode` in `injected.json`/`meta.json` and remain interactive goldens. New scripted cases: `scripted-success-data`, `scripted-success-void`, `scripted-classified-user`, `scripted-classified-platform`, `scripted-unknown-failure`, `scripted-broken-unknown-command`, `scripted-broken-unknown-flag`, `scripted-broken-missing-value`, `scripted-broken-conflicting-flags`. Scripted failure goldens carry the top-level key set `{"error":..., "runId":...}`. Every case keeps a `stdout.json`; no case may be skipped.
- **Stand-in program**: `tests/fixtures/result/programs/lanes-list.json` models `lanes list --json` for SC-M1-23; it returns a deterministic data payload and declares no real `lanes` behaviour.
- **Identity variable**: name = `SYNTHETIC_BRAND.environmentPrefix` + the delivered suffix constant; values are obviously fake (`pm-lane-7`, `qa-lane-3`) and never derived from the host. The record stores `agentIdentity` as the verbatim value plus the `claimed` marker; absent, empty, and whitespace-only environments are separate fixtures.
- **Chaining key**: durable store-managed key material generated at the runtime edge on the first audit append and persisted as the store-layout `chain-key.<workspace>.json` artifact with `0600`; it is not injected from configuration or the environment. Tests read the artifact through the delivered helper (single-user trust model). A second, different key artifact is used for the negative control; no real key is committed. Open-failure fixtures remove, corrupt, or chmod the artifact.
- **Secrets**: obviously fake edge-registered tokens matching the `planted-fake-` prefix; registered at the edge through the existing secret-registration seam. An unregistered canary is included to prove the guarantee's boundary. No real credentials or user data.
- **Fault injection**: only named `StateEdgeFaultPoint` values. `append-before-flush` is used with generic `arm` (write failure) and `armExhaustion` (storage exhaustion); the two-phase tests use `armSecondAppendFault` to raise only on the invocation append (or only on the reservation append for scenario (b)); shared-fence contention is produced by holding the audit fence from a second store instance; salvage/repair use the existing operations. Tests assert both the resulting outcome and that the intended point was raised, so a typo fails loudly rather than passing vacuously.
- **Platform**: permission assertions (including the key artifact's `0600` and the state directory's `0700`) remain POSIX-only with the existing platform conditional; no Linux run claims Windows ACL verification. The wrong-bits fixture is skipped with an explicit reason on non-POSIX; a skip is not a pass.
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
| TC-GH223-043 | `tests/behaviour/audit-reservation-orphan.test.ts` | `bun test tests/behaviour/audit-reservation-orphan.test.ts` | New |
| TC-GH223-044 | `tests/behaviour/audit-reservation-failure.test.ts` | `bun test tests/behaviour/audit-reservation-failure.test.ts` | New |
| TC-GH223-045 | `tests/behaviour/audit-chain-reservation.test.ts` | `bun test tests/behaviour/audit-chain-reservation.test.ts` | New |
| TC-GH223-046 | `tests/behaviour/audit-rebuild-orphan.test.ts` | `bun test tests/behaviour/audit-rebuild-orphan.test.ts` | New |
| TC-GH223-047 | `tests/behaviour/audit-key-open-failures.test.ts`, `tests/fixtures/state/harness.ts` | `bun test tests/behaviour/audit-key-open-failures.test.ts` | New |
| TC-GH223-048 | `tests/behaviour/audit-salvage-reservation.test.ts` | `bun test tests/behaviour/audit-salvage-reservation.test.ts` | New |
| TC-GH223-049 | `tests/behaviour/audit-chain-reservation-orphan.test.ts` | `bun test tests/behaviour/audit-chain-reservation-orphan.test.ts` | New |
| TC-GH223-050 | `tests/behaviour/audit-read-command-filter.test.ts` | `bun test tests/behaviour/audit-read-command-filter.test.ts` | New |

Companion suites touched by new exports, fixtures, or mode metadata but carrying no new case ids:

| Suite | Role |
|-------|------|
| `tests/structure/result-contract.test.ts` | Extend the validator rule bijection for scripted rules (top-level `runId` on failure); keep interactive rules intact. |
| `tests/structure/result-fixtures.test.ts` | Validate the new `mode`/`environment`/`startTicks` metadata and the new scripted fixture cases; keep hygiene checks. |
| `tests/golden/timing.test.ts` | Assert scripted success lines carry no timing and interactive lines still do; audit records still carry `timing` and integer-epoch-ms `startedAt`. |
| `tests/golden/redaction.test.ts` | Run the existing redaction cases in both modes; scripted lines stay secret-free. |
| `tests/golden/envelope-failure.test.ts` | Keep the existing interactive cases byte-identical; scripted failure goldens (with top-level `runId`) live in `tests/golden/envelope-scripted.test.ts`. |
| `tests/structure/envelope-contract.test.ts` | Envelope shape and key set remain the M0-S3 contract; no new keys. |
| `tests/structure/delivery-result-contract.test.ts` | Result contract types remain runtime-neutral; audit vocabulary does not leak into the envelope. |
| `tests/structure/state-contract.test.ts`, `tests/structure/state-imports.test.ts`, `tests/structure/state-scope.test.ts` | New audit state modules (both kinds) and the key-artifact module obey contract-only imports, no branding, no new runtime API; the `chain-key.<workspace>.json` path is in the store-layout family. |
| `tests/structure/cli-edge-seam.test.ts` | No ambient environment or clock read; identity/mode/key-generation facts arrive as injected data; single stream-write site unchanged. |
| `tests/checks/error-table-sync.test.ts`, `tests/structure/error-table.test.ts` | No row changes; `input.value.rejected` remains the only refusal identity; key-open failures reuse `state.keys.missing`/`state.store.torn`/`state.permission.denied`; sync stays green. |
| `tests/checks/forbidden-literals.test.ts` | New source/docs contain no hardcoded product token. |
| `tests/boundaries` | Run if any package/subpath import edge or `workspaceImports` entry changes. |
| `tests/behaviour/state-torn.test.ts`, `state-salvage.test.ts`, `state-salvage-invariants.test.ts`, `state-index.test.ts`, `state-storage-exhausted.test.ts`, `state-permissions.test.ts` | M0-S5/GH-222 regressions; expected to pass unchanged. |

Fixture/corpus updates required (delivery-blocking, no new TC ids):

- `tests/fixtures/result/envelopes/**/injected.json` — add `mode`, `environment` (empty for identity-absent cases), and `startTicks`; do not add a chaining key (the key is store-managed and generated per temp store).
- `tests/fixtures/result/envelopes/**/meta.json` — add `mode` and keep `outcome`; update the fixture-hygiene expectations.
- `tests/fixtures/result/envelope-key-set.json` — add the scripted success key set (`data`) and the scripted failure key set (`error` + `runId`) beside the existing interactive sets.
- `tests/fixtures/result/programs/lanes-list.json` — the SC-M1-23 stand-in.
- `tests/fixtures/state/harness.ts` — audit pair, reservation-orphan, key-artifact/open-failure, and second-append-fault helpers listed in §6.
- `tests/fixtures/audit/**` — cases (including time-window/scope/repo), mutations for both kinds, reservation orphan/failure cases, key-open-failure descriptors, lane environment; a unit-only key fixture if needed.
- Goldens are regenerated deliberately with the explicit test command; never by blanket rewrite. Existing interactive goldens must remain byte-identical unless the change intentionally amends them; scripted failure goldens must carry top-level `runId`.

### 7.1 Unit vs Integration Split

- **Pure unit**: the invocation/reservation assembly and payload validation half of TC-GH223-005; the integer-epoch-ms `startedAt` half of TC-GH223-035; the both-kind chain-link computation and verification half of TC-GH223-023; reservation-orphan detection, filter matching (scope/repo/inclusive time window), and bound/truncation arithmetic in TC-GH223-028, TC-GH223-039, TC-GH223-041, TC-GH223-042, TC-GH223-043, TC-GH223-046; the scripted-projection validator in TC-GH223-021.
- **Integration (in-process `runCli` + temp store)**: TC-GH223-001..004, 006, 007, 009..012, 014..019, 022..028, 030..032, 035..050.
- **Golden**: TC-GH223-014..018, 020 (and the existing cases updated by 016/017).
- **Structure / contract / check / boundary**: TC-GH223-008, 013, 020, 021, 029, 032, 033, 034, 037, 040, 047.

### 7.2 Execution Strategy and Quality Gates

During delivery (fail fast, narrow first):

1. `bun test tests/behaviour/audit-ledger.test.ts tests/behaviour/audit-outcomes.test.ts tests/behaviour/audit-identity.test.ts tests/behaviour/audit-timestamp.test.ts`
2. `bun test tests/behaviour/audit-write-failure.test.ts tests/behaviour/audit-malformed.test.ts tests/behaviour/audit-ordinal-gap.test.ts tests/behaviour/audit-reservation-orphan.test.ts tests/behaviour/audit-reservation-failure.test.ts`
3. `bun test tests/behaviour/scripted-trim.test.ts tests/behaviour/envelope-mode.test.ts tests/golden/envelope-scripted.test.ts`
4. `bun test tests/behaviour/audit-chain.test.ts tests/behaviour/audit-chain-mutations.test.ts tests/behaviour/audit-chain-salvage.test.ts tests/behaviour/audit-chain-reservation.test.ts tests/behaviour/audit-salvage-reservation.test.ts tests/behaviour/audit-key-exclusion.test.ts tests/behaviour/audit-key-artifact.test.ts tests/behaviour/audit-key-open-failures.test.ts tests/behaviour/audit-chain-cross-process.test.ts`
5. `bun test tests/behaviour/audit-read.test.ts tests/behaviour/audit-read-refusal.test.ts tests/behaviour/audit-read-time-window.test.ts tests/behaviour/audit-read-command-filter.test.ts tests/behaviour/audit-rebuild-orphan.test.ts tests/behaviour/audit-redaction.test.ts tests/behaviour/audit-scenario-m1-23.test.ts`
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
| TR-1 | The two-phase append is two public-port appends, not one transaction; a crash or fault between them intentionally leaves a reservation orphan (not an invocation record) | H | TC-GH223-039/043/044/046 assert the orphan is durable evidence, the command outcome is unchanged, the next ordinal advances, and a failed reservation consumes nothing; the failed-reservation case explicitly asserts no gap. |
| TR-2 | The key artifact must be a `chain-key.<workspace>.json` store-layout member created/read through the port's store-managed artifact path, not a new runtime API | H | TC-GH223-034 asserts the path family and no new runtime-API location; TC-GH223-037/047 assert creation, `0600`, reuse, and the three open-failure identities. |
| TR-3 | `startedAt` is integer epoch milliseconds and the window is inclusive `[from,to]` with unbounded omitted sides; a date-string or half-open implementation would fail | M | TC-GH223-035 asserts `Number.isInteger(startedAt)` and the exact tick; TC-GH223-041 probes both boundaries and both omitted sides. |
| TR-4 | Salvage removal is byte-contiguous and kind-agnostic; a partial reservation/invocation frame or a silently dropped last-valid-frame reservation would violate AC-F4-3/DEC-8 | M | TC-GH223-027 asserts wholesale removal and repair/salvage continuity; TC-GH223-048 asserts the surviving-tail reservation remains the orphan finding. |
| TR-5 | Extending golden injected facts (mode/environment/startTicks) breaks existing byte goldens or the fixture-hygiene checks | M | Default existing cases to interactive and keep their stdout byte-identical; update `result-fixtures.test.ts` deliberately; regenerate goldens only with the explicit command. |
| TR-6 | Chain algorithm drift makes an independent oracle impossible | L | Assert behaviour, not algorithm: same key + sequence verifies, different key fails, altered content fails, forged chain fails. If delivery pins the primitive, add an independent oracle in `tests/fixtures/audit/`; if it stays opaque, keep the behavioural assertions and do not duplicate an unpinned algorithm. |
| TR-7 | Salvage/repair false positives erode trust in chain-break flags | M | TC-GH223-027/048 exercise both operations, assert the reported removal is not a break, and include a genuine alteration control so continuity does not suppress real breaks. |
| TR-8 | Audit payload field names/outcome-class vocabulary or the reservation's minimal key set churn between plan and delivery | M | Tests bind to the delivered runtime-neutral constants and assert semantic equality; TC-GH223-005 asserts the reservation key set is exactly `{auditSeq, runId, chainValue}`. |
| TR-9 | A handler-held shared fence could cause an audit append to fail `state.lock.busy` and be misread as external contention | M | OQ-11 is resolved as one shared audit fence; TC-GH223-010's contention case uses a second store instance holding the shared fence, and distinguishes it from a handler-held-fence scenario recorded as a delivery-time clarification. |
| TR-10 | Test isolation failures (shared temp store, ambient env/clock, real streams) create flaky or cross-contaminated results | L | Fresh temp root, clock, run-id factory, environment, and generated key per case; no-spawn guard; structure tests forbid ambient env and clock reads. |
| TR-11 | The redaction chokepoint lives in the CLI serializer, while the audit write persists in the state tier; sharing it could create a second serialization path or a tier violation | H | Redact the invocation fact on the CLI side before handing it to the audit write port; keep one redaction function (shared through a runtime-neutral module only if needed); TC-GH223-032's structure guard forbids a second raw writer, and TC-GH223-034 keeps the state tier branding-free. |
| TR-12 | The state layer's verified read may rebuild the derived index (a write), while F-5/AC-F5-1 says the audit read writes nothing | M | TC-GH223-028/041/042 seed a store whose derived index is current, then assert the ledger and directory are byte-identical across queries. A rebuild-on-read would surface as a deviation, not be waived; TC-GH223-046 asserts the orphan finding survives a rebuild. |
| TR-13 | The key-artifact open-failure identities could be mis-mapped or introduce a new row | M | TC-GH223-047 asserts absent-on-non-first-open → `state.keys.missing`, corrupt → `state.store.torn` family, wrong bits → `state.permission.denied`; TC-GH223-033 keeps the bidirectional no-drift assertion. |
| TR-14 | The reservation payload could accidentally carry invocation context (arguments/outcome/identity), leaking redacted-sensitive data or duplicating the record | H | TC-GH223-002/003/004/005/022 assert the reservation key set is exactly `{auditSeq, runId, chainValue}` and contains no invocation metadata; TC-GH223-031/032 assert no edge-registered secret in either kind. |
| TR-15 | Ordinal allocation from verified ledger truth must happen inside the same fence acquisition as the two appends; a read outside the fence could race a concurrent process | H | TC-GH223-005's call-order spy asserts `acquireFence` → `readRecords` → `append(reservation)` → `append(invocation)` → `releaseFence`; TC-GH223-023/039 exercise the shared fence. |

### 8.2 Assumptions

- **ASM-1**: M0-S3 (result contract, redaction chokepoint, deterministic in-process surface, golden and conformance tooling) and M0-S5 (state layer: ledger truth, verified reads, fences, classification, salvage, additive kinds, artifact boundaries) are delivered at the change base (spec v1.2 verified at HEAD `47408a3e`), as the spec assumes.
- **ASM-2**: `CliDependencies`/the runtime edge can be extended with an injected environment record, a stream-capability mode fact, a `startedAt` clock fact, and an audit write port without introducing an ambient read; `tests/structure/cli-edge-seam.test.ts` is updated in the same change to keep the no-ambient-read invariant.
- **ASM-3**: Both audit kinds (`audit.invocation`, `audit.reservation`) are additive within `delivery.state.v1`; no migration, schema bump, or new driver discriminant is required.
- **ASM-4**: The chaining key is durable store-managed key material generated at the runtime edge and persisted as `chain-key.<workspace>.json` with `0600`; tests read the artifact through the delivered helper (single-user trust model). The algorithm is verified behaviourally, not pinned to a specific primitive.
- **ASM-5**: The golden runner can create a temp audit store per case and extend `injected.json` with mode/environment/startTicks facts while keeping existing interactive goldens byte-identical.
- **ASM-6**: `lanes list` is represented by a stand-in program for SC-M1-23 because the real command ships later; the scenario's id and Given/When/Then shape are preserved (GH-222 stand-in precedent).
- **ASM-7**: Every case runs in process; no process spawning, real streams, real clock, or real state directory. Cross-process key continuity is modeled by reopening the same temp root with fresh store/edge instances.
- **ASM-8**: The error table is unchanged; audit-path state failures reuse existing state identities (including the three key-open identities), and read-surface refusals reuse `input.value.rejected`.
- **ASM-9**: The declared lane environment is fixture data; this story does not build or render a lane environment (NG-1).
- **ASM-10**: The CLI side redacts the invocation fact (arguments, raw tokens, identity) before handing it to the audit write port; the state tier never imports the CLI serializer. If the redaction function is shared through a runtime-neutral module, it remains the single chokepoint and no second serialization path is introduced. Reservation payloads contain no redactable invocation content.
- **ASM-11**: The injected clock used for `timing` is the same clock that supplies integer-epoch-ms `startedAt`; the runtime edge already carries it.
- **ASM-12**: The audit consumer allocates `auditSeq` as `max(existing reservation ordinal) + 1` (starting at 1) from verified ledger truth inside the shared fence, then appends the reservation and invocation under that one handle. No process-memory counter exists.
- **ASM-13**: The `chain-key.<workspace>.json` path is exposed as a delivered store-layout constant; the test reads it through a helper, not by hardcoding a state-directory layout.
- **ASM-14**: `scope` is the store/workspace scope identity and `repo` is the target repository value or absent; both are exact-match filter operands.
- **ASM-15**: The public port permits multiple `append(handle, request)` calls under one fence handle and a `readRecords` call inside the same fence; this is how the two-phase append and ordinal allocation are exercised.
- **ASM-16**: Exactly-one counts `audit.invocation` records only; reservations are a distinct internal kind and are never counted as invocation records.
- **ASM-17**: The second-append fault used in TC-GH223-039/043/044 is a test-only edge wrapper that counts `raiseFault` calls; it does not change production behavior or spawn a process.

### 8.3 Open Questions

**All previously recorded items are resolved; no open OQ item remains.**

| Test-plan item | Spec resolution | Effect on this plan |
|----------------|-----------------|---------------------|
| OQ-T1 | OQ-4: `runId` is a top-level key of the minified failure line, beside `error` | TC-GH223-016/017/021/022 assert the top-level key set `error` + `runId` and reject a nested-only runId |
| OQ-T2 | OQ-5: durable store-managed chaining-key artifact (DM-5), persisted `0600`, read by later processes; per-process key rejected | TC-GH223-026/037/038/047 cover exclusion, creation, cross-process verification, and open failures |
| OQ-T3 | OQ-6: missing/invalid bound or filter refuses with the existing `input.value.rejected` | TC-GH223-028/040 assert the refusal |
| OQ-T4 / OQ-7 | OQ-7: `audit.invocation` / `delivery.audit.invocation.v1` / `audit.invocations` / 13 field names pinned, including `resultSchemaVersion` (v1.4) distinct from the payload schema id | TC-GH223-001/005/008/014/034 use the exact vocabulary |
| OQ-T5 | OQ-8: `startedAt` added; new AC-F1-4; time-window filter operates on it | TC-GH223-035/036/041 |
| OQ-T6 / OQ-15 | OQ-9 and OQ-15: DEC-8 rewritten to the reservation-first two-phase append; durable `auditSeq` from verified ledger truth; both failure modes specified | TC-GH223-039/043/044/046 reworked/added; TC-010 remains the shared-fence failure case |
| OQ-T7 | OQ-10: `agentIdentity` carries the verbatim value plus the explicit `claimed` marker | TC-GH223-011/013 |
| OQ-T8 | OQ-11: one shared fence over the whole audit domain | TC-GH223-010/005 |
| OQ-T9 | OQ-12: "no secret patterns" means no edge-registered secret value | TC-GH223-031/032/022 |
| OQ-T10 | OQ-13: absent, empty, and whitespace-only all count as absent; trimming decides presence only | TC-GH223-012/013 |
| OQ-T11 | OQ-14: `scope`/`repo` exact-match semantics; repo-absent records excluded only from repo-constrained results | TC-GH223-028/042 |
| OQ-16 | OQ-16: key-artifact open failures reuse existing identities (`state.keys.missing`, `state.store.torn` family, `state.permission.denied`); no new rows | TC-GH223-037/047; TC-033 keeps no-drift |
| OQ-17 | OQ-17: `startedAt` is integer epoch milliseconds UTC; time window inclusive `[from,to]`; omitted side unbounded | TC-GH223-035/041 |
| OQ-18 | OQ-18: salvage removes trailing records and reservations wholesale; a last-valid-frame reservation survives as the DEC-8 finding | TC-GH223-027/048 |
| OQ-19 | OQ-19: key artifact is `chain-key.<workspace>.json` in the store-layout family, through the port's store-managed artifact path | TC-GH223-034/037/047 |
| OQ-20 / MR-1 | OQ-20 (v1.3): the reservation payload gains `chainValue` as a third field (`{auditSeq, runId, chainValue}`); link alternation pinned (reservation chains from the preceding audit-domain record, invocation from its reservation, first from the anchor) | TC-GH223-043/045/049; TC-005/023 assert link alternation |
| OQ-21 | OQ-21 (v1.4): command filter matches the recorded command token exactly, including raw first tokens for broken invocations | TC-GH223-028/050 |

**No open OQ item remains.** The former v1.1 gaps are closed by spec v1.2, OQ-20/MR-1 is closed by spec v1.3, and OQ-21 is closed by spec v1.4: the reservation carries its own `chainValue`, and command filtering is exact against the recorded token. The mechanism-realism review in §8.4 confirms all cases are achievable through the public port and injected CLI dependencies.

### 8.4 Mechanism-Realism Review (v1.3 convergence)

| Mechanism | Realism check | Exercising TCs |
|-----------|---------------|----------------|
| Two appends under one fence acquisition | The public port accepts multiple `append(handle, …)` calls under one `StateFenceHandle`; the audit consumer acquires once and releases after both frames. | TC-GH223-001/005/039/043/044 |
| Ordinal allocation from verified ledger truth | `readRecords` can be called inside the fence; the consumer computes `max(existing reservation ordinal) + 1` before appending. | TC-GH223-005/006/039/043/044 |
| Reservation payload: no invocation metadata | The reservation is assembled with exactly `{auditSeq, runId, chainValue}`; no arguments, outcome, identity, or other invocation metadata is passed to it. | TC-GH223-002/003/004/005/022/043 |
| Invocation payload: 13 fields | The invocation is assembled with exactly the 13 fields including `resultSchemaVersion`; `resultSchemaVersion` is the rendered envelope's schemaVersion, not the payload schema id. | TC-GH223-001/005/014/016/022 |
| Exactly-one counts invocation records only | The read/assert helpers group by kind; reservations are excluded from the invocation count. | TC-GH223-001/002/003/004/022 |
| Both-kind continuous chain, link alternation | The chain walks the verified audit-domain sequence in ledger order; each reservation chains from the preceding audit-domain record (of either kind), each invocation chains from its reservation, and the first record chains from the anchor. Orphan reservations remain alteration-detected by their own `chainValue`. | TC-GH223-023/024/025/045/049 |
| Orphan fold from ledger | The read surface matches reservations to invocations by runId; a missing invocation is an in-band finding; no derived document carries ordinal truth. | TC-GH223-039/043/046 |
| Command filter exact match | The filter compares the query value with the recorded command token verbatim; raw first tokens for broken invocations are filterable; no prefix/case/wildcard normalization. | TC-GH223-028/050 |
| Failed reservation consumes nothing | The ordinal is allocated from ledger truth before the append; if the reservation append fails, the next allocation sees the same max and reuses the ordinal. | TC-GH223-044 |
| Durable key artifact path/open failures | The key is a `chain-key.<workspace>.json` store-layout member created/read through the store-managed path; absent/corrupt/wrong-bits reuse existing identities. | TC-GH223-037/047; TC-034 guards the path |
| Cross-process verification | Fresh store/edge instances over the same temp root read the same durable key and verify earlier records; no process is spawned. | TC-GH223-038 |
| Salvage to last valid frame | Salvage truncates the terminal tail byte-contiguously and kind-agnostically; a last-valid-frame reservation survives and is folded as an orphan. | TC-GH223-027/048 |
| Integer-epoch-ms timestamp/inclusive window | The injected clock returns integer milliseconds; filters compare integers inclusively with unbounded omitted sides. | TC-GH223-035/041 |
| Shared-fence contention | A second store instance holds the audit fence; the append fails `state.lock.busy` without changing the command outcome. | TC-GH223-010 |

## 9. Plan Revision Log

| Version | Date | Author | Changes |
|---------|------|--------|---------|
| 1.0 | 2026-11-06 | @test-plan-writer | Initial plan: 34 story-local cases (`TC-GH223-*`) covering the then-current AC set (AC-F1-1..AC-F6-1), EVT-1, DM-1..4, NFR-1..9, and the inherited SC-M1-23 seeded scenario; both output modes, chain tamper-evidence/salvage continuity, bounded reads, and audit-write degradation. Records two spec gaps for PM: OQ-T5 (time-window filter without a timestamp) and OQ-T6 (sequence-gap detection). |
| 1.4 | 2026-11-06 | @test-plan-writer | Reconcile to spec v1.4: 13-field invocation payload with `resultSchemaVersion` (rendered envelope schemaVersion, distinct from `delivery.audit.invocation.v1`) asserted by TC-001/005/014/016/022; exact-match command filter for raw-token broken invocations added as TC-GH223-050; `implementation_plan` link points at `./chg-GH-223-plan.yaml`; spec reference updated to v1.4; summary payload count 12→13. 50 cases, 15 ACs. |
| 1.3 | 2026-11-06 | @test-plan-writer | Reconcile to spec v1.3 (commit `a0109171`): reservation payload is `{auditSeq, runId, chainValue}`; MR-1/OQ-20 resolved; TC-GH223-049 unblocked and fully specified for altered orphan reservations; TC-043 rephrased to no-invocation-metadata with `chainValue` permitted/required; TC-005/023 assert link alternation (reservation → preceding audit-domain record or anchor, invocation → its reservation); AC-F4-1 and NFR-3 return to Covered; all prior gap markers remain cleared. 49 cases, 15 ACs. |
| 1.2 | 2026-11-06 | @test-plan-writer | (Superseded by 1.3.) Reconcile to spec v1.2 (commit `47408a3e`): add TC-GH223-043..049 (49 cases total, 15 ACs; TC-049 blocked by MR-1 at that revision) for the reservation-orphan scenario, failed-reservation scenario, altered-reservation chain break, rebuild-preserves-gap, key-artifact open failures, and surviving-tail reservation. Update TC-001..008/022 for the reservation-first two-phase append (two frames, identical `auditSeq`, reservation payload `{auditSeq, runId}` only, exactly-one invocation counting); update TC-023..027/045 for the continuous chain over both kinds; rework TC-039 to the two failure modes; add the three key open-failure identities to TC-037/047; pin integer-epoch-ms `startedAt` and inclusive/unbounded time windows in TC-035/041; pin wholesale salvage/kind-agnostic removal in TC-027/048; reference `chain-key.<workspace>.json` in TC-034/037/047. Remove all v1.1 gap markers (resolved by OQ-15..19), add the mechanism-realism review (§8.4), and record the new blocking gap MR-1 (reservation chain-value storage for orphan reservations) in §8.3; full convergence is not claimed. |
| 1.1 | 2026-11-06 | @test-plan-writer | Reconcile to spec v1.1 (commit `94036965`): add AC-F1-4 and TC-GH223-035..042 (42 cases total, 15 ACs); add `startedAt`/`auditSeq` to the record field set; rework DEC-8 to the shared-fence, skipped-ordinal model (TC-010/039); add durable store-managed key artifact, `0600` permissions, and cross-process verification (TC-037/038); update `runId` to a top-level failure-line key (TC-016/017/021/022); make the time-window filter over `startedAt` real and add `input.value.rejected` refusal (TC-028/040/041); pin the exact vocabulary and exact scope/repo filters (TC-005/008/034/042); update identity to the `claimed` marker and empty/whitespace-absent rules (TC-011/012/013); mark OQ-T1..T11 resolved; record the v1.1 gap set (ordinal allocation durability plus four non-blocking pins). |

## 10. Test Execution Log

Populated during execution. Each row records the TC id, run date, result, and the command or note that produced it. A skip is recorded with its reason and never counts as a pass.

| TC ID | Run Date | Result | Notes |
|-------|----------|--------|-------|
| — | — | — | Not yet executed (plan reconciled to spec v1.4; 50 cases proposed, all unblocked). |
