---
change:
  ref: GH-236
  type: feat
  status: Proposed
  slug: spend-read-side
  title: "M1-S19: Spend read side and resume amplification"
  owners: [engineering]
  service: delivery-os learning plane (spend read side)
  labels: [m1, spend, learning-plane, state-layer, cli, status-digest]
  version_impact: minor
  audience: internal
  security_impact: low
  risk_level: medium
  dependencies:
    internal:
      - state layer — harness.telemetry session-group and capture-outcome records, verified reads (GH-233 / M1-S11)
      - harness adapters — neutral telemetry record vocabulary and closed warning reasons (GH-233)
      - delivery registry — phase.transition records with timestamps (pm-notes lint and phase transitions)
      - closeout transaction — capture point provenance (read-only dependency; no capture changes)
      - result contract and error table — CommandResult envelope, machine error table, exit projection (GH-172)
      - status digest — section 8 spend placeholder flip (GH-228 / GH-243 lineage)
      - command audit ledger — invocation audit via the injected seam (GH-223)
      - branding seam — binary name resolution and forbidden-literal registry
    external: []
links:
  issue: https://github.com/juliusz-cwiakalski/agentic-delivery-os/issues/236
  related_changes: ["GH-233", "GH-172", "GH-174", "GH-183", "GH-223", "GH-228", "GH-243", "GH-232"]
  related_decisions: ["ADR-0003", "ODR-0003", "TDR-0004", "TDR-0005"]
---

# CHANGE SPECIFICATION

> **PURPOSE**: Deliver the `spend` v0 read side — per-ticket, per-phase, and per-agent/model token spend, per-delivery restart counts, and the resume-amplification metric — computed only from the closeout-captured event log, so the operator's waste classes are findable from the spend report alone, and flip the status digest's spend placeholder to a real section.

## 1. SUMMARY

This change adds the Learn-family `spend` command (`<binary> spend [--ref <ref>] [--phase <phase>] [--amplification] [--json]`): a deterministic, read-only fold over the `harness.telemetry` session-group and capture-outcome records that closeout already appends to the state ledger. It reports tokens by the five delivered token classes, calls, per-agent/model roll-ups, per-phase attribution derived from `phase.transition` windows, per-delivery restart counts, and the resume-amplification metric (tokens paid versus unique progress, approximately 1 for healthy deliveries) with amplification events flagged by name. Telemetry-absent is a first-class classified outcome (`spend.telemetry-absent`, exit 1), which is the common real-world case until GH-240 (M1-S12) wires the production capture composer. The status digest's section 8 `spend` placeholder ("spend summary arrives with M1-S19") is removed by its delivering story — this one — and replaced by a real section fed by the same read-side fold; the brief is untouched. Alarms, burn rates, and quota snapshots stay in M2-S6.

## 2. CONTEXT

### 2.1 Current State Snapshot

- **Source data exists.** The closeout apply path (non-gating, apply-mode only) captures harness telemetry into the state ledger: one `harness.telemetry` session-group record per captured (session, agent, model) group under the store-scoped key prefix `harness.telemetry:<workItemRef>` with payload schema `delivery.harness.telemetry.v1`, and one run-scoped capture-outcome record per delivery run with payload schema `delivery.harness.telemetry.capture.v1` under `harness-telemetry-capture:<workItemRef>:<runId>`. Records carry numeric statistics and identity references only: the five token classes (`input`, `output`, `reasoning`, `cacheRead`, `cacheWrite`), call counts, bounded per-tool counts, agent and model identity, tree root, parent chain, work-item ref, run id, session id, harness kind/version, a cost that is null (never zero) when missing, the captured-at timestamp, and warnings from a closed reason set. Session-group capture is idempotent by (work item, run, session, agent, model); capture outcomes by (work item, run). No production composer injects the capture capability yet (GH-240, M1-S12 wires it), so no real closeout run has captured harness telemetry records to date.
- **Phase truth exists in the same ledger.** The delivery registry appends `phase.transition` records per change carrying phase id, operation (`complete` | `reopen`), timestamp, outcome, reopen-only reason, and commit intent — timestamped phase boundaries over the same store.
- **No read side exists.** No command reports per-ticket or per-phase token spend, per-agent/model roll-ups, restart counts, or any paid-versus-progress measure. The state layer ships verified reads but no spend consumer.
- **The digest names the gap.** Status digest section 8 `spend` is a named `not-delivered` placeholder with the pinned human line "spend summary arrives with M1-S19"; it is removed only by its delivering story. The digest's `placeholderSectionCount` is pinned at exactly 2 (`spend` and `blockers`). The brief deliberately carries no spend surface (its placeholder catalog contains no spend entry; the digest's spend section is not a brief surface).
- **Precedent.** The delivered `retro` command (GH-232) — same Learn family — establishes the command shape quality bar: locked grammar, envelope reuse, human digest plus machine JSON, bounded output, classified outcomes, every exit code mapped to a real error-table projection class.

### 2.2 Pain Points / Gaps

- Delivery spend is invisible: two of the operator's top three waste classes are findable only in a spend breakdown, and no such breakdown can be produced today.
- Resume amplification (paid-versus-progress waste) is unmeasurable: a restart loop re-paying prefill across runs leaves no readable signal.
- The status digest prints a placeholder where spend evidence should stand, and the `placeholderSectionCount` invariant pins that gap open until this story lands.
- Until GH-240 wires capture, every real store is telemetry-absent; a read side that treats absence as an edge case (or as a silent zero) would be wrong in every real invocation.

## 3. PROBLEM STATEMENT

Because the closeout-captured harness telemetry in the state event log has no read-side consumer, the operator cannot see per-ticket, per-phase, or per-agent token spend, restart counts, or the resume-amplification metric from the tooling, so waste classes (restart-loop re-payment and re-run spend) stay invisible until they are manually reconstructed from harness stores, and the status digest holds a placeholder instead of spend evidence.

## 4. GOALS

- **G-1**: A `spend` v0 read side that reports per-ticket and per-phase tokens by class, calls, and per-agent/model roll-ups from the closeout-captured event log alone — never by re-querying harness stores.
- **G-2**: The resume-amplification metric — tokens paid versus unique progress — reading approximately 1 for a healthy delivery and flagging amplification events by name, with an exact, deterministic formula and an honestly scoped flagging contract (what the log can and cannot prove).
- **G-3**: Per-delivery restart counts derived from delivery-run identities present in the log.
- **G-4**: Telemetry-absent as the first-class classified outcome (named, exit 1) — never an empty success, a zero report, or an unclassified error.
- **G-5**: The status digest spend gap flipped by its delivering story: the placeholder removed, a real section fed by the same read-side fold, and the digest's pinned consistency invariants updated in the same change.
- **G-6**: Full contract discipline: one new error-table row, envelope and mode-aware rendering reuse, bounded deterministic output, zero writes, zero capture-path changes.

