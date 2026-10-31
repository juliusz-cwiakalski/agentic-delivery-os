---
"@delivery-os/core": minor
"@delivery-os/adapters": minor
"@delivery-os/cli": minor
"@delivery-os/mcp": minor
"@delivery-os/opencode": minor
---

Add pm-notes and delivery-registry lint and the phase transition commands:
typed-when-present pm-notes vocabulary with the full/lite variant and its
pinned required-phase set, a read-only `lint` command with named targets, five
classified lint error rows under a new `lint` domain kind, and the
`phase list`/`complete`/`reopen` family writing idempotent `phase.transition`
records through the state port with a rebuildable derived projection.
