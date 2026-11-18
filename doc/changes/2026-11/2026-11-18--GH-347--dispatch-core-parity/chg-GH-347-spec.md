---
change:
  ref: GH-347
  type: feat
  status: Proposed
  slug: dispatch-core-parity
  title: "M4-S9: Dispatch core parity — durable lane, resume, admission, classifier (M4)"
  owners: ["engineering"]
  service: delivery-os dispatch engine
  milestone: "M4: Jaiship-native delivery"
  labels: ["dispatch", "parity", "m4-s9", "lifecycle", "admission", "resume", "harness"]
  version_impact: minor
  audience: internal
  security_impact: low
  risk_level: high
  dependencies:
    internal:
      - core dispatch engine and the result-derivation ladder
      - harness session port and the opencode / Claude Code adapters
      - queue lease admission and the per-ref single-flight predicate
      - tracker, pull-request, ledger, and pm-notes truth reads
      - lane and coordinator configuration branches
      - durable state ledger, attempt-record ledger, and economics records
      - dispatch conformance fixtures and the controlled-proof repository
    external:
      - opencode CLI session resume and process lifetime (live behavior is outside the parity battery)
      - GitHub issue and pull-request reads (fixture-only inside the parity battery)
---

# CHANGE SPECIFICATION

> **PURPOSE**: Make `jaiship dispatch <ref>` a complete typed replacement for the shell delivery lane's core lifecycle — a durable resumable lane, race-safe admission with its declared typed verdict, an honest tracker-outage ladder, bounded stall termination and in-process restart, the real spawn identity and lifecycle prompt, and the shell's full eleven-token class semantics — proven by one parity battery that exercises the production seams and never invokes a shell. The shell lane's operator surface (`status`, `log`, `is-delivering`, `last-message`, per-ref logs) is not claimed here and remains GH-354.

## 1. SUMMARY

The eleven result tokens, their projections, and the one-shot engine's admission, lease, liveness, restart-admission, and artifact-first derivation already exist. What is missing is parity wiring and semantics: the one-shot path records no resumable lane, `--resume-prompt` cannot see a finished attempt, admission can mislabel store-fence contention as `fallback.internal`, the tracker is read once with no ladder, a stalled session cannot be terminated and the restart budget is enforced only across invocations, the spawn argv and prompt are constants, and two class arms (`merged` from a tracker-done work item, `partial` from incomplete pm-notes) are unreachable.

This change closes those ten gaps without widening the closed vocabulary: it adds one durable dispatch-owned lane record, one additive harness terminate operation, one additive spawn-title fact, and one additive artifact-completeness fact; it pins one total derivation order; and it extends the existing dispatch conformance suite into a parity battery that replays all eleven classes, the two-concurrent-dispatch race, the resume-over-`pr-open` case, the tracker-outage case, the stall/restart loop, and the no-shell invariant. Nothing else moves: the tokens, projections, exits, error identities, the queue contract's sibling `claim` path, the daemon lane record, and the operator surface (GH-354) are out of scope.

## 2. CONTEXT

### 2.1 Current State Snapshot

