---
"@delivery-os/core": minor
"@delivery-os/adapters": minor
"@delivery-os/cli": minor
"@delivery-os/mcp": minor
"@delivery-os/opencode": minor
---

Apply the per-ref telemetry read rule to the two remaining reads: the per-ref
steps read (`readTelemetrySteps`, composed by `spend --window-evidence` and
inherited by the versioned steps composition) and the baseline idempotency
pre-read and post-verified read of `appendTelemetryBaseline` now skip
well-formed telemetry family keys naming another change ref instead of tearing
them as `state.store.torn`. Window evidence renders on ledgers that hold two
or more changes' telemetry, and a second change's baseline capture succeeds
beside the first change's — with the same-identity repeat still the delivered
no-op and every pre-existing record byte-identical. Bare family prefixes and
the requested ref's own damage keep tearing at their position. The reads stay
one verified pass over the ledger with no new reads, no ledger mutation, and
no new vocabulary; single-ref behavior and consumer report shapes are
unchanged.
