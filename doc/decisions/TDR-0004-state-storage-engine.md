---
id: TDR-0004
decision_type: tdr
status: Proposed
created: 2026-10-30
decision_date: null
last_updated: 2026-10-30
summary: "Propose appended JSONL framing with an FNV-1a 64-bit payload checksum, runtime-built-in SQLite bindings with a per-runtime matrix, exclusive lock-file fences with an injected staleness clock, verify-then-rebuild index policy, temp-and-rename atomic replace, and a fail-closed Windows ACL branch."
owners: ["Juliusz Ćwiąkalski"]
service: delivery-os state layer
decision_scope: repo
review_date: null
classification:
  domains: [tooling, storage, security]
  archetype: selection
  environment: complicated
  rigor: R2
  reversibility: moderate
  stakes: medium
  urgency: medium
  uncertainty: medium
  blast_radius: local
  recurrence: one-off
governance:
  driver: "@pm"
  decider: "Juliusz Ćwiąkalski (human acceptance pending)"
  contributors: ["@coder"]
  reviewers: ["@reviewer", "@readiness-reviewer", "Human owner (PR review)"]
  performers: ["@coder"]
  informed: []
ai_assistance:
  used: true
  roles: [repository-analyst, experiment-runner, record-writer]
  external_data_shared: false
  citations_verified: false
  human_decider: null
  reviewers: []
revisit_triggers:
  - "A supported runtime drops or changes its built-in SQLite binding, or a third runtime must be supported."
  - "A consumer (M0-S6/S8/S10) needs a record/read shape the container contract cannot express."
  - "A store-format change is required; it must ship a new state schema version and a classified mismatch path."
links:
  related_changes: [GH-174, GH-173]
  supersedes: []
  superseded_by: []
  spec: ["doc/changes/2026-10/2026-10-30--GH-174--state-layer/chg-GH-174-spec.md"]
  contracts: []
  diagrams: []
  decisions: [ADR-0003, TDR-0003]
---

# TDR-0004: State Storage Engine

## Context

- **FACT:** GH-174 §8.4/OQ-1 fixes the store contracts and delegates six genuine selections to delivery: JSONL framing and checksum, per-runtime SQLite binding and fallback, fence/lock mechanics and staleness basis, index rebuild policy, atomic-replace technique, and the Windows ACL mechanism.
- **FACT:** The state tier may import `./contracts` only; runtime APIs live only in `packages/core/src/state/driver/**` (ADR-0003 DEC-2, GH-174 D1/D8). Any selection must keep that split: the runtime edge is replaceable and test-injectable.
- **FACT:** No record payload or checksum bytes may enter an error or evidence object (AC-F9-2); evidence names store paths and record positions only.
- **Classification:** TDR/R2 — a reversible, local implementation selection inside an already-accepted module boundary. No new package, subpath, or contract shape is proposed.
- **Evidence observed:** local runtime experiments on 2026-10-30 (Node v24.11.1, Bun 1.4.4) recorded below; no network access and no external research were used.

## Problem Framing (Clarified)

The store must be durable, verifiable, single-writer, crash-safe, and portable across the repository's two supported runtimes without adding a dependency. The contracts are already fixed; what remains is choosing mechanisms that make them implementable, testable deterministically, and honest about platform limits.

## Constraints (Hard Requirements)

| ID | Pass/fail requirement | Source | Verification | Negotiable |
|---|---|---|---|---|
| C-1 | Runtime APIs only in the state driver edge; the facade, ledger verifier, and contracts stay runtime-neutral. | ADR-0003 DEC-2; GH-174 D1/D8 | dependency-cruiser, ambient guard, state-imports AST detector | no |
| C-2 | No new runtime dependency; if one is genuinely required, the fail-closed license gate applies in-change. | GH-174 D2 | `license-audit`, `vulnerability-gate`, unchanged lockfile | no |
| C-3 | Torn state is detected before any value returns; a checksum/framing/sequence failure must be observable on mutated bytes. | AC-F4-1, NFR-2 | torn fixture matrix with planted canaries | no |
| C-4 | No ambient clock, randomness, or environment read in the state tier; fence staleness is injected. | NFR-7, TC-STATE-015 | injected edge + AST boundaries | no |
| C-5 | A failed write or rebuild is reported `not_landed`; the ledger never depends on the index. | AC-F3-1, AC-F6-1, NFR-3 | crash matrix, rebuild-fault injection | no |

## Decision Drivers

1. Zero dependency growth for a substrate that must stay portable.
2. Deterministic, in-process tests: every fault and every staleness decision is injectable.
3. Simple, reviewable formats a solo maintainer can verify by reading bytes.
4. A single durable truth (the ledger) with a disposable projection.

