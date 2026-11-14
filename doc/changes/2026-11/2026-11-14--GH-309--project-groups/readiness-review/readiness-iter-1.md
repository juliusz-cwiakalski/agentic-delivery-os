# Readiness Review Iteration 1

Verdict: NOT_READY
Work Item: GH-309
Date: 2026-11-14
Pause Required: no

## Facet Summary
- spec_completeness: PASS
- ac_quality: FAIL
- plan_coverage: PASS
- test_traceability: PASS
- cross_artifact_consistency: PASS
- decision_capture: PASS
- system_spec_consistency: PASS
- plan_doc_update_coverage: PASS
- plan_code_area_coverage: PASS
- dod_defined: PASS

## Scope of Review

First DoR iteration; no prior readiness records. Reviewed against the ticket
(juliusz-cwiakalski/agentic-delivery-os#309, body verbatim-equal to the backlog
canonical entry at `doc/planning/oss-tooling/backlog.md` M2-S18: 6 ACs, derived
tasks (a)–(f), delivery conventions), the M2 milestone pack (contracts.md,
commands pages, test-scenarios.md SC-M2-S18-01..08, entrypoint delta), current
truth (`feature-projects.md`, `feature-result-contract.md`, the error table),
ODR-0003/ODR-0004, and repo truth (git state, registry rows, test gates,
fixture/suite inventory). Verified: ODR-0004 file untracked with its index row
committed (db85ac35); `input.value.rejected` is a delivered identity (error
table line 288 + feature-result-contract.md); `error-table-sync.ts` exists and
feature-result-contract.md has feat-commit precedent (GH-289/290/292); registry
rows at cli-command-registry.md:189-190 match the spec's claims; the
"first applicable reason wins" daemon ordering is pack-grounded
(m2/commands/projects.md:85); 30 TCs / 16 ACs / 17 DoDs all owned by exactly
one plan phase each; the three OQ pins match the test-plan §9 revision log
(v1.0→v1.4). Ticket AC1–AC6 → AC-F4-1/F3-1/F4-2/F6-1/F1-1/F7-1 all traced
AC→TC→phase with executable verification. The ODR-0004 chain (phase 1 record →
phase 5 rename → phase 6 registry row) is sound and mechanically enforced by
phase order plus commit subjects.

## Findings

1. [major] ac_quality — chg-GH-309-spec.md §5.1 F-7 / §8.5 / Appendix C C-2 + chg-GH-309-test-plan.md TC-GRPREN-002/003
   Gap: the `projects list --flat` alias's failure-path error identity is unpinned and unprobed. Spec §8.5 promises the alias keeps "consumers of the delivered flat surface working across the rename" with the payload returned "byte-compatibly", while F-7 (and ODR-0004 DC-1) move the flat surface's error identities to the `repos.*` prefix "on that surface". For a host with a corrupt registry/unreadable marker, the pre-rename `projects list` emitted `projects.registry-corrupt`/`projects.identity-unreadable`; whether the post-rename alias emits the moved `repos.*` identities or keeps the delivered `projects.*` ones is stated nowhere, and no TC probes the alias under any failure fixture (TC-GRPREN-003 tests the success golden only; TC-GRPREN-002 probes failures through `repos list` only). Two defensible readings on the change's self-declared #1 compat chain (RSK-1/C-2) leave DoD-8's "alias byte-compat check" non-deterministic for failure envelopes.
   Suggested remediation target phase: specification
   Suggested fix: pin one choice in F-7/C-2 (evidence favors: the alias's failure paths carry the moved `repos.*` identities, per ODR-0004 DC-1 "replacing the delivered projects.* identities on that surface", with §8.5's consumer-compat claim scoped to the success payload); then add one alias failure probe to TC-GRPREN-002 or TC-GRPREN-003 (test_planning follow-up).

