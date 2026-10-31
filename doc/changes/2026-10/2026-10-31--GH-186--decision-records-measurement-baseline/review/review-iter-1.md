# Review Iteration 1

Verdict: FAIL
Work Item: GH-186 (M0-S17)
Date: 2026-10-31
Reviewer: @reviewer (local mode, first iteration)
Reviewed range: `c62cdb8` (merge-base with `origin/main-tools`, merged at `46610b6`)..`c6fa771` on `feat/GH-186/decision-records-and-measurement-baseline` (26 files)
Inputs: spec v1.3, test plan v1.3 (37 TCs), plan v1.2, pm-notes, `readiness-review/readiness-iter-3.md`, `doc-sync-report.md`, the four new decision records, the register, the index, the command registry, the baseline log, and the current-truth sync diffs.

Gate result: **FAIL** — 0 blocker, 1 major, 1 minor, 4 info. The delivery is otherwise complete and disciplined: all hard constraints hold, all documented gates are green, and every numeric metric reproduces exactly. The single blocking defect is a broken source-anchor field path in the baseline log (three occurrences, same typo); the minor is a bounded scope deviation from an explicit non-goal.

> **Pre-existing test failure is not attributable to GH-186.** `pnpm check` fails on `tests/checks/privacy-release.test.ts` TC-RELEASE-001 (and one related case). The test hardcodes the GH-184 changeset as the only added changeset relative to `origin/main-tools`; after GH-184 merged, the added set is empty on every descendant branch. I reproduced the identical failure on a clean detached worktree at `origin/main-tools` (`c62cdb8`), so it is a pre-existing defect tracked as GH-206, not caused by this docs-only change. It must not be fixed here (no test change permitted by C-1/C-9).

## Facet Summary

| Dimension | Result |
|---|---|
| Spec compliance — F-1/F-2/F-5 (register, 4 records, index) | PASS (8/8 topics, exact bindings, anchors resolve, 4 `Proposed` records, 0 `Accepted`, 2/2 index repairs) |
| Spec compliance — F-3 (command-name lock) | PASS (annotation-only promotion; table rows and command tokens byte-identical; 0 renames) |
| Spec compliance — F-4 (measurement baseline) | **FAIL** — all four metrics reproduce exactly, but the GH-170 source anchor path does not resolve (F-1); see below |
| Spec compliance — F-6 (doc sync) | PASS with a minor scope deviation (F-2) |
| Hard constraints C-1/C-2/C-3/C-4/C-7/C-9/C-10 | PASS (0 `packages/**`/`tools/**`; 1 data-only `scripts/**` edit; 0 existing decision bodies edited; no renames; log committed; same-commit registration) |
| Plan compliance — Phases 1–13 | PASS with bookkeeping nits (F-4) |
| Plan compliance — NG-7 (no unrelated pre-existing doc repair) | **FAIL** (F-2) |
| Docs quality — measurement integrity/reproducibility | PASS (numbers exact; anchors imprecise only for GH-170 path and compound descriptors) |
| Repo rules/gates | PASS (doc-distribution, modes, inception, forbidden-literals, privacy-literals, commitlint-authority, branch-range commitlint, `git diff --check` all green) |

## Verification Evidence (independently re-run at this gate)

