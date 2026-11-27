---
# Copyright (c) 2025-2026 Juliusz Ćwiąkalski (https://www.cwiakalski.com | https://www.linkedin.com/in/juliusz-cwiakalski/ | https://www.x.com/juliusz)
# Apache-2.0 License - see LICENSE file for full terms
source: https://github.com/juliusz-cwiakalski/agentic-delivery-os/blob/main-tools/doc/planning/concepts/structured-change-artifacts/README.md
---
# Concept pack: structured change artifacts and just-in-time context

Status: **Draft** (2026-11-27). Owner review requested. This is a design pack, not a
specification and not a commitment to build everything at once.

## Why this pack exists

The owner's observation, restated: a change's artifacts (the PM context, the delivery
plan, the test plan, and possibly the change specification) could be structured data with a
schema. If they were, a tool could write them safely and, more importantly, could serve an
agent only the part it needs at this moment. The agent would stop parsing whole files, the
tool would become the single writer, and every artifact change would carry a git proof that
it was made by the tool. Phase handovers would let a fresh coder continue without rereading
the whole change. Affected paths in the plan would let the scheduler decide parallel versus
serial before any code exists.

The pack does four things:

1. It **challenges** the vision where it is over-optimistic, with measurements from real
   changes (section 01).
2. It proposes an **artifact model** and **YAML schemas** for the change specification, the
   delivery plan, the test plan, the PM context, the handover, and a milestone contract
   (sections 02 and 03, plus the `schemas/` examples).
3. It specifies a **CLI surface** for typed reads and writes, with auto-commit, provenance,
   and just-in-time context bundles (sections 04 and 05).
4. It walks the **whole lifecycle** through mental experiments: the happy path, a failed
   Definition of Ready, a review finding, a spec gap found in test planning, a peak park and
   resume, two lanes that touch the same file, and milestone-level goal verification
   (sections 06 and 07).

## How to review it

Read in this order:

1. `01-analysis.md` for the verdict and the challenges. If you disagree with the challenges,
   the rest of the pack changes.
2. `02-artifact-model.md` for the model: facets, IDs, budgets, tiers.
3. `03-schemas.md` and the six examples in `schemas/` for the concrete shapes.
4. `04-cli.md` and `05-context-bundles.md` for the tool surface and the filtering rules.
5. `06-workflows.md` and `07-parallelism.md` for the mental experiments.
6. `08-migration.md` for how to get there in slices.
7. `09-open-points.md` to answer inline. Each question has a default, so the design can
   proceed without a meeting; your answer overrides the default.
8. `10-evidence.md` for the measurements behind the claims and their caveats.

Answer inline in `09-open-points.md`: each question ends with `Answer:` on its own line.
If you prefer to comment on a pull request instead, the pack is on the branch
`docs/concepts/structured-change-artifacts`; the draft PR is opened on request.

## The proposal in one page

- **Facets, not documents.** One change owns six facets: specification, test plan, delivery
  plan, PM context, handover, and (for a milestone) the milestone contract. Each facet owns
  one kind of fact; the others reference it by ID. The same acceptance criterion is written
  once, in the specification, and referenced from the test plan and the plan.
- **Machine first, prose bounded.** The machine fields are typed and validated (acceptance
  criteria, decisions, interfaces, affected paths, test cases, verify commands, handovers).
  The prose fields are short, word-budgeted, and never used for control flow.
- **One writer.** Agents never edit the artifacts with `edit` or `write`. They use typed
  commands that validate, write atomically, commit only that file, and stamp provenance.
  A hand edit is detectable by lint and CI, and ideally impossible by harness permission.
- **Read by bundle.** An agent asks for `context bundle --for <role> --change <ref> --phase
  <id>` and receives a bounded, ordered set of sections with a `missing` list. It never reads
  a whole artifact. On-demand `context get --section <id>` is the escape hatch.
- **Plan is the scheduler's input.** Each phase declares its affected paths, its acceptance
  criteria, its tests, and its verify commands. Overlap between two changes is computed, not
  predicted. Drift between declared and actual paths is audited at the pull request.
