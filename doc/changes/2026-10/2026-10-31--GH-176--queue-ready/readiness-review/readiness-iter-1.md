# Readiness Review Iteration 1

Verdict: NOT_READY
Work Item: GH-176
Date: 2026-10-31
Pause Required: no

## Gate Summary

- Findings: 20 total — 2 critical, 6 major, 10 minor, 2 nit.
- Blocking findings: R-01, R-02, R-03, R-04, R-05, R-06, R-07, R-10.
- Primary reopen target: `specification` (then `test_planning`; two plan-only wording fixes go to `delivery_planning`).
- No prior readiness records exist; this is iteration 1. No finding is a repeat.

## Facet Summary

- spec_completeness: FAIL
- ac_quality: PASS
- plan_coverage: PASS
- test_traceability: PASS
- cross_artifact_consistency: FAIL
- decision_capture: FAIL
- system_spec_consistency: FAIL
- plan_doc_update_coverage: PASS
- plan_code_area_coverage: PASS
- dod_defined: PASS

## Claims Checked (verification notes, not findings)

- Ticket coverage: the two ticket ACs are covered. "A not-ready ticket names the missing readiness condition" maps to AC-F3-1/F4-1/F5-1/F6-1/F7-1/F8-1/F9-1/F13-1/F14-1; "close items rank above new starts" maps to AC-F10-1/F11-1/F12-1. The ticket's six checks, close classes, and provider-from-chain-and-parks posture are present.
- 35 TCs / 20 ACs / 11 NFRs: confirmed. TC-QREADY-001..035 exist; AC-F1-1..AC-F17-1 count 20; NFR-1..NFR-11 count 11; the test plan's forward and reverse traces are complete with no orphan TC.
- 33-positional parser boundary: confirmed correct. `packages/cli/src/index.ts` rejects a positional when `positionals.length >= definition.positionals.max`, so `max: 33` accepts subcommand + 32 refs (33 positionals) and rejects the 33rd ref (34 positionals). Plan RES-4 and spec AC-F1-1 are right; the test plan's AC-table restatement is wrong (R-11).
- Status read reuse: confirmed real. `packages/cli/src/edge.ts` already composes `readRepository`, `readWorkItems` (100), `readDeliveryRequests` (100), `readPipelineRuns` (20), provider config, park fold, and the local PM context. Extracting `collectStatusFacts` from `packages/cli/src/commands/status.ts` adds no adapter operation. The reused pull read is `?state=open`, which causes R-04.
- Shared CI classifier extraction: low risk and behaviour-preserving. `ciResultOf` in `packages/core/src/domain/status.ts:772-779` matches the plan's pinned `classifyPipelineRuns` exactly. The status suites and golden digest are in the phase gates, which is the correct control. `STATUS_CI_RESULTS` already contains `unknown`, so no new vocabulary is needed.
- Content-inventory registration: feasible. `tests/structure/inventory.json` is a per-package file list and `EXECUTABLE_ALLOWANCES` is per-file; the plan's registration approach matches the check. The plan omits the `contracts/index.ts` export-surface update in `tests/fixtures/ports/v1-contract-inventory.json` (R-17).
- PM-NOTE-1 correction: partly verified. The `all-unknown-degraded` corpus row now truthfully says no remote read was attempted and no `read-failed` appears. The same correction was not applied to three other binding/credential corpus rows (R-03).
- Read-only posture: confirmed. The composed status runtime reads only; no write/fence/spawn path is introduced. `readProviderParkViews` is a read-only fold; `readLocalPmContext` never writes.
- Scope creep: mostly controlled. The machine payload adds a bounded `workItem.title` that the ticket does not require (R-18). No new package, subpath, error row, config key, state schema, or adapter read is planned.
- Live switch: blocked. Spec Appendix C declares a production constant whose literal is forbidden in `packages/**`; the test plan asserts an impossible pair (R-01).
- `pr-not-open` / merged-closed rules: unreachable through the reused open-only pull read (R-04).
- Dependency/ordering feasibility: phases 1-7 are ordered sensibly; each phase has a gate and a commit boundary; Phase 7 is correctly a `@doc-syncer` handoff. No circular dependency found.

