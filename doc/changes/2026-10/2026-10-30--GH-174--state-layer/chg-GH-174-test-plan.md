---
id: chg-GH-174-test-plan
status: Updated
created: 2026-10-30T17:54:23Z
last_updated: 2026-10-30T18:26:41Z
owners: [engineering]
service: delivery-os state layer
labels: [change, planning]
version_impact: minor
summary: "Verify the M0-S5 state layer: one driver-neutral port proven by a parameterized conformance suite over both declared driver kinds; append-only schema-versioned ledger truth; classified detection of all torn-state classes and honest verified-empty evidence; key-set assertions with no default substitution; atomic replace under deterministic crash injection; single-writer fenced contention, staleness and explicit recovery; fail-closed POSIX permissions with a platform-conditional Windows ACL contract; seven exact-code state error rows with bidirectional doc/code sync and not_landed consequence; packed Node/Bun import; and boundary, runtime-confinement, branding, literal and foundation-scope conformance."
links:
  change_spec: ./chg-GH-174-spec.md
  implementation_plan: ./chg-GH-174-plan.md
  testing_strategy: ../../../../.ai/rules/testing-strategy.md
---

# Test Plan - M0-S5: State layer

## 1. Scope and Objectives

This change ships the durable-state substrate every later verification reads through, so the tests must prove seven properties and nothing beyond them: **driver neutrality** (one public port, one conformance suite, identical observable behaviour on both declared driver kinds, and no caller-facing operation or type that discriminates by kind), **ledger truth** (an append-only, schema-versioned JSONL record sequence that is never rewritten in place and can always rebuild derived documents and indexes), **torn-state honesty** (framing, truncation, sequence, checksum and index-divergence failures are detected before any value returns, classified, and never read as zeros), **write discipline** (atomic replace leaves the previous or new version and never partial content; fenced writes admit one writer; stale handles fail; recovery is explicit and reported; failed writes honestly say `not_landed`), **least-privilege storage** (POSIX 0700/0600 applied at creation and enforced fail-closed on open, with a documented platform-conditional Windows ACL contract), **failure identity** (seven exact-code `state` rows round-trip through the result contract, kind-only lookup is ambiguous, and the documented and machine tables cannot drift), and **scope/boundary conformance** (state imports `./contracts` only, runtime APIs live only in `core ./state` driver code, no branding import, injected state directory name, zero product literals, no configuration read, no CLI command, no caller beyond tests).

The tests are deliberately built around the mechanism the specification names as proof: **one driver-neutral conformance suite exercised against both `jsonl` and `sqlite` on the same ledger fixtures**. Driver-specific plumbing is tested only where the drivers genuinely differ — the disposable SQLite index, its divergence/rebuild evidence, and the per-runtime binding support matrix. Torn fixtures and failure controls are non-vacuous by construction: every negative fixture proves that the unverified path would have returned data or succeeded, so a passing test cannot be explained by an inert fixture.

### 1.1 In Scope

- Injected store identity: level, workspace identifier, fence namespace, schema version and concrete paths; determinism and zero branding/configuration derivation (F-1, AC-F1-1, AC-F1-4, DM-1).
- Parameterized conformance suite over both declared driver kinds with parity normalization, plus the public-port no-discrimination assertion (F-1, F-3, AC-F1-2, DM-3, NFR-1).
- Planned levels and classified rejection of unimplemented levels without a local fallback (F-1, AC-F1-3, DEC-4).
- Append-only record envelope, contiguous sequence, checksum, no in-place rewrite, every mutation first a ledger record, and no prune/delete/expiry surface; schema-version mismatch handling (F-2, AC-F2-1, AC-F2-2, DM-2, DM-4, DEC-5, DEC-8).
- SQLite index/ledger divergence detection, rebuild from verified ledger, rebuild evidence, and classified failed rebuild; JSONL scan baseline (F-3, AC-F3-1).
- All torn-state classes and their non-vacuous fixtures; verified-empty versus torn distinction; bounded terminal-tail repair and mid-record refusal (F-4, AC-F4-1, AC-F4-2, AC-F4-3, DM-5, NFR-2).
- Key-set assertions: missing declared keys fail with the missing keys named; present keys return recorded values exactly; no empty/zero/default substitution (F-5, AC-F5-1).
- Atomic derived-document replace under deterministic fault/crash injection at every point between write start and rename, plus stale-temporary handling (F-6, AC-F6-1, NFR-3).
- Fence contention, stale-handle rejection, crash-after-land staleness, explicit reported recovery, and read availability while fenced (F-7, AC-F7-1, AC-F7-2, AC-F7-3, NFR-4).
- POSIX permission application and fail-closed enforcement on Linux; Windows ACL contract behind the same port, platform-conditionally tested and honestly recorded (F-8, AC-F8-1, AC-F8-2, NFR-5, OQ-2).
- Seven exact-code state rows, kind-only ambiguity, containment through `fallback.internal`, `not_landed` on every write-path failure, safe locations without payload content, and bidirectional docs/code sync (F-9, AC-F9-1, AC-F9-2, NFR-3, NFR-6).
- Packed `core` state surface under Node and Bun within the recorded runtime support matrix, with no new package subpaths or unsupported dependencies (F-1, F-3, AC-F9-3, NFR-9).
- Tier, runtime-confinement, branding, forbidden-literal, negative-fixture and foundation-scope conformance: no CLI command, no configuration read, no caller beyond tests (F-10, AC-F10-1, AC-F10-2, NFR-7).

### 1.2 Out of Scope & Known Gaps

- [OUT] Any CLI command, MCP tool or OpenCode surface; any configuration read or layer coupling; any consumer of the port beyond tests (NG-1, NG-2, DEC-9). The port is exercised entirely through tests and only becomes a consumer surface in M0-S6/S8/S10.
- [OUT] Project (shared) and global level implementations, networked fences, multi-host coordination, cloud anything, retention/pruning/compaction, backup/restore, migration tooling, domain record schemas, session-database admin and telemetry emission (NG-2..NG-5).
- [OUT] Changes to the branding seam contract, the bash stack, existing gates, `.opencode/` or `.ados-claude/` (NG-6, NG-7). The existing gates are run, not weakened.
- [OUT] The storage-engine selection details reserved to the TDR: JSONL framing/checksum algorithm, per-runtime SQLite binding and fallback, fence staleness basis, index rebuild trigger, atomic-replace technique and Windows ACL mechanism (OQ-1). Tests bind the observable contracts, not the chosen mechanics.
- [GAP-1 — platform-conditional] **AC-F8-2 (Windows ACL) is not verifiable on the Linux CI matrix.** The spec records the limitation and OQ-2. This plan hard-gates the POSIX half (TC-STATE-016) and makes the Windows half a declared platform-conditional test (TC-STATE-017) with an explicit skip record on Linux; no Linux run may claim Windows verification. Owner-environment verification remains OQ-2, non-blocking for delivery.
- [GAP-2 — metric tension, resolved by spec v1.1 §14] **NFR-9's in-process rule and AC-F9-3's packed Node/Bun import** are reconciled as a scoped single-probe exception: the packed-consumer test necessarily spawns a runtime and is the only spawned test this change licenses. This plan records the tension in §8.3 (OQ-T1, resolved) rather than silently weakening either criterion. The behaviour/contract suites themselves remain in-process and spawn-free.
- [GAP-3 — parity interpretation, resolved by spec v1.1 AC-F1-2] **AC-F1-2's "identical results" is defined over driver-neutral observable fields**, while DM-5 permits an index-rebuild report only for the indexed kind. This plan defines parity over driver-neutral observable fields (success/failure, values, error identity, sequence/checksum outcomes and driver-neutral evidence classes) and asserts driver-specific rebuild evidence separately for `sqlite`. Spec v1.1 AC-F1-2 states the same rule and the DoR confirmed it (§8.3, OQ-T2, resolved); it does not relax the conformance requirement.
- [GAP-4 — test seam dependency] Deterministic crash injection for AC-F6-1 and stale-fence simulation for AC-F7-3 require a test-only fault/lock/clock seam at the state driver's runtime edge. The seam is a testability requirement, not a public port feature; its exact shape follows the TDR (§8.3, OQ-T4/OQ-T5).
- [GAP-5 — plan absent, resolved] The implementation plan now exists at [chg-GH-174-plan.md](./chg-GH-174-plan.md) (v1.1, 2026-10-30T18:30:22Z). This test plan binds behaviour and assertions, not task numbering; the plan's phases map onto these TCs and must not reshape them.

## 2. References

- **Change specification**: [chg-GH-174-spec.md](./chg-GH-174-spec.md) — F-1..F-10, DM-1..DM-5, NFR-1..NFR-9, DEC-1..DEC-10, AC-F1-1..AC-F10-2, §17 ticket-AC mapping, §18 open-PR Definition of Done, Appendix A (torn-state classes), Appendix B (key-set semantics), Appendix C (identity seams).
- **Implementation plan**: [chg-GH-174-plan.md](./chg-GH-174-plan.md) — Phases 1–10, the driver/TDR ordering (TDR-0004 in Phase 1), the test-scenario rollup mapping every TC to a phase, and decision D7 (conformance harness) / D8 (state-tier structure enforcement). TCs are behaviour-bound; the plan maps onto them.
- **Testing strategy**: [.ai/rules/testing-strategy.md](../../../../.ai/rules/testing-strategy.md) — `bun:test`, `tests/{structure,behaviour,checks,boundaries,golden}`, `scripts/checks/*.ts` mutation tests, boundary fixtures and `pnpm check`.
- **TypeScript rules**: [.ai/rules/typescript.md](../../../../.ai/rules/typescript.md) — strict typing, injected time/randomness/environment, runtime-API confinement, `bun:test` authoring and no ambient reads.
- **Authoritative decision**: [ADR-0003 — OSS Tooling Monorepo Structure](../../../decisions/ADR-0003-oss-monorepo-structure.md) — tier matrix, runtime-API allowlist, C-3/C-4, subpath table.
- **Delivery precedent**: [TDR-0003](../../../decisions/TDR-0003-config-parser-schema-and-acquisition.md) — Proposed-TDR-during-delivery pattern adopted by OQ-1; sibling test plans [GH-173](../2026-10-30--GH-173--config-layer/chg-GH-173-test-plan.md) and [GH-172](../2026-10-30--GH-172--result-contract-error-table/chg-GH-172-test-plan.md).
- **Current-truth specs**: [feature-monorepo-scaffold-toolchain.md](../../../spec/features/feature-monorepo-scaffold-toolchain.md) (boundary matrices, runtime confinement, negative-fixture discipline), [feature-branding-seam.md](../../../spec/features/feature-branding-seam.md) (`stateDirectoryName` is injected, never imported), [feature-result-contract.md](../../../spec/features/feature-result-contract.md) (error table and binding sync check), [feature-config-layer.md](../../../spec/features/feature-config-layer.md) (multi-row-kind exact-code precedent).
- **Existing mechanisms to reuse**: `tests/boundaries/{harness.ts,fixtures/cases.ts,fixture-registry.json,fixture-coverage.test.ts}` (production-resolution-mirroring manifests), `scripts/checks/error-table-sync.ts` + `tests/checks/error-table-sync.test.ts`, `scripts/checks/ambient-globals.ts`, `scripts/checks/forbidden-literals.ts` + registry, `scripts/checks/workspace-entrypoints.ts`, `tests/checks/packed-config.test.ts` (packed-tarball consumer pattern), `tests/structure/config-imports.test.ts` (tier-import AST detector with synthetic control).
- **Ticket**: GH-174 — M0-S5: State layer (goal, tasks, ACs; verbatim per backlog M0-S5).

## 3. Coverage Overview

