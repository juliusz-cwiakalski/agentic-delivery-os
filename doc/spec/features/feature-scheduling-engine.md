---
ados_distribution: internal
id: SPEC-SCHEDULING-ENGINE
status: Current
created: 2026-11-07
last_updated: 2026-11-08
owners: ["engineering"]
service: delivery-os
summary: "The daemon-free scheduling engine: one fenced, replay-idempotent queue graph; readiness re-derived on the delivered six-condition model with scheduler sources; repo-exclusive leases with a fence-token claim, renewal, release, and evidenced stale takeover; build weight as a per-runner resource class; producer-before-consumer batching with a producer-bound deploy-verified gate; a declared total precedence in which closing beats opening; parks with per-type recheck, a durable clear-observed marker, recovery incidents, and the classified stuck finding; the queue and lanes command surfaces with bounded payloads, closed vocabularies, truthful daemon-down degradation, and truthful read-surface exits; and the additive record kinds, error rows, collector ids, and typed configuration branch, all synchronized in-change; the typed dispatch engine claims and releases the same repository lease for one-shot execution."
links:
  related_changes: ["GH-237", "GH-176", "GH-222", "GH-225", "GH-226", "GH-235", "GH-182", "GH-240", "GH-238", "GH-242", "GH-239", "GH-273"]
  related_decisions: ["ADR-0003", "TDR-0005", "ODR-0003"]
  contracts:
    - "packages/core/src/contracts/queue.ts"
    - "packages/core/src/contracts/queue-ready.ts"
    - "packages/core/src/contracts/state.ts"
---

# Feature: Scheduling Engine

## Overview

The scheduling engine computes what a delivery queue should do next from durable
artifacts instead of coordinator memory. It answers four questions in one pass:
which entries are ready, which repository may take a delivery, which build weight
a runner can carry, and which close item outranks a new start. It is one-shot by
design: every invocation computes from state, and mutual exclusion is enforced by
the state layer's fence rather than by a resident process.

The engine is delivered by GH-237 (M1-S17). It reuses the delivered queue-ready
condition model, the state layer's fence-token single writer, the plan schema's
tier and weight declarations, the merge/verify-deploy verdict, the session
lifecycle economics fold, and the result envelope. It adds five record kinds and
one derived document additively inside `delivery.state.v1`, five `queue` error
identities, one collector id, and one typed `queue` configuration branch.

The coordinator's iteration consumes `queue plan --next N` for its next pick and
reads the returned `nextActions` with their reasons, weight, and lease rather
than discovering work by hand.

## Capability summary

- **One durable queue graph.** `queue add`, `queue prioritize`, and `queue dep`
  append fenced intent records; an identical replay appends nothing; a
  cycle-creating edge is refused with `queue.dependency-cycle` and the existing
  path named before any append; a superseding entry replaces the prior
  projection by identity. The derived `queue-graph.json` document is a cache
  rebuilt from the ledger and never serves as truth.
- **Artifact-computed readiness.** The six delivered condition ids, order,
  tri-state, and evidence vocabulary are reused verbatim. `deps-satisfied`
  consumes the union of tracker `blocked-by` relations and declared edges (a
  declared edge can only make it stricter), `repo-free` consumes active-lease
  truth, and `tier-known` prefers the validated plan tier and falls back to the
  triage-label proxy only when no plan artifact exists. Every failed,
  unavailable, unattempted, or unresolved source yields `unknown`.
- **Per-repository single-flight.** `repo-exclusive` is the only implemented
  lease scope; `worktree` is declared and never acquired. The claim has two
  stages: the pre-fence gate evaluates parks and the five non-exclusivity
  readiness conditions, and the in-fence verified lease read owns the
  exclusivity outcome, so a live holder is always a lease conflict and never a
  precondition refusal. A live lease held by another holder refuses
  `queue.lease-conflict`; a stale lease — heartbeat age at or beyond the TTL,
  the bound is inclusive — is taken over with previous-holder, lease,
  heartbeat-age, last-heartbeat, and takeover evidence plus a
  `lease-stale-takeover` incident; a same-holder repeat claim renews the lease
  identity rather than appending a second acquisition. The lease identity is
  the normalized repository key; the fence is held only for one write and its
  staleness window is a distinct mechanism from the lease TTL. No capacity,
  bandwidth, concurrency-budget, or CI-slot key or path exists.
