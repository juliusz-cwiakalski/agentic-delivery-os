# closeout(1)

Status: M0 shipped (M0-S14); M1-S12 expands to the full mechanical sweep
with judgment residue. Proposed examples.

## NAME

`closeout` - one idempotent post-merge transaction with judgment
residue.

## SYNOPSIS

```
<binary> closeout <ref> [--apply]
```

## DESCRIPTION

Dry-run by default; mutating only with `--apply`. The M1 expansion
performs the full mechanical sweep: ticket to done, label sweep,
unassign, owed-flip sweep of the merged diff (feature-flag and class
strings, TODO markers, when-X-merges notes), comment-thread resolution
check, branch and worktree cleanup, checkout restore, retro-coverage
registry move, capsule completion (events plus promotion decisions),
harness telemetry capture to the event log - then emits a bounded
judgment residue list instead of requiring the coordinator to grep
diffs.

## OPTIONS

- `--apply` - mutate; without it, print the planned sweep and residue.

## OUTPUT

Text: per-step results plus `JUDGMENT RESIDUE` list. Envelope `data`:
`steps[]` (id, result), `residue[]` (item, kind, location), `capsule`
(closed, events, candidates promoted/rejected with reasons).

## EXIT STATUS

0 sweep complete (or dry-run ok); 1 residue requires attention or a
step failed with reason; 2 platform faults.

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
      { "id": "ticket-done", "result": "ok" },
      { "id": "label-sweep", "result": "ok" },
      { "id": "unassign", "result": "ok" },
      { "id": "owed-flip", "result": "ok", "detail": "2 hits flipped to owner-owed" },
      { "id": "comment-resolution", "result": "ok", "detail": "4/4 resolved" },
      { "id": "branch-worktree-cleanup", "result": "ok" },
      { "id": "capsule", "result": "ok", "detail": "events 61, candidates 3 (promoted 1, rejected 2)" }
    ],
    "residue": [
      {
        "kind": "unresolved-human-thread",
        "item": "PR thread t-77 by @reviewer-bob: rename retryPolicy?",
        "location": "https://example/PR/341#discussion_r77"
      }
    ]
  }
}
```

## ERRORS

`closeout.step.<id>.failed`, `closeout.capsule-invalid`.

## SEE ALSO

[merge.md](merge.md), [retro.md](retro.md), [spend.md](spend.md)

## HELP

`<binary> closeout --help` prints usage, options, at least one example, exit codes,
and a see-also pointer. Root `<binary> --help` and `<binary> --version` are
self-description only: zero state, network, git, or configuration reads and
zero writes. The executable is a non-installed Bun bin; see the
[man page](../man-page.md).

