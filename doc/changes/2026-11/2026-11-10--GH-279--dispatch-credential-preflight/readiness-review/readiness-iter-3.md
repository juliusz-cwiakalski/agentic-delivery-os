# Readiness Review Iteration 3

Verdict: READY
Work Item: GH-279
Date: 2026-11-10
Pause Required: no

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

## Iteration 2 Findings — Disposition

| # | Iteration-2 finding | Disposition |
|---|---|---|
| 1 | [critical] AC-F1-8 had no test case anywhere; coverage counts were false | **Fixed.** AC-F1-8/F-1.10 are gone from every live artifact. The §3.1 forward table runs AC-F1-7 → AC-F2-1, the backward table and §5.1/§5.2/§7 carry no row for it, plan Phase 4 `tcCoverage` has no placeholder, and the live counts are 30 ACs / 61 TCs. |
| 2 | [major] AC-F1-8 was unsatisfiable against the delivered composition | **Fixed.** The requirement is removed rather than restated. The pre-existing composition-level refusal is recorded once as unchanged current-state behaviour (spec §2.1) and no criterion, TC, or plan verification asserts it. |
| 3 | [major] TDR-0019 narrowed the result error-kind union to `provider` only | **Fixed.** TDR-0019 now admits the existing `provider` **and** `config` kinds additively in its summary, C-3, the union FACT row, decision points 4 and 9, the implementation plan, the constraint attestation, and the references; `DOMAIN_KINDS` membership and the error-table row count are stated unchanged. |
| 4 | [major] Plan Phase 4 asserted the no-repository-target refusal inside the doubles suite | **Fixed.** The assertion is gone. The plan records the refusal at the composition layer it belongs to and states that the dispatch ports receive an already-resolved target, so no ports-driven double can produce the branch. |
| 5 | [minor] Test plan §3.2 / TC-READMAP-008 said `provider` only | **Fixed.** Both now state `provider` and `config` additively; TC-READMAP-008 also classifies `config.credential.missing` as `kind: "config"` with its own row. |
| 6 | [minor] TC-DIVREC-011 cited the non-existent F-4.10 | **Fixed.** The §3.1 backward table, §5.1, the scenario's Related IDs and its Notes cite F-4.4/F-4.6; no live artifact names F-4.10. |
| 7 | [nit] Phase 2 / TC-REG-004 asserted a contract-inventory delta | **Fixed in the plan, residual in the test plan.** Plan Phase 2 and Phase 7 now assert the name-level inventory is unchanged because the declaration is field-level and adds no exported type name. The test plan still carries the opposite wording — see advisory A1. |

## Requested Verification Checklist

| Check | Result |
|---|---|
| 1. AC-F1-8 / F-1.10 removed everywhere live | **PASS.** Only the spec v1.3 history row and the prior readiness records mention them; the spec v1.4, test plan v1.3, plan, and PM record do not. |
| 2. TDR-0019 admits `provider` and `config` | **PASS.** Verified in the summary, C-3, FACT row, decision points 4 and 9, implementation plan, constraint attestation, and references. |
| 3. Test plan no longer says provider-only; TC-DIVREC-011 cites F-4.4/F-4.6 | **PASS.** §3.2 "Port contract", §3.3 NFR-8, the §3.1 AC-F2-5 row, and TC-READMAP-008 all say `provider` and `config`; TC-DIVREC-011 cites F-4.4/F-4.6. |
| 4. Plan has no no-repository-target assertion or inventory delta; coverage is 30/61 with only the documented exceptions | **PASS.** Plan `acCoverage` expands to 30 distinct ACs (AC-F5-4 in Phases 7 and 8); `tcCoverage` expands to 61 distinct TCs (TC-REG-002 in Phases 2 and 8); no other duplicate and no dangling identifier. |
| 5. Composition-level repository-target refusal stated once as unchanged behaviour | **PASS.** Spec §2.1 is the single requirement-bearing statement; the plan's delivery-pin note only scopes it out of the preflight. Verified against `packages/cli/src/production.ts` (`run` refuses with `input.value.rejected` / `repository identity is unresolvable` before `createDispatchCommandRuntime`) and `DispatchPorts.repository: string`. |
| 6. Traceability tables agree | **PASS.** Forward table AC set is identical to the spec's 30 ACs; the backward table, scenario index, and §7 each cover all 61 TCs; plan `acCoverage`/`tcCoverage` match test-plan §7 phase-by-phase apart from the descriptive Phase 3 annotation (A2). |

## Findings (non-blocking advisories)

