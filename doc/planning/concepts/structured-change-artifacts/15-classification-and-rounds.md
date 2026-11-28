---
# Copyright (c) 2025-2026 Juliusz Ćwiąkalski (https://www.cwiakalski.com | https://www.linkedin.com/in/juliusz-cwiakalski/ | https://x.com/juliusz)
# Apache-2.0 License - see LICENSE file for full terms
source: https://github.com/juliusz-cwiakalski/agentic-delivery-os/blob/main-tools/doc/planning/concepts/structured-change-artifacts/15-classification-and-rounds.md
---
# 15. The shape of a change: classification, rounds, contract, and information

Status: **Proposal**, revised after the critique of 2026-11-28. It is governed by part 5 of
`14-review-decisions.md`; the study's figures are in `18-delivery-study.md`.

## 1. Three facts decide the shape of a change

Size in changed lines decides nothing. In the study, the largest changes were sometimes the
ones that needed the least process, because their volume was mechanical, and some of the
smallest carried the most decisions; that is an observation, not a table in the note. Three
facts decide:

| Fact | Question | Decides |
|---|---|---|
| Surface | What would this change break if it is wrong? | The risk flags, and with them the add-ons |
| Decisions | How many choices are still open, and how far does the ticket already carry the diagnosis? | Whether the contract is a card or grows into a contract with a decision log and phases |
| Oracle | What would show this change is wrong in this repository? | What counts as proof: a test, a command with an expected output, a live run, the CI job battery, a rendered check |

Rules:

- Low risk is the default. A flag is earned by the surface a change touches, never by the
  wording of its ticket.
- The contract grows with decisions, never with lines.
- Lines and file counts are an escalation tripwire only, counted on the diff and excluding
  the change's own artifacts.
- When unsure, take the heavier shape and record the flag. Any gate can add a flag or move a
  change to the heavier shape; nothing is de-escalated without a recorded decision.

## 2. Risk flags

Each flag adds one specific thing. Nothing is removed.

| Flag | Fires when the change alters | Adds |
|---|---|---|
| `security` | Authentication, authorization, secrets, sessions, untrusted input | A security-aimed review, a hostile run, acceptance tests written first by the acceptance author |
| `data` | Persistence, migrations, deletion, event order, concurrency | The pre-code reader, a concurrency rehearsal, acceptance tests written first by the acceptance author |
| `contract` | An interface another service or client consumes | The pre-code reader, a consumer check |
| `irreversible` | Deploy or infrastructure that one revert cannot undo; money; legal | A rollback plan, sign-off |
| `environment-bound` | CI, deploy plumbing, build images | The exact CI job battery, a check of the integration branch after merge, a mutation battery |
| `first-of-a-kind` | A new runtime pattern or deploy path in the repository | The pre-code reader |
| `thin-coverage` | Code whose tests would not catch a regression | Characterization tests first |
| `protected-path` | A path the repository declares protected, the surface map included; derived by the tool | A deep review; the owner's sign-off when the change touches the map |

The surface map is path patterns declared per repository. The CEO and the PM maintain it
through normal changes, and a retrospective proposes a correction when it finds a misfire.
The PM decides flag by flag for a change, and the creator of a ticket can flag it before the
PM touches it.

The tool reads the map from the merge base, never from the change's own tree: in the lane
and again in CI. A change that touches the map always takes the policy flag
(`protected-path`) and needs the owner's sign-off. Such a change may widen a pattern and
never narrow one (decision 38).

Low risk by default: documentation, guides, comments and decision records; interface wording
and translations; test helpers and fixtures; dependency bumps with green tests; formatting;
mechanical bulk such as renames, moves and data batches.

Not a flag: a test harness that exercises authentication, or a document that describes
permissions. In the study, the rule keyed on such wording was the least discriminating one:
it sent harness and documentation work through the heaviest shape. The test to apply is: if
this is wrong, can it change what the system does, what is stored, or who can access what?
If not, the risk is confined to the harness or the document, and its oracle is its own check.

