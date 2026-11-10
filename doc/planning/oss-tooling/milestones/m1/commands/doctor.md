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

## Owner hold

While an owner hold is active and the provider check would otherwise be `ok`, the
check stays `ok`, adds the single non-failing annotation reason `owner-hold`, and
appends `<existing detail>; owner hold active (<source>)[: <reason>]` to the
existing bounded detail. It carries no evidence source, adds no fix hint,
verdict, summary count, condition-catalog entry, evidence source, area, or exit
change, and may co-occur with `ok`. When the combined value would exceed
`DOCTOR_MAX_DETAIL_CHARS`, the existing detail yields and the whole hold segment
is kept; it is never cut mid-word or dropped. A real provider defect keeps its
own `fail` or `unreachable` verdict and reason and does not gain `owner-hold`.
With no active hold, every machine and human byte is unchanged.

This hold detail is produced by the doctor command runtime whenever a
`DoctorComposition` is supplied; it is a command-runtime/test-harness capability.
The production composer supplies no `DoctorComposition` today, so the production
binary does not register `doctor` (a pre-existing doctor residual). In
production, `status` carries the hold in its digest, and the queue read surfaces
(`queue list`, `queue plan`, `lanes`, and `queue watch`) report it on their own
surfaces.

The hold is resolved from `<PREFIX>_OWNER_HOLD` and the fixed production-store
marker `<home>/<stateDirectoryName>/owner-hold`; there is no marker-path
override, store relocation, new flag, or exit code.
