# Readiness Review Iteration 4 (confirmation pass)

Verdict: READY
Work Item: GH-301
Date: 2026-11-15
Pause Required: no

Reviewed artifact set: `chg-GH-301-spec.md` v1.3, `chg-GH-301-test-plan.md` v1.3, `chg-GH-301-plan.yaml` revision 1.4, `chg-GH-301-pm-notes.yaml`, `readiness-review/readiness-iter-1.md` .. `readiness-iter-3.md`, `doc/decisions/ADR-0011-canonical-memory-record-schema.md` with its `doc/decisions/00-index.md` row, the ticket row `doc/planning/oss-tooling/backlog.md` "### M2-S8 Memory records, layout, and lint", and repository truth (`packages/core/src/contracts/{capsule,doctor}.ts`, `packages/core/src/domain/capsule-candidates.ts`, `tests/structure/inventory.json`, `tests/structure/content-inventory.test.ts`, `tests/structure/memory-bootstrap-templates.test.ts`, `doc/planning/concepts/memory-{architecture,practices}.md`, `doc/spec/features/feature-capsule.md`).

This is the confirmation pass on the iteration-3 remediation. Iteration 3 was the third and final round of the readiness cap (~3 iterations); no new remediation round is opened here. The pass answers exactly three questions: whether the two iteration-3 blocking findings are closed in the artifacts as they now stand, whether the same-revision sweeps introduced a new contradiction or version skew, and whether anything previously closed reopened.

## Evidence probes at HEAD (`feat/GH-301/memory-records-layout-lint`, clean tree)

- `delivery-os plan validate GH-301` -> `verdict=valid`, `artifact=yaml:chg-GH-301-plan.yaml`, `tier=full`, `readyForDevelopment=true`.
- Version identity: spec header/changelog end at v1.3; test plan frontmatter `version: 1.3` with a `1.3` revision-log row; plan header line 1 "revision 1.4" with a `1.4` revision-log entry. Plan SOURCES cite spec v1.3 (DM-6 projection rule, DEC-5) and test plan v1.3; the test plan header cites spec v1.3. No current-state citation points at a superseded revision; the remaining `v1.2` strings are historical provenance in revision logs and in rows that describe where a declaration came from.
- Traceability arithmetic: 30 AC ids in the spec equal 30 in the test-plan matrix, and the plan's AC-ownership block names the same 30 with no residue in either direction. 40 `#### TC-` definitions equal 40 scenario-index rows, 40 §7 mapping rows, and 40 distinct TC ids cited by the AC/DM/NFR matrices: zero orphans, zero duplicates, every AC row carries at least one TC.
- Plan TC-ownership arithmetic: 41 mentions for 40 distinct ids, with `TC-MEMLAY-002` counted once and attributed to two phase homes by step (`TC-MEMLAY-002` step 1 -> phase 1, steps 2-4 -> phase 3). The union of the per-phase lines equals the 40 definitions exactly.
- Source truth used by the edits: `CAPSULE_CANDIDATE_STATUSES = ["candidate","authoritative","superseded"]` (`packages/core/src/contracts/capsule.ts:140`) is a proper subset of the schema's five statuses (spec DM-1, `candidate/validated/authoritative/superseded/archived`), `CAPSULE_CANDIDATE_TRUST` is T0-T5 (`:143`), `CAPSULE_EVIDENCE_PREFIXES` exists (`:155`), `readonly source: string` (`:415`), and no four-channel constant exists in source; `tests/structure/inventory.json` top-level keys are the six package names only (`core`, `adapters`, `cli`, `mcp`, `opencode`, `testkit`); `ADR-0011` is tracked and `doc/decisions/00-index.md:23` resolves; the concept Record model sits at `doc/planning/concepts/memory-architecture.md:79` and the pinned bootstrapping checklist at `doc/planning/concepts/memory-practices.md:117` (read by the delivered `tests/structure/memory-bootstrap-templates.test.ts:292`).

## Facet Summary

- spec_completeness: PASS
- ac_quality: PASS
- plan_coverage: PASS
- test_traceability: PASS
- cross_artifact_consistency: PASS
- decision_capture: PASS
- system_spec_consistency: PASS
- plan_doc_update_coverage: PASS
- plan_code_area_coverage: PASS
- dod_defined: PASS

## Iteration-3 Blocking-Finding Closure

