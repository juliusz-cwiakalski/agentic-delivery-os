# Readiness Review Iteration 3

Verdict: READY
Work Item: GH-186
Date: 2026-10-31
Pause Required: no

Reviewer: @readiness-reviewer (local DoR mode). Inputs read in full: `chg-GH-186-spec.md` (v1.3), `chg-GH-186-test-plan.md` (v1.3), `chg-GH-186-plan.md` (v1.2), `chg-GH-186-pm-notes.yaml`, `readiness-review/readiness-iter-1.md`, `readiness-review/readiness-iter-2.md`, ticket GH-186 (body and owner scope comment), backlog M0-S17, the bound decision records and index, the command registry, the ID-prefix catalog, the harness/primitive concepts, the decision template and management guide, the forbidden-literal check and registry, the two doc-distribution guards and `install.sh` doc scopes, the pm-notes/evidence corpus, and `tests/fixtures/pm-notes/corpus-exclusions.json`. Corpus arithmetic was re-executed at HEAD `9c96cb2`. No human-input decision surfaced; no pause flag.

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

Blocking findings: 0. Non-blocking findings: 7 (5 minor, 2 nit). No finding requires reopening a blocking phase; all are wording/targeting corrections that cannot change a delivered AC outcome or a recorded baseline value when the normative sources are read together.

## Iteration-2 Closure Matrix

| Iter-2 item | Status | Evidence |
|---|---|---|
| B4 — DM-2 sample-counter semantics | CLOSED | DM-2 now defines shared spine counters (`spine_rows`/`spine_included`/`spine_excluded`, identical on every metric row, `spine_rows = spine_included + spine_excluded`) and per-metric counters (`metric_included`/`metric_excluded`/`excluded_unobserved`, `spine_included = metric_included + metric_excluded`, `metric_excluded = len(metric_excluded_changes)`), plus the closed metric-reason set `missing_metric_input`/`no_ci_observation`; the retired global `changes_parsed`/`changes_included`/`changes_excluded` counters appear only as explicit prohibitions. Spec F‑4 pins ceremony/false-signal `metric_included = spine_included`, cycle = spine-included rows with a usable `clarify_scope.started`, CI = observed denominator. TC‑MEAS‑005 step 4 is metric-aware (no metric forced to `len(included)`); TC‑MEAS‑007/008 assert `sample.metric_included`. Plan PD‑4, computation steps 3–6, Phase 6.3–6.6 and Phase 7.3/7.5 carry the same model. Re-executed on the real corpus: spine_rows 41, spine_included 23, spine_excluded 18, cycle `metric_included` 20 with GH‑177/GH‑185/GH‑188 `missing_metric_input` — one internally consistent log satisfies TC‑MEAS‑005/007/008. |
| B5 — ceremony rounding method | CLOSED | Spec F‑4 defines `Σ ceremony_duration_h / Σ total_phase_duration_h` over recorded change rows; plan PD‑5 pins numerator/denominator as sums of the recorded 1‑decimal fields and forbids unrounded pair sums; TC‑MEAS‑006 step 2 now asserts per-row `q(cer)`/`q(tot)` against the recorded fields and accumulates `num`/`den` from those recorded values, with step 3 keeping the recorded `numerator`/`denominator` ratio as the second assertion. Re-executed: recorded-row sums give 0.406648 (unrounded pair sums give 0.406438, per-pair-rounded sums 0.408175), so the three artifacts now agree on exactly one method. |
| Should-fix — spec §18 phase pointer | CLOSED | §18 Registration staging now reads "the baseline-log phase (plan Phase 7)" and "the same doc-sync commit (plan Phase 10)"; the delivery order in §18 matches plan Phases 11–12 (review/remediation) and 13 (gates/DoD/PR). Plan Phase 10 = lifecycle 7, Phase 11 = lifecycle 8, Phase 13 = lifecycle 9–11. |
| Should-fix (iter‑1 note 6) — branch name | CLOSED | Both test-plan preconditions (TC‑DEC‑001 line 228, TC‑GATE‑001 line 1962) now name `feat/GH-186/decision-records-and-measurement-baseline`, which is the checked-out branch; no stale occurrence remains in spec/test-plan/plan. |

