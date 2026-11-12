# events(1)

Delivered (M2-S13)

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

Event taxonomy v1 declares six topics. `queue` and `lanes` are the delivered
snapshot topics: their frames are exactly `{topic, cursor, snapshot}`, they
declare no kind at all, and their ordering value is `snapshot-revision` (the
delivered cursor, which is not an ordering guarantee). `queue.graph` extends
`queue`, and `dispatch.attempt`, `phase.state`, and `blockers.state` are the new
event topics. Each event topic declares its kind set, one ordering rule, and one
overflow policy.

| Topic | Shape | Parent | Declared kinds (order) |
|---|---|---|---|
| `queue` | snapshot | - | none (no kind) |
| `lanes` | snapshot | - | none (no kind) |
| `queue.graph` | event | `queue` | `entry`, `dependency-edge`, `release`, `remove` |
| `dispatch.attempt` | event | - | `started`, `refused`, `completed` |
| `phase.state` | event | - | `began`, `completed`, `reopened` |
| `blockers.state` | event | - | `published`, `updated`, `cleared` |

Every frame on an event topic carries the eight declared `data` fields, in order:
`topic`, `kind`, `lane`, `ref`, `sequence`, `occurredAt`, `payload`,
`taxonomyVersion`. `lane` is a non-empty string on every event topic. `ref` is a
non-empty string on `queue.graph`, `dispatch.attempt`, and `phase.state`, and is
the question record's string or explicit `null` on `blockers.state`. `occurredAt`
copies the source record's own timestamp.

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
and `taxonomyVersion: "v1"`; only that subscription is dropped and every other
subscription keeps receiving. The declared remedy and the wire remedy are the same
value. `queue.graph` kind `remove` is declared and not emitted in v1: no delivered
path removes a queue entry, so its record carries `emitted: false`.

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

Envelope `data` carries `taxonomyVersion`, `envelope[]` (the eight event-frame
fields in order), and `topics[]`. A topic record carries exactly:

| Key | Contract |
|---|---|
| `name` | The topic name, a member of the closed six-topic set |
| `version` | `v1` |
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
queue             v1  shape=snapshot   kinds=0  ordered by snapshot revision  overflow=repoll
lanes             v1  shape=snapshot   kinds=0  ordered by snapshot revision  overflow=repoll
queue.graph       v1  shape=event      kinds=4  parent=queue  ordered per lane  overflow=repoll
dispatch.attempt  v1  shape=event      kinds=3  ordered per lane  overflow=repoll
phase.state       v1  shape=event      kinds=3  ordered per lane  overflow=repoll
blockers.state    v1  shape=event      kinds=3  ordered per lane  overflow=repoll
```

The kind counts are `0/0/4/3/3/3`: the two snapshot topics declare no kind, and
the four event topics declare four, three, three, and three.

```
$ <binary> events describe queue.graph --json
{ "data": { "taxonomyVersion": "v1", "envelope": ["topic", "kind", "lane", "ref", "sequence", "occurredAt", "payload", "taxonomyVersion"], "topics": [ { "name": "queue.graph", "shape": "event", "kinds": ["..."] } ] } }
```

## ERRORS

| Error | Meaning | Exit |
|---|---|---|
| `events.topic-unknown` | The topic is not in the declared six-topic taxonomy | 1 |
| `events.verb-unknown` | The requested verb is not `list` or `describe`, or is absent | 1 |
| `events.taxonomy-unavailable` | The compiled declaration failed its integrity check, so no page is rendered | 2 |

## EXTENSION PATH (S17 — not v1)

The `stop`, `parked`, `resumed`, and `park-edge` shapes belong to M2-S17. They are
not v1 kinds and no v1 path emits them; they arrive as a future taxonomy version,
never as an in-place edit to this one. The `dispatch.attempt` kind set is complete
for v1 at `started`, `refused`, and `completed`, and a `queue.graph` park-edge
projection waits for that version change together with its payload.

## HELP

`<binary> events --help`, `<binary> events list --help`, and
`<binary> events describe --help` render this page's usage, options, examples,
exit codes, and see-also pointer. `<binary> --version` prints the binary identity
only.

## SEE ALSO

[event taxonomy v1](../contracts.md), [entrypoint delta](../entrypoint-delta.md),
[queue](queue.md), [lanes](lanes.md)
