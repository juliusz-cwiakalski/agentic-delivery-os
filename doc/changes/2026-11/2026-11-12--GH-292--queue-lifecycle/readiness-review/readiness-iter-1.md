# Readiness Review Iteration 1

Verdict: NOT_READY
Work Item: GH-292
Date: 2026-11-12
Pause Required: no

## Inputs and checks performed

- Ticket GH-292 (`M2-S15 Queue lifecycle completion`, labels `change`, `spec-ready`).
- `chg-GH-292-spec.md` v1.1, `chg-GH-292-test-plan.md` v1.1, `chg-GH-292-plan.yaml`, `chg-GH-292-pm-notes.yaml`.
- M2 planning pack (`contracts.md` §Queue lifecycle mutations / §Event taxonomy v1, `commands/queue.md`, `architecture.md`, `test-scenarios.md` SC-M2-S15-01..04, backlog §M2-S15).
- Current-truth specs (`feature-scheduling-engine.md`, `feature-dispatch-engine.md`, `feature-closeout.md`, `feature-event-taxonomy.md`, `feature-resident-daemon.md`, `feature-result-contract.md`, `feature-state-layer.md`).
- Decision records: `doc/decisions/TDR-0026-…` (present, untracked, Proposed); `TDR-0027-command-failure-envelope-detail-slot.md` (absent).
- Delivered code and test seams: `packages/core/src/{app/queue.ts,contracts/queue.ts,domain/queue-graph.ts,app/dispatch.ts,app/dispatch-gate.ts,contracts/taxonomy.ts,domain/event-projection.ts,contracts/error-table.ts}`, `packages/cli/src/{commands/queue.ts,commands/closeout.ts,edge.ts,index.ts,help.ts,daemon-compose.ts}`, and the named delivered test suites.

Mechanical checks: `plan validate GH-292` → `verdict=valid`, `readyForDevelopment=true`; AC→TC matrix 46/46 with no orphan; 59/59 TC bodies, index rows and automation rows agree; plan AC map 46/46 and TC map 59/59 with no duplicate. Those mechanical checks pass; the blocking findings are semantic/contractual, not traceability counts.

## Facet Summary

- spec_completeness: PASS — every ticket requirement and every ticket AC is represented (F-1..F-7, AC-F1..AC-NFR-6); internal contradictions are recorded below.
- ac_quality: FAIL — R-01 (mutually exclusive single-flight/renewal outcomes), R-02 (presence comparator), R-13 (help-surface ambiguity).
- plan_coverage: PASS — all 46 ACs and all 59 TCs are owned exactly once by a phase; 9-phase dependency order is coherent.
- test_traceability: FAIL — R-01/R-02 (contradictory cases) and R-04 (pin migration table incomplete against the delivered pin surface).
- cross_artifact_consistency: FAIL — R-01, R-02, R-04, R-05, R-10, R-12.
- decision_capture: FAIL — R-03 (TDR-0027 absent; plan still declares the decision open), R-05 (TDR-0026 conflicts with the spec/AC), R-09 (TDR-0027 index-row staging).
- system_spec_consistency: FAIL — R-06 (state-layer spec drift) and R-11 (false current-state claim about `callerPrincipal`).
- plan_doc_update_coverage: FAIL — R-06 (`feature-state-layer.md` missing), R-12 (M2 architecture/contracts drift), R-16 (result-contract residual).
- plan_code_area_coverage: FAIL — R-07 (closeout fixture undeclared), R-08 (Phase-6 help test undeclared), R-15 (reconcile tracker seam unnamed).
- dod_defined: PASS — 46 testable ACs plus per-phase `definitionOfDone` constitute a clear DoD; R-17 is a documentation nit.

## Findings

### R-01 — Single-flight vs same-holder renewal is a hard contradiction (blocking)

