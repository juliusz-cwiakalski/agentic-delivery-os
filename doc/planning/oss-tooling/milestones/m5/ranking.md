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


# M5 — suggested delivery order

| # | Story | Depends on | Why here |
|---|---|---|---|
| 1 | M5-S1 Naming freeze and rename | M0-S2 | At M5 start so every name-derived surface exists before the freeze |
| 2 | M5-S3 Docs, license registry, and public materials | M0-S18 | Finalized before first publication; written continuously from M0, closed out here |
| 3 | M5-S2 Publication and release automation | M0-S17, M5-S1 | The release job follows the frozen name and the readiness verdict |
| 4 | M5-S4 Merge the tooling branch to the default branch | M5-S2 | Installs move to the default branch only after a real release |
| 5 | M5-S5 Bash stack retirement | M4-S8, M5-S4 | Wrappers outlived their purpose once installs come from the default branch |
| 6 | M5-S6 Extension hooks (open-source side) | M0-S5 | Ships with the public surface; independent of release mechanics and off by default |
