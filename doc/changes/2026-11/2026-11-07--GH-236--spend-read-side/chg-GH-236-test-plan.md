---
id: chg-GH-236-test-plan
status: Proposed
created: 2026-11-07T09:00:00Z
last_updated: 2026-11-07T09:00:00Z
owners: [engineering]
service: "delivery-os learning plane (spend read side)"
labels: [m1, spend, learning-plane, state-layer, cli, status-digest]
version_impact: minor
summary: "Traceable verification of M1-S19: the `spend` v0 read side as a deterministic, read-only fold over the closeout-captured event log — five token classes (null excluded, degradation by closed reason, never fabricated to zero), calls, per-agent/model roll-ups, per-phase capture-time attribution from `phase.transition` windows with terminal attribution and the named `unknown` fallback, per-delivery restarts as max(0, N−1) over the union of run identities across both telemetry families, and the resume-amplification metric pinned by TDR-0011 (paid = five-class sum over all captured records, progress = the latest record-bearing run by captured-at descending with run-id ascending tie-break, healthy single run exactly 1, one named `restart-loop prefill re-pay` event per superseded positive-spend run with its window and `tokensWasted`, zero-progress null rule, honesty limits in the report's own terms); telemetry-absent as the first-class classified outcome (exit 1) while delivered state identities keep their own projections (torn/schema/unknown exit 2, permission-denied exit 1); the exact `delivery.spend.v1` data key set, mode emphasis flags, bounded deterministic rendering and byte-identical replays with zero harness-store reads; and the status-digest section 8 flip (spend observed, placeholder line removed, `placeholderSectionCount` 2→1, `state-log` evidence source, verified-empty and `state-unreadable` projections) fed by the same fold, with the brief unchanged."
links:
  change_spec: ./chg-GH-236-spec.md
  implementation_plan: ./chg-GH-236-plan.yaml
  testing_strategy: ../../../../.ai/rules/testing-strategy.md
---

# Test Plan - M1-S19: Spend read side and resume amplification

## 1. Scope and Objectives

This change turns an append-only statistics log into two answers the operator cannot get today — *what did this delivery cost, by phase and by agent/model?* and *how much of it was re-paid waste?* — and it flips a pinned digest placeholder while doing so. Three properties are load-bearing and each is tested independently so that weakening one cannot pass behind another.

**First, the read side must be a fold, not a probe.** Every figure derives from verified state-ledger reads of the two `harness.telemetry` record families for one ref plus that ref's `phase.transition` history; the harness adapters and harness stores are never consulted (binding AC 1). The plan proves this with a recording read seam and an adapter spy that must record zero calls, and it proves the absence case is classified rather than silently zeroed — because until GH-240 wires capture, every real store is telemetry-absent, so the "absent" path is the *normal* path.

**Second, the arithmetic must be pinned, not plausible.** Per-ticket sums exclude null classes and disclose degradation by closed reason; per-phase attribution is capture-time over transition windows with the terminal and `unknown` rules; restarts count the union of run identities; and amplification implements exactly the TDR-0011 formula. Every numeric oracle is computed independently from the fixture definition (hand-summed constants), never by reusing the production fold, and every formula pin has a named mutant that must fail the suite.

**Third, the surfaces must stay honest and bounded.** A healthy single-run delivery reads exactly 1; a restart loop yields one named, windowed, quantified event per superseded run; a zero-progress run yields `ratio: null`; the honesty limits are rendered in the report's own terms; telemetry-absent is `spend.telemetry-absent` at exit 1; store damage keeps its delivered exits; output is byte-identical on replay, bounded, and carries statistics and identity references only. The digest flip lands in the same change so the pinned `placeholderSectionCount` invariant never contradicts the rendered output.

This is a design and verification map, not an execution claim: no suites were run while authoring it.

### 1.1 In Scope

- The `spend` command surface and its locked grammar `<binary> spend [--ref <ref>] [--phase <phase>] [--amplification] [--json]`, grammar validation before any read, and the undeclared-flag/positional behaviour inherited from the delivered CLI parser (F-6, AC-F6-1, AC-F6-2, DEC-6, DEC-9).
- Per-ticket breakdown over the five delivered token classes as non-negative integers, total calls, and `perAgent[]` grouping by (agent, model) with calls and tokens, summed only from captured session-group records (F-1, F-4, AC-F1-1, DM-1, DEC-2).
- Null token classes excluded from every sum and counted in `degradation` by closed warning reason; truncation warnings retained; no class fabricated to zero (F-1, AC-F1-1, DM-1, DEC-2, NFR-3).
- Cost never aggregated, never rendered; token counts alone constitute the breakdown (F-1, AC-F1-2, NG-7, DM-1).
- Log-only read contract: both telemetry record families plus the ref's transition history, per-ref scoping, zero harness-store and provider reads on every invocation path (F-2, AC-F2-1, NFR-3, NFR-7, DEC-1).
- Telemetry-absent as the first-class classified outcome — verified-empty store, absent per-ref record, and a phase-scoped empty window — named, with capture-prerequisite remediation, exit 1, never an empty success or zero report (F-2, F-7, AC-F2-2, AC-F3-3, DM-5, DEC-6, DEC-7).
- Store-damage classification through each delivered `state.*` identity with its own delivered projection and no partial or zeroed report: torn/schema-mismatch/unknown-kind/unknown → exit 2; permission-denied → exit 1 with store path and record position only (F-2, F-7, AC-F2-3, DM-5, NFR-3).
- Per-phase attribution: ordered windows folded from `phase.transition` (`complete` closes, `reopen` reopens), captured-at selection, terminal attribution after the final transition, records before the first transition to the first transitioned phase, one aggregation entry per phase id, integer floored `share` (F-3, AC-F3-1, DM-2, DEC-4).
- The named `unknown` attribution fallback when the ref has no transitions, named in both the machine phase entry and the human digest (F-3, AC-F3-2, DM-2).
- Restarts as `max(0, N−1)` over the union of run identities across session-group records and capture-outcome records, with the capture-reached evidence basis disclosed (F-4, AC-F4-1, AC-F5-3, DM-4, DEC-5).
- Resume amplification exactly per TDR-0011: paid = five-class sum over all captured records; progress = the latest record-bearing captured run (captured-at descending, run-id ascending tie-break); healthy single positive-spend run = exactly 1; one named `restart-loop prefill re-pay` event per earlier record-bearing run with positive spend, carrying the derived window and `tokensWasted`; deterministic event ordering; closed single-entry cause vocabulary; zero-progress null rule; the degenerate all-zero case; the honesty limits (F-5, AC-F5-1, AC-F5-2, AC-F5-3, DM-3, DEC-3, TDR-0011 C-2..C-5).
- Consistency between the two run-identity readouts: superseded record-bearing runs ≤ restarts; a capture-outcome-only run counts toward restarts, contributes zero paid tokens, and raises no event (F-4, F-5, AC-F4-1, AC-F5-3, DM-3, DM-4, TDR-0011 boundary pin).
- Output contract: the standard CommandResult envelope (`delivery.result.v1`), `data` under the declared `delivery.spend.v1` schema constant with exactly the six pinned keys, `--json` forcing the envelope, `--amplification` scoping only the human amplification section, interactive/scripted rendering unchanged (F-6, AC-F6-2, DM-1, DEC-9).
- Bounded, deterministic output: machine ≤ 64 KiB; human ≤ 200 lines and ≤ 16 KiB; all bounds in UTF-8 bytes; deterministic truncation dropping trailing `perAgent[]`/`perPhase[]` entries with a recorded marker; byte-identical repeat renders; zero model calls; zero ambient clock/randomness in the render path (F-6, AC-F6-3, NFR-1, NFR-2).
- Privacy of output: statistics and identity references only — no prompt text, message bodies, transcripts, diffs, tool output, or credential material; the redaction chokepoint composes unchanged (NFR-5, AC-F1-1).
- One new `spend` error identity with exactly one row (`spend.telemetry-absent`: category user, non-retryable, `not_landed`, `user-validation` → exit 1), delivered rows unchanged, machine and documented tables agreeing bidirectionally, no exit literals outside the projection module (F-7, AC-F7-1, DM-5, NFR-6, DEC-7).
- Status-digest section 8 flip: `observed` with token-class totals, restarts and the amplification ratio; the placeholder line "spend summary arrives with M1-S19" renders nowhere; the derivation row updated from always-`not-delivered`; verified-empty → `observed` zero counts with the absence-of-capture human line; failed read → digest data with `state-unreadable` and the state failure code at exit 0; one additive evidence source id `state-log`; `placeholderSectionCount` exactly 1; spend contributes zero to `actionable`; brief payload unchanged (F-8, AC-F8-1, AC-F8-2, AC-F8-3, DM-6, DEC-8, DEC-10).
- One fold, two surfaces: the digest and the command render identical totals, restarts and ratio from the same seeded store (F-8, DM-6; spec §1 "fed by the same read-side fold").
- Read-only execution proof: zero state writes, zero fence acquisitions, zero child processes, zero network, zero credential resolution; an audit-seam write failure is a diagnostic that never changes the outcome or exit code (NFR-3, §10, §21).
- In-process fold latency and bounded work at 1,000 and 10,000 captured records (NFR-4).
- Contract/boundary confinement, inventory, forbidden-literal, exit-literal and content-inventory conformance for every file this change introduces (NFR-3, NFR-6, testing strategy §4).
- Documentation/help-surface reconciliation: `--help` grammar and examples, the man-page pack reconciled to the pinned contract (five classes, `degradation`, share semantics, `--amplification` scope), the glossary/index, and the branding forbidden-literal registry (spec §18, Appendix B, RSK-6).

### 1.2 Out of Scope & Known Gaps

- [OUT] Alarms, burn rates, quota snapshots and any M2-S6 surface (spec NG-1). Only the v0 ratio and events are tested.
- [OUT] Harness re-query on any path (spec NG-2). It is tested only as an **absence** (recorded reads and adapter spy count zero), never exercised positively.
- [OUT] Any capture, extraction, composer-wiring, record-shape or capture-point change (spec NG-3, GH-240/M1-S12). This change consumes delivered records unchanged; no test asserts capture behaviour.
- [OUT] `retro`, its evidence plane and its command family (spec NG-4); any MCP projection of spend (NG-5); daemon or lane-status integration of restart/amplification signals (NG-6, M1-S16).
- [OUT] Currency or cost aggregation and any cost model (spec NG-7). Cost is asserted only as *absent* from output and *ignored* in sums.
- [OUT] Brief payload/surface changes (spec NG-8). The brief is asserted unchanged in shape and content rules — it gains no spend entry.
- [OUT] Semantic-duplication analysis of session content (spec NG-9). The amplification suite proves the metric claims run duplication only; it never tests content overlap.
- [OUT] Real harness stores, live session databases, provider calls, network I/O, credentials, and real user state directories (NFR-7). Every path is proven on fixture-seeded temp stores.
- [OUT] Windows ACL execution. Permission assertions are POSIX-only; no run claims Windows verification.
- [OUT] Concurrent-appeal / fence contention as a tested failure class. `spend` is read-only: it acquires no fence and holds no lock, so the delivered `state.lock.busy` path is asserted as *not reachable* from any spend invocation rather than exercised.
- [GAP-1 — implementation-plan mapping — PENDING] `chg-GH-236-plan.yaml` is authored in `delivery_planning` (phase 4) and does not exist yet. It must map all `TC-SPEND-001..034` onto phases without reshaping any TC's behaviour, oracle, identity, exit, bound, or AC/NFR mapping. Any later plan that changes a pinned contract reopens this test plan.
- [GAP-2 — delivery-bound, non-blocking: NFR-4 is runner-dependent] The p95 ≤ 500 ms at 1,000 records and ≤ 2 s at 10,000 records thresholds depend on runner capacity. The CI oracle is **bounded work** (one verified ledger read per family per invocation, one fold, no per-record re-reads, no network) plus a soft local budget; a generated-fixture reference measurement is recorded in §10 and never reported as a passing threshold.
- [GAP-3 — delivery-bound, non-blocking: exact honesty-limit prose] Spec F-5 / AC-F5-3 / TDR-0011 C-5 require the report to state the limits, but the exact strings are not spec-pinned. This plan asserts the *obligations* through one declared contract constant set rendered verbatim in the amplification section; the prose itself is delivery-bound and is pinned together with its golden (TC-SPEND-018).
- [GAP-4 — spec-shape tension, non-blocking: the zero-progress run identity has no machine field] AC-F5-3 requires reporting `ratio: null` "naming the run", but DM-1 pins `amplification` to exactly `{ratio, events[]}` and `events[]` carries only superseded positive-spend runs. The machine envelope therefore has no field for the progress run's identity, so this plan asserts `ratio: null` in machine data and the run naming in the human report (the report's own terms), and records it as OQ-T2. Asserting an invented machine key would contradict DM-1; if machine consumers must see the identity, DM-1 needs a reviewed amendment (reopens specification, not this plan).
- [GAP-5 — degenerate case pinned here per TDR-0011 delegation] TDR-0011's unresolved question defers the `paid = 0 ∧ progress = 0` case to plan/test-plan time inside the degradation disclosure. TP-DEC-1 below pins it (`ratio: null`, progress run named, degradation disclosure, never 1 and never a failure); no formula change is made and AC-F5-1's exact-1 anchor is scoped to a positive-spend single run.
- [GAP-6 — delivery-bound, non-blocking: roll-up ordering and truncation tail] DM-1/NFR-1 require deterministic ordering and tail-drop truncation but do not pin the roll-up sort keys. TP-DEC-5 pins total orders and the invariant set (total, permutation-invariant, truncation from the declared tail, marker recorded); the exact keys are declared once in contracts and asserted through that constant, so a reviewed re-ordering updates one constant and the goldens together.

## 2. References

- **Change specification**: [chg-GH-236-spec.md](./chg-GH-236-spec.md) — 19 ACs (AC-F1-1..2, AC-F2-1..3, AC-F3-1..3, AC-F4-1, AC-F5-1..3, AC-F6-1..3, AC-F7-1, AC-F8-1..3), F-1..F-8, DM-1..DM-6, NFR-1..NFR-7, DEC-1..DEC-10, RSK-1..RSK-7, §14 OQ-1..OQ-4, Appendix A (ticket traceability), Appendix B (man-page deltas), Appendix C (worked amplification shape).
- **Decision record (formula oracle)**: [TDR-0011](../../../decisions/TDR-0011-spend-resume-amplification-v0-formula.md) — paid/progress/ratio pins, run-id tie-break, zero-progress null rule, named-event window construction and ordering, honesty limits, the restarts boundary pin, and the delegated degenerate case (Unresolved Questions).
- **Ticket**: GH-236 — M1-S19: Spend read side and resume amplification. Binding AC 1 → AC-F2-1 (+AC-F1-1, AC-F6-2); binding AC 2 → AC-F5-1 + AC-F5-2 (+AC-F5-3).
- **PM record**: [chg-GH-236-pm-notes.yaml](./chg-GH-236-pm-notes.yaml).
- **Implementation plan**: `./chg-GH-236-plan.yaml` — authored in phase 4; not yet present (GAP-1).
- **Testing strategy**: [.ai/rules/testing-strategy.md](../../../../.ai/rules/testing-strategy.md) — layers, module→test mapping, `bun:test`, permanent-suite invariant rules, `pnpm check` aggregate gate.
- **TypeScript rules**: [.ai/rules/typescript.md](../../../../.ai/rules/typescript.md) — strict typing, purity, ports and adapters, the error contract, `bun:test` authoring.
- **Current system truth — harness adapters and telemetry**: [feature-harness-adapters.md](../../../spec/features/feature-harness-adapters.md) §5–6 — the five token classes, warning vocabulary, neutral record vocabulary, and the absent production composer.
- **Current system truth — state layer**: [feature-state-layer.md](../../../spec/features/feature-state-layer.md) — verified reads, presence tolerance, validated boundaries, classified `state.*` failures, `harness.telemetry` record families and idempotency keys.
- **Current system truth — result contract**: [feature-result-contract.md](../../../spec/features/feature-result-contract.md) — envelope, error table, classification chain, `{0,1,2}` projection, mode-aware rendering, redaction chokepoint, documented-table sync.
- **Current system truth — status digest**: [feature-status-digest.md](../../../spec/features/feature-status-digest.md) — nine fixed sections, five states, evidence sources and outcomes, derivation matrix, placeholder catalog, summary counts, human grammar, corpus completeness meta-check, golden-never-rewritten rule.
- **Current system truth — brief**: [feature-brief.md](../../../spec/features/feature-brief.md) — the delivered brief carries no spend surface (DEC-10).
- **Contracts and seams consumed**: `packages/core/src/contracts/harness-telemetry.ts` (`HARNESS_TELEMETRY_*`, `HARNESS_TOKEN_CLASSES`, `HARNESS_WARNING_REASONS`, `HarnessTelemetryRecord`, `HarnessCaptureOutcomeRecord`), `packages/core/src/state/harness-telemetry.ts` (`readHarnessTelemetry`, `readHarnessCaptureOutcome`), `packages/core/src/state/registry.ts` (`readChangeTransitionsTolerant`), `packages/core/src/contracts/registry.ts` (`phase.transition` payload and `readChangeTransitions` semantics), `packages/core/src/contracts/error-table.ts` (`DOMAIN_KINDS`, rows, projection classes), `packages/core/src/contracts/result.ts` (`delivery.result.v1`), `packages/core/src/contracts/status.ts` (`STATUS_EVIDENCE_SOURCES`, `STATUS_SECTION_DERIVATION`, placeholder ids).
- **Existing evidence to extend (not replace)**: `tests/structure/{harness-contract,harness-imports,error-table,content-inventory}.test.ts`; `tests/behaviour/{harness-closeout-capture,harness-telemetry-shape,harness-telemetry-drift,harness-output-bounds}.test.ts`; `tests/behaviour/{status-command,status-section-states,status-placeholders,status-corpus,status-readonly-determinism,status-output,status-performance}.test.ts`; `tests/golden/status-digest.test.ts`; `tests/checks/{error-table-sync,exit-code-literals,forbidden-literals}.test.ts`; `tests/fixtures/state/harness.ts`; `tests/fixtures/closeout/harness-telemetry.ts`; `tests/fixtures/status/**`.
- **Closest delivered precedents**: [chg-GH-232-test-plan.md](../2026-11-06--GH-232--oss-retro-pipeline/chg-GH-232-test-plan.md) — Learn-family command shape, non-vacuity contract, recorded-argument assertions, exit oracle, mutant discipline; [chg-GH-243-test-plan.md](../2026-11-06--GH-243--status-collector-expansion/chg-GH-243-test-plan.md) — digest invariants, placeholder counts, corpus/golden update discipline.

