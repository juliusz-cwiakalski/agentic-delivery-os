# Readiness Review Iteration 3

Verdict: **NOT_READY**
Work Item: GH-310
Date: 2026-11-14
Pause Required: **yes — one human decision required**
Blocking issue: **documentation-only cross-artifact staleness (N6)**; no technical contract, scope, or coverage defect remains

Artifacts verified (read-only, against the text): `chg-GH-310-spec.md` v1.4, `chg-GH-310-test-plan.md` v1.4, `chg-GH-310-plan.yaml` revision 1.3, `chg-GH-310-pm-notes.yaml`; `readiness-review/readiness-iter-1.md` and `readiness-iter-2.md`; source ticket #310; `doc/planning/oss-tooling/milestones/m2/{contracts,architecture,test-scenarios}.md`; current truth in `doc/spec/features/{feature-plan-schema,feature-verify-gates,feature-closeout,feature-scheduling-engine,feature-project-groups,feature-result-contract}.md`; delivered `packages/core/src/contracts/{verify-gates,closeout,plan,projects}.ts`, `packages/core/src/domain/{verify-gates,queue-graph}.ts`, `packages/cli/src/commands/{verify-gates,verify,queue,closeout}.ts`, and `tests/types/tsconfig.json` / `package.json` typecheck wiring. No source, spec, test-plan, plan, or pm-notes file was modified; zero git operations.

## Facet Summary

| Facet | Result |
|---|---|
| spec_completeness | PASS |
| ac_quality | PASS |
| plan_coverage | PASS (37/37 ACs, 51/51 TCs owned) |
| test_traceability | PASS (37/37 ACs cited, 0 orphan TCs) |
| cross_artifact_consistency | **FAIL** (N6: test plan §2/§8.3 still describe plan revision 1.2 and open N2/N7/N8; plan 1.3 closes them) |
| decision_capture | PASS |
| system_spec_consistency | PASS |
| plan_doc_update_coverage | PASS |
| plan_code_area_coverage | PASS (all 39 §7 suite/type-test homes in phase scope) |
| dod_defined | PASS (DoD-1..15; DoD-5/DoD-8 aligned with the v1.4 rules) |

Requested additional rubric facets:

| Facet | Result |
|---|---|
| scope discipline | PASS (the scoped supersession is enumerated and type-confined) |
| risk coverage | PASS (RSK-10/RSK-11 present) |
| non-goals / supersession clarity | PASS |
| testability | PASS |
| decision pinning | PASS (N1/N3/N4/N5/N9/N10 text verified; two minor wording/edge notes below) |

## Mechanical Verification (current artifacts)

- Spec §17: **37 ACs** (`AC-F1-1..AC-NFR7-1`); test plan §3.1/§5.1 cites **37/37**.
- Test plan: **51 TCs**; 51 index rows = 51 detail headings = 51 §7 rows; §3.4 = 36 automated + 1 gate-only.
- Plan: **5 phases**; AC ownership 37/37 (6+7+13+4+7); TC ownership 51/51 (8+9+18+6+10). No unowned or double-owned ID.
- DM rows **11** (DM-1..DM-11); DEC rows **21**; RSK rows **11**; DoD rows **15**; Appendix A items **26**.
- Recomputed §7 suite/type-test homes independently: **39** unique paths = 38 `.test.ts` + 1 `.type-test.ts` (`tests/types/cross-repository-report.type-test.ts`). Every one is inside at least one phase's declared scope. The plan's revised 39/39 claim is accurate; the earlier 41 figure was wrong.
- `tests/types/tsconfig.json` exists, `pnpm typecheck` includes `pnpm exec tsc -p tests/types/tsconfig.json`, and `pnpm check` includes `pnpm typecheck`, so the new static probe runs in the gate.
- Plan phase 3 scope includes `tests/behaviour/cross-repository-determinism.test.ts` and the type-test; phase 2 includes the closeout-removal extension targets; phase 5 includes `plan-readonly.test.ts`, `verify-gates-read-budget.test.ts`, and the type-test. N2’s owning-phase mismatch is closed.
- Phase-5 commit subject is `test(GH-310): parity goldens, contract continuity and the full gate battery` (N7 closed).

## Iteration-2 Closure Audit (verified against text, not revision claims)

