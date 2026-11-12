# Readiness Review Iteration 2

Verdict: READY
Work Item: GH-292
Date: 2026-11-12
Pause Required: no

## Inputs and checks performed

- Ticket GH-292 (M2-S15) via pm-notes scope decisions; spec `chg-GH-292-spec.md` v1.2, test plan `chg-GH-292-test-plan.md` v1.2, `chg-GH-292-plan.yaml` (revised), `chg-GH-292-pm-notes.yaml` (three DoR policy decisions recorded).
- `doc/decisions/TDR-0026-queue-lifecycle-removal-single-flight.md` (amended: DC-1 append position, DC-2/DC-3 precedence table, DC-6 byte-identical rows, Unresolved Questions = none) and `doc/decisions/TDR-0027-command-failure-envelope-detail-slot.md` (ALT-3, settled). Both verified untracked (`??`) with `doc/decisions/00-index.md` carrying neither row — the exact state the plan's decision-record staging contract requires before delivery.
- Mechanical gates re-run and re-verified: `plan validate GH-292` → `verdict=valid`, `readyForDevelopment=true`. AC→TC matrix 46/46 with no orphan; 59/59 TCs agree across §5.1 index, §5.2 bodies, and §7 automation rows; plan AC map 46/46 and TC map 59/59, each owned exactly once by a phase (1+7+6+4+13+10+4+1 ACs; 1+7+7+7+19+11+5+2 TCs). Plan scope covers every falsified doc page and every pin site named in the canonical table; additive boundary (0 packages/subpaths/adapters/schema versions, exactly 2 error rows) is pinned by AC-NFR-6/TC-QLC-085 and tier escalation triggers; tracker read stays on the declared credential port with the NFR-4 budget and NFR-6 bounded output.
- Cross-artifact coherence on the three remediated contracts verified line-by-line: the F-4 precedence table is identical in spec §5.1 F-4, TDR-0026 DC-2, TC-QLC-040..045, and plan Phase 2 goal/DoD; the presence rule (append position `sequence`, tie impossible, equal-`recordedAt` resolved by append order) is identical in spec DM-2/§23, TDR-0026 DC-1, TC-QLC-007/009, and plan Phase 1; the envelope-root `detail.holder` placement with six-field `CommandResultError` and `error.detail` rejected is identical in spec DM-7/AC-F4-1/AC-F4-2/glossary, TDR-0027 ALT-3, TC-QLC-040/041/045, and plan Phase 2.

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

## Blocking-Finding Closure (iteration 1 → iteration 2)