- **Release and park under one fence.** `queue release <ref> [--holder <id>]
  [--park <cause>] [--until <iso>]` releases the recorded holder's lease;
  releasing when no lease exists is an explicit idempotent `noop`, and releasing
  another holder's live lease refuses `queue.lease-conflict`. When a park cause
  is named, the park record is appended first and the lease release second,
  both under one fenced handle. A failed park append lands nothing; a failed
  lease-release append withdraws the already-appended park with a compensating
  `queue.park` record whose `recoveryState` is `released`, so the fold observes
  no active park while the lease remains held, and the call returns the
  classified state failure. A successful release+park leaves both records
  durable; on a failed lease release the compensating record keeps the park out
  of the active fold. An unknown cause is an
  invocation rejection at exit 1 that appends nothing.
- **Weight as a resource class.** A validated plan that omits `weightClass`
  resolves to `standard`; a declared-but-unrecognized value resolves to `heavy`;
  an invalid, unreadable, or absent plan resolves to `heavy` with named source
  evidence. At most one heavy lease is active per runner; standard entries keep
  scheduling, so weight never reduces the active repository count.
- **Producer-before-consumer with a deploy gate.** A consumer is not eligible
  while its producer is unresolved, and a dependent merge action additionally
  requires the producer's landing. When the producer repository's own
  configuration declares `merge.deploy-expectations`, the merge action requires
  a `verified` deploy verdict; unknown, failed, unreadable, or an exhausted
  three-read budget holds the dependent at `deploy-unverified`, never green. A
  producer with no declared expectation passes on landing with
  `deploy: not-declared` evidence, so the weaker guarantee stays visible.
  Expectations resolve from the producer repository's own configuration bound to
  its recorded key through the entry-recorded root whose normalized remote
  matches that key exactly; the invocation checkout's root is never substituted.
  No matching recorded root, a two-root collision, or an unreadable or invalid
  config is `unknown`, never `not-declared` or `verified`.
  Reads are memoized per producer within a pass.
- **Closing beats opening.** Rank classes are `merge-ready`, `in-review`,
  `resume-parked`, `new-start` in that order. A stuck park is excluded before
  rank assignment: it is never `resume-parked`, never in `nextActions`, and never
  selected by a no-ref claim. When a close item is blocked only by a new start's
  lease, the pass emits a preemption proposal naming park cause
  `preempted-for-close-item` and the holder; single-flight holds until the
  explicit `queue release --park`.
- **Parks with exact resume.** Condition types are `provider-window`,
  `provider-quota`, and `preemption`; causes are `provider-window`,
  `provider-quota`, and `preempted-for-close-item`, paired one-to-one. A window
  clears at its absolute expiry, quota clears when the provider is observed
  available, and preemption clears when the repository is observed with no held
  lease and the entry is ready again. An active park is re-evaluated only once
  the recheck interval recorded on that park has elapsed since the last
  evaluation; the interval is resolved from
  `queue.park-recheck.<condition-type>` when the park is created. A not-yet-due
  park stays active with its interval and last evaluation, so tuning the key
  changes resume timing for parks created afterwards with no code change. A
  mutating pass that observes a clear condition appends the durable
  `clear-observed` marker first, then the `recovered` record and a
  `park-auto-recovery` incident naming the condition, clear time, evaluation
  time, and observation gap. A marker without a later
  `recovered` record is the stuck class: a report-only finding on reads at exit 0
  and a `queue.park-condition-stuck` refusal on a claim at exit 1. A park that was
  simply not evaluated while no process ran carries no marker, is never stuck on
  the first pass after the gap, and recovers with an incident naming the gap.
  `queue release --park provider-window --until <iso>` records the supplied
  absolute window expiry; `--until` is required for that cause and refused for
  the other park causes through `fallback.invocation`. An absent `--until`, or
  an `--until` paired with another cause, is refused and appends nothing.
