---
change:
  ref: GH-186
  type: docs
  status: Proposed
  slug: decision-records-measurement-baseline
  title: "M0-S17: Decision records and measurement baseline"
  owners: ["Juliusz Ćwiąkalski"]
  service: delivery-os decision and measurement substrate
  labels: ["documentation", "decision-records", "measurement", "M0"]
  version_impact: none
  audience: mixed
  security_impact: none
  risk_level: low
  dependencies:
    internal: ["doc/decisions/", "doc/planning/oss-tooling/", "doc/planning/concepts/", "doc/spec/features/feature-decision-records.md", "doc/overview/glossary.md", "committed pm-notes and evidence artifacts under doc/changes/", "tests/fixtures/pm-notes/corpus-exclusions.json", "git history"]
    external: []
---

# CHANGE SPECIFICATION

> **PURPOSE**: Lock the foundational decisions and the v1 command surface before M0 closes, and capture the bash-era delivery baseline in a committed, source-traced measurement log — so later milestones can prove improvement against recorded numbers instead of memory, and no foundational topic is re-litigated or accidentally renamed.

## 1. SUMMARY

This change delivers three artifacts and one bounded cleanup. First, it makes the eight foundational M0-S17 topics inspectable by binding the five already-decided topics to their existing records (layout, config precedence, provider adapter contract, state schema, release-model direction) and authoring four new `Proposed` records for the topics that are new or need a lock (harness adapter contract; the release-model v1 lock that M4-S2 elaborates; CLI command naming and v1 surface lock; ID prefix scheme with the project customization model). Second, it locks command names prospectively — the v0 registry surface becomes the v1-locked surface, with no code renames — and promotes `cli-command-registry.md` from man page v0 to v1. Third, it captures the bash-era baseline (ceremony share, cycle time, CI failure rate, false-signal incidents) in a repository-local, schema-versioned measurement log whose every number is computed from committed evidence and cites its source, with non-reconstructable metrics recorded as UNAVAILABLE. The change is documentation-only: zero changes under `packages/**` and `tools/**`, and zero source-code, shell, test-logic, or check-logic changes; the only permitted non-doc edit is a data-only registration of the two new user-facing docs in `scripts/checks/forbidden-literals.registry.json` (DEC-13).

"Decisions recorded" is satisfied in this change by authored `Proposed` records plus the binding register and index rows; owner acceptance at PR review is the acceptance gate, exactly as for ADR-0005/0007 and TDR-0003…0006. The AI does not self-accept.

## 2. CONTEXT

### 2.1 Current State Snapshot

- **Decision records exist but are not mapped to the M0-S17 topics.** `doc/decisions/` holds ADR-0001…ADR-0007, ODR-0001, PDR-0001/PDR-0002, and TDR-0001…TDR-0006. Five M0-S17 topics are already recorded:
  - layout/monorepo structure → **ADR-0003 DEC-1, DEC-2, DEC-7** (Accepted);
  - config precedence → **ADR-0003 DEC-4** (Accepted) + **TDR-0003** (Proposed);
  - provider adapter contract → **ADR-0003 DEC-6** (Accepted) + **ADR-0005** + **ADR-0007** (Proposed);
  - state schema → **ADR-0003 DEC-5** (Accepted) + **TDR-0004** (Proposed);
  - release-model direction → **ADR-0003 DEC-3** (Accepted; versioning and release bullets).
  The remaining M0-S17 topics — harness adapter contract, ID prefix scheme, command naming convention, and the release-model lock M4-S2 elaborates — have no record.
- **There is no topic-to-record register.** A reader who asks "where is the layout decision?" or "which record binds the state schema?" must already know the corpus. Nothing maps the M0-S17 topics to record IDs and anchors in one inspectable place.
- **Command names are not locked.** `doc/planning/oss-tooling/cli-command-registry.md` is titled "man page v0" and states that names are locked before M0 ends "via a decision record or the man-page v1 acceptance". Its naming audit already applied four deferred renames (`change`→`phase`, `validate`→`lint`, `workspace`→`repos`, `opencode`→`harness`). Three open naming items remain explicitly deferred to M0-S17: the `provider` command family name, the `provider-quota` adapters subpath name (ADR-0007 DC-1 and its revisit trigger), and the unified PR/MR primitive term (`agent-primitive-surface.md`; the v1 adapter contract already uses `DeliveryRequest`).
- **The ID prefix convention is a Draft concept, not an adopted scheme.** `doc/planning/concepts/id-prefix-catalog.md` defines the grammar, rules R1–R11, the ADOS base registry, and a customization model with two decision-ID shapes (separate ranges per decision type vs one shared sequence). It is not adopted by a decision record, and no project catalog declares which customization is in force.
- **No measurement baseline exists.** `roadmap.md` states "Baselines are captured in M0" and "numbers are re-baselined with native metrics once available", but no committed baseline log exists. The bash-era record is reconstructable in part from committed `chg-*-pm-notes.yaml` phase timestamps, `chg-*-evidence.md` files, and git history. There is no committed CI run log, so a per-run CI failure rate cannot be reconstructed.
- **The decision index has two pre-existing defects.** `doc/decisions/00-index.md` labels the TDR-0005 row `TDR-0006` (its link points at the TDR-0005 file) and places it after TDR-0006; the PDR-0002 row carries the title "Mode-Aware Spec-Coverage Resolution for Autonomous Delivery" while the record heading is "Phase-7 Documentation Gap Closure (Always Resolve In-Change)".
- **No measurement feature spec exists.** `doc/spec/features/` has no current-truth document for the baseline artifact or its schema; `feature-decision-records.md` is current truth for decision records but does not mention a register or the ID scheme.
- **New user-facing docs must pass the forbidden-literal check.** `scripts/checks/forbidden-literals.ts` treats every `doc/**` file except paths under `doc/changes/` and `doc/decisions/` as user-facing: a user-facing doc absent at `corpusBaseline` must be listed in `scripts/checks/forbidden-literals.registry.json` (`registered`), and registered docs are scanned for the three seed literals. Both new docs in this change (`measurement-baseline.yaml`, `feature-measurement-baseline.md`) therefore require a registry entry to pass CI. A registered path must already exist in the tree, so each entry is staged in the commit that creates its doc — never pre-registered (see §18).
- **Delivery type is documentation.** The expected artifact set is new decision records, a register, index/registry/planning-doc updates, and the baseline log. No source-code, shell, test-logic, or check-logic change is needed or permitted; the only non-doc edit is the data-only registry registration named in DEC-13.

### 2.2 Pain Points / Gaps

- **Foundational knowledge is scattered and partly unrecorded.** Five topics live across accepted and proposed records with no map; four topics have no durable home. The next reader — human or agent — must rediscover which record binds what, and M4-S2 has no release-model record to build on.
- **The ID convention is unenforced and the customization choice is undeclared.** Because the catalog is Draft and no project catalog is recorded, tools and authors cannot know whether decision IDs use per-type ranges or a single sequence, and new prefixes can drift outside the base registry.
- **Command names can still move.** Without a lock, the `provider` family, the `provider-quota` subpath, and the PR/MR primitive term can be renamed by any later change, invalidating docs, help text, MCP tool names, and user habits.
- **Improvement claims are anecdotal.** Without a committed baseline, later milestones cannot show that ceremony share, cycle time, CI failure rate, or false-signal incidents improved; the bash-era numbers live only in scattered prose.
- **The CI failure rate has no committed denominator.** There is no committed run log, so a naive "failure rate" would invent a denominator. The baseline must state what is computable and mark the rest UNAVAILABLE rather than estimate.
- **Index defects undermine the trust surface.** An index that mislabels a record and drifts from the record title is exactly the "trust the reference chain" failure the ID catalog warns about; adding four new rows on top of known-wrong rows compounds it.

## 3. PROBLEM STATEMENT

Because the foundational M0 topics are scattered across existing records with four topics still unrecorded, the command surface is not locked, and the bash-era delivery record has no committed baseline, the project cannot prove at M0 exit which decisions bind, which names are frozen, or whether later milestones actually improved — resulting in re-litigated decisions, accidental renames that break docs and tooling, and improvement claims backed by memory rather than traceable numbers.

## 4. GOALS

- **G-1**: Every M0-S17 foundational topic resolves to one inspectable binding: five already-decided topics bound to their existing records (no duplication), and four topics that are new or need a lock recorded in new `Proposed` records.
- **G-2**: Command names are locked as the v1 surface with zero renames, the three deferred naming items are confirmed, and the registry is promoted from man page v0 to v1.
- **G-3**: The ID prefix scheme is adopted, the base registry is referenced, and the project customization choice (per-type decision ranges, not a single sequence) is declared in a decision record and a project catalog.
- **G-4**: The bash-era baseline is committed to a repository-local, schema-versioned log with defined formulas, a fixed window, per-number source citations, a closed corpus-ingestion rule that names and counts every unparseable, placeholder-only, or otherwise unusable artifact, and explicit UNAVAILABLE states where committed evidence cannot reconstruct a metric.
- **G-5**: The decision register and index are accurate and inspectable, including repair of the two pre-existing index defects, so the "decisions recorded" AC can be checked by file inspection.
- **G-6**: The change is docs-only plus one data-only registry registration: zero changes under `packages/**` and `tools/**`, zero source-code/shell/test-logic/check-logic changes, and the only `scripts/**` edit is adding the two new user-facing doc paths to `scripts/checks/forbidden-literals.registry.json` (DEC-13); existing decision-record bodies remain immutable.

### 4.1 Success Metrics / KPIs

| Metric | Target |
|--------|--------|
| M0-S17 foundational topics bound in the register | 8/8 (5 topics with existing bindings + 3 new-only topics; ADR-0009 augments the release-model topic) |
| New decision records authored | Exactly 4 (`ADR-0008`, `ADR-0009`, `ODR-0002`, `ODR-0003`) |
| New records with status other than `Proposed` | 0 |
| Command renames in this change | 0 |
| Command-table rows changed in `cli-command-registry.md` | 0 (annotation-only diff) |
| Required baseline metrics present with definitions | 4/4 (`MET-CEREMONY-SHARE`, `MET-CYCLE-TIME`, `MET-CI-FAILURE-RATE`, `MET-FALSE-SIGNAL-INCIDENTS`) |
| Baseline numbers without a named source citation | 0 |
| Ratios without an explicit numerator/denominator/sample | 0 |
| Pre-existing index defects remaining after the change | 0 |
| Changed paths under `packages/**` and `tools/**` | 0 |
| Source-code, shell, test-logic, and check-logic changes | 0 |
| Changed paths under `scripts/**` | Exactly 1: data-only `registered` addition in `scripts/checks/forbidden-literals.registry.json` |
| New user-facing docs registered for the forbidden-literal check | 2/2, each registered in the commit that creates it (`measurement-baseline.yaml` in the baseline commit, `feature-measurement-baseline.md` in the doc-sync commit) |
| Committed `chg-*-pm-notes.yaml` files represented in the change spine | 100% — exactly one row per file at `source_commit`, including `included: false` rows for `unparseable_yaml` |
| Excluded changes carrying one closed-vocabulary reason and counted in `changes_excluded` | 100%; 0 silently dropped or zero-filled |
| Time metrics marked `MEASURED` over a corpus containing an excluded file | 0 (such metrics are `PARTIAL` with the exclusion count reported) |
| Delimited seed-literal occurrences on non-allowlisted lines of the new user-facing docs | 0 |
| Existing decision-record bodies modified | 0 |

