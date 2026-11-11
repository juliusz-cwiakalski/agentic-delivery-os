# M2 entrypoint delta: root listing changes (planned)

A delta note, not a restated man page. It records the observed root entry at
the time of writing, the additions M2 plans, and the closed daemon registration
gap with its evidence. The M1 page
[../m1/commands/entrypoint.md](../m1/commands/entrypoint.md) is a milestone
snapshot and stays as written; the M1 man page is
[../m1/man-page.md](../m1/man-page.md).

## Observed composition

Observed from the built workspace at authoring time. The `Commands:` block is
abridged to the family list: the real output also prints a title, Usage,
Options, Examples, Exit codes, and See also, and each family carries a
description on its own row.

```
$ <binary> --help
Commands: status brief queue lanes blockers phase commit lint plan
          verify merge closeout dispatch spend retro coordinator daemon
```

Seventeen families are registered: `status`, `brief`, `queue`, `lanes`,
`blockers`, `phase`, `commit`, `lint`, `plan`, `verify`, `merge`, `closeout`,
`dispatch`, `spend`, `retro`, `coordinator`, and `daemon`. `state` and `mcp`
are absent from the listing.

```
$ <binary> daemon --help
<binary> daemon — Run and manage the resident daemon: ...
exit 0
```

## M2-planned additions

- `projects` becomes a root family: the host overview of managed checkouts.
- `attempts` joins under `dispatch` as `dispatch attempts`, the evidence
  read side.
- `events` joins the subscribe surface as the taxonomy reference; the daemon
  publishes the versioned topics.
- `spend` gains the v2 breakdowns and the reconciliation disclosure.
- `queue` keeps the delivered lease release and gains the reason-bearing entry
  removal, the `dep add` and `dep remove` grammar extension, and automatic
  removal on merge and closeout.
- `board` becomes the full cross-repository board and is mounted by M2-S4.

These additions are planned; the root listing changes only when the owning
story delivers.

## The daemon registration gap (closed)

The daemon command definition exists in the CLI composition and is registered on
every composition. The production entrypoint now composes the daemon runtime
unconditionally, so the lifecycle command is reachable at the root listing: the
observed invocation above answers its help page at exit `0`, and
`daemon start`, `stop`, `status`, `install`, and `uninstall` reach their
handlers. Issue #286 delivered the mount, and the gap is recorded here as
closed so the blueprint reader sees the current state rather than a stale
prerequisite.

The mount also unblocks the S13 subscribe surface and S17 peak pausing: both
depend on a resident daemon, and the resident path is delivered now that the
family is mounted.

## Mounting a new command

The entrypoint composes exactly the prompt-required command set and drops
extras, so a command definition existing in the edge composition is not
enough. Mounting `projects`, `events`, or `board` takes a prompt-set change
plus a help reference page per command; only then does the family appear in
root `--help`. That is why this note records the M2 additions as planned, not
as registered: the mount is the story's work, and the help reference page is
part of it.

## Where this note is read

The M1 page [../m1/commands/entrypoint.md](../m1/commands/entrypoint.md) is a
milestone snapshot. Its only amendment in this change is the bounded
DESCRIPTION correction that lists the seventeen observed families and the
absent set; this note adds no back pointer to that page and claims none.

The note is reachable from the milestone index, which lists
`m2/entrypoint-delta.md` in [../README.md](../README.md), and from the pack
index in [README.md](README.md).

Read it with the M2 command contracts it introduces:
[commands/projects.md](commands/projects.md),
[commands/attempts.md](commands/attempts.md),
[commands/events.md](commands/events.md),
[commands/spend.md](commands/spend.md),
[commands/queue.md](commands/queue.md), and
[commands/board.md](commands/board.md).
