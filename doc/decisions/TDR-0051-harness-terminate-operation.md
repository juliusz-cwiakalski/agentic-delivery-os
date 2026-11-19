---
id: TDR-0051
decision_type: tdr
status: Proposed
created: 2026-11-18
decision_date: null
last_updated: 2026-11-19
summary: "`terminate` joins the closed harness operation set as an optional, capability-gated port member: given a session handle and a grace, it signals the session's process tree with TERM first and escalates to KILL only after the grace, then reaps an escaped runtime matched only by this lane's session identity or its deterministic `ticket-<REF>` title, is idempotent, reports `terminated`/`escalated`/`reaped`, and refuses no new identity — the grace is the delivered `coordinator.kill-grace` (20 000 ms default) reused rather than duplicated, a terminate-capable adapter declares the operation, and an adapter that declares no capability is never asked and never causes a second session to start."
owners:
  - "Juliusz Ćwiąkalski"
service: "delivery-os harness plane (session port operation set, capability declaration, process termination)"
decision_scope: repo
review_date: null
customer_impact: "A stalled dispatch on a terminate-capable adapter is terminated inside a bounded grace instead of leaving a live session behind, and a second session is never started beside one that could not be confirmed dead."
classification:
  domains: [architecture, contracts, security, operations]
  archetype: design
  environment: complicated
  rigor: R2
  reversibility: moderate
  stakes: high
  urgency: high
  uncertainty: medium
  blast_radius: team
  recurrence: recurring
governance:
  driver: "@decision-advisor (GH-347: the specification routes the terminate contract as DEC-4 and gap 6; the record is authored before dependent delivery)"
  decider: "Juliusz Ćwiąkalski — human acceptance at the GH-347 PR review; AI does not accept this R2 record"
  contributors:
    - "@spec-writer (chg-GH-347-spec §5.1 F-5, §8.1 API-5, §8.3 DM-5, §17.5 AC-F5-1…AC-F5-5, DEC-4, NFR-6)"
    - "@decision-advisor (repository analysis, the shell kill reference, and this record)"
  reviewers:
    - "@readiness-reviewer"
    - "@reviewer"
    - "Human owner (GH-347 PR review — this record adds a signalling capability and fixes its safety boundary)"
  performers:
    - "@coder (GH-347: the operation-set addition, the capability declaration, the process-tree signal path, the exact-identity reap, idempotence, the attempt evidence references)"
    - "@doc-syncer (GH-347 documentation phase: harness-adapters, dispatch-engine, and session-lifecycle-economics pages, replacing the two stale no-kill statements)"
  informed:
    - "Every harness adapter author (the operation is optional; absence is a declared gap)"
    - "The coordinator supervision owner (a generic process-tree termination seam is deferred; this record does not create one)"
    - "Operators relying on repository-exclusive leases (termination does not release a lease)"
ai_assistance:
  used: true
  roles: [repository-analyst, analyst, record-writer]
  external_data_shared: false
  citations_verified: true
  human_decider: null
  reviewers: []
revisit_triggers:
  - "A shared process-tree termination seam with coordinator supervision is wanted (the deferred item): that is a cross-plane decision with its own safety argument, and it supersedes this record's adapter-local reap rather than widening it."
  - "A harness adapter declares terminate but its runtime cannot express a process tree (for example a remote or containerised session): the capability declaration must then split 'can terminate' from 'can signal a tree', and the no-second-session rule is restated for the weaker capability."
  - "The exact-identity reap matches nothing while a session is alive (a renamed or wrapper-launched runtime): the identity rule is re-decided against the observed argv, and the fallback is never a broad process pattern."
  - "The grace value diverges from `coordinator.kill-grace` (an operator sets one and not the other): the reuse is re-decided as two keys with one meaning or one key with two consumers, never as two silently different graces."
  - "Termination is proposed to release the lane's lease: releasing is an admission/accounting act (TDR-0050, TDR-0026), and coupling it to a signal would make a kill mutate exclusion."
links:
  related_changes: ["GH-347"]
  supersedes: []
  superseded_by: []
  spec:
    - "doc/changes/2026-11/2026-11-18--GH-347--dispatch-core-parity/chg-GH-347-spec.md"
    - "doc/spec/features/feature-harness-adapters.md"
    - "doc/spec/features/feature-dispatch-engine.md"
    - "doc/spec/features/feature-session-lifecycle-economics.md"
  contracts:
    - "packages/core/src/contracts/harness.ts"
    - "packages/core/src/contracts/coordinator.ts"
    - "packages/core/src/contracts/error-table.ts"
    - "packages/core/src/config/defaults.ts"
    - "packages/adapters/src/host/index.ts"
    - "packages/adapters/src/daemon/process.ts"
    - "packages/cli/src/commands/coordinator-loop.ts"
    - "scripts/deliver-ticket.sh"
  diagrams: []
  decisions: ["ADR-0008", "TDR-0016", "TDR-0017", "TDR-0043", "TDR-0052"]
  experiments: []
  metrics: []
  roadmap_items: ["M4-S9"]
