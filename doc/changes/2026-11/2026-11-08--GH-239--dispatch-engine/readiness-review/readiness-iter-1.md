# Readiness Review Iteration 1

Verdict: NOT_READY
Work Item: GH-239
Date: 2026-11-08
Pause Required: no

> Canonical mirror of the report requested at `../readiness/readiness-iter-1.yaml`.
> This pass did not modify the spec, test plan, or plan.

## Facet Summary
- spec_completeness: FAIL
- ac_quality: FAIL
- plan_coverage: FAIL
- test_traceability: PASS
- cross_artifact_consistency: FAIL
- decision_capture: FAIL
- system_spec_consistency: PASS
- plan_doc_update_coverage: PASS
- plan_code_area_coverage: PASS
- dod_defined: FAIL

## Findings

### F1 — [critical] ac_quality: the four-condition gate cannot be satisfied
Artifact: `chg-GH-239-spec.md` §5.1 F-4, §17 AC-F4-4 / AC-F5-2, §7.1 Glossary "Counted dispatch", §15 DEC-11, Appendix B; `chg-GH-239-test-plan.md` TC-TRUTH-003, TC-TRUTH-006, TC-GATE-007, TC-E2E-001.
Gap: Class coverage requires all eleven tokens, including `state-unverified` and `pr-open-unverified`. A `state-unverified` result exists only because a truth read failed, so no independent comparison can be derived; TC-TRUTH-006 calls the record "unevaluable" and says it "blocks eligibility", and the counted-dispatch definition requires a complete comparison field, so it can never count. `pr-open-unverified` is required for coverage, yet TC-TRUTH-003 says its "corroboration is explicitly unsatisfied", failing AC-F5-2. Either path alone makes eligibility unreachable; together the controlled E2E (AC-F8-1/TC-E2E-001) is impossible. There is no resolution surface for unevaluable records, only for divergences.
Suggested remediation target phase: specification.
Suggested fix: Define exposure-only class treatment: `state-unverified` counts toward class coverage, is not a success claim, creates no divergence, and does not block by itself; an unreadable read degrades that record, not the window. Make `pr-open-unverified` corroboration the tracker fact per Appendix B and carry the URL failure as an attribute, not a divergence. Add a positive gate/E2E case with all eleven classes and update TC-TRUTH-003/006, TC-GATE-007, TC-E2E-001.

### F2 — [critical] spec_completeness: counted evidence cannot include the controlled-proof dispatches
Artifact: `chg-GH-239-spec.md` Glossary "Counted dispatch", §5.1 F-8, AC-F8-1, DM-1, EVT-1, §4.1 KPI; `chg-GH-239-test-plan.md` TC-E2E-001, §6.3; `chg-GH-239-plan.yaml` phase 10.
Gap: The E2E proof reaches eligibility only with controlled-repository/fixture dispatches, but "fixture or smoke runs are excluded" from counted dispatches and DM-1/EVT-1 carry no field that distinguishes a counted pilot dispatch from a fixture/smoke/controlled-proof run. Plan phase 10 ("accrues evidence through genuine dispatch invocations until the gate is met") therefore contradicts the spec's counting rule.
Suggested remediation target phase: specification.
Suggested fix: Add a declared evidence-class/counted discriminator to `delivery.dispatch.attempt.v1` (e.g. `evidenceClass: pilot | controlled-proof | smoke | fixture`), define the gate's counting rule over it, and state how controlled-proof runs are designated. Align the glossary, AC-F8-1, DM-1/EVT-1, plan phase 10, and TC-E2E-001.

### F3 — [major] spec_completeness: incident-reset window boundary is undefined and recovery is untested
Artifact: `chg-GH-239-spec.md` DEC-10, AC-F4-3, AC-F5-2, Appendix B; `chg-GH-239-test-plan.md` TC-GATE-009, TC-EVID-003.
Gap: The window starts at the most recent incident, but inclusivity is undefined. If inclusive, the resetting incident remains in the window forever, so zero in-window incidents can never hold, contradicting DEC-10's rationale that recovery must be possible. No test asserts that post-incident re-accrual can make the gate eligible.
Suggested remediation target phase: specification.
Suggested fix: Define the window as exclusive of the resetting incident (e.g. `(incidentTime, now]`) and name the incident as the start reason. Add a recovery test (incident at T, sufficient post-T evidence, then eligible). Update TC-GATE-009/TC-EVID-003.

