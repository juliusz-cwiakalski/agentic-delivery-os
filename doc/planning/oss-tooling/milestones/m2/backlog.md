---
# Copyright (c) 2025-2026 Juliusz Ćwiąkalski (https://www.cwiakalski.com | https://www.linkedin.com/in/juliusz-cwiakalski/ | https://x.com/cwiakalski)
# Apache-2.0 License - see LICENSE file for full terms
source: https://github.com/juliusz-cwiakalski/agentic-delivery-os/blob/main-tools/doc/planning/oss-tooling/backlog.md
---
# M2 — Ceremonies, measurement, and memory backlog

Moved from `doc/planning/oss-tooling/backlog.md` (per-milestone split, 2026-11-17).

## Epic M2: Ceremonies, measurement, and memory (months 3-6)

Note: the M1 redefinition moved the queue, lanes, and dispatch core (the
former M2-S1) into M1; its content is delivered by M1-S17 (scheduling
engine) and M1-S18 (resident dispatch daemon). The M2-S1 code is retired;
the gap is deliberate. M2 stories keep their codes.

The M2 stories below read on three levels. A repository is one git
checkout and stays the delivery unit; a project is a named group of
repositories whose membership is declared in configuration, so membership is
configuration-only; a workspace is an optional persisted directory usable as
a discovery root, and it is never required. The delivered flat record set is
the shipped `projects list` surface (`projects.v1`), and the rename rule
records the prospective split: from M2-S18 `projects list` enumerates groups
and `repos list` enumerates that flat record set, with the deprecation alias
`projects list --flat` returning the delivered payload until the M3 boundary.
Entrypoint consequence: both become root families, the root-family
consequence of the split, so the root listing meets the repository family and
the project family separately.

### M2-S2 Supervise
- Ticket: GH-295 (milestone M2)
- Goal: A supervisor battery with artifact-evidence liveness so stuck or lying deliveries are detected and acted on, not just observed, running over the M1 daemon's lanes.
- Tasks: supervisor battery: tri-state status, progress watchdogs,
  duplicate-supervisor detection, lying-liveness signals by artifact
  evidence, restart policies over the resident dispatch daemon.
- AC: a stuck supervisor is detected by artifact evidence, not process
  state.
- Depends on: M1-S1, M1-S18.
- Progress: delivered by GH-295 on `feat/GH-295/supervise` (M2-S2 complete; the
  operator-facing `supervise` battery with the `delivery.supervision.v1` report,
  the artifact-only tri-state fold (progressing/stalled/unknown with the
  delivered corroboration bound and prefill-safe rule), lying-liveness detection
  for lanes and supervision claims, the supervised-stall park with the
  `liveness-stall` cause, mapped condition, non-null `until` and the additive
  lane read, restart composition over the delivered economics with terminal
  exhaustion plus one typed question, the per-action duplicate-supervision
  refusal and per-ref single-flight reuse, two exact error identities, and the
  25th prompt-required family).

### M2-S3 Ceremony runner
- Ticket: GH-296 (milestone M2)
- Goal: Ceremonies become declared, deterministic units, cutting ceremony share of active agent time toward 40 percent and making catch-up automatic.
- Tasks: reduce ceremony share; compact at boundaries; tiered intake. A
  ceremony is a declared unit (schedule, inputs from collectors, render,
  verification, catch-up semantics), not hardcoded logic. The built-in
  set: morning brief, retro evidence pass, sprint rollover, night-watch,
  testing-session assessment (owner note to item-by-item assessment with a
  coverage verdict per item), and decision-record mirror sync to affected
  repos before a new ticket dispatches there. Projects declare their own
  ceremonies through the same contract (custom ceremony packs later). The
  ceremony tier engine lands here: per-tier phase sets and escalation
  triggers as data, consuming the tier declared in M1-S13 plans.
- AC: ceremony share measured before and after; trend toward 40 percent;
  every built-in ceremony is parity-testable; a project-declared ceremony
  runs through the same runner without tooling changes; retro ceremonies
  follow concepts/retrospectives.md - declared trigger model,
  follow-through-first agenda, the fixed note schema, idempotent scope
  keys, and per-level outputs.
