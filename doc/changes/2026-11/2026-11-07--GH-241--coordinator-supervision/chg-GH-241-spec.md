---
change:
  ref: GH-241
  type: feat
  status: Proposed
  slug: coordinator-supervision
  title: "M1-S23: Coordinator supervision"
  owners: ["engineering"]
  service: delivery-os
  labels:
    - cli
    - supervision
    - session-lifecycle
    - state
    - blockers
    - harness
    - process-lifecycle
    - m1
  version_impact: minor
  audience: internal
  security_impact: medium
  risk_level: high
  dependencies:
    internal:
      - "core contracts tier (coordinator vocabulary and process-lifecycle port)"
      - "core domain tier (pure supervision decisions)"
      - "core state tier (coordinator records under the delivered artifact boundary)"
      - "core config tier (coordinator branch with declared defaults)"
      - "adapter tier (process-lifecycle implementations beside harness session adapters)"
      - "CLI command layer (coordinator command family)"
      - "session lifecycle economics (M1-S15 sourced progress signals and restart-budget pattern)"
      - "typed blocker channel (M1-S16 pickup predicate, blocker ledger, owner brief anchor)"
    external:
      - "opencode harness process and session interfaces"
      - "Claude Code harness process and session interfaces"
      - "POSIX process signals (TERM then KILL) and process-tree enumeration; Windows process-tree equivalent behind the same port"
links:
  issue: https://github.com/juliusz-cwiakalski/agentic-delivery-os/issues/241
  related_changes: ["GH-235", "GH-230", "GH-223"]
  related_decisions: ["TDR-0013", "TDR-0014", "ODR-0003"]
---

# CHANGE SPECIFICATION

> **PURPOSE**: Give the coordinator session the same managed lifecycle lanes already have — recorded join-or-resume decisions, artifact-evidence stuck detection, kill with grace, a bounded restart budget, and wake-on-typed-question — so the last unmanaged actor in the M1 end state is supervised and the bash stack can retire at M4-S5.

## 1. SUMMARY

Deliver coordinator supervision as a distinct supervised process with a distinct durable restart budget and a small command family (`coordinator start`, `stop`, `status`, and a bounded `tick` for one collection cycle). It replaces `ceo-loop.sh`'s actual function with typed decisions: join a live coordinator session, resume it when its context is recoverable, or spawn a fresh one when it is not; detect a stuck coordinator from artifact evidence (no digest consumed, no merge, no answer within declared windows, never CPU); kill the coordinator process tree with a grace period; bound restarts and escalate classified exhaustion to the owner brief; and wake the coordinator within one collection cycle when the M1-S16 rank-1 pickup predicate is satisfied.

The change also defines the shared supervisor-regime descriptor (state-dir scope, single-instance lease, unit identity, distinct budget) and leaves the future `daemon install` wiring as the named M1-S18 seam. Coordinator single-instance ownership is a durable, append-only **instance lease** carried by `coordinator.fence` records; the delivered state write fence is used only for the duration of one append, never held for the supervisor's lifetime. It does not build a daemon command, a control socket, lane supervision, an OS unit installer, the dispatch loop, or prompt changes.

## 2. CONTEXT

### 2.1 Current State Snapshot

The coordinator session is kept alive today by `ceo-loop.sh`: the loop joins a live session, resumes when its context is small enough, kills a session that shows no session traffic and no healthy delivery, and counts restarts until a maximum. Those functions are bash, repository-specific, and scheduled to disappear when the bash stack retires. They are not typed, not recorded as decisions, not escalated to the owner brief, and not exposed to the M1-S16 pickup contract.

The delivered M1 surfaces this change consumes are already in the tree:

- **Session lifecycle economics (M1-S15, GH-235, merged `c4f6cd63`)** — progress-based liveness (heartbeat, session traffic, token delta; CPU is never the only signal), additive sourced signals `heartbeat-age` and `token-delta`, a durable per-delivery restart budget with `economics.restart` and `economics.budget-exhaustion` records, a classified fail-loud exhaustion path, and the configuration branch `lane.liveness-interval` / `lane.restart-budget`. The lane budget is per delivery and is not reused here.
- **Typed blocker and question channel (M1-S16, GH-230, merged `03edcdd7`)** — typed questions with a closed four-value type set, the closed `owner` / `coordinator` audience, the shared ranking, the payload-determinable `isCoordinatorPickup` predicate (rank 1, open, audience coordinator), the state-sourced `typed-questions` digest section, and the brief's real `blocker-questions` anchor. The channel makes the pickup predicate determinable; it wakes nothing and starts no iteration. M1-S23 is its enforcement arm.
- **Harness session port (M1-S11)** — spawn, deliver, resume, collect, classify, liveness, and list sessions for the opencode and Claude Code adapters. The port has no kill operation, and no OS-process port exists.
- **State layer (M0-S5, M1-S2)** — additive record kinds under the delivered artifact boundary with `STATE_SCHEMA_VERSION` unchanged, torn/unknown classification, fenced appends, and post-append coverage reads. The delivered state write fence is a **short-lived write lock**: `releaseFence` requires the in-process handle returned by `acquireFence`, and `recoverFence` only clears a lock whose age exceeds the injected staleness window. Coordinator single-instance ownership is therefore carried by append-only `coordinator.fence` lease records; the supervisor acquires the state write fence only for the duration of each individual append, and the delivered blocker append path (which acquires and releases its own fence) composes without collision.
- **Status and brief** — the status digest's `typed-questions` section is a read-only verified blocker read; the brief mirrors it into the `blocker-questions` anchor. Neither has a coordinator-supervision section, and this change does not add one.
- **Command and error conventions** — the command registry, the CommandResult envelope, the internal error table with a reserved two-segment fallback namespace, and the `{0,1,2}` exit projection.

The following are **not** in the tree and are not preempted by this change: a `daemon` command, `daemon install`, a control socket, lane supervision, a resident daemon process, and a `dispatch` command. The command audit ledger is delivered (M1-S22) but is deliberately not used as a digest-consumption signal here (DEC-4). The ticket's dependency list names only M1-S15 and M1-S16, so this story is intended to be deliverable without M1-S18.

**Users and current impact.** The owner (human) currently has no typed signal when the coordinator stalls or exhausts its restarts; the coordinator (CEO-style agent) has no managed lifecycle; the operator (private-fleet operator) cannot retire the bash stack because `ceo-loop.sh` remains the only coordinator supervisor; and lifecycle agents see coordinator questions wait until a human or a manual loop happens to run an iteration. The business impact is delivery reliability and cost: a silent coordinator loop burns tokens and stalls the queue, and the M4-S5 bash retirement is blocked until the last actor is managed.

### 2.2 Pain Points / Gaps

- **No typed coordinator lifecycle.** Join, resume, kill, and restart decisions are bash conditionals. Nothing records why a coordinator was resumed or killed, so the behavior cannot be verified, audited, or reconciled after a crash.
- **Stuck detection is not artifact-evidence based.** The bash probe watches session traffic and delivery health, not typed artifacts. It can miss a wedged coordinator whose process still looks alive, and it has no declared window or classified reason.
- **No kill seam.** The harness session port has spawn/deliver/resume/collect/classify/liveness/list but no kill-with-grace, and no OS-process port exists. A typed supervisor cannot terminate the coordinator tree without a new injected capability.
- **No distinct coordinator budget.** The delivered `lane.restart-budget` counts per delivery; the coordinator is a single long-lived session, not a delivery. Reusing the lane budget or the `economics/<workItemRef>` records would conflate two actors and two policies.
- **Exhaustion can be silent.** The bash loop counts restarts but has no typed owner escalation. A restarted-to-exhaustion coordinator can leave the fleet idle with no visible question.
- **The pickup contract is determinable but unenforced.** `isCoordinatorPickup` exists, but no actor consumes it to wake the coordinator. A top-of-digest coordinator question waits for the next manual iteration.
- **The supervisor regime is undefined.** The ticket requires the same supervisor regime as the future daemon (`daemon install` scope), but M1-S18 has not delivered the daemon, its unit, or its control socket. Without a shared regime contract, a coordinator supervisor would either duplicate the daemon's future installer or diverge from it.

## 3. PROBLEM STATEMENT

Because the only coordinator lifecycle mechanism is an untyped, repository-specific bash loop and the typed harness surface exposes no kill or process-lifecycle capability, the coordinator cannot be given the same managed lifecycle as lanes; it can stall or exhaust restarts silently, a top-of-digest coordinator question can wait indefinitely, and the bash stack cannot retire at M4-S5 without leaving one actor unmanaged.

**Who is affected.** The owner loses a reliable escalation surface; the coordinator loses crash-safe recovery and a bounded restart policy; the operator cannot complete the strangler migration; lifecycle agents wait on coordinator answers that no actor wakes.

## 4. GOALS

- **G-1** Deliver a typed coordinator supervision process and command family, distinct from the lane daemon and distinct from any delivery lane.
- **G-2** Record and apply a join-or-resume-or-spawn decision under context pressure: join a live session, resume a recoverable session, or spawn fresh when it is not recoverable.
- **G-3** Detect a stuck coordinator by artifact evidence within declared windows, never by CPU.
- **G-4** Kill the coordinator process tree with a grace period, and bound restarts with a durable, classified budget.
- **G-5** Escalate restart exhaustion loudly to the owner brief, never as a silent loop.
- **G-6** Wake the coordinator within one collection cycle when the M1-S16 rank-1 coordinator pickup predicate is satisfied, with one wake per question and consumption evidence.
- **G-7** Define and honor a shared supervisor-regime descriptor (state-dir scope, single-instance lease, unit identity, distinct budget), with the future `daemon install` wiring named as the M1-S18 seam.
- **G-8** Cover every `ceo-loop.sh` function with a traceable, testable typed outcome, and leave no silent lifecycle or exhaustion path.

### 4.1 Success Metrics / KPIs

| Metric | Target |
|---|---|
| Lifecycle actions with a durable decision record | 100% of join, resume, spawn, kill, and restart actions |
| Stuck-detection latency after an expectation | ≤ `coordinator.stuck-window` + one `coordinator.collection-interval` (default 630 s) |
| Wake latency after a question becomes rank 1 and coordinator-audience | ≤ one `coordinator.collection-interval` (default 30 s) |
| Exhaustion visible in the owner brief | 100% of exhaustion events, zero silent exhaustion |
| Restart budget durability across supervisor restart | 100%; no cached counter, no duplicate ordinal |
| CPU-based liveness signals in the decision path | 0 |
| Model calls in decision or render paths | 0 |
| `coordinator tick` p95 latency | ≤ 2 000 ms over the reference state store |
| `coordinator status` p95 latency | ≤ 1 000 ms over the reference state store |
| SC-M1-25 seed scenario coverage | 100% of its Given/When/Then assertions traced to ACs |
| `ceo-loop.sh` function-map coverage | 5 of 5 functions (context resume decision, stuck detection, kill-with-grace, restart budget, wake-on-question) |

### 4.2 Non-Goals

- **NG-1** No `daemon` command, control socket, lane supervision, startup reconciliation, or OS supervisor unit installer. That is M1-S18; this change defines the shared regime descriptor and the seam only.
- **NG-2** No `dispatch` command, spawn loop, or dual-run/handover work. That is M1-S9.
- **NG-3** No agent-prompt or lifecycle-instruction changes. That is M1-S20.
- **NG-4** No queue scheduling, merge execution, closeout mechanics, or status-collector redesign.
- **NG-5** No CPU-based liveness signal anywhere in stuck detection.
- **NG-6** No new model call in a deterministic decision or render path.
- **NG-7** No new typed-question type and no new brief anchor. The owner escalation reuses the delivered `decision-needed` type and the `blocker-questions` anchor.
- **NG-8** No reuse of `lane.restart-budget`, `lane.liveness-interval`, or the `economics/<workItemRef>` per-delivery record set for the coordinator budget.
- **NG-9** No untested systemd/launchd/Windows installer. OS autostart is an explicit tested gap naming M1-S18.
- **NG-10** No new status-digest section; coordinator state is visible through `coordinator status` and the owner question, not a redesigned digest.

## 5. FUNCTIONAL CAPABILITIES

| ID | Capability | Rationale |
|---|---|---|
| F-1 | Coordinator supervision process and command family (`start`, `stop`, `status`, `tick`) | Gives the coordinator a first-class managed process and a bounded one-shot test/operation surface without preempting the daemon command. |
| F-2 | Join-or-resume-or-spawn decision under context pressure, recorded and applied | Replaces the bash context-resume conditional with a durable, inspectable decision. |
| F-3 | Artifact-evidence stuck detection with declared windows and a prefill-safety corroborator | Detects a wedged coordinator from typed artifacts, not CPU, without killing a large working session. |
| F-4 | Kill the coordinator process tree with a grace period over an injected process-lifecycle port | Terminates a stuck coordinator safely and testably; keeps domain code pure. |
| F-5 | Durable coordinator restart budget, distinct from lane and delivery budgets | Bounds restarts without conflating the coordinator with a delivery lane. |
| F-6 | Classified, loud exhaustion escalation to the owner brief | Guarantees exhaustion reaches the owner as a typed question, never as a silent loop. |
| F-7 | Wake-on-typed-question using `isCoordinatorPickup`, one wake per question, with consumption evidence | Enforces the M1-S16 pickup contract within one collection cycle. |
| F-8 | Shared supervisor-regime descriptor and state-dir single-instance lease, distinct process and budget | Satisfies "same supervisor regime" at the descriptor/lease level while M1-S18 owns the OS unit. |
| F-9 | Coordinator observation surface: deterministic text and machine `data` | Makes decisions, restarts, stuck verdicts, wakes, and escalation inspectable. |
| F-10 | Closed vocabularies, config branch, state records, and error identities | Makes every outcome classified, testable, and traceable. |

### 5.1 Capability Details

**F-1 — Supervision process and command family.**
The command family is `coordinator` with four subcommands: `start [--foreground] [--fresh-budget]`, `stop`, `status [--live]`, and `tick`. Coordinator single-instance ownership is a durable **instance lease**, not a hold on the delivered state write fence. The lease is folded from the latest `coordinator.fence` record (`acquired`, `released`, `stale-takeover`, `stop-requested`) and carries `instanceId`, `coordinatorId`, `holder` (process identity: pid plus process start time), `pid`, `processStartTimeMs`, `supervisorMode` (`foreground` or `detached`), `externalUnit` (`absent`), and `previousHolder` / `fenceAgeMs` on a takeover. Every write — including each `coordinator.fence` record and the escalation question — acquires the delivered state write fence for that one append and releases it immediately; no write-fence handle is held across a cycle, and the supervisor never releases another process's handle. `start` acquires the instance lease by appending an `acquired` fence record and runs the supervision loop, either in the foreground (the shape a future supervisor unit will host) or as a detached process. On start, the supervisor rebuilds the coordinator session identity, budget epoch and count, active expectation, last wake dedupe, and escalation state from durable records; no fact that matters lives only in memory, and a start after a crash converges to the same state without duplicating work. `stop` is a request, not a remote release: it appends one `stop-requested` fence record and reports `requested=true`; a `stop-requested` record does not release the lease, so the instance remains the holder until it observes the request at the next cycle boundary, stops, and appends `released`. If the latest lease is `released` or stale, `stop` appends nothing and reports `not-running` at exit `0`. `status` reads durable state (and, with `--live`, the live process facts) and reports the instance from the latest lease record (`instanceId`, `pid`, `holder`, `startedAt` derived from the instance's `acquired` record, `supervisorMode`, `externalUnit`), coordinator session, last decision, restart count and bound, last stuck verdict with its reason, last wake, escalation state, and lease holder. `tick` performs exactly one bounded collection cycle and returns the same `data` shape; it acquires the instance lease for its cycle (an `acquired`/`released` pair around the cycle, or an equivalent atomic lease claim) so two ticks cannot race, and it is the testable one-shot surface and the shape a future unit or cron-like caller can drive. A `tick` while a live supervisor lease is `acquired` is refused with `coordinator.already-running` (AC-F8-1), so two evaluators can never race; an uncontended `tick` evaluates exactly one cycle (AC-F1-2). `start --fresh-budget` opens a new budget epoch after the owner chooses recovery, preserving the old history. It is a start-time option: a live supervisor must be stopped first, otherwise the start is refused with `coordinator.already-running` and a hint to stop first.

