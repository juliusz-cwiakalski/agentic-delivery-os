---
ados_distribution: redistributable
---

# `metrics` — delivery metrics, dispatch spend, and burn-rate alarms

`metrics` produces one read-only report per invocation. It folds the committed
measurement baseline log, the delivered telemetry record families, the
`phase.transition` history, ceremony run/step records, committed change
documents, and the project-committed `metrics.burn-rate` declaration into the
`delivery.metrics.v1` payload.

## Usage

```
<binary> metrics [--ref <ref>] [--from <iso>] [--through <iso>] [--json]
```

- `--ref <ref>` — the work-item ref to evaluate. Omitted, the active change
  context supplies it; a malformed or unresolvable ref is
  `input.value.rejected` before any read.
- `--from <iso>` / `--through <iso>` — the inclusive evidence window. Both are
  required together or omitted together; the drawn default is the trailing 30
  days ending at the read instant.
- `--json` — the machine envelope. The human digest is bounded to 200 lines and
  16 384 bytes.
- `--help` prints this command's help and exits 0; `--version` prints the build
  identity and exits 0. Neither reads state, configuration, or the network.

There are no subcommands: `metrics history`, `metrics report`, and `metrics
list` are grammar refusals (`fallback.invocation`).

## What the report carries

`data` carries exactly `ref`, `window`, `metrics`, `dispatch`, `alarms`,
`alarmEvaluation`, `comparisons`, `omitted`, and `truncated`.

- `metrics` orders by the closed vocabulary: `MET-CEREMONY-SHARE`,
  `MET-CYCLE-TIME`, `MET-CI-FAILURE-RATE`, `escaped-defects`. The first three
  cite the committed `definitionRef` (log path plus the row's `source_commit`).
  Cycle time and ceremony share are native measurements from their declared
  sources; the CI failure rate is a session-level proxy recomputed under the
  committed definition. Escaped defects is a curated floor with
  artifact-plus-anchor citations.
- `dispatch` carries the delivered spend fold's figures for the same selection:
  `tokensByClass`, `costTotals` (with `sparse`), `restarts`, `perAgent`, and the
  role/model `breakdowns`. The figures equal `spend --ref` for the same
  selection; nothing is re-derived or re-priced.
- `alarms` holds at most one `burn-rate` entry per crossing, echoing the ref,
  basis, threshold, measured value, window bounds, and `crossedAt` (the read
  instant, identical to the window's end).
- `comparisons` applies the committed protocol: `sampleMinimum: 5`,
  `insufficient-sample` below it, and the proxy-vs-native caveat on exactly the
  cross-kind rows.

## Evidence postures

Absence is classified per section; a zero is never rendered for missing
evidence:

| Condition | Report |
|---|---|
| No telemetry for the ref | `dispatch.telemetryState: absent`, no figures, `alarmEvaluation: telemetry-absent` |
| No `metrics.burn-rate` node | `alarmEvaluation: threshold-undeclared`, no alarm, no default threshold |
| A log row missing | that entry is `UNAVAILABLE` (row-absent), no invented `definitionRef` |
| No ceremony runs in the window | `MET-CEREMONY-SHARE` is `UNAVAILABLE` with `sample.n = 0` |
| No committed evidence | `escaped-defects` is `UNAVAILABLE`, never `0` |

The report never refuses for absent evidence: the all-absent picture is a
success envelope at exit 0.

## Refusals and exit codes

| Outcome | Identity | Exit |
|---|---|---|
| Report produced (including every classified absence) | — | 0 |
| Malformed/unresolvable ref, lone or malformed bound, missing value | `input.value.rejected` | 1 |
| Unknown flag, unexpected positional, any declared verb | `fallback.invocation` | 1 |
| Defective `metrics.burn-rate` declaration | `config.value.invalid` | 1 |
| Committed baseline log present but unparsable or invalid | `metrics.baseline-unreadable` | 2 |
| Damaged telemetry/ceremony/transition store | the delivered `state.*` row | 1 or 2 |

## Examples

```
<binary> metrics
<binary> metrics --ref GH-299 --json
<binary> metrics --from 2026-10-18T00:00:00Z --through 2026-11-17T00:00:00Z
```

## See also

- `spend` — the delivered read side the `dispatch` block composes
- `status` — the delivery digest
- `verify gates` — the quality-gate evidence the comparison sample counts
