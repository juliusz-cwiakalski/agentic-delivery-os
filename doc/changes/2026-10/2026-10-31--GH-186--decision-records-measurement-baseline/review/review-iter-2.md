# Review Iteration 2

Verdict: PASS
Work Item: GH-186 (M0-S17)
Date: 2026-10-31
Reviewer: @reviewer (local mode, re-review after remediation)
Reviewed range: `c62cdb8` (merge-base with `origin/main-tools`, merged at `46610b6`)..`756fc73` on `feat/GH-186/decision-records-and-measurement-baseline` (28 files)
Remediation commits under review: `fdec870` (R-1/R-2/R-4/R-5/R-6) and `756fc73` (doc-sync reconciliation + pm-notes record).
Inputs: spec v1.3, test plan v1.3 (37 TCs), plan v1.3 with appended Phase-12 remediation (revision log v1.4), pm-notes, `readiness-review/readiness-iter-3.md`, `doc-sync-report.md` (reconciled), `review-iter-1.md` + `code-review/review-iter-1.yaml`, the four new decision records, the register, the index, the command registry, the baseline log, and the current-truth sync diffs.

Gate result: **PASS** — 0 blocker, 0 major, 0 minor, 2 info (both non-blocking). Iteration 1's two blocking findings (F-1 major/high, F-2 minor/medium) are closed by verified evidence, not assertion. All four baseline metrics and all sample counters reproduce exactly and are unchanged from iteration 1. The full re-gate battery is green. The only remaining items are carried/observational info notes.

> **`pnpm check` was not used as a pass criterion** (per the review brief). The known TC-RELEASE-001 failure is pre-existing and tracked as GH-206: `tests/checks/privacy-release.test.ts` hardcodes `CHANGESET_NAME = "gh-184-privacy-guards-minor.md"` (line 13) and asserts `added == [.changeset/gh-184-privacy-guards-minor.md]`; after GH-184 merged, the added set is empty on every descendant branch. GH-186 touches no `tests/**` path and no `.changeset/` entry (verified via `git diff --name-only c62cdb8...HEAD`), so this failure is structurally unrelated to GH-186. Not fixed here (no test change permitted by C-1/C-9).

## Remediation reviewed

| Task | Finding | Change | Verdict |
|---|---|---|---|
| R-1 | F-1 (major) | `phases.quality_gates.iterations` → `phases.quality_gate_iterations` at `sources[gh170-ci].locator` and both GH-170 row anchors | **Closed — verified** |
| R-2 | F-2 (minor) | Restored `doc/overview/glossary.md` and `doc/spec/features/feature-adapter-ports.md` to `36e878f` (dropped out-of-scope front-matter dedup, kept delivered body) | **Closed — verified** |
| R-4 | F-4 (info) | Ticked Phase-11/DoD boxes, ordered revision log, replaced stale commitlint-range note | **Closed** (one residual info nit) |
| R-5 | F-5 (info) | GH-174 `checks_affected` → `state-scope tests (publint/attw skipped, not failed)` | **Closed — verified accurate** |
| R-6 | F-6 (info) | GH-171 `unparseable_yaml` zero/null counters documented as by-design | **Closed — verified** |
| — | F-3 (info) | GH-172/GH-173 compound anchor descriptors | Intentionally deferred (optional convention note); carried as info |

## Verification Evidence (independently re-run at this gate)

### F-1 closure — every baseline source locator and change-row anchor resolves against `75b4e76`

Resolved every `sources[]` file locator fragment and every `ci_observations[].anchor` / `false_signal_incidents[].anchor` field path against `git show 75b4e76:<path>` with a YAML-field-path resolver:

1. **Sources (5 file locators):** `gh170-ci → phases.quality_gate_iterations` (now resolves to a list — this is the fix); `gh172-ci → notes`, `gh173-ci → notes`, `gh174-ci → phases.ci_remediation`, `gh184-ci → notes` all resolve. The two `kind: git-tree` locators are exact `git ls-tree … | rg` commands whose counts are independently reproduced (41 pm-notes, 5 evidence).
2. **Change-row anchors (9 total):** GH-170 (×2), GH-172 (×2 observations + 2 incidents), GH-173 (×1 observation + 1 incident), GH-174 (×1), GH-184 (×1) — **0 unresolved**. The pre-fix path `phases.quality_gates.iterations` does not exist at `75b4e76` (`phases.quality_gates` is `{started, completed}`; the iteration list is `phases.quality_gate_iterations`, iterations 1 PASS_LOCAL / 2 FAIL_CI / 3 PASS_CI), confirming the fix was necessary and sufficient. A repository-wide search finds `quality_gates.iterations` only in historical review/plan/pm-notes text that documents the fix — never in the baseline artifact.
3. **GH-170 descriptor accuracy:** `iteration 2 FAIL_CI; iteration 3 PASS_CI` and `iteration 1 PASS_LOCAL; iteration 2 FAIL_CI` are exact against the pm-notes list; `checks_affected: ci-topology, ignore-rules, commitlint` matches the three recorded root causes.

