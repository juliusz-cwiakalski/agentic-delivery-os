---
"@delivery-os/core": minor
"@delivery-os/adapters": minor
"@delivery-os/cli": minor
"@delivery-os/mcp": minor
"@delivery-os/opencode": minor
---

Add the resident dispatch daemon: the `daemon start|stop|status|install|uninstall`
family, the fence-style single-instance lock and durable instance/heartbeat/lane/
reconciliation/preemption records, control protocol v1 over stdio and unix with
bounded subscriptions, state-mediated truth and the daemon-down one-shot surface,
startup reconciliation with restart-budget exhaustion, lane supervision through an
injected executor with supervise-only degradation, the external-effect protocol
with a message-independent commit outbox identity and one bounded log-since check,
safe-boundary preemption, bounded live watch for queue and lanes with truthful
degraded polling, per-platform polling policy, and the optional scoped systemd
user unit. Exactly eight new `daemon` error rows, two additive configuration
branches, an optional additive `callerPrincipal`, and one `./daemon` adapter
subpath land together.