**F-2 — Join-or-resume-or-spawn decision.**
On every lifecycle evaluation the supervisor inspects the durable coordinator session record and chooses exactly one decision:

- `join-live` — the recorded session is alive. Attach and observe; consume no restart ordinal.
- `resume-context` — no live session, the prior session did not complete cleanly (it was interrupted or failed), it is resumable, its recorded context token count is known and below `coordinator.resume-context-limit`, and the **harness session port** declares and can perform resume. Resume is a harness-session capability consumed by the decision: when resume is undeclared or unavailable it is not a failure and raises no error identity — the decision instead selects `spawn-fresh` with reason `session-interrupted` and consumes one recovery ordinal (DEC-7). Resume without re-paying prefill; consume one restart ordinal.
- `spawn-fresh` — no live session, and either there is no prior session (`initial-start`), the prior session completed cleanly (`clean-iteration-end`), or the prior session did not complete cleanly but its context is at or above the limit, its context reading is unknown, it is not resumable, or resume is undeclared or unavailable (`context-pressure`, `context-unknown`, or `session-interrupted`). Spawn a fresh session; the three recovery reasons consume one restart ordinal, while `initial-start` and `clean-iteration-end` consume none.

The distinction matters: the restart budget counts **recoveries** (a resume or fresh spawn after an interruption, a stuck kill, or a context-forced replacement), not a first start or a planned iteration after a clean completion. The decision, the session identity, the context reading (or its explicit absence), the reason, the ordinal consumption, and the iteration identity are recorded before the action is applied. A killed coordinator therefore resumes or respawns per the last recorded decision, and already closed-out work (phase records, merge records, answers) remains untouched and is not re-executed.

**F-3 — Artifact-evidence stuck detection.**
An *iteration expectation* is created on a start, a wake, a restart, or an actionable digest change while the coordinator is live. At most one expectation is active per coordinator; a new trigger refreshes the window and records a new iteration record rather than opening a second expectation. The supervisor then evaluates three read-only evidence classes:

1. `digest-consumed` — the digest-input fingerprint advanced after the expectation **and** the coordinator session produced a **new turn**. The fingerprint is a bounded, opaque identity over (a) the state event-log cursor and (b) the count of open coordinator-audience questions. Both inputs are state-sourced: the fingerprint performs no tracker or CI read, no network call, and no new composition, and it contains no question text.
2. `merge` — a terminal merge record landed after the expectation.
3. `answer` — a blocker answer record landed after the expectation.

A **new turn** is sourced from the delivered harness liveness facts: a positive `token-delta` reading OR a positive `session-traffic` reading observed since the expectation. The process-lifecycle adapter maps the delivered liveness report's `token-delta` and `session-traffic` readings to the `newTurn` / `progressing` facts the domain consumes; an absent or unsupported reading maps to `unknown`, never to zero or stale.

Positive sourced session progress within `coordinator.progress-bound` (default 300 000 ms) is the **prefill-safety corroborator**: it vetoes a stuck verdict even when all three classes are stale, so a large working session is never killed. A `stuck` verdict requires the expectation's `coordinator.stuck-window` to elapse, no class to have advanced, no positive session progress within `coordinator.progress-bound`, and at least one class to be evaluable and stale. A verified-empty merge or answer store is a legitimate count of zero and contributes a `stale` class when no record landed after the expectation; only an unreadable or unknown store is `unknown`. An `unknown` class (for example, a harness that cannot source session progress) is disclosed but never fabricated as stale; an absent progress source is an `unknown` evidence class, never a failure identity, and absence of session signals alone never triggers a kill. If every class is unknown or a required store is unreadable, the verdict is `unevaluable` with reason `evidence-unevaluable`, and no kill or restart occurs. A persisted verdict is recorded **before** any kill as one `coordinator.stuck` append with `phase=verdict` and `killOutcome=not-attempted`; the kill outcome is a second append (F-4). The verdict and its bounded `key=value` evidence are recorded; CPU is never read.

**F-4 — Kill with grace.**
On a `stuck` verdict, the supervisor first appends the `coordinator.stuck` record with `phase=verdict` and `killOutcome=not-attempted` (F-3), then invokes an injected process-lifecycle port with the recorded session and process-tree handle. Before signalling, the port verifies that the recorded `pid` plus `processStartTimeMs` identity still matches the live process; on a mismatch it sends no signal, records `killOutcome=failed` with reason `identity-mismatch`, and returns `coordinator.session.kill-failed` at exit `2`. When the identity matches, the port sends TERM, waits `coordinator.kill-grace`, sends KILL if the tree is still alive, and returns `terminated`, `forced`, or `failed`. After the kill, the supervisor appends a second `coordinator.stuck` record with `phase=outcome`, the same `stuckId`, and the resulting `killOutcome` (`terminated`, `forced`, or `failed`); reads fold to the latest record per `stuckId` by `recordedAt`, then by ledger sequence. The target is always the recorded handle and tree; no name, pattern, or shell-interpolated kill exists. A failed kill is classified `coordinator.session.kill-failed` at exit `2`, never a silent success.

**F-5 — Durable coordinator restart budget.**
The coordinator budget is per **budget epoch** — a durable identity that survives supervisor restarts and is reset only by `start --fresh-budget` — and is stored in the coordinator restart namespace (`coordinator/<coordinatorId>`), not in `lane.restart-budget` and not in `economics/<workItemRef>`. The fold counts contiguous restart ordinals starting at `1` within the current epoch; a torn or gapped ordinal is unevaluable, never count `0`. A restart below `coordinator.restart-budget` appends one restart record with the next ordinal and proceeds. A restart attempt at or above the bound appends no restart record and starts no replacement; the stuck response's kill, if one already happened, is still recorded, and the command returns `coordinator.restart-budget-exhausted` at exit `1` with the history reference and runs the escalation path. `start --fresh-budget` opens a new epoch with count `0` after an owner decision; the old epoch and its escalation remain in history.

**F-6 — Classified, loud exhaustion escalation.**
When exhaustion is observed, the supervisor publishes exactly one owner-audience `decision-needed` question through the delivered blocker channel. The question carries the coordinator identity and budget epoch as its `ref`, the restart count and bound, the durable history reference, and the declared recovery options (`restart-fresh-budget`, `park-owner-review`). Because the brief's `blocker-questions` anchor already mirrors every open typed question, the escalation appears in the owner brief without a new anchor or question type. To make "never silent" robust under the normal eight-question cap, the digest `typed-questions` section and the brief `blocker-questions` anchor keep one **reserved escalation slot** for an open owner-audience `decision-needed` question that satisfies one pure payload predicate: `type === "decision-needed"` AND `audience === "owner"` AND `lane === "coordinator"` AND `ref` matching the coordinator epoch identity shape `<coordinatorId>#<budgetEpochId>` (exactly one `#`, both sides non-empty). The predicate is payload-only: it adds no coordinator-state read to the digest or the brief and does not change the eight-question bound. The reserved question renders **first** in both the digest `typed-questions` section and the brief `blocker-questions` anchor, even when the cap is reached. The other questions follow in normal rank order, up to seven, and the lowest-ranked question is the one displaced and counted as omitted. The slot lives **inside** the declared rendered-question bound: while an exhaustion escalation is pending, at most seven other questions render after it, so the bound stays at eight rendered questions and no ninth question is added. The render position is deterministic and assertable by index; no other ordering rule changes. This is a bounded rendering rule, not a new section or anchor. Because the supervisor holds no lifetime state write fence, publishing the escalation through the delivered blocker append path composes without a lock collision: the supervisor acquires the state write fence only for each of its own appends, and the blocker append acquires its own. The escalation is idempotent by `(coordinatorId, budgetEpochId)`: before publishing, the supervisor re-reads the verified blocker ledger and reuses an existing open owner question carrying the same coordinator ref; it publishes only when none exists. The terminal escalation record lands only after the question lands; if the question cannot be published, the supervisor returns `coordinator.escalation.publish-failed` at exit `2` with consequence `unknown`, and `coordinator status` still derives the escalation state from the restart and escalation records. A repeated tick in the exhausted state is an idempotent success with the existing escalation; it never duplicates the question or the terminal record and never returns exit `0` without an escalation receipt.

**F-7 — Wake-on-typed-question.**
On every collection cycle the supervisor performs one verified read of the blocker ledger, reuses that read for the `answer` evidence class, and applies the delivered shared ranking. It evaluates the delivered `isCoordinatorPickup` predicate strictly: the head of the ranked open set must be `rank: 1`, open (an absent `status` counts as open, matching the delivered predicate), and `audience: coordinator`. If true and the question has not already been woken, the supervisor triggers the next coordinator iteration — a live wake, a resume, or a spawn per F-2 — and, **only when the wake succeeds**, appends one durable wake record carrying the question id, rank, `askedAt` (question-lifetime identity), iteration identity, and outcome `woken`. One wake is issued per question lifetime: only a persisted `woken` record consumes that one-wake budget (dedupe on coordinator identity, question id, and the persisted `askedAt`). `already-woken` is a no-op. If the head is not an open coordinator question, the outcome is `no-pickup`. If the question is answered between ranking and wake, the outcome is `answered-before-wake` and no wake is issued. `delivery-failed`, `answered-before-wake`, and `no-pickup` are **tick results**, not durable records: they append nothing, so the next cycle can retry without ever creating a duplicate wake record. A new question that becomes rank 1 after the previous one is answered wakes normally. Wake latency is bounded by one `coordinator.collection-interval`, asserted in v1 as the next `tick` after the question qualifies (NFR-8).

**F-8 — Shared supervisor regime and single-instance lease.**
The coordinator supervisor declares a regime descriptor: state-dir scope, a single-instance lease scoped to the state dir, a unit identity derived from the state dir and the coordinator identity, a distinct process kind, and a distinct restart-budget store. The descriptor is shared in shape with the future `daemon install` (M1-S18); the daemon's own values are not invented here. The instance lease is folded from the latest `coordinator.fence` record (EVT-7): `acquired`, `released`, `stale-takeover`, or `stop-requested`, with `instanceId`, `holder`, `pid`, `processStartTimeMs`, `supervisorMode`, `externalUnit`, and any `previousHolder` / `fenceAgeMs`. Each record is its own append under the delivered state write fence; the supervisor holds no write fence between appends. A second supervisor on the same state dir is refused with `coordinator.already-running` at exit `2`. A stale lease is taken over when the recorded holder is no longer alive (the process port's `alive(handle)` reports absent) or the lease is older than two `coordinator.collection-interval`s; the new start appends `stale-takeover` carrying the new `holder`, the `previousHolder`, and the observed `fenceAgeMs`, then appends `acquired`. Stale takeover uses the process port's liveness check plus lease age; it does not call the delivered `recoverFence` and does not depend on the state write fence's staleness window. A different state dir is independent. No OS autostart installer is shipped: the gap is declared and tested as naming M1-S18. `supervisorMode` is exactly `foreground` or `detached`, and `externalUnit` is exactly `absent` in v1; status renders both fields. A detached `start` records `supervisorMode=detached` and `externalUnit=absent`; it is a manual mode, not a claim of OS-level supervision. The foreground start is the shape the future unit hosts.

**F-9 — Observation surface.**
`coordinator status` and every other subcommand return a bounded machine `data` payload (`delivery.coordinator.v1`) with the `instance` (folded from the latest lease record: `instanceId`, `pid`, `holder`, `startedAt`, `supervisorMode`, `externalUnit`), regime, session, last decision, restart count and bound, last stuck verdict with its reason and evidence, last wake, escalation state, and degradation list. Human output is deterministic, ANSI-free, and bounded. `--live` reports live process facts; when they are unavailable it declares `unknown` or `degraded` rather than fabricating them.

**F-10 — Closed vocabularies, config, state, and errors.**
The lifecycle decisions, restart reasons, stuck reasons, stuck verdicts, stuck record phases, evidence classes, wake outcomes, fence actions, supervisor modes, escalation states, config keys, and error identities are closed sets declared as data. The `coordinator` config branch validates six keys with declared defaults and domains; no bound or default literal lives in the decision code. The state records are additive under the delivered artifact boundary with `STATE_SCHEMA_VERSION` unchanged; no migration or derived document is created. The error table gains a `coordinator` domain kind with the declared rows; the reserved two-segment fallback namespace is unchanged, the two two-segment `coordinator.*` identities (`coordinator.already-running`, `coordinator.restart-budget-exhausted`) join the exact `RESERVED_TWO_SEGMENT_CODES` allowlist with no `coordinator.*` wildcard and no generic pattern widening, the other four coordinator identities are already three-segment, and every non-zero exit projects from the table. Capability ownership is split and never overloaded: a harness that cannot or will not spawn reuses the delivered `harness.capability.gap` / `harness.spawn.refused` at exit `1`; an undeclared or unavailable resume is a decision input (`spawn-fresh`, reason `session-interrupted`), not an error; an absent progress source is an `unknown` evidence class, not an error; and only a missing process-port alive or kill-with-grace capability is `coordinator.process.capability-gap` at exit `2`.

## 6. USER & SYSTEM FLOWS

**Flow 1 — Supervisor start and first lifecycle decision.**
```
operator/unit -> coordinator start --foreground
  -> acquire instance lease (append coordinator.fence action=acquired; or refuse: coordinator.already-running)
  -> read coordinator session + restart records + config
  -> decide join-live | resume-context | spawn-fresh
  -> record coordinator.iteration
  -> apply the decision (attach / resume / spawn)
  -> status state=running
```

**Flow 2 — Killed mid-iteration.**
```
coordinator session killed (no completion record)
  -> next tick sees the session not alive
  -> resume-context when context < limit and resumable
     OR spawn-fresh when context >= limit / unknown / not resumable
  -> append coordinator.restart with the next ordinal and classified reason
  -> already closed-out phase/merge/answer artifacts remain; no re-execution
```

**Flow 3 — Stuck coordinator.**
```
expectation issued (start/wake/restart/actionable digest change)
  -> tick evaluates digest-consumed / merge / answer + session progress
  -> no class advanced, no positive progress within progress-bound, window elapsed
  -> append coordinator.stuck phase=verdict, killOutcome=not-attempted, reason and bounded evidence
  -> verify pid + processStartTimeMs identity
  -> TERM, wait kill-grace, KILL if needed
  -> append coordinator.stuck phase=outcome with the same stuckId (terminated | forced | failed)
  -> budget check -> coordinator.restart + resume/spawn
```

**Flow 4 — Restart exhaustion.**
```
restart count reaches coordinator.restart-budget
  -> no spawn/kill; coordinator.restart-budget-exhausted (exit 1)
  -> publish one owner-audience decision-needed question
  -> append coordinator.exhaustion (terminal escalation receipt)
  -> brief blocker-questions anchor renders the question first in its section
  -> later ticks: state=exhausted-escalated, no duplicate question
  -> owner chooses restart-fresh-budget -> coordinator start --fresh-budget
```

**Flow 5 — Coordinator question wake.**
```
blocker ledger changes; a new question becomes rank 1, open, coordinator
  -> tick ranks the verified ledger
  -> isCoordinatorPickup == true and question not already woken
  -> wake live session, or resume/spawn per F-2
  -> append coordinator.wake (woken, questionId, askedAt, iterationId)
  -> next iteration answers as data; answer record is the consumption evidence
```

**Flow 6 — Daemon absent (the M1-S18 seam).**
```
M1-S18 not delivered
  -> coordinator supervision runs as its own process/command family
  -> shared regime descriptor declares the daemon-install seam
  -> OS autostart is a declared tested gap naming M1-S18
  -> no daemon command, socket, lane supervision, or installer is created
```

