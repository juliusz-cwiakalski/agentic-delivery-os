---
ados_distribution: internal
id: SPEC-AUDIT-LEDGER
status: Current
created: 2026-11-06
last_updated: 2026-11-06
owners: ["engineering"]
service: delivery-os
summary: "The command audit ledger: two additive state record kinds (a reservation append followed by the invocation record) written under one shared fence with a durable per-store ordinal, a keyed tamper-evident chain over both kinds backed by the store-managed chain-key.<workspace>.json artifact, a bounded filtered library read surface that reports skipped-ordinal findings in-band, the claimed agent-identity convention named through the branding seam, and audit-write failure semantics that never change a command outcome."
links:
  related_changes: ["GH-223", "GH-232"]
  related_decisions: ["ADR-0003", "TDR-0004", "TDR-0005"]
  contracts:
    - "packages/core/src/contracts/audit.ts"
    - "packages/core/src/contracts/state.ts"
---

# Feature: Command Audit Ledger

## Overview

The command audit ledger gives every invocation of the in-process command surface one durable record when an audit seam is injected. It composes the public state port as two additive record kinds inside the existing `delivery.state.v1` schema, under the store-scoped key `audit.invocations`: `audit.reservation`, the durable ordinal-consumption and chain-link evidence, is appended first; `audit.invocation`, the invocation record itself, is appended second with the same ordinal. The two appends run under one shared audit fence, so a single writer serializes every record that participates in the audit chain.

Every audit-domain record carries a `chainValue` computed from a durable chaining key, the previous audit-domain link, and the record's audited content. The key is generated once per store at the runtime edge and persisted through the store-managed artifact path as `chain-key.<workspace>.json`; later processes read the same artifact, so chain verification spans processes without false breaks. Retention follows the state layer: records are kept forever, and the ledger is local-only.

The ledger ships a bounded, filtered, library-only read surface for retro and auditor consumers. It returns verified invocation records under an explicit limit and optional scope, repository, command, outcome-class, and `startedAt` time-window filters; reports in-band when the limit truncates a result; and reports every reservation whose invocation record is absent from the verified ledger as a skipped-ordinal finding. It acquires no fence and writes no audit record; the underlying verified read may rebuild the store's disposable derived index and reports that rebuild as evidence.

The ledger also records the calling agent's **claimed** identity when the seam-named environment variable is present at the runtime-aware edge. Identity is attribution only: it is never verified, never inferred when absent, and never an authorization input. The invocation record is the durable home of the context fields that the scripted-mode machine envelope trims. See [Result Contract and Error Table](feature-result-contract.md) for the rendering contract, [State Layer](feature-state-layer.md) for the underlying store, and [Branding Seam and Working Name](feature-branding-seam.md) for the identity-variable naming root.

## Business Context

### Problem Statement

- **Problem:** Without a durable per-invocation record, a delivery that misbehaves leaves no trustworthy trace of which command ran, with which arguments, producing which outcome. Retro and auditor consumers cannot reconstruct history, and an unkeyed per-record checksum cannot distinguish a corrupted record from a deliberately edited one.
- **Affected Users:** Retro and auditor agents, operators diagnosing a delivery, the calling agents whose identity is claimed, and every later command that inherits the scripted-mode rendering contract.
- **Business Impact:** A trustworthy invocation history is the substrate for retrospection, spend and exit evidence, and the safe removal of context fields from scripted output. Without it, the delivered system cannot trust its own history.

### Goals

- Append exactly one `audit.invocation` record per audited invocation on every outcome class, plus the preceding `audit.reservation` record that makes ordinal consumption durable.
- Make record alteration detectable within the pinned single-user trust model through a keyed chain that survives process boundaries.
- Provide bounded, filtered, verified reads and report reservation orphans in-band.
- Record claimed agent identity when supplied and never infer it when absent.
- Never let an audit-write failure change the command's outcome or exit code.

## User Experience & Functionality

### Record kinds and payload contract

Both kinds live under the same store-scoped key `audit.invocations` and are admitted only through the audit artifact boundary. Each payload carries a `schemaId` structural marker identifying its payload schema; the marker is required by the boundary and is not one of the audited business fields.

