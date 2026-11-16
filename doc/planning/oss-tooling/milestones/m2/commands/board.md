# board(1)

Status: Delivered (M2, GH-297)

## NAME

`board` - the full M2 board: lanes, gates, owner asks, and parked work across
managed repository checkouts.

## SYNOPSIS

```
<binary> board [--all] [--project <key>] [--json]
```

## DESCRIPTION

The full board, extending the M1 single-screen view. It renders lanes, open
gates, owner asks, and parked work from the same state source as brief and
status, so coordination stops re-deriving the world. It reads managed
repository checkouts through the per-repository state scope and host index
delivered by M2-S11, so one board can span several repositories without mixing
their state.

`--project <key>` takes a repository key and narrows the board to that
checkout. `--all` spans managed repositories. The default is the current
checkout. The board is a host view over repository keys; it is not
group-scoped, and no board surface enumerates groups.

The production entrypoint composes `board` unconditionally and advertises it
as the 21st prompt-required family. The four sections project from the shared
`delivery.status-facts.v1` bundle and the delivered lane/phase fold, and the
repository set resolves through the delivered multi-repository state scope and
host index (M2-S11). See [../entrypoint-delta.md](../entrypoint-delta.md) for
the root delta and [../contracts.md](../contracts.md) for the contract.

## OPTIONS

| Option | Meaning |
|---|---|
| `--help` | Print this page's help from the static inventory and exit 0 |
| `--version` | Print the binary version and exit 0 |
| `--all` | Span every managed repository on the host. |
| `--project <key>` | Narrow to one repository key. |
| `--json` | Emit the machine envelope instead of the human board. |

## OUTPUT

Text: four sections in fixed order - `LANES`, `GATES`, `ASKS`, `PARKED` - each
row naming its repository key, ref, and owner. A header states the audience,
scope, selection, repository count, and per-repository collector evidence. An
empty board or the `unbound` scope renders `observed-empty`. Each section label
carries a `+N more <section> omitted` marker when the human cap, the machine
cap, or the byte guard dropped rows.

Envelope `data` carries:

| Key | Contract |
|---|---|
| `schemaVersion` | `delivery.board.v1` |
| `audience` | The delivered audience dimension (`owner`) |
| `scope` | `repository` or `unbound` |
| `selection` | `current`, `project`, or `all` |
| `repositories[]` | The included repository keys, ascending, unique, at most 128 |
| `lanes[]` | Active lanes with ref, phase, lease holder, and owner |
| `gates[]` | Open gates with ref, condition, SLA state, drawn default, and owner |
| `asks[]` | Owner asks with age, drawn default, and default state |
| `parked[]` | Parked work with reason and until timestamp |
| `collectors[]` | Per-repository `{ collector, outcome, repository }` evidence |
| `ownerHold` | The host-wide owner-hold fact |
| `stateSource` | `delivery.status-facts.v1`, equal to the status and brief member |
| `truncated`, `omitted`, `omittedBySection` | Drop markers and per-section counts |

The repository-list field is `repositories[]`; the board names repository keys
throughout and never enumerates groups.

## EXIT STATUS

| Code | Meaning |
|---|---|
| `0` | The board was produced, including empty sections and the `unbound` scope |
| `1` | The request was refused (`board.repository-unknown` or `fallback.invocation`) |
| `2` | A platform or state failure prevented reading the board (`board.state-unavailable` or a collector identity) |

## EXAMPLES

```
$ <binary> board --all
<binary> board  audience=owner  scope=repository  selection=all  repositories=2  collectors=tracker:available,lanes:available,...
LANES
delivery-a-1a2b3c4d  GH-241  state=delivering  phase=delivery  holder=principal-a
GATES
delivery-a-1a2b3c4d  GH-241:owner-review  owner-review  GH-241  age=26h  sla=escalated  default=null  waivedBy=null  owner=owner  cond=owner-review:escalated
ASKS
delivery-b-5e6f7a8b  ask-7020  ref=GH-244  age=3h  default=owner-review-first:pending  owner=owner
PARKED
delivery-a-1a2b3c4d  GH-239  reason=peak-window  until=2026-11-06T18:00:00Z  owner=null
```

```
$ <binary> board --project delivery-a-1a2b3c4d --json
{"schemaVersion":"delivery.result.v1","runId":"...","exitCode":0,"timing":{...},"data":{"schemaVersion":"delivery.board.v1","scope":"repository","selection":"project","repositories":["delivery-a-1a2b3c4d"],"lanes":[],"gates":[],"asks":[],"parked":[],"stateSource":"delivery.status-facts.v1","omittedBySection":{...},...}}
```

## ERRORS

| Error | Meaning | Exit |
|---|---|---|
| `board.repository-unknown` | The requested key is not in the managed set | 1 |
| `board.state-unavailable` | A host index, repository state location, or required source cannot be read | 2 |
| `status.collector.<id>.unavailable` | A required collector is unavailable | 2 |
| `fallback.invocation` | A grammar violation: `--all` with `--project`, an unknown flag, a positional, or `--project` with no value | 1 |

## SEE ALSO

[contracts](../contracts.md), [multi-repository overview](../architecture.md),
[board v1](../../m1/commands/board.md), [specification](../../../../../spec/features/feature-board.md)
