---
"@delivery-os/core": minor
"@delivery-os/adapters": minor
"@delivery-os/cli": minor
"@delivery-os/mcp": minor
"@delivery-os/opencode": minor
---

Give the typed dispatch lane the four per-ref operator queries the shell lane
still owned: `dispatch status <ref>`, `dispatch log <ref> [--tail <n>]`,
`dispatch is-delivering [<ref>]`, and `dispatch last-message <ref>`, each with the
delivered global `--json`. `status` and `is-delivering` are pure folds over the
durable `dispatch.lane` record — filtered to the resolved repository BEFORE the
newest-per-ref fold — joined with an injected tri-state advisory owner probe whose
5 000 ms start-instant tolerance keeps a reused process id from being reported
live. `log` reads a new bounded, reference-scoped artifact family,
`dispatch-logs.<workspace>/<REF>/`: one append-only `0600` segment file per stream
of a streaming harness, every yielded value followed by exactly one LF, capped per
file at 1 048 576 bytes by starting the next segment (an oversized value continues
across the boundary), the newest two files retained, the retained files stitched in
name order before splitting, and an unterminated tail dropped as a torn write.
`last-message` reads the harness's own persisted session transcript through one
injected adapter-owned read seam under the existing `session-introspection`
capability and composes redact -> flatten -> bound(512) -> mark, so a registered
credential straddling the cut cannot survive as a prefix; a Claude Code lane
answers `capability-gap`. The four queries are read-only and shell-free: zero
appends, fences, lane rewrites, identity-marker writes, process starts, network
reads, or artifact deletions. A one-shot adapter lane streams nothing and answers
`no-log`, which never means the session printed nothing. No delivery-result token,
projection, exit digit, error-table row, domain kind, attempt or lane field,
schema version, or configuration key is added.
