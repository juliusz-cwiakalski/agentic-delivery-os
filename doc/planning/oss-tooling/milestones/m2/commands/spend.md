# spend(1)

Status: Proposed (M2)

## NAME

`spend` - the v2 spend breakdown: per ticket, repository, lane, agent role,
and model, with timing summaries.

## SYNOPSIS

```
<binary> spend [--ref <ref>] [--breakdown <ticket|repository|lane|role|model>] [--json]
```

## DESCRIPTION

Read-only fold over delivered telemetry. M2 extends the M1 read side with the
`spend` v2 breakdown fields and a reconciliation disclosure; the M1 shape
stays valid.

Every report breaks tokens and cost down by ticket, repository, lane, agent
role, and model, and adds timing summaries per phase. The report reconciles
against harness-reported session totals within the declared tolerance, and it
states the tolerance in the reconciliation line instead of applying it
silently. Telemetry absence is a classified outcome with exit `1`, never a
zero report.

The `spend` family is registered in the root listing today; only the v2
breakdown fields and the reconciliation disclosure are planned, delivered by
M2-S6 on the telemetry M2-S14 produces. See
[../entrypoint-delta.md](../entrypoint-delta.md) for the root delta and
[../contracts.md](../contracts.md) for the contract.

## OPTIONS

| Option | Meaning |
|---|---|
| `--ref <ref>` | Scope the report to one work item; omitted, the active ref is used. |
| `--breakdown <field>` | Group the report by `ticket`, `repository`, `lane`, `role`, or `model`. All five are present in the envelope. |
| `--json` | Emit the machine envelope instead of the human digest. |

## OUTPUT

Text: totals, then the breakdown blocks, then the per-phase timing summaries,
then the reconciliation line, then the honesty limits.

Envelope `data` carries:

| Key | Contract |
|---|---|
| `totals` | Token classes, calls, and cost |
| `breakdowns` | `ticket`, `repository`, `lane`, `agentRole`, `model` arrays |
| `timing` | Per-phase start, end, and duration summaries |
| `reconciliation` | Harness session totals, observed totals, tolerance, and verdict |
| `telemetryState` | `present` or the classified absence kind |

## EXIT STATUS

| Code | Meaning |
|---|---|
| `0` | A reconciled report was produced |
| `1` | Telemetry is absent, or the request was refused |
| `2` | A platform or state failure prevented reading telemetry |

## EXAMPLES

```
$ <binary> spend --ref GH-241 --breakdown model
tokens in=182000 out=41000 reasoning=9000 cache=25000 calls=64 cost=3.42
model profile-a/model-1  tokens=150000 cost=2.80  share=82%
model profile-b/model-2  tokens= 81000 cost=0.62  share=18%
reconciliation: harness=277000 observed=277000 tolerance=1.0% verdict=within
```

```
$ <binary> spend --ref GH-241 --json
{ "ok": true, "command": "spend", "data": { "totals": {}, "breakdowns": {}, "reconciliation": {} } }
```

## ERRORS

| Error | Meaning | Exit |
|---|---|---|
| `spend.telemetry-absent` | No telemetry for the ref; a classified outcome | 1 |
| `spend.breakdown-unknown` | The requested breakdown field is not one of the five | 1 |
| `spend.ledger-unavailable` | The telemetry store cannot be read | 2 |

## SEE ALSO

[telemetry.v1 and spend v2](../contracts.md),
[telemetry attribution flow](../architecture.md),
[spend v1](../../m1/commands/spend.md)