## Grounding Verification

- **Ticket coverage — PASS.** The ticket's goal, tasks and AC (layout, config precedence, provider+harness adapter contract, state schema, release model, ID prefix scheme with the project customization model, command naming locked via man-page v1 in a decision record, bash-era baseline of ceremony share/cycle time/CI failure rate/false-signal incidents with sources) and the owner scope comment (committed repository-local log; bind already-decided topics; four new records; prospective names lock; `Proposed` only; committed-evidence-only baseline) all resolve to spec requirements. Backlog M0‑S17 lines 335–351 match verbatim.
- **Four Proposed records — PASS.** Exactly ADR‑0008, ADR‑0009, ODR‑0002, ODR‑0003; next-free IDs verified against the tree (highest ADR = ADR‑0007, highest ODR = ODR‑0001); all `Proposed` with `decision_date: null` and owner acceptance at PR review; DM‑4 front matter matches the ADR‑0007 precedent; PD‑6's R2 section set equals the template's tiered model ("full canonical record EXCEPT Rollback/Reversal, Communication Plan, Structured Retrospective"). Type classification (ADR for the port boundary and release unit, ODR for the identifier and naming conventions) is argued in F‑2 with alternatives.
- **Binding register — PASS.** Eight topics; the five existing bindings are the exact pinned ADR‑0003 DEC‑1/2/7, DEC‑4 + TDR‑0003, DEC‑6 + ADR‑0005 + ADR‑0007, DEC‑5 + TDR‑0004, DEC‑3 anchors (all verified present in the record files); three new-only bindings (harness → ADR‑0008, ID scheme → ODR‑0002 + catalog, naming → ODR‑0003 + registry); release model combines the existing direction with ADR‑0009. Register is a projection (no `## Decision`), linked from index and README.
- **Command-name lock — PASS.** ODR‑0003 records the prospective v1 freeze; the registry promotion is annotation-only (title, man-page heading, banner, introduction sentence, `provider` audit bullet); AC‑F3‑1/AC‑F3‑2 and TC‑DEC‑015 require byte-identical tables and zero renames; `provider` (registry line 131), `provider-quota` (ADR‑0007 DC‑1 "working name … subject to the M0‑S17 naming lock"; `packages/adapters/src/provider-quota/`), and `DeliveryRequest` (adapter-ports spec, contracts) are confirmed as current truth. ADR‑0009's lockstep/fixed-group/one-tag/`SHA256SUMS`/SBOM/notices contract is a lock of ADR‑0003 DEC‑3, not a re-decision.
- **Measurement no-invention and reproducibility — PASS.** Normative parse → normalize → classify (DEC‑14), closed change-row vocabulary plus the closed metric-reason set, UNAVAILABLE/PARTIAL rules and the source-traceability rule are coherent, and a single log is constructible: at HEAD `9c96cb2` the corpus is 41 pm-notes files, 40 parseable, 23 spine-included after excluding GH‑186, 18 spine-excluded (GH‑171 `unparseable_yaml`; GH‑57/67/69/71/72/174 `placeholder_zero_time`; the date-only set `date_only_or_missing_time`), cycle sample 20 with GH‑177/185/188 `missing_metric_input`, and committed CI observations exist for spine-included changes (e.g. GH‑170 red, GH‑172 red→green, GH‑173 red→green, GH‑184 47/47 green), so the CI denominator is non-zero and TC‑MEAS‑008's `den > 0` is satisfiable. The spec-time census in Appendix A reproduces exactly and is correctly labelled a spec-time observation to be re-derived at `source_commit`.
- **Hard constraints C‑1/C‑10 — PASS.** AC‑C1‑1/TC‑GATE‑001/TC‑GATE‑005 bound the diff to `doc/**` plus exactly one data-only `registered` addition; registry key-diff assertions keep `corpusBaseline`, `scopeClasses`, `seedLiterals` and `allowlist` byte-identical. The three verified guard facts hold: `userFacingDocs.excludedPrefixes = ["doc/changes/","doc/decisions/"]`, a `registered` path missing from the tree fails, and the header allowlist is exactly `Copyright`/`source:`/`Apache-2.0`/`ados_distribution:`. Same-commit staging is normative and testable (add-commit SHA + absence from that commit's parent). Doc-distribution scopes were checked directly: `enumerate_dm2` covers `doc/guides/*.md`, `doc/templates/**` and the five `STANDALONE_DOCS` only, so the new register, the new feature spec and the planning YAML correctly need no enforced marker; the pinned `internal` on the new feature spec is valid.
- **Plan executability and lifecycle order — PASS.** 13 phases in dependency order with delivery 1–9 → doc-sync 10 (lifecycle 7) → review 11 (lifecycle 8) → conditional remediation 12 → gates/DoD/PR 13 (lifecycle 9–11); task IDs are sequential and complete 1.1–13.5; every writing phase has one commit and an explicit file list; read-only phases record evidence only; PD‑9/Phase 13.3 permit only the PM-owned pm-notes and `.ai/local/**` to be dirty; all named gate commands and test files exist in the tree.
- **Counts — PASS.** 21 ACs in spec §17, all 21 traced in test-plan §3.1 and in the plan's coverage ledger; 37 TC headings with 37 scenario-index rows and 37 detail sections, all mapped to phases; 13 phases; 77 tasks. (The `76 tasks` figure in the older pm-notes entry records plan v1.0 and is historical, superseded by the 77-task v1.1/v1.2 plan.)

## Non-blocking Findings

1. [minor] cross_artifact_consistency — `chg-GH-186-test-plan.md` §2 References, line 52.
   Gap: the note still states "where PD‑4 still names the retired global `changes_parsed`/`changes_included`/`changes_excluded` counters, spec v1.3 DM‑2 … is authoritative". Plan v1.2 PD‑4 no longer names those counters, so the caveat is stale and reads as an unresolved plan/spec conflict.
   Suggested remediation target phase: test_planning.
   Suggested fix: drop the conditional clause (or restate it as "DM‑2 is authoritative for the sample model; PD‑4 mirrors it").

2. [minor] test_traceability — `chg-GH-186-test-plan.md` TC-DEC-015 step 6, line 897.
   Gap: `rg -n 'provider-quota' doc/planning/oss-tooling/cli-command-registry.md` is unsatisfiable as written — the token lives in ADR‑0007 DC‑1, `packages/adapters/**`, and the provider-engine/adapter-ports feature specs, not in the command registry. The intended fact (subpath untouched) is proven by the adjacent `git diff --exit-code packages/adapters/package.json`.
   Suggested remediation target phase: test_planning.
   Suggested fix: point the grep at `doc/decisions/ADR-0007-provider-engine-v1-placement-fail-loud-parks-cost-policy.md` (or drop it and rely on the manifest diff).

3. [minor] test_traceability — `chg-GH-186-test-plan.md` TC-GATE-005 step 2, lines 2142–2165 (run at plan Phase 7 and Phase 9).
   Gap: the assertion `added == expected` requires both new docs in `registered`, but the feature spec does not exist until Phase 10; the plan labels Phase 7/10 as the "delivery half"/complete halves and Phase 9.7 scopes the AC‑C10‑1 feature-spec half to doc-sync, so correct behavior is unambiguous — but the step has no phase guard and reads as a guaranteed red at Phases 7 and 9, whose naive "fix" (pre-registing the feature spec) is forbidden by PD‑1 and rejected by the check.
   Suggested remediation target phase: test_planning.
   Suggested fix: split step 2 into a per-phase added-set expectation (YAML-only before doc-sync, both after) as step 3 already does for the two commits.

4. [minor] cross_artifact_consistency — `chg-GH-186-test-plan.md` TC-MEAS-010 step 3, line 1639 vs TC-MEAS-009 step 2 and spec F‑4.
   Gap: "`denominator == 0` (or null) must force `UNAVAILABLE`" is stated globally, but `MET-FALSE-SIGNAL-INCIDENTS` is a count metric whose `denominator` is naturally absent while `value` is the incident count that TC‑MEAS‑009 asserts equals `len(rows)`; a literal application flags that row.
   Suggested remediation target phase: test_planning.
   Suggested fix: scope the rule to ratio metrics ("a ratio metric with a zero/absent denominator …"), leaving count metrics to the empty-sample rule.

5. [minor] plan_coverage — `chg-GH-186-plan.md` PD‑3 (line 54) vs PD‑5 (line 66), spec F‑4 (line 179) and TC‑MEAS-006.
   Gap: PD‑3's "Durations are `completed − started` in hours, rounded to 1 decimal" can be read as per-pair rounding; F‑4 defines each change duration as `Σ(completed − started)` (sum, then record at 1 dp) and TC‑MEAS-006 asserts `q(sum of unrounded pairs) == recorded`. The two readings differ on 43 of 46 per-change duration values (up to 0.2 h) and change the ceremony ratio (0.406648 vs 0.408175), so a PD‑3-literal coder would fail the recompute pass and have to rewrite the spine.
   Suggested remediation target phase: delivery_planning.
   Suggested fix: one clause in PD‑3 — "per-pair hours are summed unrounded; the per-change `ceremony_duration_h`/`total_phase_duration_h` is rounded once to 1 decimal (PD‑5)".
   Non-blocking rationale: the spec formula and the recompute oracle are explicit and the failure is loud, so no wrong baseline can be recorded silently.

6. [nit] test_traceability — `chg-GH-186-test-plan.md` TC-DEC-014 step 4, lines 833–836.
   Gap: the absence check for "via a decision record or the man-page v1 acceptance" is vacuous: the sentence is line-wrapped in the registry (`… via a decision record or the` / `man-page v1 acceptance.`), so a single-line `rg` never matches even before the edit. TC-DEC-014 steps 1–3 and 6 still prove the promotion, and PD‑8 names the hunk.
   Suggested remediation target phase: test_planning.
   Suggested fix: use `rg -U` (multi-line) or match the two lines separately.

7. [nit] spec_completeness — `chg-GH-186-spec.md` DM‑2 `ci_outcome` field.
   Gap: DM‑2 lists `ci_outcome` without pinning its domain or classification rule; the domain (`green`/`red`/`mixed`/null) is inferable from F‑4's rule text and is pinned operationally in plan computation step 6 ("red = failure with no later green; mixed = failure and later green; green = only green; null = not observed").
   Suggested remediation target phase: specification.
   Suggested fix: add the closed `ci_outcome` domain and the red/mixed/green rule to DM‑2 during any future spec touch (not required before delivery).

Related micro-note (no action required before delivery): ODR‑0002 declares the measurement baseline log as the `MET-` allocator while the catalog's base-registry row describes a "metrics registry as allocator with an inputs column". ODR‑0002 is `Proposed` and the divergence is a project-catalog declaration the owner can adjust at PR review; no artifact in this change depends on the phrase.

## Decision Routing

No `needs_human_input` decisions surfaced. All seven findings are authoring-precision corrections inside the existing decision set (DEC‑14, PD‑1/PD‑3/PD‑5, OQ‑T2/T3/T4); none requires a new decision record. Owner acceptance of ADR‑0008/ADR‑0009/ODR‑0002/ODR‑0003 remains the PR-review gate and is not a DoR question.

## Gate Result

READY. All ten DoR facets pass; no pause flag; no blocking finding. Delivery may start.

The seven findings above are explicitly non-blocking and may be folded into the next natural touch of the test plan or plan (or into the delivery evidence) without reopening a phase. Iteration 3 of a maximum of 3 is complete, so no further gate run is required before delivery; if the PM chooses to apply findings 1–7 first, they affect no AC, count, phase order, or baseline value.

Non-blocking conditions carried into delivery: (a) capture `source_commit` at the start of plan Phase 6 (after the Phase‑5 commit) and re-derive the census there rather than copying Appendix A; (b) register each new user-facing doc only in the commit that creates it (YAML in Phase 7, feature spec in Phase 10); (c) the ceremony `numerator`/`denominator` are sums of the recorded 1‑decimal rows; (d) never stage the PM-owned pm-notes; (e) stop and escalate on a negative duration or a cited path missing at `source_commit` rather than clamping or substituting.
