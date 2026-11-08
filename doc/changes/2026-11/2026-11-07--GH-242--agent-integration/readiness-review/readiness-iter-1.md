# Readiness Review Iteration 1

Verdict: NOT_READY
Work Item: GH-242
Date: 2026-11-07
Pause Required: no

Inputs reviewed: ticket GH-242 (GitHub issue, `juliusz-cwiakalski/agentic-delivery-os`), `chg-GH-242-spec.md`, `chg-GH-242-test-plan.md`, `chg-GH-242-plan.yaml` (validated against the current `delivery.plan.v1` validator with zero errors; the validator currently ignores the not-yet-declared `summary` and the non-schema `tests` key), `chg-GH-242-pm-notes.yaml`, `TDR-0013-agent-session-commit-guard-reversal.md`, `doc/guides/definition-of-ready.md`, the current `doc/spec/features/**` pages named by the spec, and the relevant CLI/contract/test source.

## Facet Summary

- spec_completeness: FAIL
- ac_quality: FAIL
- plan_coverage: FAIL
- test_traceability: FAIL
- cross_artifact_consistency: FAIL
- decision_capture: PASS
- system_spec_consistency: FAIL
- plan_doc_update_coverage: FAIL
- plan_code_area_coverage: FAIL
- dod_defined: FAIL

## Blocking Findings

### RR-1 [critical] dod_defined — `chg-GH-242-spec.md` §17 / validation checklist

- **Gap:** The spec defines no change-specific Definition of Done. Section 17 is the AC table; there is no DoD section binding the ACs, NFRs, §4.1 metrics, quality gates, plugin freshness, PR disclosure, and plan phases to verification. The `VALIDATION CHECKLIST` has no DoD item. `doc/guides/definition-of-ready.md` makes `dod_defined` a hard gate ("delivery cannot start without a DoD"); the GH-233 spec's §17.1 is the in-repo precedent.
- **Evidence:** `chg-GH-242-spec.md` has headings §1–§25 only (no §17.1/DoD); the six DoR/DoD mentions in the repo's recent specs are concentrated in GH-233/GH-228/GH-221/GH-235, not GH-242.
- **Suggested remediation target:** specification
- **Suggested fix:** Add a §17.1 "Definition of Done (change-specific)" that binds every AC (including AC-NFR1-1/AC-NFR3-1/AC-NFR9-1), every NFR, the §4.1 metrics, the TDR/PR disclosure, plugin freshness, the aggregate gate, and the one-PR/split posture to named test evidence and plan phases. Add the DoD line to the validation checklist.

### RR-2 [critical] cross_artifact_consistency — `chg-GH-242-spec.md` §5.1 F-5 + §6 Flow 1; `chg-GH-242-test-plan.md` TC-STAGE-006/TC-STAGE-007; `chg-GH-242-plan.yaml` phase 3

- **Gap:** The new completion order writes the pm-notes transition **before** the commit act, but the convergence contract only covers the old failure window (commit landed, document write later failed). The reverse window — document written, then the safety scan/staging/commit act fails — is neither specified nor tested. That window can leave pm-notes showing a completed phase with no ledger transition and no commit, which is exactly the transition/commit divergence the change exists to prevent.
- **Evidence:** Spec F-5 says "the current order (commit first, document write second) is reversed" and only "If the document write fails after the commit, a re-run converges..."; Flow 1 shows document → safety scan → commit → ledger. Test plan TC-STAGE-006 asserts write-before-commit; TC-STAGE-007 constructs only "post-commit/pre-document". Plan phase 3 summary repeats only the post-commit convergence.
- **Suggested remediation target:** specification + test_planning (and delivery_planning for the phase scope)
- **Suggested fix:** Define the document-first failure semantics (e.g., the written transition is staged but not durable until the commit ledger append; a retry reuses the staged document and lands exactly one commit + one transition; a failed safety scan leaves a convergent, non-completed document). Add a TC that injects a commit-act/safety failure after the document write and asserts exactly one commit and one transition on retry. Reference it in phase 3.

### RR-3 [major] plan_coverage / cross_artifact_consistency — `chg-GH-242-plan.yaml` phase 2 test list; `chg-GH-242-test-plan.md` TC-SESS-002

