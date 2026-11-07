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
- **G-7**: Closing beats opening: merge-ready, in-review, and resumable-parked entries rank above new starts, with preemption releasing a repository under a named park state.
- **G-8**: Parks that resume exactly when their condition clears, with per-condition-type recheck intervals as configuration, auto-recovery recorded as an incident, and a park outliving its condition surfaced as the classified `queue.park-condition-stuck` bug finding.
- **G-9**: One declared total scheduling precedence so close-first, producer-first, single-flight, weight caps, and parks never compete silently.
- **G-10**: The `queue` and `lanes` command families with bounded machine payloads, deterministic human output, and truthful degradation when no daemon exists.
- **G-11**: Vocabulary growth in-change and in sync: additive state record kinds, new `queue` error identities, new configuration keys, the extended collector-id set, and reconciled docs.

### 4.1 Success Metrics / KPIs

| Metric | Target |
|--------|--------|
| Repositories with two concurrently held `repo-exclusive` leases | 0, under any number of concurrent one-shots or a resident daemon (fixture-driven concurrency suites) |
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
| F-7 | Closing beats opening, with preemption under a named park state | Landing throughput is gated on closing work; a scheduler that prefers new starts leaves merge-ready work waiting behind operator attention. |
| F-8 | Parks with per-type recheck, exact resume, recovery incidents, and the stuck finding | A park without a recheck contract is an unbounded stall; a park that outlives its condition is a bug that must be classified, not tolerated. |
| F-9 | One declared total scheduling precedence | Close-first, producer-first, single-flight, weight caps, and parks interact; without one order, behavior is implementation-defined and untestable. |
| F-10 | `queue` and `lanes` command surfaces with bounded payloads and truthful degradation | Agents need a deterministic, bounded machine surface to act on, and an absent daemon must degrade declaratively rather than silently. |
| F-11 | Lane observation: state, idle reason, lease holder, restarts, amplification, weight class | Idle lanes are the operator's core symptom; a lane view that names why it is idle is what replaces coordinator polling. |
| F-12 | Guarded vocabulary growth synchronized in-change | New record kinds, error identities, configuration keys, and one collector id must land with their tables and docs in sync, or the contract drifts immediately. |

### 5.1 Capability Details

- **F-1**: Queue membership is explicit intent. `queue add <ref>` records an entry carrying the canonical work item ref, the repository key resolved from the invocation's binding, a priority, and its declared dependency edges; `queue prioritize <ref> <n>` sets priority; `queue dep <ref> <on-ref>` adds one edge. Every mutation is an appended intent record under the state layer's fence, and a replay of the identical mutation appends nothing. When the invocation's repository binding cannot be resolved, the entry is still recorded but carries no repository key, is never ready, and reports the delivered bundle reasons (`addressing-unresolved`, `remote-unsupported`) as evidence rather than assuming a repository. The folded graph — entries, edges, priorities, repository keys, resolved weight classes, and rank classes — is one rebuildable artifact; queue reads fold verified ledger truth and never treat a divergent projection as truth. Edge insertion validates acyclicity before appending: an edge that would close a cycle is refused with `queue.dependency-cycle`, names the existing path, lands nothing, and leaves the graph unchanged. Edge removal is not delivered in this change; a superseding entry replaces the prior entry projection for the same ref by identity.

- **F-2**: Readiness is the delivered six-condition model, re-derived per pass, with the same ids, order, tri-state, and "ready only when all six are satisfied" rule. Only the sources change where the scheduler has stronger truth: `deps-satisfied` consumes the union of normalized tracker `blocked-by` relations and declared dependency edges (the declared edge is additive and can only make the condition stricter, never looser); `repo-free` consumes active lease truth for the repository key instead of the local PM-context proxy, and names the holder and lease identity as evidence; `tier-known` consumes the validated plan tier first and the delivered triage-label proxy only when no plan artifact exists. `no-owner-gate`, `ci-healthy`, and `provider-available` reuse the delivered sources and evidence vocabulary unchanged. A source that failed, was not attempted, is unavailable, or is unresolved yields `unknown`, never `satisfied`. An invalid or missing plan is `unknown` with the delivered `plan.*` identity as evidence and never invents a tier.

- **F-3**: A lease is a durable object with `scope`, `repoKey`, `holder`, `ref`, `runner`, `acquiredAt`, `heartbeatAt`, `ttlMs`, and lifecycle. It is the runtime enforcement object and is distinct from the plan schema's declared `leases`, which are named resource declarations and a `lease-free`/`lease-taking` phase class; the scheduler reads the plan's declaration as intent evidence, never as a grant. `repo-exclusive` is the only implemented scope: exactly one active lease per repository key, keyed on the normalized remote (`host/owner/name`, protocol, credentials, and `.git` suffix removed). `worktree` is declared and not implementable through any delivered path; no command acquires it and no code path falls back to it. Single-flight is the *only* structural cap: no lane count, per-lane concurrency, bandwidth, or CI-slot limit exists as configuration or code, and a schedule over N distinct repositories yields up to N concurrent leases. The repository key is the contention domain, so two entries in different repositories never contend.

- **F-4**: The one-shot scheduling step is `queue claim [<ref>] [--holder <id>]`. It evaluates parks and readiness first, then acquires the state fence, re-reads the verified lease history for the repository key *inside* the fence, and appends only when the read shows no live lease, a stale lease eligible for takeover, or the caller's own lease (renewal or heartbeat refresh). The post-append verification requires exactly one new record of the expected kind under the repository key. A live lease held by another holder refuses with `queue.lease-conflict` at exit 1, consequence `not_landed`, naming the holder, lease identity, acquisition time, heartbeat age, and the earliest takeover-eligible time. A lease is stale when its heartbeat age is at or beyond `queue.lease-ttl`; a takeover appends a new acquisition record that names the taken-over lease, its holder, its heartbeat age, and its last heartbeat time, so the takeover is always evidenced. A live lease is never taken over, and the state fence's own staleness window is a distinct mechanism from the lease TTL — the fence is held only for the duration of one write. Claiming an entry that is not ready, is outranked by a higher-ranked eligible action for the same repository, or is held by a weight class the runner cannot take refuses with `queue.precondition.unmet` naming the reason. `queue release <ref> [--holder <id>] [--park <cause>]` appends the release and, when a park cause is named, the park record in the same fenced transaction — both land or neither; releasing when no lease exists is an explicit idempotent no-op, and releasing another holder's live lease refuses. An unreadable or torn lease history is never read as "free": the claim refuses with the classified `state.*` identity at exit 2.

