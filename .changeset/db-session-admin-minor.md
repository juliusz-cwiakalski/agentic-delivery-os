---
"@delivery-os/core": minor
"@delivery-os/adapters": minor
"@delivery-os/cli": minor
"@delivery-os/mcp": minor
"@delivery-os/opencode": minor
---

Add the session-database administration port: a metadata-only `db` command
family (`size`, `list`, `prune`, `reboot`) over one injected opencode-CLI seam,
a read-only store port and a separate admin port, dry-run defaults with
`--apply`-only mutation, leaf-only pruning with a pre-delete re-check, one
bounded WAL checkpoint for a manual host restart, and the four synchronized
`db.*` error identities.
