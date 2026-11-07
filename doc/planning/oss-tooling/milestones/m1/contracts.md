# M1 outcome contracts: command inputs and outputs (planned, proposed)

Proposed contracts for the command surface available after M1, written for
review: each entry names inputs, outputs (text digest and machine
envelope), notable error codes, one example, and the test scenarios the
story must cover. Planned state: every M1 contract is a proposal refined
at story delivery; M0-delivered commands describe shipped behavior.
Conventions in [../README.md](../README.md); usage lines in
[man-page.md](man-page.md).

## Shared contracts (all commands)

**Envelope.** `--json` always emits `{ schemaVersion, runId, exitCode,
timing, data | error }`; a failing command still emits a valid envelope.
Every error carries: stable hierarchical code (`domain.reason.detail`),
category (user, platform, transient, permanent), retryable, consequence
(did the mutation land; `unknown` is first-class), remediation hint.

**Envelope formatting and the agent-mode trim.** `--json` output adapts
by context (owner decision, 2026-11-05):

- Interactive terminal: the full pretty envelope (schemaVersion, runId,
  exitCode, timing, data or error), indented.
- Scripted or piped (the agent case): a minified single line carrying
  only `{"data":...}` on success or `{"error":...}` on failure.
  schemaVersion and timing are trimmed from the output - they
  live in the command audit ledger (M1-S22) instead of the agent's
  context; errors keep `runId` as the correlation key (agents need it
  for blockers and audit). Error objects always keep the full
  error-table fields (code, category, retryable, consequence,
  remediationHint). The trim activates when M1-S22 lands; commands
  shipped before it emit the full envelope until then.
- `--verbose` forces the full envelope in any mode; `--pretty` has no
  effect on the trim (only on indentation).
- Stream outputs (`--watch`) stay line-delimited in every mode: one JSON
  object per line; multi-line objects would break stream framing.
- The process exit code always carries the status; the trim never
  removes information agents need for valid operations.

**Exit codes.** 0 success; 1 user/validation; 2 platform/provider, and
all state-unverified outcomes (never exit-0 silence).

**Key=value continuity.** Where a bash predecessor printed a stable
summary (`result=`, `pr_url=`, `exit_code=`, `last_message=`), the
replacement prints the same keys, same semantics, before any envelope.

**Tri-state evidence.** Every finding carries one of observed,
degraded, unknown, unavailable, not-delivered; a failed or unattempted
read never renders as clear or zero.

**Stable finding codes.** Status-family findings carry stable symbolic
codes (for example `ci.red-on-main`, `tracker.stalled-ticket`,
`lane.idle-no-reason`) so agents act without re-deriving.

**Refusal semantics (shared pin).** A clean refusal is a successful
verification with a negative verdict: `result=refused`, exit 1,
classified error naming the gate or condition with a remediation hint.
Never exit 0 (silence), never exit 2 (that is reserved for
platform/provider faults and state-unverified outcomes).

Exact Given/When/Then scenarios with assertions per behavior are in
[test-scenarios.md](test-scenarios.md); they are the seed each owning
story's test plan inherits and reconciles.

Test scenarios shared by all commands: envelope-valid-on-failure;
exit-code projection; secret redaction; bounded output.

## Deliver family

### `dispatch` (M1-S9, proposed)

- Inputs: `<ref>`; `--harness <name>`; `--resume-prompt <text>`; config
  supplies provider chain, execution environment, state dir.
- Outputs: text summary with the bash-continuity keys (`result=` one of
  merged, blocked, pr-open, pr-open-unverified, failed, finished,
  max-restarts, state-unverified, partial, noop-lane-permission,
  noop-lane-nothing-to-do; `pr_url=`; `exit_code=`; `last_message=`);
  envelope data adds `phaseLedger`, `restarts`, `resumeAmplification`,
  `harness`, `handoverState` (dual-run or authoritative per repo).
- Errors: `dispatch.session.spawn-failed`, `dispatch.restart-budget-
  exceeded` (classified, loud), `dispatch.resume-uneconomical`.
- Example: `<binary> dispatch GH-231` prints
  `result=pr-open pr_url=https://... exit_code=0 last_message="phase 11
  complete; merge decision handed to coordinator"`.
- Scenarios: dual-run divergence reported; exit-0-with-no-artifact
  classified as failed dispatch; handover flips one repo only; restart
  past budget fails loudly with reason; harness choice is config.

