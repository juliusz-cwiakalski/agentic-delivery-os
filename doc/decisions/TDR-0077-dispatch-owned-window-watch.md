---
id: TDR-0077
decision_type: tdr
status: Proposed
created: 2026-11-26
decision_date: null
last_updated: 2026-11-26
summary: "GH-413 DEC-1: a lane is watched by the composition that owns it. The one-shot dispatch run path supplies the profile-window watch for the lane it started, at every observation from its first session to its terminal classification, over the delivered decision functions, clock, park record family, preservation classification, and taxonomy v2 kinds, so the current-truth statement that without a resident daemon there is no window watcher and no mid-flight park is superseded for dispatch-started lanes and a composition that supplies no watch degrades to the delivered iteration-start gating. The rule source is the nominated profile's `peakWindows` branch, read from the nomination stored on the durable lane record; provider-entry `peak` windows stay admission-only; only a profile declaring `peakWindows` is pausable and the shipped defaults declare none; the park's end is the effective end of the first open window, and overlapping windows yield consecutive exactly-once episodes, never one merged park. A reference never carries two parks: the watch's already-parked rule is occupancy (any standing `peak-window` park, whatever its `until`); a resume or re-dispatch of a lane whose standing park has not expired is a pre-session refusal with the delivered `queue.precondition.unmet` identity at exit 1, naming the cause and `until` and writing nothing (DEC-22); an expired standing park is recovered through the delivered mutating park pass (`recoverQueueParks`) before the first stop decision and at the first observation of a resume, so the pass only ever meets an expired park or none (DEC-23); and an unrecoverable park refuses the run, because a double park fails every park-reading surface for good. The `lanes` machine read's `peakEnforcement.mode` is configuration-derived (`window-watch` when automatic pausing is enabled, `iteration-start-gating` when it is disabled, no third value, `parkClaimed` record-derived), which is the one intended change to a no-park payload. `dispatch stop <ref>` admits `peak-window` only: another cause or a missing `--until` is `input.value.rejected` at the grammar boundary, the missing end carrying the delivered `until-required` reason. A lane is running only when its newest record is `active`, carries a session identity, and has no open park of any cause, so an already-parked lane is refused and never parked twice. The command resolves the session identity and the tree root (the recorded worktree path, otherwise the repository's main checkout) from the lane record, sends no signal of its own, writes the complete episode frame only after a confirmed terminate, and reaches the owning invocation through that record; the invocation withholds terminal classification for at least the applied grace plus one observation cadence after session end, because the terminate call awaits the whole grace, then re-reads the park and waits and resumes. That withhold is a result-latency cost of about 50 s at the defaults on every session end. The pre-session park (DEC-14) is withdrawn and is not a mechanism of this record: a dispatch admitted inside an already-open window spawns and is parked at its first observation, a declared residual of one observation cadence plus the applied grace. No new park cause, event kind, record kind, identity, result token, mode value, or kill path is introduced; the lease that keeps the lane single-flight through the park is the companion record TDR-0078."
owners: ["Juliusz Ćwiąkalski"]
service: "delivery-os dispatch engine: the one-shot run path's peak-window watch, park episode, and operator stop"
decision_scope: repo
review_date: null
business_impact: "A declared peak window becomes an enforced rule for the lane the operator started, with no second process to remember to run: from its first observation onward no lane bills peak-rate tokens inside an open window of its nominated profile, and a dispatch admitted inside an already-open window bills for one observation cadence plus the applied grace. The cost is one watch composition on the run path, an invocation that can stay in flight for the length of a window, at least the applied grace plus one observation cadence withheld before the result of every session end (about 50 s at the defaults), and one operator precondition (activity-keyed stall detection must leave a parked lane alone)."
customer_impact: "An operator who dispatches across a window gets one invocation that pauses the lane, explains the pause on `dispatch status`, `lanes`, and `board`, resumes at the window's end, and returns one result that says so. `dispatch stop <ref> --cause peak-window --until <iso>` requests the same pause on demand; it is refused by name and writes nothing when the lane is not running or is already parked, and it answers only once the session's stop is confirmed and the park is written. Every dispatch returns its result at least the applied grace plus one observation cadence after its session ends, about 50 s at the defaults. `lanes --json` reports `peakEnforcement.mode: \"window-watch\"` where automatic pausing is on."
classification:
  domains: [dispatch, delivery-lifecycle, cost-control, provider-profiles, operations, security]
  archetype: design
  environment: complicated
  rigor: R2
  reversibility: moderate
  stakes: medium
  urgency: medium
  uncertainty: medium
  blast_radius: team
  recurrence: recurring
governance:
  driver: "@decision-advisor (GH-413: the companion record the change specification's decision log mandates for DEC-1, DEC-3, DEC-6, DEC-12, DEC-15, and DEC-23, with the DEC-20 and DEC-21 contract clarifications and the DEC-22 refusal cited by C-6 and D8)"
  decider: "Juliusz Ćwiąkalski — human acceptance at the GH-413 pull-request review; AI does not accept this R2 record"
  contributors:
    - "@pm (GH-413 clarify-scope, the intake cross-check, and the Definition-of-Ready remediation decisions)"
    - "@spec-writer (GH-413 specification v1.3: F-1 to F-12, DEC-1 to DEC-21, NFR-1 to NFR-10, RSK-1 to RSK-14, and Appendices A to D)"
    - "@readiness-reviewer (GH-413 Definition-of-Ready iterations 1 to 3: findings 1, 3, 4, and 7; findings 1, 2, 5, and 9; findings 1 and 3: the code-truth basis of these decisions)"
    - "@decision-advisor (repository analysis, option analysis, and this record)"
  reviewers:
    - "@reviewer"
    - "Human owner (GH-413 pull-request review: this record supersedes a published statement and gives a stop seam its first production mount)"
  performers:
    - "@coder (the watch composition with its standing-park recovery, the mode input, and the operator command with its confirmed-terminate rule and record-mediated hand-off)"
    - "@test-plan-writer (the parity, stop, already-parked, standing-park, unconfirmed-terminate, race, withheld-classification, and mode arms)"
    - "@doc-syncer (the eighteen-page reconciliation to the replacement truth)"
  informed:
    - "Operators of native deliveries, who may now see a dispatch in flight for the length of a window and every result about 50 s later at the defaults"
    - "Authors of a composition that will supervise several lanes in one process (parallel lanes, GH-412)"
    - "Taxonomy consumers, who gain producers for existing kinds and no new kind"
ai_assistance:
  used: true
  roles: [repository-analyst, analyst, option-generator, record-writer]
  external_data_shared: false
  citations_verified: true
  human_decider: null
  reviewers: []
revisit_triggers:
  - "A composition that supervises several lanes in one process needs the watch (parallel lanes, GH-412). The per-lane watch and lease contract this record fixes are its precondition; extending the watch to a multi-lane composition reopens this record rather than inheriting it."
  - "The delivered layer gains an honest representation for a park with no session and no lane record. The already-open-at-start case, left out of scope by the withdrawn DEC-14 as a declared residual, is re-decided then; this record does not decide it."
  - "The delivered layer gains a repair for a double park (a compaction or a repairing pass), so that two active parks for one reference stop being permanent. The occupancy rule is re-read then; until then it is not negotiable."
  - "The delivered projection or the resume decision frames a further park cause. `dispatch stop` extends to that cause through its own decision; until then the cause set stays `peak-window` only, because another cause would promise an episode the delivered machinery cannot frame or resume."
  - "The result-latency cost of the withhold proves unacceptable in operation, or the delivered terminate path stops awaiting the whole grace before it returns. The bound is re-decided with that; a control channel stays forbidden unless a record reopens NG-6 and this decision together."
  - "The delivered terminate path cannot reach a session held by another process on a real host, or an owning invocation is observed classifying before a stop command's park lands. The hand-off is re-decided with the incident."
  - "The decision layer is proposed to union overlapping windows, provider-entry `peak` windows are proposed as a lane-watch rule source, or profile `peakWindows` as an admission gate. Each changes the rule contract this record states and is reopened as its own decision with the nomination rule (TDR-0028), never widened locally."
  - "The resident-daemon composition mounts the watch in production, or a third composition-fact mode value is proposed. The replacement truth and the mode rule are restated then."
  - "A calendar-shaped or weekday-only window policy lands (GH-382). The rule data changes shape and this record's rule-source clause is re-read against it."
links:
  related_changes: ["GH-413"]
  supersedes: []
  superseded_by: []
  spec:
    - "doc/changes/2026-11/2026-11-26--GH-413--peak-pausing-dispatch-lane/chg-GH-413-spec.md"
    - "doc/spec/features/feature-peak-pausing.md"
    - "doc/spec/features/feature-dispatch-engine.md"
    - "doc/spec/features/feature-resident-daemon.md"
    - "doc/spec/features/feature-provider-profiles.md"
    - "doc/spec/features/feature-event-taxonomy.md"
  contracts:
    - "packages/core/src/domain/daemon-peak-pause.ts"
    - "packages/core/src/domain/event-projection.ts"
    - "packages/core/src/domain/queue-park.ts"
    - "packages/core/src/app/queue.ts"
    - "packages/core/src/contracts/dispatch.ts"
    - "packages/core/src/contracts/harness.ts"
    - "packages/core/src/contracts/queue.ts"
  diagrams: []
  decisions: ["TDR-0028", "TDR-0029", "TDR-0030", "TDR-0049", "TDR-0051", "TDR-0052", "TDR-0078"]
  experiments: []
  metrics: []
  roadmap_items: ["M4-S42"]
---

# TDR-0077: A Lane Is Watched by the Composition That Owns It: The Dispatch Run Path Supplies the Profile-Window Watch for the Lanes It Starts

