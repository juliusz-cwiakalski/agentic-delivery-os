---
change:
  ref: GH-292
  type: feat
  status: Proposed
  slug: queue-lifecycle
  title: "Complete the queue lifecycle: reason-bearing removal, automatic landed removal, dependency edges, per-ref single-flight, and stale reconciliation"
  owners: ["engineering"]
  service: delivery-os
  labels:
    - queue
    - scheduling-engine
    - dispatch-engine
    - closeout
    - events
    - taxonomy
    - contracts
    - cli
    - help
    - m2
  version_impact: minor
  audience: mixed
  security_impact: low
  risk_level: medium
  dependencies:
    internal:
      - "delivered queue graph, lease, park, and incident ledgers and their folds (M1-S17, GH-237)"
      - "delivered scheduling engine: readiness, precedence, claim, release, park recovery (GH-237)"
      - "delivered typed dispatch engine and its admission order (M1-S18, GH-239)"
      - "delivered resident daemon lane seam and supervision cycle (GH-238)"
      - "delivered closeout post-merge transaction with its plan/apply model and fenced single-writer apply (GH-183, GH-240)"
      - "delivered event taxonomy v1 projection and its contract tests (M2-S13, GH-290)"
      - "delivered error table, projection classes, and {0,1,2} exit projection (TDR-0005)"
      - "prompt-required command set, help family inventory, help-guide coverage and reference-page parity guards (GH-242, GH-288)"
    external:
      - "GitHub REST work-item read through the declared credential port (reconcile only; read-only, no write surface)"
links:
  issue: https://github.com/juliusz-cwiakalski/agentic-delivery-os/issues/292
  related_changes: ["GH-292", "GH-284", "GH-237", "GH-238", "GH-239", "GH-240", "GH-290"]
  related_decisions: ["TDR-0005", "TDR-0023", "TDR-0025", "TDR-0026", "TDR-0027"]
  contract_areas:
    - "queue record kinds, payload schemas, key prefixes, and the derived graph document"
    - "queue graph fold, intent mutations, and the ready-set derivation"
    - "queue command grammar, payloads, and result vocabularies"
    - "dispatch admission order and the injected lease-claim port"
    - "closeout plan/apply transaction and its additive data blocks"
    - "event taxonomy declaration and the emission projection"
    - "error table rows, categories, and projection classes"
    - "help family inventory and the help-guide coverage guard"
---

# CHANGE SPECIFICATION

> **PURPOSE**: Close the queue lifecycle so an entry can leave the queue with a recorded reason, leaves automatically once its work lands, has editable dependency edges, cannot run twice at once for one ref on any dispatch path, and can be reconciled against tracker truth — all through the append-only state discipline, with the already-declared `queue.graph` remove kind becoming an emitted kind.

## 1. SUMMARY

The delivered queue is append-only and never loses an entry: `queue release` drops a lane's lease and keeps the entry, dependency edges can only be added, one ref can be dispatched twice concurrently through two different entry paths, and an entry whose work already closed stays in the queue until an operator edits state by hand. This change delivers the five lifecycle operations the M2 planning pack assigns to M2-S15: `queue remove <ref> --reason <landed|abandoned|superseded|reconciled>` (refusing an unqualified removal with `queue.reason-missing`), automatic removal with reason `landed` inside `closeout --apply` after a merge is observed, the explicit `queue dep add` / `queue dep remove` grammar over the delivered two-positional add, a per-ref single-flight guard at dispatch admission that refuses with `queue.single-flight` naming the holder, and `queue reconcile [--ref <ref>]` that removes entries whose tracker work item is `done` or `canceled` with reason `reconciled`.

Every part is additive on a delivered axis. Removal is a new append-only queue record kind whose latest-wins position against the entry record decides presence, so no state file is edited or deleted, the fold drops the entry, and the derived graph document is replaced only when intent truth changes. `queue release` keeps its delivered lease-release meaning and never removes an entry. The event taxonomy's already-declared `queue.graph` kind `remove` — today `emitted: false` with no producer — gains exactly one producer and becomes emitted; the dependency-edge delta event already covers `dep remove` through its declared `removed[]` field. Two error identities are added (`queue.reason-missing`, `queue.single-flight`) and the delivered rows are reused for every other refusal (`queue.entry.unobserved`, `queue.precondition.unmet`, `queue.lease-conflict`, and the `state.*` family for an unreadable store), so the queue domain kind grows from five rows to seven and no delivered row changes meaning.

The one behaviour this change narrows rather than extends is the delivered same-holder lease renewal: a re-claim under an identical holder identity currently renews the repository lease and records the *new* ref, which lets a second ref slip past repository exclusivity and leaves the first ref's guard pointing at a lease that no longer names it. Renewal is narrowed to the same `(repository, ref, holder)`, which is what makes the per-ref guard enforceable at all (§2.2, DEC-13, RSK-3).

## 2. CONTEXT

### 2.1 Current State Snapshot

