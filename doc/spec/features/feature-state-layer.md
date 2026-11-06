---
id: SPEC-STATE-LAYER
status: Current
created: 2026-10-30
last_updated: 2026-11-05
owners: ["engineering"]
service: delivery-os
summary: "The implemented state layer: an injected store identity, an append-only schema-versioned JSONL ledger as durable truth, disposable JSONL-scan and SQLite-index driver kinds over the same ledger, rebuild from the ledger alone including a post-salvage ledger, classified torn/unknown detection with verified-empty evidence, explicit guided terminal-tail salvage with quarantine, reusable validated artifact-boundary contracts, fail-closed storage exhaustion, key-set assertions with no default substitution, single-writer fences with explicit reported recovery, atomic derived-document replace, least-privilege permissions with a documented Windows ACL contract, the provider park/announcement record kinds with the rebuildable provider-parks.json projection, and the additive closeout.operation outcome ledger."
links:
  related_changes: ["GH-174", "GH-177", "GH-179", "GH-181", "GH-182", "GH-175", "GH-176", "GH-183", "GH-222"]
  related_decisions: ["ADR-0003", "TDR-0004", "TDR-0005"]
---

# Feature: State Layer

## Overview

The state layer is the durable local substrate later verification reads through. A store is opened from an injected identity — level, workspace identifier, fence namespace, schema version, and a concrete state directory — and exposes one driver-neutral port: append, read with a key-set assertion, read the verified record list, replace a derived document, acquire/release/recover a fence, check integrity, repair a terminal torn tail, and run the explicit guided salvage operation.

The append-only, schema-versioned JSONL ledger is the single durable truth. The declared driver kinds select only the read/index strategy over that same ledger: `jsonl` reads by verified scan, `sqlite` maintains a disposable derived index that is rebuilt from verified ledger truth whenever it is missing, corrupt, or divergent. No operation, result, or type on the public port discriminates by driver kind.

The layer ships no command surface and no configuration read. Its durable consumers append through the fenced port and read through verified reads: the delivery registry writes `phase.transition` records and replaces the per-change phase-state document as a rebuildable fold of verified records; verify change reads transition history; the provider engine writes park and announcement records; closeout writes `closeout.operation` outcome records and reads them to converge on re-run; and the status digest and the queue-ready ready-set read the verified provider park fold without writing anything. Store identity, paths, clock, and platform arrive as injected parameters; the state tier never imports branding and never derives a name.

## Business Context

- **Problem:** Without durable state and integrity discipline, later verification reads either nothing or unverified bytes; corruption presents as empty truth, concurrent writers corrupt shared stores, and partially written documents masquerade as landed mutations.
- **Affected users:** The delivery registry and later consumer stories (status, verify-change), and the operators and agents that rely on their verdicts.
- **Value:** One truthful substrate with classified failures, so "no data" and "corrupt data" are never confused.

## User Experience & Functionality

### Capabilities

