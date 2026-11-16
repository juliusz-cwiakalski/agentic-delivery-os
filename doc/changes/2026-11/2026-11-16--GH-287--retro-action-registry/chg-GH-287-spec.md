---
change:
  ref: GH-287
  type: feat
  status: Proposed
  slug: retro-action-registry
  title: "M2-S10: Retro action registry and follow-through (M2)"
  owners: [engineering]
  service: delivery-os retro learning plane (retro action registry, follow-through enforcement, and board actions surface)
  milestone: "M2: Ceremonies, measurement, and memory"
  labels: [change, m2, retro, board, learning-plane]
  version_impact: minor
  audience: internal
  security_impact: low
  risk_level: medium
  dependencies:
    internal:
      - retro evidence pipeline and retro registry (GH-232 / M1-S8) — the follow-through read-fold, the declared levels R1-R6, the evidence sidecar, and the four retro error identities this change turns into enforced truth
      - ceremony runner (GH-296 / M2-S3) — the retro-evidence-pass over the four sub-R1 levels, the asserted follow-through-first agenda, and the declared-actions handoff this registry receives
      - board (GH-297 / M2-S4) — the delivery.board.v1 four-section payload, shared state source, bounds, byte guard, and deterministic render patterns the actions surface extends
      - harness telemetry v2 (GH-291 / M2-S14) — advisory evidence inputs (spend attribution) for outcome verifiers, per the milestone pack
      - state layer (GH-174) — validated boundaries, fenced appends, verified reads for registry records
      - result contract and error table (GH-172) — envelope, exit projection, redaction chokepoint, the retro domain kind, and the exact-code binding rules
      - tracker integration (delivered) — read-only corroboration of the real tracker entries actions reference
      - configuration layer and branding seam (GH-173 / GH-171) — settings and brand-neutral naming
    external:
      - GitHub tracker (the tracker entries actions must reference; read-only corroboration through the delivered integration)
links:
  issue: https://github.com/juliusz-cwiakalski/agentic-delivery-os/issues/287
  related_changes: ["GH-232", "GH-296", "GH-297", "GH-291", "GH-284"]
  related_decisions: ["TDR-0009", "TDR-0005", "ADR-0003", "PDR-0003"]
---

# CHANGE SPECIFICATION

> **PURPOSE**: Deliver the retro action registry — five-field filing with a verification artifact, aging with nudges and escalation, explicit artifact-versus-outcome closure, an improvement WIP limit per window, and an actions surface beside the board's owner asks — so retrospectives produce verified follow-through instead of lists, and the follow-through enforcement the delivered retro pipeline and ceremony runner explicitly deferred becomes current truth.

## 1. SUMMARY

