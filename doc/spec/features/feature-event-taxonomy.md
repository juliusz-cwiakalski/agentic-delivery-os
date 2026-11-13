---
ados_distribution: internal
id: SPEC-EVENT-TAXONOMY
status: Current
created: 2026-11-12
last_updated: 2026-11-13
owners: ["engineering"]
service: delivery-os
summary: "The published event taxonomy v1 on the resident daemon's subscribe surface and its reference command family: six closed topics (`queue` and `lanes` snapshot topics; `queue.graph`, `dispatch.attempt`, `phase.state`, and `blockers.state` event topics), the eight-field event envelope with its per-topic `lane` and `ref` rule, per-`(topic, lane)` process-scoped `sequence` as the only ordering guarantee with gap-to-repoll, preserved overflow carriage stamped `overflow: \"repoll\"`, the unknown-topic subscribe refusal, the generated `events list` / `events describe <topic>` surface with its three error identities and `{0, 1, 2}` exits, every declared kind with a producer, and the mount as one prompt-required unit."
links:
  related_changes: ["GH-290", "GH-292"]
  related_decisions: ["TDR-0025", "TDR-0005"]
  contracts:
    - "packages/core/src/contracts/taxonomy.ts"
    - "packages/core/src/contracts/control.ts"
    - "packages/core/src/domain/event-projection.ts"
    - "packages/core/src/domain/control-session.ts"
    - "packages/core/src/app/control-server.ts"
    - "packages/cli/src/daemon-compose.ts"
    - "packages/cli/src/commands/events.ts"
    - "packages/cli/src/help/prompt-required-commands.ts"
---

# Feature: Event Taxonomy v1 and the Events Reference Surface

## Overview

The resident daemon publishes delivery-state changes as a versioned event
taxonomy over its existing local subscribe socket. One authored declaration —
types and `as const` data in the contracts tier — authors the six closed topics,
each topic's shape, frame field list, lane rule, kind records with their payload
fields and emission state, the ordering rule, and the overflow policy, and the
`events` reference command generates its surface from that declaration. The
daemon's emission projection is hand-authored and pinned to the declaration:
its kind-name set is compared bidirectionally against the declared emitted set,
and every declared kind's emitted payload keys are compared field-for-field
against the declaration, so drift in either direction fails a named test. The
ordering rule and the overflow policy are pinned at declaration and surface
level, because an event frame carries neither value to compare.

`events list [--json]` and `events describe <topic> [--json]` render the
declaration: no store, configuration, git, network, or filesystem read, and no
write. A client pins `taxonomyVersion`, switches on `(topic, kind)`, and treats
a sequence discontinuity or an overflow stamp as "repoll and continue from a
fresh baseline".

The daemon, its control protocol, and its two snapshot topics are described in
[Resident Dispatch Daemon](feature-resident-daemon.md). The binding decision
record is
[TDR-0025](../../decisions/TDR-0025-public-event-taxonomy-v1-subscribe-surface.md);
this page states the delivered behaviour.

## Topics and shapes

The topic set is closed at six. `status` is a control wire type, not a topic.
`queue.graph` is the only topic with a parent.

| Topic | Shape | Parent | Declared kinds (order) | Ordering | Overflow |
|---|---|---|---|---|---|
| `queue` | snapshot | — | none (`kinds: []`) | `snapshot-revision` | `repoll` |
| `lanes` | snapshot | — | none (`kinds: []`) | `snapshot-revision` | `repoll` |
| `queue.graph` | event | `queue` | `entry`, `dependency-edge`, `release`, `remove` | `sequence-per-lane` | `repoll` |
| `dispatch.attempt` | event | — | `started`, `refused`, `completed` | `sequence-per-lane` | `repoll` |
| `phase.state` | event | — | `began`, `completed`, `reopened` | `sequence-per-lane` | `repoll` |
| `blockers.state` | event | — | `published`, `updated`, `cleared` | `sequence-per-lane` | `repoll` |

A **snapshot topic** keeps the delivered frame `{topic, cursor, snapshot}`:
the initial subscribe baseline carries `cursor: 0`, the cursor advances only
when that topic's stable-serialized snapshot changes, and an unchanged tick
publishes nothing. A snapshot topic declares no kind and no payload field. Its
`ordering` value names the delivered cursor and is explicitly not an ordering
guarantee.

