---
ados_distribution: internal
id: SPEC-TELEMETRY-V2
status: Current
created: 2026-11-13
last_updated: 2026-11-13
owners: ["engineering"]
service: delivery-os
summary: "Harness telemetry v2: per-step token, calls, and cost ingest beside the delivered opencode JSONL drain with present-zero distinguished from omitted, five-dimension attribution joined from session economics and command-audit identity, one bounded read-only per-session totals query at stream close captured as a harness.telemetry.baseline record, schema-versioned additive step and baseline record families under delivery.telemetry.storage.v1 with re-read migration, classified damage, linear growth, the stream-ingest/closeout-capture/combined reading bases with the declared session-dedup combination rule, the storage identity the peak-pause window-scoped zero-spend evidence counts over, and aggregates-only privacy."
links:
  related_changes: ["GH-291", "GH-294"]
  related_decisions: ["ADR-0003", "ADR-0008", "TDR-0004", "TDR-0016"]
  contracts:
    - "packages/core/src/contracts/telemetry.ts"
    - "packages/core/src/contracts/harness-telemetry.ts"
    - "packages/core/src/contracts/economics.ts"
    - "packages/core/src/contracts/harness.ts"
---

# Feature: Harness Telemetry v2

> **Role of this Document:** Source of truth for the delivered harness telemetry v2 capture, attribution, and storage contract (M2-S14). It describes the ingest path, the attribution join, the baseline capture, the storage families, and the reading bases. The read side that consumes these records is specified in [Spend Read Side](feature-spend.md); the delivered closeout capture path is specified in [Harness Adapters](feature-harness-adapters.md) and is unchanged.

## 1. Overview

Telemetry v2 makes delivery spend an observation instead of an estimate. While the opencode adapter drains a v2.x.y JSONL stream, a per-frame decode counts the five token classes, calls, and per-model cost in harness-reported units (never converted or re-priced) and stores one attributed `harness.telemetry.step` record per completed step. When the drain settles with an observed session id, the adapter performs exactly one bounded read-only per-session totals query through the delivered store-opener seam and appends one `harness.telemetry.baseline` record for that session. The two families are additive beside the delivered closeout-captured `harness.telemetry` records; they carry their own storage identity and change no delivered payload, key prefix, or state-layer schema version.

The capture path is non-gating: a decode failure is counted and an append failure is classified by the state tier, and neither changes the delivery outcome. The delivered drain, handle acquisition, and terminal completion behaviour are unchanged. An absent sink keeps the delivered stream behavior exactly.

## 2. Attribution

Every stored step carries five attribution dimensions: `ticket`, `repository`, `lane`, `agentRole`, and `model`.

- `ticket` is the work-item ref the capture runs for; `repository` resolves from the checkout identity.
- `lane` and `agentRole` come from the command-audit claimed identity for the session: the delivered production composition joins the same substrates the ledger records, answering from a completed run's recorded claim and, failing that, from the invoking process's own claimed identity. An unreported `lane` stays unattributed and disclosed.
- `model` comes from the decoded step frame.
- `runId` and `sessionId` join the delivered session-economics identity; `treeRoot` records the checkout. The sink's run identity is the invoking command's audit run id, so every stored step record joins the command-audit ledger by that value; a composition that carries no invocation run id records the declared `run-unavailable` marker instead of inventing one.

An absent dimension is stored as `null` and the record carries the closed `unattributable-step` warning naming the field. A dimension is never defaulted, guessed, or borrowed from another session.

## 3. Ingest rules

| Frame fact | Behaviour |
|---|---|
| Reported token class | Stored as its exact count; a present zero stays `0`. |
| Omitted token class | Stored as `null` with the closed `optional-field-absent` warning and excluded from every sum. Never fabricated to zero. |
| Non-numeric token value | Stored as `null` with `non-numeric-value`, excluded from sums. |
| Missing calls or cost | Stored as `null`; excluded from roll-ups and totals. Never estimated. |
| Missing cost | `cost-missing`; the report discloses sparsity. |
| Unrecognised frame type or unexpected part shape | Degrades with the closed `version-drift` warning; ingest continues. |
| Non-object frame | Counted as a failed frame; ingest continues. |
| Numeric stamp beyond the representable date range | Stored as `null` with `non-numeric-value` naming the field; excluded from timing, never thrown. |
| Frame arriving before its session is known | Counted degraded under `unattributable-session`; it can never be attributed to a session. |
| Session-total read unavailable | No baseline record lands; the session appears as an excluded baseline session. No figure is fabricated. |

The sink maintains `captured`, `degraded`, and `failed` counts plus per-reason counts, exposes them through a live accounting read on the sink contract, and writes them at session close as one durable ingest-accounting record. A step whose storage append does not land is counted `failed` under the closed `capture-append-failed` reason, never `captured`; a failed session-total read is counted `failed` under the delivered `session-capture-failed` reason. Ingest failure never changes the delivery outcome, report, or exit.

## 4. Storage