This change delivers milestone story M2-S10: the retro action registry and follow-through enforcement. The registry is the follow-through memory behind every retro level: it receives the actions the ceremony layer hands off, validates the five-field contract (named owner, verifiable verb, measurable outcome, real tracker entry, due date) plus the verification artifact at filing, records each action's outcome verifier (a delayed metric window) and rollback condition, ages open actions (nudge at 14 days, escalate at 30 days or on a second missed due date), and closes them only through explicit decisions that distinguish artifact closure from outcome closure. An improvement WIP limit (at most three open actions per window, refused at the limit with a classified error — DEC-6) keeps each window focused, and open actions with their aging states surface on the board next to the owner asks. Every R4+ retro opens with artifact-verified follow-through over the registry's records. Two scope exclusions recorded by the PM are explicit non-goals: communication analytics (condition unmet — no message contract exists) and the failure-to-regression-test compiler (absent from the ticket's tasks and acceptance criteria).

## 2. CONTEXT

### 2.1 Current State Snapshot

- **The retro evidence pipeline is delivered (M1-S8), with enforcement explicitly deferred.** `retro report` folds a read-only `followThrough[]` section whose entries carry `{action, verdict, artifactRef?}` with verdicts `verified`, `unverified`, and `unknown`; entries fold only when a follow-through reader is injected and are never invented. The delivered feature states the gap verbatim: follow-through enforcement is later work — this change. The retro registry declares levels R1-R6 (only the `change` level R1 is implemented; the four sub-R1 levels are ceremony-served) and carries exactly four `retro` error identities in the delivered error table.
- **The ceremony runner is delivered (M2-S3) and hands actions off.** The `retro-evidence-pass` ceremony serves the four sub-R1 levels (`session`, `incident`, `window`, `project`) over the delivered evidence plane, its follow-through-first phase position is asserted so it cannot be moved, and its follow-through verdicts are `applied`, `partial`, and `violated-with-consequence` over read evidence. Declared actions are rendered as a handoff section in the note; the delivered boundary names this change as the receiver: filing, the five-field action contract, aging, and closure belong to M2-S10. The runner deliberately registers no action verb and writes nothing to any registry.
- **The board is delivered (M2-S4) with no actions surface.** `board` renders exactly four sections in declared order — lanes, gates, asks, parked — from the shared `delivery.status-facts.v1` bundle (plus the lane/phase fold), with per-section caps, a counted-omission discipline, a byte guard with a fixed drop order, deterministic repository-then-section ordering, and a read-only posture apart from one idempotent decision append. Ask rows already carry computed `age` in milliseconds, so visible aging has a delivered pattern to extend.
- **Telemetry v2 is delivered (M2-S14) as an advisory evidence input.** The milestone pack lists `telemetry.v1` as consumed by M2-S10 at the owning story's declared edge, and the retro evidence pipeline already cites the verified spend fold (or its classified absence) as collector-truth evidence.
- **The concept is the design authority.** `concepts/retrospectives.md` defines the five-field contract plus verification artifact (named owner — agent role or human, never team-owned; verifiable verb — add/remove/change/test/deploy, never "review" or "improve"; measurable outcome; real tracker entry; due date), the aging ladder (nudge at 14 days, escalate at 30 days or on second miss), the explicit-closure rule (done with artifact, deprioritized with reason, superseded), the improvement WIP limit (at most 1-3 actions per window), the outcome verifier (delayed metric window) with a required rollback condition, the artifact-versus-outcome closure distinction, the board surface next to owner asks, and the follow-through-first agenda for every R4+ retro.
- **Planning truth.** Backlog M2-S10 (canonical with the ticket, planned by GH-284) defines goal, tasks, and AC; the milestone pack pins scenarios SC-M2-S10-01 and SC-M2-S10-02 and pre-declares the error identity `retro.action-incomplete` for the filing refusal.

### 2.2 Pain Points / Gaps

- **Actions drift silently.** A retro action has no owner validation, no verb discipline, no measurable outcome requirement, no tracker anchor, and no due date enforcement at the moment it is created — so vague, ownerless, and untrackable actions enter the system and die there.
- **The handoff is a dead end.** The ceremony note renders declared actions, but nothing files, ages, or closes them; the retro report's follow-through fold has no producer to read from, so follow-through verification verifies nothing recorded.
- **Aging is invisible.** No surface shows how long an improvement commitment has been open, which actions passed their due date, or which have missed twice — the action-graveyard failure mode the concept's defense table names.
- **Closure is undisciplined.** There is no explicit-closure rule: nothing distinguishes an action closed because its guard exists from one closed because its metric moved, and nothing prevents silent or implied closure.
- **The board shows questions but not obligations.** The owner sees open asks with ages but not which retro commitments the team owes — the improvement obligations are invisible beside the coordination ones.

## 3. PROBLEM STATEMENT

Because the delivered retro pipeline folds follow-through as a read-only section with no producer, the ceremony runner hands declared actions off to a registry that does not exist, and no surface validates, ages, closes, or displays retro actions, every retro level produces action lists rather than verified follow-through: improvements drift silently without aging or escalation, closures happen implicitly or not at all with no artifact-versus-outcome distinction, and the owner cannot see — next to the asks on the board — which improvement commitments are open, aging, or escalated.

## 4. GOALS

- **G-1**: Filing integrity — an action without all five fields plus its verification artifact cannot be filed, and a field present but non-conforming to its contract rule is incomplete for filing purposes (DEC-8); the refusal is classified, names the missing or offending field, and leaves the recorded actions unchanged.
- **G-2**: Outcome accountability — every action carries an outcome verifier (a delayed metric window: did the intended behavior actually change) and a rollback condition, recorded at filing.
- **G-3**: Explicit closure — no action closes without an explicit decision and an artifact or reason; closure distinguishes artifact closure (the guard, test, or change exists) from outcome closure (the metric moved as predicted), each with its own state.
- **G-4**: Visible aging — open actions age deterministically (nudge at 14 days, escalate at 30 days or on a second missed due date) and the aging state is visible on the board next to the owner asks.
- **G-5**: Focused improvement — an improvement WIP limit of at most three open actions per window (the declared contract-data value, DEC-6) bounds how many open actions a window carries.
- **G-6**: Follow-through enforcement — every R4+ retro opens with artifact-verified follow-through over the registry's recorded actions, with verdicts drawn from artifact evidence, never owner claims.
- **G-7**: One registry behind every retro level — the same registry, contract, and closure discipline serve all retro levels (R1 closeout through the ceremony-served levels; R6 fleet when it activates), conforming to the delivered envelope, state-layer, determinism, and brand-neutrality conventions.

### 4.1 Success Metrics / KPIs

| Metric | Target |
|--------|--------|
| Filing refusal (SC-M2-S10-01) | 100% of filings missing a contract field or violating a contract rule exit 1 with `error.code == "retro.action-incomplete"` naming the missing or offending field, and `actions[]` stays empty |
| Closure distinction (SC-M2-S10-02) | An artifact-complete, outcome-open action reports `data.artifactClosure == "closed"` and `data.outcomeClosure == "open"` with a non-null verification window |
| Ticket AC coverage | 100% of the ticket's six ACs mapped to at least one binding acceptance criterion (Section 17) and passing on fixture-seeded stores |
| Aging visibility | 100% of open actions past a threshold render their aging state (nudged or escalated) on the board's actions surface |
| Closure discipline | 100% of recorded closures carry an explicit decision plus an artifact (done), a reason (deprioritized), or a superseding action (superseded); zero implicit closures |
| WIP focus | Every window's open improvement actions stay within the declared limit (3); any excess filing attempt is refused with a declared outcome naming window, count, and limit, never silently recorded |
| Determinism | Byte-identical repeat renders for identical stored actions, injected clock, and injected run id; zero model calls on any path |
| Offline verification | 100% of new tests run offline on committed fixtures and fixture-seeded stores; zero live tracker, network, or credential access |

### 4.2 Non-Goals

- **NG-1**: Communication analytics — unanswered asks, ask aging, and escalation rates as retro evidence inputs. The ticket makes these conditional on the message contract existing (`concepts/inter-agent-communication.md`); that concept is explicitly parked with nothing scheduled and the contract does not exist, so the condition is unmet and this delivery excludes them (DEC-1).
- **NG-2**: The failure-to-regression-test compiler — incidents yielding regression fixtures, contrastive pairs, and adversarial scenarios. The concept's story mapping mentions it folding into M2-S10, but the ticket's task list and AC omit it and the backlog story (canonical with the ticket) omits it; it is not invented into this change (DEC-2).
- **NG-3**: Changes to the retro evidence pipeline's collection grammar, collector sources, truth checks, sidecar, chain construction, or level-registry statuses — this change consumes them as delivered.
- **NG-4**: Changes to ceremony declarations, agendas, note schema, or the asserted follow-through-first phase position — the ceremony layer is the declared caller, unchanged.
- **NG-5**: Metrics, alarms, dashboards, or process meta-metrics (closure rate, time-to-close presentation) — the metrics surface remains M2-S6's.
- **NG-6**: Schedulers, daemons, timers, or background nudging — aging is derived deterministically at read and render time (DEC-3).
- **NG-7**: Automatic or implied closure of any kind, for any closure plane.
- **NG-8**: Team-owned or ownerless actions — invalid by the concept's contract; no support is added.
- **NG-9**: Backfill or import of historical retro actions — the registry accumulates from filing onward.
- **NG-10**: Cross-repository action aggregation beyond the board's delivered selection forms; no new aggregation surface.
- **NG-11**: Memory-promotion, lesson-lifecycle, or decision-retro-loop changes (separate stories).

## 5. FUNCTIONAL CAPABILITIES

| ID | Capability | Rationale |
|----|------------|-----------|
| F-1 | Five-field filing gate | The ticket's first AC: an action without all five fields cannot be filed; validation at filing is the only defense against vague and ownerless actions entering the registry |
| F-2 | Action record contract | The five fields plus verification artifact, outcome verifier (delayed metric window), and rollback condition form the record every later capability reads |
| F-3 | Aging, nudges, and escalation | The concept's aging ladder (nudge 14 days, escalate at 30 days or second miss) makes drift visible instead of silent |
| F-4 | Explicit closure with artifact/outcome distinction | The ticket requires an explicit decision plus artifact or reason for every closure, and requires the artifact-versus-outcome distinction |
| F-5 | Improvement WIP limit per window | The concept bounds each window to at most 1-3 actions so follow-through stays focused |
| F-6 | Board actions surface | The ticket requires aging visible on the board, beside the owner asks, following the board's delivered bounded, deterministic, shared-source patterns |
| F-7 | Follow-through enforcement over every retro level | The registry is the producer the ceremony's follow-through-first phase and the retro report's follow-through fold read, behind every retro level |

### 5.1 Capability Details

- **F-1 Five-field filing gate**: Filing validates the five-field contract before any record lands: a named owner (an agent role or a human — a team-owned action is invalid and refused), a verifiable verb from the closed vocabulary (add, remove, change, test, deploy — "review" and "improve" are refused as unverifiable), a measurable outcome, a real tracker entry, and a due date — plus the verification artifact the action will be verified against. A filing that misses any member — or whose field fails its contract rule — is refused with the classified error identity `retro.action-incomplete` naming the missing or offending field: a field present but non-conforming (a team-owned owner, a verb outside the closed vocabulary, a placeholder tracker entry) is incomplete for filing purposes, and the refusal always names the offending field (DEC-8); no action row is created and the recorded `actions[]` is unchanged (the pinned scenario SC-M2-S10-01). The refusal never names a partially-valid row: filing is all-or-nothing.
- **F-2 Action record contract**: A filed action carries the five contract fields, the verification artifact reference, its retro level, its improvement window, the filing date, and two forward-looking members recorded at filing: the outcome verifier — a delayed metric window stating which evidence will show whether the intended behavior actually changed — and the rollback condition stating when the change should be undone. Recorded dates use the injected clock so aging is deterministic. A field's absence is a filing-time refusal (F-1), never a later null to be tolerated.
- **F-3 Aging, nudges, and escalation**: Open actions age on the recorded dates. The 14-day and 30-day thresholds measure time open since filing — elapsed time from the action's recorded filing timestamp, the one declared aging basis (DEC-9): at 14 days open the action carries a nudge state; at 30 days open, or upon a second missed due date — two due-date lapse events on the action's record, with due dates feeding only this miss counter — it carries an escalated state. States are derived deterministically at read and render time from recorded dates — no scheduler, daemon, or background process writes them (DEC-3) — and every aging state is visible on the board's actions surface (F-6). Threshold values are contract data, evaluated exactly at the boundary so the day before a threshold and the day after render differently.
- **F-4 Explicit closure with artifact/outcome distinction**: Closure is only ever explicit. Three closure routes exist: done (with a verification artifact), deprioritized (with a reason), superseded (with the superseding action, whose reference the closure record carries). A closure attempt without an explicit decision, or with the route's required justification missing, is refused with the classified identity `retro.closure-incomplete` naming what is missing (DEC-5); no closure transition occurs (the ticket's fourth AC). Artifact closure and outcome closure are separate states on the same action: artifact-complete with the outcome window still open reports artifact closure closed and outcome closure open with its non-null verification window (the pinned scenario SC-M2-S10-02). The routes close the planes differently (DEC-11): done closes the artifact plane only — its outcome closure transitions solely through an explicit decision citing the outcome verifier's evidence within the declared window, never silently from elapsed time and never as a side effect of artifact closure (DEC-4) — while deprioritized and superseded close both planes with the one explicit decision, the recorded reason or superseding action reference being the closure justification for each plane, so the verification window is mooted by that decision and not by time. Outcome closure never results from elapsed time on any route. A closure decision targeting an already-closed plane is refused as a state conflict: exit 1 under `retro.closure-incomplete`, the refusal naming the plane and its existing closure decision, and no second closure record lands — a discriminant distinct in detail from the missing-decision/justification refusal, with DEC-5's exactly-three identities intact.
- **F-5 Improvement WIP limit per window**: Each improvement window carries at most 3 open actions — the concept's declared 1-3 range narrowed to its stated maximum as one fixed contract-data constant, maintained like the aging thresholds (DEC-6). A filing into a window at its limit is refused with the classified identity `retro.wip-limit-exceeded` naming the window, its open count, and its limit; no action row is created, so over-focus is impossible to miss and never recorded (DEC-6). Deprioritize and supersede are the deliberate routes that free a slot. The window's open count and limit are disclosed wherever the window is reported.
- **F-6 Board actions surface**: The board gains an additive actions surface beside the owner asks, rendering open actions with their action identity, repository, owner, level, age, and aging state (current, nudged, escalated). The surface follows the board's delivered patterns: it reads the registry through a named source, orders deterministically, bounds rows per repository with counted omissions (`truncated` plus per-section counters), and participates in the byte guard's declared drop order. Every row names its owner; no value is inferred. The delivered four sections, their caps, and their semantics are unchanged; the extension is additive under the payload identity.
- **F-7 Follow-through enforcement over every retro level**: The registry is the single follow-through memory behind every retro level. Every R4+ retro (window, project; fleet when it activates) opens with artifact-verified follow-through: the first agenda item inspects each open action's verification artifact — never the owner's status claim — and assigns the delivered ceremony verdict vocabulary (applied, partial, violated-with-consequence) over that evidence. The delivered retro report's follow-through fold gains its producer: recorded actions with their artifacts are what `verified`, `unverified`, and `unknown` verdicts verify against — entries become foldable from recorded registry actions through the composed follow-through reader, with the delivered injected-reader contract preserved. `retro report`'s `data` gains no new top-level key in this change: the four delivered keys are unchanged, any registry-derived addition is confined to entries within the delivered `followThrough[]` fold, and the fold's entries gain provenance from the new records (DEC-10). The change-level closeout retro (R1) and the ceremony-served session and incident levels file into and read from the same registry under the same contract.

