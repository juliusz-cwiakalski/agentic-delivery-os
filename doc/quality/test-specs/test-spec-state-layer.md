---
id: TEST-SPEC-STATE-LAYER
status: Current
created: 2026-11-05
last_updated: 2026-11-06
owners: ["engineering"]
service: delivery-os
links:
  related_changes: ["GH-174", "GH-222", "GH-223"]
  feature_spec: doc/spec/features/feature-state-layer.md
---

# Test Specification: State Layer

## Overview

The state-layer suite protects one property: a store either yields verified truth or a classified failure, never a silent zero, an empty record set standing in for corruption, a stale projection, or a partial write presented as landed. The suites drive the public store port over a temporary store and an injected runtime edge, with one parameterized conformance suite over both declared driver kinds, exercising corruption classification, boundary validation, guided salvage, index rebuild, fail-closed writes, fences, permissions, and the delivery registry consumer. The fault-injection harness is itself a contract: fault points are named, a raised point is asserted, and storage exhaustion is a distinct, opt-in fault form.

## Test Scope

- Components under test: the state facade (`packages/core/src/state/index.ts`), the ledger verification and tear-topology helpers (`state/ledger.ts`), the runtime-neutral storage-error classification (`state/storage-error.ts`), the reusable artifact boundary (`state/artifact-boundary.ts`), the delivery registry consumer (`state/registry.ts`), the closeout ledger (`state/closeout.ts`), the audit consumer (`state/audit.ts`), the runtime edge (`state/driver/runtime-edge.ts`), and the two read strategies (`state/driver/strategy.ts`).
- Contracts under test: the driver-neutral state vocabulary in `packages/core/src/contracts/state.ts`, the audit vocabulary in `packages/core/src/contracts/audit.ts`, and the nine `state` rows in `packages/core/src/contracts/error-table.ts`, synchronized with the documented table in [the result contract](../../spec/features/feature-result-contract.md).
- Integration points: the registry projection and presence-tolerant read, the provider park fold, closeout history, the owner-gate decision ledger, the audit reservation/invocation ledger with its keyed chain and store-managed key artifact, and the error-table sync check that binds machine and documented rows.
- Exclusions: there is no command surface, so no end-to-end tier applies. Real disk exhaustion, backup/restore, migration, prune/compaction, retro-registry behavior, and ceremony-runner behavior are out of scope. Windows ACL execution is platform-conditional and is not claimed by a Linux run. Salvage, rebuild, and classification performance is not measured.

## Test Levels

### Unit Tests

Pure suites drive byte strings and record values with no filesystem:

- `tests/behaviour/state-ledger.test.ts` — framing, FNV-1a 64-bit payload checksum, terminal completeness, sequence continuity, schema-version verification, and tear topology.
- The pure cases inside `state-evidence.test.ts` (evidence verdicts) and `state-artifact-boundary.test.ts` (declaration matching).
- `tests/structure/state-contract.test.ts` — the contract surface stays data-only and runtime-neutral.

### Integration Tests

Every integration store lives under a per-test temporary root and is driven through `tests/fixtures/state/harness.ts`. The suites are housed under `tests/behaviour/` because the repository layout is by layer, not by unit/integration directory:

- `state-conformance.test.ts` — one parameterized conformance contract over both driver kinds (verified reads, evidence parity, no caller-visible discriminant).
- `state-torn.test.ts`, `state-unknown.test.ts`, `state-evidence.test.ts`, `state-keys.test.ts` — the corruption and unknown matrix, verified-empty distinctness, and exact (never defaulted) key values including falsy ones.
- `state-boundary-validation.test.ts`, `state-artifact-boundary.test.ts` — the four boundary verdicts, write refusal, declaration reuse, and artifact kinds standing in for future registries.
- `state-salvage.test.ts`, `state-salvage-invariants.test.ts` — truncation, salvage record, quarantine, evidence, byte-preservation of the valid prefix, no automatic repair, and mid-record refusal.
- `state-storage-exhausted.test.ts` — fail-closed append, derived-document replace, and salvage writes.
- `state-index.test.ts`, `state-index-post-salvage.test.ts` — rebuild from the ledger alone for absent, corrupt, divergent, and post-salvage indexes.
- `state-fence.test.ts`, `state-atomic-replace.test.ts`, `state-permissions.test.ts` — fence contention and recovery, atomic replace observability, and POSIX permission enforcement.
- `state-error-classification.test.ts` — the nine-code trigger and round-trip sweep.
- `phase-registry.test.ts` — the delivery registry consumer's fold, projection, verified reads, and classified failures.
- `board-records.test.ts`, `board-defaults.test.ts` — the owner-gate decision ledger's exactly-one-record idempotency, replay no-op, and torn history.
- `audit-ledger.test.ts`, `audit-outcomes.test.ts`, `audit-timestamp.test.ts`, `audit-identity.test.ts`, `audit-write-failure.test.ts`, `audit-ordinal-gap.test.ts`, `audit-reservation-orphan.test.ts`, `audit-reservation-failure.test.ts`, `audit-malformed.test.ts`, `audit-rebuild-orphan.test.ts`, `audit-redaction.test.ts`, `audit-scenario-m1-23.test.ts` — the audit consumer's two-phase append, exactly-one invocation record per outcome class, durable ordinal and skipped-ordinal findings, timestamp and claimed-identity capture, classified write degradation, malformed-entry classification, redaction, and the seeded end-to-end scenario.
- `audit-chain.test.ts`, `audit-chain-reservation.test.ts`, `audit-chain-reservation-orphan.test.ts`, `audit-chain-mutations.test.ts`, `audit-chain-salvage.test.ts`, `audit-key-artifact.test.ts`, `audit-key-exclusion.test.ts`, `audit-key-open-failures.test.ts`, `audit-chain-cross-process.test.ts`, `audit-salvage-reservation.test.ts` — clean and mutated chain verification over both kinds, salvage continuity, the store-managed key artifact, key exclusion, open-failure identities, and cross-process continuity.
- `audit-read.test.ts`, `audit-read-refusal.test.ts`, `audit-read-time-window.test.ts`, `audit-read-command-filter.test.ts`, `audit-rebuild-orphan.test.ts` — exact filters, inclusive time windows, mandatory bounds and in-band truncation, refusal identity, torn/unknown classification, and raw-token command matching.

### Contract, Structure, and Boundary Tests

- `tests/checks/error-table-sync.test.ts`, `tests/structure/error-table.test.ts` — machine ↔ documented table parity in both directions, row shape, and non-vacuity mutations.
- `tests/structure/state-contract.test.ts`, `tests/structure/audit-contract.test.ts` — data-only contract shape and the exact audit kind/schema/key/field declarations.
- `tests/structure/state-imports.test.ts`, `state-scope.test.ts`, `audit-imports.test.ts`, `audit-surface.test.ts` — import confinement, runtime-API placement, the documented consumer set, the absence of an audit command, and the absence of an unbounded dump export.
- `tests/checks/packed-state.test.ts` — the packed `core/state` subpath imports and runs.

### End-to-End Tests

None apply: the state tier is a local library surface with no command, and all assertions are machine-checkable in process.

## Test Data

- Stores are generated per test by a seed function with deterministic sequences and checksums; no live store is committed. Roots come from `mkdtempSync` with an identifiable label, and teardown removes them.
- The harness supplies `createTestEdge` (armed/raised fault points and a mutable clock), `makeIdentity`, `openStore`, `withinFence`, `ledgerText`, `ledgerPath`, an independent FNV-1a oracle, `digestPaths`, `ledgerDigest`, `tailBytesAfter`, `salvageTail`, `quarantineDirectory`, `quarantineFiles`, and `quarantinePath`. Helpers stay in the fixture file so Bun does not discover them as suites.
- Faults are armed by named `StateEdgeFaultPoint` value only. Tests assert both the classified outcome and that the point was actually raised, so a mistyped point fails loudly rather than passing vacuously.
- Indexed cases use the `indexAvailable()` guard and record an explicit skip when no built-in binding exists; a skip never counts as a pass.

## Test Scenarios

### Scenario: Classification matrix

- **Given** a store with a framing break, truncated tail, sequence gap, duplicate, reset, or checksum mismatch, **when** a read or integrity check runs, **then** the result is `state.store.torn` naming the store path and record position before any value returns.
- **And** the evidence carries no payload content and no checksum bytes, and no read returns an empty record set for the non-empty store.

