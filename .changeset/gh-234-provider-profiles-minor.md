---
"@delivery-os/core": minor
"@delivery-os/adapters": minor
"@delivery-os/cli": minor
"@delivery-os/mcp": minor
"@delivery-os/opencode": minor
---

Add model profiles and provider watching: a typed `provider.profiles` branch
(tiers, profiles, seats with typed `pacingClass`, preference chain, pacing rungs,
empty by default), the pure selection engine (declarative heuristics, hard
capability gate, lazy memoized eligibility probes), profile park/switch/revert
with a persisted target record, the coding-plan/DeepSeek/OpenAI watch mappings,
`provider profile resolve` and `provider watch status` CLI surfaces, and
resolve-before-spawn with a hardened `data-v1` env-record contract.
