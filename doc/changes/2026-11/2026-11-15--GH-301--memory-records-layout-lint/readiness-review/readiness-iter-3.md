# Readiness Review Iteration 3

Verdict: NOT_READY
Work Item: GH-301
Date: 2026-11-15
Pause Required: no

Reviewed artifact set: `chg-GH-301-spec.md` v1.2, `chg-GH-301-test-plan.md` v1.2, `chg-GH-301-plan.yaml` revision 1.2, `chg-GH-301-pm-notes.yaml`, `readiness-review/readiness-iter-1.md`, `readiness-review/readiness-iter-2.md`, `doc/decisions/ADR-0011-canonical-memory-record-schema.md` and `doc/decisions/00-index.md`, ticket GH-301 / backlog M2-S8, and repository truth (`packages/core/src/{contracts,domain}`, `packages/adapters/src/{file,io}`, `tests/structure/**`, `scripts/checks/**`, `.ai/memory/**`, `doc/planning/concepts/**`, `doc/templates/**`, `package.json`, `.github/workflows/ci.yml`).

Evidence probes at HEAD (`feat/GH-301/memory-records-layout-lint`, clean tree): `delivery-os plan validate GH-301` = `valid` / `readyForDevelopment=true`; `git ls-files --error-unmatch doc/decisions/ADR-0011-canonical-memory-record-schema.md` exits 0 and the `doc/decisions/00-index.md:23` row resolves; 30 AC ids in the spec equal 30 AC ids in the test-plan matrix; 40 `#### TC-` definitions equal 40 TC ids in the coverage matrix with zero orphans and zero duplicates; `DOCTOR_AREAS` is exactly five (`packages/core/src/contracts/doctor.ts:19`); `CAPSULE_CANDIDATE_SCOPES` still declares `fleet` (`capsule.ts:137`) and the class-level `fleet` rejection is present (`capsule-candidates.ts:318-319`); `validateCandidate` (`capsule-candidates.ts:56`) validates `source` only as a non-empty string and **no** four-channel constant exists anywhere in source (zero grep hits for `review_verdict|ci_verdict|human_correction|merged_pr` under `packages/**/src`); the capsule contract exposes `readonly source: string` (`capsule.ts:415`); the delivered guard walk skips `node_modules`, `dist`, `.tests` (`tests/structure/memory-bootstrap-templates.test.ts:266`); the concept Record model is at `doc/planning/concepts/memory-architecture.md:79` and the pinned Bootstrapping section at `doc/planning/concepts/memory-practices.md:117` (read by TC-MEMALIGN-001 via `section(conceptText, "## Bootstrapping a project")`); the aggregate `check` chain matches plan 4.3's insertion point and the CI `ts-invariants` step lists one `bun run scripts/checks/<check>.ts` per line; `git ls-files .ai/memory` = 10 files including `tacit/.gitkeep`.

## Facet Summary

- spec_completeness: PASS
- ac_quality: PASS
- plan_coverage: PASS
- test_traceability: PASS
- cross_artifact_consistency: FAIL
- decision_capture: PASS
- system_spec_consistency: PASS
- plan_doc_update_coverage: PASS
- plan_code_area_coverage: PASS
- dod_defined: PASS

Iteration-2 findings 1, 3, 12 (specification) and 4, 5, 6, 8, 9, 10 (test planning) are closed on content, and 2, 7, 11 (delivery planning) are closed as declarations. The two blocking defects below are phase-placement contradictions: one introduced by the iteration-2 finding-8 fix (a phase-5 behaviour asserted in a phase-1-owned suite) and one older step that asserts the phase-4 check edge from a phase-3-owned suite. Everything else asked for in this iteration verifies against source, not against revision notes.

## Iteration-2 Closure Verification