- **One declared total order.** Hard exclusions (readiness, dependency/deploy,
  parks, single-flight, weight) remove candidates; ordering applies rank class,
  then producer-before-consumer within one repository, then explicit priority
  ascending, then numeric ref suffix, then canonical ref text compared by
  Unicode code point with no ambient locale dependence. Step 13b projects at
  most one action per repository per pass and holds the remainder
  `repo-claimed-in-pass`; a later pass re-evaluates them. Candidate selection
  uses the cheap rank, priority, and ref facts for the whole entry set and
  performs the expensive readiness, deploy, and provider reads for at most the
  first 32 ordered candidates; the remainder are held `not-ready` with the
  `evaluated-candidates-truncated` detail and `truncated` is set.
- **Bounded, truthful surfaces.** `queue ready|list|plan|add|prioritize|dep|claim|release`
  return the Appendix C envelopes; `lanes list` and `lanes show <ref>` return
  the bounded lane view. `queue ready` keeps the delivered ready-only grammar
  and byte output, accepting one to eight candidate refs through the
  full-family definition. `queue add` accepts one `--dep` edge per call;
  `queue plan` takes `--next <n>` (default 3, maximum 20); `queue prioritize`
  and `queue dep` take two positionals; `queue claim` takes an optional ref and
  `--holder` (default `local`). Every queue and lanes payload carries a
  `degraded[]` marker: a surface with no reachable daemon reports
  `daemon-unreachable`, the marker is absent when the daemon is reachable, and
  the payload is a complete one-shot result at exit 0 either way.
  `queue list|plan` and `lanes list|show`
  exit 2 with the classified `state.*` or
  `status.collector.lanes.unavailable` identity when lease, park, or entry
  history is unreadable, torn, or of unknown kind, presenting no success verdict
  and no partial or empty view as a schedule. A report-only stuck-park finding
  never fails a read. `--watch` is accepted on `queue` and `lanes`: with a
  reachable daemon the invocation subscribes to the closed `queue` or `lanes`
  topic and prints a bounded initial snapshot followed by deduplicated bounded
  event frames; with no reachable daemon it enters declared degraded polling at
  `daemon.watch-poll-interval`, names `daemon-unreachable`, prints only changed
  snapshots, and exits 0 on interruption. Unreadable state exits 2 with the
  delivered `state.*` identity instead of polling a lie.
- **One lane fold.** `lanes list|show` projects the same schedule: identity is
  the canonical work-item ref, and no lane record kind or stored lane state
  exists. The closed state set is `delivering`, `idle-with-reason`, `parked`,
  `merge-ready`, `in-review`, `failed`; an idle lane always carries a declared
  reason token, and a parked lane carries `parked:<cause>` over the closed cause
  set. A ready unleased lane carries `new-start`, or `resume-parked` when its
  rank class is `resume-parked`; a not-ready lane carries its first declared
  blocking reason. A lane carries its lease identity and scope when held, its
  weight class, and the delivered economics fold's restart count and
  amplification, which are `null` with an `economics-underivable` warning
  rather than a fabricated zero.
  `failed` is reserved for a delivery past its restart budget and carries
  `restart-budget-exhausted`. The fold is capped at 200 lanes and sets
  `truncated` on any drop; `lanes show <ref>` selects one lane or refuses
  `queue.entry.unobserved` at exit 1.
- **Dispatch consumption.** The typed dispatch engine claims and releases the
  same repository-exclusive lease for one-shot execution. A live conflicting
  lease at dispatch start is a clean pre-session refusal at exit `1`; after a
  completed or aborted run the lease is released through the same path. A
  one-shot `dispatch <ref>` reads and writes scheduling state with no daemon,
  control socket, or background process, so dispatch keeps working daemon-down.
- **Additive vocabulary.** Five record kinds (`queue.entry`, `queue.dependency`,
  `queue.lease`, `queue.park`, `queue.incident`) plus the derived
  `delivery.queue.graph.v1` document; five `queue` rows; the collector-id set
  extended from `{tracker}` to `{tracker, lanes}`; and the typed `queue` branch
  with `queue.lease-ttl` and `queue.park-recheck.<condition-type>`. No schema
  version bump, migration, backfill, or compatibility path exists.

