---
"@delivery-os/core": minor
"@delivery-os/adapters": minor
"@delivery-os/cli": minor
"@delivery-os/mcp": minor
"@delivery-os/opencode": minor
---

Harden the state layer so every read/write boundary classifies torn or unknown data
instead of serving a silent zero: add reusable validated artifact-boundary contracts
(four distinct verdicts, schema-conforming writes only), an explicit guided terminal-tail
salvage that truncates to the last valid frame, appends a classified salvage record and
quarantines the post-tear bytes, fail-closed storage exhaustion at the append, document
replace and salvage write boundaries, and two additive error-table rows
(`state.storage.exhausted`, `state.store.unknown`) with two text-only remediation
refinements kept in bidirectional sync.
