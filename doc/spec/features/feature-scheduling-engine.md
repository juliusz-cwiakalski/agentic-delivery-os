---
ados_distribution: internal
id: SPEC-SCHEDULING-ENGINE
status: Current
created: 2026-11-07
last_updated: 2026-11-07
owners: ["engineering"]
service: delivery-os
summary: "The daemon-free scheduling engine: one fenced, replay-idempotent queue graph; readiness re-derived on the delivered six-condition model with scheduler sources; repo-exclusive leases with a fence-token claim, renewal, release, and evidenced stale takeover; build weight as a per-runner resource class; producer-before-consumer batching with a producer-bound deploy-verified gate; a declared total precedence in which closing beats opening; parks with per-type recheck, a durable clear-observed marker, recovery incidents, and the classified stuck finding; the queue and lanes command surfaces with bounded payloads and truthful daemon-down degradation; and the additive record kinds, error rows, collector id, and typed configuration branch, all synchronized in-change."
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
  lease scope. The claim has two stages: the pre-fence gate evaluates parks and
  the five non-exclusivity readiness conditions, and the in-fence verified lease
  read owns the exclusivity outcome. A live lease held by another holder refuses
  `queue.lease-conflict`; a stale lease is taken over with previous-holder,
  lease, heartbeat-age, last-heartbeat, and takeover evidence plus a
  `lease-stale-takeover` incident; a same-holder repeat claim renews. No
  capacity, bandwidth, concurrency-budget, or CI-slot key or path exists.
- **Weight as a resource class.** A validated plan that omits `weightClass`
  resolves to `standard`; a declared-but-unrecognized value resolves to `heavy`;
  an invalid, unreadable, or absent plan resolves to `heavy` with named source
  evidence. At most one heavy lease is active per runner; standard entries keep
  scheduling, so weight never reduces the active repository count.
- **Producer-before-consumer with a deploy gate.** A consumer is not eligible
  while its producer is unresolved. A landed producer whose own repository
  declares `merge.deploy-expectations` must have a `verified` deploy verdict;
  unknown, failed, unreadable, or an exhausted three-read budget holds the
  dependent at `deploy-unverified`, never green. Expectations resolve from the
  producer repository's own configuration bound to its recorded key; no matching
  recorded root, a two-root collision, or an unreadable/invalid config is
  `unknown`, never `not-declared` or `verified`.
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
  available, and preemption clears when the preempting lease is released. A
  mutating pass that observes a clear condition appends the durable
  `clear-observed` marker first, then the `recovered` record and a
  `park-auto-recovery` incident naming the condition, clear time, evaluation
  time, and observation gap. A marker without a later `recovered` record is the
  stuck class: a report-only finding on reads at exit 0 and a
  `queue.park-condition-stuck` refusal on a claim at exit 1.
- **One declared total order.** Hard exclusions (readiness, dependency/deploy,
  parks, single-flight, weight) remove candidates; ordering applies rank class,
  then producer-before-consumer within one repository, then explicit priority
  ascending, then numeric ref suffix, then canonical ref text. Step 13b projects
  at most one action per repository per pass and holds the remainder
  `repo-claimed-in-pass`; a later pass re-evaluates them. Ordering uses cheap
  graph facts for the whole entry set and performs expensive readiness reads for
  at most the first 32 ordered candidates.
- **Bounded, truthful surfaces.** `queue list`, `queue plan`, `queue add`,
  `queue prioritize`, `queue dep`, `queue claim`, and `queue release` return the
  Appendix C envelopes. `lanes list|show` return the bounded lane view. A
  daemon-down mutation still lands and reports `daemon-unreachable` at exit 0.
  `queue list|plan` exit 2 with the classified `state.*` identity when lease or
  park history is unreadable, torn, or of unknown kind, presenting no success
  verdict and no partial or empty view as a schedule. `--watch` is not in the
  accepted grammar and is refused as an invocation rejection.
- **Additive vocabulary.** Five record kinds (`queue.entry`, `queue.dependency`,
  `queue.lease`, `queue.park`, `queue.incident`) plus the derived
  `delivery.queue.graph.v1` document; five `queue` rows; the collector-id set
  extended from `{tracker}` to `{tracker, lanes}`; and the typed `queue` branch
  with `queue.lease-ttl` and `queue.park-recheck.<condition-type>`. No schema
  version bump, migration, backfill, or compatibility path exists.

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
`config.value.invalid`, both naming the key. No capacity, bandwidth,
concurrency, or CI-slot key exists or is reserved.

## State records

| Kind / document | Payload schema | Store-scoped key |
|---|---|---|
| `queue.entry` | `delivery.queue.entry.v1` | `queue.entries:<REF>` |
| `queue.dependency` | `delivery.queue.dependency.v1` | `queue.deps:<REF>` |
| `queue.lease` | `delivery.queue.lease.v1` | `queue.leases:<repoKey>` |
| `queue.park` | `delivery.queue.park.v1` | `queue.parks:<REF>` |
| `queue.incident` | `delivery.queue.incident.v1` | `queue.incidents:<REF or repoKey>` |
| Derived: queue graph | `delivery.queue.graph.v1` | derived document `queue-graph.json` |

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
identity at exit 2; an invocation rejection such as `--watch` reuses
`fallback.invocation` at exit 1. `queue ready` gains no row.

## Honest boundaries

This delivery is one-shot scheduling only. It does **not** ship the resident
daemon, control socket, NDJSON wire protocol, install/uninstall, startup
reconciliation, automatic preemption execution, or live `--watch` streaming
(M1-S18 / GH-238). It does **not** ship `dispatch`, session spawn, harness
selection, resume handling, or handover (M1-S9 / GH-239); M1-S9 composes the
claim/release capability. It performs no tracker, VCS, or CI write, no merge
execution, no gate evaluation, no worktree-scoped lease, no capacity or
bandwidth policy, and no fleet or multi-host coordination. The status digest's
declared `lanes-or-queue` gap and its stale expected-story reference remain its
own reconciliation; this change does not edit that spec.

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
