# M2 test scenarios: the seed each story's test plan inherits (planned)

Planned scenario seeds for stories M2-S2 through M2-S17, at least two per
story. Each scenario names an invocation and an observable result so the
owning story's test plan starts from a concrete draft instead of a blank page.
Scope and acceptance stay in [../../backlog.md](../../backlog.md); the
surfaces are in [contracts.md](contracts.md); flows are in
[architecture.md](architecture.md). Scenario ids use the story code, so a
scenario is attributable without reading its body.

## M2-S2 Supervise

### SC-M2-S2-01 Supervision battery reports lane liveness per repository

Given one managed repository with an active lane, when the supervision
battery runs, then it reports the lane's liveness, last heartbeat, and lease
holder for that repository, and the report names no other repository.

Assert: `supervise.data.lanes[]` has one entry with `ref`, `heartbeat`, and `holder`, and `supervise.data.repo` equals the single managed repo key.

### SC-M2-S2-02 Supervise parks a stalled lane with a classified reason

Given a lane whose heartbeat has stopped beyond the stall threshold, when the
supervision battery runs, then it records the lane as parked with a classified
stall reason and an until timestamp, and the board shows the parked state
rather than a healthy lane.

Assert: `lanes show <ref>.data.state == "parked"` with a classified `parkReason` and a non-null `until`.

## M2-S3 Ceremony runner

### SC-M2-S3-01 Ceremony runner executes a retro ceremony from the note schema

Given a ceremony note that satisfies the fixed note schema, when the ceremony
runner executes it, then each agenda step produces its declared output and the
run ends with an artifact-verified follow-through section.

Assert: ceremony exit code is `0` and the artifact carries a `follow-through` section with at least one verified action.

### SC-M2-S3-02 Ceremony runner refuses an incomplete ceremony note

Given a ceremony note missing its idempotent scope key, when the ceremony
runner executes it, then the run is refused with a classified error naming the
missing field, and no partial ceremony output is written.

Assert: exit code is `1` and `error.code == "ceremony.note-invalid"` names `scopeKey`.

## M2-S4 Board

### SC-M2-S4-01 Board shows lanes, gates, owner asks, and parked work from one state source

Given a repository with an active lane, an open owner ask, and a parked lane,
when `<binary> board` runs, then the four sections render from the same state
source as brief and status, and each row names its ref and owner.

Assert: `board.data` has `lanes`, `gates`, `asks`, and `parked`, and `board.data.stateSource` equals the brief and status source.

### SC-M2-S4-02 Board lists work across two repositories on one host

Given two managed repositories on one host, when `<binary> board --all`
runs, then every lane appears under its project key, and the total equals the
sum of the per-repository boards with no row duplicated.

Assert: `board --all.data.projects` holds both project keys and the row count equals the sum of the per-project boards.

## M2-S5 Steer

### SC-M2-S5-01 Steering note lands at the next phase boundary with a receipt

Given a running delivery, when the owner files a steering note, then the note
queues, lands at the next phase boundary, and the receipt records origin, a
read receipt, and the TTL.

Assert: `data.receipt` carries a non-null `origin`, `readReceipt`, and `ttl` for the landed note.

### SC-M2-S5-02 Steering note expires at its TTL without landing

Given a steering note whose TTL elapses before a phase boundary, when the
boundary passes, then the note is not applied, the expiry is recorded as a
classified outcome, and the delivery continues on its previous course.

Assert: exit code is `0` with `data.applied == false` and `data.expiry.reason == "ttl-elapsed"`.

## M2-S6 Metrics and spend

### SC-M2-S6-01 Spend breakdown by agent role and model feeds the metric layer

Given a completed delivery with telemetry, when `<binary> spend --ref` runs,
then the report breaks tokens and cost down by agent role and model with
phase timing, and the metric layer reads the same numbers.

Assert: `spend.data.breakdowns.agentRole` and `.model` are non-empty and their token sums equal `spend.data.totals.tokens`.