## Owner hold

An owner hold is a global read-only gate, never a park. The scheduling facts gain
one optional injected fact resolved at the CLI/MCP edge from the brand-derived
`<PREFIX>_OWNER_HOLD` environment value, the fixed production store directory
`<home>/<stateDirectoryName>`, and its `owner-hold` marker. Environment wins when
active; a marker that exists but cannot be read, is not regular, or cannot be
stat'd is active without a reason (fail closed); only a non-existent path is
inactive. The reason is one control-free line bounded to 160 characters.

While the fact is active, one pass emits no next action and no preemption
proposal. A `ready` entry becomes `held`; `held` and `not-ready` entries keep
their state; active parks keep `parked:<cause>` and stuck parks keep
`park-condition-stuck`; a park whose window passed while recovery was skipped
becomes `held`. `owner-hold` is always the first blocking reason, and each
entry's own ordered reasons follow unchanged. The `queue list`/`queue plan`
payloads carry the additive optional `ownerHold` member (source and optional
reason) only while active; `lanes` renders exactly one reason, so a held entry
shows `owner-hold` and masks the more specific reason — `queue list` remains the
full-reason surface. `queue ready` is unchanged and carries no hold.

`queue claim` refuses `queue.precondition.unmet` with the blocking-reason token
exactly `owner-hold` and a separate bounded detail naming the source and reason.
The composition evaluates the hold **before ref selection**, so `queue claim`
with no ref also refuses `owner-hold` and never returns `no-eligible-action`.
The fenced claim refuses before acquiring the fence. Dispatch resolves the same
fact before claiming and refuses with the existing identity and a bounded
summary; this is a classified user-validation refusal at exit 1, not an
internal wait. The mutating park-recovery pass is not invoked while held, so no
`clear-observed` marker, `recovered` record, or `park-auto-recovery` incident is
appended; removal mutates nothing and the delivered selection, claim, recovery,
and resume paths run against the state captured at hold entry. `queue add`,
`queue prioritize`, `queue dep`, and `queue release` remain available operator
bookkeeping.

Explicit denials: the hold adds **no** park cause, park condition type, recovery
state, state record kind, or seventh queue-ready condition. It adds exactly one
lane/blocking reason, `owner-hold`, pinned by exact two-way ordered equality
against the closed-set fixture. The production resident daemon entry is not a
claim source today; a composed supervision cycle whose next-action seam derives
from the held pass receives no action, and the resident-daemon residual is
unchanged.

## Command surfaces

| Invocation | Payload `data` | Result vocabulary |
|---|---|---|
| `queue ready <ref>...` | The delivered `delivery.queue-ready.v1` payload, unchanged | — |
| `queue list` | `schemaVersion: delivery.queue.v1`, `entries[]`, `leases[]`, `weights[]`, `parks[]`, `findings[]`, `degraded[]`, `truncated`, `counts` | — |
| `queue plan [--next <n>]` | The `queue list` collections plus `nextActions[]` | — |
| `queue add <ref> [--priority <n>] [--dep <ref>]` | `ref`, `entry`, `edges[]`, `result`, `degraded[]` | `added`, `updated`, `noop` |
| `queue prioritize <ref> <n>` | `ref`, `entry`, `edges[]`, `result`, `degraded[]` | `added`, `updated`, `noop` |
| `queue dep <ref> <on-ref>` | `ref`, `entry`, `edges[]`, `result`, `degraded[]` | `added`, `updated`, `noop` |
| `queue claim [<ref>] [--holder <id>]` | `result`, `selectedRef`, `lease`, `action`, `degraded[]` | `claimed`, `renewed`, `taken-over` |
| `queue release <ref> [--holder <id>] [--park <cause>] [--until <iso>]` | `result`, optional `lease`, optional `park`, `degraded[]` | `released`, `parked`, `noop` |
| `lanes list` | `schemaVersion: delivery.lanes.v1`, `lanes[]`, `findings[]`, `degraded[]`, `truncated`, `counts` | — |
| `lanes show <ref>` | The same payload narrowed to one lane | — |

