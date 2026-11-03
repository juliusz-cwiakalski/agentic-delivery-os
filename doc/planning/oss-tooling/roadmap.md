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
| M1 | Delivery engine and autonomous dispatch | months 2-3 | Bash delivery stack replaced: truthful signals, merge as a transaction, machine-readable delivery plans, scheduling engine plus resident daemon; the new stack authoritative on pilot repos |
| M2 | Ceremonies, measurement, and memory | months 3-6 | Supervision battery, ceremonies, board, steer, metrics and spend alarms; the committed memory tree with typed records and lint |
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

M0 exit amendment (2026-11-03, recorded with the M1 re-planning): the
dual-run pilot starts now and runs concurrently with M1 planning and early
M1 stories, which do not touch dispatch; per-engine handover still requires
its own two-clean-weeks evidence, never waived. The Proposed decision
records (as listed in the inception readiness report) remain Proposed
during M1; owner acceptance is formalization tracked there, and merge never
auto-accepts. The M0 milestone stays open until the pilot evidence and
record acceptance land.

## M1: Delivery engine and autonomous dispatch (months 2-3)

Goal: replace the bash delivery stack (`deliver-ticket.sh`,
`batch-deliver.sh`, `ceo-loop.sh`, `pm-liveness.sh`) with the typed delivery
engine: every signal the fleet acts on is truthful, merge is a transaction,
delivery plans are machine-readable with declared per-phase scope, and
scheduling and waiting leave the coordinator's context. The coordinator
plans (priorities, repos, dependencies), answers typed questions, merges,
and closes out; the machinery schedules, waits, and verifies healthy paths.

Scope: truth and transactions (watchdog and lane contracts, state
validation at every boundary, doctor, merge plus verify deploy with the
gate set as data and a tracker freshness bound, session lifecycle
economics); attention surfaces (owner-gate SLA, brief render-only from the
same collector state as the digest, status collector expansion, minimal
MCP, retro pipeline, change capsule and closeout expansion, spend read
side); the engine (machine-readable delivery plan schema, commit primitive,
typed blocker and question channel, scheduling engine with queue and lanes,
resident dispatch daemon with one-shot degradation, harness adapters and
dispatch portability, dispatch dual-run to per-repo handover, agent prompts
consuming the tooling). The recorded operator input is
[operator-requirements-2026-11.md](operator-requirements-2026-11.md).

Sequencing inside M1: the truth engines and the transaction layer land
first; the scheduling engine and daemon land behind them (constraint 1);
the dispatch handover happens per repository only after that repository's
two clean weeks of dual-run evidence (constraint 6). The merge transaction
stays an explicit coordinator action throughout: the daemon may prepare,
verify, and queue merges; it never fires them.

Exit criteria: the four bash scripts' functions run end to end on the new
stack on pilot repositories and the new stack is authoritative there, with
the bash stack demoted to fallback with deprecation pointers (removal stays
M4-S5); false-success and lying-liveness counts near zero on migrated
engines; merge near-miss classes structurally impossible; no resume-loop
class (sessions resume without re-paying prefill or fail loudly within a
bounded restart budget, and the resume-amplification metric reads
approximately 1); changes delivered late in the milestone carry
machine-readable plans and the scheduler answers sequence versus parallel
mechanically from declared scope; the coordinator iteration is digest,
typed answers, merge, closeout, with scheduling, waiting, and healthy-path
verification consuming zero coordinator tokens (operator acceptance
criteria).

## M2: Ceremonies, measurement, and memory (months 3-6)

Goal: supervision, ceremonies, steering, and measurement run as declared,
deterministic units; the committed memory tree with typed records and lint
starts the learning loop at fleet scale.

Scope: `supervise` (tri-state status, lying-liveness by artifact evidence,
duplicate-supervisor detection, restart policies over the M1 daemon);
`ceremony` with the enumerated ceremony set, including the ceremony tier
engine (per-tier phase sets and escalation triggers as data); `board`;
`steer` (the first typed message type beyond the blocker channel);
`metrics` and `spend` alarms; suite-to-job mapping in the gate battery; the
memory line (records, layout, and lint; bootstrap conventions; retro action
registry and follow-through).

Note: the M1 redefinition moved the queue, lanes, and dispatch core (the
former M2-S1) into M1; the M2-S1 code gap is documented in
[backlog.md](backlog.md).

Exit criteria: ceremony share of active agent time trending below 40
percent; idle coordination iterations near zero; owner-gate median age
under two days; exit criteria measurable with committed numbers from the
metrics engine.

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
   (the fleet-wedging scenario). Within M1 this sequences the scheduling
   engine and resident daemon behind the truth and transaction stories
   (merge transaction, truthful signals, session lifecycle economics).
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
9. The merge transaction remains an explicit coordinator action: resident
   machinery may prepare, verify, and queue merges; it never fires them.
10. Resident processes degrade to CLI one-shot paths (local-first), and the
    render or scheduling path for digests, briefs, and plans contains no
    LLM calls: deterministic code, judgment on top of its output.

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
