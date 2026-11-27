---
# Copyright (c) 2025-2026 Juliusz Ćwiąkalski (https://www.cwiakalski.com | https://www.linkedin.com/in/juliusz-cwiakalski/ | https://www.x.com/juliusz)
# Apache-2.0 License - see LICENSE file for full terms
source: https://github.com/juliusz-cwiakalski/agentic-delivery-os/blob/main-tools/doc/planning/concepts/structured-change-artifacts/03-schemas.md
---
# 03. Schemas and invariants

The five core examples in `schemas/` (plus the deferred milestone example in
`schemas/deferred/`) are the concrete shapes. This file states the rules they obey,
so a reviewer can judge the model without reading six files at once.

## General rules

- Every facet starts with `schemaVersion`, `changeRef`, `revision`, `status`, and
  `generatedBy`. The version is a semantic major; the revision is a monotonic integer.
- `status` is one of `draft`, `validated`, `committed`, `superseded`. The tool writes it; the
  author never edits it by hand.
- `generatedBy` names the command and the tool version that wrote the file. It is the in-file
  counterpart of the commit trailer; lint checks that both are present and agree.
- Prose lives in block scalars (`|-`), never in a flow scalar, and never in a field that the
  tool parses for control flow.
- There are no comments in a generated file. A rationale that matters is a field; a rationale
  that does not matter is not written. This is the direct fix for the plan that was 86 percent
  comments.
- IDs follow the catalog rules (`../id-prefix-catalog.md`). A reference that cannot be
  resolved fails lint.
- A field budget is enforced at write; a file budget is enforced by lint. The tool refuses,
  it never truncates.

## Specification (`change.spec.v1`)

| Field | Kind | Written by | Rules |
|---|---|---|---|
| `tier` | enum S, M, L | PM at init, raised by a gate | determines the artifact set |
| `milestone` | free-text label | PM | a label only; goal links are deferred (section 14) |
| `problem` | prose, 150 words | spec-writer | what is broken, for whom, with what evidence |
| `scope.in`, `scope.out` | lists | spec-writer | `out` is as binding as `in` |
| `acceptanceCriteria` | list of `AC-` | spec-writer | every AC has an evidence kind and at least one test |
| `extensions` | map of slots | spec-writer | at most three per facet; each slot has `text`, `useIn` or `archive: true`, and `budgetWords` |
| `decisions` | list of `DEC-` | spec-writer, decision-advisor | a durable decision links a decision record |
| `interfaces` | list of `API-` | spec-writer | kind, surface, change, contract |
| `affectedPaths` | list | spec-writer | high-level; the plan owns the precise paths |
| `risks` | list of `RSK-` | spec-writer | statement, mitigation, severity |
| `openQuestions` | list of `OQ-` | spec-writer | each has a default so delivery can proceed |
| `nonGoals` | list of `NG-` | spec-writer | |
| `prose.context`, `prose.rationale` | bounded prose | spec-writer | 300/700/1,200 words by tier |

Invariants:

- Every `AC-` is referenced by at least one `TC-` in the test plan.
- Every `DEC-` with `status: accepted` has a `choice` and at least one `consequence`.
- Every `API-` item has a `change` and a `contract`.
- `scope.out` and `nonGoals` do not contradict `scope.in`.
- The prose word count is within the tier budget.

## Test plan (`change.test-plan.v1`)

| Field | Kind | Written by | Rules |
|---|---|---|---|
| `preconditions` | list of `PRE-` | test-plan-writer | shared preconditions are written once |
| `cases` | list of `TC-` | test-plan-writer | one case per behaviour, not per field |
| `cases[].acceptance` | `AC-` refs | test-plan-writer | at least one |
| `cases[].phase` | plan phase ID | test-plan-writer | the phase that makes the case true |
| `cases[].layer` | enum | test-plan-writer | behaviour, structure, check, golden, manual |
| `cases[].path` | repo path | test-plan-writer | the test file that automates the case |
| `cases[].steps`, `expected` | lists | test-plan-writer | imperative, one line each |
| `coverage` | generated | tool | acceptance to cases; never hand-edited |

Invariants:

- Every `AC-` has at least one case.
- Every case maps to exactly one phase.
- Every automated case names an existing or planned test path.
- No two cases have the same title.
- The file is within the tier budget (20KB S, 40KB M and L).

## Delivery plan (`delivery.plan.v2`)

| Field | Kind | Written by | Rules |
|---|---|---|---|
| `base` | branch | plan-writer | the integration branch |
| `phases` | list of `Pn` | plan-writer | ordered; each phase is a coherent unit of delivery |
| `phases[].acceptance` | `AC-` refs | plan-writer | what this phase makes true |
| `phases[].tests` | `TC-` refs | plan-writer | the cases that prove it |
| `phases[].affectedPaths` | list | plan-writer | path, kind, role (producer or consumer) |
| `phases[].steps` | list | plan-writer | `action` is imperative; `detail` is at most 40 words |
| `phases[].verify` | list | plan-writer | command, cwd, expected exit |
| `phases[].dependsOn` | phase IDs | plan-writer | explicit order |
| `phases[].handover` | object | plan-writer | `required`, `nextInputs` |
| `phases[].contextFor` | map by role | plan-writer | `include` and `exclude` per role; the tool's mandatory set cannot be excluded |
| `affectedPaths` | generated | tool | union of the phases |
| `conflicts.serializeWith` | change refs | tool or PM | scheduler input |

Invariants:

- Every phase has at least one affected path, one acceptance criterion, and one verify
  command.
- Every `AC-` in the specification is covered by at least one phase.
- Every `TC-` referenced by a phase exists and maps to that phase.
- The dependency graph is acyclic.
- The comment share is at most 20 percent (and zero in a generated file).
- The file is within the tier budget (12KB S, 35KB M and L).

## PM context (`pm.context.v1`)

| Field | Kind | Written by | Rules |
|---|---|---|---|
| `phase` | lifecycle phase | tool | mirrors the phase registry |
| `openLoops` | list | PM | a loop is a question with an owner and a due phase |
| `nextActions` | list of `ACT-` | PM | action, owner, blocking |
| `blockers` | list | PM | typed; mirrors the `blockers` command |
| `decisions`, `risks` | ID refs | PM | summaries only; the facts live in the specification |
| `handovers` | phase IDs | tool | the handovers that exist |

Invariants:

- The file is at most 8KB. A PM context that grows past the budget is a signal that history
  is being stored in working memory.
- No free-text note over 200 words. Longer evidence goes to the retrospective log.
- Every `ACT-` has an owner and a blocking flag.
- `decisions` and `risks` contain only IDs that exist in the specification.

## Handover (`delivery.handover.v1`)

| Field | Kind | Written by | Rules |
|---|---|---|---|
| `phase` | phase ID | coder | one entry per phase |
| `done` | list | coder | what is true now, with evidence refs |
| `deviations` | list | coder | what differs from the plan and why |
| `openRisks` | list | coder | what the next phase must watch |
| `nextInputs` | list | coder | the interfaces, files, or decisions the next phase consumes |
| `evidence` | list | tool | test, gate, or review references |

Invariants:

- At most 1KB per entry.
- `done` has at least one item.
- Every `evidence` ref resolves to a test case, a gate run, or a review finding.
- A handover is required when `phases[].handover.required` is true; `phase complete` refuses
  without it.

## Milestone contract (`milestone.contract.v1`, deferred)

The milestone contract is **deferred** by the owner's review decision (section 14). It is kept
as a future example, not a core facet. The example is in
`schemas/deferred/milestone.yaml`.

| Field | Kind | Written by | Rules |
|---|---|---|---|
| `goals` | list of `M<n>-G<nn>` | PM with decision-advisor | statement, measure, tickets |
| `scope` | in and out | PM | |
| `architecture` | list | PM | the decisions that hold across tickets |
| `dependencyGraph` | edges | PM | from, to, kind |
| `sharedTestStrategy` | list | PM | what every ticket reuses |
| `definitionOfDone` | list | PM | milestone-level, not per ticket |
| `risks` | list | PM | milestone-level |

Invariants:

- Every goal has a measurable outcome and at least one ticket.
- Every ticket in the milestone is reachable from a goal.
- The dependency graph is acyclic.
- The contract is at most 16KB.

## Extension slots and context declarations

- An extension slot is a declared free-text field: `text`, `useIn` (a list of roles) or
  `archive: true`, and `budgetWords`. At most three slots per facet. The default `useIn` is
  empty, so an unused slot is not served. Extension text is never used for control flow.
- A `contextFor` map is declared per plan phase and role. It has `include` and `exclude`.
  The tool's mandatory set for the role cannot be excluded; the lint enforces it. The plan can
  add a section (for example the specification rationale) when a phase needs it.
- The phase title is a verb phrase with an object and a goal, because it is also the commit
  subject. A noun phrase fails lint with `change.phase.title.invalid`.

## What is mandatory in every tier

Every tier keeps the safety checks: acceptance criteria, tests, a review, the gates, the DoD,
the pull request, and provenance. The tiers slim the artifact volume, never the safety checks.

## Validation and error codes

`jaiship lint change <ref>` runs, in order:

1. Schema: every facet parses and carries the required header fields.
2. References: every ID resolves; no duplicate IDs.
3. Coverage: every AC has a test and a phase; every phase has a path and a verify command.
4. Budget: every field and file is within its tier budget.
5. Provenance: every facet has `generatedBy` and every artifact commit has the tool trailer.
6. Paths: every declared path exists (or is declared `add`); the pull-request audit compares
   declared with actual.
7. Tiers: the change is within its declared tier or has a recorded re-tier.

Error codes are stable and typed:

| Code | Meaning |
|---|---|
| `change.schema.invalid` | a facet does not parse or misses a required field |
| `change.ref.unresolved` | a reference points at nothing |
| `change.id.duplicate` | two facets mint the same ID |
| `change.coverage.missing` | an AC, phase, or path has no test or verify |
| `change.budget.exceeded` | a field or file is over its budget |
| `change.provenance.missing` | no `generatedBy` or no tool trailer |
| `change.paths.undeclared` | the diff touches a path the plan did not declare |
| `change.paths.unmodified` | a declared `modify` path is unchanged |
| `change.tier.exceeded` | the change outgrew its tier without a re-tier |

## What is author-written and what is tool-generated

| Author-written | Tool-generated |
|---|---|
| specification fields, test cases, plan phases, PM loops and actions | `coverage`, `affectedPaths` union, `status`, `revision`, `generatedBy` |
| handover `done`, `deviations`, `openRisks`, `nextInputs` | handover `evidence`, `completedAt` |
| milestone goals and scope (deferred) | `definitionOfDone` checks, goal verification results (deferred) |

A tool-generated field is overwritten on the next write. An author who needs to change it
changes the source field, not the generated one. This is what keeps the facets from drifting.
