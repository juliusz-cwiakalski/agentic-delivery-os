---
id: chg-GH-232-test-plan
status: Proposed
created: 2026-11-06
last_updated: 2026-11-06
owners: [engineering]
service: "delivery-os learning plane (retro evidence pipeline)"
labels: [m1, retro, learning-plane, state-layer, cli]
version_impact: minor
summary: "Traceable verification of M1-S8: an independent append-only evidence sidecar written only by the collector under one fence, with collector trace ids, collection watermarks, claimed identity, and a keyed (HMAC-style) chain over a distinct store-managed chaining key that never enters lane environments, records, output, or configuration; verified reads on every pass; the full tamper mutation matrix (content edit, deletion, reorder, tail truncate-and-reappend, recomputed unkeyed checksum, key-artifact substitution) flagged with position and trace id, zero false verified verdicts, and cross-process continuity without false breaks; entry-level malformation classified in-band with partial output preserved and byte-identical valid-entry output, store-level damage classified through existing state identities, and zero uncaught crashes; the `change` level collector over GET-only delivered sources (audit ledger with skipped ordinals and chain verdict carried verbatim, state record families, pm-notes retro notes) with addenda-not-rewrites; the level report data shape `{level, findings[], followThrough[], evidenceRefs[]}` with mechanical fold-only findings, an explicit verified-empty versus vacuous-green distinction, null-retro-is-success, and zero model calls in collect/report; the five pipeline-truth checks each with a triggerable negative fixture and a check-removal mutation; the hardened R1–R6 level registry with classified refusals for declared-but-unimplemented levels; the periodic memory-audit trigger registered with runs recorded as evidence; the bounded export surface with chain verdict; the three `retro` error rows with bidirectional documented sync; and tier, boundary, determinism, redaction, and boundedness conformance."
links:
  change_spec: ./chg-GH-232-spec.md
  implementation_plan: null
  testing_strategy: ../../../../.ai/rules/testing-strategy.md
---

# Test Plan - M1-S8: OSS retro pipeline

## 1. Scope and Objectives

This plan protects the change's single load-bearing guarantee: retrospective evidence is **collector-truth that delivery agents cannot alter undetectably**. Three properties carry that guarantee and each is tested independently so that weakening one cannot pass behind the others. First, **independence**: the evidence sidecar is a separate append-only artifact family outside the delivery state store, addressed only by the collector write seam, with a distinct store-managed chaining key. Second, **detection**: every read walks the sidecar, recomputes the keyed link from the chaining key, the previous link, and the canonical record content, and reports every mismatch with its position and trace id; records alone — including a recomputed unkeyed checksum — never verify. Third, **honest failure**: malformed entries classify in-band with valid output preserved byte-for-byte, store damage fails closed with the state identities, and no classified read mutates a store or crashes a run.

The plan is built around five binding mechanisms: a **two-store fixture harness** (temp state directory, synthetic sidecar, synthetic retro registry, synthetic delivery registry, and an injected `AuditRead` result) that makes every source fold scriptable and every byte observable; an **adversary model** that mutates sidecar bytes directly on disk, exactly as a same-user delivery agent outside the lane environment could; a **non-vacuity contract** in which every negative, absence, refusal, tamper verdict, and truth-check finding is paired with a live control and a detection-disabled mutant that must fail the suite; a **byte-equality oracle** that compares preserved valid-entry output against the equivalent clean run instead of trusting counts; and a **traceability matrix** binding all 16 acceptance criteria, 2 event kinds, 8 data-model elements, and 10 NFRs to named suites. It is a design and verification map, not an execution claim: no builds or suites were run while authoring it.

### 1.1 In Scope

- The `retro` command family surface: `retro collect [--level <name>]`, `retro report [--level <name>] [--json]`, grammar rejection before any I/O, composition-only registration, envelope rendering, and the `{0, 1, 2}` exit projection (F-1..F-10, AC-F1-3, AC-F5-1, NFR-9).
- The evidence sidecar as an independent append-only artifact family: collector-only write seam, single-fence serialized appends covering the verified pre-append read, link computation, and appends; trace id, level, source, explicit window bounds, injected-clock timestamp, claimed identity, payload refs, payload schema id, and keyed chain link on every record; no update, delete, reorder, compaction, or read-path mutation (F-2, AC-F2-1, EVT-1, DM-2, NFR-4).
- The keyed chain: HMAC-style keyed link over chaining key, previous link or sidecar anchor, and canonically ordered content; distinct store-managed key artifact (separate path and separate bytes from `chain-key.<workspace>.json`), created once at the first append with runtime-edge randomness, `0600`, verified on open, never silently regenerated while guarded records exist, read by every later process (F-2, AC-F2-2, DM-3, NFR-3; TDR-0009 C-2, C-5, C-6).
- Chain verification on every read: clean verification, the full alteration matrix, multi-break reporting, position and trace-id naming with no payload or checksum bytes, key-artifact substitution detection naming the affected domain, and the explicit-salvage distinction (F-3, AC-F2-3, AC-F3-1, DM-4, NFR-2).
- Shape-crash guards over both the sidecar and the retro registry: the 24-case entry-level matrix (four malformation classes at three positions in two stores), partial output preserved with byte-identical valid-entry content, the bounded partial-run facts, the error-only envelope, and the five-case store-level matrix classified through state identities (F-4, AC-F4-1, AC-F4-2, DEC-7, NFR-1).
- Collection at the implemented `change` level: automatic target selection (most recent completed change not yet collected at the level), GET-only collection over the audit ledger through its bounded read surface, the delivered state-store record families, and pm-notes typed retro notes; skipped-ordinal findings and the full audit chain verdict carried verbatim; run records with counts and consumed verdicts; addenda on re-collection (F-1, AC-F1-1, AC-F1-2, DM-5, EVT-2).
- Reporting: the exact `{level, findings[], followThrough[], evidenceRefs[]}` machine `data`, mechanical fold-only findings each linked to evidence refs, the follow-through read-fold with artifact-verified markers, an explicit empty report for verified-empty folds, determinism, and zero model calls (F-5, AC-F5-1, AC-F5-2, DM-6, NFR-6).
- The five pipeline-truth checks, each with a triggerable negative fixture, the verified-empty versus vacuous-green distinction, and a check-removal mutation that must fail the suite (F-6, AC-F6-1, DEC-6).
- The bounded evidence export: explicit destination, required positive-integer limit, deterministic bundle with trace ids, watermarks and the full chain verdict, in-band truncation, redaction, and no mutation of sidecar or registry (F-7, AC-F7-1, DM-7, NFR-5, NFR-10).
- The hardened level registry: R1–R6 declared with scope kind, trigger declaration, and the closed `implemented`/`declared` status; `change` implemented; the four-verdict boundary matrix; unknown and declared-but-unimplemented refusals with owning-story hints; and `state check` visibility (F-8, AC-F8-1, AC-F1-3, DM-1).
- The periodic memory-audit trigger registration and its runs recorded as evidence with trace ids, queryable through `retro report`, with no new memory-audit command (F-9, AC-F9-1).
- The three `retro` error identities, exact-code classification, store-identity reuse, and bidirectional documented-table sync with zero drift (F-10, DM-8, NFR-8).
- Tier, boundary, runtime-confinement, forbidden-literal, hermeticity, performance/bounded-work, and redaction conformance for every file this change introduces (NFR-3, NFR-6, NFR-7, NFR-9, NFR-10).

### 1.2 Out of Scope & Known Gaps

- [OUT] The ceremony runner (M2-S3), the action registry (M2-S10), capsule expansion (M1-S12), fleet retro, and the R2–R5 level implementations (spec NG-1..NG-4). Declared-only levels are tested for refusal, never for a run.
- [OUT] Tamper prevention, OS privilege separation, multi-user or remote threat models, authenticated identity, cryptographic non-repudiation, and key rotation/escrow/backup (spec NG-5, NG-6). The adversary model is a same-user process without the key; a process that reads the `0600` key artifact is outside the documented model (TDR-0009 residual risk) and is not tested as a guarantee.
- [OUT] Model-driven insight generation anywhere in the pipeline (spec NG-7). The plan asserts the absence of model calls in collect/report; it does not test analysis quality.
- [OUT] A new memory-audit command or a reimplementation of the memory consolidation procedure (spec NG-8); retention, pruning, compaction, or expiry for the sidecar (spec NG-9); and any change to the envelope contract, exit taxonomy, existing error-table rows, or the audit ledger and its construction (spec NG-10).
- [OUT] Real process spawning, real network, real host state, real user state directories, or real cryptographic key material in committed fixtures. Cross-process continuity is modelled by reopening the same temp store with a fresh store/edge instance (the GH-223 precedent), not by spawning.
- [OUT] Windows ACL execution. Permission assertions (state directory `0700`, sidecar and key `0600`) are POSIX-only; no Linux run claims Windows verification.
- [GAP-T1 — implementation plan not yet authored] `chg-GH-232-plan.yaml` does not exist at authoring time. This plan binds behaviour, assertions, identities, and AC mapping; delivery planning maps phases onto these TCs and may not reshape them. Suite file names below follow the repository's `retro-*` convention; delivery may add helpers but must preserve each TC's behaviour and oracle.
- [GAP-T2 — NFR-7 is not reliably CI-verifiable] The thresholds (collect ≤ 30 s, report ≤ 10 s, export ≤ 10 s on a 10,000-record sidecar, and the audit read within its own documented bounds) depend on runner capacity. The CI oracle is **bounded work** (query/append counts, one chain walk per read, bounded per-record work, declared timeouts) plus a soft local budget. A non-CI reference measurement on a generated 10,000-record sidecar is recorded in §10 and never reported as a passing threshold; NFR-7 remains a target (TC-RETRO-061).
- [GAP-T3 — BLOCKING: permission-violation exit conflicts with the delivered taxonomy] AC-F4-2 and DEC-7 require store-level damage — explicitly including "permission violation" — to classify as unreachable at exit 2 through the existing state identities. The delivered table's `state.permission.denied` row is `category: user`, `projectionClass: user-validation`, so it projects exit **1**; changing it would violate NG-10 and §8.5 ("every existing error-table row … unchanged", "no changes to the exit taxonomy"). TC-RETRO-013 and TC-RETRO-033 therefore assert the **identity** and mark the exit expectation **TODO**, and §8.3 raises OQ-T1 for PM/spec reopening. No test will assert a value the delivered projection cannot produce.
- [GAP-T4 — BLOCKING: export has no invoking surface] AC-F7-1 and F-7 require an export surface with a caller-supplied explicit destination and a required limit, including refusal when either is absent. The locked command surface (§8.5, man-page) is exactly `retro collect|report [--level <name>]` plus the global `--json`, and §7.2 defers "new flags beyond the locked surface". No `retro export` subcommand or flag exists in the surface, so the invocation path is undefined. TC-RETRO-049..052 cover the engine-level contract (bounded deterministic bundle, destination/limit validation, truncation, redaction, no mutation) and mark the **invoking surface and its refusal projection TODO**; §8.3 raises OQ-T2.
- [GAP-T5 — BLOCKING: the non-clean exit for two truth triggers is unpinned] AC-F6-1 says the zero-collector and broken-audit-verdict triggers "block a clean exit with the classified evidence", but no error identity or exit is declared for either. The three `retro` rows cover malformed evidence, sidecar tamper, and denied writes; `retro.evidence.tamper-flagged` is specified for the sidecar chain (DEC-8), and the state identities describe an unreachable store, not a broken audit verdict. TC-RETRO-042 and TC-RETRO-045 assert the mandatory finding, its evidence links, and that the run does not report a clean truth verdict, and mark the **exact identity/exit TODO**; §8.3 raises OQ-T3.
- [GAP-T6 — non-blocking taxonomy note] DEC-11 pins `retro.evidence.malformed-entry` and `retro.evidence.tamper-flagged` as `category: platform`, `retryable: false`, `consequence: not_landed` with exit 1. Because the exit code is derived only from the projection class (`success` 0, `user-validation` 1, `platform-provider` 2), exit 1 forces `projectionClass: user-validation` on a platform-category row. The spec never pins the projection class, so this is satisfiable; TC-RETRO-004 and TC-RETRO-005 pin exactly that combination and §8.3 records it as OQ-T4 for DoR confirmation. A silent switch to `platform-provider` would move both rows to exit 2 and fail the suite.
- [GAP-T7 — report version marker versus an exact key set] AC-F5-1 requires `data` to be "exactly the versioned `{level, findings[], followThrough[], evidenceRefs[]}` shape", while DM-6 calls it a versioned shape. Adding an in-data version key would make the key set five, not four. The plan resolves this as A-T4: the four keys are the complete `data` key set and the report schema identity `delivery.retro.report.v1` is a declared contract constant used by the contract test, goldens, and docs, not an in-`data` field. TC-RETRO-035 asserts the exact key set and the declared schema constant; if delivery wants an in-data marker the spec must be reopened.
- [GAP-T8 — exact artifact and record spellings are delivery-bound] OQ-2 defers the sidecar artifact family and key-artifact file names, and the spec does not name the retro registry record kinds, payload schema ids, or store-scoped keys. The plan refers to the sidecar chaining key as `chain-key.retro.<workspace>.json` for readability; tests assert the **declared contract constant**, the distinctness from `chain-key.<workspace>.json`, and the validated-boundary properties (kind, payload schema, identity field, required fields, closed vocabularies), not a hardcoded filename (A-T2, A-T5). The same applies to the level→owning-story hint map (A-T6).

## 2. References

- **Change specification (v1.0)**: [chg-GH-232-spec.md](./chg-GH-232-spec.md) — 16 ACs (AC-F1-1..3, AC-F2-1..4, AC-F3-1, AC-F4-1..2, AC-F5-1..2, AC-F6-1, AC-F7-1, AC-F8-1, AC-F9-1), F-1..F-10, EVT-1/EVT-2, DM-1..DM-8, NFR-1..NFR-10, DEC-1..DEC-13, RSK-1..RSK-8, §14 OQ-1..OQ-4, Appendix B test-plan handoff.
- **Decision record**: [TDR-0009](../../../decisions/TDR-0009-retro-evidence-sidecar-keyed-chain-construction.md) — keyed-chain construction, distinct chaining key, tamper-evidence scope, cross-process continuity, key-open-failure identities (C-1..C-7), loss-of-key semantics, and the wholesale-deletion consequence.
- **PM record**: [chg-GH-232-pm-notes.yaml](./chg-GH-232-pm-notes.yaml) — scope reading, dependency verification, doc-impact list, and the recorded audit-invertibility design tension.
- **Testing strategy**: [.ai/rules/testing-strategy.md](../../../../.ai/rules/testing-strategy.md) — layers, module-to-test mapping, invariant authoring, `pnpm check` aggregate, and permanent-suite rules.
- **TypeScript rules**: [.ai/rules/typescript.md](../../../../.ai/rules/typescript.md) — strict typing, purity, ports and adapters, error contract, bun:test authoring.
- **Current system truth — result contract**: [feature-result-contract.md](../../../spec/features/feature-result-contract.md) — envelope, error table, classification chain, `{0, 1, 2}` projection, redaction chokepoint, scripted projection, documented-table sync.
- **Current system truth — state layer**: [feature-state-layer.md](../../../spec/features/feature-state-layer.md) — public port, validated artifact boundaries, verified reads, fences, store-managed artifacts, least privilege, explicit salvage, store layout.
- **Current system truth — audit ledger**: [feature-audit-ledger.md](../../../spec/features/feature-audit-ledger.md) — bounded filtered read surface, chain verdict, skipped-ordinal findings, `chain-key.<workspace>.json` precedent, documented FNV invertibility caveat.
- **Current system truth — doctor**: [feature-doctor.md](../../../spec/features/feature-doctor.md) — the `state` check, `state-stores` evidence, the four store reasons and their fix hints.
- **Concepts**: [retrospectives.md](../../../planning/concepts/retrospectives.md) — levels R1–R6 and triggers, evidence plane outside delivery-agent write authority, pipeline-truth/vacuous-green, null-retro-is-success, addenda-not-rewrites.
- **Locked surface**: [commands/retro.md](../../../planning/oss-tooling/milestones/m1/commands/retro.md) and [man-page.md](../../../planning/oss-tooling/milestones/m1/man-page.md) — synopsis, report data shape, exit taxonomy, named errors.
- **Contracts to extend**: `packages/core/src/contracts/error-table.ts` (`DOMAIN_KINDS`, rows), `packages/core/src/contracts/audit.ts` (`AuditReadOutcome`, `AuditChainVerdict`, `AuditReservationOrphanFinding`), `packages/core/src/contracts/state.ts` (boundary declarations), `packages/core/src/contracts/delivery-result.ts` (envelope), `packages/core/src/contracts/index.ts`.
- **Harnesses and precedents to reuse**: `tests/fixtures/state/harness.ts` (`createTestEdge`, `openStore`, `withinFence`, `ledgerBytes`, `independentChecksum`, `salvageTail`), `tests/fixtures/audit/{cases,mutations,key-open-failures,lane-environment}.json`, `tests/golden/helpers.ts` (buffer streams, mutant-module import), `tests/checks/error-table-sync.test.ts`, `tests/structure/cli-edge-seam.test.ts`, `tests/checks/config-default-positions.test.ts` (temp-root discipline).
- **Closest delivered precedent**: [chg-GH-223-test-plan.md](../2026-11-06--GH-223--audit-ledger/chg-GH-223-test-plan.md) — chain mutation matrix, key containment, cross-process continuity, key-open failures, and salvage continuity; [chg-GH-180-test-plan.md](../2026-10-31--GH-180--db-session-admin-port/chg-GH-180-test-plan.md) — normative TC table, non-vacuity contract, boundary matrices, and gap discipline.
- **Ticket**: GH-232 — M1-S8: OSS retro pipeline (binding AC 1 and binding AC 2 verbatim in spec §17).

## 3. Coverage Overview

### 3.1 Functional Coverage (F-#, AC-#)

| AC | Criterion (abbreviated) | TC ID(s) | Status |
|----|--------------------------|----------|--------|
| AC-F1-1 | `change` level auto-targets the most recent completed change not yet collected; collection consumes only delivered GET-only sources; the run is recorded with counts and consumed chain verdicts; re-collection appends an addendum and rewrites nothing | TC-RETRO-009, TC-RETRO-015, TC-RETRO-016, TC-RETRO-018 | Covered |
| AC-F1-2 | The audit ledger is read through its bounded surface within its documented bounds; every skipped-ordinal finding and the full chain verdict are carried into evidence verbatim, none dropped | TC-RETRO-017 | Covered |
| AC-F1-3 | Omitted `--level` defaults to `change`; an unknown name and a declared-but-unimplemented name each refuse `input.value.rejected` (exit 1) before any I/O, the latter with an owning-story hint | TC-RETRO-006, TC-RETRO-015, TC-RETRO-058, TC-RETRO-059 | Covered |
| AC-F2-1 | Every collected item is one append-only record carrying a unique `ev-` trace id, level, source, explicit window bounds, injected-clock timestamp, claimed identity, payload refs, and chain link; no update/delete/reorder/compaction path exists | TC-RETRO-008, TC-RETRO-009, TC-RETRO-019, TC-RETRO-054 | Covered |
| AC-F2-2 | The chaining key appears nowhere except as store-managed key material beside the sidecar (distinct artifact and bytes from the audit key); unaltered history verifies from a later process with zero false breaks | TC-RETRO-010, TC-RETRO-011, TC-RETRO-012, TC-RETRO-013, TC-RETRO-026 | Covered |
| AC-F2-3 | **Binding AC 2** — content edit, deletion, reorder, tail truncate-and-reappend, and recomputed-unkeyed-checksum edits are detected; the break names position and trace id; the command fails `retro.evidence.tamper-flagged` (exit 1); altered records are never verified findings; key substitution fails naming the domain | TC-RETRO-004, TC-RETRO-021, TC-RETRO-022, TC-RETRO-023, TC-RETRO-024, TC-RETRO-025, TC-RETRO-026, TC-RETRO-027, TC-RETRO-029, TC-RETRO-039 | Covered |
| AC-F2-4 | A write outside the collector seam or from a delivery-agent context is refused `retro.evidence.denied` (exit 2), the sidecar is unmodified, and the refusal is documented as write-path ownership plus claimed-identity marking, not authentication | TC-RETRO-004, TC-RETRO-053, TC-RETRO-054 | Covered |
| AC-F3-1 | Multiple altered records each report a break naming position and trace id, never payload or checksum bytes; verification continues over the sequence; a reported explicit-salvage removal is distinguished from a break | TC-RETRO-014, TC-RETRO-020, TC-RETRO-021, TC-RETRO-022, TC-RETRO-023, TC-RETRO-024, TC-RETRO-025, TC-RETRO-026, TC-RETRO-027, TC-RETRO-028 | Covered |
| AC-F4-1 | **Binding AC 1** — a malformed entry (missing field, unknown payload schema, undeclared kind, closed-vocabulary violation) in the sidecar or the retro registry classifies in-band as `retro.evidence.malformed-entry` (exit 1) naming its position; every valid entry is processed and rendered; pre-existing evidence is byte-unchanged; no crash and no silent drop | TC-RETRO-004, TC-RETRO-030, TC-RETRO-031, TC-RETRO-034 | Covered |
| AC-F4-2 | The full shape-crash-guard matrix produces valid-entry output byte-identical to the clean run, the bounded partial-run facts in the error summary, an error-only envelope; store-level damage classifies through state identities as unreachable (exit 2) with salvage as the only recovery | TC-RETRO-013, TC-RETRO-032, TC-RETRO-033, TC-RETRO-034, TC-RETRO-063 | Covered — exit assertion for the permission-violation class is **TODO** (GAP-T3 / OQ-T1) |
| AC-F5-1 | Clean report renders exactly the versioned `{level, findings[], followThrough[], evidenceRefs[]}` shape at exit 0; findings fold only from recorded evidence and mechanical checks, each evidence-linked; follow-through folds only recorded entries with artifact-verified markers; zero model calls; byte-identical replays | TC-RETRO-001, TC-RETRO-003, TC-RETRO-006, TC-RETRO-035, TC-RETRO-036, TC-RETRO-038, TC-RETRO-039, TC-RETRO-040, TC-RETRO-063 | Covered |
| AC-F5-2 | A verified-empty fold with passing truth checks renders an explicit empty report at exit 0; no finding is fabricated to justify the run | TC-RETRO-037, TC-RETRO-046, TC-RETRO-048 | Covered |
| AC-F6-1 | Each of the five triggers surfaces as an explicit named finding (or blocks a clean exit for the zero-collector and broken-verdict cases); verified-empty is explicit evidence naming its check; no fabrication; every check has a triggerable negative fixture; removing or disabling a check fails the suite | TC-RETRO-017, TC-RETRO-041, TC-RETRO-042, TC-RETRO-043, TC-RETRO-044, TC-RETRO-045, TC-RETRO-046, TC-RETRO-047, TC-RETRO-048 | Covered — exact identity/exit for two triggers is **TODO** (GAP-T5 / OQ-T3) |
| AC-F7-1 | An explicit destination plus a required limit produces a bounded deterministic bundle with trace ids, watermarks and the full chain verdict, in-band truncation, redaction applied, and no store mutation; a missing destination or invalid limit refuses classified; no unbounded path exists | TC-RETRO-049, TC-RETRO-050, TC-RETRO-051, TC-RETRO-052 | Covered at engine level — invoking surface and refusal projection are **TODO** (GAP-T4 / OQ-T2) |
| AC-F8-1 | R1–R6 are declared with the closed status vocabulary; reads and writes classify valid/verified-empty/torn/unknown distinctly with repair guidance and never a silent zero; a malformed registry entry classifies without crashing; `state check` reports the retro registry verdict | TC-RETRO-001, TC-RETRO-007, TC-RETRO-031, TC-RETRO-055, TC-RETRO-056, TC-RETRO-057 | Covered |
| AC-F9-1 | The registered periodic memory-audit trigger with its declared cadence records its run as evidence (trigger identity, window, outcome refs, trace ids), queryable through `retro report`, while the procedure stays in the memory consolidation skill and no new command exists | TC-RETRO-060 | Covered |

All 16 acceptance criteria map to at least one automated case. Both binding ticket ACs are covered by dedicated matrices, not by a single smoke case: binding AC 1 by the 24-case entry-level matrix plus the five-case store-level matrix and the byte-equality oracle (TC-RETRO-030..034), binding AC 2 by the six-class mutation matrix plus the recomputed-checksum proof and the completeness meta-check (TC-RETRO-021..029). Three ACs carry explicit TODO markers where the spec's pinned outcome cannot be produced by the delivered contract (GAP-T3, GAP-T4, GAP-T5); those are reporting gaps, not silent omissions.

**Capability coverage** (no capability unlinked): F-1 → TC-RETRO-009, 015, 016, 017, 018, 019; F-2 → TC-RETRO-008, 010, 011, 012, 013, 026, 053, 054; F-3 → TC-RETRO-014, 020..027, 028, 039; F-4 → TC-RETRO-030..034, 063; F-5 → TC-RETRO-035, 036, 037, 038, 040, 063; F-6 → TC-RETRO-017, 041..048; F-7 → TC-RETRO-049..052; F-8 → TC-RETRO-001, 007, 055, 056, 057, 058, 059; F-9 → TC-RETRO-060; F-10 → TC-RETRO-004, 005, 013, 030, 032, 033, 053, 063.