## 3. Coverage Overview

### 3.1 Functional Coverage (F-#, AC-#)

| AC ID | Criterion (abbreviated) | TC ID(s) | Status |
|-------|--------------------------|----------|--------|
| AC-F1-1 | `tokensByClass` carries exactly the five classes as non-negative integers summed across captured records; `perAgent[]` groups by (agent, model) with calls and tokens; null classes and warnings are excluded from sums and counted in `degradation`, never fabricated to zero | TC-SPEND-003, TC-SPEND-004, TC-SPEND-033 | Covered |
| AC-F1-2 | Null-cost records render no currency or cost figure anywhere; tokens alone constitute the breakdown | TC-SPEND-005 | Covered |
| AC-F2-1 | **Binding AC 1** — the breakdown is reported from the event log with zero harness-store reads on every invocation path | TC-SPEND-003, TC-SPEND-006, TC-SPEND-032 | Covered |
| AC-F2-2 | A ref with no captured telemetry returns the classified `spend.telemetry-absent` (exit 1) naming the selection and capture-prerequisite remediation — never an empty success, zero report, or unclassified error | TC-SPEND-007, TC-SPEND-012 | Covered |
| AC-F2-3 | Torn / schema-mismatched / unknown-kind / permission-denied reads classify through that state identity's own projection (2 for the first three, 1 for permission), with store path and record position only, never a zeroed or partial report | TC-SPEND-008 | Covered |
| AC-F3-1 | Each record attributes to exactly one phase window under the capture-time rule; post-final-transition records attribute to the final transitioned phase; `perPhase[]` carries phase, calls, tokens and integer floored share | TC-SPEND-010 | Covered |
| AC-F3-2 | With captured telemetry and no transitions, all spend lands in the single named `unknown` window and the human digest names the fallback | TC-SPEND-011 | Covered |
| AC-F3-3 | An out-of-vocabulary `--phase` refuses `input.value.rejected` (exit 1) before any read; a canonical phase whose window holds no records returns scoped `spend.telemetry-absent` naming the phase | TC-SPEND-012 | Covered |
| AC-F4-1 | `restarts` = N−1 floored at zero over the union of run identities across both families; the agent/model roll-up spans all runs | TC-SPEND-013, TC-SPEND-019 | Covered |
| AC-F5-1 | **Binding AC 2 (healthy anchor)** — a delivery with exactly one record-bearing positive-spend run reads exactly 1 (paid = progress) | TC-SPEND-014, TC-SPEND-016 | Covered |
| AC-F5-2 | **Binding AC 2 (events)** — each superseded record-bearing run with positive spend flags one named `restart-loop prefill re-pay` event with its derived window and `tokensWasted`, sorted deterministically | TC-SPEND-015, TC-SPEND-016 | Covered |
| AC-F5-3 | Ratio = paid ÷ progress with progress the latest record-bearing run; a zero-token progress run with paid > 0 reports `ratio: null` naming the run; the report proves run duplication only, never semantic duplication; restarts' capture-reached basis is disclosed | TC-SPEND-017, TC-SPEND-018, TC-SPEND-019 | Covered |
| AC-F6-1 | Malformed ref shape or an omitted ref with no resolvable active context refuses `input.value.rejected` before any read; no flag outside the locked set is accepted | TC-SPEND-025, TC-SPEND-026 | Covered |
| AC-F6-2 | Machine output is the CommandResult envelope whose `data` carries `delivery.spend.v1` with exactly the pinned keys; `--json` forces the envelope; `--amplification` adds the human section while the envelope always carries amplification; delivered rendering unchanged | TC-SPEND-020 | Covered |
| AC-F6-3 | Identical store content, injected clock and injected run-id render byte-identically in either mode, with zero model calls in the render path | TC-SPEND-022 | Covered |
| AC-F7-1 | Every outcome's exit maps to a real error-table projection class (0 success; 1 telemetry-absent/input/user-validation; 2 platform-provider state rows), the new row syncs bidirectionally, and no exit literals exist outside the projection module | TC-SPEND-009 | Covered |
| AC-F8-1 | Digest section 8 `spend` is `observed` with token-class totals, restarts and the amplification ratio; the placeholder line renders nowhere | TC-SPEND-027, TC-SPEND-030 | Covered |
| AC-F8-2 | Verified-empty telemetry → `observed` zero counts plus an absence-of-capture human line (never a zero-spend claim); failed read → digest data with `state-unreadable` and the state code, nine sections, exit 0 | TC-SPEND-028 | Covered |
| AC-F8-3 | `placeholderSectionCount` is exactly 1 (blockers), spend contributes zero to `actionable`, and the brief payload is unchanged in shape and content rules | TC-SPEND-029 | Covered |

**Ticket-AC traceability (verbatim, binding).**

| Ticket AC | Covered by | How the plan proves it |
|---|---|---|
| "a closed change reports its spend breakdown from the event log without re-querying harness stores" | TC-SPEND-003, TC-SPEND-006, TC-SPEND-020, TC-SPEND-032 | Fold arithmetic on a seeded store with every total hand-summed from the fixture; a recording read seam and an adapter/harness-store spy proving zero reads and zero writes on the whole invocation; the exact envelope key set |
| "the resume-amplification metric reads approximately 1 for a healthy delivery and flags amplification events by name" | TC-SPEND-014, TC-SPEND-015, TC-SPEND-016, TC-SPEND-017, TC-SPEND-034 | Exact-1 anchor on a single-run fixture; one named, windowed, quantified event per superseded run with deterministic ordering; tie-break and permutation oracles; the null rule; six disabling mutants that must fail the suite |

**Capability coverage** (no capability unlinked): F-1 → TC-SPEND-003, 004, 005; F-2 → TC-SPEND-006, 007, 008; F-3 → TC-SPEND-010, 011, 012; F-4 → TC-SPEND-003, 013, 019; F-5 → TC-SPEND-014, 015, 016, 017, 018, 019; F-6 → TC-SPEND-020, 021, 022, 025, 026; F-7 → TC-SPEND-009, 007, 008; F-8 → TC-SPEND-027, 028, 029, 030.

All 19 acceptance criteria map to at least one automated case and none carries a TODO. Both binding ticket ACs are covered by dedicated matrices rather than a smoke case: binding AC 1 by the fold arithmetic plus the recorded-read/absence-of-probe proof (TC-SPEND-003, 006, 032) and binding AC 2 by the amplification oracle matrix A-01..A-10 (TC-SPEND-014..019) with the mutant meta-case (TC-SPEND-034).

### 3.2 Interface Coverage (API-#, EVT-#, DM-#)

The specification declares no HTTP endpoint (§8.1), no event or message (§8.2), and no new record kind, payload schema, key prefix, or append path. The data model has six elements (DM-1..DM-6).

| Interface / data model | Description | TC ID(s) | Status |
|------------------------|-------------|----------|--------|
| DM-1 — Spend report data shape (`delivery.spend.v1`) | Exactly `tokensByClass`, `perPhase[]`, `perAgent[]`, `restarts`, `amplification`, `degradation`, inside the `delivery.result.v1` envelope; schema id is a declared constant, never a `data` key | TC-SPEND-001, TC-SPEND-003, TC-SPEND-004, TC-SPEND-020, TC-SPEND-021 | Covered |
| DM-2 — Per-phase attribution basis | Ordered windows from `phase.transition` (complete closes, reopen reopens), captured-at selection, terminal attribution, first-phase fallback, `unknown` when absent | TC-SPEND-010, TC-SPEND-011, TC-SPEND-012 | Covered |
| DM-3 — Amplification definition (v0) | Paid/progress/ratio, tie-break, zero-progress null, named events with window and tokensWasted, deterministic sort, closed single-entry cause | TC-SPEND-001, TC-SPEND-014, TC-SPEND-015, TC-SPEND-016, TC-SPEND-017, TC-SPEND-019 | Covered |
| DM-4 — Restart count definition | `max(0, N−1)` over the union of run identities across both families; capture-reached evidence basis disclosed | TC-SPEND-013, TC-SPEND-018, TC-SPEND-019 | Covered |
| DM-5 — Error-table delta | New `spend` domain kind with exactly one row (`spend.telemetry-absent`, user, non-retryable, `not_landed`, `user-validation` → 1); all other outcomes unchanged | TC-SPEND-007, TC-SPEND-008, TC-SPEND-009, TC-SPEND-012, TC-SPEND-025, TC-SPEND-026 | Covered |
| DM-6 — Status digest delta | Section 8 real section with state, counts, evidence (`state-log`; `read`/`observed-empty`/`failed`), bounded summary; placeholder line removed; `placeholderSectionCount` 1; derivation row updated; brief unchanged | TC-SPEND-027, TC-SPEND-028, TC-SPEND-029, TC-SPEND-030 | Covered |

### 3.3 Non-Functional Coverage (NFR-#)

| NFR | Requirement (threshold) | TC ID(s) | Status |
|-----|--------------------------|----------|--------|
| NFR-1 | Machine ≤ 64 KiB; human ≤ 200 lines and ≤ 16 KiB; UTF-8 byte measurement; deterministic truncation dropping trailing `perAgent[]`/`perPhase[]` first with a recorded marker | TC-SPEND-021, TC-SPEND-022 | Covered |
| NFR-2 | Byte-identical render for identical store content, injected clock and run-id; zero model calls; deterministic ordering keys | TC-SPEND-016, TC-SPEND-022 | Covered |
| NFR-3 | Zero state writes, zero fence acquisitions, zero harness-store reads; every read verified; wrong-kind/malformed records classify through `state.*`, never a zeroed sum | TC-SPEND-002, TC-SPEND-006, TC-SPEND-008, TC-SPEND-032 | Covered |
| NFR-4 | p95 ≤ 500 ms at 1,000 records and ≤ 2 s at 10,000; no network | TC-SPEND-024 | Covered by bounded work in CI plus a non-CI reference measurement (GAP-2) |
| NFR-5 | Statistics and identity references only; no prompt text, message bodies, transcripts, diffs, tool output, credential material | TC-SPEND-023 | Covered |
| NFR-6 | Machine and documented error tables agree bidirectionally; no exit-code literals outside the CLI projection module | TC-SPEND-002, TC-SPEND-009 | Covered |
| NFR-7 | Every reporting path proven on fixture-seeded stores; zero network, zero live harness stores, zero live credentials | TC-SPEND-006, TC-SPEND-024, TC-SPEND-032 | Covered |

### 3.4 Gap Check (coverage-matrix integrity)

- **Uncovered ACs**: none. All 19 are mapped; none carries a TODO.
- **Orphan TCs**: none. Every TC names at least one AC, DM, or NFR in §5.1 and §5.2.
- **Uncovered NFRs**: none. NFR-4's wall-clock half is explicitly reference-only (GAP-2); its CI-verifiable bounded-work half is asserted.
- **Uncovered DMs**: none (DM-1..DM-6 all mapped).
- **Intentional duplicate coverage**: AC-F1-1 spans three TCs because the arithmetic, the degradation accounting, and the capture-family warning retention are separate failure modes; AC-F2-1 spans three because the fold, the absence-of-probe, and the runtime read-only posture fail independently; AC-F5-1/2 span the healthy anchor, the event matrix, the tie-break, and the permutation oracle because a formula can be right on one fixture and wrong on another; AC-F8-1 spans two because the section content and the single-fold parity are distinct guarantees.
- **Spec-named behaviour bound to an existing AC/NFR** (no dedicated AC by design):

| Behaviour | Spec source | Bound AC/NFR | Where |
|---|---|---|---|
| Undeclared flag → `fallback.invocation` (exit 1); unexpected positional → `input.value.rejected` (exit 1) | AC-F6-1 + delivered CLI parser convention | AC-F6-1, AC-F7-1 | TC-SPEND-025 |
| Records preceding the first transition attribute to the first transitioned phase | DM-2 | AC-F3-1 | TC-SPEND-010 |
| Boundary stamps (record exactly on a `complete`/`reopen`) resolve deterministically | DM-2 (window semantics) | AC-F3-1, NFR-2 | TC-SPEND-010 (TP-DEC-2) |
| `--phase` scopes the whole report, including the amplification block | F-3 + AC-F3-3 "scoped selection" | AC-F3-3, AC-F5-3 | TC-SPEND-012 (TP-DEC-6, OQ-T4) |
| A capture-outcome-only run counts toward restarts, contributes zero paid, raises no event | TDR-0011 boundary pin | AC-F4-1, AC-F5-3 | TC-SPEND-019 |
| An unreadable transitions payload classifies; only *absent* transitions fall back to `unknown` | AC-F2-3 "never a partial report served as truth" | AC-F2-3, AC-F3-2 | TC-SPEND-008 (TP-DEC-7) |
| Audit-seam write failure is a diagnostic and never changes outcome/exit | §10 | NFR-3, AC-F7-1 | TC-SPEND-032 |
| The digest and the command share one fold | §1, F-8 | AC-F8-1, DM-6 | TC-SPEND-030 |

## 4. Test Types and Layers

| Layer | Runner / invocation | Location | Covers |
|-------|--------------------|----------|--------|
| Contract and vocabulary | `bun test tests/structure` | `tests/structure/spend-contract.test.ts`; `tests/structure/error-table.test.ts` (update) | TC-SPEND-001, 009 |
| Boundary, purity and confinement | `bun test tests/structure tests/boundaries`; `bun run scripts/checks/{ambient-globals,exit-code-literals,forbidden-literals,workspace-entrypoints}.ts` | `tests/structure/spend-imports.test.ts`, `tests/structure/content-inventory.test.ts` (update) | TC-SPEND-002, 032 (static half) |
| Error identity and sync | `bun test tests/structure tests/checks`; `bun run scripts/checks/error-table-sync.ts` | `tests/checks/error-table-sync.test.ts` (update) | TC-SPEND-009 |
| Behaviour — read side and breakdown | `bun test tests/behaviour` | `tests/behaviour/spend-{read-contract,breakdown,degradation,cost-omission}.test.ts` | TC-SPEND-003, 004, 005, 006, 033 |
| Behaviour — absence and store damage | `bun test tests/behaviour` | `tests/behaviour/spend-{absent,store-damage}.test.ts` | TC-SPEND-007, 008 |
| Behaviour — phase attribution | `bun test tests/behaviour` | `tests/behaviour/spend-phase-{attribution,fallback,filter}.test.ts` | TC-SPEND-010, 011, 012 |
| Behaviour — restarts and amplification | `bun test tests/behaviour` | `tests/behaviour/spend-{restarts,run-substrate,amplification-healthy,amplification-events,amplification-determinism,amplification-null,disclosure}.test.ts` | TC-SPEND-013..019 |
| Behaviour — surface, grammar and boundaries | `bun test tests/behaviour` | `tests/behaviour/spend-{envelope,bounds,determinism,privacy,grammar,ref-resolution,readonly}.test.ts` | TC-SPEND-020..023, 025, 026, 032 |
| Golden | `bun test tests/golden` | `tests/golden/spend.test.ts` (new) | TC-SPEND-018, 021, 022 |
| Behaviour — digest flip | `bun test tests/behaviour tests/golden` | `tests/behaviour/status-{spend-section,spend-degraded,spend-parity,placeholders,corpus}.test.ts`; `tests/golden/status-digest.test.ts` (update) | TC-SPEND-027..030 |
| Mutant meta-suite | `bun test tests/checks` | `tests/checks/spend-mutants.test.ts` | TC-SPEND-034 |
| Performance | `bun test tests/behaviour` | `tests/behaviour/spend-performance.test.ts` | TC-SPEND-024 |
| Documentation/help surface | Manual + static content check | `doc/spec/features/feature-spend.md`, man-page pack, `--help` golden | TC-SPEND-031 |
| Aggregate and non-regression | `pnpm check` | repo root; unchanged gates (`lint → format:check → typecheck → test → check:boundaries`) | All TCs (regression half) |