| # | Status | Evidence as the artifacts now stand |
|---|---|---|
| 1 | Closed | `TC-MEMSCHEMA-001` step 4 (test plan:391) is structural/parity-only: `trust` = `CAPSULE_CANDIDATE_TRUST`, the five evidence prefixes, the `status` subset, and the asserted **absence** of a capsule `source` vocabulary. It explicitly does not exercise `validateCandidate` and makes no four-channel accept/refuse claim. The precondition (test plan:384), the Expected Outcome (test plan:397) and the phase-1 obligation (plan:588-598) state the same. The assertion now matches AC-F2-1's "where they overlap" scope and is executable at phase 1: both vocabularies and the reconciliation table are phase-1 deliverables (plan phase-1 scope declares `tests/structure/memory-record-schema.test.ts`, plan:581-605), and the capsule target values exist in the delivered contract today. No phase-1-owned test asserts a phase-5 behaviour. |
| 1 (assertion preserved) | Closed, not deleted | The four-channel refusal is asserted in full by `TC-MEMWRITE-004` steps 1-2 (test plan:656-657: `source: "anecdotally"` -> exit 1 with `closeout.capsule-invalid`; each of the four channels accepted with a promotion decision) and re-stated in its Given/When/Then (test plan:647) and Expected Outcome (test plan:667). `TC-MEMWRITE-004` is phase-5-owned (plan:432, plan:1235-1243) and `packages/core/src/domain/capsule-candidates.ts` is phase-5 scope (plan:1296), so the proof sits in the phase that creates the behaviour. |
| 2 | Closed | `TC-MEMGATE-002` (test plan:724-729) has no counting date reader; its four steps are fixed-date repeat determinism, declared ordering, a throwing clock inside the pure evaluation, and live-tree repeat determinism. Its Notes (test plan:738) record the deliberate relocation. The phase-3 obligation matches (plan:917-921: "its clock proof here is the domain-side throwing clock, NOT a counting date reader"), and the phase-3 Verify command set (plan:934-937) no longer contains a step that needs the edge. |
| 2 (assertion preserved) | Closed, not deleted | `TC-MEMNFR-001` step 3 (test plan:1523) owns "pass a counting date reader to the edge and assert it is called exactly once per run, and that the value it returned is the value the pure evaluation used", with the scenario homed in phase 4 (plan:431) whose scope creates `scripts/checks/memory-lint.ts` (plan:1140) and whose obligations 4.1/4.2 make the edge own the single injected date read (plan:979-1011). |

The two fixes are therefore phase-placement corrections with the behaviour retained in the owning phase, not deletions of coverage. `TC-MEMLAY-002` (iteration-3 non-blocking observation 3) is likewise split, not shrunk: step 1 stays evaluator-free in phase 1, steps 2-4 stay in phase 3 (test plan:279, 289-294; plan:418-427, 581-587, 892-906).

## Sweep Verification (no new contradiction, no version skew)

- Spec v1.3 observation 4: DM-6 now carries the "Projection rule — non-projectable scope" row (spec:306) beside DM-1's `scope` row (spec:224), and DEC-5 restates the same refusal with "no new identity and no change to the candidate scope vocabulary" (spec:397). Both match plan 5.1 (plan:1185-1201), `TC-MEMWRITE-004` steps 3-6 (test plan:658-661) and ADR-0011 D7. `CAPSULE_CANDIDATE_SCOPES` keeps `fleet` in source today (`capsule.ts:137`), so the "no widening" claim is verifiable.
- Spec v1.3 observation 5: §7.1 (spec:180), §16 (spec:423) and DoD-17 (spec:554) all name the `memory-architecture.md` `## Record model` rewrite and the untouched `memory-practices.md` bootstrapping checklist; phase 6 declares the file in scope (plan phase-6 files) with an explicit scope fence (plan:1397-1405) and phase 7 verifies rather than authors (plan:1528-1530). Test plan §7's shared-homes entry (test plan:1756) matches, including "no test home is added for it" for `memory-practices.md`.
- Spec v1.3 observation 7: F-14 (spec:137) and C-9 (spec:655) pin the delivered skip set (`node_modules`, `dist`, `.tests`); `TC-MEMGUARD-001` step 3 (test plan:1447) reuses it and asserts the scan set contains no `dist/` path. The delivered walk's skips are present in `tests/structure/memory-bootstrap-templates.test.ts:266`, so the assertion is implementable and non-vacuous.
- Plan 1.3: the `OA-F3-1` typo is gone from the obligation text (only the revision-log entry mentions it); phase-5 citations now name DM-1 `scope`, the DM-6 projection row, DEC-5, AC-F3-1 and ADR-0011 D7; phase-7 wording is verification-only.
- Plan 1.4: `TC-MEMLAY-002`'s two-home split is reflected in the ownership block (plan:418-427), phase-1's obligation ("step 1 only"), phase-3's obligation ("steps 2-4", with the two coverage universes and `row-unbacked` pinned), and the test plan §7 row (test plan:1721). The id is counted once, so 40/40 holds and the AC-F1-2 matrix row is unchanged.
- Nothing previously closed reopened on spot probes: the presence partition (test plan:896 region, `TC-MEMPROV-001` rows 5-6), `TC-MEMGUARD-001`'s three-part replacement, `TC-MEMGATE-003`'s scanner/edge boundary, `TC-MEMGATE-004`'s resolved-invocation parity, `TC-MEMSCHEMA-003`'s phase-4 home, `TC-MEMNFR-004`'s delivery-time-only scope, `TC-MEMCONC-001`'s single conflicted path, the ADR-0011 tracking obligation, and the phase-6 concept fence all read as iteration 3 recorded them.