- **Injected identity:** level (`local` implemented; `project` and `global` declared), caller-supplied workspace identifier, fence namespace, schema version (`delivery.state.v1`), and the state directory. Identical inputs yield identical identity; a `project` or `global` request fails `state.level.unsupported` with no filesystem effect and no silent local fallback.
- **Ledger truth:** every append lands one LF-terminated JSON object carrying schema version, record kind, store-scoped key, contiguous store-scoped sequence, checksum, and a JSON-compatible payload. Earlier bytes are never rewritten. Every derived-document mutation is first a ledger record.
- **Driver kinds:** `jsonl` verified scan and `sqlite` derived index. The index is disposable and never truth; divergence is detected on read and rebuilt from the verified ledger — including a post-salvage ledger, where the rebuild converges with the verified scan — and reported, or the read fails `state.write.failed`. Salvage never reads or mutates the index; the next indexed read rebuilds from the salvaged ledger.
- **Torn-state detection:** framing break, truncated tail, sequence gap/duplicate/reset, and checksum mismatch are detected before any value returns and fail `state.store.torn` with a store path and record position only — never payload or checksum bytes — and remediation guidance that points at inspection and the explicit salvage operation. Index/ledger divergence (indexed kind) is detected on read and resolved by rebuilding from verified ledger truth with a reported rebuild, or the read fails `state.write.failed`; it is never served as a stale value.
- **Unknown-kind detection:** a record kind or payload schema that is undeclared at a validated boundary fails `state.store.unknown` with the store path and record position, distinct from the version-scoped `state.schema.mismatch`; a boundary never serves a silent zero or an empty list for it.
- **Boundary validation:** reusable artifact-boundary declarations carry the record kinds, payload schema identifiers, record identities, typed required fields, and closed vocabularies a consumer owns under one store-scoped key prefix. Reads validate every owned record before any value returns and classify the four verdicts distinctly (valid, verified-empty, torn, unknown); writes admit only schema-conforming records and refuse the rest with `state.store.unknown` and `not_landed`, filling in no default. The raw store port stays kind-agnostic; "undeclared" is boundary-relative. The delivery registry declares its own boundary; artifact kinds standing in for the future retro registry and ceremony artifacts exercise the same contract in tests, and neither pipeline exists.
- **Verified-empty:** an absent (or zero-record) store is explicit verified-empty evidence. It satisfies only an empty key-set declaration; a non-empty declaration fails `state.keys.missing`. Verified-empty and torn are never conflated.
- **Key-set assertions:** a read declares its required keys; a missing declared key fails `state.keys.missing` naming exactly the missing keys. Present keys return recorded values exactly, including `0`, `""`, `false`, `null`, and empty collections. No default is substituted.
- **Terminal-tail repair:** the explicit repair operation removes a terminal truncated tail — the bytes after the last complete frame, accepted only when every complete line before it verifies — and reports the removed byte and frame counts; a verified or empty ledger is a reported no-op, and any other tear, including a truncated tail whose complete-lines prefix is itself broken, refuses `state.store.torn` with zero byte mutation. Repair discards the removed bytes and appends no record; salvage is the guided path that preserves them.
- **Guided salvage:** the explicit, fenced salvage operation truncates a terminal torn tail to its last valid frame, appends one classified `state.salvage` record under the store-scoped key `state.salvage` with payload schema `delivery.state.salvage.v1` describing the salvage (tear position, quarantine reference, counts — never payload or checksum bytes), and returns a salvage evidence report naming the truncation offset, quarantined extent, and record counts. The record kind is additive within `delivery.state.v1`; no schema-version bump or migration exists. No automatic or read-triggered repair exists: reads classify and change nothing. A mid-record integrity break — including a tear whose first break is mid-record and whose final frame is also truncated — refuses with `state.store.torn` and zero byte mutation before any write, preserving the bounded terminal-tail repair model. Salvage is terminal-tail only: on a verified or empty ledger it is a reported no-op, and an absent ledger returns a no-op outcome with verified-empty evidence. Salvage failures reuse existing identities — a mid-record tear is `state.store.torn`, an exhausted write is `state.storage.exhausted`, any other salvage or quarantine write failure is `state.write.failed`, a permission violation is `state.permission.denied`, and fence contention is `state.lock.busy`.
- **Fail-closed storage exhaustion:** an append, derived-document replace, or salvage write that cannot complete for storage exhaustion fails `state.storage.exhausted` with `not_landed` and storage-exhaustion remediation; the ledger stays at its last valid frame, no partial frame is appended, and the document target stays at its previous version (or absent). The runtime edge re-raises a full-device or settled-quota failure (`ENOSPC`, `EDQUOT`, `EFBIG`) in a distinguishable form the facade maps to that code. Every other write error keeps `state.write.failed`; a failed index rebuild keeps `state.write.failed`.
- **Single-writer fences:** acquisition binds a caller-supplied token to a lock file created exclusively. A second acquisition fails `state.lock.busy` (transient, retryable). Writes are unrepresentable without the acquired handle; reads never require it.
- **Staleness and recovery:** a fence whose injected-clock age exceeds the injected staleness window is detectably stale. Writes fail until an explicit, reported recovery clears it; a live fence can never be stolen.
- **Atomic replace:** a derived document is written to a same-directory temporary, flushed, and renamed over the target. The observable target is the previous or the new version, never partial. Stale temporaries are removed on the next open and never read as content.
- **Least-privilege permissions:** creation applies POSIX mode `0700` to the state directory and `0600` to every store-managed file after creation, independent of the inherited umask; open verifies the same exact bits and a violation fails `state.permission.denied` instead of continuing permissively. The quarantine directory and its artifacts are held to the same contract and verified on store open. On Windows the same port applies and verifies a current-user-only ACL.
- **Failure identity:** the nine state codes (including `state.storage.exhausted` and `state.store.unknown`) are declared in both the machine error table and the documented error table, and the bidirectional sync check is binding: a code change in one table without the other fails. All state failures carry consequence `not_landed`, and each is triggerable by a real behaviour.
- **Provider availability records:** the provider engine persists `provider.park` and `provider.announcement` records as additive kinds inside the existing state schema, with payload schemas `delivery.provider.park.v1` and `delivery.provider.announcement.v1`. It folds verified ledger truth into the rebuildable derived document `provider-parks.json` (`delivery.provider.parks.v1`). Park expiry is derived at read time; no expiry write or delete exists, and a park observed after expiry stays `expired` with no `cleared` write.
- **Closeout outcome records:** the closeout transaction persists one `closeout.operation` record per attempted operation outcome as an additive kind inside the existing state schema, with payload schema `delivery.closeout.operation.v1` under the store-scoped key prefix `closeout.operations:`. Each payload carries exactly the new operation record; history is folded from the verified ledger records on read, so storage grows linearly with operations. Apply uses one single-writer fence; reads are verified; the first terminal outcome per operation identity is authoritative; each record's identity, types, closed vocabularies, canonical arguments, target, and evidence validate before admission, and a malformed record is a classified `state.*` failure, never zeros. No schema-version bump or migration is required.

