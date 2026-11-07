---
"@delivery-os/core": minor
"@delivery-os/adapters": minor
"@delivery-os/cli": minor
"@delivery-os/mcp": minor
"@delivery-os/opencode": minor
---

Add the merge and verify-deploy engine: the config-declared schema-versioned
gate registry shared by `verify gates` and `merge` (five reserved built-ins plus
the merge-only `tracker-freshness` and declarative `required-ci-job` recipes),
the fenced EVT-1 gate-verification record and freshness envelope, the bounded
post-verification tracker/CI probe, the PDR-0003 classification consumed as
merge authority with recorded authorized waivers, the single rebase-refresh with
no force path, the verified squash landing with idempotent convergence and
dry-run, the `verify deploy` trace verdict taxonomy, the three additive state
record kinds, and the eleven `merge.*` / `verify.deploy.*` error identities. The
whole battery is offline.
