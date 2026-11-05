# commit(1)

Status: M1 planned (M1-S14; design per concepts/automated-commit.md).
Proposed contract.

## NAME

`commit` - compute and land a conventional commit from the working tree
plus change context.

## SYNOPSIS

```
<binary> commit <ref> [--phase <phase>] [--dry-run]
```

## DESCRIPTION

Deterministic skeleton plus one constrained model call for the language
parts (subject; body only when it earns its place); inference transports
behind a seam; marked template fallback when no model is available.
Staging is precise (never untracked strays; privacy-scanned). With
`--phase`, the ledger transition and the commit land atomically through
`phase complete` semantics (both or neither). Never runs inside a
delivery session.

## OPTIONS

- `<ref>` - change reference for context (ref, current phase, plan
  phase).
- `--phase <phase>` - atomic record-plus-commit for the completed
  phase's pending work.
- `--dry-run` - print the computed message and staging set, change
  nothing.

## OUTPUT

Text: `subject=`, `staged=` count and file list, `ledger=` transition,
`commit=` SHA. Envelope `data`: `subject`, `body`, `stagedFiles`,
`ledgerTransition`, `commitSha`, `atomic` (true when phase mode).

## EXIT STATUS

0 committed (or dry-run ok); 1 staging blocked, commitlint failure,
atomic abort (neither landed); 2 platform faults.

## EXAMPLES

Atomic phase completion (SC-M1-12):

```
$ <binary> commit GH-310 --phase delivery --json
{
  "schemaVersion": 1,
  "runId": "r_01J8ZM9X5B",
  "exitCode": 0,
  "timing": { "started": "2026-11-18T12:41:07Z", "durationMs": 3100 },
  "data": {
    "subject": "feat(GH-310): scheduler lease acquisition and hand-off",
    "body": null,
    "stagedFiles": [
      "packages/core/src/scheduler/lease.ts",
      "packages/core/src/scheduler/handoff.ts",
      "packages/core/src/scheduler/index.ts"
    ],
    "ledgerTransition": "delivery:complete",
    "commitSha": "7c31e9a",
    "atomic": true
  }
}
```

Dry-run from a script (minified by auto; stray file visible, unstaged):

```
$ <binary> commit GH-310 --dry-run --json | cat
{"schemaVersion":1,"runId":"r_01J8ZMAZ7C","exitCode":0,"timing":{"started":"2026-11-18T12:43:55Z","durationMs":820},"data":{"subject":"feat(GH-310): scheduler lease acquisition and hand-off","stagedFiles":["packages/core/src/scheduler/lease.ts"],"untrackedNotStaged":["tmp/scratch-notes.md"],"atomic":false,"dryRun":true}}
```

## ERRORS

`commit.staging-blocked-untracked`, `commit.commitlint-failed`,
`commit.atomic-abort` (neither landed; classified),
`commit.model-unavailable-template-fallback` (marked on the commit).

## SEE ALSO

[phase.md](phase.md), [plan.md](plan.md)
