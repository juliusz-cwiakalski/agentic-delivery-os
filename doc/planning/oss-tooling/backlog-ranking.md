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

## Order

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
| 21 | M1-S1 Watchdog and lane contracts | M0-S5 | First M1 story: the lying-liveness class is the M1 theme; every later lane consumer builds on the contracts |
| 22 | M1-S2 State validation everywhere | M0-S5 | Validation mechanism lands early so every later registry is born validated |
| 23 | M1-S22 Command audit ledger and agent identity | M0-S3, M0-S5 | Small infra landed early: the ledger is what lets scripted outputs trim context fields every later story emits, and it captures caller identity from day one |
| 24 | M1-S3 doctor v1 | M0-S6, M0-S13 | Diagnostics before transactions: doctor catches wiring problems before merge automation and the daemon lean on them |
| 25 | M1-S4 Merge and verify-deploy engine | M0-S9, M0-S4 | Merge-as-transaction is the highest-value relief (R1); also a truth engine the daemon is sequenced behind |
| 26 | M1-S13 Machine-readable delivery plan schema | M0-S5, M0-S10 | The engine's input: lands before the scheduling engine and before agent integration; unblocks parallel planning immediately |
| 27 | M1-S14 Commit primitive and phase-transition commits | M0-S3, M0-S10 | Small and independent; pairs with the plan schema so agent integration has both primitives; auto-commit-on-transition default ships here |
| 28 | M1-S6 Brief render-only v0 | M0-S6 | Render path before SLA mechanics so aging has a surface to appear on |
| 29 | M1-S5 Owner-gate SLA | M0-S6 | Ranked after the brief so SLA aging is visible the moment it exists |
| 30 | M1-S16 Typed blocker and question channel | M0-S5, M1-S5 | Second audience of the SLA mechanism; converts lane-idle hours into seconds before the daemon needs it |
| 31 | M1-S7 Minimal MCP | M0-S6, M0-S8, M0-S9 | Mirrors only proven engines; all three engines exist by this point |
| 32 | M1-S8 OSS retro pipeline | M0-S5, M1-S2 | Evidence infrastructure before the stories that consume it (capsules, ceremonies) |
| 33 | M1-S11 Harness adapters and dispatch portability | M0-S12, M0-S13 | The dispatch pilot needs the harness port; telemetry extraction rides the same story and feeds spend |
| 34 | M1-S21 Model profiles and provider watching | M0-S13, M1-S11 | Rides the spawn path the adapters establish: profile resolution on every spawn, watching, auto-switch with revert, pacing as config |
| 35 | M1-S15 Session lifecycle economics | M1-S1, M1-S11 | Truth engine (R5): must land before the daemon so the dispatcher never kills a prefilling session |
| 36 | M1-S19 Spend read side and resume amplification | M1-S11 | Read side early (R9): waste classes become visible the moment telemetry exists |
| 37 | M1-S17 Scheduling engine: queue, lanes, dependency batching | M0-S7, M0-S13, M1-S2, M1-S4, M1-S13, M1-S15 | Sequenced behind the truth and transaction engines (constraint 1): its one-shot mode executes deliveries, so merge safety, session economics, validated state, and declared plans are hard prerequisites |
| 38 | M1-S18 Resident dispatch daemon | M1-S4, M1-S15, M1-S16, M1-S17 | Constraint 1 made structural: the dispatcher goes live only after merge-as-transaction, session economics, typed blockers (it applies answers), and the scheduling engine are proven; one-shot mode shipped with the queue keeps a bash-free fallback |
| 39 | M1-S9 Dispatch engine: dual-run evidence and per-repo handover | M0-S8, M1-S11, M1-S17, M1-S18 | Milestone closer: handover per repo happens only after that repo's two clean weeks of dual-run evidence (accrual itself starts when the one-shot queue ships, at rank 37; the dwell-time risk of the clock starting this late is accepted and recorded) |
| 40 | M1-S12 Change capsule completion and closeout expansion | M0-S5, M0-S14, M1-S8, M1-S11 | Capsules and closeout residue; telemetry preservation AC bridges the S11 capture through the rewrite |
| 41 | M1-S23 Coordinator supervision | M1-S15, M1-S16 | Replaces ceo-loop.sh's actual function (context resume, stuck detection, kill, budget, wake-on-question); must exist before agent integration claims the coordinator loop is managed |
| 42 | M1-S20 Agent integration: prompts consume the tooling | M0-S10, M1-S4, M1-S10, M1-S13, M1-S14, M1-S16, M1-S17 | Last of the M1 line: prompts reference surfaces that all exist by here, and the J1 end-to-end AC closes the loop (S23 supervision included via S16) |
| 43 | M1-S10 status collector expansion | M0-S6 | Flexible filler: independent of the M1 core line; slot wherever a gap opens |
| 44 | M2-S2 Supervise | M1-S1, M1-S18 | Supervision battery consumes the daemon's lanes |
| 45 | M2-S3 Ceremony runner | M0-S6, M0-S13, M1-S8 | Provider resolver and retro evidence both exist; ceremonies compact the loop the daemon just automated |
| 46 | M2-S10 Retro action registry and follow-through | M1-S8 | Ranked after the ceremony runner so follow-through rituals attach to an existing cadence; the board surface joins at M2-S4 |
| 47 | M2-S4 Board | M1-S5, M1-S17 | One screen over lanes, gates, owner asks; all sources exist by here |
| 48 | M2-S5 Steer | M0-S10, M1-S11 | Message contract over the phase ledger and harness sessions; both stable at this point |
| 49 | M2-S6 Metrics and spend | M1-S19, M2-S3 | Ceremony share needs ceremonies running to be measurable; spend engine exists from M1-S19 |
| 50 | M2-S7 Suite-to-job mapping in gates | M0-S9 | Independent of the orchestration line; ranked here to close the merge-integrity gap before the memory line starts; slot earlier if gates drift in practice |
| 51 | M2-S8 Memory records, layout, and lint | M1-S12 | Consumes the capsules M1-S12 produces; the memory line is self-contained from here |
| 52 | M2-S9 Memory conventions in bootstrap templates | M2-S8 | Templates describe the layout the previous story defines |
| 53 | M3-S3 Adapter completion | M0-S19, M0-S20 | First M3 story: full GitHub adapter unblocks self-hosted dogfooding for everything after it |
| 54 | M3-S1 Harness surfaces | M1-S11 | Generated plugin surfaces over the adapter port |
| 55 | M3-S2 Full MCP | M1-S7 | Batch semantics over the proven minimal surface |
| 56 | M3-S4 Validators and deploy checklist | M0-S10 | Extends the lint family; independent of surfaces |
| 57 | M3-S5 Policy engine | M0-S19 | Fleet check and apply through the write path; typed policy documents keep the autonomy kind open |
| 58 | M3-S6 Workspace utilities | M0-S4, M0-S5 | Safety-rail utilities; independent filler in the M3 line |
| 59 | M3-S8 Memory command family | M2-S8 | Commands over the canonical records |
| 60 | M3-S9 Memory compiler to harness surfaces | M2-S8, M3-S1 | Last generator: compiles memory into the surfaces M3-S1 established |
| 61 | M3-S7 v1.0 internal readiness and bash deprecation | M1-S18, M2-S2, M2-S3, M2-S6 | Deliberately last in M3: parity evidence requires every replaced engine delivered and measured |
| 62 | M4-S1 Naming freeze and rename | M0-S2 | At M4 start so every name-derived surface exists before the freeze |
| 63 | M4-S3 Docs, license registry, and public materials | M0-S18 | Finalized before first publication; written continuously from M0, closed out here |
| 64 | M4-S2 Publication and release automation | M0-S17, M3-S7, M4-S1 | The release job follows the frozen name and the readiness verdict |
| 65 | M4-S4 Merge the tooling branch to the default branch | M4-S2 | Installs move to the default branch only after a real release |
| 66 | M4-S5 Bash stack retirement | M3-S7, M4-S4 | Wrappers outlived their purpose once installs come from the default branch |
| 67 | M4-S6 Extension hooks | M0-S5 | Release-neutral opt-in sink; last because nothing local depends on it |

## Maintenance

Re-rank at milestone boundaries and after any retro that changes the
pain order; dependency edits happen in
[backlog.md](backlog.md) first, this file follows. When a story is
re-ranked without a dependency change, note why in its row.
