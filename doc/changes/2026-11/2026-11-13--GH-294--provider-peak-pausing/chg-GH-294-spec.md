---
change:
  ref: GH-294
  type: feat
  status: Proposed
  slug: provider-peak-pausing
  title: "M2-S17: Provider-aware peak pausing"
  version: "1.3"
  owners: ["engineering"]
  service: delivery-os
  labels:
    - provider-profiles
    - daemon
    - dispatch
    - queue
    - lanes
    - telemetry
    - events
    - cost-control
    - m2
  version_impact: minor
  audience: mixed
  security_impact: low
  risk_level: medium
  dependencies:
    internal:
      - "delivered provider profiles and watching (M1-S21): F-6 peak-window profile park with peak-window cause and absolute expiry, availability probe = declared + enabled + outside UTC peak window, UTC-only windows"
      - "delivered resident daemon (M1-S18): lane supervision, startup reconciliation, safe-boundary preemption, watch and degradation; production composition supervise-only (GH-238 residual)"
      - "delivered session economics (M1-S15): restart budget and resume-economics admission"
      - "delivered command-audit identity (M1-S22): the identity join telemetry attribution consumes"
      - "delivered telemetry v2 (M2-S14, PR #315): per-step token/call/cost ingest with five-dimension attribution and classified absence"
      - "delivered spend v2 read side: breakdowns by ticket, repository, lane, agent role, and model"
      - "delivered owner-hold semantics (#280): host-wide hold gate that outranks parks and provider windows"
      - "delivered queue lifecycle and per-ref single-flight (GH-292, PR #314)"
      - "delivered event taxonomy v1 (GH-290): dispatch.attempt and queue.graph topics with the declared S17 extension path"
      - "delivered watchdog and lane contracts: liveness verdicts, stall corroboration, preflight/teardown"
      - "delivered state layer: additive schema-versioned record kinds, fenced appends, classified damage"
    external:
      - "none (no new vendor, API, credential, or network surface; provider usage rides the delivered harness and provider seams)"
links:
  issue: https://github.com/juliusz-cwiakalski/agentic-delivery-os/issues/294
  related_changes: ["GH-294", "GH-290", "GH-291", "GH-292", "GH-280", "GH-238"]
  related_decisions: ["TDR-0025", "TDR-0028", "TDR-0029", "TDR-0030", "ADR-0003", "ADR-0005"]
  contracts:
    - "dispatch attempt records (delivery.dispatch.attempt.v1) gain the nominated provider profile"
    - "daemon lane records gain the nominated provider profile"
    - "peak-window rule schema versioned with the provider profile (windows, multipliers, buffers, bounded grace)"
    - "queue park cause set gains peak-window (mapped onto the existing provider-window condition type) and owner-hold"
    - "taxonomy version v2 carrying dispatch.attempt stop/parked/resumed kinds and queue.graph park-edge kind"
    - "window-scoped zero-spend evidence over the telemetry v2 storage identity (delivery.telemetry.storage.v1)"
    - "status digest and brief gain lane park fields (parked count, reason, until)"
---

# CHANGE SPECIFICATION

> **PURPOSE**: Extend provider peak windows from dispatch-admission gating to in-flight enforcement — every delivery nominates its provider profile at admission, the resident daemon parks in-flight lanes whose profile enters a peak window (bounded-grace stop, session state preserved) and resumes them automatically from preserved session state when the window ends — with a telemetry-proven zero-spend assertion, auditable stop/park/resume ledger events surfaced in status and brief, and a declared daemon-absent degradation to the existing iteration-start gating.

## 1. SUMMARY

Provider peak windows today gate only **dispatch admission**: a declared UTC peak window parks the provider profile with the `peak-window` cause and an absolute expiry, so the profile is ineligible for *new* work while the window lasts ([Provider Profiles](../../../spec/features/feature-provider-profiles.md), F-6). A lane already in flight when the window opens keeps running and keeps burning peak-rate tokens until it finishes on its own.

This change enforces peak-hour cost control **per provider profile for in-flight work**:

1. Every delivery nominates its provider profile at dispatch admission; the nomination is recorded on the lane and attempt records (building on M1-S21 profiles and M1-S22 identity).
2. Peak-window rules become data per provider profile: window list, multiplier per window, buffers before and after each window, and a bounded grace with a default and a maximum bounded by the window buffer.
3. The resident daemon watches profile windows and parks in-flight lanes whose profile enters peak: bounded-grace stop, session state preserved, park reason `peak-window` recorded with the window end.
4. When the window ends, parked lanes resume automatically — from preserved session state where preservation succeeded, otherwise through the delivered interrupted-lane recovery — same branch, never a fresh re-dispatch; no branch, artifact, or queue state is lost or duplicated.
5. Telemetry v2 proves zero billable model calls on a parked profile during its window, with telemetry absence a classified outcome — never reported as zero.
6. Stop, park, and resume are auditable ledger events surfaced in status and brief.
7. With no resident daemon, behavior degrades to the delivered iteration-start gating, and the difference is declared.

Lanes on other providers are untouched throughout: isolation is per profile, and the delivered iteration-start gating is unchanged for admission.

## 2. CONTEXT

### 2.1 Current State Snapshot

The pieces this change composes are all delivered on `main-tools`:

- **Provider profiles (M1-S21).** The `provider.profiles` branch declares tiers, profiles, preference chains, pacing, and watch targets, and ships empty by default. Profile-level lifecycle semantics run on every production profile resolve: expensive windows park a provider with the engine's `peak-window` cause and an absolute expiry at the effective window end, with read-time resume and no timer; profiles using the provider are ineligible with the park named as a blocker. The production availability probe reports a provider available only when it is declared, enabled, and **outside its UTC peak window**. All declared windows and expiries are evaluated on the provider engine's UTC basis; non-UTC and local-timezone windows are not modeled ([Provider Profiles](../../../spec/features/feature-provider-profiles.md)).
- **Resident daemon (M1-S18).** The daemon computes the next action, claims the lease through the fenced claim path, asks the lane executor to start, records one delivering record, observes, and releases or parks. It performs no delivery work in-process. Startup reconciliation classifies every in-flight lane once (`alive`, `interrupted`, `crashed`, or `evidence-insufficient`). Safe-boundary preemption parks a lane with `preempted-for-close-item` at the next phase boundary — the delivered precedent for condition-driven lane parking. The production composition mounts the daemon family **without a lane composition**, so a production daemon runs `supervise-only`; supplying the lane composition remains resident-daemon production scope (GH-238) ([Resident Dispatch Daemon](../../../spec/features/feature-resident-daemon.md)).
- **Dispatch engine.** One invocation resolves a harness, validates input, runs the admission preflight, applies the per-ref single-flight admission predicate (GH-292), claims the repository lease, spawns or resumes through the harness session port, and appends exactly one durable attempt record per classified dispatch. Attempt records carry harness, evidence class, timing, outcome, token, comparison, and corroboration — **no provider profile nomination**. Lane records carry ref, state, harness kind, session id, spawn ordinal, and liveness — **no provider profile nomination**. Resume today is operator-invoked (`--resume-prompt`) or supervision-driven; completed phases are skipped idempotently, and resume admission is governed by the restart budget and resume economics ([Dispatch Engine](../../../spec/features/feature-dispatch-engine.md)).
- **Scheduling engine parks.** Park condition types are `provider-window`, `provider-quota`, and `preemption`; the delivered park-cause set is `provider-window | provider-quota | preempted-for-close-item`. `queue release --park <cause>` requires an explicit `--until <iso>` for provider-window parks. The global owner-hold gate (GH-280) **outranks parks and provider windows** ([Scheduling Engine](../../../spec/features/feature-scheduling-engine.md)).
- **Telemetry v2 (M2-S14, PR #315).** Per-step token, call, and cost ingest stores attributed step records with five attribution dimensions — `ticket`, `repository`, `lane`, `agentRole`, `model` — joined from session economics and command-audit identity. An absent dimension is stored as null with a closed warning and is never defaulted, guessed, or borrowed; an absent sink keeps delivered behavior. The spend v2 read side splits cost and tokens by those five dimensions with a reconciliation disclosure ([Telemetry v2](../../../spec/features/feature-telemetry-v2.md), [Spend Read Side](../../../spec/features/feature-spend.md)).
- **Event taxonomy v1 (GH-290).** The resident daemon publishes six closed topics; `dispatch.attempt` declares `started | refused | completed` and `queue.graph` declares `entry | dependency-edge | release | remove`. The taxonomy's boundaries explicitly declare the provider-aware peak-pausing shapes — **stop, parked, resumed, and park-edge — as a future taxonomy version, never an in-place edit to v1** ([Event Taxonomy v1](../../../spec/features/feature-event-taxonomy.md)).
- **Status digest and brief.** Status returns the bounded `delivery.status.v1` digest with nine fixed sections, including parked conditions and providers read from configuration and the verified park fold; the brief projects the same collector facts into ten render surfaces and performs no read of its own. Neither surface carries lane-level park fields (parked count, reason, until) for stop/park/resume episodes ([Status Digest](../../../spec/features/feature-status-digest.md), [Brief](../../../spec/features/feature-brief.md)).
- **M2 planning pack commitments.** The milestone contract section owned by M2-S17 commits the shape of this change: the `providerProfile` field on dispatch admission, lane records, and attempt records (with the no-nomination case explicitly left as a decision at S17 delivery); the peak-window rule schema (window list with start, end, and time zone, a multiplier per window, a buffer before and after each window, and a `graceSeconds` park bound with a default and a maximum bounded by the window buffer, versioned with the profile); the park reason vocabulary `peak-window` and `owner-hold`, each with an `until` timestamp, mapped onto the delivered vocabularies without a fourth set (no duplicate cause, no silent rename); stop/parked/resumed event shapes on `dispatch.attempt` and a park-edge kind on `queue.graph`, with the stop event recording the bounded-grace deadline and the resume event recording the preserved session state reference, the same branch, and that no re-dispatch occurred; status and brief carrying the park fields; and the zero-spend evidence form in which zero is a positive reading distinguishable from a classified telemetry absence, with AC5 scoped from the park timestamp through the window end ([M2 contracts](../../../planning/oss-tooling/milestones/m2/contracts.md)).

**Users and current impact.** An operator who declares a peak window to control cost gets admission control only. A delivery admitted at 16:59 runs straight through a 17:00–18:00 peak window at peak multipliers; the operator learns about the spend later, from the retro, with no ledger event that says the lane crossed a window it should have avoided.

### 2.2 Pain Points / Gaps

- **Peak control stops at admission.** F-6 gating decides *eligibility for new work*. Nothing watches a window *while lanes run*, so in-flight lanes are the uncontrolled path — exactly the path peak multipliers make most expensive.
- **No provider nomination on records.** Neither the attempt ledger nor the lane records answer "which profile was this lane using", so per-profile cost control, isolation, and audit have no key to read.
- **No mid-flight park for peak windows.** The delivered safe-boundary preemption parks only for close items, only at phase boundaries, and only on an operator-driven close-item trigger. There is no condition-driven, window-driven park of running lanes.
- **No window-end resume.** Lanes park today with operator- or close-item-driven causes; nothing resumes a parked lane automatically when the *condition that parked it* expires. A parked-for-peak lane would otherwise need manual re-dispatch — which is precisely the "re-dispatch from scratch" this change must avoid.
- **Zero-spend during a window is not provable.** Telemetry attribution exists, but no window-scoped assertion distinguishes "zero billable calls" (a positive reading) from "telemetry absent" (a classified outcome). A zero claimed on absent evidence would be a false all-clear.
- **Stop/park/resume have no ledger events and no surfaces.** Taxonomy v1 explicitly reserves the shapes; status and brief carry no park fields for lane episodes. Until both land, a peak pause is invisible to audit and to the owner's one screen.
- **Daemon-absent behavior is undeclared.** Without a resident daemon there is no window watcher; nothing states what peak enforcement means, and nothing prevents a surface from claiming a park that did not happen.

## 3. PROBLEM STATEMENT

Because provider peak windows gate only dispatch admission, a delivery admitted before a window opens keeps running through the provider's peak hours at peak multipliers with no record of which profile it was burning, no mid-flight stop, no automatic resume at window end, no proof that the parked interval was actually zero-spend, and no auditable trace on the ledger or in status and brief — so the operator cannot enforce peak-hour cost control per provider, and every attempted enforcement either misses in-flight work or risks re-dispatching deliveries from scratch.

**Who is affected.** The owner pays peak-rate tokens for work that a declared window was supposed to prevent. The operator has no way to see, prove, or audit a peak pause. The daemon's supervision loop has no window-driven action to compute. Downstream M2 stories (engine-first operations) cannot treat provider windows as engine-visible enforcement data.

## 4. GOALS

- **G-1** Record the nominated provider profile on every delivery at dispatch admission, visible on lane and attempt records (ticket AC1).
- **G-2** Make peak-window rules data per provider profile: window list, multiplier per window, buffers before and after each window, and a bounded grace (`graceSeconds` with a default and a maximum bounded by the window buffer), versioned with the profile (ticket tasks).
- **G-3** Have the resident daemon watch profile windows and park every in-flight lane whose nominated profile enters peak: bounded-grace stop, session state preserved, park reason `peak-window` with the window end as `until` (ticket AC2).
- **G-4** Keep lanes on other providers completely unaffected while a profile's peak window is open (ticket AC3).
- **G-5** Resume parked lanes automatically at window end from preserved session state — same branch, session resume path, never a fresh re-dispatch; no branch, artifact, or queue state lost or duplicated (ticket AC4).
- **G-6** Assert zero spend through telemetry: no billable model calls on a parked profile during its window, with telemetry absence a classified outcome distinct from zero (ticket AC5).
- **G-7** Make stop, park, and resume auditable ledger events surfaced in status and brief (ticket AC6).
- **G-8** Declare daemon-absent degradation: without the resident daemon, behavior degrades to the existing iteration-start gating, the difference is declared, and no park is claimed that did not happen (ticket AC7).
- **G-9** Join every new value — nomination field, park causes, event kinds, record kinds — with the repo's guarded/closed-vocabulary, additive versioned-record conventions; no in-place edits to delivered vocabularies or taxonomy v1.

### 4.1 Success Metrics / KPIs

| Metric | Target |
|--------|--------|
| Dispatches whose nominated profile is visible on lane and attempt records | 100% of dispatches admitted after this change |
| In-flight lanes on profile P parked by the time the window is observed open | 100%, each within one supervision cycle of the observation |
| Applied stop grace exceeding the declared window buffer | 0 occurrences |
| Lanes on providers other than P parked or stopped during P's window | 0 |
| Window-end parked lanes classified `preserved` resumed from preserved session state on the same branch | 100% |
| Parks refused because session state could not be preserved | 0 (the park lands with the preservation classification; recovery is budget-governed) |
| Duplicate branches, artifacts, or queue entries created by a park/resume episode | 0 |
| Billable model calls attributable to parked lanes on P from park timestamp through window end | 0, when telemetry is present |
| Zero-spend readings reported while telemetry is actually absent | 0 (absence is always a classified outcome, never zero) |
| Stop/park/resume episodes with exactly one ledger event per transition | 100% |
| Status and brief renders carrying parked count, reason, and `until` for open park episodes | 100% |
| Daemon-absent runs claiming a park that did not happen | 0 (declared mode `iteration-start-gating`, `parkClaimed == false`) |
| Delivered vocabularies renamed, removed, or edited in place | 0 |

### 4.2 Non-Goals

- **NG-1**: No new provider, vendor, credential, or network surface. Peak windows are declared configuration evaluated locally; provider usage and telemetry ride the delivered harness and provider seams.
- **NG-2**: No replacement or weakening of the delivered iteration-start gating (provider-profiles F-6). Admission gating continues unchanged; this change adds lane-level pausing beside it.
- **NG-3**: No quota-condition-driven in-flight pausing. `provider-quota` remains a scheduling-engine park cause; quota-condition probing remains with the daemon consumption of the profile seam, not with this change's window watcher.
- **NG-4**: No non-UTC or local-timezone window modeling. Windows are declared and evaluated on a UTC basis, extending the delivered provider-profiles guarantee to lane-level pausing.
- **NG-5**: No cost conversion or re-pricing. Telemetry and spend stay in harness-reported units, never converted or re-priced; multipliers are declared rule data, not a pricing engine.
- **NG-6**: No new session-kill capability beyond the delivered lane contracts. The bounded-grace stop composes with delivered supervision, liveness, and safe-boundary semantics.
- **NG-7**: No board/project-group work (M2-S18) and no engine-first flip or deprecation pointers (M2-S16). This change delivers the enforcement primitive those stories consume.
- **NG-8**: No migration, backfill, or seeding of historical records. Pre-change attempt and lane records without a nomination remain valid; their absence reads as a classified absence.

## 5. FUNCTIONAL CAPABILITIES

| ID | Capability | Rationale |
|----|------------|-----------|
| F-1 | Provider profile nomination at dispatch admission, recorded on lane and attempt records | Per-profile enforcement and audit need a durable key on every delivery's records |
| F-2 | Peak-window rules as data per provider profile (windows, multipliers, buffers, bounded grace) | Cost rules must be declared, validated, versioned configuration — not embedded policy |
| F-3 | Resident-daemon window watch with in-flight lane parking (bounded-grace stop, preserved session state, `peak-window` park reason with `until`) | Closes the uncontrolled in-flight path that admission gating cannot reach |
| F-4 | Cross-profile isolation: only lanes whose nominated profile is in window are parked | Cost control for one provider must never stop work on another |
| F-5 | Automatic resume at window end from preserved session state on the same branch | Cost control must not cost work; re-dispatch from scratch is the failure mode to avoid |
| F-6 | Window-scoped zero-spend assertion over telemetry, with classified absence | The cost-control claim must be provable and honest about missing evidence |
| F-7 | Auditable stop/park/resume ledger events surfaced in status and brief | Enforcement without an audit trail is not operable |
| F-8 | Daemon-absent degradation to iteration-start gating, declared | The system must state what it did not do, never claim a park that did not happen |

### 5.1 Capability Details

- **F-1 — Nomination at admission.** Every delivery nominates its provider profile when dispatch admits it, building on the resolve-before-spawn seam. The nomination is recorded on the lane record and on the attempt record, so the attempt history read and the lanes read return the same value for the same delivery. The nomination is a durable record field, not a rendering-time inference; reads never default, guess, or borrow a profile from another delivery. A delivery that cannot nominate a profile is refused at dispatch admission as a classified pre-session refusal — no lease, attempt, lane, or queue record and no event — carrying the resolve identity the profile seam already produced for the no-nomination shape: `provider.profile.absent`, `provider.profile.invalid`, `provider.profile.capability-denied` (exit 1), or `provider.profile.unavailable` (exit 2, with the eligibility list). No dispatch-default nomination concept exists — the delivered preference chain's base profile remains the declared default through the normal seam — and resumes never re-nominate: a pre-change lane resumes on its recorded absence, classified, and is simply not window-pausable (TDR-0028, DEC-9).
- **F-2 — Peak-window rules as data.** Each provider profile declares its peak-window rules as versioned data: a window list (start, end, and time-zone declaration, evaluated on the UTC basis), a multiplier per window, a buffer before and after each window, and a `graceSeconds` park bound with a default and a maximum bounded by the window buffer, so the applied grace can never outlast the buffer that protects the window. Validation is fail-closed and classified, matching the provider-profiles configuration discipline; with no window declared for a profile, that profile has no peak enforcement and behaves exactly as delivered.
- **F-3 — Window watch and in-flight parking.** The resident daemon watches the declared windows of profiles in use. When a profile's window opens (including its buffer), every in-flight lane whose nominated profile is that profile is stopped with bounded grace: the lane receives a stop that bounds how long the lane may run past the stop request before it is parked, the stop records its grace deadline, and the park marks the lane parked with reason `peak-window` and the window end as `until`. Session state is preserved so the episode is resumable. A preservation failure never refuses the park: when session state cannot be preserved after the stop, the lane still parks for the window and the episode carries the additive closed-value classification `preserved | session-state-not-preserved` (TDR-0030, DEC-11). The stop composes with the delivered lane supervision, liveness, and safe-boundary contracts — it does not introduce a new kill path. Lanes park under the delivered park record discipline (park appended under one fence, `until` present, read-time resume semantics for expiry observation). When an owner hold is active, it outranks provider windows, matching the delivered precedence: the hold is a read-time gate (delivered #280 — resolved from an environment value or a host-root marker whose content is a bounded reason line, source and optional reason; no expiry) that parks nothing and writes no park record; the window watcher still parks the lane with reason `peak-window` and the window end as `until`, and the hold's precedence manifests at claim and resume admission, which refuse with the delivered `queue.precondition.unmet` classification, reason `owner-hold`, while the hold is active.
- **F-4 — Cross-profile isolation.** The park decision reads each lane's nominated profile (F-1) and the window state of that profile only. A window on profile P parks P's lanes and nothing else: lanes on other providers keep running, keep their leases, and keep their supervision unchanged. The board and lanes surfaces show both states side by side during a window.
- **F-5 — Automatic resume at window end.** When the window ends (buffer included), every lane parked for that window resumes automatically from preserved session state on the same branch, through the delivered session resume path, never a fresh re-dispatch. Resume admission delegates to the delivered gates: attach-and-continue consumes no restart ordinal, and resume economics and the restart budget govern as delivered. Resume admission also reads the park's preservation classification (TDR-0030, DEC-11): a lane classified `preserved` resumes through the session resume path; a lane classified `session-state-not-preserved` is not resumable from session and routes to the delivered interrupted-lane recovery — resume from the ledger position on the same branch, consuming one restart ordinal under the restart budget and resume economics, with budget exhaustion producing the delivered terminal record and typed question, never an automatic fresh re-dispatch. The resumed lane's branch, artifacts, and queue state are unchanged by the episode: nothing is lost, nothing duplicated, and single-flight admission continues to prevent a second concurrent lane on the same ref. If a lane's window-end resume coincides with an active owner hold, the hold outranks the window: the lane stays parked under its existing park record (whatever cause parked it — typically `peak-window`), the hold writes no park record of its own, and window-end resume admission refuses with the delivered owner-hold classification (`queue.precondition.unmet`, reason `owner-hold`) while the hold is active; no synthetic owner-hold park record is created by the resume path.
- **F-6 — Zero-spend assertion.** For each park episode, the spend read side provides a window-scoped zero-spend reading over the telemetry v2 attribution join (lane and model dimensions): the count of billable model calls attributable to the parked lane from the park timestamp through the window end. Zero is a positive reading backed by present telemetry; telemetry absence is a classified outcome (`telemetryState` names it) and is never reported as zero. The scoping excludes calls before the park timestamp, so a boundary call before the park is not counted against the assertion.
- **F-7 — Auditable events and surfaces.** Each transition of a peak-pause episode is a ledger event: stop (with the bounded-grace deadline), parked (reason `peak-window`, profile, `until` at the window end, and the preservation classification), and resumed (the preserved session state reference, the same branch, and that no re-dispatch occurred), plus a park-edge kind on the queue graph topic for the park lifecycle edge. The kinds join the declared taxonomy as **v2** — never an in-place edit to taxonomy v1 — with payload fields declared and pinned like every delivered kind, every v1 kind and payload byte-identical, and the `v2` stamp rendered from one declaration constant on event frames, degraded frames, and the reference surface (TDR-0029, DEC-10). Status and brief carry the park fields for open episodes — parked count, reason, `until`, and the preservation classification — projected from the same collector facts, with the brief adding no reads of its own.
- **F-8 — Daemon-absent degradation.** Without a resident daemon there is no window watcher and no mid-flight park. Behavior degrades to the existing iteration-start gating: profiles in window are ineligible for new dispatches at admission, exactly as delivered. The degradation is declared wherever peak enforcement is described, and no surface reports a parked lane, a stop, or a resume that did not happen (`parkClaimed == false`, mode declared `iteration-start-gating` in the machine view of the relevant read).

## 6. USER & SYSTEM FLOWS

```
Flow 1: Peak opens mid-delivery (daemon resident)
  Two lanes run: one nominated to profile-a, one to profile-b.
  The daemon's window watch observes profile-a's window open (buffer included).
  → profile-a's lane is stopped with bounded grace; the stop event records the grace deadline.
  → Session state is preserved; the lane is marked parked with reason `peak-window`
    and `until` at the window end; parked and park-edge events land on the ledger.
  → The profile-b lane keeps running, untouched.
  → Telemetry over the window shows zero billable calls on profile-a for the parked
    lane (telemetryState present), scoped from the park timestamp through window end.
  → Status and brief show the parked lane (count, reason, until) beside the running one.

Flow 2: Window ends
  The daemon observes profile-a's window end (buffer included).
  → Every lane parked for that window resumes automatically from preserved session
    state, on the same branch, through the session resume path — no fresh dispatch.
  → The resume event records the session-state reference, the same branch, and that
    no re-dispatch occurred.
  → A parked lane classified `session-state-not-preserved` instead routes to the
    delivered interrupted-lane recovery: ledger-position resume on the same branch,
    one restart ordinal under the restart budget.
  → Branch, artifact, and queue state are unchanged by the episode; the lane is
    running again under ordinary supervision.

Flow 3: No resident daemon
  A peak window opens with no daemon running.
  → No window watcher exists; no lane is parked mid-flight.
  → Iteration-start gating applies at admission: profile-a is ineligible for new
    dispatches until the window expires (delivered F-6 behavior, read-time resume).
  → The degradation is declared (mode `iteration-start-gating`, `parkClaimed == false`);
    no surface claims a park, stop, or resume that did not happen.

Flow 4: Owner hold and window overlap
  An owner hold is active when profile-a's window opens.
  → The owner hold outranks provider windows (delivered precedence): the hold is a
    read-time gate that writes no park record — the lane stays parked under its
    existing park record (e.g. `peak-window`), and window-end resume admission
    refuses (`queue.precondition.unmet`, reason `owner-hold`) while the hold is
    active; no synthetic owner-hold park is created.
```

## 7. SCOPE & BOUNDARIES

### 7.1 In Scope

- The nominated provider profile recorded at dispatch admission on lane and attempt records, with the attempt-history and lanes reads returning it; a delivery that cannot nominate is refused at admission as a classified pre-session refusal carrying the delivered resolve identities (TDR-0028).
- The peak-window rule schema per provider profile: window list (start, end, time-zone declaration on the UTC basis), multiplier per window, buffers before and after each window, `graceSeconds` with a default and a maximum bounded by the window buffer, versioned with the profile.
- The resident daemon's profile-window watch and in-flight lane parking: bounded-grace stop with recorded deadline, preserved session state, park reason `peak-window` with `until` at the window end, and the additive preservation classification `preserved | session-state-not-preserved` on the park record, the `parked` event, and status/brief park fields — the park never refused for a preservation failure (TDR-0030).
- The park reason vocabulary additions per the committed M2 mapping: `peak-window` as the S17 park reason joining the queue park-cause set mapped onto the existing `provider-window` condition type, and `owner-hold` as a park cause alongside the delivered idle reason; the lanes `parked:<cause>` projection gains both and keeps the delivered three unchanged.
- Automatic window-end resume from preserved session state on the same branch through the session resume path, governed by the delivered restart-budget and resume-economics admission; a lane classified `session-state-not-preserved` routes to the delivered interrupted-lane recovery (ledger-position resume, one restart ordinal), with budget exhaustion producing the terminal record and typed question.
- The window-scoped zero-spend assertion over telemetry v2 attribution, with classified telemetry absence and boundary scoping from park timestamp through window end.
- Stop, parked, and resumed kinds on `dispatch.attempt` and the park-edge kind on `queue.graph`, joining the declared taxonomy as version **v2** with declared payload fields and every v1 kind and payload byte-identical.
- Status digest and brief carrying lane park fields (parked count, reason, `until`) for open episodes.
- Declared daemon-absent degradation to iteration-start gating, with the difference documented and no false park claims.
- Documentation updates: provider-profiles (lane-level peak park), resident-daemon (window watching, park/resume), dispatch-engine (nomination at admission), telemetry-v2 (zero-spend assertion and absence classification), event-taxonomy (S17 kinds), status-digest and brief (park fields), scheduling-engine (park-cause vocabulary reconciliation — DEC-2's mapping supersedes the delivered paired cause/condition and hold-adds-no-park-cause statements), spend (window-scoped zero-spend evidence and `telemetryState` semantics), and the `doc/planning/oss-tooling/` backlog markers and status.

### 7.2 Out of Scope

- [OUT] Replacing or altering the delivered iteration-start gating (provider-profiles F-6); it remains the admission behavior and the daemon-absent degradation mode.
- [OUT] Quota-condition-driven in-flight pausing; `provider-quota` remains a delivered park cause outside this change's window watcher.
- [OUT] Non-UTC or local-timezone window evaluation; windows are declared and evaluated on the UTC basis only.
- [OUT] New session-kill operations or signal paths beyond the delivered lane supervision, liveness, and safe-boundary contracts.
- [OUT] Cost conversion, re-pricing, or a pricing engine over peak multipliers; multipliers are declared rule data, and spend stays in harness-reported units.
- [OUT] Board and project-group rendering (M2-S18) and engine-first flip/deprecation work (M2-S16).
- [OUT] Migration or backfill of historical attempt and lane records to add nominations.
- [OUT] Per-lane cost ceilings or budget enforcement beyond the delivered economics gates.

### 7.3 Deferred / Maybe-Later

- In-flight pausing driven by quota or subscription-window conditions (the delivered watch mappings could feed the same park path later).
- Overlapping-window arbitration rules beyond declared validation (e.g., conflicting multipliers for overlapping windows on one profile).
- A per-profile cost-projection surface that renders peak multipliers against upcoming windows.
- Operator-triggered manual unpark/resume of a peak-parked lane ahead of window end.

## 8. INTERFACES & INTEGRATION CONTRACTS

### 8.1 REST / HTTP Endpoints

N/A. No HTTP surface is added or changed. The affected command surfaces are the existing CLI reads and writes: `dispatch` (nomination at admission), `dispatch attempts` (nomination on attempt records), `lanes` (nomination, parked state, `parked:<cause>` projection gains `peak-window` and `owner-hold`), `queue release --park` (new causes; the invoked command itself writes the owner-hold park record, with `until` classified absent), `status` and `brief` (park fields), `spend` (window-scoped zero-spend evidence), and `events` (the v2 taxonomy's reference surface).

### 8.2 Events / Messages

| ID | Topic | Kind | Payload semantics |
|----|-------|------|-------------------|
| EVT-1 | `dispatch.attempt` | `stop` | Lane stopped with bounded grace; payload records the bounded-grace deadline |
| EVT-2 | `dispatch.attempt` | `parked` | Lane parked; payload records reason `peak-window`, the profile, `until` at the window end, and the preservation classification (`preserved` or `session-state-not-preserved`) |
| EVT-3 | `dispatch.attempt` | `resumed` | Lane resumed; payload records the preserved session-state reference, the same branch, and that no re-dispatch occurred |
| EVT-4 | `queue.graph` | `park-edge` | The park lifecycle edge on the queue graph for the episode |

The four kinds join the declared taxonomy as **v2**, a whole-taxonomy version carrying all six topics together (GH-290's boundary forbids in-place edits to v1), with per-kind payload field lists, producer coverage, and the delivered envelope, ordering, and overflow rules unchanged (TDR-0029, DEC-10). Every delivered v1 kind and payload stays byte-identical; the `v2` stamp on event frames, degraded frames, and the `events` reference surface renders from one declaration constant; and v2 is the single spoken version — v1 is retired, not served concurrently. A v1-pinned consumer keeps working by construction: the four new `(topic, kind)` pairs are ignored-and-continued (never repolled — the per-`(topic, lane)` sequence stays contiguous), a foreign stamp is a version-drift signal answered by re-reading the reference surface — not an error, no disconnect — and ordering and overflow semantics are unchanged exactly as declared.

### 8.3 Data Model Impact

| ID | Element | Description |
|----|---------|-------------|
| DM-1 | Provider profile nomination on attempt records | `providerProfile` on the dispatch attempt record family (`delivery.dispatch.attempt.v1`), recorded at admission; additive field |
| DM-2 | Provider profile nomination on lane records | `providerProfile` on the daemon lane record family, recorded at admission; additive field |
| DM-3 | Peak-window rule schema | Per-profile versioned data: window list (start, end, time-zone declaration), multiplier per window, buffers before/after each window, `graceSeconds` default and max bounded by the window buffer; validated fail-closed |
| DM-4 | Park reason record fields | Park records carrying reason `peak-window` name the profile, carry `until` at the window end, and carry the additive closed-value preservation classification (`preserved` or `session-state-not-preserved`). An `owner-hold` park's `until` is a declared classified absence (absent/null — the hold is a read-time gate with no expiry), never a synthesized or borrowed timestamp, matching the delivered park payloads that already support no-expiry conditions (`provider-quota` and `preemption` parks carry no expiry); the `owner-hold` park record is written only by the operator-invoked `queue release --park owner-hold` command, the hold itself never writes a park record, and the window-end resume path creates no synthetic owner-hold park record (resume admission refuses `queue.precondition.unmet`, reason `owner-hold`, while the hold is active) |
| DM-5 | Window-scoped zero-spend evidence | Spend-side reading over the telemetry v2 storage identity: billable-call count for the parked lane from park timestamp through window end, with `telemetryState` distinguishing present from classified absence |
| DM-6 | Additive record discipline | All new/changed records follow the state layer's additive, schema-versioned, fenced-append conventions; no in-place mutation, no schema bump of delivered payloads, no migration |

### 8.4 External Integrations

None new. Peak windows are declared configuration evaluated locally against the injected clock. Provider usage continues through the delivered harness session port and provider seams; telemetry continues through the delivered drain and storage; no credential, endpoint, or vendor surface is added.

### 8.5 Backward Compatibility

- Additive fields on the attempt and lane record families: existing consumers tolerate additions; reads of pre-change records see the nomination absent and treat that absence as a classified absence, never as a defaulted or guessed profile, and a resume of a pre-change lane proceeds on that classified absence — resumes never re-nominate (TDR-0028).
- Delivered vocabularies are extended, not edited: the queue park-cause set gains `peak-window` and `owner-hold` without renaming or removing the delivered three; the lanes `parked:<cause>` projection keeps printing the delivered causes unchanged.
- Taxonomy: the declared **v2** version rides the same subscribe surface with all six topics moving together; every v1 kind and payload is byte-identical, ordering and overflow are unchanged, and v1-pinned consumers keep working — new kinds are ignored-and-continued and a foreign stamp is a version-drift signal rather than an error — while v1 itself is retired, not served concurrently (TDR-0029).
- Behavior: without declared windows the system behaves exactly as delivered; without a resident daemon the declared degradation is the delivered iteration-start gating. No migration is required (§19).

## 9. NON-FUNCTIONAL REQUIREMENTS (NFRs)

| ID | Requirement | Threshold |
|----|-------------|-----------|
| NFR-1 | Bounded grace never outlasts the window buffer protecting the window | Applied grace ≤ declared window buffer in 100% of parks; `graceSeconds` default declared and validated; requests for a grace above the profile's maximum are validation errors |
| NFR-2 | Park lands close to the boundary | Every in-flight lane of the profile is stopped and parked within one supervision cycle of the daemon's observation of window start (buffer included) |
| NFR-3 | Boundary correctness on the UTC basis | Window start/end evaluated against the declared UTC instants with the injected clock; 0 evaluations off the UTC basis |
| NFR-4 | Zero billable calls during the window | 0 billable model calls attributable to parked lanes from park timestamp through window end, whenever telemetry is present; absence always classified, never reported as zero |
| NFR-5 | Resume fidelity | 100% of window-end resumes use the preserved session resume path on the same branch; 0 fresh re-dispatches; 0 duplicate branches, artifacts, or queue entries |
| NFR-6 | Event evidence bounds | Stop, parked, resumed, and park-edge events obey the declared envelope and bounded-evidence budgets (≤ 20 payload fields, ≤ 1024 bytes evidence) |
| NFR-7 | Truthful degradation | With no resident daemon: mode declared `iteration-start-gating` and `parkClaimed == false`; 0 surfaces claiming a park that did not happen |
| NFR-8 | Surface cost | Status and brief park fields come from the same collector pass as the delivered sections; the brief adds 0 reads of its own |
| NFR-9 | Determinism | Identical declared windows, provider facts, records, and injected clock produce identical park, resume, and event decisions across repeated runs |
| NFR-10 | Hermetic verification | The delivering test suite runs with zero live network, zero live credential reads, and zero real sleeps |

## 10. TELEMETRY & OBSERVABILITY REQUIREMENTS

- The zero-spend assertion is the headline observable: a window-scoped, lane-attributed billable-call count over the telemetry v2 join, emitted with an explicit `telemetryState` so a present zero and a classified absence can never be confused.
- Stop, parked, and resumed episodes are observable three ways: as ledger events (EVT-1..EVT-4), as lane state with reason and `until`, and as status/brief park fields (parked count, reason, `until`) — all derived from the same recorded truth.
- Daemon-absent degradation is observable: the declared mode (`iteration-start-gating`) and the explicit `parkClaimed == false` value in the relevant machine read.
- Park and resume events carry bounded evidence naming the profile, window end, grace deadline, session-state reference, and branch, so an auditor can reconstruct an episode from the ledger alone.

## 11. RISKS & MITIGATIONS

| ID | Risk | Impact | Probability | Mitigation | Residual Risk |
|----|------|--------|-------------|------------|---------------|
| RSK-1 | A mid-flight stop interrupts external effects (commits, phase transitions) | H | M | Bounded-grace stop respects the delivered lane supervision, liveness, and safe-boundary contracts; effect intents and receipts already guard commit crash safety; session state preserved for resume | L |
| RSK-2 | Grace expires before a safe boundary, leaving the session mid-step | M | M | The park records the applied grace and outcome; resume continues from preserved session state under the delivered interrupted-lane classification and restart budget; the grace bound cannot exceed the window buffer | M |
| RSK-3 | Misattributed profile (lane parked on the wrong provider's window) | H | L | Nomination recorded at admission from the resolve-before-spawn seam; reads never default or guess; telemetry attribution join cross-checks lane and model dimensions | L |
| RSK-4 | Zero-spend indistinguishable from missing telemetry (false proof) | H | L | Zero is a positive reading over present telemetry; absence is a classified outcome (`telemetryState`), never zero; the distinction is pinned by the M2 contracts pack and asserted in acceptance | L |
| RSK-5 | Resume duplicates work or artifacts | H | M | Resume uses the session resume path on the same branch; completed phases skip idempotently; per-ref single-flight admission prevents a second concurrent lane on the ref; acceptance asserts unchanged branch/artifact/queue state | L |
| RSK-6 | Taxonomy version bump breaks v1 consumers | M | M | The four kinds declared additively under taxonomy v2; v1 kinds and payloads byte-identical; v1 consumers ignore-and-continue new kinds and treat a foreign stamp as version drift (not an error); repoll stays reserved for gaps and overflow as delivered (TDR-0029) | L |
| RSK-7 | Daemon-absent surfaces claim enforcement that did not happen | M | M | Declared degradation mode and explicit `parkClaimed == false`; the difference documented; "never claim a park that did not happen" pinned as an NFR and AC | L |
| RSK-8 | Production daemon composition cannot exercise the path (supervise-only residual, GH-238) | M | M | The spec states the composition requirement explicitly (§16, §12): peak pausing is daemon-supervision behavior and requires the lane composition the daemon family already proves at the seam; the daemon-absent branch carries the documented degradation meanwhile | M |

## 12. ASSUMPTIONS

- The `provider.profiles` branch is the configuration home for peak-window rules (F-2), versioned with the profile; with no window declared, a profile has no peak enforcement.
- A resident daemon with lane supervision is present when peak pausing is expected to enforce (the daemon-absent branch is the declared degradation, not a target mode).
- Windows are declared and evaluated on the UTC basis, extending the delivered provider-profiles guarantee (DEC-1).
- Multipliers are declared rule data consumed for cost accounting and projection; enforcement is driven by window membership and buffers, not by multiplier values (A-4).
- The delivered owner-hold precedence (hold outranks parks and provider windows) applies to peak-pause episodes, including at window end.
- Attempt and lane records written before this change legitimately lack nominations; their absence is classified, and no backfill occurs.
- The M2 planning pack's committed mapping (park causes, event shapes, zero-spend evidence form) is the contract this change implements.

## 13. DEPENDENCIES

| Direction | Item | Notes |
|-----------|------|-------|
| Depends on | M1-S21 provider profiles (delivered) | F-6 peak-window park, availability probe, UTC windows, resolve-before-spawn seam the nomination reads |
| Depends on | M1-S18 resident daemon (delivered) | Lane supervision, watch and degradation, startup reconciliation, safe-boundary preemption; supervise-only residual (GH-238) is the composition this change must state |
| Depends on | M1-S15 session economics (delivered) | Restart budget and resume-economics admission govern window-end resumes |
| Depends on | M1-S22 command-audit identity (delivered) | The identity join telemetry attribution consumes for lane/role/model attribution |
| Depends on | M2-S14 telemetry v2 (delivered, PR #315) | Per-step attribution and classified absence underpin the zero-spend assertion |
| Depends on | Spend v2 read side (delivered, GH-291) | Breakdown dimensions and reconciliation disclosure carry the window-scoped evidence |
| Depends on | Owner-hold semantics (delivered, #280) | Hold precedence over provider windows; `owner-hold` park cause joins the vocabulary |
| Depends on | Queue lifecycle and single-flight (delivered, GH-292, PR #314) | Park/lease discipline, `until` requirement, single-flight guard for resume |
| Depends on | Event taxonomy v1 (delivered, GH-290) | The declared extension path and version discipline EVT-1..EVT-4 land under |
| Depends on | Watchdog and lane contracts (delivered) | Bounded-grace stop respects liveness and supervision semantics |
| Depends on | State layer (delivered) | Additive, schema-versioned, fenced-append record discipline |
| Blocks | M2-S16 engine-first operations | Consumes provider windows and holds as engine-visible enforcement data |
| Blocks | M2-S6 alarm and metric layers | The zero-spend evidence form is the reading those layers can consume |

## 14. OPEN QUESTIONS

| ID | Question | Resolution | Status |
|----|----------|------------|--------|
| OQ-1 | What happens at admission when a delivery cannot nominate a profile: classified refusal, or the profile's declared default? | Resolved as a classified **pre-session refusal at admission**: no lease, attempt, lane, or queue record and no event, carrying the delivered resolve identities — `provider.profile.absent` (empty or chain-less branch, exit 1), `provider.profile.invalid` (invalid explicit nomination, exit 1), `provider.profile.capability-denied` (all capability blockers, exit 1), `provider.profile.unavailable` (all candidates ineligible, exit 2, with the eligibility list). No dispatch-default nomination concept exists, and resumes never re-nominate. See **TDR-0028** (`doc/decisions/TDR-0028-no-nomination-classified-admission-refusal.md`), recorded as DEC-9. | Resolved 2026-11-13 |
| OQ-2 | Which taxonomy version identifier carries the stop/parked/resumed/park-edge kinds, and what compatibility statement accompanies it for v1-pinned consumers? | Resolved as declared taxonomy version **v2**: all six topics move together, every v1 kind and payload stays byte-identical, the `v2` stamp renders from one declaration constant on event frames, degraded frames, and the reference surface, and v1 is retired — the single spoken version, never served concurrently. v1 consumers ignore-and-continue the new kinds (never repoll), and a foreign stamp is a version-drift signal, not an error and not a disconnect; ordering and overflow semantics are unchanged. See **TDR-0029** (`doc/decisions/TDR-0029-event-taxonomy-v2-peak-pause-kinds.md`), recorded as DEC-10. | Resolved 2026-11-13 |
| OQ-3 | What is the classified outcome when session state cannot be preserved at park time — is the park refused, or recorded as parked with a preservation-failure classification that changes resume admission? | Resolved: a park is **never refused** for a preservation failure — the lane parks for the window with the additive closed-value classification `preserved` or `session-state-not-preserved` on the park record, the `parked` event payload, and the status/brief park fields; at window end a not-resumable lane routes to the delivered interrupted-lane recovery (ledger-position resume, same branch, one restart ordinal, governed by the restart budget and resume economics; exhaustion appends the delivered terminal record and raises a typed question); grace never extends, and there is never an automatic fresh re-dispatch. See **TDR-0030** (`doc/decisions/TDR-0030-park-preservation-failure-classification.md`), recorded as DEC-11. | Resolved 2026-11-13 |

## 15. DECISION LOG

| ID | Decision | Rationale | Date |
|----|----------|-----------|------|
| DEC-1 | Peak windows are declared and evaluated on the UTC basis only, extended from profile-level gating to lane-level pausing; the schema's time-zone declaration does not introduce non-UTC evaluation | Preserves the delivered provider-profiles guarantee; the M2 pack's window schema carries a zone field, and the PM clarify-scope constraint pins UTC-only evaluation | 2026-11-13 |
| DEC-2 | `peak-window` joins as a queue park cause mapped onto the existing `provider-window` condition type, and `owner-hold` joins as a park cause beside the delivered idle reason; no fourth vocabulary, no duplicate cause, no silent rename; the lanes `parked:<cause>` projection gains both and keeps the delivered three | The committed M2 contracts mapping; avoids fragmenting the delivered closed vocabularies | 2026-11-13 |
| DEC-3 | Stop, parked, resumed, and park-edge land as a new declared taxonomy version, additively; v1 is never edited in place | GH-290 boundary; the identifier is resolved as `v2` by TDR-0029 (DEC-10) | 2026-11-13 |
| DEC-4 | Zero-spend evidence distinguishes zero (a positive reading over present telemetry) from telemetry absence (a classified outcome), and the assertion is scoped from the park timestamp through the window end | The M2 contracts pack's evidence form; prevents a false proof and excludes pre-park boundary calls | 2026-11-13 |
| DEC-5 | Window-end resume uses the preserved session resume path on the same branch and never a fresh re-dispatch; resume admission delegates to the delivered restart-budget and resume-economics gates | Ticket AC4 and the "never re-dispatch from scratch" task; reuses delivered, proven resume machinery | 2026-11-13 |
| DEC-6 | The applied stop grace is bounded by the window buffer (`graceSeconds` default and maximum ≤ buffer) | The M2 contracts pack's schema commitment; the grace can never outlast the protection the buffer provides | 2026-11-13 |
| DEC-7 | Daemon-absent behavior is declared iteration-start gating with `parkClaimed == false`; no surface claims a park that did not happen | The ticket's AC7 and the architecture pack's dual-branch contract; truthfulness over optimism | 2026-11-13 |
| DEC-8 | The delivered owner-hold precedence applies unchanged: an active owner hold outranks peak windows, including at window end — the hold is a read-time gate that writes no park record; a lane stays parked under its existing park record and window-end resume admission refuses with the delivered `queue.precondition.unmet`, reason `owner-hold`, while the hold is active | Delivered scheduling-engine precedence (#280: env value or host-root marker with source and optional bounded reason; no expiry); avoids inventing a second precedence rule | 2026-11-13 |
| DEC-9 | A delivery that cannot nominate a provider profile is refused at dispatch admission as a classified pre-session refusal — no lease, attempt, lane, or queue record and no event — reusing the delivered resolve identities (`provider.profile.absent`, `provider.profile.invalid`, `provider.profile.capability-denied` exit 1, `provider.profile.unavailable` exit 2 with the eligibility list); no dispatch-default nomination concept exists, and resumes never re-nominate | Closes OQ-1; the nomination is the structural enforcement key for peak pausing, so every admitted lane carries it by construction (TDR-0028) | 2026-11-13 |
| DEC-10 | The stop/parked/resumed/park-edge kinds join as declared taxonomy **v2**: all six topics move together, every v1 kind and payload stays byte-identical, the `v2` stamp renders from one declaration constant on frames, degraded frames, and the reference surface, v1 is retired rather than served concurrently, v1 consumers ignore-and-continue new kinds (never repoll) and treat a foreign stamp as a version-drift signal (not an error, no disconnect), and ordering/overflow semantics are unchanged | Closes OQ-2; applies TDR-0025 DC-5's "a kind is a version" rule verbatim (TDR-0029) | 2026-11-13 |
| DEC-11 | A park is never refused for a preservation failure: the lane parks for the window with the additive closed-value classification `preserved` or `session-state-not-preserved` on the park record, the `parked` event, and status/brief park fields; at window end a not-resumable lane routes to the delivered interrupted-lane recovery (ledger-position resume, same branch, one restart ordinal, restart-budget and resume-economics governed; exhaustion = delivered terminal record + typed question); grace never extends; never an automatic fresh re-dispatch | Closes OQ-3; enforcement truthfulness — the window is enforced in every park episode, with honest, budget-governed recovery reusing delivered machinery (TDR-0030) | 2026-11-13 |
| DEC-12 | Deviation from the M2 planning pack's owner-hold park language: the pack's story text (parks "each with an `until` timestamp", the hold's expiry recorded on the park) presumed the hold has an expiry, but the delivered owner hold (#280) has none — it is a read-time gate resolved from an environment value or a host-root marker whose payload carries source and optional bounded reason (`doc/spec/features/feature-scheduling-engine.md`, "Owner hold"). Decision: an `owner-hold` park's `until` is a declared classified absence (absent/null, matching the delivered no-expiry `provider-quota`/`preemption` park payloads), never a synthesized or borrowed timestamp; the park writers are named — the operator-invoked `queue release --park owner-hold` command writes the park record, the hold itself writes none, and the window-end resume path creates no synthetic owner-hold park record (resume admission refuses `queue.precondition.unmet`, reason `owner-hold`, while the hold is active) | The expiry presumption was unrealizable against delivered truth; `feature-scheduling-engine.md` is the source of delivered truth, with the daemon's claim-time refusal per `feature-resident-daemon.md` (DoR iter-2 finding A) | 2026-11-13 |

## 16. AFFECTED COMPONENTS (HIGH-LEVEL)

| Component | Impact |
|-----------|--------|
| Provider profiles configuration and lifecycle | Updated — peak-window rules as per-profile versioned data (F-2); F-6 admission gating unchanged |
| Resident daemon | Updated — profile-window watch, in-flight park with bounded grace and preservation classification, classification-routed window-end resume supervision (F-3, F-5, DEC-11); composition requirement stated for the supervise-only residual |
| Dispatch engine | Updated — nomination recorded at admission on attempt records; no-nomination classified pre-session refusal (F-1, DM-1, DEC-9) |
| Daemon lane records | Updated — nomination recorded at admission (F-1, DM-2) |
| Scheduling engine / queue park causes | Updated — `peak-window` and `owner-hold` park causes per the committed mapping (DEC-2); owner-hold park `until` is a classified absence and the park writers are named (DEC-12) |
| Lanes projection and surfaces | Updated — parked state with reason and `until`; `parked:<cause>` gains the new causes |
| Event taxonomy | New declared version **v2** — stop/parked/resumed on `dispatch.attempt`, park-edge on `queue.graph`; v1 retired as the spoken version (EVT-1..EVT-4, DEC-3, DEC-10) |
| Status digest | Updated — lane park fields (parked count, reason, `until`, preservation classification) |
| Brief | Updated — the same park fields projected with zero added reads |
| Spend read side / telemetry | Updated — window-scoped zero-spend evidence with classified absence (F-6, DM-5) |
| System specification pages | Updated — provider-profiles, resident-daemon, dispatch-engine, telemetry-v2, event-taxonomy, status-digest, brief, scheduling-engine (canonical home of the park-cause vocabulary; DEC-2's `peak-window`-onto-`provider-window` mapping supersedes its delivered paired one-to-one cause/condition and hold-adds-no-park-cause statements, and TDR-0030 names it), spend (home of DM-5's window-scoped zero-spend evidence semantics; the billable-call count and `telemetryState` touch its delivered read-side contract); possible new canonical page for peak pausing (phase 7 reconciliation) |
| Planning backlog | Updated — `doc/planning/oss-tooling/` M2-S17 markers and status |

## 17. ACCEPTANCE CRITERIA

| ID | Criterion | Linked |
|----|-----------|--------|
| AC-F1-1 | **Given** a dispatch admitted for delivery that nominates provider profile P, **when** the dispatch records admission, **then** the nomination is visible on both the lane record and the attempt record, and the attempt-history read returns the same value; and **when** a dispatch cannot nominate any profile, **then** it is refused at admission as a pre-session refusal carrying the resolve identity for the shape (`provider.profile.absent`, `provider.profile.invalid`, `provider.profile.capability-denied`, or `provider.profile.unavailable`), with no lease, attempt, lane, or queue record and no event | F-1, DM-1, DM-2, DEC-9 |
| AC-F3-2 | **Given** in-flight lanes whose nominated profile is P, **when** a peak window starts for P, **then** every in-flight lane using P is stopped with bounded grace, marked parked with reason `peak-window` and the window end as `until`, and stays parked until the window ends | F-2, F-3, DM-3, DM-4, NFR-1, NFR-2 |
| AC-F4-3 | **Given** lanes on profile P and lanes on other providers, **when** a peak window starts for P, **then** lanes on other providers are unaffected and keep running for the whole window | F-4, NFR-2 |
| AC-F5-4 | **Given** lanes parked for P's peak window, **when** the window ends, **then** each lane classified `preserved` resumes automatically from preserved session state on the same branch, each lane classified `session-state-not-preserved` is routed automatically to the delivered interrupted-lane recovery (resume from the ledger position on the same branch, one restart ordinal under the restart budget and resume economics), and no branch, artifact, or queue state is lost or duplicated by either path | F-5, DEC-5, DEC-11, NFR-5 |
| AC-F6-5 | **Given** a lane parked for P's peak window, **when** telemetry for the window is read, **then** it proves zero billable model calls on P during the window for the parked lane; and **when** telemetry is absent, **then** the absence is reported as a classified outcome and never as zero | F-6, DM-5, NFR-4, DEC-4 |
| AC-F7-6 | **Given** a lane stopped, parked, and later resumed through a peak window, **when** status and brief are read, **then** each surface shows the park fields (parked count, reason, `until`) and the ledger carries exactly one stop, parked, and resumed event for the episode | F-7, EVT-1, EVT-2, EVT-3, NFR-6 |
| AC-F8-7 | **Given** no resident daemon, **when** a peak window would otherwise park a lane, **then** behavior degrades to iteration-start gating with the difference declared, and no park is claimed (`parkClaimed == false`) | F-8, NFR-7, DEC-7 |

Traceability to the ticket's seven ACs, in order: ticket AC1 → AC-F1-1; ticket AC2 → AC-F3-2; ticket AC3 → AC-F4-3; ticket AC4 → AC-F5-4; ticket AC5 → AC-F6-5; ticket AC6 → AC-F7-6; ticket AC7 → AC-F8-7. Milestone scenario coverage: SC-M2-S17-01 → AC-F3-2; SC-M2-S17-02 → AC-F4-3; SC-M2-S17-03 → AC-F5-4; SC-M2-S17-04 → AC-F6-5; SC-M2-S17-05 → AC-F8-7; SC-M2-S17-06 → AC-F1-1; SC-M2-S17-07 → AC-F7-6.

## 18. ROLLOUT & CHANGE MANAGEMENT (HIGH-LEVEL)

- Full 11-phase lifecycle on the change branch; plan phases declared in the plan; conventional commits; quality gate green before the PR; the PR targets `main-tools`.
- The change is behavior-gated by configuration: with no peak windows declared, the delivered system behaves exactly as before except for the additive record fields — adoption is a per-profile declaration, not a flag flip.
- Daemon-absent installations keep the delivered iteration-start gating and get the documented degradation statement; nothing else changes for them.
- Documentation ships in the same change: the affected system spec pages (§16) and the `doc/planning/oss-tooling/` backlog markers and status.
- After merge, the daemon-absent → resident transition on a machine with declared windows is the operator's activation path; the degradation declaration tells the operator exactly what enforcement begins with the daemon.

## 19. DATA MIGRATION / SEEDING (IF APPLICABLE)

None. All record changes are additive fields on delivered families and additive kinds under the declared taxonomy v2; pre-change records stay valid and their missing nominations read as classified absence. Peak-window rules are configuration data declared per profile and ship empty — no default window, multiplier, buffer, or grace is invented, matching the delivered empty-by-default profile branch.

## 20. PRIVACY / COMPLIANCE REVIEW

No new personal or credential data. Park reasons, window boundaries, grace deadlines, and session-state references are operational metadata about the delivery process itself. Telemetry consumption stays within the delivered aggregates-only privacy posture; the zero-spend reading counts calls and reads no message content. No tracker or vendor data flows are added.

## 21. SECURITY REVIEW HIGHLIGHTS

- No new credentials, endpoints, network surfaces, or environment variables; window evaluation is local computation over declared configuration and the injected clock.
- The nomination and attribution joins reuse the delivered identity seam; no identity material is newly exposed, logged, or persisted beyond the delivered record families.
- The bounded-grace stop adds no signal path: it composes with the delivered supervision contracts, so the system gains no new way to terminate a process.
- Configuration validation for the new rule schema is fail-closed and classified, consistent with the provider-profiles validation discipline; malformed windows refuse rather than degrade silently.
- Truthfulness guardrails (no false park claims, zero never reported on absent telemetry) double as compliance guardrails against false enforcement records.

## 22. MAINTENANCE & OPERATIONS IMPACT

- Operators declare and maintain peak-window rules per profile; the schema is validated at configuration time, so drift fails fast and classified.
- A new taxonomy version must stay in sync with the generated `events` reference surface under the delivered declaration-pinning rules — the same drift tests extend to the new kinds.
- The daemon-absent degradation statement becomes part of the operational contract and must be kept truthful as the daemon composition evolves (the supervise-only residual is the known composition dependency, RSK-8).
- The zero-spend evidence form becomes a durable artifact for retros and for the M2-S6 alarm/metric layers; changes to telemetry attribution must preserve the zero-vs-absent distinction.

## 23. GLOSSARY

| Term | Definition |
|------|------------|
| Peak window | A declared provider availability window (UTC basis) during which the provider is expensive; admission gating today, in-flight enforcement under this change |
| Provider profile | A named model-per-tier assignment with providers, seats, and pacing, declared under the provider profiles configuration branch |
| Nomination | The provider profile a delivery is bound to at dispatch admission, recorded on lane and attempt records |
| Bounded grace | The bounded interval a lane may run past its stop request before it is parked; default and maximum bounded by the window buffer |
| Parked (lane) | A lane stopped and held with a recorded reason and, where the cause carries an expiry, `until` (an `owner-hold` park's `until` is a declared classified absence); the delivered park record discipline with read-time expiry |
| Session state preservation | Keeping the session identity and resume capability intact across a park so the lane resumes where it stopped |
| Window-end resume | Automatic resume of a parked lane when its window's end (buffer included) passes, via the session resume path on the same branch |
| Zero-spend assertion | A window-scoped, lane-attributed proof of zero billable model calls, distinguishable from telemetry absence |
| Iteration-start gating | The delivered admission behavior: a profile in its peak window is ineligible for new dispatches (provider-profiles F-6) |
| Supervise-only | The delivered production daemon composition without a lane composition (GH-238 residual) |
| Owner hold | The host-wide read-time hold gate that outranks parks and provider windows; resolved from an environment value or a host-root marker carrying source and optional bounded reason, with no expiry (delivered, #280) |
| `until` | The absolute expiry a park may carry; `peak-window` parks carry the window end; an `owner-hold` park's `until` is a declared classified absence — the hold has no expiry |

## 24. APPENDICES

### Appendix A: Vocabulary mapping (delivered sets → S17 additions)

| Delivered set | Delivered members | S17 addition | Mapping rule |
|---------------|-------------------|--------------|--------------|
| Queue park causes | `provider-window`, `provider-quota`, `preempted-for-close-item` | `peak-window`, `owner-hold` | `peak-window` rides the existing `provider-window` condition type; `owner-hold` joins beside the delivered idle reason; no renames, no removals |
| Park preservation outcome | unrecorded (resume prospects implicit) | `preserved` or `session-state-not-preserved` | Additive closed-value classification carried on the park record, the `parked` event payload, and the status/brief park fields (TDR-0030) |
| `dispatch.attempt` kinds | `started`, `refused`, `completed` | `stop`, `parked`, `resumed` | Declared taxonomy version **v2**; v1 untouched, v1 payloads byte-identical |
| `queue.graph` kinds | `entry`, `dependency-edge`, `release`, `remove` | `park-edge` | Declared taxonomy version **v2**; v1 untouched, v1 payloads byte-identical |
| Lanes `parked:<cause>` projection | delivered three causes | gains `peak-window`, `owner-hold` | Delivered renders unchanged |
| Status/brief park fields | providers and parked conditions (profile/queue level) | lane-level parked count, reason, `until` | Same collector facts; brief adds zero reads |

### Appendix B: Source anchors

- Ticket: GitHub issue 294 (milestone M2); backlog story M2-S17 in `doc/planning/oss-tooling/backlog.md`.
- M2 planning pack: `milestones/m2/contracts.md` ("Provider profiles and peak windows (S17 additions)"), `milestones/m2/architecture.md` (S17 park-and-resume flow), `milestones/m2/journeys.md` (S17 cost-control journey), `milestones/m2/test-scenarios.md` (SC-M2-S17-01..07), `milestones/m2/commands/events.md` (extension path), `milestones/m2/commands/queue.md`, `milestones/m2/commands/board.md`, `milestones/m2/commands/spend.md`.
- Current-truth spec pages: provider-profiles (F-6, UTC windows, availability probe), resident-daemon (lane supervision, reconciliation, safe-boundary preemption, watch/degradation, supervise-only residual), dispatch-engine (admission, attempt records, resume economics), telemetry-v2 (attribution, classified absence), event-taxonomy (topics, envelope, boundaries), scheduling-engine (park causes, owner-hold precedence), watchdog-lane-contracts (liveness bounds), state-layer (additive record discipline), status-digest, brief.
- Planning session: PM clarify_scope summary for GH-294 (this change's folder pm-notes).

## 25. DOCUMENT HISTORY

| Version | Date | Author | Changes |
|---------|------|--------|---------|
| 1.0 | 2026-11-13 | @spec-writer | Initial specification |
| 1.1 | 2026-11-13 | @spec-writer | Resolved OQ-1..OQ-3 per TDR-0028/0029/0030; decision log (DEC-9..DEC-11), capabilities, ACs, and compatibility statements aligned |
| 1.2 | 2026-11-13 | @spec-writer | Added scheduling-engine and spend to affected-pages enumeration per DoR iter-1 |
| 1.3 | 2026-11-13 | @spec-writer | DM-4 owner-hold until corrected to classified absence per delivered #280 truth; park writers named; DEC-12 records M2-pack deviation (DoR iter-2 finding A) |

---

## AUTHORING GUIDELINES

- Authored from the GitHub issue 294 text (goal, tasks, seven verbatim ACs), the backlog story M2-S17, the M2 planning pack (contracts, architecture, journeys, test scenarios, command pages), the PM clarify_scope summary, and the current-truth system spec pages listed in Appendix B. No invention beyond those sources: every committed M2-pack mapping (park causes, event shapes, zero-spend evidence form, grace bound, nomination field) is carried into the capabilities and decision log verbatim in meaning.
- The three genuine gaps the sources leave open were captured as OQ-1..OQ-3 with the `@decision-advisor` pointer, per convention; all three are resolved as of v1.1 by TDR-0028, TDR-0029, and TDR-0030, whose wording governs where it sharpens this spec.
- Scope discipline: this spec states behavior and contracts only. Mechanism choices (how the watcher schedules, how the stop is delivered to the lane executor, where the nomination field lands in each payload) belong to the plan.
- Tech-neutral phrasing with repo conventions: guarded/closed vocabularies, additive versioned records, taxonomy versioning, truthful degradation, and bounded evidence are treated as standing system guarantees this change joins rather than re-specifies.

## VALIDATION CHECKLIST

- [x] `change.ref` matches provided `workItemRef` (GH-294)
- [x] `owners` has at least one entry
- [x] `status` is "Proposed"
- [x] All sections present in order (1-25 + guidelines + checklist)
- [x] ID prefixes consistent and unique (F-, AC-, NFR-, RSK-, DEC-, DM-, OQ-, EVT-)
- [x] Acceptance criteria reference at least one F-/NFR-/DM-/EVT- ID and use Given/When/Then
- [x] NFRs include measurable values
- [x] Risks include Impact & Probability
- [x] No implementation details (no file-level code paths, no step-by-step tasks)
- [x] No content duplicated from linked docs beyond anchored summary
- [x] Front matter validates per front_matter_rules
