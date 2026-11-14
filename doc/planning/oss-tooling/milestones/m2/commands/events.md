# events(1)

Delivered (M2-S13); taxonomy v2 delivered by M2-S17 (GH-294)

## NAME

`events` - the subscribe event taxonomy reference for delivery state changes.

## SYNOPSIS

```
<binary> events list [--json]
<binary> events describe <topic> [--json]
```

## DESCRIPTION

The subscribe-taxonomy reference. It documents and lists the versioned topics the
resident daemon publishes, so any client - a watch command, a script, a board -
consumes one contract instead of scraping state files.

Event taxonomy v2 declares six topics. `queue` and `lanes` are the delivered
snapshot topics: their frames are exactly `{topic, cursor, snapshot}`, they
declare no kind at all, and their ordering value is `snapshot-revision` (the
delivered cursor, which is not an ordering guarantee). `queue.graph` extends
`queue`, and `dispatch.attempt`, `phase.state`, and `blockers.state` are the new
event topics. Each event topic declares its kind set, one ordering rule, and one
overflow policy.

v2 supersedes v1 as the single spoken version: the four peak-pause kinds join
additively (`stop`, `parked`, and `resumed` on `dispatch.attempt`; `park-edge`
on `queue.graph`), every v1 kind and payload stays byte-identical, and the
envelope, per-`(topic, lane)` sequence, and overflow model are unchanged. v1 is
retired, not served concurrently; the v1 declaration remains the historical
contract of record.

| Topic | Shape | Parent | Declared kinds (order) |
|---|---|---|---|
| `queue` | snapshot | - | none (no kind) |
| `lanes` | snapshot | - | none (no kind) |
| `queue.graph` | event | `queue` | `entry`, `dependency-edge`, `release`, `remove`, `park-edge` |
| `dispatch.attempt` | event | - | `started`, `refused`, `completed`, `stop`, `parked`, `resumed` |
| `phase.state` | event | - | `began`, `completed`, `reopened` |
| `blockers.state` | event | - | `published`, `updated`, `cleared` |

Every frame on an event topic carries the eight declared `data` fields, in order:
`topic`, `kind`, `lane`, `ref`, `sequence`, `occurredAt`, `payload`,
`taxonomyVersion`. `lane` is a non-empty string on every event topic. `ref` is a
non-empty string on `queue.graph`, `dispatch.attempt`, and `phase.state`, and is
the question record's string or explicit `null` on `blockers.state`. `occurredAt`
copies the source record's own timestamp.

