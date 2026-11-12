---
change:
  ref: GH-291
  type: feat
  status: Proposed
  slug: telemetry-v2
  title: "M2-S14: Harness telemetry v2"
  owners: [engineering]
  service: delivery-os telemetry plane (harness telemetry ingest, attribution, storage, and spend read side)
  labels: [m2, telemetry, spend, learning-plane, state-layer, cli, retro, brief]
  version_impact: minor
  audience: internal
  security_impact: low
  risk_level: medium
  dependencies:
    internal:
      - harness adapters (GH-233 / M1-S11) — opencode streaming JSONL seam, step-frame decoding, extractors, closeout capture point
      - session lifecycle economics (GH-235 / M1-S15) — restart, exhaustion, and stall records and the per-delivery economics view
      - spend read side (GH-236 / M1-S19) — the v1 spend fold, envelope, and classified telemetry-absent outcome being extended
      - command audit ledger and agent identity (GH-223 / M1-S22) — runId, timing, and claimed agent/lane identity for attribution
      - state layer (GH-174) — verified reads, fenced appends, schema-versioned record kinds
      - result contract and error table (GH-172) — envelope, error rows, exit projection, redaction chokepoint
      - closeout transaction (GH-183 / GH-240) — the delivered closeout-time capture that v2 coexists with
      - retro evidence pipeline (GH-232) — the evidence pass that must cite the numbers
      - status digest and brief (GH-228, GH-243) — render surfaces sharing the same fold
      - configuration layer (GH-173) and branding seam (GH-171) — harness settings and brand-neutral naming
    external:
      - opencode harness (v2.x.y JSONL stream shape and step frames; store-reported session totals)
links:
  issue: https://github.com/juliusz-cwiakalski/agentic-delivery-os/issues/291
  related_changes: ["GH-284", "GH-233", "GH-235", "GH-236", "GH-223", "GH-232", "GH-228", "GH-240"]
  related_decisions: ["ADR-0008", "TDR-0016", "TDR-0011", "ADR-0003"]
---

# CHANGE SPECIFICATION

> **PURPOSE**: Deliver harness telemetry v2 — per-step token, cost, and timing telemetry ingested from the opencode v2.x.y harness stream, attributed per ticket, repository, lane, agent role, and model, kept in schema-versioned local event storage, and surfaced as spend v2 breakdowns with a declared-tolerance reconciliation — so spend, metrics, and the retro and brief learning surfaces state facts, not estimates.

## 1. SUMMARY

This change delivers milestone story M2-S14: harness telemetry v2. It ingests per-step cost and token counts from the opencode v2.x.y harness JSONL stream, attributes every step through the delivered session economics (M1-S15) and command-audit identity (M1-S22) into the five attribution dimensions — ticket, repository, lane, agent role, and model — captures phase-transition, stall, and restart timing, and stores the result in schema-versioned local event storage whose version bumps migrate by re-reading. It extends the delivered spend read side additively: token and cost breakdowns per ticket, repository, lane, agent role, and model, plus per-phase timing summaries and a reconciliation disclosure against harness-reported session totals within a declared tolerance (default ≤2%, adopted here). Telemetry absence remains the delivered classified outcome, never a zero report. The retro evidence pass and the morning brief cite the numbers. The alarm and metric layers (ceremony share, cycle time, burn-rate alarms) remain owned by M2-S6, which consumes this telemetry later. Milestone M1 is complete (23/23), so all four dependencies (M1-S11, M1-S15, M1-S19, M1-S22) are delivered current truth.

## 2. CONTEXT

### 2.1 Current State Snapshot

- **v1 telemetry is closeout-time and aggregate-only.** The delivered extractors read both harness stores strictly read-only and fold them into one harness-neutral statistics shape: one record per (session, agent, model) group for opencode, one per session for Claude Code. Capture happens only inside the closeout transaction — it is non-gating, idempotent, and appends additive `harness.telemetry` session-group and capture-outcome records to the state event log. Cost is carried null-when-missing and is not aggregated. Capture outside closeout (phase boundaries, session end) was an explicit v1 non-goal, so nothing is captured while a session runs, and per-step granularity does not exist anywhere.
- **The v1 spend read side exists and is the surface v2 extends.** `spend [--ref] [--phase] [--amplification] [--json]` is a deterministic, read-only fold over the captured `harness.telemetry` record families plus the ref's `phase.transition` history. Its envelope payload carries schema identity `delivery.spend.v1` with exactly six keys (`tokensByClass`, `perPhase[]`, `perAgent[]`, `restarts`, `amplification`, `degradation`). Cost is not aggregated and never rendered in v1. `spend.telemetry-absent` is the delivered classified outcome at exit 1. The status digest's section 8 is fed by the same fold.
- **The attribution substrates are delivered.** Session lifecycle economics (M1-S15) appends `economics.restart` and `economics.budget-exhaustion` records under the per-delivery economics store key, classifies stalls through corroborated liveness evidence, and derives the restart history and amplification view. The command audit ledger (M1-S22) records every invocation's runId, command, timing, and outcome, and carries the claimed calling-agent identity — set by the harness adapter at spawn from the agent role and lane id. These give telemetry the lane, agent-role, and run identities it needs; the identity is unauthenticated attribution (claimed, not proven).
- **The opencode stream is already decoded line-by-line.** The streaming spawn seam drains the harness JSONL stdout; the adapter acquires the session handle from the first identified line, keeps draining until process close, and already reads terminal `step_finish` frames for completion evidence. Committed real-shape stream fixtures for opencode v2.2.5 (clean stop, tool error, stream error) pin the frame shapes.
- **The learning consumers are delivered.** The retro evidence pipeline collects declared GET-only sources into a chain-verified sidecar; the brief renders nine closed surfaces with no spend citation; the status digest renders spend section 8 from the same fold as the command.
- **Planning truth.** Backlog M2-S14 (canonical for M2 scope, planned by GH-284) defines goal, tasks, and AC. The M2 milestone pack defines the `telemetry.v1` contract (attribution fields, counting, reconciliation tolerance, absence, storage) and a proposed `spend(1)` v2 surface, and pins scenarios SC-M2-S14-01 and SC-M2-S14-02.

### 2.2 Pain Points / Gaps