**`audit.invocation`** — payload schema `delivery.audit.invocation.v1`. The audited field set has 13 fields:

| Field | Type | Presence | Contract |
|-------|------|----------|----------|
| `runId` | string | Always | The opaque per-invocation correlation identifier from the command surface; also the boundary identity field. |
| `command` | string | Always | The recorded command token. When no command name resolves (unknown command, leading `-` token, no command) it is the raw first non-global token as invoked, or the empty string when the invocation has only global flags. |
| `arguments` | string array | Always | The full argv token list as invoked, after the redaction chokepoint. |
| `exitCode` | number | Always | The envelope's projected exit code (`0`, `1`, or `2`). |
| `timing` | object | Always | `{ totalMs }`, the integer-millisecond run duration measured by the surface. |
| `resultSchemaVersion` | string | Always | The rendered envelope's `schemaVersion` value at invocation time (`delivery.result.v1` at v1). Distinct from the record's own payload schema id. |
| `outcomeClass` | string | Always | One of `success`, `user-validation`, `platform-provider` — the envelope's projection class. A success envelope uses the command's declared exit projection (default `success`); a failure uses the error entry's projection class. |
| `scope` | string | Always | The caller-injected invocation scope, conventionally the store workspace identity. |
| `repo` | string | When targeted | The target repository when the command targets one; absent otherwise (never `null` or an empty string). |
| `startedAt` | number | Always | The integer `CliClock.now()` value sampled at invocation start, before parsing; the same injected clock source that measures `timing`. The surface never reads an ambient clock. The contract treats the value as a UTC wall-clock epoch-millisecond instant; the production composition's default clock is `Date.now()`, an integer epoch-millisecond UTC source, and tests inject a deterministic clock. |
| `auditSeq` | number | Always | The per-store audit ordinal consumed by this invocation's reservation. |
| `agentIdentity` | object | When claimed | `{ "kind": "claimed", "value": <string> }` when the identity variable is present with a non-empty trimmed value; absent otherwise. The value is recorded without trimming (trimming decides presence only) and still passes the redaction chokepoint. |
| `chainValue` | string | Always | The record's keyed chain link, 32 lowercase hex characters. |

**`audit.reservation`** — payload schema `delivery.audit.reservation.v1`. The payload has three fields and no invocation metadata (no arguments, no outcome, no identity):

| Field | Type | Presence | Contract |
|-------|------|----------|----------|
| `auditSeq` | number | Always | The ordinal this reservation consumes. |
| `runId` | string | Always | The run whose invocation record will carry the same ordinal; also the boundary identity field. |
| `chainValue` | string | Always | The reservation's keyed chain link, chaining from the preceding audit-domain record. |

Both kinds are additive within `delivery.state.v1`: no schema-version bump, no migration, and no new runtime-API location. A re-run of an identical command appends a second pair under a new `runId`; records are never deduplicated or overwritten.

### Reservation-first two-phase append

One invocation produces two appends under a single shared fence acquisition (`audit-<runId>`):

1. Inside the fence, the audit boundary performs a verified read of the audit-domain records.
2. The next ordinal is the highest reservation `auditSeq` in that verified read plus one, starting at `1` when the audit domain is empty. The ordinal is allocated from verified ledger truth, not from process memory.
3. The reservation is assembled and appended, chaining from the last audit-domain `chainValue` in ledger order (or the chain anchor when the domain is empty).
4. The invocation record is assembled and appended with the same ordinal, chaining from its reservation's `chainValue`.
5. The fence is released on every path.

Because ordinal consumption is itself a ledger record, it is durable and monotonic across processes: a failed invocation append leaves an orphan reservation, and a failed reservation append consumes nothing. The two-append cost is the accepted price of durable consumption; invocations are human- and agent-scale operations. The exactly-one guarantee counts `audit.invocation` records only — a reservation is never counted as an invocation record.

Failure scenarios:

- **Reservation lands, invocation append fails.** The orphan reservation is durable evidence that the ordinal was consumed without a record; the next verified read reports it as a skipped-ordinal finding.
- **Reservation append fails.** Nothing is consumed and no gap is claimed; the next invocation reuses the ordinal.

