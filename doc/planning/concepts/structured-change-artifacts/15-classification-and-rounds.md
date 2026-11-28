---
# Copyright (c) 2025-2026 Juliusz Ćwiąkalski (https://www.cwiakalski.com | https://www.linkedin.com/in/juliusz-cwiakalski/ | https://x.com/cwiakalski)
# Apache-2.0 License - see LICENSE file for full terms
source: https://github.com/juliusz-cwiakalski/agentic-delivery-os/blob/main-tools/doc/planning/concepts/structured-change-artifacts/15-classification-and-rounds.md
---
# 15. The shape of a change: classification, rounds, contract, and information

Status: **Proposal** (2026-11-28), written at the owner's request after a study of real
deliveries in product repositories. Where this file and a core file disagree, this file and
`14-review-decisions.md` win until the core files are updated. The study's figures are in
`18-delivery-study.md`.

## 1. Three facts decide the shape of a change

Size in changed lines decides nothing. In the study, the largest changes were sometimes the
ones that needed the least process, because their volume was mechanical, and some of the
smallest carried the most decisions. Three facts decide:

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
| `security` | Authentication, authorization, secrets, sessions, untrusted input | A security-aimed review, a hostile run |
| `data` | Persistence, migrations, deletion, event order, concurrency | The pre-code reader, a concurrency rehearsal |
| `contract` | An interface another service or client consumes | The pre-code reader, a consumer check |
| `irreversible` | Deploy or infrastructure that one revert cannot undo; money; legal | A rollback plan, sign-off |
| `environment-bound` | CI, deploy plumbing, build images | The exact CI job battery, a check of the integration branch after merge, a mutation battery |
| `first-of-a-kind` | A new runtime pattern or deploy path in the repository | The pre-code reader |
| `thin-coverage` | Code whose tests would not catch a regression | Characterization tests first |
| `protected-path` | A path the repository declares protected; derived by the tool | A deep review |

The surface map is path patterns declared per repository. The CEO and the PM maintain it
through normal changes, and a retrospective proposes a correction when it finds a misfire.
The PM decides flag by flag for a change, and the creator of a ticket can flag it before the
PM touches it.

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
several. The diagnosis is part of every shape.

## 3. Three shapes

| Shape | When | What runs |
|---|---|---|
| Light | No flag, one phase, few decisions | A card written by the PM at intake; the preflight; one reviewer; the gates; the DoD; the pull request |
| Flagged | One or more flags | The light shape plus each flag's add-ons |
| Phased | Three or more phases, or decisions that need a record | One author subagent writes the contract; the pre-code reader, its rounds by the rule in section 6; the coder per phase with handovers; the reviewer; the gates |

## 4. Who classifies, and what is scripted

| Step | Who | What |
|---|---|---|
| Ticket | Whoever writes the ticket | Optional hints: the areas to modify (paths or classes), the checks expected, the stages, and any flag. Advisory only (Q49). When a ticket already carries the diagnosis, the card is mostly a transcription: the PM verifies instead of discovering. |
| Intake | The tool proposes, the PM confirms in the intake session | Flags from the paths the ticket names, matched against the repository's surface map; the oracle from the repository type; the kind from the paths |
| Contract validated | The tool | Recomputes the flags from the contract's paths; a new flag is a recorded change |
| Review and before merge | The tool | Compares the diff with the declared paths and the surface map; a path on a surface that the contract does not flag escalates automatically |

Scripted: the flags, the kind, the oracle, the tripwire, and proxies for the number of
decisions (counts of criteria, open questions, decisions and phases). Judgment: whether the
ticket already carries the diagnosis, and how many decisions remain.

There is no classification agent. The PM already holds the ticket and the diagnosis in its
context; a fresh agent would re-read both to answer one line. The tool prepares the
evidence, the PM decides.

## 5. One contract, one author, two readers

The contract is one file with typed sections:

1. Goal, scope and non-goals.
2. Acceptance criteria, few, each with its kind of evidence.
3. Verified facts: the diagnosis, each fact with how it was checked.
4. Decisions, and open questions with defaults.
5. The oracle: per criterion, what proves it. This section replaces the test plan.
6. Work: phases and steps, each with its paths and verify command. This section replaces
   the plan.
7. Risk flags and the add-ons they trigger.

Free text lives only in declared slots: at most three per contract, each naming its reader
or archived, with a guide of about 120 words. A slot without a reader is never served.

One author writes it in one pass. For a light change the PM writes the card in the intake
session. For a larger change one author subagent writes it, so the PM's context stays light.
The plan-writer retires. The test-plan-writer becomes the acceptance author: it is invoked
only by the `security` and `data` flags, and writes the acceptance tests before the coder
starts (`16-testing-in-a-change.md`, section 5). The checklists of both move to the readers.

Two readers, on the same contract:

- The pre-code reader, only for a flagged or phased change: one adversarial pass over the
  side effects of the design, contract gaps and test adequacy. It returns findings, never a
  document.
- The reviewer, for every change: it reproduces, mutates and tries to break. It is always a
  separate agent from the author and the coder.

Why one author and not three:

- The test plan and the plan were the largest part of the artifact mass in the study, and
  the material catches did not come from them as documents.
- Three documents drift. One change in the study spent its last readiness rounds on
  version-number churn among its own three files.
- The cross-reading that three sequential authors provided was real but incidental: a
  second or third author found fewer material issues than a dedicated reader. Readers can
  be kept without three authors.

| Lost | Covered by |
|---|---|
| Test-design skill | The pre-code reader's checklist and the reviewer's reproduction |
| The plan as scheduler input | The Work section stays typed, so conflict detection still works |
| The second-author cross-check | The preflight and the pre-code reader |

The preflight is a tool step that runs before any reader: every cited path, anchor and
version exists; every cited command runs once and is checked for a pattern that matches
itself; every changed literal is searched across the repository, its tests, its CI and its
documentation; every named gate exists; every criterion has an oracle entry.

## 6. Rounds are earned, not scheduled

A reader records each finding through `review finding add` with a category and a
materiality. The category is one of: design, contract, security, data, code, coverage, fact,
environment, format, process. The materiality is one of: material (skipping it would have
caused a defect or rework later), useful (better quality, no blocking effect), cosmetic (no
effect on the outcome).

Definitions:

- A **substantial round** has at least one material finding.
- A **mechanical finding** is one the preflight or the lint can verify: a fact, a format, a
  process point, a missing oracle entry.
- A **large change** has three or more phases, or two or more flags.

The pre-code reader:

| Round | Allowed when | Closes when |
|---|---|---|
| 1 | The change has a flag, or is large | The contract is validated |
| 2 | Round 1 was substantial | Round 1 had no material finding |
| 3 | The change is large, round 2 was substantial, and the goal or a decision changed in between | Otherwise the PM or the CEO decides between the positions |

Without a flag and below three phases no reader runs before coding: the preflight and the
reviewer cover the change. Remediation re-sweeps the whole contract in the same round, by
the lint and not by a reader, and citations are version-agnostic.

The reviewer:

| Rule | Statement |
|---|---|
| One seat, one round | Every change gets exactly one reviewer and one round. The reviewer runs the oracle commands, reads the diff and mutates. |
| Round 2 | Only if round 1 was substantial. Its scope is the fixes and what they touch. |
| Round 3 | Only for a large change, and only if round 2 was substantial in changed code. |
| A second seat | Only when a flag names a competence (security, deploy safety), and only in round 1. Its findings join the same list. |
| The same finding twice | A finding whose fix fails twice goes to the PM. The lane does not attempt a third fix. |

What never earns a round: a mechanical finding, a finding about wording or format, a
finding confined to evidence or packaging. These are fixed and verified by the lint.

Escalation of the shape keys on category and materiality. A material finding in design,
contract, security or data adds the flag and its add-ons. A severity word alone never
escalates: one change in the study carried a top-severity finding that was only evidence
packaging, and the reviewer rightly kept the light shape.

The tool decides whether a round is allowed (`review rounds allowed`), from the typed
findings. The reader supplies the judgment of materiality; the rule is deterministic.

The PM or the CEO may raise a ceiling for one change with a recorded reason, for example a
very large change or a substantial finding in the last round.

## 7. State, content, history, learning

Four kinds of information live around a change. They have different writers and different
readers, and mixing them is what makes a ledger large enough that every role reads it.

| Kind | Holds | Written by | Read by |
|---|---|---|---|
| State | The current phase and step, the next step, open blockers, open questions with defaults, pending decisions, active flags with unmet add-ons, the last handover | The tool, from events; the PM, for the typed open items | The PM, at every step |
| Content | The contract | One author, through typed commands | The role that needs a section, in its phase |
| History | Events: transitions with real timestamps, sessions, tokens per agent, rounds, findings, gate results, evidence references | The tool only | Nobody during delivery; projections serve audit and retrospective |
| Learning | Memory candidates | The agents, at event time | The retrospective; promoted at closeout |

Read contexts. Delivery and retrospective are two of seven:

| Context | Reader | Question it answers |
|---|---|---|
| Deliver | Each role, in its phase | What is true now, and what is my next step? |
| Merge and waive | The CEO, the owner | May this merge, and which add-ons are unmet? |
| Schedule | The queue | In what order, and which changes collide? |
| Audit one change | An engineer after an incident | What happened in this change, and which gate saw what? |
| Retrospective | The retrospective agent, the owner's week | What did deliveries cost, and what did each gate catch? |
| Maintain | A person reading the pull request or the history | Why was this built this way? |
| Reuse | An agent solving a similar problem later | What was decided before, and what did we learn? |