### 3.1 Functional Coverage (F-#, AC-#)

| AC ID | Criterion (abbreviated) | TC ID(s) | Status |
|-------|--------------------------|----------|--------|
| AC-F1-1 | Injected identity supplies every name/path; no branding import, no config read; identical inputs yield identical identity | TC-STATE-001 | Covered |
| AC-F1-2 | Same ledger fixture passes every conformance case identically on both driver kinds; no caller-facing operation/type discriminates by kind | TC-STATE-002 | Covered |
| AC-F1-3 | `project`/`global` requests fail `state.level.unsupported`; no silent local substitution; `local` opens normally | TC-STATE-003 | Covered |
| AC-F1-4 | Two workspace identifiers sharing one state directory cannot observe each other's records | TC-STATE-004 | Covered |
| AC-F2-1 | Appends land with schema version, kind, key, contiguous sequence, checksum; append-only order with no in-place rewrite | TC-STATE-005 | Covered |
| AC-F2-2 | Unsupported store/record schema version fails `state.schema.mismatch`, returns no payload values, never coerces | TC-STATE-006 | Covered |
| AC-F3-1 | Independent index corruption/deletion is detected; index rebuilds from verified ledger or the read fails classified (rebuild storage I/O failure → exactly `state.write.failed`, transient/retryable, `not_landed`); rebuild is reported; values equal ledger truth | TC-STATE-007, TC-STATE-024 | Covered |
| AC-F4-1 | Every injected torn class is detected as `state.store.torn` with safe location; no value from unverified bytes; no negative control passes silently | TC-STATE-008, TC-STATE-024 | Covered |
| AC-F4-2 | Absent store yields explicit verified-empty evidence; torn store fails classified; the two are never conflated | TC-STATE-009, TC-STATE-024 | Covered |
| AC-F4-3 | Terminal truncation is repaired with report and intact survivors; mid-record corruption refuses repair under `state.store.torn` and changes nothing | TC-STATE-010, TC-STATE-024 | Covered |
| AC-F5-1 | Missing declared key fails `state.keys.missing` naming the keys; present keys return recorded values exactly; no default substitution | TC-STATE-011 | Covered |
| AC-F6-1 | Failure/crash injected between write start and rename leaves previous or new target content, never partial; failed replace reports `not_landed` | TC-STATE-012 | Covered |
| AC-F7-1 | Second fence acquisition fails `state.lock.busy` (transient, retryable); no concurrent double-write lands | TC-STATE-013 | Covered |
| AC-F7-2 | Writes through a released/recovered/lost handle fail `state.lock.busy`; recovery is explicit and reported, never a silent steal; reads stay available | TC-STATE-014 | Covered |
| AC-F7-3 | Crash after append before release leaves a detectably stale fence; landed record verifies; writes fail until explicit recovery; recovery is reported | TC-STATE-015, TC-STATE-024 | Covered |
| AC-F8-1 | Creation applies POSIX 0700 directory / 0600 files; an existing violation fails `state.permission.denied` and never continues permissively | TC-STATE-016 | Covered |
| AC-F8-2 | Windows ACL-equivalent restricts access to the current user behind the same port; platform-conditional tests; Linux CI limit recorded | TC-STATE-017 | Covered — conditional on a Windows host; Linux records the limitation (GAP-1/OQ-2) |
| AC-F9-1 | Seven `(kind=state, code)` identities round-trip with declared fields; kind-only `state` is ambiguous; wrong/missing/mismatched codes contain via `fallback.internal`; bidirectional drift fails sync | TC-STATE-018, TC-STATE-019 | Covered |
| AC-F9-2 | Every write-path failure has consequence `not_landed`; no read-path failure claims a landed mutation; locations name paths/positions and never payload content | TC-STATE-020 | Covered |
| AC-F9-3 | Packed `core` state surface imports under Node and Bun without new subpaths, ambient reads or unsupported dependencies; both drivers load per recorded matrix | TC-STATE-021 | Covered |
| AC-F10-1 | State imports `./contracts` only; runtime APIs only in state driver code; adapters cannot import `core ./state`; surfaces may; zero product literals; new forbidden rules ship failing fixtures | TC-STATE-022, TC-REVIEW-001 | Covered |
| AC-F10-2 | No CLI command, no config read, no caller beyond tests; the port is fully exercisable through tests and ready for M0-S6/S8/S10 | TC-STATE-023, TC-REVIEW-001 | Covered |

**Capability coverage** (no capability left unlinked): F-1 → TC-STATE-001, TC-STATE-002, TC-STATE-003, TC-STATE-004, TC-STATE-021; F-2 → TC-STATE-005, TC-STATE-006, TC-STATE-012; F-3 → TC-STATE-002, TC-STATE-007, TC-STATE-021; F-4 → TC-STATE-007, TC-STATE-008, TC-STATE-009, TC-STATE-010, TC-STATE-024; F-5 → TC-STATE-009, TC-STATE-011; F-6 → TC-STATE-012; F-7 → TC-STATE-013, TC-STATE-014, TC-STATE-015; F-8 → TC-STATE-016, TC-STATE-017; F-9 → TC-STATE-006, TC-STATE-008, TC-STATE-011, TC-STATE-018, TC-STATE-019, TC-STATE-020; F-10 → TC-STATE-022, TC-STATE-023, TC-REVIEW-001.

**TC → AC traceability**: the reverse direction is the AC column of the Scenario Index (§5.1) and the `Related IDs` line of every scenario (§5.2); the AC → TC direction is the table above. Both directions are derived from the spec's §17 AC map and link every TC to at least one AC.

**Ticket AC coverage** (spec §17 mapping, both ticket ACs):

| Ticket AC | Verified by | Notes |
|-----------|-------------|-------|
| Ticket AC-1 — torn state detected and reported, never silently read as zeros | TC-STATE-006, TC-STATE-008, TC-STATE-009, TC-STATE-010, TC-STATE-011, TC-STATE-024 | Detection, verified-empty distinction, repair, key-set refusal and evidence safety together prove the ticket's headline guarantee. |
| Ticket AC-2 — the abstraction has no implementation-dependent call sites | TC-STATE-002, TC-STATE-007, TC-STATE-021, TC-STATE-022 | Conformance parity, driver-specific plumbing confined to the index path, packed import and boundary/runtime confinement prove call-site neutrality. |

### 3.2 Interface Coverage (API-#, EVT-#, DM-#)

No REST/HTTP endpoints and no events/messages exist in this change (spec §8.1, §8.2). Read/write evidence is invocation-scoped result data, not an event.

| Interface ID | Description | TC ID(s) | Status |
|--------------|-------------|----------|--------|
| DM-1 | Store identity: injected level, workspace identifier, fence namespace, schema version, concrete paths; no derivation in the state tier | TC-STATE-001, TC-STATE-003, TC-STATE-004 | Covered |
| DM-2 | State record envelope: schema version, record kind, key, contiguous sequence, checksum, JSON-compatible payload; append-only; every mutation first a record | TC-STATE-005, TC-STATE-006, TC-STATE-008, TC-STATE-012 | Covered |
| DM-3 | Driver-neutral store port: open, append, read with key-set assertion, atomic replace, fence acquire/release/recover, integrity check, torn-tail repair | TC-STATE-002, TC-STATE-003, TC-STATE-005, TC-STATE-011, TC-STATE-012, TC-STATE-013, TC-STATE-014, TC-STATE-015 | Covered |
| DM-4 | State schema version (`delivery.state.v1` at v1), carried by store and records; unsupported versions fail classified | TC-STATE-005, TC-STATE-006 | Covered |
| DM-5 | Read/integrity evidence: verification classes, verified-empty marker, rebuild report, repair report, recovery report; paths/positions only | TC-STATE-007, TC-STATE-008, TC-STATE-009, TC-STATE-010, TC-STATE-015, TC-STATE-024 | Covered |

### 3.3 Non-Functional Coverage (NFR-#)

| NFR ID | Requirement | TC ID(s) | Status |
|--------|-------------|----------|--------|
| NFR-1 | Driver neutrality: 0 implementation-dependent call sites; 0 port operations/types discriminating by kind; 100% conformance parity | TC-STATE-001, TC-STATE-002, TC-STATE-021, TC-STATE-022 | Covered |
| NFR-2 | Torn detection: 5/5 classes; 0 unverified-value reads; 0 silent-zero reads | TC-STATE-007, TC-STATE-008, TC-STATE-009, TC-STATE-010, TC-STATE-024 | Covered — the four ledger classes plus the index/ledger-divergence class, asserted solely by TC-STATE-007 |
| NFR-3 | Atomicity: 0 partial target states; 100% of write failures report `not_landed` | TC-STATE-012, TC-STATE-020 | Covered |
| NFR-4 | Single-writer: 0 double-writes; 0 silent steals; 100% of contention classified `state.lock.busy` | TC-STATE-013, TC-STATE-014, TC-STATE-015 | Covered |
| NFR-5 | Permissions: 100% POSIX matrix applied; 0 permissive continuations; ACL contract delivered and platform-conditionally tested | TC-STATE-016, TC-STATE-017 | Covered — Windows half conditional (GAP-1/OQ-2) |
| NFR-6 | Error alignment: 7/7 exact rows; 0 sync drift; 100% containment of bad codes; 0 ambiguous first-row selections | TC-STATE-018, TC-STATE-019 | Covered |
| NFR-7 | Boundaries/branding: 0 state-tier imports outside `./contracts`; 0 runtime APIs outside driver code; 0 branding/literals; 0 unenforced new rules | TC-STATE-001, TC-STATE-022, TC-STATE-023, TC-REVIEW-001 | Covered |
| NFR-8 | Schema versioning: 100% records/store carry the version; unsupported fixtures fail `state.schema.mismatch`; 0 store artifacts without a version | TC-STATE-005, TC-STATE-006 | Covered |
| NFR-9 | Runtime/regression safety: packed Node/Bun consumption; 0 gate regressions; 0 tests requiring a spawned process or ambient environment | TC-STATE-021, TC-STATE-022, TC-STATE-023, TC-REVIEW-001 | Covered, with the AC-F9-3 spawn exception recorded in GAP-2/OQ-T1 |

## 4. Test Types and Layers

| Layer | Runner / invocation | Location | Covers |
|-------|--------------------|----------|--------|
| Port vocabulary, identity and scope structure | `bun test tests/structure` | `tests/structure/state-contract.test.ts` (assumed), `tests/structure/state-scope.test.ts` (assumed) | TC-STATE-001, TC-STATE-003, TC-STATE-005 (shape), TC-STATE-023 |
| Parameterized driver conformance | `bun test tests/behaviour` | `tests/behaviour/state-conformance.test.ts` (assumed) + `tests/fixtures/state/**` (assumed) | TC-STATE-002 |
| Ledger, torn-state, key-set and repair behaviour | `bun test tests/behaviour` | `tests/behaviour/state-ledger.test.ts`, `tests/behaviour/state-torn.test.ts`, `tests/behaviour/state-keys.test.ts` (assumed) | TC-STATE-004, TC-STATE-005, TC-STATE-006, TC-STATE-008, TC-STATE-009, TC-STATE-010, TC-STATE-011 |
| Index divergence/rebuild | `bun test tests/behaviour` | `tests/behaviour/state-index.test.ts` (assumed) | TC-STATE-007, TC-STATE-024 |
| Atomic replace and fence discipline | `bun test tests/behaviour` | `tests/behaviour/state-atomic-replace.test.ts`, `tests/behaviour/state-fence.test.ts` (assumed) | TC-STATE-012, TC-STATE-013, TC-STATE-014, TC-STATE-015 |
| POSIX permissions and ACL contract | `bun test tests/behaviour` | `tests/behaviour/state-permissions.test.ts` (assumed) | TC-STATE-016, TC-STATE-017 |
| Error identity and evidence safety | `bun test tests/behaviour` | `tests/behaviour/state-error-classification.test.ts`, `tests/behaviour/state-evidence.test.ts` (assumed) | TC-STATE-018, TC-STATE-020, TC-STATE-024 |
| Repository invariants and mutation tests | `bun run scripts/checks/*.ts`; `bun test tests/checks` | existing `scripts/checks/error-table-sync.ts` + `tests/checks/error-table-sync.test.ts`; extended fixtures | TC-STATE-019 |
| Packed consumer | `bun test tests/checks` | `tests/checks/packed-state.test.ts` (assumed), extending the packed-tarball pattern | TC-STATE-021 |
| Boundary negative fixtures and fixture coverage | `bun test tests/boundaries`; `pnpm check:boundaries` | existing `tests/boundaries/**` + registry updates | TC-STATE-022 |
| Aggregate and non-regression | `pnpm check`; existing bash/tool suites | repo root; unchanged | TC-STATE-022, TC-STATE-023 |
| Manual independent review | PR review record | — | TC-REVIEW-001 |

