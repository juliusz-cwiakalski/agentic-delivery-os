---
"@delivery-os/core": minor
"@delivery-os/adapters": minor
"@delivery-os/cli": minor
"@delivery-os/mcp": minor
"@delivery-os/opencode": minor
---

Add the daemon-free scheduling engine: a fenced, replay-idempotent queue graph;
readiness on the delivered six-condition model with scheduler sources;
repo-exclusive leases with two-stage claim, renewal, release, and evidenced stale
takeover; weight classes as a per-runner resource class; producer-before-consumer
batching with a producer-bound deploy-verified gate; a declared total precedence
with close-first ranking and a computed preemption proposal; parks with per-type
recheck, a durable clear-observed marker, recovery incidents, and the classified
stuck finding; and the bounded `queue` and `lanes` command surfaces with truthful
daemon-down degradation. Five additive record kinds, one derived document, five
`queue` error rows, the lanes collector id, and the typed `queue` configuration
branch land in the same change. `queue ready` is unchanged.
