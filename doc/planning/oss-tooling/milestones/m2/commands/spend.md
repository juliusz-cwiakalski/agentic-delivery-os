# spend(1)

Status: Delivered (M2-S14, GH-291).

## NAME

`spend` - the v2 spend breakdown: per ticket, repository, lane, agent role,
and model, with per-phase timing summaries and a declared-tolerance
reconciliation.

## SYNOPSIS

```
<binary> spend [--ref <ref>] [--phase <phase>] [--breakdown <ticket|repository|lane|role|model>] [--amplification] [--json]
```

## DESCRIPTION

Read-only fold over delivered telemetry records. The v2 read side extends the
M1 spend report additively: the six v1 keys keep their names and semantics and
the five v2 keys sit beside them under the same `delivery.spend.v1` identity
(DEC-6).

Every report breaks tokens and cost down by ticket, repository, lane, agent
role, and model, and adds per-phase start, end, and duration summaries joined
from the delivered `phase.transition` history and the delivered economics
restart/stall records. The report reconciles observed totals against the summed
harness-reported session baseline within the declared tolerance (0.02) and
states the tolerance in the reconciliation line instead of applying it
silently. A baseline session without a harness-reported total is excluded with a
named count and the `baseline-session-excluded` warning; a report with no
baseline at all declares the classified reconciliation unavailability, never
`within`.

Telemetry absence is the delivered classified outcome `spend.telemetry-absent`
at exit `1`, never a zero report. Store damage keeps the delivered `state.*`
identities and is never re-projected as absence. The spend read path never
re-queries a harness store (NG-2); harness-reported baselines are captured at
stream close.

Ownership: the spend v2 read side is delivered by GH-291 (M2-S14); the backlog
M2-S14 row is canonical for M2 scope. M2-S6 owns the alarm and metric layers
(ceremony share, cycle time, burn-rate alarms) that consume this telemetry
later.

## OPTIONS

| Option | Meaning |
|---|---|
| `--ref <ref>` | Scope the report to one work item; omitted, the active ref is used. |
| `--phase <phase>` | Scope every block to one canonical delivery phase. |
| `--breakdown <field>` | Lead the human digest with `ticket`, `repository`, `lane`, `role`, or `model`. All five dimensions are always present in the envelope; any other value is refused before any read. |
| `--amplification` | Render the delivered amplification view (paid versus unique progress). |
| `--json` | Emit the machine envelope instead of the human digest. |

## OUTPUT

Text: token totals, calls, the telemetry-state line, the cost line, the
reconciliation line, the agent roll-ups, the breakdown blocks, the phase
roll-ups and timing summaries, restarts, the honesty limits, and the declared
degradation and truncation marks. Truncation is deterministic and tail-ordered
(`perAgent`, breakdowns, `perPhase`, events); totals, the telemetry state, and
the reconciliation line are never truncated.

Envelope `data` carries the `delivery.spend.v1` keys:

| Key | Contract |
|---|---|
| `tokensByClass` | The five token classes (`input`, `output`, `reasoning`, `cacheRead`, `cacheWrite`) |
| `perPhase` | Per-phase calls, tokens, and share from `phase.transition` windows |
| `perAgent` | Per-(agent role, model) calls and tokens |
| `restarts` | Restart count over the delivery's run identities |
| `amplification` | `ratio`, `progressRun`, and the named events |
| `degradation` | Records with warnings and the per-reason counts |
| `costTotals` | Cost total and per-model cost in harness-reported units, with sparsity disclosed |
| `breakdowns` | `ticket`, `repository`, `lane`, `role`, `model` arrays whose token sums equal the totals |
| `phaseTiming` | Per-phase `start`, `end`, `durationMs`, `stalls`, and `restarts` |
| `telemetryState` | `present` (the classified absence kind is the exit-1 outcome) |
| `reconciliation` | `basis`, `harnessTotals`, `observedTotals`, `tolerance`, `verdict`, `excludedBaselineSessions` |

## EXIT STATUS

| Code | Meaning |
|---|---|
| `0` | A reconciled report was produced (including a declared outside verdict or classified reconciliation unavailability) |
| `1` | Telemetry is absent, the request was refused, or the store is permission-denied |
| `2` | A platform or state failure prevented reading telemetry |

## EXAMPLES

```
$ <binary> spend --ref GH-291 --breakdown model
spend
tokens     input 123 | output 52 | reasoning 7 | cacheRead 2 | cacheWrite 1
calls      4
telemetry  present
cost       0.03 (harness-reported units)
reconcile  within (tolerance 0.02, basis stream-ingest; observed 185 / harness 185)
breakdown  model
- model-alpha: 3 calls, 153 tokens, cost 0.02
- model-beta: 1 calls, 32 tokens, cost 0.01
...
```

```
$ <binary> spend --ref GH-291 --json
{"schemaVersion":"delivery.result.v1","runId":"run-01J8ZR8M6T","exitCode":0,"timing":{"totalMs":12},"data":{"tokensByClass":{"input":123,"output":52,"reasoning":7,"cacheRead":2,"cacheWrite":1},"perPhase":[],"perAgent":[],"restarts":0,"amplification":{"ratio":1,"progressRun":null,"events":[]},"degradation":{"records":0,"byReason":{}},"costTotals":{"total":0.03,"models":[],"sparse":false},"breakdowns":{"ticket":[],"repository":[],"lane":[],"role":[],"model":[]},"phaseTiming":[],"telemetryState":"present","reconciliation":{"basis":"stream-ingest","harnessTotals":{"input":123,"output":52,"reasoning":7,"cacheRead":2,"cacheWrite":1},"observedTotals":{"input":123,"output":52,"reasoning":7,"cacheRead":2,"cacheWrite":1},"tolerance":0.02,"verdict":"within","excludedBaselineSessions":0}}}
```

## ERRORS

| Error | Meaning | Exit |
|---|---|---|
| `spend.telemetry-absent` | No telemetry records of either plane for the ref; a classified outcome | 1 |
| `input.value.rejected` | A breakdown field outside the five declared dimensions (refused before any read), an unknown phase, a malformed ref, or a missing value | 1 |
| `fallback.invocation` | An undeclared flag, at the shared parser | 1 |
| `state.store.torn`, `state.schema.mismatch`, `state.store.unknown` | Telemetry storage damage; never re-projected as absence | 2 |
| `state.permission.denied` | The store cannot be read with its declared permissions | 1 |

## SEE ALSO

[telemetry.v1 and spend v2](../contracts.md),
[telemetry attribution flow](../architecture.md),
[spend v1](../../m1/commands/spend.md)

## HELP

`<binary> spend --help` prints usage, options, at least one example, exit codes,
and a see-also pointer. Root `<binary> --help` and `<binary> --version` are
self-description only: zero state, network, git, or configuration reads and
zero writes. The executable is a non-installed Bun bin; see the
[man page](../man-page.md).
