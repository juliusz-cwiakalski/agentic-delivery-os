---
# Copyright (c) 2025-2026 Juliusz Ćwiąkalski (https://www.cwiakalski.com | https://www.linkedin.com/in/juliusz-cwiakalski/ | https://www.x.com/juliusz)
# Apache-2.0 License - see LICENSE file for full terms
source: https://github.com/juliusz-cwiakalski/agentic-delivery-os/blob/main-tools/doc/planning/concepts/structured-change-artifacts/12-deterministic-core.md
---
# 12. The deterministic core: what the tool should own

## The principle

**Deterministic by default, judgment by exception.** A task belongs to the tool when it is a
total function from the artifacts and the repository state to a result. A task belongs to an
agent when it needs judgment under uncertainty. A mixed task is split: the tool prepares the
evidence, the agent decides.

The test is simple: if two competent people given the same artifacts would produce the same
answer, the tool can do it. If they would disagree, an agent must decide and the tool must
record why.

The goal is not to remove the agents. It is to stop spending model calls on navigation,
validation, formatting, and bookkeeping, and to spend them on scope, design, code, review, and
risk.

## The inventory

| Task | Deterministic? | Owner | Command |
|---|---|---|---|
| Resolve the current change from the worktree or branch | yes | tool | `change current` |
| Locate the change folder and its facets | yes | tool | internal |
| Validate an artifact against its schema and references | yes | tool | `lint change` |
| Decide the next lifecycle phase and its guards | yes | tool | `workflow next` |
| Run a gate and classify its result | yes | tool | `gate run` |
| Derive the subject and body of an artifact commit | yes | tool | internal |
| Derive the subject of a phase commit | mostly | tool plus the phase title | `commit --from-phase` |
| Draft the pull-request title and body | mostly | tool from the artifacts | `pr draft` |
| Draft the changelog from the handovers | mostly | tool | `change changelog` |
| Closeout, worktree removal, branch cleanup | yes | tool | `closeout` |
| Queue order by dependencies and conflicts | yes | tool | `queue plan` |
| Conflict detection from the plans | yes | tool | `plan conflicts` |
| Budget and provenance checks | yes | tool | `lint change` |
| Scope judgment | no | PM | `pm loop add` |
| Specification and design | no | spec-writer | `spec set` |
| Code | no | coder | plan phases |
| Review findings | no | reviewer | `review finding add` |
| Risk assessment | no | spec-writer, PM | `spec risk add` |
| Reopen a phase | judgment | PM | `phase reopen` |
| Waive a gate | judgment | CEO | `blockers answer` |
| Priority | judgment | PM, CEO | `queue prioritize` |
| Goal verification | judgment plus evidence | verifier | `milestone verify` |

The table is the contract between the tool and the agents. A task moves from the agent column
to the tool column only when its function is written down and tested.

## Context auto-discovery: the current change

### The idea

An agent working in a lane worktree should not have to know the change ref, the change folder,
or the artifact paths. It asks for "the current change" and gets the facets. The tool resolves
the change from the environment.

### Resolution order

1. **Explicit `--change <ref>`.** Highest priority. Required in CI, in the main checkout, and
   whenever the caller is not inside a registered lane.
2. **The dispatch registry.** The lane record knows the ref, the worktree path, and the branch.
   If the agent's working directory is a registered lane worktree, the ref is the lane's ref.
   This is the strongest signal because the product wrote it.
3. **The branch name.** If the branch matches the registered change-branch pattern, the ref is
   extracted and validated. The pattern is configuration, not a hard-coded convention.
4. **The environment.** `JAISHIP_CHANGE`, set by the dispatcher for the lane.
5. **Fail closed.** If two candidates disagree, the command refuses with
   `change.resolve.ambiguous` and names the candidates. It never guesses.

### The trust boundary

The branch name is **untrusted input**. It can contain anything, including a path traversal or
an instruction-like string. The tool uses it only as a lookup key, validates the ref against a
strict pattern and the tracker, resolves the change folder from the registry rather than from
the branch string, and never executes or follows anything found in the name. A branch that
does not resolve is a refusal, not a search.

### What the agent sees

```bash
jaiship change current
```

```text
change: GH-416
title: A lane pushes its own last evidence commit before it stops
tier: L
phase: delivery
worktree: /worktrees/jaiship-GH-416
branch: feat/GH-416/lane-pushes-own-evidence-commit
change_folder: doc/changes/2026-11/2026-11-27--GH-416--lane-pushes-own-evidence-commit
next: P3 (coder)
```

The agent never searches for the folder. It says "the current change", "the next phase", "the
acceptance criteria". The ID is in the envelope, so the agent can name it when it reports a
problem, but it does not need it to navigate.

### What stays explicit

- In CI, the main checkout, and a human terminal, `--change` is required.
- A lane that is not registered (a manual worktree) must pass `--change` or be registered
  first.
- A rename of the branch convention does not break discovery because the registry is the first
  signal; the branch is the fallback.

## The deterministic lifecycle state machine

### The idea

The lifecycle is a known workflow. The tool knows the states, the transitions, the guards, and
the agent for each state. The agent asks "what is next" and gets the phase, the bundle, and the
guards. The PM stops navigating and starts handling exceptions.

### States and transitions

