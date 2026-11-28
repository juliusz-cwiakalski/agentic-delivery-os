---
# Copyright (c) 2025-2026 Juliusz Ćwiąkalski (https://www.cwiakalski.com | https://www.linkedin.com/in/juliusz-cwiakalski/ | https://www.x.com/juliusz)
# Apache-2.0 License - see LICENSE file for full terms
source: https://github.com/juliusz-cwiakalski/agentic-delivery-os/blob/main-tools/doc/planning/concepts/structured-change-artifacts/12-deterministic-core.md
---
# 12. The deterministic core: what the tool should own

Status: governed by `14-review-decisions.md` (decisions 3, 4, 12 to 15, 18, 19, 35 to 39 and
41) and by `15-classification-and-rounds.md`.

## The principle

**Deterministic by default, judgment by exception.** A task belongs to the tool when it is a
total function from the artifacts and the repository state to a result. A task belongs to an
agent when it needs judgment under uncertainty. A mixed task is split: the tool prepares the
evidence, the agent decides.

The test is simple: if two competent people given the same artifacts would produce the same
answer, the tool can do it. If they would disagree, an agent must decide and the tool must
record why.

The goal is not to remove the agents. It is to stop spending model calls on navigation,
validation, formatting, and bookkeeping, and to spend them on the diagnosis, the contract,
the code, the review, and risk.

## The inventory

| Task | Deterministic? | Owner | Command |
|---|---|---|---|
| Resolve the current change from the worktree registry | yes | tool | `change current` |
| Validate the contract against its schema and references | yes | tool | `lint change` |
| Propose the flags from the paths against the surface map, read from the merge base; compute the kind, the shape and the tripwire | yes | tool | `change classify` |
| Run the preflight: cited paths, versions and commands, changed literals, named gates, an oracle entry per criterion, an obligation per check of the ticket's typed block | yes | tool | `preflight` |
| Fold the state from the events | yes | tool | `workflow status` |
| Decide the next state and its guards | yes | tool | `workflow next` |
| Decide whether a round is allowed | yes, from the typed findings | tool | `review rounds allowed` |
| Allocate a finding's identifier in the event log | yes | tool | `review finding add` |
| Run an obligation on the base or the candidate, and a mutation in a copy of the tree, under the command policy | yes | tool | `obligation run`, `obligation mutate` |
| Run a gate and classify its result | yes | tool | `gate run` |
| Record sessions, tokens and minutes per role, phase and gate, from the existing telemetry | yes | tool | `change cost` |
| Derive the subject and body of an artifact commit | yes | tool | internal |
| Derive the subject and body of a phase commit from the phase title and the criteria | mostly: the title is the author's | tool | `commit --from-phase` |
| Draft the handover from the events | mostly: the coder confirms it | tool and coder | `handover draft` |
| Draft the pull-request title and body | mostly | tool | `pr draft` |
| Draft the changelog from the handovers | mostly | tool | `change changelog` |
| Closeout, worktree removal, branch cleanup | yes | tool | `closeout` |
| Queue order, and conflict detection from the Work sections | yes | tool | `queue plan`, `plan conflicts` |
| Compare the declared paths with the diff | yes | tool | `change audit` |
| Provenance and duplication checks | yes | tool | `lint change` |
| The diagnosis | no | PM at intake | `contract add --section facts` |
| The contract, and each revision of it | no | the PM for a light change, the contract author otherwise | the `contract` family |
| Acceptance tests for the `security` and `data` flags | no | acceptance author | native test code |
| The flags, one by one | judgment on the tool's proposal | PM | `change classify --confirm`, `--remove` |
| The code and the tests | no | coder | the Work phases |
| Findings and their materiality | no | pre-code reader, reviewer | `review finding add` |
| What the next phase needs, in the handover | no | coder | `step done <id> --handover <file>` |
| Reopen a state | judgment | PM | `phase reopen` |
| Waive a gate; raise a ceiling | judgment | CEO; PM or CEO | `blockers answer` |
| Priority | judgment | PM, CEO | `queue prioritize` |
| A change that touches the surface map | judgment | owner | sign-off on the policy flag |

The table is the agreement between the tool and the agents. A task moves from the agent
column to the tool column only when its function is written down and tested.

## Context auto-discovery: the current change

### The idea

