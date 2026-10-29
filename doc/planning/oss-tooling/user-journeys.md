---
# Copyright (c) 2025-2026 Juliusz Ćwiąkalski (https://www.cwiakalski.com | https://www.linkedin.com/in/juliusz-cwiakalski/ | https://x.com/cwiakalski)
# Apache-2.0 License - see LICENSE file for full terms
source: https://github.com/juliusz-cwiakalski/agentic-delivery-os/blob/main-tools/doc/planning/oss-tooling/user-journeys.md
---
# User journeys: the coordinating agent and other agents

How the tooling is used. The primary user is the CEO-style coordinating
agent (one per deployment) that picks, dispatches, verifies, merges, and
closes out changes, supported by the lifecycle agents inside each delivery
and the owner who decides. Story references point into
[backlog.md](backlog.md); the command surface lives in
[cli-command-registry.md](cli-command-registry.md).

Journeys 1 and 2 are the first iterations; journeys 3 through 5 are
summarized. Each journey marks when a step becomes possible with tooling
(milestone and story) and what the interim path is while the bash stack is
still authoritative (strangler).

---

## 0. Personas

- Coordinating agent (CEO-style): picks the next change, dispatches
  delivery, verifies artifacts, runs the merge gates, merges, and closes
  out. Never implements code.
- Lifecycle agent (PM-style): runs the 11-phase lifecycle inside one
  dispatched change.
- Lane agents: spec writer, test-plan writer, plan writer, readiness
  reviewer, coder, doc syncer, reviewer, runner, fixer, committer, PR
  manager. Each works inside the lifecycle session.
- Harnesses: the agent runtimes executing lifecycle sessions (opencode by
  default, Claude Code supported, pi.dev a candidate); dispatch spawns
  through harness adapters and the tooling ships as a generated plugin per
  harness (concepts/harness-adapters.md).
- Owner: reviews briefs, answers gates, approves the backlog and decisions.
  Does not touch the delivery loop directly.

---

## 1. Journey 1: single change lifecycle (the core loop)

The 11 phases stay owned by the lifecycle agent. The coordinating agent owns
the loop around them: pick, dispatch, verify, gate, merge, close out.
Success is artifacts, never exit codes.

### 1.1 The loop, step by step

| Step | Actor | Command (target) | Milestone | Interim path (bash stack) | Pain addressed |
|---|---|---|---|---|---|
| 1. Session bootstrap | Coordinator | `ados status` (six collectors: tracker, changes and PRs, CI, lanes or queue, providers, parked work) | M0-S6 | Scripted probing, raw tracker and PR reads | Largest measured token lever; the first call of every session |
| 2. Pick the next change | Coordinator | `ados queue ready` (read-only ready-set per ticket; close items rank above new starts) | M0-S7 | Manual dependency and repo-free checks | Idle lanes beside a full queue; closing beats opening |
| 3. Understand the ticket | Lifecycle agent | Tracker read through the adapter | M0 (lifecycle session exists today) | unchanged | - |
| 4. Deliver the change | Lifecycle session | `ados dispatch` (one delivery per repo, single-flight, spawns and supervises the lifecycle session through the harness adapter) | M1-S9 pilot, M2-S1 full | deliver-ticket.sh | Exit-zero false success and lying liveness, the most-documented defect family |
| 5. Verify the delivery | Coordinator | `ados verify change` (verify the 11-phase ledger, classify the result tuple; malformed notes classified, never a crash) | M0-S8 | Manual notes and PR reading | The single most-repeated scriptable verification |
| 6. Run the merge gates | Coordinator | `ados verify gates` (lifecycle finalization, CI on the pushed commit, push parity, owner-gate scan, squash preflight, each gate cited) | M0-S9, M2-S7 extension | Manual merge checklist | Merge near-miss classes; roughly ten minutes per merge |
| 7. Merge | Coordinator | `ados merge` (verify gates fresh, squash, verify landed) | M1-S4 | Squash merge by hand | Merge as a transaction |
| 8. Verify deploy | Coordinator | `ados verify deploy` (job trace, never job status) | M1-S4 | Manual deploy checks | Vacuous-green deploy traps |
| 9. Close out | Coordinator | `ados closeout` (done flip, label sweep, unassign, owed-flip scan, branch cleanup) | M0-S14 | Manual ceremony per merge | LLM ceremony per merge with routine misses |
| 10. Learn and measure | Coordinator | `ados retro` + `ados metrics` | M1-S8, M2-S6 | Manual retro notes | Learning-loop crash classes, invisible drift |