- **Closed taxonomy is delivered.** The eleven bash-era tokens — `merged`, `blocked`, `pr-open`, `pr-open-unverified`, `failed`, `finished`, `max-restarts`, `state-unverified`, `partial`, `noop-lane-permission`, `noop-lane-nothing-to-do` — each carry exactly one projection class and one derivation class. The exits are `success` → 0, `user-validation` → 1, `platform-provider` → 2, so `state-unverified` stays exit 2 and `partial` is exit 1. No change to this vocabulary is in scope.
- **One-shot engine is already substantial.** The one-shot run path performs the nomination gate, the admission preflight, the harness version/mode admission, the per-ref lease claim, spawn or resume through the harness session port, progress-based liveness polling while evidence collection is pending, restart admission on a current stall, and artifact-first truth derivation, then appends exactly one durable attempt record per classified attempt. A pre-session refusal appends none.
- **Attempt record carries sessions but is not a lane.** The durable attempt record carries `sessionIds` (one per spawn or resume), the resolved single-seat `binding`, the harness facts, the comparison, corroboration, and at most 16 bounded evidence references. It is written only when the attempt reaches classification, so it cannot serve as a pre-run resumable lane.
- **A daemon lane record exists and is daemon-owned.** `daemon.lane` / `delivery.daemon.lane.v1` carries `ref`, `state` (`delivering`, `detached`, `completed`, `failed`, `preempted`), `harnessKind`, `sessionId`, `processId`, `ledgerPosition`, `spawnOrdinal`, `liveness`, `classification`, `resumeIntent`, `providerProfile`, and `recordedAt`. It is appended and reconciled by the daemon family, keyed per ref with latest-wins semantics.
- **Resume is gated on the flag and blind to finished attempts.** The dispatch runtime consults the existing lane only when `--resume-prompt` is supplied; the production lane facts read only daemon lane records whose state is `delivering`, `detached`, or `preempted` and that carry a session identity. A finished one-shot attempt is therefore invisible, and `--resume-prompt` degrades to a fresh spawn with no resume admission.
- **Admission is a pre-read plus a non-blocking claim fence.** Before the claim, a per-ref predicate reads live lease truth and refuses a live same-ref lease (`queue.single-flight`, naming the holder) or a live lease on another ref (`queue.lease-conflict`). The claim itself acquires the store fence non-blockingly; contention returns the state identity `state.lock.busy`, which the dispatch envelope currently wraps as a `queue`-kind refusal. The classifier cannot resolve a `queue` kind with a `state.*` code and contains the mismatched pair as `fallback.internal` at exit 2 — a platform class. The delivered `queue.single-flight` row is explicitly a transient, retryable `user-validation` row at exit 1 that must name the holder and must never project through a platform class.
- **Tracker truth is a single bounded read.** The truth read resolves the local branch and commits, the pull-request fact, the tracker fact, the CI verdict, and the verify-change outcome. A tracker read failure becomes an unreadable tracker fact, and the derivation returns `state-unverified` before it evaluates artifact evidence. There is no retry ladder.
- **Stalls cannot be terminated by the engine.** The session port exposes spawn, deliver, resume, collect, classify, liveness, and list-sessions — no terminate. The streaming spawn starter does expose an idempotent `kill` (terminal signal then a fixed-grace escalation), but the engine cannot reach it, and the starter signals the direct child rather than the process group or an escaped runtime. The current contract therefore records a below-budget stall and leaves the session to supervision, and the two current-truth pages state that the port exposes no kill operation.
- **Restart budget is cross-invocation only.** `lane.restart-budget` (default 3) is read by admission from the persisted economics restart count. The one-shot invocation runs one attempt; it has no in-process loop. The shell lane instead loops iterations, with a default maximum of 10.
- **Spawn identity is constant.** The production spawn argv is a fixed constant with no `--agent` and no `--title`; the composition supplies no caller agent identity or binding, although the spawn contract already declares both optional members and the runtime already propagates them when supplied. The production prompt is a fixed sentence.
- **Two class arms are unreachable.** Derivation checks tracker-blocking before every PR state and never derives `merged` from a tracker-done work item; `partial` is reachable only from the shared classifier's tool-failure/premature-end outcomes, never from the shell's "commits exist and pm-notes are incomplete" artifact arm.
- **Derivation order differs from the shell.** The typed order is blocked → already-merged PR → open PR → ledger no-work → exit-0-no-artifact failure → classifier token. The shell order is tracker closed/done → `merged`, blocking label → `blocked`, open PR → `pr-open`, then the artifact ladder, then the tracker verdict. A done work item that also carries a blocking label therefore resolves differently today.
- **Configuration defaults are declared.** `lane.liveness-interval` = 30 000 ms, `lane.restart-budget` = 3, `coordinator.kill-grace` = 20 000 ms (the shell's 20 s grace), `queue.lease-ttl` = 90 000 ms.
- **Error table already carries what is needed.** The `dispatch` kind has exactly four identities; the `queue` kind carries `queue.single-flight` and `queue.lease-conflict`; `state.lock.busy` is a platform state row at exit 2; `harness.capability.gap` exists. No new failure identity is required by this change.
- **The parity reference is the shell lane.** Spawn is `opencode run --agent pm --session <id>` for a resume or `opencode run --agent pm --title ticket-<REF>` for a fresh run, with the delivery prompt. The tracker poll is 5 attempts with `min(base * 2^(n-1), 30s)` (base 2 s, cap 30 s); exhaustion is `state-unverified`, never success. The tracker order is issue closed → `merged`, blocking label → `blocked`, open PR → `pr-open`. The artifact ladder is open PR → `pr-open`, merged PR → `merged`, commits > 0 with complete pm-notes → `finished` / incomplete or absent → `partial`, no commits with the headless permission signature → `noop-lane-permission`, no commits with a reachable tracker → `noop-lane-nothing-to-do`, otherwise none. A clean session exit is always terminal; only a watchdog-killed stall is restart-eligible; terminal tracker verdicts survive a stall; a `state-unverified` classification does not burn a restart slot; kill terminates the process tree with a TERM→KILL grace and reaps an escaped runtime; an open PR with an unresolved URL becomes `pr-open-unverified`.
- **Existing conformance proves tokens, not production seams.** The dispatch conformance suite replays all eleven tokens through the command runtime with injected truth reads, a scripted session port, and a stub claim result. It composes the edge runtime, so it never exercises the production claim path, the lane resolver, the spawn argv/title/prompt, the tracker ladder, or the terminate operation — exactly where the parity defects live.

### 2.2 Pain Points / Gaps

- **PG-1 — No durable per-ref lane.** The one-shot path records session identities only at attempt completion, so a crashed or stalled run leaves nothing resumable, and an owner process id, its start time, and an iteration ordinal are not recorded at all.
- **PG-2 — Session identity capture is late.** A session identity is held in memory and disclosed on the attempt record, but it is not persisted when it is acquired, so there is no lane to resume until the attempt ends.
- **PG-3 — Resume over a recorded attempt short-circuits.** `--resume-prompt` cannot see a finished attempt (including `pr-open`) and silently degrades to a fresh spawn with no resume admission.
- **PG-4 — Concurrent admission can be mislabelled.** The loser of a concurrent claim can receive a `queue` kind with a `state.lock.busy` code, which the classifier contains as `fallback.internal` at exit 2 — neither the declared queue verdict nor the declared holder.
- **PG-5 — Tracker outages are dishonest.** One bounded read and an early unreadable-read short-circuit mean a transient tracker outage can produce `state-unverified` even when artifact evidence is decisive, and there is no bounded retry ladder.
- **PG-6 — Stalls leak or are abandoned.** The engine cannot terminate a stalled session; below the budget it records the stall and leaves a live session behind, and a second invocation could race it.
- **PG-7 — Restart is not in-process.** The budget is enforced only across invocations, so a single typed dispatch cannot reproduce the shell's bounded iterate-until-terminal behavior.
- **PG-8 — Spawn identity is wrong.** The typed spawn carries no `--agent pm`, no deterministic `--title ticket-<REF>`, and a constant prompt instead of the delivery-lifecycle prompt.
- **PG-9 — `partial` is unreachable in the shell sense.** Commits with incomplete pm-notes fall through to the classifier and can report `finished`.
- **PG-10 — `merged` from tracker-done is unreachable, and the order conflicts.** A done work item with no visible PR is not `merged`; a done work item that also carries a blocking label resolves `blocked` instead of `merged`.

## 3. PROBLEM STATEMENT

Because the typed dispatch lane still lacks a durable per-ref lane, atomic admission verdicts, a resumable-attempt resolution, a retry ladder with artifact-first honesty, bounded stall termination, an in-process restart loop, the real spawn identity, and two artifact class arms, `jaiship dispatch <ref>` cannot reproduce the shell lane's lifecycle outcome or its supervision semantics: an operator can lose resumability, receive an internal-classified race failure, lose a decisive artifact verdict to a tracker outage, leave a stalled session running, spawn without the `pm` agent identity, and report `finished` where the shell reports `partial` — so the shell lane cannot be retired.

## 4. GOALS

- **G-1**: A dispatch that acquires a session records a durable, per-ref, resumable lane before it can be lost, and a later `--resume-prompt` resolves it instead of spawning fresh.
- **G-2**: Admission is decided atomically with the claim, and every refusal carries its declared typed identity and holder — never an internal containment identity.
- **G-3**: Tracker unreadability is bounded, retried, and honest: decisive artifact evidence still resolves; otherwise the outcome is `state-unverified`, never a success claim.
- **G-4**: A corroborated terminal stall is terminated within a bounded grace, and a bounded in-process loop reproduces the shell decision table without leaking a second session.
- **G-5**: A spawned session carries the `pm` agent identity, a deterministic `ticket-<REF>` title, and the delivery-lifecycle prompt.
- **G-6**: The total derivation order yields all eleven classes, including tracker-done → `merged` and artifact `partial`, with the closed vocabulary and exits unchanged.
- **G-7**: One parity battery replays all eleven classes and the production-specific seams, proves the whole flow runs with no shell entry point, and states exactly what it does and does not prove.

### 4.1 Success Metrics / KPIs

| Metric | Target |
|--------|--------|
| Parity class coverage | 11/11 result classes replayed with the real derivation and command path; each class asserted by token and exit |
| Durable lane coverage | 100% of admitted dispatches with a held session append an active lane record; 100% of terminal dispatch outcomes update the lane; 0 pre-session refusals append a lane |
| Concurrent admission correctness | 2/2 concurrent same-ref dispatches receive their declared verdict: exactly 1 admitted, 1 `queue.single-flight` naming the holder; 0 `fallback.internal`; 0 double-claim; 0 crash |
| Resume continuity | 1/1 recorded `pr-open` attempts resume under `--resume-prompt`; 0 fresh spawns when a recorded session identity exists |
| Tracker honesty | ≤ 5 ladder attempts with 2/4/8/16 s waits and ≤ 30 s added latency; 0 success claims after exhaustion; 100% of decisive artifacts survive a tracker outage |
| Stall safety | 100% of corroborated terminal stalls on a terminate-capable adapter are terminated before any restart; 0 silent second sessions; TERM→KILL respects the declared grace |
| Restart loop | 100% of restarts consume exactly one ordinal and one `economics.restart` record; 0 restarts after a clean exit; `max-restarts` exactly at the configured bound; exactly 1 attempt record per dispatch that reaches classification |
| Spawn identity | 1/1 fresh spawns carry `--agent pm` and `--title ticket-<REF>`; 1/1 fresh/resume spawns carry the lifecycle prompt; 0 operator flags added |
| Class-arm reachability | 100% of the two previously unreachable arms (`merged` from tracker-done, `partial` from incomplete pm-notes) reachable and distinct |
| Vocabulary invariance | 0 new tokens, 0 projection changes, 0 exit changes, 0 new error-table rows, 0 new domain kinds |
| No-shell proof | 0 shell invocations across the whole battery and loop/terminate paths; 0 script-path references in the dispatch flow; every spawn is fixed-argv with `shell:false` |
| Determinism | 2/2 identical battery runs produce identical envelopes, attempt counts, and class coverage; 0 live network or child-process calls |

### 4.2 Non-Goals

- **NG-1**: The F1b operator surface — per-ref `status`, `log`, `is-delivering`, `last-message`, and per-ref log persistence — stays with GH-354.
- **NG-2**: The pre-iteration hook is retired, not ported; provider policy (GH-350) replaces it. No new hook capability is added.
- **NG-3**: No merge, closeout, queue CRUD, provider-policy, namespace-migration, or installed-binary work.
- **NG-4**: No change to the eleven-token vocabulary, any projection class, any exit code, the attempt-record schema version, or any error-table row or domain kind.
- **NG-5**: No change to the queue contract's sibling `claim` path, its own-holder renewal, or repository exclusivity.
- **NG-6**: No change to the daemon lane record, its state vocabulary, or daemon reconciliation ownership.
- **NG-7**: No deletion of the shell entry points in this change. The change proves the typed flow has no shell dependency; retiring the shell is a separate handover act.
- **NG-8**: The typed `state-unverified` exit stays 2; the shell's 1 is not a parity target.
- **NG-9**: The `commitlint` PATH defect belongs to M4-S3 and is an environment note here, not a change.
- **NG-10**: The shell's log-signature `noop-lane-permission` arm is not added: the typed lane has no declared permission-rejection observation, and adding one is not one of the ticket's ten gaps. The token remains the recorded spawn-refusal token as delivered.
- **NG-11**: No new operator configuration key, CLI flag, telemetry row, or rendered surface.
- **NG-12**: No live-provider, live-opencode, or OS-process-tree parity claim beyond what the battery can prove (see Appendix C).

## 5. FUNCTIONAL CAPABILITIES

| ID | Capability | Rationale |
|----|------------|-----------|
| F-1 | Durable dispatch-owned lane record and session capture | Resumability requires a record written at acquisition, before the outcome is known. |
| F-2 | Atomic, race-safe admission with declared typed verdicts | A pre-read cannot authorise two invocations; the loser must get its declared identity and holder. |
| F-3 | Recorded-attempt resume resolution | `--resume-prompt` must continue a recorded lane, including `pr-open`, never degrade to a fresh spawn. |
| F-4 | Bounded tracker retry ladder with artifact-first honesty | The shell never invents success from a failed poll and never lets an outage erase decisive artifacts. |
| F-5 | Corroborated-stall termination with an exact identity | A stalled session must not leak, and a restart must not silently run a second session. |
| F-6 | Bounded in-process restart loop | The shell's iterate-until-terminal behaviour must be reproduced inside one dispatch. |
| F-7 | Real spawn identity and lifecycle prompt | The session must run as `pm`, under the deterministic title, with the delivery prompt. |
| F-8 | Total class derivation with the missing arms | Parity requires one pinned order that yields all eleven classes, including tracker-done → `merged` and artifact `partial`. |
| F-9 | Parity battery and no-shell proof | Parity is a proven property, not a claim; the battery must exercise the production seams. |

### 5.1 Capability Details

**F-1 — Durable dispatch-owned lane.** The first attempt for a ref starts with no lane. When a fresh spawn or a resume acquires a session handle, the one-shot path appends exactly one active `dispatch.lane` record for the ref: the session identity, the normalized repository, the attempt identity, the harness kind, the owner process id and its declared start time, a 1-based iteration ordinal, the consumed restart count, `state: "active"`, and the recorded time. When the dispatch reaches its final classification, one terminal lane record carrying `state: "terminal"` and the final token and outcome is appended; a stalled iteration that is restarted appends no terminal lane record, only its `economics.restart` and the next iteration's active record. The latest record for the ref is the lane; records are append-only and latest-wins, mirroring the daemon lane's read shape. A pre-session refusal appends no lane. A lane append that cannot be persisted does not change the delivery token — the attempt record remains the authoritative outcome — but it is disclosed as a bounded `lane:append-failed` evidence reference so resumability is never silently claimed. The lane is dispatch-owned: it is a distinct kind from `daemon.lane`, the daemon family never reads it as a supervised lane and never rewrites it, and the dispatch family never rewrites a daemon lane. The owner process facts are advisory for staleness and operator inspection; the queue lease remains the exclusion mechanism. Source: TDR-0044.

**F-2 — Atomic admission.** The dispatch family's admission verdict is produced by the claim itself, not by a pre-claim observation that a second invocation can race. The winner claims the repository-exclusive lease and proceeds. The loser receives its declared verdict from the live lease observed in the claim: `queue.single-flight` at exit 1 naming the live holder when the live lease records the requested ref under any holder (including the dispatch holder), or `queue.lease-conflict` at exit 1 when a live lease records another ref in the same repository. The dispatch claim never treats another invocation's live same-ref lease as an own-holder renewal; the sibling `queue claim` path's own-holder renewal is untouched. Store-fence contention is a transient claim-contention signal, not a verdict: the claim waits for the fence for a bounded period no greater than the declared queue lease TTL and then re-decides from the observed lease. A refusal always carries a declared error-table kind/code pair; a state failure keeps its `state` kind and exit 2 and is never relabelled `queue`. No admission outcome is contained as `fallback.internal`, no refusal is lost, and a refused dispatch exits its mapped code without crashing with zero attempt records. Source: TDR-0045.

**F-3 — Recorded-attempt resume.** When `--resume-prompt` is supplied, the dispatch resolves the ref's existing lane before any spawn: the newest record with a session identity among the dispatch-owned lane and the daemon lane in a resumable state (`delivering`, `detached`, `preempted`). Any recorded attempt that reached a session is resumable, because the harness session survives the process; the recorded token does not disqualify it, and a recorded `pr-open` or `pr-open-unverified` attempt must attach and continue rather than re-dispatch. The resume mode resolves from the adapter's declared capability (`attach-continue` where resume injection is supported; `resume-prompt-reentry` with its acknowledged prefill cost otherwise) and is recorded on the attempt. An operator-requested resume does not consume a restart ordinal and is not refused by the restart budget; only an automatic restart consumes the budget. With no recorded lane, the dispatch starts a fresh session using the supplied prompt and records that it was a fresh spawn. A recorded lane is never silently replaced by a fresh spawn: if the resume is refused as an unknown session, the attempt is a classified failure with exactly one attempt record, never a fallback spawn and never a success claim. A daemon lane keeps its delivered resumability rule; when both records exist, the newest wins.

**F-4 — Tracker retry ladder.** The tracker truth read is retried at most five times with an exponential wait of `min(2 s * 2^(n-1), 30 s)` between attempts — 2, 4, 8, and 16 seconds — for at most 30 seconds of added latency. A later success is used normally. Exhaustion marks the tracker fact unreadable and names the exhaustion in bounded evidence; it never produces a tracker success claim. After a completed session, the outcome then resolves artifact-first: an open PR, an already-merged PR, commits with complete or incomplete pm-notes, and (only with a readable tracker) the nothing-to-do arm remain available; if no artifact is decisive, the outcome is `state-unverified` at exit 2. A stall does not use this artifact-first resolution; F-5/F-6 govern it, and a decisive artifact short-circuits a stall only as a member of the terminal pre-restart verdict set. The ladder applies to the tracker read only; the other truth reads keep their delivered single-read classification. The ladder is a declared policy constant rather than a new configuration key, and its delay function is injected so the offline battery runs with zero real waits while production uses the declared defaults.

**F-5 — Corroborated-stall termination.** A stall remains a current-state verdict requiring two consecutive sourced no-advance readings; a clean exit is never a stall. A harness-reported timeout is treated as a terminal stall for decision purposes (the session ended incomplete), and terminate is idempotent where the session is already gone. When a stall is still current at collection, the engine invokes the harness terminate operation with the declared grace before any restart decision. The operation sends the terminal signal to the session's process tree first, escalates to kill only after the grace, and reaps any escaped runtime that matches this lane's session identity or its deterministic `ticket-<REF>` title — never a broad pattern that could touch another delivery. It is idempotent and reports whether it terminated, escalated, and reaped. A stall short-circuits only on a member of the terminal pre-restart verdict set (DM-4); a decisive artifact outside that set — `finished`, `partial`, or `noop-lane-nothing-to-do` — does not stop a stall. If truth is undecidable, the attempt is terminal `state-unverified` at exit 2 with the stall evidence; otherwise the loop decides by the bound (F-6). On a terminate-capable adapter, no second session starts until the first is confirmed terminated. On an adapter that declares no terminate capability, the engine starts no second session and applies the same short-circuit rule. The stall verdict and the termination result are recorded as bounded attempt evidence. A stall on a clean or later-progressing session is never terminated. Source: TDR-0046.

**F-6 — In-process restart loop.** One dispatch invocation owns a bounded loop. Each iteration is one session attempt: spawn or resume, watch, collect, terminate if stalled, derive truth, decide. A clean session exit is always terminal: the loop never restarts it, regardless of the harness outcome and the bound. A corroborated liveness stall or a harness-reported timeout is a terminal stall and is restart-eligible; a stall short-circuits only on a member of the terminal pre-restart verdict set (DM-4) — a decisive artifact outside that set (`finished`, `partial`, `noop-lane-nothing-to-do`) does not stop a stall; absent a member, an undecidable truth is terminal `state-unverified` and consumes no restart ordinal; otherwise, below the bound, the loop consumes exactly one restart ordinal, appends exactly one delivered `economics.restart` record with reason `watchdog.liveness-stalled`, resumes the recorded session (a fresh spawn only when no session was ever recorded), and runs the next iteration. At or above the bound, the loop terminates the session, appends the delivered terminal exhaustion record, and produces `max-restarts`. The persisted restart count gates automatic restarts only; it never refuses admission. A dispatch admitted with a persisted count at or above `lane.restart-budget` still runs one iteration, and only a stall in that iteration produces `max-restarts`; a clean exit keeps its own classification. The dispatch appends exactly one attempt record at its terminal classification (or attempt-stage failure); a restarted stalled iteration appends no attempt record, because the attempt record carries a delivery result token and an interrupted iteration has none. The bound is the dispatch lane's own `lane.restart-budget` (default 3, unchanged); `coordinator.restart-budget` (10) governs coordinator supervision and is deliberately not consumed here, and the shell lane's env default of 10 is a shell-lane default, not adopted as the lane bound. A pre-session refusal appends no attempt record. The envelope reports the final token and the consumed restart count. Source: TDR-0047.

**F-7 — Spawn identity and lifecycle prompt.** A production dispatch supplies the lifecycle agent identity `pm` through the spawn contract's caller-agent member; the pure binding resolution produces the single-seat binding and the adapter renders exactly one `--agent pm` together with the binding's resolved `--model`. A fresh spawn also carries exactly one deterministic `--title ticket-<REF>` for the canonical work-item reference; a resume never carries a title. The fresh prompt is the delivery-lifecycle prompt parameterized by the ref and the resolved base branch — state detection, resume sync, actions by state, the eleven-phase lifecycle, and merge authority — not a fixed sentence; a resume uses the operator-supplied resume prompt when present, otherwise the lifecycle prompt. The title and agent are composition facts, not operator flags: no new CLI flag is added and the operator cannot override them. A role-less composition remains role-less and records no binding, preserving the delivered behavior; the production dispatch is not role-less. Source: TDR-0049.

**F-8 — Total class derivation.** The derivation is one total order over the eleven tokens and the attempt-stage failures (Appendix F). The order resolves the shell difference explicitly: a readable tracker whose native state is done yields `merged` first, so a done work item that also carries a blocking label resolves `merged`, not `blocked`. Blocking follows, then the pull-request states, then the artifact completeness ladder: commits with complete pm-notes → `finished`, commits with incomplete or absent pm-notes → `partial`, no commits with a readable non-done non-blocked tracker → `noop-lane-nothing-to-do`. A spawn refusal yields `noop-lane-permission`. A decisive artifact survives an unreadable tracker; only an undecidable truth yields `state-unverified`. The success-corroboration requirement is arm-aware for the two arms whose evidence source changed: a tracker-done `merged` and a nothing-to-do result are corroborated by the tracker fact, which is guaranteed readable by construction, so neither arm creates a false-success incident from absent pm-notes or CI; the corroboration record's tri-state shape is unchanged. The vocabulary, projections, and exits are unchanged. Source: TDR-0048.

**F-9 — Parity battery and no-shell proof.** The battery extends the existing dispatch conformance fixtures and drives the real command path and the real derivation. It replays all eleven classes and adds the two-concurrent-dispatch race, the resume-over-`pr-open` case, the tracker-outage case, the stall/terminate/restart loop, and the spawn-identity case. Every production-only seam is exercised through the same composed function the production path uses (admission claim over a real store, lane resolver over a seeded lane, spawn argv/title/prompt builder, tracker ladder with an injected delay, terminate over an injected streaming starter); no case reimplements a seam. The battery runs with an injected process runner that records and refuses shell invocation, and a static invariant asserts zero shell-execution references and zero script-path literals in the dispatch flow. It states its own proof boundary (Appendix C).

## 6. USER & SYSTEM FLOWS

```
Flow 1: Fresh dispatch with bounded restart
  dispatch <ref>
    → admission preflight + harness admission
    → atomic lease claim (winner)
    → fresh spawn with --agent pm, --title ticket-<ref>, lifecycle prompt
    → append active dispatch.lane (session, owner pid/start, iteration 1)
    → watch while collecting
    → clean exit?  → derive truth artifact-first → terminal token → append terminal lane + one attempt
    → corroborated stall? → terminate (TERM→KILL, exact identity)
        → terminal tracker verdict? → return it, no restart
        → unverified truth? → state-unverified, no restart, no slot
        → below bound? → one economics.restart, resume session, next iteration
        → at/above bound? → max-restarts + exhaustion, stop
```

```
Flow 2: Two concurrent dispatches for the same ref
  A and B both pass preflight and attempt the claim
    → the claim fence serialises them
    → A claims the repository-exclusive lease and proceeds
    → B observes A's live same-ref lease and receives queue.single-flight at exit 1 naming A's holder
    → B appends no attempt and no lane, never fallback.internal, never crashes
```

```
Flow 3: Resume over a recorded pr-open attempt
  dispatch <ref> --resume-prompt "<guidance>"
    → resolve newest recorded lane with a session identity (dispatch-owned or daemon)
    → recorded pr-open attempt found → resume mode from adapter capability
    → attach-continue (no restart ordinal consumed, no budget refusal)
    → continue the session from the phase-ledger position
```

```
Flow 4: Tracker outage with decisive artifacts
  truth read → tracker read fails 5 times (2/4/8/16 s)
    → tracker fact unreadable, exhaustion named in evidence
    → artifact read still decisive (open PR / merged PR / commits + pm-notes)
    → artifact verdict returned
    → no tracker success claim
    → if no artifact is decisive → state-unverified at exit 2
```

```
Flow 5: Parity battery
  conformance battery (offline, deterministic)
    → replay 11 classes + race + resume + outage + stall loop + spawn identity
    → real derivation, real command path, real composed production seams
    → injected runner records zero shell invocations
    → static no-shell invariant
    → reports proven and not-proven surfaces
```

## 7. SCOPE & BOUNDARIES

### 7.1 In Scope

- The durable dispatch-owned lane record, its fields, bounds, latest-wins read, and acquisition/terminal write points.
- Session-identity capture at spawn or resume, persisted before the outcome is known.
- Recorded-attempt resume resolution, including `pr-open`, with the resumable-state rule and the operator-resume budget rule.
- Atomic admission with declared typed verdicts, fence-contention waiting, no own-holder renewal on the dispatch path, and no internal containment.
- The tracker retry ladder with its declared constants, injected delay, and artifact-first exhaustion behaviour.
- The additive harness terminate operation, its capability declaration, grace, idempotence, and exact-identity reap.
- The bounded in-process restart loop, its decision table, restart accounting, and the unchanged `lane.restart-budget` default.
- The production spawn supply of the `pm` agent identity, the deterministic title, and the lifecycle prompt.
- The total derivation order, the two missing arms, and arm-aware success corroboration for those arms.
- The parity battery extension, its production-seam exercises, its determinism, and its no-shell proof.
- The decision log for the admission interpretation, the lane-record home, the resume rule, the terminate contract, the loop, the derivation order, the retry policy, the spawn identity, the battery strategy, and the scope boundaries; a formal decision record is authored only where a decision is judged precedent-setting (the lane-record home is the likeliest candidate).

### 7.2 Out of Scope

- [OUT] The F1b operator surface (`status`, `log`, `is-delivering`, `last-message`, per-ref log persistence); it is GH-354.
- [OUT] The pre-iteration hook, its port, or any replacement hook capability.
- [OUT] Merge, closeout, queue CRUD, provider policy, namespace migration, or installed-binary work.
- [OUT] Any change to the eleven tokens, projection classes, exit codes, attempt-record schema version, error-table rows, or domain kinds.
- [OUT] Any change to the queue contract's sibling `claim` path, its renewal semantics, or repository exclusivity.
- [OUT] Any change to `daemon.lane`, its state vocabulary, or daemon reconciliation ownership.
- [OUT] Deletion or retirement of the shell entry points.
- [OUT] The typed `state-unverified` exit changing to the shell's 1.
- [OUT] The `commitlint` PATH defect (M4-S3).
- [OUT] The shell's log-signature `noop-lane-permission` arm.
- [OUT] New operator configuration keys, CLI flags, telemetry rows, or rendered surfaces.
- [OUT] Live-provider, live-opencode, or OS-process-tree parity beyond the battery's declared proof boundary.

### 7.3 Deferred / Maybe-Later

- The log-signature `noop-lane-permission` arm, once GH-354 makes per-ref lane logs available.
- Adopting the shell lane's env restart default of 10 as the dispatch lane bound; the dispatch bound is `lane.restart-budget` (default 3), while `coordinator.restart-budget` (10) remains the coordinator's own bound.
- A dedicated lane-owned terminate-grace configuration key; the change borrows `coordinator.kill-grace` (identical signalling semantics) and defers a lane key.
- An operator-visible lane inspection surface (`status`/`log`), which is GH-354.
- A shared lane-resolution implementation for one-shot and daemon lanes, if the daemon later needs to resume a one-shot-owned session.
- A configurable retry ladder, if an operator need for tuning appears; today the shell's env keys existed for offline tests, and the typed equivalent is the injected delay.
- A generic process-tree termination seam shared with coordinator supervision, if the exact-identity reap proves useful there.
- Re-pointing the `"pm-notes"` corroboration source from the phase ledger (`phasesComplete`) to the new `pmNotes` artifact fact, or relaxing `isDeliveredEvidence` for the artifact arms. It is a separate decision because it changes a delivered evidence contract for every token and would not by itself suppress the delivered-evidence divergence (the predicate still gates on the ledger). Revisit when the artifact arms' corroboration is revisited as a whole.

## 8. INTERFACES & INTEGRATION CONTRACTS

### 8.1 REST / HTTP Endpoints

No inbound or outbound HTTP endpoint is added, changed, or removed. This change's interfaces are in-process contracts:

| ID | Surface | Contract |
|----|---------|----------|
| API-1 | `dispatch <ref> [--harness <name>] [--resume-prompt <text>]` run contract | One invocation owns zero or more iterations in a bounded loop and returns either a classified pre-session refusal (top-level error, zero attempt records, zero lane records) or a data-bearing envelope whose `result` is the terminal token, whose `restarts` is the consumed restart count, and which is backed by exactly one attempt record at the dispatch's terminal classification. A refusal exits its mapped code and never crashes. |
| API-2 | Admission claim contract | The claim returns exactly one of: claimed (with a lease identity), a same-ref live-lease refusal (`queue.single-flight`, exit 1, holder named), an other-ref live-lease refusal (`queue.lease-conflict`, exit 1), an owner-hold refusal (`queue.precondition.unmet`, reason `owner-hold`), or a typed state failure (its `state.*` kind and exit 2). The refusal's kind and code are always a declared error-table pair. The claim is decided from the live lease observed inside the claim; fence contention is waited on for a bounded period no greater than the queue lease TTL. The dispatch claim never renews another invocation's same-ref lease. A refusal appends no lease, attempt, or lane record. (TDR-0045) |
| API-3 | Resume resolution contract | Given `--resume-prompt`, the resolver returns the newest recorded lane for the ref that carries a session identity (dispatch-owned, or daemon with state `delivering`/`detached`/`preempted`), the resume mode derived from adapter capability, and the completed-phase position; otherwise it returns "no lane". A resolved lane is resumed, never replaced by a fresh spawn. An operator resume consumes no restart ordinal. A resume refusal is an attempt-stage classified failure. |
| API-4 | Tracker truth read contract | A retried read: at most 5 attempts, waits `min(2 s * 2^(n-1), 30 s)`, at most 30 s added. It returns a readable tracker fact (native state and blocking flag) or an unreadable fact with the exhaustion named. It never returns a success-shaped fact from a failed read. The delay function is injected. |
| API-5 | Harness terminate operation | The session port gains an optional terminate member: given a session handle and a grace in milliseconds, it sends the terminal signal to the session's process tree first, escalates to kill only after the grace, and reaps an escaped runtime matched by the lane's session identity or its deterministic title. It is idempotent and returns `terminated`, `escalated`, and `reaped` booleans. A terminate-capable adapter declares the operation; an adapter without it declares a gap and is never asked. The operation is added to the closed harness operation set; no operation is removed or renamed. (TDR-0046) |
| API-6 | Spawn invocation contract | A fresh spawn receives the caller agent identity, the resolved single-seat binding, the deterministic title, and the lifecycle prompt; the adapter renders exactly one `--agent <agent>` and one `--model <seat model>` from the binding, exactly one `--title <title>` for a fresh spawn, and no title for a resume. Absent agent/binding remains role-less. The spawn argv is fixed and never shell-interpreted. (TDR-0049) |
| API-7 | Process execution contract | Every harness process is started with a fixed argv, no shell, and no script path. The dispatch flow invokes no shell script. A process runner that is asked to use a shell or a script path is a defect and must fail by name. |

### 8.2 Events / Messages

No event, message, or telemetry record is added. The `dispatch.lane` record is a durable state record (8.3), not an event. The in-process restart reuses the delivered durable `economics.restart` record and its closed reasons; no new record kind is added for restarts. The delivered attempt, divergence, handover, and authority records keep their schemas. The stall verdict, termination result, lane-append failure, and tracker exhaustion are bounded attempt evidence references, not events.

### 8.3 Data Model Impact

| ID | Element | Description |
|----|---------|-------------|
| DM-1 | Dispatch lane record | A new durable record kind `dispatch.lane` with payload schema `delivery.dispatch.lane.v1`, keyed per ref (`dispatch.lanes:<ref>`) with append-only, latest-wins reads, mirroring the daemon lane's shape. Fields: `schema`, `ref`, `repository`, `attemptId`, `sessionId`, `harnessKind`, `owner: { processId: positive integer, startedAt: ISO timestamp }`, `iterationOrdinal: integer ≥ 1`, `restartsConsumed: integer ≥ 0`, `state: "active" \| "terminal"`, optional `lastToken: DeliveryResultToken` and `lastOutcome: HarnessOutcome` (present only on a terminal record), and `recordedAt`. One active append at each session acquisition and one terminal append at the dispatch's final classification; a restarted stalled iteration appends no terminal record. A record with no held session is never appended. No prompt, transcript, diff, credential, or provider payload. The latest record for the ref is the lane. The kind is dispatch-owned and never read or written by the daemon family. Source: TDR-0044. |
| DM-2 | Attempt-record disclosure | The attempt record's shape is unchanged. It continues to carry `sessionIds` (one per spawn or resume), the binding, the harness facts, the comparison, corroboration, and at most 16 bounded evidence references. It gains no lane field; the lane record is the resumable artifact. A pre-session refusal still appends no attempt. A failed lane append is disclosed as `lane:append-failed`; tracker exhaustion as `tracker:exhausted`; a termination as `terminate:terminated`/`terminate:escalated`/`terminate:reaped`. |
| DM-3 | Artifact completeness fact | The artifact truth read gains a required `pmNotes: "complete" \| "incomplete" \| "absent"` fact: complete means the change's pm-notes document exists and its delivery phase carries a non-null completion; absent means no document; incomplete means present but incomplete, unparseable, or otherwise not complete (the fallible direction is always "not finished"). The existing `branchCommits` and `pr` facts are unchanged. The fact is derived from the delivered pm-notes read/classification; no new external read, file-probe rule, or configuration key is added. |
| DM-4 | Total derivation ladder | One total order over the eleven tokens and the attempt-stage failures (Appendix F), shared unchanged by the one-shot and daemon paths (the daemon path calls the same derivation; there is no second mode). The daemon path inherits tracker-done → `merged`, artifact `partial`, and the ledger-arm retirement, and the plan must carry a regression observation over the daemon path. The order is: pre-session refusal (no token) → attempt-stage failure (spawn failure, resume refusal, unreadable collected evidence) → spawn refusal (`noop-lane-permission`) → tracker-done (`merged`) → blocking (`blocked`) → open PR (`pr-open` / `pr-open-unverified`) → already-merged PR (`merged`) → commits with complete pm-notes (`finished`) → commits with incomplete/absent pm-notes (`partial`) → no commits with a readable non-done non-blocked tracker (`noop-lane-nothing-to-do`) → classifier token → `state-unverified` when truth is undecidable. **Terminal pre-restart verdict set** is the closed set {`merged` from a tracker-done work item, `blocked` from a blocking tracker state, `pr-open` from an open pull-request artifact}; it is the only set that short-circuits a stall, and a decisive artifact outside it does not. The delivered phase-ledger no-work arm is retired: a complete ledger no longer produces `noop-lane-nothing-to-do`, and the token is produced only by the shell arm (no branch commits, no pull request, readable non-done non-blocked tracker). A complete ledger with commits therefore resolves `finished` or `partial`, and a complete ledger with no commits resolves `noop-lane-nothing-to-do` only under the shell condition. The phase ledger's role narrows to the resume position, the delivered-evidence predicate's `progressed` read, and the attempt comparison's `progressed` fact; `ledger.workRemaining` remains carried for compatibility and reporting but no rule reads it as a token gate. The previously blocked-first ordering is replaced: a done work item that also carries a blocking label resolves `merged`. The typed-only exit-0-no-artifact `failed` arm is removed in favour of the parity arms; `failed` remains reachable from the shared classifier's failure outcomes and the spawn-failure identity. Success corroboration is arm-aware for tracker-done `merged` and nothing-to-do (the tracker fact), with the corroboration record's tri-state shape unchanged. The `"pm-notes"` corroboration source remains the phase ledger (`phasesComplete`) and is deliberately not re-pointed at the `pmNotes` artifact fact in this change; a `finished` reached with a divergent ledger is recorded as a delivered-evidence divergence by design — the delivered honesty signal — not as a false success claim about the session, with `falseSuccess` never silently suppressed and no new incident kind. Re-pointing the source or relaxing `isDeliveredEvidence` for the artifact arms is deferred (§7.3). Source: TDR-0048. |
| DM-5 | Terminate capability and contract | `terminate` joins the closed harness operation set. The port member is optional so a port double without it remains a valid role-less/unsupported adapter; its absence, together with a declared gap, means the operation is unsupported. A terminate-capable adapter declares it and implements the process-tree termination and exact-identity reap. The grace is the declared `coordinator.kill-grace` (default 20 000 ms, positive integer), reused rather than duplicated. The operation is idempotent; terminating an already-exited or unknown session is success with `terminated: true`, not an error. A missing capability is never surfaced as a new failure identity; the engine records the stall and resolves truth without synthesizing an identity. Source: TDR-0046. |
| DM-6 | Spawn invocation facts | The spawn contract gains an optional deterministic title member for a fresh spawn (`ticket-<REF>`), validated against the work-item reference grammar and bounded to a short single token; a resume carries none. The caller agent identity `pm` is supplied by the production composition through the existing optional agent member, and the binding is resolved by the delivered pure resolver. The fresh prompt is the delivery-lifecycle prompt parameterized by ref and base branch; the resume prompt is the operator text when supplied, else the same lifecycle prompt. No new CLI flag or operator override exists. Source: TDR-0049. |
| DM-7 | Admission verdict facts | The admission result carries its declared kind and code as a matched pair. The dispatch claim is atomic with the live-lease observation; store-fence contention is waited on for a bounded period no greater than the queue lease TTL. The dispatch claim refuses a live same-ref lease under any holder and never treats it as a renewal; the sibling `queue claim` renewal is unchanged. Repository exclusivity is unchanged. The queue identities and their projections are unchanged. Source: TDR-0045. |
| DM-8 | Retry-ladder policy facts | Declared constants: attempts 5 (integer ≥ 1), base 2 000 ms, cap 30 000 ms, wait `min(base * 2^(n-1), cap)` between attempts, total added latency ≤ 30 000 ms. No configuration key is added. The delay function is injected; production uses a real timer and the battery uses a zero-delay recorder. A read that succeeds within the ladder is used; exhaustion is `state-unverified` unless a decisive artifact resolves the outcome. |
| DM-9 | Parity coverage matrix | One declared row per parity case: eleven result classes, the same-ref and other-ref concurrent admission cases, the `pr-open` resume case, the tracker-outage-with-artifact and tracker-outage-without-artifact cases, the below-bound restart, the at-bound `max-restarts`, the unverified-stall case, the clean-exit terminal case, and the spawn-identity case. Each row names the production seam exercised and the observation asserted. No row may be satisfied by a seam reimplementation. |

### 8.4 External Integrations

No live external integration is added or changed. The parity battery is offline: the opencode session is a scripted session port over an injected streaming starter; the tracker and pull-request reads are deterministic fixtures; the process runner is injected and refuses shell invocation. The live opencode CLI and live GitHub reads remain the production path and are outside the battery's proof boundary (Appendix C).

### 8.5 Backward Compatibility

- **Closed vocabulary invariance.** The eleven tokens, their projection classes, their exits, the attempt-record schema version, the error table, and the domain kinds are unchanged. `state-unverified` stays exit 2; `partial` stays exit 1.
- **Attempt records remain readable.** Pre-change attempt records need no migration; the added facts live on the lane record and on the artifact read, not on the attempt record.
- **Lane absence is classified.** A pre-change state has no `dispatch.lane` records; a resume over it resolves "no lane" and is not fabricated. Daemon lanes keep their delivered resumability states.
- **Daemon lane unchanged.** `daemon.lane`, its state vocabulary, and its reconciliation ownership are untouched; the new lane is a distinct kind.
- **Queue sibling unchanged.** `queue claim`'s own-holder renewal, repository exclusivity, and the `queue.single-flight`/`queue.lease-conflict` identities are unchanged. Only the dispatch path's claim refuses a live same-ref lease under any holder.
- **Configuration unchanged.** No new key; the default values named in 2.1 are unchanged. The in-process loop consumes the dispatch lane's own `lane.restart-budget` (default 3); `coordinator.restart-budget` (10) governs coordinator supervision and is deliberately not consumed by dispatch; the shell lane's env default of 10 is a shell-lane default, not adopted as the lane bound. The terminate grace borrows `coordinator.kill-grace` (20 000 ms) because it is a signalling-grace constant with identical semantics; a dedicated lane key is deferred (§7.3).
- **Grammar unchanged.** No new CLI flag; `--resume-prompt` keeps its name and gains the recorded-attempt resolution semantics; the reference page is reconciled in the documentation phase.
- **Deliberate behaviour changes**, all gated by the parity battery: a done work item that also carries a blocking label now resolves `merged` (was `blocked`); commits with incomplete pm-notes now resolve `partial` (could be `finished`); no commits with a readable non-done non-blocked tracker now resolves `noop-lane-nothing-to-do` (was ledger-dependent); the exit-0-no-artifact `failed` arm is subsumed; a stalled session on a terminate-capable adapter is terminated instead of left running; a single dispatch may now run multiple session iterations in-process.
- **Phase-ledger no-work arm retired.** A complete phase ledger no longer produces `noop-lane-nothing-to-do`; the token requires no branch commits, no pull request, and a readable non-done non-blocked tracker. A lane whose ledger is complete but whose branch carries commits resolves `finished` or `partial`; a complete-ledger lane with no commits resolves `noop-lane-nothing-to-do` only under the shell condition. `ledger.workRemaining` remains carried but no rule reads it as a token gate; `progressed` remains read by the delivered-evidence predicate and the attempt comparison.
- **Stall truth is not completed-session truth.** After a completed session, derivation is artifact-first (F-4/AC-F4-3). At a stall, only the terminal pre-restart verdict set short-circuits; a decisive artifact outside the set does not. A stalled session with commits and complete pm-notes but no terminal pre-restart verdict restarts below the bound.
- **One shared derivation, daemon path included.** The one-shot and daemon paths call the same derivation with no forked behaviour. The daemon path therefore inherits tracker-done → `merged`, artifact `partial`, and the ledger-arm retirement; its attempt-record corroboration keeps its delivered phase-completeness source for `pm-notes`. The plan must carry a regression observation for the daemon path over these arms.
- **`pm-notes` corroboration remains ledger-sourced.** The `"pm-notes"` corroboration source stays the phase ledger (`phasesComplete`) and is deliberately not re-pointed at the new `pmNotes` artifact fact in this change. A `finished` reached with a divergent ledger is recorded as a delivered-evidence divergence by design — the delivered honesty signal — not as a false success claim about the session; `falseSuccess` is never silently suppressed and no new incident kind is added. Re-pointing the source or relaxing `isDeliveredEvidence` for the artifact arms is deferred (§7.3).
- **Documentation moves with the contract.** The two current-truth pages that state the session port exposes no kill operation are reconciled in the documentation phase; the change does not leave a stale "no kill" statement behind.

## 9. NON-FUNCTIONAL REQUIREMENTS (NFRs)

| ID | Requirement | Threshold |
|----|-------------|-----------|
| NFR-1 | Offline determinism | The parity battery performs 0 live network calls and 0 live child-process starts; two consecutive runs produce identical envelopes, attempt counts, and class coverage; a scripted session port and injected truth reads are the only inputs |
| NFR-2 | Bounded tracker retry | At most 5 attempts; waits 2/4/8/16 s by `min(2 s * 2^(n-1), 30 s)`; total added latency ≤ 30 000 ms; a successful attempt within the ladder is used; exhaustion never yields a success claim |
| NFR-3 | Vocabulary and contract invariance | 0 new tokens, 0 projection changes, 0 exit changes, 0 error-table rows, 0 domain kinds, 0 attempt-schema-version changes; `state-unverified` exit 2 and `partial` exit 1 |
| NFR-4 | Attempt and lane cardinality | A pre-session refusal appends 0 attempts and 0 lanes; a dispatch that reaches classification appends exactly 1 attempt record (the terminal attempt), regardless of how many iterations it ran; a restarted stalled iteration appends 0 attempt records and 1 `economics.restart` plus its own active lane record; each session acquisition appends 1 active lane record; the final classification appends 1 terminal lane record; no dispatch appends 2 attempt records; 0 attempt records are written by a resume replay |
| NFR-5 | No shell dependency | 0 shell invocations across the battery and the loop/terminate paths; every spawn is a fixed argv with `shell:false`; 0 script-path literals in the dispatch flow; a planted shell reference fails the invariant by name |
| NFR-6 | Bounded, exact termination | TERM first, KILL only after the declared grace (`coordinator.kill-grace`, 20 000 ms default); total termination bounded; idempotent; the escaped-runtime reap matches only this lane's session identity or `ticket-<REF>` title; 0 unrelated processes signalled |
| NFR-7 | Record bounds and redaction | The lane record carries no prompt, transcript, diff, credential, or provider payload; at most one owner object and one session identity per record; attempt evidence references remain ≤ 16; every diagnostic is single-line and identifier-only |
| NFR-8 | Concurrency safety | 2 concurrent same-ref dispatches yield exactly 1 admitted and 1 `queue.single-flight` naming the holder; 0 `fallback.internal`; 0 double-claim; 0 lost request; 0 crash; fence wait ≤ the queue lease TTL (90 000 ms default) |
| NFR-9 | Resume continuity | 1/1 recorded `pr-open` attempts resume under `--resume-prompt`; 0 fresh spawns when a recorded session identity exists; an unknown session is a classified failure, never a silent fresh spawn |
| NFR-10 | Backward compatibility and proof honesty | Pre-change attempt records and daemon lanes read unchanged; the parity battery exercises real production seams and reimplements none; the battery's proven/not-proven boundary is published in the spec |
| NFR-11 | Configuration invariance | 0 new configuration keys; `lane.liveness-interval` 30 000 ms, `lane.restart-budget` 3, `coordinator.kill-grace` 20 000 ms, and `queue.lease-ttl` 90 000 ms keep their defaults; parity cases pin any non-default bound explicitly |

## 10. TELEMETRY & OBSERVABILITY REQUIREMENTS

- The `dispatch.lane` record is the resumability surface: it is inspectable durable state, not a rendered operator surface in this change (GH-354 owns `status`/`log`).
- The in-process restart appends the delivered `economics.restart` record with reason `watchdog.liveness-stalled`, so the restart count remains durable and cross-invocation admission stays truthful.
- The attempt record gains no field; its bounded evidence references carry the stall verdict trail (`liveness:<verdict>`), the termination result, a lane-append failure, and tracker exhaustion. These are identifiers only and obey the 16-reference bound.
- No new metric, alert, event, telemetry row, or artifact field is introduced. The command audit ledger records the invocation as delivered.
- No prompt, transcript, diff, credential, or provider payload is recorded in any record, evidence reference, or diagnostic.
- A tracker outage is observable as the exhaustion evidence plus `state-unverified` when no artifact is decisive; a decisive artifact outage is observable as the artifact token plus the exhaustion evidence. Neither is a success claim.

## 11. RISKS & MITIGATIONS

| ID | Risk | Impact | Probability | Mitigation | Residual Risk |
|----|------|--------|-------------|------------|---------------|
| RSK-1 | The new lane record drifts from `daemon.lane` or is adopted by daemon reconciliation | H | M | Distinct kind, distinct owner, distinct state vocabulary; the daemon family is asserted never to read or write it; the parity battery seeds both and asserts the newest-wins resolution | L |
| RSK-2 | Termination signals an unrelated process | H | L | Exact-identity matching by this lane's session id or `ticket-<REF>` title; no broad pattern; an audit test asserts zero unrelated signals | M |
| RSK-3 | The in-process loop loops or burns tokens | H | M | A clean exit is always terminal; only a corroborated stall or harness timeout is restart-eligible; an unverified stall is terminal; the bound is the configured budget; each restart is recorded | L |
| RSK-4 | The derivation-order change flips existing verdicts unexpectedly | M | H | The order is pinned in one table (Appendix F); the parity battery asserts every arm, including done+blocked; the changed arms are named in 8.5; the closed vocabulary is unchanged | M |
| RSK-5 | An operator resume of a stale session fails where a fresh spawn would have worked | M | M | The resume is honest (classified failure) and never a silent fresh spawn; the operator can start a fresh dispatch without `--resume-prompt`; the lane's latest state is inspectable | M |
| RSK-6 | The retry ladder masks a persistent tracker outage or delays a verdict | M | L | Five attempts and a 30 s ceiling; exhaustion always names itself; decisive artifacts resolve; otherwise `state-unverified` | L |
| RSK-7 | The parity battery proves fixtures, not live behaviour | H | M | The proof boundary is published (Appendix C); the battery exercises the real production seams; live behaviour remains a deployment observation, not a claim | M |
| RSK-8 | Additive contract churn breaks pinned inventories or test doubles | M | M | Additive optional port member, additive record kind, additive spawn-title fact, additive artifact fact; pinned surfaces updated exactly and proven non-vacuous by mutation | L |
| RSK-9 | Admission waiting hides contention or delays a refusal | M | L | The wait is bounded by the queue lease TTL; the verdict is decided from the live lease; a persistent state failure keeps its typed identity; no request is lost | L |
| RSK-10 | pm-notes completeness is misread, yielding a false `finished` | M | L | Complete requires a present document with a non-null delivery completion; malformed or absent reads as incomplete; the fallible direction is never "finished" | L |
| RSK-11 | Scope creeps into GH-354's operator surface or the retired hook | M | M | Explicit non-goals; no new command, flag, log path, or hook capability; the change adds only the lane record and contract facts named here | L |

## 12. ASSUMPTIONS

- The eleven-token taxonomy, its projections, and its exits are authoritative and unchanged; parity is about which arm produces a token, not about the vocabulary.
- The shell contract quoted in 2.1 is the parity reference; where the typed path had a different rule, the shell rule wins unless a decision below records a deliberate, justified divergence.
- The harness session survives the process, so a recorded session identity is resumable after a clean exit or a terminated stall; a resume refusal is therefore an honest classified failure, not a reason to spawn fresh.
- The delivered queue lease remains the repository exclusion mechanism; atomic admission means deciding the verdict inside the claim, not changing exclusivity.
- `queue.single-flight` is a transient, retryable `user-validation` row at exit 1 that names the holder and never projects through a platform class, so `fallback.internal` is never an acceptable admission outcome.
- The delivered `coordinator.kill-grace` (20 000 ms) is the intended kill grace for the dispatch lane as well; reusing it avoids two keys with the same meaning.
- pm-notes completeness is derivable from the delivered document classification without a new probe rule; a malformed document reads as incomplete.
- The shell's log-signature permission arm is not one of the ticket's ten gaps and has no declared typed observation; it is deferred to GH-354 rather than invented.
- A tracker-done work item is a truthful merge signal even when no pull request is observable, because a closed work item is the canonical merged-and-closed case and the provider client cannot observe a closed-unmerged request.
- The parity battery can exercise the production claim, lane, spawn, retry, and terminate seams through injectable facts and the same composed functions, without starting a real process.
- The existing conformance fixtures and the controlled-proof repository are the correct home for the battery; a second harness would prove a different implementation.

## 13. DEPENDENCIES

| Direction | Item | Notes |
|-----------|------|-------|
| Depends on | Delivered eleven-token taxonomy and result projections | Unchanged; the derivation ladder consumes them |
| Depends on | Delivered one-shot engine (admission, lease, liveness, restart admission, artifact-first derivation) | Extended, not replaced |
| Depends on | Harness session port and the opencode / Claude Code adapters | Gains the additive terminate operation and the spawn-title fact |
| Depends on | Queue lease admission and the per-ref single-flight predicate | The claim is made atomic with the verdict; the sibling path is unchanged |
| Depends on | Tracker, pull-request, ledger, and pm-notes truth reads | The tracker read gains the ladder; the artifact read gains pm-notes completeness |
| Depends on | Durable state ledger, attempt ledger, and economics records | The lane record is a new kind; restarts reuse `economics.restart` |
| Depends on | Lane and coordinator configuration branches | `lane.restart-budget`, `lane.liveness-interval`, `coordinator.kill-grace` are consumed; no key is added |
| Depends on | Dispatch conformance fixtures and the controlled-proof repository | The parity battery extends them |
| Depends on | F0 (GH-346 installable versioned binary) | Deliberately not a blocker: the parity outcomes are engine-local and do not consume the install path (recorded decision, 2026-11-18) |
| Blocks | Retirement of the shell delivery lane | The shell lane cannot be retired until the typed lane is parity-proven |
| Blocks | M4 handover to the typed lane | The handover gate assumes the typed flow has no shell dependency |
| Related | GH-354 (F1b operator surface) | Deferred surface; not a dependency of the core parity outcomes |

## 14. OPEN QUESTIONS

No question blocks this change. Every contract-level fork is settled by a recorded decision in section 15: the AC-2 interpretation and atomic admission (DEC-1), the lane-record home (DEC-2), the resume rule (DEC-3), the terminate contract (DEC-4), the loop and its bound (DEC-5), the total order and corroboration (DEC-6), the retry policy (DEC-7), the spawn identity and prompt (DEC-8), the battery strategy (DEC-9), and the scope boundaries including the deferred permission-log arm (DEC-10). Implementation-decided details are listed in Appendix D and do not reopen any decision.

| ID | Question | Context | Status |
|----|----------|---------|--------|
| — | None | All forks are decided; the remaining details are fixture- or implementation-decided (Appendix D). | Closed |

## 15. DECISION LOG

| ID | Decision | Rationale | Date |
|----|----------|-----------|------|
| DEC-1 | **Admission (ticket AC-2).** Read "two concurrent dispatches both admit" as: each of two concurrent same-ref dispatches receives its declared admission verdict — the winner claims the repository-exclusive lease and proceeds; the loser is refused `queue.single-flight` at exit 1 naming the holder, with no `fallback.internal`, no lost request, and no crash. Fix the mislabelled/mismatched kind/code pair at the non-blocking claim fence; do not change repository exclusivity. Make the verdict atomic with the claim; wait out fence contention for a bounded period no greater than the queue lease TTL; the dispatch claim never renews another invocation's same-ref lease, while the sibling `queue claim` renewal is unchanged. | The delivered `queue.single-flight` row is explicitly a transient, retryable user-validation row at exit 1 that names the holder and never projects through a platform class; `fallback.internal` violates that row. A pre-claim read cannot authorise two invocations, so the verdict must be decided inside the claim. Exclusivity is the contract the ticket protects. | 2026-11-18 |
| DEC-2 | **Lane-record home (ticket DECISION B).** Introduce a distinct dispatch-owned `dispatch.lane` record (`delivery.dispatch.lane.v1`, keyed per ref, latest-wins) rather than extending or reusing `daemon.lane`. It carries session identity, owner process id and start time, a 1-based iteration ordinal, the consumed restart count, harness kind, state, and the terminal token/outcome. | `daemon.lane` is daemon-owned, uses daemon lifecycle states, and is reconciled by the daemon family; reusing it would blur write ownership, misuse `delivering`/`completed`, and make a one-shot lane look adoptable. The attempt record is terminal-only and cannot be written before the outcome is known. A distinct kind keeps ownership, state vocabulary, and resume eligibility honest. | 2026-11-18 |
| DEC-3 | **Resume resolution.** With `--resume-prompt`, resumability is "any recorded lane with a session identity", from the dispatch-owned lane or a daemon lane in `delivering`/`detached`/`preempted`; the newest wins. A recorded `pr-open`/`pr-open-unverified` attempt attaches and continues. An operator resume consumes no restart ordinal and is not refused by the restart budget. With no recorded lane, a fresh spawn is explicit and recorded. A resume refusal is a classified failure, never a silent fresh spawn. | The harness session survives the process, so a recorded session is resumable regardless of its token. The current `delivering/detached/preempted` filter is why a finished one-shot attempt is invisible. An operator resume is guidance, not an automatic restart, so the restart budget must not gate it. | 2026-11-18 |
| DEC-4 | **Terminate contract.** Add `terminate` to the closed harness operation set and an optional port member; a terminate-capable adapter terminates the process tree with TERM first and KILL only after the declared grace, then reaps an escaped runtime matched by this lane's session identity or its deterministic title. Reuse `coordinator.kill-grace` (20 000 ms default) rather than adding a key. The operation is idempotent. A non-capable adapter declares a gap and is never asked; the engine then starts no second session. | The streaming starter already owns an idempotent kill, but the engine cannot reach it and it signals only the direct child. The shell's kill already uses a 20 s grace, and `coordinator.kill-grace` is a signalling-grace constant with identical semantics; borrowing it is deliberate because this change forbids adding a configuration key, and a dedicated lane termination-grace key is deferred (§7.3). Exact-identity matching is the safety boundary. No new failure identity is needed: `harness.capability.gap` already exists. Source: TDR-0046. | 2026-11-18 |
| DEC-5 | **Loop ownership and restart semantics.** The one-shot engine owns a bounded in-process loop. A clean session exit is always terminal. Only a corroborated liveness stall or a harness-reported timeout is restart-eligible. A stall short-circuits only on a member of the terminal pre-restart verdict set (DM-4; a decisive artifact outside it does not stop a stall); an unverified stall is terminal `state-unverified` and consumes no slot; below the bound one restart is consumed (one `economics.restart` with `watchdog.liveness-stalled`) and the recorded session is resumed; at or above the bound the result is `max-restarts` with the delivered exhaustion record. The dispatch appends exactly one attempt record at its terminal classification; a restarted stalled iteration appends none, because the attempt record carries a delivery result token. The bound stays the dispatch lane's own `lane.restart-budget` (default 3); `coordinator.restart-budget` (10) governs coordinator supervision and is deliberately not consumed here; the shell lane's env default of 10 is a shell-lane default, not adopted as the lane bound. A persisted count at or above the bound never refuses admission: the dispatch runs one iteration, and only a stall in it produces `max-restarts`; a clean exit keeps its classification. | The shell's decision table is the parity reference. A clean exit must never be restarted (the shell's bug-fix rationale). A harness timeout terminated an incomplete session, so it is a stall, not a clean exit. An unverified stall is already the end of a five-attempt ladder and retrying would replay the same outage, so it is terminal and consumes no slot. One attempt record per terminal dispatch keeps the record's token honest and matches the delivered one-record-per-invocation contract. Changing a shipped config default is a policy change outside a parity-wiring ticket; the mechanism is proven at any pinned bound. The borrowed `lane.restart-budget` is the dispatch surface's own policy, while `coordinator.restart-budget` remains the coordinator's; neither is the shell lane's env default. Source: TDR-0047. | 2026-11-18 |
| DEC-6 | **Total derivation order and corroboration.** Pin one order: spawn refusal → tracker-done `merged` → blocking `blocked` → open PR → already-merged PR → commits+complete pm-notes `finished` → commits+incomplete/absent pm-notes `partial` → no commits+readable tracker `noop-lane-nothing-to-do` → classifier/no-artifact → `state-unverified` on undecidable truth. A done work item that also carries a blocking label resolves `merged`. The typed-only exit-0-no-artifact `failed` arm is subsumed by the parity arms. Success corroboration is arm-aware for tracker-done `merged` and nothing-to-do (the tracker fact), with the corroboration record shape unchanged. | The shell's tracker order is closed/done first, then blocked, then open PR, then the artifact ladder; pinning it resolves the closed+blocked conflict explicitly. The delivered derivation order tests blocking first, which is the one ordering difference. The two arms' evidence source is the tracker, so requiring pm-notes/CI would create false-success incidents for true merges and true no-ops. The vocabulary and exits stay closed. | 2026-11-18 |
| DEC-7 | **Tracker retry policy.** 5 attempts, base 2 000 ms, cap 30 000 ms, wait `min(base * 2^(n-1), cap)` (2/4/8/16 s), total ≤ 30 s. No new configuration key; the delay function is injected so the battery runs with zero real waits. Exhaustion is `state-unverified` unless a decisive artifact resolves. | The shell's env keys existed so offline tests could zero the sleep, not as operator policy; the typed equivalent is an injected delay. The values are the shell defaults. The ladder applies to the tracker read only, as in the shell. | 2026-11-18 |
| DEC-8 | **Spawn identity and prompt.** The production composition supplies the lifecycle agent identity `pm` through the existing caller-agent member; the resolver produces the binding; the adapter renders one `--agent pm` plus its resolved `--model`. A fresh spawn carries one deterministic `--title ticket-<REF>`; a resume carries none. The fresh prompt is the delivery-lifecycle prompt parameterized by ref and base branch, not a fixed sentence; the resume prompt is the operator text when supplied. The title/agent are composition facts; no new flag and no operator override. A role-less composition stays role-less. | The spawn contract and runtime already carry the agent/binding; what is missing is the production supply. The title has no seam, so it is added as a bounded optional spawn fact. The prompt must carry the lifecycle the shell carried; a constant sentence is not parity. Keeping the facts out of the CLI preserves the grammar and the reference surface. | 2026-11-18 |
| DEC-9 | **Parity battery strategy.** Extend the existing dispatch conformance fixtures and drive the real command path and derivation. Add the race, resume, outage, stall/restart, and spawn-identity cases. Exercise each production-only seam through the same composed function the production path uses (claim over a real store, lane resolver over a seeded lane, spawn builder, ladder with an injected delay, terminate over an injected streaming starter). Prove no-shell with an injected runner that records and refuses shell invocation plus a static invariant. Publish the proven/not-proven boundary. | The current conformance fixture composes the edge runtime with a stub claim and injected reads, so it never touches the production seams where the defects live. A second harness would prove a second implementation. A runner guard and a static scan are the only honest no-shell proofs for an offline battery. | 2026-11-18 |
| DEC-10 | **Scope boundaries.** Do not add the shell's log-signature `noop-lane-permission` arm (defer to GH-354's per-ref logs); do not build the F1b operator surface; do not delete the shell entry points; do not port the retired hook; do not add a configuration key, CLI flag, telemetry row, error row, or domain kind. The shell lane's env restart default of 10 is a shell-lane default, not adopted as the dispatch bound; `coordinator.restart-budget` (10) remains the coordinator supervision bound and is not consumed by dispatch. | The ticket's F1a is gaps 1–10; the permission-log arm is not one of them, and the typed lane has no declared permission-rejection observation. Deletion and operator surfaces are separate acts. Additive contract discipline keeps the closed vocabulary and the config surface stable. | 2026-11-18 |
| DEC-11 | **Evidence-corroboration boundary (R7).** The `"pm-notes"` corroboration source remains the phase ledger (`phasesComplete`) and is not re-pointed at the `pmNotes` artifact fact in this change. A `finished` reached with a divergent ledger is recorded as a delivered-evidence divergence by design — the delivered honesty mechanism — not as a false success claim about the session; `falseSuccess` is not silently suppressed, and no new incident kind is added. Re-pointing the source or relaxing `isDeliveredEvidence` for the artifact arms is deferred to a separate decision. | The delivered `isDeliveredEvidence` and the delivered-evidence divergence are TDR-0024's honesty mechanism for the registry-versus-artifact disagreement case; changing the source would change a delivered evidence contract for every token and would not by itself suppress the divergence because the predicate still gates on the ledger. Change-local; no separate TDR. | 2026-11-19 |