### F-2 closure — reverted files match `36e878f` and no longer deviate from the merge-base front matter

1. `git diff 36e878f:doc/overview/glossary.md HEAD:doc/overview/glossary.md` → **empty**; same for `doc/spec/features/feature-adapter-ports.md` → **empty**.
2. `git diff c62cdb8...HEAD` for both files contains **only body hunks** — the glossary's 13 added term rows and the adapter-ports ADR-0008 / M1-S11 pointer line — with **zero front-matter hunks**. The out-of-scope front-matter consolidation is therefore fully reverted to the exact merge-base state.
3. `c6fa771` (the doc-sync commit) touched **only** the front matter of both files; `e6de79a` (earlier) delivered the glossary terms and the adapter-ports pointer. Restoring to `36e878f` therefore drops only the NG-7-excluded dedup and retains 100% of the delivered body content.
4. This is the compliant resolution the iteration-1 finding explicitly offered (option (a)). Spec NG-7 / §278 `[OUT]` exclude "the glossary's duplicate front-matter keys"; AC-F6-1 requires only that the glossary be *updated* (terms present) and the adapter-ports harness pointer be present (body pointer present) — neither requires the front-matter `related_changes` link. No spec amendment is warranted and none was made.

### Measurement integrity — four metrics and all sample counters reproduce exactly (unchanged from iteration 1)

Recomputed from the 41-row spine at `source_commit`:

- Corpus/spine: 41 pm-notes = 41 spine rows (unique refs); included 23, excluded 18 (`date_only_or_missing_time` 10, `placeholder_zero_time` 6, `unparseable_yaml` 1, `capture_change` 1).
- **Ceremony share:** 204.3 / 502.4 = **0.406648**; sample phase_pairs 240/13.
- **Cycle time:** n=20, median **5.3**, min **0.2**, max **88.9**, p90 nearest-rank(18) **18.4**; exclusions GH-177/GH-185/GH-188 `missing_metric_input`; GH-142 right-censored; sample phase_pairs 210/10.
- **CI failure proxy:** numerator 3 (GH-170/172/173) / denominator 4 (GH-170/172/173/184) = **0.75**; 19 `no_ci_observation`; sample phase_pairs 42/2.
- **False-signal incidents:** **4** (GH-170, GH-172 ×2, GH-173), all `local-green-ci-red`; zero-valued classes present.
- Conservation: every row conserves to 11 pairs except GH-171 (0, by design — R-6 documents it); every metric conserves `spine_included = metric_included + metric_excluded` and `metric_excluded = len(metric_excluded_changes)`; all four share `spine_* = 41/23/18`.

### R-4/R-5/R-6

- **R-4:** Revision log is now ordered 1.0 → 1.1 → 1.2 → 1.3 → 1.4. No AC, TC, phase count, or task count changed (`21 ACs`, `37 TCs`, `77` numbered tasks all intact). 12.3 (independent re-review) and the DoD "Open unmerged PR" box are correctly left **unchecked** — no false completion claim. The stale commitlint-range deviation is replaced with the green result, which I confirmed (`pnpm exec commitlint --from c62cdb8 --to HEAD` → exit 0).
- **R-5:** GH-174 pm-notes `ci_remediation` at `75b4e76` records "publint/attw steps were **SKIPPED** not failed" (one root cause: state-scope). The reworded `checks_affected` is accurate. GH-174 is spine-excluded (`placeholder_zero_time`), so no metric impact.
- **R-6:** A comment above the GH-171 row documents the by-design zero/null counters; it sits at column 1 between rows and does not disturb YAML parsing (41 rows load).

### Doc-sync reconciliation (`756fc73`)

`doc-sync-report.md` now accurately describes the reverted state: it lists the two surviving current-truth edits (`feature-decision-records.md`, `doc/00-index.md`), marks `glossary.md` and `feature-adapter-ports.md` as reverted to `36e878f` with delivered content retained, and refreshes the traceability and handoff sections. No artifact claims the dedup survived in current state (the pm-notes phase-7 entry is a historical event log, superseded by the later remediation note in the same file).

