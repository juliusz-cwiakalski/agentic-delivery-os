# CHANGE IMPLEMENTATION PLAN: GH-219

Plan milestone M1: delivery engine and autonomous dispatch (roadmap and
backlog redefinition). Specification: chg-GH-219-spec.md (F-1 through F-10,
14 acceptance criteria). This is a planning/docs change; no tooling code,
no story tickets, no decision acceptance, no merge of the planning PR
before owner review.

Delivery mode note: after phase 3, the owner redirected this change to an
interactive CEO-driven session (deliver-ticket dispatch stopped; the
parallel-authored spec and test plan from the dispatch run were reviewed
and retained). The remaining phases execute in the interactive session.

## Phase 1: Milestone boundary and status records (F-1, F-10)

- roadmap.md: milestone table row rewrites (M1 delivery engine, M2
  ceremonies/measurement/memory); M0 exit amendment section (concurrent
  pilot, Proposed records stay Proposed, per-engine handover evidence
  never waived); M1 and M2 section rewrites with goals, scope, sequencing,
  and exit criteria; sequencing constraints 1 (daemon behind truth
  engines), 9 (merge stays explicit), 10 (local-first, no LLM in render
  and scheduling paths).
- status.md: amendment section; next-steps item 3 rewritten (M1 milestone
  and 20 issues after merge; dispatch starts under the recorded gate
  change; M1-S9 still respects the per-repo two-clean-weeks rule).

## Phase 2: Backlog and ranking redefinition (F-2 through F-7)

- backlog.md: cross-cutting principle added (self-describing commands,
  key=value contract continuity); M1 epic rewritten to 20 stories
  (S1-S12 retained and extended, S13-S20 new: plan schema, commit
  primitive, session economics, typed blockers, scheduling engine,
  daemon, spend read side, agent integration); closeout expansion folded
  into M1-S12; M2 epic rescoped (M2-S1 retired with a gap note; M2-S2
  deps M1-S18; M2-S3 tier engine; M2-S4 deps M1-S17; M2-S6 deps M1-S19);
  M3-S7 deps updated; reading guide updated (M1 fully specified).
- backlog-ranking.md: reading notes carry the recorded gate amendment;
  full re-rank (ranks 21-40 for M1; downstream ranks shift; dependency
  columns match the backlog exactly).

## Phase 3: Command registry alignment (F-3, F-8)

- cli-command-registry.md: man-page command families updated; M1 table
  retitled and extended (plan, commit, blockers, queue, lanes, daemon,
  spend; merge and brief rows extended; dispatch row = dual-run to
  per-repo handover); M2 table reduced (supervise, ceremony, steer,
  metrics); strangler mapping rewritten so each of the four bash scripts
  names its successor capability and parity point; naming-audit note for
  the provisional M1 family names (ODR-0003 superseding note at
  delivery); plain-language notes (watchdog/daemon/supervise split,
  blockers, plan).

## Phase 4: Operator requirements input (F-9)

- operator-requirements-2026-11.md: sanitized copy of the operator draft
  (production delivery operator voice; no private names, fleet names, or
  repo names; R1-R12 mapped to the new story codes; hard constraints;
  acceptance criteria; dated evidence appendix); README.md indexes the
  new document plus status.md.

## Phase 5: Cross-file consistency (F-2, F-3, F-8)

- user-journeys.md: all milestone attributions updated to the new story
  codes (single-change loop, support steps, fleet cycle, dependency
  planning, iterative order).
- doc/spec/features/feature-status-digest.md and the living concept docs
  (parallel-delivery, containerized-delivery, policy-as-code): queue/lane
  story references moved from the retired M2-S1 to M1-S17. Historical
  records (inception workspace snapshots, prior change folders, planning
  review notes) intentionally untouched.

## Quality gates

- Privacy: whole-file corpus scan over every changed file (zero hits);
  zero em-dashes added; no private references in any committed content.
- Consistency: backlog story set equals the ranking story set (M1-S1
  through M1-S20); dependency columns match file to file; dependency
  graph acyclic (scripted check); explanatory-only mentions of the
  retired M2-S1 code.
- Repo guards: doc distribution guard and inception doc-set consistency
  guard pass; remaining CI jobs validate on the PR.

## Explicitly out of scope

- Creating the M1 milestone or story issues (follow-up change after
  merge).
- Accepting any Proposed decision record (owner formalization).
- Any tooling implementation (the stories planned here deliver it).
- Merging this PR without owner review (explicit owner gate).

## Phase 6: Code Review Remediation (Iteration 1)