### 4.1 Conformance-Suite Contract (binding for AC-F1-2, NFR-1)

The parity proof is one suite, not two parallel suites:

1. **One case set, two driver bindings.** The suite declares cases once (`open`, `append`, `read`, `key-set pass/fail`, `contention`, `torn detection`, `atomic replace`) and instantiates the driver map `{ jsonl, sqlite }` from the public edge factory. Case definitions are data, not per-driver code. The suite asserts the number of cases executed per kind is equal and non-zero.
2. **Identical fixture bytes.** Both kinds consume the same generated ledger fixtures; the suite asserts fixture identity (byte digest) before running the cases, so a driver cannot silently receive a friendlier fixture.
3. **Parity over driver-neutral observables.** The comparison normalizer retains success/failure discriminant, returned values, error `code`/`category`/`retryable`/`consequence`/projection, record sequence/checksum verdicts, and driver-neutral evidence classes (`verified`, `verified-empty`, `torn`, `repaired`, `recovered`). The `sqlite`-only index-rebuild report is excluded from parity and asserted separately in TC-STATE-007; this is the GAP-3 reading, stated by spec v1.1 AC-F1-2 and confirmed at DoR iteration 1.
4. **No caller-facing discrimination.** A structure test asserts the public port's public operations and result types do not take or expose `StateDriverKind` except at the edge factory that selects the driver; call sites in the suite are helper-mediated, not branched on kind. The type-level assertion is supplemented by an AST scan for `kind === "jsonl"` / `"sqlite"` branches in caller-side tests.
5. **Anti-vacuity.** A deliberately divergent fake driver (returns a different value / swallows one failure) must fail parity. A suite that reports zero executed cases or collapses to one kind must fail. Parity is not satisfied by constant output: the suite includes a case whose value differs by input.

### 4.2 Torn-Fixture and Negative-Control Contract (binding for AC-F4-1, AC-F4-3, NFR-2)

Each fixture is generated from a verified intact ledger and then mutated by a named operation; construction asserts the intended mutation is present before the read runs. Every fixture carries a distinctive `planted-payload-*` value in the affected record so that a silent read is externally observable. No fixture may be skipped when its class is unsupported; an inapplicable fixture fails.

| Class | Fixture operation | Read assertion | Non-vacuity control |
|-------|-------------------|----------------|---------------------|
| Truncated tail | Remove the final record's terminating framing/bytes | `state.store.torn`; safe path + position; no payload | The same bytes without the tail check would expose or truncate the planted payload; TC-STATE-010 repairs the tail and proves survivors |
| Framing break | Corrupt one record line so it does not parse | `state.store.torn`; no record values | Intact control reads the planted payload |
| Sequence gap / duplicate / reset | Rewrite one sequence field in each of the three forms | `state.store.torn`; no record values | Constructed mutation is asserted different from the intact sequence before read |
| Checksum mismatch | Flip a payload byte while leaving the recorded checksum | `state.store.torn`; no payload/checksum bytes in error | The flipped payload would be returned if checksum verification were skipped |
| Index/ledger divergence | Delete or corrupt the derived SQLite index independently | Detected; rebuild reported or classified failure; values equal ledger | TC-STATE-007 asserts a stale index would have returned a different value |

Every negative control asserts **detection**, not an empty result: the test would fail if the read returned success, returned the planted payload, or degraded to verified-empty. A mutation copy with a detection check disabled must fail the fixture (the fixture is proven live), then the unmodified implementation must pass it.

### 4.3 Crash-Injection and Fault-Port Contract (binding for AC-F6-1, AC-F7-3)

The state driver exposes a **test-only** injection seam at its runtime edge (file operations, lock backend, clock/staleness source), never on the public port. Production constructs the real edge; tests construct a fault-injectable edge. Faults are deterministic exceptions/barriers, not real process crashes, sleeps or ambient timing.

Named injection points (delivery may add, not remove):

- append: before flush, after flush before fence release;
- replace: before temporary creation, after temporary write/flush before rename, rename throws, after rename before temporary cleanup;
- fence: after acquisition, after recovery, lost/stale handle resolution.

For every point the suite asserts: target observable content is the previous or the new version (never partial); the failure is classified with `consequence: "not_landed"`; a stale temporary is cleaned or reported on next open and never read as content. A **self-test** proves the harness can detect partiality: a temp-copy direct-write implementation must be caught by the same assertion. The suite is deterministic under injected fault ordering and runs in-process.

### 4.4 Permission Matrix Contract (binding for AC-F8-1, AC-F8-2, NFR-5)

- **POSIX hard gate (Linux CI).** Creation is observed with `stat`: the state directory is `0700` and every created store file is `0600`, independent of a permissive umask. A violation is created deliberately (`0755` directory and/or `0644` file); opening must fail `state.permission.denied` and must not create/repair/read permissively. The assertion distinguishes exact bits, not "owner can access".
- **Windows conditional gate.** On `win32`, the same port must apply and verify a current-user-only ACL equivalent, with a violation failing `state.permission.denied`. On non-Windows hosts the test is explicitly skipped with a recorded reason, and a structure assertion confirms the documented platform contract exists. No skipped run is reported as Windows verification (OQ-2).
- **No widening.** No test accepts a widened mode as compensation; the fail-closed control proves the implementation cannot proceed on a hostile mode.

### 4.5 Error-Table Sync Contract (binding for AC-F9-1, NFR-6)

The existing binding check remains the mechanism; this change extends it, not replaces it:

1. `DOMAIN_KINDS` gains `state`; the seven exact codes are declared once in `ERROR_TABLE` and once in the documented table at `doc/spec/features/feature-result-contract.md`, authored in the same change.
2. The check must report non-zero counts for source entries, documented rows, recognized state references and corpus rows, so an empty or unparsed table cannot pass.
3. Drift is tested in both directions: machine-only row/kind removal fails; documentation-only/malformed/duplicate row fails. A code referenced in delivered sources but absent from the table fails.
4. Classification is separate from sync: kind-only `state` lookup is ambiguous at runtime and contains via `fallback.internal`; the sync check does not pick a first row (TC-STATE-018). The two mechanisms together satisfy AC-F9-1.

### 4.6 Evidence-Safety Contract (binding for AC-F9-2, DM-5)

Every failure and every read evidence object is passed through a canary sweep. Allowed content is the store path, the record position/sequence and the declared missing key names (required by AC-F5-1); forbidden content is record payload bytes/values, checksum bytes, environment data outside the path, and untrusted summaries. Each scenario plants a distinctive canary in the corrupted payload and in a failing write, then asserts its absence in raw text, JSON-serialized and escaped forms. A control formatter that includes the payload must be caught.

### 4.7 Boundary and Scope Contract (binding for AC-F10-1, AC-F10-2)

- **Tier imports.** An AST detector (the `config-imports` pattern) scans `packages/core/src/state/**`; only `./contracts` (and its own modules) may be imported. A synthetic source importing branding, config, adapters or `node:` outside the allowed driver edge is flagged by the detector's own control.
- **Runtime confinement.** `dependency-cruiser` retains runtime-API confinement to `core ./state` driver code (plus the existing adapter/surface allowlist); the adapters-may-not-import-`core ./state` rule and the surfaces-may control are exercised by fixtures whose manifests mirror production resolution (GH-170 pattern).
- **Fixture coverage.** Every new forbidden rule ships with a failing fixture and a clean control; the fixture-coverage meta-check fails an unenforced rule. Deleting a fixture must break the meta-check (self-test).
- **Literal and scope.** The forbidden-literal scan covers the new state feature doc registered in the same change; the scope test asserts no state CLI command, no config import, and no state consumer outside `tests/**` and `core ./state` itself, with a seeded-violation control.

## 5. Test Scenarios

### 5.1 Scenario Index

| TC ID | Title | Type | Impact | Priority | AC |
|-------|-------|------|--------|----------|----|
| TC-STATE-001 | Injected identity, zero derivation | Happy Path | Critical | High | AC-F1-1 |
| TC-STATE-002 | Driver conformance parity | Happy Path | Critical | High | AC-F1-2 |
| TC-STATE-003 | Levels and unsupported rejection | Negative | Critical | High | AC-F1-3 |
| TC-STATE-004 | Workspace record scoping | Edge Case | Important | High | AC-F1-4 |
| TC-STATE-005 | Append envelope and append-only order | Happy Path | Critical | High | AC-F2-1 |
| TC-STATE-006 | Schema-version mismatch | Negative | Critical | High | AC-F2-2 |
| TC-STATE-007 | Index divergence and rebuild | Edge Case | Critical | High | AC-F3-1 |
| TC-STATE-008 | Torn-class detection matrix | Negative | Critical | High | AC-F4-1 |
| TC-STATE-009 | Verified-empty versus torn | Corner Case | Critical | High | AC-F4-2 |
| TC-STATE-010 | Terminal repair versus mid-record refusal | Edge Case | Critical | High | AC-F4-3 |
| TC-STATE-011 | Key-set assertion, no defaults | Negative | Critical | High | AC-F5-1 |
| TC-STATE-012 | Atomic replace crash matrix | Negative | Critical | High | AC-F6-1 |
| TC-STATE-013 | Fence contention and double-write prevention | Negative | Critical | High | AC-F7-1 |
| TC-STATE-014 | Stale-handle rejection and exposed recovery | Negative | Critical | High | AC-F7-2 |
| TC-STATE-015 | Crash-after-land stale fence | Negative | Critical | High | AC-F7-3 |
| TC-STATE-016 | POSIX permission matrix and fail-closed | Negative | Critical | High | AC-F8-1 |
| TC-STATE-017 | Windows ACL contract, conditional | Edge Case | Important | Medium | AC-F8-2 |
| TC-STATE-018 | Seven exact state identities and containment | Regression | Critical | High | AC-F9-1 |
| TC-STATE-019 | Bidirectional table synchronization | Regression | Critical | High | AC-F9-1 |
| TC-STATE-020 | Not-landed and safe error locations | Negative | Critical | High | AC-F9-2 |
| TC-STATE-021 | Packed Node/Bun state surface | Regression | Critical | High | AC-F9-3 |
| TC-STATE-022 | Boundary, runtime and literal conformance | Regression | Critical | High | AC-F10-1 |
| TC-STATE-023 | Foundation scope and consumer readiness | Regression | Important | High | AC-F10-2 |
| TC-STATE-024 | Read/write evidence contract | Corner Case | Important | High | AC-F3-1, AC-F4-1, AC-F4-2, AC-F4-3, AC-F7-3 |
| TC-REVIEW-001 | Independent review of proof, TDR and gates | Manual | Critical | High | AC-F10-1, AC-F10-2, NFR-9 |

