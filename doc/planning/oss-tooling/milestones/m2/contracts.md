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
  (boolean with a degradation reason when false), `handoverState` (engine,
  shell, or in transition).
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
- **Read side.** `<binary> dispatch attempts [--ref <ref>] [--limit <n>]`
  returns history as a machine envelope; `--limit` bounds the page and the
  envelope reports whether more attempts remain.
- **Divergence resolution.** `<binary> dual-run resolve <ref> --note <text>`
  resolves a recorded divergence; the result reports unresolved counts. When
  live tracker truth is unreachable, resolution runs from local evidence and
  declares `local-evidence` mode in the envelope.
- **Coverage and floor.** The summary keeps reporting evidence coverage and
  the exposure floor; the contract does not replace the handover gate.

## Event taxonomy v1

The subscribe contract, owned by M2-S13 and published by the resident daemon.

- **Topics.** `queue.graph`, `dispatch.attempt`, `phase.state`, and
  `blockers.state`, extending the existing status and lanes topics.
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
  totals within a **declared tolerance**; the tolerance is stated in the
  contract and reported with every summary, not applied silently.
- **Absence.** Telemetry absence is a classified outcome, never a zero
  report: a delivery with no telemetry says so.
- **Storage.** Schema-versioned local event storage; a version bump
  migrates by re-reading.

## Queue lifecycle mutations

Owned by M2-S15.

- **Release and removal reasons.** A queue entry leaves with a reason:
  `landed`, `abandoned`, `superseded`, or `reconciled`. Removal carries a
  reason; an unqualified removal is refused.
- **Automatic release.** A squash merge followed by closeout releases the
  ref's entry without manual action.
- **Dependency edges.** Edges are added and removed explicitly; the ready set
  is recomputed from the graph, and a dependent becomes ready only when its
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
  admission, lane records, and attempt records; a dispatch without a
  nominated profile is refused at admission.
- **Peak-window rule schema.** Rules are data per profile: a window list
  (start, end, and time zone), a multiplier per window, and a buffer before
  and after each window. The schema is versioned with the profile.
- **Park reason vocabulary.** `peak-window` and `owner-hold`, each with an
  `until` timestamp. `peak-window` names the profile and the window end;
  `owner-hold` outranks provider windows and names the hold's expiry.
- **Resume event shapes.** `dispatch.attempt` gains a parked kind and a
  resumed kind; `queue.graph` gains a park-edge kind. The resume event
  records the preserved session state reference, the same branch, and that
  no re-dispatch occurred.
- **Zero-spend evidence.** Telemetry proves zero billable model calls on the
  parked profile during its window; the assertion is part of the contract,
  not an inference from absence.
