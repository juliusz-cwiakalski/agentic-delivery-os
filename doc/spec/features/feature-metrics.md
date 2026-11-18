---
ados_distribution: internal
id: SPEC-METRICS
status: Current
created: 2026-11-17
last_updated: 2026-11-17
owners: ["engineering"]
service: delivery-os
summary: "The delivery metrics and alarm family: the read-only `metrics [--ref <ref>] [--from <iso>] [--through <iso>] [--json]` report under `delivery.metrics.v1`, carrying the four vocabulary entries (native ceremony share from the runner fold, native cycle time from the transition history with right-censoring, the CI-failure-rate proxy recomputed under the committed definition, and the escaped-defects curated floor with its closed three-class set), the per-dispatch tokens/cost/restarts block composed from the delivered spend fold with the attributable-scoped roll-up disclosure, the burn-rate alarm evaluated against the project-committed `metrics.burn-rate` declaration node (schema `delivery.metrics.burn-rate.v1`, one alarm per crossing, `crossedAt` the read instant), the live comparison view under the committed protocol (`sampleMinimum: 5`, `insufficient-sample` below it, the proxy-vs-native caveat exactly on cross-kind rows), the per-section classified-absence posture with the single `metrics.baseline-unreadable` platform row, the deterministic bounded machine and human output with tail-ordered counted drops and a never-dropped alarm set, and the mount as the twenty-fourth prompt-required family."
links:
  related_changes: ["GH-299"]
  related_decisions: ["ODR-0002", "ADR-0003"]
  contracts:
    - "packages/core/src/contracts/metrics.ts"
    - "packages/core/src/contracts/spend.ts"
    - "packages/core/src/contracts/telemetry.ts"
    - "packages/core/src/contracts/error-table.ts"
    - "packages/core/src/config/catalog.ts"
---

# Feature: Metrics Report and Burn-Rate Alarms

## Overview

The metrics family is the Learn-family `metrics` command. Its surface is exactly `<binary> metrics [--ref <ref>] [--from <iso>] [--through <iso>] [--json]`: one read-only report per invocation, with no subcommands. The report folds the committed measurement baseline log, the delivered telemetry record families, the ref's `phase.transition` history, ceremony run records, the bounded committed corpus scan, and the project-committed `metrics.burn-rate` declaration node into the `delivery.metrics.v1` payload. It answers the delivery exit metrics from committed sources and raises a classified alarm when measured spend crosses a declared threshold; it authors nothing and writes no byte to any store, log, or document.

The success payload is the standard `CommandResult` envelope whose `data` carries exactly nine keys — `ref`, `window`, `metrics[]`, `dispatch`, `alarms[]`, `alarmEvaluation`, `comparisons[]`, `omitted`, and `truncated`. The schema identity `delivery.metrics.v1` is a declared contract constant, not a `data` key. `--ref` follows the spend grammar: omitted resolves the active change ref from the local delivery context without touching the state store; a malformed or unresolvable ref is refused `input.value.rejected` before any read. `--from` and `--through` are inclusive ISO-8601 bounds that are jointly required or jointly omitted; an omitted pair draws the trailing 30 days ending at the injected clock's read instant, and the effective window is disclosed in `window` and on every comparison row's `after` side.

Absence is a classified per-section outcome, never a zero figure: telemetry absence is declared on the dispatch block and the alarm evaluation, an undeclared threshold is declared on the evaluation, a missing log row is declared on its entry, an evidence-empty window is declared `UNAVAILABLE`, and a log that exists but cannot be parsed or validated is the one `metrics.baseline-unreadable` refusal at exit `2`. Store damage keeps the delivered `state.*` identities and their own projections.

The family is the twenty-fourth prompt-required command family. Its reference page is `doc/planning/oss-tooling/milestones/m2/commands/metrics.md`.

## Business Context

### Problem Statement

- **Problem:** The M2 exit metrics are not answerable from the delivered surfaces without a dedicated read side: the committed baseline log holds bash-era numbers, the spend read side reports delivery economics, and the ceremony runner records native durations, but no surface turns those building blocks into the four exit metrics, and nothing evaluates a spend threshold. Each claim would have to be re-derived by hand from scattered committed artifacts, and overspend would be discovered after the fact. "Escaped defects" carries no operational definition and no `MET-` row, so it cannot be counted without one; the baseline's proxy numbers and the available native measurements can be silently conflated; and per-dispatch spend visibility is split across the spend report and ceremony records.
- **Affected Users:** The coordinator and operator reading delivery metrics, lifecycle agents consuming the report, and owners who declare a spend threshold as project policy.
- **Business Impact:** With one read-only report, the ticket's acceptance condition — "exit criteria measurable with committed numbers" — is satisfied without a second measurement plane, and cost drift raises a classified, echoed alarm instead of an anecdote.

### Goals

- Report the three baseline-consumed metric entries by metric ID and committed definition, plus the escaped-defects curated count, each figure carrying its basis, measurement kind, unit, direction, and sample size within the report's disclosed evidence window.
- Report the per-dispatch spend block (tokens by class, cost totals, restarts, per-agent roll-ups, role/model breakdowns) as the delivered spend fold's own figures for the same selection.
- Evaluate the project-declared burn-rate threshold over its declared trailing window and raise exactly one alarm per crossing.
- Render the live comparison view under the committed comparison protocol, so no trend claim rests on a below-minimum sample or on a cross-kind comparison without its caveat.
- Classify absence per section and keep damaged canonical data distinct from absence.
- Stay deterministic, bounded, local-only, brand-neutral, and read-only, with no LLM call, no network request, and no event, scheduler, or notification channel.

## User Experience & Functionality

### Command surface

The command definition owns the grammar; the runtime owns value validation and every read. `--json` is the global machine-output switch and adds no metrics behaviour. The family declares exactly one report invocation and no verbs.