Low risk does not mean no care. A translation fix in the study needed its scope traced from
the code: a card written from the ticket alone would have fixed one locale instead of
several. The diagnosis is part of every shape (section 4).

## 3. Three shapes

| Shape | When | What runs |
|---|---|---|
| Light | No flag, one phase, few decisions | A card; the preflight; the coder as first reader; one reviewer; the gates; the definition of done; the pull request |
| Flagged | One or more flags | The light shape, plus each flag's add-ons and the pre-code reader after the preflight |
| Phased | Three or more phases, or decisions that need a record | A contract with a decision log and phases; the preflight; the pre-code reader, with its rounds by the rules in section 6; delivery per phase, with a handover between phases; the reviewer; the gates; the definition of done; the pull request |

The states, gates, agents and writers of each shape are in section 5.

## 4. Who classifies, and what is scripted

The flags are scripted in part, not wholly.

| Derived by | What | From |
|---|---|---|
| The tool, by path | `security`, `data`, `contract`, `environment-bound`, `protected-path` | The paths the ticket and the contract name, and the diff, matched against the surface map read from the merge base |
| The tool, by path and history | `first-of-a-kind` | A new area: no earlier change touched this runtime pattern or deploy path |
| The tool, by a coverage run | `thin-coverage` | The code the change touches |
| Judgment | `irreversible`, and the part of `security` that paths do not show | The PM's judgment, at intake |
| The tool | The kind, the oracle, the tripwire, and proxies for the number of decisions | The paths, the repository type, the diff, and counts of criteria, open questions, decisions and phases |

The PM confirms every proposed flag. A proposed flag that the PM removes carries a recorded
reason.

| Step | Who | What |
|---|---|---|
| Ticket | Whoever writes the ticket | Optional hints: the areas to modify (paths or classes), the checks expected, the stages, and any flag. Advisory only (Q49) |
| Intake | The tool proposes, the PM confirms | Flags from the paths the ticket names, matched against the surface map read from the merge base; the oracle from the repository type; the kind from the paths |
| Contract validated | The tool | Recomputes the flags from the contract's paths; a new flag is a recorded change |
| Review and before merge | The tool | Compares the diff with the declared paths and the surface map; a path on a surface that the contract does not flag escalates automatically |

Intake, in order:

1. Read the ticket and its hints.
2. Diagnose: trace the code until the mechanism is established, or verify a diagnosis the
   ticket carries. Record the verified facts (`VFACT-`), each with how it was checked.
3. Confirm the flags the tool proposed, with the reason for each one removed.
4. Write the card, or delegate the contract to the contract author (section 5).

There is no classification agent. The PM already holds the ticket and the diagnosis in its
context; a fresh agent would re-read both to answer one line. The tool prepares the
evidence, the PM decides.

## 5. One contract, one author, two readers

The contract is one file with seven typed sections: goal, scope, non-goals and the
current-truth documents to reconcile (`docs: none` or a list); acceptance criteria, few, each
with its kind of evidence; verified facts, each with how it was checked; decisions, and open
questions with defaults; the oracle, per criterion what proves it, which replaces the test
plan; work, the phases and steps with their paths and verify commands, which replaces the
plan; and the risk flags with the add-ons they trigger.

Free text lives only in declared slots: at most three per contract, each naming its reader
or archived, with a guide of about 120 words. A slot without a reader is never served.

**The author.** The contract author writes the contract in one pass (decision 34): a new
agent, built from the plan-writer's prompt (paths, steps, verify commands) and the
specification writer's contract sections. The specification writer and the plan-writer
retire. The test-plan-writer becomes the acceptance author: it is invoked only by the
`security` and `data` flags, and writes the acceptance tests before the coder starts
(`16-testing-in-a-change.md`, section 5). The checklists of the retired writers move to the
readers.