The rule for serving a fact: a role receives a fact only if it acts on it now, or if the
fact constrains a decision it makes now. Everything else is fetch-on-demand or audit-only.
Timestamps, durations, token counts and retrospective notes are never served during
delivery.

There is no fixed budget per role. Content follows the removal test: if removing a word, a
sentence or a section would not lower accuracy, value or content, it is removed. Nothing is
repeated across sections. A ceiling scales with the contract and warns rather than refuses.

Two levels of work with stable identifiers. The Work section always has phases, and each
phase has steps. A light change has one phase with a few steps. Identifiers are stable
(`P2`, `P2-S3`); a reopened step keeps its identifier. Completion is an event (`step done
P2-S3`), not an edit to the contract. The tool records who completed it, when, and with what
evidence, and the state is a fold over the events. The contract stays as written.

Evidence comes in two classes. The audit facts (tokens and minutes per phase and role,
rounds, findings, verdict summaries) are persistent and stay with the change as events. The
bodies (gate outputs, logs, screenshots) are transient: the tool stores them outside the
committed scope, per repository and per change, under an evidence reference, with retention
and archiving rules. An event and a handover carry the reference and a one-line summary. No
bundle carries a body.

The handover is the only carrier of cross-phase facts: what changed and what the next phase
must adjust to. Timings and evidence bodies do not travel in it. The tool drafts it from
events (steps done, files changed, gate results); the coder keeps, by judgment, only what the
next phase needs and what is not already in the contract.

The interface is the commands and the bundles, not the files. Agents never open the stored
files. How the tool stores state, content and history may change without touching an agent.
Everything the tool writes is YAML; an agent receives the Markdown envelope; tools exchange
JSON.

## 8. Measure what you optimize

The tool records, at every boundary and per role: sessions, input, output and cache tokens,
minutes, rounds, and findings by category and materiality. The source is the harness session
store, joined to the change through the worktree registry, the way the measurements in
`10-evidence.md` were taken by hand. From these the tool derives tokens per phase, tokens
per gate, catches per gate and rounds per gate.

Until this exists, line counts, rounds and verdicts are the proxy, and the cost of a gate
cannot be compared with what it caught. In the study, sessions were recorded in a small
minority of ledgers and tokens in none.

## 9. What this changes in the pack

These edits are pending; the decisions are recorded in part 5 of `14-review-decisions.md`.

| File | Change to apply |
|---|---|
| `02-artifact-model.md` | The tier table becomes the three shapes; the specification, test plan and delivery plan become sections of one contract; the PM context holds typed open items only |
| `03-schemas.md`, `schemas/` | `spec.yaml`, `test-plan.yaml` and `delivery-plan.yaml` merge into one `contract.yaml`; coverage becomes a lint over one file; findings carry a category and a materiality |
| `04-cli.md`, `05-context-bundles.md` | One author command family; `preflight`; `review rounds allowed`; the reviewer's bundle carries the framing sections of the contract, not the diff |
| `06-workflows.md` | Experiments A to E are rewritten on the single contract |
| `08-migration.md` | Slices 2 and 3 merge into one; the tier review is closed by this section |
| `12-deterministic-core.md` | The template is a function of flags, phases and decisions; the round rule is deterministic; classification hints are prepared by the tool |
| `13-context-delivery.md` | The PM brief is state plus typed open items |

## 10. Identifiers

Identifiers follow `../id-prefix-catalog.md`: register before minting, one allocator per space,
monotonic, references by ID.

| Prefix | Identifies | Scope | Allocator |
|---|---|---|---|
| `AC-` | A criterion: an example, a property or a table of vectors | change-local | The contract |
| `PROOF-` | An obligation: the link from a criterion to its proof | change-local | The contract |
| `FACT-` | A verified fact of the diagnosis, with how it was checked | change-local | The contract |
| `PH-` | A phase; a step is `PH-02_S03` | change-local | The Work section |
| `FIND-` | A reader's finding, with its category and materiality | change-local | The tool, in the events |
| `RSK-` | A risk statement with its mitigation | change-local | The contract |
| `TC-` | A test case, as today | change-local | The contract |
| `DEC-`, `OQ-`, `NG-`, `F-`, `API-`, `ALT-`, `EVT-`, `DM-` | As today | change-local | The contract |
| `INVAR-` | A repository invariant a criterion asserts | repo-local | The repository's register |

Traceability is the join `AC-` to `PROOF-` to `TC-`. Flags are enumerated names, not IDs.
Event names are code-native and never numbered. A step keeps its identifier when reopened.

## Open points

All of its questions are answered in `09-open-points.md`: Q1 and Q43 to Q49. Testing is in
`16-testing-in-a-change.md`; the figures are in `18-delivery-study.md`.
