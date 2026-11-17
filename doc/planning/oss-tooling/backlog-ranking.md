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


# Backlog ranking — unplanned ideas

| 63 | M3-S3 Adapter completion | M0-S19, M0-S20 | First M3 story: full GitHub adapter unblocks self-hosted dogfooding for everything after it |
| 64 | M3-S1 Harness surfaces | M1-S11 | Generated plugin surfaces over the adapter port |
| 65 | M3-S2 Full MCP | M1-S7 | Batch semantics over the proven minimal surface |
| 66 | IDEA-S1 Validators and deploy checklist | M0-S10 | Extends the lint family; independent of surfaces |
| 67 | IDEA-S2 Policy engine | M0-S19 | Fleet check and apply through the write path; typed policy documents keep the autonomy kind open |
| 68 | IDEA-S3 Workspace utilities | M0-S4, M0-S5 | Safety-rail utilities; independent filler in the M3 line |
| 69 | IDEA-S5 Memory command family | M2-S8 | Commands over the canonical records |
| 70 | IDEA-S6 Memory compiler to harness surfaces | M2-S8, M3-S1 | Last generator: compiles memory into the surfaces M3-S1 established |
| 71 | IDEA-S4 v1.0 internal readiness and bash deprecation | M1-S18, M2-S2, M2-S3, M2-S6 | Deliberately last in M3: parity evidence requires every replaced engine delivered and measured |