- Depends on: M0-S6, M0-S13, M1-S8.
- Progress: delivered by GH-296 — the four-verb ceremony family and the
  declaration contract; the six built-ins parity-tested through one runner; the
  runner's intake, artifact-verified agenda, compaction, resume, and bounded
  catch-up; project declarations in the committed document; the single-source
  tier engine; the additive run/step records and artifact family; the four
  sub-R1 retro levels; and the committed ceremony-share comparison with the
  native basis disclosed. No metrics surface, action registry, ceremony pack,
  scheduler, event topic, or MCP tool ships here.

### M2-S10 Retro action registry and follow-through
- Ticket: GH-287 (milestone M2)
- Goal: The retro action registry with the five-field contract and artifact closure, so retrospectives produce verified follow-through, not lists.
- Tasks: the action registry behind every retro level: five-field
  contract (owner, verifiable verb, measurable outcome, tracker entry,
  due date) plus verification artifact; aging nudges and escalation;
  explicit closure rules (done with artifact, deprioritized with
  reason, superseded); board surface next to owner asks; improvement
  WIP limit per window (concepts/retrospectives.md; tracker anchor
  issue #43); communication analytics (unanswered asks, aging,
  escalation rates) join the evidence inputs once the message contract
  exists (concepts/inter-agent-communication.md).
- AC: an action without all five fields cannot be filed; every R4+
  retro opens with artifact-verified follow-through; aging is visible
  on the board; no action closes without an explicit decision and
  artifact or reason; actions carry outcome verifiers (delayed metric
  windows) and rollback conditions, and closure distinguishes artifact
  closure from outcome closure.
- Depends on: M1-S8.
- Progress: delivered by GH-287 on `feat/GH-287/retro-action-registry` (M2-S10
  complete; the action registry owns its own validated boundary with the two
  additive record kinds, the five-field filing gate, derived aging, explicit
  two-plane closure, the fixed WIP limit of three, the board `ACTIONS` surface,
  and the follow-through producers behind the ceremony pass and the report fold;
  the delivered retro-registry exactly-three declaration is unchanged).

### M2-S4 Board
- Ticket: GH-297 (milestone M2)
- Goal: The fleet on one screen sharing one state source with brief and status, so coordination stops re-deriving the world.
- Tasks: full board of lanes, gates, owner asks, parked work; one screen
  sharing the brief and status state source.
- AC: board, brief, and status share one state source.
- Depends on: M1-S5, M1-S17, M2-S11, M2-S18.
- Progress: delivered by GH-297 on `feat/GH-297/board` (M2-S4 complete; the
  four-section board shares `delivery.status-facts.v1` with brief and status,
  spans managed repositories under the 128 cap, and is mounted as the 21st
  prompt-required family).

### M2-S5 Steer
- Ticket: GH-298 (milestone M2)
- Goal: The owner can change the course of a running delivery without killing the session: steering notes queue up, land at the next phase boundary, and carry receipts, so course corrections are safe and auditable.
- Tasks: owner briefs, escalation, resequencing heuristics with measured
  aging; queued steering notes delivered at phase boundaries. Steer is
  the first message type of a typed message contract (origin block,
  receipt, TTL, artifact-ref completion), not a bespoke owner-note
  channel; agent-to-agent messaging extends the same contract later
  (concepts/inter-agent-communication.md).
- AC: owner asks are batched with drawn defaults and measured aging; a
  steering note carries origin, a read receipt, and TTL; the message
  record schema is shared, not owner-specific.
- Depends on: M0-S10, M1-S11.
- Progress: delivered by GH-298 on `feat/GH-298/steer` (M2-S5 complete; the
  shared typed message record, the boundary read point with receipts and TTL
  expiry, the drawn-default asks join, artifact-ref completion, the
  registered-value guard, three exact error identities, and the 23rd
  prompt-required family).