- Severity: critical
- Facet: cross_artifact_consistency, ac_quality
- Locations:
  - spec §5.1 F-4 bullet 2 (“…refuses, *including when the holder identity is identical*”) vs bullet 4 (“an identical holder re-claiming the *same* ref still renews (idempotent, unchanged)”).
  - spec AC-F4-1/AC-F4-2 (`dispatch run` and `queue claim` refuse an active lane with `queue.single-flight`) vs AC-F4-5 (“an identical holder re-claiming the *same* ref still returns `renewed` with no new session”) and §8.5 (“`queue claim` … `renewed` reachable only for the same ref”).
  - `TDR-0026` DC-2 (“including when the holder identity is identical”) vs DC-3 (“an identical holder re-claiming the same ref therefore still renews”).
  - test plan TC-QLC-041 step 4 (`queue claim GH-241 --holder lane-1` on a live same-ref lease → `queue.single-flight`) vs TC-QLC-044 step 3 (`claim ref A` under the same holder → `renewed`) and TC-QLC-040 step 5.
  - plan Phase 2 goal/DoD: “a live lease … recorded ref equals the requested ref refuses” and “the same ref under the same holder still returns `renewed`”; also “the two delivered exact-holder controls (`queue-lease`, `queue-lease-concurrency`) are green with no assertion change”.
  - Delivered controls: `tests/behaviour/queue-lease.test.ts` TC-LEASE-013 and `tests/behaviour/queue-lease-concurrency.test.ts` call `claimQueueLease` directly for same-holder/same-ref and pin `renewed`.
- Gap: The artifacts prescribe two mutually exclusive outcomes for the same live same-holder/same-ref state. If the guard refuses before the claim, `renewed` is unreachable through `queue claim`; if the claim renews, `queue claim` does not refuse, contradicting AC-F4-2 and “one guard, one place”. Placing the guard inside `claimQueueLease` also breaks the two delivered controls the plan says must stay green; placing it only at the callers makes the guard path-specific. The spec does not define a precedence table, and the delivered `renewed`-reachability statement is not implementable as written.
- Suggested remediation target phase: specification
- Owning authors: `@spec-writer` (primary: F-4, AC-F4-1/2/5, §8.5); `@decision-advisor` (TDR-0026 DC-2/DC-3); `@test-plan-writer` (TC-QLC-040/041/044); `@plan-writer` (Phase 2 goal/DoD).
- Suggested fix: Publish one explicit outcome table for each `(requested ref == live ref?, holder same?, path: dispatch / queue claim / direct claim seam)` giving the exact result (`queue.single-flight`, `queue.lease-conflict`, `renewed`, `claimed`, `taken-over`) and whether a lease record is appended. State whether `renewed` is reachable through `queue claim` at all. If it is not, amend §8.5 and the delivered control expectation; if it is, remove the same-ref refusal from the guard and explain how the ticket’s duplicate-session defect is still closed on the dispatch path. Then align the ACs, TDR, TCs and Phase-2 DoD.

### R-02 — The presence-rule comparator and tie are undefined and contradictory (blocking)

- Severity: critical
- Facet: cross_artifact_consistency, ac_quality, test_traceability
- Locations:
  - spec DM-2: “present iff its latest entry record is later than its latest removal record; equal or absent is ‘present’ only when no removal exists”; AC-F1-7; §23 “Presence rule”.
  - `TDR-0026` DC-1: “later is the ledger’s append position … an identical `recordedAt` is resolved by append order … and a tie never resurrects an entry”; `TDR-0026` Unresolved Questions item 2 leaves append-position vs `recordedAt` comparison open.
  - plan Phase 1 `definitionOfDone`/`risks`: “ordered comparison … proven by the removal, re-declaration, and equal-timestamp cells of TC-QLC-007/009”.
  - test plan TC-QLC-007 (a *later* `recordedAt` only) and TC-QLC-009 (no equal-timestamp cell).
- Gap: The core presence predicate is not specified precisely. “Later than” can mean timestamp comparison (equal ⇒ absent) or ledger append position (a later entry restores presence), and the TDR simultaneously says append position resolves ties and that “a tie never resurrects an entry”. The plan claims equal-timestamp cells exist in TC-QLC-007/009; they do not. AC-F1-7 (re-declaration restores) cannot be implemented unambiguously.
- Suggested remediation target phase: specification
- Owning authors: `@spec-writer` (DM-2/AC-F1-7/§23), `@decision-advisor` (TDR-0026 DC-1 unresolved question), `@test-plan-writer` (add an equal-timestamp cell), `@plan-writer` (Phase 1 DoD/risk wording).
- Suggested fix: State the exact total order (append position, or timestamp with a declared tie rule), state the exact equal-timestamp outcome, and add a test case that constructs two records with an identical `recordedAt` in both orders. Remove the “equal-timestamp cells” claim until the case exists.

### R-03 — The failure-envelope `detail` decision is not recorded and the plan still calls it open (blocking)