| # | Status | Evidence at HEAD |
|---|---|---|
| 1 | Closed | The presence partition is stated identically in F-5 (spec:128), F-7 (spec:130), AC-F2-2 (spec:439), AC-F7-1 (spec:467), DoD-8 (spec:543) and Appendix A (spec:635): `source` is schema-owned (absent → `memory.schema.keys-missing`, out-of-channel → `memory.schema.value-unknown`), `evidence`/`created_by` are provenance-owned, the partition is exhaustive and disjoint, and the register gains no id. Plan 2.2 (plan:669-683) and TC-MEMPROV-001 rows 5-6 (test plan:912-913, "zero `memory.provenance.*` findings") match. Exhaustiveness holds over the ten-key spine with no overlap. |
| 2 | Closed as a declared obligation | Plan 5.1 (plan:1110-1125) refuses `scope: fleet` on a `lesson`/`tacit` candidate at candidate-schema time in `validateCandidate` through the existing `closeout.capsule-invalid` detail path; `CAPSULE_CANDIDATE_SCOPES` keeps `fleet` (no contract widening, no new `closeout.*` code), and the class-level `fleet` rejection is preserved. TC-MEMWRITE-004 steps 3-6 (test plan:657-660) and phase-5 done-when (plan:1183-1187) carry it. The refusal is implementable in the current `validateCandidate` shape (`capsule-candidates.ts:56-160`, returns `{ok:false, detail}` mapped by closeout). |
| 3 | Closed | DoD-15 (spec:550) declares all three parts — presence + both-gate citation, one narrowed file-name sanction scan with the permitted-match set limited to the three sanctioned modules and a planted-unsanctioned-match mutant, and the preserved absences — plus a non-vacuity assertion that the set is non-empty and equals the sanctioned set. The authoring-guidelines paragraph (spec:671) now describes exactly that scope. Matches AC-F14-1 (spec:514), F-14 (spec:137), C-9 (spec:651), DEC-12 (spec:403). |
| 4 | Closed | TC-MEMGUARD-001 (test plan:1422-1463) is the three-part test: step 3 asserts the permitted-match set **equals** the three-path sanctioned set in both directions, step 4 asserts non-vacuity (raw pattern matched the edge and the evaluator; the contracts path is the only declared non-pattern member), step 5 plants two temp-copy mutants (`packages/core/src/domain/memory-doctor.ts`, `scripts/checks/memory-lint-extra.ts`), step 6 the sanctioned script value, steps 7-9 the preserved absences. §1.1 (test plan:33) carries the same framing. |
| 5 | Closed | TC-MEMGATE-003 step 3 (test plan:760) and §4 (test plan:143) now state the plan's boundary: the scanner adapter (`packages/adapters/src/file/memory-scan.ts`) owns every read and the YAML parse; the check edge owns the single ambient date read and printing; contracts/domain do no I/O. Plan 4.1/4.2 (plan:897-918) and §7 (test plan:1748-1749) repeat it. |
| 6 | Closed | TC-MEMGATE-004 step 3 (test plan:793) compares the **resolved** invocation: `scripts.check` contains `pnpm check:memory`, `scripts["check:memory"]` equals `bun run scripts/checks/memory-lint.ts`, and the CI `ts-invariants` step cites that path. OQ-TP-1 (test plan:1789) is closed against plan 4.3 (plan:919-939). The current aggregate chain and CI step shape confirm the plan's citation model. |
| 7 | Closed as a declared obligation, correct file and fence | Plan phase 6 rewrites the `## Record model` frontmatter example of `doc/planning/concepts/memory-architecture.md` to the ADR-0011 D2/D3 contract (plan:303-326, 1296-1329) and the file is declared in phase-6 scope (plan:1371). The untouched section is correctly identified as the `## Bootstrapping a project (adoption checklist)` section of `doc/planning/concepts/memory-practices.md`, pinned by TC-MEMALIGN-001 (verified at `tests/structure/memory-bootstrap-templates.test.ts:291-292`), and that file is edited by no phase. The rewrite's key list covers every disposition that would otherwise make a copied record invalid (`created`, scalar `source`, one shaped evidence link, no `rationale`, `T0`-`T5` trust, scalar `applies_when`, no record `fleet`); `supersedes: []` and the accepted-optional `confidence`/`evaluation` survive unchanged. |
| 8 | Content closed; new phase defect | TC-MEMSCHEMA-001 step 4 (test plan:390) no longer invents a capsule source constant; it asserts the overlap structurally and routes the source refusal to `validateCandidate`/TC-MEMWRITE-004, and §7 keeps `packages/core/src/contracts/capsule.ts` read-only (test plan:1755). The content is right, but the behavioural clause is misplaced in a phase-1-owned TC — finding 1. |
| 9 | Closed | TC-MEMSCHEMA-003 is homed in `tests/structure/memory-record-schema.test.ts` (whole-tree block, plan phase 4) in the body (test plan:473, 482) and §7 (test plan:1723); plan 4 (plan:1013-1016) and the phase-4 scope (plan:1074) agree. `tests/checks/memory-lint-schema.test.ts` is explicitly not its home. |
| 10 | Closed | TC-MEMNFR-004 (test plan:1606-1642) asserts delivery-time state only: registry unchanged, no new user-facing `doc/**` doc, markers intact, zero drift; `doc/spec/features/feature-memory-lint.md` is named as the lifecycle-phase-7 handoff verified by a post-landing guard run. Matches plan 6.4 (plan:1279-1295) and plan 6.6/6.4's no-new-doc statement. |
| 11 | Closed and verified | Plan header (plan:228-236) states ADR-0011 MUST be tracked, is already committed at this revision, and that phase 1 verifies and edits nothing (obligation 1.8, plan:517-530). At HEAD the file is tracked, the `00-index.md` row resolves, and `plan validate` is green. |
| 12 | Closed | F-9 (spec:132) names an empty hint as `memory.index.hint-missing` and an over-long hint as `memory.index.row-malformed`; DM-4's severity row (spec:276) declares the `memory.budget.kernel-lines` band (`warn` above 200 and at or below 220, `error` above 220), matching DM-5 (spec:286, 292), AC-F9-2 (spec:481), AC-F10-1 (spec:487) and TC-MEMSCHEMA-004 step 3 (test plan:521). |