---

# TDR-0051: Harness `terminate` Operation

> **Traceability.** Spec §15 **DEC-4**; §5.1 F-5; §8.1 API-5; §8.3 DM-5; §8.5 "a stalled session on a terminate-capable adapter is terminated instead of left running"; §17.5 AC-F5-1…AC-F5-5; §22 "Termination is a privilege boundary"; NFR-6; §25.3 Appendix C(3); §25.6 Appendix F(D); §15.1 maps DEC-4 to this record. Consumed by [TDR-0052](TDR-0052-in-process-bounded-restart-loop.md).

## Context

The typed engine can start a session, watch it, and collect from it — but it cannot stop one. A stalled session is therefore recorded and left running, and the engine's only honest move is to start nothing else.

- **FACT:** The closed operation vocabulary has exactly six entries — `spawn`, `deliver`, `resume`, `steer`, `collect`, `session-list` — and no `terminate` (`packages/core/src/contracts/harness.ts:32-40`). *(read 2026-11-18)*
- **FACT:** `HarnessSessionPort` declares exactly `spawn`, `deliver`, `resume`, `collect`, `classify`, `liveness`, `listSessions`; no member signals a process (`harness.ts:469-481`). *(read 2026-11-18)*
- **FACT:** Capability declarations are authoritative and closed: `supportedOperations`, `lifecycleCapabilities`, `livenessSources`, and `declaredGaps`; anything unlisted is unsupported and must also appear in `declaredGaps` with a closed reason (`harness.ts:68-94`). `harness.capability.gap` is an existing failure identity (`harness.ts:319-328`). *(read 2026-11-18)*
- **FACT:** The streaming spawn starter already owns an idempotent `kill`: the first call sends `SIGTERM`, a second call is a no-op, and escalation to `SIGKILL` happens after a **fixed 100 ms** constant (`packages/adapters/src/host/index.ts:23,192-206`). It signals the direct child only and reaps nothing. *(read 2026-11-18)*
- **FACT:** The shell lane kills a process tree with the pattern `kill -TERM -- -<pid>` (group) then `kill -KILL -- -<pid>` only after `KILL_GRACE_SECONDS`, default 20 (`scripts/deliver-ticket.sh:65,1226-1249`), and then reaps a runtime that `setsid`/fork moved into its own session by matching **only** this delivery's session id or its `ticket-<REF>` title, idempotently, with a TERM then KILL escalation of its own (`:1251-1288`). *(read 2026-11-18)*
- **FACT:** `coordinator.kill-grace` defaults to 20 000 ms and is consumed by the coordinator loop's process lifecycle and by the daemon process seam (`packages/core/src/config/defaults.ts:84`; `packages/cli/src/commands/coordinator-loop.ts:1147`; `packages/adapters/src/daemon/process.ts:97`). There is no dispatch-lane kill-grace key. *(read 2026-11-18)*
- **FACT:** Two current-truth pages state that the delivered session port exposes no kill operation, and describe leaving a below-budget stall to supervision because of it (`doc/spec/features/feature-dispatch-engine.md:65`; `doc/spec/features/feature-session-lifecycle-economics.md:93,185`). *(read 2026-11-18)*
- **FACT:** Ordering is available: the engine invokes `collect` and holds a session handle, and the streaming starter is injected into the adapter the engine already composes, so a terminate implementation has a call site that is not a new process seam. *(read 2026-11-18)*
- **Why now:** The restart loop (TDR-0052) must not start a second session beside a session that might still be alive. Without a termination capability the loop's only safe behaviour is to stop, so this operation is what makes an in-process restart defensible at all — and the shell has had it, with an exact-identity reap, since the orphan-runtime defect.

## Problem Framing (Clarified)

"Add a kill operation" hides four decisions, and the wrong answer to any of them turns a safety feature into a hazard:

1. **Where does the capability live?** A port operation (so the engine can reach it), a re-used starter seam (which the engine cannot reach and which signals one process), or a new top-level command? The answer decides whether adapters must declare it and whether absence is a declared gap.
2. **What is signalled, and in what order?** A direct child, a process group, or a process tree; TERM then KILL, or KILL directly; and inside what grace.
3. **What may an escaped runtime be matched by?** The delivered starter's child handle cannot reach a runtime that `setsid` moved into its own session; the only safe reach is by identity this delivery already owns — its session id or its deterministic title.
4. **What happens with no capability, and what does a completed termination report?**

