---
id: chg-GH-381-test-plan
status: Proposed
version: 1.0
created: 2026-11-22
last_updated: 2026-11-22
owners: ["Juliusz Ćwiąkalski"]
service: "state-layer telemetry families projection and the spend read side (core read path)"
labels: [change, planning, defect, state, telemetry, spend, m4]
version_impact: patch
summary: "Pin the GH-381 correction as classifications a test runs: the per-ref telemetry families read skips well-formed foreign family keys of another change ref — never classifying them as damage, with no kind or payload inspection (DEC-2's jurisdiction boundary, proven by a foreign record carrying a deliberately wrong kind and garbage payload) — while the bare family prefix (empty ref remainder) tears `state.store.torn` at its own record's position for BOTH the step and baseline families, requested-ref kind mismatches and payload failures tear exactly as delivered at the delivered safe location (store path + 1-based ledger sequence), the named regression case reproduces the observed record-3786 shape (foreign step record FIRST in a two-ref interleaved fixture — a one-ref fixture cannot catch this class) with the spend fold returning a scoped report over the same ledger, `provider resolve` proceeds to a provider decision and the metrics report reads a two-ref ledger with exactly the requested ref's dispatch, the read stays ONE verified pass over the store (zero new reads, zero harness queries, each foreign record visited once, ledger bytes untouched at the observed ≥4,800-record scale), and single-ref behavior is golden-equal to delivered including verified-empty; all fixtures are committed hermetic state over reproduced ledger shapes, never the live incident ledger, with zero network, zero ambient store, zero real clock."
links:
  change_spec: ./chg-GH-381-spec.md
  implementation_plan: ./chg-GH-381-plan.yaml   # phase-4 artifact; not present when this plan was written
  testing_strategy: ../../../../.ai/rules/testing-strategy.md
---

# Test Plan - M4-S20: Spend reads must be multi-ref safe — one change's telemetry must never tear another's (M4)

## 1. Scope and Objectives

The defect is a classification error, not a missing capability: the per-ref telemetry families read — the one projection `spend`, the metrics report, and provider resolution's budget measurement all compose — treats any telemetry-family key that is not the requested ref's exact key as `state.store.torn`, so the second ticket in any project bricks the spend surface on a ledger the verifier returns `verified` on. The observed incident (spec Appendix A) stopped on record 3786, a valid step record of the earlier change, appearing **before** the requested ref's records. This plan therefore proves the correction as the exhaustive classification table of spec §5.1 (F-2): a well-formed foreign family key is skipped — silently, with no kind or payload inspection; the bare family prefix tears at its own position; the requested ref's own damage tears exactly as delivered — plus the properties a naive fix would trade away: the single verified pass (no new reads), exact per-ref scoping (no foreign record in, no requested record dropped), tear-location fidelity, and byte-identical single-ref behavior.

The highest-risk failure modes are silent, so each gets an adversarial arm rather than a prose claim: an over-broad skip that masks genuine damage (`TC-TELEMETRY-042`, `TC-TELEMETRY-043`), an under-broad skip that reintroduces the defect on a variant shape (`TC-TELEMETRY-041`, foreign family record first), a foreign record that "looks damaged" and tempts a global validation into a per-ref projection (`TC-TELEMETRY-044`, the DEC-2 jurisdiction boundary), a hidden second read or harness query (`TC-TELEMETRY-045`), and requested-ref drift as a side effect of editing the branches (`TC-TELEMETRY-046`). Because a one-ref fixture structurally cannot catch this defect class, every multi-ref case interleaves two refs' families — step, baseline, and the capture families — and the named regression case places the foreign family record first, the exact observed shape.

This is a verification map, not an execution claim: nothing here was run against a new implementation at authoring time, and phase ownership belongs to `chg-GH-381-plan.yaml`, authored in phase 4 after this plan. All 8 acceptance criteria (AC-F1-1 … AC-NFR2-1) — and through spec Appendix B, ticket AC-1 … AC-5 and required behavior 5 — are covered by at least one named case; there are no TODO rows, no orphan cases and no open questions. The plan is deliberately proportionate: one new behaviour suite named for this defect, two extensions of delivered consumer suites, reuse of the committed hermetic telemetry fixture helpers, and no new framework and no new suite family beyond the one regression home.

### 1.1 In Scope

