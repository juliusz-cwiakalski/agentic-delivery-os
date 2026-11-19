---
id: TDR-0047
decision_type: tdr
status: Proposed
created: 2026-11-18
decision_date: null
last_updated: 2026-11-19
summary: "One dispatch invocation owns a bounded in-process loop whose iterations are session attempts: a clean session exit is always terminal and is never restarted regardless of the harness outcome or the bound; only a corroborated liveness stall or a harness-reported timeout is restart-eligible; a stall short-circuits only on a member of the terminal pre-restart verdict set (`merged` from a tracker-done work item, `blocked` from a blocking tracker state, `pr-open` from an open pull-request artifact) while a decisive artifact outside it does not stop the stall, an undecidable truth is terminal `state-unverified` and consumes no ordinal, and otherwise below the bound the loop consumes exactly one restart ordinal, appends exactly one `economics.restart` with reason `watchdog.liveness-stalled`, resumes the recorded session, and runs the next iteration; at or above the bound it terminates, appends the delivered exhaustion record, and produces `max-restarts`; the dispatch appends exactly one attempt record at its terminal classification and a restarted stalled iteration appends none, the persisted restart count gates automatic restarts only and never refuses admission, and the bound stays the dispatch lane's own `lane.restart-budget` (default 3) rather than the shell's env default of 10 or `coordinator.restart-budget`."
owners:
  - "Juliusz Ćwiąkalski"
service: "delivery-os dispatch engine (in-process restart loop, attempt cardinality, economics restart accounting)"
decision_scope: repo
review_date: null
customer_impact: "A single typed dispatch now reproduces the shell lane's iterate-until-terminal behaviour within a bounded budget, without leaking a second session and without turning a clean exit into a restart."
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
  driver: "@decision-advisor (GH-347: the specification routes loop ownership and restart semantics as DEC-5 and gap 7; the record is authored before dependent delivery)"
  decider: "Juliusz Ćwiąkalski — human acceptance at the GH-347 PR review; AI does not accept this R2 record"
  contributors:
    - "@spec-writer (chg-GH-347-spec §5.1 F-6, §8.1 API-1, §8.3 DM-4, §17.6 AC-F6-1…AC-F6-6, DEC-5, NFR-4)"
    - "@decision-advisor (the shell decision table, the delivered restart-admission gate, and this record)"
  reviewers:
    - "@readiness-reviewer"
    - "@reviewer"
    - "Human owner (GH-347 PR review — this record fixes attempt cardinality, restart accounting, and a budget default that is deliberately not changed)"
  performers:
    - "@coder (GH-347: the loop, the terminal rules, the restart accounting, the exhaustion path, the attempt-cardinality invariants)"
    - "@doc-syncer (GH-347 documentation phase: dispatch-engine and session-lifecycle-economics pages)"
  informed:
    - "Operators reading `restarts` on the dispatch envelope and the economics restart count"
    - "Cross-invocation restart admission (it reads the persisted restart count this loop appends to)"
    - "The daemon/supervision restart path (it keeps its own bound and reason vocabulary)"
ai_assistance:
  used: true
  roles: [repository-analyst, analyst, record-writer]
  external_data_shared: false
  citations_verified: true
  human_decider: null
  reviewers: []
revisit_triggers:
  - "The shell's restart default of 10 is proposed to become the typed default: that is a policy change with its own cost argument, and the mechanism is already parity-proven at any pinned bound — it is not a parity-wiring change."
  - "A clean exit is proposed to be restart-eligible (for example because a harness reports a premature end it believes is retryable): the terminal rule is reopened with an incident, because re-prompting a session that decided to stop repeats the same conclusion and burns tokens."
  - "A per-iteration attempt record is required for observability: the attempt record's identity and its required result token must be re-decided together, and the one-record-per-terminal-dispatch rule moves with them."
  - "A second restart reason is wanted (a resume-economics or provider-park restart): the delivered closed reason vocabulary and the supervisor's producer rules are reopened, never widened locally."
  - "The bound is proposed to be read from `coordinator.restart-budget`: the two branches carry different meanings (lane attempt bound versus coordinator restart bound) and a single key for both is a configuration decision, not a default alignment."
links:
  related_changes: ["GH-347"]
  supersedes: []
  superseded_by: []
  spec:
    - "doc/changes/2026-11/2026-11-18--GH-347--dispatch-core-parity/chg-GH-347-spec.md"
    - "doc/spec/features/feature-dispatch-engine.md"
    - "doc/spec/features/feature-session-lifecycle-economics.md"
    - "doc/spec/features/feature-coordinator-supervision.md"
  contracts:
    - "packages/core/src/contracts/dispatch.ts"
    - "packages/core/src/contracts/economics.ts"
    - "packages/core/src/contracts/daemon.ts"
    - "packages/core/src/config/defaults.ts"
    - "packages/core/src/app/dispatch.ts"
    - "packages/core/src/domain/dispatch-result.ts"
    - "packages/core/src/app/supervise.ts"
    - "packages/cli/src/production.ts"
    - "scripts/deliver-ticket.sh"
  diagrams: []
  decisions: ["TDR-0005", "TDR-0017", "TDR-0026", "TDR-0044", "TDR-0046", "TDR-0048"]
  experiments: []
  metrics: []
  roadmap_items: ["M4-S9"]
---

# TDR-0047: In-Process Bounded Restart Loop

> **Traceability.** Spec §15 **DEC-5** (and the budget half of DEC-3); §4.1 restart-loop metric; §5.1 F-6; §6 Flow 1; §8.1 API-1; §8.3 DM-1/DM-4; §8.5; §17.6 AC-F6-1…AC-F6-6; NFR-4; §25.6 Appendix F(D/E); §15.1 maps DEC-5 to this record. Depends on [TDR-0046](TDR-0046-harness-terminate-operation.md), records into [TDR-0044](TDR-0044-dispatch-owned-durable-lane-record.md)'s lane, and consumes [TDR-0048](TDR-0048-total-derivation-ladder-and-corroboration.md)'s ladder.