### M2-S6 Metrics and spend
- Ticket: GH-299 (milestone M2)
- Goal: Delivery metrics and spend from the event log with alarms, so success claims and cost drift are measurable, not anecdotal.
- Tasks: ceremony share, per-dispatch tokens/cost/restarts, cycle time, CI
  failure rate, escaped defects; burn-rate alarms. Builds on the historical spend read side delivered in M1-S19; this story adds the alarm and
  metric layers.
  Consumes M2-S14 telemetry for per-agent and per-model facts.
- AC: exit criteria measurable with committed numbers.
- Depends on: M1-S19, M2-S3, M2-S14.
- Progress: delivered by GH-299 — the `metrics` read-side family under
  `delivery.metrics.v1` (the four metric entries with basis, measurement kind,
  window, and sample; the per-dispatch spend block composed from the delivered
  `spend` fold; burn-rate alarms against the project-committed
  `metrics.burn-rate` node; the live comparison view under the committed
  protocol), the bounded committed corpus scan for CI-proxy and curated
  escaped-defect evidence, the one `metrics.baseline-unreadable` identity
  (147/146/63/+113 with four-way agreement), and the 24th prompt-required
  mount with its M2 reference page.

### M2-S7 Suite-to-job mapping in gates
- Ticket: GH-300 (milestone M2)
- Goal: Local gates must cite the same suite breadth as CI, so a narrow local suite cannot masquerade as full green.
- Tasks: local gates must cite the same suite breadth as CI.
- AC: a narrower local suite cannot masquerade as full green.
- Depends on: M0-S9.
- Progress: delivered by GH-300 — the versioned `verify.suite-map` declaration
  in the project-committed configuration document, the additive
  `data.suiteBreadth`/`data.mirrorsJob` fields on both report types, the
  `verify.narrowed-scope` refusal (exit 1, `detail.suiteBreadth`, pinned header,
  no record and no capsule event), the bounded single-document map read shared
  by the CLI and the shipped MCP `gate-report` composition, and this
  repository's own reference declaration resolving to equality end-to-end.

### M2-S8 Memory records, layout, and lint
- Ticket: GH-301 (milestone M2)
- Progress: delivered by GH-301 — the canonical memory tree (index, lessons,
  tacit fragments, preferences, guild trees, and the retro archive with its
  index), one published record schema shared by the index, the promotion
  writer, and the capsule projection, eight lint areas wired into the aggregate
  gate and CI (schema, dating, provenance, references, both-direction index
  coverage over two universes, budgets, advisory derivable heuristics, and
  privacy-vocabulary secret findings), with the sanctioned negative-guard
  replacement.
- Goal: The committed memory tree with typed records and lint, so project memory is one canonical, budgeted, reference-checked store.
- Tasks: the committed memory tree (.ai/memory: index README, lessons,
  tacit fragments, preferences, per-agent entry points, guild trees,
  retro archive)
  with one typed record per file (id, kind, scope, provenance, trust,
  validity, status; concepts/memory-architecture.md); memory lint in the
  quality gates: schema, dating, provenance, dangling references, index
  coverage, budget caps (kernel ~200 lines, index ~200 lines, agent
  entry ~150 lines), derivable-content heuristics, secret patterns.
- AC: lint fails on a record missing id/date/evidence, on an index line
  without a backing record and vice versa, and on budget violations;
  concurrent agents creating records produce zero merge conflicts.
- Depends on: M1-S12.

### M2-S9 Memory conventions in bootstrap templates
- Ticket: GH-302 (milestone M2)
- Progress: delivered by GH-302 — the memory tree scaffold (index, one
  entry-point README per resident agent role, lessons, tacit — seeded empty),
  the AGENTS.md memory kernel section with all twelve content classes and no
  record-schema fields, the coordinator capture/promotion wiring and the
  companion per-role expectations in the installed instruction files, the
  retro-note conventions (append-only notes with a generated index), the
  manual doctor checklist (documentation only; the memory invariant is a
  repository check, not an installed artifact), the
  manual adoption checklist for previously bootstrapped projects, the
  `.ai/memory/**` write-allowlist extension stated identically across the
  bootstrapper prompt, the inception guide, and SPEC-BOOTSTRAPPER, Phase 6
  readiness fail-and-reopen for incomplete memory artifacts, and PDR-0004
  keeping the meta-learning reference repo-internal with self-contained
  installed conventions.