- **Gap:** Phase 2 is not independently green. Its declared test `tests/behaviour/phase-session-adoption.test.ts` carries TC-SESS-002, whose expected outcome includes "the default completion ... lands one commit containing the artifact and the pm-notes transition" and `--no-commit` convergence — the phase-3 staging/ordering/convergence work. Phase 2's summary implements only the guard removal and row retirement.
- **Evidence:** Test plan TC-SESS-002 (lines ~545–572); plan phase 2 scope/tests (lines ~54–101); plan phase 3 (lines ~102–140).
- **Suggested remediation target:** delivery_planning (with a test_planning touch)
- **Suggested fix:** Move TC-SESS-002's artifact/pm-notes/convergence assertions to phase 3 (split the test case), or move the staging/ordering implementation into phase 2 and reduce phase 3 to the remaining scope. Make each phase's declared test command pass on that phase alone.

### RR-4 [major] plan_coverage / cross_artifact_consistency — `chg-GH-242-plan.yaml` phase 4 test list; `chg-GH-242-test-plan.md` TC-PLANSUM-003

- **Gap:** Phase 4's `tests/checks/plan-consumer-inventory.test.ts` is specified to scan the **coder, PM, and command prompts** for `tasks`/plan-progress instructions, but those prompts are only updated in phase 5 (`coder.md`, `pm.md`, `run-plan.md`). The current prompts still contain plan-progress/tasks language (e.g., `coder.md` "updating plan status after every task"; `run-plan.md` "pending tasks (unchecked)"; `pm.md` "all plan tasks done"). Phase 4 therefore fails until phase 5.
- **Evidence:** Test plan TC-PLANSUM-003 step 4 (lines ~1048–1077); plan phase 4 (lines ~141–179) and phase 5 (lines ~180–209); current `.opencode/agent/coder.md` line 13, `.opencode/command/run-plan.md` line 85, `.opencode/agent/pm.md` line 287.
- **Suggested remediation target:** delivery_planning (with a test_planning touch)
- **Suggested fix:** Scope phase 4's inventory test to the plan-writer/plan consumers and move the prompt-text scan to phase 5/8, or reorder phase 5 before phase 4, or move the coder/PM/run-plan prompt edits into phase 4. State the split explicitly.

### RR-5 [major] plan_coverage / cross_artifact_consistency — `chg-GH-242-plan.yaml` phases 7 and 10; `chg-GH-242-test-plan.md` TC-DOCREC-002

- **Gap:** Phase 7's declared test `tests/checks/doc-conformance.test.ts` is specified to assert every affected `doc/spec/features/**` page, including the five-row `commit` domain, but the feature specs are updated only in phase 10. Phase 7 cannot be green on its own; the phase order has a forward dependency.
- **Evidence:** Test plan TC-DOCREC-002 (lines ~1460–1487) lists the affected `doc/spec/features/**` pages; plan phase 7 scope (lines ~260–304) contains only guides/man page/command pages; plan phase 10 (lines ~376–413) contains the feature specs.
- **Suggested remediation target:** delivery_planning (with a test_planning touch)
- **Suggested fix:** Either move all affected feature-spec reconciliation into phase 7 (phase 10 re-runs and finalizes only), or scope phase 7's doc-conformance test to the docs it updates and extend it in phase 10. Make the phase split explicit in the test plan.

### RR-6 [major] system_spec_consistency — `chg-GH-242-spec.md` §2.1 and §8.1

- **Gap:** The spec states that "the remaining primitives are delivered" and lists `state` and `mcp` among the "commands registered but not prompt-required". That contradicts current-truth behavior and an invariant test: the state layer has no command surface (`feature-state-layer.md`: "The layer ships no command surface"; `tests/structure/state-scope.test.ts` fails if a `state` command is registered/implemented), and `mcp` is a separate package/serve surface, not a CLI command. An implementer following §8.1 could register `state`/`mcp` and break the invariant.
- **Evidence:** Spec §2.1 line 62 and §8.1 line 284; `tests/structure/state-scope.test.ts` lines 133–138; `doc/spec/features/feature-state-layer.md` line 23; `doc/planning/oss-tooling/milestones/m1/commands/state.md` ("M1 planned (M1-S2). Proposed contract.").
- **Suggested remediation target:** specification (with a delivery_planning test addition)
- **Suggested fix:** Remove `state`/`mcp` from the "registered but not prompt-required" command list or explicitly classify them as non-CLI delivered surfaces. Add `tests/structure/state-scope.test.ts` and an `mcp`-absence assertion to phase 1's composition/help tests so the entrypoint cannot claim them.