### F4 — [major] cross_artifact_consistency: spec "any dispatch" vs D6 pre-session no-record
Artifact: `chg-GH-239-spec.md` §5.1 F-4 and AC-F4-1; `chg-GH-239-pm-notes.yaml` D6; `chg-GH-239-test-plan.md` §1.2, §8.3 OQ-T2, TC-DISP-002, TC-EVID-001.
Gap: AC-F4-1 says every dispatch appends exactly one attempt record; D6 says pre-session harness/input/lease refusals append none. The test plan keeps this as an interpretation, still lists OQ-T2 as open, and TC-DISP-002 keeps the record policy conditional, so D6 is unenforced.
Suggested remediation target phase: specification.
Suggested fix: Fold D6 into F-4/AC-F4-1 ("every dispatch that reaches classification; pre-session refusals are envelope-only"), close OQ-T2, and make TC-DISP-002 assert no attempt record for pre-session refusals.

### F5 — [major] dod_defined: the DoD forbids a doc/spec edit the plan must make
Artifact: `chg-GH-239-spec.md` §17.1 DoD ("No `doc/spec/**` file is modified"), §7.2, §16; `chg-GH-239-test-plan.md` §1.2; `chg-GH-239-plan.yaml` phase 1 and header.
Gap: Plan phase 1 edits `doc/spec/features/feature-result-contract.md` for the two documented error rows (mechanically required by the two-way sync and the 113-count assertions), while the DoD forbids any doc/spec modification and the test plan says "No `doc/spec/**` edits"; spec §22 also requires phase-7 reconciliation. The DoD is false as written and the scope language is self-contradictory. The plan's doc/spec touch is justified.
Suggested remediation target phase: specification.
Suggested fix: Reword the DoD to "no current-truth reconciliation during delivery; the only doc/spec touch is the two documented error rows required by the two-way sync; all other reconciliation belongs to system_spec_update." Align §7.2/§16 and test-plan §1.2.

### F6 — [major] plan_coverage: daemon lane classification and attempt record are unowned
Artifact: `chg-GH-239-spec.md` AC-F10-2, §10 telemetry, AC-F4-1; `chg-GH-239-plan.yaml` phase 9; `chg-GH-239-test-plan.md` TC-DAEMON-002.
Gap: AC-F10-2 requires the daemon path's final token/outcome to agree with one-shot dispatch, and §10 says daemon-driven dispatches additionally leave the attempt record. The delivered lane record has only alive/interrupted/crashed, not a delivery token. Phase 9 names the planner/executor composition but no classification + attempt-record append point, so TC-DAEMON-002's "compare the final token and outcome" has no owned producer.
Suggested remediation target phase: delivery_planning.
Suggested fix: Add the classification and attempt-record append step (and its file) to phase 9 with a test comparing it to a one-shot dispatch, or explicitly reconcile that daemon lanes append no attempt record and amend AC-F10-2/§10.

### F7 — [major] cross_artifact_consistency: pilot-isolation test is not a production-surface absence assertion
Artifact: `chg-GH-239-plan.yaml` phase 7; `chg-GH-239-spec.md` §2.1, AC-F11-3; `chg-GH-239-test-plan.md` TC-HELP-003.
Gap: `tests/conformance/pilot/pilot-isolation.test.ts` asserts a deliberately reduced test-only fixture's exact command list and that the fixture does not import production/entrypoint. Delivering the production command does not contradict that reduced fixture; forcing `dispatch` into it would expand scope and weaken the isolation guard. The other two absence assertions (entrypoint composition, harness-review deferrals) are genuine.
Suggested remediation target phase: specification.
Suggested fix: Narrow the pilot-isolation assertion (keep the reduced fixture and retire the "dispatch absence" wording) or explicitly justify composing dispatch there; adjust AC-F11-3 and TC-HELP-003.

### F8 — [major] ac_quality: fallback repository identity cannot survive a checkout rename
Artifact: `chg-GH-239-spec.md` DEC-13, §12 assumption, AC-F6-2/AC-F6-4; `chg-GH-239-test-plan.md` TC-HAND-006.
Gap: DEC-13's rationale requires identity to survive checkout-path renames, but its fallback is "a stable digest of the declared checkout root", which changes when the path is renamed. The primary `repository` value (normalized host/owner/name) is rename-stable; the no-remote fallback is not. TC-HAND-006 is must-pass and asserts an undefined "stable across a checkout rename" property.
Suggested remediation target phase: specification.
Suggested fix: Anchor the fallback to a rename-invariant identity or state that the path-derived fallback changes on rename and remove the stability claim/assertion.

### F9 — [major] decision_capture: durable gate semantics live only in the change spec
Artifact: `chg-GH-239-spec.md` DEC-10, DEC-12, DEC-13, §7.3; no `doc/decisions/**` record.
Gap: The incident-reset window, UTC day floor, and repository identity rule are system-wide handover-gate semantics that outlive the change folder, but only the change spec records them. GH-266 amended the backlog with the four conditions, not these refinements.
Suggested remediation target phase: specification (route to @decision-advisor).
Suggested fix: Propose a decision record (TDR/ADR) or sanctioned handoff for the gate window/floor/identity semantics before delivery; record the handoff in the spec decision log and pm-notes.