An entry projection carries `ref`, optional `repository`, `state`
(`ready`, `held`, `parked`, `stuck`, `not-ready`), `rankClass`, `priority`,
`weightClass`, `weightClassSource`, `deps[]`, and `blocking[]`. A next action
adds `reason`, `lease`, optional `deploy` evidence, and optional `preemption`
(`targetRef`, `repository`, `holder`, `parkCause`, `conditionType`,
`closeRef`). A mutation envelope projects the entry's current computed state,
rank class, weight class, and weight-source provenance from a fresh pass; an
entry declared with an unresolved repository binding is `not-ready` with its
binding reason, never a fabricated `ready`. Every blocking reason is drawn from
the closed reason vocabulary or is a `parked:<cause>` template. Human mode
prints a bounded deterministic summary and one line per entry, action, or lane.

## Exit projection

| Condition | Exit |
|---|---|
| A read, a landed mutation, an observed-empty queue, or a report-only stuck-park finding | 0 |
| An invocation rejection (such as an unknown park cause), a dependency cycle, a lease conflict, an unmet claim precondition, a stuck-park claim refusal, or an unobserved entry | 1 |
| A platform or state read failure, including `list`, `plan`, `claim`, `release`, and `lanes` over unreadable, torn, or unknown-kind history | 2 |

A refused mutation lands nothing and its consequence stays `not_landed`. A
successful mutation is durable even when `degraded: ["daemon-unreachable"]` is
reported.

## Bounds

| Bound | Value | Applies to |
|---|---|---|
| Entries per folded read | 500 | `queue list`, `queue plan`, the lane fold |
| Edges per entry | 32 | Declaration and the folded graph |
| `nextActions` cap (`--next`) | 20, default 3 | `queue plan`, claim selection |
| Ordered candidates with expensive reads | 32 | Every pass |
| Deploy verdict reads | 3, memoized per producer | Every pass |
| Lanes per payload | 200 | `lanes list`, `lanes show` |
| Findings per payload | 20 | Every pass |
| Reasons per entry or action | 8 | Every projection |
| Serialized machine `data` | 65536 UTF-8 bytes | `queue list`, `queue plan` |
| Human output | 40 lines, 8192 bytes | Every queue and lanes surface |
| Canonical ref length | 64 characters | Every ref position (`GH-010` and `GH-10` are one identity) |

A bound reached sets `truncated` and never silently drops the last row; a cut
caused by the serialized byte cap also sets `truncationReason:
"machine-byte-cap"`, a lane-cap or findings cut sets `truncationReason:
"lane-cap"` on the lanes payload, and the human renderer appends `+more`.

## Known limits

- `queue add` takes one `--dep` edge per call; a repeatable flag is not in the
  grammar, so a second edge needs a second `queue dep` invocation.
- `queue release --park provider-window` requires an explicit `--until <iso>`
  window expiry. A provider-engine-generated window is expected from the
  provider engine's own park records.
- Deploy gating resolves from facts injected at the CLI edge: the caller
  supplies the plan, work-item, CI, provider, close, and deploy facts, and the
  shipped edge reads the producer repository's configuration and the delivered
  deploy verdict through those seams. Producer expectations are resolved through
  an injected producer-root port from entry-recorded roots only; the invocation
  checkout's configuration is never used for a producer. When no producer-root
  port is supplied, the caller's pre-resolved expectations are consumed
  unchanged.
- **Production composition.** The resident daemon
  ([Resident Dispatch Daemon](feature-resident-daemon.md)) is the production
  composition root for this engine: it claims leases, supervises lanes, and
  reconciles queue state from durable records. The typed dispatch engine
  ([Dispatch Engine](feature-dispatch-engine.md)) is the other consumer: it
  claims and releases one repository lease per one-shot delivery and reads the
  same state with no daemon. A standalone one-shot invocation is composed through
  the same injected scheduling seams, so the engine and its surfaces remain
  testable without an installed binary. The family is registered only when a
  queue composition is supplied.

## Configuration