## Findings

1. [critical] cross_artifact_consistency — `chg-GH-176-spec.md` Appendix C `QUEUE_READY_LIVE_ENV` (line 626), F-17 (line 172), DEC-17 (line 406), AC-F17-1 (line 469); `chg-GH-176-test-plan.md` TC-QREADY-024 precondition/step 10 (lines 1132, 1146) and §4.3 (line 216); `chg-GH-176-plan.md` RES-3 (line 80), pinned constants (line 124), tasks 1.5/6.4 (lines 364, 518); `scripts/checks/forbidden-literals.registry.json` (`packageTree: packages`, seeds `ados`, `ADOS_`, `~/.ados`).
   Gap: The spec declares `QUEUE_READY_LIVE_ENV = "ADOS_QUEUE_READY_LIVE"` as a declared constant, which places the literal in `packages/**` and trips the forbidden-literal gate. TC-QREADY-024 then asserts both that the constant equals the literal and that the literal is absent from `packages/**` — a pair that cannot both hold. The plan says it will not declare the constant (a deviation from Appendix C) and explicitly flags the inconsistency "for PM at DoR", so the artifact set knowingly contains a stop condition while `pm-notes.yaml` records `open_questions: []`.
   Suggested remediation target phase: specification
   Suggested fix: Remove `QUEUE_READY_LIVE_ENV` from Appendix C (or restate it as a test-harness literal that is never declared in `packages/**`), make TC-QREADY-024 bind the literal from `tests/fixtures/queue-ready/harness.ts`, and remove plan RES-3's deviation so spec/test-plan/plan agree.

2. [critical] spec_completeness — `chg-GH-176-spec.md` F-2 (line 157), Appendix C `QUEUE_READY_WORK_ITEM_REF_PATTERN` (line 623), DM-11 (line 248), NFR-2 (line 308), AC-F1-1 (line 450); `chg-GH-176-test-plan.md` TC-QREADY-001 (lines 282, 289); `chg-GH-176-plan.md` constant/canonicalization rules (lines 121, 227).
   Gap: The work-item-ref grammar has no maximum length. A single caller-supplied ref of arbitrary length (for example `A` + 100 000 characters + `-1`) matches `^[A-Za-z][A-Za-z0-9]*-[0-9]+$`, is canonically echoed in `workItemRef`, and flows into the machine payload and human digest. This can exceed the declared hard bounds (serialized `data` <= 64 KiB, human <= 4096 bytes / 16 lines) with one legal input. NFR-2's "input refs <= 8" is a count cap, not a length cap; the test plan's over-cap control only asserts that a synthetic over-cap payload is a test failure. This is an unbounded-output gap in a change whose core promise is bounded output.
   Suggested remediation target phase: specification
   Suggested fix: Add a maximum ref length (for example `QUEUE_READY_MAX_WORK_ITEM_REF_CHARS = 64`) to F-2, Appendix C, DM-11, and NFR-2; reject over-length refs as `input.value.rejected` before any read; add at-cap/over-cap ref cases to TC-QREADY-001 and a corpus case; state that provider-derived strings (`sourceRef`, `targetRef`, `entityId`, `owner`, `name`, `head.branch`) are also bounded or clamped.

3. [major] system_spec_consistency — `chg-GH-176-test-plan.md` corpus rows `not-ready-ci-addressing-unresolved` (line 1625), `not-ready-ci-remote-unsupported` (line 1626), `not-ready-ci-credential-unavailable` (line 1627); `packages/cli/src/commands/status.ts:56-73`; `packages/cli/src/edge.ts:296-340`; `chg-GH-176-plan.md` RES-1 (line 78).
   Gap: These rows assert `S S S S ? S` while the fixture is "binding unavailable; read unattempted" or "no resolvable credential; read unattempted". In the reused status composition, an unavailable binding skips all three GitHub reads (`tracker`/`changes`/`ci` become `not-configured`) and an unresolvable credential makes all three readers return `credential-unavailable`. In both cases `deps-satisfied`, `tier-known`, and `no-owner-gate` are `unknown`, and the close association is `unknown`; only `repo-free` can remain satisfied from the local PM context. The rows cannot be produced through `runCli` and contradict plan RES-1. The PM-NOTE-1 correction at v1.2 fixed only the `all-unknown-degraded` row, not these three.
   Suggested remediation target phase: test_planning
   Suggested fix: Change these three rows to the full composed outcome (`? S ? ? ? S` where provider config/parks are observable), or move the CI-only assertions to the pure-evaluator/condition suite (TC-QREADY-010) and drop the command-level corpus cases. Update the completeness meta-check and the expected evidence accordingly.