In both cases the command's own outcome and exit code are unchanged.

### Keyed chain and chaining key

Verification walks the verified audit-domain records in ledger order. Both kinds participate. Each reservation's `chainValue` chains from the preceding audit-domain record of either kind (or the chain anchor `audit.chain.anchor.v1`); each invocation record's `chainValue` chains from its own reservation. The link input is the durable chaining key, the previous link, and the record's audited content with object keys canonically ordered and `chainValue` excluded. Interleaved records of other kinds neither participate in nor break the chain.

Verification recomputes every expected link and compares it to the stored one. A mismatch is a chain break naming the record position and its `auditSeq`; verification continues over the sequence so multiple breaks can be reported. Evidence names positions and counts only — never payload bytes, checksum bytes, or the key. A chain break is a verification verdict, not an error-table entry and not a read failure. A reported salvage or repair removal is not a chain break: verification walks the surviving verified sequence, so the next audit-domain record chains from the last surviving record.

Within the pinned single-user trust model, in-model forgery resistance rests on state-file permissions (the `0600` artifacts), not on chaining-key secrecy: the keyed construction detects corruption and out-of-model tampering, but a same-user process that reads one record can derive the internal chain state and forge values without reading the key artifact, because the link's FNV-1a-64 construction is invertible modulo 2⁶⁴.

The chaining key is durable store-managed key material, not configuration and not an environment read:

- It is generated once per store with cryptographically random bytes at the runtime edge (32 bytes rendered as 64 lowercase hex characters) on the store's first audit append.
- It is persisted through the public port's store-managed artifact path as `chain-key.<workspace>.json`, a member of the existing store layout family beside the ledger, header, index, and fence files.
- The artifact content is `{ "schemaId": "delivery.audit.chain-key.v1", "key": "<64 hex>" }`; it is created `0600` and verified on open under the same least-privilege contract as every store-managed file.
- Every later process reads the same artifact, so records written by an earlier process verify continuously with zero false chain-break flags. An artifact absent while guarded audit records already exist is never silently regenerated.
- Open failures reuse existing state identities: absent artifact → `state.keys.missing`; unparsable, wrong-schema, or malformed-key content → `state.store.torn`; wrong permission bits → `state.permission.denied`.
- The key never appears in a ledger record, a scripted or interactive output line, configuration, the ambient environment, or a lane environment rendered by this feature.

Losing or deleting the key artifact prevents continuation and verification of subsequently appended records; later records and reads fail classified. Key rotation and escrow are not part of the current contract.

### Bounded, filtered read surface

`readAuditLedger(store, query)` is the library read surface. It never acquires a fence and writes no audit record; the underlying verified read may rebuild the store's disposable derived index and reports that rebuild as evidence. The query requires a positive integer `limit`; optional filters are `scope`, `repo`, `command`, `outcomeClass`, `from`, and `to`.

- `scope`, `repo`, and `command` match by exact string equality. `repo`-constrained results exclude records that have no `repo`. `command` matches the recorded token exactly, including the raw token of a broken invocation; there is no normalization, inference, or wildcard behavior.
- `outcomeClass` matches one of the three declared classes.
- `from` and `to` are inclusive epoch-millisecond bounds over `startedAt` (`startedAt >= from` and `startedAt <= to`); an omitted side is unbounded. `from` greater than `to` is invalid.
- A missing or invalid `limit`, filter, or bound refuses the query with the existing `input.value.rejected` identity (domain kind `input`, consequence `not_landed`). No new error-table row exists.
- The bound is mandatory and is the only truncation point; there is no unbounded dump path through the surface. The outcome reports `matched` (records satisfying the filters), `truncated` (matched exceeds returned), and `verifiedEmpty` (no records returned).
- The result carries the full chain verdict (verified flag, record count over both kinds, breaks, and orphan findings) over the whole audit domain, independent of the filters.
- A non-empty ledger read requires the chaining-key artifact; missing, corrupt, or permission-violating key material fails with the corresponding state identity rather than returning unverified records. A torn or unknown store classifies through the existing state identities and never yields a silent zero.