**States, gates, agents and writers.** Every shape runs these states. Flagged and phased add
the pre-code reader after the preflight; phased delivers per phase, with a handover between
phases.

| State | Gate to leave it | Light | Flagged | Phased | Written by |
|---|---|---|---|---|---|
| Intake | The diagnosis is recorded and the flags are confirmed | PM | PM | PM | The PM, through typed commands; the tool writes |
| Contract | `lint change` passes | A card: the PM or the contract author (the light card, below) | The contract author | The contract author | The tool, on the author's commands |
| Preflight | Every cited path, version, command and gate checks out | The tool | The tool | The tool | The tool records the run |
| Pre-code reading | No material finding stands | The coder, as first reader | The pre-code reader | The pre-code reader | The tool records the findings; the author revises |
| Delivery | Every step of the phase is done | The coder, one phase | The coder, with each flag's add-ons | The coder, per phase, with a handover between phases | The coder (code, tests); the acceptance author (`security`, `data`); the doc-syncer (a document in `docs:`); the tool (steps, handovers) |
| Review | No material finding stands | The reviewer | The reviewer, and a second seat where a flag names a competence | The reviewer | The tool records the findings |
| Gates | Green on the merge candidate | The runner | The runner | The runner | The tool records gate runs and evidence references |
| Definition of done | Every criterion has a recorded proof, and `docs:` is reconciled | The PM | The PM | The PM | The tool, from the statuses |
| Pull request | Opened, with the goal, the criteria and the flags | The pr-manager | The pr-manager | The pr-manager | The pr-manager, from the contract |

**The light card.** Until the classification ticket has landed (T4 in `17-roadmap.md`), the PM
writes the card only when the ticket carries a typed block or a complete diagnosis and the
change is expected to fit one phase; otherwise the contract author writes. In the light
shape the coder is the first reader (decision 35): its bundle carries the ticket and the
card; it does not start on a card that does not cover the ticket; a typed finding returns
the card to its author. When the ticket carries a typed block, the tool checks that every
check in it has an obligation. Until T4 lands, the readiness gate keeps running on every
shape.

**The current-truth documents.** Every shape reconciles them when documented behavior
changes. The contract records whether it does (`docs: none`, or the documents to update),
and a review finding can add a document.

Two readers, on the same contract:

- The pre-code reader, only for a flagged or phased change: one adversarial pass over the
  side effects of the design, contract gaps and test adequacy. It returns findings, never a
  document.
- The reviewer, for every change: it reproduces, requests mutation and tries to break. It is
  always a separate agent from the author and the coder.

Every reader's bundle carries the ticket and the non-goals.

Why one author and not three: in the study the test plan and the plan were the largest part
of the artifact mass, and the material catches did not come from them as documents; three
documents drift (one change spent its last readiness rounds on version-number churn among
its own files); and a dedicated reader keeps the cross-reading that sequential authors gave.

| Lost | Covered by |
|---|---|
| Test-design skill | The pre-code reader's checklist and the reviewer's reproduction |
| The plan as scheduler input | The Work section stays typed, so conflict detection still works |
| The second-author cross-check | The preflight and the pre-code reader |

The preflight is a tool step that runs before any reader: every cited path, anchor and
version exists; every cited command runs once, under the command policy (section 7), and is
checked for a pattern that matches itself; every changed literal is searched across the
repository, its tests, its CI and its documentation; every named gate exists; every
criterion has an oracle entry.

## 6. Rounds are earned, not scheduled

A reader records each finding through `review finding add` with a category and a
materiality. The category is one of: design, contract, security, data, code, coverage, fact,
environment, format, process. The materiality is one of: material (skipping it would have
caused a defect or rework later), useful (better quality, no blocking effect), cosmetic (no
effect on the outcome). The tool gives the finding its identifier, `RFIND-`, in the change's
event log.

Definitions:

- A **substantial round** has at least one material finding, of any category.
- A **mechanical finding** is one the preflight or the lint can verify after the fix: a fact,
  a format, a process point, a missing oracle entry. Mechanical says how a fix is verified,
  not whether a round is earned: a mechanical finding that is material earns a round like
  any other.
- A **large change** has three phases, or two flags, or crosses the line tripwire.

Materiality decides. Rules for every reader:

| Rule | Statement |
|---|---|
| A round is earned | Only by a material finding in the round before. A finding that is not material never earns one, whatever its category |
| Not material, in design, contract, security or data | The finding carries a reason: what would have to be true for it to be material |
| A material code finding on a surface the contract missed | It is filed as a process finding, a misclassification, and adds the flag with its add-ons |
| Escalation | A material finding in design, contract, security or data adds the flag and its add-ons. A severity word alone never escalates: one change in the study carried a top-severity finding that was only evidence packaging, and it stayed light |
| The same finding twice | A finding whose fix fails twice goes to the PM. The lane does not attempt a third fix |
| Remediation | It re-sweeps the whole contract in the same round, by the lint and not by a reader. Citations are version-agnostic |

Rules for the pre-code reader:

- Round 1 runs for every flagged or phased change, after the preflight.
- A further round only after a substantial round. The ceiling is two rounds, three for a
  large change; the third also needs the goal or a decision to have changed in between.
- Past a ceiling the PM or the CEO decides between the positions. The PM or the CEO may
  raise a ceiling for one change with a recorded reason.

Rules for the reviewer:

- One seat, one round, for every change. The reviewer runs the oracle commands, reads the
  diff and requests mutation.
- Round 2 only if round 1 was substantial. Its scope is the fixes and what they touch.
- Round 3 only for a large change, and only if round 2 was substantial in changed code.
- A second seat only when a flag names a competence (security, deploy safety), and only in
  round 1. Its findings join the same list.

**Mutation is a tool command.** It copies the tree, applies a fault set, runs the obligation
and records the result. The reviewer requests it and reads the result; the reviewer stays
read-only for source.

The tool decides whether a round is allowed (`review rounds allowed`), from the typed
findings. The reader supplies the judgment of materiality; the rule is deterministic.

## 7. State, content, history, learning

Four kinds of information live around a change. They have different writers and different
readers, and mixing them is what makes a ledger large enough that every role reads it. The
matrix names the store of each, and what a refused write costs.

| Kind of information | Store | Writer | A refused write | Version | Bound | Privacy |
|---|---|---|---|---|---|---|
| Content: the contract | Committed, in the change folder | The tool, on the author's typed commands; validated before it is written | Fails the command | A schema version in the file; a revision that every write expects | The byte cap per file; the measures below warn | Public with the repository; the secret scan refuses, naming the field |
| State: typed open items (blockers, questions, decisions, next actions) | Committed, in the change folder | The tool, on the PM's typed commands | Fails the command | As the contract | As the contract | As the contract |
| State: the current phase and step, the next step, the flags with unmet add-ons | A fold over the event log; stored nowhere else | The tool | Follows the event log | The event log's | None of its own | Follows the event log |
| History: the change's event log, the capsule | Committed, append-only | The tool only: its existing closed kinds, plus the new kinds step done, finding, gate run and round decision | An append that carries state fails the command; any other append keeps the capsule's rule and is recorded as refused | A version bump introduces the new kinds | The existing size cap | No token figures and no evidence bodies; a summary is built from status, counts and durations; the detail of a security finding stays in the evidence store |
| Cross-phase facts: the handovers | Committed, in the change folder | The tool drafts; the coder confirms | Fails the command | A revision under the write transaction | 1KB | As the contract |
| Cost: one aggregate record per change | Committed, in the repository's measurement log, at closeout | The tool | A refused write fails closeout; a missing source is recorded as unavailable and does not block | The measurement log's | One record per change | Aggregates only; no figure per session |
| Live cost: the state-layer telemetry with token figures (ticket, repository, lane, agent role, model) | Host-local, never committed | The tool, from the telemetry Jaiship already captures | Recorded as refused; it never gates delivery | The state layer's | The state layer's retention | Never committed |
| Read telemetry | Host-local, never committed | The tool | Recorded as refused | The state layer's | The state layer's retention | Never committed |
| Evidence bodies: gate outputs, logs, screenshots | The evidence store, host-local, never committed | The tool | The event keeps the reference and a one-line summary | None: the content hash identifies the body | Retention rules | Never committed |
| Learning: memory candidates | Committed, in the change folder | The agents, at event time; one decision per candidate at closeout | Not written through the tool | The memory record schema | The memory rules | As the contract |

