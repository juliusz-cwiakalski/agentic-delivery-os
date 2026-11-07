# plan(1)

Status: M1-S13 shipped (GH-226); M1 milestone planned. Delivered
contract.

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

Operates on the versioned machine-readable delivery plan
(`delivery.plan.v1`, `chg-<ref>-plan.yaml`): per-phase declared scope
(files, packages, folders), typed done-artifacts, repo leases, weight
class, declared interactions, and ceremony tier as data. `validate` is
the ready-for-development gate; `overlap` answers sequence versus
parallel mechanically with the overlapping paths named; `diff` reports
declared scope against the actual branch diff.

A legacy `chg-<ref>-plan.md` stays readable during the transition and is
answered with the classified `plan.format.legacy-markdown` verdict; it
is never schema-valid. When both files exist, the YAML plan wins and the
verdict discloses the artifact it read. All three subcommands are
read-only and deterministic.

## OPTIONS

- `<ref>` - change reference whose plan is inspected.
- `--against <base>` - base for `diff` (default: `main-tools`).

## OUTPUT

Text: `verdict=`, `artifact=`, `tier=`, `readyForDevelopment=`, per-error
`error=<code> field=<field>`, `overlapping=`, `reason=`, and
`ordering=` lines; `truncated=true` with the total count when a list is
bounded.

Envelope `data` per subcommand:

- `validate`: `verdict` (`valid | invalid`), `readyForDevelopment`,
  `perPhase[]` (`id`, `title`, `kind`, `leaseClass`, `scope`, `leases`,
  `interactions`, `tier`, optional `doneArtifacts`, optional
  `weightClass`), `errors[]` (`code`, `field`, `problem`, optional
  `phase`, optional `detail`), `truncated`, `totalErrors`, and, when
  read, `artifact` (`kind`, `path`); when parsed, `schemaVersion`,
  `tier`, and `tierDeclaration`.
- `diff`: `verdict` (`within | findings`), `against`, `entries[]`
  (`path`, `classification`, optional `phase`), `findings[]`,
  `truncated`, `totalEntries`.
- `overlap`: `verdict` (`parallel | run-in-sequence`), `planA`, `planB`,
  `overlappingPaths[]`, optional `ordering`, optional `reason`
  (`shared-contract-files | shared-paths`), `truncated`,
  `totalOverlappingPaths`.

## EXIT STATUS

0 valid and ready for development, parallel, or fully within declared
scope; 1 invalid schema, unvalidatable plan, diff findings, or
run-in-sequence verdict with paths named (a verdict, not a failure).
Verdict data is always present in the envelope, so consumers branch on
data rather than on the exit code alone.

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
    "planA": "GH-306",
    "planB": "GH-307",
    "ordering": "GH-306-before-GH-307",
    "overlappingPaths": [
      "packages/core/src/contracts/queue.ts",
      "doc/spec/features/feature-scheduler.md"
    ],
    "reason": "shared-contract-files",
    "truncated": false,
    "totalOverlappingPaths": 2
  }
}
```

Invalid plan, classified with the phase and field:

```
$ <binary> plan validate GH-308 --json | cat
{"data":{"verdict":"invalid","readyForDevelopment":false,"perPhase":[],"errors":[{"code":"plan.schema.invalid","field":"scope.files","problem":"missing","phase":6,"detail":"phase declares no scope"}],"truncated":false,"totalErrors":1,"artifact":{"kind":"yaml","path":"chg-GH-308-plan.yaml"}}}
```

Legacy markdown plan, classified as the transition format:

```
$ <binary> plan validate GH-309 --json | cat
{"data":{"verdict":"invalid","readyForDevelopment":false,"perPhase":[],"errors":[{"code":"plan.format.legacy-markdown","field":"artifact","problem":"invalid","detail":"legacy markdown plan chg-GH-309-plan.md"}],"truncated":false,"totalErrors":1,"artifact":{"kind":"markdown","path":"chg-GH-309-plan.md"}}}
```

## ERRORS

`plan.schema.invalid`, `plan.scope.undeclared-paths`,
`plan.tier.unknown`, `plan.format.legacy-markdown`,
`plan.artifact.missing`.

## SEE ALSO

[lint.md](lint.md), [queue.md](queue.md), [commit.md](commit.md)

## HELP

`<binary> plan --help` prints usage, options, at least one example, exit codes,
and a see-also pointer. Root `<binary> --help` and `<binary> --version` are
self-description only: zero state, network, git, or configuration reads and
zero writes. The executable is a non-installed Bun bin; see the
[man page](../man-page.md).