- **No per-step granularity and no cost.** v1 telemetry captures closeout-time session-group aggregates only; per-step token classes, calls, and per-model cost — the units the harness reports — are never captured, so per-agent/model cost facts cannot be stated at all.
- **No lane or repository dimension.** Captured records carry agent/model identity but not the lane or repository dimensions the metrics and multi-repository workstation stories need.
- **No timing summaries.** Phase transitions, stalls, and restarts exist as ledger and economics records, but no surface joins them into per-phase timing summaries (start, end, duration) beside the spend figures.
- **No reconciliation.** Spend totals carry no cross-check against harness-reported session totals, so no figure can state a declared accuracy; consumers cannot distinguish measured fact from fold artifact.
- **The learning surfaces do not cite spend.** The retro evidence pass has no telemetry source, and the brief deliberately carries no spend surface, so retrospectives and the owner's morning view reason without cost facts.
- **A stale ownership line in the milestone pack.** The pack's "spend v2 owned by M2-S6" line conflicts with the canonical backlog; the PM has recorded the supersession decision (see DEC-1) — noted for doc-syncer reconciliation in phase 7.

## 3. PROBLEM STATEMENT

Because harness telemetry is captured only as closeout-time session-group aggregates — with no per-step token/cost detail, no lane or repository dimension, no joined timing, and no cross-check against harness-reported session totals — the operator cannot state per-ticket, per-repository, per-lane, per-agent-role, or per-model cost and timing facts with a declared accuracy, so spend, metrics, and the retro and brief surfaces reason over estimates or silence instead of measured facts.

## 4. GOALS

- **G-1**: Per-step token, calls, and cost telemetry ingested from the opencode v2.x.y harness stream (step frames), counted in the units the harness reports: per-step input, output, reasoning, cache-read, and cache-write tokens; calls; and cost per model.
- **G-2**: Attribution of every captured step to ticket, repository, lane, agent role, and model through the delivered session economics and command-audit identity, with phase timing (start, end, duration) and stall/restart timing joined from delivered records rather than re-estimated.
- **G-3**: Schema-versioned local event storage for the telemetry; a storage version bump migrates by re-reading.
- **G-4**: The spend read side extended additively: breakdowns per ticket, repository, lane, agent role, and model; per-phase timing summaries; token and cost totals; and a reconciliation disclosure against harness-reported session totals within a declared tolerance stated with every summary.
- **G-5**: Telemetry absence preserved as the delivered classified outcome (`spend.telemetry-absent`, exit 1) — never a zero report, never a silently empty success on the command surface.
- **G-6**: The retro evidence pass and the morning brief cite these numbers, rendering classified absence instead of zeros when telemetry is absent.
- **G-7**: A clean boundary with M2-S6: this change delivers capture, ingest, storage, the spend breakdown, reconciliation, and retro/brief citation; alarms and metric layers remain M2-S6 work consuming this telemetry.

### 4.1 Success Metrics / KPIs

| Metric | Target |
|--------|--------|
| Reconciliation accuracy (SC-M2-S14-01) | On a completed delivery with telemetry, `data.reconciliation.verdict == "within"` and `data.reconciliation.tolerance` ≤ 0.02, with the tolerance stated in every summary |
| Absence classification (SC-M2-S14-02) | 100% of telemetry-absent invocations exit 1 with `error.code == "spend.telemetry-absent"` and print no zero-valued report |
| Ticket AC coverage | 100% of ticket ACs mapped to at least one binding acceptance criterion (Section 17) and passing on fixture-seeded stores |
| v1 compatibility | Zero breaking changes: the delivered v1 spend grammar and six-key payload remain valid and readable unchanged |
| Consumer citation | The retro evidence pass and the brief cite the breakdown numbers and the reconciliation disclosure on every telemetry-present render |
| Determinism | Byte-identical repeat renders for identical stored telemetry, injected clock, and injected run id |
| Offline verification | 100% of new tests run offline on committed stream fixtures and fixture-seeded stores; zero live harness stores, credentials, or network |

### 4.2 Non-Goals

- **NG-1**: Alarm and metric layers — ceremony share, cycle time, CI failure rate, escaped defects, burn-rate alarms (M2-S6; per DEC-1 they consume S14 telemetry and are delivered later).
- **NG-2**: Harness-store re-query on the spend read path — the v1 log-only read rule is preserved; stream ingest is capture-time work, never read-time re-query.
- **NG-3**: Stream ingest for non-opencode harnesses — the ticket scopes per-step ingest to opencode v2.x.y step frames; other harnesses keep delivered closeout-time capture (see OQ-1 for the read-side question).
- **NG-4**: Currency normalization or unit conversion — cost is reported in the units the harness reports, never converted or re-priced.
- **NG-5**: Provider peak pausing and the zero-spend assertion (M2-S17) — that story consumes this telemetry; no window watcher, park, or resume behavior lands here.
- **NG-6**: Cross-repository or project-group aggregation (M2-S18/M2-S19) — telemetry stays scoped per repository checkout.
- **NG-7**: Retro ceremony, action registry, or memory changes (M2-S3/M2-S8/M2-S10) — the retro pipeline gains an evidence source only.
- **NG-8**: Board or queue surfaces — no board, queue, or lane-engine changes.
- **NG-9**: Backfill of historical sessions or sessions outside the current delivery — no historical re-capture.
- **NG-10**: Semantic-duplication proof — telemetry proves token/cost arithmetic, not content-level re-reading.

## 5. FUNCTIONAL CAPABILITIES

| ID | Capability | Rationale |
|----|------------|-----------|
| F-1 | Per-step stream ingest | The counting contract (five token classes, calls, cost per model) needs per-step capture from the opencode v2.x.y stream, not closeout-time aggregates |
| F-2 | Five-dimension attribution | Ticket/repository/lane/agentRole/model attribution through session economics and command-audit identity makes spend state facts per the metrics dimensions |
| F-3 | Timing capture | Phase-transition, stall, and restart timing gives the per-phase timing summaries the ticket AC requires |
| F-4 | Schema-versioned local event storage | Telemetry must survive version evolution; a version bump migrates by re-reading rather than stranding old data |
| F-5 | Spend v2 read side (additive) | Breakdowns per ticket/repo/lane/agentRole/model plus timing summaries on the existing spend surface, with the v1 shape kept valid |
| F-6 | Reconciliation disclosure | Observed totals cross-checked against harness-reported session totals within a declared tolerance, stated with every summary — never applied silently |
| F-7 | Classified absence | Telemetry absence remains a classified outcome; a delivery with no telemetry says so |
| F-8 | Retro and brief citation | The learning surfaces cite the numbers, closing the estimates gap the ticket names |

