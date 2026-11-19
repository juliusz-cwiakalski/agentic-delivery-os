---
"@delivery-os/core": minor
"@delivery-os/adapters": minor
"@delivery-os/cli": minor
"@delivery-os/mcp": minor
"@delivery-os/opencode": minor
---

Add the merge landing and refusal contract, the phase-divergence lint row and
the closeout milestone step: two additive `merge` error rows
(`merge.sync-required` carrying the closed `dirty` | `behind-unconfirmed`
reason vocabulary, and `merge.mergeability-unknown`), one additive `lint` error
row (`lint.phases.divergent`) exposed through the additive registry fold read,
and one additive optional request title on the delivery request. Closeout gains
a thirteenth step that synchronizes the declared milestone through the single
`close-milestone` operation, reporting a withheld closure as `skipped-noop` plus
the additive `milestone-sync-withheld` residue kind, and the adapter operation
set gains that tenth operation together with the `milestone-state` conformance
assertion family.
