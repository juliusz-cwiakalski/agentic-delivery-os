# Production operator requirements: autonomous delivery efficiency, minimal token waste

- Author: the production delivery operator, the CEO agent running ADOS in
  production (multiple active repos, parallel lanes, Jira tracker, one merge
  authority: that CEO agent).
- Date: 2026-11-03.
- Purpose: input to the M1 delivery-engine re-planning; complements the owner
  milestone-intent draft and the roadmap's M1 redefinition. Written from the
  seat that will consume the tooling daily on a private production fleet
  (named out of band; never in committed files).
- Provenance: sanitized copy of an operator-authored draft. The source draft
  is untracked; only this sanitized version is committed.
- Reading guide: decision-first. Section 1 is the whole ask in one table.
  Sections 2 through 4 are the requirements with production evidence.
  Section 5 hard constraints. Section 6 what the operator does NOT need.
  Section 7 acceptance criteria phrased from the operator's seat. Section 8
  evidence appendix (mechanisms and dates, self-contained).

## 1. Decision-first summary

The milestone intent is endorsed: replace the bash delivery stack
(`deliver-ticket.sh`, `batch-deliver.sh`, `ceo-loop.sh`, `pm-liveness.sh`)
with a resident daemon plus commands, separate parallel planning from leased
delivery, and formalize machine-readable delivery plans. What the operator
adds from production:

1. **What the daemon must guarantee before it is trusted with the fleet**
   (section 5). A buggy dispatcher wedges every lane at once; that failure
   mode is worse than today's bash stack.
2. **The token-waste classes that never show up in feature lists** (section 2
   R5, section 3): session-resume amplification, prose checklists re-executed
   by an LLM, waiting inside LLM context, blocker round-trips that re-enter
   sessions.
3. **Acceptance criteria phrased as the target iteration** (section 7): the
   tooling is done when the operator's loop is read one digest, answer typed
   questions, transactional merge, closeout residue, next, with zero tokens
   spent on waiting, polling, scheduling, or re-verification of healthy
   paths.

| # | Requirement (priority) | Why it matters | Maps to |
|---|---|---|---|
| R1 | Merge as a transaction (P0) | Kills the highest-frequency judgment-adjacent ritual: prose gate checklist re-executed with 6 to 10 shell/API calls per merge | M1-S4 |
| R2 | Truthful signals on every engine acted on (P0) | Exit-0-with-no-artifact, vacuous-green CI, status fields lying in both directions each cost real incidents | M0 core, M1-S2, M1-S4 |
| R3 | Scheduling leaves the operator's context (P0) | The operator must stop being a dispatcher; lanes idle today because a CEO iteration is the scheduler | M1-S17, M1-S18 |
| R4 | Machine-readable delivery plans with per-phase scope plus done-artifacts (P0) | Makes parallelism computable; joins must verify artifacts, not exit codes | M1-S13 |
| R5 | Session lifecycle economics (P0) | Largest single token-waste class: resume loops re-paying prefill roughly ten times | M1-S15 |
| R6 | Typed blocker and question channel (P0) | Lane blockers today park lanes for hours; answers re-enter whole sessions | M1-S16 |
| R7 | One digest to bootstrap every session (P1) | Proven pattern in production; replaces minutes of per-system probing per session | M1-S10 |
| R8 | Closeout as one command (P1) | Post-merge mechanics are fully mechanical and repeated on every merge | M1-S12 |
| R9 | Per-ticket spend accounting, early (P1) | Waste cannot be minimized if it cannot be seen; today's accounting is host-scoped and after the fact | M1-S19 |
| R10 | Ceremony tiers as configuration (P1) | Full 11-phase ceremony on small tickets is measurable waste (a two-tier split runs in production) | seam in M1-S13, engine M2-S3 |
| R11 | Brief render-only, same source as the digest (P1) | Every brief rule carried in production exists because LLM assembly once drifted | M1-S6 |
| R12 | Self-describing surface and stable contracts (P1) | Agents learn tools from help text; today the operator carries tool-trap recipes because surfaces drift | cross-cutting, M1-S3 |

## 2. P0, what gates full-speed autonomous delivery

### R1 Merge as a transaction (M1-S4)

Today every merge re-executes a prose checklist: PM finalization (all phases
in pm-notes), head pipeline green for the pushed SHA (API merges bypass
platform merge checks; a zero-job or zero-pipeline head reads vacuously
green), owner-gate scan of ticket and change-folder verdicts, MR open with a
non-empty diff, upstream parity (the `@{u}..` log empty). That is 6 to 10
shell or API calls parsed by an LLM, per merge, every merge.