The surface returns `audit.invocation` records only; reservations are internal evidence and are never returned as invocation records.

### Skipped-ordinal findings

On every read, the surface folds verified ledger truth: a reservation whose `auditSeq` has no matching `audit.invocation` record in the verified ledger is reported in-band as an orphan finding naming the ordinal, the `runId`, and the reservation's ledger position. The finding is durable evidence that an ordinal was consumed but no invocation record is ledger truth; it is not an error-table entry, not a command failure, and not a reason to refuse the read. Because both the reservation and the invocation are ledger truth, the finding survives any derived-document rebuild by construction. A reservation that is itself the last valid frame after salvage remains readable and remains the finding.

### Claimed agent identity

The identity variable is named through the branding seam: the derived `BrandIdentity.environmentPrefix` plus the declared suffix `AGENT_IDENTITY`. The runtime-aware edge reads the variable from injected environment data; no surface or state module reads an ambient environment.

- Presence is decided on the trimmed value: leading and trailing whitespace are stripped for the presence decision only.
- A present, non-empty value is recorded as supplied (trimming never alters the recorded value) together with the explicit marker `kind: "claimed"`.
- An absent, empty, or whitespace-only value records no identity field; nothing is inferred from user, host, session, or any other signal.
- The value passes through the same redaction chokepoint as every other record field, so an edge-registered secret value never survives in `agentIdentity`; the secret-free-record guarantee takes precedence over as-supplied capture.
- The identity is attribution only: never verified, never an authorization input, and always distinguishable from any future proven identity by the `claimed` marker.

The spawn-side setter and the harness-plugin rendering are outside this feature: the ledger consumes the variable when it is present. Setting it at spawn from agent role and lane id is a convention owned by the harness adapter and plugin.

### Audit-write failure semantics

The command outcome is computed before the audit write. An audit append that fails is a classified, loud degradation:

- The failure keeps its existing state identity (`state.lock.busy`, `state.storage.exhausted`, `state.write.failed`, `state.keys.missing`, `state.permission.denied`, `state.store.torn`, `state.store.unknown`, and so on) and is written to the diagnostics stream with the brand binary name.
- The command's own outcome, envelope, and exit code are unchanged; an audit failure never turns a successful command into a failure or vice versa.
- A thrown audit-write error is reported as `state.write.failed`.
- No partial invocation record exists. A reservation that landed without its invocation record is the durable skipped-ordinal finding described above; a failed reservation consumes nothing.

If envelope serialization or `writeOutput` itself throws after the audit record was assembled, the surface's containment fallback renders a `fallback.internal` envelope with that entry's exit code while the already-written audit record retains the original `exitCode` and `outcomeClass`. The DEC-8 ordering makes the record authoritative for what the command computed, not for stream delivery.

### Scripted-mode relationship

The audit ledger is the durable home of the context fields that scripted machine output trims. In scripted mode, a successful `--json` line carries only `data` and a failure line carries the `error` object plus a top-level `runId`; `schemaVersion`, `exitCode`, and `timing` are absent from the line and remain in the invocation record (`resultSchemaVersion`, `exitCode`, `timing`). The audit write itself is mode-independent. The rendering contract, the `--verbose` override, and the `--pretty` indentation rule are documented in [Result Contract and Error Table](feature-result-contract.md).

## Technical Architecture & Codebase Map

### Core components

