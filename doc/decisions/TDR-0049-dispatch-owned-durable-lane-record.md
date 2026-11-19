---
id: TDR-0049
decision_type: tdr
status: Proposed
created: 2026-11-18
decision_date: null
last_updated: 2026-11-19
summary: "A dispatch that acquires a session appends exactly one active `dispatch.lane` record (`delivery.dispatch.lane.v1`, key `dispatch.lanes:<REF>`) at acquisition — session identity, normalized repository, attempt identity, harness kind, owner process id and declared start time, a 1-based iteration ordinal, the consumed restart count, and `state: active` — and one terminal record carrying the final token and outcome at the dispatch's final classification; records are append-only and the latest record for the ref is the lane; the kind is dispatch-owned, never read or rewritten by the daemon family, never carries a prompt, transcript, diff, credential, or provider payload, and is the resumable artifact a `--resume-prompt` resolves — any recorded record with a session identity is resumable regardless of the token it recorded, and a recorded lane is never silently replaced by a fresh spawn."
owners:
  - "Juliusz Ćwiąkalski"
service: "delivery-os dispatch plane (durable per-ref lane record, session-identity capture, resumability)"
decision_scope: repo
review_date: null
customer_impact: "A crashed, stalled, or finished dispatch that held a session becomes resumable by ref instead of decaying into a fresh spawn with no admission, and a `pr-open` attempt can be continued rather than re-dispatched."
classification:
  domains: [architecture, contracts, state]
  archetype: design
  environment: complicated
  rigor: R2
  reversibility: moderate
  stakes: high
  urgency: high
  uncertainty: low
  blast_radius: team
  recurrence: one-off
governance:
  driver: "@decision-advisor (GH-347: the specification routes the lane-record home as binding PM DECISION B and DEC-2; the record is authored before dependent delivery)"
  decider: "Juliusz Ćwiąkalski — human acceptance at the GH-347 PR review; AI does not accept this R2 record"
  contributors:
    - "@pm (GH-347 clarify_scope: binding PM DECISION B — a distinct dispatch-owned lane rather than an extended `daemon.lane`)"
    - "@spec-writer (chg-GH-347-spec §5.1 F-1, §8.3 DM-1/DM-2, §17.1 AC-F1-1…AC-F1-4, DEC-2 with the DEC-3 resolution rule folded in)"
    - "@decision-advisor (repository analysis and this record)"
  reviewers:
    - "@readiness-reviewer"
    - "@reviewer"
    - "Human owner (GH-347 PR review — this record fixes a durable record kind, its ownership boundary, and the resume read rule)"
  performers:
    - "@coder (GH-347: the lane record kind and payload, the acquisition and terminal appends, the latest-wins read, the append-failure evidence reference, the resume resolver)"
    - "@doc-syncer (GH-347 documentation phase: dispatch-engine, resident-daemon, and the operator reference pages)"
  informed:
    - "GH-354 (the deferred `status`/`log`/`is-delivering` operator surface reads this record's artifact)"
    - "Daemon reconciliation ownership (the daemon family must never adopt or rewrite a dispatch lane)"
    - "Any future shared lane-resolution implementation spanning one-shot and daemon lanes"
ai_assistance:
  used: true
  roles: [repository-analyst, analyst, record-writer]
  external_data_shared: false
  citations_verified: true
  human_decider: null
  reviewers: []
revisit_triggers:
  - "The daemon needs to resume a one-shot-owned session (the deferred shared lane-resolution item): that is a read-side agreement between two owners and is decided as an amendment here, never by letting the daemon write a `dispatch.lane` record."
  - "A lane field is added, renamed, or removed: the payload schema is `delivery.dispatch.lane.v1` and a shape change is a schema decision with its own key-set pin, not a convention inside v1."
  - "An operator needs a per-ref lane history or the phase-ledger position on the lane record: that is GH-354's read surface plus one additive field, and it must not be re-derived from attempt records."
  - "A pre-change store is required to expose a lane for a ref that never had one: absence stays the classified `no lane` state; fabricating a lane from attempt history is refused."
  - "A second consumer wants to treat `state: terminal` as evidence that the ref is finished: the terminal record carries the classification, not a work verdict, and any such reading is a new decision."
links:
  related_changes: ["GH-347"]
  supersedes: []
  superseded_by: []
  spec:
    - "doc/changes/2026-11/2026-11-18--GH-347--dispatch-core-parity/chg-GH-347-spec.md"
    - "doc/spec/features/feature-dispatch-engine.md"
    - "doc/spec/features/feature-resident-daemon.md"
    - "doc/spec/features/feature-session-lifecycle-economics.md"
  contracts:
    - "packages/core/src/contracts/daemon.ts"
    - "packages/core/src/contracts/dispatch.ts"
    - "packages/core/src/contracts/state.ts"
    - "packages/core/src/app/daemon.ts"
    - "packages/core/src/app/dispatch.ts"
    - "packages/cli/src/production.ts"
    - "scripts/deliver-ticket.sh"
  diagrams: []
  decisions: ["TDR-0004", "TDR-0023", "TDR-0024", "TDR-0050", "TDR-0052"]
  experiments: []
  metrics: []
  roadmap_items: ["M4-S9"]
