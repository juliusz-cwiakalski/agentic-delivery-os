---
id: chg-GH-291-test-plan
status: Proposed
created: 2026-11-12T21:30:00Z
last_updated: 2026-11-12T21:30:00Z
owners: [engineering]
service: "delivery-os telemetry plane (harness telemetry ingest, attribution, storage, and spend read side)"
labels: [m2, telemetry, spend, learning-plane, state-layer, cli, retro, brief]
version_impact: minor
summary: "Traceable verification of M2-S14 harness telemetry v2: per-step ingest from the opencode v2.x.y JSONL stream counting the five token classes (input/output/reasoning/cache-read/cache-write), calls, and per-model cost in harness-reported units, with frame omissions and drift degrading through closed-vocabulary warnings and never fabricated to zero or an estimate; five-dimension attribution (ticket, repository, lane, agentRole, model) joined from session economics and command-audit identity with unattributable steps classified as degradation and never guessed into a wrong dimension; phase/stall/restart timing derived from delivered economics and phase-transition records with no re-estimation; schema-versioned local event storage whose version bump migrates by re-reading with no silent loss and which coexists with delivered closeout capture under a named reading basis; the spend read side extended additively under the delivered `delivery.spend.v1` identity (DEC-6) with breakdowns per the five dimensions whose sums equal the totals, per-phase timing summaries, the declared ≤2% (0.02) reconciliation tolerance (DEC-2) stated with every summary against a summed multi-session harness baseline with one verdict (DEC-5), classified reconciliation unavailability instead of a baseline-less 'within', the declared outside verdict rendered rather than silently tolerated, `spend.telemetry-absent` preserved as the classified absence at exit 1 with no zero-valued report (SC-M2-S14-01/02 pinned), non-opencode deliveries folding closeout-captured v1 records with classified degradation rather than absence (DEC-4), the retro evidence pass and morning brief citing the numbers with reconciliation disclosure and rendering classified absence, status-digest section 8 parity from the same fold, and the NFR battery (bounded output, byte-identical determinism with zero model calls, read-side latency and one-verified-read-per-family work, ingest non-interference, offline hermeticity, privacy, linear storage growth) — all offline on committed real-shape stream fixtures and fixture-seeded stores with an independent hand-summed arithmetic oracle and a disabling-mutant meta-suite per every honesty rule."
links:
  change_spec: ./chg-GH-291-spec.md
  implementation_plan: ./chg-GH-291-plan.yaml   # authored in phase 4; not yet present (GAP-1)
  testing_strategy: ../../../../.ai/rules/testing-strategy.md
---

# Test Plan - M2-S14: Harness telemetry v2

## 1. Scope and Objectives

This change turns telemetry from closeout-time session-group aggregates into per-step, attributed, reconciled fact: it ingests token, call, cost, and timing data from the opencode v2.x.y stream while a session runs, attributes every step to ticket/repository/lane/agent-role/model, stores it in schema-versioned local event storage, and surfaces spend v2 breakdowns with a declared-tolerance reconciliation that the retro and the brief then cite. Four properties are load-bearing and each is tested independently so weakening one cannot pass behind another.

**First, ingest must count what the harness reports — and nothing else.** The five token classes, calls, and per-model cost are captured per step in harness-reported units; a frame that omits a class or field degrades with a closed-vocabulary warning and the missing value is excluded from sums — never fabricated to zero or to a plausible estimate (AC-F1-1). Frame drift degrades with warnings instead of inventing data (RSK-1), and ingest adds no blocking work that changes the delivered stream-drain, handle-acquisition, or completion-evidence behavior (NFR-5, RSK-5).

**Second, attribution and timing must be derived, never guessed or re-estimated.** Every stored step carries the five attribution dimensions joined from session economics and command-audit identity; a step that cannot be attributed is classified degradation with a reason and is never dropped into a wrong dimension by default (AC-F2-1, RSK-3). Phase, stall, and restart timing come from delivered records (AC-F3-1) — a mutant that synthesizes a duration where a delivered record exists must fail.

**Third, the read side must stay additive, honest, and reconciled.** The v1 grammar and six-key `delivery.spend.v1` payload remain valid with v2 additions strictly beside them (DEC-6, AC-F5-2); breakdowns over the five dimensions sum exactly to totals (AC-F5-1); an unknown breakdown field is refused before any read (AC-F5-3); every summary states the telemetry state and the tolerance (AC-N1-1); the reconciliation compares observed totals against the summed harness-reported session baseline once (DEC-5), renders `within` on the pinned scenario (SC-M2-S14-01, AC-F6-1), renders the outside verdict declaredly rather than silently (AC-F6-2), and declares classified unavailability when no baseline exists at all. Absence remains `spend.telemetry-absent` at exit 1 with no zero-valued report (SC-M2-S14-02, AC-F7-1); store damage keeps its delivered `state.*` identities and is never re-projected as absence; a non-opencode delivery folds its closeout-captured v1 records with classified degradation rather than being mis-called absent (DEC-4).

**Fourth, the consumers must cite, and the whole battery must stay offline.** The retro evidence pass, the brief, and the digest projection cite the numbers with the reconciliation disclosure and render classified absence instead of zeros (AC-F8-1, AC-F8-2, §7.1 digest parity). Every new test runs offline on committed real-shape stream fixtures and fixture-seeded stores with zero live harness stores, credentials, or network (NFR-6), on an independent hand-summed arithmetic oracle, with a disabling-mutant meta-suite over every honesty rule.

This is a design and verification map, not an execution claim: no suites were run while authoring it.

### 1.1 In Scope

- Per-step ingest over the delivered opencode streaming seam: five token classes (input, output, reasoning, cache-read, cache-write), calls, and per-model cost in harness-reported units, counted per step (F-1, AC-F1-1, DM-1).
- Omission and drift degradation: closed-vocabulary warnings with counts; missing values excluded from sums; never fabricated to zero or estimated; frame drift never silently dropped (F-1, AC-F1-1, RSK-1, RSK-7, §10).
- Ingest non-interference: the delivered stream-drain, handle-acquisition, and terminal-completion behavior is unchanged on all three committed fixture shapes; per-frame work is bounded and constant-memory (NFR-5, RSK-5).
- Ingest failure accounting: captured / degraded / failed counts disclosed; ingest failures never change the delivery's outcome or verdict (§10).
- Five-dimension attribution: ticket, repository, lane, agentRole, model on every stored step plus step timing; attribution derived from session economics and command-audit identity (runId, claimed agent role, lane); unattributable steps classified degradation by reason, never misattributed (F-2, AC-F2-1, DM-1, RSK-3).
- Timing capture: per-phase start/end/duration from the delivered `phase.transition` history; stall and restart intervals from the delivered economics records; no re-estimation when a delivered record exists (F-3, AC-F3-1, DM-2).
- Schema-versioned local event storage: version bump N→N+1 migrates by re-reading the versioned source; every record stays attributable; no silent data loss; brand-neutral schema naming (F-4, AC-F4-1, DM-5, §21).
- Storage coexistence: delivered closeout-time capture stays readable beside v2 stream ingest; the reconciliation disclosure names the reading basis (stream ingest, closeout capture, or declared combination) (§7.1, §8.5, RSK-2).
- Storage discipline: malformed or unknown telemetry records classify as state errors, never admitted or silently dropped; growth linear with captured steps; retention follows the state-layer convention; no unbounded derived projections (§21, NFR-8).
- Spend v2 read side: token and cost totals; breakdowns per ticket/repository/lane/role/model with all five present in the machine report and sums equal to totals; per-role and per-model breakdowns (the ticket AC); per-phase timing summaries; unknown breakdown field refused with a classified input error before any read (F-5, AC-F5-1, AC-F5-3, DM-6).
- v1 additive compatibility: the v1 grammar (`--ref`, `--phase`, `--amplification`, `--json`) and the six-key payload keep valid and readable unchanged; `delivery.spend.v1` identity is kept with additions beside the six keys, no renames or collisions (DEC-6, AC-F5-2, v1-compatibility KPI).
- Reconciliation: observed totals vs the sum of harness-reported session totals attributed to the delivery, compared once for a single verdict; tolerance ≤ 0.02 declared and stated with every summary; `within` on the pinned scenario; the declared outside verdict rendered in the same disclosure when deviation exceeds tolerance; a baseline session without a harness-reported total excluded with a closed-vocabulary warning and named count; no baseline at all → classified reconciliation unavailability, never verdict `within` (F-6, AC-F6-1, AC-F6-2, NFR-1, DM-3, DEC-2, DEC-5, RSK-4).
- Classified absence and damage: `spend.telemetry-absent` at exit 1 with no zero-valued report for a selection with no telemetry records of either plane; store damage keeps delivered `state.*` identities, never re-projected as absence (F-7, AC-F7-1, DM-4, SC-M2-S14-02).
- Non-opencode fold basis (DEC-4): closeout-captured v1 records fold into the v2 report with classified degradation for missing lane/per-step detail and the closeout-capture reading basis named — never classified as absence.
- Consumer citation: retro evidence pass records per-role/model numbers, timing summaries, and the reconciliation verdict as collector-truth evidence and cites them; the brief cites the numbers with the reconciliation disclosure and renders classified absence; the status digest section 8 projection stays fed by the same fold (command and digest agree) (F-8, AC-F8-1, AC-F8-2, §7.1).
- Disclosure invariants: every rendered summary (command, digest projection, brief, retro citation) states the telemetry state and the reconciliation tolerance; the tolerance is never applied silently (AC-N1-1, §10).
- NFR battery: bounded deterministic output with totals and verdict never truncated (NFR-2); byte-identical repeat renders with injected clock and run id and zero model calls (NFR-3); read latency p95 ≤ 500 ms at 1,000 records and ≤ 2 s at 10,000 with one verified read per record family (NFR-4); offline hermeticity (NFR-6); privacy — aggregates, identity references, and time windows only, redaction chokepoint composing unchanged (NFR-7); linear storage growth (NFR-8).
- Invocation audit: every spend/ingest-invocation path lands its delivered command-audit record; an audit-write failure is a diagnostic that never changes the outcome (§10).
- Conformance: brand-neutral naming, error-table machine/documented sync for any additive spend error-row refinement, no exit literals outside the projection module, forbidden-literal and content-inventory conformance for files this change introduces (testing strategy §4, §21, §16).
- Test evidence for the pinned scenarios SC-M2-S14-01 and SC-M2-S14-02 and every binding acceptance criterion, offline on committed stream fixtures and fixture-seeded stores (§7.1, §19).

### 1.2 Out of Scope & Known Gaps

- [OUT] Alarm and metric layers — ceremony share, cycle time, CI failure rate, escaped defects, burn-rate alarms (NG-1, M2-S6). No test asserts them; they consume S14 telemetry later.
- [OUT] Harness-store re-query on the spend read path (NG-2). Tested only as an absence of reads where the v1 log-only rule applies; stream ingest is capture-time work and is never exercised as read-time probing.
- [OUT] Stream ingest for non-opencode harnesses (NG-2/NG-3, DEC-3). The Claude Code path is tested only through the DEC-4 fold basis (TC-TELEMETRY-018), never through stream capture.
- [OUT] Currency normalization, re-pricing, or cross-model cost conversion (NG-4). Cost is asserted as harness-reported units passed through, and as excluded-and-disclosed when missing.
- [OUT] Provider peak pausing and the zero-spend assertion (NG-5, M2-S17); cross-repository or project-group aggregation (NG-6, M2-S18/M2-S19); retro ceremony/action registry/memory changes (NG-7, M2-S3/M2-S8/M2-S10 — the retro pipeline gains an evidence source only); board/queue surfaces (NG-8); backfill of historical sessions (NG-9); semantic-duplication proof (NG-10).
- [OUT] Capture into the memory change capsule (§7.2). The capsule is asserted unchanged; telemetry stays in its own versioned event storage.
- [OUT] Real harness stores, live sessions, provider calls, network I/O, credentials, and real user state directories (NFR-6). Every path is proven on committed fixtures and fixture-seeded temp stores.
- [GAP-1 — implementation-plan mapping — PENDING] `chg-GH-291-plan.yaml` is authored in `delivery_planning` (phase 4) and does not exist yet. It must map `TC-TELEMETRY-001..039` onto phases without reshaping any TC's behavior, oracle, identity, exit, bound, or AC/NFR mapping, and it must resolve the pm-notes TO-CONFIRM (baseline source per plane, OQ-T2 below). Any later plan that changes a pinned contract reopens this test plan.
- [GAP-2 — delivery-bound, non-blocking: token/cost-bearing step-frame fixtures] The three committed v2.2.5 captures (`tests/fixtures/harness/stream/opencode-v2.2.5.jsonl`, `-tool-error.jsonl`, `-stream-error.jsonl`) pin the frame framing (`step_start`, `text`, terminal `step_finish` with `part.reason === "stop"`, top-level `sessionID`, the `error` event shape) but their `step_finish` parts carry no token/cost payload, so the counting contract's positive path has no committed capture today. Delivery must extend the set deliberately per `tests/fixtures/harness/stream/README.md` (real v2.x.y capture with token-bearing step frames, synthetic redacted content, provenance updated, one shape per file). Until then: framing/omission/drift tests run on the committed set plus shape-preserving synthetic frames built through the committed scenario module (`tests/fixtures/harness/scenarios/stream.ts`); positive-path counting tests (TC-TELEMETRY-001, TC-TELEMETRY-014, TC-TELEMETRY-019) declare the extended capture as their fixture prerequisite.
- [GAP-3 — delivery-bound, non-blocking: NFR-4 is runner-dependent] The p95 ≤ 500 ms at 1,000 records and ≤ 2 s at 10,000 records thresholds depend on runner capacity. The CI oracle is **bounded work** (one verified read per record family per invocation, one fold, no per-record re-reads, no network) plus a soft local budget; a generated-fixture reference measurement is recorded in §10 and never reported as a passing threshold.
- [GAP-4 — delivery-bound, non-blocking: exact closed-vocabulary warning strings] The spec requires a closed reason vocabulary for omissions, drift, unattributable steps, excluded baseline sessions, and truncation, but does not pin the exact reason strings. The plan asserts the *obligations* (closed set, per-reason count, no fabrication) through contract constants declared once in the telemetry contract module and asserted through those constants; exact strings are pinned together with the contract suite (TC-TELEMETRY-039) and goldens.
- [GAP-5 — delivery-bound, non-blocking: the declared outside-verdict value] The spec names "the declared outside verdict" without pinning the literal; it is asserted through the declared contract constant (DEC-6 pattern: declared once, asserted through the constant), pinned with TC-TELEMETRY-020's golden.
- [GAP-6 — delivery-bound, non-blocking: consumer render prose] The exact citation wording in the retro report, the brief, and digest section 8 is not spec-pinned; the plan asserts the obligations (numbers present, tolerance and verdict present, absence rendered as classified absence, no zeros) plus goldens, with prose pinned at delivery alongside the goldens.
- [GAP-7 — delivery-bound, non-blocking: telemetry storage schema-version constant naming] The storage schema version is a declared contract constant (DM-5, brand-neutral naming per §21); its exact naming is plan-level and asserted through the constant once declared (TC-TELEMETRY-010, TC-TELEMETRY-039).