> **Traceability.** Spec v1.3 §15 **DEC-1** (the supersession), **DEC-3** (reuse, never parallel), **DEC-6** (the configuration-derived mode and the one intended value change), **DEC-12** (the rule source and the deployment precondition), and **DEC-15** (the `peak-window`-only stop, its confirmed-terminate rule, and its record-mediated hand-off), and **DEC-23** (occupancy with recovery), with **DEC-22** (the pre-session refusal for an un-expired standing park) cited by C-6 and D8, and with two contract clarifications the specification keeps change-local because each restates a delivered fact: **DEC-20** (the first open window's end and consecutive episodes) and **DEC-21** (the grammar refusals). §5.1 F-1 to F-4, F-6, F-8, F-9, F-10; §6 Flow 3; §7.2 (the withdrawn pre-session park, its residual, and the standing park); §8.2; §8.3 DM-1, DM-2, DM-7, DM-8; §8.5; §9 NFR-1, NFR-2, NFR-8, NFR-9; §11 RSK-3, RSK-7, RSK-12, RSK-14; §17 AC-F1-1, AC-F1-2, AC-F2-1 to AC-F2-3, AC-F3-1, AC-F3-3, AC-F3-4, AC-F6-3, AC-F6-4, AC-F8-1, AC-F8-2, AC-F9-1 to AC-F9-4, AC-F10-1, AC-F10-2; §24 Appendix A and Appendix C. **DEC-14 is withdrawn and is carried by no record.** Reuses [TDR-0028](TDR-0028-no-nomination-classified-admission-refusal.md), [TDR-0029](TDR-0029-event-taxonomy-v2-peak-pause-kinds.md), and [TDR-0030](TDR-0030-park-preservation-failure-classification.md). The lease that keeps the lane single-flight through the park is the companion record [TDR-0078](TDR-0078-lease-heartbeat-amends-tdr-0050.md), which is not part of this record.

## Context

- **FACT:** The profile-window watch is one delivered decision layer that a composition mounts. `decidePeakStops`, `runPeakWatch`, `decidePeakResumes`, and `runPeakResume` are pure decisions plus fenced appends over the injected clock and a lane's recorded nomination (`packages/core/src/domain/daemon-peak-pause.ts:151-279, 318-354, 445-539`). The daemon supervision cycle mounts them through an optional `peakPause` port (`packages/core/src/app/daemon-supervision.ts:49, 183-230`), and current truth states that the supervision cycle runs the watch once per cycle (`doc/spec/features/feature-peak-pausing.md` §4).
- **FACT:** No production composition mounts the watcher today. The `peakPause` ports are consumed only by the daemon supervision module and no composition under `packages/**` supplies them; the decision layer's own comment records it (`daemon-peak-pause.ts:193-197`). GH-413 is the delivered watch's first production mount.
- **FACT:** The one-shot run path has no episode concept. It claims the repository lease, provisions the worktree, spawns or resumes a session, appends an active lane record at acquisition, polls liveness at the `lane.liveness-interval` cadence while collection is pending, and classifies as soon as collection resolves (`packages/core/src/app/dispatch.ts:811, 1132-1228`). A clean session exit is always terminal (TDR-0052 DC-2). Nothing inside one invocation parks, waits, or resumes.
- **FACT:** The nomination is durable only at the end. `DispatchLaneRecord` carries no `providerProfile` (`packages/core/src/contracts/dispatch.ts:675-696`). The attempt record that carries it is appended at the terminal classification, so a running lane has no stored nomination for a watch, a stop issued by another process, or a resume after a killed invocation to read.
- **FACT:** Production reports `peakEnforcement.mode: "iteration-start-gating"`. The mode derives from the reading composition's `peakWatchComposed` fact (`packages/cli/src/edge.ts:6910-6918, 7802, 7828-7831`), whose only setter in the repository is a test override (`tests/behaviour/peak-pause-composed-edge.test.ts:822`). The closed mode set has two members (`packages/core/src/contracts/queue.ts:931`).
- **FACT:** Current truth states the degradation this decision supersedes: "Without a resident daemon there is no window watcher and no mid-flight park" (`feature-peak-pausing.md` §9, restated in the composition-fact paragraph of `doc/spec/features/feature-resident-daemon.md`).
- **FACT:** Two rule sources exist and bind at different points. A profile's `peakWindows` are lane-watch rule data and take no part in eligibility. A provider entry's `peak` window makes the provider unavailable and its profiles ineligible at admission (`doc/spec/features/feature-provider-profiles.md`, Selection and eligibility). The decision function skips a lane with no nomination and a profile with no rules (`daemon-peak-pause.ts:176-198`), and it answers with the effective end of the first window it finds open (`:102-140`).
- **FACT:** A profile's `peakWindows` take no part in admission, so a dispatch admitted while its nominated profile's window is already open is not refused (GH-413 spec v1.3 §2.1). The specification's v1.1 proposed parking such a lane before its first session. Version 1.2 withdraws that decision (DEC-14) because the delivered layer cannot express it: a recovered `peak-window` record classified `preserved` projects a `resumed` frame (`packages/core/src/domain/event-projection.ts:659-676`), the resume half routes a preserved park to the session-resume path and skips it when no session reference resolves (`daemon-peak-pause.ts:481-487`), and no lane record exists before the first session is acquired.
- **FACT:** The delivered projection and resume decision frame one cause. `stop`, `parked`, and `resumed` are emitted only over `peak-window` park records, and `stop` and `parked` only over a complete episode frame (`event-projection.ts:591, 608-614, 623-676`). The resume decision reads only `peak-window` parks (`daemon-peak-pause.ts:328`).
- **FACT:** A park is not a lane state, and a double park is permanent. A parked lane's newest lane record stays `active` with its session identity. Two `parked` records for one ref make the delivered duplicate invariant true at the second record and keep it true, whatever is appended later (`packages/core/src/domain/queue-park.ts:89-102`), so every park read fails closed with `state.store.torn` for good (`packages/core/src/app/queue.ts:722-727`). The history is append-only: nothing can repair it.
- **FACT:** The watch's only guard against a second park is the `parkedRefs` its composition supplies. `decidePeakStops` skips a ref in that set and nothing else (`daemon-peak-pause.ts:160-177`), and `runPeakWatch` appends a park for every stop its decision returns (`:250-278`). The delivered reference pattern supplies un-expired parks only (`tests/behaviour/daemon-peak-window-park.test.ts:116-128`; `daemon-supervision.ts:50-51`), while the delivered occupancy home counts any standing `parked` record, whatever its `until` (`queue-park.ts:104-131`).
- **FACT:** A delivered mutating park pass exists, and nothing on the dispatch path calls it. `recoverQueueParks` appends a clear-observed marker, then a recovered record with a `park-auto-recovery` incident; a refused recovery leaves the marker standing and reports the ref as stuck; reads never call it; and it mutates nothing under an active owner hold (`packages/core/src/app/queue.ts:2557-2677`). Today only the queue command family's mutations call it (`packages/cli/src/edge.ts:7064-7076` and its callers).
- **FACT:** Three outcomes the specification itself defines leave an expired `parked` record standing for a lane that later runs again: an orphaned park followed by the operator resume (RSK-3), the refusal return of DEC-18, and restart-budget exhaustion followed by a later dispatch of the ref.
- **FACT:** The delivered terminate operation takes an in-memory session handle and one `graceMs` (`packages/core/src/contracts/harness.ts:609-614`). The opencode adapter resolves its target from its own in-memory session registry and answers a session it does not hold with success and no signal (`packages/adapters/src/harness/opencode.ts:791-800`), and a terminate call returns only after the full grace has been waited (`:833`).
- **FACT:** A lane record's `worktreePath` is present exactly when the lane runs in its own worktree and is absent on an in-checkout lane (`packages/core/src/contracts/dispatch.ts:688-693`). The dispatch family refuses malformed grammar with `input.value.rejected` before any runtime call. The reason `until-required` is delivered on the expiry-carrying release grammar, where it rides that family's own invocation refusal (`packages/cli/src/commands/queue.ts:331-337, 737-744`).
- **FACT:** The incident is in scope of the rule source. On 2026-11-25 a lane committed at 07:22Z inside a declared 06:00-10:00Z window and `status` reported no park (GH-413 spec §2.2). The reference host's tracked `.jaiship/config.yaml` declares profile `delivery` with `peakWindows` at 01:00-04:00 and 06:00-10:00 UTC and the preference chain whose base is `delivery`. With their declared buffers the two windows overlap in effect from 04:00 to 04:05 UTC.
- **FACT:** The Definition-of-Ready reviews found the gaps these decisions close: iteration 1 (findings 1, 3, 4, and 7), iteration 2 (findings 1, 2, 5, and 9), and iteration 3 (findings 1 and 3: the watch-side double park, and the withhold stated two ways).
- **Why now:** GH-413 is the owner's direction that a lane started by `dispatch` is watched for its whole life, and its specification (DEC-1, DEC-3, DEC-6, DEC-12, DEC-15) mandates this record because the change supersedes a published current-truth statement, gives the delivered watch and its stop seam a first production mount, changes one value of a published payload, and adds an operator command that stops a session another process owns. Which composition owns the pause, from which rule data, and through which surfaces is a technical decision about the engine's composition: record type TDR.

## Problem Framing (Clarified)

The question is not "should a dispatch lane pause inside a peak window": the owner's direction and the ticket fix that. The question is **which composition is responsible for the pause, from which rule data, and through which surfaces, without creating a second peak-pausing machinery beside the delivered one.**

First principles: a declared window is enforced for a lane when four things hold for the lane's whole life. A watcher owns the lane. The watcher reads a rule for that lane. It can perform a bounded stop. It leaves a record, so the pause is visible and resumable. The daemon composition has all four where it is mounted. A dispatch-started lane had none: no watcher (the run path has no episode concept), no stored rule key while it runs (the nomination is terminal-only), no stop route from outside the owning process, and no record because no park happened.

One case is deliberately left outside the decision: a window that is already open when the dispatch starts. The delivered layer has no honest representation for a park with no session, so the change bounds that exposure and declares it instead of inventing a representation (DEC-14, withdrawn).

Three sub-questions decide the mechanism:

1. **Who watches?** A watcher that exists only when a second process happens to run is not an enforcement of the operator's declared rule for the lane the operator started.
2. **Which rules, and what does the record promise?** Two rule sources exist. Reading the wrong one either exempts a lane that its profile's rules cover, or turns the lane watch into a second admission gate. And a record may claim only what the delivered decision returns.
3. **How does a lane get parked exactly once, by the watch and by an operator?** A watch that appends a park for every stop it decides will park a lane twice unless a standing park is closed first, and the ledger cannot undo that. A separately invoked command cannot address an in-memory handle, must not add a control channel or a kill path, and must not record a stop that never happened.

Root cause versus symptom: the symptom is peak-rate spend inside a declared window while every surface reports nothing wrong. The cause is an ownership gap: the pause was attributed to "a resident daemon" instead of to "the composition that owns the lane".

Deliberately out of scope: the daemon's supervision cycle, watch, park, and resume (NG-1); parallel lanes (NG-2); calendar-shaped window policy (NG-3); resident mode (NG-4); the shell orchestrator (NG-5); a read surface for a window as an object (NG-7); admission gating and the nomination rule (NG-8); a park before the first session (NG-10); automatic recovery of an episode whose dispatch process was killed during the wait, until the lane runs again.

## Constraints (Hard Requirements)

### C-1: A dispatch lane is watched for its whole life, by the composition that owns it

- **Statement:** From its first session to its terminal classification, a lane started by `dispatch` is evaluated against its nominated profile's window state by code in the run path itself, at every observation and before the session is observed for the next step. The watch depends on no resident daemon or other process happening to run, and on no prompt or session conformance.
- **Source:** AC (GH-413 G-1, F-1, NG-4; AC-F1-2)
- **Verification:** test (a window that opens mid-iteration and one that opens between iterations; the watch still active before the terminal classification) + code review
- **Negotiable:** no

### C-2: Reuse, never parallel, and claim nothing the layer does not deliver

- **Statement:** The dispatch-owned watch composes the delivered decision functions over the same injected clock, the delivered park record family with read-time expiry, the closed preservation classification, and the taxonomy v2 episode kinds with their declared payloads. It defines no second vocabulary, no parallel event family, and no new park cause, event kind, record kind, schema identity, error identity, result token, or composition-fact mode value. The dispatch-owned watch and the daemon's watch take the same decision for the same profile and instant, and the record claims no behaviour the delivered decision functions do not return, such as one park spanning overlapping windows.
- **Source:** AC (GH-413 DEC-3, DEC-20, NG-6, NFR-8, AC-F1-1); prior decision (TDR-0029 D2 and D3; TDR-0030 D1 to D5)
- **Verification:** test (the parity fixture over both compositions; set-equality inventories over each closed set) + code review (the decision layer is composed, never edited or re-derived)
- **Negotiable:** no

### C-3: One rule source for the lane watch

- **Statement:** The pause reads the nominated profile's `peakWindows` branch, the rule data the daemon's watch reads, taken from the nomination stored on the durable lane record. A provider entry's `peak` windows gate admission only and never drive the lane watch; a profile's `peakWindows` never gate admission. A profile with no branch has no lane-watch enforcement. A lane with no stored nomination is not window-pausable and is never given a fabricated one. A preference chain whose first entry declares no windows does not exempt a lane nominated to a later profile that declares them.
- **Source:** AC (ticket AC2 and AC5 as the specification restates them; GH-413 F-2, NG-8, NG-9, DEC-12; AC-F2-1, AC-F2-2, AC-F2-3, AC-F11-2); prior decision (TDR-0028 D4)
- **Verification:** test (the four acceptance arms) + code review (no admission predicate reads `peakWindows`)
- **Negotiable:** no

### C-4: Enforcement is bounded by one observation cadence, and the one residual is declared

- **Statement:** From the lane's first session, a window that opens is enforced within one observation cadence. A window already open when the dispatch starts is out of scope and declared: such a dispatch spawns as delivered and is parked at its first observation, so at most one observation cadence plus the applied grace of billable work precedes the park, and no billable call follows the park instant. No park record is written for a lane that has no session.
- **Source:** AC (GH-413 G-1, F-1, NG-10, RSK-12; DEC-14 withdrawn; AC-F1-2; the §4.1 exposure target)
- **Verification:** test (a window that opens mid-iteration and one that opens between iterations; the already-open case parks at the first observation and writes no session-less park record)
- **Negotiable:** no

### C-5: One bounded-grace stop and an exactly-once park

- **Statement:** A stop is one stop request and exactly one terminate call through the delivered terminate path, with TERM before KILL and KILL only over a target still listed. One episode yields exactly one `stop`, one `parked`, and one `park-edge`, and for a preserved episode exactly one `resumed`, all sharing one episode id, across any number of observations. Where overlapping windows produce consecutive episodes, each is framed separately and exactly once. No signalling route exists beside the delivered terminate operation.
- **Source:** AC (ticket AC1 and owner-comment AC B1 as the specification restates them; GH-413 F-3, NFR-1, NFR-2, §21); prior decision (TDR-0051 DC-2 to DC-4)
- **Verification:** test (AC-F3-1, AC-F3-3, AC-F9-1, AC-F9-2: one terminate call, the composed grace, zero duplicate frames)
- **Negotiable:** no

### C-6: A reference never carries two parks

- **Statement:** The watch's already-parked rule is occupancy: any standing `peak-window` park for the reference, whatever its `until`, suppresses a new stop. A resume or re-dispatch of a lane whose standing park has not expired is refused at the admission of the resume, before any session starts, with the delivered `queue.precondition.unmet` identity at exit 1, naming the park's cause and `until`, and writes nothing. An expired standing park is recovered through the delivered mutating park pass (`recoverQueueParks`: the clear-observed marker, the recovered record, and the `park-auto-recovery` incident), so the pass only ever meets an expired park or none. An expired park that cannot be recovered refuses the run, which starts no new episode and never abandons a live session: a failure observed after the resume's session has started ends that session through one terminate on the delivered path, with no park written.
- **Source:** AC (GH-413 DEC-22 (the pre-session refusal), DEC-23 (occupancy with recovery), F-3, F-4, DM-1, RSK-3, RSK-14, §7.2; AC-F3-4); internal standard (the delivered duplicate-active-park invariant: at most one active park per reference)
- **Verification:** test (AC-F3-4: the standing-expired-park arm, where the next window finds one active park and one new episode; a resume or re-dispatch while the park has not expired is refused `queue.precondition.unmet` at exit 1 naming the cause and `until`, with no session, no park, and no event written; an expired park that cannot be recovered refuses the run with no new episode; and when that failure is observed after the resume's session has already started, the invocation issues one terminate through the delivered path for the session it started, writes no park, and returns the classified refusal, leaving no live session behind (GH-413 spec F-3))
- **Negotiable:** no

### C-7: The operator stop is one cause, refused at the grammar boundary, real or refused, and never double-parked

- **Statement:** `dispatch stop <ref>` admits `peak-window` only and requires `--until`. Another cause, or a missing end, is `input.value.rejected` at the grammar boundary before any read of a lane, the missing end carrying the delivered `until-required` reason, and no identity, error-table row, or reason token is added. A lane is running only when its newest lane record is `active`, carries a session identity, and has no open park of any cause standing for the ref, because the delivered duplicate invariant counts every cause. A terminal record, an absent record, a record with no session identity, and an already-parked lane are not running and are the delivered unmet-precondition refusal, so no second park is ever appended for one ref. The command sends no signal of its own: exactly one terminate call goes through the delivered terminate path. It resolves the session identity and the tree root from the lane record, the recorded worktree path when present and otherwise the repository's main checkout. It writes the park only after a confirmed terminate; an unconfirmed terminate is the not-running refusal and writes nothing. A request that races a session end resolves exactly one classified outcome.
- **Source:** AC (owner-comment AC B1 and AC B2 as the specification restates them; GH-413 F-9, F-10, DEC-7, DEC-8, DEC-15, DEC-21, DM-8, NFR-8; AC-F9-1 to AC-F9-4, AC-F10-1, AC-F10-2); prior decision (TDR-0051 DC-2 to DC-4)
- **Verification:** test (the already-parked arm for a park of any cause, the unconfirmed-terminate arm, the grammar arms, the in-checkout tree root, one terminate call) + code review (no signal outside the terminate operation)
- **Negotiable:** no

### C-8: The hand-off is the record, and the command's park is not orphaned

- **Statement:** The command reaches the owning invocation through durable state alone: no socket, token, or cross-process signal path exists. The owning invocation remains the resume owner. When its collection resolves at session end, it withholds terminal classification for at least the applied grace plus one observation cadence and re-reads the park record for its ref: an open `peak-window` park places it in the wait and resume path, and with no park in that interval it classifies exactly as delivered. A park that lands just after session end is therefore never orphaned by classification, on any configuration of the grace and the cadence.
- **Source:** AC (GH-413 F-9, DEC-15, RSK-7, §21; AC-F9-4, AC-F10-2)
- **Verification:** test (the arm in which the session end is observed before the park record is durable, with the kill grace at and above the observation cadence) + code review (no control channel)
- **Negotiable:** no

### C-9: A two-value composition-fact read with one declared value change

- **Statement:** `peakEnforcement.mode` derives from the reading composition's own effective configuration: `window-watch` when automatic pausing is enabled and the watch is therefore composed, `iteration-start-gating` when pausing is disabled or no watch is composed. No third value exists. The mode is never derived from another process or from a test-only override, and `parkClaimed` stays derived from durable park records. With no open park every delivered field and line is byte-identical except this one value on a production composition with pausing enabled, and one declared boolean key, default on, restores the delivered behaviour without a code change.
- **Source:** AC (GH-413 DEC-2, DEC-6, F-8, NFR-9, §8.5; AC-F6-3, AC-F6-4, AC-F8-1)
- **Verification:** test (both values through the production composition with a control that cannot pass vacuously; the no-park byte-identity with the one named carve-out)
- **Negotiable:** no

> **Table stakes:** every alternative below keeps the daemon's own supervision cycle, watch, park, and resume untouched (NG-1), renders a park through the delivered `lanes`, `board`, `brief`, and window-scoped spend projections, inherits the delivered owner-hold precedence and per-profile isolation, and leaves the published lane-view derivation (`stale`, `delivering`) as delivered. None of these eliminates an alternative.

## Decision Drivers

**Technical drivers (ranked):**

1. **One decision contract, fewest compositions that can drift.** Two watchers that share one decision layer cannot disagree; two rule engines can.
2. **Vocabulary economy.** The episode is the delivered episode: the same kinds, the same record, the same classification. Every new identifier is a second contract to keep true.
3. **Enforcement at the earliest point.** From the lane's first observation, a window that opens costs at most one cadence of billable work. The one earlier exposure, a window already open at dispatch start, is bounded by one cadence plus the applied grace and declared.
4. **Truthful reads and records.** A read states what its own composition supplies, and no surface or record claims a park, a stop, or a resume that did not happen.

**Operational drivers:**

5. **Operator actionability.** A parked lane is explained on three surfaces and by one additive fact, a stop is reachable on demand, and every refusal names its cause and writes nothing.
6. **A declared, recoverable escape.** The default is inspectable by absence, and one key returns the delivered behaviour.
7. **Solo-maintainer cost.** One decision layer, one park record family, and a reconciliation that is done once.

**Cost control:**

8. **A falsifiable zero.** "No billable call after the park instant" is a count that can fail, not a state label.

## Decision Rights (DACI)

- **Driver:** `@decision-advisor` (GH-413: the companion record the specification's decision log mandates).
- **Decider / Approver:** Juliusz Ćwiąkalski, human acceptance at the GH-413 pull request. The AI does not accept this record, and `decision_date` stays null until that acceptance.
- **Contributors:** `@pm` (clarify-scope and the Definition-of-Ready remediation decisions), `@spec-writer` (the specification's capabilities, decisions, requirements, and risks), `@readiness-reviewer` (the code-truth findings of the three iterations), `@decision-advisor` (analysis and this record).
- **Required reviewers:** `@reviewer`, human owner.
- **Performers:** `@coder` (the watch with its standing-park recovery, the mode input, the operator command and its hand-off), `@test-plan-writer` (the fixture arms), `@doc-syncer` (the eighteen-page reconciliation).
- **Informed:** operators of native deliveries; authors of future lane-owning compositions; taxonomy consumers.

**Type note.** TDR. The architecture-level questions are delivered and are not reopened: exclusion is a repository-exclusive lease (TDR-0026, TDR-0050), the park record family and the taxonomy v2 kinds are contract decisions (TDR-0029, TDR-0030), and the decision functions and the park pass exist (GH-294, GH-295). This record fixes which composition mounts the delivered watch for the one-shot lane, the rule data it reads, the input of one published read, and the cause set and hand-off channel of one operator command, inside those. It is R2 because it supersedes a published current-truth statement, changes one value of a published payload, and gives a stop seam its first production mount. It is not R3 because every fact is repo-local and read directly, the behaviour is reversible by one configuration key, and the acceptance fixtures gate the merge.

## Evidence, Assumptions & Unknowns

| Item | Label | Source | Impact if false | Confidence |
|------|-------|--------|-----------------|------------|
| The watch is one delivered decision layer mounted through an optional `peakPause` port, and no production composition supplies that port | FACT | `daemon-peak-pause.ts:151-279, 318-354, 445-539, 193-197`; `daemon-supervision.ts:49, 183-230` (read 2026-11-26) | ALT-1 would be an existing behaviour to keep rather than a dependency to remove, and the first-mount framing would be wrong | High |
| The one-shot run path has no episode concept and classifies as soon as collection resolves | FACT | `app/dispatch.ts:811, 1132-1228`; TDR-0052 DC-2 | The watch would extend an existing episode path instead of adding one | High |
| `DispatchLaneRecord` carries no `providerProfile`; the nomination is durable only on the terminal attempt record | FACT | `contracts/dispatch.ts:675-696` | The stored nomination the hand-off reads (specification DEC-16) would be redundant | High |
| Production reports `iteration-start-gating`, and the only setter of `peakWatchComposed` is a test override | FACT | `cli/src/edge.ts:6910-6918, 7802, 7828-7831`; `tests/behaviour/peak-pause-composed-edge.test.ts:822` | DEC-6 would change no observable value and the byte-identity carve-out would be unnecessary | High |
| A profile's `peakWindows` are lane-watch rule data; a provider entry's `peak` window makes the provider unavailable at admission | FACT | `feature-provider-profiles.md` (Selection and eligibility) | ALT-2 and the selected alternative would read the same rules and C-3 would be vacuous | High |
| The delivered decision answers with the effective end of the first open window and does not union overlapping windows | FACT | `daemon-peak-pause.ts:102-140` | DEC-20 would restate something the layer does not do, and the union sentence it replaces would have been true | High |
| The projection emits `stop`, `parked`, and `resumed` only over `peak-window` parks, and the resume decision reads only `peak-window` parks | FACT | `event-projection.ts:591, 608-614, 659-676`; `daemon-peak-pause.ts:328` | The cause set could be widened without a new kind, and ALT-4 would be eligible | High |
| A recovered `peak-window` record classified `preserved` projects a `resumed` frame, and the resume half skips a preserved park that has no session reference | FACT | `event-projection.ts:659-676`; `daemon-peak-pause.ts:481-487` | A park with no session could be closed honestly, and the withdrawn DEC-14 would not have needed withdrawing | High |
| Two `parked` records for one ref keep the delivered duplicate invariant true also after a later recovery, so every park read fails closed for good | FACT | `domain/queue-park.ts:89-102`; `app/queue.ts:722-727`; GH-413 readiness iteration 3, finding 1 (executed) | A double park would be repairable, and occupancy would be optional | High |
| The watch appends a park for every stop its decision returns, and its only guard is the `parkedRefs` the composition supplies; the delivered reference pattern supplies un-expired parks only | FACT | `daemon-peak-pause.ts:160-208, 250-278`; `daemon-supervision.ts:50-51`; `tests/behaviour/daemon-peak-window-park.test.ts:116-128` | The double park could not arise from the watch, and C-6 would be unnecessary | High |
| The delivered mutating park pass appends the clear-observed marker, the recovered record, and the `park-auto-recovery` incident; a refused recovery reports the ref as stuck; it mutates nothing under an active owner hold; and only the queue command family's mutations call it | FACT | `app/queue.ts:2557-2677`; `cli/src/edge.ts:7064-7076` and its callers | The run path would need a new recovery mechanism, which C-2 forbids | High |
| A terminate call returns only after the full grace, and the run path classifies as soon as collection resolves | FACT | `adapters/src/harness/opencode.ts:833`; `app/dispatch.ts:1205-1228`; GH-413 readiness iterations 2 and 3, finding 1(b) and finding 3 | A withhold of one cadence alone would already receive the park, and the grace-plus-cadence bound would be larger than necessary | High |
| The opencode adapter answers a session it does not hold with success and no signal, so an unconfirmed stop can look like a stop | FACT | `contracts/harness.ts:609-614`; `adapters/src/harness/opencode.ts:791-800` | The confirmed-terminate rule would be redundant | High |
| The dispatch family refuses malformed grammar with `input.value.rejected`, and the reason `until-required` is delivered on the expiry-carrying release grammar | FACT | `cli/src/commands/queue.ts:331-337, 737-744`; `feature-dispatch-engine.md` (Operator surface) | The grammar refusal would need a new identity or reason, which NFR-8 forbids | High |
| The reference host's tracked configuration declares `peakWindows` on profile `delivery`, covering the incident's window, and its two windows overlap in effect for five minutes a day | FACT | `.jaiship/config.yaml` (tracked, read 2026-11-26) | The deployment precondition would be unmet on the one host where the episode is to be observed | High |
| The delivered terminate path can reach a session held by another process once the adapter resolves a handle from the durable lane record | ASSUMPTION | GH-413 spec §12 (Terminate path) | `dispatch stop` would answer a refusal for every lane it should stop, or need a second signalling route: the two halves of C-7 could not both hold | Medium |
| Activity-keyed stall detection is relaxed for a parked lane before a lane is dispatched into a window | ASSUMPTION | GH-413 spec RSK-2, DEC-19, §18 | The waiting invocation is killed and the park is orphaned (`stale: true`) until an operator resumes it; the window is still enforced and the resume is manual | Medium |
| The reference host's nominated profile keeps declaring `peakWindows` | ASSUMPTION | GH-413 spec §12, §18 | The capability is a no-op there and the cost target is not yet measured | Medium |
| A separately invoked `dispatch stop` signals the owning invocation's session on a real host | TO-CONFIRM | The parity boundary lists `os-termination` and `cross-process-race` as not proven (`feature-dispatch-engine.md`) | The command's success output would claim a stop that did not happen | Medium |
| The first real stop, park, resume, and standing-park recovery on a real session | TO-CONFIRM | GH-413 spec §18 (the hand-off), TC-PEAK-029 | Fixtures prove the contract; the live behaviour stays unobserved | Medium |

## Mental Models & Techniques Used

- **First principles:** what enforces a declared window for one lane? Four things that must hold for the lane's whole life: a watcher that owns the lane, a rule it reads for that lane, a bounded act it can perform, and a record it leaves. The daemon composition has them where it is mounted; the dispatch lane had none. Each clause of the decision supplies one, and the one case the delivered layer cannot supply honestly is bounded and declared rather than invented.
- **Inversion:** how does a lane bill through a window while every surface says nothing is wrong? No watcher at all (ALT-0, ALT-1). A rule read from the wrong source (ALT-2). A stop that never reaches the session (an in-memory handle). A lane that is never paused again because a stale park occupies it. And how does an operator stop go wrong while looking right? A lane parked twice, which fails the park read closed for good. A stop recorded for a session that was already gone. A park written after the invocation that owns the lane has already returned.
- **Second-order thinking:** the mode value change reaches every consumer that pinned it. A second watcher can duplicate an episode. A wider cause set promises episodes the ledger cannot frame. A park written before the stop it describes survives a stop that fails. An orphaned park is not only an orphan: at the next window it becomes a permanent failure or a lane that is never paused. A withhold sized to receive a stop command's park also delays every ordinary result, by the grace and not by less.
- **Systems thinking:** admission gating and in-flight pausing are one control loop, and the nomination is its join key (TDR-0028). The durable park record is the single source for the ledger, the three read surfaces, and the resume decision, so one writer discipline serves every reader, and two writers for one ref break all of them at once. Every path that makes a lane run again has to close the park the last path left.
- **KISS:** the lane and park records are already durable, shared, and read by the invocation, so they are the hand-off channel. A channel of its own would be a second surface to authenticate and supervise. The recovery pass is already delivered, so closing a standing park is a call and not a mechanism.
- **Fail-closed defaults:** pausability needs a declared rule and a stored nomination. Nothing is fabricated, and a host with no declared windows is told so rather than shown a vacuous zero.

## Alternatives Considered

### Per-Alternative Constraint-Compliance Evaluation

| | C-1 owned life-long watch | C-2 reuse | C-3 rule source | C-4 cadence bound, declared residual | C-5 one stop, exactly once | C-6 never two parks | C-7 stop contract | C-8 record hand-off, not orphaned | C-9 two-value read |
|---|:---:|:---:|:---:|:---:|:---:|:---:|:---:|:---:|:---:|
| ALT-0 keep the daemon-absent degradation | ❌ | ✅ | — | ❌ | ✅ | — | ❌ | — | ✅ |
| ALT-1 daemon-only watch | ❌ | ✅ | ✅ | ❌ | ✅ | — | ❌ | — | ✅ |
| ALT-2 provider-entry rule source | ✅ | ✅ | ❌ | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ |
| ALT-3 dispatch-owned watch with a control channel | ✅ | ❌ | ✅ | ✅ | ✅ | ✅ | ✅ | ❌ | ✅ |
| ALT-4 `dispatch stop` over the delivered cause set | ✅ | ❌ | ✅ | ✅ | ❌ | ✅ | ❌ | ✅ | ✅ |
| ALT-5 the stop command writes its park before the terminate | ✅ | ✅ | ✅ | ✅ | ❌ | ✅ | ❌ | ✅ | ✅ |
| ALT-6 expiry-aware already-parked rule, with no recovery | ✅ | ✅ | ✅ | ✅ | ✅ | ❌ | ✅ | ✅ | ✅ |
| ALT-7 selected: dispatch-owned watch, occupancy with recovery, confirmed stop, record-mediated hand-off | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ |

Legend: ✅ = passes · ❌ = fails · — = not reached (the alternative has no dispatch-owned watch or stop that appends parks). All constraints are `Negotiable: no`, so no accepted-risk exception is claimed and any ❌ is disqualifying.

### Alternative 0 — Do Nothing: Keep the Daemon-Absent Degradation

- **Eligibility:** Not eligible (fails C-1, C-4, and C-7).
- **Summary:** Leave the run path without a watch. The current-truth statement stands: no resident daemon, no window watcher, no mid-flight park.
- **Constraint compliance:** Passes C-2, C-5, and C-9, because nothing is added and the mode keeps its truthful value. C-3, C-6, and C-8 are not reached. Fails C-1: a lane is unwatched whenever no daemon runs. Fails C-4: exposure inside a window is not bounded by any cadence. Fails C-7: there is no operator stop, and stopping out of band leaves no park record, no classification, and no grace.
- **Driver fit:** Serves drivers 2 and 7 only.
- **Pros:** Zero change, and no new surface.
- **Cons:** The incident reproduces on every lane dispatched across a window on a host without a daemon, and the owner's rule stays a hand-applied operator discipline.
- **Why rejected:** It is the gap under decision.

### Alternative 1 — Daemon-Only: Require a Resident Daemon for Pausing

- **Eligibility:** Not eligible (fails C-1, C-4, and C-7).
- **Summary:** Keep the watch a daemon supervision act and require the operator to run a resident daemon; the daemon watches dispatch-started lanes too.
- **Constraint compliance:** C-1 fails: enforcement depends on a second process happening to run, and no production composition mounts the daemon's watch either. C-4 fails: the daemon's watch enumerates in-flight daemon lanes (`daemon-supervision.ts:184-193`) and observes on its own cycle, so it bounds nothing for a dispatch lane by the run path's cadence. C-7 fails: the operator stop still has to reach a lane another process owns, and the daemon is not an operator command. Passes C-2, C-3, C-5, and C-9.
- **Driver fit:** Serves driver 1; fails drivers 3 and 5.
- **Pros:** One composition owns pausing, and the dispatch run path stays as delivered.
- **Cons:** A declared rule is enforced only where a second process happens to run, which is the ownership gap itself. It also pulls resident-mode work (NG-4) into a change that defers it.
- **Why rejected:** It leaves the lane the operator started unwatched by the code that starts it.

### Alternative 2 — Dispatch-Owned Watch Reading Provider-Entry `peak` Windows

- **Eligibility:** Not eligible (fails C-3).
- **Summary:** The run path watches, but reads the provider entries' `peak` windows, which are the only windows the product ships and the shape of the incident's window.
- **Constraint compliance:** Passes C-1, C-2, and C-4 to C-9. Fails C-3: a provider entry's `peak` window is the rule that makes a provider unavailable and its profiles ineligible at admission; it is not the lane-watch rule data.
- **Driver fit:** Serves driver 7 on a fresh install, which declares no profile rule data. It fails the ticket's rule ("the same rules" the daemon's watch reads) and driver 4, because two compositions would then read two different rule sources for one pause.
- **Pros:** A lane would pause on a host that declares no `peakWindows`.
- **Cons:** It merges the two rule sources into one gate with two behaviours. A provider-entry window carries one buffer and no grace, while the bounded-grace stop is derived from the profile's declared grace and buffer bound. A lane's seats can resolve to a provider outside the profile's declared list, so "any provider the seats resolve to" would need a per-seat rule the profile never declared.
- **Why rejected:** It fails the rule-source constraint. The precondition it tries to remove is declared instead (D3): only a profile that declares `peakWindows` is pausable.

### Alternative 3 — Dispatch-Owned Watch with a Control Channel for the Operator Stop

- **Eligibility:** Not eligible (fails C-8, and C-2 where the channel carries a signal).
- **Summary:** `dispatch stop` reaches the owning invocation through a socket, a pipe, or a process signal instead of a record.
- **Constraint compliance:** Passes C-1, C-3 to C-7, and C-9. Fails C-8: the hand-off is durable state alone, with no socket, token, or cross-process signal path. Fails C-2 where the channel delivers a signal itself, which is a second kill path.
- **Driver fit:** A faster hand-off than a record re-read. It fails driver 2 (a second surface beside the delivered records) and driver 7 (one more surface to authenticate, version, and supervise).
- **Pros:** The invocation learns of the stop immediately, and no classification needs to be withheld.
- **Cons:** A new cross-process surface to a session's lifetime, which the change's security review closes. The same result is reachable through records the invocation already reads.
- **Why rejected:** It fails the hand-off constraint. The orphaned-park problem is answered inside the record-mediated design (D7), not by leaving it.

### Alternative 4 — `dispatch stop` over the Delivered Cause Set

- **Eligibility:** Not eligible (fails C-2, C-5, and C-7).
- **Summary:** Admit every delivered park cause, each writing the complete frame and resuming at its declared end.
- **Constraint compliance:** Passes C-1, C-3, C-4, C-6, C-8, and C-9. Fails C-2: a cause the projection cannot frame needs a new kind, a projection change, or a second resume path, because `stop`, `parked`, and `resumed` are emitted only over `peak-window`. Fails C-5: exactly-once frames cannot be promised for a cause that projects none. Fails C-7: one cause only.
- **Driver fit:** Looks general. It fails driver 2 and driver 4 by promising an episode the delivered machinery cannot frame.
- **Pros:** One command for every park shape an operator may want.
- **Cons:** `owner-hold` is a read-time gate with one writer and no expiry, and `liveness-stall` is battery-written only; each would need its own frame and its own resume path.
- **Why rejected:** The cause set is widened only when the framing for a cause exists (deferred, GH-413 spec §7.3).

### Alternative 5 — The Stop Command Writes Its Park before the Terminate

- **Eligibility:** Not eligible (fails C-5 and C-7).
- **Summary:** Close the ordering problem from the command's side: append the park first, then terminate, so the park is durable before the owning invocation's collection can resolve.
- **Constraint compliance:** Passes C-1 to C-4, C-6, C-8, and C-9: a park written first is on disk when the session ends, so nothing is orphaned, and the already-parked refusal still guards it. Fails C-5: the complete frame carries the preservation classification, which only the stop's outcome supplies, so a park written first is either an incomplete frame or a claim about a stop that has not happened. Fails C-7: a terminate that then matches no live session leaves a phantom park, which is the outcome the command exists to refuse.
- **Driver fit:** Serves driver 3 and fails driver 4, because the record would precede the event it records.
- **Pros:** No withheld classification, so an ordinary result is not delayed.
- **Cons:** A recorded stop that never happened, or a second park record to complete the first. A failed terminate cannot be un-written in an append-only ledger.
- **Why rejected:** Confirmed termination is what separates a real stop from a phantom episode. The ordering is closed from the invocation's side instead, where the truth is already known.

### Alternative 6 — An Expiry-Aware Already-Parked Rule, with No Recovery

- **Eligibility:** Not eligible (fails C-6).
- **Summary:** Supply the watch with the delivered reference pattern for `parkedRefs`: a ref counts as parked only while its park's `until` lies in the future, and let an expired park expire by read time.
- **Constraint compliance:** Passes C-1 to C-5 and C-7 to C-9. Fails C-6: three outcomes the specification defines leave an expired park standing for a lane that later runs again. At the next open window the watch returns a stop decision and appends a second `parked` record, after which every park read fails closed for good. The other reading, never parking a ref that has any park record, skips the lane at every later window instead.
- **Driver fit:** Serves driver 7, because the pattern is already written. It fails driver 4 (a lane the surfaces call broken, or call parked when it is running) and driver 1.
- **Pros:** No mutating call on the run path, and no new caller of the park pass.
- **Cons:** On the reference host the first orphaned park, followed by the operator resume the specification prescribes, leads at the next daily window either to a permanent failure of every park-reading surface in the store or to a lane that is never paused again.
- **Why rejected:** A rule that is right for a supervised population is wrong for a lane that resumes through another path. Occupancy is safe only together with recovery.

### Alternative 7 — Selected: Dispatch-Owned Watch, Occupancy with Recovery, Confirmed Stop, Record-Mediated Hand-off

- **Eligibility:** Eligible (passes C-1 to C-9).
- **Summary:** The run path composes the delivered decision functions for the lane it started, at every observation from its first session. The nominated profile's `peakWindows` rules, read from the stored nomination, decide, and the park ends where the delivered decision says. An expired standing park is recovered through the delivered park pass before any new episode, a resume while the park has not expired is refused before any session starts, and occupancy keeps a reference from carrying two parks. An open window issues one bounded-grace stop through the delivered terminate path and lands one exactly-once park. The invocation waits on the delivered cadence and resumes by the preservation classification. The `lanes` mode states what the composition's own configuration supplies. `dispatch stop` admits `peak-window` only, refuses a lane that is not running or is already parked, writes its park only after a confirmed terminate, and hands the stop to the owning invocation through the durable records, which withholds classification for at least the applied grace plus one cadence to receive it.
- **Constraint compliance:** C-1 by the watch living in the run path; C-2 by composing the delivered layer and claiming only what it returns; C-3 by reading the profile's `peakWindows` and nothing else; C-4 by a one-cadence bound from the first session and a declared residual before it; C-5 by one terminate call and exactly-once frames; C-6 by occupancy plus the delivered recovery pass before any new episode; C-7 by one cause, a grammar refusal, a running predicate that excludes an open park of any cause, and a park written only after a confirmed terminate; C-8 by the record as the only channel and a withhold of at least the grace plus one cadence; C-9 by a two-value configuration-derived mode and one declared escape.
- **Driver fit:** Best on all eight drivers.
- **Pros:** The declared rule is enforced without a second process. One decision contract serves two compositions. The operator can request the same stop, is refused by name when it does not apply, and can never park a lane twice. A lane that resumes after an orphaned or refused park is paused again at its next window.
- **Cons:** The stop seam gets its first production mount, and the run path becomes a caller of a mutating park pass. An invocation can stay in flight for hours, and every result returns at least the applied grace plus one cadence later than today. The already-open-at-start case keeps a declared exposure.
- **Why chosen:** It is the only alternative that satisfies every constraint, and it adds no machinery the repository does not already own.

## Decision

- **Decision:** Adopt **ALT-7**.

### D1: The supersession and the replacement truth (DEC-1)

The statement "without a resident daemon there is no window watcher and no mid-flight park" is superseded for lanes started by `dispatch`. It is a supersession of a published statement, not of a decision record. The replacement truth:

> **A lane is watched by the composition that owns it.** The resident daemon watches the lanes it supervises. The one-shot dispatch run path watches the lane it started, at every observation from its first session to its terminal classification, over the same nominated profile's rule data, the same injected clock, and the same decisions. A composition that supplies no watch degrades to the delivered iteration-start gating and declares it through the composition-fact read.

Three consequences are part of the decision:

- **The composition fact changes meaning.** It is "does this composition's own effective configuration supply a profile-window watch", not "is a daemon running". Daemon reachability says nothing about whether a watcher exists.
- **The daemon is untouched.** Its supervision cycle, watch, park, and resume stay as delivered (NG-1). Where the daemon composition supplies the watch, it remains the watcher of its supervised lanes exactly as today; this record does not mount it there.
- **The statement is reconciled, not erased.** The system-spec-update phase carries the replacement truth into the pages that restate the old statement, starting with the peak-pausing page's daemon-absent section.

Because no production composition mounts the watcher today, this is the delivered decision layer's first production mount. Its mechanisms are proven by fixtures. The first real stop, park, and resume on a real session are observed by the reference host on the lane after the upgrade, which is a recorded hand-off and not a merge gate.

### D2: Reuse, never parallel (DEC-3)

The reused contract, by record:

- **TDR-0028:** the nomination is the join key. A lane with no stored nomination is not window-pausable, a resume never re-nominates, and the absence is never fabricated.
- **TDR-0029:** `stop`, `parked`, `resumed`, and `park-edge` carry their declared payloads under taxonomy v2. No kind, payload field, or version moves; GH-413 adds producers, not kinds.
- **TDR-0030:** a park is never refused for a preservation failure and never extends the grace. It carries the closed classification `preserved` or `session-state-not-preserved` and resumes by it: through the preserved session resume path, or through the delivered interrupted-lane recovery under the restart budget with its typed-question escalation.

The dispatch-owned watch is the same decision functions, composed unchanged, over the same clock. A dispatch-owned stop writes the complete episode frame, and the release grammar's operator-shaped record keeps its minimal frame and its `park-edge`-only projection. There is no second kill path: the stop is the delivered terminate operation with one composed grace.

Two statements of coherence with other decisions:

- **TDR-0052's terminal rules are not amended.** They are not consulted while an open park record for the lane stands: an episode is neither a clean exit nor a stall, and the invocation enters the wait and resume path before any classification.
- **The record claims only what the layer returns.** Where the specification or an operator expects a behaviour the delivered decision functions do not have, it is declared (D5, D6), not promised.

### D3: The rule source and the deployment precondition (DEC-12)

- **Rule data.** The lane-watch rule data is the nominated profile's `peakWindows` branch, as the daemon's watch reads it. It is taken from the nomination stored on the durable lane record, the additive optional member the specification's DEC-16 adds to every `active` record of the lane record TDR-0049 defines.
- **The boundary holds both ways.** Provider-entry `peak` windows gate admission only, and a profile's `peakWindows` never gate admission.
- **Deployment precondition.** Only a profile that declares `peakWindows` is pausable, and the shipped defaults declare none: the `provider.profiles` branch ships empty, and the only window the product ships is a provider-entry one. A host whose nominated profile declares no branch gets no pausing. A cost target measured over that population is reported as not yet measured, never as met.
- **Reference-host fact.** The tracked `.jaiship/config.yaml` declares profile `delivery` with `peakWindows` at 01:00-04:00 and 06:00-10:00 UTC. A lane nominated to that profile is pausable there, and the incident's window is covered.
- **No exemption by chain position.** A preference chain whose first entry declares no windows does not exempt a lane nominated to a later profile that declares them.
- **No fabrication.** A lane whose record carries no nomination, including a pre-change lane resuming on a classified absence, is not window-pausable.

### D4: The composition-fact read (DEC-6)

- **Mode input.** The reading composition's own effective configuration, resolved from `lane.disable-peak-pausing` (DEC-2). Unset or `false` composes the watch and reports `window-watch`. `true` composes no watch and reports `iteration-start-gating`. A composition that composes no watch reports `iteration-start-gating`.
- **Never derived from** another process's state, from daemon reachability, or from the test-only `peakWatchComposed` override.
- **Two values.** No third mode value exists. `parkClaimed` stays derived from durable park records whatever the mode.
- **The one intended value change.** On a production composition with pausing enabled and no park open, `lanes --json` moves `peakEnforcement.mode` from `iteration-start-gating` to `window-watch`. Every other member and every human line is byte-identical. With pausing disabled the value is the delivered one.
- **What the mode does not say.** `window-watch` states that the watch is composed. It does not state that every lane is pausable: a lane nominated to a profile with no `peakWindows` is never stopped while the mode reads `window-watch`. The mode is a composition fact; pausability is a fact of the lane's nominated profile.

### D5: The park end and overlapping windows (contract clarification, DEC-20)

- **The park's `until` is the effective end of the first open window the delivered decision returns.** `peakWindowOpenAt` evaluates the nominated profile's windows in order and answers with the first open window's own end, buffers included (`daemon-peak-pause.ts:102-140`). The dispatch-owned watch composes that answer and re-derives nothing.
- **Overlapping windows produce consecutive episodes.** Where two of the nominated profile's windows overlap in effect, the lane may resume at the first window's end and be parked again at the next observation into the second. Each is a separate, exactly-once episode with its own complete frame. Windows are never merged into one park, and this record claims no union of them.
- **Resume admission keeps the lane safe across the boundary.** It re-evaluates the same rules and never resumes a lane into an observed open window, so a rule that changed during the episode defers the resume and never advances it.
- **The reference host exercises this daily.** With their declared buffers the two windows are open, in effect, from 00:30 to 04:05 UTC and from 04:00 to 10:10 UTC. A lane parked by the first window resumes at 04:05 UTC and is parked again within one cadence until 10:10 UTC: two episodes and a short resume, where one long park might be expected (RSK-13).
- **Changing it is another decision.** Unioning overlapping windows would amend the delivered decision layer, which the change holds outside every scope, and needs its own record.

### D6: What this record does not decide: a window already open at dispatch start (DEC-14, withdrawn)

- **The case is out of scope, with a declared residual.** Profile `peakWindows` do not gate admission, so a dispatch admitted inside its nominated profile's window spawns as delivered. The watch parks the lane at its first observation. At most one observation cadence (`lane.liveness-interval`, 30 000 ms default) plus the applied grace (bounded by `coordinator.kill-grace`, 20 000 ms default) of billing precedes the park, because calls already in flight complete during the stop grace, and no billable call follows the park instant. The exposure target is stated in those terms (RSK-12).
- **The pre-session park is withdrawn and is not a mechanism of this record.** Version 1.1 of the specification proposed parking such a lane before its first session, with a `preserved` park record and no stop frame. The delivered layer cannot express that honestly: closing the record would emit a `resumed` frame for a session that never existed, leaving it open would park a lane for its whole life, the resume half would never start a first session, and no lane record would exist for `dispatch status` to report. A representation the delivered layer cannot express is worse than a declared, measured exposure.
- **No record carries DEC-14.** A future decision may close the case; it would need a representation for a park with no session and would reopen this record's revisit trigger for it.

### D7: `dispatch stop`: one cause, a real or refused stop, and the record as the hand-off channel (DEC-15, with DEC-7, DEC-8, and DEC-21)

1. **Cause set.** `peak-window` only, with `--until` required as the delivered expiry-carrying cause requires it. The set is narrow because the delivered projection emits `stop`, `parked`, and `resumed` only over `peak-window` parks with a complete frame and the delivered resume decision reads only `peak-window` parks. Another cause would promise an episode the delivered machinery cannot frame or resume without a new kind, a projection change, and a second resume path.
2. **Grammar refusals (DEC-21).** Another cause, or a missing end, is `input.value.rejected` at the grammar boundary, before any read of a lane. That is the dispatch family's own delivered identity for malformed grammar. The missing end carries the delivered `until-required` reason; the release grammar emits the same reason under its own invocation refusal, and only the reason is reused. No identity, error-table row, or reason token is added.
3. **Running predicate.** A stop request resolves the newest lane record for the work item in the resolved repository. Running means that record is `active`, carries a session identity, and has no open park of any cause standing for the ref. The delivered duplicate invariant counts every cause, so an open park of any cause makes the lane unparkable by this command.
4. **An already-parked lane is refused, never parked twice.** The park is not a lane state, so a parked lane's newest record still looks active. The already-parked case is the delivered unmet-precondition refusal (DEC-8), and its bounded summary names the observed parked state. A second stop therefore never appends a second park for one ref. If it did, the delivered duplicate invariant would fail every park-reading surface closed, and it would stay failed: the append-only history cannot be repaired (D8).
5. **Resolved from the record.** The command reads the stored nomination, the session identity, and the tree root to match from the lane record. The tree root is the recorded worktree path when the record carries one and otherwise the resolved repository's main checkout, which is the in-checkout shape.
6. **It never signals itself.** The command sends no signal of its own. Exactly one terminate call goes through the delivered terminate path with the same composed grace a window-open stop applies (DEC-5): TERM before KILL, KILL only over a still-listed target. The terminate operation's own idempotence on an unknown session stays its contract; it is not this command's licence to record an episode.
7. **A confirmed terminate authorises the park.** The command writes the complete watcher-shaped episode frame, exactly one `stop` and one `parked` with the same payloads as a window-open stop, only after a confirmed terminate. A terminate that matches no live exact identity is the not-running refusal and writes nothing. Confirmed termination is what separates a real stop from a phantom episode.
8. **Success contract.** The command answers only after the confirmed terminate and the park append: one human line naming the work item, the cause, the park end, and the episode id; machine data carrying the work item, the cause, the park end, the episode id, and the preservation classification; exit `0`.
9. **The record is the hand-off channel.** The session belongs to another process, and the durable lane and park records are already shared and already read by the owning invocation. No socket, token, or cross-process signal path exists. The owning invocation remains the resume owner.
10. **At least the applied grace plus one observation cadence is withheld, so the park is not orphaned.** The command's park is written only after its terminate call returns, and that call awaits the whole applied grace; the owning invocation's collection resolves as soon as the session exits. A withhold of one cadence alone therefore misses the park whenever the applied grace is at or above the cadence. The invocation withholds terminal classification for at least the applied grace plus one observation cadence after its collection resolves and re-reads the park record for its ref. An open `peak-window` park places it in the wait and resume path, where it keeps renewing the lease. With no park in that interval it classifies exactly as delivered. The withhold is sized against the grace, so it holds on every configuration of `coordinator.kill-grace` and `lane.liveness-interval`.
11. **The cost is stated.** The withhold is the run path's own post-collection rule, so it applies to every session end, with or without a stop command and whether or not automatic pausing is enabled. At the defaults it is about 50 s: a 20 000 ms applied grace plus a 30 000 ms observation cadence, added before the result of every dispatch.
12. **One outcome per request.** A request that races a session end resolves exactly one classified outcome: the confirmed terminate with one `stop` and one `parked`, or the not-running refusal. Never a partial episode, a duplicate park, or a write from the losing side.
13. **Independent of the setting.** The command is available and identical whether or not automatic pausing is enabled (DEC-10). The setting governs the policy the system applies by itself, not an operator's explicit request.

### D8: A reference never carries two parks: occupancy with recovery, and a pre-session refusal for an un-expired park (DEC-23, DEC-22)

- **Why the watch needs the rule.** Three outcomes the specification defines leave an expired `parked` record standing for a lane that later runs again: an orphaned park followed by the operator resume (RSK-3), the refusal return of DEC-18, and restart-budget exhaustion followed by a later dispatch. The watch appends a park for every stop it decides, and an expiry-aware guard lets the next open window append a second one.
- **A double park is permanent.** Two active parks for one reference fail every park-reading surface through the delivered duplicate invariant, and the append-only history cannot repair it. The surfaces do not recover when the window ends.
- **The already-parked rule is occupancy (DEC-23).** Any standing `peak-window` park for the reference, whatever its `until`, suppresses a new stop. A lane is parked at most once per standing park.
- **An un-expired standing park is a pre-session refusal (DEC-22).** A resume or re-dispatch of a lane whose standing park has not expired is refused at the admission of the resume, beside the other admission refusals and before any session is spawned. The refusal is the delivered `queue.precondition.unmet` row (category user, projection `user-validation`, exit 1), whose remediation already names an active park, with the park's cause and `until` in its bounded summary (`packages/core/src/contracts/error-table.ts:1429-1437`). It writes nothing: no session, no park, no event. `lanes` and `board` keep showing the lane parked. No operator override of a recorded park exists: a park the system recorded and has not yet ended is not an operator decision to override.
- **An expired standing park is recovered before a new episode (DEC-23).** Before its first stop decision for a reference, and at the first observation of an invocation that resumes the lane, the run path closes an expired standing park through the delivered mutating park pass, `recoverQueueParks`: the clear-observed marker, the recovered record, and the `park-auto-recovery` incident. An expired, orphaned, refused, or budget-exhausted park is closed before a new episode, and the recovery's evidence precedes the new stop. The pass therefore only ever meets an expired park or none. The delivered evaluation makes a park resumable only once its `until` has passed (`packages/core/src/domain/queue-park.ts:182-197`), so a pass that met an un-expired park would recover nothing and the lane would run on under occupancy, shown as parked while it bills. The refusal is what keeps the pass honest.
- **An unrecoverable park refuses the run, and never abandons a live session.** An expired park that the pass cannot recover refuses the run as a classified failure, which starts no new episode rather than parking twice. When that failure is observed after the resume's session has already started, the invocation issues one terminate through the delivered path for the session it started, writes no park, and returns the classified refusal; it never abandons a live session (GH-413 spec F-3).
- **Three consequences of reusing the delivered pass** (GH-413 spec §8.2, RSK-14, §22):
  - **A closed preserved park leaves a `resumed` frame in the ledger.** Closing a `preserved` standing park through the pass projects one `dispatch.attempt/resumed` frame with an empty `sessionRef` and `branch` under the original episode id, whether or not a session resumed. The delivered projection frames every recovered `preserved` record that way, and the pass writes no session reference. No kind and no frame of this change's own is added, and the frame is read as the park's closure.
  - **The pass is repository-wide.** It evaluates every latest park in the store, so a dispatch lane also closes every other reference's resumable latest park in that repository, as a queue mutation does.
  - **A refused second append is stuck for good.** The pass appends the clear-observed marker first and the recovered record second. If the second append is refused, the marker stands, the pass reports the reference as stuck, and it never retries; with occupancy that reference is then suppressed at every later window. The operator route is the delivered park surfaces together with the delivered operator resume path. No new unpark command exists.
- **What is reused, and what is new.** The pass, the marker, the recovered record, and the incident are delivered. The dispatch run path becomes the second caller family of a pass that today only the queue command family's mutations call. The pass mutates nothing under an active owner hold, as delivered, and an active hold refuses the run at admission in any case.
- **What stays out of scope.** Automatic recovery of an episode whose dispatch process was killed during the wait stays out of scope until the lane runs again: the park record stands, and the next invocation, or an operator resume after the park has ended, recovers it before any new episode.

### D9: The boundaries that do not move

- **The daemon** keeps its supervision cycle, watch, park, and resume (NG-1). Parallel-lane and resident-mode work stay deferred (NG-2, NG-4).
- **Admission** keeps its gating and the nomination rule: the four no-nomination refusal identities and the provider-entry window gate are as delivered (NG-8).
- **The shell fallback** composes no watch, keeps its delivered behaviour, and reports `iteration-start-gating`.
- **The published lane-view derivation** is unchanged (DEC-9): `stale` is true exactly when the owner probe is `dead`, and `delivering` is its negation, for a parked lane as for any other. The additive park fact explains the pause or the orphaned park.
- **The one-invocation, one-result contract** is unchanged (DEC-4): the invocation returns exactly one result for the work item, with the token and exit the same truth would produce without an episode, and no episode invents a token.
- **The decision layer** keeps its first-match evaluation (D5), **the park pass** keeps its delivered shape (D8), and **the window rule data** gains no declaration mechanism, no rule field, and no read surface for a window as an object (NG-7).
- **No park is written before a first session exists** (NG-10, D6).

**Authority and acceptance:** this is an R2 design record. Status is `Proposed` and `decision_date` is `null`. The human owner (Juliusz Ćwiąkalski) accepts or rejects it at the GH-413 pull request. AI assistance analysed and wrote the record; the AI does not accept it, and no independent `@decision-critic` pass was run for it. Until acceptance, the GH-413 specification may cite this record as the authority for the dispatch-owned watch, and the record itself must not be described as settled.

### Constraint Compliance Attestation

The chosen alternative satisfies C-1 to C-9: the watch lives in the run path that starts the lane and depends on no other process (C-1); it composes the delivered decision layer, adds no cause, kind, record, identity, token, mode value, or kill path, and claims only what the layer returns (C-2); it reads the nominated profile's `peakWindows` and leaves provider-entry windows admission-only (C-3); enforcement is bounded by one observation cadence from the first session, and the one earlier exposure is declared rather than promised (C-4); a stop is one terminate call and every episode, including a consecutive one, is exactly-once (C-5); occupancy plus the delivered recovery pass keeps a reference from carrying two parks, and an unrecoverable park refuses the run (C-6); `dispatch stop` admits one cause, refuses disallowed grammar by name, treats an already-parked lane as not running, and writes a park only after a confirmed terminate (C-7); the record is the only hand-off channel and the invocation withholds classification for at least the applied grace plus one observation cadence, so the park is not orphaned on any configuration (C-8); and the mode is a two-value configuration-derived fact with one declared value change and one declared escape (C-9). No accepted-risk exceptions are taken. One clause rests on an assumption rather than on delivered proof and is named above rather than waved through: the cross-process reach of the terminate path.

## Trade-offs & Consequences

### Positive Outcomes

- A declared window is enforced for the lane the operator started, with no second process to remember to run, and the pause is the delivered episode: one stop, one park, one resume, one audit trail.
- From the lane's first observation a window that opens costs at most one cadence of billable work, where the delivered path billed through the whole window.
- One decision contract serves two compositions, and the parity fixture keeps them equal; there is no second rule engine to drift.
- An operator can request the same bounded-grace stop, is refused by name when the lane is not running or already parked, and can never produce a stop that did not happen or a second park for one lane.
- A lane that runs again after an orphaned, refused, or exhausted park is closed out and paused again at its next window. No path can leave a reference carrying two active parks. The one residual is a refused second append of the pass, which leaves a stuck marker for the operator route (D8).
- An operator can return to the delivered behaviour with one declared key, and the `lanes` read says which enforcement is composed.

### Negative Outcomes

- **A first production mount, and a new caller of a mutating pass.** The stop seam and the decision layer have been proven by fixtures only; the first real signal for a peak stop is this change's. The run path now writes park recovery records that only the queue command family wrote before.
- **Every dispatch returns later.** The withhold is at least the applied grace plus one observation cadence, about 50 s at the defaults, on every session end and whether or not pausing is enabled.
- **A declared admission residual.** A dispatch admitted inside an already-open window bills for one observation cadence plus the applied grace, about 50 s at the defaults, before its first park (RSK-12). An unexpected peak charge is read against that bound before anything else is suspected.
- **An unrecoverable park stops the lane.** A standing park that the pass cannot recover refuses the run as a classified failure, and nothing runs for that reference until the park is cleared. That is the price of never parking twice.
- **Long-running invocations become normal.** A dispatch may stay in flight for the length of a window and be silent while it waits. On the reference host a lane nominated to the profile that is running at 00:30 UTC is parked until 04:05 UTC and again until 10:10 UTC, as two consecutive episodes, so a dispatch started before 00:30 UTC can return nearly ten hours later.
- **Overlap churn.** Where a profile's windows overlap in effect, a lane resumes and is parked again within one cadence: two episodes and a short resume, where one park might be expected (RSK-13).
- **The mode value changes for every reader.** A consumer that pinned `iteration-start-gating` on a production composition with pausing enabled sees `window-watch` with no park open (RSK-11).
- **`window-watch` can overstate pausability.** On a host whose nominated profile declares no `peakWindows` the mode reads `window-watch` and no lane is ever stopped.
- **An orphaned park is possible.** A killed waiting invocation leaves the park standing with `stale: true`, and only the delivered operator resume path or a later dispatch recovers it; automatic recovery while nothing runs is out of scope.
- **An operator precondition stands.** Activity-keyed stall detection (`pm-liveness`, `deliver-ticket`, `ceo-loop`) kills a waiting invocation unless it is relaxed for a parked lane (DEC-19).
- **The operator stop is proven over doubles.** The cross-process signal on a real host is not proven by the parity battery.
- **Two compositions must stay one contract.** The dispatch-owned watch and the daemon's watch evolve together or diverge (RSK-8).

### Unresolved Questions

- [ ] Cross-process reach. Confirm on the reference host that a separately invoked `dispatch stop` signals the owning invocation's session through the terminate path with a record-resolved handle, and that a session which is gone yields the not-running refusal rather than a recorded stop. (owner: `@coder`, the plan's operator-command phase; observed by the reference-host hand-off TC-PEAK-029)
- [ ] The daemon mount. No production composition mounts the daemon's watch either. Whether the resident-daemon composition mounts it is resident-daemon production scope and is not decided here. (owner: `@pm`; GH-238, GH-395)
- [ ] Stall detection. Whether the product should exempt a parked lane from activity-keyed stall detection itself, instead of leaving it an operator precondition. (owner: `@pm`)

## Implementation Plan

1. **Setting and declaration.** The disabling key is declared in the typed lane policy branch, validated, and resolved for each admitted change. The change's changeset exists before any gate run.
2. **Stored nomination.** The lane record gains its additive optional nomination, carried on every `active` record the invocation appends and never fabricated.
3. **Occupancy, the pre-session refusal, and recovery.** The watch's already-parked rule reads any standing `peak-window` park for the reference. Resume admission refuses a lane whose standing park has not expired with the delivered `queue.precondition.unmet` identity, before any session starts. Before its first stop decision, and at the first observation of a resuming invocation, the run path recovers an expired standing park through the delivered mutating park pass and refuses the run when the park cannot be recovered.
4. **Watch, stop, park, wait, and resume.** The run path composes the delivered decision functions, issues one terminate call with the composed grace, lands the exactly-once park, waits on the delivered cadence, and resumes by the preservation classification, returning one classified result when a recovery refuses without being terminal.
5. **Surfaces and the mode.** `dispatch status` gains the additive park fact, the mode derives from the production composition's effective configuration, and one invocation returns one result with a bounded episode fact. Everything outside the one mode value stays byte-identical.
6. **Operator command.** `dispatch stop` joins the dispatch family with its grammar and its grammar refusals, the running predicate that excludes an open park of any cause, the record-resolved tree root, the confirmed-terminate rule before any park write, the complete episode frame, the success contract, help, and a reference page.
7. **The withheld classification.** After collection resolves the invocation withholds classification for at least the applied grace plus one observation cadence and re-reads the park record before it classifies.
8. **Cross-cutting proof.** Paired runs are byte-identical over the injected seams, the suites are hermetic, and every closed vocabulary is unchanged.
9. **Documentation.** The system-spec-update phase reconciles the eighteen pages the specification names. The release note states the behaviour change, the one intended value change, the disabling key, the deployment precondition, and the declared consequences: the result-latency cost of the withhold, the admission residual, and the overlap churn.
10. **After the merge.** The reference host observes one real episode on the next lane, with its preconditions recorded before the change is checked for Done.

## Verification Criteria

- Metric: billable model calls after the park instant while a declared window of the nominated profile is open. Target: 0. Window: the change's suites on every run; the reference-host population from the first lane after the upgrade.
- Metric: billing exposure of a dispatch admitted while the nominated profile's window is already open. Target: at most one observation cadence plus the applied grace, and no billable call after the park instant. Window: GH-413 CI.
- Metric: time withheld after a session end at the defaults. Target: at least 50 000 ms (the 20 000 ms applied grace plus the 30 000 ms observation cadence). Window: GH-413 CI.
- Metric: episodes with exactly one `stop`, one `parked`, and one `park-edge` (and one `resumed` where state was preserved), including consecutive episodes on overlapping windows. Target: 100%. Window: GH-413 CI.
- Metric: decision divergence between the dispatch-owned watch and the daemon's watch at the same profile and instant. Target: 0. Window: GH-413 CI.
- Metric: new members in any closed set (park causes, event kinds, record kinds, schema identities, error identities, reason tokens, result tokens, composition-fact modes). Target: 0. Window: GH-413 CI.
- Metric: terminate calls per stop, and signal paths beside the delivered terminate operation. Target: exactly 1, and 0. Window: GH-413 CI.
- Metric: references carrying more than one active park, after any sequence of runs, resumes, refusals, and stop requests. Target: 0. Window: GH-413 CI.
- Metric: runs that start a new episode while a standing park for the reference is unrecovered. Target: 0. Window: GH-413 CI.
- Metric: standing expired parks recovered before the first stop decision or the first observation of a resume. Target: 100%. Window: GH-413 CI.
- Metric: `dispatch stop` requests that write any record when the lane is not running, is already parked by a park of any cause, or the terminate is unconfirmed. Target: 0. Window: GH-413 CI.
- Metric: `peakEnforcement.mode` on the production composition with pausing enabled, and again disabled. Target: `window-watch`, then `iteration-start-gating`, never from the test-only override. Window: GH-413 CI.
- Metric: no-park fields and lines that differ from the pre-change output. Target: 1 (`peakEnforcement.mode`). Window: GH-413 CI.
- Metric: hand-offs in which a park lands within the withhold, with the kill grace at and above the observation cadence, and the owning invocation nevertheless classifies terminal. Target: 0. Window: GH-413 CI.

## Confidence Rating

**Medium.** Every mechanism element is delivered: the decision functions, the park record family, the mutating park pass and its incident, the preservation classification, the taxonomy v2 kinds, the terminate operation, and the lane record. The rules the decision reads are tracked configuration on the reference host, and the two ordering rules, occupancy with recovery and the grace-plus-cadence withhold, follow from executed facts about the delivered layer rather than from judgement. What lowers the confidence is that this is the first production mount of a stop seam and the first caller of the park pass outside the queue command family, and that one clause rests on an assumption with a named control rather than on proof: the terminate path reaching a session another process holds. The in-change fixtures gate the merge; the live behaviour is confirmed only by the reference-host episode, which is recorded as a hand-off and is designed so that a wrong assumption surfaces as a classified refusal rather than a silent success.

## References

- Change specification: `doc/changes/2026-11/2026-11-26--GH-413--peak-pausing-dispatch-lane/chg-GH-413-spec.md` (v1.3): §2 (the current state, the admission residual, and the gaps), §5.1 F-1 to F-12, §6 Flow 3 and the operator-resume flow, §7.2, §8.2, §8.3, §8.5, §9, §11, §12, §15 (DEC-1 to DEC-21, the withdrawn DEC-14, and the record scope), §16, §18 and §18.1, §21, §24 Appendices A to D.
- Change plan: `doc/changes/2026-11/2026-11-26--GH-413--peak-pausing-dispatch-lane/chg-GH-413-plan.yaml` and its binding fences.
- Definition-of-Ready reviews: `doc/changes/2026-11/2026-11-26--GH-413--peak-pausing-dispatch-lane/readiness-review/readiness-iter-1.md` (findings 1, 3, 4, 7), `readiness-iter-2.md` (findings 1, 2, 5, 9), and `readiness-iter-3.md` (findings 1 and 3).
- Ticket: GH-413, cited through the change specification's restatement of its acceptance criteria; the ticket body was not read for this record.
- Prior decisions: [TDR-0028](TDR-0028-no-nomination-classified-admission-refusal.md) (the nomination as the join key); [TDR-0029](TDR-0029-event-taxonomy-v2-peak-pause-kinds.md) (the episode kinds); [TDR-0030](TDR-0030-park-preservation-failure-classification.md) (the preservation classification and the classification-routed resume); [TDR-0049](TDR-0049-dispatch-owned-durable-lane-record.md) (the lane record); [TDR-0051](TDR-0051-harness-terminate-operation.md) (the terminate operation); [TDR-0052](TDR-0052-in-process-bounded-restart-loop.md) (the loop whose terminal rules an episode precedes).
- Companion record: [TDR-0078](TDR-0078-lease-heartbeat-amends-tdr-0050.md) (the lease heartbeat through the run and the park).
- Current truth: [Provider Peak Pausing](../spec/features/feature-peak-pausing.md); [Dispatch Engine](../spec/features/feature-dispatch-engine.md) (the run order, the lane record, the operator surface, the parity proof boundary); [Resident Dispatch Daemon](../spec/features/feature-resident-daemon.md); [Provider Profiles](../spec/features/feature-provider-profiles.md); [Event Taxonomy v2](../spec/features/feature-event-taxonomy.md).
- Code and contracts (read 2026-11-26): `packages/core/src/domain/daemon-peak-pause.ts`; `packages/core/src/app/daemon-supervision.ts`; `packages/core/src/app/dispatch.ts`; `packages/core/src/app/queue.ts`; `packages/core/src/domain/event-projection.ts`; `packages/core/src/domain/queue-park.ts`; `packages/core/src/contracts/dispatch.ts`; `packages/core/src/contracts/harness.ts`; `packages/core/src/contracts/queue.ts`; `packages/cli/src/edge.ts`; `packages/cli/src/commands/queue.ts`; `packages/adapters/src/harness/opencode.ts`; `.jaiship/config.yaml` (tracked).