### Scenario: Unknown versus version mismatch

- **Given** a record kind or payload schema undeclared at a validated boundary, **when** it is read, **then** the result is `state.store.unknown` with path, position, and remediation guidance.
- **And** a store written under another schema version remains `state.schema.mismatch`; a verified-empty store stays distinct from both.

### Scenario: Boundary validation

- **Given** a declared artifact boundary, **when** records are read or written, **then** the verdict is one of valid, verified-empty, torn, or unknown, and a nonconforming write is refused `not_landed` with the ledger byte-identical and no default filled in.
- **And** the same declaration applied to a second kind needs no code change, and no retro or ceremony runtime exists.

### Scenario: Guided salvage

- **Given** a terminal torn tail and a held fence, **when** salvage runs, **then** the ledger is truncated at the last valid frame, one `state.salvage` record is appended, the post-tear bytes are written to the quarantine directory with exact extent and store permissions, and the evidence report names the truncation offset, quarantine path and extent, and record counts.
- **And** every pre-tear record is byte-for-byte unchanged and verified-readable; no read path serves quarantined bytes; salvage does not read or mutate the index.
- **And** salvage on a verified or empty ledger is a reported no-op, and salvage on an absent ledger returns a no-op outcome with verified-empty evidence.

### Scenario: No automatic repair

- **Given** a torn store, **when** any read runs without an explicit salvage, **then** the ledger and directory digests are unchanged, no salvage record exists, and only the classified failure returns.

### Scenario: Mid-record refusal

- **Given** a non-terminal integrity break, including a tear whose first break is mid-record and whose final frame is also truncated, **when** salvage is invoked, **then** it fails `state.store.torn`, zero ledger bytes change, and no quarantine artifact or residue is created. Fence contention on a salvage attempt stays `state.lock.busy`.

### Scenario: Terminal-tail repair

- **Given** a store whose last frame is truncated after a clean complete-lines prefix, **when** repair runs, **then** only those tail bytes are removed, the removed byte and frame counts are reported without payload content, every earlier record stays byte-identical, and no record is appended.
- **And** a verified or empty ledger is a reported no-op, and a non-truncated tear or a truncated tail whose complete-lines prefix is itself broken refuses `state.store.torn` with zero byte mutation.

### Scenario: Rebuild from the ledger alone

- **Given** only the ledger — index absent, corrupt, divergent, or on a post-salvage ledger — **when** an indexed read occurs, **then** the index rebuilds from verified ledger truth, reports the rebuild, and converges with the `jsonl` scan.
- **And** a rebuild that cannot write fails `state.write.failed` without serving stale truth, and quarantined bytes contribute no rows.

### Scenario: Fail-closed storage exhaustion

- **Given** an injected exhaustion fault at a pre-commit append, replace, or salvage write point, **when** the write is attempted, **then** the operation fails `state.storage.exhausted` with consequence `not_landed`, the ledger is byte-identical at its last valid frame, no partial frame exists, and a document target stays at its previous version or stays absent.
- **And** a retry lands exactly once, and any non-exhaustion write fault keeps `state.write.failed`.

### Scenario: Error-table binding

- **Given** the machine and documented error tables, **when** the sync check runs, **then** every entry has exactly one documented row and every row exactly one entry, both directions fail closed, and one-sided edits or a phantom code are non-vacuously rejected.

### Scenario: Audit reservation-first append

- **Given** an audited invocation, **when** the audit append runs, **then** one `audit.reservation` record is appended first under the shared fence with the next ordinal from verified ledger truth, the `audit.invocation` record follows with the same ordinal, and the invocation links from its reservation while the reservation links from the preceding audit-domain record.
- **And** a failed invocation append leaves an orphan reservation reported as a skipped-ordinal finding on the next read; a failed reservation append consumes nothing and claims no gap; the command outcome is unchanged in both cases.

### Scenario: Audit keyed chain and key artifact