4. [major] system_spec_consistency — `chg-GH-176-spec.md` F-10 (line 165), DM-5/DM-6 (lines 242-243), Appendix E (lines 646-655); `packages/adapters/src/github/client.ts:155-157` (`/pulls?state=open`); `chg-GH-176-test-plan.md` TC-QREADY-013 step 8 (line 733), corpus `at-limit-pr-no-match-merged` (line 1641), `close-merged-excluded` (line 1647), `close-merged-only-not-ready` (line 1648); `chg-GH-176-plan.md` close rules (lines 181-183).
   Gap: The reused pull read is explicitly `state=open`, so it cannot return an object whose normalized state is `merged` or `closed`. Yet F-10, DM-5/DM-6, Appendix E, the plan, and the test corpus all define `pr-not-open`, merged/closed exclusion, and "at-limit wins even when merged/closed matches were observed" as command-level behavior. Those cases cannot be produced through `collectStatusFacts`; the corpus fixtures would either need inconsistent injected facts or would test only the pure evaluator while claiming command coverage. This is also a silent mismatch with the current system spec, which describes the pull read as open pull requests.
   Suggested remediation target phase: specification
   Suggested fix: Pin the intended posture. Either (a) declare `pr-not-open`/merged-closed handling a pure-evaluator, provider-agnostic rule over injected normalized views and keep its tests at the evaluator layer only (not command/corpus), or (b) remove the rule and its corpus cases and keep association strictly to the open-PR read. Update F-10/DM-5/DM-6/Appendix E and the test plan consistently.

5. [major] cross_artifact_consistency — `chg-GH-176-test-plan.md` corpus rank column (lines 1606-1655, e.g. `ready-new-start ... new-start / 3`, `merge-ready ... merge-ready / 1`); `chg-GH-176-spec.md` DM-7 (line 244), F-11 (line 166), Appendix G "Rank" column (lines 682-694); `chg-GH-176-plan.md` ranking paragraph (line 190); `chg-GH-176-test-plan.md` TC-QREADY-017 (lines 876-883), TC-QREADY-028 steps 1 and 7 (lines 1285, 1291).
   Gap: `rank` is defined as the 1-based position after sorting (DM-7/F-11). A single-candidate corpus case therefore has `rank: 1`. The corpus table instead uses a mix of class ranks and 1-based class positions (`new-start / 3`, `merge-ready / 1`, `unknown / 3`, `not-ready / 4`), and Appendix G's "Rank" column uses class ranks 0..4 without labeling them. TC-QREADY-028 step 1 asserts `rank` equals the corpus expected value, so the corpus contradicts DM-7 and Appendix G. Separately, the plan's parenthetical says equal-numeric refs order `GH-7` before `GH-007`, while canonical text ascending (and TC-QREADY-017 step 5) puts `GH-007` before `GH-7`.
   Suggested remediation target phase: test_planning
   Suggested fix: Rename Appendix G's column to "class rank (0-4)"; add a separate expected 1-based `rank` per corpus case (1 for the single-candidate cases); fix the plan's parenthetical to `GH-007` before `GH-7`; keep TC-QREADY-017's correct assertion.