### SC-M2-S6-02 Burn-rate alarm fires on a measured overspend

Given a delivery whose measured spend exceeds its burn-rate threshold, when
the metric layer evaluates the delivery, then it raises one alarm naming the
ref and the threshold, and it does not raise a second alarm for the same
crossing.

Assert: `metrics.data.alarms` holds exactly one `burn-rate` entry for the ref, with the threshold echoed.

## M2-S7 Suite-to-job mapping in gates

### SC-M2-S7-01 Local gate cites the same suite breadth as CI

Given a change whose CI job runs the full suite, when the local gate runs,
then its report cites the same suite breadth and names the CI job it mirrors.

Assert: `verify gates.data.suiteBreadth` equals the CI job breadth and `data.mirrorsJob` is a non-empty job id.

### SC-M2-S7-02 Narrow local suite cannot masquerade as full green

Given a local gate invocation limited to one package, when the gate reports,
then it states the narrowed breadth and refuses to report full green.

Assert: `verify gates` exits `1` with `error.code == "verify.narrowed-scope"` and the narrowed breadth named.

## M2-S8 Memory records

### SC-M2-S8-01 Memory lint rejects a record without an id and evidence

Given a memory record file missing its id and evidence link, when the memory
lint runs, then it fails with one finding per missing field and names the
file, and the gate exit code is non-zero.

Assert: memory lint exits `1`, with one `findings[]` entry per missing field, each naming the file.

### SC-M2-S8-02 Concurrent memory records merge without conflict

Given two agents appending records to different files in the memory tree at
the same time, when both changes merge, then the merge has zero conflicts and
the generated index lists both records.

Assert: the merge reports zero conflicts and `index.data.records` contains both record ids.

## M2-S9 Memory conventions in bootstrap

### SC-M2-S9-01 Bootstrapped project starts with the memory layout

Given a project bootstrapped from the template, when the new tree is listed,
then it contains the memory index, the lessons area, and one entry point per
agent role, each with the capture bar stated.

Assert: the bootstrapped tree lists the memory index, the lessons area, and one entry point per agent role.

### SC-M2-S9-02 Bootstrapped project carries capture and promotion rules

Given a bootstrapped project, when the coordinator instructions are read, then
they state the capture bar and the promotion path, and the retro ceremony
references both rather than duplicating them.

Assert: the coordinator instructions contain the capture bar and the promotion path, and the retro ceremony references both.

## M2-S10 Retro action registry

### SC-M2-S10-01 Five-field action cannot be filed incomplete

Given an action missing its measurable outcome, when it is filed, then the
registry refuses it with a classified error naming the missing field, and no
action row is created.

Assert: filing exits `1` with `error.code == "retro.action-incomplete"` naming `measurableOutcome`, and `actions[]` stays empty.

### SC-M2-S10-02 Action closure distinguishes artifact closure from outcome closure

Given an action whose artifact is complete but whose outcome window is open,
when it is closed, then the registry records artifact closure and leaves
outcome closure open with its verification window.

Assert: `data.artifactClosure == "closed"` and `data.outcomeClosure == "open"` with a non-null verification window.

## M2-S11 Multi-repository workstations

### SC-M2-S11-01 Same-ref two-repo collision safety

Given two checkouts of different repositories on one host, both using the same
ref, when each records phase state and a queue entry, then the phase state and
queue entries are disjoint, and neither checkout observes the other's
documents.

Assert: the two checkouts' phase-state and queue files are disjoint and neither `projects list` row references the other ref.

### SC-M2-S11-02 `projects list` enumerates both checkouts without manual configuration

Given two managed checkouts with no hand-written registry, when
`<binary> projects list --json` runs, then the machine envelope returns both
projects with repo key, root, state location, daemon reachability, and
handover state.

Assert: `projects list --json.data.projects[]` carries both projects with `projectKey`, `root`, `stateLocation`, `daemonReachable`, and `handoverState`.