### 4.1 Success Metrics / KPIs

| Metric | Target |
|--------|--------|
| Waste-class answerability | 100% of the ticket's two waste questions (restart re-payment; restart counts) answerable from one `spend` invocation per ref, from the log alone |
| Binding AC pass rate | 100% of binding ticket ACs pass on fixture-seeded state stores |
| Determinism | 100% byte-identical repeat renders for identical store content and injected clock/run-id |
| Bounded output | 100% of renders within the NFR-1 bounds with deterministic truncation markers |
| Absence classification | 100% of telemetry-absent invocations return the classified named outcome, never silent zeros |
| Harness re-query | 0 harness store reads on any invocation path |

### 4.2 Non-Goals

- **NG-1**: Alarms, burn rates, and quota snapshots (M2-S6; explicitly deferred by the ticket's pinned decisions).
- **NG-2**: Re-querying harness stores on any path (ticket-pinned).
- **NG-3**: Any capture or extraction change: no composer wiring (GH-240, M1-S12), no record shape change, no new capture points.
- **NG-4**: Retro — its pipeline consumes its own evidence plane and is untouched here.
- **NG-5**: MCP surface for spend (no tool projection in this change).
- **NG-6**: Daemon or lane integration (lane status exposing restart/amplification signals belongs to the lane-economics story M1-S16).
- **NG-7**: Currency or cost aggregation: token counts only; record cost stays null-when-missing and is not summed in v0.
- **NG-8**: Brief changes: the delivered brief deliberately carries no spend surface and keeps it.
- **NG-9**: Semantic-duplication proof: the amplification metric measures run duplication from log arithmetic, never content-level re-reading.

## 5. FUNCTIONAL CAPABILITIES

| ID | Capability | Rationale |
|----|------------|-----------|
| F-1 | Per-ticket spend breakdown | Makes total delivery spend visible per change from the log alone |
| F-2 | Log-only read contract with first-class telemetry-absent | Ticket-pinned source binding; absence is the common real-world case and must classify |
| F-3 | Per-phase attribution with named fallback | Phase-level waste localization from transition windows already in the ledger |
| F-4 | Per-agent/model roll-up and restart counts | Attributes spend to agents/models and surfaces delivery restart volume |
| F-5 | Resume-amplification metric and named events | The paid-versus-progress waste signal, flagged by name per the ticket |
| F-6 | Command surface, output contract, and bounds | Locked grammar, human digest plus machine JSON, bounded deterministic render |
| F-7 | Error identity and exit projection | One new classified row; every exit maps to a real projection class |
| F-8 | Status digest spend-section flip | The placeholder is removed only by its delivering story — this change |

### 5.1 Capability Details

- **F-1 Per-ticket spend breakdown**: For the selected ref, the report sums every captured session-group record into `tokensByClass` over the five delivered token classes (non-negative integers), reports total calls, and discloses degraded data in a `degradation` block: the number of records with any null-when-missing token class, truncation warning, or other closed-vocabulary warning, counted by reason. A record's null token class is excluded from sums and never fabricated to zero. Cost is not aggregated (NG-7).
- **F-2 Log-only read contract**: Every figure derives from verified state-ledger reads of the two `harness.telemetry` record families for the ref. The command never opens a harness store, reads a session database, or queries a provider. Reads are presence-tolerant: an absent store or an absent per-ref record is explicit verified-empty evidence → the classified telemetry-absent outcome; a torn, schema-mismatched, unknown-kind, or permission-denied read classifies through the delivered `state.*` identities and is never served as a zero or empty report.
- **F-3 Per-phase attribution**: Telemetry records carry no phase field; attribution is derived, not captured. The command folds the ref's `phase.transition` history into ordered phase windows and assigns each captured record to the window containing its captured-at stamp under the pinned capture-time attribution rule (DM-2), including the terminal-attribution rule for records captured after the final transition (the normal closeout position) and the named `unknown` fallback when the ref has no transitions. A `--phase` filter restricts the report to one phase's attribution window.
- **F-4 Agents and restarts**: `perAgent[]` roll-ups group captured records by (agent, model) with calls and total tokens. `restarts` counts delivery-run duplication: the union of run identities across session-group records and capture-outcome records, minus one, floored at zero (DM-4). The count's evidence basis (runs that reached closeout capture) is disclosed in the flagging contract, never silently overstated.
- **F-5 Resume amplification**: `amplification.ratio` = paid tokens ÷ unique-progress tokens under the pinned v0 formula (DM-3): paid is the five-class token sum over all captured records for the ref; the progress run is the latest record-bearing captured run; each earlier record-bearing run with positive spend flags one named event (`restart-loop prefill re-pay`) carrying its window and `tokensWasted`. A healthy single-run delivery reads exactly 1. A zero-token progress run reports `ratio: null` and names the progress run machine-readably in the additive field `amplification.progressRun` (null when progress > 0; DEC-11). The flagging contract states the metric's honesty limits in the report's own terms: run duplication is proven, semantic duplication is not; runs that never reached closeout capture are invisible.
- **F-6 Command surface and output**: Grammar is exactly `<binary> spend [--ref <ref>] [--phase <phase>] [--amplification] [--json]`. Success renders the standard CommandResult envelope carrying `data` under schema id `delivery.spend.v1` with exactly the pinned keys, plus a deterministic bounded human digest; `--amplification` adds the amplification section (ratio and named events) to the human digest — the machine envelope always carries the amplification data; `--json` forces the envelope; interactive/scripted rendering follows the delivered result contract unchanged.
- **F-7 Error identity and exits**: One new `spend` domain kind with exactly one row, `spend.telemetry-absent` (user, non-retryable, `not_landed`, user-validation → exit 1). All other failures keep their delivered rows and projections unchanged (state.store.torn → exit 2; state.permission.denied keeps its documented user-validation exit 1); machine consumers branch on the error code, never the exit code alone.
- **F-8 Status digest flip**: Digest section 8 `spend` becomes a real section fed by the same read-side fold: captured telemetry → `observed` with token-class totals, restarts, and amplification ratio; verified-empty telemetry → `observed` with zero counts and a human line naming absence of capture (never a zero-spend claim); failed store read → digest data with the state failure code (`state-unreadable`), never a command failure. The placeholder line "spend summary arrives with M1-S19" is removed everywhere; `placeholderSectionCount` becomes exactly 1 (`blockers`); one additive evidence source id (`state-log`) joins the digest's closed source set.

## 6. USER & SYSTEM FLOWS

```
Flow 1: Spend report (spend [--ref <ref>] [--phase <phase>] [--json])
  Operator (or a later consumer) runs spend
    → grammar validated: ref shape and phase vocabulary checked before any read
      (violation → input.value.rejected, exit 1)
    → ref resolved: explicit --ref, or the active change ref from the local
      delivery context (no resolvable ref → input.value.rejected naming the
      missing context, exit 1)
    → verified log reads: harness.telemetry session-group records +
      capture-outcome records + phase.transition history for the ref
        (telemetry verified-empty → spend.telemetry-absent, exit 1,
         summary names the selection — the common case until GH-240)
        (store torn/schema/unknown → delivered state identities, exit 2)
    → pure deterministic fold: tokensByClass, perPhase[], perAgent[],
      restarts, amplification, degradation
    → bounded human digest + envelope (delivery.spend.v1) rendered
      per the injected mode; exit 0

Flow 2: Amplification report (spend --ref <ref> --amplification)
  Same read and fold
    → ratio computed; each superseded record-bearing run with positive
      spend flags one named event (cause, window, tokensWasted)
    → healthy single-run delivery: ratio 1, events []
    → zero-token progress run: ratio null; `progressRun` names the run
      machine-readably (null when progress > 0)
    → restart loop: ratio > 1 with events sorted deterministically;
      human digest names each event with its window and wasted tokens

Flow 3: Telemetry-absent (the default real-world case pre-GH-240)
  spend --ref <ref> over a store with no captured telemetry for the ref
    → presence-tolerant read returns explicit verified-empty evidence
    → classified spend.telemetry-absent (exit 1): named, remediation hints
      at capture prerequisites — never an empty success, never zeros

Flow 4: Status digest flip
  status renders section 8 from the same read-side fold
    → telemetry present → observed: spend summary lines replace the placeholder
    → verified-empty → observed, zero counts, human line names absence of
      capture (never a zero-spend claim)
    → store read failure → digest data with state-unreadable reason and the
      state failure code; the digest still renders all nine sections, exit 0
    → placeholderSectionCount = 1 (blockers); "spend summary arrives with
      M1-S19" renders nowhere
```

## 7. SCOPE & BOUNDARIES

### 7.1 In Scope

- The `spend` command v0 read side over the closeout-captured event log: per-ticket and per-phase tokens by class, calls, per-agent/model roll-ups, per-delivery restart counts, text digest plus JSON.
- The resume-amplification metric: exact v0 formula, unique-progress denominator, event detection and naming (`restart-loop prefill re-pay` with window and tokensWasted), and the honest flagging contract.
- Per-phase attribution from `phase.transition` windows applied to captured-at stamps, with the named `unknown` fallback.
- The new `spend` error identity and the exit taxonomy binding (0 reported / 1 telemetry-absent / 2 event log unreachable via delivered state projections).
- The status digest section 8 flip: placeholder removal, real section, `placeholderSectionCount` invariant update, additive `state-log` evidence source.
- Bounded, deterministic output discipline consistent with sibling commands.

### 7.2 Out of Scope

- [OUT] Alarms, burn rates, and quota snapshots (M2-S6).
- [OUT] Harness re-query on any invocation path (ticket-pinned).
- [OUT] Capture or extraction changes: composer wiring (GH-240, M1-S12), record shapes, capture points, retention.
- [OUT] Retro (its evidence plane and command family are untouched).
- [OUT] MCP surface projection of spend.
- [OUT] Daemon or lane-status integration of restart/amplification signals (M1-S16).
- [OUT] Currency/cost aggregation and any cost model (record cost stays null-when-missing, unsummed).
- [OUT] Brief payload or surface changes (delivered brief deliberately excludes spend).
- [OUT] Semantic-duplication analysis of session content (never readable from this log; NG-9).

### 7.3 Deferred / Maybe-Later

- Finer per-phase attribution from session activity windows, if a future capture-side enrichment carries them (M2 evaluation alongside alarms).
- Cost-aware spend weighting once cost figures are reliably captured (M2-S6 family).
- Additional amplification event causes beyond the v0 closed single-cause vocabulary, as restart/resume economics (M1-S16) land richer signals.
- All-refs aggregate reports (v0 is per-ref selection only).

## 8. INTERFACES & INTEGRATION CONTRACTS

### 8.1 REST / HTTP Endpoints

N/A — the change adds a CLI command surface only; no HTTP endpoints.

### 8.2 Events / Messages

N/A — no new events or messages are produced. The command is a pure read-side consumer of two existing additive record families (`delivery.harness.telemetry.v1` session-group records; `delivery.harness.telemetry.capture.v1` capture-outcome records) plus `phase.transition` history. No record kind, payload schema, key prefix, or append path changes.

### 8.3 Data Model Impact

| ID | Element | Description |
|----|---------|-------------|
| DM-1 | Spend report data shape (`delivery.spend.v1`) | Envelope `data` carries exactly: `tokensByClass` (the five closed token classes, non-negative integers), `perPhase[]` (`phase`, `calls`, `tokens`, integer-percentage `share`), `perAgent[]` (`agent`, `model`, `calls`, `tokens`), `restarts` (integer ≥ 0), `amplification` (`ratio` number-or-null, `progressRun` run-id-or-null, `events[]`), `degradation` (`records` count with warnings, `byReason` counts over the closed harness warning vocabulary). Inside the standard CommandResult envelope; the envelope itself stays `delivery.result.v1` |
| DM-2 | Per-phase attribution basis | Ordered phase windows folded from the ref's `phase.transition` history: a phase's window closes at its `complete` timestamp and reopens at its `reopen`; a record's captured-at stamp selects the containing window; records captured after the final transition attribute to the final transitioned phase (terminal attribution — the normal closeout position); records preceding the first transition attribute to the first transitioned phase; no transitions → all spend in the single named `unknown` window |
| DM-3 | Amplification definition (v0) | `paid` = five-class token sum over all captured records for the ref; `progress` = token sum of the latest record-bearing captured run (captured-at descending, run-id ascending tie-break); `ratio` = paid ÷ progress; a zero-token progress run — whether paid > 0 or paid = 0 with every captured token class null (disclosed via `degradation`) — reports `ratio: null` and names the progress run machine-readably via the additive field `amplification.progressRun`, null when progress > 0 (a success envelope always carries at least one record — the no-records case is the classified telemetry-absent outcome); one event per earlier record-bearing run with positive spend: `cause` `restart-loop prefill re-pay`, `window` `[previous record-bearing run's captured-at ‖ earliest transition timestamp ‖ point] → this run's captured-at`, `tokensWasted` = that run's spend; events sorted by window start then run id; the cause vocabulary is closed with exactly this one v0 cause |
| DM-4 | Restart count definition | `restarts` = max(0, N − 1) where N is the size of the union of run identities across session-group records and capture-outcome records for the ref; counts only runs that reached closeout capture — disclosed limitation, never silently overstated |
| DM-5 | Error-table delta | New domain kind `spend` in the domain-kind vocabulary with exactly one row: `spend.telemetry-absent` — category user, retryable false, consequence `not_landed`, remediation pointing at capture prerequisites, projection `user-validation` → exit 1; all other outcomes resolve through delivered rows unchanged; machine-readable and documented tables agree bidirectionally |
| DM-6 | Status digest delta | Section 8 `spend`: real section with state, counts, evidence (source id `state-log`; outcomes `read`/`observed-empty`/`failed`), bounded spend summary (token-class totals, restarts, amplification ratio); the pinned placeholder line is removed; `placeholderSectionCount` is exactly 1; the derivation-matrix row for spend changes from always-`not-delivered` to the observed mapping; all other sections, the brief, and the surface catalogs are unchanged |

### 8.4 External Integrations

N/A — no provider, tracker, or harness integration is touched. Reads are local state-store reads; the command never resolves credentials and never performs network I/O.

### 8.5 Backward Compatibility

- **Additive command**: `spend` is a new top-level command; no existing command changes behavior.
- **Digest output change (intentional, pinned-contract flip)**: the `spend` section changes from a `not-delivered` placeholder to a real section; the pinned human line is removed and `placeholderSectionCount` changes from exactly 2 to exactly 1. Machine consumers keying on the placeholder must move to the real section; this is the delivering-story flip the digest contract names, delivered in one change so the pinned invariants never contradict the output.
- **No state change**: no schema-version bump, no migration, no derived projection, no new record kind.
- **Envelope unchanged**: the CommandResult contract, mode-aware rendering, and redaction chokepoint are consumed unchanged.

## 9. NON-FUNCTIONAL REQUIREMENTS (NFRs)

| ID | Requirement | Threshold |
|----|-------------|-----------|
| NFR-1 | Bounded output, sibling-consistent | Machine payload ≤ 64 KiB; human digest ≤ 200 lines and ≤ 16 KiB; every bound measured in UTF-8 bytes; deterministic truncation dropping trailing `perAgent[]`/`perPhase[]` entries first with a recorded truncation marker |
| NFR-2 | Deterministic render path | Byte-identical output for identical store content, injected clock, and injected run-id; zero model calls anywhere in the render path; ordering keys deterministic (captured-at, then run id, then agent/model) |
| NFR-3 | Read-only and log-only | Zero state writes, zero fence acquisitions, zero harness-store reads on every invocation path; all reads verified; a malformed or wrong-kind record under the telemetry prefixes classifies through the delivered `state.*` identities, never a zeroed sum |
| NFR-4 | In-process fold latency | p95 ≤ 500 ms at 1,000 captured records and ≤ 2 s at 10,000 records, no network I/O involved |
| NFR-5 | Privacy of output | Statistics and identity references only: no prompt text, message bodies, transcripts, diffs, tool output, or credential material in any human or machine output; aggregate counts, refs, phase ids, agent/model names, run ids, and windows only |
| NFR-6 | Contract sync invariants | The machine error table and documented error table agree on the `spend` row bidirectionally (existing sync invariant extended); no exit-code literals outside the CLI projection module |
| NFR-7 | Offline evidence model | Every reporting path proven on fixture-seeded state stores; zero network, zero live harness stores, zero live credentials across the whole evidence set |

## 10. TELEMETRY & OBSERVABILITY REQUIREMENTS

- The command is itself the observability surface for spend; it adds no new telemetry of its own.
- Invocation auditing composes the existing command-audit seam unchanged: when the seam is injected, every `spend` invocation lands its reservation and invocation record like any other command; an audit-write failure is a classified diagnostic and never changes the outcome or exit code.
- Failures are observable through the classified error identity (`spend.telemetry-absent`) and delivered `state.*` identities in the envelope — no prose-only diagnostics.

## 11. RISKS & MITIGATIONS

| ID | Risk | Impact | Probability | Mitigation | Residual Risk |
|----|------|--------|-------------|------------|---------------|
| RSK-1 | The amplification ratio is over-interpreted as proof of semantic work duplication | M | M | The flagging contract states the metric's honesty limits in the report's own terms (run duplication proven; content-level re-reading not); the cause name carries the mechanism; docs repeat the scope | L — a reader skips the contract and over-interprets |
| RSK-2 | Per-phase attribution coarseness: a run's whole spend lands on its final transitioned phase, misguiding phase-level optimization | M | H | The attribution basis is named (capture-time windows; terminal attribution rule); the `unknown` fallback is explicit; finer attribution is a declared maybe-later pending capture-side windows | M — shares misread as phase effort until refined |
| RSK-3 | Restart counts undercount: runs aborted before closeout leave no capture outcome and are invisible | M | M | The evidence basis is disclosed in the flagging contract; the lane-economics story (M1-S16) later enriches restart evidence from its own budget machinery | M — accepted v0 limitation, visible by contract |
| RSK-4 | The digest flip breaks pinned status invariants (`placeholderSectionCount`, derivation matrix, corpus cases, golden digests) | M | M | All pinned invariants and fixtures are updated in the same change; the digest's completeness meta-check and golden-byte tests assert the new counts; review compares against the digest contract | L |
| RSK-5 | Telemetry-absent dominance until GH-240 hides real-spend defects from manual use | M | H | Absence is the first-class classified outcome; every reporting path is proven on fixture-seeded stores; binding ACs are exercised on fixtures, not on live captures | L |
| RSK-6 | Drift between the proposed man page (planning input) and the pinned contract (five classes, `degradation` block, share semantics, `--amplification` human-section scope) | L | M | This spec is canonical; the man-page pack is reconciled to the pinned contract during system-spec update, and the delta is enumerated in Appendix B | L |
| RSK-7 | `spend.telemetry-absent` confusion with other exit-1 outcomes (permission-denied, input rejections) | L | L | The envelope error code is the identity; the summary names the selection; consumers branch on codes per the delivered result contract | L |

## 12. ASSUMPTIONS

- Fixture-seeded state stores legitimately prove the reporting paths; real captured telemetry does not exist until GH-240 wires the production capture composer, and this change adds no capture wiring.
- Run ordering derives from captured-at timestamps with a deterministic run-id tie-break; no run-id format property (such as time-sortability) is assumed.
- The canonical delivery phase vocabulary (the eleven workflow phase identifiers) is stable for v0 validation of `--phase`.
- The state directory is single-user local; the trust model and least-privilege store contract are unchanged by a read-only consumer.
- The status digest targets the active change context; the spend section reports that same scope (the digest's existing ref resolution is reused, not redefined here).

## 13. DEPENDENCIES

| Direction | Item | Notes |
|-----------|------|-------|
| Depends on | M1-S11 harness adapters (GH-233, delivered) | The `harness.telemetry` record kind, payload schemas, token classes, warning vocabulary, and capture outcomes exist |
| Depends on | State layer (GH-174, delivered) | Verified reads, presence-tolerance, boundary validation, classified `state.*` failures |
| Depends on | Result contract and error table (GH-172, delivered) | Envelope, error table, projection classes, mode-aware rendering, sync invariants |
| Depends on | Delivery registry phase transitions (delivered) | Timestamped `phase.transition` history for per-phase windows |
| Depends on | Status digest contracts (GH-228/GH-243 lineage, delivered) | Section 8 placeholder is removed only by this delivering story |
| Consumed by | M2-S6 | Alarms and burn rates consume the spend read side (M2-S6 depends on M1-S19 per the backlog) |
| Consumed by (later) | M1-S21 | Model-profile routing consumes the amplification signal |
| Blocks | M2-S6 alarm/burn-rate surface | Blocked until the spend read side lands |

## 14. OPEN QUESTIONS

| ID | Question | Context | Status |
|----|----------|---------|--------|
| OQ-1 | Should the amplification metric definition (DEC-3) be authored as a standalone decision record before delivery planning? | The definition is AC-bearing, novel, and later consumed by M1-S21 routing and M2-S6 alarms; the GH-232 precedent (chain construction → TDR-0009) suggests a standalone record keeps the formula inspectable independently of this change's artifacts | Resolved — authored as TDR-0011 (spend resume-amplification v0 formula), whose stability contract pins the amplification block; changes ride a decision-record addendum or supersession (see DEC-11 for the v1.1 additive amendment) |
| OQ-2 | What does an omitted `--ref` resolve to, and how does a ref-less workspace classify? | The design baseline leaves the default unpinned | Resolved — DEC-6: active-context resolution; unresolvable context refuses `input.value.rejected` before any read |
| OQ-3 | Does the digest's closed evidence-source set grow, and with what id? | The spend section reads the state ledger; no existing source id names it | Resolved — DEC-8: one additive source id `state-log` |
| OQ-4 | Is capture-time attribution acceptable as the v0 per-phase basis given its coarseness? | Records carry no phase or session-activity windows; the alternative is no per-phase report at all in v0 | Resolved — DEC-4: capture-time attribution with terminal rule and named fallback; finer basis deferred (§7.3), revisited only if digest/man-page review demands |

## 15. DECISION LOG

| ID | Decision | Rationale | Date |
|----|----------|-----------|------|
| DEC-1 | The read source is exactly the closeout-captured event log (both `harness.telemetry` record families); no harness re-query, no capture-path change | Ticket-pinned binding decision, reaffirmed; absence of capture must classify, not degrade into store probing | 2026-11-07 |
| DEC-2 | Report all five delivered token classes; null token classes are excluded from sums and surfaced in `degradation`; the design example's three-class illustration is non-normative; cost is not aggregated in v0 | The delivered record vocabulary is five classes; reporting fewer would silently drop reasoning/cacheWrite spend; null-when-missing must never be fabricated to zero | 2026-11-07 |
| DEC-3 | Amplification v0 formula: paid = five-class sum over all captured records; progress = the latest record-bearing captured run (captured-at desc, run-id asc tie-break); ratio = paid ÷ progress with the zero-progress null rule; one named event per superseded record-bearing run with positive spend; single-cause closed vocabulary `restart-loop prefill re-pay`; healthy single-run delivery reads exactly 1 | Exactly this formula is derivable from log data with no upstream primitive; the latest run is the productive prefix by construction for a closed change (the binding AC's scope); the honesty limits (run duplication proven, semantic duplication not; pre-closeout runs invisible) are part of the contract | 2026-11-07 |
| DEC-4 | Per-phase attribution is capture-time: transition-timestamp windows applied to captured-at stamps; records after the final transition attribute to the final transitioned phase; no transitions → the named `unknown` window | Deterministic and derivable from delivered primitives; the planning summary's suggested derivation; coarseness is disclosed by contract rather than hidden | 2026-11-07 |
| DEC-5 | Restarts = max(0, N − 1) over the union of run identities across session-group and capture-outcome records | Both record families carry run identity; the union avoids dropping capture-outcome-only runs; the "reached closeout capture" evidence basis is disclosed, never overstated | 2026-11-07 |
| DEC-6 | Omitted `--ref` resolves the active change ref from the local delivery context; unresolvable context, malformed ref shape, or an out-of-vocabulary `--phase` refuse `input.value.rejected` (exit 1) before any store read; ref grammar matches the closeout precedent (canonical uppercase shape, case-sensitive, no folding); a canonical phase whose window holds no records is scoped `spend.telemetry-absent` naming the phase | Grammar validation before reads matches the retro/closeout invocation discipline; one semantic emptiness identity (telemetry-absent, scoped) avoids inventing rows for filter emptiness | 2026-11-07 |
| DEC-7 | One new `spend` domain kind with exactly one row, `spend.telemetry-absent` (user, non-retryable, `not_landed`, user-validation → exit 1); all other failures keep delivered rows unchanged; the exit taxonomy is 0 reported / 1 telemetry-absent (and other delivered user-validation rows) / 2 event-log unreachable (platform-provider state rows) | Bidirectional error-table discipline; no delivered row is altered (the GH-232 lesson: a taxonomy assertion must never claim an exit a delivered row cannot produce) | 2026-11-07 |
| DEC-8 | Digest flip mapping: telemetry present → `observed` with the spend summary; verified-empty → `observed` with zero counts and the absence-of-capture human line (never a zero-spend claim); failed store read → digest data (`unknown` state, `state-unreadable` reason, the state code as `failureCode`), never a command failure; one additive evidence source id `state-log`; `placeholderSectionCount` exactly 1; actionable contribution unchanged (zero) | Verified-empty reads are `observed` by the digest's own delivered rule; the honesty burden moves to the human line, which names absence of capture rather than zero spend; the source vocabulary grows additively through this reviewed change, as its contract allows | 2026-11-07 |
| DEC-9 | Output contract: data schema id `delivery.spend.v1` (doctor/brief/status precedent); the machine envelope always carries the full data key set including `amplification`; `--amplification` controls the human digest's amplification section (ratio and named events); `share` is an integer percentage floored (shares may not sum to 100); bounds per NFR-1 | Keeps the envelope data keys stable for machine consumers regardless of human emphasis flags, matching the proposed man page's unconditional data-key list; integer percentages are deterministic and tie-free | 2026-11-07 |
| DEC-10 | The brief payload is unchanged; no spend surface, placeholder, or anchor is added there | The delivered brief contract deliberately contains no spend entry ("spend is not surfaced", its DEC-5) and its catalog grows only through a reviewed change; the planning note's "brief prints a placeholder spend summary" does not match delivered truth — only the status digest carries the spend placeholder | 2026-11-07 |
| DEC-11 | Amendment (v1.1, resolving test-plan OQ-T2): the amplification block gains one additive nullable field, `progressRun` — the progress run's identity exactly when the progress run contributed zero tokens (the `ratio: null` case, now covering paid > 0 and paid = 0 ∧ progress = 0 with all token classes null); null when progress > 0. Rejected alternative: rewording AC-F5-3 down to human-only run naming — rejected because the machine-mode guarantee is AC-derived and M2-S6 alarms consume run identities machine-readably under TDR-0011's stability contract; the additive field keeps the pinned block shape (`ratio`, `events[]`) intact for consumers | Fills the machine-surface gap AC-F5-3 names without weakening the honesty contract or the binding ACs; the top-level six-key data set is unchanged; TDR-0011 addendum delegated to `@decision-advisor` (the spec does not edit the decision record) | 2026-11-07 |

## 16. AFFECTED COMPONENTS (HIGH-LEVEL)

| Component | Impact |
|-----------|--------|
| CLI command registry and command surface | New — the `spend` command joins the Learn family with the locked grammar |
| Core contracts (spend report contract; error table) | New — the `delivery.spend.v1` data contract and the `spend` domain kind with its one row |
| State layer | Unchanged — a new read-side consumer over existing record families; no schema, projection, or port change |
| Harness adapters and closeout | Unchanged — provenance only; no capture or extraction change |
| Status digest | Updated — section 8 flip, summary counts, derivation matrix, evidence source set, corpus and golden fixtures |
| Command audit seam | Unchanged — composes unchanged when injected |
| Documentation set | Updated/New — new spend feature page in the system spec; man-page pack reconciled to the pinned contract; digest and result-contract spec pages reconciled; glossary/index and the branding forbidden-literal registry updated |

## 17. ACCEPTANCE CRITERIA

Ticket AC traceability: **binding AC 1** — "a closed change reports its spend breakdown from the event log without re-querying harness stores" → AC-F2-1 (with AC-F1-1, AC-F6-2). **binding AC 2** — "the resume-amplification metric reads approximately 1 for a healthy delivery and flags amplification events by name" → AC-F5-1 + AC-F5-2. Both binding ACs appear verbatim and unweakened; all other criteria derive from the ticket tasks, the pinned design baseline, and the decisions above.

### Per-ticket breakdown (F-1, F-4)

| ID | Criterion | Linked |
|----|-----------|--------|
| AC-F1-1 | **Given** a closed change whose store holds captured session-group records for the ref, **when** the report is rendered, **then** `tokensByClass` carries exactly the five delivered token classes as non-negative integers summed across all captured records, `perAgent[]` groups records by (agent, model) with calls and total tokens, and every record-level null token class or closed-vocabulary warning is excluded from sums and counted in `degradation` — never fabricated to zero. | F-1, F-4, DM-1, NFR-5 |
| AC-F1-2 | **Given** records whose cost is null (missing at capture), **when** the report is rendered, **then** no currency or cost figure appears in any output and token counts alone constitute the breakdown. | F-1, DM-1, NG-7 |

### Log-only reads and classified absence (F-2, F-7)

| ID | Criterion | Linked |
|----|-----------|--------|
| AC-F2-1 | **Given** a closed change, **when** spend reports, **then** the spend breakdown is reported from the event log without re-querying harness stores — zero harness-store reads on every invocation path. | F-2, F-1, NFR-3 |
| AC-F2-2 | **Given** a ref with no captured telemetry records (the common real-world case until the capture composer is wired), **when** spend runs, **then** the outcome is the classified `spend.telemetry-absent` (exit 1) with a summary naming the selection (ref, and phase when filtered) and capture-prerequisite remediation — an explicit classified outcome, never an empty success, a zero report, or an unclassified error. | F-2, F-7, DM-5 |
| AC-F2-3 | **Given** a torn, schema-mismatched, unknown-kind, or permission-denied store read, **when** spend runs, **then** the failure classifies through that state identity's own delivered projection (torn/unknown/schema → exit 2; permission-denied keeps its documented user-validation exit 1) with store path and record position only — never a zeroed or partial report served as truth. | F-2, F-7, DM-5, NFR-3 |

### Per-phase attribution (F-3)

| ID | Criterion | Linked |
|----|-----------|--------|
| AC-F3-1 | **Given** a ref whose transition history holds `phase.transition` records, **when** the report is computed, **then** each captured record attributes to exactly one phase window under the capture-time rule, records captured after the final transition attribute to the final transitioned phase, and `perPhase[]` carries phase, calls, tokens, and an integer-percentage share per phase. | F-3, DM-2, DEC-4 |
| AC-F3-2 | **Given** a ref with captured telemetry and no `phase.transition` records, **when** the report is computed, **then** all spend attributes to the single named `unknown` window and the human digest names the attribution fallback. | F-3, DM-2 |
| AC-F3-3 | **Given** a `--phase` value outside the canonical phase vocabulary, **when** spend runs, **then** the invocation refuses `input.value.rejected` (exit 1) before any store read; and **given** a canonical phase whose attribution window holds no records, **when** spend runs, **then** the scoped selection returns `spend.telemetry-absent` naming the phase. | F-3, F-6, DM-5, DEC-6 |

### Restarts and amplification (F-4, F-5)

| ID | Criterion | Linked |
|----|-----------|--------|
| AC-F4-1 | **Given** records from N distinct delivery runs for the ref (union of run identities across session-group and capture-outcome records), **when** the report is computed, **then** `restarts` = N − 1 floored at zero, and the agent/model roll-up spans all runs. | F-4, DM-4, DEC-5 |
| AC-F5-1 | **Given** a healthy delivery with exactly one record-bearing captured run, **when** amplification is computed, **then** the resume-amplification metric reads approximately 1 — exactly 1 by the pinned formula (paid = progress). | F-5, DM-3 |
| AC-F5-2 | **Given** a delivery with superseded record-bearing runs carrying positive spend, **when** amplification is reported, **then** amplification events are flagged by name — each with `cause` `restart-loop prefill re-pay`, its derived window, and `tokensWasted` = that run's spend — one event per superseded record-bearing run, sorted deterministically. | F-5, DM-3 |
| AC-F5-3 | **Given** any reported amplification, **when** a consumer reads the report, **then** the pinned honesty limits hold: ratio = paid ÷ progress with progress the latest record-bearing run's spend; a zero-token progress run — with paid > 0 or paid = 0 — reports `ratio: null` naming the run machine-readably in `amplification.progressRun` (null when progress > 0) and in the human digest; the report proves run duplication only, never semantic duplication; and restarts' capture-reached evidence basis is disclosed. | F-5, DM-1, DM-3, DM-4 |

### Command surface and output (F-6)

| ID | Criterion | Linked |
|----|-----------|--------|
| AC-F6-1 | **Given** the locked grammar `spend [--ref <ref>] [--phase <phase>] [--amplification] [--json]`, **when** invoked, **then** a malformed ref shape or an omitted ref with no resolvable active context refuses `input.value.rejected` before any read, and no flag outside the locked set is accepted. | F-6, DEC-6 |
| AC-F6-2 | **Given** any successful report, **when** rendered, **then** machine output is the standard CommandResult envelope whose `data` carries schema id `delivery.spend.v1` with exactly the pinned keys, `--json` forces the envelope, `--amplification` adds the human amplification section while the envelope always carries `amplification`, and interactive/scripted rendering follows the delivered result contract unchanged. | F-6, DM-1, DEC-9 |
| AC-F6-3 | **Given** identical store content, injected clock, and injected run-id, **when** spend renders twice in either mode, **then** the output is byte-identical, and the render path performs zero model calls. | F-6, NFR-2 |

### Error identity (F-7)

| ID | Criterion | Linked |
|----|-----------|--------|
| AC-F7-1 | **Given** every outcome the command can produce, **when** projected, **then** each exit code maps to a real error-table projection class — 0 success; 1 `spend.telemetry-absent`, `input.value.rejected`, or a delivered user-validation row; 2 delivered platform-provider state rows — and the machine-readable and documented error tables agree on the new row bidirectionally with no exit literals outside the projection module. | F-7, DM-5, NFR-6 |

### Status digest flip (F-8)

| ID | Criterion | Linked |
|----|-----------|--------|
| AC-F8-1 | **Given** a change with captured telemetry, **when** the status digest renders, **then** section 8 `spend` is `observed` carrying token-class totals, restarts, and the amplification ratio, and the pinned line "spend summary arrives with M1-S19" renders nowhere in human or machine output. | F-8, DM-6 |
| AC-F8-2 | **Given** a change whose telemetry read is verified-empty, **when** the digest renders, **then** the spend section is `observed` with zero counts and a human line naming absence of capture (never a zero-spend claim); and **given** a failed store read, **when** the digest renders, **then** the section is digest data with the `state-unreadable` reason and the state failure code — the digest still returns all nine sections and exit 0. | F-8, DM-6, DEC-8 |
| AC-F8-3 | **Given** any rendered digest, **when** summary counts are computed, **then** `placeholderSectionCount` is exactly 1 (blockers), the spend section contributes zero to `actionable`, and the brief payload is unchanged in shape and content rules. | F-8, DM-6, DEC-10 |

## 18. ROLLOUT & CHANGE MANAGEMENT (HIGH-LEVEL)

- Single change delivered on `feat/GH-236/spend-read-side` targeting `main-tools`, one PR containing command, contracts, digest flip, fixtures, and docs — the digest flip lands in the same PR so the pinned `placeholderSectionCount` invariant never contradicts the rendered output.
- No feature flag and no migration: the command is additive and read-only; the digest flip is the delivering-story flip the digest contract requires.
- Evidence model: fixture-seeded state stores prove every reporting path offline (NFR-7); binding ACs are exercised on fixtures.
- Adoption: man-page-grade `--help` with examples (cross-cutting requirement); agent-prompt consumption of spend is M1-S20's concern and is not wired here.
- System-spec update obligations (phase 7): author the new spend feature page in the system spec (with the required distribution marker); reconcile the state-layer consumer list, the result-contract error-table documentation, the status-digest contracts (section table, derivation matrix, placeholder catalog, corpus case list), the glossary/index, and the branding forbidden-literal registry; reconcile the man-page pack to the pinned contract per Appendix B.

## 19. DATA MIGRATION / SEEDING (IF APPLICABLE)

N/A — no state schema change, no migration, no derived projection, no seeding of production data. Test evidence seeds fixture stores with representative `harness.telemetry`, capture-outcome, and `phase.transition` records (including telemetry-absent, multi-run, degraded-record, and no-transition cases).

## 20. PRIVACY / COMPLIANCE REVIEW

- Output carries statistics and identity references only: aggregate token counts, refs, phase ids, agent and model names, run ids, session-derived aggregates, and time windows. It never carries prompt text, message bodies, transcripts, diffs, tool output, credential material, or free-form prose (NFR-5) — preserving the state layer's record-content guarantee at the presentation layer.
- The delivered serialization redaction chokepoint covers spend's human and machine output unchanged.
- No new data retention: the command writes nothing; the audited-invocation record follows the existing audit contract's fields and retention.

## 21. SECURITY REVIEW HIGHLIGHTS

- Read-only surface: zero state writes, zero fence acquisitions, zero harness-store access; least-privilege store reads compose the delivered permission contract.
- No credential resolution and no network I/O on any path.
- Invocation grammar validates ref shape and phase vocabulary before any read, bounding hostile-input surface to the delivered input-value identity.
- No new trust assumption: the single-user local trust model, the store's checksum/verification discipline, and the classification of malformed records as `state.*` failures apply unchanged.
- Output bounds (NFR-1) cap the render surface; truncation is deterministic and disclosed.

## 22. MAINTENANCE & OPERATIONS IMPACT

- New command to keep `--help`, man page, and guides current; the man-page pack is reconciled to the pinned contract at delivery (RSK-6).
- The amplification formula and per-phase attribution are contract surfaces: changes require a reviewed change and a decision-record addendum or supersession (TDR-0011 pins the amplification block, amended additively by DEC-11); M1-S21 and M2-S6 consume them downstream.
- The `degradation` block rides the delivered closed harness warning vocabulary; new warning reasons flow through automatically but any cause-vocabulary growth for amplification events is a deliberate contract change.
- Digest corpus and golden fixtures gain spend-section cases; the completeness meta-check extends with the section.

## 23. GLOSSARY

| Term | Definition |
|------|------------|
| Spend read side | The read-only fold over the closeout-captured event log that produces the spend report; no harness re-query |
| Token class | One of the five delivered classes: `input`, `output`, `reasoning`, `cacheRead`, `cacheWrite` |
| Capture window | The interval ending at a run's telemetry capture (closeout apply) timestamp |
| Phase window | An interval derived from `phase.transition` timestamps within which a record's captured-at stamp selects its phase attribution |
| Capture-time attribution | The v0 basis assigning each record to the phase window containing its captured-at stamp (DM-2) |
| Telemetry-absent | The classified outcome when the log holds no captured telemetry for the selection — first-class, exit 1 |
| Restart (v0) | A distinct delivery run beyond the first, counted over the union of run identities in both telemetry record families |
| Progress run | The latest record-bearing captured run; its spend is the unique-progress denominator (DM-3) |
| Amplification event | A named flag (`restart-loop prefill re-pay`) attributing a superseded run's spend as re-paid, with window and tokensWasted |
| Learn family | The milestone's learning-plane command group (closeout → spend → retro) |
| `state-log` | The additive status-digest evidence source id naming state-ledger-derived sections (DM-6) |

## 24. APPENDICES

### Appendix A — Ticket AC traceability

| Ticket AC (verbatim) | Spec ACs |
|----------------------|----------|
| "a closed change reports its spend breakdown from the event log without re-querying harness stores" | AC-F2-1 (primary), AC-F1-1, AC-F6-2, AC-F2-3 |
| "the resume-amplification metric reads approximately 1 for a healthy delivery and flags amplification events by name" | AC-F5-1 + AC-F5-2 (primary), AC-F5-3 |

Ticket-pinned decisions honored: log-only reads (DEC-1); amplification ≈1 healthy with named events (DEC-3); alarms/burn-rate/quota to M2-S6 (NG-1).

### Appendix B — Pinned deltas from the proposed man page (planning input)

The proposed man page in the M1 pack is the design baseline; this spec pins these refinements, to be reconciled during system-spec update:

1. `tokensByClass` carries all five delivered classes (the example's three are illustrative).
2. `data` additionally carries `degradation` (records-with-warnings count, counts by closed warning reason).
3. `perPhase[]` entries carry `calls`, `tokens`, and integer-percentage `share` alongside `phase`.
4. `perAgent[]` entries carry `agent`, `model`, `calls`, `tokens`.
5. The machine envelope always includes `amplification`; `--amplification` governs the human digest section.
6. Exit taxonomy detail: exit 2 is the platform-provider projection of delivered state rows; exit 1 includes telemetry-absent, input rejections, and any delivered user-validation row (e.g., permission-denied) — machine consumers branch on the error code.
7. Amplification events carry `cause`, `window`, `tokensWasted`; `cause` is the closed single-entry v0 vocabulary.
8. The amplification block carries `progressRun` (run-id-or-null): the progress run's identity exactly when it contributed zero tokens (the `ratio: null` case, covering paid > 0 and paid = 0); null when progress > 0 (amendment v1.1, DEC-11).

### Appendix C — Worked amplification example (contract shape, not test data)

Four record-bearing runs for one ref: run 1 spend 5.0M, run 2 spend 3.0M, run 3 spend 2.0M, run 4 (progress run) spend 1.2M. Paid = 11.2M; progress = 1.2M; ratio ≈ 9.3; restarts = 3; three events named `restart-loop prefill re-pay`, one per superseded run, each with its window (previous run's captured-at → this run's captured-at; earliest transition timestamp for run 1) and its spend as tokensWasted. A single-run delivery reports ratio exactly 1 and an empty events list. A degenerate all-null report — paid = 0, progress = 0, every captured token class null — reports `ratio: null` with `progressRun` carrying the progress run's identity and `degradation` disclosing the all-null records: the null-plus-named-run pair is expressible in the envelope.

## 25. DOCUMENT HISTORY

| Version | Date | Author | Changes |
|---------|------|--------|---------|
| 1.0 | 2026-11-07 | spec-writer (GLM-5.3-Flash) | Initial specification from PM clarify_scope context, ticket GH-236, and delivered system truth (GH-233, GH-172, GH-174, GH-183, GH-223, GH-228, GH-243, GH-232) |
| 1.1 | 2026-11-07 | spec-writer (GLM-5.3-Flash) | Surgical amendment resolving OQ-T2 (reopened from test-plan iteration 1): additive machine surface `amplification.progressRun` names the zero-token progress run machine-readably (null when progress > 0); the zero-progress null rule generalized to paid = 0 ∧ progress = 0 (TP-DEC-1 expressible); recorded as DEC-11 with the rejected human-only alternative; OQ-1 marked resolved (TDR-0011). Both binding ACs remain verbatim and unweakened; the 19-AC inventory is unchanged |

---

## AUTHORING GUIDELINES

- Sources: ticket GH-236 (binding ACs and pinned decisions, kept verbatim), the M1 pack design baseline (spend man page, contracts §spend, man-page/journeys Learn-plane position, backlog M1-S19), and delivered system truth: state layer (telemetry record kinds and verified reads), harness adapters (five-class record vocabulary), closeout (capture point, non-gating, composer absent until GH-240), result contract (envelope, error table, projection), status digest (section 8 placeholder and its delivering-story removal contract), brief (no spend surface), and the retro delivery (GH-232) as command-shape precedent.
- Design resolutions (per-phase attribution, restarts, amplification formula, token classes, telemetry-absent dominance) are pinned here per the PM's delegation; each is deterministic and derivable only from delivered log primitives, with honesty limits stated in the contracts themselves.
- No implementation directives: no code paths, no task breakdowns, no fixture designs beyond behavioral requirements — those belong to the plan and test plan.
- The planning summary's "brief prints a placeholder spend summary" was checked against delivered truth and corrected (DEC-10): the brief deliberately has no spend entry; only the status digest carries the placeholder. No binding AC depends on the brief, so no STOP was warranted.

## VALIDATION CHECKLIST

- [x] `change.ref` matches provided `workItemRef` (GH-236)
- [x] `owners` has at least one entry
- [x] `status` is "Proposed"
- [x] All sections present in order (1-25 + guidelines + checklist)
- [x] ID prefixes consistent and unique (F-, AC-, NFR-, RSK-, DEC-, DM-, OQ-, G-, NG-)
- [x] Acceptance criteria reference at least one F-/DM-/NFR- ID and use Given/When/Then
- [x] NFRs include measurable values
- [x] Risks include Impact & Probability
- [x] No implementation details (no code file paths, no step-by-step tasks)
- [x] No content duplicated verbatim from linked docs
- [x] Front matter validates per front_matter_rules
- [x] Both binding ticket ACs appear verbatim and trace to named spec ACs
- [x] Out-of-scope items prefixed `[OUT]`
