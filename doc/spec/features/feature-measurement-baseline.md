---
# Copyright (c) 2025-2026 Juliusz Ćwiąkalski (https://www.cwiakalski.com | https://www.linkedin.com/in/juliusz-cwiakalski/ | https://x.com/cwiakalski)
# Apache-2.0 License - see LICENSE file for full terms
source: https://github.com/juliusz-cwiakalski/agentic-delivery-os/blob/main/doc/spec/features/feature-measurement-baseline.md
ados_distribution: internal
id: SPEC-MEASUREMENT-BASELINE
status: Current
created: 2026-10-31
last_updated: 2026-10-31
owners: ["engineering"]
service: delivery-os measurement substrate
summary: "The committed, schema-versioned bash-era measurement baseline log: its path, schema, four MET- metric definitions, MEASURED/PARTIAL/UNAVAILABLE status semantics, source-traceability rule, fixed window, and comparison protocol. The log is canonical data; this spec describes the contract and does not restate values."
links:
  related_changes: ["GH-186"]
  decisions: ["ODR-0002"]
  contracts:
    - "doc/planning/oss-tooling/measurement-baseline.yaml"
---

# Feature Specification: Measurement Baseline

> **Role of this Document:** Source of truth for the measurement baseline feature. The committed log is canonical data; this document defines the contract a consumer must understand and does not duplicate logged values.

## 1. Overview

The measurement baseline is a committed, repository-local data artifact at `doc/planning/oss-tooling/measurement-baseline.yaml`. It records the bash-era delivery baseline — ceremony share, cycle time, CI failure session proxy, and false-signal incidents — so later milestones can compare against recorded numbers rather than memory.

The log is schema-versioned (`schema_version: 1`) and its values are immutable once committed. This feature spec describes the log's contract: path, schema, metric IDs, status semantics, source traceability, window, and comparison protocol. Metric values are read from the log; they are never restated here. M2-S6 owns native metrics and consumes the log by metric ID and definition.

The log is a user-facing document registered with the forbidden-literal check. It refers to the command surface generically as "the CLI" and carries no working-name literal on a non-allowlisted line.

## 2. Business Context

### 2.1 Problem Statement

- **Problem:** Bash-era improvement claims were anecdotal because no committed baseline existed. Later milestones could not show whether ceremony share, cycle time, CI failure rate, or false-signal incidents improved.
- **Affected Users:** Delivery maintainers, milestone owners (M2-S6), and anyone comparing a later measurement to the bash-era record.
- **Business Impact:** Without a committed, source-traced baseline, comparisons depend on memory and are not reproducible.

### 2.2 Goals & Success Metrics

- **Primary Goal:** A committed, schema-versioned log whose every non-null number is reproducible from named committed sources.
- **KPIs:** The log parses; every metric carries a definition, formula, unit, window, sources, sample counters, status, and direction; every change row and incident row cites a committed artifact and anchor; every metric sample conserves its counters; recomputation from the cited sources reproduces the recorded values exactly.

## 3. User Experience & Functionality

### 3.1 Capabilities

- **Committed canonical data:** The log lives under `doc/planning/oss-tooling/` and is tracked; it is never under `.ai/local/**`.
- **Four metric definitions:** `MET-CEREMONY-SHARE`, `MET-CYCLE-TIME`, `MET-CI-FAILURE-RATE`, and `MET-FALSE-SIGNAL-INCIDENTS`. `MET-` is the metric-definition prefix adopted by ODR-0002, with the log as its allocator.
- **Fixed window:** The baseline window is `2026-02-01T00:00:00Z` through `2026-10-31T23:59:59Z` inclusive. The capture change (GH-186) is excluded from all samples with reason `capture_change`.
- **Corpus ingestion:** Each committed pm-notes file is parsed as one YAML document; YAML-native `date`/`datetime` scalars are normalized to ISO-8601; a `00:00:00` time is a placeholder, not a measurement. Every excluded file keeps its own change row and a reason from the closed set `unparseable_yaml`, `date_only_or_missing_time`, `placeholder_zero_time`, `capture_change`, `outside_window`.
- **Per-metric samples:** The change spine is one row per committed pm-notes file at `source_commit`. Each metric carries shared `spine_*` counters and its own `metric_included`/`metric_excluded`/`excluded_unobserved` counters plus `metric_excluded_changes` (closed reasons `missing_metric_input`, `no_ci_observation`). A metric may use fewer rows than the spine without hiding an exclusion.
- **Source traceability:** Every non-null number cites a committed path plus field/anchor or an exact git command. No `tmp/**`, `.ai/local/**`, uncommitted log, or external URL is a measurement source.
- **Comparison protocol:** A later comparison uses the same metric ID and definition over an equal-length window. A definition change allocates a new `MET-` ID with a supersession note; committed values are immutable and a new baseline is appended, not edited.