An agent working in a lane worktree should not have to know the change ref, the change folder,
or the artifact paths. It asks for "the current change" and gets its state. The tool resolves
the change from the environment.

### Resolution order

1. **Explicit `--change <ref>`.** Highest priority. Required in CI, in the main checkout, and
   whenever the caller is not inside a registered lane.
2. **The worktree registry (primary).** The dispatch record knows the ref, the worktree path,
   and the branch. If the agent's working directory is a registered lane worktree, the ref is
   the lane's ref. This is the strongest signal because the tool wrote it, and it is the
   normal path: the delivery start creates the worktree and records the binding.
3. **The environment.** `JAISHIP_CHANGE`, set by the dispatcher for the lane.
4. **The branch name (legacy fallback).** If the branch matches the registered change-branch
   pattern, the ref is extracted and validated. This path is for a manual or legacy worktree
   that the registry does not know.
5. **Fail closed.** If two candidates disagree, the command refuses with
   `change.resolve.ambiguous` and names the candidates. It never guesses.

The invariant is **one lane, one change**. A lane worktree is bound to exactly one change; the
tool refuses a write to another change from that worktree unless the caller is explicitly
authorized (for example a reviewer comparing two changes, or the CEO).

### The trust boundary

The branch name is **untrusted input**, and it is only the legacy fallback. It can contain
anything, including a path traversal or an instruction-like string. The tool uses it only as a
lookup key, validates the ref against a strict pattern and the tracker, resolves the change
folder from the registry rather than from the branch string, and never executes or follows
anything found in the name. A branch that does not resolve is a refusal, not a search.

### What the agent sees

```bash
jaiship change current
```

```text
change: GH-416
title: A lane pushes its own last evidence commit before it stops
shape: phased
flags: data
state: code
branch: feat/GH-416/lane-pushes-own-evidence-commit
next: PH-03_S01 (coder)
```

The agent never searches for the folder. It says "the current change", "the next phase", "the
acceptance criteria". The ID is in the envelope, so the agent can name it when it reports a
problem, but it does not need it to navigate. The ID is **implicit by default, explicit when
needed**: the commands default to the current change, and `--change` is available for a
cross-change operation. The envelope carries no change folder and no artifact path.

### What stays explicit

- In CI, the main checkout, and a human terminal, `--change` is required.
- A lane that is not registered (a manual worktree) must pass `--change` or be registered
  first.
- A rename of the branch convention does not break discovery because the registry is the first
  signal; the branch is the fallback.

## The deterministic lifecycle state machine

### The idea

The lifecycle is a known workflow. The tool knows the states, the transitions, the guards, and
the agent for each state. The agent asks "what is next" and gets the state, the bundle, and
the guards. The PM stops navigating and starts handling exceptions.

### The shape selects the states

The state machine is **parameterized by the shape**, not one fixed graph. The shape is a
function of what the tool can observe: the flags (proposed by the tool, confirmed by the PM
flag by flag at intake), the number of phases in the Work section, and the decisions the
contract records. The line tripwire can move a change to a heavier shape. Any gate can add a
flag; nothing is de-escalated without a recorded decision.

The PM can **add** a state with a recorded reason (for example a second review seat for a
risky change). It cannot remove a gate.

### States and transitions

The states are those of `15-classification-and-rounds.md`, section 5. The identifier is what
`workflow next` prints and `phase reopen` takes.

| State | Shape | Agent | Bundle | Guard on entry | Leaves when |
|---|---|---|---|---|---|
| `intake` | all | PM | the ticket | a ticket is bound to the lane | the diagnosis is recorded and the flags are confirmed |
| `contract` | all | the PM or the contract author for a light card; the contract author otherwise | `context bundle --for contract-author` | intake is complete | `lint change` passes |
| `preflight` | all | tool | none; it prints its findings | the contract is validated | every cited path, version, command and gate checks out; every criterion, and every check of the ticket's typed block, has an obligation |
| `pre_code_read` | flagged, phased | pre-code reader | `context bundle --for pre-code-reader` | the preflight passed | no material finding stands, or the PM or the CEO decides past the ceiling |
| `delivery` | all | coder; the acceptance author before the coder starts (`security`, `data`); the doc-syncer for each document in `docs:` | `context bundle --for coder --phase <id>` | no reader round is open; with `security` or `data`, the acceptance tests exist and their base leg is recorded | every step of every phase is done, each handover between phases is confirmed, and the documents in `docs:` are reconciled |
| `review` | all | reviewer | `context bundle --for reviewer` | the diff is complete for the change | no material finding stands and `review rounds allowed` refuses another round |
| `gates` | all | runner | `context bundle --for runner` | the review verdict stands on the candidate | the gates are green on the merge candidate |
| `dod` | all | PM | `pm brief` | the gates are green | every criterion has a recorded proof and `docs:` is reconciled |
| `pr` | all | pull-request manager | `context bundle --for pr-manager` | the definition of done is met | the request is open, with the goal, the criteria and the flags |