---

# TDR-0049: Dispatch-Owned Durable Lane Record

> **Traceability.** Spec §15 **DEC-2** (lane-record home) and the resolution half of **DEC-3** (resume over a recorded lane); §15.1 maps DEC-2 to this record; §5.1 F-1; §8.3 DM-1 and DM-2; §8.5 backward compatibility; §17.1 AC-F1-1…AC-F1-4. Sibling records: [TDR-0050](TDR-0050-dispatch-atomic-admission-verdicts.md) (admission), [TDR-0052](TDR-0052-in-process-bounded-restart-loop.md) (the loop whose iterations append these records).

## Context

GH-347 (milestone story M4-S9) must make `jaiship dispatch <ref>` a complete typed replacement for the shell delivery lane. The shell lane keeps a per-ticket session mapping (session id, title, branch, status, `restart_count`) and provisions a resume from it. The typed one-shot engine has no equivalent, so a crashed or stalled dispatch leaves nothing resumable.

- **FACT:** The durable attempt record is written only when an attempt reaches classification, and its `token` is required (`packages/core/src/contracts/dispatch.ts:224-267`; `packages/core/src/app/dispatch.ts` appends it from the single `record(...)` path). It therefore cannot exist before the outcome is known. *(read 2026-11-18)*
- **FACT:** The attempt record's `sessionIds` is optional and documented as "the session identities this attempt held — one per spawn/resume", absent on an attempt that held none (`contracts/dispatch.ts:246-252`). That field can only be populated at classification, i.e. after the session is already gone. *(read 2026-11-18)*
- **FACT:** A daemon lane record exists and is daemon-owned: kind `daemon.lane`, schema `delivery.daemon.lane.v1`, prefix `daemon.lanes:` (`core/src/contracts/daemon.ts:42-49`), five lifecycle states `delivering | detached | completed | failed | preempted` (`daemon.ts:135-142`), and fields `ref`, `state`, `harnessKind`, `sessionId`, `processId`, `ledgerPosition`, `spawnOrdinal`, `liveness`, `detachedAt`, `classification`, `resumeIntent`, `providerProfile`, `recordedAt` (`daemon.ts:163-183`). The daemon computes the next action, claims, records one delivering record, observes, and releases or parks (`doc/spec/features/feature-resident-daemon.md` §Lane supervision). *(read 2026-11-18)*
- **FACT:** Every daemon lane read is kind-, schema-, and prefix-scoped: `readDaemonLanes` passes `kind: "daemon.lane"`, `schema: "delivery.daemon.lane.v1"`, and `keyPrefix: "daemon.lanes:"` to `readLedger` (`packages/core/src/app/daemon.ts:281-293`). A record under a different kind and prefix is invisible to every delivered daemon fold. *(read 2026-11-18)*
- **FACT:** Resume is gated on `--resume-prompt` and blind to finished attempts: the production lane facts take the newest daemon lane whose `ref` matches, whose `sessionId` is defined, and whose state is `delivering`, `detached`, or `preempted` (`packages/cli/src/production.ts:2464-2485`). A finished one-shot attempt records no daemon lane at all, so `--resume-prompt` degrades to a fresh spawn with no resume admission. *(read 2026-11-18)*
- **FACT:** The shell lane's session mapping is a separate per-ticket file carrying `session_id`, `title`, `branch`, `status`, `restart_count`, and it is written before the iteration runs and re-read to resume (`scripts/deliver-ticket.sh:1115-1152`, `:1894-1970`). Resumability is therefore a property of a record written at acquisition, not of the outcome. *(read 2026-11-18)*
- **FACT:** The durable store is an append-only ledger: records are appended, carries a monotonic `sequence`, and no delivered path rewrites a persisted record (`packages/core/src/contracts/state.ts:50-56`; TDR-0004). *(read 2026-11-18)*
- **FACT:** Two current-truth pages describe one-shot dispatch without any per-ref lane and state that the session port exposes no kill operation (`doc/spec/features/feature-dispatch-engine.md:65`; `doc/spec/features/feature-session-lifecycle-economics.md:93,185`). *(read 2026-11-18)*
- **Why now:** The shell lane cannot be retired until the typed lane is resumability-complete, and the binding PM decision for GH-347 (DECISION B) already fixes the answer: a distinct dispatch-owned record rather than an extension of `daemon.lane`. The remaining work is to state the contract precisely enough that a coder, a reviewer, and GH-354 all build against one shape.

