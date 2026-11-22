---
id: chg-GH-384-test-plan
status: Proposed
version: 1.0
created: 2026-11-22
last_updated: 2026-11-22
owners: ["Juliusz Ćwiąkalski"]
service: "state-layer telemetry step and baseline reads and the baseline append idempotency path (core read/write path)"
labels: [change, planning, defect, state, telemetry, spend, m4]
version_impact: minor
summary: "Pin the GH-384 correction as classifications tests run: the per-ref steps read (`readTelemetrySteps`, composed by the window-scoped zero-spend evidence reading and the versioned steps composition) and the per-ref baseline records read — the composition seam of the baseline append's (`appendTelemetryBaseline`) fence-scoped idempotency pre-read and post-verified read — apply the delivered GH-381 rule unchanged and in full (spec F-4/Appendix C): a well-formed family key naming another ref is skipped with no kind inspection, no payload inspection, and no evidence, while the bare step and baseline prefixes tear `state.store.torn` at their own record's position, requested-ref kind mismatches and payload failures tear exactly as delivered at the delivered safe location (store path + 1-based ledger sequence), baseline idempotency stays un-weakened (a same-ref repeat is the delivered no-op, a different session appends, and every pre-existing ledger record stays byte-identical across another ref's append), the reads stay one verified pass over the store with the append's delivered pre/post read shape and zero additional store reads, and single-ref behavior is golden-equal to delivered including every tear case; the regression case named for the GH-381 review advisory is a golden-before-fix pin that reproduces both original failures against the pre-fix code over committed fixtures and succeeds against the corrected code — with the healthy baseline fixtures exercising the real append helper, GH-381's raw-append two-refs workaround retired to damage shapes only (the workaround is the behavior under test); window evidence renders on multi-ref ledgers with matched and excluded sets covering exactly the requested ref's steps inside the delivered closed four-reason exclusion vocabulary; all fixtures are committed hermetic state over reproduced ledger shapes, never a live ledger, with zero network, zero ambient store, zero real clock, and gate evidence under the declared scratch-directory override."
links:
  change_spec: ./chg-GH-384-spec.md
  implementation_plan: ./chg-GH-384-plan.yaml   # phase-4 artifact; not present when this plan was written
  testing_strategy: ../../../../.ai/rules/testing-strategy.md
---

# Test Plan - M4-S22: Telemetry reads must be multi-ref safe everywhere — window evidence and baseline capture (M4)

## 1. Scope and Objectives

The defect is the same classification error GH-381 closed at the families projection, still alive at the two remaining reads: the per-ref steps read and the per-ref baseline records read — the composition seam of the baseline append's idempotency pre-read and post-verified read — treat any telemetry-family key that is not the requested ref's exact key as `state.store.torn`. On any ledger holding two changes' telemetry, window evidence (the peak-pause proof surface) refuses naming a valid foreign step record, and no change after a project's first can capture baselines through the delivered append path. Both failures were observed, not theorized: the second one directly, when GH-381's own fixtures had to raw-append two refs' baselines inside one fence to avoid exercising the delivered helper at all — a workaround that exists only because the helper cannot perform a second ref's append. This plan therefore proves the correction as the delivered rule applied unchanged and in full (spec §5.1 F-4 table, restated normatively in Appendix C), symmetrically at both sites and on both composition paths of the idempotency pair (no partial fix, DEC-3), plus the properties a naive fix would trade away: idempotency never weakened (no-op repeat, byte-identical pre-existing records), the single verified pass (no new reads, the append's delivered pre/post shape), exact per-ref scoping (no foreign record in, no requested record dropped, foreign steps in neither window set), tear-location fidelity for every preserved tear, and byte-identical single-ref behavior.

