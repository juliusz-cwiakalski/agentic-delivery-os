---
change:
  ref: GH-235
  type: feat
  status: Proposed
  slug: session-lifecycle-economics
  title: "M1-S15: Session lifecycle economics"
  owners: [engineering]
  service: delivery-os session lifecycle core (liveness signal sourcing, restart budget, resume economics)
  labels: [change, m1]
  version_impact: minor
  audience: internal
  security_impact: low
  risk_level: medium
  dependencies:
    internal: [watchdog-lane-contracts, harness-adapters, result-contract, error-table, state-layer, config-layer, branding-seam]
    external: []
---

# CHANGE SPECIFICATION

> **PURPOSE**: Kill the resume-loop amplification class — the operator's largest measured token-waste incident — by sourcing progress-based liveness signals at the harness-adapter level so a prefilling or resuming session is never killed as stalled, classifying resume economics so a restart either continues without re-paying prefill or is refused with a reason, and bounding restarts with a durable budget that fails loudly at exhaustion instead of looping silently.

## 1. SUMMARY

Deliver session lifecycle economics for delivery lanes. Liveness gains real signal sources: heartbeat age, session traffic, and token delta are sourced at the harness-adapter level and wired into the delivered watchdog liveness probe, so `stalled` and `progressing` become reachable through evidence — and a large prefilling or resuming session, whose token delta and traffic are rising, always classifies `progressing` and is never killed (SC-M1-14). Resume economics classify every restart path: a resumed session attaches and continues without re-paying its prefill where the harness declares the capability, otherwise the restart path is classified uneconomical and refused with a reason. A bounded restart budget — durable in state, consumed by every resume path, daemon or one-shot alike — refuses a restart past its bound with a classified, loud terminal state carrying the restart history, so exhaustion escalates instead of silently requeuing (SC-M1-15's economics side). Lane status data gains the per-delivery restart count and the resume-amplification signal, derivable from durable records alone and feeding spend (M1-S19). The machine surface stays inside the existing v1 envelope, `{0, 1, 2}` exit taxonomy, and closed error table: a sourced stalled outcome gains its declared identity (GAP-T2), and budget exhaustion and uneconomical resume adopt the dispatch contract's proposed identities.

## 2. CONTEXT

### 2.1 Current State Snapshot

The watchdog liveness contract is delivered (GH-221, M1-S1): the verdict vocabulary `ok | refused | stalled | progressing`, the declared signal shape `heartbeatAgeMs` / `tokenDelta` / `traffic` with no CPU field, the 5-minute stall-corroboration heartbeat bound, and the classified `watchdog.signals-absent` answer (exit `2`, unknown — never guessed). The production edge wires **zero** signal sources, so every production liveness run classifies `watchdog.signals-absent`; `stalled` and `progressing` are declared but unreachable. The harness adapter seam is delivered (GH-233, M1-S11, this branch's base): opencode sources session-traffic and process liveness with worktree activity declared as a gap; Claude Code declares all liveness kinds as gaps; a harness-neutral liveness assembly produces one entry per closed signal kind with explicit absence reasons, and a consumer-side bridge projects it into the watchdog signal shape — currently projecting only session traffic, because heartbeat and token-delta sources are not yet adapter-sourced. The delivery-result vocabulary carries the `max-restarts` token (dispatch-session derivation class), and the error table carries the `watchdog` domain kind with its three identities. The state layer's additive record-kind pattern (append-only, schema-versioned, no migration) is established and proven by several delivered consumers. No restart budget, no resume-economics classification, no restart event record, and no amplification derivation exists — this change is greenfield on that surface. Operator evidence ranks the resume-loop amplification class (R5) as the largest measured token-waste incident class.

### 2.2 Pain Points / Gaps

- Production liveness always answers "unknown": with no signal sources wired, a stalled lane cannot be distinguished from a progressing one, so no stall response is evidence-based.
- A large session that is resuming — prefill in progress, token delta and traffic rising — is exactly the session a naive liveness reading kills as stalled; nothing structurally prevents that misclassification today once sources are wired naively.
- Resume loops re-pay prefill: every naive restart of a large session re-reads its context at full token cost, and nothing measures, classifies, or refuses that amplification.
- Restarts have no budget: nothing bounds how many times a delivery restarts, exhaustion is not a classified terminal state, and nothing fails loudly — a degraded delivery can loop silently, re-paying prefill each cycle.
- A sourced `stalled` outcome has no declared error identity (GAP-T2 from the delivered watchdog contracts), so the machine representation of the stall verdict is undefined.
- Lane status cannot expose restart counts or an amplification signal because the underlying data is not produced or made durable anywhere.

## 3. PROBLEM STATEMENT

Because liveness has no sourced progress signals, resume paths re-pay prefill without an economics check, and restarts run without a durable budget or a classified exhaustion state, a degraded or interrupted delivery can loop through restarts that re-pay its prefill every cycle — the operator's largest measured token-waste incident class — while a stalled lane is indistinguishable from a progressing one and an exhausted lane never fails loudly enough for the queue, the coordinator, or the operator to act.

## 4. GOALS

- **G-1**: Progress-based liveness is real: heartbeat age, session traffic, and token delta are sourced at the harness-adapter level and wired into liveness evaluation; CPU is never a signal, and a genuinely source-less lane still classifies `watchdog.signals-absent` rather than guessing.
- **G-2**: A prefilling or resuming session is never killed as stalled: rising token delta or traffic always classifies `progressing` (SC-M1-14), and a `stalled` verdict requires the full declared corroboration.
- **G-3**: Resume economics classify every restart path: attach-and-continue without re-paying prefill where the capability is declared; a restart path that re-pays prefill is evaluated economically and refused with a classified reason when uneconomical.
- **G-4**: The restart budget is bounded, durable, and universal: exhaustion is a classified, loud terminal state (never a silent loop), consumed by every resume path — daemon-style and one-shot alike — with the restart history attached for escalation.
- **G-5**: The restart count and the resume-amplification signal are derivable per delivery from durable records alone, ready for lane status rendering and for spend (M1-S19) — without re-querying harness stores.
- **G-6**: The machine surface stays closed and bound: the sourced stall verdict, budget exhaustion, and uneconomical resume each have exactly one classified identity in the error table, projected through the v1 envelope and the `{0, 1, 2}` exit taxonomy; liveness evaluation cadence and the budget bound are configuration with declared defaults.

### 4.1 Success Metrics / KPIs

| Metric | Target |
|--------|--------|
| Prefilling or resuming sessions misclassified as stalled (SC-M1-14 fixtures) | 0 |
| Stall verdicts derived from fewer than all three declared signals corroborating | 0 |
| CPU-derived liveness signals | 0 — the declared shape has no CPU field |
| Restarts past budget that proceed, or resume paths diverging on budget consumption | 0 |
| Silent outcomes at budget exhaustion (no classified reason, no history, silent requeue) | 0 |
| Per-delivery restart count and amplification reconstructible from state alone | 100% |
| New outcomes exiting outside `{0, 1, 2}` or emitting an invalid envelope | 0 |
| Existing error-table rows modified | 0 |

### 4.2 Non-Goals

- **NG-1**: Queue-entry failed-marking at exhaustion (M1-S17) — it consumes this change's terminal record; the marking itself is out of scope.
- **NG-2**: Typed question publication, answering, and coordinator delivery (M1-S16) — exhaustion's data is what the question will carry; the channel is out of scope.
- **NG-3**: The daemon, its collection cycle, heartbeat cadence to state, and live escalation delivery (M1-S18) — the budget is durable and consumable daemon-down; the daemon is a later consumer.
- **NG-4**: The dispatch command surface and its `dispatch.session.spawn-failed` identity (M1-S9), and the `lanes`/`queue` status rendering surfaces (M1-S17/S18) — they consume the economics substrate delivered here.
- **NG-5**: Spend rendering of amplification (M1-S19) — derivability per delivery is the goal; the spend command is a later consumer.
- **NG-6**: Session spawn, kill, or steer execution mechanics — this change classifies, records, and refuses; it does not add execution paths to any surface.
- **NG-7**: Expanding harness capabilities: worktree-activity sourcing remains the declared opencode gap, and Claude Code's liveness gaps remain gaps — absent sources classify unknown, never guessed.
- **NG-8**: State schema-version changes or migrations; the watchdog's stall-corroboration bound, verdict vocabulary, and signal keys are reused unchanged.

## 5. FUNCTIONAL CAPABILITIES

| ID | Capability | Rationale |
|----|------------|-----------|
| F-1 | Adapter-level progress-signal sourcing (heartbeat age, session traffic, token delta) | Liveness must be evidence-based; sourcing at the adapter level keeps per-harness quirks out of shared classification. |
| F-2 | Prefill/resume liveness safety (SC-M1-14) | The costliest failure is killing a large resuming session; the corroboration rule plus sourced token delta makes that misclassification structurally impossible. |
| F-3 | Resume economics classification (attach-and-continue vs. uneconomical refusal) | A resume must either continue without re-paying prefill or be refused with a reason; never silently re-pay. |
| F-4 | Bounded, durable restart budget with classified loud exhaustion | Restarts must be finite, terminal at exhaustion, and identical for every resume path; silence is the defect class. |
| F-5 | Sourced stalled verdict identity (GAP-T2 resolution) | A sourced stall needs exactly one machine representation so consumers act without re-deriving. |
| F-6 | Per-delivery restart count and resume-amplification derivation | Lane status and spend consume the amplification data; it must come from durable records, not harness re-query. |
| F-7 | Configuration ownership: liveness interval and restart budget | The milestone contracts assign this story the key, default, and semantics; the budget bound is policy-as-data. |

### 5.1 Capability Details

- **F-1 — Adapter-level signal sourcing**: the harness adapter seam sources the three declared progress signals where the harness supports them: heartbeat age, session traffic, and token delta, extracted read-only from harness-local facts the adapters already reach. Sourcing declares no CPU field — a CPU-only reading can never satisfy the declared shape, and CPU is never blended in as a substitute. The neutral liveness assembly and its watchdog bridge carry the sourced values so the liveness evaluation sees populated signal keys where sources exist; a signal without a source stays absent (never zero), and a lane whose harness declares the liveness kinds as gaps still classifies `watchdog.signals-absent` — unknown, never guessed.
- **F-2 — Prefill/resume liveness safety**: the delivered corroboration rule is preserved and now operates on sourced signals: `stalled` requires a heartbeat age at or beyond the declared stall bound **and** a token delta of zero **and** zero traffic. A session that is prefilling or resuming has rising token delta and/or traffic, so it classifies `progressing` regardless of how large it is or how long the prefill takes — no kill, no restart event, lane state unchanged. Any partial reading (some signals absent, some progressing) classifies `progressing`; only the full zero-progress corroboration classifies `stalled`.
- **F-3 — Resume economics classification**: every resume path evaluates economics before re-entry. Where the harness adapter declares the resume/attach capability, the resumed session attaches to its existing session and continues without re-paying its prefill (the existing session identity persists; no new session tree root). Where the only available restart path re-pays prefill (for example, a harness without attach-continue whose fallback is prompt re-entry), the path is evaluated economically against the delivery's session evidence: if it is uneconomical it is refused with `dispatch.resume-uneconomical`, exit `1`, naming the reason and the measured or expected prefill re-pay. Refusal is classified and evidence-bearing, never a silent re-pay and never a guessed verdict.
- **F-4 — Bounded durable restart budget**: each delivery carries a bounded restart budget (configuration, default 3). Every consumed restart appends a durable restart event record — ordinal, classified reason, and the prefill re-pay delta it paid — under the single-writer state contract, so the count and history survive processes and are consumable by any path. A restart attempt past the budget is refused before any spawn: `dispatch.restart-budget-exceeded`, exit `1`, classified reason plus the full restart history in evidence, and a terminal exhaustion record lands durably. The budget gate is the one seam every resume path composes — daemon-style supervision and one-shot resume alike — so a one-shot resume past the budget is refused with the same classified reason as a supervised one; exhaustion never silently requeues, and the terminal record carries everything the queue-marking (M1-S17), typed-question (M1-S16), and daemon (M1-S18) consumers need.
- **F-5 — Sourced stalled verdict identity (GAP-T2)**: a signal-corroborated `stalled` outcome is a classified refusal, not a success payload: exit `1` with the new identity `watchdog.liveness-stalled` on a failure envelope, no `data.verdict` value, and the corroborating signal evidence carried on the failure — per the exclusive `data`/`error` contract and the refusal-semantics pin (exit `1`, never exit `0` silence, never exit `2` which is reserved for source-unavailable). `progressing` remains a success verdict (`data.verdict`, exit `0`); `watchdog.signals-absent` remains the exit-`2` unknown answer.
- **F-6 — Restart count and amplification derivation**: from the durable restart records alone — no harness re-query — a per-delivery view yields the restart count, the restart history (ordinal, reason, per-restart re-pay), and the resume-amplification signal: tokens paid across restarts versus unique progress, approximately 1 for healthy deliveries, flagged by name where a restart loop amplified. This is the data the dispatch envelope declares (`restarts`, `resumeAmplification`), lane status renders (M1-S17/S18), and spend consumes (M1-S19).
- **F-7 — Configuration ownership**: the typed configuration surface gains the lane branch this story owns per the milestone timing defaults: `lane.liveness-interval`, default 30 seconds — the cadence at which lane liveness is evaluated — and `lane.restart-budget`, default 3 restarts per delivery. Unknown keys, wrong types, and invalid values reuse the existing configuration identities; an absent branch resolves to the shipped defaults.

## 6. USER & SYSTEM FLOWS

```
Flow 1 — Liveness evaluation on sourced signals (SC-M1-14)
  Liveness evaluates a lane at the configured cadence
  ├─ sources present, prefill/resume in progress
  │    (rising token delta or traffic, maybe no output yet)
  │      → progressing · exit 0 · no kill · lane keeps delivering
  ├─ sources present, heartbeat age ≥ bound AND tokenDelta 0 AND traffic 0
  │      → stalled · exit 1 · watchdog.liveness-stalled · evidence carries the signals
  │        → budget-governed restart response (Flow 3); never a silent kill
  └─ sources absent (harness declares gaps, e.g. Claude Code)
       → watchdog.signals-absent · exit 2 · "unknown, never guessed" · no stall response

Flow 2 — Resume economics decision
  A delivery session needs (re)entry after interruption
  ├─ adapter declares attach-continue
  │      → session attaches and continues · prefill NOT re-paid · no restart ordinal consumed
  └─ only re-entry re-pays prefill (prompt re-entry fallback, no attach capability)
       → economics evaluated against session evidence
       ├─ economical (within budget) → proceed · restart event records the re-pay delta
       └─ uneconomical → refused · dispatch.resume-uneconomical · exit 1 · reason + re-pay named

Flow 3 — Restart budget lifecycle (SC-M1-15 economics side)
  Restart N of budget (N ≤ budget)
  → budget gate admits → restart event appended durably (ordinal, reason, re-pay delta)
  Restart attempt N+1 past budget
  → budget gate refuses BEFORE any spawn
  → dispatch.restart-budget-exceeded · exit 1 · reason + full restart history in evidence
  → terminal exhaustion record lands durably (classified, history attached)
  → no further spawn on ANY path (daemon-style or one-shot: same gate, same reason)
  → escalation data ready: queue marking (M1-S17), typed question (M1-S16),
    daemon delivery within one collection cycle (M1-S18) consume it — never a silent requeue

Flow 4 — Downstream consumption (outside this change)
  lanes/queue (M1-S17/S18) render restart count + amplification;
  spend (M1-S19) derives per-delivery amplification from the records;
  dispatch (M1-S9) emits the refusal identities and the envelope data fields.
```

## 7. SCOPE & BOUNDARIES

### 7.1 In Scope

- Adapter-level sourcing of heartbeat age, session traffic, and token delta (opencode-supported; declared gaps stay declared), carried through the neutral liveness assembly into liveness evaluation; no CPU field anywhere in the signal shape.
- Wiring the delivered watchdog liveness probe to sourced signals, flipping `stalled`/`progressing` from unreachable to evidence-reachable, with `watchdog.signals-absent` preserved for genuinely absent sources.
- Prefill/resume liveness safety: the corroboration rule over sourced signals so a prefilling or resuming session never classifies stalled (SC-M1-14).
- Resume economics classification: attach-and-continue without prefill re-pay where the capability is declared; uneconomical restart paths refused with `dispatch.resume-uneconomical` and a named reason.
- The bounded restart budget: durable restart event records, a terminal exhaustion record with restart history, the shared budget gate consumed by every resume path, and the loud `dispatch.restart-budget-exceeded` refusal — including the loud one-shot refusal past budget.
- GAP-T2 resolution: the `watchdog.liveness-stalled` identity for a sourced stalled outcome, with exit mapping `1`.
- Per-delivery restart count, restart history, and resume-amplification derivation from durable records alone.
- Error-table additions: the additive `dispatch` domain kind with exactly the two economics identities, and the fourth `watchdog` identity; no existing row changes.
- Configuration: the lane branch with `lane.liveness-interval` (default 30 s) and `lane.restart-budget` (default 3), keys, defaults, and semantics owned by this story per the milestone timing-defaults contract.

### 7.2 Out of Scope

- [OUT] Queue-entry failed-marking at exhaustion (M1-S17) — consumes this change's terminal record.
- [OUT] Typed question publication, answer routing, and coordinator delivery (M1-S16) — consumes the terminal record's data.
- [OUT] The daemon, its collection cycle, heartbeat cadence to state, reconciliation, and live escalation delivery (M1-S18) — SC-M1-15's escalation side lands there; the budget and records it consumes land here.
- [OUT] The dispatch command surface and `dispatch.session.spawn-failed` (M1-S9); the `lanes`/`queue` status rendering surfaces (M1-S17/S18).
- [OUT] Spend command rendering of the amplification metric (M1-S19) — derivability only.
- [OUT] Session spawn, kill, or steer execution mechanics in any surface.
- [OUT] Worktree-activity sourcing (declared opencode gap) and any Claude Code capability expansion — declared gaps remain gaps.
- [OUT] State schema-version bumps, migrations, or changes to the watchdog's stall bound, verdict vocabulary, or signal keys.
- [OUT] Bash-era stack changes or parity claims.

### 7.3 Deferred / Maybe-Later

- Worktree-activity as a fourth corroborating source, if its opencode gap is later closed.
- Daemon-side heartbeat cadence feeding the heartbeat-age signal (M1-S18 composes it with this change's sourcing).
- Finer capture points for economics evidence (phase boundaries, session end) beyond closeout, per the harness-telemetry concept's open questions.
- Cross-harness amplification aggregation refinements for multi-harness workspaces.

## 8. INTERFACES & INTEGRATION CONTRACTS

### 8.1 REST / HTTP Endpoints

None. This change adds no command surface; its semantics ride the existing v1 envelope contract of the owning commands later (dispatch, watchdog liveness, daemon). The outcome-to-exit-to-identity mapping is contract data delivered here so every consumer projects identically:

| Outcome | Identity | Exit |
|---|---|---|
| Progressing (sourced signals, any prefill/resume activity) | — (`data.verdict: "progressing"`) | `0` |
| Stalled (sourced, fully corroborated) | `watchdog.liveness-stalled` (failure envelope, no `data.verdict`) | `1` |
| Signal sources absent | `watchdog.signals-absent` (unchanged) | `2` |
| Restart within budget | restart event recorded (success-path data) | per owning surface |
| Restart past budget | `dispatch.restart-budget-exceeded` (reason + history in evidence) | `1` |
| Resume path uneconomical | `dispatch.resume-uneconomical` (reason + re-pay named) | `1` |

### 8.2 Events / Messages

No external event bus. The durable record kinds below are the event surface, appended to the state ledger under the established single-writer, fenced, verified-append, no-migration pattern:

| Record | Purpose |
|--------|---------|
| Restart event | One per consumed restart: work item, run, session, ordinal, classified reason, prefill re-pay delta. Append-only; the budget count and history fold from verified records. |
| Budget exhaustion | Terminal, per delivery: classified reason (`dispatch.restart-budget-exceeded`), full restart history reference. The escalation payload M1-S16/S17/S18 consume. |

### 8.3 Data Model Impact

| ID | Element | Description |
|----|---------|-------------|
| DM-1 | Sourced signal carriage | The neutral liveness report carries sourced heartbeat-age and token-delta entries alongside session traffic (closed kinds, explicit absence reasons); the watchdog bridge projects all three declared keys, absent keys staying absent (never zero). |
| DM-2 | Restart event record | Additive state record kind: ordinal, classified restart reason, session identity, prefill re-pay delta (token classes), timestamps. No schema-version bump. |
| DM-3 | Budget exhaustion record | Additive terminal state record kind: classified exhaustion reason and the delivery's restart history reference. No schema-version bump. |
| DM-4 | Per-delivery economics view | Rebuildable fold of DM-2/DM-3: restart count, restart history, resume-amplification signal (tokens paid vs. unique progress). |
| DM-5 | Error-table rows | Additive `dispatch` domain kind with `dispatch.restart-budget-exceeded`, `dispatch.resume-uneconomical`; additive `watchdog.liveness-stalled` under the existing `watchdog` kind. Category, retryability, consequence, remediation hint, projection class per the existing row schema. No existing row changes. |
| DM-6 | Configuration keys | `lane.liveness-interval` (default 30000 ms — the lane liveness evaluation cadence) and `lane.restart-budget` (default 3 restarts per delivery), validated with the existing configuration identities. |

### 8.4 External Integrations

None new. Signal sourcing reads harness-local stores read-only (the established read-only, bounded-query guardrails apply); no tracker, provider, network, or vendor API is contacted, and nothing mutates a live session.

### 8.5 Backward Compatibility

Additive only: new error-table kind and rows appended to the closed union, new state record kinds inside the existing state schema, a new configuration branch, and sourcing wired where adapters support it. One intended behavioral flip: liveness through a sourced lane now returns evidence-based `progressing`/`stalled` instead of always `watchdog.signals-absent`; lanes whose sources are absent keep the exit-`2` unknown answer, unchanged. Existing domain kinds, rows, verdict vocabulary, signal keys, stall bound, envelope shape, exit digits, and stored records are untouched; no migration is required.

## 9. NON-FUNCTIONAL REQUIREMENTS (NFRs)

| ID | Requirement | Threshold |
|----|-------------|-----------|
| NFR-1 | Prefill/resume misclassification: prefilling or resuming fixtures (rising token delta/traffic) classifying `stalled`; kills of a resuming session | 0 / 0 — SC-M1-14 holds over the fixture matrix |
| NFR-2 | CPU-derived liveness signals; verdicts emitted from absent sources | 0 / 0 — absence stays `watchdog.signals-absent` |
| NFR-3 | Restart-past-budget outcomes that proceed; resume paths diverging on budget consumption (daemon-style vs. one-shot) | 0 / 0 — one gate, one reason, every path |
| NFR-4 | Silent exhaustion outcomes (no classified reason, no history, silent requeue); fourth spawn past a 3-of-3 budget | 0 / 0 |
| NFR-5 | Per-delivery restart count and amplification reconstructible from state alone | 100% — no harness re-query |
| NFR-6 | Envelope validity: new outcomes emitting anything but exactly one valid envelope; exits outside `{0, 1, 2}` | 0 / 0 |
| NFR-7 | Evidence totality: stall, budget, and uneconomical-refusal outcomes without non-empty evidence naming signals/reason/history | 0 |
| NFR-8 | Error-table binding: new rows round-tripping with their documented rows; existing rows modified | 4/4 / 0 |
| NFR-9 | Tier and brand conformance: product/binary literals in the new surface; contracts carrying behavior or I/O; per-harness logic outside the adapter seam | 0 / 0 / 0 |

## 10. TELEMETRY & OBSERVABILITY REQUIREMENTS

The restart event and exhaustion records are the observability substrate: restart counts, per-restart re-pay deltas, and the amplification signal become durable, queryable data instead of lost session state, so the largest token-waste incident class is measurable per delivery. Every refusal (stall, budget, uneconomical) carries evidence naming the signals, the reason, and the history; economics figures degrade, never fabricate — a missing cost or token figure renders null with a warning, never a zero or an estimate. No new metrics, tracing, or alerting infrastructure is introduced.

## 11. RISKS & MITIGATIONS

| ID | Risk | Impact | Probability | Mitigation | Residual Risk |
|----|------|--------|-------------|------------|---------------|
| RSK-1 | Naive sourcing misreads a large prefilling/resuming session as stalled and kills it — the exact defect this change exists to prevent | H | M | The corroboration rule requires zero token delta AND zero traffic; rising delta classifies `progressing` regardless of prefill duration; SC-M1-14 fixtures assert no kill, no restart event | L |
| RSK-2 | Sourcing is too noisy in the other direction: real stalls read as progressing (low token traffic) and are never flagged | M | M | The declared stall bound and corroboration rule are the delivered contract; evidence on every verdict makes misclassification diagnosable; the bound stays configuration-adjacent for tuning without vocabulary change | M |
| RSK-3 | A resume path composes around the budget gate (undiscovered path re-spawns past budget) — the silent loop survives | H | L | The budget gate is the single shared seam with the exhaustion record as its truth; conformance coverage exercises supervised-style and one-shot-style consumption; later consumers (M1-S16/S18) inherit the gate by contract, and the terminal record makes any bypass visible in state | M |
| RSK-4 | Uneconomical-resume refusal over-refuses restarts that would have succeeded (availability lost for economics) | M | M | Attach-continue is preferred wherever the capability is declared; the refusal names measured/expected re-pay evidence; refusal is a recorded decision, not a destructive act — a fresh-budget requeue path remains available to the coordinator | L |
| RSK-5 | New `dispatch` kind and row naming drifts from the milestone dispatch contract, forking the identity later consumers emit | M | M | The dispatch contract's proposed codes are adopted verbatim; the two-way table-sync binding keeps machine and documented rows aligned | L |
| RSK-6 | Amplification derivation misattributes re-pay to the wrong delivery (session tree attribution errors) | M | L | Re-pay deltas are recorded at restart time against the delivery's own session identity, using the established work-item attribution rules; unattributable evidence classifies rather than fabricates | L |

## 12. ASSUMPTIONS

- The delivered watchdog liveness contract (verdict vocabulary, signal keys, stall bound, corroboration rule) is reused unchanged; only sourcing and the stalled identity are added.
- The harness adapter seam's capability declarations are the authority on which resume/liveness operations a harness supports; declared gaps are respected as gaps.
- The state layer's additive record-kind pattern (fenced verified append, verified reads, no schema bump) is available and is the durable home for restart records.
- The restart budget counts restarts per delivery (work item), not per session or per process, so daemon restarts and one-shot resumes consume one shared budget.
- The milestone timing-defaults contract assigns this story `lane.liveness-interval`; the budget default of 3 follows the seeded scenario's 3-of-3 arithmetic.
- The v1 envelope, the closed error table, the `{0, 1, 2}` projection, and the branding seam remain the machine surface this change builds on.

## 13. DEPENDENCIES

| Direction | Item | Notes |
|-----------|------|-------|
| Depends on | M1-S1 watchdog and lane contracts (GH-221, delivered) | The liveness probe, verdict vocabulary, signal shape, and `watchdog.signals-absent` this change sources and extends. |
| Depends on | M1-S11 harness adapters (GH-233, delivered; branch base) | The adapter seam, capability declarations, neutral liveness assembly, and read-only store access that source the signals. |
| Depends on | Result and error-table contracts | The closed union, row schema, envelope, and exit taxonomy that receive the new identities. |
| Depends on | State layer | Durable, fenced, additive record kinds for restart events and exhaustion. |
| Depends on | Configuration layer | The typed lane branch for the two keys. |
| Blocks | M1-S16 typed blocker and question channel (GH-230) | Exhaustion's classified reason and history feed the coordinator question. |
| Blocks | M1-S17 queue and lanes | Failed-marking at exhaustion and lane-status rendering of restart count and amplification. |
| Blocks | M1-S18 daemon (and SC-M1-15's escalation side) | Reconciliation consumes the durable budget; exhaustion delivery lands within one collection cycle there. |
| Blocks | M1-S9 dispatch engine | Emits the budget/economics refusal identities and the `restarts`/`resumeAmplification` envelope fields. |
| Blocks | M1-S19 spend (and M1-S23) | Per-delivery amplification derivation feeds spend; M1-S23 is unblocked per the ticket. |

## 14. OPEN QUESTIONS

None at specification time. The design points reserved for this change — GAP-T2's machine representation of a sourced stalled outcome, the budget's durable persistence shape, and the exact classified codes for exhaustion and uneconomical resume — are resolved in-spec as DEC-1, DEC-3, and DEC-2 within the contracts corridor (v1 envelope, `{0, 1, 2}` taxonomy, refusal semantics), per the clarification record; they are confirmed at the PR review gate like any other decision.

## 15. DECISION LOG

| ID | Decision | Rationale | Date |
|----|----------|-----------|------|
| DEC-1 | GAP-T2 resolved: a sourced `stalled` outcome is a classified refusal — new identity `watchdog.liveness-stalled` under the existing `watchdog` domain kind, failure envelope with no `data.verdict`, exit `1`, corroborating signals in evidence | The delivered verdict/exit matrix reserves exit `1` for stall; the exclusive `data`/`error` contract pins negative verdicts to refusal identities (established GAP-T5/PIN-1 precedent); a stable identity lets the restart consumer and coordinator act without re-deriving; exit `2` stays reserved for source-unavailable, exit `0` silence is barred by the refusal pin | 2026-11-07 |
| DEC-2 | Budget exhaustion and uneconomical resume adopt the dispatch contract's proposed codes verbatim — `dispatch.restart-budget-exceeded`, `dispatch.resume-uneconomical` — under a new additive `dispatch` domain kind introduced by this change; `dispatch.session.spawn-failed` stays with the dispatch command story (M1-S9) | The milestone dispatch contract is the cross-story identity baseline; this change owns the economics substrate those codes name; introducing the kind here means the dispatch command and daemon consume the same identities instead of re-deriving; spawn-failure classification is not an economics concern and remains with its owning story | 2026-11-07 |
| DEC-3 | The restart budget persists as additive append-only state records — one restart-event record per consumed restart plus one terminal exhaustion record — folded into a rebuildable per-delivery economics view; no schema-version bump | The established state-layer pattern (proven by several delivered record kinds) gives durability across processes, the history the terminal state must carry, and daemon-down consumption by one-shot paths for free; a lane-record field would bind the budget to a record whose lane semantics belong to later stories and would not carry history | 2026-11-07 |
| DEC-4 | A prefilling or resuming session is structurally unable to classify stalled: `stalled` requires the full corroboration (heartbeat age ≥ bound AND token delta 0 AND traffic 0) over sourced values; any rising delta or traffic classifies `progressing`; `signals-absent` never triggers a stall response (unknown is never acted on as stall) | Pinned ticket decision and SC-M1-14; the rule extension is sourcing, never corroboration weakening — killing the largest resuming session is the costliest failure in the class | 2026-11-07 |
| DEC-5 | The budget bound and the liveness cadence are configuration: `lane.restart-budget` default 3 per delivery, `lane.liveness-interval` default 30 s | The milestone timing defaults assign this story the key, default, and semantics; the 3-of-3 arithmetic in the seeded scenario fixes the budget default; policy-as-data keeps bounds tunable without vocabulary change | 2026-11-07 |
| DEC-6 | CPU is never a liveness signal: sourcing declares only heartbeat age, session traffic, and token delta; no CPU field enters the shape or the sources | Pinned ticket decision; the declared signal shape already excludes CPU, and sourcing must not smuggle it back in | 2026-11-07 |
| DEC-7 | Resume economics preference order: attach-continue (declared capability) is the economical path and consumes no restart ordinal; a re-entry that re-pays prefill consumes an ordinal and is admitted only within budget; past-budget refusal (`dispatch.restart-budget-exceeded`) evaluates before economics, so a past-budget attempt is refused with the budget reason, and a within-budget uneconomical path is refused with `dispatch.resume-uneconomical` | The ticket's "attach and continue without re-paying prefill, or classified uneconomical and refused" ordering; two distinct reasons keep the operator's remediation exact (fresh budget vs. capability/harness change); precedence keeps the terminal budget state unambiguous | 2026-11-07 |

## 16. AFFECTED COMPONENTS (HIGH-LEVEL)

| Component | Impact |
|-----------|--------|
| Core contracts tier | Updated — error-table additions (`dispatch` kind + two rows; `watchdog.liveness-stalled`), budget/economics contract data, sourced-signal carriage, and the two configuration keys. |
| Core domain tier | New — pure restart-budget evaluation, resume-economics classification, and amplification fold. Updated — liveness assembly bridge carrying all three sourced keys. |
| Adapters tier | Updated — heartbeat-age and token-delta sourcing for the supporting harness; declared capability gaps unchanged and respected. |
| State tier | New — additive restart-event and budget-exhaustion record kinds with verified append/read; no schema-version change. |
| Configuration layer | New — the lane branch (two keys, shipped defaults, existing validation identities). |
| Branding seam | Consumed, unchanged. |
| System documentation | Updated at the documentation-sync phase — watchdog/lane contracts (sourced signals, GAP-T2 resolution), harness adapters (out-of-scope note update), result contract and error table (new rows), configuration layer (lane keys), state layer (record kinds), plus a feature spec for session lifecycle economics. |

## 17. ACCEPTANCE CRITERIA

- **AC-F1-1 — Adapter-level sourcing feeds all three declared signal keys.**
  **Given** a lane whose harness supports liveness sourcing, **when** liveness evaluation runs, **then** heartbeat age, session traffic, and token delta are sourced at the adapter level and populate the declared signal keys; a signal without a source stays absent (never zero), and no CPU-derived value enters the shape or the evaluation.
  *DoD predicate*: sourced fixtures populate exactly the declared keys; absence fixtures carry absence reasons; a structure assertion shows no CPU field anywhere. *Traceability*: F-1, NFR-2, DEC-6.

- **AC-F1-2 — Source-less lanes keep the classified unknown answer.**
  **Given** a lane whose harness declares the liveness kinds as gaps, **when** liveness evaluation runs, **then** it classifies `watchdog.signals-absent` (exit `2`, no verdict value, evidence stating the answer is unknown) — never a guessed or CPU-substituted verdict, and never a stall response.
  *DoD predicate*: gap-declared fixtures yield the exact code and exit `2`; no verdict key is produced. *Traceability*: F-1, NFR-2.

- **AC-F2-1 — A large resuming session is never killed as stalled (SC-M1-14).**
  **Given** a large session resuming with prefill in progress — rising token delta, traffic present, no phase output yet — **when** liveness evaluates, **then** the sourced progress signals classify the lane `progressing` (exit `0`), no kill and no restart event occur, and the lane state remains delivering.
  *DoD predicate*: prefill/resume fixtures over size and duration variations classify `progressing` with zero restart events; the ticket's "large resuming session not killed" holds. *Traceability*: F-2, NFR-1, DEC-4.

- **AC-F2-2 — Stall requires the full corroboration; partial readings progress.**
  **Given** sourced signal combinations, **when** liveness evaluates, **then** `stalled` classifies only when heartbeat age is at or beyond the declared bound **and** token delta is zero **and** traffic is zero; any partial or progressing combination classifies `progressing`, and a corroborated stall carries the signals as evidence.
  *DoD predicate*: the corroboration matrix classifies exactly per the rule; every `stalled` outcome carries non-empty signal evidence. *Traceability*: F-2, F-5, NFR-1, NFR-7.

- **AC-F3-1 — Attach-and-continue resumes without re-paying prefill.**
  **Given** a delivery whose harness adapter declares the resume/attach capability, **when** the session resumes, **then** it attaches to the existing session and continues without re-paying its prefill — the session identity persists, no new session tree root is created, and no restart ordinal is consumed.
  *DoD predicate*: resumed fixtures show unchanged session identity, no re-pay delta recorded, no restart event appended. *Traceability*: F-3, DEC-7.

- **AC-F3-2 — A within-budget uneconomical restart path is refused with a reason.**
  **Given** a restart path whose only re-entry re-pays prefill (no attach capability) and whose economics classify it uneconomical while within budget, **when** the resume path evaluates, **then** it is refused with `dispatch.resume-uneconomical` (exit `1`), the evidence names the reason and the measured or expected prefill re-pay, and no session is spawned.
  *DoD predicate*: the fixture yields the exact code and exit `1` with re-pay evidence; zero spawns occur on refusal. *Traceability*: F-3, NFR-7, DEC-7.

- **AC-F4-1 — A restart within budget is admitted and recorded durably.**
  **Given** a delivery at restart N within its budget, **when** a restart is admitted, **then** a restart event record lands durably — ordinal N+1, classified reason, session identity, and the prefill re-pay delta it paid — and the budget count and history fold from verified records.
  *DoD predicate*: ordinal increments exactly once per restart; records survive a process boundary; replay reconstructs the same count and history. *Traceability*: F-4, F-6, NFR-5, DEC-3.

- **AC-F4-2 — A restart past the budget fails loudly with the classified reason visible on the status data surface.**
  **Given** a delivery whose restart budget is exhausted, **when** the next restart is attempted, **then** the attempt is refused before any spawn with `dispatch.restart-budget-exceeded` (exit `1`), the evidence carries the classified reason and the full restart history, a terminal exhaustion record lands durably, and the reason and restart count/history are carried on the outcome and records that lane status renders — with no silent requeue and no further spawn on any path.
  *DoD predicate*: a 3-of-3 fixture yields no fourth spawn, the exact code and exit `1`, history-bearing evidence, and the terminal record; the ticket's "fails loudly with a classified reason visible in lane status" holds at the data surface (rendering itself is M1-S17/S18). *Traceability*: F-4, F-5, NFR-3, NFR-4, DEC-2.

- **AC-F4-3 — Budget exhaustion is durable and consumed by every resume path identically.**
  **Given** a delivery past its budget, **when** a daemon-style supervised resume path and a one-shot resume path each attempt re-entry, **then** both are refused by the same budget gate with the same classified reason and history — and a one-shot resume past the budget is refused with the same classified reason as the supervised one.
  *DoD predicate*: supervised-style and one-shot-style path fixtures produce identical refusal identity, evidence fields, and zero spawns; cross-path divergence is zero. *Traceability*: F-4, NFR-3, DEC-3.

- **AC-F4-4 — The terminal state is escalation-ready data, not silence.**
  **Given** a budget exhaustion, **when** the terminal record lands, **then** it carries the classified reason and the restart history reference — everything the queue marking (M1-S17), the typed question (M1-S16), and the collection-cycle delivery (M1-S18) consume — and nothing in this change silently requeues the delivery.
  *DoD predicate*: terminal-record field assertions cover reason and history; a post-exhaustion replay shows no automatic re-entry; the downstream consumers' required fields are present. *Traceability*: F-4, NFR-4.

- **AC-F5-1 — A sourced stalled outcome has exactly one machine identity (GAP-T2).**
  **Given** a fully corroborated sourced stall, **when** the verdict is produced, **then** it exits `1` with `watchdog.liveness-stalled` on a failure envelope carrying no `data.verdict` value, with the corroborating signals in evidence — and `progressing` remains a success verdict (exit `0`) while `watchdog.signals-absent` remains exit `2`.
  *DoD predicate*: stall fixtures project the exact identity and exit; the envelope is exclusive; the exit matrix over all fixture classes matches the contract table. *Traceability*: F-5, NFR-6, NFR-8, DEC-1.

- **AC-F6-1 — Restart count and amplification are derivable per delivery from state alone.**
  **Given** a delivery's durable restart records, **when** the per-delivery economics view is derived, **then** the restart count, restart history, and the resume-amplification signal (tokens paid vs. unique progress) reconstruct with no harness re-query, in the shape the dispatch envelope declares and spend consumes.
  *DoD predicate*: reconstruction over recorded fixtures matches 100%; missing economics figures degrade to null-with-warning, never a fabricated zero. *Traceability*: F-6, NFR-5.

- **AC-F7-1 — The lane configuration keys own their defaults and semantics.**
  **Given** the delivered configuration surface, **then** `lane.liveness-interval` defaults to 30 seconds and governs the lane liveness evaluation cadence, `lane.restart-budget` defaults to 3 restarts per delivery and governs the budget gate; unknown keys, wrong types, and invalid values reuse the existing configuration identities.
  *DoD predicate*: default-resolution assertions (absent branch → defaults with `defaults` origins); invalid-value fixtures classify with the existing identities. *Traceability*: F-7, DEC-5.

## 18. ROLLOUT & CHANGE MANAGEMENT (HIGH-LEVEL)

Single feature delivery on the change branch, additive and self-contained; no migration, flag, or consumer coordination is required. Delivery order follows the established tier sequence — contract data and error-table rows first, then pure domain classification (budget, economics, amplification), then adapter sourcing and state records, then configuration, then documentation sync — with each new error-table row and its documented row landing in the same phase. The behavioral flip (sourced lanes answer `progressing`/`stalled` instead of always `signals-absent`) is the story's purpose and is covered by the SC-M1-14 guarantee. Later stories (M1-S9, M1-S16, M1-S17, M1-S18, M1-S19, M1-S23) adopt the substrate; nothing consumes it beyond this change's own outputs here.

## 19. DATA MIGRATION / SEEDING (IF APPLICABLE)

None. The new record kinds are additive inside the existing state schema with no schema-version bump; no stored-record format changes; no seeding beyond test fixtures.

## 20. PRIVACY / COMPLIANCE REVIEW

No privacy or compliance implications. Signal sourcing and economics records carry numeric statistics and identity references only — session identity, token-class counts, ordinals, timestamps — never prompt text, conversation content, transcripts, diffs, or credential material, consistent with the delivered telemetry guardrails. Refusal evidence names refs, ids, counts, and reasons; sourcing reads harness stores strictly read-only.

## 21. SECURITY REVIEW HIGHLIGHTS

- The budget gate is fail-closed: an unevaluable budget state refuses rather than admits, and a past-budget attempt is refused before any spawn.
- Sourcing is read-only toward harness-local stores under the established bounded-query guardrails; it never mutates or locks a live session.
- Refusal evidence and records never carry secrets; economics figures are counts and token classes, not content.
- No new privileges, no network, and no process execution beyond the tooling's own local read operations.

## 22. MAINTENANCE & OPERATIONS IMPACT

Operators gain the missing controls for the largest token-waste incident class: restarts become finite and visible, exhaustion becomes a classified terminal state with history, and amplification becomes a per-delivery number instead of an anecdote. Maintenance cost: four new error-table rows join the two-way table-sync obligation (one additive domain kind — a coordinating surface for the dispatch and daemon stories); the restart record kinds become the durable truth later consumers read, so changes after this story are coordinating changes; and the sourced-signal bridge becomes the reference point per-harness sourcing extends. The lane configuration keys join the typed configuration surface with their defaults documented at the config layer.

## 23. GLOSSARY

| Term | Definition |
|------|------------|
| Prefill | The early phase of a (re)started session that consumes context before producing output; must never read as stalled and is the dominant cost of a naive restart. |
| Attach-and-continue | Resume where the session reattaches to its existing context without re-paying prefill; the economical resume path. |
| Resume-prompt re-entry | The acknowledged fallback resume that restarts the prompt and re-pays prefill; its cost is visible and economics-eligible. |
| Restart budget | The bounded, durable per-delivery count of consumed restarts; exhaustion is terminal and classified. |
| Restart event record | The durable record of one consumed restart: ordinal, reason, session identity, prefill re-pay delta. |
| Budget exhaustion | The terminal classified state at which the budget gate refuses every further resume path with `dispatch.restart-budget-exceeded`. |
| Resume amplification | Per-delivery tokens paid across restarts versus unique progress; approximately 1 for healthy deliveries; feeds spend (M1-S19). |
| Heartbeat age | Elapsed time since the lane's last sourced progress heartbeat; stall candidacy requires it at or beyond the declared bound. |
| Corroboration rule | The delivered classifier rule: `stalled` requires heartbeat age at/over the bound AND token delta 0 AND traffic 0; anything less is `progressing`. |
| Signals-absent | The classified "unknown" answer when no declared signal source is available; never guessed, never a stall trigger. |
| GAP-T2 | The reserved decision from the watchdog contracts: the machine representation of a sourced stalled outcome — resolved here as DEC-1. |
| Economics classification | The resume-path evaluation that admits attach-and-continue, admits within-budget re-entry, and refuses uneconomical paths with a reason. |

## 24. APPENDICES

**A. Source map**

| Source | Role |
|--------|------|
| Ticket GH-235 (pinned decisions binding) | Goal, tasks, AC, pinned liveness/budget/amplification decisions, unblocks |
| Backlog M1-S15 entry | Canonical scope and AC wording |
| M1 contracts page — shared contracts, dispatch, watchdog, daemon, blockers, spend, timing defaults | Refusal semantics, envelope, exit taxonomy, proposed dispatch codes, `lane.liveness-interval` ownership |
| M1 test scenarios SC-M1-14, SC-M1-15 | Seed scenarios inherited and extended; SC-M1-15's escalation side is (M1-S15 + M1-S18) |
| Feature spec: watchdog and lane contracts | Delivered liveness contract, GAP-T2 reservation, zero-source state |
| Feature spec: harness adapters | Adapter capability/gap declarations, liveness assembly, read-only telemetry guardrails |
| Concept: harness telemetry | Extraction/persistence guardrails for economics data |
| pm-notes (clarify_scope) | Dependency verification, scope boundary split, doc-impact anticipation, GAP-T2 delegation |

**B. Outcome / identity / exit matrix (new semantics)**

| Outcome | Identity | Exit | Pre-change behavior |
|---|---|---|---|
| Progressing (sourced; includes any prefill/resume activity) | — (`data.verdict`) | `0` | unreachable (always signals-absent) |
| Stalled (sourced, fully corroborated) | `watchdog.liveness-stalled` | `1` | unreachable (GAP-T2 open) |
| Sources absent | `watchdog.signals-absent` | `2` | unchanged (was the only answer) |
| Restart within budget | restart event recorded | per owning surface | no budget existed |
| Restart past budget | `dispatch.restart-budget-exceeded` | `1` | unbounded, silent |
| Resume path uneconomical | `dispatch.resume-uneconomical` | `1` | unclassified re-pay |

## 25. DOCUMENT HISTORY

| Version | Date | Author | Changes |
|---------|------|--------|---------|
| 1.0 | 2026-11-07 | spec-writer | Initial specification from ticket GH-235, backlog M1-S15, milestone contract pack, delivered watchdog/harness contracts, and clarify_scope decisions |

---

## AUTHORING GUIDELINES

Authored from the ticket (goal, tasks, AC, three pinned decisions), the backlog M1-S15 entry (canonical scope), the M1 contracts page (shared refusal semantics and envelope, dispatch's proposed budget/economics codes, watchdog liveness probe, daemon reconciliation budget language, spend amplification, timing defaults assigning `lane.liveness-interval`), the seed scenarios SC-M1-14/SC-M1-15 (inherited, extension boundary respected: SC-M1-15's escalation side is M1-S15 + M1-S18), the delivered watchdog-lane and harness-adapter feature specs (including GAP-T2's reservation and the capability/gap declarations), the harness-telemetry concept (economics data guardrails), and the clarify_scope pm-notes (dependency verification, greenfield confirmation, scope split, in-spec design delegation). The GAP-T2 resolution, budget persistence shape, and error-code choices are recorded as decisions with rationale rather than left open, per the clarification record; the corridor (v1 envelope, `{0, 1, 2}` taxonomy, refusal semantics, closed error table, additive state kinds) is reused unchanged. No behavior beyond the pinned sources is asserted; consumption-side rendering and escalation delivery are stated as later-story boundaries, not as evolution.

## VALIDATION CHECKLIST

- [x] `change.ref` matches provided `workItemRef` (GH-235)
- [x] `owners` has at least one entry
- [x] `status` is "Proposed"
- [x] All sections present in order (1-25 + guidelines + checklist)
- [x] ID prefixes consistent and unique (F-, DM-, NFR-, RSK-, DEC-, AC-; no OQ required)
- [x] Acceptance criteria reference at least one F-/NFR-/DEC- ID and use Given/When/Then
- [x] NFRs include measurable values
- [x] Risks include Impact & Probability
- [x] No implementation details (no file-level code paths, no step-by-step tasks)
- [x] No content duplicated from linked docs
- [x] Front matter validates per front_matter_rules
