# verify deploy(1)

Status: M1 planned (M1-S4). Proposed contract; scenario SC-M1-05.

## NAME

`verify deploy` - deploy verification by job trace, never job status.

## SYNOPSIS

```
<binary> verify deploy <ref>
```

## DESCRIPTION

Verifies a deployment by reading the deploy job's execution trace
(steps executed, artifacts produced), not its status fields. A pipeline
created but never run reads unknown, never green; stale caches never
count as evidence.

## OUTPUT

Text: `verdict=` (verified, unknown, failed) with trace summary.
Envelope `data`: `verdict`, `trace` (jobId, steps[] with status,
artifacts[]), `reason` when unknown or failed.

## EXIT STATUS

0 verified; 1 unknown or failed verdict with reason; 2 platform faults.

## EXAMPLES

```
$ <binary> verify deploy GH-301 --json
{
  "schemaVersion": 1,
  "runId": "r_01J8ZP6G8N",
  "exitCode": 0,
  "timing": { "started": "2026-11-18T14:30:00Z", "durationMs": 1500 },
  "data": {
    "verdict": "verified",
    "trace": {
      "jobId": "deploy-44833",
      "steps": [
        { "name": "build", "status": "succeeded" },
        { "name": "publish", "status": "succeeded" },
        { "name": "smoke", "status": "succeeded" }
      ],
      "artifacts": ["registry:app@9f21c0e"]
    }
  }
}
```

Created-but-never-ran reads unknown:

```
$ <binary> verify deploy GH-305 --json | cat
{"schemaVersion":1,"runId":"r_01J8ZP7H9P","exitCode":1,"timing":{"started":"2026-11-18T14:33:41Z","durationMs":900},"data":{"verdict":"unknown","trace":{"jobId":"deploy-44840","steps":[],"artifacts":[]},"reason":"pipeline-created-never-ran"}}
```

## ERRORS

`verify.deploy.trace-missing`, `verify.deploy.status-stale`.

## SEE ALSO

[verify-gates.md](verify-gates.md), [merge.md](merge.md)