### `plan validate` / `plan diff` / `plan overlap` (M1-S13, proposed)

- Inputs: `<ref>`; `--against <base>` for diff; two refs for overlap.
- Outputs: validate: per-phase declared scope (files, packages, folders),
  done-artifacts, leases, weight class, interactions, tier; verdict
  `valid | invalid` with per-error codes; diff: declared-versus-actual
  path table with `within | outside-declared | undeclared-missing`;
  overlap: `parallel | run-in-sequence` plus the overlapping paths named.
- Errors: `plan.schema.invalid`, `plan.scope.undeclared-paths`,
  `plan.tier.unknown`.
- Example: `<binary> plan overlap GH-221 GH-222` prints
  `verdict=run-in-sequence overlapping=packages/core/src/contracts/**
  (3 phases) reason=shared-contract-files`.
- Scenarios: invalid schema rejected with classified error; overlap names
  paths; disjoint plans answer parallel; tier read from plan, not code;
  ready-for-development gate refuses an unvalidatable plan.

### `commit` (M1-S14, proposed)

- Inputs: `<ref>`; `--phase <phase>`; `--dry-run`.
- Outputs: computed conventional subject and body preview; `staged=`
  file list (never untracked strays); on `phase` mode: ledger transition
  plus commit atomically (both land or neither).
- Errors: `commit.staging-blocked-untracked`, `commit.commitlint-failed`,
  `commit.atomic-abort` (neither landed, classified).
- Example: `<binary> commit GH-221 --phase delivery` prints
  `subject="feat(GH-221): implement merge transaction gates" staged=4
  ledger=delivery:complete commit=abc1234`.
- Scenarios: message derives without agent authorship; stray untracked
  file never staged; interrupt mid-atomic converges on re-run;
  commitlint config respected.

### `verify change` (M0-S8, shipped) / `verify gates` (M0-S9, shipped)

- Outputs: phase-ledger verdict against the change's declared variant;
  gate battery with per-gate citations (lifecycle, CI on pushed SHA,
  push parity, owner-gate scan, squash preflight); any vacuous green or
  missing job fails its gate.
- Envelope data: per-gate `evidence` refs (pipeline id, SHA, tracker
  state at time of check).

### `verify deploy` (M1-S4, proposed)

- Outputs: deployment verdict by job trace (steps executed, artifacts
  produced); `pipeline-created-never-ran` reads unknown, never green.
- Scenarios: trace-verified deploy; vacuous deploy trapped; stale status
  field disqualified.

### `merge` (M1-S4, proposed)

- Inputs: `<ref>`; `--dry-run`; gate set from config (versioned data).
- Outputs: on success `landed=true` squash SHA, landing verified; on
  refusal the failed gate named with inline evidence (no re-probe
  needed); freshness bound covers CI and tracker state; waivers carry
  an authorizer principal, and the transaction verifies the authorizer
  against the gate class's declared policy (owner-authored for
  never-merge classes) - waiver presence alone never passes the gate;
  a behind-base PR attempts one rebase-refresh and a conflict is a
  classified refusal naming the paths.
- Errors: `merge.gate.<gate-id>.failed`, `merge.gates-stale`,
  `merge.waiver-unauthorized`,
  `merge.owner-gate-override-without-waiver`, `merge.rebase-conflict`.
- Example: refusal prints `gate=tracker-freshness evidence="ticket moved
  to owner-gated 6 min after verification" remediation="re-run verify
  gates"`.
- Scenarios: gates-stale refusal; repo-declared custom gate enforced
  without code; post-verification tracker transition caught; every
  override has a recorded waiver; merge fired only by the coordinator
  (daemon API path absent).

### `closeout` (M0-S14 shipped; M1-S12 proposed extension)

- Outputs (extension): mechanical sweep report (ticket done, labels,
  unassign, owed-flip sweep hits, comment resolution, branch and worktree
  cleanup, retro-coverage move, capsule promotion decisions) plus
  `judgment-residue` list (unresolved human threads, ambiguous flips).
- Scenarios: idempotent re-run converges; residue is bounded; capsule
  closed with promotion decision per candidate.

## See family

### `status` (M0-S6 shipped; M1-S10 attention-state expansion shipped)

- Inputs: `--repo <path>` repeated; `--json`. `--watch` (bounded live
  stream through the daemon control socket; degrades to state polling in a
  declared degraded mode when the daemon is down) is planned with the
  daemon story M1-S18, not delivered by M1-S10.