- Goal: Memory conventions wired into bootstrap templates so new projects start with the learning loop in place.
- Tasks: adoption checklist into the bootstrap flow and templates:
  memory tree scaffold, AGENTS.md kernel section, per-agent entry
  points, capture bar and promotion rules in the coordinator
  instructions and the retro ceremony, append-only retro notes with a
  generated index and a meta-learning file (concepts/
  memory-practices.md).
- AC: a newly bootstrapped project starts with the memory layout, the
  kernel section, and the capture/promotion rules wired into its
  ceremonies; the doctor runs as a manual checklist until tooling
  lands.
- Depends on: M2-S8.

### M2-S11 Multi-repository workstations
- Ticket: GH-288 (milestone M2)
- Progress: delivered by GH-288 — the two-layer state scope (host root plus a
  per-repository project root), the checkout identity marker with its minted
  project key, the derived host index with bounded maintenance and the
  collision guard, the read-only `projects list [--json]` overview, the
  one-step migration guide, and the host-wide owner hold preserved.
- Goal: Multiple delivery-managed repositories on one workstation are
  first-class: state is scoped per repository so same-ref collisions are
  impossible, and the GH-288 read-only overview gives one CLI view of every
  managed checkout.
- Tasks: per-repository state scoping derived from the checkout identity
  (git common dir marker) with a host-level index; the delivered flat record
  set reporting repo key, root, state location, daemon reachability, handover
  state;
  migration note for existing single-store users; tests proving two checkouts
  using the same ref cannot observe each other's documents. Transition note:
  the shipped `projects list` surface is the delivered flat record set; from
  M2-S18 the rename rule moves that enumeration to `repos list`, `projects
  list` enumerates groups, and the deprecation alias is `projects list --flat`;
  M2-S18 is the single owner of that rename, the alias, and the field renames.
- AC: two checkouts of different repositories on one host, both using ref
  GH-241, hold disjoint phase state and queue entries; `projects list`
  enumerates them without manual configuration.
- Depends on: M0-S5, M1-S17.

### M2-S12 Evidence inspection and divergence resolution
- Ticket: GH-289 (milestone M2)
- Progress: delivered by GH-289 — the `dispatch attempts [--ref <ref>]
  [--limit <n>]` read side with its `attempts.v1` envelope (sixteen-field
  projection, total order, ledger/page/human bounds, repository-scoped
  isolation with count-only foreign disclosure, empty history as success), the
  local-evidence resolve result with `mode`, `repository`, and the divergence
  block, the single shared exact repository-scoped divergence count with
  `idsTruncated` behind the resolve and summary blocks, the bounded digest with
  its coverage/floor pointer, and the fifth `dispatch attempts` help entry with
  the M2 reference page registered.
- Goal: The dual-run evidence ledger is inspectable and actionable from the
  CLI, so handover decisions and retros rest on readable evidence, not file
  spelunking.
- Tasks: `dispatch attempts [--ref] [--limit]` read side (token, corroboration
  triple, divergence refs, timestamps, harness); operational divergence
  resolution flow (`dual-run resolve`) including resolution from
  local evidence when live truth reads are unavailable; coverage and floor
  reporting remains as exposed by the summary.
- AC: attempt history for a repository is retrievable as a machine envelope; a
  recorded divergence can be resolved with a note and leaves unresolved
  counts; resolve works when tracker truth is unreachable
  (local-evidence mode) with the mode declared.
- Depends on: M1-S9.