### Store layout

One store per workspace inside the injected state directory:

| Path | Purpose |
|---|---|
| `ledger.<workspace>.jsonl` | append-only durable truth |
| `header.<workspace>.json` | store schema version |
| `index.<workspace>.sqlite` | disposable derived index (indexed kind only) |
| `fence.<workspace>.lock` | single-writer lock token |
| `documents.<workspace>/` | atomically replaced derived documents, including `phase-state.<REF>.json` and `provider-parks.json` |
| `quarantine.<workspace>/` | post-tear bytes preserved by an explicit salvage, named deterministically per tear, never served as content |

### Delivery registry consumer

The delivery registry composes the public port without adding a runtime-API location. It appends `phase.transition` records under one store-scoped key per change; each landed payload carries the new transition plus the full verified history, so a verified read returns the history from the ledger record itself. A no-op transition appends nothing.

Reads and landings pass through the registry's declared artifact boundary: the boundary validates the record kind, payload schema, change-ref identity, required fields, and the closed operation/outcome vocabularies before any value returns or is written. A top-level payload that loses a declared field classifies `state.store.unknown`; a malformed nested transition entry remains `state.keys.missing`, and a refused write appends nothing.

The per-change phase state is a derived document (`phase-state.<REF>.json`) produced by a pure fold: a completion records the first-completion start and the latest completion, and a reopen clears `completed` while keeping the start. The projection is replaced atomically through the derived-document kind and is rebuildable from verified ledger truth; a torn store never produces one. Registry behavior is specified in [pm-notes lint and phase transitions](feature-pm-notes-lint-and-phase-transitions.md).

### Provider parks consumer

The provider engine composes the same public port without adding a runtime-API location. It appends `provider.park` records under the store-scoped key `provider.parks` and `provider.announcement` records under `provider.announcements`; each landed payload carries the full verified history, so a verified read returns the history from the ledger record itself. Persistence is fenced and occurs only in a mutating provider `resolve`; `quota` and `parks list` perform zero state writes.