## M2-S12 Evidence inspection and divergence resolution

### SC-M2-S12-01 Divergence resolution in local-evidence mode

Given a recorded divergence and unreachable tracker truth, when
`<binary> dispatch dual-run resolve <divergence-id> --note <text>` runs, then
it resolves from local evidence, declares `local-evidence` mode in the
envelope, and reports unresolved counts.

Assert: `data.mode == "local-evidence"` and `data.divergences.unresolved` decreases by exactly one after the resolve, with at most 20 identifiers and `idsTruncated` declaring any omission.

### SC-M2-S12-02 Attempt history retrievable as a machine envelope with unresolved counts

Given a repository with several dispatch attempts, when
`<binary> dispatch attempts --ref --limit` runs, then each attempt carries its
token, corroboration triple, singular divergence reference, timestamps, and
harness, and the envelope reports whether more attempts remain.

Assert: every `data.attempts[]` entry carries `token`, `corroboration`, `divergenceRef` (identifier or explicit `null`), `startedAt`, `endedAt`, and `harness`, with a boolean `hasMore`.

## M2-S13 Public event taxonomy

### SC-M2-S13-01 Subscribe topic contract compliance

Given a client subscribed to `queue.graph`, when an entry and a dependency
change occur, then the client receives ordered events it can act on, and the
taxonomy version it speaks is pinned by contract tests per topic.

Assert: received `queue.graph` events carry a monotonic `sequence` and `data.taxonomyVersion` is pinned by the per-topic contract test.

### SC-M2-S13-02 Slow-consumer overflow degrades to repoll for every topic

Given a subscriber that stops reading, when the daemon buffer overflows, then
the subscriber is marked overflowed and instructed to repoll, and the behavior
is identical for `queue.graph`, `dispatch.attempt`, `phase.state`, and
`blockers.state`.

Assert: the overflowed subscriber reports `data.overflow == "repoll"` for each of the four topics.

## M2-S14 Harness telemetry v2

### SC-M2-S14-01 Telemetry reconciliation within tolerance

Given a completed delivery with harness-reported session totals, when
`<binary> spend --ref` runs, then its token and cost totals reconcile with the
session totals within the declared tolerance, and the reconciliation line
states the tolerance.

Assert: `data.reconciliation.verdict == "within"` and `data.reconciliation.tolerance` is at most `0.02`.

### SC-M2-S14-02 Telemetry absence remains a classified outcome

Given a delivery with no telemetry records, when `<binary> spend --ref` runs,
then it reports telemetry absence as a classified outcome with exit `1`, and
it does not print a zero-valued report.

Assert: exit code is `1` with `error.code == "spend.telemetry-absent"` and no zero-valued report.

## M2-S15 Queue lifecycle completion

### SC-M2-S15-01 Auto-removal after closeout

Given a ref with an active queue entry whose work squash-merges and closes
out, when the closeout completes, then the ref's queue entry is gone without
manual action and carries the `landed` reason.

Assert: the ref has zero remaining queue entries and the ledger records removal `reason == "landed"`.

### SC-M2-S15-02 Single-flight refusal naming the holder

Given a ref with an active lane, when a second dispatch is attempted through
any dispatch path, then it is refused with a classified error naming the
holder lane, and no second session starts.

Assert: exit code is `1`, `error.code == "queue.single-flight"`, and `error.detail.holder` names the holder lane.

### SC-M2-S15-03 Stale entry reconciled against tracker truth without editing state files

Given a queue entry whose tracker work is already closed, when reconciliation
runs, then the entry leaves with the `reconciled` reason and no state file is
edited by hand.

Assert: the entry leaves with `reason == "reconciled"` and no state file is modified outside the tool.

## M2-S16 Engine-first delivery operations

### SC-M2-S16-01 Handover evaluation reporting per condition

