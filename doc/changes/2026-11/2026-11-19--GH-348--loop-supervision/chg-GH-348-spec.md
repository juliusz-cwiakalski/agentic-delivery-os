---
change:
  ref: GH-348
  type: feat
  status: Proposed
  slug: loop-supervision
  title: "M4-S10: CEO loop supervision inside jaiship — the `loop` family over the delivered supervision engine (M4)"
  owners: ["engineering"]
  service: delivery-os supervision engine (CEO outer loop)
  milestone: "M4: Jaiship-native delivery"
  labels: ["loop", "supervision", "parity", "m4-s10", "flip-f3", "ceo", "lifecycle"]
  version_impact: minor
  audience: internal
  security_impact: medium
  risk_level: high
  dependencies:
    internal:
      - the delivered coordinator supervision engine (instance lease, restart budget, stuck records, kill-with-grace)
      - the harness session port and the opencode / Claude Code adapters
      - the per-spawn single-seat profile binding and the provider engine's profile/chain resolution
      - the durable state ledger and its per-identity record scoping
      - the dispatch lane and daemon lane records (the delivery-in-progress corroborator)
      - the coordinator, dispatch, merge, closeout, queue, and phase command surfaces (the primitives the CEO session calls)
      - the help inventory, the prompt-required command set, and the help/guide coverage check
    external:
      - opencode CLI session stream, resume, and process-tree lifetime (live behaviour is outside the conformance battery)
      - the provider profile configuration that assigns the CEO seat (fixture-only inside the battery)
---

# CHANGE SPECIFICATION

> **PURPOSE**: Make the Mode A outer delivery loop a `jaiship` command — `loop start|stop|status|log|reset` — composed over the delivered coordinator supervision engine, so an operator can run, stop, inspect, and reset the CEO loop without a shell entry point, without a second supervisor, and without a second kill path. This change delivers the loop surface and its evidence; retiring `scripts/ceo-loop.sh` and re-pointing agent prompts are later flip stages.

## 1. SUMMARY

The supervision machinery the outer loop needs is already delivered and already proven: an append-only instance lease with liveness-first stale takeover, an identity-verified kill-with-grace over the delivered process port, a per-epoch restart budget, a stuck verdict/outcome record pair, and six configuration keys of which five carry defaults numerically identical to five of `scripts/ceo-loop.sh`'s env knobs (600 000 ms, 30 000 ms, 20 000 ms, 10, 100 000 tokens — §2.1). What is missing is the operator surface: there is no `loop` command, no `log` or `reset` verb, no backoff, no durable stop that survives a restart, and no typed equivalent of the shell's "no session traffic **and** no healthy delivery" stuck predicate.

This change adds one command family with five verbs, one supervision cycle composed over the delivered engine primitives under a distinct supervisor identity (`loop-main`), two additive record kinds (the loop's durable session identity and the durable stop), one additive optional harness fact (the spawned session's process id), a bounded operational log with a declared retention rule, and a deterministic conformance battery with a published proof boundary. Nothing else moves: the coordinator family's grammar, payloads, records, behaviour, and error identities are unchanged; `scripts/ceo-loop.sh` is not edited; no agent prompt is edited; no configuration key, error identity, or domain kind is added.

## 2. CONTEXT

### 2.1 Current State Snapshot

- **The engine is delivered and carries the machinery the ticket names.** `coordinator start --foreground [--fresh-budget] | stop | status [--live] | tick` exists (`packages/cli/src/commands/coordinator.ts`), composed at the edge (`packages/cli/src/edge.ts:3865-3890`, registered at `:5110-5115`) and in production (`packages/cli/src/production.ts:3445-3690`, mounted at `:4653`). Its cycle (`packages/cli/src/commands/coordinator-loop.ts`) owns the append-only instance lease (`decideCoordinatorClaim`, `packages/core/src/domain/coordinator-fence.ts:118`; `coordinator.fence` records), the per-epoch restart budget (`evaluateCoordinatorRestartAdmission`, `packages/core/src/domain/coordinator-admission.ts:33`), the stuck verdict/outcome pair (`coordinator.stuck`), the identity-verified kill-with-grace (`killCoordinatorProcess`, `packages/adapters/src/daemon/process.ts:117`), and wake-on-typed-question.
- **The lease refuses a second live holder.** A live holder is refused `coordinator.already-running` (`packages/core/src/contracts/coordinator.ts:254-262`; the row projects `platform-provider`, exit 2, `packages/core/src/contracts/error-table.ts:1495-1505`), regardless of lease age. Records are scoped per supervisor identity by key (`packages/core/src/state/coordinator.ts:443-530`): a second identity's records are skipped, not rejected — so a second identity can share the record kinds safely.
- **The restart budget is per durable epoch.** Ordinals fold contiguously from 1 (`evaluateCoordinatorRestartAdmission`); at or above the bound nothing is admitted. `--fresh-budget` opens the next epoch and is durable on the lease carrier.
- **Kill is identity-verified.** `killCoordinatorProcess` requires the pid plus the platform process start time and sends nothing on a mismatch (`packages/adapters/src/daemon/process.ts:126-146`). The harness `terminate` operation (GH-347, `packages/core/src/contracts/harness.ts:478-500`) terminates a session's process tree with TERM first, KILL only after the declared grace, and reaps an escaped runtime matched only by this session's identity or its title.
- **The coordinator's stuck predicate is delivery-artifact evidence, not session traffic.** `evaluateStuck` (`packages/core/src/domain/coordinator-evidence.ts:100-145`) decides over three classes — `digest-consumed`, `merge`, `answer` — plus a sourced-progress veto. Its window is `coordinator.stuck-window`; its reasons are `stuck-artifact-evidence` / `evidence-unevaluable`. It is the right predicate for one delivery expectation and the wrong predicate for a long-lived CEO session: a CEO blocked on a healthy, progressing delivery advances no merge and no answer, so that predicate would kill it (contradicting INV-DM-3, below).
- **The binding parity contract for a stuck CEO is two-signal.** INV-DM-3 (`doc/spec/features/feature-autonomous-delivery.md:163`) says a stuck CEO is "no session traffic **and** no healthy delivery in progress"; the same invariant defines the shell's probe as the `--is-delivering` PID probe plus the race-free `.ai/local/delivery/delivering` marker, and INV-DM-5 (`:165`) makes liveness multi-signal progress, never process-alive. (INV-DM-2 at `:162` is the per-ticket single-flight/join rule and is not the stuck definition.) NFR-5 at `:242` requires the stop/park signal to survive a loop restart and not be wiped at startup.
- **The typed surface has no live session-traffic source.** The opencode adapter's `liveness` returns only the facts it was constructed with (`packages/adapters/src/harness/opencode.ts:784-790`), and the production composition supplies none, so `mapCoordinatorNewTurn` (`packages/adapters/src/harness/liveness.ts:49-64`) yields `unknown` in production. The coordinator page already declares this (`feature-coordinator-supervision.md` §3). A delivered per-session totals reader exists (`createOpencodeSessionTotalsReader`, `packages/adapters/src/harness/telemetry-session-totals.ts`) and yields monotonic token totals for a session id, which is a legitimate sourced `token-delta` (a declared sourced-signal kind, `packages/core/src/contracts/economics.ts:15`).
- **The delivery-in-progress corroborator has a delivered source, and its owner facts are advisory only.** GH-347 delivered the dispatch-owned `dispatch.lane` record (`delivery.dispatch.lane.v1`, key `dispatch.lanes:<ref>`, states `active` / `terminal`, owner `{processId, startedAt}`; `packages/core/src/contracts/dispatch.ts:572-611`) with `readDispatchLanes` / `latestDispatchLaneFor` exported from core, and the daemon lane record with states `delivering` / `detached` / `preempted` / `completed` / `failed` and an optional `processId` (`packages/core/src/contracts/daemon.ts:135-179`). Both are readable from the state ledger. Critically, `startedAt` is the **composition's own start instant** (`packages/cli/src/production.ts:1689,3248` sets it from `compositionStartedAt = nowIso()`), not the operating system's process start time, so it can never equal the platform start-time reading the delivered kill path compares against. An owner-liveness test for the corroborator must therefore rest on the recorded **process id** alone; a start-time or age comparison over `startedAt` would read every live delivery as "not a delivery" and kill a healthy CEO.
- **At this baseline a spawned harness handle carries no process id, and this change adds one.** `HarnessSessionHandle` is `{harnessKind, sessionId, treeRoot, workItemRef}` (`packages/core/src/contracts/harness.ts:270-275`), and the coordinator page records "No pid on a spawned handle" as a delivered limitation (`feature-coordinator-supervision.md` §3) — a limitation DM-3 removes additively (an optional handle `pid`, supplied by the adapters that can report it), so that page's §3 sentence becomes stale in the documentation phase (§25.1). The host spawn starter starts the runtime detached in its own process group (`packages/adapters/src/host/index.ts:153-164`), so a session outlives a killed loop process — exactly the orphan the shell's `ceo.pid` + start-epoch file exists to re-find.
- **The shell loop is the parity reference, and it is not edited here.** `scripts/ceo-loop.sh` (2.1.0) reads six env knobs — `CEO_LOOP_STUCK_MINUTES=10`, `CEO_LOOP_POLL_SECONDS=30`, `CEO_LOOP_KILL_GRACE_SECONDS=20`, `CEO_LOOP_MAX_RESTARTS=10`, `CEO_RESUME_TOKEN_LIMIT=100000`, `CEO_LOOP_SLEEP_SECONDS=2` — and `MAX_ITERATIONS=0`. Its five surfaces are `run` (default), `--stop`, `--reset`, `--status`, `--log [N]`. Its exit codes are `0` clean stop, `1` max restarts, `2` usage. Its durable stop is a plain file (`.ai/local/ceo/stop`) cleared by `--reset`; its `--status` prints six keys (`loop_running`, `loop_pid`, `ceo_alive`, `ceo_pid`, `ceo_session`, `stop_signal`); its `--log` tails `tmp/ceo-loop/ceo.log` (default 50 lines) with no retention bound; its single-flight guard is `.ai/local/ceo/loop.pid`, and a second instance logs and returns **0**; it has **no** restart backoff (a fixed 2 s pause). Its stuck increment fires on `restarts > MAX_RESTARTS`, i.e. ten restarts are permitted and the eleventh stuck exits 1 — which is exactly what the delivered budget does at `count >= bound`.
- **The six config keys already exist, and five of them match the shell's knobs numerically** (`packages/core/src/config/defaults.ts:82-89`): `coordinator.stuck-window` 600 000 ms (`CEO_LOOP_STUCK_MINUTES=10`), `coordinator.kill-grace` 20 000 ms (`CEO_LOOP_KILL_GRACE_SECONDS=20`), `coordinator.restart-budget` 10 (`CEO_LOOP_MAX_RESTARTS=10`), `coordinator.resume-context-limit` 100 000 (`CEO_RESUME_TOKEN_LIMIT=100000`), `coordinator.collection-interval` 30 000 ms (`CEO_LOOP_POLL_SECONDS=30`), and `coordinator.progress-bound` 300 000 ms, which has **no** shell counterpart (the shell's single traffic window serves as both threshold and progress window). `CEO_LOOP_SLEEP_SECONDS` and `MAX_ITERATIONS=0` have no key: the first is replaced by the backoff schedule plus the collection interval, the second by an unbounded loop.
- **The help surface is inventory-driven.** `PROMPT_REQUIRED_COMMANDS` is append-ordered and pinned: the delivered set has 26 entries with `install` last (`packages/cli/src/help/prompt-required-commands.ts`), and three delivered suites pin it — the install-family comparator's count and tail rules (`tests/checks/install-conformance-mutants.test.ts:47-62`), the metrics-mounting suite's positional/count assertions and its stale-pin scan set (`toHaveLength(2[345])`, which is why a repin must extend that set; `tests/structure/metrics-mounting.test.ts:39-79`), and the reference-page-parity suite's duplicated per-command page mapping (`tests/checks/reference-page-parity.test.ts:16-47`). A command needs a static help entry (`packages/cli/src/help.ts:139+`, root families rendered from single-segment entries at `:1159-1165`), a reference page named by the coverage check (`scripts/checks/help-guide-coverage.ts:40-56`), an inventory row (`tests/fixtures/help-guide/coverage.json`), and — because the M4 root must never be served by an M1 page — an M4-rooted page.
- **The static no-shell invariant scans a declared surface.** `DISPATCH_FLOW_SURFACE` (`scripts/checks/no-shell-dispatch.ts:22-47`) is an explicit file list with four rules and an empty allowlist; a new flow is proven by extending the list, not by a second invariant.

### 2.2 Pain Points / Gaps

- **PG-1 — No typed outer loop.** There is no `loop` command; `scripts/ceo-loop.sh` is the only way to run the Mode A loop, so the flip's F3 stage cannot be claimed and internal delivery still needs a shell entry point.
- **PG-2 — No durable stop in the typed plane.** The delivered coordinator `stop` appends a per-holder `stop-requested` lease record that a *new* instance ignores by design; a `loop` built on that model would forget a stop across a restart, contradicting NFR-5.
- **PG-3 — No session-traffic liveness.** The typed surface maps every liveness reading to `unknown` in production, so the shell's INV-DM-5 signal has no typed equivalent and a hung CEO would be indistinguishable from a busy one.
- **PG-4 — No delivery-in-progress corroborator.** Nothing in the typed plane can answer "is a healthy delivery in progress in this workspace", so the INV-DM-3 veto (which keeps a blocked CEO alive) has no typed input, and the only existing sources are the shell's `--is-delivering` probe and the `.ai/local/delivery/delivering` marker — both non-target-surface inputs.
- **PG-5 — No bounded operational log surface.** There is no `log` verb and no retention rule; the shell tails an unbounded file.
- **PG-6 — No restart backoff with a readable reason.** The shell pauses a fixed 2 s and logs prose; nothing durable records why a restart happened, at which ordinal, or with what delay.
- **PG-7 — No durable session identity for a supervised outer session.** A spawned handle carries no pid and the loop would have no durable record of its own session, so `status` could not report `ceo_pid`/`ceo_session` across a restart and a start after an unclean death could not re-find — and therefore could duplicate — its own session.
- **PG-8 — No proof that a jaiship-only cycle is possible.** The ticket's final acceptance claim ("a full pick-deliver-merge cycle using only jaiship primitives and no shell entry point") has no declared proof boundary.

## 3. PROBLEM STATEMENT

Because the outer delivery loop exists only as a shell script whose durable stop is a workspace file, whose liveness and delivery signals are shell probes, whose log is unbounded, and whose restart policy has no backoff and no durable reason — while the typed plane already carries the lease, kill, budget, and stuck machinery — an operator cannot run the Mode A loop as a `jaiship` command, cannot stop it durably across a restart, cannot inspect it in a bounded way, and cannot rely on a stuck CEO being detected without killing a CEO that is legitimately waiting on a healthy delivery; so the flip's F3 stage cannot be claimed and internal delivery cannot stop depending on `ceo-loop.sh`.

## 4. GOALS

- **G-1**: An operator runs the Mode A loop as `jaiship loop start --foreground` and stops, inspects, tails, and resets it with `loop stop|status|log|reset`, with the shell's five surfaces and its six status keys preserved.
- **G-2**: The loop spawns the CEO agent through the delivered harness port with the delivered per-spawn, policy-resolved provider binding, under a deterministic title, with no shell and no operator override.
- **G-3**: A stuck CEO is detected by the two-signal rule (no sourced progress **and** no healthy delivery in progress) and restarted with a bounded, declared backoff and a durable, readable reason — or the loop ends with the typed budget identity.
- **G-4**: A stop is durable: it survives a restart, a crash, and a fresh process, and only an explicit `reset` clears it.
- **G-5**: Two loops cannot both run, and a start after an unclean death re-finds its own session before it considers starting another.
- **G-6**: The loop's operational log is bounded, deterministic, ANSI-free, and identifier-only.
- **G-7**: The whole loop surface is proven by one deterministic conformance battery over the real composition with harness, tracker, and process doubled, with a published proven / not-proven boundary and a machine-checked no-shell invariant.

### 4.1 Success Metrics / KPIs

| Metric | Target |
|--------|--------|
| Verb parity | 5/5 shell surfaces present (`start`, `stop`, `status`, `log`, `reset`); 6/6 shell status keys emitted with their shell names and value vocabulary, in the declared order, with exactly three boolean keys (`loop_running`, `ceo_alive`, `stop_signal`), `stop_mode` immediately after `stop_signal`, `loop_id=loop-main` always present, and every other absent value rendered as the empty string after `=` with no `none` token |
| Durable stop | 100% of stops recorded before a process restart are honoured by the next start; 0 starts run a loop over a folded request; 0 repeated stops appending a second `requested` record |
| Single instance | 2 concurrent starts → exactly 1 admitted, 1 `coordinator.already-running` at exit 2; 0 double claims; 0 second session spawns while a live recorded session exists |
| Stuck detection | 100% of stuck verdicts require both signals readable; 0 kills with a healthy delivery in progress; 0 kills on an unreadable corroborator; 0 corroborator start-time or age comparisons (owner liveness is the recorded pid alone); 0 restarts after an unconfirmed termination; detection-to-next-session ≤ the bound formula (`stuck-window + collection-interval + kill-grace + first backoff`, 652 000 ms at the shipped defaults) |
| Structured evidence | 1 `coordinator.stuck` verdict record per stuck verdict; 1 `coordinator.stuck` outcome record per kill; 1 `coordinator.restart` record per consumed ordinal; 0 restart records for a clean session end |
| Backoff | The declared schedule `min(2 000 × 2^(n−1), 300 000)` ms at every ordinal 1–10; total delay for a full epoch ≤ 1 110 000 ms; 0 fixed-delay restarts |
| Log retention | Active log ≤ 1 048 576 bytes; ≤ 1 retained rotated generation; total ≤ 2 097 152 bytes; every line ≤ 512 bytes; `log` read ≤ 100 lines and ≤ 65 536 bytes |
| Spawn identity | 1/1 fresh spawns carry `--agent ceo` plus the resolved seat `--model` and exactly one `--title ceo-loop-<UTC stamp>`; 0 operator overrides |
| Contract invariance | 0 new error identities, 0 new domain kinds, 0 new configuration keys, 0 changed coordinator records or payloads, 0 coordinator behaviour changes |
| Determinism | 2/2 identical battery runs; 0 live network calls; 0 live child processes; 0 real waits |
| No shell | 0 shell invocations across the battery; 0 script-path literals in the declared loop surface; 0 script paths in the loop's spawn prompt |
| Documentation | 1 new current-truth page; 1 new M4 reference page; 1 new quality test specification; the state-layer record-kind table reconciled with both new kinds; the coordinator page's pid limitation reconciled against DM-3; 0 stale "the loop is a shell script" statements left on the neighbouring pages |

