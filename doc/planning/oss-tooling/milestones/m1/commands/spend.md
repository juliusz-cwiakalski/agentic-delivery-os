# spend(1)

Status: delivered (M1-S19).

## NAME

`spend` - per-ticket, per-phase, and per-agent spend plus the
resume-amplification metric from the event log.

## SYNOPSIS

```
<binary> spend [--ref <ref>] [--phase <phase>] [--breakdown <field>] [--amplification] [--json]
```

## DESCRIPTION

Read-only fold over closeout-captured harness telemetry in the delivery
state ledger. It reports tokens by the five delivered classes (`input`,
`output`, `reasoning`, `cacheRead`, `cacheWrite`), calls, per agent and
model roll-ups, per-phase capture-time attribution from `phase.transition`
windows, per-delivery restart counts, and the resume-amplification block -
without re-querying harness stores and without writing state.

`--ref` selects one work item; omitted, it resolves the active change ref
from the local delivery context. `--phase` scopes the whole report to one
canonical delivery phase. `--amplification` prints paid tokens versus
unique progress (approximately 1 for healthy deliveries) and flags
`restart-loop prefill re-pay` events by name in the human digest; the
machine envelope always carries the amplification block. `--json` is the
global machine-output switch.

Telemetry-absent is a classified outcome (`spend.telemetry-absent`,
exit 1), not an empty success or a zero report. The six v1 keys aggregate
tokens only: cost is never converted, priced, or currency-rendered. Alarms,
burn rates, and quota snapshots arrive in M2-S6.

### v2 addendum (M2-S14, GH-291)

The delivered grammar grew exactly one flag: `--breakdown <field>` leads the
human digest with one of the five declared dimensions (`ticket`, `repository`,
`lane`, `role`, `model`); every machine report always carries all five. The
report payload keeps the `delivery.spend.v1` identity and the six v1 keys with
their names and semantics, and gains five declared additive keys beside them:
`costTotals`, `breakdowns`, `phaseTiming`, `telemetryState`, and
`reconciliation`. Cost now appears in harness-reported units in the additive
block (never converted, never zero-filled), and every summary states the
telemetry state and the reconciliation tolerance. A breakdown value outside the
five declared fields is refused with `input.value.rejected` before any read.
See [spend v2](../../m2/commands/spend.md) and
[telemetry.v1 and spend v2](../../m2/contracts.md).

## OUTPUT

Text: a bounded deterministic digest - token totals, calls, agent
roll-ups, phase roll-ups with share, restarts, the honesty limits, the
optional amplification section, and the degradation disclosure.

Envelope `data` carries exactly:

| Key | Contract |
|---|---|
| `tokensByClass` | The five delivered classes as non-negative integers; a null class is excluded, never fabricated to zero. |
| `perPhase[]` | `{ phase, calls, tokens, share }`, where `share` is an integer floored percentage and `unknown` is the named no-transition fallback. |
| `perAgent[]` | `{ agent, model, calls, tokens }`. |
| `restarts` | `max(0, N - 1)` over the union of run identities across both telemetry families. |
| `amplification` | `{ ratio, progressRun, events[] }`; an event is `{ cause, window: {start, end}, tokensWasted }`. |
| `degradation` | `{ records, byReason }` over the closed harness warning vocabulary. |

The schema identity `delivery.spend.v1` is a declared contract constant,
not a `data` key. Machine payload is at most 65 536 UTF-8 bytes; human
output at most 200 lines and 16 384 UTF-8 bytes. Truncation drops trailing
`perAgent[]` entries first, then `perPhase[]`, then amplification events,
with a recorded `truncated` marker; totals, restarts, ratio, and
`progressRun` are never truncated.

## EXIT STATUS

0 reported (including a capture-outcome-only store and the degenerate
all-zero report); 1 `spend.telemetry-absent`, `input.value.rejected`, or a
delivered user-validation state row such as `state.permission.denied`;
2 event-log unreachable through delivered platform-provider state rows
(`state.store.torn`, `state.schema.mismatch`, `state.store.unknown`).
Machine consumers branch on the error code, never the exit code alone.

