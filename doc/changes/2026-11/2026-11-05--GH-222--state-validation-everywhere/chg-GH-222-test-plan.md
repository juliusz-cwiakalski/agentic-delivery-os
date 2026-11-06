---
id: chg-GH-222-test-plan
status: Proposed
created: 2026-11-05
last_updated: 2026-11-05
owners: ["engineering"]
service: delivery-os
labels: ["m1", "state-layer"]
version_impact: minor
summary: "Traceable coverage for GH-222 state validation everywhere: classified torn/unknown reads at every boundary, explicit guided tail salvage with quarantine and preserved pre-tear records, index rebuild from the ledger alone, fail-closed storage exhaustion at every write boundary, artifact-boundary contracts for later registries, and synced machine/documented error tables."
links:
  change_spec: ./chg-GH-222-spec.md
  implementation_plan: null
  testing_strategy: .ai/rules/testing-strategy.md
---

# Test Plan - M1-S2: State validation everywhere

## 1. Scope and Objectives

This plan protects the state tier's truth guarantee at every boundary: a store that is torn, unknown, or out of space must produce a classified, evidence-carrying outcome instead of a value — most importantly instead of an empty record set or a zero. It covers the new guided salvage operation (truncate to the last valid frame, classified salvage record, quarantine of post-tear bytes), rebuild of the disposable index from the ledger alone including the post-salvage shape, and fail-closed disk exhaustion with no partial frame or partial derived document at any write boundary.

The risks this plan primarily guards are: silent zeros masking corruption, irreversible loss of pre-tear records during salvage, post-tear bytes leaking into read paths as content, partial writes masquerading as landed mutations, and drift between the machine and documented error tables when the two additive codes land.

Regressions protected: M0-S5 verified reads of valid prefixes, verified-empty distinct from torn, exact (never defaulted) key values including falsy ones, the "reads never repair" invariant, terminal-only destructive operations, and the delivery registry consumer's existing behaviour.

### 1.1 In Scope

- Classification of every enumerated corruption class: framing break, truncated tail, sequence gap, sequence duplicate, sequence reset, checksum mismatch — each classified as torn before any value returns.
- Unknown record kind / undeclared payload schema at a validated boundary classified `state.store.unknown`, distinct from version-scoped `state.schema.mismatch`.
- Classification evidence hygiene (store path and record position only; never payload or checksum bytes) and repair guidance.
- Guided tail salvage: truncation to the last valid frame, classified salvage record, quarantine of post-tear bytes, salvage evidence report, pre-tear preservation, post-tear non-service.
- Salvage safety invariants: reads never repair (byte-identity), and mid-record (non-terminal) tears refuse `state.store.torn` with zero byte mutation.
- Index rebuild from the ledger alone: index absent, corrupt, divergent, and post-salvage.
- Fail-closed storage exhaustion at the append, derived-document replace, and salvage write boundaries, injected through the runtime edge's named fault points.
- Machine ↔ documented error-table sync for the two new rows and the refined `state.write.failed` remediation, including non-vacuity of the sync check for those rows.
- Artifact-boundary contracts exercised on artifact kinds standing in for the retro registry and ceremony artifacts.
- Delivery registry boundary-validation regression.

### 1.2 Out of Scope & Known Gaps

- [OUT] Retro pipeline (M1-S8) and ceremony runner (M2-S3) behaviour — not implemented here (spec NG-1, DEC-1). Artifact kinds are stand-ins only.
- [OUT] A user-facing `state` CLI command surface (spec NG-3, DEC-4). All coverage is at the library boundary.
- [OUT] Real disk conditions. Storage exhaustion is injected exclusively through named runtime-edge fault points; no test fills a device or depends on host capacity.
- [OUT] Backup, restore, migration, prune/compaction (spec NG-4, NG-6).
- [OUT] A state schema-version bump; salvage records and artifact declarations are additive (spec §19).
- [OUT] Windows ACL execution — existing suites keep their platform conditional; this plan asserts POSIX bits only, and no Linux run claims Windows verification.
- [OUT] Performance/load characteristics of salvage, rebuild, or classification.

## 2. References

- **Change specification**: [chg-GH-222-spec.md](./chg-GH-222-spec.md) — capabilities F-1..F-6, AC-F1-1..AC-F6-1, NFR-1..NFR-7, DEC-5 error-code dispositions, Appendix B test-plan handoff.
- **Current system truth**: [feature-state-layer.md](../../../spec/features/feature-state-layer.md) — ledger truth, torn detection, verified-empty, key-set assertions, disposable index, atomic replace, bounded repair, evidence model, boundaries.
- **Error-table contract**: [feature-result-contract.md](../../../spec/features/feature-result-contract.md) — documented `state` rows (the sync target) and the binding classification chain.
- **Testing strategy**: [.ai/rules/testing-strategy.md](../../../../.ai/rules/testing-strategy.md) — layers, module mapping, conventions, quality gates.
- **TypeScript rules**: [.ai/rules/typescript.md](../../../../.ai/rules/typescript.md) — bun:test authoring, workspace boundaries, error contract.
- **Runtime-edge fault points**: `packages/core/src/state/edge.ts` — `StateEdgeFaultPoint` is the injection seam; the type explicitly permits delivery to add points.
- **Milestone test-scenario pack**: [m1/test-scenarios.md](../../../planning/oss-tooling/milestones/m1/test-scenarios.md) — no dedicated S2 scenario; per the pack's coverage rule this story records its local ids (`TC-GH222-*`) here, and this file is the traceability record the DoR gate consumes.
- **Existing state suites** (patterns and fixtures to reuse): `tests/fixtures/state/harness.ts`, `tests/behaviour/state-torn.test.ts`, `tests/behaviour/state-index.test.ts`, `tests/behaviour/state-evidence.test.ts`, `tests/behaviour/state-keys.test.ts`, `tests/behaviour/state-error-classification.test.ts`, `tests/behaviour/phase-registry.test.ts`, `tests/checks/error-table-sync.test.ts`, `tests/structure/error-table.test.ts`.

## 3. Coverage Overview

### 3.1 Functional Coverage (F-#, AC-#)

| AC ID | Description | TC ID(s) | Status |
|-------|-------------|----------|--------|
| AC-F1-1 | Every read/write boundary classifies valid / verified-empty / torn / unknown distinctly before any value returns; no default or zero substitution; undeclared kind/schema → `state.store.unknown`; version mismatch stays `state.schema.mismatch` | TC-GH222-001, TC-GH222-002, TC-GH222-003, TC-GH222-004, TC-GH222-005, TC-GH222-006, TC-GH222-020, TC-GH222-021, TC-GH222-022, TC-GH222-023 | Covered |
| AC-F2-1 | A torn tail on a verified read returns a classified torn failure naming store path and record position with repair guidance; no value, not even an empty record set, is served | TC-GH222-001, TC-GH222-002, TC-GH222-003, TC-GH222-005, TC-GH222-023 | Covered |
| AC-F3-1 | Explicit guided salvage truncates to the last valid frame, appends a classified salvage record as durable truth, quarantines post-tear bytes never served as content, and returns evidence naming truncation position and quarantined extent | TC-GH222-007, TC-GH222-008, TC-GH222-009 | Covered |
| AC-F3-2 | Reads on a torn store without explicit salvage leave ledger bytes unchanged, repair nothing automatically, and return only the classified failure with repair guidance | TC-GH222-010 | Covered |
| AC-F3-3 | Salvage on a mid-record (non-terminal) integrity break fails classified `state.store.torn` with zero ledger bytes changed; M0-S5 refuse-and-classify holds | TC-GH222-011 | Covered |
| AC-F4-1 | With only the ledger — index absent, corrupt, divergent, or post-salvage — the index rebuilds from verified ledger truth and converges with the verified scan | TC-GH222-012, TC-GH222-013, TC-GH222-014 | Covered |
| AC-F5-1 | Injected storage exhaustion at any write boundary (append, derived-document replace, salvage write) fails `state.storage.exhausted` with consequence `not_landed`, ledger at the last valid frame, no partial frame or partial document observable | TC-GH222-015, TC-GH222-016, TC-GH222-017 | Covered |
| AC-F5-2 | Every new/refined state code is declared in both the machine and documented error tables with consequence `not_landed`, and the bidirectional sync check passes with zero drift | TC-GH222-018, TC-GH222-019 | Covered |
| AC-F6-1 | Artifact-boundary contracts on artifact kinds standing in for the retro registry and ceremony artifacts classify schema violations and unknown kinds — never silent zeros — with no retro/ceremony behaviour present | TC-GH222-020, TC-GH222-021, TC-GH222-022 | Covered |

Every acceptance criterion has at least one automated case, and every case traces to at least one acceptance criterion.

### 3.2 Interface Coverage (API-#, EVT-#, DM-#)

