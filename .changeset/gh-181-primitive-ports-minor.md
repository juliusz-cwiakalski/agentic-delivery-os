---
"@delivery-os/core": minor
"@delivery-os/adapters": minor
"@delivery-os/cli": minor
"@delivery-os/mcp": minor
"@delivery-os/opencode": minor
---

Add the v1 primitive port, credential port, and embedded metadata envelope
contracts: typed catalogue primitives with capability/gap and declared-carrier
flags, the environment-backed credential implementation at the new
`./credentials` adapters subpath, the adapter-internal `delivery.metadata.v1`
codec, the binding secret-read boundary invariant, and the synchronized
`config.credential.missing` error row.