- **The queue family is mounted and read/write complete except for removal.** The delivered verbs are `ready`, `list`, `plan`, `add`, `prioritize`, `dep`, `claim`, and `release`. There is no `remove` verb, no `reconcile` verb, and `dep` accepts only the two-positional add (`queue dep <ref> <on-ref>`), refusing any second edge in one invocation. `queue add` accepts one `--dep <edge>` per call.
- **`release` is lease release and never removes.** `queue release <ref> [--holder <id>] [--park <cause>] [--until <iso>]` releases the recorded holder's lease and may append a park; a successful release leaves the entry in the queue. Its result vocabulary is `released | parked | noop`.
- **The graph is five record kinds and one derived document.** `queue.entry` (`delivery.queue.entry.v1`, key `queue.entries:<REF>`), `queue.dependency` (`delivery.queue.dependency.v1`, key `queue.deps:<REF>`, payload `ref`, `edges[]`, `recordedAt`), `queue.lease` (keyed by repository, `operation` in `acquired | renewed | released | taken-over`), `queue.park` (`recoveryState` in `parked | clear-observed | recovered | released`), and `queue.incident`; the rebuildable derived document is `queue-graph.json` (`delivery.queue.graph.v1`). The declared record-kind inventory is pinned at exactly five kinds by a fixture-backed contract test.
- **The entry fold is latest-record-wins with no tombstone.** `foldQueueGraph` folds the latest entry record per ref and the latest dependency record per ref; an entry exists iff an entry record exists. Reads are prefix-plus-kind scoped (`readQueueEntries`, `readQueueDependencies`, `readQueueParks`), so a record under a new key prefix and kind is invisible to every delivered fold.
- **Edges are consumer-to-producer and drive ordering and the deploy gate.** `queue.dependency` records the edges *originating at* `ref`; the scheduler holds a consumer whose producer has no entry with the delivered blocking reason `dependency-unobserved` and applies the producer-before-consumer ordering and the deploy-verified gate from the same edge set. A cycle is refused before any append with `queue.dependency-cycle` naming the existing path. The ready set is recomputed from the folded graph on every read; there is no cached ready set to invalidate.
- **The repository lease is keyed by repository, and the claim renews on an identical holder.** `claimQueueLease` folds live leases at most one per repository; a live lease held by another holder refuses `queue.lease-conflict` with a detail naming the holder, lease, heartbeat age, and earliest takeover; a *stale* lease (heartbeat age at or over its TTL) is taken over with full evidence plus a `lease-stale-takeover` incident; and a live lease whose `holder` equals the requester's is **renewed** — the renew record carries the *requested* `ref`, so a second ref claimed under one holder identity rewrites which ref the lease names.
- **Dispatch admission claims that lease once, before any session.** `runDispatch` runs the optional admission preflight, then `ports.claimLease()`, then spawn or resume; a claim refusal is pre-session and appends no attempt record. The production dispatch composition claims with the fixed holder `dispatch`; `queue claim` claims with the caller's holder (default `local`). Nothing consults the *ref* of the live lease: a re-claim by the same holder renews instead of refusing, so two concurrent sessions on one ref are reachable through the two paths.
- **The resident daemon lane seam has no claim of its own.** The supervision cycle takes an injected `claim` port; `daemon-compose` defaults it to a refusal when the composition supplies none, and the production resident-daemon composition supplies no lane executor, so the daemon path is supervise-only in production today and inherits whatever claim port a composition injects.
- **The delivered "single-flight" in the scheduler is a different concept.** The scheduling engine's precedence applies per-pass single-flight (one action per repository per pass), and `repo-free` removes candidates whose repository is leased. Neither is a per-ref refusal, and neither names a holder in a classified error.
- **Closeout is the post-merge transaction and has no queue hook.** `closeout <workItemRef>` plans a deterministic step list, renders it in dry-run mode, and applies only with `--apply` after acquiring the single-writer fence; it resolves the work item, the merged delivery request, the base ref, local branches and worktrees, the merge transaction's bounded diff, retro coverage, session attribution, and the change capsule. Its `data` carries additive non-step blocks (`telemetryCapture`, `residue`, `capsule`). No step and no block touches the queue.
- **Reconcile has no surface at all.** No command reads tracker state for a queue entry. The tracker read surface exists and is already used elsewhere: the closeout provider runtime reads a work item into `WorkItem` with `status: { nativeStatus, deliveryState }` where `deliveryState` is the closed alias set `backlog | ready | in-progress | in-review | done | canceled`, and the dispatch admission preflight performs one bounded work-item read through a declared credential reference with no pagination, retry, or concurrent read.
- **The event taxonomy declares `queue.graph` with four kinds, one of them unemitted.** `entry`, `dependency-edge`, `release`, and `remove`; `remove` is declared `emitted: false` with payload fields `ref`, `reason`, `recordedAt` because no delivered path removes an entry. The emission projection is hand-authored and emits from `queue.entry`, `queue.dependency`, and `queue.lease` (release only), allocating a monotonic `sequence` per `(topic, lane)`. Six named pins cover the unemitted set and its absent producer, and they are exactly the `remove`-emission group of the canonical pin inventory (the test plan's §7.1 table): `event-taxonomy-declaration` asserts the non-emitted list is exactly `["queue.graph/remove"]`; `event-taxonomy-additive` asserts `remove` is never observed and that `emitted === (kind !== "remove")`; `event-taxonomy-conformance` pins `emitted: false` on the live surface; `events-describe` pins the printed non-emitted list; and the `events-emitted-kinds` pair pins the runtime emitted set and scans the event projection for a `remove` literal, which today must be absent because the projection is not a producer.
- **The queue domain kind carries five error rows.** `queue.dependency-cycle`, `queue.lease-conflict`, `queue.park-condition-stuck`, `queue.entry.unobserved`, and `queue.precondition.unmet`; all five are `user-validation` and project to exit `1`, and a contract test pins the queue kind to exactly those five rows in order. The queue domain therefore has no exit-`2` identity of its own: an unreadable, torn, or incompatible queue store is classified by the delivered `state.*` rows, which project to exit `2`. `queue.reason-missing` and `queue.single-flight` do not exist.
- **Exit codes are derived, never literal.** Each error row carries a `projectionClass`; `user-validation` projects to `1`, `platform-provider` to `2`, `attention` to `1`. The machine envelope is the delivered five-field `CommandResult` (`schemaVersion`, `runId`, `exitCode`, `timing`, and `data` or `error`); there is no top-level `ok` or `command`, and `CommandResultError` is the table-derived `code`, `category`, `retryable`, `consequence`, `remediationHint` plus `summary`. The dispatch command adds its own `data.error.detail` object on harness-failure paths.
- **The queue help family documents eight verbs.** The help inventory carries one entry per verb under the `queue` page root; the `queue dep` entry prints the synopsis `queue dep <ref> --on <ref>` and a `--dep` option, which does not match the delivered two-positional grammar. The M1 reference page (`doc/planning/oss-tooling/milestones/m1/commands/queue.md`) is the page root the help-guide coverage check resolves; the M2 page (`.../m2/commands/queue.md`) is planning text whose error table names `queue.entry-unknown`, `queue.state-unavailable`, and an `{ ok, command, data }` example envelope, none of which matches the delivered contract.

**Users and current impact.** An operator finishes a change, merges it, and closes it out, and the queue entry stays; the next `queue plan` still counts a landed ref, a dependent that named it stays held, and the only remedies are a hand edit of the state file or living with the dead entry. An abandoned or superseded ref is permanent for the same reason. A dependency edge declared in error can only be answered by declaring a new entry, because no verb removes an edge. And two dispatch entry paths against one ref can both start a session, because the lease is repository-scoped and a repeat claim by one holder identity renews rather than refuses.

### 2.2 Pain Points / Gaps

- **No entry ever leaves.** The queue only grows. There is no reason-bearing removal, so the ledger cannot say *why* an entry went away even after an operator deletes state by hand.
- **Landing does not close the loop.** A merge followed by closeout leaves the entry in place, so the scheduler keeps evaluating a ref whose work is finished and every dependent on it keeps its edge into a finished producer.
- **Edges are write-only.** `dep` adds; nothing removes. A mistaken or obsolete edge is permanent, and a consumer whose producer left the queue is held `dependency-unobserved` with no supported remedy.
- **One ref can run twice.** The lease is repository-scoped and a same-holder re-claim renews instead of refusing, so two paths against one ref both proceed and the second session's presence is only visible in the lane ledger after the fact.
- **A second ref can hijack the repository lease record.** Because renewal writes the requested ref, claiming ref B under a holder that already holds ref A rewrites the lease's ref to B — the lease then no longer names the running ref, and the repository-exclusivity guarantee is stated but not held.
- **Stale entries need hand editing.** An entry whose tracker item is closed stays until someone edits state, which the append-only discipline forbids and the operator has no supported alternative to.
- **A declared event kind has no producer.** `queue.graph/remove` is published, documented, and pinned as unemitted; a client that writes the `remove` case today writes dead code by contract, and the taxonomy's non-emitted set is a permanent placeholder rather than a delivery gap.

## 3. PROBLEM STATEMENT

Because the queue is append-only with no removal verb, no automatic removal on landing, no way to remove a dependency edge, no per-ref refusal across dispatch paths, and no reconciliation against tracker truth, an operator cannot retire a queue entry or an edge without editing state by hand: landed work keeps occupying the queue, a dependent stays held behind a producer that is gone, one ref can start a second concurrent session, and a declared `queue.graph` remove event has no producer — which leaves every M2 consumer of queue truth and queue events reading a graph that only grows.

**Who is affected.** The operator loses a supported hygiene path and must hand-edit durable state; the scheduler plans over dead entries; agents dispatching through two paths can duplicate a session on one ref; a dependent's work is blocked with no remedy short of a new entry; and every `queue.graph` subscriber carries a `remove` branch that cannot fire.

## 4. GOALS

- **G-1** Take an entry out of the queue with a recorded reason, refusing an unqualified removal (ticket AC; contract §Queue lifecycle mutations).
- **G-2** Remove the ref's entry automatically with reason `landed` after a squash merge and its closeout, without manual action (ticket AC; SC-M2-S15-01).
- **G-3** Make one dependency edge addressable in both directions — `dep add` and `dep remove`, with the delivered two-positional add preserved — and recompute the ready set from the graph (contract §Queue lifecycle mutations; SC-M2-S15-04).
- **G-4** Refuse a second dispatch against a ref with an active lane with a classified error naming the holder, on every dispatch path, starting no second session and mutating nothing (ticket AC; SC-M2-S15-02).
- **G-5** Reconcile stale entries against tracker truth and remove them with reason `reconciled` without editing state files by hand (ticket AC; SC-M2-S15-03).
- **G-6** Publish a `queue.graph` event for every applied queue mutation, making the already-declared `remove` kind an emitted kind whose payload is exactly its declared field list.
- **G-7** Keep the change additive and current-truth: no state rewrite, no hand edit, no `release` meaning change, no new package or subpath, exactly two new error identities, and every delivered queue payload and exit preserved except the declared narrowing of same-holder renewal and the deliberate test-pin moves.

### 4.1 Success Metrics / KPIs

| Metric | Target |
|---|---|
| Ticket acceptance criteria met | 3 of 3 (auto-removal after closeout; single-flight refusal naming the holder; reconciliation without hand editing) |
| M2 test scenarios covered | 4 of 4 (SC-M2-S15-01..04) |
| Queue mutations with a recorded reason | 100% — no removal path exists without a reason, and none writes without a record |
| State files edited or deleted by any new path | 0 — removal is an append; the derived document is the only replaced file and only when intent truth changes |
| Dispatch paths covered by the per-ref policy | 3 of 3 declared paths (`dispatch run`, `queue claim`, daemon supervision claim), each with exactly one outcome per live-lease state per the F-4 precedence table |
| Concurrent sessions per ref | 0 — a second admission for an active ref never starts a session |
| Declared `queue.graph` kinds with a producer | 4 of 4; the non-emitted set becomes empty |
| Delivered error rows changed in meaning | 0; new queue rows 2 (5 → 7) |
| Tracker reads per reconcile run | ≤ 100, one bounded read per examined entry, no retry and no pagination |
| Closeout exit or step outcomes changed by auto-removal | 0 |

### 4.2 Non-Goals

- **NG-1** Redefining `queue release` or making it remove an entry. Release stays lease release with an optional park and takes no removal reason.
- **NG-2** A removal reason vocabulary beyond the four declared values, a free-text reason, or a reason supplied by configuration.
- **NG-3** Cascading removal, edge rewriting for a removed producer, or a graph-wide readiness invariant that refuses removal while another entry depends on it (see OQ-2).
- **NG-4** Widening the lease from repository-exclusive to per-ref, or changing the stale-takeover rule, the lease TTL, or the fence discipline.
- **NG-5** A tracker write surface. Reconciliation reads tracker state; it never closes, labels, or comments on a work item, and it never reads an ambient credential outside the declared port.
- **NG-6** Automatic reconciliation on a timer, inside the daemon loop, or inside closeout. `reconcile` is an operator invocation; closeout performs only the `landed` removal.
- **NG-7** New `queue.graph` kinds, new payload fields, a taxonomy version bump, or new event topics. The change gives the declared `remove` kind its producer and reuses the declared `dependency-edge` delta.
- **NG-8** A new package, workspace subpath, provider adapter, or state schema version.
- **NG-9** Changing the delivered queue read surfaces (`ready`, `list`, `plan`) beyond reflecting the folded graph after a removal.

## 5. FUNCTIONAL CAPABILITIES

| ID | Capability | Rationale |
|----|------------|-----------|
| F-1 | Reason-bearing entry removal (`queue remove <ref> --reason <reason>`) | The queue needs a supported exit for an entry, and the ledger must record why (ticket AC, contract). |
| F-2 | Automatic removal after a merge and its closeout | Landing must retire the entry without operator action (ticket AC, SC-M2-S15-01). |
| F-3 | Explicit dependency-edge grammar (`dep add`, `dep remove`) over the delivered add | A mistaken edge needs the same supported edit path as a declared one (contract, SC-M2-S15-04). |
| F-4 | Per-ref single-flight across every dispatch path | One ref must not run twice; the refusal must name the holder (ticket AC, SC-M2-S15-02). |
| F-5 | Stale-entry reconciliation against tracker truth | A closed work item must be retireable without editing state (ticket AC, SC-M2-S15-03). |
| F-6 | `queue.graph` publication for every applied queue mutation | Clients consume queue change from one declared contract; `remove` stops being a declared-only kind. |
| F-7 | Queue family mount and self-description | The new verbs, the flag, the identities, and the reconciled pages must be reachable and pinned as one surface. |

### 5.1 Capability Details

#### F-1 Reason-bearing entry removal

`queue remove <ref> --reason <landed|abandoned|superseded|reconciled>` takes an entry out of the queue. The reason is required and is a member of the closed four-value vocabulary; the *rendered* reason is the operator's declaration, so `landed` is not reserved for the automatic path and `reconciled` is not reserved for reconciliation.

- **Refusal set.** An unqualified removal is refused with `queue.reason-missing` at exit `1`; nothing is appended and the entry remains. A reason outside the vocabulary, or a missing flag value, is a grammar refusal (`input.value.rejected`) at exit `1` under the delivered grammar path, and appends nothing. A ref with no entry — including a ref already removed — is refused with the delivered `queue.entry.unobserved` at exit `1` and appends nothing; the explicit verb is therefore *not* idempotent, which is deliberate and is disclosed in §8.5 (the automatic path is, see F-2).
- **Removal is an append, not an edit.** An accepted removal appends one removal record carrying the ref, the reason, and the record timestamp, verified post-append inside one fenced transaction. No entry, dependency, lease, park, or incident record is deleted, rewritten, or re-keyed. Presence is decided by the ledger's append position — the delivered monotonic record `sequence` — and never by `recordedAt` text: the entry fold treats the ref as absent when its latest `queue.removal` append is later than its latest `queue.entry` append, so re-declaring the ref restores the entry with no special case (DM-2).
- **A live lease blocks removal.** An entry whose repository lease is live (heartbeat age below the lease TTL) is refused with the delivered `queue.precondition.unmet` at exit `1`, carrying the delivered blocking reason `lease-held` and naming the holder; nothing is appended. The operator releases first (`queue release`), which is the delivered verb for exactly that. Removal never orphans a running lane, and no removal path releases a lease on the operator's behalf (DEC-7, DEC-9; OQ-1 resolved 2026-11-12).
- **An active park is withdrawn, not deleted.** When the entry has an active park, the removal appends the delivered park-withdrawal record (`recoveryState: "released"`, the shape the delivered release-then-failed-lease path already writes) before the removal record, so the park stops participating in the park pass, the recovery incidents, and the lane projection (DEC-6, DM-3). The park history stays durable and the removal adds no park vocabulary.
- **Edges are not rewritten and nothing cascades.** Removal drops the entry and leaves every other entry's edge set exactly as declared. A consumer whose edge names the removed ref is held with the delivered blocking reason `dependency-unobserved` — truthful (the producer is no longer in the queue) and visible in `queue list`/`queue plan` — and the supported remedy is the `dep remove` verb this change adds. The derived graph document is replaced atomically when, and only when, the folded intent truth changed.
- **The derived document and every read surface follow the fold.** After a removal, `queue list`, `queue plan`, `queue ready`, and `lanes` derive from the folded graph with the entry absent and no lane for it; the `queue` snapshot topic reflects the same fold.

#### F-2 Automatic removal after a merge and its closeout

`closeout <ref> --apply` removes the ref's queue entry with reason `landed` when the merge is observed, after the closeout writes succeed. Closeout is the delivered post-merge transaction: it resolves the merged delivery request, so "the work landed" is a fact closeout already reads.

- **Trigger conditions.** The removal runs only in `--apply` mode, only after the closeout steps have completed, and only when the merged delivery request is observed. Plan mode removes nothing; it reports the pending removal. A closeout run for a work item with no observed merge does not remove anything.
- **Idempotency.** A closeout re-run over an already-removed ref, and a closeout for a ref that never had a queue entry, both exit `0` and report the removal as already satisfied. Unlike the explicit verb, the automatic path treats "no entry" as success, because a re-run of a converging transaction must not fail on work it already did.
- **Fail-open.** The removal never changes a closeout step outcome and never changes closeout's exit code. When it cannot run — no merge truth, a live lease, unreadable queue state, or a non-canonical ref — it reports a skipped outcome with a closed reason and the closeout result stands. The lease case is the normal one for a change still being dispatched.
- **Disclosure.** Closeout's `data` gains one additive block carrying the outcome (`removed`, `would-remove`, `satisfied`, `skipped`), the ref, the reason where recorded, and the skip reason where skipped. It is a non-step block like the delivered telemetry and capsule blocks, so the step inventory and its pinning are unchanged. The removal is an append through the same fenced single-writer transaction closeout already holds; it adds no second fence acquisition and no new write location.

#### F-3 Explicit dependency-edge grammar

`queue dep <ref> <on-ref>` stays the delivered two-positional add; `queue dep add <ref> <on-ref>` is the same operation spelled explicitly; `queue dep remove <ref> <on-ref>` removes exactly one edge. All three edit one edge, append one dependency record carrying the resulting folded edge set for the consumer, and let every read recompute readiness from the graph.

- **Add is unchanged.** `dep add` and the two-positional form return the delivered mutation payload with the delivered result vocabulary (`added`, `updated`, `noop`) and refuse a cycle with the delivered `queue.dependency-cycle` at exit `1`, naming the existing path and appending nothing.
- **Remove is a noop when the edge is absent.** Removing an edge that is not declared returns result `noop` at exit `0`, appends nothing, and publishes no event. Refusing would make an idempotent cleanup script impossible and contradicts the delivered `release`/`add` noop convention (DEC-15).
- **Remove cannot create a cycle.** No cycle check runs on removal, and removal is never refused for a cycle reason. The cycle check remains an add-only predicate.
- **Grammar and unknown refs.** Both forms require two canonical work-item refs; a non-canonical ref is the delivered `input.value.rejected`, and a consumer with no entry is the delivered `queue.entry.unobserved`. The producer may be unobserved: the delivered fold retains an edge to a producer with no entry so readiness can report `dependency-unobserved`.
- **The ready set is derived, never cached.** No ready-set state is written or invalidated; the mutation payload reports the refs that became ready as a result of this mutation (empty when none did), and every subsequent read recomputes from the graph.

#### F-4 Per-ref single-flight across every dispatch path

Admission refuses a second session for a ref that already has an active lane, with `queue.single-flight` at exit `1` naming the holder, before any lease, spawn, resume, or record; the claim path keeps its delivered renewal for the caller's own holder.

- **Two paths, one authored precedence (TDR-0026 DC-2/DC-3).** Admission is path-specific, because a blanket `(ref, holder)` predicate cannot satisfy AC-F4-1, AC-F4-2, and AC-F4-5 together: it would either make `renewed` unreachable through `queue claim` or leave a second dispatch admitted. Every requester/state pair has exactly one outcome, and no pair has two:

  | Path | Live lease state | Outcome | Lease record | Session |
  |---|---|---|---|---|
  | `dispatch run`, daemon supervision claim | recorded ref = requested ref (any holder) | `queue.single-flight`, exit `1`, envelope-root `detail.holder` | none | none |
  | dispatch family | recorded ref ≠ requested ref | `queue.lease-conflict`, exit `1` | none | none |
  | dispatch family | no live lease | `claimed` | one `acquired` | the dispatch proceeds |
  | dispatch family | stale lease (heartbeat age ≥ TTL) | `taken-over` + incident evidence | one `taken-over` | the dispatch proceeds |
  | `queue claim` | same ref, caller's own holder | `renewed` | one `renewed` | none — a claim starts no session |
  | `queue claim` | same ref, another holder | `queue.single-flight`, exit `1`, envelope-root `detail.holder` | none | none |
  | `queue claim` | other ref (any holder) | `queue.lease-conflict`, exit `1` | none | none |
  | `queue claim` | no live lease | `claimed` | one `acquired` | none |
  | `queue claim` | stale lease | `taken-over` + incident evidence | one `taken-over` | none |
  | direct `claimQueueLease` seam | same ref, same holder | `renewed` (delivered, unchanged) | one `renewed` | not applicable — the seam spawns nothing |

- **The dispatch family refuses any live same-ref lease, same or different holder.** `dispatch run` and a composed daemon supervision claim share one admission predicate evaluated before any claim, spawn, resume, attempt, or record. The dispatch path claims with the fixed holder `dispatch` and never renews mid-flight, so a live same-ref lease can only name a dispatch that is already running; the second dispatch is by definition a duplicate. This is the case the ticket evidence observed: two sessions on one ref. An other-ref lease refuses the delivered `queue.lease-conflict`, which is repository exclusivity stated as a refusal.
- **`queue claim` keeps the delivered holder-aware outcomes.** A live same-ref lease under the caller's own holder returns `renewed` (idempotent, unchanged, and it starts no session); a live same-ref lease under another holder refuses `queue.single-flight`; a live lease on any other ref refuses the delivered `queue.lease-conflict`. The direct claim seam keeps its delivered same-holder/same-ref renewal, so the two delivered lease controls (`queue-lease` and `queue-lease-concurrency`) stay green with no assertion change. (§8.5, DEC-3, DEC-13, TDR-0026 DC-2/DC-3.)
- **Why the three criteria hold together.** AC-F4-1 is the dispatch row (any holder), AC-F4-2 is the claim row for another holder's same-ref lease together with the own-holder `renewed` row, and AC-F4-5 is the other-ref refusal plus the unchanged direct-seam renewal. `renewed` is therefore reachable through `queue claim` only for the caller's own holder on the same ref.
- **The holder is named at the envelope root.** The refusal carries an additive optional, command-declared `detail` object on the failure envelope whose `holder` is the live lease's holder identity — single line, bounded to 128 characters, identifiers only, with no credential, session id, or payload. `CommandResultError` keeps exactly its six delivered fields, and `error.detail` is rejected as a placement (DM-7, TDR-0027).
- **A stale lease does not refuse.** A lease whose heartbeat age has reached its TTL is not "active": the delivered stale-takeover path applies on both paths, so a crashed session does not block the ref for longer than the delivered TTL. Every path reads the same liveness predicate, so there is one definition of "active".
- **A refusal mutates nothing.** No lease record, no attempt record, no lane record, no queue record, and no event: every refusal happens before the fence and before any append, so the refusal shape is the same on every path.
- **Levels stay distinct.** The scheduling engine's per-pass single-flight (one action per repository per pass) and its `repo-free` readiness condition are unchanged; this policy is an admission predicate over per-ref lease truth plus the claim path's delivered renewal rule. The three are named distinctly in the reconciled pages so one term never carries two meanings (RSK-6).

#### F-5 Stale-entry reconciliation against tracker truth

`queue reconcile [--ref <ref>]` compares queue entries with tracker truth and removes the stale ones with reason `reconciled`, without editing state.

- **Stale is decided from one declared fact.** An entry is stale when its tracked work item's `deliveryState` is `done` or `canceled` — the closed alias set the tracker read already normalises to. Nothing else makes an entry stale: not an absent assignee, not a label, not a missing plan, not an age. A work item that is `backlog`, `ready`, `in-progress`, or `in-review` is retained.
- **Scope.** With no `--ref`, every entry in the invoking checkout's repository is examined; with `--ref`, exactly that entry. The scope is the per-repository queue the state layer already serves, so a reconcile in one checkout never touches another repository's entries.
- **A tracker observation that yields nothing removes nothing.** A work item the tracker does not have is reported as unobserved and retained: a deleted or mistyped item is not evidence that work landed, and the operator's supported exit is `queue remove --reason abandoned`. If the observed record already carries a removal, it is reported as satisfied and not re-removed.
- **An unreadable tracker removes nothing.** When the tracker read fails, the run refuses with the provider adapter's own classified identity and the exit that identity projects (`provider.outage` and `provider.quota.exceeded` at platform class, `provider.auth.rejected` at user class), appends nothing, and reports no partial removal. There is no `queue.*` identity for this case and no partial-success envelope: reconcile either has readable truth for every examined entry or it changes nothing (D2's no-duplicate rule, NFR-9).
- **Bounded.** A run examines at most the declared entry cap (100) and performs at most one bounded read per examined entry — no pagination, no retry, no concurrent read, and no read for an entry beyond the cap. Beyond the cap the payload reports `truncated` with the remainder count rather than silently ignoring the rest; `--ref` is the supported way to narrow a large queue.
- **Output.** The payload reports `result` (`removed` or `noop`), `checked`, the removed refs with reason `reconciled`, the retained refs with the observed `deliveryState`, the unobserved refs, `readySet[]`, `truncated`, and the delivered `degraded[]`. Every removal in the run is an ordinary F-1 removal under the same invariants (append-only, park withdrawal, no edge rewrite).
- **Credential boundary.** The read goes through the injected, declared credential port the composition already resolves for tracker reads; the reconcile path never reads an ambient environment variable, never accepts a token on the command line, and prints no credential material.

