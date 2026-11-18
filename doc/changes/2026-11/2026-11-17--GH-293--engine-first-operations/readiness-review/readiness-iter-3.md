# Readiness Review Iteration 3

Verdict: NOT_READY
Work Item: GH-293
Date: 2026-11-18
Pause Required: no

## Facet Summary
- spec_completeness: PASS
- ac_quality: PASS
- plan_coverage: PASS
- test_traceability: FAIL
- cross_artifact_consistency: FAIL
- decision_capture: PASS
- system_spec_consistency: PASS
- plan_doc_update_coverage: PASS
- plan_code_area_coverage: PASS
- dod_defined: PASS

## What I verified (not findings)

Artifacts read: spec v1.3 (769 lines), test plan v1.2 (1,740 lines, 45 cases), plan revision 1.2 (1,188 lines), `chg-GH-293-pm-notes.yaml`, amended TDR-0031 (910 lines), readiness iterations 1 and 2, issue #293 body (re-read via `gh`), and the delivered source facts the closure model depends on.

**Targeted pressure tests requested for this iteration:**

- **(a) Plan phase 7 exit → handoff → DoD-7 chain is satisfiable in the declared lifecycle order.** The plan states one closure model (lines 390-398), one Phase 7 exit (lines 1131-1151), one handoff block (lines 366-388 and 1017-1044), and one escalation trigger aimed at the CHANGE (line 424). The order is: plan Phase 7's battery and commit land inside lifecycle phase 6 (`delivery`); lifecycle phase 7 (`system_spec_update`) then runs `@doc-syncer`; lifecycle phase 10 (`dod_check`) verifies DoD-7 and reopens `system_spec_update` if the reconciliation is absent. I checked that this is mechanically achievable and not just asserted: `planPhaseForLifecycle` maps only `delivery` and `delivery_planning` to plan phases (`packages/cli/src/commands/commit.ts:164-202`), so a `commit --phase system_spec_update` resolves to plan-absent scope by design (`degradedScope`, `scopeSource: "plan-absent"`), and `computeStagingPlan` stages every **tracked** pending edit regardless of scope, disclosing non-scope paths as `scopeDrift` rather than refusing (`packages/core/src/domain/commit-staging.ts:52-68`; drift is disclosure-only — `packages/cli/src/output/commit-text.ts:25`). Both `doc/quality/test-specs/` files are tracked, so the reconciliation is committable at lifecycle phase 7 whether or not plan Phase 7 declared them; declaring them is harmless and keeps the "no plan reopening" claim true. A *new* test-spec entry would be untracked and outside the stale scope, so it would be a stray and not staged — DEC-11 is self-enforcing on that path.
- **(b) DoD-7 and AC-F8-12 still require the reconciliation.** AC-F8-12: "… are reconciled to the delivered contracts in the documentation phase (phase 7, `@doc-syncer`), and no new test-spec entry is created"; spec DoD-7: "… the two broader test specs reconciled in lifecycle phase 7 by `@doc-syncer`"; plan DoD-7: "satisfied in lifecycle phase 7 and verified by the PM at DoD-7 — never a phase-7 exit test and never a residual"; test plan §3.6 DoD-7 row and §10 attestation both carry it. The handoff reframing did not make it optional.
- **(c) Narrowed controls still forbid touching delivered shell behaviour while permitting the parity suite.** Plan DECLARED CONTROLS (lines 343-350): "no diff to any EXISTING `scripts/*.sh` entry point or to `scripts/lib/**` … The ONE permitted addition under `scripts/` is the new … `test-engine-first-shell-parity.sh` … it adds a suite and must not alter existing shell behaviour, any exit, or the pinned five-key delivery summary." The shell escalation trigger (line 415) is narrowed identically. Test plan §10's shell-non-change attestation lists exactly the four entry points, `scripts/lib/dispatch-authority.sh` and the two delivered suites, and does not include the new parity suite. No contradiction remains.
- **(d) NFR-11 no longer contradicts TDR D2.** Spec NFR-11 (line 370) scopes the exemption to the attempts/divergences read and states "100% of idempotent revert noops still refused `dispatch.state-unverified` at exit 2 with no data when the handover ledger is unreadable or torn"; TDR D2 (lines 520-543) says the same; Appendix E.1's table is cell-identical to the record's table (verified row by row), and I re-checked the claim against the delivered code: `revertDispatchHandoverEvidence` folds the handover ledger first and returns `dispatch.state-unverified` on failure **before** the noop branch (`packages/core/src/app/dispatch-gate.ts:266-286`), so the newly stated refusal is true of the delivered read order.
- **(e) Ticket AC1-AC4 remain satisfied.** Re-read from issue #293: AC1 corroborated accrual → AC-F1-1/AC-F1-2; AC2 per-condition status → AC-F2-3/AC-F3-5; AC3 shell usable and documented → AC-F4-7/AC-F8-12; AC4 per-repository reversible flip → AC-F2-4/AC-F3-5/AC-F4-8. Spec v1.3 is clarification-only, adds no requirement elsewhere, and weakens none.