| Interface ID | Description | TC ID(s) | Status |
|--------------|-------------|----------|--------|
| EVT-1 | Salvage ledger record appended by an explicit salvage; describes the salvage in the existing envelope; never carries payload content or checksum bytes | TC-GH222-007, TC-GH222-008 | Covered |
| DM-1 | Salvage record kind inside the existing schema version; durable ledger truth and self-describing evidence | TC-GH222-007, TC-GH222-008 | Covered |
| DM-2 | Quarantine artifact: preserved post-tear bytes outside the read path, never served as content, least-privilege permissions | TC-GH222-007, TC-GH222-009 | Covered |
| DM-3 | Salvage evidence verdict: truncation position, quarantined extent, record counts; paths and positions only | TC-GH222-007, TC-GH222-009 | Covered |
| DM-4 | Artifact-boundary schema declarations reusable by the retro registry and ceremony artifacts | TC-GH222-020, TC-GH222-021, TC-GH222-022 | Covered |

### 3.3 Non-Functional Coverage (NFR-#)

| NFR ID | Requirement | TC ID(s) | Status |
|--------|-------------|----------|--------|
| NFR-1 | Classification completeness: 100% of enumerated corruption/unknown classes classified; 0 silent-zero paths | TC-GH222-001 through TC-GH222-006, TC-GH222-020, TC-GH222-021, TC-GH222-022, TC-GH222-023 | Covered |
| NFR-2 | Salvage data preservation: 0 pre-tear records lost or altered | TC-GH222-007, TC-GH222-008 | Covered |
| NFR-3 | Quarantine integrity: 100% of post-tear bytes quarantined; 0 read paths serve them | TC-GH222-007, TC-GH222-009 | Covered |
| NFR-4 | Fail-closed writes: 100% of injected attempts leave the ledger at the last valid frame; 0 partial frames; 0 observable partial documents | TC-GH222-015, TC-GH222-016, TC-GH222-017 | Covered |
| NFR-5 | Rebuild completeness: 100% of test stores rebuild and converge with the verified scan | TC-GH222-012, TC-GH222-013, TC-GH222-014 | Covered |
| NFR-6 | Error-table sync: 0 drift in the same change; bidirectional check passes | TC-GH222-018, TC-GH222-019 | Covered |
| NFR-7 | No automatic repair: 0 read-triggered byte mutations; salvage only via explicit invocation | TC-GH222-010, TC-GH222-011 | Covered |

## 4. Test Types and Layers

All cases are automated `bun:test` suites under `tests/**/*.test.ts` per the repository strategy (`packages/**` → `bun test tests/structure tests/behaviour`, boundary suite, typecheck). Two tiers are used, both housed under `tests/behaviour/` because the repository's layout is by *layer*, not by unit/integration directory:

- **Unit tier (pure)** — the pure ledger/verification modules (`packages/core/src/state/ledger.ts` and contract declarations) driven directly with byte strings and record values; no filesystem. Used for the classification matrix, evidence phrasing, and the contract verdict matrix.
- **Integration tier (temp store)** — the public store port over a real temporary state directory with the production node edge, wrapped by the existing fault-injecting test edge (`createTestEdge` in `tests/fixtures/state/harness.ts`). Used for salvage, rebuild, disk-full, artifact boundaries, and registry regression. Temp roots come from `mkdtempSync`; the live tree and the user state directory are never touched.
- **Contract / structure tier** — `tests/checks/error-table-sync.test.ts` plus `scripts/checks/error-table-sync.ts` for machine ↔ documented table parity, and `tests/structure/*` for row shape and boundaries. Mutation-style negative controls run in temp copies.
- **Static/diff** — `git diff --check`, plus the existing `tests/structure/state-contract.test.ts`, `state-imports.test.ts`, `state-scope.test.ts` guards when new state modules or contract exports land.

No E2E tier applies: the state tier is a local library surface with no command (spec NG-3, DEC-4). No manual cases are planned; all nine ACs are machine-checkable.

Fault injection convention: tests arm faults by point name (`edge.arm(["append-before-flush"])`), assert the recorded `raised` points, then disarm and assert the store recovers. Fault-point names below are binding requirements; exact names may be aligned at delivery except where the name already exists in `StateEdgeFaultPoint`.

## 5. Test Scenarios

### 5.1 Scenario Index

| TC ID | Title | Type | Tier | Automation | Priority | AC Coverage |
|-------|-------|------|------|------------|----------|-------------|
| TC-GH222-001 | Framing break and truncated tail classify as torn | Negative | Integration | Automated | High | AC-F1-1, AC-F2-1 |
| TC-GH222-002 | Sequence gap, duplicate, and reset classify as torn | Negative | Integration | Automated | High | AC-F1-1, AC-F2-1 |
| TC-GH222-003 | Checksum mismatch classifies as torn | Negative | Unit + Integration | Automated | High | AC-F1-1, AC-F2-1 |
| TC-GH222-004 | Undeclared kind or schema → `state.store.unknown`; version mismatch stays `state.schema.mismatch` | Negative | Integration | Automated | High | AC-F1-1 |
| TC-GH222-005 | Classification evidence hygiene and verified-empty distinctness | Edge Case | Unit + Integration | Automated | High | AC-F1-1, AC-F2-1 |
| TC-GH222-006 | Write-boundary schema validation refuses nonconforming records | Negative | Integration | Automated | High | AC-F1-1 |
| TC-GH222-007 | Salvage happy path: truncate, salvage record, quarantine, evidence | Happy Path | Integration | Automated | Critical | AC-F3-1 |
| TC-GH222-008 | Salvage preserves every pre-tear record byte-for-byte | Happy Path | Integration | Automated | Critical | AC-F3-1 |
| TC-GH222-009 | Post-tear bytes are quarantined and never served as content | Edge Case | Integration | Automated | Critical | AC-F3-1 |
| TC-GH222-010 | Reads never repair: torn reads are byte-side-effect-free | Regression | Integration | Automated | Critical | AC-F3-2 |
| TC-GH222-011 | Salvage on a mid-record tear refuses with zero byte mutation | Negative | Integration | Automated | Critical | AC-F3-3 |
| TC-GH222-012 | Rebuild from the ledger alone: absent and corrupt index | Happy Path | Integration | Automated | High | AC-F4-1 |
| TC-GH222-013 | Divergent index rebuild converges and is reported | Edge Case | Integration | Automated | High | AC-F4-1 |
| TC-GH222-014 | Post-salvage ledger rebuilds the index from the log alone | Corner Case | Integration | Automated | High | AC-F4-1 |
| TC-GH222-015 | Append under injected exhaustion is fail-closed | Negative | Integration | Automated | Critical | AC-F5-1 |
| TC-GH222-016 | Derived-document replace under exhaustion keeps the previous version | Negative | Integration | Automated | Critical | AC-F5-1 |
| TC-GH222-017 | Salvage write under exhaustion leaves the ledger unchanged | Negative | Integration | Automated | Critical | AC-F5-1 |
| TC-GH222-018 | Both error tables declare the new rows; sync check passes with zero drift | Contract | Contract | Automated | Critical | AC-F5-2 |
| TC-GH222-019 | Error-table sync is non-vacuous for the new and refined rows | Contract | Contract | Automated | High | AC-F5-2 |
| TC-GH222-020 | Artifact-boundary verdict matrix: valid, verified-empty, torn, unknown | Contract | Unit + Integration | Automated | High | AC-F1-1, AC-F6-1 |
| TC-GH222-021 | Retro-registry stand-in kind: schema violation and unknown kind classified | Negative | Integration | Automated | High | AC-F6-1 |
| TC-GH222-022 | Ceremony-artifact stand-in kind: malformed and unknown artifacts classified | Negative | Integration | Automated | High | AC-F6-1 |
| TC-GH222-023 | Delivery registry verified reads and torn classification preserved | Regression | Integration | Automated | Critical | AC-F1-1, AC-F2-1 |

### 5.2 Scenario Details

#### TC-GH222-001 - Framing break and truncated tail classify as torn

**Scenario Type**: Negative
**Impact Level**: Critical
**Priority**: High
**Related IDs**: F-1, F-2, AC-F1-1, AC-F2-1, NFR-1
**Test Type(s)**: Integration
**Automation Level**: Automated
**Target Layer / Location**: `tests/behaviour/state-torn.test.ts` (extend the existing per-class cases)
**Tags**: @backend, @state, @integration, @classification

**Preconditions**:

- A temp store seeded with three valid records (one payload carries a canary string).
- Two fixtures derived from the same seed: (a) a line whose trailing bytes break framing, (b) a final line truncated mid-record.

**Steps**:

1. Snapshot ledger bytes and the file listing before the read.
2. Perform a verified `readRecords` and a key-set `read` against each fixture.
3. Assert the classified failure for each, including code, variant/classification, store path, and record position.
4. Assert the failure text and the returned evidence contain no canary value and no checksum string.

**Expected Outcome**:

- Both fixtures fail `state.store.torn` before any value returns; the failure names the store path and the offending record position.
- No `values` and no empty record set are returned; both reads are failures, not successes with zero records.
- Repair guidance is present on both failures and points at an inspect/salvage path.
- Ledger bytes and the directory listing are unchanged after the reads.

**Notes / Clarifications**:

- Existing `tests/behaviour/state-torn.test.ts` already mutates these classes; this case adds the "no empty set, no values, guidance present" assertions AC-F2-1 requires.

---

#### TC-GH222-002 - Sequence gap, duplicate, and reset classify as torn

**Scenario Type**: Negative
**Impact Level**: Critical
**Priority**: High
**Related IDs**: F-1, F-2, AC-F1-1, AC-F2-1, NFR-1
**Test Type(s)**: Integration
**Automation Level**: Automated
**Target Layer / Location**: `tests/behaviour/state-torn.test.ts`
**Tags**: @backend, @state, @integration, @classification

**Preconditions**:

- Three fixture ledgers: one with a skipped store-scoped sequence number, one with a duplicated sequence, one whose sequence restarts at 1 mid-ledger.
- Each mutation asserts its own precondition (the mutated line differs from the seed) before the read.

**Steps**:

1. Read each fixture through `readRecords` and through an indexed read.
2. Assert classification and position per fixture.

**Expected Outcome**:

- Each of gap, duplicate, and reset fails `state.store.torn` with the position of the first discontinuity.
- No partial prefix is served: the read is a failure, and no values or zero records are returned.
- The indexed read classifies identically (no driver-discriminated behaviour).
- Ledger bytes are unchanged.

---

#### TC-GH222-003 - Checksum mismatch classifies as torn

**Scenario Type**: Negative
**Impact Level**: Critical
**Priority**: High
**Related IDs**: F-1, F-2, AC-F1-1, AC-F2-1, NFR-1
**Test Type(s)**: Unit, Integration
**Automation Level**: Automated
**Target Layer / Location**: `tests/behaviour/state-torn.test.ts` (with the pure ledger check via the existing ledger suite)
**Tags**: @backend, @state, @unit, @integration

**Preconditions**:

- A seeded ledger whose second record's payload is altered so the recorded checksum no longer matches, with the checksum field left intact.
- A unit-level case calling the pure verification with the same bytes.

**Steps**:

1. Verify the pure ledger function classifies the mismatch as torn with the record position.
2. Read the mutated store through the port.
3. Assert no checksum bytes appear in the failure or evidence.

**Expected Outcome**:

- Pure verification and port read agree: torn, checksum class, record position.
- The failure never echoes the expected or recorded checksum value (only the position).
- No values are served; the ledger is unchanged.

---

#### TC-GH222-004 - Undeclared kind or schema → `state.store.unknown`; version mismatch stays `state.schema.mismatch`

**Scenario Type**: Negative
**Impact Level**: Critical
**Priority**: High
**Related IDs**: F-1, F-2, AC-F1-1, DM-4, NFR-1
**Test Type(s)**: Integration
**Automation Level**: Automated
**Target Layer / Location**: `tests/behaviour/state-unknown.test.ts` (new)
**Tags**: @backend, @state, @integration, @classification

**Preconditions**:

- A validated boundary that declares its record kinds and payload schemas (the artifact-boundary contract from this change, or the delivery registry boundary).
- Fixture A: a store record whose kind is not declared at that boundary.
- Fixture B: a record of a declared kind whose payload violates the declared payload schema.
- Fixture C: a store whose schema version is not the supported `delivery.state.v1`.
- Fixture D: an empty (verified-empty) store.

**Steps**:

1. Read each fixture through the validated boundary.
2. Record the failure code, evidence, and whether any value was returned.
3. Compare the codes pairwise.

**Expected Outcome**:

- Fixtures A and B fail `state.store.unknown` with the store path and record position and a remediation hint; no value and no empty record set is served.
- Fixture C fails `state.schema.mismatch` — the version-scoped code is not overloaded as unknown.
- Fixture D returns verified-empty evidence; it is neither torn nor unknown, and it satisfies only an empty key-set declaration.
- The three codes/verdicts (unknown, schema mismatch, verified-empty) are pairwise distinct in evidence and in classification.

**Notes / Clarifications**:

- The raw store port stays kind-agnostic (arbitrary consumer kinds are legal, per M0-S5 backward compatibility). "Undeclared kind" means undeclared **at the validated boundary under test**, not unknown to the store format. This distinction must be visible in the test names so a future reader does not tighten the store into a closed kind list.

---

#### TC-GH222-005 - Classification evidence hygiene and verified-empty distinctness

**Scenario Type**: Edge Case
**Impact Level**: Critical
**Priority**: High
**Related IDs**: F-1, F-2, AC-F1-1, AC-F2-1, NFR-1
**Test Type(s)**: Unit, Integration
**Automation Level**: Automated
**Target Layer / Location**: `tests/behaviour/state-evidence.test.ts` (extend); `tests/behaviour/state-keys.test.ts` remains as the falsy-value regression (`Existing – No Change`)
**Tags**: @backend, @state, @evidence, @integration

**Preconditions**:

- A torn store whose first record's payload is a canary string and whose failure position is a mid-ledger record.
- A verified store containing falsy values (`0`, `""`, `false`, `null`, empty array, empty object) under declared keys.
- An absent store.

**Steps**:

1. Read the torn store and capture the failure plus any evidence.
2. Read the verified store with a key-set declaration and assert exact values.
3. Read the absent store and assert verified-empty evidence plus an explicit marker.
4. Assert `state.keys.missing` when a non-empty key set is declared against the absent store.

**Expected Outcome**:

- Torn evidence carries path and position only; no payload content, no checksum bytes, no payload-derived text.
- Falsy values return exactly; no default substitution anywhere in the read path.
- Verified-empty carries `verifiedEmpty: true` with zero records and is never shaped like a torn failure; torn evidence never carries `verifiedEmpty: true`.
- An absent store satisfies only the empty key-set declaration and fails `state.keys.missing` for a non-empty one.

---

#### TC-GH222-006 - Write-boundary schema validation refuses nonconforming records

**Scenario Type**: Negative
**Impact Level**: Critical
**Priority**: High
**Related IDs**: F-1, AC-F1-1, DM-4, NFR-1
**Test Type(s)**: Integration
**Automation Level**: Automated
**Target Layer / Location**: `tests/behaviour/state-boundary-validation.test.ts` (new)
**Tags**: @backend, @state, @integration, @write-path

**Preconditions**:

- A validated boundary with a declared record kind and payload schema, opened over a seeded temp store.
- An acquired fence handle.

**Steps**:

1. Snapshot the ledger byte digest.
2. Attempt (a) an append of an undeclared kind, (b) an append of a declared kind with a schema-violating payload, (c) an append missing a declared required field.
3. Snapshot the ledger digest again and perform a verified read of the pre-existing records.

**Expected Outcome**:

- Each attempt fails classified (`state.store.unknown` for undeclared kind/schema) with consequence `not_landed`; no default is filled in for the missing field.
- The ledger digest is unchanged: nothing landed, no partial frame, sequence unchanged.
- The subsequent verified read returns exactly the pre-existing records and evidence count.

---

#### TC-GH222-007 - Salvage happy path: truncate, salvage record, quarantine, evidence

**Scenario Type**: Happy Path
**Impact Level**: Critical
**Priority**: Critical
**Related IDs**: F-3, AC-F3-1, EVT-1, DM-1, DM-2, DM-3, NFR-2, NFR-3
**Test Type(s)**: Integration
**Automation Level**: Automated
**Target Layer / Location**: `tests/behaviour/state-salvage.test.ts` (new)
**Tags**: @backend, @state, @integration, @salvage, @evidence

**Preconditions**:

- A temp store with four valid records, then a terminal tear planted at the tail (framing break or truncated tail); the torn store is verified to fail before salvage.
- The explicit salvage operation delivered by this change (library surface), invoked directly — never through a read.

**Steps**:

1. Capture the ledger bytes, the pre-salvage record count, and the torn failure position.
2. Invoke the explicit salvage operation.
3. Inspect the returned evidence report.
4. Read the ledger text and the salvage record line; read the store again through `readRecords` and a key-set `read`.
5. List the store directory and the documents directory.

**Expected Outcome**:

- The operation succeeds and returns evidence naming the truncation position, the quarantined extent, and record counts (pre-tear records, salvaged bytes).
- The ledger now ends at a complete, verifiable frame; the appended final record is the classified salvage record kind, carries the existing schema version, and is self-describing (tear position, quarantine reference, counts).
- The salvage record and the evidence contain no payload content and no checksum bytes.
- All four pre-tear records verify and are readable; the post-salvage read reports verified evidence with the expected record count.
- A quarantine artifact exists outside the documents and index paths; the index (indexed kind) is not treated as truth by salvage.
- Salvage evidence does not claim an index rebuild unless one occurred.