6. [major] cross_artifact_consistency — `chg-GH-176-plan.md` RES-2 (line 79) and task 3.1 (line 424); `chg-GH-176-spec.md` F-4 (line 159), DM-3 (line 240), Appendix D safe-detail examples (line 642, `dependencies-done:2`); `chg-GH-176-test-plan.md` TC-QREADY-005 step 5 (line 436, "bounded count detail"), TC-QREADY-035 step 1 (line 1546, "a condition that would produce three evidence records"), corpus `evidence-cap-3` (line 1650).
   Gap: The plan invents per-state dependency evidence (up to three records ordered `dependency-open`, `dependency-unobserved`, `dependencies-done`, comma-joined target refs in the detail, clamped to 160) so the evidence cap is reachable. The spec does not define multi-record deps evidence or a comma-joined-ref detail; its safe-detail example is a count (`dependencies-done:2`). The test plan's TC-QREADY-005 asserts a "bounded count detail", and no AC/TC defines the multi-record rule. The evidence-cap-3 case is therefore unreachable without the plan-only rule, while TC-QREADY-005 would fail against the plan's detail.
   Suggested remediation target phase: specification
   Suggested fix: Pin the deps evidence shape in F-4/DM-3/DM-4/DM-11 (per-state records and the exact detail format) and align TC-QREADY-005 and the evidence-cap-3 corpus case, or drop RES-2 and define the evidence-cap overflow case another documented way.

7. [major] cross_artifact_consistency — `chg-GH-176-spec.md` F-4 (line 159), §8.3 condition matrix (line 256), AC-F4-1 (line 456); `chg-GH-176-plan.md` RES-1 (line 78) and "Deps precedence" (line 172); `chg-GH-176-test-plan.md` TC-QREADY-004 (line 390, "combined states") and TC-QREADY-005 (line 434).
   Gap: For a successful tracker read that declares relations unavailable and does not contain the candidate (the common GitHub case), the spec's first clause implies `signal-unavailable`, while the plan pins "candidate unobserved first" (`work-item-unobserved`). The test plan does not pin the combined case. The condition state is `unknown` either way, but the evidence reason differs and AC-F4-1 / corpus assertions can disagree.
   Suggested remediation target phase: specification
   Suggested fix: Add an explicit precedence to F-4/AC-F4-1 (for example candidate-unobserved first for a failed/unattempted read; relations-unavailable first for a successful read whose candidate is observed, or the reverse if the PM prefers) and add the combined case to TC-QREADY-004.

8. [minor] cross_artifact_consistency — `chg-GH-176-test-plan.md` AC-F9-1 row (line 105) says a park-fold failure is `{ source: "provider-config", reason: "state-unreadable" }`; `chg-GH-176-spec.md` F-9 (line 164) and `chg-GH-176-plan.md` RES-6/provider table (lines 83, 167) say `{ source: "provider-parks", reason: "state-unreadable" }`; TC-QREADY-012 step 7 (line 693) is source-agnostic.
   Gap: The test plan's AC restatement assigns the park-fold failure to the wrong source, contradicting the spec and plan; TC-QREADY-012 would not catch it because it does not assert the source.
   Suggested remediation target phase: test_planning
   Suggested fix: Correct the AC-F9-1 row to `provider-parks` and add the exact source assertion to TC-QREADY-012 step 7.

9. [minor] cross_artifact_consistency — `chg-GH-176-test-plan.md` TC-QREADY-010 step 4 (line 618) says the binding reason `addressing-unresolved`/`remote-unsupported` appears "in group 5" of top-level `reasons`; `chg-GH-176-spec.md` DM-1 (line 238) and Appendix C (line 611) place it in group 1 (repository binding); TC-QREADY-002 step 3 (line 325) and TC-QREADY-034 (line 1509) correctly place it in group 1.
   Gap: A test asserting group 5 for a group-1 reason cannot be satisfied together with TC-QREADY-002/034.
   Suggested remediation target phase: test_planning
   Suggested fix: Change TC-QREADY-010 step 4 to assert the binding reason in group 1 and, if useful, that it is not duplicated in group 5.

10. [major] cross_artifact_consistency — `chg-GH-176-test-plan.md` TC-QREADY-001 step 7 (line 293, "Given the command help descriptor, when rendered ..."); `packages/cli/src/index.ts` `CommandDefinition` (lines 34-43) has no help/description field and `parseInvocation` treats `--help` as an unknown flag; `chg-GH-176-plan.md` line 231 ("the CLI has no help command"); `chg-GH-176-spec.md` §8.5 (line 301, "help must say").
   Gap: TC-QREADY-001 step 7 is not implementable against the delivered CLI. The plan resolves the spec's help note via a module doc comment and the command registry, but the test plan still requires a rendered help descriptor, and the spec's "help must say" has no mechanism. A coder would either fail the TC or add a new help surface outside the plan.
   Suggested remediation target phase: specification
   Suggested fix: Either declare and implement a documented help surface (a scope/decision change) or restate spec §8.5 as "the command registry and the module doc comment must say"; replace TC-QREADY-001 step 7 with a doc/registry assertion (or move it to TC-QREADY-025).

