# plan(1)

Status: M1 planned (M1-S13). Proposed contract.

## NAME

`plan` - validate, diff, and overlap-check machine-readable delivery
plans.

## SYNOPSIS

```
<binary> plan validate <ref>
<binary> plan diff <ref> [--against <base>]
<binary> plan overlap <refA> <refB>
```

## DESCRIPTION

Operates on the machine-readable delivery plan (YAML): per-phase declared
scope (files, packages, folders), done-artifacts, repo leases, weight
class, declared interactions, and ceremony tier as data. `validate` is
the ready-for-development gate; `overlap` answers sequence versus
parallel mechanically.

## OPTIONS

- `<ref>` - change reference whose plan is inspected.
- `--against <base>` - base for `diff` (default: the delivery base).

## OUTPUT

Text: `verdict=`, overlapping paths or per-phase findings. Envelope
`data`: `verdict` (valid, invalid, parallel, run-in-sequence),
`perPhase` (scope, artifacts, leases, weight, interactions, tier),
`overlappingPaths`, `ordering`, `readyForDevelopment`.

## EXIT STATUS

0 valid or parallel; 1 invalid schema, unvalidatable plan, or sequence
verdict with paths named (a verdict, not a failure).

## EXAMPLES

Overlap answers sequence with paths:

```
$ <binary> plan overlap GH-306 GH-307 --json
{
  "schemaVersion": 1,
  "runId": "r_01J8ZL6T1W",
  "exitCode": 1,
  "timing": { "started": "2026-11-18T11:20:00Z", "durationMs": 96 },
  "data": {
    "verdict": "run-in-sequence",
    "ordering": "GH-306-before-GH-307",
    "overlappingPaths": [
      "packages/core/src/contracts/queue.ts",
      "doc/spec/features/feature-scheduler.md"
    ],
    "reason": "shared-contract-files"
  }
}
```

Invalid plan, classified with the missing field:

```
$ <binary> plan validate GH-308 --json | cat
{"data":{"verdict":"invalid","errors":[{"code":"plan.schema.invalid","phase":6,"missing":"scope.files"}],"readyForDevelopment":false}}
```

## ERRORS

`plan.schema.invalid`, `plan.scope.undeclared-paths`,
`plan.tier.unknown`.

## SEE ALSO

[queue.md](queue.md), [commit.md](commit.md)
