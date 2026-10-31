---
id: NORTH-STAR
status: Active
created: 2026-10-31
last_updated: 2026-10-31
owners: ["juliusz-cwiakalski"]
summary: "North star for the OSS delivery tooling - one typed, local-first toolchain (CLI, MCP, harness plugins over a shared core) that lets a solo operator run AI delivery agents without becoming the bottleneck."
---

# OSS delivery tooling: North Star

## Vision

A single technical founder runs an autonomous software delivery factory from
their own machine: AI agents take tickets through to reviewed, tested,
merged changes while the founder spends attention only on decisions. The
factory's mechanics live in open source that anyone can run, inspect, and
trust.

## Mission

We give a solo developer and their AI agents one typed, local-first
toolchain (a CLI, an MCP server, and harness plugins over a shared typed
core) that replaces fragile delivery scripting with truthful signals,
bounded output, and auditable state, so accepted value ships without the
human becoming the bottleneck or losing focus.

## Target Users

- **Primary:** a solo technical founder or developer operating a fleet of AI
  coding agents across real repositories from one workstation (single user,
  local operation; confirmed at inception gate 0).
- **Secondary (consumers, not choosers):** the AI delivery agents
  themselves (orchestrating PM, coder, runner, reviewer, dispatcher) that
  invoke the CLI and MCP surfaces programmatically and depend on their
  contracts.

## Problem We Solve

- Shell-based delivery misreports status: pipelines under `pipefail` and
  silent skips produce false confidence. Automation built on lying signals
  compounds the error instead of fixing it.
- Coordination knowledge lives in LLM context: ceremony consumes agent
  capacity and the coordinating session degrades into a dispatcher.
- Signals are scattered across tracker, CI, and repositories: no single
  truthful status; closeout leaves stale branches, tickets, and owed
  follow-ups.
- Untyped scripts have no contracts: growing a CLI, an MCP server, and
  harness plugins from one bash stack is unsafe; every surface re-implements
  and re-breaks.

## North Star Metric

**Owner attention per accepted delivery** - the human time and cognitive
load required per change that lands green through the full lifecycle.
Measured from the M0-S17 measurement baseline: ceremony share of active
agent time, false-signal incidents, cycle time, and cost per accepted
delivery.

Guardrails: accepted-change quality (gates genuinely green), production
reliability, security and privacy (no secrets in state or output), rework
rate, and the operator's ability to understand and stop the system at any
moment.

## Guiding Principles

- **Evidence before automation** - truthful signals and verified artifacts
  come before scheduling and optimization; never automate on an unverified
  signal.
- **Strangler, never big-bang** - engines replace bash one by one,
  dual-run, with the shell authoritative until parity evidence transfers
  authority; running gates never weaken during migration.
- **One typed core, thin surfaces** - CLI, MCP, and harness plugins are
  projections of one core; no surface-only logic paths; provider and
  harness dialects live behind adapter ports.
- **Complete local function** - the tooling works with zero hosted
  services; telemetry and events are schema-versioned and exportable by
  design.
- **Naming firewall** - one branding constant owns every name-derived value
  until the naming freeze; a literal gate keeps scattered names out.
- **Dogfooding** - the delivery process delivers the tooling that replaces
  it; evidence comes from this repository's own deliveries.
- **Artifacts, not exit codes** - success is a verified pushed commit, PR,
  tracker state, and pipeline, never a bare status number.

## Decision Filter

When two reasonable options compete, prefer the one that:

1. Makes a signal truthful or an outcome artifact-verified, over adding new
   capability on unverified foundations.
2. Reduces recurring owner attention and ceremony share, over a one-time
   convenience.
3. Stays local, provider-neutral, and harness-neutral through adapters,
   over any surface-specific shortcut.
4. Keeps the open-source tooling genuinely complete on its own, over
   anything that assumes a hosted service.
5. Is validated through dogfooding evidence, over speculative generality.

