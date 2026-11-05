---
"@delivery-os/core": minor
"@delivery-os/adapters": minor
"@delivery-os/cli": minor
"@delivery-os/mcp": minor
"@delivery-os/opencode": minor
---

Add the watchdog lane-safety check family. `watchdog preflight` refuses a
dirty or non-base checkout with named evidence and mutates nothing; `watchdog
teardown` restores the lane's base checkout on every caller-invoked exit path,
reports each action with evidence, and verifies that agent-memory publications
are committed or preserved, never discarded; `watchdog liveness` ships the
verdict vocabulary and declared signals shape contract-first and classifies
absent sources as `watchdog.signals-absent` (exit 2, unknown, never guessed).
The `watchdog` domain kind adds exactly the three lane-safety error identities.