1. [minor] cross_artifact_consistency — `chg-GH-279-test-plan.md` §3.2 "Port contract" row (line 171), TC-REG-004 steps/expected (lines 1874, 1878), §6 "Contracts pinned" (line 1922), fixture work list (line 2017), TR-6 (line 2064), and the reference row (line 81)
   Gap: The test plan still says `tests/fixtures/ports/v1-contract-inventory.json` "moves by exactly the additive declarations" and that TC-REG-004 diffs in the "new preflight declarations", while plan Phase 2 and Phase 7 (and the plan's delivery pins) now assert the name-level inventory is **unchanged** because the preflight port and widened union add no exported type name. A coder following the test plan would write an assertion that fails against the plan's stated implementation shape (or vice versa).
   Suggested remediation target phase: test_planning
   Suggested fix: Rewrite TC-REG-004 and the four supporting mentions to assert an empty name-level inventory delta (the addition is field-level), or name the concrete new export if one is intentionally introduced; align with plan Phase 2/Phase 7.

2. [nit] cross_artifact_consistency — `chg-GH-279-test-plan.md` §7 "Plan phase mapping", Phase 3 row (line 1999)
   Gap: The Phase 3 row lists "TC-READMAP-004/006/007 holding the read halves", while plan Phase 3 `tcCoverage` gives TC-READMAP-010 the sole Phase 3 home and plan Phase 4 owns TC-READMAP-001…009. Read literally, the column assigns three Phase 4 cases to Phase 3, which cannot pass before the engine classification lands.
   Suggested remediation target phase: test_planning
   Suggested fix: Reword to "TC-READMAP-010 (Phase 3); its engine-side read halves TC-READMAP-004/006/007 are declared by Phase 4", or drop the descriptive IDs from the phase column.

3. [nit] ac_quality — `chg-GH-279-spec.md` §5.1 F-2.4 (line 182)
   Gap: F-2.4 says the malformed-2xx discriminator may be "that stamp, … an equivalent additive optional discriminator on the failure, or … a probe that classifies the payload before normalization", calling the mechanism a delivery choice, while AC-F2-6, NFR-13, §8.1, Appendix A, plan Phase 3, and TC-READMAP-004/010 fix the observable as `httpStatus: 200` status-present. A non-stamp discriminator would satisfy F-2.4's "distinguishable" but fail AC-F2-6/NFR-13.
   Suggested remediation target phase: specification
   Suggested fix: State that the chosen and required mechanism is the received-2xx stamp (status-present), or relax AC-F2-6/NFR-13 to "provably distinguishable" — the stamp is what the plan and tests pin, so aligning F-2.4 to it is the smaller change.

4. [nit] test_traceability — `chg-GH-279-test-plan.md` TC-DIVREC-011 Related IDs (line 1493)
   Gap: The scenario cites F-4.8 (the attempt's bounded `last_message`) although the orphan direction produces no attempt record; the relevant demands are F-4.4 and F-4.6, which the backward table and Notes already cite correctly.
   Suggested remediation target phase: test_planning
   Suggested fix: Drop F-4.8 from the Related IDs, or add an explicit assertion that the failure surface names the underlying identity.

5. [nit] cross_artifact_consistency — `chg-GH-279-pm-notes.yaml` dated note at line 113
   Gap: The note says "Test plan finalized with 58 TCs" while the plan and test plan now carry 61. It is a dated historical note, so it is not a live coverage claim.
   Suggested remediation target phase: delivery_planning (PM record hygiene; no artifact change required)
   Suggested fix: Append a later note recording the 61-TC final count at the next PM record append, or leave the dated note as history.

## Verdict Basis

Every iteration-2 blocker is genuinely fixed and the fixes are internally consistent. The AC-F1-8 removal is complete: the live acceptance-criteria set is exactly 30, the test plan's forward table equals the spec's set, and no removed behaviour survives in a live requirement, scenario, mapping, or plan phase. TDR-0019 now agrees with the spec, plan, and test plan on the additive `provider` **and** `config` union, which is the load-bearing decision for the credential refusal and the provider rows. The composition-level repository-target refusal is stated once as unchanged current-state behaviour and is not asserted as a preflight requirement; the code confirms the composition refuses before the runtime is composed and that `DispatchPorts.repository` is a required string. Plan coverage is exact (30 distinct ACs with the documented AC-F5-4 two-half split; 61 distinct TCs with the documented TC-REG-002 two-phase split), and `delivery-os plan validate GH-279` returns `verdict=valid`, `readyForDevelopment=true`.

The remaining issues are documentation nits that cannot make delivery unsafe or make a required ticket behaviour untestable: a stale test-plan inventory-delta wording that contradicts the corrected plan, a descriptive Phase 3 annotation, one hedged F-2.4 sentence, one over-broad Related IDs citation, and a dated PM note. None changes a requirement, a refusal identity, a side-effect assertion, or the testability of the five ticket requirements. Delivery may proceed; A1 should be settled in favour of the plan's "inventory unchanged" position when the coder writes TC-REG-004.
