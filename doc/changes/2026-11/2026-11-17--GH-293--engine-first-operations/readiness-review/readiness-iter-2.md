# Readiness Review Iteration 2

Verdict: NOT_READY
Work Item: GH-293
Date: 2026-11-18
Pause Required: no

## Facet Summary
- spec_completeness: PASS
- ac_quality: PASS
- plan_coverage: FAIL
- test_traceability: PASS
- cross_artifact_consistency: PASS
- decision_capture: PASS
- system_spec_consistency: PASS
- plan_doc_update_coverage: PASS
- plan_code_area_coverage: PASS
- dod_defined: PASS

## What I verified (not findings)

Artifacts read: spec v1.2 (766 lines), test plan v1.2 (45 cases, `TC-ENGINE-001..095`), plan revision 1.1 (7 phases), pm-notes, amended TDR-0031 (904 lines), issue #293 body (re-read via `gh`), M2-S16 backlog story, `SC-M2-S16-01/02/03`, `doc/spec/features/feature-projects.md` (row contract, exit projection, state-location outcomes, flat alias), `AGENTS.md` and `doc/guides/change-lifecycle.md` (the two sentences still to be reconciled), and the delivered source facts the artifacts depend on:

- `ERROR_TABLE['config.credential.missing']` is `domainKind: config`, `category: user`, `projectionClass: user-validation`; `packages/cli/src/projection.ts` maps `user-validation → 1` and `platform-provider → 2`. Exit `2` is therefore only `fallback.internal`. The spec/test-plan exit projection is factually correct.
- `revertDispatchHandoverEvidence` (`packages/core/src/app/dispatch-gate.ts:266-286`) folds the handover ledger first, answers the already-`dual-run` noop, then calls `readDispatchGate` only for a recorded revert; the noop returns `{repository, operation, recorded:false, noop:true}` with no conditions/verdict/truncation. The exemption is the delivered read order, and the plan's "preserve the order, add `reversible:false`" is implementable.
- `packages/cli/src/commands/dispatch.ts` exit guard requires `verdict !== undefined && verdict !== "eligible" && recorded !== true`, so populating `verdict` on the recorded revert cannot reclassify it — the plan's conditional narrowing claim holds.
- `repos list` constructs rows only for `ready` and `first-use`; a `state-unavailable` classification fails the read at exit `2` before a row is built (`production.ts:2747-2762`), so "every row" in AC-F3-5 is exactly the two states the spec and tests name. `REPOS_ENTRY_FIELDS` is the delivered five fields in order; `reposListDataOf` is in `packages/core/src/app/projects.ts`.
- `merge.transaction-aborted` declares exactly the row facts the plan's OQ-TP-6 justification cites (kind `merge`, category `user`, retryable, `not_landed`, `user-validation` → exit `1`, "aborted cleanly before any landing mutation").
- Spec Appendix E.1 is cell-identical to TDR-0031's D2 outcome table (only the table's two-space list indentation differs); five outcomes, one evidence-read-free row.
- Test plan arithmetic and traceability: 45 §5.2 headers, 45 unique ids, 45 §5.1 rows, 45 §7 automation rows, 45 ids assigned exactly once across the plan's `TC -> PHASE MAP` (6+7+7+6+9+10); 14/14 ACs covered; DEC-1..DEC-17, DM-1..DM-7, NFR-1..NFR-13, TDR D2/D4/D8/D9/D10/D11 all bound.
- `delivery-os plan validate GH-293` → `verdict=valid`, `tier=full`, `readyForDevelopment=true` (schema/mechanism validation only; it does not adjudicate the closure contradiction in finding 1).
- TDR-0031 is still untracked (`git status`: `?? doc/decisions/TDR-0031-engine-first-evaluation-surfaces.md`) while its `doc/decisions/00-index.md` row is committed at line 61 (`Proposed`, 2026-11-17). Plan Phase 1 declares the record and lands it as amended; TC-ENGINE-064 asserts the clause set and the five-outcome table. The declared-landing condition from iteration 1 is unchanged and is satisfied by the plan.
- No case, fixture, scenario, or success metric in the three artifacts asserts exit `2` for a missing credential; every occurrence of exit `2` on that path is an absence assertion or the record of the removed defect.

## Iteration-1 finding closure

