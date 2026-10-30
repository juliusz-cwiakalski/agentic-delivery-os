---
change:
  ref: GH-174
  type: feat
  status: Proposed
  slug: state-layer
  title: "M0-S5: State layer"
  owners: [engineering]
  service: delivery-os state layer
  labels: [change, planning]
  version_impact: minor
  audience: mixed
  security_impact: medium
  risk_level: medium
  dependencies:
    internal: [monorepo scaffold and toolchain, branding seam, result contract and error table]
    external: []
links:
  decisions: [ADR-0003]
---

# CHANGE SPECIFICATION

> **PURPOSE**: Deliver durable local state with torn-state detection so every later verification reads truth, never zeros — behind one implementation-neutral port that keeps the storage engine swappable, enforces single-writer and atomicity discipline, and classifies every expected failure through the existing result contract.

## 1. SUMMARY

This change delivers the M0-S5 state layer: the durable local state substrate every later M0 story consumes. An append-only, schema-versioned JSONL ledger is the durable truth; SQLite-backed indexes are derived projections over the same ledger, selected through the scaffold-declared `StateDriverKind` (`"jsonl" | "sqlite"`) behind one driver-neutral store port. Torn state — truncation, framing breaks, sequence discontinuities, checksum mismatches, index/ledger divergence — is detected, classified, and reported on every read; it is never silently read as zeros. Writes are single-writer (fence lock tokens), atomic (write-rename replace; append through the ledger), key-set asserted on read, permission-enforced (POSIX 0700/0600 with a Windows ACL equivalent), and retained forever.

State failure identity joins the result contract as a new `state` domain kind with seven dedicated codes, following the config-layer classification precedent (exact-code classification for a multi-row kind; two-directional doc/code sync binding). No CLI command ships (foundation story per the command registry); the state tier reads no configuration — store identity, paths, and the brand-derived state directory name all arrive as injected parameters. The port surface is defined for the later consumers (M0-S6 status, M0-S8 verify change, M0-S10 lint/phase); this change ships no callers beyond tests.

The storage-engine mechanics that involve genuine selection — JSONL framing and checksum, the per-runtime SQLite binding, fence/lock mechanics, index rebuild policy, atomic-replace technique, and the Windows ACL mechanism — are specified here as testable contracts and flagged as a **TDR candidate**: the WHAT and the acceptance criteria are fixed by this specification; the implementing `@coder` records the selection decision during delivery, in the manner of TDR-0003 (GH-173).

## 2. CONTEXT

### 2.1 Current State Snapshot