How to read the table:

- **Light** runs no reader in `pre_code_read`: the coder is the first reader, inside
  `delivery`. **Flagged** adds the pre-code reader after the preflight and, with `security` or
  `data`, the acceptance author. **Phased** delivers per phase, with a handover between
  phases and a fresh coder session at each boundary.
- Every shape reconciles the documents in `docs:`; the doc-syncer is skipped when `docs:` is
  `none`.
- The merge, the closeout, the worktree removal and the branch cleanup follow the pull
  request. They belong to the tool.
- The state is a fold over the events: a transition is recorded when its guard passes, never
  typed by an agent. `workflow next` prints the folded state.
- Two returns belong to the machine: `contract`, from any state, on a material finding that
  changes the contract; and `delivery`, from `review` or `gates`, on a failure. Each return is
  `jaiship phase reopen <ref> <state> --reason RFIND-<n>`, and a reopened step keeps its
  identifier.
- Three guards are judgments: the review verdict (the reviewer), the definition of done (the
  PM) and a waiver (the CEO). Each is a recorded event.

### The next command

```bash
jaiship workflow next
```

```text
state: delivery
phase: PH-03
step: PH-03_S01
agent: coder
bundle: jaiship context bundle --for coder --phase PH-03
guards:
  - preflight passed on contract revision 4
  - the base leg of PROOF-1 to PROOF-3 is recorded
  - the branch is not behind the base
next:
  - PH-03_S02 after PH-03_S01 is done
  - PH-04 in a fresh session, after the handover of PH-03 is confirmed
  - review after the documents in docs: are reconciled
judgment: none
```

If the state needs judgment, the command says so and names the question:

```text
state: review
round: 1 of 3
verdict: review.fail
findings:
  - RFIND-1, coverage, material: PROOF-1 stays green with the fix removed
judgment: the coder fixes RFIND-1; the reviewer judges the fix in round 2
options:
  - jaiship context bundle --for coder --findings RFIND-1
  - jaiship contract revise GH-416 --reason "RFIND-1" --finding RFIND-1 --from-file /tmp/contract-form.yaml
  - jaiship blockers publish GH-416 --question "..." --default "..."
```

### What the PM still does

The state machine removes navigation, validation, and bookkeeping. It does not remove:

- Scope questions and the diagnosis at intake.
- The flags, one by one, and the decision to reopen or to escalate the shape.
- Waivers, a raised ceiling, and risk acceptance.
- Priority and ordering across lanes.
- The final definition-of-done judgment when the evidence is ambiguous.

The PM becomes the **exception handler**, not the navigator. Its prompt shrinks, which also
reduces the overloaded-instruction problem: fewer rules, fewer places to misread.

### The challenge

A state machine can become a rigid workflow engine that cannot express a real exception. The
design rule is: every state that needs judgment says so explicitly, names the options, and
hands control to the PM. The machine handles the happy path and the known failure paths; it
does not pretend to handle the unknown.

## Deterministic commit messages

### The idea

A commit message for an artifact or a phase can be derived from the command and the contract.
No model call. The phase title, the acceptance criteria, the handover, and the change ref are
already structured.

### The derivation

