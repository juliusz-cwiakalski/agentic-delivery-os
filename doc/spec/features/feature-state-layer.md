---
id: SPEC-STATE-LAYER
status: Current
created: 2026-10-30
last_updated: 2026-10-30
owners: ["engineering"]
service: delivery-os
summary: "The implemented M0-S5 state layer: an injected store identity, an append-only schema-versioned JSONL ledger as durable truth, disposable JSONL-scan and SQLite-index driver kinds over the same ledger, classified torn-state detection with verified-empty evidence and terminal-tail repair, key-set assertions with no default substitution, single-writer fences with explicit reported recovery, atomic derived-document replace, and least-privilege permissions with a documented Windows ACL contract."
links:
  related_changes: ["GH-174"]
  related_decisions: ["ADR-0003", "TDR-0004"]
---

# Feature: State Layer

## Overview

The state layer is the durable local substrate later verification reads through. A store is opened from an injected identity — level, workspace identifier, fence namespace, schema version, and a concrete state directory — and exposes one driver-neutral port: append, read with a key-set assertion, replace a derived document, acquire/release/recover a fence, check integrity, and repair a terminal torn tail.

The append-only, schema-versioned JSONL ledger is the single durable truth. The declared driver kinds select only the read/index strategy over that same ledger: `jsonl` reads by verified scan, `sqlite` maintains a disposable derived index that is rebuilt from verified ledger truth whenever it is missing, corrupt, or divergent. No operation, result, or type on the public port discriminates by driver kind.

The foundation story ships no command surface, no configuration read, and no consumer beyond tests. Store identity, paths, clock, and platform arrive as injected parameters; the state tier never imports branding and never derives a name.

## Business Context

- **Problem:** Without durable state and integrity discipline, later verification reads either nothing or unverified bytes; corruption presents as empty truth, concurrent writers corrupt shared stores, and partially written documents masquerade as landed mutations.
- **Affected users:** Later consumer stories (status, verify-change, phase lint) and the operators and agents that rely on their verdicts.
- **Value:** One truthful substrate with classified failures, so "no data" and "corrupt data" are never confused.

## User Experience & Functionality

### Capabilities

- **Injected identity:** level (`local` implemented; `project` and `global` declared), caller-supplied workspace identifier, fence namespace, schema version (`delivery.state.v1`), and the state directory. Identical inputs yield identical identity; a `project` or `global` request fails `state.level.unsupported` with no filesystem effect and no silent local fallback.
- **Ledger truth:** every append lands one LF-terminated JSON object carrying schema version, record kind, store-scoped key, contiguous store-scoped sequence, checksum, and a JSON-compatible payload. Earlier bytes are never rewritten. Every derived-document mutation is first a ledger record.
- **Driver kinds:** `jsonl` verified scan and `sqlite` derived index. The index is disposable and never truth; divergence is detected on read, rebuilt from the verified ledger, and reported, or the read fails `state.write.failed`.
- **Torn-state detection:** framing break, truncated tail, sequence gap/duplicate/reset, checksum mismatch, and index/ledger divergence are detected before any value returns and fail `state.store.torn` with a store path and record position only — never payload or checksum bytes.
- **Verified-empty:** an absent (or zero-record) store is explicit verified-empty evidence. It satisfies only an empty key-set declaration; a non-empty declaration fails `state.keys.missing`. Verified-empty and torn are never conflated.
- **Key-set assertions:** a read declares its required keys; a missing declared key fails `state.keys.missing` naming exactly the missing keys. Present keys return recorded values exactly, including `0`, `""`, `false`, `null`, and empty collections. No default is substituted.
- **Bounded repair:** the only destructive operation is explicit terminal-tail repair. Terminal truncation is removed and reported; mid-record corruption refuses with `state.store.torn` and changes nothing. No automatic repair exists.
- **Single-writer fences:** acquisition binds a caller-supplied token to a lock file created exclusively. A second acquisition fails `state.lock.busy` (transient, retryable). Writes are unrepresentable without the acquired handle; reads never require it.
- **Staleness and recovery:** a fence whose injected-clock age exceeds the injected staleness window is detectably stale. Writes fail until an explicit, reported recovery clears it; a live fence can never be stolen.
- **Atomic replace:** a derived document is written to a same-directory temporary, flushed, and renamed over the target. The observable target is the previous or the new version, never partial. Stale temporaries are removed on the next open and never read as content.
- **Least-privilege permissions:** creation applies POSIX mode `0700` to the state directory and `0600` to every store-managed file after creation, independent of the inherited umask; open verifies the same exact bits and a violation fails `state.permission.denied` instead of continuing permissively. On Windows the same port applies and verifies a current-user-only ACL.
- **Failure identity:** the seven state codes are declared in the machine error table and the documented error table in the same change, and the bidirectional sync check is binding. All state failures carry consequence `not_landed`.