| Fact | Its one home |
|---|---|
| Goal, scope, non-goals, criteria, obligations, verified facts, decisions, work, `docs:`, and flags (a gate adds one as a new revision whose reason is the finding) | The contract |
| An open blocker, question, decision or next action | The typed open items |
| A step done, by whom and when (the state is a fold over it); a finding with its category, materiality and reason; a gate result (its body in the evidence store); a round and why it was allowed; a waiver with its expiry | The event log |
| What the next phase must adjust to | The last handover |
| Minutes and tokens per role and phase | The host-local telemetry |
| The aggregate cost of one change | The measurement log, one record per change |
| A bundle read | The read telemetry |
| The surface map | The repository's configuration, read from the merge base |

Read contexts. Delivery and retrospective are two of seven:

| Context | Reader | Question it answers |
|---|---|---|
| Deliver | Each role, in its phase | What is true at this step, and what is my next step? |
| Merge and waive | The CEO, the owner | May this merge, and which add-ons are unmet? |
| Schedule | The queue | In what order, and which changes collide? |
| Audit one change | An engineer after an incident | What happened in this change, and which gate saw what? |
| Retrospective | The retrospective agent, the owner's week | What did deliveries cost, and what did each gate catch? |
| Maintain | A person reading the pull request or the history | Why was this built this way? |
| Reuse | An agent solving a similar problem later | What was decided before, and what did we learn? |

The rule for serving a fact: a role receives a fact only if it acts on it at this step, or
if the fact constrains a decision it makes at this step. Everything else is fetch-on-demand
or audit-only. Timestamps, durations, token counts and retrospective notes are never served
during delivery.

There is no fixed budget per role. Content follows the removal test: if removing a word, a
sentence or a section would not lower accuracy, value or content, it is removed. Nothing is
repeated across sections. A ceiling scales with the contract and warns rather than refuses.
Three measures stand in for a ceiling: the duplicate line share across sections, the
free-text words per criterion, and a warning line per shape. The lint reports each and
never refuses on it.

Two levels of work with stable identifiers. The Work section always has phases, and each
phase has steps. A light change has one phase with a few steps. Identifiers are stable
(`PH-02`, `PH-02_S03`); a reopened step keeps its identifier. Completion is an event (`step
done PH-02_S03`), not an edit to the contract. The tool records who completed it, when, and
with what evidence. The contract stays as written.

Evidence comes in two classes. Audit facts (rounds, findings, verdict summaries) stay with
the change as events. Bodies (gate outputs, logs, screenshots) live in the evidence store,
per repository and per change, with retention rules. A reference is a content hash with
kind, size and run identity; an event and a handover carry the reference and a one-line
summary. No bundle carries a body.

The handover is the only carrier of cross-phase facts: what changed and what the next phase
must adjust to. Timings and evidence bodies do not travel in it. The tool drafts it from
events (steps done, files changed, gate results); the coder keeps, by judgment, only what the
next phase needs and what is not already in the contract.

