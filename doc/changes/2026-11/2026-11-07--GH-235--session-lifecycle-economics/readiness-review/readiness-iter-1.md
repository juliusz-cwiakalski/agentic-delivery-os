# Readiness Review Iteration 1

Verdict: READY
Work Item: GH-235
Date: 2026-11-07
Pause Required: no

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

All ten facets pass. Five non-blocking findings (four minor, one nit) are recorded below with remediation targets; none reshapes a pinned identity, exit, corroboration rule, precedence, vocabulary, or AC/NFR/DEC traceability, and none requires human input.

## Findings

1. [minor] cross_artifact_consistency — chg-GH-235-test-plan.md#§8.1/TR-7
   Gap: TR-7 states TC-ECON-082 "enumerates exactly five permitted updates", but TC-ECON-082 step 6, §3.4 ("Four existing assertions are deliberately updated... and only these four"), the plan header ("exactly these four updates exist — no fifth file"), and pm-notes ("4 permitted updates remain") all say four. TR-7 is a stale v1.0 leftover from before the harness exact-three suite was removed from the permitted-update list.
   Suggested remediation target phase: test_planning
   Suggested fix: One-word amendment: "five" → "four" in TR-7 (or defer to delivery-time prose; the normative TC and the Phase-6 pinning battery are unambiguous).

2. [minor] cross_artifact_consistency — chg-GH-235-test-plan.md#TC-ECON-071 step 1 vs TC-ECON-072 step 1
   Gap: TC-ECON-071's invalid-value parenthetical lists `0` as invalid for the budget ("`0`, negative, non-integer budget"), while TC-ECON-072 requires `lane.restart-budget = 0` to resolve validly and refuse the first restart with `dispatch.restart-budget-exceeded`. Plan D-12 reconciles this explicitly (budget accepts integers ≥ 0; the `0` in 071 binds the interval only), but the test-plan wording was never amended — the contradiction survives in the artifact the plan cites as its verification map.
   Suggested remediation target phase: test_planning
   Suggested fix: Amend TC-ECON-071 step 1 to "invalid value (negative, non-integer budget; `0`/negative interval)" and note budget-0 as TC-ECON-072's valid zero-bound control, matching D-12.

3. [minor] cross_artifact_consistency — chg-GH-235-plan.yaml#D-8 (ECONOMICS_EXHAUSTION_OPTIONS) vs upstream SC-M1-15
   Gap: D-8 declares the terminal record's options as ["fresh-budget", "harness-change"], "carried as data for the M1-S16 typed question", but the seeded scenario SC-M1-15 (which the ticket binds: "divergence after delivery is a defect") declares that question's options as "(requeue with fresh budget, park for owner review)". OQ-T8's resolution path bounds option names as delivery-bound "within... the consumers' stated needs" — the second option diverges from the consumer's stated need ("park for owner review" ≠ "harness-change", which is DEC-7's remediation for the uneconomical-refusal class, not the exhaustion question).
   Suggested remediation target phase: delivery_planning
   Suggested fix: Amend D-8 to the scenario's pair (e.g. ["fresh-budget", "park-owner-review"]), or explicitly record that the typed-question option vocabulary is M1-S16-owned and D-8's list is the refusal-remediation pair, not the question options — so AC-F4-4's "everything the typed question consumes" claim stays exact.

4. [minor] plan_code_area_coverage — chg-GH-235-plan.yaml#Phase 4 scope.files
   Gap: Deliberate update (iii)'s primary assertion lives in tests/structure/watchdog-contract.test.ts (TC-WATCHDOG-041 scans packages/cli/src/commands/** for `"stalled"`/`"progressing"` literals and will fail at the Phase-4 command-edge flip), but Phase 4's scope.files omits that file and task 4.4 guesses tests/behaviour/watchdog-liveness.test.ts as the expected home ("wherever the row lives, it is updated in the same phase"). The hedge keeps execution viable, but the declared blast radius for the flip phase is incomplete.
   Suggested remediation target phase: delivery_planning
   Suggested fix: Add tests/structure/watchdog-contract.test.ts to Phase 4 scope.files and correct task 4.4's expected home for update (iii); the file is already correctly pinned by Phase 1 (update (i)) and the Phase-6 "no fifth file" battery.

5. [nit] test_traceability — chg-GH-235-test-plan.md#§3.1 "Decision coverage" line
   Gap: The decision-coverage summary line lists only DEC-1..DEC-7. DEC-8/DEC-9 coverage exists in the scenario details (TC-ECON-001 step 3, TC-ECON-010, TC-ECON-021 step 6, TC-ECON-030 step 5-6, TC-ECON-033 step 9-10, TC-ECON-041 step 4, TC-ECON-052 step 4, TC-ECON-054 step 2, TC-ECON-082 step 7) but the v1.1 revision did not extend the summary line.
   Suggested remediation target phase: test_planning
   Suggested fix: Append "DEC-8 → 001, 010, 082; DEC-9 → 021, 030, 033, 041, 052, 054" to the §3.1 decision-coverage line.

