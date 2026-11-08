# Readiness Review Iteration 3

Verdict: READY
Work Item: GH-239
Date: 2026-11-08
Pause Required: no

> Canonical mirror of `../readiness/readiness-iter-3.yaml`.
> This pass did not modify the spec, test plan, or plan, and performed no git operation.

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

Counts: 0 critical, 0 major, 2 minor, 5 nit — all non-blocking.

## Verdict Basis

The iteration-2 remediation is real and verifiable, not rhetorical. Test-plan Section 7.5 now
declares the earliest executable phase, the per-phase slices, and the cross-phase confirmations
for all 82 TCs, and the plan repeats the same declaration. Re-mapping every plan phase's `tests`
commands to files, files to TCs, and TCs to Section 7.5 shows that phases 2 and 3 run only
pure-domain and durable-ledger files — no `dispatch` command, no `dual-run summary`, no
`handover`, no bash invocation — while command/output/exit/golden slices start at phase 4,
summary/gate/handover at phase 6, registration at phase 7, bash at phase 8, daemon at phase 9,
and the controlled proof at phase 10. The iteration-1 root causes stay resolved: the gate is
reachable with all eleven classes (exposure-only `state-unverified`, tracker-corroborated
`pr-open-unverified`), evidence-class counting prevents cross-scope inflation, the incident
window is exclusive and recoverable, corroboration is family-wise, repository identity is
rename-invariant with a clean refusal, and TDR-0015 is the Proposed durable home.

Every ticket acceptance criterion and pinned decision traces to spec ACs, TCs, and phases; the
53 ACs, 82 TCs, and ten phases are complete and orphan-free; the only `doc/spec/**` touch is the
mechanically required error-table row data plus the counts the same phase's tests enforce; the
decision-record files are in phase-1 scope; and no forbidden planning or ticket edit is planned.
Seven residual issues remain, all inside already-declared scopes and none of which makes a phase
non-green or leaves a requirement unowned.

## Iteration-2 Finding Dispositions

| ID | Severity (iter 2) | Disposition | Evidence |
|---|---|---|---|
| N1 | major | CLOSED | Test-plan §7.5 (all 82 TCs: earliest phase, slices, confirmations; counts 5/12/8/12/4/17/4/5/3/12); plan header + per-phase declarations match; mechanical re-map shows phases 2-3 are pure-domain/ledger-only; TC-EVID-002 owned by phase 6, phase-3 primitive in TC-EVID-005. Residual declaration omissions are R2/R7 (non-blocking). |
| N2 | minor | CLOSED | Phase 1 pins `RESERVED_TWO_SEGMENT_CODES` + `toHaveLength(35)→36` (error-table.test.ts:1374), delivered `toHaveLength(112)→114` (1761), four `toHaveLength(113)→115`, the `113 identities` phrase, `DISPATCH_ROWS` 2→4, dispatch kind 2→4, and the sync `dispatch: 2→4` (error-table-sync.test.ts:1112); all verified in code. Same-class residual in the sync file is R1. |
| N3 | minor | CLOSED | `harness-review-deferrals.test.ts` is phase-1-owned and in the header cross-phase note; phase 7's scope excludes it and its summary forbids editing/re-running it; phase 7 keeps only the entrypoint inversion and the narrowed pilot comment. |
| N4 | minor | CLOSED | Appendix G pins attempt-record policy, token, outcome, exit, and comparison treatment per failure class; referenced from F-2/F-3/F-4/F-12, DM-1, EVT-1, DEC-19, AC-F2-4, AC-F4-1, AC-F12-1/2, the DoD, and asserted by TC-DISP-009/010/011, TC-EVID-001, TC-ERR-001/002, TC-RESUME-002/003. |
| N5 | nit | CLOSED | No artifact calls a spawn refusal pre-session; glossary separates "Pre-session refusal" from "Spawn-refused"; plan phase 2 says "a harness refusal before a session exists (spawn-refused)"; test-plan rule 19 + TC-DISP-002/011 assert the contrast. |
| N6 | nit | CLOSED | Glossary "Counted dispatch", DM-6, and NFR-10 define "complete" as present with an explicit value or explicit not-applicable marker, never satisfied, and count unevaluable non-success records for exposure. |