The interface is the commands and the bundles, not the files. Agents never open the stored
files. How the tool stores state, content and history may change without touching an agent.
The stored artifacts are YAML, the event log is JSON lines, an agent receives the Markdown
envelope, and tools exchange JSON.

**The write transaction** (decision 39). Every write takes a per-change lock, an expected
revision and an idempotency key. It is refused when the file differs from the committed
version, so a hand edit cannot ride into a tool commit. Only the written file is staged,
never the change folder. A repair starts from a failing lint: `change repair` is accepted
only on a file that `lint change` rejects. Each write records the session and the role, and
the lane's session report can check the declaration. The commit trailer proves attribution
by convention, not identity: on one host with one operating-system user it makes a bypass
visible; it does not make it impossible.

**The command policy** (decision 39). The tool runs a command that a contract or a ticket
cites only under a policy: an allowlist of command prefixes per repository; no shell; a
working directory confined to the worktree; an environment without credentials; ticket hints
limited to known gates and existing test paths; every command marked with its origin, which
is the tracker, the author or the tool; and every command the tool runs shown to the
reviewer. The preflight, the obligations and the mutation command run under it.

**Persisted content** (decision 39). The stored artifacts are YAML 1.2 core. Duplicate keys
are rejected. Each file is under a byte cap. There is one canonical serialization, so an
unchanged file re-emits byte for byte and a hand edit is detectable by re-emission. One
pinned parser reads the YAML, in the CLI and in CI. Every persisted string is scanned for
secrets, and a hit refuses the write naming the field.

## 8. Measure what you optimize

Jaiship already captures sessions and tokens per agent, with the ticket, the repository, the
lane, the agent role and the model. The tool builds no second telemetry: it reads that
state-layer telemetry per change, phase and role, adds the two dimensions it lacks, the
phase and the gate, and derives tokens per phase, tokens per gate, catches per gate and
rounds per gate (decision 36).

Live cost is read from the host-local store, and token figures never enter the committed
capsule. At closeout the tool commits one aggregate cost record per change to the
repository's measurement log, so the cost of a change stays readable after its merge and
the removal of its worktree. Where the committed figures live is the owner's to confirm.

Until this exists, line counts, rounds and verdicts are the proxy, and the cost of a gate
cannot be compared with what it caught. In the study, sessions were recorded in a small
minority of ledgers and tokens in none.

## 9. What this changes in the pack

Applied in this revision (2026-11-28): sections 02 to 06, 08, 11, 12, 13 and `schemas/`
describe this model. Where anything still disagrees, `14-review-decisions.md` wins.

## 10. Identifiers

Identifiers follow `../id-prefix-catalog.md`: register before minting, one allocator per space,
monotonic, references by ID.

| Prefix | Identifies | Scope | Allocator |
|---|---|---|---|
| `AC-` | A criterion: an example, a property or a table of vectors | change-local | The contract |
| `PROOF-` | An obligation: the link from a criterion to its proof | change-local | The contract |
| `VFACT-` | A verified fact of the diagnosis, with how it was checked | change-local | The contract |
| `PH-` | A phase; a step is `PH-02_S03` | change-local | The contract |
| `RSK-` | A risk statement with its mitigation | change-local | The contract |
| `RFIND-` | A reader's finding, with its category and materiality | change-local | The tool, in the change's event log |
| `TC-` | A test case, as today | change-local | The contract |
| `DEC-`, `OQ-`, `NG-`, `API-`, `ALT-`, `EVT-`, `DM-` | As today | change-local | The contract |
| `INVAR-` | A repository invariant a criterion asserts | repo-local | The repository's register |

Traceability is the join `AC-` to `PROOF-` to `TC-`. Flags are enumerated names, not IDs.
Event names are code-native and never numbered. A step keeps its identifier when reopened.

## Open points

All of its questions are answered in `09-open-points.md`: Q1 and Q43 to Q49. Testing is in
`16-testing-in-a-change.md`; the figures are in `18-delivery-study.md`.