| Command | Subject | Body |
|---|---|---|
| `contract set <ref> --from-file <form>` | `docs(<ref>): write the contract` | the sections written, by identifier |
| `contract add <ref> --section criteria --id AC-3` | `docs(<ref>): add AC-3 <first 60 characters>` | the statement and its obligations |
| `contract add <ref> --section decisions --id DEC-3` | `docs(<ref>): record DEC-3` | the question and the choice |
| `contract revise <ref> --reason <text>` | `docs(<ref>): revise the contract: <reason>` | the sections that changed |
| `step done <ref> PH-02_S02 --handover <file>` | `chore(<ref>): PH-02 handover` | what changed and what the next phase must adjust to |
| the code commit of a fix, `commit --resolve RFIND-1` | `fix(<ref>): resolve RFIND-1` | the finding and the evidence |
| `commit --from-phase PH-02` | `feat(<ref>): PH-02 <phase title>` | the criteria of the phase, then the handover's `done` and `deviations` |
| `phase complete <ref> <state>` | `chore(<ref>): <state> complete` | the state's summary and the gate verdict |
| `closeout <ref>` | `chore(<ref>): closeout` | the merge SHA, the closeout steps, the branch cleanup |

A phase commit, as the tool writes it:

```text
feat(GH-416): PH-02 implement the push use case and the record append

AC-2: A refused transport is a data-bearing answer, exit 1, no new
error identity.
Done: resolve, act, append and answer over injected ports.
Deviations: the append follows a failed act, so the record carries the
refusal.

Phase: PH-02
Change-Ref: GH-416
Jaiship-Tool: commit@0.1.0
Handover: PH-02
Session: 018G2E7635NQKQA268RYJJDZ43
Role: coder
```

### The rules

- The tool never invents a summary. If the phase has no title, the subject is the command and
  the ref: `chore(GH-416): PH-02 complete`.
- The body is the phase's acceptance criteria, then the handover's `done` and `deviations`. It
  is capped at 72 characters per line and at ten lines. It is a summary, not an essay.
- The phase title is a verb phrase with an object and a goal; a noun phrase fails lint with
  `change.phase.title.invalid`. The lint also caps the title so that the subject fits on one
  line, and the tool never truncates a title.
- One grammar everywhere: `PH-<nn>` for a phase and `PH-<nn>_S<nn>` for a step, in the
  contract, the events, the bundles and the trailers (decision 41).
- A fix commit names the finding and the phase; a revert names the reason the PM recorded.
- A phase that spans several commits names the step:
  `feat(GH-416): PH-03_S02 register the command in the composed program`.
- A squash merge derives its subject from the change title and its body from the phase list and
  the handovers. The pull-request description can still be model-written, because it is a
  human-facing narrative; the commit is not.
- Every write records the session and the role that made it. The trailer proves attribution by
  convention, not identity.

### The challenge

A derived message is accurate but can be bland. The phase title and the handover are the
source of quality: if the author writes a vague phase title, the commit is vague. The fix is a
lint that requires a phase title to be a verb phrase with an object, not a noun phrase. The
tool can also carry the first `deviations` line as the "why", which is often the most useful
sentence.

### What this removes

- The model call in the automated-commit path for artifact commits.
- The model call for a phase commit's subject when the phase title is good.
- The inconsistency between a commit message and the artifact it commits.

The code commit still goes through the commit primitive; the primitive takes
`--from-phase <id>` so the model is not asked to invent a subject it already has.

## The exception budget

A deterministic rule that needs more than three exception cases is a judgment task, not a
rule. The budget prevents the tool from accumulating a pile of special cases that nobody can
maintain. When a rule hits the budget, move the decision to the agent and record the reason.
This is the operational form of the owner's point: use scripting and algorithms where they
fit, and do not push program everywhere until the code is dozens of exceptions.

## The deterministic 80 percent

The tool should own:

- Change resolution and folder discovery.
- Schema validation and cross-reference checks.
- The proposed flags, the preflight, and the shape.
- The state folded from the events, the guards, and the next action.
- The round rule, gate execution, result classification, and the recorded runs.
- Cost per role, phase and gate.
- Commit subjects and bodies for artifacts and phases.
- The handover draft, the pull-request title and body, and the changelog.
- Closeout and cleanup, queue order and conflict detection.

The agents should own:

- The diagnosis and scope judgment.
- The contract and its revisions; the acceptance tests of the two flags that need an author.
- Code and tests.
- Findings, their materiality, and what the next phase needs.
- Flags one by one, reopen, waiver, a raised ceiling, and escalation decisions.
- Priority across lanes.

The boundary is the total-function test. When a task moves across it, the move is a design
change with a test, not a prompt tweak.
