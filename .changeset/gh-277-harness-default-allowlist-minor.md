---
"@delivery-os/core": minor
"@delivery-os/adapters": minor
"@delivery-os/cli": minor
"@delivery-os/mcp": minor
"@delivery-os/opencode": minor
---

Ship a viable zero-configuration default harness spawn allowlist: PATH and HOME are required, TMPDIR is optional, DELIVERY_WORK_PATH is injected, the unused HARNESS_MODEL/HARNESS_SMALL_MODEL defaults are removed, and a pre-session spawn failure now carries the underlying harness kind/code/field as an additive bounded dispatch error detail.
