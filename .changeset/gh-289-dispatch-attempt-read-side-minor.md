---
"@delivery-os/core": minor
"@delivery-os/adapters": minor
"@delivery-os/cli": minor
"@delivery-os/mcp": minor
"@delivery-os/opencode": minor
---

Add the dispatch attempt read side: `dispatch attempts [--ref <ref>] [--limit <n>]`
projects the durable attempt record into one declared attempt view, orders it
totally, and pages it under the declared ledger, row, byte and human budgets,
scoped to the invoking checkout's repository while disclosing excluded foreign
records as a count only. The resolve result gains the unconditional
`local-evidence` mode, the divergence's own repository, and the shared
repository-scoped divergence block with its at-most-20 identifier list and
`idsTruncated` marker. No error identity, record kind, schema version,
configuration key, dependency, token, projection class, or exit literal is added.