### 15.1 Decision records

The six independent records below are the governing decision record for the mapped entries; they are cited here, not restated. DEC-3, DEC-7, DEC-9, DEC-10, and DEC-11 are change-local decisions recorded in this spec only; DEC-11 cites the delivered TDR-0024 evidence contract and does not create a new record.

| DEC | Decision record |
|-----|-----------------|
| DEC-1 | TDR-0045 — Atomic Dispatch Admission |
| DEC-2 | TDR-0044 — Dispatch-Owned Durable Lane Record |
| DEC-4 | TDR-0046 — Harness `terminate` Operation |
| DEC-5 | TDR-0047 — In-Process Bounded Restart Loop |
| DEC-6 | TDR-0048 — Total Derivation Ladder and Arm-Aware Corroboration |
| DEC-8 | TDR-0049 — Dispatch Spawn Identity — Agent, Title, and Lifecycle Prompt |

## 16. AFFECTED COMPONENTS (HIGH-LEVEL)

| Component | Impact |
|-----------|--------|
| One-shot dispatch engine | Extended: bounded loop, terminate decision, lane writes, total derivation consumption |
| Dispatch result derivation | Changed: total order, tracker-done→merged, artifact partial, nothing-to-do condition, arm-aware corroboration |
| Harness session port | Additive: optional terminate operation, spawn-title fact |
| opencode adapter | Implements terminate over the streaming starter; renders title; unchanged otherwise |
| Claude Code adapter | Declares the terminate gap; remains a blocking one-shot spawn |
| Queue lease admission | The dispatch claim becomes atomic with the verdict; the sibling claim path is unchanged |
| Dispatch composition (production) | Supplies the `pm` agent identity and binding, the title, the lifecycle prompt, the owner facts, and the lane store/read |
| Truth reads | Additive pm-notes completeness fact; tracker read gains the ladder |
| Durable state | New `dispatch.lane` record kind; `economics.restart` reused |
| Conformance fixtures and controlled-proof repository | Extended into the parity battery |
| Configuration | Values unchanged; `lane.restart-budget`, `lane.liveness-interval`, `coordinator.kill-grace`, `queue.lease-ttl` consumed |
| Current-truth documentation | Reconciled in the documentation phase (Appendix A) |