| Finding | Status | Evidence |
|---|---|---|
| F-1 [critical] TDR D2 vs the exemption; missing D8-D11 | CLOSED | TDR D2 now states "every outcome that performs the gate evidence read" plus exactly one exempt outcome, and carries the five-outcome table; D8 (owner principal), D9 (emittable constant), D10 (row binding), D11 (production scope) exist; the owner acceptance of the narrowing is recorded (D2); plan Phase 1 lands the record *as amended*; TC-ENGINE-064 asserts D1-D11 and the table's five rows. |
| F-2 [major] TC-ENGINE-052 asserted exit 2 | CLOSED | TC-ENGINE-052 derives the exit from `ERROR_TABLE` + `projectExitCode` (expects 1), asserts exit 2 and `fallback.internal` absent across four invocation cells; TC-051/053 derive their exits the same way; TC-091 pins the projection map; spec F-6/F-7/AC-F6-10/AC-F7-11/§8.5/Appendix E.4 and the success metrics forbid the exit-2 assertion. |
| F-3 [major] lifecycle docs contradicted AC-F4-8 | CLOSED | AC-F4-8 and AC-F8-12 require the bounded edits and the zero-occurrence scan; §7.1/§7.2/§16/NFR-8 state the marker facts; plan Phase 6 scopes `AGENTS.md` + `doc/guides/change-lifecycle.md` with a bounded-edit constraint and owns TC-ENGINE-065; test-plan §10 adds the bounded-diff attestation. |
| F-4 [major] phase 7 pre-authorized an unmet AC-F8-12 | CLOSED (substantively) | The residual escape is deleted; the two test specs are a mandatory obligation owned by lifecycle phase 7, declared in plan-Phase-7 scope, attested at DoD-7, with an escalation trigger. The *closure mechanics* of that remedy introduce a new contradiction (finding 1 below). |
| F-5 [minor] merge-scope confirmation + precedent | CLOSED | Spec §15 DEC-8 note records (a) the PM interpretation of the 2026-11-15 owner comment, (b) confirmation at the GH-293 PR review, (c) the GH-320/CEO-D-097 precedent; the pm-notes decision entry records the interpretation and the PR-review confirmation point. |
| F-6 [minor] fleet row's evidence scope undeclared | CLOSED | Spec F-3/DM-4/§8.1/§8.5 declare the `production` scope (DEC-17, TDR D11); AC-F3-5 requires it; test plan TC-020/021/022/093 and SCOPE-ENG-1 assert the effect and the absence of a scope key; plan Phase 4 cites DEC-17/D11. |
| F-7 [minor] stale TDR open questions / D1-D5 wording | CLOSED | TDR "Unresolved Questions" resolves OQ-1..OQ-3 and leaves one open non-blocking item; the summary and D5 align on "declared known limitation, defect optional". (A residual provenance nit remains — finding 2 below.) |
| F-8 [minor] no change-specific DoD | CLOSED | Spec §17.1 defines DoD-1..DoD-10 traceable to the 14 ACs and the seven plan phases; test-plan §3.6 maps each to cases or a named attestation; plan Phase 7 asserts all ten and assigns DoD-9 to the gate battery and DoD-10 to the PM's phase-10 check. |
| F-9 [minor] incidental `omittedRecords` literal | CLOSED | TC-ENGINE-024 asserts the contract (imported bound, integer positive omission inside the seeded envelope, `unverifiable`, `countedDeliveries < seededIdentityBoundRecords`, invariance under foreign-record removal); TRUNC-ENG-1 and R-TP-12 record why no literal is the contract. |
| F-10 [nit] refusal-code criterion | CLOSED | Plan OQ-TP-6 states a five-part binding criterion (a)-(e) — declared row, reused with its declared meaning, declared projection/exit, constant member with kind agreement, stop-and-reopen if no row fits — and justifies `merge.transaction-aborted` against that row; TC-ENGINE-053/054 assert the row shape and the constant totality. |

## Findings

1. [major] plan_coverage — `chg-GH-293-plan.yaml`: Phase 7 "MANDATORY LIFECYCLE-PHASE-7 LANDING ROW" (lines 951-969), Phase 7 "Exit" (lines 1052-1064), the DOC BOUNDARY note (lines 321-335), DECLARED RESIDUALS (lines 229-236), and the escalation trigger (line 361)
   Gap: The landing row requires the two `doc/quality/test-specs/` reconciliations to be produced by **lifecycle phase 7** (`system_spec_update`, `@doc-syncer`) and makes the plan phase "satisfied only when that landing row is met", while the same row and the DOC BOUNDARY say that "if lifecycle phase 7 has not run when the plan-phase-7 battery ends, the obligation remains OPEN". Lifecycle phase 7 runs after the plan-phase-7 battery (which executes inside `delivery`), so in the declared order the plan phase can never satisfy its own exit. The two alternatives the plan offers are mutually exclusive: close the phase with the obligation outstanding (which DECLARED RESIDUALS forbids — "No phase of this plan may close with that obligation outstanding") or stall delivery so lifecycle phase 7 never starts. The escalation trigger's "Any phase is proposed to close with ... a spec §17.1 DoD item outstanding" makes the stall the deterministic path at that boundary. The substantive obligation is not weakened (DoD-7 is checked at phase 10 and nothing can close unmet); the defect is that the remedy over-corrected F-4 by converting a staged handoff into an unsatisfiable plan-phase exit, deviating from the GH-294/GH-299 staged-handoff precedent ("declared so the commit primitive can stage it", never a phase-exit test).
   Suggested remediation target phase: delivery_planning
   Suggested fix: Choose one closure model and state it once, then delete the contradictory sentence. Either (a) the plan phase completes its battery with the reconciliation OPEN, the **change** is blocked at phase 10, and the escalation trigger reads "the change may not close with an AC or DoD item outstanding" (not "any phase"), or (b) `@doc-syncer` performs the reconciliation inside the closing battery and it lands in the plan-phase-7 commit, so the phase may close only when met. Align the landing row's `gate`/`failure`, Phase 7's Exit, DECLARED RESIDUALS, and the escalation trigger to the chosen model.