The `provider-parks.json` derived document is a per-park-name fold of the latest record, ordered by expiry ascending then name lexical, with schema `delivery.provider.parks.v1`. It is replaced atomically only when park truth changes. Read paths fold verified ledger truth directly, so a missing or divergent projection is served from the fold with zero writes; the persisted document catches up on the next mutating resolve. A park is active while `expiresAt > now`, expired at `expiresAt <= now` with no write, and `cleared` only when a `cleared` record for a clear observed before expiry was appended; a park observed after expiry stays `expired` with no write, while the next mutating resolve emits its `provider.resumed` announcement. The provider vocabulary and read views are specified in [Provider Engine](feature-provider-engine.md).

### Closeout consumer

The closeout transaction composes the same public port without adding a runtime-API location. The CLI edge bridges the fenced `StateStorePort` to the closeout runtime (`createCloseoutStateRuntime`), so history reads, appends, and post-append coverage verification all execute over the same verified JSONL ledger driver. On apply it reads the verified records for `closeout.operations:<workItemRef>` through the port's `readRecords` view and folds the first terminal outcome per operation identity; it acquires one fence and appends one `closeout.operation` record per attempted operation outcome, with each payload carrying only that new record. Each append re-reads the folded history and fails `state.store.torn` when the verified record count differs from the expected count. A persisted `failed` record is retained as evidence but is not terminal, so a re-run re-observes provider state and retries safely. A malformed record or torn store is the classified `state.*` failure; an absent per-work-item key is an empty verified history, never a zeroed value or a torn store. The closeout record vocabulary and retry semantics are specified in [Closeout Transaction](feature-closeout.md).

### Status consumer

The status digest is a read-only consumer of the state layer. Its providers section folds verified ledger truth into active park views through the same read-only `readProviderParkViews` entry the provider command uses; it reads the `provider.park` history, applies read-time expiry, and never reads the persisted `provider-parks.json` projection as truth. One logical park-fold read occurs per status invocation, and the fold's documented internal verified reads are not multiplied by status.

Status acquires no fence, appends no record, replaces no derived document, and never repairs or clears a park. An unreadable store is a classified `state.*` evidence code on a `degraded` providers section, never a command failure and never a "no parks" claim. The status contract and evidence model are specified in [Status Digest](feature-status-digest.md).

### Queue-ready consumer

The `queue ready` ready-set is a read-only consumer of the same verified park fold. Its `provider-available` condition reads active park views through the same fold, applies read-time expiry, and never reads the persisted `provider-parks.json` projection as truth. One logical park-fold read occurs per invocation.

Queue ready acquires no fence, appends no record, replaces no derived document, and never repairs or clears a park. An unreadable store surfaces as `state-unreadable` evidence on the provider condition, never a command failure and never a "no parks" claim. The condition contract is specified in [Queue Ready](feature-queue-ready.md).

### Verify-change consumer

Verify change is a read-only consumer of the state layer. It reads the registry's per-change transition history through a presence-tolerant verified read: the store is verified first, an absent store or an absent per-change record is explicit no-evidence (`present: false`), and a torn, schema-mismatched, or corrupt-payload read remains the classified `state.*` failure. The read acquires no fence and writes nothing.

The derived `phase-state.<REF>.json` projection is not evidence for verification: verify folds the verified ledger directly, so a stale or missing projection cannot change the verdict. Verification never mutates the ledger, the header, the index, or a derived document. Its consumer contract is in [verify change and exit taxonomy](feature-verify-change-and-exit-taxonomy.md).

## Technical Architecture & Codebase Map