## 17. ACCEPTANCE CRITERIA

### 17.1 Durable lane and session capture (F-1)

| ID | Criterion | Gap | Linked |
|----|-----------|-----|--------|
| AC-F1-1 | **Given** an admitted fresh dispatch that acquires a session, **when** the handle is acquired, **then** exactly one active `dispatch.lane` record for the ref is appended carrying the session identity, normalized repository, attempt identity, harness kind, owner process id and declared start time, a 1-based iteration ordinal, the consumed restart count, `state: "active"`, and the recorded time; a pre-session refusal appends none. | PG-1, PG-2 | F-1, DM-1, NFR-4 |
| AC-F1-2 | **Given** active lane records and a dispatch that reaches its final classification, **when** the dispatch ends, **then** one terminal lane record carries the final token and outcome, the latest record for the ref is the lane, and records are append-only with latest-wins reading; a restarted stalled iteration appends no terminal record. | PG-1 | F-1, DM-1 |
| AC-F1-3 | **Given** a lane record that cannot be persisted, **when** the attempt continues, **then** the attempt record is still appended, the token is unchanged, and the attempt carries a bounded `lane:append-failed` evidence reference; resumability is never silently claimed. | PG-1 | F-1, DM-2, NFR-7 |
| AC-F1-4 | **Given** pre-change state with no `dispatch.lane` records, **when** a dispatch runs and a resume is requested, **then** the absence is classified as "no lane" and nothing is fabricated; pre-change attempt records and daemon lanes read unchanged, and the daemon family never reads or writes the dispatch lane. | PG-1 | F-1, DM-1, NFR-10 |

