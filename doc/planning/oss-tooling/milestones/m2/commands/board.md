# board(1)

Status: Proposed (M2)

## NAME

`board` - the full M2 board: lanes, gates, owner asks, and parked work across
repositories.

## SYNOPSIS

```
<binary> board [--all] [--project <key>] [--json]
```

## DESCRIPTION

The full board, extending the M1 single-screen view. It renders lanes, open
gates, owner asks, and parked work from the same state source as brief and
status, so coordination stops re-deriving the world. It reads every managed
project on the host through the project model, so one board can span several
repositories without mixing their state.

`--project` narrows the board to one project key. `--all` spans every managed
project. The default is the current checkout's project.

This surface is proposed for M2-S4 - the cross-repository board depends on the
project model M2-S11 introduces - and its remainder beyond the M1 view is not
yet registered at the root listing; see
[../entrypoint-delta.md](../entrypoint-delta.md). The contract is
[../contracts.md](../contracts.md).

## OPTIONS

| Option | Meaning |
|---|---|
| `--all` | Span every managed project on the host. |
| `--project <key>` | Narrow to one project key. |
| `--json` | Emit the machine envelope instead of the human board. |

## OUTPUT

Text: four sections - lanes, gates, owner asks, parked work - each row naming
its project key, ref, and owner.

Envelope `data` carries:

| Key | Contract |
|---|---|
| `projects[]` | Project keys included in the board |
| `lanes[]` | Active lanes with ref, phase, and lease holder |
| `gates[]` | Open gates with their ref and condition |
| `asks[]` | Owner asks with age and drawn default |
| `parked[]` | Parked work with reason and until timestamp |

## EXIT STATUS

| Code | Meaning |
|---|---|
| `0` | The board was produced |
| `1` | The request was refused, for example an unknown project key |
| `2` | A platform or state failure prevented reading the board |

## EXAMPLES

```
$ <binary> board --all
LANES   delivery-a  GH-241  phase=4  holder=lane-1
        delivery-b  GH-244  phase=2  holder=lane-2
GATES   delivery-a  GH-241  review pending
ASKS    delivery-b  GH-244  age=2d  default=hold
PARKED  delivery-a  GH-239  reason=peak-window  until=18:00Z
```

```
$ <binary> board --project delivery-a --json
{ "ok": true, "command": "board", "data": { "projects": [ "delivery-a" ], "lanes": [], "gates": [], "asks": [], "parked": [] } }
```

## ERRORS

| Error | Meaning | Exit |
|---|---|---|
| `board.project-unknown` | The project key is not in the host index | 1 |
| `board.state-unavailable` | A project's state cannot be read | 2 |

## SEE ALSO

[projects.v1](../contracts.md), [multi-repository overview](../architecture.md),
[board v1](../../m1/commands/board.md)