## Context

The shell delivery lane iterates: it starts a session, watches it, and either stops on a terminal verdict or restarts within a maximum. The typed one-shot dispatch runs exactly one session and enforces the restart budget only across invocations, so it cannot reproduce the shell's iterate-until-terminal behaviour inside one command.

- **FACT:** The one-shot engine spawns or resumes once, watches while evidence collection is pending, collects, derives, and appends one attempt record; there is no loop (`packages/core/src/app/dispatch.ts`, the single spawn/resume and the single `record(...)` path). *(read 2026-11-18)*
- **FACT:** The restart bound is read from `lane.restart-budget` (default 3) and the persisted restart count comes from the economics restart records (`packages/cli/src/production.ts:1681,3110-3116`; `packages/core/src/config/defaults.ts:71-72`). *(read 2026-11-18)*
- **FACT:** A second bound exists on another branch: `coordinator.restart-budget` defaults to **10** (`config/defaults.ts:85`), consumed by the coordinator loop. The shell's `MAX_RESTARTS` default is also **10** (`scripts/deliver-ticket.sh:59`). *(read 2026-11-18)*
- **FACT:** The delivered stall behaviour is: a stall still current at collection consults the restart-admission gate; at or above the bound the attempt is `max-restarts` with the terminal exhaustion record, and below the bound the stall is recorded and the session is left to lane supervision because the port exposes no kill operation (`packages/core/src/app/dispatch.ts:1000-1030`; `doc/spec/features/feature-session-lifecycle-economics.md:93,185`). *(read 2026-11-18)*
- **FACT:** The delivered derivation also keys `max-restarts` when the persisted count has reached the bound and the session has not completed (`packages/core/src/domain/dispatch-result.ts:198-215`), and the exhaustion record is appended through the delivered `ensureEconomicsExhaustion` path (`production.ts:3118-3132`). *(read 2026-11-18)*
- **FACT:** `economics.restart` is a delivered record kind (`delivery.economics.restart.v1`) with a closed two-value reason vocabulary `watchdog.liveness-stalled | session-interrupted`, and it is currently appended by supervision and daemon reconciliation (`packages/core/src/contracts/economics.ts:47-58`; `packages/core/src/app/supervise.ts:1048`; `packages/core/src/app/daemon-reconcile.ts:258`). *(read 2026-11-18)*
- **FACT:** The shell's decision table is explicit: a clean PM exit (`monitor_result == "finished"`) is **always** terminal and never restarted, with the recorded rationale that restarting re-prompts the same context and burns tokens; a watchdog-killed session short-circuits only on `merged`, `blocked`, or an open PR (`pr-open`) — which this record names as the terminal pre-restart verdict set — and otherwise stops at `iteration >= MAX_RESTARTS` or continues (`scripts/deliver-ticket.sh:1648-1712`). *(read 2026-11-18)*
- **FACT:** The attempt record requires a result `token` and carries the comparison and corroboration for that token (`packages/core/src/contracts/dispatch.ts:224-267`); an interrupted iteration has no such token. *(read 2026-11-18)*
- **FACT:** The dispatch envelope already carries `restarts` (`packages/core/src/contracts/dispatch.ts:353`), and the attempt record shape is unchanged by this change. *(read 2026-11-18)*
- **Why now:** The loop is gap 7 and is what makes the other parity outcomes observable in one invocation: a stall can only be *recovered* if a later iteration exists, and the budget can only be enforced in-process if something owns the iteration count.

## Problem Framing (Clarified)

"Loop until terminal" is three decisions and one accounting rule:

1. **Terminality.** Which outcomes end the invocation, and which are eligible for another attempt? The delivered system has one gate (the restart budget) and no notion of "this outcome must never be retried".
2. **Order of decision at a stall.** A stalled session may still have decisive external truth. Which of it short-circuits the restart — and which, by ruling, does not — and what happens when truth is undecidable?
3. **Cardinality.** What does one dispatch append when it runs several sessions — one attempt record, or one per iteration?
4. **Bound provenance.** Which configured number is the dispatch loop's bound, and does parity require adopting the shell's value?

Root cause versus symptom: the symptom is "one dispatch cannot restart". The cause is that restart admission was written as a *pre-flight gate for a single attempt* rather than as a *loop decision*, so the only thing that can consume a restart is a new invocation. Moving the loop inside one invocation forces the terminal rules and the record cardinality to be stated, because everything that used to be implicit in "one attempt per invocation" becomes an invariant a reviewer must check.

Deliberately out of scope: no change to the eleven tokens, projections, or exits (NG-4); no new record kind or restart reason (§8.2); no change to `lane.restart-budget`'s default (NG-11, NFR-11); no adoption of the shell's 10 (DEC-5, DEC-10); no nested command invocation; no change to the supervisor's or daemon's restart producers; no operator surface for iteration history (GH-354).

## Constraints (Hard Requirements)

### C-1: A clean session exit is always terminal

- **Statement:** A session that exits cleanly ends the invocation with its derived result, regardless of the harness-reported outcome and regardless of whether the bound has room. No path restarts a clean exit.
- **Source:** AC (AC-F6-4; §5.1 F-6; §11 RSK-3) + parity reference (`scripts/deliver-ticket.sh:1648-1665`)
- **Verification:** test (each clean-exit harness outcome with a bound greater than the attempt count: iterations = 1, restarts = 0) + code review
- **Negotiable:** no