| Path | Component | Responsibility |
|------|-----------|----------------|
| `packages/core/src/contracts/audit.ts` | Audit vocabulary | Record kinds, payload schema ids, store-scoped key, 13/3 field sets, outcome vocabulary, `claimed` attribution marker, identity-variable suffix and derivation, chain anchor, chain-key artifact naming, and the boundary declaration. Types and `as const` data only. |
| `packages/core/src/contracts/state.ts` | Store vocabulary | The additive store-managed artifact read/get-or-create request and result types on the public port. |
| `packages/core/src/state/audit.ts` | Audit consumer | Reservation-first append, payload assembly, keyed chain computation and verification, chaining-key read/ensure, orphan detection, and the bounded filtered read surface. Composes the public port only. |
| `packages/core/src/state/artifact-boundary.ts` | Boundary factory | Reusable validated boundary used for both audit kinds. |
| `packages/core/src/state/index.ts` | Store facade | Implements `readStoreArtifact`/`ensureStoreArtifact`; exports the audit consumer functions. |
| `packages/core/src/state/driver/runtime-edge.ts` | Runtime edge | The only runtime-API location; supplies `randomHex` (cryptographic random bytes) and the store filesystem/permission primitives. |
| `packages/cli/src/index.ts` | Command surface | Samples `startedAt`, assembles the invocation facts after computing the outcome, writes the audit record best-effort, and emits the classified audit diagnostic. |
| `packages/cli/src/edge.ts` | Runtime-aware edge | `resolveAgentIdentity` (injected environment + derived prefix), `resolveCliMode`, `createCliAudit` (scope, repo, identity, store-backed writer), and `createProductionDependencies` (epoch clock, mode fact, and the state-backed audit seam over the home-derived state directory). |
| `packages/cli/src/output/serialize.ts` | Serialization | Single redaction chokepoint and the scripted/envelope rendering path used by the audit-redaction guarantee. |
| `packages/testkit/src/result-conformance.ts` | Conformance validator | Envelope and scripted-projection rules used by the both-mode golden suites. |

### Key functions

```ts
function appendAuditInvocation(
  store: StateStorePort,
  facts: AuditInvocationFacts,
): StateResult<AuditAppendOutcome>;

function verifyAuditChain(store: StateStorePort): AuditReadResult<AuditChainVerdict>;

function readAuditLedger(
  store: StateStorePort,
  query: AuditReadQuery,
): AuditReadResult<AuditReadOutcome>;

function readAuditChainKey(store: StateStorePort): StateResult<string>;
function ensureAuditChainKey(store: StateStorePort): StateResult<string>;
```

`AuditAppendOutcome` carries `auditSeq`, `reservationSequence`, `invocationSequence`, and the invocation `chainValue`. `AuditChainVerdict` carries `verified`, `records`, `breaks`, `orphans`, and `storePath`. `AuditReadOutcome` carries `verifiedEmpty`, `records`, `matched`, `truncated`, `chain`, and `storePath`. `AuditReadResult` is a local success/failure union whose failure is either a state classification or the `input.value.rejected` refusal.

### Data architecture

- **Ledger record.** The state layer wraps each append in its normal record envelope (schema version, record kind, store-scoped key, contiguous sequence, checksum, JSON payload). The audit kinds use `recordKey = "audit.invocations"`; the payload is the audit payload described above.
- **Payload schemas.** `delivery.audit.invocation.v1` and `delivery.audit.reservation.v1`. Each payload's `schemaId` marker matches its schema id.
- **Store layout.** The chaining key is `chain-key.<workspace>.json` in the state directory, named with the same percent-encoded workspace segment as the ledger, header, index, and fence files.
- **Chain.** The link sequence alternates reservation, invocation, reservation, invocation, starting from the chain anchor. The reserved ordinal and the chain link are the two pieces of durable evidence that make an omitted invocation visible and an edited record detectable.
- **Read fold.** Invocation records are filtered from the verified audit sequence; reservations contribute ordinal evidence and the orphan finding. Chain verification and orphan detection are computed from the same verified read.

### API and interface contracts

- `appendAuditInvocation` acquires `audit-<runId>`, reads verified ledger truth, ensures the chain key, appends the reservation then the invocation, and always releases the fence. It returns the appended ordinals and sequences or a classified state failure.
- `verifyAuditChain` reads the verified audit boundary; an empty domain is verified with zero records and needs no key artifact, and a non-empty domain reads the key and recomputes the chain.
- `readAuditLedger` validates the query, reads verified audit truth, computes the chain verdict, filters invocation records, applies the limit, and reports `matched`/`truncated`. It never fences and writes no audit record; a derived-index rebuild, if any, is reported separately by the store.
- `readAuditChainKey` and `ensureAuditChainKey` go through `readStoreArtifact`/`ensureStoreArtifact`; `ensureStoreArtifact` passes the guarded audit kinds so a missing key on a non-first open is `state.keys.missing`.
- `createCliAudit` resolves the claimed identity once from injected environment data and returns the scope, optional repo, optional identity, and a `record(facts)` function that maps a state failure to `{ ok: false, code }`.

