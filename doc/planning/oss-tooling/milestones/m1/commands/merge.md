# merge(1)

Status: M1 planned (M1-S4). Proposed contract; scenarios SC-M1-01..04.

## NAME

`merge` - the merge transaction: gates fresh, squash, landing verified.

## SYNOPSIS

```
<binary> merge <ref> [--dry-run]
```

## DESCRIPTION

Verifies the full gate set fresh (config-declared data; CI on the pushed
SHA, lifecycle finalization, push parity, owner-gate scan, squash
preflight; the freshness bound covers tracker state), then lands as one
squash commit and verifies the landing. A refusal names the failed gate
with inline evidence. Owner-gate classification is policy-as-data;
overrides are recorded waivers. An explicit coordinator action: the
daemon can prepare and queue but never fire a merge.

## OPTIONS

- `<ref>` - change or PR reference.
- `--dry-run` - run all gates and print the verdict; land nothing.

## OUTPUT

Text: per-gate `ok`/refused lines with citations, then `result=` and
`squash=`. Envelope `data`: `result` (merged, refused), `squashSha`,
`gates[]` (id, verdict, evidence), `trackerFreshness`, `waivers[]`.

## EXIT STATUS

0 merged; 1 refused (named gate, inline evidence; a verdict, not a
crash); 2 platform faults or state-unverified.

## EXAMPLES

Clean landing:

```
$ <binary> merge GH-301 --json
{
  "schemaVersion": 1,
  "runId": "r_01J8ZN2Q9E",
  "exitCode": 0,
  "timing": { "started": "2026-11-18T13:05:44Z", "durationMs": 8412 },
  "data": {
    "result": "merged",
    "squashSha": "a1b2c3d",
    "gates": [
      { "id": "lifecycle-finalization", "verdict": "ok", "evidence": "phases 11/11, variant full" },
      { "id": "ci-on-pushed-sha", "verdict": "ok", "evidence": "pipeline 44821, 12/12 green, verified 4m ago" },
      { "id": "tracker-freshness", "verdict": "ok", "evidence": "ticket in review, checked 1s ago" }
    ],
    "waivers": []
  }
}
```

Refusal with inline evidence (SC-M1-02):

```
$ <binary> merge GH-302 --json | cat
{"data":{"result":"refused","gates":[{"id":"ci-on-pushed-sha","verdict":"failed","evidence":"gates verified 31m ago exceeds bound 30m; new red job 44832 on head sha 9f21c0e"}],"remediation":"re-run verify gates"}}

(The refusal is exit 1 via the process; the trimmed line keeps the
verdict and evidence. Use `--verbose` for the full envelope.)
```

## ERRORS

`merge.gate.<gate-id>.failed`, `merge.gates-stale`,
`merge.owner-gate-override-without-waiver`.

## SEE ALSO

[verify-gates.md](verify-gates.md), [verify-deploy.md](verify-deploy.md),
[closeout.md](closeout.md)
