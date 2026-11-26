---
id: TDR-0078
decision_type: tdr
status: Proposed
created: 2026-11-26
decision_date: null
last_updated: 2026-11-26
summary: "GH-413 DEC-13: the dispatch lane keeps its repository lease live for the whole run and the whole park. The invocation that holds the lease renews it, at most once per renewal cadence and no more than once per wake, where the renewal cadence is `min(lane.liveness-interval, queue.lease-ttl / 2)` (30 000 ms at the defaults), through the delivered same-holder `renewed` operation over the existing `queue.lease` record, so its heartbeat age cannot reach the lease TTL (90 000 ms default) between renewals even when the liveness interval is configured at or above the TTL, and a second `dispatch` of the work item is refused `queue.single-flight` with the live holder before, at, and after every TTL boundary of an hours-long park. The bound is required because renewal on the liveness interval alone lets the heartbeat reach the TTL between wakes whenever that interval is at or above the TTL, and the stale lease is then admitted to a second dispatch. The renewal is a no-op unless the live lease's latest heartbeat is the invocation's own last write. Holder, reference, and lease identity all survive a re-dispatch, because the delivered `renewed` arm preserves them while appending a newer heartbeat, so the heartbeat write is the only ownership test that arm leaves intact; the key lives on the run-path renewal side, and the admission claim's stale same-holder `renewed` arm is unchanged. A no-op appends nothing, extends nothing, and surfaces the bounded evidence `lease:not-owned`; the invocation continues its current wait without claiming a live lease and re-checks at the next observation. An invocation that no longer holds the lease does not resume or continue as owner: it returns one classified result with the park standing and the observation, after which the operator resume path applies. The renewal never acquires an absent lease, takes over a stale one, or displaces another holder, does not pass the owner-hold gate (a parked lane under an active hold keeps renewing), and is not issued during a bounded tracker or claim wait. This amends TDR-0050 DC-3 for the dispatch run path only: the dispatch admission claim still never renews and still refuses a live same-ref lease under any holder, repository exclusivity, the TTL, the stale takeover, the sibling `queue claim` renewal, and the release primitive are unchanged (the run path does not release a lease it no longer owns), and no record kind, lease operation, claim result, schema, configuration key, or second exclusion mechanism is added. A renewal failure is retried at the next cadence and surfaced as bounded lease evidence; the park never silently continues on a stale lease."
owners: ["Juliusz Ćwiąkalski"]
service: "delivery-os dispatch engine and queue lease: the dispatch lane's lease heartbeat through the run and the park"
decision_scope: repo
review_date: null
business_impact: "The single-flight promise holds for the whole interval it names, on every legal configuration of two independent operator keys. A parked lane cannot be taken by a second dispatch while its owner renews, so the work item never acquires a second session because of an episode, and the same heartbeat closes the older exposure of a running lane whose lease went stale after 90 s. When an owner loses its lease, it stops instead of running beside its successor. The cost is one delivered lease record per renewal cadence per live lane."
customer_impact: "A second `dispatch` of a running or parked work item is refused `queue.single-flight` naming the live holder for as long as the owning invocation lives, and `lanes` shows the live `leaseHolder`. A lease whose heartbeat goes stale during a park again means exactly one thing: the owner is gone. An invocation that has lost its lease returns one classified result instead of resuming, so the lane waits for the operator resume path."
classification:
  domains: [contracts, concurrency, dispatch, operations]
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
  driver: "@decision-advisor (GH-413 DEC-13: the amendment the specification routes here after Definition-of-Ready iterations 1 to 3, findings 2, 3, and 2)"
  decider: "Juliusz Ćwiąkalski — human acceptance at the GH-413 pull-request review; AI does not accept this R2 record"
  contributors:
    - "@pm (GH-413 Definition-of-Ready remediation decisions: the lease heartbeat, with the takeover-exposure alternative rejected)"
    - "@spec-writer (GH-413 specification v1.3: F-5, F-11, DEC-11, DEC-13, DM-9, NFR-7, NFR-10, RSK-10, section 14, Appendix D)"
    - "@readiness-reviewer (GH-413 Definition-of-Ready iteration 1 finding 2, iteration 2 finding 3, and iteration 3 finding 2: the delivered rule does not provide the promise, the two keys are unrelated, and the lease identity does not survive a re-dispatch as an ownership test)"
    - "@plan-writer (GH-413 plan: the claim path in scope, and the binding fence that only who renews and how often is added)"
    - "@decision-advisor (repository analysis, the executed probe of the lease primitives, and this record)"
  reviewers:
    - "@reviewer"
    - "Human owner (GH-413 pull-request review: this record amends a delivered concurrency rule)"
  performers:
    - "@coder (the renewal entry with its ownership key, the run-path wiring at the derived cadence, the not-owned evidence and return, and the lease arms)"
    - "@test-plan-writer (the lease arms, the interval-above-TTL configuration, the owner-hold case, and the re-dispatch arm)"
    - "@doc-syncer (the dispatch-engine and scheduling-engine pages)"
  informed:
    - "Operators of native deliveries: a parked lane now holds its work item for as long as its invocation owns the lease"
    - "The daemon supervision claim owner: its claim keeps its delivered behaviour and is not amended"
    - "The parallel-lanes work (GH-412) and the resident-mode work (GH-395), which inherit this contract"
ai_assistance:
  used: true
  roles: [repository-analyst, analyst, option-generator, record-writer]
  external_data_shared: false
  citations_verified: true
  human_decider: null
  reviewers: []
revisit_triggers:
  - "The dispatch holder stops being a fixed constant (a per-invocation holder identity). The ownership key is re-decided, because the delivered renewal and release become ownership-safe by themselves and the key may retire."
  - "A stale lease that nobody took is decided to be, or not to be, the lane's own. The failure policy is restated with that decision."
  - "`lane.liveness-interval` and `queue.lease-ttl` become validated against each other, or either default moves. The renewal cadence bound is re-decided with it, never a second timing key by default."
  - "A second caller needs the same heartbeat (parallel lanes, GH-412; resident mode, GH-395). The renewal entry is generalized by a decision, not by copying the path."
  - "A live invocation is observed with a stale lease, a taken-over lease is observed renewed or released by its former holder, or two lease writes are observed sharing one heartbeat instant. The key and the failure policy are reopened with the incident."
  - "The renewal ledger growth is observed to matter, since every lease read takes the verified whole-store snapshot. The cadence or the record's representation is re-decided."
  - "The release primitive or the sibling `queue claim` is proposed to take the same ownership key. That is an amendment to this record and TDR-0050 together."
links:
  related_changes: ["GH-413"]
  supersedes: []
  superseded_by: []
  spec:
    - "doc/changes/2026-11/2026-11-26--GH-413--peak-pausing-dispatch-lane/chg-GH-413-spec.md"
    - "doc/spec/features/feature-dispatch-engine.md"
    - "doc/spec/features/feature-scheduling-engine.md"
    - "doc/spec/features/feature-peak-pausing.md"
  contracts:
    - "packages/core/src/contracts/queue.ts"
    - "packages/core/src/app/queue.ts"
    - "packages/core/src/app/dispatch.ts"
    - "packages/core/src/domain/queue-lease.ts"
    - "packages/core/src/config/defaults.ts"
    - "packages/cli/src/production.ts"
  diagrams: []
  decisions: ["TDR-0026", "TDR-0049", "TDR-0050", "TDR-0052", "TDR-0077"]
  experiments: []
  metrics: []
  roadmap_items: ["M4-S42"]
