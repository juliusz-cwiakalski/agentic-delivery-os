# doctor(1)

Status: M1 planned (M1-S3). Proposed contract.

## NAME

`doctor` - diagnose wiring problems with fix hints.

## SYNOPSIS

```
<binary> doctor [--json]
```

## DESCRIPTION

Checks repo, tracker, provider, state, and CI wiring; every failing
check names a fix hint. Stable exit codes; diagnoses and prescribes,
never repairs.

## OUTPUT

Text: check lines ok/FAIL with hints. Envelope `data`: `checks[]`
(area, verdict, detail, fixHint).

## EXIT STATUS

0 all ok; 1 at least one failing check with hint; 2 doctor itself
unable to run (classified).

## EXAMPLES

```
$ <binary> doctor --json
{
  "schemaVersion": 1,
  "runId": "r_01J8ZW5K7L",
  "exitCode": 1,
  "timing": { "started": "2026-11-18T10:20:00Z", "durationMs": 3400 },
  "data": {
    "checks": [
      { "area": "repo", "verdict": "ok", "detail": "base main-tools, clean" },
      { "area": "provider", "verdict": "fail",
        "detail": "provider-c token expired (env PROVIDER_C_TOKEN)",
        "fixHint": "refresh the token, then provider quota --provider provider-c" }
    ]
  }
}
```

## ERRORS

`doctor.check.<area>.unreachable` (fail with hint, never crash).

## SEE ALSO

[provider.md](provider.md), [state.md](state.md)
