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
- Milestones still gate: M1 stories start after the M0 exit criteria, M2
  after M1, and so on; ranks below cross milestone boundaries only where
  the milestone gates have passed.

## Order

| # | Story | Depends on | Why here |
|---|---|---|---|
| 1 | M0-S1 Monorepo scaffold and toolchain | none | Everything builds on the scaffold |
| 2 | M0-S2 Branding seam and working name | M0-S1 | Every name-derived value traces here; lands before anything reads a name |
| 3 | M0-S3 Result contract and error table | M0-S1 | Every command consumes the envelope and error table |
| 4 | M0-S4 Config layer | M0-S1, M0-S2, M0-S3 | Credentials and paths resolve through config; adapters and state wait on it |
| 5 | M0-S5 State layer | M0-S1, M0-S2, M0-S3 | Ledger, registry, and event storage; verify change and status wait on it |
| 6 | M0-S10 pm-notes and registry lint, phase transitions | M0-S1, M0-S3, M0-S5 | Delivered before verify change; the two run as one bundle |
| 7 | M0-S12 Primitive ports, credential port, embedded metadata | M0-S1, M0-S3, M0-S4 | Contracts level of the adapter line; everything client-shaped builds on these ports |
| 8 | M0-S19 Client seeds with trap catalogs | M0-S12 | The Jira read slice must precede the status tracker collector; CI gates need the clients |
| 9 | M0-S8 verify change and exit taxonomy | M0-S5, M0-S10 | Protected-subset item; delivers with the lint bundle above it |
| 10 | M0-S9 verify gates v1 | M0-S8, M0-S19 | Protected-subset item; gate battery reads CI through the client seeds |
| 11 | M0-S6 status v1 | M0-S5, M0-S19 | Protected-subset item; the first call of every session; providers collector reads config and parks, not the engine |
| 12 | M0-S7 queue ready | M0-S6 | Small read-only slice over the collectors; completes the protected path front end |
| 13 | M0-S13 provider v1 | M0-S3, M0-S4, M0-S12 | Protected-subset item; resolves through the credential port from M0-S12 |
| 14 | M0-S14 closeout v1 | M0-S19 | Protected-subset item; last of the relief promise |
| 15 | M0-S15 Privacy and no-cloud guards | M0-S1 | First floater after the protected path: privacy discipline is day-one, but nothing in weeks 1-4 should displace the relief set |
| 16 | M0-S18 License registry | M0-S1 | Floater; the gate should exist before the dependency count grows further |
| 17 | M0-S11 db session-admin port | M0-S1, M0-S3 | Small, independent; a natural breather between larger stories |
| 18 | M0-S16 Interim mitigations | M0-S4 | Docs and config only; documents the bash-era behavior the new stack replaces |
| 19 | M0-S20 Adapter conformance suite v1 | M0-S19 | Floater: quality infrastructure that gates adapter changes from here on; lands within M0 but after the relief set |
| 20 | M0-S17 Decision records and measurement baseline | none | No code dependencies, but it gates M0 exit (names and ADRs locked); baselines can be captured from day one in parallel |
| 21 | M1-S1 Watchdog and lane contracts | M0-S5 | First M1 story: the lying-liveness class is the M1 theme |
| 22 | M1-S2 State validation everywhere | M0-S5 | Validation mechanism lands early so every later registry is born validated; coverage extends as new artifact types ship |
| 23 | M1-S3 doctor v1 | M0-S6, M0-S13 | Diagnostics before transactions: doctor catches wiring problems before merge automation leans on them |
| 24 | M1-S4 Merge and verify-deploy engine | M0-S9 | Merge-as-transaction is the highest-value M1 relief after diagnostics |
| 25 | M1-S6 Brief render-only v0 | M0-S6 | Render path before SLA mechanics so aging has a surface to appear on |
| 26 | M1-S5 Owner-gate SLA | M0-S6 | Ranked after the brief so SLA aging is visible the moment it exists |
| 27 | M1-S7 Minimal MCP | M0-S6, M0-S8, M0-S9 | Mirrors only proven engines; all three engines exist by this point |
| 28 | M1-S8 OSS retro pipeline | M0-S5, M1-S2 | Evidence infrastructure before the stories that consume it (capsules, ceremonies) |
| 29 | M1-S11 Harness adapters and dispatch portability | M0-S12, M0-S13 | The dispatch pilot needs the harness port; telemetry extraction rides the same story |
| 30 | M1-S9 Dispatch dual-run pilot | M0-S8, M1-S11 | Dual-run starts the moment the harness adapter exists; verify-change evidence accumulates toward the M2 handover |
| 31 | M1-S12 Change capsule completion and closeout promotion | M0-S5, M0-S14, M1-S8 | Capsules and candidates last in M1; memory record tooling arrives in M2-S8, promotion writes the tree directly until then |
| 32 | M1-S10 status collector expansion | M0-S6 | Flexible filler: independent of the M1 core line; slot wherever a gap opens |
| 33 | M2-S1 Queue, lanes, dispatch | M1-S9 | The M2 keystone; starts the two-clean-weeks clock after dual-run evidence |
| 34 | M2-S2 Supervise | M1-S1, M2-S1 | Supervision consumes the lanes it watches |
| 35 | M2-S3 Ceremony runner | M0-S6, M0-S13, M1-S8 | Provider resolver and retro evidence both exist; ceremonies compact the loop the queue just automated |
| 36 | M2-S10 Retro action registry and follow-through | M1-S8 | Ranked after the ceremony runner so follow-through rituals attach to an existing cadence; the board surface joins at M2-S4 |
| 37 | M2-S4 Board | M1-S5, M2-S1 | One screen over lanes, gates, owner asks; all sources exist by here |
| 38 | M2-S5 Steer | M0-S10, M1-S11 | Message contract over the phase ledger and harness sessions; both stable at this point |
| 39 | M2-S6 Metrics and spend | M1-S11, M2-S3 | Ceremony share needs ceremonies running to be measurable |
| 40 | M2-S7 Suite-to-job mapping in gates | M0-S9 | Independent of the orchestration line; ranked here to close the merge-integrity gap before the memory line starts; slot earlier if gates drift in practice |
| 41 | M2-S8 Memory records, layout, and lint | M1-S12 | Consumes the capsules M1-S12 produces; the memory line is self-contained from here |
| 42 | M2-S9 Memory conventions in bootstrap templates | M2-S8 | Templates describe the layout the previous story defines |
| 43 | M3-S3 Adapter completion | M0-S19, M0-S20 | First M3 story: full GitHub adapter unblocks self-hosted dogfooding for everything after it |
| 44 | M3-S1 Harness surfaces | M1-S11 | Generated plugin surfaces over the adapter port |
| 45 | M3-S2 Full MCP | M1-S7 | Batch semantics over the proven minimal surface |
| 46 | M3-S4 Validators and deploy checklist | M0-S10 | Extends the lint family; independent of surfaces |
| 47 | M3-S5 Policy engine | M0-S19 | Fleet check and apply through the write path; typed policy documents keep the autonomy kind open |
| 48 | M3-S6 Workspace utilities | M0-S4, M0-S5 | Safety-rail utilities; independent filler in the M3 line |
| 49 | M3-S8 Memory command family | M2-S8 | Commands over the canonical records |
| 50 | M3-S9 Memory compiler to harness surfaces | M2-S8, M3-S1 | Last generator: compiles memory into the surfaces M3-S1 established |
| 51 | M3-S7 v1.0 internal readiness and bash deprecation | M2-S1, M2-S2, M2-S3, M2-S6 | Deliberately last in M3: parity evidence requires every replaced engine delivered and measured |
| 52 | M4-S1 Naming freeze and rename | M0-S2 | At M4 start so every name-derived surface exists before the freeze |
| 53 | M4-S3 Docs, license registry, and public materials | M0-S18 | Finalized before first publication; written continuously from M0, closed out here |
| 54 | M4-S2 Publication and release automation | M0-S17, M3-S7, M4-S1 | The release job follows the frozen name and the readiness verdict |
| 55 | M4-S4 Merge the tooling branch to the default branch | M4-S2 | Installs move to the default branch only after a real release |
| 56 | M4-S5 Bash stack retirement | M3-S7, M4-S4 | Wrappers outlived their purpose once installs come from the default branch |
| 57 | M4-S6 Extension hooks | M0-S5 | Release-neutral opt-in sink; last because nothing local depends on it |

## Maintenance

Re-rank at milestone boundaries and after any retro that changes the
pain order; dependency edits happen in
[backlog.md](backlog.md) first, this file follows. When a story is
re-ranked without a dependency change, note why in its row.