---

# TDR-0078: A Dispatch Lane Keeps Its Repository Lease Live Through the Run and the Park: The Holding Invocation Renews at a Derived Cadence (TDR-0050 DC-3 Amended)

> **Traceability.** Spec v1.3 §15 **DEC-13**; §5.1 F-5 and F-11; §6 Flow 5; §8.3 DM-9; §9 NFR-7 and NFR-10; §11 RSK-10; §12 "Lease renewal"; §14 (the three settled questions); §22 "A live lease during a park"; §24 Appendix D; §17 AC-F5-2 and AC-F11-1. Amends **TDR-0050 DC-3 and its restatement in C-4 for the dispatch run path only**. Companion of [TDR-0077](TDR-0077-dispatch-owned-window-watch.md), which is not part of this record.

## Context

- **FACT:** The lease record has a closed four-operation lifecycle, `acquired`, `renewed`, `released`, and `taken-over` (`packages/core/src/contracts/queue.ts:33`), and one shape carrying `leaseId`, `holder`, `ref`, `heartbeatAt`, and `ttlMs` (`:43-58`).
- **FACT:** The shipped lease TTL is 90 000 ms (`contracts/queue.ts:37`; `packages/core/src/config/defaults.ts:82`). The production claim passes no TTL and takes the default (`packages/cli/src/production.ts:4859-4866`; `packages/core/src/app/queue.ts:2355`). A lease is stale at or beyond the TTL, the bound inclusive (`packages/core/src/domain/queue-lease.ts:50-51`).
- **FACT:** The dispatch admission claim refuses a live same-ref lease under any holder and never renews. `claimDispatchLease` claims with the fixed holder `dispatch` and `noRenewal: true` (`app/queue.ts:2343-2381`); inside the fence that flag turns a live same-ref lease into `queue.single-flight` naming the holder (`:2176-2188`). On success it returns the `leaseId`, which the run path receives and does not retain (`packages/core/src/app/dispatch.ts:91, 811`).
- **FACT:** The same-holder renewal is delivered. Inside the fence, a lease recording the same ref under the same holder is renewed by a `renewed` record that preserves `acquiredAt` and `leaseId` and stamps the heartbeat of the moment it lands (`app/queue.ts:2021-2048, 2189-2211`). The dispatch admission claim never reaches that arm while the lease is live; against a stale same-holder lease it does, and that arm is unchanged by this record.
- **FACT:** The claim primitive does more than renew when it is called without the no-renewal flag. It refuses an active owner hold before the fence (`:2090-2098`). With no live lease for the repository it acquires one (`:2152-2171`). A stale lease under another holder is taken over with full evidence and a `lease-stale-takeover` incident (`:2217-2270`), and every delivered takeover test seeds another holder (`tests/behaviour/queue-lease-takeover.test.ts:21-60`).
- **FACT:** With the fixed `dispatch` holder the delivered arm is not ownership-safe, and the lease identity is not an ownership test. Executed on 2026-11-26 over the delivered primitives on a throwaway store: a second dispatch's admission claim against a stale same-ref lease already held by `dispatch` succeeds as `renewed`, with the first invocation's lease identity and acquisition instant preserved and a newer heartbeat appended; a heartbeat over the same-holder arm renews a stale lease; after that second claim the first invocation's heartbeat succeeds on the lease the second now holds; and the first invocation's release, which matches on holder only (`:2431`), then ends it. Holder, reference, and lease identity are preserved across all four. The heartbeat instant is the one field a successor's claim changes. No delivered test covers the same-holder stale arm.
- **FACT:** The run holds the lease from the claim to a release in `finally` (`app/dispatch.ts:811, 1618-1620`; `production.ts:4868-4876`), and nothing on the path renews. Current truth states the rule: "The dispatch claim uses the fixed holder `dispatch` and never renews" and "because both claim with a fixed holder and never renew mid-flight" (`doc/spec/features/feature-dispatch-engine.md`, the one-shot dispatch run order and the per-ref single-flight admission section). TDR-0050 DC-3 and C-4 state it as a decision.
- **FACT:** The liveness cadence and the lease TTL are two independent operator keys. `lane.liveness-interval` defaults to 30 000 ms and `queue.lease-ttl` to 90 000 ms (`config/defaults.ts:78, 82`). Both are validated as positive integers, and nothing relates one to the other (`packages/core/src/config/catalog.ts:693-695, 857-859`). The reference host's tracked configuration sets neither. The delivered renewal-cadence derivation is one third of the TTL, never a key (`domain/queue-lease.ts:54-55`).
- **FACT:** Each lease write appends one record, and each lease read takes the delivered verified whole-store snapshot (`app/queue.ts:686-690, 710-711, 1998-2019`).
- **FACT:** A park outlasts the TTL many times. On the reference host a lane nominated to the tracked profile is paused, as two consecutive episodes, from 00:30 to 04:05 UTC and from 04:00 to 10:10 UTC (`.jaiship/config.yaml`, tracked; GH-413 spec RSK-13): about 9 h 40 min inside one invocation.
- **FACT:** TDR-0050 is itself `Proposed` with a null decision date on this branch. Its rule is nevertheless the delivered behaviour and the current truth, which is what this record amends.
- **Why now:** A dispatch lane that parks for hours outlives its lease many times over, and with the delivered rule the admission verdict treats the stale lease as takeable. GH-413's third goal forbids a second session for the work item, and its DEC-13 routes the amendment here. The Definition-of-Ready reviews found the problem in three steps: the rule does not provide the promise (iteration 1, finding 2); a heartbeat tied to the liveness interval alone fails whenever that interval is at or above the TTL (iteration 2, finding 3); and a key on the lease identity does not survive the delivered arm (iteration 3, finding 2).

## Problem Framing (Clarified)

The question is not "should the lease last longer" but **who may keep a repository lease live on the dispatch path, on which cadence, by which act, and what must stay true while they do.**

Five sub-questions decide the mechanism:

1. **Which rule is in the way, and why is it there?** TDR-0050 DC-3 forbids renewal on the dispatch path for one reason: in a dispatched race the holder is always `dispatch`, so a claim that renews lets the second invocation in. The rule protects *admission*. An invocation renewing, after admission, the lease it already holds is a different act: it admits nothing and starts nothing.
2. **On which cadence?** The dispatch run observes on `lane.liveness-interval`; the lease goes stale on `queue.lease-ttl`. Tying the heartbeat to the liveness interval alone makes the promise true only where the two keys happen to be ordered as the defaults order them.
3. **What identifies the invocation's own lease?** Not the holder, which is a constant. Not the reference, which a re-dispatch shares. And not the lease identity, which the delivered `renewed` arm preserves while it appends a newer heartbeat.
4. **What must the renewal preserve?** The verdict decided inside the claim; the refusal of a live same-ref lease under any holder; one live lease per repository; the TTL; the stale takeover; the sibling `queue claim`'s own renewal; and a parked lane's insulation from an owner hold, which has no declared end.
5. **What happens when ownership is lost?** A renewal outage longer than the TTL lets a re-dispatch in. The earlier invocation must then neither keep the lease alive for its successor nor resume a session beside it.