### 1.2 The 11 phases, who runs them

Phases are marked complete or reopened only through `ados phase`
(M0-S10). Every lifecycle agent writes through the same single-writer path,
so the ledger is authoritative and a reopen always carries a reason.

| Phase | Agent | Command or surface that helps |
|---|---|---|
| 1. clarify_scope | Lifecycle agent | Tracker read through the adapter; `ados lint` keeps notes conformant (M0-S10, M1-S2) |
| 2. specification | Spec writer | inside dispatch |
| 3. test_planning | Test-plan writer | inside dispatch |
| 4. delivery_planning | Plan writer | inside dispatch |
| 5. dor_check | Readiness reviewer | inside dispatch |
| 6. delivery | Coder | inside dispatch; `ados provider` resolves the model spawn (M0-S13) |
| 7. system_spec_update | Doc syncer | inside dispatch |
| 8. review_fix | Reviewer | inside dispatch |
| 9. quality_gates | Runner | inside dispatch; `ados verify gates` mirrors it locally (M0-S9) |
| 10. dod_check | Lifecycle agent | `ados verify change` verifies the ledger (M0-S8) |
| 11. pr_creation | PR manager | inside dispatch |

### 1.3 Support steps inside the loop

| Step | Command | Milestone | Why |
|---|---|---|---|
| Configuration hygiene | `ados config` | M0-S4 | Per-key provenance, no silent precedence |
| Provider resolution for every spawn | `ados provider` | M0-S13 | Park defects cost hours each; subscription-first routing |
| State integrity | `ados state`, `ados lint` | M0-S10, M1-S2 | Malformed notes and torn registries are classified, never zeros |
| Session-database hygiene | `ados db` | M0-S11 | State bloat and reboot helpers, safe prune |
| Mid-flight steering | `ados steer` | M2-S5 | Owner notes that must land before the next phase boundary; interim: resume prompts |
| Cost visibility | `ados spend` | M2-S6 | Silent churn classes |
| Session telemetry capture | harness adapters, at closeout (`ados closeout`) | M1-S11 | Durable retro and spend data without re-querying pruned harness stores; cross-harness attribution |

### 1.4 What is possible when (iterative)

- From M0 (weeks 1-4): steps 1, 2, 5, 6, 9 plus provider, config, lint,
  phase, and db run beside the bash stack as second opinions. The bash
  stack stays authoritative for dispatch and merge. The biggest token waste
  goes first.
- From M1: merge and verify deploy become transactions; dispatch dual-runs
  on one pilot repository; watchdog catches stalled lanes.
- From M2: dispatch replaces the bash delivery path per repo after two
  clean weeks of verify-change evidence; steer and spend close the loop.
- From M3: the same loop runs through the opencode, Claude Code, and MCP surfaces.

---

## 2. Journey 2: multi-change coordination and planning across repositories

The fleet: several repositories, several lanes, one owner. Per-repo
single-flight; cross-repo dependencies; one board.

### 2.1 The daily fleet cycle

| Step | Actor | Command | Milestone | Interim path |
|---|---|---|---|---|
| 0. Inbox scan | Coordinator | Manual (deliberate; local agent inbox, session start and after each delivery) | stays manual | unchanged |
| 1. Fleet snapshot | Coordinator | `ados status` per repo; one board for all repos | M0-S6, M2-S4 | Manual per-repo checks |
| 2. Plan the day | Coordinator | `ados board` (lanes, gates, owner asks, parked work, one screen); decision-record mirror sync to affected repos before a new ticket dispatches there | M2-S4 (SLA mechanics M1-S5); mirror sync in M2-S3 | Tracker board by hand |
| 3. Build the ready-set | Coordinator | `ados queue ready` across candidates (deps, repo free, gates, provider, CI health) | M0-S7, M2-S1 | Manual |
| 4. Dispatch | Coordinator | `ados dispatch` (single-flight per remote, add-then-wait) | M1-S9, M2-S1 | deliver-ticket.sh per repo |
| 5. Supervise | Coordinator | `ados supervise` (tri-state, progress watchdogs, duplicate detection) | M2-S2 | Loop watch script |
| 6. Steer mid-flight | Coordinator/owner | `ados steer` (note at the next phase boundary) | M2-S5 | Resume prompts |
| 7. Close the day | Coordinator | `ados ceremony` (compact, resumable, catch-up) | M2-S3 | Manual ceremonies |

