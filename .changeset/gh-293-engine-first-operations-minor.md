---
"@delivery-os/core": minor
"@delivery-os/adapters": minor
"@delivery-os/cli": minor
"@delivery-os/mcp": minor
"@delivery-os/opencode": minor
---

Engine-first delivery operations: the dispatch summary reports `cleanDispatches`,
`consecutiveCleanDispatches`, and the four ordered `conditions`; `dispatch
handover` carries the same conditions and `reversible` on every gate-reading
outcome, with the single declared evidence-read-free revert noop and `verdict` on
the recorded revert; `repos list` evaluates the handover gate per row at read time,
bound to the row's own repository identity at the declared `production` scope,
reporting `reversible` and a `handoverGate` block; and the production merge
composition performs real tracker/check-run/request-detail reads with
configuration, branch, base reference, and owner principal resolved from declared
sources, publishing `MERGE_COMPOSITION_EMITTABLE_CODES` and deriving every
failure's kind and exit from the resolved error-table row. `projects.v1` and
`projects list --flat` stay byte-identical, no command, verb, flag, error row,
domain kind, exit class, or configuration key is added, and no repository is
flipped.