## Problem Framing (Clarified)

The symptom is "a crashed dispatch cannot be resumed". The cause is a **missing durable fact, not a missing code path**: nothing records that a session exists until the moment it is classified, and the only durable lane-shaped record in the system belongs to another owner with another lifecycle.

Four separable questions decide the contract, and answering any of them by convenience corrupts another:

1. **Home.** Where may a per-ref resumable fact live — the attempt record, the daemon lane, a queue record, or a new kind?
2. **Write points.** When is the record appended, and what is true at each append?
3. **Read shape and resume eligibility.** What does "the lane for this ref" mean, and which recorded states are resumable?
4. **Ownership.** Which family may write, reconcile, and adopt the record — and what happens when the write fails?

The root cause of the ownership question is that `daemon.lane`'s states encode *daemon supervision* (`delivering`, `detached`, `preempted` are supervision lifecycle words). Reusing them for a one-shot run would make a one-shot lane look adoptable by daemon reconciliation, and would force dispatch to write a state vocabulary it does not own.

Deliberately out of scope, so the boundary is reviewable: no change to `daemon.lane`, its states, or reconciliation ownership (spec NG-6); no attempt-record field or schema-version change (NG-4); no operator surface — `status`, `log`, `is-delivering`, `last-message`, and per-ref log persistence stay with GH-354 (NG-1); no new configuration key (NG-11); no phase-ledger position on the lane beyond what the resume resolver already reads from the ledger.

## Constraints (Hard Requirements)

### C-1: A session is recorded when it is acquired, before its outcome is known

- **Statement:** When a dispatch acquires a session handle by fresh spawn or by resume, exactly one active lane record for the ref is appended carrying that session identity; a dispatch that acquires no session appends no lane record. No write depends on the attempt's classification.
- **Source:** AC (§17.1 AC-F1-1, AC-F1-4; §4.1 "100% of admitted dispatches with a held session append an active lane record; 0 pre-session refusals append a lane")
- **Verification:** test (append ordering against the spawn/resume seam; zero lane records on every pre-session refusal path) + code review
- **Negotiable:** no

### C-2: The record is dispatch-owned and the daemon family neither reads nor writes it

- **Statement:** `daemon.lane` keeps its kind, payload schema, five states, reconciliation ownership, and delivered read path; the new kind is a distinct kind with a distinct state vocabulary, and no daemon path reads it as a supervised lane, adopts it for reconciliation, or rewrites it. The dispatch family never writes a `daemon.lane` record.
- **Source:** AC (§7.2 `[OUT]` daemon lane; NG-6; §8.5 "Daemon lane unchanged"; AC-F1-4)
- **Verification:** test (a seeded dispatch lane yields no daemon lane read and no reconciliation lane; a seeded daemon lane is not listed as a dispatch lane; the daemon suite stays green unchanged) + code review
- **Negotiable:** no

### C-3: The attempt record's shape and meaning are unchanged

- **Statement:** `DispatchAttemptRecord` keeps its field set, its required `token`, and its schema identity; the lane is not carried on the attempt record, no attempt field is added for it, and a pre-change attempt record reads unchanged.
- **Source:** AC (§8.3 DM-2; NG-4; NFR-3; AC-NFR-10)
- **Verification:** test (attempt key-set equality; pre-change record round-trip; the resume fact is read from the lane) + code review
- **Negotiable:** no

### C-4: The lane carries identifiers and counts only

- **Statement:** No prompt, transcript, diff, credential, provider payload, or environment value appears in a lane record; the record carries at most one owner object and one session identity; every diagnostic derived from it is single-line and identifier-only.
- **Source:** AC (§10; NFR-7; §21 privacy review)
- **Verification:** test (payload key-set equality; redaction assertion over a populated record) + code review
- **Negotiable:** no

### C-5: No new configuration key and no migration

- **Statement:** The lane's write points, bounds, and read rule are declared policy; no configuration key is added, no persisted record is rewritten, no schema version is bumped, and a store with no lane records resolves "no lane" rather than fabricating one.
- **Source:** AC (NG-11; NFR-11; §20 "No migration is required"; AC-F1-4)
- **Verification:** test (config key-set equality; empty-store resolution; append-only assertion) + code review
- **Negotiable:** no

### C-6: A failed lane write never changes the delivery verdict and never silently claims resumability

- **Statement:** If the lane append cannot be persisted, the attempt continues, the attempt record is still appended, the token and exit are unchanged, and the attempt carries a bounded `lane:append-failed` evidence reference within the delivered 16-reference budget.
- **Source:** AC (AC-F1-3; §8.3 DM-2; NFR-4; NFR-7)
- **Verification:** test (injected append failure: token equality, one attempt record, the evidence reference present, no resumable claim) + code review
- **Negotiable:** no