### 4.1 Fixture and Harness Contract (binding for every spend TC)

1. **No real harness, network, credential, or user state directory.** Every suite imports production modules and injects fakes plus a per-test temp root. No suite opens a harness store, reads `$HOME`, resolves a credential, or opens a socket.
2. **One temp state store per case.** `tests/fixtures/state/harness.ts` supplies `makeTempRoot`, `makeIdentity`, `openStore`, `withinFence`, and `ledgerBytes`. Telemetry is seeded by composing the delivered append path (`appendHarnessTelemetry`, `appendHarnessCaptureOutcome` from `packages/core/src/state/harness-telemetry.ts`) or by seeding equivalent records through the delivered boundary, so the fold always reads records the production writer could have produced. Transition history is seeded through the delivered registry append path.
3. **Recording read seam.** The spend runtime receives an injected state port and an injected "harness adapter / telemetry composer" seam. Both record every call (family, key, ref, argument shape). `--ref` default resolution receives an injected local-context read that records the same way.
4. **Injected time, ids and brand.** `NOW_MS = Date.UTC(2026, 10, 7, 9, 0, 0)`; captured-at stamps are literal fixture constants, never `Date.now()`; `newRunId` is a fixed sequence; the brand is `SYNTHETIC_BRAND`; the clock injected into the command is a fixed value. Run ids in ordering fixtures are deliberately **non-time-sortable** (`run-zeta`, `run-alpha`, `run-7`) so a run-id-sortability assumption fails.
5. **Independent arithmetic oracle.** Expected `tokensByClass`, `restarts`, `paid`, `progress`, `ratio`, `share` and `tokensWasted` are computed in the test from the fixture definition's hand-written constants — never by calling the production fold, and never by summing the same array the production code sums.
6. **Recorded arguments over inference.** Where an AC concerns what a seam receives (which family was read for which ref, whether a fence was acquired, whether a spawn occurred), the test asserts the recorded argument or the recorded absence.
7. **Temp roots only.** Goldens, mutant copies and whole-tree scans use `mkdtemp` under the OS temp directory or committed read-only fixtures. The live tree and the user's real state directory are never written.

### 4.2 Non-Vacuity Contract (binding for every absence, damage, refusal, bound and formula case)

1. **A planted positive is asserted before the absence.** Before asserting zero harness-store reads, the test asserts the fixture produces non-zero spend through the state seam; before asserting `spend.telemetry-absent`, a paired control with one seeded record renders a report; before asserting truncation, an under-cap render is asserted untruncated.
2. **A paired live control runs in the same test.** Every absent case beside a present case; every damaged store beside a repaired store; every refusal beside the accepted invocation; every degenerate numeric case beside the healthy anchor; every over-cap bound beside the at-cap and under-cap cases.
3. **A disabling mutant must fail the suite.** Temp mutant copies of the production module (the `tests/golden/redaction.test.ts` import pattern) disable one rule each: fabricate a null class to zero; union only session-group runs; raise an event for the progress run; drop an event; clamp the ratio to 1; sort events by run id; read the harness adapter; truncate silently; render a zero-spend claim from a failed digest read. Each mutant must produce the prohibited observable while the fixture is unchanged; if the real module also produced nothing, the suite fails.
4. **Permutation invariance is asserted, not assumed.** The same record set appended in shuffled order must render byte-identical output; a fixture whose expected result depends on append order fails.
5. **Bounds are measured, never assumed.** Byte bounds are measured on the serialized UTF-8 bytes with a positive measured length asserted first (non-vacuity floor), and line bounds by counting rendered lines.
6. **No assertion depends on a moving base.** Every assertion reads the current tree, a committed fixture, or an isolated temp copy; no `git diff` against `origin/main-tools` appears in the permanent suite (testing strategy §4).

### 4.3 Amplification Oracle Matrix (binding for AC-F5-1, AC-F5-2, AC-F5-3 and TDR-0011)

All token figures are fixture-definition constants; the test recomputes them independently. `paid` is the five-class sum over all captured session-group records for the ref; `progress` is the latest record-bearing run's sum. Run ids in tie fixtures are opaque and not time-sortable.

| ID | Fixture shape | Paid | Progress run / tokens | Ratio | Events | Restarts | Asserts |
|---|---|---|---|---|---|---|---|
| A-01 | One record-bearing run `R1`, 3 groups, five-class sum 185 | 185 | `R1` / 185 | exactly `1` | `[]` | 0 | Healthy anchor is exact, not approximate (AC-F5-1); no fabricated event |
| A-02 | Four record-bearing runs `R1..R4` = 5,000,000 / 3,000,000 / 2,000,000 / 1,200,000 | 11,200,000 | `R4` / 1,200,000 | `11.2M ÷ 1.2M` (≈ 9.333…) | 3, for `R1`, `R2`, `R3` | 3 | One event per superseded positive-spend run; windows and `tokensWasted` exact; deterministic sort (AC-F5-2) |
| A-03 | Two runs with identical `capturedAt`; ids `run-alpha`, `run-zeta` (and reversed insertion order) | per fixture | `run-alpha` (ascending run-id tie-break) | per fixture | the other run | 1 | Tie-break is captured-at desc, run-id **asc** — a descending-tie-break mutant changes the progress run and fails (TDR C-4) |
| A-04 | `R1` = 400 tokens; `R2` (latest) present with all five classes zero | 400 | `R2` / 0 | `null` | 1, for `R1` | 1 | Zero-progress null rule; the run is named in the human report; events and null coexist (AC-F5-3) |
| A-05 | Two runs, every class null or zero across both (records exist) | 0 | latest run / 0 | `null` (TP-DEC-1) | `[]` | 1 | Degenerate `paid = 0 ∧ progress = 0` is a success report, never `telemetry-absent`, never 1, never a crash (GAP-5) |
| A-06 | Session runs `R1`, `R2`; a capture outcome for `R3` with no records | `R1+R2` | `R2` | per fixture | 1, for `R1` | 2 | Capture-outcome-only run counts toward restarts, adds zero paid, raises no event (TDR boundary pin) |
| A-07 | `R1` positive, `R2` all-zero, `R3` latest positive | `R1+R3` | `R3` | per fixture | 1, for `R1` only | 2 | A superseded run with zero spend raises no event |
| A-08 | One run identity present in both families (same `runId`) | per fixture | that run | 1 | `[]` | 0 | Union de-duplicates identities; N is a set size, not a record count |
| A-09 | Store with no captured records for the ref | — | — | — | — | — | `spend.telemetry-absent`, exit 1 — not `ratio: 1`, not zeros (TC-SPEND-007) |
| A-10 | A-02 records appended in a shuffled order (same stamps and ids) | 11,200,000 | `R4` | same as A-02 | same as A-02 | 3 | Permutation invariance; byte-identical output |
| A-11 | Capture-outcome record only (one run identity, no session-group records) | 0 | none (no record-bearing run) | `null` | `[]` | 0 | Presence is decided by the family pair; no invented progress run; `null` rather than 1 or a failure |

**Window construction oracle (A-02, per TDR-0011 pin 4).** For an event on run *k*: `window.start` = the previous record-bearing run's `capturedAt`; for the first record-bearing run `window.start` = the earliest `phase.transition` timestamp, or the run's own `capturedAt` (a point window) when no transitions exist; `window.end` = run *k*'s `capturedAt`. `tokensWasted` = run *k*'s five-class sum. `cause` is exactly `restart-loop prefill re-pay`. Events sort by `window.start` then run id. The progress run never raises an event.

### 4.4 Phase Attribution Window Matrix (binding for AC-F3-1, AC-F3-2)

`T0 < T1 < T2 < T3` are literal transition timestamps; `+Δ` is a record stamp. TP-DEC-2: a record whose stamp equals a `complete` timestamp attributes to the completing phase (window end inclusive); a record whose stamp equals a `reopen` timestamp attributes to the reopened phase (window start inclusive); when a `complete` and a `reopen` share a stamp, the `reopen` wins (the phase is open at that instant) and the tie is asserted explicitly.

