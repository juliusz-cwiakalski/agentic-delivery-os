---
"@delivery-os/core": minor
"@delivery-os/adapters": minor
"@delivery-os/cli": minor
"@delivery-os/mcp": minor
"@delivery-os/opencode": minor
---

Add the machine-readable delivery plan schema and the `plan` command family:
`plan validate` (schema verdict plus the ready-for-development gate), `plan diff`
(declared versus actual scope), and `plan overlap` (parallel or run-in-sequence
with named paths and producer-first ordering), the additive plan lint target,
additive `plan.*` error identities, and the writer flip to
`chg-<ref>-plan.yaml` with legacy markdown plans readable through a classified
transition verdict.