**Table stakes.** Every alternative below satisfies "no new package or workspace subpath", "append-only store discipline", and "no new error identity" (the append failure is evidence, not an identity). They eliminate nothing and are not listed per alternative.

## Decision Drivers

1. **Resumability must survive the outcome being unknown.** The whole point of a lane is that it exists before classification. A record written at classification is a report, not a lane.
2. **One owner per record.** A record that two families write has no owner, and a record a supervisor can adopt has an ambiguous lifecycle. Ownership is what makes "the daemon does not reconcile this" a fact rather than a hope.
3. **One meaning per word.** Reusing `delivering`/`completed` for a one-shot run would make the same state word mean "the daemon is supervising this" and "a one-shot run had a session", which no reader can disambiguate.
4. **The delivered append-only discipline.** An additive kind costs one declaration and no migration; a mutable field on a delivered payload costs a second reading of history.
5. **Honest degradation.** A failed lane write must be visible, not silent; the token must not move because a bookkeeping append failed.
6. **Solo-maintainer cost and the paved road.** One record kind, two write points, one read rule, one resolver — reusing the delivered per-ref prefix-scoped read pattern and the delivered evidence-reference budget.

## Decision Rights (DACI)

- **Driver:** `@decision-advisor` — GH-347 routes the lane-record home as binding PM DECISION B (spec DEC-2) and the record is authored before dependent delivery.
- **Decider / Approver:** Juliusz Ćwiąkalski at the GH-347 PR review. AI does not accept this R2 record.
- **Contributors:** `@pm` (binding DECISION B), `@spec-writer` (F-1, DM-1/DM-2, AC-F1-x, DEC-2/DEC-3), `@decision-advisor` (repository analysis, this record).
- **Required reviewers:** `@readiness-reviewer`, `@reviewer`, and the human owner.
- **Performers:** `@coder` (record kind, appends, read, recovery disclosure, resolver); `@doc-syncer` (dispatch-engine, resident-daemon, reference pages).
- **Informed:** GH-354; daemon reconciliation ownership; any future shared lane-resolution work.

**Type note.** TDR, not ADR. The ADR/TDR tie-breaker prefers ADR at `blast_radius >= team` or `reversibility: hard`; this record's blast radius is the team and the state layer, so it sits at the boundary. It is a TDR because the architecture-level question — is durable per-ref state a shared append-only ledger with per-domain record kinds? — was decided by TDR-0004 and the daemon's own record-kind pattern (TDR-0023), and is not reopened here; this record fixes *one* kind inside that decided shape. It is R2 and not R1 because it introduces a new durable kind, an ownership boundary, and a resume rule three later changes depend on. It is not R3: every load-bearing fact is repo-local and read directly, the change is additive on an append-only store, and nothing legal, financial, irreversible, or safety-critical is involved.

## Evidence, Assumptions & Unknowns

| Item | Label | Source | Impact if false | Confidence |
|---|---|---|---|---|
| The attempt record requires a `token` and is appended only at classification, so it cannot serve as a pre-run lane. | FACT | `packages/core/src/contracts/dispatch.ts:224-267`; `packages/core/src/app/dispatch.ts` (single `record(...)` append path) (read 2026-11-18) | If it were writable earlier, an additive field would be enough and C-3 would be over-constraining. | High |
| `sessionIds` is optional and populated only at classification. | FACT | `contracts/dispatch.ts:246-252` (read 2026-11-18) | The "session identity captured late" gap would not exist. | High |
| `daemon.lane` is a distinct kind/schema/prefix with five supervision states, and every daemon lane read is kind-, schema-, and prefix-scoped. | FACT | `core/src/contracts/daemon.ts:42-49,135-142,163-183`; `core/src/app/daemon.ts:281-293` (read 2026-11-18) | A prefix-blind read would make a new kind visible to daemon folds; the ownership claim would need enforcement elsewhere. | High |
| Resume today reads only daemon lanes in `delivering`/`detached`/`preempted` that carry a session identity. | FACT | `packages/cli/src/production.ts:2464-2485` (read 2026-11-18) | A finished one-shot attempt would already be resumable and DEC-3's resolution rule would be unnecessary. | High |
| The shell lane records session identity at acquisition and resumes from it. | FACT | `scripts/deliver-ticket.sh:1115-1152,1894-1970` (read 2026-11-18) | The parity claim would have no reference implementation. | High |
| The store is append-only with a monotonic per-record `sequence`, and no delivered path rewrites a record. | FACT | `packages/core/src/contracts/state.ts:50-56`; TDR-0004 (read 2026-11-18) | Latest-wins would need another total order. | High |
| The attempt record's evidence budget is 16 references. | FACT | `packages/core/src/contracts/dispatch.ts:535` (`DISPATCH_MAX_EVIDENCE_REFS = 16`) (read 2026-11-18) | C-6's disclosure could exceed the record's bound. | High |
| A harness session survives the process, so a recorded session identity stays resumable after a clean exit or a terminated stall. | ASSUMPTION | Spec §12 (assumption 3); `scripts/deliver-ticket.sh` resume-by-session-id practice | If false, a resume over a finished attempt would fail; the decision's answer is a classified failure, never a silent fresh spawn, so the failure stays visible. | Medium-High |
| Owner process id and start time are advisory only, and the queue lease remains the exclusion mechanism. | FACT | Spec §5.1 F-1; `dispatchAdmissionRefusal` and the lease ledger (TDR-0026 DC-1/DC-2) | If staleness were derived from pid liveness, the lane would become a second exclusion authority. | High |
| Whether GH-354 needs the phase-ledger position on the lane rather than reading the ledger. | TO-CONFIRM | GH-354 scope (§7.2 `[OUT]`) | A field would be added later under v1 key-set rules, or the resolver keeps reading the ledger. (owner: `@pm` on GH-354 intake) | Medium |

