---
change:
  ref: GH-295
  type: feat
  status: Proposed
  slug: supervise
  title: "M2-S2: Supervise (M2)"
  owners: [engineering]
  service: delivery-os supervision plane (operator-facing supervise battery over the resident dispatch daemon's lanes)
  milestone: "M2: Ceremonies, measurement, and memory"
  labels: [change, m2, supervise, daemon, lanes, watchdog, queue, state]
  version_impact: minor
  audience: internal
  security_impact: low
  risk_level: medium
  dependencies:
    internal:
      - "delivered resident dispatch daemon (M1-S18 / GH-238): daemon instance/heartbeat/lane/reconciliation records, heartbeat-age lock staleness and takeover, startup reconciliation with evidence-insufficient holds, the daemon-internal lane supervision cycle, per-ref single-flight with live-holder refusal, safe-boundary preemption, and the production composition's supervise-only mode"
      - "delivered scheduling engine (M1-S1): lanes, leases, and the fenced claim path the battery's actions ride"
      - "delivered watchdog and lane contracts (GH-221 / GH-235 / GH-238): preflight/teardown/liveness probes, the corroboration-bound stall classification, the no-CPU-signal rule, and the signals-absent unknown answer; section 2.2 of that spec explicitly names supervise (M2-S2) as the later consumer of these probes"
      - "delivered queue lifecycle and per-ref single-flight (GH-292): queue park records, the closed park-cause set, condition types and recheck defaults, and the single-flight refusal naming the live holder"
      - "delivered session lifecycle economics (M1-S15): restart budget, resume economics, and the terminal-exhaustion-plus-typed-question path"
      - "delivered coordinator consumption (GH-241): the append-only ledger lease as coordinator single-instance ownership (never the daemon lock), and the process-port/supervisor seams"
      - "delivered state layer (GH-174): additive schema-versioned record kinds, fenced appends, verified reads, classified damage"
      - "delivered result contract and error table (GH-172): the exclusive data/error envelope, the {0,1,2} exit taxonomy, the closed identity union, and the error-table binding check"
      - "delivered lanes surface (GH-237 F-10/F-11): lanes list/show payload with the six-value lane-state set and the parked:<cause> reason template"
      - "delivered configuration layer and branding seam (GH-173 / GH-171): settings acquisition and brand-neutral naming"
    external:
      - "none (offline and state-mediated; no new vendor, API, credential, or network surface)"
links:
  issue: https://github.com/juliusz-cwiakalski/agentic-delivery-os/issues/295
  related_changes: ["GH-238", "GH-237", "GH-221", "GH-235", "GH-292", "GH-241", "GH-294", "GH-174", "GH-172"]
  related_decisions: ["TDR-0025", "TDR-0027", "TDR-0028", "ADR-0003"]
  contracts:
    - "supervision report payload (delivery.supervision.v1): per-repository scope, per-lane tri-state with heartbeat and holder, per-supervisor tri-state, actions, counts, and evidence"
    - "the closed queue park-cause set gains one declared supervised-stall cause (liveness-stall), mapped onto the delivered condition-type whose evaluable shape carries an absolute re-entry instant (the GH-294 many-to-one mapping precedent)"
    - "the parked lane's machine read gains the active park's until as an additive, present-when-active, never-inferred field"
    - "the supervise domain kind joins the closed error-table union with exactly two new identities; no delivered row changes"
---

# CHANGE SPECIFICATION

> **PURPOSE**: Deliver the M2-S2 supervisor battery — an operator-facing `supervise` surface that classifies every lane and every supervision claim in one repository's scope as `progressing`, `stalled`, or `unknown` from durable artifact evidence alone, detects lying liveness (claimed aliveness contradicted by a flat artifact trail), refuses duplicate supervision with the live holder named, parks corroborated stalled lanes through the delivered park machinery with a classified reason and a re-entry instant, and composes restart decisions with the delivered restart economics — so stuck or lying deliveries are detected and acted on, not just observed.

## 1. SUMMARY

This change delivers milestone story M2-S2: the supervisor battery. One invocation of the new operator-facing `supervise` surface folds the durable state-ledger records of one managed repository — daemon instance, heartbeat, and lane records; queue leases and park records; dispatch attempt, phase, and commit-artifact records — into a machine report that names the repository key, carries one tri-state entry per lane (`progressing` / `stalled` / `unknown`, with the lane's last heartbeat and its live lease holder), and carries one tri-state entry per supervision claim (resident daemon instances, coordinator leases). The classification consumes only artifact evidence: durable records and the artifact trail they reference. Process-derived readings — pids, process start times, CPU — are not inputs and cannot reach a verdict, extending the watchdog's no-CPU rule to the supervision plane. A fully corroborated stall is acted on, not just reported: the battery parks the stalled lane through the delivered park machinery with a newly declared supervised-stall cause and a non-null re-entry instant, so the delivered `lanes` surface shows the parked state with the classified reason. Duplicate supervision is refused with the live holder named, composing with the delivered daemon lock, coordinator lease, and per-ref single-flight semantics without changing any of them, and restart decisions ride the delivered restart budget and resume economics — exhaustion stays terminal and loud (typed question), never a silent requeue, and no process is ever signalled.

## 2. CONTEXT

### 2.1 Current State Snapshot

- **The resident dispatch daemon (M1-S18) is delivered** as an optional supervisor with a heartbeat-age single-instance lock, durable instance/heartbeat/lane/reconciliation records, startup reconciliation (alive / interrupted / crashed / evidence-insufficient, restart budget, exhaustion → terminal failed + typed question), per-ref single-flight refusal naming the live holder, safe-boundary preemption, and peak-window watch/park/resume. Its production composition runs the declared **supervise-only** mode: the daemon family is mounted without a lane composition, so the resident daemon records and observes but does not itself launch lane delivery today.
- **The watchdog check family (GH-221/235/238) is delivered**: preflight, teardown, and liveness probes with a corroboration-bound stall classification (heartbeat age at or beyond the delivered stall bound together with zero token delta and zero traffic), a no-CPU-signal rule (the signal shape has no CPU field, so a CPU-only reading can never classify a verdict), and the signals-absent unknown answer. Its specification explicitly names supervise (M2-S2) as a later lane consumer that consumes these probes instead of reimplementing them, and its boundary text states the watchdog surface never supervises.
- **The scheduling engine (M1-S1) is delivered**: lanes, leases, and the fenced claim path.
- **The queue lifecycle (GH-292) is delivered**: park records over a closed cause set (`provider-window`, `provider-quota`, `preempted-for-close-item`, `peak-window`, `owner-hold`) mapped many-to-one onto closed condition types (only the window shape carries an absolute expiry), with per-condition recheck defaults and per-ref single-flight.
- **The `lanes list | show <ref>` surface (GH-237) is delivered** with the six-value lane-state set (`delivering`, `idle-with-reason`, `parked`, `merge-ready`, `in-review`, `failed`), the `parked:<cause>` reason template, the never-inferred live `leaseHolder`, and parked/idle counts. No `supervise` surface exists yet.
- **The M2 pack (doc/planning/oss-tooling/milestones/m2/) pre-declares no architecture flow and no contract page for M2-S2** ("none in this pack" in the story-to-artifact map); the surface expectations live in the two scenario seeds SC-M2-S2-01 and SC-M2-S2-02 plus the M1-owned specs above. This change is therefore the first-spec authoring for a new `supervise` feature area (first-spec-only rule applies at documentation reconciliation).

### 2.2 Pain Points / Gaps

- **Nothing supervises the supervisors.** A delivery whose supervision has stopped — a resident daemon whose heartbeat records stopped advancing while its instance record still claims liveness, or a lane whose session signals claim activity while no artifact progresses — is observable today only by manual forensic inspection of the ledger. Delivered surfaces report what the records say; none evaluates whether the records themselves prove stagnation.
- **Detection is not action.** The watchdog family checks and restores but explicitly never supervises; the daemon's cycle observes and parks inside its own cadence but there is no operator-invokable battery that classifies a scope end-to-end and acts on corroborated stalls on demand. A stuck or lying delivery must be found by hand before anything can be done about it.
- **Lying liveness is undetected at the supervision level.** The delivered liveness classification corroborates stalls from harness signals (heartbeat age, token delta, traffic). Nothing classifies the inverse lie at the supervision plane: a supervisor or lane that keeps producing heartbeat-like evidence while its artifact trail (phase completions, recorded commits, attempt progress, ledger-position movement) goes flat.
- **Duplicate supervision has no read-side truth.** The delivered lock, lease, and single-flight mechanisms prevent specific double-claims at write time, but no surface answers "who supervises this scope right now, and is any claim stale or duplicated?" from durable evidence.
- **Naming seam risk.** The daemon-internal lane supervision cycle (the "supervise-only" production mode) and the operator-facing supervise surface this story adds share a word; without an explicit boundary decision, downstream work risks either duplicating the daemon's cycle or collapsing the two concepts.

## 3. PROBLEM STATEMENT

Because the delivered system can record and observe delivery activity but has no operator-facing supervision battery that evaluates liveness from artifact evidence and acts on its findings, an operator cannot detect — from the system itself — that a supervisor or a lane is stuck or lying about being alive, cannot distinguish a genuinely progressing delivery from one whose heartbeat-like signals continue while its artifact trail has gone flat, and cannot act on a corroborated stall on demand through the delivered park and restart machinery; as a result, stuck or lying deliveries are merely observed in the ledger and require manual forensic inspection, and a delivery can appear healthy right up to the point where its stalled supervision makes the failure expensive.

## 4. GOALS

- **G-1**: One operator-invoked battery run over one managed repository produces a machine report that classifies every lane and every intersecting supervision claim as `progressing`, `stalled`, or `unknown`, with per-lane heartbeat and live lease holder, scoped so the report names no repository other than the battery's own scope key.
- **G-2**: Every classification derives exclusively from artifact evidence — durable state-ledger records and the artifact trail they reference. No process-derived value (pid, process start time, CPU) is an input to any verdict, extending the watchdog's no-CPU rule to the supervision plane.
- **G-3**: Lying liveness is detected: claimed or recorded aliveness contradicted by a flat artifact trail across the declared observation span classifies `stalled`, and advancing artifact progress can never be overridden into `stalled` by any process-shaped reading.
- **G-4**: A corroborated stalled lane is acted on: the battery parks it through the delivered park machinery with a newly declared supervised-stall cause and a non-null re-entry instant, so the delivered `lanes` surface shows the parked state with the classified reason.
- **G-5**: Duplicate supervision is detected and refused: live supervision claims (daemon instances, coordinator leases, live per-ref leases) are classified in the report, an action that would double-claim a ref with a live holder is refused with the holder named, and an action whose object another supervision authority is actively acting on is refused with the live claim named — a supervised-stall park intent is a non-claiming action and is never so refused (DEC-8) — composing with the delivered lock, lease, and single-flight semantics without changing any of them.
- **G-6**: Restart policy composes with the delivered economics: restart decisions ride the delivered restart budget and resume admission; budget exhaustion follows the delivered terminal-plus-typed-question path; nothing is silently requeued and no process is ever signalled.
- **G-7**: Truthful projection: the report is the machine truth over the exclusive data/error envelope and the `{0,1,2}` exit taxonomy; unknown is a classified answer, never a guessed verdict or a defaulted zero.

### 4.1 Success Metrics / KPIs

| Metric | Target |
|--------|--------|
| Classification evidence totality | 100% of tri-state entries (lanes and supervisors) carry non-empty artifact-evidence references |
| Process-derived classification | Zero — the classification input shape declares no process-derived field, asserted by structure coverage |
| Stuck-supervisor detection | A supervisor whose recorded liveness continues while its supervision artifacts are flat across the observation span classifies `stalled` within one battery run (the ticket AC scenario) |
| Milestone seed parity | SC-M2-S2-01 and SC-M2-S2-02 hold verbatim against the delivered surfaces |
| Error-table delta | Exactly two new `supervise` identities appended; zero delivered rows changed; binding check green in both directions |
| Delivered residual integrity | The daemon's production composition remains supervise-only; every delivered boundary assertion over the daemon, watchdog, and queue families stays green unchanged |

### 4.2 Non-Goals

- **NG-1**: No continuous resident supervision battery. The battery is operator-invoked; the daemon's existing resident cadence is unchanged. A resident supervise cadence is future work.
- **NG-2**: No lane delivery or composition. The battery launches no session, runs no phase, makes no commit, and performs no delivery work — mirroring the daemon's own no-delivery discipline.
- **NG-3**: No process management. No pid scan, no process signalling, no kill-with-grace at this surface; identity-verified process seams remain the delivered coordinator consumption (GH-241).
- **NG-4**: No new event taxonomy surface. No new topic and no new event kind; supervised parks surface through the delivered topics and kinds.
- **NG-5**: No multi-repository aggregation. The battery is per-repository by contract; host-wide views belong to the board and project-group stories (M2-S4, M2-S11).
- **NG-6**: No change to the daemon's delivered residual, the watchdog family's delivered checks, or the queue/lease machinery's delivered behavior; all composition is additive.
- **NG-7**: No automatic remediation beyond the declared stall park and restart-policy composition: no auto-reopen, no auto-requeue, no auto-merge, no tracker writes.

## 5. FUNCTIONAL CAPABILITIES

| ID | Capability | Rationale |
|----|------------|-----------|
| F-1 | Supervisor battery run and per-repository report | One invocation answers "what is the supervision truth of this repository right now" with repo-scoped machine truth (SC-M2-S2-01) |
| F-2 | Tri-state supervision status from artifact evidence | `progressing` / `stalled` / `unknown`, derived only from the durable-record fold; unknown is never guessed |
| F-3 | Lying-liveness detection | Claimed aliveness contradicted by the artifact fold classifies `stalled`; the ticket AC's artifact-evidence-not-process-state rule |
| F-4 | Progress-watchdog consumption | Consumes the delivered watchdog probes and sourced signals instead of reimplementing them; the corroboration bound and no-CPU rule are reused |
| F-5 | Supervised-stall park with classified reason | A corroborated stall is parked through the delivered park machinery with the new cause and a non-null re-entry instant (SC-M2-S2-02) |
| F-6 | Duplicate-supervisor detection and double-act refusal | Live supervision claims classified in the report; double-claiming actions refused with the live holder named |
| F-7 | Restart-policy composition over delivered economics | Restart admission rides the delivered budget and resume economics; exhaustion stays terminal and loud |
| F-8 | Error-table binding for the supervise domain kind | Exactly two new identities join the closed union through the delivered binding check |

### 5.1 Capability Details

- **F-1 — Supervisor battery run and per-repository report.** The `supervise` family's primary invocation runs the battery over exactly one repository scope — the invoking checkout's managed repository — with no positionals and the global machine-read flag; any extra positional or unknown flag is refused through the delivered grammar containment before any read. The report payload is schema-versioned (`delivery.supervision.v1`) and carries: the repository key; one entry per lane in scope with the lane's ref, tri-state, last heartbeat observation, and live lease holder (present exactly when a live lease exists, equal to the lease's recorded holder, never inferred — the delivered lease-holder discipline); one entry per supervision claim intersecting the scope (resident daemon instance claims, coordinator lease claims) with identity, tri-state, last heartbeat observation, and scope evidence; the actions the run applied; counts; degradation markers; and explicit truncation with a named reason when a declared bound is hit. The report names no repository other than the battery's own scope key; entries reference refs, holders, and scope evidence bounded to that scope. The family is reachable from the shipped binary as part of the prompt-required composition (the daemon-family precedent), renders human text from the same evidence as the machine payload, and carries no product or binary literal outside the branding seam.

- **F-2 — Tri-state supervision status from artifact evidence.** Every lane and supervision claim classifies to exactly one of `progressing`, `stalled`, or `unknown`. The derivation is a pure read-time fold over the durable record set: daemon heartbeat records and their monotone ordinals, daemon lane records and their observed progress instants, queue lease and park records, dispatch attempt records, phase records, and the commit-artifact records (receipts and effects) they reference. That one fold's snapshot is the single input to both the verdicts and the run's actions: stall parks, restart admissions, and claim decisions reuse it, with no per-lane whole-store re-read (NFR-4, DEC-9(d)). `stalled` requires corroboration (F-3/F-4); a partial or mixed reading classifies `progressing` — a resuming or prefilling lane with any advancing evidence never reads as stalled (the delivered prefill-safe discipline); absent or insufficient evidence classifies `unknown` (the delivered signals-absent and evidence-insufficient discipline: the answer is unknown, never guessed). The `unknown` state is a first-class report value: an all-unknown scope projects as the classified evidence-absent outcome, while individual unknown entries ride the report truthfully.

- **F-3 — Lying-liveness detection.** The battery evaluates the contradiction between claimed liveness and artifact progress. For a lane: heartbeat-like evidence (heartbeat age within the bound, session traffic claimed) combined with a flat artifact trail — no phase completion, no recorded commit, no attempt progress, no ledger-position movement across the declared observation span — classifies `stalled` despite the live-looking signal. For a supervisor: an instance or lease claim whose recorded liveness continues (heartbeat ordinals advancing) while its supervision artifacts are flat across the span (no lane record progress, no reconciliation or action evidence) classifies `stalled` the same way. This is the ticket acceptance criterion: a stuck supervisor is detected by artifact evidence, not process state. Conversely, advancing artifact evidence classifies `progressing` regardless of any process-shaped reading; no process-derived value exists in the classification input shape at all.

- **F-4 — Progress-watchdog consumption.** The battery consumes the delivered watchdog probes — preflight, teardown, and liveness — and the delivered sourced-signal facts (heartbeat age, token delta, traffic) as inputs to its fold, instead of reimplementing them; the watchdog specification names supervise as exactly this consumer. The delivered stall-corroboration bound is reused as the default corroboration bound (heartbeat age at or beyond the delivered stall bound together with zero artifact progress); a supervise-specific bound, if ever needed, joins the configuration layer through the declared branch mechanism rather than a magic value. The signal shape has no process-derived field, and an absent signal source contributes the unknown classification, never a coerced zero or a guessed verdict.

- **F-5 — Supervised-stall park with classified reason.** When the battery corroborates a lane stall, it acts: the lane is parked through the delivered park machinery (fenced append of a park record) carrying the newly declared supervised-stall cause and a non-null re-entry instant (`until`) — the declared stall recheck horizon — together with the evidence that corroborated the stall. The delivered condition machinery applies unchanged: the cause maps onto the delivered condition-type whose evaluable shape carries an absolute re-entry instant (the many-to-one mapping pattern the peak-window cause established), and the mapped condition type's declared recheck default governs re-evaluation. The delivered `lanes` surface then shows the lane parked with the classified reason (the delivered `parked:<cause>` template), so an operator reading the board sees a parked lane, not a healthy one (SC-M2-S2-02). The append is gated on the lane carrying no active park of any cause: an existing owner-hold, peak-window, quota, close-item-preemption, or stuck `clear-observed` park is respected rather than stacked, because a second active park of any cause would tear every later park read (DEC-9(e)); restart admission stays limited to the supervised-stall cause. A stall over a lane whose session is actively held records the durable park record immediately and reports the action as the declared safe-boundary park intent (`safe-boundary-park-intent`): durable intent, zero session effect, zero signals — the delivered park record is the intent carrier, the held session is never signalled, and the session observes the park at its own next boundary through the delivered safe-boundary discipline, not through any deferred landing of the record (DEC-9(b)). Parked stall lanes recover only through the delivered recovery classification — restart admission under the delivered budget, resume economics, and the terminal-exhaustion-plus-typed-question path on exhaustion — never a scratch re-dispatch and never a silent requeue.

- **F-6 — Duplicate-supervisor detection and double-act refusal.** The battery classifies, from the durable record fold, every live supervision claim intersecting its scope: a daemon instance claim is live when its instance record exists and its heartbeat fold reads live per the delivered heartbeat-age staleness bound; a coordinator claim is live when its ledger lease records prove live ownership; a ref claim is live when a live lease records a holder (the delivered single-flight holder). The report carries each claim with its tri-state — including the stuck-supervisor detection of F-3 — and names the holder. The battery's own actions serialize through the delivered fenced append path. The duplicate-supervision refusal guards a specific object (DEC-8): another **supervision authority actively acting** over the same object the battery's action targets — for example another battery run mid-action, or a coordinator claim actively acting over that object. The acting-authority artifact class is the delivered `daemon.preemption` pending record, the only durable record naming an object another supervision authority is acting on; the observation window is the imported corroboration bound, detection stays record-only (never a process scan), and an authority class that leaves no such durable record is a declared detection limit rather than an inferred gate (DEC-9(c)) — none of which loosens DEC-8's per-action semantics. A live resident daemon's existence is report enrichment, never a gate: it refuses nothing by itself and never vetoes parks or other battery actions. Per-ref double-claims — an action that would double-claim a ref whose live lease is held — stay refused through the delivered per-ref single-flight identity with the holder named, unchanged. A supervised-stall park intent, including its safe-boundary preemption intent path, is a **non-claiming action**: it is never refused as a double-act against a live per-ref lease or a live daemon claim, and its safety comes from the delivered fenced append and write serialization (a landed park refuses a second identical park), not from the duplicate-supervision refusal. Detection is by artifact evidence (records), never by a process scan; the delivered daemon lock, coordinator ledger lease, and single-flight mechanisms are consumed, not changed; and no lane composition is required for any of this (the daemon's production composition stays supervise-only).

- **F-7 — Restart-policy composition over delivered economics.** The battery applies no restart policy of its own: restart admission for a detected stall consults the delivered restart budget and resume-economics seam exactly as the daemon's cycle does. An admitted restart appends the delivered restart record through the delivered path; budget exhaustion appends the delivered terminal exhaustion record and raises the typed question — exhaustion never silently requeues, and an unevaluable admission is reported as the declared unavailable outcome instead of being silently resolved. The battery never signals, kills, or restarts a process directly; every restart-shaped action rides the delivered seams.

- **F-8 — Error-table binding for the supervise domain kind.** A `supervise` domain kind joins the closed error-table union with exactly two new identities: the duplicate-supervision refusal (a classified per-action refusal naming the live claim and holder, retryable — a later run after the other authority stops acting succeeds, projected at exit `1`) and the evidence-absent unknown answer (no artifact-evidence source exists for the scope, retryable, projected at exit `2` — the signals-absent pattern). The refusal identity is per-action, never per-claim: claim classification and holder reporting always ride the report data and are never themselves a refusal; the identity appears only when the battery attempts an action and a live authority actively holds that action's object, and the run carrying such a refused action projects the failure envelope at exit `1` — a run whose actions all succeed (or need none) reports data at exit `0` even when live claims are merely present (DEC-8). Every other outcome reuses delivered identities: grammar and invocation refusals through the delivered containment identities, unreadable or torn state through the delivered collector/state identities, per-ref double-claims through the delivered single-flight identity. The new rows are appended after the existing rows and bound in both directions by the delivered error-table binding check; no existing row changes.

## 6. USER & SYSTEM FLOWS

```
Flow 1: Routine battery run — healthy lane (SC-M2-S2-01)
  Operator runs supervise → battery folds the repository's durable records
  → lane folds to progressing (advancing artifact evidence)
  → report: repo key, one lane entry (ref, heartbeat, holder), no other repo named
  → exit 0 with the report as data

Flow 2: Stalled lane — corroborated, acted on (SC-M2-S2-02)
  Operator runs supervise → lane's heartbeat age at/beyond the delivered stall
  bound and artifact trail flat across the span → corroboration holds
  → battery parks the lane: fenced park record with the supervised-stall cause
  and non-null until → delivered lanes surface shows state parked with the
  classified reason → report counts the action; exit 0

Flow 3: Lying liveness — signal says alive, artifacts say flat (ticket AC)
  Battery folds a lane (or supervisor claim) whose heartbeat-like evidence
  continues while phase/commit/attempt/ledger-position artifacts are flat
  across the observation span → classifies stalled by artifact evidence
  (no process-derived reading exists to contradict the fold) → reported;
  lanes acted on per Flow 2

Flow 4: Duplicate supervision — a live authority actively acting
  Battery prepares an acting action over an object another supervision
  authority is actively acting on → per-action refusal naming the live
  claim and holder; that run projects the refusal envelope at exit 1
  (claim tri-states and holders always ride report data — they are never
  a refusal); a live resident daemon's existence alone refuses nothing;
  a park intent is a non-claiming action — it lands through the delivered
  fenced append and safe-boundary discipline, never refused as a
  double-act; a stuck claim reads stalled by artifact evidence, not by
  process state

Flow 5: Evidence absent — the unknown answer
  Battery finds no artifact-evidence source for the scope (or a lane has
  none) → unknown is reported truthfully; an all-unknown scope projects the
  classified evidence-absent outcome at exit 2 — never a guessed verdict,
  never a defaulted zero
```

## 7. SCOPE & BOUNDARIES

### 7.1 In Scope

- The operator-facing `supervise` command family with one battery invocation, delivered grammar containment, machine and human projections over the exclusive envelope, and the `{0,1,2}` exit taxonomy.
- The schema-versioned supervision report payload: repository key, per-lane tri-state entries with heartbeat and holder, per-supervisor claim entries with tri-state, actions, counts, degradation markers, and bounded truncation.
- Tri-state classification (`progressing` / `stalled` / `unknown`) as a pure artifact-evidence fold over the delivered record set, including lying-liveness detection for lanes and supervision claims.
- The supervised-stall park cause joining the closed park-cause set with a declared condition mapping and non-null re-entry instant, and the additive surfacing of the active park's re-entry instant on the parked lane's machine read.
- Duplicate-supervisor detection as a read-time fold plus the double-act refusals (one new identity; delivered single-flight reused for per-ref claims).
- Restart-policy composition over the delivered restart budget, resume economics, and terminal-exhaustion path.
- Error-table binding for exactly two new `supervise` identities.
- Documentation reconciliation inputs: the first `supervise` feature page (first-spec-only rule) and boundary-text reconciliation in the watchdog and resident-daemon pages, delivered through the change lifecycle's documentation phase.

### 7.2 Out of Scope

- [OUT] A resident or scheduled supervision battery cadence inside the daemon (NG-1; the daemon's delivered resident cycle is unchanged).
- [OUT] Lane delivery, composition, phase execution, or commit work from the battery (NG-2).
- [OUT] Process management: pid scanning, process signalling, kill-with-grace, or any process-derived classification input (NG-3).
- [OUT] New event topics or event kinds in the taxonomy (NG-4).
- [OUT] Multi-repository or host-wide aggregation views (NG-5; board and project-group stories).
- [OUT] Changes to the delivered daemon lock, coordinator ledger lease, single-flight semantics, watchdog checks, or queue/lease machinery behavior (NG-6).
- [OUT] Automatic remediation beyond the stall park and restart-policy composition: auto-requeue, auto-reopen, tracker writes, or owner notifications beyond the delivered typed-question path (NG-7).
- [OUT] A durable supervision-claim record kind for cross-battery concurrency beyond the delivered record set (deferred — see OQ-1 and RSK-2).
- [OUT] Restart of the daemon itself, daemon lifecycle changes, or supervisor-unit installation changes.

### 7.3 Deferred / Maybe-Later

- A durable battery-claim record kind enabling cross-battery concurrency detection beyond the delivered record set (paired with OQ-1; would follow the additive record-kind conventions).
- A resident supervise cadence or ceremony integration (the M2-S3 ceremony runner could invoke the battery as a declared ceremony input later).
- Cross-repository supervision aggregation once project groups (M2-S11) and the board (M2-S4) land their shared scopes.
- A supervise-specific corroboration bound as a configuration key, if the delivered stall bound proves too coarse in practice.

## 8. INTERFACES & INTEGRATION CONTRACTS

### 8.1 REST / HTTP Endpoints

N/A. No HTTP surface is added or changed. The affected operator surfaces are the new local `supervise` command family and the existing local reads it feeds: `lanes list | show <ref>` (the parked state and classified reason after a stall park, plus the additive active-park re-entry instant), `status`/`board`-family reads (parked sections reflect the park through the delivered projections), and the delivered `daemon status` fold (consumed as supervision-claim evidence).

### 8.2 Events / Messages

| ID | Topic | Kind | Payload semantics |
|----|-------|------|-------------------|
| EVT-1 | (no new topic; delivered `lanes` snapshot topic) | (no new kind) | A supervised stall park is visible through the delivered topics without any taxonomy change: the lanes snapshot projection reflects the parked state on the next publish, and no new topic or event kind joins the declared sets in this change |

The battery appends no capsule event, reads no capsule record, and never carries capsule state through its payloads (the delivered capsule boundary holds).

### 8.3 Data Model Impact

| ID | Element | Description |
|----|---------|-------------|
| DM-1 | Supervision report payload (`delivery.supervision.v1`) | Schema-versioned machine report: repository key; `lanes[]` entries each with ref, tri-state, last heartbeat observation, live lease holder (present exactly when a live lease exists, never inferred), and evidence; `supervisors[]` entries each with claim identity, tri-state, last heartbeat observation, and scope evidence; `actions[]` naming what the run applied with evidence; counts; degradation markers; bounded truncation with a named reason; the run's recorded instant |
| DM-2 | Supervised-stall park cause | One declared value (`liveness-stall`) joins the closed queue park-cause set, mapped onto the delivered condition-type whose evaluable shape carries an absolute re-entry instant (the many-to-one mapping pattern the peak-window cause established); a park carrying this cause names the corroborating evidence and carries a non-null `until` at the declared stall recheck horizon; re-evaluation rides the mapped condition type's declared recheck default |
| DM-3 | Active-park re-entry instant on the lane projection | The parked lane's machine read gains the active park's `until` as an additive optional field — present exactly when an active expiry-carrying park exists for the lane, absent otherwise, never inferred and never defaulted (the delivered lease-holder discipline) |
| DM-4 | Additive record discipline | No new state-ledger record kind: the battery folds delivered kinds and appends only through the delivered park, restart, and terminal-exhaustion record paths; all additions follow the state layer's additive, schema-versioned, fenced-append conventions; no in-place mutation, no schema bump of delivered payloads, no migration |

### 8.4 External Integrations

None new. The battery is offline and state-mediated: it reads the delivered state-ledger seams and consumes the delivered watchdog probe composition. No tracker, VCS host, provider, credential, or network surface is added or changed; its absence never changes a one-shot result (the delivered daemon-down continuity principle applies to the battery: the fold reads durable truth, and degradation is declared, never assumed).

### 8.5 Backward Compatibility

- **Additive only.** The report is a new payload; the park-cause set gains one declared value without renaming or removing the delivered five; the lane projection gains one additive optional field; existing consumers tolerate the additions, and reads of pre-change records see the new cause absent and treat that absence as a classified absence.
- **Delivered vocabularies are extended, not edited.** The delivered `parked:<cause>` template keeps rendering the delivered causes unchanged; the new cause renders through the same template.
- **Delivered mechanisms are unchanged.** The daemon lock, heartbeat fold, coordinator lease, single-flight refusals, restart economics, and watchdog probes behave exactly as delivered; the daemon's production composition remains supervise-only, and its declared residuals are untouched.
- **Behavior without the battery is unchanged.** Nothing in the delivered system depends on the battery running; a stalled lane behaves exactly as delivered until a battery run parks it.

## 9. NON-FUNCTIONAL REQUIREMENTS (NFRs)

| ID | Requirement | Threshold |
|----|-------------|-----------|
| NFR-1 | Stall corroboration is bounded and reused | A lane or claim classifies `stalled` only when the heartbeat age is at or beyond the delivered stall-corroboration bound (300,000 ms) AND the artifact trail shows zero progress across that span; any partial or advancing reading classifies `progressing` |
| NFR-2 | Evidence purity | The classification input shape declares no process-derived field (pid, process start time, CPU); a process-only reading can never satisfy the shape or classify a verdict — asserted structurally, like the watchdog no-CPU rule |
| NFR-3 | Determinism | Identical durable-record sets replayed with an injected clock produce an identical report, evidence, actions, and exit; evidence names refs, record kinds, record instants, and codes |
| NFR-4 | Read and report bounds | One decision fold per battery run (the delivered publish-tick read discipline); the action path consumes that fold's snapshot — park, restart, and claim decisions perform no per-lane whole-store re-reads — while the delivered append helpers may perform their own bounded read-then-verify per append and the blocker ledger is read at most once per run, its snapshot passed to the append as the current view (DEC-9(d)); the report is bounded at the delivered 200-lane cap with explicit truncation and a named truncation reason; evidence fields respect the delivered evidence caps |
| NFR-5 | Battery run latency | A full battery run at the 200-lane cap completes within 5,000 ms wall-clock in the offline behaviour suite (local fold, injected clock, no network) |
| NFR-6 | Evidence totality | Every tri-state entry (lane and supervisor), every action, and every refusal carries non-empty evidence; failure evidence rides the failure summary, success evidence rides the report fields |
| NFR-7 | Offline | Every behaviour runs against a real temporary repository with injected clock, brand, and run identity; no network access anywhere in the battery; a fixture guard rejects any root equal to the live workspace |

## 10. TELEMETRY & OBSERVABILITY REQUIREMENTS

The report itself is the observability surface: counts of progressing/stalled/unknown lanes, supervision-claim tri-states, and applied actions are machine-readable per run (DM-1), and the durable park, restart, and terminal-exhaustion records the battery's actions append are the audit trail. No new metrics emitter, log stream, or telemetry topic is required by this change; observability rides the delivered record set, the delivered envelope projections, and the report. Degradation (daemon unreachable, partial reads, truncation) is declared in the report's degradation markers rather than logged aside.

## 11. RISKS & MITIGATIONS

| ID | Risk | Impact | Probability | Mitigation | Residual Risk |
|----|------|--------|-------------|------------|---------------|
| RSK-1 | The stall-park cause's condition mapping misroutes recheck or recovery semantics (the mapped condition type's recheck default governs re-evaluation for a cause whose rhythm differs from provider windows) | M | M | Declare the mapping and the recheck horizon explicitly (DM-2); bind the cause/condition pair structurally like the delivered pairs; recovery routes only through the delivered restart/recovery classification, never the mapping's default resume semantics alone | Low — worst case a recheck fires too often or late, surfaced by the report's evidence |
| RSK-2 | Two battery runs race without a resident daemon: the fence serializes appends but not decisions, so both folds could act before either park lands | H | M | Actions serialize through the delivered fenced append path and per-ref single-flight (a landed park or a live holder refuses the second act); the residual window is declared, and the durable claim-record kind that would close it is deferred with OQ-1, not smuggled in | Medium — acknowledged and declared; closed by future claim-record work if evidence shows recurrence |
| RSK-3 | Stall misfire on prefill or resume: a freshly started or resuming session with a momentarily flat artifact trail parks wrongly | H | M | Reuse the delivered prefill-safe discipline: only the full corroboration combination (NFR-1) classifies stalled; any advancing evidence classifies progressing; the park carries its corroborating evidence so a wrong park is auditable and recoverable through the delivered recovery classification | Low |
| RSK-4 | Naming-boundary confusion between the daemon-internal supervision cycle and the operator-facing supervise surface produces duplicate logic or contract drift | M | M | DEC-1 fixes the relationship (consumption, not duplication) in this spec, in the phase-7 feature page, and in the reconciliation notes for the daemon and watchdog boundary texts | Low |
| RSK-5 | The battery acts against a live daemon-held claim and double-parks or double-restarts a lane | H | L | Refuse double-act with the live claim named (F-6); per-ref single-flight names the holder; active sessions are only touched through the delivered safe-boundary discipline (never signalled) | Low |
| RSK-6 | Closed-union or closed-vocabulary drift (extra identities, renamed causes) breaks conformance | L | M | Exactly two new identities and exactly one new cause are declared here; the delivered binding check and the structural vocabulary guards fail closed on any drift | Low |

## 12. ASSUMPTIONS

- The delivered M1 dependencies (scheduling engine, resident daemon, watchdog probes, queue machinery, restart economics, state layer, result contract) remain delivered and unchanged in their contracts for the duration of this change.
- The daemon's production composition remains supervise-only for this change's duration; the battery is designed so that no part of it requires a lane composition.
- The two milestone scenario seeds (SC-M2-S2-01, SC-M2-S2-02) remain the inherited test-plan starting point, reconciled per DEC-2 where their field labels meet the delivered payload names.
- The delivered stall-corroboration bound (300,000 ms) is an adequate default corroboration bound for supervision-level stalls; if real usage disproves this, the declared configuration-key path (7.3) is the follow-up, not a magic value.
- The battery runs in the invoking checkout's repository scope, consistent with the delivered per-repository surfaces; host-wide scopes arrive with the project-group stories, not here.

## 13. DEPENDENCIES

| Direction | Item | Notes |
|-----------|------|-------|
| Depends on | Resident dispatch daemon (M1-S18 / GH-238) | Instance/heartbeat/lane records as supervision evidence; lock staleness semantics; safe-boundary discipline; supervise-only production composition |
| Depends on | Scheduling engine (M1-S1) | Lanes, leases, and the fenced claim path the battery's actions ride |
| Depends on | Watchdog probes (GH-221 / GH-235 / GH-238) | Liveness classification, corroboration bound, prefill-safe rule, no-CPU rule, signals-absent pattern; the watchdog spec names supervise as this consumer |
| Depends on | Queue lifecycle and single-flight (GH-292) | Park records, closed cause set, condition types and recheck defaults, per-ref single-flight refusal naming the holder |
| Depends on | Session lifecycle economics (M1-S15) | Restart budget, resume economics, terminal exhaustion + typed question |
| Depends on | Coordinator consumption (GH-241) | The coordinator's ledger lease as claim evidence (never the daemon lock) |
| Depends on | State layer (GH-174) | Additive versioned records, fenced appends, verified reads |
| Depends on | Result contract and error table (GH-172) | Envelope, exit taxonomy, closed union, binding check |
| Depends on | Lanes surface (GH-237) | The delivered lane projection and parked-state rendering the report's actions must satisfy |
| Blocks | Later M2 ceremonies reading supervision truth | The M2-S3 ceremony runner and M2-S4 board can consume the battery's report and the stall-park records once delivered |

## 14. OPEN QUESTIONS

| ID | Question | Context | Status |
|----|----------|---------|--------|
| OQ-1 | Does cross-battery concurrency (two battery runs, no resident daemon) eventually need a durable supervision-claim record kind to close the declared race window (RSK-2)? | This change deliberately adds no record kind (DM-4) and declares the residual; a claim record would follow the additive record-kind conventions and touch the state layer's record set | Deferred — non-blocking for this change; decision needed before any future claim-record change: consult `@decision-advisor` |

## 15. DECISION LOG

| ID | Decision | Rationale | Date |
|----|----------|-----------|------|
| DEC-1 | The operator-facing `supervise` surface and the daemon-internal lane supervision cycle are distinct: the battery consumes the cycle's durable products (instance, heartbeat, lane, park, attempt records) and the delivered watchdog probes; it neither reimplements nor replaces the cycle, and the daemon's production composition stays supervise-only | The watchdog spec already names supervise as the consumer of its probes; the daemon spec's supervise-only mode is a composition fact, not a rival surface; naming the boundary now prevents duplicate logic and contract drift (RSK-4) | 2026-11-16 |
| DEC-2 | Park-reason naming: one new cause value (`liveness-stall`) joins the closed park-cause set, mapped onto the delivered condition-type whose evaluable shape carries an absolute re-entry instant (the GH-294 many-to-one precedent — no new condition type, no silent rename); the classified reason surfaces through the delivered lane `reason` template as `parked:liveness-stall`; the seed's `parkReason` label maps to that delivered field; the parked lane's machine read gains the active park's `until` additively, present-when-active and never inferred | The delivered contracts already own `cause`, `until`, and the `parked:<cause>` template; introducing a parallel `parkReason` field would fork the vocabulary; the seed's non-null `until` assertion is satisfied on the delivered lane read by DM-3 | 2026-11-16 |
| DEC-3 | Duplicate-supervisor detection is a read-time artifact fold over the delivered record kinds (daemon instance + heartbeat staleness fold, coordinator ledger lease, live per-ref leases); no new record kind; per-ref double-claims refuse through the delivered single-flight identity, scope-level double-acts refuse through one new identity; the delivered lock, lease, and single-flight mechanisms are consumed, not changed; no lane composition required | Watch-item 3: composition without changing the daemon's delivered residual; a new record kind would expand state-layer scope for a race this change can declare instead (OQ-1, RSK-2) | 2026-11-16 |
| DEC-4 | Artifact evidence is defined as: the durable state-ledger record set (daemon instance/heartbeat/lane records, queue lease and park records, dispatch attempt records, phase records, commit receipt/effect records) plus the artifact trail those records reference (phase completions, recorded commits, attempt progress, ledger-position movement), evaluated by read-time fold; process signals (pids, process start times, CPU) are never evidence | Watch-item 4: make the ticket AC concrete; consistent with the watchdog no-CPU rule and the daemon's state-is-the-only-shared-truth principle | 2026-11-16 |
| DEC-5 | Tri-state is exactly `progressing` / `stalled` / `unknown`, derived only from the DEC-4 fold; `stalled` requires corroboration (heartbeat age at/beyond the delivered bound AND zero artifact progress across the span); partial or advancing readings classify `progressing` (prefill-safe); absent evidence classifies `unknown` and is never guessed | Watch-item 5: the three states mirror the delivered watchdog verdict family and the evidence-insufficient discipline, so the taxonomy, exits, and test vocabulary stay coherent | 2026-11-16 |
| DEC-6 | Exit truthfulness: exit `0` when the battery ran and produced its report (detected-and-parked stalls ride the report's data and counts — the battery's job succeeded); exit `1` for classified refusals (grammar, delivered refusal identities, and the per-action duplicate-supervision refusal of DEC-8 — the run carrying a refused action projects the failure envelope, while claim classification and holder reporting always ride data and are never themselves a refusal); exit `2` when no artifact-evidence source exists (evidence-absent) or state is unreadable | The exclusive data/error envelope cannot carry both a full report and a failure; the `daemon status` degraded-exits-0 precedent applies — the report is the truth, the exit classifies the run's own outcome; a lying exit-zero is avoided because the report's counts always state what was found and parked; the run-level vs per-action projection rule is DEC-8 | 2026-11-16 |
| DEC-8 | Duplicate-supervision refusal granularity, projection, and park composition: (a) the guarded object is a supervision authority **actively acting** over the same object the battery's action targets — the scope-level refusal fires only against an actively acting authority (another battery run mid-action, a coordinator claim actively acting), and a live resident daemon's existence enriches claim reporting without gating parks or any battery action (consistent with §18 and NG-6); per-ref double-claims stay with the delivered single-flight identity unchanged; (b) projection is per-action, never per-claim: claim classification and holder reporting always ride the report data and are never a refusal; the duplicate-supervision identity appears only when the battery attempts an action whose object a live authority actively holds, and that run projects the refusal envelope at exit `1` with the evidence naming the live claim and holder; a run whose actions all succeed (or need none) reports data at exit `0` even when claims are merely present; (c) a supervised-stall park intent — including the safe-boundary preemption intent path from DEC-7 — is a **non-claiming action**: it is never a double-act against a live per-ref lease or a live daemon claim; its safety comes from the delivered fenced append and write serialization (a landed park refuses a second identical park), not from the duplicate-supervision refusal | Closes the three coupled gaps found by the test-plan author: granularity (scope vs lane vs claim was undefined, and a scope-level blanket refusal would contradict §18's enrichment-not-gating by letting a live daemon veto every park); projection (the exclusive data/error envelope cannot carry a refusal and the claim report simultaneously, and the spec had no run-level vs per-action rule); composition (counting a live per-ref lease as a refused double-act would make AC-F5-1's park unreachable in exactly the session-held common case the park exists for) | 2026-11-16 |
| DEC-7 | The battery never signals a process: a stall park over an actively held session records through the delivered safe-boundary preemption discipline (durable park record written immediately as the intent carrier, action reported as `safe-boundary-park-intent`, zero session effect, no process signalled — DEC-9(b)); a stall over an unheld lane parks directly; restarts ride the delivered budget and resume economics with terminal exhaustion plus typed question | Watch-item on restart policies: reuse, don't reinvent — the daemon's safe-boundary and economics machinery already owns the hard parts; killing processes at the supervision plane would contradict the delivered discipline | 2026-11-16 |
| DEC-9 | Delivery-time resolutions recorded against the delivered battery, each superseding only the earlier phrasing it names: (a) **operator-path refusal for `liveness-stall`** — the cause is battery-written only, mirroring the owner-hold one-writer rule; the operator path refuses `queue release --park liveness-stall` with a delivered identity naming the cause, because the operator grammar cannot supply the mandatory re-entry instant its mapped condition type requires, while the battery writer always supplies `until`; the governing rule is that every cause–writer pair must round-trip a park record its own guard accepts, or be refused by name. (b) **Safe-boundary carrier** — a stall over an actively held session records the durable park record immediately and reports the action as `safe-boundary-park-intent`: durable intent, zero session effect, zero signals; the delivered close-item preemption record cannot carry this park without misrecording its fixed cause/closeRef, and adding a record kind or changing the daemon contract is forbidden (DM-4/NG-6), so the park record is the only honest durable intent carrier in the delivered set (supersedes the deferred-landing phrasing of F-5 and DEC-7). (c) **Acting-authority artifact class** — DEC-8(a) detection reads the delivered `daemon.preemption` pending record as the acting-authority artifact, the only durable record naming an object another supervision authority is acting on; the observation window is the imported corroboration bound, and detection stays record-only. (d) **Read discipline** — the battery performs exactly one decision fold per battery run, and the action path consumes that fold's snapshot: park, restart, and claim decisions perform no per-lane whole-store re-reads; the delivered append helpers keep their delivered read-then-verify, a bounded per-append cost rather than a per-lane re-read; and the blocker ledger is read at most once per run, its snapshot passed to the append as the current view. No claim is made that a composed acting run performs exactly one store read in total. (e) **Park-state interaction rule** — a supervised-stall park is appended only when NO active park of any cause exists for the lane (owner-hold, peak-window, provider-quota, preempted-for-close-item, and a stale `clear-observed` park included): a second active park of any cause is forbidden because duplicate active parks tear every subsequent park read, so an existing park of another cause is respected rather than stacked; restart admission remains liveness-stall-only. (f) **Question idempotence** — the exhaustion typed question is raised only when the exhaustion record was actually appended (`appended === true`) or when the question is deduped by ref and type; the per-run run id is record and evidence metadata, never part of the question identity. | Review iteration 1 (F-1 critical, F-2 high, F-4 high) found the delivered behaviour honest while the requirements chain still stated mechanisms that were not built or not bounded: a legal operator path that wrote a record its own guard rejects, a deferred landing that was never deferred, an unnamed acting-authority evidence class, and a read bound the action path broke. Review iteration 2 (F-1v2 critical, F-2 high, F-3 medium) closed the remaining coupling: a second active park under another cause tore every later park read, and a run-scoped question identity multiplied owner-facing questions on retry. Recording each resolution here keeps one home per mechanism, preserves the closed sets (DM-4/NG-6), and makes F-2, F-4, F-5, F-6, NFR-4 and AC-F5-1 assert exactly what the delivered battery does | 2026-11-17 |

## 16. AFFECTED COMPONENTS (HIGH-LEVEL)

| Component | Impact |
|-----------|--------|
| Operator command surface | New — the `supervise` command family (one battery invocation) |
| Supervision contracts | New — the schema-versioned report payload; Updated — one declared cause value in the closed park-cause set; one additive lane-projection field |
| State-ledger record set | Unchanged kinds — the battery folds delivered kinds and appends only through the delivered park/restart/exhaustion paths |
| Lanes machine read | Updated — additive active-park re-entry instant on parked lanes |
| Watchdog probe family | Consumed, unchanged — the battery is the consumer that family's spec names |
| Resident dispatch daemon | Consumed, unchanged — production composition remains supervise-only; records are the battery's evidence |
| Queue/park machinery | Consumed, unchanged — one declared cause value joins the closed set; condition machinery applies as delivered |
| Restart economics | Consumed, unchanged — budget, resume economics, terminal exhaustion |
| Error table | Updated — exactly two appended `supervise` identities, bound by the delivered binding check |
| System specification docs | New — first `supervise` feature page at reconciliation; boundary-text reconciliation in the watchdog and resident-daemon pages |
| Planning truth (backlog) | Updated — story markers/status maintained per convention during delivery |

## 17. ACCEPTANCE CRITERIA

| ID | Criterion | Linked |
|----|-----------|--------|
| AC-F1-1 | **Given** one managed repository with an active lane, **when** the supervision battery runs, **then** the report carries the repository key equal to the single managed repository key and one lane entry with that lane's ref, last heartbeat observation, and live lease holder, and the report names no repository other than the battery's own scope key | F-1, DM-1, NFR-3, NFR-6 |
| AC-F2-1 | **Given** lanes and supervision claims folded from durable records, **when** the battery classifies them, **then** a claim with advancing artifact evidence classifies `progressing`, a claim meeting the full corroboration combination (heartbeat age at or beyond the delivered stall bound and zero artifact progress across the span) classifies `stalled`, a claim with absent or insufficient evidence classifies `unknown` and the answer is never guessed or defaulted, and no process-derived value exists in the classification input shape | F-2, F-4, NFR-1, NFR-2, DEC-5 |
| AC-F3-1 | **Given** a lane (or supervision claim) whose recorded liveness continues while its artifact trail shows no phase completion, no recorded commit, no attempt progress, and no ledger-position movement across the observation span, **when** the battery runs, **then** the entry classifies `stalled` by artifact evidence alone; and **given** a lane whose artifact evidence advances, **when** any process-shaped reading would suggest a stall, **then** the entry still classifies `progressing` — a stuck supervisor is detected by artifact evidence, not process state | F-3, F-2, NFR-2, DEC-4 |
| AC-F4-1 | **Given** the delivered watchdog probes and sourced-signal facts, **when** the battery evaluates liveness, **then** it consumes the delivered classification, corroboration bound, and prefill-safe rule instead of reimplementing them, an absent signal source contributes the unknown classification rather than a coerced zero, and no CPU-shaped or other process-shaped fact enters any evaluation | F-4, F-2, NFR-2, DEC-1 |
| AC-F5-1 | **Given** a lane whose heartbeat has stopped beyond the stall threshold with a corroborating flat artifact trail and no active park of any cause, **when** the supervision battery runs, **then** the lane is recorded as parked through the delivered park machinery with the classified supervised-stall cause and a non-null re-entry instant, and the delivered `lanes show` read reports the lane's state as parked with the classified reason and the active park's re-entry instant — the board shows a parked lane, not a healthy one; and **given** the same corroborated stall over a lane whose session is actively held, **then** the durable park record carries the intent immediately and the run reports the action as the declared safe-boundary park intent, with zero session effect and no process signalled, so the operator-visible outcome (parked state, classified reason, non-null re-entry instant) is identical to the unheld case | F-5, DM-2, DM-3, NFR-1, DEC-2, DEC-9 |
| AC-F6-1 | **Given** live supervision claims intersecting the scope (a daemon instance claim live under the delivered heartbeat-staleness fold, a coordinator ledger-lease claim, or a live per-ref lease naming its holder), **when** the battery runs, **then** the report data carries every claim with its tri-state and holder whether or not any action is refused; an action that would double-claim a ref with a live holder is refused with the holder named through the delivered single-flight identity; an action whose object another supervision authority is actively acting on is refused with the duplicate-supervision identity naming the live claim and holder, the acting evidence being the delivered `daemon.preemption` pending record within the imported corroboration bound (record-only detection, DEC-9(c)), and that run projects the failure envelope at exit `1` while a run whose actions all succeed (or need none) reports data at exit `0` even with live claims present; a live resident daemon's existence alone refuses nothing; a supervised-stall park intent, including its safe-boundary intent path, is refused by neither identity and lands through the delivered fenced append; no delivered lock, lease, or single-flight mechanism changes, and no lane composition is required | F-6, F-8, DEC-3, DEC-7, DEC-8, DEC-9 |
| AC-F7-1 | **Given** a stalled lane whose restart budget is not exhausted, **when** restart admission is consulted, **then** the restart rides the delivered budget and resume economics and appends the delivered restart record; and **given** budget exhaustion, **then** the delivered terminal exhaustion record lands and the typed question is raised — exhaustion never silently requeues, an unevaluable admission is reported as the declared unavailable outcome, and no process is ever signalled | F-7, DEC-7 |
| AC-F8-1 | **Given** the closed error-table union, **when** the supervise domain kind joins it, **then** exactly two identities are appended (the duplicate-supervision refusal at exit `1`, retryable; the evidence-absent unknown answer at exit `2`, retryable), every other outcome reuses a delivered identity, no delivered row changes, and the machine rows, documented rows, and corpus are bound in both directions by the delivered binding check | F-8, DM-1, DEC-6 |

Traceability to the ticket and milestone seeds: ticket AC ("a stuck supervisor is detected by artifact evidence, not process state") → AC-F3-1, reinforced by AC-F2-1 and AC-F6-1; milestone seed SC-M2-S2-01 → AC-F1-1; milestone seed SC-M2-S2-02 → AC-F5-1. Ticket tasks map: tri-state status → F-2/AC-F2-1; progress watchdogs → F-4/AC-F4-1; duplicate-supervisor detection → F-6/AC-F6-1; lying-liveness signals by artifact evidence → F-3/AC-F3-1; restart policies over the resident dispatch daemon → F-7/AC-F7-1; supervisor battery and the stall park → F-1, F-5/AC-F1-1, AC-F5-1.

## 18. ROLLOUT & CHANGE MANAGEMENT (HIGH-LEVEL)

- Delivered through the standard change lifecycle: a feature branch per the naming convention, phased per the change plan, with a pull request targeting the integration branch and merge authority resting with the CEO (the PR is left open at delivery).
- The change is additive with no migration and no flag: the battery exists beside the delivered surfaces and nothing delivered changes behavior. Adoption is an operator habit, not a cut-over; the backlog planning truth (story markers/status) is maintained per convention during delivery.
- The battery becomes useful immediately against the delivered ledger: no resident daemon is required for the fold, and a resident daemon's existence enriches the report with live claim evidence and refuses nothing by itself — parks and other battery actions are never gated by daemon presence (DEC-8).

## 19. DATA MIGRATION / SEEDING (IF APPLICABLE)

None. No stored-record migration: the additions are one closed-set cause value, one additive lane-projection field, and one new report payload. Pre-change records replay unchanged; reads of records without the new cause treat its absence as a classified absence, never a default.

## 20. PRIVACY / COMPLIANCE REVIEW

None. The battery reads local delivery state only; its report carries refs, holders, record instants, tri-states, and evidence codes — no personal data, no message content, no credentials. No new network egress exists.

## 21. SECURITY REVIEW HIGHLIGHTS

- **Refusal hardening is the security posture**: duplicate-supervision refusal and per-ref single-flight reuse reduce the double-act damage window (double-parks, double-restarts) that concurrent supervisors create.
- **No privilege or surface expansion**: the battery adds no network listener, no credential path, no tracker or VCS write, and never signals a process.
- **Lock and lease tokens stay out of payloads**: the report names holders and claim identities, never lock tokens — mirroring the delivered daemon envelope rule that the lock token appears only in the declared control payloads and durable records.
- **Evidence is bounded and code-shaped**: every evidence field respects the delivered evidence caps and names refs, record kinds, instants, and codes, keeping the report non-load-bearing for injection-shaped content.

## 22. MAINTENANCE & OPERATIONS IMPACT

- **Parity obligations**: the battery consumes the daemon's record folds, the watchdog's classification, and the queue's closed vocabularies; changes to any of those hand off through the same change lifecycle (tune related surfaces together), and the battery's structure coverage pins the vocabularies it depends on.
- **Documentation reconciliation at phase 7**: author the first `supervise` feature page (first-spec-only rule); reconcile the watchdog page's boundary text (it currently names supervise out of scope there — the consumption relationship in DEC-1 is the reconciliation), the resident-daemon page's supervise-only notes and declared residuals, and keep the entrypoint-delta planning truth distinct from current truth.
- **Operational load**: none added — the battery is operator-invoked, leaves the delivered cadences untouched, and its only durable writes ride the delivered fenced paths.
- **Composition proof obligation**: every composed-production closure the battery rides — the park write port, restart admission, and the exhaustion/question raise — must be exercised by at least one acting-run case over a real temporary checkout; behaviour harnesses consume the shared production closure factory rather than re-implementing it, so injected-port fakes can never stand in for the composed path and a production drift cannot stay green (F-4 consumption discipline; review iteration 2 F-4).

## 23. GLOSSARY

| Term | Definition |
|------|------------|
| Supervisor battery | The operator-invoked `supervise` run: one fold, one report, declared actions (F-1) |
| Tri-state | The closed classification set `progressing` / `stalled` / `unknown` (DEC-5) |
| Artifact evidence | Durable state-ledger records plus the artifact trail they reference; the only classification input (DEC-4) |
| Lying liveness | Claimed or recorded aliveness contradicted by a flat artifact trail across the observation span (F-3) |
| Supervision claim | A durable assertion that something supervises: a daemon instance claim, a coordinator ledger-lease claim, or a live per-ref lease (F-6); claims are report evidence — they always classify and name holders in the report data, and only an authority actively acting over a targeted action's object triggers the duplicate-supervision refusal (DEC-8) |
| Duplicate supervisor | Another supervision authority actively acting over the same object a battery action targets; that acting action is refused with the live claim and holder named — a live resident daemon's mere existence is report enrichment, never a gate, and a park intent is a non-claiming action (F-6, DEC-8) |
| Supervised-stall park | A park record carrying the declared `liveness-stall` cause with a non-null re-entry instant, appended through the delivered park machinery (F-5, DM-2) |
| Safe-boundary park intent | The declared action a supervised-stall park reports when the target lane's session is actively held: the durable park record is written immediately as the intent carrier, with zero session effect and zero signals, and the held session observes it at its own next boundary (F-5, DEC-9(b)) — the operator-visible outcome is the same parked state, classified reason, and non-null re-entry instant |
| Corroboration bound | The delivered stall bound (300,000 ms heartbeat age) combined with zero artifact progress — the only `stalled` combination (NFR-1) |
| Holder | The recorded holder of a live lease; present exactly when a live lease exists, never inferred |
| Unknown | The classified answer when artifact evidence is absent; never a guessed verdict (the signals-absent discipline) |
| Supervise-only mode | The delivered daemon composition fact: the resident daemon family runs without a lane composition (DEC-1 boundary) |

## 24. APPENDICES

### Appendix A — Traceability matrix

| Source | Requirement | Delivered by |
|--------|-------------|--------------|
| Ticket task: supervisor battery | F-1 | AC-F1-1 |
| Ticket task: tri-state status | F-2 | AC-F2-1 |
| Ticket task: progress watchdogs | F-4 | AC-F4-1 |
| Ticket task: duplicate-supervisor detection | F-6 | AC-F6-1 |
| Ticket task: lying-liveness signals by artifact evidence | F-3 | AC-F3-1 |
| Ticket task: restart policies over the resident dispatch daemon | F-7 | AC-F7-1 |
| Ticket AC: stuck supervisor detected by artifact evidence, not process state | F-3 (with F-2, F-6) | AC-F3-1, AC-F2-1, AC-F6-1 |
| Seed SC-M2-S2-01 (per-repository liveness report) | F-1 | AC-F1-1 |
| Seed SC-M2-S2-02 (stall park with classified reason and until) | F-5 (with DM-2, DM-3) | AC-F5-1 |

### Appendix B — Sources

- Backlog story M2-S2 and Epic M2 framing: `doc/planning/oss-tooling/backlog.md` (the delivery unit is the repository; projects and workspaces are later M2 stories).
- Milestone pack: `doc/planning/oss-tooling/milestones/m2/` — test scenarios (SC-M2-S2-01/02) and the story-to-artifact map ("none in this pack" for architecture flow and contract surface; this spec is the surface's first home).
- System truth consumed: the watchdog and lane contracts feature page (including its section 2.2 consumer note and section 3.6 checks-not-runner boundary), the resident dispatch daemon feature page (single-instance lock, supervision cycle, reconciliation, single-flight, safe-boundary preemption, GH-241 consumption, supervise-only production composition), the scheduling engine feature page (lanes, leases, fenced claim path), and the delivered lane projection with its closed state, cause, and reason vocabularies.

## 25. DOCUMENT HISTORY

| Version | Date | Author | Changes |
|---------|------|--------|---------|
| 1.0 | 2026-11-16 | @spec-writer (GLM-5.3-Flash) | Initial specification from PM clarify_scope context (ticket GH-295, backlog story M2-S2, M2 pack seeds, delivered-system anchors) |
| 1.1 | 2026-11-16 | @spec-writer (GLM-5.3-Flash) | GAP-T1 resolution (test-plan author, reopened by PM): DEC-8 declares the duplicate-supervision refusal's guarded object (authority actively acting, daemon presence never a gate), the per-action projection rule (claims ride data; refusal envelope only on a run with a refused action), and the non-claiming park intent (parks land through the delivered fenced append); targeted edits to F-6, F-8, G-5, AC-F6-1, DEC-6, §6 Flow 4, §18, §23 glossary |
| 1.2 | 2026-11-17 | @spec-writer | Delivery-time amendments from review iteration 1 (F-1 critical, F-2 high, F-4 high): DEC-9 records four delivery-time resolutions — (a) `liveness-stall` is battery-written only with the operator path refused by name, (b) the durable park record is the safe-boundary intent carrier reported as `safe-boundary-park-intent`, (c) the `daemon.preemption` pending record is the acting-authority artifact class, (d) the single fold covers the action path; targeted edits to F-2, F-5, F-6, NFR-4, AC-F5-1, AC-F6-1, and the §23 glossary (safe-boundary park intent) |
| 1.3 | 2026-11-17 | @spec-writer | Post-review iteration 2 amendments (F-1v2 critical, F-2 high, F-3/F-4 medium): DEC-9 gains (e) the park-state interaction rule (a supervised-stall park is appended only when no active park of any cause exists; restart admission stays liveness-stall-only) and (f) question idempotence (raise only on an appended exhaustion record or a ref+type dedupe; the run id is metadata, never question identity), and (d)/NFR-4 are restated as a precise read discipline (one decision fold per run; append-path read-then-verify and at most one blocker-ledger read are bounded per-append costs, not a total of one); F-5 states the park gate, AC-F5-1 gains the matching "no active park of any cause" precondition, and §22 adds the composition proof obligation (acting-run case over the shared production closure factory) |

---

## AUTHORING GUIDELINES

- Authored by `@spec-writer` from the PM's clarify_scope output only: the ticket (GH-295, milestone M2, label change), backlog story M2-S2, the M2 pack seeds (SC-M2-S2-01/02, story-to-artifact map), and the delivered-system anchors named in the planning summary (watchdog lane contracts, resident daemon, scheduling engine, lanes surface, queue park machinery). Nothing was invented beyond the declared reconciliation decisions.
- The five PM watch-items are resolved deliberately and recorded in the Decision Log: DEC-1 (naming boundary: consumption, not duplication), DEC-2 (park-reason naming reconciliation against the delivered closed vocabularies), DEC-3 (duplicate-supervisor detection composing with delivered single-flight/lease semantics, no new record kind), DEC-4 (artifact evidence defined concretely vs process signals), DEC-5 (tri-state set and its derivation source). DEC-6 and DEC-7 fix exit truthfulness and the never-signal discipline; DEC-8 (from the test-plan author's GAP-T1) fixes the duplicate-supervision refusal's guarded object, its per-action projection rule, and the non-claiming park intent that keeps AC-F5-1 reachable.
- Tech-neutral by intent: the spec names contracts, vocabularies, and observable surfaces, never file paths or implementation steps; exact payload wiring, condition-mapping mechanics, and test wiring are left to the plan and test plan.
- The one deliberately deferred decision is OQ-1 (durable supervision-claim record for cross-battery concurrency), declared non-blocking with its residual carried by RSK-2.

## VALIDATION CHECKLIST

- [x] `change.ref` matches provided `workItemRef` (GH-295)
- [x] `owners` has at least one entry ([engineering])
- [x] `status` is "Proposed"
- [x] `milestone` is the tracker milestone title verbatim, equal to the pm-notes value ("M2: Ceremonies, measurement, and memory")
- [x] All sections present in order (1-25 + guidelines + checklist)
- [x] ID prefixes consistent and unique (F-1..F-8, DM-1..DM-4, EVT-1, NFR-1..NFR-7, RSK-1..RSK-6, DEC-1..DEC-9, OQ-1, G-1..G-7, AC-*)
- [x] Acceptance criteria use Given/When/Then and each references at least one F-/DM-/NFR-/DEC- ID
- [x] NFRs include measurable values (300,000 ms bound, 200-lane cap, 5,000 ms latency, one-read fold, two identities, zero process-derived fields)
- [x] Risks include Impact and Probability (H/M/L) with mitigation and residual risk
- [x] Ticket AC and both milestone seeds traceable to ACs (Appendix A + §17 traceability paragraph)
- [x] Out-of-scope items prefixed [OUT]
- [x] No implementation details (no code file paths, no step-by-step tasks, no gate commands)
- [x] Front matter validates per the front-matter rules (ref, owners ≥ 1, status Proposed, milestone verbatim)
