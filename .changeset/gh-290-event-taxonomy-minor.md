---
"@delivery-os/core": minor
"@delivery-os/adapters": minor
"@delivery-os/cli": minor
"@delivery-os/mcp": minor
"@delivery-os/opencode": minor
---

Publish event taxonomy v1 on the resident daemon's subscribe surface: four event
topics (`queue.graph`, `dispatch.attempt`, `phase.state`, `blockers.state`) beside
the delivered `queue` and `lanes` snapshot topics, an eight-field envelope with a
per-`(topic, lane)` process-scoped `sequence`, the additive
`overflow: "repoll"` and `taxonomyVersion` stamps on every degraded frame, one
whole-store read per publish tick shared by both projections, the unknown-topic
refusal, and the generated `events list` / `events describe <topic>` reference
surface mounted as a prompt-required family. No new wire type, state record kind,
schema version, migration, or dependency; exactly three error rows in a new
`events` kind.
