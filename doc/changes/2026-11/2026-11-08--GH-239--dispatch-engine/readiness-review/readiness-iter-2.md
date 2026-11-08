# Readiness Review Iteration 2

Verdict: NOT_READY
Work Item: GH-239
Date: 2026-11-08
Pause Required: no

> Canonical mirror of `../readiness/readiness-iter-2.yaml`.
> This pass did not modify the spec, test plan, or plan.

## Facet Summary
- spec_completeness: PASS
- ac_quality: PASS
- plan_coverage: FAIL
- test_traceability: PASS
- cross_artifact_consistency: FAIL
- decision_capture: PASS
- system_spec_consistency: PASS
- plan_doc_update_coverage: PASS
- plan_code_area_coverage: PASS
- dod_defined: PASS

## Verdict Basis

Iteration-1 findings F1-F9 and F11-F16 are CLOSED; F10 is PARTIALLY CLOSED. The core
root causes are resolved: the four-condition gate is now jointly satisfiable
(exposure-only coverage, tracker-corroborated `pr-open-unverified`, record-level
degradation), the controlled proof can count its own `controlled-proof` evidence,
the incident window is exclusive and recoverable, `pr-open-unverified` has a
tracker-state comparison, repository identity is rename-invariant with a clean
refusal, and TDR-0015 is the Proposed durable home of the gate semantics.

A new **major** plan-coverage defect remains (N1): the plan assigns behaviour-level
test cases that require the phase-4 dispatch command, the phase-6 summary/gate, and
the phase-8 bash fallback to phases 2 and 3, so those phases cannot be
independently green. The plan also contradicts its own TC ownership statement by
placing TC-EVID-002 in phase 6 while the header assigns it to phase 3.

## Iteration-1 Finding Dispositions

| ID | Severity (iter 1) | Disposition | Evidence |
|---|---|---|---|
| F1 | critical | CLOSED | spec F-4/AC-F4-4/AC-F5-2/AC-F5-5/Appendix B; TC-TRUTH-003/006, TC-GATE-007; TDR-0015 §1 |
| F2 | critical | CLOSED | spec F-4/AC-F4-5/AC-F8-3, DM-1/EVT-1, Appendix B scoping; TC-EVID-006, TC-GATE-011, TC-E2E-001; plan phase 10; TDR-0015 §2 |
| F3 | major | CLOSED | spec DEC-10, AC-F5-6, Appendix B window; TC-GATE-009, TC-EVID-003; TDR-0015 §3 |
| F4 | major | CLOSED | spec AC-F4-1, DEC-19, Appendix E D6; test-plan §1.2, OQ-T2 Resolved, TC-DISP-002, TC-EVID-001 |
| F5 | major | CLOSED | spec §17.1 DoD, §7.2, §16; test-plan §1.2; plan phase 1 and header |
| F6 | major | CLOSED | plan phase 9 (`daemon-dispatch-result.ts`, `recordDaemonDispatchResult`); TC-DAEMON-002; test-plan §7.4 |
| F7 | major | CLOSED | spec §2.1/F-11/AC-F11-3/DEC-4; test-plan §1.4 row 12, TC-HELP-003; plan phase 7 note |
| F8 | major | CLOSED | spec DEC-13/§12/AC-F6-6; TC-HAND-007; TDR-0015 §6; delivered `normalizeRepositoryKey`/`ensureStoreArtifact` |
| F9 | major | CLOSED | TDR-0015 (Proposed), spec DEC-20, plan phase 1, 00-index/00-register |
| F10 | minor | PARTIALLY CLOSED | phase 1 names 113-count/row invariants but omits `RESERVED_TWO_SEGMENT_CODES` + `toHaveLength(35)` and `delivered` `toHaveLength(112)`; see N2 |
| F11 | minor | CLOSED | spec DEC-3/AC-F4-6/Appendix B; TC-GATE-008, TC-EVID-007; TDR-0015 §5 |
| F12 | minor | CLOSED | spec AC-F8-1/F-8; TC-E2E-001/003; plan phase 10 |
| F13 | minor | CLOSED | spec AC-F5-4, §17.1 DoD; TC-GATE-006, TC-NFR-004 |
| F14 | nit | CLOSED | spec §2.1, DEC-8, Appendix D |
| F15 | nit | CLOSED | plan header cross-phase ownership note |
| F16 | nit | CLOSED | test-plan §8.3 OQ-T2 Resolved; TC-DISP-002 deterministic |

## Findings

