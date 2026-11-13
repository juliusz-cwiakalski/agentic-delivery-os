---
"@delivery-os/core": minor
"@delivery-os/adapters": minor
"@delivery-os/cli": minor
"@delivery-os/mcp": minor
"@delivery-os/opencode": minor
---

Add harness telemetry v2: per-step ingest of the opencode v2.x.y stream with the
five token classes, calls, and harness-reported per-model cost; five-dimension
attribution joined from session economics and command-audit identity;
schema-versioned additive step and session-baseline storage with re-read
migration; and the spend v2 breakdowns, per-phase timing summaries, and the
reconciliation disclosure under the kept `delivery.spend.v1` identity.