### 3.2 Interface Coverage (EVT-#, DM-#)

The spec declares no `API-#` (no network surface; §8.1) and exactly two event kinds.

| Interface | Element | TC ID(s) | Observable assertion |
|-----------|---------|----------|----------------------|
| EVT-1 | Evidence sidecar record | TC-RETRO-008, TC-RETRO-032, TC-RETRO-054, TC-RETRO-060 | One append-only record per collected item with the full field set; schema id and chain link present; no secret, key, or checksum bytes |
| EVT-2 | Retro run record | TC-RETRO-018, TC-RETRO-057 | One additive validated record per collect/report run: run id, level, mode, scope, counts, consumed chain verdicts, truth verdict |
| DM-1 | Level registry entries | TC-RETRO-001, TC-RETRO-007, TC-RETRO-057 | Exactly six declared levels; name/scope kind/trigger/status; closed `implemented`/`declared` vocabulary; `change` implemented |
| DM-2 | Sidecar record shape | TC-RETRO-001, TC-RETRO-008, TC-RETRO-010, TC-RETRO-054 | Exact field set, `ev-` trace ids unique per sidecar, window bounds ordered and explicit, injected-clock epoch ms, claimed marker, payload refs, chain value |
| DM-3 | Sidecar chaining-key artifact | TC-RETRO-010, TC-RETRO-011, TC-RETRO-013 | Distinct path and bytes from the audit key; created once; `0600`; verified on open; never in records, output, config, ambient or lane environment |
| DM-4 | Sidecar chain verdict | TC-RETRO-020, TC-RETRO-027, TC-RETRO-049 | `verified`, record count, breaks (position and trace id), anchor reference; substitution reported as a verification failure naming the domain |
| DM-5 | Retro run record shape | TC-RETRO-018, TC-RETRO-040, TC-RETRO-057 | Validated at the boundary; counts and consumed verdicts; first-class input to report folding |
| DM-6 | Report data shape | TC-RETRO-035, TC-RETRO-036, TC-RETRO-037 | Exactly the four `data` keys; finding entries carry kind, text and evidence refs; follow-through carries action, verdict and a verified artifact reference only when checked |
| DM-7 | Export bundle shape | TC-RETRO-049, TC-RETRO-051, TC-RETRO-052 | Declared export schema identity; selected records with trace ids and watermarks; full chain verdict; bounded with in-band truncation |
| DM-8 | Retro error identities | TC-RETRO-004, TC-RETRO-005, TC-RETRO-030, TC-RETRO-053 | Exactly three `retro` rows; exact-code resolution; kind-only `retro` never used; documented table identical in both directions |

### 3.3 Non-Functional Coverage (NFR-#)

| NFR | Requirement (threshold) | TC ID(s) | Status |
|-----|--------------------------|----------|--------|
| NFR-1 | 100 % of shape-crash-guard cases classify (0 uncaught crashes); 0 valid-entry loss; 0 byte differences in valid-entry output versus the clean run; 0 store mutations from a classified read | TC-RETRO-030, TC-RETRO-031, TC-RETRO-032, TC-RETRO-034, TC-RETRO-055 | Covered |
| NFR-2 | 100 % of mutation-suite alterations flagged naming position; 0 false verified verdicts on unaltered history; 100 % of key substitutions detected naming the domain | TC-RETRO-021, TC-RETRO-022, TC-RETRO-023, TC-RETRO-024, TC-RETRO-025, TC-RETRO-026, TC-RETRO-027, TC-RETRO-029 | Covered |
| NFR-3 | 0 key occurrences outside the store-managed artifact and runtime-edge-injected data; 0 false chain breaks verifying unaltered history from a later process | TC-RETRO-010, TC-RETRO-011, TC-RETRO-012, TC-RETRO-062 | Covered |
| NFR-4 | 0 rewrite paths; 0 read-path mutations; 0 unsynchronized appends | TC-RETRO-008, TC-RETRO-009, TC-RETRO-019, TC-RETRO-053 | Covered |
| NFR-5 | 0 unbounded read or export paths; 100 % of truncated results report truncation in-band | TC-RETRO-049, TC-RETRO-050, TC-RETRO-051, TC-RETRO-017 | Covered at engine level; export invocation is TODO (GAP-T4) |
| NFR-6 | 0 output drift across identical replays; 0 ambient clock, environment, or filesystem reads outside declared seams | TC-RETRO-038, TC-RETRO-062 | Covered |
| NFR-7 | Collect ≤ 30 s, report ≤ 10 s, export ≤ 10 s on a 10,000-record sidecar; audit read within documented bounds | TC-RETRO-061 | Covered by bounded work in CI plus a non-CI reference measurement (GAP-T2) |
| NFR-8 | 3/3 `retro` rows round-trip; 0 documented-table drift in either direction; 0 unclassified retro failures escape containment | TC-RETRO-004, TC-RETRO-005, TC-RETRO-013 | Covered |
| NFR-9 | 0 new runtime-API locations; 0 contracts-tier behaviour; 0 forbidden literals; 0 always-on registrations | TC-RETRO-001, TC-RETRO-002, TC-RETRO-003, TC-RETRO-006, TC-RETRO-062 | Covered |
| NFR-10 | 0 edge-registered secret survivors in any evidence record, finding, report, or bundle | TC-RETRO-052, TC-RETRO-064 | Covered |

### 3.4 Gap Check (coverage-matrix integrity)

- **Uncovered ACs**: none unlisted. Three ACs have pinned-outcome TODOs (AC-F4-2 exit for permission violations, AC-F7-1 invoking surface, AC-F6-1 exit for two triggers) and are marked rather than faked; all three are raised in §8.3.
- **Orphan TCs**: none. Every one of the 64 TCs names at least one AC, form, or NFR in §5.1 and §5.2.
- **Uncovered NFRs**: none. NFR-7's CI-verifiable bounded-work half is covered; its wall-clock thresholds are explicitly reference-only (GAP-T2).
- **Intentional duplicate coverage**: AC-F2-3 spans nine TCs because each alteration class is a distinct failure mode with a distinct fixture and oracle; AC-F4-1 spans four because the sidecar and registry are different boundaries and the byte-equality oracle is a separate property; AC-F5-1 spans nine because shape, fold provenance, follow-through, determinism, verified read, registry folding, envelope, and render purity fail independently; AC-F8-1 spans six because declaration, refusal, verdict matrix, malformed entry, doctor visibility, and record shapes are separate boundaries.
- **Spec-named behaviours bound to an existing AC or NFR** (no dedicated AC by design):

| Behaviour | Spec source | Bound AC/NFR | Where |
|---|---|---|---|
| Wholesale sidecar deletion (with its key) surfaces as a store condition, not a chain break | TDR-0009 negative outcomes | AC-F3-1 (break semantics) + AC-F4-2 (store taxonomy) | TC-RETRO-014 |
| Chain-link computation excludes the record's own chain value and uses canonical ordering | TDR-0009 construction pin | AC-F2-3 + NFR-2 | TC-RETRO-020, TC-RETRO-025 |
| Collector is trusted by construction; the guarantee defends the delivery plane, not the learning plane against itself | TDR-0009 residual risk | AC-F2-4 (honest scoping) | TC-RETRO-053 (documentation assertion) |
| Collection fence covers pre-append read, link computation, and appends | DEC-13 | AC-F2-1 + NFR-4 | TC-RETRO-019 |
| Report folds the level's most recent collected scope | F-5 / OQ-3 | AC-F5-1 | TC-RETRO-040 |
| `state check` store verdict extension | F-8 / M1-S2 contract | AC-F8-1 | TC-RETRO-056 |
| No `--ref` argument and no new flags | §8.5 locked surface | AC-F1-3 | TC-RETRO-059 |

### 3.5 Coverage Matrix (requirement × suite)

Legend: `x` = the suite asserts the requirement. Suite columns: `RCT` = `tests/structure/retro-contract.test.ts`; `RIM` = `tests/structure/retro-imports.test.ts`; `INV` = `scripts/checks/retro-render-purity.ts` + `scripts/checks/retro-key-containment.ts` and their `tests/checks/` mutation suites; `ERR` = `tests/structure/error-table.test.ts` + `tests/checks/error-table-sync.test.ts`; `EDG` = `tests/structure/cli-edge-seam.test.ts`; `APP` = `tests/behaviour/retro-sidecar-append.test.ts` + `retro-key-artifact.test.ts`; `CHN` = `tests/behaviour/retro-chain.test.ts` + `retro-chain-mutations.test.ts` + `retro-chain-cross-process.test.ts` + `retro-chain-salvage.test.ts`; `MAL` = `tests/behaviour/retro-malformed.test.ts`; `COL` = `tests/behaviour/retro-collect.test.ts` + `retro-registry.test.ts`; `REP` = `tests/behaviour/retro-report.test.ts` + `retro-report-determinism.test.ts`; `TRU` = `tests/behaviour/retro-truth-checks.test.ts` + `tests/checks/retro-truth-check-mutants.test.ts`; `EXP` = `tests/behaviour/retro-export.test.ts`; `SRF` = `tests/behaviour/retro-levels.test.ts` + `retro-denied.test.ts` + `retro-memory-audit.test.ts`; `DOC` = `tests/behaviour/doctor-state.test.ts`; `OPS` = `tests/behaviour/retro-performance.test.ts` + `retro-hermetic.test.ts` + `retro-output.test.ts` + `retro-privacy.test.ts`; `GATE` = `pnpm check`.

| Requirement | RCT | RIM | INV | ERR | EDG | APP | CHN | MAL | COL | REP | TRU | EXP | SRF | DOC | OPS | GATE |
|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|
| AC-F1-1 |  |  |  |  | x | x |  |  | x |  |  |  |  |  |  | x |
| AC-F1-2 |  |  |  |  |  |  |  |  | x |  | x |  |  |  |  | x |
| AC-F1-3 |  |  |  |  | x |  |  |  | x |  |  |  | x |  |  | x |
| AC-F2-1 | x |  |  |  |  | x | x |  | x |  |  |  | x |  |  | x |
| AC-F2-2 | x |  | x |  |  | x | x |  |  |  |  |  |  |  | x | x |
| AC-F2-3 |  |  |  | x |  |  | x |  |  | x |  |  |  |  | x | x |
| AC-F2-4 |  |  |  | x |  | x |  |  |  |  |  |  | x |  |  | x |
| AC-F3-1 |  |  |  |  |  |  | x |  |  | x |  |  |  |  |  | x |
| AC-F4-1 |  |  |  | x |  |  |  | x |  |  |  |  |  |  |  | x |
| AC-F4-2 |  |  |  |  |  |  |  | x |  |  |  |  |  |  | x | x |
| AC-F5-1 | x |  | x |  | x |  |  |  |  | x |  |  |  |  | x | x |
| AC-F5-2 |  |  |  |  |  |  |  |  |  | x | x |  |  |  |  | x |
| AC-F6-1 |  |  |  |  |  |  |  |  | x |  | x |  |  |  |  | x |
| AC-F7-1 |  |  |  |  |  |  |  |  |  |  |  | x |  |  | x | x |
| AC-F8-1 | x |  |  |  |  |  |  | x | x |  |  |  |  | x |  | x |
| AC-F9-1 |  |  |  |  |  |  |  |  | x | x |  |  | x |  |  | x |
| EVT-1 | x |  |  |  |  | x |  | x |  |  |  |  | x |  |  | x |
| EVT-2 | x |  |  |  |  |  |  |  | x |  |  |  |  |  |  | x |
| DM-1 | x |  |  |  |  |  |  |  | x |  |  |  | x |  |  | x |
| DM-2 | x |  |  |  |  | x |  |  |  |  |  |  | x |  |  | x |
| DM-3 |  |  | x |  |  | x |  |  |  |  |  |  |  |  |  | x |
| DM-4 |  |  |  |  |  |  | x |  |  |  |  | x |  |  |  | x |
| DM-5 | x |  |  |  |  |  |  |  | x | x |  |  |  |  |  | x |
| DM-6 |  |  |  |  |  |  |  |  |  | x |  |  |  |  |  | x |
| DM-7 |  |  |  |  |  |  |  |  |  |  |  | x |  |  |  | x |
| DM-8 |  |  |  | x |  |  |  | x |  |  |  |  | x |  |  | x |
| NFR-1 |  |  |  |  |  |  |  | x | x |  |  |  |  |  |  | x |
| NFR-2 |  |  |  |  |  |  | x |  |  |  |  |  |  |  |  | x |
| NFR-3 |  |  | x |  |  | x | x |  |  |  |  |  |  |  | x | x |
| NFR-4 |  |  |  |  |  | x | x |  |  |  |  |  | x |  |  | x |
| NFR-5 |  |  |  |  |  |  |  |  | x |  |  | x |  |  |  | x |
| NFR-6 |  |  |  |  |  |  |  |  |  | x |  |  |  |  | x | x |
| NFR-7 |  |  |  |  |  |  |  |  |  |  |  |  |  |  | x | x |
| NFR-8 |  |  |  | x |  |  |  |  |  |  |  |  |  |  |  | x |
| NFR-9 | x | x | x |  | x |  |  |  |  |  |  |  |  |  | x | x |
| NFR-10 |  |  |  |  |  |  |  |  |  |  |  |  |  |  | x | x |

## 4. Test Types and Layers

| Layer | Runner / invocation | Location | Covers |
|-------|--------------------|----------|--------|
| Contract and vocabulary | `bun test tests/structure` | `tests/structure/retro-contract.test.ts`, `error-table.test.ts` (update) | TC-RETRO-001, 004, 007 |
| Boundary, purity and confinement | `bun test tests/structure tests/boundaries`; `bun run scripts/checks/{retro-render-purity,retro-key-containment,ambient-globals,secret-read-boundary,workspace-entrypoints,exit-code-literals,forbidden-literals}.ts` | `tests/structure/retro-imports.test.ts`; `tests/checks/retro-render-purity.test.ts`, `retro-key-containment.test.ts` | TC-RETRO-002, 003, 011 (static half), 006 |
| Error identity and sync | `bun test tests/structure tests/checks`; `bun run scripts/checks/error-table-sync.ts` | `tests/structure/error-table.test.ts`, `tests/checks/error-table-sync.test.ts` (update) | TC-RETRO-004, 005 |
| Behaviour — sidecar append and key | `bun test tests/behaviour` | `tests/behaviour/retro-sidecar-append.test.ts`, `retro-key-artifact.test.ts` | TC-RETRO-008, 009, 010, 011, 012, 013, 019 |
| Behaviour — chain and mutations | `bun test tests/behaviour` | `tests/behaviour/retro-chain.test.ts`, `retro-chain-mutations.test.ts`, `retro-chain-cross-process.test.ts`, `retro-chain-salvage.test.ts` | TC-RETRO-014, 020..029 |
| Behaviour — malformed entries | `bun test tests/behaviour` | `tests/behaviour/retro-malformed.test.ts` | TC-RETRO-030..034 |
| Behaviour — collect and registry | `bun test tests/behaviour` | `tests/behaviour/retro-collect.test.ts`, `retro-registry.test.ts` | TC-RETRO-015, 016, 017, 018, 055, 057 |
| Behaviour — report | `bun test tests/behaviour` | `tests/behaviour/retro-report.test.ts`, `retro-report-determinism.test.ts` | TC-RETRO-035..040 |
| Behaviour — pipeline truth | `bun test tests/behaviour tests/checks` | `tests/behaviour/retro-truth-checks.test.ts`, `tests/checks/retro-truth-check-mutants.test.ts` | TC-RETRO-041..048 |
| Behaviour — export | `bun test tests/behaviour` | `tests/behaviour/retro-export.test.ts` | TC-RETRO-049..052 |
| Behaviour — surfaces | `bun test tests/behaviour` | `tests/behaviour/retro-levels.test.ts`, `retro-denied.test.ts`, `retro-memory-audit.test.ts` | TC-RETRO-053, 054, 058, 059, 060 |
| Doctor state check | `bun test tests/behaviour` | `tests/behaviour/doctor-state.test.ts` (update) | TC-RETRO-056 |
| Performance, hermeticity, output, privacy | `bun test tests/behaviour` | `tests/behaviour/retro-performance.test.ts`, `retro-hermetic.test.ts`, `retro-output.test.ts`, `retro-privacy.test.ts` | TC-RETRO-038 (runtime half), 061, 062, 063, 064 |
| Aggregate and non-regression | `pnpm check` | repo root; unchanged gates | All TCs (regression half) |

### 4.1 In-Process Two-Store Harness Contract (binding for every retro TC)

1. **No real process, network, host home, or user state directory.** Every retro suite imports the production modules and injects fakes and a per-test temp root. No suite spawns a process, opens a socket, reads `$HOME`, or writes the live tree. Cross-process continuity is modelled by opening the same temp state directory with a second, freshly constructed store/edge instance; a separate documented probe spawns nothing (the GH-223 precedent).
2. **One state-directory harness, four injected reads.** `tests/fixtures/retro/harness.ts` exposes:
   - `makeRetroDir()` — a fresh `mkdtemp` root with the synthetic workspace id; returns paths for the sidecar family, the retro registry store, the audit ledger, and derived documents.
   - `writeSidecar(records)`, `readSidecarBytes()`, `appendSidecarRecord(record)` — byte-level control so a test can mutate a record like a same-user adversary and snapshot bytes before/after a classified read.
   - `writeRegistry(entries)`, `readRegistryBytes()`, `writeLevels(levels)` — for the retro registry boundary matrix.
   - `scriptAuditRead(outcome)` — returns a scripted `AuditReadOutcome` (records, `matched`, `truncated`, `chain.verified`, `chain.breaks`, `chain.orphans`, `verifiedEmpty`) and records the query (`limit`, filters) so the bounded-read assertion is on the recorded argument, not an inferred behaviour.
   - `scriptStateFamilies({transitions, closeouts, telemetry})` and `scriptNotes({retroNotes})` — GET-only source fakes that record every read call.
   - `runRetro(argv, deps)` — composes the command through the in-process `runCli` surface with buffer streams and injected clock (`NOW_MS`), run-id factory, brand, mode fact, identity/environment record, and registered secrets.
3. **Injected time, ids, identity, and brand.** `NOW_MS = Date.UTC(2026, 10, 6, 12, 0, 0)`; `newRunId` is a fixed sequence; `newTraceId` is a fixed `ev-` sequence for determinism cases and a runtime counter for uniqueness cases; the brand is `SYNTHETIC_BRAND`; the identity is an injected environment record, never an ambient read.
4. **Test key material is synthetic and allowlisted.** `tests/fixtures/retro/key-artifact.json` holds a fixed, non-production 32-byte key used only by chain tests. It is the single registered exception in `scripts/checks/retro-key-containment.ts`; every other key-shaped literal in fixtures, goldens, or source is a failure. The production path generates keys at the runtime edge; no test asserts a generated value.
5. **Recorded arguments over inference.** Where the AC concerns what a seam receives (audit read limit and filters, source reads, fence acquisition, appends, key-artifact reads, export destination and limit), the test asserts the recorded argument.
6. **Adversary mutation is explicit and named.** Sidecar mutations happen through named helpers (`mutateContent`, `mutateDelete`, `mutateReorder`, `mutateTruncateReappend`, `mutateUnkeyedRecompute`, `substituteKey`) that return the exact byte offsets or record positions changed, so the expected break position is derived from the mutation, never guessed.
7. **Temp roots only.** Goldens, mutation copies, and whole-tree scans use `mkdtemp` under the OS temp directory or committed read-only fixtures. The live repository tree, `dist/`, and the user's real state directory are never written.

### 4.2 Non-Vacuity Contract (binding for every negative, absence, refusal and tamper case)

1. **A planted positive is asserted present before the absence is asserted.** A trace id, a finding trigger, a skipped ordinal, a malformed record, or a clean-chain control is asserted to exist in the fixture before the test asserts it is flagged, preserved, or refused.
2. **A paired live control runs in the same test.** Every tamper case runs beside a clean verification of the same fixture; every malformed case runs beside the equivalent clean run; every level refusal runs beside the accepted `change` invocation; every verified-empty case runs beside a case with one trigger; every truncation case runs beside a within-limit case; every composition-absent case runs beside a composition-present case.
3. **A detection-disabled mutant must fail the suite.** For each guard that could pass vacuously — the chain re-computation, the key-artifact open check, the entry-level schema check, the registry verdict classifier, each of the five truth checks, the export bound, the destination requirement, the composer registration — the suite imports a temp mutant copy of the production module through a file URL (the `tests/golden/redaction.test.ts` pattern) with the named step disabled and asserts the mutant produces the prohibited observable while the fixture still contains the trigger. If the real module also produced nothing, the test fails.
4. **No assertion depends on a moving base.** Every assertion reads the current tree, a committed fixture, or an isolated temp copy. No `git diff` against `origin/main-tools` is used anywhere in the permanent suite.
5. **Byte-equality is the data-loss oracle.** Preserved valid-entry output is compared byte-for-byte with the clean run's corresponding output after removing the flag line; counts alone never prove no data loss.
6. **Zero false verdicts is asserted in both directions.** Every mutation run asserts `verified: false` with the exact expected break; the clean control in the same test asserts `verified: true` with zero breaks. A mutant verifier that always returns `false` fails the control; a mutant that always returns `true` fails the mutation.

### 4.3 Normative Test-Case Table

This table is binding: a TC is complete only when every column is satisfied. `Level` names the layer and the primary suite. Exit codes are absolute (`0` success, `1` user-validation, `2` platform) unless the row is marked TODO.

