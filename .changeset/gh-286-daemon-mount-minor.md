---
"@delivery-os/core": minor
"@delivery-os/adapters": minor
"@delivery-os/cli": minor
"@delivery-os/mcp": minor
"@delivery-os/opencode": minor
---

Mount the resident daemon lifecycle at the production entrypoint: `daemon`
joins the prompt-required command set with family and per-subcommand help and
reference coverage, and the production composer supplies the daemon runtime
unconditionally over one resolved state-directory scope (an absolute
`<PREFIX>_STATE_DIR` override, the home default when a home exists, or an
unresolvable outcome that keeps the family mounted over a refusing runtime).
A bare `start` re-enters the running entry path with the declared re-entry
environment (the authoritative state-directory binding written last, plus the
composing `PATH`, its home, and a set working-name override); a `--foreground`
start owns its lifetime through the injected signal host, draining on `SIGTERM`
and stopping immediately on `SIGINT`, with both listeners removed before the
invocation returns. The instance record carries the composing pid, and a
cross-process `stop` refuses anything but a recorded positive pid. `install`
writes the brand-derived unit under the user configuration root with the
absolute entry path and the exact state-directory binding, and `uninstall` is
ownership-scoped. Queue and lanes degradation is resolved per projection from
durable state instead of a hardcoded marker. The error table, the state schema,
`STATE_SCHEMA_VERSION`, the command grammar, and the envelope shapes are
unchanged.