## 2. References

- **Change specification**: [chg-GH-291-spec.md](./chg-GH-291-spec.md) — 13 ACs (AC-F1-1, AC-F2-1, AC-F3-1, AC-F4-1, AC-F5-1..3, AC-F6-1..2, AC-F7-1, AC-F8-1..2, AC-N1-1), F-1..F-8, DM-1..DM-6, NFR-1..NFR-8, DEC-1..DEC-6, RSK-1..RSK-7, §14 OQ-1..OQ-3 (all resolved), Appendix B (pinned scenarios verbatim), Appendix C (declared consumers).
- **Ticket**: GH-291 — M2-S14: Harness telemetry v2 (https://github.com/juliusz-cwiakalski/agentic-delivery-os/issues/291). The ticket AC decomposes per spec §17: spend reports tokens and cost per agent role and model with phase timings (AC-F5-1, AC-F3-1), reconciling within a declared tolerance (AC-F6-1, AC-F6-2), retro and brief cite the numbers (AC-F8-1, AC-F8-2), and absence remains classified (AC-F7-1).
- **PM record**: [chg-GH-291-pm-notes.yaml](./chg-GH-291-pm-notes.yaml) — DEC-1 scope supersession, the OQ-1..OQ-3 adjudications baked into the spec as DEC-4..DEC-6, and the TO-CONFIRM (baseline source per plane) handed to plan-writer (OQ-T2 below).
- **Implementation plan**: `./chg-GH-291-plan.yaml` — authored in phase 4; not yet present (GAP-1).
- **Testing strategy**: [.ai/rules/testing-strategy.md](../../../../.ai/rules/testing-strategy.md) — layers, module→test mapping, `bun:test`, permanent-suite invariant rules, `pnpm check` aggregate gate, invariant-test authoring rules.
- **TypeScript rules**: [.ai/rules/typescript.md](../../../../.ai/rules/typescript.md) — strict typing, purity, ports and adapters, the error contract, `bun:test` authoring.
- **Milestone pack (planning truth)**: [doc/planning/oss-tooling/milestones/m2/contracts.md](../../../planning/oss-tooling/milestones/m2/contracts.md) §`telemetry.v1` (attribution fields, counting, declared tolerance default ≤2%, absence, storage) and §`spend v2` (breakdown fields, additive contract, consumers — "a report without a reconciliation line is incomplete"); [test-scenarios.md](../../../planning/oss-tooling/milestones/m2/test-scenarios.md) SC-M2-S14-01/02; [commands/spend.md](../../../planning/oss-tooling/milestones/m2/commands/spend.md).
- **Current system truth — spend read side**: [feature-spend.md](../../../spec/features/feature-spend.md) — the v1 fold, the six-key `delivery.spend.v1` payload, `spend.telemetry-absent` at exit 1, state-damage projections, phase attribution windows.
- **Current system truth — harness adapters**: [feature-harness-adapters.md](../../../spec/features/feature-harness-adapters.md) — the streaming seam, step-frame decoding, extractors, closeout capture point, warning vocabulary, five token classes.
- **Current system truth — session economics**: [feature-session-lifecycle-economics.md](../../../spec/features/feature-session-lifecycle-economics.md) — restart/exhaustion records, corroborated stall evidence, per-delivery economics view under `economics/<ref>`.
- **Current system truth — closeout, retro, brief, state layer, result contract**: [feature-closeout.md](../../../spec/features/feature-closeout.md) (delivered capture v2 coexists with), [feature-retro-pipeline.md](../../../spec/features/feature-retro-pipeline.md) (evidence source set growing additively), [feature-brief.md](../../../spec/features/feature-brief.md) (closed surface catalog growing only through this change), [feature-state-layer.md](../../../spec/features/feature-state-layer.md) (verified reads, fenced appends, `state.*` failures), [feature-result-contract.md](../../../spec/features/feature-result-contract.md) (envelope, error table, exit projection, redaction chokepoint).
- **Contracts and seams consumed**: `packages/core/src/contracts/harness-telemetry.ts` (token classes, warning reasons, telemetry record shapes), `packages/core/src/state/harness-telemetry.ts` (delivered capture/read seam), `packages/core/src/contracts/spend.ts` and `packages/core/src/state/spend-reads.ts` (v1 fold being extended), `packages/core/src/contracts/economics.ts` and `packages/core/src/state/economics.ts` (restart/exhaustion/stall records), `packages/core/src/contracts/audit.ts` (runId, claimed identity), `packages/core/src/contracts/registry.ts` (`phase.transition` history), `packages/core/src/contracts/error-table.ts` (rows, projection classes), `packages/core/src/contracts/result.ts` (`delivery.result.v1` envelope), `packages/core/src/contracts/retro.ts` (evidence source set), `packages/core/src/contracts/brief.ts` and `packages/core/src/contracts/status.ts` (render surfaces).
- **Committed stream fixtures (single stream oracle)**: `tests/fixtures/harness/stream/opencode-v2.2.5.jsonl` (clean stop), `opencode-v2.2.5-tool-error.jsonl` (tool error then terminal stop), `opencode-v2.2.5-stream-error.jsonl` (provider stream error, no terminal step) — with provenance and the deliberate-regeneration discipline in `tests/fixtures/harness/stream/README.md`; synthetic frame construction via `tests/fixtures/harness/scenarios/stream.ts`. Token/cost-bearing step frames are the GAP-2 extension.
- **Existing evidence to extend (not replace)**: `tests/behaviour/spend-*.test.ts` (absent, breakdown, degradation, cost-omission, envelope, grammar, bounds, determinism, privacy, read-contract, readonly, ref-resolution, restarts, run-substrate, store-damage, phase-attribution, phase-fallback, phase-filter, amplification-*, disclosure, performance); `tests/behaviour/harness-opencode-stream.test.ts`, `harness-opencode-resume-stream.test.ts`, `harness-stream-hygiene.test.ts`, `harness-host-stream.test.ts`, `harness-telemetry-*.test.ts`, `economics-*.test.ts`; `tests/behaviour/status-spend-{section,parity,degraded}.test.ts`; `tests/behaviour/retro-*.test.ts`, `brief-*.test.ts`; `tests/structure/{spend-contract,spend-imports,harness-contract,harness-stream-contract,error-table,envelope-contract,result-contract}.test.ts`; `tests/checks/{spend-mutants,error-table-sync,exit-code-literals,forbidden-literals,privacy-literals,fixture-privacy}.test.ts`; `tests/golden/{spend,status-digest,brief}.test.ts`; `tests/fixtures/state/harness.ts`, `tests/fixtures/closeout/harness-telemetry.ts`.
- **Closest delivered precedent**: [chg-GH-236-test-plan.md](../2026-11-07--GH-236--spend-read-side/chg-GH-236-test-plan.md) — the v1 spend fold this change extends additively; its fixture contract, non-vacuity contract, oracle matrices, and mutant discipline are mirrored here.

## 3. Coverage Overview

### 3.1 Functional Coverage (F-#, AC-#)

| AC ID | Criterion (abbreviated) | TC ID(s) | Status |
|-------|--------------------------|----------|--------|
| AC-F1-1 | Per-step capture of the five token classes, calls, and per-model cost in harness-reported units; a frame omitting a class/field degrades with a closed-vocabulary warning and the missing value is excluded from sums — never fabricated to zero or estimated | TC-TELEMETRY-001, TC-TELEMETRY-002, TC-TELEMETRY-003, TC-TELEMETRY-038 | Covered |
| AC-F2-1 | Every stored record carries ticket/repository/lane/agentRole/model + step timing; an unattributable step is counted as classified degradation and never attributed to a wrong dimension | TC-TELEMETRY-006, TC-TELEMETRY-007, TC-TELEMETRY-008, TC-TELEMETRY-038 | Covered |
| AC-F3-1 | Per-phase timing summaries carry start/end/duration; stall and restart intervals reflect the delivered economics records rather than re-estimation | TC-TELEMETRY-009, TC-TELEMETRY-038 | Covered |
| AC-F4-1 | A storage version bump N→N+1 migrates by re-reading the versioned source; every record remains attributable with no silent data loss | TC-TELEMETRY-010, TC-TELEMETRY-038 | Covered |
| AC-F5-1 | `spend --ref <ref>` states token and cost totals, per-role and per-model breakdowns whose token sums equal the totals, and per-phase timing summaries | TC-TELEMETRY-014, TC-TELEMETRY-015 | Covered |
| AC-F5-2 | The v1 grammar and six-key `delivery.spend.v1` payload remain valid and readable unchanged; all v2 additions strictly additive under `data` (DEC-6) | TC-TELEMETRY-017, TC-TELEMETRY-038 | Covered |
| AC-F5-3 | A breakdown field outside the five declared dimensions is refused with a classified input error before any read | TC-TELEMETRY-016 | Covered |
| AC-F6-1 | **Pinned SC-M2-S14-01** — totals reconcile within the declared tolerance; `data.reconciliation.verdict == "within"` and `data.reconciliation.tolerance` ≤ 0.02, stated in the line | TC-TELEMETRY-019, TC-TELEMETRY-021 | Covered |
| AC-F6-2 | Observed deviation beyond tolerance renders the declared outside verdict in the same disclosure — never silently tolerated or rendered as within | TC-TELEMETRY-020, TC-TELEMETRY-038 | Covered |
| AC-F7-1 | **Pinned SC-M2-S14-02** — no telemetry records → exit 1, `error.code == "spend.telemetry-absent"`, no zero-valued report; damage never re-projected as absence; non-opencode fold is degradation, not absence (DEC-4) | TC-TELEMETRY-025, TC-TELEMETRY-026, TC-TELEMETRY-018 | Covered |
| AC-F8-1 | The retro evidence pass records per-role/model numbers, timing summaries, and the reconciliation verdict as collector-truth evidence, cited in the retro report | TC-TELEMETRY-027 | Covered |
| AC-F8-2 | The brief cites the spend numbers with the reconciliation disclosure; with telemetry absent it renders the classified absence instead of zeros | TC-TELEMETRY-028, TC-TELEMETRY-029 | Covered |
| AC-N1-1 | Every rendered summary (command, digest projection, brief, retro citation) states the telemetry state and the tolerance; no path applies the tolerance silently | TC-TELEMETRY-031, TC-TELEMETRY-019, TC-TELEMETRY-030 | Covered |

**Ticket-AC traceability (verbatim, binding).**

| Ticket AC | Covered by | How the plan proves it |
|---|---|---|
| "spend reports tokens and cost per agent role and model with phase timings" | TC-TELEMETRY-014, TC-TELEMETRY-015, TC-TELEMETRY-009 | Hand-summed totals oracle on a fixture-seeded store; per-role and per-model breakdown sums asserted equal to totals; per-phase start/end/duration derived from seeded transition history |
| "totals reconcile within a declared tolerance" | TC-TELEMETRY-019, TC-TELEMETRY-020, TC-TELEMETRY-021, TC-TELEMETRY-022, TC-TELEMETRY-023 | The reconciliation verdict matrix R-01..R-08: pinned within case, declared outside case, summed multi-session baseline, excluded-gap warning, baseline-less unavailability |
| "retro and brief cite the numbers" | TC-TELEMETRY-027, TC-TELEMETRY-028, TC-TELEMETRY-030 | Retro sidecar records the figures as collector-truth evidence and the report cites them; brief citation with disclosure; digest parity from the same fold |
| "absence remains classified" | TC-TELEMETRY-025, TC-TELEMETRY-026, TC-TELEMETRY-029, TC-TELEMETRY-018 | The exit oracle E-01..E-05: absence at exit 1 with no zeros, damage keeps `state.*`, brief absence rendering, DEC-4 fold-not-absence boundary |

**Capability coverage** (no capability unlinked): F-1 → TC-TELEMETRY-001..005; F-2 → TC-TELEMETRY-006..008; F-3 → TC-TELEMETRY-009; F-4 → TC-TELEMETRY-010, 012, 013; F-5 → TC-TELEMETRY-014..018; F-6 → TC-TELEMETRY-019..024; F-7 → TC-TELEMETRY-025, 026; F-8 → TC-TELEMETRY-027..031.

All 13 acceptance criteria map to at least one automated case and none carries a TODO. Both pinned milestone scenarios are dedicated cases with their verbatim assertions (TC-TELEMETRY-019, TC-TELEMETRY-025).

### 3.2 Interface Coverage (API-#, EVT-#, DM-#)

The specification declares no HTTP endpoint (§8.1: N/A) and adds no message/event bus element (§8.2 elements are the inbound harness stream, storage records, and derived disclosures, all covered below).

| Interface / data model | Description | TC ID(s) | Status |
|------------------------|-------------|----------|--------|
| Inbound — opencode v2.x.y JSONL step frames (§8.2) | Read-only consumption over the delivered streaming seam; per-step classes/calls/cost; drift degrades with closed-vocabulary warnings | TC-TELEMETRY-001..005 | Covered |
| DM-1 — Telemetry step record | Five token classes, calls, per-model cost (harness-reported units), the five attribution fields, step timing, closed-vocabulary warnings | TC-TELEMETRY-001, TC-TELEMETRY-002, TC-TELEMETRY-006 | Covered |
| DM-2 — Phase timing summary | Per-phase start/end/duration from `phase.transition`; stall/restart intervals from delivered economics records | TC-TELEMETRY-009, TC-TELEMETRY-014 | Covered |
| DM-3 — Reconciliation block | Harness session totals (summed baseline), observed totals, tolerance ≤ 0.02, single verdict or classified unavailability; required in every summary | TC-TELEMETRY-019..024, TC-TELEMETRY-031 | Covered |
| DM-4 — Telemetry state disclosure | `present` or the classified absence kind in every summary; absence never a zero report | TC-TELEMETRY-025, TC-TELEMETRY-031 | Covered |
| DM-5 — Storage schema version | Declared schema version on the telemetry storage; bump migrates by re-reading; brand-neutral naming | TC-TELEMETRY-010, TC-TELEMETRY-039 | Covered |
| DM-6 — Spend v2 additive data | Breakdown arrays over the five dimensions, timing summaries, reconciliation block, telemetry-state disclosure, cost-bearing totals — added under `data` beside the six v1 keys (DEC-6) | TC-TELEMETRY-014, TC-TELEMETRY-015, TC-TELEMETRY-017 | Covered |
| Storage — schema-versioned event records (§8.2) | Fenced/verified appends per the delivered state discipline; damage classifies | TC-TELEMETRY-010, TC-TELEMETRY-012, TC-TELEMETRY-013 | Covered |
| Derived — retro evidence records (§8.2) | Telemetry figures recorded through the delivered retro evidence append seam | TC-TELEMETRY-027 | Covered |
| Render — brief/status projections (§8.2) | Brief citation; digest section 8 fed by the same fold | TC-TELEMETRY-028..030 | Covered |

### 3.3 Non-Functional Coverage (NFR-#)

| NFR | Requirement (threshold) | TC ID(s) | Status |
|-----|--------------------------|----------|--------|
| NFR-1 | Tolerance defaults ≤ 0.02 of harness-reported session totals; stated with every summary; SC-M2-S14-01 pins `data.reconciliation.tolerance` ≤ 0.02 | TC-TELEMETRY-019, TC-TELEMETRY-020, TC-TELEMETRY-031 | Covered |
| NFR-2 | Machine report ≤ 65,536 UTF-8 bytes; human digest ≤ 16,384 bytes and ≤ 200 lines; truncation deterministic, tail-ordered, marked; totals and the reconciliation verdict never truncated | TC-TELEMETRY-033, TC-TELEMETRY-038 | Covered |
| NFR-3 | Byte-identical repeat renders for identical stored telemetry, injected clock, and injected run id; zero model calls on any render path | TC-TELEMETRY-032 | Covered |
| NFR-4 | p95 ≤ 500 ms at 1,000 records and ≤ 2 s at 10,000 (reference environment); one verified read per record family, no per-record re-reads | TC-TELEMETRY-034 | Covered by bounded work in CI plus a non-CI reference measurement (GAP-3) |
| NFR-5 | Per-frame ingest adds no blocking work that changes the delivered stream-drain, handle-acquisition, or output-bound behavior; bounded constant-memory work per frame | TC-TELEMETRY-004 | Covered |
| NFR-6 | 100% of new tests offline on committed fixtures and fixture-seeded stores; zero live harness stores, credentials, or network on any test path | TC-TELEMETRY-036, TC-TELEMETRY-004 | Covered |
| NFR-7 | Records and reports carry aggregate counts, identity references, and time windows only — never prompt text, message bodies, transcripts, diffs, tool output, or credential material; redaction chokepoint composes unchanged | TC-TELEMETRY-035 | Covered |
| NFR-8 | Storage grows linearly with captured steps; retention follows the state-layer convention; no unbounded derived projections | TC-TELEMETRY-013 | Covered |

### 3.4 Gap Check (coverage-matrix integrity)

- **Uncovered ACs**: none. All 13 are mapped; none carries a TODO.
- **Orphan TCs**: none. Every TC names at least one AC, DM, or NFR in §5.1 and §5.2.
- **Uncovered NFRs**: none. NFR-4's wall-clock half is explicitly reference-only (GAP-3); its CI-verifiable bounded-work half is asserted (TC-TELEMETRY-034).
- **Uncovered DMs**: none (DM-1..DM-6 all mapped).
- **Gap status**: GAP-1 (plan mapping) is phase-4-pending; GAP-2 (token/cost fixture extension), GAP-3 (NFR-4 measurement), GAP-4 (warning strings), GAP-5 (outside-verdict constant), GAP-6 (render prose), GAP-7 (schema-version constant naming) are delivery-bound and non-blocking, each with a named oracle and owner. No AC or assertion carries a TODO.
- **Intentional duplicate coverage**: AC-F1-1 spans four TCs because the counting arithmetic, the omission degradation, the drift degradation, and the mutant guard fail independently; AC-F2-1 spans three because the attribution fields, the no-misattribution rule, and the substrate join are separate failure modes; AC-F6-1 spans two because the pinned single-session verdict and the summed multi-session baseline (DEC-5) are separately falsifiable; AC-F7-1 spans three because the absence outcome, the damage/absence boundary, and the DEC-4 fold/absence boundary are distinct guarantees.
- **Spec-named behavior bound to an existing AC/NFR** (no dedicated AC by design):

| Behavior | Spec source | Bound AC/NFR | Where |
|---|---|---|---|
| Ingest failure counts (captured/degraded/failed) never change the delivery's outcome or verdict | §10 | F-1, NFR-5 | TC-TELEMETRY-005 |
| Audit-write failure is a diagnostic, never changes outcome/exit | §10 | AC-N1-1 | TC-TELEMETRY-037 |
| Reading basis named in the disclosure (stream ingest / closeout capture / declared combination) | §8.5, RSK-2, DM-3 | AC-F6-1, AC-F7-1 | TC-TELEMETRY-011, TC-TELEMETRY-018, TC-TELEMETRY-024 |
| Malformed/unknown telemetry records classify as state errors, never admitted or dropped | §21 | F-4 | TC-TELEMETRY-012 |
| Brand-neutral naming; no hardcoded product/binary names | §21 | F-4 | TC-TELEMETRY-039 |
| Status digest section 8 parity from the same fold | §7.1 | AC-F8-2, AC-N1-1 | TC-TELEMETRY-030 |
| Per-session reconciliation figures are diagnostic only | DEC-5 | AC-F6-1 | TC-TELEMETRY-021 |
| Harness totals present but no telemetry records → absence still classifies | DEC-4 | AC-F7-1 | TC-TELEMETRY-025 (matrix S-06) |
| Planning-page maintenance (backlog markers, status snapshot, stale ownership line) | §7.1, DEC-1 | docs layer | §4 layer table (manual content check) |

## 4. Test Types and Layers

| Layer | Runner / invocation | Location | Covers |
|-------|--------------------|----------|--------|
| Contract and vocabulary | `bun test tests/structure` | `tests/structure/telemetry-contract.test.ts` (new); `tests/structure/spend-contract.test.ts` (update) | TC-TELEMETRY-001 (contract half), TC-TELEMETRY-015, TC-TELEMETRY-017, TC-TELEMETRY-039 |
| Boundary, purity and confinement | `bun test tests/structure tests/boundaries`; `bun run scripts/checks/{ambient-globals,exit-code-literals,forbidden-literals}.ts` | `tests/structure/telemetry-imports.test.ts` (new); `tests/structure/content-inventory.test.ts` (update) | TC-TELEMETRY-039 (static half), TC-TELEMETRY-036 (static half) |
| Error identity and sync | `bun test tests/checks`; `bun run scripts/checks/error-table-sync.ts` | `tests/checks/error-table-sync.test.ts` (update if additive rows land) | TC-TELEMETRY-016, TC-TELEMETRY-025, TC-TELEMETRY-039 |
| Behaviour — ingest and attribution | `bun test tests/behaviour` | `tests/behaviour/telemetry-{ingest,attribution}.test.ts` (new) | TC-TELEMETRY-001..008 |
| Behaviour — timing and storage | `bun test tests/behaviour` | `tests/behaviour/telemetry-{timing,storage-migration,storage-coexistence,storage-damage,storage-growth}.test.ts` (new) | TC-TELEMETRY-009..013 |
| Behaviour — spend v2 read side | `bun test tests/behaviour` | `tests/behaviour/spend-v2-{breakdown,refusals,v1-compat,fold-basis}.test.ts` (new) | TC-TELEMETRY-014..018, TC-TELEMETRY-024 |
| Behaviour — reconciliation | `bun test tests/behaviour` | `tests/behaviour/spend-reconciliation.test.ts` (new) | TC-TELEMETRY-019..023 |
| Behaviour — absence and damage | `bun test tests/behaviour` | `tests/behaviour/spend-absent.test.ts`, `tests/behaviour/spend-store-damage.test.ts` (update) | TC-TELEMETRY-025, TC-TELEMETRY-026 |
| Behaviour — consumer surfaces | `bun test tests/behaviour` | `tests/behaviour/retro-telemetry-evidence.test.ts`, `tests/behaviour/brief-spend-citation.test.ts` (new); `tests/behaviour/status-spend-{section,parity,degraded}.test.ts` (update) | TC-TELEMETRY-027..030 |
| Behaviour — disclosure invariants | `bun test tests/behaviour` | `tests/behaviour/telemetry-disclosure.test.ts` (new) | TC-TELEMETRY-031 |
| Behaviour — determinism, bounds, latency, privacy, audit | `bun test tests/behaviour` | `tests/behaviour/telemetry-{determinism,privacy,audit-compose}.test.ts` (new); `tests/behaviour/spend-{bounds,performance,determinism}.test.ts` (update) | TC-TELEMETRY-032..035, TC-TELEMETRY-037 |
| Golden | `bun test tests/golden` | `tests/golden/spend.test.ts`, `tests/golden/status-digest.test.ts`, `tests/golden/brief.test.ts` (update) | TC-TELEMETRY-019, TC-TELEMETRY-020, TC-TELEMETRY-028..030 |
| Mutant meta-suite | `bun test tests/checks` | `tests/checks/telemetry-mutants.test.ts` (new; extends the `tests/checks/spend-mutants.test.ts` pattern) | TC-TELEMETRY-038 |
| Hermeticity | `bun test tests/checks` | `tests/checks/telemetry-hermetic.test.ts` (new; the `daemon-hermetic`/`provider-hermetic` pattern) | TC-TELEMETRY-036 |
| Documentation/help surface and planning pages | Manual + static content check (testing strategy layer 2) | `--help` golden, reference pages, `doc/planning/oss-tooling/` backlog markers and status snapshot | §1.1 docs items; TC-TELEMETRY-039 (inventory half) |
| Aggregate and non-regression | `pnpm check` (per pm-notes delivery conventions: `TMPDIR=$PWD/tmp/tmpdir pnpm check`) | repo root; unchanged gates (`lint → format:check → typecheck → test → check:boundaries`) | All TCs (regression half) |

### 4.1 Fixture and Harness Contract (binding for every telemetry TC)

1. **No real harness, network, credential, or user state directory.** Every suite imports production modules and injects fakes plus a per-test temp root. No suite opens a harness store, reads `$HOME`, resolves a credential, or opens a socket (NFR-6).
2. **Stream oracle is the committed fixture set.** Framing tests read `tests/fixtures/harness/stream/opencode-v2.2.5{,-tool-error,-stream-error}.jsonl`; synthetic frames are built only through the committed scenario module `tests/fixtures/harness/scenarios/stream.ts`, never by ad-hoc JSON literals scattered through suites. Token/cost-bearing positive-path fixtures are the deliberate README-disciplined extension (GAP-2) with provenance recorded.
3. **One temp state store per case.** Telemetry, economics, transition history, audit, and closeout-captured v1 records are seeded through the delivered append paths (or fixture builders composing them), so every fold reads records the production writers could have produced: `tests/fixtures/state/harness.ts` for the temp root/store/identity primitives, `tests/fixtures/closeout/harness-telemetry.ts` for v1 capture records, and a new `tests/fixtures/telemetry/` builder for v2 step records, harness-reported session totals, and the economics/audit substrate.
4. **Injected time, ids and brand.** A fixed `NOW_MS`; captured-at and frame timestamps are literal fixture constants, never `Date.now()`; run ids and session ids are fixed sequences; the brand is a synthetic brand constant. Ordering fixtures use deliberately non-time-sortable ids so a sortability assumption fails.
5. **Independent arithmetic oracle.** Expected class sums, calls, cost totals, breakdown sums, timing durations, and the reconciliation deviation percentage are computed in each test from the fixture definition's hand-written constants — never by calling the production fold and never by summing the same array the production code sums.
6. **Recorded arguments over inference.** Where an AC concerns what a seam receives (which family was read for which ref, whether a frame was consumed, whether a model call or network open was attempted), the test asserts the recorded argument or the recorded absence.
7. **Temp roots only.** Goldens, mutant copies, and whole-tree scans use `mkdtemp` under the OS temp directory or committed read-only fixtures. The live tree and the user's real state directory are never written.
8. **Fixture privacy.** Every new fixture passes the fixture-privacy scan discipline (`tests/checks/fixture-privacy.test.ts`): synthetic, redacted content only — no real session ids, credentials, or personal data (extends the committed stream-fixture provenance rules).

### 4.2 Non-Vacuity Contract (binding for every absence, damage, refusal, bound, and formula case)

1. **A planted positive is asserted before the absence.** Before asserting `spend.telemetry-absent`, a paired control with one seeded v1 or v2 record renders a report; before asserting zero fabrication, a fixture with present values asserts non-zero sums; before asserting truncation, an under-cap render is asserted untruncated.
2. **A paired live control runs in the same test.** Every absent case beside a present case; every damaged store beside a healthy store; every refusal beside the accepted invocation; every outside-tolerance fixture beside the within-tolerance fixture; every omitted-field frame beside a complete frame.
3. **A disabling mutant must fail the suite (TC-TELEMETRY-038).** Temp mutant copies of the production modules (the `tests/golden/redaction.test.ts` import pattern) disable one honesty rule each (§5.2 TC-TELEMETRY-038 list). Each mutant must produce the prohibited observable while the fixture is unchanged; if the real module also produced nothing, the suite fails.
4. **Permutation invariance is asserted, not assumed.** The same step set appended in shuffled order must produce byte-identical stored summaries and reports; a fixture whose expected result depends on append order fails.
5. **Bounds are measured, never assumed.** Byte bounds are measured on serialized UTF-8 bytes with a positive measured length asserted first; line bounds by counting rendered lines.
6. **No assertion depends on a moving base.** Every assertion reads the current tree, a committed fixture, or an isolated temp copy; no `git diff` against `origin/main-tools` appears in the permanent suite (testing strategy §In invariant-test authoring).

### 4.3 Reconciliation Verdict Matrix (binding for AC-F6-1, AC-F6-2, DEC-2, DEC-5)

`B` is the harness-reported session total(s) attributed to the delivery; `O` is the observed total; deviation = |O − B| ÷ B. Tolerance constant T = 0.02 (DEC-2).

| ID | Fixture shape | Expected outcome | Never |
|---|---|---|---|
| R-01 | O == B exactly (single session) | `verdict == "within"`, `tolerance == 0.02` stated in the block and in the human line (SC-M2-S14-01 verbatim) | A missing tolerance or an unstated verdict |
| R-02 | O = B × 1.01 (within tolerance) | `within` | Silently widening T |
| R-03 | O = B × 1.05 (beyond tolerance) | the declared outside verdict in the same block with the same stated tolerance and both figures | Rendering `within`; hiding the deviation; an error exit for a stated outcome |
| R-04 | Two sessions, both with harness totals; O = sum(B₁+B₂) within tolerance | exactly one verdict over the summed baseline; per-session figures present as diagnostics only (DEC-5) | Two verdicts; per-session forking of the pinned assertion |
| R-05 | Two sessions; B₂ missing its harness total; O within tolerance of B₁ | B₂ excluded from the baseline with a closed-vocabulary warning and the excluded count named (1); verdict over the remaining baseline | Fabricating B₂; counting B₂ as zero silently; losing the warning |
| R-06 | Telemetry records present, no harness-reported baseline at all | the reconciliation block declares its classified unavailability; report still renders at exit 0 | Verdict `within`; a fabricated baseline; suppressing the disclosure (a report without a reconciliation line is incomplete) |
| R-07 | Both planes present (stream ingest + closeout capture); combined reading | reading basis named as the declared combination; divergence beyond tolerance surfaces the outside verdict (RSK-2 double-count exposure) | Double-counted O passing as `within` beyond T without an outside verdict |
| R-08 | Cost-sparse dataset (token totals reconcile; cost fields mostly missing) | token reconciliation verdicts computed; cost sparsity disclosed, never repaired to zero (RSK-7) | Cost fabricated to make cost reconciliation pass |

### 4.4 Telemetry-State and Fold-Basis Matrix (binding for AC-F5-2, AC-F7-1, DEC-4, RSK-2)

| ID | Store condition | Expected outcome | Exit | Never |
|---|---|---|---|---|
| S-01 | v2 stream-ingested records only | report renders; `telemetryState` present; reading basis names stream ingest | 0 | An unnamed basis; absence |
| S-02 | closeout-captured v1 records only, opencode | report renders from v1 records; reading basis names closeout capture; degradation disclosed for missing lane/per-step detail | 0 | Classifying v1-only as absence |
| S-03 | closeout-captured v1 records only, non-opencode harness | identical to S-02 — fold with classified degradation and named basis (DEC-4) | 0 | `spend.telemetry-absent` for captured records |
| S-04 | both planes present | declared combination basis; reconciliation exposes divergence (R-07) | 0 | Silent double counting |
| S-05 | no telemetry records of either plane for the ref | `spend.telemetry-absent`, no zero-valued report (SC-M2-S14-02 verbatim) | 1 | An empty success, zeros, or a state-damage code |
| S-06 | harness-reported session totals exist but no telemetry records | `spend.telemetry-absent` — absence keys off telemetry records, not harness totals (DEC-4) | 1 | A report "reconciling" against totals with no telemetry |
| S-07 | torn / schema-mismatch / unknown-kind store | the delivered `state.*` identity for each damage class | 2 | Re-projecting damage as absence (F-7) |
| S-08 | permission-denied store | `state.permission.denied` with its delivered projection | 1 | Inventing a v2 row or exit change |
| S-09 | records exist for a different ref only | `spend.telemetry-absent` for the selection; other-ref figures nowhere | 1 | Prefix-match scoping leakage |

### 4.5 Ingest Degradation Matrix (binding for AC-F1-1)

| ID | Frame condition | Expected ingest outcome | Never |
|---|---|---|---|
| I-01 | step frame carrying all five classes, calls, and per-model cost | values counted per step; stored; no warning | Re-pricing, conversion, or rounding beyond harness-reported units |
| I-02 | frame omitting one token class | closed-vocabulary warning; that class excluded from sums; other classes counted | Fabricating 0 into the sum for the omitted class |
| I-03 | frame omitting cost | warning; cost excluded (null-when-missing); token sums intact | Cost synthesized from tokens or a pricing table (NG-4) |
| I-04 | frame omitting calls | warning; calls excluded from totals | Calls defaulted to 1 or 0 silently |
| I-05 | unknown/extra frame shape (version drift) | drift warning with count; ingest continues; known fields still counted | Silent skip; ingest abort; fabricated placeholders (RSK-1) |
| I-06 | undecodable frame (ingest failure) | failed count incremented; classified outcome; counts captured/degraded/failed disclosed (§10) | Delivery outcome or verdict changed by an ingest failure |
| I-07 | same steps appended in shuffled order | byte-identical stored summaries and reports | Order-dependent arithmetic |

### 4.6 Exit and Identity Oracle (binding for AC-F5-3, AC-F7-1)

| Condition | Identity | Projection class | Exit | TC |
|---|---|---|---|---|
| Breakdown field outside the five declared dimensions | classified input error (the delivered input-refusal row for the spend surface) | user-validation | 1, refused before any read (zero recorded reads) | 016 |
| No telemetry records of either plane (any harness, any basis) | `spend.telemetry-absent` (delivered identity, reused not forked) | user-validation | 1, no zero-valued report | 025 |
| Torn store / wrong kind / malformed telemetry payload | the delivered `state.*` rows | platform-provider | 2 | 012, 026 |
| Permission violation on the store | `state.permission.denied` (delivered) | user-validation (delivered) | 1 | 026 |
| Reconciliation baseline unavailability | classified disclosure inside a successful report — not an error row | success | 0 | 023 |
| Success (any rendered report, including degenerate sparse-cost and unavailable-baseline reports) | — | success | 0 | 014..024, 027..033 |
| Undeclared flag / unexpected positional (v1 grammar discipline inherited) | delivered CLI-parser identities | user-validation | 1 | 017 |

**Invariants.** Exit is a pure function of the projection class. The delivered `spend.telemetry-absent` identity is reused, never forked; `state.*` identities are unchanged; any additive spend error-row refinement (§16) keeps delivered rows' category, consequence, and projection intact and syncs machine and documented tables bidirectionally. Machine consumers branch on the code, never the exit alone.

## 5. Test Scenarios

### 5.1 Scenario Index

| TC ID | Title | Type | Level | Priority | AC Coverage |
|-------|-------|------|-------|----------|-------------|
| TC-TELEMETRY-001 | Per-step counting happy path (five classes, calls, per-model cost) | Happy Path | Unit/Behaviour | High | AC-F1-1 |
| TC-TELEMETRY-002 | Omitted class/field degrades, excluded from sums, never zero | Edge Case | Unit/Behaviour | Critical | AC-F1-1 |
| TC-TELEMETRY-003 | Frame drift degrades with warning, never silent loss or fabrication | Negative | Unit/Behaviour | High | AC-F1-1 |
| TC-TELEMETRY-004 | Ingest non-interference with the delivered streaming seam | Regression | Integration | Critical | AC-F1-1, NFR-5 |
| TC-TELEMETRY-005 | Ingest failure accounting never changes delivery outcome | Negative | Behaviour | Medium | AC-F1-1 |
| TC-TELEMETRY-006 | Stored records carry the five attribution fields plus step timing | Happy Path | Unit/Behaviour | Critical | AC-F2-1 |
| TC-TELEMETRY-007 | Unattributable step is classified degradation, never misattributed | Edge Case | Unit/Behaviour | Critical | AC-F2-1 |
| TC-TELEMETRY-008 | Attribution joins session economics and command-audit identity | Happy Path | Integration | High | AC-F2-1 |
| TC-TELEMETRY-009 | Phase/stall/restart timing from delivered records, no re-estimation | Happy Path | Behaviour | Critical | AC-F3-1 |
| TC-TELEMETRY-010 | Version bump N→N+1 migrates by re-reading, no silent loss | Corner Case | Behaviour | Critical | AC-F4-1 |
| TC-TELEMETRY-011 | Coexistence with closeout capture; reading basis named | Happy Path | Integration | High | AC-F5-2, AC-F6-1 |
| TC-TELEMETRY-012 | Malformed/unknown telemetry records classify as state errors | Negative | Behaviour | High | AC-F4-1 |
| TC-TELEMETRY-013 | Linear storage growth; retention per state-layer convention | Corner Case | Behaviour | Medium | NFR-8 |
| TC-TELEMETRY-014 | Full spend v2 report: totals, breakdowns summing to totals, phase timing | Happy Path | Behaviour | Critical | AC-F5-1 |
| TC-TELEMETRY-015 | Five-dimension breakdown selection; all five in the machine report | Happy Path | Behaviour | High | AC-F5-1 |
| TC-TELEMETRY-016 | Unknown breakdown field refused pre-read with classified input error | Negative | Behaviour | High | AC-F5-3 |
| TC-TELEMETRY-017 | v1 additive compatibility: grammar, six keys, identity kept (DEC-6) | Regression | Contract/Behaviour | Critical | AC-F5-2 |
| TC-TELEMETRY-018 | Non-opencode delivery folds v1 records with degradation (DEC-4) | Edge Case | Behaviour | Critical | AC-F7-1 |
| TC-TELEMETRY-019 | SC-M2-S14-01: within-tolerance verdict with stated tolerance ≤ 0.02 | Happy Path | Behaviour/Golden | Critical | AC-F6-1, NFR-1 |
| TC-TELEMETRY-020 | Over-tolerance deviation renders the declared outside verdict | Negative | Behaviour/Golden | Critical | AC-F6-2, NFR-1 |
| TC-TELEMETRY-021 | Multi-session summed baseline, one verdict (DEC-5) | Corner Case | Behaviour | High | AC-F6-1 |
| TC-TELEMETRY-022 | Baseline session without total excluded with warning + named count | Edge Case | Behaviour | High | AC-F6-1 |
| TC-TELEMETRY-023 | No baseline → classified reconciliation unavailability, never `within` | Edge Case | Behaviour | Critical | AC-F6-1 |
| TC-TELEMETRY-024 | Double-counting guard across capture planes (RSK-2) | Corner Case | Behaviour | High | AC-F6-2 |
| TC-TELEMETRY-025 | SC-M2-S14-02: absence classified at exit 1, no zero-valued report | Negative | Behaviour | Critical | AC-F7-1 |
| TC-TELEMETRY-026 | Store damage keeps `state.*` identities, never re-projected as absence | Negative | Behaviour | High | AC-F7-1 |
| TC-TELEMETRY-027 | Retro evidence pass cites per-role/model numbers, timing, verdict | Happy Path | Integration | High | AC-F8-1 |
| TC-TELEMETRY-028 | Brief cites spend numbers with reconciliation disclosure | Happy Path | Integration | High | AC-F8-2 |
| TC-TELEMETRY-029 | Brief renders classified absence instead of zeros | Edge Case | Behaviour | High | AC-F8-2 |
| TC-TELEMETRY-030 | Status digest section 8 parity from the same fold | Regression | Integration | High | AC-F8-2, AC-N1-1 |
| TC-TELEMETRY-031 | Every summary states telemetry state and tolerance (AC-N1-1) | Regression | Behaviour | Critical | AC-N1-1 |
| TC-TELEMETRY-032 | Byte-identical determinism; zero model calls (NFR-3) | Regression | Behaviour | High | NFR-3 |
| TC-TELEMETRY-033 | Bounded output; deterministic truncation; totals/verdict never truncated | Corner Case | Behaviour | High | NFR-2 |
| TC-TELEMETRY-034 | Read latency budget and bounded read work (NFR-4) | Performance | Behaviour | Medium | NFR-4 |
| TC-TELEMETRY-035 | Privacy: aggregates and identity references only; redaction composes | Regression | Behaviour/Checks | High | NFR-7 |
| TC-TELEMETRY-036 | Offline hermetic posture across all new suites (NFR-6) | Regression | Checks | Critical | NFR-6 |
| TC-TELEMETRY-037 | Command-audit record per invocation; audit failure is diagnostic | Edge Case | Behaviour | Medium | AC-N1-1 |
| TC-TELEMETRY-038 | Mutant meta-suite over every honesty rule | Regression | Checks (mutation) | Critical | AC-F1-1, AC-F2-1, AC-F3-1, AC-F4-1, AC-F5-2, AC-F6-2, AC-F7-1 |
| TC-TELEMETRY-039 | Contract/conformance suite: vocabulary, naming, error-table sync, literals | Regression | Structure/Checks | High | AC-F5-3, AC-F4-1, F-4 |

### 5.2 Scenario Details

#### TC-TELEMETRY-001 - Per-step counting happy path

**Scenario Type**: Happy Path
**Impact Level**: Critical
**Priority**: High
**Related IDs**: F-1, AC-F1-1, DM-1
**Test Type(s)**: Unit, Integration
**Automation Level**: Automated
**Target Layer / Location**: harness adapter ingest seam (packages/core); `tests/behaviour/telemetry-ingest.test.ts`
**Tags**: @offline, @telemetry, @ingest

**Preconditions**:

- The token/cost-bearing v2.2.5 stream capture is committed per the README discipline (GAP-2); the committed framing fixtures exist.
- A temp state root with the delivered state-layer primitives is seeded; injected clock and run ids.

**Steps**:

1. Drain the token-bearing clean-stop capture through the ingest seam attached to the delivered streaming seam.
2. Read back the stored telemetry step records for the delivery.
3. Assert, per step and in aggregate, against hand-summed fixture constants: the five token classes (input, output, reasoning, cache-read, cache-write), call counts, and per-model cost in harness-reported units.
4. Assert a paired complete-frame control renders a warning-free ingestion (non-vacuity).

**Expected Outcome**:

- One stored record per step carrying exactly the harness-reported figures; totals equal the hand sums; no warnings emitted; no unit conversion, re-pricing, or rounding beyond the harness-reported values (NG-4).

**Postconditions**:

- Temp store discarded; no writes outside the temp root.

**Notes / Clarifications**:

- Fixture prerequisite is GAP-2; until extended, this TC runs on the extended capture and is the named consumer of it.

#### TC-TELEMETRY-002 - Omitted class or field degrades, excluded, never zero

**Scenario Type**: Edge Case
**Impact Level**: Critical
**Priority**: High
**Related IDs**: F-1, AC-F1-1, DM-1, RSK-7
**Test Type(s)**: Unit, Behaviour
**Automation Level**: Automated
**Target Layer / Location**: ingest seam; `tests/behaviour/telemetry-ingest.test.ts` (matrix I-02..I-04)
**Tags**: @offline, @telemetry, @degradation

**Preconditions**:

- Synthetic frames built through the committed scenario module, each omitting exactly one element: one token class (I-02), cost (I-03), calls (I-04); a paired complete frame (I-01) in the same test.

**Steps**:

1. Ingest each omission frame; read back the stored record and any aggregate.
2. Assert a warning from the closed reason vocabulary, naming the omitted element, with a per-reason count.
3. Assert the omitted value is excluded from every sum; the present classes still count exactly.
4. Assert the aggregate discloses the degradation count.

**Expected Outcome**:

- The missing value appears nowhere as 0 or an estimate; sums equal the hand sums of present values only; the warning is from the closed vocabulary (asserted through the declared constants — GAP-4); a zero-class sum is distinguishable from an omitted class (positive-reading vs absence discipline).

**Notes / Clarifications**:

- Mirrors the delivered v1 "null excluded, never fabricated" honesty line, now per step.

#### TC-TELEMETRY-003 - Frame drift degrades with warning

**Scenario Type**: Negative
**Impact Level**: Important
**Priority**: High
**Related IDs**: F-1, AC-F1-1, RSK-1
**Test Type(s)**: Unit, Behaviour
**Automation Level**: Automated
**Target Layer / Location**: ingest seam; `tests/behaviour/telemetry-ingest.test.ts` (matrix I-05)
**Tags**: @offline, @telemetry, @degradation

**Preconditions**:

- Synthetic drift frames through the scenario module: unknown frame type; known type with unexpected extra fields; known type with a renamed token-class field.

**Steps**:

1. Ingest each drift frame beside known-good frames in one stream.
2. Assert a drift warning from the closed vocabulary with a count; ingest continues over the remaining frames.
3. Assert no fabricated record, no placeholder values, and that known fields on drifted frames are either counted per the declared drift rule or excluded-and-warned — whichever the contract declares — asserted through the contract constant.

**Expected Outcome**:

- Drift is disclosed, counted, and never silently dropped or fabricated (RSK-1 mitigation proven); the stream still terminates with its delivered completion evidence.

#### TC-TELEMETRY-004 - Ingest non-interference with the delivered streaming seam

**Scenario Type**: Regression
**Impact Level**: Critical
**Priority**: High
**Related IDs**: F-1, NFR-5, RSK-5
**Test Type(s)**: Integration
**Automation Level**: Automated
**Target Layer / Location**: streaming seam behavior; `tests/behaviour/telemetry-ingest.test.ts` + existing `harness-opencode-stream.test.ts` (unchanged assertions must keep passing)
**Tags**: @offline, @telemetry, @stream

**Preconditions**:

- The three committed fixture captures (clean stop, tool error, stream error); a synthetic long stream (thousands of frames) through the scenario module.

**Steps**:

1. Replay all three committed captures through the drain with ingest attached; assert handle acquisition from the first identified line, full drain to process close, and terminal `step_finish`/completion evidence identical to the delivered behavior.
2. Run the synthetic long stream; assert per-frame work is bounded and constant-memory (flat profile, no per-frame accumulation), and that no ingest work blocks delivery of the next frame or changes output-bound behavior.
3. Assert the delivered stream-drain suite assertions (`harness-opencode-stream.test.ts`) still pass unchanged with ingest composed.

**Expected Outcome**:

- Ingest is invisible to the delivered seam contract: same handle semantics, same drain behavior, same completion evidence; memory profile flat across the long stream (NFR-5, RSK-5 mitigation proven).

#### TC-TELEMETRY-005 - Ingest failure accounting never changes delivery outcome

**Scenario Type**: Negative
**Impact Level**: Important
**Priority**: Medium
**Related IDs**: F-1, AC-F1-1, §10
**Test Type(s)**: Behaviour
**Automation Level**: Automated
**Target Layer / Location**: ingest accounting; `tests/behaviour/telemetry-ingest.test.ts` (matrix I-06)
**Tags**: @offline, @telemetry

**Preconditions**:

- A stream mixing decodable frames with an undecodable frame (I-06); a paired all-decodable control.

**Steps**:

1. Ingest the mixed stream; assert the disclosed counts (captured / degraded / failed) equal the hand counts.
2. Assert the delivery's outcome and verdict are unchanged versus the control (same completion evidence, same exit).
3. Assert the failed frame produced neither a stored record nor a fabricated value.

**Expected Outcome**:

- Failures are classified outcomes with counts, never silent drops, and never a delivery-failure cause (§10).

#### TC-TELEMETRY-006 - Stored records carry the five attribution fields plus step timing

**Scenario Type**: Happy Path
**Impact Level**: Critical
**Priority**: High
**Related IDs**: F-2, AC-F2-1, DM-1
**Test Type(s)**: Unit, Behaviour
**Automation Level**: Automated
**Target Layer / Location**: telemetry storage/record contract; `tests/behaviour/telemetry-attribution.test.ts`
**Tags**: @offline, @telemetry, @attribution

**Preconditions**:

- Seeded session-economics records, command-audit identity (runId, claimed agent role, lane), and ingested steps for one delivery; injected clock.

**Steps**:

1. Ingest steps across two lanes and two agent roles in one delivery.
2. Read back every stored step record.
3. Assert each record carries ticket (work-item ref), repository (checkout identity), lane, agentRole, model, and step timing, and that the values equal the seeded identity constants per step.

**Expected Outcome**:

- Every record fully attributed per the seeded substrates; `telemetry.v1` attribution fields all present (contract §telemetry.v1); no record missing a dimension silently.

#### TC-TELEMETRY-007 - Unattributable step is classified degradation, never misattributed

**Scenario Type**: Edge Case
**Impact Level**: Critical
**Priority**: High
**Related IDs**: F-2, AC-F2-1, RSK-3
**Test Type(s)**: Unit, Behaviour
**Automation Level**: Automated
**Target Layer / Location**: attribution logic; `tests/behaviour/telemetry-attribution.test.ts`
**Tags**: @offline, @telemetry, @degradation

**Preconditions**:

- Steps whose audit identity lacks the lane (no lane id), the claimed agent role, or the run identity; a paired fully-attributed control.

**Steps**:

1. Ingest the unattributable steps beside the control steps.
2. Assert each unattributable step is recorded as classified degradation with its reason from the closed vocabulary, and appears in the per-reason degradation count.
3. Assert the unattributable step carries no guessed ticket/repository/lane/role value — no default dimension, no `unknown`-as-ticket fabrication beyond the declared named fallback.
4. Assert breakdowns either exclude the step from the affected dimension (disclosed) or carry it under the declared named fallback — asserted through the contract constant, consistently across every dimension.

**Expected Outcome**:

- Wrong-dimension attribution is impossible: no step lands under a dimension it was not derived for (RSK-3); degradation counts by reason; the claimed-identity trust model is not silently upgraded to proven identity.

#### TC-TELEMETRY-008 - Attribution joins session economics and command-audit identity

**Scenario Type**: Happy Path
**Impact Level**: Important
**Priority**: High
**Related IDs**: F-2, AC-F2-1
**Test Type(s)**: Integration
**Automation Level**: Automated
**Target Layer / Location**: attribution substrate composition; `tests/behaviour/telemetry-attribution.test.ts`
**Tags**: @offline, @telemetry

**Preconditions**:

- Seeded `economics/<ref>` records (session identity, restart history) and audit-ledger entries with runId/agent-role/lane; steps from two harness sessions in one delivery.

**Steps**:

1. Ingest steps from both sessions.
2. Assert session/run identity resolves through the economics records and the claimed role/lane through the audit identity, for each session's steps.
3. Assert a recorded-argument probe: the attribution reads exactly the delivered substrates (economics store key, audit ledger) and nothing else.

**Expected Outcome**:

- The five dimensions derive from the delivered substrates only — no new identity source is invented; multi-session delivery attributes each step to its own session's identity.

#### TC-TELEMETRY-009 - Timing from delivered records, no re-estimation

**Scenario Type**: Happy Path
**Impact Level**: Critical
**Priority**: High
**Related IDs**: F-3, AC-F3-1, DM-2
**Test Type(s)**: Behaviour
**Automation Level**: Automated
**Target Layer / Location**: timing join; `tests/behaviour/telemetry-timing.test.ts`
**Tags**: @offline, @telemetry, @timing

**Preconditions**:

- Seeded `phase.transition` history with literal timestamps; seeded economics restart records and a corroborated stall record; steps placed between transitions.

**Steps**:

1. Render the per-phase timing summaries for the delivery.
2. Assert each phase entry carries start, end, and duration derived exactly from the transition history (hand-computed expected values).
3. Assert stall and restart intervals reflect the seeded economics records (values equal to the seeded record fields).
4. Run the re-estimation mutant check (via TC-TELEMETRY-038): a module copy that synthesizes a duration when a delivered record exists must fail this suite.

**Expected Outcome**:

- Timing is a join of delivered records only — never re-estimated from heuristics where a delivered record exists (F-3); durations equal the hand-computed deltas.

#### TC-TELEMETRY-010 - Version bump migrates by re-reading

**Scenario Type**: Corner Case
**Impact Level**: Critical
**Priority**: High
**Related IDs**: F-4, AC-F4-1, DM-5
**Test Type(s)**: Behaviour
**Automation Level**: Automated
**Target Layer / Location**: telemetry storage; `tests/behaviour/telemetry-storage-migration.test.ts`
**Tags**: @offline, @telemetry, @storage

**Preconditions**:

- Telemetry stored under the declared schema version N (the declared constant — GAP-7) with records across both lanes, both models, complete and omission-degraded steps; the version N+1 reader available.

**Steps**:

1. Read the version-N store through the version-(N+1) read path (the re-read migration).
2. Assert every record remains attributable: the five dimensions, classes, calls, cost, timing, and warnings survive for all records.
3. Assert no record is dropped, mutated in place, or silently reinterpreted: record count identical, every field equal to the seeded constants, degradation warnings preserved.
4. Assert a paired control: the pre-bump reader on the same store yields the same figures (no data stranded either way).

**Expected Outcome**:

- Migration is a re-derivation from the versioned source — no in-place mutation, no silent loss (AC-F4-1); attribution intact for every record.

#### TC-TELEMETRY-011 - Coexistence with closeout capture; reading basis named

**Scenario Type**: Happy Path
**Impact Level**: Important
**Priority**: High
**Related IDs**: F-5, F-6, AC-F5-2, AC-F6-1, RSK-2, §8.5
**Test Type(s)**: Integration
**Automation Level**: Automated
**Target Layer / Location**: spend fold; `tests/behaviour/telemetry-storage-coexistence.test.ts`
**Tags**: @offline, @telemetry, @spend

**Preconditions**:

- A store seeded with both planes: v2 stream-ingested step records and delivered closeout-captured `harness.telemetry` v1 records for the same delivery; harness-reported session totals seeded.

**Steps**:

1. Run `spend --ref` over the combined store.
2. Assert the report renders, the disclosure names the reading basis (the declared combination value from the contract constant set: stream ingest, closeout capture, or declared combination).
3. Assert the delivered closeout capture path itself is unchanged (the v1 capture suite assertions hold; no capture-path rework — §16 "Closeout transaction: Unchanged").

**Expected Outcome**:

- Both planes coexist; the report names which basis it used (glossary "reading basis"); reconciliation exposes any double-count divergence (see TC-TELEMETRY-024).

#### TC-TELEMETRY-012 - Malformed records classify as state errors

**Scenario Type**: Negative
**Impact Level**: Important
**Priority**: High
**Related IDs**: F-4, AC-F4-1, §21
**Test Type(s)**: Behaviour
**Automation Level**: Automated
**Target Layer / Location**: storage read/verify discipline; `tests/behaviour/telemetry-storage-damage.test.ts`
**Tags**: @offline, @telemetry, @state

**Preconditions**:

- Stores seeded with a malformed telemetry payload (missing required field, non-integer class value), an unknown record kind under the telemetry key prefix, and a torn framing byte sequence; paired healthy store.

**Steps**:

1. Read each damaged store through the spend fold.
2. Assert the delivered `state.*` identity for each damage class (per the exit oracle E-table) with the store path/record position disclosure, at its delivered projection class and exit.
3. Assert no damaged record was admitted into any sum, and none was silently skipped into a partial report.

**Expected Outcome**:

- Malformed or unknown records classify as state errors rather than being admitted or silently dropped (§21); damage never renders as a partial truth.

#### TC-TELEMETRY-013 - Linear growth, retention, no unbounded projections

**Scenario Type**: Corner Case
**Impact Level**: Minor
**Priority**: Medium
**Related IDs**: F-4, NFR-8
**Test Type(s)**: Behaviour
**Automation Level**: Automated
**Target Layer / Location**: telemetry storage; `tests/behaviour/telemetry-storage-growth.test.ts`
**Tags**: @offline, @telemetry, @storage

**Preconditions**:

- Generated step sets of increasing size (e.g., 1k / 10k steps) in temp stores; state-layer retention convention applied as delivered.

**Steps**:

1. Measure stored bytes at each size; assert growth is linear in captured steps (within a declared slack band).
2. Assert no derived projection of unbounded size is materialized (only the versioned event records plus the state-layer convention's own artifacts).
3. Assert the delivered retention behavior is unchanged (no new retention regime — §20).

**Expected Outcome**:

- Storage grows linearly with captured steps; retention follows the state-layer convention; no unbounded derived projections (NFR-8).

#### TC-TELEMETRY-014 - Full spend v2 report

**Scenario Type**: Happy Path
**Impact Level**: Critical
**Priority**: High
**Related IDs**: F-5, AC-F5-1, DM-2, DM-6
**Test Type(s)**: Behaviour
**Automation Level**: Automated
**Target Layer / Location**: spend read side; `tests/behaviour/spend-v2-breakdown.test.ts` + `tests/golden/spend.test.ts`
**Tags**: @offline, @spend, @cli

**Preconditions**:

- A fixture-seeded delivery with ingested steps across two agent roles and two models, a seeded transition history, and harness-reported session totals; all expected figures hand-summed from the fixture definition.

**Steps**:

1. Run `spend --ref <ref>` (human mode) and `spend --ref <ref> --json` (machine mode).
2. Assert token totals equal the hand sums per class; cost totals equal the hand sums per model in harness-reported units.
3. Assert per-agent-role and per-model breakdowns exist and their token sums equal the totals exactly (AC-F5-1 arithmetic identity).
4. Assert per-phase timing summaries carry start, end, duration matching the seeded transition history.
5. Assert the golden render matches (updated golden — never blanket-rewritten; regenerated deliberately with the recorded command per testing strategy).

**Expected Outcome**:

- The report states what the ticket AC names: tokens and cost per agent role and model with phase timings; breakdown sums equal totals; figures are collector-truth, not estimates.

#### TC-TELEMETRY-015 - Five-dimension breakdown selection

**Scenario Type**: Happy Path
**Impact Level**: Important
**Priority**: High
**Related IDs**: F-5, AC-F5-1, DM-6
**Test Type(s)**: Behaviour, Contract
**Automation Level**: Automated
**Target Layer / Location**: spend read side; `tests/behaviour/spend-v2-breakdown.test.ts`; `tests/structure/telemetry-contract.test.ts`
**Tags**: @offline, @spend

**Preconditions**:

- Seeded records varying across all five dimensions (two values each where meaningful); the declared breakdown-field constant set.

**Steps**:

1. Assert the machine report carries all five breakdown dimensions (`ticket`, `repository`, `lane`, `role`, `model`) regardless of selection (F-5: "all five present in the machine report").
2. For each declared selection value, run the breakdown selection and assert the rendered breakdown matches the hand-summed figures for that dimension's groups.
3. Assert each dimension's group sums equal the totals.

**Expected Outcome**:

- Selection renders a per-dimension breakdown for exactly the declared field; the constant set contains exactly the five declared fields (contract suite).

#### TC-TELEMETRY-016 - Unknown breakdown field refused pre-read

**Scenario Type**: Negative
**Impact Level**: Important
**Priority**: High
**Related IDs**: F-5, AC-F5-3
**Test Type(s)**: Behaviour, Checks
**Automation Level**: Automated
**Target Layer / Location**: CLI grammar validation; `tests/behaviour/spend-v2-refusals.test.ts`
**Tags**: @offline, @spend, @cli

**Preconditions**:

- A temp store with seeded telemetry (so a read would succeed if attempted — non-vacuity control); a recording read seam.

**Steps**:

1. Run `spend --ref <ref> --breakdown <not-a-dimension>` for a value outside the five declared fields (typo'd and case-variant probes).
2. Assert refusal with the classified input error identity (exit 1, user-validation class) before any read: the recording seam shows zero record-family reads.
3. Run the accepted control (`--breakdown model`) beside it and assert it renders.

**Expected Outcome**:

- Unknown breakdown values are refused with a classified input error before any read (AC-F5-3); the accepted values are exactly the five declared fields.

#### TC-TELEMETRY-017 - v1 additive compatibility (DEC-6)

**Scenario Type**: Regression
**Impact Level**: Critical
**Priority**: High
**Related IDs**: F-5, AC-F5-2, DM-6, DEC-6
**Test Type(s)**: Contract, Behaviour
**Automation Level**: Automated
**Target Layer / Location**: spend contract + CLI; `tests/behaviour/spend-v2-v1-compat.test.ts`; `tests/structure/spend-contract.test.ts` (update)
**Tags**: @offline, @spend, @compat

**Preconditions**:

- A store seeded with closeout-captured v1 records only (the pre-v2 world); the delivered v1 grammar and six-key payload contract.

**Steps**:

1. Run every v1 grammar form (`--ref`, `--phase`, `--amplification`, `--json`) and assert delivered behavior, keys, and semantics are unchanged (v1 suites' assertions hold).
2. On a v2 store, assert the machine payload still carries the six v1 keys (`tokensByClass`, `perPhase[]`, `perAgent[]`, `restarts`, `amplification`, `degradation`) with their exact names and semantics, and the schema identity remains `delivery.spend.v1` (DEC-6 — no renames, no collisions).
3. Assert v2 additions (breakdown arrays, timing summaries, reconciliation block, telemetry-state disclosure, cost-bearing totals) appear strictly beside the six keys under `data`.
4. Run the v1-key-break mutant check (TC-TELEMETRY-038): renaming or removing a delivered key must fail.

**Expected Outcome**:

- Zero breaking changes: the delivered v1 spend grammar and six-key payload remain valid and readable unchanged (v1-compatibility KPI); the identity constant is unchanged.

#### TC-TELEMETRY-018 - Non-opencode delivery folds v1 records with degradation (DEC-4)

**Scenario Type**: Edge Case
**Impact Level**: Critical
**Priority**: High
**Related IDs**: F-5, F-7, AC-F7-1, DEC-4
**Test Type(s)**: Behaviour
**Automation Level**: Automated
**Target Layer / Location**: spend fold basis; `tests/behaviour/spend-v2-fold-basis.test.ts` (matrix S-03)
**Tags**: @offline, @spend, @degradation

**Preconditions**:

- A store with closeout-captured v1 records from the non-opencode harness path (the delivered Claude Code capture shape), no v2 stream records.

**Steps**:

1. Run `spend --ref` for the non-opencode delivery.
2. Assert the report renders at exit 0 from the v1 records with the reading basis named as closeout capture.
3. Assert classified degradation discloses the missing lane/per-step detail with per-reason counts.
4. Assert `spend.telemetry-absent` is NOT returned (the DEC-4 boundary): paired control — the same store with records deleted — returns absence.

**Expected Outcome**:

- Non-opencode deliveries keep their spend report and gain the v2 disclosure honestly: degradation and basis naming, never a false absence claim (DEC-4, AC-F5-2 for the v1 records' readability).

#### TC-TELEMETRY-019 - SC-M2-S14-01: within-tolerance reconciliation

**Scenario Type**: Happy Path
**Impact Level**: Critical
**Priority**: High
**Related IDs**: F-6, AC-F6-1, NFR-1, DM-3, DEC-2, DEC-5
**Test Type(s)**: Behaviour, Golden
**Automation Level**: Automated
**Target Layer / Location**: reconciliation; `tests/behaviour/spend-reconciliation.test.ts` + `tests/golden/spend.test.ts` (matrix R-01/R-02)
**Tags**: @offline, @spend, @reconciliation

**Preconditions**:

- A completed-delivery fixture: ingested steps whose hand-summed observed totals O equal (R-01) or sit within 1% of (R-02) the seeded harness-reported session total B; injected clock and run id.

**Steps**:

1. Run `spend --ref <ref> --json`.
2. Assert `data.reconciliation.verdict == "within"` (SC-M2-S14-01 verbatim).
3. Assert `data.reconciliation.tolerance` is present and ≤ 0.02 (SC-M2-S14-01 verbatim; NFR-1), and equals the declared constant.
4. Assert the reconciliation block carries the harness session totals, the observed totals, and the reading basis (DM-3), and the human render states the tolerance (AC-N1-1).
5. Assert the golden render matches.

**Expected Outcome**:

- The pinned scenario passes exactly as asserted: verdict `within`, tolerance ≤ 0.02 stated with the summary — the accuracy declaration the ticket requires.

#### TC-TELEMETRY-020 - Over-tolerance deviation renders the outside verdict

**Scenario Type**: Negative
**Impact Level**: Critical
**Priority**: High
**Related IDs**: F-6, AC-F6-2, NFR-1, DM-3, RSK-4
**Test Type(s)**: Behaviour, Golden
**Automation Level**: Automated
**Target Layer / Location**: reconciliation; `tests/behaviour/spend-reconciliation.test.ts` + `tests/golden/spend.test.ts` (matrix R-03)
**Tags**: @offline, @spend, @reconciliation

**Preconditions**:

- The R-01 fixture with observed totals inflated beyond tolerance (e.g., O = B × 1.05); the declared outside-verdict contract constant (GAP-5).

**Steps**:

1. Run `spend --ref <ref> --json` on the divergent fixture.
2. Assert the verdict equals the declared outside-verdict constant, rendered in the same disclosure with the same stated tolerance and both figures (harness totals and observed totals).
3. Assert exit is 0 — a declared outcome, not a hidden error — and the human render states the divergence.
4. Assert paired control: the R-01 fixture in the same test still renders `within` (the mutant that clamps outside→within must fail — TC-TELEMETRY-038).

**Expected Outcome**:

- Deviation beyond tolerance is a stated outcome naming the divergence — never silently tolerated, never rendered as `within` (AC-F6-2, RSK-4 mitigation proven).

#### TC-TELEMETRY-021 - Multi-session summed baseline, one verdict

**Scenario Type**: Corner Case
**Impact Level**: Important
**Priority**: High
**Related IDs**: F-6, AC-F6-1, DEC-5
**Test Type(s)**: Behaviour
**Automation Level**: Automated
**Target Layer / Location**: reconciliation; `tests/behaviour/spend-reconciliation.test.ts` (matrix R-04)
**Tags**: @offline, @spend

**Preconditions**:

- A delivery spanning two harness sessions, each with a seeded harness-reported total; observed totals hand-summed to match the summed baseline within tolerance.

**Steps**:

1. Run `spend --ref` and assert exactly one reconciliation verdict, computed against the sum of the attributed session totals (DEC-5).
2. Assert per-session totals appear only as diagnostics, never as a second verdict or per-session pass/fail.
3. Assert a shuffled-seeding permutation control renders byte-identically.

**Expected Outcome**:

- The baseline is the sum of all attributed harness-reported session totals compared once for a single verdict (DEC-5); per-session figures never fork the pinned assertion.

#### TC-TELEMETRY-022 - Baseline gap excluded with warning and named count

**Scenario Type**: Edge Case
**Impact Level**: Important
**Priority**: High
**Related IDs**: F-6, AC-F6-1, DEC-5
**Test Type(s)**: Behaviour
**Automation Level**: Automated
**Target Layer / Location**: reconciliation; `tests/behaviour/spend-reconciliation.test.ts` (matrix R-05)
**Tags**: @offline, @spend

**Preconditions**:

- Two attributed sessions; the second lacks a harness-reported total; observed totals within tolerance of the remaining baseline.

**Steps**:

1. Run `spend --ref` and assert the verdict is computed over the remaining baseline only.
2. Assert a closed-vocabulary warning names the exclusion and the excluded count is 1 (named, not silent).
3. Assert the disclosure still states the tolerance and both figures; per-session diagnostics show the gap.

**Expected Outcome**:

- A baseline session without a harness-reported total is excluded from the sum with a warning and named count (DEC-5) — never fabricated, never counted as zero silently.

#### TC-TELEMETRY-023 - No baseline → classified unavailability, never `within`

**Scenario Type**: Edge Case
**Impact Level**: Critical
**Priority**: High
**Related IDs**: F-6, AC-F6-1, DM-3, DEC-5
**Test Type(s)**: Behaviour
**Automation Level**: Automated
**Target Layer / Location**: reconciliation; `tests/behaviour/spend-reconciliation.test.ts` (matrix R-06)
**Tags**: @offline, @spend

**Preconditions**:

- Telemetry records present; no harness-reported session totals anywhere for the delivery (the pre-baseline world).

**Steps**:

1. Run `spend --ref` and assert the report renders at exit 0 with the reconciliation block declaring its classified unavailability (the declared disclosure value).
2. Assert the verdict is not `within` and no baseline is fabricated; the tolerance is still stated as the declared constant.
3. Assert the human render discloses the unavailability rather than printing an accuracy claim ("a report without a reconciliation line is incomplete" — the line exists and says the truth).

**Expected Outcome**:

- A report with no harness-reported baseline declares classified reconciliation unavailability rather than verdict `within` (DEC-5) — the honesty anchor holds even when the cross-check is impossible.

#### TC-TELEMETRY-024 - Double-counting guard across planes

**Scenario Type**: Corner Case
**Impact Level**: Important
**Priority**: High
**Related IDs**: F-6, AC-F6-2, RSK-2, §8.5
**Test Type(s)**: Behaviour
**Automation Level**: Automated
**Target Layer / Location**: fold basis + reconciliation; `tests/behaviour/spend-v2-fold-basis.test.ts` (matrices S-04, R-07)
**Tags**: @offline, @spend

**Preconditions**:

- Both planes seeded with overlapping coverage (the same session represented by stream steps and a closeout v1 group record); harness totals seeded.

**Steps**:

1. Run `spend --ref` with the declared-combination basis.
2. Assert the reading basis is named; assert the observed totals and the reconciliation verdict follow the declared combination rule (asserted through the contract constant — the declared arithmetic for combining planes is a plan-level constant pinned in the contract suite).
3. Assert the failure mode is exposed, not hidden: a configured combination that inflates O beyond tolerance renders the outside verdict (RSK-2), never a silent `within`.

**Expected Outcome**:

- Double counting cannot pass silently: the basis is declared and reconciliation exposes divergence beyond tolerance as a declared verdict (RSK-2 mitigation proven).

#### TC-TELEMETRY-025 - SC-M2-S14-02: absence classified, no zeros

**Scenario Type**: Negative
**Impact Level**: Critical
**Priority**: High
**Related IDs**: F-7, AC-F7-1, DM-4, DEC-4
**Test Type(s)**: Behaviour
**Automation Level**: Automated
**Target Layer / Location**: spend absence path; `tests/behaviour/spend-absent.test.ts` (update; matrices S-05, S-06, S-09)
**Tags**: @offline, @spend, @absence

**Preconditions**:

- Three stores: verified-empty (no frames); records for a different ref only; harness totals present but zero telemetry records. A paired control with one seeded record.

**Steps**:

1. Run `spend --ref <ref>` on each absence store.
2. Assert exit code 1 with `error.code == "spend.telemetry-absent"` (SC-M2-S14-02 verbatim) and the delivered remediation hinting.
3. Assert stdout/stderr contain no zero-valued report: no `tokensByClass` zeros, no totals line, no rendered table — the classified outcome is the whole output.
4. Assert the paired control renders a report (non-vacuity), and the delivered v1 absence suite assertions still hold (identity reused, not forked).

**Expected Outcome**:

- 100% of telemetry-absent invocations exit 1 with the classified code and print no zero-valued report (absence KPI); absence keys off telemetry records of either plane, not harness totals (S-06) and not other refs (S-09).

#### TC-TELEMETRY-026 - Store damage keeps state identities

**Scenario Type**: Negative
**Impact Level**: Important
**Priority**: High
**Related IDs**: F-7, AC-F7-1, §8.5
**Test Type(s)**: Behaviour
**Automation Level**: Automated
**Target Layer / Location**: spend damage path; `tests/behaviour/spend-store-damage.test.ts` (update; matrices S-07, S-08)
**Tags**: @offline, @spend, @state

**Preconditions**:

- Stores seeded per damage class: torn framing, schema mismatch, unknown record kind (exit 2 projections), permission-denied (exit 1 projection); paired healthy store.

**Steps**:

1. Run `spend --ref` on each damaged store.
2. Assert each damage class returns its delivered `state.*` identity, projection class, and exit — unchanged by v2.
3. Assert no damage class returns `spend.telemetry-absent` and no partial or zeroed report renders.

**Expected Outcome**:

- Store damage keeps the delivered `state.*` identities and is never re-projected as absence (F-7, §8.5); absence is never reused for damage.

#### TC-TELEMETRY-027 - Retro evidence citation

**Scenario Type**: Happy Path
**Impact Level**: Important
**Priority**: High
**Related IDs**: F-8, AC-F8-1, F-5
**Test Type(s)**: Integration
**Automation Level**: Automated
**Target Layer / Location**: retro evidence pipeline; `tests/behaviour/retro-telemetry-evidence.test.ts`
**Tags**: @offline, @retro

**Preconditions**:

- A delivery with telemetry, reconciliation verdict, and timing summaries (the TC-TELEMETRY-014 fixture); the delivered retro evidence append seam and sidecar primitives.

**Steps**:

1. Run the retro evidence pass at change level.
2. Assert the telemetry figures join the collected evidence through the delivered append seam: per-role numbers, per-model numbers, timing summaries, and the reconciliation verdict are recorded as collector-truth evidence.
3. Assert the retro report cites those numbers (GAP-6 obligations: figures present, verdict and tolerance disclosed).
4. Assert the evidence source set grows additively — the delivered sources are unchanged (RSK-6: the delivered source-set contract holds).

**Expected Outcome**:

- A change-level retro cites per-role/model numbers, timing, and the reconciliation verdict as collector-truth evidence (AC-F8-1); the retro pipeline's delivered contracts are otherwise unchanged (NG-7).

#### TC-TELEMETRY-028 - Brief spend citation with disclosure

**Scenario Type**: Happy Path
**Impact Level**: Important
**Priority**: High
**Related IDs**: F-8, AC-F8-2, NFR-1
**Test Type(s)**: Integration, Golden
**Automation Level**: Automated
**Target Layer / Location**: brief render; `tests/behaviour/brief-spend-citation.test.ts` + `tests/golden/brief.test.ts` (update)
**Tags**: @offline, @brief

**Preconditions**:

- The TC-TELEMETRY-014 fixture store; the brief command with injected clock/run id.

**Steps**:

1. Render the brief for the delivery.
2. Assert the brief cites the spend numbers — per-role/model figures with the reconciliation disclosure (verdict + stated tolerance; GAP-6 obligations) on every telemetry-present render.
3. Assert the closed surface catalog grows only by this change's declared spend surface — all other delivered surfaces unchanged (RSK-6; contract test updated in the same change per §8.5).
4. Assert the golden render matches.

**Expected Outcome**:

- The morning brief cites the numbers with the reconciliation disclosure (AC-F8-2); the brief's catalog growth is exactly the declared additive surface.

#### TC-TELEMETRY-029 - Brief renders classified absence, not zeros

**Scenario Type**: Edge Case
**Impact Level**: Important
**Priority**: High
**Related IDs**: F-8, F-7, AC-F8-2
**Test Type(s)**: Behaviour
**Automation Level**: Automated
**Target Layer / Location**: brief render; `tests/behaviour/brief-spend-citation.test.ts` (absence half)
**Tags**: @offline, @brief

**Preconditions**:

- A delivery with no telemetry records of either plane; paired control with telemetry.

**Steps**:

1. Render the brief for the telemetry-absent delivery.
2. Assert the spend surface renders the classified absence — the absence named, not zeros, not silence.
3. Assert no zero-valued spend figures appear anywhere in the brief render.
4. Run the paired control: the telemetry-present brief cites figures (TC-TELEMETRY-028 assertions hold).

**Expected Outcome**:

- When telemetry is absent, the brief renders the classified absence instead of zeros or silence (AC-F8-2, G-6).

#### TC-TELEMETRY-030 - Status digest section 8 parity

**Scenario Type**: Regression
**Impact Level**: Important
**Priority**: High
**Related IDs**: F-8, AC-F8-2, AC-N1-1, §7.1
**Test Type(s)**: Integration
**Automation Level**: Automated
**Target Layer / Location**: status digest; `tests/behaviour/status-spend-{section,parity,degraded}.test.ts` (update)
**Tags**: @offline, @status

**Preconditions**:

- One seeded store rendered both by `spend --ref --json` and by the status digest projection.

**Steps**:

1. Render the digest section 8 and the command report from the same store.
2. Assert parity: totals, breakdown figures, telemetry state, and the reconciliation disclosure agree between command and digest (same fold — §7.1).
3. Assert the digest's disclosed state and tolerance obligations hold (AC-N1-1 on the digest path).
4. Assert the delivered digest invariants (section count, placeholder catalog) remain intact with the spend section's v2 enrichment.

**Expected Outcome**:

- The digest projection stays fed by the same extended fold so command and digest agree (§7.1); no second implementation of the fold exists.

#### TC-TELEMETRY-031 - Every summary states telemetry state and tolerance

**Scenario Type**: Regression
**Impact Level**: Critical
**Priority**: High
**Related IDs**: F-6, F-7, AC-N1-1, NFR-1, DM-3, DM-4
**Test Type(s)**: Behaviour
**Automation Level**: Automated
**Target Layer / Location**: all render paths; `tests/behaviour/telemetry-disclosure.test.ts`
**Tags**: @offline, @spend, @brief, @retro, @status

**Preconditions**:

- Rendered outputs collected from every reporting path — command (human + `--json`), digest projection, brief citation, retro citation — over present-telemetry, absent-telemetry, and unavailable-baseline stores.

**Steps**:

1. For each path and store combination, assert the telemetry state is stated (`present` or the classified absence kind — DM-4).
2. For each telemetry-present path, assert the reconciliation tolerance is stated with the summary (DM-3) — including the unavailable-baseline case, where the tolerance is still declared while the verdict is the classified unavailability.
3. Assert no path renders an accuracy or reconciliation claim without the stated tolerance (the tolerance is never applied silently — NFR-1).

**Expected Outcome**:

- Every rendered spend summary states the telemetry state and the tolerance; no reporting path applies the tolerance silently (AC-N1-1 across all four consumers).

#### TC-TELEMETRY-032 - Determinism and zero model calls

**Scenario Type**: Regression
**Impact Level**: Important
**Priority**: High
**Related IDs**: NFR-3
**Test Type(s)**: Behaviour
**Automation Level**: Automated
**Target Layer / Location**: render paths; `tests/behaviour/telemetry-determinism.test.ts` + `tests/behaviour/spend-determinism.test.ts` (update)
**Tags**: @offline, @determinism

**Preconditions**:

- One seeded store; injected fixed clock and fixed run id; a recording model-call seam.

**Steps**:

1. Render each surface twice under identical injected inputs.
2. Assert byte-identical repeat renders for every surface (command, digest, brief, retro citation).
3. Assert zero recorded model calls on any render path; zero ambient clock or randomness reads (all time/id values injected).
4. Assert a shuffled-append permutation of the same records renders byte-identically.

**Expected Outcome**:

- Byte-identical repeat renders for identical stored telemetry, injected clock, and injected run id; zero model calls on any render path (NFR-3, determinism KPI).

#### TC-TELEMETRY-033 - Bounded output and safe truncation

**Scenario Type**: Corner Case
**Impact Level**: Important
**Priority**: High
**Related IDs**: NFR-2
**Test Type(s)**: Behaviour
**Automation Level**: Automated
**Target Layer / Location**: render bounds; `tests/behaviour/spend-bounds.test.ts` (update) + `tests/behaviour/telemetry-disclosure.test.ts`
**Tags**: @offline, @bounds

**Preconditions**:

- Generated breakdown sets sized to exceed the bounds (many roles/models/lanes), plus at-cap and under-cap controls; truncation warning vocabulary declared.

**Steps**:

1. Render machine and human outputs at each size; measure UTF-8 bytes (machine ≤ 65,536; human ≤ 16,384 bytes and ≤ 200 lines).
2. Assert truncation is deterministic, tail-ordered (breakdown entries drop from the declared tail), and marked with a recorded truncation warning.
3. Assert totals and the reconciliation verdict are never truncated: on every over-cap render, the totals and the verdict + tolerance are present and intact.
4. Assert the under-cap control renders untruncated (non-vacuity).

**Expected Outcome**:

- Bounded output with deterministic, marked, tail-ordered truncation; totals and the reconciliation verdict survive every truncation (NFR-2).

#### TC-TELEMETRY-034 - Read latency budget and bounded read work

**Scenario Type**: Performance
**Impact Level**: Minor
**Priority**: Medium
**Related IDs**: NFR-4, GAP-3
**Test Type(s)**: Performance
**Automation Level**: Automated (bounded-work oracle) + non-CI reference measurement
**Target Layer / Location**: spend fold; `tests/behaviour/spend-performance.test.ts` (update)
**Tags**: @offline, @perf

**Preconditions**:

- Generated stores at 1,000 and 10,000 telemetry records; a recording read seam counting verified reads per family.

**Steps**:

1. Assert the bounded-work oracle: exactly one verified read per record family per invocation, one fold, no per-record re-reads, no network — asserted via the recorded seam on both sizes.
2. Measure wall-clock p95 locally at both sizes; record the reference measurement in §10 (never reported as a passing CI threshold — GAP-3).
3. Assert the local soft budget only as advisory logging, not a hard gate.

**Expected Outcome**:

- The fold's work is structurally bounded per NFR-4; the reference measurement documents real-environment behavior without making CI runner-dependent.

#### TC-TELEMETRY-035 - Privacy of records and reports

**Scenario Type**: Regression
**Impact Level**: Important
**Priority**: High
**Related IDs**: NFR-7, §20
**Test Type(s)**: Behaviour, Checks
**Automation Level**: Automated
**Target Layer / Location**: all records and render paths; `tests/behaviour/telemetry-privacy.test.ts` + `tests/checks/privacy-literals.test.ts` (update if literals extend)
**Tags**: @offline, @privacy

**Preconditions**:

- Stores seeded with steps whose frames deliberately contain prompt-like text fields (synthetic markers) that telemetry must never copy; rendered outputs from every surface.

**Steps**:

1. Inspect every stored telemetry record: assert it carries aggregate counts, identity references, and time windows only — no prompt text, message bodies, transcripts, diffs, tool output, or credential material (synthetic markers appear nowhere).
2. Inspect every rendered report the same way.
3. Assert the delivered redaction chokepoint composes unchanged on the new render paths (the delivered redaction suite assertions hold).

**Expected Outcome**:

- Telemetry is aggregates + identity + time windows, nothing else (NFR-7, §20); the redaction chokepoint composition is preserved.

#### TC-TELEMETRY-036 - Offline hermetic posture

**Scenario Type**: Regression
**Impact Level**: Critical
**Priority**: High
**Related IDs**: NFR-6
**Test Type(s)**: Checks
**Automation Level**: Automated
**Target Layer / Location**: suite-level; `tests/checks/telemetry-hermetic.test.ts` (new) + boundary suite
**Tags**: @offline, @hermetic

**Preconditions**:

- The full new suite set; a network/credential/process probe harness (the delivered hermeticity-test pattern).

**Steps**:

1. Run every new suite under the hermeticity probe: assert zero sockets, zero live harness stores, zero `$HOME` reads, zero credential resolution across every test path.
2. Assert every stream fixture consumed is the committed set (or the scenario module), and every store is a per-test temp root.
3. Assert fixture files pass the fixture-privacy scan.

**Expected Outcome**:

- 100% of new tests run offline on committed fixtures and fixture-seeded stores; zero live harness stores, credentials, or network on any test path (NFR-6, offline-verification KPI).

#### TC-TELEMETRY-037 - Invocation audit composes

**Scenario Type**: Edge Case
**Impact Level**: Minor
**Priority**: Medium
**Related IDs**: AC-N1-1, §10
**Test Type(s)**: Behaviour
**Automation Level**: Automated
**Target Layer / Location**: command-audit composition; `tests/behaviour/telemetry-audit-compose.test.ts`
**Tags**: @offline, @audit

**Preconditions**:

- Temp store with the delivered audit ledger; a failing audit-write seam injection.

**Steps**:

1. Run `spend --ref` (and the ingest invocation path) normally; assert each invocation lands its delivered command-audit record (runId, timing, claimed identity).
2. Inject an audit-write failure; assert the outcome, report, and exit are unchanged — the audit failure is a diagnostic only.
3. Assert the audit chain's tamper-evidence semantics are unchanged (§21; delivered audit suites hold).

**Expected Outcome**:

- Every invocation lands its audit record; an audit-write failure never changes the outcome (§10, §21).

#### TC-TELEMETRY-038 - Mutant meta-suite over honesty rules

**Scenario Type**: Regression
**Impact Level**: Critical
**Priority**: High
**Related IDs**: AC-F1-1, AC-F2-1, AC-F3-1, AC-F4-1, AC-F5-2, AC-F6-2, AC-F7-1
**Test Type(s)**: Checks (mutation)
**Automation Level**: Automated
**Target Layer / Location**: `tests/checks/telemetry-mutants.test.ts` (new; the `tests/checks/spend-mutants.test.ts` pattern)
**Tags**: @offline, @mutation

**Preconditions**:

- The TC-TELEMETRY-001/014/019/025 fixtures; temp mutant copies of the production modules (the `tests/golden/redaction.test.ts` import pattern).

**Steps**:

1. For each mutant below, run the paired fixture suite against the mutant copy and assert the mutant produces the prohibited observable while the fixture is unchanged:
   - **fabricate-class-to-zero**: sum an omitted class as 0 → prohibited zero must appear (violates AC-F1-1).
   - **sum-null-as-zero**: include missing values in sums → sums diverge from hand oracle.
   - **default-attribution**: attribute an unattributable step to a default dimension → wrong-dimension record appears (violates AC-F2-1).
   - **re-estimate-timing**: synthesize a duration when no delivered record feeds it → fabricated interval appears (violates AC-F3-1).
   - **drop-on-migrate**: version bump drops records → count mismatch (violates AC-F4-1).
   - **v1-key-break**: rename/remove a six-key entry or the schema identity → payload violates DEC-6 (violates AC-F5-2).
   - **clamp-outside-to-within**: render `within` beyond tolerance → prohibited verdict (violates AC-F6-2).
   - **omit-reconciliation**: drop the block from a summary → incomplete report (violates AC-N1-1).
   - **absent-to-zeros**: render a zero report on absence → prohibited output (violates AC-F7-1).
   - **truncate-totals**: let truncation touch totals or the verdict → prohibited loss (violates NFR-2).
2. Assert each real module produces none of the prohibited observables on the same fixtures (if the mutant changes nothing, the suite fails).

**Expected Outcome**:

- Every honesty rule has a disabling mutant that fails the suite — the rules are load-bearing, not decorative.

#### TC-TELEMETRY-039 - Contract, conformance, and naming structure suite

**Scenario Type**: Regression
**Impact Level**: Important
**Priority**: High
**Related IDs**: F-4, F-5, AC-F4-1, AC-F5-3, §21, testing strategy §4
**Test Type(s)**: Structure, Checks
**Automation Level**: Automated
**Target Layer / Location**: `tests/structure/telemetry-contract.test.ts`, `tests/structure/telemetry-imports.test.ts` (new); `tests/structure/{spend-contract,content-inventory,error-table}.test.ts` (update); `tests/checks/{error-table-sync,exit-code-literals,forbidden-literals}.test.ts` (update as needed)
**Tags**: @offline, @conformance

**Preconditions**:

- The change's declared contract constants (token classes, warning reasons, breakdown fields, tolerance, verdicts, schema version, reading bases).

**Steps**:

1. Assert the declared constant sets: exactly five token classes; exactly five breakdown fields; the tolerance constant equals 0.02; the verdict set is exactly {within-declared, outside-declared, unavailable-declared}; warning reasons form a closed set (GAP-4/5/7 constants pinned here).
2. Assert brand neutrality: no hardcoded product or binary names in telemetry schema names, record kinds, or user-facing surfaces (§21; the forbidden-literals check extended to the new files).
3. Assert error-table sync: any additive spend error-row refinement (§16) appears in machine and documented tables bidirectionally; delivered rows unchanged; no exit literals outside the projection module.
4. Assert boundary confinement and import rules for every new module (the boundary suite passes with the fixture-coverage meta-check green).

**Expected Outcome**:

- Contracts are declared once and asserted through constants; conformance scans stay green (`pnpm check:prompt`, `check:help` unaffected; content inventory updated for new files).

## 6. Environments and Test Data

- **Environment**: local developer machine or CI runner; Bun (pinned via `.bun-version`); pnpm workspace. Offline and hermetic — no network, no live harness stores, no credentials, no real user state directories (NFR-6). Aggregate gate per pm-notes delivery conventions: `TMPDIR=$PWD/tmp/tmpdir pnpm check`.
- **Stream test data**: the committed single stream oracle at `tests/fixtures/harness/stream/` (clean stop, tool error, stream error; provenance recorded in its README) plus the deliberate GAP-2 extension adding a token/cost-bearing v2.x.y capture (real capture, synthetic redacted content, provenance updated, one shape per file). Synthetic frames for omission/drift matrices are built only through `tests/fixtures/harness/scenarios/stream.ts`.
- **Store test data**: per-test temp state roots via `tests/fixtures/state/harness.ts`; v1 closeout capture via `tests/fixtures/closeout/harness-telemetry.ts`; a new `tests/fixtures/telemetry/` builder seeding v2 step records, harness-reported session totals (present, partial, and absent variants), economics records (restarts, corroborated stalls), audit identity (runId/role/lane), and `phase.transition` histories with literal timestamps. All fixtures synthetic and privacy-scanned (no real session ids, credentials, or personal data).
- **Injected nondeterminism sources**: fixed clock (`NOW_MS` constant), fixed run/session id sequences, synthetic brand; ordering fixtures use non-time-sortable ids deliberately.
- **Isolation**: one temp store per case; goldens and mutant copies run against temp roots or committed read-only fixtures; the live tree and real state directories are never written. Temporary workspaces for boundary negative fixtures follow the delivered boundary-suite pattern.
- **Cleanup**: temp roots discarded per test; no persistent state outside the repo's committed fixtures; goldens regenerated only deliberately with the recorded command (testing strategy snapshot rule).

## 7. Automation Plan and Implementation Mapping

| TC ID(s) | Test file(s) to create/update | Execution command | Mocking / seeding requirements | Status |
|----------|------------------------------|-------------------|-------------------------------|--------|
| 001..005 | `tests/behaviour/telemetry-ingest.test.ts` (new) | `bun test tests/behaviour/telemetry-ingest.test.ts` | Committed stream fixtures + scenario module; token-bearing capture (GAP-2); temp store; recorded seams | To Implement |
| 006..008 | `tests/behaviour/telemetry-attribution.test.ts` (new) | `bun test tests/behaviour/telemetry-attribution.test.ts` | Seeded economics + audit identity; recording substrate probe | To Implement |
| 009 | `tests/behaviour/telemetry-timing.test.ts` (new) | `bun test tests/behaviour/telemetry-timing.test.ts` | Seeded transitions + economics records; hand-computed durations | To Implement |
| 010 | `tests/behaviour/telemetry-storage-migration.test.ts` (new) | `bun test tests/behaviour/telemetry-storage-migration.test.ts` | Version-N seeded store; N+1 reader; record-level equality assertions | To Implement |
| 011, 024 | `tests/behaviour/telemetry-storage-coexistence.test.ts` (new); `tests/behaviour/spend-v2-fold-basis.test.ts` (new) | `bun test tests/behaviour/telemetry-storage-coexistence.test.ts tests/behaviour/spend-v2-fold-basis.test.ts` | Both capture planes seeded; harness totals; declared reading-basis constants | To Implement |
| 012, 013 | `tests/behaviour/telemetry-storage-damage.test.ts`, `tests/behaviour/telemetry-storage-growth.test.ts` (new) | `bun test tests/behaviour/telemetry-storage-{damage,growth}.test.ts` | Damaged-store builders; generated size ladder | To Implement |
| 014, 015 | `tests/behaviour/spend-v2-breakdown.test.ts` (new); `tests/golden/spend.test.ts` (update) | `bun test tests/behaviour/spend-v2-breakdown.test.ts tests/golden/spend.test.ts` | Hand-summed oracle; five-dimension seed; injected clock/run id | To Implement (+ golden update) |
| 016 | `tests/behaviour/spend-v2-refusals.test.ts` (new) | `bun test tests/behaviour/spend-v2-refusals.test.ts` | Recording read seam (zero reads on refusal); accepted-value control | To Implement |
| 017 | `tests/behaviour/spend-v2-v1-compat.test.ts` (new); `tests/structure/spend-contract.test.ts` (update) | `bun test tests/behaviour/spend-v2-v1-compat.test.ts tests/structure/spend-contract.test.ts` | v1-only store + v2 store; six-key payload assertions; identity constant | To Implement (+ contract update) |
| 018 | `tests/behaviour/spend-v2-fold-basis.test.ts` | `bun test tests/behaviour/spend-v2-fold-basis.test.ts` | Non-opencode v1 capture fixture; absence paired control | To Implement |
| 019..023 | `tests/behaviour/spend-reconciliation.test.ts` (new); `tests/golden/spend.test.ts` (update) | `bun test tests/behaviour/spend-reconciliation.test.ts tests/golden/spend.test.ts` | Reconciliation matrix fixtures R-01..R-08; declared tolerance/verdict constants | To Implement (+ golden update) |
| 025 | `tests/behaviour/spend-absent.test.ts` (update) | `bun test tests/behaviour/spend-absent.test.ts` | Absence matrix stores S-05/S-06/S-09; paired present control | Existing – Update |
| 026 | `tests/behaviour/spend-store-damage.test.ts` (update) | `bun test tests/behaviour/spend-store-damage.test.ts` | Damage-class builders; paired healthy store | Existing – Update |
| 027 | `tests/behaviour/retro-telemetry-evidence.test.ts` (new) | `bun test tests/behaviour/retro-telemetry-evidence.test.ts` | Delivered retro append seam; evidence source-set contract | To Implement |
| 028, 029 | `tests/behaviour/brief-spend-citation.test.ts` (new); `tests/golden/brief.test.ts` (update) | `bun test tests/behaviour/brief-spend-citation.test.ts tests/golden/brief.test.ts` | Present/absent telemetry stores; closed-catalog contract | To Implement (+ golden update) |
| 030 | `tests/behaviour/status-spend-{section,parity,degraded}.test.ts` (update) | `bun test tests/behaviour/status-spend-section.test.ts tests/behaviour/status-spend-parity.test.ts tests/behaviour/status-spend-degraded.test.ts` | One store, two render paths (parity) | Existing – Update |
| 031 | `tests/behaviour/telemetry-disclosure.test.ts` (new) | `bun test tests/behaviour/telemetry-disclosure.test.ts` | Render outputs from all four consumer paths × three store states | To Implement |
| 032 | `tests/behaviour/telemetry-determinism.test.ts` (new); `tests/behaviour/spend-determinism.test.ts` (update) | `bun test tests/behaviour/telemetry-determinism.test.ts tests/behaviour/spend-determinism.test.ts` | Injected clock/run id; model-call recording seam; permutation control | To Implement (+ update) |
| 033 | `tests/behaviour/spend-bounds.test.ts` (update); `tests/behaviour/telemetry-disclosure.test.ts` | `bun test tests/behaviour/spend-bounds.test.ts` | Generated over-cap breakdown sets; measured UTF-8 bytes | Existing – Update |
| 034 | `tests/behaviour/spend-performance.test.ts` (update) | `bun test tests/behaviour/spend-performance.test.ts` | 1k/10k generated stores; recorded read-seam counts | Existing – Update |
| 035 | `tests/behaviour/telemetry-privacy.test.ts` (new); `tests/checks/privacy-literals.test.ts` (update if extended) | `bun test tests/behaviour/telemetry-privacy.test.ts` | Prompt-marker fixtures; redaction chokepoint composition | To Implement |
| 036 | `tests/checks/telemetry-hermetic.test.ts` (new) | `bun test tests/checks/telemetry-hermetic.test.ts` | Hermeticity probe harness over the new suite set | To Implement |
| 037 | `tests/behaviour/telemetry-audit-compose.test.ts` (new) | `bun test tests/behaviour/telemetry-audit-compose.test.ts` | Audit ledger seam; failing-audit injection | To Implement |
| 038 | `tests/checks/telemetry-mutants.test.ts` (new) | `bun test tests/checks/telemetry-mutants.test.ts` | Ten disabling mutants (TC-TELEMETRY-038 list); paired fixtures | To Implement |
| 039 | `tests/structure/telemetry-contract.test.ts`, `tests/structure/telemetry-imports.test.ts` (new); `tests/structure/{spend-contract,content-inventory,error-table}.test.ts`, `tests/checks/{error-table-sync,exit-code-literals,forbidden-literals}.test.ts` (update as needed) | `bun test tests/structure tests/checks` + `bun run scripts/checks/{error-table-sync,exit-code-literals,forbidden-literals}.ts` | Declared contract constants; inventory registration | To Implement (+ updates) |
| Fixture set | `tests/fixtures/harness/stream/opencode-v2.2.5-tokens.jsonl` + `README.md` provenance (new/update, deliberate); `tests/fixtures/telemetry/**` (new); `tests/fixtures/harness/scenarios/stream.ts` (update) | fixture-privacy scan via `bun test tests/checks/fixture-privacy.test.ts` | Real-shape token-bearing capture; seeded-store builders | To Implement (GAP-2) |
| Regression envelope | all suites above | `TMPDIR=$PWD/tmp/tmpdir pnpm check` | none (aggregate gate) | Existing – No Change (gate unchanged) |
| Docs & planning pages | `--help` golden / reference pages for spend; `doc/planning/oss-tooling/` backlog markers + status snapshot | manual content check + `bun test tests/structure/content-inventory.test.ts` | none | Manual verification + static checks |

Existing suites asserted unchanged (regression half only): `harness-opencode-stream.test.ts`, `harness-stream-hygiene.test.ts`, `harness-telemetry-*.test.ts`, `closeout-telemetry-production.test.ts`, the `spend-*` v1 family's delivered assertions, `economics-*.test.ts`, `tests/golden/status-digest.test.ts`, the delivered redaction suite.

## 8. Risks, Assumptions, and Open Questions

### 8.1 Risks

| Risk | Mitigation in this plan |
|------|------------------------|
| The committed stream fixtures carry no token/cost payload (GAP-2), so positive-path counting could be tested on invented shapes | GAP-2 names the deliberate README-disciplined extension as the fixture prerequisite for TC-TELEMETRY-001/014/019; until extended, framing and degradation paths run on the committed set and synthetic scenario-module frames; provenance stays recorded |
| Real deliveries reconcile outside the ≤2% tolerance (RSK-4), making the pinned `within` scenario fixture-dependent | The pinned scenario is tested on a fixture whose figures are constructed to reconcile (hand-summed); the outside path is a separate declared-outcome case (TC-TELEMETRY-020); real-delivery divergence renders declaredly, not as test failure |
| Double counting across planes could make a wrong fold look right on one fixture (RSK-2) | TC-TELEMETRY-024 asserts the combination arithmetic through declared constants and requires divergence beyond tolerance to surface the outside verdict; the mutant `clamp-outside-to-within` guards the honesty rule |
| Warning/prose constants are unpinned (GAP-4/5/6), risking tests that assert implementation strings | All such assertions go through declared contract constants asserted in TC-TELEMETRY-039; prose obligations are asserted structurally (present, disclosed, non-zero) plus goldens pinned at delivery |
| NFR-4 wall-clock thresholds are runner-dependent (GAP-3) | CI asserts bounded work via recorded seams; wall-clock is a recorded reference measurement only |
| Contract growth regresses pinned consumer invariants (RSK-6: closed surface catalog, evidence source set) | TC-TELEMETRY-027/028 assert the catalogs grow only by the declared additive surfaces; delivered catalog contract tests update in the same change |
| Cost sparsity in practice (RSK-7) could tempt zero-filling | TC-TELEMETRY-002/019 (R-08) assert exclusion-and-disclosure; `fabricate-class-to-zero` and `sum-null-as-zero` mutants must fail |

### 8.2 Assumptions

- opencode v2.x.y step frames carry per-step token and cost data sufficient for the counting contract; where absent, the declared drift/omission rules apply (spec §12) — the fixture extension (GAP-2) will confirm the real field names.
- Harness-reported session totals are available per session from the harness store/stream for the reconciliation baseline (spec §12); the fixture builder seeds them through the declared sourcing (OQ-T2).
- The command-audit claimed identity is present for lanes dispatched through the delivered adapters (spec §12); attribution tests seed it through the delivered spawn path or equivalent fixture records.
- The delivered streaming seam, economics records, transition history, and v1 spend fold are consumed as-is; this plan extends, never reworks, their delivered assertions.
- Retention follows the state-layer convention; no new retention regime is introduced (spec §12, §20).

### 8.3 Open Questions

| ID | Question | Blocking status | Owner |
|----|----------|-----------------|-------|
| OQ-T1 | What are the real token/cost field names in a token-bearing v2.x.y `step_finish` frame (GAP-2)? Resolved by the deliberate fixture extension during delivery. | Non-blocking for this plan; blocking for TC-TELEMETRY-001/014/019 positive-path runs | @coder (delivery, fixture task) |
| OQ-T2 | The pm-notes TO-CONFIRM: what is the sourcing of harness-reported session totals per reading plane (stream-ingested vs closeout-captured), i.e., which records constitute the DEC-5 summed baseline in each basis? | Must be resolved by `chg-GH-291-plan.yaml` (phase 4, GAP-1); this plan then asserts the declared basis through contract constants — the reconciliation matrix R-01..R-08 is invariant to the resolved sourcing | @plan-writer |
| OQ-T3 | Exact telemetry storage schema-version constant naming (GAP-7) and the declared warning-vocabulary strings (GAP-4) — declared in the contract module during delivery. | Non-blocking; pinned by TC-TELEMETRY-039 with the contract suite | @coder (delivery, contract task) |
| OQ-T4 | Does the declared combination arithmetic for both-planes-present reports (S-04/R-07) deduplicate by session/run identity, and if so, on which key? | Non-blocking for this plan (asserted through the declared contract constant either way); must be declared before TC-TELEMETRY-024's constant is pinned | @plan-writer → @coder |

## 9. Plan Revision Log

| Version | Date | Author | Changes |
|---------|------|--------|---------|
| 1.0 | 2026-11-12 | @test-plan-writer | Initial test plan for GH-291 (M2-S14 Harness telemetry v2): 39 scenarios (TC-TELEMETRY-001..039) covering all 13 ACs, DM-1..DM-6, NFR-1..NFR-8 with no TODOs; reconciliation verdict matrix R-01..R-08, fold-basis matrix S-01..S-09, ingest degradation matrix I-01..I-07, exit/identity oracle E-table; binding fixture, non-vacuity, and mutant contracts mirroring the GH-236 precedent; gaps GAP-1..GAP-7 declared with owners |

## 10. Test Execution Log

No suites were run while authoring this plan. This log is populated during delivery (phase 6) and quality gates (phase 9); NFR-4 reference measurements (TC-TELEMETRY-034, GAP-3) are recorded here.

| TC ID | Run Date | Result | Notes |
|-------|----------|--------|-------|
| — | — | — | Awaiting delivery |
