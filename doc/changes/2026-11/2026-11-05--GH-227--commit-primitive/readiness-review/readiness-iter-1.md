# Readiness Review Iteration 1

Verdict: READY
Work Item: GH-227
Date: 2026-11-06
Pause Required: no

Reviewer stance: adversarial. Inputs examined: source ticket GH-227 (GitHub issue, open, labels change+review), `chg-GH-227-spec.md` (v1.1), `chg-GH-227-test-plan.md` (v1.1), `chg-GH-227-plan.yaml` (delivery.plan.v1), `chg-GH-227-pm-notes.yaml`, the binding design `doc/planning/concepts/automated-commit.md` (owner decisions 2026-11-03), SC-M1-12 in `doc/planning/oss-tooling/milestones/m1/test-scenarios.md`, M1 pack pages `commit.md`/`phase.md`, and the current system specs (`feature-result-contract.md`, `feature-pm-notes-lint-and-phase-transitions.md`, `feature-plan-schema.md`, `feature-state-layer.md`, `feature-provider-engine.md`, `feature-config-layer.md`), plus source-code spot checks for baseline fidelity and code-area coverage.

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

## Gate Basis (evidence examined)

- **Ticket AC coverage.** All four ticket ACs map to spec ACs with concrete test assertions: message derives from tree+context without agent authorship → AC-F1-1 (+TC-COMMIT-001 with transport-recorder proof of no caller-supplied subject/staging); plain `phase complete` atomic both-or-neither by default with `--no-commit` transition-only → AC-F6-1/2/5 (+TC-ATOMIC-001/002/005, three-way durable deltas: ledger lines, `git rev-list --count HEAD`, status bytes); stray untracked never staged → AC-F5-1 (+TC-SAFETY-001, index + commit + `?? stray.txt` assertions); re-run after interruption converges → AC-F7-1..4 (+TC-CONVERGE-001..008 incl. negative controls). Commitlint respect (AC-F3-2/3), idempotent re-run (F-7), config opt-out (AC-F6-4), never-in-session (AC-F1-3) all covered.
- **Pinned-decision fidelity (concept, owner decisions 2026-11-03).** Deterministic skeleton + exactly one constrained model call for subject/body/breaking: DEC-2/F-3/AC-F3-1 ✓ (retry nuance in finding 4). Transport seam order core-inference → harness one-shot (temporary empty project context) → marked template fallback, selection by configuration plus capability discovery, failover classified in the event: DEC-3/F-4/AC-F4-1 ✓. Template fallback visibly marked, exit 0, never a failure row: DEC-10, TC-TRANSPORT-003, TC-TABLE-007 ✓. Never inside a delivery session, mechanically enforced: DEC-6, `commit.session.context-refused`, harness one-shot's empty context explicitly not a delivery session ✓. Safety never AI, deterministic, fail-closed, STOP on suspicion: DEC-5/F-5/§21 ✓. Type/scope/ref computed, never model-produced; invented refs stripped: F-2/F-3, TC-MSG-001/005 ✓. Spec safety-before-transport-bundle ordering strengthens (does not contradict) the concept's step-5 placement and satisfies the ticket's "privacy-scanned at the emitter". The two DEC-10 deviations from the M1 pack pages (atomic-abort → exit 2; template fallback as success evidence) are recorded refinements against non-binding "Proposed contract" pages, with pack-page reconciliation planned (task 8.5); the concept pins no exit codes.
- **SC-M1-12 inheritance.** TC-ATOMIC-001/002 quote SC-M1-12 verbatim (line-wrap only); AC-F6-1/2 pin it; Appendix A preserves "divergence after delivery is a defect"; extensions (TC-ATOMIC-003..012, TC-CONVERGE-*) go beyond, not away from, the seed.
- **Plan executability.** Phase ordering is consumes-before-produces (contracts → pure domain → state → adapters → testkit → CLI commit → phase/atomic/golden → finalize); every phase declares concrete `scope.files` verified against the tree (new files named precisely; existing files exist); all testGate commands reference suites/scripts that exist or are created in that same phase's scope (`scripts/checks/error-table-sync.ts`, `testkit-exclusion.ts`, `tests/checks/config-default-positions.test.ts`, `tests/fixtures/state/`, `tests/fixtures/result/code-corpora/` all verified); `pnpm --filter @delivery-os/core build` does regenerate the defaults-positions artifact consumed by the phase-1 gate. `validatePlanValue` on the actual plan artifact (with YAML parsed): **0 errors, 8 phases** — matches the pm-notes claim.
- **Traceability union (sample-verified by full enumeration).** Spec has exactly 23 ACs (counted) and the test plan exactly 70 TC IDs (counted across all prefixes); §3.1 shows 23/23 Covered. Every one of the 23 AC IDs and all 70 TC IDs appear in plan task annotations (enumerated across phases 1–8); union claim is real, not asserted.
- **Internal consistency.** `commitIntent` (`atomic`|`record-only`) and `commitIntentBasis` (`opt-out-flag`|`config-disabled`|`skipped-no-pending-work`) strings are byte-identical across spec §8.2/DM-3/DEC-7, test plan §1/TC-ATOMIC-012 (string-equality assertion + `no-op` envelope-only), and plan task 1.1. Error-row classifications (6 rows, categories, retryable, consequence, projections) identical across spec DM-4, test plan TC-ENV-002, plan task 1.2. Exit projections `{0,1,2}` consistent across artifacts (one enumeration omission → finding 3).
- **System-spec consistency.** `commit` domain kind is additive to `DOMAIN_KINDS` with the sync-check binding (task 1.4); state-layer telemetry record is additive per the `provider.park`/`closeout.operation` precedent; phase-family grammar/matrix/advisories/records preserved (TC-REGRESS-004/005, TC-ATOMIC-008/009 reuse the delivered `outcome: no-op`/`basis: already-completed` vocabulary). Baseline inaccuracy found → finding 2.
- **Doc/code-area coverage.** Task 8.5 lists the system-doc obligations (new feature spec, phase-transitions reconciliation, pack pages, CLI registry row, adapter charter note, decision recording); tasks 1.4/8.3 cover error-table docs and forbidden-literals registration. Code areas explicit per phase.