### 5.1 Capability Details

- **F-1 Per-step stream ingest**: The opencode harness stream's step frames carry per-step token and cost facts; ingest counts each step's input, output, reasoning, cache-read, and cache-write tokens, call counts, and cost per model in the units the harness reports. A frame that omits a class or field degrades with a warning from a closed reason vocabulary; the missing value is excluded from sums and never fabricated to zero or to a plausible estimate. Ingest rides the delivered streaming seam; it adds no process primitive, no new bounds semantics, and no blocking work that changes the delivered stream-drain behavior.
- **F-2 Five-dimension attribution**: Each captured step is attributed to its ticket (work-item ref), repository (checkout identity), lane, agent role, and model. Attribution derives from the delivered substrates: session economics for session/run identity, and command-audit identity for the claimed agent role and lane. A step that cannot be attributed to a dimension is recorded as classified degradation with its reason and is never attributed to a wrong dimension by guess or default.
- **F-3 Timing capture**: Telemetry carries per-step and per-phase timing — start, end, and duration. Phase timing derives from the delivered `phase.transition` history (extending the v1 capture-time attribution windows with explicit start/end/duration summaries); stall timing reflects the corroborated stall evidence the economics surface already records; restart timing reflects the delivered restart records. No timing is re-estimated from heuristics when a delivered record exists.
- **F-4 Schema-versioned local event storage**: Captured telemetry lands in local event storage with a declared schema version. A version bump migrates by re-reading: stored events can be re-derived from their versioned source rather than in-place mutation, so no telemetry is stranded by an upgrade. Naming follows the brand-neutral delivery schema pattern (no hardcoded product names).
- **F-5 Spend v2 read side (additive)**: The spend surface gains a breakdown selection over the five dimensions (`ticket`, `repository`, `lane`, `role`, `model`; all five present in the machine report) and renders token and cost totals, per-agent-role and per-model breakdowns, and per-phase timing summaries. The v1 grammar and the delivered six-key `delivery.spend.v1` payload remain valid; v2 additions are strictly additive under the envelope's `data`. A breakdown value outside the five declared fields is refused with a classified input error before any read.
- **F-6 Reconciliation disclosure**: Every summary reconciles observed totals against harness-reported session totals within a declared tolerance. This change adopts the contract default of ≤2% (0.02) of the harness-reported session totals (DEC-2). The reconciliation disclosure carries the harness session totals, the observed totals, the tolerance, and a verdict (`within` or the declared outside verdict); the tolerance is stated with every summary, never applied silently. An observed deviation beyond the tolerance renders the outside verdict declaredly — it is a stated outcome, not a hidden error.
- **F-7 Classified absence**: A selection with no telemetry reports the delivered `spend.telemetry-absent` classified outcome at exit 1 and prints no zero-valued report. Store damage keeps the delivered `state.*` identities and is never re-projected as absence; absence is never reused for damage.
- **F-8 Retro and brief citation**: The retro evidence pass gains the spend telemetry as collected evidence, so a change-level retro cites per-role/model numbers, timing summaries, and the reconciliation verdict as collector-truth evidence. The morning brief cites the same numbers with the reconciliation disclosure; when telemetry is absent, both render the classified absence instead of zeros or silence.

## 6. USER & SYSTEM FLOWS

```
Flow 1: Stream ingest during delivery
  opencode session runs → the streaming seam drains the JSONL stream
  → each step frame is decoded → tokens/calls/cost counted per step (F-1)
  → attributed via session economics + command-audit identity (F-2)
  → phase/stall/restart timing joined from delivered records (F-3)
  → appended to schema-versioned local event storage (F-4)
  → ingest failure or frame drift → classified warning, never silent loss

Flow 2: Spend v2 report (spend [--ref <ref>] [--breakdown <field>] [--json])
  owner or lifecycle agent invokes spend → read-only fold over stored telemetry
  → totals (tokens + cost), breakdowns by ticket/repository/lane/role/model,
    per-phase timing summaries rendered
  → reconciliation line: harness session totals vs observed totals,
    tolerance stated, verdict declared (F-5, F-6)
  → exit 0 with the report

Flow 3: Absence path
  spend invoked for a ref with no telemetry
  → classified outcome spend.telemetry-absent, exit 1
  → no zero-valued report rendered (F-7)

Flow 4: Learning citation
  retro evidence pass collects → telemetry numbers recorded as evidence,
  cited in the report (F-8)
  morning brief renders → cites the same numbers + reconciliation line;
  absence renders as classified absence, never zeros (F-8)
```

## 7. SCOPE & BOUNDARIES

### 7.1 In Scope

- Per-step ingest of token classes, calls, and per-model cost from opencode v2.x.y stream step frames.
- Five-dimension attribution (ticket, repository, lane, agent role, model) through session economics and command-audit identity, with classified degradation for unattributable steps.
- Phase-transition, stall, and restart timing capture and per-phase timing summaries.
- Schema-versioned local event storage with re-read migration on version bump.
- Spend read-side extension: breakdown selection over the five dimensions, token and cost totals, timing summaries, and the reconciliation disclosure with the declared tolerance (default ≤2% adopted; DEC-2).
- Classified absence preservation on every reporting path.
- Retro evidence-pass citation and brief citation of the numbers.
- Status digest section 8 parity: the digest projection stays fed by the same fold so command and digest agree.
- Storage coexistence with delivered closeout-time capture (both planes defined; the reconciliation disclosure names its reading basis).
- Tests proving the pinned scenarios SC-M2-S14-01 and SC-M2-S14-02 and every binding acceptance criterion, offline on committed stream fixtures and fixture-seeded stores.
- Maintenance of `doc/planning/oss-tooling/` per convention (backlog markers, status snapshot), including the reconciliation of the stale spend-ownership line noted for doc-syncer.

### 7.2 Out of Scope

