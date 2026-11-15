# Readiness Review Iteration 2

Verdict: NOT_READY
Work Item: GH-301
Date: 2026-11-15
Pause Required: no

Reviewed artifact set: `chg-GH-301-spec.md` v1.1, `chg-GH-301-test-plan.md` v1.1, `chg-GH-301-plan.yaml` revision 1.1, `chg-GH-301-pm-notes.yaml`, `readiness-review/readiness-iter-1.md`, ADR-0011 and `doc/decisions/00-index.md`, ticket GH-301 / backlog M2-S8, the M2 scenario seeds, and repository truth (`.ai/memory/**`, `packages/core/src/{contracts,domain}`, `packages/adapters/src/{file,io}`, `scripts/checks/**`, `tests/**`, `doc/templates/**`, `doc/planning/concepts/memory-architecture.md`).

Evidence probes run at HEAD: `git ls-files .ai/memory` = 10 files; `git ls-files --error-unmatch doc/decisions/ADR-0011-canonical-memory-record-schema.md` exits 0 and the `00-index.md` row resolves; `bun run scripts/checks/privacy-literals.ts` = 0 violations over 4,084 files; `bun run scripts/checks/forbidden-literals.ts` = 0 violations over 5 classes; `delivery-os plan validate GH-301` = `valid` / `readyForDevelopment=true`; the GH-302 guard's scan set/pattern and the three aggregate-string pins were read from source; `matrix-core-importer`, `DOCTOR_AREAS`, and the capsule `source: string` field were read from source.

## Facet Summary

- spec_completeness: FAIL
- ac_quality: FAIL
- plan_coverage: FAIL
- test_traceability: FAIL
- cross_artifact_consistency: FAIL
- decision_capture: PASS
- system_spec_consistency: FAIL
- plan_doc_update_coverage: PASS
- plan_code_area_coverage: PASS
- dod_defined: PASS

The revision is substantially better than v1.0: iteration-1 findings 1-8, 10, 12-20 are genuinely closed, and most of the requested verifications pass. The blocking defects are a closed-register hole for `source`, an unimplemented `scope: fleet` projection refusal, the narrowed guard scan missing from the DoD and the test plan, two test-plan assertions that contradict the plan's own architecture/wiring, and a spec claim about the concept document that no phase makes true.

## Iteration-1 Closure Verification