## Findings

1. [minor, non-blocking] dod_defined — chg-GH-227-spec.md §17–§18 (no consolidated DoD block)
   Gap: The spec defines 23 testable Given/When/Then ACs, NFR thresholds (§9), KPIs (§4.1), and rollout obligations (§18), but — unlike the 2026-10 house style (GH-173 §"Definition of Done — open-PR handoff", GH-182 §"Definition of Done predicates") — never consolidates them into an explicit change-specific Definition of Done (all ACs green with traceable evidence; error-table sync green both directions; `pnpm check` green; docs reconciled incl. pack pages; changeset recorded; open PR vs `main-tools` with CI green). The completion contract is substantively present and testable, so the facet passes (consistent with the GH-226 same-week gate posture), but the consolidated block is the documented standard.
   Suggested remediation target phase: specification
   Suggested fix: Add a short "Definition of Done" paragraph consolidating the completion-evidence predicates; no AC changes needed.

2. [minor, non-blocking] system_spec_consistency — chg-GH-227-spec.md §8.3 DM-3 (line 218)
   Gap: DM-3 calls `state`, `commitSha`, `atomic` "existing fields" of the `phase complete` envelope. The delivered GH-179 success data is `{changeRef, phase, operation, outcome, timestamp, variant, reason?, advisory?, evidence}` (`packages/cli/src/commands/phase.ts` transitionTarget/noOp); `state`/`commitSha`/`atomic` are new additive fields of this change. Also the `state` value vocabulary is unpinned (test plan TC-ATOMIC-001 asserts `state: completed`; pack page phase.md proposes `complete|reopened`). Risk is confined to phase-7 doc reconciliation misstating the additive delta; the fields themselves are named and tested everywhere they matter.
   Suggested remediation target phase: specification
   Suggested fix: Relabel the three as new additive fields, note the delivered field set, and either pin the `state` value vocabulary or defer it explicitly under DEC-14.

3. [minor, non-blocking] cross_artifact_consistency — chg-GH-227-spec.md §8.1 exit table (line 200)
   Gap: The `phase complete` exit-1 enumeration ("invalid phase, safety STOP, staging blocked, session-context refusal") omits `commit.commitlint-failed`, which §8.5 (line 245) says can fire on that surface ("callers … must now handle `commit.*` identities on that command") since the atomic act performs message generation/validation. The error table itself classifies it correctly (user, exit 1); only the §8.1 enumeration is incomplete.
   Suggested remediation target phase: specification
   Suggested fix: Add "commitlint failure" to the exit-1 list for `phase complete <ref> <phase>`.

4. [minor, non-blocking] spec_completeness — chg-GH-227-spec.md §4.1 KPI row "Model calls per commit" + §9 NFR-1 (line 252) vs F-3/DEC-4 and test plan TC-MSG-006/007
   Gap: "Exactly one model call per commit attempt" / KPI "Exactly one" is falsified by the spec's own retry path: one lint-feedback retry means two calls in one attempt (TC-MSG-006 asserts "two calls total, never three"; TC-MSG-007 two failed calls then template). The binding concept carries the same looseness ("exactly one AI touch" + "one retry"); the test plan pins the real semantics, so no coverage is lost — the NFR/KPI phrasing should match it.
   Suggested remediation target phase: specification
   Suggested fix: Rephrase to "exactly one generation call on the happy path; at most one deterministic lint-feedback retry; zero calls on empty/fully-excluded sets and on the template path".

