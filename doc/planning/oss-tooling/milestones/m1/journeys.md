# M1 outcome journeys: delivery engine and autonomous dispatch (planned)

The journeys delivered at M1 exit, each with its trigger, steps, the
no-token guarantee, and the story map. Planned state; the pack conventions
are in [../README.md](../README.md). Actors: owner (human), coordinator
(CEO-style agent), lifecycle agents (PM session and lane agents), operator
(production delivery operator running a private fleet, described by class).

## J1: the coordinator iteration (the core loop at M1 end)

Trigger: the coordinator starts an iteration (session start or previous
delivery closed).

1. `status` returns one bounded digest: attention-state coverage (lanes
   delivering vs idle-with-reason, ready-to-merge as an action list,
   parked items with conditions, owner-gate ages, spend summary, typed
   questions ranked).
2. If typed questions exist, the coordinator answers as data
   (`blockers answer`); the machinery applies answers and resumes lanes
   without re-entering delivery sessions.
3. For each ready-to-merge item, `merge` runs the transaction: gates
   verified fresh (config-declared set, tracker freshness bound, waivers
   recorded), squash, landing verified. A refusal names the gate with
   inline evidence.
4. `closeout` performs the mechanical sweep and emits judgment residue
   (unresolved human threads, ambiguous flip hits) only.
5. The next item is already scheduled; the coordinator picks it without
   discovering parallelism.

No-token guarantee: between iterations, zero coordinator tokens on
waiting, polling, scheduling, or re-verification of healthy paths.
Stories: M1-S10, M1-S16, M1-S4, M1-S12, M1-S17, M1-S18.

```
status -> blockers answer <id> --choice <n> -> merge <ref> -> closeout <ref> -> queue plan --next 1
```


## J2: planning a batch of changes (priorities, repos, dependencies)

Trigger: the owner or coordinator plans the next wave.

1. The coordinator expresses N changes as one artifact: priorities, target
   repos, explicit dependencies between changes.
2. Plan writers author machine-readable plans (per-phase file/package/
   folder scope, done-artifacts, repo leases, weight class, declared
   interactions, ceremony tier as data). Preparation phases are lease-free.
3. `plan validate` gates each change to ready-for-development;
   `plan overlap` answers pairwise sequence-vs-parallel mechanically with
   the overlapping paths named.
4. The queue computes the schedule: dependency-aware batching (producers
   before consumers), per-repo single-flight, weight classes,
   closing-beats-open ranking. Repo-disjoint lanes run in parallel with no
   coordinator iteration spent discovering it.

No-token guarantee: parallelism is computed, never discovered by reading
diffs. Stories: M1-S13, M1-S17.

```
plan validate <ref> -> plan overlap <refA> <refB> -> queue add <ref> --priority <n> [--dep <ref>] -> queue plan --next N
```


## J3: a lane under the daemon (spawn to handover)

Trigger: the queue starts a ready change.

1. The daemon dispatches through the harness adapter (opencode first,
   Claude Code next; harness choice is configuration) over an
   execution-environment descriptor.
2. Lifecycle agents mark phases through `phase`; `phase complete` performs
   record-plus-commit atomically (computed conventional message from tree
   plus change context, precise staging).
3. Progress-based liveness watches the lane (heartbeat, session traffic,
   token delta; a prefilling session never reads as stalled). A restart
   budget fails loudly with a classified reason; a resumed session does
   not re-pay its prefill or the restart is refused as uneconomical.
4. On blockers, the lane publishes typed questions (J5).
5. The delivery lands as a PR; verify-change evidence accumulates during
   dual-run; after two clean weeks per repo, that repo hands over (engine
   authoritative, bash fallback with deprecation pointers).

No-token guarantee: no session babysitting, no silent restart loops;
the resume-amplification metric reads approximately 1 and is visible in
spend. Stories: M1-S9, M1-S11, M1-S14, M1-S15, M1-S18.

```
(lane, driven by the daemon)
phase complete <ref> <phase>          # record + commit atomically
blockers publish <type> --lane <id> "<question>" [--options a,b]
(daemon) reconcile on start -> classify lanes -> resume from ledger
```


## J4: the owner day

Trigger: daily owner attention.

1. `brief` renders the deterministic one-screen brief from the same
   collector state as the digest: ready-to-merge as anchored actions,
   typed questions, owner-gate ages.
2. Owner gates age under the SLA: 24 h stale-review escalation, 72 h
   default-on-expiry with one pre-agreed default per gate; silence is
   impossible.
3. Overrides (never-merge, owner-review-first) are policy-as-data; every
   override is a recorded waiver, never a hidden tool decision.

No-token guarantee: the owner starts from facts, not chat; no LLM in the
render path. Stories: M1-S5, M1-S6, M1-S4.

```
brief -> board [--watch] -> blockers answer <gate-question-id> --choice <n>   # waivers recorded with author and scope
```


## J5: a blocker round-trip (hours to seconds)

Trigger: a lane hits a decision, ambiguity, missing credential, or
external wait.

1. The lane publishes a typed question: decision-needed (with options),
   spec-ambiguity, credential-missing (variable name only, never values),
   or external-wait.
2. The question ranks in the digest and brief within one collection
   cycle.
3. The coordinator or owner answers as data; the machinery applies the
   answer and resumes the lane without a full session re-entry.

Stories: M1-S16 (built on the M1-S5 mechanism, two audiences).

```
blockers list [--open] -> blockers answer <id> [--choice <n>]        # lane resumes, no session re-entry
```


## J6: degraded and fallback regimes

Trigger: daemon down, provider window, or constrained runner.

1. Daemon absent or failed: the CLI one-shot path runs the same loop
   manually (the queue computes the next action; one-shots execute it).
2. Provider peak window or quota: the lane parks with cause and expiry;
   the park re-checks its condition continuously and resumes exactly when
   it clears (a park outliving its condition is a classified bug).
3. Heavy builds: at most one heavy-class job per constrained runner;
   everything else stays freely parallel.
4. Bash fallback: retired entry points still run with deprecation
   pointers; per-repo handover is reversible.

Stories: M1-S17, M1-S18, M0-S13.

```
daemon status [--live] | status --watch          # degraded mode declared when the daemon is down
provider parks list -> queue plan --next N       # parks with conditions; weight caps visible, not lane caps
dispatch <ref>                                   # one-shot path while the daemon is down
```


## J7: learning and accounting at the change boundary

Trigger: a change merges and closes out.

1. Closeout completes the change capsule (append-only events, promotion
   decisions per candidate) and performs the mechanical sweep with
   judgment residue.
2. Harness telemetry captured at closeout lands in the event log;
   `spend` reports per-ticket and per-phase spend plus the
   resume-amplification metric.
3. The retro pipeline reads collector-truth evidence the delivery agents
   cannot alter.

Stories: M1-S8, M1-S11, M1-S12, M1-S19.

```
closeout <ref> [--apply] -> spend [--ref <ref>] [--amplification] -> retro report [--level <name>]
```


## What explicitly does NOT change at M1

- The 11-phase lifecycle stays owned by lifecycle agents; the engine
  changes who waits and verifies, not who does the work.
- Ceremonies (morning brief render, retro passes, sprint rollover) stay
  manual or bash-side; the ceremony runner is M2-S3.
- The board (one-screen fleet grid), steer notes, and metrics alarms are
  M2; M1 ships their inputs (collector state, SLA aging, spend data).
- Multi-host orchestration, dashboards, and new tracker integrations stay
  out of scope.