Other checks: TDR-0031's provenance now reads correctly (frontmatter summary line 8, Trigger lines 165-168, Decision preamble lines 492-497, References lines 887-890 attribute D8-D10 to spec v1.1, the D2 five-outcome amendment to spec v1.1 and D7's exit projection to spec v1.2, D11 to spec v1.2/DEC-17, and cite spec v1.3); no decision substance changed. `delivery-os plan validate GH-293` → `verdict=valid`, `tier=full`, `readyForDevelopment=true`; `delivery-os lint GH-293` → `conforms`. The 45 owned case ids still sum 6+7+7+6+9+10 with each id assigned once. TDR-0031 remains an untracked working-tree file whose `00-index.md` row is committed; plan Phase 1 still declares and lands it.

## Iteration-2 finding closure

| Finding | Status | Evidence |
|---|---|---|
| 1 [major] plan phase-7 closure mechanics self-contradictory | CLOSED | One closure model replaces the two mutually exclusive rules: plan lines 390-398 (handoff is not in-scope work; the CHANGE waits at lifecycle phase 10), Phase 7 Exit lines 1131-1151 (exit tests only in-scope work, suites, gate battery, controls, and the recorded handoff), DECLARED RESIDUALS lines 272-276, and escalation line 424 re-aimed from "any phase" to "the CHANGE is proposed to close with an AC or DoD item outstanding". No surviving "satisfied only when that landing row is met" outside the revision-history note (line 33). Satisfiability verified against the commit/phase staging semantics in (a) above — the phase can close, the change cannot. |
| 2 [nit] TDR-0031 cited spec v1.1 while describing D11 as a v1.1 seam | CLOSED | Trigger (165-168) now reads "spec v1.1 … three became D8-D10, and the fourth (OQ-5) amended D2's outcome promise; spec v1.2 added … D11"; Decision preamble (492-497) attributes the D2 five-outcome amendment and the D7 exit projection to their spec versions and D11 to spec v1.2 (DEC-17); References (887-890) cite spec v1.3 with D2/D8-D10 ← DEC-12-DEC-15 and D11 ← DEC-17. |
| 3 [nit] NFR-11 unqualified against the handover-ledger refusal | **PARTIALLY CLOSED — persistent, and now blocking** | The spec half is closed (NFR-11, NFR-4, §1 item 2, F-2, AC-F2-3, DEC-12, glossary, §7.1, §10, §16, Appendix A, Appendix E.1, and the success-metric pair). The test-plan half was not amended: §3.3 NFR-11 row (line 153) still states "0 revert noops refused by ledger readability"; §1 summary (line 11), §3.1 AC-F2-3 row (line 99) and GAP-T1 (line 61) still say the noop "still answers under an unreadable or torn ledger"; TC-ENGINE-010 step 6 and TC-ENGINE-011 step 6 cover only the attempts and divergences cells; no case in the 45 asserts the handover-ledger refusal. See finding 1 below. |
| 4 [nit] DECLARED CONTROLS forbade any `scripts/` diff while Phase 7 adds a suite | CLOSED | Plan lines 343-350 and 1153-1157 permit exactly the one declared parity suite and forbid any edit to existing entry points / `scripts/lib/**`; trigger line 415 is narrowed the same way; test plan §10 attestation matches. |

## Findings

