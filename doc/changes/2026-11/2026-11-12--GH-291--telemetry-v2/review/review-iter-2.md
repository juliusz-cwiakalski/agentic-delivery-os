# GH-291 Review — Iteration 2 (post-remediation, post-sync-merge)

- change: GH-291 (M2-S14: Harness telemetry v2)
- date: 2026-11-13
- mode: local
- base: origin/main-tools; range origin/main-tools..42eca96a (20 commits incl. remediation 10b5d880, sync merge b6181727, sync-notes 42eca96a)
- spot-run evidence: 99 tests / 0 fail across 12 suites (spend-reconciliation, spend-absent, telemetry-attribution, telemetry-ingest, queue-remove, queue-claim-single-flight, queue-reconcile, events-remove, events-emitted-kinds, spend-v2-fold-basis, telemetry-contract, content-inventory)
- full battery evidence: 8008 pass / 4 skip / 0 fail across 1031 files at 42eca96a (post-merge); 7837 pass / 4 skip / 0 fail at 10b5d880 (post-remediation)

## Verdict

**PASS** — 0 blocking findings. All 8 iteration-1 findings resolved or accepted. Remediation phase: NONE (no plan changes required). Ready for quality_gates → dod_check → pr_creation.

## Per-finding verification (iteration 1 → 2)

| ID | It-1 severity | Verdict | Evidence |
|----|---------------|---------|----------|
| F-1 | HIGH | **FIXED** | production.ts:535 `createProductionTelemetrySink` builds `TelemetryAttributionSubstrates` (economics session identity via readSessionIdentity; command-audit claimed identity via bounded read `TELEMETRY_AUDIT_READ_LIMIT = 64`; env claim fallback). `telemetrySinkFor` uses `invocation?.runId ?? TELEMETRY_RUN_ID_UNAVAILABLE` — random runId gone. entrypoint.ts:286-303 one runId per invocation shared with the audit record. edge.ts:3986-4000 `claimedFor` joins per session via `joinAttributionSubstrates`. Composition-level tests (telemetry-attribution.test.ts:218-309) prove claimed identities ("coder-ledger" ledger + "coder-invocation" env fallback) reach **stored** step records; runId joins the audit ledger; lane disclosed `unattributable-step`, never guessed. |
| F-2 | MED | **FIXED** | `TelemetryIngestCounts`/`TelemetryIngestAccounting`/`TelemetryIngestCaptureRecord` contracts + `accounting()` sink accessor; `appendTelemetryCaptureOutcome` durable record at session close over the fenced path; `harness.telemetry.capture` reserved in error-table-sync. Append failures `failed`/`capture-append-failed` (tallyFrame only after successful append); pre-session `unattributable-session` degraded; failed session-total reads `session-capture-failed`; closed vocabularies only. Tests assert each case + durable/live parity. |
| F-3 | MED | **FIXED** | `deviationOf` spend.ts:284-302: `base <= 0 && observed > 0 → worst = 1` → `outside`. Regression test: baseline-zero cacheWrite vs observed 50 → `outside`, matched-classes `within` non-vacuity control green. |
| F-4 | LOW | **FIXED (code)** | `stampOf` MAX_EPOCH_MS = 8.64e15 guard; non-finite/out-of-range → `non-numeric-value`, null, no throw. Minor note: no dedicated out-of-range test (NF-1 below, optional). |
| F-5 | LOW | **FIXED** | `appendTelemetryBaseline`: fence acquired first, idempotency read inside the fence, released on every path. |
| F-6 | LOW | **FIXED** | Doc block reattached to `boundReport`. |
| F-7 | INFO | No action (accepted) | Phase-scoped reconciliation basis note stands; both figures stated. |
| F-8 | LOW | Accepted disposition | Plan declarations untouched; remediation recorded as post-plan work under plan-union scope, self-disclosed in pm-notes. |

## New findings (non-blocking)

- **NF-1 (LOW, test-coverage, optional)**: the ±8.64e15 range guard in telemetry-ingest.ts is correct by inspection but no test exercises an out-of-range epoch value. Suggested follow-up: one decode test with `part.time.end = 8.65e15` asserting null + `non-numeric-value`, no throw. Does not block.
- **INFO**: per-frame attribution performs two bounded ledger reads (economics + audit capped at 64) — bounded w.r.t. stream length, documented in-code. No action.

## Pinned scenarios

- **SC-M2-S14-01** (verdict `within`, tolerance ≤ 0.02): **VERIFIED** (26/26 suite green incl. 1% boundary and 5% `outside`).
- **SC-M2-S14-02** (absence, exit 1, no zero report): **VERIFIED** (machine + human paths; baseline-records-only store still absence).

## DEC invariants

- **DEC-4** (fold-not-absence): **HOLDS**.
- **DEC-5** (summed baseline, single verdict): **HOLDS WITHOUT EXCEPTION** — the F-3 fix eliminates the iteration-1 zero-base caveat.
- **DEC-6** (additive payload, kept `delivery.spend.v1` identity): **HOLDS**.

## Merged-tree verification (b6181727)

Both lanes active post-merge: production.ts carries queue composition (GH-292) AND telemetry substrate composition; edge.ts carries both runtimes; barrels and fixtures union'd; docs union'd coherently (00-index, state-layer summary names both telemetry families and queue kinds, related_changes unions). Queue-lane spot-runs green post-merge. Spec compliance: PASS — 13/13 ACs, AC-F2-1 now genuinely satisfied on the production path.
