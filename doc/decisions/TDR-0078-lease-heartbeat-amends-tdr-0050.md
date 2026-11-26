---
id: TDR-0078
decision_type: tdr
status: Proposed
created: 2026-11-26
decision_date: null
last_updated: 2026-11-26
summary: "GH-413 DEC-13: the dispatch lane keeps its repository lease live for the whole run and the whole park. The invocation that holds the lease renews it, at most once per renewal cadence and no more than once per wake, where the renewal cadence is `min(lane.liveness-interval, queue.lease-ttl / 2)` (30 000 ms at the defaults), through the delivered same-holder `renewed` operation over the existing `queue.lease` record, so its heartbeat age cannot reach the lease TTL (90 000 ms default) between renewals even when the liveness interval is configured at or above the TTL, and a second `dispatch` of the work item is refused `queue.single-flight` with the live holder before, at, and after every TTL boundary of an hours-long park. The bound is required because renewal on the liveness interval alone lets the heartbeat reach the TTL between wakes whenever that interval is at or above the TTL, and the stale lease is then admitted to a second dispatch. The renewal is a no-op unless the lease is this lane's own same-ref lease, so it never acquires an absent lease, takes over a stale one, or displaces another holder, and it does not pass the owner-hold gate, so a parked lane under an active hold keeps renewing. This amends TDR-0050 DC-3 for the dispatch run path only: the dispatch admission claim still never renews and still refuses a live same-ref lease under any holder, repository exclusivity, the TTL, the stale takeover, the sibling `queue claim` renewal, and the release path are unchanged, and no record kind, lease operation, claim result, schema, configuration key, or second exclusion mechanism is added. A renewal failure is retried at the next cadence and surfaced as bounded lease evidence; the park never silently continues on a stale lease."
owners: ["Juliusz Ćwiąkalski"]
service: "delivery-os dispatch engine and queue lease: the dispatch lane's lease heartbeat through the run and the park"
decision_scope: repo
review_date: null
business_impact: "The single-flight promise holds for the whole interval it names, on every legal configuration of two independent operator keys. A parked lane cannot be taken by a second dispatch, so the work item never acquires a second session because of an episode, and the same heartbeat closes the older exposure of a running lane whose lease went stale after 90 s. The cost is one delivered lease record per renewal cadence per live lane."
customer_impact: "A second `dispatch` of a running or parked work item is refused `queue.single-flight` naming the live holder for as long as the owning invocation lives, and `lanes` shows the live `leaseHolder`. A lease whose heartbeat goes stale during a park again means exactly one thing: the owner is gone."
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
  driver: "@decision-advisor (GH-413 DEC-13: the amendment the specification routes here after Definition-of-Ready iteration 1 finding 2 and iteration 2 finding 3)"
  decider: "Juliusz Ćwiąkalski — human acceptance at the GH-413 pull-request review; AI does not accept this R2 record"
  contributors:
    - "@pm (GH-413 Definition-of-Ready remediation decision 2: the lease heartbeat, with the takeover-exposure alternative rejected)"
    - "@spec-writer (GH-413 specification v1.2: F-5, F-11, DEC-11, DEC-13, DM-9, NFR-7, NFR-10, RSK-10, Appendix D)"
    - "@readiness-reviewer (GH-413 Definition-of-Ready iteration 1 finding 2 and iteration 2 finding 3: the delivered rule does not provide the promise, and the two keys are unrelated)"
    - "@plan-writer (GH-413 plan: the claim path in scope, and the binding fence that only who renews and how often is added)"
    - "@decision-advisor (repository analysis, the executed probe of the lease primitives, and this record)"
  reviewers:
    - "@reviewer"
    - "Human owner (GH-413 pull-request review: this record amends a delivered concurrency rule)"
  performers:
    - "@coder (the renewal entry, the run-path wiring at the derived cadence, the failure evidence, and the lease arms)"
    - "@test-plan-writer (the lease arms, the interval-above-TTL configuration, and the owner-hold case)"
    - "@doc-syncer (the dispatch-engine and scheduling-engine pages)"
  informed:
    - "Operators of native deliveries: a parked lane now holds its work item for as long as its invocation lives"
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
  - "The dispatch holder stops being a fixed constant (a per-invocation holder identity). The own-lease precondition is re-decided, because the delivered renewal and release become ownership-safe by themselves and the precondition may retire."
  - "`lane.liveness-interval` and `queue.lease-ttl` become validated against each other, or either default moves. The renewal cadence bound is re-decided with it, never a second timing key by default."
  - "A second caller needs the same heartbeat (parallel lanes, GH-412; resident mode, GH-395). The renewal entry is generalized by a decision, not by copying the path."
  - "A live invocation is observed with a stale lease, or a taken-over lease is observed renewed or released by its former holder. The failure policy and the own-lease precondition are reopened with the incident."
  - "The renewal ledger growth is observed to matter, since every lease read takes the verified whole-store snapshot. The cadence or the record's representation is re-decided."
  - "The release path or the sibling `queue claim` is proposed to take the same own-lease precondition. That is an amendment to this record and TDR-0050 together."
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

> **Traceability.** Spec v1.2 §15 **DEC-13**; §5.1 F-5 and F-11; §6 Flow 5; §8.3 DM-9; §9 NFR-7 and NFR-10; §11 RSK-10; §12 "Lease renewal"; §22 "A live lease during a park"; §24 Appendix D; §17 AC-F5-2 and AC-F11-1. Amends **TDR-0050 DC-3 and its restatement in C-4 for the dispatch run path only**. Companion of [TDR-0077](TDR-0077-dispatch-owned-window-watch.md), which is not part of this record.

## Context