1. [major] test_traceability (with a cross_artifact_consistency component) — `chg-GH-293-test-plan.md` §3.3 NFR-11 row (line 153), §3.1 AC-F2-3 row (line 99), §1 summary (line 11), GAP-T1 (line 61), TC-ENGINE-010 step 6 (line 470), TC-ENGINE-011 step 6 (line 505)
   Gap: Spec v1.3 moved the handover-ledger refusal into the acceptance contract — AC-F2-3 requires "an unreadable or torn handover ledger still refuses `dispatch.state-unverified` at exit `2` with no data on this path" and NFR-11 requires "100% of idempotent revert noops still refused … when the handover ledger is unreadable or torn". The test plan was not amended and now states the **opposite** threshold for the same behaviour ("0 revert noops refused by ledger readability"), continues to describe the noop as answering "under an unreadable or torn ledger", marks AC-F2-3 "Covered" with cases that assert only the attempts/divergences cells, and contains no case asserting the handover-ledger refusal (no `handover ledger` cell exists anywhere in the 45 cases; the delivered `dispatch-handover.test.ts` TC-HAND-003 exercises only the clean noop). A coder following the plan row could write a case that contradicts the AC, or write nothing and leave the read-order half of the exemption unpinned — the precise regression this change exists to prevent.
   Suggested remediation target phase: test_planning
   Suggested fix: Bump the test plan to v1.3 against spec v1.3 — qualify the §3.3 NFR-11 row (0 noops refused by the attempts/divergences read; 100% refused `dispatch.state-unverified` at exit 2 when the handover ledger is unreadable or torn), mirror the qualification in §1, §3.1 AC-F2-3, GAP-T1, OQ-TP-3 and §10, and add a cell to TC-ENGINE-010 (or 014) that seeds an unreadable/torn handover ledger for an already-`dual-run` repository and asserts exit 2, `dispatch.state-unverified`, no `data`, and no appended record.

2. [nit] cross_artifact_consistency — `chg-GH-293-plan.yaml` SOURCES (lines 80, 91); `chg-GH-293-test-plan.md` §2 (line 74)
   Gap: The plan still declares its binding sources as "Spec: … (v1.2 …)" and "Tests: … (v1.2 …)" while the spec is v1.3; the test plan also cites spec v1.2. This is the same class of stale provenance iteration 2 raised against the TDR, now in the plan and test plan.
   Suggested remediation target phase: delivery_planning (after the test_planning amendment bumps the test plan)
   Suggested fix: Update both citations to spec v1.3 and test plan v1.3 in one mechanical pass; change no substance.

3. [nit] spec_completeness — spec F-8 (line 195), §7.1 (line 277), OQ-4 (line 450), DEC-11 (line 470), DEC-16 (line 475), AC-F8-12 (line 513), §16 (line 493), §18 (line 547); mirrored in test-plan GAP-T7 (line 67)
   Gap: Every placement of the two reconciliations reads "the documentation phase (phase 7, `@doc-syncer`)". The lifecycle phase that owns them is `system_spec_update`; this change's documentation phase is plan phase 6. Naming one "the documentation phase (phase 7)" invites exactly the plan-phase-7 misread iteration 2 blocked, in the artifacts whose agreement now carries the closure model.
   Suggested remediation target phase: specification (mirror in the same test_planning pass)
   Suggested fix: Say "lifecycle phase 7 (`system_spec_update`, `@doc-syncer`)" at each occurrence.

4. [nit] plan_coverage — `chg-GH-293-plan.yaml` CLOSURE MODEL (lines 390-398), DECLARED RESIDUALS (lines 272-276), Phase 7 Exit (lines 1145-1150)
   Gap: "no phase of this plan may close with an unmet AC" is stated absolutely, while AC-F8-12 is by construction only partly met when plan Phase 7 closes (the reconciliation half is deferred to lifecycle phase 7). The intended rule is the carve-out sentence that follows, but the absolute form will read as violated at that boundary and re-opens the argument the revision was written to settle.
   Suggested remediation target phase: delivery_planning
   Suggested fix: State the rule over in-scope obligations — "no phase may close with an unmet AC obligation in scope for this plan or with in-scope work unlanded" — leaving the deferral sentence unchanged.

## Gate result

NOT_READY. One blocking (major) finding and three nit findings. Iteration-2 findings 1, 2 and 4 are closed on substance; finding 3 is closed in the spec and persists in the test plan, where it now contradicts the spec's own threshold.

The single upstream phase to reopen is **test_planning** (finding 1). It is resolvable without escalation: the change needed is a mechanical mirror of an already-decided, already-declared contract clause plus one test cell, and no human decision is involved (Pause Required: no). Findings 2 and 4 are plan-wording fixes that can ride in a delivery_planning pass after the test-plan bump, and finding 3 is a naming clarification that rides in the same specification/test_planning pass. Delivery is not reopened.

This is iteration 3 of a cap of ~3. If the same blocking gap persists into iteration 4, escalate to the human rather than loop.