- [x] Resolve the contradictory M0-to-M1 gate statement in status.md (F-1).
- [x] Make truth and transaction prerequisites explicit in the M1-S17/S18 dependency graph and mirror them in ranking (F-2).
- [x] Add owner-gate classification and recorded waiver tasks and AC to M1-S4 and align registry (F-3).
- [x] Remove em dashes from newly added registry rows and check the full added-line diff (F-4).
- [x] Attribute M1-S13 plan lint and M1-S14 phase completion in registry Extended columns (F-5).
- [x] Reconcile the 13 Proposed records count and the status next-steps subset (F-6).

## Phase 7: Milestone outcome packs (owner-requested scope addition)

- [x] milestones/README.md: pack conventions (contents per milestone,
  binary-name placeholder, planned-vs-delivered semantics, C4 levels as
  flowcharts, no-private-content rule) and the index.
- [x] milestones/m0/architecture.md: M0 backfill (C4 context and
  containers of the delivered trust substrate; engines beside the
  authoritative bash stack; what M0 deliberately is not).
- [x] milestones/m1/architecture.md: M1 planned end state (C4 context,
  containers, components grouped into attention, truth and transaction,
  planning, scheduling, execution, and learning planes; coordinator
  iteration, parallel-planning, and blocker round-trip flows; boundary
  invariants).
- [x] milestones/m1/journeys.md: journeys delivered at M1 end (J1
  coordinator iteration, J2 batch planning, J3 lane under the daemon, J4
  owner day, J5 blocker round-trip, J6 degraded and fallback regimes, J7
  learning at the change boundary) each with no-token guarantees and
  story maps; explicit what-does-not-change list.
- [x] milestones/m1/man-page.md: the command surface available after M1
  (families, usage lines, delivery attribution, global options, exit
  status).
- [x] milestones/m1/contracts.md: shared contracts (envelope, exit codes,
  key=value continuity, tri-state evidence, finding codes) plus per-
  command proposed contracts: inputs, outputs, error codes, examples,
  test scenarios.
- [x] Registration and links: forbidden-literals registry entries for the
  six new docs; planning README index row; roadmap pointer.

## Phase 8: Interaction examples and daemon communication (owner review feedback)

- [x] milestones/m1/interactions.md: eight exact example sessions
  (coordinator iteration, batch planning, lane lifecycle, daemon
  lifecycle and degradation, parks and weight classes, spend and
  doctor, handover day, machine output) with concrete inputs and
  realistic proposed outputs.
- [x] m1/architecture.md: daemon communication section (state-mediated
  truth, control socket as optimization, writer-ownership table,
  daemon-down fallback matrix, wake model) ahead of the boundary
  invariants.
- [x] contracts.md: daemon entry extended with the communication
  contract and degraded-mode errors; queue and blockers entries note
  intent-write plus socket-notify semantics; status gains --watch with
  declared degraded fallback.
- [x] man-page.md: daemon start --foreground and status --live; status
  --watch.
- [x] backlog.md M1-S18 tasks and AC carry the command-to-daemon
  communication contract (socket as optimization, state-only fallback
  for every interaction, fence-token writer ownership, reconcile on
  start); registry daemon row extended.

## Phase 9: Control protocol v1 (owner review question)

- [x] m1/architecture.md: control protocol v1 section under daemon
  communication: transport (unix socket, named pipe on Windows,
  filesystem authorization), NDJSON frames with kinds and correlation,
  versioning (n and n-1), the no-business-truth rule, four interaction
  classes (poke, query, subscribe with overflow-degrades-subscriber,
  control under fence tokens), secrets rule, and illustrative frames.
- [x] contracts.md: daemon entry carries the protocol summary and the
  new error codes (protocol.unsupported, socket-unreachable with the
  state-fallback note, subscriber-degraded).
- [x] backlog M1-S18 tasks pin the wire contract as a deliverable.

## Phase 10: Transport layering and concurrency model (owner review feedback)

- [x] m1/architecture.md: transport layering section (codec, session,
  transport as separate layers; config-selected transport; stdio
  conformance as the transport-independence proof; remote and
  container-attached transports reuse the protocol plus one additive
  intent frame class and a handshake identity claim; remote off by
  default, M4-S6 connection point) and concurrency model section
  (connection per invocation with connection-scoped response routing,
  single event loop, state-layer serialization with idempotency keys,
  one daemon per state dir scope, bounded waits that degrade).
- [x] contracts.md daemon entry: transport layering and concurrency
  summary lines.
- [x] backlog M1-S18 tasks and AC: stdio conformance proof, no-crosstalk
  and at-most-once concurrency acceptance criteria.

## Phase 11: Persistence and recovery model (owner review feedback)

