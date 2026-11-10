# Readiness Review Iteration 2

Verdict: NOT_READY
Work Item: GH-279
Date: 2026-11-10
Pause Required: no

## Facet Summary
- spec_completeness: PASS
- ac_quality: FAIL
- plan_coverage: FAIL
- test_traceability: FAIL
- cross_artifact_consistency: FAIL
- decision_capture: FAIL
- system_spec_consistency: PASS
- plan_doc_update_coverage: PASS
- plan_code_area_coverage: PASS
- dod_defined: PASS

## Iteration 1 findings — disposition

| # | Finding | Disposition |
|---|---|---|
| 1 | AC-F2-6/F-2.4 malformed-2xx status-present vs transport status-absent | **Fixed.** F-2.4, AC-F2-6, NFR-13, §8.1 and Appendix A all state status-present for a malformed 2xx and status-absent only for the transport throw; test-plan §3.1/§6/§8.2 and TC-READMAP-004/007 match. |
| 2 | Phase 1 anchored grep, tracked-only assertions, planning scope reachability | **Fixed.** The anchored `^  > \*\*Amendment (GH-279` grep returns exactly 4 against the current file (verified); `git ls-files --error-unmatch` passes for all four decision paths; Phase 1 is declared verify-only/stages-nothing, consistent with the commit primitive mapping `delivery` to `kind: delivery` phases only. |
| 3 | Real adapter stamping TC + provider suite mapping | **Fixed.** TC-READMAP-010 drives the real client/normalizer, is mapped to `github-inputs.test.ts`/`github-trap.test.ts` in §7, and is assigned to plan Phase 3. |
| 4 | Trusted-refusal marker TC + error-classification mapping | **Fixed.** TC-CREDNAME-007 asserts the marked/unmarked pair plus the narrow-code control; `error-classification.test.ts` is mapped in §7 and Phase 4. |
| 5 | TC-DIVREC-008 asserted envelope fields the contract lacks | **Fixed.** Only `code`/`category`/`retryable`/`consequence`/`remediationHint`/`summary` are read off `data.error`; kind and projection move to the classification path. |
| 6 | Orphan divergence direction + TC-DIVREC-011 | **Fixed.** F-4.2/4.4/4.6, DEC-12, RSK-18, Appendix B and §22 state the orphan semantics; TC-DIVREC-011 covers it and is assigned to Phase 6. |
| 7 | Spec links TDR-0019; TDRs say four TDR-0015 assertions | **Fixed.** TDR-0019 is in `links.decisions`; TDR-0015 and TDR-0020 both state four assertions (three in §1, one in §5). |
| 8 | Phase 7 inventory removal | **Fixed.** The inventory is out of Phase 7 scope and Phase 7 now asserts the field through the type/contract check. |
| 9 | `config` kind in the union | **Partially fixed.** Spec, plan and AC-F2-5 fixed; TDR-0019 and test-plan TC-READMAP-008/§3.2 still say `provider` only (findings 3 and 5 below). |
| 10 | AC for the unresolvable target | **Fixed but introduces a new defect** (findings 1 and 2 below). |
| 11 | AC-F5-4 split | **Fixed.** AC-F5-4, §16 ownership note, plan Phase 7/8 `acCoverage` and test-plan §3.1/§7 all declare the two halves. |
| 12 | §16.1 ownership of the change record / MV-1 corroboration | **Fixed.** §16.1 assigns the change record and release note to the documentation phase; MV-1 requires artifact, tracker and CI corroboration (§18, plan Phase 8). |
| 13 | Test-plan front matter | **Fixed.** `implementation_plan` points at `./chg-GH-279-plan.yaml`. |

## Findings

1. [critical] test_traceability — `chg-GH-279-test-plan.md` §3.1 (forward and backward tables), §5.1/§5.2, §7, front-matter summary and §2; `chg-GH-279-plan.yaml` Phase 4 `tcCoverage`
   Gap: AC-F1-8 has no test case anywhere. The forward table jumps from AC-F1-7 to AC-F2-1, the backward table has no row for it, no scenario exists in §5, §7 maps nothing, and the plan's Phase 4 `tcCoverage` carries a placeholder — "the AC-F1-8 TC the test plan assigns" — that resolves to nothing. The plan's Phase 4 verification also asserts the case, so the delivery loop has an assertion with no scenario behind it. The covering claims are now false: the front matter and §2 say "30 acceptance criteria", and §3.1 says every criterion "appears exactly once"; the spec has 31.
   Suggested remediation target phase: test_planning
   Suggested fix: add one TC for the no-repository-target refusal (for example TC-READMAP-011) with its level, location, expected identity/kind/projection/exit and zero-request assertion; add the AC-F1-8 rows to §3.1 forward and backward, §5.1, §5.2 and §7 plus the plan-phase map; replace the plan's placeholder with the concrete TC id; correct the counts to 31 and the "exactly once" claim.