### 17.2 Atomic admission (F-2)

| ID | Criterion | Gap | Linked |
|----|-----------|-----|--------|
| AC-F2-1 | **Given** two concurrent dispatches for the same ref with no pre-existing lease, **when** both attempt admission, **then** exactly one claims the repository-exclusive lease and proceeds, and the other receives `queue.single-flight` at exit 1 naming the live holder, appends no attempt and no lane, and never receives `fallback.internal`. | PG-4 (ticket AC-2) | F-2, API-2, NFR-8 |
| AC-F2-2 | **Given** a live lease on another ref in the same repository, **when** a dispatch admits, **then** it receives `queue.lease-conflict` at exit 1 as a pre-session refusal with no attempt and no lane, and never `fallback.internal`. | PG-4 | F-2, API-2 |
| AC-F2-3 | **Given** store-fence contention during the claim, **when** the fence becomes available, **then** the verdict is decided from the live lease observed inside the claim (winner/loser), contention is never surfaced as a `queue`-kind envelope or `fallback.internal`, and a persistent state failure keeps its `state.*` kind and exit 2 with a bounded wait no greater than the queue lease TTL. | PG-4 | F-2, DM-7, NFR-8 |
| AC-F2-4 | **Given** a refused admission, **when** the command exits, **then** it exits the refusal's mapped code without crashing, and an attempts read for that ref returns the empty-history success with zero records. | PG-4 | F-2, NFR-8 |
| AC-F2-5 | **Given** the sibling `queue claim` path, **when** its holder claims its own live same-ref lease, **then** the delivered renewal behaviour is unchanged; only the dispatch claim refuses a live same-ref lease under any holder and never renews. | PG-4 | F-2, DM-7 |

