# commit(1)

Status: M1-S14 shipped (GH-227); M1 milestone planned. Delivered
contract.

## NAME

`commit` - compute and land a conventional commit from the working tree
plus change context.

## SYNOPSIS

```
<binary> commit [<ref>] [--phase <phase>] [--dry-run]
```

## DESCRIPTION

Computes the verifiable parts of the message (ref, type, scope, breaking
default) deterministically and asks for the language part with exactly
one constrained model call. Inference transports sit behind a seam and are
tried in order: core-owned inference through the provider route, then a
headless harness one-shot in a temporary empty project context, then a
deterministic template marked `messageSource: template`. A repository with
no configured transport still lands a marked template commit.

Staging is precise: tracked pending work is staged and scope drift is
disclosed; untracked files are staged only inside the declared plan scope
(the plan phases the lifecycle phase maps to — `delivery` covers every
delivery-kind phase, `delivery_planning` the planning-kind phases; a
lifecycle phase with no correspondence degrades to `plan-absent` instead
of borrowing another phase's scope); untracked material outside every
declared scope is a stray and is never staged. The deterministic safety pass (secret scan on content and
filenames, forbidden-path exclusions, binary size guard) runs before any
transport is selected and before anything is staged, and it fails closed.

The command never runs inside a delivery session. Use it from a plain
shell, a script, or a subagent boundary.

`phase complete` is the transition-centric entry to the same atomic act: it
lands the ledger transition and the conventional commit together or
neither by default, and the atomic record carries the landed commit SHA so
a re-run proves commit presence from the record itself, with telemetry as
corroboration (`--no-commit` records the transition alone; the project key
`commit.phaseCommit: false` disables the commit per project). See
[phase.md](phase.md).

## OPTIONS

- `[<ref>]` - change reference for context. Omitted, the ref is resolved
  from the checkout (the branch name carries it); an unresolvable ref is
  `input.value.rejected`.
- `--phase <phase>` - atomic record-plus-commit for that phase's pending
  work, using the plan scope the lifecycle phase maps to; combines with
  `--dry-run`.
- `--dry-run` - print the computed message and staging set, including
  exclusions; stage nothing, commit nothing, append no ledger record, emit
  no telemetry.

## OUTPUT

Text: `subject:`, optional `body:`, `staged:`, the four exclusion groups
(`forbidden`, `oversized binaries`, `stray, untracked`, `generated
noise`), `scope drift (staged, tracked)`, `message source:`, `transport:`,
`commit:`, `atomic completion: true` when phase mode, and `telemetry
emission: not recorded` when the event could not be appended. A dry run
starts with `dry run (nothing changed)`.

Envelope `data`: `changeRef`, `subject`, optional `body`, `stagedFiles`,
`excluded` (`forbiddenPaths`, `oversizedBinaries`, `untrackedNotStaged`,
`noiseStripped`, `scopeDrift`), optional `commitSha`, `messageSource`
(`model` | `template`), `transport` (`core-inference` | `harness-one-shot`
| `none`), `atomic` (true in phase mode), optional `ledgerTransition`
(`{ phase, timestamp }` from a compiled completion, or `{ phase,
noOp: true }` when the phase-completion path is not composed or on a dry
run), optional `dryRun`, optional `commitSkipped:
"skipped-no-pending-work"` on a phase-mode dry run with nothing stageable,
`safety` (`completed`, `findings`), `telemetry` (`emitted`, optional
`detail`), and optional `degradedScope: "plan-absent"` when no plan
artifact or no lifecycle-to-plan-phase correspondence supplied the scope.

A phase-mode completion that lands the transition alone (nothing stageable
is pending) or is an already-completed no-op returns success with no
`commitSha`; `atomic` stays true in phase mode and `ledgerTransition` cites
the phase.

## EXIT STATUS

0 committed (or dry-run ok, or the phase completion landed its transition
alone); 1 staging blocked, commitlint failure, safety STOP (suspected
secret), session-context refusal; 2 platform fault (safety scan
unavailable, atomic abort with neither side landed).

## EXAMPLES

Atomic phase completion:

```
$ <binary> commit GH-310 --phase delivery --json
{
  "schemaVersion": 1,
  "runId": "r_01J8ZM9X5B",
  "exitCode": 0,
  "timing": { "started": "2026-11-18T12:41:07Z", "durationMs": 3100 },
  "data": {
    "changeRef": "GH-310",
    "subject": "feat(GH-310): scheduler lease acquisition and hand-off",
    "stagedFiles": [
      "packages/core/src/scheduler/handoff.ts",
      "packages/core/src/scheduler/index.ts",
      "packages/core/src/scheduler/lease.ts"
    ],
    "excluded": {
      "forbiddenPaths": [],
      "oversizedBinaries": [],
      "untrackedNotStaged": ["tmp/scratch-notes.md"],
      "noiseStripped": [],
      "scopeDrift": []
    },
    "commitSha": "7c31e9a",
    "messageSource": "model",
    "transport": "core-inference",
    "atomic": true,
    "ledgerTransition": { "phase": "delivery", "timestamp": "2026-11-18T12:41:07Z" },
    "safety": { "completed": true, "findings": [] },
    "telemetry": { "emitted": true }
  }
}
```

Dry-run from a script (minified by auto; stray file visible, unstaged):

```
$ <binary> commit GH-310 --dry-run --json | cat
{"schemaVersion":1,"runId":"r_01J8ZMAZ7C","exitCode":0,"timing":{"started":"2026-11-18T12:43:55Z","durationMs":820},"data":{"changeRef":"GH-310","subject":"feat(GH-310): scheduler lease acquisition and hand-off","stagedFiles":["packages/core/src/scheduler/lease.ts"],"excluded":{"forbiddenPaths":[],"oversizedBinaries":[],"untrackedNotStaged":["tmp/scratch-notes.md"],"noiseStripped":[],"scopeDrift":[]},"messageSource":"model","transport":"core-inference","atomic":false,"dryRun":true,"safety":{"completed":true,"findings":[]},"telemetry":{"emitted":false}}}
```

No inference transport configured; the template lands, visibly marked:

```
$ <binary> commit GH-310 --json | cat
{"schemaVersion":1,"runId":"r_01J8ZMB43D","exitCode":0,"timing":{"started":"2026-11-18T12:45:12Z","durationMs":1600},"data":{"changeRef":"GH-310","subject":"feat(GH-310): scheduler lease acquisition and hand-off","stagedFiles":["packages/core/src/scheduler/lease.ts"],"excluded":{"forbiddenPaths":[],"oversizedBinaries":[],"untrackedNotStaged":[],"noiseStripped":[],"scopeDrift":[]},"commitSha":"9d10b7c","messageSource":"template","transport":"none","atomic":false,"safety":{"completed":true,"findings":[]},"telemetry":{"emitted":true}}}
```

## STAGING AND ORDERING

The staging set is the mapped plan-phase scope union the change folder; a
plan-absent standalone commit may stage the change folder; unrelated strays
are never staged. For an atomic completion the pm-notes transition is written
before the commit act and the pre-write bytes are restored if the act fails.

## ERRORS

`commit.staging-blocked-untracked`, `commit.commitlint-failed`,
`commit.safety.secret-suspected`, `commit.safety.scan-unavailable`,
`commit.atomic-abort` (neither side landed; classified). The commit surface
runs inside a delivery session. A template fallback is success evidence
(`messageSource: template`), never an error. Broken grammar resolves
through `input.value.rejected`.

## SEE ALSO

[phase.md](phase.md), [plan.md](plan.md)

## HELP

`<binary> commit --help` prints usage, options, at least one example, exit codes,
and a see-also pointer. Root `<binary> --help` and `<binary> --version` are
self-description only: zero state, network, git, or configuration reads and
zero writes. The executable is a non-installed Bun bin; see the
[man page](../man-page.md).