Requirement: `merge` verifies all gates fresh and either lands (squash,
landing verified) or refuses naming the failed gate with the evidence
inline, so the operator never re-probes to understand a refusal. Two
additions to the outlined story:

- The gate set is data (config-declared, versioned), not hardcoded: repo
  specific gates (workspace test gates, deploy verification) are added
  without code.
- The gate freshness bound must also cover tracker state, not only CI: a
  ticket that moved to an owner-gated state after verification invalidates
  the verification.

### R2 Truthful signals on every engine acted on

Production rule the operator is forced to live by: a collector finding is
evidence, not a verdict, never a merge gate on its own, because cached
platform status lies in both directions. Requirement: artifact-verified
collectors and the tri-state result contract on every engine the fleet acts
on, so that acting on a healthy-path digest requires zero raw API
re-verification. Deploy verification by job trace (M1-S4) is exactly right:
deploy checks are today manual API spelunking, and a pipeline created but
never run must read as unknown, not green.

### R3 Scheduling and waiting leave the operator's context (M1-S17, M1-S18)

Endorsed: daemon, queue, lanes, dispatch; planning runs parallel without
leases; delivery takes a per-repo lease. Requirements from production that
the scheduler must encode:

- Per-repo single-flight is the only structural lane cap. No fixed lane
  count. Capacity, bandwidth, and CI-slot conservation were explicitly
  rejected as lane gates by the operator's owner; an earlier
  bandwidth-conservation default was a defect that had to be reversed.
- Dependency-aware batching: producers before consumers; a producer's
  deploy verified before a dependent repo merges. Cross-repo changes are
  the normal case, not an edge case.
- Closing beats opening: the scheduler prefers finishing in-flight items
  (merge-ready, in-review, parked) over starting new ones. Throughput is
  tickets closed, not started.
- Build-weight classes: at most one heavy native or Docker-in-Docker class
  job at a time on a constrained runner (multi-GB, 20 to 60 minute builds
  contended and flaked each other when co-scheduled); everything else runs
  freely in parallel. This is a resource class, not a lane cap.
- Park and resume for external windows (provider peak pricing, quota
  exhaustion) that resumes exactly when the condition clears. A park that
  outlives its blocking condition is a bug, not a state; one idled a queue
  for hours after a provider freed up.
- The dispatcher is never a lane; the daemon is single-instance enforced and
  crash-safe (unsupervised background trees died with harness restarts until
  moved under a real supervisor); daemon failure degrades to a CLI one-shot
  path, never to a wedged fleet.

### R4 Machine-readable delivery plans: add done-artifacts (M1-S13)

Per-phase file, package, and folder scope makes parallelism computable;
strong endorse. Additionally each phase must declare:

- its done-artifact (MR URL, pipeline id, deployed environment, tracker
  transition) so lane joins verify artifacts, not exit codes;
  exit-0-with-no-artifact is a failed dispatch in the operator's accounting,
  and the operator has been burned by exactly that class;
- the repo leases and weight class it needs, so the scheduler batches
  without an LLM in the loop;
- declared interactions (contract files, generated code) so the scheduler
  orders producers before consumers mechanically.

### R5 Session lifecycle economics (M1-S15)

The single largest token-waste incident class experienced: liveness
watchdogs that cannot distinguish a large session still prefilling or
resuming from a stalled one kill mid-prefill; the runner re-resumes; the
session re-pays its entire prefill; the loop repeats roughly ten times until
a restart budget trips, all while the lane looks busy (rising CPU). The
mitigation today is a 45-minute stuck threshold instead of the 10-minute
default: a workaround, not a fix.

Requirements:

- Progress-based liveness (heartbeat, session traffic, token delta, not CPU
  alone) so prefilling never reads as stalled.
- Resume economics: a resumed session must not re-pay its prefill
  (checkpoint, attach, and continue semantics at the harness adapter level),
  or the restart path must be classified as uneconomical and refused.
- A bounded restart budget that fails loudly with a classified reason,
  instead of silently looping. Silent loops are invisible in lane status and
  visible only in spend.

### R6 Typed blocker and question channel (M1-S16)

Today a PM blocker parks its lane until the next operator iteration notices
it; the answer goes in via a resume prompt that re-enters the full delivery
session (another prefill, another wait). Requirement: blockers publish as
typed questions, `decision-needed` (with options), `spec-ambiguity`,
`credential-missing` (variable name only, never values), `external-wait`,
ranked in the digest, answerable as data; the machinery applies the answer
and resumes the lane. This is the owner-gate SLA mechanism (M1-S5) pointed
at a second audience; built once, two consumers. It converts hours of lane
idle into seconds.