### RR-7 [major] plan_doc_update_coverage / system_spec_consistency — `chg-GH-242-spec.md` §7.1/§16.1; `chg-GH-242-plan.yaml` phase 10

- **Gap:** The affected-system-spec list is incomplete. Current-truth specs that directly describe the behavior being replaced are not reconciled anywhere:
  - `doc/spec/features/feature-delivery-lifecycle.md` F-8: "all commits route through `@committer` ... No agent prompt other than `@committer` performs a direct `git commit`" — contradicted by the thin `@committer` and direct `commit` calls.
  - `doc/spec/features/feature-quality-gates-and-pr.md` F-3: `@committer` produces the commit via a temp message file and one post-hook amend — contradicted by the primitive-backed thin executor.
  - `doc/spec/features/feature-autonomous-delivery.md` INV-DM-4: the CEO merges via `gh pr merge --squash` / `glab mr merge` — contradicted by `merge` as the lifecycle merge path.
  - `doc/spec/features/feature-local-code-review.md` line 68: review triggers `/commit` (`@committer`) — needs reconciliation to the primitive-backed path.
  Phase 10's scope and the spec's §7.1 list omit all four; the doc-conformance test's "affected feature pages" has no concrete owner for them.
- **Evidence:** Spec §7.1 line 228; plan phase 10 scope lines 380–390; test plan TC-DOCREC-002; the four current-truth specs above.
- **Suggested remediation target:** specification + delivery_planning
- **Suggested fix:** Add the four feature specs to §7.1 and to phase 10 (or phase 7 if the spec is delivered there), and add their stale/required phrase assertions to the doc-conformance fixtures. Update RSK-1 to name system specs, not only prompts/guides.

### RR-8 [major] plan_code_area_coverage / cross_artifact_consistency — `chg-GH-242-plan.yaml` phases 1/4/5/6/8/9; `chg-GH-242-test-plan.md` §6.2

- **Gap:** Several new test fixtures required by the test plan are not declared in any plan phase, and several fixture names/paths disagree between the test plan and the plan:
  - Missing from all scopes: `tests/fixtures/prompt-inventory/lifecycle.json`, `allowed-commands.json`, `allowlist.json`, `mutants/`, `tests/fixtures/key-register/register.json`, `tests/fixtures/plan/golden/*.txt`, `tests/fixtures/entrypoint/programs.ts`; the existing `tests/checks/privacy-authoring.test.ts` and `tests/behaviour/commit-safety.test.ts` re-runs are also unspecified.
  - Name/path disagreements: test plan `tests/fixtures/help-guide/matrix.json` vs plan `tests/fixtures/help-guide/coverage.json`; test plan `tests/fixtures/plan/golden/*.txt` vs plan `tests/golden/plan`/`tests/golden/fixtures`; test plan `tests/fixtures/plan/valid|invalid` vs plan `tests/fixtures/plan/summary`; test plan `tests/fixtures/prompt-inventory/lifecycle.json` vs plan `roles.json`.
  - Phase 9 declares only folders (`tests/conformance/pilot`, `tests/fixtures/pilot`), not the individual test/fixture files the test plan names.
- **Evidence:** Test plan §6.2 (lines ~2099–2129), TC-PSCAN/THELP/TKEYVAL/TADOPT preconditions; plan scopes lines ~19–32, ~144–157, ~184–196, ~213–244, ~309–334, ~360–375.
- **Suggested remediation target:** delivery_planning
- **Suggested fix:** Add every required fixture file/folder to the owning phase scope, standardize the names (`matrix.json` vs `coverage.json`; `tests/fixtures/plan/golden` vs `tests/golden/plan`; `valid|invalid` vs `summary`; `roles.json` vs `lifecycle.json`), and list the phase-9 conformance files explicitly. Add the privacy/safety re-runs to phase 8.

### RR-9 [major] spec_completeness / ac_quality — `chg-GH-242-spec.md` F-1 and AC-F1-5; `chg-GH-242-test-plan.md` TC-ENTRY-005

