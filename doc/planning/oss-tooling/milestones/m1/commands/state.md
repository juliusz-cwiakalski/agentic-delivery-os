# state(1)

Status: Delivered M1-S2 (GH-222). Implemented contract.

## NAME

`state` - validated state admin: schema checks at every boundary.

## SYNOPSIS

```
<binary> state check [--store <name>]
<binary> state describe <store>
```

## DESCRIPTION

Every state read and write validates against its schema (delivery
registry, retro registry, ceremony artifacts); torn or unknown reads
are classified events with repair guidance, never silent zeros.
`state` surfaces the checks and store shapes for diagnosis.

## OUTPUT

Text: per-store verdicts. Envelope `data`: `stores[]` (name, verdict
(valid, torn, unknown-schema), records, repair).

## EXIT STATUS

0 all valid; 1 a store classified torn or unknown (repair named); 2
stores unreachable.

## EXAMPLES

```
$ <binary> state check --json
{
  "schemaVersion": 1,
  "runId": "r_01J8ZW8N9M",
  "exitCode": 0,
  "timing": { "started": "2026-11-18T10:25:00Z", "durationMs": 180 },
  "data": {
    "stores": [
      { "name": "delivery-registry", "verdict": "valid", "records": 412 },
      { "name": "retro-registry", "verdict": "valid", "records": 38 }
    ]
  }
}
```

## ERRORS

`state.store.torn`, `state.store.unknown-schema` (classified, never
zeros).

## SEE ALSO

[doctor.md](doctor.md), [lint.md](lint.md)
