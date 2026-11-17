---
# Copyright (c) 2025-2026 Juliusz Ćwiąkalski (https://www.cwiakalski.com | https://www.linkedin.com/in/juliusz-cwiakalski/ | https://x.com/cwiakalski)
# Apache-2.0 License - see LICENSE file for full terms
source: https://github.com/juliusz-cwiakalski/agentic-delivery-os/blob/main-tools/doc/planning/oss-tooling/backlog.md
---
# M1 — Delivery engine and autonomous dispatch backlog

Moved from `doc/planning/oss-tooling/backlog.md` (per-milestone split, 2026-11-17).

## Epic M1: Delivery engine and autonomous dispatch (months 2-3)

Goal: replace the bash delivery stack (`deliver-ticket.sh`,
`batch-deliver.sh`, `ceo-loop.sh`, `pm-liveness.sh`) with the typed delivery
engine: truthful signals, merge as a transaction, machine-readable delivery
plans, and scheduling plus waiting out of the coordinator's context. The
recorded operator input for this epic is
[operator-requirements-2026-11.md](operator-requirements-2026-11.md);
the re-planning decisions are recorded in roadmap.md (M0 exit amendment and
the M1 redefinition).

### M1-S1 Watchdog and lane contracts
- Ticket: GH-221 (milestone M1)
- Goal: Watchdog checks that refuse dirty or non-base checkouts and restore on every exit, so stranded and foreign commits become structurally impossible.
- Tasks: pre-flight refuses non-base or dirty checkout; teardown restores on
  every exit; memory-publish verification; progress-based liveness.
- AC: stranded commits and foreign commits are refused or restored with
  evidence.
- Depends on: M0-S5.

### M1-S2 State validation everywhere
- Ticket: GH-222 (milestone M1)
- Goal: Schema validation at every state boundary so torn or unknown registries are classified events, never silently read as empty.
- Tasks: schema checks at every state read/write boundary; classification of
  unknown, never silent zero. Coverage includes the delivery registry, the
  retro registry, and ceremony artifacts, not only pm-notes. Self-corruption
  salvage: a torn log tail is truncated to the last valid frame with a
  classified salvage record (data after the tear is quarantined, never
  silently read); indexes are rebuildable from the log alone; disk-full is
  a classified fail-closed event, never a partial write.
- AC: a torn registry read is classified, not treated as empty; retro and
  ceremony artifacts validate at their boundaries too; a torn tail
  salvages to the last valid frame with the salvage recorded; indexes
  rebuild from the log alone; disk-full fails classified with no partial
  write.
- Depends on: M0-S5.

### M1-S3 doctor v1
- Ticket: GH-224 (milestone M1)
- Goal: One command that diagnoses wiring problems with fix hints, so environment issues are found before they burn delivery quota.
- Tasks: doctor-style checks for repo, tracker, provider, state, CI wiring;
  stable exit codes.
- AC: doctor output names each failing check with a fix hint.
- Depends on: M0-S6, M0-S13.

### M1-S4 Merge and verify-deploy engine
- Ticket: GH-225 (milestone M1)
- Goal: Merge as a verified transaction (gates fresh, squash, landing verified) plus deploy verification by job trace, killing merge near-misses and vacuous-green deploys; every refusal names its gate with inline evidence.
- Tasks: merge transaction helper (verify gates fresh, squash, verify
  landed); deploy verification by job trace, not job status; the gate set
  is config-declared, versioned data, so repositories add gates (workspace
  test gates, deploy verification) without code; the gate freshness bound
  covers tracker state as well as CI (a ticket that moved to an
  owner-gated state after verification invalidates the verification);
  owner-gate classification (never-merge classes, owner-review-first) is
  policy-as-data the operator can inspect; waivers carry an authorizer
  principal, and the merge verifies the authorizer against the gate
  class's declared policy (owner-authored for never-merge classes) -
  presence of a waiver is never sufficient; the override path is a
  recorded waiver, never a hidden decision inside the tool; the refresh
  path: when the PR has fallen behind its base, the transaction attempts
  a rebase-refresh once, and a conflict is a classified refusal with the
  conflicting paths named (never a force path).
- AC: the merge helper refuses when gates were verified more than a bounded
  time ago; a refusal names the failed gate with inline evidence; deploy
  verified by trace; a repo-declared gate is enforced without code changes;
  a post-verification tracker transition to an owner-gated state is caught;
  an owner-gate classification is readable from declared policy; a waiver
  authored by a principal not authorized for the gate class is refused;
  a rebase conflict is a classified refusal naming the paths.
- Depends on: M0-S9, M0-S4.