- [OUT] Alarm and metric layers: ceremony share, cycle time, CI failure rate, escaped defects, burn-rate alarms (M2-S6).
- [OUT] Stream ingest or stream capture for non-opencode harnesses.
- [OUT] Currency normalization, re-pricing, or cross-model cost conversion.
- [OUT] Provider profile nomination, peak-window watching, parking, or zero-spend enforcement (M2-S17).
- [OUT] Cross-repository or project-group telemetry aggregation.
- [OUT] Board, queue, lane-engine, or supervision changes.
- [OUT] Retro ceremony content, action registry, memory records, or memory lint changes.
- [OUT] Backfill of historical sessions or deliveries.
- [OUT] New tracker, provider, or MCP integrations.
- [OUT] Capture into the memory change capsule — the capsule is not a telemetry carrier; telemetry stays in its own versioned event storage.

### 7.3 Deferred / Maybe-Later

- Claude Code per-step telemetry if a future harness version exposes a comparable stream.
- Cost normalization to a reference currency (needs a pricing source decision — a candidate decision record, not invented here).
- Finer-than-phase attribution windows, if M2-S6 metrics need sub-phase localization.
- Telemetry export bundles beyond the retro library-only export.

## 8. INTERFACES & INTEGRATION CONTRACTS

### 8.1 REST / HTTP Endpoints

N/A — the surfaces are CLI commands and local storage; no HTTP endpoint is added or changed.

### 8.2 Events / Messages

| Direction | Element | Contract |
|-----------|---------|----------|
| Inbound | opencode v2.x.y JSONL step frames | Read-only consumption over the delivered streaming seam; per-step token classes, calls, and cost per model in harness-reported units; frame drift degrades with closed-vocabulary warnings |
| Storage | Telemetry event records | Schema-versioned local event storage; version bump migrates by re-reading (DM-5); brand-neutral schema naming |
| Derived | Reconciliation disclosure | Every summary carries harness session totals, observed totals, tolerance, and verdict (DM-3); the tolerance is stated, never silent |
| Derived | Retro evidence records | The retro evidence pass records the spend telemetry as sidecar evidence through its delivered append seam |
| Render | Brief / status projections | The brief cites the numbers; the digest projection stays fed by the same fold |

### 8.3 Data Model Impact

| ID | Element | Description |
|----|---------|-------------|
| DM-1 | Telemetry step record | One captured step's tokens by the five classes, calls, cost per model (harness-reported units), and the attribution fields: ticket, repository, lane, agentRole, model, plus step timing and closed-vocabulary warnings |
| DM-2 | Phase timing summary | Per-phase start, end, and duration derived from the delivered phase-transition history; stall and restart intervals joined from the delivered economics records |
| DM-3 | Reconciliation block | Harness-reported session totals, observed totals, tolerance (≤ 0.02 adopted), and verdict (`within` / declared outside verdict); required in every summary |
| DM-4 | Telemetry state disclosure | The report declares `present` or the classified absence kind, so absence is never a zero report |
| DM-5 | Storage schema version | The telemetry storage's declared schema version; a bump migrates by re-reading the versioned source |
| DM-6 | Spend v2 additive data | Breakdown arrays over the five dimensions, timing summaries, the reconciliation block, and the telemetry-state disclosure, added under `data` while the delivered v1 six-key payload stays valid |

### 8.4 External Integrations

- **opencode harness (v2.x.y)**: the JSONL stream shape and step frames, and the harness store's session totals, are external truth this change consumes read-only. Frame shapes are pinned by committed real-shape fixtures with provenance; version drift degrades with warnings and never fabricates data. No new network, credential, or process capability is introduced.

### 8.5 Backward Compatibility

- The v1 spend grammar (`--ref`, `--phase`, `--amplification`, `--json`) and the six-key `delivery.spend.v1` payload remain valid; v2 is additive under `data` (see OQ-3 on schema identity).
- v1's cost-omission honesty line ("cost is not aggregated and never rendered") is superseded within the v2 report, where the ticket AC requires cost per agent role and model; the v1 payload itself is unchanged.
- The delivered `spend.telemetry-absent` identity is reused, not forked; `state.*` identities for store damage are unchanged.
- Delivered closeout-time capture stays as is; v2 stream ingest coexists with it, and the reconciliation disclosure names which reading basis a report used.
- The brief's closed surface catalog grows only through this reviewed change, with contract tests updated in the same change; the retro evidence source set grows additively.
- Phase attribution semantics from v1 (capture-time windows, terminal attribution, the named `unknown` fallback) remain the basis the v2 timing summaries extend.

## 9. NON-FUNCTIONAL REQUIREMENTS (NFRs)

| ID | Requirement | Threshold |
|----|-------------|-----------|
| NFR-1 | Reconciliation tolerance | Declared tolerance defaults to ≤2% (0.02) of harness-reported session totals; stated with every summary; SC-M2-S14-01 pins `data.reconciliation.tolerance` ≤ 0.02 |
| NFR-2 | Bounded output | Machine report ≤ 65,536 UTF-8 bytes; human digest ≤ 16,384 UTF-8 bytes and ≤ 200 lines; truncation is deterministic, tail-ordered, and marked; totals and the reconciliation verdict are never truncated |
| NFR-3 | Determinism | Byte-identical repeat renders for identical stored telemetry, injected clock, and injected run id; zero model calls on any render path |
| NFR-4 | Read-side latency | The extended spend fold renders within the delivered budget: p95 ≤ 500 ms at 1,000 stored telemetry records and ≤ 2 s at 10,000 in the reference environment; one verified read per record family, no per-record re-reads |
| NFR-5 | Ingest non-interference | Per-frame ingest adds no blocking work that changes the delivered stream-drain, handle-acquisition, or output-bound behavior; bounded, constant-memory work per frame |
| NFR-6 | Offline verification | 100% of new tests run offline on committed fixtures and fixture-seeded stores; zero live harness stores, credentials, or network on any test path |
| NFR-7 | Privacy | Telemetry records and reports carry aggregate counts, identity references, and time windows only — never prompt text, message bodies, transcripts, diffs, tool output, or credential material; the delivered redaction chokepoint composes unchanged |
| NFR-8 | Storage growth | Telemetry storage grows linearly with captured steps; retention follows the state-layer convention; no unbounded derived projections |

## 10. TELEMETRY & OBSERVABILITY REQUIREMENTS

The change's product is telemetry, so its own observability requirements are discipline rules on that product:

- Every capture degradation (missing class, unattributable step, frame drift, truncation) is disclosed with a closed-vocabulary warning and a count — never silently dropped, never fabricated.
- Every summary discloses `telemetryState` (DM-4): present, or the classified absence kind.
- Every summary carries the reconciliation disclosure (DM-3) with the tolerance stated.
- Every invocation lands its delivered command-audit record (runId, timing, claimed identity); an audit-write failure is a diagnostic and never changes the outcome.
- Ingest failures are classified outcomes with counts (captured / degraded / failed) and never change the delivery's outcome or verdict.

## 11. RISKS & MITIGATIONS

| ID | Risk | Impact | Probability | Mitigation | Residual Risk |
|----|------|--------|-------------|------------|---------------|
| RSK-1 | opencode v2.x.y stream/store format drift changes step-frame fields or session-total reporting | H | M | Pin committed real-shape fixtures with provenance; probe the observed harness version; degrade with closed-vocabulary warnings instead of fabricating; reconciliation surfaces any mismatch as a declared verdict | L |
| RSK-2 | Double counting across the two capture planes (stream ingest vs delivered closeout capture) inflates totals | H | M | Define the reading basis per report and name it in the disclosure; reconciliation against harness-reported session totals exposes divergence beyond tolerance as a declared outside verdict | M |
| RSK-3 | Unattributable steps (missing lane or claimed agent identity) degrade breakdown accuracy | M | M | Classified degradation counts by reason; wrong-dimension attribution forbidden; the claimed-identity trust model is disclosed | M |
| RSK-4 | Real deliveries reconcile outside the ≤2% tolerance because harness totals and per-step scopes differ | M | M | Tolerance is declared, not silent; the outside verdict is a stated outcome that names the divergence, prompting scope investigation rather than a false-green claim | M |
| RSK-5 | Ingest work on long-running sessions disturbs the delivered stream-drain behavior | M | L | Bounded constant-memory per-frame work; no new bounds semantics; behavior tests over the streaming seam (NFR-5) | L |
| RSK-6 | Brief/retro contract growth regresses pinned invariants (closed surface catalog, evidence source set) | M | L | Contract tests pin the catalogs; growth lands only through this reviewed change with tests and docs updated together | L |
| RSK-7 | Cost fields are frequently absent in practice, making cost breakdowns sparse | M | M | Null-when-missing cost stays excluded and disclosed (never zero); token breakdowns remain complete so the report degrades honestly | M |

## 12. ASSUMPTIONS

- opencode v2.x.y step frames carry per-step token and cost data sufficient for the counting contract; where a field is absent, the delivered drift rules (warn and exclude) apply.
- Harness-reported session totals are available per session from the harness store/stream for the reconciliation baseline.
- The command-audit claimed identity (agent role, lane) is present for lanes dispatched through the delivered adapters; identity is claimed attribution under the single-user trust model, not proven authentication.
- The delivered streaming seam, session economics records, phase-transition history, and spend fold are used as-is; this change extends rather than reworks them.
- Retention of telemetry follows the state-layer convention; no separate retention policy is introduced.

## 13. DEPENDENCIES

| Direction | Item | Notes |
|-----------|------|-------|
| Depends on | Harness adapters (M1-S11, delivered) | Streaming seam, step-frame decoding, extractors, closeout capture point |
| Depends on | Session lifecycle economics (M1-S15, delivered) | Restart/exhaustion records, stall evidence, session identity, per-delivery economics view |
| Depends on | Spend read side (M1-S19, delivered) | The v1 fold, six-key payload, classified absence identity being extended additively |
| Depends on | Command audit ledger and agent identity (M1-S22, delivered) | runId, timing, claimed agent role and lane identity for attribution |
| Depends on | State layer, result contract, configuration layer, branding seam (delivered) | Verified reads and appends, envelope and error table, harness settings, brand-neutral naming |
| Depends on | Retro evidence pipeline and brief/status surfaces (delivered) | The citation consumers extended additively |
| Depends on | opencode v2.x.y (external) | Stream step frames and store-reported session totals, read-only |
| Blocks | M2-S6 Metrics and spend | Alarm/metric layers consume S14 telemetry for per-agent and per-model facts |
| Blocks | M2-S10 Retro action registry (evidence inputs) and M2-S17 zero-spend assertion | Both read this telemetry per the milestone pack and backlog |

## 14. OPEN QUESTIONS

| ID | Question | Context | Status |
|----|----------|---------|--------|
| OQ-1 | On non-opencode harness deliveries (no stream ingest available), does the v2 report fold the delivered closeout-captured v1 records with classified degradation for the missing lane/per-step detail, or classify telemetry absence? | The ticket scopes ingest to opencode v2.x.y step frames; the pinned absence AC must hold for every harness. The v1 capture keeps non-opencode spend reportable today | Resolved — DEC-4: fold the closeout-captured v1 records with classified degradation for the missing lane/per-step detail and the closeout-capture reading basis named; `spend.telemetry-absent` stays reserved for a selection with no telemetry records of either plane |
| OQ-2 | For a delivery spanning multiple harness sessions, is the reconciliation baseline the sum of all harness-reported session totals for the delivery, or per-session totals compared individually? | The contract says "harness-reported session totals" and the pinned scenario reads "the session totals"; the proposed default reading is the sum over the delivery's harness-reported sessions, stated in the disclosure | Resolved — DEC-5: the baseline is the sum of all harness-reported session totals attributed to the delivery, compared once against the observed totals for a single verdict; per-session figures are diagnostic only |
| OQ-3 | Does the v2 payload extend the delivered `delivery.spend.v1` schema identity additively, or declare a new schema identity for the extended payload? | The contract says the M1 shape keeps valid and v2 adds keys under `data`, suggesting additive extension of the delivered identity; the exact identity is a contract refinement for the plan and test plan to pin | Resolved — DEC-6: additive extension of the `delivery.spend.v1` identity — the six v1 keys keep their names and semantics, the DM-6 additions are declared beside them with no renames or collisions, and a new schema identity is reserved for a future change that alters or removes a delivered key's meaning |

## 15. DECISION LOG

