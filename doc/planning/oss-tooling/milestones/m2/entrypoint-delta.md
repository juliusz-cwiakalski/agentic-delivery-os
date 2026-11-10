# M2 entrypoint delta: root listing changes (planned)

A delta note, not a restated man page. It records the observed root entry at
the time of writing, the additions M2 plans, and the daemon registration gap
with its evidence. The M1 snapshot stays in
[../m1/commands/entrypoint.md](../m1/commands/entrypoint.md) and
[../m1/man-page.md](../m1/man-page.md).

## Observed composition

Observed from the built workspace at authoring time:

```
$ <binary> --help
Commands: status brief queue lanes blockers phase commit lint plan
          verify merge closeout dispatch spend retro coordinator
```

Sixteen families are registered: `status`, `brief`, `queue`, `lanes`,
`blockers`, `phase`, `commit`, `lint`, `plan`, `verify`, `merge`, `closeout`,
`dispatch`, `spend`, `retro`, and `coordinator`. `state`, `mcp`, and the
resident `daemon` are absent from the listing.

```
$ <binary> daemon --help
<binary>: unknown flag "--help"
exit 1

$ <binary> daemon status
<binary>: unexpected argument "status"
exit 1
```

## M2-planned additions

- `projects` becomes a root family: the host overview of managed checkouts.
- `attempts` joins under `dispatch` as `dispatch attempts`, the evidence
  read side.
- `events` joins the subscribe surface as the taxonomy reference; the daemon
  publishes the versioned topics.
- `spend` gains the v2 breakdowns and the reconciliation disclosure.
- `queue` gains the lifecycle verbs: release with a reason, remove with a
  reason, and dependency-edge add and remove.
- `board` becomes the full cross-repository board.

These additions are planned; the root listing changes only when the owning
story delivers.

## The daemon registration gap

The daemon command definition exists in the CLI composition and is mounted
only when the daemon option is enabled. The production entrypoint does not
enable it, so the lifecycle command is not reachable at the root listing: the
observed invocations above fail with `unknown flag "--help"` and
`unexpected argument "status"`, both with exit `1`.

Wiring the daemon lifecycle command into the production entrypoint is product
work outside this change; no plan document can close it. It is recorded here
so the gap is visible where the blueprint reader looks, and it stays owned by
the product surface.

## Pointer

The M1 page [../m1/commands/entrypoint.md](../m1/commands/entrypoint.md) now
points here for the registration gap and for the composition correction, so
the page and this note are read together.
