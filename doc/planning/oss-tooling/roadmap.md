---
# Copyright (c) 2025-2026 Juliusz Ćwiąkalski (https://www.cwiakalski.com | https://www.linkedin.com/in/juliusz-cwiakalski/ | https://x.com/cwiakalski)
# Apache-2.0 License - see LICENSE file for full terms
source: https://github.com/juliusz-cwiakalski/agentic-delivery-os/blob/main-tools/doc/planning/oss-tooling/roadmap.md
---
# OSS tooling roadmap

Direction for the open-source tooling: a TypeScript CLI plus MCP server plus
opencode-native surface over one shared typed core (per
[ADR-0003](../../decisions/ADR-0003-oss-monorepo-structure.md)). Milestones
M0-M4 are in scope for this repository. Later directions exist but are not
planned here. Story-level scope lives in [backlog.md](backlog.md); the
command surface lives in [cli-command-registry.md](cli-command-registry.md);
the usage flows live in [user-journeys.md](user-journeys.md).

Timelines are directions, not commitments. Sequence and scope are the plan;
dates are adjusted as evidence lands.

## Principles

1. Evidence-first build order: the trust substrate (truthful signals) before
   the de-AI core (scheduling and ceremonies), before optimization.
   Automation built on lying signals compounds the problem.
2. Strangler migration by engine, dual-run, never big-bang; never weaken a
   running gate during migration; the bash stack keeps delivering until each
   replacement passes the same tests.
3. One shared typed core; CLI, MCP, and opencode plugin are thin surfaces;
   no surface-only logic paths. Provider interactions are primitive-mediated:
   agents speak ADOS primitives, adapters translate, the policy layer sits at
   the port boundary, and the raw escape hatch is audited and off by default.
4. Layered configuration per DEC-4 in ADR-0003: fail-closed validation,
   per-key provenance, secrets environment-only. Working name `ados` until
   the naming freeze; everything name-derived comes from the branding
   constant.
5. Open/closed boundary: local function is complete without any hosted
   service; telemetry is schema-versioned and exportable by design.
6. Agent capacity builds the tooling: the delivery process delivers the
   tooling that replaces it (dogfooding from M0).
7. Success measured by outcomes: ceremony share, false-signal count, cycle
   time, cost per accepted delivery. Baselines are captured in M0.
8. Timelines are directions, not commitments.
9. Parked concepts shape seams, not schedules: design concepts in
   [concepts/](../concepts/README.md) that are deliberately unscheduled
   still constrain current design - stories must not hardcode assumptions
   that foreclose them (execution environments, credential sources,
   lease scopes, message contracts). Each concept names its
   compatibility seams; violating one is a design defect.

## Milestones

| MS | Name | Directional horizon | One-line goal |
|---|---|---|---|
| M0 | Trust substrate | weeks 1-4 | Typed core, result contract, status and verify change working end-to-end; verify gates, closeout, provider, and pm-notes validation bundled; the delivery loop usable on real tickets |
| M1 | Attention and minimal surfaces | months 2-3 | Lying-signal class eliminated on migrated engines; merge as a transaction; owner-gate SLA, brief v0, minimal MCP, retro pipeline |
| M2 | Orchestration and measurement | months 3-6 | Scheduling and ceremonies leave LLM context; metrics and spend measured |
| M3 | Surfaces, adapters, validators | months 6-9 | Harness surfaces (opencode, Claude Code) plus full MCP; adapter completion; validators; v1.0 internal readiness with deprecation notices |
| M4 | Public release readiness | after M3 | Naming freeze, publication, docs, merge of the tooling branch to the default branch, bash retirement |

## M0: Trust substrate (weeks 1-4)

Goal: a typed core, a truthful result contract, status and verify change
working end-to-end, the delivery loop usable on real tickets.

Scope: the M0 stories in [backlog.md](backlog.md). Highlights: the
six-package monorepo scaffold with the toolchain gates; the branding seam;
the result contract and error table; layered configuration; the local state
layer; `status` with the tracker collector; `queue ready`; `verify change`;
`verify gates`; pm-notes validation and `change` phase transitions; the
provider engine; `closeout`; privacy guards; the license registry.

Protected subset (must land by week 4): status with the tracker collector,
verify change plus verify gates, provider, closeout, validation bundled with
verify change. Per-repo single-flight means M0 stories serialize; the
protected subset is the weeks 1-4 relief promise. Everything else in M0
floats behind it.

Exit criteria: the pilot repository runs status, verify change, provider,
and closeout beside the bash stack (dual-run, shell still authoritative);
zero false-success incidents on pilot paths over two weeks; this repo
adopts the scaffold.