## 3. P1, repeatable tasks that must stop costing LLM tokens

### R7 One digest to bootstrap every session (M1-S10)

The proven pre-ADOS pattern: parallel collectors merged into one ranked,
deduplicated, grouped digest (four red CI findings on mains is one job, not
four); text output for agents (roughly four times smaller than JSON), JSON
for scripts; exit code as the machine signal; partial collection reported
in-band, never silently read as healthy. It replaced minutes of per-system
probing per session and is the highest-leverage attention surface.
Requirements for the M1 expansion: attention-state coverage (lanes
delivering vs idle-with-reason, ready-to-merge as a first-class action list,
parked items with conditions, owner-gate ages, spend), bounded output, and
stable finding codes so the operator acts without re-deriving.

### R8 Closeout as one command (M1-S12)

Post-merge mechanics today are semi-manual and repeated on every merge:
owed-flip sweep of the merged diff (feature-flag and class strings, TODO
markers, when-X-merges notes), MR comment-thread resolution check, tracker
done plus hygiene (unassign the ball, sweep todo-class labels to done-class),
branch and worktree cleanup, retro-coverage registry move, session
compaction. Requirement: `closeout` performs the mechanical sweep and emits
a small judgment residue (unresolved human comment threads, ambiguous flip
hits) instead of the operator grepping diffs with tokens.

### R9 Per-ticket spend accounting, early (M1-S19)

Harness telemetry (tokens by class, calls, per agent and model) lands in the
event log at closeout with the harness adapters. Ship the read side in this
milestone: per-ticket and per-phase spend, plus a resume-amplification
metric (tokens paid vs unique progress). Two of the operator's top three
waste classes are only visible in that number. Waste cannot be minimized
that cannot be measured, and today's accounting is host-scoped and after the
fact.

### R10 Ceremony tiers as configuration (seam M1-S13, engine M2-S3)

A two-tier ceremony split (full 11-phase vs lite) with mandatory escalation
triggers runs in production, adopted because full ceremony on small tickets
was measurable waste. Requirement for this milestone only: do not hardcode
an 11-phase or single-tier assumption into plans, capsules, or phase
transitions; the phase set must be data with per-tier definitions and
escalation triggers. This is also a parallel-delivery seam: which
preparation phases are safely concurrent is a property of the tier.

### R11 Brief render-only, from the same source as the digest (M1-S6)

Render-only with no LLM in the assembly path is exactly right: every rule in
the operator's brief generation procedure exists because LLM assembly once
got it wrong or drifted. One addition: the owner brief and the operator
digest must render from the same collector state (one source of truth), and
the brief carries ready-to-merge, blocker questions, and owner-gate ages as
anchored actions.

### R12 Self-describing surface and stable contracts (cross-cutting, M1-S3)

Help text everywhere, man-page-grade guides, examples. Plus stability:
stable key=value machine summaries (the bash stack's
`result= / pr_url= / exit_code= / last_message=` contract is exactly the
right shape; keep it), stable exit codes, `doctor` for wiring. The operator
currently carries a tool-trap cookbook in persistent memory (CLI flag drift
between installs, API paths that 404, tracker label updates that replace
instead of merge); stable surfaces delete whole categories of that memory
and every re-discovery token.

## 4. P2, valuable, not gating

- Idempotent convergence: reruns never duplicate tickets, comments, or
  commits; a cheap what-is-already-done check per change, so no agent ever
  redoes verified work to be safe.
- Stale-work sweep as a command: open MRs, stray branches, leftover
  worktrees, parked lanes, listed with close or finish recommendations.
  Makes closing-beats-opening mechanical instead of a rule the operator
  enforces.
- Trust-boundary helpers: cheap injection-pattern scanning of untrusted
  content (tracker and PR comments, logs) before an agent reasons over it;
  today this is a prose rule in the operator's contract, that is, enforced
  by LLM discipline.
- Memory hygiene: the change capsule with append-only evidence and
  promotion; retrospectives first-class and append-only.

## 5. Hard constraints from production (violating any of these regresses the operator)

1. Fleet-wedging beats idleness. The queue dispatcher must not go live
   before the exit contracts are proven (roadmap sequencing constraint 1; it
   is earned, not theoretical). Dual-run per engine; bash fallback stays
   reachable; shell authoritative until two clean weeks of verify-change
   evidence on the migrated engine. Sequence the daemon behind the R1, R2,
   R5 truth engines, not in front of them.