- M0-S1 (GH-170), M0-S2 (GH-171), M0-S3 (GH-172), and M0-S4 (GH-173, PR #194) are merged to `main-tools`. The six-package workspace, tier matrices, ambient guards, negative-fixture discipline, forbidden-literal scan, `CommandResult` envelope, error table, `{0, 1, 2}` exit projection, and the layered configuration layer are all in place and gated.
- The `core` `./state` subpath exists as a types-only placeholder declaring `StateDriverKind = "jsonl" | "sqlite"`. No store port, driver, ledger format, or state failure identity exists yet.
- The scaffold boundary rules reserve runtime-API use for exactly the `core` `./state` driver code (besides the adapter I/O subpaths and surfaces); the `state` tier imports `./contracts` only; `adapters` may not import `core` `./state`; surfaces (`cli`, `mcp`, `opencode`) may. Every forbidden rule carries a registered failing fixture.
- The branding seam provides `BrandIdentity.stateDirectoryName` (config directory name plus `-state`) and pre-documents M0-S5 as its consumer; the state tier may not import branding.
- The error table (`core` `./contracts`) declares `DOMAIN_KINDS = ["provider", "input", "config"]`, two fallback containment entries, one singleton row each for provider and input, and nine config rows; classification for a multi-row kind requires the exact code (config precedent), and the two-directional error-table sync check is binding in CI.
- No external consumers of the workspace packages exist; the first state consumers arrive with M0-S6 (status reads park states), M0-S8 (verify change reads the phase ledger), and M0-S10 (phase transitions as the only ledger write path, with registry lint).

### 2.2 Pain Points / Gaps

- Nothing persists delivery truth yet: later verifications (phase ledger, park states, registries) would have nothing trustworthy to read and would degrade to zero-values that look like facts.
- Without torn-state detection, a crashed or corrupted store would be silently read as empty — the exact "silently read as zeros" failure class the ticket forbids, and the class that turns verification into false success.
- Without a single-writer discipline, concurrent agents could interleave writes and corrupt a shared local store without any classification of the contention.
- Without atomic replace, a crash mid-write would leave partially written documents that downstream reads mistake for current truth.
- Without an implementation-neutral port, the first persistence consumer would hardcode a storage engine, and every later story would inherit that lock-in.

## 3. PROBLEM STATEMENT

Because the workspace has no durable state substrate, no failure identity for persistence, and no integrity discipline, every later verification would read either nothing or unverified bytes — torn or corrupted local state would silently present as empty or stale truth, concurrent writers could corrupt shared local stores, partially written documents would masquerade as landed mutations, and the first storage engine choice would hardcode itself into every consumer call site.

## 4. GOALS

- **G-1**: One implementation-neutral state port: consumers open a store, append records, read with key-set assertions, atomically replace derived documents, and manage fences without any driver-dependent call site.
- **G-2**: Durable truth: an append-only, schema-versioned JSONL ledger is the single durable truth; every mutation is first a ledger record; derived documents and indexes are rebuildable projections.
- **G-3**: Torn state is never silent: reads verify integrity (framing, truncation, sequence, checksum, index divergence) and fail classified on any tear; a genuinely absent store is explicitly evidenced as verified-empty, never conflated with a torn one.
- **G-4**: Write discipline: single-writer through fence lock tokens, atomic replace for derived documents, failed writes honestly reported as not-landed.
- **G-5**: Failure identity: state failures classify through a new `state` domain kind in the error table with dedicated codes, documented rows, and the binding two-directional sync.
- **G-6**: Least-privilege local storage: POSIX 0700/0600 at creation and enforced on open, with a Windows ACL equivalent behind the same port; permission violations fail closed.
- **G-7**: Generalization without implementation: the port declares planned levels (local, project/shared, maybe global) and carries workspace and fence identifiers as local fields, so shared state later does not redesign consumers; only `local` is implemented now.
- **G-8**: Boundary and branding conformance: runtime APIs confined to the state driver code, no branding import in the state tier, injected `stateDirectoryName`, zero product literals, no configuration reads, no CLI command.

### 4.1 Success Metrics / KPIs

| Metric | Target |
|--------|--------|
| Injected torn fixture classes detected and classified on read | 5/5 (truncated tail, framing break, sequence discontinuity, checksum mismatch, index/ledger divergence) |
| Reads returning record values from unverified bytes | 0 |
| Torn or assertion-failing reads surfaced as empty/zero defaults | 0 |
| Implementation-dependent call sites outside the state tier | 0 |
| Conformance cases passing with identical driver-neutral observable results on both declared driver kinds | 100% |
| Crash-injection points during atomic replace that leave partial target content | 0 |
| Concurrent double-writes landing / silent fence steals | 0 / 0 |
| State codes round-tripping exactly with documented table rows | 7/7 (binding sync, both directions) |
| Store creations applying required permissions (POSIX matrix) | 100% |
| Unclassified expected state failures | 0 (wrong/missing/mismatched codes contain via `fallback.internal`) |

### 4.2 Non-Goals

- **NG-1**: A CLI command or any other surface work — M0-S5 is a foundation story; no `ados state` command (that is M1-S2), no configuration reads, and no consumers beyond tests (M0-S6/S8/S10 arrive later).
- **NG-2**: Shared or networked state: no project (shared) or global level implementation, no network transport, no cloud anything (ADR-0003 C-4); shared levels stay abstraction-only.
- **NG-3**: Retention or pruning logic — retention starts at forever; the only destructive operation is the explicit, reported torn-tail repair. No pruning, compaction, or expiry.
- **NG-4**: Domain record schemas for consumers (pm-notes schema, delivery registry shape, park states) — consumers define their own record kinds; this change fixes the container contract only.
- **NG-5**: Session-database admin (M0-S11), state migration tooling, backup/restore (M3-S6), or telemetry emission (reserved schema names untouched).
- **NG-6**: Any naming decision or change to the branding seam contract; `stateDirectoryName` is consumed, not altered.
- **NG-7**: Changes to the bash stack, existing gates, `.opencode/`, or `.ados-claude/`; weakening any boundary rule.

## 5. FUNCTIONAL CAPABILITIES

| ID | Capability | Rationale |
|----|------------|-----------|
| F-1 | Driver-neutral state port and injected store identity | Ticket AC: the abstraction has no implementation-dependent call sites; branding and paths stay injected parameters. |
| F-2 | Append-only, schema-versioned JSONL ledger as durable truth | Ticket: append-only JSONL, schema-versioned, retention forever. |
| F-3 | Swappable index driver (SQLite derived index; ledger-scan alternative) | Ticket: SQLite indexes; the abstraction keeps the storage engine swappable. |
| F-4 | Torn-state detection, evidence, and bounded repair | Ticket AC: torn state is detected and reported, never silently read as zeros. |
| F-5 | Key-set assertions on read | Ticket: key-set assertions; missing keys are failures, never defaults. |
| F-6 | Atomic replace of derived documents | Ticket: atomic replace; a crash never leaves partial truth. |
| F-7 | Single-writer fence with lock tokens | Ticket: single-writer; fence identifiers scoped as local fields. |
| F-8 | Permission enforcement (POSIX 0700/0600 + Windows ACL equivalent) | Ticket: least-privilege local state on both platform families. |
| F-9 | Classified state failures in the result contract | GH-172/GH-173 precedent: persistence failures are classifiable data, not folklore. |
| F-10 | Boundary, branding, and scope conformance | Scaffold tier rules, naming firewall, foundation-story discipline. |

### 5.1 Capability Details

- **F-1**: The store port is declared in `core` `./contracts` (types and data only) and materialized by the driver-neutral facade in `core` `./state`. A store is opened from an injected identity: the state level, a caller-supplied workspace identifier, a fence namespace, the schema version, and concrete paths — including the state directory derived from the injected `stateDirectoryName` brand parameter by the calling edge. The state tier never imports branding, never reads configuration, and never derives a name. The port declares the planned levels (`local`, `project`, `global`) and carries workspace and fence identifiers as ordinary local fields; only `local` is implemented, and requesting an unimplemented level fails classified rather than silently substituting local storage. No operation, type, or result on the public port discriminates by driver kind.
- **F-2**: The ledger is append-only: records are added in order and never rewritten in place. Every record carries the state schema version, a consumer-declared record kind, a store-scoped record key, a contiguous store-scoped sequence number, and a checksum over the payload; payloads are JSON-compatible values. Every mutation — including derived-document upserts — is first a ledger record, so crash recovery can always rebuild derived state from verified ledger truth. Retention is forever: the port exposes no prune, delete, or expiry operation.
- **F-3**: `StateDriverKind` selects the read/index strategy over the same ledger: the `jsonl` kind reads by verified ledger scan; the `sqlite` kind maintains derived SQLite indexes over the same ledger for bounded reads. Both kinds implement one conformance suite with identical results over the driver-neutral observable fields (values, key-set results, error identities and codes, torn-state verdicts) given the same ledger, which is what makes the engine swappable and proves call-site neutrality; driver-specific diagnostic evidence — the SQLite index-rebuild report foremost — is asserted separately for the indexed kind, not compared as parity. The SQLite index is disposable: index/ledger divergence is detected, resolved by rebuild from the verified ledger, and reported in the read evidence; a failed rebuild fails classified — `state.write.failed` for a storage I/O failure during rebuild (transient, retryable, `not_landed`) — never a silent stale read. The ledger itself never depends on the index.
- **F-4**: Reads verify integrity before any value is returned: ledger framing (every record parses per the ledger framing), terminal completeness (no truncated tail record), sequence continuity (no gap, duplicate, or reset), checksum agreement (payload matches its recorded checksum), and, for the indexed kind, index/ledger agreement. Any tear fails the read with `state.store.torn` carrying a safe location (store path and record position, never payload content). An absent store at an initialized directory is valid verified-empty evidence, explicitly distinguishable from torn. One explicit, reported repair operation exists for the torn-tail case (terminal truncation only): it removes the incomplete tail, reports the repair, and leaves the remaining records intact; mid-record corruption is never auto-repaired and remains classified.
- **F-5**: Reads declare a required key set; after integrity verification, any missing declared key fails the read with `state.keys.missing` naming the missing keys. Present keys return their recorded values exactly. No read substitutes empty collections, zeros, or defaults for missing keys — the "never silently read as zeros" guarantee at the logical level, on top of the physical tear detection of F-4.
- **F-6**: Derived documents are replaced atomically: the new content is fully written to a same-directory temporary file and swapped over the target by an atomic rename, so any crash or failure leaves either the previous or the new version — never partial content. A failed replace is reported with consequence `not_landed`. Stale temporary files from interrupted replaces are cleaned or reported on the next store open, never read as content.
- **F-7**: Writes (appends and replaces) require a fence acquired from the store: acquisition binds a caller-supplied fence token (the single-writer lock token, a local field of the store identity for later shared-state generalization). A second acquisition while a live fence holds the store fails `state.lock.busy` (transient, retryable). The port shapes write operations so they cannot be invoked without the acquired fence handle; operations through a stale handle (fence since released, recovered, or lost) fail `state.lock.busy`. Reads never require the fence. Recovery of a stale fence — for example after a writer crashed between landing a record and releasing — is an explicit, reported operation; silent stealing is forbidden. Reads stay available while a fence is held.
- **F-8**: On creation, the state directory is created with POSIX mode 0700 and store files with mode 0600; on open, the enforcement is verified and a violation fails closed with `state.permission.denied` rather than operating permissively. On Windows, an ACL equivalent restricts access to the current user, delivered behind the same port and documented as the platform contract. Permission application never widens access to compensate for a hostile environment.
- **F-9**: The error table gains the `state` domain kind and seven dedicated codes (Section 8.3): torn store, schema mismatch, missing key set, lock contention, permission denial, failed write (append, atomic replace, or index rebuild), unsupported level. All state rows classify by exact code under the multi-row-kind rule (kind-only `state` lookup is ambiguous, never first-row); wrong, missing, or mismatched state codes contain through `fallback.internal`. All write-path failures carry consequence `not_landed` — the append-only ledger and atomic replace make that assertion truthful. The documented table rows ship in-change and the two-directional sync check remains binding.
- **F-10**: The `state` tier imports `./contracts` only; runtime APIs (filesystem, SQLite bindings) appear only in the `core` `./state` driver code; `adapters` may not import `core` `./state`; surfaces may; any new forbidden boundary rule ships with a failing negative fixture in the same change. Zero product-token literals (the live forbidden-literal scan is binding; the new state feature doc is registered in the scan registry in the same change). No CLI command, no configuration read, no ambient environment, clock, or randomness read outside the driver code's injected edges.

## 6. USER & SYSTEM FLOWS

1. **Write flow**: A consumer edge assembles the injected store identity (level `local`, workspace and fence namespace identifiers, paths from the injected brand-derived state directory name) → opens the store → acquires a fence with its token → appends a schema-versioned record (or upserts a derived document, recorded first as a ledger record, then swapped atomically) → releases the fence. Any failure lands as a classified `state.*` result with consequence `not_landed`; no partial state is observable.
2. **Read flow**: A consumer opens the store read-only → integrity verification runs (framing, truncation, sequence, checksum; index divergence check and reported rebuild for the indexed kind) → the declared key set is asserted → records return with integrity evidence. A tear fails `state.store.torn` with a safe location; a missing key fails `state.keys.missing`; an absent store returns explicit verified-empty evidence.
3. **Contention flow**: A second writer attempts acquisition while a live fence holds the store → `state.lock.busy` (transient, retryable) → the writer waits and retries after release; no double write lands.
4. **Stale-fence recovery flow**: A writer crashed after landing a record but before releasing the fence → the next writer finds the fence detectably stale → reads still succeed → writes fail classified until explicit recovery → recovery is performed and reported; nothing is silently stolen.
5. **Torn-tail repair flow**: An operator or consumer invokes explicit repair on a torn ledger → verification confirms the damage is terminal truncation only → the incomplete tail is removed, the repair is reported → the ledger verifies and remaining records are intact. Mid-record corruption refuses repair and stays classified.
6. **Version mismatch flow**: A store or record declares an unsupported schema version → the read fails `state.schema.mismatch` with no payload values returned; no coercion, no best-effort interpretation.

## 7. SCOPE & BOUNDARIES

**Binding constraints on everything in scope:** (a) the state tier imports `./contracts` only, with runtime APIs confined to the `core` `./state` driver code; (b) zero branding imports — the state directory name arrives as an injected parameter; (c) torn state never reads as zeros; (d) no implementation-dependent call sites on the public port; (e) every new forbidden boundary rule ships with a failing negative fixture; (f) no gate weakened, no product literal committed.

### 7.1 In Scope

- The state port and vocabulary in `core` `./contracts`: store identity, record envelope, key-set declaration, fence handle, level enum, state schema version constant, and the state error-table rows (F-1, F-9).
- The driver-neutral store facade and both declared driver kinds (`jsonl` ledger scan, `sqlite` derived index) in `core` `./state`, replacing the types-only placeholder's emptiness with the implemented subpath (F-1..F-3).
- Torn-state detection classes, verified-empty evidence, and the bounded torn-tail repair operation (F-4).
- Key-set assertions on read with no-default substitution (F-5).
- Atomic replace of derived documents with crash-safety and stale-temporary handling (F-6).
- Fence acquisition, contention classification, staleness, and explicit reported recovery (F-7).
- Permission application and enforcement for POSIX 0700/0600 and the Windows ACL equivalent (F-8).
- Error-table integration: the new `state` domain kind, seven codes, documented rows in-change, binding two-directional sync, containment behavior (F-9).
- The one conformance suite exercised identically against both driver kinds, torn-fixture negative controls, crash-injection atomicity tests, contention tests, permission matrix tests, and boundary/structure tests (F-1..F-10).
- `doc/spec/features/feature-state-layer.md` authored during delivery as part of this change (registered in the forbidden-literals registry in the same change); documented state error rows extended in the result-contract feature doc in the same change.

### 7.2 Out of Scope

- [OUT] Any CLI command, MCP tool, or opencode surface; any configuration read or layer coupling; any consumer of the port beyond tests (M0-S6/S8/S10 own adoption).
- [OUT] Project (shared) and global level implementations, network transport, multi-host coordination, or cloud anything.
- [OUT] Retention, pruning, compaction, or expiry beyond the explicit torn-tail repair; backup/restore and migration tooling (M3-S6).
- [OUT] Domain record schemas (pm-notes, delivery registry, park states) and their lint — M0-S10.
- [OUT] Session-database admin (M0-S11), telemetry emission, or any use of the reserved schema names beyond leaving them untouched.
- [OUT] Changes to the branding seam contract, the bash stack, or any existing gate.

### 7.3 Deferred / Maybe-Later

- Project (shared) and global level drivers once a shared-storage story exists; the port's level enum, workspace identifier, and fence token fields are the prepared seams.
- Networked or multi-host fence leases (the parked parallel-delivery concept): the fence token as a local field generalizes; lease negotiation, quorum, and liveness are later concerns.
- Ledger compaction or archival if forever-retention growth ever demands it; index schema evolution beyond rebuild-from-ledger.
- Additional driver kinds beyond the two declared, via the same conformance suite.

## 8. INTERFACES & INTEGRATION CONTRACTS

### 8.1 REST / HTTP Endpoints

None. The state layer is an in-process library surface; no network listener, endpoint, or transport exists in this change.

### 8.2 Events / Messages

None. Read/write evidence (integrity verdicts, rebuild and repair reports, verified-empty markers) is invocation-scoped result data, not persisted events and not telemetry. The reserved brand-neutral schema names (`delivery.event.v1`, `delivery.metric.v1`) are untouched; no emission path exists.

### 8.3 Data Model Impact

| ID | Element | Contract |
|----|---------|----------|
| DM-1 | Store identity | Injected, never derived: state level (`local` implemented; `project`/`global` declared), caller-supplied workspace identifier, fence namespace, state schema version, and concrete paths including the state directory the calling edge derives from the injected `stateDirectoryName` brand parameter. Identical inputs yield identical identity; the state tier performs no branding import and no configuration read. |
| DM-2 | State record | The ledger's schema-versioned envelope: state schema version, consumer-declared record kind, store-scoped record key, contiguous store-scoped sequence number, checksum over the payload, and a JSON-compatible payload. Records are append-only; every mutation is first a record. |
| DM-3 | Store port | The driver-neutral surface in `core` `./contracts` (types/data) materialized in `core` `./state` (facade + drivers): open, append, read with key-set assertion, atomic document replace, fence acquire/release/recover, integrity check, explicit torn-tail repair. No operation or type on the port discriminates by driver kind; `StateDriverKind` selects the index/read strategy only. |
| DM-4 | State schema version | Brand-neutral stable constant in the reserved lineage (`delivery.state.v1` at v1), carried by every record and the store; readers fail `state.schema.mismatch` on unsupported versions; changes only on a breaking store-format change. |
| DM-5 | Read/integrity evidence | Explicit per-read verdict: verification classes performed, verified-empty marker for an absent store, index rebuild report when one occurred, repair report when repair ran. Evidence names paths and record positions, never payload content; evidence distinguishes verified-empty from torn. |

**Key-set assertion semantics**: a read declares the record keys it requires; after integrity verification succeeds, an absent declared key fails the read (`state.keys.missing`, naming the missing keys) instead of returning a default. Present keys return their recorded values exactly. Assertions are per-read caller declarations — the store never invents required key sets, and consumers declare their own.

**Torn-state detection classes** (each independently testable; see Appendix A): framing break, truncated tail, sequence discontinuity, checksum mismatch, and — for the indexed kind — index/ledger divergence. Detection always precedes value return; any detected class fails the read.

**State error-table extension**: all rows below are domain kind `state`; the `state` kind is multi-row, so classification requires the exact code (kind-only lookup is ambiguous and never selects a first row — the config precedent). Category assignment: caller/environment-correctable failures are `user`; data-integrity failures are `platform`; naturally recurring contention and retryable storage failures are `transient`. Every write-path failure carries consequence `not_landed`, made truthful by the append-only ledger and atomic replace. These exact rows must be present in the result contract's documented table and its machine table in this change; both-direction sync remains binding.

| Code | Trigger | Category | Retryable | Consequence | Projection class | Remediation hint | Summary |
|------|---------|----------|-----------|-------------|------------------|------------------|---------|
| state.store.torn | Integrity verification detects a tear: framing break, truncated tail, sequence discontinuity, checksum mismatch, or unresolved index/ledger divergence | platform | false | not_landed | platform-provider | Inspect or restore the named state store; never treat it as empty. | The state store is torn. |
| state.schema.mismatch | Store or record declares an unsupported state schema version | platform | false | not_landed | platform-provider | Use a compatible tool version or migrate the store explicitly, then retry. | The state store schema version is not supported. |
| state.keys.missing | A read's declared key set is absent from a verified ledger | platform | false | not_landed | platform-provider | Verify the writing operation completed and inspect the named store; never substitute defaults. | A state read key-set assertion failed. |
| state.lock.busy | A write fence is contended, or an operation uses a fence handle that no longer holds the store | transient | true | not_landed | platform-provider | Wait for the current writer to release the state fence, then acquire and retry. | The state store is locked by another writer. |
| state.permission.denied | Required 0700/0600 or Windows ACL-equivalent access is absent or cannot be applied | user | false | not_landed | user-validation | Correct operating-system permissions on the named state path and retry. | A state path permission requirement was not met. |
| state.write.failed | An append or atomic replace fails before landing, or an index rebuild fails on storage I/O | transient | true | not_landed | platform-provider | Resolve the underlying storage error and retry; the failed write or rebuild did not land, the ledger remains durable truth, and the index stays disposable. | A state write or index rebuild did not land. |
| state.level.unsupported | A store is requested at a level with no implemented driver (`project`, `global`) | user | false | not_landed | user-validation | Use a state level with an implemented driver; shared levels arrive with later stories. | The requested state level has no implementation. |

The classification discriminator is `(kind, code)`: all seven codes round-trip exactly with `kind=state`, and each code's domain prefix remains `state`. Adding `state` to `DOMAIN_KINDS` is additive; the existing singleton kinds (`provider`, `input`) keep kind-only classification, `config` keeps exact-code classification, and a kind-only multi-row lookup (now `config` and `state`) is ambiguous. Missing, unknown, or wrong-kind state codes in thrown or returned failures contain through `fallback.internal`. No record payload content, checksum bytes, path-external environment data, or untrusted summary enters an error: safe locations name the store path and record position only. Exit projection stays `{0, 1, 2}` with user rows at 1 and platform/transient rows at 2.

### 8.4 External Integrations

No vendor API and no network surface. The SQLite index uses a runtime-provided binding; the selection between the available runtime built-ins (and the fallback strategy for runtimes without one) is the headline **TDR candidate** of this change, alongside: JSONL framing and checksum specification, fence/lock mechanics and staleness detection, index rebuild policy and trigger, atomic-replace technique details (temporary naming, cleanup, durability points), and the Windows ACL mechanism. This specification fixes the WHAT and the testable contracts above; the `@coder` records the selection and its evidence in a TDR during delivery (the TDR-0003 pattern from GH-173), leaving Proposed status for owner review at PR. If delivery planning discovers a required third-party dependency rather than a runtime built-in, the fail-closed license-registry gate applies in the same change. If a binding cannot satisfy the conformance suite on a supported runtime, that is a recorded TDR constraint, not a silently weakened AC.

### 8.5 Backward Compatibility

Fully additive. The placeholder `StateDriverKind = "jsonl" | "sqlite"` gains its real meaning without renaming; no existing type is reshaped. Adding `state` to `DOMAIN_KINDS` extends the declared kind set without altering existing rows, classification behavior for `provider`/`input`/`config`, the envelope, or the `{0, 1, 2}` projection. No external consumers of the workspace packages exist; nothing to deprecate. No persisted state exists yet, so there is no on-disk compatibility surface — the schema version constant is present from day one so future breaking store-format changes have a versioning channel. Adding a new state code requires its documented table row in the same delivery (binding sync, both directions).

## 9. NON-FUNCTIONAL REQUIREMENTS (NFRs)

| ID | Requirement | Threshold |
|----|-------------|-----------|
| NFR-1 | Driver neutrality: implementation-dependent call sites outside the state tier; public port types or operations discriminating by driver kind; conformance divergence between the two declared kinds given the same ledger | 0 / 0 / 0 — 100% of conformance cases pass identically on driver-neutral observable fields on both kinds (driver-specific diagnostic evidence is excluded from parity and asserted separately) |
| NFR-2 | Torn-state detection: injected torn fixtures (each class of Appendix A) detected and classified; reads returning values from unverified bytes; torn or assertion-failing reads surfaced as empty/zero defaults | 5/5 classes; 0 unverified-value reads; 0 silent-zero reads |
| NFR-3 | Atomicity: crash-injection points during atomic replace leaving partial target content; failed writes reported with consequence other than `not_landed` | 0 partial states; 100% of write failures report `not_landed` |
| NFR-4 | Single-writer: concurrent double-writes landing; silent fence steals; contention cases classified as `state.lock.busy` | 0 / 0 / 100% |
| NFR-5 | Permissions: creations applying the required POSIX matrix (0700 directory, 0600 files); permission violations proceeding permissively; Windows ACL equivalent delivered behind the same port | 100% applied; 0 permissive continuations; ACL contract delivered and platform-conditionally tested |
| NFR-6 | Error alignment: state codes round-tripping exactly with documented rows; two-directional sync drift; wrong/missing/mismatched state codes contained; kind-only `state` classification selecting a row | 7/7; 0 drift; 100% contained; 0 ambiguous selections |
| NFR-7 | Boundaries and branding: state-tier imports outside `./contracts`; runtime APIs outside the state driver code; branding imports or product literals; new forbidden rules without failing fixtures | 0 / 0 / 0 / 0 — all boundary, ambient, and literal gates green |
| NFR-8 | Schema versioning: records and stores carrying the state schema version; unsupported-version fixtures failing `state.schema.mismatch`; version absent from any store artifact | 100% / 100% / 0 |
| NFR-9 | Runtime and regression safety: Node and Bun consumption of the packed `core` `./state` surface; regressions in existing gates, bash jobs, or the aggregate check; behaviour and contract suites requiring a spawned process or real ambient environment — behaviour suites run in-process by rule, with exactly one documented exception class: the packed-consumer probe of AC-F9-3, which is a packaging assertion, not a behaviour test | Pass on both runtimes / 0 regressions / 0 such tests outside the single documented AC-F9-3 probe exception |

## 10. TELEMETRY & OBSERVABILITY REQUIREMENTS

No product telemetry is emitted; the reserved schema names stay untouched (NG-5). Observability comes from three places: (1) the existing `CommandResult` envelope with `runId` and `timing` wraps any future surface that exposes state operations; (2) read/write evidence (DM-5) makes integrity verdicts, index rebuilds, repairs, and verified-empty states explicit per invocation — nothing degrades silently; (3) state failure identity is the error-table code, so classified failures are actionable data for agents. The store's own files are the durable record; this change adds no event log, metric, or external sink.

## 11. RISKS & MITIGATIONS

| ID | Risk | Impact | Probability | Mitigation | Residual Risk |
|----|------|--------|-------------|------------|---------------|
| RSK-1 | SQLite binding selection diverges across runtimes (built-in availability, API shape, packaging) and breaks the indexed kind or packed-artifact portability | H | M | Fix the driver-neutral port and conformance suite first; make the binding a TDR candidate with Node/Bun packed-import gates; the ledger-scan kind remains the correctness baseline either way. | M until the TDR is recorded and portability gates pass |
| RSK-2 | A corruption shape outside the tested classes escapes detection and is read as truth (the exact ticket-forbidden failure) | H | M | Exhaustive per-class fixtures plus mutation tests over the verification logic; negative controls must assert detection, not pass silently; evidence verdicts make every read's verification explicit. | L–M |
| RSK-3 | Windows ACL enforcement diverges from the POSIX semantics or cannot be verified in a Linux CI matrix | M | M | Specify one platform-neutral enforcement contract behind the port; platform-conditional tests; record the CI-platform limit honestly and gate public-release verification on a Windows run (OQ-2). | M until a Windows verification run exists |
| RSK-4 | Crash windows around fence release leave stale locks that block writers or invite silent stealing | M | M | Stale fences are detectably stale; reads stay available; writes fail classified; recovery is explicit and reported; crash-injection tests cover the write-then-crash window. | L |
| RSK-5 | State error rows or the new domain kind drift from documented tables, or kind-only classification silently selects a first row | H | L | Same-change documented rows; binding two-directional sync; multi-row-kind ambiguity asserted for `state` exactly as for `config`. | L |
| RSK-6 | The port shape is wrong and cascades — M0-S6/S8/S10 and M1 consumers all build on it | H | M | Consumers were studied for the surface definition; the DoR gate (phase 5) reviews spec + test plan + plan against the ticket before delivery; the schema version constant gives a breaking-change channel from day one. | Medium |
| RSK-7 | Forever retention grows the ledger until scan-based reads degrade | M | L | The indexed kind exists precisely for bounded reads; append-time checksums avoid full rescans on write; scan-kind semantics documented; compaction deferred deliberately (7.3). | L |

## 12. ASSUMPTIONS

- M0-S1/S2/S3 dependencies are merged and green, and M0-S4 (GH-173) merged before this change started; the scaffold gates, branding seam, envelope, error table, and classification precedent are active as described.
- The scaffold's declared `StateDriverKind` values (`jsonl`, `sqlite`) reflect the intended design (append-only JSONL plus SQLite indexes) and are not reopened here; the ledger-truth/index-derived interpretation (DEC-2) reconciles the placeholder with the ticket wording.
- Record payloads are JSON-compatible values; consumers (M0-S10 onward) own their domain schemas and their lint — the state layer validates container-level invariants only.
- CI runs Linux, so POSIX permission and integrity matrices are CI-provable; Windows ACL verification has an owner-environment dependency recorded as OQ-2.
- No third-party dependency is required for the ledger format; if the SQLite path requires one, the license-registry gate applies in the same change.
- The first consumers arrive after this change, so port refinement is still cheap; the DoR gate is the last cheap checkpoint.

## 13. DEPENDENCIES

| Direction | Item | Notes |
|-----------|------|-------|
| Depends on | M0-S1 scaffold (GH-170, merged) | `core` `./state` subpath, tier matrices, runtime-API confinement, negative-fixture harness, aggregate check. |
| Depends on | M0-S2 branding seam (GH-171, merged) | `stateDirectoryName` as an injected parameter; the forbidden-literal scan binding on every artifact. |
| Depends on | M0-S3 result contract (GH-172, merged) | Envelope, error table, classification chain, containment, `{0, 1, 2}` projection, sync check. |
| Depends on | M0-S4 config layer (GH-173, merged) | Precedent for exact-code classification of a multi-row kind and the in-change documented-table/TDR pattern. |
| Blocks | M0-S6 status (GH-175) | Reads park states through this port. |
| Blocks | M0-S8 verify change (GH-177) | Reads the phase ledger with key-set assertions. |
| Blocks | M0-S10 lint/phase (GH-179) | Phase transitions are the only ledger write path; write-time lint builds on the container contract. |
| Blocks | M1-S1 watchdog, M1-S2 state validation, M1-S8 retro evidence, M1-S12 change capsules | Later consumers of the ledger/evidence model; `events.jsonl` capsule pattern builds on the append-only ledger. |

## 14. OPEN QUESTIONS

No blocker to test planning, branch delivery, or opening an unmerged PR. Test-planning findings OQ-T1, OQ-T2, and OQ-T6 (chg-GH-174-test-plan.md §8.3) are resolved canonically in this specification, iteration 2: the NFR-9 packed-probe exception (AC-F9-3), the AC-F1-2 driver-neutral parity definition, and the AC-F3-1 pinned `state.write.failed` rebuild classification; no open question remains against them.

- **OQ-1 (TDR candidate, recorded during delivery):** The storage-engine selections flagged in 8.4 — JSONL framing/checksum details, per-runtime SQLite binding and fallback strategy, fence/lock mechanics and staleness basis, index rebuild policy and trigger, atomic-replace technique details, Windows ACL mechanism. The `@coder` records the selection with evidence in a TDR during delivery (TDR-0003 pattern); Proposed status and human acceptance remain owner PR-review gates, not delivery blockers. Decision needed: consult `@decision-advisor` if a discovered constraint conflicts with any contract in Section 8.
- **OQ-2 (resolved to a documented limitation; cross-referenced with the test plan GAP-1/OQ-T3):** The Windows ACL half of the permission contract (AC-F8-2) is platform-conditional — delivered behind the same port with platform-conditional tests and an explicit skip record on the Linux CI matrix, which hard-gates the POSIX half (AC-F8-1) instead. No Linux run may claim Windows verification; an actual owner-environment Windows verification run is recorded before any public-release readiness claim. Decision needed: consult `@decision-advisor` if the owner wants the run scheduled inside this change rather than before release.

## 15. DECISION LOG

| ID | Decision | Rationale | Date |
|----|----------|-----------|------|
| DEC-1 | Add `state` as a fourth declared domain kind; classify state failures by exact code under the multi-row-kind rule. | Mirrors the config precedent (GH-173); one kind with seven codes keeps classification unambiguous and the sync check simple. | 2026-10-30 |
| DEC-2 | The append-only JSONL ledger is the single durable truth; SQLite is a derived, disposable index; `StateDriverKind` selects the read/index strategy over the same ledger. | Reconciles the ticket's "append-only JSONL plus SQLite indexes" with the scaffold placeholder's two kinds; ledger-truth makes indexes rebuildable and torn-index recovery truthful. | 2026-10-30 |
| DEC-3 | All names and paths are injected parameters; the state tier never imports branding and never reads configuration. | Branding seam constraint (state tier may not import branding; `stateDirectoryName` consumed as a parameter) and the foundation-story rule of no config coupling. | 2026-10-30 |
| DEC-4 | Only the `local` level is implemented; `project`/`global` are declared on the port and fail `state.level.unsupported` — never a silent local fallback. | Ticket scopes storage to local now with abstraction-only generalization; a silent fallback would corrupt the future shared-level semantics. | 2026-10-30 |
| DEC-5 | Retention is forever; the only destructive operation is the explicit, reported torn-tail repair; no prune/delete exists on the port. | Ticket retention clause; the repair exception is the minimum implied by "no pruning beyond what torn-state repair requires". | 2026-10-30 |
| DEC-6 | An absent store is verified-empty evidence; a present-but-unverifiable store is classified torn; the two are never conflated. | "Never silently read as zeros" targets corruption, not genuinely fresh stores; conflating them would make first use impossible or corruption invisible. | 2026-10-30 |
| DEC-7 | Write operations are unrepresentable without the acquired fence handle; contention and stale handles fail `state.lock.busy`; recovery is explicit and reported; silent stealing is forbidden. | Type-level prevention beats runtime error codes for a caller-contract violation; classified contention gives agents a retryable signal. | 2026-10-30 |
| DEC-8 | Every mutation is first a ledger record; derived documents and indexes are projections replaced atomically. | Crash recovery can then always rebuild from verified ledger truth, and consequence `not_landed` on write failures is truthful by construction. | 2026-10-30 |
| DEC-9 | No CLI command, no surface work, no callers beyond tests; the port is delivered for M0-S6/S8/S10. | Command registry lists M0-S5 as a foundation story; consumer adoption stories own their surfaces. | 2026-10-30 |
| DEC-10 | `change.type = feat` | Adds the durable-state capability — new behavior on a placeholder surface, not a refactor. | 2026-10-30 |

## 16. AFFECTED COMPONENTS (HIGH-LEVEL)

| Component | Impact |
|-----------|--------|
| `core` `./contracts` subpath | Extended — state port vocabulary (store identity, record envelope, key-set declaration, fence handle, level enum, state schema version constant) and the state error-table rows plus the `state` domain kind. |
| `core` `./state` subpath | Implemented — driver-neutral store facade plus both declared driver kinds, replacing the types-only placeholder's emptiness; the only location of runtime APIs in this change. |
| Result contract documentation and error catalog | Extended in-change with the seven documented state rows and the fourth domain kind; sync stays binding. |
| New state feature documentation | `doc/spec/features/feature-state-layer.md` authored in-change and registered in the forbidden-literals registry in the same change. |
| Workspace tests | New — conformance suite over both driver kinds, torn-fixture negative controls, crash-injection atomicity, contention and staleness, permission matrix, boundary/structure suites. |
| CI fast loop | Existing gates cover the new suites; no new job topology; the sync check and boundary gates extend to the new rows and tier code. |
| Later-consumer stories (M0-S6/S8/S10, M1 consumers) | Unchanged now; they adopt the delivered port. |
| `packages/adapters`, bash stack, `.opencode/`, `.ados-claude/` | Untouched (adapters may not import `core` `./state`). |

## 17. ACCEPTANCE CRITERIA

Ticket AC coverage: ticket AC-1 (torn state is detected and reported, never silently read as zeros) → AC-F4-1, AC-F4-2, AC-F4-3, AC-F5-1, AC-F2-2; ticket AC-2 (the abstraction has no implementation-dependent call sites) → AC-F1-2, AC-F3-1, AC-F10-1. Change-added edge-case criteria: the remainder, per the ID map below.

| ID | Criterion | Linked |
|----|-----------|--------|
| AC-F1-1 | **Given** an injected store identity (level `local`, workspace and fence identifiers, schema version, paths derived from the injected `stateDirectoryName` brand parameter), **when** a store is opened, **then** every name and path comes from parameters, the state tier performs no branding import and no configuration read, and identical inputs yield identical identity. | F-1, DM-1, NFR-7 |
| AC-F1-2 | **Given** the same ledger fixture, **when** the conformance suite runs against each declared driver kind, **then** every case (open, append, read, key-set assertion, contention, torn detection, atomic replace) passes with identical results over the driver-neutral observable fields — returned values, key-set results, error identities and codes, and torn-state verdicts — and no caller-facing operation or type discriminates by driver kind. Driver-specific diagnostic evidence (for example the `sqlite` index-rebuild report permitted by DM-5) is excluded from the parity comparison and asserted separately by its own criterion and test (AC-F3-1); the divergent-driver negative control remains binding. | F-1, F-3, NFR-1 |
| AC-F1-3 | **Given** a store request at the `project` or `global` level, **when** opening, **then** the operation fails `state.level.unsupported` and never silently substitutes local storage, while the port type declares all planned levels and `local` opens normally. | F-1, DEC-4 |
| AC-F1-4 | **Given** two workspace identifiers sharing one injected state directory, **when** both write and read, **then** records are scoped by workspace identifier and neither workspace observes the other's records. | F-1, DM-1 |
| AC-F2-1 | **Given** an acquired fence, **when** records are appended, **then** each lands in the ledger with schema version, record kind, key, contiguous sequence, and checksum, in append-only order with no in-place rewrite. | F-2, DM-2, NFR-8 |
| AC-F2-2 | **Given** a ledger or store declaring an unsupported state schema version, **when** reading, **then** the read fails `state.schema.mismatch`, no payload values are returned, and no coercion or best-effort interpretation occurs. | F-2, F-9, NFR-8 |
| AC-F3-1 | **Given** the indexed driver kind and an index corrupted or deleted independently of the ledger, **when** reading, **then** the divergence is detected, the index is rebuilt from the verified ledger or the read fails classified, the rebuild is reported in the read evidence, and returned values equal ledger truth. **Given** a storage I/O failure during rebuild, **when** the read fails, **then** it fails classified as `state.write.failed` (transient, retryable, consequence `not_landed`) — the ledger remains durable truth, the index stays disposable, and the result is never a silent stale read. | F-3, F-4, DM-5 |
| AC-F4-1 | **Given** each injected torn fixture class (truncated tail, framing break, sequence gap/duplicate/reset, checksum mismatch), **when** reading, **then** each is detected and fails `state.store.torn` with a safe location (store path and record position, never payload content), no read returns values from unverified bytes, and no negative control passes silently. | F-4, NFR-2 |
| AC-F4-2 | **Given** a state directory with no store files versus a present-but-torn store, **when** reading with key-set declarations, **then** the absent store returns explicit verified-empty evidence while the torn store fails classified — and the two results are never conflated. | F-4, F-5, DEC-6 |
| AC-F4-3 | **Given** a ledger whose damage is terminal truncation only, **when** explicit repair runs, **then** the incomplete tail is removed, the repair is reported, the ledger verifies, and remaining records are intact; **given** mid-record corruption, **when** repair is attempted, **then** it refuses with `state.store.torn` and changes nothing. | F-4, DEC-5 |
| AC-F5-1 | **Given** a read declaring a required key set against a verified ledger missing one declared key, **when** reading, **then** it fails `state.keys.missing` naming the missing keys with no default substitution; **given** all declared keys present, **when** reading, **then** their recorded values return exactly. | F-5, F-9 |
| AC-F6-1 | **Given** a derived-document replace with a failure or crash injected at any point between write start and rename, **when** the store is inspected afterward, **then** the target's observable content is either the previous or the new version — never partial — and the failed replace reports consequence `not_landed`. | F-6, NFR-3 |
| AC-F7-1 | **Given** a store whose fence is held by one token and a second acquisition with a different token, **when** contending, **then** the second acquisition fails `state.lock.busy` (transient, retryable) and no concurrent double-write lands. | F-7, NFR-4 |
| AC-F7-2 | **Given** write operations and a fence handle that no longer holds the store (released, recovered, or lost), **when** writing through the stale handle, **then** the operation fails `state.lock.busy`; recovery of a stale fence is explicit, reported, and never a silent steal, while reads remain available throughout. | F-7, DEC-7 |
| AC-F7-3 | **Given** a writer that crashed after landing a record but before releasing the fence, **when** the next writer inspects the store, **then** the fence is detectably stale, the landed record verifies on read, writes fail classified until explicit recovery, and the recovery is reported in evidence. | F-7, DM-5, NFR-4 |
| AC-F8-1 | **Given** store creation on POSIX, **when** files and directories are created, **then** the directory carries mode 0700 and store files 0600; **given** an existing store with a permission violation, **when** opening, **then** the open fails `state.permission.denied` and never continues permissively. | F-8, NFR-5 |
| AC-F8-2 | **Given** a Windows host environment, **when** the ACL-equivalent is applied and verified, **then** access is restricted to the current user per the documented platform contract behind the same port, with platform-conditional tests and the Linux CI limit recorded honestly. | F-8, NFR-5, OQ-2 |
| AC-F9-1 | **Given** the seven state codes, **when** classifying returned or thrown failures and comparing machine and documented catalogs, **then** every `(kind=state, code)` round-trips exactly with its declared category, retryability, consequence, and projection class, kind-only `state` classification is ambiguous (never first-row), wrong/missing/mismatched codes contain through `fallback.internal`, and bidirectional drift fails the sync check. | F-9, NFR-6 |
| AC-F9-2 | **Given** every write-path failure code, **when** inspected, **then** consequence is `not_landed`, and no read-path failure claims a landed mutation; error locations name store paths and record positions and never carry record payload content. | F-9, DM-5, NFR-3 |
| AC-F9-3 | **Given** the packed `core` artifact, **when** the state surface is imported under Node and Bun, **then** the public port and contracts resolve without new package subpaths, ambient reads, or unsupported dependencies, and both driver kinds load within their recorded runtime support matrix. This probe is the single documented exception to NFR-9's in-process rule: it necessarily spawns a runtime and is a packaging assertion, not a behaviour test, and it licenses no other spawned-process test. | F-1, F-3, NFR-9 |
| AC-F10-1 | **Given** the delivered change, **when** the tier/boundary/ambient/forbidden-literal suites run, **then** the state tier imports `./contracts` only, runtime APIs appear only in the state driver code, `adapters` do not import `core` `./state`, surfaces may, zero product literals appear, and any new forbidden boundary rule ships with a failing negative fixture. | F-10, NFR-7 |
| AC-F10-2 | **Given** the command registry and the delivered change, **when** inspected, **then** no CLI command, no configuration read, and no caller beyond tests ships, while the port surface is exercisable entirely through tests and ready for the M0-S6/S8/S10 consumers. | F-10, DEC-9 |

## 18. ROLLOUT & CHANGE MANAGEMENT (HIGH-LEVEL)

- Single PR targeting `main-tools`; branch `feat/GH-174/state-layer`; one conventional commit per plan phase; PM never merges.
- Fully additive substrate: no existing command, gate, or on-disk artifact changes; reversal is a single PR revert. No data migration (Section 19).
- The port is the stability promise to M0-S6/S8/S10 and the M1 consumers — the DoR gate (phase 5) reviews spec + test plan + plan against the ticket before any delivery begins.
- The documented state error rows and the fourth domain kind ship in-change in the result-contract feature doc; the state feature doc ships in-change registered in the forbidden-literals registry; phase 7 reconciles the scaffold, branding, result-contract, and glossary docs with delivered behavior.
- The TDR candidate (8.4/OQ-1) is recorded during delivery as Proposed, with truthful evidence; human TDR and any dependency-license acceptance gate merge/adoption at owner PR review, not branch work or PR creation. No PR merge is part of this change-spec handoff.

**Definition of Done — open-PR handoff (not merge/adoption):** All 22 ACs have passing, traceable evidence; all nine NFR thresholds have measured evidence. Executable negative controls pass and are non-vacuous: every torn fixture class asserts detection (never a silent pass), the assertion-failure control proves no default substitution, the unsupported-level control proves no local fallback, the contention/stale-handle controls prove no double-write and no silent steal, the crash-injection matrix proves no partial replace, and the permission-violation control proves fail-closed behavior. Conformance parity is proven 2/2 driver kinds on the same ledger fixtures over the driver-neutral observable fields, with driver-specific diagnostic evidence asserted separately per AC-F3-1; packed Node/Bun import controls pass — the single documented NFR-9 exception class (a packaging assertion, not a behaviour test), with every behaviour suite in-process; boundary, ambient, literal, sync, and aggregate gates are green. Current-truth docs (state feature doc authored and registered, result-contract rows, scaffold/branding/glossary reconciliation inputs) are synchronized. Independent review passes (or findings are fixed and re-reviewed), a minor changeset is recorded, and an open unmerged PR targets `main-tools` with all required CI jobs green on the pushed HEAD. Proposed TDR evidence is presented for human review; owner acceptance is required only before merge/adoption. No passing evidence or owner acceptance is claimed by this specification.

## 19. DATA MIGRATION / SEEDING (IF APPLICABLE)

None. No persisted state exists before this change; the substrate initializes stores on first use with the creation permission matrix. Retention starts at forever; no seeding, backfill, or migration tooling ships. The state schema version constant (`delivery.state.v1`) is present from day one so any future breaking store-format change has an explicit versioning channel and a classified `state.schema.mismatch` path.

## 20. PRIVACY / COMPLIANCE REVIEW

The state layer stores delivery records locally under least-privilege permissions: 0700/0600 on POSIX and a current-user ACL equivalent on Windows, enforced fail-closed. The state tier neither reads nor stores credentials; record payloads are consumer-supplied JSON-compatible values, and this change adds no secret-handling behavior beyond keeping payload content out of errors and evidence (safe locations name paths and record positions only). No network surface, no cloud anything (ADR-0003 C-4), no telemetry emission. If the SQLite path introduces a runtime dependency, the fail-closed license registry and audit apply in the same change, with human acceptance at owner PR review.

## 21. SECURITY REVIEW HIGHLIGHTS

- **Integrity is the headline property**: torn state is detected and classified, never silently read — the trust substrate's core promise (F-4, AC-F4-1..3).
- **Least-privilege storage**: enforced permissions at creation and open, fail-closed on violation, on both platform families (F-8).
- **Single-writer discipline**: fenced writes prevent concurrent corruption; stale-fence recovery is explicit and reported; silent stealing is structurally forbidden (F-7).
- **Atomicity**: partial writes are unobservable; failed mutations honestly report `not_landed`, which is the retry-safety signal agents rely on (F-6, F-9).
- **No new exposure**: no network, no ambient reads outside the driver code, no payload content in errors or evidence, zero product literals, contracts stay data-only.

## 22. MAINTENANCE & OPERATIONS IMPACT

- The store format is versioned from day one; format evolution requires a new state schema version and a classified mismatch path — never silent reinterpretation.
- The state error table grows only by reviewed change (code + documented row in the same delivery; sync enforces it).
- The conformance suite is the maintenance contract for driver work: any new driver kind or storage change must pass the identical suite; divergence fails CI.
- Forever retention means the ledger grows unboundedly by design; the indexed kind keeps reads bounded, and compaction remains a deliberate future decision (7.3), not an emergent behavior.
- Consumers (M0-S10 phase writes) inherit the fence and key-set discipline; reshaping the port later is a breaking-contract change requiring explicit review (RSK-6).

## 23. GLOSSARY

| Term | Definition |
|------|------------|
| State store | One durable local store opened from an injected identity: level, workspace identifier, fence namespace, schema version, and paths. |
| Ledger | The append-only, schema-versioned JSONL record sequence that is the single durable truth of a store. |
| Record | One schema-versioned ledger entry: kind, key, sequence, checksum, and a JSON-compatible payload. |
| Derived index | The SQLite projection maintained by the indexed driver kind over the ledger; disposable and rebuildable, never truth. |
| Derived document | A consumer-materialized file inside the store, replaced atomically; recorded first as a ledger record. |
| Torn state | Any detected integrity failure: framing break, truncated tail, sequence discontinuity, checksum mismatch, or index/ledger divergence. |
| Verified-empty | The explicit evidence that a store has no records — distinct from torn and from any defaulted value. |
| Key-set assertion | A read's declaration of required record keys; a missing declared key fails the read instead of returning a default. |
| Fence | The single-writer lock of a store, bound to a caller-supplied token; writes require the acquired handle. |
| Workspace identifier | The caller-supplied identity of the working context whose state is stored; scopes records and locks. |
| State level | The planned scope of a store: `local` (implemented), `project` (shared) and `global` (declared, unimplemented). |
| Torn-tail repair | The one explicit, reported destructive operation: removing an incomplete trailing record after verifying the damage is terminal truncation only. |
| State schema version | The brand-neutral store-format version (`delivery.state.v1` at v1) carried by every record and store; unsupported versions fail classified. |

## 24. APPENDICES

### Appendix A — Torn-state detection classes

| Class | Definition | Detection | Failure identity |
|-------|------------|-----------|------------------|
| Truncated tail | The final record is incomplete (no terminating framing) | Terminal-completeness check on read | `state.store.torn` (repairable via explicit torn-tail repair) |
| Framing break | A record line does not parse per the ledger framing | Per-record framing validation | `state.store.torn` |
| Sequence discontinuity | Gap, duplicate, or reset in the store-scoped sequence | Sequence continuity check | `state.store.torn` |
| Checksum mismatch | Payload bytes disagree with the recorded checksum | Per-record checksum verification | `state.store.torn` |
| Index/ledger divergence | The derived index disagrees with the verified ledger (indexed kind) | Index agreement check on read | Detected; rebuild from ledger with reported rebuild, or classified failure |

Unsupported schema versions are detected separately and fail `state.schema.mismatch`, not `state.store.torn` — a coherent store from another version is not a torn one.

### Appendix B — Key-set assertion semantics

A read declares its required record keys. After integrity verification succeeds: present keys return their recorded values exactly; absent declared keys fail `state.keys.missing` naming the missing keys; no empty collection, zero, or default is ever substituted. Key-set declarations are caller-supplied per read; the store never invents them. Verified-empty stores satisfy a read only when the caller declares an empty required set, and the verified-empty evidence is always explicit.

### Appendix C — Store identity fields (generalization seams)

| Field | Present at v1 | Generalization purpose |
|-------|---------------|------------------------|
| Level | Yes — `local` implemented; `project`, `global` declared | Shared-state stories adopt the enum without reshaping consumers. |
| Workspace identifier | Yes — caller-supplied, local field | Multiplexes state per working context; prerequisite for shared storage. |
| Fence namespace + token | Yes — caller-supplied, local fields | Lock tokens generalize from local files to networked leases (parked parallel-delivery concept) without redesign. |
| State directory | Yes — injected, derived by the calling edge from `stateDirectoryName` | Branding stays at the edge; the state tier never derives names. |
| Schema version | Yes — `delivery.state.v1` | Breaking store-format changes get an explicit, classified channel. |

### Appendix D — References

- Issue GH-174 — M0-S5: State layer (goal, tasks, ACs; verbatim per backlog M0-S5).
- Backlog, Epic M0, story M0-S5 (doc/planning/oss-tooling/backlog.md).
- Command registry (doc/planning/oss-tooling/cli-command-registry.md) — M0-S5 listed under foundation stories without a user command; `ADOS_STATE_DIR` and the JSONL+SQLite FILES section are later-surface planning truth, not this change's coupling.
- ADR-0003 — OSS Tooling Monorepo Structure (runtime-API confinement, tiers, C-3/C-4).
- Current-truth specs: feature-monorepo-scaffold-toolchain.md (boundary matrices, runtime-API confinement), feature-branding-seam.md (`stateDirectoryName`, M0-S5 consumer line), feature-result-contract.md (error table, classification chain, sync check), feature-config-layer.md (multi-row-kind classification precedent).
- TDR-0003 (GH-173) — the Proposed-TDR-during-delivery pattern this change's engine selections follow.
- PM planning notes (chg-GH-174-pm-notes.yaml) — clarify_scope record, scope guardrails, documentation impacts.

## 25. DOCUMENT HISTORY

| Version | Date | Author | Changes |
|---------|------|--------|---------|
| 1.0 | 2026-10-30 | Change Spec Writer | Initial GH-174 specification. |
| 1.1 | 2026-10-30 | Change Spec Writer | Targeted amendment (specification reopened, iteration 2, resolving test-plan findings OQ-T1/OQ-T2/OQ-T6): NFR-9 scoped in-process rule with the single AC-F9-3 packed-probe exception; AC-F1-2 parity defined over driver-neutral observable fields with driver-specific evidence excluded; AC-F3-1 pins `state.write.failed` for a failed index rebuild (`state.write.failed` row trigger/remediation extended); consistency wording pass (§4.1, F-3, NFR-1, §18 DoD); OQ-2 restated as resolved-to-documented-limitation (test plan GAP-1/OQ-T3). AC numbering unchanged. |

---

## AUTHORING GUIDELINES

Grounded in the issue (owner-authored, matching backlog M0-S5 verbatim), the merged dependency deliveries, the current-truth specs, and the PM clarify_scope record (zero open questions; engine mechanics delegated to spec/TDR). Storage-engine selections are fixed here only to the point of testability; the genuine selections are flagged as the TDR candidate of 8.4/OQ-1 and remain Proposed for owner review, in the TDR-0003 pattern. Future consumer record schemas are intentionally not invented. No implementation tasks, code-level file paths, or merge instructions appear in this artifact.

## VALIDATION CHECKLIST

- [x] `change.ref` matches provided `workItemRef` (GH-174)
- [x] `owners` has at least one entry
- [x] `status` is "Proposed"
- [x] All sections present in order (1-25 + guidelines + checklist)
- [x] ID prefixes consistent and unique (F-1..F-10, DM-1..DM-5, NFR-1..NFR-9, RSK-1..RSK-7, DEC-1..DEC-10, AC-*, OQ-1..OQ-2)
- [x] Acceptance criteria reference at least one F-/DM-/NFR-/DEC ID and use Given/When/Then with testable DoD predicates
- [x] NFRs include measurable values; risks include Impact and Probability with mitigations and residuals
- [x] Both ticket ACs covered and mapped; negative controls non-vacuous (torn fixtures assert detection)
- [x] Out-of-scope items marked `[OUT]`; engine selections flagged as TDR candidate, not left ambiguous where they would change ACs
- [x] No implementation tasks, code-level file paths, or git instructions in this artifact