- `packages/core/src/contracts/state.ts` — driver-neutral vocabulary: identity, record envelope, salvage record and salvage evidence, artifact-boundary declarations, fence handle, evidence, failure, and the single `STATE_SCHEMA_VERSION` home. Types and data only.
- `packages/core/src/contracts/error-table.ts` — the `state` domain kind and nine exact-code rows.
- `packages/core/src/state/index.ts` — the facade over injected identity and the injected runtime edge; the only public factory that accepts a driver kind.
- `packages/core/src/state/registry.ts` — registry records over the state port, including the presence-tolerant verified transition read (`readChangeTransitionsTolerant`) and the pure fold; no runtime API.
- `packages/core/src/state/closeout.ts` — the `closeout.operation` ledger: store-scoped key, verified history read, append with post-append coverage verification, record validation, and the first-terminal fold; no runtime API.
- `packages/core/src/domain/verify-change.ts` — pure verify classification over parsed documents and folded transition records; no state access itself.
- `packages/core/src/state/ledger.ts` — framing, FNV-1a 64-bit payload checksum, terminal completeness, sequence continuity, schema-version verification, and the pure tear-topology/salvage-record helpers. Pure.
- `packages/core/src/state/artifact-boundary.ts` — the reusable validated artifact-boundary factory (declared kinds, payload schemas, identities, closed vocabularies; four verdicts; write refusal); composes the public port only.
- `packages/core/src/state/storage-error.ts` — runtime-neutral storage-failure classification shared by the facade and the driver edge (the distinguishable ENOSPC-family exhaustion form).
- `packages/core/src/state/edge.ts` — the runtime-edge interface and the named fault points. Types only.
- `packages/core/src/state/driver/runtime-edge.ts` — the only location of runtime APIs: filesystem, permissions, the Windows owner-identity environment read, injected clock, and the built-in SQLite binding.
- `packages/core/src/state/driver/strategy.ts` — the two read strategies over verified records.

### Runtime support matrix (TDR-0004)

| Runtime | `bun:sqlite` | `node:sqlite` | Selected binding | `sqlite` kind |
|---|---|---|---|---|
| Bun 1.4.4 | available | available | `bun:sqlite` | supported |
| Node 24.11.1 | unavailable | available (experimental warning) | `node:sqlite` | supported |
| Runtime without either built-in | unavailable | unavailable | none | explicitly unsupported; `jsonl` unaffected |

The binding is acquired synchronously in the runtime edge (`bun:sqlite` then `node:sqlite`). No third-party dependency is added; the `jsonl` kind and the ledger format never depend on a binding.

### Windows platform contract

The permission contract is one port contract with two platform mechanisms:

- On POSIX the exact bits `0700` (directory) and `0600` (file) are applied after creation and verified on open.
- On Windows an equivalent ACL restricted to the current user is applied at creation (`icacls` with inheritance removed and an explicit current-user grant) and verified on open; a foreign grant or a failed application fails `state.permission.denied`.

Linux CI cannot verify the Windows half. The task suite records an explicit platform conditional with the owner-environment dependency (spec OQ-2); no Linux run claims Windows verification. The current user is resolved at the driver edge from `USERNAME ?? USER`; this is the only state-tier environment read and is an allowlisted `configuration-environment-source` in the secret-read boundary. Both platform branches are selected by the injected platform value on `StateRuntimeEdge`, never by an ambient platform probe in the state tier.

### Evidence model

Every read returns an evidence verdict: the verification classes performed, the record count, and an explicit verified-empty marker for an absent store. Index rebuild reports appear only when a rebuild occurred; repair, salvage, and recovery reports are returned by their operations and only when they ran. Salvage evidence names the truncation offset, the quarantine path and extent, and record counts. Evidence names store paths, record positions, and counts — never payload content, checksum bytes, or ambient data.

### Boundaries

The state tier imports `./contracts` and its own modules only; runtime APIs appear only in the driver edge. Adapters may not import the state subpath; surfaces may. The public port exposes no driver discriminant, and call-site code never branches on a driver kind.

## Quality Assurance Strategy

The state layer is exercised entirely through automated `bun:test` suites; it has no command surface, so there is no end-to-end tier. The enduring coverage map is in the [state layer test specification](../../quality/test-specs/test-spec-state-layer.md).

