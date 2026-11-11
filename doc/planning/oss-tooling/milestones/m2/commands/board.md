# board(1)

Status: Proposed (M2)

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

The `board` command is defined in the edge composition but not composed by
the production entrypoint, so it does not answer from the root listing today;
M2-S4 has to mount it. The remainder beyond the M1 view is planned for M2-S4
and builds on the per-repository state scope and host index delivered by
M2-S11. See [../entrypoint-delta.md](../entrypoint-delta.md) for the root
delta and [../contracts.md](../contracts.md) for the contract.

## OPTIONS

| Option | Meaning |
|---|---|
| `--all` | Span every managed repository on the host. |
| `--project <key>` | Narrow to one repository key. |
| `--json` | Emit the machine envelope instead of the human board. |

## OUTPUT

Text: four sections - lanes, gates, owner asks, parked work - each row naming
its repository key, ref, and owner.

Envelope `data` carries:

| Key | Contract |
|---|---|
| `repositories[]` | Repository keys included in the board |
| `lanes[]` | Active lanes with ref, phase, and lease holder |
| `gates[]` | Open gates with their ref and condition |
| `asks[]` | Owner asks with age and drawn default |
| `parked[]` | Parked work with reason and until timestamp |

## EXIT STATUS

| Code | Meaning |
|---|---|
| `0` | The board was produced |
| `1` | The request was refused, for example an unknown repository key |
| `2` | A platform or state failure prevented reading the board |

## EXAMPLES

```
$ <binary> board --all
LANES   delivery-a-1a2b3c4d  GH-241  phase=4  holder=lane-1
        delivery-b-5e6f7a8b  GH-244  phase=2  holder=lane-2
GATES   delivery-a-1a2b3c4d  GH-241  review pending
ASKS    delivery-b-5e6f7a8b  GH-244  age=2d  default=hold
PARKED  delivery-a-1a2b3c4d  GH-239  reason=peak-window  until=18:00Z
```

```
$ <binary> board --project delivery-a-1a2b3c4d --json
{ "ok": true, "command": "board", "data": { "repositories": [ "delivery-a-1a2b3c4d" ], "lanes": [], "gates": [], "asks": [], "parked": [] } }
```

## ERRORS

| Error | Meaning | Exit |
|---|---|---|
| `board.repository-unknown` | The repository key is not in the host index | 1 |
| `board.state-unavailable` | A repository's state cannot be read | 2 |

## SEE ALSO

[contracts](../contracts.md), [multi-repository overview](../architecture.md),
[board v1](../../m1/commands/board.md)