| Finding | Status and evidence |
|---|---|
| **N1** member verdict/status includes `gates.ci` | **Closed.** F-3/DM-2/DM-3/DEC-3: `pass` iff every record `pass` **and** `gates.ci: pass`; `fail` on any record `fail` or `gates.ci: fail`; otherwise `unknown`; `blocked` on any `fail`/`gates.ci: unavailable`/synthetic record; `incomplete` otherwise with a member `unknown`; `green` iff all `pass`. AC-F3-1..7 agree. TC-XDOD-003 deliberately omits a CI gate from `web`’s `gates` and still asserts `unknown`/`blocked`/`overall: fail`/exit 1, so the fixture cannot mask the bug. |
| **N3** synthetic unresolvable-gate citation | **Closed.** DM-9/AC-F3-7/TC-XDOD-008 pin `id`/`member`/`verdict: unknown`/`reason: read-failed`/`citation` = `identity:{changeRef}`, empty `sources`/`counts`/`names`, `reasons:["read-failed"]`, no provider source/name/branch/SHA. |
| **N4** distinct report types | **Closed.** DM-11: delivered `VerifyGatesReport` unchanged (`overall: "pass"`, `VerifyGateRecord[]` with no `member`, delivered envelope/exits); new `CrossRepositoryVerifyGatesReport` with `overall: "pass"\|"fail"`, `definitionOfDone`, `blockingMembers[]`, `reviewFlow`, `gates[]: CrossRepositoryVerifyGateRecord[]` (required `member`); union discriminated by `definitionOfDone`. F-3/DEC-18/§8.5 agree. TC-XPAR-003/TC-XCTR-007 + `tests/types/cross-repository-report.type-test.ts` assert static and runtime discrimination; the type-test is in phase 3/5 scope and runs via `pnpm check`. |
| **N5** closeout mode-scoped mapping | **Closed.** F-5/DM-5/DEC-12/AC-F5-1/AC-F5-3 pin exact columns (plan cleanup `would-apply`/`satisfied`/`would-refuse`/`skipped-gap`; plan issue closure `would-apply`/`satisfied`/`skipped-noop`/`skipped-gap`; apply cleanup `applied`/`satisfied`/`refused`/`skipped-gap`; apply issue closure `applied`/`satisfied`/`skipped-noop`/`skipped-gap`), derived from the member observation + own operations, never step `detail`. TC-XCLOSE-001/003 assert exact columns and inject a misleading `detail` to prove it is ignored. |
| **N2** owning-phase scope | **Closed.** Plan 1.3 phases 2/3/5 scopes contain the previously missing paths; verified from the parsed `scope.files`, not the comment. |
| **N7** phase-5 commit type | **Closed.** Subject is `test(GH-310): …`, not `docs(...)`. |
| **N8** suite-home count | **Closed in the plan** (39/39, recomputed independently). See the minor historical pm-notes note below. |
| **N9** `verify.gates.failed` carrier | **Closed.** F-3/DEC-18/AC-F3-2/TC-XDOD-002 name `overall: "fail"` as the sole carrier; no separate classification field, no error envelope. |
| **N10** §8.5 scoped exceptions | **Closed at the contract level.** §8.5 qualifies the additive-only claim and enumerates the cross-report type, data-bearing negative report, required `member`, and `overall: pass\|fail`. See the minor four-vs-three framing note below. |

No substantive contradiction was found against `packages/core/src/contracts/verify-gates.ts`, `packages/cli/src/commands/verify-gates.ts`, `packages/cli/src/commands/verify.ts`, `packages/core/src/contracts/closeout.ts`, or `packages/cli/src/commands/closeout.ts`. The delivered `VerifyGatesReport` shape, the delivered failure/unknown envelopes and exits 1/2, the closeout twelve step ids, and the aggregate step outcome are all preserved by the plan.

## Blocking Finding

### N6 [major] cross_artifact_consistency — the test plan still describes plan revision 1.2 and open N2/N7/N8, while plan 1.3 closes them

