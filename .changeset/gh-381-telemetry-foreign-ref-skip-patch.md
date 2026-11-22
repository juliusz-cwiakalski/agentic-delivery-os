---
"@delivery-os/core": patch
---

Make the per-ref telemetry families read skip well-formed foreign-ref family
keys instead of tearing them as `state.store.torn`, so `spend`, the metrics
report, and provider resolution's budget measurement read any ledger that
holds two or more changes' telemetry. Within the step and baseline family
branches, a key with an empty ref remainder (the bare prefix) still tears at
its own position, the requested ref's kind-mismatch tear and payload
validation are unchanged, and a well-formed key naming another ref is skipped
in ledger order with no kind inspection, no payload inspection, and no
evidence contribution — the delivered per-ref economics read's rule. The read
stays one verified pass over the ledger with no new reads, no ledger
mutation, and no new vocabulary; single-ref behavior is unchanged
(golden-equal), and consumer report shapes are unchanged — the only
difference is failing → succeeding on multi-ref ledgers.
