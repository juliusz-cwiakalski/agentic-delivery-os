---
id: chg-GH-299-test-plan
status: Updated
version: 1.1
created: 2026-11-16
last_updated: 2026-11-16T23:00:00Z
owners: [Juliusz Ćwiąkalski]
service: delivery-os
labels: [milestone-m2, cli, metrics, measurement, alarms]
version_impact: minor
summary: "Pin the metrics family as one read-only report over delivered evidence: one payload identity `delivery.metrics.v1` with exactly the ten declared keys, a drawn trailing-30-day window from the injected clock and declared `--ref`/`--from`/`--through` grammar with value and grammar refusals before any read; the three baseline-consumed entries consumed by ID with committed `definitionRef`, values scoped by each entry's declared basis (a committed-basis entry recomputes under the committed definition; a native-basis entry computes from its declared native source, is never presented as the committed definition's value, and discloses the proxy-vs-native non-interchangeability; DEC-13), delivered status semantics and closed exclusion counters, a byte-identical baseline log after every invocation, row-absent classification at exit 0 and `metrics.baseline-unreadable` at exit 2; measurement kinds pinned per metric (cycle time native from `phase.transition` history with right-censoring, ceremony share native through the delivered runner fold, CI failure rate proxy recomputed over the committed corpus with `no_ci_observation` exclusions and never an assumed green) with the caveat present exactly on cross-kind comparisons; the comparison view under the committed protocol with `sampleMinimum: 5`, `insufficient-sample` and no trend claim below it; the dispatch block equal to the delivered spend fold for the same selection (SC-M2-S6-01) with breakdown sums equal to totals, exact per-agent sums equal to its totals over the fully attributable seed fixture and equal to the total minus the disclosed unattributable share under null attribution with no invented row (DEC-14), and no re-derivation; burn-rate alarms against the project-committed `metrics.burn-rate` node — exactly one alarm per crossing with ref/basis/threshold/measured/window/crossedAt echoed and byte-identical repeats, `threshold-undeclared` and `telemetry-absent` postures, `config.value.invalid` pre-read refusal for every node defect, and a below-threshold shape that differs only by the alarm row (SC-M2-S6-02); escaped defects as a curated floor over committed artifact-plus-anchor evidence in three closed classes with the caveat verbatim and `UNAVAILABLE` never zero; classified absence on every section with delivered `state.*` identities kept under store damage and no zero-for-absent anywhere; the mount as the twenty-fourth prompt-required family with root and family help, the M2 reference page and the coverage-inventory row, the family-count pins moved 23 → 24 and the stale-count scan arm extended; exactly one error row `metrics.baseline-unreadable` with allowlist 62 → 63, entries 146 → 147, delivered 145 → 146, documented 146 → 147 and sync arithmetic +112 → +113 moving every Appendix D site in the same commit plus a near-miss rejection; and purity, determinism, bounds (65 536-byte data, 200-line/16 384-byte human), the tail-ordered drop sequence comparisons[] → incidents[] → perAgent[] with alarms never dropped, fixed-clock discipline, the declared read budget, and the aggregate gate `TMPDIR=$PWD/tmp/tmpdir pnpm check`."
links:
  change_spec: ./chg-GH-299-spec.md
  implementation_plan: ./chg-GH-299-plan.yaml
  testing_strategy: ../../../../.ai/rules/testing-strategy.md
---

# Test Plan - M2-S6: Metrics and spend (M2)

## 1. Scope and Objectives

The metrics family is the first surface that turns delivered evidence into numbers an owner will act on, and it is read-only over five different sources at once. The failure that matters is therefore not "a command is missing" but a report that *looks* authoritative while one of its figures is unearned: a spend block that quietly re-prices the delivered fold, a ceremony share printed as if it were the committed proxy, a comparison that claims a trend from three changes, a burn-rate alarm that is invented because no threshold was declared or that doubles because evaluation ran twice, an escaped-defect count that reads `0` because nothing was found, an absence rendered as a zero, a dataset re-projected as "empty" because the store was damaged, or a metric entry that restates the log's committed value as if it were a fresh measurement. Each of those would turn a measurement surface into a new anecdote source — which is precisely the pain the change exists to remove.

Every one of them is therefore asserted as a comparison over payload bytes, store bytes, counters, exit codes, and committed text — never as a prose claim. Absence is proven three ways, per house discipline: a paired positive in the same test, a zero counter or empty array read from the payload, and a byte-or-record-count assertion on the source tree.

The plan composes delivered seams rather than inventing new ones: the delivered spend fold for the dispatch block, the delivered telemetry step/baseline record families, the delivered `phase.transition` history, the delivered ceremony measurement fold, the delivered committed comparison builder's protocol (consumed as data, never invoked to author), the delivered config-layer single-document read with its `config.value.invalid` pre-read refusal, the delivered status/verdict/allowlist vocabularies, the delivered result envelope, the delivered state-damage identities, and the delivered mounting unit (prompt set, production composition, help inventory, reference page, coverage row, family-count pins).

This document is a verification map, not an execution claim. No case has been run against a new implementation at authoring time; the `metrics` family does not exist in the delivered tree. Phase ownership belongs to `chg-GH-299-plan.yaml` (phase 4). Every case is authored **failing-first** against the phase that owns it: a red missing command, a red missing `data` key, or a red declared count mismatch before the implementation that makes it green.

All five contract-level findings this plan raised at v1.0 are now closed in specification v1.1 instead of being left to interpretation: the ceremony-share/cycle-time value conflict is resolved by the basis-scoped value rule (DEC-13), the `perAgent` sum posture by attributable-selection scoping (DEC-14), `crossedAt` is pinned to the evaluation's read instant — the trailing window's `end` (DM-4, DEC-5), the comparison view's window posture is declared as render-verbatim with no refusal on window-length grounds (F-4, DM-5), and the acceptance-criterion count is confirmed at 22. §1.2 keeps the finding notes with their resolutions and the residual methodology notes — no open contract question remains — and §8.3 records every `OQ-TP` entry as resolved with its decision pointer. Every case is bound to a declared rule with an owning criterion.

### 1.1 In Scope

- The report surface: `metrics` with the optional `--ref`, `--from`, `--through`, and `--json` flags and no subcommands, one payload identity `delivery.metrics.v1` as a contract constant, exactly the ten declared `data` keys, the closed `metrics[]` vocabulary order, and the declared `omitted`/`truncated` pair (F-1; AC-F1-1; DM-1).
- The drawn evidence window: inclusive `--from`/`--through` bounds, jointly required or jointly omitted, and the drawn trailing 30 days ending at the injected clock's read instant, disclosed in every windowed entry (F-1; AC-F1-1; DM-8; NFR-6).
- Value refusals before any read (`input.value.rejected`, exit `1`) and grammar refusals before any read (`fallback.invocation`, exit `1`), each with a zero read counter and an accepting twin (F-1, F-10; AC-F1-1; §8.3 grammar).
- The three baseline-consumed entries consumed by ID with committed `definitionRef` (log path plus row `source_commit`), the delivered status semantics, closed exclusion reasons with counts, and values scoped by each entry's declared basis — a committed-basis entry (the CI-failure-rate proxy) recomputes under the committed definition and never restates the log's committed value, while a native-basis entry (cycle time, ceremony share) computes from its declared native source, carries `definitionRef` for provenance, is never presented as the committed definition's value, and discloses the proxy-vs-native non-interchangeability; the log byte-identical after every invocation; the fourth log row not surfaced (F-2; AC-F2-1; DM-2; DEC-3, DEC-7, DEC-13; NFR-3).
- Row-absent classification at exit `0` for an absent log or an absent row, and `metrics.baseline-unreadable` at exit `2` for a present-but-unparseable or invalid log with no partial report (F-8; AC-F2-2; DM-7).
- Measurement kinds and disclosure: cycle time native from the transition history under the committed interval with the delivered right-censoring rule; ceremony share native through the delivered runner fold; CI failure rate proxy recomputed under the committed definition over the committed corpus with `no_ci_observation` exclusions and never an assumed green; the caveat present exactly on cross-kind comparisons (F-3; AC-F3-1..AC-F3-4; DM-2, DM-5; DEC-7).
- The comparison view under the committed protocol: committed metric ID and `definitionRef`, before with the log's window/basis/kind/status, after with its window/kind/status/sample size, `sampleMinimum: 5`, the closed verdict set, `insufficient-sample` with no trend claim below the minimum, and no restatement of a committed `comparisons[]` record; every row renders its windows verbatim and is never refused on window-length grounds — the protocol's equal-length requirement governs the owner's comparison claims, not a refusal trigger (F-4; AC-F4-1; DM-5; DEC-3).
- The per-dispatch spend block equal to the delivered fold for the same selection: five-class token totals, cost totals with sparsity, restarts, per-agent roll-ups (exact sum equality to the totals over the fully attributable selection; under null attribution the sum equals the total minus the disclosed unattributable share with no invented row), role/model breakdowns whose token sums equal the full total with the null-value row kept, null-attribution rows preserved, and the reconciliation disclosure cited by reference rather than recomputed (F-5; AC-F5-1; DM-3; DEC-14; `SC-M2-S6-01`).
- Burn-rate alarms: the `metrics.burn-rate` declaration node and its pre-read validation, the windowed evaluation over the same telemetry records, `measured ≥ threshold` crossing, exactly one alarm per crossing with ref/basis/threshold/measured/window/`crossedAt`/sparsity echoed, byte-identical repeats with no persisted alarm state, `threshold-undeclared` and `telemetry-absent` postures, and the below-threshold shape (F-6; AC-F6-1..AC-F6-5; DM-4, DM-6; DEC-4, DEC-5; `SC-M2-S6-02`).
- Escaped defects as a curated floor: three closed classes, artifact-plus-anchor citations, total and per-class counts, the floor caveat verbatim, the `incidents[]` display cap with counted omissions, and `UNAVAILABLE` never zero (F-7; AC-F7-1, AC-F7-2; DM-2; DEC-2).
- Classified absence and damage: no zero for absent evidence on any section, the delivered telemetry-absence condition named verbatim, and delivered `state.*` identities preserved under store damage instead of re-projected as absence (F-8; AC-F8-1; DEC-11).
- Mounting as the twenty-fourth prompt-required family: prompt-set entry, unconditional production composition, root and family help, the M2 reference page serving the coverage check, the coverage-inventory row, and every family-count pin moved 23 → 24 together with the stale-count scan arm (F-9; AC-F9-1; DEC-9).
- Error registration: one `metrics` domain kind with exactly one row, the closed allowlist widened 62 → 63 by exact declaration, entries 146 → 147, delivered 145 → 146, documented 146 → 147, sync arithmetic +112 → +113, every Appendix D site moved in the same commit, the repo-wide no-leftover scan, four-way agreement, and near-miss rejection (F-10; AC-F10-1; DM-7; DEC-8; Appendix D).
- Purity, determinism, bounds, clock discipline, read-only discipline, and read cost: no LLM/network/tracker/provider/credential/timer/socket/session and no write anywhere; byte-identical repeats under four permutations; 65 536-byte machine and 200-line/16 384-byte human caps; row caps; the tail-ordered drop sequence with `alarms[]` never dropped; the injected clock behind every window, censoring flag, and `crossedAt`; the declared read budget and latency reference (F-11; AC-F11-1, AC-F11-2; NFR-1..NFR-8; DEC-10).
- The aggregate gate `TMPDIR=$PWD/tmp/tmpdir pnpm check` before the PR opens (AC-NFR9-1; NFR-9).
- Non-vacuity controls: baseline restatement, caveat dropped or over-applied, trend claim below the minimum, duplicate alarm, invented threshold, unobserved-CI-as-green, zero-filled absence, uncited escaped defect, dropped alarm row under truncation, stale count pin, family-matched allowlist, unmounted family — each with a paired positive twin and a named mutation.

### 1.2 Out of Scope & Known Gaps

- [OUT] Surfacing the baseline's `MET-FALSE-SIGNAL-INCIDENTS` row. §7.2 excludes it; `TC-METRICS-016` asserts its absence from the payload *and* that the log row stays byte-unchanged, so "not surfaced" is proven in both directions rather than assumed.
- [OUT] Any write to `measurement-baseline.yaml`: no value edit, no new row, no authored `comparisons[]` record (NG-1, DEC-3). No case builds a baseline-authoring path; the immutability assertions (`TC-METRICS-012`, `TC-METRICS-032`) prove the write is absent.
- [OUT] Alarm delivery machinery: no notification channel, event topic, subscription, scheduler, daemon, timer, or gate blocking on an alarm (NG-4). `TC-METRICS-100` asserts the absence; no case waits on or subscribes to an alarm.
- [OUT] A native per-run CI failure rate (NG-3, DEC-7). `TC-METRICS-024` asserts the value is a session proxy with the limitation stated and that no per-run claim appears; no case constructs a run-level CI ledger.
- [OUT] A `MET-` allocation for escaped defects (NG-5, DEC-2). `TC-METRICS-060` asserts the entry is the non-`MET-` vocabulary member `escaped-defects` with no `definitionRef`; no case allocates an ID.
- [OUT] Metrics subcommands beyond the single report (NG-6, DEC-12). `TC-METRICS-004` closes the grammar so any declared verb is the `fallback.invocation` refusal, never a second surface.
- [OUT] Changes to delivered spend, telemetry, ceremony, board, or status payload keys, and any change to the ceremony comparison builder or its authored records (NG-7). `TC-METRICS-040`/`041`/`083` assert parity and non-regression; the builder is consumed as data, never called to author.
- [OUT] Quota snapshots (NG-2, DEC-1). No case reads or asserts a quota field; `TC-METRICS-016` covers the payload's closed key set, which leaves no home for one.
- [OUT] Dashboards, charts, exports, or trend storage (NG-9). `TC-METRICS-005` asserts the payload key set; no case persists a report.
- [OUT] Phase-7 current-truth reconciliation prose. The one in-boundary documentation write is the error-table carrier, asserted for row presence, counts, and the allowlist paragraph in `TC-METRICS-090`/`092`.
- [OUT] Commit hygiene and PR posture as permanent assertions (NFR-10, DoD-17). Recorded as gate/review evidence (`TC-METRICS-110`, §10), never asserted by a suite.
- [GAP-T1 — resolved in spec v1.1 (DEC-13): the baseline-consumed value rule is basis-scoped] The v1.0 `AC-F2-1` unscoped rule ("a value recomputed under the committed definition") conflicted with `AC-F3-2`/`AC-F3-1` (`measurementKind: native` from the delivered ceremony fold / transition history) and with GH-296's delivered `nativeBasis` non-interchangeability statement. Spec v1.1 scopes the rule: a committed-basis entry (the CI-failure-rate proxy) recomputes under the committed definition and never restates the log's committed value; a native-basis entry (cycle time, ceremony share) computes from its declared native source (transition history, runner fold), carries `definitionRef` for provenance and the delivered status semantics, is never presented as the committed definition's value, and discloses the proxy-vs-native non-interchangeability (the `AC-F3-4` caveat rule). `TC-METRICS-011` binds the basis-scoped value rule, `TC-METRICS-023` the native ceremony-share source, `TC-METRICS-026` the disclosure.
- [GAP-T2 — resolved in spec v1.1: the comparison view renders windows verbatim and never refuses on window-length grounds] F-4/DM-5 declare the posture: each row carries the log's window and the measured window verbatim, no refusal exists on window-length grounds, and the protocol's equal-length requirement governs the owner's comparison claims (verdict honesty) rather than a command refusal trigger. `TC-METRICS-030`/`032` assert verbatim carriage; `AMB-TP-4` keeps the two fixture window shapes (a 30-day log for the verdict cells and the committed months-long window for the carriage cells).
- [GAP-T3 — the drawn-window constant is asserted, not re-derived] `DM-8` declares "trailing 30 days"; the case asserts the window start equals the read instant minus 30 days exactly on the injected clock and that the constant is imported from contract data (`TC-METRICS-006`). It does not assert a calendar-month interpretation.
- [GAP-T4 — harness seam shapes are delivery-bound] The telemetry, transition, ceremony, log, config, and corpus reads are consumed through injected seams the specification does not name. Cases assert payload, exit, counters, and evidence; a case that cannot resolve its seam **fails naming the missing contract** rather than skipping (`AMB-TP-1`).
- [GAP-T5 — the family-count pins are a scan, not a list of five] The spec names the prompt-required delta (23 → 24) but not every site. The delivered tree pins the count in `tests/structure/entrypoint-bin.test.ts`, `board-mounting`, `events-production-composition`, `dispatch-attempts-composition`, `daemon-production-composition`, `repos-help`, `board-help`, `events-mount-help`, `ceremony-cli`, and derives/scans it in `tests/structure/steer-mounting.test.ts` (whose `PINNING_FILES` list and 23 pins move). `TC-METRICS-080` asserts the delta against one captured base constant **and** a repo-wide scan for a stale `23`, so a site beyond those ten is a delivery finding, not a silent exemption.
- [GAP-T6 — the reference page path is convention, not contract] `AC-F9-1` requires "the metrics reference page" without naming it. The plan binds the delivered M2 convention (`doc/planning/oss-tooling/milestones/m2/commands/metrics.md`) and asserts it through the coverage check (`TC-METRICS-082`), so a different but adequate path fails only the page-locator assertion, not the coverage obligation.
- [GAP-T7 — resolved in spec v1.1 (DEC-14): `perAgent` equality is scoped to fully attributable selections] The delivered fold's `perAgent` roll-up skips records whose `agentRole`/`model` is `null` (the delivered `unattributable-step` state), while the breakdowns keep a `value: null` row and sum to the full total. Spec v1.1 scopes `AC-F5-1`: exact `perAgent`-sum equality to the totals holds over the fully attributable selection (which the `SC-M2-S6-01` seed fixture is); when unattributable steps exist the `perAgent` sum equals the total minus the disclosed unattributable share, the breakdowns keep the null-value row summing to the full total, no row is invented, and the disclosure is named. `TC-METRICS-040` binds the exact-equality half on the seed fixture; `TC-METRICS-042` binds the remainder half under null attribution.

## 2. References