1. **R-01 (critical, single-flight vs renewal) — CLOSED.** Spec §5.1 F-4 now authors the full path-specific precedence table (dispatch family refuses any live same-ref lease, any holder; `queue claim` renews own-holder same-ref, refuses another holder's same-ref, conflicts on other-ref; stale takes over on both paths; direct seam unchanged), states why AC-F4-1/2/5 hold together only under it, and aligns AC-F4-1/2/5, Flow 4, §8.5, DEC-3, §4.1 KPI. TDR-0026 DC-2/DC-3 carries the identical table with an amendment entry citing R-01 and the PM decision. TC-QLC-040 (same- and different-holder dispatch refusal), TC-QLC-041 (own-holder `renewed` cell restored; "no case asserts a same-holder same-ref claim refusal"), TC-QLC-042..045 match row by row. Plan Phase 2 DoD repeats the table and keeps the two delivered lease controls green with no assertion change.
2. **R-02 (critical, presence comparator) — CLOSED.** Spec DM-2/§23/AC-F1-7 define presence by ledger append position (`sequence`), never `recordedAt` text, tie impossible, equal-`recordedAt` resolved by append order with re-declaration restoring. TDR-0026 DC-1 amended identically; its unresolved question is closed as resolved. TC-QLC-007 steps 7–8 and TC-QLC-009 steps 5–6 construct the equal-`recordedAt` cells in both append orders, so the plan Phase 1 risk's "equal-timestamp cells" claim is now true.
3. **R-03 (critical, `error.detail` decision) — CLOSED.** TDR-0027 exists (Proposed, ALT-3): envelope-root optional `detail`, `CommandResultError` exactly six fields, `error.detail` rejected, exit from the row's class, pins move two-sided. Spec DM-7/AC-F4-1/AC-F4-2/§10/§16/glossary/§13/App. A–B all cite it with envelope-root `detail.holder`. The plan's open-decision block and the option-(c) re-planning escape are gone ("SETTLED CONTRACT DECISION"; Phase 2 is conditional-free; the four envelope pins — type probe, structure pin, `result-conformance.ts`, `envelope-key-set.json` — are in Phase 2 `scope.files`).
4. **R-04 (major, pin set incomplete/disagreeing) — CLOSED.** Test plan §7.1 is now the single canonical two-sided table: six `remove`-emission pins (rows 1–6, including the `event-projection.ts` source scan with its new two-sided expectation — row 6), three registry/baseline pins, two count pins, one CLI export pin, one golden rule, with counts "stated once". TC-QLC-064 enumerates rows 1–6 including the source-scan positive form. Spec §2.1/§7.1/§18/§17.9/DEC-14 restate only the groups and defer to that table; the plan header cites §7.1 as canonical (naming the source scan) and Phase 4 scope covers all six files.
5. **R-05 (major, TDR-0026 authorized rewording a pinned row) — CLOSED.** TDR-0026 DC-6 now states the five delivered rows stay byte-identical field by field, with `lease-held` only in bounded refusal text; the prose-generalization permission is withdrawn via a recorded amendment citing R-05, and the unresolved question is closed. Spec F-7/AC-F7-3/Appendix E, plan Phase 1 pin group B, and the PM decision (pm-notes) all agree.
6. **R-06 (major, falsified docs missing from update set) — CLOSED.** Spec §16 declares the two-set ownership split: in-plan (M1 page, M2 queue/contracts/architecture pages, registry, status, backlog, glossary, plus `feature-result-contract.md` and `feature-state-layer.md` in Phase 1 because `pnpm check` guards read them) and phase-7 (`feature-scheduling/dispatch/closeout/event-taxonomy` pages and any count-bearing page). Plan Phase 1 scope carries both `doc/spec/**` pages with guard rationale; Phase 8 scope carries both M2 pages with the exact offending sentences named.
7. **R-07 (major, closeout fixture undeclared) — CLOSED.** `tests/fixtures/closeout/queue-removal.ts` is in Phase 3 `scope.files` (line 728), matching test plan §6 and TC-QLC-020/025.
8. **R-08 (major, Phase-6 help test undeclared) — CLOSED.** `tests/behaviour/queue-help-lifecycle.test.ts` is in Phase 6 `scope.files` (created Phase 5, extended Phase 6 for the `reconcile` help assertions); TC-QLC-070 is owned by Phase 6; the Phase 5/6 split is stated in the phase-set comment and Phase 6's objective.
9. **R-09 (major, one-sided index row) — CLOSED.** The plan's DECISION-RECORD STAGING CONTRACT withholds both index rows from the working tree; `doc/decisions/00-index.md` is declared in exactly two scopes (Phase 2: TDR-0027 + row, one commit; Phase 9: TDR-0026 + row, one commit, row text pinned in pm-notes). Verified against the live tree: both records untracked, index carries neither row. §7.1 adds the R-09 note governing any future index-asserting TC; the tier carries an escalation trigger.
10. **R-10 (major, §10 vs DM-1) — CLOSED.** Spec §10 now reads "No new telemetry sink, metric, or counter … no new audit-ledger record; the one new queue-ledger record kind is the removal record (DM-1), and §22 states its growth" — consistent with DM-1 and §22.

## Advisory Re-Check (R-11..R-17)

- **R-11 — PARTIALLY CLOSED (residual, minor, persistent).** The primary location is fixed: spec DM-1 states the removal record's exact field set and explicitly retracts the "every queue record carries it" claim (only `queue.entry` and `queue.dependency` declare it). Two residual instances of the false descriptive clause remain: spec §20 ("the additive caller principal every queue record already carries") and TDR-0026 DC-1 ("the additive optional caller principal every queue record carries"). Both agree with DM-1 on the removal record's own field set, so no contract ambiguity remains; the residual is a descriptive contradiction about delivered state.
- **R-12 — CLOSED.** M2 `contracts.md` and `architecture.md` are in Phase 8 scope with the exact corrections stated in spec §16 and the Phase 8 objective/DoD.
- **R-13 — CLOSED.** Spec F-7/§16/AC-F7-1 state exactly two new verb help paths with the three dependency spellings inside the one `queue dep` entry; TC-QLC-070/074 and plan Phase 5/6 DoD follow.
- **R-14 — CLOSED.** pm-notes now records 46 ACs (40 capability + 6 NFR).
- **R-15 — CLOSED.** Phase 6 names the exact seam (the per-item `readWorkItem` verified read bridge in `packages/cli/src/edge.ts`), declares `packages/cli/src/production.ts`, and its DoD asserts the production composition supplies the non-degraded read (no `status` list read).
- **R-16 — CLOSED.** Phase 1's `feature-result-contract.md` edit list includes the cross-feature scheduling-row sentence (five → seven rows) and the envelope member in Phase 2.
- **R-17 — CLOSED.** Spec §17.9 defines the DoD explicitly (46 ACs, four M2 scenarios, decisions implemented, two-sided pin migrations, documentation, gates), wired to `dod_check` and the plan phases.

## Findings (residual, all non-blocking)

1. [minor] cross_artifact_consistency — `chg-GH-292-spec.md` §20 + `TDR-0026` DC-1 (persistent R-11 residual)
   Gap: Both still carry the factually false clause "caller principal every queue record (already) carries", which DM-1 explicitly retracts; `queue.lease`/`queue.park`/`queue.incident` do not declare the field. Descriptive only — the removal record's field set is identical in all artifacts and pinned by TC-QLC-001/085.
   Suggested remediation target phase: specification
   Suggested fix: Reword the §20 sentence to match DM-1 ("carried as the two delivered kinds that declare it carry it"). For TDR-0026 DC-1, route the one-clause correction to `@decision-advisor` as a rider at the GH-292 PR review (the plan forbids the coder from editing the record); do not hold delivery for it. Owner: `@spec-writer` (§20), `@decision-advisor` (DC-1 clause).
2. [nit] cross_artifact_consistency — `chg-GH-292-plan.yaml` header comment, pin group A item 6
   Gap: Stale parenthetical "a fifth pin beside the four §7.1 names" reflects the pre-v1.2 four-row table; §7.1 now has six remove-emission rows and the same header's SOURCES block states the six-pin truth including the source scan.
   Suggested remediation target phase: delivery_planning
   Suggested fix: Optional editorial correction of the parenthetical; the canonical-table rule (DEC-14) already resolves any ambiguity. Owner: `@plan-writer`.
3. [nit] cross_artifact_consistency — `chg-GH-292-test-plan.md` §2 and `chg-GH-292-spec.md` §25
   Gap: §2 still labels `chg-GH-292-plan.yaml` "(forthcoming)" though the plan exists and validates; §25's document-history rows are ordered 1.0, 1.2, 1.1.
   Suggested remediation target phase: test_planning (§2 wording) / specification (§25 row order)
   Suggested fix: Drop "(forthcoming)"; reorder rows newest-first. Cosmetic; no reader decision depends on either. Owners: `@test-plan-writer`, `@spec-writer`.

## Gate result

READY. All ten iteration-1 blocking findings are closed with evidence in the current artifacts; all mechanical gates pass (`plan validate` verdict=valid, readyForDevelopment=true; 46/46 ACs traceable; 59/59 TCs, no orphan; decision-record staging state verified in the live tree). Residual items are advisory only (one minor persistent R-11 descriptive residual with named owners, three nits) and none blocks delivery. Delivery may start; the advisory fixes can ride the specification/test-planning/delivery-planning owners' next touch or the PR review without reopening a phase.