### M1-S5 Owner-gate SLA
- Ticket: GH-229 (milestone M1)
- Goal: Owner gates age into escalation or a default decision, never silence, so the fleet never idles on an unanswered ask.
- Tasks: 24 h stale-review escalation; 72 h default-on-expiry; aging visible
  in brief and board; one pre-agreed default per gate. The escalation
  mechanism is designed for reuse by the typed blocker channel (M1-S16):
  one mechanism, two audiences (owner and coordinator).
- AC: an owner gate older than the SLA ages into escalation or a proceed
  decision, never silence.
- Depends on: M0-S6.

### M1-S6 Brief render-only v0
- Ticket: GH-228 (milestone M1)
- Goal: A deterministic, render-only owner brief so the owner daily attention starts from facts, not chat.
- Tasks: deterministic brief from the M0 collectors (tracker included) with
  explicit placeholders for unbuilt collectors; no LLM in the render path;
  one screen; decision-first layout. The brief renders from the same
  collector state as the status digest (one source of truth) and carries
  ready-to-merge, blocker questions, and owner-gate ages as anchored
  actions (blockers render as named placeholders until M1-S16 lands).
- AC: brief output matches collector state exactly; placeholders are named,
  not silent.
- Depends on: M0-S6.

### M1-S7 Minimal MCP
- Ticket: GH-231 (milestone M1)
- Goal: A minimal MCP surface over proven engines so agent sessions consume the same core results through their native tool interface.
- Tasks: thin MCP mirroring the CLI scope over proven engines: status,
  verify-artifact, gate report; no batch.
- AC: MCP tool calls return the same core results and stable error codes
  as the CLI; the MCP surface never propagates process exit codes
  (CommandResult envelope rendering stays in the CLI, per ADR-0003).
- Depends on: M0-S6, M0-S8, M0-S9.

### M1-S8 OSS retro pipeline
- Ticket: GH-232 (milestone M1)
- Goal: The retro evidence pipeline with an independent evidence sidecar, so retrospectives read collector-truth delivery agents cannot alter.
- Tasks: retro collection, registry hardening, shape-crash guards, export;
  home of the periodic memory audit; the independent evidence sidecar -
  a collector identity delivery agents cannot write, append-only
  storage, trace ids, pipeline-truth checks (concepts/retrospectives.md).
  Integrity wording is tamper-evidence, not prevention: on a single-user
  host nothing physically stops a lane process from touching the file,
  so the sidecar is hash-chained with a chaining key that never enters
  lane environments - a delivery agent cannot alter evidence
  undetectably, and the retro flags the tamper.
- AC: retro output survives a malformed entry without data loss; evidence
  alteration by a delivery agent is detectable (hash-chain break flagged,
  not silently trusted).
- Depends on: M0-S5, M1-S2.

### M1-S9 Dispatch engine: dual-run evidence and per-repo handover
- Ticket: GH-239 (milestone M1)
- Goal: The typed dispatch loop (spawn, watch, classify, summarize) runs beside the bash stack, accumulates verify-change evidence, and hands over per repository, so the new engine becomes authoritative with the bash stack demoted to fallback.
- Tasks: the per-ticket dispatch loop is this story's deliverable: spawn
  through the harness adapter, watch with progress-based liveness,
  classify into the TDR-0005 result enum, and emit the bash-continuity
  key=value summary contract. Two phases with different gates:
  (a) **evidence accrual** starts as soon as the scheduling engine ships
  its one-shot mode (M1-S17): dual-run on pilot tickets with the bash
  stack authoritative, verify-change evidence recorded per ticket,
  divergences reported; (b) **handover per repository** additionally
  requires the resident daemon live (M1-S18) and the evidence-based clean
  bar met. Clean is the conjunction of four conditions: (a) zero
  false-success incidents and zero unresolved divergences on the
  repository's pilot paths; (b) dispatch evidence exercising every
  TDR-0005 result class on real tickets; (c) an exposure floor of at
  least 20 dispatches or at least 7 consecutive days, whichever comes first,
  where that either/or binds only the floor and never substitutes
  for class coverage, incident truth, or corroboration; (d) corroboration,
  where an engine-claimed success is never sufficient and a dispatch
  counts clean only when artifact and tracker truth agree.

  The result-class condition is total over the vocabulary the classifier
  can emit, enumerated here for set comparison against the typed contract:
  `merged`, `blocked`, `pr-open`, `pr-open-unverified`, `failed`,
  `finished`, `max-restarts`, `state-unverified`, `partial`,
  `noop-lane-permission`, `noop-lane-nothing-to-do`.

  Corroboration is exactly three evidence sources: completed pm-notes
  phases, tracker state, and CI on the pushed head. A success claim such
  as merged needs the pushed head, CI on that head, the tracker state,
  and completed phases; a tracker-derived claim such as pr-open,
  blocked, or pr-open-unverified needs the tracker fact. A result
  token alone never counts. Handover flips the repository to the engine
  as authoritative (recorded, reversible), and the bash entry points
  print deprecation pointers and remain reachable as fallback. Covers
  the functions of `deliver-ticket.sh`, `batch-deliver.sh`,
  `pm-liveness.sh` (coordinator-session supervision has its own story,
  M1-S23) and, with M1-S17/M1-S18, `ceo-loop.sh`'s loop-driving
  function.