> Note: the register covers eight topics: layout, config precedence, provider adapter contract, harness adapter contract, state schema, release model, ID prefix scheme, and command naming. Four topics have existing bindings only (layout, config precedence, provider adapter contract, state schema); the release-model topic has an existing direction (ADR-0003 DEC-3) plus a new lock (ADR-0009); three topics are new-only (harness, ID prefix scheme, command naming). The four new records are therefore ADR-0008, ADR-0009, ODR-0002, and ODR-0003, while the five existing bindings are ADR-0003 DEC-1/2/7, DEC-4 + TDR-0003, DEC-6 + ADR-0005 + ADR-0007, DEC-5 + TDR-0004, and DEC-3.

> Note: the single `scripts/**` path is a data-only registration, not a logic change. The forbidden-literal check code, seed set, allowlist, scope classes, and `corpusBaseline` are unchanged (DEC-13).

### 4.2 Non-Goals

- **NG-1**: Any source-code, test, CI, or shell change; zero edits under `packages/**` and `tools/**`; zero changes to the forbidden-literal check code, seed set, allowlist, scope classes, or `corpusBaseline`. The only permitted `scripts/**` edit is the data-only `registered` addition named in DEC-13.
- **NG-2**: Any command rename, option rename, package rename, or adapters-subpath rename. The lock is prospective and names the current surface.
- **NG-3**: Accepting the four new decision records. They ship `Proposed`; the owner accepts or adjusts at PR review. The AI never sets `Accepted` or a `decision_date`.
- **NG-4**: Duplicating already-decided content. Existing topics are bound by ID and anchor, not restated; existing record bodies are not edited.
- **NG-5**: Building the M2-S6 metrics engine, instrumenting the event log, or replacing the baseline with native telemetry.
- **NG-6**: Rewriting historical change artifacts, pm-notes, evidence files, or git history to make the baseline cleaner.
- **NG-7**: Renaming the `PDR-0002` file or fixing unrelated pre-existing documentation defects outside the two named index defects.
- **NG-8**: The product/brand naming freeze (M4-S1). This change locks command names only; the working product name remains read from the branding seam.
- **NG-9**: Changing the fixed baseline window, estimating missing values, or presenting a proxy as a complete measurement.

## 5. FUNCTIONAL CAPABILITIES

| ID | Capability | Rationale |
|----|------------|-----------|
| F-1 | Foundational decision binding register | One inspectable map from each M0-S17 topic to record IDs and anchors, without duplicating decision content |
| F-2 | New decision records for new or locking topics | Durable homes for harness contract, release model, ID scheme, and command naming, shipped `Proposed` for owner acceptance |
| F-3 | Command-name lock and registry v1 promotion | Freezes the v1 command surface prospectively, resolves the deferred naming items, and performs zero renames |
| F-4 | Measurement baseline log with defined metrics and source traceability | Captures the bash-era baseline so later milestones compare against recorded numbers, not memory |
| F-5 | Decision index integrity | Adds the new records and repairs the two pre-existing index defects so the index is trustworthy |
| F-6 | Current-truth documentation sync | Keeps the system spec, glossary, and planning indexes consistent with the new artifacts |

### 5.1 Capability Details

**F-1 — Foundational decision binding register.** Create `doc/decisions/00-register.md`, a concise projection (not a decision record) that maps the eight M0-S17 topics to binding records and anchors. It carries no decision text; it tells the reader which record to read. Its rows are:

| Topic | Binding record(s) | Anchor(s) |
|---|---|---|
| Layout / monorepo structure | ADR-0003 | DEC-1, DEC-2, DEC-7 |
| Config precedence | ADR-0003 + TDR-0003 | DEC-4; TDR-0003 §Decision |
| Provider adapter contract | ADR-0003 + ADR-0005 + ADR-0007 | DEC-6; ADR-0005 §Decision; ADR-0007 DC-1…DC-5 |
| Harness adapter contract | ADR-0008 (new) | §Decision |
| State schema | ADR-0003 + TDR-0004 | DEC-5; TDR-0004 §Decision |
| Release model | ADR-0003 + ADR-0009 (new) | DEC-3 (versioning and release bullets); ADR-0009 §Decision |
| ID prefix scheme | ODR-0002 (new) + `id-prefix-catalog.md` | ODR-0002 §Decision; catalog §ADOS base registry and §Customization model |
| Command naming convention | ODR-0003 (new) + `cli-command-registry.md` | ODR-0003 §Decision; registry §Naming audit |

The register states its own update rule: when a binding record is superseded, the register row is updated to the successor; the register never renumbers or restates a decision. It is linked from `doc/decisions/00-index.md` and `doc/decisions/README.md`. Statuses in the register mirror the records (Accepted vs Proposed). The register makes the "decisions recorded" AC inspectable without opening eight records.

**F-2 — New decision records for new or locking topics.** Author exactly four records, each `status: Proposed`, `decision_date: null`, and linked to GH-186 and its parent records. The set and the one-line decision are:

| Type | ID | Slug | One-line decision |
|---|---|---|---|
| ADR | `ADR-0008` | `harness-adapter-contract` | Harnesses are a provider domain behind the same primitive port surface as trackers/VCS/CI: `HarnessInstance` (capability flags), `HarnessSession` (spawn, deliver, resume/steer, collect, classify, harness-agnostic liveness), `HarnessPluginSurface` (generated one-way from the canonical source, sync-verified), and closeout telemetry extraction; dispatch selects a harness by configuration, capability gaps are declared, and no harness-specific logic lives in engines. |
| ADR | `ADR-0009` | `release-model-v1` | The v1 release model is the ADR-0003 DEC-3 release contract — one lockstep version line for the five publishable packages as a changesets fixed group, one version/one tag/one release train, tagged signed releases as the stable install source with `SHA256SUMS`, SBOM, and notices, and the CLI/MCP artifacts built per release; M4-S2 owns automation and channel mechanics within that contract and must not reopen the release unit. |
| ODR | `ODR-0002` | `id-prefix-scheme-and-project-catalog` | Adopt the base ID registry, grammar, and rules R1–R11 from `id-prefix-catalog.md` by reference; declare the project catalog with per-type decision ranges (ADR/PDR/TDR/BDR/ODR each own a sequence and index — not one shared sequence), change-local prefixes unchanged, tracker/story/`RTC-` allocations as catalogued, and `MET-` adopted with the measurement baseline log as allocator; do not pre-register any other project space. |
| ODR | `ODR-0003` | `cli-command-naming-v1-lock` | The v0 command registry is accepted as the v1-locked public command surface: one meaning per name, near-synonym pairs rejected, family grouping, domain nouns not used for narrower commands, one-glance distinguishability and guessability; the `provider` family, the `provider-quota` adapters subpath, and the `DeliveryRequest` primitive term are confirmed; no renames occur, and after M0 a rename requires a superseding record plus a code change. |

Type classification (recorded in DEC-3, not assumed): the harness contract and the release-model lock are **ADR** because they fix a port/interface boundary and the release/publish boundary respectively — durable cross-component constraints with hard reversibility and repo-wide blast radius. The ID prefix scheme and the command naming convention are **ODR**: both are operating conventions over existing artifacts (identifier allocation and the names of the existing CLI surface), not system structure, boundaries, or technology. The decision-making guide explicitly groups the decision identifier scheme with project-local operational conventions, and ODR-0001 is the precedent for a convention-level decision; the naming record freezes the existing surface rather than designing a new interface (the port/API architecture is recorded in ADR-0003/ADR-0008 and the TDRs). No TDR, PDR, or BDR record is needed: this change selects no technology or implementation pattern, changes no product scope, and makes no business decision. Alternatives considered: harness as TDR (rejected — it is a contract boundary, not a technology selection); release model as ODR (rejected — it fixes the published release unit, not an operating cadence); ID scheme as ADR (rejected — no system structure or technology choice); command naming as ADR (rejected — a naming/freeze policy over an existing surface, not a system structure or API/event contract; the ADR type is used for the port boundary in ADR-0008).

Each record follows `doc/templates/decision-record-template.md` and `doc/guides/decision-records-management.md`: front matter with `id`, `decision_type`, `status: Proposed`, `created`, `decision_date: null`, `last_updated`, `summary`, `owners`, `service`, `classification`, `governance`, and `links`; a single Decision section; alternatives with eligibility screening; and an explicit owner-acceptance statement ("acceptance pending at GH-186 PR review"). ADR-0008 links ADR-0003 DEC-6; ADR-0009 links ADR-0003 DEC-3; ODR-0003 links ADR-0007 (its revisit trigger) and the command registry; ODR-0002 links ODR-0001 (precedent) and the catalog concept. No record duplicates an existing decision's content; each adds only what is undecided.

**F-3 — Command-name lock and registry v1 promotion.** ODR-0003 records the naming convention and accepts the v0 registry as the v1 surface. `doc/planning/oss-tooling/cli-command-registry.md` is promoted from v0 to v1 by annotation only:
- the document title becomes "ados(1) command registry and man page v1";
- the man-page section heading becomes "ados(1): man page v1 (locked)";
- a lock banner states the lock date, the ODR-0003 reference, and that the names are frozen for v1;
- the introduction's "locked … via a decision record or the man-page v1 acceptance" sentence is replaced by a statement that ODR-0003 locks the surface;
- the naming-audit bullet for `provider` is updated from "confirms the name or renames it now" to "confirmed as v1 by ODR-0003";
- every command table row, command name, family name, and deferred-rename record stays byte-identical.