**Notes / Clarifications**:

- The operation name is fixed at delivery; the test asserts library-boundary behaviour, not a CLI command (spec NG-3).

---

#### TC-GH222-008 - Salvage preserves every pre-tear record byte-for-byte

**Scenario Type**: Happy Path
**Impact Level**: Critical
**Priority**: Critical
**Related IDs**: F-3, AC-F3-1, EVT-1, DM-1, NFR-2
**Test Type(s)**: Integration
**Automation Level**: Automated
**Target Layer / Location**: `tests/behaviour/state-salvage.test.ts` (new)
**Tags**: @backend, @state, @integration, @salvage, @data-preservation

**Preconditions**:

- A store with five valid records whose payloads include falsy values, nested objects, and a canary string.
- A planted terminal tear after the fifth record.

**Steps**:

1. Capture each pre-tear record's serialized line and checksum before salvage.
2. Invoke salvage.
3. Compare the valid prefix byte-for-byte with the captured prefix.
4. Read all records through `readRecords` and through a key-set `read`, comparing every value.
5. Verify the salvage record's payload does not duplicate any pre-tear payload content.

**Expected Outcome**:

- The post-salvage ledger begins with a byte-identical valid prefix: zero pre-tear bytes rewritten, zero records lost or altered, checksums unchanged.
- Every pre-tear value returns exactly, including falsy values; record order and sequence continuity hold.
- The salvage record is additive and appears after the preserved prefix; no pre-tear record is re-numbered.
- Removing the salvage record from a copy reproduces the original valid prefix exactly (proves the prefix was not regenerated).

---

#### TC-GH222-009 - Post-tear bytes are quarantined and never served as content

**Scenario Type**: Edge Case
**Impact Level**: Critical
**Priority**: Critical
**Related IDs**: F-3, AC-F3-1, DM-2, DM-3, NFR-3
**Test Type(s)**: Integration
**Automation Level**: Automated
**Target Layer / Location**: `tests/behaviour/state-salvage.test.ts` (new)
**Tags**: @backend, @state, @integration, @salvage, @quarantine, @permissions

**Preconditions**:

- A terminal tear over records whose post-tear tail carries a distinctive canary byte sequence.
- A captured copy of the pre-salvage post-tear bytes.

**Steps**:

1. Invoke salvage and capture the evidence report's quarantine path and extent.
2. Read the quarantine artifact and compare its bytes with the captured post-tear bytes.
3. Assert the evidence names the quarantine path and extent but no payload or checksum content.
4. Re-run every documented read path (`read`, `readRecords`, `checkIntegrity`, registry read) and search all outcomes and evidence for the canary.
5. On POSIX, assert the quarantine artifact's permission bits are `0600`; assert it is not inside the derived-documents directory and is not returned by any list of served documents.

**Expected Outcome**:

- The quarantine artifact's bytes equal the original post-tear bytes exactly; nothing is discarded and nothing is duplicated into the live ledger.
- The extent in the evidence matches the artifact length; the truncation position matches the last valid frame.
- No read outcome, failure, or evidence contains the tail canary; the quarantine path is not served as content.
- Quarantine permissions match the store file contract; a foreign-permission fixture is detected rather than accepted (POSIX, platform-conditional).

**Postconditions**:

- The quarantined bytes remain recoverable manually; the test does not delete them mid-run.

---

#### TC-GH222-010 - Reads never repair: torn reads are byte-side-effect-free

**Scenario Type**: Regression
**Impact Level**: Critical
**Priority**: Critical
**Related IDs**: F-2, F-3, AC-F3-2, NFR-7
**Test Type(s)**: Integration
**Automation Level**: Automated
**Target Layer / Location**: `tests/behaviour/state-salvage-invariants.test.ts` (new)
**Tags**: @backend, @state, @integration, @invariant

**Preconditions**:

- A store with a planted terminal tear (two variants: truncated tail, framing break).
- A directory snapshot helper hashing file names plus bytes (same idea as the existing `digestPaths` fixture).

**Steps**:

1. Snapshot the ledger digest and the full directory digest.
2. Perform `readRecords`, `read` with a key-set, `checkIntegrity`, and (indexed kind) an indexed read; repeat each twice.
3. Assert each call fails classified with torn classification and repair guidance.
4. Re-snapshot both digests.
5. For the indexed kind, additionally assert no index file is created or rebuilt on the torn read.

**Expected Outcome**:

- All four digests are unchanged: zero ledger byte mutation, no quarantine artifact created, no salvage record appended, no repair report in evidence.
- Every read returns only the classified failure plus guidance — no value, no empty set, no "repaired" success.
- The indexed read neither serves stale index rows nor rebuilds from a torn ledger; it classifies torn.
- Repair guidance mentions salvage as an explicit separate operation, not as something the read will do.

---

#### TC-GH222-011 - Salvage on a mid-record tear refuses with zero byte mutation

**Scenario Type**: Negative
**Impact Level**: Critical
**Priority**: Critical
**Related IDs**: F-3, F-2, AC-F3-3, NFR-7
**Test Type(s)**: Integration
**Automation Level**: Automated
**Target Layer / Location**: `tests/behaviour/state-salvage-invariants.test.ts` (new)
**Tags**: @backend, @state, @integration, @salvage, @invariant

**Preconditions**:

- A ledger with five records: record 3's framing/checksum is damaged while records 4 and 5 remain parseable as frames after the break (a non-terminal, mid-record integrity break).
- A pre-salvage byte digest of the whole ledger.

**Steps**:

1. Confirm a verified read classifies torn at record 3 and does not serve values.
2. Invoke the explicit salvage operation.
3. Compare the whole-ledger byte digest before and after.
4. Inspect the store directory for new quarantine artifacts or salvage records.

**Expected Outcome**:

- Salvage fails classified `state.store.torn` naming the mid-record position; no values are returned.
- The whole ledger is byte-identical, including records 4 and 5 after the break: zero bytes changed, nothing truncated, no quarantine artifact, no salvage record.
- The refusal is distinguishable from the terminal-tail success path in evidence (no truncation position/additional record reported).
- A subsequent verified read still reports the same torn position (the failed attempt left no residue).

**Notes / Clarifications**:

- This is the safety case that prevents a naive "truncate at first tear" from deleting parseable post-tear records (spec DEC-2, OQ-2 resolution). If delivery cannot distinguish terminal from mid-record tears, this case fails and the gap must be escalated, not weakened.

---

#### TC-GH222-012 - Rebuild from the ledger alone: absent and corrupt index

**Scenario Type**: Happy Path
**Impact Level**: Important
**Priority**: High
**Related IDs**: F-4, AC-F4-1, NFR-5
**Test Type(s)**: Integration
**Automation Level**: Automated
**Target Layer / Location**: `tests/behaviour/state-index.test.ts` (extend)
**Tags**: @backend, @state, @integration, @rebuild

**Preconditions**:

- A seeded store opened with the `sqlite` kind; the SQLite binding is available (skip condition documented and reported if absent, per TDR-0004).
- The same ledger copied to a second root read with the `jsonl` kind as the verified-scan oracle.

**Steps**:

1. Delete the index file; perform an indexed read. Assert the rebuild report (`reason: "missing"`) and the values.
2. Replace the index file with garbage bytes; perform an indexed read. Assert the rebuild report (`reason: "corrupt"`) and recovery.
3. Compare indexed-read values and record counts with the `jsonl` verified scan of the same ledger.

**Expected Outcome**:

- Both cases rebuild from verified ledger truth and report the rebuild with the correct reason and record count.
- Indexed values and record counts equal the verified-scan oracle exactly; no stale or empty value is served.
- The index file is recreated; the ledger is untouched (byte digest unchanged).
- The rebuild never treats the index as truth: a ledger change with a stale index is resolved from the ledger.

---

#### TC-GH222-013 - Divergent index rebuild converges and is reported

**Scenario Type**: Edge Case
**Impact Level**: Important
**Priority**: High
**Related IDs**: F-4, AC-F4-1, NFR-5
**Test Type(s)**: Integration
**Automation Level**: Automated
**Target Layer / Location**: `tests/behaviour/state-index.test.ts` (extend)
**Tags**: @backend, @state, @integration, @rebuild

**Preconditions**:

- A seeded indexed store plus a deliberately divergent index (one row altered, one row deleted, one phantom row added — three fixtures).

**Steps**:

1. Perform an indexed read per fixture.
2. Assert the rebuild report (`reason: "divergent"`) and the returned values.
3. Compare with the verified-scan oracle and re-read once more to prove convergence is stable.

**Expected Outcome**:

- Each divergence is detected, rebuilt from the ledger, and reported; the indexed values equal the verified scan.
- The second read reports no rebuild (converged) and serves the same values.
- Failure to converge fails classified (`state.write.failed`) rather than serving stale truth — asserted with a forced index-write fault (`index-rebuild-write`) and confirming no stale value is returned.