- Severity: critical
- Facet: decision_capture, ac_quality, cross_artifact_consistency
- Locations:
  - plan header “OPEN CONTRACT DECISION — the `error.detail` slot” (candidates (a)/(b)/(c)); plan Phase 2 DoD: “If the advisor’s decision selects option (c) instead, this phase is re-planned with the spec amendment”.
  - spec DM-7 (“the additive `detail` object on a queue/dispatch failure envelope”) and AC-F4-1/AC-F4-2 (`error.detail.holder`).
  - pm-notes decision 2026-11-12 (PM selected option (a)); `doc/decisions/TDR-0027-command-failure-envelope-detail-slot.md` does not exist.
  - Delivered pins: `packages/core/src/contracts/result.ts` (`CommandResultError` six fields), `packages/core/src/contracts/dispatch.ts` (`DispatchEnvelopeError.detail.kind` is `"harness" | "config"`), `tests/types/dispatch-envelope-detail.type-test.ts`, `packages/cli/src/index.ts` `toErrorObject`.
- Gap: AC-F4-1 is not implementable and testable until the failure-envelope detail slot is decided and recorded. The plan still permits option (c), which would not meet AC-F4-1 and would force a spec amendment at delivery; the PM note says option (a) is decided but the system-level decision record is absent. DM-7 does not name the failure type, does not state that `CommandResultError` stays six fields, and does not list the `toErrorObject`/type-probe pin among the deliberate moves.
- Suggested remediation target phase: specification (DM-7/§7.1) with delivery_planning for the plan/record
- Owning authors: `@decision-advisor` (author TDR-0027 with option (a)); `@plan-writer` (remove the open-decision block and the (c) escape; make Phase 2 conditional-free); `@spec-writer` (DM-7 + pin list).
- Suggested fix: Author TDR-0027 recording the command-scoped failure type with an optional `detail` (`{ holder }` for this refusal), the unchanged six-field `CommandResultError`, and the `toErrorObject` pass-through. Reference it from spec DM-7/§7.1/DEC-14, and make Phase 2’s DoD conditional-free. If the PM’s option (a) choice is not final, mark the gate paused instead of letting delivery choose.

### R-04 — The delivered pin set is incomplete and the three artifacts disagree on it (blocking)

- Severity: major
- Facet: cross_artifact_consistency, test_traceability
- Locations:
  - `tests/behaviour/events-emitted-kinds.test.ts:124-134` — the delivered test “no production module outside the declaration produces a remove event” asserts `packages/core/src/domain/event-projection.ts` contains no `"remove"` literal.
  - spec §2.1 (“Four named tests pin the unemitted set”), §7.1, §18, DEC-14 (“the four tests that pin `remove` as unemitted”).
  - test plan §7.1 (4 `remove` pin rows + 3 other rows) and TC-QLC-064 (“the four pin files named in §7.1”).
  - plan pin table A (6 `remove` sites), B (10 error-row sites), C (5 record-kind sites), E (CLI seam).
- Gap: Making `event-projection.ts` emit `remove` necessarily breaks the source-scan assertion at lines 124-134; the plan declares the file but specifies only the inversion of the two data assertions, not this static assertion’s new expectation. The spec/test-plan/plan also disagree on the pin count (four vs six vs seven-plus), and the plan names additional pin families the spec/test plan never declare (error-table-sync counts, `dispatch-attempts-taxonomy`, the two event baselines, the CLI seam). A coder following the spec/test plan would either delete/relax the source scan or fail the Phase 4 gate.
- Suggested remediation target phase: test_planning (with spec/plan alignment)
- Owning authors: `@test-plan-writer` (primary: §7.1/TC-QLC-064), `@spec-writer` (§7.1/§18/DEC-14), `@plan-writer` (pin table A).
- Suggested fix: Add the source-scan pin to §7.1 with its new two-sided expectation (e.g., the projection is the only producer; the other three modules remain free of the literal; a `remove` frame is produced exactly once), reconcile the pin inventory across all three artifacts, and state every old→new value.

### R-05 — TDR-0026 authorizes rewording a delivered error row that the spec/AC/plan pin as unchanged (blocking)