- AC: pilot tickets produce dual-run evidence with divergence reported;
  a dispatch is classified exit-0-with-no-artifact as failed (never
  success); the key=value summary contract matches the bash shape;
  handover is refused while the repository's clean window is unmet and
  offered when met (the evidence gate is an AC, not a task note); a
  handed-over repository dispatches through the new stack end to end;
  the bash entry points still run as fallback with deprecation notices;
  handover is per repository and reversible.
- Depends on: M0-S8, M1-S11, M1-S17, M1-S18.

### M1-S10 status collector expansion
- Ticket: GH-243 (milestone M1)
- Goal: Collector expansion to full attention-state coverage so status keeps replacing manual probing and one digest bootstraps every session.
- Tasks: expand beyond the six M0 collectors toward attention-state
  coverage: lanes delivering versus idle-with-reason, ready-to-merge as a
  first-class action list, parked items with their conditions, owner-gate
  ages, spend summary (delivered by M1-S19); stable finding codes so
  findings are acted on without re-deriving; grouped, deduplicated, ranked
  output (four red CI findings on mains is one job, not four); the
  blockers section is a named placeholder until M1-S16; tracker
  ticket-hygiene assertions (epic membership, story points, in-sprint
  state) are named in this expansion.
- AC: each new collector is artifact-verified and bounded; ticket-hygiene
  assertions are covered by name; every finding carries a stable finding
  code; ready-to-merge ranks as an action list.
- Depends on: M0-S6.

### M1-S11 Harness adapters and dispatch portability
- Ticket: GH-233 (milestone M1)
- Goal: Dispatch becomes harness-agnostic through adapters and session telemetry lands in the event log at closeout, making the harness a configuration choice and cost data durable.
- Tasks: harness primitive ports (HarnessInstance, HarnessSession); the
  opencode delivery adapter (porting today's bash session spawn, resume,
  and liveness handling); the Claude Code delivery adapter (headless
  spawn); dispatch consumes a harness adapter instead of calling one
  harness directly (concepts/harness-adapters.md); harness telemetry
  extraction (read-only, from the opencode session store and Claude Code
  local files) captured into the event log at closeout, with session-tree
  attribution to work items (concepts/harness-telemetry.md); the spawn
  path carries an execution-environment descriptor (host is the only
  implementation now) and harness store locations resolve from
  configuration, so a containerized executor and bind-mounted shared
  stores slot in without redesign (concepts/
  containerized-delivery.md); the execution-environment descriptor
  carries a deny-by-default environment allowlist: spawned harness
  sessions receive only the variables the descriptor declares (model
  routing, work paths), never the full parent environment - provider
  credentials resolve through the credential port at use time rather
  than by inheritance (concepts/credential-sidecar.md names the
  exposure class this closes).
- AC: dispatch runs the same delivery through either harness adapter with
  identical result classification; liveness signals are harness-agnostic;
  the harness choice is configuration; a spawned session's environment
  contains only allowlisted variables (an undeclared parent variable is
  absent from the spawn env); after closeout the event log holds
  the delivery's session statistics (tokens by class, calls, tool usage,
  per agent and model) without re-querying harness stores.
- Depends on: M0-S12, M0-S13.

### M1-S12 Change capsule completion and closeout expansion
- Ticket: GH-240 (milestone M1)
- Goal: Every merged change leaves a closed memory capsule (events plus promotion decisions), and post-merge mechanics become one idempotent command that emits judgment residue instead of consuming coordinator tokens.
- Tasks: complete every change folder as a memory episode capsule:
  append-only events.jsonl (phase transitions, gate outcomes, review
  verdicts; one stream with the telemetry concept) and a candidates/
  directory for memory promotion candidates; wire the memory step into
  closeout: validate capsule, identify candidates, dedup against
  project memory, link evidence, promote accepted items to exactly one
  canonical home, archive the capsule (concepts/memory-lifecycle.md);
  capsules stay self-contained through phases 1 to 10 (no cross-change
  writes), which is what later makes preparation phases safely
  concurrent (concepts/parallel-delivery.md). Closeout expansion: the
  owed-flip sweep of the merged diff (feature-flag and class strings,
  TODO markers, when-X-merges notes); MR comment-thread resolution
  check; tracker done plus hygiene (unassign the ball, sweep todo-class
  labels to done-class); branch and worktree cleanup; retro-coverage
  registry move; closeout emits a bounded judgment residue list
  (unresolved human comment threads, ambiguous flip hits) instead of the
  coordinator grepping diffs. Telemetry store clarification: harness
  telemetry (M1-S11) lands in the state-layer event log (the store
  `spend` reads); the capsule's events.jsonl carries phase, gate, and
  review events - two streams, two owners, no duplication. Closeout
  also triggers session compaction (through the `db` integration) for
  the closed delivery's sessions.