| Key | Shape | Default | Semantics |
|---|---|---|---|
| `queue.lease-ttl` | integer milliseconds | `90000` | Heartbeat age at or beyond it makes a lease takeover-eligible. Renewal cadence is one third of the TTL (minimum one second), derived rather than a key. |
| `queue.park-recheck.provider-window` | integer milliseconds | `60000` | Due cadence for re-evaluating provider-window parks. |
| `queue.park-recheck.provider-quota` | integer milliseconds | `300000` | Due cadence for re-evaluating provider-quota parks. |
| `queue.park-recheck.preemption` | integer milliseconds | `60000` | Due cadence for re-evaluating preemption parks. |

An absent branch resolves to the defaults with `defaults` origins. A
`park-recheck` child outside the closed condition-type set is
`config.key.unknown`; a non-integer, zero, or negative value is
`config.value.invalid`, both naming the key, and no invalid input silently falls
back. The condition-type set is `{provider-window, provider-quota, preemption}`,
never the cause set. Renewal cadence is derived from `queue.lease-ttl` as
`max(1000 ms, floor(ttl / 3))` and is not a key. Deploy expectations are not a
`queue` key; they are the delivered `merge.deploy-expectations` resolved from the
producer repository's own configuration. No capacity, bandwidth, concurrency, or
CI-slot key exists or is reserved.

## State records

| Kind / document | Payload schema | Store-scoped key | Writer | Reader |
|---|---|---|---|---|
| `queue.entry` | `delivery.queue.entry.v1` | `queue.entries:<REF>` | `queue add`, `queue prioritize` | Graph fold, precedence, claim |
| `queue.dependency` | `delivery.queue.dependency.v1` | `queue.deps:<REF>` | `queue add --dep`, `queue dep` | Graph fold, readiness, deploy gating |
| `queue.lease` | `delivery.queue.lease.v1` | `queue.leases:<repoKey>` | `queue claim`, `queue release`, stale takeover | Readiness `repo-free`, claim, lane fold |
| `queue.park` | `delivery.queue.park.v1` | `queue.parks:<REF>` | `queue release --park` (including its compensating withdrawal), park recovery | Park pass, precedence, lane fold |
| `queue.incident` | `delivery.queue.incident.v1` | `queue.incidents:<REF or repoKey>` | Stale takeover, park auto-recovery | Incidents are read as history evidence |
| Derived: queue graph | `delivery.queue.graph.v1` | derived document `queue-graph.json` | Intent mutations under the fence | Diagnostics and tests only; never truth |

Payload fields are closed and validated at the ledger boundary:

- `queue.entry` — `schema`, `ref`, optional `repository`, optional
  `repositoryRoot` (present only together with `repository`), `priority`,
  `recordedAt`.
- `queue.dependency` — `schema`, `ref`, `edges[]` (canonical, deduplicated,
  sorted, at most 32), `recordedAt`.
- `queue.lease` — `schema`, `leaseId`, `scope`, `repository`, `holder`, `ref`,
  `runner`, `weightClass`, `operation` (`acquired`, `renewed`, `released`,
  `taken-over`), `acquiredAt`, `heartbeatAt`, `ttlMs`, `recordedAt`, optional
  `takeover` (`previousHolder`, `leaseId`, `heartbeatAgeMs`, `lastHeartbeatAt`,
  `takenOverAt`).
- `queue.park` — `schema`, `ref`, optional `repository`, `cause`,
  `conditionType`, typed `condition` (`provider-window` carries `expiresAt`;
  `provider-quota` and `preemption` carry no expiry), `recheckMs`,
  `evaluatedAt`, optional `clearObservedAt`, `clearedAt`, `recoveredAt`,
  `observationGapMs`, `recoveryState` (`parked`, `clear-observed`, `recovered`,
  `released`; `released` is the withdrawn-park marker written when the
  release+park path appends the park and the lease-release append then fails, so
  the fold observes no active park while the lease remains held), `recordedAt`.
- `queue.incident` — `schema`, `type` (`park-auto-recovery`,
  `lease-stale-takeover`), optional `ref`, optional `repository`, non-empty
  bounded `evidence[]` of `{key, value}` pairs, `recordedAt`.