All twenty iteration-1 findings remain closed on spot probes (split guard, concurrency boundary, absent-date classification, privacy-scan truth, runtime-assembled fixtures, determinism at a fixed injected date, two-universe coverage, published bounds, inventory allowance, mutant pins, ADR landing, and the phase-4 pinned-string pair).

## Findings

1. [major] cross_artifact_consistency / test_traceability — `chg-GH-301-test-plan.md` TC-MEMSCHEMA-001 step 4 (test plan:390; location test plan:375; precondition test plan:382), introduced by the iteration-2 finding-8 fix (test plan:1804 history); `chg-GH-301-plan.yaml` TC ownership (plan:375) and phase-1 test obligation (plan:534-537) vs phase-5 writer obligation (plan:1106-1125) and phase-1 Verify (plan:565-568)
   Gap: step 4 unconditionally exercises `validateCandidate` to "accept exactly the schema's four channels and refuse a fifth". That behaviour lands in phase 5: `packages/core/src/domain/capsule-candidates.ts` is in phase-5 scope only (plan:1220), and today `validateCandidate` validates `source` as a non-empty string with no channel set (`capsule-candidates.ts:105-108`; zero four-channel literals exist in source). TC-MEMSCHEMA-001 is owned by phase 1 (plan:375) and phase 1 runs `bun test tests/structure/memory-record-schema.test.ts` in its Verify (plan:565-568), so the phase-1 boundary is red as written. The clause also exceeds its own AC: AC-F2-1 requires vocabulary parity "where they overlap", and the capsule exposes no `source` vocabulary (`capsule.ts:415`), so the behavioural source check is not an AC-F2-1 obligation. The step's own parenthetical says TC-MEMWRITE-004 owns the refusal path in full.
   Suggested remediation target phase: test_planning
   Suggested fix: restrict step 4 to the structural overlap (`trust` = `CAPSULE_CANDIDATE_TRUST`, the five evidence prefixes, the status subset, and the fact that no source constant exists) and leave accept/refuse behaviour entirely to TC-MEMWRITE-004 in phase 5; the plan already scopes a `tests/structure/memory-record-schema.test.ts` capsule block in phase 5 (plan:1177-1178). Alternatively move the whole TC to phase 5.

2. [major] cross_artifact_consistency — `chg-GH-301-test-plan.md` TC-MEMGATE-002 step 4 (test plan:728) vs `chg-GH-301-plan.yaml` phase-3 TC ownership (plan:378-380), phase-3 Verify (plan:859-862) and the check edge created in phase 4 (plan:904-918, scope plan:1064); TC-MEMNFR-001 step 3 (test plan:1522, phase 4)
   Gap: step 4 asserts "inject a counting date reader into the check edge and assert exactly one read per run". The check edge `scripts/checks/memory-lint.ts` does not exist until phase 4, while the TC is owned by phase 3 and phase 3 runs `tests/checks/memory-lint-output.test.ts` in its Verify. The assertion cannot pass at its owning phase, and TC-MEMNFR-001 step 3 already owns the identical proof in phase 4.
   Suggested remediation target phase: test_planning
   Suggested fix: delete step 4 from TC-MEMGATE-002 (keep step 3's throwing-clock domain proof and step 5's live determinism) and cross-reference TC-MEMNFR-001 step 3 for the single edge read; or reassign TC-MEMGATE-002 to phase 4.

## Non-Blocking Observations (fix in the same revision if convenient; none blocks delivery on its own)

3. [minor] cross_artifact_consistency — `chg-GH-301-test-plan.md` TC-MEMLAY-002 (test plan:271-302) vs §7 (test plan:1719) and plan phase-1 test obligation (plan:532-533)
   Gap: all four steps feed the pure coverage evaluation (phases 2-3), and the TC body names `tests/checks/memory-lint-index.test.ts`, but §7 maps the TC only to the phase-1 structure file. The coverage assertions have a phase-3 home, so no red boundary is forced, but the phase-1 obligation is not implementable as written.
   Suggested remediation target phase: test_planning
   Suggested fix: keep phase 1 to the structural placeholder/target rules (as TC-MEMLAY-001 already does) and move steps 1-4 into the index checks suite in phase 3, or split the TC.