### C-2: Only a corroborated stall or a harness-reported timeout is restart-eligible

- **Statement:** Restart eligibility requires a liveness stall corroborated by two consecutive sourced no-advance readings that is still current at collection, or a harness-reported timeout (an incomplete session). A failed, premature-end, refused, or completed session is not restart-eligible on that basis, and a stall cleared by later progress is not a stall. A decisive artifact outside the terminal pre-restart verdict set does not make a stall terminal: `finished`, `partial`, and `noop-lane-nothing-to-do` never stop a stall, and a stalled session with commits and complete pm-notes restarts below the bound. Artifact-first derivation governs a **completed** session only.
- **Source:** AC (AC-F6-1, AC-F6-3; AC-F5-2, AC-F5-3; §5.1 F-4/F-5/F-6; §8.5 "Stall truth is not completed-session truth"; RSK-3)
- **Verification:** test (per harness outcome: restart count; a cleared stall: zero restarts; a missing second reading: no stall) + code review
- **Negotiable:** no

### C-3: Exactly one attempt record per dispatch that reaches classification

- **Statement:** A dispatch appends exactly one attempt record, at its terminal classification (including an attempt-stage failure). A restarted stalled iteration appends no attempt record; a pre-session refusal appends none; no dispatch appends two.
- **Source:** AC (AC-F6-1, AC-F6-5; NFR-4; §8.3 DM-2; DM-1's "a restarted stalled iteration appends no terminal lane record") + prior decision (TDR-0024 attempt read side)
- **Verification:** test (attempt-record count per case: terminal = 1, restarted iteration = 0 additional, refusal = 0; the read side returns one record) + code review
- **Negotiable:** no

### C-4: One consumed ordinal equals one `economics.restart` and one persisted count increment

- **Statement:** Each restart consumes exactly one ordinal and appends exactly one delivered `economics.restart` record with the delivered reason `watchdog.liveness-stalled` — a stall is the loop's only restart cause, so `session-interrupted` stays a supervisor/daemon reason and is never this loop's; at or above the bound the delivered terminal exhaustion record is appended instead and the result is `max-restarts`. No new record kind and no new reason is introduced.
- **Source:** AC (AC-F6-1, AC-F6-2; §8.2 "no new record kind is added for restarts"; §10) + prior decision (economics restart record)
- **Verification:** test (restart count equals `economics.restart` count equals the persisted count read by the next invocation; the exhaustion record appears exactly once at the bound) + code review
- **Negotiable:** no

### C-5: The bound is the delivered `lane.restart-budget`, and its default does not change

- **Statement:** The loop's bound is the configured `lane.restart-budget` (default 3). The default is not changed; `coordinator.restart-budget` (10) stays the coordinator's own bound and the shell lane's env default of 10 is not adopted; no configuration key is added; parity is proven by pinning the bound per case.
- **Source:** AC (AC-F6-5; NFR-11; §8.5 "Configuration unchanged"; §7.3; DEC-5, DEC-10)
- **Verification:** test (default resolution = 3; a pinned non-default bound produces exactly that many restarts; config key-set equality) + code review
- **Negotiable:** no

### C-6: An operator resume consumes no ordinal and is never budget-refused

- **Statement:** A `--resume-prompt` continuation of a recorded lane consumes no restart ordinal and is not refused by the restart budget; only an automatic restart after a stall consumes one. No second session starts until a stalled session is confirmed terminated.
- **Source:** AC (AC-F3-2; AC-F6-1; §5.1 F-3/F-6) + [TDR-0046](TDR-0046-harness-terminate-operation.md) DC-3/DC-4
- **Verification:** test (operator resume at the bound: admitted, zero ordinals consumed; automatic restart: one ordinal, and zero new sessions when terminate is unsupported) + code review
- **Negotiable:** no

### C-7: Every iteration runs inside the same invocation

- **Statement:** The loop is in-process: one invocation owns all iterations, and no iteration re-enters the command as a nested invocation or a child process. The dispatch keeps one lease, one attempt identity, and one envelope.
- **Source:** AC (§8.1 API-1 "One invocation owns zero or more iterations in a bounded loop"; NFR-5 no shell; §5.1 F-6)
- **Verification:** test (zero child command invocations across the loop; one lease identity across iterations; one envelope) + code review
- **Negotiable:** no

### C-8: The persisted restart count gates restarts, never admission

- **Statement:** An admission whose persisted restart count is at or above `lane.restart-budget` is never refused: the dispatch runs one iteration, and only a stall in that iteration produces `max-restarts` with exactly one attempt record and the delivered exhaustion record. A clean exit in that iteration keeps its own classification and appends no exhaustion record.
- **Source:** AC (AC-F6-6; §5.1 F-6; §8.5 "Configuration unchanged"; §25.6 Appendix F(D); DEC-5)
- **Verification:** test (admit at and above the bound with a clean exit: one iteration, its own token, one attempt record, no exhaustion record; the same admission with a stall: `max-restarts`, one attempt record, one exhaustion record) + code review
- **Negotiable:** no

**Table stakes.** Every alternative below keeps the delivered liveness evaluator, the delivered attempt record shape, the delivered economics restart kind, and the delivered `max-restarts` token; none of those eliminates an alternative.

## Decision Drivers

1. **Parity with the shell's decision table.** The shell's rules were bought with real incidents (an infinite re-prompt loop; a leaked orphan runtime). The typed loop's value is that it encodes the same table rather than a plausible one.
2. **Never re-prompt a session that decided to stop.** A clean exit is a conclusion; restarting it repeats the same context and the same conclusion at full token cost.
3. **No second session beside a possibly-live first.** Restart without confirmed death is a leak, not a recovery.
4. **Record honesty.** The attempt record claims a delivered result; an interrupted iteration has none, so writing one would either fabricate a token or make `token` nullable.
5. **Accounting integrity across invocations.** The persisted restart count is what cross-invocation admission reads; one ordinal must equal one record or the budget stops meaning anything.
6. **Do not change shipped policy for a wiring change.** A default is an operator contract; adopting another component's value because it is convenient is a policy change wearing a parity costume.
7. **Solo-maintainer cost and the paved road.** One loop, one terminal rule set, one accounting record already delivered.

## Decision Rights (DACI)

- **Driver:** `@decision-advisor` — GH-347 routes loop ownership and restart semantics here as spec DEC-5 (ticket gap 7).
- **Decider / Approver:** Juliusz Ćwiąkalski at the GH-347 PR review. AI does not accept this R2 record.
- **Contributors:** `@spec-writer` (F-6, API-1, DM-1/DM-4, AC-F6-x, NFR-4, DEC-5), `@decision-advisor` (shell decision table, delivered gate and record observation, this record).
- **Required reviewers:** `@readiness-reviewer`, `@reviewer`, and the human owner (attempt cardinality and a budget default are contract-level).
- **Performers:** `@coder` (loop, terminal rules, accounting, exhaustion, cardinality invariants); `@doc-syncer` (dispatch-engine, session-lifecycle-economics pages).
- **Informed:** operators reading `restarts`; cross-invocation admission; the daemon/supervision restart producer.

**Type note.** TDR. The supervision architecture and its restart regime were decided by TDR-0017, and the economics restart record by its own contract; this record fixes the dispatch caller's control flow inside those. It is R2 because it changes the command's cardinality invariants and consumes a shipped budget; it is not R3 because every fact is repo-local, the loop is deterministic and offline-provable, and the change is reversible by reverting the loop.

## Evidence, Assumptions & Unknowns

| Item | Label | Source | Impact if false | Confidence |
|---|---|---|---|---|
| The one-shot engine runs one session per invocation and appends one attempt record. | FACT | `packages/core/src/app/dispatch.ts` (single spawn/resume, single `record(...)`); `packages/core/src/contracts/dispatch.ts:224-267` (read 2026-11-18) | If it already looped, only the terminal rules would be missing. | High |
| The bound is `lane.restart-budget` with default 3, and the persisted count comes from economics restart records. | FACT | `packages/cli/src/production.ts:1681,3110-3116`; `packages/core/src/config/defaults.ts:71-72` (read 2026-11-18) | C-5's provenance would be wrong and a key change might be needed. | High |
| `coordinator.restart-budget` defaults to 10, and the shell's `MAX_RESTARTS` defaults to 10. | FACT | `packages/core/src/config/defaults.ts:85`; `scripts/deliver-ticket.sh:59` (read 2026-11-18) | The "shell's 10" would be an unrelated number and the non-adoption argument would need restating. | High |
| A clean exit is always terminal in the shell, with an explicit anti-infinite-loop rationale; only stalled sessions accept `merged`/`blocked`/`pr-open` and otherwise continue or stop at the bound. | FACT | `scripts/deliver-ticket.sh:1648-1712` (read 2026-11-18) | The terminal rules would have no parity reference and C-1/C-2 would be our invention. | High |
| The delivered stall path routes through restart admission, and below the bound it records the stall and leaves the session to supervision. | FACT | `packages/core/src/app/dispatch.ts:1000-1030`; `doc/spec/features/feature-session-lifecycle-economics.md:93,185` (read 2026-11-18) | The "no in-process loop" gap would not exist in this shape. | High |
| `economics.restart` is delivered with exactly two reasons, and the dispatch family does not currently append it. | FACT | `packages/core/src/contracts/economics.ts:47-58`; producers at `supervise.ts:1048` and `daemon-reconcile.ts:258` (read 2026-11-18) | A new reason or record kind would be required, changing C-4. | High |
| The attempt record requires a token, so an interrupted iteration cannot be recorded as an attempt. | FACT | `packages/core/src/contracts/dispatch.ts:224-267` (read 2026-11-18) | C-3 would be an arbitrary choice rather than a consequence of the record's contract. | High |
| The envelope already carries `restarts`. | FACT | `packages/core/src/contracts/dispatch.ts:353` (read 2026-11-18) | The envelope would need an additive field. | High |
| A completed session and a stall are different decision points: artifact-first derivation governs a completed session, while a stall short-circuits only on the terminal pre-restart verdict set. | FACT | Spec §5.1 F-4/F-5/F-6, AC-F4-3, AC-F5-3, §8.5 "Stall truth is not completed-session truth", §25.6 Appendix F(C) vs F(D) (read 2026-11-19) | If one ladder covered both, a stalled session with commits and complete pm-notes would end as `finished` instead of restarting, and the loop's parity would be wrong. | High |
| A persisted count at or above the bound never refuses admission. | FACT | Spec §5.1 F-6, AC-F6-6, §25.6 Appendix F(D) (read 2026-11-19) | Admission would need a pre-session refusal arm the ladder does not have, and the shell's run-one-iteration behaviour would not be reproduced. | High |
| A harness session survives its process, so resuming the recorded session after a terminated stall continues the same work rather than starting over. | ASSUMPTION | Spec §12; shell resume-by-session-id practice | If false, an automatic restart would begin a fresh session; the loop would still be bounded, but the cost model changes and a revisit is warranted. | Medium-High |
| An unverified truth after a whole tracker ladder cannot be improved by another session attempt. | ASSUMPTION | Spec DEC-5 rationale (a five-attempt ladder has already exhausted the read) | If a later attempt could read truth, making an unverified stall terminal would under-retry; the operator can still re-dispatch. | Medium-High |
| The shell's `iteration >= max_restarts` compares an iteration index against the same number the typed loop counts as ordinals. | ASSUMPTION | `scripts/deliver-ticket.sh:1698`; the shell increments `restart_count` per restart at `:1963` | An off-by-one in the parity comparison; the parity battery pins the bound per case and asserts the exact count, so the discrepancy would be visible rather than silent. | Medium |

## Mental Models & Techniques Used

- **First principles:** What must a restart loop guarantee? (i) it terminates for every input, (ii) it never retries an outcome that a retry cannot change, (iii) every retry is recorded and bounded, (iv) it never runs two sessions at once, (v) each iteration's cost is attributable. The decision is these five properties, not a `while` statement.
- **Inversion:** What makes a loop catastrophic? Restarting a clean exit (the shell's own bug fix); restarting without confirming death (a process leak plus database contention); retrying a truth outage that has already exhausted its ladder; writing an attempt record per iteration (a read side full of tokens that never happened); consuming an ordinal without a record (a budget that drifts from its own count). C-1…C-7 exclude exactly these.
- **Second-order thinking:** Making the loop in-process turns the *lease* into the one exclusion across iterations, which is why a nested invocation is refused (it would claim and self-refuse). It also makes the attempt record's "one per terminal dispatch" a stronger statement than "one per invocation", because a single invocation can now hold several sessions.
- **Systems thinking:** The loop joins the liveness evaluator (stall), the terminate operation (death), the derivation ladder (terminal verdicts), the economics ledger (count), and the lane (session identity). Each join can double-count or lose a fact: a stall that does not terminate leaks; a restart that does not append loses the count; a restarted iteration that appends an attempt fabricates a result; a stall that short-circuits on an artifact outside the verdict set silently skips the restart the shell would have taken, while a completed session that ignored its artifacts would discard a real outcome.
- **5 Whys (on "the budget is only enforced across invocations"):** there is no in-process iteration → restart admission was written as a pre-flight gate → the command's contract was one attempt → because the attempt record is the unit of accounting and it is terminal-only. The loop therefore has to keep the attempt record terminal-only (C-3) and move the counting unit to the economics record (C-4).
- **Paced road / KISS:** Reuse the delivered stall verdict, the delivered restart-admission arithmetic, the delivered exhaustion append, and the delivered restart record. Add one loop and one terminal rule set.

## Alternatives Considered

### Per-Alternative Constraint-Compliance Evaluation

Legend: ✅ passes · ❌ fails. Every constraint is `negotiable: no`, so no accepted-risk exception exists and no driver score rescues a failing option.

| | C-1 clean exit terminal | C-2 stall-only restart | C-3 one attempt record | C-4 one ordinal one record | C-5 delivered bound | C-6 operator resume free | C-7 in-process |
|---|:---:|:---:|:---:|:---:|:---:|:---:|:---:|
| ALT-0 keep cross-invocation restart only | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ | ❌ (no loop at all) |
| ALT-1 loop with the shell's 10 (or `coordinator.restart-budget`) as the dispatch bound | ✅ | ✅ | ✅ | ✅ | ❌ | ✅ | ✅ |
| ALT-2 loop with one attempt record per iteration | ✅ | ✅ | ❌ | ✅ | ✅ | ✅ | ✅ |
| ALT-3 loop that restarts any non-success harness outcome | ❌ | ❌ | ✅ | ✅ | ✅ | ✅ | ✅ |
| ALT-4 loop by nested command invocation per iteration | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ | ❌ |
| ALT-5 selected: in-process bounded loop, delivered bound, one terminal attempt record | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ |

### Alternative 0 — Do Nothing: Keep Cross-Invocation Restart Only

- **Eligibility:** Not eligible (fails C-7's intent — there is no loop, so the in-process parity outcome does not exist).
- **Summary:** Keep one attempt per invocation; rely on the caller to re-dispatch until the budget is exhausted.
- **Constraint compliance:** Passes C-1…C-6 vacuously (nothing loops). Fails the capability the change names: the shell's iterate-until-terminal behaviour cannot be reproduced, and a stall below the bound still leaves a live session behind.
- **Driver fit:** Fails driver 1 outright; serves only driver 6.
- **Pros:** Zero change; no cardinality reasoning needed.
- **Cons:** The gap persists, and the recovery path stays a human or CEO-loop act.
- **Why rejected:** It is the gap.

### Alternative 1 — Loop With the Shell's 10 (or `coordinator.restart-budget`) as the Dispatch Bound

- **Eligibility:** Not eligible (fails C-5).
- **Summary:** Adopt the shell's `MAX_RESTARTS` default, which happens to equal the delivered `coordinator.restart-budget`, as the dispatch loop's bound.
- **Constraint compliance:** Passes C-1…C-4, C-6, C-7. Fails C-5: it changes a shipped default on a change whose non-goals forbid a configuration change, and it would silently raise the maximum cost of one dispatch by more than 3× for every operator who never set the key.
- **Driver fit:** Serves parity superficially (same number, different meaning) and fails driver 6 (shipped policy).
- **Pros:** Numeric parity with the shell; no case needs a pinned bound.
- **Cons:** A policy change hidden in a wiring change; the lane branch's meaning ("how many attempts one lane may make") differs from the coordinator's ("how many times the supervisor may restart a lane"), so the equal number is a coincidence, not an alignment.
- **Why rejected:** Parity is about the mechanism and the decision table, not about copying a number that belongs to another branch.

### Alternative 2 — Loop With One Attempt Record per Iteration

- **Eligibility:** Not eligible (fails C-3).
- **Summary:** Record every iteration as an attempt so the history shows each stall and restart.
- **Constraint compliance:** Passes C-1, C-2, C-4, C-5, C-6, C-7. Fails C-3: the attempt record requires a result token; an interrupted iteration has none, so either a token is fabricated (a false claim that a session produced a result) or `token` becomes nullable (a delivered-shape change and a read-side change for every consumer).
- **Driver fit:** Serves observability (a real want) and fails driver 4 (record honesty).
- **Pros:** A richer history; restarts visible on the attempt read side.
- **Cons:** Fabricated or absent tokens; the read side's "one record per dispatch" assumption breaks; NFR-4 becomes false.
- **Why rejected:** The record's identity is a classified result; an interrupted iteration has to be represented by the economics record and the lane, which already carry it.

### Alternative 3 — Loop That Restarts Any Non-Success Harness Outcome

- **Eligibility:** Not eligible (fails C-1, C-2).
- **Summary:** Retry whenever the harness does not report a clean completion — failed, premature end, timeout, refusal.
- **Constraint compliance:** Passes C-3…C-7. Fails C-1 and C-2: it restarts clean exits that report a non-success outcome (the shell's explicit bug fix) and restarts outcomes a retry cannot change (a refusal, a premature end caused by the same context), producing the infinite re-prompt loop the shell's comment describes.
- **Driver fit:** Fails drivers 1 and 2, which are the reason the terminal rules exist.
- **Pros:** Looks resilient; catches transient session deaths.
- **Cons:** Burns the budget on conclusions already reached; turns a deterministic failure into a bounded but pointless retry; contradicts the parity table.
- **Why rejected:** Retry-ability is a property of *why* a session ended, not of *whether* it succeeded.

### Alternative 4 — Loop by Nested Command Invocation per Iteration

- **Eligibility:** Not eligible (fails C-7).
- **Summary:** Each iteration re-invokes the dispatch command as a child process, so the "loop" is external to the engine and each attempt keeps its own record.
- **Constraint compliance:** Passes C-1…C-6. Fails C-7 and the lease contract: a nested invocation would claim the repository-exclusive lease its parent already holds and be refused `queue.single-flight` by its own parent (TDR-0045), or would need a lease hand-off that does not exist.
- **Driver fit:** Fails driver 3 (it cannot confirm death before starting a second process tree) and driver 7 (it adds a process seam to avoid a loop).
- **Pros:** Reuses the one-shot path unchanged; each attempt is a clean process boundary.
- **Cons:** Self-refusal on the lease; no shared session identity or termination confirmation; two processes to supervise; a shell-flavoured design in a change whose whole point is the no-shell invariant.
- **Why rejected:** The lease and the session identity are per-invocation facts, and a nested invocation cannot share them.

### Alternative 5 — Selected: In-Process Bounded Loop, Delivered Bound, One Terminal Attempt Record

- **Eligibility:** Eligible.
- **Summary:** One invocation owns up to `lane.restart-budget` restarts. Clean exit terminal; only a corroborated stall or harness timeout is restart-eligible; a stall short-circuits only on a member of the terminal pre-restart verdict set, an undecidable truth is terminal `state-unverified` with no ordinal, otherwise one ordinal plus one `economics.restart` plus a resume; at the bound, terminate, exhaustion record, `max-restarts`. A persisted count at or above the bound admits and runs one iteration. One attempt record at classification; none for a restarted iteration.
- **Constraint compliance:** Passes C-1…C-7 (matrix above).
- **Driver fit:** Best on every driver: the shell's table encoded (1), no re-prompt of a conclusion (2), death before a new session (3), a terminal-only attempt record (4), one ordinal one record (5), shipped defaults untouched (6), one loop and one record already delivered (7).
- **Pros:** Parity becomes an executable decision table; each restart is durable and attributable; the attempt read side keeps its identity; the operator sees `restarts` and the terminal token without a new surface.
- **Cons:** A dispatch may now run several sessions, so every stop-condition review must consider the loop; the stall ladder has three branches a reviewer must check; an interrupted iteration's history lives only in the economics and lane records.
- **Why chosen:** It is the only alternative that satisfies every `negotiable: no` constraint, and it encodes the parity reference instead of approximating it.

## Decision

- **Decision:** Adopt **ALT-5**.

  1. **DC-1 — One invocation owns the loop.** The dispatch runs a bounded sequence of session attempts inside one invocation: spawn or resume, watch, collect, terminate if stalled, derive truth, decide. It keeps one lease, one attempt identity, one envelope; no iteration re-enters the command. (Spec API-1, F-6.)
  2. **DC-2 — A clean exit is always terminal.** The loop never restarts a clean session exit, regardless of the harness-reported outcome or the bound. (Spec DEC-5; shell parity `scripts/deliver-ticket.sh:1648-1665`.)
  3. **DC-3 — Only a corroborated stall or a harness timeout is restart-eligible.** A harness-reported timeout is a terminal stall for decision purposes. A stall is a current-state verdict requiring two consecutive sourced no-advance readings; a stall cleared by later progress is not a stall; a failed, premature-end, refused, or completed session is not restart-eligible on that basis. (Spec F-5/F-6, AC-F6-1/AC-F6-4.)
  4. **DC-4 — The stall ladder is ordered and total, and it is not the completed-session ladder.** A stall short-circuits **only** on a member of the **terminal pre-restart verdict set** — `merged` from a tracker-done work item, `blocked` from a blocking tracker state, `pr-open` from an open pull-request artifact (an artifact verdict, not a tracker fact) — which is returned without a restart. A decisive artifact **outside** the set (`finished`, `partial`, `noop-lane-nothing-to-do`) does not stop a stall: a stalled session with commits and complete pm-notes restarts below the bound. Absent a member, an undecidable truth is terminal `state-unverified` at exit 2 and consumes no ordinal; otherwise, below the bound, the loop consumes exactly one ordinal, appends exactly one `economics.restart` with reason `watchdog.liveness-stalled`, resumes the recorded session (a fresh spawn only when no session was ever recorded), and runs the next iteration; at or above the bound it terminates the session, appends the delivered terminal exhaustion record, and produces `max-restarts`. After a **completed** session, derivation is artifact-first and this ladder is not consulted. (Spec §5.1 F-4/F-5/F-6; §8.5 "Stall truth is not completed-session truth"; §25.6 Appendix F(C) and F(D); AC-F5-3, AC-F6-1…AC-F6-3.)
  5. **DC-5 — The attempt record is terminal-only.** Exactly one attempt record is appended at the dispatch's terminal classification; a restarted stalled iteration appends none, because the record carries a delivered result token an interrupted iteration does not have. A pre-session refusal appends none. (Spec §5.1 F-6, NFR-4, DM-2.)
  6. **DC-6 — The bound is the dispatch lane's own `lane.restart-budget`.** Default 3, unchanged. `coordinator.restart-budget` (10) governs coordinator supervision and is deliberately not consumed here; the shell lane's env default of 10 is a shell-lane default and is not adopted as the lane bound. No key is added; parity is proven with a pinned bound per case. (Spec DEC-5, DEC-10, NFR-11, §7.3, §8.5 "Configuration unchanged".)
  7. **DC-7 — Operator resume is not a restart.** A `--resume-prompt` continuation consumes no ordinal and is not refused by the budget; only an automatic post-stall restart does. No second session starts until the stalled session is confirmed terminated (TDR-0046). (Spec F-3, AC-F3-2, AC-F6-1.)
  8. **DC-8 — The persisted restart count gates restarts, never admission.** A dispatch admitted with a persisted count at or above `lane.restart-budget` still runs exactly one iteration; a clean exit keeps its own classification and appends no exhaustion record, and only a stall in that iteration produces `max-restarts` with exactly one attempt record and the delivered exhaustion record. (Spec F-6, AC-F6-6, §25.6 Appendix F(D).)

  **One deliberate divergence from the shell, recorded.** The shell restarts a **stalled** session whose classification is `state-unverified` (it is not a member of the terminal pre-restart verdict set, so it falls through to the bound test at `scripts/deliver-ticket.sh:1698`). This decision makes an unverified stall **terminal with no ordinal consumed**, because the typed lane has already spent the declared five-attempt tracker ladder before concluding "unverified" (spec DEC-5, F-4), and replaying a series of exhausted ladders would multiply a known outage by the remaining budget. The divergence is justified and bounded: the operator can still re-dispatch, and the reader sees the exhaustion evidence that explains why no restart happened.

### Constraint Compliance Attestation

ALT-5 satisfies C-1 through C-8. C-1: the terminal rule is unconditional. C-2: eligibility is the two-reading stall or a harness timeout, and a decisive artifact outside the terminal pre-restart verdict set never makes a stall terminal. C-3: one attempt record at terminal classification, none for a restarted iteration or a refusal. C-4: one ordinal, one `economics.restart` with a delivered reason, and the delivered exhaustion record at the bound. C-5: the bound is `lane.restart-budget` at its delivered default with no key change. C-6: operator resume consumes no ordinal, and a restart follows confirmed termination. C-7: all iterations run in-process with one lease and one envelope. C-8: a count at or above the bound admits one iteration and never refuses admission. No accepted-risk exception is claimed; the shell divergence is a recorded justification, not a constraint violation, because no constraint requires the shell's unverified-stall behaviour.

## Trade-offs & Consequences

### Positive Outcomes

- The shell's decision table becomes executable and testable offline, so "the typed lane behaves like the shell" is a claim with a fixture rather than an assertion.
- Each restart is durable and attributable: one ordinal, one economics record, and a resumed session identity, so the next invocation's admission reads a truthful count.
- A clean exit can never be restarted, which removes the token-burning loop the shell fixed; and because a stall short-circuits only on the terminal pre-restart verdict set, the typed lane reproduces the shell's own separation between a completed session and a killed one.
- The attempt read side keeps its identity ("one classified result per dispatch") while the loop's history lives in the economics and lane records where it belongs.
- No shipped default moves, so every operator's maximum cost per dispatch is unchanged except that it is now actually spent in one invocation rather than across several.

### Negative Outcomes

- A dispatch can now run several sessions, so any stop-condition review, cost estimate, or timeout budget that assumed one session per invocation is wrong. Mitigation: the envelope reports `restarts` and the bound is configurable without a code change.
- The stall ladder has three branches and an ordering, which is the most intricate control flow this command owns. Mitigation: Appendix F(D) is normative and the parity battery asserts each branch.
- An interrupted iteration's history is not on the attempt read side; an operator reconstructing "what happened" must read the lane and economics records. Mitigation: GH-354's surface is the natural home, and the attempt evidence carries the stall verdict and termination result.
- The explicit divergence on an unverified stall means the shell and the typed lane can differ in restart count for the same outage. Mitigation: the reason is recorded here and the exhaustion evidence is visible.

### Unresolved Questions

- [ ] Numeric parity of the bound: the typed loop consumes at most `bound` restarts (a stall at a count below the bound restarts; at or above it stops), while the shell compares an iteration index against `MAX_RESTARTS`, so it permits `MAX_RESTARTS - 1` restarts. The typed reading is fixed by AC-F6-6 and §25.6 Appendix F(D); whether the two numbers should be made numerically equal is a policy question the spec leaves to the owner. (owner: `@spec-writer` / `@pm`; the battery pins the bound per case and asserts the exact count, so the offset is visible rather than silent)
- [ ] Should an interrupted iteration be visible on any read surface before GH-354? (owner: `@pm`; today the lane active record and the economics restart are the durable trace)

## Implementation Plan

1. **Loop.** Wrap the delivered single-attempt body in a bounded loop inside the dispatch run; carry the session handle, the restart count, and the iteration ordinal across iterations; keep one lease and one attempt identity.
2. **Terminal rules.** Apply DC-2 first, then the stall ladder: terminate if capable, short-circuit only on the terminal pre-restart verdict set, decide unverified-terminal or restart, and enforce the bound; for a completed session, hand off to artifact-first derivation without consulting the stall ladder. Admit at or above the persisted bound and run exactly one iteration (DC-8).
3. **Accounting.** On each restart, append exactly one `economics.restart` with `watchdog.liveness-stalled` and increment the count; at the bound, use the delivered exhaustion append and produce `max-restarts`.
4. **Cardinality.** Keep the attempt append at the terminal classification only; assert that a restarted iteration appends none; keep the refusal path at zero.
5. **Lane.** Append an active lane record per acquired session (TDR-0044) and exactly one terminal record at the dispatch's final classification.
6. **Conformance.** Add the loop cases: clean exit at a high bound (one iteration), below-bound restart (one ordinal, one economics record, no attempt for the stalled iteration), at-bound `max-restarts` with the exhaustion record, unverified stall (no ordinal), non-capable terminate (no second session), and operator resume at the bound (admitted, no ordinal).
7. **Documentation.** Replace the two "left to lane supervision" statements with the loop contract and record that the dispatch family is now a producer of `economics.restart`.

## Verification Criteria

- Clean exit with a bound of 3 and one attempt: iterations = 1, `restarts` = 0, one attempt record, no `economics.restart`, no terminate invocation.
- Corroborated stall below the bound: `terminated` reported before any new session, exactly one `economics.restart` with reason `watchdog.liveness-stalled`, exactly one additional iteration, zero attempt records for the stalled iteration, one attempt record at the terminal classification.
- Corroborated stall at or above the bound: `max-restarts` at exit 1, one attempt record, exactly one delivered exhaustion record, zero further sessions.
- Corroborated stall whose truth is a member of the terminal pre-restart verdict set (`merged` from tracker-done, `blocked`, or `pr-open` from the open-PR artifact): that verdict is returned, `restarts` unchanged, zero ordinals consumed for that iteration.
- Unverified stall: `state-unverified` at exit 2, zero ordinals consumed, no second session.
- A stalled session with commits > 0 and complete pm-notes and no terminal pre-restart verdict: it restarts below the bound and is **not** recorded as `finished`; a completed session with the same facts resolves `finished` through artifact-first derivation.
- Adapter without terminate: zero second sessions; a member of the terminal pre-restart verdict set or `state-unverified` with the stall evidence.
- Admission with a persisted count at or above the bound and a clean exit: one iteration, the clean exit's own token, one attempt record, zero `economics.restart`, zero exhaustion records; the same admission with a stall: `max-restarts` at exit 1, one attempt record, exactly one exhaustion record, zero further sessions.
- `--resume-prompt` at the bound: admitted, zero ordinals consumed, one attempt record.
- The configured default resolves to 3; a pinned bound of N produces exactly N restarts; the persisted restart count equals the number of `economics.restart` records; the configuration key set and the attempt schema identity are unchanged.

## Confidence Rating

**High.** Every load-bearing fact is repo-local and read directly: the single-attempt body and its one append, the `lane.restart-budget` default and its consumption, the two competing 10s, the shell's ordered decision table with its clean-exit rule, the delivered stall path and its supervision hand-off, the economics restart kind and its closed reasons with its current producers, the attempt record's required token, and the envelope's `restarts`. The residual uncertainty is external: whether a resumed session continues the same work after a terminated stall, which is bounded by the loop's own accounting (a restart that cannot resume starts a fresh session only when no session was ever recorded).

## References

- Change: `doc/changes/2026-11/2026-11-18--GH-347--dispatch-core-parity/chg-GH-347-spec.md` — §2.1 (restart budget and shell loop snapshot), §4.1, §5.1 F-5/F-6, §6 Flow 1, §7.3, §8.1 API-1, §8.2, §8.3 DM-1/DM-4, §8.5 (including "Stall truth is not completed-session truth" and "Phase-ledger no-work arm retired"), §10, §11 RSK-3, §17.6 AC-F6-1…AC-F6-6, §23 (cost), §25.6 Appendix F(C–E).
- Prior decisions: TDR-0005 (result taxonomy and exits); TDR-0017 (coordinator supervision architecture); TDR-0024 (attempt read side); TDR-0026 (restart-budget-exhausted reason vocabulary); [TDR-0044](TDR-0044-dispatch-owned-durable-lane-record.md) (lane write points); [TDR-0046](TDR-0046-harness-terminate-operation.md) (termination); [TDR-0048](TDR-0048-total-derivation-ladder-and-corroboration.md) (the ladder a terminal iteration consumes).
- Specs: `doc/spec/features/feature-dispatch-engine.md`; `feature-session-lifecycle-economics.md`; `feature-coordinator-supervision.md`.
- Contracts and code (read 2026-11-18): `packages/core/src/app/dispatch.ts`; `packages/core/src/domain/dispatch-result.ts`; `packages/core/src/contracts/dispatch.ts`; `packages/core/src/contracts/economics.ts`; `packages/core/src/config/defaults.ts`; `packages/core/src/app/supervise.ts`; `packages/core/src/app/daemon-reconcile.ts`; `packages/cli/src/production.ts`.
- Parity reference (read 2026-11-18): `scripts/deliver-ticket.sh` — `MAX_RESTARTS` default 10 (line 59), `decide_after_iteration` (lines 1648-1712), restart count increment (line 1963).