2. [major] ac_quality — `chg-GH-279-spec.md` §17 AC-F1-8; §5.1 F-1 item 10; §8.1; §8.3 DM-1; Appendix A; NFR-13
   Gap: AC-F1-8 is not satisfiable as written. Its Given clause ("a resolvable credential **and** a declared instance with no resolvable repository target") and its Then clause ("naming the unresolvable repository target") cannot both hold against the delivered architecture: the production composition resolves the repository target before the dispatch runtime is composed — and therefore before any preflight — and refuses with `input.value.rejected` / "repository identity is unresolvable" (`packages/cli/src/production.ts`, `run`), while `DispatchPorts.repository` is a required string, so a preflight can never observe an unresolvable target and there is no target name to report. The spec also places the refusal inside the preflight ("the preflight refuses immediately ... part of the preflight's admission contract") and Appendix A orders the row **after** credential resolution, which is the inverse of the delivered order. AC-F1-8 additionally cites DEC-7, which contains no such mapping.
   Suggested remediation target phase: specification
   Suggested fix: restate F-1.10/AC-F1-8 as the composition-level admission refusal that already exists (no preflight, no credential resolution, zero requests, zero sessions), drop the "given a resolvable credential" premise and the "naming the unresolvable target" requirement, move the row above the credential row in Appendix A, and cite the decision entry that actually covers it (a new decision item or DEC-11, not DEC-7).

3. [major] decision_capture — `doc/decisions/TDR-0019-dispatch-admission-credential-preflight.md` (summary, decision statement, C-3, "the only contract widening" paragraph, FACT row on the union) — **persistent (root cause of iteration-1 finding 9, fixed only in the spec/plan)**
   Gap: TDR-0019 states the `DispatchRunResult` error-kind union is widened additively to admit `provider` only, while spec F-2.5/DEC-7/NFR-8/AC-F2-5 and plan Phase 2 require `provider` **and** `config` (the credential refusal is a config-kind row and cannot leave the engine under the narrower union). A coder working from the primary decision record widens one member and the `config.credential.missing` refusal fails to typecheck or classifies as `fallback.internal`.
   Suggested remediation target phase: specification
   Suggested fix: correct TDR-0019 (via `@decision-advisor`) to admit the existing `provider` and `config` kinds additively and to repeat that `DOMAIN_KINDS` membership and the error-table row count are unchanged.

4. [major] plan_coverage — `chg-GH-279-plan.yaml` Phase 4 `verification` (the admission-read-mapping line)
   Gap: Phase 4 asserts the no-repository-target refusal inside `tests/behaviour/dispatch-admission-read-mapping.test.ts`, a suite that drives `runDispatch` over doubles where `ports.repository` is a required string; the refusal lives one layer above, in `production.ts` `run`. The assertion cannot be produced in that suite without a repository-resolution seam that no phase declares, so the phase gate can pass only by dropping the assertion.
   Suggested remediation target phase: delivery_planning
   Suggested fix: move the case to a composition/CLI-level suite already in Phase 4 scope (`tests/structure/dispatch-composition.test.ts`) or declare the injection seam, and state which layer refuses.

5. [minor] cross_artifact_consistency — `chg-GH-279-test-plan.md` §3.2 "Port contract" row and TC-READMAP-008 expected outcome
   Gap: Both still describe the widened engine union as admitting `provider` only, contradicting AC-F2-5, spec F-2.5 and plan Phase 2, which require the existing `config` kind as well.
   Suggested remediation target phase: test_planning
   Suggested fix: state that the union admits the existing `provider` and `config` kinds additively in both places.

6. [minor] test_traceability — `chg-GH-279-test-plan.md` §3.1 backward table, §5.1, TC-DIVREC-011 Related IDs and Notes, §9 revision log
   Gap: TC-DIVREC-011 cites "F-4.10" as its primary demand, but the spec's F-4 has items 1-9; the attempt-append-failure direction is stated in F-4.4 and F-4.6. The forward demand of the orphan TC therefore does not resolve to a spec requirement.
   Suggested remediation target phase: test_planning
   Suggested fix: cite F-4.4/F-4.6 in every place TC-DIVREC-011 names F-4.10 (or add the item to F-4 and update the other F-4 cross-references).

7. [nit] plan_coverage — Phase 2 verification and TC-REG-004 "the contract-inventory delta is exactly the additive preflight declarations"
   Gap: `tests/fixtures/ports/v1-contract-inventory.json` records exported names only, so a delta exists only if the preflight introduces new exported type names — the same argument the plan uses to keep the status field out of the inventory. Phase 2 names no new export, so the assertion is unsatisfiable if the port is declared with inline structural types.
   Suggested remediation target phase: delivery_planning
   Suggested fix: name the new exported type(s) the inventory is expected to gain, or state that no new exported name is introduced and drop the inventory-delta assertion.

## Verdict Basis

All seven blocking findings from iteration 1 are genuinely fixed, and the fixes are internally consistent (the discriminator pairing is now identical in F-2.4, AC-F2-6, NFR-13, §8.1, Appendix A, TC-READMAP-004/007/010 and §8.2; the append order and both failure directions are decided and tested; Phase 1 verification is executable against the committed tree; the marker, adapter-stamping and orphan paths each have a TC and a suite mapping). The remaining blocker is created by the AC-F1-8 fix: the new criterion has no test case and no traceability row while the test plan claims complete coverage, its Given/Then clauses cannot both hold against the delivered composition, and it is placed in the preflight and ordered after credential resolution in a layer that can never observe it. TDR-0019 also still narrows the union to `provider` alone, which contradicts the spec's `config` admission that the same fix introduced. These are documentation-and-plan edits, not design rework, but they must land before delivery.