### 17.3 Recorded-attempt resume (F-3)

| ID | Criterion | Gap | Linked |
|----|-----------|-----|--------|
| AC-F3-1 | **Given** a recorded attempt that reached a session and whose token is `pr-open`, **when** `--resume-prompt` is supplied, **then** the dispatch resolves the recorded lane and resumes it (attach-continue where the adapter supports resume injection), never a fresh spawn, and records the resume mode on the attempt. | PG-3 (ticket AC-3) | F-3, API-3 |
| AC-F3-2 | **Given** any recorded attempt with a session identity, **when** `--resume-prompt` is supplied, **then** the lane is resumable and the restart budget does not refuse it; only an automatic restart consumes an ordinal. | PG-3 | F-3, API-3, DM-7 |
| AC-F3-3 | **Given** no recorded lane for the ref, **when** `--resume-prompt` is supplied, **then** a fresh session starts with the supplied prompt and the fresh-spawn fact is recorded; a recorded lane is never silently replaced by a fresh spawn. | PG-3 | F-3, API-3 |
| AC-F3-4 | **Given** a recorded lane whose session the adapter reports unknown, **when** the resume is attempted, **then** the attempt is a classified failure with exactly one attempt record, never a silent fresh spawn and never a success claim. | PG-3 | F-3, API-3, NFR-9 |

### 17.4 Tracker retry ladder (F-4)

| ID | Criterion | Gap | Linked |
|----|-----------|-----|--------|
| AC-F4-1 | **Given** a tracker read that fails transiently and then succeeds, **when** the truth read runs, **then** at most 5 attempts are made with waits 2/4/8/16 s (total ≤ 30 s) and the successful read is used. | PG-5 | F-4, API-4, NFR-2 |
| AC-F4-2 | **Given** a tracker read that fails every attempt and no decisive artifact, **when** the outcome is derived, **then** the result is `state-unverified` at exit 2 with the tracker exhaustion named in evidence, never a success claim. | PG-5 (ticket AC-4) | F-4, API-4 |
| AC-F4-3 | **Given** a completed session (not a stall) whose tracker read fails every attempt and a decisive artifact (open PR, already-merged PR, commits with complete or incomplete pm-notes), **when** the outcome is derived, **then** the artifact verdict is the result and no tracker success is claimed; the exhaustion is named in evidence. | PG-5 (ticket AC-4) | F-4, API-4, DM-3 |
| AC-F4-4 | **Given** the ladder, **when** inspected, **then** it adds no configuration key and resolves no ambient delay; the delay is injected so an offline battery runs with zero real waits while production uses the declared defaults. | PG-5 | F-4, DM-8, NFR-11 |

### 17.5 Stall termination (F-5)

| ID | Criterion | Gap | Linked |
|----|-----------|-----|--------|
| AC-F5-1 | **Given** two consecutive sourced no-advance readings and a stall still current at collection, **when** the engine decides, **then** it sends TERM to the session's process tree first, KILL only after the declared grace, and records the stall verdict and termination result as bounded attempt evidence. | PG-6 | F-5, API-5, NFR-6 |
| AC-F5-2 | **Given** a clean exit or a stall cleared by later progress, **when** the loop decides, **then** no terminate is invoked and no restart occurs. | PG-6 | F-5, API-5 |
| AC-F5-3 | **Given** a terminal stall, **when** truth is resolved, **then** the attempt short-circuits without a restart only when the truth is a member of the terminal pre-restart verdict set (`merged` from a tracker-done work item, `blocked` from a blocking tracker state, `pr-open` from an open pull-request artifact); a decisive artifact outside the set (`finished`, `partial`, `noop-lane-nothing-to-do`) does not short-circuit, and an undecidable truth is terminal `state-unverified`. | PG-6 | F-5, API-5, DM-4 |
| AC-F5-4 | **Given** an adapter that declares no terminate capability, **when** a terminal stall is corroborated, **then** the engine starts no second session; it returns a terminal verdict if one exists, otherwise `state-unverified` at exit 2 with the stall evidence. | PG-6 | F-5, API-5, DM-5 |
| AC-F5-5 | **Given** a terminate invocation, **when** it completes, **then** it is idempotent, signals only the session's process group and any escaped runtime matched by this lane's session identity or `ticket-<REF>` title, reports terminated/escalated/reaped, and signals no unrelated process. | PG-6 | F-5, API-5, NFR-6 |

### 17.6 In-process restart loop (F-6)

| ID | Criterion | Gap | Linked |
|----|-----------|-----|--------|
| AC-F6-1 | **Given** a corroborated liveness stall or harness-reported timeout below the bound with no terminal pre-restart verdict, **when** the loop restarts, **then** it consumes exactly one restart ordinal, appends exactly one `economics.restart` record with reason `watchdog.liveness-stalled`, appends no attempt record for the restarted iteration, resumes the recorded session (a fresh spawn only when no session was ever recorded), and runs the next iteration. | PG-7 | F-6, NFR-4, DM-1 |
| AC-F6-2 | **Given** a corroborated stall at or above the bound, **when** the loop decides, **then** it terminates the session if capable, produces `max-restarts` with exactly one attempt record and the delivered terminal exhaustion record, and starts no further session. | PG-7 | F-6, DM-5 |
| AC-F6-3 | **Given** an unverified truth on a stalled session, **when** the loop decides, **then** it consumes no restart ordinal, terminates with `state-unverified` at exit 2, and starts no second session. | PG-7 | F-6, DM-4 |
| AC-F6-4 | **Given** any clean session exit, **when** the loop decides, **then** it never restarts regardless of the harness outcome or the bound. | PG-7 | F-6, DM-4 |
| AC-F6-5 | **Given** an envelope after a loop, **when** rendered, **then** `restarts` equals the consumed ordinals, `result` is the terminal token, the dispatch has exactly one attempt record, no dispatch has two, and a pre-session refusal has none; the bound is the configured `lane.restart-budget` (default 3) and no key or default is added. | PG-7 | F-6, NFR-4, NFR-11 |
| AC-F6-6 | **Given** a dispatch admitted with a persisted restart count at or above `lane.restart-budget`, **when** it runs, **then** the persisted count does not refuse admission and exactly one iteration runs; a clean exit keeps its own classification, and only a stall in that iteration produces `max-restarts` with exactly one attempt record and the delivered exhaustion record. | PG-7 | F-6, DM-4, NFR-4 |

### 17.7 Spawn identity and prompt (F-7)

| ID | Criterion | Gap | Linked |
|----|-----------|-----|--------|
| AC-F7-1 | **Given** a production dispatch that spawns, **when** its invocation is built, **then** it carries the caller agent identity `pm` through the binding seam, renders exactly one `--agent pm` plus its resolved `--model`, and uses a fixed argv with no shell. | PG-8 | F-7, API-6, API-7 |
| AC-F7-2 | **Given** a fresh spawn, **when** its arguments are built, **then** it carries exactly one deterministic `--title ticket-<REF>` for the canonical reference; a resume carries no title. | PG-8 | F-7, API-6, DM-6 |
| AC-F7-3 | **Given** a fresh spawn, **when** its prompt is built, **then** it is the delivery-lifecycle prompt parameterized by ref and base branch (state detection, resume sync, actions by state, eleven-phase lifecycle, merge authority), not a fixed sentence; a resume uses the operator prompt when supplied, else the lifecycle prompt. | PG-8 | F-7, API-6, DM-6 |
| AC-F7-4 | **Given** a role-less composition, **when** it spawns, **then** it stays role-less and records no binding; the production dispatch is not role-less, no CLI flag is added, and the operator cannot override the agent or title. | PG-8 | F-7, API-6, NFR-10 |

### 17.8 Total class derivation (F-8)

| ID | Criterion | Gap | Linked |
|----|-----------|-----|--------|
| AC-F8-1 | **Given** a readable tracker whose native state is done and no visible PR, **when** the outcome is derived, **then** the result is `merged`, corroborated by the tracker fact, and no false-success incident is created by absent pm-notes or CI. | PG-10 | F-8, DM-3, DM-4 |
| AC-F8-2 | **Given** a readable tracker that is done and also carries a blocking label, **when** the outcome is derived, **then** the result is `merged` (tracker-done wins), which is the declared resolution of the current blocked-first ordering. | PG-10 | F-8, DM-4 |
| AC-F8-3 | **Given** branch commits greater than zero and complete pm-notes, **when** the outcome is derived, **then** the result is `finished`; **given** commits greater than zero and incomplete or absent pm-notes, **then** the result is `partial`, distinct from `finished`, and the harness outcome is carried; **and given** commits greater than zero, complete pm-notes, and a ledger that has not progressed and is not complete, **then** the result is still `finished`, and any divergence raised is a delivered-evidence divergence with the delivered shape and dedupe; `falseSuccess` is never silently suppressed and no new incident kind is added. | PG-9 | F-8, DM-3, DM-4 |
| AC-F8-4 | **Given** no branch commits and a readable, non-done, non-blocked tracker, **when** the outcome is derived, **then** the result is `noop-lane-nothing-to-do`, corroborated by the tracker fact; when the tracker is unreadable this arm is not taken, and a complete phase ledger alone does not produce the token. | PG-9, PG-10 | F-8, DM-3, DM-4 |
| AC-F8-5 | **Given** the total order, **when** all eleven classes are replayed, **then** each token is produced by exactly its declared arm in the pinned order (Appendix F), no two arms claim the same input, and the eleven tokens, projections, and exits are unchanged, including `state-unverified` at exit 2 and `partial` at exit 1. | PG-9, PG-10 | F-8, DM-4, NFR-3 |

### 17.9 Parity battery and no-shell proof (F-9)

| ID | Criterion | Gap | Linked |
|----|-----------|-----|--------|
| AC-F9-1 | **Given** the parity battery, **when** it runs, **then** it replays all eleven result classes with fixtures through the real derivation and command path, asserts each token and exit, and extends the existing dispatch conformance fixtures rather than a parallel harness. | PG-1…PG-10 (ticket AC-1) | F-9, NFR-1, NFR-10 |
| AC-F9-2 | **Given** each parity case, **when** inspected, **then** it exercises the real production seam for that case (claim over a real store, lane resolver over a seeded lane, spawn builder, ladder with injected delay, terminate over an injected streaming starter) and reimplements none. | PG-1…PG-10 | F-9, DM-9, NFR-10 |
| AC-F9-3 | **Given** two consecutive battery runs, **when** their outputs are compared, **then** envelopes, attempt counts, and class coverage are identical, with zero live network calls and zero live child processes. | PG-5, PG-7 | F-9, NFR-1 |
| AC-F9-4 | **Given** the whole battery plus the race, resume, loop, and terminate cases, **when** it runs, **then** the injected process runner records zero shell invocations, no shell script is executed, and every spawn uses fixed argv with `shell:false`. | PG-8 (ticket AC-5) | F-9, API-7, NFR-5 |
| AC-F9-5 | **Given** the dispatch implementation surface, **when** the no-shell invariant check runs, **then** it finds zero shell-execution references and zero script-path literals, and a planted reference fails it by name; the battery's proven and not-proven boundary is published (Appendix C). | PG-8 (ticket AC-5) | F-9, API-7, NFR-5, NFR-10 |

## 18. DEFINITION OF DONE

The change is done only when every item below is observed, not merely asserted. The AC count is 42 (reconciled against section 17), and each item names the evidence that closes it.

| ID | Definition-of-Done item | How observed |
|----|-------------------------|--------------|
| DOD-1 | All 42 acceptance criteria are satisfied, each with named evidence. | The test plan's traceability matrix maps every `AC-*` (42/42, reconciled against section 17) to at least one passing test or an equivalent named observation; the coverage check fails naming any AC with no passing evidence. |
| DOD-2 | The aggregate quality gate is green. | `TMPDIR=$PWD/tmp/tmpdir pnpm check` exits 0; the captured log is attached to the change; no check is skipped, disabled, or made vacuous. |
| DOD-3 | The branch-range commit-message gate is `PASS`. | The repository's range lint gate prints `PASS` over the change branch's own commit range (not `SKIP` and not an unresolved `ERROR`); the verdict is recorded as a pm-notes `notes:` entry. |
| DOD-4 | The parity battery is complete, deterministic, and offline. | Two consecutive battery runs each assert 11/11 result classes by token and exit; a canonicalized comparison of the two runs is identical for envelopes, attempt counts, and class coverage; the injected network and child-process guards record 0 calls across both runs. |
| DOD-5 | The no-shell invariant is green with its non-vacuity control. | The injected process runner records 0 shell invocations and no script path across the whole battery and the loop/terminate cases; the static invariant finds 0 shell-execution references and 0 script-path literals; a planted reference fails the check by name. |
| DOD-6 | Current-truth documentation is reconciled with no residual gap. | Every page named in Appendix A is updated in the documentation phase; a scan for the stale "no kill operation" phrasing returns 0 hits on the two current-truth pages; the dispatch and harness pages state the terminate contract, the dispatch lane record, the resume rule, and the total derivation order; no documented gap remains. |
| DOD-7 | The closed contracts are unchanged. | A contract diff or invariant check shows 0 token, projection, or exit changes, 0 new or changed error-table rows, 0 new domain kinds, and 0 new configuration keys; the eleven-token taxonomy and the configuration-defaults table are identical to the delivered baseline. |
| DOD-8 | The de-scoped surface stays out. | The delivered diff contains no `status`, `log`, `is-delivering`, `last-message`, per-ref log persistence, hook port, shell deletion, or queue-contract change; the five de-scoped ticket tasks trace to GH-354 in Appendix B. |