## Decision Rights (DACI)

- **Driver:** @pm; **accountable human decider:** Juliusz Ćwiąkalski; **contributor/performer:** @coder.
- **Required review:** delivery reviewer and readiness reviewer; human owner acceptance at PR review. **Informed:** later consumer stories.
- **Timing:** recorded before any driver task executes (GH-174 task 1.1). Implementation, tests, and an unmerged PR may proceed with acceptance pending; this record does not claim owner approval.
- **Acceptance:** no approval is claimed. Set `decision_date` only on human acceptance.

## Evidence, Assumptions & Unknowns

| Item | Label | Source | Impact if false / confidence |
|---|---|---|---|
| Node v24.11.1 loads `node:sqlite`, creates a table, inserts and reads a row; emits an `ExperimentalWarning`. | FACT | local probe (below) | If removed, Node support falls back to "unsupported per matrix"; high |
| Bun 1.4.4 loads `bun:sqlite` and also resolves `node:sqlite` (polyfill); both work. | FACT | local probe (below) | Binding preference order is safe either way; high |
| Node v24.11.1 cannot resolve `bun:sqlite` (`ERR_UNSUPPORTED_ESM_URL_SCHEME` / module not found). | FACT | local probe (below) | Runtime selection by successful require is unambiguous; high |
| `createRequire` resolves both bindings synchronously in both runtimes. | FACT | local probe (below) | Without sync require, index opening would need async plumbing; high |
| A 64-bit FNV-1a checksum over canonical payload JSON detects single-byte payload mutation. | ASSUMPTION (deterministic function) | design + torn fixture test | If a mutation collides, the fixture test would catch it; high |
| Windows ACL enforcement can be applied with `icacls` and verified from its output. | TO-CONFIRM | requires a Windows host (OQ-2) | The Windows half is platform-conditional and never claimed verified on Linux; medium |

### Technical-Selection Evidence Pack (archetype: selection)

Local-only evidence, 2026-10-30, artifact root `tmp/tmpdir/tdr-probe/` (repo-local scratch, not committed).

```
# node tmp/tmpdir/tdr-probe/node-sqlite.mjs
{"runtime":"node","version":"v24.11.1","results":{"nodeSqlite":{"value":"node-value"},
 "bunSqlite":{"error":"Error [ERR_UNSUPPORTED_ESM_URL_SCHEME]: Only URLs with a scheme in:
 file, data, and node are supported by the default ESM loader. Received protocol 'bun:'"}}}
(node:... ) ExperimentalWarning: SQLite is an experimental feature and might change at any time

# bun tmp/tmpdir/tdr-probe/bun-sqlite.ts
{"runtime":"bun","version":"1.4.4","results":{"bunSqlite":{"value":"bun-value"},
 "nodeSqlite":{"value":"node-under-bun"}}}

# node tmp/tmpdir/tdr-probe/require-probe.mjs
{"results":{"bunSqlite":"Error: Cannot find module 'bun:sqlite'","nodeSqlite":{"v":"ok"}}}

# bun tmp/tmpdir/tdr-probe/require-probe.mjs
{"results":{"bunSqlite":{"v":"ok"},"nodeSqlite":{"v":"ok"}}}
```

**Runtime support matrix (recorded, asserted by tests):**

| Runtime | Version probed | `bun:sqlite` | `node:sqlite` | Selected binding | `sqlite` driver |
|---|---|---|---|---|---|
| Bun | 1.4.4 | available | available | `bun:sqlite` | supported |
| Node | v24.11.1 | unavailable | available (experimental warning) | `node:sqlite` | supported |
| Any other runtime without either built-in | — | unavailable | unavailable | none | explicitly unsupported; `jsonl` unaffected |

The binding is acquired with `createRequire(import.meta.url)`: try `bun:sqlite`, then `node:sqlite`. A runtime where both fail is **declared unsupported for the `sqlite` kind only**; the `jsonl` kind (the correctness baseline) and the ledger format never depend on a binding.

## Mental Models & Techniques Used

- Single-writer/append-only log as the system of record; derived index as a cache with an explicit invalidation check.
- Fail-closed trust boundary: verify bytes, then assert keys, then return values.
- Inversion: every mechanism is judged by whether a test can make it fail deterministically in-process.

## Alternatives Considered