- AC: every merged change leaves behind a closed capsule with events and
  a promotion decision (promoted or rejected with reason) per candidate;
  no candidate skips the capture bar or the evidence link; closeout
  performs the full mechanical sweep idempotently and emits bounded
  judgment residue; the M1-S11 telemetry capture still lands in the
  state-layer event log after the closeout rewrite; a re-run after
  restart converges.
- Depends on: M0-S5, M0-S14, M1-S8, M1-S11.

### M1-S13 Machine-readable delivery plan schema
- Ticket: GH-226 (milestone M1)
- Goal: Delivery plans become machine-readable declared artifacts (per-phase scope, done-artifacts, leases, weight class, interactions) so parallelism is computable and the scheduler batches without an LLM in the loop.
- Tasks: the plan schema (YAML) as the plan-writer output format: each
  phase declares the files, packages, and folders it will modify; its
  done-artifacts (MR URL, pipeline id, deployed environment, tracker
  transition) so lane joins verify artifacts, not exit codes; the repo
  leases and build-weight class it needs; declared interactions (contract
  files, generated code) so the scheduler orders producers before
  consumers mechanically; the change variant or ceremony tier is data in
  the plan (per-tier phase sets and escalation triggers; no hardcoded
  eleven); planning phases are declared lease-free (safely parallel) and
  delivery phases lease-taking; the `ados plan` family: validate
  (schema), diff (declared scope versus actual branch diff), overlap
  (pairwise conflict answer: run in sequence or parallel); plan lint
  integrated into `ados lint`; the ready-for-development gate: a change
  is ready for development when its plan validates and its scope is
  declared; migration path from the markdown plan format (writer output
  flips; legacy markdown plans remain readable during transition).
- AC: a plan with an invalid schema is rejected with a classified error;
  the overlap of two plans that touch the same files answers
  run-in-sequence with the overlapping paths named; disjoint plans
  answer parallel; the tier is read from the plan, not hardcoded; the
  ready-for-development gate refuses a change whose plan does not
  validate.
- Depends on: M0-S5, M0-S10.

### M1-S14 Commit primitive and phase-transition commits
- Ticket: GH-227 (milestone M1)
- Goal: Commits become a tool primitive that computes the message from the working tree plus change context, and phase completion records and commits atomically, so agents stop hand-crafting commits and every transition lands as a conventional commit.
- Tasks: `ados commit`: compute a conventional commit message from
  uncommitted files plus the change context (ref, current phase, plan
  phase); precise staging (never untracked strays; privacy-scanned at the
  emitter); phase-transition integration: `ados phase complete` performs
  the record plus commit atomically for the completed phase's pending
  work, **on by default** (`--no-commit` opts out per call; config
  disables per project) - the PM's ledger transitions and the coder's
  plan-phase completions trigger the commit automatically, with no
  agent iteration spent on the commit act; idempotent re-run; respects
  the repository commitlint configuration. The design follows
  concepts/automated-commit.md (owner decisions recorded there):
  deterministic skeleton plus one constrained model call for the
  language parts (subject; body only when it earns its place), inference
  transports behind a seam, marked template fallback when no model is
  available, and the commit never runs inside a delivery session.
- AC: a commit message derives from tree state plus context without agent
  authorship; a plain `phase complete` lands the ledger transition and
  the commit atomically (both land or neither) by default, and `--no-commit`
  records the transition alone; stray untracked files are never staged; a
  re-run after interruption converges.
- Depends on: M0-S3, M0-S10.

### M1-S15 Session lifecycle economics
- Ticket: GH-235 (milestone M1)
- Goal: Sessions resume without re-paying prefill, liveness is progress-based, and restart budgets fail loudly, killing the resume-loop amplification class (the largest measured token-waste incident class).
- Tasks: progress-based liveness signals at the harness adapter level
  (heartbeat, session traffic, token delta; CPU is never the only
  signal; a prefilling or resuming session never reads as stalled);
  resume economics: a resumed session attaches and continues without
  re-paying its prefill, or the restart path is classified uneconomical
  and refused with a reason; a bounded restart budget with a classified,
  fail-loud terminal state (never a silent loop); lane status exposes
  the restart count and the amplification signal.