| Invocation | Behavior |
|---|---|
| `metrics [--ref <ref>] [--from <iso>] [--through <iso>] [--json]` | Produces one report. |
| `--ref` omitted | Resolves the active change ref from the local delivery context; no state-store read is needed to resolve it. |
| `--ref` with an unresolvable active context | Refuses `input.value.rejected` (exit 1) before any read. |
| `--ref <ref>` | Matches the canonical uppercase ref grammar (`^[A-Z][A-Z0-9]*-[0-9]+$`), case-sensitive with no folding; a malformed shape refuses `input.value.rejected` before any read. |
| `--from <iso>` / `--through <iso>` | Inclusive ISO-8601 evidence-window bounds (a date-time with seconds and an explicit zone). Both are required together or omitted together; a lone bound, a malformed instant, a date-only value, a zone-less value, or a reversed range refuses `input.value.rejected` before any read. |
| Both bounds omitted | The report draws the trailing 30 days ending at the injected clock's read instant. |
| Missing flag value | Refuses `input.value.rejected` (exit 1). |
| Unknown flag, unexpected positional, or any declared verb (`metrics history`, `metrics report`, `metrics list`) | Refuses through the shared parser as `fallback.invocation` (exit 1) before any read. |
| `--json` | Forces the standard envelope; the handler never inspects it. |
| `--help` / `--version` | Served by the entrypoint's self-description surfaces, not by a command-local flag; neither reads state, configuration, or the network. |

Registration is composition-only and unconditional: the production composition supplies the metrics runtime, so the family is present in the composed program and in root `--help`.

### Examples

A report with consumed and curated entries, present telemetry, a declared threshold below the measured spend, and the comparison view (human digest; timings and figures are illustrative over a fixture):

```
$ <binary> metrics --ref GH-299
<binary> metrics — delivery metrics
ref GH-299
window 2026-10-18T00:00:00.000Z .. 2026-11-17T00:00:00.000Z (inclusive)
Metrics:
  MET-CEREMONY-SHARE  native  PARTIAL  value=0.031 unit=ratio sample.n=6 runs=6 steps=14 phases=14 direction=lower is better basis=ceremony-runner-fold
  MET-CYCLE-TIME  native  PARTIAL  value=4.6 unit=hours sample.n=1 censored=0 direction=lower is better basis=phase-transition-history
  MET-CI-FAILURE-RATE  proxy  PARTIAL  value=0.5 unit=ratio sample.n=8 observed=8 unobserved=0 direction=lower is better basis=committed-pm-notes-corpus
  escaped-defects  curated-count  MEASURED  value=1 unit=count sample.n=1 postGateReview=1 landedCiFailure=0 retroAttributed=0 excludedNonEvidence=0 direction=lower is better basis=committed-evidence-corpus
    incident post-gate-review doc/changes/2026-11/2026-11-12--GH-290--x/chg-GH-290-pm-notes.yaml#review-round-2 observedAt=2026-11-13T09:20:00Z
Dispatch: telemetry present tokens=185 cost=0.42 restarts=0 perAgent=1
  reconciliation basis=combined verdict=within
  agent coder/opus: 3 calls, 153 tokens
Alarm evaluation: evaluated threshold=0.4 basis=cost window=2026-11-16T10:00:00.000Z..2026-11-17T10:00:00.000Z
Alarm: burn-rate ref=GH-299 basis=cost threshold=0.4 measured=0.42 window=2026-11-16T10:00:00.000Z..2026-11-17T10:00:00.000Z crossedAt=2026-11-17T10:00:00.000Z sparse=false
Comparisons:
  MET-CEREMONY-SHARE before=0.406648 after=0.031 verdict=improved sampleMinimum=5 sampleSize=6 [caveat: Proxy vs native: the before value is the committed pm-notes proxy basis and the after value is measured from the native source; the two bases are not interchangeable and no trend is claimed across them.]
  MET-CYCLE-TIME before=5.3 after=4.6 verdict=insufficient-sample sampleMinimum=5 sampleSize=1 [caveat: Proxy vs native: the before value is the committed pm-notes proxy basis and the after value is measured from the native source; the two bases are not interchangeable and no trend is claimed across them.]
  MET-CI-FAILURE-RATE before=0.75 after=0.5 verdict=improved sampleMinimum=5 sampleSize=8
omitted=0 truncated=false
```

A checkout that declares no threshold (machine envelope excerpt):

```
$ <binary> metrics --ref GH-299 --json
{"schemaVersion":"delivery.result.v1","runId":"run-01J8ZR8M6T","exitCode":0,"timing":{"totalMs":18},"data":{"ref":"GH-299","window":{"from":"2026-10-18T00:00:00.000Z","through":"2026-11-17T00:00:00.000Z"},"metrics":[...],"dispatch":{"telemetryState":"absent","absenceReason":"spend.telemetry-absent"},"alarms":[],"alarmEvaluation":{"kind":"burn-rate","status":"threshold-undeclared"},"comparisons":[...],"omitted":0,"truncated":false}}
```

A baseline log that exists but cannot be parsed (machine envelope):

```
$ <binary> metrics --ref GH-299 --json
{"schemaVersion":"delivery.result.v1","runId":"run-01J8ZR8M6T","exitCode":2,"timing":{"totalMs":9},"error":{"code":"metrics.baseline-unreadable","category":"platform","retryable":false,"consequence":"not_landed","remediationHint":"Restore the committed measurement baseline log to a parseable, schema-valid document or remove it entirely; damaged canonical data is never treated as absence, and no report was produced.","summary":"metrics: the committed measurement baseline log exists but cannot be parsed or validated"}}
```

### The report payload

`data` carries exactly nine keys:

```
metrics.data = {
  ref, window: { from, through },
  metrics: [{ id, value?, status, measurementKind, basis, unit, direction,
              sample, definitionRef?, excluded[]?, limitation, caveat?,
              incidents[]? }],
  dispatch: { telemetryState, tokensByClass?, costTotals?, restarts?,
              perAgent[]?, breakdowns?, reconciliation?, unattributable?,
              absenceReason? },
  alarms: [{ kind: "burn-rate", ref, basis, threshold, measured,
             window: { start, end }, crossedAt, sparse? }],
  alarmEvaluation: { kind: "burn-rate", status, threshold?, basis?, window? },
  comparisons: [{ metricId, definitionRef, before, after, sampleMinimum,
                  verdict, caveat? }],
  omitted, truncated
}
```

`metrics[]` orders by the closed vocabulary order — `MET-CEREMONY-SHARE`, `MET-CYCLE-TIME`, `MET-CI-FAILURE-RATE`, `escaped-defects` — and carries one entry per member on every path, including row-absent and all-absent reports. `comparisons[]` orders by the same vocabulary restricted to the members that carry a committed log row. No ordering is influenced by store, log, or filesystem return order.