### 5.2 Scenario Details

#### TC-STATE-001 - Injected identity, zero derivation

**Scenario Type**: Happy Path
**Impact Level**: Critical
**Priority**: High
**Related IDs**: F-1, AC-F1-1, DM-1, NFR-7
**Test Type(s)**: Unit, Contract, Integration
**Automation Level**: Automated
**Target Layer / Location**: `tests/structure/state-contract.test.ts`, `tests/behaviour/state-conformance.test.ts`
**Tags**: @backend

**Preconditions**:

- Two synthetic brand-derived state directories (for example `example-product-state` and `renamed-product-state`), injected workspace/fence identifiers, the `delivery.state.v1` schema version, and concrete paths.
- Ambient reads are stubbed to throw; the branding and configuration modules are available only as import targets for the detector.

**Steps**:

1. Open a store twice from byte-identical injected identity fields; compare the resolved identity, paths and a read result. Repeat with a different workspace identifier, fence namespace, level and directory.
2. Assert the state tier performs no environment, clock, randomness or configuration read during construction or open, and that identity is unchanged when ambient stubs are installed.
3. Run the AST import detector over `packages/core/src/state/**` for branding, config, adapters and Node/Bun APIs outside the driver edge; run the detector's synthetic negative control.
4. Inspect the port/identity types for any name/path default or brand derivation.

**Expected Outcome**:

- Every name and path comes from the injected parameters; identical inputs yield identical identity and paths; different inputs yield different identity.
- No branding import, no configuration read and no ambient read occurs; the synthetic negative control is flagged by the detector.
- No product literal or default state-directory name exists in the state tier.

#### TC-STATE-002 - Driver conformance parity

**Scenario Type**: Happy Path
**Impact Level**: Critical
**Priority**: High
**Related IDs**: F-1, F-3, AC-F1-2, DM-3, NFR-1
**Test Type(s)**: Integration, Contract
**Automation Level**: Automated
**Target Layer / Location**: `tests/behaviour/state-conformance.test.ts`, `tests/fixtures/state/**`
**Tags**: @backend

**Preconditions**:

- One case-definition generator and one ledger-fixture generator; the driver map contains exactly `jsonl` and `sqlite`; a parity normalizer per §4.1.

**Steps**:

1. Generate one ledger fixture and run the identical case set (`open`, `append`, `read`, key-set pass, key-set fail, contention, torn detection, atomic replace) against each driver kind.
2. Assert the fixture digest is identical for both runs and that the executed-case count per kind is equal and non-zero.
3. Compare the normalized observable results field by field; for `sqlite`, additionally assert the index exists and that its rebuild evidence is out of parity scope, covered by TC-STATE-007.
4. Run the AST check for kind-discriminating branches in caller-side tests and the public-port type check for driver discriminants. Run the divergent-fake-driver control.

**Expected Outcome**:

- 100% of conformance cases pass with identical normalized results on both kinds; no caller-facing operation or type discriminates by kind.
- The divergent fake driver fails parity (the assertion is live), and the suite cannot pass with only one kind or zero cases.

#### TC-STATE-003 - Levels and unsupported rejection

**Scenario Type**: Negative
**Impact Level**: Critical
**Priority**: High
**Related IDs**: F-1, AC-F1-3, DEC-4, DM-1
**Test Type(s)**: Unit, Integration
**Automation Level**: Automated
**Target Layer / Location**: `tests/structure/state-contract.test.ts`, `tests/behaviour/state-conformance.test.ts`
**Tags**: @backend

**Preconditions**:

- Port/level vocabulary fixture declaring `local`, `project`, `global`; a fresh temporary state root; a spy/recorder on the runtime edge to detect any local write.

**Steps**:

1. Assert the public level declaration contains all three planned levels and that `local` opens and performs one append/read successfully.
2. Request `project` and `global` opens with otherwise valid identity and paths; assert the result code, category, retryability, consequence and projection.
3. Assert no file or directory was created and no local driver was selected on the rejected paths.
4. Run a control driver that silently substitutes local; assert the suite detects the substitution (non-vacuity).

**Expected Outcome**:

- `local` opens normally; `project` and `global` fail `state.level.unsupported` as user/`not_landed`/exit 1 with the documented hint.
- No local fallback, no writes and no silent substitution occur; the substitution control is detected.

#### TC-STATE-004 - Workspace record scoping

**Scenario Type**: Edge Case
**Impact Level**: Important
**Priority**: High
**Related IDs**: F-1, AC-F1-4, DM-1
**Test Type(s)**: Integration
**Automation Level**: Automated
**Target Layer / Location**: `tests/behaviour/state-ledger.test.ts`
**Tags**: @backend

**Preconditions**:

- One injected state directory shared by two store identities differing only in workspace identifier; both use the same fence namespace and schema version; distinct record keys and payloads.

**Steps**:

1. Open workspace A, append records, close; open workspace B against the same directory and attempt to read the keys declared by A. Assert B does not observe A's records (the keys are absent in B's scope, never A's payloads).
2. Append records in B, then re-open A and read; assert A sees only its own records and sequence.
3. Assert neither workspace observes the other's payloads, keys or sequence state, and that opening the second workspace did not rewrite the first's ledger.
4. Run a scoping-disabled control (identity ignores workspace identifier) and assert the isolation assertion fails.

**Expected Outcome**:

- Records are scoped by workspace identifier; each workspace observes only its own ledger truth.
- The control demonstrates the test would catch cross-workspace visibility.

#### TC-STATE-005 - Append envelope and append-only order

**Scenario Type**: Happy Path
**Impact Level**: Critical
**Priority**: High
**Related IDs**: F-2, AC-F2-1, DM-2, NFR-8
**Test Type(s)**: Unit, Integration
**Automation Level**: Automated
**Target Layer / Location**: `tests/behaviour/state-ledger.test.ts`
**Tags**: @backend

**Preconditions**:

- An acquired fence; a record fixture with JSON-compatible payloads, distinct kinds/keys and a marker value; raw access to the store directory for ledger inspection.

**Steps**:

1. Append several records; inspect every ledger line for schema version, record kind, key, contiguous store-scoped sequence and checksum over the payload; verify each checksum independently.
2. Snapshot the ledger prefix bytes; append more records; assert the earlier prefix is byte-identical and no earlier line was rewritten or reordered.
3. Close and re-open; read the records back and assert sequence continuity and payload equality.
4. Assert the public port exposes no prune, delete, expiry or compaction operation (retention is forever; the only destructive operation is the separate repair path).
5. Run a control that rewrites a previous line in a temp copy; assert the append-only assertion fails.

**Expected Outcome**:

- Every record lands with all five envelope fields and a valid checksum; sequence is contiguous; the ledger is append-only with zero in-place rewrites.
- No prune/delete/expiry surface exists; the rewrite control is detected.

#### TC-STATE-006 - Schema-version mismatch

**Scenario Type**: Negative
**Impact Level**: Critical
**Priority**: High
**Related IDs**: F-2, F-9, AC-F2-2, DM-4, NFR-8
**Test Type(s)**: Integration, Contract
**Automation Level**: Automated
**Target Layer / Location**: `tests/behaviour/state-ledger.test.ts`, `tests/behaviour/state-error-classification.test.ts`
**Tags**: @backend

**Preconditions**:

- A supported store fixture; a store whose header/version declares an unsupported state schema version; a record that individually declares an unsupported version; a supported-version control.

**Steps**:

1. Read the unsupported-store fixture and the unsupported-record fixture; capture the result, error fields and any evidence.
2. Assert the code is `state.schema.mismatch`, no payload values are returned, and no coercion or best-effort interpretation occurs; assert it is distinct from a torn fixture.
3. Read the supported-version control and assert values return normally.
4. Inspect the error/evidence canary sweep for payload content.

**Expected Outcome**:

- Unsupported store and record versions fail `state.schema.mismatch` with zero values and no coercion; supported versions read normally.
- The mismatch is never reported as `state.store.torn` and never degrades to defaults.

#### TC-STATE-007 - Index divergence and rebuild

**Scenario Type**: Edge Case
**Impact Level**: Critical
**Priority**: High
**Related IDs**: F-3, F-4, AC-F3-1, DM-5, NFR-1, NFR-2
**Test Type(s)**: Integration, Contract
**Automation Level**: Automated
**Target Layer / Location**: `tests/behaviour/state-index.test.ts`, `tests/fixtures/state/**`
**Tags**: @backend

**Preconditions**:

- A `sqlite` store with a populated derived index over a verified ledger; the ledger contains values that differ from a deliberately stale index value; a `jsonl` control; an injectable rebuild I/O fault.

**Steps**:

1. Delete the index file, then separately corrupt it, and read through the `sqlite` kind. Assert divergence is detected, the index is rebuilt from the verified ledger, the rebuild is reported in read evidence, and returned values equal ledger truth.
2. Inject a storage I/O failure during the rebuild; assert the read fails exactly `state.write.failed` — category `transient`, `retryable: true`, `consequence: "not_landed"`, projection class 2 (platform-provider) — with no values returned, the ledger bytes unchanged, and no silent stale read. No alternative code satisfies this assertion.
3. Assert the ledger bytes are unchanged by index rebuild and that a `jsonl` read of the same ledger returns the same values without an index.
4. Run a stale-index/ignored-divergence control; assert the test catches the stale value.

**Expected Outcome**:

- Index/ledger divergence is detected; rebuild yields ledger truth and is reported; a failed rebuild fails exactly `state.write.failed` (transient, retryable, `not_landed`), never a stale read.
- Driver-specific index evidence does not leak into the parity comparison; the ledger remains truth.

#### TC-STATE-008 - Torn-class detection matrix

**Scenario Type**: Negative
**Impact Level**: Critical
**Priority**: High
**Related IDs**: F-4, AC-F4-1, NFR-2, Appendix A
**Test Type(s)**: Integration, Contract
**Automation Level**: Automated
**Target Layer / Location**: `tests/behaviour/state-torn.test.ts`, `tests/fixtures/state/torn/**`
**Tags**: @backend

**Preconditions**:

- A verified intact ledger fixture; a fixture builder that performs each named mutation and asserts the mutation is present; each mutated record carries a distinctive `planted-payload-*` canary; intact and detection-disabled controls.

**Steps**:

1. Build and read each ledger fixture: truncated tail; framing break; sequence gap; sequence duplicate; sequence reset; checksum mismatch. Assert each fails `state.store.torn`, with a safe location (path + record position), no returned values, and no negative control passing silently.
2. Assert the fixture builder's mutation precondition (the bytes/sequence differ from the intact fixture) before the read; a no-op fixture must fail construction.
3. For each class, run the canary sweep on error and evidence: the planted payload and checksum bytes must not appear.
4. Run the intact control and assert values return; run the detection-disabled temp-copy control and assert the planted payload would be exposed (proving the fixture is live).

**Expected Outcome**:

- All four ledger classes are detected (six ledger variants including gap/duplicate/reset) as `state.store.torn`; index/ledger divergence is covered by TC-STATE-007; zero values from unverified bytes; zero silent success.
- Every fixture is non-vacuous: without detection the planted value is observable.

#### TC-STATE-009 - Verified-empty versus torn

**Scenario Type**: Corner Case
**Impact Level**: Critical
**Priority**: High
**Related IDs**: F-4, F-5, AC-F4-2, DEC-6, Appendix B, DM-5
**Test Type(s)**: Integration, Contract
**Automation Level**: Automated
**Target Layer / Location**: `tests/behaviour/state-torn.test.ts`, `tests/behaviour/state-keys.test.ts`
**Tags**: @backend

