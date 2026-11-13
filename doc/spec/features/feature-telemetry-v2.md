---
ados_distribution: internal
id: SPEC-TELEMETRY-V2
status: Current
created: 2026-11-13
last_updated: 2026-11-13
owners: ["engineering"]
service: delivery-os
summary: "Harness telemetry v2: per-step token, calls, and cost ingest beside the delivered opencode JSONL drain with present-zero distinguished from omitted, five-dimension attribution joined from session economics and command-audit identity, one bounded read-only per-session totals query at stream close captured as a harness.telemetry.baseline record, schema-versioned additive step and baseline record families under delivery.telemetry.storage.v1 with re-read migration, classified damage, linear growth, the stream-ingest/closeout-capture/combined reading bases with the declared session-dedup combination rule, and aggregates-only privacy."
links:
  related_changes: ["GH-291"]
  related_decisions: ["ADR-0003", "TDR-0004"]
  contracts:
    - "packages/core/src/contracts/telemetry.ts"
    - "packages/core/src/contracts/harness-telemetry.ts"
    - "packages/core/src/contracts/economics.ts"
    - "packages/core/src/contracts/harness.ts"
---

# Feature: Harness Telemetry v2

> **Role of this Document:** Source of truth for the delivered harness telemetry v2 capture, attribution, and storage contract (M2-S14). It describes the ingest path, the attribution join, the baseline capture, the storage families, and the reading bases. The read side that consumes these records is specified in [Spend Read Side](feature-spend.md); the delivered closeout capture path is specified in [Harness Adapters](feature-harness-adapters.md) and is unchanged.

## 1. Overview

Telemetry v2 makes delivery spend an observation instead of an estimate. While the opencode adapter drains a v2.x.y JSONL stream, a per-frame decode counts the five token classes, calls, and per-model cost in harness-reported units (never converted or re-priced) and stores one attributed `harness.telemetry.step` record per completed step. When the drained stream resolves with an acquired session handle, the adapter performs exactly one bounded read-only per-session totals query through the delivered store-opener seam and appends one `harness.telemetry.baseline` record for that session. The two families are additive beside the delivered closeout-captured `harness.telemetry` records; they carry their own storage identity and change no delivered payload, key prefix, or state-layer schema version.

The capture path is non-gating: a decode or append failure is a classified count, never a delivery failure, and the delivered drain, handle acquisition, and terminal completion behavior are unchanged. An absent sink keeps the delivered stream behavior exactly.

## 2. Attribution

Every stored step carries five attribution dimensions: `ticket`, `repository`, `lane`, `agentRole`, and `model`.

- `ticket` is the work-item ref the capture runs for; `repository` resolves from the checkout identity.
- `lane` and `agentRole` come from the command-audit claimed identity for the session.
- `model` comes from the decoded step frame.
- `runId` and `sessionId` join the delivered session-economics identity; `treeRoot` records the checkout.

An absent dimension is stored as `null` and the record carries the closed `unattributable-step` warning naming the field. A dimension is never defaulted, guessed, or borrowed from another session.

## 3. Ingest rules

| Frame fact | Behaviour |
|---|---|
| Reported token class | Stored as its exact count; a present zero stays `0`. |
| Omitted token class | Stored as `null` with the closed `optional-field-absent` warning and excluded from every sum. Never fabricated to zero. |
| Non-numeric token value | Stored as `null` with `non-numeric-value`, excluded from sums. |
| Missing calls or cost | Stored as `null`; excluded from roll-ups and totals. Never estimated. |
| Missing cost | `cost-missing`; the report discloses sparsity. |
| Unrecognised frame shape or version drift | Degrades with `version-drift` or `malformed-line`; ingest continues. |
| Session-total read unavailable | No baseline record lands; the session appears as an excluded baseline session. No figure is fabricated. |

The sink discloses `captured`, `degraded`, and `failed` counts. Ingest failure never changes the delivery outcome, report, or exit.

## 4. Storage

The storage identity is the brand-neutral `delivery.telemetry.storage.v1`; a version bump migrates by re-reading the versioned source, and stored records are never mutated in place and never dropped.

| Record kind | Schema id | Key prefix |
|---|---|---|
| `harness.telemetry.step` | `delivery.harness.telemetry.step.v1` | `harness.telemetry.step:` |
| `harness.telemetry.baseline` | `delivery.harness.telemetry.baseline.v1` | `harness.telemetry.baseline:` |

Appends run through the delivered fenced append path and read back before success. Strict payload validation classifies a torn or shape-invalid record as the delivered `state.store.torn`; an unsupported version is `state.schema.mismatch`; an unknown store condition is `state.store.unknown`. Growth is linear in records: one bounded append per captured step and one per session close, no compaction, no backfill, no derived document.

Telemetry records are state-ledger records and never enter the memory change capsule.

## 5. Reading bases

The fold discloses which plane produced its figures:

| Basis | Meaning |
|---|---|
| `stream-ingest` | Per-step v2 records feed the figures. |
| `closeout-capture` | The delivered v1 session-group records feed the figures; missing lane or per-step detail is classified degradation, never a false absence. |
| `combined` | Both planes hold records for a session and the declared session-dedup rule selects each session's step sums while its closeout sums corroborate the baseline. |

The combination rule deduplicates by `sessionId`: a session present in both planes contributes its v2 step sums to the observed figures and its closeout group sums as baseline input. Summing both planes for one session inflates observed beyond the summed baseline and must surface as the declared `outside` verdict. The rule is a declared contract constant, not an implementation detail.

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

- [Spend Read Side](feature-spend.md) — the fold, breakdowns, timing summaries, and reconciliation disclosure over these records.
- [Harness Adapters](feature-harness-adapters.md) — the delivered port surface, the streaming drain, and the unchanged closeout capture.
- [Session Lifecycle Economics](feature-session-lifecycle-economics.md) — the run and session identity the attribution joins.
- [State Layer](feature-state-layer.md) — the record kind, fencing, verification, and classified damage identities.
- [Status Digest](feature-status-digest.md) — section 8, fed by the same fold.