## Security and Boundaries

- **Tamper-evidence, not tamper-prevention.** The chain detects corruption and alteration by an actor outside the single-user model; within the pinned single-user trust model, forgery resistance rests on state-file permissions (`0600`), not on chaining-key secrecy. Same-user processes can read state artifacts, and the guarantee is integrity evidence, not tamper prevention.
- **Claimed-not-proven identity.** Identity is attribution only, never an authorization input. The `claimed` marker keeps it distinguishable from any future proven identity.
- **Single redaction path.** Arguments, command tokens, and the identity value pass the same serialization/redaction chokepoint as machine output; registered secret values never survive into a record.
- **No new ambient reads.** Identity is read from injected environment data at the runtime-aware edge. The chaining key is generated runtime state persisted through the store artifact path; no environment read is involved. No new error-table row exists: audit and key failures reuse the existing state identities, and a read refusal reuses `input.value.rejected`.
- **Key containment.** The key exists only as store-managed material and injected runtime state; it never enters configuration, an ambient environment, a lane environment, a record payload, or evidence.
- **Library-only surface.** The read surface is a library/query surface over the state port. No audit command exists, and no command definition is exported by the consumer.
- **Tier boundaries.** Contracts stay runtime-neutral. The audit consumer imports contracts and its own modules; runtime APIs remain in the driver edge; the state tier never imports branding.

## Non-Functional Requirements

| Concern | Current guarantee |
|---------|-------------------|
| Exactly-once invocation records | 100% of audited invocations across success, void success, classified failure, unknown failure, and broken invocation produce exactly one `audit.invocation` record; reservations are never counted; re-runs produce a distinct record. |
| Ordinal durability | The ordinal is the highest verified reservation ordinal plus one; reservation orphans are reported in-band and a failed reservation consumes nothing. |
| Secret exclusion | No edge-registered secret value appears in any record field, on any outcome class. Values never registered at the edge are outside the guarantee, identical to the output-stream contract. |
| Tamper-evidence | Every alteration of an audit-domain record — including recomputed unkeyed checksums and orphaned reservations — is flagged as a chain break naming the record position; zero false "verified" verdicts in the mutation suite. |
| Key exclusion and continuity | The chaining key never enters a record, configuration, an ambient environment, or a lane environment; unaltered history verifies from a later process with zero false chain-break flags. |
| Identity fidelity | A present value is recorded as supplied (never trimmed); nothing is inferred when absent, empty, or whitespace-only; no empty identity field is recorded. |
| Read boundedness | Every query honors the required limit and reports truncation in-band; no unbounded dump path exists. |
| Data preservation and retention | Malformed entries classify without silent loss; salvage preserves its invariants; retention is forever; no prune, delete, or compaction path exists. |
| Audit-outcome independence | An audit-write failure is a classified diagnostic and never changes the command outcome or exit code. |
| Tier conformance | No new runtime-API location, no driver discriminant, no new error-table row, and the error-table sync check stays green. |

## Quality Assurance Strategy

The audit ledger is exercised entirely through automated `bun:test` suites. The test plan defines 50 traceable cases (`TC-GH223-001` through `TC-GH223-050`) across every acceptance criterion.