### M2-S13 Public event taxonomy
- Ticket: GH-290 (milestone M2)
- Progress: delivered by GH-290 — event taxonomy v1 over six topics (the two
  delivered snapshot topics plus `queue.graph`, `dispatch.attempt`,
  `phase.state`, and `blockers.state`), the eight-field event envelope with a
  per-`(topic, lane)` process-scoped sequence, the additive
  `overflow: "repoll"`/`taxonomyVersion` stamps on every degraded frame, the
  unknown-topic refusal, the generated `events list` / `events describe`
  reference surface mounted as a prompt-required family, and per-topic contract
  tests over both the surface and the daemon-emitted frames.
- Goal: The daemon subscribe surface carries a versioned, documented event
  taxonomy covering delivery state changes, so any client (watch commands,
  scripts) consumes one contract.
- Tasks: extend topics beyond status/lanes to queue.graph, dispatch.attempt,
  phase.state, blockers.state; document event kinds, payloads,
  ordering guarantees, and the slow-consumer overflow-to-repoll rule as a
  public versioned contract; contract tests per topic.
- AC: a client subscribed to queue.graph
  observes entry and dependency changes it can act on; the taxonomy document
  version is pinned by tests;
  overflow degrade behavior is preserved for every topic.
- Depends on: M1-S18.

### M2-S14 Harness telemetry v2
- Ticket: GH-291 (milestone M2)
- Progress: delivered by GH-291 — per-step ingest of the opencode v2.x.y stream
  with per-step model cost and five token classes, five-dimension attribution
  joined from session economics and command-audit identity, phase/stall/restart
  timing, schema-versioned additive step and baseline storage with re-read
  migration, the spend v2 breakdowns and timing summaries with the declared
  `0.02` reconciliation tolerance, retro and brief citation of the same
  figures, and classified telemetry absence rather than zeros.
- Goal: Token, cost, and timing telemetry captured per ticket, repository,
  lane, agent role, and model from the opencode v2.x.y stream, so spend,
  metrics, and retro state facts instead of estimates.
- Tasks: ingest per-step cost/tokens from the harness JSONL stream (opencode
  v2.x.y step frames), attributed through session economics and
  command-audit identity (M1-S15, M1-S22); phase-transition, stall, and
  restart timing; schema-versioned local event storage; extend the spend read
  side with breakdowns per ticket/repo/lane/agent/model plus timing summaries;
  expose the summaries to the retro evidence pass and the morning brief.
- AC: for a completed delivery, spend reports
  tokens and cost per agent role and model with phase timings, reconciling
  with harness-reported session totals within a declared tolerance;
  the retro evidence pass and brief cite these numbers; telemetry absence
  remains a classified outcome.
- Depends on: M1-S11, M1-S15, M1-S19, M1-S22.

### M2-S15 Queue lifecycle completion
- Ticket: GH-292 (milestone M2)
- Progress: delivered by GH-292 — reason-bearing `queue remove` with the
  closed `landed`/`abandoned`/`superseded`/`reconciled` vocabulary and the
  append-position presence rule over the append-only `queue.removal` record
  (no record deleted, a re-declaration restores the entry); automatic `landed`
  removal inside `closeout --apply` through the fail-open non-step
  `queueRemoval` block after the closeout writes; the explicit
  `queue dep add`/`queue dep remove` grammar over the preserved two-positional
  add (`removed` joins the dependency result vocabulary, an absent edge is a
  `noop`); per-ref single-flight admission — the dispatch family refuses any
  live same-ref lease regardless of holder with `queue.single-flight` naming
  the holder at the failure-envelope root (`detail.holder`), `queue claim`
  keeps the own-holder same-ref renewal with renewal narrowed to one
  (repository, ref, holder), and any other-ref live lease refuses the
  delivered `queue.lease-conflict`; `queue reconcile` against tracker delivery
  state, bounded at 100 examined entries and fail-closed on unreadable truth;
  and the `queue.graph` `remove` kind emitted with exactly `ref`, `reason`,
  `recordedAt`.
- Goal: Queue hygiene is complete: entries leave the queue when their
  work lands or is abandoned, dependencies are manageable, and one ref
  cannot run twice at once regardless of entry path.
