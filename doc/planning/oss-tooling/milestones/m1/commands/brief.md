# brief(1)

Status: M1 planned (M1-S6). Proposed contract.

## NAME

`brief` - the deterministic, render-only owner brief.

## SYNOPSIS

```
<binary> brief [--json]
```

## DESCRIPTION

One screen, decision-first, rendered from the same collector state as
the status digest (one source of truth). Carries ready-to-merge, typed
questions, and owner-gate ages as anchored actions; unbuilt collectors
appear as named placeholders. No LLM in the render path (asserted in
review and by dependency checks).

## OUTPUT

Text: one-screen brief. Envelope `data`: `actions[]` (kind, ref,
evidence), `questions[]`, `aging[]`, `placeholders[]`.

## EXIT STATUS

0 rendered; 2 collectors unavailable (declared).

## EXAMPLES

```
$ <binary> brief --json
{
  "schemaVersion": 1,
  "runId": "r_01J8ZV6D1H",
  "exitCode": 0,
  "timing": { "started": "2026-11-18T08:00:00Z", "durationMs": 820 },
  "data": {
    "actions": [
      { "kind": "ready-to-merge", "ref": "GH-301", "evidence": "gates verified 4m ago" }
    ],
    "questions": [
      { "id": "q-8f21", "type": "decision-needed", "age": "14m" }
    ],
    "aging": [
      { "gate": "W-12", "age": "2d", "slaState": "escalated" }
    ],
    "placeholders": []
  }
}
```

## ERRORS

`status.collector.<id>.unavailable` (named placeholders, never silent).

## SEE ALSO

[status.md](status.md), [board.md](board.md)