## EXAMPLES

Healthy single-run delivery (human digest):

```
$ <binary> spend --ref GH-236 --amplification
spend
tokens     input 123 | output 52 | reasoning 7 | cacheRead 2 | cacheWrite 1
calls      4
agents
- planner/sonnet: 3 calls, 153 tokens
- coder/opus: 1 calls, 32 tokens
phases     capture-time windows (phase.transition)
- clarify_scope: 4 calls, 185 tokens (100%)
restarts   0 (runs that reached closeout capture)
limits
- run duplication is proven; semantic duplication is not
- runs that never reached closeout capture are invisible to this report
- restart counts share that capture-reached evidence basis
- a zero-token progress run reports no ratio and is named in amplification.progressRun (paid > 0 or paid = 0)
ratio      1 (paid 185 / progress 185)
events     none (no superseded record-bearing run)
degradation 0 record(s) with warnings
```

Restart loop (machine envelope, `data` excerpt):

```json
{
  "tokensByClass": { "input": 11200000, "output": 0, "reasoning": 0, "cacheRead": 0, "cacheWrite": 0 },
  "perPhase": [{ "phase": "clarify_scope", "calls": 4, "tokens": 11200000, "share": 100 }],
  "perAgent": [{ "agent": "planner", "model": "sonnet", "calls": 4, "tokens": 11200000 }],
  "restarts": 3,
  "amplification": {
    "ratio": 9.333333333333334,
    "progressRun": null,
    "events": [
      { "cause": "restart-loop prefill re-pay", "window": { "start": "2026-11-01T10:00:00.000Z", "end": "2026-11-01T11:00:00.000Z" }, "tokensWasted": 5000000 },
      { "cause": "restart-loop prefill re-pay", "window": { "start": "2026-11-01T11:00:00.000Z", "end": "2026-11-01T12:00:00.000Z" }, "tokensWasted": 3000000 },
      { "cause": "restart-loop prefill re-pay", "window": { "start": "2026-11-01T12:00:00.000Z", "end": "2026-11-01T13:00:00.000Z" }, "tokensWasted": 2000000 }
    ]
  },
  "degradation": { "records": 0, "byReason": { "optional-field-absent": 0, "non-numeric-value": 0, "cost-missing": 0, "version-drift": 0, "malformed-line": 0, "truncated": 0, "session-capture-failed": 0, "unattributable-session": 0, "invalid-session-identity": 0 } }
}
```

A zero-token progress run reports `ratio: null` and names the run in
`amplification.progressRun`; with no record-bearing run (a
capture-outcome-only store) both are null and the report is a success.

No captured telemetry for the ref:

```
$ <binary> spend --ref GH-236 --json
{"schemaVersion":"delivery.result.v1","runId":"run-01J8ZR8M6T","exitCode":1,"timing":{"totalMs":12},"error":{"code":"spend.telemetry-absent","category":"user","retryable":false,"consequence":"not_landed","remediationHint":"Capture harness telemetry (session-group and capture-outcome records) for the selected work item at closeout, then re-run spend.","summary":"spend: no captured harness telemetry for ref GH-236"}}
```

## ERRORS

`spend.telemetry-absent` is the one new spend row. Store damage reuses
`state.store.torn`, `state.schema.mismatch`, `state.store.unknown`, and
`state.permission.denied` unchanged. Grammar failures use
`input.value.rejected`; an undeclared flag uses `fallback.invocation`.

## SEE ALSO

[status.md](status.md), [retro.md](retro.md), [closeout.md](closeout.md)

## HELP

`<binary> spend --help` prints usage, options, at least one example, exit codes,
and a see-also pointer. Root `<binary> --help` and `<binary> --version` are
self-description only: zero state, network, git, or configuration reads and
zero writes. The executable is a non-installed Bun bin; see the
[man page](../man-page.md).

