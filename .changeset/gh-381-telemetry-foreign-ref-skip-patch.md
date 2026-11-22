---
"@delivery-os/core": minor
"@delivery-os/adapters": minor
"@delivery-os/cli": minor
"@delivery-os/mcp": minor
"@delivery-os/opencode": minor
---

Make the per-ref telemetry families projection skip well-formed telemetry
family keys naming another change ref instead of tearing them as
`state.store.torn`, so `spend`, the metrics report, and provider resolution
read ledgers that hold two or more changes' telemetry. Malformed family keys
and the requested ref's own damage keep tearing. The read stays one verified
pass over the ledger with no new reads, no ledger mutation, and no new
vocabulary; single-ref behavior and consumer report shapes are unchanged.
