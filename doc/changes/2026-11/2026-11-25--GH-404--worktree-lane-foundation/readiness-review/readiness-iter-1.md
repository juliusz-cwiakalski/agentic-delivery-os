# Readiness Review Iteration 1

Verdict: NOT_READY
Work Item: GH-404
Date: 2026-11-25
Pause Required: no

## Facet Summary
- spec_completeness: PASS
- ac_quality: PASS
- plan_coverage: PASS
- test_traceability: PASS
- cross_artifact_consistency: FAIL
- decision_capture: PASS
- system_spec_consistency: PASS
- plan_doc_update_coverage: PASS
- plan_code_area_coverage: FAIL
- dod_defined: PASS

## Verification Basis

- Ticket read live (`gh issue view 404 --comments`): governing scope is the CEO comment of 2026-11-25 (comment 5 of 5) — nine deliverables, verbatim AC1–AC7, three explicit non-changes, three settle-during-planning directives. Confirmed the scope split (GH-412 owns parallel lanes, per-lane lease, cap, second-lane admission, sync-before-PR, behind indicator, owner-number measurement) and that the artifacts reflect it.
- Three-way traceability checked AC by AC: AC1 → AC-F2-1+AC-F3-1 → TC-ENV-001 (+TC-WT-003/004/005, TC-ENV-002/003) → plan phases 4+8. AC2 → AC-F4-1 → TC-RESUME-001/002 → phases 5+8. AC3 → AC-F9-1 → TC-IDENT-001 → phase 8 (pin only; F-9 is correctly no-change). AC4 → AC-F5-1 → TC-HOSTIDX-001/002/003 → phases 5+8. AC5 → AC-F6-1 → TC-CLOSEOUT-001..005 → phases 6+9. AC6 → AC-F7-1 → TC-SURFACES-001/002 → phases 7+9 (spec correctly delivers the deliverable-7 superset: all three surfaces, not AC6's `dispatch status` alone). AC7 → AC-F8-1 → TC-REG-001/002 → phases 4+7+8+9. No orphan in any direction.
- All nine governing deliverables + the enumeration caveat have exactly one behavioral landing phase (1: settings/contracts, 2: domain rules, 3: seam + enumeration, 4: provisioning/default flip, 5: resume + registration pin, 6: merge/closeout, 7: surfaces, 8/9: proofs, 10: changeset/reconciliation declaration), each with a declared commit scope and ≥1 named test. Shared files across phases (dispatch-lane.ts, dispatch-resume.ts, closeout-worktree.ts, lane-launch-plan.ts) are declared in every phase that touches them per the plan's own fence — accepted, bounded.
- Non-goals respected: NG-1..NG-7 are binding fences in the plan (escalation triggers + phase fences); no GH-412 scope (per-lane lease, cap, admission, sync-before-PR, behind indicator) and no renames anywhere in any phase scope; lease-order fence preserved; pr-open untouched.
- Code facts verified at current main-tools tip: the positional first-block drop exists exactly as specced (`packages/adapters/src/git/index.ts` — `.slice(1)` at :337 `isCheckedOutElsewhere` and :370 `listWorktrees`); the worktree seams exist (:117 `listWorktrees`, `removeWorktree`); the config catalog is section-prefixed (`lane.*`, `queue.*`, `daemon.*`); `.changeset/config.json` fixed group is exactly the five packages the plan declares; every "Existing – Update" suite named by the test plan and plan exists on disk (config-schema, dispatch-gate-evidence, dispatch-resume-economics, projects-identity, state-scope, merge-production-composition, closeout-worktree{,-idempotency,-refusal}, closeout-mutants, board-lanes, all five golden suites, new-code-naming, isolation checks); the cited pattern files exist (`tests/checks/no-shell-dispatch.test.ts`, `tests/checks/merge-deploy-no-live-calls.test.ts`); the five new test files are correctly declared "To Implement" and the one new source file (`packages/core/src/domain/lane-worktree-plan.ts`) is correctly declared new.
- AC7 testability: TC-REG-001 step 3 asserts exception-mode goldens **equal the pre-change goldens** (two distinct pin sets — non-circular), the surface list matches spec F-8 exactly (dispatch, resume, dispatch status, lanes, board, merge, closeout), the conditional-rendering mechanism is declared (phase 7), and escalation trigger 1 forbids regeneration-to-match-drift. Testable as planned (nit 5 below tightens the last ambiguity).
- DEC-8 consistently reflected: spec §8.5/§14/§15/§19, test plan TC-RESUME-003, plan DEC-8 fence (including the self-consistent rule that this change's own pre-DM-1 lane stays in the main checkout), escalation trigger 6. OQ-1 settled in plan rev 1 as phase 4's declared provisioning contract (install from pinned lockfile, gate build, gate temp dir inside the worktree — mirroring the ticket body's own `pnpm install --frozen-lockfile` directive), with the timing measurement as evidence only (NFR-9/TC-ENV-004, zero timing assertions — consistent in all three artifacts). TDR-0077 reserved but unused, consistently (spec DEC-7/OQ-1, plan rev log, pm-notes).

## Findings

1. [major] cross_artifact_consistency + plan_code_area_coverage — chg-GH-404-plan.yaml#phases[id=5].scope.files (registration pin, F-5/DM-2)
   Gap: The host-index root-flip hazard's causal write site is missing from the declared blast radius. Registration is written only at `packages/cli/src/production.ts:2160–2172`, which passes `registration.root = current.checkoutRoot` into `maintainHostIndex` — the exact site the ticket's owner-verified hazard comment names (`production.ts:2079` at 4f1a7ddc; unchanged at tip, only the line moved). Verified: `production.ts` is the only production caller of `maintainHostIndex` with a registration payload; `packages/core/src/app/host-index.ts` and `projects.ts` contain no registration write (maintenance logic and read/resolution surfaces only). Phase 5's declared scope (dispatch-lane.ts, dispatch-resume.ts, host-index.ts, projects.ts) therefore cannot deliver TC-HOSTIDX-001/002 ("after every command the entry's root equals the main checkout's path") without touching `production.ts` — colliding with phase 5's verify fence "git status confirms only the declared paths changed plus fence-authorized re-pins". The same write path carries TC-WT-005's host-index assertion (physical main-checkout path under a symlinked alias); if physical resolution (NFR-7) is fixed at its source, the scope-resolution seam `packages/core/src/app/state-scope.ts` (where `checkoutRoot` is computed; no realpath found there today) is also undeclared.
   Suggested remediation target phase: delivery_planning
   Suggested fix: Add `packages/cli/src/production.ts` to phase 5's declared scope (and `packages/core/src/app/state-scope.ts` if physical resolution is guaranteed at scope resolution); alternatively state explicitly that the fix is maintenance-side normalization and declare the file where its new probe is injected — either way, align the phase-5 verify fence with the declared surface so @coder never faces a scope-vs-ticket collision on the change's riskiest fix (RSK-2).

2. [minor] cross_artifact_consistency — chg-GH-404-plan.yaml#phases[id=1] vs chg-GH-404-spec.md#§8.3 DM-3/DM-4
   Gap: The literal configuration key paths for the two new worker settings are unpinned. Phase 1's summary names them unprefixed (`worktree-root`, disable-worktrees) while its own comment says the keys "follow the delivered lane-key pattern (lane.liveness-interval, lane.restart-budget)" — and the delivered catalog is section-prefixed (`lane.*`, `queue.*`, `daemon.*`). @coder would have to invent whether the keys land as `lane.worktree-root`/`lane.disable-worktrees`, a new section, or unprefixed — risking a DoD dispute against AC-F2-1's `worktree-root` identifier and the `<worktree-root>/<checkout-basename>-<ref>` path scheme.
   Suggested remediation target phase: delivery_planning
   Suggested fix: Phase 1 declares the exact literal key paths for both settings; if a section prefix is adopted, align spec DM-3/DM-4 and the glossary wording.

3. [minor] test_traceability — chg-GH-404-test-plan.md#§8.3 and TC-IDENT-002 step 3
   Gap: The test plan still records the F-10 guard form as "To settle at implementation" and instructs the implementer to choose between the positional pin and position-independence, while plan rev 1 declares it settled (position-independent enumeration in phase 3, structural main-checkout detection, shuffled-block-order guard; positional pin kept as documented fallback per spec §7.3). No contradiction in substance — both artifacts agree the plan owns the choice and either form satisfies AC-F10-1 — but the test plan's status lags the settlement.
   Suggested remediation target phase: test_planning
   Suggested fix: Update §8.3 and TC-IDENT-002 to reference the plan's chosen form (position-independent per DEC-5, plan phase 3) with the positional pin as the documented fallback.

4. [nit] decision_capture — chg-GH-404-spec.md#§14 OQ-1 status; chg-GH-404-pm-notes.yaml#open_questions
   Gap: Both still present OQ-1 as open ("To settle during planning (phase 4)… consult @decision-advisor" / "To settle during planning…") after the plan settled it (plan rev 1: provisioning contract declared as phase 4, no decision record authored, TDR-0077 stays reserved and unused). The settlement's routing is correct (change-scoped decision recorded in change docs — the plan itself), so this is status-string lag only.
   Suggested remediation target phase: specification
   Suggested fix: Mark OQ-1 settled-in-plan (pointing at plan rev 1) in spec §14; prune or annotate the pm-notes open_questions entry to match.

5. [nit] test_traceability — chg-GH-404-test-plan.md#TC-REG-001 (ticket AC7)
   Gap: The comparison design is correctly non-circular (exception-mode goldens vs pre-change goldens), but neither artifact names where the preserved pre-change pins live (existing `tests/golden/*` files vs pre-captured fixture files) or the boundary by which they must be captured — the last ambiguity that could let a self-referential pin slip past step 3.
   Suggested remediation target phase: test_planning
   Suggested fix: One sentence in TC-REG-001 naming the preserved-pin source and capture point (e.g., the existing golden files are the preserved pins; the phase-9 exception cases assert byte equality against them).

## Deduplication

No prior readiness records exist for this change folder; this is iteration 1. Nothing marked persistent.

## Gate Notes

- No `needs_human_input` decision surfaced: OQ-1's settlement required no human input (the ticket itself directs settle-during-planning and names `pnpm install --frozen-lockfile`); DEC-8 is a recorded, reversible, change-scoped PM decision flagged owner-visible at PR review; TDR-0077 correctly stays reserved and unused. Pause not required.
- The blocking finding reopens delivery_planning only (per DoR reopening rules, never delivery). Findings 3 and 5 name test_planning and finding 4 names specification as their remediation phases; the PM may bundle them into the same reopen cycle.