The highest-risk failure modes are silent, so each gets an adversarial arm rather than a prose claim: an over-broad skip that masks genuine damage (`TC-TELEMETRY-051`, `TC-TELEMETRY-052` — every preserved tear pinned with exact identity and location), an under-broad or partial fix that reintroduces the defect on a variant shape or fixes one idempotency read and not the other (`TC-TELEMETRY-048` both directions, `TC-TELEMETRY-050` through the real helper on the shared composition path), a foreign record that "looks damaged" and tempts a kind-first classification into a per-ref projection (`TC-TELEMETRY-049`, the DEC-2 jurisdiction boundary — the arm that distinguishes key-first from kind-first), a hidden second read or extra store read on the append path (`TC-TELEMETRY-054`), idempotency silently weakened into a duplicate (`TC-TELEMETRY-050`'s repeat and byte-identity arms), and requested-ref or single-ref drift as a side effect of editing the branches (`TC-TELEMETRY-055`). Because the proof must exercise the defect and not the workaround, the named regression case (`TC-TELEMETRY-053`, golden-before-fix, named for the GH-381 review advisory) runs its baseline fixture through the real `appendTelemetryBaseline` helper — raw appends inside a fence survive only for damage shapes production writers never emit.

This is a verification map, not an execution claim: nothing here was run against a new implementation at authoring time, and phase ownership belongs to `chg-GH-384-plan.yaml`, authored in phase 4 after this plan. All 8 acceptance criteria (AC-F1-1, AC-F2-1, AC-F4-1, AC-F4-2, AC-F8-1, AC-F6-1, AC-F7-1, AC-NFR2-1) — and through spec Appendix B, ticket AC-1 … AC-5 and required behavior — are covered by at least one named case; every case traces to exactly one AC; there are no TODO rows, no orphan cases and no open questions blocking coverage. The plan reuses GH-381's delivered conventions in full: the same defect-class suite, the same fixture module and hermetic harness, the same golden-with-explicit-capture-entry technique, and the same structural (call-count, not wall-clock) read-bound proof.

### 1.1 In Scope

- The per-ref steps read (`readTelemetrySteps`) and the per-ref baseline records read (`readTelemetryBaselines`) as the composition seam of the baseline append's idempotency pre-read and post-verified read: the F-4 classification table exercised cell by cell at both sites, on both idempotency reads' path — foreign skip, bare-prefix tear, unchanged requested-ref tear and payload behavior; no partial fix.
- Tear-location fidelity for every preserved tear case: the delivered safe location (store path + offending record's 1-based ledger sequence).
- Baseline idempotency semantics preserved: fence-scoped run-and-session dedupe unchanged, same-ref repeat is the no-op, a different session appends, and every pre-existing ledger record is byte-identical across another ref's successful append (NFR-7).
- The proof fixtures: interleaved two-ref step families with the foreign record first (the observed shape) in both read directions; two-ref baselines where the second ref's append runs through the delivered helper; bare-prefix fixtures for both families; requested-ref kind-mismatch fixtures; the named pre-fix regression pin; the single-ref golden comparison with negative controls; the single-pass read proof; the determinism matrix.
- The window-scoped zero-spend evidence reading consumer proof: the reading renders on a multi-ref ledger with matched and excluded sets computed over exactly the requested ref's steps, inside the delivered closed exclusion-reason set.
- Determinism and hermeticity of the whole proof matrix over committed fixture state, and the closed-vocabulary freeze for every identity the change's paths emit.

### 1.2 Out of Scope & Known Gaps

- Ledger mutation of any kind — delete, rewrite, truncate, compact, salvage, migration, back-fill: not tested because not to exist — asserted absent (`TC-TELEMETRY-054` ledger byte-equality, `TC-TELEMETRY-050` byte-identity), never exercised.
- The per-ref families projection (`readTelemetryFamilies`): the rule source, already correct per GH-381 and untouched by this change (spec NG-3, §16); its delivered suite (`telemetry-foreign-ref-skip.test.ts` TC-TELEMETRY-040..047) remains authoritative and passes unchanged. This plan extends that suite's file with the new series; it does not alter the delivered cases.
- The telemetry capture writers (step append, capture-outcome append, session-record branch): delivered ref-scoped, unchanged (spec NG-3); they appear only as the fixture seeding paths and in the single-ref golden's delivered outcomes.
- Consumer report shapes and semantics (spend envelope keys, the window reading's keys and closed exclusion-reason set, digest sections, metrics report blocks, tolerances, exit projections): unchanged per NG-4; the existing consumer suites remain authoritative, and this plan adds only the multi-ref render proof at the window-evidence consumer (`TC-SPEND-035`).
- The metrics report and provider resolution: they compose the families projection (unchanged — spec §16), not the two sites this change corrects; unlike GH-381, no AC names those surfaces, so no `TC-REF-*` or `TC-METRICS-*` case is added and both series are left untouched for future changes.
- Other ledger projections (economics, phase history, command audit, change registry) and the global ledger verifier: unchanged per NG-6; the economics read is cited as precedent, not re-tested.
- The standalone capture-family read: latent same-class shape, no delivered consumer, no observed failure, deferred by the ticket's two-site scope (spec §7.3, NG-10, OQ-2). Deliberately not covered by any case here; this plan's F-4 table cases are the stated rule for the day a consumer composes it.
- A writer-side bare-prefix guard and a shared projection helper for the skip rule: deferred (spec §7.3); the reader-side tears delivered here are the safety net either way.
- Spend reconciliation (#378): separate work item; this change is its prerequisite, not its substitute.
- Documentation reconciliation of the reading bases and the new suite rows in the feature specifications: phase-7 obligation (spec §22); no doc assertions in this plan (NG-8).
- Changeset format, branch targeting, and phase mechanics: delivery-phase concerns declared in the spec (§18) and owned by the implementation plan; not test scenarios.

## 2. References

- Change specification: `./chg-GH-384-spec.md` — §5.1 capability details (the F-4 table is the normative rule, restated in Appendix C), §17 acceptance criteria, Appendix A observed evidence, Appendix B ticket traceability, Appendix C normative classification restatement, Appendix D verified ground truth (TC-id series state, changeset format, fixture discipline).
- PM notes: `./chg-GH-384-pm-notes.yaml` — the binding owner implementation-pointer comment (apply `readTelemetryFamilies`' delivered rule unchanged to `readTelemetrySteps` and the `appendTelemetryBaseline` idempotency pre/post-reads; fixtures must call the real helper; do not weaken idempotency; no ledger delete/rewrite/salvage; one verified pass over `store.readRecords()`; gate evidence `TMPDIR=$PWD/tmp/tmpdir`), the GH-381 retros (TC-id collision, raw-append workaround, changeset rework), and the phase-7 documentation impacts.
- Testing strategy: `.ai/rules/testing-strategy.md` — bun:test under `tests/**/*.test.ts`, hermetic fixture conventions, permanent-suite invariant rules (never assert a branch diff; goldens updated deliberately by explicit command; assert meaning, not growing counts), aggregate gate `pnpm check`.
- Feature specifications: `doc/spec/features/feature-telemetry-v2.md` (§4 storage families and key prefixes, §5/§5.1 reading bases, §7 suite map), `feature-spend.md` (window-scoped zero-spend evidence reading and its closed exclusion-reason set), `feature-state-layer.md` (`state.store.torn` taxonomy and safe-location convention).
- Delivered prior art this plan builds on: `tests/behaviour/telemetry-foreign-ref-skip.test.ts` (GH-381, TC-TELEMETRY-040..047 — the rule source's proof suite this plan extends; `expectTornAt` location conventions), `tests/fixtures/telemetry/index.ts` (the GH-381 fixture inventory FX-1..FX-7 and shared builders this plan reuses and extends), `tests/fixtures/telemetry/foreign-ref-skip-golden.ts` + `foreign-ref-skip-golden-run.ts` (the committed-golden-with-explicit-capture-entry technique the pin and the single-ref golden reuse), `tests/behaviour/telemetry-storage-damage.test.ts` (TC-TELEMETRY-012 — the delivered torn-identity and location conventions for damage fixtures), `tests/behaviour/spend-zero-window.test.ts` (the window-evidence reading's delivered semantic home), `tests/behaviour/telemetry-determinism.test.ts` (TC-TELEMETRY-032 determinism convention) and `tests/checks/telemetry-hermetic.test.ts` (TC-TELEMETRY-036 offline posture guard), `tests/structure/error-table.test.ts` and `tests/structure/telemetry-contract.test.ts` (the closed-vocabulary authority for NFR-4).
- Ticket: juliusz-cwiakalski/agentic-delivery-os issue #384, including the binding owner implementation-pointer comment, and the GH-381 review advisory (posted to issue #381) that identified both defect sites and from which this ticket was filed — the advisory the regression case is named for.

## 3. Coverage Overview

Every AC maps to at least one named case, and every case traces to exactly one AC; no AC is TODO. Case IDs continue the delivered series. The TC-id series state was re-verified in the delivered tree immediately before authoring this plan (grep across `tests/`), per spec Appendix D and the GH-381 DoR retro: the delivered maxima are **TC-TELEMETRY-047** (`tests/behaviour/telemetry-foreign-ref-skip.test.ts`), **TC-REF-007** (`tests/behaviour/provider-budget-ref.test.ts`), **TC-METRICS-113** (`tests/behaviour/metrics-dispatch.test.ts`), and **TC-SPEND-034** (`tests/checks/spend-mutants.test.ts`). The next free ids at authoring time are therefore TC-TELEMETRY-048+, TC-REF-008+, TC-METRICS-114+, TC-SPEND-035+. This plan consumes **TC-TELEMETRY-048..056** (one series, continuing the defect-class home suite) and **TC-SPEND-035** (the window-evidence consumer's series); the TC-REF and TC-METRICS series are deliberately not consumed — no AC names those surfaces (see §1.2).

### 3.1 Functional Coverage (F-#, AC-#)

| AC ID | Criterion (compressed) | TC ID(s) | Status |
|-------|------------------------|----------|--------|
| AC-F1-1 | Interleaved two-ref ledger with a foreign step first: the window-scoped zero-spend evidence reading succeeds for the requested ref, matched/excluded sets computed over exactly that ref's steps, 0 foreign steps named in either set, 0 requested steps dropped; the other ref likewise | TC-TELEMETRY-048, TC-TELEMETRY-049, TC-SPEND-035 | Covered |
| AC-F2-1 | Ledger holding ref A's helper-seeded baselines: ref B's capture through the real append helper succeeds and appends exactly B's record; same run-and-session repeat is the no-op with no duplicate; ref A's baseline and every pre-existing record byte-identical, ledger grown by exactly B's record | TC-TELEMETRY-050 | Covered |
| AC-F4-1 | Bare step prefix and bare baseline prefix tear `state.store.torn` at their own record's position (store path + 1-based sequence) at their own sites; skipped-malformed or dropped-location fails the proof | TC-TELEMETRY-051 | Covered |
| AC-F4-2 | Requested-ref kind mismatch (step key on the steps read; baseline key on the idempotency path) tears as delivered; payload validation and its delivered classification and location unchanged | TC-TELEMETRY-052 | Covered |
| AC-F8-1 | The regression case named for the GH-381 review advisory reproduces both original failures against the pre-fix code over committed fixtures, with the pre-fix failure shapes captured and asserted (golden-before-fix); against the corrected code both succeed per AC-F1-1 and AC-F2-1 | TC-TELEMETRY-053 | Covered |
| AC-F6-1 | Exactly one verified pass per read; 0 additional store reads / per-record re-reads / harness or session queries; the append keeps its delivered fence-scoped pre/post shape; foreign records interleaved throughout are each visited exactly once | TC-TELEMETRY-054 | Covered |
| AC-F7-1 | Single-ref ledger: records, ordering, verified-empty flag, evidence, append outcomes, and every tear identity and location identical to delivered — golden equality with 0 differences (the negative controls) | TC-TELEMETRY-055 | Covered |
| AC-NFR2-1 | Three-run determinism with 0 network / ambient-store / real-clock dependencies over the proof matrix; delivered vocabulary sets exactly equal with 0 additions | TC-TELEMETRY-056 (+ delivered structure suites for the vocabulary clause) | Covered |

Functional capability roll-up:

| F-# | Capability | TC ID(s) |
|-----|------------|----------|
| F-1 | Foreign well-formed step keys skipped, never damage; window evidence renders, exactly scoped | TC-TELEMETRY-048, TC-TELEMETRY-049, TC-SPEND-035 |
| F-2 | Foreign well-formed baseline keys skipped on both idempotency reads' path; second ref's capture succeeds | TC-TELEMETRY-050, TC-TELEMETRY-049 |
| F-3 | Idempotency semantics preserved: no-op repeat, distinct session appends, byte-identical pre-existing records | TC-TELEMETRY-050 |
| F-4 | Malformed family keys still tear: bare prefix of either family at its own position | TC-TELEMETRY-051, TC-TELEMETRY-048, TC-TELEMETRY-049 |
| F-5 | Requested-ref damage preserved: kind mismatch, payload validation, location fidelity | TC-TELEMETRY-052, TC-TELEMETRY-051, TC-TELEMETRY-055 |
| F-6 | One verified pass, zero ledger mutation on any path | TC-TELEMETRY-054 |
| F-7 | Single-ref behavior identical | TC-TELEMETRY-055 |
| F-8 | Pre-fix failure reproduction pinned (golden-before-fix, real helper exercised) | TC-TELEMETRY-053 |

Ticket acceptance-criteria traceability (via spec Appendix B):

| Ticket AC | Spec criterion | TC ID(s) |
|-----------|----------------|----------|
| Ticket AC-1 (two refs, interleaved step families, foreign first → window evidence succeeds, foreign steps excluded) | AC-F1-1 | TC-TELEMETRY-048, TC-TELEMETRY-049, TC-SPEND-035 |
| Ticket AC-2 (two refs' baselines; ref B append succeeds; repeat idempotent; ref A byte-identical) | AC-F2-1 | TC-TELEMETRY-050 |
| Ticket AC-3 (bare prefixes still tear at correct positions, both families) | AC-F4-1 | TC-TELEMETRY-051 |
| Ticket AC-4 (requested-ref kind mismatch still tears) | AC-F4-2 | TC-TELEMETRY-052 |
| Ticket AC-5 (regression case named for the GH-381 review advisory reproduces pre-fix failures) | AC-F8-1 | TC-TELEMETRY-053 |
| Required behavior (rule applied exactly; one verified pass; no mutation; idempotency un-weakened) | AC-F6-1, AC-F7-1, AC-NFR2-1 | TC-TELEMETRY-054, TC-TELEMETRY-055, TC-TELEMETRY-056 |

### 3.2 Interface Coverage (API-#, EVT-#, DM-#)

No HTTP endpoints and no events exist on any path before or after this change (spec §8.1, §8.2) — nothing to cover there, by absence. The data-model elements:

| DM-# | Element | TC ID(s) / note |
|------|---------|-----------------|
| DM-1 | Family key grammar: `<family prefix><ref remainder>`; empty remainder (bare prefix) malformed; foreign remainder skipped — no new prefix or grammar | TC-TELEMETRY-051 (empty remainder, both families), TC-TELEMETRY-048/TC-SPEND-035 (foreign step remainder), TC-TELEMETRY-050/TC-TELEMETRY-049 (foreign baseline remainder), TC-TELEMETRY-052 (requested remainder) — the F-4 table exercised cell by cell at both sites |
| DM-2 | Steps-read result: records collection, verified-empty flag, evidence (store path) — unchanged shape; contents on a multi-ref ledger exactly the requested ref's steps | TC-TELEMETRY-048 (exactness + shared evidence), TC-SPEND-035 (consumer composition unchanged), TC-TELEMETRY-055 (golden equality incl. the flag); the flag's delivered derivation is pinned on the AC-named fixtures — see the §8.3 derivation note |
| DM-3 | Baseline append outcome: appended true with the delivered outcome, or the delivered no-op for an existing run-and-session identity, fence-scoped as delivered — only behavioral difference is succeeding where the pre/post reads previously tore | TC-TELEMETRY-050 (outcomes unchanged), TC-TELEMETRY-053 (the pin: failing → succeeding is the only difference) |
| DM-4 | Damage taxonomy unchanged: `state.store.torn` keeps exactly its delivered subjects; no identity added, removed, or re-semanted | TC-TELEMETRY-051, TC-TELEMETRY-052 (identity equality, asserted exactly) + delivered `tests/structure/error-table.test.ts` and `tests/structure/telemetry-contract.test.ts` (Existing – No Change) |
| DM-5 | Ledger records unchanged: same kinds, schemas, keys, sequences, checksums; nothing written, mutated, or reordered beyond the delivered appends | TC-TELEMETRY-054 (ledger byte-equality across reads; growth-by-exactly-the-record across the append), TC-TELEMETRY-050 (NFR-7 byte-identity), TC-TELEMETRY-056 (repeat-run equality) |

### 3.3 Non-Functional Coverage (NFR-#)

| NFR-# | Requirement | TC ID(s) / note |
|-------|-------------|-----------------|
| NFR-1 | Single-pass read cost: exactly one verified pass per read invocation; the append keeps its delivered pre/post shape with 0 additional store reads, 0 per-record re-reads, 0 harness or session queries; work linear in ledger records, constant per record | TC-TELEMETRY-054 (instrumented one-pass proof over the counting port wrapper, including the delivered observed-scale fixture for the linear-work clause; structural, not wall-clock) |
| NFR-2 | Determinism and hermeticity: three-run equality over the proof matrix; offline over committed state | TC-TELEMETRY-056 (matrix run; offline posture guarded by delivered `tests/checks/telemetry-hermetic.test.ts`, which covers the extended suite) |
| NFR-3 | Tear fidelity: store path + offending record's 1-based sequence, 0 drift across the bare-prefix, kind-mismatch, and payload cases in both families | TC-TELEMETRY-051, TC-TELEMETRY-052 (explicit exact location assertions, `expectTornAt` conventions) |
| NFR-4 | Closed-vocabulary invariance: 0 additions to any delivered set (identities, kinds, schemas, prefixes, envelope keys, exit codes) | Covered by delivered structure suites (error table, telemetry contract, envelope and exit-code contracts — Existing – No Change); this plan additionally asserts the change's paths emit only delivered identities (TC-TELEMETRY-051, TC-TELEMETRY-052) and that no exclusion reason is invented for skipped steps (TC-SPEND-035). AC-NFR2-1's vocabulary clause rests on these. |
| NFR-5 | Projection exactness: 0 foreign records in, 0 requested dropped; window matched/excluded sets contain 0 foreign steps over exactly the requested ref's steps; verified-empty iff-clause on the interleaved fixtures' read directions; both directions of every interleaved fixture | TC-TELEMETRY-048, TC-TELEMETRY-049, TC-TELEMETRY-050, TC-SPEND-035 (the verified-empty flag's derivation nuance is recorded in §8.3 and pinned per the delivered contract) |
| NFR-6 | Single-ref golden equality | TC-TELEMETRY-055 |
| NFR-7 | Ledger byte-identity across append: every pre-existing record byte-identical; ledger grows by exactly the appended record(s) | TC-TELEMETRY-050 (asserted for the append path of the multi-ref baseline fixture), TC-TELEMETRY-054 (byte capture around the append arm) |

## 4. Test Types and Layers

- **Behaviour tests (primary):** `bun:test`, `tests/behaviour/*.test.ts`. The classification matrix at both sites, the idempotency and byte-identity arms, the tear cases, the single-pass bound, the golden comparisons, the pre-fix pin's corrected halves, and the window-evidence consumer proof live here, per the testing strategy's module-to-test mapping (`packages/**` → `bun test tests/structure tests/behaviour`).
- **Structure/contract tests (guarding, no new cases):** `tests/structure/*.test.ts` — the delivered error-table, telemetry-contract, envelope, and exit-code suites pin the closed vocabulary (NFR-4) and fail if any identity, prefix, envelope key, or exit code is added.
- **Golden comparison:** both goldens (the pre-fix pin's two halves and the single-ref equality golden) are committed fixtures captured and validated by explicit capture entries — never blanket rewrites, per the testing strategy's permanent-suite rules; golden updates are deliberate review decisions.
- **Static/diff checks (always):** `git diff --check`; naming and placement review against `tests/behaviour` conventions; fixtures never named `*.test.ts` so they are not discovered as suites.
- **Aggregate gate:** `pnpm check` (lint → format:check → typecheck → test → boundaries) is the pre-review proof battery (spec §18); narrow suites are used while iterating. Gate evidence uses the declared scratch-directory override (`TMPDIR=$PWD/tmp/tmpdir`).
- **Performance:** no new performance harness and no wall-clock assertions. The read bound is proven structurally — instrumented call counts on the store port — with the linear-work clause run over the delivered observed-scale fixture (shared lazy build), reusing GH-381's delivered budget technique.

## 5. Test Scenarios

### 5.1 Scenario Index

| TC ID | Title | Type | Level | Priority | AC Coverage |
|-------|-------|------|-------|----------|-------------|
| TC-TELEMETRY-048 | Steps read: interleaved two-ref ledger projects exactly one ref, both directions | Happy Path | suite | High | AC-F1-1 |
| TC-TELEMETRY-049 | Foreign records declined without kind or payload inspection at both sites (jurisdiction boundary) | Edge Case | suite | High | AC-F1-1 |
| TC-TELEMETRY-050 | Second-ref baseline capture through the real append helper: append, idempotent repeat, byte-identity | Happy Path | suite | High | AC-F2-1 |
| TC-TELEMETRY-051 | Bare family prefixes tear at their own position, both families, both sites | Negative | suite | High | AC-F4-1 |
| TC-TELEMETRY-052 | Requested-ref damage preserved: kind mismatch and payload validation unchanged | Negative | suite | High | AC-F4-2 |
| TC-TELEMETRY-053 | Named pre-fix regression pin: golden-before-fix over committed fixtures | Regression | suite | High | AC-F8-1 |
| TC-TELEMETRY-054 | The reads stay one verified pass with the delivered append read shape, at observed scale | Corner Case | suite | High | AC-F6-1 |
| TC-TELEMETRY-055 | Single-ref golden equality with delivered behavior (negative controls) | Regression | suite | High | AC-F7-1 |
| TC-TELEMETRY-056 | Determinism, hermeticity, and vocabulary freeze of the proof matrix | Corner Case | suite | Medium | AC-NFR2-1 |
| TC-SPEND-035 | Window-scoped zero-spend evidence renders on a multi-ref ledger, exactly scoped | Happy Path | suite | High | AC-F1-1 |

### 5.2 Scenario Details

#### TC-TELEMETRY-048 - Steps read: interleaved two-ref ledger projects exactly one ref, both directions

**Scenario Type**: Happy Path
**Impact Level**: Critical
**Priority**: High
**Related IDs**: F-1, F-4, AC-F1-1, DM-1, DM-2, NFR-5
**Test Type(s)**: Integration
**Automation Level**: Automated
**Target Layer / Location**: `tests/behaviour/telemetry-foreign-ref-skip.test.ts` (delivered suite — extend; new `TC-TELEMETRY-048..056` series), fixture helpers from `tests/fixtures/telemetry` (extended with GH-384 builders) and `tests/fixtures/state/harness`
**Tags**: @backend, @state

**Preconditions**:

- FX-8 is built per test in a temp root through the delivered append paths: two change refs A and B, each holding at least two step records, interleaved in ledger order (a B step between A's steps and vice versa), plus one baseline record per ref seeded through the real `appendTelemetryBaseline` helper so the ledger is a genuine multi-ref telemetry ledger.
- FX-8 exists in both leading directions — A's records first and B's records first — because "both read directions of every interleaved fixture" is the exactness clause (NFR-5).
- The ledger is verifier-clean: contiguous sequences, every checksum recomputes.

**Steps**:

1. Build FX-8 with ref A's step records leading.
2. Run the steps read (`readTelemetrySteps`) for A.
3. Run the steps read for B.
4. Assert each result's records collection contains exactly the requested ref's step records — compare against the seeded record identities (run, session, attribution, instants), not counts — in ledger order.
5. Assert neither read produces `state.store.torn` or any other classification, and the evidence discloses the shared ledger (the same store path, with the whole ledger's record count) for both reads.
6. Rebuild FX-8 with B leading and repeat steps 2–5 (the reversed direction).
7. On the same ledger, run the versioned steps composition (`readTelemetryStepsAtVersion`) for A at the declared storage version and compare against the steps read's result projected at that version.
8. Run the steps read for a third ref holding no step records on this ledger; assert success — no tear on the foreign step keys — with an empty records collection.

**Expected Outcome**:

- Each read for A and B succeeds and returns exactly the requested ref's steps: zero foreign records in any returned collection, zero requested-ref records dropped (NFR-5).
- No read produces `state.store.torn` or any other damage classification; foreign step keys contribute nothing — no record, no evidence, no count.
- The versioned composition equals the corrected steps read annotated at the declared version — inheritance with no per-consumer edit (F-1, spec §16).
- The absent-ref read succeeds rather than tearing on foreign records; the verified-empty flag is asserted per the delivered contract on this fixture (both refs hold records, so the flag is false — a property on which the delivered derivations agree; see the §8.3 derivation note before asserting it for an absent ref over a non-empty ledger).
- All reads disclose the same store path and the same total ledger record count — one shared ledger, one ref's slice each.

**Postconditions**:

- Temp root removed; ledger bytes unchanged (asserted here and structurally in TC-TELEMETRY-054).

**Notes / Clarifications**:

- The foreign-first variant of this shape — the exact observed failure — is the named regression fixture's job (TC-TELEMETRY-053, FX-R1); this case pins the exactness property in both directions.
- Seeding discipline (spec Appendix D): every healthy record lands through the delivered append paths; the baseline records specifically through the real helper (DEC-3), never the GH-381 raw-append batch seeder, which survives only for damage shapes.

#### TC-TELEMETRY-049 - Foreign records declined without kind or payload inspection at both sites (jurisdiction boundary)

**Scenario Type**: Edge Case
**Impact Level**: Important
**Priority**: High
**Related IDs**: F-1, F-2, F-4, AC-F1-1, DM-1, NFR-5, DEC-2
**Test Type(s)**: Integration
**Automation Level**: Automated
**Target Layer / Location**: `tests/behaviour/telemetry-foreign-ref-skip.test.ts` (delivered suite — extend); reuses the delivered `seedForeignFamilyDamage` technique
**Tags**: @backend, @state

**Preconditions**:

- FX-12 arms, each on an otherwise healthy two-ref ledger: (a) a foreign step-family key (ref B's) deliberately carrying the wrong kind for its family (the baseline kind) and a garbage payload no family schema would validate; (b) symmetrically, a foreign baseline-family key carrying the step kind and a garbage payload.
- The ledger remains verifier-clean: framing, sequence, and checksum are valid, so the global verified read admits these records and the reads' own classification is what is tested (payload-schema validation is per-projection, not part of the verified pass).
- The raw append within a write fence is the committed seeding path — a damage shape production writers never emit, the delivered technique.

**Steps**:

1. Build arm (a) and run the steps read for the non-owning ref (the ref the read answers is not the damaged record's owner).
2. Run the steps read for the owning ref of the deliberately broken record.
3. Build arm (b); run ref B's baseline capture through the real helper where the damaged foreign baseline key belongs to a third ref, and the capture for the damaged record's own ref.
4. Run the healthy interleaved control (no deliberately broken foreign record) to confirm the fixture harness itself is clean.

**Expected Outcome**:

- Arm (a): the steps read for the non-owning ref succeeds — the foreign record is skipped with **no kind inspection and no payload inspection**, no classification and no evidence — proving the classification is key-first, not kind-first. This arm fails any implementation that inspects kinds before keys (the pre-fix code tears here too, on the wrong-kind branch).
- Arm (b): the capture for the non-owning ref proceeds through both idempotency reads; the foreign baseline key is skipped untouched.
- Reading or capturing for the damaged records' own ref tears as requested-ref damage (F-5): the deliberately broken record is its owner's business — the boundary is jurisdictional, not "broken records are invisible" (DEC-2).
- The global verified read remains the place physical damage is caught for every ref; the per-ref reads decline to duplicate it.

**Postconditions**:

- Temp root removed.

**Notes / Clarifications**:

- This case pins DEC-2's jurisdiction boundary at the two new sites, mirroring delivered TC-TELEMETRY-044's role for the families read.
- Pre-fix, arm (a) tears on the kind branch and the baseline arm tears in the idempotency pre-read; post-fix both skip silently — the case is a regression guard against re-narrowing the skip.

#### TC-TELEMETRY-050 - Second-ref baseline capture through the real append helper: append, idempotent repeat, byte-identity

**Scenario Type**: Happy Path
**Impact Level**: Critical
**Priority**: High
**Related IDs**: F-2, F-3, AC-F2-1, DM-3, DM-5, NFR-7
**Test Type(s)**: Integration
**Automation Level**: Automated
**Target Layer / Location**: `tests/behaviour/telemetry-foreign-ref-skip.test.ts` (delivered suite — extend); new GH-384 seeding helper exercising the real `appendTelemetryBaseline`
**Tags**: @backend, @state

**Preconditions**:

- FX-9: ref A's baseline record(s) seeded **through the delivered append helper** (`appendTelemetryBaseline`) — works pre-fix, because at seeding time the ledger holds no other ref's baselines. This is the binding DEC-3 fixture discipline: healthy baselines go through the real helper; the GH-381 raw-append batch seeder is retired for healthy fixtures and survives only for damage shapes (bare prefixes, wrong kinds, invalid payloads).
- Ref B's baseline record with a run-and-session identity distinct from A's; the ledger additionally interleaves both refs' step records (seeded through the delivered step append) so the capture runs over a genuinely multi-ref ledger.
- The ledger file's bytes captured before ref B's capture; the ledger is verifier-clean.

**Steps**:

1. Seed ref A's baseline through the real helper; assert the delivered appended outcome.
2. Capture ref B's baseline through the real helper (same fence discipline, distinct fence token): assert success — `appended: true` with the delivered append outcome naming the new record.
3. Assert exactly one record was appended: the ledger grew by exactly ref B's baseline record, at the next sequence.
4. Repeat ref B's capture with the **same run-and-session identity**: assert the delivered no-op outcome (`appended: false`) and that the ledger did not grow — no duplicate record.
5. Capture ref B with a **different session** (same ref, distinct session identity): assert it appends as delivered.
6. Byte-compare every pre-existing ledger record — ref A's baseline, both refs' steps — against the captured bytes; assert ref A's baseline record is byte-identical and no record was reordered, rewritten, or dropped.

**Expected Outcome**:

- Ref B's capture succeeds on a ledger holding ref A's baselines — the defect site is closed (F-2); pre-fix, this exact operation fails with `state.store.torn` naming ref A's baseline record (pinned by TC-TELEMETRY-053).
- The same-ref repeat is the no-op, never a duplicate; a different session appends (F-3) — the dedupe key (run-and-session identity) and fence scoping are unchanged (DM-3).
- Every pre-existing ledger record is byte-identical after another ref's successful append, and the ledger grew by exactly the appended records (NFR-7) — the skip adds no write of any kind.

**Postconditions**:

- Temp root removed.

**Notes / Clarifications**:

- This case is the AC-F2-1 proof and the anti-RSK-3 guard: the fix must not trade the multi-ref tear for a duplicate-append defect.
- The fence-scoped pre-read and post-verified read are both exercised by construction — every helper invocation runs both; their composition-path correction is additionally pinned by TC-TELEMETRY-051/052 arms that tear through the capture path, and the read-count shape by TC-TELEMETRY-054.

#### TC-TELEMETRY-051 - Bare family prefixes tear at their own position, both families, both sites

**Scenario Type**: Negative
**Impact Level**: Critical
**Priority**: High
**Related IDs**: F-4, F-5, AC-F4-1, DM-1, DM-4, NFR-3
**Test Type(s)**: Integration
**Automation Level**: Automated
**Target Layer / Location**: `tests/behaviour/telemetry-foreign-ref-skip.test.ts` (delivered suite — extend); reuses the delivered `seedBarePrefixRecord` and follows the suite's `expectTornAt` conventions (descended from TC-TELEMETRY-012)
**Tags**: @backend, @state

**Preconditions**:

- FX-10: a healthy two-ref interleaved ledger carrying a record whose key is the **bare family prefix with an empty ref remainder** (e.g. `harness.telemetry.step:` naming no ref), carrying the family's own record kind — the realistic writer-bug shape — at a known, deterministic ledger sequence, with valid framing and checksums so the verified read parses it and the tear provably originates in the read's classification, not in framing damage.
- A symmetric variant carries the bare baseline-prefix record; the malformed shape is committed via the raw append path within a write fence — a shape production writers never emit, the delivered technique.

**Steps**:

1. Build FX-10 with the bare step-prefix record at a known sequence.
2. Run the steps read for a requested ref present in the fixture.
3. Assert the read fails with exactly `state.store.torn`, located at the disclosed store path and exactly that record's 1-based ledger sequence.
4. Repeat with the bare baseline-prefix record: run ref B's baseline capture through the real helper on the fixture — the idempotency pre-read tears at the bare record's own position, the fence is released, and the error propagates to the capture result.
5. Repeat both arms for a ref absent from the fixture (the AC's "for any ref" clause).

**Expected Outcome**:

- Each read and the capture's pre-read return `state.store.torn` — never a skip, never another identity — at the offending record's own position: store path plus its 1-based ledger sequence, zero location drift across the step and baseline cases (NFR-3).
- The absent-ref arms tear identically: a malformed family key is invalid regardless of which ref is being answered.
- The proof fails by construction if a future edit marks the malformed record skipped or drops its location — both properties are asserted exactly (the AC's failing arms).
- The capture's post-verified read is exercised symmetrically by construction: after any successful append in TC-TELEMETRY-050, the landing verification runs over the same classification path.

**Postconditions**:

- Temp root removed.

**Notes / Clarifications**:

- Binding constraint (ticket AC-3): the bare prefix must still tear `state.store.torn` for BOTH families, at both sites — the steps read directly, and the baseline family on the idempotency composition path (OQ-1's resolution: the rule lands on the shared per-ref baseline read, so no partial fix is possible).
- Pre-fix, the bare prefix already tears (delivered behavior); this case pins that the correction does not relax it — the guard against RSK-1.

#### TC-TELEMETRY-052 - Requested-ref damage preserved: kind mismatch and payload validation unchanged

**Scenario Type**: Negative
**Impact Level**: Critical
**Priority**: High
**Related IDs**: F-5, AC-F4-2, DM-4, NFR-3
**Test Type(s)**: Integration
**Automation Level**: Automated
**Target Layer / Location**: `tests/behaviour/telemetry-foreign-ref-skip.test.ts` (delivered suite — extend); reuses the delivered `seedRequestedRefDamage` arms, mirroring TC-TELEMETRY-012's damaged-seed techniques
**Tags**: @backend, @state

**Preconditions**:

- FX-11 arms, all under the requested ref's own keys at known ledger sequences: (a) the step key carrying a record kind other than the step kind; (b) symmetrically, the baseline key carrying a non-baseline kind (exercised on the idempotency path — the capture for that ref fails in its pre-read); (c) a requested-ref step record whose payload fails delivered validation (the delivered malformed-payload precedent — a schema-valid frame with a non-integer token class).

**Steps**:

1. Build arm (a) and run the steps read for the requested ref.
2. Build arm (b) and run the requested ref's baseline capture through the real helper.
3. Build arm (c) and run the steps read for the requested ref.
4. For each arm, compare the returned identity, error kind, and location fields against the delivered contract (the same assertions TC-TELEMETRY-012 makes today).

**Expected Outcome**:

- Arms (a) and (b) each return `state.store.torn` at that record's position — store path plus its 1-based ledger sequence — exactly as delivered; the skip logic cannot reach them because the key is the requested ref's.
- Arm (c) returns the delivered payload classification and location, unchanged: same identity, same kind, same path, same sequence.
- Nothing is skipped or reclassified: the correction relaxes nothing for the ref actually being read (F-5); a remaining tear from these reads means genuinely malformed family keys or requested-ref damage — never another ref's valid record (RSK-1's answer).

**Postconditions**:

- Temp root removed.

**Notes / Clarifications**:

- Binding constraint (ticket AC-4). Together with TC-TELEMETRY-051, this case makes RSK-1 (an over-broad skip masking genuine damage) fail loudly: every preserved tear is pinned with exact identity and location, and the AC's "unchanged" clause is an exact-equality assertion, not a prose claim.

#### TC-TELEMETRY-053 - Named pre-fix regression pin: golden-before-fix over committed fixtures

**Scenario Type**: Regression
**Impact Level**: Critical
**Priority**: High
**Related IDs**: F-8, F-1, F-2, AC-F8-1, DM-2, DM-3
**Test Type(s)**: Integration + committed golden-before-fix pin
**Automation Level**: Automated
**Target Layer / Location**: `tests/behaviour/telemetry-foreign-ref-skip.test.ts` (delivered suite — extend); golden module `tests/fixtures/telemetry/multi-ref-reads-golden.ts` with the explicit capture entry `tests/fixtures/telemetry/multi-ref-reads-golden-run.ts` (never named `*.test.ts`), mirroring the delivered `foreign-ref-skip-golden*.ts` convention — the case is named for the GH-381 review advisory that identified both defect sites
**Tags**: @backend, @state, @regression

**Preconditions**:

- FX-R1 (steps site): the observed shape reproduced at fixture scale from committed state — a two-ref ledger whose **first telemetry-family records are valid step records of the earlier foreign ref**, appearing before the requested ref's first record, followed by the requested ref's families (the delivered `seedForeignFirstRegression` builder shape; the live incident ledger is never read).
- FX-R2 (baseline site): ref A's baselines seeded **through the real `appendTelemetryBaseline` helper**, then ref B's capture attempted through the same helper.
- A committed golden holding, per fixture, **both halves**: the **pre-fix failure shapes** — FX-R1: the steps read (and the window reading composing it) failing with `state.store.torn` at the leading foreign step record's ledger sequence; FX-R2: ref B's capture failing with `state.store.torn` at ref A's baseline record's sequence — captured from the delivered tree by running the explicit capture entry at this change's branch point, **before the read branches are edited**; and the **corrected success shapes** — captured after the fix. Sequences are deterministic per the fixture builders' append order, so both halves are exact.

**Steps**:

1. Assert the golden's structural integrity: both pre-fix halves are present and record the tear identity (`state.store.torn`) with sequences matching the fixtures' deterministic layouts — the recorded proof that these fixtures genuinely exercise the defect.
2. Build FX-R1 through the shared builders and run the steps read for the requested ref.
3. Build FX-R2 through the shared builders and run ref B's capture through the real helper.
4. Assert the corrected halves against the live results: the steps read succeeds with exactly the requested ref's records (the AC-F1-1 shape), and the capture succeeds, then repeats as the no-op with byte-identical pre-existing records (the AC-F2-1 shape).
5. Delivery-phase evidence: run the capture entry at the pre-fix commit — it reproduces both original failures matching the golden's pre-fix halves; record the run in §10.

**Expected Outcome**:

- Against the pre-fix code, the case reproduces both original failures — the steps read tearing on a valid foreign step key, and ref B's capture through the delivered helper failing on a ledger holding ref A's baselines — with the pre-fix failure shapes captured and asserted (golden-before-fix, G-8).
- Against the corrected code, both operations succeed per AC-F1-1 and AC-F2-1.
- The permanent case fails if either defect regresses (a reintroduced tear breaks the corrected-half assertions) and demonstrates the fixtures genuinely exercise the defect (the pre-fix halves bind the same fixture builders to the recorded tears) — the proof demonstrates the defect, not a workaround of it (RSK-4's answer).

**Postconditions**:

- Temp roots removed; the golden is committed state.

**Notes / Clarifications**:

- The pre-fix reproduction is entry-level evidence over committed fixtures — never a base-branch or live-tree assertion inside the permanent suite (the testing strategy forbids branch-diff assertions in permanent suites; the golden's pre-fix half is a fixed historical record, not a moving target).
- The helper-not-workaround requirement is structural here: FX-R2's corrected half is only reachable through the real `appendTelemetryBaseline` (a raw-append fixture would certify nothing — the exact GH-381 retro), so the pin fails if the fixture is rewritten to route around the helper.

#### TC-TELEMETRY-054 - The reads stay one verified pass with the delivered append read shape, at observed scale

**Scenario Type**: Corner Case
**Impact Level**: Critical
**Priority**: High
**Related IDs**: F-6, AC-F6-1, NFR-1, DM-5, G-6
**Test Type(s)**: Integration (instrumented)
**Automation Level**: Automated
**Target Layer / Location**: `tests/behaviour/telemetry-foreign-ref-skip.test.ts` (delivered suite — extend), over a thin counting wrapper of the store port; scale clause over the delivered observed-scale fixture (shared lazy build — `seedObservedScaleLedger`, ≥4,800 records, two refs mixed throughout in incident-like proportions)
**Tags**: @backend, @state, @perf

**Preconditions**:

- A counting wrapper around the store port that records every `readRecords()` invocation, every `append` call, and every fence operation — the delivered GH-381 technique (TC-TELEMETRY-045).
- FX-9 for the append-path arm; the delivered observed-scale fixture for the linear-work clause (built lazily and shared per suite run — the delivered verified write re-verifies per append, so one build per run is the budget).
- The ledger file's bytes captured before each read and before the append.

**Steps**:

1. Wrap the fixture store with the counting port.
2. Run the steps read for the requested ref; read the counters; compare the scoped result against the seeded record identities.
3. Run each baseline idempotency read context: the pre-read (before any append) and the post-verified read (after TC-TELEMETRY-050's append) — each in its own wrapped invocation.
4. Run ref B's capture through the real helper under the counting port.
5. Compare the ledger bytes after every read against the captured bytes; after the append, compare the pre-existing records' bytes and the record count.
6. Run the steps read over the observed-scale fixture with foreign records interleaved throughout.

**Expected Outcome**:

- The steps read performs exactly one `readRecords()` call; each baseline idempotency read exactly one; ref B's helper invocation exactly two reads (the delivered fence-scoped pre-read and post-verified read) and exactly one `append` — zero additional store reads, zero per-record re-reads, zero harness or session queries (NFR-1's 0/0/0 clause; the append's delivered shape with 0 added reads, A-5).
- At observed scale the read returns the correct scoped result with each foreign record visited exactly once, in ledger order — work linear in total ledger records and constant per record, the read bound unchanged by interleaving (AC-F6-1's interleaved clause).
- The ledger bytes are identical after every read; across the append the ledger grows by exactly the appended record and no pre-existing byte changes — no mutation, reorder, or rewrite on any path (G-6, DM-5, NFR-7).

**Postconditions**:

- Temp roots removed, including the shared scale fixture.

**Notes / Clarifications**:

- The bound is asserted structurally through call counts, never by timing — a timing assertion would be flaky and would assert the wrong property (the contract is one pass, not a latency budget).
- Reusing the delivered scale fixture keeps this plan proportionate: the ≥4,800-record population and its incident-like proportions are already built and budgeted; this case consumes them for the steps site.

#### TC-TELEMETRY-055 - Single-ref golden equality with delivered behavior (negative controls)

**Scenario Type**: Regression
**Impact Level**: Critical
**Priority**: High
**Related IDs**: F-7, F-5, AC-F7-1, NFR-6, DM-2, DM-3
**Test Type(s)**: Integration + committed golden comparison
**Automation Level**: Automated
**Target Layer / Location**: `tests/behaviour/telemetry-foreign-ref-skip.test.ts` (delivered suite — extend); golden section in `tests/fixtures/telemetry/multi-ref-reads-golden.ts` with the shared explicit capture entry; golden captured from delivered behavior within this change, before the read branches are edited
**Tags**: @backend, @state

**Preconditions**:

- FX-13: a ledger whose telemetry holds only the requested ref's records — today's single-ticket projects — with every delivered tear case representable at both sites: bare step prefix (steps read), bare baseline prefix (capture pre-read), step-key kind mismatch, baseline-key kind mismatch, malformed payload; plus the healthy arm (steps present, one baseline) and the truly-empty ledger arm.
- A committed golden of the delivered single-ref results, captured per the repo's deliberate-golden rules and regenerable by the explicit capture entry: the steps-read results (records with ordering, the verified-empty flag, the evidence store path), the baseline capture outcomes (appended true with the delivered append outcome; the repeat's no-op `appended: false`), and each delivered tear case's identity and location.

**Steps**:

1. Run the steps read on FX-13's healthy arm and deep-compare the whole result against the golden.
2. Run ref A's baseline capture and its same-identity repeat on the healthy arm; compare both outcomes against the golden.
3. Run each delivered tear arm and compare identity and location against the golden.
4. Run the truly-empty ledger arm (a requested ref with no telemetry on an empty ledger).

**Expected Outcome**:

- Zero differences in records, ordering, verified-empty flag, evidence, append outcomes, and every tear identity and location: byte-identical behavior to delivered on every single-ref arm (F-7/NFR-6 golden equality with 0 differences).
- The negative controls prove the correction changes exactly one thing — keys that are provably someone else's no longer stop a read or a capture — and nothing else (G-7).
- On single-ref and truly-empty fixtures the flag derivations coincide, so the golden pins the delivered contract without depending on the §8.3 derivation question.

**Postconditions**:

- Temp roots removed.

**Notes / Clarifications**:

- Golden updates are deliberate review decisions with the explicit regeneration command, never a blanket rewrite (testing strategy, invariant-test authoring); a golden change that alters a tear case must fail review.
- The truly-empty arm mirrors the delivered FX-5 golden's documented rationale: delivered behavior for a ref with no telemetry is identical pre- and post-fix only there; the multi-ref shapes belong to the matrix cases, never to this golden.

#### TC-TELEMETRY-056 - Determinism, hermeticity, and vocabulary freeze of the proof matrix

**Scenario Type**: Corner Case
**Impact Level**: Important
**Priority**: Medium
**Related IDs**: NFR-2, NFR-4, AC-NFR2-1, DM-4
**Test Type(s)**: Integration (matrix run), following the delivered `telemetry-determinism` (TC-TELEMETRY-032) and `telemetry-hermetic` (TC-TELEMETRY-036) conventions
**Automation Level**: Automated
**Target Layer / Location**: `tests/behaviour/telemetry-foreign-ref-skip.test.ts` (delivered suite — extend; the delivered hermeticity guard `tests/checks/telemetry-hermetic.test.ts` scans it); vocabulary clause anchored in the delivered structure suites
**Tags**: @backend, @state, @hermetic

**Preconditions**:

- The full fixture matrix — FX-8 (both directions), FX-9, FX-10, FX-11, FX-12, FX-R1, FX-R2, FX-13's arms — is runnable offline through the committed fixture helpers: per-test temp roots, injected clock literals, zero network, zero ambient store, zero real-clock reads.

**Steps**:

1. Run every fixture in the matrix three times.
2. Deep-compare each fixture's results across runs: records, ordering, verified-empty flag, append outcomes, evidence, and every tear identity and location.
3. Assert the hermetic posture holds for the extended suite (offline, no sockets, no ambient store, injected time only).

**Expected Outcome**:

- All three runs are identical for every fixture, across success and tear cases alike (NFR-2 determinism).
- The matrix runs with zero network calls, zero ambient-store reads, and zero real-clock dependencies (AC-NFR2-1's hermeticity clause).
- The second AC clause — delivered vocabulary sets exactly equal with zero additions — is pinned by the delivered structure suites (error table, telemetry contract constants, envelope and exit-code contracts, all Existing – No Change); this plan contributes the guarantee that the change's own paths emit only delivered identities, asserted exactly in TC-TELEMETRY-051, TC-TELEMETRY-052, and TC-SPEND-035's exclusion-reason assertion.

**Postconditions**:

- All temp roots removed.

**Notes / Clarifications**:

- Fixture state is committed hermetic state — reproduced ledger shapes, never a live ledger (spec §10's operator-reproduction clause: a support conversation cites fixtures, not an incident ledger).

#### TC-SPEND-035 - Window-scoped zero-spend evidence renders on a multi-ref ledger, exactly scoped

**Scenario Type**: Happy Path
**Impact Level**: Critical
**Priority**: High
**Related IDs**: F-1, AC-F1-1, DM-2, NFR-5, NFR-4
**Test Type(s)**: Integration (consumer-level)
**Automation Level**: Automated
**Target Layer / Location**: `tests/behaviour/spend-zero-window.test.ts` (delivered suite — update; the window-evidence reading's delivered semantic home), composing the delivered seam: `readTelemetrySteps` + `windowSpendEvidence` in the delivered order — the composition `createProductionDependencies` builds at its `windowEvidence` closure (`packages/cli/src/edge.ts`) — over a real temp store
**Tags**: @backend, @state, @spend

**Preconditions**:

- FX-8-WE: a real temp-root store seeded through the delivered append paths with two refs' step families interleaved, **a foreign step record first** (the observed shape), and steps carrying full attribution (declared parked lane, agent role, model, billable call counts, instants inside and outside the declared window) so the matched and excluded sets are both non-empty and the reading is falsifiable — a seeded mid-window billable step reads non-zero, so the assertion can fail.
- The delivered window grammar (`--from`/`--through` window, closed exclusion-reason set `SPEND_WINDOW_EXCLUSION_REASONS`: `pre-park`, `post-window`, `other-lane`, `unreadable-instant`) and the delivered peak-window park/profile lookup riding unchanged.
- The delivered CLI definition and human render from the suite's delivered harness, driven with a runtime composed from the real reading.

**Steps**:

1. Seed FX-8-WE and run the window-scoped zero-spend evidence reading for ref B over a declared window.
2. Assert the reading succeeds — no `state.store.torn` and no other classification — and carries its delivered shape (ref, provider profile, window bounds, telemetry state `present`, the billable-call count as a number, the delivered basis identity).
3. Cross-check the matched and excluded sets against the seeded ref-B steps: every matched position is a ref-B step inside the window and lane; every excluded entry names a reason from the delivered closed four-value set; no foreign (ref A) step identity or position appears in either set; no new exclusion reason exists — skipped foreign steps are not re-classified as exclusions.
4. Run the same reading for ref A over the same window and ledger; assert it likewise succeeds with exactly ref A's steps in its sets.
5. Drive the delivered CLI definition with the composed reading and assert the human render states the reading (the delivered render contract), without inventing a stronger claim.

**Expected Outcome**:

- The window-scoped zero-spend evidence reading renders on a multi-ref ledger where pre-fix it returned `state.store.torn` naming the first foreign step record (Flow 1) — the observable defect site one is closed.
- The matched and excluded sets are computed over exactly the requested ref's steps: 0 foreign steps named in either set, 0 requested-ref steps dropped (NFR-5); the exclusion vocabulary is exactly the delivered set — no "foreign/skipped" reason is invented (NG-4, NFR-4).
- Both refs read cleanly over the same ledger; the reading's shape, keys, tolerances, and disclosure rules are unchanged from delivered — the only difference is failing → succeeding.

**Postconditions**:

- Temp root removed.

**Notes / Clarifications**:

- The reading is a pure pass over the steps read's output — exclusions are position-indexed over exactly that collection, so this case is the consumer-level confirmation that the projection exactness (TC-TELEMETRY-048) survives composition.
- The delivered parks/profile lookup is exercised only as the delivered pass-through it is; it is not a subject of this case. If the delivered composition cannot be imported at a stable seam, the identical assertions move into the telemetry suite over FX-8 (placement contingency mirroring the GH-381 metrics-case fallback); the AC coverage does not change.

## 6. Environments and Test Data

- **Environment:** local development only. Runner is `bun test` (or `pnpm test`); the aggregate proof is `pnpm check` before review (spec §18). No staging, no network, no services: both sites perform zero network, zero harness-store, and zero vendor calls on any path (spec §8.4), and the suites must keep it that way.
- **Fixture model (hermetic, committed):** every fixture is built at suite runtime inside a per-test temp root through the committed fixture helpers (`tests/fixtures/telemetry`, `tests/fixtures/state/harness`) — the delivered hermetic convention of injected clock literals, injected identity, and `removeRoot` cleanup in `afterEach`, with the delivered shared-lazy-build budget for the observed-scale fixture. Fixtures simulate **committed ledger shapes**; the live incident ledger is never read — the incident appears only as reproduced shapes (FX-R1, FX-8-WE's foreign-first arm) with spec Appendix A as corroboration.
- **Fixture inventory:**
  - FX-8 — interleaved two-ref steps fixture, both leading directions (steps through the delivered step append; one baseline per ref through the real helper), plus the absent-ref arm and the versioned-composition arm.
  - FX-8-WE — the window-evidence variant: attribution-complete steps, foreign step first, matched and excluded sets both populated.
  - FX-9 — two-ref baseline fixture: ref A seeded through the real `appendTelemetryBaseline`; ref B's capture, its same-identity repeat, and its distinct-session append through the same helper.
  - FX-10 — bare-prefix fixture for both families (delivered `seedBarePrefixRecord`): valid framing and checksums, family's own kind, known sequences.
  - FX-11 — requested-ref damage fixture (delivered `seedRequestedRefDamage` arms): step-key kind mismatch, baseline-key kind mismatch, malformed payload.
  - FX-12 — jurisdiction fixture (delivered `seedForeignFamilyDamage`): foreign step key with wrong kind + garbage payload; symmetric foreign baseline variant.
  - FX-R1 / FX-R2 — the named regression pin's fixtures: foreign steps first (delivered `seedForeignFirstRegression` shape) and ref A helper-seeded baselines with ref B's helper capture.
  - FX-13 — single-ref fixture family (healthy, truly-empty ledger, every delivered tear case at both sites) — the golden-equality source.
  - Observed-scale fixture — the delivered shared lazy build (≥4,800 records, two refs mixed throughout) for the single-pass linear-work clause.
- **New fixture helpers (GH-384):** extend `tests/fixtures/telemetry/index.ts` with GH-384-prefixed builders that reuse the shared builders — notably a healthy-baseline seeder that calls the real `appendTelemetryBaseline` and fails fast on any non-ok result, plus the golden module and its explicit capture entry following the delivered `foreign-ref-skip-golden*.ts` convention.
- **Seeding discipline (binding, spec Appendix D and DEC-3):** all healthy records are seeded through the delivered append paths — steps through the delivered step append, **baselines through the real `appendTelemetryBaseline` helper** (the behavior under test; the GH-381 raw-append two-refs workaround is retired for healthy fixtures). Only shapes production writers never emit — bare prefixes, wrong kinds, garbage payloads — are committed through the raw append path within a write fence, the delivered technique of TC-TELEMETRY-012; their framing and checksums stay valid so the verified read admits them and the reads' classification is what is tested.
- **Isolation:** per-test temp roots, no shared state across suites, no ambient-store reads; gate evidence goes to the declared scratch-directory override (`TMPDIR=$PWD/tmp/tmpdir`).
- **Determinism:** all timestamps are injected literals; no suite reads the ambient clock, environment, network, or the live tree (extends the delivered telemetry fixture header contract).

## 7. Automation Plan and Implementation Mapping

| TC ID | Test file to create or update | Implementation status | Execution command | Mocking / instrumentation requirements |
|-------|-------------------------------|-----------------------|-------------------|----------------------------------------|
| TC-TELEMETRY-048 | `tests/behaviour/telemetry-foreign-ref-skip.test.ts` (existing — extend with the TC-TELEMETRY-048..056 series) | To Implement | `bun test tests/behaviour/telemetry-foreign-ref-skip.test.ts` | GH-384 interleaved-steps helper (delivered step append + real-helper baselines, both directions); delivered `readTelemetryStepsAtVersion` composition |
| TC-TELEMETRY-049 | same suite | To Implement | same | Delivered `seedForeignFamilyDamage` reuse (both family variants); healthy-control arm |
| TC-TELEMETRY-050 | same suite | To Implement | same | New healthy-baseline seeder through the real `appendTelemetryBaseline` (fail-fast); ledger byte capture; sequential fence tokens |
| TC-TELEMETRY-051 | same suite | To Implement | same | Delivered `seedBarePrefixRecord` (both families); exact identity + sequence assertions via the suite's `expectTornAt` helper; capture-path arm |
| TC-TELEMETRY-052 | same suite | To Implement | same | Delivered `seedRequestedRefDamage` arms; delivered-contract equality assertions (TC-TELEMETRY-012's conventions) |
| TC-TELEMETRY-053 | same suite + `tests/fixtures/telemetry/multi-ref-reads-golden.ts` (new) + `tests/fixtures/telemetry/multi-ref-reads-golden-run.ts` (new capture entry) | To Implement (pre-fix halves captured at the branch point before the read branches are edited; corrected halves after) | same; capture entry run directly at the pre-fix commit for the golden-before-fix evidence | FX-R1 via delivered `seedForeignFirstRegression` shape; FX-R2 via the real helper; golden holds both halves; entry exits non-zero on drift |
| TC-TELEMETRY-054 | same suite | To Implement | same | Counting wrapper over the store port (`readRecords`/`append`/fence calls); ledger byte capture; delivered observed-scale fixture (shared lazy build) |
| TC-TELEMETRY-055 | same suite + golden section in `multi-ref-reads-golden.ts` | To Implement (golden capture from delivered behavior in the same change, before the branches are edited) | same | FX-13 arms; explicit regeneration command; snapshot updated deliberately in review |
| TC-TELEMETRY-056 | same suite | To Implement | same | Three-run matrix harness; relies on the delivered hermeticity posture and its guard suite |
| TC-SPEND-035 | `tests/behaviour/spend-zero-window.test.ts` (existing — update) | Existing – Update | `bun test tests/behaviour/spend-zero-window.test.ts` | Real temp store via the state harness; delivered composition seam (`readTelemetrySteps` → `windowSpendEvidence`, the `createProductionDependencies` closure's composition); delivered CLI definition + human render |
| Delivered structure suites | `tests/structure/error-table.test.ts`, `tests/structure/telemetry-contract.test.ts`, envelope/exit-code contract suites | Existing – No Change | `bun test tests/structure` | None — authoritative for the NFR-4 vocabulary clause |
| Delivered hermeticity guard | `tests/checks/telemetry-hermetic.test.ts` (TC-TELEMETRY-036) | Existing – No Change | `bun test tests/checks/telemetry-hermetic.test.ts` | Scans the extended telemetry suite; keeps the offline posture enforced |
| Aggregate gate | — | Existing – No Change | `pnpm check` | Gate evidence under the declared scratch-directory override (`TMPDIR=$PWD/tmp/tmpdir`) |

Placement rationale (the decision this plan is asked to make): the two sites are the same defect class as GH-381 with the same rule, the same fixture family, and the same store harness, so their cases extend the delivered defect-class suite — consistent with the repo's precedent for defect-named suites and with the GH-381 plan's convention — rather than opening a second suite family; the TC-TELEMETRY series continues at 048 in the same file, whose header comment is updated to name GH-384 alongside GH-381. The one consumer-level proof lives where its consumer already lives: the window-evidence reading's delivered semantic home (`spend-zero-window.test.ts`), taking the next free TC-SPEND id. Unlike GH-381, no provider or metrics case exists because no AC names those surfaces — both compose the families projection, unchanged by this change (spec §16); the TC-REF and TC-METRICS series are left untouched. The golden and capture entries extend the delivered foreign-ref-skip golden convention rather than inventing a second one. No new suite family, no new framework. The new suites' rows in the feature specifications land at the phase-7 reconciliation (NG-8 keeps documentation out of this change).

Status legend: To Implement = authored in the delivery phase of this change; Existing – Update = new cases appended to a delivered suite; Existing – No Change = delivered suites pass unchanged and contribute required coverage.

## 8. Risks, Assumptions, and Open Questions

### 8.1 Risks

| Risk | Impact | Mitigation |
|------|--------|------------|
| Fixture fidelity: a malformed fixture record that fails framing/checksum would tear in the verified read, not in the read's classification — proving the wrong layer | High | FX-10/FX-11/FX-12 records are committed with valid framing and checksums (raw append within a fence, delivered technique); the case notes make the layer-under-test explicit; the healthy-control arm in TC-TELEMETRY-049 catches a polluted harness |
| An over-broad skip in the implementation passes the happy paths but masks genuine damage | High | TC-TELEMETRY-051 and TC-TELEMETRY-052 pin every preserved tear with exact identity and location, in both families and at both sites; the AC's failing arms (skipped-malformed, dropped-location) are asserted exactly, so the proof fails by construction on the regression |
| A partial fix: only the pre-read fixed and not the post-read, or only the steps site and not baselines (RSK-2, DEC-3) | High | The rule is required on the composition path of both idempotency reads — FX-9 runs the capture through the real helper so both reads execute, TC-TELEMETRY-051/052 tear arms exercise the baseline path through the capture, and the steps and baseline sites are proven symmetrically with both read directions |
| Idempotency silently weakened: the skip misapplied so a same-ref repeat appends a duplicate, or a foreign append disturbs ref A's record (RSK-3) | High | TC-TELEMETRY-050 asserts the no-op outcome and byte-identity of pre-existing records as exact properties of the multi-ref fixture; the run-and-session key and fence scoping are pinned as delivered (DM-3) |
| The proof exercises the workaround instead of the defect (RSK-4): fixtures keep GH-381's raw-append two-refs technique for healthy baselines | High | FX-9/FX-R2 are structurally bound to the real `appendTelemetryBaseline` — the corrected halves are unreachable otherwise; the golden pin fails if the fixture is rewritten to route around the helper; the seeding discipline is stated in §6 and enforced by the fail-fast seeder |
| Golden drift: a golden half silently rewritten to match a regression | Medium | Both goldens are captured and validated by explicit entries; updates are deliberate review decisions per the testing strategy's invariant rules; a golden change that alters a tear case or a pre-fix failure shape must fail review |
| Count- or population-based assertions make the suite flaky as record populations grow | Medium | The read bound is asserted structurally (exact call counts, zero other reads), never by timing; exactness assertions compare against seeded identities, not brittle counts (testing strategy: assert meaning, not growing counts); the scale fixture reuses the delivered shared-lazy-build budget |
| The window-evidence seam resists test composition | Low | Documented fallback in TC-SPEND-035 notes: the identical assertions move into the telemetry suite over FX-8; AC coverage unchanged |
| TC-id collision recreates the GH-381 DoR iteration-1 failure (RSK-5) | Medium | The series state was re-verified in the delivered tree immediately before authoring (§3 preamble): TC-TELEMETRY-048..056 and TC-SPEND-035 are unused; TC-REF/TC-METRICS untouched |

### 8.2 Assumptions

- The delivered append helper accepts sequential fence tokens (each `appendTelemetryBaseline` call acquires and releases its own fence), so FX-9/FX-R2 seed and capture through repeated helper calls without nesting — the delivered signature and GH-381 fixture usage support this.
- Raw appends within a write fence accept cross-family key/kind shapes with valid framing — the technique TC-TELEMETRY-012 and the delivered GH-381 seeders use today — so the damage fixtures commit without store-side rejection.
- `store.readRecords()` returns raw records with payload-schema validation left to projections, so a garbage-payload foreign record passes the verified read and genuinely reaches the skip branch (TC-TELEMETRY-049's precondition).
- The capture entry for the golden can be run at the pre-fix commit during delivery (the branch point before the read branches are edited) and the run recorded as change evidence — the same within-change capture GH-381's FX-5 golden used, extended to record failure shapes.
- The delivered observed-scale fixture (shared lazy build) is reusable as-is for the steps site's linear-work clause; the baseline idempotency reads' bound is per-invocation and needs only FX-9.
- The hermeticity guard suite scans the extended telemetry suite by its existing discovery rules, so TC-TELEMETRY-056's offline posture stays enforced without a new guard case.
- The window-evidence fixture's park/profile lookup rides the delivered parks read unchanged; the case does not depend on any peak-window behavior beyond the delivered pass-through.

### 8.3 Open Questions

None blocking coverage — all 8 ACs are mapped to named cases and no TODO rows exist. One precision note is recorded for the delivery phase and the DoR gate:

- **The verified-empty flag's derivation at the two sites (non-blocking; flag for `@readiness-reviewer` and the owner).** The delivered steps and baseline reads pass the store read's ledger-wide `verifiedEmpty` through (`baseEvidence`: true when the whole ledger holds zero records), while the delivered families read — the rule source this change applies — computes it per-ref (all of the ref's family collections empty). NFR-5's iff-clause ("verified-empty true if and only if the requested ref holds no records of the family") reads per-ref; DM-2 ("unchanged shape"), F-7/NFR-6 ("identical to delivered"), and §8.5 read as the delivered pass-through. On every fixture the ACs name, the two derivations agree (each interleaved direction's requested ref holds records → false either way; single-ref and truly-empty arms coincide), so coverage is unaffected either way and this plan asserts the delivered contract, pinning equality rather than a derivation. The question only bites for a ref holding no records of the family over a non-empty ledger — a shape no AC names. Resolution path: if the fix aligns the derivation with the rule source, the optional absent-ref arm (TC-TELEMETRY-048 step 8) asserts `true`; if it keeps the pass-through, it asserts the delivered value; if the delivery finds the contract itself must change, the DEC-4 escalation trigger applies. Do not invent a derivation here; settle it at delivery planning or DoR, not in a test assertion the spec does not pin.
- **The window-evidence seam's import shape (placement contingency, mirrors the GH-381 metrics-case fallback).** The runtime's `windowEvidence` closure is composed inside `createProductionDependencies` rather than exported standalone; TC-SPEND-035 composes the delivered calls in the delivered order at that seam. If review prefers the full-runtime composition, the delivery phase adds the minimal exported seam or moves the case per the documented fallback; the AC coverage does not change.

The implementation plan (phase 4) assigns the TCs to phases and commits; the §10 execution log records the pre-fix capture-entry run and the gate results.

## 9. Plan Revision Log

| Version | Date | Author | Changes |
|---------|------|--------|---------|
| 1.0 | 2026-11-22 | @test-plan-writer (GLM-5.3-Flash) | Initial test plan from spec v1.0 (AC-F1-1 … AC-NFR2-1, F-4 table + Appendix C, Appendix B ticket traceability, Appendix D ground truth), the binding owner implementation-pointer comment, the GH-381 retros, and the delivered GH-381 test plan as the reused convention (suite, fixture module, golden-with-capture-entry, structural read bound); 10 cases across one extended defect-class suite and one consumer suite; TC-id ceilings re-verified in the delivered tree (maxima 047/007/113/034); no TODO rows, no blocking open questions |

## 10. Test Execution Log

| TC ID | Run Date | Result | Notes |
|-------|----------|--------|-------|
| — | — | — | Populated during the quality-gates phase; the pre-fix golden capture-entry run (TC-TELEMETRY-053 step 5) is recorded here as delivery-phase evidence; nothing executed at authoring time |