4. [minor] cross_artifact_consistency — spec DM-6 row (spec:300) and DEC-5 (spec:396) still describe the capsule change as `source` only, while plan 5.1 (plan:1110-1125) and ADR-0011 D7 add the fleet-scope projection refusal. DM-1's `scope` row (spec:224) and the ADR declare the refusal, so delivery is not blocked; the reconciliation table and decision log were simply not swept.
   Suggested remediation target phase: specification
   Suggested fix: add the fleet projection refusal to DM-6 (as a projection-rule row) and to DEC-5's wording.

5. [minor] system_spec_consistency — spec §7.1 (spec:170-182), §16 (spec:406-424) and DoD-17 (spec:552) do not name the concept Record-model rewrite that plan phase 6 now carries to make F-2/DM-1's "a record copied from the concept validates" true. The plan declares the file and fence, so the claim is backed; the spec's own scope/components/DoD should list the obligation so the claim is traceable in the artifact that makes it.
   Suggested remediation target phase: specification
   Suggested fix: add the `doc/planning/concepts/memory-architecture.md` `## Record model` rewrite to §7.1, §16 and DoD-17, naming the untouched `## Bootstrapping a project` section of `memory-practices.md`.

6. [nit] cross_artifact_consistency — test plan §7 "Shared implementation homes" (test plan:1744-1755) omits `doc/planning/concepts/memory-architecture.md` (phase 6); TC-MEMGUARD-002 step 6 (test plan:1489) says "new check modules are registered in `tests/structure/inventory.json`" although the inventory covers `packages/**` only; plan phase 5 cites `OA-F3-1` (plan:1111) where the spec id is `AC-F3-1`; plan header (plan:146-149) says "documentation/boundary reconciliation in phase 6" while the boundary guard lands in phase 4; plan 7.2 (plan:1391-1397) names `memory-architecture.md` in the final alignment pass without declaring it in phase-7 scope (verification-only, so no edit is required).
   Suggested remediation target phase: delivery_planning
   Suggested fix: correct the four statements; no behaviour changes.

7. [nit] test_traceability — TC-MEMGUARD-001 step 3 (test plan:1446) and plan 4.5 (plan:947-949) specify the sanctioned scan walk without restating the delivered walk's `node_modules`/`dist`/`.tests` skips (`tests/structure/memory-bootstrap-templates.test.ts:266`). After `pnpm build`, `packages/*/dist/**/memory-lint.js` matches the pattern and would break set equality. Non-blocking because the existing helper carries the skips, but the test should pin them explicitly.
   Suggested remediation target phase: test_planning
   Suggested fix: state that the scan reuses the delivered skip set, and assert the scan set contains no `dist/` path.

## Residual Observations for the PR Gate (no artifact change required)

- The concept's `## Record model` sequence at `doc/planning/concepts/memory-architecture.md:116-118` still says preference records and per-agent memory "carry lighter headers"; after the phase-6 rewrite the typed preference record contradicts that sentence. It sits inside the phase-6 scope fence ("the example and its immediate prose"), so the delivering phase should reconcile it while rewriting the example; no test pins it.
- The promotion hint contract has one soft edge: DEC-7 forbids "truncating the statement", AC-F3-1 requires the hint be at most 120 characters with the statement as fallback, and TC-MEMWRITE-002 step 3 deliberately does not prescribe a clipping rule. A >120-character statement with no `applies_when` therefore requires a bounded fallback (clip or refuse); the test accepts a bounded non-empty outcome, so this is executable, but the delivery should state the chosen fallback behaviour in the phase evidence.
- Phase 4's `scripts/checks/memory-lint.ts` is a new check edge; `scripts/checks/script-surface.ts`'s `NAMED_CHECKS` may or may not need the new member (plan 4.3 says update only if the ordering assertion needs it). Confirm at the phase boundary rather than assuming no edit.
- `doc/decisions/ADR-0011` stays `Proposed` with `decision_date: null`; owner ratification or veto is the open-PR gate (R2), and no delivery phase self-accepts it (plan 7.4).

## Reopening

Reopen `test_planning` for blocking findings 1 and 2 (both are test-plan edits; no plan phase needs to move). Findings 3-7 are non-blocking advisories and can be folded into the same revision. No finding reopens `delivery`.

This is the third and final iteration of the readiness loop. The blocking residue is small and test-plan-local (one misplaced behavioural clause and one stale edge assertion); if the same gap persists after this revision, escalate to the human rather than looping. No finding is a stalemate of a previously closed item: finding 1 is a new consequence of the iteration-2 finding-8 fix, and finding 2 is surfaced by the full-set phase-availability re-check.
