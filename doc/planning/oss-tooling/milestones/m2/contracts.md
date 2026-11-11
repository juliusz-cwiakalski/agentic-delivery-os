# M2 contracts: shared continuity and the new surfaces (planned)

Planned M2 contracts. Every surface below is a proposal refined at story
delivery; the M1 contracts in [../m1/contracts.md](../m1/contracts.md) stay in
force until a story supersedes them. Scope and acceptance live in
[../../backlog.md](../../backlog.md); flows are in
[architecture.md](architecture.md).

## Shared contract continuity

M1 contracts remain valid: the machine envelope shape, the error taxonomy, the
exit-code meaning, the state-layer validation rules, and the audit ledger are
unchanged. M2 surfaces extend them additively:

- The machine envelope stays `{ ok, command, data, error?, warnings? }`; new
  commands add keys under `data`, never new top-level keys.
- Exit codes keep their meaning: `0` declared verdict, `1` refused or negative
  verdict, `2` platform, state, or provider failure.
- Every surface that reads or mutates state validates at the boundary and
  writes through the state layer.

## projects.v1

The project overview contract, owned by M2-S11.

- **Record fields.** `projectKey` (stable repository identity derived from the
  checkout identity: the git common dir marker), `root` (absolute checkout
  root), `stateLocation` (the per-repository state root), `daemonReachable`
  (`{ reachable }` or `{ reachable: false, reason }` with the closed reason
  vocabulary `daemon-not-mounted`, `state-absent`, `socket-absent`,
  `socket-unreachable`), `handoverState` (`engine`, `shell`, or
  `in-transition`).
- **Envelope.** `<binary> projects list --json` returns
  `data.projects[]` with exactly those fields plus a host index revision.
- **Isolation.** Two checkouts of different repositories, both on the same
  ref, hold disjoint phase state and queue entries. The contract forbids a
  shared store keyed only by ref.
- **Migration.** Existing single-store installs migrate by moving into the
  per-repository root; the migration note is part of the story's deliverables.

## attempts.v1

The evidence read-side contract, owned by M2-S12 and consumed by M2-S16.

- **Record fields.** Attempt id, ref, `token`, the corroboration triple
  (pm-notes phase evidence, tracker state, CI on the pushed head), divergence
  refs, start and end timestamps, and the harness identity recorded per
  attempt.
- **Read side.** `attempts.v1` is the per-ref read side:
  `<binary> dispatch attempts --ref <ref> [--limit <n>]` returns that ref's
  history as a machine envelope; `--limit` bounds the page and the envelope
  reports whether more attempts remain. A repository's history is the union over its refs,
  while the backlog keeps the ticket's per-repository wording.
- **Divergence resolution.** `<binary> dispatch dual-run resolve <divergence-id> --note <text>`
  resolves a recorded divergence (no `--ref` on resolve: the divergence id
  carries the ref); the result reports unresolved counts. When live tracker
  truth is unreachable, resolution runs from local evidence and declares
  `local-evidence` mode in the envelope.
- **Coverage and floor.** The summary keeps reporting evidence coverage and
  the exposure floor; the contract does not replace the handover gate.

## Event taxonomy v1

The subscribe contract, owned by M2-S13 and published by the resident daemon.

- **Topics.** `queue.graph`, `dispatch.attempt`, `phase.state`, and
  `blockers.state` extend the delivered `queue` and `lanes` topics
  (`CONTROL_TOPICS = [queue, lanes]`); `queue.graph` extends `queue`, and
  `status` is a wire type, not a topic.
- **Event kinds.** Each topic declares its kinds: `queue.graph` publishes
  entry, dependency-edge, release, and remove kinds; `dispatch.attempt`
  publishes started, refused, and completed kinds; `phase.state` publishes
  phase began, phase completed, and phase reopened kinds; `blockers.state`
  publishes published, updated, and cleared kinds.
- **Payload shapes.** Every event carries `topic`, `kind`, `lane`, `ref`,
  `sequence`, `occurredAt`, and a topic-specific `payload` object. Payload
  fields are additive within a taxonomy version.
- **Ordering guarantees.** Events are ordered per lane by a monotonic
  `sequence`; a client that observes a gap must repoll rather than infer
  order.
- **Slow-consumer overflow.** A consumer that cannot keep up overflows to a
  repoll: the daemon drops queued events for that subscriber, marks the
  overflow, and the subscriber re-reads current state. Overflow behavior is
  defined per topic and preserved for every topic.
- **Versioning.** The taxonomy document carries a version, pinned by
  contract tests per topic; a client is expected to state the version it
  speaks.

## telemetry.v1

The attribution contract, owned by M2-S14 and consumed by M2-S6 and M2-S10.

