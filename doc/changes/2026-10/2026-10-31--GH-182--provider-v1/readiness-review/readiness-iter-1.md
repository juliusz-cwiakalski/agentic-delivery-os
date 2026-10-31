# Readiness Review Iteration 1

Verdict: READY
Work Item: GH-182
Date: 2026-10-31
Pause Required: no

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

## Verification Evidence

- Counts independently recomputed: 46/46 ACs (spec §17 = test-plan §3.1 = plan ledger); 62/62 TCs (each present exactly once in §5.1 and §7.1, no orphans, each owns ≥1 AC/NFR); 9/9 Appendix A groups → TC-PROV-054..062; 49/49 legacy IDs — the live battery `scripts/.tests/test-hook-zai-example.sh` contains exactly 49 unique `TC-ZAI-*` IDs matching test-plan §5.3 ID-for-ID.
- Ticket (GitHub #182) loaded; both ticket ACs and all ticket tasks traced in spec Appendix D; the state-layer dependency addition beyond the ticket's minimum list is justified (spec §13) and delivered.
- Plan code-reality facts verified against the live tree, all accurate: core exports exactly `.`,`./contracts`,`./state`,`./branding` with no `packages/core/src/provider/**`; `NEUTRAL_TIER_DIRECTORIES` = (contracts, domain, app, config, branding); `runtime-apis-confinement` pathNot = (repo|file|host|session|legacy|credentials, github, gitlab, jira, core state/driver, cli, opencode); `SECRET_READ_ALLOWLIST` present and frozen by the plan; `ADAPTER_SUBPATHS` in `scripts/checks/workspace-entrypoints.ts` shared by the cli/mcp/opencode/testkit rows (exact-match) and duplicated in `tests/boundaries/harness.ts` + `tests/structure/subpaths.test.ts`; `classify.ts` line 51 (`matches.length !== 1` throws) makes the provider kind exact-code-required by table content, and existing kind-only assertions at `tests/behaviour/error-classification.test.ts:29..153` are exactly what plan task 1.3 updates; `PRODUCTION_DEFAULTS`/`exports-parity` (defaults-positions.json + config.schema.json)/`MapField` as described; state `replaceDocument` bare-file-name convention with `phase-state.<REF>.json` PIN-3 constants; `edge.ts`/commands record/`surface-serializer-entry-only`; GH-188 plural `providers/` dirs and `adapters/src/io/provider-transport.ts` distinct from the new seam; `inventory.json`/`EXECUTABLE_ALLOWANCES`; boundaries `fixtures/cases.ts` + `fixture-registry.json`; `config.credential.missing` row exists.
- Pinned semantics identical across spec/test-plan/plan: eight skip reasons + precedence incl. the AC-F2-5 determining-entry rule; completed-sleep loop cap (N=`maxSleepLoops`, default 24, no post-cap fetch, no extra iteration); closed evidence allowlists (8 park / 11 announcement fields, ≤1024 B, ≤20 fields); `provider-parks.json` projection name with rebuild-on-read and no rebuild CLI; exact-code provider classification with `fallback.internal` containment; error rows and exit codes (Appendix C ↔ §5.4 ↔ plan 6.4).
- PD-A (fold-on-read, zero-write rebuild, physical document written only by mutating `resolve`) is the only reading that satisfies AC-F5-5/AC-F8-3/NFR-6/TC-PROV-050 simultaneously; recorded as a plan decision with correct ownership, no contradiction.
- ADR-0007 (Proposed, R2): explicitly "blocks nothing except the claim of authority"; owner acceptance pending at the GH-182 PR; OQ-2/OQ-3 owner-policy gate carried consistently as pre-merge (not pre-delivery) in spec §18 DoD, plan task 11.2, and ADR Implementation Plan item 3. Decision routing correct.

## Findings

1. [minor] test_traceability — chg-GH-182-test-plan.md §3.1 vs §5.1/§5.2
   Gap: six §3.1 coverage cells over-map TCs that do not declare the AC in their own §5.1 rows (AC-F4-6→TC-PROV-059; AC-F5-5→TC-PROV-043; AC-F6-3→TC-PROV-041/042/043; AC-F6-4→TC-PROV-056/057), and TC-PROV-001 declares AC-F6-1 while the §3.1 AC-F6-1 row omits it. No coverage gap: every AC retains ≥1 declaring TC and the over-mapped pairs are substantively related (e.g., TC-ZAI-052 fail-open divergence).
   Suggested remediation target phase: test_planning
   Suggested fix: align §3.1 cells with §5.1 declarations (or add the ACs to the §5.1 rows); can be done in a post-DoR editorial pass since §5.1/§5.2 are the per-TC authority.

2. [minor] cross_artifact_consistency — chg-GH-182-test-plan.md §6 vs §7.1 (TC-PROV-033) and chg-GH-182-plan.md task 5.5
   Gap: §7.1/plan reference `tests/fixtures/provider/parks/cap-and-chain.json`, which the §6 fixture inventory omits (§6 lists `park-cap.json` + `park-chain-exhausted.json` instead).
   Suggested remediation target phase: test_planning
   Suggested fix: add `cap-and-chain.json` to §6 (or rename the §7.1/plan reference to the §6 pair); delivery may proceed either way — the fixture is created in Phase 5.

3. [nit] plan_coverage — chg-GH-182-plan.md "Remaining blockers" (after DoD list)
   Gap: "Delivery can start at Phase 2 immediately" — execution order is 1→…→11; delivery starts at Phase 1.
   Suggested remediation target phase: delivery_planning
   Suggested fix: correct to "Phase 1".

4. [nit] system_spec_consistency — chg-GH-182-spec.md §8.3 DM-12 vs chg-GH-182-plan.md PD-A
   Gap: DM-12's "rebuilt from verified ledger truth using the existing state-layer derived-document pattern" does not pin the physical write timing; PD-A resolves it as in-memory fold with zero writes (the only reading consistent with AC-F5-5/AC-F8-3). Residual ambiguity only.
   Suggested remediation target phase: delivery_planning
   Suggested fix: none required pre-delivery; @doc-syncer should record PD-A's fold-on-read semantics in the state-layer feature spec at system_spec_update.

## Residual Risks to Track (non-blocking)

- Owner-policy gate (spec OQ-2/OQ-3) is pre-merge, not pre-delivery: task 11.2 must actually execute before the configuration surface merges; until then DEC-3/DEC-4 fail-closed defaults govern.
- ADR-0007 stays Proposed until owner acceptance at the GH-182 PR; R2 requires no decision-critic challenge, but the owner may request one.
- NFR-10 (≤50 ms) is environment-sensitive; plan mitigation (warmed, median+bounded max, runner recorded) is in place — treat a marginal failure as investigate-first.
- M0-S17 naming lock may rename `provider-quota` / the `provider` family (spec OQ-1); mechanical rename, behavior-independent.
- Canary scanning proves structural evidence closure and declared-canary non-observation, not universal secret detection (same residual class as delivered adapter work; M0-S15 owns durable content scanning).
- Existing provider kind-only classification assertions (error-classification.test.ts) will fail the moment the four rows land; plan task 1.3 owns the same-commit update — the synchronized pair must not split.