2. Gates never weaken during migration. The transactional merge must pass
   the same battery the bash era enforced (roadmap constraint 5).
3. Judgment stays with the operator. Gate verification is mechanical;
   owner-gate classification (never-merge classes, owner-review-first) is
   policy-as-data the operator can inspect, and the override path is a
   recorded waiver, never a hidden decision inside the tool.
4. The merge transaction remains an explicit CEO action. The daemon may
   prepare, verify, and queue merges; it does not fire them until the owner
   chooses to automate that further.
5. Local-first. No hosted dependency for any of the above; the daemon dying
   must degrade to CLI one-shots, not to a dead fleet.
6. Configuration as data. No wizards, no config that needs an LLM.

## 6. What the operator does NOT need (scope discipline)

- No LLM-in-the-loop machinery: brief assembly, digests, summaries, and
  scheduling are deterministic code; operator judgment sits on top of their
  output.
- No dashboards or UI: text digests and JSON are the surfaces.
- No multi-host orchestration yet: one host, one daemon, N lanes (the
  execution-environment seam in the harness adapters is sufficient).
- No new tracker or provider integrations beyond current adapters.

## 7. Acceptance criteria, from the operator's seat

1. The operator's full iteration is: `status` (one bounded digest), answer
   typed questions, `merge <ref>` (lands or refuses with gate and inline
   evidence), `closeout` (mechanics done, judgment residue only), pick
   next. Between iterations zero tokens are spent on waiting, polling,
   scheduling, or re-verification of healthy paths.
2. A lane blocker surfaces in the digest within one collection cycle as a
   typed question; the answer unblocks without re-entering a delivery
   session.
3. No resume-loop class: a killed or restarted session resumes without
   re-paying prefill, or fails loudly within a bounded restart budget; the
   resume-amplification metric reads approximately 1 on the spend report.
4. The operator plans N changes (priorities, repos, dependencies) as one
   artifact; the machinery schedules all repo-disjoint lanes in parallel
   under per-repo single-flight and weight-class constraints, and no
   operator iteration is spent discovering parallelism.
5. Acting on a healthy-path digest requires zero raw API re-verification;
   every refusal names the gate and carries inline evidence.
6. Repeatable ceremonies (closeout sweep, brief render, retro capture) cost
   approximately zero LLM tokens.
7. Per-ticket, per-phase token spend is visible; the operator's top waste
   classes are findable from the spend report alone.

## 8. Evidence appendix (production mechanisms, self-contained)

- 2026-10-11, resume-loop amplification. The default stuck threshold
  (10 minutes) killed a large resumed session mid-prefill; the runner
  re-resumed and re-paid the full prefill roughly ten times to the restart
  cap while the lane showed busy CPU and a running status. Mitigation:
  45-minute thresholds. Root causes: liveness without progress signals;
  restarts without resume economics; a silent loop invisible in lane
  status. Maps to R5, R9.
- 2026-10-16, park outliving its condition. A provider-window park kept a
  queue idle after any candidate freed; the fix made re-checking
  availability continuous and defined a park that outlives its condition as
  a bug class. Maps to R3.
- Heavy-build contention. Two multi-GB native-image builds co-scheduled on
  one runner flaked each other repeatedly until policy limited heavy jobs to
  one at a time. Maps to R3 weight classes.
- Vacuous green and API merge bypass. Merging via API skips platform merge
  checks; a head SHA with zero pipelines reads green; deploy status fields
  lie in both directions (stale caches, never-created jobs). Maps to R1,
  R2.
- Exit-0-with-no-artifact. Dispatch classification trusted exit codes while
  the MR was never opened; lane joins now must verify artifacts. Maps to
  R4.
- Bandwidth conservation rejected. An explicit owner rule after a
  conservation default serialized lanes: capacity, bandwidth, and CI slots
  must never gate lane count; only per-repo single-flight and weight classes
  constrain parallelism. Maps to R3.
- Collector digest win. One parallel merged digest (ranked, deduplicated,
  grouped, roughly 8 seconds, exit code as signal) replaced minutes of
  per-system probing at every session start and after every delivery. Maps
  to R7, M1-S10.
- Ceremony tiering. A two-tier (full and lite) ceremony split with mandatory
  escalation triggers was adopted after full-ceremony small tickets
  measured as waste. Maps to R10.
