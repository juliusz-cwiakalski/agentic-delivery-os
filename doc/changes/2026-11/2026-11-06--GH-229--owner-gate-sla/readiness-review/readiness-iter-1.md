# Readiness Review Iteration 1

Verdict: NOT_READY
Work Item: GH-229
Date: 2026-11-06
Pause Required: no

## Facet Summary
- spec_completeness: FAIL
- ac_quality: PASS
- plan_coverage: PASS
- test_traceability: FAIL
- cross_artifact_consistency: FAIL
- decision_capture: PASS
- system_spec_consistency: FAIL
- plan_doc_update_coverage: PASS
- plan_code_area_coverage: PASS
- dod_defined: PASS

## Verified context (checks performed, no findings)

- Ticket GH-229 loaded via tracker (OPEN; goal/tasks/AC match the spec's §17 verbatim AC and pinned decisions; Unblocks M1-S16; design baseline lists board.md + backlog). Dependency M0-S6 = GH-175 confirmed CLOSED.
- "Aging visible in brief and board" task: **adequately handled**. The surface split is explicitly documented (spec DEC-5, NG-2, [OUT], §13 "Feeds M1-S6 brief (GH-228)"), recorded as a PM decision in pm-notes, and grounded in planning truth (backlog M1-S6 assigns "owner-gate ages as anchored actions" to the brief; cli-command-registry.md gives `board` → M1-S5 and `brief` → M1-S6; GH-228 confirmed OPEN). Not a silent scope weakening.
- PDR-0003 uniqueness reading of "one pre-agreed default per gate": **coherent and explicitly documented, not buried** — spec G-1 ("escalation **or** a proceed decision"), G-2 ("at most one"), AC-F3-2, DEC-10 with full rationale; PDR-0003 Problem Framing carries the completeness-vs-uniqueness analysis, constraint table (C-1..C-5), and the owner ratification path (Proposed until GH-229 PR review, PM unblock delegation recorded). Decision routing correct; no `needs_human_input` pause.
- GAP-1..GAP-12 readings reviewed: **no silent scope weakening**. GAP-2/4/5/12 sharpen or delegate spellings; GAP-8 (torn store → fail-closed, exit 2) and GAP-11 (withhold board on any collector failure) are tightenings consistent with F-6/DEC-7 and envelope exclusivity; GAP-10 matches the delivered status stall arithmetic. GAP-6/GAP-7 pin sound behavior that the spec should absorb (finding 5); GAP-9's v0 mapping is honest but spec-invisible (finding 3).
- Repo verification: `STATUS_OWNER_ATTENTION_LABELS` (contracts/status.ts:196), status-digest 4-item family cap / open-only / ranking, `state/closeout.ts` precedent, `runCli` (packages/cli/src/index.ts), `guardStore` (tests/behaviour/verify-support.ts), `tests/structure/inventory.json`, S2 documented table in feature-result-contract.md, board row in cli-command-registry.md — all confirmed. Plan code-area and doc-update coverage verified against the tree.

## Findings

1. [major] test_traceability — chg-GH-229-test-plan.md#§5.2/TC-SLA-018 step 4
   Gap: TC-SLA-018 step 4 asserts "a waiver gate at 2 d renders `default-applied`" — 2 d = 48 h is below the pinned 72 h expiry. This contradicts the binding thresholds elsewhere in the same plan (TC-SLA-005 step 3: 71 h 59 m 59.999 s is NOT defaulted; TC-SLA-006 control: 71 h 59 m escalated, 73 h applied) and the spec (F-3, DEC-2, NFR-5). The fixture descends from the planning-pack worked example, which is itself internally inconsistent (board.md pins 72 h expiry but shows a 2 d default-applied gate). Under A-T1/A-T2 the test plan is binding on delivery: a correct engine fails TC-SLA-018 step 4 as written.
   Suggested remediation target phase: test_planning
   Suggested fix: Change the TC-SLA-018 step 4 fixture to an age ≥ 72 h (e.g. 73 h with its declared compact-form rendering) and record the pack example's "2 d" as a known pack-internal inconsistency (the plan's "illustrative only" note already covers the age; the TC must match it).