```text
intake -> clarify_scope -> specification -> test_planning -> delivery_planning
       -> dor_check -> delivery -> system_spec_update -> review_fix
       -> quality_gates -> dod_check -> pr_creation -> landed
```

Every state has:

- **Required inputs:** the facets and revisions that must be validated.
- **Guards:** lint, gates, review verdict, DoR, DoD.
- **The agent:** the role that does the work.
- **The bundle:** the command that gives the agent its context.
- **Allowed transitions:** the next states and the conditions.
- **A judgment flag:** whether the transition needs a human or a PM decision.

### The next command

```bash
jaiship workflow next
```

```text
state: delivery
phase: P3
agent: coder
bundle: jaiship context bundle --for coder --phase P3
guards:
  - plan phase P3 has a handover requirement
  - the branch is not behind the base
next:
  - P4 (coder) after P3 completes
  - system_spec_update after all plan phases complete
judgment: none
```

If the state needs judgment, the command says so and names the question:

```text
state: dor_check
verdict: readiness.fail
gaps:
  - AC-3 has no test case
  - P4 has no verify command
judgment: PM decides whether to reopen specification, test_planning, or delivery_planning
options:
  - jaiship phase reopen GH-416 specification --reason "..."
  - jaiship phase reopen GH-416 test_planning --reason "..."
  - jaiship blockers publish GH-416 --question "..." --default "..."
```

### What the PM still does

The state machine removes navigation, validation, and bookkeeping. It does not remove:

- Scope questions and product judgment.
- The decision to reopen, re-tier, or escalate.
- Waivers and risk acceptance.
- Priority and ordering across lanes.
- The final DoD judgment when the evidence is ambiguous.

The PM becomes the **exception handler**, not the navigator. Its prompt shrinks, which also
reduces the overloaded-instruction problem: fewer rules, fewer places to misread.

### The challenge

A state machine can become a rigid workflow engine that cannot express a real exception. The
design rule is: every state that needs judgment says so explicitly, names the options, and
hands control to the PM. The machine handles the happy path and the known failure paths; it
does not pretend to handle the unknown.

## Deterministic commit messages

### The idea

A commit message for an artifact or a phase can be derived from the command and the artifact
content. No model call. The phase title, the acceptance criteria, the handover, and the change
ref are already structured.

### The derivation

| Command | Subject | Body |
|---|---|---|
| `phase complete <ref> <phase>` | `chore(change): <ref> <phase> complete` | the phase summary and the gate verdict |
| `plan phase complete <ref> --phase P3` | `feat(<ref>): P3 <phase title>` | the handover's first three `done` items and the deviations |
| `spec ac add <ref> --id AC-3` | `docs(<ref>): add AC-3 <first 60 chars>` | the statement and the tests |
| `review finding resolve <ref> --id RF-1` | `fix(<ref>): resolve RF-1 on <phase>` | the finding and the evidence |
| `handover record <ref> --phase P3` | `chore(<ref>): P3 handover` | the done, deviations, and next inputs |
| `closeout <ref>` | `chore(<ref>): closeout` | the merge SHA, the closeout steps, the branch cleanup |

Trailers are always present:

```text
Phase: P3
Change-Ref: GH-416
Jaiship-Tool: plan phase complete@0.1.0
Handover: P3
```

### The rules

- The tool never invents a summary. If the phase has no title, the subject is the command and
  the ref: `chore(GH-416): P3 complete`.
- The body is capped at 72 characters per line and at ten lines. It is a summary, not an essay.
- A fix commit names the finding and the phase; a revert names the reason from the PM context.
- A phase that spans several commits names the step: `feat(GH-416): P3-S2 add the renderer`.
- A squash merge derives its subject from the change title and its body from the phase list and
  the handovers. The pull-request description can still be model-written, because it is a
  human-facing narrative; the commit is not.

### The challenge

A derived message is accurate but can be bland. The phase title and the handover are the
source of quality: if the plan-writer writes a vague phase title, the commit is vague. The fix
is a lint that requires a phase title to be a verb phrase with an object, not a noun phrase.
The tool can also carry the first `deviations` line as the "why", which is often the most
useful sentence.

### What this removes

- The model call in the automated-commit path for artifact commits.
- The model call for a phase commit's subject when the phase title is good.
- The inconsistency between a commit message and the artifact it commits.

The code commit still goes through the commit primitive; the primitive can accept
`--subject-from <phase>` and `--body-from <handover>` so the model is not asked to invent a
subject it already has.

## The deterministic 80 percent

The tool should own:

- Change resolution and folder discovery.
- Schema validation and cross-reference checks.
- Phase order, guards, and the next action.
- Gate execution and result classification.
- Commit subjects and bodies for artifacts and phases.
- The pull-request title and body from the artifacts.
- The changelog from the handovers.
- Closeout and cleanup.
- Queue order and conflict detection.
- Budget and provenance checks.

The agents should own:

- Scope and product judgment.
- Design and the specification's rationale.
- Code and tests.
- Review findings.
- Risk assessment.
- Reopen, waiver, and escalation decisions.
- Priority across lanes.
- Goal verification when the evidence is ambiguous.

The boundary is the total-function test. When a task moves across it, the move is a design
change with a test, not a prompt tweak.