## Findings

None blocking.

## Residual Non-Blocking Observations (no artifact change required for READY; hand to the PR gate / reviewer)

1. [minor] cross_artifact_consistency — `chg-GH-301-test-plan.md` `TC-MEMGATE-004` step 4 (test plan:795) still says `tests/structure/inventory.json` lists "the check's exported entry". The inventory is a packages module list (top-level keys are the six package names; `PACKAGE_NAMES` in `tests/structure/content-inventory.test.ts:19`) and the plan puts exported entries in `EXECUTABLE_ALLOWANCES` (plan:787-788, 1096-1097). Same class as the iteration-3 nit 6 that was fixed in the sibling scenario (`TC-MEMGUARD-002` step 6, test plan:1490, is now correct). The executable reading is: inventory gains the `packages/**` module rows only, and the check's exported entry is proven by `TC-MEMGUARD-001` step 1. Correct opportunistically; do not add a `scripts` key to the inventory — it would break the inventory-equality suite.
2. [minor] plan_doc_update_coverage — the lifecycle-phase-7 handoff (plan:443-445) names `doc/spec/features/feature-capsule.md` for the record content and index-row description but not the row whose behaviour this change alters: `source` is "Required; non-empty" today (`doc/spec/features/feature-capsule.md:145`) and becomes the closed four-channel set, and the new scope-level `fleet` refusal is not named there (`:174`, `:193` describe only the class-level rejection). Spec §16 covers capsule reconciliation at capability level (spec:424), so the obligation exists; `@doc-syncer` must reconcile those two rows in phase 7.
3. [nit] cross_artifact_consistency — `TC-MEMWRITE-004`'s Target Location names two homes (`tests/behaviour/memory-promotion-schema.test.ts` capsule block and `tests/structure/memory-record-schema.test.ts`), while §7's row (test plan:1726) lists only the behaviour file. The plan's phase-5 obligation does name the structure capsule block (plan:1253-1254) and phase-5 scope declares the file, so the structure half has a declared home; the §7 row is simply narrower than the scenario.
4. [nit] cross_artifact_consistency — `TC-MEMGATE-001`'s precondition "a CLI entry for the live run" and step 4 "Run the check over the delivered tree" (test plan:688, 695) can be misread as needing the phase-4 script edge in a phase-3-owned scenario. The executable reading is the domain runnable returning `{ findings, summary, exitCode }` (phase-3 done-when already requires the delivered tree to evaluate, plan:926-933). Worth a one-line clarification at implementation, not a readiness condition.
5. [nit] cross_artifact_consistency — plan header (plan:191) still says "the documentation/boundary reconciliation in phase 6" although the negative-guard replacement lands in phase 4 and the split is stated explicitly in the PINNED IMPLEMENTATION CONTRACTS section (plan:187-215). The last unswept item of iteration-3 observation 6; wording only.
6. Carried from iteration 3, unchanged and still non-blocking: the concept's "carry lighter headers" prose at `doc/planning/concepts/memory-architecture.md:116-118` sits inside the phase-6 scope fence and should be reconciled while the example is rewritten; a statement longer than `HINT_MAX_CHARS` with no `applies_when` still requires a bounded fallback (clip or refuse) whose choice should be stated in the phase-5 evidence; `scripts/checks/script-surface.ts`'s `NAMED_CHECKS` membership must be confirmed at the phase-4 boundary rather than assumed; ADR-0011 stays `Proposed` with `decision_date: null` and owner ratification or veto is the open-PR gate (R2) — no delivery phase may self-accept it (plan 7.4).

## Reopening

None. No facet reopens a phase. Delivery may start on `feat/GH-301/memory-records-layout-lint` against spec v1.3, test plan v1.3 and plan revision 1.4.

The readiness cap is exhausted at this pass: iteration 3 was the final remediation round, and this confirmation pass closes the gate on the revised artifacts without opening a fourth remediation cycle. Any residual item above is a PR-gate or reviewer observation, not a readiness condition.