| Level | Suites | Scope |
|---|---|---|
| Pure unit | `tests/behaviour/state-ledger.test.ts`, `tests/behaviour/state-evidence.test.ts` (pure half), `tests/structure/state-contract.test.ts` | Framing, checksum, terminal completeness, sequence continuity, schema verification, tear topology, evidence phrasing, and data-only contract shape |
| Integration over a temporary store | `tests/behaviour/state-conformance.test.ts`, `state-torn`, `state-unknown`, `state-evidence`, `state-keys`, `state-fence`, `state-permissions`, `state-atomic-replace`, `state-boundary-validation`, `state-salvage`, `state-salvage-invariants`, `state-storage-exhausted`, `state-index`, `state-index-post-salvage`, `state-artifact-boundary`, `state-error-classification`, `phase-registry` | Both driver kinds, all corruption and unknown classes, verified-empty, falsy exactness, fences, atomic replace, artifact boundaries, salvage with quarantine, post-salvage rebuild, fail-closed exhaustion, and the registry consumer |
| Contract | `tests/checks/error-table-sync.test.ts`, `tests/structure/error-table.test.ts` | Machine ↔ documented table parity in both directions, row shape, and non-vacuity mutations for new and refined rows |
| Structure and boundaries | `tests/structure/state-imports.test.ts`, `state-scope.test.ts`, `tests/checks/packed-state.test.ts`, `tests/boundaries/**` | Import confinement, runtime-API placement, consumer scope, and the packed `core/state` subpath |

Fault injection is a fixture contract: `tests/fixtures/state/harness.ts` supplies `createTestEdge`, which records every named `StateEdgeFaultPoint` that was raised so a mistyped point fails loudly. `arm` raises the generic fault (a non-exhaustion write error, classified `state.write.failed`); `armExhaustion` is the opt-in form that raises the distinguishable storage-exhaustion form classified `state.storage.exhausted` and is applied only at the pre-commit write points. Every store lives under a per-test temporary root, and the live tree and user state directory are never touched. SQLite-backed cases skip explicitly when no built-in binding exists, and a skip is never recorded as a pass. POSIX permission assertions are hard gates; Windows ACL behavior stays platform-conditional and is not claimed by a Linux run.

## Operational Notes

- Store format evolution requires a new state schema version and the classified `state.schema.mismatch` path; readers never reinterpret a store from another version.
- Retention is forever, now including quarantine artifacts. There is no prune, delete, compaction, or scheduled-expiry surface; provider parks become inactive by read-time expiry, but their records remain, and closeout operation records accumulate append-only per merge. Only two explicit operations remove ledger bytes: terminal-tail repair discards the truncated tail and reports its extent, while guided salvage quarantines the removed bytes and appends a classified record.
- The state schema version is carried by the header and by every record; a store artifact without a version is an integrity failure.

## Related

- [Result contract and error table](feature-result-contract.md) — the `state` and `lint` rows and the binding sync check.
- [State layer test specification](../../quality/test-specs/test-spec-state-layer.md) — the enduring test-level map, fault-injection contract, and platform conditionals.
- [PM-notes lint and phase transitions](feature-pm-notes-lint-and-phase-transitions.md) — the delivery registry consumer, its record vocabulary, and the derived projection.
- [Provider engine](feature-provider-engine.md) — the provider park and announcement record kinds, read-time expiry, and the `provider-parks.json` fold.
- [Closeout transaction](feature-closeout.md) — the `closeout.operation` record kind, terminal-outcome reuse, and failed-outcome retry.
- [Status digest](feature-status-digest.md) — the read-only verified park-fold consumer.
- [Queue ready](feature-queue-ready.md) — the read-only ready-set consumer of the verified park fold.
- [Verify change and exit taxonomy](feature-verify-change-and-exit-taxonomy.md) — the read-only verification consumer and the delivery-result exit taxonomy.
- [Monorepo scaffold and toolchain](feature-monorepo-scaffold-toolchain.md) — tier and runtime-API boundaries.
- [Branding seam](feature-branding-seam.md) — `stateDirectoryName` is consumed as an injected parameter, never imported here.
- [ADR-0003](../../decisions/ADR-0003-oss-monorepo-structure.md), [TDR-0004](../../decisions/TDR-0004-state-storage-engine.md).