### Diff scope and hard constraints

`git diff --name-status c62cdb8...HEAD` → 28 paths: all under `doc/**` except one data-only `scripts/checks/forbidden-literals.registry.json` edit (exactly two `registered` additions — the baseline YAML and the new feature spec; no other key changed). 0 paths under `packages/**` or `tools/**`; 0 deletions, 0 renames; 0 existing decision record bodies modified (the four records are new `A` files); 0 new `Accepted`.

### Gate battery (re-run now — all green)

- `bash scripts/.tests/test-doc-distribution.sh` → exit 0 (81 in-scope docs, no drift) — the reverted files' duplicated front matter does not break the guard.
- `bash scripts/.tests/test-doc-distribution-modes.sh` → exit 0 (5/5 negative modes fire).
- `bash scripts/.tests/test-inception-doc-consistency.sh` → exit 0.
- `bun run scripts/checks/forbidden-literals.ts` → exit 0 (5/5 classes, 0 violations).
- `bun run scripts/checks/privacy-literals.ts` → exit 0 (1223 files, 0 violations).
- `bun run scripts/checks/commitlint-authority.ts` → exit 0.
- `pnpm exec commitlint --from c62cdb8 --to HEAD` → exit 0.
- `git diff --check c62cdb8...HEAD` → exit 0.
- Baseline YAML parse → 4 metrics, 41 rows, DM-2 keys present.

### Records / register / index / command lock (unchanged by remediation; re-confirmed)

- 4 records (`ADR-0008`, `ADR-0009`, `ODR-0002`, `ODR-0003`) all `status: Proposed`, `decision_date: null`; 0 new `Accepted`.
- Register: 8 topic rows with correct status mirror and pending-acceptance note.
- Index: 4 new rows + PDR-0002 title repair + TDR-0005 ID/link repair moved before TDR-0006.
- Command registry: annotation-only promotion (title/heading/banner/intro/`provider` audit bullet); no table-row changes visible in the diff; 0 renames.

## Findings

### I-1 [info] (carried from iteration 1 F-3) — GH-172/GH-173 compound anchor descriptors are not verbatim note substrings

- **Location:** `doc/planning/oss-tooling/measurement-baseline.yaml:515,521,527,546,552`.
- **What:** The load-bearing field path `notes` resolves, but descriptors diverge from the note text (`REOPENED iteration 2` vs `REOPENED (iteration 2)`; `CLOSED iteration 2` vs `iteration 2 CLOSED`; `third local-green` vs `THIRD local-green`; `root causes of the CI-red` vs `Root causes of the CI-red`). Under TC-MEAS-003's literal fixed-string fallback these compound anchors would be flagged even though the field path is correct.
- **Status:** Intentionally deferred (plan Phase 11.3) as an optional anchor-convention note. Info only, no numeric impact. Non-blocking.

### I-2 [info] (new, bookkeeping) — Plan Phase 13.4 text still says Phases 11–12 were "not executed"

- **Location:** `chg-GH-186-plan.md:625`.
- **What:** Phase 13.4's "Done" sentence retains "Phases 11–12 are PM-scheduled and not executed in this coder run" while the Phase 11.x and 12.x boxes are now ticked complete with evidence. This is a stale **under-claim** (it says not-executed when they are now done), not a false completion claim.
- **Fix (optional, next plan touch):** Reword 13.4 to note Phases 11–12 were subsequently executed (review iteration 1 + remediation `fdec870`). No delivered content affected.

## Plan compliance

- Phases 1–13 executed and evidenced; Phase 12 remediation appended and closed (R-1/R-2/R-4/R-5/R-6); Phase 12.3 (independent re-review) is this artifact; Phase 13.5 (open unmerged PR) remains PM-owned and honestly unchecked.
- All 21 ACs and 37 TCs re-verified; the baseline numbers reproduce exactly; the F-1/F-2 plan-compliance gaps are closed.
- No AC/TC/count altered by the remediation; no new completion claim is false. The only residual plan nit is I-2 (info).

## Status

- **Status: PASS** (0 blocker, 0 major, 0 minor, 2 info).
- F-1 and F-2 are genuinely closed by verified evidence (anchor resolution over every source locator and change-row anchor; byte-identical revert to `36e878f` with retained body). Metrics are unchanged and exact. All gates are green. The two remaining info findings are non-blocking.
- Remaining info-only follow-ups (optional, do not block): I-1 compound-anchor descriptor convention; I-2 stale Phase-13.4 sentence. Neither requires a source, artifact, or test change to proceed.