- Severity: major
- Facet: decision_capture, cross_artifact_consistency
- Locations:
  - `TDR-0026` DC-6 “Prose reconciliation only” (“the row’s prose is generalized … the summary is either generalized (review-visible) or left”) and Unresolved Questions item 1.
  - spec §5.1 F-7 (“the delivered five, unreserved and unrewritten”); AC-F7-3 (“the delivered five unchanged”); Appendix E (“delivered, unchanged”).
  - plan Phase 1 DoD (“the delivered five byte-identical”); test plan TC-QLC-073; delivered `tests/structure/error-table.test.ts` `QUEUE_ROWS` pins the exact summary.
- Gap: The decision record permits (and may require) changing `queue.precondition.unmet`’s summary/remediation, while every change artifact and the delivered pin require it unchanged. The TDR’s own unresolved question leaves the matter open. Delivery cannot satisfy both.
- Suggested remediation target phase: specification
- Owning authors: `@spec-writer`, `@decision-advisor`.
- Suggested fix: Decide once. If the row’s prose moves, amend AC-F7-3/Appendix E/plan DoD/test pin to the exact new text and record it as a declared pin move; if it does not, remove the prose-generalization permission and the unresolved question from TDR-0026 and state that the row is byte-identical.

### R-06 — Current-truth spec and planning docs the change falsifies are not in the update set (blocking)

- Severity: major
- Facet: plan_doc_update_coverage, system_spec_consistency
- Locations:
  - `doc/spec/features/feature-state-layer.md:288,341-346` (five queue record kinds) — absent from spec §16 and the plan’s “DOCS OWNERSHIP SPLIT”.
  - `doc/spec/features/feature-result-contract.md:462` (“exactly the five scheduling rows”).
  - `doc/planning/oss-tooling/milestones/m2/contracts.md` §Event taxonomy v1 (“`remove` … `emitted: false`; no v1 path produces it”).
  - `doc/planning/oss-tooling/milestones/m2/architecture.md` §Single-flight refusal (“event: dispatch.attempt refused”).
- Gap: The change adds a sixth queue record kind and a seventh queue error row, makes `remove` emitted, and makes the refusal event-free. `feature-state-layer.md` is a current-truth spec that states the five-kind inventory and is not named for update anywhere; `contracts.md` and `architecture.md` would be left contradicting the delivered behavior; `feature-result-contract.md:462` would still say five rows. The plan’s “everything else under doc/spec stays with doc-syncer” enumeration omits state-layer.
- Suggested remediation target phase: delivery_planning (with spec §16 alignment)
- Owning authors: `@plan-writer` (primary), `@spec-writer` (§16).
- Suggested fix: Add `feature-state-layer.md` to the doc-syncer list and the Phase 7/8 DoD; add the M2 contract/architecture pages (or explicitly declare them historical and correct the offending sentences); update the result-contract cross-feature line.

### R-07 — Phase 3 does not declare the required closeout queue-removal fixture (blocking)

- Severity: major
- Facet: plan_code_area_coverage
- Locations: plan Phase 3 `scope.files` (declares `tests/fixtures/closeout/harness.ts` only; no `tests/fixtures/closeout` folder); test plan §6 and TC-QLC-020/025 (`tests/fixtures/closeout/queue-removal.ts` — new).
- Gap: The test plan requires a new `tests/fixtures/closeout/queue-removal.ts`; it is outside Phase 3’s declared scope. The commit primitive stages untracked files only inside declared scope, so the fixture is a stray and the phase’s tests cannot be committed as planned. The plan’s own rule says a phase touching an undeclared path stops and escalates.
- Suggested remediation target phase: delivery_planning
- Owning author: `@plan-writer`.
- Suggested fix: Declare `tests/fixtures/closeout/queue-removal.ts` (or the `tests/fixtures/closeout` folder) in Phase 3 and align the test plan’s file name.

### R-08 — Phase 6 runs and must edit a help test it does not declare (blocking)

- Severity: major
- Facet: plan_code_area_coverage
- Locations: plan Phase 5 scope (declares `tests/behaviour/queue-help-lifecycle.test.ts`), Phase 6 gate (`bun test tests/behaviour/queue-help-lifecycle.test.ts`) and Phase 6 `scope.files` (omits it); test plan TC-QLC-070 (“`queue --help` lists … `reconcile`”), assigned to Phase 6.
- Gap: TC-QLC-070’s family-listing/reconcile-help assertions belong to Phase 6 (the phase that adds the `reconcile` help entry), but the file is not in Phase 6’s scope. The plan’s rule forbids touching an undeclared path, so the coder must either stop/escalate or edit an undeclared file. Phase 5 cannot carry the final assertion because `reconcile` does not exist yet.
- Suggested remediation target phase: delivery_planning
- Owning author: `@plan-writer`.
- Suggested fix: Add `tests/behaviour/queue-help-lifecycle.test.ts` to Phase 6’s scope (or move TC-QLC-070’s family-listing assertion into a Phase-6-declared file) and state the Phase 5/6 split explicitly.

