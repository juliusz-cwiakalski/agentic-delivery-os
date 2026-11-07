---
"@delivery-os/core": minor
"@delivery-os/adapters": minor
"@delivery-os/cli": minor
"@delivery-os/mcp": minor
"@delivery-os/opencode": minor
---

Add the harness adapter seam: the HarnessInstance and HarnessSession ports with
closed harness-kind, operation, lifecycle-capability, and liveness-kind
vocabularies; the opencode delivery adapter (spawn, resume/steer, read-only
session listing, liveness sourcing); the Claude Code headless adapter with
resume/steer and unsourced liveness kinds declared as explicit gaps; the
deny-by-default execution-environment descriptor whose spawn environment is
exactly the declared set with use-time credential resolution; the typed harness
configuration branch; one shared harness-neutral classifier; read-only bounded
telemetry extraction from both stores into one neutral statistics shape; and the
non-gating, idempotent closeout capture of session statistics into additive
`harness.telemetry` state records with bounded output.
