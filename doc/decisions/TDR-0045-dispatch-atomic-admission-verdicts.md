---
id: TDR-0045
decision_type: tdr
status: Proposed
created: 2026-11-18
decision_date: null
last_updated: 2026-11-19
summary: "The dispatch admission verdict is decided inside the lease claim from the live lease observed under the fence, not by a pre-claim observation a second invocation can race: a live same-ref lease under any holder refuses `queue.single-flight` at exit 1 naming the holder, a live other-ref lease in the same repository refuses `queue.lease-conflict` at exit 1, the dispatch claim never treats another invocation's same-ref lease as an own-holder renewal while the sibling `queue claim` renewal is untouched, store-fence contention is waited on for a bounded period no greater than the queue lease TTL and then re-decided rather than surfaced as a verdict, and every refusal carries a declared error-table kind/code pair — a state failure keeps its `state.*` kind and exit 2 and is never relabelled `queue`, so no admission outcome is ever contained as `fallback.internal`."
owners:
  - "Juliusz Ćwiąkalski"
service: "delivery-os queue admission and dispatch admission (lease claim, per-ref single-flight, refusal identities)"
decision_scope: repo
review_date: null
customer_impact: "The loser of two concurrent dispatches on one ref receives its declared retryable `queue.single-flight` refusal naming the live holder, instead of an exit-2 internal-containment failure that tells an operator or agent nothing and looks like a platform defect."
classification:
  domains: [contracts, architecture, concurrency]
  archetype: design
  environment: complicated
  rigor: R2
  reversibility: moderate
  stakes: high
  urgency: high
  uncertainty: low
  blast_radius: team
  recurrence: recurring
governance:
  driver: "@decision-advisor (GH-347: the specification routes the ticket's AC-2 interpretation and the fence-contention defect as binding PM DECISION A and DEC-1; this record amends TDR-0026's dispatch admission mechanism for one caller)"
  decider: "Juliusz Ćwiąkalski — human acceptance at the GH-347 PR review; AI does not accept this R2 record"
  contributors:
    - "@pm (GH-347 clarify_scope: binding PM DECISION A — two concurrent dispatches each receive their declared verdict)"
    - "@spec-writer (chg-GH-347-spec §5.1 F-2, §8.1 API-2, §8.3 DM-7, §17.2 AC-F2-1…AC-F2-5, DEC-1)"
    - "@decision-advisor (repository analysis and this record)"
  reviewers:
    - "@readiness-reviewer"
    - "@reviewer"
    - "Human owner (GH-347 PR review — this record changes a delivered queue-contract refusal path)"
  performers:
    - "@coder (GH-347: the atomic claim verdict, the fence wait, the dispatch-path renewal refusal, the kind/code pairing, the race conformance case)"
    - "@doc-syncer (GH-347 documentation phase: the dispatch-engine and queue reference pages)"
  informed:
    - "Operators and agents that dispatch on a ref (they now receive a named holder instead of an exit-2 containment)"
    - "The resident-daemon supervision claim (its per-pass snapshot predicate is unchanged by this record and remains a separate question)"
    - "Any future caller of the delivered claim path"
ai_assistance:
  used: true
  roles: [repository-analyst, analyst, record-writer]
  external_data_shared: false
  citations_verified: true
  human_decider: null
  reviewers: []
revisit_triggers:
  - "The composed daemon supervision claim is required to decide its verdict inside the claim rather than from its per-pass snapshot: that is a daemon-family admission decision with its own concurrency argument, and it is decided as an amendment here rather than folded in silently."
  - "A caller needs the dispatch group to claim for a ref under a holder that also dispatches other refs: the own-holder rule and the repository-exclusive lease scope are reopened together, because the refusal's enforceability depends on the fixed dispatch holder."
  - "Fence contention is observed to last longer than the queue lease TTL in practice: the declared wait bound and its relationship to lease liveness are re-decided, and the wait never silently becomes unbounded."
  - "A refusal is proposed to carry a new detail member beyond `detail.holder`: that is a failure-envelope contract change (TDR-0027), not an edit inside this decision."
  - "A live same-ref lease is proposed to be adopted as a resume instead of refused: resumability is an operator-requested act (TDR-0044), and automatic adoption from a refusal would make a second invocation hijack a running session."