2. [minor] cross_artifact_consistency — chg-GH-309-spec.md Appendix C C-6 + chg-GH-309-test-plan.md TC-GRPBOUND-003 vs chg-GH-309-plan.yaml C-6 comment
   Gap: the plan's mechanical exception (phases 2/5 carry `doc/spec/features/feature-result-contract.md` as the error-registry sync carrier, forced by the bidirectional `error-table-sync` gate inside `pnpm check`) is declared only in the plan. Spec C-6 ("Current-truth feature specs flip in phase 7, not in the delivery phases") and TC-GRPBOUND-003 step 3 ("current-truth feature specs are not pre-flipped in the delivery diff", citing C-6 as authority) do not carry the carve-out, so a literal review-time execution of TC-GRPBOUND-003 over the changed-file list would flag the plan's own compliant registry-row edits. The exception itself is verified sound and bounded (sync gate exists; feat-commit precedent confirmed; only table rows/identity counts change).
   Suggested remediation target phase: specification
   Suggested fix: add one carve-out sentence to spec C-6 (and §7.2 [OUT] wording) naming feature-result-contract.md registry-row sync as the sole mechanical exception; mirror it in TC-GRPBOUND-003's step-3 checklist (test_planning follow-up).

3. [minor] plan_coverage — chg-GH-309-plan.yaml phase 1 done-when vs scope.files
   Gap: phase 1's done-when cites `bun test tests/checks/decision-record.test.ts` as the "record-consistency precedent" gate, but that suite is TDR-0013-specific (42 lines, hardcoded) and no test file is in phase 1's scope — as scoped, the phase cannot verify ODR-0004 file↔index-row consistency, which is its stated obligation 1.2.
   Suggested remediation target phase: delivery_planning
   Suggested fix: add the test extension to phase 1 scope (an ODR-0004 case in tests/checks/decision-record.test.ts, or a sibling check) or restate the done-when to the review-time register inspection (TC-GRPDR-001).

4. [minor] test_traceability — chg-GH-309-test-plan.md TC-GRPREN-005 step 3 vs §9 revision row v1.2
   Gap: the TC body still says the refusal identity is "the pinned one from the plan (expected: the alias's own refusal classification...)", while the binding §9 v1.2 pin (and the plan's OQ-2/TP-Q2 pin) is the shared delivered identity `input.value.rejected` — explicitly NOT an alias-specific identity. A reader of the TC body alone gets the wrong expectation; the revision-log "assertion extension carried by this row" leaves the body unsynced.
   Suggested remediation target phase: test_planning
   Suggested fix: rewrite TC-GRPREN-005 step 3 to name `input.value.rejected` (exit 1) as the asserted identity.

5. [minor] plan_doc_update_coverage — chg-GH-309-plan.yaml phase 6 corpus list + lifecycle phase-7 handoff block
   Gap: contracts.md's "Queue and lane representation" section states "Owned by M2-S18 for cross-repository changes", but DEC-4 (ticket-canonical) reassigns it to M2-S19-consumed groundwork; post-delivery that pack line is stale planning truth, and neither phase 6's corpus obligations nor the phase-7 handoff block includes any contracts.md reconciliation.
   Suggested remediation target phase: delivery_planning
   Suggested fix: add the one-line contracts.md ownership touch-up (queue-and-lane ownership → M2-S19 groundwork; optionally the M2-S18 rename-rule "planned end state, not current truth" sentence status) to phase 6 scope or the phase-7 verify list.

## Notes

- Severity `nit` (this gate's fourth class) maps to the delegation's `advisory`; no advisory-grade findings were retained this iteration.
- Decision routing: all findings are `change`-class artifact edits; no `needs_human_input` arose (finding 1 is derivable from ODR-0004 DC-1 as written; owner ratification of ODR-0004 correctly remains an external PR-review gate, not a DoR pause).
- Positive verification worth recording for the next iteration: the C-3/DoD-11 chain (ODR-0004 untracked file → phase-1 landing → phase-5 rename → phase-6 registry row, with TC-GRPDR-001 commit-order review) is mechanically sound; the intermediate-state rule (default form keeps the delivered flat payload until phase 5) prevents every red boundary; the OQ-1/2/3 and TP-Q1/TP-Q2 pins are consistent across plan and test-plan §9; and the plan's repo-truth claims spot-checked for this review were accurate without exception.
