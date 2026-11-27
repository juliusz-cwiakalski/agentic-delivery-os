---
"@delivery-os/core": minor
"@delivery-os/adapters": minor
"@delivery-os/cli": minor
"@delivery-os/mcp": minor
"@delivery-os/opencode": minor
---

Add the lane-owned evidence push: a prompt-required `push <ref>` command (the
twenty-ninth prompt-required command) that pushes the change branch's head
fast-forward once through the delivered seam at `pr_creation`, authors nothing,
and appends one durable `dispatch.lane-push` record. The classification folds
that record into the attempt's reserved evidence as `lane-push:<verdict>` and,
on a refusal, `lane-push-cause:<cause>`; `dispatch status` carries an additive
optional `lanePush` fact from the same record. The push seam's `detail` becomes
the closed cause vocabulary (a contract change for the lane's surfaces; the
engine's parity act consumes the outcome only). The safe-ref predicate and the
protected-name set get one shared home in the core contracts tier, and the
engine's ensure-push stays unchanged as the backstop. Amends TDR-0076's push
ownership.