Root cause versus symptom. The symptom is a second dispatch admitted a TTL into a park. The cause: lease liveness means "the holder keeps renewing", and the dispatch holder had no renewal act that was not a claim, because no dispatch run was expected to sit idle for longer than a TTL. The fix gives the run path a renewal act that is not a claim, keyed on what the invocation itself last wrote, and leaves the claim exactly as it is.

Deliberately out of scope: lease scope, the TTL and its default, the staleness rule, takeover, the sibling `queue claim`, the release primitive, the admission claim's stale same-holder `renewed` arm, the daemon supervision claim (which keeps its delivered behaviour), and any per-invocation holder identity.

## Constraints (Hard Requirements)

### C-1: Single-flight holds through the run and the park

- **Statement:** While a lane started by `dispatch` runs or waits in a park and its owner renews, a second `dispatch` of the same work item is refused `queue.single-flight` naming the live holder at every point: before, at, and after each lease TTL boundary. The lane's heartbeat age never reaches the TTL between renewals, for every legal configuration of `lane.liveness-interval` and `queue.lease-ttl`, including a liveness interval at or above the TTL. No takeover of the lane's lease occurs while the owner renews, and no second session starts for the work item.
- **Source:** AC (ticket requirement 5 and AC3 as the specification's DEC-13 cites them; GH-413 G-3, F-5, NFR-10, AC-F5-2)
- **Verification:** test (a park that outlasts the TTL several times, with the second dispatch attempted before, at, and after each boundary, in a default and an interval-above-TTL configuration)
- **Negotiable:** no

### C-2: The admission claim is unchanged

- **Statement:** The dispatch admission claim still decides its verdict inside the claim from the live lease it observes, still refuses a live same-ref lease under any holder with `queue.single-flight`, and still never renews and never adopts another invocation's lease while the lease is live. Its stale same-holder `renewed` arm is unchanged. Every TDR-0050 clause stands except the one this record amends, which concerns the run path and not the claim.
- **Source:** prior decision (TDR-0050 DC-1, DC-2, DC-3, DC-5); AC (GH-413 §8.5; the plan's binding fence: only who renews and how often is added)
- **Verification:** test (the delivered single-flight and two-invocation interleaving controls stay green with no assertion change) + code review
- **Negotiable:** no

### C-3: Lease semantics are unchanged

- **Statement:** At most one live lease per repository; liveness is heartbeat age below the TTL, stale at or beyond it; a stale lease is takeable; a live lease on another ref refuses `queue.lease-conflict`; the sibling `queue claim` keeps its own-holder renewal. The TTL default does not move, and no configuration key is added.
- **Source:** prior decision (TDR-0050 C-3 and C-4; TDR-0026 C-5); AC (GH-413 DM-9, §8.5)
- **Verification:** test (the delivered lease suites as read-only controls) + code review
- **Negotiable:** no

### C-4: The heartbeat is confined to renewal and keyed on its own last write

- **Statement:** The heartbeat is a no-op unless the live lease's latest heartbeat is the invocation's own last write. It never acquires an absent lease, never takes over a stale one, and never displaces another holder. A no-op appends nothing and extends nothing, and surfaces the bounded lease evidence `lease:not-owned`. Whatever the live lease records, a heartbeat that acts appends nothing but a `renewed` record for the lease the lane holds.
- **Source:** AC (GH-413 F-5, DEC-13, DM-9, NFR-10); prior decision (TDR-0050 DC-3's rationale)
- **Verification:** test (a heartbeat with no live lease, with a lease on another ref, with a lease under another holder, with a stale lease, and with a lease whose latest heartbeat is a successor's write: each appends nothing and surfaces `lease:not-owned`) + code review
- **Negotiable:** no

### C-5: An invocation that no longer holds the lease does not resume or continue as owner

- **Statement:** An invocation whose renewal is a no-op because the lease is no longer its own continues its current wait without claiming a live lease and re-checks at the next observation. It must not resume a session or otherwise continue as owner: at that point it returns one classified result with the park standing and the observation, and the operator resume path applies. It does not release, renew, or extend the successor's lease.
- **Source:** AC (GH-413 F-5, F-7, DEC-13, NFR-10, Appendix D; AC-F5-2)
- **Verification:** test (the re-dispatch arm: after a renewal outage longer than the TTL and a re-dispatch, the earlier invocation's next renewal is a no-op surfaced as `lease:not-owned`, it returns instead of resuming as owner, and the successor's lease is neither released nor renewed)
- **Negotiable:** no

### C-6: The heartbeat does not pass the owner-hold gate

- **Statement:** The renewal is not subject to the owner-hold precondition. A lane parked under an active owner hold keeps renewing, and the hold keeps its delivered meaning: it parks nothing, writes no park record, and still refuses the window-end resume admission until it clears.
- **Source:** AC (GH-413 F-5, F-11, DEC-13, NFR-10; AC-F5-2, AC-F11-1)
- **Verification:** test (a parked lane under an active hold keeps a heartbeat age below the TTL and is still refused resume admission until the hold clears)
- **Negotiable:** no

### C-7: One exclusion mechanism and one liveness definition

- **Statement:** The heartbeat is the delivered `queue.lease` record with operation `renewed`. No heartbeat record kind, lock file, process probe, or lane-state member becomes an input to exclusion or to lease liveness, and no schema, lease operation, claim result, or error identity is added. `lease:not-owned` is a bounded evidence reference, not a record.
- **Source:** AC (GH-413 DEC-13, DM-9, NFR-8; the plan's binding fence)
- **Verification:** test (the queue additivity, surface, and scheduling-contract inventories; the evidence-reference budget) + code review
- **Negotiable:** no

### C-8: Bounded, at a derived cadence, around bounded waits

- **Statement:** The renewal cadence is `min(lane.liveness-interval, queue.lease-ttl / 2)`, derived from two delivered keys and never a key of its own. At most one renewal lands per renewal cadence and no more than one per wake, on the injected delay: no wall-clock read, no real timer in the engine, no busy-loop. The lane renews at each wake; a bounded tracker or claim wait is not renewed. Each renewal appends at most one record, and identical injected clock and delay inputs produce identical renewal records.
- **Source:** AC (GH-413 DEC-11, DEC-13, NFR-5, NFR-7, NFR-10)
- **Verification:** test (the renewal cadence equals the derived bound under default, long-interval, and short-TTL configurations; renewals per wake at most 1; the configuration key set unchanged; the paired-run determinism fixture)
- **Negotiable:** no

### C-9: A failure is never silent

- **Statement:** Every failed renewal and every no-op renewal is surfaced as bounded lease evidence, and a failed renewal is retried at the next cadence and only then. A lane never continues a park on a stale lease without that state being surfaced, and no surface reports a live lease the records do not show.
- **Source:** AC (GH-413 F-5, §10 "Lease evidence", NFR-10, RSK-10)
- **Verification:** test (the renewal-failure arm and the no-op arm: each surfaced; the retry lands on the next cadence)
- **Negotiable:** no

> **Table stakes:** every alternative below keeps the delivered error identities, the append-only lease ledger, the fence-serialised claim, and the advisory (never exclusionary) owner probe. None of those eliminates an alternative.

## Decision Drivers

1. **A promise is true for the whole interval it names.** Single-flight that holds for ninety seconds of an hours-long park is not single-flight.
2. **Honest liveness.** The lease's heartbeat age must mean what operators read it to mean: a live owner, or an owner that is gone.
3. **A dead owner never blocks a work item.** Recovery from a crashed lane stays one TTL long, never the length of a window.
4. **One exclusion mechanism.** No second lock beside the lease: no heartbeat record, file, or probe decides who may run.
5. **Evidence legibility.** A stale or a lost lease is explained by records on the ledger, not inferred.
6. **The paved road.** The delivered `renewed` operation, the injected delay, and two delivered keys; nothing new to operate.
7. **Scope discipline.** The amendment moves exactly one rule, who renews, and nothing else in TDR-0050.

## Decision Rights (DACI)

- **Driver:** `@decision-advisor`, GH-413 DEC-13.
- **Decider / Approver:** Juliusz Ćwiąkalski, human acceptance at the GH-413 pull request. The AI does not accept this record, and `decision_date` stays null until that acceptance.
- **Contributors:** `@pm` (the remediation decisions and the rejected alternative), `@spec-writer` (F-5, F-11, DEC-11, DEC-13, DM-9, NFR-7, NFR-10, section 14), `@readiness-reviewer` (the three lease findings), `@plan-writer` (the claim path in scope), `@decision-advisor` (analysis, the executed probe, this record).
- **Required reviewers:** `@reviewer`, and the human owner (this record amends a delivered concurrency rule).
- **Performers:** `@coder` (the renewal entry and the run-path wiring), `@test-plan-writer` (the lease arms), `@doc-syncer` (the dispatch-engine and scheduling-engine pages).
- **Informed:** operators of native deliveries; the daemon supervision claim owner; the parallel-lanes and resident-mode work.

**Type note.** TDR. The architecture-level question, that exclusion is a repository-exclusive lease with heartbeat liveness, is delivered (TDR-0026) and is not reopened. This record changes who performs one delivered lease operation on one caller's run path, on which cadence, and keyed on what. It is R2 because it amends the rule of a delivered concurrency path that the ticket's AC3 rests on. It is not R3 because every fact is repo-local and read directly (and one path was executed), the change is reversible by removing the renewal, and no exclusion contract moves.

## Evidence, Assumptions & Unknowns

| Item | Label | Source | Impact if false | Confidence |
|------|-------|--------|-----------------|------------|
| Lease operations are the closed four; the TTL default is 90 000 ms and the production claim takes it; a lease is stale at or beyond the TTL | FACT | `contracts/queue.ts:33, 37`; `config/defaults.ts:82`; `cli/src/production.ts:4859-4866`; `domain/queue-lease.ts:50-51` (read 2026-11-26) | C-3 and the cadence arithmetic would rest on different numbers | High |
| The admission claim refuses a live same-ref lease under any holder and never renews | FACT | `app/queue.ts:2176-2188, 2343-2381`; TDR-0050 DC-2 and DC-3 | The amendment would reopen a rule that is not the delivered one | High |
| The same-holder `renewed` arm preserves `acquiredAt` and `leaseId` and stamps a new `heartbeatAt` on every write | FACT | `app/queue.ts:2021-2048, 2189-2211` | The heartbeat would need a new operation (C-7 forbids it), or it would not identify the writer | High |
| Called without its no-renewal flag, the claim primitive refuses an active owner hold, acquires an absent lease, and takes over a stale lease under another holder | FACT | `app/queue.ts:2090-2098, 2152-2171, 2217-2270` | C-4 and C-6 would be precautions without a cause | High |
| With the fixed holder, a re-dispatch renews the dispatch holder's own stale lease under the same lease identity and appends a newer heartbeat, a later heartbeat by the first invocation lands on the successor's lease, and a release by holder ends it | FACT (executed) | Probe over the delivered claim and release primitives on a throwaway store, 2026-11-26; GH-413 readiness iteration 3, finding 2 | Neither C-4 nor C-5 would be needed | High |
| The run path receives the `leaseId` at the claim and does not retain it; the release matches on holder only | FACT | `app/dispatch.ts:91, 811`; `app/queue.ts:2431` | The ownership key and the release guard would already be in place at no cost | High |
| The liveness cadence and the TTL are independent keys, each validated on its own, and neither is set on the reference host | FACT | `config/defaults.ts:78, 82`; `config/catalog.ts:693-695, 857-859`; `.jaiship/config.yaml` (tracked) | The derived cadence would be unnecessary | High |
| Each lease write appends one record, and each lease read takes the verified whole-store snapshot | FACT | `app/queue.ts:686-690, 710-711, 1998-2019` | Ledger growth would be free | High |
| The run path blocks for bounded periods with no observation (the tracker retry ladder, the claim fence wait, worktree provisioning, handle acquisition, the ensure-push) | FACT | `feature-dispatch-engine.md` (Bounds and configuration); `app/queue.ts:2343-2381` | The bounded-wait rule in C-8 would have nothing to bind | High |
| The reference host pauses a lane for about 9 h 40 min a day, as two consecutive episodes | FACT | `.jaiship/config.yaml` (tracked); GH-413 spec RSK-13 | The park would be shorter and the renewal count lower | High |
| The heartbeat instant of a lease write is unique to that write on a real clock | ASSUMPTION | The stamp has millisecond resolution (`app/queue.ts:2044`); the store fence serialises appends but does not force distinct instants | Two writes sharing one instant would let a non-owner match the key; the fixture clock must step, and an implementation may also compare the sequence its own append returned | Medium |
| The reference host keeps the two keys at their defaults | ASSUMPTION | `.jaiship/config.yaml` (tracked) sets neither | A non-default pair would exercise the derived bound in the first real episode | Medium |

## Mental Models & Techniques Used

- **First principles:** what makes single-flight true for a parked lane? One serialisation point (the claim under the fence), one liveness definition (heartbeat age below the TTL), a live heartbeat for as long as the lane lives, and a way to tell whose heartbeat it is. The delivered system had the first two and lacked the last two for a lane that waits.
- **Inversion:** how can a heartbeat look right and be wrong? It renews through the admission claim (the race reopens). It renews any same-ref lease under the constant holder (a successor's lease). It is keyed on the lease identity (which the successor's claim preserved). It stops under an owner hold and lets the lease go stale. It runs on the liveness interval alone while that interval sits above the TTL. It busy-loops and floods the ledger. It fails silently and lets a live owner look gone.
- **5 Whys** (on "a second dispatch is admitted a TTL into a park"): the lease went stale, because nothing renewed it, because the dispatch path's only claim must refuse rather than renew to stay race-free (TDR-0050), because no renewal act existed that was not a claim, because no dispatch run was expected to sit idle for longer than a TTL. The fix adds the missing act and leaves the claim alone.
- **Second-order thinking:** a live lane's lease no longer goes stale after 90 s, which also closes the older exposure where a re-dispatch took over a running lane. The lease ledger grows by one record per cadence. And once a renewal can fail for a whole TTL, the system needs an answer for the invocation that wakes up beside its successor; without one it would keep the successor's lease alive, resume a second session, and on exit release the lease it lost.
- **Systems thinking:** claim, heartbeat, release, and takeover are one lease lifecycle with one identity problem, a constant holder. A change to one must be reviewed for the others; that is why the key is stated for the renewal and the release is guarded by it, while the claim stays untouched.
- **Margin as a property of the cadence:** the distance from the heartbeat to the TTL is not a fixed safety factor; it is whatever the cadence leaves, so it must be derived from the TTL rather than assumed from the defaults.

## Alternatives Considered

### Per-Alternative Constraint-Compliance Evaluation

| | C-1 single-flight through run and park | C-2 admission claim unchanged | C-3 lease semantics unchanged | C-4 confined to renewal, keyed on own write | C-5 a non-owner does not continue | C-6 outside the owner-hold gate | C-7 one mechanism | C-8 derived cadence, bounded waits | C-9 never silent |
|---|:---:|:---:|:---:|:---:|:---:|:---:|:---:|:---:|:---:|
| ALT-0 no renewal, declare the exposure | ❌ | ✅ | ✅ | — | — | — | ✅ | — | ❌ |
| ALT-1 a heartbeat record | ✅ | ✅ | ❌ | ✅ | ✅ | ✅ | ❌ | ✅ | ✅ |
| ALT-2 raise the lease TTL | ❌ | ✅ | ❌ | — | — | — | ✅ | — | ❌ |
| ALT-3 a lock file | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ | ❌ | ✅ | ❌ |
| ALT-4 renew through the admission claim | ✅ | ❌ | ✅ | ❌ | ❌ | ❌ | ✅ | ✅ | ✅ |
| ALT-5 heartbeat keyed on the lease identity acquired at admission | ✅ | ✅ | ✅ | ❌ | ❌ | ✅ | ✅ | ✅ | ✅ |
| ALT-6 heartbeat on the liveness cadence alone | ❌ | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ | ❌ | ✅ |
| ALT-7 selected: own-write renewal at the derived cadence | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ |

Legend: ✅ = passes · ❌ = fails · — = not reached (the alternative has no renewal act that the constraint binds). All constraints are `Negotiable: no`, so no accepted-risk exception is claimed and any ❌ is disqualifying.

### Alternative 0 — Do Nothing: Keep the No-Renewal Rule and Declare the Exposure

- **Eligibility:** Not eligible (fails C-1 and C-9).
- **Summary:** Keep the delivered rule and narrow the promise: per-ref single-flight holds only while the lease is live, and the takeover of a parked lane is declared as a risk with its operator consequence. This was the readiness review's other option.
- **Constraint compliance:** Passes C-2, C-3, and C-7, because nothing changes. C-4, C-5, C-6, and C-8 are not reached. Fails C-1: for all but the first TTL of a park a second dispatch of the work item is admitted. Fails C-9: the invocation keeps waiting on a lease that is stale and says nothing.
- **Driver fit:** Serves drivers 4 and 7 only.
- **Pros:** Zero change, and no new act on the lease path.
- **Cons:** It fails ticket requirement 5 and AC3, as the specification's DEC-13 cites them: "no second session for the work item" cannot hold through a park, and the next dispatch a TTL in takes the ref.
- **Why rejected:** It narrows the ticket's single-flight promise to an interval the ticket does not recognise. A declared exposure is not a delivered promise.

### Alternative 1 — A Heartbeat Record

- **Eligibility:** Not eligible (fails C-3 and C-7).
- **Summary:** Keep the lease as delivered and record liveness beside it: a new heartbeat record, or a heartbeat member on the lane record, that the admission verdict reads as proof of life.
- **Constraint compliance:** C-4 to C-6 and C-8 and C-9 could be met. Fails C-3: liveness would then have two definitions, the lease's heartbeat age and the heartbeat record's age. Fails C-7: a new record kind or member is a second exclusion mechanism beside the lease.
- **Driver fit:** Serves driver 2 and fails drivers 4 and 7.
- **Pros:** The lease record and its TTL stay untouched.
- **Cons:** Two sources of truth for one question, and a read path that must reconcile them when they disagree.
- **Why rejected:** The lease already carries a heartbeat. A second one answers the same question with a new record.

### Alternative 2 — Raise the Lease TTL

- **Eligibility:** Not eligible (fails C-1 and C-3).
- **Summary:** Configure `queue.lease-ttl` above the longest declared window so a lease survives a park without renewal.
- **Constraint compliance:** C-4 to C-6 and C-8 are not reached. Fails C-3: the TTL moves, and with it the recovery latency for a crashed lane. Fails C-1: no TTL bounds every park, because a window is declared rule data and can be longer than any default.
- **Driver fit:** Serves driver 6 and fails drivers 1, 3, and 7.
- **Pros:** One configuration value, and no renewal path.
- **Cons:** "A crashed session blocks a ref for no longer than the TTL" becomes hours. The admission fence wait is bounded by the same TTL (`app/queue.ts:2373`), so a refused dispatch could wait as long. And the first window longer than the TTL reopens the exposure.
- **Why rejected:** It trades a bounded recovery for an unbounded promise.

### Alternative 3 — A Lock File

- **Eligibility:** Not eligible (fails C-7 and C-9).
- **Summary:** Hold a lock file beside the worktree or the state directory for the park interval, as the exclusion for a parked lane.
- **Constraint compliance:** C-1 to C-6 and C-8 could be met. Fails C-7: a second exclusion mechanism beside the lease, in a file rather than in the state ledger. Fails C-9: a file cannot carry lease evidence, and a crashed owner leaves it behind with nothing to say so.
- **Driver fit:** Serves driver 1 and fails drivers 2, 4, and 5.
- **Pros:** Simple to reason about for one lane.
- **Cons:** It contradicts the delivered posture that the state ledger is the truth and the queue lease remains the exclusion mechanism. Stale-file detection becomes a second liveness definition.
- **Why rejected:** It buys single-flight with a second lock, which C-7 forbids.

### Alternative 4 — Renew Through the Admission Claim

- **Eligibility:** Not eligible (fails C-2, C-4, C-5, and C-6).
- **Summary:** Let the holding invocation re-run the admission claim, or call the claim primitive without its no-renewal flag, on each observation.
- **Constraint compliance:** C-1, C-7, C-8, and C-9 could be met. Fails C-2: the claim is the serialisation point TDR-0050 protects, and a claim that renews is the race it closed. Fails C-4: the primitive acquires an absent lease and takes over a stale one, and it renews whichever same-ref lease stands. Fails C-5: nothing in that call can tell the invocation that the lease is a successor's, so it would continue as owner. Fails C-6: the primitive refuses an active owner hold before the fence, so a parked lane under a hold would stop renewing.
- **Driver fit:** Serves driver 6 and fails drivers 2, 4, and 7.
- **Pros:** One lease operation on the dispatch path, and no new entry.
- **Cons:** "A validated decision that the caller can satisfy by renewing is not a refusal" (TDR-0050). With the constant holder, every re-dispatch is such a renewal.
- **Why rejected:** It reopens the admission race to solve a run-path problem, and it has no ownership test at all.

### Alternative 5 — Heartbeat Keyed on the Lease Identity Acquired at Admission

- **Eligibility:** Not eligible (fails C-4 and C-5).
- **Summary:** Renew only when the live lease's identity equals the lease identity the invocation received at its claim. This was the specification's key before the Definition-of-Ready iteration 3.
- **Constraint compliance:** C-1 to C-3 and C-6 to C-9 could be met. Fails C-4: the delivered `renewed` arm preserves the lease identity and the acquisition instant, so a re-dispatch's claim renews under the first invocation's identity; after that the earlier invocation's key still matches and its heartbeat extends the successor's lease. Fails C-5: for the same reason the earlier invocation would resume as owner beside its successor.
- **Driver fit:** Serves drivers 6 and 7 and fails drivers 1, 2, and 5.
- **Pros:** Simple to state, and the claim already returns the identity.
- **Cons:** It is true only until the first re-dispatch, which is exactly the case it exists for. The executed facts in Context show it.
- **Why rejected:** An ownership test that a re-dispatch preserves is not an ownership test.

### Alternative 6 — Heartbeat on the Liveness Cadence Alone

- **Eligibility:** Not eligible (fails C-1 and C-8).
- **Summary:** Renew at each observation, on `lane.liveness-interval` and nothing else, with the correct key.
- **Constraint compliance:** C-2 to C-7 and C-9 could be met. Fails C-8: the cadence is not bounded against the TTL. Fails C-1: whenever the liveness interval is at or above `queue.lease-ttl`, the heartbeat reaches the TTL between wakes, the lease goes stale, and a second dispatch is admitted through the delivered same-holder arm.
- **Driver fit:** Serves drivers 6 and 7 at the defaults and fails driver 1 everywhere else.
- **Pros:** No arithmetic and no second cadence: the renewal is simply part of the observation.
- **Cons:** The invariant is true only for two defaults that nothing keeps in order. The reference host happens to run those defaults, which would hide the defect until the first operator tuned the liveness interval.
- **Why rejected:** It fails C-1 for a legal configuration. The bound is cheap, derived, and makes the promise true for every configuration.

### Alternative 7 — Selected: Own-Write Renewal at the Derived Cadence

- **Eligibility:** Eligible (passes C-1 to C-9).
- **Summary:** The invocation that holds the lease renews it through the delivered same-holder `renewed` operation, at most once per renewal cadence and no more than once per wake, where the renewal cadence is `min(lane.liveness-interval, queue.lease-ttl / 2)`. The renewal is a no-op unless the live lease's latest heartbeat is the invocation's own last write, and it does not pass the owner-hold gate. A non-owner surfaces `lease:not-owned` and returns instead of resuming as owner. The admission claim is untouched.
- **Constraint compliance:** C-1 by a heartbeat that cannot reach the TTL on any legal configuration; C-2 by leaving the claim and its stale same-holder arm untouched; C-3 by adding no key and moving no default; C-4 by the no-op rule keyed on the invocation's own write; C-5 by the non-owner's return; C-6 by staying outside the owner-hold gate; C-7 by using the delivered `renewed` record; C-8 by a cadence derived from two delivered keys and no renewal inside a bounded wait; C-9 by surfacing every failure and every no-op.
- **Driver fit:** Best on all seven drivers.
- **Pros:** The promise holds for every configuration. One exclusion mechanism and one liveness definition remain. The renewal can neither take a lease nor be starved by a hold, and an owner that lost its lease cannot run beside its successor.
- **Cons:** One more lease operation on the dispatch path, a growing renewal ledger, and a key whose exactness depends on distinct heartbeat instants.
- **Why chosen:** It is the only alternative that satisfies every constraint, and it composes what the repository already owns.

## Decision

- **Decision:** Adopt **ALT-7**.

### D1: Who renews: the holding invocation

The invocation that holds the lease renews it: the dispatch run path that acquired the lease at admission, from its first session to its terminal classification and through every park. The renewal is never performed by the admission claim, which keeps its delivered refusal and its delivered no-renewal rule (D7).

### D2: How often: the derived renewal cadence, why the bound is required, and bounded waits

- **The renewal cadence is `min(lane.liveness-interval, queue.lease-ttl / 2)`.** It is derived from two delivered keys and is never a key of its own. At most one renewal lands per renewal cadence and no more than one per wake, on the injected delay.
- **Why the bound is required.** Renewal on the liveness interval alone lets the heartbeat reach the TTL between wakes whenever that interval is at or above `queue.lease-ttl`. The lease is then stale, and a second dispatch of the work item is admitted through the delivered same-holder arm: the outcome this amendment exists to prevent. The two keys are independent, each is validated on its own, and nothing orders them, so the invariant must come from the cadence and not from the configuration. Halving the TTL is the widest cadence at which every successful renewal lands on a live lease with a margin at least equal to the cadence itself: the heartbeat age never exceeds half the TTL between successful renewals.
- **At the defaults nothing changes shape.** The bound is 45 000 ms and the liveness interval is 30 000 ms, so the renewal cadence is the observation cadence: one renewal at each observation and each park wake.
- **When the liveness interval exceeds half the TTL**, the heartbeat wakes at half the TTL, between observations, on the same injected delay. The observation cadence is unchanged: the wait still wakes at most once per delivered liveness cadence for observation and re-derives the effective end (DEC-11). The wake bound is expressed on the smaller of the two cadences (NFR-7).
- **Bounded waits are not renewed.** The lane renews at each wake. A bounded tracker or claim wait is not renewed, so no renewal is issued from inside a wait the run path did not schedule as a wake.
- **It is not a second timing key.** No configuration is added. The bound is arithmetic over two delivered keys, evaluated where the cadence is consumed.

### D3: Through what: the delivered `renewed` operation

The renewal is the delivered same-holder `renewed` operation over the existing `queue.lease` record: one appended record carrying the lease identity and the acquisition instant it renews, with a new heartbeat. No lease operation, claim result, record kind, or schema is added, and the lease's scope, holder, and ref are never rewritten.

### D4: Confined to renewal, keyed on the invocation's own last write

- **The renewal is a no-op unless the live lease's latest heartbeat is the invocation's own last write.** The invocation remembers the heartbeat instant it last wrote. A lease whose latest heartbeat is somebody else's write is not the lane's own, and the renewal appends nothing.
- **Why the key is the heartbeat and not the lease identity.** The holder is a constant and the reference is shared, so neither identifies an invocation. The lease identity does not either: a re-dispatch's admission claim against a stale same-holder lease takes the delivered `renewed` arm, which preserves the lease identity and the acquisition instant while appending a newer heartbeat. After that the earlier invocation's remembered instant stops matching and its renewal becomes a no-op. A heartbeat-write key is the only ownership test the delivered arm leaves intact.
- **Where the key lives.** On the run-path renewal side. The admission claim's stale same-holder `renewed` arm is unchanged, and the claim needs no change.
- **Why the no-op rule exists.** The delivered claim primitive, called without its no-renewal flag, acquires an absent lease, takes over a stale one under another holder, and refuses an active owner hold. The heartbeat is therefore not that call. It is an entry over the delivered `renewed` arm that refuses to act outside renewal, so a lane that holds nothing, a lane whose lease has gone to another holder, and a lane whose lease is a successor's each cause no write.

### D5: An invocation that no longer holds the lease does not resume or continue as owner

- **A no-op renewal does not end the invocation by itself.** It surfaces the bounded evidence `lease:not-owned`, extends nothing, and the invocation continues its current wait without claiming a live lease, re-checking at the next observation.
- **The prohibition bites where ownership is needed.** An invocation that no longer holds the lease must not resume a session or otherwise continue as owner. At that point it returns one classified result with the park standing and the observation, and the delivered operator resume path applies.
- **It leaves the successor's lease alone.** The earlier invocation neither renews, extends, nor releases the successor's lease. The release primitive is unchanged and still matches on holder; the run path does not call it for a lease it no longer owns.
- **Why.** After a renewal outage longer than the TTL a re-dispatch may be admitted, as the delivered claim allows. Without this clause the earlier invocation would wake, keep the successor's lease alive, resume a second session for the work item, and on exit release the lease it had lost.

### D6: Outside the owner-hold gate

- **The renewal is not subject to the owner-hold precondition.** A lane parked under an active owner hold keeps renewing.
- **Why.** The delivered claim primitive refuses an active owner hold before the fence. A heartbeat built on that call would stop renewing under a hold, and a hold has no declared end. The lane would sit parked on a lease going stale, and the first dispatch after the hold clears would be admitted to the ref while the lane's park record still stood.
- **The hold loses nothing.** It parks nothing, writes no park record, and still refuses the window-end resume admission until it clears, exactly as delivered (F-11). Only the heartbeat is exempt from it.

### D7: What is unchanged

- **The admission claim:** a live same-ref lease under any holder still refuses `queue.single-flight`, the verdict is still decided inside the claim, and the claim still never renews or adopts a live lease. Its stale same-holder `renewed` arm is unchanged.
- **Repository exclusivity:** one live lease per repository; a live lease on another ref still refuses `queue.lease-conflict`.
- **The TTL and its default:** 90 000 ms, and stale at or beyond it.
- **The stale takeover:** a crashed or killed invocation renews nothing, so its lease still goes stale one TTL after its last heartbeat and the delivered takeover with its incident evidence still applies. "A crashed session blocks a ref for no longer than the TTL" stays true.
- **The sibling `queue claim`:** its own-holder renewal, its other-holder refusal, and its other-ref refusal are as delivered.
- **The release primitive and the daemon supervision claim:** both keep their delivered behaviour and are not amended here.
- **Vocabulary:** no new record kind, lease operation, claim result, schema identity, error identity, or configuration key. `lease:not-owned` is an evidence reference inside the delivered per-record evidence budget.

### D8: The failure policy, and what the heartbeat means

- **A failed renewal is retried at the next cadence and only then.** Store-fence contention and state failures are transient; no retry lands inside the cadence and nothing busy-loops.
- **Every failure and every no-op is surfaced as bounded lease evidence.** A failed renewal is never swallowed, and a no-op renewal surfaces `lease:not-owned`. The park never silently continues on a stale lease: the state is on the record, so a stale lease is explained rather than inferred.
- **The margin is a property of the cadence.** At the defaults one failed renewal leaves the heartbeat at two thirds of the TTL at the next attempt, and two consecutive failures bring it to the TTL at the attempt after that. At the widest cadence the bound permits, half the TTL, a single failed renewal brings it to the TTL at the next attempt. The bound guarantees the heartbeat for successful renewals; it does not make a lease survive failed renewals at the widest cadence.
- **What the heartbeat means.** The lease's heartbeat age is the liveness signal during a park. A live heartbeat means the waiting invocation is alive and will resume the lane at the recorded end. A stale lease during a park means the owner is gone.

### D9: The amendment, stated exactly

TDR-0050 DC-3 reads "The dispatch claim never renews; the sibling claim still does", and TDR-0050 C-4 restates it as "Only the dispatch claim refuses a live same-ref lease under any holder and never renews." This record amends both for the dispatch run path only, and they read:

> The dispatch **admission claim** never renews; the sibling claim still does. The invocation that holds the lease renews it after admission, at most once per renewal cadence (`min(lane.liveness-interval, queue.lease-ttl / 2)`), through the delivered same-holder `renewed` operation, as a no-op unless the live lease's latest heartbeat is the invocation's own last write and without passing the owner-hold gate; an invocation that no longer holds the lease does not resume or continue as owner (TDR-0078).

Nothing else in TDR-0050 moves. DC-1, DC-2, DC-4, and DC-5 and C-1, C-2, C-3, C-5, and C-6 stand verbatim: the verdict is still decided inside the claim, the refusal set is still declared and total, a refusal is still silent and clean, and the fence wait is still a wait. TDR-0050's own revisit triggers are not this amendment: the dispatch holder stays the fixed `dispatch` and still dispatches one ref at a time. TDR-0050 is amended, not superseded: its record, its number, and its status are untouched, and this record links to it rather than replacing it. The two current-truth sentences that carry the rule, "because both claim with a fixed holder and never renew mid-flight" and "The dispatch claim uses the fixed holder `dispatch` and never renews", are reconciled in the system-spec-update phase to name the admission claim.

**Authority and acceptance:** this is an R2 design record. Status is `Proposed` and `decision_date` is `null`. The human owner (Juliusz Ćwiąkalski) accepts or rejects it at the GH-413 pull request, together with TDR-0077 or separately. AI assistance analysed and wrote the record; the AI does not accept it, and no independent `@decision-critic` pass was run for it.

### Constraint Compliance Attestation

ALT-7 satisfies C-1 to C-9: a heartbeat at the derived cadence cannot reach the TTL on any legal configuration, so single-flight holds through the run and the park while the owner renews (C-1); the admission claim and its stale same-holder arm are untouched (C-2); no lease semantic, default, or key moves (C-3); the renewal is a no-op outside the lane's own last write and never acquires, takes over, or displaces (C-4); an invocation that no longer holds the lease returns instead of resuming as owner and leaves the successor's lease alone (C-5); the renewal does not pass the owner-hold gate (C-6); it is the delivered `renewed` record and no second mechanism (C-7); it runs at most once per renewal cadence on the injected delay and not inside a bounded tracker or claim wait (C-8); and every failure and every no-op is surfaced (C-9). No accepted-risk exceptions are claimed. Two items are recorded below as Unresolved Questions rather than attested as settled: whether a lease that has gone stale with no newer heartbeat is still the lane's own, which the specification does not state, and the exactness of a key whose instant has millisecond resolution.

## Trade-offs & Consequences

### Positive Outcomes

- Single-flight holds for the whole park, on every legal configuration of the two keys: no takeover of a parked lane while its owner renews, and no second session for the work item.
- The older run-phase exposure closes with the same heartbeat: a live lane's lease no longer goes stale after 90 s, so a re-dispatch of a running work item is refused while its invocation lives.
- One exclusion mechanism and one liveness definition remain: the lease and its heartbeat age.
- The heartbeat can neither take a lease nor be starved by an owner hold, and an owner that lost its lease cannot keep its successor's lease alive, resume a second session, or release the successor's lease on exit.
- Every renewal, failure, and no-op is a bounded fact on the ledger or on the result, so liveness and its loss are readable without a new surface.

### Negative Outcomes

- **The lease ledger grows.** One record lands per renewal cadence per live lane: about 480 for a four-hour park, and about 1 160 for the reference host's two consecutive episodes at the default cadence. Every lease read takes the verified whole-store snapshot.
- **The margin shrinks with the cadence.** At the widest cadence a single failed renewal brings the heartbeat to the TTL at the next attempt.
- **A lease can go stale across a long bounded wait.** A bounded tracker or claim wait is not renewed, by decision; if one outlasts the TTL margin the lease goes stale until the next wake, and the invocation re-checks ownership there.
- **A live invocation holds its work item for as long as it owns the lease**, including a parked one. An operator cannot take over a parked lane by dispatching again; the delivered operator resume path is the route.
- **An owner that loses its lease ends its invocation.** It returns one classified result with the park standing, and the lane waits for the operator resume path.
- **Two lease operations live on the dispatch path.** The claim refuses and the heartbeat renews, and a change to one must be reviewed for the other.
- **The published stale-takeover row describes a lease held by another holder.** A re-dispatch of the dispatch holder's own stale lease is recorded as `renewed`, with no takeover evidence. This is pre-existing, is surfaced by this record, and is deliberately not changed by it.

### Unresolved Questions

- [ ] A stale lease that nobody took. Whether a lease that has gone stale with no newer heartbeat is still the lane's own. The key alone says yes: its latest heartbeat is still the invocation's last write. The rule's wording speaks of the live lease. Under one reading the invocation renews its own stale lease and continues; under the other the renewal is a no-op and the invocation returns. The specification does not state the case. (owner: `@spec-writer`)
- [ ] The resolution of the key. The heartbeat instant has millisecond resolution, so two writes that share an instant would let a non-owner match. The fixture clock must step between writes, and an implementation that also remembers the sequence its own append returned gets an exact match. (owner: `@coder`, the plan's lease phase)

## Implementation Plan

1. **The renewal entry.** One entry for the dispatch caller over the delivered same-holder `renewed` arm, confined to renewal (a no-op otherwise), keyed on the live lease's latest heartbeat being the invocation's own last write, and outside the owner-hold gate. The admission claim is not modified.
2. **Run-path wiring.** The invocation remembers the heartbeat instant of each lease write it makes, renews at the derived cadence at each observation and at each wake of the park wait, and stops renewing when the live lease's latest heartbeat is not its own.
3. **The not-owned outcome.** A no-op renewal surfaces `lease:not-owned` and extends nothing. An invocation that no longer holds the lease returns one classified result with the park standing and the observation, and does not release, renew, or extend the successor's lease.
4. **Failure surfacing.** Each failed renewal is bounded lease evidence, and the retry lands on the next cadence.
5. **Fixtures.** The lease arms before, at, and after each TTL boundary in a default and an interval-above-TTL configuration; the owner-hold case; the no-op cases; the re-dispatch arm after a renewal outage; the renewal-failure arm; and the delivered lease suites and the admission interleaving as read-only controls.
6. **Documentation.** The dispatch-engine page's two sentences and the queue reference page name the admission claim. The operations guidance states that the heartbeat age is the parked lane's liveness signal and that an invocation which lost its lease has returned.

## Verification Criteria

- A park that outlasts the TTL several times, default configuration: heartbeat age below the TTL at every observation; renewals at most 1 per cadence; a second dispatch refused `queue.single-flight` with the live holder before, at, and after each boundary; takeovers while the owner renews 0; second sessions 0.
- The same park with `lane.liveness-interval` at or above the TTL: the renewal cadence equals half the TTL, and the heartbeat age stays below the TTL.
- A parked lane under an active owner hold: keeps renewing, with a heartbeat age below the TTL; resume admission still refused until the hold clears.
- The admission claim: the delivered single-flight and interleaving controls pass with no assertion change; `renewed` records attributable to an admission claim against a live lease: 0; the stale same-holder arm behaves as delivered.
- `queue claim` by its own holder on its own live lease: still `renewed`; the other-holder and other-ref refusals unchanged.
- Renewals that acquire an absent lease, take over a stale lease, or displace another holder: 0.
- After a renewal outage longer than the TTL and a re-dispatch: the earlier invocation's next renewal is a no-op surfaced as `lease:not-owned`; it extends nothing; it does not release or renew the successor's lease; and it returns instead of resuming as owner.
- No-op renewals surfaced as `lease:not-owned`: 100%. Renewal failures surfaced: 100%. Retries inside the cadence: 0.
- Renewals issued during a bounded tracker or claim wait: 0.
- New record kinds, lease operations, claim results, schema identities, configuration keys: 0.
- `renewed` records for one lane over an interval: at most elapsed time divided by the renewal cadence, plus 1.
- Paired runs over the injected clock and delay: identical lease records.

## Confidence Rating

**Medium.** The delivered facts are read directly and one path was executed: the claim's refusal, the `renewed` arm and what it preserves, what the claim primitive does without its flag, the two independent keys, and the fact that a re-dispatch changes the heartbeat and nothing else that identifies the lease. The cadence bound is arithmetic over those facts and holds for every legal configuration, and the heartbeat-write key follows from the same executed facts. What lowers the confidence is narrow and named: the specification does not say whether a stale lease that nobody took is still the lane's own, and the key's instant has millisecond resolution. The in-change fixtures prove the cadence, the single-flight arms, and the re-dispatch arm once the fixture clock steps between writes.

## References

- Change specification: `doc/changes/2026-11/2026-11-26--GH-413--peak-pausing-dispatch-lane/chg-GH-413-spec.md` (v1.3): §2.1 and §2.2 (the lease gap), §5.1 F-5 and F-11, §6 Flow 5, §7.1, §8.3 DM-9, §8.5, §9 NFR-7 and NFR-10, §10, §11 RSK-10 and RSK-13, §12 "Lease renewal", §14 (the three settled questions), §15 DEC-11 and DEC-13, §18, §22, §24 Appendix D, and the §17 acceptance arms AC-F5-2 and AC-F11-1.
- Change plan: `doc/changes/2026-11/2026-11-26--GH-413--peak-pausing-dispatch-lane/chg-GH-413-plan.yaml`, the lease-liveness phase and the binding fence that only who renews and how often is added.
- Definition-of-Ready reviews: `doc/changes/2026-11/2026-11-26--GH-413--peak-pausing-dispatch-lane/readiness-review/readiness-iter-1.md` (finding 2), `readiness-iter-2.md` (finding 3), and `readiness-iter-3.md` (finding 2).
- Ticket: GH-413, requirement 5 and AC3 as the specification's DEC-13 and acceptance-criteria traceability cite them; the ticket body was not read for this record.
- Amended decision: [TDR-0050](TDR-0050-dispatch-atomic-admission-verdicts.md), DC-3 and its restatement in C-4.
- Prior decisions: [TDR-0026](TDR-0026-queue-lifecycle-removal-single-flight.md) (the repository-exclusive lease and the narrowed same-holder renewal); [TDR-0049](TDR-0049-dispatch-owned-durable-lane-record.md) (the lane the lease protects); [TDR-0052](TDR-0052-in-process-bounded-restart-loop.md) (the run whose iterations the heartbeat spans).
- Companion record: [TDR-0077](TDR-0077-dispatch-owned-window-watch.md) (the dispatch-owned window watch whose park this heartbeat keeps single-flight).
- Current truth: [Dispatch Engine](../spec/features/feature-dispatch-engine.md) (the one-shot run order, the per-ref single-flight admission, bounds and configuration); [Scheduling Engine](../spec/features/feature-scheduling-engine.md); [Provider Peak Pausing](../spec/features/feature-peak-pausing.md).
- Code and contracts (read 2026-11-26): `packages/core/src/contracts/queue.ts`; `packages/core/src/app/queue.ts`; `packages/core/src/app/dispatch.ts`; `packages/core/src/domain/queue-lease.ts`; `packages/core/src/config/defaults.ts`; `packages/core/src/config/catalog.ts`; `packages/cli/src/production.ts`; `.jaiship/config.yaml` (tracked).