Root cause versus symptom: the symptom is "a stalled session leaks". The cause is that the session port models *starting and observing* and never modelled *ending*, so the only holder of a kill is a lower seam with a different contract and no identity safety. And the delivered seam's 100 ms escalation is tuned for a bounded probe, not for a delivery runtime: it is four orders of magnitude away from the 20 s the shell grants a harness to exit.

Deliberately out of scope: no generic process-tree termination seam shared with coordinator supervision (spec §7.3 defers it); no new failure identity — a capability gap uses the delivered `harness.capability.gap`; no change to any existing operation's name or meaning; no lease release on termination; no live OS-level signal-delivery claim beyond what the parity battery proves (Appendix C does not prove it); no operator command for termination.

## Constraints (Hard Requirements)

### C-1: The operation set grows by exactly one additive, optional, declared member

- **Statement:** `terminate` is added to `HARNESS_OPERATIONS` and to the session port as an **optional** member, so a port double without it stays valid; a terminate-capable adapter declares it in `supportedOperations` and implements it; an adapter without it declares the gap with a closed reason. No existing operation is removed, renamed, or re-meant.
- **Source:** AC (§8.1 API-5; §8.3 DM-5; AC-F5-5; NFR-3; RSK-8)
- **Verification:** test (the operation inventory grows by one; a port double without `terminate` satisfies the port type and is never asked; an adapter declaring a gap is not called) + code review
- **Negotiable:** no

### C-2: Signalling is TERM first, KILL only after the declared grace, over the session's process tree

- **Statement:** Termination sends the terminal signal to the session's process tree first and escalates to the kill signal only after the declared grace elapses, so a runtime that exits promptly is never killed outright and a runtime that ignores TERM is still bounded.
- **Source:** AC (AC-F5-1, AC-F5-5; NFR-6; §22)
- **Verification:** test (over an injected streaming starter: TERM observed before any KILL, KILL only after the grace; a prompt exit produces no KILL) + code review
- **Negotiable:** no

### C-3: The escaped-runtime reap matches this lane's exact identity only

- **Statement:** An escaped runtime is matched only by this lane's recorded session identity or its deterministic `ticket-<REF>` title — never by a broad process-name or substring pattern, and never by another delivery's identifiers; the operation reports exactly what it did.
- **Source:** AC (AC-F5-5; NFR-6 "0 unrelated processes signalled"; RSK-2; §22)
- **Verification:** test (identity-selection assertion: a matching-argv fixture is selected, a near-miss fixture — another ref, another session, a similar title — is not) + code review
- **Negotiable:** no

### C-4: The operation is idempotent, and terminating an unknown or exited session is success

- **Statement:** A second terminate on the same session performs no further signalling and reports the same terminal facts; a session that already exited or is unknown is success with `terminated: true`, not an error; no path turns "already gone" into a failure identity.
- **Source:** AC (AC-F5-5; §5.1 F-5 "terminate is idempotent where the session is already gone")
- **Verification:** test (second call: no signal emitted, same reported booleans; unknown handle: success) + code review
- **Negotiable:** no

### C-5: No new failure identity and no new configuration key