## Verification Evidence (adversarial checks performed)

- Ticket ↔ artifacts: all four ticket AC clauses trace to AC-F2-1 (large resuming session not killed), AC-F4-2 (loud past-budget refusal, lane-status data surface), AC-F6-1 (amplification derivable, feeds M1-S19 via Blocks), AC-F4-3/AC-F4-4 (durable budget, every resume path, escalation-not-silence). Pinned decisions respected: progress-based liveness with CPU excluded (DEC-6, stronger than "never the only signal", consistent with the delivered no-CPU signal shape); durable budget on every resume path (F-4, AC-F4-3, D-10, TC-ECON-053); amplification per delivery feeding M1-S19 (F-6, Blocks M1-S19); escalation-not-silence as terminal record + no silent requeue (AC-F4-4, TC-ECON-054).
- SC-M1-15 split verified against upstream: doc/planning/oss-tooling/milestones/m1/test-scenarios.md line 160 declares SC-M1-15 "(M1-S15 + M1-S18)"; the story-mapping table lists SC-M1-15 under both M1-S15 and M1-S18. The artifacts inherit the economics half (3/3, no fourth spawn, terminal classified reason + history → TC-ECON-052/053/054) and defer queue marking (M1-S17), typed question (M1-S16), and one-collection-cycle delivery (M1-S18) with explicit [OUT]/NG entries and Blocks rows — consistent with the upstream shared declaration, not scope-dodging. SC-M1-14 is single-owner (M1-S15); both observable assertions ("no restart event", "lane state remains delivering") are inherited verbatim by TC-ECON-020.
- OQ-T3..T8 vs D-1..D-13: no contradiction found. OQ-T3→D-6 (formula, baseline 1, "restart-loop" flag, null rule — matches TC-ECON-061's asserted properties); OQ-T4→D-9 (state.store.torn / state.store.unknown / delivered unreadable-store row — all three verified present in packages/core/src/contracts/error-table.ts lines 279, 354); OQ-T5→D-10 (idempotent single terminal record, matches TC-ECON-053 step 5); OQ-T6→D-4 (per-delivery keys, matches TC-ECON-050/060 isolation); OQ-T7→D-11 (evaluation-time read, matches TC-ECON-072 step 6); OQ-T8→D-8 (contract type — see finding 3 for the option-vocabulary divergence).
- Seam map verified in tree: packages/core/src/contracts/watchdog.ts (WATCHDOG_VERDICTS ok|refused|stalled|progressing; WATCHDOG_SIGNAL_KEYS heartbeatAgeMs|tokenDelta|traffic; WATCHDOG_STALL_HEARTBEAT_MS = 300_000; WATCHDOG_ERROR_CODES exactly three), packages/core/src/contracts/harness.ts (HARNESS_LIVENESS_KINDS exactly session-traffic|worktree-activity|process in order), packages/core/src/domain/harness-liveness.ts, packages/adapters/src/harness/{opencode,claude}.ts, packages/cli/src/commands/watchdog.ts, packages/cli/src/edge.ts (createWatchdogCommandRuntime at line 1901, exactly as D-1 pins), packages/core/src/state/commit-telemetry.ts, packages/core/src/contracts/error-table.ts (DOMAIN_KINDS ends "retro" — D-2's "dispatch appended after retro" is coherent), config identities config.key.unknown/config.value.invalid present. All existing test suites the plan's testGates invoke exist (incl. port-contract-inventory, state-conformance, state-keys, commit-telemetry, config-schema/resolver/provenance, conformance-coverage).
- Dependencies: branch base verified a69b555e (GH-233 M1-S11 delivery); GH-221 watchdog contracts delivered in tree.
- AC/TC/phase traceability: 13/13 ACs covered by named TCs (§3.1); 37 TCs mapped onto Phases 1-7 with completing-phase markers for split TCs (012/055/056/082); TC-ECON-083 correctly routed to the lifecycle-phase-7 doc handoff. Phase 7 lists all doc-sync targets (five feature specs + new feature-session-lifecycle-economics.md with ados_distribution) matching spec §16 and pm-notes' anticipated impacts.
- DoD: every AC carries an explicit DoD predicate; §4.1 measurable targets; Phase 7 doneArtifacts + task 7.6 PR-readiness checklist.
- Prior readiness records: none (this is iteration 1; the specification reopen recorded in pm-notes was a phase-5-upstream reopen, not a DoR iteration — no dedup needed, no persistent findings).