| Level | Suites | Scope |
|-------|--------|-------|
| Behaviour — append and outcome matrix | `audit-ledger`, `audit-outcomes`, `audit-timestamp`, `audit-identity`, `audit-write-failure`, `audit-ordinal-gap`, `audit-reservation-orphan`, `audit-reservation-failure`, `audit-malformed`, `audit-rebuild-orphan`, `audit-redaction`, `audit-scenario-m1-23` | Exactly-one record per outcome class, two-phase order, ordinal durability, timestamp and identity capture, failure degradation, malformed-entry classification, orphan findings, redaction, and the seeded end-to-end scenario. |
| Behaviour — chain and key | `audit-chain`, `audit-chain-reservation`, `audit-chain-reservation-orphan`, `audit-chain-mutations`, `audit-chain-salvage`, `audit-key-artifact`, `audit-key-exclusion`, `audit-key-open-failures`, `audit-chain-cross-process`, `audit-salvage-reservation` | Clean verification, both-kind and orphan mutation detection, salvage continuity, key creation/permissions/reuse/exclusion/open failures, and cross-process verification. |
| Behaviour — read surface | `audit-read`, `audit-read-refusal`, `audit-read-time-window`, `audit-read-command-filter`, `audit-rebuild-orphan` | Exact filters, inclusive windows, truncation, refusal identity, torn/unknown classification, boundedness, and the command filter over raw-token records. |
| Golden and rendering | `tests/golden/envelope-scripted.test.ts`, `envelope-mode`, `scripted-trim`, `scripted-projection`, plus the existing interactive goldens | Both-mode byte conformance, one-line scripted projections, top-level `runId` on failures, and no case without a golden or a skip path. |
| Structure and contract | `tests/structure/audit-contract`, `audit-imports`, `audit-surface`, `scripted-projection`, `state-contract`, `state-imports`, `state-scope` | Exact kind/schema/key/field declarations, store-layout path, tier imports, no CLI audit command, no unbounded dump export, and the documented consumer set. |
| Checks and boundaries | `tests/checks/error-table-sync`, `tests/checks/forbidden-literals`, `tests/boundaries/**` | No new error rows, no hardcoded product token, and import-edge conformance. |

Fixtures live in `tests/fixtures/audit/**` (cases, mutation matrix, reservation cases, lane environment, key open failures) and the shared audit-store helpers in `tests/fixtures/state/harness.ts`. Determinism rules: no process spawning, no real clock, no ambient environment read, no real process streams, no network, and stores under a per-test temporary root. A skipped case never counts as a pass.

## Operational & Support

### Configuration

The ledger has no configuration keys. The runtime-aware edge supplies the store, scope, injected environment record, and environment prefix; a caller may also compose an audit seam with a repository target. `createProductionDependencies` composes the shipped default: it resolves the mode from the injected stream-capability fact (`isTTY`; an omitted fact resolves to `scripted`), injects the epoch-millisecond UTC clock (`Date.now()`), the run-id factory, the registered secrets, and the state-backed audit seam. The state directory comes from an injected `stateDirectory`, or — when the invoking `cwd` is supplied — from the one state-scope policy, which resolves the **project** state root `<host root>/projects/<project key>` for that checkout, so the audit ledger lives beside the delivery store it describes. Without a `cwd` the edge falls back to the resolved host root for compatibility with existing callers. The store identity uses the injected `workspaceId` or `default`, and the injected `fenceNamespace` or `cli-audit`. Every one of those facts remains injectable and overridable.

The production seam records `scope` as the workspace identity and leaves `repo` absent; the read surface matches both exactly. Per-project store identity is not derived by this composition; it is the responsibility of the queue and daemon compositions. When neither a state directory nor a resolvable home exists, the composition omits the audit seam: the command runs unaudited with its outcome and exit code unchanged, and no audit record or audit diagnostic is produced. That is the composition-time form of the DEC-8 degradation posture; a present state path whose write fails still produces the classified state diagnostic.

The chaining key has no configuration surface: it is generated and persisted as store-managed material. The identity variable is the only operator-facing input, and its absence is valid.

### Observability

The audit record is the observability surface for invocations. `runId` correlates machine output, human diagnostics, and the record; `resultSchemaVersion`, `exitCode`, and `timing` remain in the record when scripted output trims them. A failed audit write appears on the diagnostics stream with its classified state identity. Chain breaks and skipped-ordinal findings name record positions, ordinals, and counts only.

### Retention and storage

Retention follows the state layer: forever. The store grows by two records per audited invocation plus one chaining-key artifact per store. There is no prune, delete, compaction, or expiry path. Operators and agents read history through the bounded surface, not by reading the ledger file directly. Losing the key artifact prevents verification and continuation for subsequent records; key rotation, escrow, and backup/restore are outside the current contract.

### Cost

The ledger adds no network, provider, or telemetry cost. The recurring cost is local storage and two fenced appends per invocation; both are accepted because invocations are human- and agent-scale operations.

