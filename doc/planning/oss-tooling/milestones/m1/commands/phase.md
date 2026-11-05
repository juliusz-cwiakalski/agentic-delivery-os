# phase(1)

Status: M0 shipped (M0-S10); M1-S14 adds atomic record-plus-commit.
Proposed examples.

## NAME

`phase` - the only write path for phase ledger state.

## SYNOPSIS

```
<binary> phase list <ref>
<binary> phase complete <ref> <phase> [--commit]
<binary> phase reopen <ref> <phase> --reason <text>
```

## DESCRIPTION

Schema-validated, idempotent transitions. A reopen requires a reason.
With `--commit` (M1-S14), completion performs the ledger transition and
the conventional commit atomically (both land or neither; see
[commit.md](commit.md)).

## OUTPUT

Text: ledger table or transition result. Envelope `data`: `phase`,
`state` (complete, reopened), `reason`, `commitSha` (when atomic),
`atomic`.

## EXIT STATUS

0 transitioned or listed; 1 invalid phase, reopen without reason, or
atomic abort (neither landed); 2 ledger unreachable.

## EXAMPLES

```
$ <binary> phase complete GH-310 delivery --commit --json
{
  "schemaVersion": 1,
  "runId": "r_01J8ZX7U5R",
  "exitCode": 0,
  "timing": { "started": "2026-11-18T12:41:07Z", "durationMs": 3100 },
  "data": {
    "phase": "delivery",
    "state": "complete",
    "atomic": true,
    "commitSha": "7c31e9a"
  }
}
```

## ERRORS

`phase.invalid`, `phase.reopen-reason-required`,
`commit.atomic-abort`.

## SEE ALSO

[commit.md](commit.md), [lint.md](lint.md), [verify-change.md](verify-change.md)
