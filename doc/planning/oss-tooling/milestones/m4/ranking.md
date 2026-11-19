# M4 — suggested delivery order

Stories from [backlog.md](backlog.md) top to bottom in the suggested order.
The flip track ([flip-plan.md](flip-plan.md)) leads: F0 through F6 reach
jaiship-only delivery, then the remaining product stories follow.

| # | Story | Depends on | Why here |
|---|---|---|---|
| 1 | M4-S1 Installable, versioned binary | — | F0 of the flip: every later stage needs a stable installed binary |
| 2 | M4-S9 Dispatch parity — one command replaces the lane | M4-S1, M3-S1 | F1: the critical-path gap; without it there is no jaiship delivery |
| 3 | M4-S4 Declarative provider policy — quota, peak, cost routing | M4-S1, M3-S1 | F2: cost and quota control must be product config, not shell; shares the harness port with F1 |
| 4 | M4-S10 CEO loop supervision inside jaiship | M4-S9 | F3: retires the shell loop after dispatch is trustworthy |
| 5 | M4-S11 Merge, closeout, and queue repair on the primitives | M4-S1 | F4: removes the last manual CEO steps; disjoint from F3 so it can run in parallel |
| 6 | M4-S7 Agent prompts on Jaiship primitives | M4-S9..c, M4-S4 | F5: the prompts are the actual gate on the old path |
| 7 | M4-S8 Jaiship-only dogfood and thin wrappers | M4-S1..S7 | F6: evidence window, then wrappers become thin |
| 8 | M4-S3 Delivery command conformance and repair (residual) | M4-S1, M4-S2 | Residual tasks not covered by S3a-S3c ride after the flip |
| 9 | M4-S2 Jaiship namespace migration | — | Follows the flip: identity work does not block delivery |
| 10 | M4-S5 Project-scoped queues and parallel projects | M4-S3, M3-S6 | After the flip and the multi-tracker story |
| 11 | M4-S6 Delivery history and statistics export | M4-S5 | Last: needs project-scoped history |
| 12 | M4-S12 Dispatch operator surface | M4-S9 | F1b: operator convenience; status and is-delivering gate the F6 evidence window |
| 13 | M4-S13 Runner identity and execution topology | M4-S5, M3-S1 | Post-flip: needed before any multi-runner or commercial surface |
| 14 | M4-S15 Human question inbox completion | M4-S9, M4-S5 | Post-flip: durability and cross-project gaps an inbox exposes |
| 15 | M4-S14 Artifact reference model | M4-S6 | Post-flip: references are cheap now and expensive to retrofit |

