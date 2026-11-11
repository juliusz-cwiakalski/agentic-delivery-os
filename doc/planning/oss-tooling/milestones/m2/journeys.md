# M2 journeys: the operator's day at M2 exit (planned)

Planned journeys for the M2 end state. Each journey is written from the
operator's side: what they ask, what the engine answers, and what must stay
true. Scope is in [../../backlog.md](../../backlog.md); the surfaces are in
[contracts.md](contracts.md) and the flows in [architecture.md](architecture.md).

## Multi-repo morning overview

The owner starts the day with one group: three member repositories on one
workstation, and one of those members lives outside any shared directory.
Membership comes from configuration, not from a directory scan.

1. `<binary> projects list` shows the group with its members, their health, and
   their state. Membership comes from configuration, so nothing was registered
   by hand and no scan decided the group.
2. `<binary> repos list` shows the flat record set behind that group: each
   member's repo key, root, state location, daemon reachability, and handover
   state, discovered from each checkout's identity.
3. The naming boundary holds: `repos` is the flat record set and `projects`
   groups it. The time-scoped disambiguation follows the rename rule:
   `projects list` was the delivered flat spelling before M2-S18 and becomes
   the group surface from M2-S18.
4. `<binary> queue list --project <groupKey>` and
   `<binary> status --project <groupKey>` scope both reads to the group, so
   running, waiting, and parked work arrive already filtered.
5. `<binary> board --project <repoKey>` renders one repository key's board;
   the board stays on repository keys.
6. The same group configured without a shared workspace reads identically,
   because a workspace is a discovery root and never required.
7. Two members use the same ref number. Their lanes, phase state, and queue
   entries stay disjoint, so the overview never mixes them.
8. The owner opens the one ask that needs a decision and leaves the rest
   running.

## Inspecting evidence before a handover decision

A repository is close to handover; the owner wants evidence, not a claim.

1. `<binary> dispatch attempts --ref` lists the recent attempts with their
   tokens, corroboration triples, divergence reference, timestamps, and harness.
2. One attempt diverges: the artefact and the tracker disagree. The owner
   runs `<binary> dispatch dual-run resolve <divergence-id> --note "..."`. The
   resolution runs from local evidence and reports the unresolved counts it
   leaves behind.
3. Another divergence is recorded. The same command resolves it from local
   evidence and declares `local-evidence` mode together with the divergence's
   own repository, so the owner can see which truth the decision rests on.
4. The handover gate still decides: inspection gives evidence, not a waiver.

## A retro grounded in telemetry

The retro starts from numbers the engine can defend.

1. `<binary> spend --ref` reports tokens and cost by ticket, repository, lane,
   agent role, and model, with timing summaries per phase.
2. The report reconciles with the harness session totals within the declared
   tolerance; the reconciliation line states the tolerance rather than hiding
   it.
3. One delivery has no telemetry. It appears as a classified absence, not as a
   zero report, so the retro can say "we do not know" and name why.
4. The retro's action registry takes the numbers as evidence and records
   follow-through; the morning brief cites the same figures.

## Steering a running delivery

Mid-delivery, the owner changes course without killing the session.

1. The owner files a steering note. It queues with its origin, a read receipt,
   and a TTL.
2. The note lands at the next phase boundary; the delivery keeps its session,
   its branch, and its evidence trail.
3. A second note expires before any boundary. It does not apply, the expiry is
   recorded, and the delivery continues on its previous course.
4. The board shows the applied note and the expired one side by side, so the
   record is auditable.

## The S17 cost-control journey

A provider peak starts mid-delivery. The owner wants cost control without
stopping the work that is not affected.

1. Two lanes run: one on `profile-a`, one on `profile-b`. Each dispatch
   recorded its nominated provider profile at admission.
2. A peak window opens for `profile-a`. The daemon stops that lane with
   bounded grace, marks it parked with reason `peak-window` and the window
   end, and leaves the `profile-b` lane running.
3. Telemetry over the window proves zero billable model calls on `profile-a`
   for the parked lane.
4. When the window ends, the lane resumes automatically from preserved session
   state on the same branch; no branch, artifact, or queue state is lost or
   duplicated.
5. Stop, park, and resume appear as ledger events in status and brief, and the
   board shows the parked lane next to the lane on another provider that kept
   running. Without a resident daemon the engine degrades to iteration-start
   gating and declares the difference.
