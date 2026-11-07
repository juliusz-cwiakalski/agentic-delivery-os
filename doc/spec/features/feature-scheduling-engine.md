---
ados_distribution: internal
id: SPEC-SCHEDULING-ENGINE
status: Current
created: 2026-11-07
last_updated: 2026-11-07
owners: ["engineering"]
service: delivery-os
summary: "The daemon-free scheduling engine: one fenced, replay-idempotent queue graph; readiness re-derived on the delivered six-condition model with scheduler sources; repo-exclusive leases with a fence-token claim, renewal, release, and evidenced stale takeover; build weight as a per-runner resource class; producer-before-consumer batching with a producer-bound deploy-verified gate; a declared total precedence in which closing beats opening; parks with per-type recheck, a durable clear-observed marker, recovery incidents, and the classified stuck finding; the queue and lanes command surfaces with bounded payloads, closed vocabularies, truthful daemon-down degradation, and truthful read-surface exits; and the additive record kinds, error rows, collector id, and typed configuration branch, all synchronized in-change."
links:
  related_changes: ["GH-237", "GH-176", "GH-222", "GH-225", "GH-226", "GH-235", "GH-182"]
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
- **Release and park in one transaction.** `queue release <ref>
  [--holder <id>] [--park <cause>]` releases the recorded holder's lease;
  releasing when no lease exists is an explicit idempotent `noop`, and releasing
  another holder's live lease refuses `queue.lease-conflict`. When a park cause
  is named, the release record and the park record append inside one fenced
  transaction: both land or neither does. An unknown cause is an invocation
  rejection at exit 1 that appends nothing.
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
  its recorded key through the recorded root whose normalized remote matches
  exactly; no matching recorded root, a two-root collision, or an
  unreadable/invalid config is `unknown`, never `not-declared` or `verified`.
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
  lease and the entry is ready again. A mutating pass that observes a clear
  condition appends the durable `clear-observed` marker first, then the
  `recovered` record and a `park-auto-recovery` incident naming the condition,
  clear time, evaluation time, and observation gap. A marker without a later
  `recovered` record is the stuck class: a report-only finding on reads at exit 0
  and a `queue.park-condition-stuck` refusal on a claim at exit 1. A park that was
  simply not evaluated while no process ran carries no marker, is never stuck on
  the first pass after the gap, and recovers with an incident naming the gap.
  The `--park` grammar carries the cause only: a `provider-window` park records
  the release instant as its absolute expiry, so it is clear at its next
  evaluation, and the command has no way to declare a future window.
- **One declared total order.** Hard exclusions (readiness, dependency/deploy,
  parks, single-flight, weight) remove candidates; ordering applies rank class,
  then producer-before-consumer within one repository, then explicit priority
  ascending, then numeric ref suffix, then canonical ref text. Step 13b projects
  at most one action per repository per pass and holds the remainder
  `repo-claimed-in-pass`; a later pass re-evaluates them. Candidate selection
  uses the cheap rank, priority, and ref facts for the whole entry set and
  performs the expensive readiness, deploy, and provider reads for at most the
  first 32 ordered candidates; the remainder are held `not-ready` with the
  `evaluated-candidates-truncated` detail and `truncated` is set.
- **Bounded, truthful surfaces.** `queue ready|list|plan|add|prioritize|dep|claim|release`
  return the Appendix C envelopes; `lanes list` and `lanes show <ref>` return
  the bounded lane view. `queue add` accepts one `--dep` edge per call;
  `queue plan` takes `--next <n>` (default 3, maximum 20); `queue prioritize`
  and `queue dep` take two positionals; `queue claim` takes an optional ref and
  `--holder` (default `local`). Every queue and lanes payload carries a
  `degraded[]` marker: the shipped composition reports `daemon-unreachable`
  because this release has no resident daemon, and the payload is still a
  complete one-shot result at exit 0. `queue list|plan` and `lanes list|show`
  exit 2 with the classified `state.*` or
  `status.collector.lanes.unavailable` identity when lease, park, or entry
  history is unreadable, torn, or of unknown kind, presenting no success verdict
  and no partial or empty view as a schedule. A report-only stuck-park finding
  never fails a read. `--watch` is not in the accepted grammar of any queue or
  lanes subcommand and is refused through `fallback.invocation` at exit 1 with
  no stream representable.
- **One lane fold.** `lanes list|show` projects the same schedule: identity is
  the canonical work-item ref, and no lane record kind or stored lane state
  exists. The closed state set is `delivering`, `idle-with-reason`, `parked`,
  `merge-ready`, `in-review`, `failed`; an idle lane always carries a declared
  reason token, and a parked lane carries `parked:<cause>` over the closed cause
  set. A lane carries its lease identity and scope when held, its weight class,
  and the delivered economics fold's restart count and amplification, which are
  `null` with an `economics-underivable` warning rather than a fabricated zero.
  `failed` is reserved for a delivery past its restart budget and carries
  `restart-budget-exhausted`. The fold is capped at 200 lanes and sets
  `truncated` on any drop; `lanes show <ref>` selects one lane or refuses
  `queue.entry.unobserved` at exit 1.