### 3.2 User Flows

1. A milestone owner reads the log's metric IDs, definitions, window, and statuses.
2. The owner re-measures with the same definition over an equal-length window.
3. The owner compares the results, carrying the metric ID and definition version so a proxy is never compared to a native measurement without the caveat.

### 3.3 UI States & References

N/A — the log has no user interface. It is a data artifact consumed by tooling and people.

### 3.4 Edge Cases & Error Handling

- **Unparseable pm-notes:** A document-level YAML failure is a named `unparseable_yaml` change row, counted in every metric's `spine_excluded`; it is never dropped or zero-filled.
- **Date-only or missing time:** A pair with a date-only endpoint counts in `date_only_pairs_excluded`; a change with no usable time-bearing pair is `date_only_or_missing_time`.
- **Placeholder zero time:** A change whose time-bearing endpoints are all `00:00:00` is `placeholder_zero_time`; a placeholder pair in an otherwise usable change counts in `phase_pairs_excluded`.
- **Capture change:** GH-186 is `capture_change` and is excluded from every sample.
- **Out-of-window anchor:** A dated anchor outside the fixed window is `outside_window`.
- **Unobserved CI:** A spine-included change with no committed CI observation is excluded from the CI sample as `no_ci_observation` and is never assumed green.
- **Right-censored cycle time:** When `pr_creation.completed` is absent, the latest completed phase is used and the row is flagged `cycle_time_censored: true`. A row with no completed phase is `missing_metric_input`.

## 4. Technical Architecture & Codebase Map

### 4.1 High-Level Design

The log is a single YAML document with `schema_version: 1`. It is static data, not a runtime service. The path, schema, and metric IDs are the contract; the values are the record. A consumer reads the log, selects metrics by ID, and compares using the stored definition and window.

### 4.2 Core Components & Directory Structure

| Path | Component | Responsibility |
|------|-----------|----------------|
| `doc/planning/oss-tooling/measurement-baseline.yaml` | Baseline log | Canonical, schema-versioned data; the `MET-` allocator. |
| `doc/spec/features/feature-measurement-baseline.md` | This spec | Contract for the log; points to the log as canonical data. |
| `scripts/checks/forbidden-literals.registry.json` | Literal registry | Lists the log as a registered user-facing doc (data-only entry; check logic unchanged). |

### 4.3 Key Classes & Functions

N/A — the log is data. Consumers parse it with a standard YAML parser; no library API is defined by this feature.

### 4.4 Data Model

The log has these top-level keys:

| Key | Shape | Meaning |
|-----|-------|---------|
| `schema_version` | integer | Schema version of the log. |
| `artifact` | string | Human-readable artifact name. |
| `change` | mapping `{ref, tracker, excluded_from_samples}` | Identifies the capture change; never a bare string. |
| `status` | `MEASURED` \| `PARTIAL` \| `UNAVAILABLE` | Top-level coverage statement. |
| `captured_at` | ISO-8601 UTC | Capture time. |
| `source_commit` | 40-hex commit | The commit at which every cited path was read. |
| `window` | `{start, end, basis}` | The fixed baseline window. |
| `sources` | `[{id, kind, locator}]` | Named source locators. |
| `changes` | list of change rows | The corpus spine; one row per committed pm-notes file. |
| `metrics` | list of metric rows | The four `MET-` definitions and their samples. |
| `comparison_protocol` | string | The comparison rules. |