## 6. USER & SYSTEM FLOWS

```
Flow 1: Filing (from any retro level)
  retro outcome (ceremony note handoff, closeout retro, incident retro)
    declares actions → owner files each action with the five fields
    + verification artifact + outcome verifier + rollback condition
    → registry validates the contract (F-1)
      → incomplete (a missing field, or a field failing its contract
         rule) → exit 1, retro.action-incomplete naming the missing or
         offending field; actions[] unchanged (SC-M2-S10-01)
      → complete, window under its WIP limit → record lands through the
         state layer (F-2, F-5)
      → complete, window at its limit → refused with exit 1,
         retro.wip-limit-exceeded naming window, count, limit; no
         action row is created (F-5, DEC-6)

Flow 2: Aging (derived, never scheduled)
  open action → deterministic evaluation on the injected clock at read
    and render time (DEC-3)
    → 14 days open since the recorded filing timestamp → nudged,
       board-visible
    → 30 days open, or second missed due date (two due-date lapse
       events) → escalated, board-visible
    → thresholds are contract data, exact at the boundary (F-3)

Flow 3: R4+ retro follow-through
  window or project retro opens → first agenda item (asserted position):
    inspect each open action's verification artifact — never the owner's
    claim (F-7)
    → applied | partial | violated-with-consequence over artifact evidence
    → outcomes may file new actions (back to Flow 1)

Flow 4: Explicit closure
  explicit decision → done (artifact) | deprioritized (reason) |
    superseded (successor action) (F-4)
    → done: artifactClosure recorded; outcomeClosure stays open with
      its non-null verification window (SC-M2-S10-02)
    → later, within the declared window: explicit outcome decision citing
      verifier evidence → outcomeClosure closed (DEC-4)
    → deprioritized | superseded: the one explicit decision closes both
      planes — the reason / superseding reference is the closure
      justification for each; elapsed time closes nothing (DEC-11)
    → supersede records its superseding action reference on the
      closure record (DEC-11)
    → any attempt without the decision or required justification →
      refused with retro.closure-incomplete, no transition (DEC-5)
    → any closure decision on an already-closed plane → refused as a
      state conflict: retro.closure-incomplete naming the plane and its
      existing closure; no second closure record (DEC-11)

Flow 5: Board surface
  board invocation → actions projection beside ASKS from the named
    registry source (F-6)
    → deterministic order, bounded rows, counted omissions, byte-guard
      participation; every row names its owner
```

## 7. SCOPE & BOUNDARIES

### 7.1 In Scope