- AC: a large resuming session is not killed as stalled; a restart past
  the budget fails loudly with a classified reason visible in lane
  status; the resume-amplification metric is derivable per delivery
  (feeds M1-S19); budget exhaustion is durable and consumed by every
  resume path, daemon or one-shot (a one-shot resume past the budget is
  refused with the same classified reason), and its terminal state is
  escalation, not silence: the delivery is
  marked failed in the queue with the classified reason and restart
  history, and a typed question reaches the coordinator within one
  collection cycle (never a silent requeue loop).
- Depends on: M1-S1, M1-S11.

### M1-S16 Typed blocker and question channel
- Ticket: GH-230 (milestone M1)
- Goal: Blockers publish as typed, ranked, answerable questions and answers apply without re-entering delivery sessions, converting hours of lane idle into seconds.
- Tasks: typed question records (decision-needed with options,
  spec-ambiguity, credential-missing with variable name only and never
  values, external-wait) published to the state layer; every question
  carries an `audience` field (owner or coordinator) and answers are
  routed by it: `blockers answer` refuses a cross-audience answer except
  where policy-as-data explicitly delegates (the confused-deputy guard);
  free-text answers refuse credential values like the question path
  does; questions ranked in the
  status digest and brief; answerable as data (`ados blockers answer`);
  the answer is applied by the coordinator loop or the daemon and the
  lane resumes without a full session re-entry where the harness adapter
  declares the resume-injection capability (the laneResume mode records
  which path was taken: boundary-note, attach-continue, or
  resume-prompt-reentry as the acknowledged fallback with its prefill
  cost); one mechanism, two audiences: owner gates (M1-S5) and
  coordinator questions; credential values never transit the channel;
  the pickup contract: the coordinator session is woken (or its next
  iteration is triggered) when a question ranked top-of-digest is
  addressed to it - no question waits on the daily brief.
- AC: a blocker surfaces in the digest within one collection cycle as a
  typed question; an answer addressed to the wrong audience is refused
  (owner-audience question answered by a coordinator identity ->
  refused, with the policy that would delegate named); an answer resumes
  the lane, and when the adapter lacks resume injection the fallback is
  the declared re-entry mode with its cost acknowledged; question types
  are validated; a credential-missing question or answer carries the
  variable name and never a value.
- Depends on: M0-S5, M1-S5.

### M1-S17 Scheduling engine: queue, lanes, dependency batching
- Ticket: GH-237 (milestone M1)
- Goal: The programmatic queue with dependency awareness schedules the delivery loop end to end from declared plans, so the coordinator stops being a dispatcher and parallelism is computed, not discovered.
- Tasks: priority queue with explicit dependencies between changes
  (priorities, repos, dependency graph as one artifact); readiness
  computed from artifacts (builds on queue ready: deps satisfied, repo
  free, tier known, no owner gate, CI healthy, provider available);
  per-repo single-flight keyed on remote as the only structural lane cap
  (capacity, bandwidth, and CI slots never gate lane count); build-weight
  classes (at most one heavy-class job per constrained runner; a resource
  class, not a lane cap); dependency-aware batching (producers before
  consumers; a producer's deploy verified before a dependent repo
  merges); closing beats opening (merge-ready, in-review, and parked
  items rank above new starts); park and resume for external windows
  that re-check their condition continuously and resume exactly when it
  clears (a park that outlives its condition is a classified bug);
  preemption releases the repo with a named park state; lease objects
  carry a scope field (repo-exclusive is the only implemented scope;
  worktree-scoped leases arrive without redesign, concepts/
  parallel-delivery.md); one-shot mode: the queue computes the next
  action and a CLI one-shot executes it (daemon-free operation); lease
  acquisition runs through the fence-token state path (any writer may
  acquire, the daemon is just the usual holder), with a stale-lease
  takeover rule (age beyond the lease TTL with no heartbeat), so
  daemon-down one-shots are mutually exclusive too; park recheck
  semantics: each condition type declares a default recheck interval as
  configuration, a park whose condition cleared is auto-recovered with
  a recorded incident (a park outliving its condition is a classified
  bug, surfaced as a finding), and a parked lane is re-evaluated by the
  next one-shot or daemon start when the daemon was down.
- AC: two lanes cannot deliver the same repo concurrently (including two
  daemon-down one-shots: the second refuses with lease-held evidence);
  a heavy build
  is not scheduled onto a runner already carrying one; a ready producer
  is scheduled before its consumer; close items rank above new starts; a
  park resumes exactly when its condition clears (per-interval
  re-evaluation; auto-recovery with a recorded incident); the queue
  operates end to end without the daemon (one-shot mode).
