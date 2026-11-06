---
change:
  ref: GH-229
  type: feat
  status: Proposed
  slug: owner-gate-sla
  title: "M1-S5: Owner-gate SLA — aging into escalation or a recorded default, never silence"
  owners: [engineering]
  service: delivery-os
  labels: [m1, owner-gates, sla, board]
  version_impact: minor
  audience: internal
  security_impact: medium
  risk_level: medium
  dependencies:
    internal:
      - "Status digest tracker collector (M0-S6, GH-175) — owner hand-backs, owner-attention labels, updatedAt ranking"
      - "State layer — append-only ledger for the default-application decision record"
      - "Result contract and error table — CommandResult envelope, declared failure identities, exit projection"
      - "Verify gates binary owner-gate definition (delivered) — shared owner-gate population; this change creates the initial gate-kind/classification as contract data, reconciled and extended at M1-S4 (GH-225)"
      - "Queue-ready `no-owner-gate` condition — shared owner-gate definition"
      - "Branding seam — binary name from configuration, no product literals"
    external:
      - "GitHub tracker (normalized work items incl. provider-native updatedAt, per ADR-0004)"
---

# CHANGE SPECIFICATION

> **PURPOSE**: Give owner gates a service-level agreement so an open owner ask ages deterministically into escalation or a pre-agreed, recorded default decision — never silence — and never idles the fleet on an unanswered question.

## 1. SUMMARY

This change delivers the M1-S5 owner-gate SLA: owner gates (open work items carrying the declared owner-attention labels `hand-back` and `human-input-needed`) age under a pinned SLA — escalation at 24 hours, a default decision at 72 hours — with exactly one pre-agreed default per gate kind/class, held as policy-as-data. Default application is never silent: it is recorded as an auditable decision event naming the gate, the default, and the time, and it never auto-proceeds on never-merge gate classes. The `board` command (v0, per the M1 planning pack) is the SLA surface: an aging grid where every gate carries id, kind, ref, age, SLA state (`fresh`, `escalated`, `default-applied`), the applied default if any, and the waiver authorizer if any. The escalation mechanism is designed from day one as one mechanism with two audiences (owner and coordinator), so the typed blocker channel (M1-S16, GH-230) can reuse it without redesign; only the owner audience ships here.

## 2. CONTEXT

### 2.1 Current State Snapshot

- The status digest (M0-S6, GH-175, closed 2026-10-31) already surfaces owner hand-backs as a tracker family: open items carrying a declared owner-attention label, matched case-insensitively, ranked oldest provider-native `updatedAt` first, capped at four rendered items. The owner-attention label set and the 14-day stall threshold are contract data, not configuration keys.
- The owner-gate concept is already defined twice more: `queue ready` evaluates a `no-owner-gate` readiness condition over the same labels, and `verify gates` evaluates a binary `owner-gate` merge gate (fails while the labels are present). Three surfaces agree on what an owner gate is — but the delivered verify-gates gate is a binary presence check with no gate-kind or class vocabulary, and none of the surfaces answers how old a gate is or what happens when the owner does not respond.
- The state layer provides the append-only, schema-versioned JSONL ledger, verified reads, verified-empty evidence, torn-state classification, single-writer fences, and atomic derived-document replace — the substrate for durable, auditable records.
- The result contract provides the `CommandResult` envelope, the machine-readable error table with two fallback containment entries, and the CLI-only `{0, 1, 2}` exit projection. ADR-0003 fixes package placement and tier rules; ADR-0004 fixed the work-item activity-timestamp semantics (optional provider-native `updatedAt`, absent means activity unknown, never fabricated).
- The M1 planning pack designates `board` as the owner-gate SLA surface ("M1 planned (M1-S5). Proposed contract."): owner gates age under the SLA — 24 h stale-review escalation, 72 h default-on-expiry with one pre-agreed default per gate, silence impossible. The full fleet grid arrives at M2-S4 sharing this state source; the brief (M1-S6) renders owner-gate ages from the same collector state.

### 2.2 Pain Points / Gaps

- **No aging**: the tracker collector ranks owner hand-backs by age but attaches no consequence to age; a hand-back from three weeks ago renders identically to one from three hours ago (modulo sort order).
- **No escalation**: nothing marks a stale owner ask as stale, so the coordinator cannot distinguish "asked this morning" from "the fleet has been idle on this for days".
- **No default decision**: if the owner never answers, nothing happens — the gate blocks `queue ready` and `verify gates` indefinitely. The fleet idles on an unanswered ask.
- **No gate-kind classification**: no delivered surface distinguishes gate kinds or classes; the never-merge vs. owner-review-first classification this SLA needs does not exist yet and is created by this change as contract data (per PDR-0003), with M1-S4 (GH-225) as its reconciliation point.
- **No SLA visibility surface**: there is no command whose job is the gate aging picture; the four-item tracker family cap hides most gates, and no surface carries per-gate SLA state.
- **No auditable default path**: because defaults do not exist, there is no recorded-evidence trail for what was decided, when, and for which gate — the precondition for ever trusting automation near owner authority.

## 3. PROBLEM STATEMENT

Because owner gates carry no service-level agreement — no aging computation, no escalation on staleness, no default decision on expiry, and no SLA visibility surface — the fleet idles indefinitely on an unanswered owner ask, the coordinator cannot tell a fresh ask from a stale one, and silence is indistinguishable from a healthy quiet world, resulting in blocked ready-work, stalled close items, and owner attention that arrives (if at all) without any evidence trail of what was waited on, for how long, and what was decided about it.

## 4. GOALS

- **G-1**: Every owner gate older than the SLA ages into escalation or a proceed decision — never silence (ticket acceptance criterion).
- **G-2**: At most one pre-agreed default exists per gate kind/class, held as inspectable policy-as-data; no default is ever invented at runtime, and a gate without a pre-agreed default keeps escalating.
- **G-3**: Default application is auditable: a recorded decision event with evidence (which gate, which default, when), persisted in durable state and readable later.
- **G-4**: Never-merge gate classes are never auto-proceeded by the SLA; the recorded waiver with a proper authorizer remains the only override path.
- **G-5**: The `board` command v0 is the owner-gate SLA surface: an aging grid with per-gate SLA state, declared collector unavailability, and bounded deterministic output.
- **G-6**: The escalation mechanism is audience-parameterized (owner | coordinator) so the typed blocker channel (M1-S16) reuses one mechanism for two audiences; only the owner audience is delivered here.

### 4.1 Success Metrics / KPIs

