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
  needed); freshness bound covers CI and tracker state; waivers recorded
  with author and scope.
- Errors: `merge.gate.<gate-id>.failed`, `merge.gates-stale`,
  `merge.owner-gate-override-without-waiver`.
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

### `status` (M0-S6 shipped; M1-S10 proposed expansion)

- Inputs: `--repo <path>` repeated; `--json`.
- Outputs (expansion): grouped, ranked digest with stable finding codes;
  new sections: attention-state (lanes delivering vs idle-with-reason),
  ready-to-merge action list, parked items with conditions, owner-gate
  ages, spend summary (placeholder until M1-S19), typed questions
  (placeholder until M1-S16); partial collection reported in-band.
- Scenarios: four red CI findings on mains render as one grouped job;
  every finding carries a finding code; blockers surface within one
  collection cycle.

### `queue` (M1-S17, proposed)

- Inputs: `list | plan | add <ref> [--priority <n>] [--dep <ref>]... |
  prioritize <ref> <n> | dep <ref> <on-ref>`.
- Outputs: the dependency graph, ready set, per-repo lease holders,
  weight-class loads, park states with conditions; `queue plan` prints
  the next N scheduled actions with reasons (close-first, producer-first,
  single-flight, weight-capped).
- Errors: `queue.dependency-cycle`, `queue.lease-conflict`,
  `queue.park-condition-stuck` (park outliving its condition is a bug
  class).
- Scenarios: same-repo concurrency refused; heavy build not co-scheduled;
  producer before consumer; close items rank above new starts; park
  resumes exactly when condition clears; full operation one-shot without
  daemon.

### `lanes` (M1-S17, proposed)

- Outputs: lane list with state (delivering, idle-with-reason, parked,
  merge-ready, in-review), lease scope, restart counts, amplification
  signal.

### `blockers` (M1-S16, proposed)

- Inputs: `list [--open]`; `answer <id> [--choice <n>] [--text <s>]`.
- Outputs: typed question records `{ id, type, lane, question, options[],
  asked-at, age }` with types decision-needed, spec-ambiguity,
  credential-missing (variable name only), external-wait; ranked by age
  and priority; answer applies and resumes the lane (no session
  re-entry).
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

- Inputs: `start | stop | status`.
- Outputs: status: instance identity, uptime, queue depth, lane states,
  restart counters, last crash reason (classified); a second instance is
  refused or takes over stale state with evidence.
- Errors: `daemon.already-running`, `daemon.state-recovery-failed`
  (degrades to one-shot guidance).
- Scenarios: kill-and-restart converges without duplicated work
  (rerun never duplicates tickets, comments, commits); one-shot path
  fully functional while daemon down; daemon never executes a merge
  (no code path exists).

### Shipped M0 operate commands (`config`, `lint`, `phase`, `db`,
`provider`)

Contracts as shipped: config prints merged config with per-key origin
(`config debug` names layer, file, line); lint classifies pm-notes and
registry malformations; `phase complete|reopen` is the only phase write
path (reopen requires a reason); db is dry-run by default; provider
resolve/quota/parks as shipped with named self-expiring parks.

## Learn family

### `spend` (M1-S19, proposed)

- Inputs: `--ref <ref>`; `--phase <phase>`; `--amplification`.
- Outputs: per-ticket and per-phase tokens by class, calls, per agent and
  model, restart counts, from the event log (no harness re-query);
  `--amplification` prints tokens-paid vs unique-progress (approximately
  1 for healthy deliveries) and flags amplification events by name.
- Scenarios: closed change reports from the log alone; amplification
  event flagged and attributed to its restart loop.

### `retro` (M1-S8, proposed)

- Outputs: retro levels on demand; evidence from the append-only
  sidecar a delivery agent cannot write; survives malformed entries
  without data loss.

## Surfaces

### `mcp` (M1-S7, proposed)

- Tools: status, verify-artifact, gate-report returning the same core
  results and error codes as the CLI; process exit codes never
  propagate; no batch (M3-S2).

## Cross-cutting test scenarios

- Deterministic render paths (digest, brief, plan views, queue plan)
  contain no model calls: asserted by review and by dependency boundary
  checks.
- Every command: `--help` with examples; secrets never in output; the
  bash-continuity keys where a predecessor existed.