| Reference | Role in this plan |
|---|---|
| [`chg-GH-299-spec.md`](./chg-GH-299-spec.md) v1.1 | Binding source: F-1..F-11, **22 ACs** (`AC-F1-1`, `AC-F2-1`, `AC-F2-2`, `AC-F3-1..4`, `AC-F4-1`, `AC-F5-1`, `AC-F6-1..5`, `AC-F7-1`, `AC-F7-2`, `AC-F8-1`, `AC-F9-1`, `AC-F10-1`, `AC-F11-1`, `AC-F11-2`, `AC-NFR9-1`), DM-1..DM-8, NFR-1..NFR-10, DEC-1..DEC-14, NG-1..NG-9, §6 flows 1–7, §8.3 grammar / contract shape / ordering invariants / exit projection, §14 (all five planning questions closed; DEC-13/DEC-14 fold in this plan's re-opened findings), §16.1 doc impact, §17.1 DoD-1..DoD-17, Appendix B (ticket AC decomposition), **Appendix C (the seed-to-payload mapping inherited literally)**, **Appendix D (D-1..D-13 count-pinning sites, the binding locator list)**. |
| [`chg-GH-299-pm-notes.yaml`](./chg-GH-299-pm-notes.yaml) | Delivery state, the clarify_scope decisions (quota exclusion; escaped-defects definition work), the delivered-dependency verification (GH-236, GH-291, GH-296 landed on `main-tools`), and the delivery conventions (gate command, PR target, commit body width). |
| [`chg-GH-299-plan.yaml`](./chg-GH-299-plan.yaml) | To be authored in phase 4. Phase ownership of these cases is declared there, not here. |
| [`.ai/rules/testing-strategy.md`](../../../../.ai/rules/testing-strategy.md) | Test layers and the module-to-test mapping (`packages/**` → `bun test tests/structure tests/behaviour` + boundary suite + typecheck), invariant-test authoring (no moving-base diffs; goldens regenerate only by explicit command; assert the value's meaning), and the aggregate gate. |
| [`.ai/rules/typescript.md`](../../../../.ai/rules/typescript.md) | Strict types, injected clock and environment, data-only contracts, pure domain, adapters own I/O, injected fakes over `mock.module`. |
| [M2 test scenarios](../../../planning/oss-tooling/milestones/m2/test-scenarios.md) | `SC-M2-S6-01` and `SC-M2-S6-02`, inherited by name and mapped below; neither body is restated. |
| [M2 contracts](../../../planning/oss-tooling/milestones/m2/contracts.md) and [M2 spend command page](../../../planning/oss-tooling/milestones/m2/commands/spend.md) | The telemetry/spend contract continuity and the ownership note (M2-S6 owns the alarm and metric layers). |
| [`measurement-baseline.yaml`](../../../planning/oss-tooling/measurement-baseline.yaml) | The four `MET-` rows this change consumes: `MET-CEREMONY-SHARE` (`duration_ratio_proxy`), `MET-CYCLE-TIME` (`duration_proxy`), `MET-CI-FAILURE-RATE` (`session_proxy`), and the untouched `MET-FALSE-SIGNAL-INCIDENTS`; the fixture log is modelled on its shape, never edited. |
| [`feature-measurement-baseline.md`](../../../spec/features/feature-measurement-baseline.md) | Status semantics, closed exclusion reasons, source-traceability rule, the comparison protocol, immutability (NFR-5), and the `MET-` allocator (ODR-0002). |
| [`feature-spend.md`](../../../spec/features/feature-spend.md) | The delivered fold the dispatch block composes: five-class totals, breakdown-sums-equal-totals, telemetry-absent posture, reconciliation disclosure, bounds and truncation patterns. |
| [`feature-telemetry-v2.md`](../../../spec/features/feature-telemetry-v2.md) | The five attribution dimensions, reading bases (`stream-ingest`, `closeout-capture`, `combined`), null-attribution semantics, aggregate-only privacy. |
| [`feature-ceremony-runner.md`](../../../spec/features/feature-ceremony-runner.md) | The native measurement fold (`foldCeremonyMeasurement`), the committed comparison builder, the no-recompute rule, the sample-minimum honesty scan. |
| [`feature-config-layer.md`](../../../spec/features/feature-config-layer.md) | The project-committed declaration precedent (`<repo>/<configDirectoryName>/config.yaml`), the `verify.suite-map` node shape, absent-means-undeclared, `config.value.invalid` pre-read refusal. |
| [`feature-result-contract.md`](../../../spec/features/feature-result-contract.md) | The in-boundary error-table carrier (F-10, D-13): the kind inventory, the `146 machine identities` / `the same 146 identities` pins, and the exact two-segment allowlist paragraph (`62 declared identities`). |
| [`feature-cli-entrypoint.md`](../../../spec/features/feature-cli-entrypoint.md), [`feature-agents-and-commands.md`](../../../spec/features/feature-agents-and-commands.md) | The prompt-required set (23 families delivered, `steer` the 23rd) and the "composed but not advertised is dropped" rule the mount changes. |
| [`feature-state-layer.md`](../../../spec/features/feature-state-layer.md) | Verified reads, classified damage, and the `state.*` identities the layer must preserve rather than re-project as absence. |
| **Delivered suites consumed as anchors** | `tests/structure/{error-table,dispatch-attempts-taxonomy,verify-gates-suite-map-contract,entrypoint-bin,steer-mounting,board-mounting,events-production-composition,dispatch-attempts-composition,daemon-production-composition,cli-edge-seam,content-inventory,config-contract}.test.ts`; `tests/checks/{error-table-sync,help-guide-coverage,reference-page-parity,exports-parity,prompt-conformance,privacy-literals,forbidden-literals,exit-code-literals,doc-conformance}.test.ts`; `tests/behaviour/{entrypoint-help,board-help,repos-help,events-mount-help,ceremony-cli,spend-breakdown,spend-v2-breakdown,spend-absent,spend-store-damage,spend-determinism,spend-readonly,ceremony-comparison,ceremony-determinism}.test.ts`; `tests/golden/helpers.ts`. |
| **Delivered harness seams reused** | `tests/fixtures/spend/{harness,cases,transitions}.ts`; `tests/fixtures/telemetry/index.ts`; `tests/fixtures/ceremony/{engine,state,declarations,comparison}/**`; `tests/fixtures/state/harness.ts`; `tests/fixtures/projects/{production,state-scope,temp-repos,host-root}.ts`; `tests/fixtures/entrypoint/programs.ts`; `tests/fixtures/help-guide/coverage.json`; `tests/behaviour/verify-support.ts` (`guardStore`, `VerifyCallRecorder`). |

**Inherited scenario seeds.** Both planning seeds are inherited by name and mapped onto the criteria they already assert; neither body is restated. Both map to declared payload paths per spec Appendix C, which this plan inherits literally.

| Seed | Inherited as | Mapping to the spec's criteria (Appendix C) | Cases |
|---|---|---|---|
| `SC-M2-S6-01` — `spend.data.breakdowns.agentRole` and `.model` are non-empty and their token sums equal `spend.data.totals.tokens`; the metric layer reads the same numbers | The spend-parity cell over one seeded temp store, comparing `spend --ref` and `metrics --ref` in the same process | The seed's `breakdowns.agentRole`/`.model` map to the delivered `breakdowns.role`/`.model` arrays and `totals.tokens` to the delivered five-class total; the metrics half is `metrics.data.dispatch` with `perAgent` sums equal to its totals and non-empty role/model arrays for the same selection (`AC-F5-1`); the seed fixture is fully attributable, so the equality is exact there, while the null-attribution case is separated into `TC-METRICS-042` (DEC-14). | `TC-METRICS-040` (seed), `TC-METRICS-042` (null-attribution remainder control) |
| `SC-M2-S6-02` — `metrics.data.alarms` holds exactly one `burn-rate` entry for the ref with the threshold echoed, and no second alarm for the same crossing | The crossing cell plus the repeat-evaluation identity cell | `metrics.data.alarms[]` with `kind: "burn-rate"`, the `ref` and `threshold` echoed (`basis`, `measured`, window bounds, `crossedAt`, cost sparsity beside them), `alarmEvaluation.status == "evaluated"`, and a byte-identical repeat proving no duplicate (`AC-F6-1`, with the below-threshold control in `AC-F6-5`). | `TC-METRICS-050` (seed), `TC-METRICS-055` (below-threshold control) |

Reconciliation note: the seeds are the *minimum*. They do not cover the report grammar, the baseline entries, the measurement kinds and caveat, the comparison protocol, row-absent and damaged baselines, absence and store damage, mounting, error registration, purity, determinism, bounds, or read cost. Those arrive as new cases and are marked as such in §3.4.

## 3. Coverage Overview

Evidence classes below: **Suite** (a committed assertion in `pnpm check`), **Suite + mutation** (a suite assertion whose detection power is proven by a named in-place mutation, used wherever a pin could agree by accident or a refusal could be vacuous), **Golden** (a byte-exact committed artifact), **Quality gate** (an execution record, not a permanent assertion), **Review-verified** (a diff/content inspection recorded in §10).

### 3.1 Functional Coverage (F-#, AC-#)

| AC ID | Criterion (abridged) | TC ID(s) | Evidence class | Status |
|-------|----------------------|----------|----------------|--------|
| AC-F1-1 | A bare `metrics` run exits `0` carrying the active-context `ref`, a `window` drawn to the trailing 30 days ending at the injected clock, the four metric entries in vocabulary order, `dispatch`, `alarmEvaluation`, `comparisons[]`, and `omitted`/`truncated` under `delivery.metrics.v1` with no envelope change; `--from` without `--through` (or either bound malformed) is refused `input.value.rejected` at exit `1` before any read. | TC-METRICS-001, TC-METRICS-002, TC-METRICS-003, TC-METRICS-004, TC-METRICS-005, TC-METRICS-006 | Suite | Covered |
| AC-F2-1 | Each baseline-consumed entry carries its committed `definitionRef` (log path plus row `source_commit`), the delivered status semantics, its closed exclusion reasons with counts, and a value scoped by the entry's declared basis — a committed-basis entry (the CI-failure-rate proxy) recomputes under the committed definition and never restates the log's committed value, while a native-basis entry (cycle time, ceremony share) computes from its declared native source, is never presented as the committed definition's value, and discloses the proxy-vs-native non-interchangeability (DEC-13); the log's values and `comparisons[]` records are byte-identical before and after the invocation. | TC-METRICS-010, TC-METRICS-011, TC-METRICS-012, TC-METRICS-015, TC-METRICS-016, TC-METRICS-112 | Suite + mutation | Covered |
| AC-F2-2 | A baseline log absent from the checkout classifies the baseline-consumed entries as row-absent evidence with no values and still exits `0`; a log that exists but cannot be parsed or validated is refused `metrics.baseline-unreadable` at exit `2` with no partial report. | TC-METRICS-013, TC-METRICS-014, TC-METRICS-015 | Suite | Covered |
| AC-F3-1 | Cycle time derives natively from the delivered `phase.transition` history under the committed interval (`clarify_scope.started` → `pr_creation.completed`); an absent completion is right-censored with the flag set and the latest completed phase used; `measurementKind` is `native`, `basis` is `phase-transition-history`; no usable pair yields `UNAVAILABLE`, never zero. | TC-METRICS-020, TC-METRICS-021, TC-METRICS-022 | Suite + mutation | Covered |
| AC-F3-2 | Ceremony share derives from the delivered ceremony measurement fold (runner-derived run/step/phase counts) with `measurementKind` `native` and `basis` `ceremony-runner-fold`; a window with no ceremony runs classifies `UNAVAILABLE` with `sample.n == 0` named. | TC-METRICS-023 | Suite | Covered |
| AC-F3-3 | CI failure rate is recomputed under the committed definition (red-or-mixed numerator over observed denominator) with `measurementKind` `proxy`, the session-proxy limitation stated, unobserved rows excluded with the closed `no_ci_observation` reason and never assumed green, and no per-run rate claimed. | TC-METRICS-024, TC-METRICS-025 | Suite + mutation | Covered |
| AC-F3-4 | Any comparison whose before and after measurement kinds differ carries the caveat in the comparison row and in the owning metric entry; a same-kind comparison applies the protocol without the caveat — present exactly on cross-kind disclosure. | TC-METRICS-026, TC-METRICS-112 | Suite + mutation | Covered |
| AC-F4-1 | Each comparison row carries the committed metric ID and `definitionRef`, the log's before value with its window/basis/kind, the after value with its window/kind/sample size, `sampleMinimum: 5`, and a verdict from the delivered closed set; a sample below 5 yields `insufficient-sample` with no trend claim anywhere in the payload; the log stays byte-identical. | TC-METRICS-030, TC-METRICS-031, TC-METRICS-032, TC-METRICS-033, TC-METRICS-112 | Suite + mutation | Covered |
| AC-F5-1 | `spend --ref` reports non-empty `breakdowns.role`/`breakdowns.model` with token sums equal to the delivered total, and `metrics.data.dispatch` carries the same figures for the same selection — over the fully attributable selection (the `SC-M2-S6-01` seed fixture) `perAgent` sums equal its totals, and with unattributable steps the `perAgent` sum equals the total minus the disclosed unattributable share with the breakdowns keeping the null row and summing to the full total and no row invented (DEC-14); role and model arrays non-empty, `tokensByClass`/`costTotals` (with sparsity)/`restarts` equal to the fold's values, nothing re-derived or re-priced. (`SC-M2-S6-01`.) | TC-METRICS-040, TC-METRICS-041, TC-METRICS-042 | Suite | Covered |
| AC-F6-1 | A declared threshold with measured spend at or above it produces exactly one `burn-rate` alarm echoing the ref with `basis`, `threshold`, `measured`, window bounds, `crossedAt`, and cost sparsity when present; `alarmEvaluation.status` is `evaluated`; a repeat evaluation over unchanged facts is byte-identical with still exactly one entry. (`SC-M2-S6-02`.) | TC-METRICS-050, TC-METRICS-051, TC-METRICS-056, TC-METRICS-112 | Suite + mutation | Covered |
| AC-F6-2 | With no `metrics.burn-rate` node, `alarmEvaluation.status` is `threshold-undeclared` with no threshold, basis, or window echoed, `alarms[]` is empty, no default is invented, and the rest of the report is unaffected at exit `0`. | TC-METRICS-052 | Suite | Covered |
| AC-F6-3 | A ref with no telemetry but other evidence declares the classified telemetry absence with no dispatch figures, `alarmEvaluation.status` is `telemetry-absent` with no alarm, and the transition-history, corpus, and ceremony metrics still report measured values at exit `0`. | TC-METRICS-053 | Suite | Covered |
| AC-F6-4 | A malformed `metrics.burn-rate` node (non-positive threshold, unknown basis, out-of-range or non-conforming window) is refused `config.value.invalid` at exit `1` before any telemetry or log read. | TC-METRICS-054 | Suite + mutation | Covered |
| AC-F6-5 | With a declared threshold and measured spend below it, `alarms[]` is empty, `alarmEvaluation.status` is `evaluated` with the threshold echoed, and the below-threshold shape differs from the crossing case only by the alarm row — the absence of an alarm is declared, not silent. | TC-METRICS-055, TC-METRICS-051 | Suite | Covered |
| AC-F7-1 | Each counted escaped defect within the window cites a committed artifact path plus anchor and carries one of the three closed classes; the entry reports total and per-class counts with the floor caveat stated verbatim, and no incident without an artifact-plus-anchor citation is counted. | TC-METRICS-060, TC-METRICS-062, TC-METRICS-063, TC-METRICS-112 | Suite + mutation | Covered |
| AC-F7-2 | A window with no committed evidence of any of the three classes yields an absent value with status `UNAVAILABLE` and the absence named — never a zero count presented as a measurement. | TC-METRICS-061 | Suite | Covered |
| AC-F8-1 | No section renders a zero for absent evidence: metric entries use the delivered status semantics or row-absent classification, the dispatch block names the delivered telemetry-absence condition, and the evaluation declares its unavailability; store damage on any read fires the delivered `state.*` identity with its own projection and is never re-projected as absence. | TC-METRICS-070, TC-METRICS-071, TC-METRICS-072, TC-METRICS-112 | Suite + mutation | Covered |
| AC-F9-1 | Root `--help` lists `metrics` as a registered family among 24 families (delivered base 23, `steer` the 23rd); `metrics --help` answers at exit `0` with summary, usage, options, at least one example, exit codes, and a see-also pointer; the metrics reference page exists, mentions `--help` and `--version`, the coverage inventory carries the metrics row, and the coverage check reports zero failures. | TC-METRICS-080, TC-METRICS-081, TC-METRICS-082, TC-METRICS-083 | Suite + mutation | Covered |
| AC-F10-1 | (a) The closed two-segment allowlist contains exactly the one `metrics.baseline-unreadable` code and no other `metrics.*` code (62 → 63, exact declaration, no pattern or family widening); (b) every Appendix D count-pinning site moves to its post-change value in the same commit (146 → 147 entries; 145 → 146 delivered; 62 → 63 allowlist; 146 → 147 documented; `BASELINE_ROWS.length + 112` → `+113`); (c) the repo-wide no-leftover scan with its legacy-token list extended by 146, 145, 62, and `+112` finds no leftover pin; (d) classifier, sync check, structural mirror, and carrier agree on the same numbers, and a near-miss two-segment `metrics.*` code is rejected rather than family-matched. | TC-METRICS-090, TC-METRICS-091, TC-METRICS-092, TC-METRICS-112 | Suite + mutation | Covered |
| AC-F11-1 | No LLM call, no network request, no tracker or provider read or write, no timer, daemon, or listener, no control socket, no session operation, no hardcoded product or binary name, and no byte written to any store, log, or document. | TC-METRICS-100, TC-METRICS-111 | Suite | Covered |
| AC-F11-2 | Two runs over unchanged facts produce byte-identical human text and machine `data` (envelope timing and run id aside); every array follows its declared order; at the declared caps the 65 536-byte `data` cap, the 200-line / 16 384-byte human cap, the row caps, and the tail-ordered truncation sequence (`comparisons[]` → `incidents[]` → `perAgent[]`) hold with every drop counted in `omitted` and `truncated` set, and `alarms[]` is never dropped. | TC-METRICS-101, TC-METRICS-102, TC-METRICS-103, TC-METRICS-104, TC-METRICS-105, TC-METRICS-112 | Suite + mutation | Covered |
| AC-NFR9-1 | `TMPDIR=$PWD/tmp/tmpdir pnpm check` is green before the PR opens. | TC-METRICS-110 | Quality gate | Covered |

All 22 acceptance criteria are mapped; none is unmapped, `TODO`, or AC-less. Capability coverage is transitive and complete: F-1 → 001–006; F-2 → 010–016; F-3 → 020–026; F-4 → 030–033; F-5 → 040–042; F-6 → 050–056; F-7 → 060–063; F-8 → 013, 014, 070–072; F-9 → 080–083; F-10 → 090–092; F-11 → 100–106, 111.

### 3.2 Interface Coverage (DM-#, command surface, registries)

The spec declares no `API-` or `EVT-` identifiers (§8.1: no HTTP surface; §8.2: no new event topic, kind, or payload). The interfaces under test are the machine payloads, the command grammar, the configuration node, the help and coverage registries, the family count, and the error table.

| Interface element | Observable contract | TC ID(s) |
|---|---|---|
| DM-1 report payload | `data` carries exactly `ref`, `window {from, through}`, `metrics[]`, `dispatch`, `alarms[]`, `alarmEvaluation`, `comparisons[]`, `omitted` (integer), `truncated` (boolean); `delivery.metrics.v1` is a declared contract constant and never a `data` key; `metrics[]` in the closed vocabulary order. | TC-METRICS-001, TC-METRICS-005, TC-METRICS-016 |
| DM-2 metric entry | `id` (closed `MET-CEREMONY-SHARE \| MET-CYCLE-TIME \| MET-CI-FAILURE-RATE \| escaped-defects`), `value` absent when unavailable and scoped by the entry's basis — committed-basis entries recompute under the committed definition, native-basis entries compute from the declared native source and are never presented as the committed definition's value, with the non-interchangeability disclosed via `caveat` (DEC-13); `status` (`MEASURED \| PARTIAL \| UNAVAILABLE`), `measurementKind` (`native \| proxy \| curated-count`), `basis`, `unit`, `direction`, `sample {n}` plus conserved counters, `definitionRef` (absent for `escaped-defects`), `excluded[] {reason, count}` over the closed set, `limitation`, `caveat` exactly on cross-kind, `incidents[]` for escaped defects. | TC-METRICS-010, TC-METRICS-011, TC-METRICS-020, TC-METRICS-023, TC-METRICS-024, TC-METRICS-026, TC-METRICS-060, TC-METRICS-070 |
| DM-3 dispatch block | `telemetryState` (`present \| absent`); over present telemetry the delivered fold's `tokensByClass`, `costTotals` (total, per-model, `sparse`), `restarts`, `perAgent[]` (role/model/calls/tokens — exact sum equality to the totals over a fully attributable selection; under null attribution the sum equals the total minus the disclosed unattributable share with no invented row; DEC-14), `breakdowns` (role/model arrays keeping the null-value row so their token sums equal the full total on every selection, delivered ordering, null row last); absent telemetry names the delivered absence condition verbatim with `absenceReason` and no figures; reconciliation cited by reference. | TC-METRICS-040, TC-METRICS-041, TC-METRICS-042, TC-METRICS-053, TC-METRICS-070 |
| DM-4 alarm and evaluation | `alarms[]` entry `{kind: "burn-rate", ref, basis, threshold, measured, window {start, end}, crossedAt, sparse?}` with `crossedAt` the evaluation's read instant, identical to the trailing window's `end` (DM-4, DEC-5), at most one per ref per evaluation; `alarmEvaluation {kind: "burn-rate", status: evaluated \| threshold-undeclared \| telemetry-absent}` with threshold/basis/window echoed only over `evaluated`. | TC-METRICS-050, TC-METRICS-051, TC-METRICS-052, TC-METRICS-053, TC-METRICS-055, TC-METRICS-056 |
| DM-5 comparison row | `{metricId, definitionRef, before {value, window, basis, measurementKind, status}, after {value, window, measurementKind, status, sampleSize}, sampleMinimum: 5, verdict (closed five), caveat exactly when kinds differ}`; both windows render verbatim regardless of window-length equality and no refusal exists on window-length grounds (the equal-length rule governs comparison claims); derived at read time, never written. | TC-METRICS-026, TC-METRICS-030, TC-METRICS-031, TC-METRICS-032, TC-METRICS-033 |
| DM-6 threshold declaration | The project-committed document's additive `metrics.burn-rate` node, schema `delivery.metrics.burn-rate.v1`, members `threshold` (positive number), `basis` (`cost \| tokens`), `window` (`<positive-integer>d`, 1..90); absent means undeclared; every defect refused `config.value.invalid` before any read; no delivered node or layer behaviour changes. | TC-METRICS-052, TC-METRICS-054, TC-METRICS-090 |
| DM-7 error identities | One `metrics` row `metrics.baseline-unreadable` (platform, non-retryable, `not_landed`, `platform-provider` → exit `2`); allowlist 62 → 63 by exact two-segment declaration; entries 146 → 147, delivered 145 → 146, documented 146 → 147, sync `+112` → `+113`; kind-only lookup contained by `fallback.internal`. | TC-METRICS-014, TC-METRICS-090, TC-METRICS-091, TC-METRICS-092 |
| DM-8 bounds and truncation | `data` ≤ 65 536 UTF-8 bytes; human ≤ 200 lines / 16 384 bytes; inclusive ISO window bounds jointly required or omitted; drawn default trailing 30 days; threshold window 1..90 days; `incidents[]` ≤ 8; `perAgent[]` and `comparisons[]` ≤ 20; tail-first drop order `comparisons[]` → `incidents[]` → `perAgent[]`, every drop counted, `alarms[]`/`alarmEvaluation`/`ref`/`window`/metric entries never dropped. | TC-METRICS-003, TC-METRICS-063, TC-METRICS-102, TC-METRICS-103, TC-METRICS-104 |
| Command grammar | Optional `--ref`, `--from`, `--through`, and `--json` flags over a positional-free surface, with no subcommands; malformed/unresolvable ref, malformed or lone window bound, and a missing flag value are `input.value.rejected` at exit `1` before any read; an undeclared flag or unexpected positional is `fallback.invocation` at exit `1` before any read. | TC-METRICS-003, TC-METRICS-004 |
| Exit projection (§8.3) | Seven declared rows: report produced (including classified absences) → exit `0`; value violation → `input.value.rejected` exit `1`; grammar violation → `fallback.invocation` exit `1`; damaged baseline → `metrics.baseline-unreadable` exit `2`; node defect → `config.value.invalid` exit `1`; store damage → delivered `state.*` with its own projection; unclassifiable/kind-only → `fallback.internal` exit `2`. | TC-METRICS-005, TC-METRICS-014, TC-METRICS-054, TC-METRICS-071, TC-METRICS-091 |
| Ordering invariants (§8.3) | `metrics[]` by the closed vocabulary order; `alarms[]` at most one per evaluation; `comparisons[]` by the same vocabulary order restricted to committed row IDs; breakdown arrays by tokens descending, value ascending, null row last; no ordering influenced by store, log, or filesystem return order. | TC-METRICS-001, TC-METRICS-040, TC-METRICS-042, TC-METRICS-101 |
| Prompt-required composition and family count | `metrics` is the twenty-fourth member of the exact set the entrypoint composes (delivered base 23, `steer` the 23rd), composed unconditionally; every family-count pin and the stale-count scan arm move 23 → 24; no other family's composition or help changes. | TC-METRICS-080, TC-METRICS-083 |
| `metrics --help` and `--version` | Served from the static help inventory at exit `0` with summary, usage, options, at least one example, exit codes, and a see-also pointer; no state, store, git, network, or configuration read. | TC-METRICS-081 |
| Coverage inventory and reference page | `tests/fixtures/help-guide/coverage.json` carries the metrics command row and page path; the M2 page exists and mentions `--help` and `--version`; `runHelpGuideCoverage()` returns no failures. | TC-METRICS-082 |
| Error-table registration and closed allowlist | `ERROR_TABLE` gains exactly one `metrics` row and `DOMAIN_KINDS` gains `metrics`; both allowlist copies hold exactly 63 members of which exactly one is `metrics.*`; all D-1..D-13 sites move in the same commit; no-leftover scan and four-way agreement 147 / 146 / 63 / 1 metrics / 147 documented. | TC-METRICS-090, TC-METRICS-091, TC-METRICS-092 |
| Read cost (§NFR-7) | ≤ 1 verified read per telemetry record family, ≤ 1 transition-history read, ≤ 1 ceremony-record read, ≤ 1 baseline-log read, ≤ 1 config-node read, ≤ 1 bounded corpus scan; 0 reads beyond the declared sources. | TC-METRICS-106 |

### 3.3 Non-Functional Coverage (NFR-#)

| NFR ID | Requirement (threshold) | TC ID(s) | Notes |
|--------|-------------------------|----------|-------|
| NFR-1 | 0 new top-level envelope keys; 0 `ok`/`command` fields anywhere. | TC-METRICS-005 | Envelope key-set diff on every exit form plus an explicit `ok`/`command` scan of the serialized payload. |
| NFR-2 | 2 of 2 runs byte-identical in human text and JSON `data` (timing/run id excluded); 0 undeclared order sources. | TC-METRICS-101 | Four permutation fixtures: store row order, directory-read order, log row order, corpus scan order. |
| NFR-3 | 0 writes, 0 fences acquired, 0 log edits; byte-snapshot proof over every read source. | TC-METRICS-012, TC-METRICS-100, TC-METRICS-071 | Byte snapshots of the baseline log, the config document, ceremony records, evidence artifacts, and every state scope; fence/append recorders armed. |
| NFR-4 | `data` ≤ 65 536 bytes; human ≤ 200 lines / 16 384 bytes; incidents ≤ 8; perAgent and comparisons ≤ 20; every drop counted with `truncated`; `alarms[]` never truncated. | TC-METRICS-102, TC-METRICS-103, TC-METRICS-104, TC-METRICS-063 | Byte measurement on the serialized `data` (not the envelope); at-cap twin beside every over-cap cell; the never-dropped set asserted on a payload where the cap binds *and* an alarm exists. |
| NFR-5 | 0 LLM calls; 0 network requests; 0 provider or tracker reads/writes; 0 timers/loops/sockets; 0 hardcoded product or binary names. | TC-METRICS-100, TC-METRICS-111 | Recording ports on transport/tracker/provider/credential/timer/socket seams; brand-seam swap; import-set assertion; hermeticity scan fails on a planted violation or a skip. |
| NFR-6 | 0 ambient wall-clock reads in the pure domain; every window and timestamp reproducible from a fixed clock. | TC-METRICS-006, TC-METRICS-021, TC-METRICS-105 | Fixed clock advanced by stated deltas; window start/end, censoring, and `crossedAt` recomputed from the fixture clock; the ambient-globals guard runs on the new modules. |
| NFR-7 | The declared read budget and the latency reference (p95 ≤ 500 ms at 1 000 records, ≤ 2 s at 10 000). | TC-METRICS-106 | Counting wrappers on every seam; the duration reading is reported as a non-gating reference measurement with the fixture size printed. |
| NFR-8 | 0 kind-only `metrics` resolutions; a kind-only discriminant is contained by `fallback.internal`. | TC-METRICS-091 | `classifyDomainKind("metrics")` throws; `classifyThrown({kind: "metrics", code})` yields `fallback.internal`; exact code resolution succeeds only for the one code. |
| NFR-9 | `TMPDIR=$PWD/tmp/tmpdir pnpm check` green before the PR opens. | TC-METRICS-110 | Recorded in §10 and pm-notes `notes:`. |
| NFR-10 | Conventional subjects via the commit primitive; every body/footer line ≤ 100 characters. | TC-METRICS-110 (recorded) | Verified by the phase-9 range lint gate and CI `ts-commitlint`; PM-owned, not a permanent assertion here. |

### 3.4 Coverage-Matrix Integrity

- **Counts.** 22 ACs → 58 cases. Every AC appears in at least one row of §3.1; every case appears in at least one row of §3.1, §3.2, or §3.3 (no orphan). Every case id appears exactly once in §5.1, exactly once in §5.2, and exactly once in §7.
- **NFR-only cases.** `TC-METRICS-106` is bound to NFR-7 and `TC-METRICS-111` to NFR-5/AC-F11-1; neither is orphaned because both appear in §3.3 (and 111 also in §3.1). Every other case carries at least one `AC-` id.
- **Seed-derived cases** carry their seed id in `Related IDs`: `TC-METRICS-040` (`SC-M2-S6-01`), `TC-METRICS-042` (the seed's totals control), `TC-METRICS-050` (`SC-M2-S6-02`), `TC-METRICS-055` (its below-threshold control). All other cases are new in this plan.
- **Ticket-AC binding.** Appendix B maps the single ticket AC ("exit criteria measurable with committed numbers") across F-1/F-2/F-3/F-4/F-5/F-6/F-7. Its executable rows: `TC-METRICS-001`/`010`/`011` (one invocation, committed sources), `020`–`026` (each figure carries basis, kind, window, sample), `060` (escaped defects grounded in committed evidence), `030`/`031` (trend claims gated), `040` (per-dispatch parity), `050` (cost drift measurable). A ticket AC with no green case in its row is a red DoD row, not a partial pass.
- **DoD binding.** DoD-1 → 001–006; DoD-2 → 010–012; DoD-3 → 013–015; DoD-4 → 020–025; DoD-5 → 026; DoD-6 → 030–033; DoD-7 → 040–042; DoD-8 → 050, 056; DoD-9 → 051–055; DoD-10 → 060–063; DoD-11 → 070–072 (plus every phase gate); DoD-12 → 080–083; DoD-13 → 090–092; DoD-14 → 100–106, 111; DoD-15 → this section; DoD-16 → 110; DoD-17 → §10 (PR record, PM-owned).
- **No moving-base assertions.** No case asserts a diff against `origin/main-tools`. Where the spec asks for "unchanged" (the delivered fold, the delivered envelope, other families' composition), the case asserts a tree invariant: a committed golden, a closed key set, a byte snapshot, or a set-equality against a declared constant.
- **Negative controls are first-class.** Every block carries at least one paired control: an accepting twin for each refusal, a measured twin for each absence, an under-cap twin for each cap, a same-kind row for each caveat row, a below-threshold twin for each crossing, an at-limit valid node for each defect, a registered-family twin for each mounting mutant. Block L cases are mutant proofs; they assert *detection power* rather than the property itself and are not duplicates of blocks A–K.
- **Failing-first discipline.** Each case names the observable that is red before its owning phase exists (missing command → `fallback.invocation`; missing `data` key → key-set mismatch; missing row → count mismatch at 146/62; missing page → coverage failure). A case that is green before its phase is a non-vacuity defect and is recorded as such.

### 3.5 Declared test-methodology substitutions

No contract question is open in the specification: §14 records OQ-1..OQ-5 closed and folds this plan's re-opened findings in as DEC-13 and DEC-14, with two review pins applied in place (`crossedAt` at DM-4/DEC-5; the comparison view's render-verbatim window posture at F-4/DM-5), and every AC names its verification path. The entries below are about **how a property is measured**, not about what the contract says; §8.3 records every `OQ-TP` entry as resolved.

| ID | Substitution | Where handled |
|----|--------------|---------------|
| `AMB-TP-1` | **Harness seam shapes are delivery-bound.** The telemetry, transition, ceremony, log, config, and corpus reads are consumed through injected seams the specification does not name. Cases assert payload, exit, counters, and evidence; a case that cannot resolve its seam **fails naming the missing contract** rather than skipping. Behaviours, identities, closed vocabularies, bounds, AC traceability, the family-count delta, and the truncation order are not delivery-bound. | all behaviour cases |
| `AMB-TP-2` | **The human render is asserted as a maximum plus markers, not as a fixed line layout.** `DM-8` declares ≤ 200 lines / 16 384 bytes; the cases assert the caps, the counted-omission markers, presence of each declared section label, and a golden for the six declared forms. A future layout change that keeps the budget and the counts passes. | `TC-METRICS-102`, `TC-METRICS-101` |
| `AMB-TP-3` | **`crossedAt` is the evaluation's read instant and therefore the declared window's `end`.** DM-4 and DEC-5 pin the derivation: the alarm's `crossedAt` is the read instant, identical to the trailing window's `end` bound. The case asserts equality with the injected clock read instant and with `window.end` on every cell, so an implementation that reads any other source (ambient clock, stored first-crossing time) fails. A declared pin, not an interpretation. | `TC-METRICS-050`, `TC-METRICS-105` |
| `AMB-TP-4` | **Both fixture window shapes are exercised, and the view never refuses on window-length grounds.** F-4/DM-5 declare that comparison rows carry their windows verbatim and that no refusal exists on window-length grounds; the protocol's equal-length requirement governs the owner's comparison claims. The fixture baseline log therefore declares a 30-day window for the verdict cells, and a second fixture log keeps the committed months-long window to prove verbatim carriage with no refusal and no equal-length claim. | `TC-METRICS-030`, `TC-METRICS-032` |
| `AMB-TP-5` | **The metrics reference page path is the delivered M2 convention.** `doc/planning/oss-tooling/milestones/m2/commands/metrics.md`, asserted through the coverage check; the coverage obligation, not the path spelling, is the contract (`GAP-T6`). | `TC-METRICS-082` |

## 4. Test Types and Layers

| Layer | Runner / invocation | Location | Covers |
|-------|--------------------|----------|--------|
| Contract, vocabulary, bounds constants | `bun test tests/structure` | `tests/structure/metrics-contract.test.ts` (new); `tests/structure/config-contract.test.ts` (update); `tests/structure/{content-inventory,cli-edge-seam}.test.ts` and `tests/checks/exports-parity.test.ts` (unchanged — must stay green) | TC-METRICS-005, 016, 054 (constants half), 090 (kind half), 102 (constants half) |
| Boundary, purity and confinement | `bun test tests/structure tests/boundaries`; `bun run scripts/checks/ambient-globals.ts`; `bun run check:boundaries` | `tests/structure/metrics-imports.test.ts` (new); `tests/boundaries/*` (existing, unchanged) | TC-METRICS-100 (static half), 105 (ambient-clock half) |
| Mounting and family count | `bun test tests/structure tests/behaviour` | `tests/structure/metrics-mounting.test.ts` (new); `tests/structure/{entrypoint-bin,steer-mounting,board-mounting,events-production-composition,dispatch-attempts-composition,daemon-production-composition}.test.ts` (update); `tests/behaviour/{repos-help,board-help,events-mount-help,ceremony-cli}.test.ts` (update) | TC-METRICS-080, 083 |
| Help and coverage | `bun test tests/behaviour tests/checks`; `bun run scripts/checks/help-guide-coverage.ts` | `tests/behaviour/metrics-help.test.ts` (new); `tests/checks/help-guide-coverage.test.ts`, `tests/checks/reference-page-parity.test.ts` (additive assertions); `tests/fixtures/help-guide/coverage.json` (update) | TC-METRICS-081, 082 |
| Error identity and sync | `bun test tests/structure tests/checks`; `bun run scripts/checks/error-table-sync.ts` | `tests/structure/error-table.test.ts`, `tests/checks/error-table-sync.test.ts`, `scripts/checks/error-table-sync.ts` (update); `tests/structure/{dispatch-attempts-taxonomy,verify-gates-suite-map-contract}.test.ts` (update) | TC-METRICS-090, 091, 092 |
| Behaviour — report surface and grammar | `bun test tests/behaviour` | `tests/behaviour/{metrics-report,metrics-grammar,metrics-envelope}.test.ts` (new) | TC-METRICS-001–006 |
| Behaviour — baseline consumption and damage | `bun test tests/behaviour` | `tests/behaviour/{metrics-baseline,metrics-baseline-damage}.test.ts` (new) | TC-METRICS-010–016 |
| Behaviour — measurement kinds | `bun test tests/behaviour` | `tests/behaviour/{metrics-cycle-time,metrics-ceremony-share,metrics-ci-proxy,metrics-caveat}.test.ts` (new) | TC-METRICS-020–026 |
| Behaviour — comparison view | `bun test tests/behaviour` | `tests/behaviour/metrics-comparisons.test.ts` (new) | TC-METRICS-030–033 |
| Behaviour — dispatch parity | `bun test tests/behaviour` | `tests/behaviour/metrics-dispatch.test.ts` (new); delivered `spend-*` suites read-only anchors | TC-METRICS-040–042 |
| Behaviour — alarms | `bun test tests/behaviour` | `tests/behaviour/{metrics-alarms,metrics-burn-rate-config}.test.ts` (new) | TC-METRICS-050–056 |
| Behaviour — escaped defects | `bun test tests/behaviour` | `tests/behaviour/metrics-escaped-defects.test.ts` (new) | TC-METRICS-060–063 |
| Behaviour — absence, damage, zero-fabrication | `bun test tests/behaviour` | `tests/behaviour/{metrics-absence,metrics-store-damage}.test.ts` (new) | TC-METRICS-070–072 |
| Behaviour — determinism, bounds, clock, cost | `bun test tests/behaviour` | `tests/behaviour/{metrics-determinism,metrics-bounds,metrics-read-cost}.test.ts` (new) | TC-METRICS-101–106 |
| Behaviour — purity and write discipline | `bun test tests/behaviour` | `tests/behaviour/{metrics-purity,metrics-write-discipline}.test.ts` (new) | TC-METRICS-012, 100 |
| Golden | `bun test tests/golden` | `tests/golden/metrics.test.ts` + `tests/fixtures/metrics/golden/**` (new; six forms + `regenerate.ts`) | TC-METRICS-101 (golden half), 001, 050, 052, 053, 055 |
| Mutant meta-suite | `bun test tests/checks` | `tests/checks/metrics-mutants.test.ts` (new; extends the `spend-mutants`/`steer-mutants` pattern) | TC-METRICS-112 |
| Hermeticity | `bun test tests/checks` | `tests/checks/metrics-hermetic.test.ts` (new; the `ceremony-hermetic`/`action-hermetic` pattern) | TC-METRICS-111 |
| Aggregate and non-regression | `TMPDIR=$PWD/tmp/tmpdir pnpm check` | repo root; unchanged gate chain (`lint → format:check → typecheck → test → check:boundaries`) | TC-METRICS-110 and every case's regression half |

- **Not used:** `mock.module` substitution of the modules under test; live network; live credentials; real sleeps or timers; the live tree or `$HOME` as state; child-process CLI invocations where an in-process composition proves the same property. Fakes are injected ports (clock, run id, telemetry read, transition read, ceremony read, log read, config-node read, corpus scan, brand) — never a mock of the evaluation, the comparison protocol, the caveat rule, or the truncation order.
- **Boundaries:** one new command family inside the existing `cli` tier and new contract/domain modules inside the existing `core` tier; no new cross-package edge expected (ADR-0003). `check:boundaries` and the fixture-coverage meta-check run inside the aggregate gate; if delivery declares a new `workspaceImports` edge, its negative fixture lands in the same change.

### 4.1 Fixture and Harness Contract (binding for every metrics case)

1. **No real state directory, tracker, network, credential, or spawned process.** Every suite imports production modules and injects fakes plus a per-test temp root created through `tests/fixtures/state/harness.ts`; the delivered fixture guard rejects the live workspace and the real home-derived state directory before anything is written.
2. **A skip never counts as a pass.** No `test.skip`, `describe.skip`, `test.todo`, or conditional early return in a permanent suite; `tests/checks/metrics-hermetic.test.ts` fails on a planted skip and on any skip inside the new suites (mirroring `ceremony-hermetic.test.ts`).
3. **Seeded temp stores through the production write seams.** Telemetry step/baseline records, `phase.transition` records, and ceremony run/step records are appended through the same boundary builders the production writers use (or fixture builders composing them), so every read validates records a writer could have produced. Each store is per-test; nothing is written outside its `mkdtemp` root.
4. **Injected clock is the only time source.** A fixed `NOW_MS` per case; window cases advance the clock by explicit deltas; censoring and `crossedAt` are recomputed from the fixture clock; no `Date.now()` in any new module (the ambient-globals guard plus a read recorder prove it).
5. **Injected identifiers and brand.** Run ids and fence tokens are fixed sequences (`run-metrics-*`, `fence-metrics-*`); the brand is the synthetic brand constant from `tests/golden/helpers.ts`; human-output assertions never contain a product literal.
6. **Independent oracles.** Expected values — cycle-time intervals, ceremony shares, CI ratios, token sums, alarm thresholds, omission counters, and byte lengths — are computed in each test from hand-written fixture constants, never by calling the production fold and never by re-summing the array the production code sums. The comparison `before` values come from the fixture log text, not from the report.
7. **Recorded arguments over inference.** Where a criterion concerns what a seam received (which source was read, whether a write was attempted, whether a network or model call was attempted), the case asserts the recorded argument or the recorded absence (`VerifyCallRecorder`/`guardStore` pattern).
8. **Fixture privacy.** Every new fixture passes `tests/checks/fixture-privacy.test.ts`: synthetic owners, refs, artifact paths, and corpus rows; no real ticket, credential, or personal data.
9. **Committed corpus discipline.** The CI-proxy and escaped-defect fixtures are *committed-path-shaped* documents in the fixture tree (never `tmp/**`, `.ai/local/**`, or an uncommitted path) so the "committed evidence only" rule is exercised rather than described; the negative cells plant a `tmp/` path, an `.ai/local/` path, and an uncited row and assert they are not counted.

### 4.2 Non-Vacuity Contract (binding for every refusal, absence, bound, and formula case)

1. **A planted positive is asserted before the refusal or absence.** Before asserting `metrics.baseline-unreadable`, the same fixture with a valid log renders a report; before asserting `UNAVAILABLE`, a measured twin shows a value; before asserting `alarms[]` empty, a crossing twin shows one alarm; before asserting truncation, an under-cap render is asserted untruncated.
2. **A paired control runs in the same test.** Every refused invocation beside an accepted one; every absent-node cell beside a declared-node cell; every absent-telemetry cell beside a present-telemetry cell; every cross-kind row beside a same-kind row; every over-cap fixture beside an at-cap fixture.
3. **A disabling mutant must fail its suite (`TC-METRICS-112`).** Temp copies of the production modules each disable one honesty rule; each must produce the prohibited observable on the unchanged fixture.
4. **Ordering and permutation invariance are asserted, not assumed.** The same facts seeded in shuffled store/readdir/log/corpus order produce identical `data` bytes and identical array order.
5. **Bounds are measured, never assumed.** Byte bounds are measured on the serialized UTF-8 `data` with a positive measured length asserted first; row caps by counting rendered rows; window lengths by date arithmetic on the fixture clock.
6. **No assertion depends on a moving base.** Every assertion reads the current tree, a committed fixture, or an isolated temp copy.

### 4.3 Oracles

**Refusal and exit oracle** (binding for AC-F1-1, AC-F2-2, AC-F6-4, AC-F8-1, AC-F10-1, §8.3). Read counters are armed on every seam; "before any read" is asserted as all-zero counters plus an untouched tree snapshot.

| ID | Condition | Identity | Exit | Observable beyond the code | TC |
|---|---|---|---|---|---|
| X-01 | `--from` supplied without `--through` (and the reverse) | `input.value.rejected` | 1 | 0 reads; no report | 003 |
| X-02 | Malformed bound (non-ISO, reversed, empty value) | `input.value.rejected` | 1 | 0 reads | 003 |
| X-03 | Malformed or unresolvable `--ref`; missing flag value | `input.value.rejected` | 1 | 0 reads | 004 |
| X-04 | Undeclared flag; unexpected positional; any declared verb (`metrics history`) | `fallback.invocation` | 1 | 0 reads | 004 |
| X-05 | Baseline log present but unparseable or invalid | `metrics.baseline-unreadable` | 2 | no partial report; log byte-unchanged; not re-projected as absence | 014, 090 |
| X-06 | `metrics.burn-rate` node defective | `config.value.invalid` | 1 | 0 telemetry/log/ceremony/transition/corpus reads | 054 |
| X-07 | Telemetry / ceremony / transition / audit store damaged | delivered `state.*` row for that source | per row (1 or 2) | never rendered as absence or zero | 071 |
| X-08 | Kind-only `metrics` discriminant; unclassifiable handler failure | `fallback.internal` | 2 | exact-code resolution unaffected | 091 |
| X-09 | Report produced, including every classified absence | — | 0 | `delivery.metrics.v1` `data` | 001, 070 |

**Measurement-kind oracle** (binding for AC-F2-1, AC-F3-1..3, DEC-7, DEC-13).

| Metric | Kind | Basis | Computed from | Never |
|---|---|---|---|---|
| `MET-CEREMONY-SHARE` | `native` | `ceremony-runner-fold` | Delivered ceremony measurement fold (run/step/phase counts) | The log's committed `duration_ratio_proxy` presented as this entry's value; a pm-notes proxy labelled native |
| `MET-CYCLE-TIME` | `native` | `phase-transition-history` | `phase.transition` history under the committed interval | The log's committed proxy value presented as this entry's value; a self-reported pm-notes timestamp; a completion invented for a censored ref |
| `MET-CI-FAILURE-RATE` | `proxy` | `committed-pm-notes-corpus` | Committed corpus under the committed definition | The log's committed value restated as a fresh measurement; a per-run rate; an unobserved row counted as green |
| `escaped-defects` | `curated-count` | `committed-evidence-corpus` | Three closed evidence classes with artifact + anchor | A `MET-` id; a `definitionRef`; a zero for no evidence |

**Basis scoping** (binding for AC-F2-1, DEC-13). A committed-basis entry (the CI-failure-rate proxy) recomputes its value under the committed definition and never restates the log's committed value. A native-basis entry (cycle time, ceremony share) computes its value from its declared native source, still carries `definitionRef` for provenance and the delivered status semantics, is never presented as the committed definition's value, and discloses the proxy-vs-native non-interchangeability as the `AC-F3-4` caveat. The scoping changes the value's source, never its traceability.

**Caveat matrix** (binding for AC-F3-4, DM-5, DEC-7). "Before kind" is the log row's measurement kind mapped into the closed set (`duration_ratio_proxy`/`duration_proxy`/`session_proxy` → `proxy`).

| Before kind | After kind | Caveat in the comparison row | Caveat in the owning metric entry | TC |
|---|---|---|---|---|
| `proxy` | `native` (cycle time, ceremony share) | present | present | 026 |
| `proxy` | `proxy` (CI failure rate) | absent | absent | 026 |
| `native` | `native` (fixture-only twin) | absent | absent | 026 |

Never: a cross-kind row without the caveat, a same-kind row with it, or a caveat rendered as a bare boolean instead of the declared text.

**Alarm oracle** (binding for AC-F6-1..AC-F6-5, DM-4, DM-6, DEC-4, DEC-5).

| Node state | Telemetry | `alarmEvaluation.status` | Echoed members | `alarms[]` | Exit | TC |
|---|---|---|---|---|---|---|
| Declared, `measured > threshold` | present | `evaluated` | threshold, basis, window | exactly one `burn-rate` with all echoed fields | 0 | 050 |
| Declared, `measured == threshold` | present | `evaluated` | threshold, basis, window | exactly one (crossing at equality) | 0 | 051 |
| Declared, `measured < threshold` | present | `evaluated` | threshold, basis, window | empty | 0 | 055 |
| Declared | absent | `telemetry-absent` | none | empty | 0 | 053 |
| Absent node | present | `threshold-undeclared` | none | empty | 0 | 052 |
| Defective node | any | — | — | — | 1 (`config.value.invalid`) | 054 |

Never: an alarm without a declared threshold, a second alarm for one crossing, a default threshold, an echoed member in an unevaluated state, or an alarm surviving a byte-cap truncation. On every row, `crossedAt` equals the evaluation's read instant and the alarm window's `end` (DM-4, DEC-5; `AMB-TP-3`).

**Truncation-order oracle** (binding for AC-F11-2, DM-8, DEC-10).

| Step | Array | Direction | Counted in | Never |
|---|---|---|---|---|
| 1 | `comparisons[]` | tail-first | `omitted`, `truncated: true` | — |
| 2 | `incidents[]` | tail-first | `omitted`, `truncated: true` | — |
| 3 | `perAgent[]` | tail-first | `omitted`, `truncated: true` | — |
| never | `alarms[]`, `alarmEvaluation`, `ref`, `window`, `metrics[]` | — | — | Dropped, reordered, or mutated by truncation |

**Count-pin oracle** (binding for AC-F10-1, Appendix D, DEC-8).

| Site group | Pre-change | Post-change | TC |
|---|---|---|---|
| `ERROR_TABLE` entries (`tests/structure/error-table.test.ts`, 7 sites) + `DOMAIN_KINDS` | 146 | 147, `metrics` kind present with exactly one row | 090, 092 |
| Delivered (spend-exclusion) rows (2 sites) | 145 | 146 | 090, 092 |
| `RESERVED_TWO_SEGMENT_CODES` in the sync check and the structural mirror | 62 | 63, exactly one `metrics.*` | 091, 092 |
| Allowlist-size assertions (5 sites) and test names (2 names) pinning "62 members" | 62 | 63 | 092 |
| Four-surface agreement test name | "146 entries / 145 delivered / 62 allowlist / 2 board / 3 steer / 3 retro / 146 documented" | "… / 1 metrics / …" with 147 / 146 / 63 / 147 | 092 |
| Carrier text pins (`146 machine identities`, `the same 146 identities`, `146 identities`, `exact two-segment allowlist of 62 declared identities`) | 146 / 62 | 147 / 63 | 090, 092 |
| `dispatch-attempts-taxonomy` header, test name, `toHaveLength(146)` | 146 | 147 | 092 |
| `verify-gates-suite-map-contract` `sourceEntries`/`documentedRows` (2 sites) | 146 | 147 | 092 |
| `tests/checks/error-table-sync.test.ts` arithmetic `BASELINE_ROWS.length + 112` (4 sites) | +112 | +113 | 092 |
| Repo-wide no-leftover scan token list | 146, 145, 62, +112 absent from the token list | token list extended by 146, 145, 62, "+ 112"; scan reports none | 092 |

### 4.4 Delivered-Suite Drift Register (declared, not discovered)

Each row is a delivered assertion this change legitimately moves, or a delivered suite that gains additive assertions. Goldens are regenerated only by explicit command and the regeneration diff must show only the declared delta.

| # | Delivered suite / fixture | Pinned assertion today | Why it moves | Disposition |
|---|---|---|---|---|
| DR-1 | `tests/structure/entrypoint-bin.test.ts` (TC-BIN-067) | `PROMPT_REQUIRED_COMMANDS` equals the 23-name list; root-help family lines `toBe(23)` | `metrics` mounts as the 24th family (AC-F9-1, DEC-9) | **pin-change**: list gains `metrics` last; line count 24 |
| DR-2 | `tests/structure/steer-mounting.test.ts` + `tests/fixtures/steer/mounting.ts` | mounted set equals base-22 + `steer`, `toHaveLength(23)`; `PINNING_FILES` list; stale-`22` scan | the count is now 24 and the scan must include the metrics suites | **pin-change**: steer remains index 22 (asserted as the delivered prefix), mounted count 24, `PINNING_FILES` gains `tests/structure/metrics-mounting.test.ts` and the metrics mounting fixture endpoint; stale-`23` scan arm added. `BASE_FAMILIES` stays 22 and its assertion stays valid |
| DR-3 | `tests/structure/{board-mounting,events-production-composition,dispatch-attempts-composition,daemon-production-composition}.test.ts`, `tests/behaviour/{repos-help,board-help,events-mount-help,ceremony-cli}.test.ts` | family-count pins at 23 | every pin moves with the mount (F-9) | **pin-change**: 24 |
| DR-4 | `tests/fixtures/help-guide/coverage.json` | 23 `commands`, 23 page rows | new command row and page (AC-F9-1) | **fixture-add**: `metrics` command + `…/m2/commands/metrics.md` page |
| DR-5 | `tests/checks/help-guide-coverage.test.ts`, `tests/checks/reference-page-parity.test.ts` | matrix complete for 23 commands | 24 commands | **additive assertions**: a metrics-row case asserting the row, the page, `--help`/`--version` mentions, and zero failures |
| DR-6 | `tests/structure/error-table.test.ts` (D-3..D-9) | 146/145/62 pins, four-surface test name, carrier text pins, legacy-token list | one new row, one new code (AC-F10-1) | **pin-change**: 147 / 146 / 63, name and text updated, legacy tokens extended |
| DR-7 | `tests/structure/dispatch-attempts-taxonomy.test.ts` (D-10); `tests/structure/verify-gates-suite-map-contract.test.ts` (D-11); `tests/checks/error-table-sync.test.ts` (D-12); `scripts/checks/error-table-sync.ts` (D-2) | 146 header/name/length; 146 counts; `+112` at four sites; 62-member allowlist set | the same registration | **pin-change**: 147, 147, `+113`, 63 |
| DR-8 | `doc/spec/features/feature-result-contract.md` (D-13) | `146 machine identities`, `the same 146 identities`, `62 declared identities`, kind inventory | one row, one code, one kind | **pin-change**: 147 / 63 wording, `metrics` row and kind; phase 7 reconciles surrounding prose |
| DR-9 | `tests/structure/inventory.json` (+ `tests/structure/content-inventory.test.ts`, unchanged scanner) | committed source inventory equals the file set; executable allowances per file | new `metrics` contract/domain/CLI modules | **fixture-add**: inventory entries plus executable allowances for the new files (an unlisted file fails by design; the scanner itself needs no change) |
| DR-10 | `tests/structure/cli-edge-seam.test.ts` | brand-as-parameter, no ambient environment, single serialization path over every CLI module | the metrics edge module must satisfy the same rules | **unchanged — must stay green**: the scan is file-set driven, so a violation in the new module fails without a pin change |
| DR-11 | `tests/structure/config-contract.test.ts`; `tests/checks/exports-parity.test.ts` and `tests/checks/prompt-conformance.test.ts` (unchanged) | config node table; export-map parity over built `dist`; prompt-text rules | the new `metrics.burn-rate` node row; new exports | **additive assertion**: the node row on the config table; exports-parity covers the new exports without a pin change; prompt-conformance is unrelated to the family list and stays green untouched |
| DR-12 | `tests/golden/**` (delivered goldens) | per-family help and payload goldens | none — the mount adds output, it does not rewrite delivered output | **unchanged — no regeneration**; `TC-METRICS-083` asserts it |

## 5. Test Scenarios

TC IDs use the `METRICS` feature prefix and follow the specification's capability blocks: `001`–`006` the report surface, identity, window, and grammar; `010`–`016` baseline consumption, absence, and damage; `020`–`026` measurement kinds, disclosure, and the caveat; `030`–`033` the comparison view; `040`–`042` the dispatch block; `050`–`056` burn-rate alarms; `060`–`063` escaped defects; `070`–`072` classified absence, store damage, and zero fabrication; `080`–`083` mounting; `090`–`092` error-table registration; `100`–`106` purity, determinism, bounds, clock, and read cost; `110`–`112` the gate, hermeticity, and the mutant meta-suite. A new sequence appends at the end of its block; an id is never reused.

### 5.1 Scenario Index

| TC ID | Title | Type | Impact | Priority | AC / NFR |
|---|---|---|---|---|---|
| TC-METRICS-001 | A bare report draws the window, carries the ten keys, and orders the four entries | Happy Path | Critical | High | AC-F1-1; F-1; DM-1, DM-8 |
| TC-METRICS-002 | Explicit `--ref` and bounds are honoured and echoed into every windowed entry | Happy Path | Critical | High | AC-F1-1; F-1; DM-1, DM-8 |
| TC-METRICS-003 | Window grammar violations are refused before any read, with accepting twins | Negative | Critical | High | AC-F1-1; F-1; DM-8 |
| TC-METRICS-004 | Ref resolution and grammar refusals are classified before any read | Negative | Critical | High | AC-F1-1; F-1, F-10; §8.3 |
| TC-METRICS-005 | One payload identity under the untouched five-field envelope on every exit form | Contract | Critical | High | AC-F1-1; NFR-1; DM-1 |
| TC-METRICS-006 | Window bounds are inclusive, the drawn default is exactly trailing 30 days, and the clock is injected | Contract | Critical | High | AC-F1-1; NFR-6; DM-8 |
| TC-METRICS-010 | Baseline entries cite their committed definition and conserve status and exclusions | Happy Path | Critical | High | AC-F2-1; F-2; DM-2 |
| TC-METRICS-011 | Baseline values are basis-scoped: a committed basis recomputes, a native basis reads its declared source | Corner Case | Critical | High | AC-F2-1; F-2; DEC-3, DEC-13 |
| TC-METRICS-012 | The baseline log and its `comparisons[]` records are byte-identical after every invocation | Contract | Critical | High | AC-F2-1; F-2; NFR-3; DEC-3 |
| TC-METRICS-013 | An absent baseline log classifies row-absent evidence at exit 0 | Corner Case | Critical | High | AC-F2-2; F-8; DEC-11 |
| TC-METRICS-014 | A present-but-unparseable or invalid log refuses `metrics.baseline-unreadable` at exit 2 | Negative | Critical | High | AC-F2-2; F-8; DM-7 |
| TC-METRICS-015 | A partial log classifies only the missing row as row-absent and keeps the entry set complete | Corner Case | Important | High | AC-F2-1, AC-F2-2; F-2, F-8 |
| TC-METRICS-016 | The fourth log row is not surfaced and the payload key set leaves no home for it | Regression | Important | Medium | AC-F2-1; F-2; §7.2 |
| TC-METRICS-020 | Cycle time is native from the transition history under the committed interval | Happy Path | Critical | High | AC-F3-1; F-3; DM-2; DEC-7 |
| TC-METRICS-021 | An absent completion transition is right-censored with the flag set and the latest completed phase used | Corner Case | Critical | High | AC-F3-1; F-3; NFR-6; DEC-7 |
| TC-METRICS-022 | No usable phase pair yields `UNAVAILABLE`, never zero, with counted exclusions | Negative | Critical | High | AC-F3-1; F-3; DEC-11 |
| TC-METRICS-023 | Ceremony share is native through the runner fold; an empty window names `sample.n == 0` | Happy Path | Critical | High | AC-F3-2; F-3; DM-2; DEC-7, DEC-13 |
| TC-METRICS-024 | CI failure rate is a proxy recomputed under the committed definition with the limitation stated | Happy Path | Critical | High | AC-F3-3; F-3; DEC-7 |
| TC-METRICS-025 | `no_ci_observation` rows are excluded and never assumed green | Negative | Critical | High | AC-F3-3; F-3; DEC-7 |
| TC-METRICS-026 | The caveat is present exactly on cross-kind comparisons and absent on same-kind rows | Corner Case | Critical | High | AC-F3-4; F-3, F-4; DM-5; DEC-7, DEC-13 |
| TC-METRICS-030 | A comparison row carries the committed identity, both windows, both kinds, and the sample minimum | Happy Path | Critical | High | AC-F4-1; F-4; DM-5; DEC-3 |
| TC-METRICS-031 | The sample minimum gates the verdict and no trend claim survives below it | Corner Case | Critical | High | AC-F4-1; F-4; RSK-1 |
| TC-METRICS-032 | `not-established` and the comparison ordering are declared, and the log stays byte-identical | Corner Case | Important | High | AC-F4-1; F-4; DM-5; NFR-3 |
| TC-METRICS-033 | A committed `comparisons[]` record is consumed as data, never restated as the report's own truth | Negative | Critical | High | AC-F4-1, AC-F2-1; DEC-3 |
| TC-METRICS-040 | `metrics.dispatch` equals the delivered spend fold for the same selection (`SC-M2-S6-01`) | Happy Path | Critical | High | AC-F5-1; F-5; DM-3; DEC-14; `SC-M2-S6-01` |
| TC-METRICS-041 | The dispatch block cites the reconciliation disclosure and never re-derives or re-prices | Contract | Critical | High | AC-F5-1; F-5; DM-3; RSK-2 |
| TC-METRICS-042 | Breakdown ordering, cost sparsity, and null attribution are preserved; breakdown sums equal totals and the unattributable remainder is disclosed | Corner Case | Important | High | AC-F5-1; F-5; DM-3; DEC-14 |
| TC-METRICS-050 | A crossing raises exactly one alarm with every member echoed, and the repeat is byte-identical (`SC-M2-S6-02`) | Happy Path | Critical | High | AC-F6-1; F-6; DM-4; DEC-5; `SC-M2-S6-02` |
| TC-METRICS-051 | The crossing boundary is exactly `measured >= threshold` on both declared bases | Corner Case | Critical | High | AC-F6-1, AC-F6-5; F-6; DM-4; DEC-5 |
| TC-METRICS-052 | An undeclared node classifies `threshold-undeclared` and invents no default | Corner Case | Critical | High | AC-F6-2; F-6; DM-6; DEC-4 |
| TC-METRICS-053 | Telemetry absence classifies the evaluation `telemetry-absent` while other metrics still measure | Corner Case | Critical | High | AC-F6-3; F-6, F-8; DEC-11 |
| TC-METRICS-054 | Every malformed-node class is refused `config.value.invalid` before any telemetry or log read | Negative | Critical | High | AC-F6-4; F-6; DM-6; DEC-4 |
| TC-METRICS-055 | Below the threshold the shape differs from the crossing case only by the empty alarm row | Corner Case | Critical | High | AC-F6-5; F-6; DM-4; DEC-5 |
| TC-METRICS-056 | The alarm set is a derived view: no persisted state, no duplicate, no write on the alarm path | Contract | Critical | High | AC-F6-1; F-6; DEC-5; NFR-3 |
| TC-METRICS-060 | Escaped defects is a curated floor over the three closed classes with artifact-plus-anchor citations | Happy Path | Critical | High | AC-F7-1; F-7; DM-2; DEC-2 |
| TC-METRICS-061 | No committed evidence yields `UNAVAILABLE`, never a zero count | Negative | Critical | High | AC-F7-2; F-7, F-8; DEC-11 |
| TC-METRICS-062 | Non-evidence (uncommitted, `tmp/`, `.ai/local/`, uncited, out-of-window) is never counted | Negative | Critical | High | AC-F7-1; F-7; §20 |
| TC-METRICS-063 | The incident display cap counts its omissions while per-class totals stay whole | Corner Case | Important | High | AC-F7-1; F-7; NFR-4; DM-8 |
| TC-METRICS-070 | No section renders a zero for absent evidence, and an all-absent report still exits 0 | Negative | Critical | High | AC-F8-1; F-8; DEC-11 |
| TC-METRICS-071 | Store damage on any read keeps the delivered `state.*` identity and is never re-projected as absence | Negative | Critical | High | AC-F8-1; F-8; DM-7; NFR-3 |
| TC-METRICS-072 | A zero-fabrication sweep over every numeric field finds no zero in an absent row | Negative | Critical | High | AC-F8-1; F-8; DEC-11 |
| TC-METRICS-080 | `metrics` is the 24th prompt-required family with every count pin moved | Happy Path | Critical | High | AC-F9-1; F-9; DEC-9 |
| TC-METRICS-081 | `metrics --help` answers at exit 0 with the six declared sections and no side effect | Happy Path | Important | High | AC-F9-1; F-9 |
| TC-METRICS-082 | The reference page and coverage-inventory row satisfy the coverage check | Contract | Critical | High | AC-F9-1; F-9 |
| TC-METRICS-083 | Mounting changes no other family and a partial mount is detected | Regression | Critical | High | AC-F9-1; F-9; RSK-7 |
| TC-METRICS-090 | The `metrics` kind and its one row land with the entry and delivered-row counts moved | Contract | Critical | High | AC-F10-1(a),(b); DM-7; DEC-8 |
| TC-METRICS-091 | The allowlist is widened to exactly 63 by declaration, and near misses are rejected | Negative | Critical | High | AC-F10-1(a),(d); DM-7; NFR-8 |
| TC-METRICS-092 | Every Appendix D site moves, the no-leftover scan is clean, and four surfaces agree | Contract | Critical | High | AC-F10-1(b),(c),(d); Appendix D |
| TC-METRICS-100 | No LLM, network, tracker, provider, credential, timer, socket, or session, and no write anywhere | Negative | Critical | High | AC-F11-1; NFR-3, NFR-5; NG-4 |
| TC-METRICS-101 | Two runs are byte-identical on all forms and order is permutation-proof | Corner Case | Critical | High | AC-F11-2; NFR-2; DM-1 |
| TC-METRICS-102 | The machine and human bounds hold at the cap with counted drops | Corner Case | Critical | High | AC-F11-2; NFR-4; DM-8; `AMB-TP-2` |
| TC-METRICS-103 | Truncation follows the declared tail order and `alarms[]` is never dropped | Corner Case | Critical | High | AC-F11-2; NFR-4; DEC-10 |
| TC-METRICS-104 | Row caps on `incidents[]`, `perAgent[]`, and `comparisons[]` count every omission | Corner Case | Important | High | AC-F11-2; NFR-4; DM-8 |
| TC-METRICS-105 | Window, censoring, and `crossedAt` are pure functions of the injected clock | Contract | Critical | High | AC-F11-2; NFR-6; `AMB-TP-3` |
| TC-METRICS-106 | The declared read budget holds and the latency reference is measured, not asserted | Performance | Important | Medium | NFR-7 |
| TC-METRICS-110 | The aggregate quality gate is green before the PR opens | Quality gate | Critical | High | AC-NFR9-1; NFR-9, NFR-10 |
| TC-METRICS-111 | Offline hermeticity, and a skip never counts as a pass | Negative | Critical | High | AC-F11-1; NFR-5 |
| TC-METRICS-112 | Mutant meta-suite: every honesty rule has a disabling mutant that fails | Negative | Critical | High | AC-F2-1, AC-F3-4, AC-F4-1, AC-F6-1, AC-F7-1, AC-F8-1, AC-F10-1, AC-F11-2 |

### 5.2 Scenario Details

#### TC-METRICS-001 - A bare report draws the window, carries the ten keys, and orders the four entries

**Scenario Type**: Happy Path
**Impact Level**: Critical
**Priority**: High
**Related IDs**: AC-F1-1, F-1, DM-1, DM-8
**Test Type(s)**: Integration, Contract
**Automation Level**: Automated
**Target Layer / Location**: `tests/behaviour/metrics-report.test.ts` (new); `tests/structure/metrics-contract.test.ts` (key-set half); golden `tests/fixtures/metrics/golden/bare.txt`
**Tags**: @backend, @behaviour, @contract

**Objective**: Prove that one bare invocation produces the declared payload — the active-context ref, a drawn window, four entries in the closed order, and every section present — so a missing key cannot hide behind a plausible-looking digest.

**Preconditions**:
- A real temporary checkout with a local delivery context binding a synthetic ref; injected clock fixed at a `NOW_MS` literal; injected run id; synthetic brand.
- Seeded temp stores: telemetry steps with five attribution dimensions, a `phase.transition` history with a complete pair, ceremony run/step records in-window, a fixture baseline log with the three consumed rows, a project-committed config document declaring `metrics.burn-rate`, and a committed corpus fixture.

**Steps**:
1. Run `metrics --json` with no flags.
2. Assert exit `0`, the success envelope, and `data` keys exactly `ref`, `window`, `metrics`, `dispatch`, `alarms`, `alarmEvaluation`, `comparisons`, `omitted`, `truncated` — no more, no fewer, and no `schemaVersion`-style key carrying the payload identity.
3. Assert `ref` equals the context's bound ref and `window` equals `{from: NOW − 30d, through: NOW}` computed independently in the test.
4. Assert `metrics` ids equal `["MET-CEREMONY-SHARE", "MET-CYCLE-TIME", "MET-CI-FAILURE-RATE", "escaped-defects"]` exactly, in order.
5. Assert every entry carries `status`, `measurementKind`, `basis`, `unit`, `direction`, `sample`, `limitation`, and that `definitionRef` is present on the three baseline-consumed entries and absent on `escaped-defects`.
6. Assert `omitted` is `0` and `truncated` is `false` on this fixture, and that the human render contains each declared section label.
7. Compare the human text and the machine `data` to the committed goldens.

**Expected Outcome**:
- The declared payload with the declared order at exit `0`; every section present even where evidence is thin.
- No store, log, or document byte changes (write-discipline counters armed in the fixture).

**Notes / Clarifications**:
- The golden is created in this change, not regenerated from a delivered artifact.

#### TC-METRICS-002 - Explicit `--ref` and bounds are honoured and echoed into every windowed entry

**Scenario Type**: Happy Path
**Impact Level**: Critical
**Priority**: High
**Related IDs**: AC-F1-1, F-1, DM-1, DM-8
**Test Type(s)**: Integration
**Automation Level**: Automated
**Target Layer / Location**: `tests/behaviour/metrics-report.test.ts` (explicit cells)
**Tags**: @backend, @behaviour

**Objective**: Prove the declared grammar is functional rather than decorative: an explicit ref and an explicit window select the evidence and are echoed, and `--json` is the machine switch.

**Preconditions**:
- Two refs seeded with different evidence in the same temp store; a clock fixed at `NOW`; an explicit window `[NOW − 7d, NOW − 1d]` and a second `[NOW − 1d, NOW]`.

**Steps**:
1. Run `metrics --ref` with the second ref (machine output); assert `ref` is the second ref and the telemetry-derived figures follow that ref only (the first ref's distinctive token total does not appear).
2. Run with `--from`/`--through` set to the 7-day window; assert `window` equals the supplied bounds verbatim (ISO strings, inclusive) and that an entry whose evidence falls outside the window is classified accordingly rather than reported from outside it.
3. Run with the 1-day window; assert the corpus and ceremony samples shrink to that window and `sample.n` changes accordingly.
4. Run without `--json` and assert the human digest is produced (no JSON) while the same selection is described.
5. Assert both runs leave every source byte-identical.

**Expected Outcome**:
- Explicit selectors are honoured end to end and echoed; the drawn default applies only when the bounds are omitted.

#### TC-METRICS-003 - Window grammar violations are refused before any read, with accepting twins

**Scenario Type**: Negative
**Impact Level**: Critical
**Priority**: High
**Related IDs**: AC-F1-1, F-1, DM-8
**Test Type(s)**: Integration, Unit
**Automation Level**: Automated
**Target Layer / Location**: `tests/behaviour/metrics-grammar.test.ts` (new); `tests/structure/metrics-contract.test.ts` (pure grammar half)
**Tags**: @backend, @behaviour, @refusal

**Objective**: Prove the window is validated before the read pass and that a malformed or lone bound is never silently repaired.

**Preconditions**:
- One seeded store with measurable evidence (so a report would be visible); read counters armed on every seam; a state/log/config tree snapshot.
- Cells: `--from` without `--through`; `--through` without `--from`; a non-ISO value; a reversed pair (`from > through`); an empty flag value; a date-only value where a timestamp is required; a bound with a dangling timezone.
- Accepting twins: the same instant with and without a `Z` offset that is declared equivalent, and an equal-instant `from == through` window.

**Steps**:
1. Run each cell independently against a fresh snapshot.
2. Assert exit `1`, `data.error.code == "input.value.rejected"`, `category == "user"`, and the `not_landed` consequence.
3. Assert **all** read counters are `0` (telemetry, transition, ceremony, log, config, corpus) and the tree snapshot is byte-identical.
4. Assert no `metrics.*` identity is emitted for a grammar-class failure and that the summary names the offending bound without echoing an unbounded value.
5. Run the accepting twins and assert exit `0` with the expected window, proving each refusal is attributable to the rule and not to the parser.
6. Assert the pure grammar predicate is one exported function consumed by the command path (no second parser in the family).

**Expected Outcome**:
- Every window violation is refused pre-read with zero reads and zero persisted bytes; the equal-instant and equivalent-offset twins are accepted.

#### TC-METRICS-004 - Ref resolution and grammar refusals are classified before any read

**Scenario Type**: Negative
**Impact Level**: Critical
**Priority**: High
**Related IDs**: AC-F1-1, F-1, F-10, §8.3 grammar
**Test Type(s)**: Integration
**Automation Level**: Automated
**Target Layer / Location**: `tests/behaviour/metrics-grammar.test.ts` (ref and invocation cells)
**Tags**: @backend, @behaviour, @refusal

**Objective**: Prove value violations and grammar violations are separated by the delivered identities, that all of them precede the read pass, and that no declared verb exists.

**Preconditions**:
- A bound checkout and an unbound checkout; read counters armed; cells for each refusal class.

**Steps**:
1. Value cells: a malformed ref (lowercase, folded, or with an illegal separator); a well-formed ref unresolvable from the context; `--ref` with no value. Assert exit `1`, `input.value.rejected`, zero reads, no report.
2. Grammar cells: an undeclared flag; an unexpected positional (`metrics GH-299`); a declared verb (`metrics history`, `metrics report`, `metrics list`). Assert exit `1`, `fallback.invocation`, zero reads, and that no `metrics.*` grammar identity exists.
3. Assert the unbound checkout behaves as the delivered local-context rule states (a classified value refusal, not a crash and not a fabricated ref).
4. Assert `metrics --help` still answers at exit `0` in the same fixture — a refusal must not break the help path.
5. Assert the emitted code set across all refusal cells is exactly `{input.value.rejected, fallback.invocation}`.

**Expected Outcome**:
- Value and grammar violations are classified correctly, uniformly pre-read, and the single-report grammar is closed: any verb is a grammar refusal, never a second surface.

#### TC-METRICS-005 - One payload identity under the untouched five-field envelope on every exit form

**Scenario Type**: Contract
**Impact Level**: Critical
**Priority**: High
**Related IDs**: AC-F1-1, NFR-1, DM-1
**Test Type(s)**: Contract
**Automation Level**: Automated
**Target Layer / Location**: `tests/behaviour/metrics-envelope.test.ts` (new); `tests/structure/metrics-contract.test.ts` (constant half)
**Tags**: @backend, @contract

**Objective**: Prove the family adds one payload identity and no envelope surface, on the success path and on every refusal path.

**Preconditions**:
- The §8.3 exit-projection rows reproduced as cells (success, value violation, grammar violation, damaged baseline, node defect, store damage).

**Steps**:
1. For each row, assert the envelope has exactly the five delivered fields and that the new keys live only under `data`.
2. Assert the serialized payload contains no `ok` and no `command` field anywhere.
3. Assert the payload identity constant equals `delivery.metrics.v1` and is imported from contract data — not written as a `data` key and not duplicated as a literal in the CLI module (scan).
4. Assert exit codes are exactly `0`, `1`, or `2` per row and that `data.error.code` is the row's declared identity.
5. Assert a single payload identity serves every form (no second `schemaVersion` value anywhere in the family's modules).

**Expected Outcome**:
- Envelope continuity holds on all six cells; one identity, one shape family, no envelope growth.

#### TC-METRICS-006 - Window bounds are inclusive, the drawn default is exactly trailing 30 days, and the clock is injected

**Scenario Type**: Contract
**Impact Level**: Critical
**Priority**: High
**Related IDs**: AC-F1-1, NFR-6, DM-8
**Test Type(s)**: Unit, Integration
**Automation Level**: Automated
**Target Layer / Location**: `tests/behaviour/metrics-report.test.ts` (window cells); `tests/structure/metrics-contract.test.ts` (constant)
**Tags**: @backend, @behaviour

**Objective**: Prove the drawn window is a pure function of one declared constant and the injected clock, and that inclusivity is real rather than nominal.

**Preconditions**:
- Evidence planted exactly at `from`, at `from − 1 ms`, at `through`, and at `through + 1 ms`.

**Steps**:
1. Assert the drawn window start equals the read instant minus the declared 30-day constant, computed independently from the fixture clock — not from a calendar month.
2. Advance the injected clock by 36 hours and re-run; assert the window moves by exactly 36 hours and the evidence classification follows (the record at the old `from − 1 ms` is now in-window).
3. Assert the record exactly at `from` and the record exactly at `through` are both included, while the neighbours outside are excluded with the closed `outside_window` reason and counted.
4. Assert the window is disclosed in every windowed entry (metric entries, `dispatch`-adjacent evidence statements, comparison `after`, alarm window) rather than only at the payload root.
5. Run the ambient-globals guard over the new modules and assert it reports no wall-clock read.

**Expected Outcome**:
- Inclusive bounds, an arithmetic 30-day default, and a window derived solely from the injected clock.

#### TC-METRICS-010 - Baseline entries cite their committed definition and conserve status and exclusions

**Scenario Type**: Happy Path
**Impact Level**: Critical
**Priority**: High
**Related IDs**: AC-F2-1, F-2, DM-2
**Test Type(s)**: Integration, Contract
**Automation Level**: Automated
**Target Layer / Location**: `tests/behaviour/metrics-baseline.test.ts` (new)
**Tags**: @backend, @behaviour, @baseline

**Objective**: Prove each baseline-consumed entry is traceable to the committed row and that the log's sample discipline survives the composition.

**Preconditions**:
- A fixture baseline log whose three consumed rows carry `source_commit`, `measurement_kind`, status values (`MEASURED`, `PARTIAL`, `UNAVAILABLE` across the three), and a per-row exclusion set drawn from the closed reason list (`unparseable_yaml`, `date_only_or_missing_time`, `placeholder_zero_time`, `capture_change`, `outside_window`, `missing_metric_input`, `no_ci_observation`).

**Steps**:
1. Assert each entry's `definitionRef` equals `{logPath, sourceCommit}` taken verbatim from the fixture row — the same value the test reads from the log text.
2. Assert `status` equals the fixture row's status for each of the three entries, and `unit`/`direction` equal the row's committed unit and direction.
3. Assert `excluded[]` equals the row's counted exclusion set exactly (reason plus count), including a zero-count reason the row does not use being absent rather than rendered as `0`.
4. Assert `sample` carries `n` plus the row's conserved counters (the corpus row's `spine_included`/`metric_included` shape), and that no counter is recomputed from a different basis.
5. Assert `limitation` is non-empty and quotes the row's limitation class (duration proxy, session proxy, duration ratio) — no invented limitation and no silent drop.
6. Assert the three entries appear in vocabulary order and that no other baseline row appears.

**Expected Outcome**:
- Every baseline-consumed figure is traceable to a committed path plus commit, with status, unit, direction, samples, and exclusions conserved exactly.

#### TC-METRICS-011 - Baseline values are basis-scoped: a committed basis recomputes, a native basis reads its declared source

**Scenario Type**: Corner Case
**Impact Level**: Critical
**Priority**: High
**Related IDs**: AC-F2-1, F-2, DEC-3, DEC-7, DEC-13
**Test Type(s)**: Integration
**Automation Level**: Automated
**Target Layer / Location**: `tests/behaviour/metrics-baseline.test.ts` (recompute cells); `tests/checks/metrics-mutants.test.ts` (mutant)
**Tags**: @backend, @behaviour, @honesty

**Objective**: Prove each entry's number is scoped by its declared basis — a committed-basis entry recomputed under the committed definition, a native-basis entry computed from its declared native source — and that no entry presents the log's committed value as its own.

**Preconditions**:
- A fixture log whose committed values are deliberately distinguishable from what the fixture evidence produces (e.g. the committed CI ratio is `0.25` while the fixture corpus yields `0.4`; the committed cycle time is `5.3` while the fixture history yields `2.0`; the committed ceremony share is the pm-notes `duration_ratio_proxy` while the runner fold yields a different figure).

**Steps**:
1. Committed-basis arm (`MET-CI-FAILURE-RATE`): assert `value` equals the independently computed recomputation under the committed definition (red-or-mixed numerator over the observed denominator) and differs from the row's committed `value`.
2. Native-basis arm (`MET-CYCLE-TIME`, `MET-CEREMONY-SHARE`): assert each `value` equals the independently computed native expectation from its declared source (`phase-transition-history`, `ceremony-runner-fold`) — never a recomputation of the committed proxy formula — and differs from the row's committed `value`.
3. Assert never-presented-as-the-committed-value: the row's committed `value` appears nowhere in the entry other than (for comparisons) under `before` — a grep-level assertion over the serialized entry — while every entry still carries `definitionRef` (log path plus row `source_commit`) for provenance.
4. Assert the native-basis entries are labelled by their declared kind and never as the committed definition's measurement (delivered status semantics, `measurementKind: native`), and that where a cross-kind comparison row exists for them the non-interchangeability caveat is disclosed under the `AC-F3-4` rule (`TC-METRICS-026` owns the matrix).
5. Assert a fixture whose evidence happens to match the committed value still records the scoped basis (`basis`, `measurementKind`, `sample.n`, `excluded[]`) rather than collapsing into a copy of `before`.
6. Assert each entry's `sample` describes the fixture evidence (n from the fixture) and not the row's `sample` block.
7. Mutation arms: (i) a temp copy that echoes the row's committed `value` into the committed-basis entry must fail this case; (ii) a temp copy that presents the pm-notes proxy recomputation as the ceremony-share value (or the log's `duration_ratio_proxy` as the native entry's value) must fail.

**Expected Outcome**:
- Basis scoping is observable and distinguishable in both directions: the committed-basis entry recomputes, the native-basis entries compute from their declared sources, and neither restates nor impersonates the log's committed value.

**Notes / Clarifications**:
- `DEC-13` (spec v1.1) replaces the v1.0 ambiguity `GAP-T1`/`OQ-TP-1`: the value rule is scoped by the entry's basis, so `AC-F2-1` and `AC-F3-1`/`AC-F3-2` no longer compete. `TC-METRICS-020` binds the native cycle time, `TC-METRICS-023` the native ceremony-share source, and `TC-METRICS-026` the disclosure.

#### TC-METRICS-012 - The baseline log and its `comparisons[]` records are byte-identical after every invocation

**Scenario Type**: Contract
**Impact Level**: Critical
**Priority**: High
**Related IDs**: AC-F2-1, F-2, NFR-3, DEC-3
**Test Type(s)**: Integration, Contract
**Automation Level**: Automated
**Target Layer / Location**: `tests/behaviour/metrics-write-discipline.test.ts` (new)
**Tags**: @backend, @behaviour, @readonly

**Objective**: Prove read-only discipline as a byte fact, not a promise: no invocation path edits, appends to, or rewrites the committed log.

**Preconditions**:
- A fixture baseline log carrying a committed `comparisons[]` record; a pre/post SHA-256 of the file; append and fence recorders armed; the delivered `guardStore` on the state scopes.

**Steps**:
1. Hash the log, the config document, the ceremony records, and every evidence artifact before the run; snapshot the state scopes.
2. Run the success path, the value-refusal path, the damaged-baseline path, the node-defect path, and a repeat run.
3. Assert every hash is unchanged and the artifact inventory is unchanged after each run.
4. Assert the append counter is `0`, the fence counter is `0`, and no salvage path was taken.
5. Assert the committed `comparisons[]` record's text is unchanged and no new record was added (the log's record count is constant).
6. Assert the human and machine outputs contain no "written", "updated", or "appended" claim about any source.

**Expected Outcome**:
- Zero writes on every path, proven by hash equality and counters rather than by intent.

#### TC-METRICS-013 - An absent baseline log classifies row-absent evidence at exit 0

**Scenario Type**: Corner Case
**Impact Level**: Critical
**Priority**: High
**Related IDs**: AC-F2-2, F-8, DEC-11
**Test Type(s)**: Integration
**Automation Level**: Automated
**Target Layer / Location**: `tests/behaviour/metrics-baseline-damage.test.ts` (new)
**Tags**: @backend, @behaviour, @absence

**Objective**: Prove a missing log is a classified state, not a refusal and not a zero.

**Preconditions**:
- A checkout with no committed baseline log but with transition history, ceremony records, corpus rows, and telemetry; a second fixture with the log present (the paired control).

**Steps**:
1. Run `metrics --json`; assert exit `0` and a rendered report.
2. Assert each baseline-consumed entry is present with no `value`, a row-absent classification named in the entry's `limitation` or status block, and no `definitionRef` invented from a nonexistent row.
3. Assert no `0` appears as any baseline-consumed `value`, and that `escaped-defects`, `dispatch`, and `alarmEvaluation` are unaffected by the missing log.
4. Run the control fixture with the log present and assert the same entries now carry values and `definitionRef`, proving the absence classification is attributable to the log's state.
5. Assert exit `0` in both and that no `metrics.baseline-unreadable` code is emitted for an absent log.

**Expected Outcome**:
- Row-absent evidence at exit `0`; the paired control makes the assertion non-vacuous.

#### TC-METRICS-014 - A present-but-unparseable or invalid log refuses `metrics.baseline-unreadable` at exit 2

**Scenario Type**: Negative
**Impact Level**: Critical
**Priority**: High
**Related IDs**: AC-F2-2, F-8, DM-7
**Test Type(s)**: Integration, Contract
**Automation Level**: Automated
**Target Layer / Location**: `tests/behaviour/metrics-baseline-damage.test.ts` (damage cells)
**Tags**: @backend, @behaviour, @refusal

**Objective**: Prove damaged canonical data is visible at exit `2` and never masquerades as absence.

**Preconditions**:
- Cells: truncated YAML; a duplicate key; a missing required member; an unknown `status` value; a metric row with an out-of-set exclusion reason; a row whose `source_commit` is empty; a non-mapping root. Each cell keeps the appending case (a valid log) as the control.

**Steps**:
1. Run each cell; assert exit `2` and `data.error.code == "metrics.baseline-unreadable"` with `category == "platform"`, `retryable == false`, and the `not_landed` consequence.
2. Assert **no** partial report renders: `data` carries the error payload only, no `metrics[]`, no `dispatch`, no `alarms[]`.
3. Assert no entry is produced with a row-absent classification (damage is never re-projected as absence) and no error message echoes the document's bytes.
4. Assert the log file is byte-unchanged and no salvage or repair write occurred.
5. Assert the valid control renders at exit `0` in the same fixture.

**Expected Outcome**:
- Damage is `metrics.baseline-unreadable` at exit `2` with no partial output and no repair; the valid twin renders.

#### TC-METRICS-015 - A partial log classifies only the missing row as row-absent and keeps the entry set complete

**Scenario Type**: Corner Case
**Impact Level**: Important
**Priority**: High
**Related IDs**: AC-F2-1, AC-F2-2, F-2, F-8
**Test Type(s)**: Integration
**Automation Level**: Automated
**Target Layer / Location**: `tests/behaviour/metrics-baseline.test.ts` (partial-log cells)
**Tags**: @backend, @behaviour, @baseline

**Objective**: Prove the entry set is driven by the closed vocabulary, not by what the log happens to contain.

**Preconditions**:
- A valid log carrying `MET-CEREMONY-SHARE` and `MET-CI-FAILURE-RATE` but no `MET-CYCLE-TIME` row; a second fixture where the log carries `MET-FALSE-SIGNAL-INCIDENTS` only.

**Steps**:
1. Run the partial-log fixture; assert the report still carries all four vocabulary entries in order.
2. Assert `MET-CYCLE-TIME` is row-absent (no value, no invented `definitionRef`) while the other two carry values and definitions from the rows that exist.
3. Run the second fixture; assert all three baseline-consumed entries are row-absent and the fourth log row is still not surfaced.
4. Assert no vocabulary member is invented for an extra row and that `omitted` does not count classified absences.
5. Assert the log is byte-unchanged in both cells.

**Expected Outcome**:
- Vocabulary-driven entries with per-row absence classification; extra rows never become entries.

#### TC-METRICS-016 - The fourth log row is not surfaced and the payload key set leaves no home for it

**Scenario Type**: Regression
**Impact Level**: Important
**Priority**: Medium
**Related IDs**: AC-F2-1, F-2, §7.2
**Test Type(s)**: Contract
**Automation Level**: Automated
**Target Layer / Location**: `tests/structure/metrics-contract.test.ts` (vocabulary half); `tests/behaviour/metrics-baseline.test.ts` (§7.2 cell)
**Tags**: @backend, @contract

**Objective**: Prove the scope boundary mechanically: the false-signal row is untouched canonical data, not a fifth entry.

**Preconditions**:
- A fixture log whose `MET-FALSE-SIGNAL-INCIDENTS` row carries a non-zero value (so surfacing it would be visible).

**Steps**:
1. Assert the closed entry vocabulary constant is exactly the four declared members and contains no `MET-FALSE-SIGNAL-INCIDENTS`.
2. Run the report over the fixture; assert no entry id starts with `MET-FALSE-SIGNAL` and the string does not appear in the payload.
3. Assert the log row is byte-unchanged (the exclusion is a read decision, not an edit).
4. Assert no quota-shaped key or entry exists anywhere in the payload (a scan over the closed key set plus the entry ids), matching NG-2.

**Expected Outcome**:
- The payload's closed vocabularies leave no room for the excluded row or for quota data, and the log is untouched.

#### TC-METRICS-020 - Cycle time is native from the transition history under the committed interval

**Scenario Type**: Happy Path
**Impact Level**: Critical
**Priority**: High
**Related IDs**: AC-F3-1, F-3, DM-2, DEC-7
**Test Type(s)**: Integration, Unit
**Automation Level**: Automated
**Target Layer / Location**: `tests/behaviour/metrics-cycle-time.test.ts` (new); `tests/structure/metrics-contract.test.ts` (vocabulary half)
**Tags**: @backend, @behaviour, @measurement

**Objective**: Prove cycle time is measured from the machine ledger over the committed interval, not read from the baseline proxy.

**Preconditions**:
- A seeded `phase.transition` history for the ref: `clarify_scope.started` at `T0`, intermediate phases, `pr_creation.completed` at `T0 + 7h`; a fixture log whose committed cycle-time value is a different number derived from pm-notes.

**Steps**:
1. Run the report and assert the `MET-CYCLE-TIME` entry's `measurementKind == "native"` and `basis == "phase-transition-history"`.
2. Assert `value` equals the hand-computed interval (`7` hours in the declared unit) — computed from the fixture stamps, never from the production fold.
3. Assert `unit` and `direction` match the committed row, `sample.n` names the measured count, and the censoring flag is absent or `false`.
4. Assert the value differs from the log's committed value, proving the native measurement was used (`GAP-T1` does not apply here: the committed definition *is* this interval).
5. Assert the entry carries `definitionRef` pointing at the log row (the definition is cited even when the source is better).

**Expected Outcome**:
- A native figure from the ledger, with the committed definition cited and the proxy value not reused.

#### TC-METRICS-021 - An absent completion transition is right-censored with the flag set and the latest completed phase used

**Scenario Type**: Corner Case
**Impact Level**: Critical
**Priority**: High
**Related IDs**: AC-F3-1, F-3, NFR-6, DEC-7
**Test Type(s)**: Integration
**Automation Level**: Automated
**Target Layer / Location**: `tests/behaviour/metrics-cycle-time.test.ts` (censoring cells)
**Tags**: @backend, @behaviour, @censoring

**Objective**: Prove an in-flight ref yields an honest lower bound instead of a refusal, a zero, or a fabricated completion.

**Preconditions**:
- A history with `clarify_scope.started` at `T0` and `quality_gates.completed` at `T0 + 3h` but no `pr_creation.completed`; a clock fixed at `T0 + 5h`.

**Steps**:
1. Assert the entry has status `PARTIAL`, `measurementKind == "native"`, and a censoring flag set (the declared member, not an extra key).
2. Assert the value equals the interval to the latest completed phase (`3h`), not the clock instant.
3. Assert the limitation/disclosure names the censoring and the phase used, so a reader cannot mistake it for a completed cycle.
4. Advance the clock and re-run without changing the history; assert the value does **not** change (censoring is anchored to the last completed phase, not to `now`).
5. Add the completion transition to the fixture and re-run; assert the flag clears and the value becomes the full interval, proving the same code path.

**Expected Outcome**:
- A censored lower bound with the flag and the phase named; the completed twin proves the transition.

#### TC-METRICS-022 - No usable phase pair yields `UNAVAILABLE`, never zero, with counted exclusions

**Scenario Type**: Negative
**Impact Level**: Critical
**Priority**: High
**Related IDs**: AC-F3-1, F-3, DEC-11
**Test Type(s)**: Integration
**Automation Level**: Automated
**Target Layer / Location**: `tests/behaviour/metrics-cycle-time.test.ts` (unavailable cells)
**Tags**: @backend, @behaviour, @absence

**Objective**: Prove the absence of a usable interval is declared rather than rendered as `0` hours.

**Preconditions**:
- Cells: an empty history; a history with only `clarify_scope.reopened`; a history with a completion but no start; a history whose only start is a re-opened record; a history whose timestamps are unparseable.

**Steps**:
1. For each cell, assert status `UNAVAILABLE`, no `value` member, and a named absence reason.
2. Assert the numeric zero appears nowhere in the entry (a structural assertion over the entry object, not a string search of the whole payload).
3. Assert the exclusion is counted with a closed reason from the delivered set, and that the counter is not silently absent.
4. Assert each cell's paired control (the usable pair) reports a value in the same suite.
5. Assert exit `0` for every cell.

**Expected Outcome**:
- `UNAVAILABLE` with counted exclusions; zero is structurally impossible.

#### TC-METRICS-023 - Ceremony share is native through the runner fold; an empty window names `sample.n == 0`

**Scenario Type**: Happy Path
**Impact Level**: Critical
**Priority**: High
**Related IDs**: AC-F3-2, F-3, DM-2, DEC-7, DEC-13
**Test Type(s)**: Integration, Unit
**Automation Level**: Automated
**Target Layer / Location**: `tests/behaviour/metrics-ceremony-share.test.ts` (new)
**Tags**: @backend, @behaviour, @measurement

**Objective**: Prove the ceremony-share figure comes from the delivered native fold over run/step records — computed from its declared native source and never presented as the committed definition's value — and that an empty window is a named zero sample rather than a zero value.

**Preconditions**:
- Seeded ceremony run/step records for three ceremonies with known step timings inside the window; a second fixture with records only outside the window; a third with no records.

**Steps**:
1. Assert `measurementKind == "native"` and `basis == "ceremony-runner-fold"`.
2. Compute the expected share from the fixture run durations in the test and assert `value` equals it; assert `sample.n` equals the fixture run count and that the per-ceremony aggregates are reflected in the sample counters the contract declares.
3. Assert the entry cites `definitionRef` from the log row for provenance and is never presented as the committed definition's value: the log's `duration_ratio_proxy` figure appears nowhere in the entry, the entry carries the delivered status semantics, and where a cross-kind comparison row exists the proxy-vs-native non-interchangeability is disclosed (the `AC-F3-4` caveat rule, `DEC-13`; matrix owned by `TC-METRICS-026`).
4. Run the outside-window fixture: assert `UNAVAILABLE` with `sample.n == 0` **named**, and no `value`.
5. Run the empty fixture: same assertion; assert exit `0` in all three.

**Expected Outcome**:
- A native runner-derived figure with its sample, scoped to its declared source and never presented as the committed definition's value; an empty window declared as a zero sample plus `UNAVAILABLE`.

**Notes / Clarifications**:
- `DEC-13` (spec v1.1): the ceremony-share value is computed from the runner fold and never presented as the log's committed `duration_ratio_proxy`, so the v1.0 criterion conflict (`GAP-T1`/`OQ-TP-1`) is closed. `TC-METRICS-011` binds the basis-scoped value rule across all three baseline-consumed entries; `TC-METRICS-026` binds the non-interchangeability disclosure.

#### TC-METRICS-024 - CI failure rate is a proxy recomputed under the committed definition with the limitation stated

**Scenario Type**: Happy Path
**Impact Level**: Critical
**Priority**: High
**Related IDs**: AC-F3-3, F-3, DEC-7
**Test Type(s)**: Integration, Unit
**Automation Level**: Automated
**Target Layer / Location**: `tests/behaviour/metrics-ci-proxy.test.ts` (new)
**Tags**: @backend, @behaviour, @measurement

**Objective**: Prove the proxy is rebuilt under the committed formula from committed rows, and that it never presents itself as a per-run rate.

**Preconditions**:
- A committed corpus fixture with a known population: 6 rows with `ci_observed: true`, of which 1 is `red` and 1 is `mixed`; 5 rows with `ci_observed: false`; 2 rows outside the window.

**Steps**:
1. Assert `measurementKind == "proxy"` and `basis == "committed-pm-notes-corpus"`.
2. Assert `value` equals `2/6` computed independently, with the denominator equal to the observed count only.
3. Assert `limitation` states the session-proxy limitation and that no per-run claim appears in the entry or in the human render (a token scan for run-level phrasing in the declared limitation text).
4. Assert the outside-window rows are counted with `outside_window` and the unobserved rows with `no_ci_observation`.
5. Assert the entry does not reuse the log's committed ratio when the fixture population differs from the log's sample.

**Expected Outcome**:
- A recomputed session proxy with an observed-only denominator, a stated limitation, and counted exclusions.

#### TC-METRICS-025 - `no_ci_observation` rows are excluded and never assumed green

**Scenario Type**: Negative
**Impact Level**: Critical
**Priority**: High
**Related IDs**: AC-F3-3, F-3, DEC-7
**Test Type(s)**: Integration
**Automation Level**: Automated
**Target Layer / Location**: `tests/behaviour/metrics-ci-proxy.test.ts` (exclusion cells); `tests/checks/metrics-mutants.test.ts` (mutant)
**Tags**: @backend, @behaviour, @honesty

**Objective**: Prove unobserved deliveries are excluded rather than counted as successes — the single arithmetic that would silently deflate the rate.

**Preconditions**:
- Three fixtures over the same 11 rows: (a) 2 observed and 9 unobserved; (b) all unobserved; (c) 9 observed, 1 unobserved and red.

**Steps**:
1. Fixture (a): assert the denominator is `2` and the value equals the observed ratio, with 9 rows in `excluded[]` under `no_ci_observation`.
2. Fixture (b): assert the denominator is `0`, the entry is `UNAVAILABLE` (not `0`, not `1`), and `sample.n == 0` is named.
3. Fixture (c): assert the unobserved row's absence does not change the numerator or denominator, and that the observed red row does.
4. Mutation arm: a temp copy that counts unobserved rows as green must produce a smaller value and fail this case.
5. Assert the status semantics are coherent: an unavailable entry carries no value, and a measured entry never reports `excluded_unobserved` as `0` when exclusions exist.

**Expected Outcome**:
- Unobserved rows are always excluded and counted; an all-unobserved population is `UNAVAILABLE`, never a perfect score.

#### TC-METRICS-026 - The caveat is present exactly on cross-kind comparisons and absent on same-kind rows

**Scenario Type**: Corner Case
**Impact Level**: Critical
**Priority**: High
**Related IDs**: AC-F3-4, F-3, F-4, DM-5, DEC-7, DEC-13
**Test Type(s)**: Integration, Contract
**Automation Level**: Automated
**Target Layer / Location**: `tests/behaviour/metrics-caveat.test.ts` (new)
**Tags**: @backend, @behaviour, @honesty

**Objective**: Prove the proxy-vs-native disclosure is mechanical: it travels with every cross-kind comparison (the `DEC-13` non-interchangeability rule), and it never appears where the kinds agree.

**Preconditions**:
- A fixture population producing three rows: cycle time (`proxy` before, `native` after), ceremony share (`proxy` before, `native` after), CI failure rate (`proxy` before, `proxy` after). A fourth fixture cell forces a `native`/`native` row.

**Steps**:
1. Assert every cross-kind row carries a non-empty `caveat` at the row level and that the owning metric entry carries the same disclosure.
2. Assert the same-kind row (CI failure rate) carries **no** `caveat` member — not `null`, not `""` — and that the metric entry carries none either.
3. Assert the `native`/`native` twin carries none, so the rule keys on kind difference and not on the metric identity.
4. Assert the caveat text names both bases (the log's proxy basis and the native basis), states the proxy-vs-native non-interchangeability, and never asserts interchangeability or a trend across them (`DEC-13`).
5. Mutation arms: (i) drop the caveat from a cross-kind row → fails; (ii) add it to the same-kind row → fails.
6. Assert the human render carries the caveat on exactly the same rows as the machine payload.

**Expected Outcome**:
- A caveat matrix that matches the oracle exactly, in both directions, in both surfaces.

#### TC-METRICS-030 - A comparison row carries the committed identity, both windows, both kinds, and the sample minimum

**Scenario Type**: Happy Path
**Impact Level**: Critical
**Priority**: High
**Related IDs**: AC-F4-1, F-4, DM-5, DEC-3
**Test Type(s)**: Integration, Contract
**Automation Level**: Automated
**Target Layer / Location**: `tests/behaviour/metrics-comparisons.test.ts` (new)
**Tags**: @backend, @behaviour, @comparison

**Objective**: Prove the comparison view is a protocol-compliant evaluation whose inputs are all visible on the row.

**Preconditions**:
- A fixture baseline log with a declared 30-day window (so the equal-length protocol is satisfiable, `AMB-TP-4`) and `source_commit` values; a fixture evidence population giving an after-sample of exactly 5 for one metric and larger for another.

**Steps**:
1. Assert the row's key set is the declared DM-5 set and no more.
2. Assert `metricId` is the vocabulary member and `definitionRef` equals the log row's path plus `source_commit`.
3. Assert `before` equals `{value, window, basis, measurementKind, status}` read from the log text — including the log's own window, unmodified.
4. Assert `after` equals `{value, window, measurementKind, status, sampleSize}` with `sampleSize` equal to the fixture row count, and the window equal to the drawn/declared evidence window.
5. Assert `sampleMinimum` is the literal `5` on every row and `verdict` is a member of the closed five.
6. Assert `comparisons[]` order follows the closed vocabulary order restricted to committed row IDs, and that a row exists for each baseline-consumed metric with a committed row.

**Expected Outcome**:
- Every row is fully attributable: committed identity, committed before, measured after, declared minimum, closed verdict.

#### TC-METRICS-031 - The sample minimum gates the verdict and no trend claim survives below it

**Scenario Type**: Corner Case
**Impact Level**: Critical
**Priority**: High
**Related IDs**: AC-F4-1, F-4, RSK-1
**Test Type(s)**: Integration, Contract
**Automation Level**: Automated
**Target Layer / Location**: `tests/behaviour/metrics-comparisons.test.ts` (minimum cells); `tests/checks/metrics-mutants.test.ts` (mutant)
**Tags**: @backend, @behaviour, @honesty

**Objective**: Prove the boundary is exactly at five and that a below-minimum row cannot carry a trend in the payload or in the digest.

**Preconditions**:
- Fixtures with after-samples of 4, 5, and 6 over a population whose direction is "lower is better"; values chosen so each verdict class is reachable (`improved`, `regressed`, `flat`).

**Steps**:
1. Sample 4: assert `verdict == "insufficient-sample"`, that `after.sampleSize == 4`, and that the row carries no conclusion text beyond the declared disclosure.
2. Sample 5 and 6: assert the verdict follows the value comparison against `before` and the declared `direction` (`improved` when lower, `regressed` when higher, `flat` when equal).
3. Scan the entire serialized payload and the human render, for every below-minimum cell, for the trend tokens `improved`, `regressed`, `trend`, and "better"/"worse" phrasings; assert none appears anywhere, not just in the row.
4. Assert the below-minimum row still carries the caveat when the kinds differ (the caveat is not suppressed by the verdict).
5. Mutation arm: a temp copy that assigns a verdict from the value alone below the minimum must fail this case.
6. Assert equal values at sample ≥ 5 yield `flat`, not `improved`, so direction is not a coin flip.

**Expected Outcome**:
- A hard minimum at five, closed verdicts above it, and a payload-wide ban on trend language below it.

#### TC-METRICS-032 - `not-established` and the comparison ordering are declared, and the log stays byte-identical

**Scenario Type**: Corner Case
**Impact Level**: Important
**Priority**: High
**Related IDs**: AC-F4-1, F-4, DM-5, NFR-3
**Test Type(s)**: Integration
**Automation Level**: Automated
**Target Layer / Location**: `tests/behaviour/metrics-comparisons.test.ts` (unestablished and ordering cells)
**Tags**: @backend, @behaviour, @comparison

**Objective**: Prove a row with no measurable after value is classified rather than omitted or zero-filled, and that ordering is vocabulary-driven.

**Preconditions**:
- A fixture where `MET-CYCLE-TIME` has no usable after-evidence in the window while the other two do; a months-long-window log fixture (the second window shape, `AMB-TP-4`); a shuffled log row order in a third fixture.

**Steps**:
1. Assert the row still exists for the unmeasurable metric, with `after.value` absent, `after.sampleSize == 0`, and `verdict == "not-established"` (a member of the closed set).
2. Assert the row is not silently removed from `comparisons[]` and not counted in `omitted`.
3. Assert both windows are carried verbatim on a months-long-window fixture, that the report renders normally with no refusal on window-length grounds (success envelope, exit `0`, no downgraded verdict invented; F-4, DM-5), and that no equal-length claim is made in that cell.
4. Reorder the log's rows and re-run; assert the row order is unchanged (vocabulary order, not log order).
5. Hash the log before and after; assert equality, including the committed `comparisons[]` list.

**Expected Outcome**:
- `not-established` is declared, ordering is source-independent, and the log is untouched.

#### TC-METRICS-033 - A committed `comparisons[]` record is consumed as data, never restated as the report's own truth

**Scenario Type**: Negative
**Impact Level**: Critical
**Priority**: High
**Related IDs**: AC-F4-1, AC-F2-1, DEC-3
**Test Type(s)**: Integration
**Automation Level**: Automated
**Target Layer / Location**: `tests/behaviour/metrics-comparisons.test.ts` (committed-record cells)
**Tags**: @backend, @behaviour, @readonly

**Objective**: Prove the delivered no-recompute rule survives the new surface: the authored comparison is read as data, and the report's view is a live evaluation, not a reprint.

**Preconditions**:
- A fixture log carrying one committed `delivery.ceremony.comparison.v1` record with a distinctive verdict and disclosure text; evidence that yields a different live verdict for the same metric.

**Steps**:
1. Assert the report's `comparisons[]` row for that metric is computed from the fixture evidence (its `after.sampleSize` and `verdict` follow the live evidence, not the committed record).
2. Assert the committed record's distinctive disclosure text does not appear in the report payload attributed as the report's own finding, and that the committed record is never presented as "the committed comparison" verdict of this invocation.
3. Assert no builder was invoked to author: the append/write recorder is `0` and the delivered builder's public entry point is not imported by the metrics domain (structural import assertion).
4. Assert the log's record list is unchanged (count and bytes).
5. Assert the report's row still cites `definitionRef` to the log path plus commit, so traceability does not depend on the authored record.

**Expected Outcome**:
- Authored data consumed, never restated or rewritten; the live view is distinguishable from the committed record.

#### TC-METRICS-040 - `metrics.dispatch` equals the delivered spend fold for the same selection (`SC-M2-S6-01`)

**Scenario Type**: Happy Path
**Impact Level**: Critical
**Priority**: High
**Related IDs**: AC-F5-1, F-5, DM-3, DEC-14, `SC-M2-S6-01`
**Test Type(s)**: Integration, Contract
**Automation Level**: Automated
**Target Layer / Location**: `tests/behaviour/metrics-dispatch.test.ts` (new); `tests/fixtures/spend/harness.ts` reused
**Tags**: @backend, @behaviour, @parity

**Objective**: Prove the seed's parity claim in one process: the same selection yields the same numbers from `spend --ref` and from `metrics.dispatch`, with breakdown sums equal to the totals.

**Preconditions**:
- One seeded temp store holding telemetry with role and model attribution on every step for one ref (the `spend` seed fixture shape, which is fully attributable — the `DEC-14` exact-equality scope), plus a `phase.transition` history and a declared threshold.
- Both commands composed from the same production modules with the same injected clock.

**Steps**:
1. Run `spend --ref` and capture `data`. Assert `breakdowns.role` and `breakdowns.model` are non-empty and that each array's token sum equals the five-class total computed independently in the test (the seed's spend half, with `agentRole` → `role` and `totals.tokens` → the five-class sum per Appendix C).
2. Run `metrics --ref` and capture `dispatch`. Assert `dispatch.tokensByClass`, `dispatch.costTotals` (total, per-model, `sparse`), and `dispatch.restarts` are **deep-equal** to the spend report's corresponding values.
3. On this fully attributable seed fixture — the exact-equality scope `AC-F5-1` pins under `DEC-14` — assert `dispatch.perAgent` sums (calls and tokens) equal the dispatch totals with no row invented, and that `dispatch.breakdowns.role` and `.model` are non-empty with token sums equal to the same totals.
4. Assert the dispatch figures were not recomputed: the spend fold's own `reconciliation` block values are cited verbatim (basis and verdict names) and no field is derived by re-pricing.
5. Assert `telemetryState == "present"`.
6. Assert both runs leave the store byte-identical.

**Expected Outcome**:
- Parity in both halves of the seed: spend's breakdown sums equal its totals, and the metrics dispatch block repeats the fold's figures exactly for the same selection. The per-agent equality holds where `DEC-14` makes it exact — this fully attributable fixture; the unattributable remainder form is `TC-METRICS-042`.

#### TC-METRICS-041 - The dispatch block cites the reconciliation disclosure and never re-derives or re-prices

**Scenario Type**: Contract
**Impact Level**: Critical
**Priority**: High
**Related IDs**: AC-F5-1, F-5, DM-3, RSK-2
**Test Type(s)**: Integration, Contract
**Automation Level**: Automated
**Target Layer / Location**: `tests/behaviour/metrics-dispatch.test.ts` (disclosure cells); `tests/checks/metrics-mutants.test.ts` (mutants)
**Tags**: @backend, @behaviour, @honesty

**Objective**: Prove the second surface does not become a second calculator: reconciliation and tolerance stay spend's own and are cited by reference.

**Preconditions**:
- A fixture whose spend reconciliation yields a declared tolerance and a verdict name (e.g. `within`/`exceeds`) with a distinctive basis string; a cost model set where re-pricing would produce a different total.

**Steps**:
1. Assert the dispatch block carries the reconciliation disclosure's basis and verdict **names** (the delivered vocabulary), and that the names equal the spend report's names for the same selection.
2. Assert no tolerance arithmetic is recomputed: the dispatch block contains no tolerance number that spend does not report, and the sum of per-model costs is not re-derived into a new total (the total equals spend's total, including when `sparse` is true).
3. Assert the cost totals are in harness-reported units, unchanged, and that no price table, multiplier, or currency conversion appears in the metrics modules (import/scan assertion).
4. Mutation arms: (i) re-price a model cost → fails; (ii) recompute the reconciliation verdict from raw numbers → fails; (iii) drop `sparse` → fails.
5. Assert a `sparse` fixture reports `sparse: true` and still equals spend's figures, rather than repairing the gap.

**Expected Outcome**:
- Citation, not recomputation; sparsity and reconciliation survive the composition unchanged.

#### TC-METRICS-042 - Breakdown ordering, cost sparsity, and null attribution are preserved; breakdown sums equal totals and the unattributable remainder is disclosed

**Scenario Type**: Corner Case
**Impact Level**: Important
**Priority**: High
**Related IDs**: AC-F5-1, F-5, DM-3, DEC-14
**Test Type(s)**: Integration
**Automation Level**: Automated
**Target Layer / Location**: `tests/behaviour/metrics-dispatch.test.ts` (ordering and null cells)
**Tags**: @backend, @behaviour, @parity

**Objective**: Prove the delivered fold's ordering and null semantics survive composition, and that the sums-equal-totals rule is asserted against the population it actually covers rather than being assumed.

**Preconditions**:
- A fixture with four roles whose tokens are deliberately not in insertion order (including a tie on tokens to exercise the value-ascending tiebreak), one model with a null cost, and three steps with a null `agentRole`/`model` (the delivered `unattributable-step` state).

**Steps**:
1. Assert `dispatch.breakdowns.role` orders by tokens descending, then value ascending, with the null row last; assert the same for `.model`.
2. Assert the token sums of each `role` and `model` breakdown array still equal the delivered total, including the null row's contribution (the delivered fold keeps a `value: null` row for unattributable records).
3. Assert `dispatch.perAgent` carries the declared per-agent members for every row, and that on the fully attributable twin its sums equal the dispatch totals exactly (`DEC-14`'s exact-equality half). On this null-attribution fixture — `DEC-14`'s remainder half — assert the per-agent sums equal the total **minus** the unattributable share the delivered fold discloses (`unattributable-step`), that the breakdowns keep the null-value row and still sum to the full total, and that no `"unknown"`/`""` row was invented to force equality.
4. Assert the null-attribution steps are disclosed through the delivered warning/absence vocabulary rather than defaulted, and that the disclosed count reconciles the per-agent remainder with the total.
5. Assert `costTotals.sparse` is `true` with a null per-model cost preserved as null (never `0`).
6. Assert the ordering is identical to the spend report's ordering for the same selection.

**Expected Outcome**:
- Delivered ordering and null semantics preserved; the `role` and `model` breakdown sums equal the full total; the per-agent remainder is reconciled by the disclosed unattributable share with no invented row; sparsity is never repaired.

#### TC-METRICS-050 - A crossing raises exactly one alarm with every member echoed, and the repeat is byte-identical (`SC-M2-S6-02`)

**Scenario Type**: Happy Path
**Impact Level**: Critical
**Priority**: High
**Related IDs**: AC-F6-1, F-6, DM-4, DEC-5, `SC-M2-S6-02`
**Test Type(s)**: Integration, Contract
**Automation Level**: Automated
**Target Layer / Location**: `tests/behaviour/metrics-alarms.test.ts` (new); golden `tests/fixtures/metrics/golden/crossing.txt`
**Tags**: @backend, @behaviour, @alarm

**Objective**: Prove the seed verbatim: one `burn-rate` alarm for the ref with the threshold echoed, and a repeat evaluation that adds no second alarm.

**Preconditions**:
- A project-committed config document declaring `metrics.burn-rate` `{threshold: 1000, basis: "tokens", window: "14d"}`; telemetry whose measured 14-day token total is `1200`; clock fixed at `NOW`; a second fixture on the `cost` basis with a sparse cost set.

**Steps**:
1. Run `metrics --json`; assert `alarms` has exactly **one** entry.
2. Assert the entry's key set matches DM-4 exactly: `kind: "burn-rate"`, `ref` equal to the evaluated ref, `basis: "tokens"`, `threshold: 1000`, `measured: 1200`, `window: {start: NOW − 14d, end: NOW}`, `crossedAt: NOW` (the evaluation's read instant, therefore identical to `window.end`; DM-4, DEC-5), and no `sparse` member on the tokens basis.
3. Assert `alarmEvaluation` is `{kind: "burn-rate", status: "evaluated", threshold: 1000, basis: "tokens", window: {…}}` — the same three members echoed.
4. Run the same invocation again over unchanged facts; assert the machine `data` and the human text are byte-identical (envelope timing/run id excluded) and `alarms` still holds exactly one entry.
5. Run the cost-basis fixture; assert `basis: "cost"`, `measured` equals the fold's cost total in harness-reported units, and `sparse: true` is present.
6. Assert the alarm is report data: no event, notification, or gate output is produced, and no store gains a byte.

**Expected Outcome**:
- Exactly one alarm per crossing with every echoed member; a second evaluation is identical, so "no duplicate for the same crossing" holds by determinism rather than by persisted state.

#### TC-METRICS-051 - The crossing boundary is exactly `measured >= threshold` on both declared bases

**Scenario Type**: Corner Case
**Impact Level**: Critical
**Priority**: High
**Related IDs**: AC-F6-1, AC-F6-5, F-6, DM-4, DEC-5
**Test Type(s)**: Integration
**Automation Level**: Automated
**Target Layer / Location**: `tests/behaviour/metrics-alarms.test.ts` (boundary cells)
**Tags**: @backend, @behaviour, @alarm

**Objective**: Prove the comparison operator and the basis arithmetic are exact, so neither an off-by-one nor a unit mismatch can hide.

**Preconditions**:
- Threshold `1000` on the `tokens` basis with measured `999`, `1000`, `1001`; threshold `12.5` on the `cost` basis with measured `12.49`, `12.5`, `12.5001` (harness-reported units, no rounding).

**Steps**:
1. `measured == 999`: assert `alarms` empty and `alarmEvaluation.status == "evaluated"` with the threshold echoed.
2. `measured == 1000`: assert exactly one alarm (equality crosses).
3. `measured == 1001`: assert exactly one alarm.
4. Repeat the three steps on the cost basis and assert the equality case crosses and the below case does not, with no float repair (the measured value is echoed as the fold reports it).
5. Assert the tokens basis measures the five-class sum and not a single class: a fixture whose largest single class is below the threshold but whose sum is above crosses, while the single-class-only twin does not.
6. Assert the window used is the declared `window` and not the report's evidence window (a fixture where the two lengths differ makes this visible).

**Expected Outcome**:
- Crossing at equality on both bases, no off-by-one, no basis conflation, and the declared window is the one measured.

#### TC-METRICS-052 - An undeclared node classifies `threshold-undeclared` and invents no default

**Scenario Type**: Corner Case
**Impact Level**: Critical
**Priority**: High
**Related IDs**: AC-F6-2, F-6, DM-6, DEC-4
**Test Type(s)**: Integration
**Automation Level**: Automated
**Target Layer / Location**: `tests/behaviour/metrics-alarms.test.ts` (undeclared cells)
**Tags**: @backend, @behaviour, @declaration

**Objective**: Prove an undeclared threshold is a supported steady state that raises nothing — not an error and not a silent default.

**Preconditions**:
- Cells: no project-committed config document; a document with no `metrics` node; a document with a `metrics` node but no `burn-rate` member; a document with unrelated nodes only. A declared-node twin for each.

**Steps**:
1. For each cell, assert exit `0` and `alarmEvaluation == {kind: "burn-rate", status: "threshold-undeclared"}` — with **no** `threshold`, `basis`, or `window` member (structural key assertion).
2. Assert `alarms` is the empty array and no `burn-rate` entry exists anywhere.
3. Assert the rest of the report is complete and unaffected: four metric entries, dispatch, comparisons, `omitted`/`truncated`.
4. Assert no default threshold appears in the human render (scan for the numeric literals a default would plausibly use, plus an assertion that the render names the undeclared state).
5. Run the declared twin and assert exactly one alarm where the fixture crosses, proving the undeclared cell is attributable to the declaration.
6. Assert the config document is byte-unchanged (absence is never repaired by a write).

**Expected Outcome**:
- `threshold-undeclared`, empty alarms, no invented default, and an otherwise complete report at exit `0`.

#### TC-METRICS-053 - Telemetry absence classifies the evaluation `telemetry-absent` while other metrics still measure

**Scenario Type**: Corner Case
**Impact Level**: Critical
**Priority**: High
**Related IDs**: AC-F6-3, F-6, F-8, DEC-11
**Test Type(s)**: Integration
**Automation Level**: Automated
**Target Layer / Location**: `tests/behaviour/metrics-alarms.test.ts` (absence cells); golden `tests/fixtures/metrics/golden/telemetry-absent.txt`
**Tags**: @backend, @behaviour, @absence

**Objective**: Prove the composite report keeps the non-telemetry evidence visible when telemetry is missing, and declares the evaluation unusable rather than firing or silently succeeding.

**Preconditions**:
- A ref with a complete `phase.transition` history, ceremony records, and corpus rows, but no telemetry records; a declared `metrics.burn-rate` node; a present-telemetry twin.

**Steps**:
1. Assert `dispatch.telemetryState == "absent"`, that the delivered telemetry-absence condition is named verbatim, and that **no** dispatch figures render (`tokensByClass`, `costTotals`, `restarts`, `perAgent`, `breakdowns` all absent).
2. Assert `alarmEvaluation == {kind: "burn-rate", status: "telemetry-absent"}` with no threshold/basis/window echoed and `alarms` empty.
3. Assert the cycle-time, ceremony-share, CI-failure-rate, and escaped-defect entries still report their measured values (this is the whole point of DEC-11's composite posture).
4. Assert exit `0` and that no `spend.telemetry-absent` refusal is borrowed into an error envelope.
5. Assert the present-telemetry twin produces dispatch figures and a normal evaluation.
6. Assert the human render names the absence and does not print a `0` token or cost total.

**Expected Outcome**:
- Classified telemetry absence with no figures and no alarm, while every non-telemetry metric remains measured.

#### TC-METRICS-054 - Every malformed-node class is refused `config.value.invalid` before any telemetry or log read

**Scenario Type**: Negative
**Impact Level**: Critical
**Priority**: High
**Related IDs**: AC-F6-4, F-6, DM-6, DEC-4
**Test Type(s)**: Integration, Unit
**Automation Level**: Automated
**Target Layer / Location**: `tests/behaviour/metrics-burn-rate-config.test.ts` (new); `tests/structure/config-contract.test.ts` (node half)
**Tags**: @backend, @behaviour, @refusal

**Objective**: Prove declaration validation is a gate in front of the read pass, so a hostile or malformed declaration cannot steer a half-completed evaluation.

**Preconditions**:
- Defect cells: `threshold` `0`, `-1`, `"1000"` (string), `null`, absent; `basis` `"money"`, `"costs"`, absent; `window` `"0d"`, `"91d"`, `"30"`, `"30 days"`, `"-1d"`, absent; a non-mapping `burn-rate` value; an unknown extra member only (a tolerated-shape control). At-limit valid twins: `threshold: 0.01`, `window: "1d"`, `window: "90d"`, both bases.
- Read counters armed on telemetry, log, ceremony, transition, and corpus seams; a tree snapshot.

**Steps**:
1. For each defect cell, assert exit `1`, `data.error.code == "config.value.invalid"`, `category == "user"`, and the `not_landed` consequence.
2. Assert **all** read counters are `0`, proving the validation precedes every read of the sources the evaluation would use.
3. Assert no partial report renders and no `metrics.baseline-unreadable` or `state.*` identity is emitted for a node defect.
4. Assert the summary names the offending member and the violated rule without echoing unbounded document bytes.
5. Run the at-limit valid twins and assert exit `0` with an evaluation, proving the bound is exact rather than approximate.
6. Assert the config document is byte-unchanged and that no delivered config node or layer behaviour changed (the §8.5 additive claim, asserted as an unchanged resolved-tree classification for a document without the node).

**Expected Outcome**:
- Every node defect is refused pre-read with zero reads and no partial report; the boundary values are accepted.

#### TC-METRICS-055 - Below the threshold the shape differs from the crossing case only by the empty alarm row

**Scenario Type**: Corner Case
**Impact Level**: Critical
**Priority**: High
**Related IDs**: AC-F6-5, F-6, DM-4, DEC-5
**Test Type(s)**: Integration, Contract
**Automation Level**: Automated
**Target Layer / Location**: `tests/behaviour/metrics-alarms.test.ts` (below-threshold cells); golden `tests/fixtures/metrics/golden/below-threshold.txt`
**Tags**: @backend, @behaviour, @alarm

**Objective**: Prove the absence of an alarm is a declared result rather than an unobservable side effect: the below-threshold payload is structurally identical to the crossing payload except for `alarms`.

**Preconditions**:
- Two fixtures identical except for the measured total (`1200` above, `980` below the `1000` threshold); same node, same window, same other evidence.

**Steps**:
1. Assert `alarms` is `[]`, `alarmEvaluation.status == "evaluated"`, and the threshold/basis/window are echoed.
2. Compare the two payloads' key sets at every level; assert they are identical (a structural walk, not a text diff).
3. Assert the only value difference is `alarms` plus the dispatch `tokensByClass`/`costTotals` totals that legitimately differ (the measured spend), and that the metric entries and comparisons are otherwise equal.
4. Assert the human render names the evaluated state and the threshold, and prints no alarm line.
5. Assert exit `0` and a byte-identical repeat.
6. Assert the below-threshold fixture with an undeclared node is a *different* state (`threshold-undeclared`), so "no alarm" has two distinguishable causes.

**Expected Outcome**:
- The below-threshold case declares its evaluation and differs from the crossing case only by the alarm row; the two no-alarm causes stay distinguishable.

#### TC-METRICS-056 - The alarm set is a derived view: no persisted state, no duplicate, no write on the alarm path

**Scenario Type**: Contract
**Impact Level**: Critical
**Priority**: High
**Related IDs**: AC-F6-1, F-6, DEC-5, NFR-3
**Test Type(s)**: Integration, Contract
**Automation Level**: Automated
**Target Layer / Location**: `tests/behaviour/metrics-alarms.test.ts` (derivation cells); `tests/behaviour/metrics-write-discipline.test.ts`
**Tags**: @backend, @behaviour, @alarm

**Objective**: Prove deduplication is a determinism invariant, not a stored flag — the read-only posture applied to alarms.

**Preconditions**:
- A crossing fixture; an append/event recorder armed; a state-scope snapshot; a sequence where the fixture is evaluated 5 times, then changed to below-threshold, then back to crossing.

**Steps**:
1. Evaluate 5 times over unchanged facts; assert exactly one alarm each time and identical payload bytes each time.
2. Assert no state record, file, marker, or counter is created by the evaluation (tree snapshot equality plus append/event counters at `0`).
3. Change the fixture to below-threshold and evaluate; assert `alarms == []` — nothing "remembers" the crossing.
4. Change it back to crossing and evaluate; assert exactly one alarm and that it is byte-identical to the first run's alarm (same echoed members, same `crossedAt` for the same clock).
5. Assert the alarm's `crossedAt` is the evaluation read instant (not a stored first-crossing time): advance the clock and assert it moves with the clock.
6. Assert no delivered surface (board, brief, status) gains an alarm row (payload key-set assertions on those reports over the same store).

**Expected Outcome**:
- A pure derived view: one alarm per evaluation, no persisted alarm state, no duplicate mechanism, no cross-surface leak.

#### TC-METRICS-060 - Escaped defects is a curated floor over the three closed classes with artifact-plus-anchor citations

**Scenario Type**: Happy Path
**Impact Level**: Critical
**Priority**: High
**Related IDs**: AC-F7-1, F-7, DM-2, DEC-2
**Test Type(s)**: Integration, Contract
**Automation Level**: Automated
**Target Layer / Location**: `tests/behaviour/metrics-escaped-defects.test.ts` (new)
**Tags**: @backend, @behaviour, @curation

**Objective**: Prove each of the three closed classes is counted from committed, artifact-anchored evidence, and that the honesty limits travel with the number.

**Preconditions**:
- A committed corpus fixture with: one post-gate review artifact recording a defect after the gates were green; one committed CI observation with a `red` outcome on the landed head; one retro finding attributing a defect to the landed change; plus conforming rows that must not be counted (a pre-gate review finding, a green CI observation, a retro finding attributing a defect to another change).

**Steps**:
1. Assert `measurementKind == "curated-count"`, `basis == "committed-evidence-corpus"`, and that the entry carries **no** `definitionRef` (non-`MET-` member).
2. Assert the value is `3` and that `incidents[]` holds exactly three rows with the three distinct classes `post-gate-review`, `landed-ci-failure`, `retro-attributed`.
3. Assert each row carries `artifact` (a committed path) plus `anchor` (a resolvable anchor within it) and an `observedAt` from the evidence, and that the test resolves each citation against the fixture tree.
4. Assert the per-class counts are reported and sum to the total.
5. Assert the floor caveat is present verbatim (curated floor, not a census; unrecorded incidents invisible; artifact-anchored only; committed-evidence rule) — compared against the declared constant, not a paraphrase.
6. Assert `sample` reflects the curated population and that no `MET-` id is allocated anywhere (scan of the vocabulary constant plus the payload).
7. Assert the conforming-but-uncounted rows appear in no incident row and in no class count.

**Expected Outcome**:
- A curated floor of three, each incident attributable to a committed artifact plus anchor, with the honesty limits stated verbatim.

#### TC-METRICS-061 - No committed evidence yields `UNAVAILABLE`, never a zero count

**Scenario Type**: Negative
**Impact Level**: Critical
**Priority**: High
**Related IDs**: AC-F7-2, F-7, F-8, DEC-11
**Test Type(s)**: Integration
**Automation Level**: Automated
**Target Layer / Location**: `tests/behaviour/metrics-escaped-defects.test.ts` (no-evidence cells)
**Tags**: @backend, @behaviour, @absence

**Objective**: Prove "we found none" is never reported as "there were none".

**Preconditions**:
- Cells: an empty evidence corpus; a corpus whose only rows are out of window; a corpus whose only rows are non-committed paths (see `TC-METRICS-062`); a corpus with exactly one counted incident (the positive control).

**Steps**:
1. For each empty-class cell, assert status `UNAVAILABLE`, no `value` member, an empty `incidents[]`, and a named absence reason.
2. Assert the numeric `0` appears in no `value`, no per-class count, and no total for these cells (structural assertion over the entry).
3. Assert the human render says the count is unavailable and never prints `0 escaped defects`.
4. Run the one-incident control and assert `value == 1` with a full citation, proving the absence classification is attributable to the evidence state.
5. Assert exit `0` in every cell.

**Expected Outcome**:
- `UNAVAILABLE` for no evidence, `1` for one cited incident, and no zero-count measurement anywhere.

#### TC-METRICS-062 - Non-evidence (uncommitted, `tmp/`, `.ai/local/`, uncited, out-of-window) is never counted

**Scenario Type**: Negative
**Impact Level**: Critical
**Priority**: High
**Related IDs**: AC-F7-1, F-7, §20
**Test Type(s)**: Integration
**Automation Level**: Automated
**Target Layer / Location**: `tests/behaviour/metrics-escaped-defects.test.ts` (non-evidence cells); `tests/checks/metrics-mutants.test.ts` (mutant)
**Tags**: @backend, @behaviour, @curation

**Objective**: Prove the curation rule is enforced per row rather than described: a defect recorded in the wrong place does not become a measurement.

**Preconditions**:
- Rows in each prohibited class: a defect described under `tmp/`; one under `.ai/local/`; one in an untracked file inside the fixture checkout; one in a committed file with no anchor (a claim without a locator); one in a committed file whose anchor does not resolve; one whose date falls outside the window; one attributed to a different change. Plus one conforming row.

**Steps**:
1. Run the report; assert only the conforming row is counted and `value == 1`.
2. Assert no prohibited row appears in `incidents[]` and no class counter includes one.
3. Assert the prohibited populations are disclosed as excluded (a counted exclusion or an explicit curation statement), not silently dropped.
4. Mutation arm: a temp copy that counts a row without an anchor must produce `2` and fail this case.
5. Assert the fixture tree is unchanged (no evidence artifact was created or edited by the scan).

**Expected Outcome**:
- Only committed, artifact-anchored, in-window rows count; the negatives are excluded and disclosed.

#### TC-METRICS-063 - The incident display cap counts its omissions while per-class totals stay whole

**Scenario Type**: Corner Case
**Impact Level**: Important
**Priority**: High
**Related IDs**: AC-F7-1, F-7, NFR-4, DM-8
**Test Type(s)**: Integration
**Automation Level**: Automated
**Target Layer / Location**: `tests/behaviour/metrics-escaped-defects.test.ts` (cap cells); `tests/behaviour/metrics-bounds.test.ts`
**Tags**: @backend, @behaviour, @bounds

**Objective**: Prove the display cap bounds the listing without falsifying the count.

**Preconditions**:
- A fixture with 8 counted incidents (at cap) and one with 11 (over cap), each spanning all three classes; an under-cap control of 2.

**Steps**:
1. At 8: assert `incidents[]` length 8, `omitted == 0`, `truncated == false`.
2. At 11: assert `incidents[]` length 8 with the first 8 in the declared order (tail-first drop), `omitted == 3`, `truncated == true`.
3. Assert the entry's `value` is `11` and the per-class counts sum to `11` — the cap never truncates the measurement.
4. Assert the dropped incidents are not counted in `omitted` twice and that the human render prints the omission marker consistently with `omitted`.
5. Assert the ordering of the listed incidents is deterministic (a stable, declared key), by re-running over a shuffled corpus.

**Expected Outcome**:
- A capped listing with a counted shortfall and an untruncated total.

#### TC-METRICS-070 - No section renders a zero for absent evidence, and an all-absent report still exits 0

**Scenario Type**: Negative
**Impact Level**: Critical
**Priority**: High
**Related IDs**: AC-F8-1, F-8, DEC-11
**Test Type(s)**: Integration, Contract
**Automation Level**: Automated
**Target Layer / Location**: `tests/behaviour/metrics-absence.test.ts` (new)
**Tags**: @backend, @behaviour, @absence

**Objective**: Prove the composite absence posture: every section declares its own state, and the worst-case evidence picture is still a report.

**Preconditions**:
- A checkout with no telemetry, no ceremony records, no transition history, no baseline log, no config node, and an empty corpus — the all-absent fixture; plus six single-absence fixtures, each with everything else present.

**Steps**:
1. Run the all-absent fixture; assert exit `0` and a complete payload with the four entries in order.
2. Assert every entry is `UNAVAILABLE` with no `value`, `dispatch.telemetryState == "absent"` with the delivered condition named and no figures, `alarmEvaluation.status == "telemetry-absent"`, `comparisons[]` carrying `not-established` rows (or an empty array with a declared reason), and `alarms == []`.
3. Assert no `0` appears in any measurement position across the payload (a structural walk over the declared numeric fields, not a global string search).
4. For each single-absence fixture, assert only that section changes state and the others still measure — proving per-section classification.
5. Assert `omitted == 0` and `truncated == false`: absence is not counted as omission.
6. Assert no delivered refusal identity is emitted on any absence path.

**Expected Outcome**:
- Every section classified, no zero fabrication, exit `0`, and per-section independence proven by the six fixtures.

#### TC-METRICS-071 - Store damage on any read keeps the delivered `state.*` identity and is never re-projected as absence

**Scenario Type**: Negative
**Impact Level**: Critical
**Priority**: High
**Related IDs**: AC-F8-1, F-8, DM-7, NFR-3
**Test Type(s)**: Integration, Contract
**Automation Level**: Automated
**Target Layer / Location**: `tests/behaviour/metrics-store-damage.test.ts` (new); `tests/behaviour/verify-support.ts` (`guardStore`) reused
**Tags**: @backend, @behaviour, @damage

**Objective**: Prove damage and absence are different states, and that damage keeps the delivered identities instead of being softened into an empty report.

**Preconditions**:
- `guardStore` conditions applied one at a time to each read source: telemetry store, ceremony store, phase/transition store, audit ledger. Modes: unreadable, permission-denied, torn record, wrong record kind, malformed payload, and a verified-read failure.

**Steps**:
1. For each source × mode, run the report and assert the error envelope carries the delivered `state.*` code for that condition with its own projection class and its own exit (`1` or `2` per the delivered row).
2. Assert no absence classification is emitted for the damaged source: `telemetryState` is not `absent`, entries are not row-absent, and `alarmEvaluation.status` is not `telemetry-absent` for a damaged telemetry store.
3. Assert no partial report renders and that healthy sources are not reported either (the command withholds rather than composing a misleading partial).
4. Assert the store is byte-unchanged and no salvage/repair write occurred.
5. Assert a readable twin for each mode renders normally, proving the damage is attributable to the store.
6. Assert the damaged-read identity is never `metrics.baseline-unreadable` (that identity is scoped to the committed log).

**Expected Outcome**:
- Delivered `state.*` identities with their own projections on every damaged source; damage never rendered as absence.

#### TC-METRICS-072 - A zero-fabrication sweep over every numeric field finds no zero in an absent row

**Scenario Type**: Negative
**Impact Level**: Critical
**Priority**: High
**Related IDs**: AC-F8-1, F-8, DEC-11
**Test Type(s)**: Integration, Contract
**Automation Level**: Automated
**Target Layer / Location**: `tests/behaviour/metrics-absence.test.ts` (sweep cells); `tests/checks/metrics-mutants.test.ts` (mutants)
**Tags**: @backend, @behaviour, @honesty

**Objective**: Prove the "no zero for absent evidence" rule as a mechanical invariant over the payload rather than a per-case review.

**Preconditions**:
- A matrix of fixtures covering every evidence state per section (measured, partial, unavailable, row-absent, telemetry-absent, undeclared, damaged-excluded) — the absence matrix.

**Steps**:
1. Walk the payload structurally: for every row whose status/state declares absence, assert the associated numeric field is absent (not `0`, not `null` presented as a measurement).
2. Assert the converse for measured rows: a measured row always carries a number, so the sweep cannot pass by simply deleting all numbers.
3. Assert counters (`omitted`, exclusion counts) are the only numeric fields allowed to be `0` when the corresponding population is empty, and that the sweep encodes that exception explicitly.
4. Assert the human render agrees: an absent row never prints a numeric value or a `0` placeholder.
5. Mutation arms: (i) zero-fill the CI rate for an all-unobserved population → fails; (ii) zero-fill the escaped-defect count for an empty corpus → fails; (iii) print `0 tokens` for absent telemetry → fails.

**Expected Outcome**:
- A payload-wide proof that absence never becomes a number, with counter exceptions declared rather than tolerated.

#### TC-METRICS-080 - `metrics` is the 24th prompt-required family with every count pin moved

**Scenario Type**: Happy Path
**Impact Level**: Critical
**Priority**: High
**Related IDs**: AC-F9-1, F-9, DEC-9
**Test Type(s)**: Contract, Integration
**Automation Level**: Automated
**Target Layer / Location**: `tests/structure/metrics-mounting.test.ts` (new); `tests/fixtures/metrics/mounting.ts` (new); the ten pinning suites from `GAP-T5`
**Tags**: @backend, @structure, @mounting

**Objective**: Prove the mount is atomic: one new family, one new count, no stale pin anywhere, and no other family disturbed.

**Preconditions**:
- `tests/fixtures/metrics/mounting.ts` capturing the delivered 23-entry base as one constant; the `PINNING_FILES` list extended with the metrics mounting suite; a synthetic brand; a real temporary checkout for the composition cell.

**Steps**:
1. Assert the captured base constant has 23 entries and that its last member is `steer`.
2. Assert `PROMPT_REQUIRED_COMMANDS` equals base + `metrics`, has length **24**, contains `metrics` exactly once, and ends with `metrics`.
3. Assert root `--help` renders `metrics` as a family line and that the family line count is **24**.
4. Assert every file in the extended `PINNING_FILES` list pins 24 (no `toHaveLength(23)`, no `toBe(23)`), and run a repo-wide scan for a stale family-count literal `23` in the named suites; assert the scanner reports none and that it **fails** when handed a planted stale file (the arm is proven, not assumed).
5. Assert the production composer, with no test-supplied metrics runtime, produces a metrics handler that answers `metrics --json` at exit `0` over an empty store (the "composed but not advertised is dropped" rule).
6. Assert the delivered 23-family prefix and the per-family help entries are unchanged (see `TC-METRICS-083`).

**Expected Outcome**:
- A 24th family in the exact position, count pins moved together, and a scan arm that detects a stale pin.

#### TC-METRICS-081 - `metrics --help` answers at exit 0 with the six declared sections and no side effect

**Scenario Type**: Happy Path
**Impact Level**: Important
**Priority**: High
**Related IDs**: AC-F9-1, F-9
**Test Type(s)**: Integration
**Automation Level**: Automated
**Target Layer / Location**: `tests/behaviour/metrics-help.test.ts` (new)
**Tags**: @backend, @behaviour, @help

**Objective**: Prove the family help is a static answer with the declared content and no read of anything.

**Preconditions**:
- An empty environment (no state root, no config, no git); all read/transport/tracker/spawn counters armed; synthetic brand.

**Steps**:
1. Run `metrics --help`; assert exit `0`.
2. Assert the output contains a summary, a usage line naming the binary and the report grammar, an options group covering `--ref`, `--from`, `--through`, `--json`, at least one example, the exit codes `0`/`1`/`2`, and a see-also pointer.
3. Assert every read, transport, tracker, and spawn counter is `0` — help never touches state, store, git, network, or configuration.
4. Assert `metrics --version` answers at exit `0` from the same static inventory.
5. Assert the human text contains no hardcoded product or binary name outside the brand seam (swap the brand and re-assert).
6. Assert `metrics --help --json` still answers help rather than attempting a report (the delivered help precedence).

**Expected Outcome**:
- Complete, correct, side-effect-free help; `--version` answers; the brand seam supplies the name.

#### TC-METRICS-082 - The reference page and coverage-inventory row satisfy the coverage check

**Scenario Type**: Contract
**Impact Level**: Critical
**Priority**: High
**Related IDs**: AC-F9-1, F-9
**Test Type(s)**: Contract, Checks
**Automation Level**: Automated
**Target Layer / Location**: `tests/checks/help-guide-coverage.test.ts`, `tests/checks/reference-page-parity.test.ts` (additive assertions); `tests/fixtures/help-guide/coverage.json` (update); `scripts/checks/help-guide-coverage.ts`
**Tags**: @docs, @checks

**Objective**: Prove the documentation half of the mount is checked rather than assumed.

**Preconditions**:
- `coverage.json` gaining the `metrics` command entry and the M2 page path; the page authored at `doc/planning/oss-tooling/milestones/m2/commands/metrics.md` (`GAP-T6`, `AMB-TP-5`).

**Steps**:
1. Assert `runHelpGuideCoverage()` returns `[]` with the new row present.
2. Assert `coverage.json` `commands` contains `metrics` exactly once and `referencePages` contains the M2 page path.
3. Assert the page exists, mentions `--help` and `--version`, documents the grammar (`--ref`, `--from`, `--through`, `--json`), and states the absence and alarm postures.
4. Mutation arms: remove the inventory row → the check fails naming `metrics`; remove `--help` from the page → the check fails naming the page; remove the page → the check fails.
5. Assert the page is the only new page and that no delivered page lost its row (the row count grows by exactly one).
6. Assert `reference-page-parity` finds the page's claims consistent with the served help (the declared options and exit codes appear in both).

**Expected Outcome**:
- Coverage green with a real page and row, and the three mutations each proven to fail.

#### TC-METRICS-083 - Mounting changes no other family and a partial mount is detected

**Scenario Type**: Regression
**Impact Level**: Critical
**Priority**: High
**Related IDs**: AC-F9-1, F-9, RSK-7
**Test Type(s)**: Contract, Integration
**Automation Level**: Automated
**Target Layer / Location**: `tests/structure/metrics-mounting.test.ts` (isolation cells); `tests/checks/metrics-mutants.test.ts`; delivered per-family help goldens
**Tags**: @backend, @structure, @mounting

**Objective**: Prove the mount is additive: nothing else moves, and a half-done mount is detected rather than tolerated.

**Preconditions**:
- Delivered per-family help goldens and payload goldens for every other family; a temp-tree copy facility for mutants.

**Steps**:
1. Assert each delivered family's help output and payload goldens are byte-identical (no regeneration in this change).
2. Assert the other 23 families' composition is unchanged: the same handler set answers, and invoking a sample of them over the same store behaves as before.
3. Mutation arms, each in a temp copy: (i) prompt-set entry added but production composition absent → `fallback.internal` for `metrics`, test fails; (ii) composition present but the prompt-set entry missing → the family is unreachable and the count pin fails; (iii) count moved in the structure suites but not in one help suite → the stale-pin scan fails naming the file; (iv) root help rewritten for another family → its golden fails.
4. Assert the unmutated tree passes all arms' positive twins.

**Expected Outcome**:
- Additive mounting proven from both directions, with four named mutants.

#### TC-METRICS-090 - The `metrics` kind and its one row land with the entry and delivered-row counts moved

**Scenario Type**: Contract
**Impact Level**: Critical
**Priority**: High
**Related IDs**: AC-F10-1(a),(b), DM-7, DEC-8
**Test Type(s)**: Contract, Checks
**Automation Level**: Automated
**Target Layer / Location**: `tests/structure/error-table.test.ts` (D-1, D-4, D-5, D-7); `doc/spec/features/feature-result-contract.md` (D-13)
**Tags**: @backend, @contract, @registration

**Objective**: Prove the registration is exactly one row with the declared fields and that the carrier documents it with the moved counts.

**Preconditions**:
- The delivered `ERROR_TABLE` and `DOMAIN_KINDS`; the carrier document.

**Steps**:
1. Assert `DOMAIN_KINDS` contains `metrics` exactly once and that `entries.filter(domainKind === "metrics")` has length `1` with code `metrics.baseline-unreadable`.
2. Assert the row's category `platform`, `retryable: false`, consequence `not_landed`, projection class `platform-provider`, and that its exit projection is `2` (§8.3).
3. Assert `entries` has length `147`, delivered (spend-exclusion) rows `146`, and every other kind's row count is unchanged from the delivered values (board 2, steer 3, retro 3, ceremony 2, spend 1).
4. Assert `resolveAppErrorCode("metrics.baseline-unreadable")` resolves to that row and that `classifyThrown({kind: "metrics", code: "metrics.baseline-unreadable"})` returns it.
5. Assert the carrier declares `147 machine identities`, `the same 147 identities`, the `metrics` row in its kind inventory, and the allowlist paragraph with `63` and the metrics code.
6. Assert the refusal path over an unparseable log emits a summary naming the condition without echoing document bytes, and that the row's projection yields exit `2` (the behavioral half, cross-referenced with `TC-METRICS-014`).

**Expected Outcome**:
- One declared row, moved counts, a carrier that agrees, and a projection that is actually reachable.

#### TC-METRICS-091 - The allowlist is widened to exactly 63 by declaration, and near misses are rejected

**Scenario Type**: Negative
**Impact Level**: Critical
**Priority**: High
**Related IDs**: AC-F10-1(a),(d), DM-7, NFR-8
**Test Type(s)**: Contract, Negative
**Automation Level**: Automated
**Target Layer / Location**: `tests/structure/error-table.test.ts` (D-3, D-6, D-7); `scripts/checks/error-table-sync.ts` (D-2); `tests/checks/error-table-sync.test.ts`
**Tags**: @backend, @contract, @registration

**Objective**: Prove the closed set grew by exactly one declared code — no family widening, no pattern match, no kind-only escape.

**Preconditions**:
- Both allowlist copies (the sync check's `RESERVED_TWO_SEGMENT_CODES` and the structural mirror).

**Steps**:
1. Assert both copies have length `63` and are set-equal to each other.
2. Assert exactly one member starts with `metrics.` and that it is `metrics.baseline-unreadable`; assert the delivered per-kind membership counts are unchanged except for the one addition.
3. Near-miss probes — each must be rejected by both `resolveAppErrorCode` and the sync check: `metrics.baseline-unreadable.extra`, `metrics.baseline`, `metrics.unreadable`, `metrics.baseline-unreadables`, `metrics.a.b`, `metrics.baseline-unreadablex`.
4. Assert `classifyDomainKind("metrics")` throws and `classifyThrown({kind: "metrics", code: "metrics.baseline-unreadable"})` yields `fallback.internal` — kind-only lookup is contained.
5. Mutation arms: (i) add a second `metrics.*` two-segment code → both copies' exact-membership assertions fail; (ii) replace the exact set with a `metrics.` prefix rule → the near-miss probes start resolving and the case fails; (iii) widen only the mirror → the set-equality assertion fails.
6. Assert no `metrics.` prefix pattern appears in either checker (source scan).

**Expected Outcome**:
- Exactly 63 with exactly one declared metrics code, near misses rejected in both directions, kind-only contained.

#### TC-METRICS-092 - Every Appendix D site moves, the no-leftover scan is clean, and four surfaces agree

**Scenario Type**: Contract
**Impact Level**: Critical
**Priority**: High
**Related IDs**: AC-F10-1(b),(c),(d), Appendix D
**Test Type(s)**: Contract, Checks
**Automation Level**: Automated
**Target Layer / Location**: `tests/structure/error-table.test.ts` (D-4..D-9), `tests/structure/dispatch-attempts-taxonomy.test.ts` (D-10), `tests/structure/verify-gates-suite-map-contract.test.ts` (D-11), `tests/checks/error-table-sync.test.ts` (D-12), `scripts/checks/error-table-sync.ts` (D-2), `doc/spec/features/feature-result-contract.md` (D-13)
**Tags**: @backend, @contract, @registration

**Objective**: Prove the count-pin discipline as one atomic fact: every enumerated site moved, no pre-change value survives, and the four surfaces read the same numbers from one tree.

**Preconditions**:
- The Appendix D site list as the binding locator set, plus the delivered scan's file list (which also covers `ceremony-contract` and `ceremony-nonregression`); the legacy-token list extended by `146`, `145`, `62`, and `+ 112`.

**Steps**:
1. Entry pins: assert the seven `toHaveLength(147)` sites and the two `toHaveLength(146)` delivered-row sites (asserted by group, per file).
2. Allowlist pins: assert the five length assertions and the two test names now read `63` (a name assertion catches a stale label the length check would miss).
3. Non-mirror sites: assert `dispatch-attempts-taxonomy`'s header comment, test name, and length read `147`; assert `verify-gates-suite-map-contract`'s `sourceEntries` and `documentedRows` read `147`.
4. Sync arithmetic: assert the four `BASELINE_ROWS.length + 113` sites, and that the live table length equals `BASELINE_ROWS.length + 113`.
5. No-leftover scan: assert the extended legacy-token list finds no occurrence of `146`, `145`, `62`, or `+ 112` across the named files, and that the scan **detects** a planted stale line (arm proven, not assumed).
6. Four-way agreement: read the classifier, the sync check, the structural mirror, and the carrier from one tree and assert the tuple `147 entries / 146 delivered / 63 allowlist / 1 metrics / 147 documented`.
7. Assert the appendix's own enumeration is satisfied: a case-by-group assertion for each of D-1..D-13, with the site named in the failure message so a missed site is diagnosable.

**Expected Outcome**:
- Every enumerated site at its post-change value in one tree, a clean scan whose detection power is proven, and four surfaces that agree.

#### TC-METRICS-100 - No LLM, network, tracker, provider, credential, timer, socket, or session, and no write anywhere

**Scenario Type**: Negative
**Impact Level**: Critical
**Priority**: High
**Related IDs**: AC-F11-1, NFR-3, NFR-5, NG-4
**Test Type(s)**: Integration, Contract
**Automation Level**: Automated
**Target Layer / Location**: `tests/behaviour/metrics-purity.test.ts` (new); `tests/structure/metrics-imports.test.ts` (new); `tests/checks/{privacy-literals,forbidden-literals}.test.ts` (existing, must stay green)
**Tags**: @backend, @behaviour, @purity

**Objective**: Prove the layer is a local pure read side: no side channel and no write plane exists on any invocation path.

**Preconditions**:
- Recording ports on transport, tracker, provider, credential, timer, socket, and session seams; a state-root and tree snapshot; the ambient-globals guard available.

**Steps**:
1. Run every invocation form (bare, explicit, `--json`, help, `--version`, each refusal path); assert all recording ports report zero calls and that no socket was opened.
2. Assert no timer, interval, daemon, or listener is registered (recorder plus a module scan for timer APIs in the new modules).
3. Assert no credential resolution occurred and that no credential value can appear in any output (registered-sentinel probe in the config document and the corpus, then a substring scan of the payload).
4. Assert the import set of the new domains contains no adapter, provider, network, spawn, or session module (structural import assertion), and that the domain is I/O-free.
5. Assert zero writes: tree snapshots of the state scopes, the log, the config document, ceremony records, and evidence artifacts are byte-identical after every invocation.
6. Assert the brand seam is the only source of the binary name: swap the brand and assert the human text follows, with no product literal in any module (literal scan).
7. Assert no event topic, subscription, or notification is emitted (recorder plus payload key-set assertion).

**Expected Outcome**:
- Purity and read-only discipline proven by recorders and snapshots on every path, not by inspection.

#### TC-METRICS-101 - Two runs are byte-identical on all forms and order is permutation-proof

**Scenario Type**: Corner Case
**Impact Level**: Critical
**Priority**: High
**Related IDs**: AC-F11-2, NFR-2, DM-1
**Test Type(s)**: Integration, Golden
**Automation Level**: Automated
**Target Layer / Location**: `tests/behaviour/metrics-determinism.test.ts` (new); `tests/golden/metrics.test.ts` (new); `tests/fixtures/metrics/golden/**`
**Tags**: @backend, @behaviour, @determinism

**Objective**: Prove determinism is a property of the fold, not of a lucky fixture: identical facts give identical bytes, and source ordering cannot leak in.

**Preconditions**:
- The six declared forms: bare, explicit window, crossing alarm, undeclared threshold, telemetry-absent, insufficient-sample. Four permutation fixtures derived from one canonical fixture by reversing store rows, directory-read order, log row order, and corpus scan order.

**Steps**:
1. For each form, run twice and assert the human text and the machine `data` are byte-identical (envelope timing/run id excluded).
2. Compare each form to its committed golden; assert the regeneration script exists and that a deliberate one-field change produces a diff limited to that field (the regenerate-by-command discipline).
3. For each permutation, assert the `data` bytes equal the canonical run's — in particular `metrics[]`, `comparisons[]`, `alarms[]`, and the breakdown arrays.
4. Assert every array follows its declared order (vocabulary order, breakdown ordering, tail-first drop) with an independent expectation computed in the test.
5. Assert no ordering is influenced by a `Map` insertion accident: a fixture whose store keys sort differently from the evidence values still produces the declared order.
6. Assert the run id and timing are the only members that differ between two runs, and that neither appears inside `data`.

**Expected Outcome**:
- Byte-identical repeats on six forms, four permutations collapsed to one output, and goldens that fail on any undeclared change.

#### TC-METRICS-102 - The machine and human bounds hold at the cap with counted drops

**Scenario Type**: Corner Case
**Impact Level**: Critical
**Priority**: High
**Related IDs**: AC-F11-2, NFR-4, DM-8, `AMB-TP-2`
**Test Type(s)**: Integration
**Automation Level**: Automated
**Target Layer / Location**: `tests/behaviour/metrics-bounds.test.ts` (new); `tests/structure/metrics-contract.test.ts` (constant half)
**Tags**: @backend, @behaviour, @bounds

**Objective**: Prove the caps are measured, not assumed, and that a bounded view never implies completeness.

**Preconditions**:
- Fixtures sized at, just under, and just over `65 536` UTF-8 bytes of serialized `data`, built by growing the corpus-driven figures and the incident/agent populations; human fixtures at, under, and over `200` lines and `16 384` bytes.

**Steps**:
1. Assert a positive measured length first (`> 0`), then assert the at-cap fixture is within the limit and `truncated == false`.
2. Assert the over-cap fixture is within the limit after dropping, that `truncated == true`, and that `omitted` equals the total dropped rows counted per array.
3. Assert the human digest is within `200` lines and `16 384` bytes in every cell, and that the omission marker arithmetic matches `omitted`.
4. Assert the bounds are imported from contract constants (no literal duplication in domain or CLI modules).
5. Mutation arms: (i) raise the cap silently → the at-cap assertion fails; (ii) stop counting a dropped row → `omitted` mismatch; (iii) report `truncated: false` with a non-zero `omitted` → fails.
6. Assert a fixture exactly at the cap boundary (byte-equal to the limit) is accepted, so the comparison is inclusive as declared.

**Expected Outcome**:
- Caps enforced and measured, every drop counted, and a bounded render honest about its shortfall.

#### TC-METRICS-103 - Truncation follows the declared tail order and `alarms[]` is never dropped

**Scenario Type**: Corner Case
**Impact Level**: Critical
**Priority**: High
**Related IDs**: AC-F11-2, NFR-4, DEC-10
**Test Type(s)**: Integration
**Automation Level**: Automated
**Target Layer / Location**: `tests/behaviour/metrics-bounds.test.ts` (order cells); `tests/checks/metrics-mutants.test.ts` (mutants)
**Tags**: @backend, @behaviour, @bounds

**Objective**: Prove the drop sequence is exactly `comparisons[]` → `incidents[]` → `perAgent[]`, and that decision-critical rows survive.

**Preconditions**:
- A fixture where the cap binds *and* an alarm exists: many comparisons (over 20), many incidents (over 8), many agents (over 20), plus one crossing alarm, the four metric entries, `ref`, `window`, and `alarmEvaluation`.

**Steps**:
1. Assert the drop order by incrementally shrinking the cap and observing which array loses a row first: `comparisons[]` first, then `incidents[]`, then `perAgent[]`.
2. Assert rows drop from the tail, so the head of each array is preserved and stably ordered.
3. Assert `alarms[]`, `alarmEvaluation`, `ref`, `window`, and `metrics[]` are byte-identical before and after truncation (a deep comparison of those members across the cap settings).
4. Assert `omitted` equals the sum of the per-array drops and that `truncated` flips exactly when the first row drops.
5. Mutation arms: (i) truncate `alarms[]` → fails; (ii) reorder the sequence (`perAgent` before `comparisons`) → fails; (iii) drop from the head → fails.
6. Assert the same sequence on the human render (the declared sections shrink in the same order).

**Expected Outcome**:
- The declared order, tail-first, with the never-dropped set proven intact under a binding cap.

#### TC-METRICS-104 - Row caps on `incidents[]`, `perAgent[]`, and `comparisons[]` count every omission

**Scenario Type**: Corner Case
**Impact Level**: Important
**Priority**: High
**Related IDs**: AC-F11-2, NFR-4, DM-8
**Test Type(s)**: Integration
**Automation Level**: Automated
**Target Layer / Location**: `tests/behaviour/metrics-bounds.test.ts` (row-cap cells)
**Tags**: @backend, @behaviour, @bounds

**Objective**: Prove the per-array caps are independent of the byte cap and that both shortfalls are counted into the same `omitted` without double counting.

**Preconditions**:
- Fixtures with 20 and 21 comparisons, 8 and 9 incidents, 20 and 21 agents, each small enough that the byte cap does not bind; a combined fixture where the byte cap and a row cap bind together.

**Steps**:
1. Assert the at-cap populations list in full with `omitted == 0`.
2. Assert the over-cap populations list at the cap with `omitted` incremented by exactly the overflow and `truncated == true`.
3. Assert the combined fixture's `omitted` equals the union of drops (no double count of a row dropped by both rules) and that the total matches the structural count of missing rows.
4. Assert the measurement totals are unaffected by the caps (an escaped-defect `value` or a dispatch total does not shrink).
5. Assert the counted shortfall is described in the human render with the same number.

**Expected Outcome**:
- Independent row caps, one honest `omitted`, and totals unaffected by display bounds.

#### TC-METRICS-105 - Window, censoring, and `crossedAt` are pure functions of the injected clock

**Scenario Type**: Contract
**Impact Level**: Critical
**Priority**: High
**Related IDs**: AC-F11-2, NFR-6, DEC-5, `AMB-TP-3`
**Test Type(s)**: Unit, Integration
**Automation Level**: Automated
**Target Layer / Location**: `tests/behaviour/metrics-determinism.test.ts` (clock cells); `tests/structure/metrics-imports.test.ts` (static half); `bun run scripts/checks/ambient-globals.ts`
**Tags**: @backend, @behaviour, @clock

**Objective**: Prove no timestamp on the payload comes from ambient time, so a report is reproducible from its inputs.

**Preconditions**:
- A fixed clock and a schedule of explicit advances (`+1 ms`, `+1 h`, `+30 d`); a history with a censored ref; a crossing alarm.

**Steps**:
1. For each advance, assert the drawn window, the comparison `after` window, the alarm window, `crossedAt`, and the censoring anchor move exactly as the schedule says — and only those.
2. Assert `crossedAt` equals the clock's read instant **and** the alarm window's end on every cell — the DM-4/DEC-5 derivation (`AMB-TP-3`).
3. Assert the censoring anchor does not move with the clock (it is the last completed phase, not `now`), while the drawn window does.
4. Assert the ambient-globals guard reports no wall-clock read in any new module, and that the domain functions take the clock as a parameter rather than importing a time source.
5. Mutation arm: a temp copy that reads `Date.now()` for `crossedAt` must fail the fixed-clock cells.

**Expected Outcome**:
- Every timestamp derivable from the fixture clock, with the one documented equality (`crossedAt` = read instant = window end) asserted.

#### TC-METRICS-106 - The declared read budget holds and the latency reference is measured, not asserted

**Scenario Type**: Performance
**Impact Level**: Important
**Priority**: Medium
**Related IDs**: NFR-7
**Test Type(s)**: Integration, Performance
**Automation Level**: Automated
**Target Layer / Location**: `tests/behaviour/metrics-read-cost.test.ts` (new)
**Tags**: @backend, @behaviour, @read-cost

**Objective**: Prove the read budget is a counted fact and record the latency reference without making a flaky assertion of it.

**Preconditions**:
- Counting wrappers on every seam; fixtures at 1 000 and 10 000 telemetry records; a corpus fixture of bounded size.

**Steps**:
1. Run a full report and assert the counts: ≤ 1 verified read per telemetry record family, ≤ 1 transition-history read, ≤ 1 ceremony-record read, ≤ 1 baseline-log read, ≤ 1 config-node read, ≤ 1 corpus scan.
2. Assert `0` reads beyond the declared sources (the wrapper set is closed: any unclassified read is a failure).
3. Assert a second invocation performs the same counts (no warm-cache asymmetry hidden by a module-level cache).
4. Measure and **print** the duration for both sizes with the fixture size, and record it as a non-gating reference; assert only the budget, never a timing threshold.
5. Assert the read budget does not scale with the number of entries beyond the declared scan (e.g. no per-metric re-scan of the corpus).

**Expected Outcome**:
- A counted read budget with no extra source touched, and a recorded, non-gating latency reference.

#### TC-METRICS-110 - The aggregate quality gate is green before the PR opens

**Scenario Type**: Quality gate
**Impact Level**: Critical
**Priority**: High
**Related IDs**: AC-NFR9-1, NFR-9, NFR-10
**Test Type(s)**: Manual
**Automation Level**: Manual (recorded)
**Target Layer / Location**: repository root; evidence recorded in §10 and pm-notes `notes:`
**Tags**: @gate

**Objective**: Record the delivery gate as evidence rather than claiming it.

**Preconditions**:
- `tmp/tmpdir` present (the repo-local `TMPDIR` convention); a clean working tree.

**Steps**:
1. Run `TMPDIR=$PWD/tmp/tmpdir pnpm check` and record the exit code and the pass/skip/fail counts.
2. Run `git diff --check`.
3. Run `./scripts/lint-commit-range.sh --base "$BASE_RANGE"` in phase 9 and record its verdict (the supplementary pre-PR range gate).
4. Record the three results in §10 and in pm-notes `notes:`.

**Expected Outcome**:
- Green gate evidence at the delivered HEAD, with the counts and the range-lint verdict recorded; a non-green gate leaves DoD-16 red rather than waived.

#### TC-METRICS-111 - Offline hermeticity, and a skip never counts as a pass

**Scenario Type**: Negative
**Impact Level**: Critical
**Priority**: High
**Related IDs**: AC-F11-1, NFR-5
**Test Type(s)**: Checks
**Automation Level**: Automated
**Target Layer / Location**: `tests/checks/metrics-hermetic.test.ts` (new; the `ceremony-hermetic` pattern)
**Tags**: @checks, @hermetic

**Objective**: Prove the suites cannot silently disappear and cannot reach a live system.

**Preconditions**:
- The new suites' sources; a planted-violation fixture tree.

**Steps**:
1. Scan the new suites for `test.skip`, `describe.skip`, `test.todo`, `test.if`, and conditional early returns; assert none.
2. Plant a skip in a temp copy and assert the scan fails naming the file and line.
3. Scan for `$HOME`, the live state directory, socket, spawn, credential, network, and `fetch` usage in the new suites; assert none, and assert a planted probe is detected.
4. Assert every suite constructs its own temp root and disposes it in `finally` (a scan for the harness usage pattern plus a run-time assertion that no file outside the temp base changed).
5. Assert no suite reads a moving base branch (`origin/main-tools`), consistent with the invariant-test rule.

**Expected Outcome**:
- A hermetic, skip-free suite set whose detection power is proven by planted violations.

#### TC-METRICS-112 - Mutant meta-suite: every honesty rule has a disabling mutant that fails

**Scenario Type**: Negative
**Impact Level**: Critical
**Priority**: High
**Related IDs**: AC-F2-1, AC-F3-4, AC-F4-1, AC-F6-1, AC-F7-1, AC-F8-1, AC-F10-1, AC-F11-2
**Test Type(s)**: Checks (mutation)
**Automation Level**: Automated
**Target Layer / Location**: `tests/checks/metrics-mutants.test.ts` (new; extends the `spend-mutants`/`steer-mutants` pattern)
**Tags**: @checks, @mutants

**Objective**: Prove the plan's cases have detection power: each honesty rule, disabled in a temp copy, produces the prohibited observable on an unchanged fixture.

**Preconditions**:
- A temp-tree copy facility; one fixture per guarded property; the delivered mutant-suite conventions.

**Steps**:
1. Baseline-restatement mutant: echo the log's committed value into the committed-basis entry; present the pm-notes proxy recomputation as the native ceremony-share value → `TC-METRICS-011` fails on each.
2. Caveat mutants: drop it from a cross-kind row; add it to a same-kind row → `TC-METRICS-026` fails in each direction.
3. Trend mutant: assign `improved` below the sample minimum → `TC-METRICS-031` fails.
4. Duplicate-alarm mutant: emit one alarm per evaluation *and* persist a marker that re-emits on the next run → `TC-METRICS-050`/`056` fail.
5. Invented-threshold mutant: default the threshold when the node is absent → `TC-METRICS-052` fails.
6. Unobserved-green mutant: count `ci_observed: false` as success → `TC-METRICS-025` fails.
7. Zero-fill mutants: `0` for an all-unobserved rate, `0` for an empty incident corpus, `0 tokens` for absent telemetry → `TC-METRICS-072` fails on each.
8. Uncited-incident mutant: count a row without an anchor → `TC-METRICS-062` fails.
9. Truncation mutants: drop `alarms[]`; reverse the drop order → `TC-METRICS-103` fails on each.
10. Registration mutants: plant a stale `146` pin; add a second `metrics.*` code; replace the exact set with a prefix rule → `TC-METRICS-092`/`091` fail.
11. Mounting mutants: omit the prompt-set entry; move one count site only → `TC-METRICS-083` fails.
12. Assert the unmutated tree passes every corresponding case (the positive control), so no mutant failure is attributable to a broken fixture.

**Expected Outcome**:
- A mutant for every guarded rule, each proven to fail its case, with an unmutated control.

## 6. Environments and Test Data

- **Runner.** `bun test` for `tests/**/*.test.ts`; `bun run scripts/checks/*.ts` for repository invariants (`error-table-sync`, `help-guide-coverage`, `ambient-globals`); `pnpm check` (`lint → format:check → typecheck → test → check:boundaries`) as the aggregate gate, run as `TMPDIR=$PWD/tmp/tmpdir pnpm check`.
- **Environments.** One hermetic local environment: `bun test` over per-test temporary roots. No staging, no external system, no tracker, no provider, no network. Every dependency is an in-process injected port; the only real filesystem objects are temporary checkouts (config-document resolution, ref context) created under the approved temp base.
- **Isolation.** One `mkdtemp` root per case through `tests/fixtures/state/harness.ts`; stores created, seeded, and removed per test; the live tree and the user's real state directory are never read or written; the delivered fixture guard rejects the live workspace before anything is written.
- **Clock, ids, brand.** A fixed `NOW_MS` per case, explicit advances for window/censoring/`crossedAt` cells, deterministic run-id and fence-token sequences (`run-metrics-*`, `fence-metrics-*`), and the synthetic brand from `tests/golden/helpers.ts`. Ordering fixtures use non-time-sortable keys so a sortability assumption fails.
- **New fixtures** (`tests/fixtures/metrics/**`, none named `*.test.ts`):
  - `harness.ts` — in-process composition over an injected clock, run id, and the six read seams (telemetry step/baseline families, `phase.transition` history, ceremony run/step records, baseline-log read, config-node read, bounded corpus scan), plus byte-snapshot, read-counter, and append/fence recorders.
  - `baseline.ts` — fixture `measurement-baseline.yaml` builders modelled on the committed log's shape: a full log (three consumed rows plus an untouched `MET-FALSE-SIGNAL-INCIDENTS` row), a partial log, an absent log, an unparseable log, an invalid log (each defect class), a log carrying a committed `comparisons[]` record, and two window shapes (a 30-day window for the equal-length cells and the committed months-long window for the verbatim cells).
  - `telemetry.ts` — seeded step/baseline records with the five attribution dimensions, null-attribution rows, both reading bases, five token classes, per-model costs (including null), and restart counts.
  - `transitions.ts` — `phase.transition` histories: a complete pair, a censored ref, a no-usable-pair set, a re-opened start, unparseable timestamps, and a reversed store order.
  - `ceremony.ts` — ceremony run/step records with known timings: three ceremonies in-window, an out-of-window set, and an empty set.
  - `corpus.ts` — committed-path-shaped pm-notes corpus fixtures for the CI proxy (`ci_observed` true/false, `red`/`mixed`/`green`, date-only rows, out-of-window rows) and for escaped defects (a post-gate review artifact, a landed-head CI observation, a retro finding, plus the prohibited classes: a `tmp/` path, an `.ai/local/` path, an uncited claim, an unresolvable anchor, an out-of-window row, a foreign attribution).
  - `config.ts` — fixture project-committed config documents: with a valid `metrics.burn-rate`, without any `metrics` node, without a document, and one per defect class (threshold basis and range, basis vocabulary, window grammar) plus the at-limit valid twins.
  - `alarms.ts` — threshold/spend matrices for crossing, equality, below, both bases, and sparse cost.
  - `bounds.ts` — at-cap/under/over payload seeds for the 65 536-byte machine cap, the 200-line/16 384-byte human cap, and the 8/20 row caps, with a combined fixture where two caps bind together.
  - `mounting.ts` — the captured 23-entry delivered family list and the expected 24-family list, asserted once.
  - `golden/**` — six human forms plus their machine `data` (bare, explicit window, crossing alarm, undeclared threshold, telemetry-absent, insufficient-sample), each with a `regenerate.ts`; regeneration is explicit and its diff must show only the declared delta. These are **new** artifacts; no delivered golden is regenerated by this change.
- **Reused delivered fixtures.** `tests/fixtures/spend/{harness,cases,transitions}.ts` (dispatch parity and the `SC-M2-S6-01` seeding shape); `tests/fixtures/telemetry/index.ts`; `tests/fixtures/ceremony/{engine,state,declarations,comparison}/**`; `tests/fixtures/state/harness.ts`; `tests/fixtures/projects/{production,state-scope,temp-repos,host-root}.ts`; `tests/fixtures/entrypoint/programs.ts`; `tests/fixtures/help-guide/coverage.json`; `tests/golden/helpers.ts`; `tests/behaviour/verify-support.ts` (`guardStore`, `VerifyCallRecorder`).
- **Real-checkout discipline.** Only the ref-resolution cells, the config-document resolution cells, the mounting-composition cell, and the write-discipline cells use real temporary checkouts; every other case uses the synthetic harness. The invoking checkout in those cells is real so the resolved ref and the resolved document path are not fixture constants.
- **Committed-evidence discipline.** Corpus and escaped-defect fixtures are committed-path-shaped documents in the fixture tree; the negative cells plant prohibited paths deliberately so the curation rule is exercised rather than described.
- **Fixture privacy.** Synthetic owners, refs, artifact paths, and corpus rows only; `tests/checks/fixture-privacy.test.ts` runs over every new fixture.
- **Isolation and cleanliness.** Every suite constructs its own store, host root, and checkouts and disposes them in `finally`; no cross-suite shared state; mutation copies are temp-tree copies, never in-place edits of the live tree; no suite skips (`TC-METRICS-111`).
- **Aggregate gate.** `TMPDIR=$PWD/tmp/tmpdir pnpm check` with `tmp/tmpdir` present.

**Runner command list per suite.**

| Suite | Command |
|---|---|
| Contract and constants | `bun test tests/structure/metrics-contract.test.ts` |
| Imports, tiers, ambient clock | `bun test tests/structure/metrics-imports.test.ts`; `bun run scripts/checks/ambient-globals.ts` |
| Mounting and family count | `bun test tests/structure/metrics-mounting.test.ts tests/structure/entrypoint-bin.test.ts tests/structure/steer-mounting.test.ts tests/structure/board-mounting.test.ts tests/structure/events-production-composition.test.ts tests/structure/dispatch-attempts-composition.test.ts tests/structure/daemon-production-composition.test.ts tests/behaviour/repos-help.test.ts tests/behaviour/board-help.test.ts tests/behaviour/events-mount-help.test.ts tests/behaviour/ceremony-cli.test.ts` |
| Report surface and grammar | `bun test tests/behaviour/metrics-report.test.ts tests/behaviour/metrics-grammar.test.ts tests/behaviour/metrics-envelope.test.ts` |
| Baseline consumption and damage | `bun test tests/behaviour/metrics-baseline.test.ts tests/behaviour/metrics-baseline-damage.test.ts` |
| Measurement kinds and caveat | `bun test tests/behaviour/metrics-cycle-time.test.ts tests/behaviour/metrics-ceremony-share.test.ts tests/behaviour/metrics-ci-proxy.test.ts tests/behaviour/metrics-caveat.test.ts` |
| Comparison view | `bun test tests/behaviour/metrics-comparisons.test.ts` |
| Dispatch parity | `bun test tests/behaviour/metrics-dispatch.test.ts` |
| Alarms and declaration node | `bun test tests/behaviour/metrics-alarms.test.ts tests/behaviour/metrics-burn-rate-config.test.ts` |
| Escaped defects | `bun test tests/behaviour/metrics-escaped-defects.test.ts` |
| Absence, damage, zero fabrication | `bun test tests/behaviour/metrics-absence.test.ts tests/behaviour/metrics-store-damage.test.ts` |
| Bounds, determinism, read cost | `bun test tests/behaviour/metrics-bounds.test.ts tests/behaviour/metrics-determinism.test.ts tests/behaviour/metrics-read-cost.test.ts` |
| Purity and write discipline | `bun test tests/behaviour/metrics-purity.test.ts tests/behaviour/metrics-write-discipline.test.ts tests/checks/privacy-literals.test.ts tests/checks/forbidden-literals.test.ts` |
| Help and coverage | `bun test tests/behaviour/metrics-help.test.ts tests/checks/help-guide-coverage.test.ts tests/checks/reference-page-parity.test.ts`; `bun run scripts/checks/help-guide-coverage.ts` |
| Error registration | `bun test tests/structure/error-table.test.ts tests/structure/dispatch-attempts-taxonomy.test.ts tests/structure/verify-gates-suite-map-contract.test.ts tests/checks/error-table-sync.test.ts`; `bun run scripts/checks/error-table-sync.ts` |
| Goldens | `bun test tests/golden/metrics.test.ts` |
| Mutants and hermeticity | `bun test tests/checks/metrics-mutants.test.ts tests/checks/metrics-hermetic.test.ts` |
| Narrow iteration (whole family) | `bun test tests/structure/metrics-*.test.ts tests/behaviour/metrics-*.test.ts tests/checks/metrics-*.test.ts tests/golden/metrics.test.ts` |
| Aggregate | `TMPDIR=$PWD/tmp/tmpdir pnpm check` |

## 7. Automation Plan and Implementation Mapping

Every case is automated under `bun test` except `TC-METRICS-110`, which is an execution record. All new suites are **To Implement**; rows marked **Existing – Update** extend delivered suites or fixtures in place. Delivery owns exact module paths and seam shapes (`AMB-TP-1`); a case that cannot resolve its seam **fails naming the missing contract** rather than skipping.

| TC ID | Suite / file | Command | Injection / fixture requirements | Status |
|---|---|---|---|---|
| TC-METRICS-001 | `tests/behaviour/metrics-report.test.ts`; `tests/structure/metrics-contract.test.ts`; `tests/golden/metrics.test.ts` | `bun test tests/behaviour/metrics-report.test.ts tests/structure/metrics-contract.test.ts tests/golden/metrics.test.ts` | Bound checkout; injected clock/run id; all six sources seeded; key-set diff; bare golden | To Implement |
| TC-METRICS-002 | `tests/behaviour/metrics-report.test.ts` (explicit cells) | `bun test tests/behaviour/metrics-report.test.ts --filter explicit-selection` | Two refs with distinct evidence; two windows; human render cell | To Implement |
| TC-METRICS-003 | `tests/behaviour/metrics-grammar.test.ts`; `tests/structure/metrics-contract.test.ts` | `bun test tests/behaviour/metrics-grammar.test.ts tests/structure/metrics-contract.test.ts` | Lone/reversed/malformed/empty bound cells; accepting twins; zero read counters; one exported grammar predicate | To Implement |
| TC-METRICS-004 | `tests/behaviour/metrics-grammar.test.ts` (ref and invocation cells) | `bun test tests/behaviour/metrics-grammar.test.ts --filter ref-and-invocation` | Bound and unbound checkouts; malformed/unresolvable ref; unknown flag; positionals; declared verbs; help control | To Implement |
| TC-METRICS-005 | `tests/behaviour/metrics-envelope.test.ts`; `tests/structure/metrics-contract.test.ts` | `bun test tests/behaviour/metrics-envelope.test.ts` | Six §8.3 projection cells; envelope key-set diff; `ok`/`command` scan; identity-constant import assertion | To Implement |
| TC-METRICS-006 | `tests/behaviour/metrics-report.test.ts` (window cells); `tests/structure/metrics-contract.test.ts` | `bun test tests/behaviour/metrics-report.test.ts --filter window-bounds` | Evidence at `from`, `from−1ms`, `through`, `through+1ms`; clock advance; ambient-clock guard | To Implement |
| TC-METRICS-010 | `tests/behaviour/metrics-baseline.test.ts` | `bun test tests/behaviour/metrics-baseline.test.ts` | Fixture log with `source_commit`, statuses, exclusions, samples; `definitionRef` read from log text | To Implement |
| TC-METRICS-011 | `tests/behaviour/metrics-baseline.test.ts` (recompute cells); `tests/checks/metrics-mutants.test.ts` | `bun test tests/behaviour/metrics-baseline.test.ts --filter recompute` | Committed values on all three rows ≠ basis-derived values (committed-basis recompute cell + native-source cells); never-presented-as-committed-value scan; two mutants | To Implement |
| TC-METRICS-012 | `tests/behaviour/metrics-write-discipline.test.ts` | `bun test tests/behaviour/metrics-write-discipline.test.ts` | Pre/post SHA-256 of log, config, ceremony records, evidence; state-scope snapshots; append/fence counters | To Implement |
| TC-METRICS-013 | `tests/behaviour/metrics-baseline-damage.test.ts` | `bun test tests/behaviour/metrics-baseline-damage.test.ts --filter row-absent` | Absent-log fixture + present-log control; no zero assertions | To Implement |
| TC-METRICS-014 | `tests/behaviour/metrics-baseline-damage.test.ts` (damage cells) | `bun test tests/behaviour/metrics-baseline-damage.test.ts --filter unreadable` | Seven damage classes + valid control; no-partial-report assertion; byte-unchanged log | To Implement |
| TC-METRICS-015 | `tests/behaviour/metrics-baseline.test.ts` (partial-log cells) | `bun test tests/behaviour/metrics-baseline.test.ts --filter partial-log` | Log missing one consumed row; log with only the excluded row | To Implement |
| TC-METRICS-016 | `tests/structure/metrics-contract.test.ts`; `tests/behaviour/metrics-baseline.test.ts` (§7.2 cell) | `bun test tests/structure/metrics-contract.test.ts --filter vocabulary` | Vocabulary constant; non-zero false-signal row; payload scan | To Implement |
| TC-METRICS-020 | `tests/behaviour/metrics-cycle-time.test.ts` | `bun test tests/behaviour/metrics-cycle-time.test.ts` | Complete transition history; independent interval computation; log value differs | To Implement |
| TC-METRICS-021 | `tests/behaviour/metrics-cycle-time.test.ts` (censoring cells) | `bun test tests/behaviour/metrics-cycle-time.test.ts --filter censoring` | No completion transition; clock advance; completion-added twin | To Implement |
| TC-METRICS-022 | `tests/behaviour/metrics-cycle-time.test.ts` (unavailable cells) | `bun test tests/behaviour/metrics-cycle-time.test.ts --filter unavailable` | Five unusable histories + usable control; structural zero assertions | To Implement |
| TC-METRICS-023 | `tests/behaviour/metrics-ceremony-share.test.ts` | `bun test tests/behaviour/metrics-ceremony-share.test.ts` | Three in-window ceremonies; out-of-window set; empty set; independent share computation | To Implement |
| TC-METRICS-024 | `tests/behaviour/metrics-ci-proxy.test.ts` | `bun test tests/behaviour/metrics-ci-proxy.test.ts` | Corpus with 6 observed / 5 unobserved / 2 out-of-window; independent ratio; limitation scan | To Implement |
| TC-METRICS-025 | `tests/behaviour/metrics-ci-proxy.test.ts` (exclusion cells); `tests/checks/metrics-mutants.test.ts` | `bun test tests/behaviour/metrics-ci-proxy.test.ts --filter observation` | 2/11, 0/11, 9/11 fixtures; unobserved-green mutant | To Implement |
| TC-METRICS-026 | `tests/behaviour/metrics-caveat.test.ts`; `tests/checks/metrics-mutants.test.ts` | `bun test tests/behaviour/metrics-caveat.test.ts` | Cross-kind, same-kind, native/native cells; caveat constant; two mutants; human-render parity | To Implement |
| TC-METRICS-030 | `tests/behaviour/metrics-comparisons.test.ts` | `bun test tests/behaviour/metrics-comparisons.test.ts` | 30-day-window log; samples of 5 and more; row key-set; before read from log text | To Implement |
| TC-METRICS-031 | `tests/behaviour/metrics-comparisons.test.ts` (minimum cells); `tests/checks/metrics-mutants.test.ts` | `bun test tests/behaviour/metrics-comparisons.test.ts --filter sample-minimum` | Samples 4/5/6; improved/regressed/flat reachable; trend-token scan of payload and render; verdict mutant | To Implement |
| TC-METRICS-032 | `tests/behaviour/metrics-comparisons.test.ts` (unestablished and ordering cells) | `bun test tests/behaviour/metrics-comparisons.test.ts --filter not-established` | No-after-evidence metric; months-long-window log with verbatim carriage and no window-length refusal; shuffled log order; pre/post hash | To Implement |
| TC-METRICS-033 | `tests/behaviour/metrics-comparisons.test.ts` (committed-record cells) | `bun test tests/behaviour/metrics-comparisons.test.ts --filter committed-comparison` | Log with an authored comparison record; differing live verdict; builder-import assertion; record count/bytes | To Implement |
| TC-METRICS-040 | `tests/behaviour/metrics-dispatch.test.ts` | `bun test tests/behaviour/metrics-dispatch.test.ts` | `tests/fixtures/spend/harness.ts`; one store, two commands in one process; fully attributable seed fixture (the DEC-14 exact-equality scope); deep-equality of dispatch vs spend; independent sums | To Implement |
| TC-METRICS-041 | `tests/behaviour/metrics-dispatch.test.ts` (disclosure cells); `tests/checks/metrics-mutants.test.ts` | `bun test tests/behaviour/metrics-dispatch.test.ts --filter reconciliation` | Reconciliation basis/verdict names; sparse cost fixture; price-table absence scan; three mutants | To Implement |
| TC-METRICS-042 | `tests/behaviour/metrics-dispatch.test.ts` (ordering and null cells) | `bun test tests/behaviour/metrics-dispatch.test.ts --filter ordering-null` | Unsorted roles + tie; null cost model; three null-attribution steps; ordering parity with spend | To Implement |
| TC-METRICS-050 | `tests/behaviour/metrics-alarms.test.ts`; `tests/golden/metrics.test.ts` | `bun test tests/behaviour/metrics-alarms.test.ts tests/golden/metrics.test.ts` | Declared node (tokens 14d, threshold 1000); measured 1200; cost-basis sparse twin; repeat run; crossing golden | To Implement |
| TC-METRICS-051 | `tests/behaviour/metrics-alarms.test.ts` (boundary cells) | `bun test tests/behaviour/metrics-alarms.test.ts --filter crossing-boundary` | 999/1000/1001 on tokens; 12.49/12.5/12.5001 on cost; single-class-below twin; window-length distinction | To Implement |
| TC-METRICS-052 | `tests/behaviour/metrics-alarms.test.ts` (undeclared cells) | `bun test tests/behaviour/metrics-alarms.test.ts --filter undeclared` | No document / no node / node without member / unrelated nodes; declared twins; key-absence assertions | To Implement |
| TC-METRICS-053 | `tests/behaviour/metrics-alarms.test.ts` (absence cells); `tests/golden/metrics.test.ts` | `bun test tests/behaviour/metrics-alarms.test.ts --filter telemetry-absent` | No-telemetry ref with transition/ceremony/corpus evidence; present-telemetry twin; absence golden | To Implement |
| TC-METRICS-054 | `tests/behaviour/metrics-burn-rate-config.test.ts`; `tests/structure/config-contract.test.ts` | `bun test tests/behaviour/metrics-burn-rate-config.test.ts tests/structure/config-contract.test.ts` | Full defect matrix + at-limit valid twins; zero read counters; unchanged resolved-tree classification | To Implement + Existing – Update (node row) |
| TC-METRICS-055 | `tests/behaviour/metrics-alarms.test.ts` (below-threshold cells); `tests/golden/metrics.test.ts` | `bun test tests/behaviour/metrics-alarms.test.ts --filter below-threshold` | Identical fixtures differing only in measured spend; structural payload comparison; below-threshold golden; undeclared twin | To Implement |
| TC-METRICS-056 | `tests/behaviour/metrics-alarms.test.ts` (derivation cells); `tests/behaviour/metrics-write-discipline.test.ts` | `bun test tests/behaviour/metrics-alarms.test.ts --filter derived-view` | Five repeats; crossed→below→crossed sequence; clock advance; state snapshot; board/brief/status payload assertions | To Implement |
| TC-METRICS-060 | `tests/behaviour/metrics-escaped-defects.test.ts` | `bun test tests/behaviour/metrics-escaped-defects.test.ts` | Three counted classes + three conforming-but-uncounted rows; citation resolution against the fixture tree; caveat constant | To Implement |
| TC-METRICS-061 | `tests/behaviour/metrics-escaped-defects.test.ts` (no-evidence cells) | `bun test tests/behaviour/metrics-escaped-defects.test.ts --filter no-evidence` | Empty corpus; out-of-window-only; non-committed-only; one-incident control | To Implement |
| TC-METRICS-062 | `tests/behaviour/metrics-escaped-defects.test.ts` (non-evidence cells); `tests/checks/metrics-mutants.test.ts` | `bun test tests/behaviour/metrics-escaped-defects.test.ts --filter curation` | `tmp/`, `.ai/local/`, untracked, uncited, unresolvable-anchor, out-of-window, foreign-attribution rows + control; uncited mutant | To Implement |
| TC-METRICS-063 | `tests/behaviour/metrics-escaped-defects.test.ts` (cap cells); `tests/behaviour/metrics-bounds.test.ts` | `bun test tests/behaviour/metrics-escaped-defects.test.ts --filter display-cap` | 2/8/11 incident populations across all classes; shuffled corpus ordering | To Implement |
| TC-METRICS-070 | `tests/behaviour/metrics-absence.test.ts` | `bun test tests/behaviour/metrics-absence.test.ts` | All-absent fixture + six single-absence fixtures; structural zero walk; per-section independence | To Implement |
| TC-METRICS-071 | `tests/behaviour/metrics-store-damage.test.ts` | `bun test tests/behaviour/metrics-store-damage.test.ts` | `guardStore` matrix (four sources × six modes) + readable twins; damage≠absence assertions; byte-unchanged stores | To Implement |
| TC-METRICS-072 | `tests/behaviour/metrics-absence.test.ts` (sweep cells); `tests/checks/metrics-mutants.test.ts` | `bun test tests/behaviour/metrics-absence.test.ts --filter zero-fabrication` | Absence matrix; structural numeric walk with declared counter exceptions; three zero-fill mutants | To Implement |
| TC-METRICS-080 | `tests/structure/metrics-mounting.test.ts`; `tests/fixtures/metrics/mounting.ts`; ten pinning suites | see the runner list, mounting row | Captured 23-entry base; extended `PINNING_FILES`; stale-`23` scan + planted-stale arm; real-checkout composition | To Implement + Existing – Update (count 23 → 24 in ten suites, `steer-mounting` list and pins) |
| TC-METRICS-081 | `tests/behaviour/metrics-help.test.ts` | `bun test tests/behaviour/metrics-help.test.ts` | Empty environment; read/transport/spawn counters; brand swap; `--version`; help precedence | To Implement |
| TC-METRICS-082 | `tests/checks/help-guide-coverage.test.ts`; `tests/checks/reference-page-parity.test.ts`; `tests/fixtures/help-guide/coverage.json`; the M2 page | `bun test tests/checks/help-guide-coverage.test.ts tests/checks/reference-page-parity.test.ts`; `bun run scripts/checks/help-guide-coverage.ts` | Inventory row + page; three mutation arms; row-count growth of one | Existing – Update + To Implement (page, mutations) |
| TC-METRICS-083 | `tests/structure/metrics-mounting.test.ts` (isolation cells); `tests/checks/metrics-mutants.test.ts`; delivered help/payload goldens | `bun test tests/structure/metrics-mounting.test.ts tests/checks/metrics-mutants.test.ts --filter mounting` | Per-family goldens; four mounting mutants; unmutated control | To Implement |
| TC-METRICS-090 | `tests/structure/error-table.test.ts` (D-1, D-4, D-5, D-7); carrier | `bun test tests/structure/error-table.test.ts` | Row field assertions; 147/146 counts; per-kind controls; projection reachability | Existing – Update |
| TC-METRICS-091 | `tests/structure/error-table.test.ts` (D-3, D-6); `scripts/checks/error-table-sync.ts` (D-2); `tests/checks/error-table-sync.test.ts` | `bun test tests/structure/error-table.test.ts tests/checks/error-table-sync.test.ts` | Both allowlist copies at 63; six near-miss probes; kind-only containment; three mutants | Existing – Update |
| TC-METRICS-092 | `tests/structure/error-table.test.ts` (D-4..D-9); `dispatch-attempts-taxonomy` (D-10); `verify-gates-suite-map-contract` (D-11); `error-table-sync.test.ts` (D-12); `feature-result-contract.md` (D-13) | `bun test tests/structure/error-table.test.ts tests/structure/dispatch-attempts-taxonomy.test.ts tests/structure/verify-gates-suite-map-contract.test.ts tests/checks/error-table-sync.test.ts`; `bun run scripts/checks/error-table-sync.ts` | Per-site-group assertions with named failures; extended legacy tokens; planted-stale arm; four-way tuple from one tree | Existing – Update |
| TC-METRICS-100 | `tests/behaviour/metrics-purity.test.ts`; `tests/structure/metrics-imports.test.ts`; privacy/forbidden literal checks | `bun test tests/behaviour/metrics-purity.test.ts tests/structure/metrics-imports.test.ts tests/checks/privacy-literals.test.ts tests/checks/forbidden-literals.test.ts` | Recording ports on every external seam; import set; brand swap; literal scan; byte snapshots | To Implement (+ Existing – must stay green where a literal registry already covers the paths) |
| TC-METRICS-101 | `tests/behaviour/metrics-determinism.test.ts`; `tests/golden/metrics.test.ts` | `bun test tests/behaviour/metrics-determinism.test.ts tests/golden/metrics.test.ts` | Six forms × two runs; four permutations; new goldens + `regenerate.ts` | To Implement |
| TC-METRICS-102 | `tests/behaviour/metrics-bounds.test.ts`; `tests/structure/metrics-contract.test.ts` | `bun test tests/behaviour/metrics-bounds.test.ts` | At/under/over-cap fixtures for both caps; byte measurement on `data`; three mutants | To Implement |
| TC-METRICS-103 | `tests/behaviour/metrics-bounds.test.ts` (order cells); `tests/checks/metrics-mutants.test.ts` | `bun test tests/behaviour/metrics-bounds.test.ts --filter truncation-order` | Cap-shrink sequence; alarm-bearing over-cap fixture; never-dropped deep comparison; three mutants | To Implement |
| TC-METRICS-104 | `tests/behaviour/metrics-bounds.test.ts` (row-cap cells) | `bun test tests/behaviour/metrics-bounds.test.ts --filter row-caps` | 20/21, 8/9, 20/21 populations; combined-cap fixture; totals-unaffected assertions | To Implement |
| TC-METRICS-105 | `tests/behaviour/metrics-determinism.test.ts` (clock cells); `tests/structure/metrics-imports.test.ts` | `bun test tests/behaviour/metrics-determinism.test.ts --filter clock`; `bun run scripts/checks/ambient-globals.ts` | Fixed clock + three advances; censored ref; crossing alarm; `crossedAt` equality; ambient-read mutant | To Implement |
| TC-METRICS-106 | `tests/behaviour/metrics-read-cost.test.ts` | `bun test tests/behaviour/metrics-read-cost.test.ts` | Counting wrappers on all six seams; 1 000 and 10 000 record fixtures; printed sizes and durations | To Implement |
| TC-METRICS-110 | — (execution record) | `TMPDIR=$PWD/tmp/tmpdir pnpm check`; `git diff --check`; `./scripts/lint-commit-range.sh --base "$BASE_RANGE"` | `tmp/tmpdir` present; results recorded in §10 and pm-notes | Manual (recorded) |
| TC-METRICS-111 | `tests/checks/metrics-hermetic.test.ts` | `bun test tests/checks/metrics-hermetic.test.ts` | Skip scan; planted skip; planted live probe; temp-root discipline; no moving-base reads | To Implement |
| TC-METRICS-112 | `tests/checks/metrics-mutants.test.ts` | `bun test tests/checks/metrics-mutants.test.ts` | Temp-tree copies; twelve mutant families; unmutated control | To Implement |

**Mocking and injection requirements.** No module is globally mocked; every dependency is injected through the existing runtime seams — clock, run-id factory, telemetry read, transition read, ceremony read, baseline-log read, config-node read, corpus scan, brand. Mutant and hermeticity suites use temp-tree copies, never in-place edits of the live tree.

**Non-regression gate.** `TMPDIR=$PWD/tmp/tmpdir pnpm check` green before the PR, including `check:boundaries` and every invariant check; the branch-range commit-message gate runs in phase 9 per the lifecycle.

**Coverage summary.**

| Block | Cases | ACs / NFRs bound | New suites | Updated suites |
|---|---|---|---|---|
| Report surface (001–006) | 6 | AC-F1-1; NFR-1, NFR-6 | `metrics-report`, `metrics-grammar`, `metrics-envelope`, `metrics-contract` | — |
| Baseline (010–016) | 7 | AC-F2-1, AC-F2-2; NFR-3 | `metrics-baseline`, `metrics-baseline-damage`, `metrics-write-discipline` | — |
| Measurement kinds (020–026) | 7 | AC-F3-1..AC-F3-4 | `metrics-cycle-time`, `metrics-ceremony-share`, `metrics-ci-proxy`, `metrics-caveat` | — |
| Comparison (030–033) | 4 | AC-F4-1 | `metrics-comparisons` | — |
| Dispatch (040–042) | 3 | AC-F5-1 | `metrics-dispatch` | — |
| Alarms (050–056) | 7 | AC-F6-1..AC-F6-5 | `metrics-alarms`, `metrics-burn-rate-config` | `config-contract` (node row) |
| Escaped defects (060–063) | 4 | AC-F7-1, AC-F7-2 | `metrics-escaped-defects` | — |
| Absence and damage (070–072) | 3 | AC-F8-1 | `metrics-absence`, `metrics-store-damage` | — |
| Mounting (080–083) | 4 | AC-F9-1 | `metrics-mounting`, `metrics-help` | 10 family-count suites, `steer-mounting` + fixture, `coverage.json`, `entries` list |
| Registration (090–092) | 3 | AC-F10-1 | — | `error-table`, `dispatch-attempts-taxonomy`, `verify-gates-suite-map-contract`, `error-table-sync` + checker, carrier |
| Honesty battery (100–106) | 7 | AC-F11-1, AC-F11-2; NFR-2..NFR-7 | `metrics-purity`, `metrics-determinism`, `metrics-bounds`, `metrics-read-cost`, `metrics-imports`, goldens | literal registries (additive), `content-inventory`, `cli-edge-seam`, `exports-parity` |
| Gate and controls (110–112) | 3 | AC-NFR9-1; mutant control | `metrics-hermetic`, `metrics-mutants` | — |
| **Total** | **58** | **22 ACs, 10 NFRs** | **28 new suite files** | **20 updated files** (11 family-count pinning suites, `steer` mounting fixture, coverage inventory + coverage suite, error-table checker/sync/mirror/taxonomy/map suites, the in-boundary carrier, the source inventory, the config node table) |

**DoD verification block** (spec §17.1, each row proven by passing evidence rather than assertion).

| Done condition | Proven by | Evidence form |
|---|---|---|
| DoD-1 — report surface with drawn window and grammar refusals | TC-METRICS-001, 002, 003, 004, 005, 006 | Suite green (key-set, window arithmetic, refusal matrix with zero read counters) + bare golden |
| DoD-2 — baseline consumption with committed `definitionRef` and a byte-identical log | TC-METRICS-010, 011, 012 | Suite green (definition/status/exclusion cells, recompute cells, pre/post hashes) |
| DoD-3 — row-absent at exit 0 and damage at exit 2 with no partial report | TC-METRICS-013, 014, 015 | Suite green (absence cells with present-log controls, seven damage classes) |
| DoD-4 — measurement kinds and disclosure per metric | TC-METRICS-020, 021, 022, 023, 024, 025 | Suite green (censoring cell, empty-window cells, observed/unobserved corpus cells) |
| DoD-5 — caveat exactly on cross-kind comparisons | TC-METRICS-026 | Suite green (three-row caveat matrix + two mutants + human parity) |
| DoD-6 — comparison protocol with the minimum gate and an untouched log | TC-METRICS-030, 031, 032, 033 | Suite green (row shape, 4/5/6 samples, trend-token scan, pre/post hash) |
| DoD-7 — dispatch parity and no re-derivation (`SC-M2-S6-01`) | TC-METRICS-040, 041, 042 | Suite green (same-process parity, deep equality, sums, ordering, sparsity) |
| DoD-8 — one alarm per crossing with the echo and byte-identical repeats (`SC-M2-S6-02`) | TC-METRICS-050, 056 | Suite green + crossing golden + repeat-byte comparison |
| DoD-9 — undeclared, telemetry-absent, below-threshold, malformed-node | TC-METRICS-051, 052, 053, 054, 055 | Suite green (four classified-state cells + defect matrix with zero reads) |
| DoD-10 — escaped defects as a curated floor | TC-METRICS-060, 061, 062, 063 | Suite green (three cited classes, no-evidence cell, curation negatives, cap) |
| DoD-11 — absence classified everywhere, damage keeps `state.*`, no zero fabrication | TC-METRICS-070, 071, 072 | Suite green (all-absent matrix, damage matrix, structural zero sweep + mutants) |
| DoD-12 — complete mount (family, composition, help, page, inventory, pins) | TC-METRICS-080, 081, 082, 083 | Suite green (24-family list and line count, every pin, coverage check, four mutants) |
| DoD-13 — exact registration and moved pins | TC-METRICS-090, 091, 092 | Suite green + sync check exit 0 + four-way tuple + planted-stale arm |
| DoD-14 — purity, determinism, bounds, read-only, clock | TC-METRICS-100, 101, 102, 103, 104, 105, 106, 111 | Suite green (recorders, six-form repeats, cap matrices, clock schedule, read budget, hermetic scan) |
| DoD-15 — full acceptance coverage, no unmapped criterion, no orphan case | §3.4 and this table | Coverage-matrix integrity check: 22/22 ACs, 58/58 cases placed in §3.1/§3.3, §5.1, §5.2, §7 |
| DoD-16 — full gate battery green at the delivered HEAD | TC-METRICS-110 | Recorded aggregate result with pass/skip/fail counts in §10 and pm-notes `notes:` |
| DoD-17 — PR posture (targets `main-tools`, left open for review) | §10 (PR record, PM-owned) | Recorded PR URL as a pm-notes `notes:` entry; merge and acceptance not claimed |

## 8. Risks, Assumptions, and Open Questions

### 8.1 Risks

| ID | Risk | Impact | Mitigation in this plan |
|----|------|--------|--------------------------|
| TR-1 | **A baseline entry restates or impersonates the log's committed value** — the committed-basis entry echoing the log figure instead of recomputing, or a native-basis entry presented as the committed definition's value (the exact failures `AC-F2-1`/`DEC-13` forbid). | H | `TC-METRICS-011` uses a fixture whose committed values are deliberately different from the basis-derived ones and asserts the scoped value in both directions — committed-basis recompute and native-source computation — with two restatement mutants (`TC-METRICS-112` #1). `TC-METRICS-010` asserts the `definitionRef`/sample/exclusion provenance separately, so traceability and freshness are proven independently; `TC-METRICS-026` asserts the non-interchangeability disclosure. |
| TR-2 | **Proxy/native conflation** — a native cycle time or ceremony share silently compared with the log's proxy and read as a trend (RSK-2). | H | `TC-METRICS-026` asserts the caveat matrix in both directions plus a native/native twin, so the rule keys on kind difference; `TC-METRICS-023`/`020` assert the kinds per metric; two mutants prove detection. |
| TR-3 | **Trend claims from a thin sample** (RSK-1) turning the comparison view into a new anecdote source. | H | `TC-METRICS-031` pins the boundary at 4/5/6 and scans the whole payload *and* the human render for trend tokens, not just the row. |
| TR-4 | **Alarm spam or duplicates** eroding the alarm layer (RSK-5), or an invented threshold firing a false alarm (RSK-8). | H | `TC-METRICS-050`/`056` assert one alarm per crossing, byte-identical repeats, five repeats, a crossed→below→crossed sequence, and zero persisted state; `TC-METRICS-052` asserts no default; `TC-METRICS-054` refuses every node defect pre-read. |
| TR-5 | **Unobserved CI rows assumed green**, silently deflating the rate (the arithmetic that no reviewer would catch). | H | `TC-METRICS-025` uses a 9-unobserved/2-observed fixture and an all-unobserved fixture (which must be `UNAVAILABLE`, not `1.0`), plus an unobserved-green mutant. |
| TR-6 | **A zero rendered for absent evidence** anywhere in the payload (DEC-11). | H | `TC-METRICS-072` is a structural sweep with declared counter exceptions and an inverse assertion for measured rows, so it cannot pass by deleting every number; `TC-METRICS-070`/`022`/`061` pin the individual states. |
| TR-7 | **Store damage softened into absence**, producing an innocent-looking empty report (AC-F8-1). | H | `TC-METRICS-071` runs a four-source × six-mode `guardStore` matrix and asserts damage ≠ absence for the same source, with readable twins. |
| TR-8 | **Count-pin drift** during registration (RSK-4): one stale site in the mirror, the dispatch-taxonomy suite, the verify-map suite, the `+113` arithmetic, or the carrier. | H | `TC-METRICS-092` asserts each Appendix D group with a named failure, extends the legacy-token list, proves the scan's detection power with a planted stale line, and reads a four-way tuple from one tree. |
| TR-9 | **Mounting gap** (RSK-7): defined but unreachable, or reachable but unadvertised. | H | `TC-METRICS-080` asserts the exact 24-family list, the line count, every pin in the extended `PINNING_FILES`, a stale-`23` scan, and a real production-composition cell; `TC-METRICS-083` carries four mutants including the partial-count and uncomposed cases. |
| TR-10 | **A report that re-prices or re-derives the spend figures**, turning a second surface into a second calculator (RSK-2/NG-7). | H | `TC-METRICS-040` uses same-process deep equality rather than recomputation; `TC-METRICS-041` forbids price tables and asserts the reconciliation names are cited; both carry mutants. |
| TR-11 | **Grounding loss in the dispatch fixtures**: a spend fixture that happens to be small enough for sums to agree by accident, or an equality asserted against the wrong population. | M | `TC-METRICS-040` computes the sums independently and includes a deliberately unsorted role set with a token tie; `TC-METRICS-042` adds null attributions and a null cost and asserts the remainder form (`perAgent` sum = total − disclosed unattributable share, breakdowns still equal to the full total; `DEC-14`), so neither equality can be satisfied by a tiny or fully attributable fixture. |
| TR-12 | **Determinism claimed from one run**, or order leaking from the source (NFR-2). | H | `TC-METRICS-101` runs six forms twice plus four permutations derived from one canonical fixture, with new goldens created (not regenerated) in this change. |
| TR-13 | **The cap test passes because the fixture never binds it**, leaving the drop order and the never-dropped set unexercised. | M | `TC-METRICS-102`/`103` assert a positive measured length first, use at/under/over fixtures, shrink the cap incrementally to observe the sequence, and assert an alarm-bearing over-cap payload. |
| TR-14 | **NFR-7 asserted as a wall-clock threshold**, producing a flaky suite. | M | `TC-METRICS-106` asserts the counted read budget as the gate and prints the measured duration beside the fixture size as a non-gating reference, so a slower machine cannot flake the suite. |
| TR-15 | **A skip or conditional early return** silently removes a pinned case. | H | `TC-METRICS-111` scans the new suites, fails on a planted skip, and asserts no live probe. |

### 8.2 Assumptions

- The delivered spend fold, telemetry v2 record families, `phase.transition` history, ceremony run/step records, and ceremony measurement fold are stable and compose read-only; the metric layer adds no record kind and changes no delivered key (spec §12, NG-7).
- The committed baseline log stays `schema_version: 2` with its four metric rows; this change adds no row and edits no value; the log remains the `MET-` allocator (ODR-0002).
- No committed CI run log exists, so the CI failure rate stays a session proxy over the committed corpus (DEC-7); a native graduation is a later baseline-authoring act.
- The project-committed configuration document is `<repo>/<configDirectoryName>/config.yaml` and its single-document read composes for one more node (`metrics.burn-rate`) without changing the layer's behaviour or other nodes' resolution.
- The delivered prompt-required set registers exactly **23** families (`steer` the 23rd) and that list is stable for this change, so the mount delta is 23 → 24 and the captured base constant in `tests/fixtures/metrics/mounting.ts` is the single statement of 23.
- The delivered family-count scan (`tests/structure/steer-mounting.test.ts`) is the mechanism that keeps pins together; extending its list and adding a stale-`23` arm is sufficient to hold every pin, and a site outside the ten named files is a delivery finding rather than a silent exemption (`GAP-T5`).
- The delivered error-table counts in the tree match the spec's Appendix D pre-change values (146 entries, 145 delivered, 62 allowlist, `+112`), verified at authoring time; if delivery finds a drift, the appendix and the pins move together and this plan's oracle table is amended.
- The fixture log may declare a 30-day window so the equal-length case is exercised in the verdict cells (`AMB-TP-4`); the posted committed log's months-long window is represented by a second fixture that asserts verbatim carriage with no refusal on window-length grounds (F-4, DM-5).
- `git` is available to the ref-resolution and write-audit cells; a missing `git` fails those suites loudly rather than skipping.
- Exact suite file names, seam shapes, and helper names are delivery-bound (`AMB-TP-1`); behaviours, identities, closed vocabularies, bounds, AC traceability, and the truncation order are not.
- `delivery.metrics.v1` is one payload identity serving one report form (DEC-6, DEC-12), asserted by a single identity constant and the one key set.

### 8.3 Open Questions

All five entries below are closed in specification v1.1 — the two re-opened findings became DEC-13 and DEC-14, and two review pins were applied in place. The register is retained as the resolution record. **No open question remains, so nothing here gates delivery.**

| ID | Question | Status | Resolution |
|----|----------|--------|------------|
| OQ-TP-1 | **Which criterion governs the `MET-CEREMONY-SHARE` and `MET-CYCLE-TIME` values?** The v1.0 `AC-F2-1` unscoped recompute rule competed with `AC-F3-1`/`AC-F3-2` (`measurementKind: native` from the transition history / delivered runner fold) and with GH-296's delivered `nativeBasis` non-interchangeability statement. | **Resolved — DEC-13** (spec v1.1; `AC-F2-1`, DM-2 rescoped) | The value rule is basis-scoped: the committed-basis entry (the CI-failure-rate proxy) recomputes under the committed definition and never restates the log's committed value; native-basis entries (cycle time, ceremony share) compute from their declared native source, carry `definitionRef` for provenance and the delivered status semantics, are never presented as the committed definition's value, and disclose the proxy-vs-native non-interchangeability. Bound by `TC-METRICS-011` (basis-scoped values), `TC-METRICS-020` (native cycle time), `TC-METRICS-023` (native ceremony share), `TC-METRICS-026` (disclosure). No case depends on interpretation. |
| OQ-TP-2 | **What is the declared posture for unequal-length windows?** | **Resolved — F-4/DM-5** (declared posture) | Comparison rows render their windows verbatim; the view never refuses on window-length grounds and invents no downgrade; the protocol's equal-length requirement governs the owner's comparison claims (verdict honesty), not a command refusal trigger. `TC-METRICS-030`/`032` assert verbatim carriage and a normal exit-`0` render on the months-long-window fixture; `AMB-TP-4` records the two fixture window shapes. |
| OQ-TP-3 | **Is `crossedAt` the read instant or the window end?** | **Resolved — DM-4/DEC-5** (pinned) | `crossedAt` is the evaluation's read instant, identical to the trailing window's `end` bound. `TC-METRICS-050`/`105` assert equality with both the injected clock read instant and `window.end`, so an ambient clock or a stored first-crossing time fails. |
| OQ-TP-4 | **Does the AC count in the delivery instructions match the spec?** The spec's §17 declares **22** criteria (`AC-F1-1`, `AC-F2-1..2`, `AC-F3-1..4`, `AC-F4-1`, `AC-F5-1`, `AC-F6-1..5`, `AC-F7-1..2`, `AC-F8-1`, `AC-F9-1`, `AC-F10-1`, `AC-F11-1..2`, `AC-NFR9-1`). | **Resolved — spec declares 22; plan binds 22** | Every count reference in this plan reads **22**: §3.1 carries 22 AC rows, §3.4 records 22 ACs → 58 cases, §5/§7 id sets agree row for row, and §7's totals row reads 22 ACs / 10 NFRs. The earlier "20" was a message-level miscount, not a missing criterion. |
| OQ-TP-5 | **What does `perAgent` sum equal when steps are unattributable?** | **Resolved — DEC-14** (spec v1.1; `AC-F5-1` rescoped) | Exact `perAgent`-sum equality to the totals holds over the fully attributable selection (the `SC-M2-S6-01` seed fixture); with unattributable steps the `perAgent` sum equals the total minus the disclosed unattributable share, the breakdowns keep the null-value row summing to the full total, no row is invented, and the disclosure is named. Bound by `TC-METRICS-040` (exact half) and `TC-METRICS-042` (remainder half). The per-agent member naming (spec DM-3 `role` versus the delivered `agent`) stays delivery-bound and is asserted by value equality rather than key spelling. |

## 9. Plan Revision Log

| Version | Date | Author | Changes |
|---------|------|--------|---------|
| 1.0 | 2026-11-16 | @test-plan-writer | Initial test plan against spec v1.0. All **22** ACs of §17 bound to **58** cases in twelve blocks: report surface 001–006; baseline consumption, absence, and damage 010–016; measurement kinds and the caveat 020–026; comparison view 030–033; dispatch parity 040–042; alarms 050–056; escaped defects 060–063; classified absence, damage, and zero fabrication 070–072; mounting 080–083; registration 090–092; purity, determinism, bounds, clock, and read cost 100–106; gate and controls 110–112. Inherited `SC-M2-S6-01` (→ 040, 042) and `SC-M2-S6-02` (→ 050, 055) by name with the Appendix C mapping stated literally (`breakdowns.agentRole` → `breakdowns.role`, `totals.tokens` → the five-class total, the alarm assertions → the AC-F6-1/AC-F6-5 cells). Fixture strategy: seeded temp stores for the five source families, fixture `measurement-baseline.yaml` shapes (full/partial/absent/unparseable/invalid/committed-comparison/two window lengths), fixture project-committed config documents with the `metrics.burn-rate` node and its defect matrix, committed-path corpus fixtures for the CI proxy and escaped-defect citations, injected clocks/run-ids/brand, and at-cap bound seeds. Suites: 28 new, 20 updated, with a 12-row delivered-suite drift register and the Appendix D count-pin oracle. Three contract-level items reported for the DoR gate: the ceremony-share value governed by two criteria (`OQ-TP-1`: `AC-F2-1` vs `AC-F3-2`), the undeclared equal-window failure posture (`OQ-TP-2`), and `perAgent` sums under unattributable steps (`OQ-TP-5`: `AC-F5-1` vs the delivered attributable-only roll-up, with `GAP-T7` and the two-case binding in 040/042). One reading resolved by construction (`OQ-TP-3`: `crossedAt`), and the delivery-instruction AC count reconciled to the spec's **22** (`OQ-TP-4`). Every case names a test file under `tests/**`, its injection requirements, its status, and a failing-first observable. No TODO row, no unmapped AC, no orphan case; §3.1/§3.3, §5.1, §5.2, and §7 id sets identical. |
| 1.1 | 2026-11-16 | @test-plan-writer | Reconcile against spec v1.1 (amended at `d5cbb4c`): the re-opened findings are folded in as DEC-13 and DEC-14, with the two review pins applied in place. **DEC-13 — basis-scoped values:** `TC-METRICS-011` now binds the scoped rule (committed-basis recompute for `MET-CI-FAILURE-RATE`; native-basis values for `MET-CYCLE-TIME`/`MET-CEREMONY-SHARE` computed from the declared source, `definitionRef` kept for provenance, never presented as the committed definition's value), `TC-METRICS-023` the native ceremony-share source with the never-committed-value assertion, and `TC-METRICS-026` the non-interchangeability disclosure; §1.1, §3.1 `AC-F2-1`, §3.2 DM-2 and the §4.3 measurement-kind oracle gained the scoping plus a basis-scoping paragraph. **DEC-14 — scoped `perAgent` equality:** `TC-METRICS-040` states the exact-equality scope (the fully attributable `SC-M2-S6-01` seed fixture) and `TC-METRICS-042` the remainder form (sum = total − disclosed unattributable share, breakdowns keeping the null row and summing to the full total, no invented row); §3.1 `AC-F5-1`, §3.2 DM-3, the seed table, TR-11 and the §7 rows align. **OQ-TP-3 pin:** `crossedAt` is the read instant and therefore the trailing window's `end` (DM-4, DEC-5), asserted in `TC-METRICS-050`/`105` and recorded in `AMB-TP-3` and the alarm oracle. **OQ-TP-2 posture:** rows render windows verbatim with no refusal on window-length grounds (F-4, DM-5); `TC-METRICS-030`/`032`, `AMB-TP-4` and the §8.2 assumption now state verbatim carriage instead of any refusal. **OQ-TP-4:** the spec declares 22 ACs and every count reference says 22. All five `OQ-TP` entries are resolved in §8.3 with their DEC/F/DM pointers. No case added, removed, or renumbered. Traceability re-verified: **58** TCs, no orphan, no duplicate, **22/22** AC coverage, and §3.1/§3.3/§5.1/§5.2/§7 id sets identical. |

## 10. Test Execution Log

No case has been executed against a new implementation at authoring time; this plan is a verification map. Results are recorded here as delivery proceeds, per phase. A row without a recorded result is not evidence, and a skip is never recorded as a pass.

| TC ID | Run Date | Result | Notes |
|-------|----------|--------|-------|
| — | — | — | Execution evidence is recorded per phase below. |

**Planned aggregate evidence (populate at delivery):**

| Command | Result | Notes |
|---------|--------|-------|
| `bun test tests/structure/metrics-*.test.ts tests/behaviour/metrics-*.test.ts tests/checks/metrics-*.test.ts tests/golden/metrics.test.ts` | pending | family-wide narrow run |
| `bun test tests/structure tests/behaviour` | pending | added-surface and non-regression pass |
| `bun run scripts/checks/error-table-sync.ts` | pending | 146 → 147 / 62 → 63 / `+112` → `+113`, both directions |
| `bun run scripts/checks/help-guide-coverage.ts` | pending | metrics row, page, zero failures |
| `bun run scripts/checks/ambient-globals.ts` | pending | no ambient clock in the new modules |
| `git diff --check` | pending | whitespace/conflict guard |
| `./scripts/lint-commit-range.sh --base "$BASE_RANGE"` | pending | phase-9 supplementary range gate verdict (PM-owned) |
| `TMPDIR=$PWD/tmp/tmpdir pnpm check` | pending | aggregate gate before the PR |
