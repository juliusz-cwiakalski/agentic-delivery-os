---
"@delivery-os/core": minor
"@delivery-os/adapters": minor
"@delivery-os/cli": minor
"@delivery-os/mcp": minor
"@delivery-os/opencode": minor
---

Add the read-only `doctor` command: five wiring checks (`repo`, `tracker`,
`provider`, `state`, `ci`) in a fixed order with a closed `ok`/`fail`/`unreachable`
verdict vocabulary, bounded evidence, deterministic detail, and an unconditional
fix hint on every non-ok verdict. The change introduces the `delivery.doctor.v1`
contract, per-check isolation, the classify-and-prescribe outcome model (all-ok
data with exit 0; any non-ok `doctor.check.failed` error with exit 1; unable to
run through the existing exit 2 projection), one additive structured `httpStatus`
field on the adapter-local read-failure types with one GitHub trap-catalog entry,
and exactly one additive `doctor` error-table row. The command performs no
writes, no quota fetch, and no provider-engine execution.
