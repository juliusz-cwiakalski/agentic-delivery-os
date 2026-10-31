# Current state inventory (tooling subproject inception)

Factual pointers into committed truth. No analysis. The bootstrapper verifies
each item during its own repo scan and extends this list in the material
inventory under `doc/inception/analysis/`.

## Repository and delivery model

- Integration branch: `main-tools`. All tooling PRs target it. `main` is the
  frozen public default branch; tooling merges to `main` only after the owner
  approves the publish step (roadmap M4).
- Delivery: ticket-driven, 11-phase lifecycle, squash merge. Parallel
  delivery runs in per-ticket worktrees for low-conflict stories.
- License: Apache-2.0. Bash delivery stack stays running; replacement is by
  engine (strangler), old tools retire at the very end with a deprecation
  notice.

## Decisions (authoritative records)

- `doc/decisions/ADR-0003-oss-monorepo-structure.md` - ACCEPTED. Six packages
  (core, adapters, cli, mcp, opencode, testkit), pnpm workspaces with Bun
  pinned, layered configuration, wrapper strangler, publish guard until the
  naming freeze.
- `doc/decisions/ADR-0005-runtime-confinement-provider-client-subpaths.md` -
  runtime-neutral core, provider clients confined to adapter subpaths.
- `doc/decisions/ADR-0006-workitem-custom-fields-and-comment-omission-representation.md`
- `doc/decisions/TDR-0003-config-parser-schema-and-acquisition.md`
- `doc/decisions/TDR-0004-state-storage-engine.md`
- Open decision batch tracked by story M0-S17 (GH-186): adapter contract,
  release model, command naming lock, measurement baseline.

## Committed planning corpus

- `doc/planning/oss-tooling/roadmap.md` - milestones M0-M4, principles, exit
  criteria.
- `doc/planning/oss-tooling/backlog.md` - story backlog M0-S1..M0-S20 with
  ticket mapping GH-170..GH-189, dependencies, machine-checkable AC.
- `doc/planning/oss-tooling/backlog-ranking.md` - suggested delivery order.
- `doc/planning/oss-tooling/cli-command-registry.md` - command surface mapped
  to stories.
- `doc/planning/oss-tooling/user-journeys.md` - usage flows.
- `doc/planning/concepts/` - design concepts that constrain current stories
  (parked concepts shape seams, not schedules).

## Delivery progress (milestone M0)

- Closed (9): S1 scaffold (GH-170), S2 branding seam (GH-171), S3 result
  contract (GH-172), S4 config layer (GH-173), S5 state layer (GH-174), S10
  pm-notes and registry lint (GH-179), S12 primitive ports (GH-181), S16
  interim mitigations (GH-185), S19 client seeds with trap catalogs (GH-188).
- In flight (3): S8 verify change and exit taxonomy (GH-177), S13 provider v1
  (GH-182), S15 privacy and no-cloud guards (GH-184).
- Open not started (8): S6 status v1 (GH-175), S7 queue ready (GH-176), S9
  verify gates v1 (GH-178), S11 db session-admin port (GH-180), S14 closeout
  v1 (GH-183), S17 decision records and baseline (GH-186), S18 license
  registry (GH-187), S20 adapter conformance suite v1 (GH-189).

In-flight stories add feature specs under `doc/spec/features/` while this
inception runs; spec work in this run is reconciliation-oriented, not a
one-shot snapshot.

## Current-truth feature specs (tooling side)

`doc/spec/features/` holds per-delivery specs for the delivered tooling
stories: monorepo scaffold toolchain, branding seam, result contract, config
layer, state layer, adapter ports, provider client seeds, pm-notes lint and
phase transitions. The delivery-system features alongside them belong to the
repo framework and are out of scope for this run.

## Quality baseline already in force

- Root workspace: pnpm workspaces, Bun pinned (four-copy equality check),
  biome, dependency-cruiser boundary rules, changesets lockstep, `pnpm check`
  aggregate gate.
- Rules: `.ai/rules/typescript.md`, `.ai/rules/testing-strategy.md`,
  `.ai/rules/bash.md`.
- Docs: distribution marker `ados_distribution` with a CI drift guard;
  license headers managed by `scripts/add-header-location.sh`.

## Working name

`ados` until the naming freeze: binary `ados`, env prefix `ADOS_`, config dir
`.ados`, state dir. All name-derived values come from the single branding
constant; a forbidden-literal gate enforces no name literals outside the
branding module.