- **F-5**: The scheduler's weight-class vocabulary is closed: `standard` and `heavy`. An entry's class resolves from the validated plan (phase `weightClass` or `defaultWeightClass`); an absent declaration resolves to `standard`; a declared but unrecognized value resolves to `heavy` — the conservative direction, matching the delivered overlap rule's preference for a false sequence over a false parallel. The runner identity is the declared execution-environment identity (the host is the only implementation today, one runner per state directory), recorded on the lease so the accounting survives a future containerized or remote runner without redesign. At most one heavy-class lease is active per runner: a heavy claim is held with reason `weight-class` while another heavy lease is active on that runner, and standard entries continue to be scheduled — a weight cap never reduces the number of active repositories.

- **F-6**: Declared dependency edges carry ordering and, where declared, deploy gating. A producer precedes its consumer: a consumer is not eligible while its producer's change is unresolved, which removes the pair from competition rather than merely reordering it. When both are eligible in the same repository, the producer ranks ahead of the consumer regardless of priority; in different repositories both may be concurrent and the producer merely appears first in the ordered action list. For a dependent repository's merge action, the producer's landing must be observed through the delivered landing evidence, and when the producer's repository declares deploy expectations through the delivered `merge.deploy-expectations` configuration, the delivered `verify deploy` verdict must be `verified` with its evidence; `unknown`, `failed`, or an unreadable trace holds the dependent at `deploy-unverified` — never green. When the producer declares no deploy expectation, the gate is landing-only and the evidence records `deploy: not-declared` so the weaker guarantee is visible. Deploy verdict reads are bounded per pass and memoized per producer within the pass; edges beyond the read bound are held `deploy-unverified` with reason `read-budget-exhausted`.

- **F-7**: Scheduling rank classes are closed and ordered: `merge-ready` (0), `in-review` (1), `resume-parked` (2), `new-start` (3). `merge-ready` and `in-review` reuse the delivered close-association classification (`merge-ready` requires an observed approval on a non-draft open pull request; `in-review` covers every other associated open pull request, the population `queue ready` calls `review-pending`). `resume-parked` applies only to a parked entry whose condition has evaluated clear and is therefore resumable in this pass — an uncleared park is not a rank candidate at all, which is why "parked ranks above new starts" is a meaningful statement rather than a contradiction. Preemption is computed, not improvised: when a close item is eligible for a repository whose lease is held by a new start, the pass emits a preemption action naming the park state `preempted-for-close-item`, and the release path records that park. Single-flight still holds until the release lands, so the close item is not scheduled in the same pass. Automatic execution of preemption belongs to M1-S18; in this change the action is emitted and the release is performed by `queue release --park`.