11. [minor] cross_artifact_consistency — `chg-GH-176-test-plan.md` AC-F1-1 row (line 94) and TC-QREADY-001 Expected Outcome (line 298) say "33 positionals" / "33+ positionals" are `fallback.invocation`; `packages/cli/src/index.ts:157-175` accepts 33 positionals and rejects the 34th; `chg-GH-176-plan.md` RES-4 (line 81) and spec AC-F1-1 (line 450) are correct.
   Gap: 33 positionals are subcommand + 32 refs, which reach the handler and fail as `input.value.rejected`; it is 33 refs (34 positionals) that the parser rejects.
   Suggested remediation target phase: test_planning
   Suggested fix: Rewrite the test plan wording as "33 refs (34 positionals)" and "33 positionals reach the handler and are rejected as `input.value.rejected`".

12. [minor] cross_artifact_consistency — `chg-GH-176-test-plan.md` TC-QREADY-025 step 3 (line 1178) says the queue command module imports only contracts/domain "plus local types"; `chg-GH-176-plan.md` line 224 and task 2.5 say it also imports the sibling `status` module (`collectStatusFacts`).
   Gap: The import-purity test would reject the planned sibling import, or the coder would duplicate the read composition.
   Suggested remediation target phase: test_planning
   Suggested fix: Allow the sibling `status` command module in TC-QREADY-025 step 3, or move `collectStatusFacts` to a neutral module both commands import.

13. [minor] system_spec_consistency — `chg-GH-176-test-plan.md` TC-QREADY-006 precondition (line 464) lists "empty/`active_change: null`" as a "no active change" fixture; `packages/adapters/src/file/pm-context.ts:26-46,101-107` treats a present `active_change: null` as malformed (not "no active change").
   Gap: The fixture would exercise `local-context-malformed`, not `no-active-change`, and the delivered projection requires `parked_changes` to be an array.
   Suggested remediation target phase: test_planning
   Suggested fix: Use a context with `active_change` omitted and `parked_changes: []` for the `no-active-change` case; keep `active_change: null` in the malformed set if desired.

14. [minor] cross_artifact_consistency — `chg-GH-176-test-plan.md` TC-QREADY-021 (lines 1014, 1020, 1033) calls the AC-F14-1 matrix "twenty" then lists 20 + 2; `chg-GH-176-spec.md` AC-F14-1 (line 466) lists 22 controls; `chg-GH-176-plan.md` task 5.2 (line 485) says "all 20".
   Gap: The count is inconsistent, so a meta-check that "fails if a named control is missing" has no single expected cardinality.
   Suggested remediation target phase: test_planning
   Suggested fix: Use 22 consistently (or label the two extra controls as extensions) in the spec, test plan, and plan.

15. [minor] plan_coverage — `chg-GH-176-plan.md` Definition of Done (line 621) says "All 35 TCs ... are ... green" while also saying TC-QREADY-031 is skipped by default.
   Gap: A skipped test is not green; the DoD cannot be honestly signed with that wording.
   Suggested remediation target phase: delivery_planning
   Suggested fix: Say "34 TCs green by default; TC-QREADY-031 green when `ADOS_QUEUE_READY_LIVE=1` and a credential are present, otherwise skipped".

16. [minor] ac_quality — `chg-GH-176-spec.md` AC-F1-3 (line 452) says "only grammar rejection (`input.value.rejected`) or containment (`fallback.internal`) produces an error envelope", omitting the existing global parser `fallback.invocation` path, which also produces an error envelope. F-16 (line 171) and NFR-6 (line 312) acknowledge the parser path.
   Gap: The AC overstates the command-level failure set; a reader could treat `fallback.invocation` as a regression.
   Suggested remediation target phase: specification
   Suggested fix: Reword AC-F1-3 to include `fallback.invocation` (as an invocation rejection) or limit the AC explicitly to the handler.