1. **Diff scope.** `git diff --name-status c62cdb8...HEAD` → 26 paths: all under `doc/**` except one data-only `scripts/checks/forbidden-literals.registry.json` edit (two `registered` entries only). 0 paths under `packages/**` or `tools/**`; 0 existing decision bodies modified; 0 renames/deletions.
2. **Corpus / spine.** At `source_commit=75b4e76` the committed pm-notes corpus is exactly 41 files; the log's `changes:` spine is exactly those 41 (no missing, no extra, no duplicates); every cited `pm_notes`/`ci_observations[].artifact`/`false_signal_incidents[].artifact` path exists at `source_commit`. Spine `41 = 23 included + 18 excluded`; exclusions are `date_only_or_missing_time` 10, `placeholder_zero_time` 6, `unparseable_yaml` 1 (GH-171), `capture_change` 1 (GH-186).
3. **Metric recomputation (test-plan reference procedures, verbatim).** TC-MEAS-006 (ceremony) → 204.3/502.4 = `0.406648` recorded; TC-MEAS-007 (cycle) → n=20, median 5.3, min 0.2, max 88.9, p90 nearest-rank 18.4 (GH-142 censored; GH-177/185/188 `missing_metric_input`); TC-MEAS-008 (CI) → 3/4 = `0.75`, 19 `no_ci_observation`; TC-MEAS-009 (false-signal) → 4 rows, all `local-green-ci-red`, zero-valued classes present. Every per-row duration, pair counter, and sample counter conserves; all four metric rows share `spine_* = 41/23/18` and conserve `spine_included = metric_included + metric_excluded` and `metric_excluded = len(metric_excluded_changes)`.
4. **Window/source metadata.** `window.start=2026-02-01T00:00:00Z`, `window.end=2026-10-31T23:59:59Z`; `source_commit` is 40-hex and reachable; `captured_at=2026-10-31T14:50:00Z` is after the source commit (`14:46:33Z`) — sane. The earlier `18:55Z` mislabel was corrected in `36e878f`.
5. **Decision records.** Exactly `ADR-0008`, `ADR-0009`, `ODR-0002`, `ODR-0003`; each `status: Proposed`, `decision_date: null`, `links.related_changes: ["GH-186"]`, owner-acceptance-pending, R2 section set (template order minus Rollback/Communication Plan/Structured Retrospective), no `Accepted`. Register has 8 topics, correct 5 existing bindings, status mirror, no `## Decision` and no rationale prose.
6. **Index.** Four correct ordered linked rows; TDR-0005 ID/link fixed and moved before TDR-0006; PDR-0002 title matches its H1; no other pre-existing row changed; index and README link the register.
7. **Command registry.** Diff is exactly the five annotation hunks (`v1` H1, `v1 (locked)` heading, ODR-0003/2026-10-31 banner, intro sentence, `provider` audit bullet). Table-line and command-token diffs empty; `provider`, `provider-quota`, `DeliveryRequest` confirmed; 0 renames.
8. **Current-truth sync.** `feature-measurement-baseline.md` carries `ados_distribution: internal` inside its frontmatter, states the contract (path, schema, `MET-` IDs, status semantics, traceability rule, window, comparison protocol) and restates no metric values; `feature-decision-records.md` names the register and ODR-0002 ID scheme; glossary, `doc/00-index.md`, planning README, id-prefix catalog, primitive term, and adapter-ports pointer updated. Both new user-facing docs are registered in the same commit that creates them (`6318dbd` for the YAML, `e6de79a` for the feature spec).
9. **Gates (re-run now):**
   - `bash scripts/.tests/test-doc-distribution.sh` → exit 0 (81 in-scope docs, no drift)
   - `bash scripts/.tests/test-doc-distribution-modes.sh` → exit 0 (5/5 negative modes fire)
   - `bash scripts/.tests/test-inception-doc-consistency.sh` → exit 0
   - `bun run scripts/checks/forbidden-literals.ts` → exit 0 (5/5 classes, 0 violations)
   - `bun run scripts/checks/privacy-literals.ts` → exit 0 (1221 files, 0 violations)
   - `bun run scripts/checks/commitlint-authority.ts` → exit 0
   - `pnpm exec commitlint --from c62cdb8 --to HEAD` → exit 0 (the plan's "red on 49b4c32" note is stale: that commit is now before the merge-base)
   - `git diff --check c62cdb8...HEAD` → exit 0
10. **GH-206 confirmation.** `bun test tests/checks/privacy-release.test.ts` on this branch → TC-RELEASE-001 fails (`added=[]` vs `[gh-184-privacy-guards-minor.md]`). The same test on a clean detached worktree at `c62cdb8` fails identically. Pre-existing, not GH-186.

## Findings

### F-1 [major] — Baseline source locator and two GH-170 row anchors point at a non-existent field path

- **Location:** `doc/planning/oss-tooling/measurement-baseline.yaml:23` (`sources[gh170-ci].locator`), `:472` (GH-170 `ci_observations[0].anchor`), `:478` (GH-170 `false_signal_incidents[0].anchor`).
- **What:** All three cite `phases.quality_gates.iterations`. The GH-170 pm-notes at `source_commit` has no such field; its phase map contains `quality_gates` (`{started, completed}`) and a separate `quality_gate_iterations` list. The intended locator is `phases.quality_gate_iterations`.
- **Why it matters:** The iteration evidence genuinely exists (iteration 1 `PASS_LOCAL`, iteration 2 `FAIL_CI`, iteration 3 `PASS_CI`) and the recorded `ci_outcome: mixed` / incident numbers are correct and recomputable from the artifact. But AC-F4-2 requires each observation/incident row to cite an anchor that resolves, NFR-1 requires concrete locators, and test-plan TC-MEAS-003 step 3 would fail anchor resolution here. Plan Phases 7.6/9.5 and the Execution Log assert "every anchor resolves", which is therefore inaccurate.
- **Fix:** Change `phases.quality_gates.iterations` to `phases.quality_gate_iterations` in the `sources` locator and both GH-170 anchors. No number changes.

### F-2 [minor] — Out-of-scope repair of pre-existing duplicate front matter in the glossary and adapter-ports spec

- **Location:** `doc/overview/glossary.md:9-18`, `doc/spec/features/feature-adapter-ports.md:8-18`; rationale at `doc-sync-report.md:43-44,54,57`.
- **What:** Both files carried duplicated `summary`/`links` (and the glossary also duplicated `related_decisions`/`related_changes`) from earlier merges. This change consolidates them to a single frontmatter block and updates the links. Spec §7.2 [OUT]/NG-7 explicitly excludes "the glossary's duplicate front-matter keys" beyond the two named index defects; F-6 only required adding the new terms and the ADR-0008/M1-S11 pointer.
- **Why it matters:** It is a real, documented spec deviation, even though it is benign (no decision content, no numbers, and the repair actually exposes the GH-186 links the dedup had suppressed). The doc-sync report is transparent about it but the spec was not amended.
- **Fix (choose one):** (a) revert the frontmatter dedup in both files and keep only the in-scope body edits; or (b) amend the spec (v1.4) to explicitly authorize the bounded dedup in `glossary.md` and `feature-adapter-ports.md`, noting that the other three duplicated-frontmatter docs remain out of scope. Owner/PM decision.

### F-3 [info] — GH-172 compound anchor descriptors do not match the artifact text verbatim

- **Location:** `doc/planning/oss-tooling/measurement-baseline.yaml:512,518,524,543,549`.
- **What:** The load-bearing field path `notes` resolves, but the descriptors use wording that is not a verbatim substring of the note text (`REOPENED iteration 2` vs `REOPENED (iteration 2)`; `CLOSED iteration 2` vs `iteration 2 CLOSED`; `third local-green` vs `THIRD local-green`; `root causes of the CI-red` vs `Root causes of the CI-red`). Under TC-MEAS-003's literal fixed-string fallback these compound anchors would be flagged even though the field path is correct.
- **Fix (optional):** Normalize the descriptors to exact note substrings, or document the "field path + human hint" anchor convention so the fixed-string fallback is not applied to compound anchors.

### F-4 [info] — Plan bookkeeping inconsistencies

- **Location:** `chg-GH-186-plan.md:715-723` (Definition of Done all unchecked), `:750-753` (revision log lists 1.3 before 1.2), `:619,771` (commitlint-range deviation note).
- **What:** Phase 13 and the Execution Log mark the DoD check complete while the DoD checklist remains unchecked; the revision log is out of version order; and the recorded "commitlint range red on 49b4c32" deviation is now stale (the range passes against the current merge-base). None affects delivered content.
- **Fix:** At the next plan touch, tick the DoD boxes (or explicitly mark them PM-owned for dod_check), reorder the revision log, and replace the stale commitlint note with the current green result.

### F-5 [info] — GH-174 `ci_observations[].checks_affected` lists skipped checks as affected

- **Location:** `doc/planning/oss-tooling/measurement-baseline.yaml:570`.
- **What:** The row says `checks_affected: state-scope tests, publint/attw`, but the GH-174 pm-notes `ci_remediation` records `publint/attw` as **SKIPPED, not failed** (one root cause: state-scope). GH-174 is spine-excluded (`placeholder_zero_time`) and outside the CI sample, so there is no metric impact.
- **Fix (optional):** Reword to `state-scope tests (publint/attw skipped, not failed)` for accuracy.

### F-6 [info] — GH-171 `unparseable_yaml` pair counters sum to 0, not 11

- **Location:** `doc/planning/oss-tooling/measurement-baseline.yaml:482-496`; spec §185/PD-3.
- **What:** The unparseable GH-171 row records `phase_pairs_* = 0` (sum 0). That is correct for a document that cannot be parsed; plan PD-3 scopes the "counters conserve at 11" rule to included changes. A strict reader of spec §185 ("The per-change counters conserve at 11") could flag it.
- **Fix (optional):** One sentence in the feature spec (or spec §185) exempting `unparseable_yaml` rows from the 11-pair conservation rule.

## Plan compliance

- Phases 1–10 and 13 are executed and evidenced; Phases 11–12 are the PM-scheduled review/remediation window this artifact opens. All 21 ACs and 37 TCs were re-checked; the delivery-side evidence is sound.
- The plan's own verification claims **"every anchor resolves"** (Phases 7.6/9.5) are contradicted by F-1; that is the plan-compliance gap.
- The plan's Definition of Done checklist is unchecked (F-4); no delivery task is missing.
- Deviations are documented (e.g., `c3fb36f`/`177716d` EOF fix). No waiver of a gate.

## Remediation tasks (for appending to `chg-GH-186-plan.md` as Phase 12)

> Per the review brief, this artifact lists the tasks rather than modifying the plan.

1. **R-1 (F-1, must):** In `doc/planning/oss-tooling/measurement-baseline.yaml`, replace `phases.quality_gates.iterations` with `phases.quality_gate_iterations` at the `sources[gh170-ci].locator`, the GH-170 `ci_observations[0].anchor`, and the GH-170 `false_signal_incidents[0].anchor`. Re-run TC-MEAS-003 step 3 against `source_commit` and confirm 0 unresolved anchors.
2. **R-2 (F-2, must-decide):** Either revert the duplicated-frontmatter consolidation in `doc/overview/glossary.md` and `doc/spec/features/feature-adapter-ports.md` (keep only body edits), or amend `chg-GH-186-spec.md` to v1.4 authorizing the bounded dedup; record the choice in the doc-sync report.
3. **R-3 (F-3, should):** Normalize the GH-172/GH-173 compound anchor descriptors to exact note substrings, or document the anchor convention; re-run the anchor-resolution inventory.
4. **R-4 (F-4, should):** Tick the plan Definition-of-Done boxes (or mark them PM-owned), reorder the revision log, and correct the stale commitlint-range note.
5. **R-5 (F-5/F-6, optional):** Reword the GH-174 `checks_affected` and add the `unparseable_yaml` pair-counter exemption sentence.
6. **R-6 (re-gate):** After R-1..R-5, re-run the Phase-9 battery (diff scope, doc-distribution, modes, inception, forbidden-literals, privacy-literals, commitlint-authority, branch-range commitlint, `git diff --check`, YAML parse) and the TC-MEAS-003/005–011 recompute; then re-review. Do not touch `packages/**`, `tools/**`, or any test.

## Status

- **Status: FAIL** (1 major, 1 minor, 4 info).
- The change is otherwise a faithful, high-quality execution of a 21-AC/37-TC docs-only spec. F-1 is a three-site path typo with no numeric effect; F-2 is a bounded, documented scope deviation. Both are cheap to close, after which the change should re-review to PASS.