The closed vocabularies are declared once as contract data: metric IDs, the baseline-consumed subset, alarm kinds (`burn-rate`), measurement kinds (`native | proxy | curated-count`), statuses (`MEASURED | PARTIAL | UNAVAILABLE`), comparison verdicts (`improved | regressed | flat | not-established | insufficient-sample`), evaluation states (`evaluated | threshold-undeclared | telemetry-absent`), escaped-defect classes, basis names (`phase-transition-history | ceremony-runner-fold | committed-pm-notes-corpus | committed-evidence-corpus`), and the log's exclusion reasons (`unparseable_yaml`, `date_only_or_missing_time`, `placeholder_zero_time`, `capture_change`, `outside_window`, `missing_metric_input`, `no_ci_observation`).

### Metric entries: basis and measurement kind

Every baseline-consumed entry cites the committed definition by `definitionRef` (the log path plus the metric row's committed `source_commit`), reuses the log's status semantics, and states its limitation. The log lists its exclusions one row per excluded change as `{ref, reason}` (a legacy `{reason, count}` counter row is tolerated); the report parses and validates that listing and leaves the log byte-identical, while an entry's `excluded[]` reports its own evaluated basis's exclusions — per ref and per window — counted over the log's closed reason vocabulary, never the log's aggregate totals; no zero count surfaces. A measured value keeps the committed row's status — a `PARTIAL` row stays `PARTIAL` — except that a row committed as `UNAVAILABLE` whose native source yields a value reads `MEASURED`; a right-censored cycle time reads `PARTIAL`, and an entry with no measurable value reads `UNAVAILABLE`. The entry's value is scoped by its own declared basis: a committed-basis entry recomputes its figure under the committed definition and never restates the log's committed value, while a native-basis entry computes its figure from its declared native source and is never presented as the committed definition's value.

| Entry | Measurement kind | Basis | Native or committed source |
|---|---|---|---|
| `MET-CEREMONY-SHARE` | `native` | `ceremony-runner-fold` | Ceremony run/step records of the window; runner-derived run, step, and phase counts |
| `MET-CYCLE-TIME` | `native` | `phase-transition-history` | The ref's `phase.transition` history under the committed interval |
| `MET-CI-FAILURE-RATE` | `proxy` | `committed-pm-notes-corpus` | The bounded committed corpus scan, recomputed under the committed definition |
| `escaped-defects` | `curated-count` | `committed-evidence-corpus` | The bounded committed corpus scan; no `definitionRef` |

The log's fourth row, `MET-FALSE-SIGNAL-INCIDENTS`, is canonical data the report does not surface.

### Cycle time (native)

The cycle-time value is the committed interval — from the `clarify_scope` start transition to the `pr_creation` completion transition — measured in hours (rounded to one decimal) from the ref's transition history.

- No `clarify_scope` start, or a start outside the evidence window, makes the entry `UNAVAILABLE` with `missing_metric_input` or `outside_window` counted; no figure is synthesized.
- A missing completion right-censors the interval: the value anchors to the latest completed phase, the sample carries `censored=1`, the status is `PARTIAL`, and the limitation names the anchoring phase. The value is a lower bound, never a projection to the read instant.
- A censored interval with no completed phase to anchor it is `UNAVAILABLE` with `missing_metric_input` counted.

### Ceremony share (native)

The ceremony-share value is measured ceremony run time over the window's elapsed time: the summed per-run span (earliest step start to latest step end) divided by the window length, with a floor of one millisecond on the denominator. The sample carries `n` (runs in the window) and the runner-derived `runs`, `steps`, and `phases` counts.

Runs whose first step falls outside the window are excluded with `outside_window` counted. A window with no ceremony run is `UNAVAILABLE` with `sample.n = 0` named and no value reported. The limitation states that the native figure is not the committed pm-notes duration-ratio proxy and is not interchangeable with it.

### CI failure rate (proxy)

The CI-failure-rate value is recomputed under the committed baseline definition over the bounded committed corpus scan: the numerator counts observations whose outcome is `red` or `mixed`, the denominator counts observed rows inside the window. The measurement kind stays `proxy` and the limitation keeps the committed session-proxy statement; no per-run rate is claimed.

Rows are excluded with a reason rather than dropped: `no_ci_observation` for a delivery with no recorded observation (never assumed green), `date_only_or_missing_time` for an observation without an instant, `unparseable_yaml` for an unparseable instant, and `outside_window` for an observation outside the evidence window. The sample carries `observed` and `unobserved`. No observed row in the window makes the entry `UNAVAILABLE` with the counted exclusions and no rate.

### Escaped defects (curated floor)

The `escaped-defects` entry counts defects recorded in committed evidence in one of three closed classes:

| Class | Meaning |
|---|---|
| `post-gate-review` | A review-verdict artifact records a defect found after the delivering change's own gates reported green |
| `landed-ci-failure` | A committed CI observation records a red or mixed outcome on the pushed or landed head |
| `retro-attributed` | A committed retro finding attributes a defect to the landed change |

A counted incident cites a committed artifact path plus anchor, its class, and its observation instant. An evidence row is admitted only when its class is declared, its path is committed (never `tmp/**`, `.ai/local/**`, absolute, external, or carrying a `..` traversal segment), its anchor is non-empty and resolves in the cited artifact, its observation falls inside the evidence window, and its `ref` matches the evaluated ref when declared. Everything else is counted in `excludedNonEvidence` rather than silently dropped.

The entry's value is the counted total, the sample carries `postGateReview`, `landedCiFailure`, `retroAttributed`, and `excludedNonEvidence`, `incidents[]` lists the counted rows (capped, tail-dropped, and counted when dropped), and the limitation states the floor caveat verbatim: unrecorded incidents are invisible and only artifact-anchored incidents in committed evidence count. A window with no admitted incident is `UNAVAILABLE` — never a zero count presented as a measurement.

### Dispatch block (spend parity)

The `dispatch` block carries the delivered spend fold's figures for the same selection, computed over the same verified read: `tokensByClass` (the five delivered classes), `costTotals` (total and per-model in harness-reported units with `sparse`), `restarts`, `perAgent[]` (role, model, calls, tokens), the role and model `breakdowns`, and the delivered reconciliation disclosure cited by reference (`basis` and `verdict` names only, never recomputed). When telemetry is present the block's figures equal `spend --ref` for the same selection; when it is absent the block names the delivered condition (`spend.telemetry-absent`) in `absenceReason` and renders no figures.

The delivered roll-up discipline is consumed unchanged. `perAgent` skips records whose role or model is `null`, while the breakdowns keep the `null` value row so their token sums equal the full total on every selection. When unattributable steps exist, the block discloses the gap in `unattributable` (`steps`, `tokens`) and invents no row; over a fully attributable selection the `perAgent` sum equals its totals exactly.

### Burn-rate alarms

The threshold is project policy declared in the project-committed configuration document as `metrics.burn-rate` (schema `delivery.metrics.burn-rate.v1`) with exactly `threshold` (a positive number), `basis` (`cost | tokens`), and `window` (`<positive-integer>d`, 1..90).

The node is read as one bounded project-committed document read — no system, user-global, project-local, environment, or CLI source and never the merged layer tree — and its semantics are validated before any telemetry, log, ceremony, transition, or corpus read. An absent node is undeclared, not a defect. Every defect (a non-mapping node, a missing or non-positive threshold, an unknown basis, a non-conforming or out-of-range window) is refused `config.value.invalid` at exit 1; no default threshold is invented.

The evaluation window is the declared trailing span ending at the injected clock's read instant. Measured spend composes the union of both telemetry capture planes — the per-step records and the closeout session records — reduces it through the spend fold's per-session plane selection (one session contributes its step rows when it has any, otherwise its closeout records), and then windows the selected rows by capture instant. A closeout-only session beside stream steps therefore stays counted, and the measured figure agrees with the spend fold's selection over the same window. The delivered ingest rules apply unchanged: a null token class is excluded from the sum, and cost is summed from harness-reported values, never re-priced.

- `measured ≥ threshold` raises exactly one `burn-rate` alarm echoing `ref`, `basis`, `threshold`, `measured`, the window bounds, `crossedAt` (the read instant, identical to the window's `end`), and `sparse` on the cost basis. `alarmEvaluation` is `evaluated` with the declaration echoed.
- `measured < threshold` raises no alarm and still reports `evaluated` with the declaration echoed: the absence of an alarm is declared, not silent.
- Absent telemetry classifies `telemetry-absent`; an undeclared node classifies `threshold-undeclared`. Both raise no alarm and echo no threshold.

The alarm set is a derived view with at most one entry per evaluation. No persisted alarm state exists, duplicate alarms are impossible by construction, and a repeat evaluation over unchanged facts is byte-identical. Alarms are evidence, not gates: no gate blocks on an alarm, and the family declares no notification channel, event topic, subscription, scheduler, daemon, timer, or push path.

### The comparison view

`comparisons[]` is a live, read-only evaluation under the committed comparison protocol. Each row carries the committed `metricId` and `definitionRef`, the log's `before` value with its window, basis, measurement kind, and status, the freshly measured `after` value with its window, measurement kind, status, and sample size, `sampleMinimum: 5`, and a verdict.

- `improved`, `regressed`, and `flat` require the after-sample to meet the minimum of 5 and a comparable before value. The direction comes from the committed row (`lower is better` unless declared otherwise).
- Below the minimum, or with no measurable after value, the verdict is `insufficient-sample` or `not-established`; no row and no derived surface claims a trend. The cycle-time after-sample is one interval per invocation, so its verdict is `insufficient-sample` while the entry itself still reports a measured value.
- The proxy-vs-native caveat is present in the row and in the owning metric entry exactly when the before and after measurement kinds differ, and absent on same-kind rows. The committed log's measurement kinds are all proxies, so the caveat rides the native ceremony-share and cycle-time rows and not the proxy-to-proxy CI-failure-rate row.
- Rows render their windows verbatim. The view never refuses on window-length grounds: the protocol's equal-length rule governs the owner's comparison claims, not a command refusal.
- The view never writes the log and never restates a committed `comparisons[]` record as its own output. Those records remain authored per delivery through the ceremony comparison builder.

### Classified absence and damage

No section renders a zero for absent evidence, and the report never refuses for absent evidence:

| Condition | Report surface |
|---|---|
| No telemetry records for the ref | `dispatch.telemetryState: absent` with `absenceReason`; no dispatch figures; `alarmEvaluation: telemetry-absent` |
| No `metrics.burn-rate` node | `alarmEvaluation: threshold-undeclared`; no alarm; no default threshold |
| The log carries no row for a vocabulary ID | That entry is `UNAVAILABLE` with no value and no invented `definitionRef` |
| A log row with no measurable input | That entry is `UNAVAILABLE` with its counted exclusion reasons and its limitation |
| No ceremony run in the window | `MET-CEREMONY-SHARE` is `UNAVAILABLE` with `sample.n = 0` |
| No admitted committed evidence | `escaped-defects` is `UNAVAILABLE`, never `0` |
| The log exists but cannot be parsed or validated | `metrics.baseline-unreadable` at exit 2; no partial report |
| A telemetry, ceremony, transition, or audit store is damaged | The delivered `state.*` identity with its own projection; never re-projected as absence |

### Output contract and bounds

The machine payload is the standard envelope whose `data` is the nine-key `delivery.metrics.v1` report. The human digest is a deterministic, bounded rendering of the same data: a header (`<binary> metrics — delivery metrics`, ref, window), one line per metric entry with its detail lines (caveat, incidents), the dispatch block with per-agent lines, the alarm evaluation and alarm lines, the comparison rows, and the omission trailer.

| Bound | Value |
|---|---|
| Machine `data` | ≤ 65 536 UTF-8 bytes |
| Human digest | ≤ 200 lines and ≤ 16 384 UTF-8 bytes |
| `incidents[]` rows | ≤ 8 |
| `perAgent[]` rows | ≤ 20 |
| `comparisons[]` rows | ≤ 20 |
| Evidence window | Inclusive ISO-8601 bounds; drawn default 30 trailing days |
| Threshold window | 1..90 days |

Row caps apply first, then the machine byte cap. When the machine cap binds, rows drop tail-first in the fixed order `comparisons[]` → `incidents[]` → `perAgent[]`; every machine drop increments `omitted` and sets `truncated`. The human digest applies its own line and byte bounds to the bounded report: when they still bind, it drops the same three sections in the same tail-first order, sets its trailer's `truncated`, and appends a marker naming each section it dropped with that section's row count. `ref`, `window`, the metric entries with their caveat lines, the dispatch summary, `alarms[]`, and `alarmEvaluation` are never dropped; only comparison rows, incident detail rows, and per-agent lines shed.

### Error identity and exits

One domain kind, `metrics`, carries exactly one row: `metrics.baseline-unreadable` (category `platform`, non-retryable, consequence `not_landed`, projection `platform-provider` → exit 2), raised when the committed baseline log exists but cannot be parsed or validated. Every other failure reuses a delivered identity.

| Condition | Identity | Exit |
|---|---|---|
| Report produced, including classified absences, an undeclared threshold, and an all-absent evidence picture | — | 0 |
| Malformed or unresolvable ref, lone or malformed window bound, reversed range, missing flag value | `input.value.rejected` | 1 |
| Unknown flag, unexpected positional, any declared verb | `fallback.invocation` | 1 |
| Defective `metrics.burn-rate` node, or an unusable selected configuration document | `config.value.invalid` | 1 |
| Committed baseline log present but unparsable or invalid | `metrics.baseline-unreadable` | 2 |
| Telemetry, ceremony, transition, or audit store damage | the delivered `state.*` row | 1 or 2 per row |
| Unclassifiable handler failure, or a kind-only `metrics` discriminant | `fallback.internal` | 2 |

The identity resolves by exact code only and joins the closed two-segment allowlist by exact declaration: the table holds 152 entries, 151 delivered rows, and 67 allowlisted two-segment codes, with the sync-suite arithmetic at `BASELINE_ROWS.length + 118` and four-way agreement between the classifier, the sync check, its structural mirror, and the documented carrier. No `metrics.*` family or pattern widening exists.

### Mounting

`metrics` is the twenty-fourth prompt-required command family, appended after `steer` and before GH-295's `supervise` in `PROMPT_REQUIRED_COMMANDS`. The production composition supplies its runtime unconditionally — the read-only state store, the local PM context, the project root and its configuration directory, the injected clock, and the file facts — so the family appears in root `--help`, answers `metrics --help` at exit 0, and serves its M2 reference page through the per-command page-root mapping. The help-coverage inventory carries the metrics row and reference page. The family-count pins read 24 and no stale 23 remains, and mounting changes no other command's composition.

## Technical Architecture & Codebase Map

### Core components

| Path | Component | Responsibility |
|---|---|---|
| `packages/core/src/contracts/metrics.ts` | Metrics vocabulary | The `delivery.metrics.v1` constant, the nine data keys, every closed vocabulary (metric IDs, measurement kinds, statuses, verdicts, evaluation states, escaped-defect classes, bases, exclusion reasons), the bounds and truncation targets, the sample minimum, the drawn window length, the declaration-node schema/key/bases/window bounds, the proxy-vs-native and floor caveats, the one error code, and the report/read/seam/runtime types. Types and `as const` data only. |
| `packages/core/src/domain/metrics.ts` | Pure fold | Window resolution and drawing from the injected clock, the four entry builders (native cycle time with right-censoring, native ceremony share, proxy CI rate, curated escaped defects), the dispatch projection with the unattributable disclosure, the pure burn-rate resolver, the alarm evaluation, the comparison view with the caveat rule, ingress classification, and the bounding stage. Zero I/O, clock, or randomness. |
| `packages/core/src/domain/metrics-text.ts` | Human renderer | The bounded deterministic digest: entry lines with sample and exclusion counters, caveat and incident detail lines, the dispatch block, alarm lines, comparison rows, and the omission trailer. |
| `packages/core/src/state/metrics-reads.ts` | Read consumer | One classified, verified, ref-scoped read composing the delivered telemetry record families, the ref's transition history, and the ceremony run/step records over the injected state port; no append, fence, salvage, harness, session, or provider access. |
| `packages/adapters/src/file/metrics-baseline.ts` | Baseline-log read | The one bounded read and structural validation of the committed measurement baseline log, classified `absent | present | unreadable | unparseable | invalid`. |
| `packages/adapters/src/file/metrics-config.ts` | Declaration-node read | The one bounded project-committed document read extracting `metrics["burn-rate"]`; classifies the document, interprets no semantics. |
| `packages/adapters/src/file/metrics-corpus.ts` | Corpus scan | The bounded committed-corpus walk (512 files, depth 6, `.yaml`/`.yml` only under the change directory) collecting `metrics_corpus` rows and resolving each evidence citation against a readable committed artifact. |
| `packages/cli/src/commands/metrics.ts` | Command definition | The locked flag set, the pre-read value grammar, ref resolution, the human render hook, and the failure hook. No stream write and no exit choice. |
| `packages/cli/src/edge.ts` | CLI edge | `createMetricsRuntimeFromSeams` (window → node → state → baseline → corpus → fold) and `createMetricsCommandRuntime` wiring the store, local context, configuration directory, clock, and file facts; the production composition registers the family unconditionally. |
| `packages/core/src/config/catalog.ts` | Configuration catalog | The additive metrics branch declaring `metrics.burn-rate` with its three members; whole-document validity only, never the node's semantic validator. |
| `packages/core/src/contracts/error-table.ts` | Error table | The `metrics` domain kind and its one `metrics.baseline-unreadable` row, exact-code-only. |

### Key functions

```ts
function resolveMetricsWindow(input: { from?: string; through?: string; nowMs: number }): MetricsWindowOutcome;
function computeMetricsReport(input: MetricsFoldInput): MetricsReport;
function resolveMetricsBurnRate(node: unknown): MetricsBurnRateNodeRead;
function boundMetricsReport(report: MetricsReport): { report: MetricsReport } & TruncationState;
function renderMetricsHuman(report: MetricsReport, brand: BrandIdentity): string;
function readMetricsLedger(store: StateStorePort, workItemRef: string): StateResult<MetricsLedgerComposition>;
function readMetricsBaselineLog(input: MetricsBaselineReadInput): MetricsBaselineLogRead;
function readMetricsBurnRateNode(input: FileAcquisitionInput): MetricsConfigNodeRead;
function scanMetricsCorpus(input: MetricsCorpusReadInput): MetricsCorpusRead;
function createMetricsRuntimeFromSeams(options: MetricsRuntimeOptions): MetricsCommandRuntime;
function createMetricsCommandRuntime(options: MetricsCompositionOptions): MetricsCommandRuntime;
function createMetricsCommandDefinition(runtime: MetricsCommandRuntime): CommandDefinition;
```

### Data architecture

- **One fixed read order.** The edge resolves the evidence window from the injected clock, then reads and validates the declaration node, then the verified state read, then the baseline log, then the bounded corpus scan, and finally folds. Each source is read at most once, and no read count scales with the record population: the verified state read covers the telemetry families, the transition history, and the ceremony records in one classified pass, and each document source is one bounded read.
- **Committed sources only.** The report's inputs are the state store, the committed measurement baseline log at `doc/planning/oss-tooling/measurement-baseline.yaml`, the project-committed configuration document, and committed change documents under the change directory that declare a `metrics_corpus` block. A corpus document contributes `ci_observations` rows (`ref`, `path`, `observed`, `outcome`, `observed_at`) and `evidence` rows (`path`, `anchor`, `class`, `observed_at`, `ref`); an unreadable directory or document contributes no rows and is never a failure.
- **Untrusted content.** Corpus documents and log rows are data. No document content can direct the scan, widen the citation rule, or count itself; a citation that does not resolve in a readable committed artifact is excluded rather than counted.
- **Corpus adoption.** A `metrics_corpus` block is an opt-in evidence-authoring convention for the change directory. The block declares `ci_observations` (`ref`, `path`, `observed`, `outcome`, `observed_at`) and `evidence` (`path`, `anchor`, `class`, `observed_at`, `ref`); `path` must be a committed relative path with no traversal segment, and an evidence citation must resolve to an anchor present in that committed artifact. Authors add the block to a committed change document (for example the change's `chg-<ref>-pm-notes.yaml`) together with the cited artifact. Until a committed document opts in, the CI proxy and escaped-defects entries are `UNAVAILABLE` on that tree — never zero. The baseline log's per-change spine rows are not a substitute: they carry no per-observation timestamp, so they cannot be windowed under the report's inclusive evidence window.
- **Absence tolerance.** An absent store or an absent per-ref record family is explicit verified-empty evidence, not an error. An absent log classifies the baseline-consumed entries row-absent while the rest of the report renders; an absent node classifies the evaluation undeclared.
- **Evidence.** The read carries record counts and paths for diagnostics only; output carries aggregates, identity references, cited artifact paths plus anchors, and time windows.

### API and interface contracts

- `MetricsCommandRuntime` exposes `resolveActiveRef()` and `report(request)`; the command definition consumes it and returns `data` or a classified error.
- `MetricsCommandFailure` is the one `metrics` code, `input.value.rejected`, `config.value.invalid`, or a delivered `state.*` code with `not_landed` and a safe location.
- `MetricsReadSeams` is the injected read surface: `readState(ref)`, `readBaselineLog()`, `readConfigNode()`, and `readCorpus()`. The runtime resolves the window and the declaration before invoking any of them for state, log, or corpus.

### Invariants and gates

- **Read-only by construction.** No append, fence, salvage, spawn, network, credential, tracker, or provider call is reachable on any invocation path; byte-snapshot tests prove every read source unchanged, including the committed log across repeated invocations.
- **Deterministic render.** Identical facts, injected clock, and injected run id render byte-identical human text and `data`, including shuffled record and corpus permutations. Every array follows its declared order.
- **Absence is classified, never zeroed.** Disabling mutants over the pure domain each produce their prohibited observable while the real modules produce none: restating the committed baseline value, dropping the cross-kind caveat, over-applying it to a same-kind row, claiming a trend below the minimum, duplicating an alarm, reporting an invented evaluation state, counting an unobserved row as green, zero-filling escaped defects, counting an uncited incident, and dropping the alarm set under a cap.
- **Deterministic drops.** Row caps and the byte cap drop tail-first in the declared order with every drop counted, and a shuffled-appended input renders byte-identical output.
- **Declaration before reads.** A defective node is refused before any telemetry, log, ceremony, transition, or corpus read, so a hostile declaration cannot steer a half-completed evaluation.
- **Alarm honesty.** An alarm can only exist with a declared threshold and measured evidence over the declared window; there is no default threshold, no synthesized crossing, and no persisted alarm state.
- **Exact-code registration.** The one `metrics` row resolves by exact code only; a near-miss `metrics.*` two-segment code is rejected rather than accepted by family matching.
- **Composition-only registration.** The command registry carries a metrics entry only when the metrics composition supplies it, and the production composition always supplies it.

## Security and Boundaries

- **Read-only access.** The family acquires no fence and writes nothing: no baseline value, no configuration document, no ceremony record, no evidence artifact, no state byte.
- **Committed-source discipline.** Every reported figure cites a committed source under the baseline's source-traceability rule. The corpus and evidence scans read committed repository documents only; `tmp/**`, `.ai/local/**`, uncommitted, absolute, and external sources are never a measurement.
- **Declaration validation before reads.** A malformed `metrics.burn-rate` node is refused `config.value.invalid` before any read, and no default threshold can be inferred from absence.
- **Bounded hostile input.** Ref shape, ISO bounds, the declaration node, and every corpus row are validated before use; undeclared flags are rejected by the shared parser.
- **No secret echo.** The family resolves no credential, and error summaries name conditions rather than quoting the documents they read.
- **Privacy.** Output carries aggregate figures, refs, metric IDs, agent/model names, window bounds, and cited committed paths with anchors only. It never carries prompt text, message bodies, transcripts, diffs, tool output, or credential material; the serialization redaction chokepoint composes unchanged.
- **Brand neutrality.** The human surface uses the injected brand binary name; no product or binary literal is committed.
- **Untrusted-input posture.** Committed documents and log rows are data, not instructions; the report renders findings for the owner's judgement.

## Non-Functional Requirements

| Concern | Current guarantee |
|---|---|
| Bounded output | Machine `data` ≤ 65 536 UTF-8 bytes; human digest ≤ 200 lines and ≤ 16 384 UTF-8 bytes; row caps 8 incidents, 20 per-agent rows, 20 comparison rows; deterministic tail-ordered drops (`comparisons[]` → `incidents[]` → `perAgent[]`) with every machine drop counted in `omitted` and the human fallback naming the sections it dropped; `ref`, the window, the metric entries, the dispatch summary, the alarms, and the evaluation are never dropped. |
| Determinism | Byte-identical human text and `data` for identical facts, injected clock, and injected run id; declared ordering keys; zero model calls; zero ambient clock reads. |
| Read-only | Zero state writes, zero fences, zero baseline-log or configuration writes, zero spawns, zero network, zero credential resolution; every read verified. |
| Read cost | One verified state read pass covering the telemetry families, transitions, and ceremony records; at most one baseline-log read, one declaration-node read, and one bounded corpus scan per invocation; no read beyond the declared sources. The read-cost suite prints a fold-only latency reference at the declared 1 000- and 10 000-record points and asserts the read counts, never the wall clock. |
| Clock discipline | Window bounds, the drawn default, censoring anchors, `crossedAt`, and the evaluation window all derive from the injected clock. |
| Privacy | Aggregate figures and identity references only; redaction chokepoint unchanged. |
| Contract sync | The machine and documented error tables agree on the `metrics` row bidirectionally at 152 entries / 151 delivered / 67 allowlist / +118; no exit literal outside the projection module. |
| Offline evidence | Every reporting path is proven on fixture-seeded temp stores and temp documents; zero live stores, credentials, or network. |

## Quality Assurance Strategy

Behaviour suites live under `tests/behaviour/metrics-*.test.ts`, shared fixtures under `tests/fixtures/metrics/`, and committed goldens under `tests/golden/metrics.test.ts` with `tests/fixtures/metrics/golden/`.

| Level | Suites | Scope |
|---|---|---|
| Structure and contract | `tests/structure/metrics-contract`, `metrics-imports`, `metrics-mounting`, `error-table` | Declaration-only contracts, exact key sets and closed vocabularies, tier and boundary confinement, the 24-family mount with the family-count pins and the stale-count scan, error-table registration. |
| Behaviour — surface and grammar | `metrics-grammar`, `metrics-envelope`, `metrics-help`, `metrics-report` | Locked flag set, pre-read refusals (lone bound, malformed instant, reversed range, missing value, unexpected positional, declared verbs), the nine-key envelope, the drawn window, the human digest, and root/family help. |
| Behaviour — baseline and damage | `metrics-baseline`, `metrics-baseline-damage` | Base consumption by ID and definition, committed `definitionRef`, status semantics, counted exclusions, row-absent classification, the byte-snapshot log immutability proof, and `metrics.baseline-unreadable` at exit 2 with no partial report. |
| Behaviour — measurement kinds | `metrics-cycle-time`, `metrics-ceremony-share`, `metrics-ci-proxy` | The committed interval, right-censoring and `PARTIAL`, the empty and out-of-window cases, the runner-fold share with its run/step/phase sample, and the proxy recomputation with the session-proxy limitation and `no_ci_observation` handling. |
| Behaviour — comparison view | `metrics-comparisons`, `metrics-caveat` | The protocol verdicts, `sampleMinimum: 5`, `insufficient-sample` with no trend claim, and the caveat appearing exactly on cross-kind rows and nowhere else. |
| Behaviour — dispatch parity | `metrics-dispatch` | Spend fidelity for the same selection, breakdown sums equal to totals, exact `perAgent` equality over a fully attributable selection, and the unattributable disclosure with the null row retained. |
| Behaviour — alarms | `metrics-alarms`, `metrics-burn-rate-config` | Exactly one alarm per crossing with the echoed fields and a byte-identical repeat, the below-threshold declared no-alarm case, `threshold-undeclared`, `telemetry-absent`, and every malformed-node refusal before any read. |
| Behaviour — curated defects | `metrics-escaped-defects` | The three classes, artifact-plus-anchor citation resolution, window and ref admission, the counted excluded rows, the display cap, the floor caveat, and `UNAVAILABLE` never zero. |
| Behaviour — absence | `metrics-absence`, `metrics-store-damage` | The cross-section absence matrix, the delivered `state.*` projections, and the rule that damage is never re-projected as absence. |
| Behaviour — honesty battery | `metrics-determinism`, `metrics-bounds`, `metrics-purity`, `metrics-read-cost`, `metrics-write-discipline` | Byte-identical replay and shuffle invariance, machine and human caps with counted drops and the never-dropped set, zero LLM/network/tracker/provider/socket access and brand neutrality, the counted read budget with a printed fold-only latency reference at the 1 000- and 10 000-record points, and zero writes on every path. |
| Checks — hermeticity and mutants | `tests/checks/metrics-hermetic`, `metrics-mutants` | Offline posture across every metrics suite and the disabling honesty mutants over temp copies of the pure domain, each with an unmutated control. |
| Golden | `tests/golden/metrics` | The bare, crossing, below-threshold, telemetry-absent, undeclared-threshold, and insufficient-sample machine and human bytes, never rewritten by the suite; the regeneration script is an explicit reviewed command. |
| Aggregate | `pnpm check` | The whole workspace, including `pnpm check:help` and the error-table sync check. |

Fixtures inject deterministic clocks, run ids, fence tokens, per-test temp state stores, a temp configuration document, a temp baseline log, and a temp corpus; tests never open a live store, resolve a credential, or use the network. A skip never counts as a pass.

## Operational & Support

### Configuration

One optional key: `metrics.burn-rate` in the project-committed configuration document, with `threshold`, `basis`, and `window`. It has no default; absent means undeclared and the report renders normally with `threshold-undeclared`. Composition injects the delivery state store, the local PM context, the project root, the configuration directory name, the clock, and the file facts; the ref is an explicit flag or the active change context, never an ambient default.

### Observability

The report is its own observability surface: the envelope's `runId` and `timing`, the classified error code, the per-section evidence states, the counted `omitted`/`truncated` markers, and the deterministic human digest. Every figure is auditable to its committed source from the payload alone: basis, measurement kind, evidence window, sample size, `definitionRef` where the metric has a committed row, and counted exclusions travel with it. The command-audit ledger records the invocation as it records every composed command; an audit-write failure never changes the outcome or exit code. The family adds no counter, metric, exporter, background process, or subscriber.

### Cost and read cost

The family writes nothing and retains nothing. Its recurring cost is one verified state read pass, one declaration-node read, one baseline-log read, one bounded corpus scan (at most 512 files at depth 6), and one in-process fold. There is no network, provider, or capture cost.

### Maintenance

- **Committed-data coupling.** The baseline-consumed entries depend on the log's metric IDs, definitions, and status semantics. A definition change allocates a new `MET-` ID and the vocabulary extends by exact declaration, never by pattern.
- **Count pins.** The error-table counts (152 / 151 / 67 / +118) and the mounted family count (25) are pinned in the sites the registration and mounting suites enumerate; a future identity or family addition moves them the same way.
- **Vocabulary closure.** Metric IDs, classes, verdicts, evaluation states, and bases are closed sets in the contract module; a new member is a contract change with its own consumers, not a data value.
- **Threshold ownership.** Thresholds are project policy; the tooling ships none and operators maintain theirs in their project's committed document.

## Dependencies & Risks

- **Depends on** the measurement baseline ([Measurement Baseline](feature-measurement-baseline.md)) for the canonical log, its four `MET-` rows, status semantics, exclusion reasons, source-traceability rule, and comparison protocol.
- **Depends on** the spend read side ([Spend Read Side](feature-spend.md)) for the dispatch block's figures, the breakdown-sums-equal-totals rule, the per-agent roll-up discipline, and the telemetry-absence posture.
- **Depends on** harness telemetry v2 ([Harness Telemetry v2](feature-telemetry-v2.md)) for the per-step and session families, the five attribution dimensions, and the reading bases.
- **Depends on** the ceremony runner ([Ceremony Runner](feature-ceremony-runner.md)) for run/step records and the native measurement fold behind ceremony share.
- **Depends on** the configuration layer ([Configuration Layer](feature-config-layer.md)) for the project-committed declaration read and the pre-read `config.value.invalid` refusal.
- **Depends on** the state layer ([State Layer](feature-state-layer.md)) for verified reads and classified `state.*` failures, and on the result contract ([Result Contract and Error Table](feature-result-contract.md)) for the envelope, the `metrics` row, the allowlist, exit projection, and redaction.
- **Risk — trend claims from thin samples:** mitigated by `sampleMinimum: 5`, the `insufficient-sample` verdict, and the rule that no row or derived surface claims a trend below the minimum.
- **Risk — proxy/native conflation:** mitigated by the per-entry closed measurement kind and the mandatory caveat on exactly the cross-kind rows.
- **Risk — the metric layer drifting into authoring the baseline it consumes:** mitigated by the read-only construction, the byte-snapshot gate over every read source, and the rule that committed comparison records stay authored data.
- **Risk — alarm spam or duplicates:** mitigated by the derived-view alarm set (at most one entry per evaluation), the byte-identical repeat, and the absence of persisted alarm state.
- **Risk — false alarms or silent blindness from a bad threshold:** mitigated by pre-read refusal of every node defect and by the `threshold-undeclared` posture that invents no default.
- **Risk — an escaped-defects count read as a census:** mitigated by the closed three-class set, the artifact-plus-anchor requirement, and the floor caveat stated in the entry.

## Glossary & References

| Term | Definition |
|---|---|
| Metric entry | One report row keyed by the closed metric-ID vocabulary, carrying value, status, measurement kind, basis, unit, direction, window-scoped sample, and limitation. |
| Measurement kind | The closed per-entry disclosure `native | proxy | curated-count` naming whether the figure is measured from machine records, recomputed under a proxy definition, or curated from committed prose. |
| Basis | The named committed source a figure derives from: `phase-transition-history`, `ceremony-runner-fold`, `committed-pm-notes-corpus`, or `committed-evidence-corpus`. |
| Baseline-consumed entry | A metric entry whose ID and definition come from the committed measurement baseline log and which cites it by `definitionRef`. |
| Evidence window | The inclusive `--from`/`--through` bounds (drawn: the trailing 30 days) scoping the corpus, the ceremony fold, and the windowed metrics. |
| Right-censoring | The cycle-time rule for an absent `pr_creation` completion: the interval anchors to the latest completed phase, the entry is `PARTIAL`, and the value is a lower bound. |
| Curated floor | An evidence-bound lower bound: unrecorded incidents are invisible and only artifact-anchored incidents in committed evidence count. |
| Escaped defect | A defect recorded in committed evidence after the delivering change's own gates reported green, in one of the three closed classes, cited with artifact plus anchor. |
| Threshold declaration | The `metrics.burn-rate` node in the project-committed configuration document (`threshold`, `basis`, `window`); absent means undeclared. |
| Crossing | The evaluated condition `measured ≥ threshold` over the declared trailing window; at most one alarm per evaluation. |
| Burn-rate alarm | The single derived alarm raised by a crossing, echoing ref, basis, threshold, measured, window, and `crossedAt` (the read instant). |
| Comparison view | The live, read-only evaluation under the committed protocol — same ID and definition, `sampleMinimum: 5`, a closed verdict, and the caveat on exactly the cross-kind rows. |
| Row-absent | The classified evidence state when the log carries no row for a vocabulary ID: absence declared, never zero. |
| Classified absence | The per-section declaration that evidence is missing (`telemetry-absent`, `threshold-undeclared`, row-absent, `UNAVAILABLE`) instead of a zero figure. |

## Related

- [Measurement Baseline](feature-measurement-baseline.md) — the canonical log, its rows, status semantics, and the comparison protocol.
- [Spend Read Side](feature-spend.md) — the fold the dispatch block composes.
- [Harness Telemetry v2](feature-telemetry-v2.md) — the per-step and session families behind the dispatch figures and the windowed spend.
- [Ceremony Runner](feature-ceremony-runner.md) — the run/step records behind native ceremony share and the authored comparison records.
- [Configuration Layer](feature-config-layer.md) — the project-committed declaration read and refusal identities.
- [Result Contract and Error Table](feature-result-contract.md) — the envelope, the `metrics` row, the two-segment allowlist, exit projection, and redaction.
- [State Layer](feature-state-layer.md) — verified reads and classified damage.
- [CLI Entrypoint and Self-Description](feature-cli-entrypoint.md) — the prompt-required composition and help surfaces.
- [Glossary](../../overview/glossary.md) — repository-wide terms.
- `metrics` reference page: [doc/planning/oss-tooling/milestones/m2/commands/metrics.md](../../planning/oss-tooling/milestones/m2/commands/metrics.md).
- Change record: `doc/changes/2026-11/2026-11-16--GH-299--metrics-spend/`.