2. [nit] decision_capture — `doc/decisions/TDR-0031-engine-first-evaluation-surfaces.md`: Trigger (lines 165-166), Decision preamble (lines 492-493), References (lines 883-884)
   Gap: The amended record says "Spec v1.1 then raised four seams ... (its OQ-5..OQ-8) ... adopted here as D8-D11" and cites the change spec at "v1.1 (DEC-12-DEC-15 adopted here as D2/D8-D11)". D11 is the row's `production` evidence scope, adopted from spec **v1.2** DEC-17 and readiness iteration 1 finding F-6 — as D11's own text states. The record's provenance prose contradicts its own clause and cites a superseded spec version.
   Suggested remediation target phase: specification
   Suggested fix: In the same amendment pass, update the References line to spec v1.2, describe D8-D10 as the v1.1 seams (OQ-5..OQ-8 minus the exemption, which is D2) and D11 as the v1.2 scope declaration (DEC-17, readiness F-6), and adjust the Trigger/Decision preamble accordingly.

3. [nit] spec_completeness — `chg-GH-293-spec.md` NFR-11 (line 369) and `chg-GH-293-test-plan.md` §3.3 NFR-11 row (line 153)
   Gap: NFR-11's threshold "0 idempotent revert noops refused by ledger readability" is unqualified. The declared exemption covers only the **attempts/divergences evidence read**: an unreadable *handover* ledger still refuses the noop with `dispatch.state-unverified` (spec F-2, TDR D2, Appendix E.1, plan Phase 3). Read literally, the NFR contradicts the contract it summarizes and could be implemented as a test that fails the declared handover-ledger refusal.
   Suggested remediation target phase: specification (mirror the wording in test_planning)
   Suggested fix: Qualify the threshold as "0 idempotent revert noops refused by the attempts/divergences evidence read", and state the handover-ledger refusal as the expected behaviour in the same row.

4. [nit] plan_coverage — `chg-GH-293-plan.yaml` DECLARED CONTROLS (lines 291-307) vs Phase 7 scope (line 1086)
   Gap: The controls paragraph says "a diff to `scripts/` is a plan violation, not a mechanism choice", while Phase 7 declares a new `scripts/.tests/test-engine-first-shell-parity.sh`. The test plan (§10) enumerates the delivered scripts precisely, so only the plan's shorthand over-claims.
   Suggested remediation target phase: delivery_planning
   Suggested fix: Narrow the parenthetical to "a diff to the delivered shell scripts and their two delivered test suites" so the declared new parity suite is not a contradiction.

## Gate result

NOT_READY. One blocking (major) finding and three non-blocking (nit) findings. All ten iteration-1 findings are closed on substance: the TDR carries the five-outcome table with the single exemption and D8-D11; the spec, test plan, and plan agree on the exemption, the exit projection (exit `1` for `config.credential.missing`, exit `2` only as the repaired defect's signature), the `production` scope, the row identity binding, the emittable constant, and the mandatory phase-7 obligation; the ticket's AC1-AC4 are still satisfied and no AC or DoD item can close unmet.

The single upstream phase to reopen is **delivery_planning** (finding 1: the final plan phase's exit and the change's closure condition contradict each other and must be restated on one closure model). Findings 2 and 3 belong to **specification** and can be folded into the same remediation pass; finding 4 is a plan wording fix in the same delivery_planning pass. Delivery is not reopened.

No pause flag: no human decision is required to resolve the blocking finding; the merge-scope interpretation remains authorized by the owner-authored comment on issue #293 and its confirmation point is the GH-293 PR review (DEC-8 note).