#### F-6 `queue.graph` publication for every applied queue mutation

Every applied queue mutation publishes exactly one `queue.graph` event; the already-declared `remove` kind becomes emitted.

- **Removal publishes `remove`.** One event per applied removal, in the ref's lane, with exactly the declared payload fields `ref`, `reason`, and `recordedAt`, and no other key. The kind keeps its declared identity: `remove`, not `removed`.
- **Dependency edits publish `dependency-edge`.** The delivered additive delta already carries `edges[]`, `added[]`, and `removed[]`; `dep remove` populates `removed[]` with the edge it dropped, `dep add` populates `added[]`, and nothing in the payload changes shape.
- **Nothing is published for no work.** A refused mutation, a `noop` dependency removal, and a skipped automatic removal publish no event. A reconcile run publishes one `remove` event per removed ref, in each ref's own lane.
- **Ordering is the projection's.** `sequence` stays a per-`(topic, lane)` monotonic counter allocated at emission; a mutation result names the kind it will publish and never asserts a sequence it cannot know. A gap still means repoll.
- **One taxonomy version.** The write path that produces `remove` carries exactly the declared payload fields, so the delivered emitted-payload-key comparison now covers it and the deliberately-moved pins (§7.1) fail rather than being edited silently.

#### F-7 Queue family mount and self-description

- **Grammar and flag.** `queue remove` requires `--reason <value>`; `queue reconcile` accepts an optional `--ref <value>`; `queue dep` accepts the optional `add`/`remove` verb position before its two refs. Both new flags are declared to the grammar, so a missing value and an unknown flag are classified grammar refusals rather than accidental positionals.
- **Help.** The help surface touches exactly three entries: two new verb entries (`queue remove`, `queue reconcile`) and the existing `queue dep` entry, rewritten to document the dependency grammar it implements. The exact shapes are `queue remove <ref> --reason <landed|abandoned|superseded|reconciled>`, `queue reconcile [--ref <ref>]`, and — under the one `queue dep` entry — `queue dep <ref> <on-ref>`, `queue dep add <ref> <on-ref>`, and `queue dep remove <ref> <on-ref>`. The `queue dep` synopsis is corrected to the two-positional grammar and drops the never-accepted `--on` option. Two new verb help paths are therefore mounted, not four: `dep add` and `dep remove` render inside the `dep` entry and have no separate help path. The family entry lists the new verbs and the `--reason`/`--ref` vocabulary.
- **Reference pages.** The page root the help-guide coverage check resolves documents the new verbs, and the M2 planning page is reconciled to the delivered identity names (no `queue.entry-unknown`, no `queue.state-unavailable`) and to the delivered envelope shape (no top-level `ok`/`command`), so no planning text carries a second, unexecutable contract.
- **Error rows.** The queue domain kind carries exactly seven rows: the delivered five, byte-identical and unreserved, plus `queue.reason-missing` (`user-validation`, exit `1`) and `queue.single-flight` (`user-validation`, exit `1`, retryable). Byte-identical means every delivered field is preserved for all five — `code`, `category`, `retryable`, `consequence`, `projectionClass`, the exit its class projects, `summary`, and `remediationHint` — with no rewording and no added caller (TDR-0026 DC-6). The removal-specific blocking reason `lease-held` travels only in the bounded `summary`/`detail` text the refusal returns, never as an edit to the `queue.precondition.unmet` row. Retryability — a second dispatch succeeds once the holding lane ends — does not change the projection class: the new row projects through `user-validation` to exit `1`, never through a platform class to exit `2`.
- **Boundaries.** No prompt-required command is added (the `queue` family is already prompt-required), and no new package, subpath, or export surface is introduced beyond the contracts this change extends.

## 6. USER & SYSTEM FLOWS

```
Flow 1: remove an entry with a reason
  Operator → queue remove GH-241 --reason abandoned
    → grammar check (reason present and in the vocabulary)
    → fold the graph; entry present? no → queue.entry.unobserved (exit 1, nothing appended)
    → live lease for the ref? yes → queue.precondition.unmet reason=lease-held (exit 1)
    → active park? yes → append the delivered park withdrawal (released), then
    → append one removal record (ref, reason, recordedAt) inside the fence, verified
    → recompute the graph; replace the derived document (intent truth changed)
    → publish queue.graph/remove
    → exit 0 with result removed, reason, readySet[], event kind
```

```
Flow 2: land and close out
  merge lands outside this tool (squash merge on the tracker)
  Operator → closeout GH-241 --apply
    → steps run (ticket, labels, assignee, owed flips, threads, checkout, worktree, branch,
      diff sweep, retro, sessions, capsule); each outcome persisted as delivered
    → merged delivery request observed? no → queueRemoval skipped reason=no-merge-truth
    → entry present? no → queueRemoval satisfied (re-run converges, exit 0)
    → live lease? / unreadable state? → queueRemoval skipped reason=lease-held|state-unavailable
    → append removal reason=landed → publish queue.graph/remove
    → closeout exit and every step outcome unchanged
```

```
Flow 3: edit one edge
  queue dep add GH-243 GH-242      (identical to queue dep GH-243 GH-242)
  queue dep remove GH-243 GH-242
    → one dependency record carries the folded edge set for GH-243
    → queue.graph/dependency-edge with added[] / removed[] naming the edge
    → ready set recomputed on the next read; GH-243 becomes ready when its
      other conditions hold (or held dependency-unobserved while the edge stands)
```

```
Flow 4: single-flight across paths (path-specific precedence, TDR-0026 DC-2/DC-3)
  dispatch run GH-241 ─┐
  daemon lane  GH-241 ─┴→ dispatch admission predicate (before any claim) reads live lease truth
                            ├─ live lease records GH-241 (any holder)
                            │    → queue.single-flight (exit 1), envelope-root detail.holder
                            ├─ live lease records another ref → queue.lease-conflict (exit 1)
                            ├─ stale lease                  → taken-over + incident (as delivered)
                            └─ no live lease                → claim → spawn (as delivered)
                                     every refusal: no session, no lease, no attempt, no event

  queue claim GH-241 --holder H → claim path (delivered outcomes preserved)
                            ├─ live lease on GH-241 held by H   → renewed (no session)
                            ├─ live lease on GH-241 held by another → queue.single-flight
                            │                                        (exit 1), envelope-root detail.holder
                            ├─ live lease on another ref        → queue.lease-conflict (exit 1)
                            └─ no live lease / stale lease      → claimed / taken-over (as delivered)
```

```
Flow 5: reconcile against tracker truth
  Operator → queue reconcile [--ref GH-241]
    → read the entries in this repository (cap 100; truncated + remainder beyond)
    → one bounded work-item read per examined entry through the declared credential port
        ├─ deliveryState done|canceled → remove reason=reconciled → queue.graph/remove
        ├─ other state                 → retained, reported with its deliveryState
        ├─ not found                   → unobserved, retained (abandoned is the operator's verb)
        └─ read failed                 → classified provider identity, remove nothing, exit per class
```

## 7. SCOPE & BOUNDARIES

### 7.1 In Scope

- The `queue remove` verb with the closed reason vocabulary, its refusal set, and its append-only removal record.
- The entry-presence rule that makes a removal supersede an entry and lets a re-declaration restore it.
- Withdrawal of an active park on removal through the delivered `released` recovery state.
- Automatic `landed` removal inside `closeout --apply`, its additive `data` block, its plan-mode disclosure, and its fail-open and idempotent behaviour.
- The `queue dep add` / `queue dep remove` grammar with the delivered two-positional add preserved, the `removed`/`noop` result values, and the recomputed ready set.
- The path-specific per-ref single-flight policy — dispatch-family refusal, `queue claim`'s holder-aware outcomes, the envelope-root `detail.holder` naming, the TTL-based liveness test — and the narrowing of same-holder lease renewal to one `(repository, ref, holder)`.
- `queue reconcile` with `--ref` scoping, the `done`/`canceled` staleness rule, the bounded read budget, and the unreadable/unobserved taxonomy.
- Publication of `queue.graph/remove` and `queue.graph/dependency-edge` for these mutations, and the emission projection's coverage of the `remove` kind.
- The two new error rows and the reuse of the delivered four.
- The deliberate moves of the pins the above changes require. The canonical inventory is the test plan's §7.1 pin table, which is the single source and the authority for every row; this specification states the groups and defers to that table for the rows. The groups are six `remove`-emission pins (`event-taxonomy-declaration` non-emitted list, `event-taxonomy-additive` emitted flag and never-observed assertion, `event-taxonomy-conformance` page pin, `events-describe` printed non-emitted list, `events-emitted-kinds` runtime emitted set, and the `events-emitted-kinds` source scan of the event projection), three registry/baseline pins (`dispatch-attempts-taxonomy` 127 → 129, `error-table-baseline.json`, `state-additivity-baseline.json`), two count pins (queue error rows 5 → 7, queue record kinds 5 → 6), one CLI export pin (`cli-edge-seam` exact export list), and the derived-document golden rule (existing goldens stay byte-identical; new cases are new files). The failure-envelope detail pins this change also moves (type probe, structure pin, runtime conformance key set with its fixture) travel with that table under TDR-0027.
- Help entries for the new verbs, the corrected `queue dep` synopsis, the M1 reference page (the resolved page root), and the M2 page's identity and envelope reconciliation.

### 7.2 Out of Scope

- [OUT] Automatic reconciliation on any schedule, in the daemon loop, or inside closeout (NG-6).
- [OUT] Removing, cascading, or rewriting dependency edges as part of an entry removal (NG-3).
- [OUT] Force-releasing a lease as part of removal, or any removal path that releases a lease (OQ-1).
- [OUT] A tracker write surface in reconcile: no transition, label, assignee, or comment write.
- [OUT] Any change to `queue release`, its park causes, its `until` rule, or its result vocabulary.
- [OUT] Any change to the delivered readiness six-condition model, precedence steps, weight classes, park recovery, or stale takeover.
- [OUT] New event topics, new `queue.graph` kinds, new payload fields on the declared kinds, or a taxonomy version bump.
- [OUT] A per-ref (as opposed to per-repository) lease scope; the guard is an admission predicate over repository lease truth.
- [OUT] A `queue graph` read verb, a removal-history read verb, or a reason-filtered listing.
- [OUT] A new package, workspace subpath, provider adapter, or state schema version.
- [OUT] Resuming, retrying, or otherwise acting on a dependent after its producer is removed.

### 7.3 Deferred / Maybe-Later

- **D-1** A removal-history read surface (removals with reasons and timestamps over a window), which the record already persists but no verb exposes.
- **D-2** `queue reconcile --all-repositories` over a host index, which the per-repository state scope deliberately excludes today.
- **D-3** A resume/redirect path for a consumer whose producer was removed: today it holds `dependency-unobserved` and the operator edits the edge.
- **D-4** An explicit removal reason for a work item that was deleted at the tracker (`unobserved`), if operators report that `abandoned` is not expressive enough.
- **D-5** A bulk `queue remove --reason ... --filter` form, once a reason-filtered read exists.

## 8. INTERFACES & INTEGRATION CONTRACTS

### 8.1 REST / HTTP Endpoints

N/A — this change adds no HTTP, socket, or MCP surface. The interface is the CLI family below, on the delivered machine envelope (`CommandResult`: `schemaVersion`, `runId`, `exitCode`, `timing`, and `data` or `error`; no top-level `ok`, `command`, or `warnings`).

| Invocation | `data` (delivered keys plus additive keys) | Result vocabulary |
|---|---|---|
| `queue remove <ref> --reason <reason>` | `ref`, `result`, `reason`, `readySet[]`, `event: { topic, kind }`, delivered `degraded[]` | `removed` |
| `queue dep <ref> <on-ref>` (delivered) | unchanged: `ref`, `entry`, `edges[]`, `result`, `degraded[]` | `added \| updated \| noop` |
| `queue dep add <ref> <on-ref>` | identical to the two-positional form | `added \| updated \| noop` |
| `queue dep remove <ref> <on-ref>` | `ref`, `entry`, `edges[]`, `result`, `readySet[]`, `event`, `degraded[]` | `removed \| noop` |
| `queue reconcile [--ref <ref>]` | `result`, `checked`, `removed[]` (`ref`, `reason`), `retained[]` (`ref`, `deliveryState`), `unobserved[]`, `readySet[]`, `truncated`, `remainder`, `degraded[]` | `removed \| noop` |

`event` names the topic and kind the mutation publishes (`queue.graph` with `remove` or `dependency-edge`); `sequence` is owned by the event projection and never asserted by a mutation result. Every list is bounded by the delivered caps and the declared reconcile entry cap (100).

### 8.2 Events / Messages

| ID | Topic / kind | Change | Payload |
|---|---|---|---|
| EVT-1 | `queue.graph` / `remove` | `emitted` becomes `true`; one event per applied removal (explicit, automatic, or reconciled) | exactly `ref`, `reason`, `recordedAt` (declared today) |
| EVT-2 | `queue.graph` / `dependency-edge` | `dep remove` becomes a producer; `removed[]` names the dropped edge | unchanged declared fields `ref`, `edges[]`, `added[]`, `removed[]`, `recordedAt` |
| EVT-3 | every other declared kind | no producer change | unchanged |