| TC | AC / NFR | Level / suite | Fixture / fake | Steps (compact) | Oracle | Exit / observable | Non-vacuity control |
|----|----------|---------------|----------------|-----------------|--------|-------------------|---------------------|
| TC-RETRO-001 | AC-F5-1, AC-F8-1, DM-1..DM-8, EVT-1/2, NFR-9 | Contract / `retro-contract` | New contracts modules; AST scan | Parse the contracts; assert declaration-only; assert the closed level, status, finding-kind, follow-through-verdict, mode, and error-kind vocabularies; assert record/verdict/report/export shapes and the three retro codes | Zero executable statements; exact closed sets; six levels; three codes; distinct export/report schema constants | Exports load; no I/O member | A seeded function body, a widened vocabulary, or a fifth level in a temp copy fails |
| TC-RETRO-002 | NFR-9, AC-F2-1, AC-F5-1 | Static / `retro-imports` + boundaries | New source files; boundary harness; forbidden literals; content inventory | Scan imports and runtime conditionals; assert contracts data-only and core domain pure; assert production I/O only at the admitted state/collector seam; assert no new package/subpath/dependency; assert inventory and forbidden literals updated | Zero `node:*`/`bun:*` in contracts and domain; 0 new runtime-API locations; 0 forbidden literals; inventory complete | Suite green | Seeded `node:fs` in contracts, a new runtime import, and a seeded forbidden literal all fail |
| TC-RETRO-003 | AC-F5-1, NFR-9, RSK-6 | Static / `retro-render-purity` + checks | `scripts/checks/retro-render-purity.ts`; temp mutant copies | Assert collect/report/export folds import no inference adapter, provider client, model identifier, `fetch`, or ambient clock; run the invariant check with and without a planted model import | 0 model/inference/network imports in the render path; check exit 0 on the tree | Check exit 0; mutation test fails on the planted import | Planted inference import and a planted `fetch` each fail the check |
| TC-RETRO-004 | AC-F2-3, AC-F2-4, AC-F4-1, DM-8, NFR-8 | Contract / `error-table` + behaviour | `ERROR_TABLE`, `DOMAIN_KINDS`, trigger paths | Assert `retro` in `DOMAIN_KINDS` and exactly three `retro` rows with exact code/category/retryable/consequence/projection/summary/remediation; drive each through its trigger; assert kind-only throws and contains via `fallback.internal`; assert store conditions reuse state rows | 3/3 exact rows; tamper/malformed exit 1; denied exit 2; no fourth row | Codes reachable; envelopes carry the row fields | Removing one row, or switching a projection class to `platform-provider`, fails |
| TC-RETRO-005 | AC-F2-3, AC-F2-4, AC-F4-1, NFR-8 | Contract / `error-table-sync` | Sync check; documented table; temp copies | Run sync green with non-zero counts; assert each retro code appears once with matching columns; mutate machine and doc copies in both directions; remove `retro` from `DOMAIN_KINDS`; empty the documented table | 0 drift both directions; named offender per mutation; fail-closed on empty | Sync exit 0 on the tree, non-zero on every mutation | Unchanged control stays green; doc-only and machine-only drift both fail |
| TC-RETRO-006 | AC-F1-3, AC-F5-1, NFR-9 | Structure / `cli-edge-seam` | Program with and without the retro composition | Compose without `retro`; run `retro report`; compose with it; assert registration, handler has no stream write and no exit decision, and the optional-renderer set is extended exactly | Without composition `retro` is `fallback.invocation` exit 1; with composition it runs; edge owns rendering | Exit 1 then 0 | Both branches asserted; an always-on registration mutant fails |
| TC-RETRO-007 | AC-F8-1, DM-1 | Contract + Integration / `retro-contract` + `retro-registry` | Empty registry; seeded levels; contract constants | Assert the declared level set is exactly change/session/incident/window/project/fleet (R1–R6) with non-empty scope kind and trigger declarations; assert the status vocabulary is exactly implemented/declared and only `change` is implemented; assert registry read is verified-empty on an empty store | Six levels; closed vocabularies; one implemented; no silent zero | Success/verified-empty verdict | A seventh level, a free-text status, or two implemented levels fails |
| TC-RETRO-008 | AC-F2-1, DM-2, EVT-1, NFR-4 | Integration / `retro-sidecar-append` | Seeded sources; fixed clock and trace-id sequence | Run `retro collect`; parse every sidecar record; assert exactly one record per collected item; assert each field set and value source; assert trace ids `ev-` prefixed and unique; assert window start ≤ end and the timestamp equals `NOW_MS`; assert no update/delete/reorder/compaction member on the sidecar surface | Exact field set; unique ids; injected clock; append-only surface | Exit 0 | A fabricated timestamp, a duplicate trace id, or an added mutation member in a temp copy fails |
| TC-RETRO-009 | AC-F1-1, AC-F2-1, NFR-4 | Integration / `retro-sidecar-append` | Already-collected scope; byte snapshot | Collect, snapshot the sidecar bytes, collect the same scope again; assert an addendum record appended and the original prefix byte-identical; assert a read run leaves bytes and mtime unchanged | Prefix byte-equal; append-only; 0 read mutations | Exit 0 both runs | A rewrite mutant fails the byte-prefix comparison |
| TC-RETRO-010 | AC-F2-2, DM-3 | Integration / `retro-key-artifact` | Empty sidecar; audit key present; temp dir | First collect creates exactly one key artifact with runtime-edge bytes, `0600`, in the store-managed family; assert its path and bytes differ from `chain-key.<workspace>.json`; assert later collects reuse it; assert absence on a non-first open is never regenerated | One artifact; distinct path/bytes; 0600; never regenerated | Exit 0; permission and path assertions | A same-file or same-bytes mutant, and a silent-regeneration mutant, both fail |
| TC-RETRO-011 | AC-F2-2, NFR-3 | Integration + Check / `retro-key-artifact` + `retro-key-containment` | Lane-environment fixture; records; output; config; canary key | Collect; walk machine and human output, every record field, the resolved configuration, the ambient environment stub, and the lane-environment fixture; scan for the key value and key-shaped hex literals; assert the only occurrence is the key artifact (and the allowlisted test fixture) | 0 occurrences outside artifact and edge-injected data; canary present in the artifact first | Exit 0; scan counts positive | A planted key in a record or an output golden fails; the presence control proves the scan is live |
| TC-RETRO-012 | AC-F2-2, NFR-3, TDR-0009 C-5 | Integration / `retro-chain-cross-process` | Two store/edge instances over one temp dir | Write records with instance A; verify and append with instance B; assert zero breaks and a continuing chain; repeat with the key read through a fresh edge | 0 false breaks; chain continues | Exit 0; verdict verified | A per-process key mutant produces false breaks and fails |
| TC-RETRO-013 | AC-F2-2, AC-F4-2, NFR-8, TDR-0009 C-6 | Integration + Contract / `retro-key-artifact` | Key absent, corrupt, wrong-schema, `0644` | Assert absent on non-first open is `state.keys.missing`; corrupt/wrong-schema is `state.store.torn`; wrong bits is `state.permission.denied`; assert no new rows. Exit is asserted for the two platform rows; the permission-violation exit is **TODO** per GAP-T3 | Exact identities; 0 silent regeneration; no new rows | Exit 2 for keys.missing/store.torn; permission exit TODO | Each case paired with a valid-key control |
| TC-RETRO-014 | AC-F3-1, AC-F4-2, TDR-0009 | Integration / `retro-chain-salvage` | Sidecar plus key deleted; empty store | Delete the whole sidecar and key; run report; assert the outcome is a store condition (unreachable or verified-empty), never a chain break and never a false verified verdict; assert the diagnosis names the missing key/store | Store-level classification; no break claim | Exit 2 (or explicit verified-empty when the store is absent by policy) | The same fixture with a surviving key and one partial deletion yields a break; both directions asserted |
| TC-RETRO-015 | AC-F1-1, AC-F1-3 | Integration / `retro-collect` | Delivery registry with three completed and one incomplete change; one already collected | Run collect with omitted level; assert the selected scope is the most recent completed change not yet collected; assert deterministic ordering (completion desc, ref asc — A-T3); assert an in-flight change is never selected; assert an already-collected scope yields an addendum | Exact selected ref; deterministic tiebreak; no in-flight selection | Exit 0 | A newest-any-state mutant and a re-collect-rewrite mutant both fail |
| TC-RETRO-016 | AC-F1-1, NFR-4 | Integration / `retro-collect` | Scripted audit read, state families, notes; byte snapshots | Run collect; assert the audit read used the bounded surface with a positive limit and only declared filters; assert the three source families were read once each, GET-only; assert every source fixture byte-identical after the run | GET-only; bounded; 0 source mutations | Exit 0 | A write-to-source mutant and a second-read mutant fail |
| TC-RETRO-017 | AC-F1-2, AC-F6-1, NFR-5 | Integration / `retro-collect` + `retro-truth-checks` | Audit read with two orphans and a broken verdict; truncation flag | Run collect; assert both skipped-ordinal findings and the full chain verdict (verified, records, breaks, orphans) are carried into evidence and the run record verbatim; assert none is dropped or rewritten; assert a truncated audit read is reported in-band | Findings and verdict byte-equal to input; truncation reported | Exit 0 (finding present) | Dropping one orphan or summarising the verdict in a mutant fails |
| TC-RETRO-018 | AC-F1-1, EVT-2, DM-5, NFR-4 | Integration / `retro-collect` | Two consecutive runs | Run collect twice; assert one additive run record per run with run id, level, mode, scope, counts (collected/malformed/skipped-source), consumed verdicts and truth verdict; assert the records validate at the boundary and interleave safely with sidecar records | One record per run; exact fields; additive | Exit 0 | A rewrite-instead-of-append mutant fails |
| TC-RETRO-019 | AC-F2-1, NFR-4, DEC-13 | Integration / `retro-sidecar-append` | Two overlapping collect attempts with an armed fence hold | Start a collect holding the collector fence; run a second collect; assert it blocks or fails classified without interleaving, and that the resulting chain verifies with no duplicate/missing links; assert reads acquire no fence | One fence covers read + link + append; no interleaving | Exit 0 serialized (or classified busy) | A fence-outside-link mutant produces an interleaved chain and fails |
| TC-RETRO-020 | AC-F3-1, DM-4 | Integration / `retro-chain` | Clean three-record sidecar | Verify; assert `verified: true`, `records` exact, `breaks: []`, anchor reference present; assert the first link chains from the anchor and each subsequent from the previous; assert interleaved registry records do not participate | Verified verdict; anchor seeded; exact record count | Exit 0 | A wrong-anchor or includes-registry mutant fails |
| TC-RETRO-021 | AC-F2-3, AC-F3-1 | Integration / `retro-chain-mutations` | One content-edited record | Mutate a payload field, keep the stored link; run report; assert one break at the mutated position with its trace id, `retro.evidence.tamper-flagged` exit 1, and the altered record absent from served findings | Break at exact position; identity and exit; altered record not served | Exit 1 | Clean control in the same test is verified; an always-false verifier fails the control |
| TC-RETRO-022 | AC-F2-3, AC-F3-1 | Integration / `retro-chain-mutations` | Middle record deleted | Delete a middle record; verify; assert the break names the deletion boundary position and verification continues to later records | Flagged; later records still examined | Exit 1 | A skip-tail mutant fails |
| TC-RETRO-023 | AC-F2-3, AC-F3-1 | Integration / `retro-chain-mutations` | Two adjacent records swapped | Reorder; verify; assert the break names the first affected position and no other record is reported verified-then-trusted | Flagged; no trusted tail claim | Exit 1 | An order-insensitive mutant fails |
| TC-RETRO-024 | AC-F2-3, AC-F3-1 | Integration / `retro-chain-mutations` | Tail truncated and a record re-appended | Drop the tail, append a copy/edited record; verify; assert the break at the truncation boundary; assert an appended record under a stale previous link is flagged | Flagged; boundary named | Exit 1 | A truncation-only mutant that resets the anchor fails |
| TC-RETRO-025 | AC-F2-3, NFR-2, TDR-0009 C-3 | Integration / `retro-chain-mutations` | Edited record with a recomputed unkeyed link | Recompute `unkeyedDigest(prev, canonicalContent)` and store it; assert verification rejects it; assert a temp mutant verifier that uses the unkeyed construction accepts the same fixture (proving the keyed construction is load-bearing) | Flagged; unkeyed mutant accepts the forgery and fails the suite | Exit 1 | Clean control verifies; the unkeyed-verifier mutant is demonstrably non-vacuous |
| TC-RETRO-026 | AC-F2-3, AC-F2-2 | Integration / `retro-chain-mutations` | Valid sidecar; substituted key artifact | Replace the key with a different valid key; verify; assert a verification failure naming the affected domain, never a clean verified verdict | Substitution detected; domain named | Exit 1 | Rewriting the old key back verifies clean |
| TC-RETRO-027 | AC-F2-3, AC-F3-1, DM-4 | Integration / `retro-chain` | Three independent alterations | Verify; assert exactly three breaks, every position and trace id present, no payload/checksum/key bytes in the verdict or diagnostics, partial output lists only preserved entries plus the flags | All breaks reported; verification continued; no byte leakage | Exit 1 | A first-break-only mutant fails the count assertion |
| TC-RETRO-028 | AC-F3-1 | Integration / `retro-chain-salvage` | Reported salvage of a trailing frame | Run the explicit salvage with the reported removal; verify; assert the removal is not a break, verification continues over the surviving sequence, and the next append chains from the last survivor | 0 breaks; chain continues | Exit 0 | A silent-removal (unreported) mutant produces a break and fails |
| TC-RETRO-029 | AC-F2-3, NFR-2, RSK-4 | Contract + Integration / `retro-chain-mutations` | Mutation-class registry; one fixture per class | Assert the suite covers every pinned class (content edit, deletion, reorder, truncate-and-reappend, unkeyed recompute, key substitution) with a fixture and an expected verdict; disable one class and assert the meta-test fails | 6/6 classes present; removing one fails | Meta-test green | A coverage-registry mutant missing a class fails |
| TC-RETRO-030 | AC-F4-1, NFR-1 | Integration / `retro-malformed` | 4 malformation classes × 3 positions in the sidecar | For each case run report; assert `retro.evidence.malformed-entry` exit 1 naming the position; assert every other entry processed and rendered; assert the sidecar bytes unchanged and no crash | 12/12 classify; position named; valid entries preserved | Exit 1 | Clean run control; a crash or drop mutant fails |
| TC-RETRO-031 | AC-F4-1, AC-F8-1, NFR-1 | Integration / `retro-malformed` | Same 12-case matrix in the retro registry | For each case run collect and report; assert the same classification, no crash, and no silent zero; assert valid run/level entries still fold | 12/12 classify; no silent zero | Exit 1 | Clean registry control; an ignore-malformed mutant fails |
| TC-RETRO-032 | AC-F4-2, DEC-12 | Integration / `retro-malformed` | One malformed entry; equivalent clean fixture | Compare the preserved valid-entry output byte-for-byte with the clean run; assert the error summary carries entries processed, entries preserved and the first flagged position; assert the envelope has `error` and no `data`; assert the human channel prints preserved output before the diagnostic | Byte-identical preserved output; exact partial-run facts; error-only envelope | Exit 1 | A drops-last-valid-entry mutant and a data+error mutant both fail |
| TC-RETRO-033 | AC-F4-2, DEC-7 | Integration / `retro-malformed` | Framing tear, sequence discontinuity, unreadable file, missing key on non-first open, `0644` | Run report and collect per case; assert the state identity and the fail-closed refusal; assert explicit salvage is the only recovery and the pre-salvage read never serves partial records | State identities; no partial truth | Exit 2 for keys.missing/store.torn; permission exit **TODO** (GAP-T3) | Each case paired with a repaired-store control that succeeds |
| TC-RETRO-034 | AC-F4-1, AC-F4-2, NFR-1 | Integration / `retro-malformed` | The full 24-entry matrix plus 2+ simultaneous malformations | Run the matrix; assert zero uncaught exceptions, 100 % classification, preserved counts equal valid-entry counts, and a store digest unchanged in every case; assert no case silently succeeds | 0 crashes; 0 loss; 0 mutation | Exit 1 per case | The aggregate asserts a positive case count (non-vacuity floor) |
| TC-RETRO-035 | AC-F5-1, DM-6 | Integration / `retro-report` | Verified evidence and registry runs; one finding source per kind | Run report; assert `data` keys are exactly the four; assert finding entries carry kind/text/evidenceRefs and each kind is declared; assert `evidenceRefs` resolve; assert exit 0 | Exact key set; provenance; resolution | Exit 0 | An extra key, an unlinked finding, or an unresolved ref in a fixture fails |
| TC-RETRO-036 | AC-F5-1 | Integration / `retro-report` | Recorded follow-through entries: one verifiable artifact, one unverifiable | Run report; assert only recorded entries fold; assert the verified entry carries its artifact reference and verdict; assert the unverifiable entry is marked unverified and never claimed verified; assert an empty fold is `[]` | No invention; verified marker only when checked | Exit 0 | An invented entry or a claimed-verified unverifiable entry fails |
| TC-RETRO-037 | AC-F5-2, DM-6 | Integration / `retro-report` | Verified-empty evidence; all truth checks pass | Run report; assert explicit empty `findings[]`, explicit verified-empty evidence naming the checks, exit 0, and zero fabricated findings | Null retro is success; no fabrication | Exit 0 | A fabricated-finding mutant fails; one-trigger control produces exactly one finding |
| TC-RETRO-038 | AC-F5-1, NFR-6 | Integration / `retro-report-determinism` | Fixed state, clock, flags, ids; throwing ambient stubs | Run report three times; assert byte-identical stdout and deep-equal data; install throwing `Date.now`/`Math.random`/`fetch` stubs and rerun; assert unchanged; assert a model-seam spy records zero calls | 0 drift; 0 ambient reads; 0 model calls | Exit 0 | A `Date.now()` renderer mutant and a spying inference call both fail |
| TC-RETRO-039 | AC-F2-3, AC-F3-1, AC-F5-1 | Integration / `retro-report-determinism` | Tampered sidecar | Run report; assert it performs the verified read, fails `retro.evidence.tamper-flagged` exit 1, and never serves the altered record in `findings` or `evidenceRefs` | Verified read on the report path; no silent trust | Exit 1 | Clean control report succeeds in the same test |
| TC-RETRO-040 | AC-F5-1, DM-5 | Integration / `retro-report` | Two collected scopes; one older run record | Run report; assert it folds the most recent collected scope's run records and sidecar evidence, and that counts/verdicts come from the run record | Scope selection; run-record fold | Exit 0 | An oldest-scope mutant and an ignores-run-record mutant fail |
| TC-RETRO-041 | AC-F6-1 | Integration / `retro-truth-checks` | Audit read with two orphans | Run collect and report; assert each orphan surfaces as a named finding with evidence refs and appears in the run record's truth verdict; assert none is dropped | 2/2 findings; linked; never dropped | Exit 0 (findings present) | A drops-orphans mutant fails |
| TC-RETRO-042 | AC-F6-1 | Integration / `retro-truth-checks` | Audit read with `chain.verified: false` | Run collect and report; assert a named finding carries the broken verdict; assert the run does not report a clean truth verdict. Exact identity/exit **TODO** (GAP-T5) | Finding present; not clean | Exit TODO (GAP-T5) | A clean-verdict control and an ignore-broken-verdict mutant |
| TC-RETRO-043 | AC-F6-1 | Integration / `retro-truth-checks` | Report fold referencing a removed trace id | Run report; assert the dangling ref is a finding, is not served as a trusted ref, and the evidence ref list distinguishes unresolved refs | Dangling ref flagged | Exit 0 (finding present) | A resolver-that-fabricates mutant fails |
| TC-RETRO-044 | AC-F6-1 | Integration / `retro-truth-checks` | Completed change with zero audit records; closed change with no closeout record; quiet legitimate change | Run collect/report per fixture; assert both expected-activity-absent variants are findings, and the legitimate quiet case yields verified-empty instead | Findings vs verified-empty distinction | Exit 0 (findings present) | A conflating mutant (finding on the quiet case, or silence on the active case) fails |
| TC-RETRO-045 | AC-F6-1 | Integration / `retro-truth-checks` | Source set non-empty; collector call log empty | Run collect; assert the zero-collector run is a finding and never a silent success. Exact identity/exit **TODO** (GAP-T5) | Finding present; no silent success | Exit TODO (GAP-T5) | A one-collector control is clean; a silent-success mutant fails |
| TC-RETRO-046 | AC-F5-2, AC-F6-1 | Integration / `retro-truth-checks` | Three legitimately empty sources; one with activity | Run report; assert explicit verified-empty evidence names each check that produced it; assert the active source is not labelled verified-empty; assert no finding is fabricated | Explicit verified-empty; no vacuum | Exit 0 | A vacuous-silence mutant (empty findings with no verified-empty evidence) fails |
| TC-RETRO-047 | AC-F6-1, RSK-4 | Integration / `retro-truth-check-mutants` | Five temp mutant copies, one check disabled each | Run the suite against each mutant; assert each mutant produces the prohibited observable (dropped finding, silent clean exit, fabricated verified-empty) and the suite fails | 5/5 mutants caught | Suite fails per mutant | The unmutated control passes |
| TC-RETRO-048 | AC-F5-2, AC-F6-1 | Integration / `retro-truth-checks` | Quiet fixture; single-trigger fixtures (one per trigger) | Assert findings count equals the number of triggered checks exactly, and the quiet fixture yields zero findings plus explicit verified-empty entries | Exact finding-to-trigger correspondence; no fabrication | Exit 0 | A fabricating mutant and a dropping mutant both fail |
| TC-RETRO-049 | AC-F7-1, DM-7, NFR-5 | Integration / `retro-export` | Explicit destination in temp dir; limit below population; chain verdict | Invoke the export engine; assert a deterministic bundle with the declared export schema identity, selected records with trace ids and watermarks, and the full chain verdict; assert truncation in-band; assert sidecar and registry bytes unchanged. Invoking surface **TODO** (GAP-T4) | Bounded bundle; truncation reported; 0 mutation | Engine success; surface exit TODO | Two runs byte-identical; a mutate-on-export mutant fails |
| TC-RETRO-050 | AC-F7-1, NFR-5 | Integration / `retro-export` | Missing destination; missing limit; 0; negative; non-integer; over-cap | Assert each request refuses classified before any write; assert no default destination exists; assert the export surface exposes no unbounded variant. Refusal identity/exit **TODO** (GAP-T4) | 0 bytes written; no default path; no unbounded API | Refusal exit TODO | The valid request succeeds as the paired control |
| TC-RETRO-051 | AC-F7-1, NFR-5 | Integration / `retro-export` | Population 5 with limit 5, 4 and 1 | Assert `truncated false` at exactly the population, `true` below it, and the returned count equals the limit; assert the bundle lists exactly the selected records | Boundary-exact truncation | Engine success | A `<`/`<=` mutant flips the boundary and fails |
| TC-RETRO-052 | AC-F7-1, NFR-10 | Integration / `retro-export` | Edge-registered secret canary in evidence | Run export; assert the canary appears zero times in the bundle while a control fixture proves the secret was present in the source; assert one serialization path | 0 secret survivors | Engine success | A bypass-chokepoint mutant exposes the canary and fails |
| TC-RETRO-053 | AC-F2-4, NFR-4, TDR-0009 | Integration / `retro-denied` | Direct sidecar append outside the collector seam; delivery-agent context probe | Attempt each write; assert `retro.evidence.denied` exit 2, `not_landed`, byte-identical sidecar before/after, and a diagnostic documenting write-path ownership plus claimed-identity marking as not authentication; assert no credential check is consulted | Refused; sidecar unmodified; honest wording | Exit 2 | A collector-seam append in the same test succeeds |
| TC-RETRO-054 | AC-F2-1, AC-F2-4, DM-2, EVT-1 | Integration / `retro-denied` | Identity present, absent, whitespace-only | Assert a present identity is recorded verbatim with the `claimed` marker; assert absent/blank records no identity and infers none; assert identity is never consulted as an authorization input (a delivery-agent-shaped value still succeeds through the collector seam and is still refused outside it) | Claimed attribution; no inference; no authorization semantics | Exit 0 / 2 by seam | A verification-of-identity mutant fails |
| TC-RETRO-055 | AC-F8-1, NFR-1 | Integration / `retro-registry` | Valid, empty, torn, unknown fixtures | Assert distinct verdicts valid/verified-empty/torn/unknown with repair guidance and never a silent zero; assert a write with a bad kind/schema/missing field/closed-vocabulary violation is refused `state.store.unknown` `not_landed` and appends nothing | Four distinct verdicts; classified write refusal | Exit 2 by class (read verdict is data) | Each verdict paired with a valid control; a zero-defaulting mutant fails |
| TC-RETRO-056 | AC-F8-1 | Integration / `doctor-state` | Doctor with a retro registry fact: valid-empty, torn, unknown, permission | Run doctor; assert the state check includes the retro registry store, reports `ok` for verified-empty and the `store-torn`/`store-unknown`/`store-unreadable` reasons with fix hints otherwise; assert the overall verdict follows the existing rules | Retro registry visible in `state check` | Doctor exit 0 / 1 by verdict | A doctor mutant omitting the retro store fails |
| TC-RETRO-057 | AC-F8-1, DM-1, DM-5, EVT-2 | Contract + Integration / `retro-registry` | Seeded level and run records | Assert exact level-entry fields (name, scope kind, trigger, status) and run-record fields (run id, level, mode, scope, counts, consumed verdicts, truth verdict); assert both kinds are additive, interleave with other kinds safely, and validate at the boundary | Exact field sets; additive | Success | A missing-field or widened-field mutant fails |
| TC-RETRO-058 | AC-F1-3, DM-1 | Integration / `retro-levels` | Level matrix §4.6; declared-only level fixtures; I/O spy | Run each refusal; assert `input.value.rejected`, exit 1, zero reads/appends, and a remediation hint containing the declared owning story for the level; assert the hint map covers all five declared-only levels | 5/5 hints; 0 I/O | Exit 1 | The `change` control runs; an empty-hint mutant fails |
| TC-RETRO-059 | AC-F1-3 | Integration / `retro-levels` | Omitted level; explicit level; extra positional; `--ref`; missing value | Assert omitted defaults to `change` for collect and report; assert `--level change` is equivalent; assert an extra positional or missing value is `input.value.rejected`; assert `--ref` is `fallback.invocation` (locked surface); assert `--json` is accepted globally | Default honoured; locked surface enforced | Exit 0 / 1 | A hidden-`--ref` mutant and an ignored-extra-positional mutant fail |
| TC-RETRO-060 | AC-F9-1, DM-1, EVT-1 | Integration / `retro-memory-audit` | Registry with the memory-audit trigger; one recorded run | Assert the trigger is registered with a declared cadence; append a run through the collector seam; assert the run evidence carries trigger identity, window, outcome refs and trace ids and is queryable through report; assert no memory-audit command exists in the command surface or edge composition; assert the procedure is not reimplemented (no skill body copied into source) | Trigger registered; run evidenced; no new command | Exit 0 | A missing-trigger and a new-command mutant both fail |
| TC-RETRO-061 | NFR-7, NFR-5 | Performance / `retro-performance` | Generated 10,000-record sidecar; query/append counters; soft budget | Assert one chain walk per read, bounded appends per collection, a positive audit-read limit, declared timeouts present, and per-record work linear; measure collect/report/export against the soft local budget and record the non-CI reference in §10 | Bounded work; reference numbers recorded, not gated | Exit 0 | A per-record extra-read mutant breaks the count invariance |
| TC-RETRO-062 | NFR-6, NFR-3, NFR-9 | Static + Integration / `retro-hermetic` | Suite files; committed fixtures; path scanner | Scan the retro suites for spawns, network, `$HOME`, ambient clock/env, real state paths, and writes outside temp roots; scan committed fixtures and goldens for key-shaped literals and real paths; assert a positive scan scope | 0 real dependencies; 0 key literals outside the allowlist | Suite green | A planted spawn and a planted key-shaped literal both fail |
| TC-RETRO-063 | AC-F4-2, AC-F5-1, F-10 | Integration / `retro-output` | Every success and failure class; both modes; goldens | Assert exactly one envelope per run; `data` XOR `error`; exact envelope keys; exit projection 0/1/2 per §4.8; scripted one-line discipline; human partial output before the diagnostic on exit 1 | Envelope/exit matrix exact | 0/1/2 by class | data+error, wrong-exit, and context-on-scripted-line mutants fail |
| TC-RETRO-064 | NFR-10, AC-F5-1 | Integration / `retro-privacy` | Canary secrets in sources and notes; all channels | Run collect, report, export; assert the canary appears zero times in records, findings, report, bundle, diagnostics and human text; assert the single chokepoint is the only serialization path | 0 survivors; one path | Exit 0 | A direct-serialization mutant exposes the canary and fails |

### 4.4 Tamper Mutation Matrix (binding for AC-F2-3 and NFR-2)

