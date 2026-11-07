---
change:
  ref: GH-237
  type: feat
  status: Proposed
  slug: scheduling-engine
  title: "M1-S17: Scheduling engine: queue, lanes, dependency batching"
  owners: [engineering]
  service: delivery-os scheduling engine
  labels: [change, planning]
  version_impact: minor
  audience: internal
  security_impact: medium
  risk_level: high
  dependencies:
    internal: [state layer, configuration layer, delivery plan schema, queue-ready ready-set, merge and verify-deploy, session lifecycle economics, provider engine, result contract]
    external: [GitHub issue and pull-request reads, CI check-run reads, deploy trace reads]
---

# CHANGE SPECIFICATION

> **PURPOSE**: Replace the coordinator-as-dispatcher with a scheduling engine that computes parallelism from declared artifacts — one folded dependency graph, artifact-computed readiness, per-repo single-flight leases with a scope field, build-weight resource classes, producer-before-consumer batching with deploy verification, closing-beats-opening ranking, and parks that resume exactly when their condition clears — so lanes stop idling on a coordinator iteration and same-repo deliveries stop colliding, with or without the resident daemon.

## 1. SUMMARY

Deliver the scheduling engine: a programmatic queue whose entries, explicit priorities, and dependency edges fold into one durable graph; readiness recomputed from artifacts on the delivered six-condition model; per-repo single-flight enforced by lease objects carrying a `scope` field, acquired through the state layer's fence-token path so a daemon-down one-shot is mutually exclusive with every other writer; build-weight classes as resource classes rather than lane caps; dependency-aware batching in which a producer precedes its consumer and a producer's deploy verdict gates a dependent repository's merge; a declared total precedence order in which closing beats opening; parks for external windows with per-condition-type recheck intervals, auto-recovery recorded as incidents, and a classified stuck-park bug finding; and the `queue` and `lanes` command families with bounded machine payloads and truthful daemon-down degradation.

Session spawn and dispatch (M1-S9), the resident daemon and its control protocol (M1-S18), and live `--watch` streaming are explicitly out of scope. This change delivers the engine those stories drive: the queue computes the next action, the one-shot scheduling step claims it, and `dispatch` will compose that step rather than reimplement it.

## 2. CONTEXT

### 2.1 Current State Snapshot

The read-only ready-set is delivered (M0-S7): `queue ready <ref>...` evaluates exactly six closed tri-state conditions — `deps-satisfied`, `repo-free`, `tier-known`, `no-owner-gate`, `ci-healthy`, `provider-available` — in a fixed order, names every non-satisfied condition, classifies close association by the repository branch convention, ranks close items (`merge-ready`, `review-pending`) above ready new starts, and writes nothing. Its own spec records that per-repo single-flight is not delivered, that `repo-free` is a local PM-context proxy that cannot see another machine's active change, and that `tier-known` is a triage-label proxy because no per-ticket delivery-tier record exists.

The machine-readable plan is delivered (M1-S13): `delivery.plan.v1` declares per-phase scope, typed done-artifacts, lease names, a build-weight class, producer/consumer interactions, and a ceremony tier as data; validate, diff, and overlap return verdicts; the plan schema explicitly states that the known weight-class vocabulary "belongs to the downstream scheduler", that exact pattern-pair intersection belongs to M1-S17, and that the scheduler consumes overlap verdicts, tier, leases, and weight.

Merge and deploy truth is delivered (M1-S4): `verify deploy` returns `verified | unknown | failed` from a single bounded job-trace read, where an absent declared expectation degrades to `unknown` and never to `verified`; `merge` is a fenced transaction with recorded gate verification and landing evidence. Session lifecycle economics is delivered (M1-S15): durable restart records, a terminal budget-exhaustion record, and a rebuildable per-delivery view yielding restart count and the resume-amplification signal, with `null` plus a warning when a figure cannot be derived, plus the typed `lane` configuration branch.

The state layer is delivered: an append-only verified ledger under `delivery.state.v1`, additive record kinds without schema-version bumps, single-writer fences with a staleness window, verified reads, a disposable derived index, and atomically replaced derived documents. The provider engine persists parks as additive records with read-time expiry and a verified park fold. The result contract is delivered: one `CommandResult` envelope, a machine error table with a `{0, 1, 2}` exit projection, `fallback.invocation`/`fallback.internal` containment, a serialization redaction chokepoint, and binding docs/code error-table synchronization.

The queue, the lanes view, and the resident daemon do not exist. The status digest still reports its `lanes-or-queue` section as a declared `not-delivered` capability gap, and the brief names the scheduling engine (M1-S17) as the owning story while the digest document names M2-S1. There is no queue state, no lease, no park owned by the scheduler, no weight accounting, and no one-shot scheduling path. Nothing computes parallelism from declared plans: the coordinator still reads tickets, remembers dependencies, and starts work by hand.

### 2.2 Pain Points / Gaps

- Parallelism is discovered, not computed: the coordinator decides what runs concurrently, so lane count is a human judgment and idle lanes wait for a coordinator iteration.
- Dependencies live in human memory and ticket prose; there is no durable graph, so "producer before consumer" is discipline rather than machinery.
- No structural single-flight exists: two deliveries can target the same repository at once, and a second machine's active change is invisible to the local PM-context proxy that `repo-free` reads.
- Nothing serializes a daemon-down one-shot: there is no lease, no holder evidence, no stale-lease takeover rule, and therefore no mutual exclusion without the daemon.
- Build weight is echoed by the plan but never accounted: two heavy builds can be scheduled onto one host, and nothing distinguishes a resource class from a lane cap.
- Close items lose to new starts in practice: merge-ready and in-review work waits behind fresh deliveries, so landing throughput depends on operator attention.
- Parks have no scheduler owner: a provider window or quota park has no recheck interval, no resume record, no incident, and no way to detect a park that outlives its condition.
- Nothing surfaces why a lane is idle: `lanes` does not exist, so idle-with-reason, lease holders, restart counters, and amplification are invisible.
- The lanes attention vocabulary already exists in the status digest without any engine to emit it, and the owning story is named inconsistently across two delivered specs.

## 3. PROBLEM STATEMENT

Because the delivery loop has a ready-set but no scheduler, the coordinator must remain the dispatcher: dependencies, repository exclusivity, build weight, closing-versus-opening priority, and park condition evaluation are all computed in a human's head or in ad-hoc scripts, with no durable graph, no lease, and no record of why a lane waited — resulting in idle lanes that wait for a coordinator iteration, same-repo deliveries that collide, heavy builds that co-schedule, merge-ready work that queues behind new starts, parks that never provably resume, and parallelism that cannot be explained, replayed, or audited.

## 4. GOALS

- **G-1**: One durable queue artifact — entries, explicit priorities, repository keys, and dependency edges — folded from appended intent records, with cycle-creating edges refused before any append.
- **G-2**: Readiness recomputed from artifacts, reusing the delivered six-condition vocabulary without redefining it, and naming every non-satisfied condition with evidence.
- **G-3**: Per-repo single-flight as the only structural lane cap, enforced by lease objects that carry a `scope` field, keyed on the normalized remote.
- **G-4**: A daemon-free one-shot scheduling step that claims a lease through the state layer's fence-token path, refuses a conflicting claim with holder evidence, and takes over only a stale lease — so two daemon-down one-shots are mutually exclusive.
- **G-5**: Build-weight classes as a resource class: at most one heavy-class job per constrained runner, never a lane cap, and never a reason to reduce the number of concurrent repositories.
- **G-6**: Dependency-aware batching: a producer is scheduled before its consumer, and a dependent repository merges only after the producer's deploy verdict is `verified` when the producer declares deploy expectations.
- **G-7**: Closing beats opening: merge-ready, in-review, and resumable-parked entries rank above new starts, with preemption releasing a repository under a named park cause.
- **G-8**: Parks that resume exactly when their condition clears, with per-condition-type recheck intervals as configuration, auto-recovery recorded as an incident, and a park outliving its condition surfaced as the classified `queue.park-condition-stuck` bug finding.
- **G-9**: One declared total scheduling precedence so close-first, producer-first, single-flight, weight caps, and parks never compete silently.
- **G-10**: The `queue` and `lanes` command families with bounded machine payloads, deterministic human output, and truthful degradation when no daemon exists.
- **G-11**: Vocabulary growth in-change and in sync: additive state record kinds, new `queue` error identities, new configuration keys, the extended collector-id set, and reconciled docs.

### 4.1 Success Metrics / KPIs

| Metric | Target |
|--------|--------|
| Repositories with two concurrently held `repo-exclusive` leases | 0, under any number of concurrent one-shots or a resident daemon (fixture-driven concurrency suites) |
| Repositories projecting more than one action in one scheduling pass | 0; the remainder is held `repo-claimed-in-pass` and re-evaluated by a later pass |
| Conflicting claims that do not name the holder and lease identity | 0 |
| Live (non-stale) leases taken over | 0 |
| Orphan leases after a takeover-eligible age | 0 |
| Runners carrying more than one heavy-class job | 0 |
| Lane-count decisions taken by consulting capacity, bandwidth, or CI slots | 0; no such code path or configuration key exists |
| Dependent merges that landed before the producer's deploy verdict was `verified` while deploy expectations were declared | 0 |
| Merge-ready entries ranked below a ready new start on the same or a free repository | 0 |
| Parks resumed later than one recheck interval after their condition cleared while a mutating pass ran | 0 |
| Parks cleared without a recorded recovery incident | 0 |
| Parks outliving a cleared condition without a `queue.park-condition-stuck` finding | 0 |
| Read surfaces (`queue list|plan`, `lanes list|show`) performing state writes, fences, or appends | 0 |
| Unreadable lease or park state served as "free" or "not parked" | 0; fail-closed with the classified `state.*` identity |
| Read surfaces that exit 0 with a partial or empty view when lease or park history is unreadable or torn | 0; `queue list`/`queue plan` exit 2 with the classified `state.*` identity and bounded evidence |
| Commands that print an empty or fabricated lane/queue view when the engine state is absent | 0; an explicit empty or degraded marker is always present |
| Configuration-only behavior changes (lease TTL, per-type recheck intervals) demonstrated without code edits | 100% of those knobs |
| Existing `queue ready` behaviour, payload, and error rows changed | 0 |
| State schema-version bumps, migrations, or backfills | 0 |
| Live network calls, live credentials, or real sleeps in the test suite | 0 |

### 4.2 Non-Goals

- **NG-1**: No session spawn, delivery execution, or `dispatch` command. The one-shot delivered here performs the scheduling step (claim and release); M1-S9 composes it.
- **NG-2**: No resident daemon, no control socket, no NDJSON wire protocol, no daemon install/uninstall, no startup reconciliation loop. M1-S18 owns all of it.
- **NG-3**: No live streaming. `--watch` is not part of the accepted grammar for this delivery (see F-10), so no silent empty stream can exist.
- **NG-4**: No change to `queue ready`: its grammar, six-condition sources, ranking, caps, read-only posture, and error reuse are preserved verbatim, including its `repo-free` and `tier-known` proxies.
- **NG-5**: No tracker ticket creation, prioritization, or state transition. The engine reads tracker facts and records only local queue intent.
- **NG-6**: No merge execution and no gate evaluation. The engine reads the delivered `verify deploy` verdict; the merge transaction remains the only landing path.
- **NG-7**: No per-repository parallel mode, no worktree-scoped leases in use, no scope-arbitration or overlap-based lane splitting. The `scope` field is carried and only `repo-exclusive` is implemented.
- **NG-8**: No capacity, bandwidth, concurrency-budget, or CI-slot policy. Those are explicitly not scheduler inputs.
- **NG-9**: No fleet or multi-host coordination, no remote control transport, no distributed lease authority beyond the local state directory.
- **NG-10**: No status-digest behaviour change; the digest's `lanes-or-queue` section stays a declared gap for its own reconciliation.

## 5. FUNCTIONAL CAPABILITIES

| ID | Capability | Rationale |
|----|------------|-----------|
| F-1 | Durable queue declaration: entries, priorities, repository keys, dependency edges, one folded graph artifact | Parallelism can only be computed if the intent to run, its order, its repository, and its prerequisites are one durable artifact instead of coordinator memory. |
| F-2 | Artifact-computed readiness on the delivered six-condition model | Readiness must be re-derived per pass from queue state, plan artifacts, tracker, CI, provider parks, and deploy evidence; a stale or manual ready flag reintroduces discovery. |
| F-3 | Per-repo single-flight through scoped lease objects | The only structural cap that is defensible without capacity policy is one active delivery per repository; a scope field keeps the invariant a policy, not a hardcoded assumption. |
| F-4 | Daemon-free one-shot claim with fence-token exclusion and stale-lease takeover | Mutual exclusion cannot depend on a process that may not be running; the state layer's fence already serializes writers, so the lease is a durable record over that fence. |
| F-5 | Build-weight classes as resource classes | A heavy build overloads a runner; that is a per-runner resource constraint, categorically different from a lane count, and conflating the two would cap parallelism for the wrong reason. |
| F-6 | Dependency-aware batching with deploy verification | A consumer that lands before its producer's contract or deploy is a correctness defect, not a scheduling preference. |
| F-7 | Closing beats opening, with preemption under a named park cause | Landing throughput is gated on closing work; a scheduler that prefers new starts leaves merge-ready work waiting behind operator attention. |
| F-8 | Parks with per-type recheck, exact resume, recovery incidents, and the stuck finding | A park without a recheck contract is an unbounded stall; a park that outlives its condition is a bug that must be classified, not tolerated. |
| F-9 | One declared total scheduling precedence | Close-first, producer-first, single-flight, weight caps, and parks interact; without one order, behavior is implementation-defined and untestable. |
| F-10 | `queue` and `lanes` command surfaces with bounded payloads and truthful degradation | Agents need a deterministic, bounded machine surface to act on, and an absent daemon must degrade declaratively rather than silently. |
| F-11 | Lane observation: state, idle reason, lease holder, restarts, amplification, weight class | Idle lanes are the operator's core symptom; a lane view that names why it is idle is what replaces coordinator polling. |
| F-12 | Guarded vocabulary growth synchronized in-change | New record kinds, error identities, configuration keys, and one collector id must land with their tables and docs in sync, or the contract drifts immediately. |

### 5.1 Capability Details

- **F-1**: Queue membership is explicit intent. `queue add <ref>` records an entry carrying the canonical work item ref, the repository key resolved from the invocation's binding, the declaring checkout's repository root recorded alongside that normalized key as internal state used only for deploy-expectation discovery (DM-1, DM-12), a priority, and its declared dependency edges; `queue prioritize <ref> <n>` sets priority; `queue dep <ref> <on-ref>` adds one edge. Every mutation is an appended intent record under the state layer's fence, and a replay of the identical mutation appends nothing. When the invocation's repository binding cannot be resolved, the entry is still recorded but carries no repository key, is never ready, and reports the delivered bundle reasons (`addressing-unresolved`, `remote-unsupported`) as evidence rather than assuming a repository. The folded graph — entries, edges, priorities, repository keys, resolved weight classes, and rank classes — is one rebuildable artifact; queue reads fold verified ledger truth and never treat a divergent projection as truth. The recorded root stays inside the entry record and is never rendered: `queue list` and `queue plan` project the normalized repository key only, and no read envelope, human output, golden, or telemetry output carries an absolute path (DM-1, DM-12, DM-13, Appendix C). Edge insertion validates acyclicity before appending: an edge that would close a cycle is refused with `queue.dependency-cycle`, names the existing path, lands nothing, and leaves the graph unchanged. A dependency edge may name a ref that has no queue entry (a seeded or externally declared edge); the edge is retained in the folded graph and readiness evaluates it as `unknown` with the delivered `dependency-unobserved` reason, never `satisfied` and never silently dropped, until the producer ref is declared. Edge removal is not delivered in this change; a superseding entry replaces the prior entry projection for the same ref by identity.