### F10 — [minor] plan_code_area_coverage: phase 1 omits the count/prose invariants
Artifact: `chg-GH-239-plan.yaml` phase 1.
Gap: Phase 1 adds two rows but does not name the mechanical updates: four `toHaveLength(113)` assertions and `doc).toContain("113 identities")` in `tests/structure/error-table.test.ts`, the doc frontmatter/prose "two dispatch economics rows"/"113 identities", and the "not yet declared (M1-S9)" sentence (113 → 115).
Suggested remediation target phase: delivery_planning.

### F11 — [minor] ac_quality: family-wise comparison is undefined for the unverified tracker token
Artifact: `chg-GH-239-spec.md` DEC-3, Appendix B; `chg-GH-239-test-plan.md` TC-GATE-008.
Gap: Comparing `pr-open-unverified` with independent tracker truth (`pr-open`) creates a permanent divergence; comparing with the same failed URL read is not independent. "Outcome-level comparison with a not-applicable baseline" for dispatch-session tokens is also undefined, and TC-GATE-008 says not-applicable never creates a divergence, making it vacuous.
Suggested remediation target phase: specification.
Suggested fix: State the exact comparison record for `pr-open-unverified` and that dispatch-session tokens are exposure-only with an explicit not-applicable comparison.

### F12 — [minor] ac_quality: AC-F8-1 "genuine ports" conflicts with the injected-port proof
Artifact: `chg-GH-239-spec.md` AC-F8-1, §5.1 F-8.
Gap: "Genuine harness, tracker, CI, and state ports" reads as real external adapters, which would violate the proof boundary; F-8 and the plan use injected external ports with real state/git.
Suggested remediation target phase: specification.
Suggested fix: Reword to "real state and command path with injected external harness/tracker/CI/VCS ports and a no-hand-insertion provenance guard".

### F13 — [minor] ac_quality: degraded-summary exit code is unpinned
Artifact: `chg-GH-239-spec.md` AC-F5-4; `chg-GH-239-test-plan.md` TC-GATE-006.
Gap: The exit code for an unverifiable/truncated summary (0 vs 2) is unspecified, so the AC cannot fail on the exit dimension.
Suggested remediation target phase: specification.
Suggested fix: Pin the exit code in AC-F5-4 and TC-GATE-006.

### F14 — [nit] cross_artifact_consistency: ticket "preserved exactly" vs four-key contract
Artifact: GH-239 ticket pinned decision; `chg-GH-239-spec.md` DEC-8, Appendix D; M1 `contracts.md` §dispatch.
Gap: DEC-8's four keys match the canonical M1 dispatch contract, but the ticket's "preserved exactly" (bash emits five keys incl. `closeout_unverified=`) is not recorded as superseded the way the two-week wording is.
Suggested remediation target phase: specification.
Suggested fix: Add the explicit trace line that "preserved exactly" is read against the canonical four-key contract and `closeout_unverified` is bash-internal.

### F15 — [nit] plan_code_area_coverage: shared barrels omitted from the ownership note
Artifact: `chg-GH-239-plan.yaml` header.
Gap: `packages/core/src/index.ts`, `packages/core/src/domain/index.ts`, and `packages/core/src/app/index.ts` are touched by four to five phases but are not in the cross-phase ownership list.
Suggested remediation target phase: delivery_planning.

### F16 — [nit] test_traceability: OQ-T2 remains open while D6 claims resolution
Artifact: `chg-GH-239-test-plan.md` §8.3; `chg-GH-239-pm-notes.yaml` D6.
Gap: OQ-T2 is still listed as open with a proposed answer and TC-DISP-002 keeps conditional wording. The traceability matrix itself is complete (47/47 ACs, 78 TCs, SC-M1-26..30 mapped).
Suggested remediation target phase: test_planning.

## Positive verification (not findings)
- Plan YAML parses and passes `validatePlanValue` with zero errors (schema `delivery.plan.v1`, tier `full`, 10 phases).
- `DELIVERY_RESULT_TOKENS`/taxonomy match spec Appendix A exactly; the two existing dispatch error rows exist and the two new identities are absent as claimed; `LaneLaunchPlanner`/`LaneExecutorPort`/`createLaneExecutor` and `runSupervisionCycle` exist; `lane.restart-budget`/`lane.liveness-interval` exist; the bash five-key order exists; the three absence assertions exist.
- All 47 ACs map to at least one TC and all seeded scenarios SC-M1-26..30 are mapped; no orphan TCs by the plan's matrix.
- No plan phase edits the GH-239 ticket body or the forbidden planning residual; phase 7 edits only the story-owned `commands/dispatch.md` and the two seeded scenarios.

## Decision routing
- change: F3, F4, F11, F12, F13 (spec/test-plan wording).
- system / precedent-setting: F9 (handover window/floor/identity semantics) — propose a decision record; `@pm` delegates to `@decision-advisor`.
- needs_human_input: none.