| ID | Decision | Rationale | Date |
|----|----------|-----------|------|
| DEC-1 | The spend read-side extension (v2 breakdowns plus the reconciliation disclosure) is delivered by GH-291, superseding the milestone-pack line "spend v2 owned by M2-S6"; backlog M2-S14 tasks and AC are canonical for M2 scope, and M2-S6's tasks are the alarm/metric layers (ceremony share, cycle time, burn-rate alarms) consuming S14 telemetry | PM scope decision recorded in pm-notes; the backlog is the canonical M2 scope source. Doc-syncer note: the planning pages carry the stale ownership line and are reconciled in phase 7 | 2026-11-12 |
| DEC-2 | Adopt the `telemetry.v1` contract default reconciliation tolerance of ≤2% (0.02) of harness-reported session totals, stated with every summary and never applied silently | The contract instructs S14's plan to adopt the default or declare a different tolerance with justification; no source material justifies a different tolerance, and SC-M2-S14-01 pins ≤ 0.02 | 2026-11-12 |
| DEC-3 | Per-step stream ingest is opencode-scoped per the ticket wording; non-opencode harnesses keep delivered closeout-time capture | The ticket names "opencode v2.x.y step frames"; the Claude Code adapter declares its streaming/liveness surface as gaps, so no comparable stream exists to ingest. The read-side consequence for non-opencode deliveries is OQ-1, not assumed here | 2026-11-12 |
| DEC-4 | Non-opencode harness deliveries fold their delivered closeout-captured v1 records into the v2 report with classified degradation for the missing lane/per-step detail and the reading basis named as closeout capture; `spend.telemetry-absent` stays reserved for a selection with no telemetry records of either plane | Absence is the no-records outcome, not a coarseness grade: v1 capture is delivered for both harnesses, so classifying captured records as absence would be a false claim and regress the delivered v1 report non-opencode deliveries get today (AC-F5-2, v1-compatibility KPI); the delivered degradation vocabulary and reading-basis disclosure are the contract's instruments for partial evidence (@decision-advisor adjudication of OQ-1) | 2026-11-12 |
| DEC-5 | The reconciliation baseline is the sum of all harness-reported session totals attributed to the delivery, compared once against the delivery's observed totals for a single verdict; a baseline session without a harness-reported total is excluded from the sum with a closed-vocabulary warning and named count, and a report with no harness-reported baseline at all declares the reconciliation block's classified unavailability rather than verdict `within` | SC-M2-S14-01 asserts one `data.reconciliation.verdict` and DM-3 carries one observed-totals figure, so the tolerance needs one denominator; per-session comparison would fork the pinned verdict and let a small session's absolute noise fake or mask divergence (RSK-4), and the contract's "tolerance stated, never silent" extends to the baseline composition (@decision-advisor adjudication of OQ-2) | 2026-11-12 |
| DEC-6 | The v2 payload keeps the declared `delivery.spend.v1` schema identity: the six v1 keys keep their exact names and semantics and the DM-6 additions (breakdown arrays, timing summaries, reconciliation block, telemetry-state disclosure, cost-bearing totals) are declared beside them in the contract module with no renames or collisions; a new schema identity is reserved for a future change that alters or removes a delivered key's meaning | Schema identities are declared contract constants and the repo's additive pattern (state-layer record kinds, envelope keys under `data`) reserves identity bumps for semantic breaks; keeping the identity keeps every consumer branching on the constant working unchanged (zero-breaking-changes KPI), and the milestone pack's "M1 read side keeps its shape" names growth within the identity (@decision-advisor adjudication of OQ-3) | 2026-11-12 |

## 16. AFFECTED COMPONENTS (HIGH-LEVEL)

| Component | Impact |
|-----------|--------|
| Harness adapter seam (opencode) | Updated — step-frame ingest beside the delivered drain/collect behavior |
| Telemetry storage (state layer) | New/Updated — schema-versioned telemetry event storage with re-read migration |
| Spend read side | Updated — additive breakdowns, timing summaries, cost totals, reconciliation disclosure, telemetry-state disclosure |
| Status digest (section 8 projection) | Updated — stays fed by the same extended fold; parity preserved |
| Morning brief | Updated — spend citation with reconciliation disclosure and classified absence rendering |
| Retro evidence pipeline | Updated — telemetry joins the collected evidence sources |
| Closeout transaction | Unchanged — delivered closeout-time capture coexists; no capture-path rework |
| Session economics and command-audit ledger | Unchanged — consumed as attribution substrates |
| Error table | Updated — additive refinement of the spend error rows for the v2 surface (per the delivered exact-code discipline) |
| Planning pages (`doc/planning/oss-tooling/`) | Updated — backlog markers, status snapshot, stale ownership-line reconciliation (doc-syncer, phase 7) |

## 17. ACCEPTANCE CRITERIA

