# Readiness Review Iteration 1

Verdict: NOT_READY
Work Item: GH-170
Date: 2026-10-29
Pause Required: no

Reviewed artifacts: chg-GH-170-spec.md (v1.1), chg-GH-170-test-plan.md (v1.1, 38 TCs),
chg-GH-170-plan.md (v1.0, P0–P10), chg-GH-170-pm-notes.yaml. Source of truth: GitHub issue
#170 (verified via tracker). Binding context: ADR-0003 (Accepted 2026-10-24, PR #163) incl.
C-1..C-11, DEC-1/2/3/6/7/8/9, implementation-plan step 1, scaffold stop conditions; owner
directive 2026-10-29 (marksync reference, adapt-never-copy); DEC-10 license-registry seed
(PM-ratified, treated as in-scope — traceability verified and not disputed). No prior
readiness records exist (iteration 1, nothing to deduplicate).

## Facet Summary
- spec_completeness: PASS
- ac_quality: PASS
- plan_coverage: PASS
- test_traceability: FAIL
- cross_artifact_consistency: FAIL
- decision_capture: PASS
- system_spec_consistency: PASS
- plan_doc_update_coverage: FAIL
- plan_code_area_coverage: PASS
- dod_defined: PASS

## Findings

1. [major | must-fix] test_traceability (also cross_artifact_consistency) —
   chg-GH-170-test-plan.md §4.1 (Rule → Fixture → TC Matrix) + TC-SCAFFOLD-008; mirrored in
   chg-GH-170-plan.md task 4.1.
   Gap: The ADR-0003 DEC-2 package matrix forbids `adapters` → `cli`/`mcp`/`opencode`
   (all "no"), and spec G-2/F-7 require each forbidden edge of the matrix to be mechanically
   enforced AND proven by a failing negative fixture. The rule-name contract names importer
   rules only for `matrix-core-importer`, `matrix-cli-importer`, `matrix-mcp-importer`,
   `matrix-opencode-importer` — there is no `matrix-adapters-importer` (or equivalent) rule,
   and TC-008's fixture cases (cli→mcp, mcp→opencode, core→adapters, opencode→cli) include no
   adapters→surface edge. §4.1's own granularity statement ("package matrix per importer
   package" = six importers) is internally inconsistent with the four named rules. The
   testkit-importer row is covered (`testkit-no-surface-import`), so adapters is the sole
   uncovered row. `subpath-undeclared` might catch it in practice, but its fixture case is
   "importer → subpath absent from its declaration", which does not provably cover a
   whole-package undeclared import, and TC-007 (workspace-entrypoints) is a live-tree check
   with no negative case. Because TC-016's meta-check only proves *named* rules have
   fixtures, this hole is invisible to the fixture-coverage gate and would ship silently
   unproven (possibly unenforced) — exactly the failure mode M0-S1 exists to prevent.
   Suggested remediation target phase: test_planning
   Suggested fix: Add `matrix-adapters-importer` (or explicitly redefine `subpath-undeclared`
   to include whole-package undeclared imports) to the §4.1 rule-name contract with ≥1
   fixture case covering `adapters` → a sibling surface; update TC-008/TC-009 cases
   accordingly. Consequential mirror edit in plan task 4.1 (delivery_planning), same change.