**Flow 7 — Stop request from another process.**
```
operator -> coordinator stop (separate process)
  -> read latest coordinator.fence lease
  -> lease acquired and holder alive: append coordinator.fence action=stop-requested
     -> report requested=true, released=false, exit 0
     -> live supervisor observes the request at the next cycle boundary
     -> supervisor stops and appends coordinator.fence action=released
  -> lease released or stale: append nothing, report not-running, exit 0
  -> stop never releases another process's state write fence handle
```

## 7. SCOPE & BOUNDARIES

### 7.1 In Scope

- A new `coordinator` command family: `start [--foreground] [--fresh-budget]`, `stop`, `status [--live]`, `tick`.
- A pure coordinator-supervision decision domain: lifecycle decision, context recoverability, artifact-evidence stuck verdict, restart admission, wake evaluation, and escalation projection.
- An injected process-lifecycle port with spawn/attach, alive, kill-with-grace, and sourced-progress capability declarations, implemented beside the harness adapters and faked in tests; harness session resume is consumed from the delivered harness session port.
- Additive coordinator state records: iteration, restart, stuck, exhaustion, wake, and fence; durable reads and appends under the delivered artifact boundary.
- A `coordinator` config branch with six keys and declared defaults.
- Coordinator error identities and a `coordinator` domain kind in the internal error table.
- A shared supervisor-regime descriptor and a state-dir single-instance lease carried by `coordinator.fence` records.
- Owner-brief escalation by publishing an owner-audience `decision-needed` question, idempotently and loudly.
- Wake-on-typed-question using the delivered `isCoordinatorPickup` predicate and blocker ledger.
- Deterministic text and `data` output, `{0,1,2}` exit projection, bounded evidence, and no secret/prompt/transcript material.
- Tests and documentation for the new surface, including SC-M1-25 reconciliation.

### 7.2 Out of Scope

- [OUT] A `daemon` command, daemon control socket, lane supervision, startup reconciliation, or any OS supervisor unit installer (M1-S18).
- [OUT] A `dispatch` command, spawn loop, dual-run evidence, or per-repo handover (M1-S9).
- [OUT] Agent-prompt or lifecycle-instruction changes (M1-S20).
- [OUT] Queue scheduling, merge execution, closeout mechanics, or status-collector redesign.
- [OUT] A new status-digest section, a new brief anchor, or a new typed-question type.
- [OUT] CPU-based liveness, CPU sampling, or CPU thresholds.
- [OUT] Any model call in a deterministic decision or render path.
- [OUT] Reuse of `lane.restart-budget`, `lane.liveness-interval`, or `economics/<workItemRef>` for the coordinator.
- [OUT] Multi-coordinator, multi-host, or remote supervision.
- [OUT] Automatic application of the owner's escalation answer; that is the future daemon/queue path (M1-S18) or the manual `--fresh-budget` operator action.

### 7.3 Deferred / Maybe-Later

- Registering the coordinator supervision loop under the future `daemon install` user-level unit (M1-S18).
- A coordinator section in the status digest or board once the daemon and board surfaces exist (M1-S18/M2-S4).
- Treating an audit-ledger digest invocation as a consumption signal (available now; deliberately unused in v1 because an invocation is not comprehension and a wedged coordinator can re-run the command).
- Adaptive stuck windows by phase or work type.
- Remote or container-attached coordinator supervision.
- Automatic consumption of the owner's exhaustion answer by the daemon.

## 8. INTERFACES & INTEGRATION CONTRACTS

### 8.1 REST / HTTP Endpoints

N/A. This change adds a CLI surface and state records only; it adds no HTTP or REST endpoint and no network listener.

### 8.2 Events / Messages

| ID | Record / message | Contract |
|---|---|---|
| EVT-1 | `coordinator.iteration` | One durable record per recorded lifecycle decision or expectation. Carries `iterationId`, `coordinatorId`, `trigger` (`start`, `collection`, `wake`, `stuck-restart`), `decision` (`join-live`, `resume-context`, `spawn-fresh`, or `none` when the record captures an expectation without a lifecycle change), `reason` (closed), `sessionId` (nullable), `contextTokens` (number or null), a bounded digest-input fingerprint (state event-log cursor plus open coordinator-audience question count; state-sourced, no tracker/CI/network read), `expectationWindowMs`, and `recordedAt`. |
| EVT-2 | `coordinator.restart` | One durable record per admitted restart. Carries `restartId` (`<coordinatorId>#<budgetEpochId>#<ordinal>`), `coordinatorId`, `budgetEpochId`, `sessionId`, `ordinal`, a closed `reason`, `previousSessionId` when applicable, and `recordedAt`. |
| EVT-3 | `coordinator.stuck` | One or two durable records per `stuck` or `unevaluable` verdict, in two phases carrying the same `stuckId`: `phase=verdict` is appended before any kill with `killOutcome=not-attempted`; `phase=outcome` is appended after the kill with the resulting `killOutcome` (`terminated`, `forced`, or `failed`). Carries `stuckId`, `coordinatorId`, `iterationId`, `verdict`, `phase`, a closed `reason` (`stuck-artifact-evidence` when `verdict=stuck`; `evidence-unevaluable` when `verdict=unevaluable`), a bounded `key=value` evidence corpus, `killOutcome`, `killFailureReason` (`identity-mismatch` or null), and `recordedAt`. Reads fold deterministically to the latest record per `stuckId` by `recordedAt`, then ledger sequence; a replay appends nothing. The stuck `reason` is a distinct field from the restart `reason` carried by `coordinator.restart`. |
| EVT-4 | `coordinator.exhaustion` | The single terminal escalation receipt per coordinator epoch. Carries `exhaustionId` (`<coordinatorId>#<budgetEpochId>`), `coordinatorId`, `budgetEpochId`, `restarts`, `historyRef`, `escalationQuestionId`, the declared `options`, `terminal: true`, and `recordedAt`. |
| EVT-5 | `coordinator.wake` | One durable record per **successful** wake (`outcome` = `woken`) for a pickup predicate. Carries `wakeId`, `coordinatorId`, `questionId`, `questionRank`, `askedAt` (question-lifetime identity), `outcome`, `iterationId`, and `recordedAt`. `already-woken`, `answered-before-wake`, `delivery-failed`, and `no-pickup` are tick results that append no durable wake record; only `woken` consumes the one-wake-per-question lifetime. |
| EVT-6 | Owner escalation question | Reuses the delivered blocker question message: type `decision-needed`, audience `owner`, `ref` = `<coordinatorId>#<budgetEpochId>`, `lane` = `coordinator`, bounded question text, and the declared recovery options. The reserved slot identifies it from the payload alone — `type`, `audience`, `lane`, and the `<coordinatorId>#<budgetEpochId>` ref shape (exactly one `#`, both sides non-empty) — so the digest and brief read no coordinator state for it. The digest `typed-questions` section and the brief `blocker-questions` anchor render the reserved question **first**; the other questions follow in normal rank order, up to seven, and the lowest-ranked question is displaced and counted as omitted, within the declared eight-question bound. No new message type is introduced. |
| EVT-7 | `coordinator.fence` | One durable record per instance-lease action; this is the append-only carrier of coordinator single-instance ownership and the takeover evidence, not a hold on the state write fence. Carries `fenceId`, `instanceId`, `coordinatorId`, `action` (`acquired`, `released`, `stale-takeover`, `stop-requested`), `holder` (pid plus process start time), `pid`, `processStartTimeMs`, `supervisorMode` (`foreground` or `detached`), `externalUnit` (`absent`), `previousHolder` (nullable), `fenceAgeMs` (nullable), and `recordedAt`. The current lease is folded from the latest record, and each append acquires the delivered state write fence only for that append; the instance's `startedAt` is the `recordedAt` of its `acquired` record. Reads validate it like every other coordinator record. No separate instance record exists. |

Record kinds are additive under `delivery.state.v1`; the schema version does not change. The record-kind set stays closed at six (EVT-1 through EVT-5 and EVT-7): `coordinator.fence` carries the instance lease and `coordinator.stuck` carries both phases under one `stuckId`. Every coordinator append — fence records, stuck phases, restart, exhaustion, wake, and the escalation question — acquires the delivered state write fence for that one append and releases it; no supervisor holds a write-fence handle across a cycle. A `no-pickup`, `already-woken`, `answered-before-wake`, or `delivery-failed` outcome is a tick result, not a persisted record, so quiet cycles and failed wake attempts do not grow the log and a retry cannot duplicate records.

### 8.3 Data Model Impact

| ID | Element | Description |
|---|---|---|
| DM-1 | Coordinator lifecycle decision | The closed decision kind (`join-live`, `resume-context`, `spawn-fresh`), its reason, the session identity, the context reading or explicit absence, and the iteration identity. |
| DM-2 | Coordinator restart record | A durable restart event in the coordinator namespace, with a contiguous ordinal, a closed reason, and a budget epoch. |
| DM-3 | Coordinator stuck record | A two-phase record (`phase=verdict` then `phase=outcome`) for a durable `stuck` or `unevaluable` verdict, sharing one `stuckId`, with a closed reason (`stuck-artifact-evidence` or `evidence-unevaluable`), bounded evidence, a kill outcome, and an optional `identity-mismatch` kill-failure reason. Reads fold to the latest record per `stuckId`. |
| DM-4 | Coordinator exhaustion record | The terminal escalation receipt linking the restart count, the history reference, and the owner question id. |
| DM-5 | Coordinator wake record | A durable record for a successful `woken` attempt with the question id, rank, `askedAt` question-lifetime identity, and iteration identity; non-woken outcomes are tick results and are not persisted. |
| DM-6 | Coordinator config branch | Six keys: `stuck-window`, `kill-grace`, `restart-budget`, `resume-context-limit`, `collection-interval`, `progress-bound`. |
| DM-7 | Process-lifecycle port and capability declaration | Injected spawn/attach, alive, kill-with-grace, and sourced-progress facts; harness session resume is consumed from the delivered harness session port; a missing process-port alive or kill capability is a declared gap. |
| DM-8 | Supervisor-regime descriptor | State-dir scope, single-instance lease, unit identity, process kind, distinct budget store, `supervisorMode` (`foreground` or `detached`), `externalUnit` (`absent`), and the S18 daemon-install seam. |
| DM-9 | Closed vocabularies | Decision kinds, restart reasons, stuck reasons, stuck verdicts, stuck record phases, evidence classes, wake outcomes, fence actions, supervisor modes, escalation states, config keys, and error identities. |
| DM-10 | Error-table integration | A `coordinator` domain kind and its declared rows, projecting `{0,1,2}` exits. |
| DM-11 | Coordinator fence record | The append-only instance lease record: acquisition, release, stale takeover, or stop request, naming the instance identity, holder (pid + process start time), previous holder, fence age, supervisor mode, external unit, and time. The latest record is the instance identity; no separate instance record exists. |

### 8.4 External Integrations

- **Harness adapters (opencode, Claude Code).** The process-lifecycle implementation resolves a stable session handle and process identity from the harness adapter and the OS process facts. Capability ownership is explicit: a harness that cannot or will not spawn uses the delivered `harness.capability.gap` / `harness.spawn.refused` identity at exit `1`; an undeclared or unavailable resume selects `spawn-fresh` with reason `session-interrupted` (no error, one recovery ordinal); an absent progress source is an `unknown` evidence class and never a failure; and a missing process-port alive or kill-with-grace capability is `coordinator.process.capability-gap` at exit `2` with no destructive action. The process-lifecycle adapter maps the delivered harness liveness report's `token-delta` and `session-traffic` readings to the `newTurn` / `progressing` facts; an absent or unsupported reading maps to `unknown`, never to zero or false. TDR-0013 is being amended via `@decision-advisor` to match this four-way split exactly, so an implementer reading the TDR cannot build the opposite ownership.
- **Operating-system process signals.** TERM then KILL for the coordinator process tree, with the Windows equivalent behind the same port. Before TERM, the port verifies the recorded `pid` plus `processStartTimeMs` identity against the live process; on a mismatch it sends no signal and reports `identity-mismatch`. No network, no shell interpolation, and no credential value is involved.
- **No other external integration.** The change reads the delivered state layer, config, blocker ledger, and economics/liveness facts locally.

### 8.5 Backward Compatibility

- **Additive only.** Existing commands, envelopes, exit codes, config keys, state records, digest sections, and brief anchors are unchanged except for the declared reserved escalation slot in `typed-questions`/`blocker-questions`. The `coordinator` family is new.
- **No daemon dependency.** The command works with no daemon, no control socket, and no OS unit. `--live` degrades to state-only facts and declares the degradation.
- **No lane/economics collision.** The coordinator budget and records use a distinct namespace; the delivered lane and economics surfaces are untouched.
- **No schema bump.** Coordinator records are additive within `delivery.state.v1`; no migration, backfill, or derived document is created.
- **Bash retirement unchanged.** `ceo-loop.sh` remains in place until M4-S5; this change supplies its typed replacement but does not retire or deprecate it.

## 9. NON-FUNCTIONAL REQUIREMENTS (NFRs)

| ID | Requirement | Threshold |
|---|---|---|
| NFR-1 | Determinism of decisions and rendered output | 100% identical decision and `data` for identical state, config, and injected facts; no ambient clock, randomness, or environment read outside injected ports. |
| NFR-2 | No CPU signal | 0 CPU reads or CPU-derived thresholds in the stuck-detection or lifecycle decision path. |
| NFR-3 | No model call in a deterministic path | 0 model calls in any decision, status, or render path. |
| NFR-4 | Bounded reads and records | At most one verified read per store per tick; at most 8 ranked questions rendered; at most 64 KiB machine `data` and at most 32 human lines per command. |
| NFR-5 | Performance | `coordinator tick` p95 ≤ 2 000 ms; `coordinator status` p95 ≤ 1 000 ms over the reference state store; `start` p95 ≤ 2 000 ms excluding harness spawn time. |
| NFR-6 | Idempotency | Repeated `tick`, wake, restart, or exhaustion evaluation with unchanged state appends no duplicate record and performs no duplicate destructive action (100%). |
| NFR-7 | Durability | Restart count, budget epoch, exhaustion receipt, and wake dedupe survive a supervisor crash and restart (100%). |
| NFR-8 | Wake latency | ≤ one `coordinator.collection-interval` (default 30 000 ms) after a question becomes rank 1, open, and coordinator-audience, provided the caller's tick cadence is at or faster than that interval; the supervisor's own loop ticks at the interval. In v1 asserted as the next `tick` after the question qualifies, so a caller ticking slower than the interval is caller-bounded, not a policy violation. |
| NFR-9 | Stuck-detection latency | ≤ `coordinator.stuck-window` + one `coordinator.collection-interval` (default 630 000 ms) after an expectation is issued, provided the caller ticks at or faster than the interval; the supervisor's own loop ticks at the interval. In v1 asserted as the next `tick` after the window elapses; a slower caller is caller-bounded. |
| NFR-10 | Kill grace | TERM then KILL after `coordinator.kill-grace` (default 20 000 ms); a forced kill is recorded as `forced`, never silently reported as `terminated`. |
| NFR-11 | Privacy and secret safety | 0 prompt, transcript, secret value, or credential value in any coordinator record or error evidence; evidence is bounded `key=value` at ≤ 512 UTF-8 bytes and carries counts, identities, and references only. |
| NFR-12 | Exit taxonomy | Every outcome exits only `0`, `1`, or `2`; every non-zero outcome resolves to one declared error-table identity. |
| NFR-13 | No silent outcome | 0 exit-`0` results for an unverified state, an unlanded escalation, or a destructive action on unevaluable state; every skipped or degraded path is reported. |
| NFR-14 | Security of the kill path | The kill target is the recorded session/process handle and tree only; no name/pattern-based kill and no shell interpolation. Before TERM the recorded `pid` plus `processStartTimeMs` identity is verified against the live process, and a mismatch sends no signal. A kill requires the current instance lease; the kill-outcome append takes the state write fence for that append only. |
| NFR-15 | Compatibility | 0 changes to existing command output, envelope shape, exit codes, config keys, digest sections, or brief anchors, except the declared reserved escalation slot in `typed-questions`/`blocker-questions`. |

