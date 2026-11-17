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


# M0 — suggested delivery order

| # | Story | Depends on | Why here |
|---|---|---|---|
| 1 | M0-S1 (GH-170) Monorepo scaffold and toolchain | none | Everything builds on the scaffold |
| 2 | M0-S2 (GH-171) Branding seam and working name | M0-S1 | Every name-derived value traces here; lands before anything reads a name |
| 3 | M0-S3 (GH-172) Result contract and error table | M0-S1 | Every command consumes the envelope and error table |
| 4 | M0-S4 (GH-173) Config layer | M0-S1, M0-S2, M0-S3 | Credentials and paths resolve through config; adapters and state wait on it |
| 5 | M0-S5 (GH-174) State layer | M0-S1, M0-S2, M0-S3 | Ledger, registry, and event storage; verify change and status wait on it |
| 6 | M0-S10 pm-notes and registry lint, phase transitions | M0-S1, M0-S3, M0-S5 | Delivered before verify change; the two run as one bundle |
| 7 | M0-S12 (GH-181) Primitive ports, credential port, embedded metadata | M0-S1, M0-S3, M0-S4 | Contracts level of the adapter line; everything client-shaped builds on these ports |
| 8 | M0-S19 (GH-188) Client seeds with trap catalogs | M0-S12 | The Jira read slice must precede the status tracker collector; CI gates need the clients |
| 9 | M0-S8 verify change and exit taxonomy | M0-S5, M0-S10 | Protected-subset item; delivers with the lint bundle above it |
| 10 | M0-S9 verify gates v1 | M0-S8, M0-S19 | Protected-subset item; gate battery reads CI through the client seeds |
| 11 | M0-S6 status v1 | M0-S5, M0-S19 | Protected-subset item; the first call of every session; providers collector reads config and parks, not the engine |
| 12 | M0-S7 queue ready | M0-S6 | Small read-only slice over the collectors; completes the protected path front end |
| 13 | M0-S13 provider v1 | M0-S3, M0-S4, M0-S12 | Protected-subset item; resolves through the credential port from M0-S12 |
| 14 | M0-S14 closeout v1 | M0-S19 | Protected-subset item; last of the relief promise |
| 15 | M0-S15 (GH-184) Privacy and no-cloud guards | M0-S1 | First floater after the protected path: privacy discipline is day-one, but nothing in weeks 1-4 should displace the relief set |
| 16 | M0-S18 (GH-187) License registry | M0-S1 | Floater; the gate should exist before the dependency count grows further |
| 17 | M0-S11 db session-admin port | M0-S1, M0-S3 | Small, independent; a natural breather between larger stories |
| 18 | M0-S16 (GH-185) Interim mitigations | M0-S4 | Docs and config only; documents the bash-era behavior the new stack replaces |
| 19 | M0-S20 (GH-189) Adapter conformance suite v1 | M0-S19 | Floater: quality infrastructure that gates adapter changes from here on; lands within M0 but after the relief set |
| 20 | M0-S17 (GH-186) Decision records and measurement baseline | none | No code dependencies, but it gates M0 exit (names and ADRs locked); baselines can be captured from day one in parallel |