| Alternative | C-1 | C-2 | C-3 | C-4 | C-5 | Eligibility |
|---|---|---|---|---|---|---|
| ALT-0: JSONL only, no SQLite driver | pass | pass | pass | pass | pass | Eligible but fails the declared two-kind contract (GH-174 F-3) |
| ALT-1: JSONL truth + built-in SQLite bindings (selected) | pass | pass | pass | pass | pass | Eligible |
| ALT-2: third-party SQLite binding (e.g. `better-sqlite3`) | pass | fail | pass | pass | pass | Requires the fail-closed license gate and native-build risk; not needed |
| ALT-3: single-file SQLite truth with no JSONL ledger | pass | pass | designed-to-fail | pass | fail | Contradicts DEC-2 (ledger truth, index disposable) |

## Decision

- **Recommendation:** ALT-1. The following are the binding selections for delivery; the WHAT and ACs stay owned by the spec.
- **Human acceptance:** none claimed; record remains **Proposed** for owner PR review.

### 1. JSONL framing and checksum — refine GH-174 F-2, DM-2, DM-4

- One record per line: `{"schemaVersion":string,"kind":string,"key":string,"sequence":number,"checksum":string,"payload":<JSON>}`, terminated by a single `\n` (LF). The writer never rewrites an earlier byte; appends are `O_APPEND`-equivalent writes of whole lines.
- `sequence` is a contiguous, store-scoped 1-based integer assigned under the fence from the verified ledger tail.
- `checksum` is FNV-1a 64-bit over the UTF-8 bytes of `JSON.stringify(payload)`, rendered as 16 lowercase hex digits. Payloads are JSON-compatible values; key order is the writer's insertion order, and verification re-serializes the parsed payload the same way.
- Framing validation requires an object with exactly those six fields and the expected types; a non-parsing or malformed line is a framing break. JSONL depends on JSON's escaping, so embedded newlines are always escaped.
- The store header is a separate `header.<workspace>.json` file carrying `{"schemaVersion": ...}`, written before the first record. Readers fail `state.schema.mismatch` on an unsupported header or record version and never coerce.
- An absent ledger is verified-empty. A zero-byte ledger is verified-empty (no records observed); any present bytes that do not verify are torn, never empty.

### 2. Per-runtime SQLite binding and fallback — refine GH-174 D2, F-3, AC-F9-3

- Acquire the binding synchronously in the runtime edge with `createRequire`: try `bun:sqlite`, then `node:sqlite`. No dynamic import, no async open, no third-party dependency, no lockfile change.
- Matrix as recorded above. An unavailable binding makes only the `sqlite` kind unsupported (declared, asserted); it never silently degrades to the `jsonl` kind or to an in-memory fake.
- The index is a derived projection (`records(sequence INTEGER PRIMARY KEY, key TEXT, kind TEXT, checksum TEXT, payload TEXT)`); the ledger is always truth.

### 3. Fence/lock mechanics and staleness basis — refine GH-174 F-7, DEC-7

- Lock file `fence.<workspace>.lock`, created with exclusive-create semantics (`wx`) and mode 0600. Content: `{"namespace","token","acquiredAtMs"}`.
- Acquisition is a single exclusive create; `EEXIST` is contention. A second acquisition while the file exists fails `state.lock.busy` and lands nothing.
- Staleness is decided by the **injected** edge clock and an injected `staleFenceMs` (default 30 000): a lock whose `acquiredAtMs` is older than that is detectably stale. No wall clock is read in the state tier; the production edge supplies `Date.now`.
- Recovery is explicit (`recoverFence(token)`): it succeeds only for a stale lock, clears the stale lock (invalidating handles held by the old writer), and returns a recovery report; the recovering caller then acquires normally. A live lock is `state.lock.busy`; silent stealing is structurally impossible.
- A handle is stale when its store instance released it, or when the on-disk token no longer equals the handle's token. Writes through a stale handle fail `state.lock.busy`; reads never consult the fence.

### 4. Index rebuild policy and trigger — refine GH-174 F-3, AC-F3-1

- Every indexed read first verifies the ledger, then checks index agreement (row count and `(sequence,key,kind,checksum,payload)` tuple equality, so a payload-only divergence is detected and rebuilt rather than served).
- Missing, corrupt, or divergent index → delete and rebuild from the verified ledger in one transaction, then serve the read and report the rebuild in evidence. The ledger bytes are never touched.
- Rebuild storage-I/O failure → exactly `state.write.failed` (transient, retryable, `not_landed`), no values returned. No stale read is ever served, and no background/async rebuild exists.
- Rebuild is read-triggered only; writes keep the index current in the same fence.

### 5. Atomic-replace technique — refine GH-174 F-6, AC-F6-1