- Depends on: M0-S7, M0-S13, M1-S2, M1-S4, M1-S13, M1-S15.

### M1-S18 Resident dispatch daemon
- Ticket: GH-238 (milestone M1)
- Goal: A resident daemon drives the queue continuously (single-instance, crash-safe, never a lane itself, degrading to CLI one-shots), so lanes never idle waiting for a coordinator iteration.
- Tasks: the daemon process (start, stop, status) supervises lanes by
  consuming the scheduling engine; single-instance enforcement (lock with
  staleness takeover); crash-safe: scheduling state lives in the state
  layer and a restart resumes the queue without lost or duplicated work
  (idempotent convergence: reruns never duplicate tickets, comments, or
  commits); the dispatcher is never a lane (it spawns and observes; it
  never runs delivery work in-process); progress-based liveness applied
  to its lanes (M1-S15); degradation: daemon failure or absence leaves
  the CLI one-shot path fully functional; runs under a real process
  supervisor (systemd or equivalent); prepares and queues merges but
  never fires them (roadmap constraint 9). The command-to-daemon
  communication contract: state-mediated truth with a local control
  socket (derived from the state dir) as an optimization for wake-now
  notifications and bounded live streams, never the only route; commands
  write intent records (queue entries, priorities, dependencies, blocker
  answers, resume notes) and the daemon writes execution records
  (leases, lane state, heartbeats, parks) under the state layer's fence
  tokens; every command interaction completes through the state path
  alone when the daemon is down, and the daemon reconciles on start.
  The wire contract is control protocol v1: NDJSON frames (request,
  response, event, error) over the unix socket with version negotiation
  (n and n-1), interaction classes poke, query, subscribe (bounded
  streams; overflow degrades the subscriber, never the dispatcher), and
  control (drain, stop, takeover under fence tokens); authorization is
  filesystem permissions (same-user); no business truth crosses the wire
  (every frame derivable from state) and secrets never transit it. The
  protocol is layered (codec, session, transport) with the transport
  config-selected behind an interface: the same frames and logic run
  over stdio in the conformance suite (the transport-independence
  proof), and remote or container-attached transports arrive later with
  one additive `intent` frame class and a handshake identity claim,
  never a protocol rewrite. Concurrency model: one connection per CLI
  invocation (responses routed to the asking connection only; ids
  correlate within a connection), a multi-connection single-event-loop
  server, mutations serialized through the single-writer state layer
  under fence tokens with idempotency keys, and one daemon per state
  dir so multiple agents and multiple projects on one host are isolated
  by scope. Persistence and recovery: the daemon is stateful through the
  state layer only (queue shape, lanes, leases, parks, restart counters,
  and budgets are durable; no fact that matters survives solely in
  memory); `daemon install` registers a user-level supervisor unit
  (systemd user unit with linger, launchd, Windows equivalent) scoped
  to the state dir so the daemon starts at login and survives logout,
  optional and local-first-neutral; on start (login, boot, or crash) a
  bounded idempotent startup reconciliation rebuilds the world from
  state and classifies every in-flight lane by artifact evidence:
  alive (reattach), interrupted (process gone without a failure record:
  resume from the ledger position, completed phases idempotently
  skipped, restart counter incremented), or crashed (failure recorded:
  reason classified, resume per budget). Trust model statement (explicit residual risk): the local
  transport's authorization is the filesystem boundary - every same-user
  process, including lane sessions executing repository code, is inside
  it; per-state-dir scoping isolates projects from each other, not lanes
  from the engine; the boundary is accepted for M1 and the escape paths
  are the parked concepts (credential sidecar, containerized lanes). A
  caller-principal field is reserved (unauthenticated locally, exactly
  like the handshake seam) on intent records and control frames, so a
  later lane-scoped authorization can retrofit without a schema break.
  External-effect protocol (the crash-safety mechanism behind the
  convergence claims): every externally-visible effect (tracker
  transition, comment, commit) is written as intent, applied once with a
  receipt, `unknown` consequence is first-class when the effect may have
  landed before its receipt, and re-apply is gated on query-based
  check-before-reapply reconciliation (the primitive-catalogue rows for
  CommandReceipt and OutboxEffect); commits are additionally protected
  structurally by M1-S14 atomicity and SHA idempotency. Resident-daemon
  polling hygiene: tracker and CI polling runs with per-platform
  rate limits and backoff as configuration (a resident process never
  hammers an API).