---

#### TC-GH222-014 - Post-salvage ledger rebuilds the index from the log alone

**Scenario Type**: Corner Case
**Impact Level**: Important
**Priority**: High
**Related IDs**: F-4, AC-F4-1, NFR-5, DM-1
**Test Type(s)**: Integration
**Automation Level**: Automated
**Target Layer / Location**: `tests/behaviour/state-index-post-salvage.test.ts` (new)
**Tags**: @backend, @state, @integration, @salvage, @rebuild

**Preconditions**:

- A store salvaged by TC-GH222-007's flow (terminal tear removed, salvage record appended, quarantine written).
- The index from before salvage still present but stale; a second fixture with the index deleted; a third with the index corrupt.

**Steps**:

1. Perform an indexed read in each fixture; assert a rebuild report and the values.
2. Compare the indexed record set with a `jsonl` verified scan of the salvaged ledger, including the salvage record.
3. Assert the quarantine artifact contributes no rows to the index.

**Expected Outcome**:

- All three fixtures rebuild from the salvaged ledger alone and converge with the verified scan: the record count equals pre-tear records plus the salvage record.
- The salvage record appears as a verified ledger record; quarantined bytes appear nowhere in the index.
- The index remains disposable: deleting it again and reading once more reproduces the same result.
- No read of the salvaged store reports torn.

---

#### TC-GH222-015 - Append under injected exhaustion is fail-closed

**Scenario Type**: Negative
**Impact Level**: Critical
**Priority**: Critical
**Related IDs**: F-5, AC-F5-1, NFR-4
**Test Type(s)**: Integration
**Automation Level**: Automated
**Target Layer / Location**: `tests/behaviour/state-storage-exhausted.test.ts` (new)
**Tags**: @backend, @state, @integration, @fail-closed, @fault-injection

**Preconditions**:

- A seeded store with three records and an acquired fence handle.
- The test edge armed at `append-before-flush` (the pre-commit point where a real ENOSPC surfaces).

**Steps**:

1. Snapshot the ledger bytes and the verified record count.
2. Attempt an append of a valid record.
3. Assert the failure code, consequence, remediation, and location.
4. Re-snapshot the ledger bytes; perform a verified read.
5. Disarm the fault and retry the same append.

**Expected Outcome**:

- The append fails `state.storage.exhausted` with consequence `not_landed`, a remediation naming storage exhaustion, and a safe location; it is not reported as `state.write.failed`.
- The ledger is byte-identical: no partial frame, no trailing garbage, still verifies with the same record count and same last sequence.
- The read confirms the last valid frame; the retry after disarm lands exactly one record at the next sequence.
- `edge.raised` records the armed point (the injection actually fired).

---

#### TC-GH222-016 - Derived-document replace under exhaustion keeps the previous version

**Scenario Type**: Negative
**Impact Level**: Critical
**Priority**: Critical
**Related IDs**: F-5, AC-F5-1, NFR-4
**Test Type(s)**: Integration
**Automation Level**: Automated
**Target Layer / Location**: `tests/behaviour/state-storage-exhausted.test.ts` (new)
**Tags**: @backend, @state, @integration, @fail-closed, @documents

**Preconditions**:

- A store with a derived document at version 1 (bytes captured).
- Three fixtures, each armed at one pre-commit replace point: `replace-before-temp`, `replace-after-temp-write`, `replace-rename`.
- A fourth fixture where the target document does not exist yet.

**Steps**:

1. Attempt to replace the document with version 2 under each armed fault.
2. Assert the failure code and consequence.
3. Read the target document bytes; list the documents directory.
4. For the absent-target fixture, assert the target is still absent.
5. Disarm and retry; assert version 2 lands atomically.

**Expected Outcome**:

- Every attempt fails `state.storage.exhausted` with `not_landed` and storage-exhaustion remediation.
- The target remains exactly version 1 (byte-identical) in all three fixtures; the absent target stays absent.
- No partial document is observable: any temporary is absent or excluded from served documents, and a document read never returns truncated content.
- The retry lands version 2 in one atomic step; the ledger is unchanged by a document replace except for any ledger-first record the contract requires.
- The `replace-after-rename` point is **not** used as a disk-full model (see §8.2 ASM-3).

---

#### TC-GH222-017 - Salvage write under exhaustion leaves the ledger unchanged

**Scenario Type**: Negative
**Impact Level**: Critical
**Priority**: Critical
**Related IDs**: F-5, AC-F5-1, NFR-4, DM-2
**Test Type(s)**: Integration
**Automation Level**: Automated
**Target Layer / Location**: `tests/behaviour/state-storage-exhausted.test.ts` (new)
**Tags**: @backend, @state, @integration, @salvage, @fail-closed, @fault-injection

**Preconditions**:

- A store with a planted terminal tear and a captured whole-ledger byte digest.
- Two fixtures armed at the salvage write steps: `salvage-quarantine-write` (quarantine persistence) and `salvage-ledger-write` (the ledger commit that truncates and appends the salvage record). Both are pre-commit points.

**Steps**:

1. Invoke salvage under each armed fault.
2. Assert the failure code, consequence, and location.
3. Compare the whole-ledger byte digest with the pre-salvage digest; inspect the store directory for salvage records and quarantine artifacts.
4. Disarm and retry salvage; assert one salvage record and exactly one quarantine artifact.

**Expected Outcome**:

- Exhaustion at either step fails `state.storage.exhausted` with `not_landed` and storage-exhaustion remediation.
- The ledger is byte-identical: still torn at the same position, no salvage record, no partial frame, no truncation.
- No partially written quarantine artifact is presented as evidence; the quarantine extent reported earlier is never claimed for this failed attempt.
- The retry produces exactly one salvage record and one quarantine artifact whose bytes equal the original post-tear tail (no duplicated or truncated quarantine).
- A non-exhaustion quarantine-preservation failure remains `state.write.failed` with the ledger unchanged (DEC-5 case 3), asserted with a seeded write error that is not ENOSPC-like.

**Notes / Clarifications**:

- Requires the salvage fault points to exist in `StateEdgeFaultPoint`; `edge.ts` permits delivery to add points. See §8.2 ASM-2 and §8.3 OQ-T1.

---

#### TC-GH222-018 - Both error tables declare the new rows; sync check passes with zero drift

**Scenario Type**: Contract
**Impact Level**: Critical
**Priority**: Critical
**Related IDs**: F-5, F-1, AC-F5-2, NFR-6
**Test Type(s)**: Contract
**Automation Level**: Automated
**Target Layer / Location**: `tests/checks/error-table-sync.test.ts` and `tests/structure/error-table.test.ts` (extend); trigger sweep in `tests/behaviour/state-error-classification.test.ts` (extend)
**Tags**: @backend, @contract, @error-table

**Preconditions**:

- The machine table `ERROR_TABLE` in `packages/core/src/contracts/error-table.ts`.
- The documented table in `doc/spec/features/feature-result-contract.md`.

**Steps**:

1. Assert `state.storage.exhausted` and `state.store.unknown` exist in `ERROR_TABLE` with kind `state`, consequence `not_landed`, and the other required row fields; assert `state.storage.exhausted` is transient/retryable and its remediation names storage exhaustion.
2. Assert the documented table contains both rows with identical kind, category, retryable, consequence, remediation, evidence, and summary fields.
3. Assert the refined `state.write.failed` remediation matches in both tables and no longer claims storage exhaustion (carve-out per DEC-5), while its `not_landed` semantics are unchanged.
4. Run the binding sync check `bun run scripts/checks/error-table-sync.ts`; assert exit 0 and zero drift.
5. Drive each of the nine state codes through its real trigger (extending the existing trigger sweep) and assert every one is classified with `not_landed` and evidence containing neither payload nor checksum bytes.

**Expected Outcome**:

- Exactly nine `state` rows; the two new rows and the refined row are identical across both tables.
- The bidirectional sync check passes with exit 0 and reports no drift.
- Every code remains triggerable and classified; none is a table-only identity.
- No other row's identity, category, or consequence changed (backward compatibility, spec §8.5).

---

#### TC-GH222-019 - Error-table sync is non-vacuous for the new and refined rows

**Scenario Type**: Contract
**Impact Level**: Important
**Priority**: High
**Related IDs**: F-5, AC-F5-2, NFR-6
**Test Type(s)**: Contract
**Automation Level**: Automated
**Target Layer / Location**: `tests/checks/error-table-sync.test.ts` (extend the existing temp-copy mutation pattern)
**Tags**: @backend, @contract, @error-table, @negative-control

**Preconditions**:

- A temp copy of the contracts, CLI classifier sources, result fixtures, and the documented table (existing helper in the suite); the live tree is never written.

**Steps**:

1. Remove the `state.store.unknown` row from the documented table only; run the check.
2. Remove the `state.storage.exhausted` row from the machine table only; run the check.
3. Change the refined `state.write.failed` remediation in one table only; run the check.
4. Insert a phantom `state.store.unknown-schema` row in the documented table only; run the check.
5. Restore each mutation and confirm the check passes again.

**Expected Outcome**:

- Every mutation fails the check with a non-zero exit and names the offending code/field; no mutation passes silently.
- The failure messages identify the direction of the drift (machine-only vs documented-only), proving bidirectionality for the new rows.
- The unmutated baseline passes, so the negative controls are meaningful in this change.
- No temp root or live file is left modified.

---

#### TC-GH222-020 - Artifact-boundary verdict matrix: valid, verified-empty, torn, unknown

**Scenario Type**: Contract
**Impact Level**: Important
**Priority**: High
**Related IDs**: F-6, F-1, AC-F1-1, AC-F6-1, DM-4, NFR-1
**Test Type(s)**: Unit, Integration
**Automation Level**: Automated
**Target Layer / Location**: `tests/behaviour/state-artifact-boundary.test.ts` (new)
**Tags**: @backend, @state, @contract, @artifact-boundary

**Preconditions**:

- The reusable artifact-boundary contract declarations delivered by this change (schema, record identity, classification behaviour) for at least one artifact kind.
- Fixtures for the four verdicts over that kind: conforming record, absent/empty artifact set, torn ledger, undeclared kind/payload schema.

**Steps**:

1. Exercise each verdict through the boundary.
2. Assert result shape and classification per verdict, and pairwise distinctness.
3. Assert the declaration is reusable data (applied to a second, differently named kind without code changes).

**Expected Outcome**:

- Valid → verified values with evidence; verified-empty → explicit empty evidence satisfying only an empty key-set declaration; torn → classified `state.store.torn` with path/position/guidance; undeclared → `state.store.unknown` with guidance.
- No verdict returns a default or zero; no verdict is conflated with another.
- The same declaration mechanism validates a second kind, proving the contract is reusable by the retro registry and ceremony artifacts.
- The suite imports no retro or ceremony runtime module (contract only).

---

#### TC-GH222-021 - Retro-registry stand-in kind: schema violation and unknown kind classified

**Scenario Type**: Negative
**Impact Level**: Important
**Priority**: High
**Related IDs**: F-6, F-1, AC-F6-1, AC-F1-1, DM-4, NFR-1
**Test Type(s)**: Integration
**Automation Level**: Automated
**Target Layer / Location**: `tests/behaviour/state-artifact-boundary.test.ts` (new)
**Tags**: @backend, @state, @integration, @artifact-boundary, @retro-standin

**Preconditions**:

- An artifact kind declared to stand in for the future retro registry, with a required-field payload schema and a declared record identity.

**Steps**:

1. Write a conforming artifact, read it back, and compare values exactly (including a falsy field).
2. Attempt a write missing a required field and a write with a wrong-typed field.
3. Seed a store containing an undeclared kind at this boundary and read it.
4. Snapshot the ledger/documents digest before the refused writes.

**Expected Outcome**:

- The conforming artifact round-trips exactly; no default substitution for falsy fields.
- Nonconforming writes fail classified (`state.store.unknown`) with `not_landed`, and the digest is unchanged.
- The undeclared kind read fails `state.store.unknown` with path/position/guidance — never an empty list or zeroed registry.
- No retro pipeline behaviour is exercised: no retro stage, fold, or scheduler is invoked or required.

---

#### TC-GH222-022 - Ceremony-artifact stand-in kind: malformed and unknown artifacts classified

**Scenario Type**: Negative
**Impact Level**: Important
**Priority**: High
**Related IDs**: F-6, F-1, AC-F6-1, AC-F1-1, DM-4, NFR-1
**Test Type(s)**: Integration
**Automation Level**: Automated
**Target Layer / Location**: `tests/behaviour/state-artifact-boundary.test.ts` (new)
**Tags**: @backend, @state, @integration, @artifact-boundary, @ceremony-standin

**Preconditions**:

- An artifact kind declared to stand in for future ceremony artifacts, with a closed vocabulary field (e.g. artifact status) and a required artifact identity.
- Fixtures: malformed JSON artifact, artifact with a vocabulary value outside the declared set, artifact missing identity, and an undeclared sibling kind.

**Steps**:

1. Write a malformed artifact through the boundary; assert refusal and digest stability.
2. Seed and read each malformed fixture through the boundary.
3. Assert classification and evidence for each, including the position/path and guidance.

**Expected Outcome**:

- Malformed JSON, out-of-vocabulary values, and missing identity are classified failures (`state.store.torn` for unparseable bytes, `state.store.unknown` for schema/vocabulary violations at the boundary) — never a silently empty artifact list.
- No partial artifact is admitted; refused writes leave the ledger/documents unchanged.
- The undeclared sibling kind classifies as unknown rather than being ignored.
- No ceremony runner behaviour is exercised or required.

**Notes / Clarifications**:

- Exact code split between torn (bytes unparseable) and unknown (parses but violates the declared schema) must match TC-GH222-004 and TC-GH222-020; all three cases share one classification table asserted once.

---

#### TC-GH222-023 - Delivery registry verified reads and torn classification preserved

**Scenario Type**: Regression
**Impact Level**: Critical
**Priority**: Critical
**Related IDs**: F-1, F-2, AC-F1-1, AC-F2-1, NFR-1
**Test Type(s)**: Integration
**Automation Level**: Automated
**Target Layer / Location**: `tests/behaviour/phase-registry.test.ts` (extend)
**Tags**: @backend, @state, @integration, @delivery-registry, @regression

**Preconditions**:

- The delivery registry consumer over the state port (`phase.transition` records, one store-scoped key per change, pure fold, derived `phase-state.<REF>.json`).
- A valid seeded registry store; a torn store fixture; a store with an absent per-change record.

**Steps**:

1. On the valid store, read transition history, append a transition, fold the projection, and replace the derived document; assert values, evidence counts, and that no rebuild/repair report appears spuriously.
2. On the torn store, perform `readChangeTransitions` and the presence-tolerant variant; assert classification.
3. On the store with an absent per-change record, assert explicit no-evidence (`present: false`), distinct from torn.
4. Assert a read of the torn store does not produce or replace `phase-state.<REF>.json`.

**Expected Outcome**:

- Valid-store behaviour is unchanged: history folds exactly, the derived projection is rebuildable, evidence counts are stable, and falsy/empty values are not defaulted.
- A torn store yields a classified torn failure with path/position/guidance; it never yields an empty transition history and never `present: false`.
- Absent remains explicit no-evidence; torn ≠ absent and torn ≠ empty.
- No read mutates the ledger or the derived documents; the tolerant read keeps its presence tolerance without swallowing torn classification.

**Postconditions**:

- Temp roots removed.

## 6. Environments and Test Data