### Store layout

One store per workspace inside the injected state directory:

| Path | Purpose |
|---|---|
| `ledger.<workspace>.jsonl` | append-only durable truth |
| `header.<workspace>.json` | store schema version |
| `index.<workspace>.sqlite` | disposable derived index (indexed kind only) |
| `fence.<workspace>.lock` | single-writer lock token |
| `documents.<workspace>/` | atomically replaced derived documents |

## Technical Architecture & Codebase Map

- `packages/core/src/contracts/state.ts` — driver-neutral vocabulary: identity, record envelope, fence handle, evidence, failure, and the single `STATE_SCHEMA_VERSION` home. Types and data only.
- `packages/core/src/contracts/error-table.ts` — the `state` domain kind and seven exact-code rows.
- `packages/core/src/state/index.ts` — the facade over injected identity and the injected runtime edge; the only public factory that accepts a driver kind.
- `packages/core/src/state/ledger.ts` — framing, FNV-1a 64-bit payload checksum, terminal completeness, sequence continuity, and schema-version verification. Pure.
- `packages/core/src/state/edge.ts` — the runtime-edge interface and the named fault points. Types only.
- `packages/core/src/state/driver/runtime-edge.ts` — the only location of runtime APIs: filesystem, permissions, injected clock, and the built-in SQLite binding.
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

Linux CI cannot verify the Windows half. The task suite records an explicit platform conditional with the owner-environment dependency (spec OQ-2); no Linux run claims Windows verification. Both branches are selected by the injected platform value on `StateRuntimeEdge`, never by an ambient probe in the state tier.

### Evidence model

Every read returns an evidence verdict: the verification classes performed, the record count, and an explicit verified-empty marker for an absent store. Index rebuild reports appear only when a rebuild occurred; repair and recovery reports are returned by their operations and only when they ran. Evidence names store paths and record positions, never payload content, checksum bytes, or ambient data.

### Boundaries

The state tier imports `./contracts` and its own modules only; runtime APIs appear only in the driver edge. Adapters may not import the state subpath; surfaces may. The public port exposes no driver discriminant, and call-site code never branches on a driver kind.

## Operational Notes

- Store format evolution requires a new state schema version and the classified `state.schema.mismatch` path; readers never reinterpret a store from another version.
- Retention is forever. There is no prune, delete, expiry, or compaction surface; only explicit terminal-tail repair removes bytes.
- The state schema version is carried by the header and by every record; a store artifact without a version is an integrity failure.

## Related

- [Result contract and error table](feature-result-contract.md) — the `state` rows and the binding sync check.
- [Monorepo scaffold and toolchain](feature-monorepo-scaffold-toolchain.md) — tier and runtime-API boundaries.
- [Branding seam](feature-branding-seam.md) — `stateDirectoryName` is consumed as an injected parameter, never imported here.
- [ADR-0003](../../decisions/ADR-0003-oss-monorepo-structure.md), [TDR-0004](../../decisions/TDR-0004-state-storage-engine.md).
