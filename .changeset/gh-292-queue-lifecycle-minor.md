---
"@delivery-os/core": minor
"@delivery-os/adapters": minor
"@delivery-os/cli": minor
"@delivery-os/mcp": minor
"@delivery-os/opencode": minor
---

Complete the queue lifecycle on the append-only ledger: reason-bearing
`queue remove <ref> --reason` with the closed vocabulary
`landed | abandoned | superseded | reconciled`, automatic `landed` removal
inside `closeout --apply` through an additive `queueRemoval` block, `queue dep
add` / `queue dep remove` dependency edges beside the delivered two-positional
add, per-ref single-flight at dispatch admission (a second dispatch or claim
against a ref with an active lane refuses `queue.single-flight` naming the
holder through the envelope-root `detail`), and `queue reconcile` against
tracker delivery state that removes `done`/`canceled` refs with reason
`reconciled`. The declared `remove` kind becomes emitted with exactly the
payload `ref`, `reason`, `recordedAt`; two error identities join the queue kind
(`queue.reason-missing`, `queue.single-flight`). One disclosed behaviour
narrowing: a same-holder claim for a second ref refuses the delivered
`queue.lease-conflict` instead of renewing and rewriting the lease's recorded
ref. No new state schema version, migration, package, or dependency; `queue
release` keeps its lease-release meaning and the five delivered queue error
rows stay byte-identical.