- `lane` is the entry ref; `ref` equals the lane; `sequence` is monotonic per `(topic, lane)` and unchanged in meaning.
- No event is published for a refused mutation, a `noop` dependency removal, or a skipped automatic removal.
- The declared kind identity stays `remove`; a client switches on `(topic, "remove")` and reads `payload.reason` from the closed four-value vocabulary.
- No frame, topic, envelope field, or taxonomy version changes; the only surface change is that `events describe queue.graph` reports `remove` as emitted and the printed non-emitted list is empty.

### 8.3 Data Model Impact

| ID | Element | Description |
|----|---------|-------------|
| DM-1 | Queue removal record | A new append-only queue record kind `queue.removal`, payload schema `delivery.queue.removal.v1`, key prefix `queue.removals:<REF>`, identity field `ref`, and exactly these declared fields: `schema`, `ref`, `reason`, `recordedAt`, and the additive optional `callerPrincipal`. The caller principal is carried the way the only two delivered queue kinds that declare it — `queue.entry` and `queue.dependency` — carry it; `queue.lease`, `queue.park`, and `queue.incident` do not declare it, so no "every queue record carries it" claim holds. The reason vocabulary is the closed four-value set `landed \| abandoned \| superseded \| reconciled`. |
| DM-2 | Entry-presence rule | An entry is present iff the latest `queue.entry` append for the ref is later than the latest `queue.removal` append for the ref, where "later" is the ledger's append position — the delivered monotonic record `sequence` — and never `recordedAt` text. A tie is impossible because each append occupies exactly one position, so the ref's latest entry append and latest removal append are strictly ordered; an identical `recordedAt` across a removal and a later re-declaration is resolved by append order, and the later re-declaration restores the entry. With no removal append for the ref, the entry record's existence is the whole predicate. The rule is the fold's only presence predicate, so re-declaration restores an entry and no record is ever deleted. |
| DM-3 | Park withdrawal on removal | The delivered `queue.park` record with `recoveryState: "released"` and its delivered fields, appended before the removal record when an active park exists. No new park field, state, or cause. |
| DM-4 | Derived graph document | `queue-graph.json` (`delivery.queue.graph.v1`) is replaced atomically when and only when the folded intent truth changes; a removal removes the entry from the document and leaves every other entry's edges as declared. |
| DM-5 | Mutation payloads | The removal payload (`ref`, `result`, `reason`, `readySet[]`, `event`, `degraded[]`), the dependency-removal payload (delivered mutation keys plus `readySet[]` and `event`, with the result set extended by `removed`), and the reconcile payload (`result`, `checked`, `removed[]`, `retained[]`, `unobserved[]`, `readySet[]`, `truncated`, `remainder`, `degraded[]`). |
| DM-6 | Closeout queue-removal block | One additive `closeout.v1` `data` block: `outcome` in `removed \| would-remove \| satisfied \| skipped`, `ref`, optional `reason`, optional `skipReason` in `no-merge-truth \| lease-held \| state-unavailable \| ref-not-canonical`. It is a non-step block; the step inventory is unchanged. |
| DM-7 | Single-flight refusal detail | The failure envelope (`CommandResultFailure`) gains an additive optional, command-declared `detail` object at the envelope root; `queue.single-flight` populates `detail.holder` with the live lease's holder identity, single line, bounded to 128 characters, identifiers only, with no credential, session id, or provider payload. `CommandResultError` keeps exactly its six delivered fields (`code`, `category`, `retryable`, `consequence`, `remediationHint`, `summary`); `error.detail` is the rejected placement, the success-shaped dispatch `data.error.detail` slot is unchanged, and the exit stays the row's projection class (`user-validation` → `1`) (TDR-0027 ALT-3). |
| DM-8 | Declared inventories | The queue record-kind declaration list grows from five kinds to six (adding DM-1), and the queue error-row inventory from five rows to seven. Both are declared contract inventories with fixture-backed equality pins that move in this change. |

### 8.4 External Integrations

- **GitHub REST work-item read (read-only).** `queue reconcile` reads one work item per examined entry through the tracker client the composition already builds, normalised to `WorkItem` with `status.deliveryState`. One bounded read per entry, no pagination, no retry, no concurrent read; the credential comes from the declared credential port and is never printed. No tracker write of any kind is performed.
- **No other integration.** The removal, the automatic removal, and the dependency edits are local state appends; the closeout removal reads no provider and writes no provider. No new vendor, network location, or ambient credential read is introduced.

### 8.5 Backward Compatibility

- **Additive on every payload.** `queue list`, `plan`, `ready`, `add`, `prioritize`, `claim`, `release`, and `lanes` keep their delivered keys, result vocabularies, and exits. The delivered two-positional `queue dep` keeps its delivered payload and result vocabulary byte-for-byte; `dep add` is the same operation under an explicit spelling.
- **`queue release` is untouched.** It still releases a lease and never removes an entry; an operator who read the ticket's "removal/release with reasons" wording as one verb gets a second verb, not changed semantics for the first.
- **One policy, two paths — disclosed.** Admission outcomes are path-specific and holder-aware (F-4, TDR-0026 DC-2/DC-3). A live lease on *another* ref re-claimed under an identical holder identity was renewed and rewrote the lease's ref; it now refuses the delivered `queue.lease-conflict` on both paths, and the live lease's recorded ref is unchanged. A dispatch against a live lease that records the requested ref now refuses `queue.single-flight` instead of proceeding — including under the same holder identity, because the dispatch path claims with the fixed holder `dispatch` and never renews mid-flight. `queue claim` keeps its delivered renewal: the caller's own holder on the same ref returns `renewed`, another holder's same-ref lease refuses `queue.single-flight`, and any other-ref lease refuses `queue.lease-conflict`. `queue claim` therefore keeps `claimed`, `renewed`, and `taken-over`, with `renewed` reachable only for the same ref under the caller's own holder; the two delivered direct-claim lease controls stay green with no assertion change. A workflow that claimed two refs sequentially without releasing the first between them now receives a refusal it can act on; a workflow that released between claims is unaffected.
- **Removal is not idempotent for the explicit verb.** A second `queue remove` for the same ref refuses with `queue.entry.unobserved` (the delivered unknown-entry identity), matching `queue prioritize` and `queue dep add`; the automatic closeout path instead reports `satisfied`. The asymmetry is intentional and documented (DEC-8).
- **The reason vocabulary is closed.** A reason outside the four values is refused; no free text is accepted, so no unclassified reason can enter the ledger.
- **Event consumers see one new producer.** A client that already handles `remove` starts receiving it; a client that switches exhaustively over the four kinds is unaffected because the kind was already declared. The taxonomy version does not change: the kind set, payload fields, ordering rule, and overflow policy are unchanged.
- **Test pins move deliberately.** The pin inventory is the test plan's §7.1 table, and every entry in it changes with the behaviour it describes: the six `remove`-emission pins (including the source scan that today asserts the event projection carries no `remove` literal), the three registry/baseline pins, the two count pins (queue error rows 5 → 7, queue record kinds 5 → 6), the one CLI export pin, and the derived-document golden rule, together with the failure-envelope detail pins. Each asserts the new truth beside the retained one — never silenced, never relaxed to an inequality, and never deleted (§18, §17.9).

## 9. NON-FUNCTIONAL REQUIREMENTS (NFRs)

| ID | Requirement | Threshold |
|----|-------------|-----------|
| NFR-1 | Mutation atomicity and refusal purity | Every accepted queue mutation appends inside one fenced transaction and verifies each append post-append; a refused mutation appends exactly 0 records and changes 0 files, and the derived document is replaced only after the appends verify. |
| NFR-2 | Single-flight admission cost and blast radius | The guard costs at most 1 additional whole-store read at admission; a refusal appends 0 lease, attempt, lane, or queue records, starts 0 sessions, and opens 0 sockets. |
| NFR-3 | Closeout auto-removal cost and fail-open | At most 1 queue fold and 2 appends (park withdrawal, removal) per closeout apply, and at most 1 read when no entry exists; closeout's exit code and every step outcome are identical with and without the removal. |
| NFR-4 | Reconcile read budget | At most 100 examined entries per run, exactly 1 bounded tracker read per examined entry, no retry, no pagination, no concurrent read, and no read beyond the cap; beyond the cap `truncated` is true with an exact remainder. |
| NFR-5 | Event completeness and ordering | Each applied removal is emitted exactly once by the projection, on the first publish tick that observes its durable record; `sequence` strictly increases per `(topic, lane)`; and 0 events are published for a refusal, a noop, or a skip. |
| NFR-6 | Bounded output | `remove` carries exactly 3 payload fields; `reconcile` lists are capped at 100 refs; the refusal detail is ≤ 128 characters, single line; every queue payload stays within the delivered byte bounds and adds no unbounded field. |
| NFR-7 | Additive boundary | 0 new packages, 0 new workspace subpaths, 0 new provider adapters, 0 state schema-version changes, and 2 new error rows; the contract inventories equal the tree in both directions after the declared additions. |
| NFR-8 | Credential and privacy boundary | The reconcile read uses only the declared credential port (0 ambient environment reads, 0 command-line tokens), and no output, event, record, or log carries a credential, token, provider payload, prompt, diff, or repository content. |
| NFR-9 | Failure classification | Every new failure path resolves to one existing or newly declared error row and the exit its projection class yields; `0` success, `1` refusal, `2` platform/state/provider — no new exit value, no literal exit digit outside the projection module. |
| NFR-10 | Convergence and idempotency | 100% of re-runs converge: a repeated closeout apply over a removed ref exits 0, a repeated `dep remove` of an absent edge is a noop at exit 0, and a repeated reconcile over an already-reconciled ref removes nothing and exits 0. |

## 10. TELEMETRY & OBSERVABILITY REQUIREMENTS

- **Event stream is the observability surface.** Each applied removal, and each applied dependency edit, is observable on `queue.graph` with its declared payload and a monotonic per-lane sequence. A subscriber to `queue.graph` can reconstruct the graph's intent history from `entry`, `dependency-edge`, `release`, and `remove` events alone, which is what the removal producer completes.
- **Reason is machine-readable.** `payload.reason` carries the closed vocabulary value, so a board or retro can distinguish landed, abandoned, superseded, and reconciled retirements without parsing prose.
- **Command-level disclosure.** `queue remove`, `queue dep remove`, and `queue reconcile` return the mutated refs and the resulting ready set; closeout returns its queue-removal outcome and skip reason. No new telemetry sink, metric, or counter is added, and no new audit-ledger record; the one new queue-ledger record kind is the removal record (DM-1), and §22 states its growth. The delivered audit ledger, telemetry capture, and session attribution are unchanged.
- **Refusals are classified, not silent.** `queue.reason-missing`, `queue.single-flight` (with the envelope-root `detail.holder`), `queue.precondition.unmet` (`lease-held`), `queue.entry.unobserved`, and the provider identities carry the delivered remediation hint, so an operator or an agent can act on the refusal without reading state.
- **No secret reaches an observable.** The refusal detail, the reconcile payload, and the removal event carry identifiers, closed vocabulary values, and timestamps only (NFR-8).

## 11. RISKS & MITIGATIONS

| ID | Risk | Impact | Probability | Mitigation | Residual Risk |
|----|------|--------|-------------|------------|---------------|
| RSK-1 | Removing a producer leaves consumers held `dependency-unobserved` with no automatic remedy | M | M | The state is truthful and visible in `queue list`/`plan`; the change adds `dep remove`, which is the remedy; §5.1 F-1 and the glossary state the no-cascade rule | An operator who expected a cascade must edit edges explicitly (D-3) |
| RSK-2 | A removal is applied while a lane is running, orphaning the session | H | L | Removal refuses on a live lease with `queue.precondition.unmet` reason=`lease-held`, naming the holder; the delivery is verified post-append | A crashed session within its TTL delays removal until the TTL elapses (delivered staleness rule) |
| RSK-3 | The per-ref guard is bypassed through the same-holder renewal path | H | M | Renewal is narrowed to `(repository, ref, holder)`; a same-holder claim for another ref refuses `queue.lease-conflict`; the guard compares the requested ref to the live lease's ref | A pre-existing lease written before this change may name a ref that does not match a running session; the first refusal surfaces it |
| RSK-4 | Reconcile removes an entry whose work is not actually finished | H | L | Staleness is one declared fact (`deliveryState` `done`/`canceled`); an unreadable or unobserved read removes nothing; every removal is an ordinary append with a reason, so a wrong removal is visible and recoverable by re-declaring the ref | A tracker that reports `done` for unfinished work produces a wrong removal; the re-declaration path exists |
| RSK-5 | Auto-removal fails or blocks closeout | H | L | The removal runs after the closeout writes, never changes a step outcome or the exit code, and reports `skipped` with a closed reason; a missing entry is `satisfied` | An operator who wanted the removal must read the block and act; the block is printed in plan and applied mode |
| RSK-6 | "Single-flight" collides with the delivered scheduler term | M | M | The reconciled pages and the glossary name the two concepts distinctly: per-pass single-flight (scheduling) versus per-ref admission refusal (dispatch admission) | A reader of an un-reconciled page may conflate them until the page is updated |
| RSK-7 | The deliberate pin moves are applied silently or partially | M | M | §7.1 names the complete inventory once — the test plan's §7.1 table: six `remove`-emission pins, three registry/baseline pins, two count pins, one CLI export pin, the derived-document golden rule, and the failure-envelope detail pins — and §18, §17.9 and DEC-14 restate only those groups; the guards run in the same change and are never relaxed to inequalities | A pin can still be updated wrongly; the inventory equality checks fail in both directions |
| RSK-8 | Reconcile exhausts tracker quota on a large queue | M | M | The 100-entry cap, one bounded read per entry, no retry, and `--ref` scoping; `provider.quota.exceeded` is the classified outcome and removes nothing | An operator with a 200-entry queue needs two runs or a scoped run |
| RSK-9 | Removal/entry ordering regresses so a re-declared entry vanishes | M | L | The presence rule is the fold's single predicate and is covered by an acceptance criterion (re-declare restores); the derived document follows the fold | A store written by a future writer with a different ordering rule would need its own migration |
| RSK-10 | Reconcile reads the wrong repository's tracker truth | M | L | Scope is the invoking checkout's per-repository queue and its resolved repository binding; entries carry their repository | A host with two checkouts of one tracker repository reconciles each from its own scope, which is the delivered isolation rule |

## 12. ASSUMPTIONS

- **A-1** Closeout runs after a merge and already reads merge truth: the merged delivery request is the signal that the work landed. The tool does not perform the merge.
- **A-2** The tracker surface can answer a work-item read for the repository's tracker kind, with the delivered closed `deliveryState` alias set. A tracker kind with no read surface is an `unavailable` observation (the delivered closeout vocabulary), so reconcile removes nothing there.
- **A-3** A queue entry's repository is resolvable from the per-repository state scope (and, where present, the entry's own `repository` field), so both the lease check and the tracker scope address one repository.
- **A-4** The four reason values are the complete vocabulary for this milestone; no consumer needs a fifth.
- **A-5** The delivered event projection can allocate a sequence for a new source record family without changing the frame shape, as it does for the three emitted families today.
- **A-6** The resident daemon's production composition stays supervise-only, so the daemon path's guard is exercised through a composed supervision claim rather than a live production spawn.