## Mental Models & Techniques Used

- **First principles:** What must be true for "this ref can be resumed" to be a fact? (i) a durable record exists before the outcome is known, (ii) it names the session that is still alive, (iii) it is unique per ref under a defined read rule, (iv) its owner is unambiguous. Nothing else is required, and no requirement implies reuse of the daemon record.
- **Inversion:** What makes resumability dangerous? A record written at classification (nothing to resume after a crash); a record a supervisor can adopt (two authorities on one session); a record that drifts into carrying prompts (a privacy leak in durable state); a silent append failure (a resumability claim that cannot be honoured); a fabricated lane for pre-change state. C-1…C-6 close exactly these.
- **Second-order thinking:** Adding a kind is cheap today and fixes what every later consumer may assume — that the latest record for a ref is *the* lane, so GH-354's `status`/`log`, the resume resolver, and any future shared resolver read one artifact. Choosing the attempt record instead would push a mutating write into a record whose contract is "one immutable report per classified attempt".
- **Systems thinking:** The chain is acquisition → session identity → lane append → read → resume mode → budget accounting. Each link can substitute a different fact: the lane append can happen too late, the read can pick the daemon's record, the resolver can pick a token-filtered subset, the loop can treat an operator resume as an automatic restart. This decision pins the first three joins; the fourth is TDR-0052's.
- **5 Whys (on "resume degrades to a fresh spawn"):** no fresh spawn is wrong → no lane was resolved → the resolver only looks at daemon lanes in supervision states → only the daemon records a lane → the one-shot path never records one. The fix therefore belongs at the one-shot acquisition point and its read rule, not at the resume call site.
- **Paved road / KISS:** Reuse the delivered per-ref prefix-scoped read pattern, the append-only ledger, the delivered evidence-reference budget, and the delivered resume-mode vocabulary (`attach-continue`, `resume-prompt-reentry`). Add one kind with two write points and one read rule.

## Alternatives Considered

### Per-Alternative Constraint-Compliance Evaluation

Legend: ✅ passes · ❌ fails. Every constraint is `negotiable: no`, so no accepted-risk exception exists and no driver score rescues a failing option.

| | C-1 written at acquisition | C-2 dispatch-owned, daemon untouched | C-3 attempt shape unchanged | C-4 identifiers only | C-5 no key, no migration | C-6 honest append failure |
|---|:---:|:---:|:---:|:---:|:---:|:---:|
| ALT-0 no lane (status quo) | ❌ | ✅ | ✅ | ✅ | ✅ | ✅ |
| ALT-1 extend `daemon.lane` with a one-shot state | ✅ | ❌ | ✅ | ✅ | ❌ (state vocabulary change) | ✅ |
| ALT-2 write the session identity onto the attempt record at acquisition | ✅ | ✅ | ❌ | ✅ | ✅ | ✅ |
| ALT-3 a mutable `dispatch.lane` singleton rewritten in place | ✅ | ✅ | ✅ | ✅ | ❌ (in-place rewrite) | ✅ |
| ALT-4 selected: distinct append-only `dispatch.lane` | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ |

### Alternative 0 — Do Nothing: Keep the Attempt Record as the Only Trace

- **Eligibility:** Not eligible (fails C-1).
- **Summary:** Ship no lane. `--resume-prompt` keeps reading only daemon lanes, so a one-shot attempt stays invisible.
- **Constraint compliance:** Passes C-2…C-6 trivially (nothing is added). Fails C-1: no record exists at acquisition, so the capability F-1 names cannot be satisfied by any implementation.
- **Driver fit:** Fails drivers 1 and 5 outright; serves only driver 6.
- **Pros:** Zero change; no new kind.
- **Cons:** The parity gap that blocks shell retirement persists; every crashed dispatch is unrecoverable; the resume flag remains a flag that usually does nothing.
- **Why rejected:** It is the absence of the deliverable.