- Outputs (delivered expansion): nine fixed sections in order (tracker,
  changes and PRs, CI, lanes or queue, providers, parked work,
  ready-to-merge, spend, blockers); grouped, ranked findings with stable
  registry codes; tri-state hygiene assertions (epic membership, story
  points, in-sprint); owner-gate ages; parked items with conditions; a
  merge-ready-first ready-to-merge action list; the declared lane
  attention-state vocabulary while the lanes section reports its existing
  not-delivered gap; the state-log-fed spend section (spend read side,
  M1-S19); typed blockers (until M1-S16) as a named not-delivered
  placeholder; partial collection reported in-band.
- Scenarios: four red CI findings on the primary branch render as one
  grouped job; every finding carries a finding code; ready-to-merge ranks
  as an action list; blockers surface within one collection cycle.

### `queue` (M1-S17, delivered)

- Inputs: `list | plan [--next <n>] | add <ref> [--priority <n>]
  [--dep <ref>] | prioritize <ref> <n> | dep <ref> <on-ref> |
  claim [<ref>] [--holder <id>] | release <ref> [--holder <id>]
  [--park <cause>]`. `ready` keeps its M0-S7 grammar unchanged.
- Outputs: the dependency graph, ready set, per-repo lease holders,
  weight-class loads, park states with conditions, and `queue plan`'s
  next N scheduled actions with reasons (close-first, producer-first,
  single-flight, weight-capped). Mutating subcommands append intent under
  the state fence and land durably without a resident daemon; no control
  socket is involved, and every payload reports
  `degraded: ["daemon-unreachable"]` at exit 0.
- Errors: `queue.dependency-cycle`, `queue.lease-conflict`,
  `queue.park-condition-stuck`, `queue.entry.unobserved`, and
  `queue.precondition.unmet`; invocation rejections such as `--watch`
  reuse `fallback.invocation`.
- Scenarios: same-repo concurrency refused; heavy build not co-scheduled;
  producer before consumer; close items rank above new starts; park
  resumes exactly when condition clears; full operation one-shot without
  daemon.

### `lanes` (M1-S17, delivered)

- Inputs: `list | show <ref>`.
- Outputs: lane list with state (delivering, idle-with-reason, parked,
  merge-ready, in-review, failed), lease holder and scope, restart counts,
  amplification signal, and weight class. `--watch` is refused at exit 1;
  live streaming belongs to the resident daemon (M1-S18).

### `blockers` (M1-S16, proposed)

- Inputs: `list [--open]`; `answer <id> [--choice <n>] [--text <s>]`.
- Outputs: typed question records `{ id, type, audience, lane, question,
  options[], asked-at, age }` with types decision-needed, spec-ambiguity,
  credential-missing (variable name only), external-wait; the audience
  field (owner or coordinator) routes answers - a cross-audience answer
  is refused unless policy-as-data delegates; questions ranked by age
  and priority; answer applies and resumes the lane (no session
  re-entry). Answers are intent records in state; a running daemon
  applies them immediately (control-socket wake), a down daemon applies
  them at reconcile, and a one-shot `dispatch --resume` path exists.
  Free-text answers refuse credential values like the question path
  does. Resume modes (recorded on the answer): boundary-note,
  attach-continue, or resume-prompt-reentry (the acknowledged fallback
  when the harness adapter lacks resume injection; its prefill cost is
  visible).
- Errors: `blockers.invalid-type`, `blockers.credential-value-rejected`
  (the channel refuses values, names only).
- Scenarios: question surfaces within one collection cycle; answer
  resumes lane; credential question never carries a value; owner-gate
  asks render through the same mechanism.

### `board` (M1-S5, proposed) / `brief` (M1-S6, proposed)

- Outputs: board: owner-gate SLA mechanics (24 h escalation, 72 h
  default-on-expiry, aging grid); brief: one-screen deterministic render
  from the same collector state as the digest, decision-first, anchored
  actions (ready-to-merge, questions, aging gates), named placeholders
  for unbuilt collectors.
- Scenarios: brief matches collector state exactly; render path has no
  LLM call (asserted in review); expired gate takes its pre-agreed
  default and records it.

## Operate family

### `watchdog` (M1-S1 shipped-contract proposed)

- Outputs: preflight verdict (refuses non-base or dirty checkout with
  evidence); teardown restoration report; liveness probe with
  progress signals (heartbeat, session traffic, token delta; CPU never
  the only signal).
