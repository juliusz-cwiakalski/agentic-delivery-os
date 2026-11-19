# closeout(1)

Status: Delivered M0-S14; M1-S12 (GH-240) delivered and expands to the
full mechanical sweep with judgment residue; M4-S11 (GH-349) adds the
`milestone-sync` step. Implemented contract.

## NAME

`closeout` - one idempotent post-merge transaction with judgment
residue.

## SYNOPSIS

```
<binary> closeout <ref> [--apply] [--json]
<binary> closeout --help
<binary> closeout --version
```

## DESCRIPTION

Dry-run by default; mutating only with `--apply`. One invocation computes a
deterministic thirteen-step plan and applies it only when asked. Steps are
resolved by `stepId`, never by position:

| # | Step | What it does |
|---:|---|---|
| 1 | `ticket-to-done` | Transition the work item to the delivery `done` state, or a declared gap. |
| 2 | `lifecycle-label-sweep` | Remove stale lifecycle-state labels and add `delivered` when absent. |
| 3 | `unassign` | Clear the assignee. |
| 4 | `owed-flip-sweep` | Move eligible direct dependents to owner attention. |
| 5 | `comment-resolution` | Resolve non-human delivery-request review threads. |
| 6 | `checkout-restore` | Restore the local checkout. |
| 7 | `worktree-cleanup` | Remove a delivery-owned worktree under the safety predicate. |
| 8 | `branch-cleanup` | Delete the local branch when the squash-safety predicate proves it landed. |
| 9 | `merged-diff-sweep` | Read the merged diff once for the four marker kinds and attribute hits. |
| 10 | `retro-coverage-move` | Record the retro-coverage state as a capsule event. |
| 11 | `session-compaction` | Record the pre-compaction checkpoint for attributed sessions. |
| 12 | `milestone-sync` | Verify the declared milestone against the provider-asserted attachment, evaluate the exit review over one bounded page, and close through one read-back-verified `close-milestone` operation — or withhold. |
| 13 | `capsule` | Validate the change capsule, record promotion decisions, and append the terminal close. |

After the writes, and still inside the fence the transaction holds, an apply run
retires the work item's queue entry with reason `landed` as a non-step
disclosure; it changes no step outcome and no exit code.

The milestone step never guesses a target. An absent or non-conforming
declaration and a declaration whose canonical `M<n>: <title>` does not equal the
observed attachment's are `skipped-noop` with one residue item; a declaration of
`none` is `skipped-gap`; an open attached ticket, an unknown record state, an
unavailable read, or a page whose truncation marker says the set was not fully
observed withholds closure as `skipped-noop` plus one `milestone-sync-withheld`
residue item. The withheld residue is informational: it is reported like any
other item but does not raise the attention exit on its own, so an apply whose
only residue is withheld closures exits 0; any other residue kind exits 1. A
close that did not land gates at `closeout.write.failed`, exit 2, with no capsule
close. Plan mode performs the read and renders the verdict with zero writes.

## OPTIONS

- `--apply` - mutate; without it, print the planned sweep and residue.
- `--json` - global flag: emit the machine envelope instead of the human digest.

## OUTPUT

Text: per-step results plus a `JUDGMENT RESIDUE` section when residue remains.
Envelope `data` (`delivery.closeout.v1`): `mode`, resolved `baseRef`, `steps[]`
(`stepId`, `outcome`, `operations[]`, optional bounded `detail`), summary counts,
truncation markers, optional `residue[]` (`item`, `kind`, `location`), optional
applied `capsule` (`closed`, `events`, `candidates[]`), and the additive
non-step `queueRemoval` block. Residue kinds are `unresolved-human-thread`,
`ambiguous-flip-hit`, `capsule-event-gap`, `review-verdict-unreadable`,
`retro-coverage-unavailable`, `worktree-retained`, `session-attribution-gap`,
`milestone-sync-withheld`, and the `capsule-cap-reached` sentinel.

## EXIT STATUS

`0` sweep complete with no residue, or an apply whose only residue is the
informational `milestone-sync-withheld` items (still reported); `1` residue of any
other kind requires attention through the data-bearing `attention` class; `2` a
platform fault or a failed write, including a milestone close that did not land
(`closeout.write.failed`).

## EXAMPLES

```
$ <binary> closeout GH-301 --apply --json
{
  "schemaVersion": 1,
  "runId": "r_01J8ZQ4K2S",
  "exitCode": 1,
  "timing": { "started": "2026-11-18T15:00:00Z", "durationMs": 12000 },
  "data": {
    "steps": [
      { "id": "ticket-to-done", "result": "applied" },
      { "id": "lifecycle-label-sweep", "result": "applied" },
      { "id": "unassign", "result": "satisfied" },
      { "id": "owed-flip-sweep", "result": "applied", "detail": "2 hits flipped to owner-owed" },
      { "id": "comment-resolution", "result": "applied", "detail": "4/4 resolved" },
      { "id": "worktree-cleanup", "result": "applied" },
      { "id": "branch-cleanup", "result": "applied" },
      { "id": "milestone-sync", "result": "skipped-noop", "detail": "closure-withheld" },
      { "id": "capsule", "result": "applied", "detail": "events 61, candidates 3 (promoted 1, rejected 2)" }
    ],
    "residue": [
      {
        "kind": "unresolved-human-thread",
        "item": "PR thread t-77 by @reviewer-bob: rename retryPolicy?",
        "location": "thread:t-77"
      },
      {
        "kind": "milestone-sync-withheld",
        "item": "closure-withheld",
        "location": "GH-301"
      }
    ]
  }
}
```

## ERRORS

`closeout.target.unobserved`, `closeout.target.ambiguous`,
`closeout.write.failed`, `closeout.branch.unsafe`, `closeout.capsule-invalid`,
and the `closeout.step.<id>.failed` family, whose step slot is validated against
the effective thirteen-step set.

## SEE ALSO

[merge.md](merge.md), [retro.md](retro.md), [spend.md](spend.md)

## HELP

`<binary> closeout --help` prints usage, options, at least one example, exit codes,
and a see-also pointer. Root `<binary> --help` and `<binary> --version` are
self-description only: zero state, network, git, or configuration reads and
zero writes. The executable is a non-installed Bun bin; see the
[man page](../man-page.md).