- AC: a second daemon instance is refused or takes over stale state with
  evidence; killing the daemon mid-delivery and restarting converges
  without duplicated work - commits structurally (atomicity plus SHA
  idempotency), tickets and comments via receipt-verified
  reconciliation with unknown-first-class classification and
  check-before-reapply (a re-driven effect that already landed is
  detected, not duplicated); deliveries continue via the one-shot CLI
  while the daemon is down; the daemon never executes a merge; commands
  that mutate scheduling or blocker state complete daemon-down and are
  applied on reconcile with zero loss; live-watch without the daemon
  declares degraded mode rather than failing or silently idling; intent
  records and control frames carry the reserved caller-principal field. The
  conformance suite drives the daemon over stdio, proving codec and
  session logic are transport-agnostic; concurrent invocations from
  multiple connections are answered without cross-talk and concurrent
  mutating requests serialize through the state layer with at-most-once
  application (idempotency keys). After an unclean stop or host
  restart, startup reconciliation classifies each in-flight lane
  (alive, interrupted, crashed) from artifact evidence, resumes
  interrupted deliveries from the ledger without redoing completed
  phases, and enforces restart budgets durably; an installed login unit
  starts the daemon against the right state-dir scope and its absence
  changes nothing for one-shot operation.
- Depends on: M1-S4, M1-S15, M1-S16, M1-S17.

### M1-S19 Spend read side and resume amplification
- Ticket: GH-236 (milestone M1)
- Goal: Per-ticket and per-phase spend plus the resume-amplification metric are visible from the event log, so waste classes are findable from the spend report alone.
- Tasks: `ados spend` v0 read side over the closeout-captured harness
  telemetry: per-ticket and per-phase tokens by class, calls, per agent
  and model; the resume-amplification metric (tokens paid versus unique
  progress); per-delivery restart counts; text digest plus JSON; alarms,
  burn-rate, and quota snapshots stay in M2-S6.
- AC: a closed change reports its spend breakdown from the event log
  without re-querying harness stores; the resume-amplification metric
  reads approximately 1 for a healthy delivery and flags amplification
  events by name.
- Depends on: M1-S11.

### M1-S20 Agent integration: prompts consume the tooling
- Ticket: GH-242 (milestone M1)
- Goal: The lifecycle agents (the PM-style coordinator and its lane agents: plan writer, coder, reviewer, and the rest) use the tool primitives for coordination, so coordination is tool calls, not prose discipline.
- Tasks: update the agent prompt definitions and lifecycle instructions:
  phase bookkeeping exclusively via `ados phase`; pm-notes writes through
  the linted path; plan-writer emits the M1-S13 plan schema; coder
  executes against declared phase scope and marks phase completion
  (record plus commit via the M1-S14 primitive); blockers publish as
  typed questions instead of prose; the coordinator consumes the digest
  and typed answers; man-page-grade guides and `--help` coverage for
  every command the agents call; bash-era instruction residue removed
  where superseded.
- AC: no lifecycle agent instruction writes phase state by hand or
  hand-crafts a commit for a phase transition; every tool call the
  prompts require has `--help` and a guide; no prompt references a
  retired bash entry point as the primary path; the bash-continuity
  key=value machine summaries are preserved on every replaced surface;
  end-to-end: a coordinator session completes one full J1 iteration
  (digest, typed answers, merge, closeout, next pick) using only the
  tooling primitives on a pilot repository.
- Depends on: M0-S10, M1-S4, M1-S10, M1-S13, M1-S14, M1-S16, M1-S17.

### M1-S21 Model profiles and provider watching
- Ticket: GH-234 (milestone M1)
- Goal: Model routing becomes profile-driven configuration (tier structure, per-agent overrides, selection heuristics, eligibility rules) with live provider watching and automatic switch-or-park, reverse-engineered from the legacy user-config resolver scripting; every harness spawn resolves a profile first, so quota and cost policy are enforced by machinery, not agent discipline.
- Tasks: the profile model as configuration data: tiers as structure
  (responsibility groups) and profiles as the model-per-tier assignment
  with per-agent overrides; the selection heuristics encoded as
  declarative policy (assign by consequence of an error times reasoning
  depth divided by volume; capability gates are hard rules - a
  text-only seat never receives a vision task; amplification and
  family-diversity rules declared, not hardcoded); profile hierarchy
  and preference chain (base, fallback, chain order; a profile is a
  candidate iff every provider it uses is available; probes lazy and
  memoized); provider watching for the first-iteration set behind the
  provider engine - the coding-plan subscription quota endpoints (weekly
  and rolling windows), the DeepSeek balance API, and the OpenAI
  subscription usage windows - with parks for expensive windows (peak
  hours, priced multipliers) and switch-not-park on exhaustion plus
  automatic revert on recovery; subscription pacing as configuration
  data (declared goal priorities: utilize the subscription window, keep
  the judgment seat until a configured tail, minimize paid use;
  pacing rungs move only the declared non-judgment seats); spawn
  integration: profile selection always runs before any harness spawn,
  whether from the CLI or the dispatch daemon, and the spawn wrapper
  injects the resolved model environment as validated data records,
  never shell code (the legacy hook's data-only env-record contract
  carries over); the current target profile persists in state with
  revert-on-recovery; the legacy resolver scripting's semantics are
  ported with its test battery (chain order, lazy probes,
  park-versus-switch, revert, condition seams); the env-record
  validation schema is adversarially hardened (variable-name shape,
  duplicate keys, metacharacters, homoglyphs, NUL and equals signs
  rejected; values are never shell-interpreted); seat assignments carry
  a typed pacingClass field (judgment or execution) as data - the
  pacing rungs move only execution-class seats, and the field, not a
  profile-naming convention, is what the engine enforces.