**Collection-cycle semantics (v1).** This change ships `tick` and a foreground loop, not a resident scheduler. NFR-8 and NFR-9 are therefore asserted as: the next `tick` after the qualifying condition — the question becoming rank 1 for NFR-8, the window elapsing for NFR-9 — produces exactly one wake or exactly one verdict. The supervisor's own loop ticks at `coordinator.collection-interval`; a caller that ticks slower than the configured interval is caller-bounded and does not violate the policy. No resident scheduler and no wall-clock timer is required, and the policy numbers are unchanged; an injected clock drives the fixtures.

## 10. TELEMETRY & OBSERVABILITY REQUIREMENTS

- **Durable evidence.** The six coordinator record kinds (EVT-1 through EVT-5 and EVT-7) are the telemetry. They carry decisions, restart ordinals, two-phase stuck verdicts with their reason and bounded evidence, exhaustion receipts, successful wake records, and instance-lease acquisitions/releases/takeovers/stop requests. No separate metrics store is introduced.
- **`coordinator status` fields.** Instance identity from the latest lease (`instanceId`, `pid`, `holder`, `startedAt`, `supervisorMode`, `externalUnit`), uptime (live or `unknown`), state-dir scope, lease holder and last lease action (with previous holder and fence age on a takeover), coordinator session identity and liveness, last decision and reason, restart count and bound, history reference, last stuck verdict, reason and evidence, last wake outcome and question, escalation state and question id, and a bounded degradation list.
- **Owner escalation.** The exhaustion question is the owner-facing signal. The digest `typed-questions` section and the brief `blocker-questions` anchor render it **first** in their respective sections within the declared eight-question bound, so it is visible even at the normal cap; the other questions follow in rank order, up to seven, and the lowest-ranked is displaced and counted as omitted. The slot is selected by the payload-only predicate (type, audience, lane, ref shape) and adds no read. No new alerting channel is added.
- **Operational queries.** An operator can answer "is the coordinator running, what did it decide, how many restarts remain, was it stuck, was it woken, and is it exhausted?" from `coordinator status` alone.
- **No sensitive content.** Records and evidence carry counts, identities, references, and closed vocabulary values only.

## 11. RISKS & MITIGATIONS

| ID | Risk | Impact | Probability | Mitigation | Residual Risk |
|---|---|---|---|---|---|
| RSK-1 | A large working coordinator session is killed as stuck | H | M | The prefill-safety corroborator vetoes a stuck verdict on positive sourced progress within `coordinator.progress-bound`; the kill requires the full stuck window plus no progress; kill grace preserves a final chance to finish. | M |
| RSK-2 | A quiet coordinator is not detected because no expectation exists | M | M | Expectations are created only on actionable state (start, wake, restart, actionable digest change); a quiet world is `idle`, not `stuck`, by design. | L |
| RSK-3 | Process-tree kill fails on Windows or a detached child | H | M | The port declares kill-with-grace as a capability; a failed kill is `coordinator.session.kill-failed` exit `2` with consequence `unknown`, never a silent success. | M |
| RSK-4 | The coordinator supervisor diverges from the future daemon regime | H | H | A shared regime descriptor is defined; the daemon-install wiring is the named M1-S18 seam; OS autostart is an explicit tested gap, not an invented installer. | M |
| RSK-5 | The owner escalation lands but is not noticed | M | M | The question is a priority-class-1 `decision-needed` owner question rendered by the existing brief anchor; `coordinator status` also reports exhaustion. | L |
| RSK-6 | A restart loop persists under the distinct budget | H | L | The budget is durable and distinct; exhaustion stops restarts and publishes one owner question; repeated ticks are idempotent. | L |
| RSK-7 | Two supervisors contend for the same state dir | M | M | A state-dir single-instance lease; a second start is `coordinator.already-running`; a stale lease is taken over by holder liveness plus lease age, with evidence. | L |
| RSK-8 | The harness lacks spawn, resume, or progress capability, or the host cannot kill | M | H | Capability ownership is split and declared: a harness spawn refusal or gap is `harness.capability.gap`/`harness.spawn.refused` exit `1`; an undeclared resume selects `spawn-fresh session-interrupted` with no error; an absent progress source is an `unknown` class and never a failure or a kill; only a missing process-port alive/kill-with-grace capability is `coordinator.process.capability-gap` exit `2`, with no destructive action. | M |
| RSK-9 | Torn or unreadable coordinator state causes a wrong kill | H | L | A torn/gapped ordinal or unreadable store is `unevaluable`; no kill or restart occurs; the delivered state identity and exit are returned. | L |
| RSK-10 | Duplicate or thundering-herd wakes | M | M | One wake per question lifetime, deduped on coordinator id + question id + persisted `askedAt`; `already-woken` is a no-op; the next wake requires a new top question. | L |
| RSK-11 | Config defaults diverge from the `ceo-loop.sh` baseline | L | M | Defaults are declared, documented, and justified in DEC-10; all are policy data with no code literals. | L |
| RSK-12 | The owner-brief escalation question is crowded out of the rendered list | M | L | The digest and brief render the reserved escalation question first in its section within the eight-question bound; `decision-needed` also ranks in priority class 1; `coordinator status` independently reports exhaustion. | L |
| RSK-13 | PID reuse causes the supervisor to signal an unrelated process | H | L | Before TERM the process port compares the recorded `pid` plus `processStartTimeMs` identity with the live process; a mismatch sends no signal, records `killOutcome=failed` with reason `identity-mismatch`, and returns `coordinator.session.kill-failed` exit `2`. | L |

## 12. ASSUMPTIONS

- M1-S15 (GH-235, merged `c4f6cd63`) and M1-S16 (GH-230, merged `03edcdd7`) are delivered and stable; their sourced progress signals, ranking, pickup predicate, and brief anchor are consumed as current contracts.
- The state layer supports additive record kinds under `delivery.state.v1` without a schema bump or migration. Its write fence is a short-lived, handle-scoped lock (`releaseFence` requires the in-process handle; `recoverFence` only clears an age-stale lock), so coordinator single-instance ownership uses append-only `coordinator.fence` lease records and requires no change to the delivered state contracts.
- The harness adapter can expose a stable session handle and process identity sufficient for alive, resume, and kill; the delivered liveness report's `token-delta` and `session-traffic` readings are the new-turn source; where it cannot, a spawn gap is `harness.capability.gap`/`harness.spawn.refused` at exit `1`, an undeclared resume selects `spawn-fresh`, an absent progress source is `unknown`, and only a missing process-port alive/kill capability is `coordinator.process.capability-gap`.
- The blocker ledger is the single escalation surface and the brief renders open owner-audience questions through the existing `blocker-questions` anchor.
- One coordinator exists per state-dir scope; multi-coordinator and multi-host supervision are out of scope.
- The supervisor runs as the same OS user as the coordinator; no privilege escalation is needed.
- POSIX process signals are available on the reference host; the Windows equivalent is behind the same port.
- The operator reads `coordinator status` and the owner reads the brief; no additional notification channel is assumed.
- The future `daemon install` can host this process later; this change does not assume it exists.

## 13. DEPENDENCIES

| Direction | Item | Notes |
|---|---|---|
| Depends on | M1-S15 session lifecycle economics (GH-235, merged `c4f6cd63`) | Sourced progress signals (`heartbeat-age`, `token-delta`), the three liveness kinds, the restart-budget/record pattern, and the delivered `token-delta` / `session-traffic` liveness report are consumed; the lane budget itself is not reused. |
| Depends on | M1-S16 typed blocker channel (GH-230, merged `03edcdd7`) | `isCoordinatorPickup` (an absent status counts as open), the shared ranking, the blocker ledger, the owner/coordinator audience, and the brief `blocker-questions` anchor. |
| Depends on | State artifact boundary and state validation (M0-S5, M1-S2) | Additive coordinator record kinds, torn/unknown classification, and the delivered short-lived state write fence used per append. The digest-input fingerprint is state-sourced (event-log cursor plus open coordinator-audience question count) and adds no tracker, CI, or network dependency; no change to the state contracts is required. |
| Depends on | Harness session port and adapters (M1-S11) | Session identity and resume/collect/liveness facts; the new process-lifecycle port sits beside them. |
| Depends on | Config catalog and defaults (M0-S4) | The `coordinator` branch and its validation. |
| Depends on | Error table and CLI command conventions (M0-S3) | New `coordinator` identities and the `{0,1,2}` projection. |
| Blocks | M4-S5 bash stack retirement | `ceo-loop.sh` cannot retire until coordinator supervision exists; this is its typed replacement. |
| Interfaces with | M1-S18 resident dispatch daemon (future) | The daemon-install seam and the shared supervisor-regime descriptor; no daemon command or installer is created here. |
| Interfaces with | M1-S9 dispatch (future) | No contract dependency; the coordinator supervision process is distinct from the dispatch loop. |
| Interfaces with | M1-S20 agent integration (future) | Prompt changes may teach the coordinator to call the new command; this change does not modify prompts. |
| Interfaces with | M1-S22 audit ledger (delivered) | An audit invocation is available as an additive corroborator but is deliberately not treated as digest consumption in v1; an invocation is not comprehension and a wedged coordinator can re-run the command. |
| External | opencode and Claude Code harness process/session interfaces | Process identity, resume, and progress facts. |
| External | OS process signals and process-tree enumeration | TERM/KILL with grace; Windows equivalent behind the port. |

## 14. OPEN QUESTIONS

None. All six clarify-scope findings and the remaining non-obvious choices are recorded as DEC-1 through DEC-13. No product-scope decision remains open. The six specification gaps returned by the test plan (GAP-1..GAP-6) and the error-allowlist correction (GAP-T7) were resolved in v1.1; the twelve blocking and seven advisory DoR iteration-1 findings (RF-01..RF-12, A1/A2/A3/A6) are resolved in v1.2 as recorded in §25. The test plan, plan, pm-notes, and TDRs are updated separately by their owners.

| ID | Question | Context | Status |
|---|---|---|---|
| — | None | All findings resolved by DEC-1 through DEC-13 and the v1.2 contract pins in §25 | Resolved |

## 15. DECISION LOG

| ID | Decision | Rationale | Date |
|---|---|---|---|
| DEC-1 **(TDR)** | Deliver coordinator supervision as its own process and `coordinator` command family plus a shared supervisor-regime contract; record `daemon install` wiring as the M1-S18 seam and create no `daemon` command. | M1-S18 is not delivered; duplicating or guessing its installer would create two incompatible regimes. The story is explicitly deliverable with only M1-S15 and M1-S16. | 2026-11-07 |
| DEC-2 | Add a top-level `coordinator` family with `start [--foreground] [--fresh-budget]`, `stop`, `status [--live]`, and `tick`; keep `supervise` reserved for M2-S2. The family name is an **addition**, not a rename: ODR-0003 DC-4 requires a superseding record only for a rename, so no naming decision record is created; the name is recorded by adding the `coordinator` row to the command registry and satisfying ODR-0003 DC-1's naming rules. | The ticket needs a command surface; `supervise` already names the M2-S2 battery, and `daemon` belongs to M1-S18. `tick` is the bounded one-shot/test mode. | 2026-11-07 |
| DEC-3 **(TDR)** | Add an injected process/session-lifecycle port (spawn/attach, alive, kill-with-grace, sourced progress) in contracts, implement it in adapters, and fake it in tests; the domain stays pure. Harness session resume is consumed from the delivered harness session port rather than redeclared as a process capability, and only the port's alive or kill-with-grace gaps are `coordinator.process.capability-gap`. TDR-0013 DC-3 is being amended via `@decision-advisor` to match this four-way split exactly so the governing record cannot be read as the opposite. | The delivered harness port has no kill and no process identity; calling OS APIs from domain code would break purity and testability. | 2026-11-07 |
| DEC-4 **(TDR)** | Artifact-evidence stuck detection uses three read-only classes (`digest-consumed`, `merge`, `answer`) over a bounded digest-input fingerprint, plus sourced session progress as a prefill-safety corroborator; the fingerprint is state-sourced (state event-log cursor plus open coordinator-audience question count) with no tracker, CI, or network read; a "new turn" is a positive `token-delta` or `session-traffic` reading and the corroborator bound is `coordinator.progress-bound`; absence of session signals makes the digest class `unknown` and never by itself triggers a kill; all-unknown or unreadable is `unevaluable`; CPU is never read. | Status is read-only and exposes no consumption record; the audit ledger records invocations, not comprehension, so "digest consumed" needs a typed observable proxy. The corroborator prevents killing a large working session. | 2026-11-07 |
| DEC-5 **(TDR)** | Escalate exhaustion by publishing exactly one owner-audience `decision-needed` question with coordinator-specific recovery options, using the existing blocker channel and brief anchor, and reserve one escalation slot in the digest `typed-questions` section and the brief `blocker-questions` anchor for that question, identified by a payload-only predicate (`decision-needed` + audience `owner` + lane `coordinator` + `<coordinatorId>#<budgetEpochId>` ref shape) that adds no coordinator-state read; publish failure is `coordinator.escalation.publish-failed` exit `2`. | A new question type or anchor would widen the contract unnecessarily. The reserved slot is the smallest contract change that makes "never silent" true under the normal eight-question cap; the widest impact is the digest/brief cap and ordering rule. | 2026-11-07 |
| DEC-6 **(TDR)** | Define a shared supervisor-regime descriptor (state-dir scope, single-instance lease carried by append-only `coordinator.fence` records, unit identity, distinct process kind, distinct budget, `supervisorMode` exactly `foreground` or `detached`, `externalUnit` exactly `absent`) and share its shape with the future `daemon install`; ship the lease and foreground loop, and declare OS autostart as a tested gap naming M1-S18. The delivered state write fence is used only for the duration of one append, never held for the supervisor's lifetime. | Satisfies "same regime" at the descriptor/lease level without shipping an untested installer or preempting M1-S18, and does not depend on a state-fence capability the delivered port does not provide. | 2026-11-07 |
| DEC-7 **(TDR)** | Context decision: `join-live` when the session is alive (no ordinal); `resume-context` when a resumable session's known context is below `coordinator.resume-context-limit` (one recovery ordinal); `spawn-fresh` when the context is at/above the limit, unknown, absent, or resume is undeclared or unavailable, with reason `context-pressure`, `context-unknown`, or `session-interrupted` (one recovery ordinal) or `initial-start` / `clean-iteration-end` (no ordinal). Resume is a harness-session capability; its absence is a decision input, not an error, and raises no error identity. | Replaces the bash conditional with a durable decision and a safe fail-closed choice when context cannot be proven recoverable; the budget counts recoveries, not normal iteration starts. | 2026-11-07 |
| DEC-8 | The coordinator restart budget is per budget epoch, durable, and stored in `coordinator/<coordinatorId>`, distinct from `lane.restart-budget` and `economics/<workItemRef>`; exhaustion writes one terminal escalation receipt and is idempotent. | The coordinator is one long-lived session, not a per-delivery lane; distinct semantics require distinct records and policy. | 2026-11-07 |
| DEC-9 **(TDR)** | Wake policy is strictly the delivered `isCoordinatorPickup` predicate (rank 1, open — an absent status counts as open — audience coordinator), with one wake per question lifetime, dedupe on coordinator id + question id + the persisted `askedAt` carried by the wake record, and closed outcomes `woken`, `already-woken`, `answered-before-wake`, `delivery-failed`; `no-pickup` is a tick result, not a record. Only a persisted `woken` record consumes the one-wake budget; `already-woken` is a no-op, and `delivery-failed`, `answered-before-wake`, and `no-pickup` persist nothing, so a retry cannot create duplicate records. | Enforces the M1-S16 pickup contract without inventing a second pickup rule or a wake storm, and makes retry-after-failure consistent with one-wake dedupe; `askedAt` is persisted so a reopened store can apply the declared dedupe key. | 2026-11-07 |
| DEC-10 | Config defaults are `coordinator.stuck-window` 600 000 ms, `coordinator.kill-grace` 20 000 ms, `coordinator.restart-budget` 10, `coordinator.resume-context-limit` 100 000 tokens, `coordinator.collection-interval` 30 000 ms, and `coordinator.progress-bound` 300 000 ms; all six are policy data with no code literals. The coordinator collection interval is distinct from the future `daemon.heartbeat-cycle`. | Mirrors the `ceo-loop.sh` behavioral baseline and keeps the values inspectable and tunable; the progress bound is the liveness veto window for the corroborator. | 2026-11-07 |
| DEC-11 | Add a `coordinator` domain kind and six error identities (`coordinator.already-running`, `coordinator.restart-budget-exhausted`, `coordinator.process.capability-gap`, `coordinator.session.kill-failed`, `coordinator.escalation.publish-failed`, `coordinator.wake.delivery-failed`); the two two-segment codes (`coordinator.already-running`, `coordinator.restart-budget-exhausted`) join `RESERVED_TWO_SEGMENT_CODES` in both the sync check and the structure test (set 22→24) with no `coordinator.*` wildcard and no generic pattern widening, while the other four are already three-segment; reuse delivered `state.*` identities for unevaluable records; every exit is in `{0,1,2}`. Capability ownership is fixed: harness **resume** undeclared or unavailable is not a failure — it selects `spawn-fresh` reason `session-interrupted` with one recovery ordinal and no error identity; harness **spawn** impossible or refused uses the delivered `harness.capability.gap` / `harness.spawn.refused` at exit `1`; process-port **alive** or **kill-with-grace** capability absent is `coordinator.process.capability-gap` at exit `2` with no destructive action; **progress** sourcing absent is an `unknown` evidence class, never a failure and never by itself a kill. TDR-0013 is being amended via `@decision-advisor` to match this four-way split. | Keeps failures classified and traceable without inventing a parallel error model, and removes the three-way ambiguity over which layer owns a resume gap. | 2026-11-07 |
| DEC-12 | Coordinator records are additive under `delivery.state.v1` with `STATE_SCHEMA_VERSION` unchanged and no migration; record kinds live under the `coordinator.` prefix, distinct from `economics.*`. | Follows the delivered additive-record pattern and avoids a schema break for a new, self-contained actor. | 2026-11-07 |
| DEC-13 | Do not add a coordinator status-digest section, a new brief anchor, or a new question type; coordinator state is visible through `coordinator status` and the owner question. Do not change queue, merge, closeout, or status-collector behavior. | Keeps the change inside the ticket and avoids preempting the daemon, board, and status expansions. | 2026-11-07 |

