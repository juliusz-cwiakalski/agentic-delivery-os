# M4 — suggested delivery order

Stories from [backlog.md](backlog.md) top to bottom in the suggested order.

| # | Story | Depends on | Why here |
|---|---|---|---|
| 1 | M4-S2 Namespace migration | none | Every later surface is named once, early |
| 2 | M4-S1 Installable, versioned binary | M4-S1a, M3 | Product artifact model before hardening |
| 3 | M4-S3 Command conformance and repair | M4-S1, M4-S2 | Repairs are the daily-delivery friction |
| 4 | M4-S4 Declarative provider policy | M4-S2 | Cost control before long unattended queues |
| 5 | M4-S5 Project-scoped queues | M4-S3 | Parallel projects need hardened queues |
| 6 | M4-S6 History and statistics export | M4-S5 | Project identity on events precedes export |
| 7 | M4-S7 Agent prompts on Jaiship primitives | M4-S3, M4-S4 | Prompts target the hardened surfaces |
| 8 | M4-S8 Dogfood window and wrapper rewrite | M4-S1..S7 | Last: evidence then thin wrappers |
