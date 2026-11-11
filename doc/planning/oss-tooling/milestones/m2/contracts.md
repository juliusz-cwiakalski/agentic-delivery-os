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

## repos.v1

The flat record set contract, owned by M2-S18. This is the surface the shipped
`projects list` becomes once the rename has landed, and it carries the record
shape the amended M2-S11 delivered; the rename and its alias are S18 code
work, not current truth.

- **Record fields.** `repoKey` (the stable repo key derived from the checkout
  identity: the git common dir marker; delivered as `projectKey`), `root` (the
  absolute checkout root), `stateLocation` (the per-repository state
  location), `daemonReachable` (daemon reachability: `{ reachable }` or
  `{ reachable: false, reason }` with the closed reason vocabulary
  `daemon-not-mounted`, `state-absent`, `socket-absent`, `socket-unreachable`,
  so a bare negative always carries a degradation reason; an invocation
  outside any git work tree uses the declared `unbound` scope and is never an
  error), `handoverState` (the handover state: `engine`, `shell`, or
  `in-transition`).
- **Envelope.** `<binary> repos list --json` returns `repos.v1` with
  `data.repos[]`, exactly those fields, and the host index revision
  `hostIndexRevision`. The delivered `projects.v1` payload survives unchanged
  and remains reachable through the `projects list --flat` alias; the rename
  rule states the whole transition once.
- **Repository vocabulary.** The `project-identity.json` marker, the
  `<host root>/projects/<key>` container, the host index's `projects[]` and
  `projectKey` fields, and the `--project-root` flag each denote a repository
  checkout and keep that meaning permanently unless a code change renames
  them.
- **Isolation.** Two checkouts of different repositories, both on the same
  ref, hold disjoint phase state and queue entries. The contract forbids a
  shared store keyed only by ref.
- **Migration.** Existing single-store installs migrate by moving into the
  per-repository root; the migration note is part of the story's deliverables.

## projects.v1

The delivered flat record set, owned by M2-S11 and retained as the alias
payload. This section defines only the delivered envelope: `data.projects[]`
with `projectKey`, the delivered record fields, and `hostIndexRevision`. The
group envelope lives in its own contract; this section carries no group field
and no group claim.

- **Envelope.** `<binary> projects list --flat --json` returns the delivered
  `projects.v1` payload (`data.projects[]`, `projectKey`,
  `hostIndexRevision`). The alias is owned by M2-S18 and retires at the M3
  boundary.

The group contract is `project-groups.v1`; this section defines only the
delivered flat envelope and carries no group field.

## project-groups.v1

The group contract, owned by M2-S18.

- **Group fields.** `groupKey` is the group identity and `name` is its display
  name; `workspaceRoot` is the optional workspace root and discovery root,
  absent when the group declares none.
- **Member fields.** `members[]` carries one entry per declared member, each
  with its own `repoKey`, `root`, `trackerKind`, `state`, `health`, and
  `daemonReachable` with the closed reason vocabulary `daemon-not-mounted`,
  `state-absent`, `socket-absent`, and `socket-unreachable`. A member field
  never denotes the group, and no group-named field denotes a repository.
- **Envelope.** `<binary> projects list --json` returns `project-groups.v1`
  with `data.groups[]`, one entry per configured group, each carrying its
  `members[]` and the optional `workspaceRoot`.
- **Membership.** The member list is the configured membership; the envelope
  never infers a member from a directory scan.

## Naming boundary and the rename rule

**From M2-S18, `projects list` enumerates groups and `repos list` enumerates the flat record set; the deprecation alias is the different token `projects list --flat`, owned by M2-S18, which returns the delivered `projects.v1` payload (`data.projects[]`) and retires at the M3 boundary.**

Under that same rule, the board's repository list field becomes
`repositories[]` (previously the delivered `projects[]`), so the board names
repository keys throughout and never enumerates groups.

Before M2-S18, the time-scoped disambiguation is the shipped `projects list`
flat enumeration: the rename rule above is the planned end state, not current
truth.

## Project configuration document

