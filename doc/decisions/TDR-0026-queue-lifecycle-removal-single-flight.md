---
id: TDR-0026
decision_type: tdr
status: Proposed
created: 2026-11-12
decision_date: null
last_updated: 2026-11-12
summary: "Complete the queue lifecycle on the delivered append-only ledger: a new `queue.removal` record kind (`delivery.queue.removal.v1`, key `queue.removals:<REF>`) whose ledger append position against the entry record decides presence, with one of the four closed reasons `landed | abandoned | superseded | reconciled`, and `queue release` kept as lease release; a path-specific per-ref single-flight policy over live lease truth — the dispatch family's admission refuses any live lease whose recorded ref is the requested ref, same or different holder, with `queue.single-flight` (exit 1, root `detail.holder`), while `queue claim` keeps its own-holder same-ref renewal, refuses another holder's same-ref lease with the same identity, and refuses a lease on another ref with the delivered `queue.lease-conflict` — with the repository-exclusive lease, its TTL, and its stale takeover intact and renewal narrowed to one `(repository, ref, holder)`; removal refused while the ref's lane lease is live (`queue.precondition.unmet`, blocking reason `lease-held`) and never cascading to dependents or rewriting edges; reconcile staleness fixed to the tracker's normalised `deliveryState` of `done`/`canceled`, with an unreadable read refusing under the provider's own identity and removing nothing; and exactly two new error identities with the five delivered queue rows left byte-identical, and the M2 queue page reconciled to the delivered names instead of duplicating them."
owners: ["Juliusz Ćwiąkalski"]
service: "delivery-os queue lifecycle (queue ledger fold, dispatch admission, closeout transaction, event taxonomy)"
decision_scope: repo
review_date: null
business_impact: "A landed, abandoned, or superseded change stops occupying the queue, dependency edges become editable in both directions, and a duplicate dispatch on one ref is refused before a session starts — without a hand edit of durable state."
customer_impact: "An operator gains `queue remove --reason`, `queue dep add|remove`, and `queue reconcile`; an agent that dispatches twice on one ref receives a classified `queue.single-flight` refusal naming the holder instead of starting a second session; a `queue.graph` subscriber starts receiving the declared `remove` kind. One workflow changes behaviour: a same-holder claim for a second ref in one repository is refused with `queue.lease-conflict` instead of renewing and rewriting the lease's ref."
classification:
  domains: [contracts, architecture, tooling]
  archetype: design
  environment: complicated
  rigor: R2
  reversibility: moderate
  stakes: medium
  urgency: medium
  uncertainty: low
  blast_radius: team
  recurrence: one-off
governance:
  driver: "@decision-advisor (GH-292: the specification routes its two open operator-policy questions here; the record is authored before dependent delivery)"
  decider: "Juliusz Ćwiąkalski — human acceptance at the GH-292 PR review; AI does not accept this R2 record"
  contributors:
    - "@pm (GH-292 clarify_scope: ticket scope authority and the release-versus-remove split)"
    - "@spec-writer (GH-292 specification: DEC-1..DEC-15, DM-1..DM-8, EVT-1..EVT-3)"
    - "@decision-advisor (repository analysis and this record)"
  reviewers:
    - "@readiness-reviewer"
    - "@reviewer"
    - "Human owner (GH-292 PR review — this record fixes queue record-kind, error-identity, and event-producer contracts)"
  performers:
    - "@coder (GH-292: removal record and presence rule, dependency-edge removal, admission policy and renewal narrowing, closeout removal block, reconcile, event producer, help and reference pages)"
    - "@doc-syncer (GH-292 documentation phase: scheduling-engine, dispatch-engine, closeout, and event-taxonomy feature specs)"
  informed:
    - "M2-S16 engine-first operations and M2-S18 queue/lane representation (consume a queue whose landed entries retire and whose edges are editable)"
    - "M2-S19 cross-repository change plan shape (per-member release and removal rules)"
    - "Any `queue.graph` subscriber (the declared `remove` kind gains a producer)"
    - "Operators and agents that dispatch on a ref (the same-holder second-ref claim becomes a refusal)"
ai_assistance:
  used: true
  roles: [repository-analyst, analyst, record-writer]
  external_data_shared: false
  citations_verified: true
  human_decider: null
  reviewers: []
revisit_triggers:
  - "Operators report that `abandoned mid-run` is a real workflow and a live-lease removal is needed: reopen DC-4's refusal and decide an explicit two-authority path (release-and-remove, or a force flag) rather than making removal release a lease implicitly."
  - "Operators report that removing a producer and leaving consumers held `dependency-unobserved` is the wrong default: reopen DC-4's no-cascade rule and add a named refusal or a cascade as a contract change with its own identity."
  - "The tracker's normalised `deliveryState` stops being a sufficient staleness fact (for example a tracker kind with no read surface, or a `done` state that precedes the merge): reopen DC-5 before widening staleness to any other signal."
  - "A fifth removal reason is needed, or a free-text reason is requested: reopen DC-1's closed vocabulary as a contract change; never accept an unclassified reason into the ledger."
  - "A consumer needs removal history (reasons and timestamps over a window): add a read surface over the persisted `queue.removals:` prefix; do not overload `queue list` or the derived document."
  - "A same-holder, same-ref renewal needs to survive a ref rename, or a repository needs concurrent refs by one holder: reopen DC-3 and the repository-exclusive lease scope together, because the dispatch refusal's enforceability depends on the narrowing."
  - "Removal must be idempotent on the explicit verb (`queue remove` of an absent or removed ref succeeding): reopen DC-4's convergence rule; today the explicit verb refuses and the automatic closeout path converges."
  - "A `queue.graph` frame must carry a removal field beyond `ref`, `reason`, `recordedAt`: that is a taxonomy payload-field change with its own version discipline (TDR-0025 DC-5), not an edit inside v1."
links:
  related_changes: ["GH-292", "GH-237", "GH-238", "GH-239", "GH-240", "GH-290"]
  supersedes: []
  superseded_by: []
  spec:
    - "doc/changes/2026-11/2026-11-12--GH-292--queue-lifecycle/chg-GH-292-spec.md"
    - "doc/spec/features/feature-scheduling-engine.md"
    - "doc/spec/features/feature-dispatch-engine.md"
    - "doc/spec/features/feature-closeout.md"
    - "doc/spec/features/feature-event-taxonomy.md"
    - "doc/planning/oss-tooling/milestones/m2/contracts.md"
    - "doc/planning/oss-tooling/milestones/m2/commands/queue.md"
    - "doc/planning/oss-tooling/milestones/m2/test-scenarios.md"
    - "doc/planning/oss-tooling/milestones/m1/commands/queue.md"
  contracts:
    - "packages/core/src/contracts/queue.ts"
    - "packages/core/src/contracts/taxonomy.ts"
    - "packages/core/src/contracts/error-table.ts"
    - "packages/core/src/contracts/ports.ts"
    - "packages/core/src/contracts/closeout.ts"
    - "packages/core/src/domain/queue-graph.ts"
    - "packages/core/src/app/queue.ts"
    - "packages/core/src/app/dispatch.ts"
    - "packages/cli/src/commands/queue.ts"
    - "packages/cli/src/help.ts"
  diagrams: []
  decisions: ["TDR-0004", "TDR-0005", "TDR-0023", "TDR-0025", "TDR-0027"]
  experiments: []
  metrics: []
  roadmap_items: ["M2-S15", "M2-S16", "M2-S18", "M2-S19"]
---

# TDR-0026: Queue Lifecycle Completion — Append-Only Removal Kind with Append-Position Presence, Path-Specific Per-Ref Single-Flight over Repository-Exclusive Lease Truth, Narrowed Same-Holder Renewal, Non-Cascading Removal, and Tracker-Delivery-State Staleness

## Context

