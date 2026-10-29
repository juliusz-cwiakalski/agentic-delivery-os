# Readiness Review Iteration 2

Verdict: NOT_READY
Work Item: GH-170
Date: 2026-10-29
Pause Required: no

Reviewed artifacts: chg-GH-170-spec.md (v1.1, unchanged this round), chg-GH-170-test-plan.md
(v1.2, 38 TCs), chg-GH-170-plan.md (v1.1, P0–P10), chg-GH-170-pm-notes.yaml. Source of truth:
GitHub issue #170 (verified via tracker in iter 1; ticket unchanged). Binding context unchanged:
ADR-0003 (Accepted 2026-10-24, PR #163) incl. C-1..C-11, DEC-1..DEC-9, DEC-2 matrices re-read
verbatim this iteration (ADR lines 497–571); owner directive 2026-10-29; DEC-10/DEC-11 as
ratified. Prior record: readiness-review/readiness-iter-1.md (NOT_READY, 8 findings).

## Facet Summary
- spec_completeness: PASS
- ac_quality: PASS
- plan_coverage: PASS
- test_traceability: PASS
- cross_artifact_consistency: FAIL
- decision_capture: PASS
- system_spec_consistency: FAIL
- plan_doc_update_coverage: PASS
- plan_code_area_coverage: PASS
- dod_defined: PASS

## Iteration-1 Finding Closure Verification (all 8 verified genuine, not cosmetic)

1. CLOSED — `matrix-adapters-importer` now named in test plan §4.1 rule contract, TC-008
   (alias `adapters`→`cli`/`opencode`, relative `adapters`→`mcp`, `./contracts` clean control,
   form-independence assertion), TC-016 steps 3/7 (mandatory-rule set + targeted adapters-only
   fixture deletion), and mirrored verbatim in plan tasks 4.1/4.4/4.5. Rule-name parity between
   test plan §4.1 and plan 4.1 confirmed name-by-name (matrix ×5, subpath ×3, deep/relative ×2,
   tier ×5, testkit ×2, runtime-apis, ambient ×2).
2. CLOSED — Plan P10 now carries 10.1a–10.1d (AGENTS.md repo-structure + `scripts/checks/*.ts`
   scoped exception, glossary terms, cli-command-registry M0-S1 verification) with the expanded
   "System docs to update" list; all routed via `@doc-syncer` (lifecycle phase 7), no conflict
   with the untouchable-files constraint (AGENTS.md is not protected; backlog `Ticket:` lines
   untouched; `cli-command-registry.md` is not a protected file).
3. CLOSED — Checks-file count corrected to 18; independently recounted from plan tasks
   (P0.6×2, P1.6, P2.4, P3.3, P4.2–4.3, P5.3, P6.2/6.4×2/6.5, P7.2, P8.2/8.4×4 = 18 = 17
   TC-bound + `ambient-globals.ts`). Correct.
4. CLOSED — §2 reference range now DEC-1..DEC-11.
5. PARTIALLY CLOSED (residual demoted to nit, finding 2 below) — TC-007 moved to the
   invariant-check row (Bun row now 004–006); mutation row extended (018, 020, 024, 026, 031,
   034, 036, 037). TC-029 remains absent from the §4 layer table.
6. CLOSED — TC-019 step 1 + outcome now assert `target: ESNext` and
   `forceConsistentCasingInFileNames` by name; TC-020 precondition/outcome distinguish
   probe-covered flags from the two config-level settings.
7. CLOSED — Task 6.4 adds the `@changesets/cli` devDependency (pinned, floor recorded).
8. CLOSED — `links.implementation_plan` filled.

DEC-2 cell-walk verification (new content): mechanically compared against ADR-0003 lines
508–555. Package matrix: all six importer rows and every `no` cell match the ADR exactly
(core→{adapters,cli,mcp,opencode,testkit}; adapters→{cli,mcp,opencode,testkit};
cli→{mcp,opencode,testkit}; mcp→{cli,opencode,testkit}; opencode→{cli,mcp,testkit};
testkit→{cli,mcp,opencode}). Subpath table: adapters is the only importer with forbidden cells
(root `.`, `./state`, `./branding`) — matches. Tier matrix: 5 rules × 7 fixture edges, every
rule ≥1 case including the previously missing `tier-state-allowed-set` — matches. Testkit
dev-edge table: per-package `→testkit` probes now match the ADR's "negative fixture per
package" wording; row 4 (`testkit`→surfaces) covered ×3. No new count/ID inconsistencies
introduced (7 matrix cases consistent across §4.1/TC-008/plan 4.4; 38 TCs / 17 ACs intact
everywhere).

## Findings

1. [major | must-fix] system_spec_consistency (primary), cross_artifact_consistency —
   chg-GH-170-test-plan.md §4.1 (ambient-globals row) + TC-SCAFFOLD-015; chg-GH-170-plan.md
   tasks 4.1/4.2; vs chg-GH-170-spec.md F-6/G-2 and ADR-0003 C-9 + DEC-2 (ADR lines 535, 564).
   Gap: ADR C-9/DEC-2 declare runtime-neutral — "no ambient globals (`process`, `Bun`, `Deno`,
   timers, filesystem, network)" — for `core .`, `./contracts`, `./branding` AND the
   domain/app/config tiers (C-9: "the contract and port surface of the `.` and `./contracts`
   subpaths"). Spec F-6 requires "runtime imports and ambient globals **only where the ADR
   allows**". The planned AST guard bans globals only in `core/src/{domain,app,config,branding}`:
   a `process.env` read in `packages/core/src/contracts/**` or `core/src/index.ts` passes every
   boundary rule, no fixture exists, and TC-016 cannot see the hole (it proves named rules have
   fixtures, not that guard scope equals the ADR's neutrality set) — the same silent-ship
   failure mode as iter-1 finding 1, missed then by a lighter C-9 check. Latent at scaffold
   (TC-006 types-only inventory) but P4 builds the permanent enforcement layer. Secondary,
   same class: plan 4.1 scopes `runtime-apis-confinement`'s allowed set to "core/src/state and
   adapter I/O modules", omitting the ADR's "CLI build" and "OpenCode host integration"
   allowances (ADR line 535) — verbatim-parity gap in the over-enforcement direction that will
   mis-fire when surface stories add real code.
   Suggested remediation target phase: test_planning (mirror in delivery_planning)
   Suggested fix: Extend the ambient guard's neutral set to the ADR verbatim set (add
   `core/src/contracts/**` and the `.` surface modules incl. `src/index.ts`), add ≥1 fixture
   case to TC-015 (e.g. `process.env` in `core/src/contracts`) and register it; while editing
   TC-015, also add the branding non-env ambient case its §4.1 row already claims (e.g.
   `fetch` in branding). Mirror the scope in plan 4.2. State `runtime-apis-confinement`'s
   allowed locations exactly as the ADR does (state driver code, adapter I/O subpaths, CLI
   build, OpenCode host integration) or record an explicit deviation decision in the spec.
   No `needs_human_input` — the fix is deterministic unless an owner-approved narrowing is
   intended, in which case record it as a decision.

2. [nit | should-fix] cross_artifact_consistency — chg-GH-170-test-plan.md §4 (Test Types and
   Layers table). Residual of iter-1 finding 5's class (partially remediated; not a duplicate —
   the remaining instance).
   Gap: TC-SCAFFOLD-029 appears in no §4 layer row (the CI job check row lists 023, 024, 025,
   038) while §5.1/§7 correctly bind it to the post-`build` CI `exports-publint` job ("CI
   observation (023, 025, 029)" in §7).
   Suggested remediation target phase: test_planning
   Suggested fix: Add 029 to the CI job check row (ride along with finding 1's TC edits).

3. [nit | should-fix] system_spec_consistency — chg-GH-170-test-plan.md §4.1 closing note
   ("Allowed cells … proven by the clean-cruise controls in TC-008/009/011/013") vs the actual
   TC bodies.
   Gap: The only explicit package-matrix allowed control is `adapters`→`core ./contracts`;
   no control cruises `cli`→`core .` or a surface→`adapters` edge clean, so an over-broad
   importer rule (blocking an ADR-allowed edge) would ship uncaught until the first content
   story trips `check:boundaries` spuriously.
   Suggested remediation target phase: test_planning
   Suggested fix: Add one clean-cruise control for `cli`→`core .` (or surface→`adapters`) to
   TC-008, or soften the §4.1 claim to name only the controls that exist.

4. [nit | should-fix] system_spec_consistency — chg-GH-170-test-plan.md TC-SCAFFOLD-013 vs
   ADR-0003 DEC-2 dev-edge table row 3.
   Gap: The ADR requires "dependency-cruiser plus a passing fixture" for root `e2e/**`/`bdd/**`
   →`testkit`; TC-013 Case C covers only `packages/*/test` (row 2). The root-location allowance
   has no passing control.
   Suggested remediation target phase: test_planning
   Suggested fix: Add the root-location passing control (synthetic fixture dir) or record the
   deferral with the reason that root `e2e/`/`bdd/` do not exist at scaffold.

## Positive verifications (no finding)

- Iter-1 finding 1 is structurally closed, not papered: the meta-check's mandatory-rule set +
  targeted `matrix-adapters-importer` deletion mutation makes the adapters row gate-protected;
  `subpath-undeclared` proven at whole-specifier granularity with two registered cases.
- Ticket coverage, counts (38 TCs / 17 ACs), phase ordering, protected-file fencing, and DoD
  walkthrough: unchanged from iter 1 and still sound; no new cross-artifact count or reference
  drift introduced by the v1.2/v1.1 edits.
- Decision hygiene, NFR-7 deferral consistency, OQ-T1/T3/T4 states: unchanged and correctly
  routed.