- **Statement:** A missing capability is disclosed through the delivered `harness.capability.gap` identity (or the adapter's declared gap) and never as a new code, row, or domain kind; the grace is the delivered `coordinator.kill-grace` value, so no key is added and no second grace is introduced.
- **Source:** AC (§8.3 DM-5; NG-4; NFR-3; NFR-11; §8.5; §22 "No second error system")
- **Verification:** test (error-row inventory equality; config key-set equality; the grace value equals the resolved `coordinator.kill-grace`) + code review
- **Negotiable:** no

### C-6: Termination is a precondition of a restart, not a substitute for the stall verdict

- **Statement:** A stall remains a two-consecutive-sourced-no-advance verdict taken by the liveness evaluator, and a clean exit is never a stall; terminate is invoked only when a stall is still current at collection, and on an adapter that declares no capability the engine starts no second session.
- **Source:** AC (AC-F5-2, AC-F5-4; §5.1 F-5; RSK-3)
- **Verification:** test (clean exit and cleared stall: zero terminate invocations; non-capable adapter: zero second sessions and a returned member of the terminal pre-restart verdict set or `state-unverified`) + code review
- **Negotiable:** no

**Table stakes.** Every alternative below keeps the delivered liveness evaluator, the delivered session handle, the delivered `harness.capability.gap` identity, and the delivered evidence-reference budget; none of those eliminates an alternative.

## Decision Drivers

1. **No second session beside a possibly-live first.** The loop's safety rests on confirming death, which requires a capability the engine can reach.
2. **A privilege boundary must be narrow.** Signalling processes is the most dangerous capability this system can hold; the narrower the identity match, the smaller the blast radius. A broad pattern would make one delivery capable of killing another.
3. **Bounded, not abrupt.** A runtime needs time to flush, close a session, and release a database lock; a 100 ms escalation is a probe budget, not a delivery budget. The shell's 20 s is the observed working value.
4. **Capability honesty.** An adapter that cannot terminate must say so, and the engine must behave differently rather than pretending.
5. **Additive contract evolution.** One optional operation, one declaration, one inventory line, no removed member, no new identity.
6. **Solo-maintainer cost and the paved road.** Reuse the delivered streaming starter as the signal path, the delivered capability model as the gate, and the delivered grace value as the bound.

## Decision Rights (DACI)

- **Driver:** `@decision-advisor` — GH-347 routes the terminate contract here as spec DEC-4 (ticket gap 6), and this record fixes a capability every adapter publisher must answer.
- **Decider / Approver:** Juliusz Ćwiąkalski at the GH-347 PR review. AI does not accept this R2 record.
- **Contributors:** `@spec-writer` (F-5, API-5, DM-5, AC-F5-x, NFR-6, DEC-4), `@decision-advisor` (shell kill reference, adapter and config observation, this record).
- **Required reviewers:** `@readiness-reviewer`, `@reviewer`, and the human owner (the capability is a privilege boundary).
- **Performers:** `@coder` (operation set, port member, capability declaration, signal path, exact-identity reap, idempotence, evidence references); `@doc-syncer` (harness-adapters, dispatch-engine, session-lifecycle-economics pages).
- **Informed:** every harness adapter author; the coordinator supervision owner; operators relying on repository exclusivity.

**Type note.** TDR. ADR-0008 fixed the harness adapter contract as a surface-mapped, capability-declaring port, and TDR-0016 added the streaming seam; the architecture-level question ("is the session port the harness abstraction?") is decided and is not reopened. This record fixes one operation inside that contract, so the narrower type is the paved road. It is R2, not R1, because it adds a signalling capability with a safety boundary, changes a closed inventory, and gates the loop that depends on it. It is not R3: the facts are repo-local, the battery proves the contract offline, and the change is reversible by removing the optional member — but the safety boundary is treated with R3 seriousness in C-3.

## Evidence, Assumptions & Unknowns

| Item | Label | Source | Impact if false | Confidence |
|---|---|---|---|---|
| The operation vocabulary is closed at six entries and has no `terminate`. | FACT | `packages/core/src/contracts/harness.ts:32-40` (read 2026-11-18) | If it existed, only the port member and the engine call site would be missing. | High |
| The session port declares no signalling member. | FACT | `harness.ts:469-481` (read 2026-11-18) | If it did, the engine's inability to kill would be a wiring bug rather than a contract gap. | High |
| Capability declarations are closed and every unsupported capability must be declared as a gap with a closed reason. | FACT | `harness.ts:68-94`; `harness.capability.gap` at `harness.ts:319-328` (read 2026-11-18) | C-1's "optional member + declared gap" model would need a different gate. | High |
| The delivered streaming starter's `kill` is idempotent, sends SIGTERM then SIGKILL after a fixed 100 ms, and signals the direct child only. | FACT | `packages/adapters/src/host/index.ts:23,192-206` (read 2026-11-18) | Reaching the starter directly would be closer to a real solution than it is. | High |
| The shell sends TERM to the process group, waits 20 s by default, then KILLs, and reaps an escaped runtime by session id or `ticket-<REF>` title only. | FACT | `scripts/deliver-ticket.sh:65,1226-1288` (read 2026-11-18) | The parity reference for grace and identity would not exist this concretely. | High |
| `coordinator.kill-grace` defaults to 20 000 ms and is consumed by the coordinator loop and daemon process seam. | FACT | `packages/core/src/config/defaults.ts:84`; `packages/cli/src/commands/coordinator-loop.ts:1147`; `packages/adapters/src/daemon/process.ts:97` (read 2026-11-18) | Reuse would be unjustified and a new key would be needed, which NFR-11 forbids. | High |
| Two current-truth pages state the port exposes no kill operation. | FACT | `doc/spec/features/feature-dispatch-engine.md:65`; `feature-session-lifecycle-economics.md:93,185` (read 2026-11-18) | The documentation-phase work in Appendix A would be unnecessary. | High |
| The engine already holds a session handle and composes an adapter over an injected streaming starter, so a terminate implementation has a reachable call site. | FACT | `contracts/harness.ts:422-439` (`HarnessSpawnStarter`); adapter composition in `packages/cli/src/production.ts` (read 2026-11-18) | A new process seam would be required, and this record's cost estimate would be wrong. | High |
| Process-tree signalling semantics (`kill -TERM -- -pid`) are POSIX-shaped, and the battery proves selection and ordering, not kernel delivery. | ASSUMPTION | Shell implementation; spec Appendix C(3) explicitly excludes OS-level delivery from the proof boundary | A platform without process groups would need a different tree traversal; the capability declaration is the place that must say so. | Medium |
| A harness session's runtime can escape the direct child's process group (the observed orphan defect the shell's reaper exists for). | ASSUMPTION | `scripts/deliver-ticket.sh:1251-1257` defect note; the delivered starter signals only the direct child | Without escape, exact-identity reaping would be dead code — harmless, but the identity rule would be untested in production. | Medium-High |
| Whether the Claude Code adapter can ever terminate a session in the supported mode. | TO-CONFIRM | Spec §16 lists the Claude Code adapter as declaring the terminate gap and remaining a blocking one-shot spawn | If it later gains a capability, it declares `terminate` and implements the same contract; the decision does not change. (owner: `@spec-writer` per adapter delivery) | Medium |

## Mental Models & Techniques Used

- **First principles:** What must be true to safely restart after a stall? (i) the engine can ask for termination, (ii) it can tell what was signalled, (iii) it knows when the deadline passed, (iv) it cannot signal something it does not own, (v) it can report the outcome. The operation shape falls out of (i)–(v) without inventing anything.
- **Inversion:** What makes a kill feature worse than no kill feature? A broad pattern that kills a sibling delivery; an immediate KILL that corrupts a harness database and stalls later iterations; a second call that signals again; an "unsupported" adapter that is silently asked anyway; a failure identity for "the process was already gone". C-2, C-3, C-4, C-5 close exactly these, and each is drawn from an observed failure in the shell's own history (the orphan-runtime defect note).
- **Second-order thinking:** Declaring the operation optional changes what "adapter parity" means: an adapter is not deficient for lacking terminate, it is *declared incapable*, and the engine's behaviour on that path (no second session) becomes a contract rather than a hope. That is also what keeps the Claude Code adapter shippable.
- **Systems thinking:** terminate sits between the liveness evaluator (which decides "stalled"), the loop (which decides "restart"), and the durable records (which carry the verdict and the termination result). If terminate signalled on its own judgement, the stall verdict would have two authors; if the loop restarted without it, the lease would protect nothing. C-6 pins the order.
- **Opportunity cost:** Reaching the starter directly saves a port member and costs identity safety, a configurable grace, and a reachable call site — the three things that make the operation usable at all. A generic seam shared with the coordinator saves duplication and costs a cross-plane safety argument this change cannot make.
- **Paved road / KISS:** One optional member, one declaration, one signal path through the already-injected starter, one identity predicate, one reused grace value.

## Alternatives Considered

### Per-Alternative Constraint-Compliance Evaluation

Legend: ✅ passes · ❌ fails. Every constraint is `negotiable: no`, so no accepted-risk exception exists and no driver score rescues a failing option.

| | C-1 additive optional declared | C-2 TERM→KILL within grace | C-3 exact identity only | C-4 idempotent, gone = success | C-5 no new identity/key | C-6 terminate precedes a restart |
|---|:---:|:---:|:---:|:---:|:---:|:---:|
| ALT-0 keep supervision as the only killer | ❌ | ✅ | ✅ | ✅ | ✅ | ❌ |
| ALT-1 let the engine call the starter's `kill` directly | ✅ (no contract at all) | ❌ (fixed 100 ms, direct child) | ❌ (no reap, no identity) | ✅ | ✅ | ❌ (no reported confirmation to gate on) |
| ALT-2 new port member plus a new `dispatch.kill-grace` key | ✅ | ✅ | ✅ | ✅ | ❌ | ✅ |
| ALT-3 broad process-pattern kill owned by the dispatch plane | ✅ | ✅ | ❌ | ❌ | ✅ | ✅ |
| ALT-4 selected: optional capability-gated port member, reused grace, exact-identity reap | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ |

### Alternative 0 — Do Nothing: Leave Termination to Supervision

- **Eligibility:** Not eligible (fails C-1, C-6).
- **Summary:** Keep the port as it is; a stalled one-shot session is recorded as evidence and left to whoever supervises the machine.
- **Constraint compliance:** Passes C-2…C-5 vacuously. Fails C-1 (no capability exists) and C-6 (the engine cannot confirm death, so it can never restart and the "no second session" rule is enforced by not looping at all).
- **Driver fit:** Fails drivers 1, 2 (no boundary to narrow), and 3; serves only driver 6.
- **Pros:** Zero change; the two current-truth pages stay true.
- **Cons:** Leaked sessions, DB contention observed by the shell's own reaper, and an in-process loop that is impossible to build safely.
- **Why rejected:** It is the gap, and it is the reason the loop cannot exist.

### Alternative 1 — Let the Engine Call the Streaming Starter's `kill` Directly

- **Eligibility:** Not eligible (fails C-2, C-3).
- **Summary:** Expose the starter's existing idempotent `kill` to the engine instead of adding a port member.
- **Constraint compliance:** Passes C-1 only by having no contract at all (nothing declares the capability, so an adapter without a starter cannot be interrogated), C-4, C-5. Fails C-2: the delivered escalation is a fixed 100 ms — far below the 20 s the shell grants — and signals the direct child rather than a tree. Fails C-3: it reaps nothing, so an escaped runtime survives. C-6 is at risk because nothing reports what happened.
- **Driver fit:** Fails drivers 1, 2, 3; attractive only as the smallest diff.
- **Pros:** No new port member; no adapter work.
- **Cons:** The engine would hold a kill it cannot bound, cannot aim at the tree, and cannot report; the 100 ms escalation is tuned for a handle-acquisition probe and would kill a runtime mid-flush.
- **Why rejected:** It is a kill without a contract — the exact shape C-2 and C-3 exist to refuse.

### Alternative 2 — New Port Member Plus a New `dispatch.kill-grace` Key

- **Eligibility:** Not eligible (fails C-5).
- **Summary:** Add the operation as in ALT-4, but give the dispatch lane its own grace key so it can be tuned independently of the coordinator.
- **Constraint compliance:** Passes C-1…C-4 and C-6. Fails C-5: the change declares "0 new configuration keys" (NFR-11) and the value would duplicate a delivered key with the same meaning, which is precisely the two-keys-one-meaning problem the assumption rejects.
- **Driver fit:** Serves driver 3's intent (a delivery-appropriate grace) while failing driver 5.
- **Pros:** Independent tuning; no coupling to a coordinator setting.
- **Cons:** Two graces that an operator must keep aligned; a new key on a change whose non-goals forbid one; a default that would have to be argued from scratch.
- **Why rejected:** A second key with one meaning is a configuration defect waiting to be filed.

### Alternative 3 — Broad Process-Pattern Kill Owned by the Dispatch Plane

- **Eligibility:** Not eligible (fails C-3, C-4).
- **Summary:** Terminate by matching a process-name pattern (for example any `opencode run`) plus escalation, as a shell one-liner would.
- **Constraint compliance:** Passes C-1, C-2, C-5, C-6. Fails C-3: a broad pattern can signal another delivery, the CEO loop, or an unrelated operator session, and cannot report per-identity facts. Fails C-4 in practice: a second invocation would signal whatever currently matches, so "already gone" and "something else is there" become indistinguishable.
- **Driver fit:** Fails driver 2, the driver the whole safety boundary exists for.
- **Pros:** Simple, and it would catch escapees reliably.
- **Cons:** The blast radius is the machine; the shell's reaper exists specifically because this was refused (`scripts/deliver-ticket.sh:1251-1257` matches only this delivery's session id or title).
- **Why rejected:** A capability that can signal another delivery is not a capability this system may hold.

### Alternative 4 — Selected: Optional Capability-Gated Member, Reused Grace, Exact-Identity Reap

- **Eligibility:** Eligible.
- **Summary:** `terminate` joins the operation set as an optional port member; a capable adapter signals the session's process tree TERM first and KILL after the declared grace, then reaps an escaped runtime by this lane's session identity or `ticket-<REF>` title; it is idempotent, reports `terminated`/`escalated`/`reaped`, and an incapable adapter is never asked.
- **Constraint compliance:** Passes C-1…C-6 (matrix above). Table stakes satisfied.
- **Driver fit:** Best on every driver: a reachable capability (1), an identity-narrow boundary (2), a delivery-sized grace reused rather than invented (3), honest declarations (4), one additive operation (5), one signal path (6).
- **Pros:** Restart becomes defensible; the safety boundary is a single, testable predicate; the grace has one meaning system-wide; the Claude Code adapter remains shippable by declaring a gap; no identity or key is added.
- **Cons:** The operation is optional, so two adapter behaviours must both be honoured by the engine; the reap is a heuristic in the sense that it depends on the runtime's argv carrying the session id or the title; POSIX process-group semantics are assumed.
- **Why chosen:** It is the only alternative that satisfies every `negotiable: no` constraint, and it reuses the delivered starter, capability model, and grace.

## Decision

- **Decision:** Adopt **ALT-4**.

  1. **DC-1 — The capability is an optional, declared port member.** `terminate` joins `HARNESS_OPERATIONS`; the session port gains an optional `terminate(session handle, grace)` member whose absence, together with a declared gap, means unsupported. A terminate-capable adapter declares it in `supportedOperations` and implements it. No operation is removed, renamed, or re-meant. (Spec API-5, DM-5.)
  2. **DC-2 — Signal order and grace.** The operation sends the terminal signal to the session's process tree first and escalates to the kill signal only after the grace; the grace is the resolved `coordinator.kill-grace` (20 000 ms default), reused rather than duplicated because it is a signalling-grace constant with identical semantics and this change forbids adding a configuration key; a dedicated lane-owned termination-grace key is deferred (§7.3). The grace stays a positive integer. (Spec DEC-4; NFR-6; §7.3; §8.5.)
  3. **DC-3 — Exact-identity reap.** An escaped runtime is reaped only when it matches this lane's session identity or its deterministic `ticket-<REF>` title; the match is per-lane, never a broad pattern, and never another delivery's identifiers. The operation reports `terminated`, `escalated`, and `reaped` as booleans. (Spec AC-F5-5.)
  4. **DC-4 — Idempotence and honest absence.** A second terminate performs no further signalling and reports the same terminal facts; an already-exited or unknown session is success with `terminated: true`. A missing capability is disclosed through the delivered `harness.capability.gap` identity and never starts a second session; the engine resolves truth and returns a member of the **terminal pre-restart verdict set** if one exists (`merged` from a tracker-done work item, `blocked` from a blocking tracker state, `pr-open` from an open pull-request artifact — an artifact verdict, not a tracker fact), otherwise `state-unverified` at exit 2 with the stall evidence. The same short-circuit rule applies whether or not the adapter can terminate. (Spec §5.1 F-5, DM-4, DM-5, AC-F5-3, AC-F5-4.)
  5. **DC-5 — The engine decides, the operation executes.** The stall verdict remains the liveness evaluator's two-consecutive-no-advance finding; terminate is invoked only when that verdict is still current at collection, and the verdict plus the termination result are recorded as bounded attempt evidence (`liveness:<verdict>`, `terminate:terminated`/`terminate:escalated`/`terminate:reaped`) inside the delivered 16-reference budget. Termination never releases a lease and never appends a lane or attempt record of its own.

### Constraint Compliance Attestation

ALT-4 satisfies C-1 through C-6. C-1: one operation added, optional, declared, no removal or rename. C-2: TERM then KILL, escalation only after the declared grace, over the tree. C-3: the reap predicate is this lane's session identity or title only, and reports what it did. C-4: idempotent, and "already gone" is success. C-5: no new identity, no new key; the grace is the delivered `coordinator.kill-grace`. C-6: terminate executes a stall verdict the evaluator took, and an incapable adapter never causes a second session. No accepted-risk exception is claimed.

## Trade-offs & Consequences

### Positive Outcomes

- The loop can restart safely, because death can be confirmed before a new session starts.
- The safety boundary is one predicate with a named identity rule, which is testable by selection rather than by observing the kernel.
- The grace has one value system-wide, so a harness gets the same patience from the loop and the coordinator.
- An adapter that cannot terminate stays honest instead of silently misbehaving, and no new failure identity is added.
- The two stale "no kill operation" statements on the current-truth pages are retired with a contract to point at.

### Negative Outcomes

- The operation is optional, so the engine carries two paths (`capable` and `declared gap`) forever; a future adapter author can accidentally omit the declaration and be treated as incapable, which is safe but surprising.
- The reap depends on the runtime's argv carrying the session id or the deterministic title; a wrapper that changes the argv shape would make the reap match nothing, leaving the direct child termination as the only effective act.
- Process-group signalling is POSIX-shaped; the proof boundary excludes kernel delivery, so a platform difference is a deployment observation, not a battery failure.
- A 20 s grace means a stalled restart can take 20 s longer than an abrupt kill would; this is accepted because abrupt kills are what corrupt harness state.
- Termination and the loop's ordering introduce a new obligation on the engine: it must never restart without the confirmation, which is a control-flow invariant a reviewer must check (TDR-0052).

### Unresolved Questions

- [ ] Should a generic process-tree termination seam be shared with coordinator supervision? (owner: `@decision-advisor`; deferred by spec §7.3, and it needs a cross-plane safety argument)
- [ ] Does any supported harness launch its runtime through a wrapper that removes the session id and title from the argv? (owner: `@spec-writer` at the first live terminate observation)
- [ ] Is a 20 s grace the right value once real stalls are observed, or does it need a delivery-specific value that would justify revisiting the key reuse? (owner: `@pm` if operators report long restart latency)

## Implementation Plan

1. **Contract.** Add `terminate` to `HARNESS_OPERATIONS`; add the optional port member with its input (handle, grace in milliseconds) and its result (`terminated`, `escalated`, `reaped`); declare the capability in the adapter declarations and the `Claude Code` gap in the same phase.
2. **Adapter.** Implement termination over the already-injected streaming starter: signal the tree, escalate after the grace, then run the identity-scoped reap; keep the delivered 100 ms probe escalation untouched for the probe path and do not reuse it here.
3. **Engine.** Invoke terminate only on a current stall at collection, record the verdict and the result as bounded evidence, and gate every restart on the returned confirmation; on a declared gap, resolve truth and stop.
4. **Conformance.** Add the terminate cases over an injected starter: TERM before KILL, KILL only after the grace, prompt exit produces no KILL, idempotent second call, unknown session success, exact-identity selection with a near-miss control, and the non-capable adapter's no-second-session path.
5. **Documentation.** Add the operation, the declaration, the grace, and the identity rule to the harness-adapters page; replace the two "no kill operation" statements on the dispatch-engine and session-lifecycle-economics pages with this contract.

## Verification Criteria

- The operation inventory contains `terminate` exactly once; a port double without the member type-checks and is never invoked; an adapter declaring the gap is never asked and starts no second session.
- Over an injected streaming starter: TERM is observed before any KILL; KILL is observed only after the declared grace; a session that exits promptly produces no KILL; the second terminate emits no signal and reports the same facts; an unknown handle reports `terminated: true`.
- Identity selection: a fixture whose argv carries this lane's session id or `ticket-<REF>` title is selected; fixtures carrying another ref, another session id, or a similar title are not.
- The reported booleans match the observed acts (`terminated`, `escalated`, `reaped`), and the attempt evidence references stay within 16 and are identifier-only.
- The resolved grace equals the resolved `coordinator.kill-grace`; the configuration key set and the error-row inventory are unchanged.
- A clean exit and a stall cleared by later progress invoke terminate zero times.

## Confidence Rating

**Medium-High.** The contract facts are repo-local and direct: the six-entry operation set, the seven-member port, the closed capability model, the starter's idempotent 100 ms kill on the direct child, the shell's 20 s TERM→KILL over the process group plus its exact-identity reaper, and the `coordinator.kill-grace` default of 20 000 ms. The two facts that lower the rating are behavioural and outside the battery's proof boundary: whether a supported harness runtime actually escapes the process group in practice, and whether its argv always carries the session id or title the reap matches. Both are failures that reduce the reap to child-only termination — a weaker but not unsafe outcome — and neither can signal another delivery.

## References

- Change: `doc/changes/2026-11/2026-11-18--GH-347--dispatch-core-parity/chg-GH-347-spec.md` — §2.1 (stall and restart budget snapshot), §5.1 F-5, §6 Flow 1, §7.3 (deferred shared seam), §8.1 API-5, §8.3 DM-5, §8.5, §11 RSK-2/RSK-3, §17.5, §22, §25.1 Appendix A, §25.3 Appendix C, §25.6 Appendix F(D).
- Prior decisions: ADR-0008 (harness adapter contract); TDR-0016 (streaming spawn seam); TDR-0017 (coordinator supervision, the delivered process lifecycle seam); TDR-0043 (opencode adapter window and mode); [TDR-0052](TDR-0052-in-process-bounded-restart-loop.md) (the loop that consumes this operation).
- Specs: `doc/spec/features/feature-harness-adapters.md`; `feature-dispatch-engine.md`; `feature-session-lifecycle-economics.md`; `feature-coordinator-supervision.md`.
- Contracts and code (read 2026-11-18): `packages/core/src/contracts/harness.ts`; `packages/core/src/config/defaults.ts`; `packages/core/src/contracts/error-table.ts`; `packages/adapters/src/host/index.ts`; `packages/adapters/src/daemon/process.ts`; `packages/cli/src/commands/coordinator-loop.ts`.
- Parity reference (read 2026-11-18): `scripts/deliver-ticket.sh` — `kill_process_tree` (lines 1226-1249) and `_reap_opencode_orphan` (lines 1251-1288), with `KILL_GRACE_SECONDS` default 20 at line 65.