- **FACT:** The lease record has a closed four-operation lifecycle, `acquired`, `renewed`, `released`, and `taken-over` (`packages/core/src/contracts/queue.ts:33`), and one shape carrying `leaseId`, `holder`, `ref`, `heartbeatAt`, and `ttlMs` (`:43-58`).
- **FACT:** The shipped lease TTL is 90 000 ms (`contracts/queue.ts:37`; `packages/core/src/config/defaults.ts:82`). The production claim passes no TTL and takes the default (`packages/cli/src/production.ts:4859-4866`; `packages/core/src/app/queue.ts:2355`). A lease is stale at or beyond the TTL, the bound inclusive (`packages/core/src/domain/queue-lease.ts:50-51`).
- **FACT:** The dispatch admission claim refuses a live same-ref lease under any holder and never renews. `claimDispatchLease` claims with the fixed holder `dispatch` and `noRenewal: true` (`app/queue.ts:2343-2381`); inside the fence that flag turns a live same-ref lease into `queue.single-flight` naming the holder (`:2176-2188`). On success it returns the `leaseId`, which the run path receives and does not retain (`packages/core/src/app/dispatch.ts:91, 811`).
- **FACT:** The same-holder renewal is delivered. Inside the fence, a lease recording the same ref under the same holder is renewed by a `renewed` record that preserves `acquiredAt` and `leaseId` (`app/queue.ts:2189-2211`). The dispatch admission claim never reaches that arm while the lease is live.
- **FACT:** The claim primitive does more than renew when it is called without the no-renewal flag. It refuses an active owner hold before the fence (`:2090-2098`). With no live lease for the repository it acquires one (`:2152-2171`). A stale lease under another holder is taken over with full evidence and a `lease-stale-takeover` incident (`:2217-2270`), and every delivered takeover test seeds another holder (`tests/behaviour/queue-lease-takeover.test.ts:21-60`).
- **FACT:** With the fixed `dispatch` holder the delivered arm is not ownership-safe. Executed on 2026-11-26 over the delivered primitives on a throwaway store: a second dispatch's admission claim against a stale same-ref lease already held by `dispatch` succeeds as `renewed`, with no takeover record; a heartbeat over the same-holder arm renews a stale lease; after that second claim the first invocation's heartbeat succeeds on the lease the second now holds; and the first invocation's release, which matches on holder only (`:2431`), then ends it. The lease identity is preserved across all four, so it does not by itself tell two invocations apart. No delivered test covers the same-holder stale arm.
- **FACT:** The run holds the lease from the claim to a release in `finally` (`app/dispatch.ts:811, 1618-1620`; `production.ts:4868-4876`), and nothing on the path renews. Current truth states the rule: "The dispatch claim uses the fixed holder `dispatch` and never renews" and "because both claim with a fixed holder and never renew mid-flight" (`doc/spec/features/feature-dispatch-engine.md`, the one-shot dispatch run order and the per-ref single-flight admission section). TDR-0050 DC-3 and C-4 state it as a decision.
- **FACT:** The liveness cadence and the lease TTL are two independent operator keys. `lane.liveness-interval` defaults to 30 000 ms and `queue.lease-ttl` to 90 000 ms (`config/defaults.ts:78, 82`). Both are validated as positive integers, and nothing relates one to the other (`packages/core/src/config/catalog.ts:693-695, 857-859`). The reference host's tracked configuration sets neither. The delivered renewal-cadence derivation is one third of the TTL, never a key (`domain/queue-lease.ts:54-55`).
- **FACT:** Each lease write appends one record, and each lease read takes the delivered verified whole-store snapshot (`app/queue.ts:686-690, 710-711, 1998-2019`).
- **FACT:** A park outlasts the TTL many times. On the reference host a lane nominated to the tracked profile is paused, as two consecutive episodes, from 00:30 to 04:05 UTC and from 04:00 to 10:10 UTC (`.jaiship/config.yaml`, tracked; GH-413 spec RSK-13): about 9 h 40 min inside one invocation.
- **FACT:** TDR-0050 is itself `Proposed` with a null decision date on this branch. Its rule is nevertheless the delivered behaviour and the current truth, which is what this record amends.
- **Why now:** A dispatch lane that parks for hours outlives its lease many times over, and with the delivered rule the admission verdict treats the stale lease as takeable. GH-413's third goal forbids a second session for the work item, its DEC-13 routes the amendment here, and the Definition-of-Ready reviews found both halves of the problem: the rule does not provide the promise (iteration 1, finding 2), and a heartbeat tied to the liveness interval alone would fail whenever that interval is at or above the TTL (iteration 2, finding 3).

## Problem Framing (Clarified)

The question is not "should the lease last longer" but **who may keep a repository lease live on the dispatch path, on which cadence, by which act, and what must stay true while they do.**

Four sub-questions decide the mechanism:

1. **Which rule is in the way, and why is it there?** TDR-0050 DC-3 forbids renewal on the dispatch path for one reason: in a dispatched race the holder is always `dispatch`, so a claim that renews lets the second invocation in. The rule protects *admission*. An invocation renewing, after admission, the lease it already holds is a different act: it admits nothing and starts nothing.
2. **On which cadence?** The dispatch run observes on `lane.liveness-interval`; the lease goes stale on `queue.lease-ttl`. Tying the heartbeat to the liveness interval alone makes the promise true only where the two keys happen to be ordered as the defaults order them.
3. **What must the renewal preserve?** The verdict decided inside the claim; the refusal of a live same-ref lease under any holder; one live lease per repository; the TTL; the stale takeover; the sibling `queue claim`'s own renewal; and a parked lane's insulation from an owner hold, which has no declared end.
4. **What can the renewal break?** The hole TDR-0050 closed, one level up. With a constant holder, "same holder, same ref" does not identify the same invocation, so a renewal that is not confined to the lease its invocation holds can land on a lease a re-dispatch has taken.

Root cause versus symptom. The symptom is a second dispatch admitted a TTL into a park. The cause: lease liveness means "the holder keeps renewing", and the dispatch holder had no renewal act that was not a claim, because no dispatch run was expected to sit idle for longer than a TTL. The fix gives the run path a renewal act that is not a claim, and leaves the claim exactly as it is.

