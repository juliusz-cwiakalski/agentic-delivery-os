---
"@delivery-os/core": minor
"@delivery-os/adapters": minor
"@delivery-os/cli": minor
"@delivery-os/mcp": minor
"@delivery-os/opencode": minor
---

Add the command audit ledger: one `audit.invocation` record per CLI invocation
(plus its reservation-first ordinal evidence) with redacted arguments, exit
code, timing, outcome class, scope/repo, UTC epoch-millisecond start timestamp,
the rendered envelope's schema version, and claimed agent identity when
provided; a keyed chain over both audit kinds backed by the durable
`chain-key.<workspace>.json` store artifact; a bounded, filtered, library-only
read surface with in-band truncation and reservation-orphan findings; and the
owner-pinned scripted-mode trim (one minified `data` line; failure lines keep
`runId` as a top-level key) with both-mode goldens and conformance rules. No
schema bump, no new error-table rows, and audit-write failures never change the
command outcome.