- The step-family and baseline-family classification matrix (spec §5.1 F-2 table, restated in Appendix C): foreign skip, malformed bare-prefix tear, unchanged requested-ref tear — symmetrically for both families.
- Tear-location fidelity for every preserved tear case: the delivered safe location (store path + offending record's 1-based ledger sequence).
- The interleaved two-ref proof fixtures in both read directions, the named foreign-first regression case, and the consumer success proofs on multi-ref ledgers: spend fold scoped reports, the metrics report read, and `provider resolve` proceeding to a provider decision.
- The single-pass read bound (zero additional store reads, zero harness queries, observed ledger scale) and the single-ref golden equality, both proven.
- Determinism and hermeticity of the whole proof matrix over committed fixture state.

### 1.2 Out of Scope & Known Gaps

- Ledger mutation of any kind, repair, migration, back-fill: not tested because not to exist — asserted absent (`TC-TELEMETRY-045` byte-equality), never exercised.
- The capture-outcome branch, the session-record branch, and the whole telemetry capture path: delivered ref-scoped, unchanged (spec DEC-3); covered only by their existing suites, with no new cases here beyond their role as fixture families.
- Consumer report shapes and semantics (spend envelope keys, metrics blocks, digest section 8, provider envelopes, tolerances, exit projections): unchanged per NG-4; existing consumer suites remain authoritative, this plan adds only the multi-ref success proofs.
- Other ledger projections (economics, phase history, command audit, change registry) and the global ledger verifier: unchanged per NG-6; the economics read is cited as precedent, not re-tested.
- A family-aware cross-ref consistency lint and the append-time family-key lint: deferred (spec §7.3); the tear behavior delivered here is the reader's safety net either way.
- Spend reconciliation (#378): separate work item; this change is its prerequisite.
- Documentation reconciliation of the reading bases: phase-7 obligation (spec §22); no doc assertions in this plan. The new suite's row in `feature-telemetry-v2.md` §7 lands with that reconciliation, since documentation edits are out of scope for this change (NG-8).

## 2. References

- Change specification: `./chg-GH-381-spec.md` — §5.1 capability details (the F-2 table is the normative rule), §17 acceptance criteria, Appendix A observed evidence, Appendix B ticket traceability, Appendix C normative classification restatement.
- PM notes: `./chg-GH-381-pm-notes.yaml` — clarify_scope findings, the binding owner-comment constraints (fixture interleaving with foreign family first; bare prefix tears at correct position; kind mismatch still tears; one verified pass; hermetic committed fixtures; gate evidence scratch-directory override), and the phase-7 documentation impacts.
- Testing strategy: `.ai/rules/testing-strategy.md` — bun:test under `tests/**/*.test.ts`, hermetic fixture conventions, permanent-suite invariant rules (no branch-diff assertions; goldens updated deliberately by explicit command; assert meaning, not growing counts), aggregate gate `pnpm check`.
- Feature specifications: `doc/spec/features/feature-telemetry-v2.md` (§4 storage, §5/§5.1 reading bases, §7 suite map), `feature-spend.md` (fold and read-side contract), `feature-metrics.md` (dispatch block, burn-rate evaluation), `feature-state-layer.md` (torn taxonomy), `feature-status-digest.md` (section 8 fed by the same fold).
- Delivered suites this plan builds on: `tests/behaviour/telemetry-storage-damage.test.ts` (TC-TELEMETRY-012 — the delivered torn-identity and location conventions, `expectTorn` pattern), `tests/behaviour/telemetry-storage-coexistence.test.ts` (both storage planes coexisting), `tests/behaviour/spend-v2-fold-basis.test.ts` (fold basis), `tests/behaviour/spend-store-damage.test.ts` and `tests/behaviour/metrics-store-damage.test.ts` (consumer tear identities), `tests/behaviour/provider-budget-ref.test.ts` (TC-REF-005 — provider engine composed over a seeded two-ref store), `tests/behaviour/status-spend-section.test.ts` (digest section 8), `tests/checks/telemetry-hermetic.test.ts` (offline posture).
- Ticket: juliusz-cwiakalski/agentic-delivery-os issue #381, including the binding owner implementation-pointer comment.

## 3. Coverage Overview

Every AC maps to at least one named case; no AC is TODO. Case IDs continue the delivered per-suite series: `TC-TELEMETRY` stands at 039, `TC-REF` at 005, `TC-METRICS` at 112 as of authoring.

### 3.1 Functional Coverage (F-#, AC-#)

| AC ID | Criterion (compressed) | TC ID(s) | Status |
|-------|------------------------|----------|--------|
| AC-F1-1 | Interleaved two-ref ledger: read for A returns exactly A's records, read for B exactly B's, neither tears, evidence discloses the shared ledger | TC-TELEMETRY-040, TC-TELEMETRY-044 | Covered |
| AC-F2-1 | Bare step prefix and bare baseline prefix tear `state.store.torn` at their own position; skipped-malformed or dropped-location fails the proof | TC-TELEMETRY-042 | Covered |
| AC-F3-1 | Requested-ref kind mismatch (step and baseline) tears as delivered; payload validation unchanged | TC-TELEMETRY-043 | Covered |
| AC-F4-1 | Named regression case: foreign step record first (observed shape), read succeeds; spend fold over the same ledger returns the scoped report | TC-TELEMETRY-041 | Covered |
| AC-F4-2 | Provider resolution on a two-ref ledger: budget measurement succeeds, resolution proceeds to a provider decision, no telemetry tear on any path | TC-REF-006 | Covered |
| AC-F5-1 | Exactly one verified pass; 0 additional store reads / re-reads / harness queries; bound unchanged with foreign records interleaved throughout | TC-TELEMETRY-045 | Covered |
| AC-F6-1 | Single-ref ledger: records, ordering, verified-empty, evidence, all tear cases golden-equal to delivered; verified-empty identical | TC-TELEMETRY-046 | Covered |
| AC-NFR2-1 | Three-run determinism with zero network / ambient-store / real-clock; delivered vocabulary sets exactly equal, 0 additions | TC-TELEMETRY-047 (+ delivered structure suites for the vocabulary clause) | Covered |

Functional capability roll-up:

| F-# | Capability | TC ID(s) |
|-----|------------|----------|
| F-1 | Foreign well-formed family keys skipped, never damage | TC-TELEMETRY-040, TC-TELEMETRY-041, TC-TELEMETRY-044 |
| F-2 | Well-formed/malformed distinction; malformed still tears | TC-TELEMETRY-042, TC-TELEMETRY-044, TC-TELEMETRY-040 |
| F-3 | Requested-ref damage preserved (kind, payload, location) | TC-TELEMETRY-043, TC-TELEMETRY-046 |
| F-4 | Multi-ref consumer success, exactly scoped | TC-TELEMETRY-040, TC-TELEMETRY-041, TC-REF-006, TC-METRICS-113 |
| F-5 | One verified pass preserved | TC-TELEMETRY-045 |
| F-6 | Single-ref behavior identical | TC-TELEMETRY-046 |

Ticket acceptance-criteria traceability (via spec Appendix B):

| Ticket AC | Spec criterion | TC ID(s) |
|-----------|----------------|----------|
| Ticket AC-1 (interleaved A and B, neither tears) | AC-F1-1 | TC-TELEMETRY-040, TC-TELEMETRY-044 |
| Ticket AC-2 (bare prefix still tears, correct position) | AC-F2-1 | TC-TELEMETRY-042 |
| Ticket AC-3 (requested-ref kind mismatch still tears) | AC-F3-1 | TC-TELEMETRY-043 |
| Ticket AC-4 (named regression case, foreign family first) | AC-F4-1 | TC-TELEMETRY-041 |
| Ticket AC-5 (provider resolve proceeds to a provider decision) | AC-F4-2 | TC-REF-006 |
| Required behavior 5 (single verified pass) + single-ref invariant | AC-F5-1, AC-F6-1, AC-NFR2-1 | TC-TELEMETRY-045, TC-TELEMETRY-046, TC-TELEMETRY-047 |

### 3.2 Interface Coverage (API-#, EVT-#, DM-#)

No HTTP endpoints and no events exist on any path before or after this change (spec §8.1, §8.2) — nothing to cover there, by absence. The data-model elements:

| DM-# | Element | TC ID(s) / note |
|------|---------|-----------------|
| DM-1 | Family key grammar: `<family prefix><ref remainder>`; empty remainder malformed; foreign remainder skipped | TC-TELEMETRY-042 (empty remainder), TC-TELEMETRY-040/044 (foreign remainder), TC-TELEMETRY-043 (requested remainder) — the F-2 table exercised cell by cell |
| DM-2 | Per-ref projection result: four record collections, verified-empty flag, evidence pair (store path, total record count) | TC-TELEMETRY-040 (exactness + shared evidence), TC-TELEMETRY-041 (scoped contents), TC-TELEMETRY-046 (golden equality incl. verified-empty) |
| DM-3 | Damage taxonomy unchanged: `state.store.torn` keeps its delivered subjects; no identity added or re-semanted | TC-TELEMETRY-042, TC-TELEMETRY-043 (identity equality) + delivered `tests/structure/error-table.test.ts` and envelope/exit-code contract suites (Existing – No Change) |
| DM-4 | Ledger records unchanged: no write, mutation, reorder on any path | TC-TELEMETRY-045 (ledger byte-equality across the read), TC-TELEMETRY-047 (repeat-run equality) |

### 3.3 Non-Functional Coverage (NFR-#)

| NFR-# | Requirement | TC ID(s) / note |
|-------|-------------|-----------------|
| NFR-1 | Single-pass read cost at observed scale (≥4,800 records) | TC-TELEMETRY-045 (instrumented one-pass proof; structural, not wall-clock) |
| NFR-2 | Determinism and hermeticity | TC-TELEMETRY-047 (three-run matrix equality, offline posture) |
| NFR-3 | Tear fidelity: store path + 1-based sequence, 0 drift across malformed / kind / payload cases | TC-TELEMETRY-042, TC-TELEMETRY-043 (explicit location assertions) |
| NFR-4 | Closed-vocabulary invariance: 0 additions to any delivered set | Covered by delivered structure suites (error table, telemetry contract constants, envelope and exit-code contracts) — Existing – No Change; this plan additionally asserts the change's paths emit only delivered identities (TC-TELEMETRY-042/043). AC-NFR2-1's vocabulary clause rests on these. |
| NFR-5 | Projection exactness: 0 foreign in, 0 requested dropped; verified-empty iff ref holds nothing; both directions | TC-TELEMETRY-040, TC-TELEMETRY-041, TC-TELEMETRY-044, TC-REF-006 |
| NFR-6 | Single-ref golden equality | TC-TELEMETRY-046 |

## 4. Test Types and Layers

- **Behaviour tests (primary):** `bun:test`, `tests/behaviour/*.test.ts`. The classification matrix, tear cases, single-pass bound, golden equality, and both consumer proofs live here, per the testing strategy's module-to-test mapping (`packages/**` → `bun test tests/structure tests/behaviour`).
- **Structure/contract tests (guarding, no new cases):** `tests/structure/*.test.ts` — the delivered error-table, telemetry-contract, envelope, and exit-code suites pin the closed vocabulary (NFR-4) and fail if any identity, prefix, envelope key, or exit code is added.
- **Golden comparison:** the single-ref equality case uses a committed golden of delivered results, regenerated by an explicit command and updated deliberately in review — never a blanket rewrite, per the testing strategy's permanent-suite rules.
- **Static/diff checks (always):** `git diff --check`; naming and placement review against `tests/behaviour` conventions.
- **Aggregate gate:** `pnpm check` (lint → format:check → typecheck → test → boundaries) is the pre-review proof battery (spec §18); narrow suites are used while iterating. Gate evidence uses the declared scratch-directory override (`TMPDIR=$PWD/tmp/tmpdir`).
- **Performance:** no new performance harness. The read bound is proven structurally — instrumented call counts on the store port — not by wall-clock timing; the scale clause runs at the observed ledger size.

## 5. Test Scenarios

### 5.1 Scenario Index

| TC ID | Title | Type | Level | Priority | AC Coverage |
|-------|-------|------|-------|----------|-------------|
| TC-TELEMETRY-040 | Interleaved two-ref ledger reads cleanly and exactly scoped, both directions | Happy Path | suite | High | AC-F1-1 |
| TC-TELEMETRY-041 | Named regression: foreign family record first (the observed record-3786 shape) | Regression | suite | High | AC-F4-1 |
| TC-TELEMETRY-042 | Bare family prefixes tear at their own position, both families | Negative | suite | High | AC-F2-1 |
| TC-TELEMETRY-043 | Requested-ref damage preserved: kind mismatch and payload validation unchanged | Negative | suite | High | AC-F3-1 |
| TC-TELEMETRY-044 | Foreign records skipped without kind or payload inspection (jurisdiction boundary) | Edge Case | suite | High | AC-F1-1 |
| TC-TELEMETRY-045 | The read stays one verified pass at observed ledger scale | Corner Case | suite | High | AC-F5-1 |
| TC-TELEMETRY-046 | Single-ref golden equality with delivered behavior | Regression | suite | High | AC-F6-1 |
| TC-TELEMETRY-047 | Determinism and hermeticity of the proof matrix | Corner Case | suite | Medium | AC-NFR2-1 |
| TC-REF-006 | Provider resolution proceeds to a provider decision on a two-ref ledger | Happy Path | suite | High | AC-F4-2 |
| TC-METRICS-113 | Metrics report reads a two-ref ledger with exactly the requested ref's dispatch | Happy Path | suite | Medium | AC-F1-1 (consumer clause; F-4) |

### 5.2 Scenario Details

#### TC-TELEMETRY-040 - Interleaved two-ref ledger reads cleanly and exactly scoped, both directions

**Scenario Type**: Happy Path
**Impact Level**: Critical
**Priority**: High
**Related IDs**: F-1, F-4, AC-F1-1, DM-2, NFR-5
**Test Type(s)**: Integration
**Automation Level**: Automated
**Target Layer / Location**: `tests/behaviour/telemetry-foreign-ref-skip.test.ts` (new suite), fixture helpers from `tests/fixtures/telemetry` and `tests/fixtures/state/harness`
**Tags**: @backend, @state

**Preconditions**:

- The committed interleaved fixture (FX-1) is built in a per-test temp root through the delivered append path: two change refs A and B, each holding at least two step records, one baseline record, and one record of each capture family (the delivered v1 session record and one capture-outcome record), interleaved in ledger order.
- FX-1 exists in both directions — A's records first and B's records first — because "both read directions of every interleaved fixture" is the exactness clause (NFR-5).
- The ledger is verifier-clean: contiguous sequences, every checksum recomputes.

**Steps**:

1. Build FX-1 with ref A's records leading.
2. Run the telemetry families read for A.
3. Run the telemetry families read for B.
4. Assert each read's four record collections contain exactly the requested ref's records — compare against the seeded record identities, not just counts.
5. Assert neither read produces `state.store.torn` or any other classification, and the evidence pair (store path, total ledger record count) is the same shared ledger for both reads.
6. Rebuild FX-1 with B leading and repeat steps 2–5 (the reversed direction).
7. On the same ledger, run the read for a third ref C that holds no records at all.

**Expected Outcome**:

- Each read for A and B succeeds and returns exactly the requested ref's records: zero foreign records in any returned collection, zero requested-ref records dropped.
- No read produces `state.store.torn` or any other damage classification; the foreign family keys contribute nothing — no record, no evidence, no count.
- `verifiedEmpty` is false for A and B and true for C; the C read succeeds rather than tearing on the foreign records, which is the verified-empty iff-clause (NFR-5).
- All reads disclose the same store path and the same total ledger record count — one shared ledger, one ref's slice each.

**Postconditions**:

- Temp root removed; ledger bytes unchanged (asserted here and structurally in TC-TELEMETRY-045).

**Notes / Clarifications**:

- Binding constraint 1 applies: the fixture interleaves two refs; a one-ref fixture cannot catch this defect class.

#### TC-TELEMETRY-041 - Named regression: foreign family record first (the observed record-3786 shape)

**Scenario Type**: Regression
**Impact Level**: Critical
**Priority**: High
**Related IDs**: F-1, F-4, F-5, AC-F4-1, DM-2, NFR-5
**Test Type(s)**: Integration
**Automation Level**: Automated
**Target Layer / Location**: `tests/behaviour/telemetry-foreign-ref-skip.test.ts` (new suite) — this case is the one named for the defect
**Tags**: @backend, @state, @spend

**Preconditions**:

- The committed regression fixture (FX-2): a two-ref ledger whose **first telemetry-family record is a foreign step record** of the other ref — a valid, verifier-clean step record of an earlier change, appearing before the requested ref's first record — followed by the requested ref's interleaved families. This is the exact observed shape of spec Appendix A (record 3786, the first of an earlier change's 563 steps, tearing a read of the later ref), reproduced at fixture scale from committed state, never from the live incident ledger.
- The spend fold composition is importable at the delivered seam (the same one `spend`, the digest section, and the budget measurement use).

**Steps**:

1. Build FX-2 with the foreign step record first.
2. Run the telemetry families read for the requested ref.
3. Run the spend fold over the same ledger for the same ref.
4. Assert the fold's steps match exactly the read's requested-ref steps (the fold consumes the same projection).

**Expected Outcome**:

- The read succeeds: the leading foreign record is classified foreign by the F-2 table and skipped — no classification, no evidence contribution — and the scan continues in ledger order to the requested ref's records.
- The read result contains exactly the requested ref's records; zero foreign records in, zero requested records dropped.
- The spend fold returns its scoped report — not `state.store.torn` — containing exactly that ref's steps; the fold figure derives solely from the requested ref's records.

**Postconditions**:

- Temp root removed; ledger bytes unchanged.

**Notes / Clarifications**:

- Pre-fix, this exact fixture tears on the first foreign record; the case doubles as the defect reproducer cited in support conversations (spec §10 operator-reproduction clause).
- The 563-step scale of the incident belongs to the observed-scale proof (TC-TELEMETRY-045); this case pins the shape, not the volume.

#### TC-TELEMETRY-042 - Bare family prefixes tear at their own position, both families

**Scenario Type**: Negative
**Impact Level**: Critical
**Priority**: High
**Related IDs**: F-2, F-3, AC-F2-1, DM-1, DM-3, NFR-3
**Test Type(s)**: Integration
**Automation Level**: Automated
**Target Layer / Location**: `tests/behaviour/telemetry-foreign-ref-skip.test.ts` (new suite); follows the `expectTorn` conventions of delivered TC-TELEMETRY-012
**Tags**: @backend, @state

**Preconditions**:

- Fixture FX-3 carries a ledger record whose key is the **bare family prefix with an empty ref remainder** (e.g. `harness.telemetry.step:` naming no ref), carrying the family's own record kind — the realistic writer-bug shape — at a known, deterministic ledger sequence.
- The record's framing and checksum are valid, so the verified read parses it and the tear provably originates in the projection's classification, not in framing damage.
- A symmetric variant carries a bare baseline-prefix record. The malformed shape is committed via the raw append path (within a write fence), the delivered way to seed shapes production writers never emit.

**Steps**:

1. Build FX-3 with the bare step-prefix record at a known sequence.
2. Run the families read for a requested ref that is present in the fixture.
3. Assert the read fails with `state.store.torn`, located at the disclosed store path and exactly that record's 1-based ledger sequence.
4. Repeat with the bare baseline-prefix record (its own sequence).
5. Repeat both reads for a ref absent from the fixture (the AC's "for any ref" clause).

**Expected Outcome**:

- Each read returns `state.store.torn` — never a skip, never another identity — at the offending record's own position: store path plus that record's 1-based ledger sequence, zero location drift across the step and baseline cases.
- The absent-ref reads tear identically: a malformed family key is invalid regardless of which ref is being answered.
- The proof fails by construction if a future edit marks the malformed record skipped or drops its location — both properties are asserted exactly.

**Postconditions**:

- Temp root removed.

**Notes / Clarifications**:

- Binding constraint 3: the bare prefix must still tear `state.store.torn` for BOTH the step and baseline families; damage reporting is unchanged in identity and fidelity (G-2).

#### TC-TELEMETRY-043 - Requested-ref damage preserved: kind mismatch and payload validation unchanged

**Scenario Type**: Negative
**Impact Level**: Critical
**Priority**: High
**Related IDs**: F-3, AC-F3-1, DM-3, NFR-3
**Test Type(s)**: Integration
**Automation Level**: Automated
**Target Layer / Location**: `tests/behaviour/telemetry-foreign-ref-skip.test.ts` (new suite), mirroring the damaged-seed techniques of delivered TC-TELEMETRY-012
**Tags**: @backend, @state

**Preconditions**:

- Fixture FX-4 arms, all under the requested ref's own keys: (a) the step key carrying a record kind other than the step kind; (b) symmetrically, the baseline key carrying a non-baseline kind; (c) a requested-ref step record whose payload fails delivered validation (the delivered malformed-payload precedent — a schema-valid frame with a non-integer token class).
- Each damaged record sits at a known ledger sequence.

**Steps**:

1. Build arm (a) and run the families read for the requested ref.
2. Repeat for arm (b) and arm (c).
3. For each arm, compare the returned identity, error kind, and location fields against the delivered contract (same assertions TC-TELEMETRY-012 makes today).

**Expected Outcome**:

- Arms (a) and (b) each return `state.store.torn` at that record's position — store path plus its 1-based ledger sequence — exactly as delivered; the skip logic cannot reach them because the key is the requested ref's.
- Arm (c) returns the delivered payload classification and location, unchanged: same identity, same kind, same path, same sequence.
- Nothing is skipped or reclassified: the defect correction relaxes nothing for the ref actually being read (G-2).

**Postconditions**:

- Temp root removed.

**Notes / Clarifications**:

- Binding constraint 4. This case is the guard against RSK-1 (an over-broad skip masking genuine damage): after the fix, a remaining tear from this projection means genuinely malformed family keys or requested-ref damage — never another ref's valid record.

#### TC-TELEMETRY-044 - Foreign records skipped without kind or payload inspection (jurisdiction boundary)

**Scenario Type**: Edge Case
**Impact Level**: Important
**Priority**: High
**Related IDs**: F-1, F-2, AC-F1-1, DM-1, NFR-5, DEC-2
**Test Type(s)**: Integration
**Automation Level**: Automated
**Target Layer / Location**: `tests/behaviour/telemetry-foreign-ref-skip.test.ts` (new suite)
**Tags**: @backend, @state

**Preconditions**:

- An FX-1 variant where a foreign step-family record — another ref's key — deliberately carries the **wrong kind for its family** (the baseline kind under a step-family key) and a **garbage payload** no family schema would validate; a symmetric variant does the same under a foreign baseline-family key.
- The ledger remains verifier-clean: the global verified read admits these records (framing, sequence, checksum), because payload-schema validation is per-projection, not part of the verified pass.

**Steps**:

1. Build the step-family variant and run the families read for the other (non-owning) ref.
2. Run the families read for the owning ref of the deliberately broken record.
3. Repeat both arms with the baseline-family variant.
4. Run the healthy interleaved control (no deliberately broken foreign record) to confirm the fixture harness itself is clean.

**Expected Outcome**:

- Reading the non-owning ref succeeds: the foreign record is skipped with **no kind inspection and no payload inspection** — no classification, no evidence — proving the projection does not validate other refs' records (DEC-2).
- Reading the owning ref tears as requested-ref damage (F-3): the deliberately broken record is the owner's business, so the skip applies only to foreign keys — the boundary is jurisdictional, not "broken records are invisible".
- The global verified read remains the place physical damage is caught for every ref; this projection declines to duplicate it.

**Postconditions**:

- Temp root removed.

**Notes / Clarifications**:

- Binding constraint 5. This case pins DEC-2's jurisdiction boundary and RSK-7's answer: a cross-family inconsistency in a foreign record is invisible to every per-ref projection by design, inside the global read's jurisdiction.

#### TC-TELEMETRY-045 - The read stays one verified pass at observed ledger scale

**Scenario Type**: Corner Case
**Impact Level**: Critical
**Priority**: High
**Related IDs**: F-5, AC-F5-1, NFR-1, DM-4, G-6
**Test Type(s)**: Integration (instrumented)
**Automation Level**: Automated
**Target Layer / Location**: `tests/behaviour/telemetry-foreign-ref-skip.test.ts` (new suite), over a thin instrumented wrapper of the store port
**Tags**: @backend, @state, @perf

**Preconditions**:

- Fixture FX-6 at the observed incident scale: at least 4,800 ledger records holding two refs' families mixed throughout, in incident-like proportions (a long earlier change's steps interleaved with the requested ref's records).
- A counting wrapper around the store port that records every `readRecords()` invocation and every other port method call.
- The ledger file's bytes captured before the read.

**Steps**:

1. Wrap the fixture store with the counting port.
2. Run the families read for the requested ref.
3. Read the port counters; compare the scoped result against the seeded record identities.
4. Compare the ledger file's bytes after the read against the captured bytes.

**Expected Outcome**:

- Exactly one `readRecords()` call: zero additional store reads, zero per-record re-reads, zero harness or session queries (NFR-1's 0/0/0 clause).
- The read returns the correct scoped result at the observed scale, with foreign records interleaved throughout — each foreign record visited exactly once, in ledger order, changing the read's cost by nothing beyond the delivered single visit.
- The ledger bytes are identical after the read: no mutation, reorder, or rewrite of any kind on any path (G-6, DM-4).

**Postconditions**:

- Temp root removed.

**Notes / Clarifications**:

- Binding constraint 6, first clause. The bound is asserted structurally through call counts, not wall-clock timing — a timing assertion would be flaky and would assert the wrong property (the contract is one pass, not a latency budget).

#### TC-TELEMETRY-046 - Single-ref golden equality with delivered behavior

**Scenario Type**: Regression
**Impact Level**: Critical
**Priority**: High
**Related IDs**: F-6, AC-F6-1, NFR-6, DM-2
**Test Type(s)**: Integration + committed golden comparison
**Automation Level**: Automated
**Target Layer / Location**: `tests/behaviour/telemetry-foreign-ref-skip.test.ts` (new suite), golden fixture committed under `tests/fixtures/` (never named `*.test.ts`, per the fixture-discovery rule)
**Tags**: @backend, @state

**Preconditions**:

- Fixture FX-5: a ledger whose telemetry families hold only the requested ref's records — today's single-ticket projects — with every delivered tear case representable (malformed payload, unknown kind under the requested key, baseline kind mismatch).
- A committed golden of the delivered single-ref results: the record collections with their ordering, the verified-empty flag, the evidence pair, and each delivered tear case's identity and location — captured per the repo's deliberate-golden rules and regenerable by an explicit command.

**Steps**:

1. Run the families read on FX-5 and deep-compare the whole result against the golden.
2. Run each delivered tear case against its damaged variant and compare identity and location against the golden.
3. Run the verified-empty case: a requested ref with no telemetry at all.

**Expected Outcome**:

- Zero differences in records, ordering, verified-empty flag, and evidence pair: byte-identical behavior to delivered on every single-ref ledger (F-6/NFR-6 golden equality).
- Every delivered tear case is identical in identity and location to delivered.
- The verified-empty result is identical to delivered, including the evidence still disclosing the (small) ledger.

**Postconditions**:

- Temp root removed.

**Notes / Clarifications**:

- Binding constraint 6, second clause. Golden updates are deliberate review decisions with an explicit regeneration command, never a blanket rewrite (testing strategy, invariant-test authoring).

#### TC-TELEMETRY-047 - Determinism and hermeticity of the proof matrix

**Scenario Type**: Corner Case
**Impact Level**: Important
**Priority**: Medium
**Related IDs**: NFR-2, AC-NFR2-1 (first clause), DM-3
**Test Type(s)**: Integration (matrix run), following the delivered `telemetry-determinism` and `telemetry-hermetic` conventions
**Automation Level**: Automated
**Target Layer / Location**: `tests/behaviour/telemetry-foreign-ref-skip.test.ts` (new suite); offline posture guarded by `tests/checks/telemetry-hermetic.test.ts`
**Tags**: @backend, @state, @hermetic

**Preconditions**:

- The full fixture matrix (FX-1 both directions, FX-2, FX-3, FX-4, FX-5, FX-6) is runnable offline through the committed fixture helpers: per-test temp roots, injected clock literals, zero network, zero ambient store, zero real-clock reads.

**Steps**:

1. Run every fixture in the matrix three times.
2. Deep-compare each fixture's results across runs: records, ordering, verified-empty, evidence, and every tear identity and location.

**Expected Outcome**:

- All three runs are identical for every fixture, across success and tear cases alike (NFR-2 determinism).
- The matrix runs with zero network calls, zero ambient-store reads, and zero real-clock dependencies (AC-NFR2-1's hermeticity clause).
- The second AC clause — delivered vocabulary sets exactly equal with zero additions — is pinned by the delivered structure suites (error table, telemetry contract constants, envelope and exit-code contracts, all Existing – No Change); this suite contributes the guarantee that the change's own paths emit only delivered identities, asserted exactly in TC-TELEMETRY-042 and TC-TELEMETRY-043.

**Postconditions**:

- All temp roots removed.

**Notes / Clarifications**:

- Fixture state is committed hermetic state — simulated committed ledger shapes, never the live incident ledger (binding constraint 7).

#### TC-REF-006 - Provider resolution proceeds to a provider decision on a two-ref ledger

**Scenario Type**: Happy Path
**Impact Level**: Critical
**Priority**: High
**Related IDs**: F-4, AC-F4-2, NFR-5
**Test Type(s)**: Integration (consumer-level)
**Automation Level**: Automated
**Target Layer / Location**: `tests/behaviour/provider-budget-ref.test.ts` (existing suite — update; extends the delivered TC-REF-005 composition)
**Tags**: @backend, @provider, @spend

**Preconditions**:

- Fixture FX-7: a temp-root store seeded through the delivered append path with two refs' full telemetry families (steps, baselines, and the delivered v1 session records for both), so the budget read meets a genuinely multi-ref ledger.
- The provider engine composed with the delivered fake clock, credential port, and transport, and a ticket-scope budget configured — the delivered TC-REF-005 harness, extended with full families per ref.

**Steps**:

1. Seed FX-7 and create the spend-totals port over the store.
2. Run provider resolution for the requested ref.
3. Compare the measured budget against the requested ref's own scoped spend fold figure computed independently over the same store.

**Expected Outcome**:

- The budget measurement reads the spend projection successfully and resolution proceeds to a provider decision per the delivered provider facts — the delivered admission path runs to its conclusion instead of failing on the telemetry read (Flow 5).
- The measured budget equals exactly the requested ref's own totals: zero foreign contribution (NFR-5).
- No `state.store.torn` from the telemetry read is produced on any path; pre-fix, this same fixture fails resolution with the telemetry tear.

**Postconditions**:

- Temp root removed.

**Notes / Clarifications**:

- Binding constraint 8, second clause. This is the admission-unblocking proof: the consumer whose failure stops every dispatch.

#### TC-METRICS-113 - Metrics report reads a two-ref ledger with exactly the requested ref's dispatch

**Scenario Type**: Happy Path
**Impact Level**: Important
**Priority**: Medium
**Related IDs**: F-4, AC-F1-1 (consumer clause), DM-2, G-3
**Test Type(s)**: Integration (consumer-level)
**Automation Level**: Automated
**Target Layer / Location**: `tests/behaviour/metrics-dispatch.test.ts` (existing suite — update; second-ref seeding through the delivered append path on the fixture's store)
**Tags**: @backend, @metrics

**Preconditions**:

- The metrics fixture store seeded with two refs' telemetry families via the delivered append helpers, so the metrics read meets a genuinely multi-ref ledger.
- The report's shape contract unchanged (NG-4): this case proves success, not shape.

**Steps**:

1. Seed the two-ref families into the metrics fixture store.
2. Run the metrics report for the requested ref.
3. Inspect the per-dispatch block and the records feeding the burn-rate evaluation.

**Expected Outcome**:

- The report succeeds — no `state.store.torn` — where pre-fix it tore on the first foreign family record.
- The per-dispatch block contains exactly the requested ref's dispatch; the burn-rate evaluation reads the same scoped families; no foreign dispatch row appears.
- The report shape, keys, and tolerances are unchanged from delivered (the only difference is failing → succeeding).

**Postconditions**:

- Temp root removed.

**Notes / Clarifications**:

- The metrics report composes the one corrected projection (spec A-4); this case proves the inheritance rather than a separate fix. If the metrics harness cannot host a second ref's families cleanly, the identical assertions move into the new telemetry suite over FX-1 (see §8.2); the AC coverage does not change.

## 6. Environments and Test Data

- **Environment:** local development only. Runner is `bun test` (or `pnpm test`); the aggregate proof is `pnpm check` before review. No staging, no network, no services: the read path performs zero network, zero harness-store, and zero vendor calls on any path (spec §8.4), and the suites must keep it that way.
- **Fixture model (hermetic, committed):** every fixture is built at suite runtime inside a per-test temp root through the committed fixture helpers (`tests/fixtures/telemetry`, `tests/fixtures/state/harness`) — the delivered hermetic convention of injected clock literals, injected identity, and `removeRoot` cleanup in `afterEach`. Fixtures simulate **committed ledger shapes**; the live incident ledger is never read — the incident appears only as a reproduced shape (FX-2) with Appendix A as corroboration (binding constraint 7).
- **Fixture inventory:**
  - FX-1 — interleaved two-ref fixture, both leading directions, three families per ref (steps, baseline, capture families), plus the absent-ref arm.
  - FX-2 — the named regression fixture: foreign step record first (the record-3786 shape).
  - FX-3 — malformed-key fixture: bare step prefix, and the bare baseline-prefix variant; valid framing and checksum, family's own kind, known sequences.
  - FX-4 — requested-ref damage fixture: step-key kind mismatch, baseline-key kind mismatch, malformed payload arm; known sequences.
  - FX-5 — single-ref fixture with every delivered tear case representable (golden-equality source).
  - FX-6 — observed-scale fixture: ≥4,800 records, two refs mixed throughout (single-pass proof).
  - FX-7 — two-ref provider fixture: full families for both refs (budget-measurement proof).
- **Seeding discipline:** all healthy records are seeded through the delivered append path so every fixture record remains one the production writers could have produced. Only shapes production writers never emit — bare prefixes, cross-family kinds, garbage payloads — are committed through the raw append path within a write fence, the delivered technique of TC-TELEMETRY-012; their framing and checksums stay valid so the verified read admits them and the projection's classification is what is being tested.
- **Isolation:** per-test temp roots, no shared state across suites, no ambient-store reads; gate evidence goes to the declared scratch-directory override (`TMPDIR=$PWD/tmp/tmpdir`).
- **Determinism:** all timestamps are injected literals; no suite reads the ambient clock, environment, network, or the live tree (extends the delivered telemetry fixture header contract).

## 7. Automation Plan and Implementation Mapping

| TC ID | Test file to create or update | Implementation status | Execution command | Mocking / instrumentation requirements |
|-------|-------------------------------|-----------------------|-------------------|----------------------------------------|
| TC-TELEMETRY-040 | `tests/behaviour/telemetry-foreign-ref-skip.test.ts` (new) | To Implement | `bun test tests/behaviour/telemetry-foreign-ref-skip.test.ts` | Committed interleaved seeding helper added to `tests/fixtures/telemetry` (both directions); delivered append path only |
| TC-TELEMETRY-041 | same suite | To Implement | same | FX-2 seeding (foreign step record first); delivered fold composition import |
| TC-TELEMETRY-042 | same suite | To Implement | same | Raw append within fence for bare prefixes; exact sequence assertions via `expectTorn`-style helper |
| TC-TELEMETRY-043 | same suite | To Implement | same | Raw append for kind mismatches; delivered malformed-payload arm |
| TC-TELEMETRY-044 | same suite | To Implement | same | Raw append for cross-family kind + garbage payload foreign records |
| TC-TELEMETRY-045 | same suite | To Implement | same | Counting wrapper over the store port (readRecords calls, other-method calls); ledger byte capture |
| TC-TELEMETRY-046 | same suite + committed golden fixture under `tests/fixtures/` | To Implement (golden capture from delivered behavior in the same change) | same | Golden regeneration by explicit command; snapshot updated deliberately in review |
| TC-TELEMETRY-047 | same suite | To Implement | same | Three-run matrix harness; relies on the delivered hermeticity posture |
| TC-REF-006 | `tests/behaviour/provider-budget-ref.test.ts` (existing) | Existing – Update | `bun test tests/behaviour/provider-budget-ref.test.ts` | Delivered fake clock/credential/transport; FX-7 seeding via `appendHarnessTelemetry`-family helpers |
| TC-METRICS-113 | `tests/behaviour/metrics-dispatch.test.ts` (existing) | Existing – Update | `bun test tests/behaviour/metrics-dispatch.test.ts` | Second-ref seeding on the metrics fixture store via the delivered append helpers |
| Aggregate gate | — | Existing – No Change | `pnpm check` | Gate evidence under the declared scratch-directory override |

Placement rationale (the decision this plan is asked to make): the projection-level cases share one fixture family and one failure class, so they live together in one new behaviour suite named for the defect — consistent with the repo's precedent for defect-named suites — rather than being scattered as arms across the delivered storage suites, whose TC-TELEMETRY-012 contract this suite extends rather than edits. The consumer-level proofs live where their consumers already live: the provider budget case extends TC-REF-005's harness (`provider-budget-ref.test.ts`) and the metrics case extends the dispatch suite, reusing each suite's delivered composition instead of re-creating it. No new suite family, no new framework. The new suite's row in `feature-telemetry-v2.md` §7 lands at the phase-7 reconciliation (NG-8 keeps documentation out of this change).

Status legend: To Implement = authored in the delivery phase of this change; Existing – Update = new cases appended to a delivered suite; Existing – No Change = delivered suites pass unchanged and contribute required coverage.

## 8. Risks, Assumptions, and Open Questions

### 8.1 Risks

| Risk | Impact | Mitigation |
|------|--------|------------|
| Fixture fidelity: a malformed fixture record that fails framing/checksum would tear in the verified read, not in the projection — proving the wrong layer | High | FX-3/FX-4 records are committed with valid framing and checksums (raw append within a fence); the case notes make the layer-under-test explicit; the healthy-control arm in TC-TELEMETRY-044 catches a polluted harness |
| An over-broad skip in the implementation passes the happy paths but masks genuine damage | High | TC-TELEMETRY-042 and TC-TELEMETRY-043 pin every preserved tear with exact identity and location; the AC's failing arms (skipped-malformed, dropped-location) are asserted exactly, so the proof fails by construction on the regression |
| An under-broad skip reintroduces the defect on a shape the fixtures miss | High | The fixtures interleave two refs in both directions, all three families per ref, with the foreign family record first in the named regression case (the exact observed shape); TC-TELEMETRY-044 adds the wrong-kind and garbage-payload variants (binding constraints 1 and 5) |
| Wall-clock or count-based assertions make the suite flaky as record populations grow | Medium | The read bound is asserted structurally (one `readRecords()` call, zero other reads), never by timing; population-sensitive assertions compare against seeded identities, not brittle counts (testing strategy: assert meaning, not growing counts) |
| Golden drift: the single-ref golden silently rewritten to match a regression | Medium | Golden regeneration is an explicit command; updates are deliberate review decisions per the testing strategy's invariant rules; a golden change that alters a tear case must fail review |
| The metrics harness resists hosting a second ref's families | Low | Documented fallback in TC-METRICS-113 notes: the identical assertions move into the new suite over FX-1; AC coverage unchanged |

### 8.2 Assumptions

- The delivered append path accepts cross-family key/kind raw appends within a write fence — the technique TC-TELEMETRY-012 uses today — so the malformed and deliberately broken foreign fixtures can be committed without store-side rejection.
- `readRecords()` returns raw records with payload-schema validation left to projections, so a garbage-payload foreign record passes the verified read and genuinely reaches the skip branch (the precondition TC-TELEMETRY-044 depends on).
- All three spend-side consumers compose the one families read (spec A-4), so projection-level coverage plus the two consumer proofs (spend fold, provider resolve) plus the metrics read suffice; the status digest section 8 inherits via the same fold and is covered by its delivered suites unchanged.
- The delivery phase captures the FX-5 golden from delivered behavior within the same change, before the branches are edited, so "identical to delivered" is a concrete artifact rather than a claim.
- The provider harness of TC-REF-005 is reusable with full telemetry families seeded per ref (it already seeds two refs' session records).

### 8.3 Open Questions

None blocking. Two authoring notes recorded for the delivery phase, neither blocking readiness: the implementation plan (phase 4) assigns the TCs to phases and commits; the metrics-case fallback (TC-METRICS-113 notes) is a placement contingency, not an open requirement.

## 9. Plan Revision Log

| Version | Date | Author | Changes |
|---------|------|--------|---------|
| 1.0 | 2026-11-22 | @test-plan-writer (GLM-5.3-Flash) | Initial test plan from spec v1.0 (AC-F1-1 … AC-NFR2-1, F-2 table, Appendices A–C), the binding owner-comment constraints, and the pm-notes clarify_scope findings; 10 cases across one new suite and two existing suites; no TODO rows, no open questions |

## 10. Test Execution Log

| TC ID | Run Date | Result | Notes |
|-------|----------|--------|-------|
| — | — | — | Populated during the quality-gates phase; nothing executed at authoring time |