| # | Status | Evidence at HEAD |
|---|---|---|
| 1 | Closed | Phase 2 keeps the same three-tree walk and pattern (`tests/structure/memory-bootstrap-templates.test.ts:271-282`), permits only `packages/core/src/domain/memory-lint.ts`, and keeps the blanket `package.json` script-value assertion; phase 4 adds `scripts/checks/memory-lint.ts` and converts it to a sanctioned value. Both the evaluator (plan:610) and the guard (plan:618) are in phase 2 scope. The split is executable and cannot land red. |
| 2 | Closed | AC-F13-1 (spec:507) scopes zero-conflict to record files and each creator's own entry-point namespace; F-13 (spec:136) names the end-of-table index conflict; the ticket and seed SC-M2-S8-02 only claim record files. |
| 3 | Closed | TC-MEMCONC-001 (test plan:1341-1360) pins the complete conflicted path set to `[".ai/memory/README.md"]`, applies the scripted union, asserts two new rows, and adds a take-ours non-vacuity control. Consistent with AC-F13-1/2. |
| 4 | Closed | F-6 (spec:129), AC-F6-1 (spec:460), Appendix A (spec:627), plan 2.3/OQ-TP-2 (plan:544-552), and TC-MEMDATE-001 (test plan:810-841) all classify an absent `created` as `memory.schema.keys-missing` only. |
| 5 | Closed | TC-MEMDATE-001 has one unambiguous row per classification and no conditional branch; the absent row explicitly expects zero `memory.dating.*` findings. |
| 6 | Closed | No "outside every secret scan" claim remains (grep over all three artifacts). §2.1 (spec:49), GAP-9 (spec:64), §20 (spec:578) and §21 (spec:583) now state that the whole-tree guard enumerates every tracked file and already covers the 10 memory files. |
| 7 | Closed | §6 (test plan:1662-1668) assembles tokens at runtime from non-matching fragments; TC-MEMSECRET-001 steps 6-8 (test plan:1284-1286) prove guard silence, no suppression marker, and repository-level corroboration. The only directory allowlist is `tests/fixtures/privacy-literals`, and `privacy-literals.ts` scans every tracked file (verified); the registry contingency is declared with its phase-scope requirement. |
| 8 | Closed | NFR-1 (spec:325), AC-NFR1-1 (spec:520), F-4 (spec:127), the plan's pinned determinism contract (plan:182-190), and TC-MEMNFR-001 (test plan:1490-1511) all define determinism at a fixed injected date with exactly one edge date read and no ambient clock in the pure evaluation. |
| 9 | Closed in spec/plan; test/DoD gap | F-14 (spec:137), DEC-12 (spec:403), AC-F14-1 (spec:514), and plan 2.0/4.5 (plan:495-518, 773-791) all retain the narrowed file-name sanction scan. The test plan and DoD-15 do not — see findings 3 and 4. |
| 10 | Closed | DM-3 (spec:257-267), AC-F9-2 (spec:481), Appendix A (spec:630), TC-MEMINDEX-002/003 (test plan:1059-1110), and plan 3.1 (plan:637-651) all declare U-1/U-2 and require the universe in each finding's detail; no rule identity outside the register. |
| 11 | Closed in original terms; new false clause | The "concept's richer keys survive as optional" claim is gone and dispositions are delegated to ADR-0011 D3 (spec:238, 660). The replacement sentence "a record copied from the concept validates" is false — see finding 7. |
| 12 | Closed | The 280-character statement and 120-character hint bounds are published in DM-1 (spec:228), DM-5 (spec:285-286, 294), and the plan (plan:136-145), and imported by the suites (test plan:418, 1065, 1678-1686). |
| 13 | Closed | Plan 1.7 (plan:377-388) requires the `EXECUTABLE_ALLOWANCES` row, lists every exported const name, and states that the row pins the export surface. The inventory rule was verified at `tests/structure/content-inventory.test.ts:2638-2699`, and existing contracts modules carry such rows. |
| 14 | Closed | Plan 4.6 (plan:792-808) names the TC-MEMDOCT-001 pinned string at `tests/structure/memory-bootstrap-templates.test.ts:252`, the matching `doc/templates/README.md` row, and the same-commit assertion rewrite. Verified both source strings. |
| 15 | Closed | §7 (test plan:1729) drops `packages/core/src/contracts/capsule.ts` as a changed home and drops the `ci-wiring.test.ts` update row; TC-MEMGATE-004 step 5 (test plan:788) aligns. Residual capsule `source` parity imprecision — see finding 8. |
| 16 | Closed | Plan 5.1 (plan:911-923) pins MUT-CAP-31..41. Verified MUT-CAP-39/40/41 pin `memory-promotion.ts` `underRoot`, `fs.exists`, and the `'$1"superseded"'` replacement; 31-38 pin `capsule-candidates.ts`. |
| 17 | Closed | `basis` is promotion-required and hand-authored-optional in DM-1 (spec:229), AC-F3-1 (spec:446), plan 5.1 (plan:897-900), TC-MEMWRITE-001 (test plan:553), and the TC-MEMSCHEMA-002 control (test plan:452). |
| 18 | Closed | The privacy-vocabulary structural type is declared in `packages/core/src/contracts/memory-record.ts` and injected at the edge (plan:124-135, 367-376); `matrix-core-importer` forbids core→adapters (`.dependency-cruiser.cjs:17-21`), and the edge asserts class equality. |
| 19 | Closed | TC-MEMWRITE-003 now names plan phase 6 (test plan:614); TC-MEMLAY-002 step 4 (test plan:293) and TC-MEMINDEX-002 step 4 (test plan:1072) use `row-unbacked`; no wrong-target identity is invented. |
| 20 | Closed | ADR-0011 is tracked, its `00-index.md` row resolves, status is `Proposed` with `decision_date: null`, phase 1 declares both paths (plan:472-473), and plan 7.4 forbids a delivery phase from editing the status (plan:1115). Stale header text — see finding 11. No AI acceptance was performed. |

