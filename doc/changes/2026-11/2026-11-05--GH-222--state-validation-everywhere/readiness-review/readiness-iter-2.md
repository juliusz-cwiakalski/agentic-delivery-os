# Readiness Review Iteration 2

Verdict: READY
Work Item: GH-222
Date: 2026-11-05
Pause Required: no

Scope of this iteration: verification of the v1.2 spec amendment against iteration-1 blocking findings 1–2, regression check of previously passing facets, and no-new-inconsistency sweep. Plan and test plan were NOT amended (confirmed via git: only `chg-GH-222-spec.md` and `chg-GH-222-pm-notes.yaml` modified since the iteration-1 verdict commit `1de18eec`), consistent with the iteration-1 reopen scope (specification only).

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

## Blocking-Finding Resolution Check

1. Iteration-1 Finding 1 (spec §7.1/§8.5 vs §22 self-contradiction on refined remediation rows): **RESOLVED**. Spec v1.2 §7.1 declares "TWO text-only remediation-guidance refinements" naming `state.write.failed` (storage-exhaustion carve-out) and `state.store.torn` (salvage-as-explicit-operation pointer); §8.5 enumerates both rows ("refines only the remediation guidance text of TWO existing rows" — "only" now scopes to guidance-text-vs-identity, not row count); §14 OQ-3, §16, and §22 name both refinements identically; §25 history records v1.2. Downstream alignment confirmed: TC-GH222-001 ("points at an inspect/salvage path"), TC-GH222-010 ("mentions salvage as an explicit separate operation"), plan tasks 1.2/1.3 (both rows, both tables, same commit), plan Phase-1 verification ("refined remediations match in both tables" — plural). Exclusivity grep ("only refined", "only one", "refines only") returns only the now-consistent enumerations.
2. Iteration-1 Finding 2 (DEC-5 recording three of four dispositions): **RESOLVED**. DEC-5 v1.2 records all four dispositions — (1) new `state.storage.exhausted`, (2) new `state.store.unknown`, (3) `state.write.failed` TEXT-ONLY refinement, (4) `state.store.torn` TEXT-ONLY refinement — plus (5) the salvage/quarantine reuse map and (6) the both-tables + binding sync discipline. Clause (4) encodes the iteration-1 adjudication verbatim: the salvage pointer lives in the guidance TEXT, not in read evidence; the evidence model (paths, positions, counts only) is unchanged. Rationale column records the decision grounds (§22 maintenance mandate + evidence-model prohibition). Routing correct: change-level disposition in the spec decision log; no system-level precedent requiring `doc/decisions/**`.

No-new-inconsistency sweep: the amendment is internally consistent and consistent with the operative content of both downstream artifacts. The only skew introduced is stale non-operative summaries in the untouched plan/test plan (Findings 1–4 below) — none change what is built, asserted, or verified.

## Findings

All findings below are NON-BLOCKING (minor/nit) and carried as context for delivery/review; no artifact is reopened.

1. [minor — non-blocking] cross_artifact_consistency — chg-GH-222-plan.md frontmatter `summary` and Context ("delivers the spec (chg-GH-222-spec.md v1.1)")
   Gap: the summary says "two additive error-table rows plus one refined remediation" and Context pins spec v1.1; spec v1.2 declares TWO refinements. Stale abstract only — operative tasks 1.2/1.3 refine both rows and Phase-1 verification expects plural "refined remediations match in both tables"; the v1.2 delta is exactly "the spec adopted this plan's resolution".
   Suggested remediation target phase: delivery_planning
   Suggested fix: opportunistic only (next natural plan edit or PR description): summary → "two refined remediation texts"; Context → "v1.2". Do not reopen for this.
2. [minor — non-blocking] cross_artifact_consistency — chg-GH-222-test-plan.md §1.1 (error-table sync bullet) and TC-GH222-018 step 3 / Expected Outcome
   Gap: singular "the refined row" names only `state.write.failed` (v1.1-era exemplar wording). Coverage is nonetheless complete: the torn row's two-table declaration is enforced by the total bidirectional sync check (TC-GH222-018 step 4, zero drift) with remediation-field comparison proven non-vacuous (TC-GH222-019 step 3), and the refined torn guidance is asserted behaviorally (TC-GH222-001 Expected Outcome, TC-GH222-010).
   Suggested remediation target phase: test_planning
   Suggested fix: opportunistic wording alignment — mention the refined `state.store.torn` remediation alongside `state.write.failed` in TC-GH222-018's step/outcome. No coverage change required.
3. [nit — non-blocking] cross_artifact_consistency — chg-GH-222-plan.md Context "For DoR attention (spec-internal tension, resolved in-plan)"
   Gap: the block describes the v1.1 §8.5-vs-§22 tension as live and conditions a `@decision-advisor` consult on gate rejection; the gate accepted the in-plan resolution and spec v1.2 adopted it, so the block is historical. Its contingency is moot.
   Suggested remediation target phase: delivery_planning
   Suggested fix: none required; mark as resolved context if the plan is touched for Findings 1/5.