The storage identity is the brand-neutral `delivery.telemetry.storage.v1`; a version bump migrates by re-reading the versioned source, and stored records are never mutated in place and never dropped.

| Record kind | Schema id | Key prefix |
|---|---|---|
| `harness.telemetry.step` | `delivery.harness.telemetry.step.v1` | `harness.telemetry.step:` |
| `harness.telemetry.baseline` | `delivery.harness.telemetry.baseline.v1` | `harness.telemetry.baseline:` |
| `harness.telemetry.capture` | `delivery.telemetry.capture.v1` | `harness.telemetry.capture:` |

Appends run through the delivered fenced append path. A step append is one framed, checksummed, fsynced record with no per-step whole-ledger re-read, so ingest stays bounded and constant-memory on a long session; a baseline append is idempotent by (run, session), and the idempotency read runs inside the acquired fence so two concurrent captures of one session cannot both append. One ingest-accounting record is appended per session close over the same fenced path, so a degradation that never produced a step record still leaves a counted trace. Strict payload validation classifies a torn or shape-invalid record as the delivered `state.store.torn`; an unsupported version is `state.schema.mismatch`; an unknown store condition is `state.store.unknown`. Growth is linear in records: one bounded append per captured step, plus one or two per session close (always the accounting record, and the baseline when the session's totals were read), no compaction, no backfill, no derived document.

Telemetry records are state-ledger records and never enter the memory change capsule.

## 5. Reading bases

The fold discloses which plane produced its figures:

| Basis | Meaning |
|---|---|
| `stream-ingest` | Per-step v2 records feed the figures. |
| `closeout-capture` | The delivered v1 session-group records feed the figures; missing lane or per-step detail is classified degradation, never a false absence. |
| `combined` | Records of both planes exist in the selection; the declared session-dedup rule selects each session's step sums while its closeout sums corroborate the baseline. |

The combination rule deduplicates by `sessionId`: a session present in both planes contributes its v2 step sums to the observed figures and its closeout group sums as baseline input. Summing both planes for one session inflates observed beyond the summed baseline and must surface as the declared `outside` verdict. The rule is a declared contract constant, not an implementation detail.

## 5.1 Window-scoped consumption

The peak-pause zero-spend evidence is a declared consumer of this storage: the count of billable model calls attributable to the parked lane (the `lane` dimension of the attribution join) from the park timestamp through the window end, both boundaries inclusive, read over the same `delivery.telemetry.storage.v1` identity and disclosed with a `telemetryState` that never renders a classified absence as zero. The scoping contract lives in [Spend Read Side](feature-spend.md) and [Provider Peak Pausing](feature-peak-pausing.md); the storage adds nothing for it — the step records and their positions are the evidence.

## 6. Privacy and boundaries

- Records carry aggregate counts, identity references, and time windows only: no prompt text, message body, transcript, diff, tool output, or credential material. The delivered redaction chokepoint composes unchanged.
- Ingest runs on the composition edge only, beside the delivered adapter drain. It adds no process primitive, spawn/kill capability, environment-variable handling, blocking work, or network call.
- The spend read path performs zero harness-store queries; baseline records are capture-time only.

## 7. Quality assurance

| Level | Suites | Scope |
|---|---|---|
| Ingest and attribution | `telemetry-ingest`, `telemetry-attribution` | I-01..I-07 degradation matrix, non-interference, failure accounting, five dimensions, no misattribution. |
| Storage | `telemetry-storage-migration`, `telemetry-storage-damage`, `telemetry-storage-growth`, `telemetry-storage-coexistence` | Re-read migration equality, `state.*` damage identities, linear growth, both planes coexisting. |
| Timing and basis | `telemetry-timing`, `spend-v2-fold-basis` | Delivered-record durations, stall and restart joins, S-01..S-09 basis cells. |
| Cross-cutting | `telemetry-disclosure`, `telemetry-determinism`, `telemetry-privacy`, `telemetry-audit-compose`, `telemetry-hermetic`, `telemetry-mutants` | Disclosure, determinism, privacy, audit composition, offline posture, and the disabling honesty mutants. |
| Contract | `telemetry-contract`, `telemetry-imports`, `content-inventory` | Declared constants, brand neutrality, boundary confinement, inventory registration. |

## 8. Related

- [Spend Read Side](feature-spend.md) — the fold, breakdowns, timing summaries, window-scoped zero-spend evidence, and reconciliation disclosure over these records.
- [Provider Peak Pausing](feature-peak-pausing.md) — the peak-pause consumer of the window-scoped evidence.
- [Harness Adapters](feature-harness-adapters.md) — the delivered port surface, the streaming drain, and the unchanged closeout capture.
- [Session Lifecycle Economics](feature-session-lifecycle-economics.md) — the run and session identity the attribution joins.
- [State Layer](feature-state-layer.md) — the record kind, fencing, verification, and classified damage identities.
- [Status Digest](feature-status-digest.md) — section 8, fed by the same fold.