The lock scope is: command names and command-family names in the registry; the `provider` family; the `provider-quota` adapters subpath; and the `DeliveryRequest` primitive term (already the v1 adapter contract, so the concept's open PR/MR question is resolved by citing current truth, not by renaming). The lock does **not** freeze global option names, the product/brand name (M4-S1), or configuration key names. After M0, new commands join existing families; a rename requires a superseding decision record and a code change, never a documentation-only edit.

**F-4 — Measurement baseline log.** Create `doc/planning/oss-tooling/measurement-baseline.yaml` as the repository-local, committed measurement baseline log (not `.ai/local/**`, which is git-ignored by design). The log is the canonical data artifact; the current-truth feature spec (§F-6) describes its contract, and M2-S6 consumes its metric IDs and values. The log is a user-facing doc: it is listed in `registered` in `scripts/checks/forbidden-literals.registry.json` and refers to the CLI generically (for example, "the CLI" or "the command registry") without the working-name literal on a non-allowlisted line (C-10).

**Window and source commit.** The baseline window is `2026-02-01T00:00:00Z` through `2026-10-31T23:59:59Z` inclusive — the bash-era GH-* delivery record. The log records a full 40-hex `source_commit` against which all cited paths were read; every cited path must exist at that commit. The baseline change itself (GH-186) is excluded from all samples with reason `capture_change` because its delivery is the capture act and would be self-referential and incomplete.

**Corpus ingestion and type normalization.** The measurement corpus is every committed `doc/changes/**/chg-*-pm-notes.yaml` file that exists at `source_commit`, enumerated once. Ingestion has three normative steps:

1. **Parse.** Each file is parsed as one YAML document. A file that fails document-level YAML parsing is excluded with reason `unparseable_yaml`, keeps its own change row (`pm_notes` path, `included: false`, `excluded_reason: unparseable_yaml`), and is counted in `sample.changes_excluded`. It is never silently dropped and never zero-filled. The corpus-exclusion precedent is `tests/fixtures/pm-notes/corpus-exclusions.json` — the manifest that names the single known-unparseable historical artifact (GH-171's pm-notes) under the `feature-pm-notes-lint-and-phase-transitions.md` §Corpus boundary rule — and the baseline mirrors that precedent rather than re-deriving or widening it. The baseline does not edit the manifest.
2. **Normalize.** YAML-native scalars are converted to ISO-8601 strings before any classification: a YAML-native `date` becomes a date-only string (`YYYY-MM-DD`) and follows the date-only exclusion; a YAML-native `datetime` becomes an ISO-8601 timestamp string and is usable only when it carries a nonzero time component; a string scalar is used as written. No endpoint is discarded merely because the YAML parser produced a `date`/`datetime` object instead of a string.
3. **Classify.** Every phase pair is classified by the precedence in "Inclusion and exclusion rules", and every change receives at most one closed-vocabulary exclusion reason.

A time component of exactly `00:00:00` is a **placeholder zero time**, not a measured time. A change whose only time-bearing endpoints are placeholders is excluded with reason `placeholder_zero_time`; a change with at least one non-placeholder endpoint is included and its placeholder pairs are counted in `phase_pairs_excluded`. This prevents a date-plus-midnight placeholder from producing a fake zero-hour duration.

**Metric definitions.** The log carries four metric entries. Values are computed during delivery from the named sources, after the corpus-ingestion rule above; this spec defines the method, not the numbers.

| ID | Definition | Formula / unit | Window | Known limitation |
|---|---|---|---|---|
| `MET-CEREMONY-SHARE` | Share of recorded lifecycle phase time spent in planning/governance phases rather than delivery, review, and documentation work | `Σ ceremony_duration_h / Σ total_phase_duration_h` over included changes; canonical `value` is the ratio 0–1 (`unit: ratio`), and any percent form is derived as `value × 100` rounded to 1 decimal (never stored as a second measurement). Ceremony phases: `clarify_scope`, `specification`, `test_planning`, `delivery_planning`, `dor_check`, `dod_check`, `pr_creation`. Work phases: `delivery`, `system_spec_update`, `review_fix`, `quality_gates`. Each duration is `Σ(completed − started)` over complete phase pairs; overlapping phases count in both numerator and denominator exactly as recorded (duration share, not wall-clock union). | Per change within the baseline window; aggregate over all included changes | Proxy for scheduled-ceremony share (scheduled ceremonies do not exist in the bash era); pm-notes timestamps are self-reported and may carry clock skew; duration share differs from wall-clock share when phases overlap |
| `MET-CYCLE-TIME` | Elapsed time from the first lifecycle phase start to PR creation completion for one change | `pr_creation.completed − clarify_scope.started` in hours, 1 decimal. If `pr_creation.completed` is absent, use the latest completed phase and mark the sample right-censored. Report n, median, min, max; p90 only when n ≥ 10, computed by nearest-rank: sort the samples ascending and take the `ceil(0.9 × n)`-th smallest value (1-indexed); no interpolation. | Per change whose `clarify_scope.started` falls in the baseline window | Self-reported timestamps; clock skew; measures elapsed time, not effort |
| `MET-CI-FAILURE-RATE` | Share of change deliveries with at least one committed-record CI failure among deliveries with at least one committed-record CI observation | `numerator / denominator`; numerator = changes with `ci_outcome` red or mixed; denominator = changes with `ci_observed: true`; canonical `value` is the ratio 0–1 (`unit: ratio`), and any percent form is derived as `value × 100` rounded to 1 decimal (never stored as a second measurement). `measurement_kind: session_proxy`. | Per change within the baseline window | No committed CI run log exists; this is not a per-run or per-check rate; unobserved PRs are excluded, never assumed green; the count is a session-level floor |
| `MET-FALSE-SIGNAL-INCIDENTS` | Count of distinct committed-record incidents where a delivery signal contradicted reality | Count of curated incident rows; report total and per class. Classes: `local-green-ci-red`, `false-success-exit-zero`, `skipped-read-as-green`, `green-gate-later-failed`, `lying-liveness`. | Per change within the baseline window | Curated from committed prose, not a signal ledger; unrecorded incidents are invisible; the count is a floor, not a census; GH-179's corpus-vs-rule defect is explicitly excluded because it is not a delivery-signal lie |

**Inclusion and exclusion rules.**
- After normalization, a phase duration is included only when both endpoints are ISO-8601 timestamps with a non-placeholder time component. Classification precedence per pair is: a date-only endpoint is excluded and counted in `date_only_pairs_excluded`; otherwise a null/missing endpoint or a placeholder zero-time endpoint (`00:00:00`) is excluded and counted in `phase_pairs_excluded`; otherwise the pair is included. The per-change counters conserve at 11: `phase_pairs_included + phase_pairs_excluded + date_only_pairs_excluded = 11`.
- A change is included in the time-metric corpus only when it is parseable, inside the window, not the capture change, and has at least one includable phase pair. Every excluded change is named in its row with exactly one reason from the closed vocabulary `unparseable_yaml`, `date_only_or_missing_time`, `placeholder_zero_time`, `capture_change`, `outside_window`; `no_ci_observation` is a CI-metric sample reason only (counted in `excluded_unobserved`), never a change-row exclusion reason. No other reason value appears. Change-row precedence is deterministic: `unparseable_yaml` (the document cannot be examined) → `capture_change` (the capture change GH-186) → `outside_window` (a dated anchor outside the fixed window) → `placeholder_zero_time` (time-bearing endpoints exist but all are placeholders) → `date_only_or_missing_time` (no usable time-bearing pair). Counters conserve: `changes_parsed = changes_included + changes_excluded`. A right-censored cycle-time sample (no `pr_creation.completed`) is included and flagged with `cycle_time_censored: true`, not silently excluded.
- CI observation: a change counts as observed only when a committed pm-notes or evidence artifact records a CI outcome (green, red, or mixed) for that change. Unobserved changes are excluded from the CI sample and counted in `excluded_unobserved` with reason `no_ci_observation`.
- False-signal incidents: one row per distinct incident or root cause per change; repeated mentions of the same incident collapse to one row; one root cause affecting multiple checks is one row with `checks_affected`. A change may contribute more than one row only when the cited instances are genuinely distinct. Only incidents with an artifact and an anchor are counted. A change whose pm-notes is `unparseable_yaml` contributes no incident row from that file; an incident may still be curated from its committed evidence artifact, and the change row remains in the spine.

**Source-traceability rule.** Every non-null number carries a `sources` list with concrete locators: a repo-relative path plus field/anchor, or an exact git command whose output is the number. No `tmp/**`, `.ai/local/**`, uncommitted logs, or external URLs are measurement sources. Per-change evidence is carried in a `changes:` table (one row per change, citing its pm-notes path) and per-incident rows cite artifact and anchor. Aggregate values are projections of those rows; a value that cannot be reproduced from the cited rows/sources is a defect.

**UNAVAILABLE semantics.** A metric whose inputs are absent or insufficient is `status: UNAVAILABLE`, `value: null`, with `missing_source` naming the absent source and `limitation` explaining why. No estimate, interpolation, or invented denominator is recorded as a measurement. A metric computed over an incomplete sample is `status: PARTIAL`, with the sample counts and exclusions reported; it is not silently presented as complete. A time metric whose corpus contains an `unparseable_yaml` or `placeholder_zero_time` change cannot be `MEASURED`; it is `PARTIAL` and reports the excluded count. Only a metric with complete coverage for its definition is `status: MEASURED`.

**Comparison protocol.** Later milestones compare against the same metric ID and definition over a window of equal length; a definition change allocates a new `MET-` ID and records a supersession note rather than mutating the baseline. Committed baseline values are immutable; a new baseline is appended, not edited. Comparisons state the metric ID and definition version so a proxy is never compared to a native measurement without that caveat. The protocol also pins the conventions a later comparison must reuse: ratio metrics store a 0–1 `value` and derive any percent form, `p90_h` uses the nearest-rank method defined above, and the top-level `change` field has the mapping shape defined in DM-2.

**F-5 — Decision index integrity.** Update `doc/decisions/00-index.md`:
- add linked rows for ADR-0008, ADR-0009, ODR-0002, and ODR-0003 with the correct type, title, status, date, and owners;
- repair the pre-existing TDR-0005 row: the ID cell and the link text become `TDR-0005`, and the row is moved before TDR-0006 so numeric order holds;
- repair the PDR-0002 title to match the record heading ("Phase-7 Documentation Gap Closure (Always Resolve In-Change)"); the PDR-0002 file is not renamed;
- link the new register from the index header;
- change no other pre-existing row.

**F-6 — Current-truth documentation sync.** Phase 7 reconciles current truth with the delivered artifacts, bounded to:
- `doc/spec/features/feature-decision-records.md` — add the foundational register to the component map, add a short identifier-scheme/project-catalog pointer to ODR-0002 and the catalog concept, and update `links`;
- a new `doc/spec/features/feature-measurement-baseline.md` (template-conformant per `doc/templates/feature-spec-template.md`) describing the baseline artifact: path, schema, metric IDs, status semantics, source-traceability rule, window, and comparison protocol; it points to the log as canonical data and does not restate values; its existing frontmatter block carries `ados_distribution: internal` (consistent with sibling feature specs and `feature-doc-distribution-marker.md`; `doc/spec/**` is outside the DM-2 scan scope, so the marker is honest but unenforced); it is added to `registered` in the same doc-sync commit that creates it (never pre-registered) and refers to the CLI generically without the working-name literal (C-10);
- `doc/overview/glossary.md` — add the new terms;
- `doc/00-index.md` — add the measurement baseline spec to the current-truth index;
- `doc/planning/oss-tooling/README.md` — add the measurement log to the Documents table;
- `doc/planning/concepts/id-prefix-catalog.md` — annotate its status as adopted by ODR-0002 and link the project catalog;
- `doc/planning/concepts/agent-primitive-surface.md` — record that the PR/MR primitive term is `DeliveryRequest`, resolved by ODR-0003;
- `doc/spec/features/feature-adapter-ports.md` — add a pointer that the harness adapter contract is recorded in ADR-0008 and implemented in M1-S11;
- `doc/decisions/README.md` — add a reference to the foundational register.

No other current-truth document is rewritten in this change.

## 6. USER & SYSTEM FLOWS

```
Flow 1 — Foundational topic lookup (F-1, F-2):
  reader asks "where is the <topic> decision?"
  → opens doc/decisions/00-register.md
  → finds the topic row and the binding record + anchor
  → opens the record for the decision text
  (no decision content is copied into the register)

Flow 2 — Authoring and acceptance of a new record (F-2):
  @decision-advisor/spec-writer authors a Proposed record with owner-acceptance pending
  → register and index point at it
  → owner reviews the PR
  → owner accepts or adjusts; the record remains Proposed until the owner decides
  (AI never sets Accepted)

Flow 3 — Command name lookup and freeze (F-3):
  reader asks "is this command name final?"
  → opens cli-command-registry.md (man page v1, locked)
  → sees the ODR-0003 lock banner
  → a later change that wants a rename must author a superseding record + code change
  (no rename is performed by this change)

Flow 4 — Later-milestone comparison (F-4):
  M2-S6 wants to prove improvement
  → reads the baseline log's metric IDs, definitions, window, and statuses
  → re-measures with the same definition over an equal window
  → compares; if the definition changed, allocates a new MET- ID and records a supersession
  (a PARTIAL or UNAVAILABLE baseline is compared with its stated caveat, never silently)

Flow 5 — Decision index audit (F-5):
  reader opens doc/decisions/00-index.md
  → sees the new records and the repaired TDR-0005/PDR-0002 rows
  → follows the register link for the topic view
```

## 7. SCOPE & BOUNDARIES

### 7.1 In Scope

- **New decision records:** `doc/decisions/ADR-0008-harness-adapter-contract.md`, `ADR-0009-release-model-v1.md`, `ODR-0002-id-prefix-scheme-and-project-catalog.md`, `ODR-0003-cli-command-naming-v1-lock.md`.
- **New register:** `doc/decisions/00-register.md`.
- **Index update:** `doc/decisions/00-index.md` (four new rows, two repairs, register link).
- **Decision directory reference:** `doc/decisions/README.md` (register reference only).
- **Command registry promotion:** `doc/planning/oss-tooling/cli-command-registry.md` (v0 → v1 annotation; no table-row changes).
- **Measurement baseline log:** `doc/planning/oss-tooling/measurement-baseline.yaml`.
- **Forbidden-literal registry data registration:** `scripts/checks/forbidden-literals.registry.json` — add the two new user-facing doc paths to `registered` (data only; no check logic, seed set, allowlist, scope class, or `corpusBaseline` change; DEC-13).
- **Planning cross-links:** `doc/planning/oss-tooling/README.md` (measurement log row); `doc/planning/concepts/id-prefix-catalog.md` (status annotation + link); `doc/planning/concepts/agent-primitive-surface.md` (PR/MR term resolution pointer).
- **Current-truth sync (phase 7):** `doc/spec/features/feature-decision-records.md`, new `doc/spec/features/feature-measurement-baseline.md`, `doc/overview/glossary.md`, `doc/00-index.md`, and a pointer in `doc/spec/features/feature-adapter-ports.md`.
- **Change folder:** this change's spec, test plan, plan, pm-notes, and evidence artifacts under `doc/changes/2026-10/2026-10-31--GH-186--decision-records-measurement-baseline/`.

### 7.2 Out of Scope

- [OUT] Any change under `packages/**` or `tools/**`, including test fixture or CI edits. Any `scripts/**` change other than the data-only `registered` addition in `scripts/checks/forbidden-literals.registry.json`: check logic, seed set, allowlist, scope classes, and `corpusBaseline` are out of scope (DEC-13).
- [OUT] Any command, option, package, adapters-subpath, or product/brand rename.
- [OUT] Accepting the new decision records or setting `decision_date`; owner PR review is the acceptance gate.
- [OUT] New decision records that re-decide layout, config precedence, provider adapter contract, state schema, or the release-model direction; those are bound to existing records by the register (ADR-0009 only locks the already-decided release direction and delegates automation to M4-S2).
- [OUT] Building the M2-S6 metrics/spend engine, instrumenting the event log, or replacing the baseline with native telemetry.
- [OUT] Rewriting historical pm-notes, evidence files, change artifacts, or git history to improve the baseline.
- [OUT] Renaming `doc/decisions/PDR-0002-mode-aware-spec-coverage-resolution.md` to match its heading; the index title is corrected instead.
- [OUT] Fixing unrelated pre-existing doc defects (for example, the glossary's duplicate front-matter keys) beyond the two named index defects.
- [OUT] The M4-S1 product/brand naming freeze and the M4-S2 release-automation implementation.
- [OUT] New ID prefixes or project spaces beyond those declared by ODR-0002.

### 7.3 Deferred / Maybe-Later

- M4-S2 elaboration of release automation (release job, channel mechanics, provenance/attestation wiring) within the ADR-0009 release model.
- M1-S11 implementation of the harness adapter ports, the opencode and Claude Code delivery adapters, and telemetry extraction within the ADR-0008 contract.
- M2-S6 native metrics and spend from the event log; the baseline log is the comparison anchor until then.
- A future `PDR-0002` filename correction if the title/slug drift becomes an operational problem.
- Additional `MET-` IDs and richer metric definitions as native telemetry lands.
- A future repair of unrelated pre-existing doc defects (e.g., the glossary front-matter duplication) outside this change.

## 8. INTERFACES & INTEGRATION CONTRACTS

### 8.1 REST / HTTP Endpoints

N/A — no endpoints are added or changed.

### 8.2 Events / Messages

N/A — no events or messages are added or changed. The baseline is a static, committed data artifact, not a runtime event stream.

### 8.3 Data Model Impact

| ID | Element | Description |
|----|---------|-------------|
| DM-1 | Foundational decision register | `doc/decisions/00-register.md`: a table with columns `Topic`, `Binding record(s)`, `Anchor(s)`, `Status`, `Binding note`; eight topic rows; links to records/anchors; no decision text; an update rule for supersession; linked from the index and README. Front matter carries `ados_distribution: project-generated`, consistent with the decision index. |
| DM-2 | Measurement baseline log schema | `doc/planning/oss-tooling/measurement-baseline.yaml`: top-level `schema_version` (integer), `artifact`, `change` (a mapping `{ref, tracker, excluded_from_samples}` identifying the capture change, e.g. `{ref: GH-186, tracker: github, excluded_from_samples: true}` — never a bare string), `status`, `captured_at` (ISO-8601 UTC), `source_commit` (40-hex), `window: {start, end, basis}`, `sources: [{id, kind, locator}]`, `changes: [change-row]`, `metrics: [metric-row]`, `comparison_protocol`. A `change-row` carries `ref`, `pm_notes`, `included`, `excluded_reason`, `phase_pairs_included`, `phase_pairs_excluded`, `date_only_pairs_excluded`, `ceremony_duration_h`, `total_phase_duration_h`, `cycle_time_h`, `cycle_time_censored`, `ci_observed`, `ci_outcome`, `ci_observations[]` (`artifact`, `anchor`, `outcome`, `checks_affected`), and `false_signal_incidents[]` (`class`, `artifact`, `anchor`, `signal`, `reality`, `checks_affected`). `excluded_reason` is null for an included row and otherwise exactly one value from the closed vocabulary `unparseable_yaml`, `date_only_or_missing_time`, `placeholder_zero_time`, `capture_change`, `outside_window`; the `changes:` spine has exactly one row per committed `chg-*-pm-notes.yaml` file at `source_commit`, including unparseable files, and `sample.changes_excluded` counts every excluded row. A `metric-row` carries `id`, `name`, `status` (`MEASURED`/`PARTIAL`/`UNAVAILABLE`), `measurement_kind`, `definition`, `formula`, `unit`, `window`, `sources`, `sample` (`changes_parsed`, `changes_included`, `changes_excluded`, `phase_pairs_included`, `phase_pairs_excluded`, `date_only_pairs_excluded`, `excluded_unobserved`), `numerator`, `denominator`, `value` (canonical ratio 0–1 for ratio metrics; any percent form is derived, not stored), `aggregates` (`median_h`, `min_h`, `max_h`, `p90_h` when applicable, computed by nearest-rank per §5.1), `limitation`, `direction`, `comparison_note`, and `missing_source` (required only when `UNAVAILABLE`). The `changes:` sequence is the traceability spine; the `metrics:` sequence is the baseline table. |
| DM-3 | Command-name lock surface | The v1-locked surface is the set of command names and command-family names in `cli-command-registry.md`, plus the `provider` family, the `provider-quota` adapters subpath, and the `DeliveryRequest` primitive term. Global option names, configuration keys, and the product/brand name are outside the lock. |
| DM-4 | New decision-record front matter contract | Each new record carries `id`, `decision_type` (`adr`/`odr`), `status: Proposed`, `created`, `decision_date: null`, `last_updated`, `summary`, `owners`, `service`, `classification`, `governance` (with the owner as decider and acceptance pending at GH-186 PR review), and `links` (`related_changes: ["GH-186"]` and the relevant parent records). No new template is introduced. |

### 8.4 External Integrations

N/A — no external services, APIs, or vendors are added or changed. The baseline cites only committed repository artifacts and git history; public PR/issue numbers may appear as incident identifiers but are not measurement sources.

### 8.5 Backward Compatibility

- **No names change.** The command surface is identical before and after; the registry promotion is annotation-only, so existing links, help text, docs, MCP tool names, and user habits remain valid.
- **No record content changes.** Existing decision-record bodies are untouched; the index corrections fix labels/titles without changing any record's meaning or ID.
- **Additive artifacts.** The register and measurement log are new files; the index, registry, planning README, concept annotation, and current-truth docs gain links or annotations.
- **No runtime, configuration, or schema change.** The change cannot break a consumer of the CLI or the state layer.

## 9. NON-FUNCTIONAL REQUIREMENTS (NFRs)

### 9.1 Hard Constraints (C-#)

| ID | Constraint | Verification |
|----|------------|--------------|
| C-1 | Docs-only delivery plus one data-only registry registration: zero changed paths under `packages/**` and `tools/**`; zero source-code, shell, test-logic, or check-logic changes; the only `scripts/**` change is adding the two new user-facing doc paths to `registered` in `scripts/checks/forbidden-literals.registry.json`; all other changed files are under `doc/**` | `git diff --name-only` review; registry diff limited to `registered` array entries |
| C-2 | Existing decision-record bodies are immutable; only the index, register, and README change in `doc/decisions/` (plus the four new records) | `git diff --name-only` against existing record files |
| C-3 | New records ship `Proposed`, `decision_date: null`; the AI never sets `Accepted`; owner acceptance at PR review is the gate | Front-matter inspection |
| C-4 | No command/option/package/subpath rename; registry command-table rows are unchanged | Registry diff + repo-wide rename check |
| C-5 | Measurements use committed evidence only; no estimates, interpolations, or invented denominators; missing inputs are `UNAVAILABLE` with the missing source named; unparseable, placeholder-only, or otherwise unusable artifacts are excluded with a named closed-vocabulary reason and counted in `sample`, never silently dropped or zero-filled | Log inspection against sources; corpus-census recomputation |
| C-6 | No duplication of already-decided content; existing topics are bound by ID and anchor | Register inspection + diff of existing records |
| C-7 | The measurement log is repository-local and committed under `doc/planning/oss-tooling/`, never under `.ai/local/**` | Path check |
| C-8 | Durable ID prefixes used in delivered artifacts are registered (the base registry plus `MET-` as declared by ODR-0002); change-local spec IDs (G-, C-, NFR-, RSK-, AC-, DEC-, OQ-, F-, NG-, DM-) remain change-local per R7; decision IDs are the next free number at authoring time and are never reused | `rg`/`ls` check against `doc/decisions/` |
| C-9 | Scope is bounded to the named docs and this change folder; no other change folder is edited | `git diff --name-only` review |
| C-10 | Forbidden-literal compliance: each new user-facing doc (`doc/planning/oss-tooling/measurement-baseline.yaml`, `doc/spec/features/feature-measurement-baseline.md`) is listed in `registered` in `scripts/checks/forbidden-literals.registry.json`, each entry staged in the commit that creates its doc, and neither doc contains a delimited occurrence of the three seed literals (`ados`, `ADOS_`, `~/.ados`) on non-allowlisted lines; allowlisted header lines are those containing `Copyright`, `source:`, `Apache-2.0`, or `ados_distribution:` | Forbidden-literal check exits 0; `rg` inspection of the two docs; `git log` shows each path added in the same commit as its registry entry |

### 9.2 Non-Functional Requirements (NFR-#)

| ID | Requirement | Threshold |
|----|-------------|-----------|
| NFR-1 | Source traceability: every non-null baseline number has a concrete source citation; no uncited number | 100% cited; 0 uncited |
| NFR-2 | Decision-record conformance: every new record follows the template's required front matter and section order | 100% (0 missing required fields/sections) |
| NFR-3 | Link integrity: every new or changed index/register link resolves to an existing file or anchor | 100%; 0 broken links |
| NFR-4 | Log validity: the baseline YAML parses, carries all schema keys in DM-2, and its `changes` spine covers 100% of the committed pm-notes corpus at `source_commit`, including excluded/unparseable rows | Parse success; 0 missing top-level/metric-row keys; one row per corpus file |
| NFR-5 | Registry stability: command-table rows and command names are byte-identical before/after | 0 row diffs; 0 renames |
| NFR-6 | Distribution guard: `bash scripts/.tests/test-doc-distribution.sh` passes on the change branch; new docs carry a valid marker where in scope | Exit 0; 0 drift |
| NFR-7 | Reproducibility: recomputing each metric from its named sources, after the corpus-ingestion normalization, reproduces the recorded value, change spine, exclusion reasons, and sample counts exactly | 0 tolerance; census counts match the cited command at `source_commit` |
| NFR-8 | Register coverage: all eight M0-S17 topics resolve to at least one binding record and anchor | 8/8 |
| NFR-9 | Index accuracy: the two named pre-existing defects are repaired and no other pre-existing row changes | 2/2 repaired; 0 unintended row changes |
| NFR-10 | Forbidden-literal gate: the check passes on the change branch, both new user-facing docs are registered in the commit that creates each doc, and neither has a delimited seed-literal occurrence on a non-allowlisted line | Exit 0; 2/2 registered same-commit; 0 occurrences |

## 10. TELEMETRY & OBSERVABILITY REQUIREMENTS

N/A — this change adds no runtime telemetry, logging, metrics endpoint, or alerts. The measurement baseline log is a static, committed data artifact for later comparison; M2-S6 owns native event-log measurement. The log's own `schema_version`, `captured_at`, and `source_commit` are its reproducibility metadata, not runtime telemetry.

## 11. RISKS & MITIGATIONS

| ID | Risk | Impact | Probability | Mitigation | Residual Risk |
|----|------|--------|-------------|------------|---------------|
| RSK-1 | New records duplicate existing decisions, creating two sources of truth | H | M | Register binds existing topics by ID/anchor; C-2/C-6 and AC-F1-2 forbid restating them; existing record bodies are diff-checked | Low |
| RSK-2 | The measurement baseline uses proxies/partial samples but is later read as a complete census | H | M | Every metric carries `measurement_kind`, `status`, `sample`, `limitation`, and `direction`; the comparison protocol requires the caveat to travel with the number | Medium |
| RSK-3 | The CI failure rate is computed over an unrepresentative observed subset | H | H | The metric is named `session_proxy`, reports numerator/denominator/excluded counts, and states that unobserved PRs are not assumed green; no per-run claim is made | Medium (inherent to the bash-era record) |
| RSK-4 | The name lock freezes a naming defect | M | L | The v0 naming audit already applied the four deferred renames; the lock is prospective; a later rename needs a superseding record plus code change, so the cost is bounded and explicit | Low |
| RSK-5 | Index repair expands into rewriting history or records | M | L | Repair is bounded to two rows plus four additions (DEC-9); no record body and no PDR-0002 filename change; diff review enforces C-2 | Low |
| RSK-6 | The AI self-accepts a record or sets a decision date | H | L | C-3, AC-F2-1, and AC-PROC-1 check `status: Proposed` and `decision_date: null`; the owner gate is stated in each record and the register | Low |
| RSK-7 | The baseline drifts from definitions when M2-S6 lands | M | M | `schema_version`, stable `MET-` IDs, immutable baseline values, and the supersession rule prevent silent mutation; M2-S6 extends, not forks | Low |
| RSK-8 | A concurrent decision change consumes one of the proposed IDs | M | L | IDs are verified free at spec time; delivery re-checks the next-free rule before authoring and escalates rather than reusing a number; existing numbers are never renumbered | Low |
| RSK-9 | The new measurement feature spec becomes a second source of truth for values | M | L | The feature spec describes the contract and points to the log as canonical data; it does not restate metric values (F-6) | Low |
| RSK-10 | The registry data edit expands into a check-logic, allowlist, seed-set, or `corpusBaseline` change, eroding the docs-only boundary | M | L | C-1/C-10 bound the `scripts/**` diff to the `registered` array; delivery reviews the registry diff against the untouched check logic and seed/allowlist/baseline; DEC-13 records the narrow exemption | Low |
| RSK-11 | An unparseable or placeholder-only pm-notes file is silently dropped or zero-filled, biasing the baseline | H | M | The corpus-ingestion rule keeps a named row for every file, uses the closed exclusion vocabulary, and counts every exclusion in `sample`; a time metric over such a corpus is `PARTIAL`; the census is reproducible from the Appendix-A command at `source_commit` | Low |

## 12. ASSUMPTIONS

- The committed pm-notes, evidence artifacts, and git history at the recorded `source_commit` are the authoritative bash-era record; no uncommitted logs are used.
- The known-unparseable GH-171 pm-notes is excluded with `unparseable_yaml` and counted, mirroring `tests/fixtures/pm-notes/corpus-exclusions.json`; YAML-native `date`/`datetime` scalars are normalized to ISO-8601 before classification; a date-plus-midnight value is a placeholder, not a measured time.
- pm-notes phase timestamps are self-reported; phase ordering is reliable but clock skew is possible (GH-179's retro records a wall-clock skew), so cycle-time and ceremony-share values are approximate at the hour level and are compared against the same source in later milestones.
- No committed CI run log exists for the bash era; a session-observation proxy is the only committed-evidence CI metric.
- Existing decision records remain immutable; the register is the only mapping layer.
- `id-prefix-catalog.md` is the base-registry source; ODR-0002 adopts it by reference and declares the project catalog.
- The v0 command registry is the intended v1 surface; no latent naming defect requires a pre-lock rename.
- ODR-0002's `MET-` adoption is the basis for the baseline metric IDs; if the owner rejects or amends that adoption at PR review, the metric IDs are re-allocated under the owner's direction before merge (no unregistered prefix is left in the committed log).
- M2-S6 will consume the baseline by metric ID and definition, not by scraping prose.
- No concurrent change is authoring the same decision IDs.

## 13. DEPENDENCIES

| Direction | Item | Notes |
|-----------|------|-------|
| Depends on | ADR-0003 (Accepted) | Layout, config, state, provider-adapter, and release-direction anchors bound by the register |
| Depends on | ADR-0005, ADR-0007, TDR-0003, TDR-0004 (Proposed) | Provider-adapter and config/state bindings; read-only |
| Depends on | `doc/planning/concepts/id-prefix-catalog.md`, `harness-adapters.md`, `agent-primitive-surface.md`, `model-profiles.md` | Source concepts for ODR-0002/ODR-0003 and ADR-0008 |
| Depends on | Committed pm-notes, evidence artifacts, and git history under/derived from `doc/changes/**` | The only measurement sources |
| Depends on | `tests/fixtures/pm-notes/corpus-exclusions.json` | The corpus-exclusion precedent: names the single known-unparseable pm-notes artifact; read-only, never edited by this change |
| Depends on | `doc/decisions/00-index.md`, `doc/decisions/README.md`, `cli-command-registry.md`, `scripts/checks/forbidden-literals.registry.json` | Edit targets (the registry edit is data-only; DEC-13) |
| Blocks | M4-S2 release automation | ADR-0009 is the release-model lock M4-S2 elaborates |
| Blocks | M1-S11 harness adapters | ADR-0008 is the contract the implementation follows |
| Blocks | M2-S6 metrics and spend | The baseline log is the comparison anchor |
| Blocks | M0 exit | Names locked and foundational decisions recorded are M0 exit conditions |

## 14. OPEN QUESTIONS

| ID | Question | Context | Status |
|----|----------|---------|--------|
| OQ-1 | None open at spec time | The measurement log interpretation, topic bindings, record types/IDs, names-lock scope, baseline method, index-repair decision, doc-sync set, and the forbidden-literal registration exemption are all decided here (DEC-1…DEC-13). Test-plan OQ-T2 (p90 method), OQ-T3 (canonical ratio representation), and OQ-T4 (`change` field shape) are pinned in §5.1 and DM-2; test-plan OQ-T1 (registry registration) is resolved by DEC-13. Owner acceptance of the four records is a PR-review gate, not an open question. | Closed — no decision needed |

## 15. DECISION LOG

| ID | Decision | Rationale | Date |
|----|----------|-----------|------|
| DEC-1 | The "local measurement log" is a repository-local, committed YAML artifact at `doc/planning/oss-tooling/measurement-baseline.yaml`, not a path under `.ai/local/**` | The ticket requires the baseline to be committed; `.ai/local/**` is git-ignored by design, so the two requirements would contradict. YAML is chosen for stable M2-S6 consumption and `schema_version` evolution. | 2026-10-31 |
| DEC-2 | Bind the five already-decided topics to existing records; author new records only for the four topics that are new or need a lock | Duplicating Accepted/Proposed decision content creates a second source of truth and re-litigates settled decisions; binding by ID/anchor keeps one truth per topic | 2026-10-31 |
| DEC-3 | New record types/IDs: ADR-0008 (harness), ADR-0009 (release model), ODR-0002 (ID scheme), ODR-0003 (command naming) | Port and release boundaries are ADRs; the identifier scheme and the command naming convention are operating conventions over existing artifacts — the decision-making guide groups the identifier scheme with operational conventions, and ODR-0001 is the convention precedent. Alternatives are argued in F-2. | 2026-10-31 |
| DEC-4 | Create `doc/decisions/00-register.md` as a binding projection, linked from the index and README | The "decisions recorded" AC must be inspectable without opening every record; a register binds topics to IDs/anchors and carries no decision text, so it cannot drift into duplication | 2026-10-31 |
| DEC-5 | The names lock is prospective: accept the v0 registry as the v1 surface, perform no renames, and promote the registry by annotation only | The v0 naming audit already applied the deferred renames; renaming in a docs-only change would violate C-1/C-4 and break consumers. ODR-0003 confirms `provider`, `provider-quota`, and `DeliveryRequest`. | 2026-10-31 |
| DEC-6 | New records ship `Proposed` with owner acceptance pending at GH-186 PR review; the AI never self-accepts | Matches the established ADR-0005/0007 and TDR-0003…0006 pattern and the decision-instructions rule that AI never auto-Accepts R2/R3 records | 2026-10-31 |
| DEC-7 | Baseline metrics and formulas: ceremony share (lifecycle-phase proxy), cycle time (phase-timestamp span), CI failure rate (session-observation proxy), false-signal incidents (curated count) | These are the four ticket metrics; each formula is reconstructable from committed evidence, and each proxy's limitation is explicit. Values are computed in delivery, not invented here. | 2026-10-31 |
| DEC-8 | Non-reconstructable metrics are `UNAVAILABLE` with a named missing source; partial samples are `PARTIAL` with counts; no estimates or invented denominators | The ticket's source-traceability AC is only honest if the log distinguishes measurement from absence; an estimate presented as a measurement is worse than a gap | 2026-10-31 |
| DEC-9 | Repair the two pre-existing index defects in this change (TDR-0005 ID/order; PDR-0002 title), bounded to those rows | The index is the inspectability surface for "decisions recorded"; adding four rows on top of known-wrong rows compounds an existing trust defect. Repair is two-line, changes no record body, and leaves the PDR-0002 filename untouched. | 2026-10-31 |
| DEC-10 | Adopt `MET-` as a project space with the measurement baseline log as allocator, via ODR-0002 | The baseline needs stable metric IDs for M2-S6; `MET-` is a catalogued pattern, the log is non-empty (four metrics), and adopting it inside the ID-scheme record keeps prefix registration in one place | 2026-10-31 |
| DEC-11 | The baseline window is `2026-02-01T00:00:00Z`…`2026-10-31T23:59:59Z`; GH-186 itself is excluded; date-only timestamp pairs are excluded and counted | The GH-* record begins 2026-02-01 and the change captures on 2026-10-31; excluding the capture change avoids self-reference, and excluding date-only pairs avoids false precision | 2026-10-31 |
| DEC-12 | Phase-7 doc sync creates `feature-measurement-baseline.md` and updates `feature-decision-records.md`, the glossary, `doc/00-index.md`, the planning README, the concept status, and the adapter-ports pointer | Current truth must describe the new durable artifacts; the feature spec describes the contract while the log remains canonical data | 2026-10-31 |
| DEC-13 | Permit exactly one non-doc edit: add the two new user-facing doc paths to `registered` in `scripts/checks/forbidden-literals.registry.json`; the check code, seed set, allowlist, scope classes, and `corpusBaseline` remain unchanged | `scripts/checks/forbidden-literals.ts` treats every `doc/**` file except paths under `doc/changes/` and `doc/decisions/` as user-facing; a user-facing doc absent at `corpusBaseline` fails the check unless registered, and registered docs are scanned for the seed literals. Both new docs are outside the excluded prefixes, so a passing CI requires their registration. Precedent: GH-177 added a registry entry and GH-184 updated one. The exemption preserves the docs-only intent and changes no gate behavior. | 2026-10-31 |
| DEC-14 | Define one normative corpus-ingestion rule: parse each pm-notes file as one YAML document, normalize YAML-native `date`/`datetime` scalars to ISO-8601, treat a `00:00:00` time as a placeholder, and use the closed exclusion vocabulary `unparseable_yaml`, `date_only_or_missing_time`, `placeholder_zero_time`, `capture_change`, `outside_window` (plus `no_ci_observation` as a CI-sample reason); every excluded file keeps its own row and is counted | The corpus mixes string and YAML-native timestamps and contains one known-unparseable file; without normalization the counters cannot be reproduced, and without a named exclusion a file would be silently dropped or zero-filled. The vocabulary mirrors the existing `tests/fixtures/pm-notes/corpus-exclusions.json` precedent for the unparseable file. `placeholder_zero_time` is needed because six pm-notes records carry only date-plus-midnight placeholders, which would otherwise yield fake zero-hour durations. The rule changes no metric formula and adds no decision record. | 2026-10-31 |

## 16. AFFECTED COMPONENTS (HIGH-LEVEL)

| Component | Impact |
|-----------|--------|
| `doc/decisions/` | New — ADR-0008, ADR-0009, ODR-0002, ODR-0003; new `00-register.md` |
| `doc/decisions/00-index.md` | Updated — four new rows, two repairs, register link |
| `doc/decisions/README.md` | Updated — register reference |
| `doc/planning/oss-tooling/cli-command-registry.md` | Updated — man page v1 lock annotation; table rows unchanged |
| `doc/planning/oss-tooling/measurement-baseline.yaml` | New — the baseline log |
| `doc/planning/oss-tooling/README.md` | Updated — measurement log row |
| `doc/planning/concepts/id-prefix-catalog.md` | Updated — adopted-by-ODR-0002 status annotation + link |
| `doc/planning/concepts/agent-primitive-surface.md` | Updated — `DeliveryRequest` term resolution pointer |
| `doc/spec/features/feature-decision-records.md` | Updated — register + ID-scheme pointer |
| `doc/spec/features/feature-measurement-baseline.md` | New — baseline contract (phase 7) |
| `doc/spec/features/feature-adapter-ports.md` | Updated — harness-contract pointer |
| `doc/overview/glossary.md` | Updated — new terms |
| `doc/00-index.md` | Updated — measurement baseline spec row |
| `scripts/checks/forbidden-literals.registry.json` | Updated — data-only `registered` entries for the two new user-facing docs (DEC-13); check logic unchanged |
| `packages/**`, `tools/**` | Unchanged — hard constraint (C-1) |
| `.ai/local/**` | Unchanged — git-ignored runtime state; not a measurement source |

## 17. ACCEPTANCE CRITERIA

> Each criterion references at least one F-/DM-/NFR- ID and is verifiable by file inspection, `git diff`, `rg`, or a YAML parse. The AC set is the delivery contract and contains 21 criteria; no AC requires an estimated value.

| ID | Criterion | Linked |
|----|-----------|--------|
| AC-F1-1 | **Given** the delivered register, **when** a reader scans its rows, **then** all eight M0-S17 topics are present, each row names at least one binding record and anchor that exists, and the five existing bindings name exactly ADR-0003 DEC-1/DEC-2/DEC-7; ADR-0003 DEC-4 + TDR-0003; ADR-0003 DEC-6 + ADR-0005 + ADR-0007; ADR-0003 DEC-5 + TDR-0004; ADR-0003 DEC-3. | F-1, DM-1, NFR-8 |
| AC-F1-2 | **Given** the delivered diff, **when** existing decision-record bodies are compared, **then** none is modified, and no new record re-decides layout, config precedence, state schema, or provider adapter contract (those topics appear only as bindings/links); ADR-0009 refines the already-decided release direction into a lock without re-deciding it. | F-1, C-2, C-6 |
| AC-F2-1 | **Given** the delivered decision records, **when** enumerating new files, **then** exactly `ADR-0008-harness-adapter-contract.md`, `ADR-0009-release-model-v1.md`, `ODR-0002-id-prefix-scheme-and-project-catalog.md`, and `ODR-0003-cli-command-naming-v1-lock.md` exist; each has `status: Proposed`, `decision_date: null`, `links.related_changes` containing `GH-186`, and an owner-acceptance-pending statement; none is `Accepted`. | F-2, C-3, DM-4 |
| AC-F2-2 | **Given** each new record's Decision section, **when** it is checked against §5.1, **then** it states the required elements: ADR-0008's four harness capabilities, configuration selection, and no-engine-logic rule; ADR-0009's lockstep/fixed-group/one-tag/stable-install-source contract and M4-S2 boundary; ODR-0003's naming rules, `provider`/`provider-quota`/`DeliveryRequest` confirmations, no-rename rule, and freeze rule; ODR-0002's adoption by reference, per-type ranges, change-local allocations, `MET-` allocator, and no-empty-space rule. | F-2, DM-4, NFR-2 |
| AC-F3-1 | **Given** the delivered registry, **when** the diff is inspected, **then** the title and man-page heading say v1, a lock banner names ODR-0003 and the date, and every command table row/name is byte-identical to the pre-change registry (0 table-row changes). | F-3, DM-3, C-4 |
| AC-F3-2 | **Given** the delivered repo, **when** command names are compared before/after, **then** 0 command renames occurred; ODR-0003 states the freeze-after-M0/new-commands-join-families/superseding-record rule and confirms the `provider` family, `provider-quota` subpath, and `DeliveryRequest` term. | F-3, DM-3, NFR-5 |
| AC-F4-1 | **Given** the delivered log, **when** it is parsed, **then** it exists at `doc/planning/oss-tooling/measurement-baseline.yaml`, parses as YAML, and contains `schema_version`, `captured_at`, `source_commit` (40-hex), `window`, `sources`, `changes`, `metrics`, and `comparison_protocol`, with all four required `MET-` IDs and a top-level `change` mapping of the DM-2 shape that identifies `GH-186`; the `changes` sequence has exactly one row per committed `chg-*-pm-notes.yaml` file at `source_commit`, including `included: false` rows for unparseable files. | F-4, DM-2, NFR-4 |
| AC-F4-2 | **Given** each metric row, **when** its fields are inspected, **then** it has a definition, formula, unit, window, `sources`, `status`, `value`, `sample` counts, and `direction`; every non-null number has a concrete citation; every `changes` row cites its pm-notes path; every incident row cites artifact and anchor; 0 uncited numbers remain. | F-4, NFR-1 |
| AC-F4-3 | **Given** each ratio metric and the corpus-ingestion rule, **when** it is recomputed from the named sources after normalizing YAML-native `date`/`datetime` scalars to ISO-8601 and excluding placeholder zero times, **then** the recorded `numerator`/`denominator`/`value`, change spine, exclusion reasons, and sample counts reproduce exactly (0 tolerance), and no denominator is asserted without a `sample` count or inclusion rule. | F-4, NFR-7 |
| AC-F4-4 | **Given** any `UNAVAILABLE` metric, **when** it is inspected, **then** `value` is null and `missing_source` names the absent source; the CI metric carries `measurement_kind: session_proxy` and a `limitation` naming the absent committed run log; no estimate is presented as a measurement. | F-4, C-5 |
| AC-F4-5 | **Given** the delivered log, **when** the window and exclusions are checked, **then** `window.start` is `2026-02-01T00:00:00Z`, `window.end` is `2026-10-31T23:59:59Z`, GH-186 is listed as excluded with reason `capture_change`, date-only pairs are counted in `date_only_pairs_excluded`, every excluded change carries exactly one reason from the closed vocabulary (`unparseable_yaml`, `date_only_or_missing_time`, `placeholder_zero_time`, `capture_change`, `outside_window`; `no_ci_observation` is a CI-sample reason only), the unparseable GH-171 file appears as its own `unparseable_yaml` row counted in `changes_excluded`, and the comparison protocol states same-definition/equal-window/supersede-on-change. | F-4, DM-2, C-5 |
| AC-F5-1 | **Given** the delivered index, **when** it is read, **then** ADR-0008, ADR-0009, ODR-0002, and ODR-0003 each have a linked row with the correct type, title, `Proposed` status, date, and owner, in numeric order. | F-5, NFR-3 |
| AC-F5-2 | **Given** the delivered index diff, **when** pre-existing rows are compared, **then** the TDR-0005 row's ID cell and link text are `TDR-0005` and it precedes TDR-0006; the PDR-0002 title matches its record heading; no other pre-existing row changed. | F-5, C-2, NFR-9 |
| AC-F5-3 | **Given** every new or changed index/register link, **when** it is resolved, **then** 100% point at an existing file or anchor, and both the index and `doc/decisions/README.md` link to the new register. | F-5, NFR-3 |
| AC-F6-1 | **Given** phase 7 completion, **when** the current-truth docs are inspected, **then** `feature-decision-records.md` mentions the register and ODR-0002 ID scheme; `feature-measurement-baseline.md` exists, carries `ados_distribution: internal` inside its existing frontmatter block, was added to `registered` in the same doc-sync commit that created it, and states the log path, schema, metric IDs, status semantics, source rule, window, and comparison protocol without restating values; the glossary, `doc/00-index.md`, planning README, id-prefix-catalog status, primitive-term pointer, and adapter-ports harness pointer are updated. | F-6, DM-1, DM-2, DM-3 |
| AC-C1-1 | **Given** this change's diff, **when** changed paths are enumerated, **then** 0 paths match `packages/**` or `tools/**`; no source-code, shell, test-logic, or check-logic change is present; the only `scripts/**` change is the addition of the two new user-facing doc paths to `registered` in `scripts/checks/forbidden-literals.registry.json`; and every other changed file is under `doc/**`. | C-1, NFR-6 |
| AC-C10-1 | **Given** the delivered tree, **when** the forbidden-literal check runs, **then** both `doc/planning/oss-tooling/measurement-baseline.yaml` and `doc/spec/features/feature-measurement-baseline.md` are listed in `registered`, each entry is staged in the same commit that created its doc (the YAML in the baseline commit, the feature spec in the doc-sync commit; neither was pre-registered), the check exits 0, and neither doc contains a delimited occurrence of the three seed literals on a non-allowlisted line (allowlisted header lines are those containing `Copyright`, `source:`, `Apache-2.0`, or `ados_distribution:`). | C-10, NFR-10 |
| AC-C2-1 | **Given** this change's diff, **when** files are enumerated, **then** no existing decision-record file is modified and no change folder other than GH-186's is edited. | C-2, C-9, DM-4 |
| AC-NFR6-1 | **Given** the change branch, **when** `bash scripts/.tests/test-doc-distribution.sh` runs, **then** it exits 0 with no drift. | NFR-6, C-1 |
| AC-NFR2-1 | **Given** each new decision record, **when** it is checked against the template, **then** all required front-matter keys and required sections are present in order and the record renders as valid Markdown. | NFR-2, DM-4 |
| AC-PROC-1 | **Given** the four new records and the register, **when** status is checked, **then** every record is `Proposed` with `decision_date: null`, the register shows the pending owner acceptance, and 0 records are `Accepted`. | F-2, C-3, DM-4 |

## 18. ROLLOUT & CHANGE MANAGEMENT (HIGH-LEVEL)

- **Delivery branch (authoritative):** `feat/GH-186/decision-records-and-measurement-baseline`, targeting `main-tools`; docs-only plus the data-only registry registration; no feature flag, migration, or runtime rollout. The change-folder/spec slug is `decision-records-measurement-baseline` and intentionally differs from the branch slug; the branch name is authoritative for delivery, commits, and the PR, and no file or folder is renamed to match it.
- **Registration staging (normative).** A new user-facing doc is added to `registered` in `scripts/checks/forbidden-literals.registry.json` only in the commit that creates it; a path is never registered before it exists (the check fails with `registered doc is missing from the tree`). Concretely: `doc/planning/oss-tooling/measurement-baseline.yaml` and its `registered` entry are committed together in the baseline-log phase (plan Phase 7), and `doc/spec/features/feature-measurement-baseline.md` and its `registered` entry are committed together in the same doc-sync commit (plan Phase 12). Each of those commits runs the forbidden-literal check green.
- Delivery order: (1) author the four records, (2) create the register, (3) update the index and README, (4) promote the registry to v1, (5) compute the baseline log and commit it together with its `registered` entry, (6) phase-7 doc sync — create the feature spec, commit it together with its `registered` entry, and update the other current-truth docs, (7) review and quality gates after doc-sync, (8) PR handoff.
- Owner acceptance is explicit at PR review: the PR description lists the four `Proposed` records and the four baseline metrics, and states that merge does not auto-accept a record.
- Consumers named in the PR: M4-S2 (ADR-0009), M1-S11 (ADR-0008), M2-S6 (the baseline log and its `MET-` IDs), and future decision audits (the register).
- No communication or deprecation window is needed: no name, interface, or behavior changes.

## 19. DATA MIGRATION / SEEDING (IF APPLICABLE)

N/A — no data is migrated. The measurement baseline log is a new seeded artifact whose values are computed from existing committed evidence; no existing artifact is rewritten. The register and index are new/updated projections, not migrations.

## 20. PRIVACY / COMPLIANCE REVIEW

- No personal data, credentials, private identifiers, or cloud references are introduced. The baseline cites committed repository paths, ticket/PR numbers already public in the repository, and short non-identifying facts from pm-notes/evidence.
- Incident citations quote only the minimum signal/reality fact; they do not reproduce private literals or full log bodies.
- The privacy/no-cloud guard battery remains green; no new guarded literal is introduced. Both new user-facing docs are registered with the forbidden-literal check and introduce no seed-literal occurrence (C-10).

## 21. SECURITY REVIEW HIGHLIGHTS

- No permissions, credentials, configuration, or runtime behavior changes.
- Freezing command names reduces a security-adjacent confusion risk: MCP tool names and help text cannot silently drift to a near-synonym that misroutes an operator or agent.
- The baseline log is read-only evidence; it does not execute or import measured artifacts.

## 22. MAINTENANCE & OPERATIONS IMPACT

- The register must be updated when a binding record is superseded; it is a projection, not a second decision store.
- Baseline values are immutable. A new baseline is appended or a new `MET-` ID is allocated when a definition changes; existing values are never edited in place.
- The decision index remains manually maintained; the new rows follow the existing format and ordering.
- Command names are frozen for v1: future commands join families; renames require a superseding record plus a code change.
- M4-S2, M1-S11, and M2-S6 must read the relevant record/log rather than re-deciding the topic or re-deriving a baseline from memory.

## 23. GLOSSARY

| Term | Definition |
|------|------------|
| Foundational decision register | `doc/decisions/00-register.md`; a projection mapping an M0 topic to binding record IDs and anchors, with no decision text |
| Decision binding | A row that points a topic at the record(s) that decide it; the register binds, the record decides |
| Command-name lock | The prospective freeze of the v1 command/family names recorded by ODR-0003; no rename is performed by the lock |
| Per-type decision ranges | Separate numeric sequences for ADR/PDR/TDR/BDR/ODR, each with its own index, as opposed to one shared decision sequence |
| `MET-` | The adopted metric-definition prefix; the measurement baseline log is the allocator for `MET-` IDs |
| Measurement baseline log | `doc/planning/oss-tooling/measurement-baseline.yaml`; the committed, schema-versioned bash-era baseline |
| Ceremony share | The share of recorded lifecycle phase time spent in planning/governance phases; a bash-era proxy for scheduled-ceremony share |
| Cycle time | Elapsed time from the first lifecycle phase start to PR creation completion for one change |
| CI failure session proxy | The share of change deliveries with a recorded CI failure among deliveries with a recorded CI observation; not a per-run rate |
| False-signal incident | A recorded case where a delivery signal contradicted reality (e.g., local green vs CI red, exit-zero success with no delivery, a skipped check read as green) |
| Source traceability | The rule that every baseline number names the committed path/field/anchor or exact git command that produces it |
| `UNAVAILABLE` | A metric state meaning the committed evidence cannot reconstruct the value; `value` is null and `missing_source` names the gap |
| Baseline window | `2026-02-01T00:00:00Z`…`2026-10-31T23:59:59Z`, the bash-era delivery record used for the baseline |
| Corpus ingestion | The normative parse → normalize → classify rule applied to every committed pm-notes file before any measurement; it names and counts every exclusion |
| `unparseable_yaml` | Closed-vocabulary exclusion reason for a pm-notes file that fails document-level YAML parsing; the file keeps its own change row and is counted in `changes_excluded` |
| `date_only_or_missing_time` | Closed-vocabulary exclusion reason for a change with no usable time-bearing phase endpoint (date-only or missing time) |
| Placeholder zero time | A `00:00:00` time component that records a date rather than a measured time; a change with only placeholder endpoints is excluded with `placeholder_zero_time` and counted |
| Closed exclusion vocabulary | The fixed set `unparseable_yaml`, `date_only_or_missing_time`, `placeholder_zero_time`, `capture_change`, `outside_window` (plus `no_ci_observation` as a CI-sample reason); no other change-row reason is permitted |

## 24. APPENDICES

### 24.1 Appendix A — Spec-time evidence inventory

Spec-time observations (not baseline values; all counts are re-derived at capture time):

- IDs verified free at spec time: the highest existing ADR is ADR-0007 and the highest existing ODR is ODR-0001; the next-free rule allocates ADR-0008, ADR-0009, ODR-0002, and ODR-0003. The delivery re-checks before authoring and escalates rather than reusing a number.
- **pm-notes census.** At spec-time HEAD `5a511f4bec4ce2a2fff6e3248b88ecafed34a2ca` (2026-10-31), the corpus is 41 `doc/changes/**/chg-*-pm-notes.yaml` files: 40 parse as one YAML document, 30 carry at least one time-bearing phase start, 10 carry only date-only starts, and 1 file (`chg-GH-171-pm-notes.yaml`) fails YAML parsing. Of the 30 time-bearing files, 24 carry at least one non-placeholder time and 6 carry only placeholder `T00:00:00Z` starts (GH-57, GH-67, GH-69, GH-71, GH-72, GH-174). Excluding the capture change GH-186, 23 changes enter the time-metric corpus. The census is reproducible from the repository root with this exact command:

```bash
python3 - <<'PY'
import glob, re, datetime, yaml
files = sorted(glob.glob('doc/changes/**/chg-*-pm-notes.yaml', recursive=True))
P = ['clarify_scope','specification','test_planning','delivery_planning','dor_check',
     'dod_check','pr_creation','delivery','system_spec_update','review_fix','quality_gates']
def kind(v):
    if isinstance(v, datetime.datetime):
        return 'time' if (v.hour, v.minute, v.second) != (0,0,0) else 'zero'
    if isinstance(v, datetime.date):
        return 'date'
    if isinstance(v, str):
        s = v.strip()
        if re.fullmatch(r'\d{4}-\d{2}-\d{2}', s): return 'date'
        if 'T' in s: return 'zero' if 'T00:00:00' in s else 'time'
    return None
n = parse = ts_any = ts_real = date_files = zero_files = unparseable = 0
for f in files:
    n += 1
    try:
        d = yaml.safe_load(open(f))
        assert isinstance(d, dict)
    except Exception:
        unparseable += 1
        continue
    parse += 1
    starts = [kind(((d.get('phases') or {}).get(p) or {}).get('started')) for p in P]
    has_time, has_zero, has_date = 'time' in starts, 'zero' in starts, 'date' in starts
    ts_any += (has_time or has_zero)
    ts_real += has_time
    date_files += (has_date and not has_time and not has_zero)
    zero_files += (has_zero and not has_time and not has_date)
print(dict(files=n, parseable=parse, timestamped_any=ts_any, timestamped_real=ts_real,
           date_only_files=date_files, placeholder_zero_time_files=zero_files, unparseable=unparseable))
PY
```

Observed output: `{'files': 41, 'parseable': 40, 'timestamped_any': 30, 'timestamped_real': 24, 'date_only_files': 10, 'placeholder_zero_time_files': 6, 'unparseable': 1}`. The single unparseable path is the one already named in `tests/fixtures/pm-notes/corpus-exclusions.json`; the baseline mirrors that manifest and excludes it with reason `unparseable_yaml`. Delivery re-derives the census at `source_commit` and records the delta; this paragraph is a spec-time observation, not a baseline value. The pm-notes corpus is the primary source for ceremony share and cycle time; evidence artifacts are secondary sources for CI observations and incidents.
- `doc/changes/**/chg-*-evidence.md` — 5 files at spec time (`find doc/changes -name 'chg-*-evidence.md' | wc -l` → `5`); a secondary source for CI observations and false-signal incidents.
- Git history — GH-* committer dates run from 2026-02-01 through 2026-10-31 (`git log --format='%ad' --date=short --all --grep='GH-' | sort | sed -n '1p;$p'` → `2026-02-01` / `2026-10-31`). Used for window validation and, where a pm-notes timestamp is absent, only as a stated fallback if the metric definition allows it (it does not for ceremony share/cycle time).
- CI incidents with committed records include GH-170 (PR #191, three root causes), GH-171 (PR #192, local-vs-CI git-history drift), GH-172 (PR #193, "4th/5th local-green/CI-red instance"), GH-173 (PR #194, fresh-checkout/packed-consumer failures), and GH-174 (PR #195, three checks one root cause, later 47/47 green). GH-177 targets the exit-zero false-success class; whether it contributes a distinct incident row is decided by the committed record, not assumed. This is an illustrative list, not the incident count; the delivery curates every committed record under the inclusion rule.
- GH-179's retro records a PM wall-clock skew; this is why the baseline treats pm-notes timestamps as self-reported and states the limitation.

### 24.2 Appendix B — Planned artifact inventory

| Artifact | Status |
|---|---|
| `doc/decisions/ADR-0008-harness-adapter-contract.md` | New |
| `doc/decisions/ADR-0009-release-model-v1.md` | New |
| `doc/decisions/ODR-0002-id-prefix-scheme-and-project-catalog.md` | New |
| `doc/decisions/ODR-0003-cli-command-naming-v1-lock.md` | New |
| `doc/decisions/00-register.md` | New |
| `doc/decisions/00-index.md` | Updated |
| `doc/decisions/README.md` | Updated |
| `doc/planning/oss-tooling/cli-command-registry.md` | Updated (annotation only) |
| `doc/planning/oss-tooling/measurement-baseline.yaml` | New |
| `scripts/checks/forbidden-literals.registry.json` | Updated (data-only `registered` addition; DEC-13) |
| `doc/planning/oss-tooling/README.md` | Updated |
| `doc/planning/concepts/id-prefix-catalog.md` | Updated (status + link) |
| `doc/planning/concepts/agent-primitive-surface.md` | Updated (term pointer) |
| `doc/spec/features/feature-decision-records.md` | Updated (phase 7) |
| `doc/spec/features/feature-measurement-baseline.md` | New (phase 7; `ados_distribution: internal`; registered in the same doc-sync commit) |
| `doc/spec/features/feature-adapter-ports.md` | Updated (pointer) |
| `doc/overview/glossary.md` | Updated |
| `doc/00-index.md` | Updated |

### 24.3 Appendix C — Measurement source families and example anchors

- **Phase data:** pm-notes `phases.<phase>.started` / `.completed` fields after corpus-ingestion normalization (e.g., GH-179's full timestamped phase map; GH-142's YAML-native `datetime` values; GH-46/GH-90/GH-137's YAML-native `date` values); date-only, null/missing, and placeholder zero-time endpoints are excluded and counted, and an unparseable file is a named `unparseable_yaml` row.
- **CI observations:** pm-notes iteration/quality-gate/remediation fields and notes, and evidence artifacts; examples include GH-170's `quality_gates_iterations` red/green entries, GH-171's PR #192 observation, GH-172's PR #193 note, GH-173's PR #194 remediation note, and GH-174's `ci_remediation` entry. Each row cites the artifact and field/anchor.
- **False-signal incidents:** the same artifacts, curated under the class list; each row cites signal vs reality in one short fact. Multiple checks from one root cause are one row.
- **Git history:** GH-* commit dates for window validation; not a substitute for a missing phase timestamp in ceremony share or cycle time.

No `tmp/**`, `.ai/local/**`, uncommitted runner logs, or external URLs are measurement sources.

### 24.4 References

- GitHub issue GH-186 — M0-S17: Decision records and measurement baseline.
- `doc/planning/oss-tooling/backlog.md` — M0-S17 (goal, tasks, AC) and M1-S11, M2-S6, M4-S2.
- `doc/planning/oss-tooling/backlog-ranking.md` — rank 20 (gates M0 exit), rank 54 (M4-S2 depends on M0-S17).
- `doc/planning/oss-tooling/roadmap.md` — "Baselines are captured in M0"; M4 release scope/exit criteria.
- `doc/planning/oss-tooling/cli-command-registry.md` — command surface, naming rules, naming audit, deferred renames.
- `doc/planning/concepts/id-prefix-catalog.md` — grammar, R1–R11, base registry, customization model.
- `doc/planning/concepts/harness-adapters.md`, `agent-primitive-surface.md`, `model-profiles.md`, `adapter-conformance.md`, `embedded-metadata.md`, `harness-telemetry.md`.
- `doc/decisions/ADR-0003-oss-monorepo-structure.md` (DEC-1…DEC-7), `ADR-0005`, `ADR-0007`, `TDR-0003`, `TDR-0004`, `TDR-0005`, `TDR-0006`, `PDR-0002`, `ODR-0001`.
- `doc/decisions/00-index.md`, `doc/decisions/README.md`, `doc/guides/decision-making.md`, `doc/guides/decision-records-management.md`, `.ai/agent/decision-instructions.md`.
- `doc/spec/features/feature-decision-records.md`, `feature-decision-making.md`, `feature-adapter-ports.md`.
- Committed baseline evidence: `doc/changes/**/chg-*-pm-notes.yaml`, `doc/changes/**/chg-*-evidence.md`, and the GH-* git history.

## 25. DOCUMENT HISTORY

| Version | Date | Author | Changes |
|---------|------|--------|---------|
| 1.0 | 2026-10-31 | @spec-writer | Initial specification from GH-186 + backlog M0-S17 + pm-notes clarify decisions; all source claims verified against the current repository at spec time |
| 1.1 | 2026-10-31 | @spec-writer | Amend C-1/AC-C1-1 and the goals/KPI/non-goal/scope text for the data-only forbidden-literal registry registration (DEC-13); add C-10, NFR-10, AC-C10-1, and RSK-10; update §16 and Appendix B; pin the p90 nearest-rank method, the canonical ratio representation, and the `change` field shape (DM-2); AC set now 21 criteria |
| 1.2 | 2026-10-31 | @spec-writer | DoR iteration 1 remediation (B1/S4/S5 + notes): add the normative corpus-ingestion rule in F-4/DM-2 (unparseable-YAML exclusion mirroring `tests/fixtures/pm-notes/corpus-exclusions.json`; YAML-native `date`/`datetime` normalization to ISO-8601; placeholder zero-time handling; closed exclusion vocabulary `unparseable_yaml`, `date_only_or_missing_time`, `placeholder_zero_time`, `capture_change`, `outside_window`, plus `no_ci_observation` as a CI-sample reason; DEC-14); re-derive Appendix A census at HEAD `5a511f4bec4ce2a2fff6e3248b88ecafed34a2ca` with the exact reproducing command (41 files, 40 parseable, 30 time-bearing, 10 date-only, 1 unparseable, 6 placeholder-only); make same-commit registration sequencing normative in §18 (YAML with its baseline commit, feature spec with its doc-sync commit) and align C-10/NFR-10/AC-C10-1; pin `ados_distribution: internal` for the new feature spec (F-6/AC-F6-1/Appendix B); make `feat/GH-186/decision-records-and-measurement-baseline` the authoritative delivery branch and state the intentional slug difference; strengthen C-5, NFR-4, NFR-7, AC-F4-1/AC-F4-3/AC-F4-5, add RSK-11 and glossary terms; AC set remains 21 criteria |

---

## AUTHORING GUIDELINES

- **Sources:** GitHub issue GH-186; backlog M0-S17 and ranking/roadmap; the PM clarify decisions in `chg-GH-186-pm-notes.yaml`; direct reading of the existing decision records, the ID-prefix catalog, the command registry, the harness/primitive concepts, the decision guides, the current-truth feature specs, and the committed pm-notes/evidence corpus.
- **Binding over duplication:** the spec deliberately creates one new register and four new records, and binds the five already-decided topics by ID/anchor (DEC-2, DEC-4). This keeps one source of truth per topic and satisfies the "decisions recorded" AC by inspection.
- **Prospective lock:** the names lock accepts the current surface and performs no renames (DEC-5); the product/brand freeze remains M4-S1. The three deferred naming items are resolved by citing current truth (`provider`, `provider-quota`, `DeliveryRequest`).
- **Measurement honesty:** every metric is defined by formula, unit, window, and source; the corpus is ingested by the normative parse → normalize → classify rule with a closed exclusion vocabulary, so unparseable and placeholder-only files are named and counted rather than dropped or zero-filled; proxies are labeled; partial coverage is counted; missing evidence is `UNAVAILABLE` rather than estimated (DEC-7, DEC-8, DEC-14). Actual numbers are produced in delivery, not in this spec.
- **Bounded index repair:** the two pre-existing defects are repaired in-change (DEC-9) because the index is the inspectability surface; no record body or filename changes.
- **Docs-only with one data exemption:** no code-level instructions; `packages/**` and `tools/**` are unchanged, and the only `scripts/**` edit is the data-only `registered` addition in the forbidden-literal registry (DEC-13); check logic, the seed set, the allowlist, the scope classes, and `corpusBaseline` remain out of scope.

## VALIDATION CHECKLIST

- [x] `change.ref` matches provided `workItemRef` (GH-186)
- [x] `owners` has at least one entry
- [x] `status` is "Proposed"
- [x] All sections present in order (1–25 + guidelines + checklist)
- [x] ID prefixes consistent and unique within category (F-, DM-, C-, NFR-, RSK-, DEC-, OQ-, AC-, NG-, G-)
- [x] Acceptance criteria reference at least one F-/DM-/NFR- ID and use Given/When/Then
- [x] NFRs include measurable values (100%, 0, 8/8, 2/2, exit 0)
- [x] Corpus-ingestion rule is normative, type-aware, and closed (unparseable, date-only/missing-time, placeholder zero-time, capture-change, outside-window; DEC-14)
- [x] Appendix A census is reproducible from the cited command at the cited HEAD SHA, and every cited number was observed
- [x] Registration sequencing is same-commit and the delivery branch name is authoritative
- [x] Risks include Impact & Probability (H/M/L)
- [x] No implementation details (no code-level instructions; doc paths are artifact names)
- [x] Out-of-scope items prefixed `[OUT]`
- [x] Negative constraint AC present (AC-C1-1: zero `packages/**`/`tools/**` changes and the only `scripts/**` change is the data-only registry registration; AC-C10-1 covers registry and seed-literal compliance)
- [x] AC set explicit (21 criteria) and every AC references at least one F-/DM-/NFR- ID
- [x] Front matter validates per front_matter_rules