- **Attribution fields.** Each telemetry record carries `ticket`,
  `repository`, `lane`, `agentRole`, `model`, and `phaseTiming` (phase timing:
  start, end, and duration), attributed through session economics and
  command-audit identity.
- **Counting.** Per-step input, output, reasoning, cache-read, and
  cache-write tokens; calls; and cost per model, in the units the harness
  reports.
- **Reconciliation.** Spend reconciles against harness-reported session
  totals within a **declared tolerance** whose default is ≤2% of the session
  totals; the tolerance is stated in the contract and reported with every
  summary, not applied silently. S14's own plan and test plan adopt that
  default or declare a different tolerance with its justification.
- **Absence.** Telemetry absence is a classified outcome, never a zero
  report: a delivery with no telemetry says so.
- **Storage.** Schema-versioned local event storage; a version bump
  migrates by re-reading.

## Queue lifecycle mutations

Owned by M2-S15.

- **Lease release stays.** `queue release` keeps its delivered meaning: the
  lane's lease is dropped, the entry stays in the queue, and it may be parked
  with a delivered park cause and an `until` timestamp. Release takes no
  removal reason.
- **Entry removal carries a reason.** The M2 `queue remove` verb takes an
  entry out of the queue with a reason: `landed`, `abandoned`, `superseded`,
  or `reconciled`. Removal carries a reason; an unqualified removal is
  refused with `queue.reason-missing`.
- **Automatic removal.** A squash merge followed by closeout removes the
  ref's entry without manual action, with reason `landed`.
- **Dependency edges.** `queue dep <ref> <on-ref>` stays the delivered
  two-positional add; `dep add` and `dep remove` are its explicit grammar
  extension, and either form edits one dependency edge. The ready set is
  recomputed from the graph, and a dependent becomes ready only when its
  edges clear.
- **Single-flight.** One active lane per ref across every dispatch path; a
  second dispatch is refused with a classified error naming the holder.
- **Stale reconciliation.** Stale entries reconcile against tracker truth
  without editing state files.

## spend v2

Owned by M2-S6 on M2-S14 telemetry.

- **Breakdown fields.** Cost and tokens split by ticket, repository, lane,
  agent role, and model, plus timing summaries per phase.
- **Additive contract.** The M1 read side keeps its shape; v2 adds the
  breakdown block and the reconciliation disclosure.
- **Consumers.** The retro evidence pass and the morning brief cite the
  numbers; a report without a reconciliation line is incomplete.

## Provider profiles and peak windows (S17 additions)

Owned by M2-S17.

- **Provider profile field.** `providerProfile` appears on dispatch
  admission, lane records, and attempt records. Every delivery nominates its
  profile; the no-nomination case is a decision at S17 delivery (a classified
  refusal or the profile's declared default), so this pack does not add an
  admission rule ahead of it.
- **Peak-window rule schema.** Rules are data per profile: a window list
  (start, end, and time zone), a multiplier per window, and a buffer before
  and after each window. The park bound `graceSeconds` carries a default and a maximum bounded by the window buffer,
  so the bounded grace can never outlast the buffer that protects the window.
  The schema is versioned with the profile.
- **Park reason vocabulary.** `peak-window` and `owner-hold`, each with an
  `until` timestamp. `peak-window` names the profile and the window end;
  `owner-hold` outranks provider windows and names the hold's expiry.
- **Delivered vocabularies and the S17 mapping.** Three vocabularies already
  exist, and S17 adds no fourth: the queue park-cause set
  `provider-window | provider-quota | preempted-for-close-item`, which `lanes`
  projects as `parked:<cause>`; `peak-window` as a provider-condition kind and
  provider park cause; and `owner-hold` as a queue lane idle reason plus the
  owner-hold marker. The committed mapping: `peak-window` is the S17 park
  reason and becomes a queue park cause whose condition type is the existing
  `provider-window` (no duplicate cause, no silent rename), and `owner-hold`
  becomes a park cause alongside today's idle reason. Consequence for `lanes`:
  the `parked:<cause>` projection gains the `peak-window` and `owner-hold`
  causes and keeps printing the delivered three unchanged.
- **Stop, park, and resume event shapes.** `dispatch.attempt` gains a stop
  event kind, a parked kind, and a resumed kind; `queue.graph` gains a
  park-edge kind. The stop event records the bounded-grace deadline, and the
  resume event records the preserved session state reference, the same
  branch, and that no re-dispatch occurred. `status` and `brief` carry the
  park fields - parked count, reason, and until - so AC6 is auditable from
  the same surfaces as the ledger events.
- **Zero-spend evidence.** The zero-spend evidence form is a per-call ledger
  entry or a provider-usage read, so zero billable calls is distinguishable
  from telemetry absent: absence is a classified outcome, while zero is a
  positive reading. AC5 is scoped from the park timestamp through the window
  end, so a boundary call before the park is not counted against it.