- **F-2**: Readiness is the delivered six-condition model, re-derived per pass, with the same ids, order, tri-state, and "ready only when all six are satisfied" rule. Only the sources change where the scheduler has stronger truth: `deps-satisfied` consumes the union of normalized tracker `blocked-by` relations and declared dependency edges (the declared edge is additive and can only make the condition stricter, never looser); a declared edge whose producer ref has no queue entry is evaluated as `unknown` with the delivered `dependency-unobserved` reason, so a consumer of an undeclared producer is not ready; `repo-free` consumes active lease truth for the repository key instead of the local PM-context proxy, and names the holder and lease identity as evidence; `tier-known` consumes the validated plan tier first and the delivered triage-label proxy only when no plan artifact exists. `no-owner-gate`, `ci-healthy`, and `provider-available` reuse the delivered sources and evidence vocabulary unchanged. A source that failed, was not attempted, is unavailable, or is unresolved yields `unknown`, never `satisfied`. An invalid or unreadable plan is `unknown` with the delivered `plan.*` identity as evidence and never invents a tier; a missing plan artifact uses the delivered triage-label proxy as the weaker source, exactly as the tier rule above states. `repo-free` is a read-surface condition and is never a pre-fence claim refusal: a claim decides repository exclusivity only through its in-fence verified lease read, so a repository held by another live holder always projects `queue.lease-conflict`, never `queue.precondition.unmet` (F-4, C-2).

- **F-3**: A lease is a durable object with `scope`, `repoKey`, `holder`, `ref`, `runner`, `acquiredAt`, `heartbeatAt`, `ttlMs`, and lifecycle. It is the runtime enforcement object and is distinct from the plan schema's declared `leases`, which are named resource declarations and a `lease-free`/`lease-taking` phase class; the scheduler reads the plan's declaration as intent evidence, never as a grant. `repo-exclusive` is the only implemented scope: exactly one active lease per repository key, keyed on the normalized remote (`host/owner/name`, protocol, credentials, and `.git` suffix removed). `worktree` is declared and not implementable through any delivered path; no command acquires it and no code path falls back to it. Single-flight is the *only* structural cap: no lane count, per-lane concurrency, bandwidth, or CI-slot limit exists as configuration or code, and a schedule over N distinct repositories yields up to N concurrent leases. The repository key is the contention domain, so two entries in different repositories never contend. Within one scheduling pass, at most one action is projected per repository: after ordering, the first candidate for a repository becomes the action and the remaining ready entries in that repository are held with reason `repo-claimed-in-pass`, a per-pass projection reason distinct from `lease-held` (which requires an actual lease); a later pass re-evaluates them (Appendix B step 13b).

- **F-4**: The one-shot scheduling step is `queue claim [<ref>] [--holder <id>]`. The claim has two ordered stages. **Pre-fence stage:** it evaluates parks and the five non-exclusivity readiness conditions — `deps-satisfied`, `tier-known`, `no-owner-gate`, `ci-healthy`, and `provider-available` — and refuses `queue.precondition.unmet` when any is not satisfied; an active uncleared park on the entry is likewise a pre-fence `queue.precondition.unmet` refusal naming `parked:<cause>` and its recheck interval, while a stuck park is the separate `queue.park-condition-stuck` refusal below. `repo-free` is excluded from the pre-fence gate: a claim never refuses `queue.precondition.unmet` for a repository that is not free, because repository exclusivity is decided only by the verified in-fence lease read. **In-fence stage:** it acquires the state fence, re-reads the verified lease history for the repository key *inside* the fence, and appends only when the read shows no live lease, a stale lease eligible for takeover, or the caller's own lease (renewal or heartbeat refresh). The post-append verification requires exactly one new record of the expected kind under the repository key. A live lease held by another holder refuses with `queue.lease-conflict` at exit 1, consequence `not_landed`, naming the holder, lease identity, acquisition time, heartbeat age, and the earliest takeover-eligible time. A lease is stale when its heartbeat age is at or beyond `queue.lease-ttl`; a takeover appends a new acquisition record that names the taken-over lease, its holder, its heartbeat age, and its last heartbeat time, so the takeover is always evidenced. A live lease is never taken over, and the state fence's own staleness window is a distinct mechanism from the lease TTL — the fence is held only for the duration of one write. Claiming an entry that is not ready on any of the five pre-fence conditions, is outranked by a higher-ranked eligible action for the same repository, or is held by a weight class the runner cannot take refuses with `queue.precondition.unmet` naming the reason; a repository that is not free is never a precondition refusal — it is the `queue.lease-conflict` outcome proven in the in-fence read, and a repeated claim by the holder that already owns the lease is a renewal, not a conflict. `queue release <ref> [--holder <id>] [--park <cause>]` appends the release and, when a park cause is named, the park record in the same fenced transaction — both land or neither; releasing when no lease exists is an explicit idempotent no-op, and releasing another holder's live lease refuses. An unreadable or torn lease history is never read as "free": the claim refuses with the classified `state.*` identity at exit 2. When `[<ref>]` is omitted, the claim selects the top-ranked eligible action from the same precedence and readiness computation (Appendix B), deterministically, and the envelope names the selected ref; when no action is eligible it refuses with `queue.precondition.unmet` (reason `no-eligible-action`) at exit 1 with zero appends. A claim on an entry whose park is classified `queue.park-condition-stuck` refuses with that identity at exit 1, consequence `not_landed`, zero appends, and is never reported as a lease conflict.

- **F-5**: The scheduler's weight-class vocabulary is closed: `standard` and `heavy`. An entry's class resolves from the validated plan (phase `weightClass` or `defaultWeightClass`); an absent declaration resolves to `standard`; a declared but unrecognized value resolves to `heavy` — the conservative direction, matching the delivered overlap rule's preference for a false sequence over a false parallel. `Absent declaration` means a validated plan that omits the weight field; a plan that is invalid, unreadable, or absent cannot declare a class and resolves to `heavy` with source evidence `plan-unreadable` or `plan-absent` and the delivered `plan.schema.invalid` or `plan.artifact.missing` identity, so an unvalidatable plan can never co-schedule as `standard`. An invalid or unreadable plan is independently held by readiness (`tier-known` unknown); an absent plan is subject to the heavy cap and to the delivered triage fallback's readiness verdict, so the entry is held from standard-class scheduling regardless. The runner identity is the declared execution-environment identity (the host is the only implementation today, one runner per state directory), recorded on the lease so the accounting survives a future containerized or remote runner without redesign. At most one heavy-class lease is active per runner: a heavy claim is held with reason `weight-class` while another heavy lease is active on that runner, and standard entries continue to be scheduled — a weight cap never reduces the number of active repositories.

- **F-6**: Declared dependency edges carry ordering and, where declared, deploy gating. A producer precedes its consumer: a consumer is not eligible while its producer's change is unresolved, which removes the pair from competition rather than merely reordering it. When both are eligible in the same repository, the producer ranks ahead of the consumer regardless of priority; in different repositories both may be concurrent and the producer merely appears first in the ordered action list. For a dependent repository's merge action, the producer's landing must be observed through the delivered landing evidence, and when the producer's repository declares deploy expectations through the delivered `merge.deploy-expectations` configuration, the delivered `verify deploy` verdict must be `verified` with its evidence; `unknown`, `failed`, or an unreadable trace holds the dependent at `deploy-unverified` — never green. Expectations are resolved from the producer repository's own configuration bound to the producer entry's recorded repository key (DM-12), never from the invocation's configuration; the key is the producer's normalized remote recorded at declaration, and the producer config is resolved against the repository root recorded at declaration whose normalized remote matches that key exactly. Roots are discovered only from entry records (DM-1, DM-12): a match is exact string equality on the normalized key, and a candidate root is used only when its own normalized remote equals the recorded key. A producer config that is missing, unreadable, or invalid — including the case where no recorded root matches the key, or two distinct recorded roots both claim the key (a collision) — yields `unknown`, never `not-declared` and never `verified`, and the dependent holds `deploy-unverified`. A collision is never resolved by picking one root. When the producer declares no deploy expectation, the gate is landing-only and the evidence records `deploy: not-declared` so the weaker guarantee is visible. Deploy verdict reads are bounded per pass and memoized per producer within the pass; edges beyond the read bound are held `deploy-unverified` with reason `read-budget-exhausted`.

- **F-7**: Scheduling rank classes are closed and ordered: `merge-ready` (0), `in-review` (1), `resume-parked` (2), `new-start` (3). `merge-ready` and `in-review` reuse the delivered close-association classification (`merge-ready` requires an observed approval on a non-draft open pull request; `in-review` covers every other associated open pull request, the population `queue ready` calls `review-pending`). `resume-parked` applies only to a parked entry whose condition has evaluated clear and is therefore resumable in this pass — an uncleared park is not a rank candidate at all, which is why "parked ranks above new starts" is a meaningful statement rather than a contradiction. A park classified `queue.park-condition-stuck` is excluded before rank assignment (Appendix B step 7b): it is never `resume-parked`, never appears in `nextActions`, and is never selected by a no-ref claim. Preemption is computed, not improvised: when a close item is eligible for a repository whose lease is held by a new start, the pass emits a preemption action naming the park cause `preempted-for-close-item` (paired with condition type `preemption`), and the release path records that park. Single-flight still holds until the release lands, so the close item is not scheduled in the same pass. Automatic execution of preemption belongs to M1-S18; in this change the action is emitted and the release is performed by `queue release --park`.

