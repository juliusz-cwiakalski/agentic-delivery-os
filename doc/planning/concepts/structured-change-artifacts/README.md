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

The pack does six things:

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
5. **Part 2** draws the line between the deterministic tool and the judgment of an agent:
   change auto-discovery from the worktree, a lifecycle state machine with a `next` command,
   and commit messages derived from the artifacts without a model call (section 12).
6. **Part 2** designs the delivery of context: a projection envelope instead of raw YAML,
   flags for facts and generated forms for facets, and a `--since` delta protocol. The delta
   protocol and the push model are deferred (section 13, decisions in section 14).
7. It **decides the shape of a change**: what classifies it, the risk flags, who classifies, when another review round is earned, the single contract, and the split of state, content and history (section 15, decisions in part 5 of section 14).
8. It proposes **how a change manages its tests**: criteria and obligations in the contract,
   native tests, and red and green runs recorded by the tool (section 16, open for discussion).
9. It proposes a **roadmap of tickets that each deliver value alone** (section 17).
10. It records the figures of the delivery study behind sections 15 to 17 (section 18).

## How to review it

Read in this order. If you are resuming after a break, read `HANDOVER-2026-11-28.md` first.

1. `01-analysis.md` for the verdict and the challenges. If you disagree with the challenges,
   the rest of the pack changes.
2. `02-artifact-model.md` for the model: facets, IDs, budgets, tiers.
3. `03-schemas.md` and the five core examples in `schemas/` (plus the deferred
   milestone example) for the concrete shapes.
4. `04-cli.md` and `05-context-bundles.md` for the tool surface and the filtering rules.
5. `06-workflows.md` and `07-parallelism.md` for the mental experiments.
6. `08-migration.md` for how to get there in slices.
7. `09-open-points.md` to answer inline. Each question has a default, so the design can
   proceed without a meeting; your answer overrides the default.
8. `10-evidence.md` for the measurements behind the claims and their caveats.
9. `12-deterministic-core.md` for what the tool should own: change resolution, the state
   machine, and deterministic commit messages.
10. `13-context-delivery.md` for the output envelope, the input forms, the delta protocol, and
    the research plan. Its open points are Q31 to Q40, answered in the same file.
11. `14-review-decisions.md` for the owner's answers to the challenges and the resulting design
    changes. Where a core file and this file disagree, the decisions file wins.
12. `15-classification-and-rounds.md` for the shape of a change. It carries no figures from the study it rests on; read it with part 5 of the decisions file.
13. `16-testing-in-a-change.md` for testing inside a change, open for discussion (Q47).
14. `17-roadmap.md` for the tickets, each valuable on its own (Q30).
15. `18-delivery-study.md` for the figures behind sections 15 to 17.

Answer inline in `09-open-points.md`: each question ends with `Answer:` on its own line.
If you prefer to comment on a pull request instead, the pack is on the branch
`docs/concepts/structured-change-artifacts`; the draft PR is opened on request.

## The proposal in one page

- **One contract, one context, handovers.** One change owns a contract (goal, criteria,
  verified facts, decisions, oracle, work, flags), a PM context and handovers. Each kind of
  fact is written once and referenced by ID: the same acceptance criterion is written once, and
  its oracle, phases and tests reference it. The milestone contract is deferred (section 14);
  the contract's shape is in section 15.
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
- **Shape follows the change, not its size.** Low risk is the default; risk flags keyed on
  the surface touched add verification; the contract grows with decisions. The current
  25-section specification template is an option for a phased change only (section 15).
- **Context is declared, not guessed.** Each plan phase carries a `contextFor` map: what the
  coder and the reviewer need, and what they do not. The tool has a mandatory set per role;
  the plan can add, never remove. The milestone contract is deferred.

## What is settled, what is open

Settled in this pack, subject to your veto:

- The artifact set and the single-writer rule.
- The read-by-bundle rule and the role/phase matrix.
- The tiering principle and the budgets.
- The auto-commit and provenance model (commit trailer plus CI lint; signing is optional and
  not a substitute for path permissions).
- The phased migration with a measured pilot, delivered as one epic with multiple pull
  requests.
- The review decisions in `14-review-decisions.md`: extension slots, the worktree registry as
  the primary change resolution, one lane and one change, a template-driven state machine,
  deterministic commits from the phase title, attribution instead of prohibition for hand
  edits, the audit as a learning signal, and the milestone contract deferred.
- The part 5 decisions in `14-review-decisions.md`: one contract with one author and two
  readers, rounds earned by material findings, low risk by default with flags on the
  surface, state separate from history, and cost recorded per role and phase.

Open:

Every numbered question in `09-open-points.md` and `13-context-delivery.md` now has an answer
or a confirmed default. Three were explained on 2026-11-28 and accepted by the owner: Q17 (superseded by Q14), Q29 (when the compatibility reader
is removed) and Q36 (a form for the first write of a contract). The retrospective log follows
from Q45: the retrospective reads the events, and there is no separate log. The core files 02
to 06, 08, 12 and 13 still describe the earlier model; sections 14 to 18 win until they are
rewritten.

## File index

| File | What it holds |
|---|---|
| `HANDOVER-2026-11-28.md` | Review handover: what is settled, what is open, how to resume |
| `01-analysis.md` | The vision, the evidence, where it is right, ten challenges, principles, kill criteria |
| `02-artifact-model.md` | Facets, ownership, IDs, single source of truth, tiers, budgets, lifecycle |
| `03-schemas.md` | Field rules and invariants for the six schemas |
| `schemas/spec.yaml` | Example change specification (structured contract plus bounded prose) |
| `schemas/test-plan.yaml` | Example test plan (cases as data, shared preconditions, coverage) |
| `schemas/delivery-plan.yaml` | Example delivery plan (phases, paths, tests, verify, handover) |
| `schemas/pm-context.yaml` | Example PM context (working memory only) |
| `schemas/handover.yaml` | Example phase handover (bounded, typed) |
| `schemas/deferred/milestone.yaml` | Deferred example of a milestone contract (goals, scope, dependency graph, DoD) |
| `04-cli.md` | Command surface, write pipeline, provenance, error model, examples |
| `05-context-bundles.md` | Role/phase matrix, filtering algorithm, budgets, example bundles, miss handling |
| `06-workflows.md` | Eight mental experiments with exact commands and failure paths |
| `07-parallelism.md` | Affected paths, conflict classes, scheduler decision, drift audit |
| `08-migration.md` | Slices, pilot, metrics, rollback, compatibility |
| `09-open-points.md` | Numbered questions with defaults and inline answer space |
| `10-evidence.md` | Measurements from GH-416 and GH-413, method, caveats, success metrics |
| `11-glossary.md` | Terms used consistently across the pack |
| `12-deterministic-core.md` | Part 2: the deterministic inventory, change auto-discovery, the lifecycle state machine, commit messages without a model call |
| `13-context-delivery.md` | Part 2: the projection envelope, flags and forms, the `--since` delta protocol (deferred), the push model (out of scope), the research plan, Q31 to Q40 |
| `14-review-decisions.md` | Owner review decisions from parts 3 and 4, the resulting design changes, and the remaining open points |
| `15-classification-and-rounds.md` | The shape of a change: what classifies it, the risk flags, who classifies, the round rules, the single contract, and the split of state, content and history |
| `16-testing-in-a-change.md` | Testing inside a change: criteria, obligations, recorded runs, red and green by kind of change; a proposal |
| `17-roadmap.md` | Six tickets that each deliver value alone, in dependency order; any prefix is consistent |\n| `18-delivery-study.md` | The figures of the delivery study behind sections 15 to 17, without names or ticket references |

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