- **FACT:** The queue ledger declares exactly five record kinds with their payload schemas and key prefixes: `queue.entry` (`delivery.queue.entry.v1`, `queue.entries:`), `queue.dependency` (`delivery.queue.dependency.v1`, `queue.deps:`), `queue.lease` (`delivery.queue.lease.v1`, `queue.leases:`), `queue.park` (`delivery.queue.park.v1`, `queue.parks:`), and `queue.incident` (`delivery.queue.incident.v1`, `queue.incidents:`), plus the rebuildable derived document `queue-graph.json` (`delivery.queue.graph.v1`) (`packages/core/src/contracts/queue.ts:292-315`; the declaration list with identity fields and closed vocabularies at `queue.ts:371-457`). *(read 2026-11-12)*
- **FACT:** Every queue read is prefix-, kind-, and schema-scoped: `readQueueEntries`, `readQueueDependencies`, `readQueueLeases`, and `readQueueParks` each pass a `prefix`, `kind`, and `schema` to `readRecords` (`packages/core/src/app/queue.ts:465-516`). A record under a new prefix and kind is therefore invisible to every delivered fold. *(read 2026-11-12)*
- **FACT:** The entry fold is latest-record-wins with no presence predicate beyond "an entry record exists": `foldQueueGraph` folds the latest entry record per ref and the latest dependency record per ref, then builds entries from the entry map (`packages/core/src/domain/queue-graph.ts:226-255`). Dependency edges are retained when the producer has no entry, so readiness can report `dependency-unobserved` (`queue-graph.ts:211-216`). *(read 2026-11-12)*
- **FACT:** `queue release` is lease release and never removes: `QueueReleaseResult.result` is `"released" | "parked" | "noop"` (`packages/core/src/app/queue.ts:957`), and the paths that return `released` and `parked` append a lease record and, for a park, a park record (`queue.ts:1373`, `queue.ts:1425`). *(read 2026-11-12)*
- **FACT:** The lease is keyed by repository and a live lease re-claimed by the **identical holder** is renewed with the **requested** `ref`: the claim folds live leases at most one per repository, takes over a stale lease with a `lease-stale-takeover` incident, and, when `existing.holder === request.holder`, appends a `renewed` record built from the request's `ref` (`packages/core/src/app/queue.ts:1214-1240`). *(read 2026-11-12)*
- **FACT:** Dispatch admission orders the optional preflight, then the lease claim, then spawn or resume: a preflight refusal is pre-session and appends no record, and a claim refusal returns the claim's `kind: "queue"` code (`packages/core/src/app/dispatch.ts:476-492`; the port contract at `dispatch.ts:160-178`). *(read 2026-11-12)*
- **FACT:** The queue command family mounts `ready`, `list`, `plan`, `add`, `prioritize`, `dep`, `claim`, and `release`; `dep` requires exactly two canonical refs and calls the add mutation, and no `remove` or `reconcile` subcommand exists (`packages/cli/src/commands/queue.ts:381-436`). *(read 2026-11-12)*
- **FACT:** The `queue dep` help entry prints the synopsis `queue dep <ref> --on <ref>` and a `--dep` example, while the delivered grammar accepts two positionals and no `--on` flag (`packages/cli/src/help.ts:156-158`; grammar at `packages/cli/src/commands/queue.ts:412-419`). *(read 2026-11-12)*
- **FACT:** The event taxonomy declares `queue.graph` with four kinds and marks `remove` `emitted: false` with payload fields exactly `ref`, `reason`, `recordedAt` (`packages/core/src/contracts/taxonomy.ts:121-151`, the `remove` kind at `taxonomy.ts:146-150`). *(read 2026-11-12)*
- **FACT:** The `queue` error domain carries exactly five identities — `queue.dependency-cycle`, `queue.lease-conflict`, `queue.park-condition-stuck`, `queue.entry.unobserved`, `queue.precondition.unmet` (`packages/core/src/contracts/queue.ts:461-468`) — and all five project to exit `1` through `user-validation` rows in the error table (`packages/core/src/contracts/error-table.ts:1179-1235`). The queue domain has no exit-`2` identity; an unreadable store is classified by the `state.*` rows. *(read 2026-11-12)*
- **FACT:** The tracker read normalises native status into the closed alias set `backlog | ready | in-progress | in-review | done | canceled` (`packages/core/src/contracts/ports.ts:50-57`). *(read 2026-11-12)*
- **FACT:** The closeout transaction's `data` carries additive non-step blocks `telemetryCapture`, `residue`, and `capsule` and no queue block (`packages/core/src/contracts/closeout.ts:404-433`); the declared step list carries `capsule` as a step id (`closeout.ts:56`). *(read 2026-11-12)*
- **FACT:** The M2 queue page names `queue.entry-unknown` (exit 1) and `queue.state-unavailable` (exit 2) as queue error identities (`doc/planning/oss-tooling/milestones/m2/commands/queue.md:118-119`), which duplicate the delivered meanings of `queue.entry.unobserved` and the `state.*` family. *(read 2026-11-12)*
- **FACT:** The M2 contract section fixes the shapes this record decides: lease release stays and takes no removal reason; entry removal carries one of four reasons and an unqualified removal is refused with `queue.reason-missing`; a squash merge plus closeout removes the entry with reason `landed`; `dep <ref> <on-ref>` stays the two-positional add with `dep add`/`dep remove` as its explicit grammar and a recomputed ready set; one active lane per ref across every dispatch path with a classified refusal naming the holder; stale entries reconcile against tracker truth without editing state files; and `queue.graph` declares `remove` with `emitted: false` because no v1 path produces it (`doc/planning/oss-tooling/milestones/m2/contracts.md` §Queue lifecycle mutations, §Event taxonomy v1). *(read 2026-11-12)*
- **Why now:** GH-292 (M2-S15) is the story that closes the lifecycle. The queue only grows, the graph is write-only in its edge direction, and two dispatch entry paths against one ref can both start a session. Three M2 stories after it — S16, S18, S19 — assume a queue whose entries retire and whose edges are editable, so the record-kind, identity, and event-producer shapes are fixed here rather than discovered per story.

## Problem Framing (Clarified)

"Add removal, single-flight, and reconcile" hides five separable questions. Each, answered wrong, produces a contract that looks complete and cannot be honoured:

1. **How does an entry leave a ledger that never loses a record?** Presence is currently inferred from the existence of a declaration record. Retirement therefore has no representation at all, and the only alternative to hand-editing state is to invent one. The representation choice also fixes whether a re-declared ref can come back and whether a historical store needs a migration.
2. **Where does "one ref runs once" belong, given that the lease is repository-wide and renewal is holder-identical?** The observed defect is a *second session on one ref*: the dispatch path claims with the fixed holder `dispatch`, so a second dispatch on that ref is a same-holder renewal and proceeds. A second hazard sits beside it: a same-holder claim for a *different* ref renews and rewrites the lease's `ref`, after which the first ref's guard sees no matching ref. The answers are therefore path-specific — a refusal at dispatch admission, and a renewal rule that never crosses refs — rather than one predicate imposed on every caller.
3. **What may a removal do to a running lane, an active park, and a dependent?** A removal is a state transition that can orphan a session, leave a park evaluating a ref that no longer exists, or strand a consumer behind a producer that is gone. Each of those is a separate authority question, and each answer adds or avoids a refusal identity.
4. **What fact makes an entry stale, and what happens when that fact is unavailable?** "Stale" can be defined by tracker state, by labels, by age, or by an absent item. Only one of those is both auditable and already normalised by the read surface, and a read that fails must not manufacture a removal.
5. **How many identities does the refusal set cost?** A refusal set can be enumerated per verb, or assembled from identities that already mean the same thing. The first grows the error table with synonyms; the second keeps one identity per meaning and reconciles the page that duplicates them.

Root cause versus symptom. The ledger models *declaration* and *lease truth* and has no vocabulary for *retirement*; that is why nothing leaves. The lease models *repository* exclusivity while the duplicate is per *ref*, and renewal is keyed on the holder rather than on `(repository, ref, holder)`; that is why a second session is reachable and why a second ref can take the lease's name. The taxonomy declares a `remove` kind that no producer exists for; that is why the declared kind is unemittable. The M2 page names identities that duplicate delivered meanings; that is why the page and the table disagree. The desired outcome is one retirement representation with one total order for presence, one path-specific admission policy that closes both duplicate-session hazards, one truthful set of refusal identities that leaves the delivered rows untouched, and one staleness fact.

Out of scope, recorded so the boundary is deliberate: automatic reconciliation on a timer, in the daemon loop, or inside closeout (reconcile is an operator invocation, and closeout performs only the `landed` removal); cascading or edge-rewriting removal; widening the lease from repository-exclusive to per-ref; a tracker write surface; new `queue.graph` kinds, payload fields, or a taxonomy version bump; new removal reasons; a removal-history read verb; and any new package, workspace subpath, provider adapter, or state schema version.

## Constraints (Hard Requirements)

### C-1: Presence is derived without reinterpreting a delivered record

- **Statement:** No record is deleted or rewritten by any removal path, and each delivered payload (`delivery.queue.entry.v1`, `delivery.queue.dependency.v1`, `delivery.queue.lease.v1`, `delivery.queue.park.v1`, `delivery.queue.incident.v1`) keeps its delivered field set and meaning. Retirement is represented by an appended record, and the fold's presence predicate is the only place an entry stops being present.
- **Source:** prior decision (append-only ledger and state discipline, TDR-0004) + AC (GH-292 §17.1 AC-F1-1, AC-F1-7)
- **Verification:** test (append-only assertion over the record set; re-declaration restores the entry; a store with no removal records folds to the identical derived document) + code review
- **Negotiable:** no

### C-2: `queue release` keeps its delivered meaning

- **Statement:** `queue release` releases a lane's lease, may append a park, returns `released | parked | noop`, and takes no removal reason; it never removes an entry. Removal is a distinct verb.
- **Source:** contractual (`doc/planning/oss-tooling/milestones/m2/contracts.md` §Queue lifecycle mutations — lease release stays) + AC (GH-292 §8.5)
- **Verification:** test (release leaves the entry present and returns its delivered vocabulary; no removal reason is accepted by the grammar)
- **Negotiable:** no

### C-3: Removal always carries one of four reasons, and an unqualified removal is refused

- **Statement:** An applied removal records exactly one reason from the closed set `landed | abandoned | superseded | reconciled`. A removal without a reason is refused with `queue.reason-missing` at exit `1` and appends nothing; a reason outside the set, or a missing flag value, is a grammar refusal at exit `1` and appends nothing.
- **Source:** contractual (§Queue lifecycle mutations — entry removal carries a reason; unqualified removal refused with `queue.reason-missing`) + AC (GH-292 AC-F1-2, AC-F1-3)
- **Verification:** test (each reason accepted; missing and out-of-vocabulary reasons refused with zero appends) + code review
- **Negotiable:** no

### C-4: One active lane per ref, refused with a classified error naming the holder, with path-specific outcomes

- **Statement:** A ref with an active lane never admits a second session. On the dispatch family — `dispatch run` and a composed daemon lane supervision claim — a live lease whose recorded ref is the requested ref is refused with `queue.single-flight` at exit `1`, root `detail.holder` naming the live holder, zero appended records, and no session, whether the holder identity matches or not. On `queue claim`, the delivered outcomes are preserved and holder-aware: a live same-ref lease under the caller's own holder renews without a session, a live same-ref lease under another holder is refused with the same identity and `detail.holder`, and a live lease on another ref is refused with the delivered `queue.lease-conflict`. Every refusal appends nothing, publishes nothing, and starts nothing.
- **Source:** contractual (§Queue lifecycle mutations — single-flight) + AC (GH-292 AC-F4-1, AC-F4-2, AC-F4-3, AC-F4-5, AC-F4-6; SC-M2-S15-02)
- **Verification:** test (per path: outcome per the DC-2 table, `detail.holder`, zero records, zero sessions, state comparison before and after; the two delivered direct-claim controls stay green with no assertion change)
- **Negotiable:** no

### C-5: The repository-exclusive lease keeps its scope, TTL, and takeover rule

