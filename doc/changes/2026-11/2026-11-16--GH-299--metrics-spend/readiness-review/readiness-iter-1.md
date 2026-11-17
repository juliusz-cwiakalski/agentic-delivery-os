# Readiness Review Iteration 1

Verdict: READY
Work Item: GH-299
Date: 2026-11-17
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

## Verification performed (independent, against the live tree and planning truth)

- **Scope fidelity.** Every ticket task item is owned by a declared capability: ceremony share (F-3/AC-F3-2, native via the delivered runner fold), per-dispatch tokens/cost/restarts (F-5/AC-F5-1, composed from the delivered `delivery.spend.v1` fold), cycle time (F-3/AC-F3-1, native over `phase.transition`), CI failure rate (F-3/AC-F3-3, proxy recomputation over the committed corpus), escaped defects (F-7/AC-F7-1..2, curated floor), burn-rate alarms (F-6/AC-F6-1..5). The ticket AC ("exit criteria measurable with committed numbers") decomposes in Appendix B onto F-1..F-7 with executable rows in test-plan §3.4. Declared exclusions verified as grounded: quota snapshots appear in the canonical backlog M2-S6 task list **nowhere** (backlog.md:1168-1171) and only in registry/M1 summary rows (cli-command-registry.md:178; backlog.md:912) — DEC-1's classification is accurate; MET- allocation deferred (DEC-2, ODR-0002 allocator respected); `MET-FALSE-SIGNAL-INCIDENTS` surfacing deferred (§7.2, TC-METRICS-016 proves both directions); board/brief/alarm surfacing deferred (§7.3).
- **Scenario seeds inherited literally.** test-scenarios.md:86-101 read verbatim: SC-M2-S6-01's `breakdowns.agentRole`/`.model` and `totals.tokens` map to the delivered `breakdowns.role`/`.model` arrays and five-class total (feature-spend.md:124 confirms the delivered dimension names `role`/`model` and the sums-equal-totals rule); SC-M2-S6-02's `metrics.data.alarms` exactly-one/threshold-echoed maps to AC-F6-1/AC-F6-5 with TC-050/055. Neither seed body is silently reinterpreted.
- **Count-pin feasibility re-verified against the delivered tree** (the change's central registration discipline):
  - `toHaveLength(146)` ×**7** in tests/structure/error-table.test.ts (839, 915, 1149, 1782, 2314, 2433, 2519) — matches D-4 "7 sites" exactly.
  - Delivered-row `toHaveLength(145)` ×**3** (1875, 2435, 2520) vs D-5's declared "2 sites" — see Finding 1 (minor, non-blocking).
  - Allowlist `toHaveLength(62)` ×**5** (1423, 2334, 2413, 2533, +1) and exactly **2** test names pinning "62 members" (2412, 2532) — matches D-6.
  - Four-surfaces agreement test name at 2431 reads verbatim "146 entries / 145 delivered / 62 allowlist / 2 board / 3 steer / 3 retro / 146 documented" — matches D-7's pre-change string and its declared post-change form ("… / 1 metrics / …", 147/146/63/147).
  - Carrier pins present: `146 machine identities`, `the same 146 identities`, `146 identities`, and the allowlist paragraph "exact two-segment allowlist of 62 declared identities" whose kind breakdown sums to exactly 62 (provider 1 + watchdog 4 + blockers 4 + dispatch 3 + commit 3 + closeout 1 + merge 7 + retro 3 + spend 1 + queue 6 + daemon 8 + coordinator 2 + projects 6 + repos 3 + events 3 + verify 1 + board 2 + ceremony 1 + steer 3) — adding `metrics 1` yields 63.
  - `BASELINE_ROWS.length + 112` at the four textual sites in tests/checks/error-table-sync.test.ts (1081, 1082×2, 1162, 1185) — matches D-12; dispatch-attempts-taxonomy header/name/length at 146 (D-10); verify-gates-suite-map-contract `sourceEntries`/`documentedRows` at 146 ×2 (D-11); `RESERVED_TWO_SEGMENT_CODES` declared in scripts/checks/error-table-sync.ts:147 with the structural mirror in the suite.
  - Family count: `PROMPT_REQUIRED_COMMANDS` registers exactly **23** entries with `steer` last (prompt-required-commands.ts) and no `metrics`; `BASE_FAMILIES` pinned at 22 with the stale-`22` scan arm in steer-mounting.test.ts — the 23 → 24 mount and DR-1..DR-3/GAP-T5's ten-suite enumeration match the tree; `doc/planning/oss-tooling/milestones/m2/commands/` holds no `metrics.md` yet (the page is authored, not pre-existing).
- **Reopen remediation re-verified in code.** The reopened-specification amendments are true against the tree, not just internally consistent: `perAgentOf` in packages/core/src/domain/spend.ts skips records with `agentRole === null || model === null` exactly as DEC-14 scopes AC-F5-1 (exact equality only on fully attributable selections; the remainder form is TC-042); feature-ceremony-runner.md:238 carries the committed comparison's non-interchangeability statement and `sampleMinimum: 5`, so DEC-13's basis-scoped value rule (AC-F2-1 vs AC-F3-1/2) resolves a real contract conflict rather than a phantom.
- **System-spec consistency spot checks.** feature-spend.md Feeds row names alarm/burn-rate M2-S6 (line 339) and the telemetry-absent/`state.*` postures match AC-F8-1's reuse; feature-config-layer.md:269 carries the `verify.suite-map` precedent (absent-means-undeclared, `config.value.invalid` pre-read) the `metrics.burn-rate` node extends; feature-measurement-baseline.md's closed exclusion set (unparseable_yaml, date_only_or_missing_time, placeholder_zero_time, capture_change, outside_window, missing_metric_input, no_ci_observation), right-censoring rule (latest completed phase, `cycle_time_censored`), and observed-only CI denominator are quoted exactly in F-2/F-3/AC-F3-1/AC-F3-3; measurement-baseline.yaml holds `schema_version: 2` with the four `measurement_kind` values (duration_ratio_proxy, duration_proxy, session_proxy, curated_count) the artifacts cite; the plan YAML conforms to feature-plan-schema.md (delivery.plan.v1, tier full/9 phases, scope files+folders, allowed doneArtifacts slots, in-scope interaction targets).
- **Traceability arithmetic.** Spec §17 declares 22 ACs; test plan §3.1 carries 22 AC rows all Covered, §5.1/§5.2/§7 hold the same 58 ids each exactly once (6+7+7+4+3+7+4+3+4+3+7+3); plan's TC→phase map assigns 3+0+0+20+13+8+4+9+1 = 58 with each id owned by exactly one phase, and AC ownership 1+7+7+3+1+2+1 = 22 with exactly one owning phase per AC; the four PLAN-LEVEL REFINEMENTS (entry skeleton vs curation, TC-013 split into phase 6, golden landing in phases 5/8, composition-before-mount) reshuffle *when* cells complete without changing any TC's oracle, identity, exit, bound, or AC mapping — consistent with the plan's own no-oracle-reshape claim. Split-suite ownership (metrics-baseline-damage 014→013, metrics-write-discipline 012→056, metrics-bounds 063→102/103/104) is declared in both directions.

## Findings

1. [minor] cross_artifact_consistency — chg-GH-299-spec.md#Appendix D (row D-5)
   Gap: D-5 declares the delivered-row (spend-exclusion) assertion `toHaveLength(145)` at "2 sites", but the delivered tree holds three textual sites — tests/structure/error-table.test.ts:1875 and :2435 (`expect(delivered)`) plus the filter-form assertion at :2520 (`entries.filter((entry) => entry.domainKind !== "spend")`). The declared values (145 → 146) are correct; only the site count is off by one.
   Suggested remediation target phase: specification
   Suggested fix: amend D-5 to "(3 sites)" naming the filter-form assertion. Non-blocking: an unmoved third pin turns red at the phase-1 gate (the live count moves to 146), the extended no-leftover scan over the named files would also catch it, and the spec's own clause ("any site discovered beyond this list during delivery joins the same commit and this appendix is amended — never silently") already provides the correction path. The amendment may ride that path; no artifact rework is required before delivery.

2. [minor] spec_completeness — ticket authority evidence (chg-GH-299-spec.md#Appendix A)
   Gap: this reviewer had no in-session tracker (GitHub MCP) access, so issue #299's body was verified from the PM delegation summary and corroborated against two committed sources: the canonical backlog M2-S6 row (doc/planning/oss-tooling/backlog.md:1165-1174 — task list, AC, and dependencies M1-S19/M2-S3/M2-S14 match the delegation verbatim) and cli-command-registry.md:188 (`ados metrics` row, M2-S6). No contradiction was found anywhere; recorded for transparency per the missing-context rule, not as a scope doubt.
   Suggested remediation target phase: specification
   Suggested fix: none required — the corroborating committed sources are sufficient evidence at the gate. Optional: the PM may attach the issue-body excerpt as a pm-notes `notes:` entry before delivery for a first-hand record.

3. [nit] cross_artifact_consistency — chg-GH-299-spec.md#DM-3 vs packages/core/src/domain/spend.ts (`perAgentOf`)
   Gap: DM-3 parenthesizes the dispatch `perAgent[]` members as "role, model, calls, tokens — the delivered roll-up", while the delivered fold spells the grouping member `agent` (spend.ts:592-614). The artifact set is not contradictory: the test plan's OQ-TP-5 note and plan refinement 6 explicitly bind member spelling delivery-bound with value-equality parity, and the metrics payload is a new identity entitled to its own member names.
   Suggested remediation target phase: specification
   Suggested fix: optional wording alignment in DM-3 (note the delivered `agent` spelling or declare the metrics-payload member names as its own contract). No blocker either way.

4. [nit] spec_completeness — quota-snapshot residual mention (doc/planning/oss-tooling/backlog.md:912)
   Gap: the M1-era deferral summary line still reads "burn-rate, and quota snapshots stay in M2-S6". DEC-1 correctly classifies such summary rows as non-canonical against the M2-S6 task list, and phase 9 restates the exclusion in the PR description. The residual line risks confusing a future reader but contradicts nothing in the artifact set.
   Suggested remediation target phase: specification
   Suggested fix: none inside this change (already adjudicated by DEC-1); optionally note the line in the phase-9 planning-corpus reconciliation so it is not later mistaken for canonical scope.

## Gate result

All ten facets PASS; the two minor findings are self-correcting or evidence-notes with declared correction paths, and neither pauses the workflow. The known history (one specification reopen folded in as DEC-13/DEC-14 with the test plan reconciled to v1.1, and the four plan-level refinements) was re-verified against the delivered tree and does not reopen anything: the reopen was justified (both AC conflicts were real against delivered contracts), the amendments are consistent across spec/test-plan/plan, and the refinements reshuffle completion timing only. No `needs_human_input` decision is surfaced; no decision record beyond the change docs is required (the threshold-home, alarm-derivation, and comparison-view adjudications extend delivered precedents — GH-300 config node, spend fold purity, GH-296 comparison protocol — rather than set new system policy). Delivery may start; DoD-1..17 are owned and checkable.

No prior readiness record exists for this change; this is iteration 1. Re-run this gate only if an artifact is amended before delivery starts (Finding 1's D-5 amendment may be folded into the phase-1 appendix-amendment path without a re-run, since it changes no value, oracle, or coverage).
