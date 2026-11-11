# state(1)

Status: Delivered the state layer by M1-S2 (GH-222): schema validation at
every read and write boundary. No command surface is registered — the
`state` family is not composed at the production entrypoint, so this page is
the state-layer contract, not a command reference.

## NAME

`state` - validated state admin: schema checks at every boundary.

## DESCRIPTION

Every state read and write validates against its schema (delivery
registry, retro registry, ceremony artifacts); torn or unknown reads
are classified events with repair guidance, never silent zeros.
The state layer surfaces the checks and store shapes for diagnosis; no
`state` command is registered, so there is no synopsis to invoke.

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