5. [nit, non-blocking] spec_completeness — ticket Tasks paragraph vs spec NG-1 (§4.2) + plan task 8.6
   Gap: The ticket expects "the PM's ledger transitions and the coder's plan-phase completions trigger the commit automatically, with no agent iteration spent on the commit act". Under DEC-6's session-context guard, invocation from inside a delivery session is refused (plan task 8.6's own dogfood analysis), so session-driven agents cannot invoke the primitive until the NG-1 adoption change defines the out-of-session invocation path (detached subprocess, CI, human). This is inherent to the binding concept guardrail ("the commit never runs inside a delivery session; callers invoke the tool"), explicitly parked (NG-1, §13 soft-blocks), and no ticket AC requires in-session invocation — but the invocation-path question must not be lost.
   Suggested remediation target phase: specification (record-only note; no reopen required)
   Suggested fix: Add one line to pm-notes decision log: "NG-1 adoption change must define how in-session agents trigger `phase complete` out-of-session (detached invocation or equivalent)".

6. [nit, non-blocking] system_spec_consistency — chg-GH-227-spec.md §2.1 (line 36)
   Gap: "Existing domains: `lint`, `state`, `verify`, `db`, `closeout`, `plan`, `watchdog`" lists 7 of the 10 delivered `DOMAIN_KINDS` (`provider`, `input`, `config` omitted), understating the baseline the `commit` kind joins.
   Suggested remediation target phase: specification
   Suggested fix: Complete the enumeration or mark it explicitly partial.

7. [nit, non-blocking] cross_artifact_consistency — chg-GH-227-test-plan.md front matter (line 13, `implementation_plan: null`) + §1.2 GAP-1 (line 51)
   Gap: Stale after delivery planning: the plan artifact now exists, validates (0 errors), and maps all 70 TCs without reshaping them. GAP-1's "No chg-GH-227-plan.yaml/.md exists at authoring time" remains as if unresolved.
   Suggested remediation target phase: test_planning
   Suggested fix: At the next test-plan touch (plan task 8.4 already opens the file), set the implementation_plan link and mark GAP-1 resolved by delivery planning.

8. [nit, non-blocking] test_traceability — chg-GH-227-spec.md F-1 (line 100) + test plan §5.2
   Gap: Grammar permits `commit <ref> --phase <phase> --dry-run`, but the combined semantics (does dry-run in phase-centric mode disclose the would-be transition? — "changes nothing" is implied but unstated) are unspecified and untested (TC-COMMIT-002/003 are standalone dry-runs).
   Suggested remediation target phase: test_planning (or delivery-time refinement recorded per DEC-14)
   Suggested fix: One sentence in F-1 (dry-run in phase mode prints the would-be record+commit and lands neither) and optionally one TC.

9. [nit, non-blocking] decision_capture — plan task 2.5 (OQ-T4 criterion) vs concept header "body presence decided by the model"
   Gap: The deterministic body-required criterion (">1 declared scope area") tightens the concept header's "body presence decided by the model"; it is supported by the concept's own step-3 clause ("must include one when there is content an auditor needs") and is recorded as a delivery decision — but task 8.5's record-against-spec step should explicitly reconcile it with the header phrasing so the adoption/audit trail shows it as a resolution of the concept's internal tension, not an override of a pinned decision.
   Suggested remediation target phase: delivery_planning (recording obligation wording only)
   Suggested fix: Extend task 8.5's OQ-T4 recording note to cite the concept step-3 clause it operationalizes.

## Notes for the record

- No prior readiness-review records existed for GH-227; this is iteration 1. No findings are persistent/repeated.
- All nine findings are non-blocking; none flips a facet to FAIL. Remediation targets are specification (findings 1–4, 6), test_planning (7–8), delivery_planning (9), and a pm-notes note (5). None reopens delivery.
- Verified strong (no finding needed): SC-M1-12 verbatim inheritance; identical commitIntent/basis and error-row vocabularies across all three artifacts; plan validates against `delivery.plan.v1` with 0 errors; 23/70 traceability union enumerated and real; all testGate commands runnable against existing or in-phase suites/scripts; DEC-10 pack-page refinements recorded with reconciliation planned; dependencies GH-172/GH-179/GH-226 delivered per feature specs and pm-notes verification.