## Iteration-1 Regression Check

F1-F16 remain CLOSED with no regression; F10 (partially closed in iteration 2) is now fully closed.
Verified: exposure vs clean separation (F1), evidence class (F2), exclusive window (F3), DEC-19
record policy (F4), single doc/spec touch (F5), daemon-path attempt-record producer (F6), reduced
pilot fixture (F7), rename-invariant identity (F8), TDR-0015 ownership (F9), count invariants
(F10), comparison record shape (F11), real-state/injected-port proof (F12), pinned degraded exits
(F13), four-key trace (F14), shared barrels in cross-phase ownership (F15), OQ-T2 resolved (F16).

## Findings

### R1 — [minor] plan_code_area_coverage: phase-1 invariant enumeration misses three sync-file counts
Artifact: `chg-GH-239-plan.yaml` phase 1 summary; `tests/checks/error-table-sync.test.ts:1079,1080,1160,1183`.
Gap: The phase lists the 113/112/35/2 invariants it must update but not the three `BASELINE_ROWS.length + 79` assertions in the sync suite (baselineViolations, the unchanged-copy control, the db suite). At 115 rows all three fail, so phase 1 is green only after an edit the enumeration does not name. The plan's binding general clause ("change every count, reserved-set, and row invariant the same phase's tests enforce") covers it and the file is already in scope.
Suggested remediation target phase: delivery_planning.
Suggested fix: add "`BASELINE_ROWS.length + 79` → `+ 81` at all three sites (including the failure message)" to the phase-1 summary.

### R2 — [minor] cross_artifact_consistency: TC-HELP-003's phase-1 slice is undeclared
Artifact: test-plan §7.1 / §7.5 (TC-HELP-003 row); plan header phase lists, phase 1 and phase 4 tests.
Gap: TC-HELP-003 spans three files across phases 1/4/7. Section 7.5 gives earliest phase 7 and lists only the P4 pre-inversion run and the P7 completion, omitting the phase-1 inversion of `tests/structure/harness-review-deferrals.test.ts`. Plan phase 1 runs and inverts that file while declaring "confirmations: none", and phase 4 runs the entrypoint-composition file without listing TC-HELP-003 in its confirmations. The plan's phase-1/phase-7 prose is unambiguous, so no phase goes red; the declaration is what is incomplete.
Suggested remediation target phase: test_planning.
Suggested fix: add the P1 harness-review slice to the §7.5 TC-HELP-003 row (executable slices + cross-phase column); add TC-HELP-003 (harness-review slice) to plan phase 1 and TC-HELP-003 (pre-inversion entrypoint run) to phase 4's confirmations. Ownership and counts are unchanged.