### R-09 — The TDR-0027 index-row staging can still land one-sided (blocking)

- Severity: major
- Facet: decision_capture, cross_artifact_consistency
- Locations: plan “DECISION-RECORD STAGING CONTRACT” and Phase 2/9 scope; `packages/core/src/domain/commit-staging.ts` (`tracked` pending work is always staged; scope drift is disclosed, not blocked); `doc/decisions/00-index.md`.
- Gap: `TDR-0026` is protected by reverting its index row from the working tree. `TDR-0027` is to be authored before delivery, and its index row is a modification to a tracked file. If the row is added at authoring time, Phase 1’s commit (or any earlier commit) stages the tracked index row without the untracked record, landing exactly the one-sided link the plan says must never happen. The plan states the one-commit rule but does not impose the working-tree discipline.
- Suggested remediation target phase: delivery_planning
- Owning authors: `@plan-writer`, `@pm`.
- Suggested fix: State that the TDR-0027 index row is withheld from the working tree until the Phase 2 commit (mirroring the TDR-0026 rule), or move the record+row to Phase 1; add a phase gate that verifies no index row names an absent record and every record is indexed.

### R-10 — The spec says no new ledger record is added while DM-1 adds one (blocking)

- Severity: major
- Facet: spec_completeness, cross_artifact_consistency
- Locations: spec §10 (“No new metric, counter, or ledger record is added”), DM-1 (`queue.removal` record), §22 (“One removal record per retirement”).
- Gap: §10 directly contradicts the change’s central data-model addition. A coder or reviewer reading §10 can conclude the removal is not a ledger record.
- Suggested remediation target phase: specification
- Owning author: `@spec-writer`.
- Suggested fix: Reword to “no new audit-ledger record, metric, or counter; the queue removal record is the one new queue-ledger record,” and keep §22 as the growth statement.

### R-11 — `callerPrincipal` current-state claim is false (advisory, minor)

- Severity: minor
- Facet: system_spec_consistency
- Locations: spec DM-1 (“the additive optional caller principal every queue record already carries”); delivered `QUEUE_RECORD_DECLARATIONS` (only `queue.entry` and `queue.dependency` carry `callerPrincipal`; lease/park/incident do not).
- Gap: The removal record’s field set is contract-bound and the claim about the delivered records is factually wrong.
- Suggested remediation target phase: specification
- Owning author: `@spec-writer`.
- Suggested fix: State the removal record’s exact field set; if `callerPrincipal` is included, describe it as additive on the new kind, not as something every queue record carries.

### R-12 — M2 architecture/contracts pages contradict the new behavior and are not reconciled (advisory, minor)

- Severity: minor
- Facet: plan_doc_update_coverage, cross_artifact_consistency
- Locations: `doc/planning/oss-tooling/milestones/m2/architecture.md` §Single-flight (“D → E[event: dispatch.attempt refused]”); `milestones/m2/contracts.md` §Event taxonomy v1 (“`remove` … emitted: false; no v1 path produces it”); plan Phase 8 doc list.
- Gap: The spec requires a refusal that appends no attempt/lane record and publishes no event; the M2 architecture page says a refusal produces a `dispatch.attempt/refused` event. The M2 contract page says `remove` has no producer. Neither page is in the plan’s reconciliation set.
- Suggested remediation target phase: delivery_planning
- Owning authors: `@plan-writer`, `@spec-writer`.
- Suggested fix: Add both pages to the Phase 8 reconciliation set (correct the diagram sentence and the event-taxonomy paragraph) or declare them historical and state why they remain unedited.

### R-13 — Help surface count and entry shape are ambiguous (advisory, minor)