### 4.2 Non-Goals

- **NG-1**: No deletion, rewrite, or re-pointing of `scripts/ceo-loop.sh`; it stays present and executable as the documented fallback. Retirement is F6 (GH-352).
- **NG-2**: No agent prompt or agent definition edit (including `.opencode/agent/ceo.md`). Prompt re-pointing is F5 (GH-351).
- **NG-3**: No second supervision engine: no new lease, no new kill path, no new budget fold, no new process-exclusivity mechanism.
- **NG-4**: No change to the coordinator family's grammar, payloads, records, reasons, behaviour, or error identities; no change to `createCoordinatorSupervisor`, `evaluateStuck`, `decideLifecycle`, or the six config defaults.
- **NG-5**: No declarative provider policy (GH-350, flip stage F2) is assumed, implemented, or pre-wired; "policy-resolved provider" means the delivered per-spawn path only.
- **NG-6**: No owner escalation question on budget exhaustion; the loop exits 1 with the delivered identity and the correct remediation in its own summary.
- **NG-7**: No merge or closeout repair (GH-349); `jaiship merge` and `jaiship closeout` are consumed as delivered.
- **NG-8**: No operator surface beyond the five verbs (no `pause`, `resume`, `install`, `attach`, `logs --follow`).
- **NG-9**: No new configuration key, no new error identity, no new domain kind, no schema-version bump of any delivered record.
- **NG-10**: No live-provider, live-opencode, or OS-process-tree claim beyond the battery's declared boundary (Appendix C).
- **NG-11**: No pre-iteration hook. The shell's optional `~/.ados/hooks/pre-opencode-iteration` is retired, not ported; provider policy replaces it.

## 5. FUNCTIONAL CAPABILITIES

| ID | Capability | Rationale |
|----|------------|-----------|
| F-1 | The five-verb `loop` family over the delivered engine | F3 requires the shell's five surfaces as typed verbs, not a new supervisor. |
| F-2 | CEO session spawn with the per-spawn policy-resolved binding | The ticket names the harness port plus the policy-resolved provider; the delivered resolution call site is the only honest source. |
| F-3 | Bounded restart policy with backoff and a durable readable reason | A crash-looping start must not hot-loop sessions, and an operator must be able to read why a restart happened. |
| F-4 | Durable, identity-scoped stop with an explicit `reset` | NFR-5 requires the stop to survive a restart; the delivered per-holder lease request cannot. |
| F-5 | Two-signal stuck detection and identity-verified termination | INV-DM-3/5 require both signals; kill must never signal an unrelated process. |
| F-6 | Single instance with session re-find | Two loops must not run, and a start after an unclean death must not spawn a second CEO. |
| F-7 | Bounded, deterministic operational log | The ticket requires bounded retention; the shell's log is unbounded. |
| F-8 | Conformance battery with a published proof boundary and a no-shell invariant | The acceptance claim is a property that must be proven, and what it does not prove must be named. |

### 5.1 Capability Details

**F-1 — The family and its grammar.** `loop` is a new command family beside `coordinator`, with exactly five subcommands and this grammar:

| Verb | Grammar | Effect |
|---|---|---|
| `start` | `loop start --foreground [--fresh-budget]` | Refuses a folded stop (exit 0, `state=stopped`); otherwise claims the instance lease, establishes or re-finds the CEO session, and runs the supervision cycle in the foreground until one of five declared end causes: a folded stop, a signal, a budget exhaustion, a failure, or **the composition's cycle driver reporting its declared end** (a declared clean end — `state=stopped`, exit 0, no error). `--foreground` is required in v1, exactly as `coordinator start` requires it; `--fresh-budget` opens the next restart-budget epoch. |
| `stop` | `loop stop [--mode drain\|immediate]` | Appends one durable stop request for the loop identity (`drain` is the default and the parity mode). Does not signal the session, does not touch the lease, and works whether or not a loop is running. |
| `status` | `loop status` | Reads and projects only; never mutates, never evaluates a verdict, never spawns. |
| `log` | `loop log [--lines <n>]` | Returns the tail of the loop's operational log; `n` is an integer 1–100, default 50. |
| `reset` | `loop reset` | Appends one durable stop clearance for the loop identity when a request is folded; otherwise a no-op success. |

Any other subcommand, a missing subcommand, a flag outside the verb's declared set, or a malformed `--lines` value is refused as `fallback.invocation` at exit 1 with the summary `result=refused; reason=grammar`, and mutates no state. The delivered global flags `--json`, `--verbose`, and `--pretty` are accepted on every verb and are never grammar refusals; they are the CLI's globals, not part of any verb's declared flag set, and `--json` selects the machine payload defined by API-7. The family is a Mode A operator surface over the **same engine**: it reuses the append-only instance lease, the per-epoch restart budget, the stuck verdict/outcome pair, the identity-verified kill-with-grace, the six `coordinator.*` configuration keys, and the delivered per-identity state read. It does **not** reuse the coordinator's supervision cycle, its artifact-evidence stuck predicate, its wake path, or its escalation — the supervised target and the correct stuck predicate differ (§2.1, DEC-1, DEC-3). Source: TDR-0055.