2. [minor | should-fix] plan_doc_update_coverage — chg-GH-170-plan.md Phase 10 ("System docs
   to update") vs chg-GH-170-pm-notes.yaml notes ("Doc impacts for phase 7").
   Gap: PM notes flag AGENTS.md repo-structure (top-level dir list gains `packages/`), the
   overview glossary, and verification of the cli-command-registry M0-S1 row as doc impacts,
   but P10 lists only `doc/spec/**` and `.ai/rules/testing-strategy.md`. Compounding: test
   plan A-T1 places TS checks at `scripts/checks/*.ts`, which amends AGENTS.md's documented
   "`scripts/` — `.sh` extension required" convention with no planned AGENTS.md update.
   Post-delivery, AGENTS.md would misstate both the repo layout and the scripts/ convention —
   a live drift risk for agents ("where new code belongs").
   Suggested remediation target phase: delivery_planning
   Suggested fix: Add to P10 "System docs to update": AGENTS.md repo-structure section
   (`packages/`) and the scripts/ `.ts`-checks convention note; glossary monorepo mention;
   a cli-command-registry M0-S1 deliverables verification step.

3. [minor | should-fix] cross_artifact_consistency — chg-GH-170-plan.md §Artifacts and Links
   ("Invariant checks | `scripts/checks/*.ts` (17 files…)").
   Gap: The plan's own tasks create 18 files under `scripts/checks/`: the 17 TC-bound checks
   plus `ambient-globals.ts` (task 4.2). The stated count is wrong and will mislead
   verification (a file-count check or an auditor counting 18 would flag drift).
   Suggested remediation target phase: delivery_planning
   Suggested fix: Correct the count to 18 (or "17 TC-bound + ambient-globals.ts") in the
   artifact table.

4. [nit | should-fix] cross_artifact_consistency — chg-GH-170-test-plan.md §2 (References).
   Gap: The spec reference line says "DEC-1..DEC-10" but the spec carries DEC-11 since v1.1
   (referenced correctly by TC-029 and the §1.2 OQ-T1 closure). Stale summary line only.
   Suggested remediation target phase: test_planning
   Suggested fix: Update the §2 range to DEC-1..DEC-11 (may ride along with finding 1's edit).

5. [nit | should-fix] cross_artifact_consistency — chg-GH-170-test-plan.md §4 (Test Types
   and Layers table).
   Gap: TC-007 is classified under "Bun unit/smoke tests … 004–007" in the §4 layer table,
   but §7 and the TC body bind it to `scripts/checks/workspace-entrypoints.ts` (a runner
   script check); likewise the §4 mutation row ("018, 020, 031, 036") omits mutation steps
   that TC-024/TC-026/TC-034/TC-037 actually contain (§7 lists 024 and 037-mutation). Summary
   prose disagrees with the authoritative §5/§7 details.
   Suggested remediation target phase: test_planning
   Suggested fix: Align §4 summary ranges with §5/§7 (move 007 to the checks row; extend the
   mutation list) — cosmetic, ride along with finding 1's revision.

6. [nit | should-fix] test_traceability — chg-GH-170-test-plan.md TC-SCAFFOLD-019/020 vs
   chg-GH-170-plan.md task 2.1.
   Gap: Plan 2.1 adds `forceConsistentCasingInFileNames` and `target: ESNext` to the base
   config, but TC-019's asserted flag set (and spec F-4, ADR DEC-3) does not name them, so
   their removal would not fail the strictness check; TC-020's parenthetical probe list
   covers 6 flags while the text claims "exercising each flag". Not coverage-critical (the
   name-based strictness check is the primary gate) but the "exact flag set" claim in plan
   2.4 is unbounded relative to a written list.
   Suggested remediation target phase: test_planning
   Suggested fix: Either add the two settings to TC-019's asserted list or record them as
   intentionally unasserted extras; soften TC-020's "each flag" wording to match the probe
   list.

7. [nit | should-fix] plan_coverage — chg-GH-170-plan.md task 6.4 vs task 7.1.
   Gap: P6.4 creates `.changeset/config.json` and its check but never explicitly adds the
   `@changesets/cli` devDependency, while P7.1's registry enumeration already lists
   "changesets" among present dev dependencies.
   Suggested remediation target phase: delivery_planning
   Suggested fix: Add "add `@changesets/cli` devDependency (floor recorded)" to task 6.4.

8. [nit | should-fix] cross_artifact_consistency — chg-GH-170-test-plan.md front matter.
   Gap: `links.implementation_plan: null` although chg-GH-170-plan.md now exists (referenced
   in §2).
   Suggested remediation target phase: test_planning
   Suggested fix: Fill the link on the next test-plan revision.

## Positive verifications (no finding)

- Ticket coverage: all 9 ticket task clusters → F-1..F-14; all 3 ticket ACs → 17 spec ACs
  with traceable IDs; scope-outs are story-owned (M0-S2..S5, M0-S18) with explicit OUT rows.
- Counts: 38 TCs (001–038, contiguous) and 17 ACs agree across spec §17, test plan §3.1/§7,
  plan traceability table, and pm-notes.
- Ordering: boundary rules (P4) before CI boundary job (P8); build (P6.1) before
  exports/publint/attw (P6.2–6.3, P8); Bun pin copies 1+2 (P0) → copy 4 (P6.6) → copy 3
  (P8.1) → equality check (P8.2). No dependency inversions found.
- Protected items fenced: first commit 22aadb6 (no rebase/amend/reorder), backlog `Ticket:`
  lines, seven bash CI job blocks byte-untouched, `.opencode/`/`.ados-claude/` unchanged.
- DEC-2 sub-matrices reconcile: core tier rules encode the full ADR tier matrix (incl.
  A-T7's app→state-ports-only reading), subpath permissions match the ADR table, testkit
  dev edges and runtime/ambient confinement match C-9; alias AND relative forms both
  fixtured (TC-011/012).
- Decision hygiene: OQ-1→DEC-10 correctly routed as a change decision (ADR stop condition
  binding; ADR-0003 retrospective flag recorded) — traceability not disputed; OQ-T1→DEC-11,
  OQ-T4 resolved and bound in plan 5.3/8.1; OQ-T3 open with defined non-failing behavior.
- NFR-7 deferral is explicit and consistent in all three artifacts (spec §7.3/DEC-5, test
  plan §3.3/OQ-T2, plan P10.3) — not silently dropped.
- DoD: 17 testable ACs + plan P10.3 DoD walkthrough with TC evidence.