| ID | Criterion | Linked |
|----|-----------|--------|
| AC-F1-1 | **Given** an opencode v2.x.y session stream carrying step frames, **when** ingest runs during the delivery, **then** each frame's input, output, reasoning, cache-read, and cache-write tokens, calls, and per-model cost (in harness-reported units) are captured per step; and **given** a frame omitting a class or field, **when** ingest processes it, **then** the omission degrades with a closed-vocabulary warning and the missing value is excluded from sums — never fabricated to zero or estimated | F-1, DM-1 |
| AC-F2-1 | **Given** captured step telemetry for a lane, **when** the records are stored, **then** each record carries ticket, repository, lane, agentRole, and model attribution plus step timing; and **given** a step that cannot be attributed to a dimension, **when** ingest processes it, **then** it is counted as classified degradation and is never attributed to a wrong dimension | F-2, DM-1 |
| AC-F3-1 | **Given** a delivery with phase transitions, stalls, and restarts, **when** timing is reported, **then** per-phase timing summaries carry start, end, and duration, and stall and restart intervals are reflected from the delivered economics records rather than re-estimated | F-3, DM-2 |
| AC-F4-1 | **Given** telemetry stored under storage schema version N, **when** a version bump to N+1 occurs, **then** the stored events migrate by re-reading the versioned source and every record remains attributable with no silent data loss | F-4, DM-5 |
| AC-F5-1 | **Given** a completed delivery with captured telemetry, **when** `spend --ref <ref>` runs, **then** the report states token and cost totals, breakdowns per agent role and per model whose token sums equal the totals, and per-phase timing summaries | F-5, F-2, F-3, DM-6 |
| AC-F5-2 | **Given** the delivered v1 spend grammar and payload, **when** any v2 invocation runs, **then** the v1 grammar and six-key `delivery.spend.v1` payload remain valid and readable unchanged, with all v2 additions strictly additive under `data` | F-5, DM-6 |
| AC-F5-3 | **Given** a breakdown selection naming a field outside the five declared dimensions, **when** spend runs, **then** the invocation is refused with a classified input error before any read | F-5 |
| AC-F6-1 | **Given** a completed delivery with harness-reported session totals, **when** `spend --ref` runs, **then** the token and cost totals reconcile within the declared tolerance and the reconciliation line states the tolerance: `data.reconciliation.verdict == "within"` and `data.reconciliation.tolerance` ≤ 0.02 | F-6, NFR-1, DM-3 |
| AC-F6-2 | **Given** observed totals deviating from harness-reported session totals by more than the declared tolerance, **when** the report renders, **then** the reconciliation verdict is declared as outside in the same disclosure — never silently tolerated or rendered as within | F-6, NFR-1, DM-3 |
| AC-F7-1 | **Given** a delivery with no telemetry records, **when** `spend --ref` runs, **then** the exit code is 1 with `error.code == "spend.telemetry-absent"`, and no zero-valued report is printed | F-7, DM-4 |
| AC-F8-1 | **Given** a completed delivery with telemetry, **when** the retro evidence pass collects at the change level, **then** the per-role/model numbers, timing summaries, and reconciliation verdict are recorded as collector-truth evidence and cited in the retro report | F-8, F-5 |
| AC-F8-2 | **Given** a completed delivery with telemetry, **when** the morning brief renders, **then** it cites the spend numbers with the reconciliation disclosure; and **given** telemetry absent for the change, **when** the brief renders, **then** it renders the classified absence instead of zeros | F-8, F-7 |
| AC-N1-1 | **Given** any rendered spend summary (command, digest projection, brief, or retro citation), **when** it is read, **then** it states the telemetry state and the reconciliation tolerance, and no reporting path applies the tolerance silently | NFR-1, F-6, F-7 |

Traceability note: AC-F6-1 and AC-F7-1 are the pinned scenarios SC-M2-S14-01 and SC-M2-S14-02 verbatim in Given/When/Then form. The ticket AC decomposes as: spend reports tokens and cost per agent role and model with phase timings (AC-F5-1, AC-F3-1), reconciling within a declared tolerance (AC-F6-1, AC-F6-2), retro and brief cite the numbers (AC-F8-1, AC-F8-2), and absence remains classified (AC-F7-1).

## 18. ROLLOUT & CHANGE MANAGEMENT (HIGH-LEVEL)

- Delivered through the repository's standard change lifecycle on the change branch for this ticket: plan phases declared in the change's plan, each phase gated and committed at its boundary, quality gates green before the pull request, and the pull request targeting the tooling integration branch (`main-tools`).
- The change is self-contained and additive; no operator migration action is required. Existing v1 spend behavior remains valid on upgrade; telemetry begins accumulating for deliveries run after the change lands (no backfill — NG-9).
- Planning-page maintenance (backlog markers, status snapshot, and the stale spend-ownership line) rides this change per the repository's planning convention; system spec reconciliation happens in the dedicated documentation phase.
- Consumers (M2-S6, M2-S10, M2-S17) adopt the telemetry through the declared contract after this change lands; no coordination with external teams is required.

## 19. DATA MIGRATION / SEEDING (IF APPLICABLE)

- No migration of existing data is required beyond the storage rule itself: a telemetry storage version bump migrates by re-reading the versioned source (F-4, DM-5, AC-F4-1).
- Delivered `harness.telemetry` state records remain readable by the extended fold; the v1 spend payload stays valid (AC-F5-2).
- No historical backfill: deliveries that ran before this change remain telemetry-absent, which is the classified outcome (AC-F7-1).
- Test seeding uses committed real-shape stream fixtures and fixture-seeded local stores; no live harness stores, credentials, or network (NFR-6).

## 20. PRIVACY / COMPLIANCE REVIEW

- Telemetry records and every rendered report carry aggregate counts, identity references (ticket, repository, lane, agent role, model, run, session), and time windows only — never prompt text, message bodies, transcripts, diffs, tool output, or credential material (NFR-7).
- Agent/lane identity is claimed attribution under the declared single-user trust model: recorded as claimed, never proven, and never an authorization input.
- All telemetry stays local; the change adds no network export, no background process, and no new retention regime beyond the state-layer convention.
- The delivered redaction chokepoint composes unchanged on every new render path.

## 21. SECURITY REVIEW HIGHLIGHTS

- Stream ingest is read-only consumption over the delivered streaming seam: it adds no process primitive, no spawn/kill capability, and no environment-variable handling; the deny-by-default execution environment composes unchanged.
- No credentials are resolved, stored, or rendered by any ingest or read path.
- Every invocation lands its delivered command-audit record; the audit chain's tamper-evidence semantics are unchanged.
- Storage writes go through the delivered fenced, verified append discipline; malformed or unknown records classify as state errors rather than being admitted or silently dropped.
- Brand neutrality: telemetry schema names and user-facing surfaces follow the brand-neutral delivery naming pattern; no hardcoded product or binary names in tooling code.

## 22. MAINTENANCE & OPERATIONS IMPACT

- The telemetry storage schema version is a maintained contract: future bumps follow the re-read migration rule, and format-drift handling (fixtures plus warnings) is the standing response to harness evolution (RSK-1).
- Telemetry storage grows linearly with captured steps; operators can expect per-delivery growth proportional to session activity, with retention following the state-layer convention (NFR-8).
- Downstream consumers must read the declared tolerance from the disclosure rather than re-deriving or assuming it; the reconciliation verdict is the honesty anchor for all spend claims.
- Sparse-cost datasets are expected (RSK-7): token breakdowns remain the complete signal; cost sparsity is disclosed, not repaired.
- The stale planning-page ownership line is reconciled in the documentation phase; later editors of the milestone pack should treat backlog M2-S14 as canonical for spend v2 ownership (DEC-1).

## 23. GLOSSARY