Latest record per identity wins; an identical replay appends nothing. A wrong
kind, malformed payload, duplicate acquisition, schema-incompatible record, or
two concurrently active `parked` records for one ref under a queue prefix is a
classified `state.*` failure, never a fabricated entry, holder, park, or zero.

The entry record carries the normalized repository key and the declaring
checkout's absolute repository root together. The root is internal state used
only for producer deploy-expectation discovery; it is never serialized into an
envelope, finding, incident, golden, log line, or telemetry event, and read
surfaces render the normalized key alone. The derived graph folds no root.

### Capsule and collector boundary

Queue and lane scheduling state is the additive state-layer record families in
this section plus the derived `queue-graph.json` document. It is **not** capsule
evidence: the change capsule's `events.jsonl` carries phase, commit, gate,
review, closeout, and capsule-lifecycle events only, and a queue or lane
mutation never appends a capsule event or copies queue state into one. The
`status.collector.*` family ships exactly two declared collector ids, `tracker`
and `lanes`; `lanes` names the queue/lane read surface.

## Error identities

| Code | Category | Retryable | Consequence | Projection |
|---|---|---|---|---|
| `queue.dependency-cycle` | user | false | `not_landed` | user-validation (1) |
| `queue.lease-conflict` | transient | true | `not_landed` | user-validation (1) |
| `queue.park-condition-stuck` | platform | false | `not_landed` | user-validation (1) |
| `queue.entry.unobserved` | user | false | `not_landed` | user-validation (1) |
| `queue.precondition.unmet` | user | false | `not_landed` | user-validation (1) |

An unreadable or torn lease or park history reuses the delivered `state.*`
identity at exit 2; an unreadable queue store on the lane surfaces reuses
`status.collector.lanes.unavailable` at exit 2; an invocation rejection such as
an unknown park cause reuses `fallback.invocation` at exit 1. `queue ready`
gains no row.

## Honest boundaries

The engine is a stateless scheduling computation over durable state. The
resident daemon
([Resident Dispatch Daemon](feature-resident-daemon.md)) is its production
composition root and consumes the delivered readiness, lease, park, rank, and
weight contracts, applying preemption only at a safe boundary and streaming
bounded `queue` and `lanes` watch frames. The engine does **not** ship session spawn, harness selection, resume handling,
or handover. The dispatch engine ([Dispatch Engine](feature-dispatch-engine.md))
composes the claim/release capability and drives one-shot deliveries; the resident
daemon composes it for supervised lanes. The engine performs no
tracker, VCS, or CI write, no merge execution, no gate evaluation, no
worktree-scoped lease, no capacity or bandwidth policy, and no fleet or
multi-host coordination.

The status digest's `lanes-or-queue` section is not wired to this engine: the
digest still emits its declared `not-delivered` gap with the code-owned
capability, story, and note literals. The engine, the `queue` family, and the
`lanes` view ship and are documented here; the digest section and its literal
pointers remain a declared gap of the digest, not of this engine.

## Neighbours

- [Queue Ready](feature-queue-ready.md) — the delivered read-only ready set; its
  six conditions, order, tri-state, evidence vocabulary, ranking, caps, and
  `queue ready` byte output are unchanged.
- [State Layer](feature-state-layer.md) — the five additive record kinds and the
  derived graph document join `delivery.state.v1` with no schema bump.
- [Configuration Layer and Inspection](feature-config-layer.md) — the typed
  `queue` branch and its defaults.
- [Plan Schema](feature-plan-schema.md) — tier, weight class, and declared
  interactions are consumed as intent evidence.
- [Merge and Verify Deploy](feature-merge-verify-deploy.md) — the deploy verdict
  and `merge.deploy-expectations` are read producer-bound.
- [Session Lifecycle Economics](feature-session-lifecycle-economics.md) — the
  lane view consumes restart counts and the amplification signal.
- [Dispatch Engine](feature-dispatch-engine.md) — the one-shot consumer of the
  repository lease and the factory-proven daemon lane seam.
- [Result Contract and Error Table](feature-result-contract.md) — the five queue
  rows and the lanes collector row.
- [Status Digest](feature-status-digest.md) — the `lanes-or-queue` section and
  why it remains a declared gap of the digest collector.
