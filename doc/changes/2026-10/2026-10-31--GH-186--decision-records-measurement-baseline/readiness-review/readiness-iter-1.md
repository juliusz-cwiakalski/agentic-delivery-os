# Readiness Review Iteration 1

Verdict: NOT_READY
Work Item: GH-186
Date: 2026-10-31
Pause Required: no

Reviewer: @readiness-reviewer (local DoR mode). Inputs read in full: `chg-GH-186-spec.md` (v1.1), `chg-GH-186-test-plan.md` (v1.1), `chg-GH-186-plan.md` (v1.0), `chg-GH-186-pm-notes.yaml`, ticket GH-186 (body + owner scope comment), the bound decision records, the ID-prefix catalog, the command registry, the forbidden-literal check and registry, the pm-notes/evidence corpus, and the current-truth corpus-boundary spec. No prior readiness records exist under this change folder; this is iteration 1.

## Facet Summary

- spec_completeness: FAIL
- ac_quality: PASS
- plan_coverage: FAIL
- test_traceability: PASS
- cross_artifact_consistency: FAIL
- decision_capture: PASS
- system_spec_consistency: FAIL
- plan_doc_update_coverage: PASS
- plan_code_area_coverage: PASS
- dod_defined: PASS

Blocking findings: 3 (Findings 1–3). Should-fix findings: 2 (Findings 4–5). Notes: 4 (Findings 6–9). No human-input decision surfaced; no pause flag.

## Scope of Review

Ticket GH-186 (`M0-S17: Decision records and measurement baseline`, GitHub issue 186, milestone M0) matches `doc/planning/oss-tooling/backlog.md` §M0-S17. The ticket's six named decision topics, the command-naming lock, and the measurement baseline are all represented in the artifact set. The owner's scope comment on the issue (repository-local committed log; bind already-decided topics; four new records; prospective names lock; `Proposed` only; committed-evidence-only baseline) is faithfully reflected in the spec and pm-notes.

## Grounding Verification (independent spot-checks)