- **Gap:** AC-F1-5 requires `--help`/`--version` to succeed in a directory with no configuration file or project checkout, but F-1 says the working name is resolved only "from configuration or `DELIVERY_OS_WORKING_NAME`". `createConfigProgram` requires a non-empty `workingName`; if both sources are absent, the entrypoint has no name to render. The spec does not define the neutral fallback/source or prove it is not a forbidden product-name literal. The same gap also leaves "executable entrypoint" ambiguous: the plan adds modules and in-process tests but no `bin`/`main`, and no decision states that "executable" means an in-process composition invoked by the host rather than a runnable process.
- **Evidence:** Spec F-1 line 140; AC-F1-5 line 506; test plan TC-ENTRY-005 (lines ~376–401); plan phase 1 scope lines 19–32; `packages/cli/src/edge.ts` `ConfigProgramOptions.workingName` (required) and `resolveBrandIdentity` non-empty-name validation; no `bin`/`main` in `packages/cli/package.json`.
- **Suggested remediation target:** specification (with a test_planning touch)
- **Suggested fix:** Define the no-config/no-override working-name source (build-injected neutral identity or a documented compile-time default) and add an AC assertion that it is not a seed/product literal; explicitly define "executable" as the in-process composition (or add a non-installed `bin`/`main` with a recorded decision and a built-artifact smoke test). Update TC-ENTRY-005 to state the injected/default identity precondition.

### RR-10 [major] ac_quality / test_traceability — `chg-GH-242-spec.md` AC-NFR1-1/NFR-2/AC-F1-2; `chg-GH-242-test-plan.md` §1.2, TC-ENTRY-006, TC-ENTRY-009

- **Gap:** AC-NFR1-1 is a hard "p95 ≤ 100 ms" criterion, but the test plan makes timing "an advisory ceiling with CI tolerance" and hard-gates only zero I/O. NFR-2's startup ≤250 ms is tested only by TC-ENTRY-009, which is classified nice-to-have. There is also no must-pass AC for the F-1/DEC-13 composition requirement ("compose only the prompt-required subset; unconfigured compositions fail closed"); TC-ENTRY-009 is nice-to-have and maps to no AC. A failure in these can leave the spec's stated thresholds unverified.
- **Evidence:** Spec AC-NFR1-1 line 507, NFR-2 line 325, F-1 line 140, DEC-13 line 419; test plan §1.2 line 40, TC-ENTRY-006 lines ~403–430, TC-ENTRY-009 lines ~487–514, nice-to-have list lines ~65–74.
- **Suggested remediation target:** test_planning (with a specification touch for AC-NFR1-1)
- **Suggested fix:** Either make the timing thresholds deterministic gates with a documented reference/CI tolerance, or rewrite AC-NFR1-1/NFR-2 to the zero-I/O/forbidden-literal criteria and record timing as informational. Add a must-pass AC for composition completeness/fail-closed (or explicitly map TC-ENTRY-009 to an existing AC) and promote it out of nice-to-have.

### RR-11 [major] cross_artifact_consistency / decision_capture — `chg-GH-242-spec.md` RSK-8 and OQ-1; `chg-GH-242-plan.yaml` tier

- **Gap:** RSK-8 rates "Scope too large for one reviewable change" as H/H and names the split as the mitigation, with residual "A single PR may be unreviewable". OQ-1 resolves "no split", citing one leaf story/one PR. The risk register and the decision now contradict each other, and the plan has ten heavy phases touching ~20 prompts, ~20 docs, the entrypoint, the guard reversal, the error table, staging/ordering, the plan schema, conformance scans, and a pilot suite. The plan's phase structure is not sufficient mitigation while phases are not independently green (RR-3–RR-5).
- **Evidence:** Spec RSK-8 line 356, OQ-1 line 396; plan phase list and weights (ten `delivery` phases, six `heavy`).
- **Suggested remediation target:** specification + delivery_planning
- **Suggested fix:** Either (a) record an explicit one-PR review-risk acceptance with a phased review/checkpoint strategy and fix the hidden phase dependencies, or (b) split at the foundation/coordination boundary: **Foundation PR** = phases 1–5 + the foundation subset of 7/8 (entrypoint/help/version, session-guard reversal + error-row retirement, staging/ordering, plan `summary`, PM/coder/committer/commit/run-plan adoption, foundation guides/reference pages, conformance scans); **Coordination PR** = phases 6 + 9 + the coordination subset of 7/10 (ceo/lane/remaining command prompts, status/brief/queue/lanes/blockers/merge/closeout/spend/retro reference pages, J1 pilot, remaining feature-spec reconciliation). Split phases 7 and 10 into A/B to make the boundary real.

## Non-Blocking Findings

### RR-12 [minor] cross_artifact_consistency — `chg-GH-242-spec.md` Appendix C vs `chg-GH-242-test-plan.md` §3.1.1