A peak-window pause is an expected daily state: provider reports it as
paused with a resume time, and status shows it as paused, never as a blocked
lane.

The inbox scan stays manual by design: agents read messages at explicit
read points (session start and own-discretion decision points), never as
interruptions. The typed message contract behind `ados steer` (M2-S5)
formalizes this without changing the journey; see
[../concepts/inter-agent-communication.md](../concepts/inter-agent-communication.md).

### 2.2 Cross-repository dependency planning

- Dependencies are refs: a consumer story depends on a producer story. The
  ready-set checks deps satisfied AND repo free AND gates AND provider AND
  CI health (`ados queue ready`, M0-S7; full graph in M2-S1).
- Producers before consumers: `ados merge` sequences squash merges
  producer-first; `ados verify deploy` verifies by job trace before the
  consumer starts (M1-S4).
- Per-remote single-flight: two lanes cannot deliver the same repo
  concurrently; preemption releases the repo into a named park state with
  cause and expiry (M2-S1).
- Build-weight classes: the lane plan models build weight per change; two
  heavy native builds are not scheduled onto one runner (M2-S1).
- Dispatcher is never a lane: dispatch adds then waits; machine-readable
  idle replaces polling loops (M2-S1).
- Cross-repo state stays local-first per repo with the shared-level
  abstraction planned for later (M0-S5). No cross-repo shared state blocks
  the first iterations.

### 2.3 What is possible when (iterative)

- From M0: status and queue ready give the per-repo snapshot and ready-set
  by hand; verify change and verify gates remove the cross-repo merge
  verification waste; closeout cleans every repo the same way.
- From M1: one pilot repository dual-runs dispatch beside the shell;
  watchdog and doctor catch stalled lanes and CI problems before dispatch
  burns quota.
- From M2: the programmatic queue, lanes, supervise, board, steer, and
  ceremony make the multi-repo cycle a single deterministic loop; the
  coordinating session stops being the dispatcher.
- From M4: fleet coordination stays local and open; optional remote
  services can consume the same contracts without gating local function.

---

## 3. Journey 3: owner attention loop (secondary, summarized)

Brief in the morning (`ados brief`, M1-S6, deterministic, no LLM in render),
aging gates with SLA (`ados board`, M1-S5), one batched decision window
(`ados steer`, M2-S5), metrics and spend as the evidence (`ados metrics`,
`ados spend`, M2-S6). From M4 the same contracts can feed an optional
remote service; the local brief remains complete without it.

## 4. Journey 4: cost and provider loop (secondary, summarized)

Every spawn resolves through `ados provider` (M0-S13); `ados spend` shows
daily burn by agent, model, and session root with burn-rate alarms (M2-S6).
Subscription quota before pay-per-token as policy data.

## 5. Journey 5: learning loop (secondary, summarized)

`ados retro` collects and hardens the evidence registry (M1-S8); `ados
metrics` measures ceremony share, cycle time, and false-signal count
(M2-S6); `ados policy` keeps fleet repository policy and written rules
machine-checked: drift is reported and fixed with rollback snapshots, and
a rule without a check behind it is flagged as advisory (M3-S5).

---

## Coverage matrix (commands vs journeys)