- Scenarios: stranded and foreign commits refused or restored; a large
  prefilling session never reads as stalled.

### `state` (M1-S2, proposed)

- Outputs: per-store schema verdicts at every boundary (delivery
  registry, retro registry, ceremony artifacts); torn or unknown reads
  classified with repair guidance, never silent zeros.

### `doctor` (M1-S3, proposed)

- Outputs: wiring checks (repo, tracker, provider, state, CI), each
  `ok | failing` with a fix hint; stable exit codes.
- Scenarios: each failing check names its fix hint; doctor exits 1 with
  classified errors, never crashes.

### `daemon` (M1-S18, proposed)

- Inputs: `start [--foreground] | stop | status [--live] | install |
  uninstall`. `install` registers a user-level supervisor unit (systemd
  user unit with linger, launchd agent, Windows service equivalent)
  scoped to the state dir so the daemon starts at login and survives
  logout; optional and local-first-neutral (one-shots work without it).
- Communication contract: state-mediated truth, socket as optimization.
  Commands write intent records to state (queue entries, answers, resume
  notes) and optionally poke the control socket (path derived from the
  state dir) for wake-now behavior and bounded live streams; every
  interaction has a state-only fallback, so all commands work daemon-down
  and the daemon reconciles on start (idempotent convergence). Writer
  ownership: commands write intent, the daemon writes execution records
  (leases, lane state, heartbeats, parks), lifecycle agents write the
  ledger; fence tokens prevent conflicts.
- Wire protocol (control protocol v1, full contract in
  [architecture.md](architecture.md)): NDJSON frames over the unix socket
  (named pipe on Windows); frame kinds request, response, event, error;
  versioned with n/n-1 support; interaction classes poke, query,
  subscribe (bounded streams, degraded on overflow), control
  (drain/stop/takeover under fence tokens); authorization is filesystem
  (0700 state dir, same-user); no business truth on the wire (every
  frame derivable from state); secrets never cross the wire.
- Transport layering: codec, session, and transport are separate layers;
  the transport is config-selected (local socket default; stdio in
  tests) behind an interface, so remote or container-attached transports
  (TCP/TLS, SSH-tunneled, pipes into containers) reuse the same frames
  and logic plus one additive `intent` frame class and a handshake
  identity claim; remote stays off by default (M4-S6 connection point).
- Concurrency: connection per CLI invocation (responses return only on
  the asking connection; ids correlate within a connection); the daemon
  is a multi-connection single event loop; mutations serialize through
  the single-writer state layer under fence tokens with idempotency keys
  (at-most-once); one daemon per state dir (per project scope), so
  multiple agents and multiple projects on one host are isolated by
  scope; every request has a bounded timeout that degrades instead of
  blocking.
- Outputs: status: instance identity, uptime, queue depth, lane states,
  restart counters with classified reasons, heartbeat age, socket path
  and reachability; merge code path absent (never fires merges). On
  start, a bounded startup reconciliation report: lanes rebuilt from
  state, each in-flight lane classified alive (reattached),
  interrupted (process gone without a failure record: resumed from the
  ledger position, completed phases idempotently skipped, restart
  counter incremented), or crashed (failure recorded: reason
  classified, resumed per budget); restart budgets enforced durably
  across daemon restarts, and a delivery past its budget is marked
  failed in the queue (terminal, classified reason, restart history)
  with a typed question surfaced to the coordinator within one
  collection cycle; exhaustion never silently requeues.
- Errors: `daemon.already-running`, `daemon.heartbeat-stale` (reads
  declare degraded, never block), `daemon.state-recovery-failed`
  (degrades to one-shot guidance), `daemon.protocol.unsupported`
  (version refused, versions offered), `daemon.socket-unreachable`
  (intent writes still succeed via state; `--live` and `--watch` report
  it with a fallback hint), `daemon.subscriber-degraded` (slow consumer
  dropped to state polling; dispatch never stalls).
- Scenarios: kill-and-restart converges without duplicated work; commands
  complete via the state path while the daemon is down (queue add, plan,
  blockers answer, status); a second instance is refused or takes over
  stale state with evidence; live-watch without the daemon declares
  degraded mode; the daemon never executes a merge (no code path).

### Shipped M0 operate commands (`config`, `lint`, `phase`, `db`,
`provider`)

