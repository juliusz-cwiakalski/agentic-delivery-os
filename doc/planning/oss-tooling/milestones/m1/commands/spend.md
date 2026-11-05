# spend(1)

Status: M1 planned (M1-S19). Proposed contract.

## NAME

`spend` - per-ticket, per-phase spend and the resume-amplification
metric from the event log.

## SYNOPSIS

```
<binary> spend [--ref <ref>] [--phase <phase>] [--amplification] [--json]
```

## DESCRIPTION

Read side over closeout-captured harness telemetry: tokens by class,
calls, per agent and model, restart counts - without re-querying
harness stores. `--amplification` prints tokens paid versus unique
progress (approximately 1 for healthy deliveries) and flags
amplification events by name. Alarms and burn rates arrive in M2-S6.

## OUTPUT

Text: breakdown tables. Envelope `data`: `tokensByClass`, `perPhase[]`,
`perAgent[]`, `restarts`, `amplification` (ratio, events[]).

## EXIT STATUS

0 reported; 1 no telemetry for ref (classified, named); 2 event log
unreachable.

## EXAMPLES

```
$ <binary> spend --ref GH-302 --amplification --json
{
  "schemaVersion": 1,
  "runId": "r_01J8ZY2Y9V",
  "exitCode": 0,
  "timing": { "started": "2026-11-18T11:00:00Z", "durationMs": 210 },
  "data": {
    "tokensByClass": { "input": 2379000, "cacheRead": 1131000, "output": 390000 },
    "perPhase": [
      { "phase": "delivery", "share": "58%" },
      { "phase": "review_fix", "share": "21%" }
    ],
    "perAgent": [
      { "agent": "coder", "tokens": 2100000 },
      { "agent": "reviewer", "tokens": 900000 }
    ],
    "restarts": 0,
    "amplification": { "ratio": 1.02, "events": [] }
  }
}
```

Amplification event flagged:

```
$ <binary> spend --ref GH-315 --amplification --json | cat
{"schemaVersion":1,"runId":"r_01J8ZY3Z1W","exitCode":0,"timing":{"started":"2026-11-18T11:03:41Z","durationMs":190},"data":{"restarts":3,"amplification":{"ratio":8.7,"events":[{"cause":"restart-loop prefill re-pay","window":"2026-11-17T22:00Z/23:10Z","tokensWasted":41000000}]}}}
```

## ERRORS

`spend.telemetry-absent`, `state.store.torn`.

## SEE ALSO

[closeout.md](closeout.md), [lanes.md](lanes.md)