## M1: Attention and minimal surfaces (months 2-3)

Goal: every signal the fleet acts on is truthful; merge is a transaction;
owner attention is managed with an SLA, a brief, minimal MCP, and a retro
pipeline.

Scope: watchdog and lane contracts; state validation at every boundary;
`doctor`; `merge` plus `verify deploy` (deploy verified by job trace); the
owner-gate SLA; `brief` render-only v0; minimal MCP mirroring proven
engines; the retro pipeline; harness adapters making dispatch
harness-agnostic (opencode first, Claude Code next); the dispatch dual-run
pilot on one repository.

Exit criteria: false-success and lying-liveness counts near zero on migrated
engines; merge near-miss classes structurally impossible.

## M2: Orchestration and measurement (months 3-6)

Goal: scheduling, dispatch waiting, and ceremonies leave LLM context; the
coordinating session stops being a dispatcher.

Scope: `queue`, `lanes`, `dispatch` (single-flight per repository,
preemption, build-weight classes, dispatcher never a lane); `supervise`;
`ceremony` with an enumerated ceremony set; `board`; `steer`; `metrics` and
`spend`; suite-to-job mapping in the gate battery.

Exit criteria: the pilot repository dispatches through the new queue in
production (dual-run retired for dispatch there); ceremony share of active
agent time trending below 40 percent; idle coordination iterations near
zero; owner-gate median age under two days.

## M3: Surfaces, adapters, validators (months 6-9)

Goal: every engine multiplied into every agent session; the tooling
delivers this repository itself; internal v1.0 readiness.

Scope: opencode native integration; full MCP; GitHub and Azure adapters
alongside GitLab and Jira; validators (decision records, frontmatter,
deploy checklist); the policy engine; repository utilities; v1.0 internal
readiness with deprecation notices on the bash stack.

Exit criteria: this repository self-delivers through the new CLI for a
consecutive run of changes; the MCP server is used by coordinating sessions;
every replaced bash command has a working equivalent with a deprecation
notice.

## M4: Public release readiness

Goal: stable, public-ready tooling shipped from the default branch under
the final name.

Scope: the naming freeze and rename drill; publication and release
automation (lockstep versioning, provenance, SBOM, pinned tagged releases
as the stable install source, `ados update`); docs and the license registry
completed; the tooling branch merged into the default branch and retired;
bash stack retirement; neutral extension hooks (an opt-in telemetry sink
and a documented connection point for remote coordination services) that
never gate local function. Hosted capabilities stay outside this
repository.

Exit criteria: a release publishes the public packages at one version; the
install path works from the default branch; the bash stack is retired with
deprecation notices served through the transition window.

## Sequencing constraints

1. The queue dispatcher must not go live before exit contracts are proven
   (the fleet-wedging scenario).
2. Status needs the tri-state contract first.
3. The provider resolver blocks the ceremony runner.
4. MCP follows engines; minimal MCP mirrors only proven engines.
5. Merge and verify must pass the same gate battery the bash era enforced;
   never weaker during migration.
6. Dispatch replaces the bash path per repository only after two clean
   weeks of verify-change evidence there.
7. Naming, license, and release decisions are batched into the owner
   decision window.
8. Structure, toolchain, and configuration decisions are fixed by ADR-0003;
   revisit them only through a new decision record.

## Standing risks

| Risk | Mitigation |
|---|---|
| Big-bang temptation under delivery pressure | Strangler by engine; dual-run exit criteria; shell fallback until parity |
| Second-system ceremony (config that needs an LLM) | Configuration as data, opinionated defaults, no wizards |
| Quality while refactoring the plane | Gates never weaken during migration; parity suites ported first |
| Scope explosion | Every capability must justify itself through attention or throughput; vertical slices from real delivery pain |
| Open-core trust failure | Boundary rule enforced; local factory never crippled |
| Harness and model churn | Capability adapters; harness-agnostic core semantics per ADR-0003 |
| Private-data leak into public artifacts | Privacy guards in CI from M0; public tickets self-contained |

## Delivery mechanics

- All work flows through the 11-phase process (ticket, pull request, squash
  merge) on the `main-tools` branch; the tooling repository installs the
  process on itself.
- The backlog becomes milestone tickets as each milestone starts
  (self-contained, no private references).
- Decisions go through the decision-advisor flow with adversarial review on
  precedent-setting calls.
- Retrospectives after each milestone update this roadmap; numbers are
  re-baselined with native metrics once available.
