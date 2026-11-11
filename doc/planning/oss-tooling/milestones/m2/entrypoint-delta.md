# M2 entrypoint delta: root listing changes (planned)

A delta note, not a restated man page. It records the observed root entry at
the time of writing, the additions M2 plans, and the daemon registration gap
with its evidence. The M1 page
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
  **Mounted by GH-288 (M2-S11):** `projects list` is in the prompt-required set,
  composed by the production entrypoint, advertised in root `--help`, and served
  by the M2 command page as its reference page. The remaining additions below
  stay planned.
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

## The daemon registration gap

The daemon command definition exists in the CLI composition and is mounted
only when the daemon option is enabled. The production entrypoint does not
enable it, so the lifecycle command is not reachable at the root listing: the
observed invocations above fail with `unknown flag "--help"` and
`unexpected argument "status"`, both with exit `1`.

Wiring the daemon lifecycle command into the production entrypoint is product
work outside this change; no plan document can close it. Issue #286 tracks the
daemon mount. The gap is recorded here so the blueprint reader sees it, and it
stays owned by the product surface. It is also the prerequisite where S13's
subscribe surface and S17's peak pausing depend on a resident daemon: neither
can ship a resident path before #286 lands.

## Mounting a new command

The entrypoint composes exactly the prompt-required command set and drops
extras, so a command definition existing in the edge composition is not
enough. Mounting a family takes a prompt-set change plus a help reference page
per command; only then does the family appear in root `--help`. GH-288 mounted
`projects` that way — prompt-set entry, edge composition, help entries, the M2
reference page, the coverage-inventory row and the per-command page root. The
remaining M2 additions (`events`, `board`, `dispatch attempts`, `spend` v2)
stay planned until their own stories mount them.

## Where this note is read

The M1 page [../m1/commands/entrypoint.md](../m1/commands/entrypoint.md) is a
milestone snapshot. Its only amendment in this change is the bounded
DESCRIPTION correction that lists the sixteen observed families and the absent
set; this note adds no back pointer to that page and claims none.

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