Phase-scope check for the revised plan: every **new** file each phase creates is inside that phase's `files`/`folders` (phase 1's change-folder folder declaration also keeps the plan, test plan, pm-notes and this record committable). Plan-code-area coverage is therefore PASS; the residual defects are coverage/truth gaps, not silent out-of-scope staging.

## Findings

1. [critical] ac_quality / cross_artifact_consistency — `chg-GH-301-spec.md` Appendix A provenance row (spec:626-628), F-7/AC-F7-1 (spec:130, 467), AC-F2-2 (spec:439); `chg-GH-301-plan.yaml` 2.2/2.4 (plan:537-555); `chg-GH-301-test-plan.md` TC-MEMPROV-001 (test plan:901-902)
   Gap: the plan assigns `source` presence and shape to the **provenance** area, but the closed register has only `memory.provenance.evidence-missing`, `…evidence-shape-unknown`, and `…created-by-missing` — no source identity. An absent `source` (a required key per DM-1) and an out-of-channel `source` therefore cannot be reported in the provenance area without emitting an id forbidden by DM-4/Appendix A. TC-MEMPROV-001 step 1 hedges ("the matching provenance rule … as classified in the register") and step 2 demands exactly one **provenance** finding, which is unimplementable. AC-F2-2 also says any missing required key yields `memory.schema.*`, overlapping AC-F7-1's provenance ownership of `evidence`/`created_by`; the plan's partition is not stated in the ACs.
   Suggested remediation target phase: specification
   Suggested fix: declare the presence partition in the spec — absent `source` → `memory.schema.keys-missing`, out-of-channel `source` → `memory.schema.value-unknown` (both existing ids), with `evidence`/`created_by` staying in provenance — or add `source-missing`/`source-unknown` to Appendix A and AC-F7-1. Correct plan 2.2/2.4 and TC-MEMPROV-001 to the chosen classification.

2. [critical] plan_coverage — `chg-GH-301-plan.yaml` phase 5 obligations (plan:896-910; the only `fleet` mention is the pinned "stays candidate-only" line at plan:153-159), vs spec DM-1 `scope` row (spec:224), ADR-0011 D7 (ADR:317), and `chg-GH-301-test-plan.md` TC-MEMWRITE-004 (test plan:653-655)
   Gap: spec DM-1 and ADR-0011 D7 require a `lesson`/`tacit` candidate carrying `scope: fleet` to be refused at candidate-schema time through the existing capsule-invalid identity. No phase obligation implements that refusal and no test asserts it. The current writer accepts the candidate and renders `scope: "fleet"` (`capsule-candidates.ts:335-360`), which the schema's closed scope set rejects, so the promoted record violates AC-F3-1's "the invariant reports zero findings for that record".
   Suggested remediation target phase: delivery_planning
   Suggested fix: add the fleet-scope projection refusal to phase 5's `validateCandidate` obligation (refuse through `closeout.capsule-invalid`) and add the corresponding case to TC-MEMWRITE-004; do not widen the capsule contract.

3. [major] cross_artifact_consistency — `chg-GH-301-spec.md` §17.1 DoD-15 (spec:550) vs AC-F14-1 (spec:514), F-14 (spec:137), DEC-12 (spec:403), C-9 (spec:651), and the authoring-guidelines claim (spec:668)
   Gap: DoD-15's done condition and verification name only the positive presence assertion and the preserved boundary absences. They omit the narrowed negative file-name sanction scan that F-14/AC-F14-1/DEC-12/C-9 make the core of the replacement, while the authoring guidelines claim DoD-15 declares it. A delivery that implements presence plus absences and drops the sanction scan satisfies DoD-15 but fails AC-F14-1.
   Suggested remediation target phase: specification
   Suggested fix: add the narrowed sanction scan and its non-vacuity check to DoD-15's done condition and verification, exactly as AC-F14-1 states it.