### N1 — [major] plan_coverage: phases 2-3 cannot be independently green
Artifact: `chg-GH-239-plan.yaml` header and phases 2, 3, 6 scope/tests; `chg-GH-239-test-plan.md` TC-TRUTH-001..006, TC-EVID-001..005, TC-EVID-002, TC-EVID-007.
Gap: The plan claims each phase is independently green, but phase 2 owns behaviour-level TCs that require later phases. TC-TRUTH-001..005 invoke `dispatch <ref>` (dispatch is phase 4); TC-TRUTH-006 runs the summary, evaluates the gate, and invokes a bash entry point (phases 6 and 8). Phase 3 owns TC-EVID-003/004 (behaviour: dispatch + summary + gate) and TC-EVID-007 step 5 (summary/handover parity), which do not exist until phase 4/6. The header also assigns TC-EVID-002 to phase 3, but `tests/behaviour/dispatch-divergence.test.ts` is scoped and run in phase 6. The plan's own note says command/output/record assertions bind "from phase 4", contradicting phases 2-3 running those files.
Suggested remediation target phase: delivery_planning.
Suggested fix: Split the scenarios so phases 2-3 keep pure-domain/ledger assertions and move behaviour-level parts to phase 4/6, or reorder phases; reconcile the TC ownership and per-phase counts with `@test-plan-writer`.

### N2 — [minor] plan_code_area_coverage: F10 count invariants still incomplete
Artifact: `chg-GH-239-plan.yaml` phase 1; `tests/structure/error-table.test.ts:1374,1761`.
Gap: Phase 1 omits `RESERVED_TWO_SEGMENT_CODES` gaining `dispatch.state-unverified` and its `toHaveLength(35)` → 36 assertion, and the spend test's `delivered` `toHaveLength(112)` → 114 assertion. Both fail when the table grows to 115.
Suggested remediation target phase: delivery_planning.

### N3 — [minor] cross_artifact_consistency: phase-1/7 duplicate inversion claim
Artifact: `chg-GH-239-plan.yaml` phase 1 scope and phase 7 scope; header ownership note.
Gap: Both phases claim to invert `tests/structure/harness-review-deferrals.test.ts`, and the file is not in the cross-phase ownership declaration. Phase 1 must invert it (it adds the spawn-failure row), so phase 7's claim is redundant.
Suggested remediation target phase: delivery_planning.

### N4 — [minor] spec_completeness: result token unpinned for three failure identities
Artifact: spec F-4/AC-F4-1, AC-F1-4, F-12; test-plan TC-EVID-001, TC-ERR-001, TC-DISP-009.
Gap: The result token for `dispatch.session.spawn-failed`, `dispatch.restart-budget-exceeded`, and `dispatch.resume-uneconomical` is not declared, while the attempt record must carry a token and TC-EVID-001 expects one for the two refusals. TC-ERR-001 leaves the spawn-failure record policy as "if any".
Suggested remediation target phase: specification.

### N5 — [nit] plan_coverage: "pre-session harness refusal" wording
Artifact: `chg-GH-239-plan.yaml` phase 2 summary.
Gap: `noop-lane-permission` is called a "pre-session harness refusal", but the glossary reserves "Pre-session refusal" for the DEC-19 no-record cases; this risks conflating spawn-refused with the unrecorded refusals.
Suggested remediation target phase: delivery_planning.

### N6 — [nit] spec_completeness: "complete" in the Counted dispatch glossary
Artifact: spec §23 Glossary "Counted dispatch".
Gap: "complete" could exclude unevaluable non-success records, while F-4/AC-F4-4 explicitly count them for coverage. Clarify that "complete" means present with an explicit unknown/not-applicable marker.
Suggested remediation target phase: specification.

## Positive Verification (not findings)
- `chg-GH-239-plan.yaml` parses and passes `validatePlanValue` with zero errors (`delivery.plan.v1`, tier `full`, 10 phases).
- 53/53 ACs and 82/82 TCs are present and mapped; SC-M1-26..30 are mapped; zero orphan TCs.
- Ticket ACs and pinned decisions trace to spec ACs, TCs, and phases; the stale two-week wording is traced to DEC-1/D1 and amended backlog M1-S9.
- TDR-0015 is `Proposed`, registered in `00-index.md`/`00-register.md`, and included in plan phase 1 scope.
- The only planned `doc/spec/**` edit is `feature-result-contract.md` (two documented error rows, mechanically required by the two-way sync); no ticket or forbidden planning edit is planned.
- Delivered infrastructure claims were spot-checked: the two existing dispatch rows and 113-count invariants, the daemon seam, `normalizeRepositoryKey`, `ensureStoreArtifact`, the pilot-isolation reduced fixture, and the entrypoint-composition/harness-review-deferrals absence assertions.

## Decision Routing
- change: N2, N3, N4, N5 (plan/test-plan/spec alignment).
- system: none new; TDR-0015 remains Proposed pending owner acceptance at PR review.
- needs_human_input: none; no pause flag.