## Dependencies & Risks

- **Depends on** the result contract and error table ([feature-result-contract.md](feature-result-contract.md)) for the envelope, `runId`, `timing`, exit projection, the redaction chokepoint, and the mode contract.
- **Depends on** the state layer ([feature-state-layer.md](feature-state-layer.md)) for the public port, additive kinds, artifact boundaries, verified reads, fences, salvage, evidence, and forever retention.
- **Depends on** the branding seam ([feature-branding-seam.md](feature-branding-seam.md)) for `environmentPrefix`, the naming root of the identity variable.
- **Consumed by** the scripted-mode rendering contract in [feature-result-contract.md](feature-result-contract.md): the trim is safe because the record retains the context fields.
- **Consumed by** the retro evidence pipeline ([feature-retro-pipeline.md](feature-retro-pipeline.md)): `retro collect` reads audit history through the bounded surface and carries every skipped-ordinal finding and the full chain verdict into its evidence verbatim.
- **Risk — key loss:** losing the key artifact prevents verification and continuation. Mitigation: the artifact is a store-managed file under the state directory's permissions; rotation and backup/restore are deferred.
- **Risk — claimed identity mistaken for authentication:** the record always carries the `claimed` marker, and identity is never an authorization input.
- **Risk — unbounded history dump:** the read surface requires a limit and exposes no dump export; structure tests pin the absence.
- **Risk — scripted-consumer breakage:** Scripted output does not carry `schemaVersion`, `exitCode`, or `timing`; consumers use the process exit code for status, `runId` on failure for correlation, and the ledger for context.

## Glossary & References

| Term | Definition |
|------|------------|
| Audit ledger | The append-only, keyed-chain record of command invocations in the state layer: one invocation record per audited invocation, each preceded by its reservation. |
| Audit record | One invocation's durable record: the 13 audited fields plus the `schemaId` marker. |
| Audit reservation | The three-field record (`auditSeq`, `runId`, `chainValue`) appended before its invocation record; durable ordinal-consumption and chain-link evidence, not an invocation record. |
| Audit-sequence ordinal | The per-store monotonic `auditSeq`, allocated as the highest verified reservation ordinal plus one and consumed durably by the reservation append. |
| Skipped-ordinal finding | An in-band read finding for a reservation whose invocation record is absent from the verified ledger. |
| Claimed identity | The seam-named environment-variable value recorded without trimming with the `claimed` marker; attribution only, never inferred when absent. |
| `resultSchemaVersion` | The invocation record's copy of the rendered envelope's `schemaVersion` at invocation time, distinct from the record payload schema id. |
| Chaining key | Durable store-managed key material generated once per store and persisted as `chain-key.<workspace>.json`. |
| Chain value | A record's keyed link over the previous audit-domain link and its audited content; present in both audit kinds. |
| Chain break | A verification finding naming the record position where the recomputed link diverges; evidence only. |
| Scripted mode | The machine-output mode for non-interactive streams: one minified `{"data":...}` or `{"error":...,"runId":...}` line. |
| Interactive mode | The machine-output mode for terminal streams: the full result envelope. |

## Related

- [Result Contract and Error Table](feature-result-contract.md) — the envelope, error table, mode-aware rendering, and redaction chokepoint.
- [State Layer](feature-state-layer.md) — the store, additive record kinds, artifact boundary, store-managed artifacts, fences, salvage, and retention.
- [Retro Evidence Pipeline](feature-retro-pipeline.md) — the first consumer of the bounded read surface; carries skipped-ordinal findings and the chain verdict into retro evidence.
- [Branding Seam and Working Name](feature-branding-seam.md) — `environmentPrefix`, the naming root of the identity variable.
- [Glossary](../../overview/glossary.md) — repository-wide terms.
- [ADR-0003](../../decisions/ADR-0003-oss-monorepo-structure.md), [TDR-0004](../../decisions/TDR-0004-state-storage-engine.md), [TDR-0005](../../decisions/TDR-0005-delivery-result-enum-and-cli-exit-taxonomy.md).
- Change record: `doc/changes/2026-11/2026-11-06--GH-223--audit-ledger/`.
