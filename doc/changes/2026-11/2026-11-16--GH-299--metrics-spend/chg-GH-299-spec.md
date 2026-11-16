---
change:
  ref: GH-299
  type: feat
  status: Proposed
  slug: metrics-spend
  title: "M2-S6: Metrics and spend (M2)"
  owners: [Juliusz Ćwiąkalski]
  service: delivery-os
  milestone: "M2: Ceremonies, measurement, and memory"
  labels: [milestone-m2, cli, metrics, measurement, alarms]
  version_impact: minor
  audience: mixed
  security_impact: low
  risk_level: medium
  dependencies:
    internal:
      - "M1-S19 / GH-236 (spend read side — delivered: the `delivery.spend.v1` fold with five-dimension breakdowns, cost totals, restarts, phase timing, and reconciliation that the metric layer composes; its own Feeds row names alarm/burn-rate M2-S6)"
      - "M2-S14 / GH-291 (harness telemetry v2 — delivered: the per-step and baseline record families and the five attribution dimensions ticket/repository/lane/agentRole/model feeding per-role and per-model facts)"
      - "M2-S3 / GH-296 (ceremony runner — delivered: the ceremony run/step records, the native measurement fold, and the committed comparison builder the metric layer consumes read-only)"
      - "GH-186 (measurement baseline — delivered: the committed, schema_version 2 log with the four MET- metric rows, status semantics, source-traceability rule, and comparison protocol)"
      - "GH-300 (suite-to-job mapping — delivered: the config-layer precedent for a project-committed declaration node consumed before any read)"
      - "Delivered result contract, error table, state layer, config layer, and branding seam"
    external: []
  links:
    decisions: ["ODR-0002"]
---

# CHANGE SPECIFICATION

> **PURPOSE**: Deliver the `metrics` command family — the alarm and metric layers over the delivered spend read side, telemetry v2, ceremony records, and the committed measurement baseline — so the M2 exit criteria (ceremony share, cycle time, CI failure rate, escaped defects, per-dispatch spend) are measurable with committed numbers and cost drift raises a burn-rate alarm instead of an anecdote.

## 1. SUMMARY

Delivery metrics and cost drift are anecdotal today: the committed baseline log records bash-era numbers, the spend read side reports delivery economics, and the ceremony runner records native durations — but no surface turns those building blocks into the M2 exit metrics, and no layer raises an alarm when spend crosses a declared threshold. This change delivers the `metrics` family: one read-only report per invocation carrying the four metric entries the ticket names (ceremony share, cycle time, CI failure rate, escaped defects) with their evidence basis, measurement kind, and sample; the per-dispatch tokens/cost/restarts block composed from the delivered spend fold; burn-rate alarms evaluated against a threshold declared in the project-committed configuration document; and a comparison view that applies the committed comparison protocol — same metric ID and definition over an equal-length window, sample minimum 5, the proxy-vs-native caveat on every cross-kind comparison.