| ID | Transition history | Record stamps | Expected attribution |
|---|---|---|---|
| P-01 | `clarify_scope` complete `T0`; `specification` complete `T1`; `delivery_planning` complete `T2` | `T0−1h` | `clarify_scope` (pre-first-transition rule) |
| P-02 | as P-01 | `T0+1h` | `specification` (window opened by clarify's completion, closed at `T1`; one entry, calls/tokens summed) |
| P-03 | as P-01 | exactly `T1` | `specification` (complete stamp closes its own window) |
| P-04 | as P-01 | `T2+1h` | `delivery_planning` (terminal attribution after the final transition) |
| P-05 | `delivery_planning` reopen at `T2a` after its complete at `T2` | exactly `T2a` | `delivery_planning` (reopen stamp reopens the same window) |
| P-06 | `delivery_planning` complete `T2`, reopen `T2a`, complete `T3` | `T2+1h`, `T2a+1h` | both `delivery_planning`; one `perPhase[]` entry per phase id, both windows aggregated |
| P-07 | no transitions at all | any | every record in the single named `unknown` entry; the human digest names the fallback |
| P-08 | as P-01, total tokens 900 split 300/300/300 | — | `share` integers floor at 33 each (sum 99, not forced to 100) |
| P-09 | transitions exist but every window precedes the records (all spend terminal) | records after `T2` | one phase entry carrying all spend; `share` 100 |
| P-10 | records exist, total tokens 0 after null exclusion | — | `share` 0 for the single entry (TP-DEC-3); no division error |
| P-11 | transitions payload corrupt/torn | any | classified `state.*` failure, exit 2 — never silent `unknown` fallback (TP-DEC-7) |
| P-12 | `--phase specification` with P-02 records | — | scoped report: one phase entry, scoped `tokensByClass`, calls, `perAgent`, and amplification subset (TP-DEC-6) |
| P-13 | `--phase deployment` (out of vocabulary) | — | `input.value.rejected`, exit 1, zero reads |
| P-14 | `--phase quality_gates` (canonical, empty window) | — | `spend.telemetry-absent` naming the phase, exit 1 |

### 4.5 Read, Absence and Store-Damage Matrix (binding for AC-F2-1, AC-F2-2, AC-F2-3)

| ID | Store / read condition | Expected outcome | Exit | Never |
|---|---|---|---|---|
| R-01 | Verified-empty store (no frames) | `spend.telemetry-absent` naming the ref, with remediation hinting capture prerequisites | 1 | An empty success, a zero report, or `state.store.torn` |
| R-02 | Store with records but none under either telemetry key for the ref | `spend.telemetry-absent` naming the ref | 1 | Cross-ref leakage or zeros |
| R-03 | Records exist for a different ref only | `spend.telemetry-absent` for the selection; other-ref totals appear nowhere | 1 | Scoping by prefix match instead of exact key |
| R-04 | Framing tear / unreadable store file | `state.store.torn` with store path and record position | 2 | A partial or zeroed report |
| R-05 | Schema version mismatch | `state.schema.mismatch` | 2 | Silently ignoring the store |
| R-06 | Unknown record kind under a telemetry key prefix | `state.store.torn` (delivered wrong-kind rule) naming the position | 2 | Skipping the record and serving a partial sum |
| R-07 | Malformed telemetry payload (missing field, negative or non-integer `calls`) | `state.store.torn` naming the record position | 2 | Coercing defaults to zero |
| R-08 | Permission violation on the store path | `state.permission.denied` with its delivered `user-validation` projection | 1 | Re-projecting to exit 2 or inventing a row |
| R-09 | Transitions payload corrupt (telemetry readable) | the delivered state identity for the registry read | 2 | Silent `unknown` attribution (TP-DEC-7) |
| R-10 | Harness adapter / harness-store seam reachable but never called | zero recorded calls on every invocation path; the spend control still renders | 0 | Any probe, fallback, or "best effort" re-query |

### 4.6 Exit and Identity Oracle (binding for AC-F7-1)

| Condition | Identity | Category | Retryable | Consequence | Projection class | Exit | TC |
|---|---|---|---|---|---|---|---|
| No captured telemetry for the selection (including an empty phase window) | `spend.telemetry-absent` | user | false | not_landed | user-validation | 1 | 007, 012 |
| Malformed ref shape; unresolvable active context; out-of-vocabulary phase; unexpected positional | `input.value.rejected` | user | false | not_landed | user-validation | 1 | 012, 025, 026 |
| Undeclared flag | `fallback.invocation` | user | false | unknown | user-validation | 1 | 025 |
| Permission violation on the store read | `state.permission.denied` | user (delivered) | false | not_landed | user-validation (delivered) | 1 | 008 |
| Torn store / wrong kind / malformed payload | `state.store.torn` | platform | false | not_landed | platform-provider | 2 | 008 |
| Unsupported store schema | `state.schema.mismatch` | platform | false | not_landed | platform-provider | 2 | 008 |
| Unknown store condition | `state.store.unknown` | platform | false | not_landed | platform-provider | 2 | 008 |
| Success (reported, including the degenerate all-zero report) | — | — | — | — | success | 0 | 003..006, 010..024 |
| Unclassifiable handler failure / kind-only `spend` | `fallback.internal` | platform | false | unknown | platform-provider | 2 | 009 |

**Invariants.** Exit is a pure function of the projection class (`success` 0, `user-validation` 1, `platform-provider` 2). The one new row is the only new row; no delivered row's category, consequence, or projection changes (DEC-7). `spend.telemetry-absent` is never reused for store damage, and store damage is never re-projected. Machine consumers branch on the code, never the exit alone; both the machine table and the documented table carry exactly this row.

### 4.7 CLI Grammar Matrix (binding for AC-F6-1)

| ID | Invocation | Expected outcome | Exit | Reads before outcome |
|---|---|---|---|---|
| L-01 | `spend --ref GH-236` | success report | 0 | ≥ 1 state read, 0 harness reads |
| L-02 | `spend` with the active local context = `GH-236` | identical report to L-01 | 0 | local-context read, then state reads |
| L-03 | `spend` with no resolvable active context | `input.value.rejected` naming the missing context | 1 | 0 |
| L-04 | `spend --ref gh-236` | `input.value.rejected` (case-sensitive canonical shape) | 1 | 0 |
| L-05 | `spend --ref "GH-236 "` / `spend --ref "GH236"` | `input.value.rejected` | 1 | 0 |
| L-06 | `spend --ref GH-236 --phase delivery` | success, phase-scoped report | 0 | ≥ 1 |
| L-07 | `spend --ref GH-236 --phase Delivery` / `--phase deployment` | `input.value.rejected` naming the canonical vocabulary | 1 | 0 |
| L-08 | `spend --ref GH-236 --phase` (missing value) | `input.value.rejected` | 1 | 0 |
| L-09 | `spend --ref` (missing value) | `input.value.rejected` | 1 | 0 |
| L-10 | `spend --ref GH-236 extra` | `input.value.rejected` (unexpected positional) | 1 | 0 |
| L-11 | `spend --ref GH-236 --bogus` | `fallback.invocation` (undeclared flag) | 1 | 0 |
| L-12 | `spend --ref GH-236 --amplification` | success; human amplification section present | 0 | ≥ 1 |
| L-13 | `spend --ref GH-236 --json` | success; envelope only, no human digest | 0 | ≥ 1 |
| L-14 | `spend --ref GH-236 --amplification --json` | success; envelope carries `amplification`; no human section | 0 | ≥ 1 |
| L-15 | `spend --json --ref GH-236` on a telemetry-absent store | `spend.telemetry-absent`, error-only envelope | 1 | state reads only |

### 4.8 Prohibited Test Dependencies (explicit)

- **No real harness store, session database, provider, or model.** The adapter/composer seam is an injected spy that fails the test if called.
- **No real network, credential, or host state.** No suite resolves a credential, reads `$HOME`, or opens a socket.
- **No wall clock for correctness.** Every captured-at stamp is a literal; the only timing is the soft local budget and the non-CI reference measurement of TC-SPEND-024.
- **No moving-base diff.** Every assertion reads the current tree, a committed fixture, or an isolated temp copy.
- **No real content in fixtures.** Committed fixtures carry synthetic refs, ids, agent/model names, counts and windows only; the privacy canary is fabricated.
- **No Windows ACL claim.** Permission assertions are POSIX-only.
- **No goldens rewritten by the suite.** Spend and digest goldens are regenerated deliberately once in this change, reviewed, and byte-compared; the suite never rewrites them (testing strategy §4).

### 4.9 Test-Plan Pins (recorded so delivery cannot silently choose)

| Pin | Statement | Basis | Confirmation |
|---|---|---|---|
| TP-DEC-1 | `paid = 0 ∧ progress = 0` (records exist, every class null/zero) reports `ratio: null`, names the zero-progress run, and discloses the degraded records in `degradation`; never `1`, never `0`, never a failure. AC-F5-1's exact-1 anchor is scoped to a single **positive-spend** record-bearing run. | TDR-0011 Unresolved Questions delegates this case to test-plan time; null is the only value that does not claim health from zero evidence | OQ-T1 (§8.3) |
| TP-DEC-2 | Boundary attribution: a record at a `complete` stamp belongs to the completing phase; at a `reopen` stamp, to the reopened phase; when both share a stamp, the `reopen` wins. | DM-2 window semantics + NFR-2 determinism | OQ-T3 |
| TP-DEC-3 | `share` = floor(phase tokens × 100 ÷ total tokens); total tokens 0 → every share 0. Shares may not sum to 100. | DEC-9 integer percentages | — |
| TP-DEC-4 | One `perPhase[]` entry per phase id, aggregating all its windows (a `complete → reopen → complete` phase is one entry). | DM-1 entry shape names a phase, not a window | — |
| TP-DEC-5 | Declared total orders: `perAgent[]` by tokens desc, then agent asc, then model asc; `perPhase[]` by window start asc, then phase id asc (`unknown` last). Truncation drops from the declared tail and records the marker. The exact keys live in one contract constant; the invariants (total, permutation-invariant, tail-drop, marker recorded) are what the suite pins. | NFR-1/NFR-2 + DM-1 | OQ-T5 |
| TP-DEC-6 | `--phase` scopes the whole report — one selection, one fold — so `tokensByClass`, calls, `perAgent[]`, `perPhase[]` and the amplification block all derive from the phase-attributed subset. | F-3 "restricts the report to one phase's attribution window"; AC-F3-3 "scoped selection" | OQ-T4 |
| TP-DEC-7 | An unreadable transitions payload classifies through its state identity; only an **absent** transition history falls back to the named `unknown` window. | AC-F2-3 (never a partial report served as truth) + AC-F3-2 (fallback is for absence) | — |
| TP-DEC-8 | `degradation` counts warnings from both telemetry families, so a capture-outcome `session-capture-failed` cannot vanish; `records` counts the telemetry records bearing those warnings. No warning is dropped. | DM-1 "records with warnings … by closed warning vocabulary"; F-1 disclosure intent | OQ-T6 |
| TP-DEC-9 | `delivery.spend.v1` is a declared contract constant, not a `data` key (DM-1's key set is exhaustive). | DM-1 + GH-232 GAP-T7 precedent | — |

## 5. Test Scenarios

### 5.1 Scenario Index

| TC ID | Title | Type | Tier | Automation | Priority | AC Coverage |
|-------|-------|------|------|------------|----------|-------------|
| TC-SPEND-001 | `delivery.spend.v1` contract shape and closed vocabularies | Contract | Structure | Automated | Critical | AC-F1-1, AC-F5-2, AC-F6-2, DM-1, DM-3 |
| TC-SPEND-002 | Tier, boundary, purity and inventory confinement | Regression | Static | Automated | Critical | AC-F2-1, NFR-3, NFR-6 |
| TC-SPEND-003 | Per-ticket five-class breakdown and agent/model roll-ups | Happy Path | Behaviour | Automated | Critical | AC-F1-1, AC-F2-1, AC-F4-1 |
| TC-SPEND-004 | Null classes excluded, never fabricated; degradation by reason | Edge Case | Behaviour | Automated | Critical | AC-F1-1 |
| TC-SPEND-005 | Cost is never aggregated and never rendered | Negative | Behaviour | Automated | High | AC-F1-2 |
| TC-SPEND-006 | Log-only read contract and zero harness-store reads | Regression | Behaviour | Automated | Critical | AC-F2-1, NFR-3, NFR-7 |
| TC-SPEND-007 | Telemetry-absent is a first-class classified outcome | Negative | Behaviour | Automated | Critical | AC-F2-2, DM-5 |
| TC-SPEND-008 | Store damage reuses delivered state identities and exits | Negative | Behaviour | Automated | Critical | AC-F2-3, DM-5, NFR-3 |
| TC-SPEND-009 | One `spend` error row, exit projection and table sync | Regression | Contract + Check | Automated | Critical | AC-F7-1, DM-5, NFR-6 |
| TC-SPEND-010 | Capture-time phase attribution and terminal rule | Happy Path | Behaviour | Automated | Critical | AC-F3-1, DM-2 |
| TC-SPEND-011 | No transitions → the named `unknown` window | Edge Case | Behaviour | Automated | Critical | AC-F3-2, DM-2 |
| TC-SPEND-012 | `--phase` scoping and refusals before any read | Negative | Behaviour | Automated | Critical | AC-F3-3, AC-F2-2, AC-F6-1 |
| TC-SPEND-013 | Restart count over the union of run identities | Happy Path | Behaviour | Automated | Critical | AC-F4-1, DM-4 |
| TC-SPEND-014 | Healthy single-run amplification reads exactly 1 | Happy Path | Behaviour | Automated | Critical | AC-F5-1, DM-3 |
| TC-SPEND-015 | Amplification events: one per superseded run, named and quantified | Happy Path | Behaviour | Automated | Critical | AC-F5-2, DM-3 |
| TC-SPEND-016 | Tie-break, ordering and no-clock determinism of the formula | Edge Case | Behaviour | Automated | Critical | AC-F5-1, AC-F5-2, NFR-2 |
| TC-SPEND-017 | Zero-progress null rule and the degenerate zero-paid case | Corner Case | Behaviour | Automated | Critical | AC-F5-3, DM-3 |
| TC-SPEND-018 | Honesty limits carried in the report's own terms | Regression | Behaviour + Golden | Automated | Critical | AC-F5-3, AC-F4-1 |
| TC-SPEND-019 | Restarts and amplification share one run substrate | Corner Case | Behaviour | Automated | Critical | AC-F4-1, AC-F5-3, DM-4 |
| TC-SPEND-020 | Envelope data shape, mode emphasis and rendering contract | Happy Path | Behaviour | Automated | Critical | AC-F6-2, DM-1 |
| TC-SPEND-021 | Bounded output with declared deterministic truncation | Edge Case | Behaviour + Golden | Automated | Critical | NFR-1, DM-1 |
| TC-SPEND-022 | Byte-identical double render with zero model calls | Regression | Behaviour + Golden | Automated | Critical | AC-F6-3, NFR-2 |
| TC-SPEND-023 | Privacy: statistics and identity references only | Regression | Behaviour | Automated | Critical | NFR-5, AC-F1-1 |
| TC-SPEND-024 | Fold latency and bounded work at 1,000 / 10,000 records | Performance | Behaviour | Automated | Medium | NFR-4, NFR-7 |
| TC-SPEND-025 | Locked grammar: declarations, unknown flags, positionals | Negative | Behaviour | Automated | Critical | AC-F6-1 |
| TC-SPEND-026 | Ref resolution: explicit shape and active-context default | Negative | Behaviour | Automated | Critical | AC-F6-1, AC-F3-3 |
| TC-SPEND-027 | Digest section 8 becomes `observed` with spend evidence | Happy Path | Behaviour + Golden | Automated | Critical | AC-F8-1, DM-6 |
| TC-SPEND-028 | Digest verified-empty and failed-read projections | Negative | Behaviour | Automated | Critical | AC-F8-2, DM-6 |
| TC-SPEND-029 | Digest invariants: placeholder count, actionable, brief | Regression | Behaviour + Check | Automated | Critical | AC-F8-3, DM-6 |
| TC-SPEND-030 | One fold, two surfaces: command and digest agree | Regression | Behaviour | Automated | Critical | AC-F8-1, DM-6 |
| TC-SPEND-031 | Documentation and help-surface reconciliation | Regression | Manual + Static | Semi-automated | High | AC-F6-1, AC-F5-3, AC-F8-1, RSK-6 |
| TC-SPEND-032 | Read-only execution: zero writes, fences, spawns, network | Regression | Behaviour | Automated | Critical | AC-F2-1, NFR-3 |
| TC-SPEND-033 | Capture-outcome warnings never vanish from degradation | Corner Case | Behaviour | Automated | Important | AC-F1-1, DM-1 |
| TC-SPEND-034 | Mutant sensitivity of every pinned oracle | Regression | Check | Automated | Critical | AC-F5-1, AC-F5-2, AC-F5-3, AC-F2-1, NFR-1, NFR-3 |

`TC-SPEND-*` is a new prefix with no prior use in this repository; no existing TC identifier is reused for a different scenario.

### 5.2 Scenario Details

#### TC-SPEND-001 - `delivery.spend.v1` contract shape and closed vocabularies

**Scenario Type**: Regression
**Impact Level**: Critical
**Priority**: High
**Related IDs**: F-1, F-5, F-6, F-7, DM-1, DM-3, DM-5, AC-F1-1, AC-F5-2, AC-F6-2
**Test Type(s)**: Contract, Static
**Automation Level**: Automated
**Target Layer / Location**: `tests/structure/spend-contract.test.ts`; `packages/core/src/contracts/spend.ts`
**Tags**: @backend

**Preconditions**:

- The new spend contracts module exists and is exported through `@delivery-os/core/contracts`.
- A TypeScript AST parser is available (the `tests/structure/status-contract.test.ts` pattern).

**Steps**:

1. Parse the module and assert every top-level statement is a type alias, interface, `import type`, `export`, or `as const` declaration; zero executable statements, function bodies, `new`, or calls.
2. Assert the data contract declares exactly the six keys `tokensByClass`, `perPhase[]`, `perAgent[]`, `restarts`, `amplification`, `degradation`, and that `delivery.spend.v1` is a declared constant rather than a `data` field (TP-DEC-9).
3. Assert `tokensByClass` is typed over the five delivered classes **reused by reference** from `HARNESS_TOKEN_CLASSES` — not re-declared — so class drift is impossible.
4. Assert `perPhase[]` entries carry `phase`, `calls`, `tokens`, `share`; `perAgent[]` entries carry `agent`, `model`, `calls`, `tokens`; `degradation` carries `records` and `byReason` keyed over the closed `HARNESS_WARNING_REASONS`; `restarts` is a non-negative integer.
5. Assert `amplification` is `{ratio: number | null, events[]}` with events `{cause, window, tokensWasted}` and the cause vocabulary is exactly `["restart-loop prefill re-pay"]`.
6. Assert no `cost`, `currency`, `paid`, `progress`, `schemaVersion`, or free-form prose key exists in the data shape (DM-1 exactness + NG-7).
7. Assert the one new error code `spend.telemetry-absent` is declared once and that no other spend code exists.

**Expected Outcome**:

- Contracts are declaration-only with the exact key set, the reused five-class vocabulary, the closed single-entry cause vocabulary, and one error code.
- Mutants that add a data key, re-declare token classes, or add a second cause fail.

**Notes / Clarifications**:

- A temp-copy mutant that widens `byReason` beyond the closed warning set, or reorders/renames a `data` key, must fail this suite.

---

#### TC-SPEND-002 - Tier, boundary, purity and inventory confinement

**Scenario Type**: Regression
**Impact Level**: Critical
**Priority**: High
**Related IDs**: F-2, F-6, AC-F2-1, NFR-3, NFR-6
**Test Type(s)**: Static, Contract
**Automation Level**: Automated
**Target Layer / Location**: `tests/structure/spend-imports.test.ts`, `tests/boundaries/**`, `tests/structure/content-inventory.test.ts` (update), `scripts/checks/{ambient-globals,exit-code-literals,forbidden-literals,workspace-entrypoints}.ts`
**Tags**: @backend

**Preconditions**:

- The spend contracts, pure fold module, command definition and edge composition exist.
- The boundary fixture registry, the content inventory and the forbidden-literal registry are current.

**Steps**:

1. Assert the contracts module and the pure fold module import only contracts/domain/own modules: no `node:*`, no `bun:*`, no adapters, no CLI, no `process`, `fetch`, or timers.
2. Assert zero runtime conditionals in contracts and zero I/O members in the fold; assert the fold receives records as arguments rather than reading a store.
3. Assert the command path's only I/O is the injected state port plus the injected local-context read; no harness adapter, session reader, or provider client appears in the graph.
4. Assert no new package, subpath, or dependency; run `workspace-entrypoints` and confirm the declared edge set is unchanged.
5. Assert `content-inventory.json` lists every new source file with its allowed exports and no file gained an executable allowance it did not declare.
6. Run `exit-code-literals` and assert no exit-code literal exists outside the CLI projection module; run `forbidden-literals` with the new operator-facing strings registered.
7. Scan the new source for hardcoded product/binary names; assert zero and assert the brand is injected.

**Expected Outcome**:

- Contracts are data-only, the fold is pure, production I/O lives only at injected seams, and the package graph, inventories and literal registries are unchanged in shape.
- Planted controls (`node:fs` in contracts, an adapter import in the fold, a forged inventory entry, a seeded forbidden literal, a bare exit literal) each fail.

---

#### TC-SPEND-003 - Per-ticket five-class breakdown and agent/model roll-ups

**Scenario Type**: Happy Path
**Impact Level**: Critical
**Priority**: High
**Related IDs**: F-1, F-4, AC-F1-1, AC-F2-1, AC-F4-1, DM-1, DM-4, NFR-5
**Test Type(s)**: Integration
**Automation Level**: Automated
**Target Layer / Location**: `tests/behaviour/spend-breakdown.test.ts`
**Tags**: @backend

**Preconditions**:

- A temp store seeded through the delivered append path with session-group records for ref `GH-236`: three groups across two runs and two (agent, model) pairs, with positive counts in all five classes and distinct `calls` values.
- The fixture definition's hand-summed expected totals are written as constants in the test file.

**Steps**:

1. Run `spend --ref GH-236`; parse the envelope and assert `data` carries exactly the six keys.
2. Assert `tokensByClass` equals the independently hand-summed five-class totals, with every value a non-negative integer.
3. Assert `perAgent[]` equals the expected roll-up: one entry per (agent, model), `calls` and `tokens` summed across all runs and sessions, ordered per TP-DEC-5.
4. Assert `restarts` matches the union-of-run-identities expectation for the fixture (DM-4) — this fixture is the cross-check for TC-SPEND-013.
5. Assert the human digest renders the same totals and the same agent/model entries in a bounded, stable form.
6. Run the same invocation through the second mode (`--json`) and assert identical `data` values.

**Expected Outcome**:

- Totals, calls and roll-ups equal the independent oracle; every group and every run contributes.
- Exit 0 with a populated (not verified-empty) report.

**Notes / Clarifications**:

- Oracle discipline: the expected numbers are fixture constants, never a second call to the fold. A mutant that groups by agent only (dropping model) or by run (splitting a group) fails.

---

#### TC-SPEND-004 - Null classes excluded, never fabricated; degradation by reason

**Scenario Type**: Edge Case
**Impact Level**: Critical
**Priority**: High
**Related IDs**: F-1, AC-F1-1, DM-1, DEC-2, NFR-3
**Test Type(s)**: Integration
**Automation Level**: Automated
**Target Layer / Location**: `tests/behaviour/spend-degradation.test.ts`
**Tags**: @backend

**Preconditions**:

- A fixture with a clean record (all five classes numeric), a record with `reasoning: null` plus an `optional-field-absent` warning, a record with `cacheWrite: null` plus `non-numeric-value`, a record with `cost: null` plus `cost-missing`, and a record carrying a tool `truncation` mark plus `truncated`.

**Steps**:

1. Run `spend --ref GH-236` and assert each class total equals the sum of **non-null** values only; assert the null classes never contribute a fabricated zero to the class totals in a way that hides the record (the record still counts toward calls and toward the classes it does carry).
2. Assert `degradation.records` equals the number of telemetry records bearing at least one warning (not the warning count).
3. Assert `degradation.byReason` equals the exact per-reason counts over the closed vocabulary, including `truncated` for the tool-truncation record.
4. Assert every `byReason` key is a member of `HARNESS_WARNING_REASONS` and no free-text reason appears.
5. Assert the human digest renders the degradation disclosure in-band and that the report is still `observed` (a degraded record is not a failure).

**Expected Outcome**:

- Null classes are excluded from sums and disclosed by reason; no class is fabricated to zero; the report succeeds.
- A mutant that substitutes `0` for a null class (inflating nothing but hiding the gap) or drops the record from `degradation` fails.

**Notes / Clarifications**:

- "Never fabricated to zero" is asserted two ways: the sums are compared with the non-null oracle, and `degradation.records` must be non-zero and name every degraded record's warning reason.

---

#### TC-SPEND-005 - Cost is never aggregated and never rendered

**Scenario Type**: Negative
**Impact Level**: Important
**Priority**: High
**Related IDs**: F-1, AC-F1-2, DM-1, NG-7
**Test Type(s)**: Integration, Contract
**Automation Level**: Automated
**Target Layer / Location**: `tests/behaviour/spend-cost-omission.test.ts`
**Tags**: @backend

**Preconditions**:

- A fixture where every record carries `cost: null` and a second fixture where every record carries a numeric `cost` with deliberately large values.
- The monetary-token scan list from the privacy suite (`$`, `USD`, `cost`, `spend.total`).

**Steps**:

1. Run `spend --ref GH-236` on the numeric-cost fixture; assert token totals are identical to the null-cost fixture (cost never enters a sum).
2. Assert neither the machine envelope nor the human digest contains a cost/currency field, a `$`-prefixed figure, or the numeric cost values from the fixture.
3. Assert the contract test's key-set assertion (TC-SPEND-001) already forbids a cost key, and assert a temp mutant that adds cost aggregation fails the suite's own key-set check.
4. Assert the null-cost fixture still reports successfully with `degradation` naming `cost-missing` (a disclosure, not a failure).

**Expected Outcome**:

- Token counts alone constitute the breakdown; cost is invisible and unused; `cost-missing` is disclosed, never zeroed or converted.

---

#### TC-SPEND-006 - Log-only read contract and zero harness-store reads

**Scenario Type**: Regression
**Impact Level**: Critical
**Priority**: High
**Related IDs**: F-2, AC-F2-1, NFR-3, NFR-7, DEC-1
**Test Type(s)**: Integration, Static
**Automation Level**: Automated
**Target Layer / Location**: `tests/behaviour/spend-read-contract.test.ts`, `tests/structure/spend-imports.test.ts`
**Tags**: @backend

**Preconditions**:

- A recording state port and a recording harness-adapter/composer seam; a temp store seeded with telemetry for `GH-236` and unrelated records for `GH-999`.
- A spy that throws if any harness-store, session-database, or provider read is attempted.

**Steps**:

1. Run `spend --ref GH-236`; assert the recorded reads are exactly the two telemetry families for `GH-236` plus that ref's transition history, each via a verified read.
2. Assert the harness-adapter/composer spy records zero calls, and the throwing spy never fires.
3. Assert totals contain no `GH-999` contribution and the `GH-999` records are never read by key.
4. Assert no provider client, credential resolution, or network module is reachable from the invocation (static import scan in the same test run).
5. Run `spend --ref GH-999` (which has no telemetry) and assert the same read set for `GH-999` and the classified absence outcome — proving the read contract holds on the absence path too.

**Expected Outcome**:

- On every invocation path the only reads are the two telemetry families and the ref's transitions; harness reads are zero by recorded observation, not by assertion of intent.
- A mutant that probes the harness adapter "just to check" fails.

**Notes / Clarifications**:

- This is the executable core of binding AC 1; the recorded absence is paired with a positive assertion that the seeded store *did* yield non-zero spend.

---

#### TC-SPEND-007 - Telemetry-absent is a first-class classified outcome

**Scenario Type**: Negative
**Impact Level**: Critical
**Priority**: High
**Related IDs**: F-2, F-7, AC-F2-2, DM-5, DEC-6, DEC-7
**Test Type(s)**: Integration
**Automation Level**: Automated
**Target Layer / Location**: `tests/behaviour/spend-absent.test.ts`
**Tags**: @backend

**Preconditions**:

- Three fixtures: (a) a verified-empty store, (b) a store with unrelated records and no telemetry for the ref, (c) the same store with one seeded telemetry record (the positive control).

**Steps**:

1. Run `spend --ref GH-236` on (a) and (b); assert the error code is exactly `spend.telemetry-absent`, category `user`, `not_landed`, exit 1.
2. Assert the summary names the selection (the ref; and the phase when `--phase` is supplied) and the remediation hints at capture prerequisites rather than at store repair.
3. Assert the envelope carries `error` only — no `data`, no zeroed `tokensByClass`, no `ratio: 1`.
4. Assert the human channel prints a diagnostic (not an empty success line) and that the scripted channel prints one line.
5. Run the positive control (c) and assert a normal report at exit 0, proving the classification is not a blanket refusal.
6. Assert `spend.telemetry-absent` is never produced for a store-damage fixture (cross-check with TC-SPEND-008) and never for a successful empty-but-present fold (A-05).

**Expected Outcome**:

- Absence is named, classified, scoped and exit-1; the positive control renders.
- A mutant that returns `[]` with zeros, or reuses `state.store.unknown`, fails.

---

#### TC-SPEND-008 - Store damage reuses delivered state identities and exits

**Scenario Type**: Negative
**Impact Level**: Critical
**Priority**: High
**Related IDs**: F-2, F-7, AC-F2-3, DM-5, NFR-3
**Test Type(s)**: Integration, Contract
**Automation Level**: Automated
**Target Layer / Location**: `tests/behaviour/spend-store-damage.test.ts`
**Tags**: @backend

**Preconditions**:

- Matrix R-04..R-09 from §4.5: framing tear, schema mismatch, unknown kind under a telemetry key, malformed payload, permission `0644`, and a corrupt transitions payload.
- A repaired-store control for every case.

**Steps**:

1. For each case, run `spend --ref GH-236` and assert the exact delivered identity (`state.store.torn`, `state.schema.mismatch`, `state.store.unknown`, or `state.permission.denied`).
2. Assert the exit follows that identity's **delivered** projection class: 2 for the platform-provider rows, 1 for permission-denied; assert no row was re-projected.
3. Assert the diagnostic carries the store path and the record position (sequence) only — no payload bytes, no token figures.
4. Assert the envelope carries `error` only; no partial `data`, no zeroed totals, no "best effort" report.
5. Assert the wrong-kind and malformed cases name the offending record position, and that a *later* valid record is not served as the answer.
6. Repair each store and re-run; assert success.

**Expected Outcome**:

- Damage fails closed through the delivered taxonomy with the delivered exits; nothing is served as truth from a damaged read.
- A mutant that skips a wrong-kind record and sums the rest fails.

**Notes / Clarifications**:

- R-09 (corrupt transitions payload) asserts TP-DEC-7: an unreadable attribution source is a classified failure, while an *absent* one is the `unknown` fallback (TC-SPEND-011).

---

#### TC-SPEND-009 - One `spend` error row, exit projection and table sync

**Scenario Type**: Regression
**Impact Level**: Critical
**Priority**: High
**Related IDs**: F-7, AC-F7-1, DM-5, NFR-6, DEC-7
**Test Type(s)**: Contract, Integration
**Automation Level**: Automated
**Target Layer / Location**: `tests/structure/error-table.test.ts` (update), `tests/checks/error-table-sync.test.ts` (update), `scripts/checks/error-table-sync.ts`, `doc/spec/features/feature-result-contract.md`
**Tags**: @backend

**Preconditions**:

- `DOMAIN_KINDS` contains `spend`; `ERROR_TABLE` contains exactly one `spend` row.
- The trigger paths from TC-SPEND-007, 008, 012, 025 and 026.

**Steps**:

1. Assert `spend` is in `DOMAIN_KINDS` and exactly one row has `domainKind: spend`, with the exact code, category `user`, `retryable: false`, `consequence: not_landed`, the `user-validation` projection class, a remediation hint at capture prerequisites, and a summary.
2. Assert `classifyDomainKind("spend")` without a code throws and contains through `fallback.internal`, never the first row.
3. Drive the row through its trigger (TC-SPEND-007) and assert the classified failure is exactly that entry; assert the exit is produced by the projection class, not by a literal.
4. Assert every other outcome in §4.6 still resolves through its delivered row, with no category, consequence, or projection change (snapshot of the delivered rows unaffected by `spend`).
5. Run the sync check green with a non-zero row count; assert the documented table carries the row once with matching columns.
6. Mutate the machine table (remove the row, change the projection) and the documented table (remove the row, change a column) in both directions; assert the check fails naming the offender. Remove `spend` from `DOMAIN_KINDS` and assert failure.
7. Run `exit-code-literals` and assert zero literals outside the projection module.

**Expected Outcome**:

- One row, exact and reachable, projected to exit 1 through `user-validation`; zero drift between machine and documented tables; no exit literal outside the projection module.
- A mutant that adds a second `spend` row, switches the projection to `platform-provider`, or adds a documented-only row fails.

---

#### TC-SPEND-010 - Capture-time phase attribution and terminal rule

**Scenario Type**: Happy Path
**Impact Level**: Critical
**Priority**: High
**Related IDs**: F-3, AC-F3-1, DM-2, DEC-4
**Test Type(s)**: Integration
**Automation Level**: Automated
**Target Layer / Location**: `tests/behaviour/spend-phase-attribution.test.ts`
**Tags**: @backend

**Preconditions**:

- Transition histories and record stamps from matrix P-01..P-10, seeded through the delivered registry append path and the delivered telemetry append path.

**Steps**:

1. For P-01..P-06, run `spend --ref GH-236` and assert each record's phase attribution matches the matrix under TP-DEC-2 boundary semantics.
2. Assert `perPhase[]` has exactly one entry per phase id (P-06 aggregates two windows of the same phase), each carrying `phase`, `calls`, `tokens`, and an integer `share`.
3. Assert `tokens` per phase equals the independently summed fixture expectation, and that the sum of phase tokens equals the total tokens (partition, not duplication).
4. Assert terminal attribution (P-04): a record captured after the final transition, including one after a reopen, attributes to the final transitioned phase.
5. Assert `share` is floored and may not sum to 100 (P-08: 33/33/33), and that total tokens 0 yields share 0 (P-10) with no division error.
6. Assert the human digest names the basis (capture-time windows) and renders one line per phase deterministically.

**Expected Outcome**:

- Every record lands in exactly one phase; the phase totals partition the spend; shares are deterministic integers.
- A mutant that attributes by run start, by the phase open at render time, or that rounds shares up fails.

---

#### TC-SPEND-011 - No transitions → the named `unknown` window

**Scenario Type**: Edge Case
**Impact Level**: Critical
**Priority**: High
**Related IDs**: F-3, AC-F3-2, DM-2
**Test Type(s)**: Integration
**Automation Level**: Automated
**Target Layer / Location**: `tests/behaviour/spend-phase-fallback.test.ts`
**Tags**: @backend

**Preconditions**:

- A store with captured telemetry for the ref and **no** `phase.transition` records at all.
- The P-01 control (transitions present) from TC-SPEND-010.

**Steps**:

1. Run `spend --ref GH-236`; assert `perPhase[]` has exactly one entry whose phase id is the literal `unknown`.
2. Assert that entry carries all the spend: total tokens equal `tokensByClass` total and calls equal the total calls; `share` is 100.
3. Assert the human digest names the attribution fallback explicitly (an operator must be able to tell "no phase evidence" from "phase zero").
4. Assert no other per-phase entry exists and no phase is invented from the record's other fields (records carry no phase field).
5. Assert the outcome is a success at exit 0 — an absent transition history is not an error and not telemetry-absent.

**Expected Outcome**:

- All spend is in one named `unknown` entry with an explicit human disclosure; the report succeeds.
- A mutant that renders `unknown` as a zero-token phase, or that fails the read, fails.

---

#### TC-SPEND-012 - `--phase` scoping and refusals before any read

**Scenario Type**: Negative
**Impact Level**: Critical
**Priority**: High
**Related IDs**: F-3, F-6, F-7, AC-F3-3, AC-F2-2, AC-F6-1, DM-2, DM-5, DEC-6
**Test Type(s)**: Integration
**Automation Level**: Automated
**Target Layer / Location**: `tests/behaviour/spend-phase-filter.test.ts`
**Tags**: @backend

**Preconditions**:

- A fixture with transitions and records spanning two canonical phases (P-12), an empty canonical phase (P-14), and a recording read seam.
- The canonical phase vocabulary from `CANONICAL_PHASE_IDS`.

**Steps**:

1. Run `spend --ref GH-236 --phase specification` (a canonical phase with records); assert the report is scoped: one `perPhase[]` entry, `tokensByClass`, calls and `perAgent[]` derived only from that window, and the amplification block computed over the same subset (TP-DEC-6).
2. Assert the scoped totals equal the independently summed window expectation and are strictly smaller than the unscoped totals.
3. Run `spend --ref GH-236 --phase quality_gates` (a canonical phase whose window holds no records); assert `spend.telemetry-absent` naming the phase, exit 1, no zeroed report.
4. Run `--phase Delivery` and `--phase deployment`; assert `input.value.rejected` naming the canonical vocabulary, exit 1.
5. Assert the recorded read seam shows **zero** reads before each refusal in steps 3 (vocabulary) and 4, and that step 3's read happened only after grammar acceptance.
6. Assert a missing `--phase` value is `input.value.rejected` with zero reads.

**Expected Outcome**:

- Scope is applied to one selection and one fold; out-of-vocabulary values refuse before any read; an empty canonical window is a named absence scoped to the phase.
- A mutant that validates the phase after reading, or ignores the filter while still printing the phase, fails.

**Notes / Clarifications**:

- TP-DEC-6 and OQ-T4 record the scoped-amplification reading; if the spec later pins amplification as global, only this TC's expected subset changes — the refusal and scope semantics do not.

---

#### TC-SPEND-013 - Restart count over the union of run identities

**Scenario Type**: Happy Path
**Impact Level**: Critical
**Priority**: High
**Related IDs**: F-4, AC-F4-1, DM-4, DEC-5
**Test Type(s)**: Integration
**Automation Level**: Automated
**Target Layer / Location**: `tests/behaviour/spend-restarts.test.ts`
**Tags**: @backend

**Preconditions**:

- Fixtures: 1 run; 3 session runs; 1 run present only as a capture outcome plus 2 session runs; the same run id in both families; 5 runs with 12 records; a capture-outcome-only store (no session-group records) as the zero-run-of-spend boundary.

**Steps**:

1. For each fixture, run the report and assert `restarts = max(0, N − 1)` for the exact union size.
2. Assert 1 run → 0 (the floor is observable here, not at −1), and that a store with **no** run identities is `spend.telemetry-absent` rather than a report whose `restarts` claims 0 (a report cannot exist without captured telemetry).
3. Assert a capture-outcome-only run raises the count (union, not session-only) while the same fixture's amplification shows no event for it (cross-check with TC-SPEND-019).
4. Assert one run id present in both families counts once.
5. Assert the count is independent of record count (5 runs / 12 records → 4) and of session count within a run.
6. Assert a capture-outcome-only store renders `restarts` from its union and is not misclassified as telemetry-absent when the outcome family carries the only run identity.
7. Assert the human digest and the machine `restarts` agree, and that the human digest discloses the capture-reached evidence basis (with TC-SPEND-018).

**Expected Outcome**:

- Restart counts are set-based over both families, floored at zero, and never derived from record or session counts.
- Mutants that union only session records, count records, or subtract 0 instead of 1 fail.

---

#### TC-SPEND-014 - Healthy single-run amplification reads exactly 1

**Scenario Type**: Happy Path
**Impact Level**: Critical
**Priority**: High
**Related IDs**: F-5, AC-F5-1, DM-3, DEC-3, TDR-0011 C-2
**Test Type(s)**: Integration
**Automation Level**: Automated
**Target Layer / Location**: `tests/behaviour/spend-amplification-healthy.test.ts`
**Tags**: @backend

**Preconditions**:

- Fixture A-01: exactly one record-bearing run, three groups, five-class sum 185, calls 4.
- The A-02 multi-run control (one run replaced by four) in the same file.

**Steps**:

1. Run `spend --ref GH-236 --amplification`; assert `amplification.ratio === 1` exactly (strict equality, not a tolerance).
2. Assert `amplification.events` is an empty array (the progress run never raises an event).
3. Assert `restarts === 0` on the same fixture.
4. Assert the human amplification section renders the ratio as 1 and states that no superseded runs exist.
5. Run the A-02 control and assert the ratio is greater than 1 with three events, proving the exact-1 result is not a constant.
6. Compute `paid` and `progress` independently from the fixture constants and assert `ratio === paid / progress`.

**Expected Outcome**:

- The healthy anchor is exactly 1 by construction, with no events and no restarts; the control moves the number.
- A mutant that clamps the ratio, returns a rounded 1.0 for a loop, or emits an event for the progress run fails.

---

#### TC-SPEND-015 - Amplification events: one per superseded run, named and quantified

**Scenario Type**: Happy Path
**Impact Level**: Critical
**Priority**: High
**Related IDs**: F-5, AC-F5-2, DM-3, DEC-3, TDR-0011 C-3
**Test Type(s)**: Integration
**Automation Level**: Automated
**Target Layer / Location**: `tests/behaviour/spend-amplification-events.test.ts`
**Tags**: @backend

**Preconditions**:

- Fixture A-02 with transitions: `clarify_scope` complete at `T0`, and four record-bearing runs at `T0+1h`, `T0+2h`, `T0+3h`, `T0+4h` with 5,000,000 / 3,000,000 / 2,000,000 / 1,200,000 tokens.
- A no-transition variant of the same run shape (point windows).

**Steps**:

1. Run the report and assert exactly three events, one per superseded record-bearing run, and none for the progress run (`R4`).
2. Assert each event's `cause` is exactly `restart-loop prefill re-pay`.
3. Assert each event's `window.start`/`window.end`: `R1` starts at the earliest transition `T0` and ends at `R1.capturedAt`; `R2` starts at `R1.capturedAt` and ends at `R2.capturedAt`; `R3` starts at `R2.capturedAt` and ends at `R3.capturedAt`.
4. Assert `tokensWasted` equals each run's independently hand-summed spend (5,000,000 / 3,000,000 / 2,000,000) and that the sum of `tokensWasted` equals `paid − progress`.
5. Assert the event order is by `window.start` then run id; assert a reversed-insertion fixture yields the identical array.
6. Assert the no-transition variant produces point windows for the first event and the same event count, and that the report succeeds.
7. Assert the human `--amplification` section names each event with its window and wasted tokens, and that the machine envelope carries the same events without the flag.

**Expected Outcome**:

- Three named, windowed, quantified events; the decomposition and the ratio agree; ordering is deterministic.
- Mutants that omit an event, add a progress-run event, shift a window by one run, or report the run total as `tokensWasted` fail.

---

#### TC-SPEND-016 - Tie-break, ordering and no-clock determinism of the formula

**Scenario Type**: Edge Case
**Impact Level**: Critical
**Priority**: High
**Related IDs**: F-5, AC-F5-1, AC-F5-2, NFR-2, TDR-0011 C-4
**Test Type(s)**: Integration
**Automation Level**: Automated
**Target Layer / Location**: `tests/behaviour/spend-amplification-determinism.test.ts`
**Tags**: @backend

**Preconditions**:

- Fixture A-03: two record-bearing runs with identical `capturedAt`, ids `run-alpha` and `run-zeta`, inserted in both orders.
- Opaque, non-time-sortable run ids (`run-zeta`, `run-alpha`, `run-7`).

**Steps**:

1. Run the report on both insertion orders; assert the progress run is the same one and that it is the lexicographically **smallest** run id among equal stamps (captured-at descending, run-id ascending).
2. Assert the resulting ratio, event list and windows are identical across the two insertion orders.
3. Shuffle the record array (A-10) and assert byte-identical output.
4. Install throwing stubs for `Date.now`, `new Date()`, `Math.random`, and a model-seam spy; re-run and assert unchanged output and zero model calls.
5. Assert the run-id tie-break never depends on a run-id format property: use ids where a time-sortable assumption would pick a different run.
6. Assert the tie-break is documented in the amplification contract (`--help`/feature page) so an operator can predict it.

**Expected Outcome**:

- One deterministic ordering rule, permutation-invariant output, no ambient clock/randomness, zero model calls.
- A descending-tie-break mutant, a first-seen-wins mutant, or a `Date.now()` read in the fold fails.

---

#### TC-SPEND-017 - Zero-progress null rule and the degenerate zero-paid case

**Scenario Type**: Corner Case
**Impact Level**: Critical
**Priority**: High
**Related IDs**: F-5, AC-F5-3, DM-3, TDR-0011 C-5, Unresolved Questions
**Test Type(s)**: Integration
**Automation Level**: Automated
**Target Layer / Location**: `tests/behaviour/spend-amplification-null.test.ts`
**Tags**: @backend

**Preconditions**:

- Fixture A-04: `R1` = 400 tokens, `R2` (latest) present with all five classes zero.
- Fixture A-05: both runs all-null/zero (the degenerate case, TP-DEC-1).
- A capture-outcome-only fixture (run identity present, no session-group records).
- The A-01 healthy control.

**Steps**:

1. Run A-04; assert `amplification.ratio === null` (strictly null, never `0`, `Infinity`, `NaN`, `1`, or a JSON `null`-as-string).
2. Assert the zero-progress run `R2` is named in the human report and that the naming includes its run id; assert `R1`'s event is still present with `tokensWasted` 400.
3. Assert the machine `data` carries exactly `{ratio, events[]}` — no invented progress-run key (DM-1, GAP-4).
4. Run A-05; assert `ratio === null`, `events` empty, exit 0, and that `degradation` discloses the zero/null class records.
5. Assert A-05 is **not** `spend.telemetry-absent` (records exist) and not a failure.
6. Run the capture-outcome-only fixture (no session-group records, one run identity): assert `ratio === null`, `events` empty, no progress run named because no record-bearing run exists, `restarts === 0`, and the report succeeds (presence is decided by the telemetry family pair, not by spend-bearing records alone).
7. Assert the report states the null rule (a zero-token progress run with positive paid reports no ratio) in its own terms alongside the other honesty limits (TC-SPEND-018).

**Expected Outcome**:

- `ratio: null` with the run named and the null rule stated; no division artefact ever reaches output; the degenerate case is a successful, degraded report.
- A mutant that returns `0`, `1`, or throws on zero progress fails.

**Notes / Clarifications**:

- TP-DEC-1 applies the TDR-0011 delegation: the all-zero case is null, not the AC-F5-1 healthy anchor, because a zero-token run produces no health evidence. AC-F5-1's exact-1 is asserted only for a positive-spend single run (TC-SPEND-014).

---

#### TC-SPEND-018 - Honesty limits carried in the report's own terms

**Scenario Type**: Regression
**Impact Level**: Critical
**Priority**: High
**Related IDs**: F-5, AC-F5-3, AC-F4-1, DM-3, DM-4, TDR-0011 C-5, RSK-1, RSK-3
**Test Type(s)**: Integration, Golden
**Automation Level**: Automated
**Target Layer / Location**: `tests/behaviour/spend-disclosure.test.ts`, `tests/golden/spend.test.ts`, `tests/golden/fixtures/spend/**`
**Tags**: @backend

**Preconditions**:

- A declared disclosure constant set in contracts (the single home of the limit statements) and a golden amplification render.
- The A-02 amplified fixture and the A-01 healthy fixture.

**Steps**:

1. Assert the contract declares one disclosure statement per obligation: run duplication is proven while semantic duplication is not; runs that never reached closeout capture are invisible; restart counts share that capture-reached basis; a zero-token progress run reports no ratio.
2. Run the amplified report; assert the human amplification section renders every declared statement verbatim (byte-compared against the golden), and that the statements appear on the healthy report too (the contract is not conditional on amplification).
3. Assert the machine `amplification` block contains no semantic-duplication claim, no content-overlap field, and no wording suggesting re-read proof (DM-1 exactness).
4. Delete one statement from a temp mutant copy of the constants and assert the suite fails naming the missing obligation.
5. Assert the documented surface (feature page / man page) carries the same statements, so the report and the docs do not drift (TC-SPEND-031).
6. Assert `RSK-1`-style over-interpretation is blocked: the cause string names the mechanism (`prefill re-pay`) and the disclosure says "run duplication", never "work duplication".

**Expected Outcome**:

- Every honesty limit is declared once, rendered in-band, and cannot be silently deleted; the machine surface makes no stronger claim than the formula supports.
- A mutant that removes a statement or replaces "run" with "work" fails.

**Notes / Clarifications**:

- Exact prose is delivery-bound (GAP-3); the oracle is "each declared obligation is present in the constant set and rendered verbatim", so a reviewed rewording updates one constant and its golden together.

---

#### TC-SPEND-019 - Restarts and amplification share one run substrate

**Scenario Type**: Corner Case
**Impact Level**: Critical
**Priority**: High
**Related IDs**: F-4, F-5, AC-F4-1, AC-F5-3, DM-3, DM-4, TDR-0011 boundary pin
**Test Type(s)**: Integration
**Automation Level**: Automated
**Target Layer / Location**: `tests/behaviour/spend-run-substrate.test.ts`
**Tags**: @backend

**Preconditions**:

- Fixtures A-06 (capture-outcome-only run), A-07 (zero-spend superseded run), and A-08 (duplicate identity across families).

**Steps**:

1. For every fixture, assert the invariant `count(events) ≤ restarts` and, when all runs carry positive spend, `count(events) = restarts`.
2. Run A-06; assert `restarts` counts the capture-outcome-only run while the event list omits it and `paid` is unchanged by it.
3. Run A-07; assert a zero-spend superseded run raises no event but still counts toward restarts, so the two readouts diverge exactly as pinned.
4. Run A-08; assert the duplicate identity counts once in restarts and once in progress selection.
5. Assert the report discloses both bases in the same words: restarts count runs that reached closeout capture; amplification decomposes only record-bearing runs.
6. Assert the invariants hold for the A-02 loop and the A-01 healthy case.

**Expected Outcome**:

- One substrate, two evidence bases, no contradiction: the counts agree by construction and the divergence is disclosed.
- A mutant that derives events from restarts (one event per restart) or that adds a capture-outcome-only run to `paid` fails.

---

#### TC-SPEND-020 - Envelope data shape, mode emphasis and rendering contract

**Scenario Type**: Happy Path
**Impact Level**: Critical
**Priority**: High
**Related IDs**: F-6, AC-F6-2, DM-1, DEC-9
**Test Type(s)**: Integration, Contract
**Automation Level**: Automated
**Target Layer / Location**: `tests/behaviour/spend-envelope.test.ts`
**Tags**: @backend

**Preconditions**:

- A seeded report fixture; the delivered result-contract helpers and scripted/interactive renderers.

**Steps**:

1. Run the report in human mode; assert the output is the human digest, and that `--json` forces the envelope with no human text.
2. Assert the envelope carries `schemaVersion: "delivery.result.v1"`, exactly one of `data`/`error`, and the standard envelope metadata keys.
3. Assert `data` has exactly the six pinned keys, deep-equal to the expected values, and that `delivery.spend.v1` appears only as the declared constant (not as a `data` key).
4. Assert `--amplification` changes only the human digest (adds the amplification section); assert the envelope's `amplification` block is present and identical with and without the flag.
5. Assert scripted mode renders one line with no context banner and interactive mode renders the digest, per the delivered result contract.
6. Assert a failure renders an error-only envelope with the classified code and that no partial `data` accompanies it.

**Expected Outcome**:

- The envelope and `data` shape are exact; the emphasis flag is human-only; mode rendering is inherited unchanged.
- Mutants that omit `amplification` without the flag, add a seventh `data` key, or emit both `data` and `error` fail.

---

#### TC-SPEND-021 - Bounded output with declared deterministic truncation

**Scenario Type**: Edge Case
**Impact Level**: Critical
**Priority**: High
**Related IDs**: F-6, NFR-1, DM-1
**Test Type(s)**: Integration, Golden
**Automation Level**: Automated
**Target Layer / Location**: `tests/behaviour/spend-bounds.test.ts`, `tests/golden/spend.test.ts`, `tests/golden/fixtures/spend/**`
**Tags**: @backend

**Preconditions**:

- Generated fixtures at three populations: under cap, at cap (the largest render that fits), and well over cap (many agents/models and many phases, with long-but-legal names).
- UTF-8 byte measurement helper.

**Steps**:

1. Assert the under-cap and at-cap renders are untruncated, and that the measured machine payload is ≤ 65 536 bytes and the human digest is ≤ 200 lines and ≤ 16 384 bytes (measure and assert the length first, then the bound).
2. Assert the over-cap render stays within both bounds and that truncation is **declared** in the channel that was truncated — a human marker line and an envelope-level declaration that does not add a `data` key (DM-1 exactness).
3. Assert truncation drops from the declared tail of `perAgent[]`/`perPhase[]` (TP-DEC-5) and that the retained prefix is byte-identical to the corresponding prefix of the untruncated render (no reshuffling, no silent re-sorting).
4. Assert the marker records what was dropped (counts), deterministically, and that repeating the over-cap render produces identical bytes.
5. Assert no truncation path exists that silently drops an event or a phase without the marker, and that `tokensByClass`, `restarts`, `ratio` are never truncated away.
6. Assert the human line count and byte bounds are enforced by the renderer, not by the caller, and that a single over-long agent/model name cannot exceed the machine bound (it is bounded by the cap, not by luck).

**Expected Outcome**:

- Bounds hold at and over cap; truncation is declared, tail-only, deterministic and loss-accounted.
- Mutants that drop entries silently, truncate from the head, or add a `data` key for the marker fail.

**Notes / Clarifications**:

- Marker placement outside `data` is delivery-bound (OQ-T5/GAP-6); DM-1's exact key set forbids a new `data` key, so the declaration lives in the envelope metadata and/or the human line.

---

#### TC-SPEND-022 - Byte-identical double render with zero model calls

**Scenario Type**: Regression
**Impact Level**: Critical
**Priority**: High
**Related IDs**: F-6, AC-F6-3, NFR-2, TDR-0011 C-4
**Test Type(s)**: Integration, Golden
**Automation Level**: Automated
**Target Layer / Location**: `tests/behaviour/spend-determinism.test.ts`, `tests/golden/spend.test.ts`
**Tags**: @backend

**Preconditions**:

- A fixed store, a fixed injected clock, a fixed run-id factory, and a fixed brand.
- Golden human and machine renders for A-01, A-02 and a degraded fixture.

**Steps**:

1. Run each fixture twice in each mode; assert byte-identical stdout/stderr and deep-equal `data`.
2. Install throwing stubs for ambient time, randomness, environment, and filesystem access outside the injected seams; re-run and assert unchanged output.
3. Install a model/inference seam spy; assert zero recorded calls across all renders.
4. Compare each render against its golden byte-for-byte; assert the goldens are read-only (the suite writes nothing).
5. Shuffle the seeded record order and re-run; assert byte-identical output.
6. Assert the injected clock and run-id are the only time/id sources: changing only the injected clock changes the render's declared metadata (if any) and nothing else about the computed figures.

**Expected Outcome**:

- Replay is byte-identical in both modes with zero ambient reads and zero model calls; goldens pin the bytes.
- A `Date.now()` render, a `Math.random()` tie-break, or an inference call fails.

---

#### TC-SPEND-023 - Privacy: statistics and identity references only

**Scenario Type**: Regression
**Impact Level**: Critical
**Priority**: High
**Related IDs**: F-1, F-6, NFR-5, AC-F1-1
**Test Type(s)**: Integration
**Automation Level**: Automated
**Target Layer / Location**: `tests/behaviour/spend-privacy.test.ts`
**Tags**: @backend

**Preconditions**:

- A fixture whose raw harness material (injected at the capture seam, not in the output path) contains canary prompt text, a message body, a transcript line, a diff hunk, tool output, and an edge-registered secret.
- The redaction chokepoint and the secret registry helper from the delivered privacy suite.

**Steps**:

1. Run the report in both modes; assert each canary appears zero times in `data`, the human digest, diagnostics and error output.
2. Assert the output contains only permitted categories: token counts, call counts, refs, phase ids, agent/model names, run ids, session-derived aggregates, and windows.
3. Assert the serialization chokepoint is the only write path (a mutant copy that serializes directly exposes the canary and fails).
4. Assert a failure diagnostic (telemetry-absent, store damage) carries the code, store path and record position only — never a payload excerpt.
5. Assert the human digest contains no titles, transcript fragments, or free-form prose beyond the declared disclosure lines.
6. Assert the presence control: the canary is proven present at the capture seam before the absence assertion.

**Expected Outcome**:

- Zero canary survivors across channels; only the declared statistic/identity categories appear.
- A bypass-chokepoint mutant or a diagnostic that quotes payload bytes fails.

---

#### TC-SPEND-024 - Fold latency and bounded work at 1,000 / 10,000 records

**Scenario Type**: Performance
**Impact Level**: Important
**Priority**: Medium
**Related IDs**: NFR-4, NFR-7, AC-F2-1
**Test Type(s)**: Performance, Integration
**Automation Level**: Automated
**Target Layer / Location**: `tests/behaviour/spend-performance.test.ts`
**Tags**: @backend, @perf

**Preconditions**:

- Generated temp stores with 1,000 and 10,000 captured session-group records across many runs, agents and models, plus a proportionally sized transition history.
- A recording state port that counts reads and per-record work.

**Steps**:

1. Assert bounded work: one verified ledger read per family per invocation, one transitions read, one fold pass, zero network and zero credential resolution, independent of record count.
2. Assert no per-record re-read (the read count does not grow with records) and no quadratic re-scan of the record array (a work probe or an operation counter asserts linear growth within tolerance).
3. Measure in-process fold+render time for both populations against the soft local budget (p95 ≤ 500 ms at 1,000; ≤ 2 s at 10,000); record the measured values in §10 as a non-CI reference, never as a passing CI threshold (GAP-2).
4. Assert output bounds still hold at 10,000 records (bounded output, declared truncation) — performance must not be bought with unbounded output.
5. Assert the harness-adapter spy is still zero at both scales.

**Expected Outcome**:

- Bounded, linear work with no network and no re-query; reference numbers recorded.
- A mutant that re-reads the store per run or per agent breaks the read-count invariance.

---

#### TC-SPEND-025 - Locked grammar: declarations, unknown flags, positionals

**Scenario Type**: Negative
**Impact Level**: Critical
**Priority**: High
**Related IDs**: F-6, AC-F6-1, AC-F7-1, DEC-6
**Test Type(s)**: Integration, Contract
**Automation Level**: Automated
**Target Layer / Location**: `tests/behaviour/spend-grammar.test.ts`, `tests/structure/cli-edge-seam.test.ts` (update)
**Tags**: @backend

**Preconditions**:

- The command definition registered in the CLI command registry; the shared parser; a recording read seam.

**Steps**:

1. Assert the declared flag set is exactly `--ref`, `--phase`, `--amplification`, `--json` — no hidden flag, no positional argument grammar.
2. Run L-11 (`--bogus`); assert `fallback.invocation`, exit 1, zero reads, and that the shared parser produced it.
3. Run L-10 (extra positional); assert `input.value.rejected`, exit 1, zero reads.
4. Run L-08/L-09 (missing values); assert `input.value.rejected`, exit 1, zero reads.
5. Assert the handler performs no stream write and takes no exit decision (the edge owns rendering), and that the composition is opt-in — a program composed without `spend` reports `fallback.invocation` for the command.
6. Assert `--json` is accepted globally and never inspected by the handler.
7. Assert `spend --help` (or the documented help path) renders the exact locked synopsis and at least one example.

**Expected Outcome**:

- Only the locked grammar is accepted; refusals precede any read; the handler stays render-free and exit-free.
- A mutant that accepts `--bogus` silently, or that reads before validating, fails.

---

#### TC-SPEND-026 - Ref resolution: explicit shape and active-context default

**Scenario Type**: Negative
**Impact Level**: Critical
**Priority**: High
**Related IDs**: F-6, AC-F6-1, AC-F3-3, DEC-6
**Test Type(s)**: Integration
**Automation Level**: Automated
**Target Layer / Location**: `tests/behaviour/spend-ref-resolution.test.ts`
**Tags**: @backend

**Preconditions**:

- An injected local-context read that can return a canonical ref, no context, or a malformed context.
- A recording read seam and a temp store seeded for `GH-236`.

**Steps**:

1. Run L-01; assert the explicit ref is used verbatim and no local-context read occurs (or is recorded as unnecessary).
2. Run L-02; assert the default resolves the active change ref and produces a report identical to L-01.
3. Run L-03; assert `input.value.rejected` naming the missing context, exit 1, and **zero** state reads.
4. Run L-04/L-05; assert `input.value.rejected` for lowercase, padded, and non-hyphen shapes — case-sensitive, no folding, matching the closeout precedent.
5. Assert a malformed local context (unparseable/missing active change) is a refusal, not a silent fall-through to "all refs" or a different ref.
6. Assert the resolved ref appears in the report scope and in the telemetry-absent summary, so an operator can tell which ref was selected.

**Expected Outcome**:

- Explicit refs win, the default is the active context, and every unresolvable case refuses before any read.
- A mutant that folds case, that guesses a ref, or that reads before resolving fails.

---

#### TC-SPEND-027 - Digest section 8 becomes `observed` with spend evidence

**Scenario Type**: Happy Path
**Impact Level**: Critical
**Priority**: High
**Related IDs**: F-8, AC-F8-1, DM-6, DEC-8
**Test Type(s)**: Integration, Golden
**Automation Level**: Automated
**Target Layer / Location**: `tests/behaviour/status-spend-section.test.ts`, `tests/golden/status-digest.test.ts` (update), `tests/fixtures/status/{corpus,golden}/**`
**Tags**: @backend

**Preconditions**:

- A status fact fixture whose active change has captured telemetry (the A-02 loop), plus the existing nine-section harness.
- The digest derivation matrix and placeholder catalog contracts.

**Steps**:

1. Render the digest; assert section 8 is present at index 8, id `spend`, kind no longer `placeholder`, state `observed`.
2. Assert the section carries token-class totals, `restarts`, and the amplification `ratio` matching the same fixture constants used by the command suite.
3. Assert the evidence entry names source `state-log` with outcome `read`.
4. Assert the placeholder line "spend summary arrives with M1-S19" renders nowhere in human or machine output, and that the placeholder note/capability/expectedStory fields are gone.
5. Assert the derivation matrix row for `spend` no longer admits `not-delivered` and matches the observed mapping, and that the corpus completeness meta-check covers the new row states.
6. Assert the human digest renders a spend line within the declared bounds and that the golden is byte-identical.

**Expected Outcome**:

- Section 8 is a real observed section with the same numbers as the command; the placeholder is gone everywhere; the derivation contract and corpus move in the same change.
- A mutant that keeps `not-delivered` behind the new content, or leaves the string anywhere, fails.

---

#### TC-SPEND-028 - Digest verified-empty and failed-read projections

**Scenario Type**: Negative
**Impact Level**: Critical
**Priority**: High
**Related IDs**: F-8, AC-F8-2, DM-6, DEC-8
**Test Type(s)**: Integration
**Automation Level**: Automated
**Target Layer / Location**: `tests/behaviour/status-spend-degraded.test.ts`
**Tags**: @backend

**Preconditions**:

- Three fixtures: telemetry present (control), verified-empty telemetry, and a failed/denied telemetry read.
- A human-line canary list for "zero spend" phrasing.

**Steps**:

1. Verified-empty fixture: assert section state `observed` (per the digest's own rule), zero counts, evidence `state-log`/`observed-empty`, and a human line that names **absence of capture** — never a claim that spend was zero.
2. Assert the human line does not contain zero-spend wording ("spend: 0", "no spend", "zero spend") and does contain an absence-of-capture phrase.
3. Failed-read fixture: assert the section becomes digest data with state `unknown`, reason `state-unreadable`, and the state failure code as `failureCode`; assert the digest still returns all nine sections and exits 0.
4. Assert the command's own invocation on the same failed store still exits 2 (the digest degrades, the command classifies) — the two surfaces are allowed to differ and both are pinned.
5. Assert no placeholder reappears and that the failed section contributes zero to `actionable`.
6. Assert determinism: repeat both renders and compare bytes.

**Expected Outcome**:

- Verified-empty is observed-with-absence, never a zero-spend claim; a failed read degrades in-band at exit 0 with `state-unreadable`.
- A mutant that renders zeros for a failed read, or a zero-spend claim for an empty one, fails.

---

#### TC-SPEND-029 - Digest invariants: placeholder count, actionable, brief

**Scenario Type**: Regression
**Impact Level**: Critical
**Priority**: High
**Related IDs**: F-8, AC-F8-3, DM-6, DEC-8, DEC-10
**Test Type(s)**: Integration, Check
**Automation Level**: Automated
**Target Layer / Location**: `tests/behaviour/status-placeholders.test.ts` (update), `tests/behaviour/status-corpus.test.ts` (update), `tests/behaviour/brief-*.test.ts` (non-regression)
**Tags**: @backend

**Preconditions**:

- The updated placeholder contract (`STATUS_PLACEHOLDER_SECTION_IDS = ["blockers"]`), the derivation matrix, and the brief suite.

**Steps**:

1. Assert `placeholderSectionCount === 1` on every corpus case, and that the sole placeholder is `blockers`.
2. Assert the spend section contributes zero to `actionable` in every state, and that the shipped `actionable` total is unchanged for identical facts in sections 1–6.
3. Assert the corpus completeness meta-check requires the spend section × every state in its new derivation row, failing by case name on a corrupted state, count, identity, or evidence.
4. Assert the brief payload is unchanged in shape and content rules and carries no spend entry, capability, placeholder, or anchor; run the brief suite unchanged.
5. Assert no golden or corpus case still encodes the retired placeholder line or a `not-delivered` spend row; a scan asserts the string appears zero times in `tests/fixtures`, `tests/golden`, `doc/spec`, and source.
6. Assert the digest machine bound still holds with the spend section populated at cap.

**Expected Outcome**:

- Exactly one placeholder, zero actionable contribution, brief untouched, corpora and goldens moved in the same change.
- A mutant that keeps two placeholders, counts spend as actionable, or adds a brief spend entry fails.

---

#### TC-SPEND-030 - One fold, two surfaces: command and digest agree

**Scenario Type**: Regression
**Impact Level**: Critical
**Priority**: High
**Related IDs**: F-8, AC-F8-1, DM-6
**Test Type(s)**: Integration
**Automation Level**: Automated
**Target Layer / Location**: `tests/behaviour/status-spend-parity.test.ts`
**Tags**: @backend

**Preconditions**:

- One seeded temp store used by both the `spend` command and the status digest, with the same injected clock and ref.
- Three fixtures: healthy, loop, degraded-record.

**Steps**:

1. Run the command and the digest against the same store; assert token-class totals, `restarts` and the amplification `ratio` are identical in both surfaces.
2. Assert there is one fold implementation: a spy on the fold seam records the same call shape from both consumers, and no second aggregation path exists in the status module (static import/identifier scan).
3. Replace the fold with a temp divergent mutant (e.g. session-only restarts); assert both surfaces change together — proving they are not independently computed.
4. Assert `--phase`-scoped command output is *not* used by the digest (the digest reports the ref scope) and that the digest's scope is the active change ref, matching spec §12's assumption.
5. Assert the digest renders within bounds with the loop fixture (many events) and that the parity holds in both digest modes.

**Expected Outcome**:

- One fold, two surfaces, identical numbers; a divergent implementation is detectable and fails.
- A mutant that re-implements aggregation inside the digest fails the parity and the single-fold assertion.

---

#### TC-SPEND-031 - Documentation and help-surface reconciliation

**Scenario Type**: Regression
**Impact Level**: Important
**Priority**: High
**Related IDs**: F-6, F-8, AC-F6-1, AC-F5-3, AC-F8-1, RSK-6
**Test Type(s)**: Manual, Static
**Automation Level**: Semi-automated
**Target Layer / Location**: `doc/spec/features/feature-spend.md` (new), the man-page pack, `--help` golden, `doc/00-index.md`/glossary, `doc/spec/features/{feature-result-contract,feature-status-digest}.md`, branding forbidden-literal registry
**Tags**: @backend

**Preconditions**:

- The command's `--help` output and the reconciled documentation set from phase 7.

**Steps**:

1. Static-check `--help`: exact synopsis, at least one example, the amplification contract, and the telemetry-absent remediation hint.
2. Static-check the feature page against the pinned contract: five classes (not three), the `degradation` block, `share` semantics (integer floored, may not sum to 100), the `--amplification` human-only scope, the exit taxonomy, and the honesty limits.
3. Static-check the result-contract page carries the one new row with its projection class, and the status-digest page carries the new section 8 row, removal of the placeholder catalog entry, `placeholderSectionCount` 1, and the `state-log` source.
4. Assert the man-page pack carries no contradictory claim (three classes, cost aggregation, alarms/burn rate, or a `--watch`-style flag) and record the Appendix B delta reconciliation as review evidence.
5. Assert the glossary/index entries and the branding forbidden-literal registry are updated and that no product/binary literal is hardcoded.
6. Record the manual verification in §10 with the reviewer and the commit under review.

**Expected Outcome**:

- Help, man page, feature pages, glossary and registry agree with the pinned contract; no contradictory planning-era claim survives.
- A residual three-class example, a cost figure, or the retired placeholder line in docs fails review and the static scan.

**Notes / Clarifications**:

- Per the testing strategy, docs changes require static/diff + content checks and documented manual verification; this TC is the manual counterpart of the automated contract suite.

---

#### TC-SPEND-032 - Read-only execution: zero writes, fences, spawns, network

**Scenario Type**: Regression
**Impact Level**: Critical
**Priority**: High
**Related IDs**: F-2, AC-F2-1, NFR-3, §10, §21
**Test Type(s)**: Integration, Static
**Automation Level**: Automated
**Target Layer / Location**: `tests/behaviour/spend-readonly.test.ts`, `tests/structure/spend-imports.test.ts`
**Tags**: @backend

**Preconditions**:

- A seeded temp store with byte snapshots (`ledgerBytes`) before and after; a fence spy; a child-process spy; a throwing network module shim.
- An injected audit seam that can be configured to succeed or fail.

**Steps**:

1. Run every success and failure path (report, `--json`, `--amplification`, `--phase`, telemetry-absent, store damage) and assert the state bytes, sequence count and mtime-basis are unchanged after each.
2. Assert the fence spy records zero acquisitions on every path (the read is fence-free; `state.lock.busy` is unreachable).
3. Assert zero child processes, zero network calls, and zero credential resolutions occur.
4. Assert the audit seam, when injected, receives its reservation and invocation record exactly as any other command and that the recorded figures are unchanged.
5. Configure the audit seam to fail; assert the failure is a classified diagnostic that does not change the outcome or exit code and does not alter the report.
6. Assert the static scan finds no write member (`append`, `write`, `acquireFence`, `salvage`, `remove`) reachable from the spend command path.

**Expected Outcome**:

- Zero writes, fences, spawns, network and credentials on every path; auditing composes unchanged and never alters the outcome.
- A mutant that acquires a fence "for safety" or writes a projection fails.

---

#### TC-SPEND-033 - Capture-outcome warnings never vanish from degradation

**Scenario Type**: Corner Case
**Impact Level**: Important
**Priority**: High
**Related IDs**: F-1, AC-F1-1, DM-1, DEC-2
**Test Type(s)**: Integration
**Automation Level**: Automated
**Target Layer / Location**: `tests/behaviour/spend-degradation.test.ts`
**Tags**: @backend

**Preconditions**:

- A fixture where a capture-outcome record carries `session-capture-failed` and a `degraded` count, while its session records are clean; a second fixture where a session record carries a `truncated` tool mark and the outcome carries none.

**Steps**:

1. Run the report; assert `degradation.byReason` includes `session-capture-failed` with the exact count and that `degradation.records` counts the bearing record(s) per TP-DEC-8.
2. Assert the failure is disclosed but does not become a report failure and does not appear as a negative or zeroed token count.
3. Assert the tool-truncation fixture records `truncated` in `byReason` while the outcome-side count stays zero — the two families contribute independently.
4. Assert no warning reason outside `HARNESS_WARNING_REASONS` can appear, and that a capture-record warning is never silently dropped when the session records are clean.
5. Assert the human digest surfaces the degradation disclosure in both fixtures.

**Expected Outcome**:

- Capture-family warnings are accounted, never dropped; a clean session record set cannot mask a failed/dropped session.

**Notes / Clarifications**:

- TP-DEC-8 pins the population reading; if delivery chooses session-only accounting, this TC is the one that changes — and it must not change silently, because `session-capture-failed` is exactly the reason a run's spend may be incomplete.

---

#### TC-SPEND-034 - Mutant sensitivity of every pinned oracle

**Scenario Type**: Regression
**Impact Level**: Critical
**Priority**: High
**Related IDs**: F-2, F-5, F-6, AC-F2-1, AC-F5-1, AC-F5-2, AC-F5-3, NFR-1, NFR-3
**Test Type(s)**: Contract, Check
**Automation Level**: Automated
**Target Layer / Location**: `tests/checks/spend-mutants.test.ts`
**Tags**: @backend

**Preconditions**:

- Temp mutant copies of the production fold/render modules importable by file URL (the `tests/golden/redaction.test.ts` pattern).
- The fixtures from TC-SPEND-003..033.

**Steps**:

1. Mutant M-01: fabricate `0` for every null token class — the suite must fail on TC-SPEND-004's degradation assertion.
2. Mutant M-02: union only session-group run identities for restarts — fail TC-SPEND-013/019.
3. Mutant M-03: emit an event for the progress run — fail TC-SPEND-014/015.
4. Mutant M-04: drop the first event (or de-duplicate events by cause) — fail TC-SPEND-015.
5. Mutant M-05: sort events by run id only — fail TC-SPEND-015/016 (A-03, A-10).
6. Mutant M-06: clamp the ratio to 1 (or round it to the nearest integer) — fail TC-SPEND-014/015.
7. Mutant M-07: read the harness adapter before the state trace — fail TC-SPEND-006/032.
8. Mutant M-08: truncate silently (no marker) or from the head — fail TC-SPEND-021.
9. Mutant M-09: render zero spend from a verified-empty digest read — fail TC-SPEND-028.
10. Mutant M-10: acquire a fence and write a projection document — fail TC-SPEND-032.
11. Mutant M-11: resolve `--ref` case-insensitively — fail TC-SPEND-026.
12. Assert each mutant produces the prohibited observable **and** that the unmutated control passes; assert the mutant count matches the registry (a removed mutant fails the meta-check).

**Expected Outcome**:

- Every pinned oracle is load-bearing: disabling any of the twelve rules fails the suite at the named TC.
- A vacuously passing suite is impossible because each mutant's control is asserted in the same run.

**Notes / Clarifications**:

- This meta-case is the executable form of the non-vacuity contract (§4.2) for the two binding ACs and the bounded-output guarantee.

## 6. Environments and Test Data

- **Environment**: local-dev and CI only; no staging, no live harness, no provider credentials, no network. `bun test` for TypeScript suites; `pnpm check` as the aggregate gate.
- **Store fixture**: every case creates its own `mkdtemp` state root with the synthetic workspace identity via `tests/fixtures/state/harness.ts` (`makeTempRoot`, `makeIdentity`, `openStore`, `withinFence`, `ledgerBytes`, `removeRoot`). Records are appended through the delivered append path (`appendHarnessTelemetry`, `appendHarnessCaptureOutcome`) or seeded equivalently through the validated boundary; transitions are appended through the delivered registry path.
- **Telemetry fixture builders**: extend the delivered `tests/fixtures/closeout/harness-telemetry.ts` builders (`makeTelemetryCapture`, `makeCloseoutTelemetry`, `makeTwoGroupCapture`) into `tests/fixtures/spend/harness.ts`, adding per-case builders for: five-class sessions, null-class/degraded records, zero-token runs, capture-outcome-only runs, duplicate identities, non-time-sortable run ids, and over-cap populations.
- **Transition fixture**: `tests/fixtures/spend/transitions.ts` with the P-01..P-14 histories as literal `PhaseTransitionRecord` arrays and their record-stamp maps.
- **Ref vocabulary**: canonical `GH-236`, `GH-999`; negatives `gh-236`, `GH236`, `"GH-236 "`, empty. Phase vocabulary from `CANONICAL_PHASE_IDS` with negatives `Delivery`, `deployment`, empty.
- **Naming vocabulary**: agents/models like `planner/sonnet`, `coder/opus`, `reviewer/haiku`; run ids `run-alpha`, `run-zeta`, `run-7`, `run-005` (deliberately not time-sortable).
- **Injected clock and ids**: `NOW_MS = Date.UTC(2026, 10, 7, 9, 0, 0)` (literal, month index 10 = November), a fixed run-id factory, `SYNTHETIC_BRAND`; no fixture reads the ambient clock or environment.
- **Secrets and canaries**: fabricated values registered through the delivered edge secret registry for TC-SPEND-023 only; never real material.
- **Isolation and cleanup**: each test removes its temp root in `afterEach`; no test writes the repository tree, `dist/`, or the user's state directory. Goldens and mutant copies live under temp directories or committed read-only fixtures.
- **Portability**: permission assertions are POSIX-only; no run claims Windows verification.

## 7. Automation Plan and Implementation Mapping

| TC ID | Test file | Command | Implementation status |
|-------|-----------|---------|-----------------------|
| TC-SPEND-001 | `tests/structure/spend-contract.test.ts` | `bun test tests/structure/spend-contract.test.ts` | To Implement |
| TC-SPEND-002 | `tests/structure/spend-imports.test.ts`, `tests/structure/content-inventory.test.ts` | `bun test tests/structure tests/boundaries`; `pnpm check:boundaries` | To Implement + Existing – Update |
| TC-SPEND-003 | `tests/behaviour/spend-breakdown.test.ts` | `bun test tests/behaviour/spend-breakdown.test.ts` | To Implement |
| TC-SPEND-004 | `tests/behaviour/spend-degradation.test.ts` | `bun test tests/behaviour/spend-degradation.test.ts` | To Implement |
| TC-SPEND-005 | `tests/behaviour/spend-cost-omission.test.ts` | `bun test tests/behaviour/spend-cost-omission.test.ts` | To Implement |
| TC-SPEND-006 | `tests/behaviour/spend-read-contract.test.ts` | `bun test tests/behaviour/spend-read-contract.test.ts` | To Implement |
| TC-SPEND-007 | `tests/behaviour/spend-absent.test.ts` | `bun test tests/behaviour/spend-absent.test.ts` | To Implement |
| TC-SPEND-008 | `tests/behaviour/spend-store-damage.test.ts` | `bun test tests/behaviour/spend-store-damage.test.ts` | To Implement |
| TC-SPEND-009 | `tests/structure/error-table.test.ts`, `tests/checks/error-table-sync.test.ts` | `bun test tests/structure/error-table.test.ts tests/checks/error-table-sync.test.ts`; `bun run scripts/checks/error-table-sync.ts` | Existing – Update |
| TC-SPEND-010 | `tests/behaviour/spend-phase-attribution.test.ts` | `bun test tests/behaviour/spend-phase-attribution.test.ts` | To Implement |
| TC-SPEND-011 | `tests/behaviour/spend-phase-fallback.test.ts` | `bun test tests/behaviour/spend-phase-fallback.test.ts` | To Implement |
| TC-SPEND-012 | `tests/behaviour/spend-phase-filter.test.ts` | `bun test tests/behaviour/spend-phase-filter.test.ts` | To Implement |
| TC-SPEND-013 | `tests/behaviour/spend-restarts.test.ts` | `bun test tests/behaviour/spend-restarts.test.ts` | To Implement |
| TC-SPEND-014 | `tests/behaviour/spend-amplification-healthy.test.ts` | `bun test tests/behaviour/spend-amplification-healthy.test.ts` | To Implement |
| TC-SPEND-015 | `tests/behaviour/spend-amplification-events.test.ts` | `bun test tests/behaviour/spend-amplification-events.test.ts` | To Implement |
| TC-SPEND-016 | `tests/behaviour/spend-amplification-determinism.test.ts` | `bun test tests/behaviour/spend-amplification-determinism.test.ts` | To Implement |
| TC-SPEND-017 | `tests/behaviour/spend-amplification-null.test.ts` | `bun test tests/behaviour/spend-amplification-null.test.ts` | To Implement |
| TC-SPEND-018 | `tests/behaviour/spend-disclosure.test.ts`, `tests/golden/spend.test.ts` | `bun test tests/behaviour/spend-disclosure.test.ts tests/golden/spend.test.ts` | To Implement |
| TC-SPEND-019 | `tests/behaviour/spend-run-substrate.test.ts` | `bun test tests/behaviour/spend-run-substrate.test.ts` | To Implement |
| TC-SPEND-020 | `tests/behaviour/spend-envelope.test.ts` | `bun test tests/behaviour/spend-envelope.test.ts` | To Implement |
| TC-SPEND-021 | `tests/behaviour/spend-bounds.test.ts`, `tests/golden/spend.test.ts` | `bun test tests/behaviour/spend-bounds.test.ts tests/golden/spend.test.ts` | To Implement |
| TC-SPEND-022 | `tests/behaviour/spend-determinism.test.ts`, `tests/golden/spend.test.ts` | `bun test tests/behaviour/spend-determinism.test.ts tests/golden/spend.test.ts` | To Implement |
| TC-SPEND-023 | `tests/behaviour/spend-privacy.test.ts` | `bun test tests/behaviour/spend-privacy.test.ts` | To Implement |
| TC-SPEND-024 | `tests/behaviour/spend-performance.test.ts` | `bun test tests/behaviour/spend-performance.test.ts` | To Implement |
| TC-SPEND-025 | `tests/behaviour/spend-grammar.test.ts`, `tests/structure/cli-edge-seam.test.ts` | `bun test tests/behaviour/spend-grammar.test.ts tests/structure/cli-edge-seam.test.ts` | To Implement + Existing – Update |
| TC-SPEND-026 | `tests/behaviour/spend-ref-resolution.test.ts` | `bun test tests/behaviour/spend-ref-resolution.test.ts` | To Implement |
| TC-SPEND-027 | `tests/behaviour/status-spend-section.test.ts`, `tests/golden/status-digest.test.ts`, `tests/fixtures/status/**` | `bun test tests/behaviour/status-spend-section.test.ts tests/golden/status-digest.test.ts` | To Implement + Existing – Update |
| TC-SPEND-028 | `tests/behaviour/status-spend-degraded.test.ts` | `bun test tests/behaviour/status-spend-degraded.test.ts` | To Implement |
| TC-SPEND-029 | `tests/behaviour/status-placeholders.test.ts`, `tests/behaviour/status-corpus.test.ts`, `tests/behaviour/brief-*.test.ts` | `bun test tests/behaviour/status-placeholders.test.ts tests/behaviour/status-corpus.test.ts tests/behaviour/brief-*` | Existing – Update |
| TC-SPEND-030 | `tests/behaviour/status-spend-parity.test.ts` | `bun test tests/behaviour/status-spend-parity.test.ts` | To Implement |
| TC-SPEND-031 | `doc/spec/features/feature-spend.md`, man-page pack, `--help` golden, glossary/index, forbidden-literal registry | `git diff --check`; content review; `bun run scripts/checks/forbidden-literals.ts` | To Implement (manual + static) |
| TC-SPEND-032 | `tests/behaviour/spend-readonly.test.ts` | `bun test tests/behaviour/spend-readonly.test.ts` | To Implement |
| TC-SPEND-033 | `tests/behaviour/spend-degradation.test.ts` | `bun test tests/behaviour/spend-degradation.test.ts` | To Implement |
| TC-SPEND-034 | `tests/checks/spend-mutants.test.ts` | `bun test tests/checks/spend-mutants.test.ts` | To Implement |
| All | Aggregate | `pnpm check` | Existing – No Change |

**Fixture and golden deliverables created during delivery (explicitly delivery-bound, not silent TODOs):**

- `tests/fixtures/spend/harness.ts`, `cases.ts`, `transitions.ts` — the A-*, P-*, R-* matrices as committed case definitions.
- `tests/fixtures/spend/mutants/` — the twelve mutant module copies (or a generation helper) for TC-SPEND-034.
- `tests/golden/fixtures/spend/**` — human and machine goldens for A-01, A-02, a degraded fixture and an over-cap render; generated once, reviewed, never rewritten by the suite.
- `tests/fixtures/status/{corpus,golden}/**` updates — spend section cases and the regenerated digest goldens; the placeholder line removed from every case.
- `packages/core/src/contracts/spend.ts` and the delivery-bound declaration constants (schema id, disclosure statements, ordering keys, bounds, markers).

## 8. Risks, Assumptions, and Open Questions

### 8.1 Risks

| ID | Risk | Impact | Mitigation in this plan |
|----|------|--------|-------------------------|
| TR-1 | A fixture-only formula suite proves the arithmetic but not real multi-run shapes | M | The oracle is exact and structural (A-01..A-10, P-01..P-14), the honesty limits are asserted in-band, and TDR-0011's revisit trigger 1 names the post-GH-240 validation. The suite never claims real-world fit. |
| TR-2 | Golden/corpus churn hides a real digest regression | M | Goldens are regenerated deliberately once, reviewed, and byte-compared; the corpus meta-check fails by case name; the retired placeholder string is scanned to zero occurrences. |
| TR-3 | The amplification oracle is "approximately 1" and tolerates a wrong value | M | TC-SPEND-014 asserts strict equality to 1 and TC-SPEND-034's clamp/round mutants must fail; the A-02 control proves the value moves. |
| TR-4 | Null-class handling silently inflates or hides spend | H | TC-SPEND-004 compares against a non-null oracle and requires `degradation.records > 0` naming every degraded record; the zero-fabricating mutant must fail. |
| TR-5 | Zero harness reads is asserted by inspection, not observation | H | TC-SPEND-006/032 assert recorded calls plus a throwing spy; the adapter-probing mutant must fail. This is the binding AC 1 proof. |
| TR-6 | The digest and the command drift into two folds | M | TC-SPEND-030 asserts numeric parity and a divergent mutant; the single-fold scan and seam spy make a second implementation visible. |
| TR-7 | NFR-4 thresholds are flaky on shared runners | L | GAP-2: CI asserts bounded work and a soft local budget; the reference measurement is recorded in §10 and never gates. |
| TR-8 | Test-plan pins (TP-DEC-1..9) drift from the eventual spec/plan wording | M | Each pin cites its basis and is listed in §8.3; a delivery-time change must update the pin, the affected TC and the goldens together, never silently. |
| TR-9 | Privacy canaries cannot prove the absence of unmodelled content | L | TC-SPEND-023 uses the delivered redaction chokepoint and asserts the single serialization path; the state layer's record-content guarantee is a delivered dependency (spec §20). |

### 8.2 Assumptions

- The state layer's verified reads, presence tolerance and classified `state.*` projections are delivered and unchanged (GH-174/GH-233); `readHarnessTelemetry` and `readHarnessCaptureOutcome` exist with the shapes the spec cites.
- `phase.transition` history is readable per ref via the delivered tolerant registry read, and a torn transitions payload is classifiable while an absent one is not an error.
- The delivered CLI parser classifies undeclared flags as `fallback.invocation` and the edge owns rendering and exit projection; `--json` is a global flag.
- `readChangeTransitionsTolerant`-style presence tolerance means "no transitions" and "no telemetry" are distinguishable from "unreadable".
- Fixture-seeded stores legitimately prove every reporting path (NFR-7) because no production composer exists until GH-240.
- The canonical eleven-phase vocabulary is stable for `--phase` validation.
- The digest's active-change ref resolution is reused, not redefined (spec §12).
- Run ids are opaque with no time-sortability property; ordering comes from captured-at plus a run-id tie-break.

### 8.3 Open Questions

| ID | Question | Blocking? | Owner / effect |
|----|----------|-----------|----------------|
| OQ-T1 | Is TP-DEC-1 (all-zero paid and progress → `ratio: null`) the accepted reading, given AC-F5-1's "exactly one record-bearing run reads exactly 1"? | No — pinned defensibly and scoped to positive spend | `@readiness-reviewer` confirms; a different reading needs a spec sentence and changes TC-SPEND-017 only |
| OQ-T2 | AC-F5-3 says the zero-progress run is "named", but DM-1 pins `amplification` to `{ratio, events[]}` with events only for superseded positive-spend runs, so the **machine** envelope cannot name the progress run. Is human-channel naming sufficient, or should DM-1 gain a progress-run field? | No for delivery of the human channel; yes if machine consumers need it | Spec owner decides; machine naming requires a DM-1 amendment (reopens specification) and this plan would add the machine assertion |
| OQ-T3 | TP-DEC-2 boundary semantics (record exactly on a `complete`/`reopen` stamp; shared stamp → reopen wins) are not literally pinned by DM-2. Confirm or replace. | No | `@readiness-reviewer`/`@plan-writer` confirm; TC-SPEND-010's P-03/P-05 rows carry the pin |
| OQ-T4 | TP-DEC-6: does `--phase` scope the amplification block as well as the totals? F-3 says "restricts the report", AC-F3-3 says "scoped selection"; DM-3 says nothing about phase scoping. | No — pinned as one scoped fold | Confirm at readiness; a global-amplification choice changes TC-SPEND-012 step 1 only |
| OQ-T5 | TP-DEC-5 ordering keys for `perAgent[]`/`perPhase[]` and the truncation tail are delivery-bound. Confirm the proposed total orders. | No | `@plan-writer` pins them as plan constants; TC-SPEND-021/003 assert through that constant |
| OQ-T6 | TP-DEC-8: does `degradation` count capture-outcome warnings as well as session-group warnings? Session-only accounting would hide `session-capture-failed`. | No | Confirm at readiness; TC-SPEND-033 is the single affected case |
| OQ-T7 | Should a corrupt transitions payload degrade the whole report (TP-DEC-7) or fall back to `unknown` with a disclosure? | No | Pinned as classify (never partial truth); confirm with the plan |

## 9. Plan Revision Log

| Version | Date | Author | Changes |
|---------|------|--------|---------|
| 1.0 | 2026-11-07 | test-plan-writer (DeepSeek V4.1 Flash) | Initial plan from GH-236 spec (19 ACs, DM-1..DM-6, NFR-1..NFR-7), TDR-0011, delivered testing strategy, and the GH-232/GH-243 plan conventions. 34 TCs; amplification oracle matrix A-01..A-10; phase attribution matrix P-01..P-14; read/absence/damage matrix R-01..R-10; exit oracle; CLI matrix L-01..L-15; nine test-plan pins; six delivery-bound gaps recorded with owners. |

## 10. Test Execution Log

Not yet executed. Populated during delivery (`delivery` phase) and quality gates (`pnpm check`), one row per TC or logical group, with the command, the observed result, and the evidence location.

| TC ID | Run Date | Result | Notes / Evidence |
|-------|----------|--------|------------------|
| — | — | Not run | Plan authored; no suites executed while authoring. |
