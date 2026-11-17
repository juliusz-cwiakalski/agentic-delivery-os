---
# Copyright (c) 2025-2026 Juliusz Ćwiąkalski (https://www.cwiakalski.com | https://www.linkedin.com/in/juliusz-cwiakalski/ | https://www.x.com/cwiakalski)
# Apache-2.0 License - see LICENSE file for full terms
source: https://github.com/juliusz-cwiakalski/agentic-delivery-os/blob/main-tools/doc/planning/oss-tooling/backlog-ranking.md
---
# Backlog ranking: suggested delivery order

Stories from [backlog.md](backlog.md) top to bottom in the suggested
delivery order. This file lists only stories, their dependencies, and
where needed a comment on why a story sits at this position. Dependency
values are strict (from the backlog); comments explain placements the
dependencies alone do not force.

Reading notes:

- With per-repo single-flight, early delivery is near-linear; the order
  below is the serial default. Where the delivery loop frees capacity
  (multiple repos, or the parallel mode later), stories that only depend
  on landed work can run concurrently - the rank is a tiebreak, not a
  lock.
- Milestones still gate, with one recorded amendment (roadmap.md, M0 exit
  amendment, 2026-11-03): M1 delivery starts now while the M0 dual-run
  pilot runs concurrently; stories that touch dispatch handover still
  respect the per-repo two-clean-weeks evidence rule. M2 starts after
  M1, and so on; ranks below cross milestone boundaries only where the
  milestone gates have passed.


# M1 — suggested delivery order

| # | Story | Depends on | Why here |
|---|---|---|---|
| 1 | M1-S1 Watchdog and lane contracts | M0-S5 | First M1 story: the lying-liveness class is the M1 theme; every later lane consumer builds on the contracts |
| 2 | M1-S2 State validation everywhere | M0-S5 | Validation mechanism lands early so every later registry is born validated |
| 3 | M1-S22 Command audit ledger and agent identity | M0-S3, M0-S5 | Small infra landed early: the ledger is what lets scripted outputs trim context fields every later story emits, and it captures caller identity from day one |
| 4 | M1-S3 doctor v1 | M0-S6, M0-S13 | Diagnostics before transactions: doctor catches wiring problems before merge automation and the daemon lean on them |
| 5 | M1-S4 Merge and verify-deploy engine | M0-S9, M0-S4 | Merge-as-transaction is the highest-value relief (R1); also a truth engine the daemon is sequenced behind |
| 6 | M1-S13 Machine-readable delivery plan schema | M0-S5, M0-S10 | The engine's input: lands before the scheduling engine and before agent integration; unblocks parallel planning immediately |
| 7 | M1-S14 Commit primitive and phase-transition commits | M0-S3, M0-S10 | Small and independent; pairs with the plan schema so agent integration has both primitives; auto-commit-on-transition default ships here |
| 8 | M1-S6 Brief render-only v0 | M0-S6 | Render path before SLA mechanics so aging has a surface to appear on |
| 9 | M1-S5 Owner-gate SLA | M0-S6 | Ranked after the brief so SLA aging is visible the moment it exists |
| 10 | M1-S16 Typed blocker and question channel | M0-S5, M1-S5 | Second audience of the SLA mechanism; converts lane-idle hours into seconds before the daemon needs it |
| 11 | M1-S7 Minimal MCP | M0-S6, M0-S8, M0-S9 | Mirrors only proven engines; all three engines exist by this point |
| 12 | M1-S8 OSS retro pipeline | M0-S5, M1-S2 | Evidence infrastructure before the stories that consume it (capsules, ceremonies) |
| 13 | M1-S11 Harness adapters and dispatch portability | M0-S12, M0-S13 | The dispatch pilot needs the harness port; telemetry extraction rides the same story and feeds spend |
| 14 | M1-S21 Model profiles and provider watching | M0-S13, M1-S11 | Rides the spawn path the adapters establish: profile resolution on every spawn, watching, auto-switch with revert, pacing as config |
| 15 | M1-S15 Session lifecycle economics | M1-S1, M1-S11 | Truth engine (R5): must land before the daemon so the dispatcher never kills a prefilling session |
| 16 | M1-S19 Spend read side and resume amplification | M1-S11 | Read side early (R9): waste classes become visible the moment telemetry exists |
| 17 | M1-S17 Scheduling engine: queue, lanes, dependency batching | M0-S7, M0-S13, M1-S2, M1-S4, M1-S13, M1-S15 | Sequenced behind the truth and transaction engines (constraint 1): its one-shot mode executes deliveries, so merge safety, session economics, validated state, and declared plans are hard prerequisites |
| 18 | M1-S18 Resident dispatch daemon | M1-S4, M1-S15, M1-S16, M1-S17 | Constraint 1 made structural: the dispatcher goes live only after merge-as-transaction, session economics, typed blockers (it applies answers), and the scheduling engine are proven; one-shot mode shipped with the queue keeps a bash-free fallback |
| 19 | M1-S9 Dispatch engine: dual-run evidence and per-repo handover | M0-S8, M1-S11, M1-S17, M1-S18 | Milestone closer: handover per repo happens only after that repo's two clean weeks of dual-run evidence (accrual itself starts when the one-shot queue ships, at rank 37; the dwell-time risk of the clock starting this late is accepted and recorded) |
| 20 | M1-S12 Change capsule completion and closeout expansion | M0-S5, M0-S14, M1-S8, M1-S11 | Capsules and closeout residue; telemetry preservation AC bridges the S11 capture through the rewrite |
| 21 | M1-S23 Coordinator supervision | M1-S15, M1-S16 | Replaces ceo-loop.sh's actual function (context resume, stuck detection, kill, budget, wake-on-question); must exist before agent integration claims the coordinator loop is managed |
| 22 | M1-S20 Agent integration: prompts consume the tooling | M0-S10, M1-S4, M1-S10, M1-S13, M1-S14, M1-S16, M1-S17 | Last of the M1 line: prompts reference surfaces that all exist by here, and the J1 end-to-end AC closes the loop (S23 supervision included via S16) |
| 23 | M1-S10 status collector expansion | M0-S6 | Flexible filler: independent of the M1 core line; slot wherever a gap opens |
