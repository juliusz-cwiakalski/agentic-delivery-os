# Readiness review — GH-286 — iteration 3 (final)

- **Verdict:** NOT_READY
- **Date:** 2026-11-11
- **Iteration:** 3 of 3
- **Pause required:** no human-only decision, but the iteration budget is exhausted; the gate recommends one targeted repair plus a confirmation pass on the changed sections.
- **Artifacts:** spec v1.2 (50 ACs), test plan v1.2 (54 TCs), plan v1.2 (54/54, validator valid), pm-notes, TDR-0023 (DC-1/DC-2 amended), readiness-iter-1/2.md, ticket #286, delivered tree.

## Facet summary

| Facet | Result |
|---|---|
| spec_completeness | PASS |
| ac_quality | PASS (A3-1) |
| plan_coverage | FAIL (RF3-1) |
| test_traceability | PASS (50/50, 54/54/54, map 54, 0 mismatches) |
| cross_artifact_consistency | FAIL (RF3-1) |
| decision_capture | PASS |
| system_spec_consistency | PASS |
| plan_doc_update_coverage | PASS |
| plan_code_area_coverage | PASS |
| dod_defined | PASS |

## Iteration-2 closure

| ID | Status |
|---|---|
| RF2-1 | Closed — TDR DC-2 strict `<`, boundary stated, amendment row |
| RF2-2 | Closed — `daemon-compose.ts` in Phase 2 scope, task 2.6 owns the spawn merge |
| RF2-3 | Closed — `daemon-compose.ts` in Phase 3 scope, task 3.2 refuses before rendering |
| RF2-4 | Closed — three-outcome contract consistent in spec/plan/test plan; exit 1 projected |
| RF2-5 | Closed — both absence sites named |
| RF2-6 | Closed — disposition scoped to production surfaces |
| A2-1 … A2-9 | All closed or dispositioned |

## Blocking finding

### RF3-1 [major] — Phases 2 and 3 are scheduled to run mapped cases that require prompt-required membership, which only Phase 6 delivers

`PROMPT_REQUIRED_COMMANDS` holds 16 commands until Phase 6 task 6.1, and `selectPromptRequiredProgram` returns exactly that set and drops extras (`packages/cli/src/entrypoint.ts:134-149`). An invocation through `runEntrypoint` before Phase 6 therefore answers `fallback.internal` at exit 2, so:

- TC-041 step 5, TC-053 step 3, TC-054 steps 1/2/5, TC-063 (P half), TC-090, and the Phase-3 install battery (TC-100/101/103/104/124, TC-105 manual) cannot reach the daemon handler as written.
- AC-F3-5's primary observable ("any daemon subcommand returns `config.value.invalid` at exit 1") and AC-F1-5's ("registered and selectable") are mapped to Phase 2/3 proofs but are only observable after Phase 6.
- The plan's own invariant ("each phase boundary leaves the declared narrow gate green") is violated.

**Why it blocks:** a coder must either weaken mapped assertions or commit a red boundary.

**Remediation (reviewer's cheapest coherent option):** keep the Phase-2/3/4/5 proofs handler-level (composed program + the `daemon` command's handler), and add the selection/containment half — `selectPromptRequiredProgram` selects `daemon`, an invocation through `runEntrypoint` is never `fallback.internal`, all nine unresolvable-outcome invocations at exit 1 — to the Phase-6 gate alongside TC-010/014. State per case whether it invokes through `runEntrypoint` or the composed handler.

**Reopen:** `delivery_planning` (primary), `test_planning` (per-case invocation shape).

## Advisories

| ID | Sev | Finding | Reopen |
|---|---|---|---|
| A3-1 | minor | `daemon install` with no entry path AND no state directory answers `config.value.invalid` at exit 1, not `daemon.state-recovery-failed`. The artifacts say so in Flow 7/DM-5/Appendix D/tasks 2.4/3.2/TC-054, but AC-F7-5 and Appendix D's install row lack the "given a resolvable state directory" qualifier, so the two ACs overlap on that cell. | specification |
| A3-2 | nit | Test plan path `daemon-help.test.ts` vs plan `daemon-mount-help.test.ts`; the rename is nowhere stated. | test_planning |
| A3-3 | nit | Test-plan v1.2 history row asserts the plan still needs TC-054 added; plan v1.2 already has it. | test_planning |
| A3-4 | nit | AC-F3-4 says the invalid override is "reported by the delivered resolution edge"; the edge returns `undefined`. Behaviour right, verb loose. | specification |
| A3-5 | minor | TC-041 step 7 / TC-054 step 6(ii) prove "nothing composed" by a source scan with no declared anchor. Name the local refusing-runtime factory as the scan boundary. | test_planning |

## Recommendation

Do not open a fourth full loop. The gate recommends one targeted `delivery_planning` + `test_planning` repair, plus the two spec wording items, followed by a single confirmation pass on the changed sections only.
