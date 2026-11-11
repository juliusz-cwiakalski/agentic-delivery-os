# M2 milestone pack: engine-first operations, multi-repository workstations, evidence inspection, and telemetry

The M2 end state, written down before delivery so each story starts from a
committed blueprint instead of a ticket memory. Story numbers reference the
canonical scope source, [../../backlog.md](../../backlog.md); the pack
conventions are in [../README.md](../README.md); the M1 snapshot stays in
[../m1/architecture.md](../m1/architecture.md).

## Status semantics

Everything in this pack is **planned until M2 exit**: it records the intended
end state, not delivered behaviour. Command pages carry the pack status header
`Status: Proposed (M2)`, and a page or section becomes a snapshot only when the
milestone exits. Refinements land in the pack, not in ticket comments, so the
owner can review the planned shape in one place.

## Pack contents

The pack intentionally deviates from the generic contents table in
[../README.md](../README.md): it ships **no `man-page.md`** and **no
`interactions.md`**, and ships `entrypoint-delta.md` instead. The command
contracts are already per-family pages under `commands/`, and the root-entry
delta is a dated observation rather than a second man page; the deviation is
deliberate and the generic table is left unchanged until milestone exit.

| Artifact | Purpose |
|---|---|
| `README.md` | Pack index: how to read, story-to-artifact map, deviation note |
| [architecture.md](architecture.md) | C4 context, containers, and components for the M2 end state, the three-level domain model, the eight key flows, including the S17 park/resume flow and the cross-repository change flow, persistence and concurrency deltas, boundary invariants |
| [contracts.md](contracts.md) | Shared contract continuity plus `repos.v1`, the group contract `project-groups.v1`, the delivered `projects.v1` payload, the project configuration document, the cross-repository change plan shape, `attempts.v1`, event taxonomy v1, `telemetry.v1`, queue lifecycle mutations, `spend` v2, and the provider-profile and peak-window additions |
| [test-scenarios.md](test-scenarios.md) | `SC-M2-*` scenario seeds for stories S2 through S19, the inherited starting point for each story's test plan |
| [journeys.md](journeys.md) | Operator journeys: multi-repository morning overview, evidence before handover, retro on telemetry, steering a running delivery, the S17 cost-control journey |
| [entrypoint-delta.md](entrypoint-delta.md) | Root entry listing delta, the M2-planned additions, and the closed daemon registration gap |
| [commands/repos.md](commands/repos.md) | Flat record set owned by M2-S18: the five reported fields, `repos.v1`, and the `repos list` surface |
| [commands/projects.md](commands/projects.md) | Group command contract: `project-groups.v1` with `groupKey`, configured groups with members, health, state, and group-scoped reads |
| [commands/attempts.md](commands/attempts.md) | `dispatch attempts` evidence read-side contract |
| [commands/events.md](commands/events.md) | Subscribe event-taxonomy reference contract |
| [commands/spend.md](commands/spend.md) | Spend v2 breakdown contract |
| [commands/queue.md](commands/queue.md) | Queue lifecycle verb contract |
| [commands/board.md](commands/board.md) | Full M2 board contract |

## Story-to-artifact map

| Story | Architecture flow | Contract surface | Scenario seeds |
|---|---|---|---|
| M2-S2 Supervise | none in this pack | none in this pack | SC-M2-S2-01, SC-M2-S2-02 |
| M2-S3 Ceremony runner | none in this pack | `phase.state` topic (advisory: consumed at delivery; the owning story declares the edge) | SC-M2-S3-01, SC-M2-S3-02 |
| M2-S4 Board | multi-repository overview | `projects.v1` delivered payload; the board consumes repository keys and the host index | SC-M2-S4-01, SC-M2-S4-02 |
| M2-S5 Steer | none in this pack | `phase.state` topic (advisory: consumed at delivery; the owning story declares the edge) | SC-M2-S5-01, SC-M2-S5-02 |
| M2-S6 Metrics and spend | telemetry attribution | `telemetry.v1`, `spend` v2 | SC-M2-S6-01, SC-M2-S6-02 |
| M2-S7 Suite-to-job mapping in gates | none in this pack | none in this pack | SC-M2-S7-01, SC-M2-S7-02 |
| M2-S8 Memory records | none in this pack | none in this pack | SC-M2-S8-01, SC-M2-S8-02 |
| M2-S9 Memory conventions in bootstrap | none in this pack | none in this pack | SC-M2-S9-01, SC-M2-S9-02 |
| M2-S10 Retro action registry | telemetry attribution | `telemetry.v1` (advisory: consumed at delivery; the owning story declares the edge) | SC-M2-S10-01, SC-M2-S10-02 |
| M2-S11 Multi-repository workstations | multi-repository overview | the delivered `projects.v1` payload (`data.projects[]`, `projectKey`) | SC-M2-S11-01, SC-M2-S11-02 |
| M2-S12 Evidence inspection and divergence resolution | attempt-history inspection and divergence resolution | `attempts.v1` | SC-M2-S12-01, SC-M2-S12-02 |
| M2-S13 Public event taxonomy | C4 Level 3 event components | event taxonomy v1 | SC-M2-S13-01, SC-M2-S13-02 |
| M2-S14 Harness telemetry v2 | telemetry attribution | `telemetry.v1`, `spend` v2 | SC-M2-S14-01, SC-M2-S14-02 |
| M2-S15 Queue lifecycle completion | queue auto-release after merge and closeout | queue lifecycle mutations, single-flight | SC-M2-S15-01, SC-M2-S15-02, SC-M2-S15-03 |
| M2-S16 Engine-first delivery operations | single-flight refusal across dispatch paths, handover-gate evaluation | `attempts.v1`, event taxonomy v1 | SC-M2-S16-01, SC-M2-S16-02 |
| M2-S17 Provider-aware peak pausing | S17 park and resume under a provider peak | provider profile fields, peak-window rule schema, park reasons, resume events | SC-M2-S17-01, SC-M2-S17-02, SC-M2-S17-03, SC-M2-S17-04, SC-M2-S17-05 |
| M2-S18 Project groups | multi-repository overview (group-scoped) | `project-groups.v1`, the project configuration document, the `status --project <groupKey>` delta, and the superseding decision record | SC-M2-S18-01, SC-M2-S18-02, SC-M2-S18-03, SC-M2-S18-04, SC-M2-S18-05, SC-M2-S18-06, SC-M2-S18-07, SC-M2-S18-08 (the AC-F8-5 alias-shape assertion) |
| M2-S19 Cross-repository changes | cross-repository change | the cross-repository change plan shape (`plan.data.members[]`, `closeout.data.members[]`, `verify gates`) | SC-M2-S19-01, SC-M2-S19-02, SC-M2-S19-03, SC-M2-S19-04, SC-M2-S19-05 |

## How to read

1. Start with the story entry in [../../backlog.md](../../backlog.md); it is
   canonical for scope, acceptance, and dependencies.
2. Read the architecture flow this story changes, then the contract surface it
   implements; a `none in this pack` row is owned by an M1 or M3 surface, and
   only its scenario seeds live here.
3. Inherit the scenario seeds as the first draft of the story's test plan and
   reconcile them at delivery.

Story codes, not file positions, identify stories. This pack references story
codes instead of restating their acceptance blocks.