links:
  related_changes: ["GH-347", "GH-292"]
  supersedes: []
  superseded_by: []
  spec:
    - "doc/changes/2026-11/2026-11-18--GH-347--dispatch-core-parity/chg-GH-347-spec.md"
    - "doc/spec/features/feature-dispatch-engine.md"
    - "doc/spec/features/feature-scheduling-engine.md"
  contracts:
    - "packages/core/src/contracts/queue.ts"
    - "packages/core/src/contracts/error-table.ts"
    - "packages/core/src/contracts/result.ts"
    - "packages/core/src/app/queue.ts"
    - "packages/core/src/app/dispatch.ts"
    - "packages/core/src/state/index.ts"
    - "packages/cli/src/production.ts"
    - "scripts/deliver-ticket.sh"
  diagrams: []
  decisions: ["TDR-0005", "TDR-0026", "TDR-0027", "TDR-0044"]
  experiments: []
  metrics: []
  roadmap_items: ["M4-S9"]
---

# TDR-0045: Atomic Dispatch Admission

> **Traceability.** Spec §15 **DEC-1** (admission, ticket AC-2) and the binding PM DECISION A; §5.1 F-2; §8.1 API-2; §8.3 DM-7; §8.5 "Queue sibling unchanged"; §10; §17.2 AC-F2-1…AC-F2-5; §25.6 Appendix F(A); §15.1 maps DEC-1 to this record. Amends **TDR-0026 DC-2/DC-3 for the dispatch caller only**.

## Context

Two dispatches on one ref must not both start a session, and the loser must be told the truth about why. Today the dispatch path decides that twice — once before the claim and once inside it — and the second decision is not allowed to speak.

- **FACT:** The dispatch composition runs a per-ref pre-claim predicate, then claims. `dispatchAdmissionRefusal` refuses `queue.single-flight` (same ref, any holder) or `queue.lease-conflict` (other ref, same repository) from a whole-store read taken **before** the fence; only then does it call `claimQueueLease` (`packages/cli/src/production.ts:3054-3093`; predicate at `packages/core/src/app/queue.ts:1148-1200`). *(read 2026-11-18)*
- **FACT:** The claim acquires the store fence **non-blockingly**: `runClaimFence` calls `store.acquireFence(fenceToken)` once and returns `stateFailureOf(acquired.error)` on failure (`packages/core/src/app/queue.ts:1946-1958`). Under contention the error is `state.lock.busy`. *(read 2026-11-18)*
- **FACT:** The dispatch run maps **any** failed claim to `kind: "queue"` with the returned code (`packages/core/src/app/dispatch.ts:686-698`), while the claim's own state failure is `kind: "state"`. The pair `queue` kind + `state.lock.busy` code is not a declared error-table row, so it is contained as `fallback.internal` at exit 2 (`packages/core/src/contracts/error-table.ts:57-61`; containment described at `contracts/result.ts:24-31`). *(read 2026-11-18)*
- **FACT:** `queue.single-flight` is a delivered row with `category: transient`, `retryable: true`, `consequence: not_landed`, `projectionClass: user-validation` (exit 1), summary "The requested ref already has an active lane", and a remediation that names the holder (`packages/core/src/contracts/error-table.ts:1349-1359`). `state.lock.busy` is `category: transient`, `retryable: true`, `consequence: not_landed`, `projectionClass: platform-provider` (exit 2) (`error-table.ts:437-445`). *(read 2026-11-18)*
- **FACT:** Inside the fence, a live lease re-claimed by the **identical holder** for the **same ref** is renewed (`operation: "renewed"`), and an own-holder claim for a different ref refuses `queue.lease-conflict` (`packages/core/src/app/queue.ts:2165-2200`). The dispatch path claims with the fixed holder `dispatch` (`packages/cli/src/production.ts:3078-3086`), so a second dispatch on one ref is an own-holder same-ref renewal and proceeds. *(read 2026-11-18)*
- **FACT:** TDR-0026 C-4/DC-2 fixed the path split — dispatch refuses any live same-ref lease, `queue claim` keeps its own-holder renewal — and DC-3 narrowed renewal to one `(repository, ref, holder)` with the repository-exclusive lease intact. This record does not reopen that split; it moves *where* the dispatch verdict is decided and closes the renewal hole on the dispatch path. *(read 2026-11-18)*
- **FACT:** The store fence is a single-writer lock; `state.lock.busy` is its declared contention identity and is transient and retryable (`packages/core/src/contracts/error-table.ts:437-445`; `packages/core/src/state/index.ts:656-680`). *(read 2026-11-18)*
- **FACT:** `queue.lease-ttl` defaults to 90 000 ms (`packages/core/src/config/defaults.ts:75`) and is the declared liveness bound for the lease. *(read 2026-11-18)*
- **Why now:** The ticket's AC-2 ("two concurrent dispatches both admit") is being read as "each receives its declared verdict" (PM DECISION A), and the current path violates both halves: it can admit two sessions through renewal, and it can report a race as an internal defect at exit 2. The parity battery cannot assert a declared verdict until the verdict is decided where the race is serialised.