## 13. DEPENDENCIES

| Direction | Item | Notes |
|-----------|------|-------|
| Depends on | Delivered queue graph, lease, park, and incident ledgers and their folds (M1-S17, GH-237) | Removal is a new record in the same append-only discipline; the presence rule extends the existing fold. |
| Depends on | Delivered dispatch admission order (M1-S18, GH-239) | The guard runs at admission, before the lease claim, spawn, and resume. |
| Depends on | Delivered daemon lane seam and supervision cycle (M1-S18, GH-238) | The daemon path inherits the guard through the injected claim port. |
| Depends on | Delivered closeout plan/apply transaction and its fenced apply (GH-183, GH-240) | The automatic removal runs after the writes, inside the held fence, as a non-step block. |
| Depends on | Delivered event taxonomy v1 and its projection (M2-S13, GH-290) | `remove` is already declared with its payload fields; this change supplies the producer and moves the `remove`-emission pins listed in the canonical pin table (test plan §7.1). |
| Depends on | Delivered tracker read surface and credential port | Reconcile's only external read; read-only, bounded, declared credential. |
| Blocks | M2-S19 cross-repository change plan shape | Its per-member release/removal rule and per-member lanes assume a reason-bearing removal exists. |
| Blocks | M2-S16 engine-first operations and M2-S18 queue/lane representation | Both consume a queue whose landed entries retire and whose edges are editable. |
| Related | `TDR-0005` result contract, `TDR-0023` daemon lane seam, `TDR-0025` event taxonomy | Preserved contracts; no amendment required by this change. |
| Binding | `TDR-0026` queue lifecycle removal and single-flight (`DC-1`..`DC-6`) | Fixes the removal kind and presence order, the path-specific admission policy and renewal narrowing, the non-cascading removal, the staleness fact, and the two-identity budget (F-1..F-7). |
| Binding | `TDR-0027` command failure envelope detail slot (ALT-3) | Fixes the envelope-root optional `detail`, the six-field `CommandResultError`, and the rejection of `error.detail` (DM-7, AC-F4-1, AC-F4-2, AC-NFR-5). |

## 14. OPEN QUESTIONS

| ID | Question | Context | Status |
|----|----------|---------|--------|
| OQ-1 | Should `queue remove` refuse while the ref's lane lease is live, or release the lease and remove in one step? | The specification records the refusal (F-1, AC-F1-5, DEC-9): removal never orphans a running lane, and `queue release` is the delivered verb for dropping a lease. The alternative is a convenience that couples two authorities in one invocation and can retire an entry whose session is still writing. A human should confirm the operator workflow, because "abandoned mid-run" is a plausible real case. | Resolved — PM decision 2026-11-12 (DEC-9, adopted as recommended) |
| OQ-2 | Should removal be refused while another entry still depends on the removed ref, or allowed with the dependent held `dependency-unobserved`? | The specification allows it (F-1, AC-F1-8, DEC-10) and treats `dep remove` as the remedy, so no new refusal identity or graph-invariant check is added. The alternative refuses with a named blocking reason and forces edge cleanup first, which is stricter but adds a refusal the contract does not enumerate. | Resolved — PM decision 2026-11-12 (DEC-10, adopted as recommended) |

## 15. DECISION LOG

| ID | Decision | Rationale | Date |
|----|----------|-----------|------|
| DEC-1 | Scope authority is the M2 planning pack; exactly five behaviours — reason-bearing removal, automatic landed removal, dependency add/remove, per-ref single-flight, reconciliation. `queue release` keeps its delivered meaning and never removes. | The ticket's "entry removal/release with reasons" wording is disambiguated by the planning pack's contract section, which keeps release as lease release and adds `remove`. Scope stays exactly the story. | 2026-11-12 |
| DEC-2 | Exactly two new error identities: `queue.reason-missing` and `queue.single-flight`. An unknown ref reuses the delivered `queue.entry.unobserved`; unreadable state reuses the delivered `state.*` rows; no `queue.entry-unknown`, no `queue.state-unavailable`. | Error rows are unique identities; a synonym row for an existing meaning is a duplicate contract. The M2 page is reconciled to the delivered names instead. | 2026-11-12 |
| DEC-3 | Single-flight is enforced at dispatch admission as a separate per-ref guard over live lease truth, with path-specific holder-aware outcomes; the lease stays repository-exclusive. | Matches the M2 evidence (a second concurrent session on one ref) without rewriting the delivered lease contract, and puts the refusal where the duplicate can start. The dispatch family refuses any live same-ref lease (it never renews mid-flight); `queue claim` keeps the delivered own-holder renewal and refuses another holder's same-ref lease — the only reading under which AC-F4-1, AC-F4-2, and AC-F4-5 hold together (TDR-0026 DC-2/DC-3). | 2026-11-12 |
| DEC-4 | Removal is append-only state truth: one removal record lands in the queue ledger and the fold drops the entry; nothing is deleted or hand-edited; the derived document is replaced atomically only when intent truth changes. Automatic removal runs inside `closeout --apply` after the closeout writes succeed. | The state layer's discipline forbids rewriting, and the merge itself is outside this tool's write surface, so closeout is the correct trigger. | 2026-11-12 |
| DEC-5 | The removal is a new record kind (`queue.removal`, `delivery.queue.removal.v1`, key `queue.removals:<REF>`) with an append-position presence rule against the entry record (the latest append wins; `recordedAt` is never compared), rather than a tombstone field on `queue.entry`. | A tombstone field would change a delivered payload schema and make every historical entry record ambiguous; a new kind is additive, invisible to the delivered prefix-scoped folds, and keeps re-declaration free. | 2026-11-12 |
| DEC-6 | An active park is withdrawn on removal with the delivered `queue.park` `released` recovery record, appended before the removal. | The delivered release-then-failed-lease path already writes that state, and the park pass already excludes `released`; reusing it needs no new park field, state, or cause. | 2026-11-12 |
| DEC-7 | `queue.lease-conflict` and `queue.precondition.unmet` are reused for the two removal refusals that are not about the entry existing: a live lease refuses `queue.precondition.unmet` with blocking reason `lease-held`, and a removal-ready dependency state is not a refusal at all. | Both identities and the `lease-held` blocking reason are delivered and already carry the right exit and remediation; adding removal-specific identities would duplicate them. | 2026-11-12 |
| DEC-8 | The explicit `queue remove` is not idempotent (a repeat refuses `queue.entry.unobserved`) while the automatic closeout removal is (a repeat reports `satisfied`). | The explicit verb matches the delivered convention for unknown entries (`prioritize`, `dep add`); the automatic path must converge because closeout is a re-runnable transaction. | 2026-11-12 |
| DEC-9 | A removal is refused while the ref's lane lease is live, naming the holder; no removal path releases a lease. | Removal never orphans a running session, and `queue release` is the delivered authority for dropping a lease; coupling both in one verb would let a removal retire an entry whose session is still writing. | 2026-11-12 |
| DEC-10 | Removal does not cascade and does not rewrite another entry's edges; a consumer whose producer was removed is held `dependency-unobserved`, and `dep remove` is the supported remedy. | The held state is truthful and visible, removal stays one edge-free append, and the change already delivers the verb that clears the edge; a refusal would add a graph invariant and an identity the contract does not enumerate. | 2026-11-12 |
| DEC-11 | Reconciliation's staleness fact is the tracker's normalised `deliveryState` of `done` or `canceled`; an unreadable read refuses with the provider's own identity and removes nothing; a not-found work item is retained and reported unobserved. | One declared fact keeps the rule auditable; a provider identity is the honest classification and needs no new `queue.*` row; a missing item is not evidence that work landed, and `abandoned` is the operator's verb for that. | 2026-11-12 |
| DEC-12 | A mutation result names the event topic and kind it will publish and never a `sequence`; ordering remains the projection's per-`(topic, lane)` counter. | The write path cannot know the emission-time sequence, and the delivered contract assigns sequence allocation to emission; asserting one would be a fabricated fact. | 2026-11-12 |
| DEC-13 | Same-holder lease renewal is narrowed to the same `(repository, ref, holder)`; a same-holder claim for another ref refuses the delivered `queue.lease-conflict`. | The delivered renewal rewrites the lease's ref, which both breaks repository exclusivity and makes the per-ref guard bypassable; the narrowing is what the repository-exclusive contract already claims. Accepted into scope by the PM decision of 2026-11-12 as a defect fix required for AC-F4. | 2026-11-12 |
| DEC-14 | The pin inventory is the test plan's §7.1 table, and every entry moves deliberately in the same delivery as the behaviour: the six `remove`-emission pins, the three registry/baseline pins, the two count pins, the one CLI export pin, the derived-document golden rule, and the failure-envelope detail pins. | Pins exist to fail when a contract moves; moving them with the delivering change keeps the two-sided equality that makes drift detectable. One canonical table is what stops the specification, test plan, and plan from counting the same pin set three ways. | 2026-11-12 |
| DEC-15 | `dep remove` of an absent edge is a `noop` at exit `0`; it appends nothing and publishes no event. | The delivered convention for "the requested end state already holds" is `noop` (`queue release` with no lease, an identical `queue add`), and refusing would make an idempotent cleanup script impossible. A removal cannot close a cycle, so no cycle check runs on it. | 2026-11-12 |

## 16. AFFECTED COMPONENTS (HIGH-LEVEL)