### Alternative 1 — Extend `daemon.lane` with a One-Shot State

- **Eligibility:** Not eligible (fails C-2, C-5).
- **Summary:** Keep one lane kind and add a state such as `one-shot-active`, writing it from the dispatch path; let the existing daemon read path see it.
- **Constraint compliance:** Passes C-1, C-3, C-4, C-6. Fails C-2: it changes `daemon.lane`'s state vocabulary and makes a one-shot lane visible to daemon reconciliation, so the daemon family would either need to learn the new state or would mis-classify the record — two owners on one record. Fails C-5: the five-state vocabulary is a delivered pin, so widening it is a vocabulary change with a migration question for pre-change records.
- **Driver fit:** Fails drivers 2 and 3, which are the reason the question was routed.
- **Pros:** One kind; one read path; the resume resolver already reads it.
- **Cons:** A one-shot lane looks adoptable; `delivering`/`completed` acquire a second meaning; reconciliation must be taught to skip a state it does not own; the rollback asymmetry is no longer harmless.
- **Why rejected:** It buys one fewer declaration by spending ownership and the state vocabulary — the two properties the binding PM decision exists to protect.

### Alternative 2 — Write the Session Identity onto the Attempt Record at Acquisition

- **Eligibility:** Not eligible (fails C-3).
- **Summary:** Append an attempt record when the session is acquired and update it at classification; the attempt record becomes both lane and report.
- **Constraint compliance:** Passes C-1, C-2, C-4, C-5, C-6. Fails C-3: the attempt record's `token` is required and its contract is one immutable classified report; an acquisition-time attempt would either need a nullable token (a delivered-field change) or two records per attempt (breaking NFR-4's attempt cardinality and the attempt read side's identity).
- **Driver fit:** Serves driver 1 and driver 6; fails drivers 2 and 4 by giving one record two lifecycles and two meanings.
- **Pros:** No new kind; the resume fact sits beside the attempt facts.
- **Cons:** Every attempt consumer would have to distinguish "open" from "classified" records; the record's identity would become ambiguous; the evidence-reference budget would be shared between lane and attempt facts.
- **Why rejected:** A report that is also a mutable lane is two records with one name.

### Alternative 3 — A Mutable `dispatch.lane` Singleton Rewritten in Place

- **Eligibility:** Not eligible (fails C-5).
- **Summary:** One dispatch-owned record per ref, rewritten at each transition, so the store holds exactly one lane object per ref.
- **Constraint compliance:** Passes C-1, C-2, C-3, C-4, C-6. Fails C-5: the store is append-only and no delivered path rewrites a persisted record, so this is a new mutation capability plus a migration question for abandoned writes.
- **Driver fit:** Serves drivers 1, 2, 4 (partially), 5; fails driver 4's append-only discipline.
- **Pros:** The read is trivially "the record"; no fold.
- **Cons:** A crash mid-rewrite can leave a torn lane; the append-only invariant and every rollback guarantee it buys are spent to avoid a latest-wins fold the store already supports.
- **Why rejected:** Latest-wins over an append-only prefix is the delivered pattern and costs one fold; a mutable singleton spends the invariant.

### Alternative 4 — Selected: A Distinct Append-Only `dispatch.lane`

- **Eligibility:** Eligible.
- **Summary:** One new kind, `dispatch.lane` / `delivery.dispatch.lane.v1` / `dispatch.lanes:<REF>`, dispatch-owned, with `active` and `terminal` states, appended at acquisition and at final classification, read latest-wins per ref, and never read or written by the daemon family.
- **Constraint compliance:** Passes C-1…C-6 (matrix above). Table stakes satisfied trivially.
- **Driver fit:** Best on every driver: written before the outcome exists (1), one owner (2), its own state vocabulary (3), additive and append-only (4), a disclosed append failure that cannot move the token (5), one kind and two write points (6).
- **Pros:** Resumability becomes a fact at the moment it is true; ownership is stated by kind; the resume read is one latest-wins fold; pre-change stores resolve "no lane" with no migration; the record is the natural read surface for GH-354.
- **Cons:** A new durable kind and its key-set pin; a dispatch that runs several iterations appends several records (bounded by the restart budget); owner pid/start time are advisory and must never become an exclusion authority.
- **Why chosen:** It is the only alternative that satisfies every `negotiable: no` constraint, and it is the shape the binding PM decision and the parity reference both point at.

## Decision