All mutations are applied to sidecar bytes on disk by the test adversary helper. Each row runs beside a clean verification of the same fixture. `P` = the mutated record's 1-based position; `T` = its trace id.

| ID | Mutation | Expected verdict | Identity / exit | Never served |
|----|----------|------------------|-----------------|--------------|
| M-01 | Content edit: change a payload value on record P, keep the stored link | Break at P, trace id T | `retro.evidence.tamper-flagged`, 1 | Record P is absent from findings and `evidenceRefs` |
| M-02 | Deletion: remove record P | Break at P (the successor's previous link diverges) | Same | All records at or after the gap are not trusted |
| M-03 | Reorder: swap adjacent records P and P+1 | Break at P | Same | Neither swapped record is served as verified |
| M-04 | Tail truncate-and-reappend: drop the tail, append a record (copy or edited) at the end | Break at the truncation boundary | Same | The reappended record is not served |
| M-05 | Edit with a recomputed unkeyed link: recompute `unkeyedDigest(prev, canonicalContent)` for record P | Break at P; an unkeyed-verifier mutant accepts the same bytes | Same | Record P is absent; the mutant proves the keyed construction is load-bearing |
| M-06 | Key-artifact substitution: replace the key with a different valid key | Verification failure naming the affected domain, not a record-position break alone | Same | Every record is untrusted; no verified verdict |
| M-07 | Multiple alterations: M-01 at P1 and M-02 at P2 | Both breaks reported, verification continues | Same | Both records untrusted; partial output preserved |
| M-08 | Wholesale deletion of sidecar and key | Store condition, not a break (TDR-0009) | State identity (exit 2), or explicit verified-empty where policy says absent-store-empty | No break claim and no verified verdict |

### 4.5 Shape-Crash-Guard Matrix (binding for AC-F4-1 and AC-F4-2)

Entry-level classes (each at first, middle and last position, in the sidecar and in the retro registry — 24 cases):

| ID | Malformation | Oracle |
|----|--------------|--------|
| E-01 | Missing required field (record shape) | `retro.evidence.malformed-entry`, position named, payload bytes absent |
| E-02 | Unknown payload schema id | Same |
| E-03 | Undeclared record kind | Same |
| E-04 | Closed-vocabulary violation (level, mode, or implementation status outside the declared set) | Same |

Every case additionally asserts: all other entries processed; preserved valid-entry output byte-identical to the clean run; sidecar/registry digest unchanged; no exception; error summary carries entries processed, entries preserved and the first flagged position; envelope carries `error` only. Multi-entry cases (two or more malformed records) assert every position is reported and the preserved count equals the valid count.

Store-level classes (fail closed, salvage is the only recovery):

| ID | Damage | Expected identity | Exit |
|----|--------|-------------------|------|
| S-01 | Framing tear (truncated or corrupt frame) | `state.store.torn` | 2 |
| S-02 | Sequence discontinuity | `state.store.torn` | 2 |
| S-03 | Unreadable sidecar file | `state.store.torn` (read failure) | 2 |
| S-04 | Missing key artifact on a non-first open | `state.keys.missing` | 2 |
| S-05 | Permission violation on the sidecar or key (`0644`) | `state.permission.denied` | **TODO — spec says 2, delivered row projects 1 (GAP-T3)** |

### 4.6 Level Refusal Matrix (binding for AC-F1-3)

| ID | Invocation | Expected identity | Exit | I/O |
|----|------------|-------------------|------|-----|
| L-01 | `retro collect` (omitted level) | success, level `change` | 0 | ≥ 1 source read |
| L-02 | `retro report` (omitted level) | success, level `change` | 0 | ≥ 1 sidecar read |
| L-03 | `retro collect --level change` | success | 0 | ≥ 1 |
| L-04 | `retro collect --level session` | `input.value.rejected` + owning-story hint | 1 | 0 |
| L-05 | `retro collect --level incident` | Same | 1 | 0 |
| L-06 | `retro collect --level window` | Same | 1 | 0 |
| L-07 | `retro collect --level project` | Same | 1 | 0 |
| L-08 | `retro collect --level fleet` | Same | 1 | 0 |
| L-09 | `retro collect --level Change` | `input.value.rejected` (exact closed vocabulary) | 1 | 0 |
| L-10 | `retro collect --level` (missing value) | `input.value.rejected` | 1 | 0 |
| L-11 | `retro collect --level change extra` | `input.value.rejected` | 1 | 0 |
| L-12 | `retro collect --ref GH-232` | `fallback.invocation` (locked surface) | 1 | 0 |
| L-13 | `retro report --level change --json` | success | 0 | ≥ 1 |
| L-14 | `retro` (no subcommand) and `retro inspect` | `input.value.rejected` | 1 | 0 |

### 4.7 Pipeline-Truth Trigger Matrix (binding for AC-F6-1)

| ID | Check | Trigger fixture | Expected observable | Paired control |
|----|-------|-----------------|---------------------|----------------|
| C-01 | Skipped ordinals surfaced | Audit read with two orphan reservations | 2 named findings with evidence refs, carried into the run record | Audit read with zero orphans yields no C-01 finding |
| C-02 | Audit chain verdict carried | Audit read with `verified: false` and one break | Named finding carrying the verdict; not a clean truth verdict; identity/exit **TODO** (GAP-T5) | Verified audit read yields no C-02 finding |
| C-03 | Evidence refs resolve | Report fold references a removed trace id | Dangling-ref finding; ref never served as trusted | All refs present yields no finding |
| C-04a | Expected activity absent (audit) | Completed change, zero audit invocations in window | Finding, not clean silence | Same change with one invocation yields no finding |
| C-04b | Expected activity absent (closeout) | Closed change with no closeout outcome record | Finding, not clean silence | Closed change with one closeout record yields no finding |
| C-05 | Zero collectors | Non-empty declared source set, empty collector call log | Finding, never silent success; identity/exit **TODO** (GAP-T5) | One collector run yields no finding |
| V-01 | Verified-empty is explicit | Three legitimately empty sources | Explicit verified-empty evidence naming each check; zero findings | A quiet window with expected activity produces C-04, not V-01 |

### 4.8 Exit and Identity Oracle

| Condition | Identity | Category | Retryable | Consequence | Projection class | Exit | TC |
|---|---|---|---|---|---|---|---|
| Malformed evidence entry, sidecar or registry | `retro.evidence.malformed-entry` | platform | false | not_landed | user-validation | 1 | 030, 031, 032, 034 |
| Sidecar chain break or key substitution | `retro.evidence.tamper-flagged` | platform | false | not_landed | user-validation | 1 | 021..027, 039 |
| Write outside the collector seam or from a delivery-agent context | `retro.evidence.denied` | platform | false | not_landed | platform-provider | 2 | 053 |
| Torn or unreadable sidecar/store | `state.store.torn` | platform | false | not_landed | platform-provider | 2 | 033 |
| Missing key on a non-first open | `state.keys.missing` | platform | false | not_landed | platform-provider | 2 | 013, 033 |
| Permission violation | `state.permission.denied` | user | false | not_landed | user-validation | 1 (spec says 2; **TODO** GAP-T3) | 013, 033 |
| Unknown or declared-but-unimplemented level; invalid or missing value; invalid export request | `input.value.rejected` | user | false | not_landed | user-validation | 1 | 050, 058, 059 |
| Undeclared flag (`--ref`) or fused flag | `fallback.invocation` | user | false | unknown | user-validation | 1 | 059 |
| Unclassifiable handler failure, kind-only `retro` | `fallback.internal` | platform | false | unknown | platform-provider | 2 | 004 |
| Success | — | — | — | — | success | 0 | 035, 037, 049 |

### 4.9 Prohibited Test Dependencies (explicit)

- **No real cryptographic key material.** The only key-shaped literal is the synthetic fixture entry allowlisted in `scripts/checks/retro-key-containment.ts`; production keys are generated at the runtime edge and never asserted.
- **No real process, network, or host state.** No suite spawns, resolves a host, opens a socket, or reads the user's real state directory or home.
- **No real opencode binary, provider, or model.** The render path is exercised in process with a spy that fails on any model/inference call.
- **No wall clock for correctness.** Time is the injected clock; the only timing in the plan is the soft local budget and the non-CI reference measurement of TC-RETRO-061.
- **No moving-base diff.** Every assertion reads the current tree, a committed fixture, or an isolated temp copy.
- **No real content in fixtures.** Committed fixtures contain synthetic ids, paths, windows, counts and verdicts only; the canary is fabricated.
- **No Windows ACL claim.** Permission assertions are POSIX-only.

## 5. Test Scenarios

### 5.1 Scenario Index

| TC ID | Title | Type | Tier | Automation | Priority | AC Coverage |
|-------|-------|------|------|------------|----------|-------------|
| TC-RETRO-001 | Contract vocabulary, closed vocabularies and data-only shapes | Contract | Contract | Automated | Critical | AC-F5-1, AC-F8-1, DM-1..DM-8, EVT-1/2 |
| TC-RETRO-002 | Tier, boundary, runtime confinement and inventory | Regression | Static | Automated | Critical | NFR-9, AC-F2-1, AC-F5-1 |
| TC-RETRO-003 | No model calls or network in the collect/report/export render path | Regression | Static + Check | Automated | Critical | AC-F5-1, NFR-9, RSK-6 |
| TC-RETRO-004 | Three `retro` error identities, triggers and containment | Regression | Contract + Integration | Automated | Critical | AC-F2-3, AC-F2-4, AC-F4-1, DM-8, NFR-8 |
| TC-RETRO-005 | Bidirectional documented-table synchronization | Regression | Contract + Check | Automated | Critical | AC-F2-3, AC-F2-4, AC-F4-1, NFR-8 |
| TC-RETRO-006 | Composition-only registration and edge-owned rendering | Regression | Structure | Automated | Critical | AC-F1-3, AC-F5-1, NFR-9 |
| TC-RETRO-007 | R1–R6 level declaration with the closed status vocabulary | Happy Path | Contract + Integration | Automated | Critical | AC-F8-1, DM-1 |
| TC-RETRO-008 | Sidecar record shape, trace ids and the absence of a mutation surface | Happy Path | Integration | Automated | Critical | AC-F2-1, DM-2, EVT-1, NFR-4 |
| TC-RETRO-009 | Append-only discipline and addenda on re-collection | Happy Path | Integration | Automated | Critical | AC-F1-1, AC-F2-1, NFR-4 |
| TC-RETRO-010 | Chaining-key artifact lifecycle and separation from the audit key | Happy Path | Integration | Automated | Critical | AC-F2-2, DM-3 |
| TC-RETRO-011 | Key containment across lane environment, records, output and configuration | Negative | Integration + Check | Automated | Critical | AC-F2-2, NFR-3 |
| TC-RETRO-012 | Cross-process verification with zero false chain breaks | Happy Path | Integration | Automated | Critical | AC-F2-2, NFR-3 |
| TC-RETRO-013 | Key-open failures reuse the existing state identities | Negative | Integration + Contract | Automated | Critical | AC-F2-2, AC-F4-2, NFR-8 |
| TC-RETRO-014 | Wholesale sidecar destruction is a store condition, not a chain break | Corner Case | Integration | Automated | Important | AC-F3-1, AC-F4-2 |
| TC-RETRO-015 | `change`-level automatic target selection | Happy Path | Integration | Automated | Critical | AC-F1-1, AC-F1-3 |
| TC-RETRO-016 | GET-only collection over the three delivered source families | Regression | Integration | Automated | Critical | AC-F1-1, NFR-4 |
| TC-RETRO-017 | Audit skipped ordinals and chain verdict carried verbatim | Happy Path | Integration | Automated | Critical | AC-F1-2, AC-F6-1, NFR-5 |
| TC-RETRO-018 | Additive, validated retro run records | Happy Path | Integration | Automated | Critical | AC-F1-1, EVT-2, DM-5 |
| TC-RETRO-019 | One collector fence serializes read, link computation and appends | Corner Case | Integration | Automated | Critical | AC-F2-1, NFR-4, DEC-13 |
| TC-RETRO-020 | Clean keyed chain, anchor seeding and verdict shape | Happy Path | Integration | Automated | Critical | AC-F3-1, DM-4 |
| TC-RETRO-021 | Tamper M-01: content edit is flagged with position and trace id | Negative | Integration | Automated | Critical | AC-F2-3, AC-F3-1 |
| TC-RETRO-022 | Tamper M-02: record deletion is flagged and later records examined | Negative | Integration | Automated | Critical | AC-F2-3, AC-F3-1 |
| TC-RETRO-023 | Tamper M-03: reordering is flagged | Negative | Integration | Automated | Critical | AC-F2-3, AC-F3-1 |
| TC-RETRO-024 | Tamper M-04: tail truncate-and-reappend is flagged | Negative | Integration | Automated | Critical | AC-F2-3, AC-F3-1 |
| TC-RETRO-025 | Tamper M-05: recomputed unkeyed checksum is rejected | Negative | Integration | Automated | Critical | AC-F2-3, NFR-2, TDR-0009 C-3 |
| TC-RETRO-026 | Tamper M-06: key-artifact substitution fails verification | Negative | Integration | Automated | Critical | AC-F2-3, AC-F2-2 |
| TC-RETRO-027 | Every break reported across a multi-alteration sidecar | Negative | Integration | Automated | Critical | AC-F2-3, AC-F3-1, DM-4 |
| TC-RETRO-028 | A reported salvage removal is not a break | Corner Case | Integration | Automated | Critical | AC-F3-1 |
| TC-RETRO-029 | The tamper mutation suite is complete and removal-sensitive | Contract | Contract + Integration | Automated | Critical | AC-F2-3, NFR-2, RSK-4 |
| TC-RETRO-030 | Entry-level malformation in the sidecar classifies and preserves | Negative | Integration | Automated | Critical | AC-F4-1, NFR-1 |
| TC-RETRO-031 | Entry-level malformation in the retro registry classifies and preserves | Negative | Integration | Automated | Critical | AC-F4-1, AC-F8-1, NFR-1 |
| TC-RETRO-032 | Preserved output is byte-identical and the error envelope is truthful | Negative | Integration | Automated | Critical | AC-F4-2, DEC-12 |
| TC-RETRO-033 | Store-level damage classifies as unreachable with salvage as the recovery | Negative | Integration | Automated | Critical | AC-F4-2, DEC-7 |
| TC-RETRO-034 | Zero uncaught crashes and zero data loss across the full matrix | Regression | Integration | Automated | Critical | AC-F4-1, AC-F4-2, NFR-1 |
| TC-RETRO-035 | Report data shape, provenance and evidence resolution | Happy Path | Integration | Automated | Critical | AC-F5-1, DM-6 |
| TC-RETRO-036 | Follow-through read-fold with honest verification markers | Happy Path | Integration | Automated | High | AC-F5-1 |
| TC-RETRO-037 | Null retro is an explicit, successful empty report | Edge Case | Integration | Automated | Critical | AC-F5-2, DM-6 |
| TC-RETRO-038 | Byte-identical replays, zero ambient reads and zero model calls | Regression | Integration | Automated | Critical | AC-F5-1, NFR-6 |
| TC-RETRO-039 | The report path performs the verified read and never trusts altered records | Negative | Integration | Automated | Critical | AC-F2-3, AC-F3-1, AC-F5-1 |
| TC-RETRO-040 | The report folds the most recent collected scope and its run records | Happy Path | Integration | Automated | High | AC-F5-1, DM-5 |
| TC-RETRO-041 | Truth check C-01: skipped ordinals surface and are never dropped | Negative | Integration | Automated | Critical | AC-F6-1 |
| TC-RETRO-042 | Truth check C-02: a broken audit-ledger verdict is a retro finding | Negative | Integration | Automated | Critical | AC-F6-1 |
| TC-RETRO-043 | Truth check C-03: a dangling evidence ref is flagged | Negative | Integration | Automated | Critical | AC-F6-1 |
| TC-RETRO-044 | Truth check C-04: expected-activity-absent is flagged, not silent | Negative | Integration | Automated | Critical | AC-F6-1 |
| TC-RETRO-045 | Truth check C-05: a zero-collector run is never a silent success | Negative | Integration | Automated | Critical | AC-F6-1 |
| TC-RETRO-046 | Verified-empty is explicit and distinct from vacuous green | Edge Case | Integration | Automated | Critical | AC-F5-2, AC-F6-1 |
| TC-RETRO-047 | Disabling any truth check fails the suite | Regression | Integration + Check | Automated | Critical | AC-F6-1, RSK-4 |
| TC-RETRO-048 | Findings correspond exactly to triggered checks, never fabricated | Regression | Integration | Automated | Critical | AC-F5-2, AC-F6-1 |
| TC-RETRO-049 | Bounded, deterministic export bundle with the chain verdict | Happy Path | Integration | Automated | Critical | AC-F7-1, DM-7, NFR-5 |
| TC-RETRO-050 | Export refuses a missing destination or an invalid limit | Negative | Integration | Automated | Critical | AC-F7-1, NFR-5 |
| TC-RETRO-051 | Export truncation is reported in-band at the exact boundary | Edge Case | Integration | Automated | High | AC-F7-1, NFR-5 |
| TC-RETRO-052 | Export passes the redaction chokepoint and mutates nothing | Regression | Integration | Automated | Critical | AC-F7-1, NFR-10 |
| TC-RETRO-053 | `retro.evidence.denied`: structural refusal outside the collector seam | Negative | Integration | Automated | Critical | AC-F2-4, NFR-4 |
| TC-RETRO-054 | Claimed collector identity: attribution, never authentication | Happy Path | Integration | Automated | High | AC-F2-1, AC-F2-4, DM-2 |
| TC-RETRO-055 | Registry boundary verdict matrix and classified write refusal | Negative | Integration | Automated | Critical | AC-F8-1, NFR-1 |
| TC-RETRO-056 | `state check` reports the retro registry store verdict | Happy Path | Integration | Automated | Critical | AC-F8-1 |
| TC-RETRO-057 | Registry level and run record shapes are validated and additive | Contract | Contract + Integration | Automated | High | AC-F8-1, DM-1, DM-5, EVT-2 |
| TC-RETRO-058 | Level refusal matrix with owning-story hints and zero I/O | Negative | Integration | Automated | Critical | AC-F1-3, DM-1 |
| TC-RETRO-059 | Omitted level defaults to `change`; the locked surface is enforced | Happy Path | Integration | Automated | Critical | AC-F1-3 |
| TC-RETRO-060 | The periodic memory-audit trigger is registered and its run is evidence | Happy Path | Integration | Automated | High | AC-F9-1, DM-1, EVT-1 |
| TC-RETRO-061 | Bounded work and the non-CI performance reference on 10,000 records | Performance | Performance | Automated | Medium | NFR-7, NFR-5 |
| TC-RETRO-062 | Hermeticity, no ambient reads, and fixture key hygiene | Regression | Static + Integration | Automated | Critical | NFR-6, NFR-3, NFR-9 |
| TC-RETRO-063 | Envelope, exit projection and partial-output rendering | Regression | Integration + Golden | Automated | Critical | AC-F4-2, AC-F5-1, F-10 |
| TC-RETRO-064 | Registered secrets never reach evidence, findings, report or bundle | Regression | Integration | Automated | Critical | NFR-10, AC-F5-1 |

`TC-RETRO-*` is a new prefix with no prior use in the repository; no existing TC identifier is reused for a different scenario.

### 5.2 Scenario Details

#### TC-RETRO-001 - Contract vocabulary, closed vocabularies and data-only shapes

**Scenario Type**: Regression
**Impact Level**: Critical
**Priority**: High
**Related IDs**: F-5, F-8, F-10, DM-1, DM-2, DM-3, DM-4, DM-5, DM-6, DM-7, DM-8, EVT-1, EVT-2, AC-F5-1, AC-F8-1, NFR-9
**Test Type(s)**: Contract, Static
**Automation Level**: Automated
**Target Layer / Location**: `tests/structure/retro-contract.test.ts`; `packages/core/src/contracts/retro.ts`
**Tags**: @backend

**Preconditions**:

- The new retro contracts module exists and is exported through `@delivery-os/core/contracts`.
- A TypeScript AST parser is available (the `tests/structure/status-contract.test.ts` pattern).

**Steps**:

1. Parse the module and assert every top-level statement is a type alias, interface, `import type`, `export`, or an `as const` declaration; assert zero executable statements, function bodies, `new`, or calls.
2. Assert the declared level set is exactly the six concepts-doc levels with `change` mapped to R1, and that the implementation-status vocabulary is exactly `implemented` and `declared`.
3. Assert the closed vocabularies exist and are non-empty: modes (`collect`, `report`), finding kinds, follow-through verdicts, chain-verdict shape keys, export/report schema identity constants.
4. Assert the record-shape declarations carry the spec field sets: sidecar record (`traceId`, `level`, `source`, window bounds, `collectedAt`, claimed identity, payload refs, payload schema id, `chainValue`), run record, chain verdict, report data, export bundle.
5. Assert the three retro error codes are declared exactly once and the audit read outcome type is consumed, not redefined.

**Expected Outcome**:

- Contracts are declaration-only with the exact closed vocabularies and shapes.
- No behaviour, clock, randomness, environment, or I/O enters the contracts tier.

**Notes / Clarifications**:

- Exact record kind, payload schema id, store key, and artifact filename strings are delivery-bound (A-T2, A-T5); the test asserts the **declared constant** and the field semantics, so a reviewed rename updates one constant and one assertion together.

#### TC-RETRO-002 - Tier, boundary, runtime confinement and inventory

**Scenario Type**: Regression
**Impact Level**: Critical
**Priority**: High
**Related IDs**: F-2, F-5, AC-F2-1, AC-F5-1, NFR-9
**Test Type(s)**: Static, Contract
**Automation Level**: Automated
**Target Layer / Location**: `tests/structure/retro-imports.test.ts`, `tests/boundaries/**`, `tests/structure/content-inventory.test.ts`, `scripts/checks/{ambient-globals,workspace-entrypoints,forbidden-literals,exit-code-literals}.ts`
**Tags**: @backend

**Preconditions**:

- The new contracts, domain fold modules, sidecar consumer, collector seam, registry consumer, command definition, and edge composition.
- The boundary fixture registry, the content inventory, and the forbidden-literal registry.

**Steps**:

1. Assert the contracts module and the pure fold modules import only contracts, domain, and own modules: no `node:*`, no `bun:*`, no adapters, no CLI, no `process`, `fetch`, or timers.
2. Assert zero runtime conditionals in contracts and domain, with a synthetic control.
3. Assert `node:fs`/`node:path`/crypto and any child-process API appear only in the admitted runtime-edge or state-adapter locations among this change's files; assert the collector seam receives injected readers rather than reading ambient state.
4. Assert no new package, subpath, or dependency; run `workspace-entrypoints` and `exit-code-literals`.
5. Assert `content-inventory.json` lists every new source file with its allowed exports and that no file gained an executable allowance it did not declare.
6. Assert the boundary fixture-coverage meta-check is unchanged and green; run `forbidden-literals` with the new operator-facing strings registered or absent.
7. Scan the new source for hardcoded product/binary names; assert zero and assert the brand is injected.

**Expected Outcome**:

- Contracts stay data-only, folds stay pure, production I/O lives only at admitted locations, the package graph and inventories are unchanged in shape, and no forbidden literal or always-on registration exists.

**Notes / Clarifications**:

- Planted controls: `node:fs` in a contracts temp copy, a new runtime import in a domain file, a forged inventory entry, and a seeded forbidden literal. Each must fail.

#### TC-RETRO-003 - No model calls or network in the collect/report/export render path

**Scenario Type**: Regression
**Impact Level**: Critical
**Priority**: High
**Related IDs**: F-5, AC-F5-1, NFR-9, RSK-6
**Test Type(s)**: Static, Contract
**Automation Level**: Automated
**Target Layer / Location**: `scripts/checks/retro-render-purity.ts`, `tests/checks/retro-render-purity.test.ts`, `tests/structure/retro-imports.test.ts`
**Tags**: @backend

**Preconditions**:

- The collect, report, and export fold modules and the retro command definition exist.
- The invariant check exposes a stable exported entry so the mutation test can drive it over a temp tree.

**Steps**:

1. Run the invariant check over the render path (collector folds, truth checks, report assembly, export serialization, command handler): assert zero imports from `inference`, provider clients, model SDKs, or `fetch`/HTTP modules, and zero identifiers matching the declared model-seam names.
2. Assert the check reports a positive scanned-file count (non-vacuity floor) and exits 0 on the tree.
3. Copy the render path into a temp tree, plant an inference import in one module, and run the check; assert it exits non-zero naming the file and the import.
4. Plant a `fetch` call and a direct `Date.now()` in two further temp copies; assert each is named.
5. Run the report determinism suite with an inference-seam spy installed and assert zero recorded calls.

**Expected Outcome**:

- The check is green on the tree, reports a positive scope, and fails on every planted violation.
- No model call, network call, or ambient clock read exists in the deterministic render path.

#### TC-RETRO-004 - Three `retro` error identities, triggers and containment

**Scenario Type**: Regression
**Impact Level**: Critical
**Priority**: High
**Related IDs**: F-10, DM-8, AC-F2-3, AC-F2-4, AC-F4-1, NFR-8
**Test Type(s)**: Contract, Integration, Unit
**Automation Level**: Automated
**Target Layer / Location**: `tests/structure/error-table.test.ts` (update), `tests/behaviour/retro-malformed.test.ts`, `retro-chain-mutations.test.ts`, `retro-denied.test.ts`
**Tags**: @backend

**Preconditions**:

- `DOMAIN_KINDS` contains `retro`; `ERROR_TABLE` contains exactly three `retro` rows.
- The trigger paths from TC-RETRO-021, 030 and 053.

**Steps**:

1. Assert `DOMAIN_KINDS` contains `retro` and exactly three rows have `domainKind: retro`, with the exact code, category `platform`, `retryable: false`, `consequence: not_landed`, remediation hint and summary from DEC-11.
2. Assert the exit projection: `retro.evidence.malformed-entry` and `retro.evidence.tamper-flagged` project to 1 and `retro.evidence.denied` to 2; assert the projection class values that produce those exits (GAP-T6).
3. Drive each code through its trigger and assert the classified failure is exactly that entry.
4. Assert `classifyDomainKind("retro")` without a code throws, and a thrown kind-only `retro` contains through `fallback.internal`, never the first row.
5. Assert a wrong-kind pairing, an unknown `retro.*` code, a missing code, a non-string code, and a code from another kind all contain through `fallback.internal`.
6. Assert store-level conditions still resolve through the existing `state.*` rows and no fourth retro row exists.

**Expected Outcome**:

- 3/3 exact identities, each reachable and projected as pinned; kind-only classification is contained; no redundant row.

**Notes / Clarifications**:

- GAP-T6: exit 1 forces `projectionClass: user-validation` on the two platform-category rows. The test pins exactly that combination so a silent switch to `platform-provider` (exit 2) fails.

#### TC-RETRO-005 - Bidirectional documented-table synchronization

**Scenario Type**: Regression
**Impact Level**: Critical
**Priority**: High
**Related IDs**: F-10, DM-8, AC-F2-3, AC-F2-4, AC-F4-1, NFR-8
**Test Type(s)**: Contract, Integration
**Automation Level**: Automated
**Target Layer / Location**: `scripts/checks/error-table-sync.ts`, `tests/checks/error-table-sync.test.ts` (update), `doc/spec/features/feature-result-contract.md`
**Tags**: @backend

**Preconditions**:

- The three retro rows authored in the same change in the machine table and in the documented table.
- The existing sync harness with its temp-copy mutation support.

**Steps**:

1. Run the sync check on the delivered tree; assert exit 0 with positive source, documented, recognized-reference and corpus counts.
2. Assert each retro code appears exactly once in the documented table with matching category, retryable, consequence, projection class, summary and remediation hint.
3. Machine-direction mutations in a temp copy: remove one retro row; remove `retro` from `DOMAIN_KINDS`; add a fourth retro row without a documented twin. Each must fail naming the offender.
4. Documentation-direction mutations: remove a retro row; add a doc-only row; alter one documented column; duplicate a row. Each must fail.
5. Assert a missing, empty, or unparseable documented table fails closed rather than passing vacuously; assert the unchanged control stays green.

**Expected Outcome**:

- 3/3 rows synchronize in both directions; every drift fails with a named offender; the unchanged control is green.

#### TC-RETRO-006 - Composition-only registration and edge-owned rendering

**Scenario Type**: Regression
**Impact Level**: Critical
**Priority**: High
**Related IDs**: F-2, F-5, AC-F1-3, AC-F5-1, NFR-9
**Test Type(s)**: Contract, Integration, Static
**Automation Level**: Automated
**Target Layer / Location**: `tests/structure/cli-edge-seam.test.ts` (update), `tests/behaviour/retro-levels.test.ts`
**Tags**: @backend

**Preconditions**:

- The program composition entry callable with and without the `retro` composition.
- The retro command definition and the edge composition.

**Steps**:

1. Compose without `retro`; assert `program.commands.retro` is absent and running `retro report` returns `fallback.invocation` at exit 1.
2. Compose with the retro composition; assert `commands.retro` is registered and `retro report` runs through the fake.
3. Assert `commands/index.ts` exports the retro definition factory and its runtime type; assert the edge exports the retro composition and constructs it with injected store, clock, identity, and collector readers.
4. Assert `commands/retro.ts` performs no stream write, chooses no exit code, and exposes only the definition factory.
5. Extend the existing "optional human-text renderer" assertion to include `retro` in the exact declared set (never removed or weakened).
6. Run an always-on registration mutant and assert step 1 fails.

**Expected Outcome**:

- `retro` exists only when composed, exactly like the other optional commands; the edge owns rendering and exit projection; the existing seam assertion is extended, not relaxed.

#### TC-RETRO-007 - R1–R6 level declaration with the closed status vocabulary

**Scenario Type**: Happy Path
**Impact Level**: Critical
**Priority**: High
**Related IDs**: F-8, DM-1, AC-F8-1
**Test Type(s)**: Contract, Integration
**Automation Level**: Automated
**Target Layer / Location**: `tests/structure/retro-contract.test.ts`, `tests/behaviour/retro-registry.test.ts`
**Tags**: @backend

**Preconditions**:

- An empty retro registry store and a seeded registry with all six levels.
- The declared level and status constants.

**Steps**:

1. Assert the declared level set is exactly the six concepts-doc levels in R1–R6 order, each with a non-empty scope kind and a trigger declaration (cadence or event) drawn from the declared trigger vocabulary.
2. Assert every level's implementation status is one of `implemented` or `declared`, and exactly `change` is `implemented`.
3. Read an empty registry and assert the verdict is explicit verified-empty (not a zero-filled level list and not a silent success).
4. Seed the six levels and read; assert all six return with their declared fields and no extra level.
5. Assert the registry stores declarations as data, so a later level implementation is a status change, not a surface change.

**Expected Outcome**:

- Six declared levels, one implemented, closed vocabularies, explicit verified-empty on an empty store.

**Notes / Clarifications**:

- A seventh level, a free-text status, a missing trigger, or two implemented levels must fail. This is the non-vacuity control for "declared in advance".

#### TC-RETRO-008 - Sidecar record shape, trace ids and the absence of a mutation surface

**Scenario Type**: Happy Path
**Impact Level**: Critical
**Priority**: High
**Related IDs**: F-1, F-2, DM-2, EVT-1, AC-F2-1, NFR-4
**Test Type(s)**: Integration, Contract
**Automation Level**: Automated
**Target Layer / Location**: `tests/behaviour/retro-sidecar-append.test.ts`, `tests/fixtures/retro/harness.ts`
**Tags**: @backend

**Preconditions**:

- Seeded audit read, state families, and retro notes; fixed clock and trace-id sequence; one completed target change.
- A sidecar consumer instance built over a temp state directory.

**Steps**:

1. Run `retro collect --json` and read every appended sidecar record.
2. Assert exactly one record per collected item and the exact field set: trace id, level, source, window start/end, collected-at, claimed identity, payload refs, payload schema id, chain value.
3. Assert every trace id is `ev-` prefixed, unique within the sidecar, and stable for replayed runs under the fixed sequence.
4. Assert `collectedAt` equals `NOW_MS`, window start ≤ end and both are explicit integers, and the level is `change`.
5. Assert the sidecar consumer surface exposes no update, delete, reorder, compact, or truncate member, and that the store port call log contains only appends.
6. Assert no record carries the chaining key, a secret value, or payload/checksum bytes beyond the collected evidence.

**Expected Outcome**:

- Every record is complete, append-only, key-free, and carries a unique collector trace id and explicit watermark.

**Notes / Clarifications**:

- A fabricated timestamp, a duplicate trace id, a missing window bound, or an added mutation member in a temp copy must fail.

#### TC-RETRO-009 - Append-only discipline and addenda on re-collection

**Scenario Type**: Happy Path
**Impact Level**: Critical
**Priority**: High
**Related IDs**: F-1, F-2, AC-F1-1, AC-F2-1, NFR-4
**Test Type(s)**: Integration, Contract
**Automation Level**: Automated
**Target Layer / Location**: `tests/behaviour/retro-sidecar-append.test.ts`
**Tags**: @backend

**Preconditions**:

- A completed change already collected at the `change` level.
- A byte snapshot and digest of the sidecar before the second run.

**Steps**:

1. Run collect for the already-collected scope; assert an addendum record is appended and the pre-existing prefix is byte-identical to the snapshot.
2. Assert the addendum carries a new trace id, the same level and scope, and a chain value chained from the last existing record.
3. Run `retro report` and assert the read path leaves the sidecar bytes, the registry bytes, and the derived-document state unchanged.
4. Run collect a third time and assert the pattern repeats: append-only, never a rewrite.
5. Run a temp mutant that rewrites the last record instead of appending; assert the byte-prefix comparison fails.

**Expected Outcome**:

- Reruns append addenda; nothing is updated, deleted, reordered, or compacted; reads mutate nothing.

#### TC-RETRO-010 - Chaining-key artifact lifecycle and separation from the audit key

**Scenario Type**: Happy Path
**Impact Level**: Critical
**Priority**: High
**Related IDs**: F-2, DM-3, AC-F2-2
**Test Type(s)**: Integration, Contract
**Automation Level**: Automated
**Target Layer / Location**: `tests/behaviour/retro-key-artifact.test.ts`, `tests/fixtures/retro/key-artifact.json`
**Tags**: @backend

**Preconditions**:

- A temp state directory containing a delivered audit `chain-key.<workspace>.json` artifact with known bytes.
- An empty sidecar.

**Steps**:

1. Run the first collect; assert exactly one sidecar key artifact is created, in the store-managed artifact family beside the sidecar, with `0600` and a declared key length.
2. Assert the artifact path differs from `chain-key.<workspace>.json` and its bytes differ from the audit key bytes.
3. Run a second collect and assert the same artifact is read and reused (same bytes, same inode/path, no second artifact).
4. Delete the key while records exist and attempt a collect; assert no silent regeneration and a classified key-open failure.
5. Inspect every record and both output modes; assert the key value appears nowhere.

**Expected Outcome**:

- One distinct, least-privilege, durable key artifact; reuse across runs; no regeneration while guarded records exist; zero key leakage.

#### TC-RETRO-011 - Key containment across lane environment, records, output and configuration

**Scenario Type**: Negative
**Impact Level**: Critical
**Priority**: High
**Related IDs**: F-2, DM-3, AC-F2-2, NFR-3
**Test Type(s)**: Integration, Contract
**Automation Level**: Automated
**Target Layer / Location**: `tests/behaviour/retro-key-artifact.test.ts`, `scripts/checks/retro-key-containment.ts`, `tests/checks/retro-key-containment.test.ts`
**Tags**: @backend @security

**Preconditions**:

- A lane-environment fixture representing exactly the declared lane variables.
- The synthetic key fixture registered as the single allowlisted literal in the containment check.

**Steps**:

1. Run collect and report; capture machine output, human output, every record field, the resolved configuration snapshot, the ambient environment stub, and the lane-environment fixture.
2. Assert the key value appears **only** in the key artifact; assert the canary presence is proved first by finding it in the artifact.
3. Assert no record field name or value carries key material and no output line does either.
4. Run `retro-key-containment` over the source, committed fixtures, and goldens; assert the only key-shaped hex occurrence is the allowlisted test fixture and the scan reports a positive scope.
5. Plant the key value in a record fixture and in an output golden in two temp copies; assert the check fails for each.
6. Assert the sidecar key is absent from the lane-environment fixture even when the audit key variable is present, proving plane separation.

**Expected Outcome**:

- 0 occurrences outside the artifact and edge-injected data; the check is live in both directions.

#### TC-RETRO-012 - Cross-process verification with zero false chain breaks

**Scenario Type**: Happy Path
**Impact Level**: Critical
**Priority**: High
**Related IDs**: F-2, DM-3, AC-F2-2, NFR-3, TDR-0009 C-5
**Test Type(s)**: Integration, Contract
**Automation Level**: Automated
**Target Layer / Location**: `tests/behaviour/retro-chain-cross-process.test.ts`
**Tags**: @backend

**Preconditions**:

- One temp state directory; two independently constructed store/edge instances (A and B) sharing it.
- Instance A writes at least three records.

**Steps**:

1. Verify the sidecar with instance B; assert `verified: true`, zero breaks, and the exact record count.
2. Append a fourth record with instance B and verify again; assert the chain continues from the last record and no break is reported.
3. Reopen with a third instance and report; assert zero false breaks and byte-identical evidence to the instance-B read.
4. Run a mutant that generates a fresh per-process key; assert the second instance reports false breaks and the suite fails.

**Expected Outcome**:

- Durable key material gives cross-process continuity with zero false breaks; a per-process key is caught.

#### TC-RETRO-013 - Key-open failures reuse the existing state identities

**Scenario Type**: Negative
**Impact Level**: Critical
**Priority**: High
**Related IDs**: F-2, F-4, DM-3, AC-F2-2, AC-F4-2, NFR-8, TDR-0009 C-6
**Test Type(s)**: Integration, Contract
**Automation Level**: Automated
**Target Layer / Location**: `tests/behaviour/retro-key-artifact.test.ts`, `tests/structure/error-table.test.ts`
**Tags**: @backend

**Preconditions**:

- Four key-artifact fixtures over the same seeded sidecar: absent on a non-first open, corrupt JSON, wrong schema id, and mode `0644`.
- A valid-key control fixture.

**Steps**:

1. Assert the absent-on-non-first-open case is `state.keys.missing`, exit 2, no regeneration, `not_landed`.
2. Assert corrupt content and a wrong schema id are `state.store.torn`, exit 2.
3. Assert mode `0644` is `state.permission.denied`; assert the identity exactly and mark the exit expectation **TODO** per GAP-T3 (the delivered row projects 1).
4. Assert no new error-table row was added for key handling and the documented table is unchanged for these identities.
5. Assert the valid-key control verifies cleanly in the same test.

**Expected Outcome**:

- Exact state identities, no silent regeneration, no new rows; the permission-violation exit is recorded as blocked, not asserted falsely.

#### TC-RETRO-014 - Wholesale sidecar destruction is a store condition, not a chain break

**Scenario Type**: Corner Case
**Impact Level**: Important
**Priority**: Medium
**Related IDs**: F-3, F-4, DM-4, AC-F3-1, AC-F4-2, TDR-0009
**Test Type(s)**: Integration
**Automation Level**: Automated
**Target Layer / Location**: `tests/behaviour/retro-chain-salvage.test.ts`
**Tags**: @backend

**Preconditions**:

- A seeded sidecar and key; a second fixture where both are deleted; a third where only a middle record is deleted.

**Steps**:

1. Delete the entire sidecar and its key; run report; assert the outcome is a store condition (unreachable with the state identity, or an explicit verified-empty if the absent-store policy says so), never a chain break and never a `verified: true` claim.
2. Assert the diagnosis names the missing sidecar/key and does not claim tamper.
3. Delete only a middle record; assert a chain break is reported, proving partial deletion is caught and whole deletion is classified differently.
4. Assert no path in both cases mutates the surviving store.

**Expected Outcome**:

- Whole-store destruction is a store-level condition; partial deletion is a chain break; the distinction is observable and honest.

#### TC-RETRO-015 - `change`-level automatic target selection

**Scenario Type**: Happy Path
**Impact Level**: Critical
**Priority**: High
**Related IDs**: F-1, F-8, AC-F1-1, AC-F1-3, DEC-5
**Test Type(s)**: Integration
**Automation Level**: Automated
**Target Layer / Location**: `tests/behaviour/retro-collect.test.ts`
**Tags**: @backend

**Preconditions**:

- A delivery registry fixture with three completed changes (distinct completion times), one in-flight change, and one completed change already collected at `change`.
- A fixed injected clock.

**Steps**:

1. Run collect with omitted `--level`; assert the selected scope is the most recent completed, not-yet-collected change.
2. Assert ordering is deterministic: completion timestamp descending, then ref ascending on a tie (A-T3); run twice and assert the same selection.
3. Assert the in-flight change is never selected even when it is the newest record.
4. Mark the selected scope collected and re-run; assert the next-most-recent uncollected change is selected or, when none remains, an explicit no-target outcome (never a fabricated scope).
5. Assert no ref argument is consulted; the invocation carries only `--level` and `--json`.

**Expected Outcome**:

- Deterministic, state-driven target selection that never selects an in-flight change and never invents a scope.

**Notes / Clarifications**:

- A newest-any-state mutant and a re-collect-rewrite mutant must fail. The tiebreak is a plan-time determinism pin (A-T3) because the spec does not pin ordering.

#### TC-RETRO-016 - GET-only collection over the three delivered source families

**Scenario Type**: Regression
**Impact Level**: Critical
**Priority**: High
**Related IDs**: F-1, AC-F1-1, NFR-4
**Test Type(s)**: Integration, Contract
**Automation Level**: Automated
**Target Layer / Location**: `tests/behaviour/retro-collect.test.ts`
**Tags**: @backend

**Preconditions**:

- Scripted audit read, state families (phase transitions, closeout outcomes, commit telemetry), and pm-notes retro notes; each fake records its calls.
- Byte snapshots of every source fixture.

**Steps**:

1. Run collect; assert the audit read used the bounded surface with a positive integer limit and only declared filters, and that the query was recorded.
2. Assert each declared source family was read once, in declared order, and that no undeclared source was read.
3. Assert every source fixture is byte-identical after the run and the call log contains no write member.
4. Assert an absent source is recorded as skipped-source with a reason in the run counts, never as an empty success and never as a mutation.
5. Run a mutant that writes to the audit ledger or the notes during collection and assert the suite fails.

**Expected Outcome**:

- Collection is GET-only over exactly the declared sources; source stores are untouched; skips are counted and explained.

#### TC-RETRO-017 - Audit skipped ordinals and chain verdict carried verbatim

**Scenario Type**: Happy Path
**Impact Level**: Critical
**Priority**: High
**Related IDs**: F-1, F-6, AC-F1-2, AC-F6-1, NFR-5
**Test Type(s)**: Integration, Contract
**Automation Level**: Automated
**Target Layer / Location**: `tests/behaviour/retro-collect.test.ts`, `tests/behaviour/retro-truth-checks.test.ts`
**Tags**: @backend

**Preconditions**:

- A scripted `AuditReadOutcome` carrying two orphan reservations, a chain verdict with `verified: false` and one break, `matched` above the returned count, and `truncated: true`.
- A second scripted outcome with no orphans, a verified chain, and no truncation.

**Steps**:

1. Run collect; assert both orphan findings (ordinal, run id, position) and the full chain verdict (verified flag, record count, break positions, anchor) are present in the sidecar evidence and the run record.
2. Assert the carried values are byte-equal to the scripted input — no summarisation, no ordinal dropped, no break hidden.
3. Assert the recorded audit query used a positive limit and that truncation is reported in-band in the run facts.
4. Run the clean outcome through collect and assert no skipped-ordinal finding and a verified verdict.
5. Run a mutant that drops one orphan and assert the suite fails.

**Expected Outcome**:

- Every skipped ordinal and the full verdict survive into the learning plane; truncation is visible; nothing is silently dropped.

#### TC-RETRO-018 - Additive, validated retro run records

**Scenario Type**: Happy Path
**Impact Level**: Critical
**Priority**: High
**Related IDs**: F-1, EVT-2, DM-5, AC-F1-1, NFR-4
**Test Type(s)**: Integration, Contract
**Automation Level**: Automated
**Target Layer / Location**: `tests/behaviour/retro-collect.test.ts`, `tests/behaviour/retro-registry.test.ts`
**Tags**: @backend

**Preconditions**:

- An empty retro registry; two consecutive collect runs; one report run.

**Steps**:

1. Run collect; assert exactly one run record is appended with run id, level, mode `collect`, target scope, counts (collected, malformed, skipped-source), consumed source chain verdicts, and the pipeline-truth verdict.
2. Run collect again; assert a second additive record with a new run id and its own facts; assert the first record is byte-unchanged.
3. Run report; assert a `report` mode record is appended with its own counts and verdict.
4. Assert each record validates at the boundary; assert a record missing a required field is refused `state.store.unknown` and appends nothing.
5. Assert run records interleave with sidecar evidence without affecting the chain.

**Expected Outcome**:

- One validated, additive run record per invocation; counts and verdicts are first-class report input; no rewrite.

#### TC-RETRO-019 - One collector fence serializes read, link computation and appends

**Scenario Type**: Corner Case
**Impact Level**: Critical
**Priority**: High
**Related IDs**: F-2, AC-F2-1, NFR-4, DEC-13
**Test Type(s)**: Integration, Contract
**Automation Level**: Automated
**Target Layer / Location**: `tests/behaviour/retro-sidecar-append.test.ts`
**Tags**: @backend

**Preconditions**:

- A fence-holding hook that pauses a collect between the verified pre-append read and the append.
- A second collect attempting the same sidecar.

**Steps**:

1. Start collect A holding the collector fence; run collect B; assert B blocks or fails classified (`state.lock.busy`) without appending and without computing a divergent link.
2. Release A; assert A appends and the chain verifies.
3. Retry B; assert it now appends from A's last link and the full sequence verifies with no duplicate or missing link.
4. Assert reads (`report`, `export`) acquire no fence and mutate nothing.
5. Run a mutant that computes the link outside the fence and interleaves two appends; assert the resulting chain fails verification.

**Expected Outcome**:

- One fence covers the whole chained domain write path; concurrent appends never interleave; reads stay unfenced.

#### TC-RETRO-020 - Clean keyed chain, anchor seeding and verdict shape

**Scenario Type**: Happy Path
**Impact Level**: Critical
**Priority**: High
**Related IDs**: F-3, DM-4, AC-F3-1, TDR-0009
**Test Type(s)**: Integration, Contract
**Automation Level**: Automated
**Target Layer / Location**: `tests/behaviour/retro-chain.test.ts`
**Tags**: @backend

**Preconditions**:

- A clean three-record sidecar and the declared chain anchor constant.
- The canonical record content ordering declared in the contract.

**Steps**:

1. Verify; assert `verified: true`, `records: 3`, `breaks: []`, and the anchor reference present.
2. Assert the first record's link chains from the declared anchor and each later link chains from its predecessor.
3. Assert the link computation excludes the record's own `chainValue` from its canonical content (a temp mutant that includes it fails the clean verification after a re-append).
4. Interleave a retro-registry record and a delivery-state record; assert neither participates in the sidecar chain and the count stays 3.
5. Assert the verdict carries no payload, checksum, or key bytes.

**Expected Outcome**:

- A verified clean chain with a seeded anchor, correct participation, and a leak-free verdict.

#### TC-RETRO-021 - Tamper M-01: content edit is flagged with position and trace id

**Scenario Type**: Negative
**Impact Level**: Critical
**Priority**: High
**Related IDs**: F-2, F-3, DM-4, DM-8, AC-F2-3, AC-F3-1
**Test Type(s)**: Integration, Contract
**Automation Level**: Automated
**Target Layer / Location**: `tests/behaviour/retro-chain-mutations.test.ts`, `tests/fixtures/retro/harness.ts`
**Tags**: @backend @security

**Preconditions**:

- A sidecar with five records; the mutation helper reports the edited position `P` and trace id `T`.
- A clean verification control on the unmutated fixture.

**Steps**:

1. Verify the clean fixture; assert `verified: true` and zero breaks.
2. Apply M-01: change a payload value on record `P`, leave the stored link intact.
3. Run `retro report --json`; assert exit 1, `retro.evidence.tamper-flagged`, and exactly one break at `P` with trace id `T`.
4. Assert record `P` is absent from `findings` and `evidenceRefs`, and that preserved records 1..P−1 remain in the partial output.
5. Assert the diagnostic names only position and trace id — no payload bytes, checksum bytes, or key material.
6. Assert the sidecar bytes are unchanged by the read.

**Expected Outcome**:

- The edit is detected and loud, the altered record is never trusted, valid records survive, and no secret or payload bytes leak.

#### TC-RETRO-022 - Tamper M-02: record deletion is flagged and later records examined

**Scenario Type**: Negative
**Impact Level**: Critical
**Priority**: High
**Related IDs**: F-2, F-3, DM-4, AC-F2-3, AC-F3-1
**Test Type(s)**: Integration, Contract
**Automation Level**: Automated
**Target Layer / Location**: `tests/behaviour/retro-chain-mutations.test.ts`
**Tags**: @backend @security

**Preconditions**:

- A seven-record sidecar; a middle record removed.

**Steps**:

1. Verify; assert a break at the deletion boundary (the successor whose previous link no longer matches).
2. Assert verification continues: records after the gap are examined and the verdict reports the full record count actually present.
3. Assert the command exits 1 with `retro.evidence.tamper-flagged` and never reports a trusted tail.
4. Assert a clean seven-record control verifies with zero breaks.
5. Run a mutant verifier that stops at the first break and reports `verified: true` when the tail count matches; assert it fails.

**Expected Outcome**:

- Deletion is detected at the boundary; verification continues; no partial-trust claim.

#### TC-RETRO-023 - Tamper M-03: reordering is flagged

**Scenario Type**: Negative
**Impact Level**: Critical
**Priority**: High
**Related IDs**: F-2, F-3, AC-F2-3, AC-F3-1
**Test Type(s)**: Integration, Contract
**Automation Level**: Automated
**Target Layer / Location**: `tests/behaviour/retro-chain-mutations.test.ts`
**Tags**: @backend @security

**Preconditions**:

- A five-record sidecar; records at positions 3 and 4 swapped.

**Steps**:

1. Verify; assert a break at the first affected position.
2. Assert the second swapped record is also not served as verified.
3. Assert exit 1 with the tamper identity and no payload bytes in the diagnostic.
4. Assert an order-insensitive mutant (sort by trace id before hashing) reports verified and fails the suite.

**Expected Outcome**:

- Reordering is detected; the chain is order-sensitive.

#### TC-RETRO-024 - Tamper M-04: tail truncate-and-reappend is flagged

**Scenario Type**: Negative
**Impact Level**: Critical
**Priority**: High
**Related IDs**: F-2, F-3, AC-F2-3, AC-F3-1
**Test Type(s)**: Integration, Contract
**Automation Level**: Automated
**Target Layer / Location**: `tests/behaviour/retro-chain-mutations.test.ts`
**Tags**: @backend @security

**Preconditions**:

- A six-record sidecar; the last two records dropped and a copy of record 4 re-appended.

**Steps**:

1. Verify; assert a break at the truncation boundary and that the reappended record is not trusted.
2. Assert the verdict record count reflects the physically present records and the break position derives from the mutation offsets.
3. Assert exit 1 with the tamper identity and partial output excluding the reappended record.
4. Run a mutant that resets the chain anchor on truncation and assert it reports verified falsely and fails the suite.

**Expected Outcome**:

- Truncation with re-append is detected; the anchor is never silently reset.

#### TC-RETRO-025 - Tamper M-05: recomputed unkeyed checksum is rejected

**Scenario Type**: Negative
**Impact Level**: Critical
**Priority**: High
**Related IDs**: F-2, F-3, AC-F2-3, NFR-2, TDR-0009 C-3
**Test Type(s)**: Integration, Contract
**Automation Level**: Automated
**Target Layer / Location**: `tests/behaviour/retro-chain-mutations.test.ts`
**Tags**: @backend @security

**Preconditions**:

- A five-record sidecar and the public canonical-content helper used by the fixture.
- A temp mutant verifier that uses an unkeyed digest instead of the keyed link.

**Steps**:

1. Apply M-05: edit record `P`, then set its link to `unkeyedDigest(previousLink, canonicalContent)` — the exact value an unkeyed chain would accept.
2. Verify with the production verifier; assert a break at `P` and exit 1.
3. Verify the same bytes with the unkeyed mutant verifier; assert it reports `verified: true` — proving the forgery is valid under an unkeyed construction and that the keyed construction is what rejects it.
4. Assert the suite fails if the mutant verifier is ever substituted for the production one.
5. Assert the clean fixture verifies under both verifiers before the mutation (control).

**Expected Outcome**:

- A recomputed unkeyed checksum cannot forge a verified verdict; the test demonstrates the keyed construction is load-bearing rather than vacuous.

#### TC-RETRO-026 - Tamper M-06: key-artifact substitution fails verification

**Scenario Type**: Negative
**Impact Level**: Critical
**Priority**: High
**Related IDs**: F-2, F-3, DM-3, DM-4, AC-F2-3, AC-F2-2
**Test Type(s)**: Integration, Contract
**Automation Level**: Automated
**Target Layer / Location**: `tests/behaviour/retro-chain-mutations.test.ts`
**Tags**: @backend @security

**Preconditions**:

- A clean four-record sidecar with key K1; a second valid key K2 of the declared length.

**Steps**:

1. Verify with K1; assert `verified: true`.
2. Replace the key artifact content with K2 (same schema, same permissions); verify; assert a verification failure naming the affected sidecar domain.
3. Assert no record-position break is reported as the sole explanation; the failure identifies substitution.
4. Restore K1 and verify; assert clean again.
5. Run a mutant that accepts any key-shaped artifact without verifying the chain and assert it fails.

**Expected Outcome**:

- Key substitution is detected and named by domain; restoring the key restores verification.

#### TC-RETRO-027 - Every break reported across a multi-alteration sidecar

**Scenario Type**: Negative
**Impact Level**: Critical
**Priority**: High
**Related IDs**: F-3, DM-4, AC-F2-3, AC-F3-1
**Test Type(s)**: Integration, Contract
**Automation Level**: Automated
**Target Layer / Location**: `tests/behaviour/retro-chain.test.ts`
**Tags**: @backend @security

**Preconditions**:

- An eight-record sidecar with three independent alterations: an edit at P2, a deletion at P5, and a reorder at P7–P8.

**Steps**:

1. Verify; assert exactly three breaks and every position and trace id present.
2. Assert verification continued through the whole sequence (the last record was examined).
3. Walk the verdict, diagnostics, machine output, and human output; assert zero payload, checksum, or key bytes.
4. Assert the partial output lists only preserved entries plus the flags, and that no altered record is in `evidenceRefs`.
5. Assert the clean control reports zero breaks.

**Expected Outcome**:

- All breaks reported, each named, verification complete, output truthful and leak-free.

#### TC-RETRO-028 - A reported salvage removal is not a break

**Scenario Type**: Corner Case
**Impact Level**: Critical
**Priority**: High
**Related IDs**: F-3, AC-F3-1, TDR-0009
**Test Type(s)**: Integration, Contract
**Automation Level**: Automated
**Target Layer / Location**: `tests/behaviour/retro-chain-salvage.test.ts`
**Tags**: @backend

**Preconditions**:

- A sidecar with a torn trailing frame; the explicit salvage operation available.
- The salvage result reporting the removed byte range and records.

**Steps**:

1. Run the explicit salvage with the reported removal; assert the removal is recorded as evidence, not as a chain break.
2. Verify; assert zero breaks and verification over the surviving sequence.
3. Append a new record; assert it chains from the last survivor and the chain verifies.
4. Run a silent (unreported) removal and assert it produces a break, proving the distinction is observable.
5. Assert salvage is the only repair path; no automatic repair occurs on a normal read.

**Expected Outcome**:

- Reported salvage is distinguished from tampering; verification continues; repair remains explicit.

#### TC-RETRO-029 - The tamper mutation suite is complete and removal-sensitive

**Scenario Type**: Contract
**Impact Level**: Critical
**Priority**: High
**Related IDs**: F-2, F-3, AC-F2-3, NFR-2, RSK-4
**Test Type(s)**: Contract, Integration
**Automation Level**: Automated
**Target Layer / Location**: `tests/behaviour/retro-chain-mutations.test.ts`, `tests/fixtures/retro/mutations.json`
**Tags**: @backend @security

**Preconditions**:

- A committed mutation registry listing all six pinned alteration classes (M-01..M-06) with their fixtures and expected verdicts.
- A meta-test that reads the registry and drives each class.

**Steps**:

1. Assert the registry contains every pinned class exactly once and that each entry has a fixture, a mutation operation, an expected break position, and an expected identity.
2. Drive each entry and assert its expected observable (non-vacuity: the meta-test fails if a class produces no break).
3. Remove one class from a temp registry copy and assert the meta-test fails.
4. Assert every class runs beside a clean control in the same executed test.
5. Assert the count of executed mutation classes is positive and equals the registry size.

**Expected Outcome**:

- The suite is provably complete over the pinned classes and fails if a class is removed or weakened.

#### TC-RETRO-030 - Entry-level malformation in the sidecar classifies and preserves

**Scenario Type**: Negative
**Impact Level**: Critical
**Priority**: High
**Related IDs**: F-4, DM-8, AC-F4-1, NFR-1
**Test Type(s)**: Integration, Contract
**Automation Level**: Automated
**Target Layer / Location**: `tests/behaviour/retro-malformed.test.ts`, `tests/fixtures/retro/malformed.json`
**Tags**: @backend @security

**Preconditions**:

- A clean five-record sidecar; the 12-case sidecar matrix (E-01..E-04 at first, middle, last).
- A byte snapshot and digest before each run.

**Steps**:

1. For each case, write the malformed record at the target position and run `retro report`.
2. Assert exit 1 and `retro.evidence.malformed-entry`; assert the finding names the 1-based position and never payload bytes.
3. Assert every valid entry is processed and rendered; assert the sidecar digest is unchanged after the classified read.
4. Assert the run does not crash, does not silently drop the malformed entry, and does not return `verified: true` for a chain containing the malformed record.
5. Run the equivalent clean five-record fixture and assert exit 0 with five entries rendered.
6. Run a mutant that aborts on the first malformed entry and assert the suite fails.

**Expected Outcome**:

- 12/12 classify in-band with positions named, zero valid-entry loss, zero mutation, zero crash.

#### TC-RETRO-031 - Entry-level malformation in the retro registry classifies and preserves

**Scenario Type**: Negative
**Impact Level**: Critical
**Priority**: High
**Related IDs**: F-4, F-8, AC-F4-1, AC-F8-1, NFR-1
**Test Type(s)**: Integration, Contract
**Automation Level**: Automated
**Target Layer / Location**: `tests/behaviour/retro-malformed.test.ts`, `tests/behaviour/retro-registry.test.ts`
**Tags**: @backend

**Preconditions**:

- A registry with valid level entries and three valid run records; the same 12-case matrix applied to run records.
- A level entry with a closed-vocabulary violation (E-04) as an additional case.

**Steps**:

1. For each case, run collect and report; assert `retro.evidence.malformed-entry`, exit 1, position named.
2. Assert every valid run record still folds into the report and every valid level still resolves.
3. Assert the malformed entry never yields a silent zero, a zeroed count, or a fabricated level.
4. Assert the registry bytes are unchanged by the classified read.
5. Assert a clean registry control yields a verified-empty or valid verdict with no malformed finding.

**Expected Outcome**:

- Registry malformation classifies on both command paths, valid entries survive, and no silent zero appears.

#### TC-RETRO-032 - Preserved output is byte-identical and the error envelope is truthful

**Scenario Type**: Negative
**Impact Level**: Critical
**Priority**: High
**Related IDs**: F-4, F-10, AC-F4-2, DEC-12
**Test Type(s)**: Integration, Contract
**Automation Level**: Automated
**Target Layer / Location**: `tests/behaviour/retro-malformed.test.ts`, `tests/behaviour/retro-output.test.ts`
**Tags**: @backend @golden

**Preconditions**:

- One malformed record in a five-record sidecar and the equivalent clean fixture.
- The partial-run fact fields (entries processed, entries preserved, first flagged position).

**Steps**:

1. Render the clean run's machine `data` and the malformed run's preserved portion; after removing the flag lines, assert the preserved entries are byte-identical.
2. Assert the error summary contains exactly the bounded partial-run facts: entries processed, entries preserved, first flagged position (or trace id).
3. Assert the failure envelope has `error` and no `data` key; assert the success envelope has `data` and no `error`.
4. Assert the human channel prints the preserved partial output before the diagnostic line.
5. Run a mutant that drops the last valid entry and a mutant that emits both `data` and `error`; assert both fail.

**Expected Outcome**:

- Byte-identical preserved output, exact partial facts, an error-only envelope, and human output in the contracted order.

#### TC-RETRO-033 - Store-level damage classifies as unreachable with salvage as the recovery

**Scenario Type**: Negative
**Impact Level**: Critical
**Priority**: High
**Related IDs**: F-4, F-10, AC-F4-2, DEC-7
**Test Type(s)**: Integration, Contract
**Automation Level**: Automated
**Target Layer / Location**: `tests/behaviour/retro-malformed.test.ts`
**Tags**: @backend

**Preconditions**:

- The five store-level fixtures of §4.5 (S-01..S-05) and a repaired-store control for each.

**Steps**:

1. Run report and collect for each case; assert the failure is a store-level state identity, not `retro.evidence.malformed-entry` and not a partial verified read.
2. Assert S-01/S-02/S-03 are `state.store.torn` at exit 2 and S-04 is `state.keys.missing` at exit 2.
3. Assert S-05 is `state.permission.denied`; record the identity and mark the exit **TODO** per GAP-T3.
4. Assert the pre-salvage read never serves partial records and the post-salvage read continues over the surviving sequence.
5. Assert each repaired control succeeds and the classification is not sticky.

**Expected Outcome**:

- Store damage fails closed with the existing identities; salvage is the only recovery; the permission-violation exit is recorded as blocked.

#### TC-RETRO-034 - Zero uncaught crashes and zero data loss across the full matrix

**Scenario Type**: Regression
**Impact Level**: Critical
**Priority**: High
**Related IDs**: F-4, AC-F4-1, AC-F4-2, NFR-1
**Test Type(s)**: Integration, Contract
**Automation Level**: Automated
**Target Layer / Location**: `tests/behaviour/retro-malformed.test.ts`
**Tags**: @backend

**Preconditions**:

- The 24-case entry-level matrix, the five-case store-level matrix, and three multi-malformation fixtures.
- A run wrapper that records any thrown exception and any unclassified exit.

**Steps**:

1. Execute every case through both commands; assert zero uncaught exceptions and zero unclassified exits.
2. Assert 100 % of entry-level cases return `retro.evidence.malformed-entry` and 100 % of store-level cases return a state identity.
3. Assert preserved counts equal valid-entry counts in every entry-level case and that the store digest is unchanged.
4. Assert the aggregate reports a positive executed-case count equal to the declared matrix size (non-vacuity floor).
5. Assert a deliberately crashing mutant (an unguarded `JSON.parse` on a bad frame) is caught by the wrapper.

**Expected Outcome**:

- The full matrix classifies, preserves, and never crashes; the count assertions cannot pass on an empty run.

#### TC-RETRO-035 - Report data shape, provenance and evidence resolution

**Scenario Type**: Happy Path
**Impact Level**: Critical
**Priority**: High
**Related IDs**: F-5, DM-6, AC-F5-1
**Test Type(s)**: Integration, Contract
**Automation Level**: Automated
**Target Layer / Location**: `tests/behaviour/retro-report.test.ts`, `tests/golden/**`
**Tags**: @backend @golden

**Preconditions**:

- Verified sidecar evidence and registry runs covering one finding from each fold source: a recorded retro note, a collector finding, a truth-check finding, and a tamper/malformation flag (a non-tampered fixture constructs the flag source without an actual break).
- The declared report schema identity constant.

**Steps**:

1. Run `retro report --level change --json`; assert exit 0 and that `data` keys are exactly `level`, `findings`, `followThrough`, `evidenceRefs` (A-T4).
2. Assert `level` is `change`; assert every finding has exactly `kind`, `text`, `evidenceRefs`, with `kind` in the declared closed vocabulary.
3. Assert every finding's evidence refs resolve to an existing sidecar record and every `evidenceRefs` entry resolves.
4. Assert no finding exists without a source fact (walk each text back to its fixture) and no source fact is invented.
5. Assert the declared report schema identity `delivery.retro.report.v1` is present as a contract constant and referenced by the golden.

**Expected Outcome**:

- The exact four-key data shape with folded, evidence-linked findings and no fabrication.

#### TC-RETRO-036 - Follow-through read-fold with honest verification markers

**Scenario Type**: Happy Path
**Impact Level**: Critical
**Priority**: High
**Related IDs**: F-5, DM-6, AC-F5-1
**Test Type(s)**: Integration, Contract
**Automation Level**: Automated
**Target Layer / Location**: `tests/behaviour/retro-report.test.ts`
**Tags**: @backend

**Preconditions**:

- Recorded follow-through entries: one with an artifact that a delivered surface can verify (fixture reports verified) and one whose artifact cannot be checked.
- A fixture with no follow-through entries.

**Steps**:

1. Run report; assert only recorded entries appear, in recorded order, each with action, verdict, and an artifact reference only where one exists.
2. Assert the verifiable entry carries the verified verdict and its artifact reference; assert the unverifiable entry is marked unverified (or the declared "unknown" verdict) and never claims verification.
3. Assert the empty fold renders `[]`, never omitted and never fabricated.
4. Assert no enforcement semantics run (no aging, escalation, or closure) — the fold is read-only.
5. Run a mutant that invents an entry and a mutant that marks the unverifiable entry verified; assert both fail.

**Expected Outcome**:

- Follow-through is a read-fold of recorded facts with honest verification markers and an explicit empty array.

#### TC-RETRO-037 - Null retro is an explicit, successful empty report

**Scenario Type**: Edge Case
**Impact Level**: Critical
**Priority**: High
**Related IDs**: F-5, F-6, DM-6, AC-F5-2
**Test Type(s)**: Integration, Contract
**Automation Level**: Automated
**Target Layer / Location**: `tests/behaviour/retro-report.test.ts`
**Tags**: @backend @golden

**Preconditions**:

- A verified sidecar with a collected scope whose evidence folds to zero findings; all five truth checks pass; no follow-through entries.

**Steps**:

1. Run report; assert exit 0, `findings: []`, `followThrough: []`, and `evidenceRefs` listing the verified-empty evidence records.
2. Assert explicit verified-empty evidence names each check that produced the verdict.
3. Assert no finding is manufactured to justify the run and no placeholder text exists.
4. Assert the human output states the verified-empty condition plainly.
5. Run a one-trigger control and assert exactly one finding appears, proving emptiness is not hardcoded.

**Expected Outcome**:

- An explicit empty report at exit 0 with verified-empty evidence and no fabrication.

#### TC-RETRO-038 - Byte-identical replays, zero ambient reads and zero model calls

**Scenario Type**: Regression
**Impact Level**: Critical
**Priority**: High
**Related IDs**: F-5, AC-F5-1, NFR-6
**Test Type(s)**: Integration, Contract
**Automation Level**: Automated
**Target Layer / Location**: `tests/behaviour/retro-report-determinism.test.ts`
**Tags**: @backend @golden

**Preconditions**:

- Fixed sidecar/registry state, `NOW_MS`, run-id and trace-id sequences, brand, and mode fact.
- Throwing stubs for `Date.now`, `Math.random`, and `fetch`, restored in `afterEach`; an inference-seam spy.

**Steps**:

1. Run report three times; assert byte-identical stdout and deep-equal `data`.
2. Assert the sidecar and registry read call logs are identical across runs (same limit, same order).
3. Install the throwing ambient stubs and rerun; assert the same success and bytes.
4. Assert the inference-seam spy records zero calls for collect, report, and export.
5. Run a `Date.now()` renderer mutant and an inference-calling mutant; assert both fail.

**Expected Outcome**:

- Deterministic output with zero ambient reads and zero model calls.

#### TC-RETRO-039 - The report path performs the verified read and never trusts altered records

**Scenario Type**: Negative
**Impact Level**: Critical
**Priority**: High
**Related IDs**: F-2, F-3, AC-F2-3, AC-F3-1, AC-F5-1
**Test Type(s)**: Integration, Contract
**Automation Level**: Automated
**Target Layer / Location**: `tests/behaviour/retro-report-determinism.test.ts`
**Tags**: @backend @security

**Preconditions**:

- A sidecar with two collected scopes; one record in the current scope edited.

**Steps**:

1. Run report; assert it performs the verified read over the whole sidecar, fails `retro.evidence.tamper-flagged` at exit 1, and never serves the altered record in findings or `evidenceRefs`.
2. Assert the preserved earlier findings still render and the altered record's finding is absent.
3. Assert the run record for the failed report records the tamper outcome, not a success.
4. Assert the clean fixture reports successfully in the same test.
5. Run a mutant that skips verification on the report path and assert the suite fails.

**Expected Outcome**:

- Every consumption path verifies; altered records are never served as findings.

#### TC-RETRO-040 - The report folds the most recent collected scope and its run records

**Scenario Type**: Happy Path
**Impact Level**: Important
**Priority**: Medium
**Related IDs**: F-5, DM-5, AC-F5-1
**Test Type(s)**: Integration
**Automation Level**: Automated
**Target Layer / Location**: `tests/behaviour/retro-report.test.ts`
**Tags**: @backend

**Preconditions**:

- Two collected scopes (older and newer) with distinct evidence and run records; a run record for a report invocation.

**Steps**:

1. Run report; assert the folded scope is the level's most recent collected scope.
2. Assert counts and verdicts in the report trace to the corresponding run record, not to a re-derived value.
3. Assert older-scope evidence does not appear in the current report except through an explicit evidence ref.
4. Assert a report run record is appended for the report itself and does not change the folded scope.
5. Run a mutant that folds the oldest scope and assert the suite fails.

**Expected Outcome**:

- Deterministic most-recent-scope reporting with run-record provenance.

#### TC-RETRO-041 - Truth check C-01: skipped ordinals surface and are never dropped

**Scenario Type**: Negative
**Impact Level**: Critical
**Priority**: High
**Related IDs**: F-1, F-6, AC-F1-2, AC-F6-1
**Test Type(s)**: Integration, Contract
**Automation Level**: Automated
**Target Layer / Location**: `tests/behaviour/retro-truth-checks.test.ts`
**Tags**: @backend

**Preconditions**:

- An audit read with two orphan reservations (distinct ordinals and positions) and a verified chain.
- A clean audit read with zero orphans.

**Steps**:

1. Run collect; assert two named C-01 findings, each with the ordinal, run id, position and evidence refs.
2. Assert the findings appear in the report and in the run record's truth verdict; assert neither is dropped, merged, or summarised.
3. Assert the findings are classified as truth findings (not fabricated user notes).
4. Run the clean control; assert zero C-01 findings and an explicit verified-empty audit entry.
5. Run a mutant that filters orphan findings out of the evidence and assert the suite fails.

**Expected Outcome**:

- Every skipped ordinal reaches the learning plane with provenance; zero is dropped.

#### TC-RETRO-042 - Truth check C-02: a broken audit-ledger verdict is a retro finding

**Scenario Type**: Negative
**Impact Level**: Critical
**Priority**: High
**Related IDs**: F-1, F-6, AC-F6-1
**Test Type(s)**: Integration, Contract
**Automation Level**: Automated
**Target Layer / Location**: `tests/behaviour/retro-truth-checks.test.ts`
**Tags**: @backend

**Preconditions**:

- An audit read with `chain.verified: false`, one break, and a non-zero record count.
- A verified audit read control.

**Steps**:

1. Run collect and report; assert a named C-02 finding carries the broken verdict, the break positions, and evidence refs.
2. Assert the run record's truth verdict is not `clean` and the consumed verdict is carried verbatim.
3. Assert the finding text names the audit domain, never the sidecar as tampered.
4. Assert the report does not claim a clean truth result; the exact error identity and exit for blocking a clean exit are **TODO** per GAP-T5 (OQ-T3).
5. Run the verified control; assert zero C-02 findings and an explicit verified entry.

**Expected Outcome**:

- A broken audit chain is visible in the learning plane without re-reading the ledger, and is never reported as clean.

**Notes / Clarifications**:

- GAP-T5: AC-F6-1 requires this trigger to "block a clean exit with the classified evidence" but pins no identity. The test asserts the mandatory finding and non-clean verdict; it does not guess an identity. Blocked pending PM resolution.

#### TC-RETRO-043 - Truth check C-03: a dangling evidence ref is flagged

**Scenario Type**: Negative
**Impact Level**: Critical
**Priority**: High
**Related IDs**: F-5, F-6, DM-6, AC-F6-1
**Test Type(s)**: Integration, Contract
**Automation Level**: Automated
**Target Layer / Location**: `tests/behaviour/retro-truth-checks.test.ts`
**Tags**: @backend

**Preconditions**:

- A report fold whose evidence refs include one trace id that no longer resolves (the record was removed by an explicit, reported salvage).
- A control where every ref resolves.

**Steps**:

1. Run report; assert a named C-03 finding for the dangling ref.
2. Assert the dangling ref is never listed among trusted `evidenceRefs` and no finding rests on it.
3. Assert every other ref resolves and the report still renders.
4. Run the control; assert zero C-03 findings.
5. Run a mutant resolver that fabricates a placeholder record for a missing ref; assert the suite fails.

**Expected Outcome**:

- Dangling refs are flagged, never silently trusted, and never fabricated into existence.

#### TC-RETRO-044 - Truth check C-04: expected-activity-absent is flagged, not silent

**Scenario Type**: Negative
**Impact Level**: Critical
**Priority**: High
**Related IDs**: F-1, F-5, F-6, AC-F6-1
**Test Type(s)**: Integration, Contract
**Automation Level**: Automated
**Target Layer / Location**: `tests/behaviour/retro-truth-checks.test.ts`
**Tags**: @backend

**Preconditions**:

- Fixture A: a completed change whose collection window contains zero audit invocations.
- Fixture B: a closed change with no closeout outcome record.
- Fixture C: a legitimately quiet change with no expected activity (verified-empty).

**Steps**:

1. Run collect/report on A; assert a named C-04 finding naming the absent audit activity and its window.
2. Run B; assert a named C-04 finding naming the absent closeout record.
3. Run C; assert no C-04 finding and explicit verified-empty evidence naming the check.
4. Assert a change with one invocation and one closeout record yields no C-04 finding (paired control).
5. Run a mutant that treats a zero-count window as verified-empty without checking expectation; assert A and B fail.

**Expected Outcome**:

- Expected activity absent is loud; genuine quiet is verified-empty; the distinction is observable.

#### TC-RETRO-045 - Truth check C-05: a zero-collector run is never a silent success

**Scenario Type**: Negative
**Impact Level**: Critical
**Priority**: High
**Related IDs**: F-1, F-6, AC-F6-1
**Test Type(s)**: Integration, Contract
**Automation Level**: Automated
**Target Layer / Location**: `tests/behaviour/retro-truth-checks.test.ts`
**Tags**: @backend

**Preconditions**:

- A declared non-empty source set with a collector call log showing zero executed collectors (all collectors skipped for a non-classified reason).
- A control with one executed collector.

**Steps**:

1. Run collect; assert a named C-05 finding stating that zero collectors ran and naming the declared source set.
2. Assert the run is never rendered as a silent success and the run record's truth verdict records the finding.
3. Assert the report surfaces the finding.
4. Assert the exact identity and exit for blocking a clean exit are **TODO** per GAP-T5.
5. Run the one-collector control; assert zero C-05 findings.

**Expected Outcome**:

- A pipeline that ran nothing cannot read as clean; the finding is explicit and evidenced.

#### TC-RETRO-046 - Verified-empty is explicit and distinct from vacuous green

**Scenario Type**: Edge Case
**Impact Level**: Critical
**Priority**: High
**Related IDs**: F-5, F-6, AC-F5-2, AC-F6-1
**Test Type(s)**: Integration, Contract
**Automation Level**: Automated
**Target Layer / Location**: `tests/behaviour/retro-truth-checks.test.ts`
**Tags**: @backend

**Preconditions**:

- Three legitimately empty sources (audit, state families, notes) with a verified empty audit chain.
- One fixture with activity in one source.

**Steps**:

1. Run report on the empty fixture; assert explicit verified-empty evidence for each of the three sources, naming the check that produced each verdict.
2. Assert `findings: []` and that no finding is fabricated.
3. Run the active fixture; assert the active source is not labelled verified-empty and produces its real finding or evidence entry.
4. Assert the two fixtures render distinguishable verdicts.
5. Run a mutant that emits empty findings with no verified-empty evidence (vacuous green); assert the suite fails.

**Expected Outcome**:

- Checked-and-empty is explicit and named; silence is never mistaken for success.

#### TC-RETRO-047 - Disabling any truth check fails the suite

**Scenario Type**: Regression
**Impact Level**: Critical
**Priority**: High
**Related IDs**: F-6, AC-F6-1, RSK-4
**Test Type(s)**: Integration, Contract
**Automation Level**: Automated
**Target Layer / Location**: `tests/checks/retro-truth-check-mutants.test.ts`, `tests/fixtures/retro/truth-mutants/**`
**Tags**: @backend

**Preconditions**:

- Five temp mutant copies of the truth-check module, each with exactly one check disabled.
- The trigger fixtures for C-01..C-05.

**Steps**:

1. For each mutant, import it through a file URL, run the trigger fixture, and assert the prohibited observable appears: a dropped finding, a silent clean exit, or a fabricated verified-empty.
2. Assert the suite fails for each mutant (the meta-test reports a caught mutant).
3. Assert the unmutated module passes all five triggers.
4. Assert a mutant that disables all five checks is also caught.
5. Assert the mutant registry size equals five (non-vacuity floor).

**Expected Outcome**:

- Every check is load-bearing; removing any one is detected by the permanent suite.

#### TC-RETRO-048 - Findings correspond exactly to triggered checks, never fabricated

**Scenario Type**: Regression
**Impact Level**: Critical
**Priority**: High
**Related IDs**: F-5, F-6, AC-F5-2, AC-F6-1
**Test Type(s)**: Integration, Contract
**Automation Level**: Automated
**Target Layer / Location**: `tests/behaviour/retro-truth-checks.test.ts`
**Tags**: @backend

**Preconditions**:

- One single-trigger fixture per check (five fixtures) and one quiet fixture.

**Steps**:

1. For each single-trigger fixture, assert exactly one truth finding and that its kind/check id matches the triggered check.
2. Assert the quiet fixture yields zero truth findings and explicit verified-empty entries.
3. Assert a fixture with two triggers yields exactly two findings.
4. Assert no finding text is generated from a template without a corresponding evidence ref.
5. Run a mutant that always emits one boilerplate finding; assert the quiet fixture case fails.

**Expected Outcome**:

- Finding count equals triggered-check count, with exact provenance and zero fabrication.

#### TC-RETRO-049 - Bounded, deterministic export bundle with the chain verdict

**Scenario Type**: Happy Path
**Impact Level**: Critical
**Priority**: High
**Related IDs**: F-7, DM-7, AC-F7-1, NFR-5
**Test Type(s)**: Integration, Contract
**Automation Level**: Automated
**Target Layer / Location**: `tests/behaviour/retro-export.test.ts`
**Tags**: @backend @golden

**Preconditions**:

- A verified sidecar with eight records; a temp destination path; a limit of three; the declared export schema identity.
- Byte snapshots of the sidecar and registry.

**Steps**:

1. Invoke the export engine with the explicit destination and limit; assert the bundle carries the declared export schema identity, exactly three selected records with trace ids and watermarks, and the full chain verdict.
2. Assert truncation is reported in-band with matched/returned counts.
3. Assert the destination contains the bundle and no other path was written.
4. Assert the sidecar and registry bytes are unchanged.
5. Run the same request twice; assert byte-identical bundles (A-T1 determinism).
6. Record the invoking-surface assertion as **TODO** per GAP-T4.

**Expected Outcome**:

- A bounded, deterministic, integrity-carrying bundle at the named destination with zero mutation.

#### TC-RETRO-050 - Export refuses a missing destination or an invalid limit

**Scenario Type**: Negative
**Impact Level**: Critical
**Priority**: High
**Related IDs**: F-7, AC-F7-1, NFR-5
**Test Type(s)**: Integration, Contract
**Automation Level**: Automated
**Target Layer / Location**: `tests/behaviour/retro-export.test.ts`
**Tags**: @backend

**Preconditions**:

- Requests: no destination, empty destination, no limit, limit 0, negative limit, non-integer limit, and a limit above the declared maximum.

**Steps**:

1. Assert each request refuses classified before any write (`input.value.rejected` shape), with zero bytes written and no destination defaulted.
2. Assert there is no implicit or default destination anywhere in the export surface.
3. Assert the export surface exposes no unbounded variant (no "all records" mode) and no optional-limit overload.
4. Assert the valid request from TC-RETRO-049 succeeds as the paired control.
5. Record the exact refusal identity and exit as **TODO** per GAP-T4.

**Expected Outcome**:

- No unbounded or implicit export path exists; every invalid request refuses before I/O.

#### TC-RETRO-051 - Export truncation is reported in-band at the exact boundary

**Scenario Type**: Edge Case
**Impact Level**: Important
**Priority**: Medium
**Related IDs**: F-7, AC-F7-1, NFR-5
**Test Type(s)**: Integration, Contract
**Automation Level**: Automated
**Target Layer / Location**: `tests/behaviour/retro-export.test.ts`
**Tags**: @backend

**Preconditions**:

- A five-record sidecar; limits 5, 4 and 1.

**Steps**:

1. Assert limit 5 returns five records with `truncated: false`.
2. Assert limit 4 returns four records with `truncated: true` and matched 5.
3. Assert limit 1 returns one record with `truncated: true`.
4. Assert the bundle lists exactly the returned records and no more.
5. Run an off-by-one mutant (`<=` instead of `<`) and assert the boundary fails.

**Expected Outcome**:

- Truncation is exact at the boundary and always reported in-band.

#### TC-RETRO-052 - Export passes the redaction chokepoint and mutates nothing

**Scenario Type**: Regression
**Impact Level**: Critical
**Priority**: High
**Related IDs**: F-7, AC-F7-1, NFR-10
**Test Type(s)**: Integration, Contract
**Automation Level**: Automated
**Target Layer / Location**: `tests/behaviour/retro-export.test.ts`, `tests/behaviour/retro-privacy.test.ts`
**Tags**: @backend @security

**Preconditions**:

- Evidence containing an edge-registered secret canary (asserted present in the source fixture first).
- A destination in a temp directory.

**Steps**:

1. Run export; assert the canary appears zero times in the bundle bytes.
2. Assert the source fixture demonstrably contained the canary (presence control).
3. Assert the bundle was produced through the single serialization/redaction path (one recorded serialization call).
4. Assert the sidecar and registry are unmutated.
5. Run a mutant that serializes the bundle directly, bypassing the chokepoint; assert the canary appears and the suite fails.

**Expected Outcome**:

- Zero secret survivors in the bundle; the chokepoint is the only path.

#### TC-RETRO-053 - `retro.evidence.denied`: structural refusal outside the collector seam

**Scenario Type**: Negative
**Impact Level**: Critical
**Priority**: High
**Related IDs**: F-2, F-10, DM-8, AC-F2-4, NFR-4, TDR-0009
**Test Type(s)**: Integration, Contract
**Automation Level**: Automated
**Target Layer / Location**: `tests/behaviour/retro-denied.test.ts`
**Tags**: @backend @security

**Preconditions**:

- A sidecar with records; a byte snapshot.
- A direct writer probe that bypasses the collector seam and a delivery-agent-context probe.

**Steps**:

1. Attempt each write; assert `retro.evidence.denied`, exit 2, `not_landed`, and byte-identical sidecar before/after.
2. Assert the diagnostic states structural write-path ownership plus claimed-identity marking and explicitly says it is not authentication.
3. Assert no credential or identity verification result is consulted to make the decision (a spy on the identity resolver records zero reads).
4. Assert a collector-seam append succeeds in the same test.
5. Run a mutant that permits a direct write when the claimed identity looks like a collector; assert the suite fails.

**Expected Outcome**:

- Non-collector writes are refused structurally, the sidecar is unmodified, and the guarantee wording is honest.

#### TC-RETRO-054 - Claimed collector identity: attribution, never authentication

**Scenario Type**: Happy Path
**Impact Level**: Important
**Priority**: Medium
**Related IDs**: F-2, DM-2, EVT-1, AC-F2-1, AC-F2-4
**Test Type(s)**: Integration, Contract
**Automation Level**: Automated
**Target Layer / Location**: `tests/behaviour/retro-denied.test.ts`, `tests/behaviour/retro-sidecar-append.test.ts`
**Tags**: @backend

**Preconditions**:

- Injected identity fixtures: present non-empty, absent, empty, whitespace-only, and a delivery-agent-shaped value.

**Steps**:

1. Assert a present identity is recorded verbatim on the record with the `claimed` marker.
2. Assert absent, empty, and whitespace-only record no identity and infer none from user, host, session, or environment.
3. Assert a delivery-agent-shaped value is still recorded as claimed evidence when written through the collector seam, proving identity is attribution only.
4. Assert identity is never an authorization input: the same value written outside the seam is refused structurally (TC-RETRO-053), independent of the value.
5. Run a mutant that trims a present value or infers an identity; assert both fail.

**Expected Outcome**:

- Identity is claimed attribution with no inference and no authorization semantics.

#### TC-RETRO-055 - Registry boundary verdict matrix and classified write refusal

**Scenario Type**: Negative
**Impact Level**: Critical
**Priority**: High
**Related IDs**: F-8, DM-1, DM-5, AC-F8-1, NFR-1
**Test Type(s)**: Integration, Contract
**Automation Level**: Automated
**Target Layer / Location**: `tests/behaviour/retro-registry.test.ts`
**Tags**: @backend

**Preconditions**:

- Fixtures for valid, verified-empty, torn, and unknown registry states.
- Write probes with a bad kind, a bad payload schema, a missing required field, and a closed-vocabulary violation.

**Steps**:

1. Assert each read verdict is distinct and carries repair guidance for torn and unknown.
2. Assert no read returns a silent zero: an unknown kind must not render as "zero levels" or "zero runs".
3. Assert each invalid write is refused `state.store.unknown` with `not_landed` and appends nothing.
4. Assert a valid write succeeds and the store verifies.
5. Run a mutant that defaults an unknown read to an empty value; assert the suite fails.

**Expected Outcome**:

- Four distinct verdicts with guidance; conforming writes only; no silent zeros.

#### TC-RETRO-056 - `state check` reports the retro registry store verdict

**Scenario Type**: Happy Path
**Impact Level**: Critical
**Priority**: High
**Related IDs**: F-8, AC-F8-1, M1-S2 contract
**Test Type(s)**: Integration, Contract
**Automation Level**: Automated
**Target Layer / Location**: `tests/behaviour/doctor-state.test.ts` (update)
**Tags**: @backend

**Preconditions**:

- Doctor's injected store facts extended with the retro registry: verified-empty, torn, unknown-kind, and permission cases.

**Steps**:

1. Run doctor with a verified-empty retro registry; assert the state check reports `ok` with `observed-empty` evidence and the retro store named.
2. Run with a torn registry; assert the state check reports `fail` with `store-torn`, a fix hint, and the retro store named.
3. Run with an undeclared record kind; assert `store-unknown` and a hint.
4. Run with a permission violation; assert `store-unreadable` and a hint.
5. Assert the overall doctor verdict and exit follow the existing rules and no new doctor reason was invented.
6. Run a mutant that omits the retro store from the state read; assert the suite fails.

**Expected Outcome**:

- `state check` reports the retro registry verdict with the existing vocabulary and hints.

#### TC-RETRO-057 - Registry level and run record shapes are validated and additive

**Scenario Type**: Contract
**Impact Level**: Important
**Priority**: Medium
**Related IDs**: F-8, DM-1, DM-5, EVT-2, AC-F8-1
**Test Type(s)**: Contract, Integration
**Automation Level**: Automated
**Target Layer / Location**: `tests/behaviour/retro-registry.test.ts`, `tests/structure/retro-contract.test.ts`
**Tags**: @backend

**Preconditions**:

- The declared boundary declaration for the retro registry.
- A seeded registry with levels and runs interleaved with other store kinds.

**Steps**:

1. Assert the boundary declares the level and run kinds with their schema ids, identity fields, required fields, and closed vocabularies.
2. Assert a level entry's exact field set and a run record's exact field set.
3. Assert both kinds are additive and interleave safely; assert reading them does not disturb other kinds.
4. Assert a payload with an extra undeclared field is refused or preserved as unknown per the state contract, never silently accepted.
5. Run a missing-field and a widened-field mutant; assert both fail.

**Expected Outcome**:

- Exact validated shapes, additive composition, no silent widening.

#### TC-RETRO-058 - Level refusal matrix with owning-story hints and zero I/O

**Scenario Type**: Negative
**Impact Level**: Critical
**Priority**: High
**Related IDs**: F-8, DM-1, AC-F1-3
**Test Type(s)**: Integration, Contract
**Automation Level**: Automated
**Target Layer / Location**: `tests/behaviour/retro-levels.test.ts`
**Tags**: @backend

**Preconditions**:

- The declared level set and a declared level→owning-story map for the five declared-only levels.
- An I/O spy over the store and collectors.

**Steps**:

1. Run each row L-04..L-08 of §4.6; assert `input.value.rejected`, exit 1, and a remediation hint that contains the declared owning story for that level.
2. Assert zero store reads, zero collector reads, and zero appends for every refusal.
3. Assert the hint map covers all five declared-only levels and contains no empty value.
4. Assert L-09 (wrong case) is rejected as unknown.
5. Run the `change` control (L-03) and assert it runs.
6. Run a mutant that removes one hint and assert the suite fails.

**Expected Outcome**:

- Declared-but-unimplemented levels refuse before I/O with a real owning-story hint; no vacuous run.

**Notes / Clarifications**:

- The exact story ids are delivery-bound (A-T6); the test asserts completeness and shape, not invented ids.

#### TC-RETRO-059 - Omitted level defaults to `change`; the locked surface is enforced

**Scenario Type**: Happy Path
**Impact Level**: Critical
**Priority**: High
**Related IDs**: F-8, AC-F1-3
**Test Type(s)**: Integration, Contract
**Automation Level**: Automated
**Target Layer / Location**: `tests/behaviour/retro-levels.test.ts`
**Tags**: @backend

**Preconditions**:

- A seeded completed change and a verified sidecar.

**Steps**:

1. Assert `retro collect` with no `--level` selects `change` and runs (L-01).
2. Assert `retro report` with no `--level` reports `change` (L-02).
3. Assert `--level change` is equivalent to omission for both commands.
4. Assert `--json` is accepted globally and `--pretty`/`--verbose` do not change the data.
5. Assert L-10/L-11/L-12/L-14 rejections: missing value, extra positional, `--ref`, and no/unknown subcommand.
6. Run a mutant that accepts `--ref` or silently ignores an extra positional; assert the suite fails.

**Expected Outcome**:

- The omission default is load-bearing; the locked surface is exact; no new flags are accepted.

#### TC-RETRO-060 - The periodic memory-audit trigger is registered and its run is evidence

**Scenario Type**: Happy Path
**Impact Level**: Important
**Priority**: Medium
**Related IDs**: F-9, DM-1, EVT-1, AC-F9-1
**Test Type(s)**: Integration, Contract
**Automation Level**: Automated
**Target Layer / Location**: `tests/behaviour/retro-memory-audit.test.ts`
**Tags**: @backend

**Preconditions**:

- A registry fixture including the periodic memory-audit trigger with a declared cadence.
- A recorded audit run fixture with trigger identity, window, outcome refs, and trace ids.

**Steps**:

1. Assert the trigger is registered in the level/trigger registry with a declared cadence drawn from the declared vocabulary.
2. Append a run through the collector seam; assert the evidence carries trigger identity, window bounds, outcome refs, and trace ids.
3. Run `retro report`; assert the run is queryable like any other evidence and appears in `evidenceRefs`.
4. Assert no memory-audit command exists in the command surface, the commands index, or the edge composition.
5. Assert the memory consolidation procedure body was not copied into source (no skill-text markers) and that only the run facts are recorded.
6. Run a mutant that adds a `memory-audit` command or drops the trigger; assert both fail.

**Expected Outcome**:

- The audit's home is the retro pipeline, its runs are evidence, and no new command or procedure was created.

#### TC-RETRO-061 - Bounded work and the non-CI performance reference on 10,000 records

**Scenario Type**: Performance
**Impact Level**: Important
**Priority**: Medium
**Related IDs**: NFR-7, NFR-5
**Test Type(s)**: Integration, Performance
**Automation Level**: Automated (bounded-work) plus a recorded non-CI reference
**Target Layer / Location**: `tests/behaviour/retro-performance.test.ts`
**Tags**: @backend @perf

**Preconditions**:

- A generated sidecar of 10,000 synthetic records (counts and short payloads only).
- Call counters over the store and audit read surfaces; the declared timeout constants.

**Steps**:

1. Assert report performs exactly one chain walk over the sidecar and a bounded number of registry reads, independent of the record count (compare a 10-record and a 10,000-record fixture for call-count invariance).
2. Assert collect performs a bounded number of appends equal to the collected item count and a positive bounded audit-read limit.
3. Assert export reads at most the requested limit and the chain verdict pass.
4. Assert declared timeout constants are present and referenced at the admitted I/O boundaries.
5. Measure collect, report, and export wall time once on the generated sidecar; record the numbers in §10 as a **non-CI reference**, never as a pass gate.
6. Run a per-record-extra-read mutant; assert the invariance fails.

**Expected Outcome**:

- CI proves bounded work with count invariance; the reference numbers are recorded separately and NFR-7 remains a target.

#### TC-RETRO-062 - Hermeticity, no ambient reads, and fixture key hygiene

**Scenario Type**: Regression
**Impact Level**: Critical
**Priority**: High
**Related IDs**: NFR-6, NFR-3, NFR-9
**Test Type(s)**: Static, Integration
**Automation Level**: Automated
**Target Layer / Location**: `tests/behaviour/retro-hermetic.test.ts`, `tests/structure/retro-imports.test.ts`
**Tags**: @backend @security

**Preconditions**:

- The retro suite files and the committed retro fixtures/goldens; a path scanner for real home shapes and key-shaped hex literals.

**Steps**:

1. Scan the suites for spawns, network clients, `$HOME`, `os.homedir`, ambient `process.env` reads used for verdicts, and writes outside temp roots; assert zero with a seeded control.
2. Scan the committed fixtures and goldens for key-shaped literals; assert only the allowlisted test key appears.
3. Scan for real path prefixes and user names; assert zero.
4. Assert the scan reports a positive file count.
5. Plant a spawn, a home-shaped path assembled at runtime, and a second key-shaped literal in temp copies; assert each is caught.

**Expected Outcome**:

- The suites are hermetic, fixtures carry no real or secret content, and the scans are demonstrably live.

#### TC-RETRO-063 - Envelope, exit projection and partial-output rendering

**Scenario Type**: Regression
**Impact Level**: Critical
**Priority**: High
**Related IDs**: F-5, F-10, AC-F4-2, AC-F5-1
**Test Type(s)**: Integration, Contract
**Automation Level**: Automated
**Target Layer / Location**: `tests/behaviour/retro-output.test.ts`, `tests/golden/**`
**Tags**: @backend @golden

**Preconditions**:

- Every success and failure class from §4.8, in both interactive and scripted modes; committed goldens.

**Steps**:

1. Assert exactly one envelope per run; assert the exact envelope keys and that `data` and `error` are never both present.
2. Assert the exit projection for each class: 0 for success and verified-empty; 1 for malformed, tamper, and input refusals; 2 for denied and store damage (permission case marked TODO).
3. Assert scripted mode emits one minified line with only `data` or `error` plus top-level `runId`; assert interactive mode keeps the full envelope.
4. Assert the human channel renders preserved partial output before the diagnostic on exit 1 and never prints a stack trace.
5. Run goldens for both modes and assert no case exists without a golden.
6. Run data+error, wrong-exit, and context-on-scripted-line mutants; assert all three fail.

**Expected Outcome**:

- The result contract holds for every retro outcome; partial output order and exit projection are exact.

#### TC-RETRO-064 - Registered secrets never reach evidence, findings, report or bundle

**Scenario Type**: Regression
**Impact Level**: Critical
**Priority**: High
**Related IDs**: NFR-10, AC-F5-1
**Test Type(s)**: Integration, Contract
**Automation Level**: Automated
**Target Layer / Location**: `tests/behaviour/retro-privacy.test.ts`
**Tags**: @backend @security

**Preconditions**:

- A canary secret registered in the injected secrets list and present in source fixtures (audit record arguments, note text, closeout payload) — asserted present first.
- Unregistered-value control.

**Steps**:

1. Run collect, report, and export; walk every sidecar record, every finding, the report, the bundle, diagnostics, and human text.
2. Assert the canary appears zero times in every channel.
3. Assert the unregistered control value is present, proving the scan is limited to registered secrets exactly as documented.
4. Assert one serialization path is used for records, report, and bundle.
5. Run a mutant that writes a record field before redaction; assert the canary appears and the suite fails.

**Expected Outcome**:

- Zero registered-secret survivors across all retro channels; the guarantee boundary is exactly as documented.

## 6. Environments and Test Data

### 6.1 Environments

| Environment | Requirements | Notes |
|-------------|--------------|-------|
| Local dev (delivery) | Bun pinned by `.bun-version`; pnpm pinned by `packageManager`; no network, no real state directory, no model provider | All retro suites are hermetic and in process |
| CI (`ubuntu-latest`) | Frozen-lockfile install; pinned Bun/pnpm; `pnpm build` before the test job; `fetch-depth: 0` | Authoritative for suite, boundary, invariant, and aggregate results |
| In-process test process | Bun runtime; injected clock, run-id and trace-id factories, brand, mode fact, identity record, secrets, store, and source readers | No child processes, no sockets, no host state |
| Temp fixture roots | `mkdtemp` under the OS temp directory; removed per test | Sidecar, registry, audit, derived documents, export destinations, mutation copies |
| Reference environment (non-CI) | A generated 10,000-record sidecar on the developer host | The NFR-7 reference measurement; recorded in §10, never gated |

### 6.2 Test Data and Fixtures (all synthetic)

| Fixture / artefact | Shape | Lifecycle |
|--------------------|-------|-----------|
| `tests/fixtures/retro/harness.ts` | `makeRetroDir`, `writeSidecar`, `readSidecarBytes`, `appendSidecarRecord`, `writeRegistry`, `readRegistryBytes`, `writeLevels`, `scriptAuditRead`, `scriptStateFamilies`, `scriptNotes`, `runRetro`, mutation helpers, fence hook | Read-only code; per-test instances |
| `tests/fixtures/retro/mutations.json` | The mutation registry M-01..M-06 with expected positions and identities | Read-only |
| `tests/fixtures/retro/malformed.json` | The E-01..E-04 classes and the S-01..S-05 store fixtures | Read-only |
| `tests/fixtures/retro/levels.json` | The six level declarations, the closed statuses, the level→owning-story map, and refusal probes L-01..L-14 | Read-only |
| `tests/fixtures/retro/truth.json` | The five trigger fixtures plus the verified-empty and quiet fixtures | Read-only |
| `tests/fixtures/retro/report.json` | Finding kinds, fold sources, follow-through entries (verifiable and not), and the report golden inputs | Read-only |
| `tests/fixtures/retro/key-artifact.json` | One synthetic 32-byte key, the single allowlisted key literal | Read-only |
| `tests/fixtures/retro/lane-environment.json` | The declared lane variables only; no sidecar key by construction | Read-only |
| `tests/fixtures/retro/export.json` | Records and limits for the truncation boundary | Read-only |
| `tests/fixtures/retro/identity.json` | Present, absent, blank, whitespace-only, and delivery-agent-shaped identity values | Read-only |
| `tests/golden/retro/**` | Normalized machine and human outputs for collect, report, and export in both modes | Read-only; regenerated only by an explicit command |
| Generated performance sidecar | 10,000 records with short synthetic payloads; counts only | Generated in memory or a temp root per test |

**Fixture rules.** Trace ids are `ev-` prefixed synthetic strings; workspace ids and change refs are synthetic; paths use `/synthetic/...`; windows and timestamps derive from `NOW_MS`; counts are small integers except the performance fixture; the only key material is the allowlisted synthetic key. No fixture contains a real path, credential, model prompt, or production key.

### 6.3 Determinism Contract

- Time comes only from the injected clock; ids come from fixed sequences; the brand and mode are injected. No verdict depends on `Date.now`, `Math.random`, `process.env`, `$HOME`, or a real path.
- Every iteration over records, findings, refs, and files has an asserted order; no test depends on filesystem enumeration or object key order.
- Replays compare stdout bytes; goldens are committed, normalized, and regenerated only by an explicit command.
- No sleep, timer, or scheduler is used; fence contention and mutation ordering are explicit hook calls.
- No assertion compares against a moving base branch.

### 6.4 Isolation Strategy

- Every mutation, malformed, and golden case runs on a fresh temp root or a committed read-only fixture; the live tree, `dist/`, and the user's real state directory are never written.
- The sidecar consumer has no update/delete/compact member; the only write path is the collector seam.
- The frontier between a test and the adversary model is explicit: mutations write bytes directly to the temp sidecar, then a normal read is exercised.
- Temp copies are deleted at test end; a clean-worktree check is part of the aggregate gate.

### 6.5 Entry and Exit Criteria for the Phase

**Entry (before execution)**

- The spec is accepted into the change (Proposed is acceptable per the delivery precedent), and `.ai/rules/testing-strategy.md` and `.ai/rules/typescript.md` have been read (this plan was authored against them).
- The retro contracts, sidecar consumer, key lifecycle, chain verification, collectors, truth checks, registry consumer, report/export folds, command definition, and edge composition exist.
- The three `retro` rows exist in both the machine table and the documented table.
- The two-store harness and the fixture modules above exist.
- GAP-T3, GAP-T4, and GAP-T5 are resolved or explicitly accepted with the TODO assertions intact.

**Exit (before the change is proposed)**

- All 16 ACs have passing, traceable evidence recorded in §10 with commands and HEAD, except the explicitly marked TODO assertions, each of which is either resolved or recorded as an accepted gap with PM sign-off.
- Both binding ACs are demonstrated by their full matrices with zero skips: 24/24 entry-level cases, 5/5 store-level cases, 6/6 mutation classes plus the completeness meta-check.
- Every negative, absence, refusal, and tamper assertion has its paired control and its detection-disabled mutant.
- The three error rows are 3/3 round-trip and the documented sync is green in both directions.
- `state check` reports the retro registry verdict.
- `pnpm check` is green in a clean checkout.
- `git diff --check` is clean and no gate in §7 was skipped.

## 7. Automation Plan and Implementation Mapping

All TCs are automated. No case is manual; the only non-CI activity is the NFR-7 reference measurement of TC-RETRO-061, which is recorded and never used as a pass gate. File names follow the repository's `retro-*` convention (A-T1, GAP-T1).

| TC ID | Test file / artefact | Execution command | Control / mutation | Status |
|-------|----------------------|-------------------|--------------------|--------|
| TC-RETRO-001 | `tests/structure/retro-contract.test.ts` | `bun test tests/structure/retro-contract.test.ts` | seeded function body, widened vocabulary, seventh level | To Implement |
| TC-RETRO-002 | `tests/structure/retro-imports.test.ts`; inventory; boundary suites | `bun test tests/structure tests/boundaries`; `bun run scripts/checks/{ambient-globals,workspace-entrypoints,forbidden-literals,exit-code-literals}.ts` | seeded imports, forged inventory, seeded literal | To Implement |
| TC-RETRO-003 | `scripts/checks/retro-render-purity.ts`; `tests/checks/retro-render-purity.test.ts` | `bun run scripts/checks/retro-render-purity.ts`; `bun test tests/checks/retro-render-purity.test.ts` | planted inference import, `fetch`, and `Date.now` | To Implement |
| TC-RETRO-004 | `tests/structure/error-table.test.ts`; behaviour trigger suites | `bun test tests/structure/error-table.test.ts tests/behaviour/retro-malformed.test.ts tests/behaviour/retro-chain-mutations.test.ts tests/behaviour/retro-denied.test.ts` | row removal, projection-class swap, kind-only probe | Existing – Update |
| TC-RETRO-005 | `tests/checks/error-table-sync.test.ts`; `scripts/checks/error-table-sync.ts` | `bun test tests/checks/error-table-sync.test.ts`; `bun run scripts/checks/error-table-sync.ts` | drift in both directions, empty table | Existing – Update |
| TC-RETRO-006 | `tests/structure/cli-edge-seam.test.ts`; `tests/behaviour/retro-levels.test.ts` | `bun test tests/structure/cli-edge-seam.test.ts tests/behaviour/retro-levels.test.ts` | always-on registration mutant | Existing – Update |
| TC-RETRO-007 | `tests/structure/retro-contract.test.ts`; `tests/behaviour/retro-registry.test.ts` | `bun test tests/structure/retro-contract.test.ts tests/behaviour/retro-registry.test.ts` | seventh level, free-text status, two implemented | To Implement |
| TC-RETRO-008 | `tests/behaviour/retro-sidecar-append.test.ts` | `bun test tests/behaviour/retro-sidecar-append.test.ts` | fabricated timestamp, duplicate id, added mutation member | To Implement |
| TC-RETRO-009 | same | same | rewrite-instead-of-append mutant; byte-prefix comparison | To Implement |
| TC-RETRO-010 | `tests/behaviour/retro-key-artifact.test.ts` | `bun test tests/behaviour/retro-key-artifact.test.ts` | same-file/same-bytes and silent-regeneration mutants | To Implement |
| TC-RETRO-011 | `tests/behaviour/retro-key-artifact.test.ts`; `scripts/checks/retro-key-containment.ts`; `tests/checks/retro-key-containment.test.ts` | `bun test tests/checks/retro-key-containment.test.ts`; `bun run scripts/checks/retro-key-containment.ts` | planted key in record and golden | To Implement |
| TC-RETRO-012 | `tests/behaviour/retro-chain-cross-process.test.ts` | `bun test tests/behaviour/retro-chain-cross-process.test.ts` | per-process key mutant | To Implement |
| TC-RETRO-013 | `tests/behaviour/retro-key-artifact.test.ts`; `tests/structure/error-table.test.ts` | corresponding `bun test` | valid-key control; no-new-row assertion | To Implement |
| TC-RETRO-014 | `tests/behaviour/retro-chain-salvage.test.ts` | `bun test tests/behaviour/retro-chain-salvage.test.ts` | whole deletion vs middle deletion pair | To Implement |
| TC-RETRO-015 | `tests/behaviour/retro-collect.test.ts` | `bun test tests/behaviour/retro-collect.test.ts` | newest-any-state mutant; re-collect rewrite mutant | To Implement |
| TC-RETRO-016 | same | same | write-to-source and second-read mutants | To Implement |
| TC-RETRO-017 | `tests/behaviour/retro-collect.test.ts`; `tests/behaviour/retro-truth-checks.test.ts` | corresponding `bun test` | drops-one-orphan mutant | To Implement |
| TC-RETRO-018 | `tests/behaviour/retro-collect.test.ts`; `tests/behaviour/retro-registry.test.ts` | corresponding `bun test` | rewrite-instead-of-append mutant | To Implement |
| TC-RETRO-019 | `tests/behaviour/retro-sidecar-append.test.ts` | same | link-outside-fence interleaving mutant | To Implement |
| TC-RETRO-020 | `tests/behaviour/retro-chain.test.ts` | `bun test tests/behaviour/retro-chain.test.ts` | wrong-anchor and includes-registry mutants | To Implement |
| TC-RETRO-021 | `tests/behaviour/retro-chain-mutations.test.ts` | `bun test tests/behaviour/retro-chain-mutations.test.ts` | clean control; always-false verifier mutant | To Implement |
| TC-RETRO-022 | same | same | skip-tail mutant | To Implement |
| TC-RETRO-023 | same | same | order-insensitive mutant | To Implement |
| TC-RETRO-024 | same | same | anchor-reset mutant | To Implement |
| TC-RETRO-025 | same | same | unkeyed-verifier mutant (demonstrably accepts the forgery) | To Implement |
| TC-RETRO-026 | same | same | accept-any-key mutant | To Implement |
| TC-RETRO-027 | `tests/behaviour/retro-chain.test.ts` | same | first-break-only mutant | To Implement |
| TC-RETRO-028 | `tests/behaviour/retro-chain-salvage.test.ts` | same | silent-removal mutant | To Implement |
| TC-RETRO-029 | `tests/behaviour/retro-chain-mutations.test.ts`; `tests/fixtures/retro/mutations.json` | same | registry with one class removed | To Implement |
| TC-RETRO-030 | `tests/behaviour/retro-malformed.test.ts`; `tests/fixtures/retro/malformed.json` | `bun test tests/behaviour/retro-malformed.test.ts` | crash-on-malformed mutant; clean five-record control | To Implement |
| TC-RETRO-031 | same | same | ignore-malformed and silent-zero mutants | To Implement |
| TC-RETRO-032 | same; `tests/behaviour/retro-output.test.ts` | corresponding `bun test` | drop-last-valid and data+error mutants | To Implement |
| TC-RETRO-033 | `tests/behaviour/retro-malformed.test.ts` | same | repaired-store control per case | To Implement |
| TC-RETRO-034 | same | same | crashing mutant; matrix-size floor | To Implement |
| TC-RETRO-035 | `tests/behaviour/retro-report.test.ts`; `tests/golden/retro/**` | corresponding `bun test` | extra-key, unlinked-finding, unresolved-ref mutants | To Implement |
| TC-RETRO-036 | `tests/behaviour/retro-report.test.ts` | same | invented-entry and claimed-verified mutants | To Implement |
| TC-RETRO-037 | same | same | fabricated-finding mutant; one-trigger control | To Implement |
| TC-RETRO-038 | `tests/behaviour/retro-report-determinism.test.ts` | `bun test tests/behaviour/retro-report-determinism.test.ts` | clock-reading and inference-calling mutants | To Implement |
| TC-RETRO-039 | same | same | skip-verification-on-report mutant | To Implement |
| TC-RETRO-040 | `tests/behaviour/retro-report.test.ts` | same | oldest-scope and ignores-run-record mutants | To Implement |
| TC-RETRO-041 | `tests/behaviour/retro-truth-checks.test.ts`; `tests/fixtures/retro/truth.json` | `bun test tests/behaviour/retro-truth-checks.test.ts` | drops-orphans mutant | To Implement |
| TC-RETRO-042 | same | same | clean-verdict control; ignore-broken-verdict mutant; exit TODO | To Implement (exit blocked, GAP-T5) |
| TC-RETRO-043 | same | same | fabricating-resolver mutant | To Implement |
| TC-RETRO-044 | same | same | conflating mutant; quiet and active controls | To Implement |
| TC-RETRO-045 | same | same | silent-success mutant; one-collector control; exit TODO | To Implement (exit blocked, GAP-T5) |
| TC-RETRO-046 | same | same | vacuous-silence mutant | To Implement |
| TC-RETRO-047 | `tests/checks/retro-truth-check-mutants.test.ts`; `tests/fixtures/retro/truth-mutants/**` | `bun test tests/checks/retro-truth-check-mutants.test.ts` | five disabled-check mutants | To Implement |
| TC-RETRO-048 | `tests/behaviour/retro-truth-checks.test.ts` | same | boilerplate-finding mutant | To Implement |
| TC-RETRO-049 | `tests/behaviour/retro-export.test.ts`; `tests/fixtures/retro/export.json` | `bun test tests/behaviour/retro-export.test.ts` | mutate-on-export mutant; byte-identical replay; surface TODO | To Implement (surface blocked, GAP-T4) |
| TC-RETRO-050 | same | same | unbounded-variant and default-destination mutants; refusal TODO | To Implement (surface blocked, GAP-T4) |
| TC-RETRO-051 | same | same | off-by-one truncation mutant | To Implement |
| TC-RETRO-052 | same; `tests/behaviour/retro-privacy.test.ts` | corresponding `bun test` | bypass-chokepoint mutant | To Implement |
| TC-RETRO-053 | `tests/behaviour/retro-denied.test.ts` | `bun test tests/behaviour/retro-denied.test.ts` | permits-claimed-collector mutant | To Implement |
| TC-RETRO-054 | `tests/behaviour/retro-denied.test.ts`; `retro-sidecar-append.test.ts` | corresponding `bun test` | trims-value and infers-identity mutants | To Implement |
| TC-RETRO-055 | `tests/behaviour/retro-registry.test.ts` | `bun test tests/behaviour/retro-registry.test.ts` | zero-defaulting mutant | To Implement |
| TC-RETRO-056 | `tests/behaviour/doctor-state.test.ts` (update) | `bun test tests/behaviour/doctor-state.test.ts` | omits-retro-store mutant | Existing – Update |
| TC-RETRO-057 | `tests/behaviour/retro-registry.test.ts`; `tests/structure/retro-contract.test.ts` | corresponding `bun test` | missing-field and widened-field mutants | To Implement |
| TC-RETRO-058 | `tests/behaviour/retro-levels.test.ts`; `tests/fixtures/retro/levels.json` | `bun test tests/behaviour/retro-levels.test.ts` | empty-hint mutant; change control | To Implement |
| TC-RETRO-059 | same | same | hidden-`--ref` and ignored-positional mutants | To Implement |
| TC-RETRO-060 | `tests/behaviour/retro-memory-audit.test.ts` | `bun test tests/behaviour/retro-memory-audit.test.ts` | missing-trigger and new-command mutants | To Implement |
| TC-RETRO-061 | `tests/behaviour/retro-performance.test.ts` | `bun test tests/behaviour/retro-performance.test.ts` + recorded reference | per-record-extra-read mutant | To Implement |
| TC-RETRO-062 | `tests/behaviour/retro-hermetic.test.ts`; `tests/structure/retro-imports.test.ts` | corresponding `bun test` | planted spawn, home-shaped path, second key literal | To Implement |
| TC-RETRO-063 | `tests/behaviour/retro-output.test.ts`; `tests/golden/retro/**` | corresponding `bun test` | data+error, wrong-exit, context-on-scripted-line mutants | To Implement |
| TC-RETRO-064 | `tests/behaviour/retro-privacy.test.ts` | `bun test tests/behaviour/retro-privacy.test.ts` | pre-redaction-write mutant | To Implement |

### 7.1 Execution Order

1. Contract, boundaries, render purity, error identities, sync, registration, level declaration: TC-RETRO-001..007.
2. Sidecar append, key lifecycle, containment, cross-process, key-open failures: TC-RETRO-008..014.
3. Collection and run records: TC-RETRO-015..019.
4. Chain verification and the mutation matrix: TC-RETRO-020..029.
5. Malformed matrix: TC-RETRO-030..034.
6. Report and determinism: TC-RETRO-035..040.
7. Pipeline truth: TC-RETRO-041..048.
8. Export, denied writes, identity, registry, doctor, levels, memory audit: TC-RETRO-049..060.
9. Performance, hermeticity, output, privacy, aggregate: TC-RETRO-061..064, `pnpm check`.

### 7.2 CI Mapping

No new CI job is introduced. The existing jobs carry the new suites.

| Suite / check | Discovered by | CI job(s) |
|---------------|---------------|-----------|
| `tests/structure/retro-contract.test.ts`, `retro-imports.test.ts`, `error-table.test.ts`, `cli-edge-seam.test.ts` | `bun test` (whole tree) | `ts-test`; static scans also run in `ts-boundaries` and `ts-invariants` |
| `tests/behaviour/retro-*.test.ts` (all behaviour suites) | `bun test` | `ts-test` |
| `tests/checks/error-table-sync.test.ts`, `retro-render-purity.test.ts`, `retro-key-containment.test.ts`, `retro-truth-check-mutants.test.ts` | `bun test` | `ts-test` |
| `scripts/checks/error-table-sync.ts`, `retro-render-purity.ts`, `retro-key-containment.ts`, `forbidden-literals.ts`, `exit-code-literals.ts`, `workspace-entrypoints.ts` | direct invocation | `ts-invariants` and `ts-boundaries` |
| `tests/behaviour/doctor-state.test.ts` | `bun test` | `ts-test` |
| Full gate | `pnpm check` | `ts-aggregate` and the individual `ts-*` jobs |

### 7.3 Evidence Commands

```bash
bun test tests/structure/retro-contract.test.ts tests/structure/retro-imports.test.ts tests/structure/error-table.test.ts
bun test tests/checks/error-table-sync.test.ts tests/checks/retro-render-purity.test.ts tests/checks/retro-key-containment.test.ts tests/checks/retro-truth-check-mutants.test.ts
bun test tests/behaviour/retro-sidecar-append.test.ts tests/behaviour/retro-key-artifact.test.ts tests/behaviour/retro-chain.test.ts tests/behaviour/retro-chain-mutations.test.ts
bun test tests/behaviour/retro-chain-cross-process.test.ts tests/behaviour/retro-chain-salvage.test.ts tests/behaviour/retro-malformed.test.ts
bun test tests/behaviour/retro-collect.test.ts tests/behaviour/retro-report.test.ts tests/behaviour/retro-report-determinism.test.ts tests/behaviour/retro-truth-checks.test.ts
bun test tests/behaviour/retro-export.test.ts tests/behaviour/retro-denied.test.ts tests/behaviour/retro-registry.test.ts tests/behaviour/doctor-state.test.ts
bun test tests/behaviour/retro-levels.test.ts tests/behaviour/retro-memory-audit.test.ts tests/behaviour/retro-performance.test.ts
bun test tests/behaviour/retro-hermetic.test.ts tests/behaviour/retro-output.test.ts tests/behaviour/retro-privacy.test.ts
bun run scripts/checks/error-table-sync.ts
bun run scripts/checks/retro-render-purity.ts
bun run scripts/checks/retro-key-containment.ts
pnpm check
git diff --check
```

## 8. Risks, Assumptions, and Open Questions

### 8.1 Risks

| ID | Risk | Impact | Mitigation in this plan |
|----|------|--------|--------------------------|
| TR-1 | A tamper case passes vacuously because the verifier returns `false` for every input | H | Every mutation row is paired with a clean control asserting `verified: true`; a mutant that always returns false fails the suite (TC-RETRO-021..027) |
| TR-2 | The malformed suite asserts counts and misses byte-level data loss | H | Byte-equality of preserved output against the clean run is the oracle, not counts (TC-RETRO-032) |
| TR-3 | A truth check is dead code that never fires | H | Five triggerable negative fixtures plus a check-removal mutation suite (TC-RETRO-041..047) |
| TR-4 | The key-separation guarantee is silently weakened by reusing the audit construction | H | The recomputed-unkeyed-checksum case plus an unkeyed-verifier mutant that must accept the forged bytes (TC-RETRO-025) |
| TR-5 | Spec-pinned exits cannot be produced by the delivered taxonomy and the tests assert a fiction | H | GAP-T3/T4/T5 are marked TODO with identities asserted and exits recorded as blocked; no test asserts an impossible value |
| TR-6 | Fixtures leak real key material or real paths into the committed tree | M | The containment and hermeticity checks with planted controls (TC-RETRO-011, TC-RETRO-062) |
| TR-7 | NFR-7 thresholds are unstable in CI and become flaky | M | Bounded-work oracle plus a recorded non-CI reference (TC-RETRO-061, GAP-T2) |
| TR-8 | The export surface is implemented as a hidden flag or an unbounded dump to make the AC pass | H | GAP-T4 blocks the assertion; TC-RETRO-050 additionally asserts no implicit destination and no unbounded variant |

### 8.2 Assumptions

- A-T1: All cases run in process with injected dependencies and a temp root; no suite spawns, uses the network, or touches host/user state. Cross-process continuity is modelled by a second store/edge instance over the same temp directory.
- A-T2: Exact sidecar artifact family names, key-artifact filename, registry record kinds, payload schema ids, and store keys are delivery-bound (spec OQ-2). Tests assert the declared contract constants and the distinctness requirement; the plan's readable name `chain-key.retro.<workspace>.json` is not itself an assertion.
- A-T3: `change`-level target ordering is completion timestamp descending, then change ref ascending. This is a determinism pin, not a spec requirement; delivery must declare it as a contract constant and the test must read it.
- A-T4: The report `data` key set is exactly `level`, `findings`, `followThrough`, `evidenceRefs`; the report schema identity is a declared constant used by tests, goldens, and docs, not an in-`data` field (GAP-T7).
- A-T5: The retro registry is a validated store boundary in the state layer with two record kinds (level and run) and the four-verdict matrix; the exact kind/schema strings are delivery-bound but the boundary properties are not.
- A-T6: A declared level→owning-story map covers the five declared-only levels; tests assert completeness and hint shape, not invented story ids.
- A-T7: The synthetic 32-byte key in `tests/fixtures/retro/key-artifact.json` is the single allowlisted key literal and is not production material.
- A-T8: The chain anchor, canonical content ordering, and link field are declared in contracts; tests read the constants rather than restating them.

### 8.3 Open Questions and Recorded Gaps

| ID | Question / gap | Blocking? | Owner | Resolution in this plan |
|----|----------------|-----------|-------|--------------------------|
| OQ-T1 | AC-F4-2 and DEC-7 require permission violations to classify as unreachable at exit 2, but the delivered `state.permission.denied` row is `category: user`, `projectionClass: user-validation` (exit 1), and NG-10/§8.5 forbid changing existing rows or the exit taxonomy. Which wins? | **Yes** — TC-RETRO-013 and TC-RETRO-033 cannot assert a truthful exit | PM + spec-writer | Identity asserted; exit marked TODO; GAP-T3 |
| OQ-T2 | AC-F7-1 requires an export surface with an explicit destination and a required limit, including refusal cases, but the locked command surface has no export subcommand or flag and §8.5 forbids new ones. What is the invoking surface, and what identity/exit does a refusal use? | **Yes** — the AC's command-level half is untestable as written | PM + spec-writer | Engine contract covered; surface and refusal projection marked TODO; GAP-T4 |
| OQ-T3 | AC-F6-1 says the zero-collector and broken-audit-verdict triggers "block a clean exit with the classified evidence", but no identity or exit is declared for either. Which identity, and does a finding alone block exit 0? | **Yes** — the exit assertion for TC-RETRO-042 and TC-RETRO-045 is unpinned | PM + spec-writer | Findings and non-clean verdict asserted; identity/exit marked TODO; GAP-T5 |
| OQ-T4 | DEC-11 pins two exit-1 rows as `category: platform`; the projection map admits exit 1 only through `user-validation`. Confirm that a platform-category row may carry the `user-validation` projection class. | No (satisfiable) | @readiness-reviewer / plan-writer | Pinned in TC-RETRO-004/005; GAP-T6 |
| OQ-T5 | AC-F5-1 says "exactly the versioned" four-field shape while DM-6 calls it a versioned shape. Is an in-`data` version marker required? | No | PM + plan-writer | A-T4 resolves to the exact four keys plus a contract constant; GAP-T7 |
| OQ-T6 | `change`-level target ordering is not pinned. Is completion timestamp descending with a ref-ascending tiebreak acceptable? | No | plan-writer | A-T3 pins it; TC-RETRO-015 asserts determinism |
| OQ-T7 | The level→owning-story map for declared-only levels is not in the spec. Who owns each level's implementation? | No | plan-writer | A-T6 requires a declared map; TC-RETRO-058 asserts completeness |
| OQ-T8 | NFR-7 wall-clock thresholds cannot be gated reliably in CI. Is bounded work plus a recorded reference acceptable? | No | PM | GAP-T2; TC-RETRO-061 |

## 9. Plan Revision Log

| Version | Date | Author | Changes |
|---------|------|--------|---------|
| 1.0 | 2026-11-06 | @test-plan-writer | Initial test plan: 64 TCs covering 16 ACs, both binding ticket ACs by dedicated matrices, EVT-1/EVT-2, DM-1..DM-8, NFR-1..NFR-10, the tamper mutation matrix, the shape-crash-guard matrix, the level-refusal and truth-trigger matrices, the exit/identity oracle, and three blocking gaps (GAP-T3/T4/T5) recorded rather than faked |

## 10. Test Execution Log

| TC ID / gate | Run date | Result | Notes |
|--------------|----------|--------|-------|
| TC-RETRO-001..007 | — | Not run | Awaiting delivery |
| TC-RETRO-008..019 | — | Not run | Awaiting delivery |
| TC-RETRO-020..029 (binding AC 2) | — | Not run | Mutation matrix must be 6/6 plus the completeness meta-check |
| TC-RETRO-030..034 (binding AC 1) | — | Not run | 24/24 entry-level and 5/5 store-level; permission exit TODO |
| TC-RETRO-035..048 | — | Not run | Report and pipeline truth |
| TC-RETRO-049..052 | — | Not run | Engine contract only; surface TODO (GAP-T4) |
| TC-RETRO-053..064 | — | Not run | Surfaces, registry, doctor, performance, hermeticity, output, privacy |
| NFR-7 reference measurement | — | Not run | Non-CI; record sidecar size, host, command and timings; never a pass gate |
| `pnpm check` | — | Not run | Aggregate gate |
| `git diff --check` | — | Not run | Whitespace/conflict-marker guard |