- **Additive vocabulary.** Five record kinds (`queue.entry`, `queue.dependency`,
  `queue.lease`, `queue.park`, `queue.incident`) plus the derived
  `delivery.queue.graph.v1` document; five `queue` rows; the collector-id set
  extended from `{tracker}` to `{tracker, lanes}`; and the typed `queue` branch
  with `queue.lease-ttl` and `queue.park-recheck.<condition-type>`. No schema
  version bump, migration, backfill, or compatibility path exists.

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
| `queue release <ref> [--holder <id>] [--park <cause>]` | `result`, optional `lease`, optional `park`, `degraded[]` | `released`, `parked`, `noop` |
| `lanes list` | `schemaVersion: delivery.lanes.v1`, `lanes[]`, `findings[]`, `degraded[]`, `truncated`, `counts` | — |
| `lanes show <ref>` | The same payload narrowed to one lane | — |

An entry projection carries `ref`, optional `repository`, `state`
(`ready`, `held`, `parked`, `stuck`, `not-ready`), `rankClass`, `priority`,
`weightClass`, `weightClassSource`, `deps[]`, and `blocking[]`. A next action
adds `reason`, `lease`, optional `deploy` evidence, and optional `preemption`
(`targetRef`, `repository`, `holder`, `parkCause`, `conditionType`,
`closeRef`). Every blocking reason is drawn from the closed reason vocabulary or
is a `parked:<cause>` template. Human mode prints a bounded deterministic
summary and one line per entry, action, or lane.

## Exit projection

| Condition | Exit |
|---|---|
| A read, a landed mutation, an observed-empty queue, or a report-only stuck-park finding | 0 |
| An invocation rejection (including `--watch` and an unknown park cause), a dependency cycle, a lease conflict, an unmet claim precondition, a stuck-park claim refusal, or an unobserved entry | 1 |
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
| Human output | 40 lines, 8192 bytes | Every queue and lanes surface |
| Canonical ref length | 64 characters | Every ref position (`GH-010` and `GH-10` are one identity) |

A bound reached sets `truncated` and never silently drops the last row; the
human renderer appends `+more`.

## Known limits

- `queue add` takes one `--dep` edge per call; a repeatable flag is not in the
  grammar, so a second edge needs a second `queue dep` invocation.
- `queue release --park provider-window` cannot declare a future expiry; the
  recorded window ends at the release instant. A real provider window is
  expected from the provider engine's own park records.
- Deploy gating resolves from facts injected at the CLI edge: the caller
  supplies the plan, work-item, CI, provider, close, and deploy facts, and the
  shipped edge reads the producer repository's configuration and the delivered
  deploy verdict through those seams. No production composition root assembles
  the scheduling fact set yet; the family is registered only when a queue
  composition is supplied, which keeps the engine and its surfaces testable
  without an installed binary.

## Configuration

| Key | Shape | Default | Semantics |
|---|---|---|---|
| `queue.lease-ttl` | integer milliseconds | `90000` | Heartbeat age at or beyond it makes a lease takeover-eligible. Renewal cadence is one third of the TTL (minimum one second), derived rather than a key. |
| `queue.park-recheck.provider-window` | integer milliseconds | `60000` | Recheck cadence for provider-window parks. |
| `queue.park-recheck.provider-quota` | integer milliseconds | `300000` | Recheck cadence for provider-quota parks. |
| `queue.park-recheck.preemption` | integer milliseconds | `60000` | Recheck cadence for preemption parks. |

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
| `queue.park` | `delivery.queue.park.v1` | `queue.parks:<REF>` | `queue release --park`, park recovery | Park pass, precedence, lane fold |
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
  `released`; `released` is declared in the closed set and no delivered path
  writes it), `recordedAt`.
- `queue.incident` — `schema`, `type` (`park-auto-recovery`,
  `lease-stale-takeover`), optional `ref`, optional `repository`, non-empty
  bounded `evidence[]` of `{key, value}` pairs, `recordedAt`.

Latest record per identity wins; an identical replay appends nothing. A wrong
kind, malformed payload, duplicate acquisition, or schema-incompatible record
under a queue prefix is a classified `state.*` failure, never a fabricated
entry, holder, park, or zero.

The entry record carries the normalized repository key and the declaring
checkout's absolute repository root together. The root is internal state used
only for producer deploy-expectation discovery; it is never serialized into an
envelope, finding, incident, golden, log line, or telemetry event, and read
surfaces render the normalized key alone. The derived graph folds no root.

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
`--watch` reuses `fallback.invocation` at exit 1. `queue ready` gains no row.

## Honest boundaries

This delivery is one-shot scheduling only. It does **not** ship the resident
daemon, control socket, NDJSON wire protocol, install/uninstall, startup
reconciliation, automatic preemption execution, or live `--watch` streaming
(M1-S18 / GH-238). It does **not** ship `dispatch`, session spawn, harness
selection, resume handling, or handover (M1-S9 / GH-239); M1-S9 composes the
claim/release capability. It performs no tracker, VCS, or CI write, no merge
execution, no gate evaluation, no worktree-scoped lease, no capacity or
bandwidth policy, and no fleet or multi-host coordination.

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
- [Result Contract and Error Table](feature-result-contract.md) — the five queue
  rows and the lanes collector row.
- [Status Digest](feature-status-digest.md) — the `lanes-or-queue` section and
  why it remains a declared gap of the digest collector.