- The retro action registry: validated action records in the change's own validated state-store boundary with the additive `retro.action` and `retro.action-closure` record kinds (DEC-7), five-field contract validation with the verification artifact, and the `retro.action-incomplete` filing refusal (pinned by the blueprint).
- Owner, verb, and tracker rules at filing: named agent-role-or-human owners, the closed verifiable-verb vocabulary, refusal of team-owned actions, and real tracker entries.
- Outcome verifiers (delayed metric windows) and rollback conditions recorded at filing.
- Aging with nudges at 14 days and escalation at 30 days of time open since the recorded filing timestamp, or on a second missed due date (two due-date lapse events on the action's record), derived deterministically from recorded dates (DEC-9).
- Explicit closure rules — done with artifact, deprioritized with reason, superseded — with the artifact-closure versus outcome-closure distinction, the pinned closure states, the both-plane closure of the deprioritized and superseded routes, and the already-closed-plane state-conflict refusal (DEC-11).
- The improvement WIP limit per window: the declared contract-data value 3 within the concept's 1-3 range, enforced as a classified filing refusal, with the window count and limit disclosed (DEC-6).
- The board's additive actions surface beside the owner asks, with aging visible, following the board's shared-source, bounded, deterministic, counted-omission patterns.
- Follow-through enforcement: the registry as the producer for the ceremony's follow-through-first phase (R4+ opens artifact-verified) and the retro report's follow-through fold, behind every retro level.
- The pinned scenarios SC-M2-S10-01 and SC-M2-S10-02 as binding acceptance criteria, plus tests for every binding AC, offline on committed fixtures.
- Additive error-table refinement consistent with the exact-code discipline: three exact identities under the delivered `retro` domain kind (DEC-5).
- Maintenance of `doc/planning/oss-tooling/` per convention (backlog markers, status snapshot), and system-spec reconciliation in the documentation phase (new feature page; reconcile the retro-pipeline, ceremony-runner, and board pages).

### 7.2 Out of Scope

- [OUT] Communication analytics — unanswered asks, ask aging, and escalation rates as evidence inputs; the ticket's condition (the message contract of `concepts/inter-agent-communication.md` exists) is unmet because that concept is parked with nothing scheduled (DEC-1, NG-1).
- [OUT] The failure-to-regression-test compiler — absent from the ticket's tasks and AC and from the canonical backlog story (DEC-2, NG-2).
- [OUT] Changes to the retro evidence pipeline's collection grammar, collector sources, truth checks, sidecar, chain construction, or level-registry statuses.
- [OUT] Changes to ceremony declarations, agendas, the fixed note schema, or the asserted follow-through-first position.
- [OUT] Metrics, alarms, dashboards, or closure-rate/time-to-close presentation (M2-S6).
- [OUT] Schedulers, daemons, timers, or any background nudging or write path.
- [OUT] Automatic or implied closure on any closure plane.
- [OUT] Team-owned or ownerless actions.
- [OUT] Backfill or import of historical retro actions.
- [OUT] Cross-repository action aggregation beyond the board's delivered selection forms.
- [OUT] Memory-promotion, lesson-lifecycle, or decision-retro-loop changes.
- [OUT] New event topics, event kinds, or MCP tools.

### 7.3 Deferred / Maybe-Later

- Communication analytics join the evidence inputs in a future change once the message contract exists — the condition is stated here so the next change can revisit without re-deriving it.
- The failure-to-regression-test compiler as a candidate future story, if the owner wants it; recorded for visibility in the PR description rather than silently dropped.
- Closure-rate and time-to-close as process meta-metrics, delivered through the metrics story (M2-S6) once the registry produces the data.
- Fleet-level action aggregation when the R6 fleet retro activates (post-M4).

## 8. INTERFACES & INTEGRATION CONTRACTS

### 8.1 REST / HTTP Endpoints

N/A — the surfaces are CLI commands over local state; no HTTP endpoint is added or changed.

### 8.2 Events / Messages

N/A — no new event topic or event kind. Registry mutations land as validated records through the state layer under fenced appends, consistent with the delivered registry pattern; no message-contract surface exists to integrate with (see NG-1).

### 8.3 Data Model Impact

| ID | Element | Description |
|----|---------|-------------|
| DM-1 | Action record | One filed action (the `retro.action` record kind, DEC-7): the five contract fields (named owner — agent role or human, verifiable verb from the closed vocabulary, measurable outcome, real tracker entry, due date), the verification artifact reference, the retro level and improvement window, the filing date (injected clock), the outcome verifier (delayed metric window naming its evidence and window), and the rollback condition |
| DM-2 | Aging state | The derived classification of an open action — current, nudged (14 days open since the recorded filing timestamp), or escalated (30 days open, or a second missed due date: two due-date lapse events on the action's record) — computed at read/render time from recorded dates on the one declared basis, time open since filing (DEC-9), never stored as mutable state |
| DM-3 | Closure record | One explicit closure decision (the `retro.action-closure` record kind, DEC-7): the route (done with artifact, deprioritized with reason, superseded with its superseding action reference recorded as the justification), the decision reference, the required justification, and the two closure planes — `artifactClosure` and `outcomeClosure` states with the non-null verification window while outcome closure is open; done closes the artifact plane, deprioritized and superseded close both planes in the one decision (DEC-11) |
| DM-4 | Actions board rows | The board's additive actions member beside the asks: per-row identity, repository, action reference, owner, level, age, and aging state, under the payload's declared identity with counted omissions |
| DM-5 | Window WIP disclosure | Per improvement window: the declared limit (fixed contract data, value 3 — DEC-6), the open action count, and the disclosure rendered wherever the window is reported |

### 8.4 External Integrations

- **Tracker (existing integration)**: actions reference real tracker entries; corroboration is read-only through the delivered tracker reads. Where the tracker cannot be reached, the referenced entry stays recorded data with its corroboration state disclosed — never silently trusted or fabricated.
- **Delivered telemetry (advisory)**: an outcome verifier may name the delivered spend/telemetry figures as its delayed-metric evidence; where telemetry is absent, the classified absence outcome applies — never a zero. The milestone pack marks `telemetry.v1` advisory for this story: consumed at delivery, the owning story declares the edge.

### 8.5 Backward Compatibility

- The delivered `retro report` payload identity and its four delivered keys remain valid and unchanged: `retro report`'s `data` gains no new top-level key in this change (DEC-10). The follow-through fold's injected-reader contract is preserved, with the registry becoming the production reader — entries become foldable from recorded registry actions through the composed follow-through reader, so the fold's entries gain provenance from the new records; any registry-derived addition is confined to entries within the delivered `followThrough[]` fold.
- The delivered ceremony declarations, note schema, verdict vocabularies, and the asserted follow-through-first position are unchanged; the registry is a new read/write counterpart to the existing declared-actions handoff.
- The board payload keeps its declared identity; the actions surface is additive — nothing is removed, renamed, or re-semanted, so existing consumers keep reading the four delivered sections unchanged. The delivered sections' caps and byte-guard behavior remain as shipped, with the new surface integrated into the declared drop order.
- The delivered four `retro` error identities keep their codes and semantics; the three new identities are additive exact rows under the same `retro` domain kind (DEC-5), and the machine and documented error tables stay in two-way sync in the same change.
- The delivered retro registry's three record kinds and level statuses are unchanged — action records live in their own validated boundary under new store-scoped key prefixes (DEC-7), composed additively with no schema-version bump; no migration of existing records is required.

## 9. NON-FUNCTIONAL REQUIREMENTS (NFRs)

| ID | Requirement | Threshold |
|----|-------------|-----------|
| NFR-1 | Determinism | Byte-identical repeat renders for identical stored actions, injected clock, and injected run id; zero model calls on any render or verification path |
| NFR-2 | Bounded output | Machine `data` ≤ 65,536 UTF-8 bytes; the board's actions surface uses per-repository row caps with counted omissions (`truncated` plus per-section counters), participates in the byte guard's declared drop order, and never drops silently; free-form text fields (measurable outcome, closure reason) are bounded |
| NFR-3 | Aging exactness | Nudge fires at exactly 14 days of time open since the recorded filing timestamp and escalation at 30 days of time open or the second missed due date (two due-date lapse events), evaluated deterministically on the injected clock at the day boundary; threshold-1 and threshold+1 render differently; zero ambient clock reads |
| NFR-4 | Offline verification | 100% of new tests run offline on committed fixtures and fixture-seeded stores; zero live tracker, network, credential, or harness-store access on any test path |
| NFR-5 | Write discipline | Every mutation (file, close, supersede) is an explicit invocation-gated write through the state layer's fenced append discipline; zero background writes, zero write amplification, no update-in-place — lifecycle transitions are recorded, never mutated |
| NFR-6 | Read cost | The board's actions projection composes within the delivered board budget — pure projection and render of a cap-sized board completes inside 50 ms warm median (I/O excluded) — with one bounded registry read per invocation and no per-row re-reads |
| NFR-7 | Privacy | Records and renders carry references, identities, roles, dates, and bounded text only — never prompt text, transcripts, diffs, tool output, or credential material; the delivered redaction chokepoint composes on every render path |
| NFR-8 | Error-table binding | Any new identity round-trips in both the machine and documented error tables with the classifier; no family or pattern widening; the reserved exact-code allowlist grows only as the binding rules require, in the same change |

## 10. TELEMETRY & OBSERVABILITY REQUIREMENTS

- Every filing refusal names the missing or offending contract field; every closure refusal names the missing decision or justification — or, for an already-closed plane, the plane and its existing closure; the WIP-limit refusal names the window, its open count, and its limit — no refusal is generic.
- Aging states, window counts, and WIP disclosures render in-band wherever the affected data renders; a dropped or clamped row is always counted.
- Every invocation lands its delivered command-audit record (runId, timing, claimed identity); an audit-write failure is a diagnostic and never changes the outcome.
- Closure records carry the decision reference and justification, so any closure's provenance is inspectable from the records alone.
- No metrics exporter, event sink, alert channel, or background process is added; the records and envelopes are the observability surface. Doctor state-store visibility gains a store verdict for the action-registry boundary, following the delivered store-verdict pattern (DEC-7).

## 11. RISKS & MITIGATIONS

| ID | Risk | Impact | Probability | Mitigation | Residual Risk |
|----|------|--------|-------------|------------|---------------|
| RSK-1 | Verification artifacts rot: an action's referenced artifact becomes unreadable or unresolvable, degrading follow-through verification | M | M | Verification degrades to the declared unverified/unknown verdicts — never fabricated; the artifact reference and its verification state stay visible on the record and the board; aging continues so degraded actions do not disappear | M |
| RSK-2 | The WIP limit conflicts with incident-driven action bursts (a severe incident retro produces several mandatory actions) | M | M | The limit is per improvement window, not per level or per incident; the value is the concept's stated maximum (3, DEC-6) chosen for burst headroom; explicit deprioritize and supersede routes free slots deliberately; the refusal names window, count, and limit so the collision becomes a prioritization decision, never silent accumulation | M |
| RSK-3 | Retro theater shifts location: actions declared in ceremony handoffs are never filed, so the registry never sees them and follow-through verifies an empty set | M | M | The follow-through phase verifies recorded actions, so an unfiled action cannot pass as applied; the board and window disclosures make an empty or thin registry visible; the ceremony handoff remains the declaration of record, and the residual gap is stated rather than hidden | M |
| RSK-4 | Vocabulary or pattern divergence between the actions surface and the delivered board/status/brief patterns (a second state vocabulary) | M | L | The actions surface reads a named source and follows the board's shared-source, bounded, deterministic, counted-omission patterns; contract tests pin the payload identity and section order | L |
| RSK-5 | Error-table and allowlist growth breaks the delivered binding invariants (two-way sync, reserved exact-code list) | M | L | New identities follow the exact-code discipline as three additive exact rows under the delivered `retro` domain kind with no new domain kind and no family or pattern widening (DEC-5); the sync and structure checks stay green in the same change | L |
| RSK-6 | Aging basis ambiguity (days open versus days past due) renders inconsistent states across surfaces | L | M | Both filing date and due date are recorded on every action (DM-1); the basis is pinned as time open since the recorded filing timestamp — one declared contract constant evaluated in one place (DEC-9, NFR-3) — and due dates feed only the second-miss counter; determinism tests pin boundary behavior | L |
| RSK-7 | Filing refusals frustrate urgent flows (an urgent incident action missing a field cannot be filed mid-incident) | M | M | The refusal names the exact missing or offending field, making the fix mechanical; the fields are the concept's minimum accountability contract, and deprioritize/supersede exist for deliberate deferral; no bypass path is added (a bypass would recreate the silent-drift problem) | L |

## 12. ASSUMPTIONS

- The delivered ceremony runner keeps its asserted follow-through-first phase position and its declared-actions handoff; the registry integrates as the receiving producer without agenda changes.
- Verification artifacts are locally inspectable references (tests, pull requests, tickets, metric citations) or declared absent/unverifiable; no new network verification capability is introduced.
- Tracker corroboration uses the delivered tracker read integration where available; a reachable tracker is assumed for "real tracker entry" validation at filing, with the corroboration state disclosed when unreachable.
- The injected-clock convention governs all aging computations; no ambient time read exists in any evaluation path.
- R6 (fleet) remains declared-but-unscheduled; the registry's level coverage includes it by design but nothing in this change activates or schedules it.
- The concept's "1-3 actions per window" range is narrowed to the declared contract-data value 3 with refusal enforcement (DEC-6); the concept text is otherwise verbatim contract.

## 13. DEPENDENCIES

| Direction | Item | Notes |
|-----------|------|-------|
| Depends on | Retro evidence pipeline and retro registry (M1-S8, delivered) | The follow-through read-fold gaining its producer; declared levels R1-R6; evidence sidecar and run records; the four retro error identities |
| Depends on | Ceremony runner (M2-S3, delivered) | The retro-evidence-pass levels, the asserted follow-through-first phase, and the declared-actions handoff this registry receives |
| Depends on | Board (M2-S4, delivered) | The additive surface beside the asks; shared-source, bounds, byte-guard, and determinism patterns |
| Depends on | Harness telemetry v2 (M2-S14, delivered) | Advisory evidence inputs for outcome verifiers, per the milestone pack |
| Depends on | State layer, result contract, error table, configuration layer, branding seam (delivered) | Validated boundaries and fenced appends; envelope, exit projection, redaction, retro domain rows, exact-code binding rules; brand-neutral naming |
| Depends on | Tracker integration (delivered) | Read-only corroboration of referenced tracker entries |
| Blocks | Communication analytics (future, conditional) | Joins the evidence inputs once the message contract exists; this change records the condition, not the capability |
| Informs | M2-S6 metrics (future consumption) | Verified versus outcome-verified closure counts are named concept metrics the registry's records make computable |
| Informs | R6 fleet retro (post-M4) | The registry's level coverage extends to fleet actions when that level activates |

## 14. OPEN QUESTIONS

| ID | Question | Context | Status |
|----|----------|---------|--------|
| OQ-1 | Beyond the blueprint-pinned `retro.action-incomplete`, which refusal identities does the registry add (closure without decision/justification, WIP-limit outcome), and do they extend the delivered `retro` domain kind's four rows or introduce a new action-registry domain kind? | The blueprint pre-declares `retro.action-incomplete` as a kind-first two-segment code under the `retro` domain, suggesting additive extension of that domain's rows; the delivered table has exactly four `retro` rows, a reserved exact-code allowlist, and two-way sync rules that any growth must satisfy | Resolved — DEC-5: three additive exact two-segment rows under the delivered `retro` domain kind (`retro.action-incomplete`, `retro.closure-incomplete`, `retro.wip-limit-exceeded`); no new domain kind, no family or pattern widening |
| OQ-2 | What exact improvement WIP limit value is declared within the concept's 1-3 range, is it fixed contract data or declared per window in the window's data, and is a filing into a window at its limit refused with a classified error or recorded as a declared warning outcome? | The concept states "at most 1-3 actions per window" without pinning the value or the enforcement mode; the pinned scenarios do not cover the limit, so the plan must declare both consistently with the filing-refusal pattern | Resolved — DEC-6: the limit is the declared contract-data value 3 (fixed constant, not per-window data) and a filing into a window at its limit is refused with the classified identity `retro.wip-limit-exceeded` naming window, count, and limit; no action row lands |
| OQ-3 | Where do action records live — additive record kinds under the delivered retro registry's validated boundary, or a distinct action-registry boundary — and what is the filing surface's shape (new command family, or verbs beside the delivered retro family)? | The delivered retro registry declares "exactly three" record kinds, so extension is a contract change to that boundary; the milestone pack pre-declares no S10 surface (unlike telemetry), and the ceremony family deliberately registers no action verb. The resolution decides which feature contract owns validation, which page reconciles, and whether the doctor gains a store verdict | Resolved — DEC-7: action records live in their own validated boundary with the additive `retro.action` and `retro.action-closure` record kinds under new `retro.`-family key prefixes (the delivered boundary's "exactly three" declaration is unchanged); the filing surface is an additive `action` verb group within the delivered `retro` command family — no new command family; the doctor gains an action-registry store verdict |

## 15. DECISION LOG

| ID | Decision | Rationale | Date |
|----|----------|-----------|------|
| DEC-1 | Communication analytics (unanswered asks, ask aging, escalation rates) are excluded from this delivery. The ticket makes them conditional on the message contract existing (`concepts/inter-agent-communication.md`); that concept is explicitly parked with nothing scheduled and the contract does not exist, so the condition is unmet. The condition is recorded so the next change can revisit | PM scope resolution recorded in pm-notes; the ticket's own conditional wording is honored rather than inventing a message contract into this change | 2026-11-16 |
| DEC-2 | The failure-to-regression-test compiler is excluded from this delivery. The concept's story mapping mentions it folding into M2-S10, but the ticket's task list and AC omit it, and the backlog story (canonical with the ticket) omits it; ticket and backlog are the scope authority. Noted for the owner in the PR description | PM scope resolution recorded in pm-notes; nothing is invented beyond the named sources | 2026-11-16 |
| DEC-3 | Aging and escalation states are derived deterministically at read and render time from recorded action dates; no scheduler, daemon, timer, or background process writes them | Consistent with the delivered ceremony-runner and board conventions (no scheduler, no background writes); derived state is testable on the injected clock and cannot drift from stored state (NG-6, NFR-3, NFR-5) | 2026-11-16 |
| DEC-4 | Outcome closure is explicit like artifact closure: it transitions only through an explicit decision citing the outcome verifier's evidence within the declared verification window, and never silently from elapsed time or as a side effect of artifact closure | The concept's governing rule is "closure only explicit" and it distinguishes the two planes ("artifact closure: the guard exists" versus "outcome closure: the metric moved as predicted"); SC-M2-S10-02 pins the open state with its window, and an implicit outcome verdict would reintroduce exactly the silent-drift problem this change exists to end | 2026-11-16 |
| DEC-5 | The registry's refusal identities are exactly three additive exact two-segment rows under the delivered `retro` domain kind: `retro.action-incomplete` (filing contract refusal — blueprint-pinned, SC-M2-S10-01), `retro.closure-incomplete` (closure without an explicit decision or route justification, and outcome-closure attempts without the evidence-citing decision), and `retro.wip-limit-exceeded` (filing into a window at its declared limit, per DEC-6). No new domain kind; no family or pattern widening; the delivered four `retro` rows keep their codes and semantics; the machine table, documented table, and classifier round-trip in the same change | The pinned scenario forces the filing identity to parse under the `retro` domain (`retro.action-incomplete` is a kind-first two-segment code), so a separate action-registry domain kind would split one surface's failures across two kinds and break the anchor the blueprint already set; growing an existing domain kind's rows additively is delivered precedent (GH-291's `harness` rows; GH-297's exact two-segment board identities joining the allowlist by declaration), and one code per declared discriminant keeps each remediation hint mechanical — a generic shared code or `input.value.rejected` reuse would blur domain-contract refusals with invocation-grammar failures (@decision-advisor adjudication of OQ-1) | 2026-11-16 |
| DEC-6 | The improvement WIP limit is the declared contract-data value 3 — one fixed constant maintained like the aging thresholds, not per-window declared data — and a filing into a window at its limit is refused: exit 1 with `retro.wip-limit-exceeded` naming the window, its open count, and its limit; no action row is created. Deprioritize and supersede are the deliberate routes that free a slot, and the window's count and limit are disclosed wherever the window is reported | The concept's "at most 1-3" is a bound, not a suggestion: a limit that can be exceeded with a recorded warning recreates the action-graveyard failure mode the concept's defense table targets and contradicts the WIP-focus KPI (windows stay within the limit); the concept's stated maximum gives incident-driven bursts headroom where the tight end (1) would force constant supersede churn (RSK-2); a fixed constant matches the aging-threshold contract-data pattern and stays additive — a future per-window override can be declared beside the constant, while removing a per-window knob later could not (@decision-advisor adjudication of OQ-2) | 2026-11-16 |
| DEC-7 | Action records live in their own validated state-store boundary: the additive record kinds `retro.action` (one filed action, DM-1) and `retro.action-closure` (one explicit closure decision, DM-3) under new store-scoped key prefixes in the `retro.` family (`retro.actions:`, `retro.action-closures:`), one boundary declaration through the reusable artifact-boundary factory over the public state port — no schema-version bump, no migration, no new runtime-API location; the delivered retro-registry boundary and its "exactly three" declaration are unchanged. The filing surface is an additive `action` verb group within the delivered `retro` command family (illustratively `retro action file` / `retro action close` / `retro action list`; the exact verb grammar is a plan-level refinement) — `retro collect` and `retro report` keep their grammar and semantics, no new command family joins the prompt-required set, and the doctor gains an action-registry store verdict following the delivered store-verdict pattern | Every new durable consumer in this repo declares its own boundary (ceremony, blockers, queue, economics), so a sibling boundary is the paved road, preserves the delivered "exactly three" contract unchanged, gives the new action-registry feature page end-to-end ownership of its records, and keeps board/ceremony reads validating only action records; the concept's own language names the retro command family as the registry's family ("The `ados retro` command family (registry) runs levels on demand") and the pinned error domain agrees, while a new family would additionally grow the §8.1 prompt-required command set, the entrypoint composition, and the help-guide coverage machinery for no design gain; extending the family is grammar-additive and the retro-pipeline page is already scheduled for reconciliation in this change (@decision-advisor adjudication of OQ-3) | 2026-11-16 |
| DEC-8 | A contract-rule violation at filing — a team-owned owner, a verb outside the closed vocabulary, a placeholder tracker entry — is refused with the same classified filing identity as a missing field: exit 1, `retro.action-incomplete`, naming the offending field. A field that is present but non-conforming to its contract rule is incomplete for filing purposes; the refusal always names the missing or offending field. No fourth identity is introduced and DEC-5's exactly-three rule is intact | The filing surface has exactly one refusal identity (DEC-5, blueprint-pinned by SC-M2-S10-01); a missing member and a non-conforming member share one discriminant — the filing contract is not satisfied — so one code whose detail names the offending field keeps remediation mechanical for both cases, while a fourth identity would break the exactly-three rule and the allowlist's declared additive growth (@decision-advisor adjudication of the reopened specification phase, v1.2) | 2026-11-16 |
| DEC-9 | The aging basis is pinned: the 14-day and 30-day thresholds measure time open since filing — elapsed time from the action's recorded filing timestamp — and "second miss" means a second missed due date: two due-date lapse events on the action's record, independent of time open. Due dates feed only the miss counter; the basis is one declared contract constant evaluated in one place | The concept's own language is that actions age — open time, the same quantity the board's delivered ask-age pattern already renders — and day thresholds on due dates would leave a not-yet-due action unageable while conflating the age signal with the miss signal; recording both dates (DM-1) keeps the miss counter exact on due-date lapses, and the pin resolves RSK-6's days-open-versus-days-past-due ambiguity in one place (@decision-advisor adjudication of the reopened specification phase, v1.2) | 2026-11-16 |
| DEC-10 | The registry's producer side feeds the delivered `followThrough[]` fold of `retro report`: entries become foldable from recorded registry actions through the composed follow-through reader, with the delivered injected-reader contract preserved and the registry as the production reader. `retro report`'s `data` gains no new top-level key in this change — the four delivered keys are unchanged — and the fold's entries gain provenance from the new records; any registry-derived addition is confined to entries within the delivered fold | The delivered `delivery.retro.report.v1` payload identity and its consumers stay stable: the fold was designed reader-injected exactly so a producer could land without a schema change, and no consumer need exists for a new top-level key; confining additions to entries inside the delivered fold keeps the delivered exact-keys assertion unmoved and the change strictly additive (@decision-advisor adjudication of the reopened specification phase, v1.2) | 2026-11-16 |
| DEC-11 | Closure edge cases pinned: (a) the deprioritized and superseded routes close both planes with the one explicit decision — the recorded reason, or the superseding action reference, is the closure justification for the artifact and the outcome planes alike — while the done route closes the artifact plane only, its outcome plane still requiring the evidence-citing decision of DEC-4, and outcome closure never results from elapsed time on any route; (b) a closure decision targeting an already-closed plane is refused as a state conflict — exit 1 under `retro.closure-incomplete`, the refusal naming the plane and its existing closure decision, and no second closure record lands — a discriminant distinct in detail from the identity's missing-decision/justification cases, with DEC-5's exactly-three rule intact; (c) the supersede route records its superseding action reference on the `retro.action-closure` record | A deprioritized or superseded action's outcome window is mooted by the decision, not by time: leaving its outcome plane open would re-create the never-closed drift this change ends and would keep a deliberately dead action counted against its window's WIP limit (DEC-6), while a done action's metric still deserves its window; an already-closed plane has no valid transition to record, so under the append-only discipline a repeat closure could only be a conflicting duplicate and the refusal names that state rather than implying a missing input; recording the superseding reference keeps closure provenance inspectable from the records alone (Section 10) (@decision-advisor adjudication of the reopened specification phase, v1.2) | 2026-11-16 |

## 16. AFFECTED COMPONENTS (HIGH-LEVEL)

| Component | Impact |
|-----------|--------|
| Retro action registry (records, filing validation, aging, closure, WIP) | New — the change's core; its own validated state-store boundary with the `retro.action` and `retro.action-closure` record kinds (DEC-7) |
| Filing and closure surfaces (CLI) | New — the invocation-gated entry points over the registry; an additive `action` verb group within the delivered `retro` family (DEC-7) |
| Board | Updated — additive actions surface beside the asks, integrated into the declared bounds, ordering, omission counters, and byte guard |
| Retro evidence pipeline | Unchanged — consumed as delivered; the follow-through read-fold gains its production reader without grammar, truth-check, sidecar, chain, or top-level `data`-key changes (DEC-10) |
| Ceremony runner | Unchanged — its follow-through-first phase and handoff are the declared counterpart; no declaration, agenda, or schema change |
| Error table and classifier | Updated — additive refinement under the binding rules: three exact identities under the `retro` domain kind (DEC-5) |
| State layer | Unchanged — new validated records or boundary composed additively; no new runtime-API location |
| Doctor | Updated — a store verdict for the action-registry boundary following the delivered store-verdict pattern (DEC-7) |
| Feature spec pages (system docs, phase 7) | New/Updated — a new page for the action registry; reconcile the retro-pipeline page (enforcement delivered, the additive `action` verb group in the command surface, and the sibling action-registry boundary), the ceremony-runner page (handoff boundary landed), and the board page (actions surface); landing-page and glossary registration |
| Command reference pages (`doc/planning/oss-tooling/milestones/m2/commands/`) | Updated — a new M2 reference page for the retro family's extended surface per the M2 page-root pattern (the M1 snapshot stays byte-unchanged); help-guide coverage inventory updated in the same change |
| Planning pages (`doc/planning/oss-tooling/`) | Updated — backlog progress markers and status snapshot per convention |

## 17. ACCEPTANCE CRITERIA

| ID | Criterion | Linked |
|----|-----------|--------|
| AC-F1-1 | **Given** an action missing its measurable outcome, **when** it is filed, **then** the registry refuses it with exit 1 and `error.code == "retro.action-incomplete"` naming `measurableOutcome`, and `actions[]` stays empty — no action row is created | F-1 |
| AC-F1-2 | **Given** an action carrying all five fields but violating a contract rule — a team owner, an unverifiable verb ("review" or "improve"), or a placeholder tracker entry — **when** it is filed, **then** the filing is refused with exit 1 and `error.code == "retro.action-incomplete"` naming the offending field — a field present but non-conforming to its contract rule is incomplete for filing purposes (DEC-8) — and no action row is created | F-1, F-2, DEC-8 |
| AC-F2-1 | **Given** a conforming action, **when** it is filed, **then** the record carries the named owner (agent role or human), a verifiable verb from the closed vocabulary, the measurable outcome, the real tracker entry, the due date, the verification artifact reference, the outcome verifier with its non-null delayed metric window, and the rollback condition | F-2, DM-1 |
| AC-F3-1 | **Given** an open action whose recorded dates pass a threshold — 14 days open since the action's recorded filing timestamp (the declared aging basis), or 30 days open, or a second missed due date (two due-date lapse events on the action's record) — **when** aging is evaluated and the board renders, **then** the action carries the corresponding nudge or escalated state, and an action one day before a threshold renders the lower state | F-3, DM-2, NFR-3, DEC-9 |
| AC-F4-1 | **Given** a closure attempt without an explicit decision, or lacking the route's required justification — an artifact for done, a reason for deprioritized, a successor for superseded — **when** closure is attempted, **then** it is refused with exit 1 and `error.code == "retro.closure-incomplete"` naming what is missing, and no closure transition occurs | F-4, DM-3, DEC-5 |
| AC-F4-2 | **Given** an action whose artifact is complete but whose outcome window is open, **when** it is closed on the artifact route, **then** the registry records `artifactClosure == "closed"` and leaves `outcomeClosure == "open"` with a non-null verification window | F-4, DM-3 |
| AC-F4-3 | **Given** an action whose artifact plane was closed on the done route and whose verification window has elapsed, **when** no explicit outcome decision citing verifier evidence exists, **then** `outcomeClosure` remains open — outcome closure never follows from elapsed time or from artifact closure alone | F-4, DM-3, DEC-4 |
| AC-F4-4 | **Given** an open action closed on the deprioritized or superseded route, **when** the explicit decision records its justification — the reason, or the superseding action reference carried on the `retro.action-closure` record — **then** both `artifactClosure` and `outcomeClosure` close with that one decision: the decision's justification is the outcome plane's closure justification, the verification window is mooted by the decision and not by time, and elapsed time alone closes no plane on any route | F-4, DM-3, DEC-4, DEC-11 |
| AC-F4-5 | **Given** an action with a closure plane already closed, **when** a closure decision targets that plane again, **then** the attempt is refused with exit 1 and `error.code == "retro.closure-incomplete"` naming the plane and its existing closure decision — a state conflict, not a missing-justification refusal — and no second closure record is created | F-4, DM-3, DEC-5, DEC-11 |
| AC-F5-1 | **Given** an improvement window at its declared WIP limit (3 open actions), **when** another action is filed into that window, **then** the filing is refused with exit 1 and `error.code == "retro.wip-limit-exceeded"` naming the window, its open count, and its limit, and no action row is created — the excess is never recorded | F-5, DM-5, DEC-6 |
| AC-F6-1 | **Given** open actions with aging states, **when** the board renders, **then** the actions surface renders beside the owner asks with each row's identity, repository, owner, level, age, and aging state, in deterministic order with counted omissions under the delivered bounds | F-6, DM-4, NFR-2 |
| AC-F6-2 | **Given** two successive board invocations over unchanged stored actions, **when** both render, **then** the machine data and the human screen are byte-identical | F-6, NFR-1 |
| AC-F7-1 | **Given** a window or project retro (R4+) with recorded actions, **when** the retro opens, **then** its first agenda item is artifact-verified follow-through over the registry's recorded actions — verdicts (`applied`/`partial`/`violated-with-consequence`) are assigned from verification-artifact evidence, never from owner status claims | F-7, F-3, DEC-10 |
| AC-F7-2 | **Given** actions filed from any retro level — the change closeout, a session, an incident, a window, or a project retro — **when** any level's follow-through is verified, **then** the same registry, five-field contract, aging, and closure discipline serve that level with no per-level fork | F-7, F-1 |
| AC-N8-1 | **Given** the three new error identities introduced by this change (`retro.action-incomplete`, `retro.closure-incomplete`, `retro.wip-limit-exceeded`), **when** the error-table checks run, **then** the machine table, the documented table, and the classifier agree in both directions, with no family or pattern widening | NFR-8, DEC-5 |

Traceability note: AC-F1-1 and AC-F4-2 are the pinned scenarios SC-M2-S10-01 and SC-M2-S10-02 verbatim in Given/When/Then form. The ticket's six ACs decompose as: an action without all five fields cannot be filed (AC-F1-1, AC-F1-2), every R4+ retro opens with artifact-verified follow-through (AC-F7-1), aging is visible on the board (AC-F3-1, AC-F6-1), no action closes without an explicit decision and artifact or reason (AC-F4-1), actions carry outcome verifiers and rollback conditions (AC-F2-1), and closure distinguishes artifact closure from outcome closure (AC-F4-2, AC-F4-3, AC-F4-4).

## 18. ROLLOUT & CHANGE MANAGEMENT (HIGH-LEVEL)

- Delivered through the repository's standard change lifecycle on the change branch for this ticket: plan phases declared in the change's plan, each phase gated and committed at its boundary, quality gates green before the pull request, and the pull request targeting the tooling integration branch (`main-tools`).
- The change is additive and self-contained: the registry starts empty, no operator migration or backfill action is required, and existing retro, ceremony, and board behavior remains valid on upgrade (Section 8.5).
- Follow-through enforcement activates for retro levels as they run; ceremony-served levels pick up the registry as their verification source without ceremony changes.
- Planning-page maintenance (backlog markers, status snapshot) rides this change per the repository's planning convention; system-spec reconciliation happens in the dedicated documentation phase.
- The two scope exclusions (DEC-1, DEC-2) are stated in the PR description so the owner sees them without reading the spec.

## 19. DATA MIGRATION / SEEDING (IF APPLICABLE)

- No migration of existing data is required. The registry accumulates from filing onward; retro actions that predate this change are not backfilled (NG-9).
- An empty registry is a valid, explicit state: follow-through verification over no recorded actions is a verified-empty outcome, never an error and never fabricated content (consistent with the delivered null-retro-is-a-success rule).
- Delivered retro registry records and evidence sidecar data remain readable unchanged; no existing record kind is re-semanted.
- Test seeding uses committed fixtures and fixture-seeded local stores with injected clocks; no live tracker, network, or credential access (NFR-4).

## 20. PRIVACY / COMPLIANCE REVIEW

- Action records and every render carry references, identities (agent role or human owner), tracker and artifact references, dates, and bounded text (measurable outcome, closure reason) only — never prompt text, transcripts, diffs, tool output, or credential material (NFR-7).
- Owner identity is recorded attribution, never an authorization input; the claimed-identity convention composes unchanged.
- All registry data stays local under the state directory's least-privilege contract; the change adds no network egress, no background process, and no new retention regime (state-layer retention applies).
- The delivered redaction chokepoint composes on every new render path; registered secret values never survive into any record, envelope, or board row.

## 21. SECURITY REVIEW HIGHLIGHTS

- Every registry mutation is an explicit invocation-gated write through the state layer's fenced append discipline; there is no background write path, no update-in-place, and no delete (lifecycle transitions are recorded) — consistent with the append-only discipline of the delivered retro plane.
- Reads fail closed: a malformed registry record classifies through the delivered shape-crash guard discipline and is never served as verified truth or silently dropped.
- No credentials are resolved, stored, or rendered by any filing, aging, closure, or board path; tracker corroboration is read-only through the delivered integration.
- Claimed identities (owner, collector) are attribution only, never verified authentication and never an authorization input.
- Brand neutrality: registry schema names, vocabulary tokens, and user-facing surfaces follow the brand-neutral delivery naming pattern; no hardcoded product or binary names.

## 22. MAINTENANCE & OPERATIONS IMPACT

- The five-field contract vocabulary, aging thresholds (14/30 days of time open since filing, and the second due-date lapse — DEC-9), closure routes and their plane effects (DEC-11), and the WIP limit (value 3, DEC-6) are maintained contract data: future changes go through the reviewed change process, and the concept remains the design authority.
- Artifact rot is an expected operational state (RSK-1): operators read verification states from the records and the board rather than assuming artifact availability; degraded verdicts are declared, not repaired silently.
- Registry growth is bounded by the WIP limit per window plus explicit closures; retention follows the state-layer convention with no prune path.
- Downstream consumers (metrics, future analytics) must read closure and aging states from the records rather than re-deriving them; the explicit-closure rule makes the records the single authority.
- The deferred items (communication analytics, regression-test compiler, closure-rate metrics) are recorded here and in the planning pages so their next home is a documented decision, not tribal memory.

## 23. GLOSSARY

| Term | Definition |
|------|------------|
| Action registry | The retro follow-through memory: validated action records with filing validation, aging, explicit closure, and the board surface, behind every retro level |
| Five-field contract | Named owner (agent role or human), verifiable verb (add/remove/change/test/deploy — never "review"/"improve"), measurable outcome, real tracker entry, due date — plus the verification artifact; team-owned actions are invalid |
| Verification artifact | The concrete evidence an action is verified against at follow-through time — a test, metric, pull request, or ticket reference — never the owner's status claim |
| Outcome verifier | The delayed metric window recorded at filing that will show whether the intended behavior actually changed |
| Rollback condition | The recorded condition stating when the change an action produced should be undone |
| Artifact closure | Closure in the "the guard, test, or change exists" plane — via done (with artifact), deprioritized (with reason), or superseded (with the superseding action reference) |
| Outcome closure | Closure in the "the metric moved as predicted" plane — explicit only: for a done action, a decision citing the outcome verifier's evidence within the declared window; for a deprioritized or superseded action, the same explicit decision that closes the artifact plane (DEC-11) |
| Aging | The derived classification of an open action by time open since its recorded filing timestamp: current, nudged (14 days), escalated (30 days or a second missed due date) |
| Second miss | A second missed due date on the same action — two due-date lapse events on its record; triggers escalation regardless of time open (DEC-9) |
| Improvement WIP limit | The declared cap on open improvement actions per window — the fixed contract-data value 3 within the concept's 1-3 range (DEC-6), enforced as a classified filing refusal |
| Improvement window | The retro window an action is filed into; the scope of its WIP limit and disclosure |
| Superseded | The closure route where an action is replaced by a declared successor action whose reference the closure record carries; closes both planes in the one decision (DEC-11) |
| Retro theater | Rewarding written actions over closed ones; defended by filing validation, aging visibility, WIP limits, and explicit-closure discipline |
| Verified-empty | The explicit outcome that a level has no recorded actions to verify — a success, never fabricated content |

## 24. APPENDICES

### Appendix A — Source traceability

| Source | Content used |
|--------|--------------|
| Ticket GH-287 (milestone M2, label `change`) | Goal, tasks, the six verbatim ACs, delivery conventions, dependency on M1-S8 |
| Backlog M2-S10 (canonical with the ticket) | Story goal, tasks (registry behind every level, five-field contract, aging, closure rules, board surface, WIP limit), AC, dependency list |
| Milestone pack m2/ (test-scenarios.md, README.md) | Pinned scenarios SC-M2-S10-01/02 with the pre-declared error identity `retro.action-incomplete`; the advisory `telemetry.v1` consumption row |
| `concepts/retrospectives.md` (design authority) | Five-field contract members and verb vocabulary, aging ladder, closure routes, outcome verifier and rollback condition, artifact-versus-outcome closure, WIP range, board surface next to asks, R4+ follow-through-first agenda, failure-mode defense table |
| pm-notes (clarify_scope) | Scope resolutions DEC-1/DEC-2, pinned scenarios, concept constraints, delivery conventions, doc-impact anticipations |
| Current-truth system specs | `feature-retro-pipeline.md` (follow-through fold, levels, error identities), `feature-ceremony-runner.md` (handoff boundary, follow-through-first, verdict vocabulary), `feature-board.md` (payload identity, shared source, bounds, byte guard, read-only posture), `feature-telemetry-v2.md` (advisory evidence) |
| Delivered error table | The four `retro` domain rows and the exact-code binding rules (DEC-5 context) |

### Appendix B — Pinned scenarios (verbatim intent)

- **SC-M2-S10-01** (Five-field action cannot be filed incomplete): Given an action missing its measurable outcome, when it is filed, then the registry refuses it with a classified error naming the missing field, and no action row is created. Assert: filing exits 1 with `error.code == "retro.action-incomplete"` naming `measurableOutcome`, and `actions[]` stays empty.
- **SC-M2-S10-02** (Action closure distinguishes artifact closure from outcome closure): Given an action whose artifact is complete but whose outcome window is open, when it is closed, then the registry records artifact closure and leaves outcome closure open with its verification window. Assert: `data.artifactClosure == "closed"` and `data.outcomeClosure == "open"` with a non-null verification window.

### Appendix C — Concept constraints binding this change (from `concepts/retrospectives.md`)

- Five-field contract: named owner (agent role or human; team-owned actions invalid), verifiable verb (add, remove, change, test, deploy — never "review" or "improve"), measurable outcome, real tracker entry, due date — plus the verification artifact.
- Aging: nudge at 14 days; escalate at 30 days or on a second miss; aging is board-visible, never silent drift.
- Closure only explicit: done with artifact, deprioritized with reason, superseded; artifact closure (the guard exists) is distinct from outcome closure (the metric moved as predicted).
- Actions carry an outcome verifier (a delayed metric window) and a rollback condition.
- Improvement WIP limit: at most 1-3 actions per window.
- Follow-through first: the first item of every R4+ retro inspects each open action's verification artifact, with the verdict vocabulary applied / partial / violated-with-consequence over read evidence.

## 25. DOCUMENT HISTORY

| Version | Date | Author | Changes |
|---------|------|--------|---------|
| 1.0 | 2026-11-16 | @spec-writer | Initial specification for GH-287 (M2-S10 Retro action registry and follow-through) from ticket, backlog, milestone pack, concept constraints, pm-notes decisions, and current-truth system specs |
| 1.1 | 2026-11-16 | @decision-advisor | Resolved OQ-1..OQ-3 as DEC-5/DEC-6/DEC-7 (error-identity placement under the `retro` domain kind; WIP limit value 3 as fixed contract data with refusal enforcement; own validated boundary plus an additive `action` verb group in the `retro` family) and reconciled every downstream reference |
| 1.2 | 2026-11-16 | @decision-advisor | Reopened specification phase, pinning the five test-plan traceability findings: DEC-8 (a contract-rule violation at filing — team owner, unverifiable verb, placeholder tracker entry — is refused as `retro.action-incomplete` naming the offending field; present-but-non-conforming is incomplete for filing purposes), DEC-9 (the aging basis is time open since the recorded filing timestamp; second miss is a second missed due date — two due-date lapse events), DEC-10 (the registry produces the delivered `followThrough[]` fold; `retro report`'s `data` gains no new top-level key, the four delivered keys unchanged), DEC-11 (deprioritized and superseded close both planes in the one explicit decision; a closure decision on an already-closed plane is refused as a state conflict under `retro.closure-incomplete` naming the plane and its existing closure; supersede records its superseding action reference); removed the stray NFR-8 links from AC-F1-1 and AC-F5-1; added AC-F4-4 and AC-F4-5; reconciled G-1, the KPI table, F-1/F-3/F-4/F-7, Flows 1/2/4, DM-2/DM-3, §7.1, §8.5, NFR-3, §10, RSK-6/RSK-7, §16, §22, AC-F1-2/AC-F3-1/AC-F4-3/AC-F7-1, and the glossary |

---

## AUTHORING GUIDELINES

- Sources: ticket GH-287 body (read from the tracker); backlog M2-S10 (canonical M2 scope); milestone pack m2/ (test-scenarios SC-M2-S10-01/02, README consumption row); `concepts/retrospectives.md` (the declared design authority); pm-notes (clarify_scope scope resolutions and conventions); current-truth system specs (feature-retro-pipeline, feature-ceremony-runner, feature-board, feature-telemetry-v2); the delivered error table (four `retro` rows verified against source).
- The two scope exclusions are the PM's recorded resolutions, stated as first-class non-goals with their conditions (DEC-1, DEC-2) rather than silent omissions.
- Integration names were verified against current truth before pinning: the `retro report` follow-through fold shape and verdicts, the ceremony runner's follow-through-first assertion and handoff boundary, the board payload identity and patterns, and the error table's `retro` rows.
- The three design points raised in Section 14 are resolved as DEC-5 (three exact error identities under the delivered `retro` domain kind), DEC-6 (WIP limit value 3, fixed contract data, classified refusal), and DEC-7 (own validated boundary plus an additive `action` verb group in the delivered `retro` family), each via @decision-advisor adjudication; no requirement is invented beyond the named sources.
- The spec is deliberately tech-neutral: record shapes, schema identities, payload member naming, and command-surface grammar are plan-level refinements constrained by the pinned scenarios (`retro.action-incomplete`, `artifactClosure`/`outcomeClosure`) and the delivered conventions.
- The reopened specification phase (v1.2) pinned the five test-plan traceability findings as DEC-8 through DEC-11 plus one editorial fix (the stray NFR-8 links removed from AC-F1-1 and AC-F5-1): each pin binds an ambiguity the test plan refused to interpret, so the spec's wording is the authority the test plan aligns to.
- No git operations are performed by this document's authoring; the orchestrator owns branch state and commits.

## VALIDATION CHECKLIST

- [x] `change.ref` matches provided `workItemRef` (GH-287)
- [x] `owners` has at least one entry
- [x] `status` is "Proposed"
- [x] All sections present in order (1–25 + guidelines + checklist)
- [x] ID prefixes consistent and unique (F-, DM-, NFR-, RSK-, OQ-, DEC-, AC-, G-, NG-)
- [x] Acceptance criteria reference at least one F-/DM-/NFR- ID and use Given/When/Then
- [x] Both pinned scenarios (SC-M2-S10-01, SC-M2-S10-02) appear verbatim in intent as binding ACs
- [x] All six ticket ACs traced to binding acceptance criteria (traceability note, Section 17)
- [x] Both scope exclusions marked explicitly (NG-1/NG-2 and [OUT] items, DEC-1/DEC-2)
- [x] NFRs include measurable values
- [x] Risks include Impact & Probability
- [x] Out-of-scope items start with `[OUT]`
- [x] No implementation details (no code file paths, no step-by-step tasks)
- [x] No content duplicated from linked docs beyond pinned constraint citation
- [x] Front matter validates per front_matter_rules (milestone verbatim from tracker and pm-notes)