- **F-8**: A park is a durable object carrying the entry, the repository key, a closed cause and a closed condition type (two distinct closed sets, declared below), an absolute expiry when the condition supplies one, the resolved recheck interval, the last evaluation time, and the recovery state. The two closed sets are distinct and are never conflated: the **condition-type set** is what a pass re-evaluates, and the **cause set** is why the lease was released. The condition-type set is `provider-window` (clears at the provider window's absolute expiry), `provider-quota` (clears when the provider condition is observed available again), and `preemption`. The cause set is `provider-window`, `provider-quota`, and `preempted-for-close-item`. The valid pairings are one-to-one: cause `provider-window` ↔ condition type `provider-window`; cause `provider-quota` ↔ condition type `provider-quota`; cause `preempted-for-close-item` ↔ condition type `preemption`. The `preemption` condition supplies no absolute expiry: it is re-evaluated each pass at the preemption recheck interval and clears when the repository's lease is observed free (the close item's claim and later release completed) and the entry is ready again. `queue release --park <cause>` accepts exactly the closed cause set; any other token is an invocation rejection through the delivered `fallback.invocation` containment at exit 1 and appends nothing, while omitting `--park` releases without a park, and an accepted cause is recorded together with its paired condition type. Owner gates and external waits are not parks: they are readiness blockers and typed questions on their own surfaces. On every pass, each active park whose interval has elapsed is re-evaluated; a cleared condition is recovered in the same pass on a mutating surface with a `queue.incident` record naming the condition, the clear time, the evaluation time, and the observation gap since the previous evaluation. Before attempting recovery, the mutating pass appends a `queue.park` record with `recoveryState: clear-observed`, `clearObservedAt`, the evaluation time, and the observation gap; this durable marker is what makes a prior-pass clear observation visible to a later verified read without any read writing. If recovery lands in the same pass, the `recovered` record supersedes the marker; if the recovery append is refused, the marker persists and the pass returns the stuck identity. A park that a pass observed clear and that is still active on a later pass — because the recovery did not take effect — or whose recovery append was refused, is the `queue.park-condition-stuck` bug class: read surfaces report it as a report-only finding at exit 0 without failing, and a mutating claim on that entry refuses with `queue.park-condition-stuck` at exit 1, consequence `not_landed`, zero appends, rather than claiming behind a park that should have cleared. A park that was simply not evaluated while no engine process ran carries no `clear-observed` marker and is never stuck on the first pass after the gap; it recovers with an incident naming the gap. A stuck park is never a `resume-parked` candidate, is never emitted in `nextActions`, and is never selected by a no-ref claim: the schedule reports the `park-condition-stuck` blocking reason and the `queue.park-condition-stuck` finding, and a claim on it refuses as pinned (C-7).

- **F-9**: The precedence order is fixed and total (Appendix B): hard exclusions first (readiness, dependency and deploy gates, parks, single-flight, weight caps), then rank class, then producer-before-consumer among entries contending for one repository, then explicit priority ascending, then numeric reference suffix, then canonical ref text. Hard exclusions remove a candidate and never reorder it; ordering rules never override a hard exclusion. After ordering, Appendix B step 13b projects at most one action per repository per pass and holds the remaining ready entries in that repository with reason `repo-claimed-in-pass` for a later pass. Close-first therefore can never admit an entry past a gate, and a gate can never demote a close item below a new start — it removes it with a named reason. Priority is a non-negative integer where the lower value is earlier, defaulting to a declared constant; changing a priority changes order only inside one rank class.

- **F-10**: `queue` gains `list`, `plan`, `add`, `prioritize`, `dep`, `claim`, and `release`; `ready` is untouched. `lanes` adds `list` and `show <lane>`. `queue plan [--next <n>]` computes the next actions with reasons; `queue list` renders the graph, leases, weight loads, and parks. Mutating subcommands write state; when no daemon is reachable they still land and the envelope carries `degraded: ["daemon-unreachable"]` at exit 0 — state is authoritative and the daemon reconciles later. `queue list` and `queue plan` are read-only but fail closed: when lease or park history is unreadable, torn, or of unknown kind, they exit 2 with the classified `state.*` identity, emit the bounded evidence on that identity, and do not report success or present a `data` sibling, a partial view, or an empty view as a schedule. A readable `queue.park-condition-stuck` remains a report-only finding at exit 0. `--watch` is **not** in the accepted grammar for this delivery: an invocation carrying it is refused through the delivered `fallback.invocation` containment with a remediation hint naming the resident daemon story. Omission is chosen over an accepted-but-degraded flag because accepting it would require daemon vocabulary and a transport seam this change does not deliver, and because a refused flag is strictly truthful; no silent empty stream is representable.

- **F-11**: Lane identity is the canonical work-item ref, because no lane registry is delivered and a synthetic ordinal would change across restarts. The lane state vocabulary is the five lane states declared by the M1 `lanes` design pack — `delivering`, `idle-with-reason`, `parked`, `merge-ready`, `in-review` — extended in this change by the additive state `failed` (a lane whose delivery failed past its restart budget), giving the `lanes` command's six-value closed state set; it is not a delivered contract set today, and `failed` is this change's additive value. That six-value set is distinct from the status digest's attention-state set `{delivering, idle-with-reason, idle-no-reason}`, which this change does not alter: the digest projection remains a narrower, separately owned vocabulary, and `lane.idle-no-reason` stays dormant after this change because an idle lane always carries a bounded idle reason drawn from the blocking conditions and the scheduler's holds (NG-10). Each lane carries its lease holder and scope when held, its restart count and amplification signal from the delivered economics view (`null` with a warning when underivable, never a fabricated zero), and its weight class. Lanes are a pure fold over queue entries, leases, parks, and economics records: no lane record kind exists and no lane state is stored. An unreadable queue store surfaces as the declared `status.collector.lanes.unavailable` identity at exit 2, never as a zero-lane view.

- **F-12**: Vocabulary growth lands in-change: five additive record kinds inside `delivery.state.v1` with their own payload schema identifiers and store-scoped keys (Appendix D), one rebuildable derived document, one new `queue` domain kind with exactly five documented rows — `queue.dependency-cycle`, `queue.lease-conflict`, `queue.park-condition-stuck`, `queue.entry.unobserved`, and `queue.precondition.unmet` (Appendix F) — the collector-id set extended from `tracker` to `tracker` and `lanes`, and one new typed `queue` configuration branch with `queue.lease-ttl` and `queue.park-recheck.<type>` (Appendix E). Existing rows, keys, and record kinds are unchanged; the machine table, the documented table, the source references, and the fixtures agree in both directions. A park finding is report-only on read surfaces and becomes a classified error only where a mutating pass cannot proceed, so the same identity never appears twice in one outcome.

### 5.2 Contract clarifications (2026-11-07 amendment)

These seven clarifications pin ambiguities surfaced by the test plan. They refine, and do not expand, the in-scope capabilities in §5.1; the affected capabilities, records, NFRs, acceptance criteria, and appendices below are amended to match.

| ID | Resolves | Clarified rule | Pinned in |
|----|----------|----------------|-----------|
| C-1 | OQ-T1 | When lease or park history is unreadable, torn, or of unknown kind, `queue list` and `queue plan` exit 2 with the classified `state.*` identity, emit the bounded evidence on that identity, and do not report success or present a `data` sibling, a partial view, or an empty view as a schedule. A schedule that cannot verify leases or parks cannot truthfully answer "what is next"; NFR-2 forbids writing a recovery, and NFR-13 forbids an all-clear. A readable park observed clear but still active remains a report-only `queue.park-condition-stuck` finding at exit 0. | F-10, NFR-2, NFR-13, DM-14, AC-F10-3, Appendix C |
| C-2 | OQ-T2 | AC-F3-1 is split into (a) read-only projection: `queue plan`/`queue list` show exactly one eligible action per repository — any other ready entry in that repository is held `repo-claimed-in-pass` before a lease exists — and, once a lease exists, name `lease-held` with holder and lease evidence for the other entry, without claiming a lease; and (b) mutating enforcement: concurrent or repeated claims on one repository acquire exactly one `repo-exclusive` lease and refuse the rest with `queue.lease-conflict`. `repo-free` is never a pre-fence claim refusal; the in-fence verified lease read owns the exclusivity outcome, so a repository held by another live holder always projects `queue.lease-conflict`, never `queue.precondition.unmet`, and a same-holder repeat claim is a renewal. | F-2, F-3, F-4, DM-4, NFR-2, NFR-3, AC-F3-1(a)/(b), AC-F4-1 |
| C-3 | OQ-T4 | A prior-pass clear observation is durably recorded on the `queue.park` record itself: a mutating pass that observes a condition clear appends a `clear-observed` park record (payload `delivery.queue.park.v1`, key `queue.parks:<REF>`) carrying `clearObservedAt`, `recoveryState: clear-observed`, the evaluation time, and the observation gap, before attempting recovery; this is the same active park's latest record, not a second park. A later verified read that sees an active park whose latest record is `clear-observed` with no later `recovered` record reports the stuck finding; reads never append. If recovery lands in the same pass, the `recovered` record supersedes the marker; if the recovery append is refused, the marker persists and the pass returns the stuck identity. | F-8, DM-5, EVT-4, NFR-2, NFR-5, Appendix D |
| C-4 | OQ-T5 | `queue claim` without a ref selects the top-ranked eligible action from the same precedence and readiness computation (Appendix B), deterministically, with ties resolved by Appendix B steps 10–13; the envelope names the selected ref. When no action is eligible, it refuses `queue.precondition.unmet` with reason `no-eligible-action` at exit 1 and appends nothing. An explicit ref keeps the existing precondition checks. | F-4, F-9, DM-9, EVT-3, NFR-1, AC-F4-3, DEC-12 |
| C-5 | OQ-T6 | Weight resolves from a validated plan only. A validated plan that omits the weight declaration resolves to `standard`; a validated plan with an unrecognized value resolves to `heavy`; a plan that is invalid, unreadable, or absent cannot declare a class and resolves to `heavy` with source evidence `plan-unreadable` or `plan-absent`, naming the delivered `plan.schema.invalid` or `plan.artifact.missing` identity. Such an entry is never scheduled as `standard`: an invalid or unreadable plan is held by readiness (`tier-known` unknown), and an absent plan is subject to the heavy cap or the triage fallback's readiness verdict. The entry is held from standard-class scheduling regardless. | F-5, F-2, DM-7, DEC-10, AC-F5-2 |
| C-6 | OQ-T7 | Deploy expectations resolve from the producer repository's own configuration bound to the producer entry's recorded repository key (DM-12), not from the invocation's configuration. The key is the producer's normalized remote recorded at declaration; the declaring checkout's repository root is recorded on the entry alongside that key (DM-1), and the producer config is resolved against the recorded root whose own normalized remote equals the key by exact string equality. Roots are discovered only from entry records; if no recorded root matches the key, two distinct roots claim the same key (a collision, never resolved by picking one), or the matched config is missing, unreadable, or invalid, the expectation is `unknown` (never `not-declared` and never `verified`), and the dependent holds `deploy-unverified`. | F-6, DM-1, DM-2, DM-12, NFR-13, AC-F6-2, DEC-13 |
| C-7 | OQ-T1 (stuck-park exit) | A claim on an entry with a `queue.park-condition-stuck` finding refuses at exit 1 with `queue.park-condition-stuck`, consequence `not_landed`, zero appends, and never falls through to a lease conflict. Reads report the same identity only as a report-only finding at exit 0 when the park history is readable; an unreadable park history is the C-1 exit-2 case. | F-8, DM-14, NFR-13, AC-F8-1, Appendix C, Appendix F |

## 6. USER & SYSTEM FLOWS

```
Flow 1: Declare work and prerequisites
  Agent or coordinator (in the change's repository checkout)
    → queue add GH-301 --priority 10 --dep GH-300
    → entry + edge append under the fence; acyclicity validated first
    → cycle-creating edge refused: queue.dependency-cycle, nothing landed
    → queue prioritize GH-301 5 / queue dep GH-302 GH-301
    → folded graph updated; a replayed identical mutation appends nothing.

Flow 2: Compute the next actions (read-only, daemon or not)
  Any invocation → queue plan --next 3
    → fold queue intent + leases + parks from verified state
    → for each entry in precedence order: readiness (six conditions), gates,
      rank class, weight accounting, deploy gating
    → stuck parks excluded before ranking; after ordering, at most one action
      per repository (the remainder held repo-claimed-in-pass)
    → nextActions[] with reasons; parks with recheck intervals;
      degraded=["daemon-unreachable"] when no daemon is reachable
    → 0 writes, 0 fences, 0 appends. A failed source is evidence, not a failure.
    → unreadable/torn lease or park history → exit 2, classified state.*,
      evidence emitted, no success view.

Flow 3: Claim the scheduling step (one-shot, daemon-free)
  Agent or coordinator → queue claim [<ref>] [--holder <id>]
    → pre-fence: evaluate parks and the five non-exclusivity readiness
      conditions; recover a cleared park, record the incident.
      repo-free is not a pre-fence refusal.
    → no ref → select the top-ranked eligible action deterministically;
      envelope names it
    → no eligible action → queue.precondition.unmet (no-eligible-action), exit 1
    → stuck park on the entry → queue.park-condition-stuck, exit 1, zero appends
    → acquire the state fence
    → re-read verified lease history for the repository key (inside the fence)
      · no live lease                → append acquisition (scope repo-exclusive)
      · stale lease (age ≥ TTL)      → append acquisition naming the takeover
      · caller's own lease           → refresh heartbeat (no new holder)
      · another live holder          → refuse queue.lease-conflict, exit 1,
                                       naming holder, lease, heartbeat age
    → post-append verification: exactly one new lease record
    → envelope: lease, computed action, degraded marker
  The holder delivers; queue release <ref> [--park <cause>] ends the lease
  (release + park land together or not at all). Nothing about the lease
  depends on a daemon existing.

Flow 4: Park and resume exactly on condition
  Provider window closes mid-delivery (or a quota condition trips)
    → entry parked with cause, typed condition, absolute expiry where the
      condition supplies one, and the resolved per-type recheck interval
    → each later pass whose interval elapsed re-evaluates the condition
    → condition clear → recovery in the same pass + queue.incident
      (condition, clear time, evaluation time, observation gap)
    → before recovery, a clear-observed park record is appended (durable marker)
    → recovery lands → recovered record + incident; recovery refused → marker
      persists and the next claim refuses queue.park-condition-stuck at exit 1
    → a pass that finds it clear but still active (recovery did not land,
      or the recovery append was refused) → queue.park-condition-stuck
      finding on reads / refusal on claim — a classified bug, never silence,
      and never a scheduled next action.

Flow 5: Producer before consumer, deploy verified before dependent merge
  GH-300 (producer, repo-alpha) and GH-301 (consumer, repo-beta)
    → GH-301 is not eligible while GH-300 is unresolved (hard gate)
    → GH-300 claims and delivers; landing observed
    → repo-alpha declares merge.deploy-expectations → verify deploy must read
      verified with evidence before GH-301's merge action is eligible
    → deploy expectations are read from repo-alpha's own config bound to
      repo-alpha's recorded repository key (not the invocation's config)
    → missing/unreadable producer config → unknown, held deploy-unverified
      (never not-declared, never verified)
    → verified → GH-301's merge action becomes eligible (deploy evidence named)
    → unknown / failed / read-budget-exhausted → held deploy-unverified
    → no declared expectation → landing-only gate, evidence "deploy: not-declared".

Flow 6: Closing beats opening, and preemption
  GH-310 merge-ready (repo-alpha) is eligible while GH-311 (new start,
  repo-alpha) holds the repo-alpha lease
    → merge-ready ranks first (0) but single-flight still holds the lease
    → the pass emits a preemption action with park cause
      preempted-for-close-item, naming the holder of GH-311
    → queue release GH-311 --park preempted-for-close-item releases the repo
      and parks GH-311 under that named cause
    → next pass schedules GH-310; GH-311 becomes resume-parked and ranks
      above new starts once its condition clears.

Flow 7: Lane observation
  Operator or agent → lanes list | lanes show <ref>
    → fold entries + leases + parks + economics
    → state, bounded idle reason, lease holder and scope, restarts,
      amplification (null + warning when underivable), weight class
    → --watch refused as an invocation error (no daemon stream in this release)
    → unreadable store → status.collector.lanes.unavailable, exit 2, never zero.
```

## 7. SCOPE & BOUNDARIES

### 7.1 In Scope

- Queue declaration and the folded graph artifact: entries, priorities, repository keys, dependency edges, and cycle refusal (F-1).
- Artifact-computed readiness on the delivered six-condition model, with scheduler truth for `deps-satisfied`, `repo-free`, and `tier-known` (F-2).
- Per-repo single-flight lease objects with a `scope` field, repository-key normalization, and the "only structural cap" invariant (F-3).
- Per-pass single-flight projection: at most one projected action per repository, with the remainder held `repo-claimed-in-pass` and re-evaluated by a later pass (F-3, AC-F3-1(a), Appendix B step 13b).
- The daemon-free one-shot scheduling step: fence-token claim, conflict refusal with holder evidence, stale-lease takeover with evidence, release, and park-on-release (F-4).
- Build-weight classes as a per-runner resource class with the committed conservative mapping (F-5).
- Dependency-aware batching, producer precedence, and the deploy-verified gate before a dependent repository merges (F-6).
- Closing-beats-opening rank classes, resumable-park ranking, and the computed preemption action with its named park cause (F-7).
- Parks with closed condition types, per-type recheck configuration, exact resume, recovery incidents, and the stuck-park finding and refusal (F-8).
- The declared total precedence order (F-9, Appendix B).
- The `queue` and `lanes` command families with bounded payloads, deterministic human output, and the truthful daemon-down degradation marker (F-10, F-11).
- Read-surface fail-closed projection for unreadable lease or park history, distinct from the report-only stuck-park finding (F-10, C-1, NFR-13).
- Deterministic no-ref claim selection and its no-eligible refusal (F-4, C-4, AC-F4-3).
- Producer-bound deploy-expectation resolution across a multi-repository state directory (F-6, C-6, AC-F6-2).
- Additive state record kinds, derived queue graph, `queue` error kind, extended collector-id set, and the typed `queue` configuration branch — all synchronized in-change with their docs (F-12).

### 7.2 Out of Scope

- [OUT] `dispatch` and any session spawn, delivery execution, harness selection, or resume handling (M1-S9).
- [OUT] The resident daemon, control socket, NDJSON wire protocol, `daemon start|stop|status|install`, startup reconciliation, and restart budgeting across daemon restarts (M1-S18).
- [OUT] `--watch` live streaming on `lanes` or `queue`; the flag is refused rather than accepted-and-degraded.
- [OUT] Any change to `queue ready`: grammar, sources, ranking, caps, read-only guarantee, and error reuse are preserved.
- [OUT] Tracker writes, ticket creation, label changes, or state transitions.
- [OUT] Merge execution, gate evaluation, waiver handling, and rebase-refresh; the engine reads the delivered deploy verdict only.
- [OUT] Worktree-scoped leases in use, per-repository parallel mode, scope arbitration, overlap-driven lane splitting, and demotion or arbitration of conflicting lanes.
- [OUT] Capacity, bandwidth, concurrency-budget, CI-slot, or spend-based scheduling; these are explicitly not lane inputs.
- [OUT] Fleet or multi-host coordination and any transport beyond the local state directory.
- [OUT] Typed question authoring for blocked entries (M1-S16); the engine only names blocking conditions.
- [OUT] Status digest and brief behaviour change, including their `lanes-or-queue` gap section.
- [OUT] Automatic preemption execution; the action is computed and the release is performed explicitly.

### 7.3 Deferred / Maybe-Later

- `worktree`-scoped leases and per-repository parallel lanes once the parallel mode is enabled; the scope field and repository-keyed contention domain are the seams.
- Tracker-driven queue discovery (auto-feeding entries from open, ready tickets) instead of explicit `queue add`.
- Per-runner heavy limits as configuration once more than the host runner exists.
- Additional park condition types beyond provider windows, quota, and preemption; each is a spec change with its own default interval.
- Additional priority classes, aging, or fairness policy across repositories.
- Preemption classes beyond close-items (for example owner-ordered preemption), which need a declared cause and an authority rule.
- A bounded `--watch` stream once the daemon and control protocol exist.

## 8. INTERFACES & INTEGRATION CONTRACTS

### 8.1 REST / HTTP Endpoints

None. No HTTP server surface is introduced. The contracts are the command grammars, the envelope payload shapes (Appendix C), the error identities (Appendix F), and the state record kinds (Appendix D). All outbound traffic is read-only through delivered adapter seams: tracker issue pages, pull-request pages, check-run pages, and deploy job traces. No write operation is added on any provider surface.

### 8.2 Events / Messages

| ID | Event / Message | Contract |
|----|-----------------|----------|
| EVT-1 | `queue.entry` intent record | Appended by `queue add` and `queue prioritize` under the state fence; payload schema `delivery.queue.entry.v1` under the store-scoped key `queue.entries:<REF>`; carries the ref, repository key, the declaring checkout's repository root, priority, and recorded time. The root is internal entry state for deploy-expectation discovery (DM-1, DM-12) and is never rendered by a read surface. Latest record wins; an identical replay appends nothing; a malformed or wrong-kind record under the prefix is a classified `state.*` failure, never a fabricated entry. |
| EVT-2 | `queue.dependency` intent record | Appended by `queue add --dep` and `queue dep`; payload schema `delivery.queue.dependency.v1` under `queue.deps:<REF>`; carries the folded declared edges originating at the ref. Acyclicity is validated before the append; a duplicate edge appends nothing; a cycle-creating edge lands nothing. |
| EVT-3 | `queue.lease` execution record | Appended by whichever process performs the claim or release — one-shot or daemon — with writer attribution; payload schema `delivery.queue.lease.v1` under `queue.leases:<repoKey>`; carries scope, repository key, holder, ref, runner, weight class, acquisition, heartbeat, TTL, lifecycle operation (`acquired`, `renewed`, `released`, `taken-over`), takeover evidence, and recorded time. Exactly one new record per operation, verified post-append. |
| EVT-4 | `queue.park` execution record | Appended on park, clear observation, recovery, and release; payload schema `delivery.queue.park.v1` under `queue.parks:<REF>`; carries cause, condition type, absolute expiry when the condition supplies one, resolved recheck interval, evaluation time, `clearObservedAt`, `recoveryState` (`parked`, `clear-observed`, `recovered`, `released`), recovery time, and the release cause when parked on release. A `clear-observed` append is the durable prior-pass observation; a `recovered` append supersedes it; at most one active park per entry. |
| EVT-5 | `queue.incident` execution record | Appended on auto-recovery and on stale-lease takeover; payload schema `delivery.queue.incident.v1` under `queue.incidents:<REF>` (or `queue.incidents:<repoKey>` for takeovers); carries the incident type, the bounded evidence (condition and times for recovery; previous holder, lease, and heartbeat age for takeover), and recorded time. Never carries free-form prose. |
| EVT-6 | Computed schedule and findings view | Envelope-only: ordered `nextActions[]`, `entries[]`, `leases[]`, `weights`, `parks[]`, `findings[]`, and `degraded[]`. Never persisted; two identical passes over identical state produce byte-identical output. |

New record kinds join the existing state schema additively: no schema-version bump, no migration, no backfill, and no change to existing record kinds, reads, or boundaries. No record carries a secret, a credential reference value, a raw provider payload, or free-form message content.

### 8.3 Data Model Impact

| ID | Element | Description |
|----|---------|-------------|
| DM-1 | Queue entry | Canonical ref, repository key (absent when the binding could not be resolved), the declaring checkout's repository root recorded alongside that key (absolute path; absent when the key is absent; internal only — used solely for deploy-expectation discovery per DM-12 and never rendered by a read surface), non-negative priority with a declared default, and recorded time. The effective weight class, tier, and rank class resolve per pass from artifacts and are never frozen on the entry. Identity is the canonical ref. |
| DM-2 | Dependency edge | Directed edge from a consumer ref to a producer ref, with the ordering role and the deploy-gating applicability derived from the producer repository's own declared deploy expectations, resolved against the producer's recorded repository key. An edge may name a producer ref with no queue entry; readiness evaluates that edge as `unknown` with `dependency-unobserved` until the producer is declared. |
| DM-3 | Readiness evaluation | Six conditions in the delivered fixed order with the closed tri-state, bounded evidence, and named blocking conditions; ready only when all six are satisfied. |
| DM-4 | Lease with scope | Scope (`repo-exclusive` implemented; `worktree` declared and unused), repository key, holder identity, ref, runner identity, weight class, acquisition and heartbeat times, TTL, lifecycle operation, and takeover evidence. |
| DM-5 | Park | Entry, repository key, a closed cause from the cause set `{provider-window, provider-quota, preempted-for-close-item}`, a closed condition type from the condition-type set `{provider-window, provider-quota, preemption}` with the one-to-one pairing `provider-window↔provider-window`, `provider-quota↔provider-quota`, `preempted-for-close-item↔preemption`, an absolute expiry when the condition supplies one, the resolved recheck interval, the last evaluation time, `clearObservedAt`, `recoveryState` (`parked`, `clear-observed`, `recovered`, `released`), clear time, recovery time, and release cause when parked on release. A `clear-observed` record is the durable prior-pass observation that makes stuck detection possible without a read writing. |
| DM-6 | Incident | Type (`park-auto-recovery`, `lease-stale-takeover`), bounded typed evidence, entry or repository key, and recorded time. |
| DM-7 | Weight class | Closed values `standard` and `heavy`; resolved from a validated plan, defaulted to `standard` when a validated plan omits the field, mapped conservatively to `heavy` when a declared value is unrecognized, and mapped to `heavy` with source evidence `plan-unreadable` or `plan-absent` when the plan cannot be read or validated. |
| DM-8 | Scheduling rank class | Closed ordered values `merge-ready`, `in-review`, `resume-parked`, `new-start`; derived from the delivered close-association classification and the park state. |
| DM-9 | Scheduled action | One computed action: ref, repository key, rank class, reason, priority, weight class, lease status, blocking conditions, and the preemption block when the action is a preemption. When a claim omits the ref, the selected action's ref is the selected ref and the envelope names it. |
| DM-10 | Preemption block | The parked release: target ref, repository key, holder, park cause `preempted-for-close-item` paired with condition type `preemption`, and the close item that motivated it. |
| DM-11 | Lane view | Ref as lane identity, closed lane state from the six-value `lanes` set (`delivering`, `idle-with-reason`, `parked`, `merge-ready`, `in-review`, and this change's additive `failed`), bounded idle reason, lease holder and scope, restart count and amplification from the delivered economics view, and weight class. |
| DM-12 | Repository key and root | The repository key is the normalized `host/owner/name` from the invocation's repository binding, with protocol, credentials, userinfo, and `.git` suffix removed; it is the contention domain for single-flight and the key for weight accounting. Each entry also records the declaring checkout's repository root. Deploy-expectation discovery uses only entry-recorded roots: a candidate root is matched by exact equality between its own normalized remote and the producer's recorded key; exactly one match resolves the producer config, and the same root path recorded by several entries is one candidate, not a collision. No match, two distinct roots claiming one key (collision — never resolved by picking one), or an unreadable or invalid matched config yields `unknown`. The invocation's own root is never substituted for another repository's root. The recorded root is internal state only: it is never serialized into a command envelope, a finding, an incident, a golden, a log line, or a telemetry event, and read surfaces render the normalized key alone. |
| DM-13 | Queue graph document | Rebuildable derived document folding entries, edges, priorities, repository keys, weight classes, and rank classes; replaced atomically only when intent truth changes and never read as truth when divergent. The entry's recorded repository root (DM-1) is deliberately not folded into this document and is never rendered by a read surface. |
| DM-14 | Finding | A stable finding code with a severity and bounded evidence; `queue.park-condition-stuck` is the scheduler's own code; report-only on reads at exit 0 and a refusal at exit 1 only on a claim. |

### 8.4 External Integrations

All integrations are existing read paths, consumed without new adapter operations:

- **Tracker** — issue page reads for `blocked-by` relations, owner-attention labels, and triage labels, through the delivered bounded read.
- **VCS and pull requests** — the delivered open-pull-request read for close association, and the branch-convention association rule, unchanged.
- **CI** — the delivered check-runs page and `succeeded`-only classification for `ci-healthy`, unchanged.
- **Deploy trace** — the delivered `verify deploy` verdict and its evidence, read only for producer edges that gate a dependent merge, bounded and memoized per pass.

No tracker, VCS, or CI write is performed. No vendor credential is read outside the delivered credential port, and no payload carries provider response bodies.

### 8.5 Backward Compatibility

- **`queue ready` is unchanged.** Grammar, the six conditions and their proxy sources, ranking, caps, byte bounds, read-only guarantee, and the absence of new error rows all carry over verbatim; the scheduler consumes the same condition vocabulary rather than redefining it.
- **The `queue` family is extended, not altered.** `ready` keeps its behaviour; the new subcommands are additive. An existing `queue ready` invocation produces byte-identical output.
- **`lanes` is new.** No previous surface is replaced; refusing `--watch` is an invocation failure, not a silent behaviour change.
- **Error table growth is additive.** One new `queue` domain kind with five rows and one new collector id in the delivered family; no existing row is renumbered, removed, or reinterpreted. The docs/code synchronization check stays green in both directions.
- **Configuration growth is additive.** A new typed `queue` branch ships with defaults, so an absent branch is valid and behaviour is defined without any operator action; existing branches are untouched.
- **State is additive.** Five record kinds and one derived document join `delivery.state.v1` with no schema-version bump; a store that has never seen a queue record reads as verified-empty, never torn; existing consumers are unaffected.
- **Writer ownership is refined, not overturned.** The architecture's default assignment of leases to the daemon is a default, not an exclusion: the pinned decision makes the lease class writable by whichever process holds the fence, with writer attribution and the daemon as the usual holder. No intent class is written by the engine, and no execution class is written by a command that did not perform the operation.
- **No behaviour change lands in delivered surfaces.** The status digest keeps its declared `lanes-or-queue` gap; its stale expected-story reference is flagged for its owning reconciliation rather than changed here.

## 9. NON-FUNCTIONAL REQUIREMENTS (NFRs)

| ID | Requirement | Threshold |
|----|-------------|-----------|
| NFR-1 | Determinism | Identical queue state, artifacts, provider facts, and injected clock produce byte-identical payloads, findings, and human text across 100 repeated runs; no ambient clock, randomness, locale, environment, or iteration-order dependence enters scheduling. |
| NFR-2 | Read purity | `queue list`, `queue plan`, `lanes list`, and `lanes show` perform 0 state writes, 0 fence acquisitions, 0 appends, and 0 derived-document replacements; parks are evaluated read-time and reported, never recovered by a read. A read that fails closed at exit 2 performs no write in order to do so. |
| NFR-3 | Claim atomicity | Under 50 concurrent claim attempts by 50 distinct holders against one repository with no lease held, exactly 1 acquires and 49 refuse (a repeat claim by the holder renews, it does not conflict); 0 duplicate lease records exist for one (repository, holder, acquisition); 0 claims land without a post-append verification. |
| NFR-4 | Lease staleness integrity | 100% of leases with heartbeat age at or beyond `queue.lease-ttl` are takeover-eligible and 100% of takeovers record previous holder, lease identity, heartbeat age, and last heartbeat time; 0 live leases are taken over. |
| NFR-5 | Park resume latency | When a mutating pass runs within one recheck interval of the clear time, the park is resumed in that pass (`≤ interval` after the clear, default 60 000 ms for windows and preemption, 300 000 ms for quota); when no mutating pass runs within one interval, the first mutating pass after the gap recovers it with an incident naming the observation gap and it is never classified stuck solely because the gap exceeded the interval. 0 parks remain active without either a recovery record or a `queue.park-condition-stuck` finding once a pass has observed the condition clear; a durable `clear-observed` marker without a later `recovered` record is the stuck condition. |
| NFR-6 | Bounded scheduling cost | Candidate ordering uses cheap graph facts over the full entry set; the expensive readiness condition reads (tracker, pull request, CI, provider, deploy) are performed for at most the first 32 ordered candidates per pass, with the remainder marked truncated and a named reason; a plan over 500 entries and 1 000 edges completes in ≤ 250 ms on the reference environment excluding provider reads; at most 1 tracker page, 1 pull-request page per evaluated repository, 1 check-runs page per evaluated candidate, and 3 deploy verdict reads per pass, each memoized within the pass. |
| NFR-7 | Hermetic tests | 0 live network calls, 0 live credential reads, 0 real sleeps; clock, state store, provider reads, and deploy reads are injected; the fixture corpus covers every gate, rank class, park type, refusal, takeover, and stuck case. |
| NFR-8 | State compatibility | 0 schema-version bumps, 0 migrations, 0 backfills; 5 additive record kinds and 1 rebuildable derived document; existing stores open unmodified and queue reads on them are verified-empty, never torn or zeroed. |
| NFR-9 | Bounds | Entries per folded read ≤ 500; edges per entry ≤ 32; next actions ≤ 20 (default 3); lanes ≤ 200; findings ≤ 20; reasons ≤ 8; serialized `data` ≤ 65 536 UTF-8 bytes; human output ≤ 40 lines and 8 192 UTF-8 bytes; every bound has an explicit truncation marker. |
| NFR-10 | Configuration-only tuning | Changing `queue.lease-ttl` or any `queue.park-recheck.<type>` changes behaviour with 0 code changes; a non-integer, zero, or negative value is `config.value.invalid` naming the key; 100% of the knobs are demonstrated by configuration-only tests. |
| NFR-11 | Error-table synchronization | 5 new `queue` rows and 1 new collector id exist in the machine table, the documented table, the source references, and the fixtures in both directions; 0 existing rows change; classification is exact-code with `fallback.internal` containment. |
| NFR-12 | Secret and payload safety | 0 secret bytes, credentials, raw provider payloads, or free-form message bodies in envelopes, records, findings, incidents, or evidence; the delivered redaction chokepoint covers the new payloads; 0 new secret-read allowlist entries. |
| NFR-13 | Fail-closed state reads | An unreadable, torn, or unknown lease or park history yields the classified `state.*` identity and never "free" or "not parked"; a claim on unreadable lease or park state refuses at exit 2 with 0 writes, and `queue list|plan` exit 2 with the same classified identity carrying bounded evidence, presenting no success verdict and no `data` sibling, partial view, or empty view as a schedule. |
| NFR-14 | Vocabulary stability | Record kinds, error codes, configuration keys, park causes, park condition types, weight classes, rank classes, and lane states are closed sets; the cause set `{provider-window, provider-quota, preempted-for-close-item}` and the condition-type set `{provider-window, provider-quota, preemption}` are distinct and each growth requires a spec update; cross-cutting growth requires a decision record. |

## 10. TELEMETRY & OBSERVABILITY REQUIREMENTS

- **Findings are the read surface.** `queue list|plan` and `lanes list|show` carry bounded `findings[]` with stable codes, severity, and typed evidence; `queue.park-condition-stuck` is the scheduler's own code, and blocking-condition reasons ride on the entry rather than as findings.
- **Incidents are the durable event surface.** Park auto-recovery and stale-lease takeover append `queue.incident` records; a takeover never happens silently, and a recovery always names the condition, the clear time, the evaluation time, and the observation gap.
- **Degradation is declared, never implied.** Every payload carries `degraded[]`; `daemon-unreachable` is present whenever no daemon is reachable, and an empty queue or lane list is an explicit observed-empty with counts, never a silent zero. Exit truth is surface-specific: a readable stuck park is a report-only finding at exit 0, an unreadable lease or park history is a classified `state.*` failure at exit 2, and a claim on a stuck park is a `queue.park-condition-stuck` refusal at exit 1.
- **Explanations are first-class.** Each scheduled action and each held entry carries the reason it was chosen or held (`close-first`, `producer-first`, `lease-held`, `repo-claimed-in-pass`, `weight-class`, `parked:<cause>`, `park-condition-stuck`, `deploy-unverified`, `dependency-open`, `dependency-unobserved`, `outranked`, `no-eligible-action`, a named readiness condition) so the coordinator never re-derives the decision.
- **Invocation audit is inherited.** The delivered command audit ledger (M1-S22) captures every queue and lanes invocation automatically; this change adds no audit field, no exporter, no metric, no trace span, and no background collector.
- **Economics is read, never recomputed.** Restart counts and the resume-amplification signal come from the delivered per-delivery economics fold; a value that cannot be derived is `null` with the delivered warning, never a fabricated zero.

## 11. RISKS & MITIGATIONS

| ID | Risk | Impact | Probability | Mitigation | Residual Risk |
|----|------|--------|-------------|------------|---------------|
| RSK-1 | Two claims both observe "no lease" and both append, breaking single-flight | H | M | The re-read happens **inside** the fence, the append is serialized by the single-writer lock, and a post-append verification requires exactly one new lease record under the repository key; concurrency suites and an injected refusing store pin the refusal paths | L |
| RSK-2 | The lease TTL is mistuned: too short steals a live delivery's repository, too long strands it | H | M | Heartbeat cadence is derived from the TTL, staleness is stated at-bound, takeover is always recorded with evidence, and the TTL is configuration-only tunable with validation | M — tuning depends on operator discipline |
| RSK-3 | Park recheck produces false stuck findings after daemon downtime or a long idle period | M | M | "Stuck" requires a durable `clear-observed` marker or a refused recovery append; an observation gap produces an incident naming the gap, never a stuck finding | L |
| RSK-4 | Read cost explodes on large queues because readiness needs tracker, PR, and CI reads | M | M | Evaluation budget of 32 entries per pass, per-pass memoization, bounded deploy reads, and an explicit truncation marker with a reason | M — a very large queue is inspected in truncated windows |
| RSK-5 | Precedence ambiguity resurfaces in implementation (close-first versus producer-first versus priority) | M | M | One declared total order in Appendix B, with hard exclusions strictly separated from ordering rules and a total-order determinism test over generated inputs | L |
| RSK-6 | Deploy gating is unsound when expectations are undeclared, or blocks merges when the verdict is unreadable | H | M | Gating applies only where expectations are declared; the weaker landing-only gate records `deploy: not-declared`; unknown and failed hold at `deploy-unverified` with a bounded read budget, never green | M — depends on repositories declaring expectations |
| RSK-7 | The one-shot claim/release grammar diverges from the baseline `queue` synopsis, which assumed `dispatch` owned acquisition | M | H | Declared as a contract refinement (DEC-6) with the baseline reconciliation named; M1-S9 composes the capability rather than duplicating it; the man page is reconciled in-change | M until M1-S9 lands |
| RSK-8 | An unrecognized plan weight class mapped to `heavy` slows deliveries | L | M | The mapping is conservative by design and visible in weight-load evidence; the plan schema already echoes unknown classes rather than rejecting them | L |
| RSK-9 | Context: the status digest still declares the lanes capability as `not-delivered` with a stale expected story (M2-S1) while the brief names M1-S17 | L | H | Flagged for the digest's own reconciliation; this change does not alter digest behaviour, so no surface contradicts itself more than it already does | M until that reconciliation lands |
| RSK-10 | Record-kind or error-row drift between machine and documented tables | M | M | F-12 declares the growth in-change; the sync check runs in CI; fixtures cover every row and family member | L |

## 12. ASSUMPTIONS

- Queue membership is explicit (`queue add`); tracker-driven auto-discovery is not delivered, and an empty queue is a valid, explicitly reported state.
- A queue entry's repository key resolves from the invocation's repository binding at declaration time; a multi-repository project adds each change from its own checkout.
- Deploy expectations for a producer resolve from that producer repository's own configuration bound to its recorded repository key; a multi-repository state directory does not use the invocation's configuration for another repository's expectations.
- A producer's repository root is discoverable only from queue entry records: `queue add` records the declaring checkout's root alongside the normalized key, matching is exact on that key, and a missing match, a collision of two roots for one key, or an unreadable or invalid matched config degrades to `unknown` (`deploy-unverified`), never to `not-declared`.
- A declared dependency edge may name a ref with no queue entry; the edge is retained and readiness evaluates it as `unknown` with `dependency-unobserved` until the producer is declared.
- A claim without a ref is a request for the next action under the declared precedence, not an arbitrary selection; a plan that cannot be read cannot declare a weight class and resolves conservatively to `heavy`.
- One state directory may span several repositories; the repository key, not the state directory, is the contention domain.
- The validated plan artifact is the authoritative source for tier, weight class, and declared producer/consumer interactions; the triage label remains only a fallback for tier.
- The delivered `verify deploy` verdict is the only deploy evidence, and `merge.deploy-expectations` is how a repository declares that a deploy must be verified.
- Only the host execution environment exists today, so there is exactly one runner per state directory; the runner field is carried for a future containerized or remote executor.
- Owner gates and external waits are readiness blockers and typed questions, not scheduler parks; only conditions with an evaluable clearing condition park.
- The delivered economics fold is the only source of restart counts and the amplification signal, and a `null` value is the honest answer when derivation fails.
- The resident daemon (M1-S18) will consume the same capability — evaluation, claim, release, park — rather than introduce a parallel scheduling implementation.
- Same-user filesystem permission remains the only authorization boundary; a holder identity is evidence for humans and agents, not an authorization claim.

## 13. DEPENDENCIES

| Direction | Item | Notes |
|-----------|------|-------|
| Depends on | Queue-ready ready-set (M0-S7, GH-176 — delivered) | The six condition ids, order, tri-state, evidence vocabulary, close association, rank rule, and read-only posture are reused; its contract is preserved verbatim. |
| Depends on | State layer (M0-S5 / M1-S2, GH-222 — delivered) | Additive record kinds, fence-token single-writer discipline, verified reads, derived documents, torn/unknown classification, no schema bump. |
| Depends on | Delivery plan schema (M1-S13, GH-226 — delivered) | Tier, weight class, declared interactions, ready-for-development verdict, and the scheduler-owned weight vocabulary. |
| Depends on | Merge and verify-deploy (M1-S4, GH-225 — delivered) | The deploy verdict taxonomy (verified/unknown/failed), the deploy-expectation configuration, and recorded landing evidence. |
| Depends on | Session lifecycle economics (M1-S15, GH-235 — delivered) | Restart counts, the restart-budget terminal record, and the resume-amplification signal consumed by the lane view. |
| Depends on | Provider engine (M0-S13, GH-182 — delivered) | The verified park fold and provider availability vocabulary behind `provider-available`. |
| Depends on | Configuration layer (delivered) | Typed branches, layered merge, defaults, provenance, exact-key validation, `config.value.invalid`. |
| Depends on | Result contract (delivered) | Envelope, error table and sync discipline, exit projection, containment, redaction chokepoint. |
| Consumed by (blocks) | Resident dispatch daemon (M1-S18, GH-238 — open) | Drives lanes continuously by consuming this engine; supplies the control-socket optimization and automatic preemption execution. |
| Consumed by (blocks) | Dispatch engine and handover (M1-S9, GH-239 — open) | Composes the one-shot claim and release around the delivery session; accrual for dual-run evidence starts when this engine ships. |
| Consumed by | Agent integration (M1-S20) and board (M2-S4) | Prompts and the board consume the queue and lane views instead of coordinator narration. |

## 14. OPEN QUESTIONS

| ID | Question | Context | Status |
|----|----------|---------|--------|
| OQ-1 | Should queue membership stay explicit (`queue add`) or be discovered from open tracker tickets? | Explicit membership is what the delivered baseline synopsis implies and what makes the engine's inputs declarative; discovery would make the coordinator's ticketing choices the queue's source of truth and needs its own readiness/variant rules. | Open — deferred; recorded as an assumption (Section 12), not silently chosen |
| OQ-2 | Who holds preemption authority for a live delivery — the daemon automatically, or only an explicit coordinator `queue release --park`? | This change computes the preemption action and leaves execution explicit because nothing may kill or abandon a live session here. Preemption of a delivery mid-phase is a product decision with cost consequences. | Decision needed: consult `@decision-advisor` before M1-S18 |
| OQ-3 | Is the weight vocabulary exactly `standard` and `heavy`, and should an unrecognized declared class fail closed to `heavy` or be refused at plan validation? | The delivered plan schema deliberately accepts and echoes unknown weight classes and defers the vocabulary to this scheduler; the conservative mapping is safe but a typo silently costs throughput. | Resolved 2026-11-07 — vocabulary is exactly `standard`/`heavy`; a validated plan's unrecognized value resolves to `heavy` (DEC-10), and a plan that cannot be read also resolves to `heavy` with source evidence (C-5, AC-F5-2) |
| OQ-4 | Should `queue claim`/`queue release` keep this grammar once M1-S9 lands, or should acquisition move behind `dispatch` only? | This change must expose acquisition to prove daemon-down mutual exclusion without shipping `dispatch`; whether the verbs remain public afterwards affects the long-term command surface. | Open — confirm at M1-S9 planning; no divergence now |
| OQ-5 (OQ-T1) | Should `queue list` and `queue plan` exit 2 or exit 0 with a degraded marker when lease or park history is unreadable or torn? | NFR-2 forbids reads from writing; NFR-13 forbids an all-clear; AC-F4-2 and AC-F11-2 already fail closed at exit 2 on their surfaces. A schedule that cannot verify leases or parks cannot truthfully answer "what is next". | Resolved 2026-11-07 — exit 2 with the classified `state.*` identity and bounded evidence, no success verdict; readable stuck park remains report-only at exit 0 (C-1, NFR-13, AC-F10-3) |
| OQ-6 (OQ-T2) | Does AC-F3-1 mix read-only scheduling with mutating claims? | A read-only `queue plan`/`list` cannot hold a lease; the mutating proof belongs to the claim path. | Resolved 2026-11-07 — AC-F3-1 split into (a) read-only projection and (b) mutating single-holder enforcement (C-2, AC-F3-1) |
| OQ-7 (OQ-T4) | Where does a prior-pass "observed clear" park fact durably live while read surfaces never write? | F-8 requires stuck detection across passes; NFR-2 forbids read-time recovery; the marker must be appended by a mutating pass. | Resolved 2026-11-07 — durable `clear-observed` record on `queue.park` (payload `delivery.queue.park.v1`, key `queue.parks:<REF>`) with `clearObservedAt` and `recoveryState`; a mutating pass seeds it before recovery (C-3, DM-5, EVT-4, Appendix D) |
| OQ-8 (OQ-T5) | How does `queue claim [<ref>]` select an entry when no ref is supplied? | F-4 described explicit-ref preconditions but not the no-ref rule; an arbitrary selection would violate precedence. | Resolved 2026-11-07 — top-ranked eligible action from the same precedence/readiness computation, deterministic, selected ref named in the envelope; no eligible action refuses `queue.precondition.unmet` (reason `no-eligible-action`) (C-4, F-4, AC-F4-3, DEC-12) |
| OQ-9 (OQ-T6) | What weight class applies when the plan artifact is invalid, unreadable, or missing? | F-5 covers an absent declaration and an unrecognized value, but not an unreadable or absent plan; readiness already holds an invalid/unreadable plan as `tier-known` unknown, and an absent plan cannot declare a class. | Resolved 2026-11-07 — a plan that cannot be read or validated resolves to `heavy` with source evidence `plan-unreadable`/`plan-absent` (delivered `plan.schema.invalid`/`plan.artifact.missing`); never `standard`, never co-scheduled as standard (C-5, F-5, AC-F5-2, DEC-10) |
| OQ-10 (OQ-T7) | Are deploy expectations resolved from the producer repository's configuration or the invocation's in a multi-repository state directory? | The declaration belongs to the producer repository; using the invocation's configuration would make the gate depend on which checkout runs the scheduler. | Resolved 2026-11-07 — producer repository's own configuration bound to its recorded repository key; missing/unreadable producer config degrades to `unknown`, never `not-declared` or `verified` (C-6, F-6, AC-F6-2, DEC-13) |
| OQ-11 (OQ-T3) | Does "any mutating `queue` subcommand" in AC-F10-2 include refused mutations? | Cycle, lease-conflict, precondition, and stuck-park refusals legitimately exit 1; a degradation marker is a success-path property. | Resolved 2026-11-07 — AC-F10-2 scoped to successful mutations; refusals project their own exit-1 identity (AC-F10-2, Appendix C, Appendix F) |
| OQ-12 (OQ-T8) | What are the exact lane idle-reason strings and final delivery-bound names? | The closed sets and behaviours are pinned — including the six-value `lanes` state set and the status digest's separate `{delivering, idle-with-reason, idle-no-reason}` attention set — so only exact idle-reason spelling and module/record names remain delivery choices within the closed vocabulary. | Open — delivery-bound naming; no contract change |
| OQ-13 (DoR R-01) | Does a claim refuse `queue.precondition.unmet` or `queue.lease-conflict` when another holder holds the repository? | `repo-free` is a readiness condition sourced from lease truth, so a literal reading could make every held repository a precondition refusal instead of a conflict. | Resolved 2026-11-07 — the pre-fence readiness gate excludes `repo-free`; the in-fence verified lease read owns repository exclusivity and projects `queue.lease-conflict` for another live holder, never `queue.precondition.unmet` (F-4, C-2, AC-F3-1(b), AC-F4-1) |
| OQ-14 (DoR R-03) | How is a producer repository root discovered for deploy expectations in a multi-repository state directory? | The state directory has no repository registry, and an entry recorded only a normalized key, so no root set existed to match against. | Resolved 2026-11-07 — `queue add` records the declaring checkout's root alongside the normalized key; discovery is exact-key match over entry-recorded roots; absence, collision, or an unreadable/invalid config yields `unknown` and `deploy-unverified` (DM-1, DM-12, C-6, AC-F6-2) |

## 15. DECISION LOG

| ID | Decision | Rationale | Date |
|----|----------|-----------|------|
| DEC-1 | Per-repo single-flight is the only structural lane cap; capacity, bandwidth, and CI slots never gate lane count; build-weight classes are resource classes, not caps | Ticket pinned decision; any other cap would make parallelism a policy guess rather than a computed fact | 2026-11-07 |
| DEC-2 | Lease acquisition runs through the state layer's fence-token path; any writer may acquire and the daemon is only the usual holder; a lease whose heartbeat age is at or beyond `queue.lease-ttl` is takeover-eligible with recorded evidence, so daemon-down one-shots are mutually exclusive | Ticket pinned decision (SC-M1-17b); mutual exclusion must not depend on a process that may not be running | 2026-11-07 |
| DEC-3 | Park recheck intervals are per condition type in configuration; a cleared park is auto-recovered with a recorded incident; a park outliving its cleared condition is a classified bug surfaced as `queue.park-condition-stuck` | Ticket pinned decision; an interval-free park is an unbounded stall and an undetected one is a silent bug | 2026-11-07 |
| DEC-4 | Closing beats opening: merge-ready, in-review, and resumable-parked entries rank above new starts, and a producer precedes its consumer with the producer's deploy verified before a dependent repository merges | Ticket pinned decision; landing throughput and contract correctness both outrank starting fresh work | 2026-11-07 |
| DEC-5 | The scheduler reuses the delivered six-condition vocabulary but replaces the `repo-free` source with lease truth and prefers the plan tier for `tier-known`; `queue ready` itself is unchanged | The conditions are the contract; the sources are the weakness the full queue exists to fix. Changing `queue ready` would break a delivered read-only surface | 2026-11-07 |
| DEC-6 | The one-shot scheduling step is exposed as `queue claim` / `queue release`; `dispatch` (M1-S9) composes that capability instead of reimplementing it | The ticket requires daemon-free lease acquisition exercised without shipping `dispatch`; the baseline synopsis assumed the executor owned acquisition, and the M1 contracts are proposals refined at story delivery | 2026-11-07 |
| DEC-7 | `--watch` is omitted from the accepted `lanes` grammar and refused through `fallback.invocation` with a remediation hint naming the daemon story | An accepted-but-degraded flag needs daemon vocabulary and a transport seam this change does not deliver; a refusal is truthful and no silent empty stream is representable | 2026-11-07 |
| DEC-8 | Lane identity is the canonical work-item ref; the synthetic `L<n>` form in the baseline example was illustrative | No lane registry is delivered, and an ordinal would change across restarts, breaking `lanes show` and any consumer correlation | 2026-11-07 |
| DEC-9 | Precedence is one total order: hard exclusions, then rank class, then producer-before-consumer within a repository, then priority ascending, then numeric ref suffix, then ref text | Close-first, producer-first, single-flight, weight caps, and parks otherwise compete silently; separating hard exclusions from ordering rules makes both testable | 2026-11-07 |
| DEC-10 | Weight classes are `standard` and `heavy`; absent resolves to `standard`; a declared-but-unrecognized value resolves to `heavy`; and a plan that is invalid, unreadable, or absent resolves to `heavy` with source evidence, never to `standard` | The scheduler owns the vocabulary the plan schema deferred; erring toward the heavier class can only reduce co-scheduling, never overload a runner. Only a validated plan can make an absent declaration mean `standard`; an unreadable plan cannot declare anything and must not silently co-schedule as standard | 2026-11-07 |
| DEC-11 | Read surfaces fail closed at exit 2 with the classified `state.*` identity when lease or park history is unreadable or torn; a readable stuck park is a report-only finding at exit 0, and a claim on it refuses at exit 1 with `queue.park-condition-stuck` | A schedule that cannot verify leases or parks cannot truthfully answer "what is next"; NFR-2 forbids a read-time recovery, NFR-13 forbids an all-clear, and conflating a readable bug finding with an unreadable state would make both untestable | 2026-11-07 |
| DEC-12 | `queue claim` without a ref selects the top-ranked eligible action from the declared precedence deterministically and names it in the envelope; no eligible action refuses `queue.precondition.unmet` (reason `no-eligible-action`) | An implicit "next action" must be the same next action the plan computes, or an agent's claim can silently violate precedence; determinism keeps retries and tests stable | 2026-11-07 |
| DEC-13 | Deploy expectations resolve from the producer repository's own configuration bound to the producer's recorded repository key; a missing or unreadable producer config degrades to `unknown`, never `not-declared` or `verified` | The expectation belongs to the producer repository, so it must not depend on which checkout invokes the scheduler; an unreadable producer config must never weaken the gate to landing-only or green | 2026-11-07 |

## 16. AFFECTED COMPONENTS (HIGH-LEVEL)

| Component | Impact |
|-----------|--------|
| Scheduling engine (queue domain) | New — graph folding, readiness, precedence, ranking, weight accounting, deploy gating, park evaluation, claim and release |
| Lanes view | New — pure fold over entries, leases, parks, and economics |
| CLI `queue` command family | Extended — `list`, `plan`, `add`, `prioritize`, `dep`, `claim`, `release`; `ready` unchanged |
| CLI `lanes` command family | New — `list`, `show`; `--watch` refused |
| Configuration catalog | Extended — a typed `queue` branch with `queue.lease-ttl` and `queue.park-recheck.<type>` and shipped defaults |
| State registry | Extended — 5 additive record kinds and 1 rebuildable derived document; no schema-version bump |
| Error table (machine and documented) | Extended — a new `queue` domain kind with 5 rows and the collector-id set extended with `lanes` |
| Scheduling feature spec (`feature-queue-ready.md` neighbour) | New spec for the engine, or a declared extension of the queue-ready spec; decided at doc-sync |
| `queue` and `lanes` man pages (M1 pack) | Updated/new — grammars, envelope shapes, exit statuses, error codes, degradation semantics |
| CLI command registry | Updated — the new subcommands and the `lanes` family |
| Repository glossary | Updated — graph, lease scope, single-flight, weight class, rank class, park condition, recheck interval, incident, preemption, stuck park |
| Status digest `lanes-or-queue` gap | Flagged only — its stale expected-story reference is the digest's own reconciliation, not this change |
| Dispatch daemon (M1-S18) and dispatch (M1-S9) | Not affected here — they consume the delivered capability |

## 17. ACCEPTANCE CRITERIA

| ID | Criterion | Linked |
|----|-----------|--------|
| AC-F1-1 | **Given** a project with no queue state where a seeded dependency edge already declares GH-302 → GH-301 and GH-301 has no queue entry (an edge may target a ref with no entry; readiness evaluates it as `unknown` with `dependency-unobserved` until GH-301 is declared), **when** `queue add GH-301 --priority 5 --dep GH-300` succeeds and then `queue dep GH-301 GH-302` would close a cycle, **then** the entry and the first edge are recorded under the fence, the cycle-creating edge is refused with `queue.dependency-cycle` naming the existing path (GH-301 → GH-302 → GH-301), nothing is appended for it, an identical replay of the successful mutation appends nothing, and `queue list` shows the entry, its normalized repository key, its priority, and its edges — the recorded repository root is internal state used only for deploy-expectation discovery and is never rendered (no absolute path appears in the envelope, human output, or goldens). | F-1, F-2, DM-1, DM-2, DM-12, DM-13, EVT-1, EVT-2, NFR-8 |
| AC-F2-1 | **Given** a queued entry with one open dependency, an owner-attention label, and an unreadable CI source, **when** the readiness pass runs, **then** exactly six conditions are reported in the delivered order with the closed tri-state, `deps-satisfied` is `unsatisfied` with the open dependency named, `no-owner-gate` is `unsatisfied` with the label named, `ci-healthy` is `unknown` with its declared reason, every non-satisfied condition appears in `blockingConditions`, and the entry is not ready — with no fabricated zero and no `satisfied` derived from a failed read. | F-2, DM-3, NFR-1, NFR-13 |
| AC-F3-1 | **Given** two ready entries targeting repo-alpha and no lease held, **when** `queue plan` or `queue list` runs, **then** (a) the read surface shows exactly one eligible action for repo-alpha — the other ready entry is held `repo-claimed-in-pass` before any lease exists — and, once any lease exists for repo-alpha, names `lease-held` with holder and lease evidence for the other entry, without claiming or holding a lease itself; **and when** two one-shots claim repo-alpha concurrently, **then** (b) exactly one `repo-exclusive` lease is acquired and the other claim refuses at exit 1 with `queue.lease-conflict` (never `queue.precondition.unmet` for repository exclusivity), naming the holder and lease identity, so exactly one holder exists per repository. (SC-M1-08) | F-3, F-2, F-4, DM-4, DM-12, NFR-2, NFR-3 |
| AC-F3-2 | **Given** any lease record in the store, **when** it is inspected, **then** it carries a `scope` field whose value is `repo-exclusive`, no delivered path acquires under any other scope, and no configuration key, code path, or decision rule reduces lane count because of capacity, bandwidth, or CI slots. | F-3, DM-4, NFR-14 |
| AC-F4-1 | **Given** the daemon stopped, no lease held, and two one-shot processes claiming the same repository concurrently, **when** both run, **then** exactly one acquires the lease with a recorded heartbeat, the other refuses at exit 1 with `queue.lease-conflict`, consequence `not_landed`, naming the holder and the lease identity — repository exclusivity is decided only by the in-fence verified lease read, so the loser never refuses `queue.precondition.unmet` for a held repository, and a repeat claim by the winning holder renews rather than conflicts; **and given** a lease whose heartbeat age is at or beyond `queue.lease-ttl` with no renewal, **when** a claim runs, **then** the stale lease is taken over with recorded evidence naming the previous holder, lease, and heartbeat age, while a live lease is never taken over. (SC-M1-17b) | F-4, DM-4, DM-6, EVT-3, EVT-5, NFR-3, NFR-4 |
| AC-F4-2 | **Given** an unreadable or torn lease history for a repository, **when** a claim targets it, **then** the claim refuses with the classified `state.*` identity at exit 2, performs no append, and never reports the repository as free. | F-4, NFR-13, NFR-12 |
| AC-F4-3 | **Given** a queue with eligible entries and no ref argument, **when** `queue claim` runs, **then** it selects the top-ranked eligible action from the declared precedence deterministically, the envelope names the selected ref, and repeated identical passes select the same ref; **and when** no action is eligible, **then** it refuses at exit 1 with `queue.precondition.unmet`, reason `no-eligible-action`, and appends nothing. | F-4, F-9, DM-9, EVT-3, NFR-1, NFR-13 |
| AC-F5-1 | **Given** runner R2 carrying a heavy-class lease and GH-309 which is heavy-class and ready, **when** scheduling computes, **then** GH-309 is held with reason `weight-class`, at most one heavy job is scheduled per runner, standard-class entries continue to be scheduled, and the number of active repositories is unchanged. (SC-M1-09) | F-5, DM-7, NFR-14 |
| AC-F5-2 | **Given** a plan that is invalid, unreadable, or absent, **when** the entry's weight class is resolved, **then** it resolves to `heavy` with source evidence `plan-unreadable` or `plan-absent` (naming the delivered `plan.schema.invalid` or `plan.artifact.missing` identity), never to `standard`; an invalid or unreadable plan holds the entry at `tier-known` unknown, and an absent plan is subject to the heavy cap or the triage fallback's readiness verdict, so the entry is never scheduled as standard. | F-5, F-2, DM-7, DEC-10, NFR-13 |
| AC-F6-1 | **Given** GH-300 (producer, repo-alpha) and GH-301 (consumer, repo-beta) with a declared edge, **when** GH-300 is unresolved and GH-301's merge is ready, **then** GH-301 is held `dependency-open` and is not scheduled; **and when** GH-300 has landed and repo-alpha declares deploy expectations, **then** GH-301's merge action is eligible only after `verify deploy GH-300` reads `verified` with its evidence, holds at `deploy-unverified` on `unknown`, `failed`, or an exhausted deploy read budget, and otherwise (no declared expectation) passes on landing with `deploy: not-declared` evidence; **and when** both are eligible in one repository, GH-300 ranks before GH-301. | F-6, DM-2, DM-9, NFR-6 |
| AC-F6-2 | **Given** a state directory spanning producer repo-alpha and consumer repo-beta, **when** a dependent merge is evaluated, **then** repo-alpha's deploy expectations are read from repo-alpha's own configuration bound to its recorded repository key through the recorded repository root whose normalized remote matches that key, not from the invocation's configuration; **and when** no recorded root matches repo-alpha's key (not discoverable), two distinct recorded roots claim the same key (a collision), or the matched root's config is missing, unreadable, or invalid, **then** the expectation is `unknown` (never `not-declared` and never `verified`) and the dependent holds `deploy-unverified`. | F-6, DM-1, DM-2, DM-12, NFR-13 |
| AC-F7-1 | **Given** one merge-ready entry and one ready new start, both eligible, **when** `queue plan --next 2` runs, **then** the merge-ready entry ranks first, both entries carry their reasons, and the order is byte-identical across repeated runs. (SC-M1-10) | F-7, DM-8, DM-9, F-9, NFR-1 |
| AC-F7-2 | **Given** a merge-ready entry on repo-alpha whose lease is held by a new start, **when** scheduling computes, **then** the pass emits a preemption action naming park cause `preempted-for-close-item` and the holder, the close item is not scheduled in that pass, and `queue release <ref> --park preempted-for-close-item` releases the lease and records the named park cause (paired with condition type `preemption`) in one fenced transaction — both land or neither. | F-7, DM-10, DM-5, EVT-3, EVT-4 |
| AC-F8-1 | **Given** a lane parked on a provider window ending at T, **when** a mutating pass runs within one recheck interval of T, **then** the lane resumes in that pass with the resume recorded at or before one recheck interval after T and a `queue.incident` naming the condition, the clear time, the evaluation time, and the observation gap; **and when** no mutating pass runs within one recheck interval of T, **then** the first mutating pass after the gap recovers the park with a gap-naming incident and the park is never reported stuck solely because the gap exceeded the interval; **and given** a park observed clear that is still active on a later pass, or a recovery append that the store refuses, **then** `queue.park-condition-stuck` is reported as a report-only finding on reads at exit 0, the entry is never a `resume-parked` candidate, never appears in `nextActions`, and is never selected by a no-ref claim, and a claim on that entry refuses at exit 1 with the same classified identity, consequence `not_landed`, zero appends; the prior-pass observation is durable as a `clear-observed` park record. (SC-M1-11) | F-8, DM-5, DM-6, DM-14, EVT-4, EVT-5, NFR-5, NFR-13 |
| AC-F8-2 | **Given** a shipped default recheck interval for a park condition type, **when** an operator changes only `queue.park-recheck.<type>`, **then** the resume timing changes with no code change and the new value is observable in the park evidence; a non-integer, zero, or negative value is refused `config.value.invalid` naming the key. | F-8, NFR-10 |
| AC-F9-1 | **Given** a generated corpus mixing every gate, both weight classes, three park condition types, both dependency roles, close and new-start classes, and explicit priorities, **when** the schedule is computed, **then** the output follows the declared total order exactly — hard exclusions before ordering, rank class before producer tie-break, priority only inside a class, numeric suffix then ref text as the final tie-breaks — and no input ordering changes the result. | F-9, NFR-1, NFR-7 |
| AC-F10-1 | **Given** the daemon stopped and one ready entry, **when** `queue plan --next 1` runs and then the one-shot scheduling step claims it, **then** the plan is computed from state and exits 0 with `degraded: ["daemon-unreachable"]`, the claim lands a lease, the state is consistent for later daemon reconciliation, and no daemon, socket, or background process is required at any point. (SC-M1-17) | F-10, F-4, NFR-2 |
| AC-F10-2 | **Given** any successful mutating `queue` subcommand with no daemon reachable, **when** it runs, **then** the intent or execution record lands durably, a replay of the identical mutation appends nothing, and the envelope reports the degradation instead of failing silently or claiming a daemon notification occurred; a refused mutation projects its own exit-1 identity and does not claim degradation as a success. | F-10, DM-13, NFR-8, NFR-2 |
| AC-F10-3 | **Given** an unreadable, torn, or unknown-kind lease or park history, **when** `queue list` or `queue plan` runs, **then** it exits 2 with the classified `state.*` identity, emits the bounded evidence on that identity, and does not report success or present a `data` sibling, a partial view, or an empty view as a schedule; **and given** a readable park observed clear but still active, **then** the same surfaces report the report-only `queue.park-condition-stuck` finding at exit 0. | F-10, F-2, F-8, DM-14, NFR-2, NFR-13 |
| AC-F11-1 | **Given** one delivering lane, one lane parked on a quota condition, and one lane failed past its restart budget, **when** `lanes list` runs, **then** each lane reports its ref identity, a state from the closed set, a bounded idle reason, its lease holder and scope when held, its restart count and amplification from the delivered economics view (`null` plus warning when underivable), and its weight class — with zero writes and zero fabricated values. | F-11, DM-11, NFR-2 |
| AC-F11-2 | **Given** any `lanes` invocation carrying `--watch`, **when** it runs, **then** it is refused through `fallback.invocation` at exit 1 with a remediation hint naming the resident daemon story, and no empty or partial stream is emitted; **and given** an unreadable queue store, **then** `lanes list` returns `status.collector.lanes.unavailable` at exit 2 and never a zero-lane view. | F-11, F-10, NFR-13, NFR-11 |
| AC-F12-1 | **Given** the delivered `queue ready` contract, **when** the change lands, **then** `queue ready` grammar, six-condition sources, ranking, caps, byte bounds, read-only guarantee, and error rows are unchanged, byte-identical output holds for an identical fixture set, and the new `queue` rows and the extended collector-id set agree across the machine table, documented table, source references, and fixtures in both directions. | F-12, F-2, NFR-11, NFR-14 |

## 18. ROLLOUT & CHANGE MANAGEMENT (HIGH-LEVEL)

- **Delivery order**: configuration branch and record-kind vocabulary first; then declaration and graph folding; then readiness, gates, precedence, and ranking; then leases, claim, and release; then parks, incidents, and the stuck finding; then the lane view; then documentation reconciliation. Each step is independently testable and independently revertible.
- **Additive cutover**: no delivered surface changes behaviour. `queue ready` keeps its contract, the state schema keeps its version, the error table only grows, and configuration ships with defaults so an absent `queue` branch is valid.
- **Empty-by-default posture**: a project with no queue entries reports an explicit observed-empty queue at exit 0 and schedules nothing. The engine never invents work; adoption begins with `queue add`.
- **Daemon-free first**: the engine is useful the day it lands — the coordinator or an agent declares entries, computes the next action, claims, delivers, and releases, with no daemon, no socket, and no background process.
- **Deferred coexistence**: the resident daemon (M1-S18) consumes the same capability; `dispatch` (M1-S9) composes claim/release around the delivery session. Neither is a prerequisite for this change's value, and neither should introduce a second scheduling implementation.
- **Communication**: the queue and lanes man pages, the command registry, the glossary, and the scheduling feature spec land in the same change; the status digest's stale lanes reference is flagged to its owner rather than edited here.

## 19. DATA MIGRATION / SEEDING (IF APPLICABLE)

None. Five additive record kinds and one rebuildable derived document join `delivery.state.v1` with no schema-version bump, no migration, no backfill, and no rebuild command. `queue.park` (payload `delivery.queue.park.v1`, Appendix D) is itself one of this change's five new record kinds, and its schema carries `clearObservedAt` and `recoveryState` from its first write. The durable clear-observed marker is another record of that same `queue.park` kind — an additive field set on that kind, not a sixth record kind and not a mutation of a pre-existing kind — so there is no pre-existing park record and no compatibility path to preserve. A store that has never seen a queue record reads as verified-empty, so an existing installation starts with an empty, explicitly reported queue. The queue graph document is a cache rebuilt from verified intent records and is never truth. No seed data is required; the configuration branch ships defaults and the weight and rank vocabularies are contract data.

## 20. PRIVACY / COMPLIANCE REVIEW

No personal data is introduced. Records and payloads carry work-item refs, normalized repository keys, priority and weight values, lease holder identities (a local process or declared holder label, never a person's identity), park conditions and timestamps, and bounded incident evidence. The one absolute value in scope is the repository root recorded on each queue entry (DM-1, DM-12): it is local, absolute, internal-only state used solely to resolve a producer repository's own configuration for deploy-expectation discovery. It is never serialized to command envelopes, findings, incidents, logs, goldens, or telemetry, and read surfaces render the normalized repository key only, so no machine layout, username, or checkout location is disclosed by any surface. No prompt text, message body, transcript, diff, file content, or credential appears in any record, finding, or envelope. The scheduler performs no tracker write, so it neither reads nor transmits anything a delivered read path does not already expose, and the delivered redaction chokepoint covers the new payloads.

## 21. SECURITY REVIEW HIGHLIGHTS

- **Mutual exclusion is structural, not advisory.** The lease decision is a verified read performed inside the state layer's single-writer fence, followed by a post-append count verification. A conflicting claim refuses with evidence; a live lease cannot be taken over; an unreadable lease history fails closed at exit 2 rather than reading as free.
- **A holder identity is not authorization.** Any same-user process may claim within the fence, exactly as the delivered trust model states for the local state directory; the holder identity exists for evidence, correlation, and human diagnosis. The escape paths (credential sidecar, containerized lanes) remain the parked concepts.
- **The lease TTL and the fence staleness window are distinct mechanisms.** Conflating them would either weaken write serialization or steal live deliveries; the fence is held only for the duration of one write, and the lease TTL governs durable ownership.
- **No new external write surface and no shell.** The engine performs bounded read-only provider reads through existing seams, spawns no child process, executes no shell, and adds no secret-read allowlist entry.
- **Bounded untrusted input.** Refs are canonicalized with the delivered pattern and length bound; holder labels, park causes, condition types, weight classes, and rank classes are closed vocabularies; priorities are validated integers; oversized or malformed input is an invocation rejection before any read.
- **The recorded repository root never leaves local state.** The absolute root recorded on an entry (DM-1, DM-12) exists only to resolve that repository's own configuration for deploy-expectation discovery. It is never emitted in an envelope, finding, incident, log line, golden, or telemetry event, and read surfaces expose only the normalized repository key — so a checkout path cannot become a disclosure channel and cannot leak into a committed fixture (DM-13, Appendix C).
- **Truthful degradation.** An absent daemon, an unreadable store, a failed provider read, and an exhausted evaluation budget each produce a declared degraded or unavailable state; none produces a silent empty or all-clear view. A read surface with unreadable lease or park history exits 2 with the classified `state.*` identity rather than presenting a schedule.

## 22. MAINTENANCE & OPERATIONS IMPACT

- **Vocabulary is guarded.** Record kinds, payload schemas, error rows, configuration keys, park causes, condition types, weight classes, rank classes, and lane states are closed sets (NFR-14); growth requires a spec update and, where cross-cutting, a decision record.
- **Adding an entry, priority, or edge** is a command invocation; **tuning lease timing or park cadence** is configuration (NFR-10); **adding a park condition type** is a spec change with a default interval.
- **Adding a runner** is an execution-environment change consumed by the already-carried runner field; per-runner heavy limits become configuration only when more than one runner exists.
- **Doc duties land in-change**: the scheduling feature spec, the queue and lanes man pages, the CLI command registry, the glossary, and the configuration and state-layer spec additions.
- **Operational posture**: no daemon, socket, timer, or background process to operate. Parks are evaluated by the passes that run; an idle host evaluates nothing and resumes on the next invocation.
- **Known follow-ups** are named, not assumed away: the status digest's stale lanes reference, the `--watch` stream with the daemon, preemption authority (OQ-2), the claim/release surface at M1-S9 (OQ-4), and delivery-bound lane-reason names (OQ-12). The weight vocabulary is resolved by DEC-10 and C-5. The SC-M1-17 `dispatch <ref>` execution clause is explicitly inherited by M1-S9 (dispatch engine and handover), with the PM acknowledgement recorded 2026-11-07 in `chg-GH-237-pm-notes.yaml` decisions; this change ships the scheduling step only and no behavior changes.

## 23. GLOSSARY

| Term | Definition |
|------|------------|
| Queue entry | One declared intent to deliver a work item, carrying its repository key, priority, weight class, and dependency edges. |
| Dependency edge | A directed consumer-to-producer declaration; a producer must precede its consumer, and a producer's deploy verdict gates a dependent repository's merge when deploy expectations are declared. |
| Ready / readiness | All six delivered conditions satisfied, re-derived per pass; any `unsatisfied` or `unknown` condition makes the entry not ready and is named. |
| Lease | A durable, fenced object granting exclusive delivery rights over a scope for a holder until release, expiry, or takeover. It is the runtime enforcement object, distinct from a plan's declared `leases`, which are named resource declarations. |
| Lease scope | The contention domain of a lease; `repo-exclusive` is the only implemented scope, `worktree` is declared and unused. |
| Single-flight | The invariant that exactly one active lease exists per repository key; the only structural cap on concurrent lanes. |
| Repository key | The normalized `host/owner/name` remote identity that single-flight and weight accounting key on; an entry also records the declaring checkout's repository root, the only source for producer-root discovery, held as internal state and never rendered by a read envelope, golden, or telemetry output. |
| Stale lease | A lease whose heartbeat age is at or beyond `queue.lease-ttl`; the only lease a takeover may displace. |
| Takeover | Acquiring a stale lease, always recorded with the previous holder, lease identity, and heartbeat evidence. |
| Weight class | The closed resource class `standard` or `heavy`; at most one heavy-class lease is active per runner, and weight is never a lane cap. It resolves from a validated plan; a plan that is invalid, unreadable, or absent resolves conservatively to `heavy`, never `standard`. |
| Rank class | The closed scheduling classes `merge-ready`, `in-review`, `resume-parked`, and `new-start`, ordered in that sequence; `in-review` is the population `queue ready` calls `review-pending`. |
| Closing beats opening | The rule that close items (merge-ready, in-review) and resumable parks rank above new starts, subject to hard gates. |
| Hard exclusion | A gate that removes a candidate (readiness, dependency, deploy, park, single-flight, weight cap) and never merely reorders it. |
| Park | A durable hold on an entry with a closed cause and a closed condition type (distinct sets), a recheck interval, and an optional absolute expiry. |
| Recheck interval | The per-condition-type cadence at which an active park's condition is re-evaluated; configuration with shipped defaults. |
| Resume / auto-recovery | The recorded resumption of a parked entry when its condition is observed clear, accompanied by an incident record. |
| Observation gap | The elapsed time since a park was last evaluated; named in a recovery incident when no engine process ran in between. |
| Stuck park | A park with a durable `clear-observed` record that remains active without a later `recovered` record, or whose recovery was refused; reported as a report-only finding on readable reads at exit 0 and refused on claim at exit 1 as `queue.park-condition-stuck`. |
| Clear-observed marker | A `queue.park` record written by a mutating pass when a park condition evaluates clear, carrying `clearObservedAt` and `recoveryState: clear-observed`; it is the durable prior-pass fact that makes stuck detection possible without a read writing. |
| Preemption | Releasing a repository from a new start so a close item can land, always under the named park cause `preempted-for-close-item` paired with condition type `preemption`. |
| Runner | The declared execution environment carrying weight classes; the host is the only implementation today, one runner per state directory. |
| Lane | The observation projection of one queue entry: state, idle reason, lease, restarts, amplification, and weight class. |
| Degraded | A declared, non-failing state marker (`daemon-unreachable`, a failed source, an exhausted evaluation budget) that never renders as clear or zero. |
| Incident | A durable record of a park auto-recovery or a stale-lease takeover, carrying bounded typed evidence. |
| One-shot scheduling step | `queue claim` and `queue release`: the daemon-free acquisition and release of a lease, composed by `dispatch` when it lands; a claim without a ref selects the top-ranked eligible action. |

## 24. APPENDICES

### Appendix A — Seeded scenario reconciliation

| Seed | Owning surface | Folded into | Divergence rule |
|------|----------------|-------------|-----------------|
| SC-M1-08 same-repo single-flight | Leases, `repo-free` evidence, schedule | AC-F3-1(a) read projection, AC-F3-1(b), AC-F4-1 | The read surface shows one eligible action and holds the other entry `repo-claimed-in-pass` before any lease exists, then names `lease-held` evidence once a lease exists; the mutating path proves one holder and one lease record via `queue.lease-conflict`. |
| SC-M1-09 heavy build not co-scheduled | Weight accounting | AC-F5-1 | At most one heavy per runner is asserted; standard entries remain schedulable; no lane-count reduction. |
| SC-M1-10 close-first ranking | Rank classes, precedence | AC-F7-1, AC-F9-1 | Order and reasons are asserted; determinism is added. |
| SC-M1-11 park resumes exactly when its condition clears | Parks, incidents, findings | AC-F8-1 | Resume within one interval when a mutating pass runs inside it, the incident, and the stuck finding are asserted; the no-engine gap recovers with a gap-naming incident and is never stuck, and a stuck park is never a next action. |
| SC-M1-17 one-shot works daemon-down | Plan computation, claim | AC-F10-1, AC-F10-2 | `degraded=daemon-unreachable` at exit 0 and state consistency at reconciliation are asserted; the executor is the scheduling step, not `dispatch`. The SC-M1-17 `dispatch <ref>` execution clause is inherited by M1-S9 (dispatch engine and handover), with the PM acknowledgement recorded 2026-11-07 in `chg-GH-237-pm-notes.yaml` decisions; no behavior changes in this change. |
| SC-M1-17b daemon-down one-shots are mutually exclusive | Fence-claim, takeover | AC-F4-1, AC-F4-2 | One lease with heartbeat, exit-1 refusal with the holder named, stale takeover with evidence, and fail-closed unreadable state are asserted. |

### Appendix B — Precedence order (the ambiguity-deleting contract)

| Step | Rule | Kind | Outcome on failure |
|---:|---|---|---|
| 0 | Normalize: canonical ref, repository key, tier, weight class, close association, edges, park state | preparation | `unknown` evidence, never an invention |
| 1 | Entry observed; its plan is valid, or absent with the delivered triage-label fallback for tier (an invalid or unreadable plan is held) | hard exclusion | `not-ready` with the delivered `plan.*` evidence |
| 2 | `deps-satisfied` (tracker relations ∪ declared edges; a declared edge whose producer has no queue entry is `dependency-unobserved`; dependent merge also requires producer landing and, where declared, a `verified` deploy) | hard exclusion | `dependency-open`, `dependency-unobserved`, `producer-not-landed`, or `deploy-unverified` |
| 3 | `no-owner-gate` | hard exclusion | `owner-gate` naming the labels |
| 4 | `tier-known` | hard exclusion | `tier-unknown` with its source |
| 5 | `ci-healthy` | hard exclusion | `ci-<reason>` (`failed`, `pending`, `canceled`, `none`, or the declared unknown reason) |
| 6 | `provider-available` | hard exclusion | `provider-<reason>` (`chain-parked`, `no-enabled-entry`, `all-entries-parked`, or the declared unknown reason) |
| 7 | Active park whose condition has not cleared | hard exclusion | `parked:<cause>` with the recheck interval |
| 7b | Active park whose latest record is a durable `clear-observed` marker with no later `recovered` record (stuck park) | hard exclusion | `park-condition-stuck`; never a `resume-parked` candidate, never in `nextActions`, never selected by a no-ref claim |
| 8 | Repository lease held by another live holder | hard exclusion | `lease-held` with holder and lease identity |
| 9 | Heavy class while the runner already carries a heavy lease | hard exclusion | `weight-class` naming the carrying lease |
| 10 | Rank class | ordering | — (`merge-ready` < `in-review` < `resume-parked` < `new-start`) |
| 11 | Producer before consumer when both contend for one repository | ordering | — |
| 12 | Explicit priority ascending (declared default for undeclared) | ordering | — |
| 13 | Numeric ref suffix ascending, then canonical ref text | ordering | — |
| 13b | Per-pass single-flight projection: after ordering, at most one action per repository is projected; the remaining ready entries in that repository are held with reason `repo-claimed-in-pass` | projection | — (a later pass re-evaluates the held entries) |
| 14 | Preemption computation for close items blocked only by a new start's lease | action | emitted as a preemption action, never as a violation of single-flight |

Steps 1–9 (including 7b) remove; steps 10–13 order; step 13b projects at most one action per repository per pass; step 14 only proposes a release. A hard exclusion never demotes; an ordering rule never admits. For a claim, steps 1–6 are evaluated pre-fence except `repo-free`, and step 8 is evaluated only by the in-fence verified lease read; `repo-free` is never a pre-fence claim refusal, so a held repository always projects `queue.lease-conflict` (F-4, C-2).

### Appendix C — Command envelope data shapes (contract level)

- `queue list` → `entries[]` (ref, repository, state, rankClass, priority, weightClass, weightClassSource (`declared`, `absent`, `plan-unreadable`, `plan-absent`), deps[], blocking[]), `leases[]` (repository, holder, scope, ref, runner, weightClass, heartbeatAgeMs, takeover), `weights` (runner, class, active), `parks[]` (ref, cause, conditionType, condition, recheckMs, expiresAt, lastEvaluatedAt, clearObservedAt, recoveryState, clearedAt), `findings[]`, `degraded[]`, `truncated`.
- `queue plan [--next <n>]` → the same collections plus `nextActions[]` (ref, repository, rankClass, reason, priority, weightClass, weightClassSource, lease, blocking[], deploy?, preemption?).
- No read or mutation envelope carries the recorded repository root (DM-1, DM-12): `queue list` and `queue plan` project the normalized `repository` key only, because the root is internal state used solely for producer config resolution. An absolute path — and with it any machine layout, username, or checkout location — therefore never appears in `data`, `findings[]`, human output, goldens, or telemetry.
- `queue add | prioritize | dep` → `ref`, `entry` (the folded projection), `edges[]`, `result` (`added`, `updated`, `noop`), `degraded[]`; a cycle refusal carries the error only. `degraded[]` is a uniform field on every successful mutating subcommand envelope, not only on `claim` and `release` (F-10, AC-F10-2).
- `queue claim [<ref>] [--holder <id>]` → `result` (`claimed`, `renewed`, `taken-over`), `selectedRef` (the ref selected, equal to `<ref>` when supplied), `lease` (identity, scope, repository, holder, ref, runner, weightClass, acquiredAt, heartbeatAt, ttlMs, takeoverOf?), `action`, `degraded[]`; a no-eligible-action claim carries `queue.precondition.unmet` with reason `no-eligible-action`, and a stuck-park claim carries `queue.park-condition-stuck`, both at exit 1.
- `queue release <ref> [--holder <id>] [--park <cause>]` → `result` (`released`, `parked`, `noop`), `lease`, `park?`, `degraded[]`.
- `lanes list | show <ref>` → `lanes[]` (id = canonical ref, ref, state, reason, lease, leaseScope, restarts, amplification, amplificationWarning?, weightClass), `findings[]`, `degraded[]`, `truncated`.
- Held entries and `nextActions[]` carry a blocking `reason` drawn from the closed reason vocabulary: `close-first`, `producer-first`, `lease-held`, `repo-claimed-in-pass`, `weight-class`, `parked:<cause>`, `park-condition-stuck`, `deploy-unverified`, `dependency-open`, `dependency-unobserved`, `outranked`, `no-eligible-action`, and the six readiness condition ids. `repo-claimed-in-pass` is a per-pass projection reason distinct from `lease-held` (which requires an actual lease), and `park-condition-stuck` is a blocking reason, not a park cause.
- Exit projection: 0 computed, read, a successful mutation landed, an explicit observed-empty queue, or a report-only stuck-park finding on a readable read surface; 1 invocation rejection, dependency cycle, lease conflict, unmet precondition (including no eligible action), stuck-park refusal on a claim, or unobserved entry; 2 platform, provider, or unverified state read, including `queue list|plan` when lease or park history is unreadable or torn. A read surface that exits 2 emits the classified identity carrying bounded evidence but no success verdict and no `data` sibling. Text mode prints the bash-continuity key=value summary where defined (`result=`, `ref=`, `lease=`, `next=`, `degraded=`) before any human detail, and `result=refused` before the classified refusal on the negative-verdict paths.

### Appendix D — State record kinds and derived document

| Kind / document | Payload schema | Store-scoped key | Writer | Reader |
|---|---|---|---|---|
| `queue.entry` | `delivery.queue.entry.v1` | `queue.entries:<REF>` | any invocation (intent) | graph fold, `queue list|plan`, lanes |
| `queue.dependency` | `delivery.queue.dependency.v1` | `queue.deps:<REF>` | any invocation (intent) | graph fold, precedence, deploy gating |
| `queue.lease` | `delivery.queue.lease.v1` | `queue.leases:<repoKey>` | the process performing the claim/release (attributed) | claim exclusion, lane view, weight accounting |
| `queue.park` | `delivery.queue.park.v1` | `queue.parks:<REF>` | the process performing the evaluation (attributed) | resume evaluation, lane view, stuck finding, claim refusal |
| `queue.incident` | `delivery.queue.incident.v1` | `queue.incidents:<REF>` / `queue.incidents:<repoKey>` | the process recording the incident (attributed) | diagnostics, evidence |
| Derived: queue graph | `delivery.queue.graph.v1` | derived document `queue-graph.json` | replaced atomically when intent truth changes | never truth; rebuilt from the ledger |

Every append is fenced; every append is verified after the fact; a wrong kind, malformed payload, duplicate acquisition for one holder, or a second active park for one entry is a classified `state.*` failure and never a fabricated value. No schema-version bump, migration, or backfill exists. The `queue.park` record also carries the durable `clear-observed` marker (`clearObservedAt`, `recoveryState: clear-observed`) appended by a mutating pass before recovery; a later `recovered` append supersedes it; reads never append. `queue.park` is one of this change's five new record kinds (F-12) and its schema carries `clearObservedAt` and `recoveryState` from its first write, so the clear-observed marker is an additive field set on that same new kind — not a sixth record kind and not a change to a pre-existing one.

### Appendix E — Configuration keys (contract level)

| Key | Shape | Default | Semantics |
|---|---|---|---|
| `queue.lease-ttl` | integer milliseconds | `90000` | Lease staleness bound; heartbeat age at or beyond it makes the lease takeover-eligible. Renewal cadence is one third of the TTL (minimum one second), derived, not a separate key. A non-integer, zero, or negative value is `config.value.invalid`. |
| `queue.park-recheck.provider-window` | integer milliseconds | `60000` | Recheck cadence for provider window parks. |
| `queue.park-recheck.provider-quota` | integer milliseconds | `300000` | Recheck cadence for provider quota parks. |
| `queue.park-recheck.preemption` | integer milliseconds | `60000` | Recheck cadence for preemption parks. |

An absent `queue` branch resolves to these defaults with `defaults` origins. A `queue.park-recheck.<type>` naming a condition type outside the closed set is `config.key.unknown`; an invalid value is `config.value.invalid` naming the key; no invalid input silently falls back to a default. `<type>` ranges over the closed condition-type set `{provider-window, provider-quota, preemption}`, never over the cause set `{provider-window, provider-quota, preempted-for-close-item}`. No capacity, bandwidth, concurrency, or CI-slot key exists, and none is reserved. Deploy expectations are not a `queue` key: they are the delivered `merge.deploy-expectations` resolved from the producer repository's own configuration bound to its recorded repository key (F-6, C-6). The producer root is discovered only from the roots recorded on queue entries (DM-1, DM-12); the match is exact on the normalized key, and no match, a collision of two roots for one key, or an unreadable or invalid matched config yields `unknown`, never `not-declared`.

### Appendix F — Error identities

The `queue` domain kind carries exactly five rows. Every row is documented and machine-declared together, names a real reachable behaviour, and projects through the delivered `{0, 1, 2}` exit taxonomy.

| Code | Category | Retryable | Consequence | Projection | Triggers when |
|---|---|---|---|---|---|
| `queue.dependency-cycle` | user | false | `not_landed` | user-validation (1) | A `queue add --dep` or `queue dep` invocation would close a directed cycle; the existing path is named and nothing is appended |
| `queue.lease-conflict` | transient | true | `not_landed` | user-validation (1) | A claim or release targets a repository whose live lease is held by another holder; the holder, lease identity, heartbeat age, and earliest takeover-eligible time are named |
| `queue.park-condition-stuck` | platform | false | `not_landed` | user-validation (1) | A claim cannot proceed because a park with a durable `clear-observed` record is still active without a later `recovered` record, or because the recovery append was refused; read surfaces report the same identity as a report-only finding at exit 0, while the claim refuses at exit 1 with zero appends |
| `queue.entry.unobserved` | user | false | `not_landed` | user-validation (1) | A ref-taking subcommand names a ref that is not present in the queue graph |
| `queue.precondition.unmet` | user | false | `not_landed` | user-validation (1) | A claim targets an entry that is not ready on one of the five pre-fence conditions (`deps-satisfied`, `tier-known`, `no-owner-gate`, `ci-healthy`, `provider-available`), has an active uncleared park (reason `parked:<cause>`), is outranked by a higher-ranked eligible action for its repository, or is held by its runner's weight cap; or a claim without a ref finds no eligible action (reason `no-eligible-action`); repository exclusivity is never this row (it is `queue.lease-conflict`); the blocking conditions, the outranking ref, or the no-eligible reason are named |

The `status` domain kind's delivered family `status.collector.<id>.unavailable` extends its closed collector-id set from `{tracker}` to `{tracker, lanes}`; the family shape, resolved row, and exit-2 projection are unchanged, and a family code naming an undeclared id remains unrecognized. No other domain kind changes, and `queue ready` gains no row. An unreadable or torn lease or park history is not a `queue` row: it is the delivered `state.*` family at exit 2 for `queue claim` and for `queue list|plan`, with evidence emitted and no success verdict. An invocation rejection such as `--watch` projects through the delivered `fallback.invocation` containment at exit 1 and adds no `queue` row. `queue release --park <cause>` validates against the closed cause set `{provider-window, provider-quota, preempted-for-close-item}`; an unknown cause is an invocation rejection through the same `fallback.invocation` containment at exit 1 and adds no `queue` row.

### Appendix G — Ticket acceptance-criteria map

| Ticket AC | Spec ACs |
|---|---|
| Two lanes cannot deliver the same repo concurrently, including two daemon-down one-shots where the second refuses with lease-held evidence | AC-F3-1(a), AC-F3-1(b), AC-F4-1, AC-F4-2 |
| A heavy build is not scheduled onto a runner already carrying one | AC-F5-1 |
| A ready producer is scheduled before its consumer | AC-F6-1 |
| Close items rank above new starts | AC-F7-1, AC-F9-1 (with AC-F7-2 for the preemption path) |
| A park resumes exactly when its condition clears, per-interval, with auto-recovery and a recorded incident | AC-F8-1, AC-F8-2 |
| The queue operates end to end without the daemon (one-shot mode) | AC-F10-1, AC-F10-2 |

## 25. DOCUMENT HISTORY

| Version | Date | Author | Changes |
|---------|------|--------|---------|
| 1.0 | 2026-11-07 | spec-writer | Initial specification from ticket GH-237 (including the binding pinned decisions), the M1 pack (contracts, `queue`, `lanes`, test scenarios, architecture), the backlog entry and its rank-37 rationale, the parallel-delivery concept, the command registry, and the delivered feature specs for queue ready, plan schema, state layer, merge and verify deploy, session lifecycle economics, configuration layer, provider engine, and result contract |
| 1.1 | 2026-11-07 | spec-writer | Contract-clarification amendment resolving test-plan findings OQ-T1..OQ-T7 (and the incidental OQ-T3 reading). Added §5.2 clarifications C-1..C-7; read surfaces now exit 2 on unreadable/torn lease or park history (NFR-13, AC-F10-3); AC-F3-1 split into read-only (a) and mutating (b) clauses; durable `clear-observed` park marker (`DM-5`, `EVT-4`, Appendix D); deterministic no-ref claim selection and no-eligible refusal (`F-4`, AC-F4-3, DEC-12); weight resolves to `heavy` when the plan cannot be read (`F-5`, AC-F5-2, DEC-10); deploy expectations resolve from the producer repository's own config bound to its key (`F-6`, AC-F6-2, DEC-13); stuck-park claim refuses at exit 1, readable stuck park remains a report-only finding at exit 0 (C-7, Appendix C/F); AC-F10-2 scoped to successful mutations. Open questions OQ-5..OQ-11 resolved; OQ-3 marked resolved by DEC-10/C-5; OQ-12 (delivery-bound naming) remains open. Appendix B step 1 aligned with the missing-plan triage fallback; §4.1 adds a read-surface exit metric. No change to DEC-1..DEC-4 or `queue ready`. |
| 1.2 | 2026-11-07 | spec-writer | DoR iteration-1 remediation (specification phase). R-01: pinned the claim pipeline — the pre-fence readiness gate excludes `repo-free`, the in-fence verified lease read owns repository exclusivity and projects `queue.lease-conflict` for another live holder, and an unready entry refuses `queue.precondition.unmet` only on the other five conditions (F-2, F-4, C-2, AC-F3-1(b), AC-F4-1, Appendix B, OQ-13). R-02: declared two distinct closed sets — park condition types `{provider-window, provider-quota, preemption}` and park causes `{provider-window, provider-quota, preempted-for-close-item}` — with one-to-one pairing, preemption resume semantics, and the `queue release --park <cause>` validation rule (F-8, DM-5, DM-10, NFR-14, Appendix C/E/F). R-03: pinned producer-root discovery — `queue add` records the declaring checkout's root with the normalized key, matching is exact, and a missing match, collision, or unreadable/invalid config degrades to `unknown` (F-6, DM-1, DM-12, C-6, §12, Appendix E, AC-F6-2, OQ-14). R-04: stuck parks are a hard exclusion (Appendix B step 7b) carrying the `park-condition-stuck` blocking reason, never `resume-parked`, never in `nextActions`, and never selected by a no-ref claim (F-7, F-8, AC-F8-1). R-05: per-pass single-flight projection (Appendix B step 13b) projects at most one action per repository and holds the remainder `repo-claimed-in-pass` (F-3, F-9, AC-F3-1(a), §10, Appendix C). R-07: NFR-3's concurrency scenario is restated to 50 concurrent claims by 50 distinct holders — exactly 1 acquires and 49 refuse — with the winning holder's repeat claim treated as a renewal rather than a conflict (NFR-3, C-2, AC-F4-1). R-08: the SC-M1-17 `dispatch <ref>` execution clause is recorded as inherited by M1-S9 with the 2026-11-07 PM acknowledgement (Appendix A, §22). R-09: AC-F8-1 and NFR-5 scope the interval bound to a mutating pass inside it and pin the no-engine gap recovery. R-10: AC-F1-1's given is restated and edges to refs with no entry are pinned as `dependency-unobserved` (F-1, F-2, DM-2, §12). R-11: lane-state provenance corrected — five M1-pack states plus this change's additive `failed`, distinct from the digest's attention set, with `lane.idle-no-reason` still dormant (F-11, DM-11). OQ-13/OQ-14 added resolved; OQ-12 context updated. DEC-1..DEC-4 unchanged; no scope expansion; `queue ready` unchanged. |
| 1.3 | 2026-11-07 | spec-writer | DoR iteration-2 remediation (specification phase). R2-01: the recorded repository root is removed from the `queue list` display requirement — AC-F1-1 now requires the entry, its normalized repository key, priority, and edges only — and the root is pinned as internal entry state used solely for deploy-expectation discovery, never rendered by `queue list`/`queue plan` and never present in envelopes, human output, or goldens (F-1, AC-F1-1, DM-1, DM-12, DM-13, EVT-1, Appendix C, glossary). R2-04: §20 and §21 now review the recorded absolute root explicitly as local, internal-only state that is never serialized to envelopes, findings, incidents, logs, goldens, or telemetry. R2-03: the `queue add | prioritize | dep` envelope carries `degraded[]` like every other successful mutation (Appendix C, F-10, AC-F10-2). R2-07: §19 and Appendix D state unambiguously that `queue.park` is one of this change's new record kinds whose schema includes `clearObservedAt`/`recoveryState` from its first write — the clear-observed marker is a field of that same kind, not a sixth kind — and the "existing payload schema / older park record" wording is removed. DEC-1..DEC-4 unchanged; no scope expansion; `queue ready` unchanged. |

---

## AUTHORING GUIDELINES

- **Sources**: ticket GH-237 (canonical tasks, ACs, and the binding pinned-decisions section), the PM clarify-scope output and `chg-GH-237-pm-notes.yaml`, `doc/planning/oss-tooling/backlog.md` §M1-S17 and `backlog-ranking.md` rank 37, `doc/planning/oss-tooling/milestones/m1/contracts.md` (shared envelope/exit/refusal pins and timing defaults), `m1/commands/queue.md`, `m1/commands/lanes.md`, `m1/test-scenarios.md` (SC-M1-08/09/10/11/17/17b), `m1/architecture.md` (state-mediated truth, writer ownership, queue/lanes/parks placement), `doc/planning/concepts/parallel-delivery.md` (lease scope, single-flight as policy), `doc/planning/oss-tooling/cli-command-registry.md`, and the delivered specs for queue ready, plan schema, state layer, merge and verify deploy, session lifecycle economics, configuration layer, provider engine, and result contract.
- **Pinned decisions were carried, not re-derived.** DEC-1..DEC-4 reproduce the ticket's binding decisions verbatim in intent; DEC-5..DEC-13 record spec-level choices that resolve genuine gaps (scheduler-owned readiness sources, the one-shot surface, `--watch` omission, lane identity, precedence, weight mapping, read-surface exit projection, no-ref claim selection, and producer-bound deploy expectations).
- **Ambiguities were deleted rather than described.** Appendix B is the single authoritative precedence order: hard exclusions remove, ordering rules order, and the two never trade places. The "parked ranks above new starts" pin is made coherent by scoping it to resumable parks, since an uncleared park is not a candidate at all.
- **No invention beyond named gaps.** Where the ticket, the pack, and the delivered specs did not decide something (queue discovery, preemption authority, the post-M1-S9 claim surface, delivery-bound naming), it is an open question rather than a silent choice; the 2026-11-07 amendment resolves the test-plan contract findings in §5.2 and records them in the decision log rather than leaving them to delivery.
- **No implementation detail.** Capabilities, contracts, flows, and record shapes are stated behaviorally; module names, file paths, and task breakdowns are left to the plan writer.
- **Baseline reconciliation is declared.** Four baseline realities are named explicitly instead of being smoothed over: the baseline `queue` synopsis assumed `dispatch` owned acquisition (DEC-6), the baseline `lanes` example used synthetic ordinal ids (DEC-8), the status digest still names a stale owning story for the lanes capability (RSK-9), and the planner's declared `leases` and the scheduler's lease objects are different concepts that share a word (F-3, glossary).
- **Readiness reuses, never redefines.** The six condition ids, order, tri-state, and evidence vocabulary are the delivered contract; the scheduler changes only sources where it has stronger truth, and `queue ready` is preserved byte-identically.

## VALIDATION CHECKLIST

- [x] `change.ref` matches provided `workItemRef` (GH-237)
- [x] `owners` has at least one entry
- [x] `status` is "Proposed"
- [x] All sections present in order (1–25 + guidelines + checklist)
- [x] ID prefixes consistent and unique (F-, EVT-, DM-, NFR-, RSK-, OQ-, DEC-, AC-)
- [x] Acceptance criteria reference at least one F-/DM-/EVT-/NFR- ID and use Given/When/Then
- [x] NFRs include measurable values
- [x] Risks include Impact & Probability
- [x] No implementation details (no file-level code paths, no step-by-step tasks)
- [x] No content duplicated from linked docs (contracts summarized, not copied)
- [x] Front matter validates per front_matter_rules