## Four-Risk Awareness

- **Value risk** - do the pains above stay real as the bash stack is
  replaced engine by engine? Tracked in the phase 2 assumption register.
- **Usability risk** - can a solo operator (and agent callers) reach
  truthful status and safe closeout with bounded output? Journey coverage
  is verified in the committed user journeys; gaps tracked in phase 2.
- **Feasibility risk** - can six packages, adapters, and the strangler
  migration complete without weakening delivery? Risk register tracks
  engine sequencing and shared-contract hotspots.
- **Viability risk** - Apache-2.0 OSS with private packages until the
  naming freeze; publication economics deliberately out of this document's
  scope until M4.

## Scope

**In scope:**

- The `packages/` monorepo: typed core, adapters (GitLab, Jira, GitHub,
  Azure on demand), CLI, MCP, harness integration, testkit.
- Trust-substrate engines (status, verify change, verify gates, provider,
  closeout, validation) and the de-AI core through M3.
- Local-first state, layered configuration, telemetry and event schemas.
- Bash-stack migration via wrappers; deprecation and retirement at the end.
- The subproject's specs, decision records, and this knowledge base.

**Out of scope (for now):**

- Hosted or cloud capabilities: their design, names, and content stay out
  of committed files entirely (open/closed boundary: open the mechanism,
  never in this repository's scope).
- Multi-user and team features: single-operator now; the state abstraction
  keeps the seam open without building on it.
- The final product name: protected by the branding seam until the M4
  naming freeze; nothing couples to a name.
- Rewriting the delivery framework's agents or commands (`.opencode/**` is
  canonical and product).
- Business, GTM, and pricing artifacts (engineering repository profile).

## Current Focus

Completing **M0: trust substrate** so the delivery loop runs on real
tickets beside the bash stack. Protected subset: `status` v1, `verify
change` plus `verify gates`, `provider`, `closeout`, and validation bundled
with verify change.

Key deliverables:

- The remaining M0 stories (GH-175, GH-176, GH-178, GH-180, GH-183, GH-186,
  GH-187, GH-189) plus the in-flight GH-177, GH-182, GH-184.
- The decision-record batch (adapter contract, release model, command
  naming lock): seeded by this inception run, ratified by GH-186.
- The measurement baseline numbers (ceremony share, cycle time, CI failure
  rate, false-signal incidents) committed at GH-186.

Success criteria for this phase (roadmap M0 exit criteria): the pilot
repository runs status, verify change, provider, and closeout beside the
bash stack (dual-run, shell still authoritative); zero false-success
incidents on pilot paths over two weeks; this repository delivers through
the scaffold.

Full multi-phase plan: [roadmap](../planning/oss-tooling/roadmap.md);
story detail: [backlog](../planning/oss-tooling/backlog.md).

### Documentation homes

This north star is the product compass. The linked roadmap owns milestone
goals and exit criteria; the backlog owns story requirements and dependencies.
The [command registry](../planning/oss-tooling/cli-command-registry.md) owns
planned command scope and the [user journeys](../planning/oss-tooling/user-journeys.md)
own usage flows. Feature specs under `doc/spec/features/` describe delivered
behavior. No separate opportunity-solution tree or project PRD is maintained
for this subproject; these canonical documents serve that planning role.

## Stakeholders

- **Owner (solo founder)** - product owner, first user, and human gate at
  every phase; decision authority per the decision framework.
- **Delivery agents** - PM, coder, runner, reviewer, pr-manager: contract
  consumers of the CLI/MCP surfaces and phase-ledger write path.
- **OSS community (future)** - consumers after the public release; nothing
  user-facing ships before the naming freeze.
- **This repository's delivery framework** - the bash stack being replaced;
  remains authoritative until authority transfer per engine.

## Document History

| Date | Author | Change |
|------|--------|--------|
| 2026-10-31 | bootstrapper (GH-200 run) | Initial draft, phase 1 |