- **Given** an audit domain built by one or more processes, **when** chain verification runs, **then** every reservation and invocation link recomputes to its stored value, an altered record (including an edit with a recomputed unkeyed checksum and an orphaned reservation) is a chain break naming its position, and a reported salvage removal is not a break.
- **And** `chain-key.<workspace>.json` is created once at the runtime edge, persisted `0600`, verified on open, reused by later processes with zero false breaks, and never appears in a record, configuration, an environment, or a lane.

### Scenario: Bounded audit read

- **Given** a read query with a mandatory limit and optional scope, repo, command, outcome, and inclusive `startedAt` filters, **when** the read executes, **then** it returns only verified invocation records that match, reports matched and returned counts plus in-band truncation, and reports the full chain verdict and skipped-ordinal findings.
- **And** a missing or invalid bound or filter refuses with `input.value.rejected`, the read acquires no fence and writes no audit record (a derived-index rebuild, if any, is reported by the store), and a torn or unknown store classifies without a silent zero.

## Performance & Load Tests

Not covered. The state layer has no latency or throughput budget; full-history verification cost grows with history and is documented as a known constraint rather than a benchmark target.

## Security Tests

- POSIX creation and open enforcement (`0700` directories, `0600` files) is a hard gate, including the quarantine directory and artifacts; a foreign permission is detected and fails `state.permission.denied` instead of continuing permissively.
- Quarantined post-tear bytes are never served as content by any read path, and salvage never overwrites preserved evidence with a different extent.
- Classification evidence names paths, record positions, and counts only; canary payload and checksum bytes never appear in failures or salvage records.
- The runtime-API confinement and import-confinement suites keep filesystem, clock, and SQLite access inside the driver edge.

## Negative Testing

Negative coverage includes every torn class, undeclared kinds and schemas, missing key sets, nonconforming writes at declared boundaries, salvage on mid-record tears and clean ledgers, repair refusal on non-terminal tears, fence contention, permission violations, index rebuild write failures, and exhaustion at every pre-commit write point. Each negative asserts a classified code, `not_landed` where a mutation was attempted, and unchanged durable bytes.

## Automation Strategy

- All cases are `bun:test` suites under `tests/**/*.test.ts` and run on the pinned Bun version.
- The aggregate gate `pnpm check` runs lint, format, typecheck, the test battery, and the boundary check; the error-table sync check is binding and also runs as its own gate.
- Narrow suites are run first during delivery (classification, salvage, exhaustion, index, contract, boundary), then the full behaviour tier, structure and boundary tiers, and the packed `core/state` probe.
- Mutation-style contract controls copy into a temporary root before editing, so repository files are never modified by a test.

## Test Environment

- Runtime: pinned Bun; no external services, no network, and no real state directory.
- Platforms: POSIX permission behavior is executed on Linux CI; the Windows ACL branch remains platform-conditional and is not verified by a Linux run.
- SQLite: the built-in binding is detected at the edge; when it is unavailable, indexed cases record an explicit skip with the reason.

## Test Coverage Metrics

No numeric coverage threshold is asserted. Coverage is risk-based: every corruption and unknown class, every write boundary under exhaustion, every rebuild trigger, and every state row's real trigger is exercised at least once. A declared code without a trigger is a test gap, not a documentation-only concern.

## Maintenance

- New state codes require a real trigger in the classification sweep, both error tables, and fixtures in the same change.
- New fault points are named in `StateEdgeFaultPoint` and asserted as raised; a typo must fail loudly.
- Golden fixtures that enumerate state codes are regenerated deliberately, never by blanket rewrite.
- When the store format or a driver changes, the conformance suite is the parity gate; a skip is recorded, never converted into a pass.

## References

- Feature specification: [State Layer](../../spec/features/feature-state-layer.md).
- Audit consumer contract: [Command Audit Ledger](../../spec/features/feature-audit-ledger.md).
- Error-table contract: [Result Contract and Error Table](../../spec/features/feature-result-contract.md).
- Registry consumer: [PM-Notes Lint and Phase Transitions](../../spec/features/feature-pm-notes-lint-and-phase-transitions.md).
- Testing rules: [.ai/rules/testing-strategy.md](../../../.ai/rules/testing-strategy.md) and [.ai/rules/typescript.md](../../../.ai/rules/typescript.md).
- Storage-engine decision: [TDR-0004](../../decisions/TDR-0004-state-storage-engine.md).