The planned configuration document that declares group membership, owned by
M2-S18: `<configDirectoryName>/projects.yaml`, schema
`delivery.projects.groups.v1`.

- **Declared fields.** `groups[]` with `groupKey`, `name`, an optional
  `workspaceRoot`, and `members[]`, where each member declares a repository
  selector (`root` or `repoKey`) plus a `trackerKind`.
- **Configuration-only membership.** Membership is configuration-only: a
  scan inside `workspaceRoot` only locates declared members and never admits an undeclared clone.
- **Mixed tracker kinds.** A configuration mixing tracker kinds is accepted at
  validation time: the tracker kind is per member, so only GitHub being
  exercised initially does not narrow the schema, and the unimplemented member
  is classified `not-yet-supported` rather than rejected silently.
- **No workspace root.** A configuration with no workspace root is valid and
  behaves identically: `workspaceRoot` is a discovery convenience, and
  membership resolves from the declared members wherever their checkouts live.
- **Validation.** Membership is validated at load time, so an unreadable or
  contradictory configuration document is a classified configuration error
  rather than a silently empty group.

## Project-scoped aggregation

Defined once for every group-scoped read, owned by M2-S18.

- **Members and order.** Members come from configuration in declared order;
  the state layer's own scope stays per-checkout and is never a group-scoped
  store.
- **Per-member outcomes.** Each member resolves to one of `observed`,
  `not-yet-supported`, `state-unavailable`, or `unregistered`.
- **Classified partial failure.** One `state-unavailable` member produces a
  classified partial result at exit 0 with `partial` true and the degraded
  member named; the readable members are still returned. The envelope carries
  `data.partial` (true when any member is degraded) and `data.degradedMembers[]`,
  each naming a degraded member by its `repoKey` and its outcome.
- **Restricted exit 2.** Exit `2` occurs only when the configuration document
  or the invoking scope cannot be read.
- **Not-yet-supported.** A `not-yet-supported` member contributes no records
  and never fails the read.

## Queue and lane representation

Owned by M2-S18 for cross-repository changes, and read beside the delivered
queue lifecycle mutations below.

- **One entry per member.** A cross-repository change holds one queue entry per member
  keyed by that member's ref; per-member dependency edges are declared for
  each member step.
- **Release rule.** Release drops each member's lease while the entries stay;
  removal happens per member with the change's reason, and one member landing
  removes only its entry.
- **Lanes.** One lane per member entry, never a cross-repository lane.

## Cross-repository change plan shape

The planned plan declaration for one change over member repositories of one
group, owned by M2-S19.

- **Members and slices.** `plan.data.members[]` declares one entry per member
  with `repoKey`, `slice`, `branch`, `pullRequest`, `dependsOn[]`, and
  `gates`; each element of `dependsOn[]` is a member `repoKey`.
- **One lifecycle, per-member delivery.** One lifecycle drives a branch and a
  pull request per member repository, under one review flow: exactly one review run over the declared member pull-request set, one verdict per member,
  and no member is reviewed twice.
- **Gates and definition of done.** Per-member gates decide each member, and
  one shared definition of done decides the change. The shared verdict is
  declared at `verify gates` as `data.definitionOfDone` — an object with
  `status` (`green`, `blocked`, or `incomplete`), `members[]` (one entry per
  member with `repoKey`, `gates.ci`, and `verdict`), and `evidence[]` (member
  pull requests in landing order) — plus `data.blockingMembers[]`, which lists
  the `repoKey` of every member blocking the verdict.
- **Per-member CI corroboration.** CI truth on each member's pushed head is
  read and recorded; an unavailable reading blocks the shared definition of
  done rather than counting as green.
- **Dependency ordering.** A member step with a dependency edge does not start
  before the prerequisite member's pull request lands.
- **Closeout.** `closeout.data.members[]` reports one entry per member with
  `repoKey`, `branch`, `cleanup`, `pullRequest`, `issueClosure`, and `landed`.
- **Evidence.** Evidence enumerates every member pull request in landing
  order, so a partly landed change is visible as such and a failing member is
  named.

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
