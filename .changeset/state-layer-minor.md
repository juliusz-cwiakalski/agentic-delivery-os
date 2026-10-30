---
"@delivery-os/core": minor
"@delivery-os/adapters": minor
"@delivery-os/cli": minor
"@delivery-os/mcp": minor
"@delivery-os/opencode": minor
---

Add the state layer (M0-S5): a driver-neutral store port with an append-only
JSONL ledger as durable truth and a disposable SQLite derived index, torn-state
detection and bounded repair, single-writer fences with crash-safe atomic
replace, least-privilege permissions, and the `state` domain kind with seven
classified error rows, plus a feature spec and boundary/packing evidence.