4. [major] test_traceability — `chg-GH-301-test-plan.md` TC-MEMGUARD-001 (test plan:1419-1433) and §1.1 (test plan:38)
   Gap: TC-MEMGUARD-001 steps 1-5 assert only existence, both citations, and the three preserved absences. No step asserts the narrowed file-name scan over `scripts/`, `tools`, `packages/` permits only the sanctioned memory modules, and no mutant plants a stray `memory-doctor` or a second memory-lint component to prove non-vacuity. AC-F14-1 is marked "Covered", but the central protective assertion is untested; a regression deleting the scan would still pass the suite. §1.1 repeats the presence-plus-absences framing.
   Suggested remediation target phase: test_planning
   Suggested fix: add a step asserting the permitted-match set equals the sanctioned modules (check edge, pure evaluator, schema contract module), plus a temp-copy mutant that adds a second memory-named module and asserts the guard fails; update §1.1.

5. [major] cross_artifact_consistency — `chg-GH-301-test-plan.md` TC-MEMGATE-003 step 3 (test plan:754) and §4 (test plan:143) vs `chg-GH-301-plan.yaml` 4.1 (plan:742-746) and §7 (test plan:1722)
   Gap: the test plan puts `readFileSync`/`readdirSync` and the YAML-frontmatter parse in the check edge. The plan makes `packages/adapters/src/file/memory-scan.ts` "the only reader/parser" and §7 repeats that. A literal assertion that the edge owns the only fs usage fails against the planned scanner (or forces the scanner's reads into the edge, breaking the tier design and the plan's scope). The "edge owns every read" formulation is also inconsistent with NFR-4's "adapter/edge tier".
   Suggested remediation target phase: test_planning
   Suggested fix: state and assert the boundary as "the scanner adapter owns every file read and the YAML parse; the check edge owns the single ambient date read and printing; contracts/domain have no I/O".

6. [major] test_traceability — `chg-GH-301-test-plan.md` TC-MEMGATE-004 step 3 (test plan:786) vs `chg-GH-301-plan.yaml` 4.3 (plan:759-763)
   Gap: the step requires both surfaces to "use the identical command string". Plan 4.3 makes the aggregate cite `pnpm check:memory` while CI cites `bun run scripts/checks/memory-lint.ts`; the raw strings can never be identical. The parity test must resolve the `check:memory` indirection, which step 1 already acknowledges.
   Suggested remediation target phase: test_planning
   Suggested fix: assert `scripts.check` contains `pnpm check:memory`, `scripts["check:memory"]` equals `bun run scripts/checks/memory-lint.ts`, and the CI `ts-invariants` step cites that same path; compare the resolved invocation, not the raw strings.

7. [major] system_spec_consistency — `chg-GH-301-spec.md` F-2 (spec:125) and DM-1 concept-key row (spec:238) vs ADR-0011 D3 (ADR:290-313) and the plan's lifecycle-phase-7 handoff (plan:288-293)
   Gap: the spec says the concept reconciles key by key "so a record copied from the concept validates". That is false for the concept's current Record model: ADR D3 renames `valid_from` and `trust`, narrows `source` and `applies_when`, and rejects `rationale` and the evidence list, so a verbatim copy still produces key-unknown, value-unknown, and shape findings. The ADR says the concept is reconciled "after GH-301", but the plan limits the concept doc to status/implementation notes, and neither spec §7.1 nor §16 lists the record-model reconciliation.
   Suggested remediation target phase: delivery_planning
   Suggested fix: add "rewrite the concept's Record model example to the D2/D3 contract (without touching the Bootstrapping section, whose guard TC-MEMALIGN-001 pins)" to the phase-7 handoff and declare the file; alternatively, soften the spec/ADR claim to "the concept's intent is fully expressible" and record the concept's example as historical.

8. [minor] cross_artifact_consistency — `chg-GH-301-test-plan.md` TC-MEMSCHEMA-001 step 4 (test plan:389) vs §7 not-a-changed-home (test plan:1729) and `packages/core/src/contracts/capsule.ts:415`
   Gap: step 4 asserts the capsule's `source` equals the schema's four-value channel set, but the capsule contract exposes no source vocabulary (`readonly source: string`) and is explicitly read for parity only; the tightening is validation in `capsule-candidates.ts`. As written the parity assertion has nothing to compare against.
   Suggested remediation target phase: test_planning
   Suggested fix: assert the capsule validator accepts exactly the four channels and refuses a fifth (behaviour in `validateCandidate`), or add a capsule source constant and scope it in phase 5.

