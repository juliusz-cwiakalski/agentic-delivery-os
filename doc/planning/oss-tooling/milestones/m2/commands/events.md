# events(1)

Status: Proposed (M2)

## NAME

`events` - the subscribe event taxonomy reference for delivery state changes.

## SYNOPSIS

```
<binary> events list [--json]
<binary> events describe <topic> [--json]
```

## DESCRIPTION

The subscribe-taxonomy reference. It documents and lists the versioned topics
the resident daemon publishes, so any client - a watch command, a script, a
board - consumes one contract instead of scraping state files.

The topics are `queue.graph`, `dispatch.attempt`, `phase.state`, and
`blockers.state`, extending the delivered status and lanes topics. Each topic
declares its event kinds, payload shape, and ordering guarantee. Events are
ordered per lane by a monotonic sequence; a slow consumer overflows to a
repoll that is defined per topic, so overflow never becomes silent loss.

This surface is proposed for M2-S13 and is not yet registered at the root
listing; see [../entrypoint-delta.md](../entrypoint-delta.md). The contract is
"event taxonomy v1" in [../contracts.md](../contracts.md).

## OPTIONS

| Option | Meaning |
|---|---|
| `list` | List the topics and their versions. |
| `describe <topic>` | Print one topic's kinds, payload fields, ordering rule, and overflow behavior. |
| `--json` | Emit the machine envelope instead of the human page. |

## OUTPUT

Text: a topic list with version and kind count, or a single topic's reference
page.

Envelope `data` carries:

| Key | Contract |
|---|---|
| `taxonomyVersion` | The version the binary speaks |
| `topics[]` | Topic records with `name`, `version`, `kinds[]`, `payloadFields[]`, `ordering`, `overflow` |
| `topics[].ordering` | The ordering guarantee, always per-lane monotonic sequence |
| `topics[].overflow` | The overflow policy for the topic |

## EXIT STATUS

| Code | Meaning |
|---|---|
| `0` | The reference was produced |
| `1` | The request was refused, for example an unknown topic |
| `2` | A platform failure prevented reading the taxonomy |

## EXAMPLES

```
$ <binary> events list
queue.graph       v1  kinds=4  ordered per lane  overflow=repoll
dispatch.attempt  v1  kinds=3  ordered per lane  overflow=repoll
phase.state       v1  kinds=3  ordered per lane  overflow=repoll
blockers.state    v1  kinds=3  ordered per lane  overflow=repoll
```

```
$ <binary> events describe queue.graph --json
{ "ok": true, "command": "events describe", "data": { "taxonomyVersion": "v1", "topics": [ "..." ] } }
```

## ERRORS

| Error | Meaning | Exit |
|---|---|---|
| `events.topic-unknown` | The topic is not in the taxonomy | 1 |
| `events.verb-unknown` | The requested verb is not `list` or `describe` | 1 |
| `events.taxonomy-unavailable` | The taxonomy document cannot be read | 2 |

## SEE ALSO

[event taxonomy v1](../contracts.md), [telemetry attribution flow](../architecture.md),
[queue](queue.md)
