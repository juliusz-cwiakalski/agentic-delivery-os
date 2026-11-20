---
"@delivery-os/core": minor
"@delivery-os/adapters": minor
"@delivery-os/cli": minor
"@delivery-os/mcp": minor
"@delivery-os/opencode": minor
---

Add the `loop` command family — `start --foreground [--fresh-budget]`, `stop
[--mode drain|immediate]`, `status`, `log [--lines <n>]`, and `reset` — composed
as a supervision profile over the delivered coordinator engine under the
distinct identity `loop-main`: the delivered instance lease, restart budget,
stuck record pair, and identity-verified kill path are reused, not
reimplemented. Two additive state record kinds (`loop.session`,
`loop.stop`), one additive optional harness session process id, a bounded
identity-scoped durable stop, a declared restart-backoff schedule, a bounded
operational log, and a deterministic conformance battery publishing a
nine-proven / six-not-proven boundary. No configuration key, error identity,
domain kind, or delivered schema version is added, and `scripts/ceo-loop.sh`
stays byte-unchanged.