- Artifact/location: `chg-GH-310-test-plan.md` §2 (line 53), §8.3 rows B3/B4/B8 (lines 1874–1879); `chg-GH-310-plan.yaml` revision note 1.3 (lines 7–23) and phases 2/3/5 `scope.files`.
- Gap: the test plan §2 says the implementation plan is "**revision 1.2 exists and is reconciled**" and that "the only plan-side residuals are … N2 (phase-3 determinism-suite scope), N7 (phase-5 commit type), and N8 (suite-home count wording), owned by delivery_planning." It also says "Spec v1.4 … adds no suite file and no phase, so it does not re-open plan scope." All three statements are false against the current plan: plan revision 1.3 declares `tests/behaviour/cross-repository-determinism.test.ts` in phase 3, declares the closeout-removal extension targets in phase 2 and `plan-readonly.test.ts`/`verify-gates-read-budget.test.ts` in phase 5, declares the new `tests/types/cross-repository-report.type-test.ts` in phases 3 and 5, changes the phase-5 subject to `test(GH-310): …`, and corrects the count to 39/39. §8.3 B3 still says "N2 remains a plan item", B8 says plan revision 1.2 "accurately" lists N2/N7/N8, and B4 cites plan revision 1.2. This is a direct cross-artifact contradiction, not a missing technical contract.
- Why it blocks the gate: `cross_artifact_consistency` is a DoR facet ("Ticket → spec → test-plan → plan align"). The test plan’s status/closure text contradicts the authoritative plan, so the artifact set is not internally consistent even though the technical content is. The technical assertions, scopes, and counts themselves are current and correct.
- Suggested remediation target phase: **test_planning** (metadata-only §2/§8.3 refresh to plan revision 1.3; no technical assertion changes).
- **Human decision required (this is not a fourth technical revision):** choose one —
  1. **Accept plan revision 1.3 as authoritative and authorize the metadata-only §2/§8.3 refresh in the delivery commit** (or at closeout), with no new readiness review of the technical content; or
  2. **Require the test-plan §2/§8.3 metadata refresh before delivery** (a documentation-only test-plan update, not a new contract/design cycle).

## Non-Blocking Observations

- **N8 historical pm-notes note [minor].** `chg-GH-310-pm-notes.yaml` line 155 still contains the iteration-1 note "Plan revision 1.2 declares every §7 suite home (41/41)"; the later iteration-2 note correctly records 39/39. The old note is historical and superseded; annotate it as such if the pm-notes are treated as a current reference. It is not a blocking count claim because the current note and plan agree on 39/39.
- **§8.5 four-vs-three framing [minor].** `chg-GH-310-spec.md` §8.5 line 236 says "four enumerated scoped behaviours"; line 240 says "exactly three delivered behaviours differ"; the test plan §8.2 says "exactly four behaviours." The enumerated contents are the same behaviours (distinct report type + `overall: pass|fail`, data-bearing negative report, required `member`, `unknown` never emitted). Harmonize the count/wording in phase 7; it does not affect the contract.
- **Closeout apply column omits the delivered `failed` outcome [minor].** The delivered `CloseoutApplyOutcome` includes `failed`, while the member `cleanup`/`issueClosure` apply columns are `applied|satisfied|refused|skipped-gap` and `applied|satisfied|skipped-noop|skipped-gap`. The spec says a failed per-member operation stays visible in the aggregate step outcome and the mapping’s "gap" covers a provider/git gap; a generic failed deletion is not explicitly mapped. Add a one-line rule (e.g. a failed member operation maps to `skipped-gap`, or add `failed` to the column) during phase 7/delivery. It is not covered by the ACs and does not block.
- **`CrossRepositoryCloseoutObservation.issueClosure?` absence [minor].** DM-8 makes the field optional and lists the observed facts; the mapping says "computed from the observation entry plus the member’s own closeout operations," so an absent fact can fall back to the step operation. State that fallback explicitly in phase 7; no AC depends on the absent-field edge.
- **No other contradictions found.** The delivered `VerifyGatesReport`/CLI failure/unknown exit behaviour, the closeout twelve-step contract, the queue/member-ref rules, the error-table/domain-kind counts, and the ticket AC1–AC4 mapping all remain consistent with the current truth.

## Human Decision (required for READY)

The technical Definition of Ready is met; the only gate failure is the documentation-only N6 staleness. A human must choose:

1. **Accept plan revision 1.3 as the authoritative delivery plan and authorize the test-plan §2/§8.3 metadata refresh during delivery** (no new technical review; the technical artifacts are ready), or
2. **Require the test-plan §2/§8.3 metadata refresh before delivery** (a documentation-only update).

If option 1 is chosen, the gate can be recorded as PASS with the N6 metadata correction as a delivery-commit obligation. If option 2 is chosen, the test plan is refreshed and the gate re-checked only for the metadata rows; no contract, scope, or test-content change is needed.

## Iteration Notes

- This is iteration 3. The substantive iteration-2 findings N1, N3, N4, N5, N9, N10 are closed in the text; N2, N7, N8 are closed in plan revision 1.3. N6 is the sole remaining inconsistency and is documentation-only.
- Counts and traceability remain exact: 37 ACs / 51 TCs / 5 phases / 37-of-37 AC ownership / 51-of-51 TC ownership / 39 suite-or-type-test homes. No dangling AC, TC, DM, DEC, RSK, or DoD link was found.
- No source, spec, test-plan, plan, or pm-notes file was modified; only this record was written. Zero git operations.
