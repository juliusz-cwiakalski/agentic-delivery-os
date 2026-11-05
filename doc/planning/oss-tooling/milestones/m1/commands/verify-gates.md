# verify gates(1)

Status: M0 shipped (M0-S9); M1-S4 extends the set to config-declared
gates. Proposed examples.

## NAME

`verify gates` - evaluate all merge gates with citations.

## SYNOPSIS

```
<binary> verify gates <ref>
```

## DESCRIPTION

Runs the local gate battery for a change or PR: lifecycle finalization
(variant-aware), CI green on the pushed commit, push parity, owner-gate
scan, squash preflight, plus repo-declared gates from config (versioned
data). Every verdict cites its evidence. Catches red pipelines, missing
jobs, and vacuous greens.

## OUTPUT

Text: one line per gate, `ok` or `failed` with the citation. Envelope
`data`: `overall` (pass, fail), `gates[]` (id, verdict, evidence refs:
pipeline id, SHA, tracker state at check time).

## EXIT STATUS

0 all gates pass; 1 a gate failed with citation; 2 platform faults or
state-unverified.

## EXAMPLES

```
$ <binary> verify gates GH-301 --json
{
  "schemaVersion": 1,
  "runId": "r_01J8ZP1B3K",
  "exitCode": 0,
  "timing": { "started": "2026-11-18T14:00:00Z", "durationMs": 2100 },
  "data": {
    "overall": "pass",
    "gates": [
      { "id": "lifecycle-finalization", "verdict": "ok", "evidence": "phases 11/11" },
      { "id": "ci-on-pushed-sha", "verdict": "ok", "evidence": "pipeline 44821 on 9f21c0e" },
      { "id": "push-parity", "verdict": "ok", "evidence": "local==remote" },
      { "id": "owner-gate-scan", "verdict": "ok", "evidence": "no unanswered asks" },
      { "id": "squash-preflight", "verdict": "ok", "evidence": "non-empty diff, base correct" }
    ]
  }
}
```

Vacuous green caught (missing job):

```
$ <binary> verify gates GH-305 --json | cat
{"schemaVersion":1,"runId":"r_01J8ZP2C5L","exitCode":1,"timing":{"started":"2026-11-18T14:04:18Z","durationMs":1980},"data":{"overall":"fail","gates":[{"id":"ci-on-pushed-sha","verdict":"failed","evidence":"head pipeline 44829 has 9/10 expected jobs; job ts-tests absent"}]}}
```

## ERRORS

`verify.gate.<id>.failed`, `verify.ci.vacuous-green`,
`verify.ci.job-missing`.

## SEE ALSO

[verify-change.md](verify-change.md), [merge.md](merge.md)