- **Ticket coverage — PASS.** Layout, config precedence, adapter contract (split into provider and harness, matching the ticket's "providers and harnesses"), state schema, release model, ID prefix scheme, command naming, and the measurement baseline all resolve to an artifact requirement. The register's eight-topic model correctly derives from the ticket's six topics plus the provider/harness split and command naming.
- **Existing bindings — PASS.** Verified `ADR-0003` DEC-1/2/7 (layout), DEC-4 (config; + TDR-0003), DEC-6 (provider adapter; + ADR-0005 + ADR-0007 DC-1…DC-5), DEC-5 (state; + TDR-0004), DEC-3 (versioning/release bullets). ADR-0005, ADR-0007, TDR-0003, and TDR-0004 are `Proposed`; ADR-0003 is `Accepted`. Next-free IDs are ADR-0008/0009 and ODR-0002/0003.
- **New-record topics — PASS.** Harness contract is supported by `doc/planning/concepts/harness-adapters.md` and `harness-telemetry.md` (`HarnessInstance`, `HarnessSession`, `HarnessPluginSurface`, closeout extraction). Release-model content matches ADR-0003 DEC-3 (five publishable packages, changesets fixed group, one version/tag/train, signed tagged releases, `SHA256SUMS`, SBOM, notices). The ID catalog is Draft with R1–R11, base registry, and customization model; `MET-` is a catalogued opt-in space. `provider-quota` and `DeliveryRequest` exist in the repository; ADR-0007 DC-1 names the subpath as subject to the M0-S17 lock.
- **Command registry claims — PASS.** The registry is titled `ados(1) ... man page v0`; its introduction says names are locked "via a decision record or the man-page v1 acceptance"; the `provider` audit bullet says the lock confirms or renames; the four prior renames (`phase`, `lint`, `repos`, `harness`) are present.
- **Index defects — PASS.** `doc/decisions/00-index.md` labels the TDR-0005 row `TDR-0006` (link points at the TDR-0005 file) and places it after TDR-0006; the PDR-0002 index title is "Mode-Aware Spec-Coverage Resolution for Autonomous Delivery" while the record H1 is "Phase-7 Documentation Gap Closure (Always Resolve In-Change)". The planned two-row repair is correctly bounded.
- **Forbidden-literal exemption — PASS, correctly scoped.** `scripts/checks/forbidden-literals.ts` treats every `doc/**` file except `doc/changes/` and `doc/decisions/` as user-facing; a user-facing doc absent at `corpusBaseline` must be in `registered`; a registered path missing from the tree fails (`registered doc is missing from the tree`), and a registered doc present at the baseline also fails. Both new docs (`doc/planning/oss-tooling/measurement-baseline.yaml`, `doc/spec/features/feature-measurement-baseline.md`) are absent at `corpusBaseline` `32784aff…` and are currently not registered, so DEC-13's data-only addition is the correct and sufficient fix. The check code, seed set, allowlist, scope classes, and `corpusBaseline` are untouched by the plan.
- **Measurement corpus — FAIL (see Findings 1 and 5).** 41 pm-notes files and 5 evidence files exist; GH commits span 2026-02-01…2026-10-31; no negative phase durations were found. However, `chg-GH-171-pm-notes.yaml` is invalid YAML (orphaned indentation; PyYAML fails at the document level), and the repository already records it as the single known-unparseable artifact in `tests/fixtures/pm-notes/corpus-exclusions.json` and `doc/spec/features/feature-pm-notes-lint-and-phase-transitions.md` §Corpus boundary. The spec/test plan/plan never mention that manifest or a measurement equivalent.
- **YAML-native timestamp types — FAIL (see Finding 1).** PyYAML parses unquoted dates/timestamps into `datetime.date` / `datetime.datetime` (e.g., GH-142's `started` values are `datetime.datetime`; GH-46/GH-90/GH-137 are `datetime.date`). The test plan's reference `kind()`/`ts()` helpers accept only `str`, so they classify these real endpoints as null and cannot reproduce the log's pair counters, durations, or cycle times.
- **Artifact traceability — PASS.** The spec has 21 ACs; the test plan has 37 TCs (TC-DEC-001…015, TC-MEAS-001…011, TC-SYNC-001…005, TC-GATE-001…006), 37 detail sections, and 21/21 AC coverage. The plan has 13 phases, 76 tasks, a 21-AC ledger, a 37-TC-to-phase map, and a commit plan. No orphan AC/TC.
- **Scope guardrails — PASS.** The spec/plan prohibit changes under `packages/**` and `tools/**`, check-logic/seed/allowlist/scope-class changes, renames, `Accepted` status, `decision_date` values, existing decision-body edits, `.ai/local` staging, and `.changeset` additions; the only permitted non-doc edit is the DEC-13 data registration. No violation was found in the artifacts themselves.
- **`source_commit` semantics — PASS.** PD-2 pins a full 40-hex `SRC` at the start of Phase 6 (after the Phase-5 commit, before the YAML exists); every cited pm-notes/evidence path exists at that commit, and the log's own commit is intentionally not the source. TC-MEAS-004's existence/hygiene checks align; the only residual is that a `git diff --quiet "$SRC" HEAD` executed before the Phase-7 commit is vacuous, which is harmless because no cited path changes during delivery.
- **Phase ordering — FAIL (see Finding 2).** The plan schedules review (lifecycle phase 8) before doc-sync (lifecycle phase 7), contrary to spec §18 and the 11-phase lifecycle. Review is told to trace all 21 ACs, but AC-F6-1/AC-C10-1's feature-spec halves are Phase-12 deliverables and Phase 9.7 explicitly excludes them from delivery evidence.
- **Cycle-time reference procedure — FAIL (see Finding 3).** TC-MEAS-007 step 1 does not filter on `included`, so it would count GH-186 (`baseline_change`) and any other excluded row with a timestamped start, then compare against a sample that correctly excludes them.

## Findings

1. [BLOCKING] spec_completeness + system_spec_consistency + cross_artifact_consistency — `chg-GH-186-spec.md` §5.1 F-4 (inclusion/exclusion and metric definitions), §9.2 NFR-7, §24.1 Appendix A; `chg-GH-186-plan.md` PD-3/PD-4 and the measurement computation procedure (steps 2–8) / Phase 6 tasks 6.2–6.7; `chg-GH-186-test-plan.md` TC-MEAS-005 step 5, TC-MEAS-006 step 2, TC-MEAS-007 step 1.
   Gap: The baseline cannot be computed and verified against the real corpus as written, for two corpus reasons. (a) `doc/changes/2026-10/2026-10-29--GH-171--branding-seam-working-name/chg-GH-171-pm-notes.yaml` is invalid YAML (orphaned indentation; the document parse fails), and the repository already records it as the one known-unparseable artifact in `tests/fixtures/pm-notes/corpus-exclusions.json` and `feature-pm-notes-lint-and-phase-transitions.md` §Corpus boundary. The spec's exclusion vocabulary (`no_timestamps`, `date_only_only`, `missing_start`, `baseline_change`, `outside_window`, `no_ci_observation`) has no honest reason for a known-unparseable document; the plan says "stop and escalate" and also says every "unparseable change (with the PD-4 reason)" despite PD-4 having no such reason; the test-plan reference procedures load pm-notes with `yaml.safe_load` (TC-MEAS-007 step 1 loads every row, including excluded rows; TC-MEAS-005/006 skip non-included rows but then cannot honestly account for GH-171), so they either crash on GH-171 or force an invented/incorrect exclusion reason that fails TC-MEAS-005 step 3. (b) The corpus contains YAML-native `datetime.date`/`datetime.datetime` values (64 date endpoints and 21 datetime endpoints; e.g., GH-142's timestamps are `datetime.datetime`, GH-46/GH-90/GH-137 are `datetime.date`). The test plan's `kind()` and `ts()` helpers accept only `str`, so they classify real timestamped endpoints as null and real date-only endpoints as null/phase-excluded; the log's `phase_pairs_included`, `date_only_pairs_excluded`, durations, and cycle times cannot reproduce. This affects AC-F4-1/AC-F4-3/AC-F4-5, NFR-4, and NFR-7.
   Suggested remediation target phase: specification (then cascading test_planning and delivery_planning updates)
   Suggested fix: Define one measurement-corpus rule that cites the existing exclusion manifest, excludes GH-171 with a pinned reason (e.g., `unparsable_source`) and counts it in `sample`, and treats its metric status as `PARTIAL` (not silently dropped). Define type normalization: convert YAML-native `date`/`datetime` to ISO-8601 (date vs date-time) before classification, or accept both types explicitly. Update PD-3/PD-4, the Phase-6 procedure, and the TC-MEAS reference helpers to use the same normalizer.

2. [BLOCKING] plan_coverage + cross_artifact_consistency — `chg-GH-186-plan.md` dependency order (line 210), Phase 10 (lines 511–517), Phase 12 (line 565), Phase 13; vs `chg-GH-186-spec.md` §18 (line 461) and the repository's 11-phase lifecycle.
   Gap: The plan order is `… → 9 → 10 → 11 → 12 → 13`, with Phase 10 labelled "lifecycle phase 8" (review) and Phase 12 labelled "lifecycle phase 7" (doc-sync). Spec §18 orders doc-sync (7) before review/quality gates (8), and the lifecycle does the same. The plan's Phase 10.1 requires the reviewer to trace "all 21 ACs and 37 TCs", but AC-F6-1/AC-C10-1's feature-spec halves are created in Phase 12; Phase 9.7 explicitly says those halves are Phase-12 obligations. A Phase-10 PASS cannot certify the final current truth, and the Phase-12 doc-sync commit is not independently reviewed (Phase 13 only re-runs the gate battery). This is a real sequence/coverage contradiction, not a cosmetic numbering difference.
   Suggested remediation target phase: delivery_planning
   Suggested fix: Reorder Phase 12 before Phase 10 (or add a bounded final review after Phase 12), and update the dependency order, commit plan, TC-phase map, Phase 10 scope, and Phase 13 DoD so AC-F6-1/AC-C10-1 are reviewed after doc-sync. No spec/test-plan change is required for this finding.

3. [BLOCKING] test_traceability + cross_artifact_consistency — `chg-GH-186-test-plan.md` TC-MEAS-007 step 1 (code block preceding the note at line 1333) vs `chg-GH-186-spec.md` §5.1 F-4/AC-F4-5 and `chg-GH-186-plan.md` PD-4.
   Gap: TC-MEAS-007 step 1 loops over every `d["changes"]` row without `if not r["included"]: continue`, and appends each row with a timestamped `clarify_scope.started`. GH-186 is `included: false` with `excluded_reason: baseline_change` but has a timestamped `clarify_scope.started`, so a correct log would be over-counted; out-of-window rows would be included on the same path. Step 2 of the same TC already filters `if not r["included"]`, and the spec/plan exclude GH-186 and out-of-window changes from all samples. The procedure therefore cannot pass against a correct log (and would pressure the coder to include GH-186, violating AC-F4-5/F-4).
   Suggested remediation target phase: test_planning
   Suggested fix: Add the `included` filter to step 1, assert GH-186 and out-of-window rows are absent from `vals`, and align the `changes_included` note with PD-4 (included rows with a timestamped start only). Re-run TC-MEAS-006/007 against a type-aware parser per Finding 1.

4. [SHOULD] cross_artifact_consistency — `chg-GH-186-spec.md` §18 delivery order, steps (5)–(7) (line 461) vs `chg-GH-186-plan.md` PD-1/Phase 7/Phase 12 and `scripts/checks/forbidden-literals.ts` line 429.
   Gap: The spec says "(5) compute and commit the baseline log, (6) register both new user-facing docs in `scripts/checks/forbidden-literals.registry.json` and run the forbidden-literal check, (7) phase-7 doc sync." `doc/spec/features/feature-measurement-baseline.md` does not exist until step (7), so registering it at step (6) makes the check fail with `registered doc is missing from the tree`. The plan's PD-1 explicitly forbids that ("never pre-register a not-yet-existing path") and stages each doc in the commit that creates it. The plan is right; the spec's rollout text is wrong.
   Suggested remediation target phase: specification
   Suggested fix: Register the YAML in the baseline commit and the feature spec in the doc-sync commit (remove "both" from step 6, or split step 6 materially); the plan/test plan already implement same-commit staging.

5. [SHOULD] spec_completeness / system_spec_consistency — `chg-GH-186-spec.md` §24.1 Appendix A (line 515).
   Gap: The spec says "41 files at spec time; 37 carry at least one `started` phase timestamp". The count is not reproducible: 41 files exist; 40 are parseable; 30 parseable files carry at least one timestamped (`datetime`/`T`-string) started endpoint; 10 are date-only-only; 1 (GH-171) is invalid YAML. The plan says delivery re-derives the counts, so this is not itself a delivery blocker, but the spec's evidence inventory is inaccurate and omits the known-unparseable manifest.
   Suggested remediation target phase: specification
   Suggested fix: Correct the counts and cite `tests/fixtures/pm-notes/corpus-exclusions.json`; state that the count is a spec-time observation, as the plan already does.

6. [NOTE] cross_artifact_consistency — `chg-GH-186-spec.md` §18 (line 460), `chg-GH-186-test-plan.md` TC-DEC-001 precondition (line 226), and `chg-GH-186-plan.md` Context (line 36) vs the checked-out branch.
   Gap: The spec and test plan name `feat/GH-186/decision-records-measurement-baseline`; the actual/plan branch is `feat/GH-186/decision-records-and-measurement-baseline`. The plan and pm-notes correctly call this cosmetic and branch-authoritative. No functional impact, but the test-plan preconditions are not the checked-out branch.
   Suggested remediation target phase: test_planning (specification optional)
   Suggested fix: Use the actual branch name or "the GH-186 feature branch"; no scope change.

7. [NOTE] plan_coverage — `chg-GH-186-plan.md` Phase 13.3, PD-9, Phase 1.5.
   Gap: Phase 13.3 requires `git status --porcelain` to be clean, but the PM-owned `chg-GH-186-pm-notes.yaml` is modified in the working tree and PD-9 forbids the coder to stage it. Unless the PM commits or otherwise disposes of it before Phase 13, the final battery cannot be clean. The plan does not state the PM handoff for that file.
   Suggested remediation target phase: delivery_planning
   Suggested fix: State that the PM commits the pm-notes before Phase 13 (or exclude the PM-owned path from the clean-tree assertion while still proving no coder edit).

8. [NOTE] plan_doc_update_coverage — `chg-GH-186-plan.md` Phase 12.1 vs `doc/spec/features/feature-doc-distribution-marker.md`.
   Gap: Phase 12.1 creates `feature-measurement-baseline.md` "per `doc/templates/feature-spec-template.md`", whose frontmatter defaults to `ados_distribution: redistributable`; current truth says new feature specs use `internal` (the doc-distribution guard does not scan `doc/spec/**`, so this is unenforced but semantically drifting). The spec/plan do not pin the marker for the new feature spec.
   Suggested remediation target phase: delivery_planning (Phase 12.1)
   Suggested fix: Pin `ados_distribution: internal` (or omit) for the new feature spec, consistent with sibling feature specs.

9. [NOTE] test_traceability — `chg-GH-186-test-plan.md` frontmatter `implementation_plan: null` (line 13).
   Gap: `chg-GH-186-plan.md` now exists and links the test plan, but the test plan still says no implementation plan exists. This is a stale cross-artifact link (the GH-185 precedent had the same issue).
   Suggested remediation target phase: test_planning
   Suggested fix: Set `implementation_plan: ./chg-GH-186-plan.md` and remove the "not authored at test-plan time" wording.

## Decision Routing

No `needs_human_input` decisions surfaced. The owner's issue comment already records the scope-resolution decisions (committed repository-local log; bind existing topics; four new records; prospective names lock; `Proposed` only; committed-evidence-only baseline). The GH-171 handling and the timestamp-normalization rule are authoring decisions for the spec-writer, not new precedent-setting decision records. No new `doc/decisions/**` record is required beyond the four already planned.

## Gate Result

NOT_READY.

Reopen **specification** first for Findings 1, 4, and 5 (measurement-corpus normalization/exclusion, delivery-order registration sequencing, and the Appendix-A counts). Then reopen **test_planning** for Findings 1 and 3 (type-aware reference procedures and the TC-MEAS-007 included-row filter) and for Findings 6 and 9 (branch precondition and stale plan link). Reopen **delivery_planning** for Finding 2 (doc-sync/review order) and note Findings 7–8 (PM-notes disposition and feature-spec marker).

Do not reopen delivery and do not start implementation. Re-run this gate after the three artifacts are revised; no human escalation is required for these findings.