## 19. ROLLOUT & CHANGE MANAGEMENT (HIGH-LEVEL)

- Delivered as one change on `feat/GH-347/dispatch-core-parity` targeting the tooling integration branch; merge authority stays outside this change.
- Landed by outcome so each contract is proven with the evidence that depends on it: (1) the lane record and session capture; (2) atomic admission; (3) recorded-attempt resume; (4) the tracker ladder and artifact honesty; (5) the terminate contract and stall decision; (6) the in-process loop; (7) spawn identity and prompt; (8) the total derivation order; (9) the parity battery and no-shell proof; (10) current-truth documentation.
- No feature flag. The changes are the intended typed-lane behaviour, and the parity battery is the regression gate. A repository that still relies on the shell lane keeps it: the shell entry points are not deleted, and the change proves the typed flow has no shell dependency without forcing a cutover.
- Operator-facing behaviour changes are limited to the dispatch command's lifecycle outcome and to the `--resume-prompt` semantics; both are documented in the reference page during the documentation phase. No new flag, command, or output key is added.
- Release impact is a minor version change: dispatch semantics change for a pre-1.0 CLI, with no vocabulary, schema-version, or error-table change.
- Communication is internal to the dispatch, harness, queue, and conformance owners. Reviewers should read the derivation table and the parity coverage matrix as the authoritative parity statement.

## 20. DATA MIGRATION / SEEDING (IF APPLICABLE)

No migration is required. The `dispatch.lane` record is a new additive kind; it needs no backfill, and its absence is a classified "no lane" state. Pre-change attempt records, daemon lane records, and economics records remain readable under their delivered schemas. No persisted record is rewritten, no key is renamed, and no schema version is bumped.

## 21. PRIVACY / COMPLIANCE REVIEW

- No personal data is introduced. The lane record carries a process id, a declared start time, a work-item reference, a repository identity, and a session identity — operational identifiers already present in the delivered attempt and daemon records. It carries no prompt, transcript, diff, credential, or provider payload.
- Process ids and start times are used for staleness and operator inspection only; they are not personal identifiers and are not exported beyond the durable state.
- The parity battery uses synthetic fixtures, example hosts, and scripted sessions; it records no live provider payload and no credential material.
- The title is derived from the public work-item reference and is validated against the work-item grammar; the prompt is data, not a shell fragment.
- No telemetry flow is added, so no new personal-data flow exists.

## 22. SECURITY REVIEW HIGHLIGHTS

- **Termination is a privilege boundary.** The terminate operation signals only the session's process tree and an escaped runtime matched by this lane's exact session identity or deterministic title. It never uses a broad process-name pattern, never signals another delivery, is idempotent, and respects the declared grace before escalation.
- **No shell injection surface.** Spawns use fixed argv with no shell; the title and reference are validated against the work-item grammar before interpolation; the prompt is passed as data. The dispatch flow never invokes a script path.
- **No internal containment for admission.** A refusal always carries its declared kind/code pair; a state failure keeps its state identity and exit 2; `fallback.internal` is never an admission verdict. This prevents a race from masquerading as an internal defect or a platform failure.
- **No second error system.** No new error-table row, domain kind, or failure identity is added. The terminate gap reuses the delivered harness capability identity; the lane-append failure and tracker exhaustion are evidence references, not identities.
- **Honest unknown.** A tracker outage never yields a success claim; an unknown session never silently spawns fresh; an unsupported terminate never starts a second session. Silent degradation is the primary failure mode this change removes.
- **Secret hygiene.** The lane record and every diagnostic are identifier-only; no credential, environment value, prompt, or provider payload is recorded. The existing secret-read boundary is untouched.
- **Scope safety.** No operator surface, hook, merge, closeout, or queue-contract change is introduced, so the security review surface is the termination boundary and the admission verdict, both explicitly bounded.

## 23. MAINTENANCE & OPERATIONS IMPACT

- **New durable surface:** the dispatch lane record. It is a small, append-only, latest-wins record; adding a field or state is a recorded contract change, not a convention.
- **New port operation:** terminate, capability-gated and declared. An adapter that cannot terminate declares a gap and keeps the honest no-second-session behavior.
- **One prompt source and one derivation table.** The lifecycle prompt and the eleven-arm order are declared data, so a reviewer can see the parity claim without reading test code; a change to either is visible.
- **The parity battery is the regression gate.** A future change that moves an arm, breaks resume, reintroduces a shell dependency, or loses the lane record fails a named case. Adding a class arm means adding a row to the coverage matrix and the derivation table.
- **No new operational surface:** no command, flag, job, artifact, alert, or configuration key. On-call sees an ordinary dispatch outcome with bounded evidence.
- **The shell remains as the documented fallback** until a separate handover retires it; this change does not delete or modify the shell entry points.
- **Cost:** the in-process loop can run multiple attempts per invocation, bounded by `lane.restart-budget`; the retry ladder adds at most 30 seconds only when the tracker is failing; the parity battery is in-process and deterministic.

## 24. GLOSSARY

| Term | Definition |
|------|------------|
| Dispatch lane | The durable, dispatch-owned per-ref record that makes a session resumable: session identity, owner process id and start time, iteration ordinal, consumed restarts, and state. |
| Active lane record | The lane record appended when a session identity is acquired; it is resumable before the outcome is known. |
| Terminal lane record | The lane record appended when an attempt reaches classification; it carries the final token and outcome. |
| Admission verdict | The declared answer to a dispatch's claim: claimed, `queue.single-flight` with a holder, `queue.lease-conflict`, `owner-hold`, or a typed state failure. |
| Atomic admission | Deciding the admission verdict from the live lease observed inside the claim, so a pre-claim observation cannot authorise two invocations. |
| Recorded-attempt resume | Resuming the newest recorded lane with a session identity under `--resume-prompt`, including a `pr-open` attempt, instead of spawning fresh. |
| Tracker retry ladder | The bounded 5-attempt, 2/4/8/16-second retry of the tracker read; exhaustion never claims success. |
| Decisive artifact | Artifact evidence (open PR, already-merged PR, commits with pm-notes completeness) sufficient to resolve a completed session's outcome without the tracker; at a stall it short-circuits only when it is a member of the terminal pre-restart verdict set. |
| Terminal pre-restart verdict set | The closed set {`merged` from a tracker-done work item, `blocked` from a blocking tracker state, `pr-open` from an open pull-request artifact}; it is the only set that short-circuits a stall. |
| Corroborated stall | Two consecutive sourced no-advance liveness readings still current when evidence collection resolves; the only restart-eligible outcome. |
| Terminate | The capability-gated harness operation that signals a session's process tree and reaps an escaped runtime by exact identity within a declared grace. |
| Exact-identity reap | Matching an escaped runtime only by this lane's session identity or its deterministic title, never by a broad process pattern. |
| In-process restart | A further attempt executed inside the same dispatch invocation after a corroborated stall, consuming one restart ordinal. |
| Arm-aware corroboration | Requiring the evidence source that actually produced a success arm (the tracker fact for tracker-done `merged` and nothing-to-do) rather than a fixed token-level set. |
| Parity battery | The offline, deterministic conformance suite that replays every result class and the production-specific seams and proves the no-shell invariant. |

## 25. APPENDICES

### 25.1 Appendix A — Phase-7 documentation impacts

| Document | Required reconciliation |
|----------|-------------------------|
| `doc/spec/features/feature-dispatch-engine.md` | Rewrite the one-shot flow for the durable lane, recorded-attempt resume, atomic admission, tracker ladder, terminate, in-process loop, spawn identity/prompt, total derivation order, and arm-aware corroboration; expand the per-ref single-flight table with the atomic-claim and busy-wait rules; update the result-derivation bullets and the failure-token mapping; **replace the stale sentence that the session port exposes no kill operation** (one-shot step 7). |
| `doc/spec/features/feature-session-lifecycle-economics.md` | **Replace both stale "no kill operation" statements** (the one-shot stall paragraph and the one-shot stall bullet) with the terminate contract and the no-second-session rule; record that an in-process restart appends `economics.restart` with `watchdog.liveness-stalled`; keep the budget, liveness, and prefill safety statements. |
| `doc/spec/features/feature-harness-adapters.md` | Add `terminate` to the harness operation set and capability declaration, with the grace, idempotence, process-tree, and exact-identity reap semantics; add the fresh-spawn title fact; state that the opencode adapter supports terminate and the Claude Code adapter declares the gap; update the spawn-argument description for `--agent pm`, `--title ticket-<REF>`, and the lifecycle prompt. |
| `doc/spec/features/feature-resident-daemon.md` | State that `dispatch.lane` is a distinct dispatch-owned record, that `daemon.lane` is unchanged, and that daemon reconciliation never adopts or rewrites a dispatch lane; keep the daemon resumability states. |
| `doc/spec/features/feature-delivery-lifecycle.md` | State that the typed dispatch lane is parity-complete for the eleven classes and the shell's supervision semantics, that it has no shell dependency, and that the shell remains the documented fallback until a separate handover. |
| `doc/spec/features/feature-queue-ready.md` (or the queue-reference page) | Record that the dispatch claim decides the same-ref/other-ref verdict inside the claim, waits out fence contention within the lease TTL, and never surfaces `fallback.internal`; keep the sibling `queue claim` renewal and repository exclusivity unchanged. |
| `doc/spec/features/feature-config-layer.md` (or the configuration reference) | Record that no key is added; `lane.restart-budget`, `lane.liveness-interval`, `coordinator.kill-grace`, and `queue.lease-ttl` are consumed by the dispatch lane; state the unchanged defaults. |
| `doc/spec/features/feature-result-contract.md` | Confirm the eleven tokens, projections, exits, and error table are unchanged; record that the new lane record is not an error identity and that no row or domain kind is added. |
| `doc/guides/` dispatch reference page (and the command reference) | Clarify `--resume-prompt` over a recorded attempt, including a `pr-open` attempt; state that the agent identity and title are internal and there is no new flag; keep the four-key text contract. |
| `doc/overview/glossary.md` and the documentation index | Add dispatch lane, atomic admission, recorded-attempt resume, tracker retry ladder, corroborated stall, terminate, exact-identity reap, in-process restart, arm-aware corroboration, and parity battery; index the updated dispatch and harness pages. |
| Help/reference coverage | `dispatch` remains prompt-required; no grammar changes, so the help inventory count is unchanged. Update the reference page text, not the inventory. |

The reconciled pages must cite the governing records: TDR-0044 (dispatch-owned lane record), TDR-0045 (atomic admission verdicts), TDR-0046 (harness terminate), TDR-0047 (in-process bounded loop), TDR-0048 (total derivation ladder and corroboration), and TDR-0049 (spawn identity, title, and lifecycle prompt).

### 25.2 Appendix B — Ticket-to-spec traceability

| Ticket element | Where satisfied |
|---|---|
| Ticket AC-1 — a parity battery replays all eleven result classes with fixtures | F-9; AC-F9-1…AC-F9-5; DM-9; DEC-9 |
| Ticket AC-2 — two concurrent dispatches both admit | F-2; AC-F2-1…AC-F2-5; DEC-1 reads the clause as "each receives its declared verdict" |
| Ticket AC-3 — a resume over a `pr-open` attempt continues | F-3; AC-F3-1…AC-F3-4; DEC-3 |
| Ticket AC-4 — tracker poll exhaustion resolves through artifacts or `state-unverified`, never success | F-4; AC-F4-2, AC-F4-3; DEC-7 |
| Ticket AC-5 — the whole flow runs with no shell entry point | F-9; AC-F9-4, AC-F9-5; API-7; NFR-5; Appendix C |
| Ticket task — `dispatch status` (de-scoped) | Out of scope here: F1b operator surface, GH-354; NG-1; DEC-10. Milestone backlog split: M4-S9 (this change, core parity) vs M4-S12 (operator surface). CEO parity analysis comment, 2026-11-18, gaps 11–12. |
| Ticket task — `dispatch log` (de-scoped) | Out of scope here: F1b operator surface, GH-354; NG-1; DEC-10. Milestone backlog split: M4-S9 vs M4-S12. CEO parity analysis comment, 2026-11-18, gaps 11–12. |
| Ticket task — `is-delivering` query (de-scoped) | Out of scope here: F1b operator surface, GH-354; NG-1; DEC-10. Milestone backlog split: M4-S9 vs M4-S12. CEO parity analysis comment, 2026-11-18, gaps 11–12. |
| Ticket task — per-ref log persistence (de-scoped) | Out of scope here: F1b operator surface, GH-354; NG-1; DEC-10. Milestone backlog split: M4-S9 vs M4-S12. CEO parity analysis comment, 2026-11-18, gaps 11–12. |
| Ticket task — `last-message` (de-scoped) | Out of scope here: F1b operator surface (the last-message/log read), GH-354; NG-1; DEC-10. Milestone backlog split: M4-S9 vs M4-S12. CEO parity analysis comment, 2026-11-18, gaps 11–12. |
| Gap 1 (G1) — durable per-ref lane record | F-1; AC-F1-1…AC-F1-4; DM-1; DEC-2 |
| Gap 2 (G2) — session identity captured and persisted | F-1; AC-F1-1, AC-F1-2; DM-1 |
| Gap 3 (G3/F3) — resume over a recorded attempt, `pr-open` included | F-3; AC-F3-1…AC-F3-4; DEC-3 |
| Gap 4 (G4/F2) — concurrency-safe admission with declared typed identity | F-2; AC-F2-1…AC-F2-5; DEC-1 |
| Gap 5 (G5/F7) — tracker retry ladder and honest unverified | F-4; AC-F4-1…AC-F4-4; DEC-7 |
| Gap 6 (G6) — kill/stuck handling, no silent second session | F-5; AC-F5-1…AC-F5-5; DEC-4 |
| Gap 7 (G7) — in-process restart loop with a bounded budget | F-6; AC-F6-1…AC-F6-5; DEC-5 |
| Gap 8 (G8) — resolved agent identity and deterministic title, non-constant prompt | F-7; AC-F7-1…AC-F7-4; DEC-8 |
| Gap 9 (G9) — `partial` in the shell sense, distinct from `finished` | F-8; AC-F8-3; DM-3; DEC-6 |
| Gap 10 (G10) — `merged` from a tracker-done work item | F-8; AC-F8-1, AC-F8-2; DEC-6 |
| Binding decision A — AC-2 interpretation | DEC-1; F-2; AC-F2-1 |
| Binding decision B — lane-record home | DEC-2; DM-1; AC-F1-1, AC-F1-4 |
| Non-goals: F1b operator surface, hook retirement, merge/closeout/queue/provider-policy, `state-unverified` exit, commitlint | 7.2; NG-1…NG-12 |