- **Runtime**: Bun (pinned by `.bun-version`) running `bun test`; Node 24 probe unaffected. No external services, no network, no real state directory.
- **Directories**: every store lives under a per-test `mkdtempSync` root; teardown removes the root recursively. Root labels follow the existing `gh174-<label>-` convention so a leaked root is identifiable.
- **Fixtures**: generated per run from a seed function (records with deterministic sequences and checksums), never committed as live stores. The shared harness `tests/fixtures/state/harness.ts` supplies `createTestEdge` (armed/raised fault points and a mutable clock), `makeIdentity`/`openStore`/`withinFence`, `ledgerText`/`ledgerPath`, the independent FNV-1a oracle, and `digestPaths`. This change adds helpers for: ledger-prefix digests, quarantine path resolution, tail-byte capture, and salvage invocation. Helpers stay in the fixture file (never `*.test.ts`) so Bun does not discover them as suites.
- **Fault injection**: only named `StateEdgeFaultPoint` values are used; tests assert both the failure outcome and that the point was actually raised, so a typo in a point name fails loudly instead of vacuously passing.
- **SQLite binding**: indexed cases use the existing availability guard (`indexAvailable()`), which reports an explicit skip when no built-in binding exists (TDR-0004). A skip is recorded in the execution log; it never counts as a pass.
- **Platform**: permission assertions are POSIX-only with an explicit platform conditional; no Linux run claims Windows ACL verification (matches the state-layer's recorded contract).
- **Isolation**: no test writes the repository tree, the user state directory, or the live ledger; mutation-style contract tests copy into a temp root first.

## 7. Automation Plan and Implementation Mapping

| TC ID | Test file | Command | Implementation status |
|-------|-----------|---------|-----------------------|
| TC-GH222-001 | `tests/behaviour/state-torn.test.ts` | `bun test tests/behaviour/state-torn.test.ts` | Existing – Update |
| TC-GH222-002 | `tests/behaviour/state-torn.test.ts` | same | Existing – Update |
| TC-GH222-003 | `tests/behaviour/state-torn.test.ts` (+ pure ledger case) | same | Existing – Update |
| TC-GH222-004 | `tests/behaviour/state-unknown.test.ts` | `bun test tests/behaviour/state-unknown.test.ts` | New |
| TC-GH222-005 | `tests/behaviour/state-evidence.test.ts` | `bun test tests/behaviour/state-evidence.test.ts` | Existing – Update |
| TC-GH222-006 | `tests/behaviour/state-boundary-validation.test.ts` | `bun test tests/behaviour/state-boundary-validation.test.ts` | New |
| TC-GH222-007 | `tests/behaviour/state-salvage.test.ts` | `bun test tests/behaviour/state-salvage.test.ts` | New |
| TC-GH222-008 | `tests/behaviour/state-salvage.test.ts` | same | New |
| TC-GH222-009 | `tests/behaviour/state-salvage.test.ts` | same | New |
| TC-GH222-010 | `tests/behaviour/state-salvage-invariants.test.ts` | `bun test tests/behaviour/state-salvage-invariants.test.ts` | New |
| TC-GH222-011 | `tests/behaviour/state-salvage-invariants.test.ts` | same | New |
| TC-GH222-012 | `tests/behaviour/state-index.test.ts` | `bun test tests/behaviour/state-index.test.ts` | Existing – Update |
| TC-GH222-013 | `tests/behaviour/state-index.test.ts` | same | Existing – Update |
| TC-GH222-014 | `tests/behaviour/state-index-post-salvage.test.ts` | `bun test tests/behaviour/state-index-post-salvage.test.ts` | New |
| TC-GH222-015 | `tests/behaviour/state-storage-exhausted.test.ts` | `bun test tests/behaviour/state-storage-exhausted.test.ts` | New |
| TC-GH222-016 | `tests/behaviour/state-storage-exhausted.test.ts` | same | New |
| TC-GH222-017 | `tests/behaviour/state-storage-exhausted.test.ts` | same | New |
| TC-GH222-018 | `tests/checks/error-table-sync.test.ts`, `tests/structure/error-table.test.ts`, `tests/behaviour/state-error-classification.test.ts` | `bun test tests/checks/error-table-sync.test.ts tests/structure/error-table.test.ts tests/behaviour/state-error-classification.test.ts` | Existing – Update |
| TC-GH222-019 | `tests/checks/error-table-sync.test.ts` | `bun test tests/checks/error-table-sync.test.ts` | Existing – Update |
| TC-GH222-020 | `tests/behaviour/state-artifact-boundary.test.ts` | `bun test tests/behaviour/state-artifact-boundary.test.ts` | New |
| TC-GH222-021 | `tests/behaviour/state-artifact-boundary.test.ts` | same | New |
| TC-GH222-022 | `tests/behaviour/state-artifact-boundary.test.ts` | same | New |
| TC-GH222-023 | `tests/behaviour/phase-registry.test.ts` | `bun test tests/behaviour/phase-registry.test.ts` | Existing – Update |

Companion suites touched by new modules/exports but carrying no new case IDs:

| Suite | Role |
|-------|------|
| `tests/structure/state-contract.test.ts` | Contract exports remain data-only and runtime-neutral; update the expected surface for new artifact/evidence types. |
| `tests/structure/state-imports.test.ts`, `tests/structure/state-scope.test.ts` | State tier imports contracts/own modules only; runtime APIs stay in the driver edge; consumers stay in the documented set. |
| `tests/checks/packed-state.test.ts` | Packed `core/state` subpath probe still imports and runs under Node and Bun. |
| `tests/boundaries` | No new package/subpath edge; run when any import or `workspaceImports` entry changes. |
| `tests/behaviour/state-keys.test.ts`, `tests/behaviour/state-fence.test.ts`, `tests/behaviour/state-atomic-replace.test.ts`, `tests/behaviour/state-permissions.test.ts` | M0-S5 regressions; expected to pass unchanged (falsy exactness, fence contention `state.lock.busy` for salvage writes, atomic replace, permissions). |

Fixture/corpus updates required by the new codes (no new TC ids, but delivery-blocking):

- `tests/fixtures/result/code-corpora/**` — add the two new `state` codes and the refined remediation so the sync check and result-fixture checks stay total.
- `tests/fixtures/state/driver-map.json` and `tests/behaviour/state-conformance.test.ts` — extend only if the conformance matrix enumerates operation names (salvage is a new operation, so an explicit decision is required and recorded in the execution log).
- Any golden envelope fixture that enumerates the seven state codes must gain the two rows; regenerate deliberately (never by blanket rewrite) per the testing-strategy golden rule.

### 7.1 Unit vs integration split

- **Unit (pure)**: TC-GH222-003 (ledger function half), TC-GH222-005 (evidence/verified-empty half), TC-GH222-020 (declaration half). No filesystem; byte strings in, verdicts out.
- **Integration (temp store + injected edge)**: every remaining case.
- **Contract**: TC-GH222-018, TC-GH222-019.

### 7.2 Execution strategy and quality gates

During delivery (fail fast, narrow first):

1. `bun test tests/behaviour/state-torn.test.ts tests/behaviour/state-unknown.test.ts tests/behaviour/state-evidence.test.ts tests/behaviour/state-boundary-validation.test.ts`
2. `bun test tests/behaviour/state-salvage.test.ts tests/behaviour/state-salvage-invariants.test.ts`
3. `bun test tests/behaviour/state-storage-exhausted.test.ts`
4. `bun test tests/behaviour/state-index.test.ts tests/behaviour/state-index-post-salvage.test.ts`
5. `bun test tests/checks/error-table-sync.test.ts tests/structure/error-table.test.ts tests/behaviour/state-error-classification.test.ts`
6. `bun test tests/behaviour/state-artifact-boundary.test.ts tests/behaviour/phase-registry.test.ts`

In the `quality_gates` phase (phase 9), the required evidence is:

- **Aggregate gate**: `pnpm check` (lint → format:check → typecheck → test → check:boundaries) — the single completion entry point; all of `bun test` runs inside it.
- **Error-table sync (binding)**: `bun run scripts/checks/error-table-sync.ts` exits 0 with zero drift, plus `bun test tests/checks/error-table-sync.test.ts` (includes TC-GH222-019 negative controls).
- **Full behaviour tier**: `bun test tests/behaviour` (all state suites plus untouched consumers).
- **Boundary/static**: `bun test tests/structure tests/boundaries` (state contracts/imports/scope, no new edges) and `git diff --check`.
- **Packed surface**: `bun test tests/checks/packed-state.test.ts` because new exports land on the `core/state` subpath.
- Any SQLite-binding skip must be recorded in §10 with the reason; a skip is not a pass. Windows ACL behaviour is not claimed by this run.

## 8. Risks, Assumptions, and Open Questions

### 8.1 Risks

| ID | Risk | Impact | Mitigation |
|----|------|--------|------------|
| TR-1 | Salvage/quarantine write steps have no named fault point, so AC-F5-1's salvage-write half cannot be injected deterministically | H | Add pre-commit points (`salvage-quarantine-write`, `salvage-ledger-write`) to `StateEdgeFaultPoint`; `edge.ts` explicitly permits delivery additions. If the injected point cannot be reached, the case fails loudly rather than passing vacuously |
| TR-2 | Salvage ordering leaves an intermediate state (truncated ledger without salvage record) under a mid-operation fault, contradicting `not_landed` | H | TC-GH222-017 asserts whole-ledger byte identity on failure and a clean retry; an intermediate state is a defect, not a test weakness |
| TR-3 | "Post-tear bytes never served" is asserted by searching read outcomes only, missing a hypothetical new read path | M | TC-GH222-009 exercises every documented read surface (`read`, `readRecords`, `checkIntegrity`, registry) and asserts the quarantine path is outside the documents/index namespace; the state-scope/imports structural guard covers new import paths |
| TR-4 | Mid-record vs terminal tear detection is ambiguous for some shapes (e.g. a tear at the exact end-of-file with trailing whitespace) | M | TC-GH222-011 uses an unambiguous non-terminal shape (parseable frames after the break); ambiguous shapes are recorded as a delivery-time clarification, never resolved by relaxing the refusal |
| TR-5 | New codes break existing suites that enumerate the seven state codes, producing noise that hides a real regression | M | TC-GH222-018 deliberately extends the trigger sweep to nine; corpora/goldens updated in the same change and reviewed as deliberate regeneration |
| TR-6 | Permission assertions are POSIX-only; a Windows-breaking change could pass Linux CI | L | Keep the existing platform conditional and state explicitly in evidence that Windows ACL is unverified here (matches the recorded state-layer contract) |

### 8.2 Assumptions

- **ASM-1**: M0-S5 (GH-174) is delivered as specified: the ledger, tear detection, verified-empty, key-set assertions, disposable index, atomic replace, bounded repair, and the seven-row synced error tables with the binding check.
- **ASM-2**: Delivery may add named fault points to `StateEdgeFaultPoint`; the plan requires a pre-commit injection seam for each salvage write step (quarantine persistence, ledger commit) and one for each replace step already named.
- **ASM-3**: Storage exhaustion is modelled only at pre-commit points (`append-before-flush`, `replace-before-temp`, `replace-after-temp-write`, `replace-rename`, and the salvage pre-commit points). A real ENOSPC cannot surface after a successful flush or rename; `append-after-flush`, `replace-after-rename`, and `fence-after-acquire` model post-commit/other failure contracts and are out of AC-F5-1's scope. Using them as "disk-full" would assert an impossible world and force a false `not_landed`.
- **ASM-4**: The raw store port remains kind-agnostic; "undeclared kind" is meaningful only at a validated boundary that declares its kinds. Tests must not turn the store into a closed kind list (spec §8.5).
- **ASM-5**: The salvage record kind and artifact-boundary declarations are additive within `delivery.state.v1`; no test expects a schema-version bump.
- **ASM-6**: The artifact-boundary API's exact symbol names are fixed at delivery; tests bind to behaviour (four verdicts, reusable declaration), and the file/describe names carry the semantics so a rename does not silently drop a case.
- **ASM-7**: This story ships no command surface; no case invokes a CLI for state (spec NG-3, DEC-4).

### 8.3 Open Questions

| ID | Question | Blocking? | Owner / resolution path |
|----|----------|-----------|--------------------------|
| OQ-T1 | Exact names of the salvage write fault points (`salvage-quarantine-write`, `salvage-ledger-write` are proposed). | No — implementation detail; the *requirement* (a pre-commit point per salvage write step) is binding | Delivery plan (`@plan-writer`) fixes names; this test plan is updated in revision if they differ |
| OQ-T2 | Does the conformance matrix (`tests/behaviour/state-conformance.test.ts`) enumerate operations such that the new salvage operation must be added to it, and under which normalized shape? | No — discovered during delivery | `@coder` records the decision in the execution log; if the matrix enumerates operations, add salvage coverage under this plan's TC-GH222-007/008 ids rather than creating new ones |
| OQ-T3 | Is a second salvage invocation on a clean ledger specified (no-op vs classified absent-tear)? | No — outside the nine ACs; not asserted | If it becomes a delivered behaviour, add a new TC-GH222-024 in a revision rather than extending TC-GH222-007 beyond its AC |

No acceptance criterion is untestable as written. Coverage gaps: none.

## 9. Plan Revision Log

| Version | Date | Author | Changes |
|---------|------|--------|---------|
| 1.0 | 2026-11-05 | @test-plan-writer | Initial plan: 23 story-local cases (`TC-GH222-*`) covering all nine ACs (AC-F1-1, AC-F2-1, AC-F3-1..3, AC-F4-1, AC-F5-1..2, AC-F6-1), EVT-1, DM-1..4, NFR-1..7; milestone pack has no S2 scenario, so traceability is recorded here per the pack's coverage rule |

## 10. Test Execution Log

| TC ID | Run Date | Result | Notes |
|-------|----------|--------|-------|
| TC-GH222-001 | 2026-11-05 | PASS | `tests/behaviour/state-torn.test.ts` — framing break and truncated tail classify torn on `read`, `readRecords`, `checkIntegrity`; guidance names the explicit salvage operation; zero byte/listing change. |
| TC-GH222-002 | 2026-11-05 | PASS | Same suite — sequence gap/duplicate/reset classify torn at the first discontinuity; indexed kind classifies identically. |
| TC-GH222-003 | 2026-11-05 | PASS | Same suite — checksum mismatch classified by the pure `verifyLedger` (position 1) and the port; no checksum bytes echoed. |
| TC-GH222-004 | 2026-11-05 | PASS | `tests/behaviour/state-unknown.test.ts` — undeclared kind/schema → `state.store.unknown`; version mismatch stays `state.schema.mismatch`; verified-empty distinct; raw port kind-agnostic. |
| TC-GH222-005 | 2026-11-05 | PASS | `tests/behaviour/state-evidence.test.ts` — path/position-only evidence, verified-empty vs torn distinct, falsy exactness, non-empty key-set against an absent store. |
| TC-GH222-006 | 2026-11-05 | PASS | `tests/behaviour/state-boundary-validation.test.ts` — three refusal classes `not_landed`, ledger byte-identical, no default filled. |
| TC-GH222-007 | 2026-11-05 | PASS | `tests/behaviour/state-salvage.test.ts` — truncate + salvage record + quarantine + evidence; index not touched. |
| TC-GH222-008 | 2026-11-05 | PASS | Same suite — byte-identical valid prefix, exact falsy values, salvage record additive, prefix reproducible. |
| TC-GH222-009 | 2026-11-05 | PASS | Same suite — quarantine bytes equal the original tail, extent matches, no read serves the canary, POSIX `0600`, foreign-permission fixture detected. |
| TC-GH222-010 | 2026-11-05 | PASS | `tests/behaviour/state-salvage-invariants.test.ts` — ledger + directory digests unchanged across four read paths twice each; no index created; no salvage record. |
| TC-GH222-011 | 2026-11-05 | PASS | Same suite — mid-record tear refuses `state.store.torn` at record 3, whole-ledger byte identity, no quarantine/residue; fence contention `state.lock.busy`. |
| TC-GH222-012 | 2026-11-05 | PASS | `tests/behaviour/state-index.test.ts` — absent (`missing`) and corrupt (`corrupt`) indexes rebuild from the ledger alone and converge with the `jsonl` oracle. |
| TC-GH222-013 | 2026-11-05 | PASS | Same suite — altered/deleted/phantom rows rebuild (`divergent`), converge stably; forced `index-rebuild-write` stays `state.write.failed` with no stale truth. |
| TC-GH222-014 | 2026-11-05 | PASS | `tests/behaviour/state-index-post-salvage.test.ts` — stale/deleted/corrupt indexes over a salvaged ledger converge with the verified scan; quarantine contributes no rows. |
| TC-GH222-015 | 2026-11-05 | PASS | `tests/behaviour/state-storage-exhausted.test.ts` — `append-before-flush` exhaustion fail-closed, ledger byte-identical, retry lands sequence 4. |
| TC-GH222-016 | 2026-11-05 | PASS | Same suite — three pre-commit replace points keep version 1; absent target stays absent; retry lands atomically; temporaries never served. |
| TC-GH222-017 | 2026-11-05 | PASS | Same suite — exhaustion at `salvage-quarantine-write` / `salvage-ledger-write` leaves the ledger byte-identical and still torn; retry yields one record + one artifact; non-ENOSPC stays `state.write.failed`. |
| TC-GH222-018 | 2026-11-05 | PASS | Rows/sync half: `tests/checks/error-table-sync.test.ts` + `tests/structure/error-table.test.ts`; trigger sweep: `tests/behaviour/state-error-classification.test.ts` (nine codes, each `not_landed`, canary-clean). `bun run scripts/checks/error-table-sync.ts` → entries=43 documented=43, exit 0. |
| TC-GH222-019 | 2026-11-05 | PASS | `tests/checks/error-table-sync.test.ts` — four non-vacuity mutations (doc-only drop of `state.store.unknown`, machine-only drop of `state.storage.exhausted`, one-sided refinement edits on both refined rows, phantom `state.store.unknown-schema`) plus restore-and-pass. |
| TC-GH222-020 | 2026-11-05 | PASS | `tests/behaviour/state-artifact-boundary.test.ts` — four distinct verdicts, no defaults, second-kind reuse, no retro/ceremony runtime import. |
| TC-GH222-021 | 2026-11-05 | PASS | Same suite — retro stand-in round-trip incl. falsy fields; missing/wrong-typed/vocabulary writes refused with digest stability; undeclared kind classified. |
| TC-GH222-022 | 2026-11-05 | PASS | Same suite — malformed bytes torn; out-of-vocabulary and missing identity unknown; undeclared sibling unknown; refused writes leave the ledger unchanged. |
| TC-GH222-023 | 2026-11-05 | PASS | `tests/behaviour/phase-registry.test.ts` — valid-store fold/projection/evidence unchanged; torn never empty history or `present: false`; absent per-change record explicit no-evidence; reads mutate nothing. |
| SQLite binding | 2026-11-05 | N/A (no skip) | The `sqlite` kind was available on this runtime (Bun 1.4.4 / Linux x64); no indexed case was skipped. Windows ACL verification is not claimed by this Linux run. |
| Known unrelated failure | 2026-11-05 | FAIL (pre-existing, out of scope) | `tests/behaviour/pm-notes-corpus.test.ts` fails because `chg-GH-222-pm-notes.yaml` at HEAD has a duplicate `completed` key under `phases.specification` (`yaml`: `Map keys must be unique`). The file is PM-owned and outside this change's write scope; recorded for the PM/quality-gates phase. |