17. [minor] plan_coverage — `chg-GH-176-plan.md` task 1.4 (line 363) updates `tests/fixtures/ports/v1-contract-inventory.json` with the new contract module's export surface but not the `contracts/index.ts` module entry; `tests/structure/port-contract-inventory.test.ts:30-70` inventories every contract module including `index.ts`, and the new re-exports change its expected list.
   Gap: The phase gate would fail on an unlisted `contracts/index.ts` export-surface change, or the coder would update it ad hoc.
   Suggested remediation target phase: delivery_planning
   Suggested fix: Add the `contracts/index.ts` export-surface update to task 1.4 and the file list.

18. [nit] spec_completeness — `chg-GH-176-spec.md` DM-2 (line 239) adds a `workItem.title` to the machine payload although the ticket does not require a title and the status digest deliberately carries no titles; the title is only clamped and is not needed for readiness or ranking.
   Gap: An unnecessary privacy/byte surface in a payload that claims to be minimal.
   Suggested remediation target phase: specification
   Suggested fix: Either justify the title as a required work-item observation or drop it from `QueueReadyCandidate` and remove the title-clamp case from TC-QREADY-019.

19. [minor] decision_capture — `chg-GH-176-spec.md` F-6/AC-F6-1 and F-5/AC-F5-1 implement PM decisions D3 and D4 as a `priority:*` label proxy for "tier" and a local-PM-context-only signal for "repo free".
   Gap: Both are recorded and disclosed, but a `tier-known=satisfied` state can be produced by a priority label even though no delivery tier exists, and `repo-free=satisfied` can be produced from a local-only signal that cannot see another machine's active change. The human digest prints only the condition state, not the proxy caveat.
   Suggested remediation target phase: specification
   Suggested fix: Add an explicit note (in F-5/F-6 and the new feature doc) that `tier-known` is a priority-label proxy until the M2 `DeliveryTier` intake policy exists and that `repo-free` is local-context-only until M2-S1; consider whether the human detail should name the source. This is a residual risk, not a blocker, if the PM keeps D3/D4.

20. [nit] cross_artifact_consistency — `chg-GH-176-test-plan.md` TC-QREADY-009 step 6 (line 584) says "record the exact reason as delivery-bound if the classifier does not pin it"; the delivered classifier pins an all-skipped page to `none`/`ci-none`.
   Gap: The hedge weakens a pinned assertion and invites a delivery-bound reinterpretation.
   Suggested remediation target phase: test_planning
   Suggested fix: Assert `ci-none` for all-skipped runs and remove the hedge.

## Open Domain Decision

No blocking finding requires human input. R-01, R-02, R-04, R-06, R-07, R-10, and R-16 are spec corrections; R-03, R-05, R-08, R-09, R-11-R-14, and R-20 are test-plan corrections; R-15 and R-17 are plan corrections. The PM can reopen those phases and have the authors revise the artifacts.

Two recorded PM decisions carry residual semantic risk but are not reopened by this gate: D3 (the `priority:*` label proxy for `tier-known`) and D4 (the local-PM-context-only signal for `repo-free`). They are disclosed in the spec and are the only current read-only signals until the M2 intake/single-flight work. If the owner wants to reject either proxy, that is a human decision, but the gate does not require it. The `pr-not-open`/merged-closed disposition in R-04 is a product-scope choice the PM can direct as a spec correction (keep it as a pure-evaluator provider-agnostic rule or drop it); no separate human gate is needed.

## Next Remediation Targets

1. `specification`: R-01, R-02, R-04, R-06, R-07, R-10, R-16, R-18, R-19.
2. `test_planning`: R-03, R-05, R-08, R-09, R-11, R-12, R-13, R-14, R-20.
3. `delivery_planning`: R-15, R-17.

Do not reopen `delivery` for any of these findings. Re-run the DoR gate after the authors revise the artifacts; cap at approximately three iterations and escalate to the human if a blocking gap persists.