A **change row** carries `ref`, `pm_notes`, `included`, `excluded_reason`, `phase_pairs_included`, `phase_pairs_excluded`, `date_only_pairs_excluded`, `ceremony_duration_h`, `total_phase_duration_h`, `cycle_time_h`, `cycle_time_censored`, `ci_observed`, `ci_outcome`, `ci_observations[]`, and `false_signal_incidents[]`. Every `ci_observations` and `false_signal_incidents` row cites `artifact` and `anchor`.

A **metric row** carries `id`, `name`, `status`, `measurement_kind`, `definition`, `formula`, `unit`, `window`, `sources`, `sample` (`spine_rows`, `spine_included`, `spine_excluded`, `metric_included`, `metric_excluded`, `phase_pairs_included`, `phase_pairs_excluded`, `date_only_pairs_excluded`, `excluded_unobserved`), `metric_excluded_changes[]`, `numerator`, `denominator`, `value`, `aggregates`, `limitation`, `direction`, and `comparison_note`. `missing_source` appears only when a metric is `UNAVAILABLE`.

## 5. Non-Functional Requirements

| ID | Requirement | Threshold |
|----|-------------|-----------|
| NFR-1 | Source traceability: every non-null number cites a committed source. | 100% cited; 0 uncited |
| NFR-2 | Corpus completeness: the change spine has exactly one row per committed pm-notes file at `source_commit`, including unparseable files. | 100% |
| NFR-3 | Sample conservation: every metric row conserves `spine_rows = spine_included + spine_excluded`, `spine_included = metric_included + metric_excluded`, and `metric_excluded = len(metric_excluded_changes)`. | 4/4 |
| NFR-4 | Reproducibility: recomputation from the cited sources reproduces every recorded value, exclusion reason, and sample counter. | 0 mismatches |
| NFR-5 | Immutability: committed baseline values are never edited in place; a new baseline is appended or a new `MET-` ID is allocated. | 0 in-place value edits |
| NFR-6 | Literal compliance: the log is registered with the forbidden-literal check and carries no seed literal on a non-allowlisted line. | Exit 0; 0 occurrences |

## 6. Status Semantics

| Status | Meaning | Required fields |
|--------|---------|-----------------|
| `MEASURED` | The metric's stated corpus was fully examined with no missing required input. | Non-null `value`; no `missing_source`; complete coverage |
| `PARTIAL` | At least one sample row could not be examined/observed or a required field was missing; the excluded/limited part is stated. | Non-null `value`; sample counts; limitation naming the gap |
| `UNAVAILABLE` | The committed evidence cannot reconstruct the value. | Null `value`; non-empty `missing_source`; limitation |

A time metric whose corpus contains an `unparseable_yaml` or `placeholder_zero_time` change cannot be `MEASURED`; it is `PARTIAL` and reports the excluded count. For the CI metric, unobserved rows make the status `PARTIAL`; a session proxy is never presented as a per-run rate. No estimate, interpolation, or invented denominator is recorded as a measurement.

## 7. Dependencies & Risks

- **Depends on:** committed `chg-*-pm-notes.yaml` and `chg-*-evidence.md` artifacts and git history at `source_commit`.
- **Depends on:** ODR-0002 for the `MET-` prefix and the log as allocator.
- **Risk:** The CI metric has no committed run log and is a session proxy — mitigated by explicit `measurement_kind: session_proxy`, unobserved-row counting, and the never-assumed-green limitation.
- **Risk:** Self-reported pm-notes timestamps may carry clock skew — mitigated by the stated limitation and by comparing against the same source in later milestones.
- **Risk:** A later consumer restates values from this spec — mitigated by this spec describing only the contract and pointing to the log as canonical data.

## 8. Related Documentation

- [Measurement baseline log](../../planning/oss-tooling/measurement-baseline.yaml) — canonical data.
- [GH-186 delivery plan](../../changes/2026-10/2026-10-31--GH-186--decision-records-measurement-baseline/chg-GH-186-plan.md) — the delivery plan that produced the log.
- [ODR-0002 — ID Prefix Scheme and Project Catalog](../../decisions/ODR-0002-id-prefix-scheme-and-project-catalog.md) — `MET-` adoption and the allocator.
- [Feature: Decision Records Management](feature-decision-records.md) — the register and the decision-records standard.
- [Glossary](../../overview/glossary.md) — term definitions.