**Precedent-setting decisions requiring a TDR:** `TDR-0013` captures DEC-1, DEC-3, DEC-6, DEC-7, and DEC-9 (supervision architecture, shared supervisor regime and S18 seam, injected process-lifecycle port, recorded lifecycle decision and restart accounting, predicate-bound wake). `TDR-0014` captures DEC-4 and DEC-5 (artifact-evidence stuck detection and owner-brief exhaustion escalation). TDR-0013 is being amended via `@decision-advisor` to match the four-way capability split and the lease-based single-instance contract; TDR-0014's resolved acceptance-checklist items are being closed by `@decision-advisor`. This specification edits no TDR. DEC-2 is a registry-only naming-surface addition (ODR-0003 DC-4 requires a record only for a rename; no naming record is created); DEC-8, DEC-10, DEC-11, DEC-12, and DEC-13 are implementation policy inside the ticket.

## 16. AFFECTED COMPONENTS (HIGH-LEVEL)

| Component | Impact |
|---|---|
| Core contracts tier | New `coordinator` vocabulary (decisions, restart and stuck reasons, verdicts, stuck record phases, evidence classes, wake outcomes, fence actions, supervisor modes, escalation states, config keys) and a new process-lifecycle port/capability declaration. |
| Core domain tier | New pure supervision decisions: context recoverability, lifecycle decision, artifact-evidence stuck verdict, restart admission, wake evaluation, and escalation projection. |
| Core state tier | New additive coordinator record kinds under the delivered artifact boundary: iteration, restart, two-phase stuck, exhaustion, wake, and the `coordinator.fence` instance lease. Every append takes the delivered short-lived state write fence only for that append. |
| Core config tier | New `coordinator` branch with six keys and validation, plus shipped defaults. |
| Adapter tier | New process-lifecycle implementation beside the opencode and Claude Code harness adapters; capability-gap declarations; mapping of the delivered liveness report's `token-delta` / `session-traffic` to the new-turn fact. |
| CLI command layer | New `coordinator` command family, command registry entry, and command page. |
| Error table | New `coordinator` domain kind and six declared rows (table 99→105 entries); the two two-segment identities (`coordinator.already-running`, `coordinator.restart-budget-exhausted`) join the reserved two-segment allowlist in both owning gate files (set 22→24), while the other four are already three-segment; no wildcard and no generic pattern widening. |
| Status and brief | One bounded rendering rule: the reserved escalation question renders first in `typed-questions` and `blocker-questions`, selected by a payload-only predicate (`decision-needed` + `owner` + lane `coordinator` + `<coordinatorId>#<budgetEpochId>` ref shape) that adds no read; up to seven other questions follow in rank order and the lowest-ranked is displaced and counted as omitted. No new section or anchor. |
| Session lifecycle economics | Consumer only; no change to lane semantics or `economics.*` records. The coordinator has its own budget and signal use. |
| Harness adapters | Additive process-lifecycle capability; the delivered session port vocabulary is unchanged. |
| Documentation | New coordinator-supervision feature spec; updates to the economics, blockers, brief, status-digest, harness-adapter specs, the CLI registry/man-page, and decision records. |
| Bash stack | No change in this delivery; `ceo-loop.sh` remains until M4-S5. |

**Documentation impact.** The following current-truth documentation must change with the implementation:

- A new feature specification, `doc/spec/features/feature-coordinator-supervision.md`, becomes the current-truth home for the command family, decisions, records (including the `coordinator.fence` instance lease with its four actions, the two-phase `coordinator.stuck` record, and the closed stuck reason), the six config keys, error identities, and the supervisor regime.
- `doc/spec/features/feature-session-lifecycle-economics.md` gains a consumer/boundary note: coordinator supervision consumes the sourced progress signals and the delivered `token-delta` / `session-traffic` liveness report, and follows the restart-record pattern, but owns a distinct budget; lane semantics are unchanged.
- `doc/spec/features/feature-blockers.md` records that M1-S23 is the enforcement arm of the pickup predicate and consumes answer records; an absent question status counts as open, and the question vocabulary, ranking, audience routing, and command grammar are unchanged.
- `doc/spec/features/feature-brief.md` records the reserved escalation rule: an open owner-audience coordinator-exhaustion question, identified by the payload-only predicate (type `decision-needed`, audience `owner`, lane `coordinator`, `<coordinatorId>#<budgetEpochId>` ref shape), renders **first** in the existing `blocker-questions` anchor even at the normal cap; up to seven other questions follow in rank order and the lowest-ranked is displaced and counted as omitted; no new anchor, surface, or read is added.
- `doc/spec/features/feature-status-digest.md` records the same reserved escalation rule and the same payload-only predicate in the `typed-questions` section, including the render-first position and the displaced-lowest-ranked omission count; the section remains read-only and no new digest section or read is added.
- `doc/spec/features/feature-harness-adapters.md` records the additive process-lifecycle port and its capability declarations beside the unchanged harness session port, including the ownership split: spawn gap/refusal (`harness.capability.gap`/`harness.spawn.refused`, exit 1), undeclared resume (`spawn-fresh`, no error), absent progress (`unknown` class), process-port alive/kill gap (`coordinator.process.capability-gap`, exit 2), and the adapter mapping of `token-delta` / `session-traffic` to the new-turn fact.
- `doc/spec/features/feature-result-contract.md` gains the `coordinator` domain kind and its six documented rows (table 99→105), and records the exact two-code `RESERVED_TWO_SEGMENT_CODES` allowlist addition (`coordinator.already-running`, `coordinator.restart-budget-exhausted`; set 22→24), noting the other four coordinator identities are three-segment, with no `coordinator.*` wildcard and no generic pattern widening.
- `doc/planning/oss-tooling/cli-command-registry.md` gains the `coordinator` family row and updates the `ceo-loop.sh` strangler row to name `coordinator` supervision as the delivered replacement for the loop's actual function.
- `doc/planning/oss-tooling/milestones/m1/contracts.md` and `doc/planning/oss-tooling/milestones/m1/man-page.md` gain the coordinator command contract and usage lines.
- `TDR-0013` captures DEC-1, DEC-3, DEC-6, DEC-7, and DEC-9 (supervision architecture, shared supervisor regime and S18 seam, injected process-lifecycle port, recorded lifecycle decision and restart accounting, predicate-bound wake). It is being amended via `@decision-advisor` to match the four-way capability split and the lease-based single-instance contract. `TDR-0014` captures DEC-4 and DEC-5 (artifact-evidence stuck detection and owner-brief exhaustion escalation); its resolved acceptance-checklist items are being closed by `@decision-advisor`. DEC-2 is a registry-only family-name addition governed by ODR-0003 DC-1/DC-4; no naming record is created. This spec edits no TDR.
- The documentation index is updated by the documentation sync step for the new feature spec and decision records.

## 17. ACCEPTANCE CRITERIA

### 17.1 Supervision process and command family