9. [minor] cross_artifact_consistency — `chg-GH-301-test-plan.md` §7 row (test plan:1697) vs `chg-GH-301-plan.yaml` phase 4 test obligations (plan:825-826) and TC-MEMSCHEMA-003's location (test plan:472)
   Gap: §7 maps TC-MEMSCHEMA-003 to `tests/checks/memory-lint-schema.test.ts` (phase 2 scope), while the plan lands the whole-tree block in `tests/structure/memory-record-schema.test.ts` (phase 4 scope). Following §7 makes a phase-4 tracked edit outside that phase's declared scope and contradicts the phase-4 "atomic commit set is complete as declared" claim.
   Suggested remediation target phase: test_planning
   Suggested fix: move TC-MEMSCHEMA-003's §7 row to the structure file (or add the checks schema file to phase 4 scope).

10. [minor] cross_artifact_consistency — `chg-GH-301-test-plan.md` TC-MEMNFR-004 (test plan:1600, 1605) vs `chg-GH-301-plan.yaml` 6.4 (plan:1041-1053)
    Gap: the test's step 1 enumerates the new `doc/spec/features/feature-memory-lint.md`, but that doc is a lifecycle-phase-7 handoff and does not exist at phase 6, its owning plan phase; plan 6.4 correctly says the delivery adds no user-facing doc. The test as written cannot run at phase 6.
    Suggested remediation target phase: test_planning
    Suggested fix: have TC-MEMNFR-004 assert the delivery-time state (registry unchanged, no new user-facing doc) and leave the new spec's registration to the phase-7 handoff and a post-landing guard run; note that explicitly in the test.

11. [minor] cross_artifact_consistency — `chg-GH-301-plan.yaml` header (plan:146-152) vs repository truth
    Gap: the header says ADR-0011 is "untracked, uncommitted" and "the index currently links a file that does not exist". At HEAD the file is tracked (`git ls-files --error-unmatch` exits 0), the `00-index.md` row resolves, and the tree is clean. Phase 1 obligation 1.8 handles this correctly, so delivery is unaffected, but the current-state statement is false and contradicts the pm-notes.
    Suggested remediation target phase: delivery_planning
    Suggested fix: restate the header as "must be tracked; at this revision it is already committed — verify and edit nothing", keeping the phase-1 verification.

12. [minor] spec_completeness — `chg-GH-301-spec.md` F-9 (spec:132) and the DM-4 severity row (spec:276) vs DM-5 (spec:286, 292), AC-F9-2 (spec:481), and AC-F10-1 (spec:487)
    Gap: F-9 says an empty hint is "malformed", but DM-5/Appendix A/AC-F9-2/plan 3.1/TC-MEMINDEX-002 distinguish `memory.index.hint-missing` (empty) from `memory.index.row-malformed` (over-long); and DM-4 says "every area is `error` except the derivable heuristics and an expired revalidation window", omitting the `memory.budget.kernel-lines` warn band (201-220) whose id is an error above 220. The summaries contradict the detailed register and the plan.
    Suggested remediation target phase: specification
    Suggested fix: align F-9 and DM-4 with DM-5/Appendix A/AC-F9-2/AC-F10-1: empty hint → `hint-missing`; over-long → `row-malformed`; `memory.budget.kernel-lines` is warn in the 201-220 band and error above 220.

## Reopening

Reopen `specification` first (findings 1, 3, 12), then `test_planning` (4, 5, 6, 8, 9, 10), then `delivery_planning` (2, 7, 11). Findings 1 and 2 also require consequential plan/test edits to the chosen classification and refusal. No finding reopens `delivery`.

The defects are independent and the artifact set is close: the split guard, concurrency boundary, absent-date classification, privacy-scan truth, runtime-assembled fixtures, determinism, two-universe coverage, published bounds, inventory allowance, mutant pins, and ADR landing are all verified correct. Iteration 3 should converge if the source/fleet/guard-test issues and the two test-plan architecture assertions are fixed.