### R3 — [nit] decision_capture: TDR-0015 is untracked while the committed indices reference it
Artifact: `doc/decisions/TDR-0015-dispatch-handover-gate-operational-semantics.md`; `00-index.md:41`; `00-register.md:14,34,38`.
Gap: The record exists only in the working tree; the indices were committed in `adcc7d83`, so the branch currently carries a committed link to a missing file until the record is added.
Suggested remediation target phase: delivery_planning.
Suggested fix: commit the TDR with this verdict (or confirm phase 1's commit adds it) before any PR.

### R4 — [nit] decision_capture: TDR-0015 §5 under-declares the dispatch-derived `failed` comparison
Artifact: `doc/decisions/TDR-0015...md` §5; spec Appendix G.
Gap: Appendix G sends the spawn-failure and resume-economics `failed` pairs to not-applicable/`comparison-source-unavailable`, while TDR-0015 §5 names only `state-unverified` as the not-applicable exception inside verify-change. A consumer implementing only TDR-0015 re-derives the family and lands on the same record-level degradation, so the outcome agrees, but the durable home is under-declared.
Suggested remediation target phase: specification.
Suggested fix: add one clause to TDR-0015 §5 naming the two dispatch-derived `failed` pairs as not-applicable/`comparison-source-unavailable` (the file is already in phase-1 scope).

### R5 — [nit] spec_completeness: the "resident daemon live" prerequisite is untraced
Artifact: spec §2.1 and §5.1 F-6; GH-239 body; backlog M1-S9 phasing; GH-266 spec line 33.
Gap: The ticket and canonical backlog say handover "additionally requires the resident daemon live (M1-S18) and the evidence window elapsed". The spec supersedes the window wording (DEC-1) and delivers the daemon seam (F-10/D5) but never says whether daemon-live is a satisfied sequencing prerequisite or a fifth gate condition. The four-condition `clean` definition and the state-based `dispatch` contract make the reading inferable, not traced.
Suggested remediation target phase: specification.
Suggested fix: add one sentence (or DEC) recording that M1-S18 is delivered (D5), that daemon-live is a satisfied prerequisite rather than a gate condition, and that handover therefore evaluates the four conditions only.

### R6 — [nit] plan_code_area_coverage: a delivered test title becomes false
Artifact: `tests/structure/error-table.test.ts:1611`; plan phase 1.
Gap: "every new row projects user-validation and no new platform-provider row exists" is contradicted by the new platform-provider `dispatch.state-unverified` row; the assertion body only checks the earlier three codes and still passes.
Suggested remediation target phase: delivery_planning.
Suggested fix: rename the test in the same phase-1 edit to name the platform-provider dispatch state row explicitly.

### R7 — [nit] plan_coverage: phase 10 edits two suites it does not run explicitly
Artifact: plan phase 10 tests; test-plan TC-NFR-004 and the TC-EVID-006/TC-GATE-011 P10 slices.
Gap: Phase 10 extends `dispatch-gate-evidence.test.ts` (truncation slice) and `dispatch-evidence-class.test.ts` (controlled class) but lists neither file; both are covered only by the trailing `pnpm check`.
Suggested remediation target phase: delivery_planning.
Suggested fix: add `bun test tests/behaviour/dispatch-gate-evidence.test.ts tests/behaviour/dispatch-evidence-class.test.ts` to phase 10's tests.

## Positive Verification (not findings)
- `chg-GH-239-plan.yaml` parses and passes `validatePlanValue` with zero errors (`delivery.plan.v1`, tier `full`, phases 1-10, per-phase scope/interactions).
- 53 unique spec ACs; 82 unique TCs present with set equality across the §5.1 index, §7.1 mapping, and §7.5 table; every 5.1 row maps to an AC; zero orphan TCs; plan AC ownership is exactly the 53 ACs with no duplicate assignment.
- SC-M1-26..30 each map to TCs and to an owning phase; the two reconciled scenarios assert the evidence bar, not a calendar proxy.
- Reachability re-proven: all eleven classes, exposure-only `state-unverified`, tracker-corroborated `pr-open-unverified`, inclusive/exclusive window behaviour with same-instant exclusion and post-incident recovery, per-scope evidence-class counting with cross-scope exclusion, family-wise corroboration, and a provenance-guarded controlled-proof E2E.
- Forbidden-edit boundary holds: no ticket-body, backlog-ranking, roadmap, registry, journey, or operator-record edit; phase 7 touches only `commands/dispatch.md` and SC-M1-29/SC-M1-30; the decision-record files are in phase-1 scope.
- Baseline suites for phase 1 are green before delivery (`tests/structure/error-table.test.ts` 80 pass; `tests/checks/decision-record.test.ts` 4 pass); TDR-0015 validates as a decision record.
- Delivered seams named by the plan exist: `LaneLaunchPlanner`/`LaneExecutorPort`/`createLaneExecutor`, `runSupervisionCycle`, `daemon-compose.ts`, `normalizeRepositoryKey`, `ensureStoreArtifact`, `lane.restart-budget`, `lane.liveness-interval`.

## Decision Routing
- change: R1, R2, R4, R5, R6, R7 (plan/test-plan/spec wording and phase declarations).
- system: R3 only — commit the already-Proposed TDR-0015; no new decision record required. TDR-0015 stays Proposed until the owner accepts it at PR review.
- needs_human_input: none; no pause flag.