- **Tiered depth.** S, M, and L changes carry different artifact requirements. A 200-line
  fix gets a one-page contract and a checklist; a 9,000-line contract change gets the full
  set. The current 25-section specification template is the default for L only.
- **Milestone memory.** A milestone contract holds the shared goals, architecture,
  dependency graph, and definition of done once. Each ticket carries a delta. At the end, an
  independent verifier checks the goals, not only the tickets.

## What is settled, what is open

Settled in this pack, subject to your veto:

- The artifact set and the single-writer rule.
- The read-by-bundle rule and the role/phase matrix.
- The tiering principle and the budgets.
- The auto-commit and provenance model (commit trailer plus CI lint; signing is optional and
  not a substitute for path permissions).
- The phased migration with a measured pilot.

Open, with defaults in `09-open-points.md`:

- The exact S/M/L thresholds.
- Whether the specification is fully structured or a structured contract plus bounded prose
  (the pack recommends the hybrid).
- Whether tool writes always auto-commit or batch per phase (the pack recommends always,
  squashed at merge).
- Whether hand-editing is a hard failure from day one or after the pilot (the pack recommends
  hard after the pilot).
- The ID prefixes to add to the catalog (`AC-`, `RSK-`, `IF-`, `PRE-`, `NA-`, `M-G`).
- Whether the eleven phases collapse for S changes.
- Whether test cases become executable specifications or stay documents with links to tests.
- The context bundle budgets and the acceptable miss rate.
- Who owns the milestone contract.
- Whether the retrospective log lives in the repository or outside it.

## File index

| File | What it holds |
|---|---|
| `01-analysis.md` | The vision, the evidence, where it is right, ten challenges, principles, kill criteria |
| `02-artifact-model.md` | Facets, ownership, IDs, single source of truth, tiers, budgets, lifecycle |
| `03-schemas.md` | Field rules and invariants for the six schemas |
| `schemas/spec.yaml` | Example change specification (structured contract plus bounded prose) |
| `schemas/test-plan.yaml` | Example test plan (cases as data, shared preconditions, coverage) |
| `schemas/delivery-plan.yaml` | Example delivery plan (phases, paths, tests, verify, handover) |
| `schemas/pm-context.yaml` | Example PM context (working memory only) |
| `schemas/handover.yaml` | Example phase handover (bounded, typed) |
| `schemas/milestone.yaml` | Example milestone contract (goals, scope, dependency graph, DoD) |
| `04-cli.md` | Command surface, write pipeline, provenance, error model, examples |
| `05-context-bundles.md` | Role/phase matrix, filtering algorithm, budgets, example bundles, miss handling |
| `06-workflows.md` | Eight mental experiments with exact commands and failure paths |
| `07-parallelism.md` | Affected paths, conflict classes, scheduler decision, drift audit |
| `08-migration.md` | Slices, pilot, metrics, rollback, compatibility |
| `09-open-points.md` | Numbered questions with defaults and inline answer space |
| `10-evidence.md` | Measurements from GH-416 and GH-413, method, caveats, success metrics |
| `11-glossary.md` | Terms used consistently across the pack |

## Related concepts and work items

- `../parallel-delivery.md`, strategy 3 (structured plan locations): this pack makes it
  concrete and adds the drift audit.
- `../inter-agent-communication.md`: artifacts over messages; the handover and the PM
  context are artifacts, not chat.
- `../memory-architecture.md`: change capsules and the read gate; the PM context is working
  memory, the retrospective log is durable memory.
- `../automated-commit.md`: the automated commit capability; the artifact writer reuses its
  safety rules for the commit step.
- `../id-prefix-catalog.md`: the ID grammar and the catalog-before-create rule; the new
  prefixes in this pack need catalog entries.
- `../policy-as-code.md`: the lint rules that make hand edits and undeclared paths visible.
- Work items: #113 (pm-notes validation), #154 (tiered lifecycle), #367 (queue readiness),
  #412 (parallel lanes), #405 (scope locks), #423/#424/#427 (gates, battery, search),
  #65 (structured evidence ledger), #43 (retrospective agent).

## Boundary

This is a public design document for the open-source tooling. It contains no product names,
ideas, prices, paths, or figures that are not already public. The measurements are from the
repository's own delivery and are stated as counts and ratios, not costs.