- The new content is written completely to a same-directory temporary (`<target>.tmp`), flushed (`fsync`), then swapped over the target with an atomic `rename`.
- Failure points: before temp creation, after temp write/flush before rename, rename throws, after rename before cleanup. Any failure reports `state.write.failed`/`not_landed`; the target remains the previous version because the rename never happened, or is the new version because it did.
- Stale `.tmp` files left by an interrupted replace are removed on the next store open and never read as content.
- Every replace is first an appended ledger record (`kind: "document"`, `key: "document:<name>"`) per DEC-8, so the target is rebuildable from verified truth.

### 6. Windows ACL mechanism — refine GH-174 F-8, AC-F8-2, OQ-2

- The platform branch is driven by an injected platform value on the runtime edge, never by an ambient probe in the state tier.
- On `win32` the edge applies, at creation, an ACL restricted to the current user (`icacls <path> /inheritance:r /grant:r <currentUser>:F`) and verifies it on open; a foreign grant or a failed application fails `state.permission.denied`. On POSIX the exact-bit 0700/0600 checks apply (mode set after creation so umask cannot widen it).
- Linux CI never claims Windows verification: TC-STATE-017 records the platform skip and the owner-environment dependency. The documented platform contract ships with `doc/spec/features/feature-state-layer.md`.

### Constraint Compliance Attestation

ALT-1 is designed to satisfy C-1..C-5 subject to tests: runtime APIs stay in the driver edge, no dependency is added, torn bytes are detected before reads, all clock/staleness inputs are injected, and failed writes/rebuilds report `not_landed`. C-2 needs no license action because the selection uses runtime built-ins only.

## Trade-offs & Consequences

### Positive Outcomes

- Zero dependency growth and a portable packed artifact; `jsonl` remains the correctness baseline on every runtime.
- The format is reviewable by reading bytes; every failure mode has a deterministic in-process test seam.

### Negative Outcomes

- FNV-1a is a corruption detector, not a cryptographic authenticator; it does not defend against deliberate forgery. The state layer's threat model is local corruption, not tampering.
- `node:sqlite` is still flagged experimental on Node 24; the matrix records that and the `jsonl` kind remains unaffected if it changes.

### Unresolved Questions

- Windows ACL verification on a real host remains owner-environment work (spec OQ-2); it is not claimed by any Linux run.
- Index schema evolution beyond rebuild-from-ledger is deferred to a future versioned change.

## Implementation Plan

1. Land the state vocabulary and error rows (GH-174 Phase 1), then the facade and JSONL ledger (Phase 2).
2. Add the SQLite driver and binary parity (Phase 3), then torn detection/repair (Phase 4), write discipline (Phase 5), permissions (Phase 6).
3. Document the delivered matrix in the state feature doc (Phase 7) and present this record at PR review; do not merge.

## Verification Criteria

- TDR-recorded matrix asserted by `tests/behaviour/state-index.test.ts` and `tests/checks/packed-state.test.ts`; an undeclared skip fails.
- Framing/checksum selections proven by `tests/behaviour/state-ledger.test.ts` (independent checksum verification) and the torn matrix.
- Fence staleness proven with an injected clock only (`tests/behaviour/state-fence.test.ts`); no real time read.
- Rebuild failure proven to be exactly `state.write.failed` (`tests/behaviour/state-index.test.ts`).
- Atomic replace proven across the full injection matrix (`tests/behaviour/state-atomic-replace.test.ts`).
- Windows contract documented and statically asserted; POSIX matrix green on Linux (`tests/behaviour/state-permissions.test.ts`).

## Confidence Rating

**Medium–high.** Binding availability and synchronous acquisition are locally proven on both supported runtimes; the Windows ACL half is designed but unverified on this host.

## Amendments

| Date | Change | Reason |
|---|---|---|
| 2026-10-30 | §3 recovery clears the stale lock (the recovering caller then acquires normally); §4 index agreement includes the payload tuple field. | GH-174 Phase 9 review findings F-1/F-5: align the recorded selection with AC-F3-1 (returned values equal ledger truth) and with the shipped `recoverFence` behaviour. |

## References

- [GH-174 specification](../changes/2026-10/2026-10-30--GH-174--state-layer/chg-GH-174-spec.md) §8.3/§8.4/OQ-1/OQ-2.
- [GH-174 test plan](../changes/2026-10/2026-10-30--GH-174--state-layer/chg-GH-174-test-plan.md) §4.1–4.6.
- [ADR-0003](ADR-0003-oss-monorepo-structure.md) — tier matrix and runtime-API confinement.
- [TDR-0003](TDR-0003-config-parser-schema-and-acquisition.md) — Proposed-TDR-during-delivery precedent.
- Local probes: `node:sqlite`, `bun:sqlite`, and `createRequire` on Node v24.11.1 / Bun 1.4.4 (output quoted above).