| Term | Definition |
|------|------------|
| Telemetry v2 | Per-step token, cost, and timing telemetry ingested from the opencode v2.x.y harness stream and attributed to the five dimensions |
| Step frame | One unit of the harness JSONL stream carrying a step's token/cost facts and completion evidence |
| Attribution dimension | One of ticket, repository, lane, agent role, model — the breakdown axes every summary carries |
| Command-audit identity | The claimed calling-agent identity (agent role and lane) recorded by the delivered audit ledger, set at spawn from the adapter |
| Session economics | The delivered restart/exhaustion/stall record substrate under the per-delivery economics store key, consumed for identity and timing |
| Phase timing summary | Per-phase start, end, and duration derived from the delivered phase-transition history |
| Reconciliation | The cross-check of observed totals against harness-reported session totals within a declared tolerance, stated with every summary |
| Declared tolerance | The stated bound (default ≤2%, adopted here) within which observed totals must fall for verdict `within` |
| Telemetry state | The disclosure declaring `present` or the classified absence kind; absence is never a zero report |
| Classified absence | The delivered `spend.telemetry-absent` outcome at exit 1 for a selection with no telemetry |
| Re-read migration | The storage rule that a schema-version bump migrates by re-reading the versioned source rather than mutating stored events in place |
| Reading basis | Which capture plane a report's figures come from (stream ingest, closeout capture, or their declared combination), named in the disclosure |

## 24. APPENDICES

### Appendix A — Source traceability

| Source | Content used |
|--------|--------------|
| Ticket GH-291 (milestone M2) | Goal, tasks, AC, dependencies (M1-S11, M1-S15, M1-S19, M1-S22 — all delivered, M1 complete 23/23) |
| Backlog M2-S14 (canonical M2 scope) | Story goal, tasks, AC, dependency list |
| Milestone pack `telemetry.v1` contract | Attribution fields, counting, reconciliation tolerance (default ≤2%), absence, storage rules |
| Milestone pack `spend(1)` v2 proposal | Breakdown selection, envelope disclosures, error identities, exit semantics |
| Milestone pack test scenarios SC-M2-S14-01/02 | The two pinned acceptance scenarios |
| PM pm-notes decision | DEC-1 scope boundary (S14 owns the spend read-side extension; M2-S6 owns alarms/metrics) |
| System specs (current truth) | `feature-spend.md`, `feature-harness-adapters.md`, `feature-session-lifecycle-economics.md`, `feature-closeout.md`, `feature-retro-pipeline.md`, `feature-brief.md` |

### Appendix B — Pinned scenarios (verbatim intent)

- **SC-M2-S14-01** (Telemetry reconciliation within tolerance): Given a completed delivery with harness-reported session totals, when `spend --ref` runs, then its token and cost totals reconcile with the session totals within the declared tolerance, and the reconciliation line states the tolerance. Assert: `data.reconciliation.verdict == "within"` and `data.reconciliation.tolerance` is at most `0.02`.
- **SC-M2-S14-02** (Telemetry absence remains a classified outcome): Given a delivery with no telemetry records, when `spend --ref` runs, then it reports telemetry absence as a classified outcome with exit 1, and it does not print a zero-valued report. Assert: exit code is 1 with `error.code == "spend.telemetry-absent"` and no zero-valued report.

### Appendix C — Declared consumers of this telemetry

| Consumer | Use |
|----------|-----|
| M2-S6 Metrics and spend | Alarm/metric layers: ceremony share, cycle time, burn-rate alarms on per-agent/per-model facts |
| M2-S10 Retro action registry | Evidence inputs for retro levels and follow-through |
| M2-S17 Provider peak pausing | Zero-spend assertion on parked profiles (distinguishes zero from absent) |
| Change-level retro evidence pass | Cites per-role/model numbers, timing, and the reconciliation verdict |
| Morning brief | Owner-facing citation with the reconciliation disclosure |
| Status digest section 8 | Same-fold projection parity with the command |

## 25. DOCUMENT HISTORY

| Version | Date | Author | Changes |
|---------|------|--------|---------|
| 1.0 | 2026-11-12 | @spec-writer | Initial specification for GH-291 (M2-S14 Harness telemetry v2) from ticket, backlog, milestone pack, pm-notes decisions, and current-truth system specs |

---

## AUTHORING GUIDELINES

- Sources: ticket GH-291 body; backlog M2-S14 (canonical M2 scope); milestone pack m2/ (`contracts.md` §telemetry.v1 and §spend v2, `commands/spend.md`, `test-scenarios.md` SC-M2-S14-01/02, `README.md`); pm-notes (clarify_scope decisions); current-truth system specs (feature-spend, feature-harness-adapters, feature-session-lifecycle-economics, feature-closeout, feature-retro-pipeline, feature-brief).
- The reconciliation tolerance adopts the contract default (≤2%) per DEC-2; the contract's instruction to adopt or justify is satisfied by adoption with the pinned scenario as evidence.
- Contradictions found during the current-truth cross-check are recorded, not silently resolved: the v1 cost-omission rule vs the ticket's cost AC (Section 8.5), the brief's absent spend surface vs the citation AC (Sections 2.1, 8.5), the closeout capture-point boundary vs stream ingest (Sections 2.1, 7.2), and the milestone-pack ownership line vs the backlog (DEC-1, with a doc-syncer note). Unresolved questions are confined to Section 14 (OQ-1..OQ-3); no requirement is invented beyond the named sources.
- The spec is deliberately tech-neutral: storage mechanics, exact schema ids, envelope key naming, and render layouts are plan-level refinements against the pinned scenarios and are flagged where a pinned field (`data.reconciliation.verdict`, `data.reconciliation.tolerance`, `error.code == "spend.telemetry-absent"`) already constrains them.
- No git operations are performed by this document's authoring; the orchestrator owns branch state and commits.

## VALIDATION CHECKLIST

- [x] `change.ref` matches provided `workItemRef` (GH-291)
- [x] `owners` has at least one entry
- [x] `status` is "Proposed"
- [x] All sections present in order (1–25 + guidelines + checklist)
- [x] ID prefixes consistent and unique (F-, DM-, NFR-, RSK-, OQ-, DEC-, AC-, G-, NG-)
- [x] Acceptance criteria reference at least one F-/DM-/NFR- ID and use Given/When/Then
- [x] Both pinned scenarios (SC-M2-S14-01, SC-M2-S14-02) appear verbatim in intent as binding ACs
- [x] NFRs include measurable values
- [x] Risks include Impact & Probability
- [x] Out-of-scope items start with `[OUT]`
- [x] No implementation details (no code file paths, no step-by-step tasks)
- [x] Front matter validates per front_matter_rules