An **event topic** carries the change envelope and emits only observed durable
changes. Subscribing to an event topic produces no synthetic baseline; the first
frame is the next observed change. `since` keeps its snapshot-cursor meaning,
carries no event-topic semantics, and is accepted.

## Event envelope

Every frame on an event topic carries eight `data` fields in declared order:

```
topic, kind, lane, ref, sequence, occurredAt, payload, taxonomyVersion
```

The first seven are the change fields; `taxonomyVersion` is the version stamp
(`v1`) and sits outside `payload`. An event frame carries no `cursor`.

`lane` is present and a non-empty string on all four event topics; v1 declares
no nullable lane. `ref` is present and nullable only where its source record is
nullable:

| Topic | `lane` | `ref` |
|---|---|---|
| `queue.graph` | the entry `ref` | the source record's `ref` |
| `dispatch.attempt` | the delivery `ref` | the source record's `ref` |
| `phase.state` | the `changeRef` | the `changeRef` |
| `blockers.state` | the question record's required `lane` | the question record's `ref`, a string or explicit `null` |

`occurredAt` is the source record's own timestamp — `recordedAt` on the queue,
lane, and attempt records, `askedAt` on a question, `answeredAt` on an answer,
and `timestamp` on a phase transition — never the publish time, so
re-observing the same record yields the same value. `kind` is scoped to its
topic: `completed` exists on both `dispatch.attempt` and `phase.state`, and the
identity of a change class is the pair `(topic, kind)`.

## Kinds and payloads

Each kind's payload carries exactly its declared fields. A field suffixed `?` is
optional; a field suffixed `[]` is a list. `repositoryRoot` is never projected.
Every emitted kind, `remove` included, is covered by the emitted-payload-key
comparison, so an event that omits a declared key or carries an undeclared one
fails a named test.

| Topic | Kind | Emitted | Payload fields | Durable source |
|---|---|---|---|---|
| `queue.graph` | `entry` | yes | `ref`, `repository?`, `priority`, `recordedAt` | `queue.entry` |
| `queue.graph` | `dependency-edge` | yes | `ref`, `edges[]`, `added[]`, `removed[]`, `recordedAt` | `queue.dependency`, folded against the previous record for the same ref |
| `queue.graph` | `release` | yes | `leaseId`, `repository`, `ref`, `holder`, `runner`, `weightClass`, `operation`, `recordedAt` | `queue.lease` with `operation: released` |
| `queue.graph` | `remove` | yes | `ref`, `reason`, `recordedAt` | `queue.removal` |
| `dispatch.attempt` | `started` | yes | `ref`, `spawnOrdinal`, `sessionId?`, `harnessKind?`, `recordedAt` | `daemon.lane` in state `delivering` |
| `dispatch.attempt` | `refused` | yes | `attemptId`, `ref`, `repository`, `harness`, `evidenceClass`, `token`, `startedAt`, `finishedAt`, `evidenceRefs[]` | `dispatch.attempt` with `outcome: refused` |
| `dispatch.attempt` | `completed` | yes | `attemptId`, `ref`, `token`, `outcome`, `handoverState`, `comparisonClass`, `falseSuccess`, `divergenceRef?`, `finishedAt` | `dispatch.attempt` with any other outcome |
| `phase.state` | `began` | yes | `changeRef`, `phaseId`, `timestamp` | `phase.transition` with `operation: complete`, first observation for that phase |
| `phase.state` | `completed` | yes | `changeRef`, `phaseId`, `commitIntent?`, `commitIntentBasis?`, `commitSha?`, `timestamp` | `phase.transition` with `operation: complete`, after that phase's first observation |
| `phase.state` | `reopened` | yes | `changeRef`, `phaseId`, `reason`, `timestamp` | `phase.transition` with `operation: reopen` |
| `blockers.state` | `published` | yes | `id`, `type`, `audience`, `question`, `options[]`, `askedAt` | `blocker.question` |
| `blockers.state` | `updated` | yes | `id`, `answeringAudience`, `choice?`, `text?`, `answeredAt`, `resumeMode` | `blocker.answer` |
| `blockers.state` | `cleared` | yes | `id`, `lane`, `resumeMode`, `clearedAt` | the delivering lane's `resumeIntent` recorded after an answer is consumed |

Three emission facts are declared rather than inferred:

- **`completed` is not a success claim.** The attempt record's `outcome` names
  what happened; `completed` means the attempt ended and was recorded. A refusal
  is the one outcome with its own kind because a refused attempt never ran.
- **`began` is derived.** No begin record is written. `began` is emitted in the
  same observation as a phase's first `completed`, with the lower `sequence` on
  the same lane.
- **Every declared kind has a producer.** The four `queue.graph` kinds are all
  emitted; `remove` derives from the `queue.removal` ledger, one event per applied
  removal, with exactly its declared payload fields `ref`, `reason`, and
  `recordedAt`. The `reason` is a member of the closed four-value vocabulary
  `landed | abandoned | superseded | reconciled`, and the lane is the entry ref.
  There is no declared-only kind and no non-emitted set.

A `dependency-edge` event is emitted only when the folded edge set differs from
the previous record for the same ref; a rewritten identical record publishes
nothing, and a `dep remove` of an absent edge publishes nothing. A `queue release
--park` writes a separate `queue.park` record that no v1 kind consumes: the
`release` payload carries no park cause, and the park withdrawal a removal appends
for the same reason publishes nothing.

## Emission model

The publish tick takes one `readRecords()` view and folds it once for the
snapshot projection and once for the event projection. The event projection
performs no store read of its own. Its source families are `queue.entry`
(`entry`), `queue.dependency` (`dependency-edge`), `queue.lease` with
`operation: released` (`release`), `queue.removal` (`remove`), the `daemon.lane`
and `dispatch.attempt` ledgers (`dispatch.attempt`), `phase.transition`
(`phase.state`), and the blocker question and answer ledgers
(`blockers.state`).

- **Watermark.** Per observed `(topic, lane, source family)` the projection keeps
  the identity of the last emitted source record, so an unemitted delta stays
  pending rather than dropped or buffered. A `phase.transition` source is one
  cumulative artifact per change, so its identity is the artifact key paired
  with the position of the last emitted transition inside it.
- **Baseline.** The first observation initialises the watermark to the store's
  current tail, so a daemon started against a populated store publishes only
  subsequent changes and replays no history.
- **Burst cap.** At most 64 events per topic per publish tick; the remainder
  stays pending and is emitted on later ticks. Nothing is dropped.
- **Cost.** One whole-store read per publish tick serves every topic and every
  subscriber; no per-topic and no per-subscriber read is issued on the publish
  path. The heartbeat tick's own reads — its two-ledger fold and the durable
  heartbeat append/verify chain — are outside that count.
- **Failure.** If the shared store view cannot be read, that tick publishes
  nothing on any topic, the daemon loop does not fail, and the next tick
  retries; no partial event is published.

## Ordering

`sequence` is a positive integer allocated once per emitted event per
`(topic, lane)`, increasing by exactly one, shared by every subscriber of the
topic, and allocated by the publishing process. It is process-scoped: a daemon
restart restarts the counters.

A client's baseline is the first value it observes for a lane. A non-contiguous
successor — a jump forward, or any value at or below the last observed — means
the stream is discontinuous, and the client repolls instead of inferring order.
There is no cross-topic and no cross-lane ordering promise, and `occurredAt` and
the delivered `cursor` are never ordering signals.

## Overflow

The delivered slow-consumer behaviour is unchanged for all six topics: a
subscription's bounded buffer overflows, that subscription receives exactly one
`degraded` event, only that subscription is dropped, and every other
subscription keeps receiving. The degraded event's `data` carries
`degraded: "subscriber-overflow"`, `overflow: "repoll"`, and
`taxonomyVersion: "v1"`.

The reference surface declares `overflow: "repoll"` on every topic, rendered
from the same constant as the frame, so the declared remedy and the wire remedy
are the same value. `daemon.subscription-buffer` (default `256`) remains the
single capacity bound for both the per-subscription buffer and the
per-connection subscription count; exceeding the count is refused with
`daemon.subscriber-degraded`.

## Unknown topics and declaration integrity

A `subscribe` for a topic outside the six is refused with `events.topic-unknown`
before any ledger read; `status` is refused the same way. The refusal is decided
from the declaration, so a mistaken or hostile topic string never reaches a
store read and is never answered with another topic's snapshot.

The reference surface validates the declaration's integrity before rendering:
unique topic names, a non-empty kind list on every event topic and an empty one
on every snapshot topic, unique kinds per topic, a declared payload field list
per kind, known `shape`/`lane`/`ordering`/`overflow` values, every frame field
present, and each topic's payload union equal to its kinds' first-seen union. A
declaration that fails the check yields `events.taxonomy-unavailable` at exit
`2` and renders no page.