| Metric | Target |
|--------|--------|
| Owner gates older than 24 h rendered as `escalated` on the board | 100% (zero silent stale gates) |
| Owner gates older than 72 h in `default-applied` (pre-agreed default + record) or persistently `escalated` (no pre-agreed default) | 100% (zero silent expired gates) — governs gates in defaultable classes; see the v0 exercisability note below |
| Default applications carrying a complete audit record (gate id, default, application time) | 100% |
| Auto-proceed decisions applied to never-merge gate classes | 0 |
| Collector-unavailable board runs | 100% declared with the collector-unavailable identity, exit 2, zero fabricated gates |
| Gates whose age is unknown (absent activity timestamp) surfaced visibly | 100% (never rendered as fresh or zero) |

> **v0 exercisability note:** until M1-S4 (GH-225) delivers the gate-kind mapping and waiver recording, every real tracker-observed gate maps to kind `owner-review` (non-defaultable), so real-data default application is expected to be zero and the `default-applied` metrics above are exercised over injected/factory facts only. Persistent escalation of every real gate is the expected v0 posture — the metrics are scoped to defaultable classes, not vacuously satisfiable against real data.

### 4.2 Non-Goals

- **NG-1**: Building the typed blocker channel or its coordinator-audience flows (M1-S16, GH-230) — only the audience seam is designed here.
- **NG-2**: Consuming the SLA aging inputs in the owner brief (M1-S6, GH-228 — still open); the brief renders `aging[]` in its own change.
- **NG-3**: The full fleet board grid (lanes, gates, owner asks, parked work on one screen) — M2-S4, sharing this state source.
- **NG-4**: Enforcing waiver authorizer policy at merge time — that is the merge transaction's verification (M1-S4, GH-225); this change renders `waivedBy` and records decisions, it does not police merges.
- **NG-5**: Push notification, email, chat, or any out-of-band alert delivery — escalation is visible on the declared SLA surface, not broadcast.
- **NG-6**: New configuration keys for SLA thresholds or defaults — they are contract data, not operator-tunable config.

## 5. FUNCTIONAL CAPABILITIES

| ID | Capability | Rationale |
|----|------------|-----------|
| F-1 | Owner-gate SLA aging computation | The SLA needs one pinned, truthful clock per gate before any consequence can be attached. |
| F-2 | 24 h stale-review escalation | A stale owner ask must be visibly escalated so the coordinator and owner see aging, not silence. |
| F-3 | 72 h default-on-expiry with one pre-agreed default per gate | An expired ask must resolve into a pre-agreed decision — the fleet never idles forever on silence. |
| F-4 | Auditable default-application record | A proceed decision made without the owner must carry recorded evidence of what, when, and for which gate. |
| F-5 | Never-merge class protection | Owner authority over never-merge classes must never be bypassed by an automatic proceed. |
| F-6 | Never-silence guarantee (declared unavailability and unknown age) | Silence is impossible: missing evidence is declared, never rendered as fresh, zero, or all-clear. |
| F-7 | `board` command v0 as the SLA surface | Aging needs a dedicated, bounded, deterministic surface per the planning pack contract. |
| F-8 | Escalation audience seam (owner vs. coordinator) | One mechanism, two audiences: M1-S16 must reuse the escalation mechanism without redesign. |

### 5.1 Capability Details

- **F-1 — Owner-gate SLA aging computation.** For every open work item carrying a declared owner-attention label (the shared owner-gate definition used by the tracker collector, `queue ready`, and `verify gates`), the mechanism computes the gate's age from the pinned clock source (DEC-1): the provider-native work-item activity timestamp per ADR-0004 — the same signal the tracker collector already ranks owner hand-backs by. Age is derived only from a present, parseable timestamp against an injected clock; an absent or unparseable timestamp yields an unknown age that is declared visibly and never fabricated (DEC-6). Gates are identified by gate id, gate kind, and work-item ref. Evaluation is over open items only (delivery state neither done nor canceled), mirroring the tracker collector's owner hand-back family.

- **F-2 — 24 h stale-review escalation.** A gate whose observed age crosses the 24-hour escalation threshold takes SLA state `escalated` and remains escalated on every subsequent evaluation until the gate resolves (label removed, item closed) or a default is applied at expiry. Escalation is derived state recomputed per evaluation — no background timer is required — and it is conservative: escalation is visibility, never a decision.

- **F-3 — 72 h default-on-expiry.** A gate whose observed age crosses the 72-hour expiry threshold takes SLA state `default-applied` if and only if its gate kind/class declares exactly one pre-agreed default and the class permits a proceed decision (F-5). The default is applied as the gate's proceed decision and named on the gate record. Pre-agreed defaults are policy-as-data: one default per gate kind/class, held in the contracts tier following the status-digest thresholds precedent (DEC-2) — for example, a waiver-class gate's pre-agreed default may be `owner-review-first`, per the planning pack's board example. A gate with no pre-agreed default never receives an invented one: its escalation continues past expiry, permanently visible (never silence, never a fabricated decision). In v0 this consequence is exercisable only over injected or factory facts: with the delivered tracker slice every observed gate maps to kind `owner-review` (non-defaultable per DEC-10), so real-data defaulting stays at zero until M1-S4 (GH-225) delivers the gate-kind mapping and waiver recording.

- **F-4 — Auditable default-application record.** Every default application persists an append-only decision event in the state layer (EVT-1, DM-2) carrying: the gate id, the gate kind and work-item ref, the applied default, the application timestamp, and the evidence context (threshold crossed, clock source). The record is readable later through verified reads. Application is idempotent by gate identity: a re-evaluation after application honors the existing record and applies nothing new (NFR-7). A default application is a recorded decision, never a merge execution — the merge transaction stays an explicit coordinator action.