Given accrued engine dispatches on a repository, when the handover gate
evaluates it, then it reports per-condition status for incident truth,
coverage, corroboration, and the exposure floor, and it names each condition
that is still open.

Assert: `handover.data.conditions[]` carries one entry per condition, each with `status` of `met` or `open`.

### SC-M2-S16-02 Engine dispatch corroboration accrues in the summary

Given consecutive engine dispatches, when each completes with corroborated
artefact and tracker truth, then the summary counts them as clean and the
repository's evidence coverage grows by one per dispatch.

Assert: `data.cleanDispatches` grows by one per corroborated dispatch and `data.coverage` grows with it.

## M2-S17 Provider-aware peak pausing

### SC-M2-S17-01 Park at peak start per profile

Given an in-flight lane using `profile-a`, when a peak window starts for
`profile-a`, then the peak start parks every in-flight lane on that profile
with bounded grace, records reason `peak-window` and the window end, and the
lane stays parked until the window ends.

Assert: `data.lanes[]` shows every in-flight `profile-a` lane with `state == "parked"`, `reason == "peak-window"`, and a non-null `until`.

### SC-M2-S17-02 Other-provider isolation: another provider's lane keeps running

Given two lanes, one on `profile-a` and one on `profile-b`, when a peak window
starts for `profile-a`, then the `profile-b` lane is unaffected and keeps
running, and the board shows both states at once.

Assert: the `profile-b` lane keeps `state == "running"` while the `profile-a` lane is `parked`.

### SC-M2-S17-03 Resume at window end without state loss

Given parked lanes on `profile-a`, when the window ends, then each lane
resumes automatically from preserved session state on the same branch, and no
branch, artifact, or queue state is lost or duplicated.

Assert: each resumed lane has `state == "running"` on the same `branch` with an unchanged artifact and queue digest.

### SC-M2-S17-04 Zero-spend assertion

Given a lane parked for a `profile-a` peak window, when telemetry for the
window is read, then it proves zero billable model calls on `profile-a` during
the window for the parked lane.

Assert: `spend.data.zeroSpend.profile == "profile-a"` with `billableCalls == 0` and `telemetryState == "present"`.

### SC-M2-S17-05 Daemon-absent degradation

Given no resident daemon, when a peak window would otherwise park a lane, then
the engine degrades to iteration-start gating, declares the difference, and
does not claim a park that did not happen.

Assert: `data.mode == "iteration-start-gating"` and `data.parkClaimed == false`.

### SC-M2-S17-06 Profile nomination recorded on lane and attempt records

Given a dispatch whose delivery nominates `profile-a`, when the attempt
completes, then the lane record and the attempt record both carry
`providerProfile: profile-a`, and the attempt history read returns the same
value.

Assert: `dispatch attempts --ref.data.attempts[].providerProfile == "profile-a"` and the lane record carries the same value.

### SC-M2-S17-07 Stop, park, and resume visible in status and brief

Given a lane stopped and parked for a `profile-a` peak window and then
resumed at window end, when `status` and `brief` are read, then each shows the
park fields and the ledger carries stop, park, and resume events.

Assert: `status` and `brief` each show `parkedCount`, `reason`, and `until`, and the ledger holds stop, park, and resume events for the lane.

## Cross-story scenarios

### SC-M2-S15-04 Queue graph event after a dependency edge changes

Given a queue with a dependency edge, when the edge is removed, then the
dependent becomes ready, and a `queue.graph` event records the edge change
with its sequence.

Assert: a `queue.graph` event with `kind == "dependency-edge"` follows the removal with a monotonic `sequence`.

### SC-M2-S16-03 Shell path stays usable through an engine-first flip

Given a repository flipped to engine-first delivery, when the shell entry
point is invoked, then it still works, prints its deprecation pointer toward
the engine, and the flip remains reversible per repository.

Assert: the shell entry point exits `0`, prints its deprecation pointer, and reports `data.reversible == true`.