## `events` reference surface

**Grammar.** `events list [--json]` and `events describe <topic> [--json]`. The
family is pure data rendering: no store, configuration, git, network, or
filesystem read, no write, and no command composer.

**Text.** `list` prints one row per topic with its version, shape, kind count,
parent, ordering, and overflow policy; `describe` prints one topic's shape, lane
rule, ordering, overflow, frame fields, each kind with its emission state and
payload fields, and the derived payload union. Both stay inside the delivered
40-line / 8 192-byte human bound.

**Machine result.** The delivered `delivery.result.v1` result envelope is
`{schemaVersion, runId, exitCode, timing, data}` on success and
`{schemaVersion, runId, exitCode, timing, error}` on refusal. A produced
reference is exit `0` with `data`; `data` carries:

| Key | Contract |
|---|---|
| `command` | `events list` or `events describe` |
| `taxonomyVersion` | `v1` |
| `envelope[]` | The eight event-frame fields in declared order |
| `topics[]` | One record per declared topic for `list`, exactly one for `describe` |

A topic record carries `name`, `version`, `shape`, `parent` (only on
`queue.graph`), `frame`, `lane`, `kinds[]`, `payloadFields`, `ordering`, and
`overflow`. A kind record carries `name`, `emitted`, and `payloadFields`; a
snapshot topic's `kinds` and `payloadFields` are empty lists. Closed values are
`shape ∈ {snapshot, event}`, `lane ∈ {none, ref, change-ref, blocker-lane}`,
`ordering ∈ {sequence-per-lane, snapshot-revision}`, and `overflow = repoll`.

**Exit projection.** `0` reference produced; `1` `events.topic-unknown` (a topic
outside the six, including `status`) or `events.verb-unknown` (absent or unknown
verb); `2` `events.taxonomy-unavailable`. No other digit is produced by the
family.

## Mount

`events` is a member of the prompt-required command set and is composed
unconditionally by the production entrypoint: its runtime is the compiled
declaration, so it needs no store, configuration, transport, or supervisor
input and cannot degrade. Root `--help` lists every prompt-required family,
including `events`. The help inventory carries the family entry and one entry
per verb; the reference page is the M2 page
[events(1)](../../planning/oss-tooling/milestones/m2/commands/events.md),
resolved through the per-command page-root mapping the help gates apply, and the
coverage inventory carries the command row and the page row.

## Boundaries

- The taxonomy observes; it never writes. The declaration adds no state record
  kind of its own: the `remove` producer reads the scheduling engine's
  `queue.removal` ledger, and no taxonomy path appends a queue or lane mutation,
  changes a payload schema version, or introduces a migration, backfill, or seed.
- No new control wire type, frame field outside `data`, codec rule, protocol
  version, subscription-buffer semantics, or at-most-once behaviour is added.
- Provider-aware peak-pausing shapes (stop, parked, resumed, and park-edge) are
  a future taxonomy version, never an in-place edit to v1.
- The `events` family adds no `--watch` topic to `queue` or `lanes`; the four
  event topics are consumed through the daemon's subscribe surface.

## Related

- [Resident Dispatch Daemon](feature-resident-daemon.md) — the subscribe
  surface, control protocol v1, and the publish tick this taxonomy rides.
- [CLI Entrypoint and Self-Description](feature-cli-entrypoint.md) — the
  prompt-required composition and the help/reference-page gates.
- [Result Contract and Error Table](feature-result-contract.md) — the
  `delivery.result.v1` envelope, the `events` error kind, and the `{0, 1, 2}`
  exit projection.
- [Scheduling Engine](feature-scheduling-engine.md) — the queue, lease,
  dependency, and removal ledgers the `queue.graph` kinds project.
- [Dispatch Engine](feature-dispatch-engine.md) — the attempt ledger and lane
  records the `dispatch.attempt` topic projects.
- [Typed Blocker and Question Channel](feature-blockers.md) — the question and
  answer records and the lane `resumeIntent` the `blockers.state` topic projects.
- [Test Specification: Resident Dispatch Daemon](../../quality/test-specs/test-spec-resident-daemon.md)
  — the enduring coverage map for the taxonomy suites.