- [x] m1/architecture.md: persistence and recovery section: state-layer-
  only truth (queue shape, lanes, leases, parks, counters, budgets
  durable), `daemon install` user-level auto-start unit (linger, login,
  optional, local-first-neutral), bounded idempotent startup
  reconciliation with lane classification (alive, interrupted, crashed)
  and durable budget enforcement ending in a terminal failed state plus
  a typed question (never silent requeue); recovery flowchart.
- [x] contracts.md and man-page.md: daemon install/uninstall subcommands;
  startup reconciliation report and exhaustion surfacing in outputs.
- [x] interactions.md Session D: login-restart example with dead-lane
  classification and the budget-exhausted typed question.
- [x] backlog M1-S18 tasks/AC: durable persistence, install, startup
  reconciliation; M1-S15 AC: exhaustion escalates to queue-failed plus
  typed question, durable across daemon restarts.

## Phase 12: Test scenarios as the API prototype (owner review request)

- [x] m1/test-scenarios.md: 20 behavior-organized scenarios (SC-M1-01
  through SC-M1-20) across truth and transaction, plans and scheduling,
  execution and lifecycle, communication and contracts; each with
  Given, exact When invocation, observable Then (text keys, envelope
  fields, side effects), and machine Assert; shared refusal-semantics
  pin (result=refused, exit 1, never exit 0 or 2); coverage map to
  stories; status semantics: seed for owning story test plans,
  reconciled at delivery, divergence is a defect.
- [x] m1/journeys.md: compact command-sequence blocks added to J1
  through J7 so each journey reads directly into its commands.
- [x] contracts.md: shared refusal-semantics pin and a cross-link to
  the scenario file.
- [x] Registered test-scenarios.md in the literal corpus; README
  contents row and index updated.

## Phase 13: Per-command reference pages (owner review request)

- [x] m1/commands/: 26 one-per-command reference pages (board, brief,
  closeout, commit, config, daemon, db, dispatch, doctor, lanes, lint,
  mcp, merge, phase, plan, provider, queue incl. queue ready, retro,
  spend, state, status, verify change, verify deploy, verify gates,
  watchdog), each with NAME, status, SYNOPSIS, DESCRIPTION, OPTIONS,
  OUTPUT shape, EXIT STATUS, EXAMPLES including a pretty `--json`
  envelope (and a minified script-context example where instructive),
  ERRORS from the error table, and SEE ALSO links.
- [x] Output formatting pinned: `--pretty[=auto|always|never]`, default
  auto (interactive terminal -> indented; piped or scripted -> one
  minified line, agent- and NDJSON-friendly); streams stay
  line-delimited in every mode. Recorded in the man page global
  options and the contracts shared pins.
- [x] Registered all 26 pages in the literal corpus; README contents
  row.

## Phase 14: Owner feedback round 1 (profiles, watching, audit, auto-commit,
output trim)

- [x] backlog: M1-S14 default-on auto-commit (--no-commit, config
  disable); new M1-S21 model profiles and provider watching (tier
  structure, per-agent overrides, consequence-times-reasoning-divided-
  by-volume heuristics as data, hard capability gates, eligibility
  chain with lazy probes, first-iteration providers: coding-plan
  subscription quota endpoints, DeepSeek balance, OpenAI subscription
  windows; switch-not-park with revert; pacing rungs as config moving
  only non-judgment seats; spawn wrapper emitting validated data
  records; legacy resolver semantics ported with its test battery);
  new M1-S22 command audit ledger and agent identity (agent-name env
  convention from the opencode plugin PoC; context fields recorded so
  scripted outputs trim them). M1 grows to 22 stories.
- [x] ranking: S22 inserted early (rank 23), S21 after harness adapters
  (rank 34); downstream ranks shifted.
- [x] contracts and man page: agent-mode trim pinned (scripted --json
  emits one minified {"data":...} or {"error":...} line; schemaVersion,
  runId, timing live in the audit ledger; --verbose restores the full
  envelope; TTY keeps full pretty); provider profile resolve and watch
  status added; --verbose global option.
- [x] command pages: provider gains profile/watch sections with
  examples; commit and phase default-on with --no-commit; all scripted
  examples converted to the trimmed form.
- [x] architecture: profiles and watching in the execution plane,
  audit ledger in the learning plane (L2 and L3); journeys J3 notes
  profile resolution on spawn; interactions Session E shows switch-
  instead-of-park resolution.
- [x] test scenarios: SC-M1-21 (eligibility, vision hard gate, revert),
  SC-M1-22 (park on windows, switch on exhaustion), SC-M1-23 (audit
  record, trimmed output, identity capture); SC-M1-12 updated for the
  default; coverage map extended.

## Revision log

- 2026-11-03: Added Phase 6 for code review iteration 1 remediation.