2. [major] system_spec_consistency — chg-GH-229-spec.md#§2.1, §5.1 F-5, §13 Dependencies (and front-matter internal dependencies)
   Gap: The spec presents the never-merge / owner-review-first gate-kind classification as an established input ("Gate classes carry the owner-gate classification established as policy-as-data by the verify-gates/merge story"; §13 lists it as "Depends on"). Repo truth: the delivered verify-gates has a single binary `owner-gate` (owner-gate-absent/present) with no kind/class vocabulary, and the merge/waiver story M1-S4 (GH-225) is OPEN. This change *creates* the initial classification (PDR-0003 → DM-3 → plan Phase 1); PDR-0003 honestly labels owner-review↔never-merge an ASSUMPTION to reconcile when M1-S4 lands, but the spec states it as delivered fact.
   Suggested remediation target phase: specification
   Suggested fix: Reword F-5/§2.1/§13 (and the front-matter dependency list) to state that this change introduces the initial classification as new contract data, that no delivered surface distinguishes kinds today, and that M1-S4 (GH-225) is the reconciliation point for the never-merge mapping (mirroring PDR-0003's revisit trigger).

3. [major] spec_completeness — chg-GH-229-spec.md#§12 (missing assumption), F-3, §4.1, §18
   Gap: The v0 production observability boundary is documented only in the plan (GAP-9 row: with the delivered tracker slice, every observed owner gate maps to kind `owner-review`, so the 72 h default-on-expiry, EVT-1 records, and `waivedBy` are unreachable against real data until a waiver-recording surface — M1-S4 — lands; they are exercisable only through injected facts/tests). The spec never states this: §4.1's metric "Owner gates older than 72 h in `default-applied` … 100%" is vacuously satisfiable in production (everything persistently escalates), and the ticket's headline mechanism ships mechanism-complete but production-inert. The spec is the binding source of truth for delivery and the phase-7 doc-sync input; hiding this boundary there risks a feature spec and PR review that discover it late.
   Suggested remediation target phase: specification
   Suggested fix: Add an explicit §12 assumption (and a sentence in F-3/§18): in v0 the only production gate kind is `owner-review`; waiver-kind gates and `waivedBy` are injection-exercisable and become production-reachable when M1-S4 (GH-225) delivers waiver recording; note the effect on the §4.1 metric so it cannot be read as production evidence of default application.

4. [minor] cross_artifact_consistency — chg-GH-229-spec.md#Appendix A (worked example)
   Gap: Appendix A reproduces the board.md worked example verbatim, including two deviations from the spec's own pins: the waiver gate "at 2 days" renders `default-applied` (below the pinned 72 h), and that gate carries `waivedBy: owner` (DEC-10/PDR-0003: a default application never populates `waivedBy`; TC-SLA-006/018 assert null). No non-normative caveat is given, inviting literal reproduction in golden files. The plan flags the age deviation only; the `waivedBy` deviation is unflagged anywhere in the spec.
   Suggested remediation target phase: specification
   Suggested fix: Mark the quoted worked example as illustrative-only and name both deviations (age below threshold; `waivedBy` on a default-applied gate contradicts DEC-10), cross-referencing DEC-2/DEC-10.

5. [minor] spec_completeness — chg-GH-229-spec.md#§5.1 F-7, §8.3 DM-1/DM-3, §9 NFR-4
   Gap: The board's rank key (severity → oldest age → gate id) and the truncation-priority rule ("no `escalated`/`default-applied` gate dropped while a `fresh` gate renders"), plus the machine truncation fields (`truncated`/`omitted`), are visible payload/behavior contracts pinned only in the test plan (GAP-6/GAP-7) and plan (Phase 1/2). A-T1 declares the spec the single source of truth; F-7/DM-1/NFR-4 are silent on ordering and truncation marking. The readings themselves are sound (a strengthening consistent with never-silence); they live at the wrong altitude.
   Suggested remediation target phase: specification
   Suggested fix: Absorb the ordering contract into the spec (DM-3 rank-key data or F-7, and DM-1/NFR-4 truncation-mark fields), citing the test-plan readings as the chosen values.

6. [nit] cross_artifact_consistency — chg-GH-229-spec.md#§16 ("Command registry / man-page surfaces — Updated")
   Gap: The registry row already exists as planning truth (cli-command-registry.md, M1-S5); the plan correctly treats it as verify/assert-only (TC-SLA-016 step 10 tree invariant, no in-change edit). The spec's "Updated" wording implies an edit that the plan (rightly) does not make.
   Suggested remediation target phase: specification
   Suggested fix: Reword §16 to "verified/asserted (row pre-exists in planning truth); no in-change edit".

7. [nit] test_traceability — chg-GH-229-test-plan.md#§7 execution order
   Gap: The §7 execution-order list omits TC-SLA-026 (read cost); the plan supplies Phase 4 for it and notes the omission. Harmless as mapped, but the plan's own A-T2 rule says the plan must not reshape TCs — a missing step in the plan's execution order should be fixed at the source.
   Suggested remediation target phase: test_planning
   Suggested fix: Add TC-SLA-026 to the §7 execution order (batch 6/7, matching its Phase 4 mapping) when revising for finding 1.

## Gate result

NOT_READY — 3 blocking findings (1, 2, 3). Reopen **test_planning** (findings 1, 7) and **specification** (findings 2, 3, 4, 5, 6); do not reopen delivery_planning (plan is strong: coverage, placement, doc-update and code-area facets all PASS, and its GAP confirmation table is where findings 2/3 were first visible). No pause flag: PDR-0003 ratification is already scheduled at the GH-229 PR review and needs no earlier human input. Re-run this gate after revision (iteration 2).