| Command | J1 core loop | J2 multi-repo | J3 owner | J4 cost | J5 learning |
|---|---|---|---|---|---|
| config | support | - | - | - | - |
| status | step 1 | step 1 | source | - | - |
| queue ready / queue / lanes | step 2 | steps 3-4 | - | - | - |
| dispatch | step 4 | step 4 | - | provider via spawn | - |
| verify change | step 5 | step 5 | - | - | - |
| verify gates | step 6 | step 6 | owner-gate scan | - | - |
| merge / verify deploy | steps 7-8 | producers first | - | - | - |
| closeout | step 9 | step 9 | - | - | - |
| provider | step support | step support | - | core | - |
| lint / state | support | support | - | - | - |
| phase | phase bookkeeping (1.2) | support | - | - | - |
| db | support | - | - | - | - |
| watchdog | support | step 5 | - | - | - |
| doctor | support | support | - | - | - |
| board | - | step 2 | SLA | - | - |
| brief | - | - | core | - | - |
| steer | support | step 6 | batched asks | - | - |
| supervise | - | step 5 | - | - | - |
| ceremony | - | step 7 | - | - | - |
| metrics / spend | step 10 | - | evidence | core | core |
| retro | step 10 | - | - | - | core |
| mcp / harness | surfaces for all of the above (M1-S7, M3-S1/M3-S2) | | | | |
| policy | - | - | - | - | enforcement |
| repos | support | support | - | - | - |
| update | distribution (M4-S2) | | | | |

Every command in the registry appears in at least one journey; there are no
orphan commands.

## Gap analysis (what the journeys surfaced)

| Gap | Verdict |
|---|---|
| Tracker evidence in the first-call digest | Closed: a tracker collector is part of status v1 (M0-S6) with the Jira read slice preceding it (M0-S19) |
| Self-hosted dogfooding of status and verify | Closed: a minimal GitHub read slice lands in M0-S19; the full GitHub adapter stays M3-S3 |
| Fleet-wide one-screen status before M2 | Board (M2-S4) is the fleet view; per-repo status covers M0-M1. Acceptable, matches the build order |
| Ticket creation and backlog refinement as a command | The lifecycle agent and tracker cover it today; revisit as an `ados ticket` candidate after M2 if refinement ceremony grows |
| Decision-record mirror sync to affected repos | Closed: folded into `ados ceremony` (M2-S3) and named in journey 2.1 step 2 |
| Testing-session assessment flow | Closed: enumerated as a ceremony type under `ados ceremony` (M2-S3) |
| Periodic memory audit | Closed: folded into `ados retro` (M1-S8), no new command |
| Phase transitions for lifecycle agents | Closed: `ados phase` (M0-S10) is the only write path for phase state; reopen requires a reason |
| Cross-repo shared state | Deliberately deferred (local-first). No journey blocks on it |
| Owner decision capture into decision records | `ados lint` (M3-S4) plus policy (M3-S5) enforce records. No new command needed |
| Deprecation of the bash stack | M3-S7 notices and M4-S5 retirement cover it; wrappers during the transition; the strangler table carries explicit stays-bash rows |
| Hosted-only surfaces | Proprietary, out of this repository; only neutral extension hooks (the opt-in telemetry sink, M4-S6) are open |
| Agent-to-agent messaging | Concept-parked (inter-agent-communication): steer (M2-S5) is the first message type on the shared contract; the wider inbox surface is built when a live need appears, not before |

## Iterative delivery order (pain first, then de-AI)

1. `ados status` (M0-S6): first call of every session, the largest measured
   context reduction. The tracker collector is part of this; without it this
   item does not earn its place.
2. `ados verify change` (M0-S8) + `ados verify gates` (M0-S9): the most
   repeated verification and the merge near-miss classes.
3. `ados closeout` (M0-S14): ceremony per merge removed.
4. `ados provider` (M0-S13): the park defect class and subscription-first
   cost.
5. `ados queue ready` (M0-S7): idle-lanes versus queued-tickets visibility.
6. `ados merge` + `ados verify deploy` (M1-S4): merge as a transaction.
7. `ados watchdog` + `ados doctor` (M1-S1, M1-S3): lying liveness.
8. `ados board` SLA + `ados brief` (M1-S5, M1-S6): owner attention.
9. `ados queue` + `ados lanes` + `ados dispatch` + `ados supervise`
   (M2-S1, M2-S2): de-AI the scheduling.
10. `ados ceremony` + `ados metrics` + `ados spend` (M2-S3, M2-S6): measure
    and compact.
