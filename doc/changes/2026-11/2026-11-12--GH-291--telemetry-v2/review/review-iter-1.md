# GH-291 Review — Iteration 1

- change: GH-291 (M2-S14: Harness telemetry v2)
- date: 2026-11-13
- mode: local
- base: main-tools; range origin/main-tools..HEAD (14 commits at review time)
- spec: chg-GH-291-spec.md (13 ACs, DEC-1..DEC-6); plan: chg-GH-291-plan.yaml (8 phases, all complete)
- spot-run evidence: 246 tests / 0 fail across 34 suites (pinned scenarios, ingest/attribution, reconciliation, fold-basis, v1-compat, bounds, mutants, hermetic, disclosure, determinism, privacy, audit-compose, consumer citation, storage, goldens)

## Verdict

**FAIL** — remediation required before PR (F-1 mandatory; F-2, F-3 strongly advised).

Findings: 8 total — 0 critical / 1 high / 2 medium / 4 low / 1 info.

## Findings

| ID | Severity | Location | Issue | Remediation |
|----|----------|----------|-------|-------------|
| F-1 | HIGH | packages/cli/src/production.ts:1016-1033 | Production ingest composition never wires attribution substrates: `telemetrySinkFor` builds the sink without `claimed` identity and with `runId: "run-" + randomUUID()`; every production step record gets `lane: null`, `agentRole: null` + `unattributable-step` warnings; runId never joins the command-audit ledger. `joinAttributionSubstrates` is consumed only by its own test. Spec F-2/G-2 and AC-F2-1's five-dimension primary path pass only on injected fixtures; real deliveries degrade to three dimensions. | Thread dispatch-time claimed agent role/lane + audit runId into `telemetrySinkFor` (or read them inside `createTelemetryIngestSink` via injected substrate ports), reusing `joinAttributionSubstrates`; add a composition-level test proving a claimed identity reaches a stored record. |
| F-2 | MEDIUM | packages/cli/src/edge.ts (createTelemetryIngestSink) + contracts/telemetry.ts:242-248 | Ingest accounting never surfaces: the private `tally` (captured/degraded/failed + per-reason counts) has no accessor and nothing reads it; drift frames, non-object failures, pre-session frames, storage-append failures, and baseline-capture failures leave zero durable trace; an append failure is still tallied `captured`. Spec §10 requires every capture degradation be disclosed with a closed-vocabulary warning and a count. | Surface the tally (additive capture-outcome-style record at session close, or an accounting read on the sink contract) and count append failures as `failed`. |
| F-3 | MEDIUM | packages/core/src/domain/spend.ts:275-291 (deviationOf) | Zero-base token classes are skipped in tolerance arithmetic: baseline 0 with observed > 0 contributes nothing to max deviation, so the verdict can be `within` while headline totals diverge arbitrarily through zero-base classes — the schema-drift scenario reconciliation exists to catch (RSK-1). | Treat `base === 0 && observed > 0` as immediate outside (or deviation 1) per class, matching the existing `baseTotal === 0` handling. |
| F-4 | LOW | packages/core/src/domain/telemetry-ingest.ts:192-195 (stampOf) | `new Date(value).toISOString()` throws RangeError for finite numeric timestamps beyond ±8.64e15 ms; the adapter's catch drops the frame silently and uncounted (compounds F-2). Drain never disturbed. | Range-guard the numeric stamp; classify out-of-range as `non-numeric-value`. |
| F-5 | LOW | packages/core/src/state/telemetry.ts:428-441 (appendTelemetryBaseline) | (runId, sessionId) idempotency check runs before the fence is acquired — check-then-act window where two concurrent captures could both append. Mitigated by single-writer discipline + post-append verification read. | Move the check inside the fence. |
| F-6 | LOW | packages/core/src/domain/spend.ts:673-679 | Orphaned duplicated doc block ("Bound the machine payload (PIN-2, PIN-3, DM-6)...") detached from `boundReport`, sitting above `largestFitting`'s doc comment. | Delete or reattach. |
| F-7 | INFO | packages/core/src/domain/spend.ts:811 | `--phase`-scoped report reconciles phase-scoped observed totals against the whole-delivery summed baseline (DEC-5's letter); phase selections on multi-phase deliveries typically render `outside` even when the delivery reconciles. Both figures stated — declared outcome, not hidden. Future refinement could scope the baseline to the phase window. | No action required; recorded as a known basis note. |
| F-8 | LOW | chg-GH-291-plan.yaml phase 7 scope.files | `tests/structure/telemetry-contract.test.ts` (TC-039 home) omitted from phase-7 declaration; staged under plan-union scope; `retro.ts` cosmetic rename rode the same drift. Both self-disclosed in pm-notes. | Record note; optionally add the file to the phase-7 declaration when the plan is next edited. |

## Pinned scenarios

- SC-M2-S14-01 (verdict `within`, tolerance ≤ 0.02): **VERIFIED** — R-01 runs the CLI `--json` envelope asserting verdict/tolerance/observed/excluded; R-02 pins the 1% boundary; R-03 pins 5% → declared `outside`. Suite green.
- SC-M2-S14-02 (absence, exit 1, no zero report): **VERIFIED** — machine + human paths assert exit 1 `spend.telemetry-absent`, no zero report; baseline-records-only store is still absence (S-06). Suite green.

## DEC invariants

- DEC-4 (fold-not-absence for non-opencode planes): **HOLDS** (spend-v2-fold-basis suite).
- DEC-5 (summed baseline, single verdict): **HOLDS** with one exception — the zero-base-class blind spot (F-3) can misgrade divergence as `within`; fix F-3 to fully secure the invariant.
- DEC-6 (additive payload, kept `delivery.spend.v1` identity): **HOLDS** (SPEND_DATA_KEYS six v1 keys + five v2 keys; compat + contract suites green).

## Other verified dimensions

Plan audit: all 8 phases complete with commit hashes + narrow-gate results; no missing evidence; scope deviations disclosed in pm-notes (F-8). Tier boundaries: contracts/domain/state/adapter/CLI conform (telemetry-imports green). Privacy/hermeticity: aggregate-only keys pinned; synthetic redacted fixture; hermetic scan green; no message bodies or credential material in the diff. GH-292 exclusions respected (zero queue files; doc/decisions/ untouched). Error table: no new rows (delivered identities reused); one minor changeset over five publishables.