### 25.3 Appendix C — What the parity battery proves and does not prove

**It proves.** (1) All eleven result classes are produced by the real derivation and the real command path from declared fixtures, with their delivered tokens and exits. (2) The production admission claim, over a real state store, yields the declared verdict for a deterministic two-invocation interleaving: one admitted, one `queue.single-flight` naming the holder, no `fallback.internal`, no crash, zero attempt records for the refusal. (3) The production lane resolver, over a seeded dispatch lane, resumes a recorded `pr-open` attempt and never spawns fresh. (4) The production spawn-invocation builder yields `--agent pm`, `--model`, `--title ticket-<REF>`, a non-constant lifecycle prompt, and no title on a resume. (5) The production tracker read performs the declared ladder with an injected zero-delay recorder and resolves through a decisive artifact or `state-unverified`. (6) The terminate operation, over an injected streaming starter, is idempotent, sends TERM then KILL within the declared grace, and reaps only the exact identity. (7) The in-process loop's decision table reproduces the shell: clean exit terminal, only a stall or harness timeout restart-eligible, one restart record per consumed ordinal, `max-restarts` at the bound, unverified stall terminal without a slot, and exactly one attempt record per terminal dispatch. (8) The whole flow invokes no shell: the injected runner records zero invocations and the static invariant finds zero shell-execution references.

**It does not prove.** (1) Live opencode behaviour: a real session's resume after a real process exit, real stdout framing, real prefill timing. (2) Live provider behaviour: real GitHub issue/PR reads, real throttling, real authentication failure shapes. (3) OS-level process-tree termination of a real child and a real escaped runtime; the battery proves the contract and the exact-identity selection, not the kernel's signal delivery. (4) A real lifecycle-agent outcome or a real merge; the effects are fixtures. (5) Cross-process race freedom beyond the state store's fence guarantee; the two-invocation interleaving is deterministic, not an arbitrary OS schedule. (6) Long-run retry behaviour under a real 30-second outage; the battery injects zero delay and asserts the attempt/limit facts.

**How AC-5 "no shell entry point" is proven.** By three complementary observations: (a) every spawn is built as a fixed argv and started with no shell; (b) the battery's injected process runner records every invocation and fails by name if asked to use a shell or a script path, and the whole eleven-class plus race/resume/loop/terminate battery records zero; (c) a static invariant over the dispatch implementation surface asserts zero shell-execution references and zero script-path literals, with a planted reference as a non-vacuity control. The shell entry points remain on disk as the documented fallback; the proof is that the typed flow never invokes them.

### 25.4 Appendix D — Fixture-decided and implementation-decided details

The following do not reopen any decision: the exact scripted-session choreography per class; the exact fixture values for tracker state, labels, PR state, URL, commit count, and pm-notes completeness; the exact wording of the lifecycle prompt beyond its required sections and the ref/branch interpolation; the exact implementation of the fence wait (poll cadence, cancellation seam) within its declared bound; the exact placement of the lane store and read ports; the exact representation of owner start time; and the exact evidence-reference spelling beyond the declared identifiers. The prompt's prose is implementation-decided, but its required content and its non-constant, ref/branch-parameterized nature are not.

Not fixture-decided: whether a class arm exists (Appendix F), whether an admission refusal is typed (API-2), whether a resume is used when a lane exists (API-3), whether a stall is terminated before a restart (F-5), and whether a config key is added (none).

### 25.5 Appendix E — Verified baseline

Every seam named in section 2.1 was re-verified on this branch at `feat/GH-347/dispatch-core-parity` (base `d8d762be`, phase-1 commit `b144150e`) after GH-335 merged, so the line numbers cited in the intake comment have shifted but the contracts are the ones described. The shell parity reference was read from the integration branch. The delivered error-table rows, config defaults, lane-record states, harness capabilities, and conformance fixtures were read directly rather than assumed.

### 25.6 Appendix F — The total derivation ladder (normative)

A. **Pre-session (no token, no attempt, no lane):** unknown harness; rejected input; provider-profile nomination refusal; admission-preflight refusal; harness version/mode/profile refusal; active owner hold; live same-ref lease (`queue.single-flight`); live other-ref lease (`queue.lease-conflict`); a typed state failure on the claim.

B. **Attempt-stage failures (one attempt record each, terminal):** spawn failure before a session → `failed`; resume refused as uneconomical → `failed`; resume admission facts unreadable → `state-unverified`; unreadable collected harness evidence → `state-unverified`. A restart-budget exhaustion is a loop outcome (D), not an attempt-stage arm.

C. **Completed-session truth ladder (first match wins; a stall uses D, not this ladder):** the delivered ledger-complete no-work arm is retired — a complete phase ledger alone does not produce `noop-lane-nothing-to-do`, and the token is produced only by arm 8. A complete ledger with commits resolves `finished` or `partial`; a complete ledger with no commits resolves `noop-lane-nothing-to-do` only under arm 8. A decisive artifact resolves only in this ladder; at a stall it does not short-circuit unless it is in the terminal pre-restart verdict set (D).
1. Harness spawn refusal → `noop-lane-permission` (outcome `refused`).
2. Tracker readable and native state done → `merged`, corroborated by the tracker fact (no visible PR required).
3. Tracker readable and blocking → `blocked`.
4. Pull-request artifact open → `pr-open` when the URL resolves, `pr-open-unverified` when it does not.
5. Pull-request artifact already merged → `merged`.
6. Branch commits > 0 and pm-notes complete → `finished`.
7. Branch commits > 0 and pm-notes incomplete/absent → `partial` (harness outcome carried).
8. Branch commits = 0, pull request none, tracker readable and neither done nor blocking → `noop-lane-nothing-to-do`, corroborated by the tracker fact.
9. Otherwise the shared classifier's token is used: a reported failure or non-zero exit → `failed`; a tool failure or premature end → `partial`. A clean completion with no decisive arm cannot occur once arms 2–8 are exhaustive over readable truth.
10. Truth undecidable (any required read unreadable and no decisive artifact) → `state-unverified` at exit 2; a tracker-only outage with a decisive artifact resolves at arms 4–7.

D. **Stall ladder (only when a liveness stall is current at collection or the harness reports a timeout):** only a member of the terminal pre-restart verdict set (DM-4) short-circuits — `merged` from a tracker-done work item, `blocked` from a blocking tracker state, `pr-open` from an open pull-request artifact. A decisive artifact outside that set (`finished`, `partial`, `noop-lane-nothing-to-do`) does not stop the stall. An undecidable truth → `state-unverified` with no slot; otherwise below the bound → consume one ordinal, one `economics.restart`, resume, repeat; at or above the bound → `max-restarts` with the delivered exhaustion record and one terminal attempt record. A persisted count at or above the bound never refuses admission: the dispatch runs one iteration, and only a stall in it produces `max-restarts`; a clean exit keeps its classification.

E. **Invariants:** the eleven tokens, projections, and exits are closed; `state-unverified` is exit 2; `partial` is exit 1; a pre-session refusal appends no attempt; a dispatch that reaches classification appends exactly one attempt record, and a restarted stalled iteration appends none.

### 25.7 Appendix G — Parity coverage matrix (summary)

| Case | Proof surface | Production seam exercised |
|------|---------------|---------------------------|
| `merged` (PR) / `merged` (tracker-done) | Conformance + derivation | Artifact read; tracker read |
| `blocked` | Conformance + derivation | Tracker read |
| `pr-open` / `pr-open-unverified` | Conformance + derivation | Artifact read |
| `finished` / `partial` | Conformance + derivation | Artifact pm-notes fact; classifier |
| `failed` / `max-restarts` / `state-unverified` | Conformance + derivation; loop | Classifier; loop decision; truth reads |
| `noop-lane-permission` / `noop-lane-nothing-to-do` | Conformance + derivation | Classifier; tracker read |
| Concurrent same-ref / other-ref admission | Claim over a real store, deterministic interleaving | Atomic admission |
| Resume over `pr-open` | Seeded lane + resolver | Lane resolver; resume mode |
| Tracker outage with/without artifact | Injected delay + fixtures | Retry ladder; artifact read |
| Stall / terminate / restart / max-restarts | Injected streaming starter + loop | Terminate; loop; economics |
| Spawn identity | Spawn-invocation builder | Agent/title/prompt supply |
| No shell | Injected runner + static invariant | Process execution |

## 26. DOCUMENT HISTORY

| Version | Date | Author | Changes |
|---------|------|--------|---------|
| 1.0 | 2026-11-18 | @spec-writer | Initial specification for GH-347, grounded in the ticket body and its CEO parity-gap analysis, the GH-347 planning notes, the shell parity contract, the re-verified delivered seams, and decisions DEC-1…DEC-10. |
| 1.1 | 2026-11-18 | @spec-writer | Review remediation. Added the Definition of Done (now section 18, eight individually observed items covering the then-41 ACs, the aggregate and range gates, the deterministic 11/11 offline battery, the no-shell control, documentation reconciliation, closed-contract invariance, and scope); added five Appendix B traceability rows for the de-scoped operator-surface tasks (`dispatch status`, `dispatch log`, `is-delivering`, per-ref log persistence, `last-message`) to NG-1 / DEC-10 / GH-354 and the M4-S9 vs M4-S12 backlog split; qualified the PURPOSE so it does not claim the operator surface; renumbered sections 18–25 to 19–26. No decision, requirement, or scope changed. |
| 1.2 | 2026-11-19 | @spec-writer | Decision-record remediation (TDR-0044…TDR-0049; rulings R1–R6). Defined the terminal pre-restart verdict set in DM-4 and replaced the ambiguous family term with it; retired the phase-ledger no-work arm explicitly and declared the shared-derivation daemon consequence with a required regression observation; separated the stall short-circuit from completed-session truth (a decisive artifact does not stop a stall); distinguished the dispatch lane's `lane.restart-budget` (3) from `coordinator.restart-budget` (10) and the shell lane's 10, and justified the borrowed `coordinator.kill-grace`; specified the already-at-bound admission; cited TDR-0044…TDR-0049 in §15.1, the relevant F-/DM-/API text, and Appendix A; added AC-F6-6 (AC count 42). No DEC-1…DEC-10 outcome or scope changed. |
| 1.3 | 2026-11-19 | @spec-writer | R7 evidence-corroboration boundary. Declared in DM-4 and §8.5 that the `"pm-notes"` corroboration source remains the phase ledger (`phasesComplete`) and is not re-pointed at the `pmNotes` artifact fact in this change; a `finished` with a divergent ledger is recorded as a delivered-evidence divergence by design (the honesty signal), with `falseSuccess` never silently suppressed and no new incident kind. Extended AC-F8-3 with that sub-clause (AC count remains 42); added the deferral and revisit trigger to §7.3; added DEC-11 (change-local, citing the delivered TDR-0024 contract). No other decision or scope changed. |

---

## AUTHORING GUIDELINES

- **Sources.** The ticket body and acceptance criteria; the CEO parity-gap analysis comment of 2026-11-18 (gaps 1–10, F1a vs GH-354); the GH-347 planning notes (scope, intake facts, decisions, doc-impact risks); the shell lane contract; the current-truth dispatch, harness, session-economics, resident-daemon, queue, config, and result-contract pages; and the delivered engine, adapters, config defaults, error table, and conformance fixtures, re-verified on this branch after GH-335 merged. No behaviour is invented; implementation-decided details are listed in Appendix D.
- **Approach.** The spec is organised around the ten parity gaps and the five ticket acceptance criteria, then around outcomes: capabilities state behaviour and rationale, interfaces state contracts with identities and bounds, and acceptance criteria are individually observable and traceable to a gap and a linked ID. The two binding decisions are recorded as DEC-1 and DEC-2 without renegotiation; the remaining design-forced forks are recorded as DEC-3…DEC-11.
- **Constraints applied.** Closed vocabulary, projections, and exits; additive contract evolution only; no new error identity; no new configuration key; no shell dependency; no operator surface or hook; no live-provider parity claim beyond the battery's declared boundary; no cloud or hosted-product naming.
- **Deliberate omissions.** No code file paths, no step-by-step implementation tasks, no commit or merge instructions, and no technology tuning beyond what the outcomes require.

## VALIDATION CHECKLIST

- [x] `change.ref` matches the provided `workItemRef` (`GH-347`)
- [x] `owners` has at least one entry (`engineering`)
- [x] `status` is `Proposed`
- [x] `change.milestone` is the tracker milestone title verbatim and equals the planning-notes milestone (`M4: Jaiship-native delivery`)
- [x] All sections present in order (1–26 + authoring guidelines + checklist)
- [x] A Definition of Done is present after the acceptance criteria, each item names its observation, and the AC count reference matches the 42 declared criteria
- [x] ID prefixes are consistent and unique (`F-`, `API-`, `DM-`, `NFR-`, `AC-`, `RSK-`, `DEC-`, `PG-`, `DOD-`)
- [x] Acceptance criteria reference at least one `F-`/`API-`/`DM-`/`NFR-` ID and use Given/When/Then
- [x] NFRs include measurable values
- [x] Risks include Impact and Probability with mitigation and residual risk
- [x] No implementation details (no code file paths, no step-by-step tasks)
- [x] Out-of-scope items are prefixed `[OUT]`
- [x] Open questions are empty; every routed question is settled by a cited decision
- [x] The parity battery's proven and not-proven boundary is stated, including how the no-shell invariant is proven
- [x] The stale "no kill operation" statements on the two current-truth pages are recorded as documentation-phase work
- [x] Deliberate non-decisions and behaviour changes are recorded and binding on the plan
- [x] The terminal pre-restart verdict set is defined once and used consistently for the stall decision
- [x] The phase-ledger no-work arm is explicitly retired and the shared derivation's daemon consequence is stated with a plan regression observation
- [x] TDR-0044…TDR-0049 are cited in §15.1, the relevant sections, and Appendix A
- [x] The `pm-notes` corroboration boundary is stated, AC-F8-3 pins the divergent-ledger `finished` case, §7.3 carries the revisit trigger, and DEC-11 records the boundary