The peak-pause payloads are bounded evidence (each kind carries at most seven
declared payload fields, well under the twenty-field evidence cap): `stop`
records the bounded-grace deadline, the profile, the window end, and the
recorded stop instant; `parked` records reason `peak-window`, the profile,
`until` at the window end, and the preservation classification
(`preserved | session-state-not-preserved`); `resumed` records the preserved
session-state reference, the same branch, and the `reDispatched: false` fact;
`park-edge` records the park lifecycle edge - ref, cause (`peak-window` or
`owner-hold`), the episode identity, and `until` where the cause carries an
expiry (an `owner-hold` park's `until` is a declared classified absence).

Ordering: an event topic's `sequence` is monotonic per `(topic, lane)`, increasing
by exactly one per emitted event, allocated once per event by the publishing
process and shared by every subscriber. There is no cross-topic and no cross-lane
ordering promise. A client's baseline is the first value it observes for a lane; a
non-contiguous successor - a jump forward, or any value at or below the last
observed - is a gap, and the client repolls instead of inferring order. The
counters are process-scoped, so a daemon restart is a declared discontinuity that a
client detects the same way and answers with a repoll. `occurredAt` is not an
ordering signal, and the delivered `cursor` appears on no event frame.

Overflow: a subscription's bounded buffer overflowing yields exactly one
`degraded` event carrying `degraded: "subscriber-overflow"`, `overflow: "repoll"`,
and `taxonomyVersion: "v2"`; only that subscription is dropped and every other
subscription keeps receiving. The declared remedy and the wire remedy are the same
value. Every declared kind is emitted under v2: `remove` projects the delivered
`queue.removal` ledger, and the peak-pause kinds project the durable
`queue.park` episode records.

`status` is a wire type, not a topic. A subscription or a `describe` for a topic
outside the six is refused with `events.topic-unknown`.

## OPTIONS

| Option | Meaning |
|---|---|
| `list` | List the topics and their versions. |
| `describe <topic>` | Print one topic's shape, kinds with their emitted state, per-kind payload fields, lane rule, ordering rule, overflow policy, and frame field list. |
| `--json` | Emit the machine envelope instead of the human page. |

## OUTPUT

Text: a topic table with the version, shape, kind count, parent, ordering, and
overflow policy, or a single topic's reference page.

The result is the delivered `delivery.result.v1` envelope
`{schemaVersion, runId, exitCode, timing, data}` on success and
`{schemaVersion, runId, exitCode, timing, error}` on refusal. `data` carries
`command`, `taxonomyVersion`, `envelope[]` (the eight event-frame fields in
order), and `topics[]`. A topic record carries exactly:

| Key | Contract |
|---|---|
| `name` | The topic name, a member of the closed six-topic set |
| `version` | `v2` |
| `shape` | `snapshot` or `event` |
| `parent` | Present only on `queue.graph`, value `queue` |
| `frame` | `topic,cursor,snapshot` on a snapshot topic; the eight declared fields on an event topic |
| `lane` | The lane-selection rule: `none`, `ref`, `change-ref`, or `blocker-lane` |
| `kinds[]` | One record per declared kind: `name`, `emitted`, `payloadFields[]`; empty on a snapshot topic |
| `payloadFields[]` | The derived union of the topic's per-kind payload fields; empty on a snapshot topic |
| `ordering` | `sequence-per-lane` or `snapshot-revision` |
| `overflow` | `repoll` |

## EXIT STATUS

| Code | Meaning |
|---|---|
| `0` | The reference was produced |
| `1` | The request was refused: an unknown topic, or an absent or unknown verb |
| `2` | The taxonomy declaration failed its own integrity check |

## EXAMPLES

```
$ <binary> events list
queue             v2  shape=snapshot   kinds=0  ordered by snapshot revision  overflow=repoll
lanes             v2  shape=snapshot   kinds=0  ordered by snapshot revision  overflow=repoll
queue.graph       v2  shape=event      kinds=5  parent=queue  ordered per lane  overflow=repoll
dispatch.attempt  v2  shape=event      kinds=6  ordered per lane  overflow=repoll
phase.state       v2  shape=event      kinds=3  ordered per lane  overflow=repoll
blockers.state    v2  shape=event      kinds=3  ordered per lane  overflow=repoll
```

The kind counts are `0/0/5/6/3/3`: the two snapshot topics declare no kind, and
the four event topics declare five, six, three, and three.

```
$ <binary> events describe queue.graph --json
{ "data": { "command": "events describe", "taxonomyVersion": "v2", "envelope": ["topic", "kind", "lane", "ref", "sequence", "occurredAt", "payload", "taxonomyVersion"], "topics": [ { "name": "queue.graph", "shape": "event", "kinds": ["..."] } ] } }
```

## ERRORS

| Error | Meaning | Exit |
|---|---|---|
| `events.topic-unknown` | The topic is not in the declared six-topic taxonomy | 1 |
| `events.verb-unknown` | The requested verb is not `list` or `describe`, or is absent | 1 |
| `events.taxonomy-unavailable` | The compiled declaration failed its integrity check, so no page is rendered | 2 |

## V1-CONSUMER COMPATIBILITY (v2)

Published with the v2 declaration (TDR-0029 D6), six points:

1. Frames keep their shape: the eight `data` keys and their order are unchanged,
   so every v2 frame is structurally decodable by a v1 consumer.
2. Nothing a v1 consumer listens for changed: every v1 `(topic, kind)` pair and
   its payload field list is unchanged - no rename, removal, or re-semantics.
3. The four new pairs are decodable and ignorable: `stop`, `parked`, `resumed`,
   and `park-edge` are additive `(topic, kind)` identities; a consumer's kind
   switch must carry a default-ignore branch. They are not a discontinuity -
   `sequence` stays contiguous per `(topic, lane)` - so the correct reaction is
   ignore-and-continue, never repoll (a repoll would loop: the condition
   persists).
4. A foreign stamp is a version-drift signal, not an error: a consumer that
   validates `taxonomyVersion` against its pin treats a stamp it does not pin
   as a prompt to re-read this reference surface, repin if it can speak `v2`,
   and otherwise keep default-ignoring unknown kinds. It forces no disconnect
   and changes no ordering behavior.
5. Ordering and overflow semantics are untouched: gap-to-repoll,
   restart-as-discontinuity, and the degraded-event overflow carriage behave
   exactly as declared in v1, and the degraded frame's stamp moves with
   everything else.
6. The remedies do not multiply: repoll remains reserved for sequence
   discontinuity and overflow exactly as delivered; version drift and unknown
   kinds get their own reactions above. No new client action is required to
   keep receiving v1 content.

## HELP

`<binary> events --help`, `<binary> events list --help`, and
`<binary> events describe --help` render this page's usage, options, examples,
exit codes, and see-also pointer. `<binary> --version` prints the binary identity
only.

## SEE ALSO

[event taxonomy v1](../contracts.md), [entrypoint delta](../entrypoint-delta.md),
[queue](queue.md), [lanes](lanes.md)