| ID | Criterion | Linked |
|---|---|---|
| AC-F1-1 | **Given** no supervisor is running in the state dir, **when** `coordinator start --foreground` runs, **then** it acquires the instance lease by appending one `coordinator.fence` record with `action=acquired`, `instanceId`, `holder` (pid + process start time), `supervisorMode`, and `externalUnit=absent`, reports `state=running`, and `status` reports that instance; a second start returns `coordinator.already-running` at exit `2` with the holder named; no state write fence is held beyond the lease append. | F-1, F-8, DM-11, NFR-12 |
| AC-F1-2 | **Given** an uncontended state dir — coordinator state may exist but no live supervisor holds the instance lease — **when** `coordinator tick` runs, **then** it acquires the instance lease for its cycle (an `acquired`/`released` pair or an equivalent atomic claim), performs exactly one bounded collection cycle, and returns `delivery.coordinator.v1` `data` with the instance, decision, wake, stuck, restart, and escalation fields, and it does not start a background loop; a tick that contends with a live lease is the refused case in AC-F8-1. | F-1, F-9, DM-11, NFR-4 |
| AC-F1-3 | **Given** a live supervisor running in another process, **when** `coordinator stop` runs, **then** it appends one `coordinator.fence` record with `action=stop-requested` and reports `requested=true` without claiming `released=true`; the live supervisor observes the request at the next cycle boundary, stops, and appends `action=released`. When the latest lease is `released` or stale, `stop` reports `not-running` at exit `0` and appends nothing. `stop` never releases another process's state write fence handle. | F-1, F-8, DM-11, NFR-6 |
| AC-F1-4 | **Given** a supervisor instance, **when** `coordinator status` reports it, **then** the instance identity is folded from the latest `coordinator.fence` lease record — `instanceId`, `pid`, `holder`, `startedAt` (the instance's `acquired` record time), `supervisorMode` (`foreground` or `detached`), and `externalUnit` (`absent`) — and no separate instance record kind or payload exists. | F-1, F-8, F-9, DM-11 |
| AC-F9-1 | **Given** a running, exhausted, or stopped supervisor, **when** `coordinator status [--live]` runs, **then** it reports the instance from the latest lease record (`instanceId`, `pid`, `holder`, `startedAt` = the instance's `acquired` record time, `supervisorMode`, `externalUnit`), session, last decision, restart count and bound, last stuck verdict, reason and evidence, last wake, escalation state, and lease holder (with the last lease action) in deterministic text and `data`; `--live` declares `unknown` or `degraded` when live process facts are unavailable rather than fabricating them. | F-9, F-1, DM-11, NFR-13 |

### 17.2 Join-or-resume-or-spawn decision

| ID | Criterion | Linked |
|---|---|---|
| AC-F2-1 | **Given** a live coordinator session, **when** the lifecycle decision evaluates, **then** it records `join-live`, consumes no restart ordinal, and spawns or resumes nothing. | F-2, DEC-7 |
| AC-F2-2 | **Given** no live session, a prior session that did not complete cleanly, and a resumable session whose known context is below `coordinator.resume-context-limit` with a declared harness resume capability, **when** the lifecycle decision evaluates, **then** it records `resume-context`, consumes exactly one restart ordinal, and resumes without re-paying prefill. | F-2, DM-1, DM-2 |
| AC-F2-3 | **Given** no live session and context at or above the limit, an unknown context reading, a previously interrupted session that is not resumable, or a session whose harness resume is undeclared or unavailable, **when** the lifecycle decision evaluates, **then** it records `spawn-fresh` with reason `context-pressure`, `context-unknown`, or `session-interrupted` respectively, consumes exactly one restart ordinal, and raises no error identity for the resume absence. | F-2, DM-1, DM-2, DEC-7 |
| AC-F2-4 | **Given** a coordinator session killed mid-iteration with closed-out phase, merge, or answer artifacts already recorded, **when** the next tick evaluates, **then** it resumes or respawns per the recorded decision, and the closed-out artifacts remain present and are not re-executed. | F-2, F-5, DM-1, DM-2 |
| AC-F2-5 | **Given** a recorded lifecycle decision, **when** the supervisor restarts and `coordinator status` is read, **then** the decision and its restart ordinal are still reported from durable state. | F-2, F-9, NFR-7 |
| AC-F2-6 | **Given** no prior session (a first start) or a prior session that completed cleanly and is being started for a new iteration, **when** the lifecycle decision evaluates, **then** it records `spawn-fresh` with reason `initial-start` or `clean-iteration-end` and consumes no restart ordinal. | F-2, F-5, DM-1, DM-2 |

### 17.3 Artifact-evidence stuck detection

| ID | Criterion | Linked |
|---|---|---|
| AC-F3-1 | **Given** an iteration expectation and no digest-consumed, merge, or answer evidence within `coordinator.stuck-window`, and no positive session progress within `coordinator.progress-bound`, **when** the tick evaluates, **then** it records a `stuck` verdict with reason `stuck-artifact-evidence` in the `coordinator.stuck` record's closed `reason` field as an append with `phase=verdict`, `killOutcome=not-attempted`, and the bounded evidence corpus; the digest fingerprint inputs are the state event-log cursor and the open coordinator-audience question count only. | F-3, DM-3, EVT-3, DEC-4 |
| AC-F3-2 | **Given** positive sourced session progress within `coordinator.progress-bound` — a positive `token-delta` or `session-traffic` reading since the expectation (a large working session) — **when** no artifact has landed yet, **then** the verdict is not `stuck` and no kill is attempted. | F-3, NFR-2, DEC-4 |
| AC-F3-3 | **Given** session progress signals absent or unsupported, **when** the digest class is `unknown` and the merge or answer class is stale, **then** the stuck verdict is based on the stale artifact class and the absent progress source is an `unknown` evidence class, never a failure identity; the adapter maps an absent `token-delta` or `session-traffic` reading to `unknown`, never to zero; **given** every class is `unknown` or the required store is unreadable, **then** the verdict is `unevaluable` with reason `evidence-unevaluable`, no kill or restart occurs, and the command exits `2` with the state identity; absence of session signals alone never produces a kill. | F-3, DM-3, NFR-13, DEC-4 |
| AC-F3-4 | **Given** identical state, config, and injected facts, **when** the stuck evaluation runs twice, **then** the verdict and evidence are identical, and no CPU signal is read. | F-3, NFR-1, NFR-2 |

### 17.4 Kill with grace

| ID | Criterion | Linked |
|---|---|---|
| AC-F4-1 | **Given** a `stuck` verdict, **when** the kill runs, **then** the supervisor has already appended `phase=verdict`; the port verifies the recorded `pid` plus `processStartTimeMs` identity, the recorded coordinator process tree receives TERM, the supervisor waits `coordinator.kill-grace`, sends KILL if the tree is still alive, and appends `phase=outcome` with the same `stuckId` and `killOutcome` `terminated` or `forced`. | F-4, DM-3, EVT-3, NFR-10, NFR-14 |
| AC-F4-2 | **Given** the kill cannot terminate the tree, **when** the grace elapses, **then** the supervisor appends `phase=outcome` with the same `stuckId` and `killOutcome=failed`, returns `coordinator.session.kill-failed` at exit `2` with consequence `unknown`, and does not claim success or retry forever. | F-4, DM-3, EVT-3, NFR-12, NFR-13 |
| AC-F4-3 | **Given** a kill target, **when** the port is invoked, **then** the target is the recorded session and process-tree handle; no name- or pattern-based kill and no shell interpolation occurs. | F-4, DM-7, NFR-14 |
| AC-F4-4 | **Given** a recorded process identity (`pid` plus `processStartTimeMs`) that no longer matches the live process, **when** the kill is attempted, **then** the port sends no signal, appends `phase=outcome` with the same `stuckId`, `killOutcome=failed`, and `killFailureReason=identity-mismatch`, returns `coordinator.session.kill-failed` at exit `2`, and never signals the reused pid. | F-4, DM-3, DM-7, NFR-14 |

### 17.5 Restart budget

| ID | Criterion | Linked |
|---|---|---|
| AC-F5-1 | **Given** a coordinator restart, **when** it is recorded, **then** it lands in the coordinator restart namespace (`coordinator/<coordinatorId>`), not in `lane.restart-budget` or `economics/<workItemRef>`, and the lane and economics records are unchanged. | F-5, DM-2, DM-6 |
| AC-F5-2 | **Given** a restart count below `coordinator.restart-budget`, **when** a resume or spawn is needed, **then** one restart record is appended with the next contiguous ordinal and the action proceeds. | F-5, DM-2, NFR-6 |
| AC-F5-3 | **Given** a restart count at or above the bound, **when** a resume or spawn is attempted, **then** no replacement is started, the command returns `coordinator.restart-budget-exhausted` at exit `1` with the history reference, and the escalation path runs; a kill already performed by the stuck response is recorded and not undone. | F-5, F-6, DM-2, DM-4 |
| AC-F5-4 | **Given** a supervisor crash and restart, **when** the next tick reads the restart records, **then** the count and bound are unchanged and a replayed ordinal appends nothing. | F-5, NFR-6, NFR-7 |
| AC-F5-5 | **Given** an exhausted coordinator and an owner decision to restart with a fresh budget, **when** `coordinator start --fresh-budget` runs, **then** a new budget epoch starts at count `0` and the old epoch and its escalation remain in history. | F-5, DM-2, DM-4 |

### 17.6 Exhaustion escalation

| ID | Criterion | Linked |
|---|---|---|
| AC-F6-1 | **Given** restart exhaustion, **when** the tick escalates, **then** exactly one owner-audience `decision-needed` question is published with the coordinator identity and budget epoch as `ref`, the restart count and bound, the history reference, and the declared options; the digest `typed-questions` section and the brief `blocker-questions` anchor render that question **first** in their respective sections even when the normal open-question cap is reached, the other questions follow in normal rank order up to seven, and the lowest-ranked question is displaced and counted as omitted within the declared eight-question bound; the slot is detected from the payload alone by the predicate `type=decision-needed` AND `audience=owner` AND `lane=coordinator` AND `ref` = `<coordinatorId>#<budgetEpochId>` (exactly one `#`, both sides non-empty), so neither renderer reads coordinator state. | F-6, EVT-6, DM-4, DEC-5 |
| AC-F6-2 | **Given** the escalation question cannot be published, **when** the tick runs, **then** it returns `coordinator.escalation.publish-failed` at exit `2` with consequence `unknown`, and `coordinator status` reports the `exhausted-escalation-failed` state; no exit-`0` result is returned without an escalation receipt. | F-6, DM-4, NFR-12, NFR-13 |
| AC-F6-3 | **Given** exhaustion has already been escalated, **when** the tick runs again, **then** it reuses the existing open owner question for the same coordinator-and-epoch ref, creates no second question or terminal record, returns an idempotent `exhausted-escalated` at exit `0`, and leaves the original question open. | F-6, DM-4, NFR-6 |

### 17.7 Wake-on-typed-question

| ID | Criterion | Linked |
|---|---|---|
| AC-F7-1 | **Given** a newly rank-1, open, coordinator-audience question, **when** the next `tick` runs, **then** the coordinator is woken (live wake, resume, or spawn) and one wake record with outcome `woken`, the question id, and the persisted `askedAt` is appended, satisfying the one-collection-interval bound of NFR-8. | F-7, EVT-5, NFR-8, DEC-9 |
| AC-F7-2 | **Given** the same question is still rank 1 and already woken, **when** the next cycle runs, **then** no second wake is issued, no additional durable wake record is appended, and the outcome is `already-woken`; dedupe uses coordinator id, question id, and the persisted `askedAt`. | F-7, EVT-5, NFR-6 |
| AC-F7-3 | **Given** rank 1 is an owner-audience question, a question whose `status` is explicitly non-open, or there is no question, **when** the cycle runs, **then** no coordinator wake is issued, the outcome is `no-pickup`, and no durable wake record is appended; an absent `status` counts as open, matching the delivered `isCoordinatorPickup`, so a rank-1 absent-status coordinator-audience head is a pickup and not `no-pickup`. | F-7, DEC-9 |
| AC-F7-4 | **Given** the rank-1 question is answered between ranking and wake, **when** the wake evaluates, **then** no wake is issued, no durable wake record is appended (the outcome is a tick result), the outcome is `answered-before-wake`, and the next cycle re-evaluates. | F-7, EVT-5 |
| AC-F7-5 | **Given** the wake delivery fails, **when** the cycle runs, **then** `coordinator.wake.delivery-failed` is returned at exit `2`, no durable wake record is appended, and the next `tick` retries; only a later successful wake appends the single `woken` record, so the retry cannot create duplicate records. | F-7, EVT-5, NFR-6, NFR-12 |
| AC-F7-6 | **Given** a new question replaces the answered one as rank 1, **when** the cycle runs, **then** a new wake is issued; the one-wake rule is per question, not per coordinator. | F-7, EVT-5, DEC-9 |

### 17.8 Supervisor regime and single-instance lease

| ID | Criterion | Linked |
|---|---|---|
| AC-F8-1 | **Given** a live instance lease in a state dir, **when** a second `start` or a `tick` targets the same state dir, **then** it is refused with `coordinator.already-running` at exit `2` with the holder named; the refused invocation appends no lease record and performs no cycle; a different state dir is independent. | F-1, F-8, DM-8, DM-11, NFR-14 |
| AC-F8-2 | **Given** the supervisor-regime descriptor, **when** `coordinator status` renders it, **then** it declares state-dir scope, single-instance lease, unit identity, distinct process kind, distinct budget, `supervisorMode` (`foreground` or `detached`), `externalUnit` (`absent`), and the M1-S18 daemon-install seam; no OS autostart installer is shipped and the gap is declared and tested naming M1-S18. | F-8, DM-8, DEC-1, DEC-6 |
| AC-F8-3 | **Given** the latest `coordinator.fence` lease is `acquired` but the recorded holder is no longer alive (the process port's `alive(handle)` reports absent) or the lease is older than two `coordinator.collection-interval`s, **when** a new start runs, **then** it takes over rather than refusing forever: it appends `action=stale-takeover` with the new `holder`, the `previousHolder`, and the observed `fenceAgeMs`, then appends `action=acquired` with the new instance; it does not call `recoverFence` and does not require the state write fence to be age-stale; the takeover evidence is readable from durable state and from `coordinator status`. | F-8, DM-11, EVT-7, NFR-6 |

### 17.9 Configuration, state, and error contracts

| ID | Criterion | Linked |
|---|---|---|
| AC-F10-1 | **Given** the `coordinator` config branch, **when** it is resolved, **then** all six keys are validated with the declared defaults and domains; unknown keys fail `config.key.unknown`, wrong types or domains fail `config.value.invalid`, and no default or bound literal is used in the decision code. | F-10, DM-6, NFR-1 |
| AC-F10-2 | **Given** the internal error table, **when** it is validated, **then** the `coordinator` domain kind and its six declared identities resolve with category, retryability, consequence, remediation hint, and `{0,1,2}` exit projection; the two two-segment codes `coordinator.already-running` and `coordinator.restart-budget-exhausted` are present in `RESERVED_TWO_SEGMENT_CODES` in both `scripts/checks/error-table-sync.ts` and `tests/structure/error-table.test.ts`, taking the set from 22 to 24, while the other four coordinator identities are three-segment and need no allowlist entry, with no `coordinator.*` wildcard and no generic two-segment widening; the documented table grows from 99 to 105 rows and both gate files agree. | F-10, DM-10, NFR-12 |
| AC-F10-3 | **Given** unreadable, torn, or unknown coordinator records, **when** a decision runs, **then** it is `unevaluable` with reason `evidence-unevaluable` where a verdict is recorded, no kill or restart occurs, and the delivered state identity and exit are returned; a torn or gapped restart ordinal is never read as count `0`. | F-10, DM-2, DM-3, NFR-13 |
| AC-F10-4 | **Given** the process port declares no alive capability or no kill-with-grace capability, **when** the supervisor needs it, **then** it returns `coordinator.process.capability-gap` at exit `2` and performs no destructive action; this identity does not cover harness resume, spawn, or progress — an undeclared or unavailable harness resume selects `spawn-fresh` reason `session-interrupted` with no error (AC-F2-3), a harness that cannot or will not spawn returns the delivered `harness.capability.gap` / `harness.spawn.refused` at exit `1`, and an absent progress source is an `unknown` evidence class (AC-F3-3). | F-10, DM-7, NFR-13, DEC-11 |
| AC-F10-5 | **Given** the `ceo-loop.sh` function map, **when** the delivered test plan runs, **then** context resume decision, artifact-evidence stuck detection, kill-with-grace, restart budget, and wake-on-question each have at least one passing AC trace in AC-F2-*, AC-F3-*, AC-F4-*, AC-F5-*, and AC-F7-*. | F-1, F-2, F-3, F-4, F-5, F-7 |

### 17.10 Non-functional acceptance

| ID | Criterion | Linked |
|---|---|---|
| AC-NFR-1 | **Given** unchanged state, **when** `coordinator tick` runs twice, **then** the second run appends no duplicate restart, stuck, wake, or exhaustion record and performs no destructive action. | NFR-6, F-1 |
| AC-NFR-2 | **Given** any coordinator record or error evidence, **when** it is inspected, **then** it contains no prompt, transcript, secret value, or credential value; evidence is bounded `key=value` at ≤ 512 UTF-8 bytes. | NFR-11, F-10 |
| AC-NFR-3 | **Given** the decision and render paths, **when** they run, **then** they perform no model call and read no CPU signal. | NFR-2, NFR-3 |
| AC-NFR-4 | **Given** the reference state store, **when** `coordinator tick` and `coordinator status` run, **then** their p95 latencies are within 2 000 ms and 1 000 ms respectively, and output stays within the declared bounds. | NFR-4, NFR-5 |

Each criterion states the observable it requires (lease records, two-phase stuck records, rendered index, config values, error identities, and payload fields) so the test plan and delivery plan can place the corresponding proof; this specification does not prescribe plan phases, test file locations, or implementation steps.

## 18. ROLLOUT & CHANGE MANAGEMENT (HIGH-LEVEL)

- **Delivery shape.** One change on `feat/GH-241/coordinator-supervision`, one pull request targeting `main-tools`. The change is additive: contracts, domain, state, config, adapters, CLI, tests, and docs.
- **No migration.** No schema bump, no state transformation, no backfill. Coordinator records are new keys under the existing state schema.
- **No behavioral flip.** Existing commands, digest sections, brief anchors, and lane/economics behavior are unchanged. The new family is opt-in: an operator or a future unit runs `coordinator start`.
- **Bash retirement unchanged.** `ceo-loop.sh` remains until M4-S5. This change supplies the typed replacement and the strangler evidence; it does not remove or wrap the bash entry point.
- **Adoption path.** Start with `coordinator tick` in tests and one-shot operation, then `coordinator start --foreground` under the future M1-S18 unit. The regime descriptor is the handoff point.
- **Rollback.** Stop the supervisor (`coordinator stop`), stop invoking the command, and leave the additive records in place. No data loss and no migration reversal is needed.
- **Communication.** The new command family, config keys, and owner escalation are documented in the coordinator-supervision feature spec, the CLI registry, the command page, and the operator runbook.

## 19. DATA MIGRATION / SEEDING (IF APPLICABLE)

N/A. The change adds new record kinds and a new config branch; it does not transform, backfill, or seed existing state. `STATE_SCHEMA_VERSION` stays `delivery.state.v1`. A fresh state dir starts with a verified-empty coordinator record set, which is a valid state and not an error.

## 20. PRIVACY / COMPLIANCE REVIEW

- **No prompt or transcript content.** Coordinator records carry identities, counts, closed vocabulary values, timestamps, and references only. No prompt, message, transcript, question body beyond the bounded owner question text, or model output is persisted in coordinator records.
- **No secret or credential values.** The owner question text is a bounded status sentence (coordinator id, restart count, bound, options). The process port carries session and process handles, not credentials. Error evidence is counts, identities, and references.
- **No new personal data.** The change adds no personal-data category and no new network destination.
- **Trust model unchanged.** The supervisor is same-user and local; the instance lease and filesystem permissions are the boundary. No privilege escalation and no remote transport.
- **Privacy guard impact.** None; the change adds no committed private literal and no cloud dependency.

## 21. SECURITY REVIEW HIGHLIGHTS

- **Kill is a privileged operation.** Only the supervisor holding the current instance lease can kill; the target is the recorded session and process-tree handle, never a name, pattern, or user-supplied free-form value. Before TERM the recorded `pid` plus `processStartTimeMs` identity is verified, so a reused pid is not signalled. There is no shell interpolation on the kill path.
- **Single-instance instance lease.** A second supervisor cannot share the state dir, so two loops cannot race to kill or restart the same coordinator; `stop` is a recorded request, not a cross-process handle release.
- **Fail-closed on unknown state.** A torn or unreadable record set is `unevaluable`; the supervisor does not kill or restart on unknown state. A missing process-port alive or kill-with-grace capability is a classified gap, not an assumed success; an undeclared or unavailable harness resume is never assumed — it falls back to `spawn-fresh`.
- **No secret surface.** Records, evidence, status output, and error envelopes carry no credentials, tokens, prompts, or transcript content. The owner question is bounded and guarded by the delivered blocker content rules.
- **Denial-of-service bounds.** Reads, renders, records, and wake actions are bounded; a slow or malformed store cannot cause unbounded scanning or a wake storm.
- **Escalation integrity.** The owner question is published by the supervisor identity through the delivered blocker channel; the audience and delegation rules are unchanged, so a coordinator identity cannot answer an owner-audience escalation without the declared policy.
- **Residual risk.** The local same-user boundary is the delivered M1 trust model; a same-user process can in principle interfere with state. This change does not widen that boundary.

## 22. MAINTENANCE & OPERATIONS IMPACT

- **New operator surface.** `coordinator start`, `stop`, `status`, and `tick`; `start --fresh-budget` after an owner recovery decision.
- **Runbook.** Start the supervisor in the foreground under the future unit, or run `tick` for a bounded cycle. Check `status` for the instance (from the latest lease), session, decision, restarts, stuck verdict, wake, and escalation. `stop` appends a stop request and reports `requested=true`; the live supervisor stops at the next cycle boundary and records `released`. On exhaustion, read the owner question in the brief, then either park or `stop` and run `start --fresh-budget`.
- **Configuration.** Six `coordinator.*` keys are policy data; the defaults are documented and can be tuned without code changes.
- **State growth.** Records are appended only on actions (decisions, restarts, two-phase stuck/unevaluable verdicts, exhaustion, successful wakes, instance-lease acquisitions/releases/takeovers/stop requests), not on quiet cycles or failed wake attempts. The log growth is proportional to coordinator activity and bounded per event.
- **Observability.** `coordinator status` is the operational query; the existing brief is the owner query. No new dashboard, metrics store, or alert channel is added.
- **Interaction with M1-S18.** When the daemon and its installer land, the coordinator supervisor can be registered under the same user-level unit and the regime descriptor is the handoff. The coordinator process and budget remain distinct.
- **Maintenance cost.** The new domain is pure and the new records are additive; the main ongoing cost is keeping the process-lifecycle adapters aligned with harness changes and keeping the six config defaults appropriate.

## 23. GLOSSARY

| Term | Definition |
|---|---|
| Coordinator session | The long-lived CEO-style agent session that reads the digest, answers typed questions, merges, closes out, and picks the next delivery. |
| Coordinator supervision | The typed process that keeps the coordinator session managed: join/resume/spawn, stuck detection, kill, restart budget, and wake. |
| Lifecycle decision | The recorded choice `join-live`, `resume-context`, or `spawn-fresh`. |
| Join-live | Attach to an already-running coordinator session; consumes no restart ordinal. |
| Resume-context | Resume a non-live coordinator session that did not complete cleanly, whose context is known and below the limit; consumes one restart ordinal and does not re-pay prefill. |
| Spawn-fresh | Start a new coordinator session when there is no prior session, the prior session completed cleanly, or the prior session's context is at/above the limit, unknown, absent, or not resumable; only the recovery reasons consume a restart ordinal. |
| Iteration expectation | The supervisor's record that the coordinator is expected to make progress after a start, wake, restart, or actionable digest change. |
| Digest-input fingerprint | A bounded, read-only, state-sourced identity over the state event-log cursor and the open coordinator-audience question count; no tracker/CI/network read and no question text. |
| New turn | A positive `token-delta` or `session-traffic` reading from the delivered harness liveness facts, observed since the expectation. |
| Digest-consumed evidence | The digest-input fingerprint advanced after the expectation and the coordinator session produced a new turn. |
| Prefill-safety corroborator | Positive sourced session progress within `coordinator.progress-bound` (positive `token-delta` or `session-traffic`); it vetoes a stuck verdict so a large working session is not killed. |
| Artifact-evidence stuck detection | A stuck verdict based on the three artifact classes and session progress, never CPU. |
| Stuck record phases | The two appends under one `stuckId`: `verdict` (before the kill, `killOutcome=not-attempted`) and `outcome` (after the kill, with `terminated`, `forced`, or `failed`); reads fold to the latest per `stuckId`. |
| Kill with grace | Verify the recorded pid + process start time, TERM the recorded process tree, wait `kill-grace`, then KILL if still alive. |
| Restart budget | The durable per-epoch bound on coordinator restarts, distinct from the per-delivery lane budget. |
| Budget epoch | A durable identity that scopes the restart count; it survives supervisor restarts and is reset only by `start --fresh-budget`. |
| Exhaustion | The state where the restart count has reached the bound; it stops restarts and escalates to the owner with escalation states `not-exhausted`, `exhausted-escalated`, or `exhausted-escalation-failed`. |
| Owner-brief escalation | An owner-audience `decision-needed` typed question rendered first in the existing brief `blocker-questions` anchor. |
| Wake-on-typed-question | Triggering the next coordinator iteration when the rank-1 open question is coordinator-audience. |
| Pickup predicate (`isCoordinatorPickup`) | The delivered payload-determinable rule: rank 1, open (an absent status counts as open), audience coordinator. |
| Collection cycle | The supervisor's evaluation interval, `coordinator.collection-interval`, default 30 000 ms. |
| Progress bound | `coordinator.progress-bound`, default 300 000 ms; the window in which positive sourced progress vetoes a stuck verdict. |
| Supervisor regime | The shared descriptor of state-dir scope, single-instance lease, unit identity, process kind, budget store, supervisor mode, and external unit. |
| State-dir scope | The isolation boundary: one supervisor and one coordinator per state dir. |
| Instance lease | The durable, append-only single-instance ownership folded from the latest `coordinator.fence` record (`acquired`, `released`, `stale-takeover`, `stop-requested`); it carries instance identity and holder pid + process start time. It is not a hold on the state write fence. |
| State write fence | The delivered short-lived, handle-scoped lock (`acquireFence`/`releaseFence`); a coordinator append takes it for that one append only. `recoverFence` only clears an age-stale lock, so it is not used for instance takeover. |
| Supervisor mode | Exactly `foreground` or `detached`; rendered with the instance. |
| External unit | Exactly `absent` in v1; no OS unit exists, and the M1-S18 seam owns future registration. |
| Reserved escalation slot | The render rule that places the reserved coordinator-exhaustion question first in `typed-questions` and `blocker-questions`, with up to seven others in rank order and the lowest-ranked displaced and counted as omitted. |
| Process-lifecycle port | The injected seam for spawn/attach, alive, kill-with-grace, and sourced progress; harness resume is consumed from the delivered harness session port; the domain stays pure. |
| TDR | Technical Decision Record; the record type for the precedent-setting decisions in this change. |

## 24. APPENDICES

### Appendix A — `ceo-loop.sh` function map

| `ceo-loop.sh` function | Typed capability | Decision / contract | Acceptance criteria |
|---|---|---|---|
| Context resume decision | F-2 join-live / resume-context / spawn-fresh | DEC-7, `coordinator.resume-context-limit` | AC-F2-1..6 |
| Stuck detection | F-3 artifact-evidence stuck verdict | DEC-4, three classes + progress-bound corroborator | AC-F3-1..4 |
| Kill with grace | F-4 process-tree TERM then KILL | DEC-3, `coordinator.kill-grace`, pid + start-time verification | AC-F4-1..4 |
| Restart budget | F-5 durable per-epoch budget | DEC-8, `coordinator.restart-budget` | AC-F5-1..5 |
| Wake on question | F-7 `isCoordinatorPickup` wake | DEC-9, one wake per question | AC-F7-1..6 |
| Owner escalation | F-6 owner-audience question | DEC-5, existing brief anchor, render-first | AC-F6-1..3 |
| Supervisor regime | F-8 shared descriptor + instance lease | DEC-1, DEC-6, S18 seam | AC-F8-1..3 |

### Appendix B — Closed vocabularies

| Vocabulary | Values |
|---|---|
| Lifecycle decisions | `join-live`, `resume-context`, `spawn-fresh`; an iteration record may carry `none` when it captures an expectation without a lifecycle change |
| Lifecycle decision reasons | `context-pressure`, `context-unknown`, `session-interrupted`, `initial-start`, `clean-iteration-end` |
| Restart reasons (consume an ordinal; carried by `coordinator.restart.reason`) | `stuck-artifact-evidence`, `session-interrupted`, `context-pressure`, `context-unknown` |
| Stuck verdicts | `progressing`, `stuck`, `unevaluable` (only `stuck` and `unevaluable` are persisted as records) |
| Stuck record phases | `verdict`, `outcome` (same `stuckId` across both appends) |
| Stuck reasons (carried by `coordinator.stuck.reason`, distinct from the restart reason) | `stuck-artifact-evidence` (verdict `stuck`), `evidence-unevaluable` (verdict `unevaluable`) |
| Artifact evidence classes | `digest-consumed`, `merge`, `answer` |
| Evidence-class states | `advanced`, `stale`, `unknown` |
| Kill outcomes | `terminated`, `forced`, `failed`, `not-attempted` |
| Kill failure reasons | `identity-mismatch` (pid + process start time no longer matches the live process) |
| Wake outcomes (persisted) | `woken` — the only outcome that appends a `coordinator.wake` record and consumes the one-wake-per-question lifetime |
| Wake tick results (not persisted) | `already-woken`, `answered-before-wake`, `delivery-failed`, `no-pickup` — reported in `data`, never written to the log |
| Instance-lease actions (fence actions) | `acquired`, `released`, `stale-takeover`, `stop-requested` |
| Supervisor modes | `foreground`, `detached` |
| External unit | `absent` (no OS unit exists in v1; M1-S18 owns future registration) |
| Coordinator record kinds | `coordinator.iteration`, `coordinator.restart`, `coordinator.stuck`, `coordinator.exhaustion`, `coordinator.wake`, `coordinator.fence` |
| Reserved escalation-slot predicate (payload-only) | `type = decision-needed` AND `audience = owner` AND `lane = coordinator` AND `ref` = `<coordinatorId>#<budgetEpochId>` (exactly one `#`, both sides non-empty) |
| Reserved escalation render position | First in `typed-questions` and `blocker-questions`; up to seven others in rank order; the lowest-ranked is displaced and counted as omitted |
| Escalation states | `not-exhausted`, `exhausted-escalated`, `exhausted-escalation-failed` (derived) |
| Question status for pickup | `open`; an absent `status` counts as open, matching the delivered `isCoordinatorPickup` |
| Exhaustion recovery options | `restart-fresh-budget`, `park-owner-review` |
| Config keys | `coordinator.stuck-window`, `coordinator.kill-grace`, `coordinator.restart-budget`, `coordinator.resume-context-limit`, `coordinator.collection-interval`, `coordinator.progress-bound` |
| Error identities | `coordinator.already-running`, `coordinator.restart-budget-exhausted`, `coordinator.process.capability-gap`, `coordinator.session.kill-failed`, `coordinator.escalation.publish-failed`, `coordinator.wake.delivery-failed` |

### Appendix C — SC-M1-25 reconciliation

SC-M1-25 states: **Given** a coordinator session mid-iteration, context pressure rises, and a coordinator-audience question is ranked top-of-digest; **when** supervision evaluates; **then** the join-or-resume decision is recorded and applied, a stuck coordinator (no digest consumed, no merge, no answer within the declared window) is detected by artifact evidence, killed with grace, and restarted within budget, and the typed question wakes the next iteration within one collection cycle; **assert** restart events are classified, exhaustion escalates to the owner brief, and the `ceo-loop` function map is covered.

This specification **inherits** SC-M1-25 and **extends** it without divergence:

- "Context pressure rises" is made concrete by `coordinator.resume-context-limit` and the three decision kinds (AC-F2-1..6).
- "No digest consumed" is made observable by the state-sourced digest-input fingerprint (event-log cursor plus open coordinator-audience question count) and a new turn (positive `token-delta` or `session-traffic`), with the explicit absence behavior in DEC-4 (AC-F3-1..4).
- "No merge, no answer" are the `merge` and `answer` artifact classes (AC-F3-1).
- "Killed with grace and restarted within budget" is AC-F4-1..4 and AC-F5-2..3.
- "Within one collection cycle" is `coordinator.collection-interval` and AC-F7-1.
- "Exhaustion escalates to the owner brief" is AC-F6-1..3.
- "The ceo-loop function map is covered" is AC-F10-5 and Appendix A.

The only **clarification** is the observable definition of "digest consumed" (DEC-4), which SC-M1-25 left implicit. It is not a divergence: the scenario's artifact-evidence intent is preserved, and the corroborator prevents a false kill.

### Appendix D — Config defaults and justification

| Key | Default | Domain | Semantics | Justification |
|---|---:|---|---|---|
| `coordinator.stuck-window` | 600 000 ms | integer > 0 | Time after an expectation before a no-progress coordinator is `stuck`. | Mirrors the `ceo-loop.sh` stalled-session baseline; long enough for a slow merge/closeout, short enough to catch a stall. |
| `coordinator.kill-grace` | 20 000 ms | integer > 0 | TERM-to-KILL grace for the coordinator process tree. | Mirrors the bash TERM/SIGKILL grace; gives the session a final chance to finish without hanging the supervisor. |
| `coordinator.restart-budget` | 10 | integer ≥ 0 | Restarts per budget epoch; `0` admits no restarts. | Mirrors the `ceo-loop.sh` maximum restart count; distinct from the per-delivery lane bound. |
| `coordinator.resume-context-limit` | 100 000 tokens | integer > 0 | Context size at or above which a fresh spawn is preferred to a resume. | Mirrors the bash context-resume threshold; keeps resume economical while avoiding a huge-context re-entry. |
| `coordinator.collection-interval` | 30 000 ms | integer > 0 | One supervision collection cycle; bounds wake latency and stuck-check cadence. | Mirrors the bash poll cadence and keeps the "within one collection cycle" promise testable. |
| `coordinator.progress-bound` | 300 000 ms | integer > 0 | Liveness window in which positive sourced progress (`token-delta` or `session-traffic`) vetoes a stuck verdict. | Gives a large working session a bounded window to prove progress before the stuck window can kill it; policy data only. |

The coordinator collection interval is deliberately distinct from the future `daemon.heartbeat-cycle` (M1-S18, default 60 s in the M1 contracts) and from `lane.liveness-interval` (M1-S15, default 30 s). When the daemon hosts the supervisor, the daemon may drive the cycle, but the coordinator's own keys remain the source for its wake, stuck, and progress bounds.

### Appendix E — Coordinator state record shapes

| Record kind | Payload schema | Required fields | Identity field | Notes |
|---|---|---|---|---|
| `coordinator.iteration` | `delivery.coordinator.iteration.v1` | `schemaId`, `iterationId`, `coordinatorId`, `trigger`, `decision`, `reason`, `sessionId`, `contextTokens`, `digestFingerprint`, `expectationWindowMs`, `recordedAt` | `iterationId` | `digestFingerprint` covers the state event-log cursor plus open coordinator-audience question count only; `decision` may be `none`; `sessionId` and `contextTokens` may be `null` with an explicit reason; no fabricated value. |
| `coordinator.restart` | `delivery.coordinator.restart.v1` | `schemaId`, `restartId`, `coordinatorId`, `budgetEpochId`, `sessionId`, `ordinal`, `reason`, `recordedAt` | `restartId` | `restartId` is `<coordinatorId>#<budgetEpochId>#<ordinal>`; ordinals are contiguous from `1` per epoch. |
| `coordinator.stuck` | `delivery.coordinator.stuck.v1` | `schemaId`, `stuckId`, `coordinatorId`, `iterationId`, `verdict`, `phase`, `reason`, `evidence`, `killOutcome`, `killFailureReason`, `recordedAt` | `stuckId` | `phase` is `verdict` or `outcome`, with the same `stuckId` across both appends; `phase=verdict` precedes the kill with `killOutcome=not-attempted`; `phase=outcome` carries `terminated`, `forced`, or `failed`. `verdict` is `stuck` or `unevaluable`; `reason` is the closed stuck reason (`stuck-artifact-evidence` or `evidence-unevaluable`) and is a distinct field from `coordinator.restart.reason`; `killFailureReason` is `identity-mismatch` or `null`; `evidence` is bounded `key=value` ≤ 512 bytes. Reads fold to the latest record per `stuckId` by `recordedAt`, then ledger sequence. |
| `coordinator.exhaustion` | `delivery.coordinator.exhaustion.v1` | `schemaId`, `exhaustionId`, `coordinatorId`, `budgetEpochId`, `restarts`, `historyRef`, `escalationQuestionId`, `options`, `terminal`, `recordedAt` | `exhaustionId` | One terminal receipt per epoch (`exhaustionId` is `<coordinatorId>#<budgetEpochId>`); `terminal` is `true`; the record lands only after the escalation question lands. |
| `coordinator.wake` | `delivery.coordinator.wake.v1` | `schemaId`, `wakeId`, `coordinatorId`, `questionId`, `questionRank`, `askedAt`, `outcome`, `iterationId`, `recordedAt` | `wakeId` | Only outcome `woken` is persisted; `outcome` is therefore `woken` on this record, and the other declared wake outcomes are tick results that append no record. `askedAt` is the question-lifetime identity used by dedupe; `iterationId` may be `null` when no iteration identity was produced. |
| `coordinator.fence` | `delivery.coordinator.fence.v1` | `schemaId`, `fenceId`, `instanceId`, `coordinatorId`, `action`, `holder`, `pid`, `processStartTimeMs`, `supervisorMode`, `externalUnit`, `previousHolder`, `fenceAgeMs`, `recordedAt` | `fenceId` | This is the instance lease, not a state write fence. `action` is `acquired`, `released`, `stale-takeover`, or `stop-requested`; `previousHolder` and `fenceAgeMs` are `null` except on `stale-takeover`; `supervisorMode` is `foreground` or `detached`; `externalUnit` is `absent`; the latest record is the instance identity and the instance's `startedAt` is its `acquired` record time. |

All six records are additive under `delivery.state.v1`; the schema version does not change and no migration exists. Reads validate kind, schema, required fields, vocabularies, and ordinal contiguity before serving; the `coordinator.fence` record is the append-only instance lease and validates like the others. Every append, including each fence record, acquires the delivered state write fence only for that append and releases it. A torn or unknown record set is `unevaluable`, never zero.

### Appendix F — Exit matrix

| Outcome | Identity | Exit | Consequence |
|---|---|---:|---|
| Supervisor started, stopped, status read, or tick completed with an actionable result | — (success `data`) | 0 | — |
| Tick observed an already-escalated exhaustion | — (success `data`, `escalation=exhausted-escalated`) | 0 | — |
| Wake outcome `already-woken`, `no-pickup`, or `answered-before-wake` | — (success `data`) | 0 | — |
| Stop request accepted for a live supervisor (no release claimed) | — (success `data`, `requested=true`, `released=false`) | 0 | — |
| Stop with no live supervisor (latest lease `released` or stale) | — (idempotent success, `not-running`) | 0 | — |
| Restart or resume attempted at/above the budget | `coordinator.restart-budget-exhausted` | 1 | `not_landed` |
| Invalid invocation grammar or argument | `fallback.invocation` | 1 | `not_landed` |
| State permission denied while reading or appending | the delivered `state.permission.denied` | 1 | `not_landed` |
| Harness cannot or will not spawn a session | `harness.capability.gap` / `harness.spawn.refused` | 1 | `not_landed` |
| Wake outcome `delivery-failed` (no record appended) | `coordinator.wake.delivery-failed` | 2 | `unknown` |
| Second supervisor or a concurrent `tick` on the same state dir | `coordinator.already-running` | 2 | `not_landed` |
| Kill could not terminate the recorded tree, or the recorded pid + process start time does not match the live process (`identity-mismatch`) | `coordinator.session.kill-failed` | 2 | `unknown` |
| Escalation question could not be published | `coordinator.escalation.publish-failed` | 2 | `unknown` |
| Missing process-port alive or kill-with-grace capability | `coordinator.process.capability-gap` | 2 | `not_landed` |
| Torn, unknown, or unreadable coordinator records | the delivered `state.store.torn` / `state.store.unknown` / schema identity | 2 (per the state row) | `not_landed` |

Success outcomes that are not errors: harness resume undeclared or unavailable records `spawn-fresh` with reason `session-interrupted` at exit `0`; a stale instance lease taken over and recorded is a success `data` result carrying `coordinator.fence` `action=stale-takeover` followed by `action=acquired` at exit `0`; an absent or unsupported progress source is the `unknown` evidence class and is not an error; a stop request accepted for another process is `requested=true`, `released=false` at exit `0`.

Every non-zero outcome resolves to one declared error-table identity; no outcome exits outside `{0,1,2}`.

### Appendix G — Command grammar and output shapes

| Grammar | Flags | Result |
|---|---|---|
| `coordinator start` | `--foreground`, `--fresh-budget` | Starts the supervision loop (or a new budget epoch); returns a start receipt. |
| `coordinator stop` | none | Requests a stop by appending a `stop-requested` lease record; returns a stop receipt (`requested` or `not-running`). |
| `coordinator status` | `--live` | Returns the observation payload; `--live` adds live process facts or declares their absence. |
| `coordinator tick` | none | Runs one bounded collection cycle and returns the cycle payload. |

Every successful command returns the bounded `delivery.coordinator.v1` `data` object:

```
{
  schemaVersion: "delivery.coordinator.v1",
  coordinatorId,
  instance: { instanceId, pid, holder, startedAt, supervisorMode: "foreground" | "detached", externalUnit: "absent" } | null,
  regime: { scope: "state-dir", stateDirectory, unitIdentity, processKind, budgetStore, supervisorMode: "foreground" | "detached", externalUnit: "absent", daemonInstallSeam: "M1-S18" },
  session: { sessionId | null, liveness: "alive" | "absent" | "unknown", contextTokens: number | null, harnessKind },
  decision: { kind: "join-live" | "resume-context" | "spawn-fresh" | "none", reason, iterationId, recordedAt } | null,
  restarts: { count, bound, budgetEpochId, historyRef, terminal: boolean },
  stuck: { verdict: "progressing" | "stuck" | "unevaluable", phase: "verdict" | "outcome", reason, evidence, evaluatedAt } | null,
  wake: { outcome, questionId | null, questionRank | null, askedAt | null, iterationId | null } | null,
  escalation: { state: "not-exhausted" | "exhausted-escalated" | "exhausted-escalation-failed", questionId | null },
  fence: { holder | null, action: "acquired" | "released" | "stale-takeover" | "stop-requested" | null, previousHolder | null, fenceAgeMs | null, recordedAt | null } | null,
  degradation: string[]
}
```

Representative human text (deterministic, ANSI-free, bounded):

```
coordinator started  scope=<state-dir>  instance=<id>  pid=<pid|->  supervisor=<foreground|detached>  external-unit=absent
coordinator stopped  instance=<id>  requested=<true|false>  released=<true|false>  state=<requested|not-running>
coordinator tick  decision=<kind>  wake=<outcome>  stuck=<verdict>  restarts=<n>/<bound>  escalation=<state>
```

```
coordinator <id>  state=<running|stopped|exhausted-escalated|exhausted-escalation-failed|degraded>
instance   <instanceId|none>  pid=<pid|->  holder=<holder|none>  started=<iso|->  supervisor=<foreground|detached|none>  external-unit=<absent|none>
session    <sessionId|none>  liveness=<alive|absent|unknown>  contextTokens=<n|?>
decision   <join-live|resume-context|spawn-fresh|none>  reason=<reason>  at=<iso>
restarts   <count>/<bound>  epoch=<budgetEpochId>  history=<ref>
stuck      <progressing|stuck|unevaluable|none>  phase=<verdict|outcome|->  reason=<stuck-artifact-evidence|evidence-unevaluable|->  evidence=<bounded corpus>
wake       <woken|already-woken|answered-before-wake|delivery-failed|no-pickup|none>  question=<id|none>  askedAt=<iso|none>
escalation <not-exhausted|exhausted-escalated|exhausted-escalation-failed>  question=<id|none>
fence      <holder|none>  action=<acquired|released|stale-takeover|stop-requested|none>  previous=<holder|none>  ageMs=<n|->  scope=<state-dir>  supervisor=<foreground|detached|none>  external-unit=<absent|none>
```

Machine output is at most 64 KiB; human output is at most 32 lines. Every command uses the shared CommandResult envelope and the exit taxonomy in Appendix F.

### Appendix H — Ticket-to-spec traceability

| Ticket acceptance criterion / pinned decision | Spec coverage |
|---|---|
| A coordinator session killed mid-iteration resumes or is respawned per the recorded decision without losing closed-out work | AC-F2-1..5, AC-F5-2, AC-F5-4 |
| A stuck coordinator is detected by artifact evidence within the declared window and restarted with the reason classified | AC-F3-1..4, AC-F4-1..4, AC-F5-2, DEC-4 |
| Restart exhaustion escalates to the owner brief (never silent) | AC-F5-3, AC-F6-1..3, DEC-5 |
| A coordinator-audience typed question wakes the coordinator within one collection cycle | AC-F7-1..6, DEC-9 |
| The `ceo-loop.sh` functions are covered: context resume decision, stuck detection, kill-with-grace, restart budget | AC-F10-5, Appendix A, AC-F2-*, AC-F3-*, AC-F4-*, AC-F5-* |
| Join-or-resume is a recorded decision | AC-F2-1..6, DEC-7 |
| Stuck detection is artifact-evidence based, not CPU | AC-F3-1..4, AC-NFR-3, DEC-4 |
| Kill with grace; bounded restart budget; exhaustion to the owner brief; wake within one cycle | AC-F4-1..4, AC-F5-1..5, AC-F6-1..3, AC-F7-1..6 |
| Distinct process, distinct budget, same supervisor regime (`daemon install` scope) | AC-F1-1, AC-F1-4, AC-F5-1, AC-F8-1..3, DEC-1, DEC-6 |
| Single-instance ownership is an append-only instance lease; `stop` is a recorded request; PID identity is verified before kill | AC-F1-1..4, AC-F4-4, AC-F8-3, DM-11, NFR-14 |
| The digest-input fingerprint is state-sourced and the stuck record is two-phase | AC-F3-1, AC-F4-1..2, EVT-1, EVT-3, DM-3 |
| SC-M1-25 inherited and extended | Appendix C, AC-F2-*, AC-F3-*, AC-F4-*, AC-F5-*, AC-F6-*, AC-F7-* |

## 25. DOCUMENT HISTORY

| Version | Date | Author | Changes |
|---|---|---|---|
| 1.0 | 2026-11-07 | `@spec-writer` | Initial specification for GH-241 / M1-S23 coordinator supervision. |
| 1.1 | 2026-11-07 | `@spec-writer` | Test-plan gap remediation: GAP-1 AC-F1-2 Given is now an uncontended state dir with a cross-reference to AC-F8-1 for the contended tick; GAP-2 pins resume as a harness-session capability and splits the four capability outcomes (resume → `spawn-fresh session-interrupted`, spawn → `harness.capability.gap`/`harness.spawn.refused` exit 1, process alive/kill → `coordinator.process.capability-gap` exit 2, progress → `unknown` class) across F-2/F-3/F-10, AC-F2-2/AC-F2-3/AC-F3-3/AC-F10-4, DEC-7/DEC-11, §8.4, and the exit matrix; GAP-3 pins the payload-only reserved-slot predicate; GAP-4 pins that only `woken` persists and consumes the one-wake budget; GAP-5 adds the closed `coordinator.stuck.reason` field; GAP-6 adds the sixth `coordinator.fence` record (EVT-7, DM-11) as the takeover-evidence carrier; GAP-T7 pins the two two-segment codes (`coordinator.already-running`, `coordinator.restart-budget-exhausted`) into `RESERVED_TWO_SEGMENT_CODES` (22→24) and the table at 99→105, recording that the other four coordinator identities are three-segment; GAP-T2 pins the v1 collection-cycle assertion semantics for NFR-8/NFR-9. 43 ACs and 13 DECs preserved. |
| 1.2 | 2026-11-07 | `@spec-writer` | DoR iteration-1 remediation (RF-01..RF-12, A1/A2/A3/A6): separates the durable **instance lease** carried by `coordinator.fence` records (actions `acquired`, `released`, `stale-takeover`, `stop-requested`; instance identity, pid, process start time, `supervisorMode` `foreground/detached`, `externalUnit` `absent`) from the delivered short-lived state write fence, which is now taken for one append only; pins `stop` as a recorded request that never releases another process's handle and never claims `released=true`; replaces lifetime-fence/recoverFence takeover with holder-liveness plus 2×`collection-interval` lease age; removes every separate instance-record assertion (RF-01/RF-05/RF-06/RF-07, A1); splits `coordinator.stuck` into `phase=verdict` (before kill, `killOutcome=not-attempted`) and `phase=outcome` (same `stuckId`, latest-wins fold) (RF-04); defines a new turn as a positive `token-delta` or `session-traffic` reading and adds the sixth key `coordinator.progress-bound` (default 300 000 ms) plus adapter mapping (RF-08/A3); drops the tracker/CI merge-count input from the fingerprint, which is now state event-log cursor + open coordinator-audience question count (RF-09); uses `exhausted-escalated` everywhere (RF-10); pins the reserved escalation question first in `typed-questions` and `blocker-questions` with up to seven others in rank order and the lowest displaced (RF-12); persists `askedAt` on the wake record (RF-03); notes the TDR-0013 amendment and TDR-0014 checklist cleanup by `@decision-advisor` (RF-02/A7); verifies pid + `processStartTimeMs` before TERM with `killFailureReason=identity-mismatch` (A2); pins an absent status as open for pickup (A6); updates NFR-8/9 caller-bounded semantics. Adds AC-F1-4 (instance lease identity) and AC-F4-4 (PID identity), for **45 ACs**; 13 DECs, 6 config keys, 6 record kinds (EVT-1..EVT-5, EVT-7), and 7 EVTs preserved. |

---

## AUTHORING GUIDELINES

- **Sources.** Authored from the GH-241 ticket body (verbatim), the change-planning summary, the clarify-scope findings in `chg-GH-241-pm-notes.yaml`, the M1 design baseline (`architecture.md` persistence and recovery, `journeys.md` J1, `contracts.md` daemon/lanes/blockers, `test-scenarios.md` SC-M1-25), the backlog entries for M1-S15/M1-S16/M1-S23, the CLI command registry, and the delivered current-truth specs for session economics, blockers, status digest, brief, and harness adapters. The delivered contracts and domain/state modules named in the planning context were read to confirm the current surfaces; the spec does not instruct changes to them.
- **Approach.** The six clarify-scope findings are resolved as DEC-1 through DEC-6 (with DEC-7 through DEC-13 covering the remaining non-obvious choices). Every ticket acceptance criterion and every pinned decision is traced to at least one AC and one appendix row. The spec deliberately defines the shared supervisor regime at the descriptor, instance-lease, and budget level and leaves the OS unit and daemon wiring as the named M1-S18 seam, because M1-S18 is not delivered and the story's dependency list does not require it. v1.2 resolves the DoR iteration-1 findings by separating the append-only instance lease from the delivered short-lived state write fence, pinning the two-phase stuck record, the progress-bound/new-turn source, the state-sourced fingerprint, the escalation vocabulary and render position, and PID identity verification.
- **Constraints.** The spec is technology-neutral at the contract level: it names capabilities (process-lifecycle port, state records, config keys, error identities) rather than file paths or step-by-step implementation tasks. It preserves the delivered error taxonomy, the `{0,1,2}` exit projection, the additive state-record discipline, the blocker audience/delegation rules, and the no-LLM/no-CPU deterministic-render constraint.
- **Seed scenario.** SC-M1-25 is inherited and extended; the only clarification is the observable definition of "digest consumed" (DEC-4), declared as a clarification rather than a divergence.
- **Open questions.** None. All choices inside the ticket are recorded as decisions; no product-scope ambiguity remains. The DoR iteration-1 findings are resolved in v1.2 and recorded in §25.

## VALIDATION CHECKLIST

- [x] `change.ref` matches provided `workItemRef` (GH-241)
- [x] `owners` has at least one entry
- [x] `status` is "Proposed"
- [x] All sections present in order (1–25 + authoring guidelines + validation checklist)
- [x] ID prefixes consistent and unique (F-, AC-, NFR-, RSK-, DEC-, DM-, EVT-, OQ-)
- [x] Acceptance criteria reference at least one F-/NFR-/DM-/EVT- ID and use Given/When/Then
- [x] NFRs include measurable values
- [x] Risks include Impact & Probability
- [x] No implementation details (no file-level code paths, no step-by-step tasks)
- [x] No content duplicated from linked docs beyond the necessary contract summary
- [x] Front matter validates per the authoring rules