- **Statement:** The lease is keyed by repository and admits at most one live holder per repository; liveness is heartbeat age below the lease TTL; a stale lease is taken over with its incident evidence; the stale-takeover path is not a refusal. Repository exclusivity holds for a same-holder claim as for any other.
- **Source:** AC (GH-292 §7.2 — no per-ref lease scope; AC-F4-4, AC-F4-5) + prior decision (delivered queue lease ledger, M1-S17/GH-237)
- **Verification:** test (stale takeover unchanged; a same-holder claim for another ref refuses; the live lease's recorded `ref` is unchanged by any refusal)
- **Negotiable:** no

### C-6: Exactly two new error identities, and the five delivered rows stay byte-identical

- **Statement:** The change adds exactly `queue.reason-missing` and `queue.single-flight` to the queue domain, both projecting to exit `1`; every other refusal resolves to a delivered identity (`queue.entry.unobserved` for an unknown ref, `queue.precondition.unmet` for a blocked precondition, `queue.lease-conflict` for a lease conflict, `queue.dependency-cycle` for a cycle, `input.value.rejected` for grammar) or, for an unreadable store or tracker, to the `state.*` / `provider.*` families. The five delivered queue rows stay byte-identical: no delivered row's code, category, retryable flag, consequence, projection class, exit, summary, or remediation hint changes.
- **Source:** prior decision (exit taxonomy and projection classes, TDR-0005) + AC (GH-292 AC-F7-3, AC-F5-4, AC-NFR-6; `queue` rows 5 → 7)
- **Verification:** test (queue error-row inventory equality; each new failure path resolves to a declared row and its projection class's exit) + code review
- **Negotiable:** no

### C-7: The event taxonomy's declared shape is unchanged and `remove` gains a producer

- **Statement:** The `queue.graph` kind set (`entry`, `dependency-edge`, `release`, `remove`), each kind's payload field list, the seven-field envelope, the `taxonomyVersion` stamp, the per-`(topic, lane)` ordering rule, and the overflow policy are unchanged. `remove` becomes emitted with exactly `ref`, `reason`, and `recordedAt`; `dependency-edge` covers edge removal through its declared `removed[]`. No event is published for a refused mutation, a `noop`, or a skipped automatic removal.
- **Source:** contractual (§Event taxonomy v1) + prior decision (TDR-0025 DC-1, DC-2, DC-5) + AC (GH-292 AC-F6-1..4)
- **Verification:** test (emitted-payload-key equality per emitted kind; non-emitted set empty; zero events on refusal and noop; sequence monotonic per `(topic, lane)`)
- **Negotiable:** no

### C-8: Reconcile is read-only, bounded, and removes nothing on unreadable or absent truth

- **Statement:** Reconciliation reads tracker truth only through the declared credential port, performs at most one bounded read per examined entry with no retry, no pagination, and no concurrent read, examines at most the declared cap of 100 entries reporting truncation beyond it, and removes an entry only on a positive `deliveryState` of `done` or `canceled`. An unreadable read refuses under the provider's own classified identity and removes nothing; an item the tracker does not have is retained and reported unobserved. No tracker write occurs.
- **Source:** AC (GH-292 AC-F5-4, AC-F5-6, AC-F5-7, AC-NFR-4, AC-NFR-5) + spec NFR-8/NFR-9
- **Verification:** test (read-count bound; unreadable and not-found cases append zero records; credential is never printed; no write path exists)
- **Negotiable:** no

**Table stakes.** C-9 (no new package, workspace subpath, provider adapter, or state schema version) is satisfied by every alternative below and therefore eliminates none of them; it is recorded once here rather than per alternative. The removal kind extends the existing queue ledger inside the delivered `packages/core` contracts, and reconcile reuses the delivered tracker read.

## Decision Drivers

1. **Append-only truth (the expensive invariant).** The ledger's discipline — append, never rewrite, never hand-edit — is what makes every history auditable and every rollback harmless. A retirement representation that keeps that discipline costs nothing at read time and cannot corrupt a store.
2. **One meaning per identity and per verb.** A refusal set assembled from synonyms, or a verb that both releases a lease and retires an entry, makes an operator's action ambiguous and makes a consumer's exhaustiveness impossible.
3. **Truthful graph state.** A removed producer must not silently disappear from a consumer's edge set; the held state must be the truthful one and visible, so the operator's next action is evidence-driven rather than guessed.
4. **Duplicate-session prevention that holds where a session can start.** A second *dispatch* on a ref must be refused on every dispatch path, and a claim from outside the holder must be refused rather than renewing another lane's lease; the holder's own same-ref re-claim is a renewal, not a second session. A policy that refuses that renewal breaks the delivered claim contract without preventing any session.
5. **Additive boundary and reversibility.** No state rewrite, no schema version, no new package, no new vendor; a reverted binary reads a store with removal records without failing.
6. **Fair failure classification.** Every new refusal resolves to a declared identity and the exit its projection class yields, so an operator or agent can act without reading state, and no exit digit is invented.
7. **Solo-maintainer cost and the paved road.** One new record kind with one presence predicate, one admission predicate, one additive closeout block, one emitted kind, and two rows — no second ledger, no new store, no new contract store.

## Decision Rights (DACI)

- **Driver:** `@decision-advisor` — GH-292's specification routes its two open operator-policy questions (live-lease removal; producer removal without cascade) here, and this record is authored before dependent delivery.
- **Decider / Approver:** Juliusz Ćwiąkalski — human acceptance at the GH-292 PR review. AI does not accept this R2 record and grants no authority until then.
- **Contributors:** `@pm` (ticket scope authority; the release-versus-remove split), `@spec-writer` (the specification's DEC-1..DEC-15 and DM/EVT shapes this record binds), `@decision-advisor` (repository analysis and record).
- **Required reviewers:** `@readiness-reviewer` and `@reviewer` on GH-292; the owner for final acceptance of this record.
- **Performers:** `@coder` — the removal record and presence rule, the dependency-edge removal, the admission policy and renewal narrowing, the closeout removal block, reconcile, the `remove` event producer, and the help and reference pages; `@doc-syncer` — the documentation-phase reconciliation of the four feature specs.
- **Informed:** the M2 consumers named in `governance.informed`, `queue.graph` subscribers, and any operator or agent whose claim pattern relies on sequential claims of two refs under one holder without an intervening release.

## Evidence, Assumptions & Unknowns

| Item | Label | Source | Impact if false | Confidence |
|------|-------|--------|-----------------|------------|
| The queue ledger declares five record kinds, their schemas, and their key prefixes, and pins them in one declaration list. | FACT | `packages/core/src/contracts/queue.ts:292-315,371-457` (read 2026-11-12) | The removal kind would be a sixth declaration; if the list were not the pinned inventory, a new kind would need no pin move. | High |
| Every delivered queue read is prefix-, kind-, and schema-scoped, so a new prefix is invisible to delivered folds. | FACT | `packages/core/src/app/queue.ts:465-516` (read 2026-11-12) | A prefix-blind read would make a removal record visible to fold code that cannot interpret it. | High |
| The entry fold has no presence predicate beyond "an entry record exists", and retains edges to producers with no entry. | FACT | `packages/core/src/domain/queue-graph.ts:211-216,226-255` (read 2026-11-12) | If a presence predicate existed, removal would be narrower than a new kind plus one fold rule. | High |
| `queue release` returns `released \| parked \| noop`, appends a lease record (and a park when parked), and never removes. | FACT | `packages/core/src/app/queue.ts:957,1373,1425` (read 2026-11-12) | If release already removed, C-2 would forbid the only delivered exit. | High |
| A live lease re-claimed by the identical holder renews and records the requested `ref`; a stale lease is taken over with an incident. | FACT | `packages/core/src/app/queue.ts:1214-1240` (read 2026-11-12) | The different-ref bypass in DC-3 would not exist and renewal would need no narrowing. | High |
| Dispatch admission runs the optional preflight, then the lease claim, then spawn or resume, and a claim refusal is pre-session. | FACT | `packages/core/src/app/dispatch.ts:160-178,476-492` (read 2026-11-12) | The refusal's placement decides the precedence: put it inside the claim and it reaches `queue claim` too, whose own-holder renewal must survive; put it before the claim in the dispatch family and the two paths can differ as DC-2 requires. | High |
| The production dispatch composition claims the lease with the fixed holder `dispatch`, and its claim port also refuses on an active owner hold with `queue.precondition.unmet`. | FACT | `packages/cli/src/production.ts:1555-1580` (read 2026-11-12) | The dispatch refusal's "same holder or different holder" rule follows from that fixed holder; a caller-chosen dispatch holder would narrow the rationale, though the refusal would still be correct. | High |
| The queue command family mounts eight verbs; `dep` is two-positional; no `remove` or `reconcile` verb exists. | FACT | `packages/cli/src/commands/queue.ts:381-436` (read 2026-11-12) | The grammar surface would already carry part of the change. | High |
| The `queue dep` help entry documents an option the grammar never accepted. | FACT | `packages/cli/src/help.ts:156-158`; `packages/cli/src/commands/queue.ts:412-419` (read 2026-11-12) | If help matched the grammar, no synopsis reconciliation would be required by the delivery. | High |
| The taxonomy declares `remove` with `emitted: false` and exactly `ref`, `reason`, `recordedAt`. | FACT | `packages/core/src/contracts/taxonomy.ts:121-151` (read 2026-11-12) | If `remove` carried other declared fields, the producer would owe them and C-7 would move. | High |
| The `queue` error domain carries exactly five rows, all `user-validation`, and the queue domain has no exit-2 identity. | FACT | `packages/core/src/contracts/queue.ts:461-468`; `packages/core/src/contracts/error-table.ts:1179-1235` (read 2026-11-12) | A delivered exit-2 queue row would exist for the unreadable case and DC-6 would reuse it instead of `state.*`. | High |
| The tracker read normalises status to `backlog \| ready \| in-progress \| in-review \| done \| canceled`. | FACT | `packages/core/src/contracts/ports.ts:50-57` (read 2026-11-12) | Staleness would need a different declared fact and DC-5 would move. | High |
| Closeout's `data` carries `telemetryCapture`, `residue`, and `capsule` blocks and no queue block. | FACT | `packages/core/src/contracts/closeout.ts:404-433` (read 2026-11-12) | An existing queue block would decide the automatic removal's disclosure shape. | High |
| The M2 queue page names `queue.entry-unknown` and `queue.state-unavailable`, which duplicate delivered meanings. | FACT | `doc/planning/oss-tooling/milestones/m2/commands/queue.md:118-119` (read 2026-11-12) | If the page governed, DC-6 would add synonyms and the error table would carry two identities per meaning. | High |
| A work item that the tracker does not have is not evidence that the work landed, and `abandoned` is the operator's declared reason for that case. | ASSUMPTION | Spec §5.1 F-5 and AC-F5-6; the four-value reason vocabulary | If operators treat a deleted item as landed, reconcile would need a fifth reason and DC-1's vocabulary would move. | Medium-High |
| Every dispatch path that can start a session passes through the one injected claim port. | ASSUMPTION | `packages/core/src/app/dispatch.ts:160-178`; the resident-daemon composition supplies a supervision claim and no lane executor | A path that spawns without claiming would need its own guard and the dispatch family's single admission predicate would not cover it. | Medium-High |
| The resident-daemon production composition remains supervise-only, so the daemon path's guard is exercised through a composed supervision claim. | ASSUMPTION | Spec §2.1, §12 A-6 | A production lane executor would make the daemon path's guard a live behaviour with its own test burden. | Medium |
| `queue.precondition.unmet`'s delivered summary and remediation name a *claim* precondition, while the removal refusal's delivered blocking reason is `lease-held`. | FACT | `packages/core/src/contracts/error-table.ts:1225-1235` (read 2026-11-12) | The identity's prose under-describes the removal refusal; DC-6 leaves the row byte-identical and carries `lease-held` only in the refusal's bounded summary/detail text. | High |
| Every append-only ledger record carries a monotonic `sequence`, which is that record's ledger append position. | FACT | `packages/core/src/contracts/state.ts:50-56` (read 2026-11-12) | Presence would need another total order; DC-1 fixes on `sequence`, and each append has exactly one position. | High |

## Mental Models & Techniques Used

- **First principles:** What must a ledger answer about a retired thing? *That it is retired* (a record), *why* (a closed reason), *when* (its timestamp), and *whether it can come back* (a re-declaration that is later). Those four answers are the removal record plus the presence rule; nothing else is needed, and none of them requires editing history.
- **Inversion:** What would make this lifecycle unfixable? Presence encoded as a mutable field on a delivered schema; release overloaded to mean both lease release and retirement; a dispatch guard that a same-holder renewal can satisfy; a removal that cascades into other entries' records; staleness inferred from a failed read; a refusal set that grows a synonym for every verb; a delivered error row reworded to describe a new path. C-1 through C-8 exclude exactly those failures.
- **Second-order thinking:** Removal is one append today, but it fixes what every later consumer may assume: an absent entry is a *declared* absence with a reason, so a board, a retro, or a plan can distinguish landed from abandoned without a side channel. The renewal narrowing is one predicate, but it is what makes the per-ref guarantee statable at all — without it a same-holder claim for a second ref moves the lease's name, and the guard reads a lease that no longer describes the running session.
- **Systems thinking:** Declaration, fold, derived document, read surfaces, event, help page, and the delivered error table are one chain. A removal record the fold does not consult leaves the entry visible; a fold that drops an entry whose park is still active leaves the park pass evaluating a ref that does not exist; `remove` emitted with a payload the declaration does not list fails the emitted-key comparison; a page that names its own error identities creates a second contract; and a row whose prose is edited to fit a new caller breaks the inventory pin that makes the table trustworthy. Each link is pinned once, in DC-1, DC-4, DC-6, and DC-7's taxonomy rule.
- **Opportunity cost:** Reusing `queue release` for retirement saves one verb and costs the delivered release vocabulary, its park semantics, and every operator's reading of `release` (ALT-1). Widening the lease to per-ref saves the admission predicate and costs repository exclusivity together with the deploy-verified gate that reads it (ALT-1, ALT-3).
- **5 Whys (on the duplicate session):** A second session exists → two admissions succeed → the repository lease admits both → the second dispatch is a same-holder renewal → renewal compares the holder only. The fix therefore belongs at dispatch admission (refuse before the claim) and in the renewal rule (never cross a ref), not at the spawn site; refusing the holder's own same-ref renewal would close nothing and break the delivered claim contract.
- **Paved road / KISS:** The delivered append-only discipline, prefix-scoped reads, latest-wins folds, park `released` state, error projection classes, taxonomy declaration, and tracker read are all reused. The change adds one record kind, one presence predicate, one admission predicate, one additive closeout block, one event producer, and two rows.
- **Reversibility:** Every part is additive on an append-only store. A reverted binary ignores the unknown `queue.removals:` prefix, so a retirement reappears as a live entry rather than failing a read — a harmless asymmetry, chosen deliberately over a migration.

## Alternatives Considered

### Per-Alternative Constraint-Compliance Evaluation

Legend: ✅ passes · ❌ fails. Every constraint is `negotiable: no`, so no accepted-risk exception exists and no driver score rescues a failing option.

| | C-1 presence derived | C-2 release untouched | C-3 reason-bearing removal | C-4 per-ref outcomes per path | C-5 repository lease intact | C-6 exactly two identities | C-7 taxonomy v1 + `remove` emitted | C-8 reconcile bounded and fail-closed |
|---|:---:|:---:|:---:|:---:|:---:|:---:|:---:|:---:|
| ALT-0 do nothing | ✅ | ✅ | ❌ | ❌ | ✅ | ❌ | ❌ | ✅ |
| ALT-1 tombstone on the entry record, removal folded into `release`, per-ref lease | ❌ | ❌ | ✅ | ✅ | ❌ | ✅ | ✅ | ✅ |
| ALT-2 selected removal, no admission guard | ✅ | ✅ | ✅ | ❌ | ✅ | ✅ | ✅ | ✅ |
| ALT-3 admission guard without the renewal narrowing | ✅ | ✅ | ✅ | ❌ | ❌ | ✅ | ✅ | ✅ |
| ALT-4 selected | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ |
| ALT-5 per-refusal identities named by the M2 page | ✅ | ✅ | ✅ | ✅ | ✅ | ❌ | ✅ | ✅ |
| ALT-6 unverified-tracker staleness (absent or unreadable removes) | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ | ❌ |

### Alternative 0 — Do Nothing / Keep the Five-Kind, Release-Only Queue

- **Eligibility:** Not eligible (fails C-3, C-4, C-6, C-7).
- **Summary:** Keep the delivered queue family, the five record kinds, the repository lease with its holder-identical renewal, and `remove` declared but unemitted.
- **Constraint compliance:** Passes C-1 (nothing changes), C-2 (release untouched), C-5 (lease untouched), and C-8 (reconcile does not exist). Fails C-3 (no reason-bearing removal exists, and `queue.reason-missing` is required by the contract), C-4 (a second session on one ref remains reachable through the two admission paths), C-6 (the two required identities do not exist), and C-7 (`remove` remains a declared kind with no producer).
- **Driver fit:** Fails driver 1's purpose outright and serves no other driver.
- **Pros:** Zero change, zero compatibility risk.
- **Cons:** Every dead entry is permanent without hand-editing state; edges remain write-only; duplicate sessions remain reachable; the declared `remove` kind remains unemittable; and the three dependent M2 stories inherit the gap.
- **Why rejected:** It is the absence of the deliverable, not a design choice.

### Alternative 1 — Tombstone on the Entry Record, Retirement Folded Into `release`, and a Per-Ref Lease

- **Eligibility:** Not eligible (fails C-1, C-2, C-5).
- **Summary:** Append a `queue.entry` record carrying `removedAt` and `removedReason` and let the fold drop an entry whose latest entry record is a tombstone; extend `queue release` with `--reason` so one verb releases and retires; widen the lease to the ref so a second claim for the same ref conflicts.
- **Constraint compliance:** Passes C-3 (the reason is closed and required), C-4 (a per-ref lease refuses the second claim and names the holder), C-6 and C-7 (two rows and an emitted `remove` are reachable from the tombstone), and C-8. Fails C-1 (a `removedAt` on `delivery.queue.entry.v1` gives every historical entry record a second reading and makes "an entry exists iff its latest entry record is a non-tombstone" a reinterpretation of a delivered payload), C-2 (`release` takes a removal reason and two authorities share one verb), and C-5 (a per-ref lease removes repository exclusivity together with the deploy-verified gate and the delivered stale-takeover scope).
- **Driver fit:** Strong on driver 4's mechanism, weak on drivers 1, 2, and 5 — it buys the guard by spending the invariant and the verb's single meaning.
- **Pros:** One fewer record kind; one fewer verb; a per-ref conflict is classified by a delivered identity.
- **Cons:** Every reader of entry records must learn a field-based absence rule; release's result vocabulary and park semantics gain a second meaning; repository exclusivity, its TTL, its takeover, and the deploy gate all move; the rollback asymmetry is no longer harmless (a reverted binary reads tombstones as live entries *with* their removal fields).
- **Why rejected:** A tombstone field spends the append-only invariant's cheapest property — that a delivered payload keeps one meaning — to avoid adding a record kind that costs one declaration entry.

### Alternative 2 — Selected Removal Semantics Without an Admission Guard

- **Eligibility:** Not eligible (fails C-4).
- **Summary:** Deliver DC-1's removal record and presence rule, DC-4's removal legality, DC-5's staleness rule, and DC-6's identities, and leave duplicate-session prevention to the delivered repository lease and the scheduler's per-pass single-flight.
- **Constraint compliance:** Passes C-1, C-2, C-3, C-5, C-6, C-7, and C-8. Fails C-4: the repository lease admits a same-holder re-claim of the same ref as a renewal, and the scheduler's per-pass single-flight is one action per repository per pass rather than a per-ref refusal — neither names a holder, and neither stops a second session on one ref.
- **Driver fit:** Serves drivers 1, 2, 3, 5, 6, and 7; fails driver 4, which is one of the ticket's three acceptance criteria.
- **Pros:** The smallest possible change; no admission predicate; no narrowing of renewal.
- **Cons:** The observed defect stays: two dispatch entry paths on one ref both start a session, and the second's presence is visible only in the lane ledger after the fact.
- **Why rejected:** It is the ticket's evidence, unfixed.

### Alternative 3 — Admission Guard Without the Renewal Narrowing

- **Eligibility:** Not eligible (fails C-4, C-5).
- **Summary:** Add DC-2's dispatch admission refusal, and keep the delivered renewal rule that a same-holder claim renews and records whatever ref was requested.
- **Constraint compliance:** Passes C-1, C-2, C-3, C-6, C-7, and C-8. Fails C-4 because the dispatch guard can be walked around through the claim path: `queue claim` ref B under the holder that holds ref A renews and rewrites the lease's `ref` to B, after which A's next dispatch admission finds a lease naming B and admits a second session on A. Fails C-5 because that rewrite also means the repository lease no longer names the running ref, so repository exclusivity is claimed but not held.
- **Driver fit:** Serves drivers 1, 2, 3, 6, and 7; fails drivers 4 and 5. It is the most attractive wrong answer, because the guard alone looks like the whole fix.
- **Pros:** Smallest guard diff; no claim-result change; no disclosed behaviour narrowing.
- **Cons:** A stated guarantee that a two-step sequence defeats; a lease whose recorded `ref` does not describe the running session; a downstream reader (deploy gate, lanes projection) keying on a lease that has moved.
- **Why rejected:** A guard whose enforceability depends on a renewal rule that overwrites the guarded fact is not a guard.

### Alternative 4 — Selected: Append-Only Removal Kind, Path-Specific Per-Ref Single-Flight, Narrowed Renewal, Non-Cascading Removal, Tracker-Delivery-State Staleness

- **Eligibility:** Eligible.
- **Summary:** The six decisions below: a new `queue.removal` kind with an append-position presence rule and the closed four-value reason vocabulary; `queue release` untouched; a path-specific per-ref admission policy over live lease truth — dispatch admission refuses any live same-ref lease, `queue claim` renews its own holder's same-ref lease and refuses another holder's — with `queue.single-flight` and root `detail.holder`; renewal narrowed to one `(repository, ref, holder)` with `queue.lease-conflict` for a same-holder claim of another ref; removal refused on a live lease and never cascading; reconcile staleness fixed to `deliveryState` `done`/`canceled` with fail-closed reads; and exactly two new identities.
- **Constraint compliance:** Passes C-1 … C-8 (matrix above). C-9 is table stakes.
- **Driver fit:** Best on every driver: presence derived from an appended record (1), one meaning per verb and per identity (2), a truthful held `dependency-unobserved` state with a delivered remedy (3), a refusal on every dispatch path plus a claim policy that preserves exclusivity, with the different-ref bypass closed (4), additive and reversible (5), every refusal classified from the table (6), and one new kind, one predicate pair, one block, one producer, two rows (7).
- **Pros:** A store with no removal records folds byte-identically, so no migration; a re-declaration restores an entry with no special case; the admission predicate reuses the lease's own liveness rule, so "active" has one definition; the dispatch family shares one admission seam while `queue claim` keeps the delivered renewal outcomes; `remove` becomes emitted with exactly its declared fields; the delivered park `released` state withdraws an active park without new park vocabulary; the delivered `dependency-unobserved` state and the new `dep remove` verb form a truthful pair.
- **Cons:** Six contract surfaces move together (record kind, identity rows, taxonomy pin, help, reference pages, closeout block); one outcome narrows (`renewed` becomes reachable only for the same ref, and only through the claim path); the same live state yields different outcomes on dispatch and on claim, which must be documented rather than assumed; the explicit remove verb is not idempotent while the automatic path converges; consumers see a held `dependency-unobserved` where an operator might have expected a cascade.
- **Why chosen:** It is the only alternative that satisfies every `negotiable: no` constraint, and it satisfies them by extending the delivered surfaces instead of reinterpreting them.

### Alternative 5 — Per-Refusal Identities as the M2 Page Names Them

- **Eligibility:** Not eligible (fails C-6).
- **Summary:** Take the M2 page's identity set as the contract: `queue.entry-unknown` for an unknown ref, `queue.state-unavailable` for an unreadable store, plus removal-specific and single-flight rows.
- **Constraint compliance:** Passes C-1 through C-5, C-7, and C-8. Fails C-6: `queue.entry-unknown` and `queue.state-unavailable` are duplicate identities for meanings the delivered table already carries (`queue.entry.unobserved` and the `state.*` family), and a removal-specific precondition row duplicates `queue.precondition.unmet`. The queue kind would grow by four or more rows for two new meanings.
- **Driver fit:** Fails driver 2 (one meaning per identity) and driver 6 (a refusal set an operator must disambiguate), and undermines driver 1's audit claim by making two codes mean one thing.
- **Pros:** The planning page would need no reconciliation; each verb's refusal reads locally.
- **Cons:** Two identities per meaning forever; an operator or script that exhausts the queue kind must handle both spellings; the error table loses the uniqueness property its equality pin asserts.
- **Why rejected:** Error rows are unique identities. A synonym row is a duplicate contract, and the page that names it is the artifact to reconcile, not the table.

### Alternative 6 — Removal on Unverified Tracker Truth

- **Eligibility:** Not eligible (fails C-8).
- **Summary:** Treat any non-running signal as staleness — a work item the tracker does not have, a failed read, an absent assignee, or an age threshold — and remove on it.
- **Constraint compliance:** Passes C-1 through C-7. Fails C-8: an unreadable or absent observation would remove an entry, so a partial or failed read could manufacture a retirement, and the read budget's fail-closed rule would be gone.
- **Driver fit:** Serves no driver: it trades the auditability of "why did this leave" (driver 1) and the refusal classification (driver 6) for a convenience that a single wrong read converts into a wrong retirement.
- **Pros:** A sweep would clear more entries in one run.
- **Cons:** A tracker outage would retire entries; a mistyped or deleted item would look landed; the reason recorded would be `reconciled` for work that never finished.
- **Why rejected:** A missing observation is not evidence that work landed, and a removal that a failed read can cause is worse than an entry that needs one operator command.

## Decision

- **Decision:** Adopt **ALT-4**, recorded as six decisions that bind together.

  1. **DC-1 — Retirement is a new append-only record kind, and presence is an append-position rule against the entry record.**
     - The kind is `queue.removal`, payload schema `delivery.queue.removal.v1`, key `queue.removals:<REF>`, identity field `ref`, declared fields `schema`, `ref`, `reason`, `recordedAt`, plus the additive optional caller principal every queue record carries. The reason is the closed four-value set `landed | abandoned | superseded | reconciled`; the rendered reason is the operator's (or the automatic path's) declaration, so `landed` is not reserved to closeout and `reconciled` is not reserved to reconcile.
     - **Presence rule.** Presence is decided by the ledger's append position — the delivered monotonic record `sequence` of each append — never by `recordedAt` text. An entry is present iff the latest `queue.entry` append for the ref is later than the latest `queue.removal` append for the ref; with no removal append for the ref, the entry record's existence is the whole predicate. A tie is impossible, because each append occupies exactly one position, so the ref's latest entry append and latest removal append are strictly ordered. An identical `recordedAt` across a removal and a subsequent re-declaration is resolved by append order, and the later re-declaration restores the entry. The rule is the fold's only presence predicate; no removal record is deleted, rewritten, or re-keyed.
     - Nothing is edited: no entry, dependency, lease, park, or incident record is deleted or rewritten, and the derived `queue-graph.json` is replaced atomically when, and only when, the folded intent truth changed. A store with no removal records folds to the identical derived document, so no migration, backfill, or seed exists.
     - Removal is refused when the ref has no entry, or was already removed, with the delivered `queue.entry.unobserved`; the explicit verb is therefore not idempotent, deliberately, matching the delivered unknown-entry convention. The automatic closeout path instead reports `satisfied` so a re-runnable transaction converges.
     - **Consequence for later changes:** retirement is never encoded as a field on a delivered payload, and no read surface may infer absence from anything but the presence rule. A removal-history read surface reads this prefix; it does not reshape the record.

  2. **DC-2 — Per-ref single-flight is path-specific over live lease truth, and the lease stays repository-exclusive.**
     - **Dispatch family.** `dispatch run` and a composed daemon lane supervision cycle share one admission predicate, evaluated before any claim, spawn, resume, attempt, or record. A live lease whose recorded `ref` equals the requested ref is refused with `queue.single-flight` at exit `1` — **same holder or different holder** — because the dispatch path claims with the fixed holder `dispatch`: a live same-ref lease can only name a dispatch that is already running, so the second dispatch is by definition a duplicate, and refusing before the claim is also why dispatch never reaches renewal. A live lease whose recorded ref is a *different* ref refuses the delivered `queue.lease-conflict`, which is repository exclusivity stated as a refusal. The refusal carries the root `detail` object whose `holder` is the live lease's holder identity, bounded and single-line and carrying identifiers only — no credential, session id, or provider payload (the slot's placement and bounds are TDR-0027's). It appends no lease, attempt, lane, or queue record, publishes no event, and starts no session, because it happens before the fence and before any append.
     - **Claim path.** `queue claim` keeps the delivered renewal, holder-aware: a live same-ref lease under the caller's own holder returns `renewed`; a live same-ref lease under another holder refuses `queue.single-flight` with `detail.holder` naming that holder; a live lease on another ref refuses the delivered `queue.lease-conflict`. The direct `claimQueueLease` seam keeps its delivered same-holder/same-ref renewal, so the two delivered lease controls stay green with no assertion change. The dispatch refusal lives in the dispatch family's admission seam rather than inside the claim primitive, which is exactly why the outcomes differ by path.
     - **The precedence table.** Every requester/state pair has exactly one outcome, and no pair has two:

       | Path | Live lease state | Outcome | Lease record | Session |
       |---|---|---|---|---|
       | `dispatch run`, daemon supervision claim | recorded ref = requested ref (any holder) | `queue.single-flight`, exit `1`, `detail.holder` | none | none |
       | dispatch family | recorded ref ≠ requested ref | `queue.lease-conflict`, exit `1` | none | none |
       | dispatch family | no live lease | `claimed` | one `acquired` | the dispatch proceeds |
       | dispatch family | stale lease (heartbeat age ≥ TTL) | `taken-over` + incident evidence | one `taken-over` | the dispatch proceeds |
       | `queue claim` | same ref, caller's own holder | `renewed` | one `renewed` | none — a claim starts no session |
       | `queue claim` | same ref, another holder | `queue.single-flight`, exit `1`, `detail.holder` | none | none |
       | `queue claim` | other ref (any holder) | `queue.lease-conflict`, exit `1` | none | none |
       | `queue claim` | no live lease | `claimed` | one `acquired` | none |
       | `queue claim` | stale lease | `taken-over` + incident evidence | one `taken-over` | none |
       | direct `claimQueueLease` seam | same ref, same holder | `renewed` (delivered, unchanged) | one `renewed` | not applicable — the seam spawns nothing |

     - **Why the three acceptance criteria hold together.** AC-F4-1 (a second `dispatch run` on an active ref is refused) and AC-F4-2 (a claim on a ref another lane holds is refused) are satisfied by the two refusal rows, while AC-F4-5's "an identical holder re-claiming the same ref still returns `renewed`" is the claim path's own-holder row, which starts no session and appends no attempt. A single blanket predicate over `(ref, holder)` satisfies any two of the three and cannot satisfy all three: it would either make `renewed` unreachable through `queue claim` or leave the second dispatch admitted.
     - **Liveness has one definition.** A lease whose heartbeat age has reached its TTL is not active, so the delivered stale-takeover path applies on every path and a crashed session does not block the ref beyond the TTL.
     - **Levels stay distinct.** The lease stays repository-exclusive with its TTL and takeover rule. The scheduling engine's per-pass single-flight (one action per repository per pass) and its `repo-free` readiness condition keep their meaning; the reconciled pages and the glossary name the per-repository, per-ref, and per-pass concepts distinctly, so one term never carries two meanings.
     - **Consequence for later changes:** a per-ref (rather than per-repository) lease scope is a lease-contract change with its own record. A new dispatch path joins the dispatch family's admission predicate; it must not invent a third precedence, and the precedence table is the only place these outcomes are authored.

  3. **DC-3 — Renewal is narrowed to the same `(repository, ref, holder)` and never crosses a ref.**
     - A live lease is renewed only when the requester's holder identity, the lease's repository, and the requested ref all match the live lease's. A same-holder, same-ref claim therefore still returns `renewed`, unchanged and idempotent — through `queue claim` and through the direct `claimQueueLease` seam, which the two delivered lease controls exercise.
     - A same-holder claim for a **different** ref in the same repository refuses the delivered `queue.lease-conflict`, names the holder and the lease, and leaves the live lease's recorded `ref` unchanged. This is the second half of DC-2: without it, claiming ref B under the holder that holds ref A rewrites the lease's `ref` to B, A's next dispatch admission finds a lease naming B, and the dispatch refusal is walked around.
     - Dispatch admission never reaches renewal: it refuses on a live same-ref lease before any claim (DC-2), so `renewed` is a claim-path outcome only. `queue claim` keeps `claimed`, `renewed`, and `taken-over`; `renewed` is reachable only for the same ref under the caller's own holder.
     - This is the one outcome the change narrows rather than extends, and it is disclosed in the reconciled scheduling-engine and queue pages and in the change note.
     - **Consequence for later changes:** a workflow that claims two refs sequentially under one holder without an intervening release receives a refusal it can act on; restoring holder-identical renewal for a different ref would restore the rewrite and the bypass, and must be treated as a lease-contract change.

  4. **DC-4 — Removal respects a running lane, withdraws an active park, and never cascades.**
     - An entry whose repository lease is live is refused removal with the delivered `queue.precondition.unmet` at exit `1`, carrying the delivered blocking reason `lease-held` and naming the holder; nothing is appended. No removal path releases a lease on the operator's behalf: `queue release` is the delivered authority for dropping a lease, and coupling the two would retire an entry whose session is still writing.
     - When the entry has an active park, the removal appends the delivered park-withdrawal record (`recoveryState: "released"`, the shape the delivered release path already writes) before the removal record, so the park stops participating in the park pass, the recovery incidents, and the lane projection. No park field, cause, or state is added.
     - Removal does not rewrite edges and nothing cascades. A consumer whose edge set names the removed ref keeps its edge set exactly as declared and is held with the delivered blocking reason `dependency-unobserved` — truthful, since the producer is no longer in the queue — and the supervised remedy is the `queue dep remove` verb this decision adopts. `dep add` (in both the delivered two-positional spelling and its explicit form) and `dep remove` each append one dependency record carrying the consumer's resulting folded edge set; the ready set is recomputed on every read from the graph and is never cached or invalidated.
     - `dep remove` of an edge that is not declared returns `noop` at exit `0`, appends nothing, and publishes no event: the delivered convention for "the requested end state already holds" is `noop`, and refusing would make an idempotent cleanup impossible. No cycle check runs on removal; the cycle predicate remains add-only.
     - **Consequence for later changes:** a cascade, an automatic edge rewrite, or a removal that releases a lease is a contract change with its own identity and its own record; today the held state and the two delivered blocking reasons are the whole story.

  5. **DC-5 — Staleness is the tracker's normalised `deliveryState` of `done` or `canceled`, and an unreadable read changes nothing.**
     - An entry is stale iff its tracked work item's normalised `deliveryState` is `done` or `canceled`. Nothing else makes an entry stale: not an absent assignee, not a label, not a missing plan, not an age, not a missing item. `backlog`, `ready`, `in-progress`, and `in-review` are retained and reported with their observed state.
     - A work item the tracker does not have is reported as unobserved and retained: a deleted or mistyped item is not evidence that work landed, and `queue remove --reason abandoned` is the operator's exit for that case.
     - An unreadable read refuses the run under the provider adapter's own classified identity and its projection class's exit (`provider.outage` and `provider.quota.exceeded` at the platform class, `provider.auth.rejected` at the user class), appends nothing, and reports no partial removal. There is no `queue.*` identity for this case and no partial-success envelope: reconcile either has readable truth for every examined entry or it changes nothing.
     - Scope is the invoking checkout's per-repository queue (narrowed by `--ref`), the read budget is one bounded read per examined entry with no retry, no pagination, and no concurrent read, and a run examines at most the declared cap of 100 entries, reporting `truncated` with the exact remainder beyond it.
     - Every removal a reconcile run applies is an ordinary DC-1 removal with reason `reconciled`, under DC-4's invariants (one append per ref, park withdrawal, no edge rewrite), and publishes one `remove` event per removed ref in that ref's lane.
     - **Consequence for later changes:** widening staleness to any other signal is a policy change with a new revisit; a tracker kind with no read surface is an unreadable observation, not a reason to infer staleness.

  6. **DC-6 — Exactly two new error identities; every other refusal reuses a delivered row, and the five delivered rows stay byte-identical.**
     - The queue domain gains exactly two rows: `queue.reason-missing` (an unqualified removal) and `queue.single-flight` (a second dispatch against an active ref, or a claim on a ref another holder holds), both projecting to exit `1`; `queue.single-flight` is retryable because the holder is transient, and it carries the root `detail.holder` (TDR-0027). The queue kind's inventory moves from five rows to seven. The five delivered rows are byte-identical: their `code`, `category`, `retryable`, `consequence`, `projectionClass`, exit, `summary`, and `remediationHint` do not change.
     - Every other refusal reuses a delivered identity: an unknown or already-removed ref is `queue.entry.unobserved`; a removal blocked by a live lease is `queue.precondition.unmet` with the delivered `lease-held` blocking reason; a claim on another ref is `queue.lease-conflict`; a cycle-closing add is `queue.dependency-cycle`; malformed grammar and an out-of-vocabulary reason are `input.value.rejected`; an unreadable queue store is the delivered `state.*` family at exit `2`; an unreadable tracker read is the provider family, whose rows project by class.
     - The M2 queue page is reconciled to those delivered identities rather than allowed to define a second contract: `queue.entry-unknown` and `queue.state-unavailable` are duplicate identities for meanings the delivered table already carries, and the page's example envelope is the delivered `CommandResult`, not a top-level `ok`/`command` shape. The `queue dep` help synopsis is corrected to the delivered two-positional grammar.
     - **The removal-specific reason appears only in bounded refusal text.** `queue.precondition.unmet`'s delivered summary and remediation describe a claim precondition; the removal refusal states its own blocking reason `lease-held` in the bounded `summary`/`detail` text it returns, and the row itself is not reworded. The row-derivation property therefore holds for every delivered row exactly as delivered, and the delivered `error-table` pin keeps asserting the same text.
     - **Consequence for later changes:** a new refusal that duplicates an existing meaning is a contract defect, not an additive row. Rewording a delivered row to fit a new caller is a delivered-contract change with its own record; a removed reason, a widened vocabulary, or an exit outside `{0, 1, 2}` likewise.

- **Rationale (tied to drivers):** DC-1 gives retirement a representation the ledger can always fold, and one total order — the append sequence — so presence needs one predicate and a re-declared entry needs no special case (drivers 1, 5, 7). DC-2 puts the refusal where the duplicate session can actually start: a dispatch path's second attempt is a same-holder renewal, so the dispatch family refuses any live same-ref lease, while `queue claim` keeps the delivered renewal outcomes its callers and controls depend on (drivers 4, 2, 7). DC-3 closes the second hazard — a same-holder claim for another ref moving the lease's name — which is what keeps the dispatch refusal from being walked around (drivers 2, 5). DC-4 keeps a running session's entry untouchable, withdraws an active park with a delivered state, and leaves dependents in the truthful held state with a delivered remedy instead of inventing a cascade or a refusal identity (drivers 1, 2, 3). DC-5 fixes staleness to one auditable fact and makes every unreadable or absent observation a no-op, so a failed read can never manufacture a retirement (drivers 1, 6). DC-6 spends exactly two rows for two new meanings, leaves the five delivered rows byte-identical, and reconciles the page that names two more, which is what keeps the error table a table of unique identities (drivers 2, 6).
- **Record type:** TDR. The structural frame is already decided — the append-only queue ledger and its folds (TDR-0004's state discipline, the delivered queue ledger), the derived exit taxonomy (TDR-0005), the resident daemon and its lane seam (TDR-0023), and the event taxonomy and its version discipline (TDR-0025). This record chooses the contract extension points inside that frame: one record kind and one presence rule, one admission predicate and one narrowing, one emission producer and two error rows. It declares no new wire type, state schema version, package, subpath, or provider adapter.
- **Decider:** Juliusz Ćwiąkalski (owner).
- **Authorization:** Status `Proposed`. Human acceptance is recorded at the GH-292 PR review; AI does not accept this R2 record and grants no authority until then. On acceptance, `decision_date` is set and a `review_date` is fixed for the first post-implementation retrospective.
- **Conditions for revisit:** See `revisit_triggers`. The two positions the GH-292 specification carried as provisional — removal refused on a live lease (OQ-1) and removal without a cascade (OQ-2) — are resolved by the PM decision of 2026-11-12 recorded in the change capsule, and each carries its own revisit trigger, so an operator workflow that contradicts either reopens a named decision instead of amending behaviour quietly.

### Constraint Compliance Attestation

The chosen alternative (ALT-4) satisfies every constraint C-1 through C-8. C-9 is table stakes and is satisfied. No accepted-risk exceptions are taken and no constraint is violated.

| Constraint | Attestation |
|---|---|
| C-1 | Retirement is one appended `queue.removal` record and one presence predicate over ledger append position (DC-1); no delivered payload gains a field, no record is deleted or rewritten, and the derived document moves only with intent truth. |
| C-2 | `queue release` keeps its delivered meaning, its park, its `until` rule, and its `released \| parked \| noop` vocabulary, and accepts no removal reason (DC-1, DC-4). |
| C-3 | Every applied removal records exactly one of the four closed reasons; an unqualified removal is refused with `queue.reason-missing`, and an out-of-vocabulary value is a grammar refusal (DC-1, DC-6). |
| C-4 | The dispatch family's one admission predicate refuses any live same-ref lease with `queue.single-flight` and `detail.holder` before any claim, spawn, resume, or record; `queue claim` renews its own holder's same-ref lease and refuses another holder's with the same identity, and refuses any other-ref lease with `queue.lease-conflict`; AC-F4-1, AC-F4-2, and AC-F4-5 are satisfied simultaneously by that table (DC-2, DC-3). |
| C-5 | The lease keeps its repository scope, TTL, takeover path, and incident evidence; exclusivity holds for a same-holder claim through the narrowed renewal, and the delivered same-holder/same-ref renewal and its two controls are unchanged (DC-2, DC-3). |
| C-6 | Exactly two rows are added, both exit `1`; every other refusal resolves to a delivered row or the `state.*`/`provider.*` family; the five delivered rows stay byte-identical, with the removal-specific `lease-held` reason carried only in the refusal's bounded `summary`/`detail` text (DC-6). |
| C-7 | The `queue.graph` kind set, payload field lists, envelope, version stamp, ordering rule, and overflow policy are unchanged; `remove` is emitted with exactly `ref`, `reason`, `recordedAt`, and no event is published for a refusal, a `noop`, or a skip (DC-1, DC-4, DC-5, DC-6). |
| C-8 | Reconcile reads only through the declared credential port, bounded at one read per examined entry under the 100-entry cap, and removes nothing on an unreadable or absent observation (DC-5). |

## Trade-offs & Consequences

### Positive Outcomes

- An entry can leave the queue with a recorded reason, and the ledger keeps every record it ever held: removal is a state transition, not a deletion.
- A store written before this decision folds to the same entries and the same derived document, so there is no migration, no backfill, and no seed; a reverted binary reads the unknown prefix as absent and restores the entry rather than failing a read.
- A re-declared ref comes back with no special case, because presence is a comparison of records rather than a mutation of one.
- The per-ref guarantee becomes statable per path: the dispatch family refuses any live same-ref lease; `queue claim` refuses another holder's same-ref lease and its own other-ref claim; one liveness definition and one refusal identity cover every case; and the renewal narrowing closes the different-ref rewrite that would otherwise move the lease's name.
- A dependent whose producer left is held in a state an operator can act on, and the verb that clears the edge is delivered by the same change, so the held state and the remedy ship together.
- Every applied removal and every dependency edit is observable on the declared `queue.graph` kinds with their declared payloads, so a subscriber can reconstruct the graph's intent history from events alone.
- Reconcile cannot manufacture a retirement: only a positive `done`/`canceled` observation removes, and an unreadable read changes nothing.
- The error table stays a table of unique identities: two new meanings cost two rows, the five delivered rows stay byte-identical, and the page that named duplicates is reconciled instead of the table being widened.

### Negative Outcomes

- One outcome narrows: a same-holder claim for a different ref in one repository moves from `renewed` to `queue.lease-conflict`. A workflow that claimed two refs sequentially under one holder without releasing in between receives a refusal; a workflow that released between claims is unaffected. `renewed` becomes reachable only for the same ref, and only through the claim path.
- The same live state yields different outcomes on different paths, which is the price of keeping AC-F4-1, AC-F4-2, and AC-F4-5 satisfiable together. The precedence table is contract data: a reader who assumes "one predicate everywhere" will mispredict `queue claim`'s own-holder renewal.
- Six contract surfaces move together: the record-kind declaration and its pin (five kinds to six), the error-row inventory and its pin (five rows to seven), the taxonomy's non-emitted set (to empty) with four pinned tests, the help family and the `queue dep` synopsis, the M1 reference page, and the M2 page's identities and envelope. A partial delivery leaves a one-sided pin, which is why the change lands them together.
- The explicit `queue remove` is not idempotent while the automatic closeout removal is. The asymmetry is deliberate — a converging transaction must not fail on work it already did, and an explicit verb matches the delivered unknown-entry convention — but an operator who expects a re-run to succeed must read the block, not the verb.
- A removal does not clean up dependents. An operator who expected a cascade must edit the edge explicitly, and the queue will show that dependent held until they do.
- The refusal detail adds a field consumers must tolerate, and the `queue.single-flight` identity is a new term beside the scheduler's per-pass single-flight; the pages must keep the two distinct or a reader conflates them.
- Reconcile's cost is bounded but not free: a 200-entry queue needs two runs or a scoped run, and beyond the cap the payload reports truncation rather than sweeping.

### Unresolved Questions

None. Every question this record carried is resolved, and each resolution is a decision above rather than an open item:

- [x] **Presence comparator.** Resolved by DC-1: presence compares the ledger's append position — the delivered monotonic record `sequence` — and never `recordedAt` text. A tie cannot occur because each append occupies one position, and an identical `recordedAt` across a removal and a later re-declaration is ordered by the append sequence, so the re-declaration restores the entry.
- [x] **`queue.precondition.unmet` prose.** Resolved by DC-6: the five delivered rows stay byte-identical, and the removal-specific `lease-held` reason appears only in the refusal's bounded `summary`/`detail` text.
- [x] **Live-lease removal refusal (spec OQ-1).** Resolved by the PM decision of 2026-11-12: removal is refused while the ref's lane lease is live (`queue.precondition.unmet`, blocking reason `lease-held`), and no removal path releases a lease (DC-4).
- [x] **Non-cascading removal (spec OQ-2).** Resolved by the PM decision of 2026-11-12: removal never cascades and never rewrites another entry's edges; a consumer stays held `dependency-unobserved`, and `dep remove` is the remedy (DC-4).
- [x] **Operator impact of the narrowed renewal.** Resolved by DC-3: a same-holder, same-ref claim still renews; only a same-holder claim for a different ref is refused with `queue.lease-conflict`, and the change note and the reconciled pages disclose it.

## Implementation Plan

1. **Removal record and presence rule.** Declare `queue.removal` with `delivery.queue.removal.v1`, key prefix `queue.removals:`, identity field `ref`, its declared field list, and its closed reason vocabulary beside the five delivered declarations; extend the record-kind inventory and its pin from five to six. Extend the fold with the presence predicate — the latest `queue.entry` append for the ref is later than the latest `queue.removal` append for the ref, compared by the delivered record `sequence` and never by `recordedAt` text — and thread it through the graph fold, the derived document, and every read that projects entries.
2. **Removal legality and the queue verbs.** Add `queue remove <ref> --reason <value>` with its grammar, its refusal set, the park-withdrawal append before the removal append, the live-lease refusal with blocking reason `lease-held`, and one fenced transaction that verifies each append and replaces the derived document only after the appends verify. Add `dep add` / `dep remove` over the delivered two-positional add, with the `removed`/`noop` results and no cycle check on removal.
3. **Automatic removal in closeout.** After the closeout writes and inside the held fence, plan the removal in plan mode as `would-remove` and apply it as `landed` in `--apply` mode; report `satisfied` for an absent or already-removed entry and `skipped` with a closed reason (`no-merge-truth`, `lease-held`, `state-unavailable`, `ref-not-canonical`); keep the step inventory and the exit code identical with and without the hook, and disclose the outcome in one additive non-step `data` block.
4. **Admission policy and renewal narrowing.** Apply the DC-2 precedence: an admission predicate in the dispatch family (shared by `dispatch run` and the composed supervision claim) that refuses any live lease whose recorded ref is the requested ref with `queue.single-flight` and a bounded `detail.holder`, and any other-ref lease with `queue.lease-conflict`, before any append; and `queue claim`'s holder-aware precedence — own-holder same-ref `renewed`, another holder's same-ref `queue.single-flight`, any other-ref lease `queue.lease-conflict`. Narrow renewal in the claim path to the same `(repository, ref, holder)` and leave the direct `claimQueueLease` seam's delivered same-holder/same-ref renewal intact so the two delivered lease controls stay green. Leave the scheduler's per-pass single-flight and `repo-free` untouched.
5. **Reconcile.** Add `queue reconcile [--ref <ref>]` over the per-repository queue with the 100-entry cap, one bounded tracker read per examined entry through the declared credential port, the `done`/`canceled` staleness rule, the retained/unobserved reporting, the truncation remainder, and fail-closed provider-identity refusal on an unreadable read. Route every removal through the removal path from item 2.
6. **Error rows and event producer.** Add `queue.reason-missing` and `queue.single-flight` to the queue domain with their categories and projection classes, extend the row inventory and its pin from five to seven, and leave the five delivered rows byte-identical — no summary or remediation edit, with `lease-held` carried only in the refusal's bounded `summary`/`detail` text. Emit `remove` from the removal record family with exactly `ref`, `reason`, `recordedAt`, and set the declared kind to emitted so the non-emitted set is empty; move the four pins that assert the previous non-emitted set and the emitted-payload-key comparison in the same change, as two-sided equalities rather than relaxed assertions.
7. **Surfaces.** Mount the new verbs and flags in the help family, correct the `queue dep` synopsis to the delivered grammar, document the reason vocabulary, the single-flight refusal, and reconcile on the M1 reference page (the resolved page root), and reconcile the M2 page's identities and example envelope. Reconcile the scheduling-engine, dispatch-engine, closeout, and event-taxonomy feature specs in the documentation phase.

## Verification Criteria

- Metric: presence and append-only truth — a removal leaves the ledger holding one removal record, removes the entry from `queue list`, `queue plan`, `queue ready`, `lanes`, and the derived document, and a re-declaration restores it with no record deleted or rewritten; presence is computed from ledger append position, so a removal and a re-declaration carrying an identical `recordedAt` still resolve by their `sequence` and the later re-declaration restores the entry. Target: every AC-F1 assertion (AC-F1-1, AC-F1-7), with a zero-deletion comparison of the record set and an identical-`recordedAt` case. Window: GH-292 CI.
- Metric: reason discipline — every applied removal records exactly one of the four reasons; a missing reason is `queue.reason-missing` at exit `1` with zero appends; an out-of-vocabulary value is a grammar refusal. Target: 100% of removal paths, and zero appends on every refusal (AC-F1-2, AC-F1-3). Window: GH-292 CI.
- Metric: single-flight precedence — for each row of DC-2's table, the outcome is the row's outcome: the dispatch family refuses any live same-ref lease (same or different holder) with `queue.single-flight` and `detail.holder`, refuses another-ref lease with `queue.lease-conflict`, and gets zero appended records and zero sessions; `queue claim` renews its own holder's same-ref lease, refuses another holder's same-ref lease with `queue.single-flight`, refuses any other-ref lease with `queue.lease-conflict`, and leaves the live lease's recorded `ref` unchanged on every refusal; a stale lease is taken over on both paths; the two delivered direct-claim controls stay green with no assertion change. Target: every table row, both paths (AC-F4-1..6, SC-M2-S15-02). Window: GH-292 CI.
- Metric: removal legality — a live lease refuses removal with `queue.precondition.unmet` and blocking reason `lease-held`; an active park is withdrawn before the removal append; a dependent is held `dependency-unobserved` with an unchanged edge set; `dep remove` of an absent edge is a `noop` with zero appends and zero events. Target: every AC-F1-5, AC-F1-6, AC-F1-8, AC-F3-3 assertion. Window: GH-292 CI.
- Metric: reconcile fail-closed behaviour — `done` and `canceled` remove with reason `reconciled`; the four other delivery states are retained and reported; a not-found item is retained and reported unobserved; an unreadable read removes nothing and exits under the provider identity's class; at most 100 entries are examined with one bounded read each and an exact truncation remainder. Target: all eight AC-F5 criteria, SC-M2-S15-03. Window: GH-292 CI.
- Metric: event completeness — each applied removal emits exactly one `remove` event with exactly the three declared payload fields; a `dep remove` emits `dependency-edge` with `removed[]`; zero events are published for a refusal, a `noop`, or a skip; `sequence` is monotonic per `(topic, lane)`; the declared non-emitted set is empty. Target: 100% of applied mutations, and the emitted-payload-key comparison green for every emitted kind (AC-F6-1..4). Window: GH-292 CI.
- Metric: identity inventory — the queue domain carries exactly seven rows in declared order, both new rows project to exit `1`, every new failure path resolves to a declared row, and the five delivered rows are byte-identical: same text, category, retryability, consequence, projection class, and exit. Target: exact inventory equality, two-sided, with a byte comparison of the delivered five (AC-F7-3, AC-NFR-6). Window: GH-292 CI.
- Metric: untouched surfaces — closeout's step outcomes and exit code are identical with and without the queue hook; the delivered `queue dep` payload and result vocabulary are byte-identical between the two-positional form and `dep add`; `queue release` never removes; no package, subpath, adapter, or schema version is added. Target: zero differences (AC-F2-4, AC-F3-1, AC-NFR-3, AC-NFR-6). Window: GH-292 CI.

## Confidence Rating

**High** for the removal representation, the presence rule, the staleness fact, the byte-identical delivered rows, and the two-identity budget: every input is verified in delivered source — the five declared kinds with their pinned prefixes and scoped reads, the fold with no presence predicate, the monotonic record `sequence` that gives every append one position, the release vocabulary, the holder-identical renewal that writes the requested ref, the admission order around the claim port, the four-kind taxonomy with `remove` declared unemitted, the five queue rows and their projection classes, and the closed delivery-state alias set. The M2 contract section fixes the same shapes in writing, so this record binds a contract that already exists rather than inventing one.

**Medium** for the path-specific precedence, which is a policy decision rather than a delivered behaviour. Its correctness rests on two repo-local facts — the dispatch path claims with the fixed holder `dispatch` and never renews mid-flight, and `queue claim` keeps the delivered renewal for its own holder on the same ref — together with the claim that AC-F4-1, AC-F4-2, and AC-F4-5 cannot all hold under one blanket predicate. The operator impact of the same-holder different-ref refusal is disclosed rather than measured, and the change note and the reconciled pages carry it. AI-generated confidence is not evidence, and the human decider owns acceptance.

## Amendments

| Date | Change | Reason |
|---|---|---|
| 2026-11-12 | DC-1, C-1, the evidence table and the verification metric: presence is decided by the ledger's append position — the delivered monotonic record `sequence` — never by `recordedAt` text. The "tie never resurrects" clause and the timestamp-comparator caveat are withdrawn; a tie cannot occur, and an identical `recordedAt` across a removal and a later re-declaration resolves by append order so the re-declaration restores the entry. | DoR finding R-02 (readiness iteration 1, GH-292): the record fixed the comparator in one sentence and left it open in another, so AC-F1-7's re-declaration case had two readings. |
| 2026-11-12 | DC-2, DC-3, C-4, the rationale, the attestation, driver 4, ALT-3, ALT-4, the trade-offs, the implementation plan and the verification metric: admission outcomes are path-specific and holder-aware. Dispatch admission refuses any live lease whose recorded ref is the requested ref (same or different holder) and refuses another-ref lease with `queue.lease-conflict`; `queue claim` keeps the delivered renewal for its own holder on the same ref, refuses another holder's same-ref lease with `queue.single-flight`, and refuses any other-ref lease with `queue.lease-conflict`. The precedence table is added, and the record states why AC-F4-1, AC-F4-2, and AC-F4-5 hold together only under it. | DoR finding R-01 (readiness iteration 1, GH-292): the previous wording prescribed both `renewed` and `queue.single-flight` for one live same-holder same-ref state, so the three acceptance criteria could not hold simultaneously. PM decision 2026-11-12 (change capsule) fixes the policy; this record captures it. |
| 2026-11-12 | DC-6, C-6, the evidence table, the implementation plan and the verification metric: the permission to generalize the `queue.precondition.unmet` prose is withdrawn. The five delivered queue rows stay byte-identical, and the removal-specific `lease-held` reason appears only in the refusal's bounded `summary`/`detail` text. The unresolved questions are closed. | DoR finding R-05 (readiness iteration 1, GH-292): the specification, acceptance criteria, plan, and the delivered `error-table` pin all require the five rows unchanged, and the record's own open question left delivery unable to satisfy both. PM decision 2026-11-12. |

**Editorial integration.** The correction is marked in `last_updated`, the front-matter `summary`, and this table, and in place at: the Problem Framing, C-1, C-4, C-6, the Evidence table, the mental models, ALT-3, ALT-4, DC-1, DC-2, DC-3, DC-6, the rationale, the condition for revisit, the constraint attestation, both trade-off lists, the Unresolved Questions section (now fully resolved), the Implementation Plan, the Verification Criteria, and the Confidence Rating. The correction replaces an unworkable same-holder statement with the PM-decided policy; the selected alternative, the removal representation, the renewal narrowing's direction, the no-cascade rule, the staleness fact, and the two-identity budget keep their positions. Status stays `Proposed`; acceptance still rides the GH-292 PR review.

## References

- **Change and ticket:** GH-292 "M2-S15: Queue lifecycle completion" — <https://github.com/juliusz-cwiakalski/agentic-delivery-os/issues/292>; change capsule `doc/changes/2026-11/2026-11-12--GH-292--queue-lifecycle/chg-GH-292-pm-notes.yaml`; specification `doc/changes/2026-11/2026-11-12--GH-292--queue-lifecycle/chg-GH-292-spec.md` (§2.1 current state, §5.1 F-1..F-7, §8.1..8.5, §14 OQ-1/OQ-2, §15 DEC-1..DEC-15, §17 ACs, Appendix C exit matrix, Appendix D source map, Appendix E closed vocabularies).
- **Contract authority:** `doc/planning/oss-tooling/milestones/m2/contracts.md` §Queue lifecycle mutations and §Event taxonomy v1; test scenarios SC-M2-S15-01..04 in `doc/planning/oss-tooling/milestones/m2/test-scenarios.md`.
- **Reconciled pages:** `doc/planning/oss-tooling/milestones/m2/commands/queue.md` (identities and envelope) and `doc/planning/oss-tooling/milestones/m1/commands/queue.md` (the help-guide page root).
- **Current system spec:** `doc/spec/features/feature-scheduling-engine.md`, `doc/spec/features/feature-dispatch-engine.md`, `doc/spec/features/feature-closeout.md`, `doc/spec/features/feature-event-taxonomy.md`.
- **Delivered contracts:** `packages/core/src/contracts/queue.ts` (record kinds, prefixes, declarations, error codes); `packages/core/src/contracts/taxonomy.ts` (`queue.graph` kinds and the unemitted `remove`); `packages/core/src/contracts/error-table.ts` (queue rows and projection classes); `packages/core/src/contracts/ports.ts` (`DeliveryStateAlias`); `packages/core/src/contracts/closeout.ts` (step list and additive blocks).
- **Delivered behaviour:** `packages/core/src/domain/queue-graph.ts` (fold and edge retention); `packages/core/src/app/queue.ts` (scoped reads, release, claim, renewal, stale takeover); `packages/core/src/app/dispatch.ts` (admission order and the claim port); `packages/cli/src/commands/queue.ts` (verb grammar); `packages/cli/src/help.ts` (`queue dep` synopsis).
- **Prior decisions:** TDR-0004 (state storage engine — append-only local state), TDR-0005 (delivery result enum and CLI exit taxonomy — the projection classes and `{0, 1, 2}`), TDR-0023 (daemon lifecycle mount and degradation composition — the injected lane seam), TDR-0025 (public event taxonomy v1 — the kind set, envelope, ordering, and version discipline this record extends by one producer), TDR-0027 (the root `detail` slot that carries `detail.holder` for `queue.single-flight`).
- **Decision standard:** `doc/guides/decision-records-management.md`; `doc/templates/decision-record-template.md`.