Deliberately out of scope: lease scope, the TTL and its default, the staleness rule, takeover, the sibling `queue claim`, the release path, the daemon supervision claim (which keeps its delivered behaviour), and any per-invocation holder identity.

## Constraints (Hard Requirements)

### C-1: Single-flight holds through the run and the park

- **Statement:** While a lane started by `dispatch` runs or waits in a park, a second `dispatch` of the same work item is refused `queue.single-flight` naming the live holder at every point: before, at, and after each lease TTL boundary. The lane's heartbeat age never reaches the TTL between renewals, for every legal configuration of `lane.liveness-interval` and `queue.lease-ttl`, including a liveness interval at or above the TTL. No takeover of the lane's lease occurs, and no second session starts for the work item.
- **Source:** AC (ticket requirement 5 and AC3 as the specification's DEC-13 cites them; GH-413 G-3, F-5, NFR-10, AC-F5-2)
- **Verification:** test (a park that outlasts the TTL several times, with the second dispatch attempted before, at, and after each boundary, in a default and an interval-above-TTL configuration)
- **Negotiable:** no

### C-2: The admission claim is unchanged

- **Statement:** The dispatch admission claim still decides its verdict inside the claim from the live lease it observes, still refuses a live same-ref lease under any holder with `queue.single-flight`, and still never renews and never adopts another invocation's lease. Every TDR-0050 clause stands except the one this record amends, which concerns the run path and not the claim.
- **Source:** prior decision (TDR-0050 DC-1, DC-2, DC-3, DC-5); AC (GH-413 §8.5; the plan's binding fence: only who renews and how often is added)
- **Verification:** test (the delivered single-flight and two-invocation interleaving controls stay green with no assertion change) + code review
- **Negotiable:** no

### C-3: Lease semantics are unchanged

- **Statement:** At most one live lease per repository; liveness is heartbeat age below the TTL, stale at or beyond it; a stale lease is takeable; a live lease on another ref refuses `queue.lease-conflict`; the sibling `queue claim` keeps its own-holder renewal. The TTL default does not move, and no configuration key is added.
- **Source:** prior decision (TDR-0050 C-3 and C-4; TDR-0026 C-5); AC (GH-413 DM-9, §8.5)
- **Verification:** test (the delivered lease suites as read-only controls) + code review
- **Negotiable:** no

### C-4: The heartbeat is confined to renewal

- **Statement:** The heartbeat is a no-op unless the lease is this lane's own same-ref lease. It never acquires an absent lease, never takes over a stale one, and never displaces another holder. Whatever the live lease records, the heartbeat appends nothing but a `renewed` record for the lease the lane holds.
- **Source:** AC (GH-413 F-5, DEC-13, DM-9, NFR-10); prior decision (TDR-0050 DC-3's rationale)
- **Verification:** test (a heartbeat with no live lease, with a lease on another ref, with a lease under another holder, and with a stale lease: each appends nothing) + code review
- **Negotiable:** no

### C-5: The heartbeat does not pass the owner-hold gate

- **Statement:** The renewal is not subject to the owner-hold precondition. A lane parked under an active owner hold keeps renewing, and the hold keeps its delivered meaning: it parks nothing, writes no park record, and still refuses the window-end resume admission until it clears.
- **Source:** AC (GH-413 F-5, F-11, DEC-13, NFR-10; AC-F5-2, AC-F11-1)
- **Verification:** test (a parked lane under an active hold keeps a heartbeat age below the TTL and is still refused resume admission until the hold clears)
- **Negotiable:** no

### C-6: One exclusion mechanism and one liveness definition

- **Statement:** The heartbeat is the delivered `queue.lease` record with operation `renewed`. No heartbeat record kind, lock file, process probe, or lane-state member becomes an input to exclusion or to lease liveness, and no schema, lease operation, or claim result is added.
- **Source:** AC (GH-413 DEC-13, DM-9, NFR-8; the plan's binding fence)
- **Verification:** test (the queue additivity, surface, and scheduling-contract inventories) + code review
- **Negotiable:** no

### C-7: Bounded, at a derived cadence

- **Statement:** The renewal cadence is `min(lane.liveness-interval, queue.lease-ttl / 2)`, derived from two delivered keys and never a key of its own. At most one renewal lands per renewal cadence and no more than one per wake, on the injected delay: no wall-clock read, no real timer in the engine, no busy-loop. Each renewal appends at most one record, and identical injected clock and delay inputs produce identical renewal records.
- **Source:** AC (GH-413 DEC-11, DEC-13, NFR-5, NFR-7, NFR-10)
- **Verification:** test (the renewal cadence equals the derived bound under default, long-interval, and short-TTL configurations; renewals per wake at most 1; the configuration key set unchanged; the paired-run determinism fixture)
- **Negotiable:** no

### C-8: A failure is never silent

- **Statement:** Every failed renewal is surfaced as bounded lease evidence, and a failed renewal is retried at the next cadence and only then. A lane never continues a park on a stale lease without that state being surfaced, and no surface reports a live lease the records do not show.
- **Source:** AC (GH-413 F-5, §10 "Lease evidence", NFR-10, RSK-10)
- **Verification:** test (the renewal-failure arm: each failure surfaced; the retry lands on the next cadence)
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
- **Contributors:** `@pm` (the remediation decision and the rejected alternative), `@spec-writer` (F-5, F-11, DEC-11, DEC-13, DM-9, NFR-7, NFR-10), `@readiness-reviewer` (iteration 1 finding 2, iteration 2 finding 3), `@plan-writer` (the claim path in scope), `@decision-advisor` (analysis, the executed probe, this record).
- **Required reviewers:** `@reviewer`, and the human owner (this record amends a delivered concurrency rule).
- **Performers:** `@coder` (the renewal entry and the run-path wiring), `@test-plan-writer` (the lease arms), `@doc-syncer` (the dispatch-engine and scheduling-engine pages).
- **Informed:** operators of native deliveries; the daemon supervision claim owner; the parallel-lanes and resident-mode work.

**Type note.** TDR. The architecture-level question, that exclusion is a repository-exclusive lease with heartbeat liveness, is delivered (TDR-0026) and is not reopened. This record changes who performs one delivered lease operation on one caller's run path, and on which cadence. It is R2 because it amends the rule of a delivered concurrency path that the ticket's AC3 rests on. It is not R3 because every fact is repo-local and read directly (and one path was executed), the change is reversible by removing the renewal, and no exclusion contract moves.

## Evidence, Assumptions & Unknowns

| Item | Label | Source | Impact if false | Confidence |
|------|-------|--------|-----------------|------------|
| Lease operations are the closed four; the TTL default is 90 000 ms and the production claim takes it; a lease is stale at or beyond the TTL | FACT | `contracts/queue.ts:33, 37`; `config/defaults.ts:82`; `cli/src/production.ts:4859-4866`; `domain/queue-lease.ts:50-51` (read 2026-11-26) | C-3 and the cadence arithmetic would rest on different numbers | High |
| The admission claim refuses a live same-ref lease under any holder and never renews | FACT | `app/queue.ts:2176-2188, 2343-2381`; TDR-0050 DC-2 and DC-3 | The amendment would reopen a rule that is not the delivered one | High |
| The same-holder `renewed` arm is delivered and preserves `acquiredAt` and `leaseId` | FACT | `app/queue.ts:2189-2211` | The heartbeat would need a new operation, which C-6 forbids | High |
| Called without its no-renewal flag, the claim primitive refuses an active owner hold, acquires an absent lease, and takes over a stale lease under another holder | FACT | `app/queue.ts:2090-2098, 2152-2171, 2217-2270` | C-4 and C-5 would be precautions without a cause | High |
| With the fixed holder, a re-dispatch renews the dispatch holder's own stale lease, a heartbeat renews a stale same-holder lease, a heartbeat after another invocation's claim lands on that invocation's lease, and a release by holder ends it | FACT (executed) | Probe over the delivered claim and release primitives on a throwaway store, 2026-11-26 | C-4 would be a theoretical precaution rather than a closed hole | High |
| The run path receives the `leaseId` at the claim and does not retain it; the release matches on holder only | FACT | `app/dispatch.ts:91, 811`; `app/queue.ts:2431` | The own-lease precondition would already be in place at no cost | High |
| The liveness cadence and the TTL are independent keys, each validated on its own, and neither is set on the reference host | FACT | `config/defaults.ts:78, 82`; `config/catalog.ts:693-695, 857-859`; `.jaiship/config.yaml` (tracked) | The derived cadence would be unnecessary | High |
| Each lease write appends one record, and each lease read takes the verified whole-store snapshot | FACT | `app/queue.ts:686-690, 710-711, 1998-2019` | Ledger growth would be free | High |
| The reference host pauses a lane for about 9 h 40 min a day, as two consecutive episodes | FACT | `.jaiship/config.yaml` (tracked); GH-413 spec RSK-13 | The park would be shorter and the renewal count lower | High |
| The renewal entry establishes "this lane's own" by more than the holder and the ref | TO-CONFIRM | GH-413 spec F-5 and DEC-13 state the rule; the plan's lease phase names the delivered same-holder arm | A woken invocation would renew, and on exit release, a successor's lease (the executed row) | Medium |
| A renewal lands close enough before each of the run's bounded waits | ASSUMPTION | The run path blocks for bounded periods with no observation (worktree provisioning, handle acquisition, the truth ladder, the ensure-push) | NFR-10's "throughout" would not hold across a wait longer than the TTL margin | Medium |
| The reference host keeps the two keys at their defaults | ASSUMPTION | `.jaiship/config.yaml` (tracked) sets neither | A non-default pair would exercise the derived bound in the first real episode | Medium |

## Mental Models & Techniques Used

- **First principles:** what makes single-flight true for a parked lane? One serialisation point (the claim under the fence), one liveness definition (heartbeat age below the TTL), and a live heartbeat for as long as the lane lives. The delivered system had the first two and lacked the third for a lane that waits.
- **Inversion:** how can a heartbeat look right and be wrong? It renews through the admission claim (the race reopens). It renews any same-ref lease under the constant holder (a successor's lease). It stops under an owner hold and lets the lease go stale. It runs on the liveness interval alone while that interval sits above the TTL. It busy-loops and floods the ledger. It fails silently and lets a live owner look gone.
- **5 Whys** (on "a second dispatch is admitted a TTL into a park"): the lease went stale, because nothing renewed it, because the dispatch path's only claim must refuse rather than renew to stay race-free (TDR-0050), because no renewal act existed that was not a claim, because no dispatch run was expected to sit idle for longer than a TTL. The fix adds the missing act and leaves the claim alone.
- **Second-order thinking:** a live lane's lease no longer goes stale after 90 s, which also closes the older exposure where a re-dispatch took over a running lane. The lease ledger grows by one record per cadence. And the release path's holder-only match becomes reachable in a new way when an invocation loses its lease and then ends.
- **Systems thinking:** claim, heartbeat, release, and takeover are one lease lifecycle with one identity problem, a constant holder. A change to one must be reviewed for the others.
- **Margin as a property of the cadence:** the distance from the heartbeat to the TTL is not a fixed safety factor; it is whatever the cadence leaves, so it must be derived from the TTL rather than assumed from the defaults.

## Alternatives Considered

### Per-Alternative Constraint-Compliance Evaluation

| | C-1 single-flight through run and park | C-2 admission claim unchanged | C-3 lease semantics unchanged | C-4 confined to renewal | C-5 outside the owner-hold gate | C-6 one mechanism | C-7 derived cadence | C-8 never silent |
|---|:---:|:---:|:---:|:---:|:---:|:---:|:---:|:---:|
| ALT-0 no renewal, declare the exposure | ❌ | ✅ | ✅ | — | — | ✅ | — | ❌ |
| ALT-1 a heartbeat record | ✅ | ✅ | ❌ | ✅ | ✅ | ❌ | ✅ | ✅ |
| ALT-2 raise the lease TTL | ❌ | ✅ | ❌ | — | — | ✅ | — | ❌ |
| ALT-3 a lock file | ✅ | ✅ | ✅ | ✅ | ✅ | ❌ | ✅ | ❌ |
| ALT-4 renew through the admission claim | ✅ | ❌ | ✅ | ❌ | ❌ | ✅ | ✅ | ✅ |
| ALT-5 heartbeat on the liveness cadence alone | ❌ | ✅ | ✅ | ✅ | ✅ | ✅ | ❌ | ✅ |
| ALT-6 selected: own-lease renewal at the derived cadence | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ |

Legend: ✅ = passes · ❌ = fails · — = not reached (the alternative has no renewal act that the constraint binds). All constraints are `Negotiable: no`, so no accepted-risk exception is claimed and any ❌ is disqualifying.

### Alternative 0 — Do Nothing: Keep the No-Renewal Rule and Declare the Exposure

- **Eligibility:** Not eligible (fails C-1 and C-8).
- **Summary:** Keep the delivered rule and narrow the promise: per-ref single-flight holds only while the lease is live, and the takeover of a parked lane is declared as a risk with its operator consequence. This was the readiness review's other option.
- **Constraint compliance:** Passes C-2, C-3, and C-6, because nothing changes. C-4, C-5, and C-7 are not reached. Fails C-1: for all but the first TTL of a park a second dispatch of the work item is admitted. Fails C-8: the invocation keeps waiting on a lease that is stale and says nothing.
- **Driver fit:** Serves drivers 4 and 7 only.
- **Pros:** Zero change, and no new act on the lease path.
- **Cons:** It fails ticket requirement 5 and AC3, as the specification's DEC-13 cites them: "no second session for the work item" cannot hold through a park, and the next dispatch a TTL in takes the ref.
- **Why rejected:** It narrows the ticket's single-flight promise to an interval the ticket does not recognise. A declared exposure is not a delivered promise.

### Alternative 1 — A Heartbeat Record

- **Eligibility:** Not eligible (fails C-3 and C-6).
- **Summary:** Keep the lease as delivered and record liveness beside it: a new heartbeat record, or a heartbeat member on the lane record, that the admission verdict reads as proof of life.
- **Constraint compliance:** C-4, C-5, C-7, and C-8 could be met. Fails C-3: liveness would then have two definitions, the lease's heartbeat age and the heartbeat record's age. Fails C-6: a new record kind or member is a second exclusion mechanism beside the lease.
- **Driver fit:** Serves driver 2 and fails drivers 4 and 7.
- **Pros:** The lease record and its TTL stay untouched.
- **Cons:** Two sources of truth for one question, and a read path that must reconcile them when they disagree.
- **Why rejected:** The lease already carries a heartbeat. A second one answers the same question with a new record.

### Alternative 2 — Raise the Lease TTL

- **Eligibility:** Not eligible (fails C-1 and C-3).
- **Summary:** Configure `queue.lease-ttl` above the longest declared window so a lease survives a park without renewal.
- **Constraint compliance:** C-4, C-5, and C-7 are not reached. Fails C-3: the TTL moves, and with it the recovery latency for a crashed lane. Fails C-1: no TTL bounds every park, because a window is declared rule data and can be longer than any default.
- **Driver fit:** Serves driver 6 and fails drivers 1, 3, and 7.
- **Pros:** One configuration value, and no renewal path.
- **Cons:** "A crashed session blocks a ref for no longer than the TTL" becomes hours. The admission fence wait is bounded by the same TTL (`app/queue.ts:2373`), so a refused dispatch could wait as long. And the first window longer than the TTL reopens the exposure.
- **Why rejected:** It trades a bounded recovery for an unbounded promise.

### Alternative 3 — A Lock File

- **Eligibility:** Not eligible (fails C-6 and C-8).
- **Summary:** Hold a lock file beside the worktree or the state directory for the park interval, as the exclusion for a parked lane.
- **Constraint compliance:** C-1 to C-5 and C-7 could be met. Fails C-6: a second exclusion mechanism beside the lease, in a file rather than in the state ledger. Fails C-8: a file cannot carry lease evidence, and a crashed owner leaves it behind with nothing to say so.
- **Driver fit:** Serves driver 1 and fails drivers 2, 4, and 5.
- **Pros:** Simple to reason about for one lane.
- **Cons:** It contradicts the delivered posture that the state ledger is the truth and the queue lease remains the exclusion mechanism. Stale-file detection becomes a second liveness definition.
- **Why rejected:** It buys single-flight with a second lock, which C-6 forbids.

### Alternative 4 — Renew Through the Admission Claim

- **Eligibility:** Not eligible (fails C-2, C-4, and C-5).
- **Summary:** Let the holding invocation re-run the admission claim, or call the claim primitive without its no-renewal flag, on each observation.
- **Constraint compliance:** C-1, C-6, C-7, and C-8 could be met. Fails C-2: the claim is the serialisation point TDR-0050 protects, and a claim that renews is the race it closed. Fails C-4: the primitive acquires an absent lease and takes over a stale one. Fails C-5: the primitive refuses an active owner hold before the fence, so a parked lane under a hold would stop renewing.
- **Driver fit:** Serves driver 6 and fails drivers 2, 4, and 7.
- **Pros:** One lease operation on the dispatch path, and no new entry.
- **Cons:** "A validated decision that the caller can satisfy by renewing is not a refusal" (TDR-0050). With the constant holder, every re-dispatch is such a renewal.
- **Why rejected:** It reopens the admission race to solve a run-path problem.

### Alternative 5 — Heartbeat on the Liveness Cadence Alone

- **Eligibility:** Not eligible (fails C-1 and C-7).
- **Summary:** Renew at each observation, on `lane.liveness-interval` and nothing else, which is the shape the specification's v1.1 proposed.
- **Constraint compliance:** C-2 to C-6 and C-8 could be met. Fails C-7: the cadence is not bounded against the TTL. Fails C-1: whenever the liveness interval is at or above `queue.lease-ttl`, the heartbeat reaches the TTL between wakes, the lease goes stale, and a second dispatch is admitted through the delivered same-holder arm.
- **Driver fit:** Serves drivers 6 and 7 at the defaults and fails driver 1 everywhere else.
- **Pros:** No arithmetic and no second cadence: the renewal is simply part of the observation.
- **Cons:** The invariant is true only for two defaults that nothing keeps in order. The reference host happens to run those defaults, which would hide the defect until the first operator tuned the liveness interval.
- **Why rejected:** It fails C-1 for a legal configuration. The bound is cheap, derived, and makes the promise true for every configuration.

### Alternative 6 — Selected: Own-Lease Renewal at the Derived Cadence

- **Eligibility:** Eligible (passes C-1 to C-8).
- **Summary:** The invocation that holds the lease renews it through the delivered same-holder `renewed` operation, at most once per renewal cadence and no more than once per wake, where the renewal cadence is `min(lane.liveness-interval, queue.lease-ttl / 2)`. The renewal is a no-op unless the lease is this lane's own same-ref lease, and it does not pass the owner-hold gate. The admission claim is untouched.
- **Constraint compliance:** C-1 by a heartbeat that cannot reach the TTL on any legal configuration; C-2 by leaving the claim untouched; C-3 by adding no key and moving no default; C-4 by the no-op rule; C-5 by staying outside the owner-hold gate; C-6 by using the delivered `renewed` record; C-7 by a cadence derived from two delivered keys; C-8 by surfacing every failure.
- **Driver fit:** Best on all seven drivers.
- **Pros:** The promise holds for every configuration. One exclusion mechanism and one liveness definition remain. The renewal can neither take a lease nor be starved by a hold.
- **Cons:** One more lease operation on the dispatch path, a growing renewal ledger, and an ownership question the constant holder forces the entry to answer.
- **Why chosen:** It is the only alternative that satisfies every constraint, and it composes what the repository already owns.

## Decision

- **Decision:** Adopt **ALT-6**.

### D1: Who renews: the holding invocation

The invocation that holds the lease renews it: the dispatch run path that acquired the lease at admission, from its first session to its terminal classification and through every park. The renewal is never performed by the admission claim, which keeps its delivered refusal and its delivered no-renewal rule (D6).

### D2: How often: the derived renewal cadence, and why the bound is required

- **The renewal cadence is `min(lane.liveness-interval, queue.lease-ttl / 2)`.** It is derived from two delivered keys and is never a key of its own. At most one renewal lands per renewal cadence and no more than one per wake, on the injected delay.
- **Why the bound is required.** Renewal on the liveness interval alone lets the heartbeat reach the TTL between wakes whenever that interval is at or above `queue.lease-ttl`. The lease is then stale, and a second dispatch of the work item is admitted through the delivered same-holder arm: the outcome this amendment exists to prevent. The two keys are independent, each is validated on its own, and nothing orders them, so the invariant must come from the cadence and not from the configuration. Halving the TTL is the widest cadence at which every successful renewal lands on a live lease with a margin at least equal to the cadence itself: the heartbeat age never exceeds half the TTL between successful renewals.
- **At the defaults nothing changes shape.** The bound is 45 000 ms and the liveness interval is 30 000 ms, so the renewal cadence is the observation cadence: one renewal at each observation and each park wake.
- **When the liveness interval exceeds half the TTL**, the heartbeat wakes at half the TTL, between observations, on the same injected delay. The observation cadence is unchanged: the wait still wakes at most once per delivered liveness cadence and re-derives the effective end (DEC-11).
- **It is not a second timing key.** No configuration is added. The bound is arithmetic over two delivered keys, evaluated where the cadence is consumed.

### D3: Through what: the delivered `renewed` operation

The renewal is the delivered same-holder `renewed` operation over the existing `queue.lease` record: one appended record carrying the lease identity and the acquisition instant it renews, with a new heartbeat. No lease operation, claim result, record kind, or schema is added, and the lease's scope, holder, and ref are never rewritten.

### D4: Confined to renewal: the no-op rule

- **The renewal is a no-op unless the lease is this lane's own same-ref lease.** It never acquires an absent lease, never takes over a stale one, and never displaces another holder.
- **Why the clause exists.** The delivered claim primitive, called without its no-renewal flag, does all three. The heartbeat is therefore not that call. It is an entry over the delivered `renewed` arm that refuses to act outside renewal, so a lane that holds nothing, a lane whose lease has gone to another holder, and a lane whose lease is stale each cause no write.
- **What "this lane's own" has to mean.** With a fixed holder the holder and the ref do not identify an invocation: the executed facts in Context show a re-dispatch renewing the first invocation's stale lease under the same identity. The entry must therefore establish ownership on more than `(holder, ref)`, for example on the lease record's latest write being the invocation's own. Otherwise the no-op rule holds in form and not in substance. The specification states the rule and leaves the key to delivery (Unresolved Questions).

### D5: Outside the owner-hold gate

- **The renewal is not subject to the owner-hold precondition.** A lane parked under an active owner hold keeps renewing.
- **Why.** The delivered claim primitive refuses an active owner hold before the fence. A heartbeat built on that call would stop renewing under a hold, and a hold has no declared end. The lane would sit parked on a lease going stale, and the first dispatch after the hold clears would be admitted to the ref while the lane's park record still stood.
- **The hold loses nothing.** It parks nothing, writes no park record, and still refuses the window-end resume admission until it clears, exactly as delivered (F-11). Only the heartbeat is exempt from it.

### D6: What is unchanged

- **The admission claim:** a live same-ref lease under any holder still refuses `queue.single-flight`, the verdict is still decided inside the claim, and the claim still never renews or adopts.
- **Repository exclusivity:** one live lease per repository; a live lease on another ref still refuses `queue.lease-conflict`.
- **The TTL and its default:** 90 000 ms, and stale at or beyond it.
- **The stale takeover:** a crashed or killed invocation renews nothing, so its lease still goes stale one TTL after its last heartbeat and the delivered takeover with its incident evidence still applies. "A crashed session blocks a ref for no longer than the TTL" stays true.
- **The sibling `queue claim`:** its own-holder renewal, its other-holder refusal, and its other-ref refusal are as delivered.
- **The release path and the daemon supervision claim:** both keep their delivered behaviour and are not amended here.
- **Vocabulary:** no new record kind, lease operation, claim result, schema identity, error identity, or configuration key.

### D7: The failure policy, and what the heartbeat means

- **A failed renewal is retried at the next cadence and only then.** Store-fence contention and state failures are transient; no retry lands inside the cadence and nothing busy-loops.
- **Every failure is surfaced as bounded lease evidence.** A failed renewal is never swallowed. The park never silently continues on a stale lease: the state is on the record, so a stale lease is explained rather than inferred.
- **The margin is a property of the cadence.** At the defaults one failed renewal leaves the heartbeat at two thirds of the TTL at the next attempt, and two consecutive failures bring it to the TTL at the attempt after that. At the widest cadence the bound permits, half the TTL, a single failed renewal brings it to the TTL at the next attempt. The bound guarantees the heartbeat for successful renewals; it does not make a lease survive failed renewals at the widest cadence.
- **What the heartbeat means.** The lease's heartbeat age is the liveness signal during a park. A live heartbeat means the waiting invocation is alive and will resume the lane at the recorded end. A stale lease during a park means the owner is gone.

### D8: The amendment, stated exactly

TDR-0050 DC-3 reads "The dispatch claim never renews; the sibling claim still does", and TDR-0050 C-4 restates it as "Only the dispatch claim refuses a live same-ref lease under any holder and never renews." This record amends both for the dispatch run path only, and they read:

> The dispatch **admission claim** never renews; the sibling claim still does. The invocation that holds the lease renews it after admission, at most once per renewal cadence (`min(lane.liveness-interval, queue.lease-ttl / 2)`), through the delivered same-holder `renewed` operation, as a no-op unless the lease is this lane's own same-ref lease and without passing the owner-hold gate (TDR-0078).

Nothing else in TDR-0050 moves. DC-1, DC-2, DC-4, and DC-5 and C-1, C-2, C-3, C-5, and C-6 stand verbatim: the verdict is still decided inside the claim, the refusal set is still declared and total, a refusal is still silent and clean, and the fence wait is still a wait. TDR-0050's own revisit triggers are not this amendment: the dispatch holder stays the fixed `dispatch` and still dispatches one ref at a time. TDR-0050 is amended, not superseded: its record, its number, and its status are untouched, and this record links to it rather than replacing it. The two current-truth sentences that carry the rule, "because both claim with a fixed holder and never renew mid-flight" and "The dispatch claim uses the fixed holder `dispatch` and never renews", are reconciled in the system-spec-update phase to name the admission claim.

**Authority and acceptance:** this is an R2 design record. Status is `Proposed` and `decision_date` is `null`. The human owner (Juliusz Ćwiąkalski) accepts or rejects it at the GH-413 pull request, together with TDR-0077 or separately. AI assistance analysed and wrote the record; the AI does not accept it, and no independent `@decision-critic` pass was run for it.

### Constraint Compliance Attestation

ALT-6 satisfies C-1 to C-8: a heartbeat at the derived cadence cannot reach the TTL on any legal configuration, so single-flight holds through the run and the park (C-1); the admission claim is untouched (C-2); no lease semantic, default, or key moves (C-3); the renewal is a no-op outside the lane's own same-ref lease (C-4); it does not pass the owner-hold gate (C-5); it is the delivered `renewed` record and no second mechanism (C-6); it runs at most once per renewal cadence on the injected delay (C-7); and every failure is surfaced (C-8). No accepted-risk exceptions are claimed. One clause, C-4, is satisfied only if the renewal entry establishes "this lane's own" by more than the holder and the ref; the specification states the rule and the plan names the arm, and the key is left to delivery. That is recorded as the first Unresolved Question rather than attested as settled.

## Trade-offs & Consequences

### Positive Outcomes

- Single-flight holds for the whole park, on every legal configuration of the two keys: no takeover of a parked lane and no second session for the work item.
- The older run-phase exposure closes with the same heartbeat: a live lane's lease no longer goes stale after 90 s, so a re-dispatch of a running work item is refused while its invocation lives.
- One exclusion mechanism and one liveness definition remain: the lease and its heartbeat age.
- The heartbeat can neither take a lease nor be starved by an owner hold.
- Every renewal is a delivered lease record on the ledger, so liveness is readable without a new surface.

### Negative Outcomes

- **The lease ledger grows.** One record lands per renewal cadence per live lane: about 480 for a four-hour park, and about 1 160 for the reference host's two consecutive episodes at the default cadence. Every lease read takes the verified whole-store snapshot.
- **The margin shrinks with the cadence.** At the widest cadence a single failed renewal brings the heartbeat to the TTL at the next attempt.
- **A live invocation holds its work item for as long as it lives**, including a parked one. An operator cannot take over a parked lane by dispatching again; the delivered operator resume path is the route.
- **Two lease operations live on the dispatch path.** The claim refuses and the heartbeat renews, and a change to the claim must be reviewed for the heartbeat. With a fixed holder, "renew" and "release" are not ownership-safe by themselves (D4).
- **The published stale-takeover row describes a lease held by another holder.** A re-dispatch of the dispatch holder's own stale lease is recorded as `renewed`, with no takeover evidence. This is pre-existing, is surfaced by this record, and is not changed by it.

### Unresolved Questions

- [ ] How the renewal entry establishes "this lane's own". The holder and the ref do not identify an invocation under the fixed `dispatch` holder, and the lease identity is preserved across a re-dispatch. Name the key, and say whether a lease that has gone stale but was not taken still counts as the lane's own. (owner: `@coder` with `@plan-writer`, the plan's lease phase)
- [ ] What a no-op renewal surfaces, and whether the invocation resumes a session on a lease it no longer holds. The specification states the no-op rule and the retry policy for failures, not the outcome when the lease is not the lane's own at resume admission. (owner: `@spec-writer`)
- [ ] Renewal points around the run's bounded waits. Provisioning, handle acquisition, the truth ladder, and the ensure-push each block the run for a bounded period with no observation. NFR-10's "throughout" holds only if a renewal brackets a wait that is long against the TTL margin. (owner: `@coder` with `@plan-writer`)

## Implementation Plan

1. **The renewal entry.** One entry for the dispatch caller over the delivered same-holder `renewed` arm, confined to renewal (a no-op otherwise) and outside the owner-hold gate. The admission claim is not modified.
2. **Run-path wiring.** The invocation keeps what it needs to recognise its own lease from its claim, renews at the derived cadence at each observation and at each wake of the park wait, and stops renewing when the lease is no longer its own.
3. **Failure surfacing.** Each failed renewal is bounded lease evidence, and the retry lands on the next cadence.
4. **Fixtures.** The lease arms before, at, and after each TTL boundary in a default and an interval-above-TTL configuration; the owner-hold case; the no-op cases; the renewal-failure arm; and the delivered lease suites and the admission interleaving as read-only controls.
5. **Documentation.** The dispatch-engine page's two sentences and the queue reference page name the admission claim. The operations guidance states that the heartbeat age is the parked lane's liveness signal.

## Verification Criteria

- A park that outlasts the TTL several times, default configuration: heartbeat age below the TTL at every observation; renewals at most 1 per cadence; a second dispatch refused `queue.single-flight` with the live holder before, at, and after each boundary; takeovers 0; second sessions 0.
- The same park with `lane.liveness-interval` at or above the TTL: the renewal cadence equals half the TTL, and the heartbeat age stays below the TTL.
- A parked lane under an active owner hold: keeps renewing, with a heartbeat age below the TTL; resume admission still refused until the hold clears.
- The admission claim: the delivered single-flight and interleaving controls pass with no assertion change; `renewed` records attributable to an admission claim: 0.
- `queue claim` by its own holder on its own live lease: still `renewed`; the other-holder and other-ref refusals unchanged.
- Renewals that acquire an absent lease, take over a stale lease, or displace another holder: 0.
- Renewal failures surfaced: 100%; retries inside the cadence: 0.
- New record kinds, lease operations, claim results, schema identities, configuration keys: 0.
- `renewed` records for one lane over an interval: at most elapsed time divided by the renewal cadence, plus 1.
- Paired runs over the injected clock and delay: identical lease records.

## Confidence Rating

**Medium.** The delivered facts are read directly and one path was executed: the claim's refusal, the `renewed` arm, what the claim primitive does without its flag, the two independent keys, and the ownership gap the constant holder creates. The cadence bound is arithmetic over those facts and holds for every legal configuration. What lowers the confidence is that the own-lease rule is stated and not yet keyed: the specification names the rule, the plan names the delivered arm, and the delivered arm alone does not distinguish one invocation from another. The in-change fixtures prove the cadence and the single-flight arms; the ownership arm is proven only once the key is named.

## References

- Change specification: `doc/changes/2026-11/2026-11-26--GH-413--peak-pausing-dispatch-lane/chg-GH-413-spec.md` (v1.2): §2.1 and §2.2 (the lease gap), §5.1 F-5 and F-11, §6 Flow 5, §7.1, §8.3 DM-9, §8.5, §9 NFR-7 and NFR-10, §10, §11 RSK-10 and RSK-13, §12 "Lease renewal", §15 DEC-11 and DEC-13, §18, §22, §24 Appendix D.
- Change plan: `doc/changes/2026-11/2026-11-26--GH-413--peak-pausing-dispatch-lane/chg-GH-413-plan.yaml`, the lease-liveness phase and the binding fence that only who renews and how often is added.
- Definition-of-Ready reviews: `doc/changes/2026-11/2026-11-26--GH-413--peak-pausing-dispatch-lane/readiness-review/readiness-iter-1.md` (finding 2) and `readiness-iter-2.md` (finding 3).
- Ticket: GH-413, requirement 5 and AC3 as the specification's DEC-13 and acceptance-criteria traceability cite them; the ticket body was not read for this record.
- Amended decision: [TDR-0050](TDR-0050-dispatch-atomic-admission-verdicts.md), DC-3 and its restatement in C-4.
- Prior decisions: [TDR-0026](TDR-0026-queue-lifecycle-removal-single-flight.md) (the repository-exclusive lease and the narrowed same-holder renewal); [TDR-0049](TDR-0049-dispatch-owned-durable-lane-record.md) (the lane the lease protects); [TDR-0052](TDR-0052-in-process-bounded-restart-loop.md) (the run whose iterations the heartbeat spans).
- Companion record: [TDR-0077](TDR-0077-dispatch-owned-window-watch.md) (the dispatch-owned window watch whose park this heartbeat keeps single-flight).
- Current truth: [Dispatch Engine](../spec/features/feature-dispatch-engine.md) (the one-shot run order, the per-ref single-flight admission, bounds and configuration); [Scheduling Engine](../spec/features/feature-scheduling-engine.md); [Provider Peak Pausing](../spec/features/feature-peak-pausing.md).
- Code and contracts (read 2026-11-26): `packages/core/src/contracts/queue.ts`; `packages/core/src/app/queue.ts`; `packages/core/src/app/dispatch.ts`; `packages/core/src/domain/queue-lease.ts`; `packages/core/src/config/defaults.ts`; `packages/core/src/config/catalog.ts`; `packages/cli/src/production.ts`; `.jaiship/config.yaml` (tracked).