- **F-5 — Never-merge class protection.** This change creates the owner-gate classification as contract data (never-merge classes vs. owner-review-first classes, per PDR-0003/DEC-10) — no delivered surface distinguishes gate kinds today: the delivered verify-gates gate is a binary presence check over the owner-attention labels. M1-S4 (GH-225, merge and verify-deploy engine including waiver recording) is the reconciliation point where the classification is reconciled and extended; until then the owner-review↔never-merge mapping stands as PDR-0003 records it — an assumption (PDR-0003 revisit trigger #2). The SLA mechanism never auto-applies a proceed default to a never-merge class: an expired never-merge gate continues in `escalated`, indefinitely and visibly. The only override for such a class remains a recorded waiver authored by a principal authorized for the class — the presence of expiry is never sufficient authority. A waiver-class gate's pre-agreed proceed default (e.g. `owner-review-first`) reclassifies the gate's proceed posture; it does not authorize a merge.

- **F-6 — Never-silence guarantee.** Every failure to observe is declared: a collector read that fails, is unconfigured, or is unavailable surfaces the declared `status.collector.<id>.unavailable` identity, the affected gates are not fabricated, and the run projects exit 2 (DEC-7). A gate with unknown age is listed with its unknown age declared — never rendered as fresh, never rendered as zero-age, and never eligible for default application (defaults require observed clock evidence). There is no state in which an owner gate exists but no surface shows it.

- **F-7 — `board` command v0.** The command renders the owner-gate aging grid: text mode shows the deterministic grid; machine mode returns the standard `CommandResult` envelope whose `data` carries `gates[]` with `id`, `kind` (e.g. `owner-review`, `waiver`), `ref`, `age`, `slaState` (`fresh`, `escalated`, `default-applied`), `default`, and `waivedBy` (DM-1). Exit 0 when rendered; exit 2 when collectors are unavailable (declared, never silent). Output is bounded and truncated explicitly. Render order is normative: gates are ranked deterministically — severity class first (an escalated or default-applied gate is never hidden behind a fresh one), then oldest age first, with unknown-age gates ranking with the escalated class, then gate id — and every truncation is explicitly marked on the payload (`truncated` with an `omitted` count), so clamped output can never silently drop a non-fresh gate. The command is daemon-free like the other commands; v0 is render-once — `--watch` arrives with the resident-daemon story (DEC-9). The binary name comes from the branding configuration — no product literal is committed.

- **F-8 — Escalation audience seam.** The escalation mechanism is defined over an audience dimension (owner | coordinator) from day one: aging computation, threshold evaluation, and escalation state are audience-agnostic, and the owner audience is simply the first consumer. No owner-specific assumption (labels, surfaces, routing) is baked into the mechanism itself. M1-S16 (GH-230) adds the coordinator audience for the typed blocker channel on the same mechanism; nothing in this change pre-builds M1-S16 behavior beyond the seam.

## 6. USER & SYSTEM FLOWS

```
Flow 1: an owner gate under the SLA
  owner hands work back (owner-attention label on an open item)
    → gate appears on the board: slaState fresh, age computed from the activity timestamp
    → 24 h pass unanswered → slaState escalated (stays escalated every run)
    → 72 h pass, pre-agreed default exists and class permits
        → default applied, decision event recorded → slaState default-applied
    → 72 h pass, no pre-agreed default or never-merge class
        → escalation continues, gate stays visible — never silence
    → owner answers (label removed / item closes) → gate leaves the board
```

```
Flow 2: board render
  <binary> board [--json]
    → collectors read (tracker slice over normalized work items)
    → all available: aging grid rendered, gates[] with SLA state — exit 0
    → a collector unavailable: declared status.collector.<id>.unavailable,
      no fabricated gates — exit 2
```

```
Flow 3: the audience seam (design-only here; built by M1-S16)
  same aging + escalation mechanism
    ├── audience: owner      → owner gates (this change; surfaced on the board)
    └── audience: coordinator → typed blocker channel escalations (M1-S16)
```

## 7. SCOPE & BOUNDARIES

### 7.1 In Scope

- SLA aging computation for owner gates over the pinned clock source (provider-native activity timestamp per ADR-0004), including unknown-age handling.
- 24-hour stale-review escalation as derived, persistent SLA state.
- 72-hour default-on-expiry applying exactly one pre-agreed default per gate kind/class, held as contract data (policy-as-data) with the closed gate-kind/class vocabulary.
- The persisted, readable default-application decision event (append-only, idempotent, auditable).
- Never-merge class protection: no auto-proceed; waiver-recorded override semantics respected (enforcement at merge stays with the merge story, M1-S4/GH-225).
- The never-silence behavior: declared collector unavailability (`status.collector.<id>.unavailable`, exit 2), declared unknown age, declared truncation.
- The `board` command v0 (text aging grid + machine envelope `gates[]`) with exit 0 rendered / 2 collectors unavailable, deterministic render ordering (severity class → oldest age → gate id; unknown age ranking with the escalated class), and explicit truncation marks that never hide an escalated gate behind a fresh one; registered where the other top-level commands are composed.
- The escalation-mechanism audience seam (owner | coordinator) as a design constraint with a testable criterion.
- The result-contract documentation of the new declared collector-unavailable identity family.

### 7.2 Out of Scope

- [OUT] Brief `aging[]` consumption — M1-S6 (GH-228, still open); the brief renders aging in its own change.
- [OUT] The typed blocker channel coordinator audience and its flows — M1-S16 (GH-230); this change designs the seam only.
- [OUT] The full fleet board grid (lanes, owner asks, parked work, one screen) — M2-S4, sharing this state source.
- [OUT] Waiver authorizer-vs-policy enforcement at merge time — owned by the merge/verify-deploy story (M1-S4, GH-225).
- [OUT] Out-of-band alert delivery (push, email, chat) for escalations.
- [OUT] New configuration keys for SLA thresholds, defaults, or gate sets — these are contract data.

### 7.3 Deferred / Maybe-Later

- Expanding the pre-agreed default map beyond the initial gate kinds (per OQ-1 sign-off), including per-gate (not per-kind) defaults if a named consumer appears.
- An explicit unknown-age SLA-state representation on the wire as a fourth `slaState` value, if the owner prefers it over DEC-8's declared-unknown-in-the-evidence-field representation (the escape hatch stays unexercised; the three-value enum holds).
- Aging surfaces beyond the board (digest family, brief) as later stories consume the same state source.
- Finer-grained activity signals (e.g. status-change time) per the ADR-0004 revisit triggers, if the last-modified clock proves too coarse for SLA fairness.

## 8. INTERFACES & INTEGRATION CONTRACTS

### 8.1 REST / HTTP Endpoints

N/A — the surface is a local CLI command, not an HTTP endpoint.

### 8.2 Events / Messages

| ID | Event | Producer | Consumer | Content |
|----|-------|----------|----------|---------|
| EVT-1 | Owner-gate default-application decision record | The SLA mechanism at expiry | Verified reads by any later surface (board, brief, retro, audit) | Gate id, gate kind, work-item ref, applied default, application timestamp, evidence context; append-only, idempotent by gate identity |

Escalation state itself is derived (recomputed from observed age per evaluation) and is not an event; only the proceed decision is recorded.

### 8.3 Data Model Impact

| ID | Element | Description |
|----|---------|-------------|
| DM-1 | Gate SLA record (board payload) | Per-gate: `id`, `kind`, `ref`, `age` (observed age or declared unknown), `slaState` (`fresh` \| `escalated` \| `default-applied`), `default` (applied default or null), `waivedBy` (authorizer principal when a waiver is recorded, else null). The `gates[]` payload is ordered by the deterministic rank key — severity class first (`escalated`/`default-applied` before `fresh`; unknown age ranks with the escalated class), then oldest age, then gate id — and render-level truncation is explicitly marked with `truncated` plus an `omitted` count, so truncation never hides an escalated gate behind a fresh one |
| DM-2 | Default-application decision event (EVT-1 payload) | Append-only ledger record: gate id, kind, ref, default, applied-at timestamp, threshold-crossing evidence |
| DM-3 | SLA policy-as-data (contract data) | Closed vocabulary: escalation threshold (24 h), expiry threshold (72 h), gate kinds (e.g. `owner-review`, `waiver`), gate classes with never-merge classification, one pre-agreed default per defaultable kind/class (e.g. `owner-review-first`), SLA-state enum |

### 8.4 External Integrations

The tracker (GitHub in the delivered read slice) is read through the existing normalized work-item view, including the provider-native activity timestamp (ADR-0004). No new external API, no write to the tracker, no new credential path.

### 8.5 Backward Compatibility

- Additive change: a new top-level command and new contract data; `status`, `queue ready`, and `verify gates` behavior is unchanged — their owner-gate definitions are reused, not altered.
- The `CommandResult` envelope schema is unchanged; the board machine payload is a new `data` shape carried in the standard envelope with a declared schema version.
- The state layer gains one new append-only record kind; no existing record kind, read, or schema version is modified.
- The documented error table gains only the declared collector-unavailable identity family used by this surface; all other failure identity is reused.

## 9. NON-FUNCTIONAL REQUIREMENTS (NFRs)

| ID | Requirement | Threshold |
|----|-------------|-----------|
| NFR-1 | Determinism: identical injected facts (collectors, clock, policy data) produce byte-identical board output in both text and machine modes | 100% byte-identical; zero run-to-run drift |
| NFR-2 | Read cost: the board reuses the delivered tracker collector reads; no pagination, no retries, no new outbound request types | ≤ the existing tracker read budget per invocation; 0 extra outbound request kinds |
| NFR-3 | Latency: pure SLA evaluation, ranking, and rendering over the capped gate set | ≤ 50 ms on the reference environment |
| NFR-4 | Bounds: rendered gates capped with explicit truncation (`+N`); machine `data` ≤ 65 536 UTF-8 bytes; human aging grid ≤ 24 lines / 4 096 UTF-8 bytes; every dropped or clamped case marked | 8 rendered gates; all bounds enforced and marked |
| NFR-5 | SLA precision: thresholds evaluated against an injected clock on every invocation; escalation at 24 h and default at 72 h exactly per the contract-data thresholds; no background timer required | 0 missed evaluations on invocation; threshold boundary semantics pinned in contract data |
| NFR-6 | Error-identity stability: new declared identities limited to the `status.collector.<id>.unavailable` family; all other failures reuse existing table rows and the two fallback entries; documented-table sync check stays green | 0 undocumented codes; 0 reused-as-class codes |
| NFR-7 | Auditability and idempotency: exactly one persisted decision record per default application; re-evaluation after application is a no-op honoring the existing record | 1 record per application; 0 duplicate records |

## 10. TELEMETRY & OBSERVABILITY REQUIREMENTS

- The standard envelope's `runId` and `timing` on every board invocation.
- Declared per-collector outcome evidence on the board surface (available vs. the named unavailability identity), so a partial picture is always distinguishable from a full one.
- Per-gate SLA state, age, applied default, and waiver authorizer — the aging grid is the observability surface for the SLA.
- The persisted decision record (EVT-1) is the durable audit trail for every automatic proceed decision.
- No telemetry exporter, event sink, background process, or alerting channel is added.

## 11. RISKS & MITIGATIONS

| ID | Risk | Impact | Probability | Mitigation | Residual Risk |
|----|------|--------|------------|------------|---------------|
| RSK-1 | A wrong default is auto-applied to an owner gate, overriding owner intent | H | L | Defaults are pre-agreed policy-as-data (owner-inspectable), one per kind/class, never invented at runtime; never-merge classes are excluded from auto-proceed; every application is recorded (EVT-1) and auditable | L |
| RSK-2 | The activity-timestamp clock over- or under-states true ask staleness (any tracker edit bumps it) | M | H | Clock source is pinned and documented (DEC-1); escalation is visibility-only so a skewed clock cannot cause a wrong decision before 72 h; expiry requires one pre-agreed default; the ADR-0004 revisit trigger covers a finer signal if fairness demands it | M |
| RSK-3 | Collector unavailability misread as "no gates" (silent all-clear) | H | L | Declared unavailability identity, exit 2, zero fabricated gates; negative-control tests assert no silent zero | L |
| RSK-4 | Gates with absent activity timestamps never age and quietly sit outside the SLA | M | M | Unknown age is declared visibly on the board, never rendered as fresh or zero, and such gates are permanently escalated-visible; they are never default-applied (no clock evidence) | L |
| RSK-5 | The audience seam is foreclosed (owner assumptions baked into the mechanism), forcing an M1-S16 redesign | M | L | F-8 makes audience-parameterization a testable acceptance criterion; coordinator audience is design-reviewed in this change | L |
| RSK-6 | The owner perceives automatic defaults as tool overreach | M | M | One pre-agreed default per gate, agreed in advance and inspectable; recorded evidence for every application; the waiver path with authorizer remains the deliberate override; OQ-1 keeps the initial default map an explicit owner sign-off | L |

## 12. ASSUMPTIONS

- The owner-gate definition is fixed: an open work item carrying `hand-back` or `human-input-needed` (case-insensitive), as declared by the status-digest contract data and reused by `queue ready` and `verify gates`; `assignee` is never used as a signal (ADR-0006 absence semantics).
- The SLA applies to open items only (delivery state neither done nor canceled), mirroring the tracker collector's owner hand-back family.
- The initial gate-kind vocabulary is exactly `owner-review` (never-merge class, non-defaultable) and `waiver` (pre-agreed default `owner-review-first`) per PDR-0003 (DEC-10); the closed set and its never-merge classification are contract data created by this change, and new kinds require owner sign-off. The owner-review↔never-merge mapping is PDR-0003's recorded assumption — no delivered surface distinguishes kinds today; it is reconciled and extended when M1-S4 (GH-225) lands (PDR-0003 revisit trigger #2).
- v0 production inertness of the expiry mechanism: with the delivered tracker slice, every real gate maps to kind `owner-review` (the v0 kind mapping), so default-on-expiry, EVT-1 decision records, and `waivedBy` are exercisable only over injected/factory facts until M1-S4 (GH-225) delivers the gate-kind mapping and waiver recording — real-data default application is expected to be zero until then.
- Evaluation runs at command invocation with an injected clock; no daemon, background timer, or cron is required for correct SLA state.
- Default application is a recorded decision, not a merge; the merge transaction remains an explicit coordinator action (M1 boundary invariant).
- Single-host, local-first posture: the state layer's local filesystem authorization is accepted for M1, matching the delivered posture.
- The `board` command name is locked in the command registry; the binary name is read from branding configuration.

## 13. DEPENDENCIES

| Direction | Item | Notes |
|-----------|------|-------|
| Depends on | Status digest tracker collector (M0-S6, GH-175) — CLOSED 2026-10-31 ✓ | Owner hand-back family, owner-attention label set, `updatedAt` ranking, thresholds-as-contract-data precedent |
| Depends on | State layer | Append-only ledger, verified reads, verified-empty, fences — substrate for EVT-1/DM-2 |
| Depends on | Result contract and error table | `CommandResult` envelope, declared identities, `{0,1,2}` exit projection, redaction chokepoint |
| Depends on | Configuration/contract-data layer | SLA thresholds, gate kinds/classes, and defaults held as contract data, not config keys |
| Depends on | Verify-gates binary `owner-gate` definition (delivered) | Shared owner-gate population (absent/present over the owner-attention labels); no kind/class vocabulary is delivered today — this change creates the initial classification (F-5, DM-3) |
| Depends on | ADR-0003 / ADR-0004 / ADR-0006 | Placement and tiers; activity-timestamp semantics (absent = unknown); absence-not-fabrication discipline |
| Feeds | M1-S4 merge and verify-deploy engine (GH-225, OPEN) | Reconciliation point for the gate-kind classification created here (PDR-0003 revisit trigger #2); its waiver recording activates real-data defaulting |
| Blocks | M1-S16 typed blocker channel (GH-230) | Consumes the audience seam (F-8) for the coordinator audience |
| Feeds | M1-S6 brief (GH-228) | Renders owner-gate ages as anchored actions from this state source |
| Feeds | M2-S4 full fleet board | Shares this SLA state source for the one-screen grid |

## 14. OPEN QUESTIONS

| ID | Question | Context | Status |
|----|----------|---------|--------|
| OQ-1 | What is the initial pre-agreed default map — the closed gate-kind set beyond the `owner-review`/`waiver` exemplars, each kind's never-merge classification, and the one default per defaultable kind (e.g. `owner-review-first` for the waiver class)? | The ticket pins "one pre-agreed default per gate" and the planning pack gives the example default, but the initial policy table's full content needs an explicit owner sign-off before it can ship as contract data | Resolved: [PDR-0003](../../../decisions/PDR-0003-owner-gate-sla-default-map.md) (DEC-10) — adopted for delivery, owner ratifies at PR review |
| OQ-2 | How are unknown-age gates represented on the board wire contract: an age-unknown marker within the pinned three-value `slaState` enum (`fresh` \| `escalated` \| `default-applied`), or a fourth declared state? | The planning-pack board contract pins three SLA states; unknown age must be declared visibly and never default-applied (F-6/DEC-6), but its wire representation is a contract refinement the pack leaves open ("proposed contract") | Resolved: DEC-8 — three-value enum unchanged; `age: null` + declared unknown marker/reason |
| OQ-3 | Does `board --watch` ship in v0 as bounded state polling (declared degraded mode, daemon-free), or does v0 render once with watch deferred until the resident daemon exists? | The planning-pack synopsis pins `[--watch]`, but the daemon arrives later in M1; the state-mediated fallback contract supports bounded polling, so shipping watch as polling is viable — the delivery-timing choice is unresolved | Resolved: DEC-9 — v0 is render-once; `--watch` deferred to the resident-daemon story |

## 15. DECISION LOG

| ID | Decision | Rationale | Date |
|----|----------|-----------|------|
| DEC-1 | The SLA age clock is the provider-native work-item activity timestamp (ADR-0004) — the same signal the tracker collector uses to rank owner hand-backs; absent/unparseable means age unknown, never fabricated | Reuses the one delivered, truthful, provider-resolved activity signal; satisfies the PM direction to pick and pin one of the available precedents; unknown-age handling follows the delivered absent-means-unknown discipline | 2026-11-06 |
| DEC-2 | SLA thresholds (24 h escalation, 72 h expiry), the gate-kind/class vocabulary, and the one-default-per-kind map are contract data (policy-as-data) in the contracts tier — no new configuration keys | Follows the status-digest precedent (stall threshold and label set as contract data); keeps policy inspectable and review-gated rather than silently tunable | 2026-11-06 |
| DEC-3 | Default application is a recorded, auditable decision event in the state layer (EVT-1), idempotent by gate identity, and never a merge execution | The ticket requires a recorded proceed decision; the state layer's append-only ledger is the delivered audit substrate; the M1 invariant keeps merges explicit coordinator actions | 2026-11-06 |
| DEC-4 | The escalation mechanism is audience-parameterized (owner \| coordinator) from day one; only the owner audience ships in M1-S5 | The ticket pins "one mechanism, two audiences"; designing the seam now avoids an M1-S16 redesign without pre-building M1-S16 behavior | 2026-11-06 |
| DEC-5 | `board` v0 is the M1-S5 SLA surface; brief consumption is M1-S6; the full fleet grid is M2-S4 | Resolved by the planning pack (board.md "M1 planned (M1-S5)"; journeys M4; contracts board entry), not a planning gap | 2026-11-06 |
| DEC-6 | Gates with unknown age are never default-applied and never rendered as fresh, zero, or silent; they surface with age declared unknown | Defaults require observed clock evidence; truthful absence (ADR-0004/ADR-0006) forbids fabricating age; silence is impossible per the ticket | 2026-11-06 |
| DEC-7 | Collector unavailability on the board surface is declared with the `status.collector.<id>.unavailable` identity family and projects exit 2; a rendered board exits 0 | Pinned by the planning-pack board contract (exit 0 rendered / 2 collectors unavailable, declared errors); keeps unavailability honest and machine-readable | 2026-11-06 |
| DEC-8 | Unknown-age gates render `slaState: escalated` with `age: null` plus a declared machine-readable unknown marker/reason (`activity-timestamp-absent` vs `activity-timestamp-unparseable`); the three-value `slaState` enum is unchanged | Unknown age is a fact about the evidence (`age`), not the SLA posture (`slaState`); DEC-6/RSK-4 already pin unknown-age gates as never-defaultable and escalated-visible, so `escalated` is the truthful projection and a fourth enum value would semantically overlap it, forcing consumers (M1-S6 brief, M2-S4 fleet grid) to define precedence between two states meaning the same thing; declared-unknown-in-the-evidence-field is the ADR-0004/ADR-0006 absent-means-unknown paved road | 2026-11-06 |
| DEC-9 | `board` v0 is render-once; `--watch` is deferred to the resident-daemon story (planning-pack deviation documented; pack status is Proposed contract) | No AC requires watch; bounded polling would add a long-running process, signal handling, and an interval policy that contradict the daemon-free posture and expand the failure surface of a deterministic v0 (NFR-1/NFR-3/NFR-4); adding the flag later is additive and backward-compatible | 2026-11-06 |
| DEC-10 | The initial pre-agreed default map ships exactly two gate kinds: `owner-review` (never-merge class, non-defaultable by design — unanswered gates escalate permanently and visibly, overridable only by a recorded waiver) and `waiver` (pre-agreed default `owner-review-first`, which reclassifies proceed posture, never authorizes a merge, never populates `waivedBy`); any new kind/class/default is an owner-signed policy-data change; the classification is created by this change (no delivered surface distinguishes gate kinds today), and the owner-review↔never-merge mapping stands as PDR-0003's recorded assumption until M1-S4 (GH-225) reconciles it (revisit trigger #2) | [PDR-0003](../../../decisions/PDR-0003-owner-gate-sla-default-map.md): "one pre-agreed default per gate" is a uniqueness/no-invention constraint — at most one per kind, exactly one where defaultable — so never-silence satisfies the ticket for non-defaultable kinds while keeping the system's first automatic proceed decision a deferral to the owner; irreversible-trust asymmetry and the M1-S16 precedent template recorded in the PDR; adopted for delivery (Proposed), owner ratifies at PR review | 2026-11-06 |

## 16. AFFECTED COMPONENTS (HIGH-LEVEL)

| Component | Impact |
|-----------|--------|
| Core contracts (SLA policy data, board payload vocabulary) | New — thresholds, gate kinds/classes, defaults, SLA-state enum, gate record shapes |
| Core domain (SLA evaluation: aging, escalation, default application) | New — pure evaluation over injected facts; no I/O, clock, or randomness |
| CLI command surface (`board`) | New — command definition and composition, registered beside the other top-level commands |
| State layer record kinds | New — one append-only decision-event record kind (EVT-1/DM-2); no existing kind modified |
| Result contract documentation | Updated — declared collector-unavailable identity family documented with its exit-2 projection |
| Command registry / man-page surfaces | Verify-only — the planning-truth registry row for `board` already exists (`doc/planning/oss-tooling/cli-command-registry.md`); this change only asserts it as a tree invariant and does not author or edit it |
| Current-truth feature documentation | New — a feature spec for the owner-gate SLA, reconciled at system_spec_update (first-spec-only always-resolve) |

## 17. ACCEPTANCE CRITERIA

**Ticket AC (verbatim):** an owner gate older than the SLA ages into escalation or a proceed decision, never silence.

| ID | Criterion | Linked |
|----|-----------|--------|
| AC-F1-1 | **Given** an open work item carrying a declared owner-attention label with a parseable provider-native activity timestamp 10 h old, **when** the SLA aging computation runs against an injected clock, **then** the gate's age is computed from that timestamp, its SLA state is `fresh`, and no escalation or default is emitted | F-1 |
| AC-F1-2 | **Given** an open owner-gate item whose activity timestamp is absent or unparseable, **when** aging runs, **then** the gate's age is declared unknown (never fabricated, never zero), the gate is visibly listed, and it is never rendered as `fresh` | F-1, F-6 |
| AC-F2-1 | **Given** an owner gate whose observed age has just crossed 24 h, **when** the SLA is evaluated, **then** the gate's SLA state is `escalated`, and it remains `escalated` on every subsequent evaluation until the gate resolves — never reverting to silence | F-2, NFR-5 |
| AC-F3-1 | **Given** an owner gate with exactly one pre-agreed default whose observed age has crossed 72 h, **when** the SLA is evaluated, **then** the default is applied as a proceed decision, the gate's SLA state is `default-applied` naming that default, and a decision record (EVT-1) is persisted | F-3, F-4, DM-2 |
| AC-F3-2 | **Given** an owner gate with no pre-agreed default whose observed age has crossed 72 h, **when** the SLA is evaluated, **then** escalation continues (state stays `escalated`), no default is invented, and the gate remains visible on the board | F-3, F-6 |
| AC-F4-1 | **Given** a default applied at expiry, **when** the decision record is read later through a verified read, **then** it names the gate id, the applied default, and the application time; and **when** the SLA is re-evaluated after application, **then** no second record is created (idempotent, NFR-7) | F-4, EVT-1 |
| AC-F5-1 | **Given** an owner gate in a never-merge class whose observed age has crossed 72 h, **when** the SLA is evaluated, **then** no proceed default is auto-applied — escalation continues — and only a recorded waiver authored by a principal authorized for the class stands as override evidence | F-5 |
| AC-F6-1 | **Given** a tracker collector read that fails or is unavailable, **when** `board` runs, **then** the unavailability is declared with the `status.collector.<id>.unavailable` identity, no gate is fabricated, and the run exits 2 — never silent, never a rendered zero | F-6, DEC-7, NFR-6 |
| AC-F6-2 | **Given** any owner gate older than the SLA thresholds, **when** the board renders, **then** the gate appears in `escalated` or `default-applied` state — the ticket's never-silence criterion holds for every gate on every evaluation | F-2, F-3, F-6 |
| AC-F7-1 | **Given** gates in mixed SLA states and all collectors available, **when** `board --json` runs, **then** exactly one `CommandResult` envelope is returned whose `data` carries `gates[]` with `id`, `kind`, `ref`, `age`, `slaState`, `default`, and `waivedBy`, and the exit code is 0 | F-7, DM-1 |
| AC-F7-2 | **Given** identical injected collector facts, clock, and policy data across two invocations, **when** the board renders in either mode, **then** the output bytes are identical (NFR-1) | F-7, NFR-1 |
| AC-F8-1 | **Given** the escalation mechanism's contract, **when** it is reviewed against the M1-S16 seam, **then** aging, threshold evaluation, and escalation state carry an explicit audience dimension (owner \| coordinator) with no owner-specific assumption baked into the mechanism, such that a coordinator-audience consumer can be added without redesign | F-8, DEC-4 |

## 18. ROLLOUT & CHANGE MANAGEMENT (HIGH-LEVEL)

- Delivered as one additive change through the standard 11-phase lifecycle on its feature branch; no flag-gating — a single-user local tool adds the surface directly.
- Delivery order inside the change: SLA policy data and the evaluation engine first (pure, fixture-testable), then the persisted decision record, then the `board` surface; the audience seam is asserted by the review of the engine contract, not deferred.
- v0 exercisability boundary: the SLA is fully exercisable in v0 only over injected/factory facts (fixtures and tests); against the delivered tracker slice every real gate maps to kind `owner-review` and persistently escalates, and real-data defaulting (with `waivedBy` rendering) activates when M1-S4 (GH-225) delivers the gate-kind mapping and waiver recording.
- The initial default map is owner-signed policy data (PDR-0003, adopted for delivery with `status: Proposed`; the owner ratifies at the GH-229 PR review, flipping the record to Accepted), so the first automatic proceed decision ever made is pre-agreed by construction and owner-vetoable.
- Adoption: the owner's daily attention moves from "check for hand-backs" to "read the board"; `status` and `queue ready` keep their current behavior, so no consumer is broken on adoption.
- Doc impacts are recorded now and resolved at phase 7: a new current-truth feature spec for the owner-gate SLA (first-spec-only always-resolve), plus the command-registry cross-reference; the closeout spec explicitly excludes owner-gate SLA mechanics, so no closeout edit is expected.

## 19. DATA MIGRATION / SEEDING (IF APPLICABLE)

None. The decision-event record kind is new and append-only; there is no backfill — gate ages derive from live tracker data at the first evaluation, and SLA state for gates that already exist is computed on first run (a gate already older than 72 h is evaluated, escalated, and defaulted per the same thresholds on first sight, with its application recorded like any other).

## 20. PRIVACY / COMPLIANCE REVIEW

- No credentials, raw provider payloads, titles, bodies, comments, or free-form message content enter the board payload, the decision record, or the human grid — gate ids, kinds, refs, ages, SLA states, and policy values only.
- The single serialization redaction chokepoint covers the envelope and human text; no new secret-read allowlist entry is added.
- Decision records are local, append-only, and bounded in content — an audit trail, not a data hold.

## 21. SECURITY REVIEW HIGHLIGHTS

- **Authority boundary (primary):** the SLA mechanism must never self-authorize. Automatic proceed decisions are limited to pre-agreed, never-merge-excluded classes; never-merge classes are structurally excluded from auto-proceed (F-5, AC-F5-1); the waiver path carries an authorizer principal, and expiry alone is never authority.
- **Recorded decisions:** every automatic proceed is persisted with evidence (EVT-1), so any later audit can reconstruct what the tool decided and when — no hidden decisions inside the tool.
- **State integrity:** the decision record rides the state layer's append-only ledger, fence, permission, and torn-state discipline; a torn store is classified, never served as truth.
- **Read-mostly posture:** collectors are read-only; the single mutating effect is the recorded, idempotent decision event. No child processes, no shell, no new credential path.
- **Brand neutrality:** no product or binary literal is committed; the board renders the injected brand binary name.

## 22. MAINTENANCE & OPERATIONS IMPACT

- Changing a threshold, adding a gate kind, or re-classifying a class is a contract-data edit plus tests and documentation — no collector architecture change.
- Adding a default for a new kind is a policy-data change gated on owner sign-off (OQ-1 pattern), never a code change.
- M2-S4's fleet grid and M1-S6's brief consume the same SLA state source, so later surfaces are additive consumers, not forks.
- The declared collector-unavailable identity family is the surface's failure vocabulary; promoting further failure classes to error-table rows requires a named consumer and a reviewed change, matching the delivered evidence-vs-identity discipline.

## 23. GLOSSARY

| Term | Definition |
|------|------------|
| Owner gate | An open work item carrying a declared owner-attention label (`hand-back` or `human-input-needed`, case-insensitive); the shared definition used by the tracker collector, `queue ready`, and `verify gates`. |
| SLA (service-level agreement) | The pinned aging policy for owner gates: escalation at 24 h, default decision at 72 h, one pre-agreed default per gate kind/class, silence impossible. |
| Age clock | The provider-native work-item activity timestamp (ADR-0004) — the SLA's only time source; absent or unparseable means age unknown, never fabricated. |
| slaState | The per-gate SLA state: `fresh` (within thresholds), `escalated` (past 24 h), `default-applied` (past 72 h with the pre-agreed default applied). |
| Stale-review escalation | The 24-hour consequence: the gate is visibly marked escalated and stays so until resolved; visibility only, never a decision. |
| Default-on-expiry | The 72-hour consequence: the gate's pre-agreed default is applied as a proceed decision and recorded. |
| Pre-agreed default | Exactly one decision per gate kind/class, held as policy-as-data before expiry (e.g. `owner-review-first` for a waiver class); never invented at runtime. |
| Never-merge class | A gate class whose override must be owner-authored: the SLA never auto-proceeds it; only a recorded waiver by an authorized principal overrides. |
| Waiver | A recorded override carrying an authorizer principal (`waivedBy`); presence of expiry or of a waiver alone is never sufficient authority — policy verification belongs to the merge story. |
| Aging grid | The board's deterministic per-gate rendering: id, kind, ref, age, SLA state, default, waiver authorizer. |
| Board | The `board` command, v0: the owner-gate SLA surface (aging, escalation, defaults); the full fleet grid arrives at M2-S4 sharing this state source. |
| Audience seam | The escalation mechanism's explicit audience dimension (owner \| coordinator); owner ships in M1-S5, coordinator arrives with M1-S16 on the same mechanism. |
| Decision record (EVT-1) | The append-only, auditable state event persisted at every default application: gate id, kind, ref, default, time, evidence. |
| Declared unavailability | The named, machine-readable statement that a collector read did not succeed (`status.collector.<id>.unavailable`), projected as exit 2 — never silence. |
| Unknown age | A gate whose activity timestamp is absent or unparseable: age declared unknown, gate kept visible, never defaulted. |

## 24. APPENDICES

### Appendix A — Planning-pack anchors for the board surface (proposed contract, M1-S5)

- Synopsis: `<binary> board [--watch] [--json]` — the owner-gate SLA surface: aging, escalation, defaults.
- SLA: 24 h stale-review escalation, 72 h default-on-expiry, one pre-agreed default per gate, silence impossible.
- Output: text aging grid; envelope `data` carries `gates[]` (id, kind e.g. `owner-review` | `waiver`, ref, age, slaState `fresh` | `escalated` | `default-applied`, default, waivedBy).
- Exit status: 0 rendered; 2 collectors unavailable (declared).
- Errors: `status.collector.<id>.unavailable` (declared, never silent).
- Worked example from the pack: an `owner-review` gate at 26 h renders `escalated` with `default: null`; a `waiver` gate at 2 days renders `default-applied` with default `owner-review-first` and `waivedBy: owner`.
- **Non-normative caveat on the worked example:** the pack example is illustrative only — the pinned 72 h expiry threshold (DEC-2) is authoritative, so a 2-day-old waiver gate is `escalated`, not `default-applied`; and `waivedBy` never renders from a default application (DEC-10), so the example's `waivedBy: owner` on a default-applied gate is a pack-internal inconsistency, not behavior this change delivers. Fixtures and golden output follow the pinned thresholds and DEC-10, not the example.
- Downstream: the full fleet grid arrives at M2-S4 sharing this state source; the brief (M1-S6) renders owner-gate ages from the same collector state.

### Appendix B — Current-truth reuse map

| Reused truth | Source surface | What this change takes from it |
|---|---|---|
| Owner hand-back family (open items with declared owner-attention labels, ranked oldest activity first) | Status digest tracker collector | The gate population and its ranking precedent |
| `STATUS_OWNER_ATTENTION_LABELS` = `hand-back`, `human-input-needed` (case-insensitive), as contract data | Status digest contracts | The owner-gate label set, reused by reference |
| `no-owner-gate` readiness condition | Queue ready | The owner-gate definition, confirmed |
| Binary `owner-gate` merge gate (absent/present over the same labels; no kind/class vocabulary delivered) | Verify gates | The shared owner-gate population definition; the never-merge/owner-review-first classification is created by this change (PDR-0003), not taken from here |
| Activity-timestamp absent-means-unknown semantics | ADR-0004 / ADR-0006 | The age clock and truthful-absence handling (DEC-1, DEC-6) |
| Thresholds-as-contract-data pattern | Status digest (stall threshold, caps) | The SLA policy-data home (DEC-2) |
| `CommandResult` envelope, error table, `{0,1,2}` projection, redaction | Result contract | Output/failure posture (DEC-7, NFR-6) |
| Append-only JSONL ledger, verified reads, fences | State layer | The decision-record substrate (EVT-1, DEC-3) |

## 25. DOCUMENT HISTORY

| Version | Date | Author | Changes |
|---------|------|--------|---------|
| 1.0 | 2026-11-06 | @spec-writer | Initial specification from the PM planning session (clarify_scope validated) and the M1 planning pack |
| 1.1 | 2026-11-06 | @spec-writer | DoR iteration-1 remediation (findings 2–6): gate-kind classification restated as created by this change — binary verify-gates gate is the only delivered truth, M1-S4 (GH-225) is the reconciliation point, PDR-0003's owner-review↔never-merge assumption kept explicit (front matter, §2.1, §2.2, F-5, §12, §13, DEC-10, Appendix B); v0 production-inertness of real-data defaulting made spec-visible (§4.1 KPI scope note, F-3, §12, §18); deterministic rank key and truncation marks elevated into the contract (F-7, DM-1, §7.1); Appendix A worked example caveated as illustrative (72 h authoritative; `waivedBy` never from a default); §16 registry row corrected to verify-only |

---

## AUTHORING GUIDELINES

- Sources: ticket GH-229 goal and pinned decisions (24 h / 72 h / one default per gate / silence impossible / M1-S16 reuse), the PM planning summary (validated at clarify_scope), the M1 planning pack (backlog M1-S5; `board` command page; contracts board entry; journeys J4 and the M2 note; architecture attention-plane placement; pack conventions), and the delivered current-truth specs (status digest, queue ready, verify gates, state layer, result contract) plus ADR-0004.
- Pinned decisions from the ticket are recorded as decisions (DEC-4, DEC-5) or capabilities (F-2/F-3 thresholds), never re-derived or contradicted.
- The age-clock choice was directed by planning ("pick one, state it"); DEC-1 states it with its rationale and OQ-2 keeps the residual wire-representation question open rather than inventing a fourth enum value.
- Tech-neutral by design: no module names, file paths, or implementation steps; the plan writer derives placement from ADR-0003 and the delivered package tiers.
- Quantified NFRs reuse the delivered reference values (50 ms, 65 536 bytes, 4 096 bytes / 24 lines, 8-item cap) so the change matches the system's established bounds discipline.

## VALIDATION CHECKLIST

- [x] `change.ref` matches provided `workItemRef` (GH-229)
- [x] `owners` has at least one entry
- [x] `status` is "Proposed"
- [x] All sections present in order (1–25 + guidelines + checklist)
- [x] ID prefixes consistent and unique (F-, AC-, NFR-, RSK-, DEC-, DM-, EVT-, OQ-)
- [x] Acceptance criteria reference at least one F-/NFR-/DM-/EVT- ID and use Given/When/Then
- [x] NFRs include measurable values
- [x] Risks include Impact & Probability (H/M/L) with mitigation and residual risk
- [x] Out-of-scope items prefixed `[OUT]` and name the deferred stories explicitly (M1-S6/GH-228, M1-S16/GH-230, M2-S4)
- [x] Ticket AC covered by testable criteria (aging into escalation at 24 h — AC-F2-1; default at 72 h with recorded evidence — AC-F3-1/AC-F4-1; never-silence incl. collector-unavailable declared — AC-F6-1/AC-F6-2; one default per gate — F-3/AC-F3-2; never-merge never auto-proceeds — AC-F5-1; M1-S16 audience seam — AC-F8-1)
- [x] No implementation details (no code file paths, no step-by-step tasks)
- [x] Unresolved decisions captured as OQ-1..OQ-3 with "Decision needed: consult `@decision-advisor`"
- [x] Front matter validates per front_matter_rules