- **Gap:** The spec's ticket-AC traceability table has five rows (combining phase state and commit), while the test plan's ticket-AC coverage table has six rows (splitting them). The content is covered by AC-F2-1/AC-F3-1, but the two traceability tables do not align.
- **Suggested remediation target:** specification (or test_planning)
- **Suggested fix:** Split Appendix C row 1 into the two ticket ACs or make the test plan's table use the same five-row grouping.

### RR-13 [minor] ac_quality / cross_artifact_consistency — `chg-GH-242-spec.md` AC-F10-3 vs Appendix D / TC-PILOT-003

- **Gap:** AC-F10-3 says "only the tracker/CI/PR-platform/provider surfaces are stubbed", but Appendix D and TC-PILOT-003 also require injected/fixed clock and id generation. The "only" wording is narrower than the intended matrix.
- **Suggested remediation target:** specification
- **Suggested fix:** Say "stubbed or deterministically injected" and list clock/id injection explicitly in the AC.

### RR-14 [minor] plan_coverage — `chg-GH-242-plan.yaml` phase 9 summary

- **Gap:** The phase-9 summary names `status`, `blockers answer`, `merge`, `closeout`, `queue plan` but omits `verify change`/`phase list`, which the test plan's J1 sequence and the spec's F-7 require before merge.
- **Suggested remediation target:** delivery_planning
- **Suggested fix:** Add `verify change`/`phase list` to the phase-9 summary and its assertion list.

### RR-15 [minor] plan_coverage / decision_capture — `chg-GH-242-plan.yaml` phase 2; TDR-0013 "Unresolved Questions" and `escalationTriggers`

- **Gap:** TDR-0013's implementation says the now-unused `sessionFacts` wiring is removed and the contract/adapter export retained; phase 2's summary does not mention that wiring decision. The plan's tier escalation trigger `owner-approval-required-for-session-guard-reversal` also implies an owner approval gate, while the TDR says acceptance is deferred to PR review and delivery may proceed with acceptance pending.
- **Suggested remediation target:** delivery_planning (with a TDR/pm-notes alignment)
- **Suggested fix:** Add the `sessionFacts` wiring decision to phase 2 and either remove the escalation trigger or define the owner-approval checkpoint and its relationship to the TDR's acceptance-pending posture.

### RR-16 [nit] test_traceability — TC-ERRROW-003 "false-positive or retired-codes fixture"

- **Gap:** The test plan says to add the retired code to a "false-positive or retired-codes fixture", but only `true-positives.json` exists; the plan scope updates only that corpus. The intent (re-introduction detection) is already served by the S1 source scan, so the step is ambiguous.
- **Suggested remediation target:** test_planning
- **Suggested fix:** Name the exact fixture and the expected detection mechanism, or rely on the S1 scan and drop the corpus step.

## Scope Realism Judgment

The change is not deliverable as one PR **as currently specified** without unacceptable risk: the plan's own RSK-8 is H/H, its mitigation (a split) was rejected by OQ-1 without a replacement review-risk acceptance, and the phase sequence is not independently green (RR-3, RR-4, RR-5). A split is not forced by the ticket's leaf-story shape, but if the one-PR path is kept, the PM must record an explicit one-PR review-risk acceptance and fix every hidden phase dependency. The recommended split boundary is the one named in RR-11: foundation = phases 1–5 plus the foundation docs/conformance subset of 7/8; coordination = phase 6 plus phase 9 and the coordination subset of 7/10.

## Gate Result

`NOT_READY`. Remediation targets: `specification` for RR-1, RR-6, RR-7, RR-9, RR-13 and the AC/risk portions of RR-10/RR-11; `test_planning` for RR-2, RR-4, RR-5, RR-10, RR-16; `delivery_planning` for RR-3, RR-4, RR-5, RR-7, RR-8, RR-11, RR-14, RR-15. Re-run this gate after the revisions; do not open delivery.

## Evidence Notes

- No source code or change artifact was modified by this review.
- The plan YAML validates against the current validator (`validatePlanValue` returned no errors); that validator ignores unknown keys and does not yet declare `summary`, so phase 4's schema change remains required.
- TDR-0013 exists, is indexed in `doc/decisions/00-index.md`, is authored with `@decision-advisor`, and correctly records the reversal, the sanitized one-shot, and the six-to-five-row retirement. Its `Proposed`/acceptance-pending status follows the TDR-0012 precedent and is not a DoR pause by itself; RR-15 covers the plan/trigger alignment.