- Tasks: entry removal/release with reasons;
  automatic release on merge and closeout; dependency edge add/remove;
  single-flight per ref enforced across dispatch paths (evidence: during
  dual-running a lane observed a second concurrent session on one ref);
  reconciliation of stale entries against tracker truth.
- AC: after a squash merge and closeout,
  the ref's queue entry is gone without manual action; a second dispatch
  against a ref with an active lane is
  refused with a classified error naming the holder; stale entries are
  reconcilable without editing state files.
- Depends on: M1-S9, M1-S17, M1-S18, M2-S13.

### M2-S16 Engine-first delivery operations
- Ticket: GH-293 (milestone M2)
- Goal: Day-to-day delivery of this repository runs primarily through the
  typed engine with the shell stack as documented fallback, accumulating the
  evidence the handover gate requires.
- Tasks: operate dispatch through the engine for regular delivery;
  provider windows and holds as engine-visible data (building on the
  pre-iteration hold hook and lane economics);
  periodic handover-gate evaluation on accrued evidence per repository with
  the shell path kept green; deprecation pointers from shell entry points
  toward the engine once a repository flips.
- AC: consecutive engine dispatches with corroborated outcomes accrue in the
  summary; handover evaluation reports per-condition status;
  the shell path remains usable and documented throughout; any flip is
  per-repository and reversible.