- Severity: minor
- Facet: ac_quality
- Locations: spec §16 (“three new verb entries”), §5.1 F-7 (“each new verb has its own help entry”), AC-F7-1 (`queue --help` lists `remove`, `dep add`, `dep remove`, `reconcile`).
- Gap: The spec does not say whether `dep add`/`dep remove` are separate help paths or one corrected `dep` entry; “three new verb entries” does not match the four new spellings. TC-QLC-070/074 can pass or fail depending on the resolver behavior.
- Suggested remediation target phase: specification
- Owning author: `@spec-writer`.
- Suggested fix: Name the exact help inventory rows/paths and the expected count; align AC-F7-1, §16, TC-QLC-070/074, and the Phase 5/6 help work.

### R-14 — pm-notes carries a stale AC count (advisory, nit)

- Severity: nit
- Facet: cross_artifact_consistency
- Locations: `chg-GH-292-pm-notes.yaml` specification note (“45 ACs (39 capability + 6 NFR)”) vs spec v1.1/plan/test plan (“46”).
- Gap: Stale note; the spec itself is correct.
- Suggested remediation target phase: delivery_planning
- Owning author: `@pm`.
- Suggested fix: Correct the note or mark it historical.

### R-15 — The reconcile tracker-read seam is not named (advisory, minor)

- Severity: minor
- Facet: plan_code_area_coverage
- Locations: plan Phase 6 (“injected tracker read port”); delivered `StatusCommandRuntime.readWorkItems` (a list read) vs `VerifyCommandRuntime.readWorkItem` (a per-item read through the credential port); `packages/cli/src/production.ts` `queueComposition`.
- Gap: The plan does not say which delivered seam supplies the per-entry read. Reusing the status list read does not target a requested ref and does not satisfy NFR-4’s “one bounded read per examined entry” in the way TC-QLC-083 counts. Adding a `StatusCommandRuntime.readWorkItem` would require `packages/cli/src/commands/status.ts` (undeclared); adding a `QueueComposition` port would require `packages/cli/src/production.ts` (undeclared). A feasible route exists (`options.verify.readWorkItem` wired in `edge.ts`), but the plan should state it and assert the production composition supplies it.
- Suggested remediation target phase: delivery_planning
- Owning author: `@plan-writer`.
- Suggested fix: Name the seam and the exact wiring (prefer `options.verify.readWorkItem` in `edge.ts`), add any required file to Phase 6 scope, and add a DoD assertion that the production composition supplies a non-degraded read.

### R-16 — `feature-result-contract.md:462` still states five rows (advisory, minor)

- Severity: minor
- Facet: plan_doc_update_coverage
- Locations: `doc/spec/features/feature-result-contract.md:462` (“the `queue` kind with exactly the five scheduling rows”); plan Phase 1 doc edit list.
- Gap: The plan names the kind prose and the 127→129 counts but not this cross-feature line; the delivered spec would still say five rows after the change.
- Suggested remediation target phase: delivery_planning
- Owning author: `@plan-writer`.
- Suggested fix: Add the line to the Phase 1 `feature-result-contract.md` edit list (or fold into R-06).

### R-17 — The spec has no dedicated DoD section (advisory, nit)

- Severity: nit
- Facet: dod_defined
- Locations: spec §17 ACs, §4.1 KPIs; plan per-phase `definitionOfDone`.
- Gap: The DoD is inferable from the ACs/KPIs and plan phases; a one-line pointer would make it explicit for `dod_check`.
- Suggested remediation target phase: specification
- Owning author: `@spec-writer`.
- Suggested fix: Add “Definition of Done: all 46 ACs pass and all nine plan phases are complete” near §4.1 or §17.

## Gate result

NOT_READY. Blocking findings: R-01, R-02, R-03, R-04, R-05, R-06, R-07, R-08, R-09, R-10.

Remediation routing:
- `specification` (reopen, `@spec-writer`): R-01 (spec side), R-02, R-03 (DM-7/§7.1), R-05, R-10, R-11, R-13, R-17.
- `test_planning` (reopen, `@test-plan-writer`): R-01 (TC side), R-02 (equal-timestamp cell), R-04 (pin table).
- `delivery_planning` (reopen, `@plan-writer`): R-01 (Phase 2 DoD), R-03 (plan/TDR-0027 block), R-06, R-07, R-08, R-09, R-12, R-14, R-15, R-16.
- Decision records (`@decision-advisor`): correct TDR-0026 DC-1/DC-2/DC-3/DC-6 and author TDR-0027; these corrections are prerequisites to closing R-01/R-02/R-03/R-05.

Re-run the gate after the specification/test-plan/plan revisions. Do not reopen `delivery`.
