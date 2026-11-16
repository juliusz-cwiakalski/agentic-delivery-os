# steer — file, read, and complete steering notes

`steer` is the owner's course-correction channel for a running delivery. A note
is stored on the shared typed message record in the invoking repository's local
state, queues with its origin block and TTL, lands batched at the next phase
boundary, and completes against the artifact that proves the course change.

`steer --help` renders this command's summary, usage, options, examples, exit
codes, and see-also pointer; `steer --version` prints the resolved version and
build identity. Per-subcommand help (`steer send --help`, `steer list --help`,
`steer read --help`, `steer complete --help`) is served from the same static
inventory.

## Grammar

```
<binary> steer send "<text>" [--kind request|escalate] [--priority low|normal|high|urgent] [--ttl <duration>] [--ref <artifact>]
<binary> steer list
<binary> steer read
<binary> steer complete <id> --ref <artifact>
```

`send` accepts exactly one positional; `complete` exactly one id plus the
required `--ref`; `list` and `read` accept none, so `steer read <id>` is the
delivered `fallback.invocation` grammar refusal, never `steer.unknown-id`.

## Drawn defaults

Every omitted field draws a declared default: `kind` `request`, `priority`
`normal`, `ttl` `24h`, `ref` `null`. The origin block is derived from the
invoking checkout (the bound work-item ref, the repository key, `agent: owner`);
an unbound checkout records the bare `null` change and still files.

`--ttl` is `<positive-integer><unit>` with unit `s`, `m`, `h`, or `d`; the
maximum is `30d` (2,592,000 seconds). Zero, negative, malformed, and oversized
values are value violations refused before any state read.

## The boundary read point

`steer read` derives the boundary from the delivered phase-state records: no
record, or every recorded entry completed, is open and due notes land in one
batch in the shared rank (priority class, then oldest created, then id); an
entry in progress is closed and every note reads pending with
`phase-in-progress` while nothing is applied or recorded. A note whose TTL
elapsed is recorded as a `ttl-elapsed` outcome and the delivery continues its
previous course. The read payload lists at most 20 notes in rank order with
counted overflow; the landing write is never capped by that display bound.
The same payload batches the open owner-audience questions with their delivered
drawn defaults and measured ages.

## Completion

`steer complete <id> --ref <artifact>` appends exactly one completion record for
a landed note; the first completion is authoritative and a repeat is refused.
A queued, expired, or already-completed note, a missing/empty/over-cap `--ref`
is `input.value.rejected` before any write.

## Exit codes

| Code | Meaning |
|---|---|
| `0` | The subcommand produced its payload (including an empty queue and a boundary-closed decline) |
| `1` | A value, identity, credential, or grammar refusal (`input.value.rejected`, `steer.unknown-id`, `steer.credential-value-rejected`, `fallback.invocation`) |
| `2` | The steering store is unreadable, unwritable, or an append could not be verified (`steer.queue-unavailable`) |

## No session operation

The family is local-state only: no LLM, network, tracker, provider, timer,
daemon, or control-socket access, and no session spawn/attach/resume/steer
operation. Landed notes are adopted by the delivery itself at the read point.

See also: the change specification
`doc/changes/2026-11/2026-11-16--GH-298--steer/chg-GH-298-spec.md` and the
result-contract error table.

## Status

Delivered by GH-298 (M2-S5) on `feat/GH-298/steer`.
