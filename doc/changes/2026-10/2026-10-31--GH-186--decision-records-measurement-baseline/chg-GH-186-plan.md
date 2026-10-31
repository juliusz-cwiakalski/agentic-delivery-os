---
id: chg-GH-186-decision-records-measurement-baseline
status: Proposed
created: 2026-10-31T14:00:00Z
last_updated: 2026-10-31T14:00:00Z
owners: ["Juliusz Ćwiąkalski"]
service: delivery-os decision and measurement substrate
labels: ["documentation", "decision-records", "measurement", "M0"]
links:
  change_spec: ./chg-GH-186-spec.md
  test_plan: ./chg-GH-186-test-plan.md
  testing_strategy: ../../../../.ai/rules/testing-strategy.md
  feature_spec: ../../../spec/features/feature-decision-records.md
  related_changes:
    - ../2026-10-31--GH-185--interim-mitigations-docs-config/chg-GH-185-plan.md
    - ../2026-10-31--GH-184--privacy-and-no-cloud-guards/chg-GH-184-plan.md
summary: >
  Deliver the documentation-only M0-S17 substrate: four Proposed foundational
  decision records (ADR-0008 harness contract, ADR-0009 release model v1,
  ODR-0002 ID prefix scheme and project catalog, ODR-0003 command-naming v1
  lock), the eight-topic binding register, the four index rows plus the two
  named index repairs, the annotation-only v0 to v1 command-registry
  promotion, a committed schema-versioned bash-era measurement baseline whose
  four MET metrics are recomputed exactly from named committed sources, the
  planning cross-links, and the data-only forbidden-literal registration of
  the new YAML. Zero changes under packages/** and tools/**; the only
  scripts/** edit is the registered-array addition; current-truth feature
  docs are handed to phase-7 doc sync.
version_impact: none
---

# IMPLEMENTATION PLAN — GH-186: M0-S17: Decision records and measurement baseline

## Context and Goals

- **Work item**: GH-186 — M0-S17: Decision records and measurement baseline. The checked-out branch is `feat/GH-186/decision-records-and-measurement-baseline` (the spec slug is `decision-records-measurement-baseline`; the branch name and commit scope remain `GH-186`). The PR targets `main-tools`.
- **Inputs (both read in full by this authoring pass)**:
  - [chg-GH-186-spec.md](./chg-GH-186-spec.md) — **v1.1**: F-1…F-6, DM-1…DM-4, C-1…C-10, NFR-1…NFR-10, RSK-1…RSK-10, DEC-1…DEC-13, **21 ACs** (§17), fixed window and metric formulas (§5.1 F-4), artifact inventory (§24.2).
  - [chg-GH-186-test-plan.md](./chg-GH-186-test-plan.md) — **v1.1**: **37 TCs** (TC-DEC-001…015, TC-MEAS-001…011, TC-SYNC-001…005, TC-GATE-001…006), §3 AC/interface/NFR coverage, §4 gate inventory, §5.2 step-level procedures, §6 representation rules (R-1 ratio, Q-1 rounding).
- **Governing decisions already made (do not reopen)**: DEC-1 (committed repository-local YAML log), DEC-2 (bind five existing topics, author four new records), DEC-3 (record types/IDs), DEC-4 (register as projection), DEC-5 (prospective names lock; zero renames), DEC-6 (`Proposed`, never self-Accepted), DEC-7/DEC-8 (metric formulas; UNAVAILABLE honesty), DEC-9 (two-row index repair), DEC-10 (`MET-` adoption), DEC-11 (window; GH-186 excluded; date-only excluded and counted), DEC-12 (phase-7 doc-sync set), DEC-13 (one data-only registry edit).
- **Delivery type**: documentation-only plus exactly one data-only `registered` addition in `scripts/checks/forbidden-literals.registry.json`. No source code, shell, test logic, check logic, template, changeset, or version change.
- **Status**: Proposed (plan v1.0, derived from spec v1.1 and test plan v1.1; no requirement is added here).

**Goals** (mirror spec §4): every M0-S17 topic resolves to one binding; four new `Proposed` records ship with owner acceptance pending; command names are frozen prospectively with zero renames; the bash-era baseline is committed with defined formulas, a fixed window, per-number citations, and explicit UNAVAILABLE/PARTIAL states; the register and index are accurate (including the two repairs); the diff stays docs-only with the single DEC-13 registration exemption.

**Delivery model**: `@coder` executes Phases 1–9 and the conditional remediation in Phase 11 in order. Phases 10 and 12–13 map to lifecycle review, doc-sync, and finalize/PR gates and are PM-scheduled; `@coder` must not mark them complete by finishing delivery alone. Decision-record authoring may be delegated to `@decision-advisor` (per AGENTS.md); gate runs may be delegated to `@runner`; each commit is created via `@committer` (one Conventional Commit per writing phase, scope `GH-186`). Read-only phases (1, 6, 9, 10) end with recorded evidence, not a commit.

### Pinned delivery decisions (binding; changing a pin reopens this plan)

The spec and test plan leave a few execution-level mechanics open. Each pin below only fixes representation/sequencing; it preserves every spec formula, AC, and TC assertion.

- **PD-1 — Registration staging invariant (DEC-13).** The forbidden-literal check fails when a `registered` entry is missing from the tree (`registered doc is missing from the tree`). Therefore **each new user-facing doc is registered in the same commit that creates it**: `doc/planning/oss-tooling/measurement-baseline.yaml` in Phase 7, and `doc/spec/features/feature-measurement-baseline.md` in the Phase-12 doc-sync commit. Never pre-register a not-yet-existing path. The registry edit is data-only: only the `registered` array changes; `corpusBaseline`, `scopeClasses`, `seedLiterals`, `allowlist`, and all check logic stay byte-identical (RSK-10).
- **PD-2 — `source_commit` semantics.** Capture `SRC="$(git rev-parse HEAD)"` at the start of Phase 6 (after the Phase-5 commit, before the YAML exists) and record the full 40-hex value. Every cited pm-notes/evidence path must exist at `SRC`; the YAML's own commit is intentionally not `source_commit` (self-reference is neither possible nor meaningful). Reproduction: `git rev-parse <40hex>` and `git cat-file -e <40hex>:<path>`.
- **PD-3 — Phase-pair classification precedence.** For each of the 11 phases, classify the `started`/`completed` pair: **date-only endpoint → `date_only_pairs_excluded` first; else any null/missing/unparsable endpoint → `phase_pairs_excluded`; else included**. Per included change the counters conserve: `phase_pairs_included + phase_pairs_excluded + date_only_pairs_excluded = 11`. Durations are `completed − started` in hours, rounded to 1 decimal (`ROUND_HALF_UP`). **No clamping:** a negative duration is a source defect — stop and escalate to the PM; never clamp or estimate.
- **PD-4 — Change-level inclusion and metric-specific samples.**
  - `change-row.included` = the general time-metric corpus condition: not GH-186, window anchor inside the window, and at least one included phase pair. `excluded_reason` uses only the pinned vocabulary: `no_timestamps`, `date_only_only`, `missing_start`, `baseline_change`, `outside_window`, `no_ci_observation`.
  - Exclusion precedence for a non-GH-186 change: `outside_window` (when a dated anchor exists outside the window) → `date_only_only` (pairs exist, zero included pairs, at least one date-only) → `no_timestamps` (no timestamped endpoints at all) → `missing_start` (time-stamped pairs exist but the metric's required start is absent).
  - Metric samples are metric-specific: `MET-CEREMONY-SHARE` uses included rows with at least one included pair; `MET-CYCLE-TIME` uses included rows with a timestamped `clarify_scope.started`; `MET-CI-FAILURE-RATE` uses included rows with `ci_observed: true` and counts the rest in `excluded_unobserved`; `MET-FALSE-SIGNAL-INCIDENTS` scans every included row. A metric-specific exclusion is stated in that metric's `definition`/`limitation` and counted in its `sample`; a row is never silently dropped.
  - Cycle-time censoring: when `pr_creation.completed` is absent, use the latest timestamped completed phase and set `cycle_time_censored: true`; when no completed phase exists at all, exclude the row from the cycle sample (`no_timestamps`), state the rule in `limitation`, and still keep the row in the change spine.
- **PD-5 — Numeric representation and rounding.** Per-change durations and cycle times are recorded at 1 decimal (`ROUND_HALF_UP`). Ceremony `numerator`/`denominator` are the sums of the recorded per-change 1-decimal hours; the ratio is `Decimal(numerator)/Decimal(denominator)` quantized to 6 decimals (`ROUND_HALF_UP`). CI ratio uses the same 6-decimal rule. Ratio metrics store `value` 0–1 with `unit: ratio`; a percent form is derived as `value × 100` at 1 decimal and is **never stored**. Median is the arithmetic median (mean of the two middle values for even n); p90 is nearest-rank only when n ≥ 10 (sorted ascending, `ceil(0.9 × n)`-th value, 1-indexed, no interpolation), otherwise `null` with the suppression stated. No float equality checks in verification.
- **PD-6 — Record rigor and shape.** All four new records declare `classification.rigor: R2` and render the canonical R2 set: the full template order **except** `Rollback / Reversal`, `Communication Plan`, and `Structured Retrospective` (tiered-default model, `doc/templates/decision-record-template.md`). Pin the H1 titles so index rows and records cannot drift:
  - `# ADR-0008: Harness Adapter Contract`
  - `# ADR-0009: Release Model v1`
  - `# ODR-0002: ID Prefix Scheme and Project Catalog`
  - `# ODR-0003: CLI Command Naming v1 Lock`
  Each record is `status: Proposed`, `decision_date: null`, `links.related_changes: ["GH-186"]`, names the human decider with "acceptance pending at GH-186 PR review", and links its parent(s) per §5.1 F-2 (ADR-0008 → ADR-0003 DEC-6; ADR-0009 → ADR-0003 DEC-3; ODR-0002 → ODR-0001 + the catalog concept; ODR-0003 → ADR-0007 + the command registry).
- **PD-7 — Bounded index repair (DEC-9).** Exactly two pre-existing rows change: the TDR-0005 row's ID cell and link text become `TDR-0005` and the row moves before TDR-0006; the PDR-0002 title becomes `Phase-7 Documentation Gap Closure (Always Resolve In-Change)`. The PDR-0002 filename is untouched. Every other pre-existing row is byte-identical; the row-set diff is the authoritative proof.
- **PD-8 — Registry v1 edit surface.** Exactly five hunks in `doc/planning/oss-tooling/cli-command-registry.md`: H1 → `# ados(1) command registry and man page v1`; man-page heading → `## ados(1): man page v1 (locked)`; a lock banner naming `ODR-0003`, the lock date **2026-10-31**, and the v1 freeze; the pre-lock introduction sentence replaced by the ODR-0003 statement; the `provider` naming-audit bullet changed to `confirmed as v1 by ODR-0003`. Command-table rows and extracted command tokens are byte-identical before/after.
- **PD-9 — Commit discipline.** One Conventional Commit per writing phase, scope `GH-186`; read-only phases commit nothing. Never stage `chg-GH-186-pm-notes.yaml` (PM-owned and currently modified in the working tree), the spec, the test plan, `.ai/local/**`, `tmp/**`, or untracked scratch. Commit bodies wrap at ≤ 100 characters. No phase commit spans more than its stated file list.
- **PD-10 — Doc-sync ownership.** `@coder` does not author current-truth feature specs. Phase 12 (`@doc-syncer`) creates `feature-measurement-baseline.md`, updates `feature-decision-records.md`, the glossary, `doc/00-index.md`, and the adapter-ports pointer, and registers the new feature spec in the same commit. Delivery's obligation is to leave every prerequisite (records, register, log, paths, IDs) in place and to record the handoff.

### Measurement computation procedure (binding for Phases 6–7)

The authoritative formulas are spec §5.1 F-4; the authoritative recompute procedures are test-plan TC-MEAS-005…TC-MEAS-011. The delivery executes them in this order:

1. **Pin the source and enumerate the corpus.**
   ```bash
   git fetch origin main-tools
   SRC="$(git rev-parse HEAD)"                       # full 40-hex; record it
   git cat-file -e "${SRC}^{commit}"
   git ls-tree -r --name-only "$SRC" -- doc/changes \
     | rg 'chg-[^/]+-pm-notes\.yaml$' | sort > /tmp/gh186-pm-notes.list
   ```
   The spec-time inventory is 41 pm-notes files and 5 evidence files; delivery must **re-derive** both counts and record any delta. Every source is committed and read at `SRC`; no `tmp/**`, `.ai/local/**`, uncommitted log, or URL is a measurement source.
2. **Parse phase pairs.** For every pm-notes file load `phases`, then for each of the 11 phases (`clarify_scope`, `specification`, `test_planning`, `delivery_planning`, `dor_check`, `dod_check`, `pr_creation` = ceremony; `delivery`, `system_spec_update`, `review_fix`, `quality_gates` = work) apply PD-3. Date-only means a value without a time component (for example `2026-03-06`); time means an ISO-8601 value with `T` and a time. Compute each included pair's hours and the per-change `ceremony_duration_h` and `total_phase_duration_h` per PD-5.
3. **Build the change spine.** Emit one `change-row` per pm-notes file, including GH-186 (`included: false`, `excluded_reason: baseline_change`) and every out-of-window or unparseable change (with the PD-4 reason). The row carries `pm_notes` (the committed path at `SRC`), the three pair counters, the two durations, `cycle_time_h`, `cycle_time_censored`, `ci_observed`, `ci_outcome`, `ci_observations[]`, and `false_signal_incidents[]`. This spine is the traceability source for every aggregate.
4. **Ceremony share.** `numerator = Σ change-row.ceremony_duration_h`; `denominator = Σ change-row.total_phase_duration_h` over the ceremony sample; `value = numerator/denominator` at 6 decimals (PD-5); `unit: ratio`; percent derived only. State that overlapping phases count in both numerator and denominator (duration share, not wall-clock union).
5. **Cycle time.** Per cycle-sample row: `pr_creation.completed − clarify_scope.started` at 1 decimal; fall back to the latest timestamped completed phase and set `cycle_time_censored: true` when `pr_creation.completed` is absent; exclude rows without a timestamped start from the sample (PD-4). Aggregate `n`, median, min, max; `p90_h` only when n ≥ 10 by nearest-rank, else `null` with the suppression stated.
6. **CI failure session proxy.** A row is observed only when a committed pm-notes or evidence artifact records a CI outcome. Classify `ci_outcome` as `red` (failure recorded, no subsequent green on that change), `mixed` (failure and later green recorded), `green` (only green recorded), or `null` (not observed). Every observation is an `ci_observations[]` row (`artifact`, `anchor`, `outcome`, `checks_affected`). `numerator = count(red or mixed)`; `denominator = count(ci_observed: true)`; `value` ratio at 6 decimals; `measurement_kind: session_proxy`; `limitation` names the absent committed run log and states that unobserved changes are excluded, never assumed green.
7. **False-signal incidents.** Curate one row per distinct incident or root cause per change from committed pm-notes/evidence; collapse repeated mentions; one root cause across several checks is one row with `checks_affected`. Classes are exactly `local-green-ci-red`, `false-success-exit-zero`, `skipped-read-as-green`, `green-gate-later-failed`, `lying-liveness`. Cite `artifact` + `anchor` for every row. GH-179's corpus-vs-rule defect is excluded (not a delivery-signal lie). The spec's GH-170…GH-177 list is illustrative; curate every committed record under the inclusion rule. The total is the number of rows; state that it is a curated floor.
8. **Statuses.** `UNAVAILABLE` when the sample is empty or the required source is absent (`value: null` + `missing_source`); `PARTIAL` when at least one sample row could not be examined/observed or a required field was missing (report the counts); `MEASURED` only when the metric's stated corpus was fully examined with no missing required input. Do not pre-label a metric; derive the status from the rule. For the CI metric, unobserved rows make the status `PARTIAL`; do not present a per-run rate.
9. **Recompute-and-compare (before commit).** Execute the test-plan reference procedures TC-MEAS-005…TC-MEAS-009 against the written YAML: every per-change duration, pair counter, ratio, aggregate, and class count must reproduce at the recorded precision (0 mismatches); every cited path must exist at `SRC`; every anchor must resolve. A mismatch is a defect — fix the YAML, never the source.

**Gate battery (run at Phase 9 and again at Phase 13 on the pushed HEAD)**:

| Gate | Exact command |
|---|---|
| Diff hygiene | `git diff --check "$BASE"...HEAD` |
| Doc distribution | `bash scripts/.tests/test-doc-distribution.sh` |
| Doc distribution modes | `bash scripts/.tests/test-doc-distribution-modes.sh` |
| Inception doc-set consistency | `bash scripts/.tests/test-inception-doc-consistency.sh` |
| Forbidden literals | `bun run scripts/checks/forbidden-literals.ts` |
| Privacy literals | `bun run scripts/checks/privacy-literals.ts` |
| Commitlint authority | `bun run scripts/checks/commitlint-authority.ts` |
| Commitlint range | `pnpm exec commitlint --from "$BASE" --to HEAD` |
| Baseline YAML | `python3 -c 'import yaml,sys; d=yaml.safe_load(open(sys.argv[1])); assert isinstance(d,dict)' doc/planning/oss-tooling/measurement-baseline.yaml` |
| Links/anchors | semi-automated extraction + `test -e` + heading-slug resolution (no committed checker exists; TC-SYNC-004) |

### Commit plan

| Phase | Commit (type(scope): subject) |
|---|---|
| 1 | none (read-only grounding and baselines) |
| 2 | `docs(GH-186): add four proposed foundational decision records` |
| 3 | `docs(GH-186): add foundational decision binding register` |
| 4 | `docs(GH-186): repair decision index and link the foundational register` |
| 5 | `docs(GH-186): promote command registry to locked v1 by annotation` |
| 6 | none (read-only measurement computation) |
| 7 | `docs(GH-186): add bash-era measurement baseline log and register it` |
| 8 | `docs(GH-186): link baseline and decision IDs from planning docs` |
| 9 | none (read-only verification battery) |
| 10 | none (independent review) |
| 11 | conditional: `docs(GH-186): address review findings` |
| 12 | `docs(GH-186): sync system spec and glossary with decision and baseline artifacts` |
| 13 | none (finalize; PR handoff) |

### Open questions

- None blocking. Spec OQ-1 is closed. Test-plan OQ-T1 (registry registration) is resolved by DEC-13 and PD-1; OQ-T2 (p90), OQ-T3 (canonical ratio), and OQ-T4 (`change` shape) are pinned in spec §5.1/DM-2 and PD-5.
- The interpretation-level gaps the test plan left to delivery (change-level reason precedence, metric-specific sample scopes, cycle end fallback) are pinned in PD-3/PD-4/PD-5; a reviewer may challenge a pin, but no pin may change a spec formula.
- Note: `chg-GH-186-pm-notes.yaml` is modified in the working tree by the PM. The coder must not edit or stage it.

## Scope

### In Scope

- **F-1** — `doc/decisions/00-register.md`: eight topic rows, columns `Topic` / `Binding record(s)` / `Anchor(s)` / `Status` / `Binding note`, exact five existing bindings, three new-only bindings, status mirror, update rule, no decision text, `ados_distribution: project-generated` (Phase 3).
- **F-2** — four new `Proposed` records with DM-4 front matter and R2 sections (Phase 2).
- **F-3** — ODR-0003 content plus the annotation-only `v0 → v1` promotion of `doc/planning/oss-tooling/cli-command-registry.md`; zero renames (Phases 2 and 5).
- **F-4** — `doc/planning/oss-tooling/measurement-baseline.yaml` per DM-2, with the four metrics, window, spine, sources, statuses, and comparison protocol (Phases 6–7).
- **F-5** — index rows for ADR-0008/0009/ODR-0002/0003, the TDR-0005 and PDR-0002 repairs, and register links from the index and README (Phase 4).
- **F-6 delivery-side** — planning cross-links: `doc/planning/oss-tooling/README.md`, `doc/planning/concepts/id-prefix-catalog.md`, `doc/planning/concepts/agent-primitive-surface.md` (Phase 8); current-truth sync is the Phase-12 handoff.
- **DEC-13** — data-only registration of the new user-facing docs (Phase 7 registers the YAML; Phase 12 registers the feature spec in the same commit that creates it).
- **Change folder** — this change's spec, test plan, plan, and delivery evidence under `doc/changes/2026-10/2026-10-31--GH-186--decision-records-measurement-baseline/`.

### Out of Scope

- Any change under `packages/**` or `tools/**`; any source-code, shell, test-logic, or check-logic change; any `scripts/**` edit other than the `registered` array entries in `scripts/checks/forbidden-literals.registry.json` (C-1, DEC-13).
- Any command, option, package, adapters-subpath, or product/brand rename (NG-2, DEC-5); the M4-S1 product-name freeze.
- Setting `Accepted`, a `decision_date`, or any acceptance claim; owner PR review is the gate (NG-3).
- Re-deciding layout, config precedence, provider adapter contract, state schema, or the release-model direction; editing any existing decision body (NG-4, C-2, C-6).
- Building the M2-S6 metrics engine, instrumenting an event log, or replacing the baseline with native telemetry (NG-5).
- Rewriting historical pm-notes, evidence files, change artifacts, or git history (NG-6).
- Renaming `PDR-0002-mode-aware-spec-coverage-resolution.md` or fixing unrelated pre-existing doc defects (NG-7).
- Changing the fixed window, estimating missing values, or presenting a proxy as a complete measurement (NG-9).
- Authoring `doc/spec/**` current truth in delivery phases; Phase 12 owns it (PD-10).

### Constraints

- **Docs-only plus one data exemption (C-1, AC-C1-1)**: every changed path is under `doc/**` except the single `scripts/checks/forbidden-literals.registry.json` data edit; that edit touches only `registered` entries.
- **Immutability (C-2, AC-C2-1)**: existing decision-record bodies are untouched; only `00-index.md`, `README.md`, `00-register.md`, and the four new records change in `doc/decisions/`.
- **Proposed only (C-3, AC-PROC-1)**: four records `Proposed`, `decision_date: null`, owner acceptance pending; zero `Accepted` additions.
- **No renames (C-4, NFR-5)**: command-table rows and command tokens byte-identical; zero renames anywhere in the diff.
- **Measurement honesty (C-5, NFR-1/NFR-7)**: committed evidence only; every non-null number cited; no estimates, interpolations, or invented denominators; missing inputs are `UNAVAILABLE` with `missing_source`.
- **Repository-local log (C-7)**: the baseline lives under `doc/planning/oss-tooling/`, is tracked, and is never under `.ai/local/**`.
- **Prefix discipline (C-8)**: IDs re-checked next-free before authoring; `MET-` adopted by ODR-0002; change-local IDs stay local; no number reused.
- **Forbidden literals (C-10, NFR-10)**: both new user-facing docs are registered when they exist; neither carries a delimited `ados`, `ADOS_`, or `~/.ados` occurrence on a non-allowlisted line. The YAML has no front-matter header block, so it must carry **zero** occurrences; the feature spec must avoid the working-name literal and use "the CLI".
- **Doc-distribution markers (NFR-6)**: `doc/decisions/00-index.md` keeps `ados_distribution: project-generated`; `doc/decisions/README.md` keeps `ados_distribution: redistributable`; `doc/00-index.md` keeps its marker when Phase 12 edits it. `00-register.md` carries `project-generated` even though it is not in the guard's scan set.
- **Commits (PD-9)**: one Conventional Commit per writing phase, scope `GH-186`, ≤ 100-char body lines; explicit staging lists; no PM-owned or scratch files.

**Do-not guardrails (explicit)**:

- Do **not** touch `packages/**` or `tools/**`.
- Do **not** change any check logic, seed set, allowlist, scope class, or `corpusBaseline`; only the `registered` array may grow.
- Do **not** rename commands, options, packages, adapters subpaths, files, or the product.
- Do **not** set `Accepted` or any `decision_date`; do not self-accept.
- Do **not** edit existing decision-record bodies, including `PDR-0002`.
- Do **not** rewrite historical pm-notes, evidence, change artifacts, or git history.
- Do **not** stage `.ai/local/**`, `tmp/**`, the PM notes, the spec, or the test plan.
- Do **not** add a version bump, changeset, template, or CI job.
- Do **not** author `doc/spec/**` current truth in delivery phases.
- Do **not** edit any other change folder.

### Risks

| ID | Risk | Impact | Probability | Mitigation (anchor) |
|----|------|--------|-------------|---------------------|
| RSK-8 | A concurrent decision change consumes ADR-0008/0009 or ODR-0002/0003 | M | L | Re-verify next-free IDs immediately before authoring (tasks 1.1 and 2.1); escalate instead of reusing or renumbering; never renumber existing records |
| RSK-10 | The registry edit expands into check logic, allowlist, seed set, or baseline | M | L | PD-1/PD-9: diff the registry to the `registered` array only; review `corpusBaseline`/`scopeClasses`/`seedLiterals`/`allowlist` as byte-identical (task 9.4) |
| RSK-2 / RSK-3 | Proxies and partial samples are later read as a census | H | M | Every metric carries `measurement_kind`, `status`, `sample`, `limitation`, `direction`, and `comparison_note`; CI is `session_proxy`; unobserved rows are counted, never assumed green |
| RSK-1 | A new record duplicates an existing decision | H | M | Register binds by ID/anchor; content-completeness and duplication audit (task 2.6); existing bodies diffed (task 9.1) |
| RSK-5 | Index repair expands beyond the two named defects | M | L | PD-7 and the row-set diff (task 4.5); PDR-0002 file untouched |
| RSK-6 | The AI self-accepts a record | H | L | Front-matter and diff guards (`Proposed`, `decision_date: null`, zero `Accepted` additions) in tasks 2.5 and 9.1 |
| RSK-4 | The lock freezes a latent naming defect | M | L | The v0 naming audit already applied four deferred renames; the lock is prospective and a later rename needs a superseding record plus a code change |
| RSK-9 | The new measurement feature spec becomes a second source of truth | M | L | Phase 12 specifies contract-only content and a no-values check (TC-SYNC-002) |
| Measurement drift | Recomputation disagrees with the recorded numbers | H | M | Reference procedures TC-MEAS-005…009 run before commit (task 7.6) and again at Phase 9/13; 0 tolerance, fix the YAML not the source |
| Missing-source drift | A cited path does not exist at `source_commit` | H | L | `git cat-file -e "$SRC:<path>"` over the full cited set (task 7.6); unpublished/scratch logs are never sources |

### Success Metrics

- 8/8 M0-S17 topics bound; exactly 4 new records, all `Proposed`, 0 `Accepted`; 0 existing record bodies modified.
- 0 command-table row changes, 0 renames; registry H1/heading/banner/audit say v1 and name ODR-0003.
- 4/4 required `MET-` IDs present with definitions, formulas, units, windows, sources, samples, and directions; 0 uncited non-null numbers; recomputation 0 mismatches; every cited path exists at `source_commit`.
- 2/2 index defects repaired; 0 unintended pre-existing row changes; 100% of changed links resolve.
- 0 changed paths under `packages/**`/`tools/**`; exactly 1 data-only `scripts/**` edit; all other paths under `doc/**`.
- Both new user-facing docs registered when present; forbidden-literal check exit 0; 0 delimited seed-literal occurrences in them.

## Phases

Dependency order: **1 → 2 → 3 → 4 → 5 → 6 → 7 → 8 → 9 → 10 → 11 (conditional) → 12 → 13**. Phases 2–8 are writing phases, each ending in exactly one commit via `@committer`; Phases 1, 6, 9, and 10 are read-only and end with recorded evidence. A red gate blocks the phase commit — stop at the last green task boundary and report.

### Phase 1: Grounding, ID re-verification, and green baseline

**Goal**: Re-verify every identifier, anchor, and source the later phases depend on, and capture green pre-change gate baselines before any edit.

**Tasks**:

- [ ] **1.1** Re-verify the next-free decision IDs against the live tree: `ls doc/decisions | rg '^(ADR|ODR)-'`; confirm the highest ADR is `ADR-0007` and the highest ODR is `ODR-0001`; check open branches/working tree for in-flight additions (`git branch -a`, `git status --porcelain -- doc/decisions`). If any proposed ID is taken, **stop and escalate to the PM** — never reuse or renumber (RSK-8, C-8).
- [ ] **1.2** Re-verify the template and anchor inventory: R2 section set and required front-matter keys in `doc/templates/decision-record-template.md` and `doc/guides/decision-records-management.md` §6; `### DEC-1`…`### DEC-7` in ADR-0003; `### DC-1`…`### DC-5` in ADR-0007; `## Decision` in TDR-0003/TDR-0004; `## ADOS base registry` and `## Customization model` in the ID catalog; `## Naming audit` in the command registry; the TDR-0005/PDR-0002 index defects; the PDR-0002 H1; the planning README table, catalog status line, and primitive open question. Record the exact current line/heading forms the edits will target.
- [ ] **1.3** Capture green gate baselines: `git fetch origin main-tools`; `bash scripts/.tests/test-doc-distribution.sh`; `bash scripts/.tests/test-doc-distribution-modes.sh`; `bash scripts/.tests/test-inception-doc-consistency.sh`; `bun run scripts/checks/forbidden-literals.ts`; `bun run scripts/checks/privacy-literals.ts`; `bun run scripts/checks/commitlint-authority.ts`. Record exit codes. A red baseline is a stop condition.
- [ ] **1.4** Re-derive the measurement source inventory at the current HEAD: count `doc/changes/**/chg-*-pm-notes.yaml` and `chg-*-evidence.md` (spec-time 41 and 5); record the delta; confirm the fixed window `2026-02-01T00:00:00Z`…`2026-10-31T23:59:59Z` and that no uncommitted/scratch log will be used (C-5, C-7).
- [ ] **1.5** Capture the diff baseline: record the branch and `BASE="$(git merge-base origin/main-tools HEAD)"`; inspect `git status --porcelain` and note that `chg-GH-186-pm-notes.yaml` is PM-modified and must never be staged; confirm no `.changeset/` addition is expected.
- [ ] **1.6** Confirm the forbidden-literal mechanics that drive PD-1: the `registered` list is sorted; a missing registered file fails the check; only registered docs are scanned for seed literals; `doc/changes/**` and `doc/decisions/**` are excluded. Confirm the exact insertion position for `doc/planning/oss-tooling/measurement-baseline.yaml` (sorted between the `doc/guides/` and `doc/spec/` entries).
- [ ] **1.7** Record the grounding evidence and stop conditions in the Execution Log; hand the anchor inventory to Phases 2–8. No commit.

**Acceptance Criteria**:

- Must: every proposed ID is verified free at the time of authoring; any collision is escalated, not worked around (RSK-8).
- Must: all six pre-change gate baselines are green and recorded.
- Must: the source-corpus counts and the fixed window are re-derived, not assumed.
- Should: exact edit anchors are recorded so later tasks do not re-discover them.

**Files and modules**:

- Code areas: none (read-only).
- System docs: none during this phase.

**Tests**:

- TC-DEC-001 precondition (ID availability); TC-GATE-003/005/006 baselines; TC-MEAS-001 precondition (corpus and source hygiene).

**Completion signal**: state — grounding evidence, ID verification, and green baselines recorded in the Execution Log; no commit.

---

### Phase 2: Four new Proposed decision records (F-2)

**Goal**: Author exactly the four records that have no durable home, each `Proposed`, template-conformant, linked to GH-186 and its parents, and adding only what is undecided.

**Tasks**:

- [ ] **2.1** Re-check the next-free IDs, then author `doc/decisions/ADR-0008-harness-adapter-contract.md` (delegate authoring to `@decision-advisor`). Decision content must state: harnesses are a provider domain behind the same primitive port surface as trackers/VCS/CI; `HarnessInstance` with capability flags; `HarnessSession` (spawn, deliver, resume/steer, collect, classify, harness-agnostic liveness); `HarnessPluginSurface` generated one-way from the canonical source and sync-verified; closeout telemetry extraction; dispatch selects a harness by configuration and capability gaps are declared; no harness-specific logic lives in engines. Link ADR-0003 DEC-6.
- [ ] **2.2** Author `ADR-0009-release-model-v1.md`: one lockstep version line for the five publishable packages as a changesets fixed group; one version/one tag/one release train; tagged signed releases as the stable install source with `SHA256SUMS`, SBOM, and notices; CLI/MCP artifacts built per release; M4-S2 owns automation and channel mechanics and must not reopen the release unit. Frame it as a lock of the already-decided ADR-0003 DEC-3 direction and link DEC-3.
- [ ] **2.3** Author `ODR-0002-id-prefix-scheme-and-project-catalog.md`: adopt the base registry, grammar, and rules R1–R11 from `id-prefix-catalog.md` **by reference**; declare the project catalog with per-type decision ranges (ADR/PDR/TDR/BDR/ODR each own a sequence and index — explicitly not one shared sequence); change-local prefixes unchanged; tracker/story/`RTC-` allocations as catalogued; `MET-` adopted with the measurement baseline log as allocator; no other project space pre-registered. Link ODR-0001 and the catalog concept.
- [ ] **2.4** Author `ODR-0003-cli-command-naming-v1-lock.md`: one meaning per name; near-synonym pairs rejected; family grouping; domain nouns not used for narrower commands; one-glance distinguishability and guessability; confirm `provider`, `provider-quota`, and `DeliveryRequest`; no renames in this change; after M0 a rename requires a superseding record plus a code change, and new commands join existing families. Link ADR-0007 (its revisit trigger) and the command registry.
- [ ] **2.5** Apply the DM-4 front-matter and R2 conformance sweep to all four files: `id`, `decision_type`, `status: Proposed`, `created`, `decision_date: null`, `last_updated`, `summary`, `owners` (≥1), `service`, `classification` (with `rigor: R2`), `governance` (human decider; acceptance pending at GH-186 PR review), `links` (`related_changes: ["GH-186"]` and the parent records). Exactly one H1 in the pinned form; no template residue or guidance comments; valid Markdown.
- [ ] **2.6** Run the content-completeness and no-duplication audit: tick every per-record element from spec §5.1 F-2; confirm no record re-decides layout, config precedence, state schema, or the provider adapter contract (those appear only as links), and ADR-0009 refines rather than re-decides the release direction.
- [ ] **2.7** Commit via `@committer` after `git diff --name-status` shows exactly four added files under `doc/decisions/` and no existing record body modified. Record the evidence (TC-DEC-002/003/004/005/006/007/010 partial) in the Execution Log.

**Acceptance Criteria**:

- Must: exactly the four named files exist with the pinned H1s; each is `Proposed`, `decision_date: null`, links GH-186 and its parent, and states owner acceptance pending (AC-F2-1, AC-PROC-1, DM-4).
- Must: every required Decision element from §5.1 F-2 is present (AC-F2-2); 0 existing bodies modified; no new record re-decides a bound topic (AC-F1-2).
- Must: template/R2 conformance with 0 missing required fields/sections (AC-NFR2-1, NFR-2).
- Should: each record's alternatives section records the type-classification alternatives argued in spec §5.1 F-2.

**Files and modules**:

- Code areas: none.
- System docs: `doc/decisions/ADR-0008-harness-adapter-contract.md` (new), `doc/decisions/ADR-0009-release-model-v1.md` (new), `doc/decisions/ODR-0002-id-prefix-scheme-and-project-catalog.md` (new), `doc/decisions/ODR-0003-cli-command-naming-v1-lock.md` (new).

**Tests**:

- TC-DEC-001, TC-DEC-002, TC-DEC-003, TC-DEC-004, TC-DEC-005, TC-DEC-006, TC-DEC-007; TC-DEC-010 (no existing body changed).

**Completion signal**: `docs(GH-186): add four proposed foundational decision records`

---

### Phase 3: Foundational decision binding register (F-1, DM-1)

**Goal**: Add the single projection that maps every M0-S17 topic to its binding record(s) and anchor(s) without restating a decision.

**Tasks**:

- [ ] **3.1** Author `doc/decisions/00-register.md` with `ados_distribution: project-generated` front matter and the DM-1 table columns `Topic` / `Binding record(s)` / `Anchor(s)` / `Status` / `Binding note`. Include exactly the eight rows from spec §5.1 F-1: layout (ADR-0003 DEC-1/2/7), config precedence (ADR-0003 DEC-4 + TDR-0003 §Decision), provider adapter contract (ADR-0003 DEC-6 + ADR-0005 §Decision + ADR-0007 DC-1…DC-5), harness adapter contract (ADR-0008 §Decision), state schema (ADR-0003 DEC-5 + TDR-0004 §Decision), release model (ADR-0003 DEC-3 bullets + ADR-0009 §Decision), ID prefix scheme (ODR-0002 + catalog §ADOS base registry/§Customization model), command naming (ODR-0003 + registry §Naming audit).
- [ ] **3.2** Make every binding cell a working relative link (record files) and every anchor a literal anchor token; verify each anchor exists in its target with `rg` (`^### DEC-`, `^### DC-`, `^## Decision`, `^## ADOS base registry`, `^## Customization model`, `^## Naming audit`).
- [ ] **3.3** Mirror each record's status (`Accepted` for ADR-0003, `Proposed` for TDR-0003/TDR-0004/ADR-0005/ADR-0007/ADR-0008/ADR-0009/ODR-0002/ODR-0003), state that owner acceptance of the four new records is pending at GH-186 PR review, and add the update rule (a superseded binding is replaced by its successor; the register never renumbers or restates a decision). The register contains no `## Decision` section and no rationale prose.
- [ ] **3.4** Verify the register introduces no decision text: `rg -n -i 'because|therefore|we chose|rationale'` yields nothing or only justified one-line binding notes.
- [ ] **3.5** Commit via `@committer` after the anchor/status checks are green. Record TC-DEC-008 and TC-DEC-009 evidence.

**Acceptance Criteria**:

- Must: 8/8 topics present with the exact existing bindings; every anchor resolves (AC-F1-1, NFR-8).
- Must: statuses mirror the records and pending acceptance is visible (AC-PROC-1).
- Must: no decision text and no `## Decision` heading (DM-1); no duplication of existing content (C-6).
- Should: a reader can answer "where is the <topic> decision?" from the table alone (Flow 1).

**Files and modules**:

- Code areas: none.
- System docs: `doc/decisions/00-register.md` (new).

**Tests**:

- TC-DEC-008, TC-DEC-009; TC-DEC-013 (internal links resolve).

**Completion signal**: `docs(GH-186): add foundational decision binding register`

---

### Phase 4: Decision index and README integrity (F-5)

**Goal**: Make the index trustworthy: four correct new rows, the two named repairs, no other pre-existing row changed, and register links from the index and README.

**Tasks**:

- [ ] **4.1** Add linked rows for ADR-0008, ADR-0009, ODR-0002, and ODR-0003 in numeric order (ADR-0008/0009 after ADR-0007; ODR-0002/0003 after ODR-0001). Each row's type, title (matching the pinned H1 title text), `Proposed` status, date `2026-10-31`, and owner `Juliusz Ćwiąkalski` must match its record.
- [ ] **4.2** Repair the TDR-0005 row: ID cell and link text become `TDR-0005`, the link points at `TDR-0005-delivery-result-enum-and-cli-exit-taxonomy.md`, and the row moves before the TDR-0006 row (PD-7).
- [ ] **4.3** Repair the PDR-0002 title cell to `Phase-7 Documentation Gap Closure (Always Resolve In-Change)` to match its record's H1; do not rename the file.
- [ ] **4.4** Add the register link from the index header (a line under `# Decision Records Index`) and a register reference under `## References` in `doc/decisions/README.md`. Both markers stay intact.
- [ ] **4.5** Audit the row-set diff: `git show "$BASE:doc/decisions/00-index.md" | rg '^\|'` vs the working file — every difference is the TDR-0005 row, the PDR-0002 row, or a `+` row for the four new IDs, plus the register link outside the table. Confirm no other pre-existing row changed and no decision file was renamed.
- [ ] **4.6** Commit via `@committer`. Record TC-DEC-011/012/013 evidence.

**Acceptance Criteria**:

- Must: four correct, ordered, linked rows (AC-F5-1).
- Must: 2/2 named defects repaired; PDR-0002 file untouched; 0 unintended row changes (AC-F5-2, NFR-9).
- Must: index and README both link the register, and every changed link resolves (AC-F5-3, NFR-3).
- Should: the README diff is limited to the register reference (no unrelated rewrite).

**Files and modules**:

- Code areas: none.
- System docs: `doc/decisions/00-index.md` (updated), `doc/decisions/README.md` (updated).

**Tests**:

- TC-DEC-011, TC-DEC-012, TC-DEC-013.

**Completion signal**: `docs(GH-186): repair decision index and link the foundational register`

---

### Phase 5: Command-name lock and registry v1 promotion (F-3, DM-3)

**Goal**: Promote the registry from man page v0 to locked v1 by annotation only, with zero table-row changes and zero renames.

**Tasks**:

- [ ] **5.1** Capture the pre-change registry from `BASE` and extract the table lines and command tokens (`rg '^\|'` and `rg -o 'ados [a-z][a-z-]*'`) into scratch files for the byte-identity proof (scratch only; never a committed source).
- [ ] **5.2** Apply exactly the five annotation hunks from PD-8: H1 to `# ados(1) command registry and man page v1`; man-page heading to `## ados(1): man page v1 (locked)`; a lock banner naming ODR-0003, the date `2026-10-31`, and the v1 freeze; the pre-lock introduction sentence replaced by the ODR-0003 statement; the `provider` naming-audit bullet changed to `confirmed as v1 by ODR-0003`.
- [ ] **5.3** Prove byte-identity: table-line sets and command-token sets diff clean (`diff -u` exit 0, equal counts); no changed line is a table row (`git diff -U0 … | rg '^[+-]\|'` exits 1); the four prior renames (`phase`, `lint`, `repos`, `harness`) still stand.
- [ ] **5.4** Confirm the lock scope and grounding: `provider-quota` and `DeliveryRequest` exist in the repository today (read-only grep), no rename appears anywhere in the diff (`git diff --name-status "$BASE"...HEAD | rg '^R'` exits 1), and the registry diff contains only the five hunks.
- [ ] **5.5** Commit via `@committer`. Record TC-DEC-014/015 evidence.

**Acceptance Criteria**:

- Must: title and man-page heading say v1; the banner names ODR-0003 and the lock date; the introduction and `provider` bullet are replaced as specified (AC-F3-1).
- Must: 0 command-table row changes, 0 command-token changes, 0 renames; `provider`, `provider-quota`, and `DeliveryRequest` are confirmed (AC-F3-2, NFR-5, C-4).
- Should: the banner date equals ODR-0003's lock date.

**Files and modules**:

- Code areas: none.
- System docs: `doc/planning/oss-tooling/cli-command-registry.md` (updated — annotation only).

**Tests**:

- TC-DEC-014, TC-DEC-015.

**Completion signal**: `docs(GH-186): promote command registry to locked v1 by annotation`

---

### Phase 6: Measurement baseline computation (read-only)

**Goal**: Compute the bash-era baseline exactly from committed evidence and produce the complete worksheet that Phase 7 writes as YAML — before any number is committed.

**Tasks**:

- [ ] **6.1** Pin `SRC="$(git rev-parse HEAD)"` (full 40-hex) and enumerate the committed pm-notes corpus at `SRC` per the procedure step 1; record the count and any delta from the spec-time 41. Confirm every source is committed (no `tmp/**`, `.ai/local/**`, or URL).
- [ ] **6.2** Parse every pm-notes `phases` map and classify all 11 pairs per PD-3; compute included durations at 1 decimal; confirm the counter conservation per change. Stop and escalate on any negative duration (never clamp).
- [ ] **6.3** Build the per-change spine per PD-4: one row per pm-notes file, GH-186 excluded as `baseline_change`, every excluded change given a pinned reason, every included row carrying its counters, durations, cycle time, censoring flag, CI fields, and incident rows.
- [ ] **6.4** Compute `MET-CEREMONY-SHARE`: per-row ceremony/total hours, numerator/denominator as sums of the recorded rows, ratio at 6 decimals, percent derived only; record the overlap caveat.
- [ ] **6.5** Compute `MET-CYCLE-TIME`: per-row span, censoring fallback, sample n, median/min/max, and p90 only when n ≥ 10 by nearest-rank (PD-5).
- [ ] **6.6** Extract CI observations and compute `MET-CI-FAILURE-RATE`: every observation with artifact + anchor + outcome + checks_affected; numerator/denominator/value; unobserved rows counted in `excluded_unobserved`; the session-proxy limitation recorded.
- [ ] **6.7** Curate `MET-FALSE-SIGNAL-INCIDENTS`: one row per distinct incident/root cause, exactly the five classes, artifact + anchor for each, GH-179's corpus-vs-rule defect excluded; record total and per-class counts and the curated-floor limitation. Derive each metric's status by the PD-4/§5.1 rule.
- [ ] **6.8** Record the worksheet (commands run, counts, per-metric numbers, exclusions, statuses, and the exact `SRC`) in the Execution Log. No commit.

**Acceptance Criteria**:

- Must: every number is computed from committed evidence at the pinned `SRC`; no estimate, interpolation, or invented denominator (C-5).
- Must: the corpus, inclusion/exclusion reasons, pair counters, and sample scopes are complete and internally conserving (NFR-7 precondition).
- Must: any source defect (negative duration, unparsable phase map, missing source) is escalated rather than papered over.
- Should: the worksheet is sufficient for a second person to reproduce every number without re-deriving the rules.

**Files and modules**:

- Code areas: none.
- System docs: none during this phase.

**Tests**:

- TC-MEAS-005 (window/exclusions), TC-MEAS-006 (ceremony), TC-MEAS-007 (cycle), TC-MEAS-008 (CI), TC-MEAS-009 (false-signal), TC-MEAS-010 (statuses) as computed here and re-run in Phase 7.

**Completion signal**: state — computation worksheet and `SRC` recorded in the Execution Log; no commit.

---

### Phase 7: Measurement baseline log and data-only forbidden-literal registration

**Goal**: Materialize the computed baseline as the committed, schema-versioned log, register it in the same commit so the forbidden-literal gate is green at every commit boundary, and prove exact recomputation.

**Tasks**:

- [ ] **7.1** Write `doc/planning/oss-tooling/measurement-baseline.yaml` as a single YAML document (no `---` front-matter block) with the DM-2 top-level keys: `schema_version: 1`, `artifact`, `change` (mapping `{ref: GH-186, tracker: github, excluded_from_samples: true}`), `status`, `captured_at` (ISO-8601 UTC), `source_commit` (the Phase-6 40-hex `SRC`), `window` (`start`/`end`/`basis`), `sources`, `changes`, `metrics`, `comparison_protocol`.
- [ ] **7.2** Write the `changes:` spine rows per DM-2 with every key present (explicit `null` where unused), each `pm_notes` path pointing at the committed artifact, each `ci_observations[]`/`false_signal_incidents[]` row carrying `artifact` + `anchor` and the required fields. The spine is the source of every aggregate; no aggregate may be unreproducible from it.
- [ ] **7.3** Write the four `metrics:` rows per DM-2 with `id`, `name`, `status`, `measurement_kind`, `definition`, `formula`, `unit`, `window`, `sources`, `sample` (all seven counters), `numerator`, `denominator`, `value`, `aggregates` (`median_h`, `min_h`, `max_h`, `p90_h`, plus `by_class` for the false-signal count), `limitation`, `direction`, `comparison_note`, and `missing_source` only when `UNAVAILABLE`. Ratio metrics use `unit: ratio` and a 0–1 `value`; no percent field.
- [ ] **7.4** Register the new YAML in `scripts/checks/forbidden-literals.registry.json` in the **same commit** (PD-1): add exactly `"doc/planning/oss-tooling/measurement-baseline.yaml"` to `registered` in sorted position. Do not touch `corpusBaseline`, `scopeClasses`, `seedLiterals`, `allowlist`, or any other key.
- [ ] **7.5** Parse and schema-check the YAML: it parses as a mapping; all required top-level and row keys exist; the window strings are exact; the `change` mapping is not a bare string; the four `MET-` IDs are exactly present; `source_commit` is 40-hex and reachable.
- [ ] **7.6** Run the recompute-and-compare pass (procedure step 9; TC-MEAS-003/004/005/006/007/008/009/010/011): 0 mismatches; every cited path exists at `SRC`; every anchor resolves; no forbidden source appears (`tmp/`, `.ai/local/`, URLs); `git diff --quiet "$SRC" HEAD -- <cited>` shows only GH-186 artifacts changed.
- [ ] **7.7** Run `bun run scripts/checks/forbidden-literals.ts` (exit 0), `bun run scripts/checks/privacy-literals.ts`, and a delimited seed-literal scan of the new YAML; the YAML has no allowlisted header lines, so it must contain **zero** occurrences of `ados`, `ADOS_`, or `~/.ados`. Record the handoff: `feature-measurement-baseline.md` is registered by Phase 12 in the commit that creates it (PD-1).
- [ ] **7.8** Commit via `@committer` after all checks are green. Record TC-MEAS-001/002 and the recompute evidence.

**Acceptance Criteria**:

- Must: the log exists at the pinned path, parses, carries all DM-2 keys, a reachable 40-hex `source_commit`, the exact window, GH-186 excluded, and the four `MET-` IDs (AC-F4-1, AC-F4-5, NFR-4, C-7).
- Must: every metric row has definition/formula/unit/window/sources/status/value/sample/direction; every non-null number is cited; every change and incident row resolves (AC-F4-2, NFR-1).
- Must: ratio metrics and aggregates reproduce exactly on recomputation; p90 nearest-rank and censor rules honoured (AC-F4-3, NFR-7).
- Must: UNAVAILABLE/PARTIAL semantics honoured; CI is `session_proxy` with the absent-run-log limitation (AC-F4-4, C-5).
- Must: the YAML is registered and the forbidden-literal gate exits 0 with zero seed-literal occurrences (AC-C10-1 delivery half, NFR-10).

**Files and modules**:

- Code areas: none.
- System docs: `doc/planning/oss-tooling/measurement-baseline.yaml` (new), `scripts/checks/forbidden-literals.registry.json` (updated — one `registered` entry; DEC-13).

**Tests**:

- TC-MEAS-001, TC-MEAS-002, TC-MEAS-003, TC-MEAS-004, TC-MEAS-005, TC-MEAS-006, TC-MEAS-007, TC-MEAS-008, TC-MEAS-009, TC-MEAS-010, TC-MEAS-011; TC-GATE-005 (delivery half).

**Completion signal**: `docs(GH-186): add bash-era measurement baseline log and register it`

---

### Phase 8: Planning cross-links and concept annotations (F-6 delivery-side)

**Goal**: Make the new artifacts discoverable from the planning surfaces and record the ID-scheme and primitive-term resolutions without duplicating rule bodies.

**Tasks**:

- [ ] **8.1** Add the measurement log row to the `## Documents` table in `doc/planning/oss-tooling/README.md`, naming the log and its role (bash-era baseline; canonical data for M2-S6).
- [ ] **8.2** Annotate the status block in `doc/planning/concepts/id-prefix-catalog.md` as adopted by ODR-0002 (Proposed; owner acceptance pending at GH-186 PR review), link ODR-0002, and point to the project-catalog declaration (per-type decision ranges; `MET-` allocator). Keep the existing Draft history line; do not rewrite the grammar or rules.
- [ ] **8.3** Resolve the open question in `doc/planning/concepts/agent-primitive-surface.md`: record that the unified PR/MR primitive term is `DeliveryRequest`, resolved by ODR-0003, and link the record. Replace only the open-question bullet; do not restate the naming rules.
- [ ] **8.4** Run the cross-link/consistency check: every new relative link resolves; the catalog and primitive pointers do not restate a rule body; the planning README table shape is intact.
- [ ] **8.5** Commit via `@committer`. Record TC-SYNC-003 (planning half) evidence.

**Acceptance Criteria**:

- Must: the planning README lists the measurement log; the catalog is annotated as adopted by ODR-0002; the primitive open question is resolved to `DeliveryRequest` by ODR-0003 (AC-F6-1 delivery-side prerequisites).
- Must: zero duplication of decision/naming rule bodies; links resolve (NFR-3).
- Should: no unrelated planning-doc rewrite.

**Files and modules**:

- Code areas: none.
- System docs: `doc/planning/oss-tooling/README.md` (updated), `doc/planning/concepts/id-prefix-catalog.md` (updated — status + link), `doc/planning/concepts/agent-primitive-surface.md` (updated — term pointer).

**Tests**:

- TC-SYNC-003 (planning half), TC-SYNC-004 (links), TC-SYNC-005 (bounded sync).

**Completion signal**: `docs(GH-186): link baseline and decision IDs from planning docs`

---

### Phase 9: Delivery verification battery

**Goal**: Prove the delivered tree satisfies every delivery-side AC and every hard negative constraint before review, with recorded commands and HEADs.

**Tasks**:

- [ ] **9.1** Diff scope and negative constraints (TC-GATE-001/002): `BASE="$(git merge-base origin/main-tools HEAD)"`; `git diff --name-only "$BASE"...HEAD` shows 0 `packages/**`/`tools/**` paths, exactly one `scripts/**` path (the registry), and all other paths under `doc/**`; no `.ai/local/**`; no other change folder; no existing decision body modified; no renamed/deleted decision file; no new `Accepted` line; `git diff --check "$BASE"...HEAD` clean.
- [ ] **9.2** Doc-distribution gates: `bash scripts/.tests/test-doc-distribution.sh` and `bash scripts/.tests/test-doc-distribution-modes.sh` exit 0; `doc/decisions/00-index.md`, `doc/decisions/README.md`, and `doc/00-index.md` retain their markers; no drift.
- [ ] **9.3** Inception doc-set consistency and commit conformance: `bash scripts/.tests/test-inception-doc-consistency.sh`; `bun run scripts/checks/commitlint-authority.ts`; `pnpm exec commitlint --from "$BASE" --to HEAD`.
- [ ] **9.4** Literal gates and registry scope: `bun run scripts/checks/forbidden-literals.ts` exit 0; `bun run scripts/checks/privacy-literals.ts` exit 0; `git diff "$BASE"...HEAD -- scripts/checks/forbidden-literals.registry.json` shows only the `registered` addition; `corpusBaseline`, `scopeClasses`, `seedLiterals`, and `allowlist` byte-identical (RSK-10).
- [ ] **9.5** Baseline validity and link integrity: YAML parse + DM-2 key assertions; every changed link/anchor resolves (index, register, README, records, planning docs); the register's 8/8 bindings and the index's ordered rows re-checked.
- [ ] **9.6** Re-run the recompute-and-compare pass at the final HEAD (TC-MEAS-003…011) and confirm 0 mismatches and 0 unresolved citations.
- [ ] **9.7** AC sweep: map every delivery-side AC to its evidence (all 21 except the feature-spec halves of AC-F6-1/AC-C10-1, which are Phase-12 obligations); record the sweep and the exact HEAD in the Execution Log. No commit.

**Acceptance Criteria**:

- Must: every Must-priority TC for Phases 2–8 is green with recorded evidence; all hard negative constraints hold (AC-C1-1, AC-C2-1, AC-C10-1 delivery half, AC-NFR6-1).
- Must: 0 mismatches on recomputation; 0 uncited numbers; 0 unresolved links.
- Should: failures are fixed by correcting the doc/YAML (never by weakening a gate) and the failed check is re-run.

**Files and modules**:

- Code areas: none (gates are read-only subjects).
- System docs: none unless a verification fix reopens a Phase 2–8 file (docs-only, re-committed via `@committer`).

**Tests**:

- TC-GATE-001, TC-GATE-002, TC-GATE-003, TC-GATE-004, TC-GATE-005, TC-GATE-006; TC-SYNC-004; TC-MEAS-003…011 re-run; TC-DEC-001/010/015 re-check.

**Completion signal**: state — full delivery battery green at the recorded HEAD; hand off to review.

---

### Phase 10: Code Review (Analysis) — lifecycle phase 8; PM-scheduled

**Goal**: Independent adversarial audit of the delivered artifacts against the spec, test plan, and this plan, without editing content during analysis.

**Tasks**:

- [ ] **10.1** PM delegates the independent review to `@reviewer` after the delivery handoff: trace all 21 ACs and 37 TCs to delivered files/rows/numbers and recorded evidence; re-run the ID, status, binding, index-diff, and recompute checks personally.
- [ ] **10.2** Verify the review-dominant ACs per test-plan §3.1: AC-F2-2 semantic completeness per record; AC-F1-2 no-redecision judgment; AC-F4-3/4/5 interpretation of proxies; AC-PROC-1 pending-acceptance wording.
- [ ] **10.3** Record the verdict through the review artifact workflow; route content findings to Phase 11 and any challenge to a PD pin or the spec to the PM/`@decision-advisor` — never a silent alternative.

**Acceptance Criteria**:

- Must: a traceable PASS or actionable findings; no fabricated evidence; no severity downgrade to pass the gate.

**Files and modules**:

- Code areas: none (read-only analysis).
- System docs: none during analysis.

**Tests**:

- Evidence inspection for all 37 TCs; `@runner` reproduces questionable evidence instead of assuming a pass.

**Completion signal**: state — independent verdict recorded; PASS advances to Phase 12 with Phase 11 not required; findings activate Phase 11.

---

### Phase 11: Post-review remediation (conditional; PM-scheduled)

**Goal**: Close accepted findings with the smallest docs-only fix, without duplication regression, scope expansion, or gate weakening.

**Tasks**:

- [ ] **11.1** If findings exist: reproduce each through the corresponding TC step, then apply the smallest fix in the affected named file; keep the register binding-only and the feature spec contract-only.
- [ ] **11.2** Re-run the affected Phase-9 subset (diff scope, doc-distribution, literal gates, YAML/recompute, links) and update the Execution Log; commit via `@committer` as `docs(GH-186): address review findings` when files changed.
- [ ] **11.3** PM delegates independent re-review until PASS; if no findings, record the phase not-required backed by the Phase-10 PASS.

**Acceptance Criteria**:

- Must: all accepted findings closed; previously green controls stay green; no waived check, no scope expansion.

**Files and modules**:

- Code areas: none.
- System docs: only the affected Phase 2–8 files (docs-only fixes).

**Tests**:

- Re-run the failing TC steps, then the Phase-13 final battery.

**Completion signal**: reviewer PASS after fixes, or explicit not-required state backed by the Phase-10 PASS.

---

### Phase 12: Documentation and spec synchronization — lifecycle phase 7; `@doc-syncer`; PM-scheduled

**Goal**: Reconcile current truth with the delivered decisions, register, and baseline, without restating baseline values.

**Tasks**:

- [ ] **12.1** Create `doc/spec/features/feature-measurement-baseline.md` per `doc/templates/feature-spec-template.md`: the log path, schema, four `MET-` IDs, MEASURED/PARTIAL/UNAVAILABLE semantics, source-traceability rule, fixed window, and comparison protocol. It points to the log as canonical data and **does not restate values**. Register it in `scripts/checks/forbidden-literals.registry.json` in the **same commit** (PD-1) and keep it literal-clean (generic "the CLI", no working-name literal).
- [ ] **12.2** Update `doc/spec/features/feature-decision-records.md`: add the foundational register to the component map, add a short ID-scheme/project-catalog pointer to ODR-0002 and the catalog concept, and update its `links`.
- [ ] **12.3** Update `doc/overview/glossary.md` with the new terms (foundational decision register, decision binding, command-name lock, per-type decision ranges, `MET-`, measurement baseline log, ceremony share, cycle time, CI failure session proxy, false-signal incident, source traceability, UNAVAILABLE, baseline window).
- [ ] **12.4** Update `doc/00-index.md` with the measurement baseline spec row; keep its `ados_distribution` marker and existing structure.
- [ ] **12.5** Add the harness-contract pointer to `doc/spec/features/feature-adapter-ports.md` (recorded in ADR-0008; implemented in M1-S11).
- [ ] **12.6** Verify: no metric value is restated in the feature spec (TC-SYNC-002); every new/changed link resolves; `bun run scripts/checks/forbidden-literals.ts` exit 0 with both new docs registered; doc-distribution guard green (markers intact).
- [ ] **12.7** Commit via `@committer`. Record TC-SYNC-001/002/003/004/005 and the final AC-F6-1/AC-C10-1 evidence.

**Acceptance Criteria**:

- Must: all nine named current-truth touch points are reconciled or explicitly recorded unchanged (AC-F6-1).
- Must: the feature spec states the contract, not the values; both new user-facing docs are registered and literal-clean (AC-C10-1 complete, NFR-10).
- Must: no other current-truth or historical artifact is rewritten (AC-C2-1, C-9).

**Files and modules**:

- Code areas: none.
- System docs: `doc/spec/features/feature-measurement-baseline.md` (new), `doc/spec/features/feature-decision-records.md` (updated), `doc/overview/glossary.md` (updated), `doc/00-index.md` (updated), `doc/spec/features/feature-adapter-ports.md` (updated), `scripts/checks/forbidden-literals.registry.json` (updated — second `registered` entry).

**Tests**:

- TC-SYNC-001, TC-SYNC-002, TC-SYNC-003, TC-SYNC-004, TC-SYNC-005; TC-GATE-005 (complete); doc-distribution gate.

**Completion signal**: `docs(GH-186): sync system spec and glossary with decision and baseline artifacts`

---

### Phase 13: Finalize and release — lifecycle phases 9–11; PM-scheduled

**Goal**: A fully gated, evidenced open-PR handoff; merge and owner acceptance stay outside this change.

**Tasks**:

- [ ] **13.1** Version decision: **none** — `version_impact: none`, docs-only plus one data edit, zero `packages/**` changes, therefore no `.changeset/` entry and no version hand-bump. Record the decision in the PR description.
- [ ] **13.2** Spec reconciliation: confirm the delivered tree matches spec §5.1/§7.1 (records, register, index, registry, log, cross-links, current truth); record any residual drift for the PM rather than rewriting the spec.
- [ ] **13.3** Final battery on the **pushed HEAD**: re-run the full gate battery from the procedure table, plus `git status --porcelain` clean; record the CI results for the pushed SHA.
- [ ] **13.4** DoD check: all 21 ACs have passing traceable evidence; all plan tasks are complete or explicitly not-required; the rollback statement still holds.
- [ ] **13.5** Hand off to `@pr-manager`: one PR from the feature branch to `main-tools`, assigned to the owner, describing the four `Proposed` records, the eight register bindings, the four baseline metrics and their statuses, the data-only registry edits, and that merge does **not** auto-accept a record. **STOP at the open unmerged PR.**

**Acceptance Criteria**:

- Must: no bump/changeset; spec reconciliation recorded; all DoD predicates have current evidence on the pushed HEAD.
- Must: PR open, unmerged, base `main-tools`, CI green on the pushed SHA; owner acceptance explicitly pending.

**Files and modules**:

- Code areas: none.
- System docs: handoff notes only.

**Tests**:

- The Phase-13.3 battery is the test set; no separate execution is claimed.

**Completion signal**: state — DoD verified and PR handed off (PR creation belongs to lifecycle phase 11).

---

## Test Scenarios

All 37 TCs map to phases. TC details, preconditions, and expected outcomes are authoritative in test-plan §5.2; the table records where each is first satisfied and re-verified.

| TC ID | Scenario (abbreviated) | AC | Phase(s) |
|---|---|---|---|
| TC-DEC-001 | Exactly four new records with next-free IDs | AC-F2-1, C-8 | 1 (ID check), 2, 9 |
| TC-DEC-002 | Front matter, `Proposed`, no acceptance, lineage | AC-F2-1, AC-PROC-1, C-3, DM-4 | 2, 9 |
| TC-DEC-003 | Template/R2 conformance | AC-NFR2-1, NFR-2, DM-4 | 2, 10 |
| TC-DEC-004 | ADR-0008 harness content complete | AC-F2-2 | 2, 10 |
| TC-DEC-005 | ADR-0009 release-model content complete | AC-F2-2 | 2, 10 |
| TC-DEC-006 | ODR-0002 ID-scheme/catalog content complete | AC-F2-2, C-8 | 2, 10 |
| TC-DEC-007 | ODR-0003 naming rules/confirmations/freeze | AC-F2-2, AC-F3-2, DM-3 | 2, 10 |
| TC-DEC-008 | Register exists with DM-1 schema and eight rows | AC-F1-1, DM-1, NFR-8 | 3, 9 |
| TC-DEC-009 | Register bindings exact, anchors exist, no duplication | AC-F1-1, AC-F1-2, AC-PROC-1, NFR-8, C-6 | 3, 9, 10 |
| TC-DEC-010 | Existing decision bodies unmodified | AC-F1-2, AC-C2-1, C-2, C-6 | 2 (baseline), 9 |
| TC-DEC-011 | Index gains four correct, ordered, linked rows | AC-F5-1 | 4, 9 |
| TC-DEC-012 | Index repairs TDR-0005/PDR-0002, nothing else | AC-F5-2, NFR-9, C-2 | 4, 9 |
| TC-DEC-013 | Index/README link the register; markers intact | AC-F5-3, NFR-3, DM-1 | 4, 9 |
| TC-DEC-014 | Registry promoted v0→v1 by annotation only | AC-F3-1, DM-3 | 5, 9 |
| TC-DEC-015 | Command tables byte-identical and zero renames | AC-F3-1, AC-F3-2, NFR-5, C-4 | 5, 9 |
| TC-MEAS-001 | Log exists, parses, top-level keys, 40-hex commit, four MET IDs | AC-F4-1, NFR-4, DM-2, C-7 | 7, 9 |
| TC-MEAS-002 | DM-2 row schema complete for metrics/changes/incidents | AC-F4-1, AC-F4-2, NFR-4, DM-2 | 7, 9 |
| TC-MEAS-003 | Every number cited; rows/anchors resolve | AC-F4-2, NFR-1 | 6, 7, 9 |
| TC-MEAS-004 | Cited sources exist at `source_commit`; source hygiene | AC-F4-2, NFR-1, C-5, C-7 | 6, 7, 9 |
| TC-MEAS-005 | Window, GH-186 exclusion, date-only counting, vocabulary | AC-F4-5, C-5 | 6, 7, 9 |
| TC-MEAS-006 | Ceremony share recomputes exactly | AC-F4-3, NFR-7 | 6, 7, 9 |
| TC-MEAS-007 | Cycle time recomputes, censoring and aggregates | AC-F4-3, NFR-7 | 6, 7, 9 |
| TC-MEAS-008 | CI failure rate recomputes (session proxy) | AC-F4-3, AC-F4-4, NFR-7 | 6, 7, 9 |
| TC-MEAS-009 | False-signal count recomputes per class | AC-F4-3, AC-F4-4, NFR-7 | 6, 7, 9 |
| TC-MEAS-010 | MEASURED/PARTIAL/UNAVAILABLE semantics honoured | AC-F4-4, C-5 | 6, 7, 9 |
| TC-MEAS-011 | Comparison protocol and baseline immutability stated | AC-F4-5, NFR-7 | 7, 9 |
| TC-SYNC-001 | `feature-decision-records.md` register + ID-scheme pointers | AC-F6-1 | 12 |
| TC-SYNC-002 | `feature-measurement-baseline.md` states the contract, not values | AC-F6-1, NFR-2 | 12 |
| TC-SYNC-003 | Glossary, `doc/00-index`, planning README, catalog, primitive, adapter-ports | AC-F6-1 | 8 (planning), 12 (spec/glossary) |
| TC-SYNC-004 | All new/changed links resolve to files and anchors | AC-F5-3, NFR-3 | 3, 4, 8, 9, 12 |
| TC-SYNC-005 | Sync bounded; no other artifact rewritten | AC-F6-1, AC-C2-1, C-9 | 8, 9, 12 |
| TC-GATE-001 | Diff scope: zero packages/tools, exactly one scripts data edit | AC-C1-1, C-1, DEC-13 | 9, 13 |
| TC-GATE-002 | Diff hygiene and changed-path allowlist | AC-C1-1, AC-C2-1, C-1, C-9 | 9, 13 |
| TC-GATE-003 | Doc-distribution guard (+ negative modes) passes | AC-NFR6-1, NFR-6 | 1 (baseline), 9, 13 |
| TC-GATE-004 | Branch commits satisfy commitlint | AC-C1-1, NFR-6 | 9, 13 |
| TC-GATE-005 | Forbidden-literal registration, DEC-13 scope, seed-literal compliance | AC-C1-1, AC-C10-1, AC-F6-1, NFR-10, C-10 | 1 (baseline), 7 (YAML), 9, 12 (spec), 13 |
| TC-GATE-006 | Ancillary doc-set guard stays green | AC-NFR6-1, NFR-6 | 1 (baseline), 9, 13 |

### Coverage ledger — every AC

| AC | Satisfied by (phase → evidence) |
|---|---|
| AC-F1-1 | Phase 3 (register 8 rows + anchor existence) → Phase 9 re-check; TC-DEC-008/009 |
| AC-F1-2 | Phase 2 (no re-decision; four new files only) + Phase 9 diff of existing bodies; TC-DEC-009/010 |
| AC-F2-1 | Phase 2 (four files, `Proposed`, null date, GH-186 link, acceptance statement); TC-DEC-001/002 |
| AC-F2-2 | Phase 2 content-completeness audit per §5.1 F-2; TC-DEC-004/005/006/007 |
| AC-F3-1 | Phase 5 (title/heading v1, banner ODR-0003+date, byte-identical tables); TC-DEC-014/015 |
| AC-F3-2 | Phase 2 (ODR-0003 freeze rule + three confirmations) + Phase 5 (0 renames); TC-DEC-007/015 |
| AC-F4-1 | Phase 7 (path, parse, top-level keys, 40-hex commit, `change` mapping, four IDs); TC-MEAS-001 |
| AC-F4-2 | Phase 7 (row schema, citations, anchors); TC-MEAS-002/003/004 |
| AC-F4-3 | Phases 6–7 (recompute; 0 tolerance); TC-MEAS-006/007/008/009 |
| AC-F4-4 | Phase 7 (status matrix, `missing_source`, CI `session_proxy` limitation); TC-MEAS-008/010 |
| AC-F4-5 | Phase 7 (exact window, GH-186 exclusion, date-only counts, comparison protocol); TC-MEAS-005/011 |
| AC-F5-1 | Phase 4 (four correct ordered rows); TC-DEC-011 |
| AC-F5-2 | Phase 4 (two repairs only); TC-DEC-012 |
| AC-F5-3 | Phases 3–4 (register links, index/README) + Phase 9 link resolution; TC-DEC-013/TC-SYNC-004 |
| AC-F6-1 | Phase 8 (planning prerequisites) + Phase 12 (feature spec, feature-decision-records, glossary, 00-index, adapter-ports); TC-SYNC-001/002/003/005 |
| AC-C1-1 | Phase 7 (one registry data edit) + Phase 9 diff scope; TC-GATE-001/002/005 |
| AC-C10-1 | Phase 7 (YAML registered + clean) + Phase 12 (feature spec registered + clean) + Phase 9/13 gates; TC-GATE-005 |
| AC-C2-1 | Phase 9 (no existing record modified; no other change folder) + Phase 12 bounded sync; TC-DEC-010/TC-GATE-002/TC-SYNC-005 |
| AC-NFR6-1 | Phases 1/9/13 (`test-doc-distribution.sh` exit 0); TC-GATE-003/006 |
| AC-NFR2-1 | Phase 2 template/R2 conformance sweep; TC-DEC-003 |
| AC-PROC-1 | Phase 2 status guard + Phase 3 register pending-acceptance wording; TC-DEC-002/009 |

### Definition of Done

- [ ] All 21 ACs have passing, traceable evidence at the final HEAD (delivery-side in Phase 9; current-truth halves in Phase 12).
- [ ] Exactly four `Proposed` records; 0 `Accepted`; 0 decision dates; 0 existing bodies modified.
- [ ] Register 8/8 topics; index 4 new rows + 2 repaired rows; 0 other pre-existing row changes; all links resolve.
- [ ] Registry v1 annotation only; 0 table-row changes; 0 renames; `provider`, `provider-quota`, `DeliveryRequest` confirmed.
- [ ] Baseline parses; all DM-2 keys; 4/4 `MET-` IDs; exact window; GH-186 excluded; 0 uncited numbers; 0 recompute mismatches; sources exist at `source_commit`.
- [ ] 0 changes under `packages/**`/`tools/**`; exactly one data-only `scripts/**` edit; all other changed paths under `doc/**`.
- [ ] Both new user-facing docs registered when present; forbidden-literal and privacy gates exit 0; 0 delimited seed-literal occurrences in them.
- [ ] Doc-distribution, modes, inception, commitlint, and diff-hygiene gates green on the pushed HEAD.
- [ ] Open unmerged PR to `main-tools`; owner acceptance pending; no merge or acceptance claimed.

## Artifacts and Links

| Artifact | Location | Role / handling |
|---|---|---|
| Change specification (v1.1) | [chg-GH-186-spec.md](./chg-GH-186-spec.md) | Requirements source: F-1…F-6, DM-1…DM-4, C-1…C-10, NFR-1…NFR-10, 21 ACs, metrics/window |
| Test plan (v1.1, 37 TCs) | [chg-GH-186-test-plan.md](./chg-GH-186-test-plan.md) | TC IDs, §5.2 procedures, §6 representation rules, §4 gate inventory |
| This plan | `./chg-GH-186-plan.md` | The only file written by this authoring pass |
| PM notes | `./chg-GH-186-pm-notes.yaml` | PM-owned ledger; **never edited or staged** by this change |
| New records | `doc/decisions/ADR-0008-harness-adapter-contract.md`, `ADR-0009-release-model-v1.md`, `ODR-0002-id-prefix-scheme-and-project-catalog.md`, `ODR-0003-cli-command-naming-v1-lock.md` | Phase 2; `Proposed`, acceptance pending |
| Binding register | `doc/decisions/00-register.md` | Phase 3; projection only, `project-generated` marker |
| Index + README | `doc/decisions/00-index.md`, `doc/decisions/README.md` | Phase 4; four rows, two repairs, register links |
| Command registry | `doc/planning/oss-tooling/cli-command-registry.md` | Phase 5; five annotation hunks, tables byte-identical |
| Baseline log | `doc/planning/oss-tooling/measurement-baseline.yaml` | Phase 7; canonical data, `schema_version: 1` |
| Forbidden-literal registry | `scripts/checks/forbidden-literals.registry.json` | Phase 7 (YAML entry) + Phase 12 (feature-spec entry); data only |
| Planning cross-links | `doc/planning/oss-tooling/README.md`, `doc/planning/concepts/id-prefix-catalog.md`, `doc/planning/concepts/agent-primitive-surface.md` | Phase 8 |
| Current-truth sync | `doc/spec/features/feature-measurement-baseline.md` (new), `feature-decision-records.md`, `doc/overview/glossary.md`, `doc/00-index.md`, `feature-adapter-ports.md` | Phase 12 (`@doc-syncer`) |
| Gate subjects (unchanged) | `scripts/.tests/test-doc-distribution.sh`, `test-doc-distribution-modes.sh`, `test-inception-doc-consistency.sh`, `scripts/checks/forbidden-literals.ts`, `privacy-literals.ts`, `commitlint-authority.ts` | Read-only verification battery |
| Testing strategy | [.ai/rules/testing-strategy.md](../../../../.ai/rules/testing-strategy.md) | `doc/**` static/diff + content-check mapping |

Protected paths untouched by every phase: `packages/**`, `tools/**`, `.opencode/**`, `.ados-claude/**`, `.ai/local/**`, `.changeset/`, and every existing decision-record body. No license headers added or edited; no plugin regeneration.

## Plan Revision Log

| Version | Date (UTC) | Author | Changes |
|---|---|---|---|
| 1.0 | 2026-10-31T14:00:00Z | Implementation Plan Writer | Initial thirteen-phase, 76-task plan derived from spec v1.1 (21 ACs) and test plan v1.1 (37 TCs). Pins PD-1…PD-10 (registration staging, `source_commit` semantics, phase-pair precedence, change-level inclusion/metric samples, rounding/representation, R2 record shape and pinned H1s, bounded index repair, registry v1 hunk surface, commit discipline, doc-sync ownership). Adds the binding measurement computation procedure (corpus enumeration, pair classification, four formulas, status rule, recompute-and-compare), the commit plan, the gate battery, the full TC-to-phase map, the 21-AC coverage ledger, the DoD, the risk table, and explicit do-not guardrails. Phases 1/6/9/10 are read-only; Phases 10–13 are PM-scheduled. |

## Execution Log

| Phase | Status | Started | Completed | Commit | Notes |
|---|---|---|---|---|---|
| Authoring | Complete | 2026-10-31T13:40:00Z | 2026-10-31T14:00:00Z | none | Read spec v1.1 and test plan v1.1 in full, the implementation-plan template, the GH-184/GH-185 plan precedents, the live decision corpus (ADR-0001…0007, ODR-0001, PDR/TDR set), the decision template and management guide, the register/index/README targets, the command registry, the planning README and concept docs, the forbidden-literal check and registry, and the pm-notes/evidence corpus shape (41 pm-notes, 5 evidence at authoring). Confirmed the two index defects, the next-free IDs, the `registered` missing-file behavior, and the fixed window. Only this plan file was written; no spec/test-plan/pm-notes edits, no git operations. |