- Depends on: M1-S9, M1-S18, M1-S21, M2-S12, M2-S13, and the owner-hold hook change (#280).
- Progress: GH-293 delivered the engine-first evaluation surfaces: the summary's
  `cleanDispatches` / `consecutiveCleanDispatches` / `conditions`, the handover
  data's four ordered conditions plus `reversible` with the declared
  evidence-read-free revert noop, the read-time per-repository `handoverGate` on
  `repos list` bound to the row's own identity at the declared `production`
  scope, the production merge composition restored to real reads with
  error-table-derived classification, and the shell stack unchanged and
  documented as the fallback. No repository was flipped.

### M2-S17 Provider-aware peak pausing
- Ticket: GH-294 (milestone M2)
- Progress: delivered by GH-294 — every delivery nominates its provider profile
  at dispatch admission (recorded on the lane and attempt records with the
  classified no-nomination refusal reusing the resolve identities); peak-window
  rules as versioned per-profile data (windows, multipliers, buffers,
  graceSeconds with a bound derived from the smallest declared buffer); the
  daemon's window watch parks every in-flight lane of the opening profile with
  a bounded-grace stop, reason `peak-window`, `until` at the effective end, and
  the `preserved | session-state-not-preserved` classification; automatic
  window-end resume (session resume path for preserved lanes, delivered
  interrupted-lane recovery for the rest, owner-hold precedence intact);
  taxonomy v2 carrying stop/parked/resumed/park-edge with v1 byte-identical;
  the window-scoped zero-spend reading over the telemetry v2 join with
  classified absence; status and brief park fields; and the declared
  daemon-absent degradation (`iteration-start-gating`, `parkClaimed: false`)
  in the lanes machine read.
- Goal: Peak-hour cost control is enforced per provider profile: in-flight
  sessions whose nominated provider enters a peak window are stopped and later
  resumed, while deliveries on other providers continue untouched.
- Tasks: every delivery nominates its provider profile at dispatch admission
  (recorded on the lane and attempt records, building on M1-S21 profiles and
  M1-S22 identity); peak-window rules as data per provider profile (windows,
  multipliers, buffers); the resident daemon watches profile windows and parks
  in-flight lanes whose profile enters peak (bounded-grace stop, session state
  preserved, park reason recorded);
  automatic resume from preserved session state when the window ends
  (same branch, session resume path, never re-dispatch from scratch);
  zero-spend assertion through telemetry (M2-S14): no model calls bill
  on a parked profile during its window; daemon-absent degrades to the
  existing iteration-start gating, documented.
- AC:
  1. A dispatch records its nominated provider profile; the nomination is visible on lane and attempt records.
  2. When a peak window starts for profile P, every in-flight lane using P is stopped with bounded grace, marked parked with reason `peak-window` and the window end, and stays parked until it ends.
  3. Lanes using other providers are unaffected during a P peak window and keep running.
  4. When the window ends, parked lanes resume automatically from preserved session state; no branch, artifact, or queue state is lost or duplicated.
  5. Telemetry proves zero billable model calls on profile P during its peak window for parked lanes.
  6. Stop, park, and resume are auditable ledger events surfaced in status and brief.
  7. Works with the daemon resident; without it, behavior degrades to iteration-start gating with the difference declared.
- Depends on: M1-S15, M1-S18, M1-S21, M1-S22, M2-S14, and the owner-hold semantics (#280).

### M2-S18 Project groups
- Ticket: GH-309 (milestone M2)
- Progress: delivered by GH-309 — the project configuration document declaring
  member repositories (mixed tracker kinds accepted, `not-yet-supported`
  mandatory for an unimplemented kind) with classified load-time validation
  (`projects.config-invalid`, `projects.unknown-group`,
  `projects.scope-unavailable`); configuration-only membership with an optional
  `workspaceRoot` that only locates declared members and never admits an
  undeclared clone; the `project-groups.v1` group surface (`projects list`)
  with member health and state; group-scoped `queue list --project <groupKey>`
  and `status --project <groupKey>` reads over per-checkout state with one
  classified partial result and no group-scoped store; the flat record set
  moved to `repos list` under `repos.v1` with the three `repos.*` identities;
  the `projects list --flat` byte-compat alias returning the delivered
  `projects.v1` payload until the M3 boundary; the `repos` root listing mount
  with its help entry and reference page; and the naming boundary stated across
  help, reference pages, and the migration guide, lawful under the superseding
  decision record ODR-0004.
- Goal: A project is a configured group of repositories that belong together,
  so the tooling can enumerate groups with their members and scope delivery
  views per project, with a workspace directory usable as an optional
  discovery root.
- Tasks: project configuration declaring member repositories, with any
  tracker adapter and mixed trackers remaining valid configuration even if
  only GitHub is exercised initially; an optional workspace-directory
  discovery root: register a directory, scan for managed clones inside, and
  never require it; `projects list` rendering groups with member repositories,
  their health, and their state; project scoping for queue and status reads;
  the naming boundary documented, where `repos` is the flat record set and
  `projects` describes groups. Derived tasks: (a) the rename — from M2-S18,
  `projects list` enumerates groups and `repos list` enumerates the flat
  record set; (b) the alias — `projects list --flat` returns the delivered
  `projects.v1` payload (`data.projects[]`, `projectKey`, `hostIndexRevision`),
  owned by M2-S18 and retired at the M3 boundary; (c) the field renames
  `projectKey → repoKey` and `data.projects[] → data.repos[]` on the flat
  surface; (d) the update of
  `doc/guides/migrating-to-per-repository-state.md`; (e) configuration-only
  membership declared through `workspaceRoot` and `members` in the project
  configuration document, where a scan only locates declared members and never
  admits an undeclared clone, plus the scoped-read grammar
  `queue list --project <groupKey>` and `status --project <groupKey>`;
  (f) the superseding decision record for the `repos` name before the registry
  row moves to Delivery. This rename is S18 code work, delivered by GH-309.
- AC:
  1. A project with two member repositories in one workspace directory is discoverable by registering that directory.
  2. The same project configured with repositories in unrelated directories behaves identically, because a workspace is optional.
  3. `projects list` shows the group with both members and their state.
  4. Queue and status accept a project scope.
  5. A configuration mixing tracker kinds is accepted at validation time with the unimplemented member classified `not-yet-supported` rather than rejected silently.
  6. `projects list --flat --json` returns the delivered `projects.v1` payload with `data.projects[]`, `projectKey`, and `hostIndexRevision`, while `projects list --json` returns `project-groups.v1` with `data.groups[]` and `groupKey`.
- Depends on: M2-S11.

### M2-S19 Cross-repository changes
- Ticket: GH-310 (milestone M2)
- Progress: delivered by GH-310 — one change declares its member set in
  `plan.data.members[]` (closed per-member validation with the plan validate
  echo); one queue entry and one lane per member ref
  (`<canonicalChangeRef>@<repoKey>`, per-member dependency edges, per-member
  release and landing removal) and the delivered `queue add` payload plus an
  additive ordered `data.members[]`; one shared definition of done at
  `verify gates` (`data.definitionOfDone` with per-member `gates.ci` and
  `verdict`, landing-ordered `evidence[]`, `data.blockingMembers[]`, and one
  `data.reviewFlow` run over the declared pull-request set) as the distinct
  `CrossRepositoryVerifyGatesReport`, while the delivered `VerifyGatesReport`
  keeps its literal `overall: "pass"`, member-less records, envelope, and exits;
  and `closeout.data.members[]` with merge-truth `landed`, mode-scoped cleanup
  and issue-closure columns, plus per-member landing removal. Zero new
  error-table rows and zero new domain kinds; every member-less plan, gates,
  closeout, and queue payload and exit is byte-identical.
- Goal: One change may span multiple repositories of one project: one
  lifecycle, one spec and plan, one definition of done, with a branch and
  pull request per member repository.
- Tasks: the plan declares member repositories and their slices; one
  lifecycle drives per-repo branches and PRs; per-repo gates and one shared
  DoD; closeout across member repositories, with branch cleanup and issue
  closure per tracker; dependency edges between member repositories' steps
  where order matters; evidence records enumerate all member PRs. One review
  flow is defined executably: exactly one review run over the declared member
  pull-request set, one verdict per member, and each member reviewed once.
- AC:
  1. A two-repository change produces one spec, two branches, two PRs, one review flow, and a closeout that lands both.
  2. Per-repo CI truth is corroborated per member before the change counts done; an unavailable CI reading blocks the shared definition of done as a classified outcome rather than counting as green.
  3. A member failing its gates blocks the shared DoD with the failing member named.
  4. Member dependency order holds: a member step with a dependency edge does not start before the prerequisite member's pull request lands, and the evidence lists the pull requests in landing order.
- Depends on: M2-S11, M2-S18, M1-S17.

### M2-S20 Milestone-first planning and delivery
- Ticket: GH-313 (milestone M2)
- Goal: A milestone and every ticket attached to it exist in the tracker
  before work starts, every new change ticket is attached at creation or
  explicitly captured as backlog, and the committed planning corpus mirrors
  that attachment.
- Tasks: author the milestone-management guide and record the operating rule
  as PDR-0005; require a milestone in the ticket-creation path and verify it
  at intake; add the required `change.milestone` field to the change-spec
  template and the `@spec-writer` rules; carry the rule into bootstrapped
  project tracker instructions; deliver the event-driven milestone-attachment
  check with its capture exemption and zero-write advisory sweep; repair the
  M2 planning corpus so the backlog, ranking, pack, and status mirror the
  tracker.
- AC:
  1. `doc/guides/milestone-management.md` exists with a redistributable marker,
     one script-generated header, the nine lifecycle topics, and a link from
     the documentation index; the pack conventions point at it without
     restating the procedure.
  2. Ticket creation requires a milestone resolved from the project's existing
     set in both the tracker instructions and the `@pm` prompt; intake verifies
     attachment, records it in pm-notes, and stops on an unattached ticket;
     the `@bootstrapper` guidance carries the same rule.
  3. The change-spec template requires `change.milestone` with its resolution
     rule, and no other template gains a milestone field.
  4. The milestone-attachment check evaluates the ordered contract offline,
     flags a new unattached `change` issue once, respects the capture exemption
     and manual flag removal, reverses on attach/detach, writes only its closed
     vocabulary, and sweeps the existing debt with zero tracker writes.
  5. The M2 backlog carries 19/19 ticket lines including M2-S20, the ranking is
     contiguous and backlog-ordered, the M2 pack carries the M2-S20 row and its
     five seeds, and the status snapshot carries the delivery addendum.
- Depends on: none.

---
