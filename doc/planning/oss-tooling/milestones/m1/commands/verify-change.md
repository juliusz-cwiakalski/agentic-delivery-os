# verify change(1)

Status: M0 shipped (M0-S8). Shipped behavior summarized; envelope
examples proposed for review.

## NAME

`verify change` - verify a delivery against the phase ledger and
classify the result tuple.

## SYNOPSIS

```
<binary> verify change <ref>
```

## DESCRIPTION

Reads the change's pm-notes ledger (variant-aware: full or LITE phase
set), verifies it against artifacts, and classifies the delivery result
tuple. Malformed notes are classified with a code, never a crash.

## OUTPUT

Text: per-phase completion and `result=`. Envelope `data`: `result`
(merged, blocked, pr-open, pr-open-unverified, failed, finished,
max-restarts, state-unverified, partial, noop-lane-permission,
noop-lane-nothing-to-do), `phaseLedger`, `missingPhases[]`,
`variant`.

## EXIT STATUS

0 verified complete; 1 missing phases named; 2 state-unverified
(never exit-0 silence).

## EXAMPLES

```
$ <binary> verify change GH-301 --json
{
  "schemaVersion": 1,
  "runId": "r_01J8ZN7W5H",
  "exitCode": 0,
  "timing": { "started": "2026-11-18T13:30:00Z", "durationMs": 340 },
  "data": {
    "result": "pr-open",
    "variant": "full",
    "phaseLedger": { "completed": 11, "total": 11 },
    "missingPhases": []
  }
}
```

Incomplete ledger names the missing phases:

```
$ <binary> verify change GH-309 --json | cat
{"data":{"result":"blocked","variant":"full","phaseLedger":{"completed":9,"total":11},"missingPhases":["system_spec_update","pr_creation"]}}
```

## ERRORS

`verify.notes.malformed` (classified, never a crash),
`verify.variant.unknown`.

## SEE ALSO

[verify-gates.md](verify-gates.md), [lint.md](lint.md),
[merge.md](merge.md)
