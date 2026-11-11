---
"@delivery-os/core": minor
"@delivery-os/adapters": minor
"@delivery-os/cli": minor
"@delivery-os/mcp": minor
"@delivery-os/opencode": minor
---

Scope delivery state per repository and add the `projects` host overview.

Delivery state now resolves as two layers: the delivered host root (an absolute
`<PREFIX>_STATE_DIR` override wins, otherwise the injected home plus the brand
state-directory name) and a per-repository project root derived from a checkout
identity marker minted once inside the checkout's git common directory. Two
checkouts of different repositories never share phase state, queue entries, or
lane leases for the same ref, and the store honours the environment override for
the first time.

`projects list [--json]` becomes the host overview: a derived, revisioned host
index at `<host root>/host-index.json` that is maintained by bounded upsert and
provably-dead pruning on store-opening invocations only, plus the five-field row
(`projectKey`, `root`, `stateLocation`, `daemonReachable`, `handoverState`) and
the deterministic `key | root | state | daemon | handover` table. Listing is
read-only without exception: no index maintenance, no project-root creation, and
no write of any kind.

The family's three contract identities (`projects.identity-unreadable`,
`projects.registry-corrupt`, `projects.state-unavailable`) are declared in one
new error-table domain kind, and an invocation outside any git work tree uses
the declared `unbound` scope with one bounded warning instead of failing.