- AC: a spawn never starts without a resolved profile; an exhausted
  subscription provider switches to the next eligible profile
  automatically and reverts when it recovers; a provider in an
  expensive window parks with cause and expiry and resumes exactly when
  the window clears; a text-only seat never receives a vision task; the
  pacing rungs move only seats whose declared pacingClass is execution;
  chain,
  thresholds, rungs, and overrides are configuration (no code changes);
  the legacy scripting's decision table is covered by ported tests.
  Milestone-exit criterion (declared in): every harness spawn on the
  pilot paths resolves its profile through the engine, and the audit
  ledger shows zero manual model-environment overrides in the final
  two-week window.
- Depends on: M0-S13, M1-S11.

### M1-S22 Command audit ledger and agent identity
- Ticket: GH-223 (milestone M1)
- Goal: Every CLI invocation is audited (command, args, outcome, timing, caller identity) in a durable ledger, so scripted outputs can drop context fields agents do not need and auditor or retro agents get a trustworthy record.
- Tasks: append-only audit ledger in the state layer: runId, command,
  arguments (through the redaction chokepoint), exit code, timing,
  outcome class, scope or repo, and the calling agent's identity when
  provided; the identity convention is specified: an environment
  variable named through the branding seam, set by the harness adapter
  at spawn from the agent role and lane id (per-lane-unique shape),
  rendered into shells the agent starts by the harness plugin - the
  identity is unauthenticated attribution (recorded as claimed, not
  proven; see the S18 trust model); the envelope context fields
  (schemaVersion, runId, timing) are recorded here, enabling the
  scripted-mode output trim (the trim activates when this story lands;
  commands shipped before it emit the full envelope until then);
  retention follows the state layer; integrity is tamper-evident
  hash-chaining (a chaining key that never enters lane environments),
  so records cannot be altered undetectably - wording is
  tamper-evidence, not prevention, on a single-user host; a bounded,
  filtered read surface for retro and auditor agents.
- AC: every command invocation produces exactly one audit record
  (idempotent re-runs distinguished by runId); the calling agent's name
  is captured when provided and never inferred when absent; scripted
  `--json` output omits schemaVersion, runId, and timing (errors keep
  runId as the correlation key) while the audit
  record retains them; the ledger survives a malformed entry without
  data loss; undetectable alteration of a record is not achievable
  within the trust model (hash-chain break flags); secrets never appear
  in any record.
- Depends on: M0-S3, M0-S5.

### M1-S23 Coordinator supervision
- Ticket: GH-241 (milestone M1)
- Goal: The coordinator session gets the same managed lifecycle lanes have (resume on context pressure, artifact-evidence stuck detection, kill with grace, bounded restarts, wake on typed questions), replacing `ceo-loop.sh`'s actual function so the bash stack can retire at M4-S5 with no actor left unmanaged.
- Tasks: coordinator-session supervision beside the lane daemon: spawn
  and join-or-resume decisions under context pressure (resume the
  existing session when its context is recoverable, spawn fresh when
  not, with the decision recorded); stuck detection by artifact
  evidence (no digest consumed, no merge, no answer within declared
  windows - not CPU); kill the coordinator tree with a grace period;
  bounded restart budget with classified, loud exhaustion (escalates to
  the owner brief, never a silent loop); wake-on-typed-question: a
  top-of-digest coordinator-audience question triggers the next
  coordinator iteration (the M1-S16 pickup contract's enforcement
  arm); runs under the same supervisor regime as the daemon
  (`daemon install` scope), distinct process, distinct budget.
- AC: a coordinator session killed mid-iteration resumes or is
  respawned per the recorded decision without losing closed-out work;
  a stuck coordinator is detected by artifact evidence within the
  declared window and restarted with the reason classified; restart
  exhaustion escalates to the owner brief (never silent); a
  coordinator-audience typed question wakes the coordinator within one
  collection cycle; the ceo-loop.sh functions are covered: context
  resume decision, stuck detection, kill-with-grace, restart budget.
- Depends on: M1-S15, M1-S16.

---