**Preconditions**:

- An initialized state directory with no store files; a present-but-torn store with the same identity/paths; a read declaration with an empty required set and one with a non-empty required set.

**Steps**:

1. Read the absent store with an empty declared key set; assert explicit verified-empty evidence, success for that declaration, and a marker distinguishable from a torn result.
2. Read the absent store with a non-empty declared key set; assert `state.keys.missing` rather than a default value (Appendix B: verified-empty satisfies only an empty declaration).
3. Read the present-but-torn store with the same declarations; assert `state.store.torn` and no verified-empty marker.
4. Assert no empty collection, zero or default is substituted in any of the three results, and the two verdicts are never conflated.

**Expected Outcome**:

- Absent store: explicit verified-empty evidence with an empty declaration; `state.keys.missing` with a non-empty declaration.
- Torn store: `state.store.torn`; the two outcomes are distinct and unambiguous; no default substitution.

#### TC-STATE-010 - Terminal repair versus mid-record refusal

**Scenario Type**: Edge Case
**Impact Level**: Critical
**Priority**: High
**Related IDs**: F-4, AC-F4-3, DEC-5, DM-5
**Test Type(s)**: Integration, Contract
**Automation Level**: Automated
**Target Layer / Location**: `tests/behaviour/state-torn.test.ts`
**Tags**: @backend

**Preconditions**:

- A ledger with several verified records and a terminal truncated tail; a separate ledger with mid-record corruption; byte snapshots of both; an explicit repair operation exposed by the port.

**Steps**:

1. Repair the terminal-truncation ledger; assert the incomplete tail is removed, the repair is reported in evidence, the ledger then verifies, and every remaining record returns its exact prior value.
2. Attempt repair on the mid-record corruption ledger; assert it refuses with `state.store.torn`, changes nothing (byte snapshot equality), and leaves the ledger classified as torn.
3. Inspect the repair report; assert it names the store path/position and contains no payload content; assert no record other than the incomplete tail changed.
4. Run a control that auto-repairs mid-record corruption; assert the test detects the forbidden repair.

**Expected Outcome**:

- Terminal truncation only is repaired, reported, and leaves survivors intact; mid-record corruption refuses and is byte-unchanged.
- No automatic repair of non-terminal damage; the control is detected.

#### TC-STATE-011 - Key-set assertion, no defaults

**Scenario Type**: Negative
**Impact Level**: Critical
**Priority**: High
**Related IDs**: F-5, F-9, AC-F5-1
**Test Type(s)**: Integration, Unit
**Automation Level**: Automated
**Target Layer / Location**: `tests/behaviour/state-keys.test.ts`
**Tags**: @backend

**Preconditions**:

- A verified ledger with keys `k1` and `k2` whose payloads include falsy values (`0`, `""`, `[]`, `{}`) to prove no truthiness/default substitution; a read declaration mechanism per Appendix B.

**Steps**:

1. Read declaring `k1` and `k2`; assert the exact recorded values, including falsy values, return unchanged.
2. Read declaring `k1` and a missing `k3`; assert `state.keys.missing` naming `k3` (and only the missing keys), with no values returned.
3. Read declaring an empty set on a non-empty verified ledger; assert success with no fabricated keys or values (an empty declared result), and assert the store is not reported as verified-empty (it has records).
4. Run a temp-copy control that substitutes `null`/`0`/`[]` for missing keys; assert the test catches the substitution.

**Expected Outcome**:

- Missing declared keys fail `state.keys.missing` with the missing names; present keys return recorded values exactly, including falsy values; no default substitution.
- The substitution control is detected.

#### TC-STATE-012 - Atomic replace crash matrix

**Scenario Type**: Negative
**Impact Level**: Critical
**Priority**: High
**Related IDs**: F-2, F-6, AC-F6-1, DEC-8, NFR-3
**Test Type(s)**: Integration, Contract
**Automation Level**: Automated
**Target Layer / Location**: `tests/behaviour/state-atomic-replace.test.ts`
**Tags**: @backend

**Preconditions**:

- A derived document with a known previous version; a fault-injectable file edge with the injection points named in §4.3; a temporary-directory store; a direct-write control implementation.

**Steps**:

1. For each injection point across the write-start-to-cleanup window (the AC's before-temporary, after-temporary-write/flush and rename-failure points, plus the after-rename cleanup point), attempt a replace and inject the fault; inspect the target content.
2. Assert the target is byte/observably either the previous or the new version, never partial; assert the failed replace is classified as `state.write.failed` (transient, retryable) with `consequence: "not_landed"`.
3. Leave a stale temporary from an interrupted replace; open the store and assert it is cleaned or reported and never read as content; assert the target remains the previous version.
4. Run the direct-write control and assert the partial-content assertion catches it; run a successful replace and assert the new content is visible and the operation reports success (no failure consequence).
5. Assert the replace is recorded first as a ledger record and that the replaced document is rebuildable from verified ledger truth (every mutation is first a record).

**Expected Outcome**:

- Zero partial target states across the injection matrix; every failed replace reports `state.write.failed` with `not_landed`; stale temporaries are handled.
- The control proves the suite can detect partiality; successful replace is observable, complete, ledger-first and rebuildable.

#### TC-STATE-013 - Fence contention and double-write prevention

**Scenario Type**: Negative
**Impact Level**: Critical
**Priority**: High
**Related IDs**: F-7, AC-F7-1, NFR-4
**Test Type(s)**: Integration, Contract
**Automation Level**: Automated
**Target Layer / Location**: `tests/behaviour/state-fence.test.ts`
**Tags**: @backend

**Preconditions**:

- Two store handles over the same identity; an injectable lock backend with a barrier to interleave acquisition; distinct fence tokens and record keys; a lock-disabled control.

**Steps**:

1. Writer A acquires the fence; writer B attempts acquisition with a different token. Assert `state.lock.busy` as transient, retryable and `not_landed`, and that no B write landed.
2. While A holds the fence, read the store and assert reads succeed; A appends one record and releases.
3. B retries acquisition after release; assert success, append the next record, and assert the ledger sequence is contiguous with no interleaving or duplicate write.
4. Run the lock-disabled control where both acquisitions succeed; assert the suite detects the double-writer/interleaving invariant failure.
5. Assert a write operation is not callable without an acquired fence handle (type-level constructibility/negative compile fixture), so the discipline is structural, not merely a runtime check.

**Expected Outcome**:

- Exactly one live fence; the loser gets `state.lock.busy`; zero double-writes and no double acquisition.
- Writes are unrepresentable without the acquired handle; reads remain available while the fence is held; retry after release works; the control is detected.

#### TC-STATE-014 - Stale-handle rejection and exposed recovery

**Scenario Type**: Negative
**Impact Level**: Critical
**Priority**: High
**Related IDs**: F-7, AC-F7-2, DEC-7
**Test Type(s)**: Integration, Contract
**Automation Level**: Automated
**Target Layer / Location**: `tests/behaviour/state-fence.test.ts`
**Tags**: @backend

**Preconditions**:

- An acquired fence handle; a released handle; a handle invalidated by recovery; an injectable lock backend and a recovery recorder; a silent-steal control.

**Steps**:

1. Acquire and release; attempt append and replace through the old handle. Assert both fail `state.lock.busy` and nothing lands.
2. Invalidate a handle through explicit recovery; assert recovery is reported and that a write through the old handle still fails classified, never succeeding by a silent steal.
3. Read throughout and assert reads remain available; attempt a write through the recovered/lost handle and assert it fails classified.
4. Run the silent-steal control (recovery succeeds without report); assert the suite detects the missing report.

**Expected Outcome**:

- Writes through released, recovered or lost handles fail `state.lock.busy`; nothing lands.
- Recovery is explicit and reported; reads stay available; no silent steal; the control is detected.

#### TC-STATE-015 - Crash-after-land stale fence

**Scenario Type**: Negative
**Impact Level**: Critical
**Priority**: High
**Related IDs**: F-7, AC-F7-3, DM-5, NFR-4
**Test Type(s)**: Integration, Contract
**Automation Level**: Automated
**Target Layer / Location**: `tests/behaviour/state-fence.test.ts`
**Tags**: @backend

**Preconditions**:

- An injectable append/fence edge whose post-flush/pre-release hook throws; a newly opened store after the simulated crash; an injected staleness source (no wall-clock dependency); a recovery recorder.

**Steps**:

1. Writer A appends a record and the injected fault fires after ledger flush but before fence release.
2. Open a fresh store against the same directory; assert the fence is detectably stale and the landed record verifies on read with its exact payload.
3. Attempt a write through a new writer; assert it fails classified (`state.lock.busy`) until explicit recovery; assert reads continue to succeed.
4. Invoke explicit recovery; assert it is reported in evidence, the next write acquires and lands the next contiguous record, and no record was lost or duplicated.
5. Run an auto-steal control; assert the suite detects the silent recovery.

**Expected Outcome**:

- The fence is detectably stale; the landed record verifies; writes fail classified until explicit recovery; recovery is reported; reads remain available.
- No silent steal and no double write; the control is detected.

#### TC-STATE-016 - POSIX permission matrix and fail-closed

**Scenario Type**: Negative
**Impact Level**: Critical
**Priority**: High
**Related IDs**: F-8, AC-F8-1, NFR-5
**Test Type(s)**: Integration, Contract
**Automation Level**: Automated
**Target Layer / Location**: `tests/behaviour/state-permissions.test.ts`
**Tags**: @backend @posix

**Preconditions**:

- Linux CI with a temporary state root independent of a permissive umask; `stat` mode inspection; a deliberately violated existing store.

**Steps**:

1. Create a store; assert the directory mode is exactly `0700` and every created store file (ledger, index and any store-managed file) is exactly `0600`.
2. Change the directory to `0755` and/or a store file to `0644`; open the store and assert `state.permission.denied`, `user`/`not_landed`/exit 1, and that no permissive read/write/repair occurred.
3. Restore the correct modes and assert the store opens; assert no file was created outside the root or with widened access.
4. Run a mode-ignoring control; assert the exact-bit assertion catches the permissive implementation.

**Expected Outcome**:

- 100% of the POSIX creation matrix is applied; a violation fails closed with `state.permission.denied`; zero permissive continuations.
- The control proves the mode assertion is live.

#### TC-STATE-017 - Windows ACL contract, conditional

**Scenario Type**: Edge Case
**Impact Level**: Important
**Priority**: Medium
**Related IDs**: F-8, AC-F8-2, NFR-5, OQ-2
**Test Type(s)**: Integration, Contract, Manual
**Automation Level**: Semi-automated
**Target Layer / Location**: `tests/behaviour/state-permissions.test.ts`, platform-contract documentation
**Tags**: @backend @windows

**Preconditions**:

- A Windows host environment for the executable half; the documented platform contract; the Linux CI limitation record.

**Steps**:

1. On `win32`, create a store through the same port and verify the ACL restricts access to the current user; introduce a foreign-access grant and assert `state.permission.denied` fail-closed.
2. On non-Windows hosts, assert the test is explicitly skipped with the recorded platform reason; assert a structure check confirms the ACL-contract documentation exists and maps to the same port.
3. Record the Linux limitation and the owner-environment verification dependency (OQ-2) so no run claims unperformed Windows verification.
4. Review the platform contract for semantic parity with the POSIX rule (owner-only access, no widening).

**Expected Outcome**:

- On Windows, the ACL equivalent restricts access to the current user and fails closed on violation; on Linux, the skip and limitation are explicit.
- The contract is documented behind the same port; no platform claims are inflated.

#### TC-STATE-018 - Seven exact state identities and containment

**Scenario Type**: Regression
**Impact Level**: Critical
**Priority**: High
**Related IDs**: F-9, AC-F9-1, NFR-6, DM-3
**Test Type(s)**: Unit, Contract, Integration
**Automation Level**: Automated
**Target Layer / Location**: `tests/behaviour/state-error-classification.test.ts`, `tests/structure/error-table.test.ts`
**Tags**: @backend

**Preconditions**:

- The machine `ERROR_TABLE` with `state` added to `DOMAIN_KINDS`; the documented table; trigger fixtures from TC-STATE-003/006/008/010/011/012/013/014/016; returned and thrown failure paths.

**Steps**:

1. Drive each of the seven codes through its trigger: `state.store.torn` (torn read), `state.schema.mismatch` (TC-006), `state.keys.missing` (TC-011), `state.lock.busy` (TC-013/014), `state.permission.denied` (TC-016), `state.write.failed` (TC-012 injected I/O), `state.level.unsupported` (TC-003). Classify both returned and thrown failures.
2. Assert each `(kind=state, code)` round-trips with its exact category, retryability, consequence `not_landed`, projection class and documented summary/hint; assert user rows project to exit 1 and platform/transient rows to exit 2.
3. Assert kind-only `state` lookup is ambiguous and contains via `fallback.internal` (never the first state row); assert wrong-kind, unknown, missing and mismatched codes contain via `fallback.internal`; assert `provider`, `input` and `config` behaviour is unchanged.
4. Run a control classifier that selects the first state row on kind-only input; assert the suite detects it.

**Expected Outcome**:

- 7/7 exact state identities; all fields match the spec rows; kind-only `state` is ambiguous and never first-row; 100% containment of bad codes.
- Existing singleton and config exact-code behaviours do not regress; the control is detected.

#### TC-STATE-019 - Bidirectional table synchronization

**Scenario Type**: Regression
**Impact Level**: Critical
**Priority**: High
**Related IDs**: F-9, AC-F9-1, NFR-6
**Test Type(s)**: Contract, Integration
**Automation Level**: Automated
**Target Layer / Location**: `scripts/checks/error-table-sync.ts`, `tests/checks/error-table-sync.test.ts`, `doc/spec/features/feature-result-contract.md`
**Tags**: @backend

**Preconditions**:

- The in-change documented state rows in `feature-result-contract.md`; the machine table with the `state` domain kind; the existing check and mutation harness; isolated temp copies.

**Steps**:

1. Run the sync check on the delivered state; assert green with non-zero counts for source entries, documented rows, recognized state references and corpus rows.
2. In an isolated machine copy, remove one state row and separately remove `state` from `DOMAIN_KINDS`; assert the check fails and names the offending code/kind.
3. In an isolated documentation copy, remove a state row, add a doc-only state row, alter a field and duplicate a row; assert each fails in the documentation direction.
4. Run the unchanged copy as the control and assert it stays green; assert no first-row fallback or vacuous empty-table pass exists.

**Expected Outcome**:

- 7/7 state rows synchronize in both directions; source-only and documentation-only drift each fail with a named offender.
- The check cannot pass on an empty, missing or unparseable table; unchanged control is green.

#### TC-STATE-020 - Not-landed and safe error locations

**Scenario Type**: Negative
**Impact Level**: Critical
**Priority**: High
**Related IDs**: F-9, AC-F9-2, DM-5, NFR-3
**Test Type(s)**: Integration, Contract
**Automation Level**: Automated
**Target Layer / Location**: `tests/behaviour/state-error-classification.test.ts`, `tests/behaviour/state-evidence.test.ts`
**Tags**: @backend

**Preconditions**:

- Write-path failures from TC-STATE-012/013/014/015/016 and read-path failures from TC-STATE-006/008/010/011; a distinctive `planted-payload-*` canary in the failing record and in a failing write; raw and serialized error/evidence capture.

**Steps**:

1. Inspect every write-path failure (`state.write.failed`, `state.lock.busy`, `state.permission.denied`, and any other write-triggered state failure): assert `consequence: "not_landed"`.
2. Inspect every read-path failure (`state.store.torn`, `state.schema.mismatch`, `state.keys.missing`): assert none claims `landed`, and `not_landed` is truthful.
3. Assert error/evidence locations name the store path and record position/sequence only; assert missing-key names are present where AC-F5-1 requires them but payload values, checksum bytes and ambient data are absent.
4. Run the canary sweep over raw text, JSON and escaped forms; run a temp-copy formatter that includes the payload and assert the canary check catches it.

**Expected Outcome**:

- 100% of write-path failures report `not_landed`; no read-path failure claims a landed mutation.
- Locations are safe (paths/positions), zero payload/checksum canary leaks; the control is detected.

#### TC-STATE-021 - Packed Node/Bun state surface

**Scenario Type**: Regression
**Impact Level**: Critical
**Priority**: High
**Related IDs**: F-1, F-3, AC-F9-3, NFR-9
**Test Type(s)**: Contract, Integration
**Automation Level**: Automated
**Target Layer / Location**: `tests/checks/packed-state.test.ts` (packed-tarball consumer pattern)
**Tags**: @backend

**Preconditions**:

- A built `core` package and a real `pnpm pack` tarball; an isolated consumer installed with `--ignore-workspace` and a hermetic HOME; the recorded runtime support matrix from the TDR (OQ-1); a probe for `@delivery-os/core/state` and `@delivery-os/core/contracts`.

**Steps**:

1. Pack `core`; install it into an isolated consumer; import the public state port and contracts under Node and Bun.
2. Open a `jsonl` store, append and read through the public port under each runtime; for `sqlite`, load and exercise per the recorded runtime support matrix (assert the matrix entry, not an undocumented skip).
3. Assert no new package subpath (only the declared state/contracts surfaces), no ambient read under stubbed environment/clock, and no unsupported dependency in the packed manifest.
4. Run a negative probe against a non-existent state subpath and assert resolution fails; retain the real-import control.

**Expected Outcome**:

- The packed state surface imports and runs under Node and Bun within the declared matrix; both driver kinds load or are explicitly unsupported per the recorded matrix.
- No new subpaths, ambient reads or unsupported dependencies; the negative resolution probe fails as expected.

#### TC-STATE-022 - Boundary, runtime and literal conformance

**Scenario Type**: Regression
**Impact Level**: Critical
**Priority**: High
**Related IDs**: F-10, AC-F10-1, NFR-7
**Test Type(s)**: Static, Contract, Integration
**Automation Level**: Automated
**Target Layer / Location**: `tests/boundaries/**`, `tests/structure/state-imports.test.ts`, `scripts/checks/ambient-globals.ts`, `scripts/checks/forbidden-literals.ts`
**Tags**: @backend

**Preconditions**:

- Production dependency-cruiser config and boundary harness; fixture manifests that export `dist` targets and materialize `dist` so package-name probes mirror production resolution; the forbidden-literal registry including the new state feature doc.

**Steps**:

1. Assert `packages/core/src/state/**` imports `./contracts` only (AST detector with a synthetic forbidden-import control); assert no branding import.
2. Run the runtime-confinement rules: runtime APIs only in `core ./state` driver code (plus the existing allowlist); `adapters` may not import `core ./state`; surfaces may import it (clean control); any new rule has a failing fixture.
3. Run the boundary suite and fixture-coverage meta-check; delete one new fixture in an isolated copy and assert the meta-check fails.
4. Run the forbidden-literal scan over delivered code and docs; assert the new state feature doc is registered and zero product literals remain; run the synthetic literal control.
5. Run the aggregate gate (`pnpm check`) and existing bash/tool suites; assert no regression or weakened rule.

**Expected Outcome**:

- 0 tier/runtime/branding/literal violations; every new forbidden rule is proven by a failing fixture and a clean control; fixture coverage is enforced.
- The state feature doc is registered; existing gates stay green; no rule was loosened.

#### TC-STATE-023 - Foundation scope and consumer readiness

**Scenario Type**: Regression
**Impact Level**: Important
**Priority**: High
**Related IDs**: F-10, AC-F10-2, DEC-9
**Test Type(s)**: Static, Contract, Integration
**Automation Level**: Automated
**Target Layer / Location**: `tests/structure/state-scope.test.ts`, `tests/behaviour/state-conformance.test.ts`
**Tags**: @backend

**Preconditions**:

- The CLI command registry and dispatch; package import graph; the public state port; a minimal synthetic consumer that imports only the public port/contracts.

**Steps**:

1. Inspect the command registry and CLI dispatch; assert no `state` command is registered and no state command implementation exists.
2. Scan `packages/**` for state consumers outside `core ./state` (and the intended surfaces, which ship none in this change) and for configuration imports in the state tier; assert zero.
3. Exercise the port entirely through tests: open, append, read with key set, atomic replace, fence acquire/release/recover, integrity check and repair through the synthetic consumer, without config or branding.
4. In an isolated copy, inject a CLI state command and a config import; assert the scope test fails, proving it is live.

**Expected Outcome**:

- No CLI command, no configuration read and no caller beyond tests ship.
- The port is fully exercisable through tests and ready for M0-S6/S8/S10; the seeded-violation control is detected.

#### TC-STATE-024 - Read/write evidence contract

**Scenario Type**: Corner Case
**Impact Level**: Important
**Priority**: High
**Related IDs**: DM-5, AC-F3-1, AC-F4-1, AC-F4-2, AC-F4-3, AC-F7-3, NFR-2
**Test Type(s)**: Integration, Contract
**Automation Level**: Automated
**Target Layer / Location**: `tests/behaviour/state-evidence.test.ts`
**Tags**: @backend

**Preconditions**:

- Read paths from TC-STATE-007/008/009/010/015: verified read, verified-empty, torn, index rebuild, repair and stale-fence recovery; a normalized evidence shape and canary payloads.

**Steps**:

1. Collect evidence from each path; assert verification classes performed, verified-empty marker only for the absent store, rebuild report only when a rebuild occurred, repair report only when repair ran, and recovery report only when recovery ran.
2. Assert each verdict names paths and record positions and is distinguishable (verified versus verified-empty versus torn); assert no path silently omits evidence or degrades to empty.
3. Run the canary sweep across all evidence; assert no payload/checksum bytes and no ambient data appear.
4. Run a temp-copy control that omits the verified-empty marker or reuses a stale evidence object; assert the suite detects it.

**Expected Outcome**:

- Every read/write path exposes an explicit, path/position-based evidence verdict; verified, verified-empty and torn verdicts, plus rebuild/repair/recovery reports, are distinguishable and never conflated.
- Evidence never leaks payload content; the omission/staleness control is detected.

#### TC-REVIEW-001 - Independent review of proof, TDR and gates

**Scenario Type**: Manual
**Impact Level**: Critical
**Priority**: High
**Related IDs**: F-10, AC-F10-1, AC-F10-2, NFR-7, NFR-9
**Test Type(s)**: Manual
**Automation Level**: Manual
**Target Layer / Location**: PR review record
**Tags**: @review, @contract-quality

**Preconditions**:

- Automated suites are green; the reviewer has the spec, this plan, the TDR candidate and the open-PR Definition of Done in hand.

**Steps**:

1. Confirm every AC's evidence is traceable to a passing TC and that no AC claims a predicate the suite does not assert; confirm the NFR-9 spawn exception (GAP-2) and Windows limitation (GAP-1) are recorded, not hidden.
2. Review the TDR candidate for truthful storage-engine selections, runtime support matrix and license verdicts; confirm no selection silently weakens a contract.
3. Confirm no existing gate was weakened, skipped or relaxed (C-8); confirm no product name or product literal appears in any artifact; confirm the new feature doc is registered in the scan.
4. Confirm the change ships no CLI command, no configuration read and no caller beyond tests; confirm the minor changeset and PR base `main-tools`.
5. Confirm review findings are fixed and re-reviewed, and that no unrun evidence is recorded as passing.

**Expected Outcome**:

- The judgement-based properties and honest-record obligations are reviewed and recorded.
- Gate integrity, TDR truthfulness and scope discipline are attested by an independent reviewer, not assumed.

## 6. Environments and Test Data

### 6.1 Environments

| Environment | Requirements | Notes |
|-------------|--------------|-------|
| Local dev (delivery) | Bun pinned by `.bun-version`; pnpm pinned by `packageManager`; Node available for packed probes | All behaviour suites are hermetic and in-process; packed probes use isolated temp consumers |
| CI (GitHub Actions, `ubuntu-latest`) | Frozen-lockfile install; pinned Bun/pnpm/Node; existing `ts-*` jobs | Authoritative for POSIX permission, boundary, sync and aggregate gates; cannot verify Windows ACL |
| Windows host (owner environment) | Windows + Bun/Node per matrix | Executes TC-STATE-017's ACL half; recorded via OQ-2 before public-release claims |
| Temp fixture trees | `mkdtemp` under the OS temp dir | Torn fixtures, crash copies, mutation copies and packed consumers never write the live tree |
| In-process test process | Bun runtime; injected clock/branding/lock/file edges; no child processes for behaviour suites | Crash injection is deterministic, not a real process crash |

### 6.2 Test Data

| Data | Source / shape | Lifecycle |
|------|----------------|-----------|
| Intact ledger fixtures | Generated per case under `tests/fixtures/state/**` (assumed): records with kind/key/sequence/checksum and `planted-payload-*` values | Read-only; changed only with a deliberate contract change |
| Torn fixtures | Deterministic mutants of the intact ledger: truncated tail, framing break, sequence gap/duplicate/reset, checksum flip, index delete/corrupt | Generated per run; mutation precondition asserted before use |
| Schema fixtures | Supported store, unsupported store version, unsupported record version, supported control | Read-only |
| Key-set fixtures | Records with `k1`/`k2` and falsy payload values; missing-key declarations | Read-only |
| Derived documents | Previous/new content pairs for atomic replace; stale temporary fixtures | Per-test temp copies |
| Fence/lock fixtures | Two tokens, injectable lock backend, stale/lost/recovered handle states, injected staleness source | Per-test |
| Permission fixtures | Modes `0700`/`0600` baseline; violated `0755`/`0644`; Windows ACL grant fixture (host-conditional) | Per-test temp roots |
| Error canaries | Distinctive `planted-payload-*` markers in corrupted payloads and failed writes | Read-only; obviously fake; never a real secret |
| Packed consumer | Real `pnpm pack` tarball of `core` installed in an isolated consumer with hermetic HOME | Per run; deleted at test end |
| Documented table | `doc/spec/features/feature-result-contract.md`, state rows authored in this change | Read-only at test time; drift fails sync |
| Mutated copies | Generated per mutation test in `mkdtemp` | Deleted at test end; never in-tree |

### 6.3 Isolation Strategy

- Every fixture and mutation test uses a fresh temporary root; no test writes to the live repository tree, `dist/` or the user's real state directory. A clean-tree assertion after the suite is part of the aggregate gate.
- Behaviour suites inject branding identity, paths, clock/staleness, lock backend and file faults; they never read `$HOME`, `XDG_CONFIG_HOME`, the wall clock or a real product name. Ambient stubs throw where purity is asserted.
- The packed-consumer test follows the GH-173 pattern: real tarballs, `--ignore-workspace`, hermetic HOME/XDG roots and explicit cleanup; it is the only test allowed to spawn Node/Bun (GAP-2).
- Windows verification is never simulated as a pass on Linux: the test declares its platform skip with a reason and the platform contract is checked statically.
- Mutation tests edit copies only; the unchanged control is always run in the same suite so drift or a disabled check is observable.

## 7. Automation Plan and Implementation Mapping

All TCs are automated except TC-REVIEW-001 (manual). Locations are proposed under the repository testing strategy; delivery planning may bind different filenames but must preserve each TC's behaviour, assertions and AC mapping. Run `pnpm build` before tests that resolve packed/dist artifacts; use narrow Bun suites while iterating and `pnpm check` for the final gate.

| TC ID | Test file / artefact | Execution command | Control / mutation | Status |
|-------|----------------------|-------------------|--------------------|--------|
| TC-STATE-001 | `tests/structure/state-contract.test.ts`, `tests/behaviour/state-conformance.test.ts` | `bun test tests/structure/state-contract.test.ts tests/behaviour/state-conformance.test.ts` | ambient stubs; synthetic forbidden import | To Implement |
| TC-STATE-002 | `tests/behaviour/state-conformance.test.ts` + shared fixtures | `bun test tests/behaviour/state-conformance.test.ts` | divergent fake driver; zero-case guard; kind-branch AST scan | To Implement |
| TC-STATE-003 | `tests/structure/state-contract.test.ts`, `tests/behaviour/state-conformance.test.ts` | corresponding `bun test` | local-fallback control; write recorder | To Implement |
| TC-STATE-004 | `tests/behaviour/state-ledger.test.ts` | `bun test tests/behaviour/state-ledger.test.ts` | scoping-disabled control | To Implement |
| TC-STATE-005 | `tests/behaviour/state-ledger.test.ts` | same | in-place rewrite control; prefix snapshot | To Implement |
| TC-STATE-006 | `tests/behaviour/state-ledger.test.ts`, `tests/behaviour/state-error-classification.test.ts` | corresponding `bun test` | supported-version control; torn distinction | To Implement |
| TC-STATE-007 | `tests/behaviour/state-index.test.ts` | `bun test tests/behaviour/state-index.test.ts` | stale-index control; rebuild-fault injection | To Implement |
| TC-STATE-008 | `tests/behaviour/state-torn.test.ts` + `tests/fixtures/state/torn/**` | `bun test tests/behaviour/state-torn.test.ts` | per-class planted payload; detection-disabled control | To Implement |
| TC-STATE-009 | `tests/behaviour/state-torn.test.ts`, `tests/behaviour/state-keys.test.ts` | corresponding `bun test` | empty vs non-empty declaration controls; no-default control | To Implement |
| TC-STATE-010 | `tests/behaviour/state-torn.test.ts` | same | auto-repair control; byte snapshot | To Implement |
| TC-STATE-011 | `tests/behaviour/state-keys.test.ts` | `bun test tests/behaviour/state-keys.test.ts` | default-substitution control; falsy values | To Implement |
| TC-STATE-012 | `tests/behaviour/state-atomic-replace.test.ts` | `bun test tests/behaviour/state-atomic-replace.test.ts` | fault matrix; direct-write partiality control | To Implement |
| TC-STATE-013 | `tests/behaviour/state-fence.test.ts` | `bun test tests/behaviour/state-fence.test.ts` | lock-disabled double-writer control; reader-while-held | To Implement |
| TC-STATE-014 | `tests/behaviour/state-fence.test.ts` | same | silent-steal control; stale-handle writes | To Implement |
| TC-STATE-015 | `tests/behaviour/state-fence.test.ts` | same | post-flush fault; auto-steal control; injected staleness | To Implement |
| TC-STATE-016 | `tests/behaviour/state-permissions.test.ts` | `bun test tests/behaviour/state-permissions.test.ts` | exact-mode assertion; mode-ignoring control | To Implement |
| TC-STATE-017 | `tests/behaviour/state-permissions.test.ts` + platform contract doc | same (skipped off Windows with recorded reason) | Windows ACL violation control; Linux limitation assertion | Conditional / To Implement |
| TC-STATE-018 | `tests/behaviour/state-error-classification.test.ts`, `tests/structure/error-table.test.ts` | corresponding `bun test` | seven triggers; first-row control; existing-kind regressions | Existing – Update |
| TC-STATE-019 | `scripts/checks/error-table-sync.ts`, `tests/checks/error-table-sync.test.ts` | `bun run scripts/checks/error-table-sync.ts`; `bun test tests/checks/error-table-sync.test.ts` | both drift directions; duplicate/malformed rows; count non-vacuity | Existing – Update |
| TC-STATE-020 | `tests/behaviour/state-error-classification.test.ts`, `tests/behaviour/state-evidence.test.ts` | corresponding `bun test` | write/read consequence matrix; payload canary control | To Implement |
| TC-STATE-021 | `tests/checks/packed-state.test.ts` | `bun test tests/checks/packed-state.test.ts` | packed tarball; runtime matrix; non-existent subpath probe | To Implement |
| TC-STATE-022 | `tests/boundaries/**`, `tests/structure/state-imports.test.ts`, `scripts/checks/ambient-globals.ts`, `scripts/checks/forbidden-literals.ts` | `bun test tests/boundaries tests/structure/state-imports.test.ts`; `bun run scripts/checks/ambient-globals.ts`; `bun run scripts/checks/forbidden-literals.ts`; `pnpm check` | new failing fixtures; fixture-deletion self-test; literal control | Existing – Update |
| TC-STATE-023 | `tests/structure/state-scope.test.ts`, `tests/behaviour/state-conformance.test.ts` | `bun test tests/structure/state-scope.test.ts tests/behaviour/state-conformance.test.ts` | seeded CLI command/config-import violation | To Implement |
| TC-STATE-024 | `tests/behaviour/state-evidence.test.ts` | `bun test tests/behaviour/state-evidence.test.ts` | marker omission/stale-evidence control; canary sweep | To Implement |
| TC-REVIEW-001 | PR review record | manual | none | Manual Only |

**Execution order.**
1. Structure and port vocabulary: TC-STATE-001, TC-STATE-003, TC-STATE-005 shape, TC-STATE-023.
2. Conformance parity: TC-STATE-002 (both drivers).
3. Ledger, torn, keys, repair: TC-STATE-004, TC-STATE-005, TC-STATE-006, TC-STATE-008, TC-STATE-009, TC-STATE-010, TC-STATE-011, TC-STATE-024.
4. Index divergence: TC-STATE-007.
5. Write discipline: TC-STATE-012, TC-STATE-013, TC-STATE-014, TC-STATE-015.
6. Permissions: TC-STATE-016, TC-STATE-017.
7. Failure identity and evidence: TC-STATE-018, TC-STATE-020.
8. Invariants and packing: TC-STATE-019, TC-STATE-021, TC-STATE-022.
9. Aggregate/regression and manual review: TC-STATE-022, TC-STATE-023, TC-REVIEW-001.

**Wiring.** The new behaviour suites are discovered by root `bun test`. The error-table sync check remains in the existing `ts-invariants` wiring; no new CI job topology is introduced. Boundary updates extend existing rules and fixtures; the fixture-coverage meta-check enforces them. The packed-state test belongs to `tests/checks` and runs in the existing `ts-test` suite; it may require a build step before execution, matching the packed-config precedent.

**Evidence commands** (run and record in the change/PR; do not record unrun results as passing):

```
pnpm install --frozen-lockfile
pnpm build
bun test tests/structure/state-contract.test.ts
bun test tests/structure/state-imports.test.ts
bun test tests/structure/state-scope.test.ts
bun test tests/behaviour/state-conformance.test.ts
bun test tests/behaviour/state-ledger.test.ts
bun test tests/behaviour/state-torn.test.ts
bun test tests/behaviour/state-keys.test.ts
bun test tests/behaviour/state-index.test.ts
bun test tests/behaviour/state-atomic-replace.test.ts
bun test tests/behaviour/state-fence.test.ts
bun test tests/behaviour/state-permissions.test.ts
bun test tests/behaviour/state-error-classification.test.ts
bun test tests/behaviour/state-evidence.test.ts
bun test tests/checks/error-table-sync.test.ts
bun test tests/checks/packed-state.test.ts
bun test tests/boundaries
bun run scripts/checks/error-table-sync.ts
bun run scripts/checks/ambient-globals.ts
bun run scripts/checks/forbidden-literals.ts
bun run scripts/checks/workspace-entrypoints.ts
bun run scripts/checks/license-audit.ts
bun run scripts/checks/vulnerability-gate.ts
pnpm check
bash scripts/.tests/test-*.sh
bash tools/.tests/test-*.sh
git diff --check
git status --porcelain
```

**Open-PR DoD evidence checklist.** All 22 ACs must have a passing traceable TC; all nine NFR thresholds measured; every negative control non-vacuous; conformance parity 2/2 driver kinds on identical fixtures; packed Node/Bun probe green within the recorded matrix; POSIX matrix green and Windows limitation recorded; boundary, ambient, literal, sync and aggregate gates green; the state feature doc authored/registered and result-contract rows synchronized; an independent review passed; a minor changeset recorded; an open unmerged PR targets `main-tools` with all required CI jobs green on the pushed HEAD. No merge or owner acceptance is claimed by this plan.

## 8. Risks, Assumptions, and Open Questions

### 8.1 Risks

| ID | Risk | Impact | Probability | Mitigation |
|----|------|--------|-------------|------------|
| RSK-T1 | Parity normalization hides a real divergence (e.g., evidence fields differ by kind) | H | M | Normalizer limited to driver-neutral fields; `sqlite`-only rebuild evidence asserted separately; divergent fake-driver control; fixture digest equality |
| RSK-T2 | A torn fixture is inert, so the test passes without proving detection | H | M | Every fixture asserts its mutation precondition and carries a planted payload; detection-disabled control must expose it; repair/detection controls in TC-STATE-008/010 |
| RSK-T3 | Fault injection is not representative of real crash windows | H | M | Named injection points cover write start, temp write, rename and cleanup; direct-write control proves partiality detection; deterministic, no sleeps |
| RSK-T4 | Fence staleness depends on wall-clock liveness and flakes | H | M | Injected staleness source; no real time; explicit recovery path; `not_landed` and no-double-write assertions |
| RSK-T5 | Windows ACL cannot be verified in CI and is silently claimed | M | M | Platform-conditional test with recorded skip; structure check for the documented contract; OQ-2 before public-release claims |
| RSK-T6 | Sync check becomes vacuous (empty state rows, missing doc, no counts) | H | L | Non-zero count assertions; fail-closed on missing/unparseable doc; both drift directions; `state` kind removal mutation |
| RSK-T7 | Packed test flakes on install/build or hides a missing runtime via skip | H | M | Hermetic tarball consumer; explicit runtime matrix; skipped sqlite must be declared in the matrix, never implicit; negative subpath probe |
| RSK-T8 | Boundary fixtures do not mirror production resolution, so the test proves nothing | M | M | GH-170 fixture manifests with `dist` materialization; fixture-coverage meta-check; deletion self-test |
| RSK-T9 | NFR-9's "0 spawned tests" is claimed while AC-F9-3 requires a spawned Node probe | M | H | Recorded as GAP-2/OQ-T1; only the packed probe spawns; behaviour suites stay in-process; no silent claim of "0" |
| RSK-T10 | Consumer readiness (M0-S6/S8/S10) is asserted without a real consumer | M | M | Synthetic public-port consumer exercises every operation; scope scan; DoR/consumer stories remain the real adoption proof |
| RSK-T11 | "No caller beyond tests" is unprovable exhaustively by a static scan | M | L | Import/AST scan plus seeded-violation control; review step; later consumers are separate changes |

### 8.2 Assumptions

- **A-T1 — Behaviour-bound TCs.** Exact filenames/symbols marked "assumed" may change in delivery planning; the behaviour, assertion target and AC mapping must not. Spec-fixed names (state codes, `delivery.state.v1`, level values, `not_landed`) may not be rebound.
- **A-T2 — Parity fields.** "Identical results" (AC-F1-2) means driver-neutral result/error/evidence classes; the `sqlite` rebuild report is driver-specific evidence asserted separately (GAP-3/OQ-T2, resolved by spec v1.1 AC-F1-2).
- **A-T3 — Fault seam.** Deterministic crash/staleness testing requires a test-only injection seam at the state driver's runtime edge; it is not part of the public port and is not a third-party dependency.
- **A-T4 — POSIX is the hard gate.** Linux CI proves AC-F8-1; Windows verification is an owner-environment dependency (OQ-2), not a Linux pass.
- **A-T5 — Packed pattern.** The GH-173 packed-tarball consumer pattern applies to `core`; Node/Bun support is asserted against the TDR-recorded matrix, not an assumed universal SQLite binding.
- **A-T6 — Plan-relative, behaviour-bound.** The implementation plan ([chg-GH-174-plan.md](./chg-GH-174-plan.md)) maps its phases onto these TCs; any later plan or implementation change that alters a TC's behaviour, assertion target or AC mapping must reopen this test plan.
- **A-T7 — TDR candidate.** Storage-engine selections and the runtime support matrix are recorded during delivery (OQ-1); tests bind the contracts, and an unsupported binding is a recorded constraint, not a weakened AC.
- **A-T8 — Append-only observation.** "No in-place rewrite" is observed via ledger prefix bytes and sequence continuity; the JSONL ledger is the durable truth for both driver kinds.
- **A-T9 — Safe locations.** Naming missing keys is required by AC-F5-1 and is not payload leakage; payload values/checksum bytes are the forbidden content.
- **A-T10 — No consumer surface.** No M0-S6/S8/S10 consumer ships here; test-only synthetic consumers are the readiness proof.

### 8.3 Open Questions

| ID | Question | Context | Status | Owner |
|----|----------|---------|--------|-------|
| OQ-T1 | NFR-9 says "0 tests requiring a spawned process", but AC-F9-3 requires importing the packed artifact under Node and Bun. Which wins? | Packed Node import necessarily spawns Node; Bun can be spawned too. NFR-9's in-process rule holds for every behaviour/contract suite; the packed probe is the single scoped exception. | **Resolved — spec v1.1 §14 / AC-F9-3: the packed Node/Bun probe is the one documented spawned-process exception; NFR-9's in-process rule otherwise stands, and no other spawned test is licensed.** | @spec-writer (resolved) |
| OQ-T2 | Does AC-F1-2's "identical results" include the `sqlite`-only index-rebuild report? | DM-5 permits a rebuild report when one occurs; parity cannot require the `jsonl` kind to fabricate one. This plan excludes driver-specific evidence from parity and asserts it separately. | **Resolved — spec v1.1 §14 / AC-F1-2: parity is defined over driver-neutral observable fields and driver-specific diagnostic evidence (the `sqlite` rebuild report) is excluded and asserted separately via AC-F3-1/TC-STATE-007; reading confirmed at DoR iteration 1.** | @readiness-reviewer (resolved) |
| OQ-T3 | Which Windows environment verifies the ACL half (spec OQ-2)? | Linux CI cannot verify Windows ACLs; TC-STATE-017 is platform-conditional and records the limitation. | **Open (spec OQ-2) — owner environment before public-release claims; non-blocking for this change** | @pm / owner |
| OQ-T4 | What exact runtime support matrix does the TDR record for the SQLite binding? | AC-F9-3 says "within their recorded runtime support matrix"; the matrix does not exist until delivery. TC-STATE-021 asserts the recorded matrix and fails an undeclared skip. | **Open (spec OQ-1/TDR) — recorded during delivery; non-blocking** | @coder / @decision-advisor |
| OQ-T5 | What staleness basis and recovery-report shape does the TDR bind for fences? | AC-F7-3 requires "detectably stale" but the mechanism is a TDR candidate; tests inject staleness and assert the observable contract. | **Open (spec OQ-1/TDR) — recorded during delivery; non-blocking** | @coder / @decision-advisor |
| OQ-T6 | Which documented state code should a failed index rebuild use? | AC-F3-1 requires the failed rebuild to be classified, never a silent stale read; a storage I/O failure during rebuild is the pinned case. | **Resolved — spec v1.1 §14 / AC-F3-1: a rebuild storage I/O failure fails exactly `state.write.failed` (transient, retryable, `not_landed`); TC-STATE-007 step 2 asserts that code and accepts no alternative.** | @spec-writer (resolved) |

**Spec gaps recorded explicitly (not silently adjusted):**

1. **NFR-9 spawn rule** — see OQ-T1 (resolved). NFR-9 holds as an in-process rule with exactly one scoped exception: the AC-F9-3 packed Node/Bun probe. The plan records the exception rather than claiming 0 spawned tests.
2. **AC-F1-2 parity scope** — see OQ-T2 (resolved). "Identical results" is defined over driver-neutral observables because DM-5 allows kind-specific rebuild evidence; that evidence is asserted separately (AC-F3-1/TC-STATE-007).
3. **AC-F8-2 platform reach** — see GAP-1/OQ-T3. Testable only on a Windows host; the Linux limitation is explicit in the spec and this plan.
4. **Failed-rebuild code** — see OQ-T6 (resolved). AC-F3-1 (v1.1) pins `state.write.failed` (transient, retryable, `not_landed`) for a rebuild storage I/O failure; TC-STATE-007 asserts that exact code and admits no alternative.
5. **No caller beyond tests** — see RSK-T11. Static scanning plus a review step is the practical proof; a future consumer change is out of scope.

No AC is left without a TC. AC-F8-2 is conditional by platform, not unmapped.

## 9. Plan Revision Log

| Version | Date (UTC) | Author | Changes |
|---|---|---|---|
| 1.0 | 2026-10-30T17:54:23Z | Change Test Plan Writer | Initial plan: 24 `STATE` TCs plus TC-REVIEW-001; all 22 spec ACs mapped; DM-1..DM-5 and NFR-1..NFR-9 traced; parameterized both-driver conformance contract, non-vacuous torn matrix, deterministic crash/fence injection, POSIX hard gate with conditional Windows ACL, seven-code error identity and bidirectional sync, packed Node/Bun surface, boundary/scope conformance; spec gaps (NFR-9 spawn tension, parity scope, Windows reach, rebuild code, caller proof) recorded rather than reinterpreted. |
| 1.1 | 2026-10-30T18:26:41Z | Change Test Plan Writer | Post-spec-amendment alignment and DoR iteration-1 fixes (test_planning reopened; readiness-iter-1 F1–F3). F1: TC-STATE-007 step 2 now asserts exactly `state.write.failed` (transient, retryable, `not_landed`) for an injected rebuild storage I/O failure; the "TDR may bind another documented state code" latitude is deleted and the §3.1 AC-F3-1 row mirrors the pin. F2: OQ-T1/T2/T6 marked resolved by spec v1.1 §14 (NFR-9 scoped exception AC-F9-3; AC-F1-2 driver-neutral parity; AC-F3-1 pinned rebuild code); OQ-T3/T4/T5 remain open and non-blocking; `implementation_plan` link set to `./chg-GH-174-plan.md`; GAP-5, §2 plan reference and A-T6 updated from "plan absent". F3: NFR-2's 5/5 evidence row now cites TC-STATE-007 (sole assertor of the index/ledger-divergence class) and TC-STATE-007 lists NFR-2. No TC renumbering, no behaviour/AC-mapping change. |

## 10. Test Execution Log

| TC ID / gate | Run Date (UTC) | Result | Notes / command / HEAD |
|---|---|---|---|
| Not run | — | Planned | This writer ran no builds or tests and implemented no code. The executor records per-TC evidence, commands, HEAD and pushed-HEAD CI results here; unrun evidence must never be recorded as passing. |