- **Decision:** Adopt **ALT-4**. A dispatch-owned, append-only, per-ref lane record is the resumable artifact; `daemon.lane` is untouched and never adopts it.

  1. **Record home and shape.** Kind `dispatch.lane`, payload schema `delivery.dispatch.lane.v1`, key `dispatch.lanes:<REF>`, identity field `ref`, append-only, latest record per ref is the lane. Fields: `schema`, `ref`, `repository` (normalized), `attemptId`, `sessionId`, `harnessKind`, `owner: { processId: positive integer, startedAt: ISO timestamp }`, `iterationOrdinal` (integer ≥ 1), `restartsConsumed` (integer ≥ 0), `state: "active" | "terminal"`, optional `lastToken` and `lastOutcome` (present **only** on a terminal record), `recordedAt`. (Spec §8.3 DM-1.)
  2. **Write points.** Exactly one `active` append when a fresh spawn or a resume yields a session handle, before any evidence is collected; exactly one `terminal` append carrying the final token and outcome when the dispatch reaches its final classification. A stalled iteration that is restarted appends no terminal record — only its `economics.restart` and the next iteration's `active` record (TDR-0052). A pre-session refusal appends no lane record.
  3. **Read shape and resume eligibility.** "The lane for a ref" is the newest record for that ref that carries a session identity, drawn from the dispatch lane and from a daemon lane in `delivering`/`detached`/`preempted`; newest wins when both exist. A recorded dispatch lane is resumable **regardless of the token it recorded**: a `pr-open` or `pr-open-unverified` attempt attaches and continues rather than re-dispatching, because the harness session survives the process. With no recorded lane, a fresh spawn is explicit and recorded as fresh. The completed-phase position a resume continues from is read from the phase ledger — the ledger's remaining role after the derivation ruling ([TDR-0053](TDR-0053-total-derivation-ladder-and-corroboration.md) DC-4) — never from the lane. A recorded lane is never silently replaced by a fresh spawn: an unknown-session refusal is a classified failure with exactly one attempt record. (Spec DEC-3, resolved here because it is this record's read rule; the budget half of DEC-3 is TDR-0052's.)
  4. **Ownership.** The kind is dispatch-owned: the daemon family never reads it as a supervised lane, never adopts it in reconciliation, and never rewrites it; the dispatch family never writes a `daemon.lane`. `daemon.lane`'s kind, schema, five states, and reconciliation ownership are unchanged.
  5. **Honest failure.** A lane append that cannot be persisted does not change the delivery token — the attempt record remains the authoritative outcome — and is disclosed as a bounded `lane:append-failed` evidence reference so resumability is never silently claimed.
  6. **Owner facts are advisory.** The owner process id and start time exist for staleness inspection and operator evidence; the queue lease remains the exclusion mechanism (TDR-0050). No path derives admission or exclusion from the lane.

### Constraint Compliance Attestation

ALT-4 satisfies C-1 through C-6. C-1: the active append is bound to session acquisition and no pre-session path appends. C-2: the kind, schema, and state vocabulary are distinct, and the daemon read path is kind/schema/prefix-scoped so it cannot see the record. C-3: the attempt record's fields, required `token`, and schema are unchanged; the lane is not carried on it. C-4: the field list is identifiers, counts, and timestamps; the append-failure disclosure is identifier-only and inside the 16-reference budget. C-5: no key, no rewrite, no version bump; an empty store resolves "no lane". C-6: the token is untouched by a failed append and the failure is disclosed. No accepted-risk exception is claimed.

## Trade-offs & Consequences

### Positive Outcomes

- Resumability exists at the moment it is true, which is the only moment it can be relied on after a crash.
- Write ownership is stated by kind, so "the daemon does not reconcile this" is a fact a reader can check rather than a convention.
- The read is one latest-wins fold over a per-ref prefix, reusing the delivered store pattern; no migration and no fabricated lane for pre-change state.
- The record is the natural read surface for GH-354's deferred `status`/`log` work, and it makes the resume mode and restart count inspectable without reading attempt history.
- An append failure is visible as evidence instead of becoming a silent loss of resumability.

### Negative Outcomes

- A new durable kind, with its own key-set pin and payload-allowlist obligations; every future field is a declared contract change.
- A single dispatch that runs several iterations appends several lane records (bounded by `lane.restart-budget`), so "one record per dispatch" is false for the lane while it stays true for the attempt and economics families.
- Owner process facts are recorded but never authoritative, which invites a future reader to over-trust them; the record states their advisory status explicitly.
- The resume resolver now spans two owners' records, so a change to either read path can change resume behaviour; the newest-wins rule and the daemon's unchanged filter are the only coupling.

### Unresolved Questions

