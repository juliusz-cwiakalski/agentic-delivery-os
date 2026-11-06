# phase(1)

Status: M0-S10 shipped; M1-S14 shipped (GH-227) — atomic
record-plus-commit. Delivered contract.

## NAME

`phase` - the only write path for phase ledger state.

## SYNOPSIS

```
<binary> phase list <ref>
<binary> phase complete <ref> <phase> [--no-commit]
<binary> phase reopen <ref> <phase> <reason>
```

## DESCRIPTION

Schema-validated, idempotent transitions with a nine-row idempotency
matrix. Grammar is validated before any state inspection: an unknown phase
id, a reopen without a reason, or a surplus argument is
`input.value.rejected`. A reopen appends a transition carrying the exact
reason; reopening a phase that is not completed is a no-op that appends
nothing.

A completion lands the ledger transition and the conventional commit
atomically **by default** — both land or neither — computed from the
working tree and the phase's declared plan scope. `--no-commit` records the
transition alone for that call, and the project key
`commit.phaseCommit: false` disables the commit for the project. A
completion with no stageable pending work lands the transition alone; an
already-completed phase is a no-op that appends nothing and creates no
commit. A re-run after an interruption converges on the durable
(record, commit) delta: it completes exactly the missing side, never
duplicates a record, and never manufactures a commit. See
[commit.md](commit.md).

The completion refuses to run inside a delivery session
(`commit.session.context-refused`), with or without `--no-commit`; `list`
and `reopen` are unaffected.

## OPTIONS

- `<ref>` - change reference whose ledger is read or written.
- `<phase>` - canonical lifecycle phase id.
- `--no-commit` - record the completion without landing a commit (per
  call; it never overrides an explicit project disable).
- `<reason>` - reopen reason, required and non-empty.

## OUTPUT

Text: ledger table for `list`; the transition result for `complete` and
`reopen`.

Envelope `data`:

- `list`: `schemaVersion`, `changeRef`, `phases` (one entry each with
  `started` and `completed`, both nullable), `verifiedEmpty`, and
  `evidence` (`class`, `target`, `recordCount`, `verification`).
- `complete` / `reopen`: `changeRef`, `phase`, `operation`, `outcome`
  (`landed` | `no-op`), `timestamp`, `variant`, optional `reason`, optional
  `advisory` (`earlier-open` with `phases`, or `outside-required-set` with
  `phase` and `variant`), and `evidence` (`outcome`, plus `basis`,
  `completedAt`, `reason`, or `reconciliation` as applicable).
- Completion adds `atomic`, optional `commitSha`, optional `commitSkipped`
  (`opt-out-flag` | `config-disabled` | `skipped-no-pending-work` | `no-op`
  | `interrupted-atomic-no-pending-work`), optional `reconciliation`
  (`completed`: `commit` | `transition` | `intentional-no-op` |
  `existing-completion`, optional `basis`, optional `detail`), and, when a
  commit landed, `commit` (message `subject`, `stagedFiles`, `excluded`,
  `messageSource`, `transport`, `safety`, `telemetry`). On a landed
  completion the same message facts also appear at the top level
  (`subject`, optional `body`, `stagedFiles`, `excluded`, `messageSource`,
  `transport`, `safety`, `telemetry`).

## EXIT STATUS

0 listed, transitioned, or completed (with or without a commit); 1 invalid
phase, reopen without a reason, session-context refusal, staging blocked,
commitlint failure, safety STOP; 2 ledger unreachable, safety scan
unavailable, atomic abort with neither side landed.

## EXAMPLES

Default atomic completion:

```
$ <binary> phase complete GH-310 delivery --json
{
  "schemaVersion": 1,
  "runId": "r_01J8ZX7U5R",
  "exitCode": 0,
  "timing": { "started": "2026-11-18T12:41:07Z", "durationMs": 3100 },
  "data": {
    "changeRef": "GH-310",
    "phase": "delivery",
    "operation": "complete",
    "outcome": "landed",
    "timestamp": "2026-11-18T12:41:07Z",
    "variant": "full",
    "atomic": true,
    "commitSha": "7c31e9a",
    "subject": "feat(GH-310): scheduler lease acquisition and hand-off",
    "stagedFiles": ["packages/core/src/scheduler/lease.ts"],
    "excluded": {
      "forbiddenPaths": [],
      "oversizedBinaries": [],
      "untrackedNotStaged": ["tmp/scratch-notes.md"],
      "noiseStripped": [],
      "scopeDrift": []
    },
    "messageSource": "model",
    "transport": "core-inference",
    "safety": { "completed": true, "findings": [] },
    "telemetry": { "emitted": true },
    "evidence": { "outcome": "landed" }
  }
}
```

Transition alone, because nothing stageable is pending:

```
$ <binary> phase complete GH-310 delivery --json | cat
{"schemaVersion":1,"runId":"r_01J8ZXB2K9","exitCode":0,"timing":{"started":"2026-11-18T12:47:31Z","durationMs":220},"data":{"changeRef":"GH-310","phase":"delivery","operation":"complete","outcome":"landed","timestamp":"2026-11-18T12:47:31Z","variant":"full","atomic":false,"commitSkipped":"skipped-no-pending-work","evidence":{"outcome":"landed","basis":"skipped-no-pending-work"}}}
```

Re-run of a completion that recorded the transition alone: an intentional
no-op that cites the stored basis and creates no commit.

## ERRORS

`input.value.rejected`, `lint.*` (post-transition document conformance),
`state.*` (ledger failures), `commit.staging-blocked-untracked`,
`commit.commitlint-failed`, `commit.safety.secret-suspected`,
`commit.safety.scan-unavailable`, `commit.atomic-abort`,
`commit.session.context-refused`.

## SEE ALSO

[commit.md](commit.md), [lint.md](lint.md), [verify-change.md](verify-change.md)