## Problem Framing (Clarified)

Three defects wear one costume:

1. **The verdict is decided outside the serialisation point.** A pre-claim read cannot authorise a claim: between the read and the fence another invocation can claim. The predicate is therefore advisory, and the authoritative decision is the one nobody reads.
2. **The claimant can renew its way past the guard.** Because the dispatch holder is a constant and same-ref own-holder renewal is delivered behaviour, the second dispatch's claim succeeds *as a renewal*. The guard is bypassed by the very mechanism meant to be exclusive.
3. **A contention signal is dressed as a verdict.** `state.lock.busy` is a "wait and retry" fact about the store, not an answer about the ref. Mapping it to `queue` produces an undeclared kind/code pair, which the envelope contains as `fallback.internal` at exit 2 — neither the declared queue verdict nor the declared state failure.

The question is therefore not "should admission be atomic" but **"which observation is authoritative, what may it refuse with, and what must remain unchanged for the other caller and for repository exclusivity"**.

Root cause versus symptom: the symptom is `fallback.internal` on a race; the cause is that admission was added as a *predicate in front of* a claim that kept its own, different rules. The fix belongs inside the claim for this caller, and it must not touch the lease's scope (repository), its liveness rule (TTL), its takeover rule (stale), or the sibling path's renewal.

Deliberately out of scope: no change to the repository-exclusive lease, its TTL, or its stale takeover (NG-5, TDR-0026 C-5); no change to `queue claim`'s own-holder renewal, its refusal of another holder's same-ref lease, or its `queue.lease-conflict` on another ref (TDR-0026 DC-2/DC-3); no new error identity, row, or domain kind (NFR-3); no new configuration key (NFR-11); no change to the composed daemon supervision claim's per-pass snapshot predicate (its own question, see Unresolved Questions).

## Constraints (Hard Requirements)

### C-1: Every refusal carries a declared error-table pair — never an internal containment

- **Statement:** An admission refusal's kind and code are always a declared pair from the error table, and the projection class and exit follow from that row. No admission outcome produces `fallback.internal`, and no pair is invented by relabelling a state failure as `queue`.
- **Source:** AC (§5.1 F-2; §12 assumption 5; AC-F2-1, AC-F2-3; §22 "No internal containment for admission")
- **Verification:** test (per refusal: declared row lookup succeeds, kind matches the row's domain kind, exit equals the row's projection class; a persistent `state.lock.busy` yields a `state` kind at exit 2) + code review
- **Negotiable:** no

### C-2: The verdict is decided from the live lease observed inside the claim

- **Statement:** The admitted/refused answer, and which refusal it is, is derived from the lease state read under the claim fence. A pre-claim observation may exist for other purposes but is never the authority for the dispatch verdict.
- **Source:** AC (DEC-1; AC-F2-1, AC-F2-3; §4.1 "0 double-claim")
- **Verification:** test (deterministic two-invocation interleaving over a real store: exactly one admitted, one refused with the declared verdict; a pre-read that would have admitted cannot authorise a claim) + code review
- **Negotiable:** no

### C-3: Repository exclusivity, its TTL, and its stale takeover are unchanged