The family is a pure read side: it never authors or edits `measurement-baseline.yaml` values (the log's immutability rule stands), never converts or re-prices cost, never fabricates a zero for absent evidence, and adds no event, scheduler, or notification channel. It mounts as the twenty-fourth prompt-required command family and registers exactly one new error-table row with the delivered same-commit count-pin discipline.

## 2. CONTEXT

### 2.1 Current State Snapshot

- **The spend read side is delivered and names this change as its consumer.** `spend [--ref]` folds the telemetry record families and `phase.transition` history into `delivery.spend.v1` with five-class token totals, calls, per-agent/model roll-ups, five-dimension breakdowns whose token sums equal the totals exactly, cost totals in harness-reported units with disclosed sparsity, restart counts, phase timing, the telemetry-state disclosure, and the declared-tolerance reconciliation. Its feature spec's own Feeds row names "alarm/burn-rate (M2-S6)". Telemetry absence is the classified `spend.telemetry-absent` outcome at exit 1, never a zero report.
- **Telemetry v2 attributes every step.** Each stored step carries the five attribution dimensions `ticket`, `repository`, `lane`, `agentRole`, and `model`; an absent dimension is `null` with the closed `unattributable-step` warning and is never defaulted. The delivered fold discloses its reading basis (`stream-ingest`, `closeout-capture`, `combined`).
- **The ceremony runner records native measurement data and one committed comparison.** Delivered run/step records carry per-step durations; the delivered native fold produces runner-derived run/step/phase counts and per-ceremony aggregates; the delivered builder authors exactly one `delivery.ceremony.comparison.v1` record per delivery into the log's additive `comparisons[]` list. The delivered rule stands: the committed comparison is authored data per delivery — no command computes, prints as committed truth, or rewrites it.
- **The measurement baseline log is canonical committed data.** `schema_version: 2`; four metric rows (`MET-CEREMONY-SHARE`, `MET-CYCLE-TIME`, `MET-CI-FAILURE-RATE`, `MET-FALSE-SIGNAL-INCIDENTS`) each carry definition, formula, unit, window, sources, sample counters, status (`MEASURED | PARTIAL | UNAVAILABLE`), `measurement_kind`, direction, and limitation. Status semantics, the source-traceability rule (every number cites a committed path plus anchor or an exact git command), the fixed window, the closed exclusion-reason set, and the comparison protocol (same metric ID and definition, equal-length window, sample minimum 5, proxy-never-compared-to-native-without-caveat) are delivered contract. Committed values are immutable (NFR-5); the log is the `MET-` allocator (ODR-0002).
- **The config layer carries the project-committed declaration precedent.** GH-300's `verify.suite-map` node is declared in the project-committed configuration document, read as one bounded single-document read, absent means undeclared with no default invented, and every defect is refused `config.value.invalid` before any read.
- **The delivery conventions are settled.** Every payload stays inside the five-field `delivery.result.v1` envelope with new keys under `data`; exit codes keep their meaning (`0` declared verdict, `1` refused, `2` platform/state failure); new identities join the closed error table by exact two-segment declaration with every count pin moved in the same commit; the prompt-required set registers twenty-three families today (`steer` being the twenty-third); machine payload and human digest bounds with deterministic tail-ordered truncation are delivered patterns.

### 2.2 Pain Points / Gaps

- **GAP-1**: No metric surface exists — the M2 exit metrics (ceremony share, cycle time, CI failure rate, escaped defects) are not answerable from any invocation; each claim must be re-derived by hand from scattered committed artifacts.
- **GAP-2**: No alarm layer exists — spend drift is discovered after the fact; the delivered spend read side computes the numbers but evaluates no threshold.
- **GAP-3**: "Escaped defects" has no operational definition and no `MET-` row — the ticket names it, but nothing says what counts, from which evidence, or with which honesty limits.
- **GAP-4**: The baseline's proxy numbers and the newly available native measurements (transition-history cycle time, runner-fold ceremony share) risk silent conflation — nothing applies the proxy-vs-native caveat mechanically.
- **GAP-5**: Per-dispatch spend visibility is split across surfaces — tokens, cost, and restarts live in `spend`, ceremony durations in ceremony records, and nothing joins them for one delivery view.

## 3. PROBLEM STATEMENT

Because the delivered building blocks stop at the spend read side, telemetry capture, ceremony records, and the committed baseline log — with no metric layer, no alarm layer, and no pinned definition for escaped defects — the owner cannot measure the M2 exit criteria with committed numbers or detect burn-rate drift without re-deriving figures by hand, so success claims stay anecdotal and overspend is discovered after the fact.

## 4. GOALS

- **G-1**: One `metrics` invocation reports the delivery's metrics from committed sources: the three baseline-consumed `MET-` entries, the escaped-defects entry, the per-dispatch spend block, the burn-rate alarm evaluation, and the comparison view — each figure carrying basis, measurement kind, window, and sample size.
- **G-2**: The metric layer consumes the committed baseline log by metric ID and definition and applies the delivered comparison protocol: equal-length window, sample minimum 5 (`insufficient-sample` below it, with no trend claim), and the proxy-vs-native caveat on every cross-kind comparison.
- **G-3**: Burn-rate alarms fire on measured overspend: the threshold is declared in the project-committed configuration document, the evaluation is a deterministic derived view with exactly one alarm per crossing, and the alarm echoes the ref, threshold, basis, and window.
- **G-4**: Escaped defects is a curated floor count from committed evidence only — review-verdict artifacts, retro findings, and CI observations — with closed classes, artifact-plus-anchor citations, and stated honesty limits.
- **G-5**: The layer is read-only over the event log, the committed baseline log, ceremony records, and committed evidence: it never authors or edits baseline values, never converts or re-prices cost, and never fabricates a zero for absent evidence.
- **G-6**: The family is deterministic, bounded, local-only, brand-neutral, uses no LLM and no network, and adds no event topic, scheduler, daemon, timer, or notification channel.

### 4.1 Success Metrics / KPIs

| Metric | Target |
|--------|--------|
| Ticket acceptance criterion demonstrated | 1 of 1 — exit criteria measurable with committed numbers (§Appendix B maps it to §17 criteria) |
| Scenario seeds green | SC-M2-S6-01 (spend breakdowns feed the metric layer; role/model sums equal totals) and SC-M2-S6-02 (exactly one `burn-rate` alarm with the threshold echoed, no duplicate for the same crossing) |
| Committed-number coverage | 100% of reported figures carry basis + measurement kind + window + sample size; 0 figures without a committed source |
| Zero fabrication | 0 zero-filled, estimated, or interpolated figures; every absent evidence classified (telemetry-absent style) |
| Baseline immutability | 0 writes to the committed log on any invocation path; byte-snapshot proof |
| Alarm honesty | Exactly one alarm per crossing; 0 duplicate alarms; threshold echoed on 100% of alarms; 0 alarms without a declared threshold |
| Mounting completeness | 1 prompt-set entry, 1 root help entry, 1 family help, 1 reference page, 1 coverage-inventory row, 24 registered root families (the delivered base is 23; `steer` is the 23rd) |
| Registration completeness | Exactly 1 new error row, allowlist 62 → 63, every Appendix D count pin moved in the same commit, four-way agreement |
| Determinism | Two runs over unchanged facts produce byte-identical human text and byte-identical machine `data` (envelope timing/run id excluded) |
| Quality gates | `TMPDIR=$PWD/tmp/tmpdir pnpm check` green before the PR opens |

### 4.2 Non-Goals

- **NG-1**: No baseline authoring — the layer never writes `measurement-baseline.yaml`, never edits committed values, and never authors `comparisons[]` records (those remain authored per delivery through the delivered builder; DEC-3).
- **NG-2**: No quota snapshots — they appear only in registry/M1 deferral summary rows, never in the canonical M2-S6 task list, the ticket, or the `metrics` registry row (DEC-1).
- **NG-3**: No native per-run CI failure rate — no committed CI run log exists; the rate stays a session-level proxy recomputed under the committed definition (DEC-7).
- **NG-4**: No alarm delivery machinery — no notification channel, no event topic, no subscription surface, no scheduler, daemon, timer, or push path; alarms are evaluated when the report is invoked (pull, like the steer read point) and are evidence, not gates: no gate blocks on an alarm.
- **NG-5**: No `MET-` allocation for escaped defects by this change — the log is the allocator and allocation is a baseline-authoring act (DEC-2).
- **NG-6**: No metrics subcommands beyond the single report invocation (DEC-12).
- **NG-7**: No model-profile routing, no spend capture changes, no ceremony runner behaviour change, and no change to any delivered payload key of spend, telemetry, ceremony, board, or status (the layer consumes; it does not extend those contracts' shapes).
- **NG-8**: No current-truth feature-spec amendment by this specification (phase 7 reconciles current truth; the one in-boundary exception is the error-table carrier, F-10).
- **NG-9**: No dashboards, charts, exports, or historical trend storage — the report is the surface; a later story may add views.

## 5. FUNCTIONAL CAPABILITIES

| ID | Capability | Rationale |
|----|------------|-----------|
| F-1 | The `metrics` report surface with one payload identity and drawn evidence window | The M2 exit metrics must be answerable from one invocation with committed numbers, not re-derived by hand |
| F-2 | Baseline-consumed metric entries by ID and definition | The committed log is canonical data; consuming by ID and definition keeps comparisons reproducible (comparison protocol) |
| F-3 | Native and proxy measurement kinds with mandatory disclosure | Cycle time and ceremony share are newly native; CI failure rate stays proxy; the proxy-vs-native caveat must travel with every cross-kind comparison |
| F-4 | The comparison view under the committed protocol | Trend claims need the sample minimum and closed verdicts, else they are anecdotes |
| F-5 | Per-dispatch tokens/cost/restarts from the delivered spend fold | The ticket names per-dispatch visibility; the delivered fold is the single source so the metric layer reads the same numbers (SC-M2-S6-01) |
| F-6 | Burn-rate alarms against a project-committed threshold | Cost drift must raise a classified, echoed, non-duplicating alarm (SC-M2-S6-02) |
| F-7 | Escaped defects as a curated floor from committed evidence | The ticket names the metric; the definition must be grounded in committed evidence with stated honesty limits |
| F-8 | Classified evidence absence and damage | A delivery with no telemetry says so — never a zero report; store damage keeps the delivered `state.*` identities |
| F-9 | Production mounting (prompt set, composition, help, page, inventory) | A definition without a mounted family is not a reachable command |
| F-10 | Error-table registration with same-commit count-pin moves | The delivered checks assert exact set sizes; undeclared widening would contradict the truth the checks pin |
| F-11 | Deterministic, bounded, local-only, brand-neutral surface | Metrics evidence must be reproducible, bounded, and safe |

### 5.1 Capability Details

- **F-1 — The report surface.** `<binary> metrics [--ref <ref>] [--from <iso>] [--through <iso>] [--json]` produces one report whose `data` carries the identity `delivery.metrics.v1` (a declared contract constant, not a data key) with exactly the keys `ref`, `window`, `metrics[]`, `dispatch`, `alarms[]`, `alarmEvaluation`, `comparisons[]`, `omitted`, `truncated` (DM-1). `--ref` follows the spend grammar: omitted resolves the active ref from the local delivery context; malformed or unresolvable refuses `input.value.rejected` before any read. `--from`/`--through` are optional inclusive ISO-8601 evidence-window bounds, jointly required or jointly omitted; the drawn default is the trailing 30 days ending at the injected clock's read instant (a declared contract constant, disclosed in every windowed entry). The invocation has no subcommands (DEC-12); an unknown flag or unexpected positional is the delivered `fallback.invocation` before any read.
- **F-2 — Baseline-consumed entries.** The report carries one metric entry per baseline-consumed metric ID from the closed vocabulary `MET-CEREMONY-SHARE | MET-CYCLE-TIME | MET-CI-FAILURE-RATE` (DM-2), each entry citing the committed definition (`definitionRef`: the log path plus the metric row's committed `source_commit`), reusing the delivered status semantics (`MEASURED | PARTIAL | UNAVAILABLE`), and conserving the delivered sample discipline: exclusions are counted with reasons from the log's closed set (`unparseable_yaml`, `date_only_or_missing_time`, `placeholder_zero_time`, `capture_change`, `outside_window`, `missing_metric_input`, `no_ci_observation`), never dropped silently. A log that carries no row for a vocabulary ID classifies that entry as row-absent evidence (F-8), never as zero. The fourth log row, `MET-FALSE-SIGNAL-INCIDENTS`, is not surfaced by this change (§7.2): the log row is untouched canonical data.
- **F-3 — Measurement kinds and disclosure.** Every metric entry carries `measurementKind` from the closed set `native | proxy | curated-count` and a `basis` naming its committed source. Cycle time is computed **natively** from the ref's delivered `phase.transition` history under the committed definition's interval (from `clarify_scope.started` to `pr_creation.completed`) with the delivered right-censoring rule (absent completion uses the latest completed phase and flags censored). Ceremony share is measured **natively** through the delivered ceremony measurement fold (runner-derived run/step/phase counts and per-ceremony aggregates). CI failure rate stays a **proxy**: recomputed under the committed baseline definition over the committed pm-notes corpus within the selected window — same source class, same definition, therefore comparable under the protocol — and never presented as a per-run rate. Every cross-kind comparison (a native value against the log's proxy value, or vice versa) carries the caveat verbatim in the entry and in the comparison row; a same-kind comparison follows the equal-window protocol without the caveat (DEC-7).
- **F-4 — The comparison view.** `comparisons[]` is a live, read-only evaluation under the committed protocol: for each baseline-consumed metric, the row carries the committed metric ID and definition reference, the `before` value with the log's window, basis, and measurement kind, the freshly measured `after` value with its window, measurement kind, and sample size, `sampleMinimum: 5`, and a verdict from the delivered closed set `improved | regressed | flat | not-established | insufficient-sample`. `improved`/`regressed`/`flat` require the sample minimum met; below it the verdict is `insufficient-sample` and neither the row nor any derived surface claims a trend. Cross-kind rows always carry the caveat. The view never writes the log and never restates a committed `comparisons[]` record as its own output (DEC-3).
- **F-5 — Per-dispatch spend visibility.** The `dispatch` block (DM-3) composes the delivered spend fold for the evaluated ref and carries `telemetryState` (`present | absent`), and over present telemetry the fold's five-class token totals, cost totals (harness-reported units, sparsity disclosed), restart count, and per-agent role/model roll-ups. The figures are the delivered fold's figures — equal for the same selection to `spend --ref`; the block never re-derives, re-prices, or re-reconciles them. The delivered reconciliation disclosure and its tolerance remain spend's own; the block cites them by reference (basis and verdict names), not by recomputation (SC-M2-S6-01).
- **F-6 — Burn-rate alarms.** The threshold is declared in the project-committed configuration document as the node `metrics.burn-rate` (schema `delivery.metrics.burn-rate.v1`; members `threshold`, `basis`, `window`; DEC-4). The evaluation reads one bounded single-document node, computes measured spend over the declared trailing window from the same telemetry records the spend fold reads — applying the delivered ingest rules unchanged (null-excluded token classes, never re-priced cost) — and compares against the threshold over the declared basis (`cost` in harness-reported units, or `tokens` as the five-class sum). A crossing (`measured ≥ threshold`) raises exactly one `burn-rate` alarm (DM-4) echoing `ref`, `basis`, `threshold`, `measured`, the window bounds, and cost sparsity when present. The alarm set is a derived view: at most one `burn-rate` entry per ref per evaluation, no duplicate for the same crossing, and a repeat evaluation over unchanged facts is byte-identical — deduplication is a determinism invariant, never persisted alarm state (DEC-5). An absent node classifies `threshold-undeclared`; telemetry absence classifies `telemetry-absent` (F-8); both states raise no alarm and invent no default threshold. A defective node is refused `config.value.invalid` before any read.
- **F-7 — Escaped defects, curated floor.** The `escaped-defects` entry counts defects recorded in committed evidence after the delivering change's own gates reported green: a review-verdict artifact finding a defect post-gate (`post-gate-review`), a committed CI observation recording a red or mixed outcome on the pushed or landed head (`landed-ci-failure`), or a committed retro finding attributing a defect to the landed change (`retro-attributed`). Each counted incident cites a committed artifact path plus anchor and carries its class from the closed three-value set; the entry reports total, per-class counts, the incident rows within the display cap with counted omissions, and the honesty limits stated in the entry: the count is a curated floor, not a census — unrecorded incidents are invisible, only artifact-anchored incidents count, and curation follows the committed-evidence rule (no `tmp/**`, `.ai/local/**`, uncommitted, or external source). The entry is a non-`MET-` vocabulary member (DEC-2); a window with no committed evidence classifies `UNAVAILABLE`, never zero.
- **F-8 — Classified absence and damage.** The report never refuses for absent evidence and never renders a zero figure: every section carries its classified evidence state — metric entries use the delivered status semantics plus the row-absent classification, the dispatch block names the delivered telemetry-absence condition verbatim, and the alarm evaluation declares `telemetry-absent` or `threshold-undeclared` (DEC-11). Store damage on any read keeps the delivered `state.*` identities and exits; store damage is never re-projected as absence. A baseline log that exists but cannot be parsed or validated is `metrics.baseline-unreadable` at exit 2 — damaged canonical data never masquerades as absence (DM-7).
- **F-9 — Production mounting.** `metrics` joins the prompt-required command set as the twenty-fourth family (the delivered base is 23, `steer` being the 23rd): prompt-set entry, unconditional production composition over the delivered read seams, root and family help entries, the M2 reference page serving the coverage check, and the coverage-inventory row. Mounting changes no other command's composition, and the family-count pins and the stale-count scan arm move 23 → 24 in the same commit (DEC-9).
- **F-10 — Error-table registration.** One new `metrics` domain kind with exactly one row, `metrics.baseline-unreadable` (DM-7), joins the closed table by exact two-segment declaration: allowlist 62 → 63, table entries 146 → 147, documented identities 146 → 147, delivered rows 145 → 146, and the sync-suite arithmetic +112 → +113, with every count-pinning site enumerated in Appendix D moving in the same commit, followed by the repo-wide no-leftover scan and four-way agreement. Value violations reuse `input.value.rejected`; grammar violations reuse `fallback.invocation`; kind-only `metrics` lookup is never used and a kind-only discriminant is contained by `fallback.internal`.
- **F-11 — Deterministic, bounded, local-only, brand-neutral.** Two runs over unchanged facts produce byte-identical human text and machine `data` (envelope timing and run id aside). Machine `data` ≤ 65 536 UTF-8 bytes; human digest ≤ 200 lines and ≤ 16 384 UTF-8 bytes; truncation is deterministic and tail-ordered with every drop counted, and `alarms[]`, `alarmEvaluation`, and the metric entries are never dropped (DEC-10). The family performs no LLM call, no network request, no tracker/provider read or write, no credential resolution, no timer, daemon, or control socket; the binary name in human output comes from the brand seam.

## 6. USER & SYSTEM FLOWS

```
Flow 1: The coordinator evaluates a delivery (AC-F1-1)
  Coordinator runs `metrics --ref GH-299 --json`
  → one read pass over the telemetry families, transition history, ceremony
    records, committed baseline log, config node, and committed evidence
  → the report carries metric entries, dispatch, alarm evaluation, comparisons
  → exit 0 with every evidence state declared.

Flow 2: Spend breakdowns feed the metric layer (AC-F5-1, SC-M2-S6-01)
  A completed delivery holds telemetry with role and model attribution
  → `spend --ref` breakdowns.role and breakdowns.model are non-empty and
    their token sums equal the delivered total
  → `metrics.data.dispatch` carries the same figures for the same selection:
    perAgent sums equal its totals; role/model arrays non-empty.

Flow 3: Burn-rate alarm on measured overspend (AC-F6-1, SC-M2-S6-02)
  A delivery's measured spend exceeds its declared threshold in the window
  → `metrics.data.alarms` holds exactly one `burn-rate` entry naming the ref,
    the threshold, the basis, the window bounds, and the measured value
  → a second evaluation over unchanged facts is byte-identical: no second
    alarm for the same crossing.

Flow 4: No threshold declared (AC-F6-2)
  The project-committed document declares no `metrics.burn-rate` node
  → `alarmEvaluation` is `threshold-undeclared`; no alarm is raised and no
    default threshold is invented; the rest of the report is unaffected.

Flow 5: Telemetry absent, other evidence present (AC-F6-3, AC-F8-1)
  The ref has no telemetry records but holds a transition history
  → the dispatch block declares the classified telemetry absence (no figures),
    the alarm evaluation declares `telemetry-absent` (no alarm),
    and cycle time and the corpus metrics still report measured values.

Flow 6: Trend claim gated by the sample minimum (AC-F4-1)
  The comparison view measures a metric whose after-sample has 3 changes
  → verdict `insufficient-sample`; no trend is claimed anywhere; the row
    carries the caveat when the before/after kinds differ.

Flow 7: Canonical data damaged (AC-F2-2)
  The committed baseline log exists but fails parse or validation
  → `metrics.baseline-unreadable` at exit 2; no partial report renders and
    nothing is re-projected as absence; stores stay untouched.
```

## 7. SCOPE & BOUNDARIES

### 7.1 In Scope

- The `metrics` command family with exactly one report invocation (`--ref`, `--from`, `--through`, `--json`) under one payload identity `delivery.metrics.v1`.
- The three baseline-consumed metric entries (`MET-CEREMONY-SHARE`, `MET-CYCLE-TIME`, `MET-CI-FAILURE-RATE`) consumed by ID and definition with the delivered status semantics, closed exclusion reasons, and the committed definition reference.
- The pinned measurement kinds and disclosure: cycle time native from the transition history with right-censoring; ceremony share native via the delivered ceremony measurement fold; CI failure rate proxy recomputation over the committed pm-notes corpus; the mandatory proxy-vs-native caveat on every cross-kind comparison.
- The comparison view under the committed protocol (equal-length window, `sampleMinimum: 5`, the delivered closed verdict set, no trend claim below the minimum).
- The per-dispatch `dispatch` block composed from the delivered spend fold (tokens, cost, restarts, per-agent role/model roll-ups) with equality to the delivered report for the same selection.
- Burn-rate alarms: the `metrics.burn-rate` declaration node in the project-committed configuration document, the windowed evaluation over the same telemetry records, the one-alarm-per-crossing invariant, the echoed fields, and the classified `threshold-undeclared` / `telemetry-absent` states.
- The `escaped-defects` entry: curated floor from committed evidence with the closed three-class set, artifact-plus-anchor citations, and stated honesty limits.
- Classified evidence absence and damage: per-section evidence states, `metrics.baseline-unreadable` at exit 2, delivered `state.*` reuse, no zero fabrication.
- Production mounting as the 24th prompt-required family and the error-table registration (one row, allowlist 62 → 63) with every Appendix D count pin moved in the same commit.
- Determinism, bounds, write discipline, purity, brand neutrality, and the declared exit projection.

### 7.2 Out of Scope

- [OUT] Quota snapshots — registry/M1 deferral summary rows only; never in the canonical task list, the ticket, or the `metrics` registry row (NG-2, DEC-1).
- [OUT] Surfacing the log's `MET-FALSE-SIGNAL-INCIDENTS` row in the report; the row stays untouched canonical data (a later change may surface it with its curated-floor caveat).
- [OUT] Any write to the committed baseline log: value edits, appended rows, or authored `comparisons[]` records (NG-1, DEC-3).
- [OUT] Alarm delivery machinery: notification channels, event topics or subscriptions, schedulers, daemons, timers, and gate blocking on alarms (NG-4).
- [OUT] A native per-run CI failure rate; no committed CI run log exists (NG-3, DEC-7).
- [OUT] A `MET-` allocation for escaped defects (NG-5, DEC-2).
- [OUT] Metrics subcommands beyond the single report (NG-6, DEC-12).
- [OUT] Changes to the delivered spend, telemetry, ceremony, board, or status payload keys, and changes to the ceremony comparison builder or its authored records (NG-7).
- [OUT] Model-profile routing and other spend consumers (owned by M1-S21).
- [OUT] Dashboards, historical charts, exports, or trend storage (NG-9).
- [OUT] Current-truth feature-spec amendments by this specification (NG-8, with the F-10 carrier exception).

### 7.3 Deferred / Maybe-Later

- Surfacing `MET-FALSE-SIGNAL-INCIDENTS` in the report once a consumer needs it (the row's curated-floor caveat travels with it).
- Alarm surfacing on the board or in the brief, through those surfaces' own extension points.
- A `MET-` allocation and committed baseline definition for escaped defects, via a baseline-authoring change under the log's allocator and immutability rules.
- Metrics subcommands (for example a history or per-phase view) if a second distinct verb need appears.
- A native CI observation ledger that would eventually let the CI failure rate graduate from session proxy to per-run rate under a new `MET-` ID with a supersession note.
- Ceremony-triggered or scheduled metric pulls, if a measured need appears (they would ride the ceremony runner's declared triggers, not a new scheduler).

## 8. INTERFACES & INTEGRATION CONTRACTS

### 8.1 REST / HTTP Endpoints

N/A — no HTTP surface. The family reads local state, the committed baseline log, the project-committed configuration document, and committed repository artifacts; no tracker, provider, or network call exists on any path.

### 8.2 Events / Messages

No new event topic, kind, or payload shape ships (NG-4). Alarms are report data, not events: the evaluation is a pull performed at invocation, and no subscriber, publisher, or topic is declared — the event taxonomy stays owned by M2-S13. The delivered command-audit ledger records `metrics` invocations as it records every composed command.

### 8.3 Data Model Impact

| ID | Element | Description |
|----|---------|-------------|
| DM-1 | Report payload | `data` carries exactly: `ref` (the evaluated work-item ref), `window` (`{ from, through }` — the effective evidence window, drawn or declared, inclusive bounds), `metrics[]` (DM-2), `dispatch` (DM-3), `alarms[]` (DM-4), `alarmEvaluation` (DM-4), `comparisons[]` (DM-5), `omitted` (integer), `truncated` (boolean). The payload identity `delivery.metrics.v1` is a declared contract constant, not a data key |
| DM-2 | Metric entry | One per vocabulary ID: `id` (closed `MET-CEREMONY-SHARE \| MET-CYCLE-TIME \| MET-CI-FAILURE-RATE \| escaped-defects`), `value` (never fabricated; absent when status is `UNAVAILABLE`), `status` (`MEASURED \| PARTIAL \| UNAVAILABLE` — the delivered log semantics), `measurementKind` (`native \| proxy \| curated-count`), `basis` (named committed source: `phase-transition-history`, `ceremony-runner-fold`, `committed-pm-notes-corpus`, `committed-evidence-corpus`), `unit`, `direction`, `sample` (`{ n }` plus the conserved counters where the corpus defines them), `definitionRef` (log path plus the metric row's `source_commit`; absent for `escaped-defects`), `excluded[]` (`{ reason, count }` over the log's closed reason set), `limitation`, `caveat` (present exactly on cross-kind disclosure), and for `escaped-defects` the `incidents[]` rows (`{ artifact, anchor, class, observedAt }`) |
| DM-3 | Dispatch block | `telemetryState` (`present \| absent`), and over present telemetry the delivered fold's figures for the same selection: `tokensByClass` (the five delivered classes), `costTotals` (total and per-model in harness-reported units with `sparse`), `restarts`, `perAgent[]` (role, model, calls, tokens), and `breakdowns` (`role`, `model` arrays whose token sums equal the totals; entries `{ value, calls, tokens, cost }` with the null-row-last ordering). Absent telemetry: the delivered absence condition is named verbatim, no figures render, `absenceReason` carries the classification. The delivered reconciliation disclosure is cited by reference (basis and verdict names), never recomputed |
| DM-4 | Alarm and evaluation | `alarms[]` entry: `kind` (`burn-rate` — closed single-entry vocabulary), `ref`, `basis` (`cost \| tokens`), `threshold`, `measured`, `window` (`{ start, end }`, closed bounds), `crossedAt` (the window's read instant), `sparse` (cost-basis sparsity disclosure). At most one entry per ref per evaluation. `alarmEvaluation`: `kind: "burn-rate"`, `status` (`evaluated \| threshold-undeclared \| telemetry-absent`), and over `evaluated` the `threshold`, `basis`, and `window` echoed |
| DM-5 | Comparison view row | `metricId` (vocabulary member with a committed log row), `definitionRef` (log path + row `source_commit`), `before` (`{ value, window, basis, measurementKind, status }` from the log), `after` (`{ value, window, measurementKind, status, sampleSize }` freshly measured), `sampleMinimum: 5`, `verdict` (`improved \| regressed \| flat \| not-established \| insufficient-sample`), `caveat` (present exactly when `before` and `after` measurement kinds differ). Derived at read time; never written to the log |
| DM-6 | Threshold declaration | The project-committed configuration document gains the additive node `metrics.burn-rate`, schema `delivery.metrics.burn-rate.v1`: `threshold` (positive number), `basis` (`cost \| tokens`), `window` (`<positive-integer>d`, 1..90). Absent node = undeclared; no default is invented. Every defect is refused `config.value.invalid` before any read. No delivered config node or layer behaviour changes |
| DM-7 | Error identities | A new `metrics` domain kind with exactly one row: `metrics.baseline-unreadable` (category `platform`, non-retryable, consequence `not_landed`, projection `platform-provider` → exit 2; raised when the committed baseline log exists but cannot be parsed or validated; never re-projected as absence). Exact two-segment declaration joining the reserved allowlist — **62 → 63**, no `metrics.*` family and no pattern widening — with the carrier counts **146 → 147** entries, **145 → 146** delivered rows, **146 → 147** documented identities, **1** `metrics` domain row, and the sync-suite arithmetic **+112 → +113**; every count-pinning site is enumerated in Appendix D and moves in the same commit (DEC-8, F-10) |
| DM-8 | Bounds and truncation | Machine `data` ≤ 65 536 UTF-8 bytes; human digest ≤ 200 lines and ≤ 16 384 UTF-8 bytes; evidence window grammar: inclusive ISO-8601 bounds, jointly required or jointly omitted; drawn default trailing 30 days; threshold window 1..90 days; `incidents[]` ≤ 8 rows; `perAgent[]` and `comparisons[]` ≤ 20 rows each. When the byte cap binds, rows drop tail-first in the fixed order `comparisons[]` → `incidents[]` → `perAgent[]`, each drop counted in `omitted` with `truncated: true`; `alarms[]`, `alarmEvaluation`, `ref`, `window`, and the metric entries themselves are never dropped |

**Command grammar.** `<binary> metrics [--ref <ref>] [--from <iso>] [--through <iso>] [--json]`. `--ref` follows the delivered ref grammar (canonical uppercase, case-sensitive, no folding); `--from`/`--through` are inclusive ISO-8601 bounds, jointly required or jointly omitted; `--json` is the global machine-output switch. A malformed ref, an unresolvable active context, a malformed or lone window bound, or a missing flag value refuses `input.value.rejected` before any read; an undeclared flag or unexpected positional is `fallback.invocation` before any read.

**Contract shape.**

```
metrics.data = {
  ref, window: { from, through },
  metrics: [{ id, value, status, measurementKind, basis, unit, direction,
              sample, definitionRef?, excluded[]?, limitation, caveat?,
              incidents[]? }],
  dispatch: { telemetryState, tokensByClass?, costTotals?, restarts?,
              perAgent[]?, breakdowns?, absenceReason? },
  alarms: [{ kind: "burn-rate", ref, basis, threshold, measured,
             window: { start, end }, crossedAt, sparse? }],
  alarmEvaluation: { kind: "burn-rate", status, threshold?, basis?, window? },
  comparisons: [{ metricId, definitionRef, before, after, sampleMinimum,
                  verdict, caveat? }],
  omitted, truncated
}
```

**Ordering and identity invariants (normative).** `metrics[]` orders by the closed vocabulary order (`MET-CEREMONY-SHARE`, `MET-CYCLE-TIME`, `MET-CI-FAILURE-RATE`, `escaped-defects`); `alarms[]` holds at most one `burn-rate` entry per evaluation; `comparisons[]` orders by the same vocabulary order restricted to committed row IDs; breakdown arrays follow the delivered spend ordering (tokens descending, value ascending, null row last); no ordering is influenced by store, log, or filesystem return order; `alarms[]` is never truncated (AC-F6-1 depends on it).

**Exit projection.**

| Outcome | Envelope | Exit |
|---|---|---|
| Report produced (including classified absences, undeclared threshold, and an all-absent evidence picture) | Success envelope, `delivery.metrics.v1` `data` | `0` |
| Value violation (malformed/unresolvable ref, malformed or lone window bound, missing value) | Error envelope, `input.value.rejected` (delivered) | `1` |
| Grammar violation (unknown flag, unexpected positional) | Error envelope, `fallback.invocation` (delivered) | `1` |
| Baseline log present but unparsable or invalid | Error envelope, `metrics.baseline-unreadable` | `2` |
| Threshold node defect (malformed declaration) | Error envelope, `config.value.invalid` (delivered) | `1` |
| Telemetry/ceremony/transition/audit store damage | Error envelope, delivered `state.*` rows with their own projections | `1` or `2` per row |
| Unclassifiable handler failure / kind-only `metrics` | Error envelope, `fallback.internal` (delivered) | `2` |

### 8.4 External Integrations

N/A — no vendor or API integration. The family touches no tracker, provider, credential port, or network endpoint; an offline host behaves identically to an online one.

### 8.5 Backward Compatibility

- **No delivered surface changes shape.** The spend report, telemetry records, ceremony records, status digest, board, and brief are consumed read-only; no delivered payload key is added, renamed, or re-semanted (NG-7). The spend fold's own contract — including the breakdown-sums-equal-totals rule SC-M2-S6-01 re-asserts — is unchanged.
- **New payload identity.** `delivery.metrics.v1` is a new payload identity; no consumer of delivered payloads sees a change.
- **Additive config node.** `metrics.burn-rate` follows the `verify.suite-map` pattern: one additive node in the project-committed document, absent means undeclared, defects refused `config.value.invalid`; no delivered node, layer behaviour, or resolved-tree semantics change.
- **Committed data untouched.** `measurement-baseline.yaml` gains nothing from this change: no schema bump, no value edit, no new row, no new comparison record (DEC-3).
- **New error identity.** The single `metrics` row is additive; the allowlist widens by exactly one code (62 → 63, DEC-8); no delivered identity changes meaning, category, or exit.
- **Family count.** The prompt-required set grows 23 → 24 (the delivered base registers 23 with `steer` at index 23); the delivered family-count assertions and the stale-count scan arm move with the mount (F-9).

## 9. NON-FUNCTIONAL REQUIREMENTS (NFRs)

| ID | Requirement | Threshold |
|----|-------------|-----------|
| NFR-1 | Envelope continuity: every new key lives under `data`, and the five-field `delivery.result.v1` envelope is untouched | 0 new top-level envelope keys; 0 `ok`/`command` fields anywhere |
| NFR-2 | Determinism and ordering: repeated runs over unchanged facts are stable, and every array follows its declared order | 2 of 2 runs byte-identical in human text and in JSON `data` (envelope timing/run id excluded); 0 undeclared order sources |
| NFR-3 | Read-only discipline: no write anywhere on any invocation path, including the committed baseline log, the config document, ceremony records, and evidence artifacts | 0 writes, 0 fences acquired, 0 log edits; byte-snapshot proof over every read source |
| NFR-4 | Bounds: machine and human output stay within the declared caps, and every drop is counted | `data` ≤ 65 536 UTF-8 bytes; human ≤ 200 lines / 16 384 UTF-8 bytes; incidents ≤ 8 rows; perAgent and comparisons ≤ 20 rows; every drop counted with `truncated` set; `alarms[]` never truncated |
| NFR-5 | Purity: no LLM, no network, no tracker/provider access, no timer, no daemon, no control socket, no product literal | 0 LLM calls; 0 network requests; 0 provider or tracker reads/writes; 0 timers/loops/sockets; 0 hardcoded product or binary names (brand seam only) |
| NFR-6 | Clock discipline: window bounds, the trailing-window read instant, censoring, and `crossedAt` all use the injected clock | 0 ambient wall-clock reads in the pure domain; every window and timestamp reproducible from a fixed clock |
| NFR-7 | Read cost: bounded passes per invocation | ≤ 1 verified read per telemetry record family + ≤ 1 transition-history read + ≤ 1 ceremony-record read + ≤ 1 baseline-log read + ≤ 1 config-node read + ≤ 1 bounded corpus scan per invocation; 0 reads beyond the declared sources; p95 ≤ 500 ms at 1 000 telemetry records and ≤ 2 s at 10 000 in the reference environment |
| NFR-8 | Exact-code resolution: the `metrics` identity resolves by exact code only | 0 kind-only `metrics` resolutions; a kind-only discriminant is contained by `fallback.internal` |
| NFR-9 | Quality gates for the delivering change | `TMPDIR=$PWD/tmp/tmpdir pnpm check` green before the PR opens |
| NFR-10 | Commit hygiene for the delivering change | Conventional commit subjects via the commit primitive; every commit body/footer line ≤ 100 characters |

## 10. TELEMETRY & OBSERVABILITY REQUIREMENTS

N/A — no new telemetry ships; the report is its own observability surface:

- Every figure carries its basis, measurement kind, window, and sample size, so a number is auditable to its committed source without leaving the payload.
- `omitted` and `truncated` count every dropped row, so a bounded view never implies completeness; `alarms[]` is never dropped.
- Absence is classified per section (status semantics, row-absent, `telemetry-absent`, `threshold-undeclared`), so silence never masquerades as a measurement.
- Failures are the classified identities of DM-7 with their exit rows; the summary names the failing condition.
- The delivered command-audit ledger records the invocation as it records every composed command; the family adds no counter, metric, or trace.

## 11. RISKS & MITIGATIONS

| ID | Risk | Impact | Probability | Mitigation | Residual Risk |
|----|------|--------|-------------|------------|---------------|
| RSK-1 | Trend claims from below-minimum samples turn the comparison view into a new anecdote source | H | M | The committed protocol is enforced mechanically: `sampleMinimum: 5`, verdict `insufficient-sample` below it, and no trend claim in the row or any derived surface (F-4, AC-F4-1) | Low |
| RSK-2 | Proxy/native conflation: a native cycle time or ceremony share is silently compared against the log's proxy values | H | M | Measurement kind is a per-entry closed field and the caveat is mandatory on every cross-kind comparison (F-3, DM-2, DM-5, DEC-7, AC-F3-4) | Low |
| RSK-3 | The metric layer drifts into authoring the baseline it consumes | H | L | Read-only by construction with a byte-snapshot gate over every read source (NFR-3, DEC-3, NG-1); the comparison view never writes | Low |
| RSK-4 | Count-pin drift during error-table registration | M | M | The exact widening (62 → 63; 146 → 147; +113) and every count-pinning site are enumerated in Appendix D and move in the same commit, followed by the no-leftover scan and four-way agreement (DM-7, DEC-8, AC-F10-1) | Low |
| RSK-5 | Alarm spam or duplicates erode trust in the alarm layer | M | M | The alarm set is a derived view with at most one `burn-rate` entry per crossing, byte-identical repeats, and no persisted alarm state to leak duplicates from (DEC-5, AC-F6-1, AC-F6-5) | Low |
| RSK-6 | The escaped-defects definition inflates into invented requirements beyond the ticket's own task item | M | M | The definition is a curated floor over committed evidence only, carries its honesty limits in the entry, and is explicitly non-`MET-` (DEC-2, AC-F7-1); the DoR gate critiques the definition | Low |
| RSK-7 | Mounting gap: the family is defined but unreachable, or the coverage check fails | M | M | Mounting is a declared capability with the complete unit: prompt-set entry, composition, help entries, reference page, inventory row, and the moved family-count pins (F-9, DEC-9, AC-F9-1) | Low |
| RSK-8 | A misdeclared or defaulted threshold produces false alarms or silent blindness | M | M | Defects refuse `config.value.invalid` pre-read; an absent node classifies `threshold-undeclared` and invents no default (DM-6, DEC-4, AC-F6-2, AC-F6-4) | Low |
| RSK-9 | An unbounded corpus or evidence scan over a wide window breaks latency bounds | M | L | One bounded pass per source with the declared read budget (NFR-7), counted exclusions, and the display caps with tail-ordered truncation (DM-8, AC-F11-2) | Low |

## 12. ASSUMPTIONS

- The delivered telemetry record families, `phase.transition` history, ceremony run/step records, and the delivered spend, ceremony-measurement, and comparison folds stay stable; the metric layer consumes them read-only and adds no record kind.
- The committed baseline log stays schema_version 2 with its four metric rows; this change adds no row and edits no value, and the log remains the `MET-` allocator.
- No committed CI run log exists, so the CI failure rate remains a session-level proxy recomputed over the committed pm-notes corpus; a native graduation is a later baseline-authoring act.
- The committed pm-notes and evidence corpus remains the source class for corpus metrics and escaped-defect curation, under the baseline's source-traceability rule (committed paths plus anchors only).
- Ceremony runs exist for measured windows where ceremony share claims a value; a window with no runs classifies `UNAVAILABLE` with the sample size named.
- The invoking checkout is the managed repository; ref resolution follows the delivered local-context behaviour, and the alarm evaluation instant is the invocation read (pull; no scheduler exists).
- The project-committed configuration document exists wherever the threshold is declared; a checkout without it classifies `threshold-undeclared` rather than failing.
- The delivered five-field envelope shape, exit-code meaning, and error taxonomy remain unchanged.

## 13. DEPENDENCIES

| Direction | Item | Notes |
|-----------|------|-------|
| Depends on | M1-S19 / GH-236 (spend read side) | **Delivered** — the `delivery.spend.v1` fold and its breakdown-sums-equal-totals contract the dispatch block composes; its Feeds row names this change |
| Depends on | M2-S14 / GH-291 (telemetry v2) | **Delivered** — the per-step/baseline families and the five attribution dimensions feeding per-role and per-model facts and the windowed alarm evaluation |
| Depends on | M2-S3 / GH-296 (ceremony runner) | **Delivered** — the run/step records and the native measurement fold behind native ceremony share; the committed comparison records remain authored data this change consumes, never rewrites |
| Depends on | GH-186 (measurement baseline) | **Delivered** — the canonical log, its four `MET-` rows, status semantics, closed exclusion reasons, source-traceability rule, and comparison protocol |
| Depends on | GH-300 (suite-to-job mapping) | **Delivered** — the config-layer precedent for the `metrics.burn-rate` declaration node and its pre-read `config.value.invalid` refusal |
| Depends on | Delivered result contract, error table, state layer, config layer, branding seam | The `metrics` domain kind, its one row, and the exact allowlist widening must be registered and documented in-boundary (F-10), including every count-pinning site (DEC-8, Appendix D) |
| Blocks | Nothing in M2 | The remaining M2 stories consume their own evidence; the milestone exit measurement is this change's consumer |
| Related | M2-S13 (event taxonomy) | Owns the topic contract; this change declares no publisher or subscriber (NG-4) |

## 14. OPEN QUESTIONS

The planning questions were resolved during specification: the quota-snapshot exclusion (pm-notes decision 1), the escaped-defects definition (pm-notes decision 2), the threshold home, the native-vs-consumed disclosure, the comparison-view boundary against the delivered no-recompute rule, the telemetry-absence exit posture, and the invocation shape are closed as DEC-1, DEC-2, DEC-4, DEC-7, DEC-3, DEC-11, and DEC-12 respectively. No question in this specification defers a decision to plan or test authoring.

| ID | Question (raised at planning) | Resolution | Where | Status |
|----|----------------------------------------|------------|-------|--------|
| OQ-1 | Where does the burn-rate threshold live: a contract-data constant or a project-committed declaration? | Project-committed declaration: the `metrics.burn-rate` node in the configuration document per the GH-300 `verify.suite-map` precedent — overspend thresholds are project policy, not tooling constants; absent means undeclared (DEC-4) | §5.1 F-6, DM-6 | Closed |
| OQ-2 | Are cycle time and CI failure rate computed natively from the ledger or consumed from the baseline definitions? | Cycle time: native from the delivered transition history under the committed interval definition with the delivered censoring rule. CI failure rate: proxy recomputation under the committed definition over the committed pm-notes corpus — no native per-run source exists. Ceremony share: native via the delivered runner fold. Every cross-kind comparison carries the caveat (DEC-7) | §5.1 F-3, DM-5 | Closed |
| OQ-3 | Does a live comparison view contradict GH-296's delivered rule that no command recomputes or prints the committed comparison? | No: the committed `comparisons[]` records stay authored per delivery and are read as data; the report's view is a live evaluation under the same protocol that never rewrites or restates a committed record as its own output (DEC-3) | §5.1 F-4, NG-1 | Closed |
| OQ-4 | Should telemetry absence refuse the whole report at exit 1, as `spend` does? | No: the report is multi-source, so a whole-report refusal would hide non-telemetry evidence; absence is classified per section with no zero figures — the telemetry-absence style applied to a composite report (DEC-11) | §5.1 F-8, §8.3 exit projection | Closed |
| OQ-5 | Should `metrics` expose subcommands (for example a history view)? | No: the registry row declares no verbs and one report answers the ticket; a second verb waits for a second distinct need (DEC-12) | §5.1 F-1, NG-6 | Closed |

## 15. DECISION LOG

| ID | Decision | Rationale | Date |
|----|----------|-----------|------|
| DEC-1 | Quota snapshots are **out of scope** for GH-299 | Authority: the canonical backlog M2-S6 task list and the ticket name ceremony share, per-dispatch tokens/cost/restarts, cycle time, CI failure rate, escaped defects, and burn-rate alarms; quota snapshots appear only in registry/M1 deferral summary rows, not in the canonical task list, the ticket, or the `metrics` registry row (pm-notes clarify_scope decision 1) | 2026-11-16 |
| DEC-2 | Escaped defects is defined as a curated floor over committed evidence only — closed classes `post-gate-review \| landed-ci-failure \| retro-attributed`, artifact-plus-anchor citations, floor-not-census honesty limits — carried as the non-`MET-` vocabulary member `escaped-defects`; no `MET-` allocation ships in this change | The ticket names the metric but pins no definition and no `MET-` row exists (pm-notes clarify_scope decision 2); the log is the allocator and allocation is a baseline-authoring act, so defining the evidence basis here without allocating an ID respects ODR-0002 and the log's immutability. The floor-and-caveat pattern is the delivered `MET-FALSE-SIGNAL-INCIDENTS` precedent | 2026-11-16 |
| DEC-3 | The metrics layer is read-only: it never authors or edits `measurement-baseline.yaml` values (the log's immutability NFR-5), and the report's comparison view is a live evaluation under the committed protocol that never rewrites or restates a committed `comparisons[]` record — those records remain authored per delivery through the delivered builder | The scope directive names the layer a read side; the log's own contract makes committed values immutable and the comparison protocol the only sanctioned comparison form; GH-296's delivered rule (no command recomputes, prints as committed truth, or rewrites the committed comparison) is preserved by consuming the log as data | 2026-11-16 |
| DEC-4 | The burn-rate threshold lives in the project-committed configuration document as the additive node `metrics.burn-rate` (schema `delivery.metrics.burn-rate.v1`; `threshold`, `basis` `cost \| tokens`, `window` 1..90 days), read as one bounded single-document node with defects refused `config.value.invalid` before any read; an absent node classifies `threshold-undeclared` and invents no default | The GH-300 `verify.suite-map` precedent: project-committed declarations for project policy. What "too expensive" means varies per project and economy; a contract-data constant would impose one owner's economics on every adopter, and an ambient default threshold would fabricate alarms | 2026-11-16 |
| DEC-5 | Alarm semantics: measured spend vs the declared threshold over the declared trailing window (closed bounds, injected clock), crossing at `measured ≥ threshold`; the alarm set is a derived view holding at most one `burn-rate` entry per ref per evaluation — "no duplicate alarm for the same crossing" is a determinism invariant, never persisted alarm state; every alarm echoes ref, basis, threshold, measured, and window | SC-M2-S6-02 pins exactly one alarm per crossing with the threshold echoed; a pure fold cannot double-report a crossing, and persisted alarm state would add a write plane this read-only layer must not have (NG-1 posture applied to alarms) | 2026-11-16 |
| DEC-6 | One payload identity `delivery.metrics.v1` declared as a contract constant (not a data key), with the closed vocabularies declared once as contract data: metric IDs (`MET-CEREMONY-SHARE \| MET-CYCLE-TIME \| MET-CI-FAILURE-RATE \| escaped-defects`), alarm kinds (`burn-rate`), measurement kinds (`native \| proxy \| curated-count`), statuses (`MEASURED \| PARTIAL \| UNAVAILABLE`), verdicts (`improved \| regressed \| flat \| not-established \| insufficient-sample`), evaluation states (`evaluated \| threshold-undeclared \| telemetry-absent`), escaped-defect classes, and basis names | The delegation requires the schema identity as a contract constant and closed vocabularies; the delivered pattern (spend's constant, ceremony's closed sets) keeps consumers matching exact tokens, and reusing the log's status and verdict sets avoids forking semantics the comparison protocol already defines | 2026-11-16 |
| DEC-7 | Measurement kinds are pinned per metric: cycle time **native** from the delivered `phase.transition` history (committed interval definition, delivered right-censoring rule); ceremony share **native** via the delivered ceremony measurement fold; CI failure rate **proxy** recomputed under the committed baseline definition over the committed pm-notes corpus; the proxy-vs-native caveat is mandatory on every cross-kind comparison | The baseline names M2-S6 the owner of native metrics while its own rows are proxies; the ledger and runner records make cycle time and ceremony share natively measurable today, but no committed CI run log exists, so that rate cannot graduate without inventing a source — which the baseline's source-traceability rule forbids | 2026-11-16 |
| DEC-8 | Exactly one error identity joins a new `metrics` domain kind — `metrics.baseline-unreadable` (platform, non-retryable, `not_landed`, `platform-provider` → exit 2) — as an exact two-segment declaration (**62 → 63** allowlist, no family/pattern widening), with the carrier counts **146 → 147** entries, **145 → 146** delivered rows, **146 → 147** documented, and the sync arithmetic **+112 → +113**; every Appendix D site moves in the same commit. Value violations reuse `input.value.rejected`; grammar refusals reuse `fallback.invocation`; store damage reuses `state.*`; config node defects reuse `config.value.invalid`; kind-only lookup is contained by `fallback.internal` | The spend/ceremony/steer precedent: a two-segment identity enters only by exact declaration and the checks assert exact set sizes. Damaged canonical committed data must be visible at exit 2 rather than re-projected as absence; every other failure condition already has a delivered identity, so a second row would be redundant surface | 2026-11-16 |
| DEC-9 | `metrics` mounts as the twenty-fourth prompt-required family (the delivered base registers 23 — `status` … `board`, `ceremony`, `steer`): prompt-set entry, unconditional production composition, root and family help, the M2 reference page, and the coverage-inventory row; the family-count pins and the stale-count scan arm move 23 → 24 with the mount in the same commit | The board/steer mounting precedent: edge-only composition is not reachable, and the delivered count pins and stale-token scans must move atomically or the suites contradict the shipped set | 2026-11-16 |
| DEC-10 | Bounds and truncation: machine `data` ≤ 65 536 UTF-8 bytes, human digest ≤ 200 lines / 16 384 bytes, deterministic tail-ordered drops (`comparisons[]` → `incidents[]` → `perAgent[]`), every drop counted; `alarms[]`, `alarmEvaluation`, `ref`, `window`, and the metric entries are never dropped | The delegation requires the result contract's bounded-output posture with deterministic tail-ordered truncation; the alarm rows are the payload's decision-critical content, so they survive truncation by contract | 2026-11-16 |
| DEC-11 | Absence posture: the report never refuses for absent evidence and never renders a zero figure — every section carries its classified evidence state (the digest collector pattern: observed / classified absence / row-absent), and telemetry absence names the delivered spend absence condition verbatim | The telemetry-absence style applied to a composite report: absence must say so, never render zero. A whole-report exit-1 refusal (spend's posture) fits a single-source command; here it would hide the transition-history, corpus, and ceremony evidence that needs no telemetry | 2026-11-16 |
| DEC-12 | The family ships exactly one report invocation with no subcommands; verbs beyond the report wait for a second distinct need | The `metrics` registry row declares no verbs; the blockers/steer second-consumer discipline resists speculative surface, and every scope item (metrics, dispatch, alarms, comparisons) is one read side over the same sources | 2026-11-16 |

## 16. AFFECTED COMPONENTS (HIGH-LEVEL)

| Component | Impact |
|-----------|--------|
| `metrics` CLI family (new command definition and edge composition in the CLI package) | New — the report grammar, value validation before any read, drawn evidence window, human render, failure hooks, and runtime composition over the delivered read seams |
| Metrics contracts and pure domain (new contract and domain modules in the core package) | New — the payload identity constant, closed vocabularies, bounds, metric-entry and comparison-view folds, the windowed burn-rate evaluation, evidence-state classification, and the bounded renderers |
| Threshold declaration node (config layer vocabulary) | Extended additively — the `metrics.burn-rate` node (DM-6) with its pre-read validation; no delivered node or layer behaviour changes |
| Delivered spend fold | Consumed unchanged — the dispatch block cites the delivered figures for the same selection; no spend key or behaviour changes |
| Delivered telemetry reads, transition history, ceremony records | Consumed unchanged — verified reads over the delivered record families; no record kind changes |
| Committed measurement baseline log | Consumed unchanged — canonical data read by metric ID and definition; 0 writes (NFR-3) |
| Committed evidence corpus (pm-notes, review-verdict artifacts, retro findings) | Consumed unchanged — the bounded corpus scan behind CI failure rate and escaped defects |
| Error table and classifier (core error-table contract, CLI classification, the sync check and its structural mirror) | Extended — the new `metrics` domain kind and its one row; the closed two-segment allowlist gains exactly that code (62 → 63), and every identity-count pin in Appendix D moves with it (146 → 147; 145 → 146; +112 → +113; 147 documented) |
| CLI entrypoint, production composition, help, and prompt-required set | Extended — the 24th prompt-required family: prompt-set entry, unconditional composition, root and family help entries |
| Help-coverage check and coverage inventory | Extended — the metrics reference page and inventory row |
| Current-truth feature specs | Reconciled in phase 7 (see §16.1); the error-table carrier is the one in-boundary documentation write (F-10) |
| Planning corpus (backlog marker, M2 status, CLI command registry) | Maintained at delivery per milestone conventions |

### 16.1 Doc impact (phase-7 reconciliation)

| Document | Expected reconciliation |
|---|---|
| New current-truth feature spec (metrics) | Authored in phase 7 (first-spec-only, always-resolve): the payload identity, closed vocabularies, metric entries and disclosure, dispatch parity, alarm evaluation and declaration node, comparison view, bounds, exit projection, and the read-only posture |
| `doc/spec/features/feature-result-contract.md` | **In-boundary carrier (F-10):** the `metrics` domain kind, its one row with exit projection, and the closed two-segment allowlist paragraph gaining exactly the one code (62 → 63, no family/pattern widening); the documented identity counts move 146 → 147 at both mentions, and the kind inventory gains the `metrics` row. Phase 7 reconciles the surrounding prose and confirms the same numbers |
| `doc/spec/features/feature-spend.md` | Additive consumer note: the Feeds row resolves to the delivered metrics layer reading the same numbers; no spend behaviour changes |
| `doc/spec/features/feature-telemetry-v2.md` | Additive consumer note: the metrics layer reads the step/baseline families for per-role/model facts and the windowed evaluation |
| `doc/spec/features/feature-measurement-baseline.md` | Additive consumer note: the log's first command-surface consumer, reading by metric ID and definition under the comparison protocol; the immutability rule unchanged |
| `doc/spec/features/feature-ceremony-runner.md` | Additive consumer note: the metrics layer reads the native measurement fold and the committed comparison records as data; the no-recompute rule unchanged |
| `doc/spec/features/feature-config-layer.md` | The node table gains the `metrics.burn-rate` row with its schema, members, and absence semantics |
| `doc/spec/features/feature-cli-entrypoint.md` and `feature-agents-and-commands.md` | The prompt-required set 23 → 24 with the composition row and counts |
| Help guide coverage | The coverage inventory gains the metrics row and reference page |
| Planning corpus | Backlog M2-S6 progress marker, M2 status snapshot, CLI command registry row (24 families) |

## 17. ACCEPTANCE CRITERIA

**Report surface and grammar**

| ID | Criterion | Linked |
|----|-----------|--------|
| AC-F1-1 | **Given** a bound checkout, **when** `metrics` runs with no flags, **then** the report exits `0` carrying `ref` resolved from the active context, `window` drawn to the trailing 30 days ending at the injected clock, the four metric entries in vocabulary order, the `dispatch` block, `alarmEvaluation`, `comparisons[]`, and `omitted`/`truncated`, all under the `delivery.metrics.v1` identity with no envelope change; and **given** `--from` without `--through` (or either bound malformed), **then** the run is refused `input.value.rejected` at exit `1` before any read | F-1, DM-1, DM-8, DEC-12 |
| AC-F2-1 | **Given** the committed baseline log with its four metric rows, **when** the report renders, **then** each baseline-consumed entry carries its committed `definitionRef` (log path plus row `source_commit`), the delivered status semantics, its closed exclusion reasons with counts, and a value recomputed under the committed definition — never a restatement of the log's committed value presented as a fresh measurement; and the log's values and `comparisons[]` records are byte-identical before and after the invocation | F-2, DM-2, DEC-3, NFR-3 |
| AC-F2-2 | **Given** a baseline log absent from the checkout, **then** the baseline-consumed entries classify row-absent evidence with no values and the report still exits `0`; and **given** a log that exists but cannot be parsed or validated, **then** the run is refused `metrics.baseline-unreadable` at exit `2` and no partial report renders | F-8, DM-7, DEC-8 |

**Measurement kinds and disclosure**

| ID | Criterion | Linked |
|----|-----------|--------|
| AC-F3-1 | **Given** a ref with a delivered `phase.transition` history, **when** the cycle-time entry renders, **then** its value derives natively from the transition history under the committed interval definition (`clarify_scope.started` → `pr_creation.completed`), a ref whose completion transition is absent is right-censored with the flag set and the latest completed phase used, `measurementKind` is `native`, `basis` is `phase-transition-history`, and no figure is synthesized when the history holds no usable pair (`UNAVAILABLE`, never zero) | F-3, DM-2, DEC-7 |
| AC-F3-2 | **Given** ceremony run records in the window, **when** the ceremony-share entry renders, **then** its value and sample derive from the delivered ceremony measurement fold (runner-derived run/step/phase counts) with `measurementKind` `native` and `basis` `ceremony-runner-fold`; a window with no ceremony runs classifies `UNAVAILABLE` with `sample.n == 0` named | F-3, DM-2, DEC-7 |
| AC-F3-3 | **Given** the committed pm-notes corpus in the window, **when** the CI-failure-rate entry renders, **then** its value is recomputed under the committed baseline definition (red-or-mixed numerator over observed denominator) with `measurementKind` `proxy`, the session-proxy limitation stated, unobserved rows excluded with the closed `no_ci_observation` reason and never assumed green, and no per-run rate claimed | F-3, DM-2, DEC-7 |
| AC-F3-4 | **Given** any comparison whose before and after measurement kinds differ, **when** the row renders, **then** the caveat is present in the comparison row and in the owning metric entry; and **given** a same-kind comparison, **then** the protocol applies without the caveat — the caveat is present exactly on cross-kind disclosure | F-3, F-4, DM-5, DEC-7 |

**Comparison view**

| ID | Criterion | Linked |
|----|-----------|--------|
| AC-F4-1 | **Given** a baseline-consumed metric with a freshly measured after-sample, **when** the comparison row renders, **then** it carries the committed metric ID and `definitionRef`, the log's before value with its window/basis/kind, the after value with its window/kind/sample size, `sampleMinimum: 5`, and a verdict from the delivered closed set; a sample below 5 yields `insufficient-sample` with no trend claim anywhere in the payload; and the log stays byte-identical after the invocation | F-4, DM-5, DEC-3, RSK-1 |

**Per-dispatch spend visibility**

| ID | Criterion | Linked |
|----|-----------|--------|
| AC-F5-1 | **Given** a completed delivery with role- and model-attributed telemetry, **when** `spend --ref` and `metrics` both run for the ref, **then** the spend report's `breakdowns.role` and `breakdowns.model` are non-empty with token sums equal to the delivered total (the delivered contract SC-M2-S6-01 re-asserts), and `metrics.data.dispatch` carries the same figures for the same selection: `perAgent` sums equal its totals, role and model arrays are non-empty, `tokensByClass`, `costTotals` (with sparsity), and `restarts` equal the delivered fold's values, and no figure is re-derived or re-priced (scenario seed SC-M2-S6-01) | F-5, DM-3, DEC-6 |

**Burn-rate alarms**

| ID | Criterion | Linked |
|----|-----------|--------|
| AC-F6-1 | **Given** a declared threshold and a delivery whose measured spend over the declared window meets or exceeds it, **when** the metric layer evaluates the delivery, **then** `metrics.data.alarms` holds exactly one `burn-rate` entry naming the ref with the threshold echoed (`basis`, `threshold`, `measured`, window bounds, `crossedAt`, and cost sparsity when present), `alarmEvaluation.status` is `evaluated`, and a repeat evaluation over unchanged facts is byte-identical with still exactly one entry — no second alarm for the same crossing (scenario seed SC-M2-S6-02) | F-6, DM-4, DEC-5 |
| AC-F6-2 | **Given** a checkout whose project-committed document declares no `metrics.burn-rate` node, **when** the report renders, **then** `alarmEvaluation.status` is `threshold-undeclared` with no threshold, basis, or window echoed, `alarms[]` is empty, no default threshold is invented, and the rest of the report is unaffected at exit `0` | F-6, DM-6, DEC-4 |
| AC-F6-3 | **Given** a ref with no telemetry records but with other evidence, **when** the report renders, **then** the dispatch block declares the classified telemetry absence with no figures, `alarmEvaluation.status` is `telemetry-absent` with no alarm raised, and the transition-history, corpus, and ceremony metrics still report their measured values at exit `0` | F-6, F-8, DEC-11 |
| AC-F6-4 | **Given** a `metrics.burn-rate` node that is malformed (non-positive threshold, unknown basis, out-of-range or non-conforming window), **when** `metrics` runs, **then** the run is refused `config.value.invalid` at exit `1` before any telemetry or log read | F-6, DM-6, DEC-4 |
| AC-F6-5 | **Given** a declared threshold and measured spend below it, **when** the evaluation renders, **then** `alarms[]` is empty, `alarmEvaluation.status` is `evaluated` with the threshold echoed, and the below-threshold evaluation is indistinguishable in shape from the crossing case except for the alarm row — the absence of an alarm is declared, not silent | F-6, DM-4, DEC-5 |

**Escaped defects**

| ID | Criterion | Linked |
|----|-----------|--------|
| AC-F7-1 | **Given** committed evidence recording a post-gate review defect, a landed-head CI failure, or a retro-attributed defect within the window, **when** the escaped-defects entry renders, **then** each counted incident cites a committed artifact path plus anchor, carries its class from the closed three-value set, the entry reports total and per-class counts with the floor caveat stated verbatim, and no incident without an artifact-plus-anchor citation is counted | F-7, DM-2, DEC-2 |
| AC-F7-2 | **Given** a window with no committed evidence of any of the three classes, **when** the entry renders, **then** the value is absent with status `UNAVAILABLE` and the absence named — never a zero count presented as a measurement | F-7, F-8, DEC-11 |

**Classified absence, purity, determinism, and bounds**

| ID | Criterion | Linked |
|----|-----------|--------|
| AC-F8-1 | **Given** any report invocation, **when** absence is inspected, **then** no section renders a zero for absent evidence: metric entries use the delivered status semantics or row-absent classification, the dispatch block names the delivered telemetry-absence condition, and the evaluation declares its unavailability; and **given** store damage on any read, **then** the delivered `state.*` identity fires with its own projection and is never re-projected as absence | F-8, DEC-11 |
| AC-F9-1 | **Given** the delivered entrypoint, **when** root `--help` runs, **then** `metrics` appears as a registered family among 24 families (the delivered base is 23, `steer` being the 23rd), and `metrics --help` answers at exit `0` with summary, usage, options, at least one example, exit codes, and a see-also pointer; and **given** the delivered help-coverage check, **then** the metrics reference page exists, mentions `--help` and `--version`, and the coverage inventory carries the metrics row with zero failures | F-9, DEC-9 |
| AC-F10-1 | **Given** the delivered error-table sync check, its structural mirror, the dispatch-taxonomy and verify-suite-map suites, and the carrier, **when** the metrics identity lands, **then** (a) the closed two-segment allowlist contains exactly the one `metrics.baseline-unreadable` code and no other `metrics.*` code (**62 → 63**, exact declaration, no pattern or family widening); (b) every count-pinning site enumerated in **Appendix D** moves to its declared post-change value in the same commit as the row (**146 → 147** entries; **145 → 146** delivered; **62 → 63** allowlist; **146 → 147** documented; `BASELINE_ROWS.length + 112` → **+113**); (c) the repo-wide no-leftover scan over the named files, with its legacy-token list extended by the pre-change values (146, 145, 62, +112), finds no leftover pin; and (d) the classifier, sync check, structural mirror, and carrier agree on the same post-change numbers, and a near-miss two-segment `metrics.*` code is rejected by the check rather than accepted by family matching | F-10, DM-7, DEC-8 |
| AC-F11-1 | **Given** any metrics invocation, **when** its behaviour is inspected, **then** it makes no LLM call, no network request, no tracker or provider read or write, starts no timer, daemon, or listener, opens no control socket, performs no session operation, renders no hardcoded product or binary name, and writes no byte to any store, log, or document | F-11, NFR-3, NFR-5 |
| AC-F11-2 | **Given** unchanged facts, **when** any metrics invocation runs twice, **then** the human text and machine `data` are byte-identical (envelope timing and run id aside), every array follows its declared order, and **given** a produced result at the declared caps, **then** the 65 536-byte `data` cap, the 200-line / 16 384-byte human cap, the row caps, and the tail-ordered truncation order (`comparisons[]` → `incidents[]` → `perAgent[]`) hold with every drop counted in `omitted` and `truncated` set, and `alarms[]` is never dropped | F-11, DM-8, DEC-10, NFR-2, NFR-4 |
| AC-NFR9-1 | **Given** the delivering change, **when** quality gates run before the PR opens, **then** `TMPDIR=$PWD/tmp/tmpdir pnpm check` is green | NFR-9 |

### 17.1 Definition of Done (change-specific)

This change is done when every condition below holds. Each condition binds the §17 acceptance criteria to a checkable outcome, names its verification method, and is proven in the delivering plan phase that owns the capability. This specification claims no passing evidence and no acceptance; the conditions define what must be proven.

| # | Done condition | Binds | Verification (test / evidence) | Proven in plan |
|---|---|---|---|---|
| DoD-1 | The report surface produces the declared payload under the `delivery.metrics.v1` identity with the drawn evidence window and declared grammar refusals before any read | F-1, AC-F1-1, DM-1, DM-8 | Envelope/grammar contract tests green (drawn window, lone-bound and malformed-bound refusals) | Surface phase |
| DoD-2 | The three baseline-consumed entries consume the log by ID and definition with committed `definitionRef`, delivered status semantics, counted exclusions, and a byte-identical log after every invocation | F-2, AC-F2-1, DEC-3, NFR-3 | Baseline-consumption tests green including the byte-snapshot immutability proof | Baseline phase |
| DoD-3 | Row-absent and damaged-baseline behaviours are classified: row-absent renders at exit 0, damage refuses `metrics.baseline-unreadable` at exit 2 with no partial report | F-8, AC-F2-2, DM-7 | Absence and damage tests green | Baseline phase |
| DoD-4 | Measurement kinds and disclosure hold: native cycle time with censoring, native ceremony share from the runner fold, proxy CI failure rate with the session-proxy limitation and `no_ci_observation` handling | F-3, AC-F3-1..AC-F3-3, DEC-7 | Per-metric measurement tests green (censoring cell, empty-window cells, proxy corpus cells) | Measurement phase |
| DoD-5 | The caveat appears exactly on cross-kind comparisons and never on same-kind rows | F-3, F-4, AC-F3-4, DM-5 | Caveat matrix tests green | Comparison phase |
| DoD-6 | The comparison view applies the committed protocol: closed verdicts, `sampleMinimum: 5`, `insufficient-sample` with no trend claim below the minimum, log untouched | F-4, AC-F4-1, RSK-1 | Comparison-protocol tests green including below-minimum and log-immutability cells | Comparison phase |
| DoD-7 | The dispatch block carries the delivered fold's figures for the same selection with breakdown sums equal to totals (SC-M2-S6-01 green) and no re-derivation | F-5, AC-F5-1, DM-3 | Spend-parity tests green (scenario seed fixture) | Dispatch phase |
| DoD-8 | The burn-rate alarm fires exactly once per crossing with the threshold echoed and byte-identical repeats (SC-M2-S6-02 green) | F-6, AC-F6-1, DEC-5 | Alarm evaluation tests green including the repeat-identity cell | Alarm phase |
| DoD-9 | Undeclared threshold, telemetry-absent evaluation, below-threshold, and malformed-node cases are all declared outcomes: no alarm without a declared crossing, no default threshold, `config.value.invalid` pre-read | F-6, AC-F6-2..AC-F6-5, DM-6, DEC-4 | Alarm classified-state tests green (four cells) | Alarm phase |
| DoD-10 | Escaped defects is the curated floor: artifact-plus-anchor citations, closed classes, stated honesty limits, `UNAVAILABLE` never zero | F-7, AC-F7-1, AC-F7-2, DEC-2 | Curation tests green including the no-evidence cell | Escaped-defects phase |
| DoD-11 | Absence is classified everywhere and store damage keeps the delivered `state.*` identities; zero fabrication is absent on every path | F-8, AC-F8-1, DEC-11 | Absence/damage matrix tests green including the honesty mutants | Every phase's gate |
| DoD-12 | Mounting is complete: 24th prompt-required family (23 delivered today), unconditional composition, root and family help, reference page serving the coverage check, inventory row, moved family-count pins and stale-count scan arm | F-9, AC-F9-1, DEC-9 | Root `--help` snapshot green; help-coverage check green; family-count pins moved | Mounting phase |
| DoD-13 | Error registration is exact: one `metrics` row, allowlist 62 → 63, every Appendix D site moved in the same commit, no-leftover scan green, four-way agreement, near-miss rejection | F-10, DM-7, AC-F10-1, DEC-8 | All Appendix D sites moved; scan and agreement suites green | Classification phase |
| DoD-14 | Purity, determinism, bounds, read-only discipline, and clock discipline hold across the family | F-11, NFR-2..NFR-8, AC-F11-1, AC-F11-2 | Purity, determinism, bounds, byte-snapshot, and fixed-clock tests green | Every phase's gate |
| DoD-15 | Full acceptance coverage: every §17 criterion green, with no uncovered criterion and no orphan test | §17, NFR-1..NFR-10 | Test-plan coverage matrix all Covered; execution evidence in pm-notes | Per-phase, roll-up at the final delivery phase |
| DoD-16 | The full gate battery is green at the delivered HEAD | NFR-9, AC-NFR9-1 | `TMPDIR=$PWD/tmp/tmpdir pnpm check` recorded in pm-notes `notes:` | Final delivery phase / quality_gates |
| DoD-17 | PR posture: a pull request targets `main-tools` and is left open for human review with required CI green on the pushed HEAD; merge and owner acceptance are not claimed | §18 | PR record attached to the change | Lifecycle phase 11 |

A condition without passing evidence is not done; `dod_check` reopens the owning plan phase rather than waiving a row.

## 18. ROLLOUT & CHANGE MANAGEMENT (HIGH-LEVEL)

- **Delivery**: the full 11-phase lifecycle on the feature branch created from `main-tools`; the PR targets `main-tools` and stops open for human review. Commits go through the commit primitive with conventional subjects and every body/footer line ≤ 100 characters; `TMPDIR=$PWD/tmp/tmpdir pnpm check` is green before the PR opens (NFR-9, NFR-10).
- **Ordering inside the change**: the metrics contracts and pure folds land before the command surface; the error identity registers in the same boundary as its first refusing path (F-10); mounting completes before the gates phase so the coverage check gates the final state; the count-pin moves (error table and family mount) each land in one commit per the delivered discipline.
- **Adoption**: the coordinator and operator gain the report immediately; alarm value accrues as projects declare their `metrics.burn-rate` nodes — undeclared is a supported steady state, not an error state. No migration, flag, or dual-run exists; the family is additive and inert until invoked.
- **Rollback**: reverting the change removes the family, its config node vocabulary, and its error row; the committed baseline log and every consumed record are untouched data requiring no cleanup.
- **Communication**: the M2 reference page is the operator documentation; the milestone pack (contracts, scenarios) already describes the surfaces this change implements.

## 19. DATA MIGRATION / SEEDING (IF APPLICABLE)

N/A — no migration. The committed baseline log gains no row, no value edit, and no schema bump; the configuration document gains only the optional declaration node absent-by-default; no state record kind is added, and no existing store, log, or document changes layout.

## 20. PRIVACY / COMPLIANCE REVIEW

- **Aggregate-only evidence**: telemetry-derived figures are the delivered aggregate counts and identity references; no prompt text, message body, transcript, diff, tool output, or credential material is read onto any output path, and the delivered serialization redaction chokepoint composes unchanged.
- **Committed-source discipline**: every reported figure cites a committed source under the baseline's source-traceability rule; the corpus and evidence scans read committed repository documents only — no `tmp/**`, `.ai/local/**`, uncommitted, or external source is a measurement.
- **No secret echo**: the family resolves no credential; error summaries name conditions, never bytes from the documents they read.
- **Untrusted-input posture**: committed documents and log rows are data, not instructions — no document content can override policy; the report renders findings for the owner's judgement.

## 21. SECURITY REVIEW HIGHLIGHTS

- **Read-only by construction**: no append, fence, write, salvage, spawn, network, or credential call is reachable on any invocation path; the byte-snapshot gate proves every read source unchanged (NFR-3).
- **Declaration validation before reads**: a defective `metrics.burn-rate` node is refused `config.value.invalid` before any telemetry or log read, so a hostile or malformed declaration cannot steer a half-completed evaluation (DM-6, AC-F6-4).
- **Exact-code containment**: the `metrics` identity resolves by exact code only; a near-miss two-segment code is rejected by the sync check rather than accepted by family matching, and kind-only lookup is contained by `fallback.internal` (NFR-8, AC-F10-1).
- **Alarm honesty as a safety property**: an alarm can only exist with a declared threshold and measured evidence; no default threshold and no synthesized crossing exist, so the alarm surface cannot be triggered into false claims by absence (DEC-4, DEC-5).
- **Bounded hostile input**: ref shape, ISO bounds, and the declaration node are validated before any read; undeclared flags are rejected by the shared parser.

## 22. MAINTENANCE & OPERATIONS IMPACT

- **New family to maintain**: contracts, domain, and CLI modules for `metrics` follow the delivered layering; the pure domain carries the folds, the windowed evaluation, and disclosure with no I/O.
- **Count pins**: the error-table identity counts (147/146/63/+113) and the family count (24) are pinned in the sites Appendix D and the mounting suites enumerate; future identity or family additions move them the same way.
- **Committed-data coupling**: the report's baseline-consumed entries depend on the log's metric IDs, definitions, and status semantics; a definition change allocates a new `MET-` ID per the protocol and the vocabulary extends by exact declaration, never by pattern.
- **Alarm threshold ownership**: thresholds are project policy in the committed configuration document; operators adjust them in their project, and the tooling ships none.
- **Prompt surface**: the 24th prompt-required family joins the prompt set; future metric consumers extend the same payload identity and vocabularies rather than adding a parallel surface.

## 23. GLOSSARY

| Term | Definition |
|------|------------|
| Metric entry | One report row keyed by the closed metric-ID vocabulary, carrying value, status, measurement kind, basis, window, and sample |
| Measurement kind | The closed per-entry disclosure `native \| proxy \| curated-count` naming whether the figure is measured from machine records, recomputed under a proxy definition, or curated from committed prose |
| Basis | The named committed source a figure derives from (transition history, runner fold, pm-notes corpus, evidence corpus) |
| Baseline-consumed entry | A metric entry whose ID and definition come from the committed measurement baseline log, cited by `definitionRef` |
| Comparison view | The live, read-only evaluation applying the committed comparison protocol — same ID and definition, equal-length window, `sampleMinimum: 5`, closed verdict, caveat on cross-kind rows |
| Curated floor | An evidence-bound lower bound (unrecorded incidents invisible; only artifact-anchored incidents count) — the honesty form of the false-signal and escaped-defect counts |
| Escaped defect | A defect recorded in committed evidence after the delivering change's own gates reported green, in one of three closed classes, cited with artifact plus anchor |
| Evidence window | The inclusive `--from`/`--through` bounds (drawn: trailing 30 days) scoping the corpus and windowed metrics |
| Burn-rate alarm | The single derived alarm raised when measured spend over the declared window meets or exceeds the declared threshold; echoes ref, basis, threshold, measured, and window |
| Threshold declaration | The `metrics.burn-rate` node in the project-committed configuration document (`threshold`, `basis`, `window`); absent means undeclared |
| Crossing | The evaluated condition `measured ≥ threshold` over the declared window; exactly one alarm per crossing, deduplicated by determinism rather than state |
| Row-absent | The classified evidence state when the log carries no row for a vocabulary ID — absence declared, never zero |
| Classified absence | The per-section declaration that evidence is missing (telemetry-absent, threshold-undeclared, row-absent, `UNAVAILABLE`) instead of a zero figure |
| Right-censoring | The delivered cycle-time rule: absent completion uses the latest completed phase with the censoring flag set |

## 24. APPENDICES

### Appendix A — Planning truth sources

| Source | What it contributed |
|--------|---------------------|
| Ticket GH-299 (M2-S6) | Goal, the task list (ceremony share, per-dispatch tokens/cost/restarts, cycle time, CI failure rate, escaped defects, burn-rate alarms), the AC ("exit criteria measurable with committed numbers"), dependencies (M1-S19, M2-S3, M2-S14), delivery conventions |
| pm-notes `chg-GH-299-pm-notes.yaml` | clarify_scope decisions (quota exclusion; escaped-defects delegation to this spec), the planned surface, baseline interplay, doc impacts, mounting precedent, delivery conventions |
| `doc/planning/oss-tooling/backlog.md` (M2-S6 row) | Canonical scope and task list; the alarm+metric-layer ownership over the M1-S19 read side |
| `doc/planning/oss-tooling/milestones/m2/test-scenarios.md` | SC-M2-S6-01 and SC-M2-S6-02 with their exact assertions |
| `doc/planning/oss-tooling/milestones/m2/contracts.md` and `m2/commands/spend.md` | The telemetry/spend contract continuity and the ownership note (M2-S6 owns the alarm and metric layers) |
| `doc/planning/oss-tooling/milestones/m2/README.md` | Story-to-artifact row and scenario mapping |
| `doc/planning/oss-tooling/measurement-baseline.yaml` and `feature-measurement-baseline.md` | The four `MET-` rows, status semantics, `measurement_kind` values, closed exclusion reasons, source-traceability rule, comparison protocol, immutability, the `MET-` allocator |
| `doc/spec/features/feature-spend.md` | The delivered fold the dispatch block composes; breakdown-sums-equal-totals; telemetry-absent posture; bounds and truncation patterns |
| `doc/spec/features/feature-telemetry-v2.md` | The five attribution dimensions, reading bases, aggregate-only privacy |
| `doc/spec/features/feature-ceremony-runner.md` | The native measurement fold, the committed comparison builder, the no-recompute rule, the sample-minimum honesty |
| `doc/spec/features/feature-config-layer.md` | The project-committed declaration precedent (`verify.suite-map` node, `config.value.invalid` pre-read refusal, absent-means-undeclared) |
| `doc/spec/features/feature-result-contract.md`, `feature-cli-entrypoint.md`, `feature-state-layer.md` | Envelope, error table and count pins, family mounting, verified reads and classified damage |
| `doc/planning/oss-tooling/cli-command-registry.md` | The `metrics` registry row (audiences, M2-S6 delivery) and the Learn-family grouping |
| chg-GH-298-spec.md and chg-GH-287-spec.md | The spec shape, registration discipline, DoD table, and Appendix D enumeration pattern |

### Appendix B — Ticket AC decomposition

| Ticket AC | Spec decomposition |
|-----------|--------------------|
| AC: exit criteria measurable with committed numbers | F-1/F-2 (one invocation reports the exit metrics from committed sources), F-2 + AC-F2-1 (baseline-consumed entries by ID and definition with committed `definitionRef`), F-3 + AC-F3-1..3 (each figure carries basis, measurement kind, window, sample — nothing anecdotal), F-7 + AC-F7-1 (escaped defects grounded in committed evidence), F-4 + AC-F4-1 (trend claims gated by the committed protocol so comparisons stay reproducible), F-5 + AC-F5-1 (per-dispatch spend figures equal to the delivered fold), F-6 + AC-F6-1 (cost drift measurable against a declared threshold). The M2 exit metrics named in the ticket's task list are each covered by a declared entry with a committed basis |

### Appendix C — Scenario-seed mapping

| Seed | Declared surface path |
|------|----------------------|
| SC-M2-S6-01 (`spend.data.breakdowns.agentRole` and `.model` non-empty; token sums equal `spend.data.totals.tokens`; the metric layer reads the same numbers) | The spend half re-asserts the delivered contract — the seed's `breakdowns.agentRole`/`.model` map to the delivered `breakdowns.role`/`.model` arrays and `totals.tokens` to the delivered five-class total, whose sums-equal rule is delivered contract. The metrics half is `metrics.data.dispatch`: `perAgent` sums equal its totals and the role/model arrays are non-empty over the same selection (AC-F5-1); the test plan inherits this mapping for the fixture |
| SC-M2-S6-02 (`metrics.data.alarms` holds exactly one `burn-rate` entry for the ref, with the threshold echoed, and no second alarm for the same crossing) | `metrics.data.alarms[]` with `kind: "burn-rate"`, `ref` and `threshold` echoed (`basis`, `measured`, window, `crossedAt` beside them), `alarmEvaluation.status == "evaluated"`, and the repeat-evaluation identity cell proving no duplicate (AC-F6-1, AC-F6-5) |

### Appendix D — Error-table count-pinning sites (metrics registration)

The current delivered numbers are **146** `ERROR_TABLE` entries, **145** delivered (spend-exclusion) rows, **62** closed two-segment allowlist codes, **1** `metrics` domain row (this change), and **146** documented identities, with the sync-suite oracle at `BASELINE_ROWS.length + 112`. The metrics change adds exactly one row (**146 → 147** entries, **145 → 146** delivered, **62 → 63** allowlist, **1** `metrics` row, **146 → 147** documented, **+112 → +113**) and every site below moves in the same commit as the row, followed by a repo-wide no-leftover scan across the named files for the pre-change values **146**, **145**, **62**, and **+112** (the scan's legacy-token list gains them), with four-way agreement between the classifier, the sync check, its structural mirror, and the carrier:

| # | Site | Pin | Moves to |
|---|------|-----|----------|
| D-1 | `packages/core/src/contracts/error-table.ts` | The one new `metrics` row appended under a GH-299 comment declaring exact allowlist membership; `DOMAIN_KINDS` gains `metrics` | 1 new row (146 → 147 entries); kind inventory gains `metrics` |
| D-2 | `scripts/checks/error-table-sync.ts` | `RESERVED_TWO_SEGMENT_CODES` set gains exactly `metrics.baseline-unreadable` with the GH-299 comment | 62 → 63 members |
| D-3 | `tests/structure/error-table.test.ts` | The mirror `RESERVED_TWO_SEGMENT_CODES` set gains the same code | 62 → 63 members |
| D-4 | `tests/structure/error-table.test.ts` | `toHaveLength(146)` entry assertions (7 sites) | 147 |
| D-5 | `tests/structure/error-table.test.ts` | Delivered-row (spend-exclusion) assertions `toHaveLength(145)` (2 sites) | 146 |
| D-6 | `tests/structure/error-table.test.ts` | Allowlist-size assertions `toHaveLength(62)` (5 sites) and the allowlist test names pinning "62 members" (2 names) | 63 |
| D-7 | `tests/structure/error-table.test.ts` | The four-surfaces agreement test name "146 entries / 145 delivered / 62 allowlist / 2 board / 3 steer / 3 retro / 146 documented" | "147 entries / 146 delivered / 63 allowlist / 2 board / 3 steer / 3 retro / 1 metrics / 147 documented" |
| D-8 | `tests/structure/error-table.test.ts` | Carrier/doc text pins `toContain("146 machine identities")`, `toContain("the same 146 identities")`, `toContain("146 identities")`, and `toContain("exact two-segment allowlist of 62 declared identities")` (the four distinct pin sites across the suites) | 147 / 63 wording |
| D-9 | `tests/structure/error-table.test.ts` | The legacy-token list and no-leftover scan arms gain the pre-change values 146, 145, 62, and the +112 arithmetic string so the scan stays complete | extended token list |
| D-10 | `tests/structure/dispatch-attempts-taxonomy.test.ts` | Header comment "the registry holds 146 identities", test name "the registry holds exactly 146 identities and four dispatch rows", and `toHaveLength(146)` | 147 wording / 147 |
| D-11 | `tests/structure/verify-gates-suite-map-contract.test.ts` | `result.counts.sourceEntries` and `result.counts.documentedRows` at 146 (2 sites) | 147 |
| D-12 | `tests/checks/error-table-sync.test.ts` | The frozen-oracle arithmetic `BASELINE_ROWS.length + 112` at all four sites (length check, failure message, counts assertions) | +113 |
| D-13 | `doc/spec/features/feature-result-contract.md` | The documented-table paragraph: "146 machine identities" and "the same 146 identities", the kind inventory (gains `metrics` and its row), and the allowlist paragraph ("62 declared identities", gains the metrics code) | 147 wording, `metrics` row, 63 codes |

The plan enumerates the exact post-change text for each site; the test plan owns the near-miss rejection case (a two-segment `metrics.*` code outside the declared one is rejected) and the four-way agreement case. Any site discovered beyond this list during delivery joins the same commit and this appendix is amended — never silently.

## 25. DOCUMENT HISTORY

| Version | Date | Author | Changes |
|---------|------|--------|---------|
| 1.0 | 2026-11-16 | @spec-writer (GH-299, phase 2 specification) | Initial specification |

---

## AUTHORING GUIDELINES

- **Sources**: ticket GH-299 (canonical task list and AC), the GH-299 pm-notes (clarify_scope decisions, planned surface, baseline interplay, doc impacts), the canonical backlog M2-S6 row, the M2 test-scenario seeds and milestone pack, the measurement baseline log and its feature spec, and the delivered feature specs for spend, telemetry v2, ceremony runner, config layer, result contract, CLI entrypoint, and state layer. Nothing in this specification is invented beyond those sources plus the repo's delivered conventions; where the sources were silent (threshold home, native-vs-proxy disclosure, escaped-defects definition, alarm deduplication mechanics, absence posture, invocation shape), the choice is recorded as a DEC with rationale.
- **Template**: the repository template (`doc/templates/change-spec-template.md`) defines the structure; the sibling GH-298 specification defines the density and registration discipline expected by the DoR gate.
- **Scope discipline**: the two clarify_scope decisions (quota exclusion; escaped-defects definition work) are recorded explicitly (DEC-1, DEC-2) rather than silently; every other scope item traces to a ticket task, a scenario seed, a pm-notes note, or a delivered convention the family must follow. The delivered no-recompute rule for the ceremony comparison is honored explicitly (DEC-3, OQ-3).
- **Testability**: every AC is Given/When/Then, references at least one F-/DM-/NFR- ID, and names its verification path; the two scenario seeds map to declared payload paths (Appendix C), including the seed-to-delivered-key mapping, so the test plan inherits them literally.
- **Registration discipline**: the error-table change is declared exactly (one code, 62 → 63, every count pin enumerated in Appendix D) because the delivered checks assert exact set sizes; an undeclared widening would make the spec contradict the truth it cites (GH-298 Appendix D precedent, re-enumerated against the current delivered numbers).
- **Tech neutrality**: the specification declares contracts, vocabularies, bounds, and behaviour; it prescribes no algorithm, data structure, or module-internal design. Component names in §16 follow the repo's package layout convention for planning traceability, and Appendix D names registration sites because the delivered count-pin discipline requires the exact sites.

## VALIDATION CHECKLIST

- [x] `change.ref` matches provided `workItemRef` (GH-299)
- [x] `owners` has at least one entry
- [x] `status` is "Proposed"
- [x] `milestone` equals the pm-notes `milestone` verbatim ("M2: Ceremonies, measurement, and memory")
- [x] All sections present in order (1-25 + guidelines + checklist)
- [x] ID prefixes consistent and unique (F-, API- n/a, EVT- n/a, DM-, NFR-, AC-, DEC-, RSK-, OQ-)
- [x] Acceptance criteria reference at least one F-/DM-/NFR- ID and use Given/When/Then
- [x] NFRs include measurable values
- [x] Risks include Impact & Probability
- [x] No implementation details beyond the repo's high-level component and registration-site convention (§16, Appendix D)
- [x] No content duplicated from linked docs; composed surfaces cited, not restated
- [x] Front matter validates per front_matter_rules