4. [nit — non-blocking] cross_artifact_consistency — chg-GH-222-spec.md §14 OQ-3 status cell
   Gap: status reads "Resolved (v1.1)" while the resolution text records the torn-refinement disposition as "completed in the v1.2 amendment". Label-only; the question was substantively answered in v1.1 and fully recorded in v1.2.
   Suggested remediation target phase: specification
   Suggested fix: opportunistic label bump (e.g. "Resolved (v1.1; recording completed v1.2)").
5. [minor — non-blocking; PERSISTENT from iteration-1 Finding 3] plan_coverage — chg-GH-222-plan.md Phase 1, task 1.7
   Gap: task 1.7's parenthetical "(row shape)" still under-describes the three exact-count assertions (`toHaveLength(7)` at tests/structure/error-table.test.ts lines 390, 480, 647 → 9). File already in Phase-1 scope with the verification command running it; every-commit-green holds.
   Suggested remediation target phase: delivery_planning
   Suggested fix: opportunistic (may ride Finding 1's edit): name the three 7→9 sites in task 1.7.
6. [nit — non-blocking; PERSISTENT from iteration-1 Finding 4] cross_artifact_consistency — chg-GH-222-plan.md Context ("the current hint names neither")
   Gap: the current documented `state.store.torn` remediation names inspection (feature-result-contract.md "Inspect or restore the named state store…"); it lacks only the salvage-as-explicit-operation pointer. Sentence is imprecise about current state.
   Suggested remediation target phase: delivery_planning
   Suggested fix: correct the sentence when next touching the plan (rides Findings 1/5).

## Verified (adversarial checks performed this iteration — no blocking finding)

- Both blocking findings resolved as claimed (see resolution check above); amendment scope matches the iteration-1 suggested fix exactly ("no other section changes required" held — structural sections 1–13, 17–24 untouched, verified by section re-read).
- Residual-contradiction sweep across §5.1 (F-2/F-5 guidance wording), §7.1, §8.5, §9 NFR-6 ("added or refined"), §14, §15 (DEC-4/DEC-5), §16, §22, §25: all consistent; no exclusivity claim survives.
- Evidence-model guardrail in DEC-5(4) cross-checked against the system spec evidence model (paths/positions/counts; never payload or checksum bytes) and §10/§20/§21 — consistent; no silent drift.
- Downstream artifact integrity: plan and test plan byte-identical to the versions adjudicated in iteration 1 (git-verified); their operative content (tasks 1.2/1.3/1.6/1.7, verification commands, TC-GH222-001/010/018/019) now agrees with spec v1.2 end-to-end.
- Test coverage of the torn-row refinement re-derived: total sync check (TC-GH222-018 step 4) + remediation-field non-vacuity (TC-GH222-019 step 3) + behavioral guidance assertions (TC-GH222-001/010) ⇒ no drift path for the refined torn row. AC↔TC mapping unchanged from iteration 1 (9/9 covered, 23 TCs).
- Previously passing facets spot-checked for regression: ticket-AC mapping (§17) untouched; DoD/AC table untouched; NFR table untouched (NFR-6 already covered "refined"); doc-update targets (§16/§18/§22, pm-notes doc-impact list) intact; plan code-area coverage untouched.
- pm-notes updated coherently: specification iteration 3 (v1.2) recorded with completion timestamp; DoR iteration 1 recorded; delivery phases still null; retro note captures the root cause and the author/validator cross-check improvement.

## Residual Risks to Carry into Delivery/Review (carried forward from iteration 1, plus one)

1. Mechanism-first bet: M1-S8/M2-S3 must actually adopt the artifact-boundary contracts; TC-GH222-020's second-kind reuse assertion is the guardrail — review should confirm it stays.
2. Pack drift: `doc/planning/oss-tooling/milestones/m1/commands/state.md` retains the proposed `state.store.unknown-schema`; the later operate-family CLI story must reconcile it to the shipped `state.store.unknown`.
3. AC-F5-1 wording: "the ledger remains at the last valid frame" must be read per plan task 2.3 under `replaceDocument`'s existing ledger-first intent record (documented DEC-8 contract) — TC-GH222-016 correctly asserts document stability, not ledger byte-identity; reviewers should apply the plan's documented reading.
4. OQ-T2 (conformance matrix) and OQ-T3 (second salvage on clean ledger) are deliberately deferred with recorded decision paths — verify execution-log recording at Phase 5/6.
5. SQLite-binding skips must be recorded as skips, not passes (plan Phase 6; test plan §7.2).
6. Carried DoR minors (Findings 1–6 above): plan/test-plan summary wording predates spec v1.2 and the plan's "For DoR attention" block is historical; operative tasks and tests are correct and GOVERN — the phase-8 reviewer should apply this record and not re-flag the stale summaries as contradictions.