Contracts as shipped: config prints merged config with per-key origin
(`config debug` names layer, file, line); lint classifies pm-notes and
registry malformations; `phase complete|reopen` is the only phase write
path (reopen requires a reason); db is dry-run by default; provider
resolve/quota/parks as shipped with named self-expiring parks.

## Learn family

### `spend` (M1-S19, shipped)

- Inputs: `--ref <ref>` (defaults to the active change ref); `--phase
  <phase>`; `--amplification`; global `--json`.
- Outputs: `data` under `delivery.spend.v1` with exactly
  `tokensByClass` (the five delivered classes; null classes excluded and
  disclosed in `degradation`), `perPhase[]`, `perAgent[]`, `restarts`,
  `amplification` (`ratio`, `progressRun`, `events[]`), and `degradation`.
  Figures derive from closeout-captured telemetry in the event log (no
  harness re-query); per-phase attribution uses `phase.transition`
  windows with the named `unknown` fallback. `--amplification` prints
  tokens-paid vs unique-progress (approximately 1 for healthy deliveries)
  in the human digest and flags `restart-loop prefill re-pay` events by
  name; the envelope always carries the block. Output is bounded
  (64 KiB machine, 16 KiB / 200 lines human) and deterministic.
- Exit: 0 reported; 1 `spend.telemetry-absent`, input rejection, or a
  delivered user-validation state row; 2 delivered platform-provider
  state rows. Cost is not aggregated; alarms/burn rates/quota are M2-S6.
- Scenarios: a closed change reports from the log alone; a telemetry-absent
  store classifies rather than reporting zeros; a restart loop flags one
  named event per superseded record-bearing run; a healthy single-run
  delivery reads exactly 1.

### `retro` (M1-S8, proposed)

- Inputs: `collect|report`; `--level <name>` (default `change`); global `--json`.
  Declared levels are R1-R6; only `change` is implemented, and the other
  declared names refuse with their owning-story hint.
- Outputs: collect returns `data` with `level`, `outcome`
  (`collected` | `no-target`), `selection`, `counts`, and for a collected run
  `runId` and `truth`; report returns exactly `level`, `findings[]`,
  `followThrough[]`, and `evidenceRefs[]`. Evidence lives in the independent
  append-only keyed-chain sidecar; the validated registry declares levels,
  records collection runs, and hosts the memory-audit trigger.
- Exit: 0 collected, reported, or explicit `no-target`; 1 malformed entry,
  tamper flag, vacuous run, or input/permission refusal; 2 unreachable
  evidence store or a write refused outside the collector seam.
- Scenarios: a malformed entry classifies with valid entries preserved;
  altered evidence flags a chain break and is never served as verified;
  a no-eligible-target collect is an explicit success while an executed
  zero-collector run is `retro.truth.vacuous-run`; a clean empty fold is a
  null-retro success. Export is a bounded library surface, not a CLI verb.

## Surfaces

### `mcp` (M1-S7, proposed)

- Tools: status, verify-artifact, gate-report returning the same core
  results and error codes as the CLI; process exit codes never
  propagate; no batch (M3-S2).

## Cross-cutting test scenarios

**Timing defaults (config keys with defaults; owning story in
parentheses).** Collection cycle: 60 s (`daemon.heartbeat-cycle`, M1-S18;
digest staleness bound 2 cycles). Daemon heartbeat to state: 5 s
(`daemon.heartbeat-interval`, M1-S18). Lane liveness evaluation: 30 s
(`lane.liveness-interval`, M1-S15). Gate freshness bound: 30 m
(`merge.gate-freshness`, M1-S4). Lease TTL: 90 s with heartbeat renewal
(`queue.lease-ttl`, M1-S17). Park recheck: per condition type, defaults
60 s (windows) and 300 s (quota) (`queue.park-recheck.<type>`, M1-S17).
Tracker/CI poll backoff: per platform, exponential, defaults 5 s base 60 s
cap (`poll.<platform>.*`, M1-S18). All are configuration; stories own the
key, the default, and the semantics.

- Deterministic render paths (digest, brief, plan views, queue plan)
  contain no model calls: asserted by review and by dependency boundary
  checks.
- Every command: `--help` with examples; secrets never in output; the
  bash-continuity keys where a predecessor existed.
- Dispatch never fires a merge: the `merged` result token is
  already-merged detection only (constraint 9; producer is the
  coordinator's `merge`).
- `verify deploy` unknown verdict (trace examined, evidence absent) is
  disjoint from state-unverified (the read itself failed): different
  classes, different exits (1 vs 2).