**Documentation ownership split — two sets, no overlap.** *In-plan* pages are authored or rewritten by the delivery itself, in the phase that delivers the behaviour they describe (the change's own contract, help, and planning pages). *Phase-7* pages are current-truth pages reconciled by `@doc-syncer` after delivery (`system_spec_update`). No page appears in both sets, and a page that states a count the change alters is in the phase-7 set.

| Component | Impact |
|-----------|--------|
| Queue graph fold and intent mutations (scheduling engine) | Updated — new removal record kind and presence rule, dependency-edge removal, park withdrawal on removal, derived-document refresh |
| Queue contract module | Updated — removal kind/schema/key prefix, removal and dependency-removal and reconcile payload shapes, closed reason vocabulary, result vocabularies, record-kind declaration list (5 → 6) |
| Dispatch admission | Updated — the path-specific per-ref admission policy over live lease truth (dispatch-family refusal; `queue claim`'s holder-aware outcomes), the envelope-root `detail.holder` and its optional envelope slot, and lease-renewal narrowing |
| Daemon lane seam and supervision cycle | Updated — the supervision claim belongs to the dispatch family and inherits the F-4 admission predicate through the injected claim port; no new port |
| Closeout transaction | Updated — additive `data` queue-removal block, plan-mode disclosure, post-write removal inside the held fence; step inventory unchanged |
| Event taxonomy declaration and emission projection | Updated — `remove` becomes emitted; the projection gains the removal family; no kind, field, version, or ordering change |
| Error table | Updated — two new queue rows (`queue.reason-missing`, `queue.single-flight`); the delivered five stay byte-identical field by field |
| CLI `queue` command family and edge composition | Updated — `remove`, `reconcile`, `dep add`/`dep remove`, `--reason` and `--ref` flags, the injected tracker read port and removal seams |
| CLI help surface | Updated in-plan — family entry, two new verb entries (`remove`, `reconcile`), and the rewritten `queue dep` entry carrying the three accepted dependency spellings and the corrected two-positional synopsis; no separate `dep add`/`dep remove` help path |
| M1 queue reference page (the help-guide page root) | Updated in-plan — the new verbs, the reason vocabulary, the path-specific single-flight policy and its envelope-root `detail.holder`, reconcile, and the exit matrix |
| M2 `commands/queue.md` planning page | Updated in-plan — error table reconciled to delivered identities (`queue.entry.unobserved`, no `queue.state-unavailable`), delivered envelope shape, `queue.graph/remove` spelling, and the reconcile contract |
| M2 `contracts.md` planning page | Updated in-plan — §Event taxonomy v1 states `remove` as emitted with exactly `ref`, `reason`, `recordedAt`, and §Queue lifecycle mutations states the append-position presence rule and the path-specific single-flight policy instead of "`emitted: false`; no v1 path produces it" |
| M2 `architecture.md` planning page | Updated in-plan — §Single-flight refusal shows the F-4 precedence (a refusal appends nothing and publishes no `dispatch.attempt` event, where the page today says it does), and §Queue auto-release places the `landed` removal after the closeout writes and before the ready-set recomputation |
| `doc/spec/features/feature-scheduling-engine.md`, `feature-dispatch-engine.md`, `feature-closeout.md`, `feature-event-taxonomy.md` | Updated in the phase-7 `@doc-syncer` reconciliation — removal and the append-position presence rule, the path-specific per-ref admission policy and renewal narrowing, the closeout removal block, and the emitted `remove` kind |
| `doc/spec/features/feature-state-layer.md` | Updated in the phase-7 `@doc-syncer` reconciliation — the queue record-kind inventory moves from five kinds to six with `queue.removal` (`delivery.queue.removal.v1`, key `queue.removals:<REF>`), wherever the page states that count |
| `doc/spec/features/feature-result-contract.md` | Updated in the phase-7 `@doc-syncer` reconciliation — the `queue` kind's five scheduling rows become seven, at the cross-feature line that states the count, and the envelope's optional command-declared `detail` member is documented with its bound |
| `doc/00-index.md`, the glossary, or any other page stating the queue record-kind or queue error-row count | Updated in the phase-7 `@doc-syncer` reconciliation if it carries the changed count; a page that states neither is left untouched |
| Contract/state fixtures and structure tests | Updated in-plan — every entry of the canonical pin table (test plan §7.1): the six `remove`-emission pins, the three registry/baseline pins (`dispatch-attempts-taxonomy` 127 → 129, `error-table-baseline.json`, `state-additivity-baseline.json`), the two count pins (queue rows 5 → 7, record kinds 5 → 6), the CLI export pin, and the derived-document golden rule, plus the failure-envelope detail pins and inventory entries for the new modules and exports |
| `doc/planning/oss-tooling/backlog.md` (M2-S15 row) | Updated in-plan — story status follows delivery, as the planning convention requires |

## 17. ACCEPTANCE CRITERIA

### 17.1 Reason-bearing removal

| ID | Criterion | Linked |
|----|-----------|--------|
| AC-F1-1 | **Given** an observed queue entry, **when** `queue remove <ref> --reason abandoned` runs, **then** it exits `0`, `data.result` is `removed`, `data.reason` is `abandoned`, the ledger holds one removal record for the ref, `queue list` and `queue plan` no longer show the entry, `lanes` shows no lane for it, and the derived graph document lists no entry for that ref. | F-1, DM-1, DM-2, DM-4, NFR-1 |
| AC-F1-2 | **Given** an observed entry, **when** `queue remove <ref>` runs without `--reason`, **then** it exits `1` with `error.code == "queue.reason-missing"`, appends zero records, and leaves the entry present. | F-1, NFR-1, NFR-9 |
| AC-F1-3 | **Given** an observed entry, **when** `queue remove <ref> --reason <value>` runs with a value outside `landed \| abandoned \| superseded \| reconciled` or with no value, **then** it exits `1` with `error.code == "input.value.rejected"` and appends zero records. | F-1, NFR-1 |
| AC-F1-4 | **Given** a ref with no entry, or a ref already removed, **when** `queue remove <ref> --reason landed` runs, **then** it exits `1` with `error.code == "queue.entry.unobserved"` and appends zero records. | F-1, DEC-8 |
| AC-F1-5 | **Given** an entry whose repository lease is live, **when** `queue remove <ref> --reason abandoned` runs, **then** it exits `1` with `error.code == "queue.precondition.unmet"`, a `lease-held` blocking reason, the holder named, and zero appended records; after `queue release <ref>` the same removal succeeds. | F-1, DEC-9, NFR-1 |
| AC-F1-6 | **Given** an entry with an active park, **when** the removal is applied, **then** a `queue.park` record with `recoveryState: "released"` is appended before the removal record, the park pass evaluates no park for that ref afterwards, the lane projection shows no parked lane, and no park cause, condition type, or recovery state is added. | F-1, DM-3 |
| AC-F1-7 | **Given** a ref that was removed, **when** `queue add <ref>` declares it again — including when the re-declaration carries a `recordedAt` identical to the removal's — **then** the entry is present because its latest `queue.entry` append is later than its latest `queue.removal` append in ledger position, it appears in `queue list`, and no removal record is deleted or rewritten. | F-1, DM-2, TDR-0026 DC-1 |
| AC-F1-8 | **Given** an entry `B` whose edge set names a removed ref `A`, **when** the graph folds after the removal, **then** `B`'s edge set is unchanged, `B` is held with blocking reason `dependency-unobserved`, and no other entry's records were appended by `A`'s removal. | F-1, DEC-10, RSK-1 |

### 17.2 Automatic removal after closeout

| ID | Criterion | Linked |
|----|-----------|--------|
| AC-F2-1 | **Given** a ref with an observed queue entry and an observed merged delivery request, **when** `closeout <ref> --apply` completes its steps, **then** the ref has zero remaining queue entries, the ledger records one removal with `reason == "landed"`, the `queueRemoval` block reports `outcome: "removed"` with `reason: "landed"`, and a `queue.graph/remove` event is published. | F-2, F-6, EVT-1, DM-6, SC-M2-S15-01 |
| AC-F2-2 | **Given** the same facts, **when** `closeout <ref>` runs without `--apply`, **then** zero records are appended, the entry remains, and the `queueRemoval` block reports `outcome: "would-remove"`. | F-2, DM-6, NFR-1 |
| AC-F2-3 | **Given** a ref with a queue entry and no observed merged delivery request, **when** `closeout <ref> --apply` runs, **then** the entry remains and the block reports `outcome: "skipped"` with `skipReason: "no-merge-truth"`. | F-2, DM-6, A-1 |
| AC-F2-4 | **Given** a live lease on the ref or unreadable queue state, **when** `closeout <ref> --apply` runs, **then** the entry remains, the block reports `outcome: "skipped"` with `skipReason: "lease-held"` or `"state-unavailable"`, and closeout's exit code and every step outcome are identical to the same run without the queue hook. | F-2, DM-6, NFR-3, RSK-5 |
| AC-F2-5 | **Given** a closeout re-run over a ref whose entry is already removed, and **given** a closeout for a ref that never had an entry, **when** each apply runs, **then** each exits `0`, appends zero removal records, and reports `outcome: "satisfied"`. | F-2, NFR-10, DEC-8 |

### 17.3 Dependency edges

| ID | Criterion | Linked |
|----|-----------|--------|
| AC-F3-1 | **Given** two observed entries `A` and `B`, **when** `queue dep add A B` runs, **then** its payload and result equal the delivered `queue dep A B` payload and result for the same state, and one dependency record carries the folded edge set for `A`. | F-3, NFR-8 |
| AC-F3-2 | **Given** `A` with an edge to `B`, **when** `queue dep remove A B` runs, **then** it exits `0` with `result: "removed"`, `A`'s edge set no longer contains `B`, the ready set is recomputed so `A` is no longer held `dependency-unobserved` for that edge, and one `queue.graph/dependency-edge` event carries `removed: ["B"]`. | F-3, F-6, EVT-2, SC-M2-S15-04 |
| AC-F3-3 | **Given** `A` with no edge to `B`, **when** `queue dep remove A B` runs, **then** it exits `0` with `result: "noop"`, appends zero records, and publishes zero events. | F-3, F-6, NFR-10 |
| AC-F3-4 | **Given** `A` and `B` where `B` already depends on `A`, **when** `queue dep add A B` runs, **then** it exits `1` with `error.code == "queue.dependency-cycle"`, names the existing path, and appends zero records; **when** `queue dep remove A B` runs against a declared edge, **then** no cycle check runs and it is never refused for a cycle reason. | F-3, NFR-9 |
| AC-F3-5 | **Given** a non-canonical ref or an unknown consumer entry, **when** either dependency form runs, **then** it exits `1` with `input.value.rejected` or `queue.entry.unobserved` respectively and appends zero records; a producer with no entry is accepted and its edge is retained so readiness can report `dependency-unobserved`. | F-3, NFR-1 |

### 17.4 Per-ref single-flight

| ID | Criterion | Linked |
|----|-----------|--------|
| AC-F4-1 | **Given** a ref whose live lease records that ref and whose heartbeat age is below its TTL, **when** `dispatch run <ref>` is invoked — whether the live holder identity matches the requester's or not — **then** it exits `1` with `error.code == "queue.single-flight"` and the envelope-root `detail.holder` naming the live holder, no second session is spawned or resumed, no lease, attempt, lane, or queue record is appended, and no event is published. | F-4, DM-7, SC-M2-S15-02, NFR-2, TDR-0026 DC-2, TDR-0027 |
| AC-F4-2 | **Given** a ref whose live lease records that ref and is held by another holder, **when** `queue claim <ref> --holder <caller>` is invoked, **then** it exits `1` with the same identity, the same envelope-root `detail.holder` naming that holder, and the same zero-mutation outcome; **given** the same live same-ref lease held by the caller's own holder, **when** the same claim is invoked, **then** it returns `renewed`, appends exactly one `renewed` lease record, starts no session, and carries no `detail`. | F-4, DM-7, TDR-0026 DC-2, DC-3 |
| AC-F4-3 | **Given** a composed daemon supervision cycle whose claim port is supplied, **when** the next action names a ref with an active lane, **then** the cycle reports a claim refusal carrying `queue.single-flight` and starts no session. | F-4, A-6 |
| AC-F4-4 | **Given** a lease for the ref whose heartbeat age has reached its TTL, **when** a dispatch for that ref is admitted, **then** it is not refused with `queue.single-flight` and the delivered stale-takeover path applies with its incident evidence. | F-4 |
| AC-F4-5 | **Given** a live lease that records a different ref in the same repository, **when** a dispatch or a `queue claim` requests the ref — under the same holder identity or another — **then** it exits `1` with the delivered `error.code == "queue.lease-conflict"` naming the holder and the lease, the live lease's recorded `ref` is unchanged, no lease, attempt, lane, or queue record is appended, and the delivered direct-claim seam's same-holder/same-ref renewal is unchanged. | F-4, DEC-13, RSK-3 |
| AC-F4-6 | **Given** any `queue.single-flight` refusal, **when** the state store is compared before and after, **then** the record count, the derived document bytes, and the lane set are identical. | F-4, NFR-2 |

### 17.5 Reconciliation

| ID | Criterion | Linked |
|----|-----------|--------|
| AC-F5-1 | **Given** an entry whose tracked work item's `deliveryState` is `done`, **when** `queue reconcile` runs, **then** the entry leaves with `reason == "reconciled"`, the payload lists it in `removed[]`, the run exits `0`, and no state file is written outside the tool. | F-5, SC-M2-S15-03, DM-1 |
| AC-F5-2 | **Given** an entry whose `deliveryState` is `canceled`, **when** reconcile runs, **then** it is removed with reason `reconciled`. | F-5, DEC-11 |
| AC-F5-3 | **Given** entries whose `deliveryState` is `backlog`, `ready`, `in-progress`, or `in-review`, **when** reconcile runs, **then** each is retained, listed in `retained[]` with its observed `deliveryState`, and zero removal records are appended for it. | F-5, DEC-11 |
| AC-F5-4 | **Given** an unreadable tracker read, **when** reconcile runs, **then** it appends zero records, reports zero removals, and exits with the provider identity's projection (`provider.outage` / `provider.quota.exceeded` at exit `2`, `provider.auth.rejected` at exit `1`), with no `queue.*` identity on that path. | F-5, DEC-11, NFR-4, NFR-9 |
| AC-F5-5 | **Given** five entries in one repository, **when** `queue reconcile --ref <one>` runs, **then** exactly one entry is examined (one bounded tracker read), the other four are untouched, and the payload's `checked` is `1`. | F-5, NFR-4 |
| AC-F5-6 | **Given** a ref whose work item the tracker does not have, **when** reconcile runs, **then** the entry is retained, listed in `unobserved[]`, and zero records are appended. | F-5, DEC-11 |
| AC-F5-7 | **Given** more entries than the declared cap, **when** reconcile runs, **then** at most 100 entries are examined, `truncated` is `true`, `remainder` equals the exact unexamined count, and no entry beyond the cap is read or removed. | F-5, NFR-4, DM-5 |
| AC-F5-8 | **Given** any reconcile removal, **when** the run completes, **then** the removal obeyed the F-1 invariants (one append, park withdrawal, no edge rewrite) and published exactly one `queue.graph/remove` per removed ref. | F-5, F-1, F-6, EVT-1 |
| AC-F5-9 | **Given** a queue whose stale entries a previous `queue reconcile` run already removed, **when** `queue reconcile` runs again over the same scope, **then** it exits `0`, removes nothing further, appends zero records, publishes zero events, and reports the second observation truthfully — `checked` counts only the entries that still exist, `removed[]` is empty, and no already-removed ref is reported in `removed[]`, `retained[]`, or `unobserved[]`. | F-5, NFR-10, NFR-1 |

### 17.6 Event publication and taxonomy

| ID | Criterion | Linked |
|----|-----------|--------|
| AC-F6-1 | **Given** an applied removal, **when** the projected stream is observed, **then** exactly one `queue.graph` event with `kind == "remove"` appears, its `lane` and `ref` are the entry ref, and its `payload` keys are exactly `ref`, `reason`, `recordedAt` with `reason` in the closed four-value vocabulary. | F-6, EVT-1, DM-8, NFR-5 |
| AC-F6-2 | **Given** a declared edge and its then-removed state, **when** the two projections are observed, **then** the applied `dep remove` yields exactly one `queue.graph` event with `kind == "dependency-edge"` whose `removed[]` names the dropped edge and whose `sequence` exceeds the lane's previous event, and the `noop` removal of an absent edge yields zero events; **given** any refused mutation, **then** zero events are published for it. | F-6, EVT-2, NFR-5 |
| AC-F6-3 | **Given** the taxonomy declaration, **then** `queue.graph/remove` is declared with `emitted: true`, no kind is declared unemitted, the taxonomy version, topic set, frame fields, ordering rule, and overflow policy are unchanged, and `events describe queue.graph` reports `remove` as emitted with its declared field list. | F-6, DM-8, DEC-14 |
| AC-F6-4 | **Given** the emitted-payload-key comparison over every kind that can emit, **when** a `remove` event carries an undeclared key or omits a declared one, **then** the comparison fails; **given** the delivered projection, **then** every emitted kind's payload keys equal its declared field list. | F-6, NFR-7, RSK-7 |

### 17.7 Mount, help, and error identities

| ID | Criterion | Linked |
|----|-----------|--------|
| AC-F7-1 | **Given** the shipped help surface, **when** `queue --help` renders, **then** it lists `remove` and `reconcile` and shows the dependency grammar; `queue remove --help`, `queue reconcile --help`, and `queue dep --help` each exit `0`; the one `queue dep` entry documents `queue dep <ref> <on-ref>`, `queue dep add <ref> <on-ref>`, and `queue dep remove <ref> <on-ref>` with the corrected two-positional synopsis and no `--on` option; `queue remove --help` documents `--reason` with its four values and `queue reconcile --help` documents `--ref`; and exactly two new verb help paths are mounted (`remove`, `reconcile`), with no separate `dep add`/`dep remove` path. | F-7, DM-5 |
| AC-F7-2 | **Given** the help and reference guards, **when** they run, **then** help-guide coverage reports zero failures for the queue family and reference-page parity holds; the resolved queue reference page documents every delivered queue verb; and the M2 page names `queue.reason-missing`, `queue.single-flight`, and `queue.entry.unobserved`, contains no `queue.entry-unknown` or `queue.state-unavailable` row, and shows no top-level `ok` or `command` field in any example. | F-7, DEC-2 |
| AC-F7-3 | **Given** the error table, **when** it is validated, **then** the `queue` domain kind carries exactly seven rows in declared order — the delivered five unchanged plus `queue.reason-missing` (`user-validation`, exit `1`) and `queue.single-flight` (`user-validation`, exit `1`, retryable) — and every new failure path resolves to one of them or to a delivered row with the exit its projection class yields. | F-7, NFR-7, NFR-9 |

### 17.8 Non-functional acceptance

| ID | Criterion | Linked |
|----|-----------|--------|
| AC-NFR-1 | **Given** any accepted mutation, **when** it is applied, **then** it appends inside one fenced transaction, each append is verified post-append, the derived document is replaced only after the appends verify, and a refused mutation leaves the record count, the derived document bytes, and the file set unchanged. | NFR-1, NFR-2 |
| AC-NFR-2 | **Given** a counting state port, **when** one admission is refused by the per-ref guard, **then** at most one additional whole-store read is counted relative to an admission with no other lane, and zero lease, attempt, lane, or queue records are appended. | NFR-2, AC-F4-6 |
| AC-NFR-3 | **Given** the same closeout facts with the queue hook present and absent, **when** both apply runs complete, **then** the step outcomes, the exit code, and the operation count differ only by the queue block, and at most one queue fold and two appends are added. | NFR-3 |
| AC-NFR-4 | **Given** a reconcile over more entries than the cap, **when** it runs, **then** at most 100 tracker reads occur with no retry, no pagination, and no concurrent read, and each read is one bounded call. | NFR-4 |
| AC-NFR-5 | **Given** any new output, record, event, or log line, **when** it is inspected, **then** it carries no credential, token, session secret, provider payload, prompt, diff, or repository content; the refusal detail is ≤ 128 characters and single line; and the reconcile payload carries identifiers, closed vocabulary values, counts, and timestamps only. | NFR-8, NFR-6 |
| AC-NFR-6 | **Given** the change is delivered, **when** the contract inventories, dependency-cruiser boundaries, and package manifests are inspected, **then** zero packages, subpaths, adapters, or schema versions are added, exactly two error rows are added, and both inventories equal the tree in both directions. | NFR-7 |

### 17.9 Definition of Done

The change is done when all of the following hold together. `dod_check` reads this list as the completion condition; the plan declares the phases that produce each item.

- **Acceptance.** All 46 acceptance criteria pass — 40 capability criteria across §17.1–§17.7 and 6 non-functional criteria in §17.8 — each with the observable it names. None is waived, renumbered, or narrowed.
- **M2 scenarios.** SC-M2-S15-01 (auto-removal after closeout), SC-M2-S15-02 (single-flight refusal naming the holder), SC-M2-S15-03 (stale entry reconciled without editing state files), and SC-M2-S15-04 (dependency-edge event with a monotonic sequence) are reproduced by the delivered behaviour.
- **Decisions.** TDR-0026 `DC-1`..`DC-6` and TDR-0027 ALT-3 are implemented as written, including the F-4 precedence table and the envelope-root `detail` slot; no unresolved question in either record blocks delivery, and `error.detail` appears in no shipped surface.
- **Pin migrations, two-sided.** Every entry of the canonical pin table (test plan §7.1) moves with the behaviour: the six `remove`-emission pins (non-emitted set empty, the projection the sole producer), the three registry/baseline pins (`dispatch-attempts-taxonomy` 127 → 129, `error-table-baseline.json`, `state-additivity-baseline.json`), the two count pins (queue error rows 5 → 7, queue record kinds 5 → 6), the one CLI export pin, and the derived-document golden rule (existing goldens byte-identical, new cases new files), plus the failure-envelope detail pins. Each asserts the new truth beside the retained truth; no assertion is deleted, silenced, or relaxed to an inequality.
- **Documentation.** Every §16 in-plan page is reconciled by the delivery and every phase-7 page by `@doc-syncer`, including the state-layer record-kind inventory, the result-contract scheduling-row count and envelope member, the M2 contract and architecture sentences, and the queue reference and planning pages.
- **Gates.** The aggregate gate (`pnpm check`) is green, its contract, state, help, taxonomy, and conformance guards included, and every declared plan phase (nine) is complete with its own `definitionOfDone` evidenced in the phase's pm-notes entry.

## 18. ROLLOUT & CHANGE MANAGEMENT (HIGH-LEVEL)

- **Delivery shape.** One change on `feat/GH-292/queue-lifecycle`, one pull request targeting `main-tools`, delivered through the full eleven-phase lifecycle with its phases declared in the plan artifact and commits routed through the `commit` primitive.
- **No migration and no seed.** The removal record kind is additive: a store written before this change contains no removal records, so the presence rule yields exactly today's entries and the derived document is byte-identical on a store with no removals. Nothing is transformed, backfilled, or rewritten, and a removal is never applied to historical records.
- **Ordering inside the change.** The removal record, the fold's presence rule, and the derived-document refresh land together, because a record kind without the presence rule would leave removed entries visible. The park withdrawal lands with the removal, because a removal that leaves an active park makes the park pass evaluate a ref that no longer exists. The path-specific admission policy, `queue claim`'s holder-aware outcomes, and the lease-renewal narrowing land together, because the dispatch refusal is bypassable while renewal can rewrite the lease's ref, and the envelope `detail` slot and its pins land with the refusal that populates them. The `remove` producer lands with the taxonomy pin move and the `queue` verb that produces it, because the emitted-payload-key comparison and the non-emitted-set pin both fail in the one-sided states. The closeout block lands after the removal semantics it calls.
- **Deliberate pin moves, in one delivery.** The canonical inventory is the test plan's §7.1 table, and every entry moves with the behaviour it describes: six `remove`-emission pins, three registry/baseline pins, two count pins (queue error rows 5 → 7, queue record kinds 5 → 6), one CLI export pin, the derived-document golden rule, and the failure-envelope detail pins. Each is a two-sided equality updated to the new truth, never relaxed to a range, a subset, or a `toContain`.
- **Disclosed behaviour changes.** Two outcomes change and one shape grows, all in §8.5: a dispatch against a live lease that records the requested ref now refuses `queue.single-flight` instead of proceeding (including under the same holder identity, because the dispatch path never renews mid-flight); a same-holder claim for a *different* ref in one repository changed from `renewed` to `queue.lease-conflict`; and a `queue claim` on the caller's own holder's same-ref lease still returns `renewed`. The failure envelope also gains one optional command-declared `detail` member, present only for `queue.single-flight`. All three must be stated in the reconciled scheduling-engine page, the queue reference page, the result-contract page, and the changeset note; an operator on the release-between-claims workflow is unaffected.
- **Adoption path.** An operator retires a merged ref automatically (nothing to do), retires an abandoned ref with `queue remove --reason abandoned`, fixes a wrong edge with `queue dep remove`, and sweeps a stale queue with `queue reconcile`. An agent that dispatches gets a classified `queue.single-flight` refusal instead of a duplicate session. A subscriber to `queue.graph` starts receiving `remove`, which it already declared.
- **Rollback.** Revert the change. No existing record changes meaning, so a reverted binary reads a store containing removal records as it reads any unknown prefix: the delivered prefix-scoped folds ignore them, and the entry returns to the queue. That is a deliberate, harmless asymmetry — a rollback restores dead entries rather than failing a read.
- **Communication.** The removal contract, the reason vocabulary, the per-ref admission refusal, the closeout block, and the emitted `remove` kind are recorded in the reconciled scheduling-engine, dispatch-engine, closeout, and event-taxonomy pages, the M1 and M2 queue pages, and the glossary, and the M2 backlog row follows delivery.

## 19. DATA MIGRATION / SEEDING (IF APPLICABLE)

N/A. No record is transformed, backfilled, or seeded, and no schema version changes. A removal is a new record that only a post-change writer produces; the delivered prefix-and-kind-scoped reads ignore a prefix they do not know, so an old store and a new store both fold to the same entries when no removal exists, and the derived document is rebuilt from the fold on demand rather than migrated in place.

## 20. PRIVACY / COMPLIANCE REVIEW

- **No personal data.** Removal records carry a ref, a closed vocabulary reason, a timestamp, and the additive caller principal every queue record already carries. The reconcile payload carries refs, delivery-state aliases, counts, and a remainder count. No title, body, comment, author identity, or tracker payload is copied into any new surface.
- **Tracker read is minimal and read-only.** One bounded work-item read per examined entry, no pagination, no comment fetch, no write. The status alias is the only tracker fact reconciled, and it is not persisted.
- **No secret material.** The credential is resolved through the declared port and never printed; the refusal detail is bounded identifiers; no session id, lock token, or provider payload reaches an output, record, event, or log.
- **Trust model unchanged.** Same-user local state, the delivered credential and principal model, no privilege escalation, no remote transport, no new write location.
- **Privacy guard impact.** None; the change adds no committed private literal and no cloud dependency.

## 21. SECURITY REVIEW HIGHLIGHTS

- **Removal cannot be used to erase evidence.** Every removal is an append with a reason; no record is deleted, so the ledger still shows the entry's declaration, its dependency history, its lease history, and its parks. A removal is a state transition, not a deletion.
- **The lease is the authority, and removal respects it.** A live lease blocks removal, so a running session's entry cannot be retired under it; a stale lease is the delivered takeover case, not a removal case.
- **The per-ref guard closes a duplicate-session path, and its refusal is inert.** The guard runs before the fence, appends nothing, and names only the holder identity, so a hostile or mistaken caller cannot use the refusal to mutate state or discover a credential.
- **Reconcile fails closed on unreadable truth.** An unreadable or unobserved tracker read removes nothing; only a positive `done`/`canceled` observation removes, so a partial or failed read can never manufacture a removal.
- **The reconcile read is a single bounded call.** No pagination, no retry loop, no concurrent fan-out, and no user-supplied token, so a compromised or hostile tracker response cannot drive unbounded work.
- **Bounded output stays a safety property.** The removal payload has three fields, the reconcile lists are capped, the refusal detail is bounded, and the `dependency-edge` payload keeps its delivered caps.
- **Residual risk.** A same-user process can append a removal record directly, as it can append any record in the delivered trust model; the record carries a reason and is visible in the event stream, so a wrong removal is detectable and recoverable by re-declaring the ref.

## 22. MAINTENANCE & OPERATIONS IMPACT

- **New operator surface.** `queue remove <ref> --reason <reason>`, `queue dep add|remove <ref> <on-ref>`, and `queue reconcile [--ref <ref>]`, each with help; `closeout` gains one additive output block.
- **Runbook.** After a merge and closeout, confirm the entry is gone (or read the `queueRemoval` block if it was skipped). To retire an abandoned change, `queue release` if a lane holds it, then `queue remove --reason abandoned`. To fix a wrong edge, `queue dep remove`. To sweep, `queue reconcile`, then re-run with `--ref` for anything past the cap.
- **Operational interpretation.** An entry held `dependency-unobserved` means its producer is no longer in the queue and its edge needs editing — it is not a scheduler bug. A `queue.single-flight` refusal means either that a dispatch is already active for that ref (any holder) or that another holder holds it on a claim, and it names the holder; a `queue claim` on your own holder's same-ref lease returns `renewed` instead. A `lease-held` removal refusal means a lane holds the repository. A reconcile that exits `2` removed nothing.
- **Maintenance cost.** One new record kind with one presence predicate, one admission predicate with one authored precedence table, one additive envelope member, one additive closeout block, and one emitted event kind. The reason vocabulary and the reconcile entry cap are closed data, so changing either is a contract change with its own tests.
- **State growth.** One removal record per retirement and, when a park was active, one withdrawal record; reconcile appends only for entries it removes. No history is compacted and no index is added.
- **Cost model.** Removal costs one graph fold and up to two appends; the guard costs at most one additional read per admission; reconcile costs at most one bounded tracker read per examined entry, capped at 100 per run; closeout adds at most one fold and two appends to a transaction it already runs.
- **Failure handling.** A refused removal changes nothing and names its reason. A skipped automatic removal never fails closeout. A reconcile with unreadable truth removes nothing and exits per the provider class. A taxonomy drift fails a named test rather than shipping a kind whose payload disagrees with its declaration.

## 23. GLOSSARY

| Term | Definition |
|---|---|
| Removal | An append-only queue record stating that a ref left the queue and why. The entry is absent from the fold from that record onward; no record is deleted. |
| Removal reason | The closed four-value vocabulary `landed`, `abandoned`, `superseded`, `reconciled`. Required on `queue remove`; recorded automatically as `landed` by closeout and as `reconciled` by reconcile. |
| Presence rule | An entry is present iff its latest `queue.entry` append is later than its latest `queue.removal` append in ledger position (the delivered monotonic record `sequence`), never by `recordedAt` text; a tie is impossible, and a later re-declaration restores the entry. The fold's only presence predicate. |
| Landed removal | The automatic removal closeout performs after the closeout writes succeed, when the merged delivery request is observed. |
| Stale entry | An entry whose tracked work item's normalised `deliveryState` is `done` or `canceled`. Nothing else makes an entry stale. |
| Reconcile | The operator invocation that compares entries with tracker truth and removes the stale ones with reason `reconciled`; bounded, per-repository, and fail-closed on unreadable truth. |
| Dependency edge | A consumer-to-producer edge declaring that the consumer waits for the producer. Edited one edge per invocation by `dep add`/`dep remove`; the delivered two-positional `dep` is an add. |
| Per-ref single-flight | The path-specific admission policy that stops a second session for a ref that already has an active lane, naming the holder: the dispatch family refuses any live same-ref lease, while `queue claim` renews its own holder's same-ref lease and refuses another holder's. Distinct from the scheduler's per-pass single-flight (one action per repository per pass) and from the repository-exclusive lease. |
| Holder lane | The live lease's holder identity, named in the envelope-root `detail.holder` on a `queue.single-flight` refusal. |
| Envelope detail | The additive optional, command-declared `detail` object on the failure envelope. Its only v1 member is `holder` (single line, ≤ 128 characters, identifiers only); `CommandResultError` keeps its six delivered fields and `error.detail` is not a placement (TDR-0027). |
| Active lease | A lease whose heartbeat age is below its TTL. A lease at or over its TTL is stale and subject to the delivered takeover, not to the per-ref refusal. |
| Park withdrawal | The delivered `queue.park` record with `recoveryState: "released"` appended when an entry with an active park is removed, so the park stops evaluating. |
| Emitted kind | A declared `queue.graph` kind a shipped path can produce. After this change all four are emitted. |
| Derived graph document | `queue-graph.json` (`delivery.queue.graph.v1`), rebuilt from the fold and replaced atomically when intent truth changes. Not a source of truth. |
| Fail-open (closeout) | The automatic removal reports a skip with a closed reason and never changes a closeout step outcome or exit code. |
| Declared credential port | The single injected source resolve path for tracker credentials. No ambient environment read and no command-line token. |

## 24. APPENDICES

### Appendix A — Ticket-to-spec traceability

| Ticket acceptance criterion / task | Spec coverage |
|---|---|
| AC: after a squash merge and closeout, the ref's queue entry is gone without manual action | F-2, AC-F2-1, DM-6, SC-M2-S15-01 |
| AC: a second dispatch against a ref with an active lane is refused with a classified error naming the holder | F-4, AC-F4-1..6, DM-7, SC-M2-S15-02 |
| AC: stale entries are reconcilable without editing state files | F-5, AC-F5-1..9, DM-1, SC-M2-S15-03 |
| Task: entry removal/release with reasons | F-1, AC-F1-1..8, DEC-1, DEC-9 |
| Task: automatic release on merge and closeout | F-2, AC-F2-1..5, DEC-4 |
| Task: dependency edge add/remove | F-3, AC-F3-1..5, EVT-2, SC-M2-S15-04 |
| Task: single-flight per ref enforced across dispatch paths (evidence: a dual-run observed a second concurrent session on one ref) | F-4, AC-F4-1..6, DEC-3, DEC-13, RSK-3, TDR-0026 DC-2/DC-3 |
| Task: reconciliation of stale entries against tracker truth | F-5, AC-F5-1..9, DEC-11 |
| NFR: repeated reconcile converges (NFR-10) | NFR-10, AC-F5-9, F-5, NFR-1 |
| Contract: `remove` is the declared kind and every mutation publishes `queue.graph` | F-6, AC-F6-1..4, EVT-1, DEC-14 |
| Decision: TDR-0026 `DC-1`..`DC-6` implemented (removal kind and append-position presence, path-specific single-flight, renewal narrowing, non-cascading removal, staleness fact, two identities) | F-1..F-7, DM-1..DM-8, AC-F1-1..AC-F7-3 |
| Decision: TDR-0027 ALT-3 implemented (envelope-root optional `detail`, six-field error, `error.detail` rejected) | DM-7, AC-F4-1, AC-F4-2, AC-NFR-5 |
| Definition of Done | §17.9 |
| Delivery convention: full lifecycle, plan phases, `commit` primitive, PR to `main-tools`, planning markers kept | §18, §16 |

### Appendix B — Contract section to decision map

| `m2/contracts.md` §Queue lifecycle mutations position | Spec decision | Acceptance criteria |
|---|---|---|
| Lease release stays; release takes no removal reason | DEC-1, NG-1 | AC-F3-1 indirectly; §8.5 |
| Entry removal carries a reason; unqualified refused with `queue.reason-missing` | F-1, DEC-2, DEC-5 | AC-F1-1..4 |
| Automatic removal after a squash merge and closeout with reason `landed` | F-2, DEC-4 | AC-F2-1..5 |
| Two-positional add stays; `dep add`/`dep remove` edit one edge; ready set recomputed | F-3, DEC-15 | AC-F3-1..5 |
| One active lane per ref across every dispatch path; second dispatch refused with a classified error naming the holder | F-4, DEC-3, DEC-13 | AC-F4-1..6 |
| Stale entries reconcile against tracker truth without editing state files | F-5, DEC-11 | AC-F5-1..9 |
| Taxonomy: `remove` declared `emitted: false` because no v1 path produces it | F-6, DEC-14 | AC-F6-1, AC-F6-3 |
| Decision record: TDR-0026 `DC-2`/`DC-3` path-specific single-flight and renewal narrowing | F-4, DEC-3, DEC-13 | AC-F4-1, AC-F4-2, AC-F4-5 |
| Decision record: TDR-0027 ALT-3 envelope-root optional `detail` | DM-7 | AC-F4-1, AC-F4-2, AC-NFR-5 |

### Appendix C — Exit matrix

| Outcome | Identity | Exit | Consequence |
|---|---|---|---|
| Removal applied | — (success `data`) | 0 | — |
| `dep remove`/`reconcile` with no work | — (success `data`, result `noop`) | 0 | — |
| Removal without a reason | `queue.reason-missing` | 1 | `not_landed` |
| Second dispatch against an active ref | `queue.single-flight` | 1 | `not_landed` |
| Removal of a ref with no entry | `queue.entry.unobserved` | 1 | `not_landed` |
| Removal or claim blocked by a precondition (`lease-held`, owner hold) | `queue.precondition.unmet` | 1 | `not_landed` |
| Same-holder claim for another ref in one repository | `queue.lease-conflict` | 1 | `not_landed` |
| Out-of-vocabulary reason, non-canonical ref, malformed grammar | `input.value.rejected` | 1 | `not_landed` |
| Cycle-closing add | `queue.dependency-cycle` | 1 | `not_landed` |
| Tracker credential rejected during reconcile | `provider.auth.rejected` | 1 | `not_landed` |
| Tracker unreadable or quota-exhausted during reconcile | `provider.outage`, `provider.quota.exceeded` | 2 | `not_landed` |
| Queue state unreadable or torn | delivered `state.*` row | 2 | `not_landed` |

No exit value outside `{0, 1, 2}` is produced, and no literal exit digit is introduced outside the projection module.

### Appendix D — Source map (applied mutation → durable record → event)

| Mutation | Durable records | Event |
|---|---|---|
| `queue remove` | one `queue.park` withdrawal (`recoveryState: released`) when a park is active, then one `queue.removal` | `queue.graph/remove` with `ref`, `reason`, `recordedAt` |
| closeout automatic removal | the same pair, appended after the closeout writes | `queue.graph/remove` with `reason: "landed"` |
| `queue reconcile` removal | the same pair per stale ref | one `queue.graph/remove` per removed ref, in each ref's lane |
| `queue dep add` (either spelling) | one `queue.dependency` carrying the folded edge set | `queue.graph/dependency-edge` with `added[]` |
| `queue dep remove` | one `queue.dependency` carrying the folded edge set | `queue.graph/dependency-edge` with `removed[]` |
| refused mutation, `noop` removal, skipped automatic removal | none | none |

### Appendix E — Closed vocabularies

| Vocabulary | Values used by this change | Status |
|---|---|---|
| Removal reasons | `landed`, `abandoned`, `superseded`, `reconciled` | new, closed |
| Dependency mutation results | `added`, `updated`, `removed`, `noop` | extended by `removed` |
| Removal result | `removed` | new, closed |
| Reconcile result | `removed`, `noop` | new, closed |
| Closeout queue-removal outcome | `removed`, `would-remove`, `satisfied`, `skipped` | new, closed |
| Closeout queue-removal skip reason | `no-merge-truth`, `lease-held`, `state-unavailable`, `ref-not-canonical` | new, closed |
| Tracker delivery-state aliases | `backlog`, `ready`, `in-progress`, `in-review`, `done`, `canceled` | delivered, unchanged |
| Queue blocking reasons | `lease-held`, `dependency-unobserved` | delivered, unchanged |
| Park recovery states | `parked`, `clear-observed`, `recovered`, `released` | delivered, unchanged |
| Lease operations | `acquired`, `renewed`, `released`, `taken-over` | delivered, unchanged |
| Claim results | `claimed`, `renewed`, `taken-over` | delivered, unchanged (`renewed` now reachable only for the same ref under the caller's own holder) |
| Queue error rows | the delivered five, byte-identical (code, category, retryable, consequence, projectionClass, exit, summary, remediationHint), plus `queue.reason-missing`, `queue.single-flight` | extended by 2 |
| `queue.graph` kinds | `entry`, `dependency-edge`, `release`, `remove` | delivered, all emitted after this change |

## 25. DOCUMENT HISTORY

| Version | Date | Author | Changes |
|---------|------|--------|---------|
| 1.0 | 2026-11-12 | `@spec-writer` | Initial specification for GH-292 / M2-S15: reason-bearing `queue remove` with the append-only removal record and presence rule, automatic `landed` removal inside `closeout --apply` with its fail-open block, the `dep add`/`dep remove` grammar with the delivered two-positional add preserved, the per-ref single-flight admission guard with `detail.holder` and the same-holder renewal narrowing, `queue reconcile` against tracker truth, and the `queue.graph` `remove` kind becoming emitted. 7 capabilities, 45 acceptance criteria (39 capability criteria plus 6 non-functional), 15 decisions (DEC-1..DEC-15), 10 risks, 10 NFRs, 8 data-model elements, 3 event contracts, 2 open questions. |
| 1.2 | 2026-11-12 | `@spec-writer` | Definition-of-Ready iteration 1 remediation (reopened specification phase), aligning the specification to TDR-0026 and TDR-0027. **R-01:** the mutually exclusive same-holder statements are replaced by the PM-decided path-specific precedence: the dispatch family refuses `queue.single-flight` on any live lease whose recorded ref is the requested ref (same or different holder), `queue claim` keeps the delivered own-holder same-ref `renewed`, refuses another holder's same-ref lease with `queue.single-flight`, and refuses any other-ref lease with `queue.lease-conflict`; F-4 states the full outcome table, why AC-F4-1/2/5 hold together only under it, and that the delivered lease controls stay green; AC-F4-1, AC-F4-2 and AC-F4-5, Flow 4, §8.5, DEC-3, the §4.1 KPI, §7.1, §13, Appendix A/B and the glossary follow. **R-02:** presence is the ledger's append position — the latest `queue.entry` append later than the latest `queue.removal` append, never `recordedAt` text — with a tie impossible; DM-2, AC-F1-7, F-1, DEC-5 and the glossary state the order and the still-restoring re-declaration. **R-03:** the holder is named at the envelope root; the failure envelope gains one additive optional command-declared `detail`, `CommandResultError` keeps exactly its six fields, `error.detail` is rejected, and TDR-0027 is cited (AC-F4-1, AC-F4-2, DM-7, F-4, Flow 4, §10, §16, glossary, §13). **R-05:** the five delivered queue rows are stated byte-identical field by field, with `lease-held` carried only in bounded refusal text. **R-06:** §16 names the current-truth pages the change falsifies — `feature-state-layer.md`, `feature-result-contract.md` and any page stating the record-kind or error-row count in the phase-7 set, `contracts.md` and `architecture.md` in-plan — under an explicit two-set ownership split. **R-10:** §10 now says no new telemetry sink or audit-ledger record, with the removal record named as the one new queue-ledger kind. **R-11:** DM-1 lists the removal record's exact fields and states that only `queue.entry` and `queue.dependency` carry `callerPrincipal`, which the new kind also carries. **R-13:** the help surface is named exactly — two new verb entries plus the rewritten `queue dep` entry with three dependency spellings and the corrected synopsis — and AC-F7-1 matches. **R-17:** §17.9 states the Definition of Done over the 46 ACs, the four M2 scenarios, both decision records, the two-sided pin migrations, the documentation split, and the aggregate gate. Counts unchanged: 46 acceptance criteria (40 + 6), 15 decisions, 10 risks, 10 NFRs, 8 data-model elements, 3 event contracts. |
| 1.1 | 2026-11-12 | `@spec-writer` | Specification phase reopened after test planning; the two discovered gaps are closed and the PM resolutions recorded. **OQ-T1:** added AC-F5-9 — a repeated `queue reconcile` over already-reconciled entries exits `0`, removes nothing further, appends nothing, publishes nothing, and reports the second observation truthfully — so NFR-10's convergence claim carries an acceptance criterion; counts 45 → 46 acceptance criteria (39 → 40 capability criteria), with Appendix A, the authoring counts, and the validation checklist aligned. **OQ-T5:** §5.1 F-7 no longer calls `queue.single-flight` "transient"; the row is `user-validation` at exit `1` and retryability after the holding lane ends does not change the projection class, matching AC-F7-3 and the delivered projection vocabulary (AC unchanged). **OQ-1 / OQ-2:** resolved by the PM decision of 2026-11-12 — both statuses marked resolved with DEC-9 and DEC-10 adopted as recommended, and the provisional qualifiers removed from those decision rows and from the F-1 pointer (decisions unchanged). **DEC-13:** recorded as accepted into scope as a defect fix required for AC-F4 (decision unchanged). No capability, contract, scope, risk, NFR, or acceptance-criterion semantics changed beyond the added criterion. |

---

## AUTHORING GUIDELINES

- **Sources.** Authored from the GH-292 ticket body (M2-S15) as recorded in `chg-GH-292-pm-notes.yaml`, the M2 planning pack (`backlog.md` §M2-S15, `m2/contracts.md` §Queue lifecycle mutations and §Event taxonomy v1, `m2/commands/queue.md`, `m2/architecture.md` §Queue auto-release / §Single-flight / §Persistence and concurrency deltas, `m2/test-scenarios.md` SC-M2-S15-01..04), and the delivered tree. The claimed facts were read from the shipped code and specs rather than assumed: the eight delivered queue verbs and their result vocabularies; the five queue record kinds, their key prefixes, and the prefix-and-kind-scoped reads; the latest-wins fold with no tombstone; the repository-keyed lease, its three outcomes, and the same-holder renewal that rewrites `ref`; the dispatch admission order and its pre-session refusal; the daemon supervision claim port and the production composition's supervise-only shape; the closeout step inventory, its fence, and its additive non-step blocks; the taxonomy declaration with `remove` as the one unemitted kind and the six pins that cover it (the test plan's §7.1 table); the five queue error rows and the derived exit projection; the help family entries including the `queue dep` synopsis that does not match its grammar; and the reconcile-relevant tracker read shape with its closed `deliveryState` aliases.
- **Approach.** Each of the ticket's three acceptance criteria and the contract's six positions becomes a capability with observable criteria; the four test scenarios are mapped one-to-one in §17 and Appendix A. Where the delivered code and the planning text disagree, the delivered contract governs and the planning text is a reconciliation deliverable (DEC-2, §16): the M2 page's `queue.entry-unknown` and `queue.state-unavailable` are duplicate identities for meanings that already exist, and its example envelope is not the delivered `CommandResult`. The one behaviour that had to change rather than extend — same-holder renewal for a different ref — was found while checking whether the per-ref guard could be enforced at all, and is recorded as DEC-13 with its own criterion and risk instead of being left as an implicit side effect.
- **Contradictions and gaps resolved here.** (1) The ticket's task wording "entry removal/release with reasons" reads as one verb; the planning pack splits it, and DEC-1 keeps `release` untouched. (2) The M2 page names four error identities and the delivered table has five rows, two of which already mean the page's unknown-ref and unreadable-state cases; DEC-2 reuses them. (3) The M2 page's `OUTPUT` block describes one generic mutation envelope with `mutation`, `lease`, `park`, and `readySet`; the delivered surface is per-verb, so the specification defines per-verb additive payloads and states that `event` names a topic and kind rather than a sequence (DEC-12). (4) The M2 page's example prints `queue.graph/removed`, while the declared kind is `remove`; the declared identity wins. (5) The taxonomy contract says "no v1 path produces it" — the parenthetical names this story — and four tests pin that; DEC-14 makes the pin move deliberate and two-sided.
- **Constraints observed.** Contract-level only: no task sequence, no test file location, no code structure, and no implementation step. The delivered append-only state discipline, the repository-exclusive lease, the `{0,1,2}` exit projection, the additive-payload rule, and the no-new-dependency rule are all preserved and are stated where they bind. Delivery-shape obligations are stated only where a requirement depends on them: the park withdrawal precedes the removal append (F-1), the guard sits at admission (F-4), and the closeout removal sits after the closeout writes inside the held fence (F-2).
- **Open questions.** Two were carried as operator-policy choices rather than contract mechanics (OQ-1 live-lease removal, OQ-2 producer removal); both are resolved by the PM decision of 2026-11-12 and their recommendations stand as DEC-9 and DEC-10, so the specification now closes with no open question.
- **Counts.** 7 capabilities, 46 acceptance criteria (40 capability criteria across seven groups plus 6 non-functional), 15 decisions, 10 risks, 10 NFRs, 8 data-model elements, 3 event contracts, 2 recorded questions (both resolved), 4 test scenarios covered.

## VALIDATION CHECKLIST

- [x] `change.ref` matches provided `workItemRef` (GH-292)
- [x] `owners` has at least one entry
- [x] `status` is "Proposed"
- [x] All sections present in order (1–25 + authoring guidelines + validation checklist)
- [x] ID prefixes consistent and unique within category (F-, AC-, NFR-, RSK-, DEC-, OQ-, DM-, EVT-)
- [x] Acceptance criteria reference at least one F-/NFR-/DM-/EVT- ID and use Given/When/Then
- [x] NFRs include measurable values (counts, caps, thresholds, zero-mutation assertions)
- [x] Risks include Impact and Probability (H/M/L)
- [x] No implementation details (no code-level task list, no file-level step sequence, no commit or git instructions)
- [x] Every claimed current-state fact was read from the delivered code or spec rather than assumed
- [x] Every deliberate pin move is named once and scoped to the same delivery: §7.1 binds this artifact to the canonical pin table in the test plan's §7.1, and §18, §17.9 and DEC-14 restate only its groups rather than defining a second inventory
- [x] The one behaviour narrowing is disclosed in §8.5, §18, AC-F4-5, DEC-13, RSK-3
- [x] Counts are internally consistent (7 capabilities; 46 ACs = 40 + 6; 15 decisions; 10 risks; 10 NFRs; 8 DM; 3 EVT; 2 OQ)
- [x] Front matter validates per the authoring rules