- [ ] Does GH-354 need the phase-ledger position on the lane, or is reading the ledger at resume sufficient? (owner: `@pm` at GH-354 intake)
- [ ] Should a future shared resolver serve both one-shot and daemon lanes, and if so which owner is the driver? (owner: `@decision-advisor` if the daemon ever resumes a one-shot session)
- [ ] Does an operator need lane history (all records for a ref) rather than the latest? (owner: `@pm`; today the latest record is the lane by declaration)

## Implementation Plan

1. **Contract.** Declare the kind, payload schema, prefix, state vocabulary (`active | terminal`), and the record type beside the existing dispatch record declarations, with the key-set pin and payload allowlist updated in the same commit. Add no field to `DispatchAttemptRecord`.
2. **Write path.** Append the active record at the spawn/resume acquisition seam in the one-shot engine; append the terminal record where the attempt record is written; append nothing on a pre-session refusal. A restarted stalled iteration appends its own active record and no terminal record.
3. **Read path.** Implement the latest-wins per-ref read over the dispatch prefix, and compose it with the delivered daemon-lane read under the newest-wins rule; carry the resume mode from the adapter's declared capability.
4. **Disclosure.** Map a failed lane append to the bounded `lane:append-failed` evidence reference, inside the delivered 16-reference budget, and prove the token and exit are unchanged.
5. **Conformance.** Extend the dispatch conformance fixtures: a seeded lane resumes a `pr-open` attempt; an empty store resolves "no lane"; an injected append failure keeps the token and discloses; a seeded daemon lane is not read as a dispatch lane and vice versa.
6. **Documentation.** State the record, its owner, its write points, and the resume rule on the dispatch-engine and resident-daemon pages, and replace the pages' "no per-ref lane" statements in the documentation phase.

## Verification Criteria

- An admitted fresh dispatch that acquires a session appends exactly one `active` record with the session identity, normalized repository, attempt identity, harness kind, owner pid and start time, iteration ordinal 1, and restart count 0; a pre-session refusal on each declared arm appends zero lane records.
- A dispatch that reaches classification appends exactly one `terminal` record carrying the final token and outcome; the latest record for the ref is the lane; a restarted stalled iteration appends no terminal record.
- `--resume-prompt` over a recorded `pr-open` lane resumes the recorded session with the adapter's declared resume mode and starts zero fresh spawns; an unknown session is a classified failure with exactly one attempt record and no fresh spawn.
- An injected lane-append failure: token, exit, and attempt count identical to the success path, with `lane:append-failed` present and the evidence list within 16 references.
- A seeded `daemon.lane` produces no dispatch-lane read; a seeded `dispatch.lane` produces no daemon reconciliation lane and no daemon lane in `daemon status`; the daemon suite passes with no assertion change.
- Pre-change store: zero lane records, "no lane" resolution, attempt records and daemon lanes read unchanged; the configuration key set is unchanged.

## Confidence Rating

**High.** Every load-bearing fact is repo-local and read directly: the attempt record's required token and single append path, `sessionIds` being classification-time data, the daemon lane's kind/schema/prefix and five states, the kind-scoped daemon read, the daemon-lane-only resume filter, the append-only store with a monotonic sequence, the 16-reference evidence budget, and the shell's acquisition-time session mapping. The residual uncertainty is external — whether a harness session always survives its process — and it is bounded by the decision's own answer: a resume failure is a classified failure, never a silent fresh spawn, so the failure stays visible.

## References

- Change: `doc/changes/2026-11/2026-11-18--GH-347--dispatch-core-parity/chg-GH-347-spec.md` — §5.1 F-1, §6 Flow 1/Flow 3, §8.3 DM-1/DM-2, §8.5, §12, §17.1, §20, §25.1 Appendix A, §25.3 Appendix C, §25.6 Appendix F(D/E), and §15 DEC-2/DEC-3.
- Prior decisions: TDR-0004 (append-only state storage); TDR-0023 (daemon lifecycle mount and record kinds); TDR-0024 (attempt read side and record-bounded projections); TDR-0026 (queue lifecycle and admission); [TDR-0050](TDR-0050-dispatch-atomic-admission-verdicts.md) (admission); [TDR-0052](TDR-0052-in-process-bounded-restart-loop.md) (restart accounting).
- Specs: `doc/spec/features/feature-dispatch-engine.md`; `feature-resident-daemon.md` §Lane supervision; `feature-session-lifecycle-economics.md`; `feature-dispatch-attempts` read side as described by TDR-0024.
- Contracts and code (read 2026-11-18): `packages/core/src/contracts/daemon.ts`; `packages/core/src/contracts/dispatch.ts`; `packages/core/src/contracts/state.ts`; `packages/core/src/app/daemon.ts`; `packages/core/src/app/dispatch.ts`; `packages/cli/src/production.ts`.
- Parity reference (read 2026-11-18): `scripts/deliver-ticket.sh` (session mapping write/read, restart count).