**F-2 — CEO session spawn and re-find.** A fresh session is spawned through the delivered harness session port with the caller agent identity `ceo`, the single-seat binding produced by the delivered per-spawn resolution (the composition's profile-port wrapper and the pure admission-binding resolution), and exactly one deterministic fresh-spawn title `ceo-loop-<UTC yyyymmdd-hhmmss>` (≤ 64 characters), which is also the exact-identity reap target for termination. The adapter renders exactly one `--agent ceo` together with the binding's resolved `--model`; the argv is fixed and never shell-interpreted. A resume carries no title. An unassigned `ceo` seat refuses pre-session on the delivered `provider.profile.invalid`; an unresolvable profile context refuses on the delivered `config.value.invalid`; an unrepresentable seat model refuses on `harness.profile.model-unrepresentable` — all at exit 1, all with no session and no durable session record, and the lease released. The session's process id, when the adapter can supply it, is recorded on the loop's durable session record and is the re-find and kill identity; when it cannot, the loop degrades conservatively (F-6, AC-F6-5) rather than spawning a second session.

**F-3 — Restart policy with backoff.** Only a **stuck** restart consumes a restart ordinal; a session that ends on its own never does (parity: the shell increments only on `stuck`). A below-bound stuck restart appends exactly one `coordinator.restart` record carrying the next contiguous ordinal, the delivered closed reason `stuck-artifact-evidence`, and the replaced session identity; then the loop waits `restartDelayMs(n) = min(2 000 × 2^(n−1), 300 000)` milliseconds — n = the ordinal just consumed — and starts the next session. The schedule is 2, 4, 8, 16, 32, 64, 128, 256, 300, 300 seconds for ordinals 1–10 (total ≤ 1 110 000 ms). The wait is cancellable: a durable stop or a signal ends it immediately. **The durable reason is a declared operator-facing compromise:** it is the delivered closed token `stuck-artifact-evidence` because this change adds no reason token to a delivered closed vocabulary, even though the loop's verdict is the two-signal rule rather than artifact evidence; the facts that distinguish a loop restart from a coordinator restart (traffic state, corroborator reading, progress age) ride the bounded evidence corpus of the paired `coordinator.stuck` records. An operator reading `coordinator.restart` alone therefore cannot tell the two apart and must read the corpus — the loop's log line `event=restart` carries the same facts for the same reason. At or above the bound (`coordinator.restart-budget`, default 10) no restart record is appended and no session starts; the loop releases the lease, logs `event=budget-exhausted`, and exits 1 on the delivered `coordinator.restart-budget-exhausted` identity, with the loop's own bounded summary naming the **history reference** `epoch-<n>;restarts=<count>;seq=<the newest restart record's ledger sequence>`, `restarts=<n>/<bound>`, and the correct remediation (`loop start --foreground --fresh-budget`). The history reference is derivable from durable state alone — the epoch from the lease carrier, the count from the epoch's restart fold, and the sequence from the newest restart record — so it is assertable without a new record or field. Numeric parity is exact: the shell permits ten restarts and exits 1 on the eleventh stuck; the delivered budget refuses at `count >= bound`. The constants are declared policy data, not new configuration keys, and the delay function is injected so the battery runs with zero real waits (the GH-347 `restart-budget`/ladder precedent).

**F-4 — Durable stop.** `loop stop` appends exactly one `loop.stop` record for the loop identity with action `requested` and the requested mode; a repeat appends nothing (idempotent) and still exits 0. `loop reset` appends exactly one record with action `cleared` when a request is folded, otherwise nothing. The stop names the **loop identity**, never a process instance: no pid, start time, or holder participates, which is what makes it survive any number of restarts and crashes. A `start` folds the stop **before** claiming the lease: a folded request yields exit 0 with `state=stopped`, no lease record, no session, and no session record; a torn or unreadable fold fails closed — a `state.*` failure at exit 2 with no lease record and no session — because "unreadable" must never read as "not stopped". A running loop re-reads the fold at every iteration boundary. `mode=drain` (the parity mode) never terminates a session: the loop finishes the current session, then ends. `mode=immediate` terminates the held session within one collection interval plus the declared kill grace and then ends; a session whose process identity cannot be verified is never signalled — the loop reports `session-pid-unknown` and ends at the iteration boundary instead (F-6 case 3). Both release the lease and exit 0. Source: TDR-0056.

**F-5 — Two-signal stuck detection.** The loop's verdict is its own pure rule (DEC-3) over three injected fact sets, because the delivered `evaluateStuck` decides a delivery expectation and would kill a CEO blocked on a healthy delivery:

1. **Sourced progress.** The projected new-turn fact from the delivered mapper over a sourced `token-delta` reading of the recorded session (a positive delta since the last observation is `positive`; a sourced zero is `zero`; no source is `unknown`), plus the last sourced-progress observation the running supervisor holds.
2. **Artifact advance.** No merge or blocker-answer record landed since the baseline (the delivered artifact classes, read from the same verified state read).
3. **Delivery corroborator.** A healthy delivery in progress is read through the F-5 evidence-class and fold tables: `in-progress`, `none`, or `unknown`, decided from delivered lane records and the process-port probe, with no start-time fact consumed.

`stuck` requires **all** of: a live session; sourced progress `zero` for at least `coordinator.stuck-window` (600 000 ms) measured from the last sourced-progress observation the running supervisor holds; no artifact advance since that observation; and a corroborator read that is readable and reports **none**. A supervisor that has only just started seeds that observation at its own session acquisition or its first reading — never earlier — so a process restart can only delay a verdict, never cause one. `progressing` when sourced progress is positive within `coordinator.progress-bound` (300 000 ms) or within the window, or when the corroborator reports a delivery in progress. `unevaluable` when the progress reading is `unknown` **or** the corroborator is unreadable: nothing is killed, exactly one verdict record lands per expectation, and the loop continues — an unreadable corroborator never declares a stuck CEO.

The corroborator is a **total decision over delivered facts** from the same verified state read plus the delivered process-port liveness probe. It consumes exactly these inputs and no others: store readability; the newest `dispatch.lane` record for **every** ref that has one (state, owner `processId` presence, owner liveness); the newest `daemon.lane` record (state, `processId` presence, process liveness). It consumes **no** `startedAt` value, no age bound, and no start-time comparison (§2.1). Owner liveness is the delivered process-port probe on the recorded id: `alive`, `dead`, or `unreadable` (an undeclared or failing probe).

**Evidence classes (each candidate lane contributes at most one class):**

| # | Candidate lane | Contribution |
|---|---|---|
| D1 | no `dispatch.lane` record for the ref (absent) | ignored |
| D2 | newest `dispatch.lane` is `terminal` (any owner pid) | ignored |
| D3 | newest `dispatch.lane` is `active` with an **absent** owner `processId` | `unknown` |
| D4 | newest `dispatch.lane` is `active` with a **present** owner `processId` that is **alive** | `in-progress` |
| D5 | newest `dispatch.lane` is `active` with a **present** owner `processId` that is **dead** | ignored |
| D6 | newest `dispatch.lane` is `active` with a **present** owner `processId` whose liveness is **unreadable** | `unknown` |
| M1 | no `daemon.lane` record (absent) | ignored |
| M2 | newest `daemon.lane` state is anything other than `delivering` | ignored |
| M3 | newest `daemon.lane` is `delivering` with an **absent** `processId` | `unknown` |
| M4 | newest `daemon.lane` is `delivering` with a **present** `processId` that is **alive** | `in-progress` |
| M5 | newest `daemon.lane` is `delivering` with a **present** `processId` that is **dead** | ignored |
| M6 | newest `daemon.lane` is `delivering` with a **present** `processId` whose liveness is **unreadable** | `unknown` |

**Fold (evaluated in this order; the first matching rule decides):**

| # | Condition | Reading |
|---|---|---|
| F0 | the state read is unreadable | `unknown` |
| F1 | any candidate contributes `in-progress` | `in-progress` |
| F2 | else, any candidate contributes `unknown` | `unknown` |
| F3 | else (readable store; every active/delivering candidate was ignored because its owner pid is present and provably dead) | `none` |

The table is total: every reachable combination of store readability, dispatch state (active / terminal / absent), owner pid presence (present / absent), owner liveness (alive / dead / unreadable), daemon state (delivering / other / absent), and daemon pid presence maps to exactly one reading through D1–D6, M1–M6 and F0–F3. `none` is reachable **only** through F3 — that is, only when the store is readable, every candidate `dispatch.lane` is terminal or has an owner that is provably dead, and no `daemon.lane` is `delivering` with a live or unverifiable owner. `in-progress` dominates `unknown` because both are kill-safe and `in-progress` is the more informative of the two.

**Residual risk, stated deliberately.** The rule uses process identity by pid only, so a **reused pid** can make a dead delivery's lane look alive: the corroborator then reads `in-progress` and the loop declines to kill a CEO that is genuinely stuck. That error is a *delay*, bounded by the next time the pid disappears and the window runs again; it can never cause a kill. The opposite asymmetry would be a false `none` for a live delivery, which kills a healthy session — the exact failure INV-DM-3 exists to prevent. A delayed kill is recoverable by an operator (`loop stop --mode immediate` then `loop start`); a killed healthy delivery is not, because the session and its in-flight work are gone. The asymmetry is therefore deliberate and is not to be "tightened" by adding a start-time or age test over a fact the lane does not carry.

It reads only delivered records: it never runs a shell probe, never reads the shell's delivery marker, and writes no lane record. On `stuck` the loop appends one `coordinator.stuck` **verdict** record and then one **outcome** record under the same `stuckId`, with the bounded evidence corpus (`session`, `traffic`, `delivery`, `windowMs`, `progressAgeMs`, `killOutcome`) and the loop-scoped identity the delivered payload requires: `stuckId` and `iterationId` are both the loop-scoped value `<loopId>:<cycle ordinal>` (the ordinal of the supervision cycle that reached the verdict), and `killFailureReason` is populated only on a failed kill and is the delivered `null` otherwise. The loop writes **no** `coordinator.iteration` record and adds no third record kind: the delivered record's `iterationId` is a required string field, not a foreign key, and the loop-scoped value satisfies it without a loop-owned iteration record. It then terminates the session with the identity-verified path (the delivered `terminate` for a session this process holds; `killCoordinatorProcess` for a recorded pid identity — TERM first, KILL only after `coordinator.kill-grace`, no signal on an identity mismatch). A termination that cannot be confirmed is **terminal and closes the loop**: the mismatch or failed-signal arm appends exactly one outcome record, releases the lease, and exits 2 on `coordinator.session.kill-failed` — with no restart and no second session, because a possibly-live orphan must never be joined by another session (F-6). Only a **confirmed** termination proceeds to F-3: it appends one outcome record and then applies the restart path. The bound from last sourced progress to the next session is the **formula** `stuck-window + collection-interval + kill-grace + first backoff`, which is `600 000 + 30 000 + 20 000 + 2 000 = 652 000 ms` at the shipped defaults; the implementation holds the formula, never a hardcoded literal, so an operator-raised collection interval raises the bound accordingly (R-09).

**F-6 — Single instance and session re-find.** The loop claims the delivered append-only instance lease under the distinct supervisor identity `loop-main` (the ledger key is identity-scoped). A live holder is refused `coordinator.already-running` at exit 2 with no session record and no spawn; a dead holder is taken over with exactly one record (liveness first, then the 2 × collection-interval age fallback); an undeclared alive capability is `coordinator.process.capability-gap` at exit 2 before any record. The loop's identity is deliberately distinct from the coordinator's, so `loop start` and `coordinator start --foreground` do not exclude each other and neither reads the other's records. After a takeover, the loop resolves its recorded session before it considers spawning: a recorded pid that is alive **and whose platform start time — read from the delivered process port at acquisition and recorded on the session record — still matches** is joined and observed (no second spawn, and no reliance on a composition timestamp); a session recorded as ended is replaced by exactly one fresh session; a session recorded `active` with no process identity is treated as unknown-liveness and resumed rather than duplicated, so no path spawns a second session beside a recorded live one. At most one CEO session exists at any observation point in the scenario.

**F-7 — Bounded operational log.** The loop appends one single-line, ANSI-free, identifier-only record per supervision event — `start`, `cycle`, `session`, `stuck-verdict`, `kill`, `restart`, `backoff`, `stop`, `budget-exhausted`, `release`, `error` — with `<ISO-8601 UTC> event=<name>` followed by bounded `key=value` pairs. A line is at most 512 UTF-8 bytes; whole pairs are dropped rather than cut. The log lives inside the project state directory beside the state ledger, per loop identity (`loop/<loopId>.log`), and its directory is created by the first append, never by a read. Retention: the active file is rotated to a single retained generation when an append would push it past 1 048 576 bytes; the previous generation is discarded, so the total is at most 2 097 152 bytes and the oldest data is always the data that is dropped. No prompt, transcript, diff, credential, or free-text reason is ever written. The log is bounded **observability, not durable truth**: an append or rotation that fails is swallowed after one bounded attempt, never changes the loop's verdict, exit code, or records, and is disclosed only as the `log-unavailable` degradation entry; a read of an unreadable file reports zero lines with an `unreadable` marker rather than borrowing a failure identity the error table does not declare.

**F-8 — Conformance battery and proof boundary.** One deterministic battery drives the real command path and the real composition with the harness session, the tracker, and the process doubled, and replays the nine proven surfaces (Appendix C). It extends the delivered conformance fixtures rather than introducing a second harness, exercises each production seam through the same composed function production uses, runs with an injected delay that records rather than sleeps, and asserts two identical runs. The no-shell property is proven twice: an injected runner that records and refuses shell invocation, and the delivered static invariant extended over the declared loop surface, with a planted reference as the non-vacuity control; a third observation asserts the loop's declared spawn prompt carries no script path. The proven / not-proven boundary is a permanent fixture constant the delivery-phase test reads (nine proven ids, six not-proven ids, in order, every battery row naming a proven seam); the current-truth page publishes the same boundary in the documentation phase, and a page/constant mismatch is a documentation-phase defect rather than a delivery-phase test failure.

## 6. USER & SYSTEM FLOWS

```
Flow 1: Run the loop
  loop start --foreground
    → fold the durable stop      → requested?  → exit 0, state=stopped (no lease, no session)
    → claim the instance lease   → live holder? → coordinator.already-running, exit 2
    → read the loop session record
    → recorded pid alive + start identity matches? → join and observe (no spawn)
    → otherwise                                    → spawn: agent ceo, seat model, title ceo-loop-<stamp>
    → append loop.session (active, acquired at)
    → cycle: progress + artifact advance + delivery corroborator
        → stop folded?        → drain: end after this session · immediate: terminate, end
        → progressing?        → continue (advance the last-progress observation)
        → unevaluable?        → record once, continue (never kill)
        → stuck?              → verdict → terminate → outcome
              → admit   → restart ordinal n → wait min(2s·2^(n-1), 300s) → spawn → continue
              → refuse  → log budget-exhausted → release → exit 1
    → signal → release → exit 0
```

```
Flow 2: Stop durably, then restart the process
  loop stop --mode drain        → one loop.stop request (identity-scoped, idempotent)
  (process exits, machine reboots, loop crashes)
  loop start --foreground       → folded request → exit 0, state=stopped, nothing started
  loop reset                    → one loop.stop clearance
  loop start --foreground       → runs
```

```
Flow 3: Two starts, and a start after an unclean death
  A: loop start --foreground → lease acquired, session spawned
  B: loop start --foreground → live holder → coordinator.already-running (exit 2), no session
  A is killed -9 (no release record; the detached session survives)
  C: loop start --foreground → liveness-first takeover, one lease record
                             → recorded pid alive + start identity matches → join (no second spawn)
```

```
Flow 4: A stuck CEO, and a CEO blocked on a healthy delivery
  stuck:      progress zero ≥ 600 s + no artifact advance + corroborator readable & none
              → verdict → terminate (TERM→grace→KILL) → outcome → restart(n)+backoff → spawn
  not stuck:  progress zero ≥ 600 s + corroborator reports a live delivery in progress
              → progressing (no kill); the CEO keeps waiting on its delivery
  unknown:    corroborator unreadable → unevaluable → no kill, continue
```

```
Flow 5: Conformance battery
  offline, deterministic
    → nine proven surfaces through the real composition + real command path
    → injected harness session, tracker, platform, process runner, delay recorder
    → pick-deliver-merge scenario: spawn → doubled CEO session calls the primitives → progress observed → next iteration
    → 0 shell invocations + static no-shell invariant + prompt script-path scan
    → reports the proven / not-proven boundary
```

## 7. SCOPE & BOUNDARIES

### 7.1 In Scope

- The `loop` command family: five verbs, their grammar, their flags, their refusals, their exits, their human and machine output contracts.
- The loop supervision cycle composed over the delivered engine primitives under the `loop-main` identity.
- The loop's durable session record (session identity, process identity, acquisition time, state) and the additive optional harness process-id fact it needs.
- The loop's two-signal stuck predicate, its verdict/outcome recording, and its identity-verified termination path.
- The bounded restart backoff, the per-epoch budget consumption, and the exhaustion exit.
- The durable stop request and clearance, and the start-time refusal over a folded request.
- The bounded operational log, its rotation rule, and the `log` read.
- Single instance over the delivered lease, the distinct identity, and the session re-find after a takeover.
- The conformance battery, the permanent proof-boundary constant, the extended no-shell surface, and the three pinned help-inventory updates.
- The decision log for the family boundary, the durable-stop home, the stuck predicate, the backoff and budget reuse, the session-progress source, the parity mapping and its deliberate divergences, and the proof boundary.

### 7.2 Out of Scope

- [OUT] Deleting, editing, or re-pointing `scripts/ceo-loop.sh`; retiring the shell loop is F6 (GH-352).
- [OUT] Any agent definition or agent prompt edit, including `.opencode/agent/ceo.md`; that is F5 (GH-351).
- [OUT] A second supervision engine, a second lease, a second kill path, or a second budget fold.
- [OUT] Any change to the coordinator family's grammar, payloads, records, reasons, defaults, behaviour, or identities.
- [OUT] Declarative provider policy, quota, peak-window parking, or cost routing (GH-350 / stage F2).
- [OUT] Owner escalation on budget exhaustion, and any new owner-facing question type.
- [OUT] Merge or closeout changes (GH-349 / stage F4).
- [OUT] The shell's pre-iteration hook, its port, or any replacement capability.
- [OUT] A new configuration key, a new error identity, a new domain kind, or a delivered record schema-version change.
- [OUT] `--max-iterations`, `--verbose`-only diagnostics, `logs --follow`, `pause`, `resume`, `attach`, or `loop install`.
- [OUT] Live-provider, live-opencode, OS-process-tree, or real-tracker claims beyond Appendix C.

### 7.3 Deferred / Maybe-Later

- **Context-limited CEO session resume.** The shell resumes the previous session when its context is below 100 000 tokens. The typed surface has no total-context source (the delivered coordinator page already declares `resume-context` unreachable in production), so a restart starts a fresh session and the delivered `coordinator.resume-context-limit` stays unread by this change. Revisit when a bounded last-turn context read exists; the trigger is any change to the harness session fact set.
- **Owner escalation on loop budget exhaustion.** Deferred deliberately (NG-6): the reserved escalation slot is coordinator-scoped, and putting a `loop-main` question into the owner brief is a rendered-surface change nobody requested. Revisit if loop exhaustion proves to need owner attention rather than an operator retry.
- **A dedicated backoff/limits configuration branch.** The schedule is declared policy data today. Add keys only if an operator need for tuning appears; the trigger is a second operator request, and the config layer's rule is that no bound literal lives in decision code.
- **The reused exhaustion row's remediation text.** `coordinator.restart-budget-exhausted` advises the coordinator form. The loop carries the correct remediation in its own failure summary; editing the delivered row would ripple to the coordinator page and the error-table fixtures. Revisit with the coordinator's own next contract change.
- **A `loop log --follow` streaming read** and a structured (JSON-per-line) log format.
- **Multi-loop identities** (more than one CEO loop per host) and any per-project loop fleet; the identity is a single declared default today.
- **Prompt re-pointing and shell thin-wrapping** remain F5/F6.

## 8. INTERFACES & INTEGRATION CONTRACTS

### 8.1 REST / HTTP Endpoints

No inbound or outbound HTTP endpoint is added, changed, or removed. This change's interfaces are in-process command contracts:

| ID | Surface | Contract |
|----|---------|----------|
| API-1 | `loop start --foreground [--fresh-budget]` | Returns either a refusal (folded-stop exit 0 is not a refusal: it is a success with `state=stopped`) or, when the foreground cycle ends, a success receipt whose `state` is `stopped` and whose `instance` names the acquisition the start held. The foreground cycle ends for exactly five declared causes: a folded stop, a signal, the composition's cycle driver reporting its declared end (a declared clean end — success, exit 0), a budget exhaustion (exit 1), or a failure (its mapped exit). It refuses `coordinator.already-running` (exit 2) for a live holder, `coordinator.process.capability-gap` (exit 2) for an undeclared capability, `coordinator.session.kill-failed` (exit 2) for an unconfirmed termination — in which case the loop appends exactly one outcome record, releases the lease, and starts no further session — `coordinator.restart-budget-exhausted` (exit 1) at the bound, a `state.*` failure (exit 2) for an unreadable stop fold or an unreadable state read, and the delivered provider/config/harness refusals (exit 1) for a session that cannot be established. It appends no session record when no session was established, and it always releases the lease it holds. The delivered global flags `--json`, `--verbose`, and `--pretty` are accepted and are never refusals. |
| API-2 | `loop stop [--mode drain\|immediate]` | Appends at most one durable stop request (`requested`) for the loop identity, with the mode; idempotent within a stop episode; never signals a session; never touches the lease; exits 0 whether or not a loop is running. `drain` is the default. |
| API-3 | `loop reset` | Appends at most one durable stop clearance (`cleared`) when a request is folded; otherwise appends nothing; exits 0 either way. |
| API-4 | `loop status` | Read-only projection `delivery.loop.v1` over exactly the sources the status-key table declares: the constant `loop_id`; the instance folded from the lease (or `null`); state (`running` / `stopped` / `unknown`); **live** session facts (session id, alive, pid) plus the **recorded** title and progress state; restarts (count / bound / epoch / last reason) where the bound is the **composition-supplied** resolved `coordinator.restart-budget` and never a configuration read by the handler; the last persisted verdict (verdict / reason / evidence); the stop fact (folded state and mode, projected as `stop_signal` and `stop_mode`, plus its recorded time); and a bounded degradation list from the closed set {`session-pid-unknown`, `progress-unreadable`, `delivery-corroborator-unreadable`, `live-facts-unknown`, `log-unavailable`}. Zero records appended; no configuration, network, or model read in the handler. Every absent value projects as the empty string, `loop_id` is always the constant identity, and no `none` token is produced. Human output is the declared key block; machine output is the payload. |
| API-5 | `loop log [--lines <n>]` | Returns a read-only log projection `delivery.loop.log.v1`: the requested tail (`n` an integer 1–100, default 50), the returned line count, the total byte count, a truncation flag, and an `unreadable` marker. A missing, empty, or unreadable log is a success with zero lines (and `unreadable` true only in the last case); no file or directory is created by the read. Zero records appended. |
| API-6 | Process execution | Every harness session is started with a fixed argv, no shell, and no script path. The loop's supervision flow invokes no shell script and reads no shell probe. A runner asked to use a shell or a script path is a defect and fails by name. |
| API-7 | Output contract | Human output is deterministic, ANSI-free, and bounded: at most 32 lines for `start`, `stop`, `status`, and `reset`; for `log`, one header line plus at most `n` content lines. Machine `data` — selected by the delivered global `--json`, which (with `--verbose` and `--pretty`) is accepted on every verb and is never a grammar refusal — is at most 65 536 bytes for every verb. Status human output is a block of `key=value` lines in the declared order — the six shell names first (`loop_running`, `loop_pid`, `ceo_alive`, `ceo_pid`, `ceo_session`, `stop_signal`), then the additive keys (`stop_mode`, `loop_id`, `ceo_title`, `restarts`, `budget_epoch`, `last_restart_reason`, `last_verdict`, `degraded`). Exactly three keys are boolean — `loop_running`, `ceo_alive`, and `stop_signal` — and they render `yes`/`no`; `stop_mode` renders `drain` or `immediate` when a stop is folded and is otherwise empty; `restarts` renders `<n>/<bound>`; and every key whose value is absent renders as the **empty string after `=`**, never as a placeholder token: the six shell keys keep the shell's own `key=` rendering, and a fixed key order plus an empty value is unambiguous. No `none` token is emitted for an absent value. The source of each key, and therefore which keys can ever be empty, is the normative status-key source table below. |

**Status-key sources (normative).** Every key in the status block has exactly one declared source. "Live" means the fact is read from the currently live holder or session; "recorded" means the newest durable record for the loop identity.

| Key | Source | When it is empty |
|---|---|---|
| `loop_running` | the live lease holder (a folded lease action `acquired`/`stale-takeover`/`stop-requested` whose recorded holder is alive) | never — renders `no` |
| `loop_pid` | the live lease holder's recorded pid | when there is no live holder |
| `ceo_alive` | the **live** session's liveness (recorded pid alive, or the in-process handle live) | never — renders `no` |
| `ceo_pid` | the **live** session only (its recorded pid) | when the session is not alive — shell parity: the shell's `--status` reads `ceo_pid`/`ceo_session` only from a live CEO child, so an ended session renders both empty |
| `ceo_session` | the **live** session only (its recorded session id) | when the session is not alive — shell parity, as above |
| `stop_signal` | the folded `loop.stop` request (`yes` when folded as `requested`) | never — renders `no` |
| `stop_mode` | the folded request's mode | when no stop is folded |
| `loop_id` | the **constant** supervisor identity `loop-main` | never — always present |
| `ceo_title` | the recorded fresh-spawn title of the newest `loop.session` record | when no session has ever been established |
| `restarts` | `<count>/<bound>` from the current epoch's restart fold plus the composition-supplied bound | never — renders `0/<bound>` |
| `budget_epoch` | the persisted epoch (the latest non-null value on the lease carrier, else the newest restart record) | when no epoch has been persisted |
| `last_restart_reason` | the newest `coordinator.restart` record's reason | when no restart has been recorded |
| `last_verdict` | the newest persisted `coordinator.stuck` verdict | when no verdict has been recorded |
| `degraded` | the closed degradation list | when the list is empty |

The consequence is normative with the table: an **absent-identifier** status keeps `loop_id=loop-main` and `restarts=0/<bound>` and renders only the genuinely optional identifiers empty — `loop_pid=`, `ceo_pid=`, `ceo_session=`, `stop_mode=`, `ceo_title=`, `budget_epoch=`, `last_restart_reason=`, `last_verdict=`, `degraded=`. `loop_id` is the constant identity and is never the lease instance id; `loop_pid` is the instance's pid, so the two are never the same value and neither stands in for the other.

### 8.2 Events / Messages

No event, message, telemetry record, metric, alert, or rendered-surface row is added. The two new durable artefacts are state records (§8.3), not events. A restart appends the delivered `coordinator.restart`; a stuck verdict appends the delivered `coordinator.stuck` verdict/outcome pair; the log is a bounded operational file, not an event stream. The loop publishes no question and no answer to the blocker channel.

### 8.3 Data Model Impact

| ID | Element | Description |
|----|---------|-------------|
| DM-1 | `loop.session` record | New duck-typed durable record, payload schema `delivery.loop.session.v1`, key `loop.sessions:<loopId>`, append-only with latest-wins reading. Fields: `schemaId`, `sessionRecordId`, `loopId`, `sessionId`, `harnessKind`, `pid` (positive integer, or `null` when the adapter supplies none), `processStartTimeMs` (positive integer, or `null`), `title` (the fresh-spawn title, or `null`), `state` (`active` \| `ended`), `acquiredAt`, `recordedAt`. Exactly one append per session acquisition and one per state change — never one per cycle, so a quiet or a continuously progressing session appends nothing. It carries no prompt, transcript, diff, credential, or provider payload, and no model or seat name. It is loop-owned: the coordinator never reads it (it reads only its own identity's keys), the daemon family never reads or writes it, and the loop never writes a daemon lane. |
| DM-2 | `loop.stop` record | New durable record, payload schema `delivery.loop.stop.v1`, key `loop.stops:<loopId>`, append-only with latest-wins reading and exactly one record per transition. Fields: `schemaId`, `stopId`, `loopId`, `action` (`requested` \| `cleared`), `mode` (`drain` \| `immediate`, or `null` on a clearance), `recordedAt`. Identity-scoped: no pid, holder, or instance participates. Source: TDR-0056. |
| DM-3 | Additive harness session process identity | `HarnessSessionHandle` gains an optional `pid` (positive integer) and the streaming spawn seam gains an optional `pid`; the opencode adapter fills both from the host starter's child, so a spawned or resumed session exposes the process it leads. Absent stays absent — never fabricated, never zero — and the loop records `null`. No capability name is added; an adapter that exposes nothing keeps its delivered behaviour, and the loop then degrades conservatively: a recorded `active` session without a pid is treated as unknown-liveness (no stuck verdict) and is resumed rather than duplicated. |
| DM-4 | Loop observation payloads | `delivery.loop.v1` (API-4) and `delivery.loop.log.v1` (API-5) are new read-only projections; neither is persisted. Every field is identifier-only and bounded; the degradation list uses a closed five-value vocabulary. |
| DM-5 | Restart-policy facts | Declared policy data, not configuration: `restartDelayMs(n) = min(2 000 × 2^(n−1), 300 000)` for `n ≥ 1`; the delay is injected; the bound is the delivered `coordinator.restart-budget` (default 10); the ordinal source is the delivered `coordinator.restart` fold. The reason is the delivered closed value `stuck-artifact-evidence` — no new reason token is introduced — and this is a **declared operator-facing compromise**: the loop's verdict is the two-signal rule, not artifact evidence, so the distinguishing facts (traffic state, corroborator reading, progress age) ride the bounded evidence corpus of the paired verdict record, and an operator must read that corpus (or the loop's `event=restart` log line) to tell a loop restart from a coordinator restart. The at-bound history reference is the derivable string `epoch-<n>;restarts=<count>;seq=<newest restart record's ledger sequence>`. |
| DM-6 | Stuck-predicate and stuck-record facts | **Predicate inputs** (F-5): sourced progress state (`positive` / `zero` / `unknown`) with its observation time; the last sourced-progress observation the supervisor holds; the artifact-advance booleans; and the delivery corroborator reading (`in-progress` / `none` / `unknown`) computed by the F-5 evidence-class and fold tables over store readability, each newest `dispatch.lane` state with its owner `processId` presence and liveness, and the newest `daemon.lane` state with its `processId` presence and liveness — with **no** owner `startedAt`, age, or start-time comparison consumed. `stuck-window` and `progress-bound` come from the delivered coordinator keys. **Verdict vocabulary:** the delivered `progressing` / `stuck` / `unevaluable`; persisted reasons are the delivered `stuck-artifact-evidence` and `evidence-unevaluable`. No new verdict, reason, or evidence class is introduced. **Record fields the loop must populate on the delivered `coordinator.stuck` payload:** `stuckId` and `iterationId` both set to the loop-scoped value `<loopId>:<cycle ordinal>` (the ordinal of the cycle that reached the verdict), `coordinatorId` set to the loop identity, `verdict`, `phase` (`verdict` then `outcome` under the same `stuckId`), `reason`, `evidence`, `killOutcome`, `killFailureReason` populated **only** on a failed kill (the delivered `null` otherwise), and `recordedAt`. The loop writes **no** `coordinator.iteration` record and adds **no** third record kind and no loop iteration record: the delivered `iterationId` is a required string, not a foreign key. |
| DM-7 | Log retention bounds | Declared constants: line ≤ 512 UTF-8 bytes; active file ≤ 1 048 576 bytes; one retained rotated generation; total ≤ 2 097 152 bytes; `--lines` default 50 and maximum 100; machine response ≤ 65 536 bytes. |
| DM-8 | Configuration | Zero new keys. The loop consumes the six delivered `coordinator.*` keys and their shipped defaults (§2.1). Five of the shell's knobs map onto five of them value-for-value; `CEO_LOOP_SLEEP_SECONDS` is replaced by the backoff schedule plus `coordinator.collection-interval`, `CEO_LOOP_MAX_ITERATIONS=0` is replaced by an unbounded loop, and `coordinator.progress-bound` has no shell counterpart. |
| DM-9 | Parity coverage matrix | One declared row per proven surface (Appendix C): the five verbs and their grammar, the log contract and retention, the spawn identity and pre-session refusals, the two-signal verdict and its unevaluable paths, the terminate ordering and exact targets, the delay schedule and budget accounting, the durable stop and both modes, the two-start interleaving and session re-find, and the no-shell invariant. Each row names the production seam it exercises and the observation it asserts; no row may be satisfied by a seam reimplementation. |

### 8.4 External Integrations

No live external integration is added or changed. The battery is offline: the harness session is a scripted port, the tracker and platform effects are deterministic fixtures, the process runner is injected, and the delay recorder advances a virtual clock. The live opencode CLI, the live provider profile selection, and real process-tree signalling remain the production path and are outside the proof boundary (Appendix C). The opencode per-session totals reader is a delivered seam and is exercised through the same function production uses.

### 8.5 Backward Compatibility and Deliberate Behaviour Changes

**The coordinator family is untouched.** Its grammar, flags, payloads, records, reasons, defaults, and behaviour are unchanged, and no coordinator module is edited: no new lease, no new predicate, no new escalation path, no change to `evaluateStuck`, `decideLifecycle`, `evaluateCoordinatorRestartAdmission`, or the six config defaults. The delivered coordinator suites stay green without modification, and the loop's records live under a different identity key, which the delivered per-identity read skips by construction.

**The shell stays present.** `scripts/ceo-loop.sh` is not edited, not deleted, and not re-pointed; it remains the documented, executable fallback until F6. This change proves the typed loop never needs it.

**The two stop mechanisms are not interchangeable during dual-run.** The typed stop is a ledger record and the shell stop is a workspace file; neither reads the other. A `loop stop` does not stop a running `scripts/ceo-loop.sh`, and a `ceo-loop.sh --stop` does not stop the typed loop. That is deliberate — importing or writing the other surface's marker would add the exact second durable-truth coupling this change removes — and the reference page states it, so an operator switching between the two paths uses that path's own stop and reset. The F6 handover is where the shell path stops being an option.

**Nothing is removed from the CLI.** `loop` is additive; the prompt-required inventory grows from 26 to 27 families with `loop` appended last. That is a **pin update, not a relaxation**, and it touches three pinned suites: the install-family comparator keeps its count, missing/undeclared, and tail rules with the new expected tail (`install` immediately before `loop`); the metrics-mounting suite keeps its positional and count assertions at the new total **and its stale-pin scan set gains 26**, so a leftover 26-family pin cannot survive the repin undetected; and the reference-page-parity suite's duplicated per-command page mapping **learns the M4 root for `loop`**, without which it would resolve `loop` to a non-existent M1 page. Every pinning suite keeps a mutation control that fails by name when `loop` is removed, and no assertion is deleted or inverted.

**Deliberate behaviour changes for an operator who moves from the shell to the loop** — each is a declared divergence with a reason, and each is asserted by a named criterion:

| # | Shell behaviour | Typed loop behaviour | Reason |
|---|---|---|---|
| 1 | A second `ceo-loop.sh` logs and exits **0** | `coordinator.already-running` at exit **2** | Reuse of the delivered lease identity; a silent success would hide a refused start. |
| 2 | Usage error exits **2** | Grammar refusal exits **1** (`fallback.invocation`) | The closed projection table maps `user-validation` to 1; exit 2 is reserved for the platform class, which now means "a supervision failure", not "bad arguments". |
| 3 | Restart counter is in-memory, reset each run | Budget is durable per epoch across starts; `--fresh-budget` resets it | A crash-looping start must not launder its own history; the operator keeps an explicit reset. |
| 4 | Fixed 2 s pause between iterations | Stuck restarts wait `min(2 s × 2^(n−1), 300 s)`; ordinary iterations wait `coordinator.collection-interval` | The ticket requires backoff; a fixed pause does not damp a crash loop. |
| 5 | Resumes the previous session when its context is under 100 000 tokens | Starts a fresh session (`resume-context` unreachable without a total-context source) | Declared limitation of the delivered fact set; deferred with a trigger (§7.3). |
| 6 | `--log` tails the CEO's stdout transcript, unbounded | `log` returns the loop's bounded supervision log | The adapter consumes the session stream, so a transcript tail is not available to the composition; retention is required by the ticket. |
| 7 | `--stop` is honoured when the session ends (never kills) | `stop` defaults to `drain` (identical), `--mode immediate` opts into termination | Parity is the default; the immediate mode follows the delivered `daemon stop --mode` precedent. |
| 8 | The pre-iteration hook runs before every spawn | No hook | Retired by design; provider policy (F2) replaces it. |
| 9 | Five `CEO_LOOP_*` knobs plus `CEO_RESUME_TOKEN_LIMIT` (six shell knobs in total) | Five `coordinator.*` configuration keys with matching values, one key (`progress-bound`) with no shell counterpart, and no shell knob for sleep or iteration count | One configuration layer; no new keys; no environment contract; the two shell knobs that encoded a pause and an iteration cap are replaced by the backoff schedule and an unbounded loop. |
| 10 | `--log <value>` accepts any integer, silently falls back to 50 on a non-integer, and has no upper bound | `--lines` is an integer 1–100 and anything else is a grammar refusal | A malformed or unbounded read is reported rather than guessed, and the response stays inside the declared machine bound. |

## 9. NON-FUNCTIONAL REQUIREMENTS (NFRs)

| ID | Requirement | Threshold |
|----|-------------|-----------|
| NFR-1 | Offline determinism | The battery performs 0 live network calls and 0 live child-process starts; two consecutive runs produce identical envelopes, record counts, and verdict coverage; the injected delay records rather than sleeps (0 real waits) |
| NFR-2 | Bounded output | Human output ≤ 32 lines for `start`/`stop`/`status`/`reset` and ≤ 1 + `n` lines for `log`; machine `data` ≤ 65 536 bytes per verb; 0 ANSI escapes; status keys in the declared order |
| NFR-3 | Log retention | Line ≤ 512 UTF-8 bytes; active file ≤ 1 048 576 bytes; ≤ 1 retained rotated generation; total ≤ 2 097 152 bytes; a rotation drops the oldest generation; `log` returns ≤ 100 lines and ≤ 65 536 bytes; a log write or rotation failure never changes the loop's verdict, exit, or records |
| NFR-4 | Durable stop | 100% of folded requests prevent a start (0 lease records, 0 sessions, 0 session records); a running loop honours `drain` at the next iteration boundary and `immediate` within `collection-interval + kill-grace` (≤ 50 000 ms); repeated `stop`/`reset` append ≤ 1 record each |
| NFR-5 | Stuck-verdict safety | 100% of kills require a live session, sourced progress `zero` for ≥ `coordinator.stuck-window`, no artifact advance, and a readable corroborator reporting `none` through the F-5 fold; 0 kills when a healthy delivery is in progress; 0 kills on an unreadable corroborator or an unreadable progress reading; 0 corroborator start-time or age comparisons; detection-to-next-session ≤ `stuck-window + collection-interval + kill-grace + first backoff` (652 000 ms at the shipped defaults), with the formula — not the literal — the implementation's contract |
| NFR-6 | Single instance and session uniqueness | 2 concurrent starts yield exactly 1 admitted and 1 `coordinator.already-running`; 0 double claims; 0 second spawns while a live recorded session exists; exactly 1 lease record per acquisition or takeover |
| NFR-7 | Contract invariance | 0 new error identities, 0 new domain kinds, 0 new configuration keys, 0 changed coordinator records/payloads/defaults/behaviour, 0 delivered schema-version bumps; exactly 2 new record kinds; exactly 1 additive optional harness fact |
| NFR-8 | Restart accounting | Exactly 1 `coordinator.restart` per consumed ordinal; exactly 1 ordinal per stuck restart; 0 ordinals for a clean session end; the declared delay at every ordinal; 0 restarts above the bound; 1 `coordinator.stuck` verdict and 1 outcome per stuck episode |
| NFR-9 | No shell dependency | 0 shell invocations across the battery and the loop flow; 0 script-path literals or shell-exec references in the declared loop surface; 0 script paths in the loop's spawn prompt; a planted reference fails the invariant by name |
| NFR-10 | Record and log hygiene | No prompt, transcript, diff, credential, environment value, provider payload, model name, or seat name in any record, log line, summary, or diagnostic; verdict evidence ≤ 512 UTF-8 bytes; every diagnostic single-line and identifier-only |
| NFR-11 | Read economy | One verified state read per supervision cycle; 0 additional reads for `status`, `log`, or `reset` beyond the store read the projection needs; 0 writes for `status` and `log` |

## 10. TELEMETRY & OBSERVABILITY REQUIREMENTS

- **Durable state is the primary observability surface.** The loop's lease (`coordinator.fence` under `loop-main`), its restart records, its stuck verdict/outcome pair, its session record, and its stop record are all inspectable durable state, readable without the process.
- **`status` is the operator read.** It projects the six shell keys first (so an existing operator's key=value consumer keeps working) and only bounded additive keys after them.
- **The operational log is the narrative.** Its closed event vocabulary makes a loop run reconstructible from the file alone: start, cycle, session, stuck-verdict, kill, restart (with ordinal, reason, delay), backoff, stop, budget-exhausted, release, error.
- **Degradation is explicit and bounded.** A missing pid, an unreadable progress source, or an unreadable corroborator appears on the closed degradation list; none of them is silently treated as healthy, and none of them alone produces a kill.
- **No new metric, alert, event, or dashboard row.** The command audit ledger records the invocation as delivered.
- **Cost is bounded and declared.** A full epoch's restart delays are ≤ 1 110 000 ms; a cycle performs one state read; the log is capped at 2 MiB per identity.

## 11. RISKS & MITIGATIONS

| ID | Risk | Impact | Probability | Mitigation | Residual Risk |
|----|------|--------|-------------|------------|---------------|
| RSK-1 | The loop is read as a second supervisor and drifts from the engine | H | M | The reuse boundary is enumerated (F-1, DEC-1, TDR-0055); no coordinator module is edited; the loop's identity is distinct; a structural case asserts the loop imports the delivered primitives and reimplements none of the lease/budget/kill folds | L |
| RSK-2 | A stuck verdict kills a CEO that is waiting on a healthy delivery | H | M | The corroborator is a required, readable input decided by the published F-5 evidence-class and fold tables; a lane whose owner pid is present and alive vetoes the kill, with no start-time or age test that could misread a live delivery (`DispatchLaneOwner.startedAt` is a composition instant, not a process start time); an unreadable input or an absent pid yields `unknown` and never `none`; a dedicated case asserts a 20-minute-zero-traffic CEO with a live `active` lane whose composition timestamp differs from any platform reading is still not killed | L |
| RSK-3 | An unreadable signal is treated as "no progress" and produces a kill | H | L | `unknown` maps to `unevaluable` on both the progress and corroborator inputs; the case asserts 0 kills for each unreadable input | L |
| RSK-4 | Termination signals an unrelated process | H | L | Both paths are identity-verified (pid + start time, or session id / exact title); no broad pattern; a case asserts 0 unrelated signals, and an unconfirmed termination is terminal (one outcome record, lease released, exit 2, **no restart**), so a failed kill can never escalate into a second session | M |
| RSK-5 | A start after an unclean death spawns a second CEO beside the orphan | H | M | The session record carries the pid and start time; a takeover re-finds the live session and joins it; without a pid the loop refuses to duplicate and degrades conservatively; a failed kill is terminal too, so that duplicate-spawn window never opens; a case asserts ≤ 1 session across the takeover scenario | M |
| RSK-6 | A durable stop is silently forgotten or over-cleared | H | L | The stop is an append-only identity-scoped record read before the claim; the transition is idempotent; a case stops, simulates a process restart, and asserts the next start does nothing | L |
| RSK-7 | The backoff or budget change the shell's crash-loop behaviour unexpectedly | M | M | Numeric parity is stated and pinned (ten restarts then exit 1); the delay is declared data with an injected clock; the total is bounded; a case asserts the exact schedule and the total | L |
| RSK-8 | The append-last inventory update silently weakens the install-family gate | M | M | The comparator keeps its count, missing/undeclared, and tail rules with the new expected tail; the metrics-mounting stale-pin scan set gains 26 so a leftover 26-family pin fails; the reference-page-parity mapping learns the M4 root so `loop` cannot resolve to a missing M1 page; the mutation control that removes `loop` must fail by name; no assertion is deleted or inverted | L |
| RSK-9 | The battery proves fixtures, not a real loop | H | M | The proven/not-proven boundary is a permanent machine-checked constant; the battery exercises the real composition; live behaviour is named as not proven (Appendix C) | M |
| RSK-10 | Log retention loses the evidence an operator needs | M | M | Generation-based rotation always drops the oldest data, keeps the newest 1 MiB active plus one previous generation, and the bound is declared; `status` and the durable records carry the same facts in structured form | L |
| RSK-11 | The additive handle `pid` breaks a consumer or a double | M | L | Optional member, absent stays absent, no capability name added; pinned surfaces updated exactly; existing suites prove the absence path unchanged | L |
| RSK-12 | Scope creeps into prompt re-pointing or shell retirement | M | M | Explicit non-goals; the loop writes no agent file and no script; the loop's own prompt is a declared composition fact | L |

## 12. ASSUMPTIONS

- The delivered engine primitives (lease claim/fold, restart budget/admission, stuck record pair, kill-with-grace, per-identity state read) are correct and unchanged; this change composes them and does not re-verify their internal design.
- The coordinator's artifact-evidence stuck predicate is the right predicate for a delivery expectation and the wrong one for a long-lived CEO session; the two must therefore differ (DEC-3).
- `INV-DM-3` is the binding definition of a stuck CEO: no session traffic **and** no healthy delivery in progress.
- A delivered `dispatch.lane` record with `state: active` and a **present, alive** owner `processId`, or a `daemon.lane` record in `delivering` with a present, alive `processId`, is a truthful "healthy delivery in progress" fact. A readable store in which every candidate lane is terminal or its owner is provably dead is a truthful "none"; an unreadable store, an absent pid, or an unreadable liveness probe is "unknown", never "none".
- A monotonic per-session token total is a legitimate sourced progress signal (`token-delta` is a declared sourced-signal kind); a session that produces no tokens while its session is alive has not progressed.
- Five of the six `coordinator.*` defaults match five of the shell's knobs numerically by coincidence of purpose, not by contract; the sixth (`progress-bound`) has no shell counterpart. This change adopts the delivered branch rather than adding six parallel keys.
- The delivery budget's `count >= bound` refusal is numerically equivalent to the shell's `restarts > MAX_RESTARTS` exit, so ten restarts are permitted in both.
- The host spawn starter's detached process group means a session can outlive a killed loop process; therefore the loop needs a durable session identity including the process id.
- The M4 reference root is the correct home for a new M4 family page, and the M1 snapshot root must never serve it.
- The delivered conformance fixtures and the state double are the correct home for the battery; a second harness would prove a second implementation.

## 13. DEPENDENCIES

| Direction | Item | Notes |
|-----------|------|-------|
| Depends on | Delivered coordinator supervision engine | Consumed, not modified: lease, budget/admission, stuck record pair, kill primitives, per-identity read |
| Depends on | Delivered harness session port and adapters | Gains one additive optional process-id fact; `terminate`, `agent`, `binding`, `title` are consumed as delivered |
| Depends on | Delivered per-spawn policy resolution (profile binding) | The only "policy-resolved provider" in scope; GH-350 is not a dependency |
| Depends on | Delivered `dispatch.lane` and `daemon.lane` records (GH-347) | The delivery-in-progress corroborator reads them; it writes neither |
| Depends on | Delivered durable state ledger | Two new record kinds; no schema bump of a delivered kind |
| Depends on | Delivered permissioned reads: `merge`, `closeout`, `dispatch`, `queue`, `phase` | The CEO session drives the cycle with these primitives; this change adds none |
| Depends on | Six `coordinator.*` configuration keys | Consumed with their shipped defaults; zero keys added |
| Depends on | Help inventory, coverage fixture, and the help/guide coverage check | One new family, one M4 reference page, and three pinned updates (install-family tail, metrics-mounting count plus stale-pin scan set, reference-page-parity page mapping) |
| Blocks | Flip stage F6 (jaiship-only dogfood, thin wrappers) | Internal delivery cannot run jaiship-only without the loop surface |
| Related | GH-349 (F4 merge/closeout repair) | Not a dependency: `merge` and `closeout` are delivered and consumed |
| Related | GH-350 (F2 provider policy) | Not a dependency and not pre-implemented |
| Related | GH-351 (F5 prompts), GH-352 (F6 dogfood) | Own prompt re-pointing and shell retirement |

## 14. OPEN QUESTIONS

No question blocks this change. Every contract-level fork is settled by a recorded decision in section 15. Two of them are precedent-setting and are recorded outside this spec (TDR-0055, TDR-0056), each **Proposed** pending human acceptance at the GH-348 PR gate. The remaining forks are change-local because they fix a composition detail over delivered contracts without setting a new architectural precedent.

| ID | Question | Context | Status |
|----|----------|---------|--------|
| — | None | The family boundary (DEC-1), the durable-stop home (DEC-2), the stuck predicate (DEC-3), the backoff and budget reuse (DEC-4), the progress source (DEC-5), the parity mapping (DEC-6), and the proof boundary (DEC-7) are all decided with reasons; implementation-decided details are listed in Appendix D. | Closed |

## 15. DECISION LOG

| ID | Decision | Rationale | Date |
|----|----------|-----------|------|
| DEC-1 | **Family boundary (ticket task 1).** Add `loop` as a new command family over the delivered supervision engine primitives, under the distinct supervisor identity `loop-main`; reuse the `coordinator.fence` lease, the `coordinator.restart` budget with `evaluateCoordinatorRestartAdmission`, the `coordinator.stuck` verdict/outcome pair, the identity-verified kill primitives, the six `coordinator.*` keys, and the per-identity state read. Do **not** reuse the coordinator's cycle, its artifact-evidence predicate, its wake, its escalation, its lifecycle decision, or its observation payload; do not extend `coordinator`; do not build an independent supervisor. | The F3 stage names `jaiship loop`; the ticket names five verbs, two of which the coordinator does not have. Extending `coordinator` would put two targets and two stuck predicates on one surface, and its predicate would kill a CEO blocked on a healthy delivery. An independent supervisor would add a second lease, a second kill path (the highest-risk surface), duplicate folds, and contract churn. Source: TDR-0055. | 2026-11-19 |
| DEC-2 | **Durable stop home (ticket task 4, NFR-5).** A new `loop.stop` record (`delivery.loop.stop.v1`, key `loop.stops:<loopId>`), identity-scoped, append-only, latest-wins, with the transitions `requested` / `cleared` and idempotent appends. Do not reuse the coordinator's `stop-requested` lease action, and do not use a state file. | The coordinator's action is per-holder by design and the lease fold treats it as a still-held lease, so it cannot make a stop survive a restart — a later start would be refused `coordinator.already-running`. A state file adds a second durable truth location with its own lifecycle and leaves no auditable transition. Source: TDR-0056. | 2026-11-19 |
| DEC-3 | **Stuck predicate (ticket task 5).** The loop owns a pure two-signal predicate (sourced progress zero for the window, no artifact advance, and a readable corroborator reporting none) and reuses the delivered verdict vocabulary, record pair, and kill path. `unknown` on either input yields `unevaluable` and never a kill. The coordinator's `evaluateStuck` is not modified and remains its own predicate. | INV-DM-3/5 is the binding definition; the delivered predicate decides a delivery expectation (merge/answer artifacts) and would kill a CEO blocked on a healthy delivery. A single predicate cannot serve two targets without a discriminator nobody asked for, and adding one would change a delivered decision path. Change-local: the vocabulary and records are delivered; only the fact set is new. | 2026-11-19 |
| DEC-4 | **Restart policy (ticket task 3).** Only a stuck restart consumes an ordinal; the delay before the next session is `min(2 000 × 2^(n−1), 300 000)` ms for ordinal `n`, declared as policy data with an injected delay; the bound is the delivered `coordinator.restart-budget` (default 10); at the bound the loop exits 1 on `coordinator.restart-budget-exhausted` with its own remediation summary; no owner escalation. | The ticket requires backoff; the shell has none. Reusing the delivered budget gives exact numeric parity with the shell's ten-restarts-then-fail behaviour and avoids a seventh key. Declared constants plus an injected delay are the GH-347 precedent for a bounded policy with no configuration key. Escalation is coordinator-scoped and would change a rendered owner surface nobody asked for. | 2026-11-19 |
| DEC-5 | **Session progress source (ticket task 5).** Sourced progress is a `token-delta` derived from the delivered per-session totals reader for the recorded session id, mapped through the delivered new-turn mapper. Not the adapter's `liveness` (construction-time static facts, absent in production), not the `watchdog` command (check-only, zero production sources), not a shell probe, and not a new adapter capability. | The delivered liveness path yields `unknown` in production, so the shell's INV-DM-5 signal has no typed equivalent; the totals reader is delivered, reads the same store, and maps onto a declared sourced-signal kind. The watchdog is explicitly check-only and its production sources are empty, so it cannot be the loop's liveness source. Change-local composition choice. | 2026-11-19 |
| DEC-6 | **Parity mapping and its declared divergences.** The five shells surfaces become five verbs; the six status keys keep their names and order; exit 0 is parity; exit 1 covers the shell's usage and max-restarts outcomes under the closed projection (usage → `fallback.invocation`, budget → `coordinator.restart-budget-exhausted`); exit 2 is the platform class, so a second start is a refusal at exit 2 rather than the shell's silent 0. The ten behaviours in §8.5 are declared divergences. | Equivalence is a property of verbs and effects, not of numeric exit literals; the closed projection table cannot map a usage refusal to 2 without mislabelling a user error as a platform failure. A silent success on a refused start hides an operator error, and a silently coerced log request hides a typo. Every divergence is named and asserted. | 2026-11-19 |
| DEC-7 | **Proof boundary and inventory pins.** Prove the nine surfaces in Appendix C over the real composition with harness/tracker/process doubled; publish the permanent boundary constant (nine proven, six not-proven, in order) and mirror it on the current-truth page in phase 7; extend the delivered no-shell surface rather than adding a second invariant; append `loop` last in the prompt-required inventory and update the three pinned suites — the install-family comparator's count and tail, the metrics-mounting positional/count assertions **and its stale-pin scan set, which must gain 26**, and the reference-page-parity page mapping, which **must learn the M4 root** — with every mutation control intact. | The ticket's final acceptance claim is a property, not an observation; GH-347's discipline is the repository's proven pattern, and a page/constant mismatch is a documentation defect, not a delivery failure. Appending last keeps the inventory's declared order and makes the pin update explicit and reviewable. The two extra surfaces are named because each would otherwise fail silently or wrongly: a duplicated page mapping resolves `loop` to a non-existent M1 page, and a stale-pin scan that stops at 25 cannot detect a leftover 26-family pin after the repin. | 2026-11-19 |

### 15.1 Decision records

| DEC | Decision record | Status |
|-----|-----------------|--------|
| DEC-1 | TDR-0055 — Loop supervision as a profile over the coordinator supervision engine | Proposed (pending human acceptance at the GH-348 PR gate) |
| DEC-2 | TDR-0056 — The durable loop stop is a state-ledger record, not a file | Proposed (pending human acceptance at the GH-348 PR gate) |

DEC-3, DEC-4, DEC-5, DEC-6, and DEC-7 are change-local: each fixes a composition detail over delivered contracts and sets no new architectural precedent, so no record is authored. They cite the delivered TDR-0018 (artifact evidence), TDR-0017 (coordinator architecture), and the GH-347 bounded-policy precedent (TDR-0052) where their reasoning depends on them.

## 16. AFFECTED COMPONENTS (HIGH-LEVEL)

Composition map — what is added or moved, and what is deliberately untouched. The entrypoint composes exactly the prompt-required set and throws for a prompt-required name the program lacks (`selectPromptRequiredProgram`), so adding `loop` to the inventory forces the production composition in the same change; a registered extra is dropped and never advertised, so no partial surface can ship.

| Component / module | Impact |
|---|---|
| `loop` command definition (new command module) | New: the five-verb grammar, the flag sets, the refusals, and the human/machine dispatch |
| Loop supervisor module (new) | New: the bounded supervision cycle composed over the delivered lease, budget, stuck records, kill primitives, and the loop's own verdict and backoff |
| Loop text renderer (new) | New: the deterministic, ANSI-free, bounded status block and receipts |
| Loop contracts (new) | New: the closed verb/mode/event/degradation vocabularies, the two record payload types, the retention and output bounds, and the backoff policy data |
| Loop state module (new) | New: the `loop.session` and `loop.stop` append/read/fold operations |
| Loop domain module (new) | New: the pure stuck predicate, the backoff schedule, the log-line renderer, and the status projection |
| Edge composition | Extended: a loop composition type, its runtime factory, and the command registration |
| Production composition | Extended: the loop's session profile (CEO agent identity, title, the per-spawn profile port), the progress reader, the corroborator read, the process port, and the log sink |
| Harness session contract | Additive: optional `pid` on the session handle and the streaming spawn seam |
| Harness opencode adapter | Additive: carries the starter's child pid onto the handle |
| Coordinator family and its modules | **Unchanged** — no edit; behaviour, records, grammar, payloads, identities identical |
| Help surface | Extended: one family entry rooted at the M4 reference root; root families 26 → 27 |
| Prompt-required inventory and coverage fixture | Extended: `loop` appended last; one M4 reference page row |
| Help/guide coverage check | Extended: the M4 page root mapping for `loop` |
| Reference page `doc/planning/oss-tooling/milestones/m4/commands/loop.md` | New: the operator reference page with `--help`/`--version` and the distribution marker |
| Static no-shell invariant | Extended: the declared surface list gains the loop modules and the loop prompt module |
| Conformance fixtures and the battery | Extended: the loop scenario, the seam doubles, and the permanent boundary constant |
| Configuration | Values unchanged; six `coordinator.*` keys consumed; zero keys added |
| Error table and domain kinds | **Unchanged** — zero rows, zero kinds |
| `tests/checks/install-conformance-mutants.test.ts` | Updated exactly: the family count 26 → 27 and the tail pair (`install` immediately before `loop`); mutation controls kept |
| `tests/structure/metrics-mounting.test.ts` | Updated exactly: the positional and count assertions at 27 families, and the stale-pin scan set `toHaveLength(2[345])` gains 26 so a planted 26-family pin fails by name |
| `tests/checks/reference-page-parity.test.ts` | Updated exactly: the duplicated per-command page mapping learns the M4 root, so `loop` resolves to the M4 reference page instead of a non-existent M1 page |
| Current-truth documentation | Reconciled in the documentation phase (Appendix A) |

## 17. ACCEPTANCE CRITERIA

Each criterion names the case-level proof that closes it. "Scenario" means the deterministic conformance battery over the real composition; "unit" means a pure-domain case; "structure" means a source or contract invariant.

### 17.1 Family, grammar, and verb parity (F-1)

| ID | Criterion | Proof | Linked |
|----|-----------|-------|--------|
| AC-F1-1 | **Given** the five declared verbs, **when** each is invoked with a declared flag set, **then** it performs its declared effect and returns its declared payload; **and when** any other subcommand, a missing subcommand, an undeclared flag, or a malformed `--lines` value is supplied, **then** the invocation is refused as `fallback.invocation` at exit 1 with `result=refused; reason=grammar` and appends no record. | Grammar table case: one green case per verb × flag combination and one refusal case per malformed form, asserting exit code, error code, and the record count delta (0). | F-1, API-1, API-2, API-3, API-5 |
| AC-F1-2 | **Given** a running or stopped loop, **when** `loop status` is invoked, **then** the human output is a `key=value` block whose first six keys are exactly `loop_running`, `loop_pid`, `ceo_alive`, `ceo_pid`, `ceo_session`, `stop_signal` in that order, with `yes`/`no` for exactly those three boolean keys, then `stop_mode` and the remaining additive keys, every key sourced exactly as the API-7 status-key table declares, and every absent value rendered as the empty string after `=` with no `none` token: in particular `loop_id=loop-main` and `restarts=0/<bound>` are **never** empty, `ceo_pid`/`ceo_session` are empty whenever the session is not alive, and only the optional identifiers render bare; ANSI-free and within 32 lines; the machine payload is `delivery.loop.v1` within 65 536 bytes. | Scenario case: three snapshots (running, stopped, and absent-identifier) compared against declared golden text and golden JSON, with the absent-identifier golden asserting `loop_id=loop-main`, `restarts=0/<bound>`, the bare `ceo_pid=`/`ceo_session=`/`loop_pid=` lines, and the absence of the `none` token; a byte/line bound assertion and an ANSI scan. | F-1, API-4, API-7, NFR-2 |
| AC-F1-3 | **Given** an operational log, **when** `loop log` is invoked with no flag, **then** it returns the last 50 lines; **when** `--lines 1` or `--lines 100` is supplied, **then** it returns that many; **when** `--lines 0`, `--lines 101`, or a non-integer is supplied, **then** the invocation is a grammar refusal at exit 1; **and when** no log exists, **then** it succeeds with zero lines and a truncation flag of false. | Scenario case per bound (0, 1, 50, 100, 101, non-integer, missing file) asserting the payload, the exit, and the byte bound. | F-1, API-5, F-7, NFR-3 |
| AC-F1-4 | **Given** no loop running, **when** `loop stop` is invoked, **then** it appends one durable stop request and exits 0; **when** `loop reset` is invoked with no request folded, **then** it appends nothing and exits 0; **when** `loop reset` is invoked with a request folded, **then** it appends one clearance and exits 0. | Unit case over the stop fold plus a scenario case asserting the record delta and exit for each of the four invocations. | F-1, F-4, API-2, API-3 |
| AC-F1-5 | **Given** any state, **when** `loop status` or `loop log` is invoked, **then** zero records are appended, no file or directory is created, the command handler reads no configuration branch — the composition supplies the resolved settings, including the budget bound behind `restarts=<n>/<bound>`, and a configuration acquisition or resolution failure falls back to the shipped defaults, so the surface always composes — no network call is made, and no session effect is applied. | Structure case over the composed runtime with a counting store double, a read-only file-system double, a handler-scoped configuration double that records zero handler reads (while the composition supplies a resolved bound), and a refusing network double; asserted as 0 writes, 0 created paths, and 0 handler-scoped configuration reads. | F-1, API-4, API-5, NFR-11 |

### 17.2 CEO spawn identity and provider binding (F-2)

| ID | Criterion | Proof | Linked |
|----|-----------|-------|--------|
| AC-F2-1 | **Given** a fresh session, **when** its invocation is built, **then** it carries the caller agent identity `ceo`, renders exactly one `--agent ceo` together with the binding's resolved `--model`, uses a fixed argv with no shell, and passes the declared loop prompt as data. | Spawn-builder case over the real adapter argv assembly, asserting the exact argument vector and `shell:false`. | F-2, API-6, NFR-9 |
| AC-F2-2 | **Given** a fresh session, **when** its arguments are built, **then** it carries exactly one `--title ceo-loop-<UTC yyyymmdd-hhmmss>` (≤ 64 characters) and that title is the reap identity the termination path matches; **and given** a resume, **then** no title is carried. | Spawn-builder case for the argv plus a terminate case asserting the reap target set is exactly the session id and that title. | F-2, DM-1, DM-3 |
| AC-F2-3 | **Given** a CEO seat that the selected profile does not assign, **when** the loop starts, **then** the spawn is refused pre-session on the delivered `provider.profile.invalid` at exit 1, no session and no session record are created, and the lease is released; **given** an unresolvable profile context, **then** the refusal is the delivered `config.value.invalid`; **given** an unrepresentable seat model, **then** `harness.profile.model-unrepresentable`. | Scenario case per refusal: exit, code, record delta (0 session records), and a released lease in the fold. | F-2, DM-1, NFR-7 |
| AC-F2-4 | **Given** the production binding path, **when** a spawn is resolved, **then** the binding is the delivered per-spawn single-seat resolution over the selected profile and chain — the same composed function the dispatch surface uses — and no second resolver, no policy evaluation, and no operator flag participates. | Structure case asserting the loop composition mounts the delivered profile-port wrapper and the delivered resolution helper, plus a scenario case asserting the resolved seat model reaches the argv. | F-2, API-6, NFR-7 |

### 17.3 Restart policy, backoff, and budget (F-3)

| ID | Criterion | Proof | Linked |
|----|-----------|-------|--------|
| AC-F3-1 | **Given** a stuck verdict below the bound and a **confirmed** termination of the stuck session, **when** the loop restarts, **then** it appends exactly one `coordinator.restart` with the next contiguous ordinal, the reason, and the replaced session identity, appends exactly one new session record, and starts exactly one new session — and it appends no second restart record for the same episode. | Scenario case asserting the restart fold, the ordinal, the record counts, and the spawn count; a companion case asserts that an unconfirmed termination produces no restart record and no spawn. | F-3, DM-5, NFR-8 |
| AC-F3-2 | **Given** ordinals 1–10, **when** the delay is computed, **then** it is exactly 2 000, 4 000, 8 000, 16 000, 32 000, 64 000, 128 000, 256 000, 300 000, 300 000 ms; the total for a full epoch is ≤ 1 110 000 ms; the wait is cancellable by a durable stop or a signal without applying the session effect. | Unit case over the schedule table plus a scenario case with the recording delay double asserting the ordered delay list, the total, and the cancellation path. | F-3, DM-5 |
| AC-F3-3 | **Given** a persisted count at the bound (10), **when** a stuck verdict is reached, **then** no restart record is appended, no new session starts, the loop releases the lease, logs `event=budget-exhausted`, and exits 1 on `coordinator.restart-budget-exhausted` with a bounded summary naming the history reference `epoch-<n>;restarts=<count>;seq=<the newest restart record's ledger sequence>`, `restarts=<n>/<bound>`, and the `--fresh-budget` remediation. | Scenario case at the bound asserting zero restart records, one exit-1 failure with the code, and the summary asserted **field by field**: the epoch matches the lease carrier, the count matches the epoch's restart fold, and the sequence matches the newest `coordinator.restart` record's ledger position, each derived from durable state rather than hardcoded. | F-3, DM-5, NFR-8 |
| AC-F3-4 | **Given** an exhausted budget, **when** `start --fresh-budget` is invoked, **then** the next epoch is opened, the count is 0, the previous epoch's records remain readable, and the epoch is durable across a subsequent status and start. | Scenario case: exhaust, start with a fresh budget, assert the epoch identity on the lease carrier and the reset count. | F-3, DM-5 |
| AC-F3-5 | **Given** a session that ends on its own, **when** the next iteration starts, **then** no restart ordinal is consumed, no restart record is appended, and no backoff delay is applied; the next session starts after the ordinary collection interval. | Scenario case for a clean end and for an unclean non-stuck end, asserting zero restart records and the ordinary inter-cycle wait. | F-3, DM-5 |
| AC-F3-6 | **Given** a stuck restart, **when** the operator reads the evidence, **then** the `coordinator.stuck` outcome and the restart record together name the ordinal, the delivered closed reason `stuck-artifact-evidence` (the declared compromise), the delay applied, and a bounded identifier-only evidence corpus that carries the two-signal facts (`traffic`, `delivery`, `progressAge`), and one log line carries the same facts — so a loop restart is distinguishable from a coordinator restart only through the corpus, as declared. | Scenario case asserting the record fields, the corpus keys, and the log line against the declared grammar and the 512-byte evidence bound; a case asserts that the corpus — not the reason token — is what distinguishes the two supervisors. | F-3, DM-5, DM-6, NFR-10 |

### 17.4 Durable stop (F-4)

| ID | Criterion | Proof | Linked |
|----|-----------|-------|--------|
| AC-F4-1 | **Given** no stop folded, **when** `loop stop` is invoked twice, **then** exactly one `requested` record is appended, the second invocation appends nothing, and both exit 0. | Unit case over the stop fold plus a scenario case asserting a record delta of 1 then 0. | F-4, DM-2, NFR-4 |
| AC-F4-2 | **Given** a folded `requested` stop, **when** a fresh process runs `loop start --foreground`, **then** it exits 0 with `state=stopped`, appends no lease record, creates no session, and appends no session record — after a simulated process restart and after a simulated crash; **and given** an unreadable stop fold, **then** the start fails closed with a `state.*` failure at exit 2, appends no lease record, and creates no session. | Scenario case: stop, tear down the composition, rebuild it, start; assert exit 0, state, and zero lease/session deltas; plus an unreadable-fold case asserting the typed failure and zero session effects. | F-4, DM-2, NFR-4 |
| AC-F4-3 | **Given** a folded request, **when** `loop reset` is invoked and then `loop start --foreground`, **then** exactly one `cleared` record is appended and the loop runs; **and when** `loop reset` is invoked twice, **then** the second appends nothing. | Scenario case asserting the clearance record, the subsequent running state, and the idempotent second reset. | F-4, DM-2 |
| AC-F4-4 | **Given** a running loop with a live session, **when** `stop --mode drain` is invoked, **then** the session is not terminated and the loop ends at the next iteration boundary; **when** `stop --mode immediate` is invoked, **then** the session is terminated within `collection-interval + kill-grace` (≤ 50 000 ms), or — when its process identity cannot be verified — it is not signalled and the loop ends at the boundary with `session-pid-unknown` reported; both release the lease and exit 0. | Scenario case for each mode asserting the terminate call count (0 vs 1), the elapsed virtual time bound, the lease release, and the exit; plus the unverifiable-identity case asserting 0 signals. | F-4, DM-2, NFR-4 |
| AC-F4-5 | **Given** a stop record, **when** its payload is inspected, **then** it carries the loop identity, the action, the mode, and timestamps only — no pid, no holder, no instance identity — and a stop recorded by one process is honoured by any later process. | Structure case over the payload shape plus a scenario case proving cross-process honouring. | F-4, DM-2 |

### 17.5 Two-signal stuck detection and termination (F-5)

| ID | Criterion | Proof | Linked |
|----|-----------|-------|--------|
| AC-F5-1 | **Given** a live session with a sourced progress reading of zero for at least `coordinator.stuck-window`, no artifact advance since the last progress observation, and a readable corroborator reporting no delivery, **when** the cycle evaluates, **then** the verdict is `stuck`, exactly one verdict record with the evidence corpus lands carrying `stuckId` = `iterationId` = the loop-scoped `<loopId>:<cycle ordinal>` and a `killFailureReason` of `null`, the session is terminated, exactly one outcome record lands under the same `stuckId`, and — only after a **confirmed** termination — the restart path applies. | Scenario case with the recording clock and the scripted progress/artifact/corroborator doubles; assert verdict, the record fields (`iterationId`, `phase`, `killFailureReason`), record counts, terminate call, and the restart. | F-5, DM-6, NFR-5 |
| AC-F5-2 | **Given** sourced positive progress within `coordinator.progress-bound`, **when** the cycle evaluates, **then** the verdict is `progressing`, no verdict record lands, and no terminate is invoked. | Scenario case with a positive progress double; assert zero records and zero terminate calls. | F-5, DM-6, NFR-5 |
| AC-F5-3 | **Given** a live session with zero sourced progress for the whole window and a corroborator reporting a healthy delivery in progress, **when** the cycle evaluates, **then** the verdict is `progressing`, no kill occurs, and the loop keeps observing. | Scenario case: a 20-minute virtual window of zero traffic with a live `dispatch.lane` whose owner pid is alive and whose recorded `startedAt` is the composition instant (deliberately unlike any platform process start time); assert 0 terminates and 0 verdict records, so the pid-only owner-liveness rule is proven live-shape and not fixture-shape. | F-5, DM-6, NFR-5 |
| AC-F5-4 | **Given** an unreadable progress reading, **when** the cycle evaluates, **then** the verdict is `unevaluable`; **given** an unreadable corroborator, **then** likewise; in both cases exactly one verdict record per expectation lands, no terminate is invoked, and the loop continues; an unreadable corroborator never produces a `stuck` verdict. | Scenario case per unreadable input; assert `unevaluable`, 1 record, 0 terminates, and continued cycling. | F-5, DM-6, NFR-5 |
| AC-F5-5 | **Given** the shipped defaults and then a raised `coordinator.collection-interval`, **when** a session stops progressing and the termination is **confirmed**, **then** detection-to-next-session is at most the bound **formula** `stuck-window + collection-interval + kill-grace + first backoff` of virtual time — 652 000 ms at the shipped defaults — and a raised interval raises the bound by exactly the interval delta (an unconfirmed termination ends the loop instead, per AC-F5-6). | Scenario case with the recording clock asserting the elapsed virtual time against the computed formula at two interval settings and the shipped-default value, plus the unconfirmed branch asserting no next session; a source-level assertion rejects a hardcoded 652 000 literal over the configured interval. | F-5, DM-5, NFR-5 |
| AC-F5-6 | **Given** a stuck verdict, **when** the session is terminated, **then** TERM is sent first, KILL only after `coordinator.kill-grace`, KILL only when the tree is still listed, only this session's process tree or its exact session id / title is signalled, and an identity mismatch sends no signal and yields `coordinator.session.kill-failed` at exit 2 with exactly one outcome record carrying `killFailureReason=identity-mismatch`, the lease released, **no restart, and no second session**. | Terminate case over the injected process-tree seam asserting the signal order, the grace boundary, the exact target set, the `killFailureReason` value on the mismatch arm, the mismatch path, and the no-restart consequence. | F-5, DM-3, NFR-5 |
| AC-F5-7 | **Given** the corroborator, **when** it evaluates, **then** it reads only the delivered `dispatch.lane` and `daemon.lane` records from the single verified state read, consumes only the documented F-5 inputs (store readability, lane states, owner/daemon `processId` presence, and the process-port liveness of those ids) and **no** `startedAt` value, age, or start-time fact, writes no lane record, runs no shell probe, and reads no `.ai/local` delivery marker. | Structure case (no lane appender imported, no process runner, no path literal, and no `startedAt`/start-time read on the corroborator path) plus a scenario case asserting the lane record count is unchanged across the battery. | F-5, NFR-9, NFR-10 |

### 17.6 Single instance and session re-find (F-6)

| ID | Criterion | Proof | Linked |
|----|-----------|-------|--------|
| AC-F6-1 | **Given** two concurrent starts with no lease, **when** both claim, **then** exactly one acquires and runs, the other receives `coordinator.already-running` at exit 2, appends no session record, and spawns no session. | Deterministic interleaving case over the real store fence; assert 1 acquisition, 1 refusal, and the session-record delta per invocation. | F-6, NFR-6 |
| AC-F6-2 | **Given** a lease whose holder died without releasing, covered by a recorded live session, **when** a start claims, **then** it appends exactly one takeover record and joins the recorded session (0 spawns); **given** a recorded ended session, **then** it starts exactly one fresh session. | Two-case scenario over a seeded lease and session record; assert the lease fold, the spawn count, and the session record state. | F-6, DM-1, NFR-6 |
| AC-F6-3 | **Given** a running loop, **when** `coordinator start --foreground` claims, **then** it is admitted (distinct identity) and neither surface reads the other's records; **and given** a running coordinator, **then** `loop start --foreground` is admitted. | Two-identity scenario asserting both claims succeed and each read returns only its own identity's records. | F-6, DM-1 |
| AC-F6-4 | **Given** the whole battery including the takeover scenario, **when** it completes, **then** at no observation point does more than one CEO session exist, and no spawn occurs while a live recorded session is present. | Scenario invariant asserted after every step of the takeover and restart flows. | F-6, NFR-6 |
| AC-F6-5 | **Given** a harness kind whose adapter supplies no process id, **when** a recorded session is `active`, **then** the loop treats it as unknown-liveness (no stuck verdict), resumes it rather than spawning a second session, and reports `session-pid-unknown` on the degradation list. | Scenario case with a pid-less session double; assert 0 spawns, 0 kills, 1 degradation entry. | F-6, DM-1, DM-3, API-4 |

### 17.7 Bounded operational log (F-7)

| ID | Criterion | Proof | Linked |
|----|-----------|-------|--------|
| AC-F7-1 | **Given** any supervision event, **when** it is logged, **then** exactly one single-line ANSI-free entry is appended from the closed event vocabulary, with `<ISO-8601 UTC> event=<name>` and bounded `key=value` pairs, at most 512 UTF-8 bytes, containing no prompt, transcript, credential, environment value, model, or seat name. | Unit case over the renderer for every event and for an oversized field list; plus a scan of a full scenario log for the forbidden content classes. | F-7, DM-7, NFR-3, NFR-10 |
| AC-F7-2 | **Given** an active log near its bound, **when** an append would exceed 1 048 576 bytes, **then** the active file rotates to a single generation, the previous generation is discarded, the total never exceeds 2 097 152 bytes, and the newest data is always retained; **and given** a write that fails, **then** the loop's verdict, exit, and records are unchanged and the failure appears only as `log-unavailable` on the degradation list. | Unit case over an injected file system double with a scripted append sequence crossing the bound twice, plus a failing-write case asserting an unchanged verdict and the single degradation entry. | F-7, DM-7, NFR-3 |
| AC-F7-3 | **Given** a log, **when** `log --lines 100` is read, **then** the response is within 100 lines and 65 536 bytes with a correct truncation flag; **when** the active file is empty, **then** the response is zero lines and a false truncation flag. | Scenario case over the log read at both bounds. | F-7, API-5, NFR-2 |
| AC-F7-4 | **Given** the log location, **when** it is resolved, **then** it is inside the project state directory beside the state ledger, per loop identity, and never inside the working tree; the directory is created by the first log append and never by a read, so a `log` read on a missing file succeeds with zero lines and creates nothing; an unreadable file yields zero lines with the `unreadable` marker at exit 0, and no failure identity is borrowed for a log fault. | Structure case over the path resolver plus two read cases (missing file, unreadable file) asserting zero created paths, the marker, and the exit. | F-7, NFR-3 |

### 17.8 Conformance battery, proof boundary, and no-shell proof (F-8)

| ID | Criterion | Proof | Linked |
|----|-----------|-------|--------|
| AC-F8-1 | **Given** the battery, **when** it runs, **then** every one of the nine proven surfaces is exercised through the real composition and the real command path, and no case reimplements a seam. | Battery meta-case asserting that each declared row maps to a proven surface and that the seam assertions are non-vacuous (a mutated seam fails by name). | F-8, DM-9, NFR-1 |
| AC-F8-2 | **Given** two consecutive battery runs, **when** their outputs are canonicalized and compared, **then** envelopes, record counts, verdict coverage, and delay lists are identical, with zero live network calls, zero live child processes, and zero real waits. | Determinism case plus injected network/child-process/delay guards recording zero. | F-8, NFR-1 |
| AC-F8-3 | **Given** the whole battery, **when** it runs, **then** the injected runner records zero shell invocations, the static no-shell invariant reports zero violations over the declared loop surface, the loop's declared spawn prompt contains zero script-path literals, and a planted reference fails the invariant by name. | Three complementary cases: runner recording, static scan with the mutation control, and a prompt-content scan. | F-8, API-6, NFR-9 |
| AC-F8-4 | **Given** the pick-deliver-merge scenario, **when** the loop runs, **then** it spawns the CEO session with the declared prompt, the doubled session issues the pick, deliver, and merge primitives through the real command runtime over fixtures, the loop observes the resulting artifact progress and stays healthy (zero kills, zero restarts), the session ends, and the next iteration starts — with zero shell entry points on the path and zero shell invocations recorded. | End-to-end scenario case asserting the spawn, the three primitive invocations, the zero-kill observation, the iteration transition, and the runner's zero. | F-8, F-1, F-5, API-6, NFR-9 |
| AC-F8-5 | **Given** the permanent boundary constant, **when** the delivery-phase case reads it, **then** it carries nine proven ids and six not-proven ids in their declared order, every battery row names a proven surface, and both a missing id and a reordered id fail by name; **and when** the current-truth page is reconciled, **then** the mechanism is a documentation-phase check — the phase-7 guard compares the page's published boundary with the fixture constant and fails the documentation phase, not a delivery case, on any mismatch. | Boundary case over the constant plus its two mutation controls; the page/constant comparison is a documentation-phase guard check whose failure is reported against the documentation phase. | F-8, DM-9, NFR-1 |

## 18. DEFINITION OF DONE

The change is done only when every item below is observed, not merely asserted. Every acceptance criterion in section 17 is closed by a named case, and section 17 contains 41 criteria.

| ID | Definition-of-Done item | How observed |
|----|-------------------------|--------------|
| DOD-1 | All 41 acceptance criteria are satisfied, each with its named evidence. | The test plan's traceability matrix maps every `AC-*` (41/41, reconciled against section 17) to its owning case; the DoD check confirms from the final aggregate-gate log that each owning case ran green. No separate coverage program is implied. |
| DOD-2 | The aggregate quality gate is green. | `TMPDIR=$PWD/tmp/tmpdir pnpm check` exits 0; the captured log is attached to the change; no check is skipped, disabled, or made vacuous. |
| DOD-3 | The branch-range commit-message gate is `PASS`. | The repository's range lint prints `PASS` over the change branch's own commits (not `SKIP`, not an unresolved `ERROR`), recorded as a pm-notes `notes:` entry. |
| DOD-4 | The battery is complete, deterministic, and offline. | Two consecutive runs each cover all nine proven surfaces; a canonicalized comparison of the two runs is identical; the injected network, child-process, and delay guards record zero. |
| DOD-5 | The no-shell invariant is green with its non-vacuity control. | The injected runner records zero shell invocations; the static invariant reports zero violations over the declared loop surface and the loop prompt scan reports zero script paths; a planted reference fails the check by name. |
| DOD-6 | The contract-invariance claim is observed. | A contract diff shows 0 new error identities, 0 new domain kinds, 0 new configuration keys, 0 changes to coordinator records, payloads, defaults, or behaviour, and exactly 2 new record kinds plus 1 additive optional harness fact; the delivered coordinator suites pass unmodified. |
| DOD-7 | The shell and the prompts are untouched. | Two named observations, one per half. **Shell half:** the permanent tree invariant `tests/structure/provider-surface.test.ts` pins `scripts/ceo-loop.sh` by sha256 (`LEGACY_HOOK_FILES`) and fails by name on any byte change; the DoD check reads its green result from the aggregate gate. **Prompt half:** the PR-time change-surface review, recorded in the change's code-review artifact (`code-review/review-iter-<N>.yaml` in this change folder) and summarised in the PR record, confirms no file under `.opencode/agent/` was modified; this half is deliberately not a diff assertion, because a permanent prompt-diff assertion is forbidden by the repository's testing strategy. |
| DOD-8 | The pinned help inventory is updated, not weakened. | The prompt-required set has 27 entries with `loop` last; the install-family comparator's count, missing/undeclared, and tail rules pass with the new expected values; the metrics-mounting positional and count rules pass at 27 and its stale-pin scan set includes 26, so a planted 26-family pin fails by name; the reference-page-parity mapping resolves `loop` to the M4 page and every see-also target exists; a control that removes `loop` fails by name; no assertion was deleted. |
| DOD-9 | Current-truth documentation is reconciled with no residual gap. | Every page named in Appendix A is updated in the documentation phase — including `doc/spec/features/feature-state-layer.md` (both new record kinds with their payload schemas, keys and writer), `doc/spec/features/feature-coordinator-supervision.md` (its §3 pid limitation reconciled against DM-3 and its other declared limitations re-read), and the new `doc/quality/test-specs/test-spec-loop-supervision.md`; the new current-truth page states the family, the engine reuse boundary, the durable stop, the verdict rule and its corroborator tables, the restart-reason compromise, the backoff, the retention, and the proof boundary. The stale-statement check is the **phase-7 documentation-phase guard**: a grep over the reconciled page set for statements that the outer loop is only `scripts/ceo-loop.sh`, run as part of the documentation phase and reporting zero hits. |

## 19. ROLLOUT & CHANGE MANAGEMENT (HIGH-LEVEL)

- Delivered as one change on `feat/GH-348/loop-supervision` targeting the tooling integration branch; merge authority stays outside this change.
- Landed by outcome so each contract is proven with the evidence that depends on it: (1) the contracts and closed vocabularies; (2) the two record kinds and their folds; (3) the instance lease, budget reuse, and the session record with the additive harness fact; (4) the spawn identity and per-spawn binding; (5) the two-signal verdict and the terminate path; (6) the backoff and the exhaustion exit; (7) the durable stop and `reset`; (8) the log and the `log` verb; (9) the command family and the help/reference surface; (10) the conformance battery and the proof boundary; (11) current-truth documentation.
- No feature flag. The new family is additive and the shell path is untouched, so a repository that still depends on `ceo-loop.sh` keeps it; nothing in this change forces a cutover.
- Adoption is an operator decision recorded elsewhere (F6). The reference page states the divergences (§8.5) so a cutover is informed rather than surprising.
- Release impact is a minor version change for a pre-1.0 CLI: a new command family and two additive record kinds, with no vocabulary, error-table, configuration, or delivered-schema change.
- Communication targets the supervision, dispatch, harness, and conformance owners. Reviewers should read the engine-reuse boundary (F-1, TDR-0055) and the proof boundary (Appendix C) as the authoritative statements.

## 20. DATA MIGRATION / SEEDING (IF APPLICABLE)

No migration is required and no backfill is possible. `loop.session` and `loop.stop` are new additive kinds; their absence is a classified state — no recorded session (a first start), and no folded stop (not stopped) — and neither is fabricated. No delivered record is rewritten, no key is renamed, and no schema version is bumped. An operator moving from `scripts/ceo-loop.sh` starts with an empty typed loop: the shell's `.ai/local/ceo/stop` marker and `last-session` file are **not** imported, and the loop does not read them; conversely the shell does not read the typed stop record. A workspace that was stopped under the shell is simply not stopped under the loop, and a workspace stopped under the loop is not stopped for the shell — each path's own stop and reset governs that path (§8.5). `--fresh-budget` is the only seeding-like action, and it opens an epoch rather than writing history.

## 21. PRIVACY / COMPLIANCE REVIEW

- No personal data is introduced. The new records carry a session identity, a process id, a process start time, a loop identity, a generation title, and timestamps — operational identifiers already present in the delivered attempt, lane, daemon, and coordinator records.
- The process id and start time are used for liveness and exact-identity termination only; they are not personal identifiers and are not exported beyond the durable state and the bounded log.
- The log is identifier-only: no prompt, transcript, diff, credential, environment value, model name, or seat name is written; the bound is 512 bytes per line and 2 MiB per identity in total.
- The battery uses synthetic fixtures, scripted sessions, and example identifiers; it records no live provider payload and no credential material.
- No telemetry flow is added, so no new personal-data flow exists.
- The corroborator reads delivery lane records that already exist for operational supervision; it introduces no new collection and no new retention.

## 22. SECURITY REVIEW HIGHLIGHTS

- **Termination is the privilege boundary and it is not re-implemented.** The loop uses the delivered identity-verified paths: pid plus platform start time for a recorded process identity, and the session's own process tree or exact session id/title for a session this process holds. No name or pattern match exists, a mismatch sends no signal, and an undeclared capability is a typed gap before anything is signalled.
- **No shell injection surface.** Sessions start from a fixed argv with no shell; the title is generated from a fixed template and a UTC stamp; the prompt is passed as data; the loop's supervision flow invokes no script and reads no shell probe.
- **Single-instance exclusion is the delivered lease.** The loop invents no lock file and no pid-file probe; a live holder is refused before any session effect, and a takeover requires either a dead holder or an elapsed age bound past an unanswered probe.
- **No second error system.** Zero new identities, zero new domain kinds. A provider refusal keeps its delivered identity, a kill failure keeps `coordinator.session.kill-failed`, a budget boundary keeps `coordinator.restart-budget-exhausted`, and store failures keep their `state.*` identities.
- **Honest unknown everywhere.** An unreadable progress reading does not become "zero", an unreadable corroborator does not become "no delivery", an unavailable pid does not become a fabricated number, and an unread token count is never quoted. Silent degradation on any of these is the primary failure mode this change removes.
- **Secret hygiene.** Records, log lines, summaries, and diagnostics are identifier-only and bounded; no credential, environment value, prompt, or provider payload is recorded. The delivered secret-read boundary is untouched.
- **Scope safety.** No shell file, no agent prompt, no configuration key, no error row, and no coordinator behaviour is changed, so the review surface is the new operator surface, the two record shapes, and the termination reuse — all explicitly bounded.

## 23. MAINTENANCE & OPERATIONS IMPACT

- **One engine, one profile.** The loop reuses the delivered primitives; a change to the lease, the budget, or the kill path is made once. A future profile adds a composition, not a supervisor.
- **Two new durable surfaces.** `loop.session` and `loop.stop` are small, append-only, latest-wins records. Adding a field is a recorded contract change, not a convention.
- **One declared policy table.** The backoff schedule is data in one place; a reviewer can see the whole restart policy without reading test code, and tuning it is a visible change.
- **The battery is the regression gate.** A future change that moves a verdict condition, drops the corroborator, breaks the durable stop, reintroduces a shell dependency, or weakens the retention bound fails a named case.
- **On-call sees a bounded, typed surface.** A loop run is reconstructible from `status`, the durable records, and at most 2 MiB of log; the failure identities are the delivered ones, with the correct remediation in the loop's own summary.
- **Cost is bounded.** A full epoch's restart delays are ≤ 1 110 000 ms, the session count per cycle is one, and the state read per cycle is one.
- **The shell remains the documented fallback** until F6, so an operator can fall back without a code change.

## 24. GLOSSARY

| Term | Definition |
|------|------------|
| Loop family | The `jaiship loop` command family: `start`, `stop`, `status`, `log`, `reset` — the typed Mode A operator surface. |
| Supervision engine | The delivered lease, restart-budget, stuck-record, and kill-with-grace machinery the coordinator family is composed from. |
| Supervisor profile | A composition of the engine primitives for one supervised target; the loop is a profile over the CEO session, the coordinator over a delivery expectation. |
| Supervisor identity | The ledger identity a profile writes under; `coordinator-main` for the coordinator, `loop-main` for the loop. |
| Instance lease | The append-only `coordinator.fence` record fold that makes a second live holder impossible. |
| Durable stop | The identity-scoped `loop.stop` record that prevents any later start from running until an explicit `reset`. |
| Drain stop | The default stop mode: the loop finishes the session it holds and then ends; no session is signalled. |
| Immediate stop | The opt-in stop mode: the held session is terminated within one collection interval plus the declared kill grace, and a session whose process identity cannot be verified is reported instead of signalled. |
| Sourced progress | A positive `token-delta` reading from the recorded session's delivered totals reader; absent is `unknown`, never zero. |
| Delivery corroborator | The read-only fact "a healthy delivery is in progress", decided by the F-5 evidence-class and fold tables from the newest `dispatch.lane` (`active` with a **present, alive** owner `processId`) or `daemon.lane` (`delivering` with a present, alive `processId`): no owner start-time comparison, no age bound, `unknown` for any unreadable input or absent pid, and `none` only when the store is readable and every candidate is terminal or provably dead. |
| Two-signal stuck verdict | A verdict requiring no sourced progress for the window **and** no healthy delivery in progress, both readable; an unreadable input yields `unevaluable`, never a kill. |
| Status-key source table | The normative table in API-7 that gives each status key its one declared source; `loop_id` is the constant `loop-main` and is never empty, and `ceo_pid`/`ceo_session` are live-only. |
| Unevaluable | The declared verdict for a missing input; it records and continues, and never kills. |
| Restart ordinal | One consumed unit of the per-epoch restart budget, recorded once per stuck restart. |
| Backoff schedule | The declared delay before a restart's session effect: `min(2 s × 2^(n−1), 300 s)` for ordinal `n`. |
| Loop session record | The loop's durable session identity, process identity, acquisition time, and state. |
| Status block | The deterministic `key=value` projection of `status`: the six shell keys, then `stop_mode` and the remaining additive keys, in a fixed order, each sourced as the API-7 table declares, with `loop_id=loop-main` and `restarts=<n>/<bound>` always present and every other absent value rendered as the empty string after `=` with no placeholder token. |
| Operational log | The loop's bounded, identifier-only, ANSI-free event log, retained at 1 MiB active plus one generation. |
| Proof boundary | The declared list of surfaces a battery proves and surfaces it does not, machine-checked from a permanent constant. |

## 25. APPENDICES

### 25.1 Appendix A — Phase-7 documentation impacts

| Document | Required reconciliation |
|----------|-------------------------|
| `doc/spec/features/feature-loop-supervision.md` (new) | The new current-truth page for the family: the five-verb grammar and flags, the exit vocabulary and the shell mapping, the six shell status keys plus the additive keys and the per-key source table, the engine-reuse boundary (what is shared and what is not), the two-signal verdict rule and the corroborator evidence-class and fold tables (including the pid-only owner-liveness rule and its residual risk), **the restart-reason compromise — the durable reason is the delivered closed token `stuck-artifact-evidence`, the two-signal facts ride the bounded evidence corpus, and an operator must read that corpus (or the loop's `event=restart` log line) to distinguish a loop restart from a coordinator restart** — the terminate reuse, the backoff schedule and the at-bound history reference, the durable stop and `reset`, the log retention bounds, the single-instance rule and session re-find, the configuration mapping from the shell's env knobs, and the published proof boundary with the not-proven list. |
| `doc/spec/features/feature-coordinator-supervision.md` | Re-read the page against the delivered facts this change alters. Reconcile §1's "the coordinator family is its typed replacement" with the delivered family split (the loop is the Mode A operator surface; the coordinator keeps its own target and behaviour), state that the record kinds are shared per supervisor identity with a key-level scoping guarantee, and keep §10's "`ceo-loop.sh` stays byte-unchanged" true and explicit. **Reconcile §3's "No pid on a spawned handle" limitation, which DM-3 falsifies:** the harness session handle can now carry an optional process id, supplied by the adapters that can report it and absent (never fabricated) where they cannot; the coordinator's own composition still supplies none, so the coordinator's kill-with-grace behaviour, its declared limitations, and its observation payload are otherwise unchanged. **Re-read every other declared limitation on that page against the new fact** — §3's no-durable-session-identity, no-total-context-source and no-sourced-progress entries — and either confirm each still holds or state precisely why not; the page must not carry a limitation the delivered handle now contradicts. |
| `doc/spec/features/feature-autonomous-delivery.md` | Update Mode A: the outer loop's target is `jaiship loop`; restate INV-DM-3's corroborator as having a typed source (the delivered lane records) alongside the shell probe; restate NFR-5's durable stop as a ledger record; keep the script inventory and the shell fallback statements, and note that the shell's env knobs map onto the coordinator keys. |
| `doc/spec/features/feature-resident-daemon.md` | State that the loop reads `daemon.lane` read-only as a corroborator and never writes it, and that the daemon family neither reads nor reconciles the loop's records. |
| `doc/spec/features/feature-watchdog-lane-contracts.md` | State that `watchdog` remains a check-only surface and is not the loop's liveness source; the loop's verdict consumes harness progress and lane facts instead. |
| `doc/spec/features/feature-harness-adapters.md` | Record the additive optional session process id on the handle and the streaming spawn seam, the CEO spawn identity (`--agent ceo` plus the seat model), the `ceo-loop-<stamp>` title as a reap identity, and the terminate reuse. |
| `doc/spec/features/feature-config-layer.md` (or the configuration reference) | Record that zero keys are added and that the six `coordinator.*` keys are consumed by the loop profile with their unchanged defaults. |
| `doc/spec/features/feature-result-contract.md` | Confirm zero new identities and zero new domain kinds; record that the two new record kinds are not error identities and that the reused exhaustion identity's remediation is carried by the loop's own summary. |
| `doc/spec/features/feature-state-layer.md` | The page that enumerates every record kind must gain the two new kinds: `loop.session` (`delivery.loop.session.v1`, key `loop.sessions:<loopId>`, latest-wins) and `loop.stop` (`delivery.loop.stop.v1`, key `loop.stops:<loopId>`, latest-wins), naming the loop supervisor (`loop-main`) as their only writer and reader, keeping the coordinator and daemon families as non-readers and non-writers, and stating that the ledger schema version (`delivery.state.v1`) is unchanged with no migration. |
| `doc/overview/glossary.md` | Add supervisor profile, supervisor identity, loop family, durable stop, drain/immediate stop, sourced progress, delivery corroborator, two-signal verdict, unevaluable, backoff schedule, loop session record, proof boundary. |
| `doc/00-index.md` | Index the new current-truth page and the new M4 reference page. |
| `doc/planning/oss-tooling/milestones/m4/commands/loop.md` (new) | The reference page the help entry points at: `--help`/`--version`, the five verbs, the flags, the exits, the status keys, the log bounds, the durable-stop workflow, the divergences, and the distribution marker. |
| `doc/planning/oss-tooling/milestones/m4/README.md`, `flip-plan.md`, `backlog.md` | Mark M4-S10 / F3 as delivered by this change and keep the F5/F6 ownership statements. |
| `doc/quality/test-specs/test-spec-loop-supervision.md` (new) | The new enduring quality page, the loop counterpart of `test-spec-coordinator-supervision.md`: the case families and their owning suites, the nine proven and six not-proven surfaces with the boundary constant they mirror, the battery fixtures and the seam each one doubles, the mutation controls, and the traceability from each AC group to its suite. |
| `doc/guides/delivery-modes.md` (review) | Reconcile any statement that the Mode A loop is only `scripts/ceo-loop.sh`, and keep its troubleshooting guidance valid for both paths. |

The reconciled pages must cite TDR-0055 (the profile boundary) and TDR-0056 (the durable-stop home). Each new or changed distributable page declares its `ados_distribution` class, and the doc-distribution guard must stay green.

### 25.2 Appendix B — Ticket-to-spec traceability

| Ticket element | Where satisfied |
|---|---|
| Task — complete the loop surface (`start`, `stop`, `status`, `log`, `reset`) over `coordinator-loop`, `daemon`, `watchdog` | F-1; AC-F1-1…AC-F1-5; DEC-1; API-1…API-5. Engine reuse: the delivered lease, budget, stuck records, and kill primitives. `daemon` is consumed through its delivered `daemon.lane` record (F-5); `watchdog` is deliberately not duplicated (DEC-5, `feature-watchdog-lane-contracts.md`). |
| Task — spawn the CEO agent through the harness port with policy-resolved provider | F-2; AC-F2-1…AC-F2-4; DEC-1, DEC-5; the delivered per-spawn resolution is the only policy-resolved path (NG-5). |
| Task — restart policy with backoff and a readable reason | F-3; AC-F3-1…AC-F3-6; DEC-4, DEC-6; DM-5. |
| Task — durable stop marker honored across restarts | F-4; AC-F4-1…AC-F4-5; DEC-2; DM-2; TDR-0056. |
| Task — liveness watchdog for a stuck session | F-5; AC-F5-1…AC-F5-7; DEC-3, DEC-5; DM-6. |
| Task — bounded log retention | F-7; AC-F7-1…AC-F7-4; DM-7. |
| Task — single-instance lock so two loops cannot run | F-6; AC-F6-1…AC-F6-5; the delivered lease (DEC-1); DM-1 for the session re-find. |
| AC — start/stop/status/log/reset behave equivalently to `ceo-loop.sh` (`--stop` durable across restarts) | AC-F1-1…AC-F1-5 (verbs, keys, log, stop/reset), AC-F4-2 (durable across a restart), AC-F4-4 (`drain` is the parity mode); the divergences are enumerated in §8.5 and decided in DEC-6. |
| AC — a stuck CEO session is detected and restarted within the declared bound | AC-F5-1, AC-F5-5 (the bound **formula**, 652 000 ms at the shipped defaults), AC-F3-1, AC-F3-2 (backoff), AC-F5-6 (termination). |
| AC — two starts cannot both run | AC-F6-1, AC-F6-2, AC-F6-4; the second start's exit and identity are fixed by DEC-6. |
| AC — the loop drives a full pick-deliver-merge cycle using only jaiship primitives and no shell entry point | AC-F8-4 (the deterministic pick-deliver-merge scenario over the real composition), AC-F8-3 (three no-shell observations), AC-F8-1/AC-F8-5 (the battery and its machine-checked boundary); the live facts it does not prove are Appendix C. `merge` and `closeout` are consumed as delivered (NG-7). |
| Flip priority F3 — "loop start/stop/status/log/reset parity; durable stop across restarts; single instance; stuck session restarted" | The four clauses map to F-1 (parity), F-4 (durable stop), F-6 (single instance), and F-5+F-3 (stuck detection and restart). |
| Scope boundary — no shell deletion, no prompt re-pointing | NG-1, NG-2, NG-11; §8.5; DOD-7. |
| Scope boundary — "policy-resolved provider" is the delivered per-spawn path | NG-5; F-2; AC-F2-4. |
| Scope boundary — the corroborator must be a delivered jaiship source | F-5; AC-F5-3, AC-F5-7; DEC-3. |
| Scope boundary — a declared proof boundary for the final AC | F-8; AC-F8-5; Appendix C; DEC-7. |

### 25.3 Appendix C — What the conformance battery proves and does not prove

**It proves (nine surfaces).** (1) *Verbs*: all five verbs, their grammar, their refusals, their exits, their payloads, and their parity status keys. (2) *Log*: the line contract, the rotation and retention bounds, and the bounded read. (3) *Spawn*: the CEO agent identity, the resolved seat model, the deterministic title, the fixed argv with no shell, and the pre-session refusals. (4) *Stuck*: the two-signal verdict, the delivery-corroborator veto under its published evidence-class and fold tables (including the pid-only owner-liveness rule and the `unknown`/`none` cells), the unevaluable paths, and the window-to-restart bound formula at two interval settings. (5) *Kill*: TERM-before-KILL within the declared grace, the exact target set, the identity-mismatch path, the terminal no-restart consequence of an unconfirmed termination, and idempotence. (6) *Backoff–budget*: the exact delay schedule, one ordinal per stuck restart, zero ordinals for a clean end, and the at-bound refusal with its exit. (7) *Stop*: the durable request surviving a simulated process restart and a simulated crash, the clearance, the idempotence, and both stop modes' latency bounds. (8) *Single instance*: the two-start interleaving, the liveness-first takeover, the session re-find without a second spawn, the distinct coordinator identity, and the session-uniqueness invariant. (9) *No shell*: the injected runner recording zero, the static invariant over the declared surface with its mutation control, and the prompt scan.

**It does not prove.** (1) Live opencode behaviour: a real session's real message traffic, real resume after a real process exit, real stdout framing. (2) Live provider behaviour: a real profile selection against live quota, balance, or availability. (3) OS-level termination of a real child and a real escaped runtime; the battery proves the contract, the ordering, the grace, and the exact-identity target selection, not the kernel's signal delivery. (4) A real pick-deliver-merge outcome: the tracker, pull-request, CI, and merge effects are fixtures, and the CEO agent's *definition* still names the shell entry points until F5 (GH-351), so a live run's behaviour is not claimed here. (5) Long-run loop behaviour under a real clock and real multi-minute delays; the battery injects time. (6) Cross-process race freedom beyond the state store's fence guarantee; the two-start interleaving is deterministic, not an arbitrary OS schedule.

**How the final acceptance clause ("a full pick-deliver-merge cycle using only jaiship primitives and no shell entry point") is proven.** By four complementary observations: (a) the loop spawns the CEO session with a declared prompt that contains zero script-path literals and names the primitives; (b) the doubled session issues the pick, deliver, and merge primitives through the real command runtime over fixtures, and the loop observes the resulting artifact progress and stays healthy; (c) the injected process runner records zero shell invocations across the whole battery and the loop flow; (d) the static no-shell invariant reports zero violations over the declared loop surface, with a planted reference failing by name. The shell entry points remain on disk as the documented fallback; the proof is that the typed flow never invokes them, and Appendix C names exactly what a live run would still have to demonstrate.

### 25.4 Appendix D — Implementation-decided and fixture-decided details

None of the following reopens a decision: the exact internal shape of the supervision cycle's step order; the exact wording of the spawn prompt beyond its required content (the primitives it names, the stop instruction, and the absence of any script path); the exact log message text after `event=<name>`; the exact identifier spelling of session, verdict, and stop records beyond the declared fields; the rotation implementation (rename vs copy) as long as the retention bounds and the newest-data rule hold; the exact placement of the pid fact inside the handle construction; the exact mock choreography of the scripted session and the doubled primitives; the exact fixture values for lane owners, tracker state, and merge outcomes; and the poll cadence inside a cycle as long as the declared bound holds.

Not implementation-decided: whether the loop is a profile of the engine (TDR-0055), whether the durable stop is a ledger record (TDR-0056), whether a stuck verdict requires the corroborator (F-5), whether the delay schedule is declared and bounded (F-3), whether a second start is refused (F-6), and whether any configuration key, error identity, or domain kind is added (none).

### 25.5 Appendix E — Verified baseline

Every seam named in §2.1 was read on this branch at `feat/GH-348/loop-supervision`, level with `origin/main-tools` at `f802f71a`, with a clean tree. The coordinator family, its cycle, its lease/budget/stuck folds, the kill-with-grace path, the harness port and both adapters, the per-spawn profile resolution, the dispatch and daemon lane records, the six configuration defaults, the error table, the help inventory and its pinned suites, and the static no-shell invariant were read directly rather than assumed. The parity reference was read from `scripts/ceo-loop.sh` (2.1.0) in the same checkout. Values quoted in this spec (windows, graces, bounds, defaults, exit projections, retention limits) are the read values, not approximations.

### 25.6 Appendix F — Parity mapping (normative)

**Verbs.**

| Shell | Typed | Notes |
|---|---|---|
| `run` (default, foreground) | `loop start --foreground` | `--foreground` is required in v1 (the coordinator precedent); detached hosting does not exist. |
| `--stop` | `loop stop [--mode drain\|immediate]` | `drain` reproduces the shell's "honour when the session ends"; `immediate` is additive. |
| `--reset` | `loop reset` | Appends a clearance instead of deleting a file. |
| `--status` | `loop status` | The six shell keys, in the shell's order, then additive keys. |
| `--log [N]` | `loop log [--lines N]` | Default 50 in both; typed maximum 100 and line bound 512 bytes. |

**Exit vocabulary.**

| Shell outcome | Shell exit | Typed outcome | Typed exit |
|---|---|---|---|
| Clean stop (stop signal or graceful end) | 0 | `state=stopped` | 0 |
| Max restarts exceeded | 1 | `coordinator.restart-budget-exhausted` | 1 |
| Usage error | 2 | `fallback.invocation` (grammar) | **1** (§8.5 row 2) |
| — (no shell equivalent) | — | `coordinator.already-running`, `state.*`, kill/capability failures | 2 |

**Status keys.** `loop_running`, `loop_pid`, `ceo_alive`, `ceo_pid`, `ceo_session`, `stop_signal` (shell names and order preserved), then `stop_mode`, `loop_id`, `ceo_title`, `restarts`, `budget_epoch`, `last_restart_reason`, `last_verdict`, `degraded`, each sourced exactly as the API-7 status-key table declares. Exactly three keys are boolean — `loop_running`, `ceo_alive`, `stop_signal` (`yes` when a stop is folded, `no` otherwise) — and `stop_mode` is `drain` or `immediate`, empty when no stop is folded. `loop_id` is the constant `loop-main` and `restarts` is `<n>/<bound>`, so neither is ever empty; `ceo_pid` and `ceo_session` are live-only (empty for an ended session, exactly as the shell's `--status` prints them); every other absent value renders as the empty string after `=`, and no `none` token is emitted.

**Configuration.**

| Shell env knob | Typed key | Value |
|---|---|---|
| `CEO_LOOP_STUCK_MINUTES=10` | `coordinator.stuck-window` | 600 000 ms |
| `CEO_LOOP_POLL_SECONDS=30` | `coordinator.collection-interval` | 30 000 ms |
| `CEO_LOOP_KILL_GRACE_SECONDS=20` | `coordinator.kill-grace` | 20 000 ms |
| `CEO_LOOP_MAX_RESTARTS=10` | `coordinator.restart-budget` | 10 |
| `CEO_RESUME_TOKEN_LIMIT=100000` | `coordinator.resume-context-limit` | 100 000 (read only if a context source exists; unreachable today) |
| `CEO_LOOP_SLEEP_SECONDS=2` | — (replaced) | the backoff schedule plus the collection interval |
| `CEO_LOOP_MAX_ITERATIONS=0` | — (not mapped) | the loop is unbounded, as `0` meant |
| — (no shell counterpart) | `coordinator.progress-bound` | 300 000 ms |

**Stuck rule.**

| Shell condition | Typed condition |
|---|---|
| `pm-liveness` says stalled (no session traffic) | sourced `token-delta` reading is `zero` for `stuck-window` |
| no artifact advance since the last progress point | no `merge.transaction` or blocker answer since the last progress observation |
| no delivery in progress (`--is-delivering` probe or the delivery marker) | the delivered lane corroborator is readable and reports none |
| a degraded probe with a known session id → do not kill | an unreadable progress reading or an unreadable corroborator → `unevaluable`, no kill |

### 25.7 Appendix G — Proof-boundary constant (normative shape)

The permanent fixture constant is `LOOP_PARITY_PROOF_BOUNDARY` with exactly these ids, in this order:

- **Proven (9):** `verbs`, `log`, `spawn`, `stuck`, `kill`, `backoff-budget`, `stop`, `single-instance`, `no-shell`.
- **Not proven (6):** `live-opencode`, `live-provider`, `os-termination`, `real-pick-deliver-merge`, `long-run-loop`, `cross-process-race`.

Every battery row declares one proven seam, and the boundary case asserts the counts, the order, and that no row names a not-proven surface.

## 26. DOCUMENT HISTORY

| Version | Date | Author | Changes |
|---------|------|--------|---------|
| 1.0 | 2026-11-19 | @spec-writer | Initial specification for GH-348, grounded in the ticket body, the M4 blueprint (flip-plan F3 row and verification bar, backlog M4-S10, ranking row 4), the GH-348 planning notes and their PM scope decisions, the current-truth supervision, autonomy, harness, provider, daemon, watchdog, result-contract, and configuration pages, the delivered engine/adapters/composition/help/inventory/invariant code re-read on `f802f71a`, and the parity source `scripts/ceo-loop.sh`. Decisions DEC-1…DEC-7; TDR-0055 and TDR-0056 delegated and cited as Proposed. |
| 1.1 | 2026-11-19 | @spec-writer | PM rulings on the four questions the test plan raised against v1.0, plus two cross-file pins. **R1**: the status block renders an absent value as the empty string after `=` and the `none` token is removed from API-7, with the rule stated once and its reason (shell parity of the six keys; fixed order plus an empty value is unambiguous) — applied to AC-F1-2, API-4, API-7, Appendix F, the §4.1 parity metric, and the glossary. **R2**: the three boolean keys are enumerated (`loop_running`, `ceo_alive`, `stop_signal`), and the stop mode becomes the separate additive key `stop_mode` placed immediately after `stop_signal` — applied to AC-F1-2, API-4, API-7 and Appendix F. **R3**: an unconfirmed termination is terminal (one outcome record, lease released, exit 2, no restart, no second session) and the restart path applies only after a confirmed termination — applied to F-5, AC-F5-1, AC-F5-6, AC-F3-1, API-1, Appendix C item 5, RSK-4 and RSK-5. **R4**: AC-F1-5's no-configuration clause is scoped to the command handler (the composition supplies the resolved settings, including the `restarts` bound, and an acquisition failure falls back to the shipped defaults) — applied to AC-F1-5 and API-4. **Pins**: `tests/checks/reference-page-parity.test.ts` (its duplicated page mapping must learn the M4 root) and `tests/structure/metrics-mounting.test.ts` (its stale-pin scan set must gain 26) join §2.1, §8.5, the §16 affected-components table, DOD-8, RSK-8 and DEC-7's pin enumeration, and §7.1/§13 move from two pinned updates to three. No acceptance criterion, identifier, requirement, or decision outcome was added, removed, or reopened; the AC count stays 41. |
| 1.2 | 2026-11-19 | @spec-writer | DoR-iteration-1 remediation (findings R-01, R-02, R-04, R-05, R-06, R-09, R-14, R-15, R-17, R-18, R-19, R-20, R-21, N-01), applying the PM's two bindings clusters. **Corroborator (R-01, R-02):** the owner-liveness rule is the recorded `processId` alone — no start-time comparison and no age bound, because `DispatchLaneOwner.startedAt` is the composition start instant — and F-5 now publishes the complete evidence-class table (D1–D6, M1–M6) and the ordered fold (F0–F3) over store readability, lane states, pid presence and liveness, with the deliberate asymmetry and the pid-reuse residual risk stated; DM-6, RSK-2, AC-F5-3, AC-F5-7, Appendix C, the §2.1 source fact, the §12 assumption and the glossary row are aligned. **Status keys (R-06):** one normative source table in API-7 fixes each key's source (`loop_id` = the constant `loop-main` and never empty; `ceo_pid`/`ceo_session` live-only; `budget_epoch` persisted), with the absent-identifier consequence, aligned in API-4, AC-F1-2, Appendix F and the glossary. **Other findings:** R-04 (DOD-7 names the `provider-surface.test.ts` sha256 pin and the PR-time review artifact instead of a non-existent case), R-05 and R-14 (`feature-state-layer.md` and the new `test-spec-loop-supervision.md` join Appendix A and DOD-9), R-09 (the bound is the formula, 652 000 ms named as the shipped-default value, in F-5, NFR-5, AC-F5-5 and the KPI), R-15 (the `stuck-artifact-evidence` reuse is stated as a declared operator-facing compromise in F-3 and DM-5), R-17 (INV-DM-3/5 with the line spans), R-18 (the cycle driver's declared end is a declared clean-end cause in F-1 and API-1), R-19 (the loop-scoped `<loopId>:<cycle ordinal>` `iterationId` and the conditional `killFailureReason`, with no third record kind), R-20 (the derivable `epoch-<n>;restarts=<count>;seq=<sequence>` history reference), R-21 (the delivered globals are accepted on every verb and are never refusals), N-01 (five `CEO_LOOP_*` knobs plus `CEO_RESUME_TOKEN_LIMIT`). No AC, identifier, requirement or decision outcome was added, removed or reopened; the AC count stays 41 and no new record kind, error identity, configuration key or domain kind is introduced. |
| 1.3 | 2026-11-19 | @spec-writer | DoR-iteration-2 remediation (findings R-28, R-15 page half, N-04), applying the PM's iteration-2 rulings. **R-28:** `doc/spec/features/feature-coordinator-supervision.md` joins DOD-9's named pages and its Appendix A row now requires reconciling §3's "No pid on a spawned handle" limitation — which DM-3 falsifies, since the handle can now carry an optional adapter-supplied process id while the coordinator's own composition still supplies none and its behaviour is otherwise unchanged — and requires re-reading the page's other declared limitations against the new fact. **R-15 (page half):** the new loop page's required content now names the restart-reason compromise (delivered closed token `stuck-artifact-evidence`, two-signal facts in the bounded evidence corpus, the corpus as the only way an operator distinguishes a loop restart from a coordinator restart). **N-04:** DOD-9's stale-statement check is named as the phase-7 documentation-phase grep over the reconciled page set, and AC-F8-5's page/constant agreement is named as the phase-7 guard comparison that fails the documentation phase, not a delivery case. §2.1's handle-pid snapshot is marked as the pre-change baseline and the KPI documentation target gains the coordinator-page reconciliation. No AC, identifier, requirement or decision was added, removed or renumbered; the AC count stays 41. |

---

## AUTHORING GUIDELINES

- **Sources.** The ticket body and its four acceptance criteria; the M4 blueprint's current-gap row ("Outer loop and liveness | `ceo-loop.sh` | `jaiship loop`"), stage F3, and the F3 verification bar; backlog M4-S10 and ranking row 4; the GH-348 planning notes (PM scope decisions, the verified seam inventory, the doc-impact risks, the parity contract); the current-truth supervision, autonomous-delivery, harness-adapter, provider-engine/profile, resident-daemon, watchdog, result-contract, and configuration pages; `scripts/ceo-loop.sh` 2.1.0 as the parity source; and the delivered coordinator cycle, folds, adapters, composition, help inventory, pinned suites, and no-shell invariant, re-read on this branch. No behaviour is invented; implementation-decided details are listed in Appendix D.
- **Approach.** The spec is organised around the ticket's seven tasks and four acceptance criteria, then around outcomes: capabilities state behaviour and rationale, interfaces state contracts with identities and bounds, and each acceptance criterion names the case that closes it. The engine-reuse boundary is stated once (F-1, DEC-1, TDR-0055) and used consistently; the parity contract is stated once (Appendix F) and every divergence from it is enumerated in §8.5.
- **Constraints applied.** Reuse over reinvention (no second lease, kill, budget, or predicate for a delivery expectation); the closed result contract (zero new identities and kinds, one exit mapping declared rather than forced); no configuration key added which the delivered branch already provides; no shell dependency; no prompt or script edit; no live-provider claim beyond the declared boundary; additive contract evolution only.
- **Deliberate omissions.** No step-by-step implementation tasks, no commit or merge instructions, and no technology tuning beyond what the outcomes require. Module paths appear only in the composition map, at the granularity the planning input requested.

## VALIDATION CHECKLIST

- [x] `change.ref` matches the provided `workItemRef` (`GH-348`)
- [x] `owners` has at least one entry (`engineering`)
- [x] `status` is `Proposed`
- [x] `change.milestone` is the tracker milestone title verbatim and equals the planning-notes milestone (`M4: Jaiship-native delivery`)
- [x] All sections present in order (1–26 + authoring guidelines + checklist), with the Definition of Done after the acceptance criteria
- [x] A Definition of Done is present, each item names its observation, and the AC count reference matches the 41 declared criteria
- [x] ID prefixes are consistent and unique (`F-`, `API-`, `DM-`, `NFR-`, `AC-`, `RSK-`, `DEC-`, `PG-`, `DOD-`, `G-`, `NG-`)
- [x] Acceptance criteria reference at least one `F-`/`API-`/`DM-`/`NFR-` ID, use Given/When/Then, and each names its case-level proof
- [x] NFRs include measurable values
- [x] Risks include Impact and Probability with mitigation and residual risk
- [x] No implementation step lists; module names appear only in the composition map
- [x] Out-of-scope items are prefixed `[OUT]`
- [x] Open questions are empty; each routed fork is settled by a cited decision
- [x] The engine-reuse boundary is stated once and used consistently
- [x] The delivery corroborator publishes a total evidence-class and fold table over the delivered lane facts, with the pid-only owner-liveness rule and its deliberate asymmetry and residual risk stated
- [x] The status block has one normative per-key source table, and every place that repeats the absent-value rule agrees with it
- [x] The detection-to-next-session bound is stated as a formula, with the shipped-default value named and no hardcoded literal
- [x] Every deliberate divergence from `scripts/ceo-loop.sh` is listed in §8.5 and mapped in Appendix F
- [x] The proof boundary is machine-checkable (Appendix G) and its not-proven list is explicit (Appendix C)
- [x] Zero new error identities, domain kinds, and configuration keys is claimed and tied to acceptance criteria
- [x] The shell script and agent prompts are explicitly untouched, and no criterion requires editing them
