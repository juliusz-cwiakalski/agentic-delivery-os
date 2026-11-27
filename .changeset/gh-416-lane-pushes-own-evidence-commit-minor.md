---
"@delivery-os/core": minor
"@delivery-os/adapters": minor
"@delivery-os/cli": minor
"@delivery-os/mcp": minor
"@delivery-os/opencode": minor
---

Add the lane-owned evidence push: a prompt-required `push <ref>` command (the
twenty-ninth prompt-required command) that pushes the change branch's head to the
checkout's configured push remote in one non-force push through the delivered
seam at `pr_creation`, authors nothing, and appends one durable
`dispatch.lane-push` record. The classification folds that record into the
attempt's reserved evidence as `lane-push:<verdict>` and, on a refusal,
`lane-push-cause:<cause>`; `dispatch status` carries an additive optional
`lanePush` fact from the same record. The push seam's `detail` becomes the closed
cause vocabulary (a contract change for the lane's surfaces; the engine's parity
act consumes the outcome only), and the seam's argv is corrected to the valid
non-force `git push <remote> HEAD:refs/heads/<branch>` on the push remote
resolved by one bounded local configuration read, so the engine's ensure-push
performs a real push for the first time while its parity read, act count and
classification are unchanged. The safe-ref predicate moves to the core contracts
tier beside the unchanged protected-name set. Amends TDR-0076's push ownership.