- **F-8**: A park is a durable object carrying the entry, the repository key, a closed cause, a typed evaluable condition, an absolute expiry when the condition supplies one, the resolved recheck interval, the last evaluation time, and the recovery state. The shipped condition types and their configuration keys are `provider-window` (clears at the provider window's absolute expiry), `provider-quota` (clears when the provider condition is observed available again), and `preemption` (clears when the preempting lease on the repository is released and the entry is ready again). Owner gates and external waits are not parks: they are readiness blockers and typed questions on their own surfaces. On every pass, each active park whose interval has elapsed is re-evaluated; a cleared condition is recovered in the same pass on a mutating surface with a `queue.incident` record naming the condition, the clear time, the evaluation time, and the observation gap since the previous evaluation. A park that a pass observed clear and that is still active on a later pass — because the recovery did not take effect — or whose recovery append was refused, is the `queue.park-condition-stuck` bug class: read surfaces report it as a finding without failing, and a mutating claim on that entry refuses rather than claiming behind a park that should have cleared. A park that was simply not evaluated while no engine process ran is never stuck on the first pass after the gap; it recovers with an incident naming the gap.

- **F-9**: The precedence order is fixed and total (Appendix B): hard exclusions first (readiness, dependency and deploy gates, parks, single-flight, weight caps), then rank class, then producer-before-consumer among entries contending for one repository, then explicit priority ascending, then numeric reference suffix, then canonical ref text. Hard exclusions remove a candidate and never reorder it; ordering rules never override a hard exclusion. Close-first therefore can never admit an entry past a gate, and a gate can never demote a close item below a new start — it removes it with a named reason. Priority is a non-negative integer where the lower value is earlier, defaulting to a declared constant; changing a priority changes order only inside one rank class.

- **F-10**: `queue` gains `list`, `plan`, `add`, `prioritize`, `dep`, `claim`, and `release`; `ready` is untouched. `lanes` adds `list` and `show <lane>`. `queue plan [--next <n>]` computes the next actions with reasons; `queue list` renders the graph, leases, weight loads, and parks. Mutating subcommands write state; when no daemon is reachable they still land and the envelope carries `degraded: ["daemon-unreachable"]` at exit 0 — state is authoritative and the daemon reconciles later. `--watch` is **not** in the accepted grammar for this delivery: an invocation carrying it is refused through the delivered `fallback.invocation` containment with a remediation hint naming the resident daemon story. Omission is chosen over an accepted-but-degraded flag because accepting it would require daemon vocabulary and a transport seam this change does not deliver, and because a refused flag is strictly truthful; no silent empty stream is representable.

- **F-11**: Lane identity is the canonical work-item ref, because no lane registry is delivered and a synthetic ordinal would change across restarts. The lane state vocabulary is the delivered lanes contract set — `delivering`, `idle-with-reason`, `parked`, `merge-ready`, `in-review`, `failed` — with a bounded idle-reason set drawn from the blocking conditions and the scheduler's holds. Each lane carries its lease holder and scope when held, its restart count and amplification signal from the delivered economics view (`null` with a warning when underivable, never a fabricated zero), and its weight class. Lanes are a pure fold over queue entries, leases, parks, and economics records: no lane record kind exists and no lane state is stored. An unreadable queue store surfaces as the declared `status.collector.lanes.unavailable` identity at exit 2, never as a zero-lane view.

- **F-12**: Vocabulary growth lands in-change: five additive record kinds inside `delivery.state.v1` with their own payload schema identifiers and store-scoped keys (Appendix D), one rebuildable derived document, one new `queue` domain kind with exactly five documented rows — `queue.dependency-cycle`, `queue.lease-conflict`, `queue.park-condition-stuck`, `queue.entry.unobserved`, and `queue.precondition.unmet` (Appendix F) — the collector-id set extended from `tracker` to `tracker` and `lanes`, and one new typed `queue` configuration branch with `queue.lease-ttl` and `queue.park-recheck.<type>` (Appendix E). Existing rows, keys, and record kinds are unchanged; the machine table, the documented table, the source references, and the fixtures agree in both directions. A park finding is report-only on read surfaces and becomes a classified error only where a mutating pass cannot proceed, so the same identity never appears twice in one outcome.

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
    → nextActions[] with reasons; parks with recheck intervals;
      degraded=["daemon-unreachable"] when no daemon is reachable
    → 0 writes, 0 fences, 0 appends. A failed source is evidence, not a failure.

Flow 3: Claim the scheduling step (one-shot, daemon-free)
  Agent or coordinator → queue claim [<ref>] [--holder <id>]
    → evaluate parks and readiness; recover a cleared park, record the incident
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
    → a pass that finds it clear but still active (recovery did not land,
      or the recovery append was refused) → queue.park-condition-stuck
      finding on reads / refusal on claim — a classified bug, never silence.

Flow 5: Producer before consumer, deploy verified before dependent merge
  GH-300 (producer, repo-alpha) and GH-301 (consumer, repo-beta)
    → GH-301 is not eligible while GH-300 is unresolved (hard gate)
    → GH-300 claims and delivers; landing observed
    → repo-alpha declares merge.deploy-expectations → verify deploy must read
      verified with evidence before GH-301's merge action is eligible
    → verified → GH-301's merge action becomes eligible (deploy evidence named)
    → unknown / failed / read-budget-exhausted → held deploy-unverified
    → no declared expectation → landing-only gate, evidence "deploy: not-declared".

Flow 6: Closing beats opening, and preemption
  GH-310 merge-ready (repo-alpha) is eligible while GH-311 (new start,
  repo-alpha) holds the repo-alpha lease
    → merge-ready ranks first (0) but single-flight still holds the lease
    → the pass emits a preemption action with park state
      preempted-for-close-item, naming the holder of GH-311
    → queue release GH-311 --park preempted-for-close-item releases the repo
      and parks GH-311 under that named state
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
- The daemon-free one-shot scheduling step: fence-token claim, conflict refusal with holder evidence, stale-lease takeover with evidence, release, and park-on-release (F-4).
- Build-weight classes as a per-runner resource class with the committed conservative mapping (F-5).
- Dependency-aware batching, producer precedence, and the deploy-verified gate before a dependent repository merges (F-6).
- Closing-beats-opening rank classes, resumable-park ranking, and the computed preemption action with its named park state (F-7).
- Parks with closed condition types, per-type recheck configuration, exact resume, recovery incidents, and the stuck-park finding and refusal (F-8).
- The declared total precedence order (F-9, Appendix B).
- The `queue` and `lanes` command families with bounded payloads, deterministic human output, and the truthful daemon-down degradation marker (F-10, F-11).
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
| EVT-1 | `queue.entry` intent record | Appended by `queue add` and `queue prioritize` under the state fence; payload schema `delivery.queue.entry.v1` under the store-scoped key `queue.entries:<REF>`; carries the ref, repository key, priority, and recorded time. Latest record wins; an identical replay appends nothing; a malformed or wrong-kind record under the prefix is a classified `state.*` failure, never a fabricated entry. |
| EVT-2 | `queue.dependency` intent record | Appended by `queue add --dep` and `queue dep`; payload schema `delivery.queue.dependency.v1` under `queue.deps:<REF>`; carries the folded declared edges originating at the ref. Acyclicity is validated before the append; a duplicate edge appends nothing; a cycle-creating edge lands nothing. |
| EVT-3 | `queue.lease` execution record | Appended by whichever process performs the claim or release — one-shot or daemon — with writer attribution; payload schema `delivery.queue.lease.v1` under `queue.leases:<repoKey>`; carries scope, repository key, holder, ref, runner, weight class, acquisition, heartbeat, TTL, lifecycle operation (`acquired`, `renewed`, `released`, `taken-over`), takeover evidence, and recorded time. Exactly one new record per operation, verified post-append. |
| EVT-4 | `queue.park` execution record | Appended on park, recovery, and release; payload schema `delivery.queue.park.v1` under `queue.parks:<REF>`; carries cause, typed condition, absolute expiry when the condition supplies one, resolved recheck interval, clear time, evaluation time, recovery time, and the release cause when parked on release. At most one active park per entry. |
| EVT-5 | `queue.incident` execution record | Appended on auto-recovery and on stale-lease takeover; payload schema `delivery.queue.incident.v1` under `queue.incidents:<REF>` (or `queue.incidents:<repoKey>` for takeovers); carries the incident type, the bounded evidence (condition and times for recovery; previous holder, lease, and heartbeat age for takeover), and recorded time. Never carries free-form prose. |
| EVT-6 | Computed schedule and findings view | Envelope-only: ordered `nextActions[]`, `entries[]`, `leases[]`, `weights`, `parks[]`, `findings[]`, and `degraded[]`. Never persisted; two identical passes over identical state produce byte-identical output. |

New record kinds join the existing state schema additively: no schema-version bump, no migration, no backfill, and no change to existing record kinds, reads, or boundaries. No record carries a secret, a credential reference value, a raw provider payload, or free-form message content.

### 8.3 Data Model Impact

| ID | Element | Description |
|----|---------|-------------|
| DM-1 | Queue entry | Canonical ref, repository key (absent when the binding could not be resolved), non-negative priority with a declared default, and recorded time. The effective weight class, tier, and rank class resolve per pass from artifacts and are never frozen on the entry. Identity is the canonical ref. |
| DM-2 | Dependency edge | Directed edge from a consumer ref to a producer ref, with the ordering role and the deploy-gating applicability derived from the producer's declared deploy expectations. |
| DM-3 | Readiness evaluation | Six conditions in the delivered fixed order with the closed tri-state, bounded evidence, and named blocking conditions; ready only when all six are satisfied. |
| DM-4 | Lease with scope | Scope (`repo-exclusive` implemented; `worktree` declared and unused), repository key, holder identity, ref, runner identity, weight class, acquisition and heartbeat times, TTL, lifecycle operation, and takeover evidence. |
| DM-5 | Park | Entry, repository key, closed cause, typed evaluable condition, absolute expiry when supplied, resolved recheck interval, last evaluation time, clear time, recovery time, and release cause when parked on release. |
| DM-6 | Incident | Type (`park-auto-recovery`, `lease-stale-takeover`), bounded typed evidence, entry or repository key, and recorded time. |
| DM-7 | Weight class | Closed values `standard` and `heavy`; resolved from the plan, defaulted to `standard` when absent, and mapped conservatively to `heavy` when a declared value is unrecognized. |
| DM-8 | Scheduling rank class | Closed ordered values `merge-ready`, `in-review`, `resume-parked`, `new-start`; derived from the delivered close-association classification and the park state. |
| DM-9 | Scheduled action | One computed action: ref, repository key, rank class, reason, priority, weight class, lease status, blocking conditions, and the preemption block when the action is a preemption. |
| DM-10 | Preemption block | The parked release: target ref, repository key, holder, park cause `preempted-for-close-item`, and the close item that motivated it. |
| DM-11 | Lane view | Ref as lane identity, closed lane state, bounded idle reason, lease holder and scope, restart count and amplification from the delivered economics view, and weight class. |
| DM-12 | Repository key | Normalized `host/owner/name` from the invocation's repository binding, with protocol, credentials, userinfo, and `.git` suffix removed; the contention domain for single-flight and the key for weight accounting. |
| DM-13 | Queue graph document | Rebuildable derived document folding entries, edges, priorities, repository keys, weight classes, and rank classes; replaced atomically only when intent truth changes and never read as truth when divergent. |
| DM-14 | Finding | A stable finding code with a severity and bounded evidence; `queue.park-condition-stuck` is the scheduler's own code; report-only on reads. |

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
| NFR-2 | Read purity | `queue list`, `queue plan`, `lanes list`, and `lanes show` perform 0 state writes, 0 fence acquisitions, 0 appends, and 0 derived-document replacements; parks are evaluated read-time and reported, never recovered by a read. |
| NFR-3 | Claim atomicity | Under 50 concurrent claim attempts against one repository with no lease held, exactly 1 acquires and 49 refuse; 0 duplicate lease records exist for one (repository, holder, acquisition); 0 claims land without a post-append verification. |
| NFR-4 | Lease staleness integrity | 100% of leases with heartbeat age at or beyond `queue.lease-ttl` are takeover-eligible and 100% of takeovers record previous holder, lease identity, heartbeat age, and last heartbeat time; 0 live leases are taken over. |
| NFR-5 | Park resume latency | A park whose condition clears while a mutating pass runs is resumed within one recheck interval of the clear time (`≤ interval`, default 60 000 ms for windows and preemption, 300 000 ms for quota); 0 parks remain active without either a recovery record or a `queue.park-condition-stuck` finding once a pass has observed the condition clear. |
| NFR-6 | Bounded scheduling cost | Candidate ordering uses cheap graph facts over the full entry set; the expensive readiness condition reads (tracker, pull request, CI, provider, deploy) are performed for at most the first 32 ordered candidates per pass, with the remainder marked truncated and a named reason; a plan over 500 entries and 1 000 edges completes in ≤ 250 ms on the reference environment excluding provider reads; at most 1 tracker page, 1 pull-request page per evaluated repository, 1 check-runs page per evaluated candidate, and 3 deploy verdict reads per pass, each memoized within the pass. |
| NFR-7 | Hermetic tests | 0 live network calls, 0 live credential reads, 0 real sleeps; clock, state store, provider reads, and deploy reads are injected; the fixture corpus covers every gate, rank class, park type, refusal, takeover, and stuck case. |
| NFR-8 | State compatibility | 0 schema-version bumps, 0 migrations, 0 backfills; 5 additive record kinds and 1 rebuildable derived document; existing stores open unmodified and queue reads on them are verified-empty, never torn or zeroed. |
| NFR-9 | Bounds | Entries per folded read ≤ 500; edges per entry ≤ 32; next actions ≤ 20 (default 3); lanes ≤ 200; findings ≤ 20; reasons ≤ 8; serialized `data` ≤ 65 536 UTF-8 bytes; human output ≤ 40 lines and 8 192 UTF-8 bytes; every bound has an explicit truncation marker. |
| NFR-10 | Configuration-only tuning | Changing `queue.lease-ttl` or any `queue.park-recheck.<type>` changes behaviour with 0 code changes; a non-integer, zero, or negative value is `config.value.invalid` naming the key; 100% of the knobs are demonstrated by configuration-only tests. |
| NFR-11 | Error-table synchronization | 5 new `queue` rows and 1 new collector id exist in the machine table, the documented table, the source references, and the fixtures in both directions; 0 existing rows change; classification is exact-code with `fallback.internal` containment. |
| NFR-12 | Secret and payload safety | 0 secret bytes, credentials, raw provider payloads, or free-form message bodies in envelopes, records, findings, incidents, or evidence; the delivered redaction chokepoint covers the new payloads; 0 new secret-read allowlist entries. |
| NFR-13 | Fail-closed state reads | An unreadable, torn, or unknown lease or park history yields the classified `state.*` identity and never "free" or "not parked"; a claim on unreadable lease state refuses at exit 2 with 0 writes. |
| NFR-14 | Vocabulary stability | Record kinds, error codes, configuration keys, park causes, condition types, weight classes, rank classes, and lane states are closed sets; growth requires a spec update, and cross-cutting growth requires a decision record. |

## 10. TELEMETRY & OBSERVABILITY REQUIREMENTS

- **Findings are the read surface.** `queue list|plan` and `lanes list|show` carry bounded `findings[]` with stable codes, severity, and typed evidence; `queue.park-condition-stuck` is the scheduler's own code, and blocking-condition reasons ride on the entry rather than as findings.
- **Incidents are the durable event surface.** Park auto-recovery and stale-lease takeover append `queue.incident` records; a takeover never happens silently, and a recovery always names the condition, the clear time, the evaluation time, and the observation gap.
- **Degradation is declared, never implied.** Every payload carries `degraded[]`; `daemon-unreachable` is present whenever no daemon is reachable, and an empty queue or lane list is an explicit observed-empty with counts, never a silent zero.
- **Explanations are first-class.** Each scheduled action and each held entry carries the reason it was chosen or held (`close-first`, `producer-first`, `lease-held`, `weight-class`, `parked:<cause>`, `deploy-unverified`, `dependency-open`, `outranked`, a named readiness condition) so the coordinator never re-derives the decision.
- **Invocation audit is inherited.** The delivered command audit ledger (M1-S22) captures every queue and lanes invocation automatically; this change adds no audit field, no exporter, no metric, no trace span, and no background collector.
- **Economics is read, never recomputed.** Restart counts and the resume-amplification signal come from the delivered per-delivery economics fold; a value that cannot be derived is `null` with the delivered warning, never a fabricated zero.

## 11. RISKS & MITIGATIONS

| ID | Risk | Impact | Probability | Mitigation | Residual Risk |
|----|------|--------|-------------|------------|---------------|
| RSK-1 | Two claims both observe "no lease" and both append, breaking single-flight | H | M | The re-read happens **inside** the fence, the append is serialized by the single-writer lock, and a post-append verification requires exactly one new lease record under the repository key; concurrency suites and an injected refusing store pin the refusal paths | L |
| RSK-2 | The lease TTL is mistuned: too short steals a live delivery's repository, too long strands it | H | M | Heartbeat cadence is derived from the TTL, staleness is stated at-bound, takeover is always recorded with evidence, and the TTL is configuration-only tunable with validation | M — tuning depends on operator discipline |
| RSK-3 | Park recheck produces false stuck findings after daemon downtime or a long idle period | M | M | "Stuck" requires a prior recovery attempt or a refused recovery append; an observation gap produces an incident naming the gap, never a stuck finding | L |
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
| OQ-3 | Is the weight vocabulary exactly `standard` and `heavy`, and should an unrecognized declared class fail closed to `heavy` or be refused at plan validation? | The delivered plan schema deliberately accepts and echoes unknown weight classes and defers the vocabulary to this scheduler; the conservative mapping is safe but a typo silently costs throughput. | Decision needed: consult `@decision-advisor` (vocabulary ownership) |
| OQ-4 | Should `queue claim`/`queue release` keep this grammar once M1-S9 lands, or should acquisition move behind `dispatch` only? | This change must expose acquisition to prove daemon-down mutual exclusion without shipping `dispatch`; whether the verbs remain public afterwards affects the long-term command surface. | Open — confirm at M1-S9 planning; no divergence now |

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
| DEC-10 | Weight classes are `standard` and `heavy`; absent resolves to `standard`; a declared-but-unrecognized value resolves to `heavy` | The scheduler owns the vocabulary the plan schema deferred; erring toward the heavier class can only reduce co-scheduling, never overload a runner | 2026-11-07 |

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
| AC-F1-1 | **Given** a project with no queue state and GH-302 already declaring a dependency on GH-301, **when** `queue add GH-301 --priority 5 --dep GH-300` succeeds and then `queue dep GH-301 GH-302` would close a cycle, **then** the entry and the first edge are recorded under the fence, the cycle-creating edge is refused with `queue.dependency-cycle` naming the existing path (GH-301 → GH-302 → GH-301), nothing is appended for it, an identical replay of the successful mutation appends nothing, and `queue list` shows the entry, its repository key, its priority, and its edge. | F-1, DM-1, DM-2, DM-13, EVT-1, EVT-2, NFR-8 |
| AC-F2-1 | **Given** a queued entry with one open dependency, an owner-attention label, and an unreadable CI source, **when** the readiness pass runs, **then** exactly six conditions are reported in the delivered order with the closed tri-state, `deps-satisfied` is `unsatisfied` with the open dependency named, `no-owner-gate` is `unsatisfied` with the label named, `ci-healthy` is `unknown` with its declared reason, every non-satisfied condition appears in `blockingConditions`, and the entry is not ready — with no fabricated zero and no `satisfied` derived from a failed read. | F-2, DM-3, NFR-1, NFR-13 |
| AC-F3-1 | **Given** two ready entries targeting repo-alpha and no lease held, **when** the schedule is computed or two one-shots claim concurrently, **then** exactly one lane holds the repo-alpha `repo-exclusive` lease, the other waits with reason `lease-held`, and the waiting entry's `repo-free` evidence names the holder and the lease identity. (SC-M1-08) | F-3, F-2, DM-4, DM-12, NFR-3 |
| AC-F3-2 | **Given** any lease record in the store, **when** it is inspected, **then** it carries a `scope` field whose value is `repo-exclusive`, no delivered path acquires under any other scope, and no configuration key, code path, or decision rule reduces lane count because of capacity, bandwidth, or CI slots. | F-3, DM-4, NFR-14 |
| AC-F4-1 | **Given** the daemon stopped, no lease held, and two one-shot processes claiming the same repository concurrently, **when** both run, **then** exactly one acquires the lease with a recorded heartbeat, the other refuses at exit 1 with `queue.lease-conflict`, consequence `not_landed`, naming the holder and the lease identity; **and given** a lease whose heartbeat age is at or beyond `queue.lease-ttl` with no renewal, **when** a claim runs, **then** the stale lease is taken over with recorded evidence naming the previous holder, lease, and heartbeat age, while a live lease is never taken over. (SC-M1-17b) | F-4, DM-4, DM-6, EVT-3, EVT-5, NFR-3, NFR-4 |
| AC-F4-2 | **Given** an unreadable or torn lease history for a repository, **when** a claim targets it, **then** the claim refuses with the classified `state.*` identity at exit 2, performs no append, and never reports the repository as free. | F-4, NFR-13, NFR-12 |
| AC-F5-1 | **Given** runner R2 carrying a heavy-class lease and GH-309 which is heavy-class and ready, **when** scheduling computes, **then** GH-309 is held with reason `weight-class`, at most one heavy job is scheduled per runner, standard-class entries continue to be scheduled, and the number of active repositories is unchanged. (SC-M1-09) | F-5, DM-7, NFR-14 |
| AC-F6-1 | **Given** GH-300 (producer, repo-alpha) and GH-301 (consumer, repo-beta) with a declared edge, **when** GH-300 is unresolved and GH-301's merge is ready, **then** GH-301 is held `dependency-open` and is not scheduled; **and when** GH-300 has landed and repo-alpha declares deploy expectations, **then** GH-301's merge action is eligible only after `verify deploy GH-300` reads `verified` with its evidence, holds at `deploy-unverified` on `unknown`, `failed`, or an exhausted deploy read budget, and otherwise (no declared expectation) passes on landing with `deploy: not-declared` evidence; **and when** both are eligible in one repository, GH-300 ranks before GH-301. | F-6, DM-2, DM-9, NFR-6 |
| AC-F7-1 | **Given** one merge-ready entry and one ready new start, both eligible, **when** `queue plan --next 2` runs, **then** the merge-ready entry ranks first, both entries carry their reasons, and the order is byte-identical across repeated runs. (SC-M1-10) | F-7, DM-8, DM-9, F-9, NFR-1 |
| AC-F7-2 | **Given** a merge-ready entry on repo-alpha whose lease is held by a new start, **when** scheduling computes, **then** the pass emits a preemption action naming park state `preempted-for-close-item` and the holder, the close item is not scheduled in that pass, and `queue release <ref> --park preempted-for-close-item` releases the lease and records the named park state in one fenced transaction — both land or neither. | F-7, DM-10, DM-5, EVT-3, EVT-4 |
| AC-F8-1 | **Given** a lane parked on a provider window ending at T, **when** a mutating pass runs after T, **then** the lane resumes with the resume recorded within one recheck interval of T and a `queue.incident` naming the condition, the clear time, the evaluation time, and the observation gap; **and given** a park observed clear that is still active on a later pass, or a recovery append that the store refuses, **then** `queue.park-condition-stuck` is reported as a finding on reads and a claim on that entry refuses with the same classified identity, while a park skipped only because no engine ran is recovered with a gap-naming incident and is never reported stuck. (SC-M1-11) | F-8, DM-5, DM-6, DM-14, EVT-4, EVT-5, NFR-5 |
| AC-F8-2 | **Given** a shipped default recheck interval for a park condition type, **when** an operator changes only `queue.park-recheck.<type>`, **then** the resume timing changes with no code change and the new value is observable in the park evidence; a non-integer, zero, or negative value is refused `config.value.invalid` naming the key. | F-8, NFR-10 |
| AC-F9-1 | **Given** a generated corpus mixing every gate, both weight classes, three park types, both dependency roles, close and new-start classes, and explicit priorities, **when** the schedule is computed, **then** the output follows the declared total order exactly — hard exclusions before ordering, rank class before producer tie-break, priority only inside a class, numeric suffix then ref text as the final tie-breaks — and no input ordering changes the result. | F-9, NFR-1, NFR-7 |
| AC-F10-1 | **Given** the daemon stopped and one ready entry, **when** `queue plan --next 1` runs and then the one-shot scheduling step claims it, **then** the plan is computed from state and exits 0 with `degraded: ["daemon-unreachable"]`, the claim lands a lease, the state is consistent for later daemon reconciliation, and no daemon, socket, or background process is required at any point. (SC-M1-17) | F-10, F-4, NFR-2 |
| AC-F10-2 | **Given** any mutating `queue` subcommand with no daemon reachable, **when** it runs, **then** the intent or execution record lands durably, a replay of the identical mutation appends nothing, and the envelope reports the degradation instead of failing silently or claiming a daemon notification occurred. | F-10, DM-13, NFR-8, NFR-2 |
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

None. Five additive record kinds and one rebuildable derived document join `delivery.state.v1` with no schema-version bump, no migration, no backfill, and no rebuild command. A store that has never seen a queue record reads as verified-empty, so an existing installation starts with an empty, explicitly reported queue. The queue graph document is a cache rebuilt from verified intent records and is never truth. No seed data is required; the configuration branch ships defaults and the weight and rank vocabularies are contract data.

## 20. PRIVACY / COMPLIANCE REVIEW

No personal data is introduced. Records and payloads carry work-item refs, normalized repository keys, priority and weight values, lease holder identities (a local process or declared holder label, never a person's identity), park conditions and timestamps, and bounded incident evidence. No prompt text, message body, transcript, diff, file content, or credential appears in any record, finding, or envelope. The scheduler performs no tracker write, so it neither reads nor transmits anything a delivered read path does not already expose, and the delivered redaction chokepoint covers the new payloads.

## 21. SECURITY REVIEW HIGHLIGHTS

- **Mutual exclusion is structural, not advisory.** The lease decision is a verified read performed inside the state layer's single-writer fence, followed by a post-append count verification. A conflicting claim refuses with evidence; a live lease cannot be taken over; an unreadable lease history fails closed at exit 2 rather than reading as free.
- **A holder identity is not authorization.** Any same-user process may claim within the fence, exactly as the delivered trust model states for the local state directory; the holder identity exists for evidence, correlation, and human diagnosis. The escape paths (credential sidecar, containerized lanes) remain the parked concepts.
- **The lease TTL and the fence staleness window are distinct mechanisms.** Conflating them would either weaken write serialization or steal live deliveries; the fence is held only for the duration of one write, and the lease TTL governs durable ownership.
- **No new external write surface and no shell.** The engine performs bounded read-only provider reads through existing seams, spawns no child process, executes no shell, and adds no secret-read allowlist entry.
- **Bounded untrusted input.** Refs are canonicalized with the delivered pattern and length bound; holder labels, park causes, condition types, weight classes, and rank classes are closed vocabularies; priorities are validated integers; oversized or malformed input is an invocation rejection before any read.
- **Truthful degradation.** An absent daemon, an unreadable store, a failed provider read, and an exhausted evaluation budget each produce a declared degraded or unavailable state; none produces a silent empty or all-clear view.

## 22. MAINTENANCE & OPERATIONS IMPACT

- **Vocabulary is guarded.** Record kinds, payload schemas, error rows, configuration keys, park causes, condition types, weight classes, rank classes, and lane states are closed sets (NFR-14); growth requires a spec update and, where cross-cutting, a decision record.
- **Adding an entry, priority, or edge** is a command invocation; **tuning lease timing or park cadence** is configuration (NFR-10); **adding a park condition type** is a spec change with a default interval.
- **Adding a runner** is an execution-environment change consumed by the already-carried runner field; per-runner heavy limits become configuration only when more than one runner exists.
- **Doc duties land in-change**: the scheduling feature spec, the queue and lanes man pages, the CLI command registry, the glossary, and the configuration and state-layer spec additions.
- **Operational posture**: no daemon, socket, timer, or background process to operate. Parks are evaluated by the passes that run; an idle host evaluates nothing and resumes on the next invocation.
- **Known follow-ups** are named, not assumed away: the status digest's stale lanes reference, the `--watch` stream with the daemon, preemption authority (OQ-2), the weight vocabulary (OQ-3), and the claim/release surface at M1-S9 (OQ-4).

## 23. GLOSSARY

| Term | Definition |
|------|------------|
| Queue entry | One declared intent to deliver a work item, carrying its repository key, priority, weight class, and dependency edges. |
| Dependency edge | A directed consumer-to-producer declaration; a producer must precede its consumer, and a producer's deploy verdict gates a dependent repository's merge when deploy expectations are declared. |
| Ready / readiness | All six delivered conditions satisfied, re-derived per pass; any `unsatisfied` or `unknown` condition makes the entry not ready and is named. |
| Lease | A durable, fenced object granting exclusive delivery rights over a scope for a holder until release, expiry, or takeover. It is the runtime enforcement object, distinct from a plan's declared `leases`, which are named resource declarations. |
| Lease scope | The contention domain of a lease; `repo-exclusive` is the only implemented scope, `worktree` is declared and unused. |
| Single-flight | The invariant that exactly one active lease exists per repository key; the only structural cap on concurrent lanes. |
| Repository key | The normalized `host/owner/name` remote identity that single-flight and weight accounting key on. |
| Stale lease | A lease whose heartbeat age is at or beyond `queue.lease-ttl`; the only lease a takeover may displace. |
| Takeover | Acquiring a stale lease, always recorded with the previous holder, lease identity, and heartbeat evidence. |
| Weight class | The closed resource class `standard` or `heavy`; at most one heavy-class lease is active per runner, and weight is never a lane cap. |
| Rank class | The closed scheduling classes `merge-ready`, `in-review`, `resume-parked`, and `new-start`, ordered in that sequence; `in-review` is the population `queue ready` calls `review-pending`. |
| Closing beats opening | The rule that close items (merge-ready, in-review) and resumable parks rank above new starts, subject to hard gates. |
| Hard exclusion | A gate that removes a candidate (readiness, dependency, deploy, park, single-flight, weight cap) and never merely reorders it. |
| Park | A durable hold on an entry with a closed cause, an evaluable condition, a recheck interval, and an optional absolute expiry. |
| Recheck interval | The per-condition-type cadence at which an active park's condition is re-evaluated; configuration with shipped defaults. |
| Resume / auto-recovery | The recorded resumption of a parked entry when its condition is observed clear, accompanied by an incident record. |
| Observation gap | The elapsed time since a park was last evaluated; named in a recovery incident when no engine process ran in between. |
| Stuck park | A park observed clear that remains active after a recovery attempt, or whose recovery was refused; the classified bug `queue.park-condition-stuck`. |
| Preemption | Releasing a repository from a new start so a close item can land, always under the named park state `preempted-for-close-item`. |
| Runner | The declared execution environment carrying weight classes; the host is the only implementation today, one runner per state directory. |
| Lane | The observation projection of one queue entry: state, idle reason, lease, restarts, amplification, and weight class. |
| Degraded | A declared, non-failing state marker (`daemon-unreachable`, a failed source, an exhausted evaluation budget) that never renders as clear or zero. |
| Incident | A durable record of a park auto-recovery or a stale-lease takeover, carrying bounded typed evidence. |
| One-shot scheduling step | `queue claim` and `queue release`: the daemon-free acquisition and release of a lease, composed by `dispatch` when it lands. |

## 24. APPENDICES

### Appendix A — Seeded scenario reconciliation

| Seed | Owning surface | Folded into | Divergence rule |
|------|----------------|-------------|-----------------|
| SC-M1-08 same-repo single-flight | Leases, `repo-free` evidence, schedule | AC-F3-1, AC-F4-1 | The lease record and the waiting entry's holder/lease evidence are asserted verbatim. |
| SC-M1-09 heavy build not co-scheduled | Weight accounting | AC-F5-1 | At most one heavy per runner is asserted; standard entries remain schedulable; no lane-count reduction. |
| SC-M1-10 close-first ranking | Rank classes, precedence | AC-F7-1, AC-F9-1 | Order and reasons are asserted; determinism is added. |
| SC-M1-11 park resumes exactly when its condition clears | Parks, incidents, findings | AC-F8-1 | Resume within one interval, the incident, and the stuck finding are asserted; the observation-gap distinction is added. |
| SC-M1-17 one-shot works daemon-down | Plan computation, claim | AC-F10-1, AC-F10-2 | `degraded=daemon-unreachable` at exit 0 and state consistency at reconciliation are asserted; the executor is the scheduling step, not `dispatch`. |
| SC-M1-17b daemon-down one-shots are mutually exclusive | Fence-claim, takeover | AC-F4-1, AC-F4-2 | One lease with heartbeat, exit-1 refusal with the holder named, stale takeover with evidence, and fail-closed unreadable state are asserted. |

### Appendix B — Precedence order (the ambiguity-deleting contract)

| Step | Rule | Kind | Outcome on failure |
|---:|---|---|---|
| 0 | Normalize: canonical ref, repository key, tier, weight class, close association, edges, park state | preparation | `unknown` evidence, never an invention |
| 1 | Entry observed and its plan valid | hard exclusion | `not-ready` with the delivered `plan.*` evidence |
| 2 | `deps-satisfied` (tracker relations ∪ declared edges; dependent merge also requires producer landing and, where declared, a `verified` deploy) | hard exclusion | `dependency-open`, `producer-not-landed`, or `deploy-unverified` |
| 3 | `no-owner-gate` | hard exclusion | `owner-gate` naming the labels |
| 4 | `tier-known` | hard exclusion | `tier-unknown` with its source |
| 5 | `ci-healthy` | hard exclusion | `ci-<reason>` (`failed`, `pending`, `canceled`, `none`, or the declared unknown reason) |
| 6 | `provider-available` | hard exclusion | `provider-<reason>` (`chain-parked`, `no-enabled-entry`, `all-entries-parked`, or the declared unknown reason) |
| 7 | Active park whose condition has not cleared | hard exclusion | `parked:<cause>` with the recheck interval |
| 8 | Repository lease held by another live holder | hard exclusion | `lease-held` with holder and lease identity |
| 9 | Heavy class while the runner already carries a heavy lease | hard exclusion | `weight-class` naming the carrying lease |
| 10 | Rank class | ordering | — (`merge-ready` < `in-review` < `resume-parked` < `new-start`) |
| 11 | Producer before consumer when both contend for one repository | ordering | — |
| 12 | Explicit priority ascending (declared default for undeclared) | ordering | — |
| 13 | Numeric ref suffix ascending, then canonical ref text | ordering | — |
| 14 | Preemption computation for close items blocked only by a new start's lease | action | emitted as a preemption action, never as a violation of single-flight |

Steps 1–9 remove; steps 10–13 order; step 14 only proposes a release. A hard exclusion never demotes; an ordering rule never admits.

### Appendix C — Command envelope data shapes (contract level)

- `queue list` → `entries[]` (ref, repository, state, rankClass, priority, weightClass, deps[], blocking[]), `leases[]` (repository, holder, scope, ref, runner, weightClass, heartbeatAgeMs, takeover), `weights` (runner, class, active), `parks[]` (ref, cause, condition, recheckMs, expiresAt, lastEvaluatedAt, clearedAt), `findings[]`, `degraded[]`, `truncated`.
- `queue plan [--next <n>]` → the same collections plus `nextActions[]` (ref, repository, rankClass, reason, priority, weightClass, lease, blocking[], preemption?).
- `queue add | prioritize | dep` → `ref`, `entry` (the folded projection), `edges[]`, `result` (`added`, `updated`, `noop`); a cycle refusal carries the error only.
- `queue claim [<ref>] [--holder <id>]` → `result` (`claimed`, `renewed`, `taken-over`), `lease` (identity, scope, repository, holder, ref, runner, weightClass, acquiredAt, heartbeatAt, ttlMs, takeoverOf?), `action`, `degraded[]`.
- `queue release <ref> [--holder <id>] [--park <cause>]` → `result` (`released`, `parked`, `noop`), `lease`, `park?`, `degraded[]`.
- `lanes list | show <ref>` → `lanes[]` (id = canonical ref, ref, state, reason, lease, leaseScope, restarts, amplification, amplificationWarning?, weightClass), `findings[]`, `degraded[]`, `truncated`.
- Exit projection: 0 computed, read, or mutation landed; 1 invocation rejection, dependency cycle, lease conflict, unmet precondition, stuck park, or unobserved entry; 2 platform, provider, or unverified state read. Text mode prints the bash-continuity key=value summary where defined (`result=`, `ref=`, `repo=`, `lease=`, `next=`, `degraded=`) before any human detail, and `result=refused` before the classified refusal on the negative-verdict paths.

### Appendix D — State record kinds and derived document

| Kind / document | Payload schema | Store-scoped key | Writer | Reader |
|---|---|---|---|---|
| `queue.entry` | `delivery.queue.entry.v1` | `queue.entries:<REF>` | any invocation (intent) | graph fold, `queue list|plan`, lanes |
| `queue.dependency` | `delivery.queue.dependency.v1` | `queue.deps:<REF>` | any invocation (intent) | graph fold, precedence, deploy gating |
| `queue.lease` | `delivery.queue.lease.v1` | `queue.leases:<repoKey>` | the process performing the claim/release (attributed) | claim exclusion, lane view, weight accounting |
| `queue.park` | `delivery.queue.park.v1` | `queue.parks:<REF>` | the process performing the evaluation (attributed) | resume evaluation, lane view, findings |
| `queue.incident` | `delivery.queue.incident.v1` | `queue.incidents:<REF>` / `queue.incidents:<repoKey>` | the process recording the incident (attributed) | diagnostics, evidence |
| Derived: queue graph | `delivery.queue.graph.v1` | derived document `queue-graph.json` | replaced atomically when intent truth changes | never truth; rebuilt from the ledger |

Every append is fenced; every append is verified after the fact; a wrong kind, malformed payload, duplicate acquisition for one holder, or a second active park for one entry is a classified `state.*` failure and never a fabricated value. No schema-version bump, migration, or backfill exists.

### Appendix E — Configuration keys (contract level)

| Key | Shape | Default | Semantics |
|---|---|---|---|
| `queue.lease-ttl` | integer milliseconds | `90000` | Lease staleness bound; heartbeat age at or beyond it makes the lease takeover-eligible. Renewal cadence is one third of the TTL (minimum one second), derived, not a separate key. A non-integer, zero, or negative value is `config.value.invalid`. |
| `queue.park-recheck.provider-window` | integer milliseconds | `60000` | Recheck cadence for provider window parks. |
| `queue.park-recheck.provider-quota` | integer milliseconds | `300000` | Recheck cadence for provider quota parks. |
| `queue.park-recheck.preemption` | integer milliseconds | `60000` | Recheck cadence for preemption parks. |

An absent `queue` branch resolves to these defaults with `defaults` origins. A `queue.park-recheck.<type>` naming a condition type outside the closed set is `config.key.unknown`; an invalid value is `config.value.invalid` naming the key; no invalid input silently falls back to a default. No capacity, bandwidth, concurrency, or CI-slot key exists, and none is reserved.

### Appendix F — Error identities

The `queue` domain kind carries exactly five rows. Every row is documented and machine-declared together, names a real reachable behaviour, and projects through the delivered `{0, 1, 2}` exit taxonomy.

| Code | Category | Retryable | Consequence | Projection | Triggers when |
|---|---|---|---|---|---|
| `queue.dependency-cycle` | user | false | `not_landed` | user-validation (1) | A `queue add --dep` or `queue dep` invocation would close a directed cycle; the existing path is named and nothing is appended |
| `queue.lease-conflict` | transient | true | `not_landed` | user-validation (1) | A claim or release targets a repository whose live lease is held by another holder; the holder, lease identity, heartbeat age, and earliest takeover-eligible time are named |
| `queue.park-condition-stuck` | platform | false | `not_landed` | user-validation (1) | A mutating pass cannot proceed because a park observed clear is still active after a recovery attempt, or because the recovery append was refused; read surfaces report the same identity as a report-only finding |
| `queue.entry.unobserved` | user | false | `not_landed` | user-validation (1) | A ref-taking subcommand names a ref that is not present in the queue graph |
| `queue.precondition.unmet` | user | false | `not_landed` | user-validation (1) | A claim targets an entry that is not ready, is outranked by a higher-ranked eligible action for its repository, or is held by its runner's weight cap; the blocking conditions or the outranking ref are named |

The `status` domain kind's delivered family `status.collector.<id>.unavailable` extends its closed collector-id set from `{tracker}` to `{tracker, lanes}`; the family shape, resolved row, and exit-2 projection are unchanged, and a family code naming an undeclared id remains unrecognized. No other domain kind changes, and `queue ready` gains no row.

### Appendix G — Ticket acceptance-criteria map

| Ticket AC | Spec ACs |
|---|---|
| Two lanes cannot deliver the same repo concurrently, including two daemon-down one-shots where the second refuses with lease-held evidence | AC-F3-1, AC-F4-1, AC-F4-2 |
| A heavy build is not scheduled onto a runner already carrying one | AC-F5-1 |
| A ready producer is scheduled before its consumer | AC-F6-1 |
| Close items rank above new starts | AC-F7-1, AC-F9-1 (with AC-F7-2 for the preemption path) |
| A park resumes exactly when its condition clears, per-interval, with auto-recovery and a recorded incident | AC-F8-1, AC-F8-2 |
| The queue operates end to end without the daemon (one-shot mode) | AC-F10-1, AC-F10-2 |

## 25. DOCUMENT HISTORY

| Version | Date | Author | Changes |
|---------|------|--------|---------|
| 1.0 | 2026-11-07 | spec-writer | Initial specification from ticket GH-237 (including the binding pinned decisions), the M1 pack (contracts, `queue`, `lanes`, test scenarios, architecture), the backlog entry and its rank-37 rationale, the parallel-delivery concept, the command registry, and the delivered feature specs for queue ready, plan schema, state layer, merge and verify deploy, session lifecycle economics, configuration layer, provider engine, and result contract |

---

## AUTHORING GUIDELINES

- **Sources**: ticket GH-237 (canonical tasks, ACs, and the binding pinned-decisions section), the PM clarify-scope output and `chg-GH-237-pm-notes.yaml`, `doc/planning/oss-tooling/backlog.md` §M1-S17 and `backlog-ranking.md` rank 37, `doc/planning/oss-tooling/milestones/m1/contracts.md` (shared envelope/exit/refusal pins and timing defaults), `m1/commands/queue.md`, `m1/commands/lanes.md`, `m1/test-scenarios.md` (SC-M1-08/09/10/11/17/17b), `m1/architecture.md` (state-mediated truth, writer ownership, queue/lanes/parks placement), `doc/planning/concepts/parallel-delivery.md` (lease scope, single-flight as policy), `doc/planning/oss-tooling/cli-command-registry.md`, and the delivered specs for queue ready, plan schema, state layer, merge and verify deploy, session lifecycle economics, configuration layer, provider engine, and result contract.
- **Pinned decisions were carried, not re-derived.** DEC-1..DEC-4 reproduce the ticket's binding decisions verbatim in intent; DEC-5..DEC-10 record spec-level choices that resolve genuine gaps (scheduler-owned readiness sources, the one-shot surface, `--watch` omission, lane identity, precedence, weight mapping).
- **Ambiguities were deleted rather than described.** Appendix B is the single authoritative precedence order: hard exclusions remove, ordering rules order, and the two never trade places. The "parked ranks above new starts" pin is made coherent by scoping it to resumable parks, since an uncleared park is not a candidate at all.
- **No invention beyond named gaps.** Where the ticket, the pack, and the delivered specs did not decide something (queue discovery, preemption authority, weight vocabulary ownership, the post-M1-S9 claim surface), it is an open question rather than a silent choice.
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