- **Statement:** At most one live lease per repository remains the rule; liveness is heartbeat age below the lease TTL; a stale lease is taken over with its incident evidence; a live lease on another ref in the same repository refuses `queue.lease-conflict`. No admission change widens or narrows the lease's scope.
- **Source:** AC (NG-5; §8.5; §7.2 `[OUT]`; TDR-0026 C-5; AC-F2-2)
- **Verification:** test (stale takeover unchanged; other-ref refusal unchanged; the live lease's recorded `ref` unchanged by any refusal) + code review
- **Negotiable:** no

### C-4: The sibling `queue claim` path keeps its delivered renewal

- **Statement:** `queue claim` continues to renew the caller's own holder's live same-ref lease without a session, to refuse another holder's same-ref lease with `queue.single-flight` and `detail.holder`, and to refuse another ref with `queue.lease-conflict`. Only the dispatch claim refuses a live same-ref lease under any holder and never renews.
- **Source:** AC (NG-5; AC-F2-5; TDR-0026 C-4/DC-3)
- **Verification:** test (the delivered direct-claim controls stay green with no assertion change; the dispatch path refuses where the claim path renews) + code review
- **Negotiable:** no

### C-5: A refusal appends nothing and starts nothing

- **Statement:** Every admission refusal appends zero lease records, zero lane records, zero attempt records, and zero events, starts no session, and exits its row's mapped code without crashing; an attempts read for the refused ref returns the empty-history success with zero records.
- **Source:** AC (AC-F2-4; NFR-8 "0 lost request; 0 crash"; NFR-4)
- **Verification:** test (state snapshot equality before/after; zero sessions started; the attempts read returns empty success) + code review
- **Negotiable:** no

### C-6: The fence wait is bounded by a delivered quantity and adds no key

- **Statement:** Store-fence contention is waited on for a bounded period no greater than the queue lease TTL and then re-decided from the observed lease; the wait is not unbounded, is not a verdict, adds no configuration key, and a persistent state failure keeps its `state.*` identity at exit 2.
- **Source:** AC (AC-F2-3; NFR-8; NFR-11; API-2)
- **Verification:** test (injected fence contention: the verdict is decided after the fence is released; a persistent busy fence yields the `state.*` row and exit 2; config key-set unchanged) + code review
- **Negotiable:** no

**Table stakes.** Every alternative below uses the delivered `detail.holder` slot for the holder (TDR-0027), the delivered queue identities, and the delivered append-only lease ledger; none of those eliminates an alternative.

## Decision Drivers

1. **A race must be serialised where it is decided.** Exclusivity that is checked before the lock is not exclusivity; the authoritative observation must be the one taken under the fence.
2. **Operator and agent actionability.** `queue.single-flight` says "wait for the named holder, then retry" and exits 1; `fallback.internal` says "something is broken inside" and exits 2. The second is a lie about a normal race.
3. **One meaning per refusal.** A state failure is about the store; a queue refusal is about the ref. Conflating them makes both unreadable and creates a second contract for the same fact.
4. **Do not spend the exclusivity contract to close a race.** Repository exclusivity, its TTL, and its takeover are the delivered guarantee the ticket protects; a per-ref lease would be a different system.
5. **Do not break the other caller.** `queue claim`'s renewal is used by operators and by the delivered claim controls; a fix that changes it fixes the dispatch path by breaking a delivered behaviour.
6. **Solo-maintainer cost and the paved road.** One decision point inside the delivered claim, one bounded wait, one refusal table, no new identity, no new key.

## Decision Rights (DACI)

- **Driver:** `@decision-advisor` — GH-347 routes the AC-2 interpretation and the fence-contention defect here as binding PM DECISION A (spec DEC-1), and this record amends TDR-0026's dispatch-admission mechanism.
- **Decider / Approver:** Juliusz Ćwiąkalski at the GH-347 PR review. AI does not accept this R2 record.
- **Contributors:** `@pm` (binding DECISION A and the ticket's exclusivity intent), `@spec-writer` (F-2, API-2, DM-7, AC-F2-x, DEC-1), `@decision-advisor` (repository analysis, this record).
- **Required reviewers:** `@readiness-reviewer`, `@reviewer`, and the human owner.
- **Performers:** `@coder` (the atomic verdict, the fence wait, the dispatch renewal refusal, the kind/code pairing, the race case); `@doc-syncer` (dispatch-engine and queue reference pages).
- **Informed:** operators and agents that dispatch; the daemon supervision claim owner; future claim-path callers.

**Type note.** TDR. This is a caller-specific mechanism inside the queue-contract decisions already recorded (TDR-0026 DC-2/DC-3) and the exit taxonomy (TDR-0005); the architecture-level question — is exclusion a repository-exclusive lease? — is delivered and is not reopened. It is R2 because it changes the refusal behaviour of a delivered command on a concurrency path and the ticket's AC-2 rests on it. It is not R3: the facts are repo-local and directly read, the store fence provides the serialisation primitive, and the change is reversible by reverting one claim path.

## Evidence, Assumptions & Unknowns

| Item | Label | Source | Impact if false | Confidence |
|---|---|---|---|---|
| The dispatch verdict is decided by a pre-claim read, then the claim re-decides under the fence. | FACT | `packages/cli/src/production.ts:3054-3093`; `packages/core/src/app/queue.ts:1148-1200` (read 2026-11-18) | If the pre-read were already inside the fence, the race would not exist. | High |
| The claim's fence acquisition is non-blocking and returns `state.lock.busy` on contention. | FACT | `packages/core/src/app/queue.ts:1946-1958`; `packages/core/src/state/index.ts:656-680` (read 2026-11-18) | A blocking fence would make contention a wait instead of a failure. | High |
| The dispatch run maps every failed claim to `kind: "queue"`, and a `state.lock.busy` code is not a queue row, so the pair is contained as `fallback.internal` at exit 2. | FACT | `packages/core/src/app/dispatch.ts:686-698`; `packages/core/src/contracts/result.ts:24-31`; `packages/core/src/contracts/error-table.ts:57-61` (read 2026-11-18) | If the mapping already preserved kind, the defect would be limited to the renewal hole. | High |
| `queue.single-flight` is transient/retryable, exit 1, names the holder in `detail.holder`. | FACT | `packages/core/src/contracts/error-table.ts:1349-1359`; `contracts/result.ts:60-68` (`CommandResultDetail.holder`) (read 2026-11-18) | If it were a platform row, exit 2 would be correct and the defect would be the name only. | High |
| Inside the fence, an own-holder same-ref claim renews and proceeds; the dispatch holder is the constant `dispatch`. | FACT | `packages/core/src/app/queue.ts:2165-2180`; `packages/cli/src/production.ts:3078-3086` (read 2026-11-18) | A per-invocation dispatch holder would make the renewal hole unreachable. | High |
| TDR-0026 fixed the path split and narrowed renewal to one `(repository, ref, holder)`. | FACT | `doc/decisions/TDR-0026-queue-lifecycle-removal-single-flight.md` C-4, C-5, DC-2, DC-3 (read 2026-11-18) | If renewal were still holder-only, this record would have to re-decide it rather than preserve it. | High |
| The queue lease TTL default is 90 000 ms and is the declared liveness bound. | FACT | `packages/core/src/config/defaults.ts:75` (read 2026-11-18) | The fence-wait bound would need its own quantity, which NFR-11 forbids for this change. | High |
| The store fence serialises writers, so two invocations cannot both hold it. | ASSUMPTION | The delivered fence contract (`packages/core/src/state/index.ts:656-680`) and TDR-0004; the parity battery's two-invocation interleaving is deterministic, not an arbitrary OS schedule | If the fence did not serialise across processes, no atomic verdict would be reachable and the refusal would remain best-effort. | High (repo-local: contract and implementation read) |
| Whether the composed daemon supervision claim should also decide its verdict inside the claim rather than from its per-pass snapshot. | TO-CONFIRM | `packages/core/src/app/supervise.ts:1009-1030` (`singleFlightRefusalFromLeases` on a per-pass snapshot); spec NG-6 and §7.2 do not move it | If required, it is a daemon-family admission decision with its own concurrency argument; until then the daemon path keeps its delivered predicate. (owner: `@pm` / `@spec-writer`) | Medium |
| A fence wait up to the lease TTL is acceptable operationally for a refused dispatch. | ASSUMPTION | The bound is declared by the spec (AC-F2-3, NFR-8) and only reached under a writer that holds the fence for the whole period | A pathological long writer delays a refusal; the alternative (an unbounded wait) is worse and a new key is forbidden. | Medium |

## Mental Models & Techniques Used

- **First principles:** What makes exclusivity true? A single serialisation point, an observation taken inside it, and a rule that the observation decides. The delivered claim already has the first; the second and third are what this record fixes for the dispatch caller.
- **Inversion:** What makes admission *look* fixed and stay broken? Fixing the kind/code mapping only, which removes the ugly exit code and keeps the race and the renewal bypass. Adding a second predicate, which makes the pre-read look authoritative again. Making the lease per-ref, which closes the race by spending the exclusivity contract. Refusing the own-holder renewal on both paths, which breaks `queue claim`.
- **Second-order thinking:** Moving the verdict inside the claim means the *lease ledger* becomes the single source of admission truth for both callers, and the path difference becomes one rule ("does this caller renew?") instead of two predicates that must agree. That is what makes the race case testable at all.
- **Systems thinking:** The chain is preflight → nomination → owner hold → claim → spawn. Each earlier step can refuse for its own reason, and only the claim is serialised. Placing the verdict there gives every refusal a stable position in the ladder (Appendix F(A)) instead of an ordering that depends on timing.
- **5 Whys (on `fallback.internal`):** exit 2 on a race → an undeclared kind/code pair → the dispatch run hardcodes `kind: "queue"` for any claim failure → the claim's state failure carries `kind: "state"` and the wrapper drops the kind → the wrapper was written when the only claim failure was a queue refusal. The fix is to preserve the pair, and to stop producing a claim failure that is really a wait.
- **Paced road / KISS:** Keep the delivered fence, identities, lease, and `detail.holder`; add one wait loop and one renewal refusal on one caller.

## Alternatives Considered

### Per-Alternative Constraint-Compliance Evaluation

Legend: ✅ passes · ❌ fails. Every constraint is `negotiable: no`, so no accepted-risk exception exists and no driver score rescues a failing option.

| | C-1 declared pair | C-2 verdict inside the claim | C-3 exclusivity unchanged | C-4 sibling claim unchanged | C-5 nothing appended | C-6 bounded wait, no key |
|---|:---:|:---:|:---:|:---:|:---:|:---:|
| ALT-0 keep the pre-read and the current mapping | ❌ | ❌ | ✅ | ✅ | ✅ | ✅ |
| ALT-1 fix only the kind/code mapping | ✅ | ❌ | ✅ | ✅ | ✅ | ✅ |
| ALT-2 atomic claim but keep the dispatch own-holder renewal | ✅ | ❌ (a second session still admits) | ✅ | ✅ | ✅ | ✅ |
| ALT-3 refuse by widening the lease to per-ref | ✅ | ✅ | ❌ | ✅ | ✅ | ✅ |
| ALT-4 selected: verdict inside the claim, no dispatch renewal, bounded fence wait | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ |

### Alternative 0 — Do Nothing: Keep the Pre-Claim Predicate and the Current Mapping

- **Eligibility:** Not eligible (fails C-1, C-2).
- **Summary:** Ship the delivered path: predicate before the claim, non-blocking fence, `kind: "queue"` for any claim failure.
- **Constraint compliance:** Passes C-3, C-4, C-5, C-6. Fails C-1 (a `state.lock.busy` code under a `queue` kind is contained as `fallback.internal` at exit 2) and C-2 (two invocations can both pass the pre-read, and the second can renew its way in).
- **Driver fit:** Fails drivers 1, 2, 3; serves only driver 6.
- **Pros:** Zero change.
- **Cons:** The ticket's AC-2 stays false in both halves, and the parity battery has no declared verdict to assert.
- **Why rejected:** It is the defect.

### Alternative 1 — Fix Only the Kind/Code Mapping

- **Eligibility:** Not eligible (fails C-2).
- **Summary:** Preserve the claim's `state` kind so `state.lock.busy` reports exit 2 honestly; keep everything else.
- **Constraint compliance:** Passes C-1, C-3, C-4, C-5, C-6. Fails C-2: the pre-read still cannot authorise a claim, so two invocations can both reach the fence, and the second's same-ref claim still renews and proceeds — a second session with no refusal at all.
- **Driver fit:** Improves driver 3 (honest identity) and does nothing for drivers 1 and 2.
- **Pros:** Smallest possible diff; removes the internal containment.
- **Cons:** The race remains and the "declared verdict for the loser" does not exist; it also reports a contention (a wait) as a terminal platform failure.
- **Why rejected:** It makes the exit code honest about a failure that should not be a failure.

### Alternative 2 — Atomic Claim but Keep the Dispatch Own-Holder Renewal

- **Eligibility:** Not eligible (fails C-2).
- **Summary:** Decide the verdict inside the claim, but let a same-holder same-ref live lease renew as delivered, on both paths.
- **Constraint compliance:** Passes C-1, C-3, C-4, C-5, C-6. Fails C-2 in substance: in a dispatched race the holder is always `dispatch`, so the second invocation renews and proceeds — the atomic decision returns "renewed", not "refused", and two sessions still run.
- **Driver fit:** Fails drivers 1 and 2; looks clean and is the most attractive wrong answer.
- **Pros:** One refusal table for both callers; no path difference to document.
- **Cons:** The single-flight guarantee is unenforceable on the only path where it matters, because the caller's holder is fixed.
- **Why rejected:** A validated decision that the caller can satisfy by renewing is not a refusal.

### Alternative 3 — Refuse by Widening the Lease to Per-Ref

- **Eligibility:** Not eligible (fails C-3).
- **Summary:** Replace the repository-exclusive lease with a per-ref lease so a second same-ref claim conflicts at the lease layer.
- **Constraint compliance:** Passes C-1, C-2, C-4 (mechanically), C-5, C-6. Fails C-3: repository exclusivity, its TTL, and its stale takeover are delivered contracts the ticket protects, and a per-ref lease would allow two refs of one repository to run concurrently — a different system.
- **Driver fit:** Serves drivers 1 and 3; fails driver 4, which is the contract the ticket names.
- **Pros:** The refusal comes from the lease itself, with no path-specific rule.
- **Cons:** Breaks repository exclusivity and every consumer keyed on it (deploy gate, lanes projection); a far larger change than the defect.
- **Why rejected:** It closes the race by spending the guarantee the ticket exists to preserve.

### Alternative 4 — Selected: Verdict Inside the Claim, No Dispatch Renewal, Bounded Fence Wait

- **Eligibility:** Eligible.
- **Summary:** The claim observes the live lease under the fence and returns exactly one of: claimed, `queue.single-flight` (live same-ref lease, any holder, holder named), `queue.lease-conflict` (live other-ref lease), `queue.precondition.unmet` reason `owner-hold`, or a typed `state.*` failure. The dispatch claim never renews; the sibling claim keeps its renewal. Fence contention is waited on for a bounded period no greater than the lease TTL and then re-decided.
- **Constraint compliance:** Passes C-1…C-6 (matrix above). Table stakes satisfied.
- **Driver fit:** Best on every driver: one serialised decision (1), a truthful retryable verdict (2), one meaning per refusal (3), exclusivity untouched (4), the sibling caller untouched (5), one wait loop and one path rule (6).
- **Pros:** The race and the renewal bypass are closed by one rule; every refusal is a declared row with its delivered exit; the parity battery can assert a deterministic interleaving; the pre-read loses authority without being deleted from the battery's snapshot path.
- **Cons:** The dispatch path and `queue claim` now differ in a way that must be documented rather than assumed; a contention wait can add latency before a refusal; the dispatch wrapper must stop hardcoding the kind.
- **Why chosen:** It is the only alternative that satisfies every `negotiable: no` constraint, and it satisfies them inside the delivered claim rather than beside it.

## Decision

- **Decision:** Adopt **ALT-4**, amending TDR-0026 DC-2/DC-3 for the dispatch caller only.

  1. **DC-1 — The verdict is decided inside the claim.** The dispatch admission answer is produced from the live lease observed under the claim fence: claimed (with a lease identity) or refused with one declared verdict. The pre-claim predicate retains no authority over the dispatch verdict. (Spec DEC-1, F-2, API-2, DM-7.)
  2. **DC-2 — The dispatch refusal set is declared and total.** A live lease recording the requested ref under **any** holder (including `dispatch` itself) refuses `queue.single-flight` at exit 1 with the live holder named in `detail.holder`; a live lease recording another ref in the same repository refuses `queue.lease-conflict` at exit 1; an active owner hold refuses `queue.precondition.unmet` with reason `owner-hold` before the fence; a store/lease read failure keeps its `state.*` identity at exit 2. No admission outcome is contained as `fallback.internal`.
  3. **DC-3 — The dispatch claim never renews; the sibling claim still does.** Renewal on the dispatch path is impossible by rule, not by caller discipline: another invocation's live same-ref lease is a refusal, never a renewal. `queue claim`'s own-holder same-ref renewal, its other-holder refusal, and its other-ref `queue.lease-conflict` are unchanged.
  4. **DC-4 — Fence contention is a wait, not a verdict.** The claim waits for the store fence for a bounded period no greater than the queue lease TTL, then re-decides from the observed lease; a fence that never frees returns the `state.*` row at exit 2 with no relabelling. Contention never surfaces as a `queue`-kind envelope.
  5. **DC-5 — A refusal is silent and clean.** A refused dispatch appends no lease, lane, attempt, or event record, starts no session, exits its row's code, and leaves the attempts read returning the empty-history success.

### Constraint Compliance Attestation

ALT-4 satisfies C-1 through C-6. C-1: every returned verdict is a declared row, and the wrapper preserves the claim's kind instead of hardcoding `queue`. C-2: the decision is taken from the lease read under the fence. C-3: lease scope, TTL, liveness, and stale takeover are untouched; `queue.lease-conflict` still states repository exclusivity. C-4: the sibling `queue claim` path is not modified. C-5: every refusal path returns before any append or spawn. C-6: the wait is bounded by a delivered quantity and adds no key. No accepted-risk exception is claimed.

## Trade-offs & Consequences

### Positive Outcomes

- AC-2 becomes true in both halves: the winner proceeds and the loser gets a named, retryable `queue.single-flight` at exit 1.
- The renewal bypass closes without touching the sibling caller, so the delivered direct-claim controls stay green unchanged.
- Every admission refusal is a declared pair; the internal-containment exit 2 on a normal race disappears.
- The verdict has one position in the total ladder (Appendix F(A) pre-session arms), which is what makes the race case assertable offline.
- `state.lock.busy` keeps its honest meaning: a store contention, still retryable, still exit 2 when it persists.

### Negative Outcomes

- The dispatch path and `queue claim` now return different outcomes for the same live state, which is deliberate but must be documented (spec §8.5 and the queue page) or a future reader will call it a bug.
- A contention wait can delay a refusal by up to the lease TTL; the bound is an analogy to lease liveness rather than a derived quantity, and it is the largest single-source latency this change introduces on the admission path.
- The dispatch wrapper must stop coercing kinds, which means it now has to pass through a kind it previously never produced; a future claim failure kind that is neither `queue` nor `state` would need a decision, not a default.
- Two invocation paths now share one claim function with one behavioural flag ("may renew"), so a change to the claim must be reviewed for both callers.

### Unresolved Questions

- [ ] Should the composed daemon supervision claim also decide its verdict inside the claim rather than from its per-pass snapshot? (owner: `@pm` / `@spec-writer`; the spec does not move it, and it is a daemon-family concurrency decision)
- [ ] Is a wait up to the full lease TTL the right ceiling, or should a refused dispatch be told "busy" sooner? (owner: `@decision-advisor` if operators report added latency on the admission path)
- [ ] Does any consumer read a `queue`-kind envelope's code and assume the queue domain, in a way that a preserved `state` kind would break? (owner: `@reviewer` at the change's review; the delivered consumers classify by code, and the parity battery asserts exits)

## Implementation Plan

1. **Claim.** Add the path flag ("this caller may not renew") and the bounded fence wait to the delivered claim; keep the fence body's existing lease fold, stale takeover, and `queue.lease-conflict` construction.
2. **Verdict.** Return the declared refusal set from inside the fence, naming the holder for `queue.single-flight`; keep the owner-hold precondition before the fence.
3. **Composition.** Remove the dispatch verdict's dependence on the pre-claim predicate; preserve the claim's kind in the dispatch wrapper so `state.*` stays `state` and the queue identities stay `queue`.
4. **Battery.** Add the deterministic two-invocation same-ref case over a real store and the other-ref case; assert one admitted, one refused with the declared row, `detail.holder`, zero records on the refusal, and zero `fallback.internal`.
5. **Documentation.** Record the path difference on the queue reference page and the dispatch-engine page, and state that repository exclusivity and the sibling renewal are unchanged.

## Verification Criteria

- Two concurrent same-ref dispatches over a real store: exactly one lease appended, one `queue.single-flight` at exit 1 with `detail.holder` naming the winner, zero attempt records and zero lane records for the loser, zero `fallback.internal`, zero crashes.
- A live lease on another ref in the same repository: `queue.lease-conflict` at exit 1 as a pre-session refusal with zero records.
- A persisted `state.lock.busy` (fence never acquired): the `state` row at exit 2, no queue relabelling, zero records.
- `queue claim` by its own holder on its own live lease: still `renewed`, with no session and no behaviour change; the delivered direct-claim controls pass with no assertion change.
- A refusal followed by an attempts read: empty-history success with zero records.
- Configuration key set unchanged; the queue error-row inventory unchanged.

## Confidence Rating

**High.** Every load-bearing fact is repo-local and read directly: the pre-claim predicate and its composition, the non-blocking fence and its `state.lock.busy` identity, the dispatch wrapper's hardcoded `queue` kind, the two error-table rows with their categories and projections, the own-holder renewal inside the fence, the fixed dispatch holder, and the lease TTL default. The residual uncertainty is the daemon supervision claim's placement, which this record deliberately leaves open.

## References

- Change: `doc/changes/2026-11/2026-11-18--GH-347--dispatch-core-parity/chg-GH-347-spec.md` — §2.1 (admission snapshot), §5.1 F-2, §6 Flow 2, §8.1 API-2, §8.3 DM-7, §8.5, §12, §17.2, §22, §25.2, §25.6 Appendix F(A).
- Amended decision: `doc/decisions/TDR-0026-queue-lifecycle-removal-single-flight.md` — C-4, C-5, DC-2, DC-3.
- Prior decisions: TDR-0005 (delivery result enum and exit taxonomy); TDR-0027 (failure-envelope `detail.holder`); [TDR-0044](TDR-0044-dispatch-owned-durable-lane-record.md) (the lane a live lease protects).
- Specs: `doc/spec/features/feature-dispatch-engine.md` (per-ref single-flight table); `feature-scheduling-engine.md`.
- Contracts and code (read 2026-11-18): `packages/core/src/app/queue.ts`; `packages/core/src/app/dispatch.ts`; `packages/core/src/contracts/error-table.ts`; `packages/core/src/contracts/result.ts`; `packages/core/src/state/index.ts`; `packages/cli/src/production.ts`; `packages/core/src/config/defaults.ts`.
- Parity reference: `scripts/deliver-ticket.sh` (single-lane-per-ticket expectation) and the TDR-0026 delivery evidence for the two-path guard.
