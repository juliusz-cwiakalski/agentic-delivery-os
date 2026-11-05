# status(1)

Status: M0 shipped (M0-S6); M1-S10 expands to attention-state coverage.
Proposed examples.

## NAME

`status` - one bounded, ranked digest of the delivery world; the first
call of every session.

## SYNOPSIS

```
<binary> status [--repo <path>]... [--watch] [--json]
```

## DESCRIPTION

Artifact-verified collectors render grouped, ranked, deduplicated
sections (four red CI findings on mains is one job, not four) with
stable finding codes. M1 expansion adds attention-state coverage: lanes
delivering versus idle-with-reason, ready-to-merge as an action list,
parked items with conditions, owner-gate ages, spend summary, typed
questions. `--watch` subscribes to bounded live frames through the
daemon control socket; degraded to state polling (declared) when the
daemon is down. Partial collection is reported in-band, never silent.

## OUTPUT

Text: sections in fixed order, findings with codes. Envelope `data`:
`sections` per collector with `state` (observed, degraded, unknown,
unavailable, not-delivered), `findings[]` (code, severity, evidence,
action), `readyToMerge[]`, `questions[]`, `degraded` flag.

## EXIT STATUS

0 digest rendered (degraded sections still exit 0, declared); 1 a
finding demands action; 2 collection impossible (classified).

## EXAMPLES

```
$ <binary> status --json
{
  "schemaVersion": 1,
  "runId": "r_01J8ZR8M6T",
  "exitCode": 0,
  "timing": { "started": "2026-11-18T09:00:12Z", "durationMs": 3100 },
  "data": {
    "degraded": false,
    "sections": [
      { "id": "tracker", "state": "observed", "findings": [] },
      { "id": "ci", "state": "observed", "findings": [
        { "code": "ci.red-on-main", "severity": "high",
          "evidence": "repo-alpha main pipeline 44827, job ts-tests",
          "action": "dispatch fix lane" }
      ] },
      { "id": "lanes", "state": "observed", "findings": [
        { "code": "lane.idle-no-reason", "severity": "medium",
          "evidence": "L6 idle 42m, no condition recorded",
          "action": "inspect lane" }
      ] }
    ],
    "readyToMerge": [
      { "ref": "GH-301", "gatesVerifiedAge": "4m", "ci": "12/12" }
    ],
    "questions": [
      { "id": "q-8f21", "type": "decision-needed", "age": "14m" }
    ]
  }
}
```

## ERRORS

`status.collector.<id>.unavailable` (declared degraded, never zero).

## SEE ALSO

[queue.md](queue.md), [blockers.md](blockers.md), [brief.md](brief.md)
