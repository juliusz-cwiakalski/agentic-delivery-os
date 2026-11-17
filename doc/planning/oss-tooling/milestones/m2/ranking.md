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


# M2 — suggested delivery order

| # | Story | Depends on | Why here |
|---|---|---|---|
| 1 | M2-S2 Supervise | M1-S1, M1-S18 | Supervision battery consumes the daemon's lanes |
| 2 | M2-S3 Ceremony runner | M0-S6, M0-S13, M1-S8 | Provider resolver and retro evidence both exist; ceremonies compact the loop the daemon just automated |
| 3 | M2-S10 Retro action registry and follow-through | M1-S8 | Ranked after the ceremony runner so follow-through rituals attach to an existing cadence; the board surface joins at M2-S4 |
| 4 | M2-S4 Board | M1-S5, M1-S17 | One screen over lanes, gates, owner asks; all sources exist by here |
| 5 | M2-S5 Steer | M0-S10, M1-S11 | Message contract over the phase ledger and harness sessions; both stable at this point |
| 6 | M2-S6 Metrics and spend | M1-S19, M2-S3 | Ceremony share needs ceremonies running to be measurable; spend engine exists from M1-S19 |
| 7 | M2-S7 Suite-to-job mapping in gates | M0-S9 | Independent of the orchestration line; ranked here to close the merge-integrity gap before the memory line starts; slot earlier if gates drift in practice |
| 8 | M2-S8 Memory records, layout, and lint | M1-S12 | Consumes the capsules M1-S12 produces; the memory line is self-contained from here |
| 9 | M2-S9 Memory conventions in bootstrap templates | M2-S8 | Templates describe the layout the previous story defines |
| 10 | M2-S11 Multi-repository workstations | M0-S5, M1-S17 | State scoping exists; the overview unblocks board, groups, and cross-repository work |
| 11 | M2-S12 Evidence inspection and divergence resolution | M1-S9 | Dispatch evidence exists from M1-S9; inspection precedes engine-first operations and cross-repository changes |
| 12 | M2-S13 Public event taxonomy | M1-S18 | Daemon events exist; the public taxonomy unblocks queue lifecycle and engine-first operations |
| 13 | M2-S14 Harness telemetry v2 | M1-S11, M1-S15, M1-S19, M1-S22 | Every telemetry source is delivered; metrics and spend v2 read these facts next |
| 14 | M2-S15 Queue lifecycle completion | M1-S9, M1-S17, M1-S18, M2-S13 | Queue engine and event taxonomy exist; completion hardens the lifecycle before engine-first operations |
| 15 | M2-S16 Engine-first delivery operations | M1-S9, M1-S18, M1-S21, M2-S12, M2-S13, and the owner-hold hook change (#280) | Evidence inspection and taxonomy exist; the engine line is hardened before provider pausing |
| 16 | M2-S17 Provider-aware peak pausing | M1-S15, M1-S18, M1-S21, M1-S22, M2-S14, and the owner-hold semantics (#280) | Needs telemetry v2 and provider profiles; the cost-control story closes the M2 engine line |
| 17 | M2-S18 Project groups | M2-S11 | Depends on multi-repository workstations; groups extend the flat record set after the rename boundary |
| 18 | M2-S19 Cross-repository changes | M2-S11, M2-S18, M1-S17 | Depends on workstations and groups; the cross-repository lifecycle is the last planned M2 delivery |
| 19 | M2-S20 Milestone-first planning and delivery | none | Depends on nothing; the planning rule lands after the engine line so the corpus repair describes delivered scope |
