---
"@delivery-os/core": minor
"@delivery-os/adapters": minor
"@delivery-os/cli": minor
"@delivery-os/mcp": minor
"@delivery-os/opencode": minor
---

Make `verify gates` persist the verification `merge` consumes: the shipped
production composition now supplies the delivered fenced, post-append-verified
`merge.gate-verification` append as the verify-gates runtime's append seam, so
the record the handler already computes is written to the ledger instead of
being printed and discarded, and the documented native sequence — `verify gates
<ref>` then `merge <ref>` — lands a clean PR with no undocumented `--dry-run`
pre-step. The append is silent: verify-gates human bytes, machine envelope,
verdicts, citations, ordering, exits, and the delivered read budget are
byte- and behaviour-identical (0-byte golden delta across the full outcome
matrix, 0 added provider or configuration reads), and no error row, record
kind, key, schema, envelope key, or exit code changes. `merge --dry-run` keeps
its merge-applicable record semantics; the `merge.state-unverified` refusal and
its remediation are unchanged and now truthful.
